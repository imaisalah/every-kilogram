// The test hall: walk your astronaut to three test stations and run the
// environmental tests with your own hands. Each run costs money from the
// project's reserve and weeks of schedule; a careful reader of the data finds
// hidden flaws that would otherwise break in flight, a careless one misses
// them, and a false alarm costs a teardown. "Run it for me" uses the plain
// probabilistic test (SMD.ops.runTest) so classroom mode and bots still work.
//
// Open it with SMD.go('testlab', { projectId, back: 'hq' }) for a project in
// development. SMD.testlab holds the rules (pure logic, no DOM); the screen
// below only shows them.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const fill = (e, p) => (p ? String(e).replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : e);
  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : fill(e, p));

  // =====================================================================
  // Rules: SMD.testlab
  // =====================================================================
  const STATION_IDS = ['vibe', 'tvac', 'deploy'];
  const RUNS_PER_PHASE = 1; // each station once per phase (B, C, D): no farming
  const TEARDOWN = { cost: 2, weeks: 1 }; // a false alarm: open it up, find nothing
  const GOOD_CAP = 0.97;

  // How each station can be set up. factor scales the test's chance to make a
  // flaw show in the data (TESTS[].covers); cost in $M, weeks of schedule.
  const SETUPS = {
    vibe: [
      { id: 'work', cost: 6, weeks: 2, factor: 0.6, level: 0.55, grms: 6.8 },
      { id: 'accept', cost: 6, weeks: 2, factor: 1.1, level: 0.8, grms: 10.0, rec: true },
      { id: 'qual', cost: 6, weeks: 2, factor: 1.25, level: 1.1, grms: 14.1, damage: 0.15 },
    ],
    tvac: [
      { id: 'room', cost: 4, weeks: 1, factor: 0.3, amp: 0.25 },
      { id: 'flight', cost: 10, weeks: 4, factor: 1.0, amp: 0.74 },
      { id: 'margin', cost: 12, weeks: 5, factor: 1.2, amp: 0.86, rec: true },
    ],
    deploy: [
      { id: 'room', cost: 3, weeks: 2, factor: 0.45 },
      { id: 'cold', cost: 4, weeks: 3, factor: 1.12, rec: true },
    ],
  };
  // "Run it for me" is the standard test from js/data.js at its own price.
  const AUTO = { vibe: 'accept', tvac: 'flight', deploy: 'room' };

  // Data channels per station and the subsystem each one watches.
  const CHANNELS = {
    vibe: [
      { id: 'deck', sub: 'structure' },
      { id: 'inst', sub: 'instrument' },
      { id: 'hinge', sub: 'deploy' },
      { id: 'tank', sub: null },
    ],
    tvac: [
      { id: 'batt', sub: 'thermal' },
      { id: 'pcu', sub: 'power' },
      { id: 'radio', sub: 'comms' },
      { id: 'inst', sub: 'instrument' },
    ],
  };

  function deployParts(design) {
    const d = design || {};
    const out = [];
    if (d.arrays > 0) out.push('arrayL', 'arrayR');
    if (d.dish >= 2) out.push('dish');
    if ((d.instruments || []).includes('mag')) out.push('boom');
    return out;
  }
  // Crewed missions add the crew's own systems: the rocket interface on the
  // shake table (in place of the plain tank) and the cabin in the chamber.
  const isCrew = (design) => !!design && !!SMD.data && !!SMD.data.MISSIONS[design.mission] && SMD.data.MISSIONS[design.mission].kind === 'crew';
  function channels(id, design) {
    if (id === 'deploy') return deployParts(design).map((c) => ({ id: c, sub: 'deploy' }));
    const list = CHANNELS[id] || [];
    if (!isCrew(design)) return list;
    if (id === 'vibe') return list.map((c) => (c.id === 'tank' ? { id: 'adapter', sub: 'ascent' } : c));
    if (id === 'tvac') return list.concat([{ id: 'cabin', sub: 'lifeSupport' }]);
    return list;
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    if (SMD.ops && SMD.ops.rng) return SMD.ops.rng(seed);
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  const setupOf = (id, setupId) => {
    const list = SETUPS[id] || [];
    return list.find((s) => s.id === setupId) || list.find((s) => s.rec) || list[0];
  };
  const testOf = (id) => SMD.data.TESTS.find((x) => x.id === id);
  const hasTech = (ag, id) => !!(ag && Array.isArray(ag.tech) && ag.tech.includes(id));

  // Read-only view of the project's test-hall record (never writes).
  function peek(p) {
    const s = (p && p.testlab) || {};
    return {
      count: Number.isFinite(s.count) ? s.count : 0,
      runs: s.runs && typeof s.runs === 'object' ? s.runs : {},
      weeks: Number.isFinite(s.weeks) ? s.weeks : 0,
      monthsApplied: Number.isFinite(s.monthsApplied) ? s.monthsApplied : 0,
      spent: Number.isFinite(s.spent) ? s.spent : 0,
      history: Array.isArray(s.history) ? s.history : [],
    };
  }
  // The record, repaired and stored on the project (only when a run writes).
  function state(p) {
    if (!p.testlab || typeof p.testlab !== 'object' || Array.isArray(p.testlab)) p.testlab = {};
    Object.assign(p.testlab, peek(p)); // repairs in place, keeps the same object
    return p.testlab;
  }

  function runsLeft(p, id) {
    const s = peek(p);
    const used = (s.runs[p.phase] && s.runs[p.phase][id]) || 0;
    return Math.max(0, RUNS_PER_PHASE - used);
  }

  // { ok, why: 'status'|'parts'|'used'|'money'|'unknown', text }
  function canRun(ag, p, id) {
    if (!p || !STATION_IDS.includes(id)) return { ok: false, why: 'unknown', text: t('testlab.why.unknown', 'No such test station.') };
    if (p.status !== 'dev') return { ok: false, why: 'status', text: t('testlab.why.status', 'This spacecraft has left the test hall.') };
    if (id === 'deploy' && !deployParts(p.design).length) return { ok: false, why: 'parts', text: t('testlab.why.parts', 'Nothing on this spacecraft unfolds.') };
    if (runsLeft(p, id) <= 0) {
      const next = { B: 'C', C: 'D' }[p.phase];
      return {
        ok: false,
        why: 'used',
        text: next ? t('testlab.why.used', 'Already run in phase {phase}. Next chance in phase {next}.', { phase: p.phase, next }) : t('testlab.why.usedLast', 'Already run in phase {phase}, the last one before launch.', { phase: p.phase }),
      };
    }
    const min = Math.min(...SETUPS[id].map((s) => s.cost));
    if (ag.money < min) return { ok: false, why: 'money', text: t('testlab.why.money', 'Not enough money in the bank for this test.') };
    return { ok: true };
  }

  // The data a hand-run test will show. Pure and repeatable: the same run
  // number gives the same luck whatever setup you pick, so reopening a
  // station cannot reroll it. rows[].anomaly = the channel misbehaves.
  function prepare(ag, p, id, setupId) {
    const s = peek(p);
    const setup = setupOf(id, setupId);
    const test = testOf(id);
    const r = rng(((p.seed >>> 0) ^ 0x7e57) + 7717 * (s.count + 1) + hash(id));
    const boost = hasTech(ag, 'testlab') ? 1.15 : 1;
    const rows = channels(id, p.design).map((c) => ({ id: c.id, sub: c.sub, anomaly: false, flaws: [], damage: false, mag: 0, seed: 0 }));
    (p.flaws || []).forEach((f) => {
      if (f.detected || f.fixed) return;
      const cov = (test && test.covers[f.sub]) || 0;
      if (!cov) return;
      const u = r();
      const pick = r();
      const row = id === 'deploy' ? rows[Math.floor(pick * rows.length) % Math.max(1, rows.length)] : rows.find((x) => x.sub === f.sub);
      if (!row || u >= Math.min(GOOD_CAP, cov * setup.factor * boost)) return;
      row.anomaly = true;
      row.flaws.push(f.uid);
    });
    const dmg = r();
    const damage = !!setup.damage && dmg < setup.damage;
    if (damage) {
      const row = rows.find((x) => x.sub === 'structure');
      if (row) {
        row.anomaly = true;
        row.damage = true;
      }
    }
    rows.forEach((row) => {
      row.seed = Math.floor(r() * 1e9);
      row.mag = 0.5 + r() * 0.5;
    });
    return { station: id, setup: setup.id, n: s.count, rows, damage };
  }

  // ----- Money and schedule, the same way the agency's effects do it -----
  function charge(ag, p, cost) {
    const notes = [];
    if (!(cost > 0)) return notes;
    const fromReserve = Math.min(Math.max(0, p.reserveLeft || 0), cost);
    p.reserveLeft = (p.reserveLeft || 0) - fromReserve;
    const over = cost - fromReserve;
    if (over > 0) {
      p.overrun = (p.overrun || 0) + over;
      notes.push(t('agency.note.over', '${m}M beyond the reserve', { m: Math.round(over) }));
    }
    ag.money -= cost;
    state(p).spent += cost;
    // Congress gets notified past 15% cost growth.
    if (p.overrun > p.buildCost * 0.15 && !p.breach) {
      p.breach = true;
      ag.rep = Math.max(0, ag.rep - 1);
      notes.push(t('agency.note.breach', 'Cost growth passed 15%: Congress is notified (reputation −1)'));
    }
    return notes;
  }

  // Weeks pile up; every four of them slip the ready date by a month.
  function slip(ag, p, weeks) {
    const s = state(p);
    s.weeks += Math.max(0, weeks || 0);
    const due = Math.floor(s.weeks / 4) - s.monthsApplied;
    const notes = [];
    if (due > 0) {
      s.monthsApplied += due;
      p.readyMs = SMD.agency.addMonths(p.readyMs, due);
      replan(ag, p);
      notes.push(due > 1 ? t('agency.note.slips', '{n} months slip', { n: due }) : t('agency.note.slip', '{n} month slip', { n: due }));
    }
    return { months: Math.max(0, due), notes };
  }

  // After a slip, the next launch the spacecraft can make (as the agency does).
  function replan(ag, p) {
    if (SMD.agency.replanLaunch) return SMD.agency.replanLaunch(ag, p);
    if (p.status === 'flying' || p.status === 'done') return;
    const A = SMD.agency;
    const ev = SMD.model.evaluate(p.design, null, { readyMs: p.readyMs });
    if (!ev || !ev.launch) return;
    const before = p.launchMs;
    p.launch = ev.launch.launch;
    p.launchMs = p.launch.departMs;
    p.arriveMs = p.launch.arriveMs;
    p.launcherCost = ev.launch.launcherCost;
    p.opsMonthly = ev.launch.opsCost / Math.max(1, ev.launch.missionYears * 12);
    if (p.launchMs - before > 200 * 864e5) {
      const wait = Math.max(0, A.monthsBetween(before, p.launchMs));
      const storage = wait * SMD.data.CONST.storagePerMonth;
      ag.money -= storage;
      p.overrun = (p.overrun || 0) + storage;
      if (!p.missedWindow) {
        ag.rep = Math.max(0, ag.rep - 1);
        if (p.overrun > p.buildCost * 0.15) p.breach = true;
      }
      log(ag, 'agency.log.missed', '{name} missed its launch window. Next one: {month} (storage +${m}M, reputation −1).', { name: p.design.name, month: { ms: p.launchMs }, m: Math.round(storage) });
      p.missedWindow = true;
    }
  }

  // News lines in the agency's format (key + params, read in either language).
  function log(ag, key, en, params) {
    const entry = { ms: ag.now, key, en, params: params || {} };
    const A = SMD.agency;
    Object.defineProperty(entry, 'text', { get: () => (A && A.logText ? A.logText(entry) : fill(en, params)), enumerable: true, configurable: true });
    ag.log = ag.log || [];
    ag.log.unshift(entry);
    if (ag.log.length > 200) ag.log.length = 200;
  }

  // Run a station. result: { mode: 'hand'|'auto', setup, marks: [channelId] }.
  // Hand runs detect flaws only on channels the player marked; marks on a
  // healthy channel are false alarms (a teardown). Auto runs roll runTest.
  // Returns { ok, found[], falseAlarms[], damaged, cost, weeks, months, notes[] }.
  function run(ag, p, id, result) {
    const res = result || {};
    const chk = canRun(ag, p, id);
    if (!chk.ok) return { ok: false, why: chk.why, text: chk.text };
    const s = state(p);
    if (!Array.isArray(p.flaws)) p.flaws = [];
    const mode = res.mode === 'hand' ? 'hand' : 'auto';
    const setup = setupOf(id, mode === 'auto' ? AUTO[id] : res.setup);
    let found = [];
    const falseAlarms = [];
    let damaged = null;
    if (mode === 'auto') {
      const k = 300 + 2 * s.count;
      found = SMD.ops.runTest(p.flaws, id, p.seed, k);
      if (hasTech(ag, 'testlab')) found = found.concat(SMD.ops.runTest(p.flaws, id, p.seed + 1, k + 1));
    } else {
      const plan = prepare(ag, p, id, setup.id);
      const marks = new Set(res.marks || []);
      if (plan.damage) {
        damaged = { uid: `structure-overtest-${s.count}`, sub: 'structure', inst: null, detected: false, fixed: false, fromTest: true };
        p.flaws.push(damaged);
        const row = plan.rows.find((x) => x.damage);
        if (row) row.flaws.push(damaged.uid);
      }
      plan.rows.forEach((row) => {
        if (!marks.has(row.id)) return;
        if (!row.anomaly) {
          falseAlarms.push(row.id);
          return;
        }
        row.flaws.forEach((uid) => {
          const f = p.flaws.find((x) => x.uid === uid);
          if (f && !f.detected) {
            f.detected = true;
            f.foundBy = id;
            found.push(f);
          }
        });
      });
    }
    found.forEach((f) => (f.foundIn = 'hall'));
    const cost = setup.cost + falseAlarms.length * TEARDOWN.cost;
    const weeks = setup.weeks + falseAlarms.length * TEARDOWN.weeks;
    const notes = charge(ag, p, cost);
    const sl = slip(ag, p, weeks);
    notes.push(...sl.notes);
    s.runs[p.phase] = s.runs[p.phase] || {};
    s.runs[p.phase][id] = (s.runs[p.phase][id] || 0) + 1;
    s.count++;
    s.history.push({ ms: ag.now, phase: p.phase, station: id, mode, setup: setup.id, found: found.map((f) => f.uid), falseAlarms: falseAlarms.length, cost, weeks });
    if (s.history.length > 30) s.history.splice(0, s.history.length - 30);
    const test = { k: 'data.test.' + id, e: testOf(id).name };
    if (found.length) log(ag, found.length > 1 ? 'testlab.log.foundN' : 'testlab.log.found', found.length > 1 ? '{name}: the {test} in the test hall caught {n} hidden flaws.' : '{name}: the {test} in the test hall caught a hidden flaw.', { name: p.design.name, test, n: found.length });
    else log(ag, 'testlab.log.clean', '{name}: {test} in the test hall, nothing found.', { name: p.design.name, test });
    return { ok: true, station: id, mode, setup: setup.id, found, falseAlarms, damaged, cost, weeks, months: sl.months, notes };
  }

  // Fix a flaw the hall found (the review and event fix paths' prices).
  function fixCost(f) {
    const fx = (SMD.data.SUBSYSTEMS[f.sub] || {}).fix || { cost: 6, months: 0.5 };
    return { cost: fx.cost, weeks: Math.max(1, Math.round(fx.months * 4)) };
  }
  function fix(ag, p, uid) {
    const f = (p.flaws || []).find((x) => x.uid === uid);
    if (!f || !f.detected || f.fixed) return { ok: false, why: 'flaw' };
    if (p.status !== 'dev') return { ok: false, why: 'status' };
    const c = fixCost(f);
    if (ag.money < c.cost) return { ok: false, why: 'money' };
    f.fixed = true;
    f.fixedIn = 'hall';
    const notes = charge(ag, p, c.cost);
    const sl = slip(ag, p, c.weeks);
    notes.push(...sl.notes);
    log(ag, 'testlab.log.fixed', '{name}: engineers fixed a flaw found in the test hall ({sub}).', { name: p.design.name, sub: { k: 'data.sub.' + f.sub, e: SMD.data.SUBSYSTEMS[f.sub].name } });
    return { ok: true, cost: c.cost, weeks: c.weeks, months: sl.months, notes };
  }

  // Flaws the player knows about: found by the plan at approval, by events
  // or reviews, or here.
  const known = (p) => (p.flaws || []).filter((f) => f.detected);

  SMD.testlab = { STATION_IDS, SETUPS, AUTO, TEARDOWN, RUNS_PER_PHASE, channels, deployParts, canRun, runsLeft, prepare, run, fix, fixCost, known, peek };

  // =====================================================================
  // The screen
  // =====================================================================
  if (!SMD.ui || !SMD.ui.screens) return;
  const { ui } = SMD;
  const { esc, money } = ui;
  const reduced = () => {
    try {
      if (SMD.settings && SMD.settings.reducedMotion !== undefined) return !!SMD.settings.reducedMotion;
    } catch (e) {}
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  const COL = { ink: '#23282e', ink2: '#545d66', ink3: '#7d8790', grid: '#d3dcd6', teal: '#17807a', tealSoft: 'rgba(23,128,122,0.12)', red: '#b4302c', gold: '#d9a21b', paper: '#fbfcfb' };

  // Predicted outside temperatures by destination (game estimates from the
  // sunlight there: 1,361 W/m² at Earth, ~2,600 at Venus, ~590 at Mars, ~50 at Jupiter).
  const RANGE = { earth: [-40, 50], moon: [-60, 70], mars: [-80, 40], venus: [-25, 95], jupiter: [-150, 25] };
  const destOf = (p) => (SMD.data.MISSIONS[p.missionKey] || {}).dest || 'earth';
  function chamberRange(p, setupId) {
    const [lo, hi] = RANGE[destOf(p)] || RANGE.earth;
    if (setupId === 'room') return [15, 30];
    if (setupId === 'margin') return [lo - 10, hi + 10];
    return [lo, hi];
  }

  // Allowed temperature band of each sensor inside the spacecraft (°C).
  const BANDS = { batt: [-5, 30], pcu: [-20, 50], radio: [-25, 55], inst: [-30, 40], cabin: [16, 29] };
  const VIBE_F0 = { deck: 42, inst: 68, hinge: 24, tank: 105, adapter: 31 };
  const DEPLOY_SPEC = 4; // seconds: every hinge must latch before this
  const DEPLOY_WINDOW = 8;

  // ----- Signal models (deterministic per row) -----
  function vibeModel(row) {
    const r = rng(row.seed);
    const f0 = VIBE_F0[row.id] * (0.9 + 0.2 * r());
    const z = 0.035 * (0.9 + 0.2 * r());
    const f2 = f0 * (2.3 + 0.6 * r());
    const pre = { f0, z, a: 1 };
    const post = row.anomaly
      ? { f0: f0 * (1 - (0.068 + 0.06 * row.mag)), z: z * (1.5 + 0.7 * row.mag), a: 0.82 }
      : { f0: f0 * (1 + (r() - 0.5) * 0.03), z: z * (1 + (r() - 0.5) * 0.25), a: 1 + (r() - 0.5) * 0.14 };
    const ph = r() * 6;
    const resp = (m, f) => {
      const q = f / m.f0;
      const q2 = f / f2;
      const h1 = m.a / Math.sqrt((1 - q * q) ** 2 + (2 * m.z * q) ** 2);
      const h2 = 0.32 / Math.sqrt((1 - q2 * q2) ** 2 + (2 * 0.05 * q2) ** 2);
      return Math.log10(h1 + h2 + 0.05) + 0.025 * Math.sin(f * 0.9 + ph);
    };
    return { pre, post, f0, resp };
  }

  // Chamber wall profile: four cold-hot cycles, from room temperature.
  function shroud(x) {
    const c = Math.min(3.9999, Math.max(0, x) * 4);
    const cyc = Math.floor(c);
    const ph = c - cyc;
    const start = cyc === 0 ? 0 : 1;
    if (ph < 0.18) return start + (-1 - start) * (ph / 0.18);
    if (ph < 0.43) return -1;
    if (ph < 0.6) return -1 + 2 * ((ph - 0.43) / 0.17);
    return 1;
  }
  const TV_N = 240;
  function tvacModel(row, setupId) {
    const r = rng(row.seed);
    const [lo, hi] = BANDS[row.id];
    const mid = (lo + hi) / 2;
    const half = (hi - lo) / 2;
    const amp = setupOf('tvac', setupId).amp * (0.86 + 0.14 * r());
    const skew = (r() - 0.5) * 0.12;
    const hotSide = row.sub !== 'thermal'; // a heater fails cold, electronics fail hot
    // At full growth the faulty trace ends 20-50% of the band past its limit.
    const extra = (1 - amp * 0.93 + 0.2 + 0.3 * row.mag) * half;
    const spikes = [0, 1, 2, 3].map(() => 0.62 + r() * 0.35);
    const vals = new Float32Array(TV_N + 1);
    let lag = 0;
    for (let i = 0; i <= TV_N; i++) {
      const x = i / TV_N;
      lag += (shroud(x) - lag) * 0.16;
      let v = mid + half * (skew + amp * lag) + half * 0.025 * Math.sin(i * 1.7 + row.seed);
      if (row.anomaly) {
        const cyc = Math.min(3, Math.floor(x * 4));
        const grow = 0.55 + 0.45 * Math.min(1, cyc / 2);
        if (row.id === 'inst') {
          // Wiring fault: the detector jumps when it is hot.
          const ph = x * 4 - cyc;
          if (lag > 0.6 && Math.abs(ph - spikes[cyc]) < 0.025) v += extra * 1.3 * grow;
        } else {
          const side = Math.min(1, (hotSide ? Math.max(0, lag) : Math.max(0, -lag)) / 0.93);
          v += (hotSide ? 1 : -1) * extra * Math.pow(side, 2.2) * grow;
        }
      }
      vals[i] = v;
    }
    return { vals, lo, hi };
  }

  function deployModel(row, setupId) {
    const r = rng(row.seed);
    const T = 2.1 + 1.1 * r();
    const easeTo = (u) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2;
    if (!row.anomaly) {
      const angle = (s) => (s < T ? easeTo(s / T) : 1 + 0.025 * Math.exp(-(s - T) * 5) * Math.sin((s - T) * 28));
      return { angle, latch: T };
    }
    const stall = 0.28 + 0.26 * r();
    const t1 = T * 0.42;
    const hold = 1.3 + 2.0 * row.mag;
    const stuck = setupId === 'cold' && row.mag > 0.9;
    const t2 = t1 + hold;
    const rest = T * 1.1 + 0.6;
    const angle = (s) => {
      if (s < t1) return stall * easeTo(s / t1);
      if (s < t2 || stuck) return stall + 0.03 * Math.min(1, (s - t1) / hold) + (stuck ? 0.004 * Math.sin(s * 9) : 0);
      const u = (s - t2) / rest;
      return u >= 1 ? 1 + 0.02 * Math.exp(-(s - t2 - rest) * 5) * Math.sin((s - t2 - rest) * 28) : stall + 0.03 + (1 - stall - 0.03) * easeTo(u);
    };
    return { angle, latch: stuck ? Infinity : t2 + rest };
  }

  // ----- Drawing -----
  function drawFrame(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COL.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round((i * h) / 4) + 0.5);
      ctx.lineTo(w, Math.round((i * h) / 4) + 0.5);
      ctx.stroke();
    }
  }

  const FMIN = 8;
  const FMAX = 200;
  const fx = (f, w) => (Math.log(f / FMIN) / Math.log(FMAX / FMIN)) * w;
  const fy = (v, h) => h - 4 - ((v + 0.8) / 2.25) * (h - 8);
  function drawVibe(ctx, w, h, m, pre, post, marked) {
    drawFrame(ctx, w, h);
    // Decade ticks at 10 and 100 Hz.
    ctx.strokeStyle = COL.grid;
    [10, 20, 50, 100].forEach((f) => {
      ctx.beginPath();
      ctx.moveTo(Math.round(fx(f, w)) + 0.5, 0);
      ctx.lineTo(Math.round(fx(f, w)) + 0.5, h);
      ctx.stroke();
    });
    const plot = (model, k, color, dash, width) => {
      if (k <= 0) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      const n = Math.max(2, Math.floor(160 * k));
      for (let i = 0; i <= n; i++) {
        const f = FMIN * Math.pow(FMAX / FMIN, i / 160);
        const x = fx(f, w);
        const y = fy(m.resp(model, f), h);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    // The 5% rule: gold marks either side of the first sweep's peak.
    if (pre >= 1) {
      const xa = fx(m.f0 * 0.95, w);
      const xb = fx(m.f0 * 1.05, w);
      ctx.fillStyle = 'rgba(217,162,27,0.16)';
      ctx.fillRect(xa, 0, xb - xa, h);
      ctx.fillStyle = COL.gold;
      ctx.fillRect(xa - 1, 0, 2, h);
      ctx.fillRect(xb - 1, 0, 2, h);
    }
    plot(m.pre, pre, COL.ink3, [4, 3], 1.5);
    plot(m.post, post, marked ? COL.red : COL.teal, null, 2);
  }

  function drawTvac(ctx, w, h, m, k) {
    drawFrame(ctx, w, h);
    const span = m.hi - m.lo;
    const yMin = m.lo - span * 0.38;
    const yMax = m.hi + span * 0.38;
    const Y = (v) => h - 3 - ((v - yMin) / (yMax - yMin)) * (h - 6);
    ctx.fillStyle = COL.tealSoft;
    ctx.fillRect(0, Y(m.hi), w, Y(m.lo) - Y(m.hi));
    ctx.save();
    ctx.strokeStyle = COL.teal;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    [m.lo, m.hi].forEach((v) => {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(Y(v)) + 0.5);
      ctx.lineTo(w, Math.round(Y(v)) + 0.5);
      ctx.stroke();
    });
    ctx.restore();
    const n = Math.floor(TV_N * Math.min(1, k));
    if (n < 1) return;
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = (i / TV_N) * w;
      const y = Y(m.vals[i]);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    // The pen.
    ctx.fillStyle = COL.ink;
    ctx.beginPath();
    ctx.arc((n / TV_N) * w, Y(m.vals[n]), 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDeploy(ctx, w, h, m, s, marked) {
    drawFrame(ctx, w, h);
    const X = (sec) => (sec / DEPLOY_WINDOW) * w;
    const Y = (a) => h - 4 - Math.min(1.06, a) * (h - 10);
    // The latch deadline.
    ctx.save();
    ctx.strokeStyle = COL.red;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(X(DEPLOY_SPEC)) + 0.5, 0);
    ctx.lineTo(Math.round(X(DEPLOY_SPEC)) + 0.5, h);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = COL.red;
    ctx.font = '600 10px Archivo, sans-serif';
    ctx.fillText('4 s', X(DEPLOY_SPEC) + 3, 11);
    if (s <= 0) return;
    const end = Math.min(DEPLOY_WINDOW, s);
    ctx.strokeStyle = marked ? COL.red : COL.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const sec = (i / 120) * end;
      const x = X(sec);
      const y = Y(m.angle(sec));
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    if (s >= m.latch) {
      ctx.fillStyle = COL.teal;
      ctx.beginPath();
      ctx.arc(X(m.latch), Y(1), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ----- Words -----
  const stationName = (id) => ({ vibe: t('testlab.vibe', 'Shake table'), tvac: t('testlab.tvac', 'Thermal-vacuum chamber'), deploy: t('testlab.deploy', 'Deployment rig') })[id];
  const stationWhat = (id, p) =>
    ({
      vibe: t('testlab.vibe.what', 'Bolt the spacecraft to a shaker and rattle it the way the rocket will. A loose part changes how the structure rings.'),
      tvac: t('testlab.tvac.what', 'Pump out the air, then swing the chamber walls between the coldest and hottest temperatures the spacecraft will meet at {planet}. Heaters and electronics must hold their limits.', { planet: t('planet.' + destOf(p), destOf(p)) }),
      deploy: t('testlab.deploy.what', 'Hang the wings, dish and boom from offload cables so they unfold as if in zero g, then release each hinge by hand.'),
    })[id];
  const stationRule = (id) =>
    ({
      vibe: t('testlab.vibe.rule', 'Compare the sweep before (dashed) and after (solid) the full-level run. A peak that moved more than 5%, outside the gold marks, means something inside came loose.'),
      tvac: t('testlab.tvac.rule', 'Watch each sensor. A trace that leaves its green band means a heater or a part is failing.'),
      deploy: t('testlab.deploy.rule', 'Every hinge must latch before the red 4 s line. One that stalls or latches late is sticking.'),
    })[id];
  const SOURCE = {
    vibe: { url: 'https://standards.nasa.gov/standard/GSFC/GSFC-STD-7000' },
    tvac: { url: 'https://standards.nasa.gov/standard/GSFC/GSFC-STD-7000' },
    deploy: { url: 'https://llis.nasa.gov/lesson/492' },
  };
  const stationSource = (id) =>
    ({
      vibe: t('testlab.vibe.src', 'NASA’s environmental test standard (GEVS, GSFC-STD-7000) shakes flight hardware at 10.0 g rms to accept it and 14.1 g rms (+3 dB) to qualify a design, with gentle sine sweeps before and after to compare.'),
      tvac: t('testlab.tvac.src', 'Spacecraft spend weeks in thermal-vacuum chambers, cycled beyond their predicted flight temperatures (GEVS asks for a 10 °C margin to qualify a design). Webb’s telescope spent about 100 days in Chamber A at NASA Johnson in 2017.'),
      deploy: t('testlab.deploy.src', 'Hinges built for zero g cannot lift a panel on Earth, so engineers hang it from offload cables or float it on air bearings. Galileo’s main antenna probably lost the lubricant on its rib pins during truck trips; in 1991 three of its 18 ribs stuck.'),
    })[id];
  function setupLabel(id, s, p) {
    const launcher = t('design.opt.launcher.' + p.design.launcher, (SMD.data.OPTIONS.launcher.find((o) => o.id === p.design.launcher) || { name: 'launcher' }).name).toLowerCase();
    const planet = t('planet.' + destOf(p), destOf(p));
    const [lo, hi] = id === 'tvac' ? chamberRange(p, s.id) : [0, 0];
    const L = {
      'vibe.work': [t('testlab.set.vibe.work', 'Workmanship: 6.8 g rms'), t('testlab.set.vibe.work.d', 'Gentle. Shakes out bad solder joints, but rarely opens a hidden crack.')],
      'vibe.accept': [t('testlab.set.vibe.accept', 'Flight level: 10.0 g rms'), t('testlab.set.vibe.accept.d', 'What your {launcher} will do to it, with margin. The standard choice.', { launcher })],
      'vibe.qual': [t('testlab.set.vibe.qual', 'Qualification: 14.1 g rms'), t('testlab.set.vibe.qual.d', 'Twice the energy (+3 dB). Finds the most, but a 15% chance it overstresses a part: a new flaw to spot.')],
      'tvac.room': [t('testlab.set.tvac.room', 'Room-temperature check: {lo} to {hi} °C', { lo, hi }), t('testlab.set.tvac.room.d', 'Cheap and fast, but the heaters never have to work.')],
      'tvac.flight': [t('testlab.set.tvac.flight', 'Predicted flight range: {lo} to {hi} °C', { lo, hi }), t('testlab.set.tvac.flight.d', 'The temperatures {planet} will put it through.', { planet })],
      'tvac.margin': [t('testlab.set.tvac.margin', 'Flight range + 10 °C margin: {lo} to {hi} °C', { lo, hi }), t('testlab.set.tvac.margin.d', 'How NASA qualifies a design: test past what you expect. Longer and dearer, finds the most.')],
      'deploy.room': [t('testlab.set.deploy.room', 'At room temperature (20 °C)'), t('testlab.set.deploy.room.d', 'Quick, but a hinge that sticks in the cold often moves fine when warm.')],
      'deploy.cold': [t('testlab.set.deploy.cold', 'Cold, like in space (−40 °C)'), t('testlab.set.deploy.cold.d', 'Test as you fly: chill the hinges first. An extra week in the cold box.')],
    }[id + '.' + s.id];
    return { name: L[0], detail: L[1] };
  }
  const chName = (id, ch) =>
    ({
      'vibe.deck': t('testlab.ch.deck', 'Top deck (structure)'),
      'vibe.inst': t('testlab.ch.instMount', 'Instrument mounts'),
      'vibe.hinge': t('testlab.ch.hinge', 'Hinges and latches'),
      'vibe.tank': t('testlab.ch.tank', 'Propellant tank'),
      'vibe.adapter': t('testlab.ch.adapter', 'Rocket adapter'),
      'tvac.cabin': t('testlab.ch.cabin', 'Cabin air and water'),
      'tvac.batt': t('testlab.ch.batt', 'Battery heater'),
      'tvac.pcu': t('testlab.ch.pcu', 'Power regulator'),
      'tvac.radio': t('testlab.ch.radio', 'Radio amplifier'),
      'tvac.inst': t('testlab.ch.instDet', 'Instrument detector'),
      'deploy.arrayL': t('testlab.ch.arrayL', 'Left solar wing'),
      'deploy.arrayR': t('testlab.ch.arrayR', 'Right solar wing'),
      'deploy.dish': t('testlab.ch.dish', 'High-gain dish'),
      'deploy.boom': t('testlab.ch.boom', 'Magnetometer boom'),
    })[id + '.' + ch] || ch;
  const subName = (sub) => t('data.sub.' + sub, (SMD.data.SUBSYSTEMS[sub] || { name: sub }).name);
  const weeksText = (w) => (w === 1 ? t('testlab.week', '1 week') : w === 2 ? t('testlab.weeks2', '2 weeks') : t('testlab.weeks', '{n} weeks', { n: w }));
  const flawText = (f) => (SMD.ops && SMD.ops.flawLabel ? SMD.ops.flawLabel(f) : subName(f.sub));
  // What the flaw would have done in flight (the consequences in js/ops.js).
  const inFlight = (sub) =>
    ({
      structure: t('testlab.if.structure', 'In flight: launch shaking would crack a mount and leave an instrument at half quality.'),
      deploy: t('testlab.if.deploy', 'In flight: a wing could stay half open (30% less power) or the dish could jam, as Galileo’s did.'),
      instrument: t('testlab.if.instrument', 'In flight: the instrument could die in the middle of the science phase.'),
      thermal: t('testlab.if.thermal', 'In flight: a heater would fail and the instruments would go cold for a month.'),
      power: t('testlab.if.power', 'In flight: the regulator would overheat and cut 20% of the power during science.'),
      comms: t('testlab.if.comms', 'In flight: the radio would send home 40% less data.'),
      ascent: t('testlab.if.ascent', 'In flight: trouble during the climb to orbit, with the crew aboard.'),
      lifeSupport: t('testlab.if.lifeSupport', 'In flight: the crew’s air and water system could fail far from home.'),
    })[sub] || '';

  const ICON = {
    vibe: '<path d="M4 18h16"/><path d="M7 18v-3h10v3"/><path d="M9 15V7h6v8"/><path d="M3 9c1-1 1-3 0-4M21 9c-1-1-1-3 0-4"/>',
    tvac: '<rect x="5" y="3" width="14" height="18" rx="6"/><path d="M9 12h6M12 9v6"/><path d="M2 8h2M2 16h2M20 8h2M20 16h2"/>',
    deploy: '<rect x="10" y="9" width="4" height="6"/><path d="M10 12H3M14 12h7"/><path d="M3 9v6M21 9v6"/><path d="M6 3v6M18 3v6"/>',
  };
  const icon = (id) => `<svg class="tl-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[id] || ''}</svg>`;

  // =====================================================================
  SMD.ui.screens.testlab = {
    current: null,
    render(app, params) {
      const ag = SMD.game.agency;
      const back = () => {
        const mood = view.mood;
        SMD.go(params.back || 'hq', Object.assign({ resume: true }, params.backParams || {}, mood ? { mood } : {}));
      };
      const dev = ag.projects.filter((x) => x.status === 'dev');
      const p = ag.projects.find((x) => x.id === params.projectId) || (params.projectId == null ? dev[0] : null);
      const view = { mood: null };

      // ----- Nothing to test -----
      if (!p) {
        app.innerHTML = `<main class="screen day tl tl-empty">
          <div class="tl-empty-card">
            <p class="tl-kicker">${esc(t('testlab.kicker', 'Test hall'))}</p>
            <h1>${esc(t('testlab.empty.title', 'No spacecraft in development'))}</h1>
            <p>${esc(t('testlab.empty.body', 'Approve a design on the mission board first. While it is being built, you can bring it here and test it with your own hands.'))}</p>
            <button class="btn primary" data-act="back">${esc(t('testlab.back', 'Back to HQ'))}</button>
          </div>
        </main>`;
        app.querySelector('[data-act="back"]').addEventListener('click', back);
        return () => {};
      }

      const m = SMD.data.MISSIONS[p.missionKey];
      const isDev = p.status === 'dev';
      const phone = () => window.innerWidth < 760;
      app.innerHTML = `<main class="screen day tl" data-tl>
        <header class="tl-top">
          <button class="btn ghost small tl-back" data-act="back">${esc(t('testlab.back', 'Back to HQ'))}</button>
          <div class="tl-heading">
            <p class="tl-kicker">${esc(t('testlab.kicker2', 'Test hall · {mission}', { mission: t('mission.' + m.key + '.title', m.title) }))}</p>
            <h1>${esc(t('testlab.title', 'Test {name} with your own hands', { name: p.design.name }))}</h1>
          </div>
          <dl class="tl-stats" data-stats></dl>
        </header>
        <div class="tl-body">
          <section class="tl-stage" aria-label="${esc(t('testlab.stage.aria', 'The test hall in 3D'))}">
            <div class="tl-3d" data-3d></div>
            <div class="tl-prompt" data-prompt hidden></div>
            <p class="tl-hint" data-hint></p>
          </section>
          <aside class="tl-side" data-side>
            <div class="tl-campaign" data-campaign></div>
            <section class="tl-console" data-console hidden aria-labelledby="tl-con-h"></section>
          </aside>
        </div>
      </main>`;
      const $ = (s) => app.querySelector(s);
      const root = $('[data-tl]');

      // ----- State -----
      const S = {
        station: null, // the open console
        step: 'setup', // setup | run | read | result | locked
        setup: null,
        plan: null,
        models: null,
        marks: new Set(),
        committed: false,
        elapsed: 0,
        phaseIdx: 0,
        result: null,
        craftReady: false,
        deployIdx: 0,
        deployT: {},
        near: null,
        speed: 1,
      };
      let scene = null;
      let destroyed = false;
      let raf = 0;
      let rumble = null;
      let lastNow = 0;

      // ----- Top stats -----
      function renderStats() {
        const A = SMD.agency;
        const slack = Math.max(0, A.monthsBetween(p.readyMs, p.launchMs));
        $('[data-stats]').innerHTML = `
          <div><dt>${esc(t('testlab.stat.reserve', 'Reserve left'))}</dt><dd>${money(Math.max(0, p.reserveLeft || 0))}<small> / ${money(p.reserve || 0)}</small></dd></div>
          <div><dt>${esc(t('testlab.stat.bank', 'In the bank'))}</dt><dd>${money(ag.money)}</dd></div>
          <div><dt>${esc(t('testlab.stat.ready', 'Ready'))}</dt><dd>${esc(ui.monthYear(p.readyMs))}</dd></div>
          <div class="${slack <= 1 ? 'is-tight' : ''}"><dt>${esc(t('testlab.stat.launch', 'Launch'))}</dt><dd>${esc(ui.monthYear(p.launchMs))}<small> · ${esc(slack === 1 ? t('testlab.stat.slack1', '1 month spare') : slack === 2 ? t('testlab.stat.slack2', '2 months spare') : t('testlab.stat.slack', '{n} months spare', { n: slack }))}</small></dd></div>`;
      }

      // ----- Campaign panel (station list and known flaws) -----
      function stationStatus(id) {
        const c = canRun(ag, p, id);
        if (c.ok) return { ok: true, label: t('testlab.status.ready', 'Ready · {n} run this phase', { n: runsLeft(p, id) }), tone: 'ok' };
        return { ok: false, label: c.text, tone: c.why === 'used' ? 'done' : 'off' };
      }
      function renderCampaign() {
        const tp = SMD.data.TEST_PLANS.find((x) => x.id === p.testPlan);
        const kn = known(p);
        const rows = STATION_IDS.map((id) => {
          const st = stationStatus(id);
          const test = testOf(id);
          const crewOnly = ['lifeSupport', 'heatShield', 'ascent'];
          const finds = Object.keys(test.covers)
            .filter((sub) => isCrew(p.design) || !crewOnly.includes(sub))
            .map(subName)
            .join(', ');
          const costs = SETUPS[id].map((s) => s.cost);
          const lo = Math.min(...costs);
          const hi = Math.max(...costs);
          return `<li class="tl-st tl-st-${st.tone}">
            <div class="tl-st-h">${icon(id)}<div><h3>${esc(stationName(id))}</h3><p class="tl-st-status">${esc(st.label)}</p></div></div>
            <p class="tl-st-finds">${esc(t('testlab.finds', 'Finds: {list}', { list: finds }))}</p>
            <p class="tl-st-cost">${esc(lo === hi ? t('testlab.cost1', '{m} from the reserve, plus weeks', { m: money(lo) }) : t('testlab.costs', '{lo} to {hi} from the reserve, plus weeks', { lo: money(lo), hi: money(hi) }))}</p>
            <div class="tl-st-act">
              <button class="btn small" data-go="${id}" ${isDev ? '' : 'disabled'}>${esc(t('testlab.go', 'Walk there'))}</button>
              <button class="btn ghost small" data-auto="${id}" ${st.ok ? '' : 'disabled'}>${esc(t('testlab.auto', 'Run it for me'))}</button>
            </div>
          </li>`;
        }).join('');
        const flaws = kn.length
          ? `<ul class="tl-flaws">${kn
              .map((f) => {
                const c = fixCost(f);
                const where = f.foundIn === 'hall' ? t('testlab.flaw.hall', 'Found here') : f.fromEvent ? t('testlab.flaw.event', 'Found after an event') : t('testlab.flaw.plan', 'Found by your test plan');
                return `<li class="${f.fixed ? 'is-fixed' : 'is-open'}"><span class="tone ${f.fixed ? 'ok' : 'bad'}">${esc(f.fixed ? t('testlab.flaw.fixed', 'Fixed') : t('testlab.flaw.open', 'Not fixed'))}</span>
                  <span class="tl-flaw-t">${esc(flawText(f))}<small>${esc(where)}</small></span>
                  ${!f.fixed && isDev ? `<button class="btn small primary" data-fix="${esc(f.uid)}">${esc(t('testlab.fix', 'Fix: {m}, {w}', { m: money(c.cost), w: weeksText(c.weeks) }))}</button>` : ''}</li>`;
              })
              .join('')}</ul>`
          : `<p class="tl-muted">${esc(t('testlab.flaws.none', 'No flaws found yet. That does not mean there are none.'))}</p>`;
        $('[data-campaign]').innerHTML = `
          <header class="tl-camp-h">
            <h2>${esc(t('testlab.campaign', 'Test campaign'))}</h2>
            <span class="tl-phase">${esc(t('testlab.phase', 'Phase {p}', { p: p.phase }))}</span>
          </header>
          <p class="tl-lede">${esc(isDev ? t('testlab.lede', 'Each station runs once per phase. Every run costs money and weeks; a flaw you find on the ground is one that cannot break in space.') : t('testlab.why.status', 'This spacecraft has left the test hall.'))}</p>
          <ol class="tl-stations">${rows}</ol>
          <section class="tl-known">
            <h3>${esc(t('testlab.known', 'Known flaws'))}</h3>
            ${flaws}
            <p class="tl-plan">${esc(t('testlab.plan', 'Your test plan at approval: {plan}.', { plan: t('tests.' + (tp ? tp.id : 'standard'), tp ? tp.name : 'Standard tests') }))}</p>
          </section>
          ${isDev && STATION_IDS.some((id) => canRun(ag, p, id).ok) ? `<button class="btn ghost small tl-autoall" data-autoall>${esc(t('testlab.autoAll', 'Run every open station for me'))}</button>` : ''}`;
      }

      function refreshSide() {
        renderStats();
        renderCampaign();
        updateLabels();
      }
      function updateLabels() {
        if (!scene) return;
        STATION_IDS.forEach((id) => {
          const st = stationStatus(id);
          scene.setLabel(id, stationName(id), st.ok ? t('testlab.label.ready', 'Ready') : st.tone === 'done' ? t('testlab.label.done', 'Done this phase') : t('testlab.label.off', 'Not available'));
        });
      }

      // ----- Hints and the "press E" prompt -----
      function renderHint() {
        $('[data-hint]').innerHTML = phone()
          ? esc(t('testlab.hint.touch2', 'Left thumb: walk · right side: look · tap a station to use it'))
          : `${esc(t('testlab.hint.keys1', 'Walk'))} <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · <kbd>Shift</kbd> ${esc(t('testlab.hint.run', 'run'))} · <kbd>E</kbd> ${esc(t('testlab.hint.keys3', 'use a station'))} · ${esc(t('testlab.hint.mouse', 'mouse: look'))} · <kbd>H</kbd> ${esc(t('testlab.hint.help', 'controls'))}`;
      }
      function renderPrompt() {
        const el = $('[data-prompt]');
        const id = S.near;
        // The character controller shows the "E  Use the console" prompt now
        // (a big button on touch screens); this one stays as a fallback
        // for the no-3D view.
        if (!id || S.station || !isDev || scene) {
          el.hidden = true;
          return;
        }
        el.hidden = false;
        el.innerHTML = `<span>${esc(t('testlab.prompt', 'Use the {station}', { station: stationName(id).toLowerCase() }))}</span><button class="btn small primary" data-use="${id}"><kbd>E</kbd> ${esc(t('testlab.use', 'Use'))}</button>`;
      }

      // ----- The console -----
      const STEP_IDS = ['setup', 'run', 'read'];
      function openConsole(id) {
        if (!isDev || destroyed) return;
        if (S.station && S.committed) return;
        S.station = id;
        S.marks = new Set();
        S.result = null;
        S.committed = false;
        S.craftReady = false;
        S.pendingStart = false;
        S.plan = null;
        const chk = canRun(ag, p, id);
        S.step = chk.ok ? 'setup' : 'locked';
        S.setup = setupOf(id).id;
        $('[data-console]').hidden = false;
        $('[data-campaign]').hidden = true;
        root.classList.add('is-operating');
        if (scene) {
          scene.setShake(0);
          scene.setChamber({ door: 0, temp: 0 });
          scene.setOffload(false);
          if (scene.near !== id) scene.placeAt(id);
          scene.setMode('operate', id);
          if (chk.ok) {
            scene.stowAll();
            scene.moveCraft(id).then(() => {
              S.craftReady = true;
              if (S.station !== id || S.step !== 'setup') return;
              if (S.pendingStart) start();
              else renderConsole();
            });
          }
        } else S.craftReady = true;
        renderPrompt();
        renderConsole();
        const h = $('#tl-con-h');
        if (h) h.focus({ preventScroll: true });
        if (phone()) $('[data-console]').scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      }
      function closeConsole() {
        if (S.committed && S.step !== 'result') return; // a run in progress finishes first
        if (scene) {
          scene.setMode('walk');
          scene.setShake(0);
          scene.setChamber({ door: 0, temp: 0 });
          scene.setOffload(false);
          scene.stowAll();
        }
        stopRumble();
        S.station = null;
        S.step = 'setup';
        S.committed = false;
        $('[data-console]').hidden = true;
        $('[data-campaign]').hidden = false;
        root.classList.remove('is-operating');
        refreshSide();
        renderPrompt();
      }

      function stepper() {
        const idx = STEP_IDS.indexOf(S.step === 'result' ? 'read' : S.step);
        return `<ol class="tl-steps">${STEP_IDS.map((s, i) => `<li class="${i < idx || S.step === 'result' ? 'done' : i === idx ? 'now' : ''}">${i + 1}. ${esc({ setup: t('testlab.step.setup', 'Set up'), run: t('testlab.step.run', 'Run'), read: t('testlab.step.read', 'Read the data') }[s])}</li>`).join('')}</ol>`;
      }

      function renderConsole() {
        const el = $('[data-console]');
        const id = S.station;
        if (!id) return;
        const head = `<header class="tl-con-h">
            <div>${icon(id)}<h2 id="tl-con-h" tabindex="-1">${esc(stationName(id))}</h2></div>
            ${S.committed && S.step !== 'result' ? '' : `<button class="tl-x" data-act="close" aria-label="${esc(t('testlab.close', 'Close'))}">×</button>`}
          </header>`;
        let body = '';
        if (S.step === 'locked') {
          body = `<p class="tl-what">${esc(stationWhat(id, p))}</p><p class="tl-locked">${esc(canRun(ag, p, id).text)}</p>
            <div class="tl-con-act"><button class="btn primary" data-act="close">${esc(t('testlab.backHall', 'Back to the hall'))}</button></div>`;
        } else if (S.step === 'setup') {
          const setups = SETUPS[id]
            .map((s) => {
              const L = setupLabel(id, s, p);
              return `<label class="tl-setup ${S.setup === s.id ? 'is-on' : ''}">
                <input type="radio" name="tl-setup" value="${s.id}" ${S.setup === s.id ? 'checked' : ''} />
                <span class="tl-setup-t"><b>${esc(L.name)}</b>${s.rec ? `<em>${esc(t('testlab.rec', 'NASA practice'))}</em>` : ''}<small>${esc(L.detail)}</small></span>
                <span class="tl-setup-c">${money(s.cost)}<small>${esc(weeksText(s.weeks))}</small></span>
              </label>`;
            })
            .join('');
          const sel = setupOf(id, S.setup);
          const auto = setupOf(id, AUTO[id]);
          body = `${stepper()}
            <p class="tl-what">${esc(stationWhat(id, p))}</p>
            <fieldset class="tl-setups"><legend>${esc(t('testlab.setup.legend', 'How hard do you test it?'))}</legend>${setups}</fieldset>
            <div class="tl-con-act">
              <button class="btn primary" data-act="start" ${S.craftReady && ag.money >= sel.cost ? '' : 'disabled'}>${esc(S.craftReady ? t('testlab.start', 'Start the test · {m}', { m: money(sel.cost) }) : t('testlab.crane', 'The crane is bringing the spacecraft…'))}</button>
              <button class="btn ghost" data-act="auto">${esc(t('testlab.autoOne', 'Run it for me · {m}', { m: money(auto.cost) }))}</button>
            </div>
            <p class="tl-fine">${esc(t('testlab.autoNote', '“Run it for me” runs the standard test and reports what it catches, without you reading the data.'))}</p>`;
        } else if (S.step === 'run' || S.step === 'read') {
          body = `${stepper()}
            <p class="tl-live" data-live aria-live="polite"></p>
            <div class="tl-progress" aria-hidden="true"><span data-bar></span></div>
            ${id === 'vibe' ? `<canvas class="tl-accel" data-accel height="44" aria-hidden="true"></canvas>` : ''}
            <p class="tl-rule"><b>${esc(t('testlab.rule', 'What to look for'))}</b> ${esc(stationRule(id))}</p>
            <div class="tl-axis" aria-hidden="true">${esc(
              { vibe: t('testlab.axis.vibe', 'Frequency 8 to 200 Hz →'), tvac: t('testlab.axis.tvac', 'Four cold–hot cycles →'), deploy: t('testlab.axis.deploy', 'Seconds after release, 0 to 8 →') }[id]
            )}</div>
            <div class="tl-rows" role="group" aria-label="${esc(t('testlab.rows.aria', 'Data channels: mark the ones that misbehave'))}">
              ${S.plan.rows
                .map(
                  (row, i) => `<button type="button" class="tl-row" data-ch="${row.id}" aria-pressed="${S.marks.has(row.id)}">
                <span class="tl-row-k" aria-hidden="true">${i + 1}</span>
                <span class="tl-row-n">${esc(chName(id, row.id))}${id === 'tvac' ? `<small>${esc(t('testlab.band', 'limits {lo} to {hi} °C', { lo: BANDS[row.id][0], hi: BANDS[row.id][1] }))}</small>` : ''}</span>
                <canvas data-row="${row.id}" height="56" aria-hidden="true"></canvas>
                <span class="tl-row-flag">${esc(t('testlab.flag', 'Flagged'))}</span>
              </button>`
                )
                .join('')}
            </div>
            <div class="tl-con-act" data-acts></div>`;
        } else if (S.step === 'result') {
          body = resultHTML();
        }
        el.innerHTML = head + body;
        if (S.step === 'run' || S.step === 'read') {
          sizeCanvases();
          renderActs();
          drawAll();
        }
      }

      function renderActs() {
        const el = $('[data-acts]');
        if (!el) return;
        const id = S.station;
        let html = '';
        if (S.step === 'run' && id === 'deploy') {
          const parts = S.plan.rows;
          const next = parts[S.deployIdx];
          const moving = hingeMoving();
          html = next
            ? `<button class="btn primary" data-act="release" ${moving || !S.offloadOn ? 'disabled' : ''}><kbd>E</kbd> ${esc(t('testlab.release', 'Release: {part}', { part: chName('deploy', next.id) }))}</button>`
            : `<span class="tl-muted">${esc(t('testlab.waitLatch', 'Waiting for the last hinge…'))}</span>`;
        } else if (S.step === 'read') {
          const n = S.marks.size;
          html = `<button class="btn primary" data-act="report">${esc(n ? t('testlab.reportN', 'Report {n} flagged · ask for a teardown', { n }) : t('testlab.report0', 'Report: everything passed'))}</button>`;
        }
        el.innerHTML = html;
      }

      function sizeCanvases() {
        app.querySelectorAll('canvas[data-row]').forEach((c) => {
          const w = Math.max(80, Math.floor(c.getBoundingClientRect().width || c.parentElement.clientWidth * 0.6));
          c._ctx = ui.fitCanvas(c, w, 56);
          c._w = w;
        });
        const a = $('[data-accel]');
        if (a) {
          a._w = Math.max(100, Math.floor(a.getBoundingClientRect().width || 300));
          a._ctx = ui.fitCanvas(a, a._w, 44);
        }
      }

      // Progress of each phase of the run, for drawing.
      function runProgress() {
        const id = S.station;
        const e = S.elapsed;
        if (id === 'vibe') {
          const [a, b, c] = VIBE_T;
          return { pre: clamp01(e / a), full: clamp01((e - a) / b), post: clamp01((e - a - b) / c) };
        }
        if (id === 'tvac') {
          const [a, b, c] = TVAC_T;
          return { door: clamp01(e / a), pump: clamp01((e - a) / b), cyc: clamp01((e - a - b) / c) };
        }
        return {};
      }
      const clamp01 = (x) => Math.max(0, Math.min(1, x));
      const VIBE_T = [3.0, 5.5, 3.0];
      const TVAC_T = [1.2, 1.8, 11.5, 1.0];

      function drawAll() {
        if (!S.plan || !S.models) return;
        const id = S.station;
        const pr = runProgress();
        app.querySelectorAll('canvas[data-row]').forEach((c) => {
          const ch = c.dataset.row;
          const mdl = S.models[ch];
          if (!c._ctx || !mdl) return;
          const marked = S.marks.has(ch);
          if (id === 'vibe') drawVibe(c._ctx, c._w, 56, mdl, S.step === 'read' ? 1 : pr.pre, S.step === 'read' ? 1 : pr.post, marked);
          else if (id === 'tvac') drawTvac(c._ctx, c._w, 56, mdl, S.step === 'read' ? 1 : pr.cyc);
          else drawDeploy(c._ctx, c._w, 56, mdl, S.deployT[ch] === undefined ? 0 : S.deployT[ch], marked);
        });
        const a = $('[data-accel]');
        if (a && a._ctx) drawAccel(a._ctx, a._w, 44, pr);
      }
      // Live accelerometer: random vibration at the chosen level.
      function drawAccel(ctx, w, h, pr) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#101922';
        ctx.fillRect(0, 0, w, h);
        const lvl = setupOf('vibe', S.setup).level;
        const live = S.step === 'run' && pr.full > 0 && pr.full < 1 ? lvl : S.step === 'run' ? 0.12 : 0;
        ctx.strokeStyle = '#3fc1b4';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const ph = S.elapsed * 37;
        for (let x = 0; x <= w; x += 2) {
          const n = Math.sin(x * 0.9 + ph) * 0.5 + Math.sin(x * 2.3 + ph * 1.7) * 0.3 + Math.sin(x * 5.1 - ph * 2.3) * 0.2;
          const y = h / 2 + n * live * (h * 0.42);
          if (x) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#e9eef2';
        ctx.font = '700 11px Archivo, sans-serif';
        const g = live >= lvl ? setupOf('vibe', S.setup).grms : live ? 0.25 : 0;
        ctx.fillText(S.step === 'read' ? t('testlab.accel.done', 'Full level reached: {g} g rms', { g: setupOf('vibe', S.setup).grms.toFixed(1) }) : `${g.toFixed(1)} g rms`, 8, 14);
      }

      function liveText() {
        const id = S.station;
        const pr = runProgress();
        if (S.step === 'read') return t('testlab.live.read', 'Test complete. Read each channel, flag what misbehaved, then report.');
        if (id === 'vibe') {
          if (pr.pre < 1) return t('testlab.live.vibe.pre', 'Low-level sine sweep: recording how the structure rings before the big shake…');
          if (pr.full < 1) return t('testlab.live.vibe.full', 'Full-level random vibration: {g} g rms, like the ride to orbit.', { g: setupOf('vibe', S.setup).grms.toFixed(1) });
          return t('testlab.live.vibe.post', 'Second sweep: did anything change?');
        }
        if (id === 'tvac') {
          const [lo, hi] = chamberRange(p, S.setup);
          if (pr.door < 1) return t('testlab.live.tvac.door', 'Closing the chamber door…');
          if (pr.pump < 1) return t('testlab.live.tvac.pump', 'Pumping down to a millionth of an atmosphere…');
          if (pr.cyc < 1) {
            const sNow = shroud(pr.cyc);
            const temp = Math.round(sNow < 0 ? 15 + sNow * (15 - lo) : 15 + sNow * (hi - 15));
            return t('testlab.live.tvac.cyc', 'Cycle {c} of 4 · chamber walls {temp} °C', { c: Math.min(4, Math.floor(pr.cyc * 4) + 1), temp });
          }
          return t('testlab.live.tvac.end', 'Letting air back in…');
        }
        if (!S.offloadOn) return t('testlab.live.deploy.rig', 'Hooking the wings to the offload cables…');
        const next = S.plan.rows[S.deployIdx];
        return next ? t('testlab.live.deploy.next', 'Release the {part} and watch its hinge.', { part: chName('deploy', next.id).toLowerCase() }) : t('testlab.live.deploy.wait', 'Last hinge moving…');
      }

      // ----- Starting a run -----
      function start() {
        const id = S.station;
        if (!id || S.committed || !canRun(ag, p, id).ok) return;
        const sel = setupOf(id, S.setup);
        if (ag.money < sel.cost) return;
        S.plan = prepare(ag, p, id, S.setup);
        S.models = {};
        S.plan.rows.forEach((row) => {
          S.models[row.id] = id === 'vibe' ? vibeModel(row) : id === 'tvac' ? tvacModel(row, S.setup) : deployModel(row, S.setup);
        });
        S.committed = true;
        S.pendingStart = false;
        S.step = 'run';
        S.elapsed = 0;
        S.deployIdx = 0;
        S.deployT = {};
        S.offloadOn = false;
        SMD.audio && SMD.audio.beep(660, 0.08, 'sine', 0.12);
        if (id === 'vibe' && SMD.audio && SMD.audio.engine) rumble = SMD.audio.engine();
        renderConsole();
      }
      function stopRumble() {
        if (rumble) rumble.stop();
        rumble = null;
      }

      // A hinge is moving until it latched (plus a beat) or ran out the window.
      const hingeEnd = (row) => Math.min(DEPLOY_WINDOW, S.models[row.id].latch + 0.6);
      const hingeMoving = () => S.plan.rows.some((r) => S.deployT[r.id] !== undefined && S.deployT[r.id] < hingeEnd(r));
      function release() {
        if (S.station !== 'deploy' || S.step !== 'run' || !S.offloadOn) return;
        const row = S.plan.rows[S.deployIdx];
        if (!row) return;
        if (hingeMoving()) return;
        S.deployT[row.id] = 0;
        S.deployIdx++;
        SMD.audio && SMD.audio.beep(420, 0.06, 'square', 0.08);
        if (scene) scene.react('cheer');
        renderActs();
      }

      // Advance the run clock; drive the 3D effects.
      function stepRun(dt) {
        const id = S.station;
        S.elapsed += dt;
        const pr = runProgress();
        if (id === 'vibe') {
          const lvl = setupOf('vibe', S.setup).level;
          const shake = pr.pre < 1 ? 0.12 : pr.full < 1 ? lvl * Math.min(1, pr.full * 6, (1 - pr.full) * 6) : pr.post < 1 ? 0.12 : 0;
          if (scene) scene.setShake(shake);
          if (rumble) rumble.set(shake > 0.3 ? 0.18 * shake : 0.02, shake);
          if (pr.post >= 1) toRead();
        } else if (id === 'tvac') {
          if (scene) scene.setChamber({ door: S.elapsed < TVAC_T[0] + TVAC_T[1] + TVAC_T[2] ? 1 : 0, temp: pr.cyc > 0 && pr.cyc < 1 ? shroud(pr.cyc) * (S.setup === 'room' ? 0.3 : 1) : 0 });
          if (S.elapsed >= TVAC_T.reduce((a, b) => a + b, 0)) {
            if (scene) scene.setChamber({ door: 0, temp: 0 });
            toRead();
          }
        } else {
          if (!S.offloadOn && S.elapsed > 1.2) {
            S.offloadOn = true;
            if (scene) scene.setOffload(true);
            renderActs();
          }
          let allDone = S.deployIdx >= S.plan.rows.length;
          S.plan.rows.forEach((row) => {
            if (S.deployT[row.id] === undefined) return;
            const before = S.deployT[row.id];
            const mdl = S.models[row.id];
            const end = hingeEnd(row);
            S.deployT[row.id] = Math.min(end, before + dt * 1.5);
            if (scene) scene.setPart(row.id, Math.min(1, mdl.angle(S.deployT[row.id])));
            if (before < mdl.latch && S.deployT[row.id] >= mdl.latch && SMD.audio) SMD.audio.beep(1250, 0.04, 'square', 0.08); // latch click
            if (before < end && S.deployT[row.id] >= end) renderActs();
            if (S.deployT[row.id] < end) allDone = false;
          });
          if (allDone) toRead();
        }
      }
      function toRead() {
        if (S.step !== 'run') return;
        S.step = 'read';
        stopRumble();
        if (scene) scene.setShake(0);
        renderConsole();
        const live = $('[data-live]');
        if (live) live.textContent = liveText();
      }

      // ----- Reporting -----
      function report() {
        if (S.step !== 'read') return;
        const r = run(ag, p, S.station, { mode: 'hand', setup: S.setup, marks: [...S.marks] });
        finish(r);
      }
      function autoRun(id) {
        if (!canRun(ag, p, id).ok) return null;
        const r = run(ag, p, id, { mode: 'auto' });
        return r;
      }
      function finish(r) {
        SMD.game.save();
        S.result = r;
        S.step = 'result';
        S.committed = false;
        if (r && r.ok) {
          if (r.found.length) {
            view.mood = 'celebrate';
            if (scene) scene.react('celebrate');
            SMD.audio && SMD.audio.chime(true);
          } else if (r.falseAlarms.length) {
            if (scene) scene.react('sad');
          } else if (scene) scene.react('wave');
        }
        renderStats();
        renderConsole();
        if (scene && S.station === 'deploy') {
          scene.setOffload(false);
          scene.stowAll();
        }
        const h = $('#tl-con-h');
        if (h) h.focus({ preventScroll: true });
      }

      function resultHTML() {
        const r = S.result;
        const id = S.station;
        if (!r || !r.ok) return `<p class="tl-locked">${esc((r && r.text) || '')}</p><div class="tl-con-act"><button class="btn primary" data-act="close">${esc(t('testlab.backHall', 'Back to the hall'))}</button></div>`;
        const found = r.found;
        const title = found.length
          ? found.length > 1
            ? t('testlab.res.foundN', 'You caught {n} hidden flaws on the ground', { n: found.length })
            : t('testlab.res.found1', 'You caught a hidden flaw on the ground')
          : r.falseAlarms.length
          ? t('testlab.res.false', 'False alarm: the teardown found nothing')
          : t('testlab.res.clean', 'Every channel stayed within limits');
        const tone = found.length ? 'ok' : r.falseAlarms.length ? 'warn' : 'ok';
        const lines = found
          .map((f) => {
            const c = fixCost(f);
            const why = inFlight(f.sub);
            return `<li class="tl-res-f" data-flaw="${esc(f.uid)}"><p><b>${esc(flawText(f))}</b>${why ? `<span class="tl-res-if">${esc(why)}</span>` : ''}${f.fromTest ? `<small>${esc(t('testlab.res.overtest', 'The 14.1 g rms run overstressed this part. Good thing you spotted it.'))}</small>` : ''}</p>
              ${f.fixed ? `<span class="tone ok">${esc(t('testlab.flaw.fixed', 'Fixed'))}</span>` : `<div class="tl-res-fix"><button class="btn small primary" data-fix="${esc(f.uid)}">${esc(t('testlab.fix', 'Fix: {m}, {w}', { m: money(c.cost), w: weeksText(c.weeks) }))}</button><span class="tl-fine">${esc(t('testlab.fix.later', 'Or fix it later from the campaign list. Unfixed, it can still break in flight.'))}</span></div>`}
            </li>`;
          })
          .join('');
        const fa = r.falseAlarms.length
          ? `<p class="tl-res-fa">${esc(t('testlab.res.faText', 'Teardown of {list}: nothing wrong. Each false alarm costs {m} and {w}.', { list: r.falseAlarms.map((c) => chName(id, c)).join(', '), m: money(TEARDOWN.cost), w: weeksText(TEARDOWN.weeks) }))}</p>`
          : '';
        const missedHint =
          !found.length && !r.falseAlarms.length
            ? `<p class="tl-muted">${esc(r.mode === 'auto' ? t('testlab.res.autoClean', 'The standard test caught nothing this time. Tests miss some flaws; reading the data yourself, at the right level, catches more.') : t('testlab.res.cleanHint', 'If nothing was wrong, that is good news. If a channel did misbehave and you passed it, the flaw flies with you.'))}</p>`
            : '';
        const costLine = t('testlab.res.cost', 'This run: {m} from the reserve and {w}.', { m: money(r.cost), w: weeksText(r.weeks) });
        const notes = (r.notes || []).filter(Boolean);
        return `${r.mode === 'auto' ? '' : stepper()}
          <div class="tl-result tl-result-${tone}">
            <p class="tl-res-kicker">${esc(r.mode === 'auto' ? t('testlab.res.auto', 'Standard test, run for you') : t('testlab.res.hand', 'Your test report'))}</p>
            <h3>${esc(title)}</h3>
            ${lines ? `<ul class="tl-res-list">${lines}</ul>` : ''}
            ${fa}${missedHint}
            <p class="tl-res-cost">${esc(costLine)}${notes.length ? ` <b>${esc(notes.join(' · '))}</b>` : ''}</p>
          </div>
          <p class="tl-src">${esc(stationSource(id))} <a href="${SOURCE[id].url}" target="_blank" rel="noopener">${esc(t('testlab.source', 'Source'))}</a></p>
          <div class="tl-con-act"><button class="btn primary" data-act="close">${esc(t('testlab.backHall', 'Back to the hall'))}</button></div>`;
      }

      function doFix(uid) {
        const r = fix(ag, p, uid);
        if (!r.ok) {
          if (r.why === 'money') ui.toast(t('testlab.why.money', 'Not enough money in the bank for this test.'), { kind: 'warn' });
          return;
        }
        SMD.game.save();
        SMD.audio && SMD.audio.chime(true);
        ui.toast(t('testlab.fixed.toast', 'Fixed: {m} and {w}.', { m: money(r.cost), w: weeksText(r.weeks) }) + (r.notes.length ? ' ' + r.notes.join(' · ') : ''), { kind: 'ok' });
        renderStats();
        if (S.station && S.step === 'result') renderConsole();
        else renderCampaign();
      }

      // Quick path from the campaign list, or from inside a console.
      function quick(id) {
        if (S.committed) return;
        const r = autoRun(id);
        if (!r) return;
        if (!S.station || S.station !== id) {
          openConsoleForResult(id, r);
        } else finish(r);
      }
      function openConsoleForResult(id, r) {
        S.station = id;
        S.plan = null;
        $('[data-console]').hidden = false;
        $('[data-campaign]').hidden = true;
        root.classList.add('is-operating');
        if (scene) {
          if (scene.near !== id) scene.placeAt(id);
          scene.setMode('operate', id);
          scene.moveCraft(id);
        }
        finish(r);
      }
      function quickAll() {
        const results = STATION_IDS.filter((id) => canRun(ag, p, id).ok).map((id) => autoRun(id)).filter(Boolean);
        SMD.game.save();
        const n = results.reduce((s, r) => s + r.found.length, 0);
        const cost = results.reduce((s, r) => s + r.cost, 0);
        ui.toast(n ? t('testlab.all.found', 'The campaign caught {n} hidden flaws ({m}). Fix them from the list.', { n, m: money(cost) }) : t('testlab.all.clean', 'The campaign caught nothing this time ({m}).', { m: money(cost) }), { kind: n ? 'ok' : 'info', ms: 6000 });
        if (n) view.mood = 'celebrate';
        refreshSide();
        return results;
      }

      // ----- Events -----
      app.addEventListener('click', (e) => {
        const b = e.target.closest('button, a');
        if (!b || !app.contains(b)) return;
        const act = b.dataset.act;
        if (act === 'back') return back();
        if (act === 'close') return closeConsole();
        if (act === 'start') return start();
        if (act === 'auto') return quick(S.station);
        if (act === 'release') return release();
        if (act === 'report') return report();
        if (b.dataset.go) {
          const id = b.dataset.go;
          if (scene && !reduced()) scene.walkTo(id, () => openConsole(id));
          else openConsole(id);
          return;
        }
        if (b.dataset.use) return openConsole(b.dataset.use);
        if (b.dataset.auto) return quick(b.dataset.auto);
        if (b.dataset.fix) return doFix(b.dataset.fix);
        if (b.hasAttribute('data-autoall')) return quickAll();
        if (b.dataset.ch) return toggleMark(b.dataset.ch);
      });
      app.addEventListener('change', (e) => {
        if (e.target.name === 'tl-setup') {
          S.setup = e.target.value;
          SMD.audio && SMD.audio.beep(520, 0.05, 'sine', 0.08);
          renderConsole();
          const r = app.querySelector(`input[name="tl-setup"][value="${S.setup}"]`);
          if (r) r.focus();
        }
      });
      function toggleMark(ch, on) {
        if (!S.plan || (S.step !== 'run' && S.step !== 'read')) return;
        const want = on === undefined ? !S.marks.has(ch) : !!on;
        if (want) S.marks.add(ch);
        else S.marks.delete(ch);
        const b = app.querySelector(`.tl-row[data-ch="${ch}"]`);
        if (b) b.setAttribute('aria-pressed', String(want));
        SMD.audio && SMD.audio.beep(want ? 300 : 240, 0.05, 'triangle', 0.1);
        renderActs();
        drawAll();
      }
      const onKey = (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.code !== 'Escape') return;
        if (e.code === 'Escape' && S.station) {
          closeConsole();
          return;
        }
        if (!S.station) return;
        const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4 }[e.code];
        if (n !== undefined && S.plan && S.plan.rows[n]) {
          e.preventDefault();
          toggleMark(S.plan.rows[n].id);
        } else if (e.code === 'KeyE' && S.step === 'run' && S.station === 'deploy') {
          e.preventDefault();
          release();
        } else if (e.code === 'Enter' && S.step === 'read' && !(e.target && e.target.tagName === 'BUTTON')) {
          e.preventDefault();
          report();
        }
      };
      window.addEventListener('keydown', onKey);
      const onResize = () => {
        renderHint();
        if (S.step === 'run' || S.step === 'read') {
          sizeCanvases();
          drawAll();
        }
      };
      window.addEventListener('resize', onResize);

      // ----- Frame loop for the console (the 3D engine has its own) -----
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.25, (now - (lastNow || now)) / 1000);
        lastNow = now;
        if (S.step === 'run') {
          stepRun(dt * S.speed);
          if (S.step === 'run') {
            drawAll();
            const pct = S.station === 'vibe' ? S.elapsed / VIBE_T.reduce((a, b) => a + b, 0) : S.station === 'tvac' ? S.elapsed / TVAC_T.reduce((a, b) => a + b, 0) : S.deployIdx / Math.max(1, S.plan.rows.length);
            const bar = $('[data-bar]');
            if (bar) bar.style.inlineSize = `${Math.round(clamp01(pct) * 100)}%`;
            const live = $('[data-live]');
            const txt = liveText();
            if (live && live.textContent !== txt) live.textContent = txt;
          }
        }
      };
      raf = requestAnimationFrame(loop);

      // ----- 3D -----
      function start3D() {
        const E = SMD.three && SMD.three.engine;
        if (!E) return;
        import(new URL('js/3d/testlab.js', document.baseURI).href)
          .then((mod) => {
            if (destroyed) return;
            let info = {};
            try {
              const ev = SMD.model.evaluate(p.design, p.launch, { readyMs: p.readyMs });
              if (ev && ev.launch) info = { dryKg: ev.launch.dry, propKg: ev.launch.prop };
            } catch (err) {}
            scene = mod.createTestHall(E.getRenderer().domElement, {
              design: p.design,
              info,
              onNear(id) {
                S.near = id;
                renderPrompt();
              },
              onUse(id) {
                if (!S.station) openConsole(id);
              },
              canUse: () => isDev && !S.station,
              onPick(id) {
                if (S.station) return;
                scene.walkTo(id, () => openConsole(id));
              },
            });
            E.mount($('[data-3d]'), scene);
            // Q / gamepad B backs out of the console, like Esc.
            if (scene.controller) scene.controller.on('back', () => S.station && closeConsole());
            updateLabels();
            if (S.station) {
              scene.placeAt(S.station);
              scene.setMode('operate', S.station);
              scene.moveCraft(S.station).then(() => {
                S.craftReady = true;
                if (S.step !== 'setup') return;
                if (S.pendingStart) start();
                else renderConsole();
              });
            }
            if (!reduced()) setTimeout(() => !destroyed && scene && scene.react('wave'), 900);
          })
          .catch((err) => {
            console.warn('test hall 3D failed', err);
            S.craftReady = true;
            if (S.station && S.step === 'setup') renderConsole();
          });
      }

      renderHint();
      refreshSide();
      renderPrompt();
      start3D();

      // Handles for scripts, tests and the HQ.
      const api = {
        project: p,
        state: S,
        get scene() {
          return scene;
        },
        set speed(v) {
          S.speed = Math.max(0.25, Math.min(20, Number(v) || 1));
        },
        get speed() {
          return S.speed;
        },
        open: openConsole,
        close: closeConsole,
        choose(setupId) {
          if (S.step !== 'setup') return;
          S.setup = setupOf(S.station, setupId).id;
          renderConsole();
        },
        start() {
          if (S.craftReady) start();
          else S.pendingStart = true;
        },
        release,
        mark: toggleMark,
        report,
        auto: quick,
        autoAll: quickAll,
        fix: doFix,
        walkTo(id) {
          if (scene) scene.walkTo(id, () => openConsole(id));
        },
        // The truth behind the current run (for automated checks only).
        anomalies: () => (S.plan ? S.plan.rows.filter((r) => r.anomaly).map((r) => r.id) : []),
      };
      SMD.ui.screens.testlab.current = api;

      return () => {
        destroyed = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
        stopRumble();
        // Leaving mid-run still books the hall: the run counts, nothing is found.
        if (S.committed && S.step !== 'result' && S.station) {
          try {
            run(ag, p, S.station, { mode: 'hand', setup: S.setup, marks: [] });
            SMD.game.save();
          } catch (err) {
            console.warn('test hall: could not close the run', err);
          }
        }
        if (SMD.ui.screens.testlab.current === api) SMD.ui.screens.testlab.current = null;
        scene = null;
      };
    },
  };
})();
