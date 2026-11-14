// Mission review: the NASA systems-engineering view of a finished flight.
//
// Pure logic (runs in Node for tests); js/team/view-debrief.js draws it. It turns what the
// sim already computed into the ideas NASA's own mission-design resources teach:
//   - the four mission SEGMENTS (launch, space, ground, user) from "Design and Develop
//     Science Missions",
//   - game progress labels inspired by JPL's Concept Maturity Levels (CML),
//   - a study-type analogy inspired by NASA's Mission Design Lab (MDL),
//   - "your ship vs the real mission" (numbers from content/realMissions.js),
//   - a ConOps timeline of the flight, and
//   - a short learning check with a teacher CSV.
// Nothing here changes the simulation or the score.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};

  const T = (k, en, p) => {
    if (SMD.t) return SMD.t(k, en, p);
    return p ? String(en).replace(/\{(\w+)\}/g, (m, n) => (p[n] == null ? m : p[n])) : en;
  };

  const RANK = { ok: 0, warn: 1, bad: 2 };
  const worst = (...xs) => xs.filter(Boolean).reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'ok');
  const num = (x, d = 0) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);
  const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '\u2013');

  // ---------- Names of what the team picked ----------
  function namesOf(sim, design) {
    const out = {};
    try {
      const cat = sim.catalog(design.scenario, design.difficulty);
      Object.values(cat.roles || {}).forEach((steps) =>
        steps.forEach((st) => {
          out[st.key] = {};
          (st.options || []).forEach((o) => (out[st.key][o.id] = o.name || o.id));
        })
      );
    } catch (e) {}
    const picks = (design && design.picks) || {};
    const one = (key) => (out[key] && out[key][picks[key]]) || picks[key] || '';
    const many = (key) => (Array.isArray(picks[key]) ? picks[key] : []).map((id) => (out[key] && out[key][id]) || id);
    return { one, many };
  }

  // ---------- 1. The four segments ----------
  // Launch: the rocket and the route. Space: the spacecraft. Ground: the stations and the
  // radio link that bring data home. User: the scientists who use what comes back.
  function segments(sim, design, result, summary) {
    const res = sim.resources(design);
    const nm = namesOf(sim, design);
    const r = result || {};
    const sc = (sim.scenarios() || []).find((s) => s.id === design.scenario) || {};
    const req = ((sc.requirements || []).find((q) => q.id === design.requirement) || {}).title || design.requirement || '';
    const sci = Number.isFinite(r.science) ? r.science : null;
    const userStatus = r.success === 'full' ? 'ok' : r.success === 'partial' ? 'warn' : 'bad';
    const list = [
      {
        id: 'launch',
        icon: 'launch',
        title: T('team.rev.seg.launch', 'Launch segment'),
        blurb: T('team.rev.seg.launch.b', 'The rocket that puts it all in space.'),
        status: res.mass.status,
        lines: [
          { label: T('team.rev.l.rocket', 'Rocket'), value: nm.one('launcher') },
          { label: T('team.rev.l.lift', 'Lift needed / available'), value: `${fmt(res.mass.value)} / ${fmt(res.mass.limit)} kg` },
        ],
        keys: ['launcher', 'route', 'propMargin'],
      },
      {
        id: 'space',
        icon: 'space',
        title: T('team.rev.seg.space', 'Space segment'),
        blurb: T('team.rev.seg.space.b', 'The spacecraft and its instruments.'),
        status: worst(res.power.status, res.time.status),
        lines: [
          { label: T('team.rev.l.orbit', 'Orbit'), value: nm.one('orbit') },
          { label: T('team.rev.l.power', 'Power made / used'), value: `${fmt(res.power.value)} / ${fmt(res.power.limit)} W` },
          { label: T('team.rev.l.inst', 'Instruments'), value: nm.many('instruments').join(', ') || '\u2013' },
        ],
        keys: ['orbit', 'panels', 'batteries', 'instruments', 'adcs', 'computer', 'structure', 'lifetime', 'duty'],
      },
      {
        id: 'ground',
        icon: 'ground',
        title: T('team.rev.seg.ground', 'Ground segment'),
        blurb: T('team.rev.seg.ground.b', 'The stations and radio link that bring data home.'),
        status: worst(res.comms.status, res.data.status),
        lines: [
          { label: T('team.rev.l.stations', 'Ground stations'), value: String(res.comms.stations) },
          { label: T('team.rev.l.down', 'Radio can send / science made per day'), value: `${fmt(res.comms.value, 1)} / ${fmt(res.comms.limit, 1)} Gbit` },
        ],
        keys: ['antenna', 'radio', 'ground', 'coding', 'recorder', 'schedule'],
      },
      {
        id: 'user',
        icon: 'user',
        title: T('team.rev.seg.user', 'User segment'),
        blurb: T('team.rev.seg.user.b', 'The scientists who use what comes home.'),
        status: userStatus,
        lines: [
          { label: T('team.rev.l.question', 'Science question'), value: req },
          { label: T('team.rev.l.sci', 'Science returned'), value: sci === null ? '\u2013' : `${fmt(sci)}%` },
          { label: T('team.rev.l.meaning', 'What this result means'), value: T('team.rev.science.meaning', 'This is simulated, requirement-weighted coverage from useful data returned. Surface science contributes separately to the score on landing missions.') },
        ],
        keys: ['requirement'],
      },
    ];
    if (summary && summary.samplesHome != null) list[3].lines.push({ label: T('team.rev.l.samples', 'Samples home'), value: String(summary.samplesHome) });
    return list;
  }

  // ---------- 2. Game progress inspired by Concept Maturity Levels ----------
  // Game-specific progress inspired by early CML language; not a NASA CML assessment.
  // The simplified game steps are idea, feasibility, compare/refly, and all checks passed.
  const cmlNames = () => [
    null,
    { id: 1, name: T('team.rev.cml.1', 'Mission idea'), what: T('team.rev.cml.1.w', 'You picked a science question worth flying.') },
    { id: 2, name: T('team.rev.cml.2', 'Feasibility'), what: T('team.rev.cml.2.w', 'The rocket can lift the spacecraft to its orbit.') },
    { id: 3, name: T('team.rev.cml.3', 'Trade studies'), what: T('team.rev.cml.3.w', 'You flew more than one design and compared them.') },
    { id: 4, name: T('team.rev.cml.4', 'Point design'), what: T('team.rev.cml.4.w', 'One complete design meets every check and does the science.') },
  ];
  function cml(sim, design, result, round) {
    const CML_NAMES = cmlNames();
    const checks = sim.checks(design) || [];
    const hardOk = checks.filter((c) => c.hard).every((c) => c.ok);
    const failing = checks.filter((c) => !c.ok);
    const r = result || {};
    const worked = r.alive !== false && (r.success === 'full' || r.success === 'partial');
    const reached = [true, hardOk, hardOk && (round || 0) >= 1, hardOk && failing.length === 0 && worked];
    let level = 0;
    while (level < 4 && reached[level]) level += 1;
    level = Math.max(1, level);
    const levels = [1, 2, 3, 4].map((i) => ({ ...CML_NAMES[i], reached: i <= level }));
    let next = null;
    if (level < 4) {
      const nx = CML_NAMES[level + 1];
      let hint;
      if (level === 1) hint = T('team.rev.cml.h1', 'Make the launch check pass: the rocket must lift the ship.');
      else if (level === 2) hint = T('team.rev.cml.h2', 'Fly again with a change, and compare the two flights.');
      else if (failing.length) hint = failing[0].text;
      else hint = T('team.rev.cml.h4', 'Get more science home so the mission succeeds.');
      next = { id: nx.id, name: nx.name, hint };
    }
    return { level, levels, next };
  }

  // ---------- 3. Mission Design Lab study-type analogy for each difficulty ----------
  // These names are an educational analogy, not a NASA MDL study assessment.
  function mdl(difficultyId) {
    const m = {
      sandbox: { id: 'office', name: T('team.rev.mdl.office', 'Office Hours'), what: T('team.rev.mdl.office.w', 'Quick brainstorming with no limits.') },
      cadet: { id: 'concept', name: T('team.rev.mdl.concept', 'Concept Development'), what: T('team.rev.mdl.concept.w', 'Is the idea feasible, and what are the risks?') },
      engineer: { id: 'trade', name: T('team.rev.mdl.trade', 'Trade Studies'), what: T('team.rev.mdl.trade.w', 'Compare different designs and choose.') },
      director: { id: 'point', name: T('team.rev.mdl.point', 'Point Design'), what: T('team.rev.mdl.point.w', 'One detailed design with real numbers and a budget.') },
    };
    return m[difficultyId] || m.engineer;
  }

  // ---------- 4. Your ship vs the real mission ----------
  const REAL_KEY = { nile: 'nile', storms: 'weather', moon: 'moon', mars: 'mars', venus: 'venus', europa: 'jupiter' };
  const EYES = 'https://eyes.nasa.gov/';
  function times(you, real) {
    if (!(real > 0) || !(you >= 0)) return null;
    const x = you / real;
    if (x >= 0.95 && x <= 1.05) return T('team.rev.cmp.same', 'about the same');
    if (x > 1) return T('team.rev.cmp.more', '{n}\u00d7 more', { n: x >= 10 ? Math.round(x) : x.toFixed(1) });
    const inv = real / you;
    return T('team.rev.cmp.less', '{n}\u00d7 less', { n: inv >= 10 ? Math.round(inv) : inv.toFixed(1) });
  }
  function realCompare(sim, design) {
    const store = (SMD.content && SMD.content.realMissions) || {};
    const key = REAL_KEY[design.scenario];
    const real = key && store[key];
    if (!real) return null;
    const res = sim.resources(design);
    const rows = [
      { id: 'mass', label: T('team.rev.cmp.mass', 'Launch mass'), you: `${fmt(res.mass.value)} kg`, real: real.launchMassKg != null ? `${fmt(real.launchMassKg)} kg` : '\u2013', diff: times(res.mass.value, real.launchMassKg) },
      { id: 'power', label: T('team.rev.cmp.power', 'Power made'), you: `${fmt(res.power.value)} W`, real: real.powerW != null ? `${fmt(real.powerW)} W` : '\u2013', diff: times(res.power.value, real.powerW) },
      { id: 'cost', label: T('team.rev.cmp.cost', 'Cost'), you: `$${fmt(res.budget.value)}M`, real: real.costM != null ? `$${fmt(real.costM)}M` : '\u2013', diff: times(res.budget.value, real.costM) },
    ];
    return {
      name: real.name,
      launch: real.launch || '',
      rows,
      instruments: real.instruments || [],
      fact: real.fact || '',
      source: real.source || '',
      eyes: EYES,
      scaleNote: T('team.rev.cmp.note', 'Game money and some masses are simplified for play, so read these as ballpark.'),
    };
  }

  // ---------- 5. ConOps timeline ----------
  // The sequence of mission phases from the flight, plus the landing legs when there were any.
  function conops(events, result, summary, ascent) {
    const phases = [];
    const seen = new Set();
    (Array.isArray(events) ? events : []).forEach((e) => {
      if (e && e.kind === 'phase' && e.phase !== 'end' && !seen.has(e.phase)) {
        seen.add(e.phase);
        phases.push({ id: e.phase, label: e.text || e.phase });
      }
    });
    const r = result || {};
    const out = phases.map((p) => ({ ...p }));
    const ops = out.find((p) => p.id === 'ops');
    if (ops && Number.isFinite(r.lifeDays)) ops.note = T('team.rev.con.days', '{n} days of science', { n: fmt(r.lifeDays) });
    if (r.crisesTotal != null) out.push({ id: 'problems', label: T('team.rev.con.crises', 'Problems fixed {a} of {b}', { a: r.crisesFixed || 0, b: r.crisesTotal }) });
    if (summary) out.push({ id: 'surface', label: T('team.rev.con.surface', 'Landing and surface work') });
    if (ascent) out.push({ id: 'ascent', label: T('team.rev.con.ascent', 'Ascent with samples') });
    out.push({ id: 'end', label: r.alive === false ? T('team.rev.con.lost', 'Mission lost') : T('team.rev.con.end', 'End of mission') });
    return out;
  }

  // ---------- 6. Learning check ----------
  const bank = () => [
    { id: 'mass', topic: 'mass', q: T('team.rev.q.mass', 'Why can one heavier instrument force you onto a bigger rocket?'), a: [T('team.rev.q.mass.a', 'The extra mass needs extra propellant, and that propellant has mass too.'), T('team.rev.q.mass.b', 'Rockets refuse any part over 100 kg.'), T('team.rev.q.mass.c', 'Heavy instruments make the orbit rounder.')], ok: 0, why: T('team.rev.q.mass.w', 'This is the rocket equation: mass feeds itself, so every kilogram counts.') },
    { id: 'eclipse', topic: 'power', q: T('team.rev.q.eclipse', 'Why does a spacecraft carry batteries?'), a: [T('team.rev.q.eclipse.a', 'To make the radio louder.'), T('team.rev.q.eclipse.b', 'Solar panels make no power in the planet\u2019s shadow, so batteries carry the load.'), T('team.rev.q.eclipse.c', 'To balance the spacecraft.')], ok: 1, why: T('team.rev.q.eclipse.w', 'Every orbit passes through shadow, so the battery must cover that dark time.') },
    { id: 'recorder', topic: 'data', q: T('team.rev.q.rec', 'Science data waits on the onboard recorder until\u2026'), a: [T('team.rev.q.rec.a', 'the next day begins.'), T('team.rev.q.rec.b', 'a ground station can receive it.'), T('team.rev.q.rec.c', 'the battery is full.')], ok: 1, why: T('team.rev.q.rec.w', 'A spacecraft can only send data home while a ground station is in view.') },
    { id: 'dish', topic: 'comms', q: T('team.rev.q.dish', 'If you double the width of the dish antenna, the signal you can send home gets about\u2026'), a: [T('team.rev.q.dish.a', 'twice as strong.'), T('team.rev.q.dish.b', 'the same.'), T('team.rev.q.dish.c', 'four times as strong.')], ok: 2, why: T('team.rev.q.dish.w', 'Link strength grows with the dish diameter squared.') },
    { id: 'distance', topic: 'comms', q: T('team.rev.q.dist', 'If a spacecraft moves twice as far from Earth, its signal arrives about\u2026'), a: [T('team.rev.q.dist.a', 'a quarter as strong.'), T('team.rev.q.dist.b', 'half as strong.'), T('team.rev.q.dist.c', 'just as strong.')], ok: 0, why: T('team.rev.q.dist.w', 'Signal falls with distance squared, which is why deep space needs big dishes.') },
    { id: 'orbit', topic: 'orbit', q: T('team.rev.q.orbit', 'Compared with a long ellipse, a low circular orbit around a planet usually needs\u2026'), a: [T('team.rev.q.orbit.a', 'a bigger capture burn, so more fuel.'), T('team.rev.q.orbit.b', 'a smaller burn, so less fuel.'), T('team.rev.q.orbit.c', 'no burn at all.')], ok: 0, why: T('team.rev.q.orbit.w', 'Slowing down into a tight orbit costs fuel; an ellipse is cheaper but sees less.') },
    { id: 'rtg', topic: 'power', q: T('team.rev.q.rtg', 'Why do missions to Jupiter often use nuclear power instead of solar panels?'), a: [T('team.rev.q.rtg.a', 'Sunlight there is much weaker, so panels make far less power.'), T('team.rev.q.rtg.b', 'Panels melt near Jupiter.'), T('team.rev.q.rtg.c', 'Nuclear power is always lighter.')], ok: 0, why: T('team.rev.q.rtg.w', 'Sunlight falls with distance squared.') },
    { id: 'ascent', topic: 'surface', q: T('team.rev.q.asc', 'Why can a lander not bring every sample home?'), a: [T('team.rev.q.asc.a', 'Samples lose their value after a day.'), T('team.rev.q.asc.b', 'The ascent fuel can only lift a limited mass.'), T('team.rev.q.asc.c', 'Planets refuse to let samples leave.')], ok: 1, why: T('team.rev.q.asc.w', 'The rocket equation again: more samples need more fuel, which needs more mass.') },
    { id: 'segments', topic: 'systems', q: T('team.rev.q.seg', 'In NASA\u2019s four mission segments, who belongs to the user segment?'), a: [T('team.rev.q.seg.a', 'The launch crew.'), T('team.rev.q.seg.b', 'The ground station dishes.'), T('team.rev.q.seg.c', 'The scientists who use the data.')], ok: 2, why: T('team.rev.q.seg.w', 'The segments are launch, space, ground and user.') },
    { id: 'trade', topic: 'systems', q: T('team.rev.q.trade', 'In a trade study, engineers\u2026'), a: [T('team.rev.q.trade.a', 'compare different designs and choose the best fit.'), T('team.rev.q.trade.b', 'only build the biggest option.'), T('team.rev.q.trade.c', 'swap parts with other teams.')], ok: 0, why: T('team.rev.q.trade.w', 'NASA\u2019s Mission Design Lab runs trade studies to compare mission architectures.') },
  ];

  // Three questions about what actually happened in this flight, topped up from the bank.
  function pickQuestions(sim, design, result, summary) {
    const res = sim.resources(design);
    const r = result || {};
    const want = [];
    if (res.mass.status !== 'ok') want.push('mass');
    if (res.comms.status !== 'ok' || r.unsentGbit > 0 || r.lostGbit > 0) want.push('dish', 'recorder');
    if (res.power.status !== 'ok' || r.brownouts > 0) want.push('eclipse');
    const sc = (sim.scenarios() || []).find((s) => s.id === design.scenario) || {};
    if (sc.surface || summary) want.push('ascent');
    if (design.scenario === 'europa') want.push('rtg', 'distance');
    if (design.scenario === 'mars' || design.scenario === 'venus') want.push('orbit');
    want.push('segments', 'trade', 'mass', 'eclipse', 'recorder');
    const BY_ID = Object.fromEntries(bank().map((q) => [q.id, q]));
    const ids = [];
    for (const id of want) if (BY_ID[id] && !ids.includes(id)) ids.push(id);
    return ids.slice(0, 3).map((id, i) => {
      const q = BY_ID[id];
      return { id: q.id, topic: q.topic, q: q.q, options: q.a.slice(), answer: q.ok, why: q.why, n: i + 1 };
    });
  }
  function grade(questions, picked) {
    const rows = questions.map((q, i) => ({ id: q.id, picked: picked[i], correct: picked[i] === q.answer }));
    return { correct: rows.filter((r) => r.correct).length, total: questions.length, rows };
  }

  // CSV for a teacher: one row per flight, nothing personal.
  const CSV_HEAD = ['when', 'mission', 'difficulty', 'attempt', 'score', 'cml', 'quiz_correct', 'quiz_total', 'questions'];
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  function csvOf(entries) {
    const rows = (Array.isArray(entries) ? entries : []).map((e) => CSV_HEAD.map((k) => cell(Array.isArray(e[k]) ? e[k].join(' ') : e[k])).join(','));
    return [CSV_HEAD.join(',')].concat(rows).join('\n');
  }

  SMD.team.review = { segments, cml, mdl, realCompare, conops, pickQuestions, grade, csvOf, namesOf, CSV_HEAD, bank, REAL_KEY, worst };
  if (typeof module !== 'undefined' && module.exports) module.exports = SMD.team.review;
})();
