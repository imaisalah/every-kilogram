// The surface mission: landing, surface and ascent views (docs/TEAM-SURFACE.md).
// One session survives all three room phases, so the 3D scene never reloads
// between them. Host mode runs the sim; client mode draws decoded snapshots
// with interpolation and predicts your own astronaut. Both feed the same
// renderer (js/team/surface3d.js) and the same calm HUD, from the published
// state shape only.
//
// Calm interface (docs/TEAM-V2.md): one objective line with a distance, one
// oxygen/battery pill, the objectives tracker, a small radar in eye-level view,
// short soft notes, and one real alarm (radiation or the call home).
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};
  const team = SMD.team;
  const views = (team.views = team.views || {});

  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : String(e).replace(/\{(\w+)\}/g, (m, x) => (p && p[x] !== undefined ? p[x] : m)));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const ltr = (s) => (SMD.dir && SMD.dir() === 'rtl' ? `⁦${s}⁩` : String(s));
  const fmtClock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
  const reducedMotion = () => {
    try {
      return !!(SMD.settings && SMD.settings.reducedMotion);
    } catch (e) {
      return false;
    }
  };

  const ROLE_COLOR = { planner: '#24d8ff', engineer: '#46f58a', scientist: '#ff4fb2', comms: '#ff9a1f' };
  const ROLE_ORDER = ['planner', 'engineer', 'scientist', 'comms'];
  const LANDING_S = 9;
  const LAUNCH_S = 7.5;
  const SNAPSHOT_MS = 80;
  const SLOW_EVERY = 5;
  const INPUT_MS = 50;
  const TICK = 1 / 30;
  const CHECKPOINT_MS = 2500;
  const CHECKPOINT_TTL_MS = 10 * 60 * 1000;

  const ICON = {
    o2: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 2 4 14h6l-1 8 10-12h-6z"/></svg>',
    suit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 1 5 5v1h1a2 2 0 0 1 2 2v6h-3v6H7v-6H4v-6a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm0 3a2.5 2.5 0 0 0-2.5 2.5V8h5v-.5A2.5 2.5 0 0 0 12 5z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 20 20 12 15.5 4 20z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15 3a9 9 0 1 0 6 15.7A8 8 0 0 1 15 3z"/></svg>',
  };

  // ---------- Sessions survive the phase changes ----------
  let SESSION = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function ensureNet() {
    if (team.surfaceNet) return Promise.resolve();
    return loadScript(new URL('js/team/surface-net.js', document.baseURI).href);
  }

  function isClient(ctx) {
    if (ctx.device === 'client' || ctx.device === 'own') return true;
    return !!(ctx.session && ctx.session.kind === 'player' && ctx.device !== 'phone');
  }

  function roomOf(ctx) {
    return ctx.state || ctx.view || {};
  }

  // ---------- The crew picked in setup (docs/TEAM-V3.md item 6) ----------
  // Each astronaut on the surface is a character from js/team/crew.js: a person's own pick
  // (a roster member or a custom astronaut), and for the bots the members of the jobs left.
  const JOBS = ['planner', 'engineer', 'scientist', 'comms'];
  function memberOf(crewId, playerName) {
    const C = team.crew;
    if (!C || !crewId) return null;
    try {
      const custom = C.isCustom && C.isCustom(crewId);
      return C.byId(crewId, custom && playerName ? { name: playerName } : undefined) || null;
    } catch (e) {
      return null;
    }
  }
  function shortName(m) {
    if (!m) return '';
    try {
      const s = team.crew && team.crew.text ? team.crew.text(m, 'short') : '';
      if (s) return s;
    } catch (e) {}
    return String(m.short || m.name || '').split(' ')[0];
  }
  const jobName = (job) => (team.crew && team.crew.jobName ? team.crew.jobName(job) : team.kit && team.kit.roleName ? team.kit.roleName(job) : job);
  // roster: the room's [{ id, role, name, bot, controller }]. Returns a copy where each seat
  // has its character's job (role), crewId, short name and the person's name.
  function crewRoster(ctx, roster) {
    const C = team.crew;
    const v = (ctx && (ctx.view || ctx.state)) || {};
    const r = (ctx && ctx.state) || v;
    const picks = Object.assign({}, r.crewPick || {}, v.crewPick || {});
    const players = Array.isArray(v.players) ? v.players : [];
    const mode = r.mode || v.mode;
    const local = mode === 'solo' || mode === 'one';
    const out = (roster || []).map((p) => Object.assign({}, p));
    const taken = new Set();
    let firstPerson = true;
    for (const p of out) {
      const person = p.controller ? p.controller !== 'bot' : !p.bot;
      if (!person) continue;
      const pl = players.find((x) => x && x.id === p.id) || null;
      let cid = picks[p.id] || (pl && (pl.crewId || pl.crew || pl.character)) || null;
      if (!cid && local && firstPerson) {
        const me = players.find((x) => x && !x.bot) || null;
        cid = picks.local || (me && (me.crewId || me.crew)) || r.crewId || null;
        if (!cid) {
          try {
            const saved = team.kit && team.kit.prefs && team.kit.prefs.get ? team.kit.prefs.get('crew', '') : '';
            if (saved) cid = saved;
          } catch (e) {}
        }
      }
      firstPerson = false;
      const playerName = local ? '' : (pl && pl.name) || (p.name && !/^P\d$/.test(p.name) ? p.name : '');
      const m = memberOf(cid, playerName);
      if (m && JOBS.includes(m.job) && !taken.has(m.job)) {
        p.role = m.job;
        p.crewId = m.id;
        p.member = m;
        taken.add(m.job);
      }
      p.playerName = playerName;
    }
    // Everyone else takes the jobs that are left (their own when it is free), as that job's character.
    const free = JOBS.filter((j) => !taken.has(j));
    for (const p of out) {
      if (p.member) continue;
      const job = free.includes(p.role) ? p.role : free[0] || p.role;
      if (free.includes(job)) free.splice(free.indexOf(job), 1);
      p.role = job;
      const m = C && C.byJob ? C.byJob(job) : null;
      if (m) {
        p.member = m;
        p.crewId = m.id;
      }
    }
    for (const p of out) if (p.member) p.name = shortName(p.member);
    return out;
  }
  // The 3D look of an astronaut: the character's appearance, when there is one.
  function lookOf(e) {
    const m = memberOf(e && e.crewId, e && e.playerName);
    return m && m.appearance ? m.appearance : null;
  }

  // ---------- Why we're here (docs/TEAM-V3.md item 11) ----------
  // The science need, the mission goal and what success looks like down here, from the
  // scenario's traceability (item 3) and the success criterion picked before the build.
  function hasKey(key) {
    if (!(SMD.dir && SMD.dir() === 'rtl')) return true;
    const d = SMD.i18nDicts && SMD.i18nDicts.ar;
    return !!(d && d[key]);
  }
  function missionWhy(ctx, objectiveKind) {
    const r = roomOf(ctx);
    const v = ctx.view || r;
    const sim = ctx.sim;
    let sc = null;
    try {
      sc = (sim && sim.scenarios ? sim.scenarios() : []).find((x) => x.id === (r.scenarioId || v.scenarioId)) || null;
    } catch (e) {}
    const design = r.design || v.design || null;
    let trace = null;
    try {
      if (sim && typeof sim.traceability === 'function' && design) trace = sim.traceability(design);
    } catch (e) {}
    const id = sc && sc.id;
    const pick = (key, en) => (en && hasKey(key) ? t(key, en) : '');
    const need = (trace && typeof trace.need === 'string' && trace.need) || (sc && (pick(`scn.${id}.need`, sc.need) || pick(`scn.${id}.question`, sc.question))) || '';
    const goal = (trace && typeof trace.goal === 'string' && trace.goal) || (sc && pick(`scn.${id}.objective`, sc.objective)) || '';
    const reqId = (design && design.requirement) || r.requirement || v.requirement || null;
    const req = sc && Array.isArray(sc.requirements) ? sc.requirements.find((q) => q.id === reqId) || null : null;
    const reqText = req ? `${t(`scn.${id}.req.${req.id}.title`, req.title)}: ${t(`scn.${id}.req.${req.id}.text`, req.text)}` : '';
    const kind = objectiveKind ? t('team.surface.kind.' + objectiveKind, objectiveKind) : '';
    const pct = Math.round(((team.surface && team.surface.TUNE && team.surface.TUNE.winScienceFrac) || 0.25) * 100);
    let surface = t('team.surface.why.surface', 'Down here: scan the {kind} sites, send their data home when the orbiter passes overhead, and lift off together with at least {pct}% of the science.', { kind, pct: ltr(pct) });
    // The signature missions ask something of their own (docs/TEAM-V3.md item 19).
    let world = null;
    try {
      world = (sc && sc.surface && sc.surface.world) || null;
    } catch (e) {}
    if (world === 'moon') surface += ' ' + t('team.surface.why.moon', 'The ice hides in a crater that never sees the Sun: the coldest place on the map. Plan air and suit power to reach it, and a battery for the long night.');
    if (world === 'mars') surface += ' ' + t('team.surface.why.mars', 'Drill an ice core and lift it home: the layers record the climate. Dust storms coat the solar panels.');
    return { title: sc ? t(`scn.${id}.title`, sc.title || '') : '', need, goal, reqText, surface };
  }
  // What each job does down here: one plain line.
  const JOB_LINE = {
    scientist: () => t('team.surface.job.scientist', 'You scan the science sites and choose which samples fly home.'),
    comms: () => t('team.surface.job.comms', 'You plant and aim the dish and send the data home each time the orbiter passes overhead.'),
    engineer: () => t('team.surface.job.engineer', 'You keep the lander running: fix its faults and patch worn suits.'),
    planner: () => t('team.surface.job.planner', 'You plan the route, watch the clock, call everyone home and plan the ascent.'),
  };

  function mount(el, ctx, phase) {
    const room = roomOf(ctx);
    const key = String(room.code || 'local') + ':' + String(room.round || 0) + ':' + String((room.surface && room.surface.seed) || room.seed || 0);
    if (SESSION && SESSION.key !== key) {
      SESSION.destroy();
      SESSION = null;
    }
    if (!SESSION) SESSION = createSession(ctx, key);
    SESSION.attach(el, ctx, phase);
    return () => {
      const s = SESSION;
      if (!s) return;
      s.detached();
    };
  }

  views.landing = { mount: (el, ctx) => mount(el, ctx, 'landing') };
  views.surface = { mount: (el, ctx) => mount(el, ctx, 'surface') };
  views.ascent = { mount: (el, ctx) => mount(el, ctx, 'ascent') };

  // The mission tracker reads this: the share of the surface objectives done (0..1)
  // and the list itself. The flow engineer's tracker may also expose setSurface().
  team.surfaceProgress = () => {
    const s = SESSION && SESSION.state;
    if (!s) return null;
    return { progress: s.progress || 0, objectives: (s.objectives || []).map((o) => ({ id: o.id, text: o.text, frac: o.frac, done: o.done })), stage: s.stage, over: !!s.over };
  };

  // ---------- Pause: the flow engineer's menu when it exists, the room's pause otherwise ----------
  // kit.pauseMenu(el, { ctx }) returns { open, close, cleanup }: a handle to the shared
  // bar (which already has a Pause button and handles Esc), or a bar of its own in el.
  function kitPauseHandle(el, ctx) {
    const kit = team.kit || {};
    if (typeof kit.pauseMenu !== 'function') return null;
    try {
      const h = kit.pauseMenu(el, { ctx, stage: 'surface' });
      return h && typeof h.open === 'function' ? h : null;
    } catch (e) {
      return null;
    }
  }

  // ---------- The session ----------
  function createSession(ctx0, key) {
    const client = isClient(ctx0);
    const room0 = roomOf(ctx0);
    // "Everyone on their own device": the host screen is one player's own screen.
    const devices = !client && room0.mode === 'devices';
    const ownScreen = client || devices;
    // Who gets the over-the-shoulder view: anyone with a screen to themselves.
    const eyeLevelOK = ownScreen || room0.mode === 'solo';
    let shooter = null;
    let ctx = ctx0;
    const stage = document.createElement('div');
    stage.className = 'tv-stage';
    const hud = createHud(stage, () => requestPause());
    let phase = 'landing';
    let host = null; // host mode: sim state
    let dec = null; // client mode
    let renderer = null;
    let engine = null;
    let scene3dFailed = false;
    let overlay2d = null;
    let destroyed = false;
    let detachTimer = 0;
    let startedAt = performance.now() / 1000;
    let lastTick = -1;
    let landingK = 0;
    let landingDoneSent = false;
    let landingStart = 0;
    let ascentSent = false;
    let launchT = -1;
    let surfaceDoneSent = false;
    let enc = null;
    let snapAt = 0;
    let snapN = 0;
    let initChunks = null;
    let initI = 0;
    let lastHud = 0;
    let lastInput = 0;
    let localPause = false;
    let lastProgress = -1;
    const audio = createAudio();
    let pred = null;
    let interp = null;
    let latestClient = null;
    let myId = null;
    // With the shared bar, Esc is already its job; our keys only pause when there is none.
    const input = createInput(stage, () => {
      if (!pauseHandle) requestPause();
    });
    const dropsSeen = {};
    const lastDropBtn = {};
    let landingDrift = { driftX: 0, driftZ: 0, radius: 12 };
    // "Why we're here" (docs/TEAM-V3.md item 11): a card before the descent, then a goal line.
    let why = null;
    let whyState = 0; // 0 not yet shown, 1 open, 2 done
    let whyAt = 0;
    let clientLandAt = 0;
    const WHY_HOLD_S = 4.5; // the descent waits this long at most (the room's landing timer is short)
    const WHY_MAX_S = 10; // the card closes by itself after this long
    function whyTick(s) {
      if (!s) return;
      if (!why) why = missionWhy(ctx, (s.loadout && s.loadout.objective) || null);
      if (whyState === 0 && phase === 'landing') {
        whyState = 1;
        whyAt = nowS();
        const me = myId ? s.entities.find((e) => e.kind === 'astronaut' && e.playerId === myId) : null;
        const crew = s.entities.filter((e) => e.kind === 'astronaut');
        hud.showWhy(why, ownScreen || room0.mode === 'solo' ? me : null, crew, closeWhy);
      }
      if (whyState === 1 && (phase !== 'landing' || nowS() - whyAt > WHY_MAX_S)) closeWhy();
    }
    function closeWhy() {
      if (whyState !== 1) return;
      whyState = 2;
      hud.hideWhy();
    }
    const descentHeld = () => whyState === 0 || (whyState === 1 && nowS() - whyAt < WHY_HOLD_S);

    // The shared pause menu and mission bar, when the flow's kit has them.
    const pauseHandle = kitPauseHandle(stage, ctx0);
    hud.setChrome(!!pauseHandle);
    const shownState = () => (client ? latestClient : host);
    const paused = () => !!roomOf(ctx).paused || localPause;

    function requestPause() {
      if (phase === 'landing' || destroyed) return;
      if (pauseHandle) {
        try {
          pauseHandle.open();
          return;
        } catch (e) {}
      }
      // No menu yet: pause the room (every device stops), or this screen alone.
      try {
        if (ctx.send) ctx.send({ type: 'pause' });
      } catch (e) {}
      if (!roomOf(ctx).paused) localPause = true;
    }
    function resume() {
      localPause = false;
      try {
        if (ctx.send && roomOf(ctx).paused) ctx.send({ type: 'resume' });
      } catch (e) {}
    }
    hud.onResume(resume);

    function attach(el, c, ph) {
      ctx = c;
      if (detachTimer) {
        clearTimeout(detachTimer);
        detachTimer = 0;
      }
      // Moving the stage drops the mouse capture; say so first, or a solo game reads
      // the lost capture as Esc and opens the pause menu over the liftoff and results.
      if (shooter && shooter.freeMouse && typeof document !== 'undefined' && document.pointerLockElement) shooter.freeMouse();
      el.innerHTML = '';
      el.appendChild(stage);
      phase = ph;
      if (ph === 'ascent' && launchT < 0 && (client || (host && host.over))) launchT = nowS();
      if (ph === 'surface' && renderer) {
        renderer.cinematic(null);
        fade(0);
      }
    }
    function detached() {
      if (shooter && shooter.freeMouse && typeof document !== 'undefined' && document.pointerLockElement) shooter.freeMouse();
      detachTimer = setTimeout(destroy, 2000);
    }

    function nowS() {
      return performance.now() / 1000;
    }

    function worldId() {
      const r = roomOf(ctx);
      try {
        const list = ctx.sim && ctx.sim.scenarios ? ctx.sim.scenarios() : [];
        const sc = list.find((x) => x.id === r.scenarioId);
        const w = sc && sc.surface && sc.surface.world;
        if (w) return w;
      } catch (e) {}
      return 'mars';
    }

    function startHost() {
      const S = team.surface;
      const r = roomOf(ctx);
      let loadout = null;
      try {
        if (ctx.sim && ctx.sim.surfaceLoadout) loadout = ctx.sim.surfaceLoadout(r.design);
      } catch (e) {
        console.warn('surface loadout failed; using a sample one', e);
      }
      const world = (loadout && loadout.world) || worldId();
      if (!loadout) loadout = S.fixture('good', world);
      const roster = crewRoster(ctx, (r.surface && r.surface.roster) || []);
      const players = roster.map((p) => ({ id: p.id, name: p.name, role: p.role, bot: !!p.bot, crewId: p.crewId || null, playerName: p.playerName || null }));
      if (devices) myId = (ctx.session && ctx.session.playerId) || (ctx.view && ctx.view.me && ctx.view.me.id) || null;
      const seed = (r.surface && r.surface.seed) || r.seed || 1;
      host = restoreCheckpoint(r, seed) || S.create(loadout, seed, players, { hazards: r.hazards || 'anomalies', difficulty: r.difficulty || 'engineer', world });
      const landing = (loadout.landing && loadout.landing.offsetM) || 8;
      landingDrift = { driftX: (Math.random() < 0.5 ? -1 : 1) * (10 + landing * 0.8), driftZ: -(6 + landing * 0.6), radius: Math.max(8, landing * 1.2) };
      // Phones hear about this mission through the snapshot encoder too.
      if (ctx.session && typeof ctx.session.sendSnapshot === 'function') {
        ensureNet().then(() => {
          enc = team.surfaceNet.createEncoder();
          initChunks = team.surfaceNet.chunks(enc.init(host));
        });
      }
      begin(host);
    }

    // ---------- Host checkpoint: a dropped host resumes the same mission ----------
    const cpKey = () => `ek-team-surface:${roomOf(ctx).code || 'local'}`;
    function saveCheckpoint(now) {
      if (now - lastCheckpoint < CHECKPOINT_MS || !host || host.over) return;
      lastCheckpoint = now;
      try {
        localStorage.setItem(cpKey(), JSON.stringify({ at: Date.now(), seed: host.seed, v: host.version, phase, state: host }));
      } catch (e) {} // storage full or blocked: the round just cannot resume
    }
    function clearCheckpoint() {
      try {
        localStorage.removeItem(cpKey());
      } catch (e) {}
    }
    function restoreCheckpoint(r, seed) {
      if (r.phase === 'landing') return null; // a landing has nothing worth keeping
      try {
        const raw = localStorage.getItem(cpKey());
        if (!raw) return null;
        const cp = JSON.parse(raw);
        // A checkpoint from the old combat build is not this game: start fresh.
        if (!cp || cp.seed !== seed || !cp.state || cp.state.version !== 2 || Date.now() - cp.at > CHECKPOINT_TTL_MS) return null;
        return cp.state;
      } catch (e) {
        return null;
      }
    }

    function startClient() {
      myId = (ctx.view && ctx.view.me && ctx.view.me.id) || (ctx.session && ctx.session.playerId) || null;
      hud.setWaiting(t('team.surface.waitingHost', 'Waiting for the host…'));
      ensureNet().then(() => {
        if (destroyed) return;
        dec = team.surfaceNet.createDecoder();
        interp = team.surfaceNet.createInterpolator({ delay: 0.1 });
        const onSnap = (bytes) => {
          const kind = dec.packet(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
          if (kind === 'snapshot' && dec.latest) {
            interp.push(dec.latest, nowS());
            if (!renderer && !scene3dFailed) {
              latestClient = dec.latest;
              begin(dec.latest);
            }
            if (pred && dec.latest) {
              const me = dec.latest.entities.find((e) => e.kind === 'astronaut' && e.playerId === myId);
              if (me) pred.correct(me.x, me.z, nowS());
            }
          }
        };
        if (ctx.session && ctx.session.on) offSnap = ctx.session.on('snapshot', onSnap);
      });
    }
    let offSnap = null;
    let lastCheckpoint = 0;

    async function begin(state) {
      hud.setWaiting('');
      try {
        engine = SMD.three && SMD.three.engine ? SMD.three.engine : await import(new URL('js/3d/engine.js', document.baseURI).href);
        if (destroyed) return;
        if (!engine.supported()) throw new Error('no webgl');
        const m = await import(new URL('js/team/surface3d.js', document.baseURI).href);
        if (destroyed) return;
        if (room0.mode === 'solo' && !myId) myId = firstLocal();
        renderer = m.createSurface({ state, camera: ownScreen && myId ? { mode: 'player', id: myId } : { mode: 'group' }, lookOf });
        renderer.el = stage;
        const baseUpdate = renderer.update;
        renderer.update = (dt, t3d) => {
          if (!scene3dFailed) frame(dt, t3d);
          baseUpdate(dt, t3d);
        };
        renderer.sync(state, TICK);
        if (phase === 'landing') renderer.cinematic('landing', 0, landingDrift);
        engine.mount(stage, renderer);
        if (eyeLevelOK && myId) {
          await ensureNet();
          const me = state.entities.find((e) => e.kind === 'astronaut' && e.playerId === myId);
          if (me && !destroyed) {
            pred = team.surfaceNet.createPredictor({
              stepMove: team.surface.stepMove,
              map: state.map,
              speed: predictedSpeed(state, me),
              tick: TICK,
              lag: client ? 0.17 : 0.04,
            });
            pred.seed(me.x, me.z);
            const sm = await import(new URL('js/team/surface3d-shooter.js', document.baseURI).href);
            if (destroyed) return;
            shooter = sm.createShooter({ renderer, stage, myId, role: me.role, S: team.surface, audio, onPause: () => requestPause(), solo: room0.mode === 'solo' });
          }
        }
      } catch (e) {
        scene3dFailed = true;
        console.warn('3D surface unavailable, drawing a 2D map', e);
        overlay2d = createFallback2D(stage);
        startFallbackLoop();
      }
    }

    function predictedSpeed(state, me) {
      const S = team.surface;
      let sp = S.TUNE.moveSpeed * (S.WORLDS[state.world] ? S.WORLDS[state.world].speed : 1);
      if (me.carrying) {
        const samp = state.entities.find((e) => e.id === me.carrying);
        if (samp) sp *= Math.max(S.TUNE.carryMinFactor, 1 - (samp.massKg || 0) * S.TUNE.carryPenaltyPerKg);
      }
      if ((state.hazards || []).some((h) => (h.kind === 'storm' || h.kind === 'acid') && h.state === 'active')) sp *= 0.8;
      return sp;
    }

    function startFallbackLoop() {
      let last = performance.now();
      const loop = (now) => {
        if (destroyed) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        frame(dt, now / 1000);
        if (overlay2d && shownState()) overlay2d.draw(shownState());
        rafFallback = requestAnimationFrame(loop);
      };
      rafFallback = requestAnimationFrame(loop);
    }
    let rafFallback = 0;

    // The game must not stop when the 3D does (a lost WebGL context on a tired laptop,
    // a GPU out of memory): if the renderer stops calling back for 4 s while the page is
    // visible, the mission carries on with the 2D map.
    let lastFrameAt = 0;
    const watchdog = setInterval(() => {
      if (destroyed) return clearInterval(watchdog);
      if (scene3dFailed || !renderer || !lastFrameAt || (typeof document !== 'undefined' && document.hidden)) return;
      if (performance.now() - lastFrameAt < 4000) return;
      scene3dFailed = true;
      console.warn('3D surface stopped drawing; carrying on with the 2D map');
      try {
        if (shooter) shooter.setActive(false);
      } catch (e) {}
      try {
        if (engine) engine.stop();
      } catch (e) {}
      stage.querySelectorAll('canvas').forEach((c) => {
        if (!c.classList.contains('tv-radar')) c.style.display = 'none';
      });
      overlay2d = createFallback2D(stage);
      startFallbackLoop();
    }, 1000);

    // ---------- Each rendered frame ----------
    function frame(dt, t3d) {
      if (destroyed) return;
      lastFrameAt = performance.now();
      if (client) clientFrame(dt);
      else hostFrame(dt);
      const s = shownState();
      if (s) {
        whyTick(s);
        if (!why) why = missionWhy(ctx, (s.loadout && s.loadout.objective) || null);
        hud.update(s, { client: ownScreen || !!shooter, phase, myId, renderer, landingK, audio, ctx, shooter, paused: paused(), kitPause: !!pauseHandle, why });
        audio.frame(dt, s, myId);
        publishProgress(s);
      }
    }

    function publishProgress(s) {
      const p = Math.round((s.progress || 0) * 100);
      if (p === lastProgress) return;
      lastProgress = p;
      try {
        // The shared mission bar shows the surface objectives as the Surface stage's progress.
        if (team.kit && typeof team.kit.setProgress === 'function') team.kit.setProgress(s.progress || 0);
      } catch (e) {}
      try {
        window.dispatchEvent(new CustomEvent('ek-surface-progress', { detail: { progress: s.progress || 0, objectives: s.objectives || [] } }));
      } catch (e) {}
    }

    function hostFrame(dt) {
      if (!host) return;
      const S = team.surface;
      if (ownScreen && host.stage === 'extraction') throwByDigit(host);
      updateShooterState();
      // Landing: a cinematic the crew can steer a little.
      if (phase === 'landing') {
        whyTick(host);
        if (descentHeld()) {
          if (renderer) renderer.cinematic('landing', 0, landingDrift);
          broadcast();
          return;
        }
        // Wall clock: the descent ends on time even on a machine dropping frames.
        if (!landingStart) landingStart = nowS();
        landingK = clamp((nowS() - landingStart) / LANDING_S);
        if (renderer) {
          const inp = input.poll(ctx, null);
          const remote = ctx.session && ctx.session.surfaceInputs ? ctx.session.surfaceInputs() : null;
          const firstRemote = remote && Object.values(remote)[0];
          const steer = inp.p1 || inp[firstLocal()] || firstRemote || null;
          if (steer) {
            landingDrift.driftX = clamp(landingDrift.driftX + (steer.moveX || steer.mx || 0) * dt * 18, -60, 60);
            landingDrift.driftZ = clamp(landingDrift.driftZ + (steer.moveY || steer.my || 0) * dt * 18, -60, 60);
          }
          renderer.cinematic('landing', landingK, landingDrift);
        }
        if (landingK >= 1 && !landingDoneSent) {
          landingDoneSent = true;
          const off = Math.hypot(landingDrift.driftX, landingDrift.driftZ);
          hud.note(t('team.surface.touchdown', 'Touchdown, {m} m from the target', { m: Math.round(off) }), 'good', 2600);
          setTimeout(() => sendRoom({ type: 'landingDone' }), 900);
        }
        // Clients are waiting on the first snapshot to build their scene.
        broadcast();
        return;
      }
      if (renderer) renderer.cinematic(launchT >= 0 ? 'launch' : null, launchProgress());
      whyTick(host);

      // Paused: the world holds still; the network keeps the last picture.
      if (paused() && !host.over) {
        if (shooter) shooter.poll(dt);
        broadcast();
        return;
      }

      // Inputs: this device, plus phones through the room.
      const inputs = input.poll(ctx, host);
      if (shooterLive()) {
        shooter.poll(dt);
        inputs[myId] = Object.assign({}, shooter.input());
      }
      if (ctx.session && ctx.session.surfaceInputs) {
        const remote = ctx.session.surfaceInputs();
        for (const id in remote) if (!(devices && id === myId && shooterLive())) inputs[id] = fromRoomInput(remote[id]);
      }
      // Sample throw-offs asked for on phones and clients.
      applyDrops(inputs);

      if (!host.over) S.step(host, inputs, dt);
      // A new tick: hand it to the renderer and the network.
      if (renderer && host.tick !== lastTick) {
        const stepped = host.tick - lastTick;
        lastTick = host.tick;
        renderer.sync(host, Math.max(TICK * Math.max(1, stepped), 0.0001));
        for (const ev of host.events || []) if (ev.type === 'liftoff' && launchT < 0) launchT = nowS();
      }
      broadcast();
      statusToPhones();
      if (devices && ctx.session && ctx.session.sendInput && performance.now() - lastInput > INPUT_MS) {
        lastInput = performance.now();
        const me = host.entities.find((e) => e.kind === 'astronaut' && e.playerId === myId);
        ctx.session.sendInput(shooterLive() ? shooter.raw() : input.localRaw(me, renderer, host));
      }
      saveCheckpoint(performance.now());
      driveOwnAstronaut(dt, host);

      // Hand-offs to the room.
      if (host.over && !surfaceDoneSent) {
        surfaceDoneSent = true;
        clearCheckpoint();
        if (host.outcome === 'extracted') {
          if (launchT < 0) launchT = nowS();
          sendSurfaceDone();
        } else {
          hud.note(lostText(host.outcome), 'warn', 4200);
          setTimeout(sendSurfaceDone, 3800);
        }
      }
      if (phase === 'ascent' && !ascentSent && launchT >= 0 && launchProgress() >= 1) {
        ascentSent = true;
        const result = S.summary(host);
        sendRoom({ type: 'ascentDone', result });
      }
    }

    function firstLocal() {
      const r = roomOf(ctx);
      const roster = (r.surface && r.surface.roster) || [];
      const local = roster.find((p) => !p.bot && p.controller === 'local');
      return local ? local.id : 'p1';
    }

    function launchProgress() {
      return launchT < 0 ? 0 : clamp((nowS() - launchT) / LAUNCH_S);
    }

    function sendRoom(a) {
      try {
        ctx.send(a);
      } catch (e) {}
    }

    function sendSurfaceDone() {
      if (!host) return;
      const summary = team.surface.summary(host);
      sendRoom({ type: 'surfaceDone', summary });
    }

    function lostText(outcome) {
      if (outcome === 'stranded') return t('team.surface.lost.stranded', 'The ascent window closed before everyone was aboard');
      return t('team.surface.lost.generic', 'Mission over');
    }

    function fade(k) {
      if (renderer) renderer.fade = k;
    }

    // Throw-overboard presses: from phones and own devices (through the room),
    // or a drop button. The sim takes them straight.
    function applyDrops(inputs) {
      const S = team.surface;
      const r = roomOf(ctx);
      const map = (r.surface && r.surface.jettison) || null;
      if (map) {
        for (const who in map) {
          const item = map[who];
          if (!item || dropsSeen[who] === item.at) continue;
          dropsSeen[who] = item.at;
          // Only the scientist and the planner choose what stays behind (docs/TEAM-V3.md item 5).
          if (S.canDo && host.entities.some((e) => e.kind === 'astronaut' && e.playerId === who) && !S.canDo(host, who, 'choose')) continue;
          for (const id of item.ids || [item.id]) S.jettison(host, id);
        }
      }
      for (const id in inputs) {
        const inp = inputs[id];
        if (!inp.dropBtn) continue;
        const was = lastDropBtn[id];
        lastDropBtn[id] = true;
        if (was) continue;
        if (S.canDo && !S.canDo(host, id, 'choose')) continue;
        const rack = (host.ascent.rack || []).slice().sort((a, b) => a.value / a.massKg - b.value / b.massKg);
        if (rack.length) S.jettison(host, rack[0].id);
      }
      for (const id in lastDropBtn) if (!inputs[id] || !inputs[id].dropBtn) lastDropBtn[id] = false;
    }

    // Number keys throw that rack sample overboard, on a keyboard with its own screen.
    function throwByDigit(st) {
      // The chooser groups samples by kind now; number keys are just swallowed.
      void st;
      input.takeDigit();
    }

    function shooterLive() {
      return !!(shooter && shooter.active && shooter.eyeLevel);
    }
    function updateShooterState() {
      if (shooter) shooter.setActive((phase === 'surface' || phase === 'ascent') && launchT < 0 && !paused());
      // The throw-overboard choice needs the mouse.
      const st0 = host || latestClient;
      if (shooter && shooter.hold) shooter.hold(!!(st0 && st0.extraction && st0.extraction.decision > 0));
      // The mission is over: free the mouse now, on purpose, before the room swaps the
      // view for the ascent (a capture lost to that swap would read as Esc: a pause).
      if (shooter && shooter.freeMouse && st0 && st0.over && typeof document !== 'undefined' && document.pointerLockElement) shooter.freeMouse();
    }
    // Draw your own astronaut where your own input puts it, at the full frame
    // rate; the sim's position only corrects it.
    function driveOwnAstronaut(dt, state) {
      if (!shooterLive() || !pred) return;
      const me = state.entities.find((e) => e.kind === 'astronaut' && e.playerId === myId);
      if (!me) return;
      const free = !me.aboard && !me.returning && !(me.restT > 0) && state.stage !== 'intro' && !(state.extraction && state.extraction.decision > 0);
      pred.setActive(free);
      const mine = shooter.input();
      let sp = predictedSpeed(state, me);
      if (mine.sprint && Math.hypot(mine.moveX, mine.moveY) > 0.2 && !me.carrying) sp *= team.surface.TUNE.sprintFactor;
      pred.setSpeed(sp);
      pred.tick(dt, mine, nowS());
      if (!client) pred.correct(me.x, me.z, nowS());
      if (free) renderer.predictPosition(myId, pred.rx, pred.rz, shooter.yaw);
      else renderer.predictPosition(myId, me.x, me.z, null);
    }

    // ---------- Sending to other devices ----------
    function broadcast() {
      const session = ctx.session;
      if (!session || typeof session.sendSnapshot !== 'function' || !enc) return;
      const now = performance.now();
      if (now - snapAt < SNAPSHOT_MS) return;
      snapAt = now;
      if (initChunks && now - lastInitAt > 180) {
        lastInitAt = now;
        session.sendSnapshot(initChunks[initI]);
        initI = (initI + 1) % initChunks.length;
      }
      const slow = snapN % SLOW_EVERY === 0;
      snapN++;
      session.sendSnapshot(enc.encode(host, { slow }));
    }
    let lastInitAt = 0;

    function statusToPhones() {
      const session = ctx.session;
      if (!session || typeof session.sendHud !== 'function') return;
      const now = performance.now();
      if (now - lastHud < 200) return;
      lastHud = now;
      const map = {};
      const r = roomOf(ctx);
      for (const p of (r.surface && r.surface.roster) || []) {
        if (p.bot) continue;
        const st = team.surface.statusFor(host, p.id);
        if (st) map[p.id] = st;
      }
      session.sendHud(map);
    }

    // ---------- Client mode ----------
    function clientFrame(dt) {
      if (!interp) return;
      const now = nowS();
      const sampled = interp.sample(now);
      if (!sampled) return;
      latestClient = sampled;
      if (sampled.stage === 'extraction' && sampled.ascent) throwByDigit(sampled);
      const me = sampled.entities.find((e) => e.kind === 'astronaut' && e.playerId === myId);
      // Local input goes up 20 times a second.
      if (performance.now() - lastInput > INPUT_MS && ctx.session && ctx.session.sendInput) {
        lastInput = performance.now();
        ctx.session.sendInput(paused() ? { mx: 0, my: 0, ax: 0, ay: 0, buttons: 0 } : shooterLive() ? shooter.raw() : input.localRaw(me, renderer, sampled));
      }
      updateShooterState();
      if (shooterLive()) {
        shooter.poll(dt);
        if (renderer) renderer.sync(sampled, 0);
        driveOwnAstronaut(dt, sampled);
      } else {
        const mine = input.localSim();
        if (pred && me) {
          const free = !me.aboard && !me.returning && !(me.restT > 0);
          pred.setActive(free);
          pred.setSpeed(predictedSpeed(sampled, me));
          pred.tick(dt, mine, now);
          if (free && input.heading() != null) pred.heading = input.heading();
        }
        if (renderer) {
          renderer.sync(sampled, 0);
          if (pred && me && !me.aboard && !me.returning && !(me.restT > 0)) renderer.predictPosition(myId, pred.x, pred.z, pred.heading);
        }
      }
      if (renderer) {
        if (phase === 'landing') {
          whyTick(sampled);
          if (descentHeld()) clientLandAt = 0;
          else if (!clientLandAt) clientLandAt = now;
          landingK = clientLandAt ? clamp((now - clientLandAt) / LANDING_S) : 0;
          renderer.cinematic('landing', landingK, landingDrift);
        } else if (sampled.over && sampled.outcome === 'extracted') {
          whyTick(sampled);
          if (launchT < 0) launchT = now;
          renderer.cinematic('launch', launchProgress());
        } else {
          renderer.cinematic(null);
        }
      }
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (offSnap) offSnap();
      if (rafFallback) cancelAnimationFrame(rafFallback);
      clearInterval(watchdog);
      audio.stop();
      input.stop();
      try {
        if (pauseHandle && pauseHandle.cleanup) pauseHandle.cleanup();
        if (team.kit && typeof team.kit.setProgress === 'function') team.kit.setProgress(null);
      } catch (e) {}
      hud.destroy();
      if (shooter) {
        try {
          shooter.dispose();
        } catch (e) {}
      }
      if (engine && renderer) {
        try {
          engine.stop();
        } catch (e) {}
      }
      if (stage.parentNode) stage.parentNode.removeChild(stage);
      if (SESSION && SESSION.key === key) SESSION = null;
    }

    if (client) startClient();
    else if (team.surface) startHost();
    else hud.setWaiting(t('team.surface.nosim', 'The surface simulation did not load.'));

    return {
      key,
      attach,
      detached,
      destroy,
      pause: requestPause,
      resume,
      get paused() {
        return paused();
      },
      get state() {
        return shownState();
      },
      get renderer() {
        return renderer;
      },
      get shooter() {
        return shooter;
      },
      get phase() {
        return phase;
      },
      get client() {
        return client;
      },
      input,
      debug: () => ({ phase, landingK, launchT, paused: paused() }),
    };
  }

  function blankInput() {
    return { moveX: 0, moveY: 0, aimX: 0, aimY: 0, use: false, ability: false };
  }

  // Room input (phone sticks) -> sim input. "Fire" from an old controller counts as Use.
  function fromRoomInput(i) {
    const b = i.buttons | 0;
    return { moveX: i.mx || 0, moveY: i.my || 0, aimX: i.ax || 0, aimY: i.ay || 0, use: !!(i.use || i.revive || i.fire), ability: !!(i.ability || i.ping), sprint: !!(b & 64), shooter: !!(b & 128), earthG: !!(b & 256), dropBtn: !!i.drop };
  }

  // ---------- Input: keyboard, mouse, gamepads, touch ----------
  function createInput(stage, onPause) {
    const keys = new Set();
    const edge = new Set();
    const mouse = { x: 0, y: 0, down: false, ok: false, used: 0 };
    let lastAim = null;
    let touch = null;
    const onDown = (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (!document.pointerLockElement && onPause) onPause();
      }
      if (!keys.has(e.code)) edge.add(e.code);
      keys.add(e.code);
    };
    const onUp = (e) => keys.delete(e.code);
    const onBlur = () => keys.clear();
    const onMove = (e) => {
      const r = stage.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.ok = true;
      mouse.used = performance.now();
    };
    const onMDown = (e) => {
      if (e.target && e.target.closest && e.target.closest('button')) return;
      mouse.down = true;
      mouse.used = performance.now();
    };
    const onMUp = () => {
      mouse.down = false;
    };
    const noMenu = (e) => e.preventDefault();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    stage.addEventListener('mousemove', onMove);
    stage.addEventListener('mousedown', onMDown);
    window.addEventListener('mouseup', onMUp);
    stage.addEventListener('contextmenu', noMenu);

    const wasd = () => {
      let x = 0;
      let z = 0;
      if (keys.has('KeyA')) x -= 1;
      if (keys.has('KeyD')) x += 1;
      if (keys.has('KeyW')) z -= 1;
      if (keys.has('KeyS')) z += 1;
      return { x, z };
    };
    const arrows = () => {
      let x = 0;
      let z = 0;
      if (keys.has('ArrowLeft')) x -= 1;
      if (keys.has('ArrowRight')) x += 1;
      if (keys.has('ArrowUp')) z -= 1;
      if (keys.has('ArrowDown')) z += 1;
      return { x, z };
    };

    function pads() {
      const out = [];
      try {
        const list = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const g of list) {
          if (!g || !g.connected) continue;
          out.push({
            mx: Math.abs(g.axes[0]) > 0.16 ? g.axes[0] : 0,
            my: Math.abs(g.axes[1]) > 0.16 ? g.axes[1] : 0,
            ax: Math.abs(g.axes[2]) > 0.2 ? g.axes[2] : 0,
            ay: Math.abs(g.axes[3]) > 0.2 ? g.axes[3] : 0,
            use: !!(g.buttons[0] && g.buttons[0].pressed) || !!(g.buttons[7] && g.buttons[7].pressed),
            ability: !!(g.buttons[2] && g.buttons[2].pressed),
            drop: !!(g.buttons[1] && g.buttons[1].pressed),
          });
        }
      } catch (e) {}
      return out;
    }

    function aimFromMouse(renderer, me) {
      if (!renderer || !mouse.ok || !me || performance.now() - mouse.used > 4000 || !renderer.camera) return null;
      const el = renderer.el;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const ndcX = (mouse.x / w) * 2 - 1;
      const ndcY = -(mouse.y / h) * 2 + 1;
      const d = groundHit(renderer.camera, ndcX, ndcY);
      if (!d) return null;
      const dx = d.x - me.x;
      const dz = d.z - me.z;
      const len = Math.hypot(dx, dz) || 1;
      const reach = Math.min(1, len / 25);
      return { x: (dx / len) * reach, z: (dz / len) * reach };
    }

    // poll for host / one-screen: returns inputs keyed by roster id.
    function poll(ctx, st) {
      const out = {};
      const r = ctx.state || ctx.view || {};
      const roster = (r.surface && r.surface.roster) || [];
      const locals = roster.filter((p) => !p.bot && p.controller === 'local');
      const padsNow = pads();
      if (locals.length) {
        const me = st ? st.entities.find((e) => e.kind === 'astronaut' && e.playerId === locals[0].id) : null;
        locals.forEach((p, i) => {
          const entry = blankInput();
          if (i === 0) {
            const w = wasd();
            entry.moveX = w.x;
            entry.moveY = w.z;
            const m = aimFromMouse(SESSION && SESSION.renderer, me);
            if (m) {
              entry.aimX = m.x;
              entry.aimY = m.z;
            }
            entry.use = keys.has('KeyE') || keys.has('Space') || mouse.down;
            entry.ability = keys.has('KeyQ');
            entry.dropBtn = keys.has('KeyX');
          } else if (i === 1) {
            const a = arrows();
            entry.moveX = a.x;
            entry.moveY = a.z;
            entry.use = keys.has('Enter') || keys.has('ShiftRight') || keys.has('Numpad0');
            entry.ability = keys.has('ControlRight');
            entry.dropBtn = keys.has('Period');
          }
          // Gamepads take the next seats in order; P1 and P2 may use one too.
          const pad = padsNow[i >= 2 ? i - 2 : padsNow.length > i + 2 ? i + 2 : -1];
          if (pad) mergePad(entry, pad);
          out[p.id] = entry;
        });
      }
      edge.clear();
      return out;
    }
    function mergePad(entry, pad) {
      if (pad.mx || pad.my) {
        entry.moveX = pad.mx;
        entry.moveY = pad.my;
      }
      if (pad.ax || pad.ay) {
        entry.aimX = pad.ax;
        entry.aimY = pad.ay;
      }
      entry.use = entry.use || pad.use;
      entry.ability = entry.ability || pad.ability;
      entry.dropBtn = entry.dropBtn || pad.drop;
    }

    // Own device: one player, keys plus mouse, gamepad or the touch stick.
    let localSim = blankInput();
    function localRaw(me, renderer) {
      const e = blankInput();
      const w = wasd();
      e.moveX = w.x;
      e.moveY = w.z;
      const m = aimFromMouse(renderer, me);
      if (m) {
        e.aimX = m.x;
        e.aimY = m.z;
      }
      e.use = keys.has('KeyE') || keys.has('Space') || mouse.down;
      e.ability = keys.has('KeyQ');
      e.dropBtn = keys.has('KeyX');
      const pad = pads()[0];
      if (pad) mergePad(e, pad);
      if (touch) touch.apply(e);
      localSim = e;
      lastAim = e.aimX || e.aimY ? Math.atan2(e.aimY, e.aimX) : lastAim;
      let buttons = 0;
      if (e.use) buttons |= 2;
      if (e.ability) buttons |= 4;
      if (e.dropBtn) buttons |= 16;
      edge.clear();
      return { mx: e.moveX, my: e.moveY, ax: e.aimX, ay: e.aimY, buttons };
    }

    function enableTouch() {
      if (touch) return;
      touch = createTouchSticks(stage);
    }
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) enableTouch();

    return {
      poll,
      localRaw,
      localSim: () => localSim,
      heading: () => lastAim,
      takeDigit() {
        const code = Array.from({ length: 9 }, (_, i) => 'Digit' + (i + 1)).find((c) => edge.has(c));
        if (!code) return 0;
        edge.delete(code);
        return Number(code.slice(5));
      },
      stop() {
        window.removeEventListener('keydown', onDown);
        window.removeEventListener('keyup', onUp);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('mouseup', onMUp);
        stage.removeEventListener('mousemove', onMove);
        stage.removeEventListener('mousedown', onMDown);
        stage.removeEventListener('contextmenu', noMenu);
        if (touch) touch.destroy();
      },
    };
  }

  // Ray through a screen point onto the ground.
  function groundHit(cam, ndcX, ndcY) {
    const e = cam.matrixWorld.elements;
    const px = e[12];
    const py = e[13];
    const pz = e[14];
    const inv = cam.projectionMatrixInverse.elements;
    const hx = ndcX * inv[0] + inv[12];
    const hy = ndcY * inv[5] + inv[13];
    const hz = -1;
    const dx = e[0] * hx + e[4] * hy + e[8] * hz;
    const dy = e[1] * hx + e[5] * hy + e[9] * hz;
    const dz = e[2] * hx + e[6] * hy + e[10] * hz;
    if (dy >= -0.001) return null;
    const k = -py / dy;
    return { x: px + dx * k, z: pz + dz * k };
  }

  // One thumb stick and two big buttons, for touch devices that can run the 3D.
  function createTouchSticks(stage) {
    const root = document.createElement('div');
    root.className = 'tv-touch';
    root.innerHTML = `
      <div class="tv-stick tv-stick-move"><i></i></div>
      <button class="tv-tbtn tv-tbtn-use" data-tb="use">${esc(t('team.surface.use', 'Use'))}</button>
      <button class="tv-tbtn tv-tbtn-ability" data-tb="ability">${esc(t('team.surface.ability', 'Ability'))}</button>`;
    stage.appendChild(root);
    const state = { mx: 0, my: 0, use: false, ability: false };
    const stickEl = root.querySelector('.tv-stick-move');
    let id = null;
    let cx = 0;
    let cy = 0;
    const thumb = stickEl.querySelector('i');
    const move = (e) => {
      for (const p of e.changedTouches) {
        if (p.identifier !== id) continue;
        const dx = (p.clientX - cx) / 46;
        const dy = (p.clientY - cy) / 46;
        const m = Math.min(1, Math.hypot(dx, dy));
        const a = Math.atan2(dy, dx);
        state.mx = Math.cos(a) * m;
        state.my = Math.sin(a) * m;
        thumb.style.transform = `translate(${Math.cos(a) * m * 34}px, ${Math.sin(a) * m * 34}px)`;
      }
    };
    stickEl.addEventListener('touchstart', (e) => {
      const p = e.changedTouches[0];
      id = p.identifier;
      const r = stickEl.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      move(e);
      e.preventDefault();
    }, { passive: false });
    stickEl.addEventListener('touchmove', (e) => {
      move(e);
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const p of e.changedTouches) {
        if (p.identifier === id) {
          id = null;
          state.mx = state.my = 0;
          thumb.style.transform = '';
        }
      }
    };
    stickEl.addEventListener('touchend', end);
    stickEl.addEventListener('touchcancel', end);
    root.querySelectorAll('[data-tb]').forEach((b) => {
      const k = b.dataset.tb;
      const set = (v) => (e) => {
        state[k] = v;
        e.preventDefault();
      };
      b.addEventListener('touchstart', set(true), { passive: false });
      b.addEventListener('touchend', set(false), { passive: false });
      b.addEventListener('touchcancel', set(false), { passive: false });
    });
    return {
      apply(e) {
        if (state.mx || state.my) {
          e.moveX = state.mx;
          e.moveY = state.my;
        }
        e.use = e.use || state.use;
        e.ability = e.ability || state.ability;
      },
      destroy() {
        root.remove();
      },
    };
  }

  // ---------- HUD ----------
  function createHud(stage, onPause) {
    const root = document.createElement('div');
    root.className = 'tv-hud';
    root.innerHTML = `
      <div class="tv-left">
      <div class="tv-mission" hidden><span class="tv-mission-k"></span><span class="tv-mission-t"></span></div>
      <div class="tv-goal">
        <span class="tv-goal-arrow">${ICON.arrow}</span>
        <div class="tv-goal-text"><b class="tv-goal-title"></b><span class="tv-goal-dist"></span></div>
      </div>
      <div class="tv-job" hidden><i class="tv-dot"></i><b class="tv-job-name"></b><span class="tv-job-what"></span></div>
      <div class="tv-track" hidden>
        <div class="tv-track-head"><span class="tv-track-label"></span><b class="tv-track-pct"></b></div>
        <div class="tv-track-bar"><i></i></div>
        <ul class="tv-track-list"></ul>
      </div>
      </div>
      <div class="tv-corner">
        <span class="tv-clock"><span class="tv-ic tv-daynight"></span><b class="tv-clock-time"></b></span>
        <span class="tv-uplink"></span>
        <button type="button" class="tv-pausebtn" aria-label="">${ICON.pause}</button>
      </div>
      <div class="tv-alarm" role="alert" hidden><b class="tv-alarm-title"></b><span class="tv-alarm-sub"></span></div>
      <div class="tv-note" role="status"></div>
      <div class="tv-wait"></div>
      <div class="tv-readout"></div>
      <div class="tv-tags"></div>
      <div class="tv-suit" hidden>
        <span class="tv-suit-row tv-suit-o2"><span class="tv-ic">${ICON.o2}</span><span class="tv-suit-bar"><i></i></span><b></b></span>
        <span class="tv-suit-row tv-suit-en"><span class="tv-ic">${ICON.bolt}</span><span class="tv-suit-bar"><i></i></span><b></b></span>
        <span class="tv-suit-row tv-suit-hp" hidden><span class="tv-ic">${ICON.suit}</span><span class="tv-suit-bar"><i></i></span><b></b></span>
      </div>
      <div class="tv-crew"></div>
      <div class="tv-prompt" hidden></div>
      <div class="tv-ascent" hidden></div>
      <div class="tv-choosing" hidden><b class="tv-choosing-title"></b><span class="tv-choosing-sub"></span></div>
      <div class="tv-why" hidden role="dialog" aria-modal="false"></div>
      <div class="tv-hint"></div>
      <div class="tv-coach" hidden></div>
      <div class="tv-beacon" hidden><span class="tv-beacon-arrow">${ICON.arrow}</span><b class="tv-beacon-label"></b></div>
      <div class="tv-paused" hidden><div class="tv-paused-card"><b></b><button type="button" class="tv-resume"></button></div></div>`;
    stage.appendChild(root);
    const $ = (s) => root.querySelector(s);
    let hudCtx = null;
    const chooser = team.kit.ascentChooser($('.tv-ascent'), {
      kindName: (k) => kindName(k),
      send: (ids) => {
        try {
          if (hudCtx) hudCtx.send({ type: 'ascentDrop', ids, drop: true });
        } catch (e) {}
      },
    });
    // Enter lifts off with the plan on screen (keyboard players).
    let whyGo = null;
    const onKey = (e) => {
      if (whyGo && !$('.tv-why').hidden && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        whyGo();
        return;
      }
      if (e.key !== 'Enter' || !root.classList.contains('tv-deciding')) return;
      if (chooser.confirm()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    const pauseBtn = $('.tv-pausebtn');
    pauseBtn.setAttribute('aria-label', t('team.surface.pause', 'Pause'));
    pauseBtn.title = t('team.surface.pauseKey', 'Pause (Esc)');
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onPause) onPause();
    });
    $('.tv-paused-card b').textContent = t('team.surface.paused', 'Paused');
    $('.tv-resume').textContent = t('team.surface.resume', 'Resume');
    let resumeFn = null;
    $('.tv-resume').addEventListener('click', () => resumeFn && resumeFn());
    const crewRows = new Map();
    const tags = new Map();
    let last = 0;
    let noteUntil = 0;
    let coachStep = null; // null until the first frame on the ground; -1 when done
    let coachSince = 0;
    let coachFrom = null;
    let trackOpenUntil = 0;
    let lastDone = -1;
    const coachPref = () => {
      try {
        return SMD.team.kit.prefs;
      } catch (e) {
        return null;
      }
    };
    const kindName = (k) => t('team.surface.sample.' + k, k || '');

    function meOf(s, o) {
      const crew = s.entities.filter((e) => e.kind === 'astronaut');
      return crew.find((e) => (o.myId ? e.playerId === o.myId : !e.isBot)) || crew.find((e) => !e.isBot) || null;
    }

    // The character holding a job, by name (docs/TEAM-V3.md item 6).
    function nameOfJob(s, job) {
      const a = s.entities.find((e) => e.kind === 'astronaut' && e.role === job);
      return a ? a.name : jobName(job);
    }
    function choosersOf(s) {
      return [nameOfJob(s, 'scientist'), nameOfJob(s, 'planner')].join(t('team.surface.and', ' and '));
    }

    // The one line on screen that says what to do now, and where.
    function goalLine(s, o, me) {
      const S = team.surface;
      if (o.phase === 'landing') return { title: t('team.surface.obj.landing', 'Bring the lander onto the target'), target: s.map.lander };
      if (s.over && s.outcome === 'extracted') return { title: t('team.surface.obj.liftoff', 'Liftoff'), target: null };
      if (s.over) return { title: lostShort(s.outcome), target: null };
      if (s.extraction && s.extraction.decision > 0) {
        if (me && S && S.canDo && !S.canDo(s, me.playerId, 'choose')) return { title: t('team.surface.obj.chooseOthers', 'Too heavy: {who} choose what stays behind', { who: choosersOf(s) }), target: null };
        return { title: t('team.surface.obj.choose', 'Too heavy: choose what stays behind'), target: null };
      }
      const g = S && S.nextGoal ? S.nextGoal(s, me ? me.playerId : null) : { id: 'home', target: s.map.lander };
      const site = g.target && g.target.kind === 'site' ? g.target : null;
      const sample = g.target && g.target.kind === 'sample' ? g.target : null;
      const phones = ((o.ctx && ((o.ctx.view && o.ctx.view.mode) || (o.ctx.state && o.ctx.state.mode))) || '') === 'phones';
      const keys = phones ? { e: t('team.surface.useBtn', 'USE'), q: t('team.surface.abilityBtn', 'the ability button') } : { e: 'E', q: 'Q' };
      const titles = {
        return: () => t('team.surface.goal.return', 'Head back to the lander: liftoff soon'),
        returning: () => t('team.surface.goal.returning', 'Your suit is walking you back to the lander'),
        rest: () => t('team.surface.goal.rest', 'Resting: the suit is being refilled'),
        shelter: () => t('team.surface.goal.shelter', 'Shelter from the radiation at the lander'),
        deliver: () => t('team.surface.goal.deliver', 'Carry the sample to the lander'),
        resupply: () => t('team.surface.goal.resupply', 'Top up air and power at the lander'),
        plant: () => t('team.surface.goal.plant', 'Plant the dish next to the lander'),
        hold: () => t('team.surface.goal.hold', 'Stay by the dish while the data goes home'),
        sample: () => t('team.surface.goal.pick', 'Pick up the {kind} sample', { kind: kindName(sample && sample.siteKind) }),
        scan: () => (site && site.shadow ? t('team.surface.goal.scanShadow', 'Scan the {kind} in the shadowed crater: bitter cold, watch your suit', { kind: kindName(site.siteKind) }) : t('team.surface.goal.scanSite', 'Scan the {kind} site', { kind: kindName(site && site.siteKind) })),
        wait: () => t('team.surface.goal.wait', 'Wait by the dish for the orbiter to pass overhead'),
        home: () => t('team.surface.goal.home2', 'All done: return to the lander'),
        // docs/TEAM-V3.md item 5: each job's own tasks.
        align: () => t('team.surface.goal.align', 'Realign the dish: hold {e} at the dish', { e: keys.e }),
        repair: () => (g.target && g.target.kind === 'charger' ? t('team.surface.goal.repairCharger', 'Fix the tripped suit charger on the lander') : t('team.surface.goal.repairPanels', 'Clean the dusty solar panels on the lander')),
        patch: () => t('team.surface.goal.patch', "Patch {name}'s worn suit: {q} next to them", { name: (g.target && g.target.name) || '', q: keys.q }),
        systems: () => t('team.surface.goal.systems2', 'Lander systems are fine: help carry samples, or stand by'),
        route: () => t('team.surface.goal.route', 'Mark the next site for {name}: face it and tap {q}', { name: nameOfJob(s, 'scientist'), q: keys.q }),
        call: () => t('team.surface.goal.call', 'The work is done: hold {q} to call everyone home', { q: keys.q }),
        watch: () => t('team.surface.goal.watch', 'Watch the clock: hold {q} to call everyone home in time', { q: keys.q }),
      };
      return { title: (titles[g.id] || titles.home)(), target: g.target, id: g.id };
    }
    function lostShort(outcome) {
      return outcome === 'stranded' ? t('team.surface.obj.stranded', 'The ascent window closed') : t('team.surface.obj.over', 'Mission over');
    }

    // The single real alarm: radiation, the call home, or your own air running out.
    function alarmOf(s, me) {
      if (s.over) return null;
      const rad = (s.hazards || []).find((h) => h.kind === 'radiation');
      if (rad) {
        const sheltered = me && Math.hypot(me.x - s.map.lander.x, me.z - s.map.lander.z) < ((s.base && s.base.shieldR) || 11);
        return rad.state === 'warn'
          ? { title: t('team.surface.alarm.rad', 'Radiation spike in {n} s', { n: ltr(Math.ceil(rad.tLeft)) }), sub: sheltered ? t('team.surface.alarm.safe', 'You are sheltered here') : t('team.surface.alarm.radSub', 'Get inside the dome at the lander, or into a cave') }
          : { title: t('team.surface.alarm.radOn', 'Radiation spike: {n} s', { n: ltr(Math.ceil(rad.tLeft)) }), sub: sheltered ? t('team.surface.alarm.safe', 'You are sheltered here') : t('team.surface.alarm.radSub', 'Get inside the dome at the lander, or into a cave') };
      }
      if (s.stage === 'extraction' && s.extraction && !(s.extraction.decision > 0) && me && !me.aboard && Math.hypot(me.x - s.map.lander.x, me.z - s.map.lander.z) > 9) {
        return { title: t('team.surface.alarm.call', 'Back to the lander: {n} s', { n: ltr(Math.ceil(s.extraction.timer || 0)) }), sub: t('team.surface.alarm.callSub', 'The ascent window will not wait') };
      }
      if (me && !me.returning && !me.aboard && (me.o2 || 0) < 18 && !(me.restT > 0)) return { title: t('team.surface.alarm.o2', 'Oxygen low'), sub: t('team.surface.alarm.o2Sub', 'Head back to the lander to refill') };
      return null;
    }

    return {
      onResume(fn) {
        resumeFn = fn;
      },
      // The shared 52 px mission bar sits on top: move down, and let its Pause button be the one.
      setChrome(on) {
        root.classList.toggle('tv-chrome', !!on);
      },
      // "Why we're here": the need, the goal, what success looks like, and your job.
      showWhy(w, me, crew, onGo) {
        const box = $('.tv-why');
        if (!w) return;
        whyGo = onGo || null;
        const row = (k, v) => (v ? `<div class="tv-why-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>` : '');
        const m = me ? memberOf(me.crewId, me.playerName) : null;
        let face = '';
        try {
          face = m && team.crew && team.crew.portrait ? team.crew.portrait(m, { size: 64 }) : '';
        } catch (e) {}
        const you = me && me.role
          ? `<div class="tv-why-me" style="--c:${ROLE_COLOR[me.role] || '#fff'}">${face}<p><b>${esc(t('team.surface.why.you', 'You are {name}, {job}', { name: me.name, job: jobName(me.role) }))}</b><span>${esc(JOB_LINE[me.role] ? JOB_LINE[me.role]() : '')}</span></p></div>`
          : `<ul class="tv-why-crew">${(crew || []).slice().sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)).map((a) => `<li style="--c:${ROLE_COLOR[a.role] || '#fff'}"><i class="tv-dot"></i><b>${esc(a.name)}</b><span>${esc(jobName(a.role))}</span></li>`).join('')}</ul>`;
        box.innerHTML = `<div class="tv-why-card">
          <p class="tv-why-kick">${esc(t('team.surface.why.kick', 'Why we are here'))}</p>
          ${w.title ? `<h2 class="tv-why-title">${esc(w.title)}</h2>` : ''}
          <dl class="tv-why-rows">${row(t('team.surface.why.need', 'The need'), w.need)}${row(t('team.surface.why.goal', 'Our goal'), w.goal)}${row(t('team.surface.why.success', 'Success looks like'), [w.reqText, w.surface].filter(Boolean).join(' '))}</dl>
          ${you}
          <button type="button" class="tv-why-go">${esc(t('team.surface.why.go', 'Begin the descent'))}</button>
        </div>`;
        box.hidden = false;
        box.querySelector('.tv-why-go').addEventListener('click', (e) => {
          e.stopPropagation();
          if (whyGo) whyGo();
        });
      },
      hideWhy() {
        whyGo = null;
        $('.tv-why').hidden = true;
      },
      setWaiting(text) {
        $('.tv-wait').textContent = text || '';
        $('.tv-wait').hidden = !text;
      },
      note(text, kind, ms) {
        const b = $('.tv-note');
        b.textContent = text;
        b.className = 'tv-note show ' + (kind || '');
        noteUntil = performance.now() + (ms || 2600);
      },
      update(s, o) {
        const now = performance.now();
        const fast = now - last < 100;
        const me = meOf(s, o);
        const r = o.renderer;
        const goal = goalLine(s, o, me);
        if (r) {
          if (o.shooter) o.shooter.setObjective(goal);
          positionTags(s, o, goal, r, me);
        }
        if (now > noteUntil) $('.tv-note').classList.remove('show');
        if (fast) return;
        last = now;
        const surface = o.phase !== 'landing';
        root.classList.toggle('tv-landing', !surface);
        root.classList.toggle('tv-own', !!o.client);

        // Pause: the kit's menu covers it when it exists; otherwise a small card.
        $('.tv-paused').hidden = !(o.paused && !o.kitPause);
        $('.tv-pausebtn').hidden = !surface || !!o.kitPause;

        // The mission's goal, always on screen during the landing and on the surface (item 11).
        const W = o.why;
        const mi = $('.tv-mission');
        mi.hidden = !(W && W.goal) || !!s.over;
        if (W && W.goal) {
          $('.tv-mission-k').textContent = t('team.surface.why.goalK', 'Mission goal');
          if ($('.tv-mission-t').textContent !== W.goal) $('.tv-mission-t').textContent = W.goal;
        }
        // Who you are down here and your job (items 5 and 6).
        const jobEl = $('.tv-job');
        const showJob = surface && o.client && me && me.role && s.jobs !== false && !s.over;
        jobEl.hidden = !showJob;
        if (showJob) {
          jobEl.style.setProperty('--c', ROLE_COLOR[me.role] || '#fff');
          const nm = t('team.surface.youAre', '{name} · {job}', { name: me.name, job: jobName(me.role) });
          if ($('.tv-job-name').textContent !== nm) $('.tv-job-name').textContent = nm;
        }

        // Objective line and distance.
        $('.tv-goal-title').textContent = goal.title;
        const dist = goal.target && me && !me.aboard ? Math.hypot(goal.target.x - me.x, goal.target.z - me.z) : null;
        $('.tv-goal-dist').textContent = dist != null && dist > 4 ? t('team.surface.metres', '{n} m', { n: ltr(Math.round(dist)) }) : '';

        // Objectives tracker: the % always, the checklist when something changes or on hover.
        const objs = s.objectives || [];
        const box = $('.tv-track');
        box.hidden = !surface || !objs.length;
        if (objs.length) {
          const pct = Math.round(clamp(s.progress || 0) * 100);
          $('.tv-track-label').textContent = t('team.surface.track', 'Surface objectives');
          $('.tv-track-pct').textContent = `${ltr(pct)}%`;
          $('.tv-track-bar i').style.transform = `scaleX(${clamp(s.progress || 0)})`;
          const done = objs.filter((x) => x.done).length;
          if (lastDone >= 0 && done > lastDone) trackOpenUntil = now + 5000;
          if (lastDone < 0) trackOpenUntil = now + 9000;
          lastDone = done;
          box.classList.toggle('open', now < trackOpenUntil);
          // Your job's lines first; the others say which crewmate does them (items 5 and 6).
          const myJob = o.client && me && s.jobs !== false ? me.role : null;
          const OJ = (team.surface && team.surface.OBJECTIVE_JOB) || {};
          const rows = objs.map((x) => {
            const job = x.job !== undefined && x.job !== null ? x.job : OJ[x.id] || null;
            return { x, job, mine: !myJob || !job || job === myJob };
          });
          if (myJob) rows.sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0));
          const sig = myJob + rows.map((r) => r.x.id + (r.x.done ? 1 : 0) + r.x.text).join('|');
          const list = $('.tv-track-list');
          if (list.dataset.sig !== sig) {
            list.dataset.sig = sig;
            list.innerHTML = rows
              .map((r) => {
                const who = r.job && (!r.mine || !myJob) ? `<em style="--c:${ROLE_COLOR[r.job] || '#fff'}">${esc(nameOfJob(s, r.job))}</em>` : '';
                return `<li class="${r.x.done ? 'done' : ''} ${r.mine && myJob ? 'mine' : r.job ? 'theirs' : ''}"><i></i><span>${who}${esc(r.x.text)}</span></li>`;
              })
              .join('');
          }
        }

        // Corner: mission clock with day or night, and the next uplink.
        $('.tv-clock-time').textContent = ltr(fmtClock(s.T - s.t));
        $('.tv-daynight').innerHTML = s.sun && !s.sun.up ? ICON.moon : ICON.sun;
        // The uplink windows are the orbiter passing overhead (it stayed in orbit as our
        // relay, docs/TEAM-V3.md "Separation and descent"): a small sky arc shows its pass.
        const U = s.uplink;
        let up = '';
        let pass = -1;
        const relay = !!U && !/direct/i.test(U.label || '');
        if (U && surface && !s.over) {
          if (U.open >= 0) {
            up = U.planted ? t('team.surface.uplinkLive', 'Orbiter overhead: uplink live') : t('team.surface.uplinkNoDish', 'Orbiter overhead: plant the dish');
            const w = (U.windows || []).find((x) => x.i === U.open);
            pass = w && w.dur > 0 ? Math.max(0, Math.min(1, (s.t - w.start) / w.dur)) : 0.5;
          } else if (U.nextIn >= 0) up = t('team.surface.uplinkIn', 'Orbiter overhead in {t}', { t: ltr(fmtClock(U.nextIn)) });
        }
        let upHtml = up ? esc(up) : '';
        if (up && relay) {
          const a = Math.PI * (1 - Math.max(0, pass));
          const dot = pass >= 0 ? `<circle cx="${(17 + 13 * Math.cos(a)).toFixed(1)}" cy="${(16 - 13 * Math.sin(a)).toFixed(1)}" r="2.6" fill="currentColor"/>` : '';
          upHtml = `<svg class="tv-pass" viewBox="0 0 34 18" width="30" height="16" aria-hidden="true"><path d="M2 16.5h30" stroke="currentColor" stroke-opacity=".45" fill="none"/><path d="M4 16a13 13 0 0 1 26 0" stroke="currentColor" stroke-opacity=".55" stroke-dasharray="2 2.4" fill="none"/>${dot}</svg><span>${upHtml}</span>`;
        }
        const upEl = $('.tv-uplink');
        if (upEl.dataset.html !== upHtml) {
          upEl.dataset.html = upHtml;
          upEl.innerHTML = upHtml;
        }
        upEl.classList.toggle('live', !!(U && U.open >= 0 && U.planted));

        // The one alarm.
        const alarm = surface ? alarmOf(s, o.client ? me : null) || (o.client ? null : alarmOf(s, null)) : null;
        const al = $('.tv-alarm');
        al.hidden = !alarm;
        root.classList.toggle('tv-alarm-on', !!alarm);
        if (alarm) {
          $('.tv-alarm-title').textContent = alarm.title;
          $('.tv-alarm-sub').textContent = alarm.sub || '';
        }

        // Your suit: one pill with air and power (and wear, only once it matters).
        const suit = $('.tv-suit');
        const showSuit = surface && o.client && me && !me.aboard;
        suit.hidden = !showSuit;
        if (showSuit) {
          const set = (cls, v, low) => {
            const row = $(cls);
            row.querySelector('i').style.transform = `scaleX(${clamp(v / 100)})`;
            row.querySelector('b').textContent = `${ltr(Math.round(v))}%`;
            row.classList.toggle('low', v < low);
          };
          set('.tv-suit-o2', me.o2 || 0, 22);
          set('.tv-suit-en', me.energy || 0, 18);
          const hpRow = $('.tv-suit-hp');
          hpRow.hidden = !(me.hp < 92);
          if (me.hp < 92) set('.tv-suit-hp', me.hp || 0, 30);
          suit.classList.toggle('returning', !!me.returning);
        }

        // Crew strip on a shared screen: a dot, a name, a thin air line, and a word when it matters.
        const crewEl = $('.tv-crew');
        crewEl.hidden = !surface || !!o.client;
        if (!crewEl.hidden) {
          const crew = s.entities.filter((e) => e.kind === 'astronaut').sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
          for (const e of crew) {
            let row = crewRows.get(e.id);
            if (!row) {
              const el = document.createElement('div');
              el.className = 'tv-crew-row';
              el.style.setProperty('--c', ROLE_COLOR[e.role] || '#fff');
              el.innerHTML = '<i class="tv-dot"></i><b></b><span class="tv-crew-air"><i></i></span><em></em>';
              crewEl.appendChild(el);
              row = { el, name: el.querySelector('b'), air: el.querySelector('.tv-crew-air i'), st: el.querySelector('em') };
              crewRows.set(e.id, row);
            }
            row.name.textContent = e.name;
            row.air.style.transform = `scaleX(${clamp(Math.min(e.o2 || 0, e.energy || 0) / 100)})`;
            row.st.textContent = e.aboard ? t('team.surface.aboard', 'aboard') : e.returning ? t('team.surface.walkingBack', 'walking back') : e.restT > 0 ? t('team.surface.resting', 'resting') : e.carrying ? t('team.surface.carrying', 'carrying a sample') : '';
          }
        }

        // What Use does right now, on your own screen.
        const promptEl = $('.tv-prompt');
        const prompt = me && s.prompts ? s.prompts[me.playerId] : null;
        const deciding = !!(s.extraction && s.extraction.decision > 0);
        const showPrompt = surface && o.client && prompt && !deciding;
        // Standing in someone else's ring: say whose job it is, quietly (docs/TEAM-V3.md item 5).
        const theirs = !showPrompt && surface && o.client && me && !deciding && !s.over ? theirsHint(s, me) : '';
        promptEl.hidden = !showPrompt && !theirs;
        promptEl.classList.toggle('theirs', !showPrompt && !!theirs);
        if (showPrompt) {
          const html = promptHtml(prompt, o);
          if (promptEl.dataset.p !== prompt + (o.shooter ? 1 : 0)) {
            promptEl.dataset.p = prompt + (o.shooter ? 1 : 0);
            promptEl.innerHTML = html;
          }
        } else if (theirs && promptEl.dataset.p !== 'h:' + theirs) {
          promptEl.dataset.p = 'h:' + theirs;
          promptEl.textContent = theirs;
        }

        // Landing readout.
        const ro = $('.tv-readout');
        if (o.phase === 'landing') {
          const k = o.landingK;
          const alt = Math.pow(1 - k, 1.7) * 150;
          const v = Math.pow(1 - k, 0.7) * 58;
          ro.innerHTML = `<b>${ltr(Math.max(0, alt).toFixed(0))} m</b><span>${esc(t('team.surface.altitude', 'Altitude'))}</span><b>${ltr(v.toFixed(1))} m/s</b><span>${esc(t('team.surface.descent', 'Descent'))}</span>`;
          ro.hidden = false;
        } else ro.hidden = true;

        drawAscent(s, o);

        // Short soft notes from what just happened.
        for (const ev of s.events || []) {
          const b = noteFor(ev, s, me, o);
          if (b) this.note(b[0], b[1], b[2]);
        }

        const hint = $('.tv-hint');
        if (o.phase === 'landing') {
          const m = (o.ctx.view && o.ctx.view.mode) || (o.ctx.state && o.ctx.state.mode);
          // The goal line already says what to do; this only says how.
          hint.textContent = m === 'phones' ? t('team.surface.landingStick', 'Steer with the stick') : t('team.surface.landingWasd', 'Steer with W A S D');
        } else hint.textContent = '';
        drawCoach(s, o, me);
      },
      destroy() {
        window.removeEventListener('keydown', onKey);
        chooser.destroy();
        if (root.parentNode) root.parentNode.classList.remove('tv-deciding');
        root.remove();
      },
    };

    function theirsHint(s, me) {
      const S = team.surface;
      if (!S || !S.canDo || !s.jobs || me.aboard || me.returning) return '';
      const near = (e, r) => Math.hypot(e.x - me.x, e.z - me.z) < r;
      const site = s.entities.find((e) => e.kind === 'site' && !e.done && near(e, e.r || 6));
      if (site && !S.canDo(s, me.playerId, 'scan')) return t('team.surface.theirs.scan', '{name} scans the science sites: your job is elsewhere', { name: nameOfJob(s, 'scientist') });
      const dish = s.entities.find((e) => e.kind === 'dish');
      if (dish && near(dish, 4.5) && (!dish.planted || dish.align < 0.99) && !S.canDo(s, me.playerId, 'plant')) return t('team.surface.theirs.dish', '{name} plants and aims the dish', { name: nameOfJob(s, 'comms') });
      const f = (s.faults || []).find((x) => near(x, 2.8));
      if (f && !S.canDo(s, me.playerId, 'repair')) return t('team.surface.theirs.repair', '{name} fixes the lander', { name: nameOfJob(s, 'engineer') });
      return '';
    }

    function promptHtml(p, o) {
      const key = (k) => `<kbd class="ts-key">${esc(k)}</kbd>`;
      const own = o.shooter ? key('E') : key('E');
      const hold = (txt) => `${esc(t('team.surface.hold', 'Hold'))} ${own} ${esc(txt)}`;
      const tap = (txt) => `${own} ${esc(txt)}`;
      switch (p) {
        case 'scan':
          return hold(t('team.surface.p.scan', 'to scan'));
        case 'plant':
          return hold(t('team.surface.p.plant', 'to plant the dish'));
        case 'align':
          return hold(t('team.surface.p.align', 'to realign the dish'));
        case 'pickup':
          return tap(t('team.surface.p.pickup', 'to pick up the sample'));
        case 'deliver':
          return esc(t('team.surface.p.deliver', 'Walk into the lander ring to load it')) + ` · ${tap(t('team.surface.p.drop', 'to set it down'))}`;
        case 'needs_instrument':
          return esc(t('team.surface.p.noInstrument', 'None of your instruments can read this site'));
        case 'repair':
          return hold(t('team.surface.p.repair', 'to fix it'));
        case 'shelter':
          return esc(t('team.surface.p.shelter', 'Radiation: get to the lander'));
        case 'returning':
          return esc(t('team.surface.p.returning', 'Autopilot: your suit is bringing you home'));
        case 'rest':
          return esc(t('team.surface.p.rest', 'Refilling air and power…'));
        default:
          return '';
      }
    }

    function drawAscent(s, o) {
      const box = $('.tv-ascent');
      hudCtx = o.ctx;
      const A = s.ascent;
      const decision = s.extraction && s.extraction.decision > 0 ? s.extraction.decision : 0;
      const launched = A && s.over && s.outcome === 'extracted';
      // While the crew chooses, this is the only thing on screen.
      const deciding = !!(A && s.stage === 'extraction' && decision > 0 && (A.rack || []).length);
      root.classList.toggle('tv-deciding', deciding);
      if (root.parentNode) root.parentNode.classList.toggle('tv-deciding', deciding);
      const showAscent = A && s.stage === 'extraction' && (A.rack || []).length;
      box.hidden = !showAscent && !launched;
      box.classList.toggle('launched', !!launched);
      if (launched) {
        const kg = (A.rack || []).reduce((sum, x) => sum + (x.massKg || 0), 0);
        const n = (A.jettisoned || []).length;
        if (box.dataset.done !== '1') {
          box.dataset.done = '1';
          box.innerHTML = `<div class="ka-head"><b class="ka-title"></b></div><p class="ka-line"></p>`;
        }
        box.querySelector('.ka-title').textContent = t('team.surface.ascent.home', '{kg} kg of samples are coming home', { kg: ltr(Math.round(kg)) });
        box.querySelector('.ka-line').textContent = n ? t('team.surface.ascent.left', '{n} thrown overboard', { n: ltr(n) }) : t('team.surface.ascent.all', 'Nothing left behind');
        return;
      }
      // Only the scientist and the planner choose what stays (docs/TEAM-V3.md item 5).
      const S = team.surface;
      const me = meOf(s, o);
      const canChoose = !(o.client && me && S && S.canDo && s.jobs && !S.canDo(s, me.playerId, 'choose'));
      const wait = $('.tv-choosing');
      wait.hidden = !(showAscent && deciding && !canChoose);
      if (!wait.hidden) {
        $('.tv-choosing-title').textContent = t('team.surface.choosing', 'Too heavy for the ascent');
        $('.tv-choosing-sub').textContent = t('team.surface.choosingSub', '{who} are choosing what stays behind: {n} s', { who: choosersOf(s), n: ltr(Math.ceil(decision)) });
      }
      if (showAscent && !canChoose) box.hidden = true;
      if (!showAscent || !canChoose) return;
      const objective = (s.loadout && s.loadout.objective) || null;
      chooser.update({ items: A.rack.map((x) => ({ id: x.id, kind: x.siteKind, kg: x.massKg, value: x.value })), liftKg: A.liftKg, objective }, decision);
    }

    // The first time on the ground: move, then scan. Each line stays until you
    // have done it (or a few seconds go by), and is never shown again.
    function drawCoach(s, o, me) {
      const box = $('.tv-coach');
      // One line at the bottom at a time: what Use does right now wins over the tutorial.
      if (!$('.tv-prompt').hidden) {
        box.hidden = true;
        return;
      }
      if (coachStep === -1 || o.phase !== 'surface' || s.stage === 'intro' || s.stage === 'extraction' || s.over || !me) {
        box.hidden = true;
        return;
      }
      const prefs = coachPref();
      if (coachStep === null) coachStep = prefs && prefs.get && prefs.get('surfaceCoach3', '') === '1' ? -1 : 0;
      if (coachStep === -1) {
        box.hidden = true;
        return;
      }
      const room = (o.ctx.view && o.ctx.view.mode) || (o.ctx.state && o.ctx.state.mode);
      const usesPhones = room === 'phones';
      const key = (k) => `<kbd class="ts-key">${esc(k)}</kbd>`;
      const nowS = performance.now() / 1000;
      if (coachFrom === null) {
        coachFrom = { x: me.x, z: me.z };
        coachSince = nowS;
      }
      const elapsed = nowS - coachSince;
      let html = '';
      let done = false;
      if (coachStep === 0) {
        html = usesPhones ? esc(t('team.surface.coach.movePhone', 'The stick walks your astronaut')) : `${key('W')}${key('A')}${key('S')}${key('D')} ${esc(t('team.surface.coach.move', 'walk'))}${o.shooter ? ` · ${esc(t('team.surface.coach.look', 'mouse looks around'))}` : ''}`;
        done = Math.hypot(me.x - coachFrom.x, me.z - coachFrom.z) > 2.2 || elapsed > 10;
      } else {
        // The second line teaches your own job (docs/TEAM-V3.md item 5).
        const job = s.jobs ? me.role : 'scientist';
        const U = usesPhones ? t('team.surface.useBtn', 'USE') : null;
        const Q = usesPhones ? t('team.surface.abilityBtn', 'the ability button') : null;
        const k = (txt, kk) => (usesPhones ? esc(txt) : esc(txt).split('{key}').join(key(kk)));
        if (job === 'comms') {
          html = k(t('team.surface.coach.comms', 'Your job: walk to the folded dish by the lander and hold {key} to plant it', { key: usesPhones ? U : '{key}' }), 'E');
          done = me.useKind === 'plant' || me.useKind === 'align' || elapsed > 16;
        } else if (job === 'engineer') {
          html = k(t('team.surface.coach.engineer', 'Your job: an amber light on the lander is a fault: hold {key} there to fix it. Patch worn suits with Q.', { key: usesPhones ? U : '{key}' }), 'E');
          if (usesPhones) html = esc(t('team.surface.coach.engineerPhone', 'Your job: an amber light on the lander is a fault: hold USE there to fix it. The ability button patches worn suits.'));
          done = me.useKind === 'repair' || elapsed > 12;
        } else if (job === 'planner') {
          html = k(t('team.surface.coach.planner', 'Your job: face a site and tap {key} to send the scientist there; hold {key} to call everyone home', { key: usesPhones ? Q : '{key}' }), 'Q');
          done = elapsed > 12;
        } else {
          html = usesPhones ? esc(t('team.surface.coach.usePhone', 'Stand in a glowing ring and hold USE to scan it')) : `${esc(t('team.surface.coach.use', 'Stand in a glowing ring and hold'))} ${key('E')} ${esc(t('team.surface.coach.toScan', 'to scan it'))}`;
          done = (me.useKind === 'scan' && me.useT > 0.3) || elapsed > 18;
        }
      }
      if (done) {
        coachStep = coachStep >= 1 ? -1 : coachStep + 1;
        coachFrom = null;
        if (coachStep === -1 && prefs && prefs.set) prefs.set('surfaceCoach3', '1');
        if (coachStep === -1) box.hidden = true;
        return;
      }
      if (box.dataset.step !== String(coachStep)) {
        box.dataset.step = String(coachStep);
        box.innerHTML = html;
        box.hidden = false;
      }
    }

    function noteFor(ev, s, me, o) {
      const mine = (id) => me && id === me.id;
      switch (ev.type) {
        case 'windowOpen':
          return [s.uplink && s.uplink.planted ? t('team.surface.n.window', 'The orbiter is overhead: data is going home') : t('team.surface.n.windowNoDish', 'The orbiter is overhead: plant the dish'), 'info', 2600];
        case 'windowClose':
          return [t('team.surface.n.windowDone', '{g} Gbit sent home', { g: ltr(Math.round(ev.sentGbit || 0)) }), 'good', 2400];
        case 'scanDone':
          return [t('team.surface.n.scan', 'Site scanned. A sample is ready to carry.'), 'good', 2400];
        case 'dishPlanted':
          return [t('team.surface.n.dish', 'Dish planted'), 'good', 2000];
        case 'sampleDelivered':
          return [t('team.surface.n.delivered', 'Sample loaded aboard'), 'good', 1800];
        case 'sunset':
          return [t('team.surface.n.sunset', 'Night is falling: suits run colder and use more air'), 'info', 3200];
        case 'sunrise':
          return [t('team.surface.n.sunrise', 'Sunrise'), 'good', 2200];
        case 'baseDark':
          return [t('team.surface.n.dark', 'The base is short of power: no recharging until the sun is back'), 'warn', 3600];
        case 'recorderFull':
          return [t('team.surface.n.recorder', 'Recorder full: send data home before scanning more'), 'warn', 3000];
        case 'hazardWarn':
          if (ev.kind === 'storm') return [t('team.surface.n.storm', 'Dust storm coming: slower walking, less sunlight'), 'info', 3600];
          if (ev.kind === 'acid') return [t('team.surface.n.acid', 'Sulfuric haze coming: it wears suits down'), 'info', 3600];
          if (ev.kind === 'quake') return [t('team.surface.n.quake', 'Quake! Step out of the marked circles'), 'warn', 3000];
          return null;
        case 'suitReturn':
          if (!mine(ev.id) && o.client) return null;
          return [ev.reason === 'oxygen' ? t('team.surface.n.retO2', 'Out of air: the suit is walking back to the lander') : ev.reason === 'battery' ? t('team.surface.n.retBat', 'Suit battery flat: walking back to the lander') : ev.reason === 'suit' ? t('team.surface.n.retSuit', 'Suit worn through: walking back for repairs') : t('team.surface.n.retCall', 'The suit is steering you to the lander'), 'warn', 3200];
        case 'o2StockOut':
          return [t('team.surface.n.o2Out', 'The lander is out of spare oxygen'), 'warn', 3200];
        case 'extractionCalled':
          return [t('team.surface.n.call', 'Time to go home: everyone to the lander'), 'info', 3200];
        case 'fault': {
          const mineJob = me && me.role === 'engineer';
          const what = ev.kind === 'charger' ? t('team.surface.n.faultCharger', 'Lander fault: the suit charger tripped') : t('team.surface.n.faultPanels', 'Lander fault: dust on the solar panels');
          return [mineJob || !o.client ? what : `${what} (${t('team.surface.n.faultWho', '{name} fixes it', { name: nameOfJob(s, 'engineer') })})`, 'info', 3400];
        }
        case 'faultFixed':
          return [ev.kind === 'charger' ? t('team.surface.n.fixedCharger', 'Suit charger back on') : t('team.surface.n.fixedPanels', 'Solar panels clean again'), 'good', 2200];
        case 'ping':
          return ev.site ? [t('team.surface.n.route', 'Next site marked for {name}', { name: nameOfJob(s, 'scientist') }), 'info', 2200] : null;
        default:
          return null;
      }
    }

    function positionTags(s, o, goal, r, me) {
      const layer = $('.tv-tags');
      const w = r.el.clientWidth;
      const h = r.el.clientHeight;
      const arrow = $('.tv-goal-arrow');
      if (goal.target) {
        const p = r.project(goal.target.x, 2, goal.target.z);
        const ang = Math.atan2(p.y - h / 2, p.x - w / 2);
        arrow.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
        arrow.style.visibility = 'visible';
      } else arrow.style.visibility = 'hidden';
      // A marker in the world on the goal: on it in view, at the frame edge pointing the way when not.
      const beacon = $('.tv-beacon');
      const showBeacon = o.phase === 'surface' && goal.target && !s.over && s.stage !== 'intro' && !(s.extraction && s.extraction.decision > 0) && !o.shooter;
      beacon.hidden = !showBeacon;
      if (showBeacon) {
        const p = r.project(goal.target.x, 2, goal.target.z);
        const padX = 56;
        const padTop = 130;
        const padBottom = 110;
        const onScreen = p.onScreen && p.x > padX && p.x < w - padX && p.y > padTop && p.y < h - padBottom;
        const bx = onScreen ? p.x : clamp(p.x, padX, w - padX);
        const by = onScreen ? p.y : clamp(p.y, padTop, h - padBottom);
        const ang = Math.atan2(p.y - by, p.x - bx);
        beacon.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px)`;
        beacon.classList.toggle('edge', !onScreen);
        beacon.querySelector('.tv-beacon-arrow').style.transform = onScreen ? '' : `rotate(${ang + Math.PI / 2}rad)`;
        const d = me ? Math.hypot(goal.target.x - me.x, goal.target.z - me.z) : 0;
        const label = beacon.querySelector('.tv-beacon-label');
        const text = d > 4 ? t('team.surface.metres', '{n} m', { n: ltr(Math.round(d)) }) : '';
        if (label.textContent !== text) label.textContent = text;
      }
      // Name tags: names only, small; a person's own prompt shows in the prompt line instead.
      for (const a of r.crewScreen()) {
        const e = a.e;
        let tag = tags.get(a.id);
        if (!tag) {
          tag = document.createElement('div');
          tag.className = 'tv-tag';
          tag.style.setProperty('--c', a.color);
          tag.innerHTML = '<b></b><span class="tv-tag-prompt"></span>';
          layer.appendChild(tag);
          tags.set(a.id, tag);
        }
        if (o.phase === 'landing' || e.aboard || (o.shooter && e.playerId === o.myId)) {
          tag.style.visibility = 'hidden';
          continue;
        }
        const p = r.project(a.x, 2.45, a.z);
        tag.style.visibility = p.onScreen ? 'visible' : 'hidden';
        tag.style.transform = `translate(calc(${p.x.toFixed(1)}px - 50%), ${(p.y - 26).toFixed(1)}px)`;
        const name = tag.firstChild;
        // The character's name, and the person playing it when it is someone else (item 6).
        const label = e.playerName && !(o.client && e.playerId === o.myId) && !e.isBot ? `${e.name} · ${e.playerName}` : e.name;
        if (name.textContent !== label) name.textContent = label;
        tag.classList.toggle('me', o.client ? e.playerId === o.myId : !e.isBot);
        // On a shared screen, people see what Use does for them above their own heads.
        const prompt = !o.client && !e.isBot && s.prompts ? s.prompts[e.playerId] : null;
        const promptEl = tag.lastChild;
        const txt = prompt ? promptShort(prompt) : '';
        if (promptEl.textContent !== txt) promptEl.textContent = txt;
      }
    }

    function promptShort(p) {
      const words = { scan: 'Hold to scan', plant: 'Hold to plant', align: 'Hold to align', pickup: 'Pick up', deliver: 'To the lander', needs_instrument: 'No instrument fits', shelter: 'Shelter!', returning: 'Walking back', rest: 'Resting', repair: 'Hold to fix' };
      return words[p] ? t('team.surface.prompt.' + p, words[p]) : '';
    }
  }

  // ---------- Sound: quiet ambience, a chime for progress, one alarm ----------
  function createAudio() {
    const A = () => SMD.audio;
    let drone = null;
    let lastKey = null;
    const ready = () => A() && !A().isMuted();
    function event(ev, myAstronautId) {
      const a = A();
      if (!a || !ready()) return;
      switch (ev.type) {
        case 'scanDone':
        case 'dishPlanted':
        case 'windowOpen':
        case 'sampleDelivered':
          a.chime(true);
          break;
        case 'hazardWarn':
          if (ev.kind === 'radiation') a.alarm();
          else a.beep(392, 0.3, 'sine', 0.06);
          break;
        case 'extractionCalled':
          a.alarm();
          break;
        case 'rockfall':
          a.bang(0.15, 0.4);
          break;
        case 'quake':
          a.bang(0.25, 0.9);
          break;
        case 'suitReturn':
          if (!myAstronautId || ev.id === myAstronautId) a.beep(330, 0.35, 'sine', 0.08);
          break;
        case 'liftoff':
          a.bang(0.6, 1.6);
          break;
        default:
          break;
      }
    }
    return {
      frame(dt, s, myId) {
        const a = A();
        if (!a) return;
        // Each event plays once, even if the view re-reads the same state.
        const key = s.tick != null ? s.tick : s.t;
        if (key !== lastKey) {
          lastKey = key;
          const me = myId ? s.entities.find((e) => e.kind === 'astronaut' && e.playerId === myId) : null;
          for (const ev of s.events || []) event(ev, me ? me.id : null);
        }
        // A low steady hum of the suit; a touch louder in a storm.
        if (!drone && ready()) drone = a.engine();
        const storm = (s.hazards || []).some((h) => (h.kind === 'storm' || h.kind === 'acid') && h.state === 'active');
        if (drone) drone.set(storm ? 0.07 : 0.035, 0.12);
      },
      stop() {
        if (drone) drone.stop();
        drone = null;
      },
    };
  }

  // ---------- No WebGL: a plain top-down map, still playable ----------
  function createFallback2D(stage) {
    const c = document.createElement('canvas');
    c.className = 'tv-2d';
    stage.insertBefore(c, stage.firstChild);
    const g = c.getContext('2d');
    return {
      draw(s) {
        const W = stage.clientWidth;
        const H = stage.clientHeight;
        if (c.width !== W || c.height !== H) {
          c.width = W;
          c.height = H;
        }
        const size = s.map.size;
        const k = Math.min(W, H - 150) / size;
        const ox = (W - size * k) / 2;
        const oy = 110;
        g.fillStyle = '#0a0e24';
        g.fillRect(0, 0, W, H);
        const { w, h, cell, tiles } = s.map;
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            const tile = tiles[j * w + i];
            g.fillStyle = tile === 1 ? '#2a2f47' : tile === 3 ? '#050713' : tile === 4 ? '#0e1228' : tile === 2 ? '#33476f' : '#1a2140';
            g.fillRect(ox + i * cell * k, oy + j * cell * k, cell * k + 1, cell * k + 1);
          }
        }
        for (const e of s.entities) {
          const x = ox + e.x * k;
          const y = oy + e.z * k;
          if (e.kind === 'astronaut') {
            if (e.aboard) continue;
            g.fillStyle = ROLE_COLOR[e.role] || '#fff';
            g.beginPath();
            g.arc(x, y, 6, 0, 7);
            g.fill();
          } else if (e.kind === 'lander' || e.kind === 'dish') {
            g.fillStyle = e.kind === 'lander' ? '#ffe9b0' : '#7ad4ff';
            g.fillRect(x - 6, y - 6, 12, 12);
          } else if (e.kind === 'site' && !e.done) {
            g.strokeStyle = '#7ad4ff';
            g.beginPath();
            g.arc(x, y, 8, 0, 7);
            g.stroke();
          } else if (e.kind === 'sample' && !e.heldBy) {
            g.fillStyle = '#e8eef8';
            g.fillRect(x - 2, y - 2, 4, 4);
          }
        }
      },
    };
  }

  // For tests and screenshots: a session that does not need the rest of the room.
  team.surfaceDev = {
    get session() {
      return SESSION;
    },
    start(world, opts = {}) {
      const stage = document.createElement('div');
      stage.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#000';
      document.body.appendChild(stage);
      const ctx = opts.ctx || {
        state: { code: 'DEV', round: 1, mode: opts.mode || 'one', phase: opts.phase || 'surface', scenarioId: world, hazards: opts.hazards || 'anomalies', difficulty: opts.difficulty || 'engineer', seed: opts.seed || 42, surface: { seed: opts.seed || 42, roster: opts.roster || ROLE_ORDER.map((role, i) => ({ id: i === 0 ? 'p1' : 'bot-' + role, role, name: i === 0 ? 'P1' : role, bot: i !== 0, controller: i === 0 ? 'local' : 'bot', seat: i })) } },
        view: null,
        device: opts.device || 'one',
        sim: { scenarios: () => [{ id: world, surface: { world } }], surfaceLoadout: () => team.surface.fixture(opts.fixture || 'good', world) },
        send(a) {
          (window.__sent = window.__sent || []).push(a);
          if (a.type === 'pause') ctx.state.paused = { by: 'local', at: Date.now() };
          if (a.type === 'resume') ctx.state.paused = null;
        },
      };
      // The shared bar reads ctx.view: here the room and the view are one object.
      if (!opts.ctx) ctx.view = ctx.state;
      window.__ctx = ctx;
      mount(stage, ctx, opts.phase || 'surface');
      return ctx;
    },
  };
})();
