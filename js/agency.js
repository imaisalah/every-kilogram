// The space agency career: money, reputation, research, teams, projects, the
// NASA-style life cycle (phases, reviews, reserves) and the calendar.
// Pure logic, no DOM. Screens read state and call these functions.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const D = SMD.data;
  const M = SMD.model;
  const O = SMD.ops;
  const { CAREER, CONTRACTS, TECH, TEST_PLANS, TESTS, SUBSYSTEMS, MISSIONS, OPTIONS } = D;

  // ---------- Calendar helpers ----------
  const monthStart = (ms) => {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  };
  const addMonths = (ms, n) => {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + Math.round(n), 1);
  };
  const monthsBetween = (a, b) => {
    const da = new Date(a);
    const db = new Date(b);
    return (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db.getUTCMonth() - da.getUTCMonth());
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // "Mar 2028", in the player's language once the UI has loaded (node tests
  // run without it and get English).
  const fmtMonth = (ms) => {
    if (SMD.ui && SMD.ui.monthYear) return SMD.ui.monthYear(ms);
    const d = new Date(ms);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  const ref = (k, e) => ({ k, e });

  // Strings go through SMD.t when it is loaded (the browser); node tests load
  // this file without it and get the English with its {placeholders} filled.
  const fill = (e, p) => (p ? String(e).replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : e);
  const tr = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : fill(e, p));

  // Cost confidence chosen in the proposal (NASA budgets at 70% confidence and
  // Discovery missions must hold at least a 25% reserve).
  // Most history events one project can meet during development.
  const EVENTS_MAX = 3;
  const EVENTS_EARTH = 2;

  const CONFIDENCE = {
    lean: { id: 'lean', name: 'Lean', reserve: 0.1, repBonus: 1, blurb: 'Ask for little. Reviewers love it, but any surprise becomes an overrun.' },
    standard: { id: 'standard', name: 'Standard', reserve: 0.25, repBonus: 0, blurb: 'The NASA rule: hold back a quarter for surprises.' },
    safe: { id: 'safe', name: 'Safe', reserve: 0.4, repBonus: 0, blurb: 'Plenty of reserve. Costs more money up front.' },
  };

  function newAgency(name, seed) {
    return {
      name: name || 'Nile Space Agency',
      seed: seed >>> 0,
      now: CAREER.start,
      money: CAREER.startMoney,
      rep: 0,
      science: CAREER.startScience || 0, // a seed grant: one first research choice

      teams: CAREER.startTeams,
      tech: [],
      projects: [],
      completed: {}, // missionKey -> best science score
      headlines: [],
      discoveries: [], // ids of unlocked real NASA discoveries
      log: [],
      nextId: 1,
      known: {},
      usedEvents: [],
    };
  }

  const has = (ag, techId) => ag.tech.includes(techId);

  // Which parts the agency can build with today.
  function parts(ag, missionKey) {
    const m = missionKey && MISSIONS[missionKey];
    const instruments = ['context', 'hires', 'irspec', 'neutron', 'sounder', 'mag', 'uso'];
    if (has(ag, 'iceRadar')) instruments.push('iceRadar');
    if (has(ag, 'sar')) instruments.push('sar');
    return {
      instruments,
      dish: [1, 2].concat(has(ag, 'dish3') ? [3] : []),
      amp: [25, 50].concat(has(ag, 'amp100') ? [100] : []),
      recorder: [64, 256].concat(has(ag, 'rec1t') ? [1024] : []),
      avionics: ['single'].concat(has(ag, 'dual') ? ['dual'] : []),
      // A mission with its own launchers (the crew stack) flies only those.
      launcher: m && m.launchers ? m.launchers.slice() : ['light', 'medium'].concat(has(ag, 'heavy') ? ['heavy'] : []),
      capture: ['propulsive'].concat(has(ag, 'aero') ? ['aerobrake'] : []),
      shield: [0].concat(has(ag, 'vault') ? [25, 75, 150] : []),
      rtg: has(ag, 'rtg') ? 3 : 0,
      margin: [0, 10, 20, 30],
      ground: [4, 8, 12],
    };
  }

  // Research upgrades baked into a design, and parts clamped to what is unlocked.
  function applyTech(ag, design) {
    design.cellBoost = has(ag, 'cells') ? 1.3 : 1;
    design.panelMass = has(ag, 'lightPanels') ? 0.6 : 1;
    const p = parts(ag, design.mission);
    if (!p.capture.includes(design.capture)) design.capture = 'propulsive';
    if (!p.launcher.includes(design.launcher)) design.launcher = p.launcher.includes('medium') ? 'medium' : p.launcher[0];
    if (!p.dish.includes(design.dish)) design.dish = 2;
    if (!p.amp.includes(design.amp)) design.amp = 50;
    if (!p.recorder.includes(design.recorder)) design.recorder = 256;
    if (!p.avionics.includes(design.avionics)) design.avionics = 'single';
    if (!p.shield.includes(design.shield)) design.shield = 0;
    if (design.rtg > p.rtg) design.rtg = p.rtg;
    design.instruments = design.instruments.filter((id) => p.instruments.includes(id));
    if (design.mission === 'jupiter' && !p.launcher.includes('heavy')) design.route = 'ega';
    return design;
  }

  function newDesign(ag, missionKey) {
    const name = D.STAR_NAMES[(ag.nextId * 7 + ag.seed) % D.STAR_NAMES.length];
    return applyTech(ag, M.defaultDesign(missionKey, name));
  }

  // 'open' | 'busy' | 'done' | 'locked' | 'needsTech'
  function contractState(ag, key) {
    const c = CONTRACTS[key];
    if (ag.projects.some((p) => p.missionKey === key && p.status !== 'done')) return 'busy';
    if (ag.completed[key] !== undefined && ag.completed[key] >= 70) return 'done';
    if (ag.rep < c.unlockRep) return 'locked';
    if (c.needsTech && !c.needsTech.every((t) => has(ag, t))) return 'needsTech';
    return 'open';
  }

  const busyTeams = (ag) => ag.projects.filter((p) => p.status === 'dev' || p.status === 'ready').length;
  const yearlyIncome = (ag) => CAREER.yearlyBase + CAREER.yearlyPerRep * ag.rep - (ag.budgetCut || 0);

  // Next launch windows for a destination (planets only), from today.
  function nextWindows(ag, missionKey, route) {
    const m = MISSIONS[missionKey];
    if (m.kind !== 'planet') return [];
    return M.windows(missionKey, route || (missionKey === 'jupiter' ? 'ega' : 'direct')).filter((w) => w.endMs >= ag.now);
  }

  // ---------- Planning ----------
  // Storage is paid for the months between "ready" and the launch. (The model
  // measures the wait from its own reference date, so settle it here.)
  function settleWait(ev, readyMs) {
    const L = ev && ev.launch;
    if (!L) return ev;
    L.waitMonths = Math.max(0, (L.launch.departMs - readyMs) / (30.44 * 864e5));
    L.storageCost = L.waitMonths * D.CONST.storagePerMonth;
    if (ev.cost) {
      ev.cost.total += L.storageCost - ev.cost.storage;
      ev.cost.storage = L.storageCost;
    }
    return ev;
  }

  // Cost, schedule and expected science for a design if it were approved now.
  function plan(ag, design, testPlanId, confidenceId) {
    const tp = TEST_PLANS.find((t) => t.id === (testPlanId || 'standard'));
    const conf = CONFIDENCE[confidenceId || 'standard'];
    const testCost = tp.tests.reduce((s, id) => s + TESTS.find((t) => t.id === id).cost, 0);
    const testMonths = tp.tests.reduce((s, id) => s + TESTS.find((t) => t.id === id).months, 0);
    const base = M.computeBase(design);
    const overload = Math.max(0, busyTeams(ag) + 1 - ag.teams);
    const devMonths = Math.ceil(base.devMonths * (1 + 0.35 * overload) + testMonths);
    const readyMs = addMonths(ag.now, devMonths);
    const ev = settleWait(M.evaluate(design, null, { readyMs }), readyMs);
    const L = ev.launch;
    const hardware = ev.cost.hardware;
    const ops = L ? L.opsCost : 0;
    const launcher = L ? L.launcherCost : 0;
    const storage = L ? L.storageCost : 0;
    const build = hardware + testCost + storage;
    const reserve = build * conf.reserve;
    const total = build + reserve + launcher + ops;
    // Chance at least one hidden flaw slips through testing.
    const detect = (sub) => {
      let miss = 1;
      tp.tests.forEach((id) => {
        const p = (TESTS.find((t) => t.id === id).covers[sub] || 0) * (has(ag, 'testlab') ? 1.15 : 1);
        miss *= 1 - Math.min(0.97, p);
      });
      return miss;
    };
    let pClean = 1;
    Object.entries(base.risk).forEach(([sub, p]) => (pClean *= 1 - p * detect(sub)));
    Object.values(base.instRisk).forEach((p) => (pClean *= 1 - p * detect('instrument')));
    return {
      design,
      testPlan: tp,
      confidence: conf,
      base,
      ev,
      launch: L,
      readyMs,
      devMonths,
      overload,
      cost: { hardware, tests: testCost, storage, build, reserve, launcher, ops, total },
      expected: ev.science,
      riskAnyFlaw: 1 - pClean,
      snowball: L ? M.snowball(design, ev) : null,
    };
  }

  // When the planned science phase ends (before any surprises in flight).
  const scienceEndMs = (m, L) => L.scienceStartMs + m.turns * m.turnDays * 864e5;

  // Requirement checks shown while designing: { id, ok: 'ok'|'warn'|'bad', label, detail }.
  function checks(ag, pl) {
    const t = tr;
    const { design, base, launch: L, expected, cost } = pl;
    const m = base.mission;
    const key = m.objectives.find((o) => o.key);
    const out = [];
    // The crew mission's key goal (bring the crew home) needs no instrument.
    const keyOk = !Object.keys(key.instruments || {}).length || design.instruments.some((id) => key.instruments[id]);
    const goal = t('mission.' + m.key + '.obj.' + key.id, key.label);
    out.push({
      id: 'science',
      ok: keyOk ? 'ok' : 'bad',
      label: t('check.science', 'Headline instrument'),
      detail: keyOk ? t('check.science.ok', 'Carries an instrument for “{goal}”', { goal }) : t('check.science.bad', 'Add an instrument for “{goal}”', { goal }),
    });
    if (!L) out.push({ id: 'lift', ok: 'bad', label: t('check.lift', 'Rocket can lift it'), detail: t('check.lift.none', 'No launch possible') });
    else {
      const r = L.wet / L.capacity;
      out.push({
        id: 'lift',
        ok: r > 1 ? 'bad' : r > 0.92 ? 'warn' : 'ok',
        label: t('check.lift', 'Rocket can lift it'),
        detail: t('check.lift.detail', '{wet} kg of the {cap} kg this rocket can lift', { wet: Math.round(L.wet), cap: Math.round(L.capacity) }),
      });
    }
    const pm = base.powerMargin;
    out.push({
      id: 'power',
      ok: pm < 0.95 ? 'bad' : pm < 1.15 ? 'warn' : 'ok',
      label: t('check.power', 'Power where it works'),
      detail: t('check.power.detail', 'Makes {make} W, needs {need} W', { make: Math.round(base.powerAvail), need: Math.round(base.powerReq) }),
    });
    const sci = expected ? expected.total : 0;
    out.push({
      id: 'data',
      ok: expected && expected.headline ? 'ok' : sci >= 40 ? 'warn' : 'bad',
      label: t('check.data', 'Science returned'),
      detail: t('check.data.detail', 'About {pts} of 100 points if nothing breaks', { pts: Math.round(sci) }),
    });
    // Can we pay for it by launch day? The bank, plus the budget years until
    // launch, minus what the other projects still owe before their launches.
    // (Operations are paid month by month after launch.)
    const owed = ag.projects.filter((p) => p.status === 'dev' || p.status === 'ready').reduce((s, p) => s + (p.devLeft || 0) + (p.launcherCost || 0), 0);
    const toLaunch = L ? Math.max(1, monthsBetween(ag.now, L.launch.departMs)) : 12;
    const due = cost.build + cost.reserve + cost.launcher;
    const free = ag.money - owed;
    const afford = free + (yearlyIncome(ag) * toLaunch) / 12;
    out.push({
      id: 'money',
      ok: due > afford ? 'bad' : due > free ? 'warn' : 'ok',
      label: t('check.money', 'Budget'),
      detail:
        due > afford
          ? t('check.money.short', '${due}M due by launch, only about ${afford}M free by then', { due: Math.round(due), afford: Math.round(Math.max(0, afford)) })
          : t('check.money.detail', '${total}M with reserve, you have ${have}M', { total: Math.round(cost.total), have: Math.round(ag.money) }),
    });
    out.push({
      id: 'risk',
      ok: pl.riskAnyFlaw > 0.6 ? 'bad' : pl.riskAnyFlaw > 0.35 ? 'warn' : 'ok',
      label: t('check.risk', 'Reliability'),
      detail: t('check.risk.detail', '{pct}% chance a hidden flaw slips through', { pct: Math.round(pl.riskAnyFlaw * 100) }),
    });
    if (m.kind === 'crew' && M.crewChecks) out.push(...M.crewChecks(design, base));
    // Science that ends after the career is over never reaches the results screen.
    const late = L && scienceEndMs(m, L) > CAREER.end;
    if (L && late) {
      out.push({
        id: 'window',
        ok: 'bad',
        label: t('check.window', 'Launch window'),
        detail: t('check.window.late', 'Launches {launch}, science ends {end}: after the end of 2036', { launch: fmtMonth(L.launch.departMs), end: fmtMonth(scienceEndMs(m, L)) }),
      });
    } else if (L && m.kind === 'planet') {
      const wait = L.waitMonths;
      out.push({
        id: 'window',
        ok: wait > 18 ? 'bad' : wait > 8 ? 'warn' : 'ok',
        label: t('check.window', 'Launch window'),
        detail: t('check.window.detail', 'Ready {ready}, launches {launch}', { ready: fmtMonth(pl.readyMs), launch: fmtMonth(L.launch.departMs) }),
      });
    }
    return out;
  }

  // ---------- Approval ----------
  // Tests run now; their findings stay hidden until the mission flies.
  function approve(ag, design, testPlanId, confidenceId) {
    const pl = plan(ag, design, testPlanId, confidenceId);
    if (busyTeams(ag) >= ag.teams) return { ok: false, why: 'busy', text: 'All engineering teams are busy.' };
    if (ag.money < pl.cost.build * 0.25) return { ok: false, why: 'money', text: 'You need at least a quarter of the build cost in the bank to start.' };
    if (!pl.launch || pl.launch.launchMargin < 0) return { ok: false, why: 'lift', text: 'The rocket cannot lift this spacecraft.' };
    const seed = (ag.seed + ag.nextId * 7919) >>> 0;
    const flaws = O.generateFlaws(design, pl.base, seed);
    let runIndex = 0;
    let fixCost = 0;
    let fixMonths = 0;
    pl.testPlan.tests.forEach((id) => {
      O.runTest(flaws, id, seed, runIndex++);
      if (has(ag, 'testlab')) O.runTest(flaws, id, seed + 1, runIndex++);
    });
    flaws.forEach((f) => {
      if (f.detected) {
        f.fixed = true;
        fixCost += SUBSYSTEMS[f.sub].fix.cost;
        fixMonths += SUBSYSTEMS[f.sub].fix.months;
      }
    });
    const readyMs = addMonths(pl.readyMs, Math.ceil(fixMonths));
    const ev = settleWait(M.evaluate(design, null, { readyMs }), readyMs);
    const L = ev.launch;
    const build = pl.cost.hardware + pl.cost.tests + fixCost + (L ? L.storageCost : 0);
    const devMonths = Math.max(1, monthsBetween(ag.now, readyMs));
    const p = {
      id: ag.nextId++,
      missionKey: design.mission,
      design: JSON.parse(JSON.stringify(design)),
      testPlan: pl.testPlan.id,
      confidence: pl.confidence.id,
      flaws,
      seed,
      status: 'dev', // dev -> ready -> flying -> done
      phase: 'B', // B, C, D (development), E (operations), F (done)
      startMs: ag.now,
      readyMs,
      launchMs: L.launch.departMs,
      arriveMs: L.launch.arriveMs,
      launch: L.launch,
      buildCost: build,
      devMonthly: build / devMonths,
      devLeft: build,
      reserve: build * pl.confidence.reserve,
      reserveLeft: build * pl.confidence.reserve,
      overrun: 0,
      launcherCost: L.launcherCost,
      opsMonthly: L.opsCost / Math.max(1, L.missionYears * 12),
      fixCost,
      fixMonths,
      expected: ev.science ? ev.science.total : 0,
      reviews: { PDR: null, CDR: null, FRR: null },
      events: scheduleEvents(ag, design, seed, ag.now, readyMs),
      healthMods: {},
      result: null,
    };
    ag.projects.push(p);
    log(ag, 'agency.log.approved', 'Approved {name} for {mission}. Launch planned for {month}.', { name: p.design.name, mission: ref('mission.' + p.missionKey + '.title', MISSIONS[p.missionKey].title), month: { ms: p.launchMs } });
    return { ok: true, project: p };
  }

  // Pre-roll which history-based events will happen to this project, and when.
  function scheduleEvents(ag, design, seed, startMs, readyMs) {
    const list = (SMD.content && SMD.content.events) || [];
    const r = O.rng(seed + 991);
    const kind = MISSIONS[design.mission].kind;
    const span = Math.max(1, monthsBetween(startMs, readyMs));
    const out = [];
    list.forEach((e) => {
      if (e.when && e.when.kinds && !e.when.kinds.includes(kind)) return;
      if (e.when && e.when.needs && !e.when.needs(design)) return;
      if (ag.usedEvents && ag.usedEvents.includes(e.id) && e.once !== false) return;
      if (r() >= (e.chance || 0.2)) return;
      // Phase B ~ first third, C ~ middle, D ~ last third, E = after launch.
      const frac = { A: 0.05, B: 0.2, C: 0.5, D: 0.85 }[e.phase] ?? 0.5;
      const atMs = e.phase === 'E' ? null : addMonths(startMs, Math.max(1, Math.round(span * frac + (r() - 0.5) * span * 0.2)));
      out.push({ id: e.id, phase: e.phase, atMs, resolved: false });
    });
    // Shuffle so events late in the list get their turn too.
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    // Small Earth satellites get fewer surprises, so the first launch comes sooner.
    return out.slice(0, kind === 'earth' ? EVENTS_EARTH : EVENTS_MAX);
  }

  // ---------- Effects (events, reviews) ----------
  // effects: { money, months, rep, science, reserve, hiddenFlaw, instrumentQuality, dropInstrument, scienceBoost }
  // "2 months slip": screens drop this note when they show the new launch date.
  const slipNote = (n) => (n > 1 ? tr('agency.note.slips', '{n} months slip', { n }) : tr('agency.note.slip', '{n} month slip', { n }));
  function isSlipNote(text) {
    const s = String(text);
    return [tr('agency.note.slips', '{n} months slip'), tr('agency.note.slip', '{n} month slip')].some((tpl) => {
      const [pre, post = ''] = tpl.split('{n}');
      return s.length > pre.length + post.length && s.startsWith(pre) && s.endsWith(post) && /^[0-9.]+$/.test(s.slice(pre.length, s.length - post.length));
    });
  }

  function applyEffects(ag, p, fx) {
    const notes = [];
    if (!fx) return notes;
    if (fx.money) {
      const cost = -fx.money; // positive = spend
      if (cost > 0 && p) {
        const fromReserve = Math.min(p.reserveLeft, cost);
        p.reserveLeft -= fromReserve;
        const over = cost - fromReserve;
        if (over > 0) {
          p.overrun += over;
          notes.push(tr('agency.note.over', '${m}M beyond the reserve', { m: Math.round(over) }));
        }
      }
      ag.money -= cost;
    }
    if (fx.months && p) {
      p.readyMs = addMonths(p.readyMs, fx.months);
      replanLaunch(ag, p);
      notes.push(slipNote(fx.months));
    }
    if (fx.rep) ag.rep = Math.max(0, ag.rep + fx.rep);
    if (fx.science) ag.science += fx.science;
    if (fx.hiddenFlaw && p) {
      const inst = fx.hiddenFlaw === 'instrument' ? p.design.instruments[0] || null : null;
      if (fx.hiddenFlaw !== 'instrument' || inst) p.flaws.push({ uid: `${fx.hiddenFlaw}-event-${p.flaws.length}`, sub: fx.hiddenFlaw, inst, detected: false, fixed: false, fromEvent: true });
    }
    if (fx.reserve && p) {
      const c = Math.abs(fx.reserve);
      const fromReserve = Math.min(p.reserveLeft, c);
      p.reserveLeft -= fromReserve;
      p.overrun += c - fromReserve;
      ag.money -= c;
    }
    if (fx.instrumentQuality && p) Object.entries(fx.instrumentQuality).forEach(([id, f]) => (p.healthMods[id] = (p.healthMods[id] || 1) * f));
    if (fx.dropInstrument && p) p.design.instruments = p.design.instruments.filter((id) => id !== fx.dropInstrument);
    if (fx.scienceBoost && p) p.scienceBoost = (p.scienceBoost || 1) * fx.scienceBoost;
    // Congress gets notified past 15% cost growth.
    if (p && p.overrun > p.buildCost * 0.15 && !p.breach) {
      p.breach = true;
      ag.rep = Math.max(0, ag.rep - 1);
      notes.push(tr('agency.note.breach', 'Cost growth passed 15%: Congress is notified (reputation −1)'));
    }
    return notes;
  }

  // After a slip, find the next launch the spacecraft can make.
  function replanLaunch(ag, p) {
    if (p.status === 'flying' || p.status === 'done') return;
    const ev = M.evaluate(p.design, null, { readyMs: p.readyMs });
    if (!ev.launch) return;
    const before = p.launchMs;
    p.launch = ev.launch.launch;
    p.launchMs = p.launch.departMs;
    p.arriveMs = p.launch.arriveMs;
    p.launcherCost = ev.launch.launcherCost;
    p.opsMonthly = ev.launch.opsCost / Math.max(1, ev.launch.missionYears * 12);
    if (p.launchMs - before > 200 * 864e5) {
      const wait = Math.max(0, monthsBetween(before, p.launchMs));
      const storage = wait * D.CONST.storagePerMonth;
      ag.money -= storage;
      p.overrun += storage;
      // A missed planetary window costs storage and face (GDD 4.4), not the mission.
      if (!p.missedWindow) {
        ag.rep = Math.max(0, ag.rep - 1);
        if (p.overrun > p.buildCost * 0.15) p.breach = true; // one reputation hit for one slip, not two
      }
      log(ag, 'agency.log.missed', '{name} missed its launch window. Next one: {month} (storage +${m}M, reputation −1).', { name: p.design.name, month: { ms: p.launchMs }, m: Math.round(storage) });
      p.missedWindow = true;
    }
  }

  function resolveEvent(ag, p, eventId, choiceId) {
    const list = (SMD.content && SMD.content.events) || [];
    const e = list.find((x) => x.id === eventId);
    const slot = p.events.find((x) => x.id === eventId);
    if (slot && !e) slot.resolved = true; // content removed: never block the calendar
    if (!e || !slot || slot.resolved) return null;
    const choice = e.choices.find((c) => c.id === choiceId) || e.choices[0];
    slot.resolved = true;
    slot.choice = choice.id;
    ag.usedEvents.push(e.id);
    const notes = applyEffects(ag, p, choice.effects);
    log(ag, 'agency.log.event', '{name}: {event}. {choice}.', { name: p.design.name, event: ref(`content.events.${e.id}.title`, e.title), choice: ref(`content.events.${e.id}.choice.${choice.id}`, choice.label) });
    return { event: e, choice, notes };
  }

  // ---------- Reviews ----------
  // Questions for a review, generated from the project's state.
  function reviewQuestions(ag, p, review) {
    const t = tr;
    const pl = plan({ ...ag, now: p.startMs, projects: [] }, p.design, p.testPlan, p.confidence);
    const qs = [];
    const base = pl.base;
    if (base.powerMargin < 1.2)
      qs.push({
        id: 'power',
        who: 'systems',
        text: t('rev.power', 'Power margin is {pct}%. Engineers want 20% for ageing panels. What do we do?', { pct: Math.round((base.powerMargin - 1) * 100) }),
        options: [
          { id: 'fix', label: t('rev.power.fix', 'Add panel area (+$6M, +1 month)'), effects: { money: -6, months: 1 }, mod: { arrays: Math.ceil(p.design.arrays * 0.2) + 1 } },
          { id: 'accept', label: t('rev.power.accept', 'Accept: instruments will share power'), effects: {} },
        ],
      });
    const unfixedKnown = p.flaws.filter((f) => !f.fixed && !f.detected).length;
    if (review !== 'PDR' && p.testPlan === 'basic')
      qs.push({
        id: 'tests',
        who: 'safety',
        text: t('rev.tests', 'We only planned basic checks. Hidden flaws could be waiting. Add a test campaign?'),
        options: [
          { id: 'test', label: t('rev.tests.yes', 'Run the standard tests now (+$20M, +3 months)'), effects: { money: -20, months: 3 }, runTests: 'standard' },
          { id: 'skip', label: t('rev.tests.no', 'No time. Fly as is'), effects: {} },
        ],
      });
    if (p.reserveLeft < p.reserve * 0.3 && p.reserve > 0)
      qs.push({
        id: 'reserve',
        who: 'budget',
        text: t('rev.reserve', 'Only ${left}M of the reserve is left. Cut something to protect it?', { left: Math.round(p.reserveLeft) }),
        options: [
          { id: 'descope', label: t('rev.reserve.descope', 'Shorten operations (saves $15M, less science)'), effects: { money: 15, scienceBoost: 0.9 } },
          { id: 'keep', label: t('rev.reserve.keep', 'Keep the full mission'), effects: {} },
        ],
      });
    // Crew-safety questions come first on a crewed mission.
    if (M.crewReviewQuestions) qs.unshift(...M.crewReviewQuestions(p, review));
    if (review === 'FRR')
      qs.push({
        id: 'go',
        who: 'science',
        text: t('rev.frr', 'Flight Readiness Review: every team lead votes Go or No-Go. Launch {date}?', { date: fmtMonth(p.launchMs) }),
        options: [
          { id: 'go', label: t('rev.frr.go', 'Go for launch'), effects: {} },
          { id: 'hold', label: t('rev.frr.hold', 'Hold one month for a last full check (+$5M)'), effects: { money: -5, months: 1 }, runTests: 'recheck' },
        ],
      });
    if (!qs.length)
      qs.push({
        id: 'pass',
        who: 'systems',
        text: t('rev.clean', 'The board finds no major issues. Proceed?'),
        options: [{ id: 'ok', label: t('rev.clean.ok', 'Proceed'), effects: {} }],
      });
    // The FRR always ends with the Go/No-Go question.
    const go = qs.find((q) => q.id === 'go');
    return go ? [...qs.filter((q) => q !== go).slice(0, 2), go] : qs.slice(0, 3);
  }

  function resolveReview(ag, p, review, answers) {
    const qs = reviewQuestions(ag, p, review);
    const notes = [];
    qs.forEach((q) => {
      const opt = q.options.find((o) => o.id === answers[q.id]) || q.options[q.options.length - 1];
      if (opt.mod) Object.assign(p.design, Object.fromEntries(Object.entries(opt.mod).map(([k, v]) => [k, p.design[k] + v])));
      if (opt.runTests) runExtraTests(ag, p, opt.runTests);
      notes.push(...applyEffects(ag, p, opt.effects));
    });
    p.reviews[review] = { at: ag.now, answers };
    log(ag, 'agency.log.review', '{name}: {review} passed.', { name: p.design.name, review });
    return { notes };
  }

  function runExtraTests(ag, p, which) {
    const ids = which === 'recheck' ? ['tvac', 'ditl'] : TEST_PLANS.find((t) => t.id === which).tests;
    let k = 100 + (p.extraTestRuns || 0);
    ids.forEach((id) => O.runTest(p.flaws, id, p.seed, k++));
    p.extraTestRuns = k - 100;
    p.flaws.forEach((f) => {
      if (f.detected && !f.fixed) {
        f.fixed = true;
        applyEffects(ag, p, { money: -SUBSYSTEMS[f.sub].fix.cost });
      }
    });
  }

  // ---------- Flight ----------
  function fly(ag, p) {
    const ev = M.evaluate(p.design, p.launch, { readyMs: p.readyMs });
    const r = O.autoFlight(p.design, ev, p.flaws, p.seed, { instQuality: p.healthMods, scienceBoost: p.scienceBoost, launchStress: p.launchStress });
    p.ev = ev;
    p.flight = r;
    p.endMs = r.fs.lost ? p.launchMs : addMonths(r.fs.scienceEndMs || p.arriveMs, 1);
    return r;
  }

  const flightLost = (p) => !!(p.flight && (p.flight.fs ? p.flight.fs.lost : p.flight.lost));

  // ---------- Advance the calendar ----------
  // Returns events: income, phase, review, event, ready, launch, arrival, complete, unlock, broke.
  function advance(ag) {
    const events = [];
    ag.now = addMonths(ag.now, 1);
    if (new Date(ag.now).getUTCMonth() === 0) {
      const inc = yearlyIncome(ag);
      ag.money += inc;
      events.push({ type: 'income', amount: inc });
      log(ag, 'agency.log.income', 'New budget year: +${m}M from the government.', { m: inc });
    }
    ag.projects.forEach((p) => {
      if (p.status === 'dev') {
        if (ag.money <= 0) {
          p.readyMs = addMonths(p.readyMs, 1); // no money: the team waits
          replanLaunch(ag, p);
          return;
        }
        const pay = Math.min(p.devLeft, p.devMonthly);
        ag.money -= pay;
        p.devLeft -= pay;
        // Phases and reviews by schedule progress.
        const total = Math.max(1, monthsBetween(p.startMs, p.readyMs));
        const done = monthsBetween(p.startMs, ag.now) / total;
        const phase = done < 0.35 ? 'B' : done < 0.75 ? 'C' : 'D';
        if (phase !== p.phase) {
          const review = p.phase === 'B' ? 'PDR' : 'CDR';
          p.phase = phase;
          events.push({ type: 'phase', project: p, phase });
          if (!p.reviews[review]) events.push({ type: 'review', project: p, review });
        }
        const known = (SMD.content && SMD.content.events) || [];
        p.events.forEach((slot) => {
          if (slot.resolved || !slot.atMs || ag.now < slot.atMs) return;
          if (!known.some((e) => e.id === slot.id)) slot.resolved = true;
          else events.push({ type: 'event', project: p, eventId: slot.id });
        });
        if (ag.now >= p.readyMs) {
          p.status = 'ready';
          events.push({ type: 'ready', project: p });
          if (!p.reviews.FRR) events.push({ type: 'review', project: p, review: 'FRR' });
        }
      } else if (p.status === 'flying') {
        ag.money -= p.opsMonthly;
      }
    });
    if (ag.money < 0) events.push({ type: 'broke', money: ag.money });
    ag.projects.forEach((p) => {
      if (p.status === 'ready' && ag.now >= monthStart(p.launchMs) && p.reviews.FRR) {
        ag.money -= p.launcherCost + p.devLeft;
        p.devLeft = 0;
        // Unused reserve comes back (IMAP returned $22.2M this way).
        if (p.reserveLeft > 0) {
          ag.money += 0; // reserve was never spent from the bank
          if (p.reserveLeft >= p.reserve * 0.5 && p.reserve > 0) {
            p.reserveReturned = true;
            ag.rep += 0;
          }
        }
        fly(ag, p);
        p.status = 'flying';
        p.phase = 'E';
        p.launchedAt = ag.now; // the month it really went (an FRR answered late moves it)
        events.push({ type: 'launch', project: p });
        const lv = OPTIONS.launcher.find((o) => o.id === p.design.launcher);
        log(ag, 'agency.log.launched', '{name} launched on a {launcher}.', { name: p.design.name, launcher: ref('design.opt.launcher.' + p.design.launcher, lv ? lv.name.toLowerCase() : `${p.design.launcher} launcher`) });
        if (flightLost(p)) complete(ag, p, events);
      } else if (p.status === 'flying') {
        if (!p.arrived && ag.now >= monthStart(p.arriveMs)) {
          p.arrived = true;
          if (MISSIONS[p.missionKey].kind !== 'earth') events.push({ type: 'arrival', project: p });
        }
        if (ag.now >= p.endMs) complete(ag, p, events);
      }
    });
    Object.keys(CONTRACTS).forEach((k) => {
      const st = contractState(ag, k);
      if (!ag.known[k] && st === 'open') events.push({ type: 'unlock', missionKey: k });
      ag.known[k] = st === 'open' || st === 'busy' || st === 'done';
    });
    return events;
  }

  function complete(ag, p, events) {
    p.status = 'done';
    p.phase = 'F';
    const c = CONTRACTS[p.missionKey];
    const sc = p.flight.score;
    const lost = flightLost(p);
    const f = sc.total / 100;
    const success = sc.headline;
    const conf = CONFIDENCE[p.confidence] || CONFIDENCE.standard;
    // What this completion changed, so launch day can take it back and re-fly.
    const rep0 = ag.rep;
    const prevCompleted = ag.completed[p.missionKey];
    const hadHeadline = ag.headlines.includes(p.missionKey);
    const reward = {
      rep: lost ? (c.lostRep !== undefined ? c.lostRep : -1) : (success ? c.reward.rep : sc.total >= 40 ? Math.ceil(c.reward.rep / 2) : 0) + (success && !p.breach ? conf.repBonus : 0),
      science: Math.round(c.reward.science * f),
      money: Math.round(c.reward.money * (success ? 1 : f * 0.5)),
    };
    ag.rep = Math.max(0, ag.rep + reward.rep);
    ag.science += reward.science;
    ag.money += reward.money;
    ag.completed[p.missionKey] = Math.max(ag.completed[p.missionKey] || 0, sc.total);
    if (success && c.headline && !ag.headlines.includes(p.missionKey)) ag.headlines.push(p.missionKey);
    // Real NASA discoveries unlocked by how much science came back.
    const disc = ((SMD.content && SMD.content.discoveries && SMD.content.discoveries[p.missionKey]) || []).filter((x) => sc.total >= (x.minScore || 0));
    const newDisc = disc.filter((x) => !ag.discoveries.includes(x.id)).map((x) => x.id);
    disc.forEach((x) => !ag.discoveries.includes(x.id) && ag.discoveries.push(x.id));
    const applied = { rep: ag.rep - rep0, science: reward.science, money: reward.money, completed: prevCompleted === undefined ? null : prevCompleted, headline: !hadHeadline && ag.headlines.includes(p.missionKey), disc: newDisc };
    p.result = { score: sc, lost, reward, success, discoveries: disc.map((x) => x.id), applied };
    events.push({ type: 'complete', project: p });
    const repTxt = `${reward.rep >= 0 ? '+' : ''}${reward.rep}`;
    if (lost) log(ag, 'agency.log.lost', '{name}: lost. Reputation {rep}.', { name: p.design.name, rep: repTxt });
    else log(ag, 'agency.log.score', '{name}: {pts} science points. Reputation {rep}.', { name: p.design.name, pts: Math.round(sc.total), rep: repTxt });
  }

  // ---------- Launch day (js/screen-launchday.js) ----------
  // advance() flies the mission the month the rocket goes, before any screen
  // shows it. Launch day is played after that, so its decisions are applied
  // here and the flight is flown again with the same luck: only what the
  // player did at the pad and in mission control changes the result.
  // A scrubbed day costs propellant, crews and range time ($M per day).
  const SCRUB_COST = { light: 1, medium: 2, heavy: 3 };
  const scrubCost = (p) => SCRUB_COST[p && p.design && p.design.launcher] || 2;
  const padFixCost = (f) => (f && SUBSYSTEMS[f.sub] ? SUBSYSTEMS[f.sub].fix.cost : 5);
  const PAD_FIX_DAYS = 2;

  // True once, the month the project launched, before launch day was played.
  function launchDayOpen(ag, p) {
    if (!ag || !p || p.launchDay || !p.flight || !p.launchMs) return false;
    const lostAtLaunch = p.status === 'done' && flightLost(p) && p.endMs === p.launchMs;
    if (p.status !== 'flying' && !lostAtLaunch) return false;
    if (p.launchedAt !== undefined) return p.launchedAt === ag.now;
    // Saves from before launchedAt: soon after the planned launch month.
    const since = monthsBetween(monthStart(p.launchMs), ag.now);
    return since >= 0 && since <= 2 && !p.arrived;
  }

  // Take back what complete() gave, so the mission can be flown again.
  function uncomplete(ag, p) {
    const r = p.result;
    if (!r) return;
    const u = r.applied || { rep: r.reward ? r.reward.rep : 0, science: r.reward ? r.reward.science : 0, money: r.reward ? r.reward.money : 0, headline: false, disc: [] };
    ag.rep = Math.max(0, ag.rep - (u.rep || 0));
    ag.science -= u.science || 0;
    ag.money -= u.money || 0;
    if ('completed' in u) {
      if (u.completed === null) delete ag.completed[p.missionKey];
      else ag.completed[p.missionKey] = u.completed;
    }
    if (u.headline) ag.headlines = ag.headlines.filter((k) => k !== p.missionKey);
    (u.disc || []).forEach((id) => {
      const i = ag.discoveries.indexOf(id);
      if (i >= 0) ag.discoveries.splice(i, 1);
    });
    const li = ag.log.findIndex((l) => (l.key === 'agency.log.lost' || l.key === 'agency.log.score') && l.params && l.params.name === p.design.name);
    if (li >= 0) ag.log.splice(li, 1);
    p.result = null;
  }

  // opts: { found: [flaw uid] spotted at the walkdown, fixed: [flaw uid] fixed
  // at the pad, scrubDays (scrubs plus pad-fix days), weatherRisk 0..1 (how far
  // past the weather and debris rules it flew: a rougher ride), lightning
  // (launched against the lightning rules) }.
  // Returns { ok, cost, strike: null|'hit'|'lost', lost, events } where events
  // holds { type: 'complete', project } when the mission is now lost at launch.
  function launchDay(ag, p, opts = {}) {
    if (!launchDayOpen(ag, p)) return { ok: false, cost: 0, strike: null, lost: flightLost(p), events: [] };
    const events = [];
    const found = new Set(opts.found || []);
    const fix = new Set(opts.fixed || []);
    let cost = 0;
    const fixedFlaws = [];
    const knownFlaws = [];
    p.flaws.forEach((f) => {
      if ((found.has(f.uid) || fix.has(f.uid)) && !f.detected) {
        f.detected = true;
        f.foundBy = 'walkdown';
      }
      if (fix.has(f.uid) && !f.fixed) {
        f.fixed = true;
        cost += padFixCost(f);
        fixedFlaws.push(f);
      } else if (found.has(f.uid) && !f.fixed) knownFlaws.push(f);
    });
    const scrubDays = Math.max(0, Math.round(Number(opts.scrubDays) || 0));
    cost += scrubDays * scrubCost(p);
    const risk = Math.max(0, Math.min(1, Number(opts.weatherRisk) || 0));
    // ops reads launch stress: above 0.5 a cracked bracket fails, above 0.75
    // even a sound mount can crack (0.2 is a normal ride).
    p.launchStress = Math.min(0.95, 0.2 + 0.7 * risk);
    // Launching against the lightning rules: same luck every time for this
    // project. Apollo 12 was struck twice and flew on; Atlas-Centaur 67 was
    // destroyed by triggered lightning in 1987.
    let strike = null;
    let strikeInst = null;
    if (opts.lightning) {
      const r = O.rng((p.seed ^ 0x5a17) >>> 0);
      if (r() < 0.5) strike = r() < 0.35 ? 'lost' : 'hit';
      if (strike === 'hit' && p.design.instruments.length) {
        strikeInst = p.design.instruments[Math.floor(r() * p.design.instruments.length) % p.design.instruments.length];
        p.healthMods[strikeInst] = (p.healthMods[strikeInst] || 1) * 0.6;
      }
    }
    p.launchDay = {
      at: ag.now,
      found: [...found],
      fixed: fixedFlaws.map((f) => f.uid),
      scrubDays,
      weatherRisk: risk,
      lightning: !!opts.lightning,
      strike,
      strikeInst,
      cost: Math.round(cost * 10) / 10,
    };
    if (cost > 0) applyEffects(ag, p, { money: -cost });

    // Fly again.
    if (p.status === 'done') uncomplete(ag, p);
    p.flaws.forEach((f) => delete f.manifested);
    const r = fly(ag, p);
    const m = MISSIONS[p.missionKey];
    const L = p.launch;
    if (strike === 'lost') {
      const text = tr('agency.ld.strike.lost', 'Lightning struck the rocket 36 seconds after liftoff. Its guidance computer failed and the range safety officer destroyed it. Mission lost.');
      r.fs.lost = true;
      r.sci = null;
      r.score = { total: 0, fractions: Object.fromEntries(m.objectives.map((o) => [o.id, 0])), keyFrac: 0, headline: false };
      r.fs.manifested = [{ flaw: { sub: 'launch', uid: 'lightning' }, text: tr('agency.ld.strike.lostFlaw', 'Launched against the lightning rules: lightning destroyed the rocket on the way up.') }];
      r.timeline = [{ kind: 'departure', ms: L.departMs + 36e3, title: tr('agency.ld.strike.title', 'Lightning strike'), tone: 'bad', text }];
      p.endMs = p.launchMs;
    } else if (strike === 'hit') {
      const inst = strikeInst ? lower(tr('inst.' + strikeInst, D.INSTRUMENTS[strikeInst].name)) : '';
      const text = strikeInst
        ? tr('agency.ld.strike.hit', 'Lightning struck the rocket on the way up. The spacecraft survived, but the surge damaged the {inst}: it works at 60% from now on.', { inst })
        : tr('agency.ld.strike.hit0', 'Lightning struck the rocket on the way up. The spacecraft survived.');
      const check = r.timeline.find((e) => e.kind === 'checkout');
      if (check) Object.assign(check, { tone: 'bad', text });
      else r.timeline.unshift({ kind: 'checkout', ms: L.departMs + 864e5, title: tr('ops.checkout.title', 'Health check after launch'), tone: 'bad', text });
      r.fs.manifested.push({ flaw: { sub: 'launch', uid: 'lightning' }, text: tr('agency.ld.strike.hitFlaw', 'Launched against the lightning rules: a strike damaged the {inst}.', { inst }) });
    }
    p.status = 'flying';
    p.phase = 'E';
    const name = p.design.name;
    const subRef = (f) => ref(f.sub === 'instrument' && f.inst ? 'inst.' + f.inst : 'data.sub.' + f.sub, f.sub === 'instrument' && f.inst ? D.INSTRUMENTS[f.inst].name : SUBSYSTEMS[f.sub].name);
    if (scrubDays) log(ag, 'agency.log.ld.scrub', '{name}: {n} extra days at the pad (scrubs and fixes) cost ${m}M.', { name, n: scrubDays, m: Math.round(scrubDays * scrubCost(p)) });
    fixedFlaws.forEach((f) => log(ag, 'agency.log.ld.fix', '{name}: the launch-day walkdown caught a flaw in the {sub}. Fixed at the pad.', { name, sub: subRef(f) }));
    knownFlaws.forEach((f) => log(ag, 'agency.log.ld.known', '{name} launched with a known flaw in the {sub}.', { name, sub: subRef(f) }));
    if (risk > 0.05 || opts.lightning) log(ag, 'agency.log.ld.override', '{name} launched against the launch rules.', { name });
    if (strike) log(ag, 'agency.log.ld.strike', '{name}: lightning struck the rocket on the way up.', { name });
    if (flightLost(p)) complete(ag, p, events);
    return { ok: true, cost: p.launchDay.cost, strike, lost: flightLost(p), events };
  }

  // Months until something worth stopping for (for "skip to next event").
  function monthsToNextEvent(ag) {
    const times = [];
    ag.projects.forEach((p) => {
      if (p.status === 'dev') {
        times.push(p.readyMs, p.launchMs);
        p.events.forEach((s) => !s.resolved && s.atMs && times.push(s.atMs));
        const total = Math.max(1, monthsBetween(p.startMs, p.readyMs));
        times.push(addMonths(p.startMs, Math.ceil(total * 0.35)), addMonths(p.startMs, Math.ceil(total * 0.75)));
      }
      if (p.status === 'ready') times.push(p.launchMs);
      if (p.status === 'flying') {
        if (!p.arrived) times.push(p.arriveMs);
        times.push(p.endMs);
      }
    });
    times.push(Date.UTC(new Date(ag.now).getUTCFullYear() + 1, 0, 1));
    const future = times.filter((t) => t > ag.now).map((t) => Math.max(1, monthsBetween(ag.now, monthStart(t))));
    return future.length ? Math.min(...future) : 1;
  }

  // ---------- Research and teams ----------
  function buyTech(ag, id) {
    const t = TECH.find((x) => x.id === id);
    if (!t || has(ag, id) || ag.science < t.cost) return false;
    ag.science -= t.cost;
    ag.tech.push(id);
    log(ag, 'agency.log.research', 'Research done: {tech}.', { tech: ref('tech.' + t.id, t.name) });
    return true;
  }

  function hireTeam(ag) {
    if (ag.teams >= CAREER.maxTeams || ag.money < CAREER.hireTeamCost) return false;
    ag.money -= CAREER.hireTeamCost;
    ag.teams++;
    log(ag, 'agency.log.hired', 'A new engineering team joined the agency.');
    return true;
  }

  const isOver = (ag) => ag.now >= CAREER.end || ['mars', 'venus', 'jupiter'].every((k) => ag.headlines.includes(k));

  // What-if: rerun a finished mission with one design change (same luck).
  function whatIf(p, change) {
    const d2 = { ...p.design, ...change };
    const ev2 = M.evaluate(d2, p.launch, { readyMs: p.readyMs });
    if (!ev2.launch || ev2.launch.launchMargin < 0) return { feasible: false };
    // A rocket lost to lightning on launch day is lost in every what-if too.
    if (p.launchDay && p.launchDay.strike === 'lost') return { feasible: true, score: 0, lost: true };
    const flaws = JSON.parse(JSON.stringify(p.flaws));
    const r2 = O.autoFlight(d2, ev2, flaws, p.seed, { instQuality: p.healthMods, scienceBoost: p.scienceBoost, launchStress: p.launchStress });
    return { feasible: true, score: r2.score.total, lost: r2.fs.lost };
  }

  // English names sit mid-sentence in lower case; Arabic has no case.
  const lower = (s) => (SMD.lang && SMD.lang() === 'ar' ? s : s.toLowerCase());

  // Cause and effect lines for the results screen.
  function lessons(ag, p) {
    const t = tr;
    const out = [];
    if (!p.flight || !p.result) return out;
    const base = p.result.score.total;
    const tries = [];
    const d = p.design;
    if (d.dish < 3 && parts(ag).dish.includes(d.dish + 1)) tries.push({ change: { dish: d.dish + 1 }, text: (v) => t('lesson.dish', 'A {m} m dish would have returned {v} points instead of {b}.', { m: d.dish + 1, v, b: Math.round(base) }) });
    if (d.amp < 100 && parts(ag).amp.includes(d.amp * 2)) tries.push({ change: { amp: d.amp * 2 }, text: (v) => t('lesson.amp', 'A {w} W radio would have returned {v} points.', { w: d.amp * 2, v }) });
    if (d.ground < 12) tries.push({ change: { ground: d.ground + 4 }, text: (v) => t('lesson.ground', '{h} hours a day of antenna time would have returned {v} points.', { h: d.ground + 4, v }) });
    tries.push({ change: { arrays: d.arrays + Math.max(2, Math.round(d.arrays * 0.3)) }, text: (v) => t('lesson.arrays', '30% more solar panel area would have given {v} points.', { v }) });
    tries.push({ change: { margin: Math.min(30, d.margin + 10) }, text: (v) => t('lesson.margin', '10% more fuel margin would have given {v} points.', { v }) });
    tries.forEach((tr) => {
      const r = whatIf(p, tr.change);
      if (r.feasible && !r.lost && Math.abs(r.score - base) >= 3) out.push({ delta: r.score - base, text: tr.text(Math.round(r.score)) });
    });
    const manifested = p.flight.fs ? p.flight.fs.manifested : p.flight.manifested || [];
    manifested.forEach((m) => {
      const sub = m.flaw ? m.flaw.sub : m.sub;
      const best = sub && O.bestTestFor(sub);
      out.push({ delta: -10, text: `${m.text}${best ? ' ' + t('lesson.test', 'A {test} catches about {p}% of flaws like this.', { test: lower(t('data.test.' + best.test.id, best.test.name)), p: Math.round(best.p * 100) }) : ''}` });
    });
    return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
  }

  // News lines keep their key and parameters so they read in the player's
  // language: `text` follows the language live, and a save keeps the text of
  // the moment beside the key. Parameter values are plain, a translated name
  // { k, e } or a month { ms }. Old saves hold only { ms, text }.
  function logText(l) {
    if (!l) return '';
    if (!l.key) return l.text || '';
    const params = {};
    Object.entries(l.params || {}).forEach(([k, v]) => (params[k] = v && typeof v === 'object' ? (v.ms !== undefined ? fmtMonth(v.ms) : tr(v.k, v.e)) : v));
    return tr(l.key, l.en, params);
  }
  function log(ag, key, en, params) {
    const entry = { ms: ag.now, key, en, params: params || {} };
    Object.defineProperty(entry, 'text', { get: () => logText(entry), enumerable: true, configurable: true });
    ag.log.unshift(entry);
    if (ag.log.length > 200) ag.log.length = 200;
  }

  SMD.agency = {
    CONFIDENCE,
    newAgency,
    parts,
    applyTech,
    newDesign,
    contractState,
    busyTeams,
    nextWindows,
    plan,
    checks,
    approve,
    advance,
    resolveEvent,
    reviewQuestions,
    resolveReview,
    monthsToNextEvent,
    buyTech,
    hireTeam,
    isOver,
    whatIf,
    lessons,
    logText,
    isSlipNote,
    yearlyIncome,
    addMonths,
    monthsBetween,
    fmtMonth,
    has,
    flightLost,
    launchDay,
    launchDayOpen,
    applyEffects,
    replanLaunch,
    scrubCost,
    padFixCost,
    PAD_FIX_DAYS,
  };
  if (typeof module === 'object' && module.exports) module.exports = SMD.agency;
})();
