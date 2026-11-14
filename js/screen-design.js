// Phase A design: the core of the game. Pick parts from the tray, watch the
// spacecraft change in the clean room, and see every requirement, dollar and
// month react at once. Approve it to start building.
// params: { missionKey, confidence }
(function () {
  const SMD = globalThis.SMD;
  const { ui, data } = SMD;
  const { esc, fmt, money } = ui;
  const { INSTRUMENTS, OPTIONS, MISSIONS, TECH, TEST_PLANS, TESTS, CONST } = data;
  const t = (k, e, p) => SMD.t(k, e, p);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Designs that are known to work, for beginners (the same ones the career bot flies).
  const PROVEN = {
    nile: { instruments: ['hires', 'irspec'], arrays: 8, dish: 1, amp: 25, recorder: 256, launcher: 'light', margin: 10 },
    weather: { instruments: ['irspec', 'context'], arrays: 5, dish: 1, amp: 25, recorder: 64, launcher: 'light', margin: 10 },
    moon: { instruments: ['neutron', 'sounder', 'context'], arrays: 6, dish: 1, amp: 25, recorder: 256, launcher: 'light', margin: 10 },
    mars: { instruments: ['sounder', 'hires', 'neutron'], arrays: 6, dish: 3, amp: 100, recorder: 256, launcher: 'light', capture: 'aerobrake', margin: 20 },
    venus: { instruments: ['sar', 'irspec', 'uso'], arrays: 5, dish: 3, amp: 100, recorder: 1024, launcher: 'medium', capture: 'aerobrake', margin: 20 },
    jupiter: { instruments: ['iceRadar', 'mag', 'context'], arrays: 60, dish: 3, amp: 100, recorder: 256, launcher: 'heavy', shield: 75, ground: 12, margin: 10, route: 'direct' },
  };

  // The real NASA spacecraft that stands in the clean room, scaled by its
  // largest dimension in metres (deployed).
  const ANALOG = {
    nile: { id: 'model-landsat', name: 'Landsat 8', sizeM: 7.5 },
    weather: { id: 'model-landsat', name: 'Landsat 8', sizeM: 7.5 },
    moon: { id: 'model-lro', name: 'Lunar Reconnaissance Orbiter', short: 'LRO', sizeM: 3.9 },
    mars: { id: 'model-mro', name: 'Mars Reconnaissance Orbiter', short: 'MRO', sizeM: 13.6 },
    venus: { id: 'model-magellan', name: 'Magellan', sizeM: 6.4 },
    jupiter: { id: 'model-clipper', name: 'Europa Clipper', sizeM: 30.5, alt: { id: 'model-juno', name: 'Juno', sizeM: 20.1 } },
  };

  // Used only until the content module provides SMD.content.realMissions.
  const REAL_FALLBACK = {
    nile: { name: 'Landsat 9', launchMassKg: 2711, dataRate: '384 Mbps', costM: 900, launch: 'Atlas V 401, 2021' },
    moon: { name: 'Lunar Reconnaissance Orbiter', launchMassKg: 1916, powerW: 823, dataRate: '100 Mbps', costM: 504, launch: 'Atlas V 401, 2009' },
    mars: { name: 'Mars Reconnaissance Orbiter', launchMassKg: 2180, powerW: 2000, dataRate: '6 Mbps', costM: 720, launch: 'Atlas V 401, 2005' },
    venus: { name: 'Magellan', launchMassKg: 3449, dataRate: '268.8 kbps', costM: 551, launch: 'Space Shuttle, 1989' },
    jupiter: { name: 'Europa Clipper', launchMassKg: 6065, costM: 5200, launch: 'Falcon Heavy, 2024' },
  };

  // Where each number's source lives in SMD.content.sources (first match wins).
  const SRC = {
    science: ['instruments', 'science', 'objectives'],
    lift: ['rocketEquation', 'launchers', 'launcher', 'launchVehicles', 'c3'],
    power: ['solarFlux', 'solarPower', 'solarArrays', 'rtg'],
    data: ['dsn', 'linkBudget', 'dataRate', 'downlink'],
    money: ['reserve', 'costReserve', 'discoveryCap', 'costCaps', 'budget'],
    risk: ['testing', 'tests', 'hiddenFlaws', 'lessonsLearned'],
    window: ['launchWindows', 'lambert', 'planetPositions', 'jplElements', 'ephemeris'],
    snowball: ['rocketEquation', 'isp', 'propellant'],
  };

  // Where in the tray each requirement gets fixed ('conf' = the reserve switch).
  const FIX = { science: 'science', lift: 'travel', power: 'power', data: 'comms', money: 'conf', risk: 'tests', window: 'travel', abort: 'crew', shield: 'crew', life: 'crew', shelter: 'crew' };

  // Which research unlocks a locked option.
  const LOCK = {
    dish: { 3: 'dish3' },
    amp: { 100: 'amp100' },
    recorder: { 1024: 'rec1t' },
    avionics: { dual: 'dual' },
    launcher: { heavy: 'heavy' },
    capture: { aerobrake: 'aero' },
    shield: { 25: 'vault', 75: 'vault', 150: 'vault' },
    route: { direct: 'heavy' },
  };

  // Part keys in the 3D craft that each tile lights up.
  const HILITE = { arrays: 'arrays', rtg: 'rtg', dish: 'dish', amp: 'dish', ground: 'dish', recorder: 'bus', avionics: 'bus', shield: 'vault', launcher: 'tank', capture: 'tank', margin: 'tank', route: 'tank', heatShield: 'heatshield', abort: 'las', lifeDays: 'capsule', shelter: 'capsule', entry: 'heatshield' };
  // Crew design fields (SMD.data.CREW_PARTS): numbers, except the entry mode.
  const CREW_KEYS = ['abort', 'heatShield', 'entry', 'lifeDays', 'shelter'];
  const crewValue = (key, raw) => (key === 'entry' ? String(raw) : Number(raw));

  // Line icons, 24 x 24, drawn with currentColor.
  const ICON = {
    hires: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3"/>',
    context: '<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-2.5h5L16 7"/>',
    sounder: '<path d="M2 12h20"/><path d="M6 16c2-3 4-3 6 0s4 3 6 0" /><path d="M8 20c1.4-2 2.6-2 4 0s2.6 2 4 0"/>',
    iceRadar: '<path d="M3 8h18"/><path d="M6 12l6 8 6-8"/><path d="M9 12h6"/>',
    sar: '<rect x="3" y="5" width="18" height="8" rx="1"/><path d="M7 17l-2 4M17 17l2 4M12 13v8"/>',
    irspec: '<path d="M4 18c3-8 13-8 16 0"/><path d="M8 18c1.5-4 6.5-4 8 0"/><path d="M12 4v4"/>',
    neutron: '<circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="4" ry="9"/>',
    mag: '<path d="M7 4v8a5 5 0 0 0 10 0V4"/><path d="M5 4h4M15 4h4"/>',
    uso: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    arrays: '<rect x="2" y="7" width="8" height="10"/><rect x="14" y="7" width="8" height="10"/><path d="M10 12h4M6 7v10M18 7v10"/>',
    rtg: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4"/>',
    dish: '<path d="M4 6a12 12 0 0 0 14 14z"/><path d="M11 13l6-6M17 7h-3M17 7v3"/>',
    amp: '<path d="M12 20V10"/><path d="M8 7a5 5 0 0 1 8 0M5 4a9 9 0 0 1 14 0"/>',
    recorder: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h8M8 17h4"/>',
    ground: '<path d="M5 20h14M12 20v-6"/><path d="M5 9a7 7 0 0 0 14 0z"/>',
    avionics: '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    shield: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
    launcher: '<path d="M12 2c3 3 4 7 4 12H8c0-5 1-9 4-12z"/><path d="M8 14l-3 4h3M16 14l3 4h-3M10 18l2 4 2-4"/>',
    capture: '<circle cx="12" cy="12" r="5"/><path d="M3 12a9 9 0 0 1 15-6.7"/><path d="M18 2v4h-4"/>',
    route: '<circle cx="6" cy="17" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 16c6-1 4-8 8-9"/>',
    margin: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M7 13h10"/>',
    tests: '<path d="M9 3h6M10 3v6l-5 10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2L14 9V3"/><path d="M7 15h10"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    // Hands-on room only: the two ways to slow down, the spacecraft, the paperwork.
    burn: '<path d="M9 3h6l1 6H8z"/><path d="M8 9l-2 7h12l-2-7"/><path d="M10 19c0 1.5 1 2.5 2 3 1-.5 2-1.5 2-3"/>',
    aero: '<circle cx="12" cy="17" r="5"/><path d="M3 9c5-5 13-5 18 0"/><path d="M6 12c4-3 8-3 12 0"/>',
    craft: '<rect x="9" y="8" width="6" height="8" rx="1"/><path d="M2 10h7M15 10h7M2 14h7M15 14h7"/><path d="M12 8V4M10 4h4"/>',
    paper: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h4"/>',
    // Crew parts.
    heatShield: '<path d="M3 9c3 5 15 5 18 0"/><path d="M5.5 13c3 3 10 3 13 0"/><path d="M12 3v4"/>',
    abort: '<path d="M12 2v5"/><path d="M9.5 7h5l-1 4h-3z"/><path d="M7 21l5-10 5 10z"/><path d="M8 5L6 3M16 5l2-2"/>',
    lifeDays: '<path d="M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z"/><path d="M10 14a2 2 0 0 0 2 2"/>',
    shelter: '<path d="M3 12l9-8 9 8"/><path d="M5 11v9h14v-9"/><path d="M10 20v-5h4v5"/>',
    entry: '<path d="M3 5c6 0 9 4 11 9"/><circle cx="17" cy="17" r="4"/>',
  };
  const icon = (id) => `<svg class="design-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[id] || ''}</svg>`;

  const techName = (id) => {
    const x = TECH.find((k) => k.id === id);
    return x ? t('tech.' + x.id, x.name) : id;
  };
  const techCost = (id) => (TECH.find((k) => k.id === id) || {}).cost;

  function source(ids) {
    const S = SMD.content && SMD.content.sources;
    if (!S || !ids) return null;
    for (const id of ids) if (S[id]) return S[id];
    const keys = Object.keys(S);
    for (const id of ids) {
      const k = keys.find((x) => x.toLowerCase().includes(id.toLowerCase()));
      if (k) return S[k];
    }
    return null;
  }
  function srcBtn(ids) {
    const s = source(ids);
    if (!s) return '';
    const S = SMD.content.sources;
    const key = Object.keys(S).find((k) => S[k] === s);
    const en = typeof s === 'string' ? s : s.text || s.title || '';
    const text = key ? t('content.sources.' + key, en) : en;
    const url = (s && s.url) || '';
    return `<button type="button" class="design-src" data-tip="${esc(text)}" data-url="${esc(url)}" aria-label="${esc(t('design.src.aria', 'Source: {text}', { text }))}">${t('design.src', 'source')}</button>`;
  }

  // ---------- Tray model ----------
  function groups(ag, design, m) {
    const P = SMD.agency.parts(ag, m.key);
    const out = [];
    const lockOf = (field, v, list) => (list.includes(v) ? null : (LOCK[field] && LOCK[field][v]) || 'locked');
    out.push({
      key: 'dish',
      cat: 'comms',
      title: t('design.g.dish', 'High-gain dish'),
      why: t('design.g.dish.why', 'Data home grows with the dish area. So does mass.'),
      options: OPTIONS.dish.map((o) => ({ value: o.id, label: t('design.opt.dish', '{n} m dish', { n: o.id }), n1: `${o.mass} kg`, n2: money(o.cost), lock: lockOf('dish', o.id, P.dish) })),
    });
    out.push({
      key: 'amp',
      cat: 'comms',
      title: t('design.g.amp', 'Radio power'),
      why: t('design.g.amp.why', 'A louder radio sends more data but drinks power.'),
      options: OPTIONS.amp.map((o) => ({ value: o.id, label: t('design.opt.amp', '{n} W radio', { n: o.id }), n1: `${o.mass} kg`, n2: t('design.opt.draw', '{n} W draw', { n: o.dcW }), lock: lockOf('amp', o.id, P.amp) })),
    });
    out.push({
      key: 'recorder',
      cat: 'comms',
      title: t('design.g.recorder', 'Data recorder'),
      why: t('design.g.recorder.why', 'Stores science while Earth is out of view.'),
      options: OPTIONS.recorder.map((o) => ({ value: o.id, label: o.id >= 1024 ? t('design.opt.tbit', '1 Tbit') : t('design.opt.gbit', '{n} Gbit', { n: o.id }), n1: `${o.mass} kg`, n2: money(o.cost), lock: lockOf('recorder', o.id, P.recorder) })),
    });
    out.push({
      key: 'ground',
      cat: 'comms',
      title: t('design.g.ground', 'Antenna time on Earth'),
      why: t('design.g.ground.why', 'Hours a day on the big dishes that listen for you.'),
      options: OPTIONS.ground.map((o) => ({ value: o.id, label: t('design.opt.ground', '{n} h a day', { n: o.id }), n1: t('design.opt.peryear', '{m} a year', { m: money(o.costPerYear) }), n2: '', dyn: 'ground', lock: null })),
    });
    out.push({
      key: 'avionics',
      cat: 'brains',
      title: t('design.g.avionics', 'Flight computer'),
      why: t('design.g.avionics.why', 'A backup takes over if the first one fails.'),
      options: OPTIONS.avionics.map((o) => ({ value: o.id, label: o.id === 'dual' ? t('design.opt.dual', 'Two computers') : t('design.opt.single', 'One computer'), n1: `${o.mass} kg`, n2: money(o.cost), lock: lockOf('avionics', o.id, P.avionics) })),
    });
    out.push({
      key: 'shield',
      cat: 'brains',
      title: t('design.g.shield', 'Radiation vault'),
      why: m.radiation ? t('design.g.shield.why.rad', 'Jupiter’s belts fry bare electronics. Engineers want 75 kg or more.') : t('design.g.shield.why', 'Only needed where radiation is fierce, like Jupiter.'),
      options: OPTIONS.shield.map((o) => ({ value: o.id, label: o.id ? t('design.opt.vault', '{n} kg vault', { n: o.id }) : t('design.opt.novault', 'No vault'), n1: `${o.id} kg`, n2: money(o.cost), lock: lockOf('shield', o.id, P.shield) })),
    });
    out.push({
      key: 'launcher',
      cat: 'travel',
      title: t('design.g.launcher', 'Launcher'),
      why: t('design.g.launcher.why', 'Bigger rockets lift more, and cost more.'),
      // Crew-rated rockets only for crew missions; a mission may name its own launchers.
      options: OPTIONS.launcher.filter((o) => (m.launchers ? m.launchers.includes(o.id) : !o.crewOnly)).map((o) => ({ value: o.id, label: t('design.opt.launcher.' + o.id, o.name), n1: '', dyn: 'lift', n2: money(o.cost), lock: lockOf('launcher', o.id, P.launcher) })),
    });
    if (m.aerobrake)
      out.push({
        key: 'capture',
        cat: 'travel',
        title: t('design.g.capture', 'How to slow down at arrival'),
        why: esc(t('mission.' + m.key + '.aeroNote', m.aerobrake.note)),
        options: [
          { value: 'propulsive', label: t('design.opt.burn', 'Engine burn'), n1: t('design.opt.burn.n1', 'heavy on fuel'), n2: t('design.opt.burn.n2', 'quick'), lock: null },
          { value: 'aerobrake', label: t('design.opt.aero', 'Aerobraking'), n1: t('design.opt.aero.n1', 'saves fuel'), n2: t('design.opt.days', '{n} days', { n: m.aerobrake.days }), lock: lockOf('capture', 'aerobrake', P.capture) },
        ],
      });
    // Crew safety (crew missions only): from SMD.data.CREW_PARTS.
    if (m.kind === 'crew')
      (SMD.data.CREW_PARTS || []).forEach((g) =>
        out.push({
          key: g.key,
          cat: 'crew',
          title: t('data.crewPart.' + g.key + '.title', g.title),
          why: esc(t('data.crewPart.' + g.key + '.why', g.why)),
          options: (OPTIONS[g.key] || []).map((o) => ({
            value: o.id,
            label: t('data.opt.' + g.key + '.' + o.id, o.name),
            n1: o.mass != null ? `${fmt(o.mass)} kg` : '',
            n2: o.cost ? money(o.cost) : '',
            lock: P[g.key] && !P[g.key].includes(o.id) ? 'locked' : null,
          })),
        })
      );
    if (m.key === 'jupiter')
      out.push({
        key: 'route',
        cat: 'travel',
        title: t('design.g.route', 'Route'),
        why: t('design.g.route.why', 'Juno swung past Earth for a free boost: a cheaper launch, two more years of cruise.'),
        options: [
          { value: 'ega', label: t('design.opt.ega', 'Earth flyby boost'), n1: t('design.opt.ega.n1', '+2 years'), n2: t('design.opt.ega.n2', 'small rocket'), lock: null },
          { value: 'direct', label: t('design.opt.direct', 'Straight there'), n1: t('design.opt.direct.n1', 'fast'), n2: t('design.opt.direct.n2', 'heavy rocket'), lock: P.launcher.includes('heavy') ? null : 'heavy' },
        ],
      });
    out.push({
      key: 'margin',
      cat: 'travel',
      title: t('design.g.margin', 'Fuel margin'),
      why: t('design.g.margin.why', 'Spare fuel for course corrections nobody planned.'),
      options: OPTIONS.margin.map((v) => ({ value: v, label: v ? `+${v}%` : t('design.opt.nomargin', 'None'), n1: v ? t('design.opt.spare', 'spare fuel') : t('design.opt.nospare', 'no spare'), n2: '', dyn: 'margin', lock: null })),
    });
    return out;
  }

  // Which mission goal an instrument serves, and how well.
  function relevance(m, id) {
    let best = null;
    m.objectives.forEach((o) => {
      const q = o.instruments[id] || 0;
      if (q && (!best || q > best.q || (o.key && q >= best.q))) best = { o, q };
    });
    return best;
  }

  // ---------- Screen ----------
  ui.screens.design = {
    render(app, params) {
      const A = SMD.agency;
      const M = SMD.model;
      const ag = SMD.game.agency;
      if (!ag) {
        SMD.go('start');
        return;
      }
      const keys = Object.keys(MISSIONS);
      const missionKey = MISSIONS[params.missionKey] ? params.missionKey : keys.find((k) => A.contractState(ag, k) === 'open') || 'nile';
      const m = MISSIONS[missionKey];
      let confidence = A.CONFIDENCE[params.confidence] ? params.confidence : 'standard';
      let testPlanId = 'standard';
      let design = A.newDesign(ag, missionKey);
      const P = A.parts(ag, missionKey);
      const planetName = SMD.physics.PLANETS[m.dest] ? SMD.physics.PLANETS[m.dest].name : m.dest;
      const missionTitle = t('mission.' + missionKey + '.title', m.title);
      const contract = A.contractState(ag, missionKey);
      const saved = []; // trade study: up to three options
      let pl = null;
      let checks = [];
      let prevOk = {};
      let prevWet = null;
      let prevDry = null;
      let prevSci = null;
      let prevCost = null;
      const bump = (el) => {
        if (reduced() || !el) return;
        el.classList.remove('is-bump');
        void el.offsetWidth;
        el.classList.add('is-bump');
      };
      let allGreen = false;
      let timer = 0;
      let first = true;
      let destroyed = false;
      let scene = null;
      const timers = new Set();
      const later = (fn, ms) => {
        const id = setTimeout(() => {
          timers.delete(id);
          fn();
        }, ms);
        timers.add(id);
        return id;
      };

      const cats = [
        { id: 'science', label: t('design.cat.science', 'Science instruments'), ico: 'hires' },
        { id: 'power', label: t('design.cat.power', 'Power'), ico: 'arrays' },
        { id: 'comms', label: t('design.cat.comms', 'Communication'), ico: 'dish' },
        { id: 'brains', label: t('design.cat.brains', 'Brains & protection'), ico: 'avionics' },
        { id: 'travel', label: t('design.cat.travel', 'Getting there'), ico: 'launcher' },
        { id: 'tests', label: t('design.cat.tests', 'Testing plan'), ico: 'tests' },
      ];
      const isCrew = m.kind === 'crew';
      if (isCrew) cats.splice(1, 0, { id: 'crew', label: t('design.cat.crew', 'Crew safety'), ico: 'heatShield' });
      const catOf = (id) => cats.find((c) => c.id === id);

      // ----- Tray HTML -----
      function lockNote(lock) {
        if (!lock) return '';
        if (lock === 'locked') return `<span class="design-lock">${icon('lock')}${t('design.locked', 'Locked')}</span>`;
        return `<span class="design-lock">${icon('lock')}${t('design.needs', 'Research: {name} · {n} pts', { name: esc(techName(lock)), n: techCost(lock) })}</span>`;
      }

      function instTiles() {
        const ids = Object.keys(INSTRUMENTS).sort((a, b) => {
          const ra = relevance(m, a);
          const rb = relevance(m, b);
          const sa = ra ? (ra.o.key ? 2 : 1) + ra.q * 0.1 : 0;
          const sb = rb ? (rb.o.key ? 2 : 1) + rb.q * 0.1 : 0;
          return sb - sa;
        });
        return ids
          .map((id) => {
            const x = INSTRUMENTS[id];
            const r = relevance(m, id);
            const lock = P.instruments.includes(id) ? null : id;
            const tag = r
              ? r.o.key
                ? `<span class="design-tag is-key">${t('design.tag.key', 'Headline goal')}</span>`
                : `<span class="design-tag">${t('design.tag.goal', 'Helps: {goal}', { goal: esc(t('mission.' + missionKey + '.obj.' + r.o.id, r.o.label)) })}</span>`
              : `<span class="design-tag is-none">${t('design.tag.none', 'No goal here')}</span>`;
            return `<button type="button" class="design-tile design-inst${r ? '' : ' is-offgoal'}" data-inst="${id}" aria-pressed="false" ${lock ? 'aria-disabled="true"' : ''}>
              <span class="design-tile-ico">${icon(id)}</span>
              <span class="design-tile-name">${esc(t('inst.' + id, x.name))}</span>
              <span class="design-tile-nums num"><b>${x.mass} kg</b><b>${x.power} W</b></span>
              ${tag}
              <span class="design-tile-blurb">${esc(t('inst.' + id + '.blurb', x.blurb))}</span>
              ${lockNote(lock)}
              <span class="design-check" aria-hidden="true"></span>
            </button>`;
          })
          .join('');
      }

      function stepper(key, label, unit, lock) {
        return `<div class="design-step${lock ? ' is-locked' : ''}" data-step="${key}" data-hl="${HILITE[key] || ''}">
          <span class="design-tile-ico">${icon(key)}</span>
          <div class="design-step-main">
            <span class="design-tile-name">${label}</span>
            <span class="design-tile-nums num"><b data-dyn="${key}-a"></b><b data-dyn="${key}-b"></b></span>
            ${lockNote(lock)}
          </div>
          <div class="design-step-ctl">
            <button type="button" class="design-step-btn" data-dec="${key}" aria-label="${esc(t('design.step.less', 'Less: {what}', { what: label }))}" ${lock ? 'disabled' : ''}>−</button>
            <output class="design-step-val num" data-val="${key}" aria-live="polite"></output>
            <span class="design-step-unit">${unit}</span>
            <button type="button" class="design-step-btn" data-inc="${key}" aria-label="${esc(t('design.step.more', 'More: {what}', { what: label }))}" ${lock ? 'disabled' : ''}>+</button>
          </div>
        </div>`;
      }

      function groupHTML(g) {
        return `<div class="design-group" data-group="${g.key}" data-hl="${HILITE[g.key] || ''}">
          <h3>${icon(g.key)}<span>${g.title}</span></h3>
          <p class="design-why">${g.why}</p>
          <div class="design-opts" role="radiogroup" aria-label="${esc(g.title)}">
            ${g.options
              .map(
                (o) => `<button type="button" class="design-opt" role="radio" aria-checked="false" data-field="${g.key}" data-value="${esc(String(o.value))}" ${o.lock ? 'aria-disabled="true"' : ''}>
                <span class="design-opt-label">${o.label}</span>
                <span class="design-opt-nums num"><span${o.dyn === 'lift' ? ` data-dyn="lift-${esc(String(o.value))}"` : ''}>${o.n1}</span>${o.n2 || o.dyn ? `<span${o.dyn === 'ground' ? ` data-dyn="ground-${o.value}"` : o.dyn === 'margin' ? ` data-dyn="margin-${o.value}"` : ''}>${o.n2}</span>` : ''}</span>
                ${o.lock ? lockNote(o.lock) : ''}
              </button>`
              )
              .join('')}
          </div>
        </div>`;
      }

      function testTiles() {
        return TEST_PLANS.map((tp) => {
          const cost = tp.tests.reduce((s, id) => s + TESTS.find((x) => x.id === id).cost, 0);
          const months = tp.tests.reduce((s, id) => s + TESTS.find((x) => x.id === id).months, 0);
          return `<button type="button" class="design-tile design-test" role="radio" aria-checked="false" data-test="${tp.id}">
            <span class="design-tile-ico">${icon('tests')}</span>
            <span class="design-tile-name">${esc(t('tests.' + tp.id, tp.name))}</span>
            <span class="design-tile-nums num"><b>${money(cost)}</b><b>${t('design.months', '{n} months', { n: fmt(months, months % 1 ? 1 : 0) })}</b></span>
            <span class="design-tile-blurb">${esc(t('tests.' + tp.id + '.blurb', tp.blurb))}</span>
            <span class="design-check" aria-hidden="true"></span>
          </button>`;
        }).join('');
      }

      function trayHTML() {
        const gs = groups(ag, design, m);
        const sect = (c, inner, lede) => `<section class="design-cat" id="design-cat-${c.id}" aria-labelledby="design-cat-h-${c.id}">
          <h2 id="design-cat-h-${c.id}">${c.label}</h2>${lede ? `<p class="design-why">${lede}</p>` : ''}${inner}</section>`;
        return `<nav class="design-catnav${cats.length > 6 ? ' is-7' : ''}" aria-label="${esc(t('design.tray.nav', 'Part categories'))}">
            ${cats.map((c) => `<button type="button" data-jump="${c.id}" title="${esc(c.label)}">${icon(c.ico)}<span>${c.label}</span></button>`).join('')}
          </nav>
          <div class="design-tray-scroll">
          ${sect(cats[0], `<div class="design-tiles">${instTiles()}</div>`, t('design.cat.science.lede', 'Each instrument serves a goal. The headline goal is what the news will report.'))}
          ${isCrew ? sect(catOf('crew'), gs.filter((g) => g.cat === 'crew').map(groupHTML).join(''), esc(t('design.cat.crew.lede', 'Four people ride this spacecraft. Every safety part adds mass the rocket must lift.'))) : ''}
          ${sect(
            catOf('power'),
            `${stepper('arrays', t('design.arrays', 'Solar panels'), 'm²', null)}${stepper('rtg', t('design.rtg', 'Nuclear battery (RTG)'), '×', P.rtg ? null : 'rtg')}`,
            t('design.cat.power.lede', 'Sunlight at {planet} is {pct}% of what reaches Earth.', { planet: esc(t('planet.' + m.dest, planetName)), pct: fmt(100 * SMD.physics.solarFlux(SMD.physics.PLANETS[m.dest].a) / SMD.physics.solarFlux(1), 0) })
          )}
          ${sect(catOf('comms'), gs.filter((g) => g.cat === 'comms').map(groupHTML).join(''))}
          ${sect(catOf('brains'), gs.filter((g) => g.cat === 'brains').map(groupHTML).join(''))}
          ${sect(catOf('travel'), gs.filter((g) => g.cat === 'travel').map(groupHTML).join(''))}
          ${sect(catOf('tests'), `<div class="design-tiles design-tiles-1" role="radiogroup" aria-label="${esc(catOf('tests').label)}">${testTiles()}</div>`, t('design.cat.tests.lede', 'Tests find hidden flaws before launch. Flaws you miss fly with you.'))}
          </div>`;
      }

      // ----- Page -----
      const confSeg = () =>
        `<div class="seg design-conf" role="group" aria-label="${esc(t('design.conf', 'Cost confidence'))}">${Object.values(A.CONFIDENCE)
          .map((c) => `<button type="button" data-conf="${c.id}" aria-pressed="${c.id === confidence}" title="${esc(t('conf.' + c.id + '.blurb', c.blurb))}">${esc(t('conf.' + c.id, c.name))} <span class="num">${Math.round(c.reserve * 100)}%</span></button>`)
          .join('')}</div>`;

      app.innerHTML = `<main class="screen day design">
        <header class="design-top">
          <button class="btn ghost small" data-back>${t('design.back', 'Back to HQ')}</button>
          <div class="design-heading">
            <p class="design-kicker">${t('design.kicker', 'Phase A design · {planet}', { planet: esc(t('planet.' + m.dest, planetName)) })}</p>
            <h1>${esc(missionTitle)}</h1>
          </div>
          <label class="design-name"><span>${t('design.name', 'Spacecraft name')}</span><input type="text" maxlength="24" value="${esc(design.name)}" data-name spellcheck="false" /></label>
          <div class="design-confwrap"><span class="design-label">${t('design.conf.short', 'Reserve')}</span>${confSeg()}</div>
          <dl class="design-wallet"><dt>${t('design.money', 'In the bank')}</dt><dd class="num">${money(ag.money)}</dd></dl>
        </header>
        <div class="design-body">
          <aside class="design-tray" aria-label="${esc(t('design.tray', 'Parts tray'))}">${trayHTML()}</aside>
          <section class="design-stage" aria-label="${esc(t('design.stage', 'Clean room'))}">
            <div class="design-3d" data-3d></div>
            <div class="design-mass" data-mass></div>
            <div class="design-stage-tools">
              <button type="button" class="btn small design-compare" data-compare hidden></button>
              <div class="design-guide" data-guide hidden></div>
            </div>
            <p class="design-cmpcap" data-cmpcap hidden></p>
            <p class="design-hint" data-hint>${t('design.hint2', 'Drag to look around · you are 1.75 m tall')}</p>
            <div class="design-ribbon" data-ribbon></div>
            <div class="design-cheer" data-cheer aria-hidden="true"></div>
            <div class="design-preview" data-preview aria-live="polite" hidden></div>
            <div class="design-hud" data-hud hidden>
              <button type="button" class="design-hprompt" data-hprompt hidden></button>
              <div class="design-hcarry" data-hcarry role="status" hidden></div>
              <div class="design-hcard" data-hcard data-nowalk role="region" aria-labelledby="design-hcard-t" hidden></div>
              <div class="design-htip" data-htip aria-hidden="true" hidden></div>
            </div>
          </section>
          <aside class="design-side" aria-label="${esc(t('design.side', 'Requirements and numbers'))}">
            <section class="design-panel design-req" aria-labelledby="design-req-h">
              <header><h2 id="design-req-h">${t('design.req', 'Requirements')}</h2><span class="design-req-count num" data-reqcount></span></header>
              <ul class="design-checks" data-checks></ul>
            </section>
            <section class="design-panel" aria-labelledby="design-sci-h">
              <header><h2 id="design-sci-h">${t('design.sci', 'Expected science')}</h2><span class="design-big num" data-scitotal></span></header>
              <div data-science></div>
            </section>
            <section class="design-panel design-real" aria-labelledby="design-real-h" data-realwrap>
              <header><h2 id="design-real-h">${t('design.real', 'You vs the real mission')}</h2><button type="button" class="btn small design-scale" data-compare2 hidden>${t('design.real.scale', 'See both to scale')}</button></header>
              <div data-real></div>
            </section>
            <section class="design-panel" aria-labelledby="design-cost-h">
              <header><h2 id="design-cost-h">${t('design.cost', 'Budget')}</h2><span class="design-big num" data-costtotal></span></header>
              <div data-budget></div>
            </section>
            <section class="design-panel" aria-labelledby="design-sched-h">
              <header><h2 id="design-sched-h">${t('design.sched', 'Schedule')}</h2></header>
              <div data-schedule></div>
            </section>
            <section class="design-panel" aria-labelledby="design-trade-h">
              <header><h2 id="design-trade-h">${t('design.trade', 'Trade study')}</h2></header>
              <p class="design-why">${t('design.trade.lede', 'Engineers never trust one design. Save options and compare them.')}</p>
              <div class="design-trade-btns" data-tradebtns></div>
              <div data-trade></div>
            </section>
          </aside>
        </div>
        <footer class="design-foot">
          <div class="seg design-mode" role="group" aria-label="${esc(t('design.h.mode', 'How to build'))}" data-modeseg>
            <button type="button" data-mode="hands" aria-pressed="false"><svg class="design-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7-3 0-4.5-1.5-6-4l-2.5-4a1.5 1.5 0 0 1 2.5-1.6L7 13"/></svg><span>${t('design.h.mode.hands', 'Build by hand')}</span></button>
            <button type="button" data-mode="panel" aria-pressed="false"><svg class="design-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M12 9h6M12 13h6M12 17h4"/></svg><span>${t('design.h.mode.panel', 'Use the panel')}</span></button>
          </div>
          <button type="button" class="btn ghost small" data-proven>${t('design.proven', 'Load a proven design')}</button>
          <button type="button" class="design-guidebar" data-guidebar hidden></button>
          <p class="design-msg" data-msg role="status" aria-live="polite"></p>
          <div class="design-approve">
            <span class="design-approve-sum num" data-sum></span>
            <button type="button" class="btn primary" data-approve>${t('design.approve', 'Approve and start building')}</button>
          </div>
        </footer>
        <div class="design-tip" data-tipbox role="tooltip" hidden></div>
      </main>`;

      const $ = (s) => app.querySelector(s);
      const $$ = (s) => app.querySelectorAll(s);
      const tray = $('.design-tray');

      // ----- Tray state -----
      function refreshTray() {
        $$('[data-inst]').forEach((b) => {
          const on = design.instruments.includes(b.dataset.inst);
          b.setAttribute('aria-pressed', String(on));
        });
        $$('.design-opt').forEach((b) => {
          const f = b.dataset.field;
          b.setAttribute('aria-checked', String(String(design[f]) === b.dataset.value));
        });
        $$('[data-test]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.test === testPlanId)));
        $('[data-val="arrays"]').textContent = fmt(design.arrays);
        $('[data-val="rtg"]').textContent = fmt(design.rtg);
        $('[data-dec="arrays"]').disabled = design.arrays <= 0;
        $('[data-inc="arrays"]').disabled = design.arrays >= 120;
        $('[data-dec="rtg"]').disabled = !P.rtg || design.rtg <= 0;
        $('[data-inc="rtg"]').disabled = !P.rtg || design.rtg >= P.rtg;
      }

      // Numbers on tiles that depend on the whole design.
      function refreshDyn() {
        if (!pl) return;
        const b = pl.base;
        const set = (k, v) => {
          const el = app.querySelector(`[data-dyn="${k}"]`);
          if (el) el.textContent = v;
        };
        const perM2 = design.arrays ? b.arrayW / design.arrays : 0;
        set('arrays-a', t('design.dyn.watts', '{n} W at {planet}', { n: fmt(b.arrayW), planet: t('planet.' + m.dest, planetName) }));
        set('arrays-b', `${fmt(design.arrays * CONST.arrayKgPerM2 * (design.panelMass || 1))} kg`);
        if (!design.arrays) set('arrays-a', t('design.dyn.perm2', '{n} W per m²', { n: fmt(perM2 || SMD.physics.solarFlux(b.planet.a) * CONST.cellEff * m.arrayFactor * (design.cellBoost || 1)) }));
        set('rtg-a', `${fmt(design.rtg * CONST.rtg.watts)} W`);
        set('rtg-b', `${fmt(design.rtg * CONST.rtg.mass)} kg`);
        const L = pl.launch;
        OPTIONS.launcher.forEach((o) => {
          const cap = L ? M.launcherCapacity(o.id, L.launch.c3, L.launch.leo) : 0;
          set('lift-' + o.id, t('design.dyn.lift', 'lifts {n} kg', { n: fmt(cap) }));
        });
        const rate = avgRate();
        OPTIONS.ground.forEach((o) => set('ground-' + o.id, rate ? t('design.dyn.gbit', '{n} Gbit a day', { n: fmt((rate * o.id * 3600) / 1000, rate * o.id * 3.6 < 10 ? 1 : 0) }) : ''));
        if (L) {
          OPTIONS.margin.forEach((v) => {
            const w = M.wetFor(b.dryNoProp, L.dvTotal, v);
            set('margin-' + v, Number.isFinite(w.wet) ? `${fmt(w.prop)} kg` : '');
          });
        }
      }

      function avgRate() {
        const st = pl && pl.ev && pl.ev.sciState;
        if (!st || !st.forecast) return 0;
        const f = st.forecast;
        const dist = f.reduce((s, x) => s + x.dist, 0) / f.length;
        return M.linkRateMbps(design, dist);
      }

      // ----- Change pipeline -----
      function change(fn, sound) {
        fn();
        A.applyTech(ag, design);
        refreshTray();
        if (sound) sound();
        clearTimeout(timer);
        timer = later(recompute, 60);
      }

      function recompute() {
        if (destroyed) return;
        pl = A.plan(ag, design, testPlanId, confidence);
        checks = A.checks(ag, pl);
        renderChecks();
        renderMass();
        renderScience();
        renderBudget();
        renderSchedule();
        renderTrade();
        renderReal();
        renderFoot();
        renderGuide();
        refreshDyn();
        push3D();
        refreshHands();
        if (scene && scene.view === 'compare') setCompareLabel();
        first = false;
      }

      // Big numbers count to their new value, so every change is felt.
      const tweens = new Map();
      function tweenNum(el, from, to, show) {
        if (!el) return;
        if (tweens.has(el)) cancelAnimationFrame(tweens.get(el));
        if (reduced() || from == null || !Number.isFinite(from) || Math.abs(to - from) < 0.5) {
          el.textContent = show(to);
          return;
        }
        const t0 = performance.now();
        const dur = 420;
        const step = (now) => {
          const k = Math.min(1, (now - t0) / dur);
          const e2 = 1 - Math.pow(1 - k, 3);
          el.textContent = show(from + (to - from) * e2);
          if (k < 1) tweens.set(el, requestAnimationFrame(step));
          else tweens.delete(el);
        };
        el.textContent = show(from);
        tweens.set(el, requestAnimationFrame(step));
      }

      // ----- Requirements -----
      function renderChecks() {
        const list = $('[data-checks]');
        const order = { bad: 0, warn: 1, ok: 2 };
        let flips = 0;
        let up = 0;
        list.innerHTML = checks
          .map((c) => {
            const was = prevOk[c.id];
            const flip = !first && was && was !== c.ok;
            if (flip) {
              flips++;
              if (order[c.ok] > order[was]) up++;
            }
            const fix = c.ok !== 'ok' && FIX[c.id] ? `<button type="button" class="design-fix" data-fix="${c.id}" aria-label="${esc(t('design.fix.aria', 'Show the parts that fix: {what}', { what: c.label }))}">${t('design.fix', 'Fix')}</button>` : '';
            return `<li class="design-chk is-${c.ok}${flip ? ' is-flip' : ''}" data-id="${esc(c.id)}">
              <span class="tone ${c.ok}"><span class="design-sr">${esc({ ok: t('design.ok', 'Good'), warn: t('design.warn', 'Watch'), bad: t('design.bad', 'Problem') }[c.ok])}</span></span>
              <span class="design-chk-text"><b>${esc(c.label)}</b><span>${esc(c.detail)}</span></span>
              <span class="design-chk-acts">${fix}${srcBtn(SRC[c.id])}</span>
            </li>`;
          })
          .join('');
        const green = checks.filter((c) => c.ok === 'ok').length;
        $('[data-reqcount]').textContent = t('design.req.count', '{n} of {all} green', { n: green, all: checks.length });
        if (flips && !first) {
          if (up >= flips - up) SMD.audio.beep(880, 0.07, 'triangle', 0.1);
          else SMD.audio.beep(300, 0.12, 'square', 0.05);
        }
        const nowGreen = green === checks.length;
        if (nowGreen && !allGreen && !first) cheer();
        allGreen = nowGreen;
        prevOk = Object.fromEntries(checks.map((c) => [c.id, c.ok]));
      }

      function cheer() {
        SMD.audio.chime(true);
        const box = $('[data-cheer]');
        const bits = reduced() ? '' : Array.from({ length: 18 }, (_, i) => `<i style="--x:${(Math.random() * 2 - 1).toFixed(2)};--y:${(-0.4 - Math.random()).toFixed(2)};--r:${Math.round(Math.random() * 540)}deg;--d:${(i % 6) * 30}ms"></i>`).join('');
        box.innerHTML = `<div class="design-cheer-card"><b>${t('design.cheer', 'All green!')}</b><span>${t('design.cheer.sub', 'The review board would sign this today.')}</span></div>${bits}`;
        box.classList.remove('is-on');
        void box.offsetWidth;
        box.classList.add('is-on');
        $('.design-req').classList.add('is-allgreen');
        later(() => {
          box.classList.remove('is-on');
          box.innerHTML = '';
        }, 2600);
      }

      // ----- Mass readout and every-kilogram ribbon -----
      function renderMass() {
        const L = pl.launch;
        const box = $('[data-mass]');
        const rib = $('[data-ribbon]');
        if (!L) {
          box.innerHTML = `<p class="design-mass-h"><span>${t('design.mass.none', 'No launch possible with this design')}</span></p>`;
          rib.innerHTML = '';
          return;
        }
        const cap = L.capacity;
        const scale = Math.max(cap, L.wet) * 1.04;
        const over = L.wet > cap;
        const dryPct = (100 * L.dry) / scale;
        const propPct = (100 * L.prop) / scale;
        box.innerHTML = `<p class="design-mass-h"><span>${t('design.mass.launch', 'Launch mass')}</span><b class="num" data-wet>${fmt(prevWet != null ? prevWet : L.wet)} kg</b></p>
          <div class="design-massbar${over ? ' is-over' : ''}" role="img" aria-label="${esc(t('design.mass.aria', '{dry} kg spacecraft and {prop} kg propellant; the rocket lifts {cap} kg', { dry: fmt(L.dry), prop: fmt(L.prop), cap: fmt(cap) }))}">
            <i class="is-dry" style="inline-size:${dryPct.toFixed(2)}%"></i><i class="is-prop" style="inline-size:${propPct.toFixed(2)}%"></i>
            <s style="inset-inline-start:${((100 * cap) / scale).toFixed(2)}%"></s>
          </div>
          <p class="design-mass-legend num"><span class="is-dry">${t('design.mass.dry', 'Spacecraft {n} kg', { n: fmt(L.dry) })}</span><span class="is-prop">${t('design.mass.prop', 'Propellant {n} kg', { n: fmt(L.prop) })}</span><span class="is-cap">${over ? t('design.mass.over', '{n} kg too heavy', { n: fmt(L.wet - cap) }) : t('design.mass.cap', 'Rocket lifts {n} kg', { n: fmt(cap) })}</span></p>`;
        tweenNum(box.querySelector('[data-wet]'), prevWet, L.wet, (v) => `${fmt(v)} kg`);
        const sb = pl.snowball;
        let delta = '';
        if (prevWet !== null && Math.abs(L.wet - prevWet) >= 1) {
          const dw = L.wet - prevWet;
          const dd = prevDry !== null ? pl.base.dryNoProp - prevDry : 0;
          delta = `<span class="design-delta ${dw > 0 ? 'is-up' : 'is-down'}" aria-hidden="true">${dw > 0 ? '+' : '−'}${fmt(Math.abs(dw))} kg ${t('design.rib.atlaunch', 'at launch')}${Math.abs(dd) >= 1 ? ` <small>${t('design.rib.from', 'from {d} kg of parts', { d: (dd > 0 ? '+' : '−') + fmt(Math.abs(dd)) })}</small>` : ''}</span>`;
          if (dw > 0 && !first) SMD.audio.beep(180 + Math.min(200, dw), 0.09, 'sine', 0.08);
        }
        rib.innerHTML = sb
          ? `<span class="design-rib-k">${t('design.rib.k', 'Every kilogram')}</span><span class="design-rib-v">${t('design.rib.v', '+1 kg of hardware = {x} kg at launch', { x: `<b class="num">${sb.toFixed(2)}</b>` })}</span>${srcBtn(SRC.snowball)}${delta}`
          : '';
        prevWet = L.wet;
        prevDry = pl.base.dryNoProp;
      }

      // ----- Expected science per goal -----
      function renderScience() {
        const ex = pl.expected;
        const total = ex ? ex.total : 0;
        const st = $('[data-scitotal]');
        if (!st.firstElementChild) st.innerHTML = `<span>${fmt(total)}</span><small>/100</small>`;
        tweenNum(st.firstElementChild, prevSci, total, (v) => fmt(v));
        if (prevSci != null && total > prevSci + 0.5) bump(st);
        prevSci = total;
        const rows = m.objectives
          .map((o) => {
            const f = ex ? ex.fractions[o.id] || 0 : 0;
            const pts = o.weight * f;
            return `<li class="${o.key ? 'is-key' : ''}">
              <span class="design-goal">${o.key ? `<span class="design-star" aria-label="${esc(t('design.sci.keyaria', 'Headline goal'))}">★</span>` : ''}${esc(t('mission.' + missionKey + '.obj.' + o.id, o.label))}</span>
              <span class="design-goalbar" role="img" aria-label="${esc(t('design.sci.aria', '{pts} of {w} points', { pts: fmt(pts), w: o.weight }))}"><i style="inline-size:${(100 * f).toFixed(1)}%"></i>${o.key ? '<s style="inset-inline-start:80%"></s>' : ''}</span>
              <span class="design-goalpts num">${fmt(pts)}<small>/${o.weight}</small></span>
            </li>`;
          })
          .join('');
        const head = ex && ex.headline;
        $('[data-science]').innerHTML = `<ul class="design-goals">${rows}</ul>
          <p class="design-note ${head ? 'is-ok' : ''}">${head ? t('design.sci.head', 'This design can earn the headline.') : t('design.sci.need', 'The headline needs 70 points and 80% of the ★ goal (the tick on its bar).')}</p>`;
      }

      // ----- Budget -----
      const BUDGET_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
      function renderBudget() {
        const c = pl.cost;
        const items = [
          { k: 'build', label: t('design.cost.build', 'Build and test'), v: c.build },
          { k: 'reserve', label: t('design.cost.reserve', 'Reserve ({pct}%)', { pct: Math.round(pl.confidence.reserve * 100) }), v: c.reserve },
          { k: 'launcher', label: t('design.cost.launcher', 'Launcher'), v: c.launcher },
          { k: 'ops', label: t('design.cost.ops', 'Operations'), v: c.ops },
        ];
        const income = A.yearlyIncome(ag);
        tweenNum($('[data-costtotal]'), prevCost, c.total, (v) => money(v));
        prevCost = c.total;
        const bar = items.map((x, i) => `<i style="flex-grow:${Math.max(0.0001, x.v).toFixed(2)};background:${BUDGET_COLORS[i]}" title="${esc(x.label)}: ${money(x.v)}"></i>`).join('');
        const over = c.total > ag.money;
        $('[data-budget]').innerHTML = `<div class="design-stack" role="img" aria-label="${esc(items.map((x) => `${x.label} ${money(x.v)}`).join(', '))}">${bar}</div>
          <ul class="design-legend">${items.map((x, i) => `<li><i style="background:${BUDGET_COLORS[i]}"></i><span>${esc(x.label)}</span><b class="num">${money(x.v)}</b></li>`).join('')}</ul>
          <p class="design-note ${over ? 'is-warn' : ''}">${t('design.cost.have', 'You have {have} now, and earn about {inc} a year. Money is spent month by month while you build.', { have: money(ag.money), inc: money(income) })}${srcBtn(SRC.money)}</p>`;
      }

      // ----- Schedule -----
      function renderSchedule() {
        const L = pl.launch;
        const el = $('[data-schedule]');
        if (!L) {
          el.innerHTML = `<p class="design-note is-warn">${t('design.sched.none', 'No launch date: the design cannot fly yet.')}</p>`;
          return;
        }
        const now = ag.now;
        const ready = pl.readyMs;
        const launch = L.launch.departMs;
        const arrive = L.launch.arriveMs;
        const mo = (a, b) => Math.max(0, A.monthsBetween(a, b));
        const segs = [
          { k: 'build', n: mo(now, ready), label: t('design.sched.build', 'Build') },
          { k: 'wait', n: mo(ready, launch), label: t('design.sched.wait', 'Wait for window') },
          { k: 'cruise', n: mo(launch, arrive), label: t('design.sched.cruise', 'Cruise') },
        ].filter((s) => s.n > 0);
        const total = segs.reduce((s, x) => s + x.n, 0) || 1;
        el.innerHTML = `<div class="design-sched" role="img" aria-label="${esc(segs.map((s) => `${s.label}: ${s.n}`).join(', '))}">
            ${segs.map((s) => `<i class="is-${s.k}" style="flex-grow:${Math.max(total * 0.06, s.n)}"><span>${esc(s.label)} · ${s.n} ${t('design.mo', 'mo')}</span></i>`).join('')}
          </div>
          <dl class="design-dates">
            <div><dt>${t('design.sched.ready', 'Ready')}</dt><dd class="num">${A.fmtMonth(ready)}</dd></div>
            <div><dt>${t('design.sched.launch', 'Launch')}</dt><dd class="num">${A.fmtMonth(launch)}</dd></div>
            <div><dt>${m.kind === 'earth' ? t('design.sched.ops', 'Science starts') : t('design.sched.arrive', 'Arrival')}</dt><dd class="num">${A.fmtMonth(m.kind === 'earth' ? launch : arrive)}</dd></div>
          </dl>
          ${pl.overload ? `<p class="design-note is-warn">${t('design.sched.overload', 'Your teams are stretched: building takes longer.')}</p>` : ''}
          ${L.waitMonths > 8 ? `<p class="design-note is-warn">${t('design.sched.waitlong', 'Ready {n} months before the window opens. Storage costs money every month.', { n: Math.round(L.waitMonths) })}</p>` : ''}`;
      }

      // ----- Trade study -----
      const TRADE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'];
      const LETTERS = ['A', 'B', 'C'];
      function metrics(p) {
        return {
          mass: p.launch ? p.launch.wet : NaN,
          power: (p.base.powerMargin - 1) * 100,
          cost: p.cost.total,
          science: p.expected ? p.expected.total : 0,
          risk: p.riskAnyFlaw * 100,
        };
      }
      function renderTrade() {
        const btns = $('[data-tradebtns]');
        const full = saved.length >= 3;
        btns.innerHTML = `${saved
          .map(
            (s, i) => `<span class="design-slot" style="--c:${TRADE_COLORS[i]}"><button type="button" class="design-slot-load" data-load="${i}" title="${esc(t('design.trade.load', 'Load option {l}', { l: LETTERS[i] }))}"><i></i>${t('design.trade.opt', 'Option {l}', { l: LETTERS[i] })}</button><button type="button" class="design-slot-x" data-drop="${i}" aria-label="${esc(t('design.trade.drop', 'Remove option {l}', { l: LETTERS[i] }))}">×</button></span>`
          )
          .join('')}<button type="button" class="btn small" data-save ${full ? 'disabled' : ''}>${full ? t('design.trade.full', 'Three saved') : t('design.trade.save', 'Save as option {l}', { l: LETTERS[saved.length] })}</button>`;
        const el = $('[data-trade]');
        if (!saved.length) {
          el.innerHTML = '';
          return;
        }
        const now = metrics(pl);
        const series = saved.map((s, i) => ({ label: LETTERS[i], color: TRADE_COLORS[i], v: s.m })).concat([{ label: t('design.trade.now', 'Now'), color: 'var(--graphite)', v: now, now: true }]);
        const rows = [
          { k: 'mass', label: t('design.trade.mass', 'Launch mass'), unit: 'kg', better: 'low' },
          { k: 'power', label: t('design.trade.power', 'Power margin'), unit: '%', better: 'high' },
          { k: 'cost', label: t('design.trade.cost', 'Total cost'), unit: '$M', better: 'low' },
          { k: 'science', label: t('design.trade.science', 'Science'), unit: 'pts', better: 'high' },
          { k: 'risk', label: t('design.trade.risk', 'Flaw risk'), unit: '%', better: 'low' },
        ];
        el.innerHTML = `<div class="design-trade">${rows
          .map((r) => {
            const vals = series.map((s) => s.v[r.k]).filter(Number.isFinite);
            const max = Math.max(1, ...vals.map(Math.abs));
            const best = r.better === 'low' ? Math.min(...vals) : Math.max(...vals);
            return `<div class="design-trade-row"><p>${esc(r.label)} <span class="muted">${r.better === 'low' ? t('design.trade.low', 'lower is better') : t('design.trade.high', 'higher is better')}</span></p>
              ${series
                .map((s) => {
                  const v = s.v[r.k];
                  const w = Number.isFinite(v) ? Math.max(1.5, (100 * Math.max(0, v)) / max) : 0;
                  const txt = !Number.isFinite(v) ? '–' : r.unit === '$M' ? money(v) : `${fmt(v)} ${r.unit}`;
                  return `<div class="design-trade-bar${s.now ? ' is-now' : ''}${Number.isFinite(v) && v === best && vals.length > 1 ? ' is-best' : ''}"><span class="design-trade-l">${esc(s.label)}</span><span class="design-trade-track"><i style="inline-size:${w.toFixed(1)}%;background:${s.color}"></i></span><span class="design-trade-v num">${txt}</span></div>`;
                })
                .join('')}
            </div>`;
          })
          .join('')}</div>`;
      }

      // ----- Real mission comparison -----
      // A real figure like "Up to 6 Mbps" or "268.8 kbps" in Mbps, or null.
      function mbps(s) {
        const x = /([\d.,]+)\s*(G|M|k)bps/i.exec(String(s || ''));
        if (!x) return null;
        const v = Number(x[1].replace(/,/g, ''));
        return v * ({ g: 1000, m: 1, k: 0.001 }[x[2].toLowerCase()] || 1);
      }
      // "1/11", "45%", "1.8×": how big yours is next to the real one.
      function ratioText(you, real) {
        const r = you / real;
        if (!Number.isFinite(r) || r <= 0) return '';
        if (r >= 1.15) return t('design.real.times', '{x}×', { x: fmt(r, r < 10 ? 1 : 0) });
        if (r >= 0.5) return t('design.real.pct', '{n}%', { n: Math.round(r * 100) });
        return t('design.real.frac', '1/{n}', { n: Math.round(1 / r) });
      }
      function renderReal() {
        const R = (SMD.content && SMD.content.realMissions && SMD.content.realMissions[missionKey]) || REAL_FALLBACK[missionKey];
        const wrap = $('[data-realwrap]');
        if (!R) {
          wrap.hidden = true;
          return;
        }
        wrap.hidden = false;
        const L = pl.launch;
        const rate = avgRate();
        const rateTxt = rate ? (rate >= 1 ? `${fmt(rate, rate < 10 ? 1 : 0)} Mbps` : `${fmt(rate * 1000)} kbps`) : '–';
        const realName = R.short || String(R.name).replace(/\s*\(.*\)\s*$/, '');
        // Paired bars: yours in gold, the real one in graphite, on one scale per row.
        const row = (label, you, youTxt, real, realTxt) => {
          const both = Number.isFinite(you) && Number.isFinite(real) && real > 0;
          const max = both ? Math.max(you, real) : 1;
          const w = (v) => (both ? Math.max(1.5, (100 * Math.max(0, v)) / max).toFixed(1) : 0);
          return `<li class="design-vs-row">
              <p class="design-vs-h"><span>${label}</span>${both ? `<b class="num">${esc(ratioText(you, real))}</b>` : ''}</p>
              <p class="design-vs-bar is-you"><span class="design-vs-track"><i style="inline-size:${w(you)}%"></i></span><span class="num">${esc(youTxt)}</span></p>
              <p class="design-vs-bar is-real"><span class="design-vs-track"><i style="inline-size:${w(real)}%"></i></span><span class="num">${realTxt ? esc(realTxt) : '–'}</span></p>
            </li>`;
        };
        const realRate = mbps(R.dataRate);
        const verdict = L && R.launchMassKg ? t('design.real.verdict', 'Your spacecraft weighs {r} of {name} at launch.', { r: ratioText(L.wet, R.launchMassKg), name: realName }) : '';
        $('[data-real]').innerHTML = `<p class="design-vs-key"><span class="is-you">${esc(design.name)}</span><span class="is-real">${esc(R.name)}</span></p>
          ${verdict ? `<p class="design-vs-verdict">${esc(verdict)}</p>` : ''}
          <ul class="design-vs">
            ${row(t('design.real.mass', 'Launch mass'), L ? L.wet : NaN, L ? `${fmt(L.wet)} kg` : '–', R.launchMassKg, R.launchMassKg != null ? `${fmt(R.launchMassKg)} kg` : null)}
            ${row(t('design.real.power', 'Power at target'), pl.base.powerAvail, `${fmt(pl.base.powerAvail)} W`, R.powerW, R.powerW != null ? `${fmt(R.powerW)} W` : R.power || null)}
            ${row(t('design.real.rate', 'Data rate'), rate, rateTxt, realRate, R.dataRate || null)}
            ${row(t('design.real.cost', 'Cost'), pl.cost.total, money(pl.cost.total), R.costM, R.costM != null ? money(R.costM) : null)}
          </ul>
          <p class="design-note">${R.launch ? esc(t('content.realMissions.' + missionKey + '.launch', R.launch)) + '. ' : ''}${t('design.real.note', 'Real missions carry many more instruments and decades of experience.')}${R.source ? ` <a href="${esc(R.source)}" target="_blank" rel="noopener">${t('design.src', 'source')}</a>` : ''}</p>`;
      }

      // ----- First-mission guide: three steps, ticked off live -----
      let guideOn = ag.projects.length < 2;
      try {
        if (localStorage.getItem('ek-design-guide') === 'off') guideOn = false;
      } catch (e) {}
      function guideSteps() {
        const sci = checks.find((c) => c.id === 'science');
        const bad = checks.filter((c) => c.ok === 'bad');
        const green = checks.filter((c) => c.ok === 'ok').length;
        const s1 = !!sci && sci.ok !== 'bad';
        const s2 = s1 && !bad.length;
        return {
          bad,
          now: !s1 ? 0 : !s2 ? 1 : 2,
          list: [
            { done: s1, text: t('design.guide.1', 'Add a ★ headline instrument') },
            { done: s2, text: t('design.guide.2', 'Clear every red requirement'), extra: t('design.guide.2n', '{n} of {all} green', { n: green, all: checks.length }) },
            { done: false, text: t('design.guide.3', 'Approve and start building') },
          ],
        };
      }
      function renderGuide() {
        const box = $('[data-guide]');
        const bar = $('[data-guidebar]');
        app.querySelectorAll('.is-guide').forEach((el) => el.classList.remove('is-guide'));
        $('[data-approve]').classList.remove('is-next');
        const handsOn = mode === 'hands' && handsReady && scene;
        if (!guideOn || blocker()) {
          box.hidden = true;
          bar.hidden = true;
          if (handsOn) scene.hands.beacon(null);
          return;
        }
        const g = guideSteps();
        // In the room, a gold marker floats over the rack to visit next.
        if (handsOn) scene.hands.beacon(g.now === 0 ? 'inst' : g.now === 1 && g.bad[0] ? CHECK_STATION[g.bad[0].id] || null : null);
        box.hidden = false;
        box.innerHTML = `<p class="design-guide-h"><b>${t('design.guide.h', 'Your first spacecraft')}</b><button type="button" class="design-guide-x" data-guidex aria-label="${esc(t('design.guide.hide', 'Hide the steps'))}">×</button></p>
          <ol>${g.list
            .map((s, i) => `<li class="${s.done ? 'is-done' : i === g.now ? 'is-now' : ''}"><span class="design-guide-n" aria-hidden="true">${s.done ? '✓' : i + 1}</span><span>${esc(s.text)}${s.extra && i === g.now ? ` <small class="num">${esc(s.extra)}</small>` : ''}</span></li>`)
            .join('')}</ol>`;
        const cur = g.list[g.now];
        bar.hidden = false;
        bar.innerHTML = `<span class="design-guide-n" aria-hidden="true">${g.now + 1}</span><span>${esc(t('design.guide.step', 'Step {i} of 3: {what}', { i: g.now + 1, what: cur.text }))}${cur.extra ? ` <small class="num">· ${esc(cur.extra)}</small>` : ''}</span>`;
        bar.dataset.step = String(g.now);
        // Point at the thing to do now.
        if (g.now === 0) app.querySelectorAll('.design-tag.is-key').forEach((tag) => tag.closest('.design-tile').classList.add('is-guide'));
        else if (g.now === 1 && g.bad[0]) {
          const li = app.querySelector(`.design-chk[data-id="${g.bad[0].id}"]`);
          if (li) li.classList.add('is-guide');
        } else if (g.now === 2) $('[data-approve]').classList.add('is-next');
      }

      function scrollPanel(el, where) {
        let sc = el.parentElement;
        while (sc && sc !== app) {
          const oy = getComputedStyle(sc).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight + 1) break;
          sc = sc.parentElement;
        }
        if (!sc || sc === app) return;
        const r = el.getBoundingClientRect();
        const sr = sc.getBoundingClientRect();
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        const top = where === 'center' ? r.top - sr.top - (sc.clientHeight - r.height) / 2 : r.top - sr.top - margin - 6;
        sc.scrollBy({ top, behavior: reduced() ? 'auto' : 'smooth' });
      }

      // A requirement's Fix button: jump to the parts that change it, and flash them.
      function jumpTo(id) {
        // Building by hand: walk to the rack that fixes it and open it.
        if (mode === 'hands' && handsReady && scene && scene.view !== 'compare' && CHECK_STATION[id]) {
          scene.hands.beacon(CHECK_STATION[id]);
          goStation(CHECK_STATION[id]);
          SMD.audio.beep(660, 0.06, 'triangle', 0.1);
          return;
        }
        const where = FIX[id];
        const el = where === 'conf' ? $('.design-confwrap') : app.querySelector('#design-cat-' + where);
        if (!el) return;
        if (where !== 'conf') scrollPanel(el);
        el.classList.remove('is-flash');
        void el.offsetWidth;
        el.classList.add('is-flash');
        later(() => el.classList.remove('is-flash'), 1800);
        SMD.audio.beep(660, 0.06, 'triangle', 0.1);
      }

      // ----- Footer -----
      function renderFoot() {
        $('[data-sum]').innerHTML = t('design.sum', '{cost} · {pct}% reserve', { cost: `<b>${money(pl.cost.total)}</b>`, pct: Math.round(pl.confidence.reserve * 100) });
        const btn = $('[data-approve]');
        const why = blocker();
        btn.disabled = !!why;
        btn.title = why || '';
        if (why) setMsg(why, 'warn', true);
        else if ($('[data-msg]').dataset.sticky === 'block') setMsg('', null);
      }

      function blocker() {
        if (contract === 'busy') return t('design.block.busy', 'This mission is already being built. Design freely, but you cannot approve a second one.');
        if (contract === 'done') return t('design.block.done', 'You already earned this headline.');
        if (contract === 'locked' || contract === 'needsTech') return t('design.block.locked', 'This contract is not open to your agency yet.');
        return '';
      }

      function setMsg(text, tone, block) {
        const el = $('[data-msg]');
        el.innerHTML = text ? `${tone ? `<span class="tone ${tone}"></span>` : ''}<span>${esc(text)}</span>` : '';
        el.dataset.sticky = block ? 'block' : '';
      }

      // ----- 3D -----
      function push3D() {
        if (!scene) return;
        const L = pl.launch;
        scene.setDesign(design, { dryKg: L ? L.dry : pl.base.dryNoProp, propKg: L ? L.prop : 0, keepCamera: true });
      }

      function start3D() {
        const E = SMD.three && SMD.three.engine;
        if (!E) return;
        import(new URL('js/3d/designer.js', document.baseURI).href)
          .then((mod) => {
            if (destroyed) return;
            scene = mod.createDesigner(E.getRenderer().domElement, { onHand: (e) => onHand(e) });
            E.mount($('[data-3d]'), scene);
            scene.setPersonLabel(t('design.3d.person', '1.75 m'));
            updateInsets();
            if (pl) push3D();
            setupHands();
            const a = ANALOG[missionKey];
            const tryAnalog = (spec) =>
              scene.setAnalog({ id: spec.id, sizeM: spec.sizeM, label: spec.name, sub: t('design.3d.real', 'Real NASA spacecraft, to scale') }).then((ok) => {
                if (destroyed) return;
                if (!ok && spec.alt) return tryAnalog(spec.alt);
                if (ok) {
                  const b = $('[data-compare]');
                  b.hidden = false;
                  b.dataset.name = spec.short || spec.name;
                  $('[data-compare2]').hidden = false;
                  setCompareLabel();
                  updateInsets();
                }
              });
            if (a) tryAnalog(a);
          })
          .catch((e) => console.warn('designer 3D failed', e));
      }
      const RULER = '<svg class="design-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="7" cy="5" r="2"/><path d="M7 8v6M4.5 11h5M5 21l2-7 2 7"/><path d="M15 3v18M15 6h3M15 10h2M15 14h3M15 18h2"/></svg>';
      function setCompareLabel() {
        const b = $('[data-compare]');
        const on = scene && scene.view === 'compare';
        b.innerHTML = on ? `<span>${t('design.3d.back', 'Back to my spacecraft')}</span>` : `${RULER}<span>${esc(t('design.3d.compare', 'Stand next to {name}', { name: b.dataset.name || '' }))}<small>${t('design.3d.compare.s', 'Real NASA spacecraft, to scale')}</small></span>`;
        b.setAttribute('aria-pressed', String(!!on));
        $('.design-stage').classList.toggle('is-compare', !!on);
        $('[data-compare2]').textContent = on ? t('design.3d.back', 'Back to my spacecraft') : t('design.real.scale', 'See both to scale');
        const cap = $('[data-cmpcap]');
        const Rm = (SMD.content && SMD.content.realMissions && SMD.content.realMissions[missionKey]) || REAL_FALLBACK[missionKey];
        if (on && pl && pl.launch && Rm && Rm.launchMassKg) {
          cap.textContent = t('design.3d.cap', '{real}: {rkg} kg at launch. {mine}: {kg} kg.', { real: b.dataset.name || Rm.name, rkg: fmt(Rm.launchMassKg), mine: design.name, kg: fmt(pl.launch.wet) });
          cap.hidden = false;
        } else cap.hidden = true;
      }
      function toggleCompare() {
        if (!scene) return;
        closeCard();
        hideHTip();
        scene.setView(scene.view === 'compare' ? 'craft' : 'compare');
        renderCarry();
        renderPrompt();
        SMD.audio.beep(520, 0.08, 'sine', 0.1);
        setCompareLabel();
      }
      // Keep the craft in the clear band between the mass card and the ribbon.
      function updateInsets() {
        if (!scene || !scene.setInsets || destroyed) return;
        const st = $('.design-stage').getBoundingClientRect();
        $('.design-stage').classList.toggle('is-narrow', st.width < 700);
        const mass = $('[data-mass]').getBoundingClientRect();
        const rib = $('[data-ribbon]').getBoundingClientRect();
        const narrow = st.width < 560;
        scene.setInsets({
          top: mass.height && !narrow ? Math.max(0, mass.bottom - st.top) : mass.height ? Math.max(0, mass.bottom - st.top) * 0.6 : 0,
          bottom: rib.height ? Math.max(0, st.bottom - rib.top) : 0,
        });
      }
      const insetRO = new ResizeObserver(() => updateInsets());
      insetRO.observe($('.design-stage'));
      insetRO.observe($('[data-mass]'));

      // ----- Events -----
      $('[data-back]').addEventListener('click', () => SMD.go('hq'));
      $('[data-name]').addEventListener('input', (e) => {
        design.name = e.target.value.trim().slice(0, 24) || design.name;
        later(() => renderReal(), 0);
      });
      $$('[data-conf]').forEach((b) =>
        b.addEventListener('click', () => {
          confidence = b.dataset.conf;
          $$('[data-conf]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          change(() => {}, () => SMD.audio.beep(620, 0.06, 'triangle', 0.1));
        })
      );
      $('[data-compare]').addEventListener('click', toggleCompare);
      $('[data-compare2]').addEventListener('click', toggleCompare);
      // Requirements: Fix jumps to the parts. Guide: hide, or follow the step.
      $('.design-side').addEventListener('click', (e) => {
        const b = e.target.closest('[data-fix]');
        if (b) jumpTo(b.dataset.fix);
      });
      $('[data-guide]').addEventListener('click', (e) => {
        if (!e.target.closest('[data-guidex]')) return;
        guideOn = false;
        try {
          localStorage.setItem('ek-design-guide', 'off');
        } catch (err) {}
        renderGuide();
      });
      $('[data-guidebar]').addEventListener('click', () => {
        const step = Number($('[data-guidebar]').dataset.step);
        if (step === 0) jumpTo('science');
        else if (step === 1) {
          const g = guideSteps();
          if (mode === 'hands' && g.bad[0] && CHECK_STATION[g.bad[0].id]) return jumpTo(g.bad[0].id);
          const li = g.bad[0] && app.querySelector(`.design-chk[data-id="${g.bad[0].id}"]`);
          if (li) scrollPanel(li, 'center');
        } else $('[data-approve]').focus();
      });

      const locked = (b) => b.getAttribute('aria-disabled') === 'true';
      const nope = (b) => {
        SMD.audio.beep(220, 0.08, 'square', 0.05);
        b.classList.remove('is-shake');
        void b.offsetWidth;
        b.classList.add('is-shake');
      };
      tray.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || !tray.contains(b)) return;
        if (b.dataset.jump) {
          const sec = app.querySelector('#design-cat-' + b.dataset.jump);
          if (sec) scrollPanel(sec);
          return;
        }
        if (b.dataset.inst) {
          if (locked(b)) return nope(b);
          const id = b.dataset.inst;
          const on = !design.instruments.includes(id);
          change(
            () => (design.instruments = on ? design.instruments.concat(id) : design.instruments.filter((x) => x !== id)),
            () => SMD.audio.beep(on ? 760 : 420, 0.07, 'triangle', 0.12)
          );
          b.classList.remove('is-pop');
          void b.offsetWidth;
          b.classList.add('is-pop');
          return;
        }
        if (b.dataset.field) {
          if (locked(b)) return nope(b);
          const f = b.dataset.field;
          const raw = b.dataset.value;
          const v = CREW_KEYS.includes(f) ? crewValue(f, raw) : typeof design[f] === 'number' ? Number(raw) : raw;
          if (design[f] === v) return;
          const idx = [...b.parentNode.children].indexOf(b);
          change(() => (design[f] = v), () => SMD.audio.beep(520 + idx * 120, 0.06, 'triangle', 0.11));
          return;
        }
        if (b.dataset.test) {
          testPlanId = b.dataset.test;
          change(() => {}, () => SMD.audio.beep(600, 0.06, 'triangle', 0.1));
          return;
        }
        const step = b.dataset.inc || b.dataset.dec;
        if (step) {
          const dir = b.dataset.inc ? 1 : -1;
          if (step === 'arrays') {
            const v = design.arrays;
            const s = dir > 0 ? (v < 10 ? 1 : v < 40 ? 2 : 5) : v <= 10 ? 1 : v <= 40 ? 2 : 5;
            change(() => (design.arrays = Math.max(0, Math.min(120, v + dir * s))), () => SMD.audio.beep(400 + Math.min(600, design.arrays * 8), 0.05, 'sine', 0.1));
          } else if (step === 'rtg') {
            change(() => (design.rtg = Math.max(0, Math.min(P.rtg, design.rtg + dir))), () => SMD.audio.beep(dir > 0 ? 700 : 450, 0.06, 'triangle', 0.1));
          }
        }
      });
      // Arrow keys move between options in a radio group.
      tray.addEventListener('keydown', (e) => {
        const b = e.target.closest('.design-opt, .design-test');
        if (!b || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        const sibs = [...b.parentNode.querySelectorAll('.design-opt, .design-test')];
        const rtl = SMD.dir() === 'rtl';
        const fwd = e.key === 'ArrowDown' || (e.key === 'ArrowRight') !== rtl;
        const n = sibs[(sibs.indexOf(b) + (fwd ? 1 : sibs.length - 1)) % sibs.length];
        n.focus();
        e.preventDefault();
      });
      // Hovering or focusing a tile lights up that part on the spacecraft.
      const hl = (e) => {
        if (!scene) return;
        const el = e.target.closest && e.target.closest('[data-inst], [data-hl]');
        const key = el ? el.dataset.inst || el.dataset.hl || null : null;
        scene.highlightPart(key);
      };
      tray.addEventListener('pointerover', hl);
      tray.addEventListener('focusin', hl);
      tray.addEventListener('pointerleave', () => scene && scene.highlightPart(null));

      // Trade-off preview: before you click, see what a part would do to the
      // launch mass, the cost, the science and the requirements.
      let pvKey = '';
      let pvTimer = 0;
      function previewChange(b) {
        if (!b || locked(b) || b.disabled) return null;
        if (b.dataset.inst) {
          const id = b.dataset.inst;
          const on = !design.instruments.includes(id);
          const name = t('inst.' + id, INSTRUMENTS[id].name);
          return {
            key: 'i' + id + on,
            title: on ? t('design.pv.add', 'Add {what}', { what: name }) : t('design.pv.remove', 'Remove {what}', { what: name }),
            apply: (d) => (d.instruments = on ? d.instruments.concat(id) : d.instruments.filter((x) => x !== id)),
          };
        }
        if (b.dataset.field) {
          const f = b.dataset.field;
          const v = CREW_KEYS.includes(f) ? crewValue(f, b.dataset.value) : typeof design[f] === 'number' ? Number(b.dataset.value) : b.dataset.value;
          if (design[f] === v) return null;
          const label = (b.querySelector('.design-opt-label') || b).textContent.trim();
          return { key: 'f' + f + v, title: t('design.pv.pick', 'Pick {what}', { what: label }), apply: (d) => (d[f] = v) };
        }
        if (b.dataset.test && b.dataset.test !== testPlanId) {
          const label = (b.querySelector('.design-tile-name') || b).textContent.trim();
          return { key: 't' + b.dataset.test, title: t('design.pv.pick', 'Pick {what}', { what: label }), test: b.dataset.test };
        }
        return null;
      }
      // What a change would do, as chips: launch mass, spare power, cost,
      // science, and the requirements it fixes or hurts. Shared by the panel's
      // hover preview and the hands-on cards.
      function deltaChips(apply, test) {
        if (!pl) return '';
        let p2;
        let ck2;
        try {
          const d = JSON.parse(JSON.stringify(design));
          if (apply) apply(d);
          A.applyTech(ag, d);
          p2 = A.plan(ag, d, test || testPlanId, confidence);
          ck2 = A.checks(ag, p2);
        } catch (err) {
          return '';
        }
        const chip = (txt, tone) => `<span class="design-pv-chip is-${tone}">${esc(txt)}</span>`;
        const bits = [];
        const w1 = pl.launch ? pl.launch.wet : null;
        const w2 = p2.launch ? p2.launch.wet : null;
        if (w1 != null && w2 != null && Math.abs(w2 - w1) >= 1) bits.push(chip(t('design.pv.kg', '{d} kg at launch', { d: (w2 > w1 ? '+' : '−') + fmt(Math.abs(w2 - w1)) }), w2 > w1 ? 'worse' : 'better'));
        const sp1 = pl.base.powerAvail - pl.base.powerReq;
        const sp2 = p2.base.powerAvail - p2.base.powerReq;
        if (Number.isFinite(sp1) && Number.isFinite(sp2) && Math.abs(sp2 - sp1) >= 1) bits.push(chip(t('design.pv.power', '{d} W spare power', { d: (sp2 > sp1 ? '+' : '−') + fmt(Math.abs(sp2 - sp1)) }), sp2 > sp1 ? 'better' : 'worse'));
        const dc = p2.cost.total - pl.cost.total;
        if (Math.abs(dc) >= 0.5) bits.push(chip((dc > 0 ? '+' : '−') + money(Math.abs(dc)), dc > 0 ? 'worse' : 'better'));
        const s1 = pl.expected ? pl.expected.total : 0;
        const s2 = p2.expected ? p2.expected.total : 0;
        if (Math.abs(s2 - s1) >= 0.5) bits.push(chip(t('design.pv.sci', '{d} science', { d: (s2 > s1 ? '+' : '−') + fmt(Math.abs(s2 - s1)) }), s2 > s1 ? 'better' : 'worse'));
        const was = Object.fromEntries(checks.map((x) => [x.id, x.ok]));
        const rank = { bad: 0, warn: 1, ok: 2 };
        const fixed = ck2.filter((x) => was[x.id] && rank[x.ok] > rank[was[x.id]]).map((x) => x.label);
        const broke = ck2.filter((x) => was[x.id] && rank[x.ok] < rank[was[x.id]]).map((x) => x.label);
        if (fixed.length) bits.push(chip(t('design.pv.fixes', 'Fixes: {list}', { list: fixed.join(', ') }), 'better'));
        if (broke.length) bits.push(chip(t('design.pv.breaks', 'Hurts: {list}', { list: broke.join(', ') }), 'worse'));
        if (!bits.length) bits.push(chip(t('design.pv.none', 'Little change'), 'flat'));
        return bits.join('');
      }
      function showPreview(b) {
        const box = $('[data-preview]');
        const c = previewChange(b);
        if (!c || !pl) return hidePreview();
        if (c.key === pvKey && !box.hidden) return;
        pvKey = c.key;
        const chips = deltaChips(c.apply, c.test);
        if (!chips) return hidePreview();
        box.innerHTML = `<b>${esc(c.title)}</b>${chips}`;
        box.hidden = false;
        $('.design-stage').classList.add('is-preview');
      }
      function hidePreview() {
        pvKey = '';
        clearTimeout(pvTimer);
        const box = $('[data-preview]');
        box.hidden = true;
        $('.design-stage').classList.remove('is-preview');
      }
      const pvTarget = (e) => e.target.closest && e.target.closest('[data-inst], .design-opt, [data-test]');
      tray.addEventListener('pointerover', (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        const b = pvTarget(e);
        clearTimeout(pvTimer);
        if (!b) return hidePreview();
        pvTimer = later(() => showPreview(b), 70);
      });
      tray.addEventListener('focusin', (e) => {
        const b = pvTarget(e);
        if (b && b.matches(':focus-visible')) showPreview(b);
        else hidePreview();
      });
      tray.addEventListener('pointerleave', hidePreview);
      tray.addEventListener('focusout', (e) => {
        if (!tray.contains(e.relatedTarget)) hidePreview();
      });
      // After a click the preview would describe undoing it: clear it.
      tray.addEventListener('click', () => {
        hidePreview();
      });

      // Trade study buttons.
      $('[data-tradebtns]').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-save') && saved.length < 3 && pl) {
          saved.push({ design: JSON.parse(JSON.stringify(design)), testPlanId, m: metrics(pl) });
          SMD.audio.beep(880, 0.06, 'triangle', 0.12);
          later(() => SMD.audio.beep(1175, 0.08, 'triangle', 0.12), 70);
          renderTrade();
        } else if (b.dataset.load !== undefined) {
          const s = saved[Number(b.dataset.load)];
          const name = design.name;
          change(() => {
            design = Object.assign(JSON.parse(JSON.stringify(s.design)), { name });
            testPlanId = s.testPlanId;
          }, () => SMD.audio.beep(660, 0.08, 'triangle', 0.12));
        } else if (b.dataset.drop !== undefined) {
          saved.splice(Number(b.dataset.drop), 1);
          renderTrade();
        }
      });

      // Beginner helper: start from a design that is known to fly.
      $('[data-proven]').addEventListener('click', () => {
        const pv = PROVEN[missionKey] || m.proven;
        if (!pv) return;
        const name = design.name;
        change(() => {
          design = Object.assign(A.newDesign(ag, missionKey), JSON.parse(JSON.stringify(pv)), { name });
          A.applyTech(ag, design);
          testPlanId = 'standard';
          for (const tp of ['standard', 'thorough']) {
            try {
              const p2 = A.plan(ag, design, tp, confidence);
              const ck = A.checks(ag, p2);
              const risk = ck.find((c) => c.id === 'risk');
              const cash = ck.find((c) => c.id === 'money');
              if (risk && risk.ok === 'ok' && (!cash || cash.ok === 'ok')) {
                testPlanId = tp;
                break;
              }
            } catch (err) {}
          }
        }, () => SMD.audio.chime(true));
        const missing = ['dish', 'amp', 'recorder', 'launcher', 'capture', 'shield'].concat(isCrew ? CREW_KEYS : []).some((k) => pv[k] !== undefined && String(pv[k]) !== String(design[k])) || (pv.instruments || []).some((id) => !design.instruments.includes(id));
        setMsg(missing ? t('design.proven.partial', 'Loaded a proven design. Some of its parts need research you do not have yet, so check the requirements.') : t('design.proven.ok', 'Loaded a design that is known to work. Now make it yours.'), missing ? 'warn' : 'ok');
      });

      // Approve.
      $('[data-approve]').addEventListener('click', async () => {
        if (!pl) recompute();
        const bad = checks.filter((c) => c.ok === 'bad');
        if (bad.length && SMD.cards && SMD.cards.confirm) {
          const go = await SMD.cards.confirm(
            t('design.confirm.h', 'The board sees {n} problem(s)', { n: bad.length }),
            t('design.confirm.body', '{list}. You can still approve, but the review boards will ask about it.', { list: bad.map((c) => c.label).join(', ') }),
            { ok: t('design.confirm.ok', 'Approve anyway'), cancel: t('design.confirm.cancel', 'Keep designing') }
          );
          if (!go || destroyed) return;
        }
        const r = A.approve(ag, design, testPlanId, confidence);
        if (!r.ok) {
          SMD.audio.chime(false);
          setMsg(t('design.fail.' + r.why, r.text), 'bad');
          return;
        }
        SMD.audio.chime(true);
        SMD.game.save();
        if (SMD.bus) SMD.bus.emit('agency', ag);
        SMD.go('hq', { approvedProjectId: r.project.id });
      });

      // Source tooltips (hover or focus); clicking opens the source.
      const tip = $('[data-tipbox]');
      const showTip = (b) => {
        tip.innerHTML = `<span>${esc(b.dataset.tip)}</span>${b.dataset.url ? `<small>${t('design.src.click', 'Click to open the source')}</small>` : ''}`;
        tip.hidden = false;
        const r = b.getBoundingClientRect();
        const w = Math.min(300, window.innerWidth - 24);
        tip.style.maxWidth = w + 'px';
        const tr = tip.getBoundingClientRect();
        let x = r.left + r.width / 2 - tr.width / 2;
        x = Math.max(12, Math.min(window.innerWidth - tr.width - 12, x));
        let y = r.top - tr.height - 8;
        if (y < 8) y = r.bottom + 8;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
      };
      const hideTip = () => (tip.hidden = true);
      const onOver = (e) => {
        const b = e.target.closest && e.target.closest('.design-src');
        if (b) showTip(b);
        else if (!tip.hidden && !(e.target.closest && e.target.closest('.design-tip'))) hideTip();
      };
      const onFocus = (e) => {
        const b = e.target.closest && e.target.closest('.design-src');
        if (b) showTip(b);
        else hideTip();
      };
      const onClick = (e) => {
        const b = e.target.closest && e.target.closest('.design-src');
        if (b && b.dataset.url) window.open(b.dataset.url, '_blank', 'noopener');
      };
      app.addEventListener('pointerover', onOver);
      app.addEventListener('focusin', onFocus);
      app.addEventListener('click', onClick);
      const onScroll = () => hideTip();
      window.addEventListener('scroll', onScroll, true);

      // =====================================================================
      // Build by hand. The astronaut walks the clean room, picks a part off a
      // rack, carries it and mounts it on the spacecraft. The 3D room lives in
      // js/3d/designer.js (scene.hands); the rules live here, and every change
      // goes through change() exactly like the panel's buttons.
      // =====================================================================
      const MODE_KEY = 'ek-design-mode';
      // Footer notes from the room never hide a blocking message (busy, done, locked).
      const softMsg = (text, tone) => {
        if ($('[data-msg]').dataset.sticky !== 'block') setMsg(text, tone);
      };
      const coarse = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      const stage = $('.design-stage');
      const hud = $('[data-hud]');
      const glOk = () => {
        const E = SMD.three && SMD.three.engine;
        return !E || !E.supported || E.supported();
      };
      function startMode() {
        if (params.mode === 'hands' || params.mode === 'panel') return params.mode;
        // The demo and its pointer drive the panel's tiles.
        if (SMD.demo && SMD.demo.running) return 'panel';
        if (!glOk()) return 'panel';
        try {
          const v = SMD.store ? SMD.store.get(MODE_KEY) : localStorage.getItem(MODE_KEY);
          if (v === 'hands' || v === 'panel') return v;
        } catch (e) {}
        return window.matchMedia && window.matchMedia('(min-width: 901px) and (pointer: fine)').matches ? 'hands' : 'panel';
      }
      let mode = startMode();
      let carrying = null; // item id in the astronaut's arms
      const flying = new Set(); // ids on their way back to a rack or onto the craft
      let cardFor = null; // station id, or 'craft', whose card is open
      let handsReady = false;
      let busy = false;
      let raf = 0;
      const planetT = t('planet.' + m.dest, planetName);
      const sunPct = fmt((100 * SMD.physics.solarFlux(SMD.physics.PLANETS[m.dest].a)) / SMD.physics.solarFlux(1), 0);

      const STATION_DEFS = [
        { id: 'inst', ico: 'hires', label: t('design.h.st.inst', 'Instrument rack'), why: esc(t('design.h.st.inst.why', 'Every instrument serves a science goal. ★ marks the headline goal, the one the news will report.')) },
        { id: 'power', ico: 'arrays', label: t('design.h.st.power', 'Power bay'), why: esc(t('design.h.st.power.why', 'Sunlight at {planet} is {pct}% of what reaches Earth. Panels weigh 3.5 kg per m². An RTG works anywhere, even in the dark.', { planet: planetT, pct: sunPct })) },
        { id: 'comms', ico: 'dish', label: t('design.h.st.comms', 'Comms bench'), why: esc(t('design.h.st.comms.why', 'Data home grows with the dish area and the radio power. Both add mass, and the radio drinks power.')) },
        { id: 'brains', ico: 'avionics', label: t('design.h.st.brains', 'Recorders and computers'), why: esc(t('design.h.st.brains.why', 'The recorder stores science while Earth is out of view. A second computer takes over if the first one fails.')) },
        { id: 'shield', ico: 'shield', label: t('design.h.st.shield', 'Radiation shielding'), why: esc(m.radiation ? t('design.g.shield.why.rad', 'Jupiter’s belts fry bare electronics. Engineers want 75 kg or more.') : t('design.g.shield.why', 'Only needed where radiation is fierce, like Jupiter.')) },
        { id: 'prop', ico: 'margin', label: t('design.h.st.prop', 'Fuel and braking'), why: esc(t('design.g.margin.why', 'Spare fuel for course corrections nobody planned.')) + (m.aerobrake ? ' ' + esc(t('mission.' + m.key + '.aeroNote', m.aerobrake.note)) : '') },
        { id: 'launch', ico: 'launcher', label: t('design.h.st.launch', 'Launcher wall'), why: esc(t('design.h.st.launch.why', 'Scale models, 1:25. Bigger rockets lift more, and cost more.')) + (m.key === 'jupiter' ? ' ' + esc(t('design.g.route.why', 'Juno swung past Earth for a free boost: a cheaper launch, two more years of cruise.')) : '') },
        { id: 'tests', ico: 'tests', label: t('design.h.st.tests', 'Test plan board'), why: esc(t('design.cat.tests.lede', 'Tests find hidden flaws before launch. Flaws you miss fly with you.')) },
      ];
      // A crew flight swaps the radiation-vault pallet for the capsule bay.
      if (isCrew) STATION_DEFS.splice(STATION_DEFS.findIndex((d) => d.id === 'shield'), 1, { id: 'capsule', ico: 'heatShield', label: t('design.h.st.capsule', 'Capsule bay'), why: esc(t('design.h.st.capsule.why', 'Everything that keeps four people alive: heat shield, air and water, the abort tower, a storm shelter. Each one rides the rocket.')) });
      const stationLabel = (id) => (id === 'craft' ? design.name : (STATION_DEFS.find((s) => s.id === id) || {}).label || id);
      // Which station fixes a requirement.
      const CHECK_STATION = { science: 'inst', lift: 'launch', power: 'power', data: 'comms', risk: 'tests', window: 'launch', abort: 'capsule', shield: 'capsule', life: 'capsule', shelter: 'capsule' };

      // Every part in the room. Flight cases grow with the part's mass.
      const caseSize = (kg) => Math.max(0.24, Math.min(0.58, 0.14 + 0.09 * Math.cbrt(kg)));
      const instRank = (id) => {
        const r = relevance(m, id);
        return r ? (r.o.key ? 2 : 1) + r.q * 0.1 : 0;
      };
      const HAND_ITEMS = [];
      Object.keys(INSTRUMENTS)
        .sort((a, b) => instRank(b) - instRank(a))
        .forEach((id) => {
          const r = relevance(m, id);
          HAND_ITEMS.push({ id: 'inst:' + id, station: 'inst', group: 'inst', value: id, mass: INSTRUMENTS[id].mass, look: { shape: 'case', icon: id, star: !!(r && r.o.key), size: caseSize(INSTRUMENTS[id].mass) } });
        });
      [1, 2, 5, 10].forEach((n) => HAND_ITEMS.push({ id: 'arr:' + n, station: 'power', group: 'arrays', value: n, mass: n * CONST.arrayKgPerM2, look: { shape: 'panels', n } }));
      HAND_ITEMS.push({ id: 'rtg', station: 'power', group: 'rtg', value: 1, mass: CONST.rtg.mass, look: { shape: 'rtg' } });
      OPTIONS.dish.forEach((o) => HAND_ITEMS.push({ id: 'dish:' + o.id, station: 'comms', group: 'dish', value: o.id, mass: o.mass, look: { shape: 'dish', d: o.id } }));
      OPTIONS.amp.forEach((o) => HAND_ITEMS.push({ id: 'amp:' + o.id, station: 'comms', group: 'amp', value: o.id, mass: o.mass, look: { shape: 'case', icon: 'amp', size: 0.2 + o.mass * 0.01 } }));
      OPTIONS.recorder.forEach((o) => HAND_ITEMS.push({ id: 'recorder:' + o.id, station: 'brains', group: 'recorder', value: o.id, mass: o.mass, look: { shape: 'case', icon: 'recorder', size: 0.2 + o.mass * 0.012 } }));
      OPTIONS.avionics.forEach((o) => HAND_ITEMS.push({ id: 'avionics:' + o.id, station: 'brains', group: 'avionics', value: o.id, mass: o.mass, look: { shape: 'case', icon: 'avionics', size: caseSize(o.mass) } }));
      if (!isCrew) OPTIONS.shield.filter((o) => o.id).forEach((o) => HAND_ITEMS.push({ id: 'shield:' + o.id, station: 'shield', group: 'shield', value: o.id, mass: o.id, look: { shape: 'plate', t: 0.03 + o.id / 1200 } }));
      OPTIONS.margin.filter((v) => v).forEach((v) => HAND_ITEMS.push({ id: 'margin:' + v, station: 'prop', group: 'margin', value: v, mass: 8, look: { shape: 'tank', r: 0.2 + v * 0.0085 } }));
      if (m.aerobrake)
        [
          ['propulsive', 'burn'],
          ['aerobrake', 'aero'],
        ].forEach(([v, ic]) => HAND_ITEMS.push({ id: 'capture:' + v, station: 'prop', group: 'capture', value: v, mass: 5, look: { shape: 'case', icon: ic, size: 0.34 } }));
      // Crew-rated rockets stand on the wall only for crew missions; a mission may also name its own launchers.
      OPTIONS.launcher
        .filter((o) => (m.launchers ? m.launchers.includes(o.id) : !o.crewOnly))
        .forEach((o) => HAND_ITEMS.push({ id: 'launcher:' + o.id, station: 'launch', group: 'launcher', value: o.id, mass: 3, look: { shape: 'rocket', id: o.id } }));
      // The capsule bay, shelf by shelf: heat shields, air and water, then the abort tower and shelters.
      if (isCrew) {
        (OPTIONS.heatShield || []).forEach((o, i) => HAND_ITEMS.push({ id: 'heatShield:' + o.id, station: 'capsule', group: 'heatShield', value: o.id, mass: o.mass, look: { shape: 'heatshield', t: 0.04 + i * 0.035 } }));
        (OPTIONS.lifeDays || []).forEach((o, i) => HAND_ITEMS.push({ id: 'lifeDays:' + o.id, station: 'capsule', group: 'lifeDays', value: o.id, mass: o.mass, look: { shape: 'case', icon: 'lifeDays', size: 0.34 + i * 0.1 } }));
        (OPTIONS.abort || []).filter((o) => o.id).forEach((o) => HAND_ITEMS.push({ id: 'abort:' + o.id, station: 'capsule', group: 'abort', value: o.id, mass: o.mass, look: { shape: 'tower' } }));
        (OPTIONS.shelter || []).filter((o) => o.id).forEach((o, i) => HAND_ITEMS.push({ id: 'shelter:' + o.id, station: 'capsule', group: 'shelter', value: o.id, mass: o.mass, look: { shape: 'case', icon: 'shelter', size: 0.36 + i * 0.16 } }));
      }
      const ITEM = Object.fromEntries(HAND_ITEMS.map((it) => [it.id, it]));
      const ICON_OF = { arrays: 'arrays', rtg: 'rtg', dish: 'dish', amp: 'amp', recorder: 'recorder', avionics: 'avionics', shield: 'shield', margin: 'margin', launcher: 'launcher', heatShield: 'heatShield', abort: 'abort', lifeDays: 'lifeDays', shelter: 'shelter' };
      const itemIcon = (it) => it.look.icon || ICON_OF[it.group] || 'craft';

      // A mission that names a single launcher (the crew flight) always flies on it.
      const fixedLauncher = m.launchers && m.launchers.length === 1 ? m.launchers[0] : null;
      function isMounted(it) {
        if (it.group === 'inst') return design.instruments.includes(it.value);
        if (it.group === 'launcher' && fixedLauncher) return it.value === fixedLauncher;
        if (it.group === 'arrays' || it.group === 'rtg') return false;
        return String(design[it.group]) === String(it.value);
      }
      function lockFor(it) {
        if (it.group === 'inst') return P.instruments.includes(it.value) ? null : it.value;
        if (it.group === 'rtg') return P.rtg ? null : 'rtg';
        if (it.group === 'arrays' || it.group === 'margin') return null;
        if (it.group === 'launcher' && m.launchers && m.launchers.includes(it.value)) return null;
        const list = P[it.group];
        if (!list || list.includes(it.value)) return null;
        return (LOCK[it.group] && LOCK[it.group][it.value]) || 'locked';
      }
      function tintFor(it) {
        if (it.group !== 'inst') return 'plain';
        const r = relevance(m, it.value);
        return r ? (r.o.key ? 'key' : 'goal') : 'off';
      }
      // 'rack' (on its shelf), 'carried' (in the arms or in the air), 'mounted' (on the spacecraft).
      function stateOf(it) {
        const inHand = carrying === it.id || flying.has(it.id);
        if (it.group === 'arrays') return 'rack'; // a stack of identical panels: there are always more
        if (it.group === 'rtg') return P.rtg && design.rtg + (inHand ? 1 : 0) >= P.rtg ? (inHand ? 'carried' : 'mounted') : 'rack';
        if (inHand) return 'carried';
        return isMounted(it) ? 'mounted' : 'rack';
      }
      function applyAdd(it, d) {
        if (it.group === 'inst') {
          if (!d.instruments.includes(it.value)) d.instruments = d.instruments.concat(it.value);
        } else if (it.group === 'arrays') d.arrays = Math.min(120, d.arrays + it.value);
        else if (it.group === 'rtg') d.rtg = Math.min(P.rtg, d.rtg + 1);
        else d[it.group] = it.value;
      }
      function removeFrom(it, d) {
        if (it.group === 'inst') d.instruments = d.instruments.filter((x) => x !== it.value);
        else if (it.group === 'arrays') d.arrays = Math.max(0, d.arrays - it.value);
        else if (it.group === 'rtg') d.rtg = Math.max(0, d.rtg - 1);
        else if (it.group === 'shield') d.shield = 0;
        else if (it.group === 'margin') d.margin = 0;
        else if (it.group === 'abort' || it.group === 'shelter') d[it.group] = 0;
      }
      const lockText = (lock) => (lock === 'locked' ? t('design.locked', 'Locked') : t('design.needs', 'Research: {name} · {n} pts', { name: techName(lock), n: techCost(lock) }));

      // Name and numbers of a part, for cards and tooltips.
      function itemInfo(it) {
        const v = it.value;
        const o = Array.isArray(OPTIONS[it.group]) ? OPTIONS[it.group].find((x) => x.id === v) : null;
        switch (it.group) {
          case 'inst': {
            const x = INSTRUMENTS[v];
            return { name: t('inst.' + v, x.name), nums: `${x.mass} kg · ${x.power} W · ${money(x.cost)}`, blurb: t('inst.' + v + '.blurb', x.blurb) };
          }
          case 'arrays': {
            const kg = v * CONST.arrayKgPerM2 * (design.panelMass || 1);
            const perM2 = pl && design.arrays ? pl.base.arrayW / design.arrays : SMD.physics.solarFlux(SMD.physics.PLANETS[m.dest].a) * CONST.cellEff * m.arrayFactor * (design.cellBoost || 1);
            return { name: t('design.h.panels', 'Solar panels, {n} m²', { n: v }), nums: t('design.h.panels.n', '{kg} kg · {w} W at {planet}', { kg: fmt(kg), w: fmt(perM2 * v), planet: planetT }) };
          }
          case 'rtg':
            return { name: t('design.rtg', 'Nuclear battery (RTG)'), nums: `${CONST.rtg.mass} kg · ${CONST.rtg.watts} W · ${money(CONST.rtg.cost)}`, blurb: t('design.h.rtg.blurb', 'Heat from plutonium makes electricity anywhere, even far from the Sun.') };
          case 'dish':
            return { name: t('design.opt.dish', '{n} m dish', { n: v }), nums: `${o.mass} kg · ${money(o.cost)}` };
          case 'amp':
            return { name: t('design.opt.amp', '{n} W radio', { n: v }), nums: `${o.mass} kg · ${t('design.opt.draw', '{n} W draw', { n: o.dcW })}` };
          case 'recorder':
            return { name: v >= 1024 ? t('design.h.rec.tbit', '1 Tbit recorder') : t('design.h.rec.gbit', '{n} Gbit recorder', { n: v }), nums: `${o.mass} kg · ${money(o.cost)}` };
          case 'avionics':
            return { name: v === 'dual' ? t('design.opt.dual', 'Two computers') : t('design.opt.single', 'One computer'), nums: `${o.mass} kg · ${money(o.cost)}` };
          case 'shield':
            return { name: t('design.opt.vault', '{n} kg vault', { n: v }), nums: `${v} kg · ${money(o.cost)}` };
          case 'margin': {
            let nums = t('design.opt.spare', 'spare fuel');
            const L = pl && pl.launch;
            if (L) {
              const w = M.wetFor(pl.base.dryNoProp, L.dvTotal, v);
              if (Number.isFinite(w.wet)) nums = t('design.h.margin.n', '{kg} kg of propellant in all', { kg: fmt(w.prop) });
            }
            return { name: t('design.h.margin', 'Spare fuel, +{n}%', { n: v }), nums };
          }
          case 'capture':
            return v === 'aerobrake'
              ? { name: t('design.opt.aero', 'Aerobraking'), nums: `${t('design.opt.aero.n1', 'saves fuel')} · ${t('design.opt.days', '{n} days', { n: m.aerobrake.days })}` }
              : { name: t('design.opt.burn', 'Engine burn'), nums: `${t('design.opt.burn.n1', 'heavy on fuel')} · ${t('design.opt.burn.n2', 'quick')}` };
          case 'heatShield':
          case 'lifeDays':
          case 'abort':
          case 'shelter':
            return { name: t('data.opt.' + it.group + '.' + v, o.name), nums: `${fmt(o.mass)} kg · ${money(o.cost)}`, blurb: t('data.crewPart.' + it.group + '.why', ((SMD.data.CREW_PARTS || []).find((g) => g.key === it.group) || {}).why || '') };
          case 'launcher': {
            const L = pl && pl.launch;
            const cap = L ? M.launcherCapacity(v, L.launch.c3, L.launch.leo) : 0;
            return { name: t('design.opt.launcher.' + v, o.name), nums: `${cap ? t('design.dyn.lift', 'lifts {n} kg', { n: fmt(cap) }) + ' · ' : ''}${money(o.cost)}` };
          }
        }
        return { name: it.id, nums: '' };
      }
      function relTag(id) {
        const r = relevance(m, id);
        return r
          ? r.o.key
            ? `<span class="design-tag is-key">${t('design.tag.key', 'Headline goal')}</span>`
            : `<span class="design-tag">${t('design.tag.goal', 'Helps: {goal}', { goal: esc(t('mission.' + missionKey + '.obj.' + r.o.id, r.o.label)) })}</span>`
          : `<span class="design-tag is-none">${t('design.tag.none', 'No goal here')}</span>`;
      }

      // ----- Keeping the room in step with the design -----
      function refreshHands() {
        if (!handsReady || !scene) return;
        scene.hands.update(HAND_ITEMS.map((it) => ({ id: it.id, state: stateOf(it), locked: !!lockFor(it), tint: tintFor(it) })));
        if (cardFor) renderCard();
        renderCarry();
        renderPrompt();
      }

      // ----- Cards -----
      function tileHTML(it) {
        const info = itemInfo(it);
        const lock = lockFor(it);
        const st = stateOf(it);
        const badge = lock
          ? lockNote(lock)
          : st === 'mounted'
          ? `<span class="design-hbadge is-on">${t('design.h.on', 'On the spacecraft')}</span>`
          : st === 'carried'
          ? `<span class="design-hbadge is-hand">${t('design.h.inhand', 'In your hands')}</span>`
          : '';
        return `<button type="button" class="design-htile${st !== 'rack' ? ' is-' + st : ''}" data-hitem="${esc(it.id)}"${lock || st === 'mounted' ? ' aria-disabled="true"' : ''}>
            <span class="design-tile-ico">${icon(itemIcon(it))}</span>
            <span class="design-htile-main"><span class="design-tile-name">${esc(info.name)}</span><span class="design-htile-nums num">${esc(info.nums)}</span>${it.group === 'inst' ? relTag(it.value) : ''}${badge}</span>
          </button>`;
      }
      function paperHTML(id) {
        const radio = (field, value, on, label, sub, lock) =>
          `<button type="button" class="design-hpaper-opt" role="radio" aria-checked="${on}" data-hpaper="${field}" data-value="${esc(String(value))}"${lock ? ' aria-disabled="true"' : ''}><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}${lock ? lockNote(lock) : ''}</button>`;
        const box = (title, inner) => `<div class="design-hpaper"><h4>${icon('paper')}<span>${title}</span></h4><div class="design-hpaper-opts" role="radiogroup" aria-label="${esc(title)}">${inner}</div></div>`;
        if (id === 'comms') {
          const rate = avgRate();
          return box(
            t('design.g.ground', 'Antenna time on Earth'),
            OPTIONS.ground
              .map((o) => radio('ground', o.id, design.ground === o.id, t('design.opt.ground', '{n} h a day', { n: o.id }), [t('design.opt.peryear', '{m} a year', { m: money(o.costPerYear) }), rate ? t('design.dyn.gbit', '{n} Gbit a day', { n: fmt((rate * o.id * 3600) / 1000, rate * o.id * 3.6 < 10 ? 1 : 0) }) : ''].filter(Boolean).join(' · ')))
              .join('')
          );
        }
        if (id === 'tests') {
          return box(
            t('design.cat.tests', 'Testing plan'),
            TEST_PLANS.map((tp) => {
              const cost = tp.tests.reduce((s2, x) => s2 + TESTS.find((y) => y.id === x).cost, 0);
              const months = tp.tests.reduce((s2, x) => s2 + TESTS.find((y) => y.id === x).months, 0);
              return radio('test', tp.id, tp.id === testPlanId, esc(t('tests.' + tp.id, tp.name)), `${money(cost)} · ${t('design.months', '{n} months', { n: fmt(months, months % 1 ? 1 : 0) })} · ${esc(t('tests.' + tp.id + '.blurb', tp.blurb))}`);
            }).join('')
          );
        }
        if (id === 'capsule' && OPTIONS.entry) {
          return box(
            t('data.crewPart.entry.title', 'Way home through the air'),
            OPTIONS.entry.map((o) => radio('entry', o.id, String(design.entry) === String(o.id), esc(t('data.opt.entry.' + o.id, o.name)), '')).join('')
          );
        }
        if (id === 'launch' && m.key === 'jupiter') {
          return box(
            t('design.g.route', 'Route'),
            radio('route', 'ega', design.route === 'ega', t('design.opt.ega', 'Earth flyby boost'), `${t('design.opt.ega.n1', '+2 years')} · ${t('design.opt.ega.n2', 'small rocket')}`) +
              radio('route', 'direct', design.route === 'direct', t('design.opt.direct', 'Straight there'), `${t('design.opt.direct.n1', 'fast')} · ${t('design.opt.direct.n2', 'heavy rocket')}`, P.launcher.includes('heavy') ? null : 'heavy')
          );
        }
        return '';
      }
      function stationCard(id) {
        const def = STATION_DEFS.find((s) => s.id === id);
        const list = HAND_ITEMS.filter((it) => it.station === id);
        const paper = paperHTML(id);
        return `<header class="design-hcard-h"><span class="design-tile-ico">${icon(def.ico)}</span><div><h3 id="design-hcard-t">${esc(def.label)}</h3><p>${def.why}</p></div><button type="button" class="design-hcard-x" data-hclose aria-label="${esc(t('design.h.close', 'Close'))}">×</button></header>
          <div class="design-hcard-body">${list.length ? `<div class="design-htiles">${list.map(tileHTML).join('')}</div>` : ''}${paper}</div>
          <div class="design-hpv" data-hpv aria-live="polite" hidden></div>
          <p class="design-hcard-foot">${list.length ? t('design.h.card.foot', 'Pick a part up, then carry it to the spacecraft.') : t('design.h.card.paper', 'Paperwork, not hardware: it changes the plan at once.')}</p>`;
      }
      function craftCard() {
        const row = (ico, hl, name, sub, acts) => `<li class="design-hrow" data-hl="${esc(hl)}"><span class="design-tile-ico">${icon(ico)}</span><span class="design-hrow-main"><b>${esc(name)}</b><small class="num">${esc(sub)}</small></span><span class="design-hrow-acts">${acts}</span></li>`;
        const off = (id, label) => `<button type="button" class="btn small" data-hoff="${esc(id)}">${esc(label || t('design.h.off', 'Take off'))}</button>`;
        const go = (st) => `<button type="button" class="btn small ghost" data-hgo="${st}">${esc(t('design.h.swap', 'Swap at: {where}', { where: stationLabel(st) }))}</button>`;
        const rows = [];
        design.instruments.forEach((id) => rows.push(row(id, id, t('inst.' + id, INSTRUMENTS[id].name), `${INSTRUMENTS[id].mass} kg · ${INSTRUMENTS[id].power} W`, off('inst:' + id))));
        if (design.arrays > 0)
          rows.push(
            row(
              'arrays',
              'arrays',
              t('design.h.panels.on', 'Solar panels: {n} m²', { n: fmt(design.arrays) }),
              `${fmt(design.arrays * CONST.arrayKgPerM2 * (design.panelMass || 1))} kg · ${fmt(pl ? pl.base.arrayW : 0)} W`,
              [1, 2, 5, 10]
                .filter((n) => n <= design.arrays)
                .map((n) => off('arr:' + n, `−${n} m²`))
                .join('')
            )
          );
        if (design.rtg) rows.push(row('rtg', 'rtg', t('design.h.rtg.on', 'RTG × {n}', { n: design.rtg }), `${design.rtg * CONST.rtg.mass} kg · ${design.rtg * CONST.rtg.watts} W`, off('rtg')));
        if (isCrew && design.abort && ITEM['abort:' + design.abort]) rows.push(row('abort', 'las', itemInfo(ITEM['abort:' + design.abort]).name, itemInfo(ITEM['abort:' + design.abort]).nums, off('abort:' + design.abort)));
        if (isCrew && design.shelter && ITEM['shelter:' + design.shelter]) rows.push(row('shelter', 'capsule', itemInfo(ITEM['shelter:' + design.shelter]).name, itemInfo(ITEM['shelter:' + design.shelter]).nums, off('shelter:' + design.shelter)));
        if (design.shield && !isCrew) rows.push(row('shield', 'vault', t('design.opt.vault', '{n} kg vault', { n: design.shield }), `${design.shield} kg`, off('shield:' + design.shield)));
        if (design.margin && ITEM['margin:' + design.margin]) rows.push(row('margin', 'tank', t('design.h.margin', 'Spare fuel, +{n}%', { n: design.margin }), itemInfo(ITEM['margin:' + design.margin]).nums, off('margin:' + design.margin)));
        const swap = [
          ['dish:' + design.dish, 'dish', 'comms'],
          ['amp:' + design.amp, 'dish', 'comms'],
          ['recorder:' + design.recorder, 'bus', 'brains'],
          ['avionics:' + design.avionics, 'bus', 'brains'],
          ['launcher:' + (fixedLauncher || design.launcher), '', 'launch'],
        ];
        if (m.aerobrake) swap.push(['capture:' + design.capture, 'tank', 'prop']);
        if (isCrew) swap.unshift(['heatShield:' + design.heatShield, 'heatshield', 'capsule'], ['lifeDays:' + design.lifeDays, 'capsule', 'capsule']);
        swap.forEach(([id, hl, st]) => {
          const it = ITEM[id];
          if (!it) return;
          const info = itemInfo(it);
          rows.push(row(itemIcon(it), hl, info.name, info.nums, go(st)));
        });
        return `<header class="design-hcard-h"><span class="design-tile-ico">${icon('craft')}</span><div><h3 id="design-hcard-t">${esc(design.name)}</h3><p>${esc(t('design.h.craft.why', 'Everything mounted on your spacecraft. Taking a part off saves mass and money, and may cost science.'))}</p></div><button type="button" class="design-hcard-x" data-hclose aria-label="${esc(t('design.h.close', 'Close'))}">×</button></header>
          <div class="design-hcard-body">${design.instruments.length ? '' : `<p class="design-note is-warn">${esc(t('design.h.craft.noinst', 'No instruments yet: this spacecraft cannot do any science.'))}</p>`}<ul class="design-hlist">${rows.join('')}</ul></div>
          <div class="design-hpv" data-hpv aria-live="polite" hidden></div>`;
      }
      function renderCard() {
        const box = $('[data-hcard]');
        if (!cardFor) return;
        const focused = document.activeElement && box.contains(document.activeElement) ? document.activeElement : null;
        let sel = null;
        if (focused) {
          for (const a of ['data-hitem', 'data-hoff', 'data-hpaper', 'data-hgo']) {
            if (!focused.hasAttribute(a)) continue;
            sel = `[${a}="${focused.getAttribute(a)}"]` + (a === 'data-hpaper' ? `[data-value="${focused.dataset.value}"]` : '');
            break;
          }
        }
        const oldBody = box.querySelector('.design-hcard-body');
        const scroll = oldBody ? oldBody.scrollTop : 0;
        box.innerHTML = cardFor === 'craft' ? craftCard() : stationCard(cardFor);
        const body = box.querySelector('.design-hcard-body');
        if (body) body.scrollTop = scroll;
        if (sel) {
          const el = box.querySelector(sel);
          if (el) el.focus({ preventScroll: true });
        }
      }
      function openCard(id, focusId) {
        if (mode !== 'hands') return;
        const box = $('[data-hcard]');
        const again = cardFor === id;
        cardFor = id;
        renderCard();
        box.hidden = false;
        stage.classList.add('is-hcard');
        hideHTip();
        renderPrompt();
        const f = (focusId && box.querySelector(`[data-hitem="${focusId}"]`)) || box.querySelector('[data-hitem]:not([aria-disabled="true"]), [data-hoff], [data-hpaper]:not([aria-disabled="true"]), [data-hgo]');
        if (f) f.focus({ preventScroll: true });
        if (focusId && f && f.dataset.hitem === focusId) showCardPreview(f);
        cardInset();
        if (!again) SMD.audio.beep(560, 0.05, 'sine', 0.08);
      }
      function closeCard() {
        if (!cardFor) return;
        const box = $('[data-hcard]');
        if (box.contains(document.activeElement)) document.activeElement.blur();
        cardFor = null;
        box.hidden = true;
        box.innerHTML = '';
        stage.classList.remove('is-hcard');
        if (scene) scene.highlightPart(null);
        cardInset();
        renderPrompt();
      }
      // A docked card covers part of the room: shift the view so the room stays centred.
      function cardInset() {
        if (!scene || !scene.setInsets) return;
        const box = $('[data-hcard]');
        const wide = stage.clientWidth >= 700;
        const w = cardFor && wide ? box.offsetWidth + 14 : 0;
        const rtl = SMD.dir() === 'rtl';
        scene.setInsets({ right: rtl ? 0 : w, left: rtl ? w : 0 });
      }
      function showCardPreview(el) {
        const pv = $('[data-hpv]');
        if (!pv) return;
        let html = '';
        if (el && el.dataset.hitem) {
          const it = ITEM[el.dataset.hitem];
          const lock = lockFor(it);
          const st = stateOf(it);
          const info = itemInfo(it);
          if (lock) html = `<b>${esc(info.name)}</b><span class="design-pv-chip is-flat">${esc(lockText(lock))}</span>`;
          else if (st === 'mounted') html = `<b>${esc(info.name)}</b><span class="design-pv-chip is-flat">${esc(t('design.h.pv.on', 'Already on the spacecraft'))}</span>`;
          else html = `<b>${esc(t('design.h.pv.if', 'If you mount it:'))}</b>${deltaChips((d) => applyAdd(it, d))}${info.blurb ? `<span class="design-hpv-blurb">${esc(info.blurb)}</span>` : ''}`;
        } else if (el && el.dataset.hpaper && el.getAttribute('aria-disabled') !== 'true') {
          const f = el.dataset.hpaper;
          const v = el.dataset.value;
          const same = f === 'test' ? v === testPlanId : String(design[f]) === v;
          if (!same) html = `<b>${esc(t('design.h.pv.paper', 'If you pick it:'))}</b>${f === 'test' ? deltaChips(null, v) : deltaChips((d) => (d[f] = f === 'ground' ? Number(v) : v))}`;
        } else if (el && el.dataset.hoff) {
          const it = ITEM[el.dataset.hoff];
          if (it) html = `<b>${esc(t('design.h.pv.off', 'If you take it off:'))}</b>${deltaChips((d) => removeFrom(it, d))}`;
        }
        pv.innerHTML = html;
        pv.hidden = !html;
      }

      // ----- The floating card over the astronaut, and the action prompt -----
      function renderCarry() {
        const box = $('[data-hcarry]');
        const on = !!(carrying && mode === 'hands' && scene && scene.view !== 'compare');
        stage.classList.toggle('is-carrying', on);
        if (!on) {
          box.hidden = true;
          return;
        }
        const it = ITEM[carrying];
        const info = itemInfo(it);
        const atCraft = scene.hands.near === 'craft';
        box.innerHTML = `<p class="design-hcarry-h"><span class="design-tile-ico">${icon(itemIcon(it))}</span><span><small>${t('design.h.carry', 'In your hands')}</small><b>${esc(info.name)}</b><small class="num">${esc(info.nums)}</small></span></p>
          <p class="design-hcarry-if">${t('design.h.pv.if', 'If you mount it:')}</p>
          <div class="design-hcarry-chips">${deltaChips((d) => applyAdd(it, d))}</div>
          <div class="design-hcarry-acts"><button type="button" class="btn small primary" data-hmount>${atCraft ? t('design.h.mount', 'Mount it') : t('design.h.mountgo', 'Take it to the spacecraft')}</button><button type="button" class="btn small ghost" data-hback>${t('design.h.back', 'Put it back')}</button></div>`;
        box.hidden = false;
        if (!raf) raf = requestAnimationFrame(follow);
      }
      function follow() {
        raf = 0;
        const box = $('[data-hcarry]');
        if (destroyed || box.hidden || !scene) return;
        raf = requestAnimationFrame(follow);
        const sw = stage.clientWidth;
        const sh = stage.clientHeight;
        if (sw < 700) {
          box.style.transform = '';
          return;
        }
        const p = scene.hands.headScreen();
        const bw = box.offsetWidth;
        const bh = box.offsetHeight;
        const card = cardFor ? $('[data-hcard]').offsetWidth + 24 : 0;
        const rtl = SMD.dir() === 'rtl';
        const lo = 10 + (rtl ? card : 0);
        const hi = sw - bw - 10 - (rtl ? 0 : card);
        // Beside the astronaut (not over it), so the part in its arms and the
        // rack behind it stay in view. Flip sides when there is no room.
        const gap = p.half + 18;
        let side = rtl ? -1 : 1;
        if (side > 0 && p.x + gap + bw > hi + bw) side = -1;
        else if (side < 0 && p.x - gap - bw < lo) side = 1;
        const x = Math.max(lo, Math.min(hi, side > 0 ? p.x + gap : p.x - gap - bw));
        let y = Math.max(10, Math.min(sh - bh - 74, (p.y + p.feetY) / 2 - bh / 2));
        box.dataset.side = side > 0 ? 'r' : 'l';
        // Stay clear of the launch-mass card in the top corner.
        const mr = $('[data-mass]').getBoundingClientRect();
        const sr = stage.getBoundingClientRect();
        if (y < mr.bottom - sr.top + 8 && x < mr.right - sr.left && x + bw > mr.left - sr.left) y = mr.bottom - sr.top + 8;
        box.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
      // The "E  Open: rack" prompt is the character controller's (it floats
      // over the rack, or is the big button on touch screens); this gives it
      // the words. The old prompt button stays hidden.
      function promptFor(near) {
        if (mode !== 'hands' || !handsReady || !scene || cardFor || scene.view === 'compare' || busy) return '';
        if (carrying) {
          const name = itemInfo(ITEM[carrying]).name;
          if (near === 'craft') return t('design.h.p.mount', 'Mount {what}', { what: name });
          if (near === ITEM[carrying].station) return t('design.h.p.back', 'Put {what} back', { what: name });
          return '';
        }
        if (near === 'craft') return t('design.h.p.craft', 'See what is on the spacecraft');
        if (near) return t('design.h.p.open', 'Open: {what}', { what: stationLabel(near) });
        return '';
      }
      function renderPrompt() {
        $('[data-hprompt]').hidden = true;
        if (!scene || !scene.hands || !scene.hands.setCard) return;
        scene.hands.setCard(!!cardFor);
        scene.hands.refreshPrompt();
      }
      function renderHint() {
        const el = $('[data-hint]');
        el.textContent =
          mode === 'hands'
            ? coarse()
              ? t('design.h.hint.touch2', 'Left thumb: walk · right side: look · tap a rack, then the spacecraft')
              : t('design.h.hint2', 'W A S D: walk (Shift runs) · mouse: look · E: use · Q: put down · H: controls')
            : t('design.hint2', 'Drag to look around · you are 1.75 m tall');
      }

      // ----- Tooltips over the 3D room -----
      function hideHTip() {
        $('[data-htip]').hidden = true;
      }
      function partName(key) {
        if (INSTRUMENTS[key]) return t('inst.' + key, INSTRUMENTS[key].name);
        if (key.startsWith('array')) return t('design.arrays', 'Solar panels');
        if (key.startsWith('rtg')) return t('design.rtg', 'Nuclear battery (RTG)');
        if (key === 'dish') return t('design.g.dish', 'High-gain dish');
        if (key === 'vault') return t('design.g.shield', 'Radiation vault');
        if (key === 'tank') return t('design.h.tank', 'Propellant tank');
        if (key.startsWith('wing')) return t('design.arrays', 'Solar panels');
        if (key === 'capsule') return t('design.h.capsule', 'Crew capsule');
        if (key === 'heatshield') return t('data.crewPart.heatShield.title', 'Heat shield');
        if (key === 'las') return t('data.crewPart.abort.title', 'Launch abort system');
        if (key === 'sm') return t('design.h.sm', 'Service module');
        return t('design.h.bus', 'Spacecraft body');
      }
      function partItem(key) {
        if (INSTRUMENTS[key]) return 'inst:' + key;
        if (key.startsWith('rtg')) return 'rtg';
        if (key === 'vault' && design.shield) return 'shield:' + design.shield;
        if (key === 'las' && design.abort) return 'abort:' + design.abort;
        return null;
      }
      function showHTip(e) {
        const tip = $('[data-htip]');
        const T = e.target;
        if (!T) return hideHTip();
        let head = '';
        let sub = '';
        if (T.kind === 'item') {
          const it = ITEM[T.id];
          if (!it) return hideHTip();
          const info = itemInfo(it);
          const lock = lockFor(it);
          head = info.name;
          sub = [info.nums, lock ? lockText(lock) : carrying === it.id ? t('design.h.inhand', 'In your hands') : t('design.h.tip.pick', 'Click to pick it up')].join(' · ');
        } else if (T.kind === 'station') {
          head = stationLabel(T.id);
          sub = t('design.h.tip.station', 'Click to walk there');
        } else if (carrying) {
          head = design.name;
          sub = t('design.h.tip.mount', 'Click to mount {what}', { what: itemInfo(ITEM[carrying]).name });
        } else if (T.kind === 'part') {
          head = partName(T.key);
          sub = partItem(T.key) ? t('design.h.tip.off', 'Click to take it off') : t('design.h.swap', 'Swap at: {where}', { where: stationLabel(T.station) });
        } else {
          head = design.name;
          sub = t('design.h.tip.craft', 'Click to see what is mounted');
        }
        tip.innerHTML = `<b>${esc(head)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
        tip.hidden = false;
        const sw = stage.clientWidth;
        const bw = tip.offsetWidth;
        const x = Math.max(8, Math.min(sw - bw - 8, e.x + 16));
        tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(e.y + 18)}px)`;
      }

      // ----- What the player does -----
      function startCarry(id) {
        carrying = id;
        scene.hands.carry(id, { mass: ITEM[id].mass });
        refreshHands();
      }
      function returnCarried(quiet) {
        if (!carrying || !scene) return;
        const id = carrying;
        carrying = null;
        flying.add(id);
        scene.hands.returnFx(() => {
          flying.delete(id);
          if (!destroyed) refreshHands();
        });
        if (!quiet) {
          SMD.audio.beep(480, 0.07, 'triangle', 0.1);
          softMsg(t('design.h.backon', '{what} is back on its rack.', { what: itemInfo(ITEM[id]).name }), null);
        }
        refreshHands();
      }
      function pick(id) {
        const it = ITEM[id];
        if (!it || busy || mode !== 'hands' || !scene) return;
        const lock = lockFor(it);
        const info = itemInfo(it);
        if (lock) {
          SMD.audio.beep(220, 0.08, 'square', 0.05);
          scene.hands.react('nope');
          softMsg(t('design.h.locked', '{what} is locked. {how}', { what: info.name, how: lockText(lock) }), 'warn');
          return;
        }
        if (carrying === id) return closeCard();
        if (stateOf(it) === 'mounted') {
          softMsg(it.group === 'rtg' ? t('design.h.rtg.all', 'All {n} RTGs are already on the spacecraft.', { n: P.rtg }) : t('design.h.already', '{what} is already on the spacecraft.', { what: info.name }), 'warn');
          return;
        }
        if (carrying) returnCarried(true);
        startCarry(id);
        closeCard();
        softMsg('', null);
        SMD.audio.beep(660, 0.06, 'triangle', 0.12);
        later(() => SMD.audio.beep(880, 0.05, 'triangle', 0.08), 60);
      }
      function mount() {
        if (!carrying || busy || !scene) return;
        const it = ITEM[carrying];
        const info = itemInfo(it);
        if (it.group === 'arrays' && design.arrays >= 120) return softMsg(t('design.h.full', 'The solar wings are full: 120 m² is the most this spacecraft can carry.'), 'warn');
        if (it.group === 'rtg' && design.rtg >= P.rtg) return softMsg(t('design.h.rtg.all', 'All {n} RTGs are already on the spacecraft.', { n: P.rtg }), 'warn');
        if (it.group !== 'arrays' && it.group !== 'rtg' && isMounted(it)) return returnCarried();
        busy = true;
        const id = carrying;
        carrying = null;
        flying.add(id);
        closeCard();
        hideHTip();
        renderCarry();
        renderPrompt();
        scene.hands.placeFx(() => {
          busy = false;
          flying.delete(id);
          if (destroyed) return;
          change(() => applyAdd(it, design), () => SMD.audio.beep(760, 0.07, 'triangle', 0.12));
          softMsg(t('design.h.mounted', '{what} is on. Watch the launch mass and the requirements.', { what: info.name }), 'ok');
        });
      }
      function takeOff(id) {
        const it = ITEM[id];
        if (!it || busy || !scene) return;
        if (carrying) returnCarried(true);
        const name = itemInfo(it).name;
        change(() => removeFrom(it, design), () => SMD.audio.beep(420, 0.07, 'triangle', 0.12));
        closeCard();
        startCarry(id);
        softMsg(t('design.h.took', 'You took off {what}. Carry it back to its rack, or mount it again.', { what: name }), null);
      }
      function goStation(id, then) {
        if (!scene || mode !== 'hands' || !handsReady) return;
        scene.hands.walkTo(id, () => {
          if (destroyed || mode !== 'hands') return;
          if (then) return then();
          if (id === 'craft') return carrying ? mount() : openCard('craft');
          if (carrying && ITEM[carrying].station === id) returnCarried();
          openCard(id);
        });
      }
      function interact() {
        if (!handsReady || busy || mode !== 'hands' || !scene || scene.view === 'compare') return;
        const near = scene.hands.near;
        if (cardFor && cardFor === near) return closeCard();
        if (near === 'craft') return carrying ? mount() : openCard('craft');
        if (near) {
          if (carrying && ITEM[carrying].station === near) returnCarried();
          return openCard(near);
        }
        if (carrying) return goStation('craft');
        softMsg(t('design.h.walkup', 'Walk up to a rack or to the spacecraft, then press E.'), null);
      }
      function clickTarget(T) {
        if (busy || !T) return;
        if (T.kind === 'item') {
          const it = ITEM[T.id];
          if (!it) return;
          if (carrying === T.id) return goStation(it.station);
          return goStation(it.station, () => (lockFor(it) || stateOf(it) === 'mounted' ? openCard(it.station, T.id) : pick(T.id)));
        }
        if (T.kind === 'station') return goStation(T.id);
        goStation('craft', () => {
          if (carrying) return mount();
          const off = T.kind === 'part' && partItem(T.key);
          if (off) return takeOff(off);
          openCard('craft');
        });
      }
      function onHand(e) {
        if (destroyed) return;
        switch (e.type) {
          case 'near':
            if (cardFor && cardFor !== e.id) closeCard();
            renderPrompt();
            if (carrying) renderCarry();
            break;
          case 'interact':
            interact();
            break;
          case 'drop':
            if (carrying) returnCarried();
            break;
          case 'back':
            // Q / gamepad B: close the card, else put the part back.
            if (cardFor) closeCard();
            else if (carrying) returnCarried();
            break;
          case 'click':
            hideHTip();
            clickTarget(e.target);
            break;
          case 'walk':
            closeCard();
            break;
          case 'hover':
            showHTip(e);
            break;
        }
      }

      // ----- Switching between the hands and the panel -----
      function setMode(next, save) {
        mode = next === 'hands' && glOk() ? 'hands' : 'panel';
        app.querySelector('.design').classList.toggle('is-hands', mode === 'hands');
        $$('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
        if (save) {
          try {
            if (SMD.store) SMD.store.set(MODE_KEY, mode);
            else localStorage.setItem(MODE_KEY, mode);
          } catch (e) {}
        }
        if (mode !== 'hands') {
          closeCard();
          carrying = null;
          flying.clear();
          busy = false;
          hideHTip();
          if (scene) scene.highlightPart(null);
        }
        hud.hidden = mode !== 'hands';
        if (scene && handsReady) scene.hands.setOn(mode === 'hands');
        renderHint();
        renderPrompt();
        renderCarry();
        if (pl) renderGuide();
        later(updateInsets, 60);
      }
      $('[data-modeseg]').hidden = !glOk();
      $('[data-modeseg]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-mode]');
        if (!b || b.dataset.mode === mode) return;
        SMD.audio.beep(b.dataset.mode === 'hands' ? 700 : 520, 0.06, 'triangle', 0.1);
        setMode(b.dataset.mode, true);
      });

      // HUD clicks and keyboard.
      hud.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || !hud.contains(b)) return;
        if (b.hasAttribute('data-hprompt')) return interact();
        if (b.hasAttribute('data-hclose')) return closeCard();
        if (b.hasAttribute('data-hmount')) return scene && scene.hands.near === 'craft' ? mount() : goStation('craft');
        if (b.hasAttribute('data-hback')) return returnCarried();
        if (b.dataset.hitem) {
          if (b.getAttribute('aria-disabled') === 'true' && !lockFor(ITEM[b.dataset.hitem])) return nope(b);
          return pick(b.dataset.hitem);
        }
        if (b.dataset.hoff) return takeOff(b.dataset.hoff);
        if (b.dataset.hgo) {
          closeCard();
          return goStation(b.dataset.hgo);
        }
        if (b.dataset.hpaper) {
          if (b.getAttribute('aria-disabled') === 'true') return nope(b);
          const f = b.dataset.hpaper;
          const v = b.dataset.value;
          if (f === 'test') {
            if (v === testPlanId) return;
            change(() => (testPlanId = v), () => SMD.audio.beep(600, 0.06, 'triangle', 0.1));
          } else {
            const val = CREW_KEYS.includes(f) ? crewValue(f, v) : typeof design[f] === 'number' ? Number(v) : v;
            if (design[f] === val) return;
            change(() => (design[f] = val), () => SMD.audio.beep(620, 0.06, 'triangle', 0.1));
          }
          later(() => showCardPreview(null), 0);
        }
      });
      const cardHover = (e) => {
        const el = e.target.closest && e.target.closest('[data-hitem], [data-hpaper], [data-hoff]');
        if (el || e.type === 'focusin') showCardPreview(el);
        const row = e.target.closest && e.target.closest('.design-hrow');
        if (scene) scene.highlightPart(row && row.dataset.hl ? row.dataset.hl : null);
      };
      $('[data-hcard]').addEventListener('pointerover', cardHover);
      $('[data-hcard]').addEventListener('focusin', cardHover);
      $('[data-hcard]').addEventListener('pointerleave', () => scene && scene.highlightPart(null));
      const onKeyHands = (e) => {
        if (mode !== 'hands' || destroyed) return;
        if (e.key === 'Escape' && cardFor) {
          e.preventDefault();
          closeCard();
          return;
        }
        // Arrow keys move between the buttons of an open card.
        const box = $('[data-hcard]');
        if (cardFor && box.contains(e.target) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          const all = [...box.querySelectorAll('button:not([data-hclose])')];
          const i = all.indexOf(e.target);
          if (i < 0) return;
          const rtl = SMD.dir() === 'rtl';
          const fwd = e.key === 'ArrowDown' || (e.key === 'ArrowRight') !== rtl;
          all[(i + (fwd ? 1 : all.length - 1)) % all.length].focus();
          e.preventDefault();
        }
      };
      window.addEventListener('keydown', onKeyHands);

      function setupHands() {
        if (!scene || !scene.hands) return;
        scene.hands.setCatalog({
          stations: STATION_DEFS.map((s) => ({ id: s.id, label: s.label })),
          items: HAND_ITEMS.map((it) => ({ id: it.id, station: it.station, group: it.group, look: it.look, tint: tintFor(it) })),
          icons: ICON,
        });
        if (scene.hands.setPrompt) scene.hands.setPrompt(promptFor);
        handsReady = true;
        scene.hands.setOn(mode === 'hands');
        refreshHands();
        if (pl) renderGuide();
      }
      // For scripts, tests and the demo: drive the hands without a mouse.
      ui.screens.design.hands = {
        get mode() {
          return mode;
        },
        setMode: (v) => setMode(v, false),
        get carrying() {
          return carrying;
        },
        get near() {
          return scene && scene.hands ? scene.hands.near : null;
        },
        get card() {
          return cardFor;
        },
        get ready() {
          return handsReady;
        },
        get busy() {
          return busy;
        },
        get design() {
          return design;
        },
        items: () => HAND_ITEMS.map((it) => ({ id: it.id, station: it.station, state: stateOf(it), locked: !!lockFor(it) })),
        goStation,
        clickItem: (id) => clickTarget({ kind: 'item', id }),
        clickPart: (key) => clickTarget({ kind: 'part', key }),
        pick,
        mount,
        takeOff,
        interact,
        putBack: () => returnCarried(),
        openCard,
        closeCard,
      };

      refreshTray();
      setMode(mode, false);
      recompute();
      start3D();

      return () => {
        destroyed = true;
        insetRO.disconnect();
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKeyHands);
        tweens.forEach((id) => cancelAnimationFrame(id));
        clearTimeout(timer);
        timers.forEach((id) => clearTimeout(id));
        app.removeEventListener('pointerover', onOver);
        app.removeEventListener('focusin', onFocus);
        app.removeEventListener('click', onClick);
        window.removeEventListener('scroll', onScroll, true);
        if (scene && SMD.three) SMD.three.engine.stop();
        scene = null;
      };
    },
  };
})();
