// Mission Sprint: the authoritative room (docs/TEAM.md). Pure logic, loads in
// node, no DOM and no network. The host owns the only copy.
//
//   room.create(opts)                   -> state
//   room.reduce(state, action, now)     -> new state (input is never mutated)
//   room.tick(state, now)               -> new state, or the same object when nothing changed
//   room.viewFor(state, playerId, now?) -> what that player may see
//   room.applyInput(state, id, raw, now), room.surfaceInputs(state, now)   controller input
//   room.snapshot(state) / room.restore(snapshot, now)                     survive a host refresh
//
// opts: { mode:'phones'|'one'|'solo', code, seed, scenarioId, difficulty, sandbox,
//         hazards:'anomalies'|'realistic', localSeats, timing:{...ms overrides} }
//
// Phases (docs/TEAM-V2.md):
//   lobby -> brief -> design -> questions -> lock -> cabin -> flight -> landing -> surface -> ascent -> debrief
//   The lobby has its own steps (setupStep): room (own devices / phones only) -> difficulty -> crew -> destination.
//   brief is KILO's briefing. design is the build, one step at a time (buildStep, steps from
//   sim.buildSteps). questions picks the requirement. lock is the review and launch. cabin is the
//   crew conversation (only when timing.cabinMs > 0; `next` skips it).
//   Earth scenarios and missions that die in flight go flight -> debrief.
//   There is no design clock any more; Flight director gets a soft one (view.clock.soft).
//
// Every action is { type, by, ... }. `by` is stamped by net.js, never trusted
// from a phone: a player id, 'local' (the One screen / Solo seat) or 'host'.
//   Anyone      join{name,token}  reconnect{token}  leave  pause  resume
//   Moving      forward  back  stepTo{index}   (lobby and brief: host; build: that step's owner or the host)
//   Lobby       setRole{role, crew?}
//   Brief       pick{}  (everyone ready starts the build; older clients)
//   Build       build{step, option}  (the step's owner)  suggest{step, option}  (anyone)
//   Questions   pick{objective?,requirement?}
//   Design/lock set{role,key,value}  request{to,preset,from?}  answer{requestId,reply:'ok'|'no'}
//               vote{yes,role?}  lock
//   Flight      crisisAct{crisisId,optionId}
//   Ascent      ascentDrop{id,drop} or ascentDrop{ids:[...]} (the surface's throw-overboard plan)
//   Host only   setup{scenarioId,difficulty,hazards,localSeats}  start  next{scenarioId?,difficulty?}
//               refly{change?:{role,key,value},instant?}  kick{playerId}  drop{playerId}  restart
//               surfaceDone{summary}  ascentDone{result}  landingDone
//
// Pause freezes the whole room (every timer slides forward on resume). While paused,
// view.paused = { by, name, at } and clocks and flight progress stand still.
//
// A rejected action leaves the game alone. state.last says what happened
// ({ok,type,by,code,text,playerId}) and the player sees it as view.error.
//
// The view (see viewFor) carries: rev, mode, code, phase, round, scenarioId, difficulty,
// hazards, objectiveId, requirementId, picks, clock{leftS,totalS,overtime}, me{id,name,roles,
// agendas}, players[], roles{role:{id,name,bot}}, design, catalog{roles} (own roles only on a
// phone), resources, checks, canLaunch, votes, requests[], inbox[], presets[], crises[],
// flight{progress,frame,ended,result}, surface{roster,me}, ascent, debrief, ghost, error.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};

  const ROLES = ['planner', 'engineer', 'scientist', 'comms'];
  const MAX_HUMANS = 4;
  const MAX_RECORDS = 8; // humans including ones who left; old ones are forgotten first
  const NAME_MAX = 16;
  const INPUT_STALE_MS = 700;
  const JETTISON_MS = 400; // a thrown-overboard press is held this long so a surface tick sees it

  const TIMING = {
    briefMs: 0, // KILO's briefing waits for the crew
    designMs: 0, // no design clock (TEAM-V2)
    cadetDesignMs: 0,
    softDesignMs: 420000, // Flight director: a soft clock that only reports overtime
    reflyDesignMs: 0,
    lockMs: 0, // the review waits for Launch
    cabinMs: 0, // the cabin conversation; the game's sessions ask for 28 s
    botRequests: false, // bot crewmates no longer nag during the build
    armMs: 3000,
    flightMs: 75000,
    flightHoldMs: 3000, // the flight view's ending lands inside the flight; this is only a beat
    landingMs: 14000, // a safety net: the landing view reports done itself, about 10 s in
    surfaceMaxMs: 600000, // a safety net: the surface view ends the phase itself
    ascentMs: 11000, // a safety net: the launch shot is 7.5 s and reports done itself
    graceMs: 30000, // a sleeping phone keeps its seat this long
    crisisMs: 8000,
    requestMs: 30000,
    botRequestMinMs: 18000,
    botRequestMaxMs: 34000,
  };

  // One tap asks. `to` is the role that can usually do something about it;
  // `res` is the dashboard resource it is about.
  const REQUEST_PRESETS = [
    { id: 'need-power', text: 'Need 50 W', to: 'engineer', res: 'power' },
    { id: 'cut-mass', text: 'Cut 30 kg', to: 'planner', res: 'mass' },
    { id: 'less-data', text: 'Less data!', to: 'scientist', res: 'data' },
    { id: 'more-downlink', text: 'More downlink!', to: 'comms', res: 'comms' },
    { id: 'too-expensive', text: 'Too expensive!', to: 'planner', res: 'budget' },
    { id: 'more-time', text: 'More mission time', to: 'planner', res: 'time' },
    { id: 'lighter-instruments', text: 'Lighter instruments', to: 'scientist', res: 'mass' },
    { id: 'bigger-rocket', text: 'Bigger rocket!', to: 'planner', res: 'mass' },
  ];

  const DECOYS = ['Reboot computer', 'Vent tank', 'Swap to backup', 'Cycle power', 'Open shutter', 'Trim antenna', 'Spin up wheel', 'Purge line'];

  // Controller buttons travel as one number.
  const BUTTONS = { fire: 1, use: 2, ability: 4, revive: 8, drop: 16, ping: 32, swap: 64 };

  let injectedSim = null;
  const sim = () => injectedSim || (SMD.team && SMD.team.sim) || null;
  const surfaceEngine = () => SMD.team && SMD.team.surface;

  function attempt(fn, fallback) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[team.room]', e && e.message);
      return fallback;
    }
  }

  // ---------- State plumbing ----------
  // These are replaced whole, never edited, so copies can share them.
  // `inputs` is the live controller mailbox: see applyInput.
  const SHARED = new Set(['run', 'ghost', 'catalog', 'design', 'resources', 'checks', 'debrief', 'inputs', 'timing', 'summary']);

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value)) out[k] = SHARED.has(k) ? value[k] : clone(value[k]);
      return out;
    }
    return value;
  }

  // Small deterministic generator kept in state, so bots replay the same way.
  function nextRandom(s) {
    s.rng = (s.rng + 0x6d2b79f5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const between = (s, a, b) => a + (b - a) * nextRandom(s);
  const newId = (s, prefix) => `${prefix}${++s.nextId}`;

  // ---------- Players and roles ----------
  const isLocalMode = (s) => s.mode === 'one' || s.mode === 'solo';
  const isHostAction = (by) => by === 'host' || by === 'local';
  const hasHostRights = (s, by) => isHostAction(by) || (!!s.hostPlayer && by === s.hostPlayer);
  const player = (s, id) => s.players.find((p) => p.id === id);
  const humans = (s) => s.players.filter((p) => !p.bot);
  const present = (s) => humans(s).filter((p) => p.connected);
  const rolesOf = (s, id) => ROLES.filter((r) => s.roles[r] === id);
  const midRound = (s) => s.phase !== 'lobby';

  function ownsRole(s, by, role) {
    return s.roles[role] === by;
  }

  function cleanName(raw, s) {
    let name = String(raw == null ? '' : raw)
      .replace(/[\u0000-\u001f\u007f<>]/g, '')
      .trim()
      .slice(0, NAME_MAX);
    if (!name) name = `Player ${humans(s).length + 1}`;
    const taken = (n) => s.players.some((p) => !p.bot && p.name.toLowerCase() === n.toLowerCase());
    if (!taken(name)) return name;
    for (let i = 2; i < 99; i++) {
      const candidate = `${name.slice(0, NAME_MAX - 3)} ${i}`;
      if (!taken(candidate)) return candidate;
    }
    return name;
  }

  // Fewer than four players share the roles out. Prefer what people asked for.
  function dealRoles(s) {
    if (isLocalMode(s)) {
      for (const r of ROLES) s.roles[r] = 'local';
      return;
    }
    const list = present(s);
    for (const r of ROLES) s.roles[r] = null;
    if (!list.length) return;
    for (const p of list) if (p.pref && !s.roles[p.pref]) s.roles[p.pref] = p.id;
    for (const p of list) {
      if (rolesOf(s, p.id).length) continue;
      const free = ROLES.find((r) => !s.roles[r]);
      if (free) s.roles[free] = p.id;
    }
    for (const r of ROLES) {
      if (s.roles[r]) continue;
      const least = list.slice().sort((a, b) => rolesOf(s, a.id).length - rolesOf(s, b.id).length)[0];
      s.roles[r] = least.id;
    }
  }

  // Bots keep the mission alive while a seat is empty.
  const BOT_NAMES = { planner: 'Vega', engineer: 'Rivet', scientist: 'Curie-9', comms: 'Echo' };

  function addBot(s, role, assist) {
    const id = `bot-${role}`;
    if (!player(s, id)) {
      s.players.push({ id, name: BOT_NAMES[role], bot: true, assist: !!assist, persona: role, connected: true });
      s.botTimers[id] = s.now + between(s, s.timing.botRequestMinMs * 0.4, s.timing.botRequestMaxMs);
    }
    return id;
  }

  function removeUnusedBots(s) {
    s.players = s.players.filter((p) => !p.bot || p.assist || ROLES.some((r) => s.roles[r] === p.id));
  }

  function coverWithBots(s, playerId) {
    for (const role of rolesOf(s, playerId)) {
      s.roles[role] = addBot(s, role, false);
      s.covered[role] = playerId;
      delete s.votes[role];
    }
    settleVotes(s);
  }

  function returnRoles(s, playerId) {
    let back = 0;
    for (const role of ROLES) {
      if (s.covered[role] !== playerId) continue;
      s.roles[role] = playerId;
      delete s.covered[role];
      back++;
    }
    if (back) removeUnusedBots(s);
    return back;
  }

  // A late joiner takes a bot's seat, or a role from whoever holds the most.
  function seatLateJoiner(s, id) {
    const botRole = ROLES.find((r) => player(s, s.roles[r]) && player(s, s.roles[r]).bot);
    if (botRole) {
      s.roles[botRole] = id;
      delete s.covered[botRole];
      delete s.votes[botRole];
      removeUnusedBots(s);
      return;
    }
    const holders = present(s).filter((p) => p.id !== id);
    const busiest = holders.sort((a, b) => rolesOf(s, b.id).length - rolesOf(s, a.id).length)[0];
    if (busiest && rolesOf(s, busiest.id).length > 1) {
      const role = rolesOf(s, busiest.id).pop();
      s.roles[role] = id;
      delete s.votes[role];
    }
  }

  function forgetOldRecords(s) {
    const gone = humans(s).filter((p) => !p.connected);
    while (humans(s).length > MAX_RECORDS && gone.length) {
      const oldest = gone.sort((a, b) => a.goneAt - b.goneAt).shift();
      s.players = s.players.filter((p) => p.id !== oldest.id);
      for (const r of ROLES) if (s.covered[r] === oldest.id) delete s.covered[r];
    }
  }

  function addSoloCrew(s) {
    if (s.mode !== 'solo') return;
    for (const r of ROLES) addBot(s, r, true);
  }

  // ---------- Phases ----------
  function setPhase(s, phase, ms) {
    s.phase = phase;
    s.overtime = false;
    s.phaseStartedAt = s.now;
    s.phaseTotalMs = ms || 0;
    s.phaseEndsAt = ms ? s.now + ms : 0;
  }

  function scenarioInfo(s) {
    const list = attempt(() => sim().scenarios(), []) || [];
    return (Array.isArray(list) ? list : []).find((x) => x.id === s.scenarioId) || null;
  }

  function hasSurface(s) {
    const info = scenarioInfo(s);
    if (!info) return false;
    if (info.surface === false || info.training === true || info.landing === false) return false;
    if (info.surface === true || info.landing === true) return true;
    const body = String(info.body || info.world || info.planet || info.target || '').toLowerCase();
    return body ? body !== 'earth' : false;
  }

  function firstScenario() {
    const list = attempt(() => sim().scenarios(), []) || [];
    return list[0] ? list[0].id : null;
  }

  function firstRequirement(s) {
    const info = scenarioInfo(s);
    const list = info && (info.requirements || info.levels);
    return list && list[0] ? list[0].id : null;
  }

  function firstObjective(s) {
    const info = scenarioInfo(s);
    return info && info.objectives && info.objectives[0] ? info.objectives[0].id : null;
  }

  // ---------- The build, one step at a time ----------
  function buildSteps(s) {
    return attempt(() => sim().buildSteps(s.scenarioId, s.difficulty), []) || [];
  }
  const SETUP_STEPS = (s) => (isLocalMode(s) ? ['difficulty', 'crew', 'destination'] : ['room', 'difficulty', 'crew', 'destination']);

  // Who may move the crew along: the host in the lobby and briefing; in the
  // build, whoever owns this step, or the host.
  function canSteer(s, by) {
    if (hasHostRights(s, by)) return true;
    if (s.phase === 'design') {
      const st = buildSteps(s)[s.buildStep];
      return !!st && ownsRole(s, by, st.role);
    }
    if (s.phase === 'questions' || s.phase === 'lock') return canAct(s, by);
    return false;
  }

  // Back one step. Returns a rejection when there is nowhere to go.
  function canGoBack(s) {
    if (s.phase === 'lobby') return SETUP_STEPS(s).indexOf(s.setupStep) > 0;
    return s.phase === 'brief' || s.phase === 'design' || s.phase === 'questions' || s.phase === 'lock';
  }

  function goBack(s) {
    if (s.phase === 'lobby') {
      const list = SETUP_STEPS(s);
      const i = list.indexOf(s.setupStep);
      if (i <= 0) return reject('first-step', 'This is the first step.');
      s.setupStep = list[i - 1];
      return undefined;
    }
    if (s.phase === 'brief') {
      s.setupStep = 'destination';
      setPhase(s, 'lobby', 0);
      return undefined;
    }
    if (s.phase === 'design') {
      if (s.buildStep > 0) s.buildStep--;
      else setPhase(s, 'brief', 0);
      return undefined;
    }
    if (s.phase === 'questions') {
      s.buildStep = Math.max(0, buildSteps(s).length - 1);
      setPhase(s, 'design', 0);
      return undefined;
    }
    if (s.phase === 'lock') {
      s.votes = {};
      s.armedAt = 0;
      setPhase(s, 'questions', 0);
      return undefined;
    }
    return reject('no-back', 'You cannot go back now.');
  }

  function goForward(s, a) {
    if (s.phase === 'lobby') {
      const list = SETUP_STEPS(s);
      const i = Math.max(0, list.indexOf(s.setupStep));
      if (s.setupStep === 'room' && !isLocalMode(s) && present(s).length < 2) return reject('need-players', 'Need at least two players.');
      if (i < list.length - 1) {
        s.setupStep = list[i + 1];
        return undefined;
      }
      return handlers.start(s, a);
    }
    if (s.phase === 'brief') return enterDesign(s);
    if (s.phase === 'design') {
      const n = buildSteps(s).length;
      if (s.buildStep < n - 1) s.buildStep++;
      else enterQuestions(s);
      return undefined;
    }
    if (s.phase === 'questions') return enterLock(s);
    return reject('wrong-phase', 'Not now.');
  }

  function enterQuestions(s) {
    s.votes = {};
    s.armedAt = 0;
    setPhase(s, 'questions', 0);
  }

  function enterBrief(s) {
    if (!s.scenarioId) s.scenarioId = firstScenario();
    s.scenario = s.scenarioId;
    s.design = null;
    s.buildStep = 0;
    s.suggestions = {};
    s.picks = {};
    s.objectiveId = firstObjective(s);
    s.requirementId = firstRequirement(s);
    s.votes = {};
    s.requests = [];
    s.crises = [];
    s.outcomes = {};
    s.run = null;
    s.flight = null;
    s.surface = null;
    s.ascent = null;
    s.debrief = null;
    s.stats = newStats();
    s.summary = null;
    setPhase(s, 'brief', s.timing.briefMs);
  }

  function newStats() {
    return { requestsSent: 0, requestsAnswered: 0, crisesTotal: 0, crisesFixed: 0, crisesMissed: 0, wrongPresses: 0, opportunitiesTaken: 0, agendasMet: 0, agendasTotal: 0 };
  }

  function refreshDerived(s) {
    s.resources = attempt(() => sim().resources(s.design), null);
    s.checks = attempt(() => sim().checks(s.design), []) || [];
  }

  function hardFailures(s) {
    return (s.checks || []).filter((c) => c.hard && !c.ok);
  }

  function dealAgendas(s) {
    const raw = attempt(() => sim().agendas(s.seed, ROLES.slice(), s.difficulty, s.scenarioId), null);
    const map = {};
    if (Array.isArray(raw)) for (const a of raw) if (a && a.role) map[a.role] = a;
    if (raw && !Array.isArray(raw)) Object.assign(map, raw);
    s.agendas = map;
  }

  // No design clock (TEAM-V2). Flight director keeps a soft one: it shows, it
  // says "over time", and it never takes the controls away.
  function startSoftClock(s) {
    s.softClock = s.difficulty === 'director' && !s.sandbox && s.timing.softDesignMs ? { endsAt: s.now + s.timing.softDesignMs, totalMs: s.timing.softDesignMs } : null;
  }

  function enterDesign(s) {
    const fresh = !s.design || s.design.scenario !== s.scenarioId || s.design.difficulty !== s.difficulty;
    if (fresh) {
      s.design = attempt(() => sim().newDesign(s.scenarioId, s.difficulty, s.requirementId), null);
      s.buildStep = 0;
      s.suggestions = {};
      dealAgendas(s);
      startSoftClock(s);
    }
    s.catalog = attempt(() => sim().catalog(s.scenarioId, s.difficulty), null);
    refreshDerived(s);
    s.votes = {};
    s.armedAt = 0;
    setPhase(s, 'design', s.timing.designMs || 0);
  }

  function enterLock(s) {
    setPhase(s, 'lock', s.sandbox ? 0 : s.timing.lockMs);
    s.armedAt = 0;
    settleVotes(s);
  }

  // Launch is agreed when every role voted yes and the rocket can do it.
  function allVoted(s) {
    return ROLES.every((r) => s.votes[r]);
  }

  function settleVotes(s) {
    if (s.phase !== 'design' && s.phase !== 'questions' && s.phase !== 'lock') return;
    botVotes(s);
    if (!allVoted(s) || hardFailures(s).length) {
      s.armedAt = 0;
      return;
    }
    if (s.phase !== 'lock') enterLockFromVotes(s);
    if (!s.armedAt) s.armedAt = s.now + s.timing.armMs;
  }

  function enterLockFromVotes(s) {
    setPhase(s, 'lock', s.sandbox ? 0 : s.timing.lockMs);
  }

  function botVotes(s) {
    const humansVoted = ROLES.filter((r) => {
      const owner = player(s, s.roles[r]);
      return owner && !owner.bot;
    }).every((r) => s.votes[r]);
    if (!humansVoted && s.phase !== 'lock') return;
    for (const r of ROLES) {
      const owner = player(s, s.roles[r]);
      if (owner && owner.bot) s.votes[r] = true;
    }
  }

  // The crew's characters (js/team/crew.js) name the bots and the astronauts.
  function crewNameFor(s, role) {
    const C = SMD.team && SMD.team.crew;
    const list = attempt(() => (Array.isArray(C) ? C : C && typeof C.roster === 'function' ? C.roster() : C && Array.isArray(C.roster) ? C.roster : C && Array.isArray(C.list) ? C.list : null), null);
    const hit = Array.isArray(list) ? list.find((c) => c && (c.role === role || c.job === role)) : null;
    return hit && hit.name ? String(hit.name) : BOT_NAMES[role];
  }

  // ---------- Flight ----------
  function flyNow(s) {
    const outcomes = Object.keys(s.outcomes).length ? s.outcomes : undefined;
    return attempt(() => sim().fly(s.design, s.seed, outcomes), { frames: [], events: [], result: { alive: false, cause: 'sim-error' } });
  }

  const lastT = (run) => {
    const f = run && run.frames;
    return f && f.length ? f[f.length - 1].t : 0;
  };

  // sim.crisesFor has the whole record; fly()'s events only say what happened.
  function crisisList(s, run) {
    const planned = typeof sim().crisesFor === 'function' ? attempt(() => sim().crisesFor(s.design, s.seed), null) : null;
    if (Array.isArray(planned) && planned.length) return planned;
    return (run.events || []).filter((e) => e && (e.fixRole || /crisis|opportunity/i.test(String(e.kind || ''))));
  }

  function crisisKey(e) {
    return String(e.id != null ? e.id : `${e.kind}@${Math.round(Number(e.t) * 1000)}`);
  }

  function crisisOptions(s, e) {
    const right = { id: 'fix', label: String(e.fixLabel || e.fix || e.action || 'Fix it'), correct: true };
    const given = e.options || e.actions;
    if (Array.isArray(given) && given.length) {
      return given.map((o, i) => ({ id: String(o.id != null ? o.id : `o${i}`), label: String(o.label || o.name || o.text || o.id), correct: !!(o.correct || o.right || o.id === e.fixId) }));
    }
    const pool = DECOYS.filter((d) => d !== right.label);
    const opts = [right];
    while (opts.length < 3 && pool.length) {
      const i = Math.floor(nextRandom(s) * pool.length);
      opts.push({ id: `d${opts.length}`, label: pool.splice(i, 1)[0], correct: false });
    }
    // Shuffle, so the right button is not always first.
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom(s) * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }

  function mergePendingCrises(s, run) {
    const keep = s.crises.filter((c) => c.status !== 'pending');
    const known = new Set(keep.map((c) => c.key));
    const elapsed = s.now - s.flight.startedAt;
    const added = [];
    for (const e of crisisList(s, run)) {
      const key = crisisKey(e);
      if (known.has(key)) continue;
      const at = Number(e.t) * s.flight.msPerT;
      if (!Number.isFinite(at) || at < elapsed) continue;
      added.push({
        key,
        id: newId(s, 'x'),
        kind: /opportunity/i.test(String(e.kind)) ? 'opportunity' : 'crisis',
        type: e.type ? String(e.type) : null,
        t: e.t,
        at,
        role: ROLES.includes(e.role) ? e.role : ROLES[0],
        fixRole: ROLES.includes(e.fixRole) ? e.fixRole : ROLES[1],
        title: String(e.title || e.text || e.alarm || e.kind || 'Alarm'),
        alarm: String(e.alarm || e.shout || e.text || e.title || ''),
        windowMs: Number.isFinite(e.windowMs) ? e.windowMs : Number.isFinite(e.windowSec) ? e.windowSec * 1000 : s.timing.crisisMs,
        options: crisisOptions(s, e),
        status: 'pending',
        wrong: 0,
      });
    }
    s.crises = keep.concat(added);
  }

  // The crew meets in the cabin before launch (views.cabin in view-flight.js).
  // Off unless the session asks for it (timing.cabinMs), so tests fly straight away.
  function enterCabin(s) {
    if (!(s.timing.cabinMs > 0)) return enterFlight(s);
    s.armedAt = 0;
    s.cabinSkips = {};
    setPhase(s, 'cabin', s.timing.cabinMs);
  }

  function enterFlight(s) {
    const run = flyNow(s);
    s.run = run;
    const end = lastT(run);
    // Same rule the flight view plays by: a long simulation squeezes into the
    // flight clock, a short one plays at its own pace.
    const durationMs = end > 0 && end <= 150 && !s.timing.fixedFlight ? end * 1000 : s.timing.flightMs;
    s.flight = { startedAt: s.now, durationMs, msPerT: end > 0 ? durationMs / end : 0, frameT: 0 };
    s.crises = [];
    s.outcomes = {};
    setPhase(s, 'flight', durationMs);
    mergePendingCrises(s, run);
    s.armedAt = 0;
  }

  // The alarm and the fix must land on different phones whenever two exist.
  function routeCrisis(s, c) {
    const canHold = (id) => {
      const p = player(s, id);
      return !!p && (p.bot || p.connected);
    };
    const fallback = () => {
      const p = present(s)[0];
      return p ? p.id : addBot(s, c.fixRole, false);
    };
    let alarmTo = s.roles[c.role];
    let fixTo = s.roles[c.fixRole];
    if (!canHold(alarmTo)) alarmTo = fallback();
    if (!canHold(fixTo)) fixTo = fallback();
    const people = present(s);
    if (alarmTo === fixTo && !isLocalMode(s) && people.length > 1) {
      const other = people.find((p) => p.id !== alarmTo);
      fixTo = other.id;
    }
    c.alarmTo = alarmTo;
    c.fixTo = fixTo;
    const fixer = player(s, fixTo);
    if (fixer && fixer.bot) {
      c.botAt = s.now + between(s, 0.3, 0.65) * c.windowMs;
      c.botWill = nextRandom(s) < 0.85;
    } else if (s.mode === 'solo') {
      // Solo: crewmates may save you, late, if you are busy elsewhere.
      c.botAt = s.now + between(s, 0.65, 0.9) * c.windowMs;
      c.botWill = nextRandom(s) < 0.55;
    }
  }

  function resolveCrisis(s, c, status, by) {
    c.status = status;
    c.by = by || null;
    c.resolvedAt = s.now;
    s.outcomes[c.key] = status === 'fixed' ? (c.kind === 'opportunity' ? 'taken' : 'fixed') : 'missed';
    if (status === 'fixed') {
      if (c.kind === 'opportunity') s.stats.opportunitiesTaken++;
      else s.stats.crisesFixed++;
    } else if (c.kind !== 'opportunity') {
      s.stats.crisesMissed++;
    }
    const run = flyNow(s);
    s.run = run;
    mergePendingCrises(s, run);
  }

  // A craft that dies early does not make everyone watch the rest of its tape.
  function flightEndMs(s) {
    const frames = (s.run && s.run.frames) || [];
    const died = frames.find((f) => f.alive === false);
    const lastMs = lastT(s.run) * s.flight.msPerT;
    const end = died ? Math.min(lastMs, (died.t + 5) * s.flight.msPerT) : lastMs;
    return end > 0 ? Math.min(end, s.flight.durationMs) : 0;
  }

  function tickFlight(s) {
    let changed = false;
    const elapsed = s.now - s.flight.startedAt;
    for (const c of s.crises) {
      if (c.status === 'pending' && c.at <= elapsed) {
        c.status = 'active';
        c.startedAt = s.now;
        c.endsAt = s.now + c.windowMs;
        if (c.kind !== 'opportunity') s.stats.crisesTotal++;
        routeCrisis(s, c);
        changed = true;
      }
    }
    for (const c of s.crises.slice()) {
      if (c.status !== 'active') continue;
      if (c.botAt && s.now >= c.botAt) {
        const fix = c.botWill;
        c.botAt = 0;
        if (fix) {
          resolveCrisis(s, c, 'fixed', c.fixTo);
          changed = true;
          continue;
        }
      }
      if (s.now >= c.endsAt) {
        resolveCrisis(s, c, 'missed');
        changed = true;
      }
    }
    // The view plays an ending and says `next`. If it never does, move on anyway.
    if (elapsed >= flightEndMs(s) + s.timing.flightHoldMs && !s.crises.some((c) => c.status === 'active')) {
      finishFlight(s);
      changed = true;
    }
    return changed;
  }

  function finishFlight(s) {
    for (const c of s.crises) if (c.status === 'pending') c.status = 'skipped';
    const alive = !(s.run && s.run.result && s.run.result.alive === false);
    if (alive && hasSurface(s)) enterLanding(s);
    else enterDebrief(s);
  }

  // ---------- Landing, surface, ascent ----------
  // One astronaut per role. Whoever is not a person is a bot, and the surface
  // simulation drives bots itself.
  function buildRoster(s) {
    const roster = [];
    if (isLocalMode(s)) {
      const seats = Math.max(1, Math.min(4, s.localSeats || (s.mode === 'solo' ? 1 : 2)));
      ROLES.forEach((role, i) => {
        const human = i < seats;
        const id = human ? `p${i + 1}` : `bot-${role}`;
        roster.push({ id, playerId: id, role, name: human ? `P${i + 1}` : crewNameFor(s, role), bot: !human, controller: human ? 'local' : 'bot', seat: i });
      });
      return roster;
    }
    const taken = new Set();
    ROLES.forEach((role, i) => {
      const owner = player(s, s.roles[role]);
      const human = owner && !owner.bot && !taken.has(owner.id);
      if (human) taken.add(owner.id);
      const id = human ? owner.id : `bot-${role}`;
      roster.push({ id, playerId: id, role, name: human ? owner.name : crewNameFor(s, role), bot: !human, controller: human ? 'phone' : 'bot', seat: i });
    });
    return roster;
  }

  function enterLanding(s) {
    s.surface = { roster: buildRoster(s), startedAt: 0, seed: s.seed };
    setPhase(s, 'landing', s.timing.landingMs);
  }

  function enterSurface(s) {
    s.surface.startedAt = s.now;
    syncRoster(s);
    setPhase(s, 'surface', s.timing.surfaceMaxMs);
  }

  // A person who drops off hands their astronaut to a bot until they are back.
  function syncRoster(s) {
    if (!s.surface || isLocalMode(s)) return;
    for (const a of s.surface.roster) {
      if (a.controller !== 'phone') continue;
      const p = player(s, a.id);
      a.bot = !(p && p.connected);
    }
  }

  function ascentLift(s, summary) {
    const fromRun = summary && summary.ascent && summary.ascent.liftKg;
    if (Number.isFinite(fromRun)) return fromRun;
    const load = attempt(() => (sim().surfaceLoadout ? sim().surfaceLoadout(s.design) : null), null);
    return load && load.ascent && Number.isFinite(load.ascent.liftKg) ? load.ascent.liftKg : null;
  }

  function enterAscent(s, summary) {
    s.summary = summary || null;
    // The real rack from surface-sim (the choice was already made at the door),
    // or a plain list from a test harness.
    const rack = summary && summary.ascent && Array.isArray(summary.ascent.rack) ? summary.ascent.rack : summary && Array.isArray(summary.samples) ? summary.samples : summary && Array.isArray(summary.cargo) ? summary.cargo : [];
    const norm = (x, i) => (typeof x === 'object' && x ? { ...x, id: String(x.id != null ? x.id : i) } : { id: String(i), label: String(x) });
    const left = summary && summary.ascent && Array.isArray(summary.ascent.jettisoned) ? summary.ascent.jettisoned : [];
    s.ascent = { samples: rack.map(norm), jettisoned: left.map(norm), dropped: {}, result: null, capacityKg: ascentLift(s, summary) };
    setPhase(s, 'ascent', s.timing.ascentMs);
  }

  function finishSurface(s, summary) {
    const crewLost = summary && (summary.skipAscent === true || summary.crewAlive === false || summary.extracted === false);
    if (crewLost) {
      s.summary = summary;
      enterDebrief(s);
    } else enterAscent(s, summary);
  }

  // ---------- Debrief ----------
  function agendaMet(s, role, agenda) {
    if (typeof sim().agendaMet === 'function') return !!attempt(() => sim().agendaMet(agenda, s.design, s.run), false);
    if (agenda && typeof agenda.met === 'boolean') return agenda.met;
    return false;
  }

  function enterDebrief(s) {
    const rows = ROLES.filter((r) => s.agendas && s.agendas[r]).map((role) => {
      const agenda = s.agendas[role];
      const owner = player(s, s.roles[role]);
      return { role, agenda, player: owner ? owner.name : null, met: agendaMet(s, role, agenda) };
    });
    s.stats.agendasTotal = rows.length;
    s.stats.agendasMet = rows.filter((r) => r.met).length;
    s.stats.agendas = rows.map((r) => r.agenda);
    const flight = s.run;
    const outcomes = Object.keys(s.outcomes).length ? s.outcomes : undefined;
    s.debrief = {
      score: attempt(() => sim().score(s.design, flight, s.stats, s.summary), null),
      chain: attempt(() => sim().chain(s.design, s.seed, s.summary, outcomes), []) || [],
      best: attempt(() => sim().bestChange(s.design, s.seed, outcomes), null),
      obituary: attempt(() => sim().obituary(s.design, flight, s.summary), null),
      agendas: rows,
      stats: { ...s.stats },
      result: flight && flight.result,
      surface: s.summary,
      ascent: s.ascent && s.ascent.result,
    };
    setPhase(s, 'debrief', 0);
  }

  function ghostOf(s) {
    const frames = (s.run && s.run.frames) || [];
    const every = Math.max(1, Math.floor(frames.length / 240));
    return {
      frames: frames.filter((_, i) => i % every === 0),
      result: s.run && s.run.result,
      score: s.debrief && s.debrief.score,
      seed: s.seed,
    };
  }

  // ---------- Bots during the design ----------
  function presetsFor(res) {
    return REQUEST_PRESETS.filter((p) => p.res === res);
  }

  function pushRequest(s, from, to, preset, fromId) {
    const def = REQUEST_PRESETS.find((p) => p.id === preset);
    const req = {
      id: newId(s, 'r'),
      from,
      fromId,
      to,
      preset,
      text: def ? def.text : preset,
      status: 'open',
      at: s.now,
      endsAt: s.now + s.timing.requestMs,
    };
    s.requests = s.requests.concat([req]).slice(-30);
    s.stats.requestsSent++;
    return req;
  }

  function botRequest(s, bot) {
    if (!s.resources) return false;
    const trouble = Object.keys(s.resources).filter((k) => s.resources[k] && (s.resources[k].status === 'bad' || s.resources[k].status === 'warn'));
    trouble.sort((a, b) => Number(s.resources[b].status === 'bad') - Number(s.resources[a].status === 'bad'));
    const candidates = [];
    for (const res of trouble) {
      for (const preset of presetsFor(res)) {
        if (preset.to === bot.persona) continue;
        if (s.requests.some((r) => r.status === 'open' && r.preset === preset.id)) continue;
        candidates.push(preset);
      }
    }
    if (!candidates.length) return false;
    const chosen = candidates[Math.floor(nextRandom(s) * Math.min(3, candidates.length))];
    pushRequest(s, bot.persona, chosen.to, chosen.id, bot.id);
    return true;
  }

  // A bot holding a real role tries the change that helps most with what was asked.
  function botAnswer(s, role, req) {
    const def = REQUEST_PRESETS.find((p) => p.id === req.preset);
    const groups = s.catalog && s.catalog.roles && s.catalog.roles[role];
    let best = null;
    if (def && groups && s.resources && s.resources[def.res]) {
      const wantLess = def.res === 'mass' || def.res === 'budget' || def.res === 'data';
      for (const g of groups) {
        for (const o of g.options || []) {
          const d = attempt(() => sim().set(s.design, role, g.key, o.id), null);
          if (!d || d.error) continue;
          const after = attempt(() => sim().resources(d), null);
          const hard = attempt(() => sim().checks(d), []) || [];
          if (!after || !after[def.res] || hard.some((c) => c.hard && !c.ok)) continue;
          const delta = after[def.res].value - s.resources[def.res].value;
          const gain = wantLess ? -delta : delta;
          if (gain > 0 && (!best || gain > best.gain)) best = { gain, design: d };
        }
      }
    }
    if (best) {
      s.design = best.design;
      refreshDerived(s);
      if (s.votes && Object.keys(s.votes).length) {
        s.votes = {};
        s.armedAt = 0;
      }
    }
    req.status = 'answered';
    req.reply = best ? 'ok' : 'no';
    req.answeredAt = s.now;
    s.stats.requestsAnswered++;
  }

  function tickBots(s) {
    let changed = false;
    if (s.phase !== 'design' && s.phase !== 'lock') return false;
    for (const bot of s.players) {
      if (!bot.bot || !s.timing.botRequests) continue;
      if (s.now >= (s.botTimers[bot.id] || 0)) {
        s.botTimers[bot.id] = s.now + between(s, s.timing.botRequestMinMs, s.timing.botRequestMaxMs);
        if (botRequest(s, bot)) changed = true;
      }
    }
    for (const req of s.requests) {
      if (req.status !== 'open') continue;
      const owner = player(s, s.roles[req.to]);
      if (owner && owner.bot && !owner.assist) {
        if (req.botAt === undefined) {
          req.botAt = s.now + between(s, 2500, 6000);
          changed = true;
        } else if (s.now >= req.botAt) {
          botAnswer(s, req.to, req);
          changed = true;
        }
      }
    }
    return changed;
  }

  // ---------- Action handlers: each returns nothing, or {code,text} to reject ----------
  const reject = (code, text) => ({ code, text });

  const handlers = {
    join(s, a) {
      if (isLocalMode(s)) return reject('wrong-mode', 'This room is played on one screen.');
      if (present(s).length >= MAX_HUMANS) return reject('room-full', 'This crew is full.');
      if (typeof a.token !== 'string' || !a.token) return reject('bad-token', 'Could not join.');
      if (player(s, a.token) || s.players.some((p) => p.token === a.token)) return reject('already-joined', 'Already in this room.');
      const id = newId(s, 'p');
      s.players.push({ id, name: cleanName(a.name, s), token: a.token, connected: true, bot: false, goneAt: 0, pref: null });
      s.last.playerId = id;
      if (a.asHost && isHostAction(a.by)) s.hostPlayer = id;
      if (midRound(s)) seatLateJoiner(s, id);
      else dealRoles(s);
      forgetOldRecords(s);
    },

    reconnect(s, a) {
      const p = s.players.find((x) => !x.bot && x.token === a.token && a.token);
      if (!p) return reject('unknown-token', 'That seat is gone.');
      p.connected = true;
      p.goneAt = 0;
      s.last.playerId = p.id;
      if (midRound(s)) {
        if (!returnRoles(s, p.id) && !rolesOf(s, p.id).length) seatLateJoiner(s, p.id);
      } else dealRoles(s);
      syncRoster(s);
    },

    drop(s, a) {
      const p = player(s, a.playerId);
      if (!p || p.bot) return reject('unknown-player', 'No such player.');
      p.connected = false;
      p.goneAt = s.now;
      syncRoster(s);
    },

    leave(s, a) {
      const id = a.playerId || a.by;
      const p = player(s, id);
      if (!p || p.bot) return reject('unknown-player', 'No such player.');
      if (a.by !== id && !hasHostRights(s, a.by)) return reject('host-only', 'Only the host can do that.');
      removePlayer(s, p);
    },

    kick(s, a) {
      const p = player(s, a.playerId);
      if (!p || p.bot) return reject('unknown-player', 'No such player.');
      removePlayer(s, p);
    },

    setRole(s, a) {
      if (s.phase !== 'lobby') return reject('wrong-phase', 'Roles are set in the lobby.');
      if (!ROLES.includes(a.role)) return reject('bad-role', 'No such role.');
      const p = player(s, a.by);
      if (!p || p.bot) return reject('unknown-player', 'No such player.');
      const crew = typeof a.crew === 'string' && /^[\w-]{1,24}$/.test(a.crew) ? a.crew : null;
      if (crew && !isLocalMode(s) && Object.keys(s.crewPick).some((id) => id !== p.id && s.crewPick[id] === crew && player(s, id) && player(s, id).connected)) return reject('crew-taken', 'Someone else is flying as that character.');
      const taken = humans(s).find((x) => x.id !== p.id && x.pref === a.role);
      if (taken) {
        taken.pref = null;
        delete s.crewPick[taken.id];
      }
      p.pref = a.role;
      if (crew) s.crewPick[p.id] = crew;
      dealRoles(s);
    },

    forward(s, a) {
      if (!canSteer(s, a.by)) return reject('not-yours', s.phase === 'design' ? 'This step belongs to another job. Suggest instead.' : 'The host moves the crew on.');
      return goForward(s, a);
    },

    back(s, a) {
      if (!canSteer(s, a.by)) return reject('not-yours', 'The host moves the crew on.');
      if (!canGoBack(s)) return reject('no-back', 'You cannot go back now.');
      return goBack(s);
    },

    // Jump straight to a build step: "Fix it" on the review, or the step bar.
    stepTo(s, a) {
      if (s.phase !== 'design' && s.phase !== 'questions' && s.phase !== 'lock') return reject('wrong-phase', 'Not now.');
      if (!canAct(s, a.by)) return reject('not-in-crew', 'You are not in this crew.');
      const n = buildSteps(s).length;
      const i = Number(a.index);
      if (!Number.isInteger(i) || i < 0 || i >= n) return reject('bad-step', 'No such step.');
      s.buildStep = i;
      s.votes = {};
      s.armedAt = 0;
      if (s.phase !== 'design') setPhase(s, 'design', 0);
    },

    build(s, a) {
      if (s.phase !== 'design') return reject('wrong-phase', 'The build is closed.');
      const st = buildSteps(s).find((x) => x.id === a.step);
      if (!st) return reject('bad-step', 'No such step.');
      if (!isLocalMode(s) && !ownsRole(s, a.by, st.role)) return reject('not-your-role', 'This step belongs to another job. Suggest instead.');
      if (isLocalMode(s) && !canAct(s, a.by)) return reject('not-in-crew', 'You are not in this crew.');
      const next = attempt(() => sim().applyStep(s.design, st.id, String(a.option)), { error: 'sim-error' });
      if (!next || next.error) return reject('bad-set', next && typeof next.error === 'string' ? next.error : 'That cannot change.');
      s.design = next;
      refreshDerived(s);
      delete s.suggestions[st.id];
      s.votes = {};
      s.armedAt = 0;
    },

    suggest(s, a) {
      if (s.phase !== 'design') return reject('wrong-phase', 'Not now.');
      if (!canAct(s, a.by)) return reject('not-in-crew', 'You are not in this crew.');
      const st = buildSteps(s).find((x) => x.id === a.step);
      if (!st || !st.options.some((o) => o.id === a.option)) return reject('bad-step', 'No such choice.');
      const p = player(s, a.by);
      s.suggestions[st.id] = { option: String(a.option), by: a.by, name: p ? p.name : 'Crew', at: s.now };
    },

    pause(s, a) {
      if (!canAct(s, a.by) && !hasHostRights(s, a.by)) return reject('not-in-crew', 'You are not in this crew.');
      if (s.paused) return undefined;
      const p = player(s, a.by);
      s.paused = { by: a.by, name: p && !isLocalMode(s) ? p.name : null, at: s.now };
    },

    resume(s, a) {
      if (!canAct(s, a.by) && !hasHostRights(s, a.by)) return reject('not-in-crew', 'You are not in this crew.');
      if (!s.paused) return undefined;
      const gap = Math.max(0, s.now - s.paused.at);
      s.paused = null;
      shiftTimes(s, gap);
    },

    // Start this mission again from the briefing: same crew, same world.
    restart(s) {
      if (s.phase === 'lobby') return reject('wrong-phase', 'Nothing to restart yet.');
      s.paused = null;
      s.ghost = null;
      newRoundRoles(s);
      enterBrief(s);
    },

    setup(s, a) {
      if (s.phase !== 'lobby' && s.phase !== 'debrief') return reject('wrong-phase', 'Too late to change that.');
      if (a.scenarioId !== undefined) s.scenario = s.scenarioId = String(a.scenarioId);
      if (a.difficulty !== undefined) s.difficulty = String(a.difficulty);
      if (a.hazards === 'anomalies' || a.hazards === 'realistic') s.hazards = a.hazards;
      if (Number.isInteger(a.localSeats) && a.localSeats >= 1 && a.localSeats <= 4) s.localSeats = a.localSeats;
      if (a.sandbox !== undefined) s.sandbox = !!a.sandbox;
    },

    start(s) {
      if (s.phase !== 'lobby') return reject('wrong-phase', 'Already started.');
      if (!isLocalMode(s) && present(s).length < 2) return reject('need-players', 'Need at least two players.');
      dealRoles(s);
      addSoloCrew(s);
      enterBrief(s);
    },

    pick(s, a) {
      if (s.phase !== 'brief' && s.phase !== 'questions') return reject('wrong-phase', 'Not now.');
      if (!canAct(s, a.by)) return reject('not-in-crew', 'You are not in this crew.');
      if (a.objective !== undefined) s.objectiveId = String(a.objective);
      if (a.requirement !== undefined) s.requirementId = String(a.requirement);
      if (s.phase === 'questions') {
        // Chosen after the build: the ship is already there to judge it by.
        if (s.design && a.requirement !== undefined) {
          const next = attempt(() => sim().setRequirement(s.design, s.requirementId), null);
          if (!next || next.error) return reject('bad-requirement', 'No such goal.');
          s.design = next;
          refreshDerived(s);
        }
        return undefined;
      }
      // The briefing: once everyone is ready, the build starts.
      s.picks[a.by] = { objective: s.objectiveId, requirement: s.requirementId };
      const voters = isLocalMode(s) ? ['local'] : present(s).map((p) => p.id);
      if (voters.every((id) => s.picks[id])) enterDesign(s);
    },

    set(s, a) {
      if (s.phase !== 'design' && s.phase !== 'questions' && s.phase !== 'lock') return reject('wrong-phase', 'The design is locked.');
      if (!ROLES.includes(a.role) || !ownsRole(s, a.by, a.role)) return reject('not-your-role', 'That belongs to another role.');
      const next = attempt(() => sim().set(s.design, a.role, a.key, a.value), { error: 'sim-error' });
      if (!next || next.error) return reject('bad-set', next && typeof next.error === 'string' ? next.error : 'That cannot change.');
      s.design = next;
      refreshDerived(s);
      s.votes = {};
      s.armedAt = 0;
      if (s.phase === 'lock' && !s.sandbox && !s.phaseEndsAt) setPhase(s, 'lock', s.timing.lockMs);
    },

    request(s, a) {
      if (s.phase !== 'design' && s.phase !== 'lock') return reject('wrong-phase', 'Not now.');
      if (!ROLES.includes(a.to)) return reject('bad-role', 'No such role.');
      if (!REQUEST_PRESETS.some((p) => p.id === a.preset)) return reject('bad-preset', 'No such request.');
      const mine = rolesOf(s, a.by);
      if (!mine.length) return reject('not-in-crew', 'You are not in this crew.');
      const from = a.from && mine.includes(a.from) ? a.from : mine[0];
      if (s.roles[a.to] === a.by && !isLocalMode(s) && mine.length === ROLES.length) return reject('no-target', 'Nobody else to ask.');
      pushRequest(s, from, a.to, a.preset, a.by);
    },

    answer(s, a) {
      const req = s.requests.find((r) => r.id === a.requestId);
      if (!req) return reject('no-request', 'That request is gone.');
      if (!ownsRole(s, a.by, req.to)) return reject('not-your-role', 'Not addressed to you.');
      if (req.status !== 'open') return reject('already-answered', 'Already answered.');
      req.status = 'answered';
      req.reply = a.reply === 'no' ? 'no' : 'ok';
      req.answeredAt = s.now;
      s.stats.requestsAnswered++;
    },

    vote(s, a) {
      if (s.phase !== 'design' && s.phase !== 'questions' && s.phase !== 'lock') return reject('wrong-phase', 'Not now.');
      const mine = rolesOf(s, a.by);
      if (!mine.length) return reject('not-in-crew', 'You are not in this crew.');
      const yes = a.yes !== false;
      if (yes && hardFailures(s).length) return reject('hard-check', hardFailures(s)[0].text);
      const targets = a.role !== undefined ? mine.filter((r) => r === a.role) : mine;
      if (!targets.length) return reject('not-your-role', 'That belongs to another role.');
      for (const r of targets) {
        if (yes) s.votes[r] = true;
        else delete s.votes[r];
      }
      if (!yes) s.armedAt = 0;
      settleVotes(s);
    },

    lock(s, a) {
      if (s.phase !== 'design' && s.phase !== 'questions') return reject('wrong-phase', 'Not now.');
      if (!hasHostRights(s, a.by) && !rolesOf(s, a.by).length) return reject('not-in-crew', 'You are not in this crew.');
      enterLock(s);
    },

    crisisAct(s, a) {
      if (s.phase !== 'flight') return reject('wrong-phase', 'Not now.');
      const c = s.crises.find((x) => x.id === a.crisisId);
      if (!c || c.status !== 'active') return reject('no-crisis', 'Too late.');
      if (c.fixTo !== a.by) return reject('not-your-fix', 'The fix is on someone else’s phone.');
      const chosen = a.optionId !== undefined ? a.optionId : a.fix !== undefined ? a.fix : a.value;
      const option = c.options.find((o) => o.id === chosen);
      if (!option) return reject('bad-option', 'No such control.');
      if (!option.correct) {
        c.wrong++;
        s.stats.wrongPresses++;
        return;
      }
      resolveCrisis(s, c, 'fixed', a.by);
    },

    landingDone(s) {
      if (s.phase !== 'landing') return reject('wrong-phase', 'Not now.');
      enterSurface(s);
    },

    surfaceDone(s, a) {
      if (s.phase !== 'surface') return reject('wrong-phase', 'Not now.');
      finishSurface(s, a.summary && typeof a.summary === 'object' ? a.summary : null);
    },

    ascentDrop(s, a) {
      if (!canAct(s, a.by)) return reject('not-in-crew', 'You are not in this crew.');
      if (s.phase === 'surface' && s.surface) {
        // The surface simulation throws samples overboard at its extraction stage.
        // One sample (id) or the whole plan at once (ids), from the ascent panel's confirm.
        const ids = Array.isArray(a.ids) ? a.ids.slice(0, 32).map(String) : null;
        s.surface.jettison = { ...(s.surface.jettison || {}), [a.by === 'local' ? 'p1' : a.by]: ids ? { id: ids[0] || '', ids, at: s.now } : { id: String(a.id), at: s.now } };
        return undefined;
      }
      if (s.phase !== 'ascent' || !s.ascent) return reject('wrong-phase', 'Not now.');
      const id = String(a.id);
      if (!s.ascent.samples.some((x) => x.id === id)) return reject('bad-sample', 'No such sample.');
      if (a.drop === false) delete s.ascent.dropped[id];
      else s.ascent.dropped[id] = true;
    },

    ascentDone(s, a) {
      if (s.phase !== 'ascent' || !s.ascent) return reject('wrong-phase', 'Not now.');
      s.ascent.result = a.result && typeof a.result === 'object' ? a.result : null;
      enterDebrief(s);
    },

    // The cabin talk ends for everyone when the host skips, or when every player has.
    skipCabin(s, a) {
      if (s.phase !== 'cabin') return;
      if (isHostAction(a.by)) return enterFlight(s);
      s.cabinSkips = s.cabinSkips || {};
      s.cabinSkips[a.by] = true;
      const people = present(s).filter((p) => !p.bot);
      if (people.every((p) => s.cabinSkips[p.id])) return enterFlight(s);
    },
    next(s, a) {
      if (s.phase === 'lobby') return handlers.start(s, a);
      if (s.phase === 'brief') return enterDesign(s);
      if (s.phase === 'design' || s.phase === 'questions') return goForward(s, a);
      if (s.phase === 'lock') {
        if (hardFailures(s).length) return reject('hard-check', hardFailures(s)[0].text);
        return enterCabin(s);
      }
      if (s.phase === 'cabin') return enterFlight(s);
      if (s.phase === 'flight') {
        for (const c of s.crises) if (c.status === 'active') resolveCrisis(s, c, 'missed');
        return finishFlight(s);
      }
      if (s.phase === 'landing') return enterSurface(s);
      if (s.phase === 'surface') return finishSurface(s, a.summary && typeof a.summary === 'object' ? a.summary : null);
      if (s.phase === 'ascent') return enterDebrief(s);
      if (s.phase !== 'debrief') return reject('wrong-phase', 'Not now.');
      if (a.scenarioId !== undefined) s.scenario = s.scenarioId = String(a.scenarioId);
      if (a.difficulty !== undefined) s.difficulty = String(a.difficulty);
      s.seed = (Math.imul(s.seed, 48271) + 11) >>> 0 || 1;
      s.round++;
      s.ghost = null;
      newRoundRoles(s);
      enterBrief(s);
    },

    refly(s, a) {
      if (s.phase !== 'debrief') return reject('wrong-phase', 'Not now.');
      s.ghost = ghostOf(s);
      s.round++;
      newRoundRoles(s);
      if (a.change && typeof a.change === 'object') {
        // A build-step change (one card, maybe several parts) when the sim knows steps.
        const byStep = a.change.step && typeof sim().applyStep === 'function';
        const next = byStep
          ? attempt(() => sim().applyStep(s.design, String(a.change.step), String(a.change.option)), null)
          : attempt(() => sim().set(s.design, a.change.role, a.change.key, a.change.value), null);
        if (next && !next.error) s.design = next;
        // Open the build on the card that changed, so the crew sees the one change.
        const steps = buildSteps(s);
        const at = steps.findIndex((x) => (a.change.step ? x.id === a.change.step : (x.keys || []).includes(a.change.key)));
        if (at >= 0) s.buildStep = at;
      }
      refreshDerived(s);
      s.votes = {};
      s.requests = [];
      s.crises = [];
      s.outcomes = {};
      s.run = null;
      s.flight = null;
      s.surface = null;
      s.ascent = null;
      s.summary = null;
      s.debrief = null;
      s.stats = newStats();
      if (a.instant) enterLock(s);
      else setPhase(s, 'design', s.sandbox ? 0 : s.timing.reflyDesignMs);
    },
  };

  // Host-only actions are refused from phones whatever the phone claims.
  const HOST_ONLY = new Set(['setup', 'start', 'next', 'refly', 'kick', 'drop', 'surfaceDone', 'ascentDone', 'landingDone', 'restart']);
  // The action types a phone may send (net.js refuses everything else).
  const PLAYER_ACTIONS = ['leave', 'setRole', 'pick', 'set', 'request', 'answer', 'vote', 'lock', 'crisisAct', 'ascentDrop', 'forward', 'back', 'stepTo', 'build', 'suggest', 'pause', 'resume', 'skipCabin'];

  function canAct(s, by) {
    if (isLocalMode(s)) return by === 'local';
    const p = player(s, by);
    return !!p && !p.bot;
  }

  function removePlayer(s, p) {
    if (midRound(s)) {
      coverWithBots(s, p.id);
      for (const r of ROLES) if (s.covered[r] === p.id) delete s.covered[r];
      s.players = s.players.filter((x) => x.id !== p.id);
      syncRoster(s);
    } else {
      s.players = s.players.filter((x) => x.id !== p.id);
      dealRoles(s);
    }
  }

  // Between rounds the seats are dealt again: gone people's roles return to the living.
  function newRoundRoles(s) {
    if (isLocalMode(s)) return;
    s.covered = {};
    dealRoles(s);
    removeUnusedBots(s);
  }

  // ---------- reduce / tick ----------
  function reduce(state, action, now) {
    const type = action && action.type;
    const by = action && action.by;
    const s = clone(state);
    s.now = now;
    s.rev = state.rev + 1;
    s.last = { ok: true, type, by };
    const handler = typeof type === 'string' && Object.prototype.hasOwnProperty.call(handlers, type) ? handlers[type] : null;
    let failure = null;
    if (!handler) failure = reject('unknown-action', 'Unknown action.');
    else if (HOST_ONLY.has(type) && !hasHostRights(state, by)) failure = reject('host-only', 'Only the host can do that.');
    else {
      try {
        failure = handler(s, action, now) || null;
      } catch (e) {
        // A bug in one action must never take the whole room down with it.
        if (typeof console !== 'undefined') console.error('[team.room]', type, e);
        failure = reject('internal', 'That did not work.');
      }
    }
    if (!failure) return s;
    const r = clone(state);
    r.now = now;
    r.rev = state.rev + 1;
    r.last = { ok: false, type, by, code: failure.code, text: failure.text };
    if (typeof by === 'string') r.errors[by] = { code: failure.code, text: failure.text, n: (state.errors[by] ? state.errors[by].n : 0) + 1 };
    return r;
  }

  function tick(state, now) {
    // Paused: nothing moves, nobody times out, until someone resumes.
    if (state.paused) return state;
    const s = clone(state);
    s.now = now;
    let changed = false;

    // Seats whose phone did not come back.
    for (const p of humans(s)) {
      if (p.connected || !p.goneAt || now - p.goneAt < s.timing.graceMs) continue;
      if (s.phase === 'lobby') {
        s.players = s.players.filter((x) => x.id !== p.id);
        dealRoles(s);
        changed = true;
      } else if (rolesOf(s, p.id).length) {
        coverWithBots(s, p.id);
        changed = true;
      }
    }

    for (const r of s.requests) {
      if (r.status === 'open' && now >= r.endsAt) {
        r.status = 'expired';
        changed = true;
      }
    }

    const expired = s.phaseEndsAt && now >= s.phaseEndsAt;
    switch (s.phase) {
      case 'brief':
        if (expired) {
          enterDesign(s);
          changed = true;
        }
        break;
      case 'design':
        if (tickBots(s)) changed = true;
        if (expired) {
          enterLock(s);
          changed = true;
        }
        break;
      case 'lock':
        if (tickBots(s)) changed = true;
        if (s.armedAt && now >= s.armedAt) {
          enterCabin(s);
          changed = true;
        } else if (expired) {
          if (hardFailures(s).length) {
            // Stay until it can fly: the rocket simply cannot lift this.
            s.phaseEndsAt = 0;
            s.phaseTotalMs = 0;
            s.overtime = true;
          } else enterCabin(s);
          changed = true;
        }
        break;
      case 'cabin':
        if (expired) {
          enterFlight(s);
          changed = true;
        }
        break;
      case 'flight':
        if (tickFlight(s)) changed = true;
        break;
      case 'landing':
        if (expired) {
          enterSurface(s);
          changed = true;
        }
        break;
      case 'surface':
        if (expired) {
          finishSurface(s, null);
          changed = true;
        }
        break;
      case 'ascent':
        if (expired) {
          enterDebrief(s);
          changed = true;
        }
        break;
      default:
        break;
    }
    if (!changed) return state;
    s.rev = state.rev + 1;
    return s;
  }

  // ---------- Controller input ----------
  // The one deliberate exception to purity. Up to 80 updates a second from four
  // phones are not game events, so they skip reduce and land in this mailbox,
  // which every copy of the state shares. The surface view reads it each frame.
  const finite = (x) => (Number.isFinite(x) ? x : 0);
  const unit = (x) => Math.max(-1, Math.min(1, finite(x)));

  function decodeInput(raw) {
    if (Array.isArray(raw)) return named(unit(raw[0]), unit(raw[1]), unit(raw[2]), unit(raw[3]), finite(raw[4]) & 0xffff, slotOf(raw[5]));
    const r = raw && typeof raw === 'object' ? raw : {};
    let buttons = finite(r.buttons != null ? r.buttons : r.b) & 0xffff;
    for (const name of Object.keys(BUTTONS)) if (r[name]) buttons |= BUTTONS[name];
    const pick = (a, b) => unit(r[a] !== undefined ? r[a] : r[b]);
    return named(pick('mx', 'moveX'), pick('my', 'moveY'), pick('ax', 'aimX'), pick('ay', 'aimY'), buttons, slotOf(r.weapon));
  }

  const slotOf = (x) => (Number.isInteger(x) && x >= 0 && x < 16 ? x : -1);

  // Short names on the wire, and the names surface-sim's control() reads.
  function named(mx, my, ax, ay, buttons, weapon) {
    return { mx, my, ax, ay, buttons, moveX: mx, moveY: my, aimX: ax, aimY: ay, weapon: weapon >= 0 ? weapon : null };
  }

  function applyInput(state, id, raw, now) {
    const input = decodeInput(raw);
    input.at = now;
    for (const name of Object.keys(BUTTONS)) input[name] = (input.buttons & BUTTONS[name]) !== 0;
    state.inputs[id] = input;
    return input;
  }

  // Input for surface.step: only astronauts a person is driving, only fresh.
  // Anyone missing is a bot as far as the surface simulation is concerned.
  function surfaceInputs(state, now) {
    const out = {};
    if (!state.surface) return out;
    const shots = state.surface.jettison || {};
    for (const a of state.surface.roster) {
      if (a.bot) continue;
      const input = state.inputs[a.id];
      if (!input || now - input.at > INPUT_STALE_MS) continue;
      const shot = shots[a.id];
      out[a.id] = shot && now - shot.at < JETTISON_MS ? { ...input, jettison: shot.ids || shot.id } : input;
    }
    return out;
  }

  // ---------- Views ----------
  function publicPlayer(s, p) {
    return { id: p.id, name: p.name, crewId: (s.crewPick && s.crewPick[p.id]) || null, roles: rolesOf(s, p.id), connected: !!p.connected, bot: !!p.bot, voted: rolesOf(s, p.id).every((r) => s.votes[r]) && rolesOf(s, p.id).length > 0 };
  }

  function clockFor(s, now) {
    if (s.softClock && (s.phase === 'design' || s.phase === 'questions' || s.phase === 'lock')) {
      const left = Math.ceil((s.softClock.endsAt - now) / 1000);
      return { leftS: Math.max(0, left), totalS: Math.round(s.softClock.totalMs / 1000), overtime: left <= 0, soft: true };
    }
    if (!s.phaseEndsAt) return s.phase === 'lock' && s.overtime ? { leftS: 0, totalS: 0, overtime: true } : null;
    return { leftS: Math.max(0, Math.ceil((s.phaseEndsAt - now) / 1000)), totalS: Math.round(s.phaseTotalMs / 1000), overtime: false };
  }

  function requestForView(r) {
    return { id: r.id, from: r.from, to: r.to, preset: r.preset, text: r.text, status: r.status, reply: r.reply || null, at: r.at };
  }

  // What a device sees of a crisis. The alarm holder never gets the controls;
  // the fix holder never gets the alarm; the shared screen gets only the fact.
  // The shared screen sees the alarm and who has the fix, never the controls.
  function crisisForView(s, c, viewerId, now) {
    const base = { id: c.id, kind: c.kind, type: c.type || null, status: c.status, leftS: Math.max(0, Math.ceil((c.endsAt - now) / 1000)), endsAt: c.endsAt, duration: c.windowMs / 1000 };
    const shared = viewerId === null || viewerId === undefined;
    if (viewerId === c.alarmTo || viewerId === 'local' || shared) {
      base.title = c.title;
      base.alarm = { title: c.title, text: c.alarm, role: c.role };
      base.role = c.role;
    }
    if (shared) base.fixRole = c.fixRole;
    if (viewerId === c.fixTo || viewerId === 'local') {
      base.fixRole = c.fixRole;
      base.fixes = c.options.map((o) => ({ id: o.id, label: o.label }));
      base.fix = { role: c.fixRole, options: base.fixes, wrong: c.wrong };
    }
    return base;
  }

  function flightForView(s, now, drawsFlight) {
    if (!s.flight) return null;
    const elapsed = Math.max(0, now - s.flight.startedAt);
    const frames = (s.run && s.run.frames) || [];
    const t = s.flight.msPerT > 0 ? elapsed / s.flight.msPerT : 0;
    let lo = 0;
    let hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (frames[mid].t <= t) lo = mid;
      else hi = mid - 1;
    }
    const f = frames[lo];
    const round = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : x);
    const out = {
      progress: Math.min(1, Math.round((elapsed / s.flight.durationMs) * 100) / 100),
      frame: f ? { sunlit: f.sunlit, battery: round(f.battery), buffer: round(f.buffer), downlink: round(f.downlink), science: round(f.science), alive: f.alive, phase: f.phase } : null,
      result: s.phase === 'flight' ? null : (s.run && s.run.result) || null,
    };
    // Only the device that draws the flight gets the whole record. A phone
    // would otherwise learn the ending before it happens.
    if (drawsFlight && s.run) {
      out.frames = s.run.frames;
      out.events = s.run.events;
      out.result = s.run.result;
    }
    return out;
  }

  function catalogForView(s, roles, full) {
    if (!s.catalog) return null;
    if (full) return s.catalog;
    const out = {};
    for (const r of roles) if (s.catalog.roles && s.catalog.roles[r]) out[r] = s.catalog.roles[r];
    return { roles: out };
  }

  function viewFor(state, playerId, nowArg) {
    const s = state;
    // A paused room shows the moment it stopped.
    const now = s.paused ? s.paused.at : nowArg === undefined ? s.now : nowArg;
    const local = isLocalMode(s);
    const viewer = local ? 'local' : playerId;
    const p = viewer === 'local' ? null : player(s, viewer);
    const myRoles = local ? ROLES.slice() : p ? rolesOf(s, p.id) : [];
    const isSpectator = !local && !p;
    const reveal = s.phase === 'debrief';

    const agendas = {};
    for (const r of myRoles) if (s.agendas && s.agendas[r]) agendas[r] = s.agendas[r];

    const requests = (s.requests || []).slice(-12).map(requestForView);
    const inbox = (s.requests || []).filter((r) => r.status === 'open' && myRoles.includes(r.to)).map(requestForView);
    const crises = (s.crises || []).filter((c) => c.status === 'active').map((c) => crisisForView(s, c, viewer, now));

    const roles = {};
    for (const r of ROLES) {
      const owner = player(s, s.roles[r]);
      roles[r] = owner ? { id: owner.id, name: owner.name, bot: !!owner.bot } : null;
    }

    const view = {
      rev: s.rev,
      mode: s.mode,
      code: s.code,
      phase: s.phase,
      round: s.round,
      scenarioId: s.scenarioId,
      difficulty: s.difficulty,
      hazards: s.hazards,
      sandbox: !!s.sandbox,
      objectiveId: s.objectiveId,
      requirementId: s.requirementId,
      picks: s.picks,
      clock: clockFor(s, now),
      setupStep: s.setupStep,
      setupSteps: SETUP_STEPS(s),
      buildStep: s.buildStep,
      suggestions: s.suggestions || {},
      crewPick: s.crewPick || {},
      paused: s.paused ? { by: s.paused.by, name: s.paused.name, at: s.paused.at } : null,
      canBack: canGoBack(s),
      isHost: local || (!!p && p.id === s.hostPlayer) || playerId === 'host' || playerId === null,
      me: isSpectator ? null : { id: viewer, name: p ? p.name : 'Crew', roles: myRoles, agendas: reveal ? undefined : agendas },
      players: s.players.filter((x) => !x.assist).map((x) => publicPlayer(s, x)),
      roles,
      design: s.design,
      catalog: catalogForView(s, myRoles, local || isSpectator),
      resources: s.resources,
      checks: s.checks,
      canLaunch: !hardFailures(s).length,
      votes: s.votes,
      armed: !!s.armedAt,
      requests,
      inbox,
      presets: REQUEST_PRESETS,
      crises,
      crisis: crises[0] || null,
      flight: flightForView(s, now, local || isSpectator),
      // Own-device players draw the flight themselves. A separate key, so the
      // tape is only sent again when a crisis changes it, not on every tick.
      flightTape: s.mode === 'devices' && p && s.run && s.phase === 'flight' ? { frames: s.run.frames, events: s.run.events, result: s.run.result } : null,
      surface: s.surface
        ? {
            roster: s.surface.roster.map((a) => ({ id: a.id, role: a.role, name: a.name, bot: a.bot, controller: a.controller })),
            me: s.surface.roster.find((a) => a.id === viewer) ? { role: s.surface.roster.find((a) => a.id === viewer).role, controller: true } : null,
          }
        : null,
      ascent: s.ascent ? { samples: s.ascent.samples, jettisoned: s.ascent.jettisoned || [], dropped: s.ascent.dropped, result: s.ascent.result, capacityKg: s.ascent.capacityKg } : null,
      debrief: s.debrief || null,
      ghost: s.ghost ? { result: s.ghost.result, score: s.ghost.score } : null,
      error: viewer && s.errors[viewer] ? s.errors[viewer] : null,
    };
    return view;
  }

  // ---------- create / snapshot ----------
  // Absolute times in the state, so a pause can slide them all forward together.
  function shiftTimes(s, gap) {
    const later = (x) => (x ? x + gap : x);
    s.phaseStartedAt = later(s.phaseStartedAt);
    s.phaseEndsAt = later(s.phaseEndsAt);
    s.armedAt = later(s.armedAt);
    if (s.softClock) s.softClock.endsAt = later(s.softClock.endsAt);
    if (s.paused) s.paused.at = later(s.paused.at);
    for (const p of s.players || []) if (p.goneAt) p.goneAt = later(p.goneAt);
    if (s.flight) s.flight.startedAt = later(s.flight.startedAt);
    if (s.surface) s.surface.startedAt = later(s.surface.startedAt);
    for (const c of s.crises || []) {
      c.startedAt = later(c.startedAt);
      c.endsAt = later(c.endsAt);
      c.botAt = later(c.botAt);
    }
    for (const r of s.requests || []) {
      r.at = later(r.at);
      r.endsAt = later(r.endsAt);
      if (r.botAt !== undefined) r.botAt = later(r.botAt);
    }
    for (const id of Object.keys(s.botTimers || {})) s.botTimers[id] = later(s.botTimers[id]);
  }

  function create(opts = {}) {
    const mode = opts.mode === 'team' ? 'phones' : opts.mode || 'phones';
    const seed = (Number.isFinite(opts.seed) ? opts.seed : 1) >>> 0 || 1;
    const s = {
      rev: 0,
      mode,
      code: opts.code || null,
      round: 1,
      seed,
      rng: seed ^ 0x51ed270b,
      nextId: 0,
      now: Number.isFinite(opts.now) ? opts.now : 0,
      phase: 'lobby',
      setupStep: mode === 'one' || mode === 'solo' ? 'difficulty' : 'room',
      buildStep: 0,
      suggestions: {},
      crewPick: {},
      paused: null,
      softClock: null,
      challenge: opts.challenge || null,
      hostPlayer: null,
      phaseStartedAt: 0,
      phaseEndsAt: 0,
      phaseTotalMs: 0,
      overtime: false,
      armedAt: 0,
      timing: { ...TIMING, ...(opts.timing || {}) },
      scenarioId: opts.scenarioId || null,
      scenario: opts.scenarioId || null,
      difficulty: opts.difficulty || 'engineer',
      hazards: opts.hazards === 'realistic' ? 'realistic' : 'anomalies',
      sandbox: !!opts.sandbox,
      localSeats: opts.localSeats || 0,
      objectiveId: null,
      requirementId: null,
      picks: {},
      players: [],
      roles: { planner: null, engineer: null, scientist: null, comms: null },
      covered: {},
      votes: {},
      requests: [],
      crises: [],
      outcomes: {},
      agendas: {},
      botTimers: {},
      errors: {},
      last: { ok: true },
      stats: newStats(),
      design: null,
      catalog: null,
      resources: null,
      checks: [],
      run: null,
      ghost: null,
      flight: null,
      surface: null,
      ascent: null,
      debrief: null,
      summary: null,
      inputs: {},
    };
    if (isLocalMode(s)) {
      s.players.push({ id: 'local', name: 'Crew', token: null, connected: true, bot: false, goneAt: 0, pref: null });
      dealRoles(s);
    }
    return s;
  }

  // Enough to carry on after the host page reloads. The flight is left out:
  // fly() is deterministic, so restore() flies it again from seed and outcomes.
  function snapshot(state) {
    const { run, inputs, catalog, ...rest } = state;
    return JSON.parse(JSON.stringify(rest));
  }

  function restore(snap, now) {
    const gap = Math.max(0, now - (snap.now || now));
    const s = { ...clone(snap), inputs: {}, now, run: null, catalog: null };
    shiftTimes(s, gap); // the round was paused while the host was away
    // Nobody is here until they say hello again. Only the host's own seat comes back with the page.
    for (const p of s.players || []) {
      if (p.bot || p.id === 'local' || p.id === s.hostPlayer) continue;
      p.connected = false;
      p.goneAt = now;
    }
    if (s.design) s.catalog = attempt(() => sim().catalog(s.scenarioId, s.difficulty), null);
    if (s.flight || s.debrief) {
      const outcomes = Object.keys(s.outcomes || {}).length ? s.outcomes : undefined;
      s.run = attempt(() => sim().fly(s.design, s.seed, outcomes), null);
    }
    return s;
  }

  const api = {
    ROLES,
    BUTTONS,
    MAX_HUMANS,
    PLAYER_ACTIONS,
    REQUEST_PRESETS,
    TIMING,
    create,
    reduce,
    tick,
    viewFor,
    applyInput,
    decodeInput,
    surfaceInputs,
    snapshot,
    restore,
    hasSurface,
    useSim(s) {
      injectedSim = s;
    },
  };
  SMD.team.room = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
