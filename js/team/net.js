// Mission Sprint: networking (docs/TEAM.md). SMD.team.net
//
//   net.createHost(opts)           a room others connect to.
//                                  opts.transport: 'relay' (LAN, tools/serve.mjs, the default)
//                                  or 'webrtc' (any network, no server of ours).
//                                  opts.mode: 'phones' (a shared screen, players on phones)
//                                  or 'devices' (the host is a player too; opts.name)
//   net.createLocal(opts)          the same interface with no network, for One screen / Solo
//   net.join(code, name, token, opts)   a player joining (opts.transport as above)
//   net.info()                     Promise: is the relay there, what can phones reach
//   net.joinUrl(code, base)        the address to put in the QR code
//   net.qr(text, cellPx)           Promise: an <svg> string for that address
//   net.resumable(transport?)      a room this browser was hosting before a refresh, or null
//   net.configure({base, iceServers, getIceServers})
//
// Every session has the same shape, so game code does not care which it has:
//   session.on(event, fn) -> unsubscribe
//     'status'   {status, code, text}   status: connecting | open | reconnecting |
//                                       waiting-host | closed | error
//     'view'     the player's view
//     'state'    host and local only: the whole authoritative state
//     'hud'      players only: small per-player status, about 5 a second
//     'snapshot' players only: Uint8Array surface snapshot (webrtc only)
//     'issue'    host only: {cid, code, text} one player's connection failed
//   session.send(action)      -> false when it could not be sent right now
//   session.sendInput(input, id?)   controller, at most 20 a second, latest wins.
//                                   input: {mx,my,ax,ay,buttons,weapon} or the array form
//   session.close()
//   session.status, .statusCode, .statusText, .view, .state, .code, .playerId, .token, .transport
// Host and local add:
//   session.inputs              live map of controller input by astronaut id
//   session.surfaceInputs()     room.surfaceInputs for this instant
//   session.sendHud(map)        {playerId: smallObject}; sent at most 5 times a second
//   session.sendSnapshot(bytes, playerIds?)   newest-wins; webrtc only, false elsewhere
//
// Inside the transport:
//   player -> host  {k:'hello',proto,name,token}   {k:'act',a}
//   host -> player  {k:'welcome',id}  {k:'view',v,view}  {k:'patch',v,set,del}
//                   {k:'hud',s}  {k:'reject',code,text}  {k:'bye',code}
// Views go as top-level patches so the big stable keys travel once.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};

  const PROTO = 1;
  const TICK_MS = 200;
  const HUD_MS = 200;
  const INPUT_MS = 50;
  const INPUT_IDLE_MS = 250; // an unchanged stick is repeated this often so the host knows it is alive
  const PING_MS = 8000;
  const PONG_DEAD_MS = 20000;
  const SNAPSHOT_MS = 1000;
  const RETRY_MIN_MS = 400;
  const RETRY_MAX_MS = 6000;
  const PEERJS_SRC = 'vendor/peerjs-1.5.4.min.js';
  const WEBRTC_SRC = 'js/team/net-webrtc.js';

  // Where a host keeps its checkpoint. In a LAN room a refresh is all that
  // needs surviving; a WebRTC host may close the tab and return within 2 minutes.
  const CHECKPOINT = {
    relay: { store: 'sessionStorage', key: 'ek.team.host', maxAgeMs: 15 * 60 * 1000 },
    webrtc: { store: 'localStorage', key: 'ek.team.host.rtc', maxAgeMs: 2 * 60 * 1000 },
  };

  // Close codes that retrying cannot fix. See tools/serve.mjs.
  const FINAL_CLOSES = {
    4400: 'bad-request',
    4401: 'bad-key',
    4403: 'bad-origin',
    4404: 'no-room',
    4408: 'expired',
    4409: 'room-full',
    4410: 'host-closed',
    4429: 'flooding',
    4503: 'server-full',
  };

  const TRY_ELSE = 'Join the same Wi-Fi as the host, try a different network, or play Same room or One screen.';
  const MESSAGES = {
    'no-room': 'No room with that code. Check the letters on the host’s screen, and make sure the host’s room is still open. If the host opened the game from their own computer (localhost), ask them to open it from the online link instead.',
    'room-full': 'This crew is full.',
    'room-taken': 'That room code is in use by someone else. Start a new room.',
    'server-full': 'Too many rooms open on this server. Try again in a minute.',
    'bad-key': 'This room belongs to another screen.',
    'bad-origin': 'Open the game from the address on the big screen.',
    expired: 'This room closed because nobody was using it.',
    'host-closed': 'The host ended the game.',
    'host-away': 'The host’s screen went away. Waiting up to 2 minutes for them to come back; if they don’t, this round ends and you can start a new room.',
    'host-timeout': 'The host did not come back in time, so this round is over.',
    flooding: 'Too many messages. Reload to rejoin.',
    kicked: 'You were removed from this room.',
    replaced: 'You opened this game somewhere else.',
    'no-relay': 'Phones need the game started with play-team.bat. Everyone can still play on one screen.',
    'broker-unreachable': 'The free service that connects players (0.peerjs.com) is not answering after several tries. Check your internet, try again in a minute, or play over the LAN with play-team.bat or on One screen.',
    'broker-custom-unreachable': 'Your own connecting server ({broker}) is not answering after several tries. Check it is running and reachable from here, or clear it under Advanced to use the free public one.',
    'broker-slow': 'The connecting service is slow today. Still trying…',
    'broker-lost': 'Lost touch with the connecting service. Players already here are fine; new players may have to wait.',
    'ice-failed': `Could not connect you directly to the host: your network or theirs blocks it. ${TRY_ELSE}`,
    'ice-timeout': `Connecting took too long (no direct path found in 15 seconds). ${TRY_ELSE}`,
    'host-gone': 'The host’s screen closed. If they come back within 2 minutes the game carries on.',
    'no-webrtc': 'This browser cannot do direct connections. Try a current Chrome, Edge, Firefox or Safari.',
    'old-version': 'Reload this page: the host is running a newer version.',
  };

  const storage = (kind) => {
    try {
      return globalThis[kind] || null;
    } catch (e) {
      return null;
    }
  };
  function readStore(kind, key) {
    try {
      return storage(kind)?.getItem(key) ?? null;
    } catch (e) {
      return null;
    }
  }
  function writeStore(kind, key, value) {
    try {
      if (value === null) storage(kind)?.removeItem(key);
      else storage(kind)?.setItem(key, value);
    } catch (e) {
      // Private mode or full storage: the game still works, it just cannot resume.
    }
  }

  let baseUrl = null;
  let iceServers = null;
  let iceServersProvider = null;

  // ---------- Which PeerJS broker (signalling only) ----------
  // PeerJS publishes exactly one free public server, 0.peerjs.com:443 path "/"
  // key "peerjs" (checked 2026-11-14 in the PeerJS docs and the peerjs-server
  // README: no mirror is listed, so none is invented here). A host that runs
  // their own PeerServer (npx peer --port 9000) can point every device at it:
  // net.configure({ broker: 'wss://my.server:9000/' }) or the Advanced box of
  // the connection check, which stores it in localStorage 'ek.team.broker'.
  // Every player must use the same broker: the room code lives there.
  const BROKER_KEY = 'ek.team.broker';
  const PUBLIC_BROKER = { host: '0.peerjs.com', port: 443, path: '/', secure: true, key: 'peerjs' };
  let brokerSetting = null;
  function parseBroker(input) {
    if (!input) return null;
    if (typeof input === 'object') {
      const host = String(input.host || '').trim();
      if (!host) return null;
      return { host, port: Number(input.port) || (input.secure === false ? 80 : 443), path: input.path ? String(input.path) : '/', secure: input.secure !== false, key: input.key ? String(input.key) : 'peerjs' };
    }
    let text = String(input).trim();
    if (!text) return null;
    if (!/^[a-z]+:\/\//i.test(text)) text = `wss://${text}`;
    let url;
    try {
      url = new URL(text);
    } catch (e) {
      return null;
    }
    if (!url.hostname) return null;
    const secure = !/^(ws|http):$/.test(url.protocol);
    const port = Number(url.port) || (secure ? 443 : 80);
    let path = url.pathname || '/';
    if (!path.endsWith('/')) path += '/';
    const key = url.searchParams.get('key') || 'peerjs';
    return { host: url.hostname, port, path, secure, key };
  }
  function brokerText(b) {
    if (!b) return '';
    return `${b.secure ? 'wss' : 'ws'}://${b.host}:${b.port}${b.path}${b.key !== 'peerjs' ? `?key=${encodeURIComponent(b.key)}` : ''}`;
  }
  function broker() {
    return brokerSetting || parseBroker(readStore('localStorage', BROKER_KEY)) || null;
  }
  // Persist a broker for this device; empty clears it (back to the public one).
  function setBroker(input) {
    const parsed = parseBroker(input);
    brokerSetting = parsed;
    writeStore('localStorage', BROKER_KEY, parsed ? brokerText(parsed) : null);
    return parsed;
  }
  function origin(opts) {
    if (opts && opts.base) return String(opts.base).replace(/\/$/, '');
    if (baseUrl) return baseUrl;
    return typeof location !== 'undefined' ? location.origin : '';
  }
  const wsUrl = (opts, query) => `${origin(opts).replace(/^http/, 'ws')}/ws?${query}`;

  function randomToken() {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function randomSeed() {
    const bytes = new Uint32Array(1);
    globalThis.crypto.getRandomValues(bytes);
    return bytes[0] >>> 0 || 1;
  }

  function emitter() {
    const handlers = {};
    return {
      on(name, fn) {
        (handlers[name] = handlers[name] || []).push(fn);
        return () => {
          handlers[name] = (handlers[name] || []).filter((f) => f !== fn);
        };
      },
      emit(name, payload) {
        (handlers[name] || []).slice().forEach((fn) => {
          try {
            fn(payload);
          } catch (e) {
            console.error(e);
          }
        });
      },
    };
  }

  // The text for a code; a custom broker gets named instead of the public one.
  function statusMessage(code) {
    if (code === 'broker-unreachable') {
      const b = broker();
      if (b) return MESSAGES['broker-custom-unreachable'].replace('{broker}', brokerText(b));
    }
    return MESSAGES[code] || code;
  }

  function baseSession(kind, transport) {
    const em = emitter();
    const session = { kind, transport, status: 'idle', statusCode: null, statusText: '', view: null, state: null, code: null, playerId: null, token: null, on: em.on };
    session._emit = em.emit;
    session._status = (status, code) => {
      if (session.status === status && session.statusCode === (code || null)) return;
      session.status = status;
      session.statusCode = code || null;
      session.statusText = code ? statusMessage(code) : '';
      em.emit('status', { status, code: code || null, text: session.statusText });
    };
    return session;
  }

  // ---------- Loading the WebRTC code only for those who use it ----------
  const transports = {};
  const scriptPromises = {};
  function loadScript(src) {
    if (typeof document === 'undefined') return Promise.reject(new Error('no document'));
    if (scriptPromises[src]) return scriptPromises[src];
    scriptPromises[src] = new Promise((done, fail) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => done();
      script.onerror = () => fail(new Error(`could not load ${src}`));
      document.head.appendChild(script);
    });
    return scriptPromises[src];
  }
  function webrtcTransport() {
    if (transports.webrtc) return Promise.resolve(transports.webrtc);
    if (typeof globalThis.RTCPeerConnection === 'undefined') return Promise.reject(new Error('no-webrtc'));
    return (globalThis.Peer ? Promise.resolve() : loadScript(PEERJS_SRC)).then(() => loadScript(WEBRTC_SRC)).then(() => transports.webrtc);
  }

  // ---------- A WebSocket that keeps trying ----------
  // Reconnects with backoff, notices a dead link through its own pings, and
  // retries at once when a phone wakes up or the network returns.
  function reliableSocket(makeUrl, { onMessage, onDown, onFinal }) {
    let ws = null;
    let stopped = false;
    let attempts = 0;
    let retryTimer = null;
    let pingTimer = null;
    let lastPong = 0;

    const clearTimers = () => {
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
    };

    function connect() {
      if (stopped) return;
      clearTimers();
      let socket;
      try {
        socket = new WebSocket(makeUrl());
      } catch (e) {
        return schedule();
      }
      ws = socket;
      socket.onopen = () => {
        attempts = 0;
        lastPong = Date.now();
        pingTimer = setInterval(checkLink, PING_MS);
      };
      socket.onmessage = (ev) => {
        lastPong = Date.now();
        let m;
        try {
          m = JSON.parse(ev.data);
        } catch (e) {
          return;
        }
        if (m.t !== 'pong') onMessage(m);
      };
      socket.onerror = () => {};
      socket.onclose = (ev) => {
        if (ws !== socket) return;
        ws = null;
        clearInterval(pingTimer);
        if (stopped) return;
        const finalCode = FINAL_CLOSES[ev.code];
        if (finalCode) {
          stopped = true;
          onFinal(finalCode, ev.code);
          return;
        }
        onDown();
        schedule();
      };
    }

    function checkLink() {
      if (!ws || ws.readyState !== 1) return;
      if (Date.now() - lastPong > PONG_DEAD_MS) {
        drop();
        return;
      }
      raw('{"t":"ping"}');
    }

    // Abandon a silent socket without waiting for the browser to give up on it.
    function drop() {
      const socket = ws;
      if (!socket) return;
      ws = null;
      socket.onclose = null;
      socket.onmessage = null;
      try {
        socket.close();
      } catch (e) {
        // Already closing.
      }
      clearInterval(pingTimer);
      if (stopped) return;
      onDown();
      schedule(0);
    }

    function schedule(delay) {
      if (stopped) return;
      clearTimeout(retryTimer);
      attempts++;
      const wait = delay !== undefined ? delay : Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** Math.min(attempts - 1, 5)) * (0.7 + Math.random() * 0.6);
      retryTimer = setTimeout(connect, wait);
    }

    function raw(text) {
      if (ws && ws.readyState === 1) {
        ws.send(text);
        return true;
      }
      return false;
    }

    function wake() {
      if (stopped) return;
      if (!ws) {
        attempts = 0;
        schedule(0);
      } else if (Date.now() - lastPong > PING_MS * 1.5) {
        drop();
      } else raw('{"t":"ping"}');
    }

    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') wake();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    if (typeof window !== 'undefined') window.addEventListener('online', wake);

    connect();

    return {
      raw,
      send: (obj) => raw(JSON.stringify(obj)),
      forceDrop: drop,
      stop() {
        stopped = true;
        clearTimers();
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
        if (typeof window !== 'undefined') window.removeEventListener('online', wake);
        if (ws) {
          const socket = ws;
          ws = null;
          socket.onclose = null;
          try {
            socket.close(1000);
          } catch (e) {
            // Already closing.
          }
        }
      },
    };
  }

  // ---------- Relay links ----------
  // A link is what differs between transports. Host links report
  // onReady/onPeerOpen/onPeerClose/onMessage/onInput/onDown/onFinal/onIssue;
  // client links report onHost/onMessage/onBytes/onDown/onFinal.
  function relayHostLink(opts, ev) {
    let code = opts.code || null;
    let key = opts.key || null;
    const query = () => (code && key ? `as=host&room=${code}&key=${key}` : 'as=host');
    const handlers = {
      onMessage(m) {
        if (m.t === 'welcome') {
          code = m.room;
          key = m.key;
          ev.onReady({ code, key });
        } else if (m.t === 'join') ev.onPeerOpen(m.cid);
        else if (m.t === 'left') ev.onPeerClose(m.cid);
        else if (m.t === 'i') ev.onInput(m.from, m.i);
        else if (m.t === 'msg') ev.onMessage(m.from, m.d);
      },
      onDown: () => ev.onDown(),
      onFinal(finalCode) {
        if (finalCode === 'no-room' && key) {
          // The server restarted and forgot the room: open a new one and keep
          // the game. Phones have to join again with the new code.
          code = null;
          key = null;
          ev.onDown();
          socket = reliableSocket(() => wsUrl(opts, query()), handlers);
        } else ev.onFinal(finalCode);
      },
    };
    let socket = reliableSocket(() => wsUrl(opts, query()), handlers);
    return {
      sendTo: (cid, obj) => socket.send({ to: cid, d: obj }),
      sendFast: (cid, obj) => socket.send({ to: cid, d: obj }),
      sendBytes: () => false,
      kick: (cid, closeCode) => socket.send({ t: 'kick', cid, code: closeCode || 4000 }),
      closeRoom: () => socket.send({ t: 'close' }),
      stop: () => socket.stop(),
    };
  }

  function relayClientLink(roomCode, opts, ev) {
    const socket = reliableSocket(() => wsUrl(opts, `room=${encodeURIComponent(roomCode)}`), {
      onMessage(m) {
        if (m.t === 'welcome') ev.onHost(!!m.host);
        else if (m.t === 'host') ev.onHost(!!m.up);
        else if (m.t === 'msg' && m.d) ev.onMessage(m.d);
      },
      onDown: () => ev.onDown(),
      onFinal: (code) => ev.onFinal(code),
    });
    return {
      send: (obj) => socket.send({ d: obj }),
      sendInput: (text) => socket.raw(text),
      forceDrop: () => socket.forceDrop(),
      stop: () => socket.stop(),
    };
  }

  // ---------- The engine both host and local sessions run ----------
  function engine(session, opts, hooks) {
    const room = SMD.team.room;
    let state = opts.restored || room.create({ ...opts, seed: Number.isFinite(opts.seed) ? opts.seed : randomSeed(), now: Date.now() });
    let timer = null;
    let lastSnapshot = 0;
    const selfId = () => state.hostPlayer || (state.mode === 'phones' ? null : 'local');
    session.state = state;
    session.inputs = state.inputs;

    function publish(force) {
      const changedState = session.state !== state;
      session.state = state;
      session.inputs = state.inputs;
      const view = room.viewFor(state, selfId(), Date.now());
      const before = session.view;
      session.view = view;
      if (force || changedState) session._emit('state', state);
      if (force || changedState || !before || !sameClock(before, view)) session._emit('view', view);
      hooks.afterChange();
      maybeSnapshot();
    }

    // What changes between state changes: the clock, crisis timers, flight progress.
    const liveBits = (v) => JSON.stringify([v.clock, v.crises, v.flight && v.flight.progress, v.flight && v.flight.frame]);
    const sameClock = (a, b) => liveBits(a) === liveBits(b);

    function maybeSnapshot() {
      if (!hooks.checkpoint) return;
      const now = Date.now();
      if (now - lastSnapshot < SNAPSHOT_MS) return;
      lastSnapshot = now;
      hooks.checkpoint(room.snapshot(state), now);
    }

    function dispatch(action, by) {
      state = room.reduce(state, { ...action, by }, Date.now());
      publish();
      return state.last;
    }

    function loop() {
      state = room.tick(state, Date.now());
      publish();
    }

    return {
      get state() {
        return state;
      },
      dispatch,
      publish,
      start() {
        timer = setInterval(loop, TICK_MS);
        publish(true);
      },
      stop() {
        clearInterval(timer);
      },
    };
  }

  // Compute a top-level patch between what a player has and what it should have.
  function diffView(previous, view) {
    const json = {};
    const set = {};
    let changed = false;
    for (const k of Object.keys(view)) {
      if (view[k] === undefined) continue;
      json[k] = JSON.stringify(view[k]);
      if (!previous || previous[k] !== json[k]) {
        set[k] = view[k];
        changed = true;
      }
    }
    const del = previous ? Object.keys(previous).filter((k) => !(k in json)) : [];
    return { json, set, del, changed: changed || del.length > 0 };
  }

  function readCheckpoint(transport) {
    const where = CHECKPOINT[transport];
    const text = where && readStore(where.store, where.key);
    if (!text) return null;
    try {
      const saved = JSON.parse(text);
      if (!saved || !saved.code || !saved.state) return null;
      if (Date.now() - saved.at > where.maxAgeMs) return null;
      return saved;
    } catch (e) {
      return null;
    }
  }

  // ---------- Host: the room lives here, the transport only forwards ----------
  function createHost(opts = {}) {
    if (opts.transport === 'local') return createLocal(opts);
    const transport = opts.transport === 'webrtc' ? 'webrtc' : 'relay';
    const room = SMD.team.room;
    const session = baseSession('host', transport);
    const peers = new Map(); // cid -> { playerId, seen, version, lastHud }
    const where = CHECKPOINT[transport];
    let saved = null;
    if (opts.fresh) writeStore(where.store, where.key, null);
    else saved = readCheckpoint(transport);
    if (saved) {
      session.code = saved.code;
      session.relayKey = saved.key || null;
    }
    let link = null;

    const core = engine(session, { mode: 'phones', ...opts, code: saved ? saved.code : null, restored: saved ? room.restore(saved.state, Date.now()) : null }, {
      checkpoint(snapshot, now) {
        if (session.code) writeStore(where.store, where.key, JSON.stringify({ at: now, code: session.code, key: session.relayKey, state: snapshot }));
      },
      afterChange: flushPeers,
    });
    session.surfaceInputs = () => room.surfaceInputs(core.state, Date.now());

    // A player's browser that hosts is also a seat at the table.
    if (core.state.mode === 'devices') {
      if (core.state.hostPlayer) session.playerId = core.state.hostPlayer;
      else {
        const hostToken = randomToken();
        core.dispatch({ type: 'join', name: opts.name || 'Host', token: hostToken, asHost: true }, 'host');
        session.playerId = core.state.last.playerId;
        session.token = hostToken;
      }
    }

    session._status('connecting');

    const events = {
      onReady({ code, key }) {
        session.code = code;
        session.relayKey = key || null;
        if (core.state.code !== code) core.state.code = code;
        session._status('open');
        core.publish(true);
      },
      onPeerOpen(cid) {
        peers.set(cid, newPeer());
      },
      onPeerClose: peerLeft,
      onMessage: onPeerMessage,
      onInput(cid, i) {
        const peer = peers.get(cid);
        if (peer && peer.playerId) room.applyInput(core.state, peer.playerId, i, Date.now());
      },
      onDown() {
        session._status('reconnecting');
        peers.clear();
      },
      onFinal(code) {
        session._status('closed', code);
      },
      onIssue(issue) {
        // Not a player's problem: the broker is slow to open our room. Say so and keep trying.
        if (issue.code === 'broker-slow') return session._status('connecting', 'broker-slow');
        session._emit('issue', { ...issue, text: MESSAGES[issue.code] || issue.code });
      },
    };

    const linkOptions = { ...opts, code: session.code, key: session.relayKey };
    if (transport === 'relay') link = relayHostLink(linkOptions, events);
    else
      webrtcTransport().then(
        (t) => {
          if (session.status !== 'closed') link = t.hostLink(linkOptions, events);
        },
        (e) => session._status('closed', e.message === 'no-webrtc' ? 'no-webrtc' : 'broker-unreachable')
      );

    function newPeer() {
      return { playerId: null, seen: null, version: 0, lastHud: null };
    }

    function peerLeft(cid) {
      const peer = peers.get(cid);
      peers.delete(cid);
      if (!peer || !peer.playerId) return;
      const stillHere = [...peers.values()].some((p) => p.playerId === peer.playerId);
      if (!stillHere) core.dispatch({ type: 'drop', playerId: peer.playerId }, 'host');
    }

    function onPeerMessage(cid, d) {
      if (!d || typeof d !== 'object') return;
      let peer = peers.get(cid);
      if (!peer) {
        peer = newPeer();
        peers.set(cid, peer);
      }
      if (d.k === 'hello') return hello(cid, peer, d);
      if (d.k === 'act' && peer.playerId && d.a && typeof d.a === 'object') {
        if (!room.PLAYER_ACTIONS.includes(d.a.type)) return;
        // The sender is whoever owns this connection, whatever the message claims.
        const { by, playerId, asHost, ...action } = d.a;
        core.dispatch(action, peer.playerId);
      }
    }

    function hello(cid, peer, d) {
      if (d.proto !== PROTO) {
        link.sendTo(cid, { k: 'reject', code: 'old-version', text: MESSAGES['old-version'] });
        return;
      }
      const token = typeof d.token === 'string' ? d.token.slice(0, 64) : '';
      const known = core.state.players.some((p) => p.token && p.token === token && p.id !== core.state.hostPlayer);
      const last = core.dispatch(known ? { type: 'reconnect', token } : { type: 'join', name: d.name, token }, 'host');
      if (!last.ok) {
        link.sendTo(cid, { k: 'reject', code: last.code, text: last.text });
        link.kick(cid, last.code === 'room-full' ? 4409 : 4400);
        return;
      }
      for (const [other, otherPeer] of peers) {
        if (other !== cid && otherPeer.playerId === last.playerId) {
          otherPeer.playerId = null;
          link.kick(other, 4000);
        }
      }
      peer.playerId = last.playerId;
      peer.seen = null;
      link.sendTo(cid, { k: 'welcome', id: last.playerId });
      flushPeers();
    }

    function flushPeers() {
      if (!link) return;
      const now = Date.now();
      for (const [cid, peer] of peers) {
        if (!peer.playerId) continue;
        const view = room.viewFor(core.state, peer.playerId, now);
        const d = diffView(peer.seen, view);
        if (!d.changed) continue;
        peer.version++;
        if (!peer.seen) link.sendTo(cid, { k: 'view', v: peer.version, view: d.set });
        else link.sendTo(cid, { k: 'patch', v: peer.version, set: d.set, del: d.del });
        peer.seen = d.json;
      }
    }

    // ---- HUD: small, per player, at most five a second, newest wins ----
    let hudTimer = null;
    let hudPending = {};
    function flushHud() {
      hudTimer = null;
      const pending = hudPending;
      hudPending = {};
      if (!link) return;
      for (const [cid, peer] of peers) {
        const hud = peer.playerId && pending[peer.playerId];
        if (!hud) continue;
        const text = JSON.stringify(hud);
        if (text === peer.lastHud) continue;
        peer.lastHud = text;
        link.sendFast(cid, { k: 'hud', s: hud });
      }
    }
    session.sendHud = (map) => {
      if (!map || typeof map !== 'object') return;
      Object.assign(hudPending, map);
      if (!hudTimer) hudTimer = setTimeout(flushHud, HUD_MS);
    };

    // Snapshots are for clients that render the surface; the host decides the pace.
    session.sendSnapshot = (bytes, playerIds) => {
      if (!link || !link.sendBytes) return false;
      const only = playerIds ? new Set([].concat(playerIds)) : null;
      let sent = false;
      for (const [cid, peer] of peers) {
        if (!peer.playerId || (only && !only.has(peer.playerId))) continue;
        if (link.sendBytes(cid, bytes)) sent = true;
      }
      return sent;
    };

    session.send = (action) => {
      if (!action || typeof action !== 'object') return false;
      core.dispatch(action, session.playerId || 'host');
      return true;
    };
    session.sendInput = (input) => {
      if (!session.playerId) return false; // a shared screen has no astronaut of its own
      room.applyInput(core.state, session.playerId, input, Date.now());
      return true;
    };

    // Tests: the page vanishes without saying goodbye.
    session._vanish = () => {
      core.stop();
      clearTimeout(hudTimer);
      if (link) link.stop();
    };

    session.close = () => {
      core.stop();
      clearTimeout(hudTimer);
      if (link) {
        link.closeRoom();
        link.stop();
      }
      writeStore(where.store, where.key, null);
      session._status('closed');
    };

    core.start();
    return session;
  }

  // ---------- Local: one device, no network, same interface ----------
  function createLocal(opts = {}) {
    const room = SMD.team.room;
    const session = baseSession('local', 'local');
    const mode = opts.mode === 'solo' ? 'solo' : 'one';
    const core = engine(session, { ...opts, mode }, { afterChange() {} });
    session.surfaceInputs = () => room.surfaceInputs(core.state, Date.now());
    session.playerId = 'local';
    session.send = (action) => {
      if (!action || typeof action !== 'object') return false;
      core.dispatch(action, 'local');
      return true;
    };
    // One device drives several astronauts: pass the roster id ('p1' to 'p4').
    session.sendInput = (input, id) => {
      room.applyInput(core.state, id || 'p1', input, Date.now());
      return true;
    };
    session.sendHud = () => {}; // everyone is looking at the one screen
    session.sendSnapshot = () => false;
    session.close = () => {
      core.stop();
      session._status('closed');
    };
    core.start();
    session._status('open');
    return session;
  }

  // ---------- Player ----------
  function normalizeCode(code) {
    return String(code || '').trim().toUpperCase();
  }

  function join(code, name, token, opts = {}) {
    const transport = opts.transport === 'webrtc' ? 'webrtc' : 'relay';
    const session = baseSession('player', transport);
    const roomCode = normalizeCode(code);
    const key = `ek.team.token.${roomCode}`;
    session.code = roomCode;
    session.token = token || readStore('localStorage', key) || randomToken();
    writeStore('localStorage', key, session.token);

    const view = {};
    let version = 0;
    let link = null;
    const sayHello = () => link && link.send({ k: 'hello', proto: PROTO, name, token: session.token });

    session._status('connecting');
    const events = {
      onHost(up) {
        if (up) {
          sayHello();
          session._status('open');
        } else session._status('waiting-host', 'host-away');
      },
      onDown() {
        session._status('reconnecting');
      },
      onFinal(codeName) {
        if (['no-room', 'expired', 'host-closed', 'room-full', 'host-timeout'].includes(codeName)) writeStore('localStorage', key, null);
        session._status('closed', codeName);
      },
      onBytes(bytes) {
        session._emit('snapshot', bytes);
      },
      onIssue(issue) {
        if (issue.code === 'broker-slow' && session.status === 'connecting') session._status('connecting', 'broker-slow');
      },
      onMessage: fromHost,
    };

    if (transport === 'relay') link = relayClientLink(roomCode, opts, events);
    else
      webrtcTransport().then(
        (t) => {
          if (session.status !== 'closed') link = t.clientLink(roomCode, opts, events);
        },
        (e) => session._status('closed', e.message === 'no-webrtc' ? 'no-webrtc' : 'broker-unreachable')
      );

    function fromHost(d) {
      if (!d) return;
      if (d.k === 'welcome') {
        session.playerId = d.id;
        return;
      }
      if (d.k === 'hud') return void session._emit('hud', d.s);
      if (d.k === 'bye') {
        link.stop();
        session._status('closed', d.code || 'host-closed');
        return;
      }
      if (d.k === 'reject') {
        session.lastReject = { code: d.code, text: d.text };
        if (d.code === 'room-full' || d.code === 'old-version') {
          link.stop();
          session._status('closed', d.code);
        }
        return;
      }
      if (d.k === 'view') {
        for (const k of Object.keys(view)) delete view[k];
        Object.assign(view, d.view);
        version = d.v;
      } else if (d.k === 'patch') {
        if (d.v !== version + 1) {
          // A gap means something went missing: ask for the whole view again.
          version = d.v;
          sayHello();
        } else version = d.v;
        Object.assign(view, d.set);
        for (const k of d.del || []) delete view[k];
      } else return;
      session.view = { ...view };
      session._emit('view', session.view);
    }

    session.send = (action) => {
      if (!action || typeof action !== 'object' || !link) return false;
      return link.send({ k: 'act', a: action });
    };

    // Controller input: newest wins, at most one frame every 50 ms, and a
    // repeat every 250 ms while nothing changes so the host knows we are alive.
    const round = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : 0);
    let lastInputText = '';
    let lastSent = 0;
    let pendingInput = null;
    let inputTimer = null;
    function encodeInput(input) {
      if (Array.isArray(input)) return `{"i":[${input.slice(0, 6).map(round).join(',')}]}`;
      const room = SMD.team.room;
      const b = room ? room.decodeInput(input).buttons : input.buttons | 0;
      const w = Number.isInteger(input.weapon) ? `,${input.weapon}` : '';
      return `{"i":[${round(input.mx)},${round(input.my)},${round(input.ax)},${round(input.ay)},${b}${w}]}`;
    }
    function sendPending() {
      inputTimer = null;
      if (!pendingInput || !link) return;
      lastInputText = pendingInput;
      pendingInput = null;
      lastSent = Date.now();
      link.sendInput(lastInputText);
    }
    session.sendInput = (input) => {
      const text = encodeInput(input);
      const now = Date.now();
      if (text === lastInputText && now - lastSent < INPUT_IDLE_MS) return true;
      pendingInput = text;
      const wait = INPUT_MS - (now - lastSent);
      if (wait <= 0) {
        clearTimeout(inputTimer);
        sendPending();
      } else if (!inputTimer) inputTimer = setTimeout(sendPending, wait);
      return true;
    };

    // Tests: the phone's connection dies without a goodbye.
    session._dropLink = () => link && link.forceDrop();

    session.leave = () => {
      session.send({ type: 'leave' });
      writeStore('localStorage', key, null);
    };
    session.close = () => {
      clearTimeout(inputTimer);
      if (link) link.stop();
      session._status('closed');
    };
    return session;
  }

  // ---------- Helpers for the lobby ----------
  function info(opts) {
    const url = `${origin(opts)}/api/info`;
    const timeout = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined;
    return fetch(url, { cache: 'no-store', signal: timeout })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data && data.relay ? data : { relay: false }))
      .catch(() => ({ relay: false }));
  }

  // Where a phone should go. If the page was opened on a LAN address, that one
  // already works; on localhost, use the LAN address the server reports.
  function joinUrl(code, base) {
    const c = encodeURIComponent(normalizeCode(code));
    let origins = base;
    if (!origins && typeof location !== 'undefined') origins = location.origin;
    return `${String(origins || '').replace(/\/$/, '')}/join.html?room=${c}`;
  }

  function loadQr() {
    if (globalThis.qrcode) return Promise.resolve(globalThis.qrcode);
    return loadScript('vendor/qrcode.js').then(() => globalThis.qrcode);
  }

  function qr(text, cellPx) {
    return loadQr().then((make) => {
      const code = make(0, 'M');
      code.addData(text);
      code.make();
      return code.createSvgTag(cellPx || 6, 8);
    });
  }

  function resumable(transport) {
    const saved = readCheckpoint(transport === 'webrtc' ? 'webrtc' : 'relay');
    return saved ? { code: saved.code, at: saved.at, phase: saved.state.phase } : null;
  }

  SMD.team.net = {
    PROTO,
    createHost,
    createLocal,
    join,
    info,
    joinUrl,
    qr,
    resumable,
    MESSAGES,
    PUBLIC_BROKER,
    configure(options) {
      const o = options || {};
      if ('base' in o) baseUrl = o.base ? String(o.base).replace(/\/$/, '') : null;
      if ('iceServers' in o) iceServers = o.iceServers || null;
      if ('getIceServers' in o) iceServersProvider = o.getIceServers || null;
      if ('broker' in o) brokerSetting = parseBroker(o.broker);
    },
    iceServers: () => iceServers,
    iceServersProvider: () => iceServersProvider,
    broker,
    setBroker,
    parseBroker,
    brokerText,
    registerTransport(name, t) {
      transports[name] = t;
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SMD.team.net;
})();
