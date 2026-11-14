// Story mode engine ("Last Light"): state, save and load, the expression
// language of `if` beats, and the beat runner. No DOM here: js/screen-story.js
// draws what the runner hands it. Spec: docs/STORY.md.
//
//   const st = SE.newState('ep1');            // or SE.load()
//   const run = SE.createRun(st);             // starts at st.episode / st.scene / st.beat
//   let ev; while ((ev = run.next())) { ... } // events: scene, narrate, say, choice, ...
//   run.choose('ask');                        // answers the pending choice
//   run.survivalDone('win', st);              // answers the pending survival segment
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.story = SMD.story || {};
  SMD.story.episodes = SMD.story.episodes || [];

  const KEY = 'ek-story';
  const SEEN_KEY = 'ek-story-seen';
  const FOUND_KEY = 'ek-story-found'; // flowchart nodes reached in any playthrough
  const PREFS_KEY = 'ek-story-prefs';
  const CREW = ['you', 'yusuf', 'lena', 'grace'];
  const GROUND = ['nadia', 'kwame', 'mariam', 'tarek', 'omar', 'aiko'];
  const PEOPLE = ['yusuf', 'lena', 'grace'].concat(GROUND); // everyone with a trust score
  const RES = ['o2', 'power', 'water', 'co2', 'food'];
  const DEFAULT_RES = { o2: 100, power: 100, water: 100, co2: 0, food: 100 };
  const SETS = ['pad', 'control', 'briefing', 'capsule', 'space', 'black'];
  const MOODS = ['calm', 'worried', 'angry', 'sad', 'happy', 'scared', 'determined'];
  const SEGMENTS = ['ep2.power', 'ep2.co2', 'ep3.storm', 'ep4.burn', 'ep4.entry'];
  const ANIMS = ['wave', 'celebrate', 'sad', 'cheer', 'look'];
  const SFX = ['alarm', 'bang', 'radio', 'silence'];
  // Named places in each 3D set (docs/STORY.md): explore spawns and items use these.
  const ANCHORS = {
    pad: ['start', 'tower', 'arm', 'valve', 'umbilical', 'console', 'kwame', 'nadia', 'door', 'van'],
    control: ['start', 'console', 'bigscreen', 'kwame', 'nadia', 'tarek', 'mariam', 'omar', 'aiko', 'coffee', 'window', 'door'],
    briefing: ['start', 'table', 'screen', 'model', 'kwame', 'nadia', 'tarek', 'aiko', 'door'],
    capsule: ['start', 'seat_you', 'seat_yusuf', 'seat_lena', 'seat_grace', 'window', 'panel_left', 'panel_center', 'panel_right', 'locker_1', 'locker_2', 'locker_3', 'locker_4', 'locker_5', 'locker_6', 'hatch', 'medkit', 'toilet', 'camera'],
    space: ['start'],
    black: ['start'],
  };

  // Who is who. Names are translatable (story.cast.<id>); 'you' is the player.
  // staff: the matching person in content/staff.js (look and portrait).
  const CAST = {
    you: { crew: true, name: '', role: 'Commander', color: '#d9a21b' },
    yusuf: { crew: true, name: 'Yusuf', full: 'Yusuf Adel', role: 'Pilot', color: '#e3662a', look: { suit: 'navy', skin: 's4', hair: 'short', hairColor: 'black', visor: 'gold', patch: 'agency', patchColor: '#b4302c' } },
    lena: { crew: true, name: 'Lena', full: 'Lena Hoffmann', role: 'Mission specialist', color: '#3fc1b4', look: { suit: 'teal', skin: 's1', hair: 'bun', hairColor: 'blond', visor: 'clear', patch: 'agency', patchColor: '#2a5aa8' } },
    grace: { crew: true, name: 'Grace', full: 'Grace Okafor', role: 'Flight engineer', color: '#b48ce0', look: { suit: 'lavender', skin: 's6', hair: 'curly', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#3d8b4e' } },
    nadia: { name: 'Nadia', full: 'Nadia Farouk', role: 'Flight director', staff: 'director', color: '#7fa8e8' },
    kwame: { name: 'Kwame', full: 'Kwame Mensah', role: 'Chief engineer', staff: 'engineer', color: '#f0a050' },
    mariam: { name: 'Mariam', full: 'Dr Mariam Saleh', role: 'Mission scientist', staff: 'scientist', color: '#5cc8a8' },
    tarek: { name: 'Tarek', full: 'Tarek Mansour', role: 'Budget officer', staff: 'budget', color: '#f06a5f' },
    omar: { name: 'Omar', full: 'Omar Idris', role: 'Student intern', staff: 'intern', color: '#f0c84a' },
    aiko: { name: 'Aiko', full: 'Aiko Tanaka', role: 'Public outreach', staff: 'outreach', color: '#f08cc0' },
  };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const warn = (...a) => {
    if (typeof console !== 'undefined') console.warn('[story]', ...a);
  };

  // ---------- Storage (SMD.store when the game is loaded, else memory) ----------
  const mem = {};
  const store = {
    get: (k) => (SMD.store ? SMD.store.get(k) : k in mem ? mem[k] : null),
    set: (k, v) => (SMD.store ? SMD.store.set(k, v) : (mem[k] = v)),
    remove: (k) => (SMD.store ? SMD.store.remove(k) : delete mem[k]),
  };

  // ---------- Episodes ----------
  function episodes() {
    const list = (SMD.story.episodes || []).filter((e) => isObj(e) && e.id && isObj(e.scenes));
    const seen = new Set();
    return list
      .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
      .sort((a, b) => (a.n || 0) - (b.n || 0));
  }
  const episode = (id) => episodes().find((e) => e.id === id) || null;
  function nextEpisodeId(id) {
    const list = episodes();
    const i = list.findIndex((e) => e.id === id);
    return i >= 0 && list[i + 1] ? list[i + 1].id : null;
  }
  const firstScene = (ep) => (ep.start && ep.scenes[ep.start] ? ep.start : Object.keys(ep.scenes)[0]);

  // ---------- State ----------
  function blankState() {
    const trust = {};
    PEOPLE.forEach((id) => (trust[id] = 0));
    return {
      v: 1,
      episode: null,
      scene: null,
      beat: 0,
      flags: {},
      trust,
      res: Object.assign({}, DEFAULT_RES),
      health: { you: 100, yusuf: 100, lena: 100, grace: 100 },
      choices: {},
      log: [],
      done: [],
      endings: {},
      survival: {},
      starts: {},
      hud: false,
      explored: {}, // exploreId -> [itemIds used]
      clues: {}, // 'exploreId/itemId' -> true
      trail: {}, // episodeId -> [{ scene, logN, snap }] the path through it, a checkpoint per scene
    };
  }

  // Fills in and repairs a state (old saves, hand-edited saves, test input).
  function normalize(s) {
    const b = blankState();
    if (!isObj(s)) return b;
    const out = Object.assign(b, s);
    out.flags = isObj(s.flags) ? s.flags : {};
    out.trust = Object.assign(b.trust, isObj(s.trust) ? s.trust : {});
    Object.keys(out.trust).forEach((k) => (out.trust[k] = clamp(Number(out.trust[k]) || 0, -3, 3)));
    out.res = Object.assign({}, DEFAULT_RES, isObj(s.res) ? s.res : {});
    RES.forEach((k) => (out.res[k] = clamp(Number(out.res[k]) || 0, 0, 100)));
    out.health = Object.assign({ you: 100, yusuf: 100, lena: 100, grace: 100 }, isObj(s.health) ? s.health : {});
    Object.keys(out.health).forEach((k) => (out.health[k] = clamp(Number(out.health[k]) || 0, 0, 100)));
    out.choices = isObj(s.choices) ? s.choices : {};
    out.log = Array.isArray(s.log) ? s.log.filter(isObj) : [];
    out.done = Array.isArray(s.done) ? s.done.filter((x) => typeof x === 'string') : [];
    out.endings = isObj(s.endings) ? s.endings : {};
    out.survival = isObj(s.survival) ? s.survival : {};
    out.starts = isObj(s.starts) ? s.starts : {};
    out.beat = Math.max(0, Math.floor(Number(s.beat) || 0));
    out.hud = !!s.hud;
    out.explored = isObj(s.explored) ? s.explored : {};
    Object.keys(out.explored).forEach((k) => !Array.isArray(out.explored[k]) && delete out.explored[k]);
    out.clues = isObj(s.clues) ? s.clues : {};
    out.trail = isObj(s.trail) ? s.trail : {};
    Object.keys(out.trail).forEach((k) => !Array.isArray(out.trail[k]) && delete out.trail[k]);
    // A save that points at a scene the script no longer has restarts that episode.
    const ep = out.episode && episode(out.episode);
    if (out.episode && ep && (!out.scene || !ep.scenes[out.scene])) {
      out.scene = firstScene(ep);
      out.beat = 0;
    }
    return out;
  }

  // A fresh story at the start of an episode (ep1 unless told otherwise).
  function newState(epId) {
    const list = episodes();
    const ep = (epId && episode(epId)) || list[0] || null;
    const s = blankState();
    const withRes = list.find((e) => isObj(e.resources));
    if (withRes) RES.forEach((k) => withRes.resources[k] !== undefined && (s.res[k] = clamp(Number(withRes.resources[k]) || 0, 0, 100)));
    if (ep) startEpisode(s, ep.id);
    return s;
  }

  // Moves a state to the start of an episode and keeps a snapshot there, so the
  // episode can be replayed later from exactly that point.
  function startEpisode(s, epId) {
    const ep = episode(epId);
    if (!ep) throw new Error('unknown episode ' + epId);
    s.episode = ep.id;
    s.scene = firstScene(ep);
    s.beat = 0;
    s.trail = s.trail || {};
    s.trail[ep.id] = [];
    const snap = clone(s);
    delete snap.starts;
    delete snap.trail;
    s.starts = s.starts || {};
    s.starts[ep.id] = snap;
    return s;
  }

  // Replays an episode from the state saved when it first began (choices made
  // in it and after it are dropped). Without a snapshot: a fresh start there.
  function replayEpisode(s, epId) {
    const ep = episode(epId);
    if (!ep) throw new Error('unknown episode ' + epId);
    const snap = s && s.starts && s.starts[epId];
    if (!snap) return newState(epId);
    const out = normalize(clone(snap));
    const n = ep.n || 0;
    out.starts = {};
    Object.keys(s.starts).forEach((k) => {
      const e = episode(k);
      if (e && (e.n || 0) <= n) out.starts[k] = clone(s.starts[k]);
    });
    out.trail = {};
    Object.keys(s.trail || {}).forEach((k) => {
      const e = episode(k);
      if (e && (e.n || 0) < n) out.trail[k] = clone(s.trail[k]);
    });
    out.trail[ep.id] = [];
    out.episode = ep.id;
    out.scene = firstScene(ep);
    out.beat = 0;
    return out;
  }

  // ---------- Save, load ----------
  function save(s) {
    try {
      store.set(KEY, JSON.stringify({ format: 'ek-story', v: 1, savedAt: Date.now(), state: s }));
      return true;
    } catch (e) {
      warn('save failed', e);
      return false;
    }
  }
  function load() {
    try {
      const raw = store.get(KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      const s = o && o.format === 'ek-story' ? o.state : o;
      if (!isObj(s)) return null;
      return normalize(s);
    } catch (e) {
      warn('could not read the story save', e);
      return null;
    }
  }
  const hasSave = () => !!load();
  const clear = () => store.remove(KEY);

  // Lines already read (any playthrough), for "skip lines I have seen".
  let seenSet = null;
  function seenAll() {
    if (seenSet) return seenSet;
    seenSet = new Set();
    try {
      const a = JSON.parse(store.get(SEEN_KEY) || '[]');
      if (Array.isArray(a)) a.forEach((x) => typeof x === 'string' && seenSet.add(x));
    } catch (e) {}
    return seenSet;
  }
  const isSeen = (id) => !!id && seenAll().has(id);
  let seenDirty = false;
  function markSeen(id) {
    if (!id || seenAll().has(id)) return;
    seenSet.add(id);
    seenDirty = true;
  }
  function flushSeen() {
    if (!seenDirty) return;
    seenDirty = false;
    try {
      store.set(SEEN_KEY, JSON.stringify([...seenAll()].slice(-6000)));
    } catch (e) {}
  }

  // Flowchart nodes found in any playthrough: 'scene:ep/id', 'opt:choice/opt', 'clue:explore/item'.
  let foundSet = null;
  let foundDirty = false;
  function foundAll() {
    if (foundSet) return foundSet;
    foundSet = new Set();
    try {
      const a = JSON.parse(store.get(FOUND_KEY) || '[]');
      if (Array.isArray(a)) a.forEach((x) => typeof x === 'string' && foundSet.add(x));
    } catch (e) {}
    return foundSet;
  }
  const isFound = (k) => foundAll().has(k);
  function markFound(k) {
    if (foundAll().has(k)) return;
    foundSet.add(k);
    foundDirty = true;
  }
  function flushFound() {
    if (!foundDirty) return;
    foundDirty = false;
    try {
      store.set(FOUND_KEY, JSON.stringify([...foundAll()]));
    } catch (e) {}
  }

  // Player preferences: text speed, auto-advance, skip seen lines, choice timers.
  const PREF_DEFAULTS = { speed: 'normal', auto: false, skipSeen: false, timers: 'normal' };
  function prefs() {
    try {
      const o = JSON.parse(store.get(PREFS_KEY) || '{}');
      return Object.assign({}, PREF_DEFAULTS, isObj(o) ? o : {});
    } catch (e) {
      return Object.assign({}, PREF_DEFAULTS);
    }
  }
  function setPrefs(p) {
    const n = Object.assign(prefs(), p || {});
    store.set(PREFS_KEY, JSON.stringify(n));
    return n;
  }

  // ---------- Text ----------
  function youName() {
    try {
      const a = SMD.avatar && SMD.avatar.get();
      if (a && a.name) return a.name;
    } catch (e) {}
    return typeof SMD.t === 'function' ? SMD.t('story.cast.you', 'Commander') : 'Commander';
  }
  // story.<key> in the current language, with {you} filled in.
  function text(key, english) {
    const en = english == null ? '' : String(english);
    const s = typeof SMD.t === 'function' ? SMD.t('story.' + key, en, { you: youName() }) : en;
    return String(s).replace(/\{you\}/g, youName());
  }
  function castName(id) {
    if (id === 'you') return youName();
    const c = CAST[id];
    if (!c) return id;
    return typeof SMD.t === 'function' ? SMD.t('story.cast.' + id, c.name) : c.name;
  }
  function castFull(id) {
    if (id === 'you') return youName();
    const c = CAST[id];
    if (!c) return id;
    return typeof SMD.t === 'function' ? SMD.t('story.cast.' + id + '.full', c.full) : c.full;
  }
  function castRole(id) {
    const c = CAST[id];
    if (!c) return '';
    return typeof SMD.t === 'function' ? SMD.t('story.cast.' + id + '.role', c.role) : c.role;
  }

  // ---------- Expressions for `if` ----------
  // flags.x, !flags.x, trust.nadia >= 2, res.o2 < 30, choice['ep1.pad.c1'] == 'push',
  // health.you > 50, done.includes is not supported: use flags. && || ! ( ) and
  // == != === !== < <= > >=, numbers, 'strings', true false null. Never eval.
  const exprCache = new Map();
  function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      const three = src.slice(i, i + 3);
      const two = src.slice(i, i + 2);
      if (three === '===' || three === '!==') {
        out.push({ op: three === '===' ? '==' : '!=' });
        i += 3;
      } else if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) {
        out.push({ op: two });
        i += 2;
      } else if ('<>!()[].'.includes(c)) {
        out.push({ op: c });
        i++;
      } else if (c === "'" || c === '"') {
        let j = i + 1;
        let s = '';
        while (j < src.length && src[j] !== c) {
          if (src[j] === '\\' && j + 1 < src.length) j++;
          s += src[j++];
        }
        if (j >= src.length) throw new Error('unclosed string in: ' + src);
        out.push({ str: s });
        i = j + 1;
      } else if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(src[i + 1] || '') && !(out.length && (out[out.length - 1].id || out[out.length - 1].num !== undefined)))) {
        const m = /^-?[0-9]+(\.[0-9]+)?/.exec(src.slice(i));
        out.push({ num: Number(m[0]) });
        i += m[0].length;
      } else if (/[A-Za-z_$]/.test(c)) {
        const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
        out.push({ id: m[0] });
        i += m[0].length;
      } else throw new Error(`unexpected "${c}" in: ${src}`);
    }
    return out;
  }
  function parse(src) {
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p];
    const isOp = (o) => toks[p] && toks[p].op === o;
    const expect = (o) => {
      if (!isOp(o)) throw new Error(`expected "${o}" in: ${src}`);
      p++;
    };
    function orE() {
      let n = andE();
      while (isOp('||')) {
        p++;
        n = { t: 'or', a: n, b: andE() };
      }
      return n;
    }
    function andE() {
      let n = notE();
      while (isOp('&&')) {
        p++;
        n = { t: 'and', a: n, b: notE() };
      }
      return n;
    }
    function notE() {
      if (isOp('!')) {
        p++;
        return { t: 'not', a: notE() };
      }
      return cmpE();
    }
    function cmpE() {
      const a = prim();
      const t = peek();
      if (t && ['==', '!=', '<', '<=', '>', '>='].includes(t.op)) {
        p++;
        return { t: 'cmp', op: t.op, a, b: prim() };
      }
      return a;
    }
    function prim() {
      const t = peek();
      if (!t) throw new Error('unexpected end of: ' + src);
      if (t.op === '(') {
        p++;
        const n = orE();
        expect(')');
        return n;
      }
      if (t.op === '!') return notE();
      p++;
      if (t.num !== undefined) return { t: 'lit', v: t.num };
      if (t.str !== undefined) return { t: 'lit', v: t.str };
      if (t.id === 'true' || t.id === 'false') return { t: 'lit', v: t.id === 'true' };
      if (t.id === 'null' || t.id === 'undefined') return { t: 'lit', v: null };
      if (!t.id) throw new Error(`unexpected "${t.op}" in: ${src}`);
      const path = [t.id];
      for (;;) {
        if (isOp('.')) {
          p++;
          const k = peek();
          if (!k || !k.id) throw new Error('expected a name after "." in: ' + src);
          p++;
          path.push(k.id);
        } else if (isOp('[')) {
          p++;
          const k = peek();
          if (!k || (k.str === undefined && k.num === undefined)) throw new Error('expected a quoted key in [] in: ' + src);
          p++;
          path.push(String(k.str !== undefined ? k.str : k.num));
          expect(']');
        } else break;
      }
      return { t: 'path', path };
    }
    const n = orE();
    if (p < toks.length) throw new Error('unexpected text after the expression: ' + src);
    return n;
  }
  function compile(src) {
    if (exprCache.has(src)) return exprCache.get(src);
    const ast = parse(String(src));
    exprCache.set(src, ast);
    return ast;
  }
  const ROOTS = { flags: 'flags', flag: 'flags', trust: 'trust', res: 'res', health: 'health', choice: 'choices', choices: 'choices', survival: 'survival', endings: 'endings' };
  function lookup(path, s) {
    const root = path[0];
    let v;
    if (root === 'episode' || root === 'scene') v = s[root];
    else if (root === 'done') v = s.done;
    else if (ROOTS[root]) v = s[ROOTS[root]];
    else return undefined;
    for (let i = 1; i < path.length; i++) {
      if (v == null) return undefined;
      if (root === 'done' && i === 1 && Array.isArray(v)) return v.includes(path[1]);
      v = Object.prototype.hasOwnProperty.call(v, path[i]) ? v[path[i]] : undefined;
    }
    // Missing numbers read as 0 so `trust.x >= 1` and `res.o2 < 30` just work.
    if (v === undefined && path.length > 1 && (root === 'trust' || root === 'res' || root === 'health')) return 0;
    return v;
  }
  function ev(n, s) {
    switch (n.t) {
      case 'lit':
        return n.v;
      case 'path':
        return lookup(n.path, s);
      case 'not':
        return !ev(n.a, s);
      case 'and':
        return !!ev(n.a, s) && !!ev(n.b, s);
      case 'or':
        return !!ev(n.a, s) || !!ev(n.b, s);
      case 'cmp': {
        const a = ev(n.a, s);
        const b = ev(n.b, s);
        switch (n.op) {
          case '==':
            return a === b || (a == null && b == null) || (typeof a !== typeof b && a != null && b != null && String(a) === String(b));
          case '!=':
            return !(a === b || (a == null && b == null) || (typeof a !== typeof b && a != null && b != null && String(a) === String(b)));
          case '<':
            return Number(a || 0) < Number(b || 0);
          case '<=':
            return Number(a || 0) <= Number(b || 0);
          case '>':
            return Number(a || 0) > Number(b || 0);
          case '>=':
            return Number(a || 0) >= Number(b || 0);
        }
      }
    }
    return undefined;
  }
  // true/false; a broken expression is false (and warned), never a crash.
  function evaluate(expr, s) {
    if (typeof expr === 'boolean') return expr;
    if (typeof expr === 'function') {
      try {
        return !!expr(s);
      } catch (e) {
        return false;
      }
    }
    if (expr == null || expr === '') return true;
    try {
      return !!ev(compile(expr), s);
    } catch (e) {
      warn('bad condition', String(expr), e.message);
      return false;
    }
  }
  function checkExpr(expr) {
    try {
      compile(expr);
      return null;
    } catch (e) {
      return e.message;
    }
  }

  // ---------- Effects ----------
  // Applies { set, trust, res } and returns what actually changed.
  function applyEffects(s, fx) {
    const out = { set: {}, trust: {}, res: {} };
    if (!fx) return out;
    if (isObj(fx.set))
      Object.keys(fx.set).forEach((k) => {
        s.flags[k] = fx.set[k];
        out.set[k] = fx.set[k];
      });
    if (isObj(fx.trust))
      Object.keys(fx.trust).forEach((k) => {
        const d = Number(fx.trust[k]) || 0;
        const was = Number(s.trust[k]) || 0;
        s.trust[k] = clamp(was + d, -3, 3);
        if (d) out.trust[k] = d;
      });
    if (isObj(fx.res))
      Object.keys(fx.res).forEach((k) => {
        const d = Number(fx.res[k]) || 0;
        const was = Number(s.res[k]) || 0;
        s.res[k] = clamp(was + d, 0, 100);
        if (d) out.res[k] = d;
        // The gauges appear once something is lost (or CO2 builds up) and stay.
        if (k === 'co2' ? d > 0 : d < 0) s.hud = true;
      });
    if (isObj(fx.health))
      Object.keys(fx.health).forEach((k) => {
        const d = Number(fx.health[k]) || 0;
        s.health[k] = clamp((Number(s.health[k]) || 0) + d, 0, 100);
      });
    return out;
  }
  const remembers = (o) => (o && o.remember ? (Array.isArray(o.remember) ? o.remember : [o.remember]).filter(Boolean) : []);
  const emptyFx = (c) => !Object.keys(c.set).length && !Object.keys(c.trust).length && !Object.keys(c.res).length;

  // ---------- The runner ----------
  // Presentational keys that may ride along on any beat.
  const EXTRA = ['camera', 'anim', 'sfx'];
  const PRIMARY = ['narrate', 'say', 'choice', 'explore', 'if', 'survival', 'fact', 'camera', 'anim', 'sfx', 'wait', 'goto', 'end', 'next'];

  // A checkpoint at each scene start: the flowchart can replay from any of them.
  function checkpoint(s, epId, sceneId) {
    const list = (s.trail[epId] = Array.isArray(s.trail[epId]) ? s.trail[epId] : []);
    const last = list[list.length - 1];
    if (last && last.scene === sceneId && last.logN === s.log.length) list.pop(); // a resume re-enters the same scene
    const snap = clone(s);
    delete snap.log;
    delete snap.starts;
    delete snap.trail;
    list.push({ scene: sceneId, logN: s.log.length, snap });
    markFound('scene:' + epId + '/' + sceneId);
  }
  // The state as it was when the player entered trail[index] of an episode.
  function replayFrom(s, epId, index) {
    const list = s.trail && s.trail[epId];
    const cp = list && list[index];
    if (!cp) throw new Error('no checkpoint ' + index + ' in ' + epId);
    const out = normalize(clone(cp.snap));
    out.log = clone(s.log.slice(0, cp.logN));
    out.starts = clone(s.starts || {});
    out.trail = clone(s.trail);
    out.trail[epId] = out.trail[epId].slice(0, index); // enter() adds this scene back
    Object.keys(out.trail).forEach((k) => {
      const e = episode(k);
      const me = episode(epId);
      if (e && me && (e.n || 0) > (me.n || 0)) delete out.trail[k];
    });
    out.episode = epId;
    out.scene = cp.scene;
    out.beat = 0;
    return out;
  }

  function createRun(state, opts = {}) {
    const s = state;
    let ep = episode(s.episode);
    if (!ep) throw new Error('unknown episode ' + s.episode);
    let stack = [];
    let pending = null; // { type: 'choice'|'survival', beat, ev }
    let finished = null;
    let enterNext = null; // scene to announce on the next call
    const limit = opts.limit || 20000;

    function enter(sceneId) {
      const sc = ep.scenes[sceneId];
      if (!sc) {
        warn(`goto: no scene "${sceneId}" in ${ep.id}; ending the episode`);
        return finish(null, null);
      }
      s.scene = sceneId;
      s.beat = 0;
      checkpoint(s, ep.id, sceneId);
      stack = [{ beats: Array.isArray(sc.beats) ? sc.beats : [], i: 0, top: true }];
      return { type: 'scene', id: sceneId, set: SETS.includes(sc.set) ? sc.set : 'black', cast: Array.isArray(sc.cast) ? sc.cast.filter((c) => CAST[c]) : [], title: sc.title || null, scene: sc, episode: ep.id };
    }
    function finish(ending, next) {
      if (!s.done.includes(ep.id)) s.done.push(ep.id);
      if (ending != null) s.endings[ep.id] = ending;
      const nx = next === false ? null : next || nextEpisodeId(ep.id);
      finished = { type: 'end', episode: ep.id, ending: ending == null ? null : ending, next: nx && episode(nx) ? nx : null };
      s.log.push({ kind: 'end', ep: ep.id, id: 'end', ending: finished.ending, text: '' });
      return finished;
    }

    // Resume: the saved scene, at the saved top-level beat.
    enterNext = s.scene;
    const startBeat = s.beat || 0;

    function extras(b, out) {
      EXTRA.forEach((k) => {
        if (b[k] !== undefined && out.type !== k) out[k] = b[k];
      });
      return out;
    }

    function next() {
      if (finished) return null;
      if (pending) return pending.ev; // still waiting on choose() or survivalDone()
      if (enterNext !== null) {
        const id = enterNext;
        enterNext = null;
        const sc = enter(id);
        if (sc.type === 'scene' && startBeat && stack[0]) {
          stack[0].i = Math.min(startBeat, stack[0].beats.length);
          s.beat = stack[0].i;
          sc.resumed = true;
        }
        return sc;
      }
      for (let guard = 0; guard < limit; guard++) {
        const f = stack[stack.length - 1];
        if (!f) {
          // The scene ran out without a goto or an end: fall through to the
          // next scene in the script, or end the episode after the last one.
          const ids = Object.keys(ep.scenes);
          const i = ids.indexOf(s.scene);
          if (i >= 0 && ids[i + 1]) {
            warn(`scene "${s.scene}" has no goto/end; going on to "${ids[i + 1]}"`);
            return enter(ids[i + 1]);
          }
          return finish(null, null);
        }
        if (f.i >= f.beats.length) {
          stack.pop();
          continue;
        }
        const b = f.beats[f.i++];
        if (f.top) s.beat = f.i;
        if (!isObj(b)) continue;
        // Effects on a beat of their own, or riding on another beat.
        let changes = null;
        if (!b.choice && (b.set || b.trust || b.res || b.health)) {
          changes = applyEffects(s, b);
          if (b.res) s.log.push({ kind: 'res', ep: ep.id, id: b.id || '', res: changes.res, text: '' });
        }
        const kind = PRIMARY.find((k) => b[k] !== undefined);
        if (!kind) {
          if (changes) return { type: 'effect', changes, beat: b };
          warn('beat with nothing to do', b);
          continue;
        }
        const base = (o) => {
          o.beat = b;
          if (changes && !emptyFx(changes)) o.changes = changes;
          return extras(b, o);
        };
        switch (kind) {
          case 'narrate':
            return base({ type: 'narrate', id: b.id || null, text: String(b.narrate) });
          case 'say':
            return base({ type: 'say', who: CAST[b.say] ? b.say : 'you', mood: MOODS.includes(b.mood) ? b.mood : b.mood || null, id: b.id || null, text: String(b.line == null ? '' : b.line) });
          case 'fact': {
            const fct = isObj(b.fact) ? b.fact : {};
            const id = fct.id || b.id || 'fact';
            if (!s.log.some((x) => x.kind === 'fact' && x.id === id && x.ep === ep.id)) s.log.push({ kind: 'fact', ep: ep.id, id, title: fct.title || '', text: fct.text || '', source: fct.source || '' });
            return base({ type: 'fact', id, fact: fct });
          }
          case 'camera':
            return base({ type: 'camera', value: String(b.camera) });
          case 'anim': {
            const [who, name] = String(b.anim).split(':');
            return base({ type: 'anim', who, name: name || 'wave', value: b.anim });
          }
          case 'sfx':
            return base({ type: 'sfx', value: String(b.sfx) });
          case 'wait':
            return base({ type: 'wait', seconds: Math.max(0, Number(b.wait) || 0) });
          case 'if': {
            const ok = evaluate(b.if, s);
            const branch = ok ? b.then : b.else;
            if (Array.isArray(branch) && branch.length) stack.push({ beats: branch, i: 0 });
            if (changes && !emptyFx(changes)) return { type: 'effect', changes, beat: b };
            continue;
          }
          case 'goto':
            return enter(String(b.goto));
          case 'end': {
            // A following { next } beat names the episode that comes after.
            const after = f.beats[f.i];
            const nx = isObj(after) && after.next ? String(after.next) : b.next ? String(b.next) : null;
            return finish(b.end, nx);
          }
          case 'next':
            return finish(null, String(b.next));
          case 'survival': {
            const e = base({ type: 'survival', id: String(b.survival), win: b.win || null, lose: b.lose || null });
            pending = { type: 'survival', beat: b, ev: e };
            return e;
          }
          case 'choice': {
            const c = isObj(b.choice) ? b.choice : {};
            // Hidden options (if) drop out; options that need a clue (requires)
            // stay, greyed with a lock and the hint of what was missed.
            const options = (Array.isArray(c.options) ? c.options : [])
              .filter((o) => isObj(o) && o.id && evaluate(o.if, s))
              .map((o) => (o.requires !== undefined && !evaluate(o.requires, s) ? Object.assign({}, o, { locked: true }) : o));
            if (!options.some((o) => !o.locked)) {
              warn('choice with no open options', c.id);
              continue;
            }
            const tOpt = options.find((o) => o.id === c.timeout && !o.locked);
            const e = base({ type: 'choice', id: c.id || 'choice', key: !!c.key, timer: Number(c.timer) > 0 ? Number(c.timer) : 0, timeout: tOpt ? tOpt.id : null, prompt: c.prompt || null, options });
            pending = { type: 'choice', beat: b, ev: e };
            return e;
          }
          case 'explore': {
            const x = isObj(b.explore) ? b.explore : {};
            const e = base({ type: 'explore', id: x.id || 'explore', objective: x.objective || '', spawn: x.spawn || 'start', hint: x.hint || '', def: x });
            pending = { type: 'explore', beat: b, ev: e };
            refreshExplore(e);
            return e;
          }
        }
      }
      throw new Error('story runner: too many beats without a stop (a loop in the script?)');
    }

    // The option taken when a timer runs out: the scripted timeout, else a
    // "[Say nothing]"-style option, else the last one.
    function timeoutOption(e) {
      if (e.timeout) return e.timeout;
      const open = e.options.filter((o) => !o.locked);
      const quiet = open.find((o) => /^\s*\[/.test(String(o.text || '')) || /^(quiet|silent|silence|nothing|none)$/.test(o.id));
      return (quiet || open[open.length - 1]).id;
    }

    function choose(optId, how) {
      if (!pending || pending.type !== 'choice') throw new Error('no choice is waiting');
      const e = pending.ev;
      const opt = e.options.find((o) => o.id === optId);
      if (!opt) throw new Error(`choice ${e.id} has no option "${optId}"`);
      if (opt.locked) throw new Error(`option "${optId}" of ${e.id} is locked`);
      pending = null;
      s.choices[e.id] = opt.id;
      markFound('opt:' + e.id + '/' + opt.id);
      const changes = applyEffects(s, opt);
      const rem = remembers(opt);
      s.log.push({
        kind: 'choice',
        ep: ep.id,
        scene: s.scene,
        id: e.id,
        opt: opt.id,
        text: String(opt.text || ''),
        options: e.options.map((o) => ({ id: o.id, text: String(o.text || '') })),
        fx: { set: changes.set, trust: changes.trust, res: changes.res },
        remember: rem,
        timedOut: how === 'timeout',
      });
      const after = (Array.isArray(opt.beats) ? opt.beats : []).slice();
      if (opt.goto) after.push({ goto: opt.goto });
      if (after.length) stack.push({ beats: after, i: 0 });
      return { option: opt, changes, remember: rem };
    }

    // ---------- Exploration ----------
    // Items: hidden until `requires` is true; `once` items go away after use;
    // the exit item stays locked until `exitWhen` is true.
    function refreshExplore(e) {
      const x = e.def;
      const used = s.explored[e.id] || [];
      const exitOpen = evaluate(x.exitWhen === undefined ? true : x.exitWhen, s);
      e.exitOpen = exitOpen;
      e.items = (Array.isArray(x.items) ? x.items : [])
        .filter((it) => isObj(it) && it.id && evaluate(it.if, s) && (it.requires === undefined || evaluate(it.requires, s)))
        .filter((it) => !(it.once && used.includes(it.id)))
        .map((it) => ({ id: it.id, at: it.at || it.id, label: it.label || '', exit: !!it.exit, clue: !!it.clue, used: used.includes(it.id), locked: !!it.exit && !exitOpen, def: it }));
      e.clues = (Array.isArray(x.items) ? x.items : []).filter((it) => isObj(it) && it.clue).map((it) => ({ id: it.id, found: !!s.clues[e.id + '/' + it.id] }));
      return e;
    }
    function exploreState() {
      if (!pending || pending.type !== 'explore') return null;
      return refreshExplore(pending.ev);
    }
    // Uses an item: its effects apply, its beats run, then exploring resumes
    // (or, for an open exit, the scene goes on).
    function interact(itemId) {
      if (!pending || pending.type !== 'explore') throw new Error('nothing to explore');
      const e = refreshExplore(pending.ev);
      const item = e.items.find((it) => it.id === itemId);
      if (!item) throw new Error(`no item "${itemId}" here`);
      if (item.locked) return { locked: true, item };
      const it = item.def;
      pending = null;
      const used = (s.explored[e.id] = s.explored[e.id] || []);
      const first = !used.includes(it.id);
      if (first) used.push(it.id);
      const changes = first ? applyEffects(s, it) : applyEffects(s, null);
      let clue = false;
      if (it.clue && !s.clues[e.id + '/' + it.id]) {
        s.clues[e.id + '/' + it.id] = true;
        clue = true;
        markFound('clue:' + e.id + '/' + it.id);
        s.log.push({ kind: 'clue', ep: ep.id, id: e.id + '/' + it.id, explore: e.id, item: it.id, label: String(it.label || ''), text: String(it.clueText || it.label || '') });
      }
      const after = (Array.isArray(it.beats) ? it.beats : []).slice();
      if (it.goto) after.push({ goto: it.goto });
      else if (!it.exit) after.push(pending_beat(e)); // back to exploring
      if (after.length) stack.push({ beats: after, i: 0 });
      return { item, changes, clue, exit: !!it.exit };
    }
    const pending_beat = (e) => e.beat;

    function survivalDone(result, newState) {
      if (!pending || pending.type !== 'survival') throw new Error('no survival segment is waiting');
      const e = pending.ev;
      pending = null;
      const win = result === 'win';
      // The segment may hand back a state object of its own: take its numbers.
      if (isObj(newState) && newState !== s) {
        ['res', 'health', 'flags'].forEach((k) => isObj(newState[k]) && Object.assign(s[k], newState[k]));
      }
      RES.forEach((k) => (s.res[k] = clamp(Number(s.res[k]) || 0, 0, 100)));
      s.hud = true;
      s.survival[e.id] = win ? 'win' : 'lose';
      s.log.push({ kind: 'survival', ep: ep.id, id: e.id, result: win ? 'win' : 'lose', text: '' });
      const target = win ? e.win : e.lose;
      if (target) enterNext = target;
    }

    return {
      state: s,
      get episode() {
        return ep;
      },
      exploreState,
      interact,
      get waiting() {
        return pending ? pending.type : null;
      },
      get finished() {
        return finished;
      },
      next,
      choose,
      timeoutOption,
      survivalDone,
    };
  }

  // ---------- Reading the script ----------
  // Every beat (with nesting) of an episode: fn(beat, sceneId, path).
  function walk(ep, fn) {
    const visit = (beats, sceneId, path) => {
      (Array.isArray(beats) ? beats : []).forEach((b, i) => {
        if (!isObj(b)) return;
        const p = path + '/' + i;
        fn(b, sceneId, p);
        if (Array.isArray(b.then)) visit(b.then, sceneId, p + '/then');
        if (Array.isArray(b.else)) visit(b.else, sceneId, p + '/else');
        if (isObj(b.choice) && Array.isArray(b.choice.options)) b.choice.options.forEach((o) => isObj(o) && visit(o.beats, sceneId, p + '/' + o.id));
        if (isObj(b.explore) && Array.isArray(b.explore.items)) b.explore.items.forEach((it) => isObj(it) && visit(it.beats, sceneId, p + '/' + it.id));
      });
    };
    Object.keys(ep.scenes || {}).forEach((id) => visit(ep.scenes[id] && ep.scenes[id].beats, id, id));
  }
  function findChoice(epId, choiceId) {
    const ep = episode(epId);
    let out = null;
    if (ep) walk(ep, (b) => !out && isObj(b.choice) && b.choice.id === choiceId && (out = b.choice));
    return out;
  }

  // Problems in the scripts: [{ level: 'error'|'warn', ep, where, msg }].
  function validate(list) {
    list = list || episodes();
    const out = [];
    const ids = new Map();
    const err = (ep, where, msg) => out.push({ level: 'error', ep: ep.id, where, msg });
    const wrn = (ep, where, msg) => out.push({ level: 'warn', ep: ep.id, where, msg });
    const own = (ep, where, id) => {
      if (!id) return wrn(ep, where, 'text without an id (it cannot be translated)');
      if (ids.has(id)) err(ep, where, `id "${id}" is used twice (also ${ids.get(id)})`);
      else ids.set(id, where);
    };
    list.forEach((ep) => {
      if (!isObj(ep.scenes) || !Object.keys(ep.scenes).length) return err(ep, ep.id, 'no scenes');
      if (!ep.start || !ep.scenes[ep.start]) err(ep, ep.id, `start scene "${ep.start}" does not exist`);
      const reach = new Set();
      Object.keys(ep.scenes).forEach((sid) => {
        const sc = ep.scenes[sid];
        if (!isObj(sc)) return err(ep, sid, 'scene is not an object');
        if (!SETS.includes(sc.set)) wrn(ep, sid, `set "${sc.set}" is not one of ${SETS.join(', ')}`);
        (sc.cast || []).forEach((c) => !CAST[c] && err(ep, sid, `cast "${c}" is unknown`));
        if (!Array.isArray(sc.beats)) err(ep, sid, 'beats is not a list');
      });
      const goes = (where, target) => {
        if (!target) return;
        reach.add(target);
        if (!ep.scenes[target]) err(ep, where, `goes to scene "${target}", which does not exist`);
      };
      walk(ep, (b, sid, p) => {
        const kind = PRIMARY.find((k) => b[k] !== undefined);
        if (!kind && !(b.set || b.trust || b.res || b.health)) wrn(ep, p, 'beat with nothing to do');
        if (b.narrate !== undefined) own(ep, p, b.id);
        if (b.say !== undefined) {
          own(ep, p, b.id);
          if (!CAST[b.say]) err(ep, p, `say: "${b.say}" is not in the cast list`);
          const sc = ep.scenes[sid];
          if (CAST[b.say] && sc && Array.isArray(sc.cast) && !sc.cast.includes(b.say) && !['nadia', 'kwame', 'mariam', 'tarek', 'omar', 'aiko'].includes(b.say) && sc.set !== 'black')
            wrn(ep, p, `"${b.say}" speaks but is not in the scene's cast`);
          if (b.mood && !MOODS.includes(b.mood)) wrn(ep, p, `mood "${b.mood}" is not one of ${MOODS.join(', ')}`);
        }
        if (b.if !== undefined) {
          const e = checkExpr(b.if);
          if (e) err(ep, p, 'bad condition: ' + e);
        }
        if (b.goto) goes(p, b.goto);
        if (b.survival !== undefined) {
          if (!SEGMENTS.includes(b.survival)) wrn(ep, p, `survival "${b.survival}" is not a known segment`);
          goes(p, b.win);
          goes(p, b.lose);
        }
        if (b.fact !== undefined) {
          if (!isObj(b.fact) || !b.fact.id) err(ep, p, 'fact without an id');
          else own(ep, p, b.fact.id);
        }
        if (b.anim !== undefined) {
          const [who, name] = String(b.anim).split(':');
          if (!CAST[who]) wrn(ep, p, `anim: "${who}" is not in the cast list`);
          if (!ANIMS.includes(name)) wrn(ep, p, `anim "${name}" is not one of ${ANIMS.join(', ')}`);
        }
        if (b.sfx !== undefined && !SFX.includes(b.sfx)) wrn(ep, p, `sfx "${b.sfx}" is not one of ${SFX.join(', ')}`);
        if (b.camera !== undefined && !/^(wide|window|close:\w+|two:\w+,\w+)$/.test(String(b.camera))) wrn(ep, p, `camera "${b.camera}" is not wide, window, close:id or two:a,b`);
        if (b.next !== undefined && !list.some((e) => e.id === b.next) && !episodes().some((e) => e.id === b.next)) wrn(ep, p, `next: no episode "${b.next}"`);
        if (isObj(b.choice)) {
          const c = b.choice;
          if (!c.id) err(ep, p, 'choice without an id');
          else own(ep, p, c.id);
          const opts = Array.isArray(c.options) ? c.options : [];
          if (opts.length < 2) wrn(ep, p, 'choice with fewer than two options');
          if (opts.length > 4) wrn(ep, p, 'choice with more than four options (keys 1-4)');
          const oids = new Set();
          opts.forEach((o) => {
            if (!o.id) err(ep, p, 'option without an id');
            else if (oids.has(o.id)) err(ep, p, `option id "${o.id}" twice`);
            oids.add(o.id);
            if (!o.text) wrn(ep, p, `option "${o.id}" has no text`);
            remembers(o).forEach((r) => !CAST[r] && err(ep, p, `remember: "${r}" is unknown`));
            if (isObj(o.trust)) Object.keys(o.trust).forEach((k) => !PEOPLE.includes(k) && wrn(ep, p, `trust: "${k}" has no trust score`));
            if (isObj(o.res)) Object.keys(o.res).forEach((k) => !RES.includes(k) && wrn(ep, p, `res: "${k}" is not a resource`));
            if (o.if !== undefined && checkExpr(o.if)) err(ep, p, 'bad option condition: ' + checkExpr(o.if));
            if (o.requires !== undefined && checkExpr(o.requires)) err(ep, p, 'bad option requires: ' + checkExpr(o.requires));
            if (o.requires !== undefined && !o.lockedHint) wrn(ep, p, `option "${o.id}" needs a clue but has no lockedHint`);
            goes(p, o.goto);
          });
          if (c.timer && c.timeout && !oids.has(c.timeout)) err(ep, p, `timeout "${c.timeout}" is not one of the options`);
        }
        if (b.explore !== undefined) {
          const x = b.explore;
          const sc = ep.scenes[sid];
          const names = (sc && ANCHORS[sc.set]) || [];
          if (!isObj(x) || !x.id) err(ep, p, 'explore without an id');
          else {
            own(ep, p, x.id);
            if (x.spawn && !names.includes(x.spawn)) err(ep, p, `explore spawn "${x.spawn}" is not an anchor of the ${sc && sc.set} set`);
            if (x.exitWhen !== undefined && checkExpr(x.exitWhen)) err(ep, p, 'bad exitWhen: ' + checkExpr(x.exitWhen));
            const items = Array.isArray(x.items) ? x.items : [];
            if (!items.some((it) => it && it.exit)) err(ep, p, 'explore without an exit item (the player could never leave)');
            const iids = new Set();
            items.forEach((it) => {
              if (!isObj(it) || !it.id) return err(ep, p, 'explore item without an id');
              if (iids.has(it.id)) err(ep, p, `explore item "${it.id}" twice`);
              iids.add(it.id);
              const at = it.at || it.id;
              if (!names.includes(at)) err(ep, p, `item "${it.id}" is at "${at}", which is not an anchor of the ${sc && sc.set} set (${names.join(', ')})`);
              if (!it.label) wrn(ep, p, `item "${it.id}" has no label`);
              if (it.requires !== undefined && checkExpr(it.requires)) err(ep, p, 'bad item requires: ' + checkExpr(it.requires));
              goes(p, it.goto);
            });
          }
        }
        if (isObj(b.trust)) Object.keys(b.trust).forEach((k) => !PEOPLE.includes(k) && wrn(ep, p, `trust: "${k}" has no trust score`));
        if (isObj(b.res)) Object.keys(b.res).forEach((k) => !RES.includes(k) && wrn(ep, p, `res: "${k}" is not a resource`));
      });
      Object.keys(ep.scenes).forEach((sid) => sid !== ep.start && !reach.has(sid) && wrn(ep, sid, 'no beat goes to this scene'));
    });
    return out;
  }

  // ---------- Flowchart (Detroit style) ----------
  // Scenes as nodes laid out by depth from the start, edges to every scene a
  // scene can lead to, key choices as diamonds with the option taken, clues
  // found or missed, and how much of the chapter has ever been found.
  function sceneTitle(ep, id) {
    const sc = ep.scenes[id] || {};
    const en = sc.title || id.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
    return typeof SMD.t === 'function' ? SMD.t('story.' + ep.id + '.' + id + '.title', en) : en;
  }
  function flowchart(s, epId) {
    const ep = episode(epId);
    if (!ep) return null;
    const ids = Object.keys(ep.scenes);
    const edges = {};
    const choices = {};
    const clues = {};
    ids.forEach((id) => {
      edges[id] = new Set();
      choices[id] = [];
      clues[id] = [];
    });
    let anyKey = false;
    walk(ep, (b, sid) => {
      const add = (t) => t && ep.scenes[t] && t !== sid && edges[sid].add(t);
      if (b.goto) add(b.goto);
      if (b.survival !== undefined) {
        add(b.win);
        add(b.lose);
      }
      if (isObj(b.choice)) {
        const c = b.choice;
        (c.options || []).forEach((o) => isObj(o) && add(o.goto));
        if (c.key) anyKey = true;
        choices[sid].push(c);
      }
      if (isObj(b.explore)) {
        (b.explore.items || []).forEach((it) => {
          if (!isObj(it)) return;
          add(it.goto);
          if (it.clue) clues[sid].push({ explore: b.explore.id, item: it });
        });
      }
    });
    // A scene without an exit falls through to the next one in the script.
    ids.forEach((id, i) => {
      let term = false;
      (ep.scenes[id].beats || []).forEach((b) => isObj(b) && (b.goto || b.end !== undefined || b.next !== undefined || b.survival !== undefined) && (term = true));
      if (!term && !edges[id].size && ids[i + 1]) edges[id].add(ids[i + 1]);
    });
    const depth = {};
    const start = firstScene(ep);
    const queue = [start];
    depth[start] = 0;
    while (queue.length) {
      const id = queue.shift();
      edges[id].forEach((t) => {
        if (depth[t] === undefined) {
          depth[t] = depth[id] + 1;
          queue.push(t);
        }
      });
    }
    let maxD = 0;
    ids.forEach((id) => (maxD = Math.max(maxD, depth[id] || 0)));
    ids.forEach((id) => depth[id] === undefined && (depth[id] = maxD + 1));
    const trail = (s && s.trail && s.trail[epId]) || [];
    const onPath = trail.map((x) => x.scene);
    let total = 0;
    let found = 0;
    const count = (ok) => {
      total++;
      if (ok) found++;
    };
    const nodes = ids.map((id) => {
      const reached = onPath.includes(id);
      const ever = reached || isFound('scene:' + epId + '/' + id);
      count(ever);
      const keyChoices = choices[id]
        .filter((c) => (anyKey ? c.key : c.timer || (c.options || []).some((o) => o && o.goto)))
        .map((c) => ({
          id: c.id,
          taken: reached ? s.choices[c.id] || null : null,
          options: (c.options || []).filter(isObj).map((o) => {
            const ev = isFound('opt:' + c.id + '/' + o.id) || (reached && s.choices[c.id] === o.id);
            count(ev);
            return { id: o.id, text: String(o.text || ''), taken: reached && s.choices[c.id] === o.id, found: ev, requires: o.requires || null, lockedHint: o.lockedHint || '' };
          }),
        }));
      const cl = clues[id].map((x) => {
        const k = x.explore + '/' + x.item.id;
        const ev = !!(s && s.clues && s.clues[k]) || isFound('clue:' + k);
        count(ev);
        return { id: k, explore: x.explore, item: x.item.id, label: String(x.item.label || ''), found: !!(s && s.clues && s.clues[k]), ever: ev };
      });
      return { id, title: sceneTitle(ep, id), depth: depth[id], reached, ever, step: onPath.indexOf(id), edges: [...edges[id]], choices: keyChoices, clues: cl };
    });
    return { episode: ep, nodes, path: onPath, completion: total ? found / total : 0, found, total };
  }

  // ---------- Recap: what the player chose in an episode and what it did ----------
  function recap(s, epId) {
    const ep = episode(epId);
    const log = s.log.filter((x) => x.ep === epId);
    const choices = log.filter((x) => x.kind === 'choice');
    const facts = log.filter((x) => x.kind === 'fact');
    const survival = log.filter((x) => x.kind === 'survival');
    const endEntry = log.filter((x) => x.kind === 'end').pop();
    const ending = endEntry ? endEntry.ending : s.endings[epId] || null;
    let endingDef = null;
    if (ep && ending && isObj(ep.endings) && ep.endings[ending]) {
      const d = ep.endings[ending];
      endingDef = typeof d === 'string' ? { text: d } : d;
    }
    return { episode: ep, choices, facts, survival, ending, endingDef, res: Object.assign({}, s.res), trust: Object.assign({}, s.trust), health: Object.assign({}, s.health) };
  }

  const api = {
    KEY,
    CREW,
    GROUND,
    PEOPLE,
    RES,
    SETS,
    MOODS,
    SEGMENTS,
    CAST,
    episodes,
    episode,
    nextEpisodeId,
    firstScene,
    blankState,
    normalize,
    newState,
    startEpisode,
    replayEpisode,
    save,
    load,
    hasSave,
    clear,
    isSeen,
    markSeen,
    flushSeen,
    prefs,
    setPrefs,
    text,
    youName,
    castName,
    castFull,
    castRole,
    evaluate,
    checkExpr,
    applyEffects,
    createRun,
    walk,
    findChoice,
    validate,
    recap,
    flowchart,
    sceneTitle,
    ANCHORS,
    _store: store,
    replayFrom,
    isFound,
    markFound,
    flushFound,
    _resetSeen() {
      seenSet = null;
      foundSet = null;
    },
  };
  SMD.storyEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
