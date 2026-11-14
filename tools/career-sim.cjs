// Career simulator: bots play whole agency careers through the same
// SMD.agency API the screens use, so we can tune money, research and pacing.
//
// Usage:
//   node tools/career-sim.cjs [seeds=20] [careful|expert|greedy|clueless] [--verbose] [--json] [--patch file.cjs]
//   SIM_DEBUG=1 prints why a bot skipped a mission.
//   --patch file.cjs exports (D, A) => {...} to try numbers without editing data.js.
//
// Player styles:
//   careful   good designs (searches the design space like a player reading the
//             requirements panel), standard or thorough tests, standard reserve,
//             fixes problems that reviews and events raise. Researches for Mars
//             and Venus first.
//   expert    the same careful player, but plans for Europa early (research and
//             money go to the Jupiter kit before Venus).
//   greedy    cheap designs, basic tests, lean reserve, says "fly it" to events.
//   clueless  random parts, random tests and answers; after a failure it often
//             presses "Load a proven design" (the game teaches it).
//
// Real time is estimated with a simple model of how long each stop takes
// (design screen, review, event card, films, results). See docs/BALANCE.md.
const path = require('node:path');
const root = path.join(__dirname, '..');
globalThis.SMD = globalThis.SMD || {};
require(path.join(root, 'js/physics.js'));
const D = require(path.join(root, 'js/data.js'));
require(path.join(root, 'js/model.js'));
const O = require(path.join(root, 'js/ops.js'));
require(path.join(root, 'content/events.js'));
require(path.join(root, 'content/discoveries.js'));
const A = require(path.join(root, 'js/agency.js'));

const { MISSIONS, CONTRACTS, TECH, CAREER } = D;
const EVENTS = globalThis.SMD.content.events;
const STOP = new Set(['review', 'event', 'launch', 'arrival', 'complete', 'unlock']);
const HEADLINE = ['mars', 'venus', 'jupiter'];

// The designs the designer offers as "Load a proven design" (screen-design.js PROVEN).
const PROVEN = {
  nile: { instruments: ['hires', 'irspec'], arrays: 8, dish: 1, amp: 25, recorder: 256, launcher: 'light', margin: 10 },
  weather: { instruments: ['irspec', 'context'], arrays: 5, dish: 1, amp: 25, recorder: 64, launcher: 'light', margin: 10 },
  moon: { instruments: ['neutron', 'sounder', 'context'], arrays: 6, dish: 1, amp: 25, recorder: 256, launcher: 'light', margin: 10 },
  mars: { instruments: ['sounder', 'hires', 'neutron'], arrays: 6, dish: 3, amp: 100, recorder: 256, launcher: 'light', capture: 'aerobrake', margin: 20 },
  venus: { instruments: ['sar', 'irspec', 'uso'], arrays: 5, dish: 3, amp: 100, recorder: 1024, launcher: 'medium', capture: 'aerobrake', margin: 20 },
  jupiter: { instruments: ['iceRadar', 'mag', 'hires'], arrays: 70, dish: 3, amp: 100, recorder: 1024, launcher: 'heavy', shield: 75, ground: 12, margin: 20 },
};

// Seconds a human spends at each kind of stop (rough, from playtests of the screens).
const TIME = {
  skip: 4,
  perMonth: 0.25,
  review: 30,
  event: 25,
  launch: 25,
  arrival: 20,
  complete: 45,
  unlock: 4,
  research: 15,
  hire: 6,
  design: { careful: 170, greedy: 90, clueless: 110 },
  firstDesign: 120,
};

function rng(seed) {
  return O.rng(seed);
}

// ---------- Design search ----------
const KEY_INST = (key) => {
  const o = MISSIONS[key].objectives.find((x) => x.key);
  return Object.keys(o.instruments);
};

function designKey(d) {
  return JSON.stringify([d.instruments.slice().sort(), d.arrays, d.dish, d.amp, d.recorder, d.launcher, d.capture, d.margin, d.shield, d.ground, d.avionics, d.rtg, d.route]);
}

function neighbours(ag, d) {
  const p = A.parts(ag);
  const out = [];
  const step = (list, v, dir) => {
    const i = list.findIndex((x) => String(x) === String(v));
    const j = i + dir;
    return j >= 0 && j < list.length ? list[j] : undefined;
  };
  const push = (ch) => out.push({ ...d, ...ch, instruments: ch.instruments || d.instruments.slice() });
  const big = d.mission === 'jupiter' ? 10 : 3;
  [1, -1, big, -big].forEach((k) => d.arrays + k >= 1 && d.arrays + k <= 90 && push({ arrays: d.arrays + k }));
  ['dish', 'amp', 'recorder', 'ground', 'launcher', 'margin', 'shield'].forEach((f) => {
    [1, -1].forEach((dir) => {
      const v = step(p[f], d[f], dir);
      if (v !== undefined) push({ [f]: v });
    });
  });
  if (p.capture.length > 1) push({ capture: d.capture === 'aerobrake' ? 'propulsive' : 'aerobrake' });
  if (p.avionics.length > 1) push({ avionics: d.avionics === 'dual' ? 'single' : 'dual' });
  if (p.rtg && d.rtg < p.rtg) push({ rtg: d.rtg + 1 });
  if (d.rtg > 0) push({ rtg: d.rtg - 1 });
  if (d.mission === 'jupiter' && p.launcher.includes('heavy')) push({ route: d.route === 'ega' ? 'direct' : 'ega' });
  const keys = KEY_INST(d.mission);
  p.instruments.forEach((id) => {
    if (!d.instruments.includes(id) && d.instruments.length < 5) push({ instruments: d.instruments.concat(id) });
  });
  d.instruments.forEach((id) => {
    const rest = d.instruments.filter((x) => x !== id);
    if (rest.some((x) => keys.includes(x))) push({ instruments: rest });
  });
  return out;
}

// How much a style likes a plan.
function utility(ag, pl, w) {
  const L = pl.launch;
  if (!L) return -1e9;
  if (L.launchMargin < 0) return -1e6 + L.launchMargin; // too heavy: lighter is better
  const sci = pl.expected ? pl.expected.total : 0;
  const head = pl.expected && pl.expected.headline;
  let u = w.sci * sci + (head ? w.headline : 0) - w.cost * pl.cost.total;
  // A careful player keeps a margin on the headline goal, not just a pass.
  if (w.key && pl.expected) u += w.key * Math.min(1.2, pl.expected.keyFrac);
  if (pl.base.powerMargin < w.power) u -= 40 * (w.power - pl.base.powerMargin);
  if (L.wet / L.capacity > 0.92) u -= w.lift;
  if (MISSIONS[pl.design.mission].kind === 'planet') u -= w.wait * Math.max(0, L.waitMonths - 2);
  u -= w.risk * pl.riskAnyFlaw * 100;
  u -= w.margin0 && pl.design.margin === 0 ? w.margin0 : 0;
  const m = MISSIONS[pl.design.mission];
  const end = L.scienceStartMs + m.turns * m.turnDays * 864e5;
  if (w.late && end > CAREER.end) u -= w.late + (end - CAREER.end) / 864e5 / 10; // the requirements panel flags it
  return u;
}

const WEIGHTS = {
  careful: { sci: 1, headline: 40, cost: 0.035, power: 1.2, lift: 30, wait: 1.2, risk: 0.15, margin0: 15, late: 300, key: 80 },
  greedy: { sci: 0.6, headline: 30, cost: 0.12, power: 1.0, lift: 0, wait: 0.5, risk: 0, margin0: 0, late: 100 },
};

function search(ag, start, tp, conf, w, budgetEvals) {
  // Jupiter: a smart player also tries the fast direct route on the heavy launcher.
  if (start.mission === 'jupiter' && A.parts(ag).launcher.includes('heavy') && w.late) {
    const a = climb(ag, start, tp, conf, w, budgetEvals / 2);
    const lite = { ...start, route: 'direct', margin: 10, instruments: start.instruments.map((id) => (id === 'hires' ? 'context' : id)) };
    const b = climb(ag, lite, tp, conf, w, budgetEvals / 2);
    return b.u > a.u ? b : a;
  }
  return climb(ag, start, tp, conf, w, budgetEvals);
}

function climb(ag, start, tp, conf, w, budgetEvals) {
  const cache = new Map();
  const evalD = (d) => {
    const k = designKey(d);
    if (cache.has(k)) return cache.get(k);
    const pl = A.plan(ag, d, tp, conf);
    const r = { d, pl, u: utility(ag, pl, w) };
    cache.set(k, r);
    return r;
  };
  let best = evalD(start);
  for (let pass = 0; pass < 6 && cache.size < budgetEvals; pass++) {
    let improved = false;
    for (const n of neighbours(ag, best.d)) {
      if (cache.size >= budgetEvals) break;
      const r = evalD(n);
      if (r.u > best.u + 0.01) {
        best = r;
        improved = true;
      }
    }
    if (!improved) break;
  }
  return best;
}

function provenDesign(ag, key) {
  const d = Object.assign(A.newDesign(ag, key), JSON.parse(JSON.stringify(PROVEN[key] || MISSIONS[key].proven || {})));
  return A.applyTech(ag, d);
}

function randomDesign(ag, key, r) {
  const p = A.parts(ag);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const d = A.newDesign(ag, key);
  const n = 1 + Math.floor(r() * 4);
  const ids = p.instruments.slice().sort(() => r() - 0.5).slice(0, n);
  d.instruments = ids;
  d.arrays = key === 'jupiter' ? 10 + Math.floor(r() * 60) : 2 + Math.floor(r() * 16);
  ['dish', 'amp', 'recorder', 'launcher', 'capture', 'shield', 'ground', 'margin', 'avionics'].forEach((f) => (d[f] = pick(p[f])));
  if (p.rtg && r() < 0.3) d.rtg = 1 + Math.floor(r() * p.rtg);
  return A.applyTech(ag, d);
}

// ---------- Choices ----------
function choicePenalty(style, p, fx) {
  fx = fx || {};
  const planet = MISSIONS[p.missionKey].kind === 'planet';
  const cost = fx.money ? -fx.money : 0;
  const months = fx.months || 0;
  const flaw = fx.hiddenFlaw ? 1 : 0;
  const sciLoss = fx.scienceBoost ? 1 - fx.scienceBoost : 0;
  const iq = fx.instrumentQuality ? Object.values(fx.instrumentQuality).reduce((s, f) => s + (1 - f), 0) : 0;
  const drop = fx.dropInstrument ? 1 : 0;
  const rep = fx.rep || 0;
  if (smart(style)) return cost * 1 + months * (planet ? 8 : 5) + flaw * 30 + sciLoss * 160 + iq * 70 + drop * 50 - rep * 25;
  return cost * 3 + months * 4 + flaw * 4 + sciLoss * 40 + iq * 20 + drop * 25 - rep * 10; // greedy
}

function chooseEvent(style, ag, p, eventId, r) {
  const e = EVENTS.find((x) => x.id === eventId);
  if (!e) return null;
  if (style === 'clueless') return e.choices[Math.floor(r() * e.choices.length)].id;
  let best = null;
  e.choices.forEach((c) => {
    const pen = choicePenalty(style, p, c.effects);
    if (!best || pen < best.pen) best = { id: c.id, pen };
  });
  return best.id;
}

function answerReview(style, ag, p, review, r) {
  const qs = A.reviewQuestions(ag, p, review);
  const ans = {};
  qs.forEach((q) => {
    if (style === 'clueless') ans[q.id] = q.options[Math.floor(r() * q.options.length)].id;
    else if (style !== 'greedy') {
      const pref = { power: 'fix', tests: 'test', reserve: ag.money > 150 ? 'keep' : 'descope', go: 'go' }[q.id];
      ans[q.id] = q.options.some((o) => o.id === pref) ? pref : q.options[0].id;
    } else {
      const pref = { power: 'accept', tests: 'skip', reserve: 'descope', go: 'go' }[q.id];
      ans[q.id] = q.options.some((o) => o.id === pref) ? pref : q.options[q.options.length - 1].id;
    }
  });
  return A.resolveReview(ag, p, review, ans);
}

// ---------- Research ----------
// careful: Mars kit, then Venus, then Europa. expert: Mars kit, then Europa first.
const RESEARCH_ORDER = {
  careful: ['amp100', 'dish3', 'sar', 'aero', 'vault', 'iceRadar', 'heavy', 'rec1t', 'cells', 'testlab', 'dual', 'lightPanels', 'rtg'],
  expert: ['amp100', 'dish3', 'vault', 'iceRadar', 'heavy', 'sar', 'aero', 'cells', 'rec1t', 'testlab', 'dual', 'lightPanels', 'rtg'],
  // greedy buys what the next mission needs too, but never pays for reliability.
  greedy: ['amp100', 'dish3', 'sar', 'aero', 'vault', 'iceRadar', 'heavy', 'rec1t', 'cells', 'lightPanels', 'rtg', 'dual', 'testlab'],
};

function research(style, ag, r, st) {
  let bought = 0;
  if (RESEARCH_ORDER[style]) {
    // Buy what the next missions need; save up when the next one is too dear.
    for (const id of RESEARCH_ORDER[style]) {
      if (A.has(ag, id)) continue;
      if (A.buyTech(ag, id)) bought++;
      else break;
    }
  } else {
    const list = TECH.filter((t) => !A.has(ag, t.id) && t.cost <= ag.science);
    if (list.length && r() < 0.6) {
      const t = list[Math.floor(r() * list.length)];
      if (A.buyTech(ag, t.id)) bought++;
    }
  }
  st.secs += bought * TIME.research;
  return bought;
}

// ---------- Mission choice ----------
const PREF = {
  careful: ['jupiter', 'mars', 'venus', 'moon', 'nile', 'weather', 'crew'],
  expert: ['jupiter', 'mars', 'venus', 'moon', 'nile', 'weather', 'crew'],
  greedy: ['jupiter', 'venus', 'mars', 'nile', 'weather', 'moon'],
};
const smart = (style) => style === 'careful' || style === 'expert';
const sciEnd = (key, pl) => pl.launch.scienceStartMs + MISSIONS[key].turns * MISSIONS[key].turnDays * 864e5;

function tryStart(style, ag, r, st) {
  const order = style === 'clueless' ? Object.keys(CONTRACTS).sort(() => r() - 0.5) : PREF[style];
  for (const key of order) {
    if (A.busyTeams(ag) >= ag.teams) return;
    if (A.contractState(ag, key) !== 'open') continue;
    // Nobody sensible flies a mission without its headline instrument.
    const keys = KEY_INST(key);
    if (style !== 'clueless' && keys.length && !A.parts(ag).instruments.some((id) => keys.includes(id))) continue;
    let d;
    let tp;
    let conf;
    if (style === 'clueless') {
      const learned = st.failures > 0 && r() < 0.6;
      d = learned ? provenDesign(ag, key) : randomDesign(ag, key, r);
      tp = learned ? 'standard' : ['basic', 'standard', 'thorough'][Math.floor(r() * 3)];
      conf = ['lean', 'standard', 'safe'][Math.floor(r() * 3)];
      if (r() < 0.35) continue; // browses the board and leaves
      let res = A.approve(ag, d, tp, conf);
      for (let k = 0; k < 4 && !res.ok && res.why === 'lift'; k++) {
        d = randomDesign(ag, key, r);
        res = A.approve(ag, d, tp, conf);
      }
      st.secs += TIME.design.clueless + (st.approved.length ? 0 : TIME.firstDesign);
      if (res.ok) record(ag, st, res.project, learned ? 'proven' : 'random');
      continue;
    }
    tp = smart(style) ? 'standard' : 'basic';
    conf = smart(style) ? 'standard' : 'lean';
    // The design search only reruns when research changes what can be built.
    // (and again when the remembered design has stopped working, e.g. it now ends too late).
    const memoKey = key + '|' + ag.tech.slice().sort().join(',');
    let best = st.designMemo[memoKey];
    if (best) {
      best = { d: { ...best.d, instruments: best.d.instruments.slice() }, pl: A.plan(ag, best.d, tp, conf), year: best.year };
      const broken = !best.pl.launch || best.pl.launch.launchMargin < 0 || sciEnd(key, best.pl) > CAREER.end;
      if (broken && best.year !== new Date(ag.now).getUTCFullYear()) best = null;
    }
    if (!best) {
      const start = style === 'greedy' ? cheapStart(ag, key) : provenDesign(ag, key);
      best = search(ag, start, tp, conf, WEIGHTS[smart(style) ? 'careful' : style], smart(style) ? 60 : 40);
      st.designMemo[memoKey] = { d: best.d, year: new Date(ag.now).getUTCFullYear() };
    }
    let pl = best.pl;
    if (!pl.launch || pl.launch.launchMargin < 0) {
      if (process.env.SIM_DEBUG) console.log(`  skip ${key}: too heavy`);
      continue;
    }
    const check = Object.fromEntries(A.checks(ag, pl).map((c) => [c.id, c.ok]));
    const why = (msg) => process.env.SIM_DEBUG && console.log(`  [${ym(A.monthsBetween(CAREER.start, ag.now))}] skip ${key}: ${msg}`);
    if (smart(style)) {
      if (check.money === 'bad') {
        why(`money: needs ${Math.round(pl.cost.total)}M, has ${Math.round(ag.money)}M`);
        continue;
      }
      if (!pl.expected || pl.expected.total < 60) {
        why(`science ${pl.expected && Math.round(pl.expected.total)}`);
        continue;
      }
      // Spend the wait for the window on thorough tests when they fit before it.
      const plT = A.plan(ag, best.d, 'thorough', conf);
      if (plT.launch && plT.launch.launchMargin >= 0 && A.monthsBetween(pl.launch.launch.departMs, plT.launch.launch.departMs) <= 0 && plT.launch.waitMonths >= 3) {
        tp = 'thorough';
        pl = plT;
      }
      // Approve close to the window so the team is not stuck waiting.
      if (MISSIONS[key].kind === 'planet' && pl.launch.waitMonths > 10) {
        why(`wait ${pl.launch.waitMonths.toFixed(0)} months`);
        continue;
      }
      // Keep a little slack before the window closes; otherwise plan for the next one.
      if (MISSIONS[key].kind === 'planet' && pl.launch.waitMonths < 1.5 && A.monthsBetween(pl.readyMs, pl.launch.launch.departMs) < 2) {
        why('too tight for this window');
        continue;
      }
      // Do not start what cannot finish before the end of 2036.
      if (sciEnd(key, pl) > CAREER.end) {
        why(`science ends ${A.fmtMonth(sciEnd(key, pl))}`);
        continue;
      }
    } else if (check.money === 'bad') continue; // even a greedy player stops at a red budget
    const res = A.approve(ag, best.d, tp, conf);
    st.secs += TIME.design[smart(style) ? 'careful' : style] + (st.approved.length ? 0 : TIME.firstDesign);
    if (res.ok) record(ag, st, res.project, 'search');
  }
}

function cheapStart(ag, key) {
  const d = provenDesign(ag, key);
  const keys = KEY_INST(key);
  const p = A.parts(ag);
  const k = d.instruments.find((id) => keys.includes(id)) || p.instruments.find((id) => keys.includes(id));
  d.instruments = k ? [k] : d.instruments;
  d.margin = 0;
  return A.applyTech(ag, d);
}

function record(ag, st, p, how) {
  st.approved.push({ key: p.missionKey, month: A.monthsBetween(CAREER.start, ag.now), launchMonth: A.monthsBetween(CAREER.start, p.launchMs), how, cost: Math.round(p.buildCost + p.launcherCost) });
}

// ---------- One career ----------
function playCareer(style, seed, opts = {}) {
  const ag = A.newAgency(`${style} agency`, seed);
  const r = rng(seed * 31 + style.length);
  const st = {
    style,
    seed,
    stops: 0,
    secs: 0,
    approved: [],
    failures: 0,
    waitedFor: {},
    log: [],
    unlocks: {},
    firstLaunch: null,
    firstResult: null,
    firstResultStops: null,
    firstResultSecs: null,
    moneyByYear: {},
    minMoney: ag.money,
    brokeMonths: 0,
    idleMonths: 0,
    idleEarly: 0,
    longestIdle: 0,
    idleRun: 0,
    idleStops: 0,
    sciEarned: 0,
    results: [],
    missed: 0,
    headlineMonths: {},
    reviews: 0,
    events: 0,
    launches: [],
    waits: 0,
    designMemo: {},
  };
  const month = () => A.monthsBetween(CAREER.start, ag.now);
  let guard = 0;
  while (!A.isOver(ag) && guard++ < 600) {
    research(style, ag, r, st);
    if (style !== 'clueless' || r() < 0.5) tryStart(style, ag, r, st);
    const freeTeam = A.busyTeams(ag) < ag.teams;
    const wantTeam = smart(style) ? ag.money > CAREER.hireTeamCost + 350 && ag.rep >= 2 : style === 'greedy' ? ag.money > CAREER.hireTeamCost + 150 : r() < 0.05;
    if (!freeTeam && ag.teams < CAREER.maxTeams && wantTeam && A.hireTeam(ag)) st.secs += TIME.hire;
    // Press "Skip to next event".
    const n = A.monthsToNextEvent(ag);
    st.stops++;
    st.secs += TIME.skip;
    const activeAtStart = ag.projects.some((p) => p.status === 'dev' || p.status === 'ready' || p.status === 'flying');
    if (!activeAtStart) st.idleStops++;
    let wasBroke = ag.money < 0;
    for (let i = 0; i < n; i++) {
      const evs = A.advance(ag);
      st.secs += TIME.perMonth;
      const busy = ag.projects.some((p) => p.status === 'dev' || p.status === 'ready');
      if (!busy) {
        st.idleMonths++;
        if (ag.now < Date.UTC(2033, 0, 1)) st.idleEarly++;
        st.idleRun++;
        st.longestIdle = Math.max(st.longestIdle, st.idleRun);
      } else st.idleRun = 0;
      if (new Date(ag.now).getUTCMonth() === 0) st.moneyByYear[new Date(ag.now).getUTCFullYear()] = Math.round(ag.money);
      st.minMoney = Math.min(st.minMoney, ag.money);
      if (ag.money < 0) st.brokeMonths++;
      let stop = false;
      for (const e of evs) {
        if (STOP.has(e.type)) stop = true;
        if (e.type === 'review') {
          answerReview(style, ag, e.project, e.review, r);
          st.reviews++;
          st.secs += TIME.review;
        } else if (e.type === 'event') {
          A.resolveEvent(ag, e.project, e.eventId, chooseEvent(style, ag, e.project, e.eventId, r));
          st.events++;
          st.secs += TIME.event;
        } else if (e.type === 'launch') {
          st.secs += TIME.launch;
          if (st.firstLaunch === null) {
            st.firstLaunch = month();
            st.firstLaunchStops = st.stops;
            st.firstLaunchSecs = st.secs;
          }
          st.launches.push({ key: e.project.missionKey, month: month(), missed: !!e.project.missedWindow });
          if (e.project.missedWindow) st.missed++;
        } else if (e.type === 'arrival') st.secs += TIME.arrival;
        else if (e.type === 'unlock') {
          st.secs += TIME.unlock;
          if (st.unlocks[e.missionKey] === undefined) st.unlocks[e.missionKey] = month();
        } else if (e.type === 'complete') {
          const p = e.project;
          st.secs += TIME.complete;
          const res = p.result;
          st.sciEarned += res.reward.science;
          const fail = res.lost || res.score.total < 40;
          if (fail) st.failures++;
          st.results.push({ key: p.missionKey, month: month(), score: Math.round(res.score.total), lost: res.lost, headline: res.success, missed: !!p.missedWindow, test: p.testPlan, conf: p.confidence });
          if (res.success && HEADLINE.includes(p.missionKey) && st.headlineMonths[p.missionKey] === undefined) st.headlineMonths[p.missionKey] = month();
          if (st.firstResult === null) {
            st.firstResult = month();
            st.firstResultStops = st.stops;
            st.firstResultSecs = st.secs;
          }
        }
      }
      const newlyBroke = ag.money < 0 && !wasBroke;
      wasBroke = ag.money < 0;
      if (stop || newlyBroke || A.isOver(ag)) break;
    }
  }
  const spent = TECH.filter((t) => A.has(ag, t.id)).reduce((s, t) => s + t.cost, 0);
  return {
    ...st,
    ag,
    end: month(),
    headlines: ag.headlines.slice(),
    money: Math.round(ag.money),
    rep: ag.rep,
    science: ag.science,
    techSpent: spent,
    techCount: ag.tech.length,
    minutes: st.secs / 60,
    firstResultMinutes: st.firstResultSecs === null ? null : st.firstResultSecs / 60,
  };
}

// ---------- Many careers ----------
const median = (xs) => {
  const v = xs.filter((x) => x !== null && x !== undefined && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.floor(v.length / 2)];
};
const mean = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const ym = (m) => (m === null || m === undefined ? '-' : `${2027 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`);

function summarize(style, runs) {
  const hist = [0, 0, 0, 0];
  runs.forEach((x) => hist[x.headlines.length]++);
  const per = {};
  HEADLINE.forEach((k) => (per[k] = runs.filter((x) => x.headlines.includes(k)).length));
  const years = {};
  for (let y = 2028; y <= 2037; y++) years[y] = median(runs.map((x) => x.moneyByYear[y]));
  const unlock = {};
  Object.keys(CONTRACTS).forEach((k) => (unlock[k] = ym(median(runs.map((x) => (x.unlocks[k] === undefined ? null : x.unlocks[k]))))));
  const results = runs.flatMap((x) => x.results);
  return {
    style,
    careers: runs.length,
    headlines: { mean: +mean(runs.map((x) => x.headlines.length)).toFixed(2), hist, per },
    firstLaunch: ym(median(runs.map((x) => x.firstLaunch))),
    firstLaunchStops: median(runs.map((x) => x.firstLaunchStops)),
    firstLaunchMinutes: +(median(runs.map((x) => x.firstLaunchSecs / 60)) || 0).toFixed(1),
    firstResult: ym(median(runs.map((x) => x.firstResult))),
    firstResultStops: median(runs.map((x) => x.firstResultStops)),
    firstResultMinutes: +(median(runs.map((x) => x.firstResultMinutes)) || 0).toFixed(1),
    stops: median(runs.map((x) => x.stops)),
    minutes: +median(runs.map((x) => x.minutes)).toFixed(1),
    idleMonths: median(runs.map((x) => x.idleMonths)),
    idleEarly: median(runs.map((x) => x.idleEarly)),
    longestIdle: median(runs.map((x) => x.longestIdle)),
    idleStops: median(runs.map((x) => x.idleStops)),
    moneyJan: years,
    minMoney: median(runs.map((x) => Math.round(x.minMoney))),
    brokeMonths: median(runs.map((x) => x.brokeMonths)),
    endMoney: median(runs.map((x) => x.money)),
    sciEarned: median(runs.map((x) => x.sciEarned)),
    techSpent: median(runs.map((x) => x.techSpent)),
    techCount: median(runs.map((x) => x.techCount)),
    unlock,
    missions: median(runs.map((x) => x.results.length)),
    lost: results.filter((x) => x.lost).length,
    failed: results.filter((x) => !x.lost && x.score < 40).length,
    flown: results.length,
    missedWindows: results.filter((x) => x.missed).length,
    headlineMonth: Object.fromEntries(HEADLINE.map((k) => [k, ym(median(runs.map((x) => x.headlineMonths[k])))])),
    endRep: median(runs.map((x) => x.rep)),
  };
}

function runMany(style, seeds, opts = {}) {
  const runs = [];
  for (let s = 1; s <= seeds; s++) runs.push(playCareer(style, (s * 2654435761) >>> 0, opts));
  return { runs, summary: summarize(style, runs) };
}

module.exports = { playCareer, runMany, summarize, PROVEN, provenDesign };

if (require.main === module) {
  const args = process.argv.slice(2);
  const seeds = Number(args.find((a) => /^\d+$/.test(a)) || 20);
  const which = args.find((a) => ['careful', 'expert', 'greedy', 'clueless'].includes(a));
  const styles = which ? [which] : ['careful', 'expert', 'greedy', 'clueless'];
  const verbose = args.includes('--verbose');
  const pi = args.indexOf('--patch');
  if (pi >= 0) require(path.resolve(args[pi + 1]))(D, A); // try numbers without editing data.js
  const out = [];
  for (const style of styles) {
    const t0 = Date.now();
    const { runs, summary } = runMany(style, seeds);
    summary.simSeconds = +((Date.now() - t0) / 1000).toFixed(1);
    out.push(summary);
    if (verbose) {
      runs.slice(0, 3).forEach((x) => {
        console.log(`\n# ${style} seed ${x.seed}: headlines ${x.headlines.join(',') || '-'}  money ${x.money}  rep ${x.rep}  stops ${x.stops}  ~${x.minutes.toFixed(0)} min`);
        x.approved.forEach((a) => console.log(`  ${ym(a.month)} approve ${a.key} (${a.how}) launch ${ym(a.launchMonth)} $${a.cost}M`));
        x.launches.forEach((a) => console.log(`  ${ym(a.month)} LAUNCH ${a.key}${a.missed ? ' (missed window)' : ''}`));
        x.results.forEach((a) => console.log(`  ${ym(a.month)} result ${a.key} ${a.lost ? 'LOST' : a.score}${a.headline ? ' headline' : ''}${a.missed ? ' missed-window' : ''} [${a.test}/${a.conf}]`));
        console.log('  money Jan:', JSON.stringify(x.moneyByYear), ' tech:', x.ag.tech.join(','));
      });
    }
  }
  if (args.includes('--json')) console.log(JSON.stringify(out, null, 1));
  else
    out.forEach((s) => {
      console.log(`\n== ${s.style} (${s.careers} careers, ${s.simSeconds}s)`);
      console.log(`headlines mean ${s.headlines.mean} hist[0,1,2,3]=${s.headlines.hist.join('/')} per ${JSON.stringify(s.headlines.per)} at ${JSON.stringify(s.headlineMonth)}`);
      console.log(`first launch ${s.firstLaunch} after ${s.firstLaunchStops} stops (~${s.firstLaunchMinutes} min), first result ${s.firstResult} after ${s.firstResultStops} stops (~${s.firstResultMinutes} min); total stops ${s.stops} (~${s.minutes} min)`);
      console.log(`idle months ${s.idleMonths} (${s.idleEarly} before 2033, longest ${s.longestIdle}, idle stops ${s.idleStops}); missions ${s.missions}/career; flown ${s.flown} lost ${s.lost} failed ${s.failed} missedWindows ${s.missedWindows}`);
      console.log(`money Jan ${JSON.stringify(s.moneyJan)} min ${s.minMoney} broke months ${s.brokeMonths} end ${s.endMoney}`);
      console.log(`science earned ${s.sciEarned}, tech spent ${s.techSpent} (${s.techCount} techs), end rep ${s.endRep}`);
      console.log(`unlock ${JSON.stringify(s.unlock)}`);
    });
}
