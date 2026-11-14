// Surface snapshots for "every player on their own device" (docs/TEAM.md).
// Pure: no DOM, no network, loads in node. SMD.team.surfaceNet
//
//   const enc = net.createEncoder();
//   enc.init(state)            -> plain JSON-safe init object (map, roster, static site facts)
//   enc.encode(state, { slow }) -> Uint8Array snapshot, quantised, normally 0.5-2 KB
//   net.chunks(init)           -> [Uint8Array], the init split for the unreliable channel
//
//   const dec = net.createDecoder();
//   dec.packet(bytes)          -> 'init' | 'snapshot' | null; whatever the bytes were
//   dec.ready, dec.init
//   dec.latest                 -> last decoded state, same shape as docs/TEAM-SURFACE.md
//
//   const buf = net.createInterpolator({ delay: 0.1 });
//   buf.push(state, nowS);  buf.sample(nowS) -> state with positions blended, plus events now due
//   const pred = net.createPredictor({ stepMove, map, speed, tick });
//   pred.tick(dt, input); pred.correct(serverX, serverZ, nowS, serverT); pred.x, pred.z, pred.heading
//
// A decoded state has only what the renderer and HUD read, so what a client
// draws is exactly what a shared screen draws. Entity ids become 'nN'.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};

  const MAX_BYTES = 3000;
  const PKT_SNAPSHOT = 1;
  const PKT_INIT = 2;
  const NONE = 0xffff;

  const FAST_KINDS = ['astronaut', 'boulder'];
  const SLOW_KINDS = ['lander', 'dish', 'site', 'sample', 'pickup'];

  // Every short word that travels. New words still work: they go as text.
  const WORDS = [
    '', 'idle', 'walk', 'fire', 'scan', 'carry', 'drive', 'ride', 'downed', 'dead', 'plant', 'repair',
    'shield', 'dark', 'planted', 'transmit', 'broken', 'wrecked', 'dry', 'escort', 'fetch', 'return',
    'scanning', 'done', 'blocked', 'ground', 'carried', 'angry', 'chase', 'leap', 'aim', 'spit', 'sleep', 'buried',
    'emerge', 'surfaced', 'dive', 'patrol', 'windup', 'swipe', 'stun', 'distracted', 'charge', 'stalled', 'fly', 'burn',
    'cutter', 'laser', 'drill', 'flare', 'punch', 'turret', 'rover', 'clock', 'called', 'all_aboard',
    'ice', 'mineral', 'atmosphere', 'thermal', 'organic',
    'energy', 'o2', 'medkit',
    'intro', 'play', 'extraction', 'over', 'calm', 'pressure', 'siege', 'frantic',
    'extracted', 'wiped', 'stranded', 'hull_lost',
    'storm', 'radiation', 'quake', 'rockfall', 'acid', 'warn', 'active', 'upcoming', 'open',
    'revive', 'pickup', 'drop', 'use', 'mount', 'dismount', 'needs_instrument', 'align', 'heal', 'dish', 'sample', 'astronaut', 'swarmer', 'spitter', 'burrower', 'hunter', 'rogue',
    'moon', 'mars', 'venus', 'europa', 'planner', 'engineer', 'scientist', 'comms',
    'rest', 'returning', 'shelter', 'deliver', 'oxygen', 'battery', 'suit', 'call', 'send', 'science', 'home', 'partial', 'success', 'resupply', 'hold', 'wait',
  ];
  const WORD_INDEX = new Map(WORDS.map((w, i) => [w, i]));

  // Event payloads: e entity id, s word, f float32, b byte 0-255, a signed unit
  // value, q quarter-metre range. Anything not listed still arrives, without extras.
  const EVENT_FIELDS = {
    hit: ['target:e', 'amount:b'],
    suitReturn: ['id:e', 'reason:s'],
    suitHome: ['id:e'],
    suitPatched: ['id:e', 'by:e'],
    boarded: ['id:e'],
    lowBattery: ['id:e'],
    o2StockOut: [],
    overclock: ['by:e'],
    uplinkBoost: ['by:e'],
    decisionOpen: ['overKg:f'],
    scan: ['siteId:e', 'progress:a', 'by:e'],
    scanDone: ['siteId:e', 'by:e'],
    recorderFull: [],
    dataOverwritten: ['gbit:f'],
    sampleTaken: ['id:e'],
    sampleDelivered: ['id:e'],
    samplePickup: ['id:e', 'by:e'],
    sampleDrop: ['id:e'],
    pickup: ['item:s', 'by:e'],
    windowOpen: ['i:b'],
    windowClose: ['i:b', 'sentGbit:f'],
    uplinkTick: ['gbit:f', 'i:b'],
    dishPlanted: [],
    dishDown: [],
    baseDark: [],
    baseLit: [],
    sunset: [],
    sunrise: [],
    hazardWarn: ['kind:s'],
    hazardStart: ['kind:s'],
    hazardEnd: ['kind:s'],
    rockfall: ['r:q'],
    quake: [],
    ping: ['id:e', 'by:e'],
    extractionCalled: ['by:e'],
    jettison: ['id:e'],
    liftoff: ['aboard:b'],
    lowO2: ['id:e'],
  };
  const EVENT_NAMES = Object.keys(EVENT_FIELDS);
  const EVENT_INDEX = new Map(EVENT_NAMES.map((n, i) => [n, i]));
  const LOW_PRIORITY = { hit: 1, uplinkTick: 1, scan: 1 };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d || 0);

  // ---------- Bytes ----------
  class Writer {
    constructor(size) {
      this.buf = new Uint8Array(size || 8192);
      this.dv = new DataView(this.buf.buffer);
      this.p = 0;
    }
    room(n) {
      if (this.p + n <= this.buf.length) return;
      const next = new Uint8Array(Math.max(this.buf.length * 2, this.p + n + 256));
      next.set(this.buf);
      this.buf = next;
      this.dv = new DataView(next.buffer);
    }
    u8(v) {
      this.room(1);
      this.buf[this.p++] = clamp(Math.round(v) || 0, 0, 255);
    }
    u16(v) {
      this.room(2);
      this.dv.setUint16(this.p, clamp(Math.round(v) || 0, 0, 65535));
      this.p += 2;
    }
    u32(v) {
      this.room(4);
      this.dv.setUint32(this.p, v >>> 0);
      this.p += 4;
    }
    f32(v) {
      this.room(4);
      this.dv.setFloat32(this.p, num(v));
      this.p += 4;
    }
    word(s) {
      const w = s == null ? '' : String(s);
      const i = WORD_INDEX.get(w);
      if (i !== undefined) return this.u8(i);
      this.u8(255);
      this.text(w);
    }
    text(s) {
      const b = utf8(String(s == null ? '' : s).slice(0, 80));
      this.u8(b.length);
      this.room(b.length);
      this.buf.set(b, this.p);
      this.p += b.length;
    }
    done() {
      return this.buf.slice(0, this.p);
    }
  }
  class Reader {
    constructor(bytes) {
      this.buf = bytes;
      this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      this.p = 0;
    }
    get more() {
      return this.p < this.buf.length;
    }
    u8() {
      if (this.p >= this.buf.length) throw new RangeError('short packet');
      return this.buf[this.p++];
    }
    u16() {
      const v = this.dv.getUint16(this.p);
      this.p += 2;
      return v;
    }
    u32() {
      const v = this.dv.getUint32(this.p);
      this.p += 4;
      return v;
    }
    f32() {
      const v = this.dv.getFloat32(this.p);
      this.p += 4;
      return v;
    }
    word() {
      const i = this.u8();
      return i === 255 ? this.text() : WORDS[i] || '';
    }
    text() {
      const n = this.u8();
      const s = this.buf.subarray(this.p, this.p + n);
      this.p += n;
      return fromUtf8(s);
    }
  }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    return Uint8Array.from(Buffer.from(s, 'utf8'));
  }
  function fromUtf8(b) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(b);
    return Buffer.from(b).toString('utf8');
  }

  // For transports that only carry text.
  function toBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function fromBase64(text) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(text, 'base64'));
    const s = atob(text);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  // Tiles change never, and most are floor: run-length pairs are tiny.
  function rle(tiles) {
    const out = [];
    let i = 0;
    while (i < tiles.length) {
      let n = 1;
      while (i + n < tiles.length && tiles[i + n] === tiles[i] && n < 60000) n++;
      out.push(tiles[i], n);
      i += n;
    }
    return out;
  }
  function unrle(pairs) {
    const out = [];
    for (let i = 0; i < pairs.length; i += 2) for (let k = 0; k < pairs[i + 1]; k++) out.push(pairs[i]);
    return out;
  }

  // ---------- Encoder (host) ----------
  function createEncoder() {
    const ids = new Map();
    let nextN = 1;
    let seq = 0;
    let lastInit = null;
    const idOf = (id) => {
      if (id == null || id === '') return NONE;
      let n = ids.get(id);
      if (n === undefined) {
        n = nextN++;
        if (nextN >= NONE) nextN = 1; // ids are recycled only after 65k spawns in one mission
        ids.set(id, n);
      }
      return n;
    };

    function init(state) {
      const size = state.map.size;
      const players = state.entities
        .filter((e) => e.kind === 'astronaut')
        .map((p) => ({ n: idOf(p.id), slot: p.slot, playerId: p.playerId, name: p.name, role: p.role, isBot: !!p.isBot }));
      const sites = state.entities.filter((e) => e.kind === 'site').map((s) => ({ n: idOf(s.id), label: s.label, fits: s.fits, siteKind: s.siteKind, objective: !!s.objective, instrument: s.instrument || null }));
      const windows = (state.uplink.windows || []).map((w) => ({ i: w.i, start: w.start, dur: w.dur, rateGbitS: w.rateGbitS }));
      lastInit = {
        v: 1,
        world: state.world,
        seed: state.seed,
        T: state.T,
        difficulty: state.difficulty,
        hazardsMode: state.hazardsMode,
        size,
        map: { uid: state.map.uid, size, cell: state.map.cell, w: state.map.w, h: state.map.h, tiles: rle(state.map.tiles), lander: state.map.lander, dishPad: state.map.dishPad, caves: state.map.caves || [] },
        objective: state.loadout ? state.loadout.objective : null,
        players,
        sites,
        windows,
        uplinkLabel: state.uplink.label,
      };
      return lastInit;
    }

    function encodeWith(state, opts, limits) {
      const w = new Writer(4096);
      const size = state.map.size || 192;
      const pos = (v) => w.u16((clamp(num(v), 0, size) / size) * 65534);
      const hdg = (h) => w.u8(((num(h) + Math.PI) / (Math.PI * 2)) * 255);
      const frac = (v, max) => w.u8((clamp(num(v) / (max || 1), 0, 1) || 0) * 255);
      const ref = (id) => w.u16(idOf(id));
      w.u8(PKT_SNAPSHOT);
      let flags = 0;
      if (opts.slow) flags |= 1;
      if (state.over) flags |= 2;
      if (state.sun && state.sun.up) flags |= 4;
      w.u8(flags);
      w.u16(seq++ & 0xffff);
      w.f32(state.t);
      w.word(state.stage);
      w.word(state.phase);
      w.word(state.outcome || '');
      w.u8(clamp(num(state.intensity), 0, 1) * 255);
      w.f32(state.sun ? state.sun.light : 1);
      w.f32(state.sun ? state.sun.elevation : 1);
      w.f32(state.sun ? state.sun.nextChangeIn : 0);
      w.f32(state.extraction ? state.extraction.timer : 0);
      w.u8(state.extraction && state.extraction.called ? 1 : 0);
      w.f32(state.extraction ? state.extraction.decision || 0 : 0);

      // Fast entities, grouped by kind so each only names its kind once.
      const groups = FAST_KINDS.map(() => []);
      for (const e of state.entities) {
        const i = FAST_KINDS.indexOf(e.kind);
        if (i >= 0 && !e.gone) groups[i].push(e);
      }
      w.u8(FAST_KINDS.length);
      groups.forEach((list, g) => {
        const kind = FAST_KINDS[g];
        w.u8(Math.min(list.length, 255));
        for (const e of list.slice(0, 255)) {
          ref(e.id);
          w.word(e.state);
          pos(e.x);
          pos(e.z);
          hdg(e.heading);
          frac(e.hp, e.maxHp);
          w.f32(e.maxHp);
          if (kind === 'astronaut') {
            w.u8(e.slot);
            let fl = 0;
            if (e.aboard) fl |= 2;
            if (e.isBot) fl |= 8;
            if (e.sprinting) fl |= 16;
            w.u8(fl);
            w.u8(num(e.o2));
            w.u8(num(e.energy));
            ref(e.carrying);
            w.f32(e.useT);
            w.word(e.useKind);
            w.word(e.returning || '');
            w.u8(clamp(num(e.restT), 0, 25) * 10);
          } else if (kind === 'boulder') {
            w.f32(e.tLeft);
          }
        }
      });

      // The slow section: things that barely move, sent every few snapshots.
      if (opts.slow) {
        const slowKinds = SLOW_KINDS.map(() => []);
        for (const e of state.entities) {
          const i = SLOW_KINDS.indexOf(e.kind);
          if (i >= 0 && !e.gone) slowKinds[i].push(e);
        }
        w.u8(SLOW_KINDS.length);
        slowKinds.forEach((list, g) => {
          const kind = SLOW_KINDS[g];
          w.u8(Math.min(list.length, 255));
          for (const e of list.slice(0, 255)) {
            ref(e.id);
            w.word(e.state);
            pos(e.x);
            pos(e.z);
            hdg(e.heading);
            frac(e.hp, e.maxHp);
            w.f32(e.maxHp);
            if (kind === 'site') {
              w.word(e.siteKind);
              let fl = 0;
              if (e.done) fl |= 2;
              if (e.revealed) fl |= 4;
              if (e.sampleTaken) fl |= 8;
              w.u8(fl);
              w.u8(clamp(num(e.scanned), 0, 1) * 255);
            } else if (kind === 'sample') {
              w.word(e.siteKind);
              w.f32(e.massKg);
              w.f32(e.value);
              w.u8(e.core ? 1 : 0);
              ref(e.heldBy);
            } else if (kind === 'pickup') {
              w.word(e.item);
            } else if (kind === 'dish') {
              w.f32(e.align);
              w.u8(e.planted ? 1 : 0);
              w.f32(e.plantT || 0);
            }
          }
        });
        const B = state.base;
        for (const v of [B.battery, B.batteryMax, B.solarW, B.loadW, B.hull, B.hullMax, B.o2Stock, B.o2StockMax, B.shieldR, B.lightR]) w.f32(v);
        let fl = 0;
        if (B.shieldOn) fl |= 1;
        if (B.lightsOn) fl |= 2;
        if (B.chargerOn) fl |= 4;
        if (B.dark) fl |= 8;
        if (B.heatOn) fl |= 16;
        if (B.shelter) fl |= 32;
        w.u8(fl);
        const R = state.recorder;
        w.f32(R.usedGbit);
        w.f32(R.capacityGbit);
        const U = state.uplink;
        w.u8(U.open < 0 ? 255 : U.open);
        w.f32(U.nextIn);
        w.u8(U.planted ? 1 : 0);
        w.f32(U.align);
        w.f32(U.rateNow);
        w.f32(U.gbitSent);
        w.f32(U.valueSent);
        w.f32(U.holdR);
        const winds = U.windows || [];
        w.u8(Math.min(winds.length, 40));
        for (const x of winds.slice(0, 40)) {
          w.word(x.state);
          w.f32(x.sentGbit);
        }
        const A = state.ascent;
        w.f32(A.liftKg);
        w.f32(A.loadedKg);
        w.f32(A.overKg);
        const rack = (A.rack || []).slice(0, 16);
        w.u8(rack.length);
        for (const r of rack) {
          w.text(r.id);
          w.word(r.siteKind);
          w.f32(r.massKg);
          w.f32(r.value);
          w.u8(r.core ? 1 : 0);
        }
        w.u8(Math.min((A.jettisoned || []).length, 255));
        const H = (state.hazards || []).slice(0, 12);
        w.u8(H.length);
        for (const h of H) {
          w.word(h.kind);
          pos(h.x);
          pos(h.z);
          w.u8(num(h.r));
          w.word(h.state);
          w.f32(h.tLeft);
        }
        const P = (state.pings || []).slice(0, 12);
        w.u8(P.length);
        for (const p of P) {
          ref(p.id);
          pos(p.x);
          pos(p.z);
          ref(p.by);
          w.f32(p.tLeft);
        }
        const prompts = Object.keys(state.prompts || {}).slice(0, 8);
        w.u8(prompts.length);
        for (const id of prompts) {
          w.text(id);
          w.word(state.prompts[id]);
        }
        // The surface objectives, for the progress tracker.
        w.u8(clamp(num(state.progress), 0, 1) * 255);
        const objs = (state.objectives || []).slice(0, 8);
        w.u8(objs.length);
        for (const o of objs) {
          w.word(o.id);
          w.u8(clamp(num(o.frac), 0, 1) * 255);
          w.u8(o.done ? 1 : 0);
          w.text(o.text || '');
        }
      }

      // Events, this step only.
      let events = state.events || [];
      if (limits.dropHits) events = events.filter((e) => !LOW_PRIORITY[e.type]);
      events = events.filter((e) => EVENT_INDEX.has(e.type)).slice(0, 64);
      w.u8(events.length);
      for (const e of events) {
        w.u8(EVENT_INDEX.get(e.type));
        pos(e.x);
        pos(e.z);
        for (const spec of EVENT_FIELDS[e.type]) {
          const key = spec.split(':')[0];
          const type = spec.split(':')[1];
          const v = e[key];
          if (type === 'e') ref(v);
          else if (type === 's') w.word(v);
          else if (type === 'f') w.f32(v);
          else if (type === 'b') w.u8(num(v));
          else if (type === 'a') w.u8(((clamp(num(v), -1, 1) + 1) / 2) * 255);
          else if (type === 'q') w.u8(clamp(num(v), 0, 63.75) * 4);
        }
      }
      return w.done();
    }

    function encode(state, opts = {}) {
      let out = encodeWith(state, opts, { dropHits: false });
      if (out.length > MAX_BYTES) out = encodeWith(state, opts, { dropHits: true });
      return out;
    }

    return { init, encode, idOf };
  }

  // The init travels on the same unreliable channel as snapshots, in pieces
  // that are repeated round-robin, so a lost one is simply caught on the next
  // pass. Each piece: [2, index, count, ...json utf-8].
  function chunks(init, size = 900) {
    const bytes = utf8(JSON.stringify(init));
    const n = Math.max(1, Math.ceil(bytes.length / size));
    const out = [];
    for (let i = 0; i < n; i++) {
      const slice = bytes.subarray(i * size, Math.min(bytes.length, (i + 1) * size));
      const pkt = new Uint8Array(slice.length + 3);
      pkt[0] = PKT_INIT;
      pkt[1] = i;
      pkt[2] = n;
      pkt.set(slice, 3);
      out.push(pkt);
    }
    return out;
  }

  // ---------- Decoder (client) ----------
  function createDecoder() {
    let init = null;
    let parts = null;
    let partsN = 0;
    let got = 0;
    let latest = null;
    const slow = { entities: [], base: null, recorder: { usedGbit: 0, capacityGbit: 1, sets: [] }, uplink: null, ascent: null, team: null, hazards: [], pings: [], prompts: {}, progress: 0, objectives: [] };
    let staticSites = {};
    let playersByN = {};
    let lastSeq = -1;

    const rid = (n) => (n === NONE ? null : 'n' + n);

    function adoptInit(data) {
      init = data;
      init.map = Object.assign({}, data.map, { tiles: unrle(data.map.tiles), world: data.world, routes: [] });
      staticSites = {};
      (data.sites || []).forEach((s) => (staticSites[s.n] = s));
      playersByN = {};
      (data.players || []).forEach((p) => (playersByN[p.n] = p));
    }

    function readEntity(r, kind, size) {
      const n = r.u16();
      const id = rid(n);
      const state = r.word();
      const x = (r.u16() / 65534) * size;
      const z = (r.u16() / 65534) * size;
      const heading = (r.u8() / 255) * Math.PI * 2 - Math.PI;
      const hpF = r.u8() / 255;
      const maxHp = r.f32();
      const e = { id, n, kind, state, x, z, heading, hp: hpF * maxHp, maxHp, r: 0.6 };
      return e;
    }

    function decode(bytes) {
      const r = new Reader(bytes);
      r.u8(); // type
      const flags = r.u8();
      const seq = r.u16();
      const size = init.size;
      const pos = () => (r.u16() / 65534) * size;
      const t = r.f32();
      const stage = r.word();
      const phase = r.word();
      const outcome = r.word() || null;
      const intensity = r.u8() / 255;
      const light = r.f32();
      const elevation = r.f32();
      const nextChangeIn = r.f32();
      const extractionTimer = r.f32();
      const extractionCalled = !!r.u8();
      const decision = r.f32();
      // A stale packet (unreliable channel) changes nothing.
      if (latest && lastSeq >= 0) {
        const delta = (seq - lastSeq + 65536) % 65536;
        if (delta === 0) return null;
        if (delta > 32768) {
          // Far behind is not a late packet: the host came back with a new encoder.
          // Forget the old map and wait for the new one.
          if ((lastSeq - seq + 65536) % 65536 > 120) {
            init = null;
            parts = null;
            partsN = 0;
            got = 0;
            lastSeq = -1;
          }
          return null;
        }
      }
      lastSeq = seq;

      const fast = [];
      const nGroups = r.u8();
      for (let g = 0; g < nGroups; g++) {
        const kind = FAST_KINDS[g];
        const count = r.u8();
        for (let i = 0; i < count; i++) {
          const e = readEntity(r, kind, size);
          if (kind === 'astronaut') {
            e.slot = r.u8();
            const fl = r.u8();
            e.downed = false;
            e.dead = false;
            e.aboard = !!(fl & 2);
            e.isBot = !!(fl & 8);
            e.sprinting = !!(fl & 16);
            e.o2 = r.u8();
            e.energy = r.u8();
            e.weapon = null;
            e.weapons = [];
            e.mounted = null;
            e.carrying = rid(r.u16());
            e.useT = r.f32();
            e.useKind = r.word() || null;
            e.returning = r.word() || null;
            e.restT = r.u8() / 10;
            const meta = playersByN[e.n];
            if (meta) {
              e.playerId = meta.playerId;
              e.name = meta.name;
              e.role = meta.role;
            }
          } else if (kind === 'boulder') {
            e.tLeft = r.f32();
          }
          fast.push(e);
        }
      }

      if (flags & 1) {
        const list = [];
        const nSlow = r.u8();
        for (let g = 0; g < nSlow; g++) {
          const kind = SLOW_KINDS[g];
          const count = r.u8();
          for (let i = 0; i < count; i++) {
            const e = readEntity(r, kind, size);
            if (kind === 'site') {
              e.siteKind = r.word();
              const fl = r.u8();
              e.done = !!(fl & 2);
              e.revealed = !!(fl & 4);
              e.sampleTaken = !!(fl & 8);
              e.scanned = r.u8() / 255;
              const st = staticSites[e.n];
              if (st) {
                e.label = st.label;
                e.fits = st.fits;
                e.objective = !!st.objective;
                e.instrument = st.instrument || null;
              }
            } else if (kind === 'sample') {
              e.siteKind = r.word();
              e.massKg = r.f32();
              e.value = r.f32();
              e.core = !!r.u8();
              e.heldBy = rid(r.u16());
            } else if (kind === 'pickup') {
              e.item = r.word();
            } else if (kind === 'dish') {
              e.align = r.f32();
              e.planted = !!r.u8();
              e.plantT = r.f32();
            }
            list.push(e);
          }
        }
        slow.entities = list;
        const v = [];
        for (let i = 0; i < 10; i++) v.push(r.f32());
        const fl = r.u8();
        slow.base = { battery: v[0], batteryMax: v[1], solarW: v[2], loadW: v[3], hull: v[4], hullMax: v[5], o2Stock: v[6], o2StockMax: v[7], shieldR: v[8], lightR: v[9], shieldOn: !!(fl & 1), lightsOn: !!(fl & 2), chargerOn: !!(fl & 4), dark: !!(fl & 8), heatOn: !!(fl & 16), shelter: !!(fl & 32) };
        slow.recorder = { usedGbit: r.f32(), capacityGbit: r.f32(), sets: [] };
        const openB = r.u8();
        const nextIn = r.f32();
        const planted = !!r.u8();
        const align = r.f32();
        const rateNow = r.f32();
        const gbitSent = r.f32();
        const valueSent = r.f32();
        const holdR = r.f32();
        const wc = r.u8();
        const windows = [];
        for (let i = 0; i < wc; i++) {
          const base = (init.windows && init.windows[i]) || { i };
          windows.push(Object.assign({}, base, { state: r.word(), sentGbit: r.f32() }));
        }
        slow.uplink = { windows, open: openB === 255 ? -1 : openB, nextIn, planted, align, rateNow, gbitSent, valueSent, holdR, label: init.uplinkLabel || '' };
        const liftKg = r.f32();
        const loadedKg = r.f32();
        const overKg = r.f32();
        const rc = r.u8();
        const rack = [];
        for (let i = 0; i < rc; i++) rack.push({ id: r.text(), siteKind: r.word(), massKg: r.f32(), value: r.f32(), core: !!r.u8() });
        const jettisonedN = r.u8();
        slow.ascent = { liftKg, loadedKg, overKg, rack, jettisoned: new Array(jettisonedN).fill(null) };
        slow.team = {};
        const hc = r.u8();
        const hazards = [];
        for (let i = 0; i < hc; i++) hazards.push({ id: 'h' + i, kind: r.word(), x: pos(), z: pos(), r: r.u8(), state: r.word(), tLeft: r.f32() });
        slow.hazards = hazards;
        const pc = r.u8();
        const pings = [];
        for (let i = 0; i < pc; i++) pings.push({ id: rid(r.u16()), x: pos(), z: pos(), by: rid(r.u16()), tLeft: r.f32() });
        slow.pings = pings;
        const pr = r.u8();
        const prompts = {};
        for (let i = 0; i < pr; i++) {
          const id = r.text();
          prompts[id] = r.word();
        }
        slow.prompts = prompts;
        slow.progress = r.u8() / 255;
        const oc = r.u8();
        const objectives = [];
        for (let i = 0; i < oc; i++) objectives.push({ id: r.word(), frac: r.u8() / 255, done: !!r.u8(), text: r.text() });
        slow.objectives = objectives;
      }

      const events = [];
      const ec = r.u8();
      for (let i = 0; i < ec; i++) {
        const idx = r.u8();
        const type = EVENT_NAMES[idx];
        const ev = { type, t, x: pos(), z: pos() };
        for (const spec of EVENT_FIELDS[type] || []) {
          const key = spec.split(':')[0];
          const kindC = spec.split(':')[1];
          if (kindC === 'e') ev[key] = rid(r.u16());
          else if (kindC === 's') ev[key] = r.word();
          else if (kindC === 'f') ev[key] = r.f32();
          else if (kindC === 'b') ev[key] = r.u8();
          else if (kindC === 'a') ev[key] = (r.u8() / 255) * 2 - 1;
          else if (kindC === 'q') ev[key] = r.u8() / 4;
        }
        events.push(ev);
      }

      if (!slow.base) return null; // nothing to draw until the first slow section
      latest = {
        version: 1,
        seed: init.seed,
        world: init.world,
        hazardsMode: init.hazardsMode,
        difficulty: init.difficulty,
        t,
        T: init.T,
        over: !!(flags & 2),
        outcome,
        stage,
        phase,
        intensity,
        sun: { up: !!(flags & 4), elevation, light, nextChangeIn },
        map: init.map,
        entities: fast.concat(slow.entities),
        base: slow.base,
        recorder: slow.recorder,
        uplink: slow.uplink,
        ascent: slow.ascent,
        extraction: { called: extractionCalled, timer: extractionTimer, by: null, decision },
        team: slow.team,
        hazards: slow.hazards,
        pings: slow.pings,
        prompts: slow.prompts,
        progress: slow.progress || 0,
        objectives: slow.objectives || [],
        loadout: { objective: init.objective || null },
        events,
      };
      return latest;
    }

    return {
      get ready() {
        return !!init;
      },
      get init() {
        return init;
      },
      get latest() {
        return latest;
      },
      packet(bytes) {
        if (!bytes || !bytes.length) return null;
        if (bytes[0] === PKT_INIT) {
          if (init) return null;
          const i = bytes[1];
          const n = bytes[2];
          if (!parts || partsN !== n) {
            parts = new Array(n).fill(null);
            partsN = n;
            got = 0;
          }
          if (!parts[i]) {
            parts[i] = bytes.slice(3);
            got++;
          }
          if (got === n) {
            const total = parts.reduce((s, p) => s + p.length, 0);
            const all = new Uint8Array(total);
            let o = 0;
            for (const p of parts) {
              all.set(p, o);
              o += p.length;
            }
            adoptInit(JSON.parse(fromUtf8(all)));
            parts = null;
            return 'init';
          }
          return null;
        }
        if (bytes[0] === PKT_SNAPSHOT) {
          if (!init) return null;
          try {
            return decode(bytes) ? 'snapshot' : null;
          } catch (e) {
            return null; // a torn packet is simply a lost packet
          }
        }
        return null;
      },
    };
  }

  // ---------- Interpolation ----------
  // Draw about 100 ms in the past, between two snapshots we already have, so
  // motion stays smooth through jitter and the odd lost packet.
  function createInterpolator(opts = {}) {
    const delay = opts.delay != null ? opts.delay : 0.1;
    const buf = [];
    let offset = null; // localNow - serverT, smoothed
    let lastEventT = -Infinity;
    const lerpAngle = (a, b, k) => {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return a + d * k;
    };
    return {
      get size() {
        return buf.length;
      },
      get offset() {
        return offset;
      },
      push(state, nowS) {
        const off = nowS - state.t;
        offset = offset == null ? off : Math.min(off, offset + 0.002); // the fastest arrival is the truest clock
        if (buf.length && state.t <= buf[buf.length - 1].t) return;
        buf.push(state);
        while (buf.length > 12) buf.shift();
      },
      sample(nowS) {
        if (!buf.length) return null;
        const renderT = nowS - offset - delay;
        let a = buf[0];
        let b = buf[0];
        for (let i = buf.length - 1; i >= 0; i--) {
          if (buf[i].t <= renderT) {
            a = buf[i];
            b = buf[Math.min(i + 1, buf.length - 1)];
            break;
          }
          a = b = buf[i];
        }
        const k = b.t > a.t ? clamp((renderT - a.t) / (b.t - a.t), 0, 1) : 1;
        const out = Object.assign({}, b);
        const prev = new Map();
        for (const e of a.entities) prev.set(e.id, e);
        out.entities = b.entities.map((e) => {
          const p = prev.get(e.id);
          if (!p) return e;
          const c = Object.assign({}, e);
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (d < 12) {
            c.x = p.x + (e.x - p.x) * k;
            c.z = p.z + (e.z - p.z) * k;
            c.heading = lerpAngle(p.heading, e.heading, k);
          }
          return c;
        });
        // Events fire once, when the interpolated clock reaches them.
        const due = [];
        for (const s of buf) {
          if (s.t > lastEventT && s.t <= renderT) due.push(...s.events);
        }
        lastEventT = Math.max(lastEventT, renderT);
        out.events = due;
        out.renderT = renderT;
        return out;
      },
    };
  }

  // ---------- Prediction of your own astronaut ----------
  function createPredictor(o) {
    const tick = o.tick || 1 / 30;
    const history = [];
    let acc = 0;
    let vx = 0;
    let vz = 0;
    let offX = 0; // what the screen still shows of past corrections; fades to nothing
    let offZ = 0;
    let prevX = 0;
    let prevZ = 0;
    let initial = true;
    const p = {
      x: 0,
      z: 0,
      rx: 0, // the position to draw: between the last two ticks, so a follow camera stays smooth
      rz: 0,
      r: 0.6,
      speed: o.speed || 6,
      active: true,
      heading: 0,
      seed(x, z) {
        this.x = prevX = this.rx = x;
        this.z = prevZ = this.rz = z;
        vx = vz = offX = offZ = 0;
        history.length = 0;
        initial = false;
      },
      get seeded() {
        return !initial;
      },
      setSpeed(s) {
        this.speed = s;
      },
      setActive(on) {
        this.active = !!on;
      },
      tick(dt, input, nowS) {
        if (initial || !this.active) return;
        acc += Math.min(dt, 0.1);
        while (acc >= tick) {
          acc -= tick;
          const next = o.stepMove({ x: this.x, z: this.z, vx, vz, r: this.r, speed: this.speed }, input, tick, o.map);
          vx = next.vx;
          vz = next.vz;
          prevX = this.x;
          prevZ = this.z;
          this.x = next.x;
          this.z = next.z;
          if (Math.hypot(vx, vz) > 0.3) this.heading = Math.atan2(vz, vx);
          history.push({ t: nowS, x: next.x, z: next.z });
          if (history.length > 40) history.shift();
        }
        const fade = Math.exp(-dt * 11);
        offX *= fade;
        offZ *= fade;
        const blend = Math.min(1, acc / tick);
        this.rx = prevX + (this.x - prevX) * blend + offX;
        this.rz = prevZ + (this.z - prevZ) * blend + offZ;
      },
      // Compare the host's position with where we were about one round trip
      // ago, and pull the true position part of the way there. The screen
      // keeps showing the old spot and eases across, so a correction never pops.
      correct(serverX, serverZ, atNowS) {
        if (initial) {
          this.seed(serverX, serverZ);
          return;
        }
        if (!this.active) {
          this.x = prevX = this.rx = serverX;
          this.z = prevZ = this.rz = serverZ;
          vx = vz = offX = offZ = 0;
          history.length = 0;
          return;
        }
        const look = atNowS - (o.lag != null ? o.lag : 0.17);
        let best = null;
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].t <= look) {
            best = history[i];
            break;
          }
        }
        const dx = serverX - (best ? best.x : this.x);
        const dz = serverZ - (best ? best.z : this.z);
        if (dx * dx + dz * dz > 25) {
          this.seed(serverX, serverZ);
          return;
        }
        const k = 0.3;
        const cx = dx * k;
        const cz = dz * k;
        this.x += cx;
        this.z += cz;
        prevX += cx;
        prevZ += cz;
        offX -= cx;
        offZ -= cz;
        for (const h of history) {
          h.x += cx;
          h.z += cz;
        }
      },
    };
    return p;
  }

  const api = { createEncoder, createDecoder, createInterpolator, createPredictor, chunks, toBase64, fromBase64, MAX_BYTES, EVENT_FIELDS, WORDS };
  SMD.team.surfaceNet = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
