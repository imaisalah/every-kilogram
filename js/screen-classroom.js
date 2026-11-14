// Classroom mode (GDD §6, docs/teacher.md): one guided Mars mission a class can
// play in 30–45 minutes. It reuses the real screens (board, designer, HQ,
// reviews, films, results). This file adds three things on top of them:
//   1. the "classroom" screen: the briefing, then the class's mission log;
//   2. a slim coach bar fixed above every screen while the mode is on, with a
//      step panel (what to do, why it matters, which NGSS practice it trains);
//   3. checkpoints: short reflection questions that open at milestones.
// Navigation is watched with a MutationObserver on #app plus a light poll of
// the career state, so no other module (and not SMD.go) is touched.
// State lives in localStorage ('ek-classroom'); the career carries a matching
// classroomId so a normal career never shows the bar.
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const t = (k, e, p) => SMD.t(k, e, p);
  const esc = (s) => ui.esc(s == null ? '' : String(s));

  const KEY = 'ek-classroom';
  const BACKUP = 'ek-save-before-class';
  const MISSION = 'mars';
  // The class starts in January 2029 rather than 2028: a Mars spacecraft takes
  // about 20 months to build, so from 2029 the Jan–Apr 2031 window is in reach
  // with a few months to spare, and a slip (InSight's leak) can really cost it.
  const CLASS_START = Date.UTC(2029, 0, 1);
  const CLASS_MONEY = 650;
  const CLASS_REP = 2;
  const GIFT_TECH = ['dish3', 'amp100', 'aero'];
  const LESSON_MIN = 45;
  const HERO = 'assets/discoveries/mars-ice-cliffs.jpg';

  const A = () => SMD.agency;
  const marsTitle = () => t('mission.mars.title', SMD.data.MISSIONS.mars.title);
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Persistent state ----------
  const fresh = () => ({
    v: 1,
    id: null,
    active: false,
    agencyName: '',
    names: '',
    startedAt: 0,
    teacher: false,
    confidence: null,
    sawDesign: false,
    resultsOpened: false,
    sawResults: false,
    answers: {},
    facts: {},
    popped: {},
    reviewQs: {},
    stepSeen: {},
  });
  let S = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) S = Object.assign(fresh(), JSON.parse(raw));
  } catch (e) {}
  function store() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {}
  }

  function savedCareer() {
    try {
      const raw = localStorage.getItem('ek-save');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Classroom mode is on when the loaded career is the class's career.
  function isOn() {
    const ag = SMD.game && SMD.game.agency;
    return !!(S.active && S.id && ag && ag.classroomId === S.id);
  }
  // On the title screen nothing is loaded yet: is the class career the save?
  function classSaved() {
    const sv = savedCareer();
    return !!(S.active && S.id && sv && sv.classroomId === S.id);
  }

  function proj() {
    const ag = SMD.game.agency;
    if (!ag) return null;
    const list = ag.projects.filter((p) => p.startMs >= CLASS_START);
    return list.find((p) => p.missionKey === MISSION) || list[0] || null;
  }

  // ---------- The lesson: steps ----------
  const PRACTICE = {
    ask: () => t('class.sep.ask', 'Asking questions and defining problems'),
    model: () => t('class.sep.model', 'Developing and using models'),
    data: () => t('class.sep.data', 'Analyzing and interpreting data'),
    math: () => t('class.sep.math', 'Using mathematics and computational thinking'),
    design: () => t('class.sep.design', 'Constructing explanations and designing solutions'),
    argue: () => t('class.sep.argue', 'Engaging in argument from evidence'),
    info: () => t('class.sep.info', 'Obtaining, evaluating and communicating information'),
  };

  const STEPS = [
    {
      id: 'brief',
      min: 3,
      screens: ['classroom'],
      title: () => t('class.s.brief', 'Mission briefing'),
      short: () => t('class.s.brief.short', 'Read the science question, name your agency, start.'),
      todo: () => [t('class.s.brief.1', 'Read the science question: is there ice buried under the dust of Mars?'), t('class.s.brief.2', 'Name your agency and write who is flying it.'), t('class.s.brief.3', 'Press “Start the mission”.')],
      why: () => t('class.s.brief.why', 'Engineers start from a science question, not from a spacecraft. Every part you add later has to help answer it. Buried ice matters because future crews could drink it, breathe it and turn it into rocket fuel.'),
      sep: ['ask'],
      ngss: ['MS-ETS1-1', 'HS-ETS1-1'],
      teach: () => t('class.s.brief.teach', 'Hook: show the ice-cliff photo. Ask: “Why would astronauts care where the ice is?” Water to drink, oxygen to breathe, hydrogen for fuel.'),
    },
    {
      id: 'propose',
      min: 4,
      screens: ['board'],
      title: () => t('class.s.propose', 'Write the proposal'),
      short: () => t('class.s.propose.short', 'Choose how much reserve to ask for.'),
      todo: () => [t('class.s.propose.1', 'On the mission board, open “{m}” and write a proposal.', { m: marsTitle() }), t('class.s.propose.2', 'Choose a cost confidence: Lean, Standard or Safe.'), t('class.s.propose.3', 'Press “Start designing”.')],
      why: () => t('class.s.propose.why', 'A reserve is money held back for surprises. NASA’s Discovery missions must keep about 25%. Too little and one surprise becomes an overrun; too much and less of the budget builds spacecraft.'),
      sep: ['ask'],
      ngss: ['MS-ETS1-1', 'HS-ETS1-1'],
      teach: () => t('class.s.propose.teach', 'Before they click, ask each pair to say their choice and one reason out loud. Lean earns +1 reputation if it works, but cost growth past 15% notifies Congress.'),
    },
    {
      id: 'design',
      min: 12,
      screens: ['design'],
      title: () => t('class.s.design', 'Design the spacecraft'),
      short: () => t('class.s.design.short', 'Turn every requirement green, then approve.'),
      todo: () => [
        t('class.s.design.1', 'Add the shallow radar sounder: it is the instrument that can see ice under the dust.'),
        t('class.s.design.2', 'Turn the requirements green: lift, power, science, budget.'),
        t('class.s.design.3', 'Watch the every-kilogram ribbon: what does 1 kg of hardware add at launch?'),
        t('class.s.design.4', 'Save two options in the trade study, compare them, then approve the better one.'),
      ],
      why: () => t('class.s.design.why', 'Every kilogram needs propellant to push it, and that propellant has mass too (the rocket equation). Sunlight at Mars is only 586 W/m², 43% of Earth’s 1,361, so solar panels must be bigger.'),
      sep: ['model', 'design'],
      ngss: ['MS-ETS1-2', 'MS-ETS1-4', 'HS-ETS1-2'],
      teach: () => t('class.s.design.teach', 'Circulate and ask: “What did that kilogram cost you?” Stuck pairs can press “Load a proven design” (close to the real MRO) and then change one thing.'),
    },
    {
      id: 'build',
      min: 8,
      screens: ['hq', 'review'],
      title: () => t('class.s.build', 'Build it: reviews and surprises'),
      short: () => t('class.s.build.short', 'Skip to the next event; answer every board and card.'),
      todo: () => [t('class.s.build.1', 'In HQ, press “Skip to next event” to move the calendar.'), t('class.s.build.2', 'Answer each review board (PDR, CDR, FRR) using the numbers they show you.'), t('class.s.build.3', 'Read the “This really happened” story on each event card before you choose.')],
      why: () => t('class.s.build.why', 'Real projects pass a review board at the end of each phase. A problem is cheap to fix on paper, expensive in the clean room and often impossible after launch.'),
      sep: ['argue'],
      ngss: ['HS-ETS1-3', 'MS-ETS1-3', 'HS-ETS1-2'],
      teach: () => t('class.s.build.teach', 'Pause the class at the first event card. Read its real story aloud, let pairs vote, then reveal what NASA did.'),
    },
    {
      id: 'fly',
      min: 3,
      screens: ['hq', 'film', 'map'],
      title: () => t('class.s.fly', 'Launch and cruise'),
      short: () => t('class.s.fly.short', 'Watch the launch, then follow the trip on the map.'),
      todo: () => [t('class.s.fly.1', 'Watch the launch film.'), t('class.s.fly.2', 'Open the Solar system map to see where your spacecraft is.'), t('class.s.fly.3', 'Skip ahead: the trip to Mars takes about 7 to 9 months.')],
      why: () => t('class.s.fly.why', 'Earth and Mars line up for a low-energy trip only about every 26 months. Gravity bends the path into half an ellipse around the Sun that meets Mars where it will be, not where it is.'),
      sep: ['math'],
      ngss: ['HS-ESS1-4', 'HS-PS2-4'],
      teach: () => t('class.s.fly.teach', 'Ask: “Why can’t we launch in any month we like?” The planets move; the transfer orbit has to arrive where Mars will be.'),
    },
    {
      id: 'science',
      min: 3,
      screens: ['hq', 'film', 'map'],
      title: () => t('class.s.science', 'Arrive and do science'),
      short: () => t('class.s.science.short', 'Watch the arrival, then run the science year.'),
      todo: () => [t('class.s.science.1', 'Watch the arrival: radio signals take minutes to cross the gap to Earth.'), t('class.s.science.2', 'Skip ahead through the science year until the results open.')],
      why: () => t('class.s.science.why', 'At arrival the spacecraft is on its own: a command from Earth takes up to 22 minutes to reach Mars. Science comes home only as fast as the dish, the radio and the ground antennas allow.'),
      sep: ['model'],
      ngss: ['HS-ETS1-4', 'HS-ESS1-4'],
      teach: () => t('class.s.science.teach', 'Ask: “What limits your science now: the instruments, the power or the radio link?”'),
    },
    {
      id: 'results',
      min: 5,
      screens: ['results'],
      title: () => t('class.s.results', 'Read the results'),
      short: () => t('class.s.results.short', 'Find the score and the decision that mattered most.'),
      todo: () => [t('class.s.results.1', 'Find your science score and whether you earned the headline.'), t('class.s.results.2', 'Read “What shaped this mission”: each line reruns your flight with one change.'), t('class.s.results.3', 'Compare your spacecraft with the real Mars Reconnaissance Orbiter.')],
      why: () => t('class.s.results.why', 'Engineers learn by asking what each decision did. A what-if rerun is the same flight with one change and the same luck, so the difference comes from that change alone.'),
      sep: ['data'],
      ngss: ['HS-ETS1-4', 'MS-ETS1-3'],
      teach: () => t('class.s.results.teach', 'Ask each pair for the one decision that mattered most, with its number.'),
    },
    {
      id: 'debrief',
      min: 7,
      screens: ['classroom'],
      title: () => t('class.s.debrief', 'Debrief'),
      short: () => t('class.s.debrief.short', 'Finish the exit ticket and hand in the mission log.'),
      todo: () => [t('class.s.debrief.1', 'Open the mission log and fill any empty answers.'), t('class.s.debrief.2', 'Write the exit ticket.'), t('class.s.debrief.3', 'Print or download the log for your teacher.')],
      why: () => t('class.s.debrief.why', 'Engineering is a loop: define the problem, design, test, learn, and design again. Your log is the evidence for what you would change next time.'),
      sep: ['info', 'argue'],
      ngss: ['MS-ETS1-2', 'HS-ETS1-3'],
      teach: () => t('class.s.debrief.teach', 'Run two discussion questions (teacher sheet §5), then collect the logs or the downloaded files.'),
    },
  ];
  const stepIndex = (id) => STEPS.findIndex((s) => s.id === id);

  function currentStep() {
    if (!isOn()) return 'brief';
    const p = proj();
    if (!p) return S.sawDesign ? 'design' : 'propose';
    if (p.status === 'dev' || p.status === 'ready') return 'build';
    if (p.status === 'flying') return p.arrived ? 'science' : 'fly';
    return S.sawResults ? 'debrief' : 'results';
  }

  // Where "Take me there" goes for a step.
  function goStep(id) {
    const p = proj();
    if (id === 'brief' || id === 'debrief') return SMD.go('classroom');
    if (id === 'propose') return SMD.go('board', { missionKey: MISSION });
    if (id === 'design') return SMD.go('design', { missionKey: MISSION, confidence: S.confidence || 'standard' });
    if (id === 'results' && p) return SMD.go('results', { projectId: p.id });
    return SMD.go('hq', { resume: true });
  }

  // ---------- Checkpoints ----------
  const CHECKPOINTS = [
    {
      id: 'proposal',
      on: ['design', 'hq', 'classroom'],
      title: () => t('class.c.proposal', 'Your proposal'),
      ready: () => S.sawDesign || !!proj(),
      sep: 'ask',
      ngss: ['MS-ETS1-1'],
      prompts: [{ id: 'reserve', q: () => t('class.c.proposal.q', 'Which reserve did you ask for, and why? What could go wrong if the reserve is too small?') }],
      hint: () => t('class.c.proposal.hint', 'Look for a reason tied to risk. Lean asks for little (+1 reputation if it works) but a 10% reserve turns one surprise into an overrun; past 15% growth Congress is notified. Standard is NASA’s 25% Discovery rule. Safe holds 40% and costs more up front.'),
    },
    {
      id: 'design',
      on: ['hq', 'classroom'],
      title: () => t('class.c.design', 'Your design'),
      ready: () => !!proj(),
      sep: 'model',
      ngss: ['MS-ETS1-2', 'MS-ETS1-4'],
      prompts: [
        { id: 'tradeoff', q: () => t('class.c.design.q1', 'What was your biggest trade-off? Say what you gave up and what you got, with a number.') },
        { id: 'predict', kind: 'number', q: () => t('class.c.design.q2', 'Predict: how many of the 100 science points will come home?') },
        { id: 'predictWhy', short: true, q: () => t('class.c.design.q3', 'Why do you predict that?') },
      ],
      hint: () => t('class.c.design.hint', 'Strong answers name both sides with numbers (“the 3 m dish adds mass, and the launch mass grows by more than the dish itself, but the data rate doubles”). Without the radar sounder the headline goal cannot score. Any prediction is fine if it has a reason; the class checks it at the end.'),
    },
    {
      id: 'review',
      on: ['hq', 'classroom'],
      title: () => t('class.c.review', 'The review board'),
      ready: () => {
        const p = proj();
        return !!(p && (p.reviews.PDR || p.reviews.CDR || p.reviews.FRR));
      },
      sep: 'argue',
      ngss: ['HS-ETS1-3'],
      prompts: [{ id: 'board', q: () => t('class.c.review.q', 'What did the board ask, what did you decide, and what evidence did you use?') }],
      hint: () => t('class.c.review.hint', 'Good answers quote the board’s number (“power margin 8%, engineers want 20%”) and weigh the cost of fixing now against the risk later. Fixing on paper is always cheaper than fixing in flight.'),
    },
    {
      id: 'event',
      on: ['hq', 'classroom'],
      optional: true,
      title: () => t('class.c.event', 'A real NASA story'),
      ready: () => {
        const p = proj();
        return !!(p && p.events.some((e) => e.resolved && e.choice));
      },
      sep: 'info',
      ngss: ['HS-ETS1-1', 'HS-ETS1-3'],
      prompts: [{ id: 'story', q: () => t('class.c.event.q', 'What did you choose, and why? What really happened to NASA, and what rule would have prevented it?') }],
      hint: () => t('class.c.event.hint', 'Link the story to a process fix: test end to end, have a second team cross-check, add margin, re-verify parts that “flew before”.'),
      none: () => t('class.c.event.none', 'No event card came up before launch this time. Ask your teacher for a story from the teacher sheet.'),
    },
    {
      id: 'launch',
      on: ['hq', 'map', 'classroom'],
      title: () => t('class.c.launch', 'The launch window'),
      ready: () => {
        const p = proj();
        return !!(p && (p.status === 'flying' || p.status === 'done') && p.launchMs <= SMD.game.agency.now);
      },
      sep: 'math',
      ngss: ['HS-ESS1-4', 'HS-PS2-4'],
      prompts: [{ id: 'window', q: () => t('class.c.launch.q', 'When did you launch, and how long is the trip? Why can’t a Mars mission launch in any month it likes?') }],
      hint: () => t('class.c.launch.hint', 'Earth and Mars line up for a low-energy transfer about every 26 months. The transfer is half an ellipse around the Sun, about 7 to 9 months. Missing a window means a two-year wait and storage costs (InSight: about $153.8M).'),
    },
    {
      id: 'results',
      on: ['hq', 'classroom', 'map', 'archive'],
      title: () => t('class.c.results', 'What shaped your mission'),
      ready: () => S.sawResults,
      sep: 'data',
      ngss: ['HS-ETS1-4', 'MS-ETS1-3'],
      prompts: [
        { id: 'mattered', q: () => t('class.c.results.q1', 'Which one decision mattered most? Use a number from “What shaped this mission”.') },
        { id: 'compare', q: () => t('class.c.results.q2', 'Was your prediction close? What explains the difference: the design, the decisions or luck?') },
      ],
      hint: () => t('class.c.results.hint', 'Look for one what-if line quoted with its number, and a fair comparison with the prediction. Hidden flaws that slipped through testing count as luck only if no test could have caught them.'),
    },
    {
      id: 'exit',
      on: [],
      log: true,
      title: () => t('class.c.exit', 'Exit ticket'),
      ready: () => S.sawResults,
      sep: 'info',
      ngss: ['MS-ETS1-2', 'HS-ETS1-3'],
      prompts: [
        { id: 'exitTrade', q: () => t('class.c.exit.q1', 'One trade-off we made was … because …') },
        { id: 'exitLesson', q: () => t('class.c.exit.q2', 'One real NASA lesson we will remember is …') },
      ],
      hint: () => t('class.c.exit.hint', 'One sentence each. The “because” should carry a number or a real story.'),
    },
  ];
  const cpById = (id) => CHECKPOINTS.find((c) => c.id === id);
  const answered = (c) => c.prompts.every((q) => String(S.answers[q.id] || '').trim());

  // ---------- Facts the class did (snapshots for the log) ----------
  const instName = (id) => {
    const i = SMD.data.INSTRUMENTS[id];
    return i ? t('inst.' + id, i.name) : id;
  };
  const confName = (id) => {
    const c = A().CONFIDENCE[id];
    return c ? t('class.f.confv', '{name}, {pct}% reserve', { name: t('conf.' + id, c.name), pct: Math.round(c.reserve * 100) }) : '–';
  };
  const launcherName = (id) => {
    const o = (SMD.data.OPTIONS.launcher || []).find((x) => x.id === id);
    return o ? o.name || id : id;
  };

  function designFacts(p) {
    const out = [];
    let ev = null;
    try {
      ev = SMD.model.evaluate(p.design, p.launch, { readyMs: p.readyMs });
    } catch (e) {}
    out.push([t('class.f.craft', 'Spacecraft'), p.design.name]);
    out.push([t('class.f.inst', 'Instruments'), p.design.instruments.map(instName).join(', ') || '–']);
    if (ev && ev.launch) {
      out.push([t('class.f.mass', 'Launch mass'), t('class.f.massv', '{wet} kg ({dry} kg dry, the real MRO: 2,180 kg)', { wet: ui.fmt(ev.launch.wet), dry: ui.fmt(ev.launch.dry) })]);
      out.push([t('class.f.power', 'Power at Mars'), t('class.f.powerv', 'Makes {make} W, needs {need} W', { make: ui.fmt(ev.base.powerAvail), need: ui.fmt(ev.base.powerReq) })]);
    }
    out.push([t('class.f.radio', 'Radio'), t('class.f.radiov', '{d} m dish, {w} W radio', { d: p.design.dish, w: p.design.amp })]);
    out.push([t('class.f.launcher', 'Launcher'), launcherName(p.design.launcher)]);
    out.push([t('class.f.cost', 'Build cost'), ui.money(p.buildCost)]);
    out.push([t('class.f.expect', 'Expected science'), t('class.f.expectv', 'About {n} of 100 points if nothing breaks', { n: Math.round(p.expected || 0) })]);
    out.push([t('class.f.launch', 'Planned launch'), ui.monthYear(p.launchMs)]);
    return out;
  }

  function reviewFacts(p) {
    const out = [];
    ['PDR', 'CDR', 'FRR'].forEach((r) => {
      const rv = p.reviews[r];
      if (!rv) return;
      const qs = S.reviewQs[r] || [];
      const lines = Object.entries(rv.answers || {}).map(([qid, oid]) => {
        const q = qs.find((x) => x.id === qid);
        const o = q && q.options.find((x) => x.id === oid);
        return q ? `${q.text} → ${o ? o.label : oid}` : `${qid} → ${oid}`;
      });
      out.push([r, lines.join(' · ') || t('class.f.passed', 'Passed')]);
    });
    return out;
  }

  function eventFacts(p) {
    const list = (SMD.content && SMD.content.events) || [];
    return p.events
      .filter((s) => s.resolved && s.choice)
      .map((s) => {
        const e = list.find((x) => x.id === s.id);
        if (!e) return null;
        const ch = e.choices.find((c) => c.id === s.choice);
        const k = 'content.events.' + e.id + '.';
        const story = e.realStory ? t('class.f.story', '{mission}, {year}: {lesson}', { mission: t(k + 'mission', e.realStory.mission), year: e.realStory.year, lesson: t(k + 'lesson', e.realStory.lesson) }) : '';
        return [t(k + 'title', e.title), `${t('class.f.chose', 'We chose:')} ${ch ? t(k + 'choice.' + ch.id, ch.label) : s.choice}${story ? ` — ${story}` : ''}`];
      })
      .filter(Boolean);
  }

  function launchFacts(p) {
    const out = [];
    out.push([t('class.f.ready', 'Built and ready'), ui.monthYear(p.readyMs)]);
    out.push([t('class.f.launched', 'Launched'), ui.monthYear(p.launchMs)]);
    out.push([t('class.f.arrive', 'Arrives at Mars'), ui.monthYear(p.arriveMs)]);
    out.push([t('class.f.trip', 'Trip'), t('class.f.tripv', '{n} months', { n: Math.max(1, A().monthsBetween(p.launchMs, p.arriveMs)) })]);
    out.push([t('class.f.wait', 'Waited for the window'), t('class.f.tripv', '{n} months', { n: Math.max(0, A().monthsBetween(p.readyMs, p.launchMs)) })]);
    if (p.missedWindow) out.push([t('class.f.missed', 'Window'), t('class.f.missedv', 'Missed one window and waited for the next')]);
    return out;
  }

  function resultFacts(p) {
    const out = [];
    const r = p.result;
    if (!r) return out;
    const sc = r.score && r.score.total;
    out.push([t('class.f.score', 'Science score'), r.lost ? t('class.f.lost', 'Spacecraft lost') : t('class.f.scorev', '{n} of 100', { n: Math.round(sc) })]);
    out.push([t('class.f.headline', 'Headline'), r.success ? t('class.f.yes', 'Earned') : t('class.f.no', 'Not earned')]);
    const pred = S.answers.predict;
    if (pred !== undefined && String(pred).trim() !== '') out.push([t('class.f.pred', 'Our prediction'), t('class.f.predv', '{n} points (off by {d})', { n: pred, d: Math.abs(Math.round(Number(pred) - (sc || 0))) })]);
    out.push([t('class.f.reward', 'Reward'), t('class.f.rewardv', 'Reputation {rep}, science {sci}, money {m}', { rep: ui.signed(r.reward.rep), sci: ui.signed(r.reward.science), m: ui.money(r.reward.money) })]);
    try {
      A()
        .lessons(SMD.game.agency, p)
        .slice(0, 3)
        .forEach((l) => out.push([t('class.f.shaped', 'What shaped it'), l.text]));
    } catch (e) {}
    if (r.discoveries && r.discoveries.length) out.push([t('class.f.disc', 'Real discoveries unlocked'), String(r.discoveries.length)]);
    return out;
  }

  // Refresh the snapshots whose source can still change, keep the rest.
  function snapshot(id) {
    const p = proj();
    let f = null;
    if (id === 'proposal') f = [[t('class.f.conf', 'Cost confidence'), confName((p && p.confidence) || S.confidence || 'standard')]];
    if (!p) return f;
    if (id === 'design') f = designFacts(p);
    if (id === 'review') f = reviewFacts(p);
    if (id === 'event') f = eventFacts(p);
    if (id === 'launch') f = launchFacts(p);
    if (id === 'results') f = resultFacts(p);
    return f;
  }

  function syncFacts() {
    const p = proj();
    let dirty = false;
    CHECKPOINTS.forEach((c) => {
      if (!c.ready()) return;
      // Design numbers are fixed at approval; review, event and result facts grow.
      const frozen = (c.id === 'design' || c.id === 'proposal' || c.id === 'results' || c.id === 'launch') && S.facts[c.id];
      if (frozen) return;
      const f = snapshot(c.id);
      if (f && JSON.stringify(f) !== JSON.stringify(S.facts[c.id])) {
        S.facts[c.id] = f;
        dirty = true;
      }
    });
    if (p && p.status === 'done' && !S.facts.results && S.sawResults) {
      S.facts.results = snapshot('results');
      dirty = true;
    }
    if (dirty) store();
  }

  // ---------- Coach bar ----------
  let bar = null;
  let panel = null;
  let panelOpen = false;
  let barSig = '';
  function ensureBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'cls-bar';
    bar.setAttribute('role', 'region');
    panel = document.createElement('div');
    panel.className = 'cls-panel';
    panel.id = 'cls-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    document.body.appendChild(bar);
    document.body.appendChild(panel);
    bar.addEventListener('click', onBarClick);
    panel.addEventListener('click', onBarClick);
  }

  function pendingCheckpoints() {
    return CHECKPOINTS.filter((c) => !c.log && c.ready() && !answered(c) && !(c.optional && !S.facts[c.id]));
  }

  function minutes() {
    return S.startedAt ? Math.max(0, Math.floor((Date.now() - S.startedAt) / 60000)) : 0;
  }

  const ngssChips = (list) => list.map((n) => `<span class="cls-chip">${esc(n)}</span>`).join('');

  function renderBar(force) {
    const on = isOn();
    const scr = ui.state.screen;
    const show = on && scr !== 'start' && scr !== 'newgame';
    document.documentElement.classList.toggle('cls-on', !!show);
    if (!show) {
      if (bar) bar.hidden = true;
      if (panel) panel.hidden = true;
      panelOpen = false;
      return;
    }
    ensureBar();
    const step = currentStep();
    const i = stepIndex(step);
    const st = STEPS[i];
    const pend = pendingCheckpoints();
    const sig = [step, scr, pend.map((c) => c.id).join(','), S.teacher, SMD.lang(), minutes(), panelOpen].join('|');
    if (!force && sig === barSig) return;
    barSig = sig;
    bar.hidden = false;
    bar.setAttribute('aria-label', t('class.bar.label', 'Classroom coach'));
    const here = st.screens.includes(scr);
    bar.innerHTML = `<div class="cls-bar-in">
      <span class="cls-badge" aria-hidden="true">${esc(t('class.bar.badge', 'Class'))}</span>
      <ol class="cls-dots" aria-label="${esc(t('class.bar.steps', 'Lesson steps'))}">${STEPS.map(
        (s, k) => `<li class="${k < i ? 'is-done' : k === i ? 'is-now' : ''}"${k === i ? ' aria-current="step"' : ''}><span class="cls-sr">${esc(s.title())}</span></li>`
      ).join('')}</ol>
      <p class="cls-now"><span class="cls-n num">${esc(t('class.bar.step', '{i}/{n}', { i: i + 1, n: STEPS.length }))}</span> <b>${esc(st.title())}</b><span class="cls-short"> · ${esc(st.short())}</span></p>
      <span class="cls-clock num" title="${esc(t('class.bar.clock.t', 'Minutes since the class started'))}">${esc(t('class.bar.clock', '{m} of {n} min', { m: minutes(), n: LESSON_MIN }))}</span>
      ${pend.length ? `<button type="button" class="cls-btn cls-btn-cp" data-cls="cp">${esc(t('class.bar.cp', 'Checkpoint'))}<span class="cls-count num">${pend.length}</span></button>` : ''}
      <button type="button" class="cls-btn cls-btn-coach" data-cls="coach" aria-expanded="${panelOpen}" aria-controls="cls-panel">${esc(t('class.bar.coach', 'Coach'))}<span class="cls-caret" aria-hidden="true"></span></button>
      ${scr !== 'classroom' ? `<button type="button" class="cls-btn cls-wide" data-cls="log">${esc(t('class.bar.log', 'Mission log'))}</button>` : ''}
      <button type="button" class="cls-btn cls-wide cls-switch" data-cls="teacher" role="switch" aria-checked="${!!S.teacher}">${esc(t('class.bar.teacher', 'Teacher view'))}<span class="cls-knob" aria-hidden="true"></span></button>
    </div>`;
    panel.innerHTML = `<div class="cls-panel-in">
      <p class="cls-kicker">${esc(t('class.p.kicker', 'Step {i} of {n} · about {m} minutes', { i: i + 1, n: STEPS.length, m: st.min }))}</p>
      <h2 class="cls-panel-h">${esc(st.title())}</h2>
      <h3 class="cls-sub">${esc(t('class.p.do', 'What to do'))}</h3>
      <ol class="cls-todo">${st.todo().map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <h3 class="cls-sub">${esc(t('class.p.why', 'Why it matters'))}</h3>
      <p class="cls-why">${esc(st.why())}</p>
      <p class="cls-practice"><span class="cls-practice-l">${esc(t('class.p.practice', 'Practice'))}</span> ${esc(st.sep.map((k) => PRACTICE[k]()).join(' · '))}<span class="cls-chips">${ngssChips(st.ngss)}</span></p>
      ${S.teacher ? `<div class="cls-teach"><b>${esc(t('class.p.teach', 'For the teacher'))}</b> ${esc(st.teach())}</div>` : ''}
      <div class="cls-panel-btns">
        ${here ? '' : `<button type="button" class="btn primary small" data-cls="there">${esc(t('class.p.there', 'Take me there'))}</button>`}
        ${scr !== 'classroom' ? `<button type="button" class="btn ghost small" data-cls="log">${esc(t('class.bar.log', 'Mission log'))}</button>` : ''}
        <button type="button" class="btn ghost small cls-narrow" data-cls="teacher" role="switch" aria-checked="${!!S.teacher}">${esc(S.teacher ? t('class.p.teacherOff', 'Hide teacher view') : t('class.p.teacherOn', 'Show teacher view'))}</button>
        <button type="button" class="btn ghost small" data-cls="close">${esc(t('class.p.close', 'Close'))}</button>
      </div>
    </div>`;
    panel.setAttribute('aria-label', st.title());
    panel.hidden = !panelOpen;
  }

  function setPanel(open, focus) {
    panelOpen = !!open;
    renderBar(true);
    if (open && focus) {
      const h = panel.querySelector('.cls-panel-btns button');
      if (h) h.focus({ preventScroll: true });
    }
  }

  function onBarClick(e) {
    const b = e.target.closest('[data-cls]');
    if (!b) return;
    const act = b.dataset.cls;
    if (act === 'coach') setPanel(!panelOpen, true);
    else if (act === 'close') {
      setPanel(false);
      const c = bar.querySelector('[data-cls="coach"]');
      if (c) c.focus({ preventScroll: true });
    } else if (act === 'there') {
      setPanel(false);
      goStep(currentStep());
    } else if (act === 'log') {
      setPanel(false);
      SMD.game.save();
      SMD.go('classroom');
    } else if (act === 'teacher') {
      S.teacher = !S.teacher;
      store();
      renderBar(true);
      if (ui.state.screen === 'classroom') rerenderScreen();
    } else if (act === 'cp') {
      const c = pendingCheckpoints()[0];
      if (c) openCheckpoint(c.id);
    }
  }

  // ---------- Checkpoint dialog ----------
  let modal = null;
  let modalCp = null;
  let lastFocus = null;
  let reopenPanel = false;

  function factsHTML(f) {
    if (!f || !f.length) return '';
    return `<dl class="cls-facts">${f.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  }

  function promptHTML(q, idp) {
    const v = S.answers[q.id] == null ? '' : String(S.answers[q.id]);
    const id = `${idp}-${q.id}`;
    if (q.kind === 'number')
      return `<label class="cls-q cls-q-num" for="${id}"><span>${esc(q.q())}</span><span class="cls-num-wrap"><input id="${id}" class="num" type="number" inputmode="numeric" min="0" max="100" step="1" data-ans="${q.id}" value="${esc(v)}" /><span class="cls-unit">${esc(t('class.c.pts', 'of 100'))}</span></span></label>`;
    // On paper a textarea shows only its visible rows, so the log prints a copy.
    return `<label class="cls-q" for="${id}"><span>${esc(q.q())}</span><textarea id="${id}" rows="${q.short ? 2 : 3}" data-ans="${q.id}" placeholder="${esc(t('class.c.ph', 'Write your answer here'))}">${esc(v)}</textarea><span class="cls-print-a">${esc(v) || '—'}</span></label>`;
  }

  function openCheckpoint(id) {
    const c = cpById(id);
    if (!c) return;
    closeCheckpoint(true);
    syncFacts();
    S.popped[id] = true;
    store();
    modalCp = id;
    lastFocus = document.activeElement;
    const n = CHECKPOINTS.filter((x) => !x.log).length;
    const k = CHECKPOINTS.filter((x) => !x.log).indexOf(c) + 1;
    modal = document.createElement('div');
    modal.className = 'cls-modal';
    modal.innerHTML = `<div class="cls-modal-back" data-mclose></div>
      <section class="cls-card" role="dialog" aria-modal="true" aria-labelledby="cls-cp-h">
        <p class="cls-kicker">${esc(t('class.c.kicker', 'Checkpoint {k} of {n}', { k, n }))} · ${esc(PRACTICE[c.sep]())}</p>
        <h2 id="cls-cp-h" class="cls-card-h">${esc(c.title())}</h2>
        ${S.facts[id] && S.facts[id].length ? `<h3 class="cls-sub">${esc(t('class.c.facts', 'What your agency did'))}</h3>${factsHTML(S.facts[id])}` : c.none ? `<p class="cls-why">${esc(c.none())}</p>` : ''}
        <div class="cls-qs">${c.prompts.map((q) => promptHTML(q, 'clsm')).join('')}</div>
        <p class="cls-chips cls-chips-row">${ngssChips(c.ngss)}</p>
        ${S.teacher ? `<div class="cls-teach"><b>${esc(t('class.c.look', 'Look for'))}</b> ${esc(c.hint())}</div>` : ''}
        <div class="cls-card-btns">
          <button type="button" class="btn ghost" data-mclose>${esc(t('class.c.later', 'Answer later'))}</button>
          <button type="button" class="btn primary" data-msave>${esc(t('class.c.save', 'Save and go on'))}</button>
        </div>
        <p class="cls-note small">${esc(t('class.c.note', 'Answers stay in this browser and appear in your mission log.'))}</p>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('input', onAnswer);
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-msave]')) {
        if (SMD.audio && SMD.audio.chime) SMD.audio.chime(true);
        closeCheckpoint();
      } else if (e.target.closest('[data-mclose]')) closeCheckpoint();
    });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeCheckpoint();
      }
      if (e.key === 'Tab') {
        const f = [...modal.querySelectorAll('button, textarea, input')].filter((x) => !x.disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          f[f.length - 1].focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          f[0].focus();
          e.preventDefault();
        }
      }
    });
    const first = modal.querySelector('textarea, input');
    if (first) first.focus({ preventScroll: true });
    renderBar(true);
  }

  function closeCheckpoint(silent) {
    if (!modal) return;
    modal.remove();
    modal = null;
    modalCp = null;
    store();
    if (!silent) {
      if (reopenPanel) panelOpen = true;
      reopenPanel = false;
      renderBar(true);
      if (ui.state.screen === 'classroom') rerenderScreen();
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }
  }

  function onAnswer(e) {
    const el = e.target.closest('[data-ans]');
    if (!el) return;
    S.answers[el.dataset.ans] = el.value;
    store();
  }

  // Is it a calm moment to open a checkpoint on this screen?
  function calm() {
    if (modal) return false;
    if (SMD.game.pending && SMD.game.pending.length) return false;
    if (document.querySelector('.card-layer, .board-modal, .hq-drawer:not([hidden]), .hq-coach:not([hidden])')) return false;
    // HQ while months are ticking by: its clock buttons are all disabled.
    if (ui.state.screen === 'hq' && !document.querySelector('#app [data-act="skip"]:not([disabled]), #app [data-act="due"], #app [data-act="month"]:not([disabled]), #app [data-act="end"]')) return false;
    return true;
  }

  // ---------- Watching the game ----------
  let lastScreen = null;
  let calmSince = 0;
  let titleRouted = false;

  function onScreen(prev, scr) {
    const prm = ui.state.params || {};
    if (scr === 'start') {
      addTitleButton();
      if (!titleRouted && /^#classroom$/.test(location.hash)) {
        titleRouted = true;
        setTimeout(() => SMD.go('classroom'), 0);
      }
    }
    if (panelOpen && prev !== scr) panelOpen = false;
    if (modal && prev !== scr) closeCheckpoint(true);
    if (!isOn()) return;
    if (scr === 'design' && (!prm.missionKey || prm.missionKey === MISSION)) {
      S.sawDesign = true;
      if (prm.confidence) S.confidence = prm.confidence;
      store();
    }
    // Keep the board's questions as asked, so the log can show the answers.
    if (scr === 'review' && prm.review) {
      const ag = SMD.game.agency;
      const p = ag.projects.find((x) => x.id === prm.projectId);
      if (p && !p.reviews[prm.review]) {
        try {
          S.reviewQs[prm.review] = A()
            .reviewQuestions(ag, p, prm.review)
            .map((q) => ({ id: q.id, text: q.text, options: q.options.map((o) => ({ id: o.id, label: o.label })) }));
          store();
        } catch (e) {}
      }
    }
    if (scr === 'results') {
      const p = proj();
      if (p && prm.projectId === p.id) {
        S.resultsOpened = true;
        store();
      }
    }
    if (prev === 'results' && scr !== 'results' && S.resultsOpened && !S.sawResults) {
      S.sawResults = true;
      store();
    }
  }

  function tick() {
    const scr = ui.state.screen;
    if (scr !== lastScreen) {
      const prev = lastScreen;
      lastScreen = scr;
      onScreen(prev, scr);
      calmSince = Date.now();
    }
    if (!isOn()) {
      renderBar();
      return;
    }
    syncFacts();
    renderBar();
    // Open the next checkpoint when the class is on a fitting screen and
    // nothing else (a card, a review queue, a drawer) is in the way.
    if (!calm()) {
      calmSince = Date.now();
      return;
    }
    if (Date.now() - calmSince < 1100) return;
    const next = CHECKPOINTS.find((c) => !c.log && c.on.includes(scr) && c.ready() && !S.popped[c.id] && !(c.optional && !S.facts[c.id]));
    if (next && scr !== 'classroom') {
      reopenPanel = panelOpen;
      if (panelOpen) setPanel(false);
      openCheckpoint(next.id);
      return;
    }
    if (next && scr === 'classroom') {
      S.popped[next.id] = true; // the log shows it inline
      store();
    }
    // A new step opens the coach panel once, so the class sees what to do next.
    const step = currentStep();
    const st = STEPS[stepIndex(step)];
    if (!S.stepSeen[step] && st.screens.includes(scr) && scr !== 'classroom') {
      S.stepSeen[step] = true;
      store();
      setPanel(true);
    }
  }

  function addTitleButton() {
    const box = document.querySelector('#app .title-actions');
    if (!box || box.querySelector('[data-act="classroom"]')) return;
    const b = document.createElement('button');
    b.className = 'btn ghost';
    b.dataset.act = 'classroom';
    b.textContent = t('class.title.btn', 'Classroom mode');
    const lang = box.querySelector('[data-act="lang"]');
    box.insertBefore(b, lang || null);
    b.addEventListener('click', () => {
      if (SMD.audio) SMD.audio.unlock();
      SMD.go('classroom');
    });
  }

  function rerenderScreen() {
    if (ui.state.screen !== 'classroom') return;
    const y = window.scrollY;
    SMD.go('classroom', ui.state.params);
    window.scrollTo(0, y);
  }

  // ---------- Starting and ending ----------
  function start(agencyName, names) {
    const sv = savedCareer();
    try {
      if (sv && !sv.classroomId) localStorage.setItem(BACKUP, localStorage.getItem('ek-save'));
    } catch (e) {}
    const teacher = S.teacher;
    S = fresh();
    S.teacher = teacher;
    S.id = `c${Date.now().toString(36)}`;
    S.active = true;
    S.agencyName = agencyName;
    S.names = names;
    S.startedAt = Date.now();
    S.stepSeen = { brief: true };
    const ag = SMD.game.newGame(agencyName);
    ag.classroomId = S.id;
    ag.now = CLASS_START;
    ag.money = CLASS_MONEY;
    ag.rep = CLASS_REP;
    GIFT_TECH.forEach((id) => !ag.tech.includes(id) && ag.tech.push(id));
    // Missions already open are known, so HQ does not announce them as new.
    Object.keys(SMD.data.CONTRACTS).forEach((k) => {
      const st = A().contractState(ag, k);
      ag.known[k] = st === 'open' || st === 'busy' || st === 'done';
    });
    ag.log.unshift({ ms: ag.now, text: t('class.log.start', 'Classroom mission: find buried ice on Mars.') });
    SMD.game.save();
    SMD.bus.emit('agency', ag);
    store();
    try {
      localStorage.setItem('ek-hq-coach', '1'); // the class coach replaces the HQ tour
    } catch (e) {}
    SMD.go('board', { missionKey: MISSION });
  }

  function end() {
    S.active = false;
    store();
    let restored = false;
    try {
      const bk = localStorage.getItem(BACKUP);
      if (bk) {
        localStorage.setItem('ek-save', bk);
        localStorage.removeItem(BACKUP);
        restored = true;
      }
    } catch (e) {}
    if (restored) SMD.game.load();
    else SMD.game.agency = null;
    document.documentElement.classList.remove('cls-on');
    SMD.go('start');
  }

  // ---------- Export ----------
  function logModel() {
    const ag = SMD.game.agency;
    const p = proj();
    const sections = CHECKPOINTS.map((c) => ({
      c,
      ready: c.ready(),
      facts: S.facts[c.id] || [],
      prompts: c.prompts.map((q) => ({ q: q.q(), a: S.answers[q.id] == null ? '' : String(S.answers[q.id]) })),
    }));
    return { ag, p, sections };
  }

  function exportHTML() {
    const { ag, sections } = logModel();
    const title = t('class.log.h', 'Mission log');
    const body = sections
      .filter((s) => s.ready || s.prompts.some((x) => x.a))
      .map(
        (s) => `<section><h2>${esc(s.c.title())}</h2>
        ${s.facts.length ? `<table>${s.facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
        ${s.prompts.map((x) => `<p class="q">${esc(x.q)}</p><p class="a">${x.a ? esc(x.a) : '—'}</p>`).join('')}
        <p class="std">${esc(PRACTICE[s.c.sep]())} · ${esc(s.c.ngss.join(', '))}</p></section>`
      )
      .join('');
    return `<!doctype html><html lang="${esc(SMD.lang())}" dir="${esc(SMD.dir())}"><head><meta charset="utf-8"><title>${esc(title)} · ${esc(ag ? ag.name : '')}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;color:#23282e;max-width:760px;margin:32px auto;padding:0 16px}h1{margin:0 0 4px;font-size:28px}h2{font-size:18px;margin:28px 0 8px;border-bottom:2px solid #23282e;padding-bottom:4px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:start;vertical-align:top;padding:4px 8px 4px 0;border-bottom:1px solid #d8e1db}th{width:34%;color:#545d66;font-weight:600}.q{font-weight:700;margin:12px 0 2px}.a{white-space:pre-wrap;margin:0;padding:8px 10px;background:#f2f5f3;border-inline-start:3px solid #d9a21b}.std{font-size:12px;color:#545d66}.meta{color:#545d66}</style></head>
<body><h1>${esc(title)} · ${esc(ag ? ag.name : '')}</h1><p class="meta">${esc(t('class.log.meta', 'Every Kilogram classroom mission: buried ice on Mars'))}${S.names ? ` · ${esc(S.names)}` : ''} · ${esc(new Date().toLocaleDateString())}</p>${body}
<p class="meta">${esc(t('class.log.credit', 'Made with Every Kilogram for the NASA Space Apps Challenge 2026. Use of NASA data does not imply NASA endorsement.'))}</p></body></html>`;
  }

  function download() {
    const ag = SMD.game.agency;
    const blob = new Blob([exportHTML()], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const slug = String((ag && ag.name) || 'class').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '');
    a.download = `mission-log-${slug || 'class'}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  // ---------- The classroom screen ----------
  const OBJECTIVES = () => [
    t('class.obj.1', 'Turn a science goal into requirements they can measure: mass, power, data, cost and time.'),
    t('class.obj.2', 'Run a trade study and justify a design with evidence, not preference.'),
    t('class.obj.3', 'Explain the mass snowball: every kilogram needs propellant, which is more mass (the rocket equation).'),
    t('class.obj.4', 'Explain why sunlight weakens with distance (1/r²) and what that means for solar panels at Mars.'),
    t('class.obj.5', 'Explain why Mars launch windows come about every 26 months, and what missing one costs.'),
    t('class.obj.6', 'Manage a budget with a reserve, and explain why NASA holds back about 25% for surprises.'),
    t('class.obj.7', 'Connect a real NASA failure to the process fix that prevents it, and defend a decision to a review board with data.'),
  ];

  const NGSS = () => [
    ['MS-ETS1-1 · HS-ETS1-1', t('class.ngss.1', 'Criteria and constraints: the science question, the requirements panel and the reserve.')],
    ['MS-ETS1-2 · HS-ETS1-3', t('class.ngss.2', 'Evaluate competing solutions: the trade study, review boards and event cards.')],
    ['MS-ETS1-3', t('class.ngss.3', 'Analyze test data: what the tests and the what-if reruns reveal.')],
    ['MS-ETS1-4 · HS-ETS1-4', t('class.ngss.4', 'Models and simulation: change a part, watch mass, power and science update; the flight simulation.')],
    ['HS-ETS1-2', t('class.ngss.5', 'Break a complex problem into parts: subsystems and project phases.')],
    ['HS-ESS1-4 · HS-PS2-4', t('class.ngss.6', 'Orbits and gravity: the Mars transfer, the 26-month window, the trip time.')],
  ];

  function stepsHTML(cur) {
    const ci = cur ? stepIndex(cur) : -1;
    let at = 0;
    return `<ol class="cls-steps">${STEPS.map((s, k) => {
      const from = at;
      at += s.min;
      return `<li class="${k < ci ? 'is-done' : k === ci ? 'is-now' : ''}"${k === ci ? ' aria-current="step"' : ''}>
        <span class="cls-steps-n num" aria-hidden="true">${k + 1}</span>
        <div><b>${esc(s.title())}</b><span class="cls-steps-t num">${esc(t('class.b.mins', '{a}–{b} min', { a: from, b: at }))}</span>
        <p>${esc(s.short())}</p>
        <p class="cls-steps-p">${esc(s.sep.map((x) => PRACTICE[x]()).join(' · '))}</p>
        ${S.teacher ? `<p class="cls-teach cls-teach-s">${esc(s.teach())}</p>` : ''}</div>
      </li>`;
    }).join('')}</ol>`;
  }

  function teacherHTML() {
    return `<section class="cls-tpanel" aria-labelledby="cls-t-h">
      <h2 id="cls-t-h">${esc(t('class.t.h', 'For the teacher'))}</h2>
      <div class="cls-tgrid">
        <div><h3>${esc(t('class.t.obj', 'Learning objectives'))}</h3><p class="small">${esc(t('class.t.objlede', 'By the end of the lesson students can:'))}</p><ol class="cls-obj">${OBJECTIVES().map((o) => `<li>${esc(o)}</li>`).join('')}</ol></div>
        <div><h3>${esc(t('class.t.ngss', 'NGSS'))}</h3><dl class="cls-ngss">${NGSS().map(([k, v]) => `<div><dt class="num">${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <h3>${esc(t('class.t.setup', 'Set-up'))}</h3>
        <ul class="cls-tips"><li>${esc(t('class.t.tip1', 'Pairs, one laptop or tablet each. No install, no accounts. Answers stay in the browser.'))}</li>
        <li>${esc(t('class.t.tip2', 'Share this link to open classroom mode directly: add #classroom to the game address.'))}</li>
        <li>${esc(t('class.t.tip3', 'The class career starts in January 2029 with reputation 2, $650M and three finished research items, so the Mars contract is open on day one.'))}</li>
        <li>${esc(t('class.t.tip4', 'Teacher view adds answer hints to every step and checkpoint. Turn it off before handing the laptop back.'))}</li></ul></div>
      </div>
    </section>`;
  }

  function briefHTML() {
    const sv = savedCareer();
    const hasOther = sv && !sv.classroomId;
    const resumable = classSaved();
    return `<main class="screen day cls-screen">
      <header class="cls-top">
        <button type="button" class="btn ghost small" data-c="title">${esc(t('class.b.back', 'Back to title'))}</button>
        <span class="cls-top-brand">${esc(t('title.name', 'Every Kilogram'))}</span>
        <span class="cls-spacer"></span>
        <button type="button" class="cls-btn cls-switch is-day" data-c="teacher" role="switch" aria-checked="${!!S.teacher}">${esc(t('class.bar.teacher', 'Teacher view'))}<span class="cls-knob" aria-hidden="true"></span></button>
      </header>
      <section class="cls-hero">
        <figure class="cls-hero-img"><img src="${HERO}" alt="${esc(t('class.b.img', 'A Mars cliff face with blue-tinted layers of buried ice under red dust'))}" width="640" height="420" /><figcaption>${esc(t('class.b.imgc', 'Cliffs of nearly pure ice under the dust, seen by MRO’s HiRISE camera. NASA/JPL-Caltech/UA/USGS'))}</figcaption></figure>
        <div class="cls-hero-copy">
          <p class="cls-kicker">${esc(t('class.b.kicker', 'Classroom mode · one guided mission · about {n} minutes', { n: LESSON_MIN }))}</p>
          <h1 class="display">${esc(t('class.b.h', 'Is there ice under the dust of Mars?'))}</h1>
          <p class="cls-lede">${esc(t('class.b.lede', 'Your class runs a young space agency. You will propose a mission, design an orbiter where every kilogram counts, defend it to review boards, launch it through a real Mars window and read what came back. A coach bar at the top tells you what to do and why.'))}</p>
          <dl class="cls-start-facts">
            <div><dt>${esc(t('class.b.f1', 'Mission'))}</dt><dd>${esc(t('mission.mars.title', SMD.data.MISSIONS.mars.title))}</dd></div>
            <div><dt>${esc(t('class.b.f2', 'Starts'))}</dt><dd class="num">${esc(ui.monthYear(CLASS_START))}</dd></div>
            <div><dt>${esc(t('class.b.f3', 'Budget'))}</dt><dd class="num">${esc(ui.money(CLASS_MONEY))}</dd></div>
            <div><dt>${esc(t('class.b.f4', 'Compare with'))}</dt><dd>${esc(t('class.b.f4v', 'NASA’s MRO, 2,180 kg'))}</dd></div>
          </dl>
          ${resumable ? `<div class="cls-resume"><p>${esc(t('class.b.resume', 'A class mission is already running in this browser.'))}</p><button type="button" class="btn primary" data-c="resume">${esc(t('class.b.resumeb', 'Open its mission log'))}</button></div>` : ''}
          <form class="cls-form" data-c="form">
            <label><span>${esc(t('class.b.name', 'Agency name'))}</span><input name="agency" maxlength="40" required value="${esc(t('class.b.nameDefault', 'Ice Hunters Agency'))}" /></label>
            <label><span>${esc(t('class.b.names', 'Who is flying it (optional)'))}</span><input name="names" maxlength="80" placeholder="${esc(t('class.b.namesPh', 'e.g. Amina and Omar'))}" /></label>
            <button type="submit" class="btn primary cls-go">${esc(resumable ? t('class.b.restart', 'Start a new class mission') : t('class.b.start', 'Start the mission'))}</button>
            ${hasOther ? `<p class="cls-note small">${esc(t('class.b.backup', 'Your own career is kept safe and comes back when you end classroom mode.'))}</p>` : ''}
          </form>
        </div>
      </section>
      <section class="cls-plan" aria-labelledby="cls-plan-h">
        <h2 id="cls-plan-h">${esc(t('class.b.plan', 'The lesson in eight steps'))}</h2>
        <p class="cls-plan-lede">${esc(t('class.b.planlede', 'Six checkpoints ask a short question. Your answers build a mission log you can print or download at the end.'))}</p>
        ${stepsHTML(null)}
      </section>
      ${S.teacher ? teacherHTML() : ''}
      <p class="cls-credit small">${esc(t('class.credit', 'Imagery courtesy of NASA, NASA/JPL-Caltech and USGS. Use does not imply NASA endorsement.'))}</p>
    </main>`;
  }

  function logHTML() {
    const { ag, p, sections } = logModel();
    const step = currentStep();
    const st = STEPS[stepIndex(step)];
    const done = step === 'debrief';
    const nAns = sections.filter((s) => s.ready && s.prompts.every((x) => x.a.trim())).length;
    const nReady = sections.filter((s) => s.ready && !(s.c.optional && !s.facts.length)).length;
    const lockText = {
      proposal: t('class.lk.proposal', 'Opens when you write your proposal.'),
      design: t('class.lk.design', 'Opens when you approve your design.'),
      review: t('class.lk.review', 'Opens after your first review board.'),
      event: t('class.lk.event', 'Opens if an event card comes up while you build.'),
      launch: t('class.lk.launch', 'Opens after launch.'),
      results: t('class.lk.results', 'Opens after you read the results.'),
      exit: t('class.lk.exit', 'Opens at the end of the mission.'),
    };
    const card = (s, k) => {
      const c = s.c;
      const locked = !s.ready;
      const noEvent = c.optional && s.ready === false && p && p.status !== 'dev' && p.status !== 'ready';
      return `<article class="cls-cp ${locked ? 'is-locked' : ''} ${s.ready && s.prompts.every((x) => x.a.trim()) ? 'is-done' : ''}" aria-labelledby="cls-cp-${c.id}">
        <header><span class="cls-cp-n num" aria-hidden="true">${k + 1}</span><div><h2 id="cls-cp-${c.id}">${esc(c.title())}</h2>
        <p class="cls-cp-p">${esc(PRACTICE[c.sep]())} <span class="cls-chips">${ngssChips(c.ngss)}</span></p></div></header>
        ${locked ? `<p class="cls-lock">${esc(noEvent ? c.none() : lockText[c.id])}</p>` : `${factsHTML(s.facts)}<div class="cls-qs">${c.prompts.map((q) => promptHTML(q, 'clsl')).join('')}</div>`}
        ${S.teacher ? `<div class="cls-teach"><b>${esc(t('class.c.look', 'Look for'))}</b> ${esc(c.hint())}</div>` : ''}
      </article>`;
    };
    return `<main class="screen day cls-screen cls-log">
      <header class="cls-top">
        <span class="cls-top-brand">${esc(t('title.name', 'Every Kilogram'))}</span>
        <span class="cls-top-crumb">${esc(t('class.log.h', 'Mission log'))}</span>
        <span class="cls-spacer"></span>
      </header>
      <section class="cls-loghead">
        <div>
          <p class="cls-kicker">${esc(t('class.log.kicker', 'Classroom mission · buried ice on Mars'))}${S.names ? ` · ${esc(S.names)}` : ''}</p>
          <h1 class="display">${esc(ag.name)}</h1>
          <p class="cls-lede">${esc(done ? t('class.log.ledeDone', 'The mission is over. Finish the exit ticket, then print or download this log for your teacher.') : t('class.log.lede', 'Everything your agency decided and wrote, in one place. Answers save as you type.'))}</p>
        </div>
        <div class="cls-next ${done ? 'is-done' : ''}">
          <p class="cls-kicker">${esc(t('class.log.now', 'Step {i} of {n}', { i: stepIndex(step) + 1, n: STEPS.length }))} · ${esc(t('class.log.ans', '{a} of {r} checkpoints answered', { a: nAns, r: nReady }))}</p>
          <h2>${esc(st.title())}</h2>
          <p>${esc(st.short())}</p>
          ${done ? `<button type="button" class="btn primary" data-c="exit">${esc(t('class.log.exit', 'Write the exit ticket'))}</button>` : `<button type="button" class="btn primary" data-c="continue">${esc(t('class.log.cont', 'Continue the mission'))}</button>`}
        </div>
      </section>
      <section class="cls-progress" aria-label="${esc(t('class.bar.steps', 'Lesson steps'))}">${stepsHTML(step)}</section>
      <section class="cls-cps" aria-label="${esc(t('class.log.cps', 'Checkpoints'))}">${sections.map(card).join('')}</section>
      <section class="cls-actions">
        <button type="button" class="btn primary" data-c="print">${esc(t('class.log.print', 'Print the log'))}</button>
        <button type="button" class="btn" data-c="download">${esc(t('class.log.dl', 'Download the log'))}</button>
        <span class="cls-spacer"></span>
        <button type="button" class="btn ghost" data-c="end">${esc(t('class.log.end', 'End classroom mode'))}</button>
      </section>
      ${S.teacher ? teacherHTML() : ''}
    </main>`;
  }

  ui.screens.classroom = {
    render(app) {
      // After a reload: bring the class career back if it is the save.
      if (S.active && !isOn() && classSaved()) SMD.game.load();
      const on = isOn();
      app.innerHTML = on ? logHTML() : briefHTML();
      const root = app.querySelector('.cls-screen');
      root.addEventListener('input', onAnswer);
      const onClick = (e) => {
        const b = e.target.closest('[data-c]');
        if (!b || b.tagName === 'FORM') return;
        const c = b.dataset.c;
        if (c === 'title') SMD.go('start');
        else if (c === 'teacher') {
          S.teacher = !S.teacher;
          store();
          renderBar(true);
          rerenderScreen();
        } else if (c === 'resume') {
          SMD.game.load();
          SMD.go('classroom');
        } else if (c === 'continue') goStep(currentStep());
        else if (c === 'exit') {
          const box = root.querySelector('#cls-cp-exit');
          if (box) {
            box.closest('.cls-cp').scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
            const ta = box.closest('.cls-cp').querySelector('textarea');
            if (ta) ta.focus({ preventScroll: true });
          }
        }
        else if (c === 'print') {
          rerenderScreen();
          setTimeout(() => window.print(), 50);
        }
        else if (c === 'download') download();
        else if (c === 'end') {
          const ok = window.confirm(t('class.log.endq', 'End classroom mode? Download or print the log first: the answers stay in this browser only until the next class starts.'));
          if (ok) end();
        }
      };
      root.addEventListener('click', onClick);
      const form = root.querySelector('[data-c="form"]');
      if (form)
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const name = String(fd.get('agency') || '').trim() || t('class.b.nameDefault', 'Ice Hunters Agency');
          if (SMD.audio) {
            SMD.audio.unlock();
            if (SMD.audio.chime) SMD.audio.chime(true);
          }
          start(name.slice(0, 40), String(fd.get('names') || '').trim().slice(0, 80));
        });
      const offLang = SMD.bus.on('lang', () => rerenderScreen());
      return () => {
        offLang();
        root.removeEventListener('click', onClick);
      };
    },
  };

  // ---------- Boot ----------
  function boot() {
    const app = document.getElementById('app');
    if (!app) return;
    new MutationObserver(() => tick()).observe(app, { childList: true });
    setInterval(tick, 700);
    SMD.bus.on('lang', () => {
      barSig = '';
      renderBar(true);
      if (modalCp) openCheckpoint(modalCp);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panelOpen && !modal) {
        setPanel(false);
        const c = bar && bar.querySelector('[data-cls="coach"]');
        if (c) c.focus({ preventScroll: true });
      }
    });
    // Working on the screen below closes the step panel; it stays one click away.
    document.addEventListener('click', (e) => {
      if (!panelOpen || modal || !panel || !bar || !document.contains(e.target)) return;
      if (panel.contains(e.target) || bar.contains(e.target)) return;
      setPanel(false);
    });
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Small API for tests, fixtures and other modules.
  SMD.classroom = {
    isOn,
    start,
    end,
    state: () => S,
    step: currentStep,
    openCheckpoint,
    exportHTML,
    STEPS: STEPS.map((s) => s.id),
    CHECKPOINTS: CHECKPOINTS.map((c) => c.id),
  };
})();
