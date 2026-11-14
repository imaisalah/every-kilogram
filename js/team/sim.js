// Mission Sprint model: SMD.team.sim (docs/TEAM.md). Pure logic, no DOM, loads
// in node like js/model.js. All numbers come from js/team/data.js.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  if (typeof module === 'object' && module.exports && !(SMD.team && SMD.team.data)) require('./data.js');
  SMD.team = SMD.team || {};
  const TD = SMD.team.data;
  const P = SMD.physics;
  const CARD = TD.CARD_STR;
  const { ROLES, KEY_ROLE, SURFACE_KEYS, GROUP_TITLES, INSTRUMENTS, COMMON, LAUNCHERS, SCENARIOS, DIFFICULTIES, FLAWS, CRISES, OPPORTUNITIES, AGENDAS, ANALOGS, SURFACE_ANALOGS, EPITAPHS, STR, SCAN_FITS, UPLINK_WINDOWS } = TD;

  // ---------- Text ----------
  function fill(text, params) {
    if (!params) return text;
    return String(text).replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
  }
  const t = (key, en, params) => (SMD.t ? SMD.t(`team.${key}`, en, params) : fill(en, params));
  const T = (key, params) => t(key, STR[key], params);
  const round = (x, n) => {
    const f = Math.pow(10, n || 0);
    return Math.round(x * f) / f;
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fmt = (x) => {
    const v = Math.round(x);
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  const sgn = (x) => (x >= 0 ? '+' : '−');

  // ---------- Deterministic randomness ----------
  function hash(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rngOf(seed) {
    let a = hash(seed) || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let z = Math.imul(a ^ (a >>> 15), 1 | a);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Catalogue ----------
  const FLIGHT_FRAMES = 420;
  const FPS = 6;
  const STEPS_PER_ORBIT = 12;
  const INSTRUMENT_MAX = { cadet: 3, engineer: 4, director: 4, sandbox: 6 };
  const RECORDER_MIN = 1;

  const scenarioOf = (id) => SCENARIOS[id];
  const difficultyOf = (id) => DIFFICULTIES.find((d) => d.id === id);

  function optionsFor(sc, key) {
    switch (key) {
      case 'orbit': return sc.orbits;
      case 'launcher': return LAUNCHERS;
      case 'route': return sc.routes;
      case 'lifetime': return sc.lifetimes.map((l) => ({ ...l, name: l.years === 1 ? '1 year' : `${l.years} years`, note: lifetimeNote(l, sc) }));
      case 'panels': return sc.panels;
      case 'instruments': return sc.instruments.map((id) => ({ id, ...INSTRUMENTS[id] }));
      default: return COMMON[key] || [];
    }
  }
  function lifetimeNote(l) {
    return l.years <= 1 ? t('card.life.short', TD.CARD_STR['card.life.short']) : t('card.life.long', TD.CARD_STR['card.life.long'], { n: l.years });
  }
  function visible(o, key, sc, diff) {
    if (!diff.tier || o.tier === undefined || o.tier <= diff.tier) return true;
    const extra = sc.cadetExtra && sc.cadetExtra[key];
    return !!(extra && extra.includes(o.id));
  }
  function allowedOptions(sc, diff, key) {
    return optionsFor(sc, key).filter((o) => visible(o, key, sc, diff));
  }
  function activeKeys(sc) {
    return Object.keys(KEY_ROLE).filter((k) => !SURFACE_KEYS.includes(k) || sc.surface);
  }
  function optionName(sc, key, o) {
    if (key === 'orbit') return t(`scn.${sc.id}.orbit.${o.id}.name`, o.name);
    if (key === 'route') return t(`scn.${sc.id}.route.${o.id}.name`, o.name);
    if (key === 'instruments') return t(`instr.${o.id}.name`, o.name);
    return t(`opt.${key}.${o.id}.name`, o.name);
  }
  function optionNote(sc, key, o) {
    if (!o.note) return '';
    if (key === 'orbit') return t(`scn.${sc.id}.orbit.${o.id}.note`, o.note);
    if (key === 'route') return t(`scn.${sc.id}.route.${o.id}.note`, o.note);
    if (key === 'instruments') return t(`instr.${o.id}.note`, o.note);
    if (key === 'lifetime') return o.note;
    return t(`opt.${key}.${o.id}.note`, o.note);
  }

  function decoratedOption(sc, diff, key, o) {
    const c = { ...o, name: optionName(sc, key, o), note: optionNote(sc, key, o) };
    if (key === 'instruments') {
      c.powerW = o.power;
      c.costM = o.cost;
      c.dataGbitDay = o.rate;
      c.science = scienceValue(sc, o.id);
      c.scienceFor = {};
      sc.requirements.forEach((r) => { c.scienceFor[r.id] = scienceValue(sc, o.id, r); });
      const sf = SCAN_FITS[o.id];
      if (sc.surface && sf) c.scanFits = sf.fits;
    } else if (key === 'panels') {
      c.mass = panelMass(o);
      c.powerW = Math.round(panelWatts(o, sc));
      c.costM = panelCost(o);
    } else if (key === 'launcher') {
      c.capacityByOrbit = {};
      sc.orbits.forEach((ob) => { c.capacityByOrbit[ob.id] = Math.round(capacityTo(o, ob, sc, null)); });
    } else if (key === 'ground') {
      c.costPerYear = sc.linkMode === 'near' ? o.nearPerYear : o.deepPerYear;
    } else if (key === 'lifetime') {
      c.years = o.years;
    } else if (key === 'orbit') {
      const info = orbitInfo(o, sc);
      c.periodMin = Math.round(info.periodMin);
      c.eclipsePct = Math.round(info.eclipse * 100);
      c.revisitDays = o.revisitDays;
    }
    return c;
  }
  function panelMass(o) {
    return o.kgFixed !== undefined ? o.kgFixed : round(o.areaM2 * o.kgPerM2, 1);
  }
  function panelCost(o) {
    return o.costFixed !== undefined ? o.costFixed : round(o.areaM2 * o.costPerM2, 1);
  }
  function panelWatts(o, sc) {
    if (o.rtg) return o.watts;
    return o.areaM2 * P.solarFlux(sc.au) * o.eff * (sc.arrayFactor || 1);
  }
  function scienceValue(sc, id, req) {
    // Weight of this instrument across objectives, for the shop and for a requirement.
    let v = 0;
    sc.objectives.forEach((obj) => {
      if (!obj.instruments[id]) return;
      v += obj.instruments[id] * (req ? req.weights[obj.id] || 0 : 1);
    });
    return round(v, 2);
  }

  function catalog(scenarioId, difficulty) {
    const sc = scenarioOf(scenarioId);
    if (!sc) return { error: 'unknown scenario' };
    const diff = difficultyOf(difficulty);
    if (!diff) return { error: 'unknown difficulty' };
    const roles = { planner: [], engineer: [], scientist: [], comms: [] };
    activeKeys(sc).forEach((key) => {
      const list = allowedOptions(sc, diff, key);
      if (list.length <= 1 && key !== 'instruments') return;
      const group = { key, title: t(`group.${key}`, GROUP_TITLES[key]), options: list.map((o) => decoratedOption(sc, diff, key, o)) };
      if (key === 'instruments') { group.multi = true; group.max = INSTRUMENT_MAX[difficulty]; group.min = RECORDER_MIN; }
      if (SURFACE_KEYS.includes(key)) group.surface = true;
      roles[KEY_ROLE[key]].push(group);
    });
    return { scenario: scenarioId, difficulty, roles };
  }

  function scenarios() {
    return Object.values(SCENARIOS).map((s) => ({
      id: s.id, title: t(`scn.${s.id}.title`, s.title), question: t(`scn.${s.id}.question`, s.question), kind: s.kind, dest: s.dest,
      objective: t(`scn.${s.id}.objective`, s.objective), training: !!s.training, landing: !!s.surface, platform: s.surface ? s.surface.platform : null,
      requirements: s.requirements.map((r) => ({ id: r.id, title: t(`scn.${s.id}.req.${r.id}.title`, r.title), text: t(`scn.${s.id}.req.${r.id}.text`, r.text) })),
      objectives: s.objectives.map((o) => ({ id: o.id, title: t(`scn.${s.id}.obj.${o.id}`, o.title) })),
    }));
  }
  function difficulties() {
    return DIFFICULTIES.map((d) => ({ id: d.id, title: t(`diff.${d.id}.title`, d.title), note: t(`diff.${d.id}.note`, d.note), tier: d.tier, designSec: d.designSec, budgetMult: d.budgetMult, crises: d.crises, flaws: d.flaws, instrumentMax: INSTRUMENT_MAX[d.id] }));
  }

  // ---------- Designs ----------
  function defaultValue(sc, diff, key) {
    const list = allowedOptions(sc, diff, key);
    if (key === 'instruments') {
      const st = (sc.starter && sc.starter.instruments) || [];
      const ok = st.filter((id) => list.some((o) => o.id === id));
      return ok.length ? ok : [list[0].id];
    }
    const want = sc.starter && sc.starter[key];
    if (want !== undefined && list.some((o) => o.id === want)) return want;
    const std = { structure: 'standard', adcs: 'wheels', computer: 'single', propMargin: 'm25', duty: 'd60', processing: 'compress', coding: 'robust', schedule: 'plan', route: list[0] && list[0].id, ascent: 'a60', oxygen: 'o1', drill: 'hand' }[key];
    if (std !== undefined && list.some((o) => o.id === std)) return std;
    return list.length ? list[0].id : undefined;
  }

  function newDesign(scenarioId, difficulty, requirementId) {
    const sc = scenarioOf(scenarioId);
    if (!sc) return { error: 'unknown scenario' };
    const diff = difficultyOf(difficulty) || difficultyOf('engineer');
    const req = sc.requirements.find((r) => r.id === requirementId) || sc.requirements[0];
    const picks = {};
    activeKeys(sc).forEach((key) => {
      picks[key] = defaultValue(sc, diff, key);
    });
    const design = { v: 1, scenario: sc.id, difficulty: diff.id, requirement: req.id, picks };
    return fitLauncher(design);
  }

  // Starter designs must be launchable: pick the smallest rocket that lifts it.
  function fitLauncher(design) {
    const sc = scenarioOf(design.scenario);
    const diff = difficultyOf(design.difficulty);
    const list = allowedOptions(sc, diff, 'launcher');
    const d = clone(design);
    for (const l of list) {
      d.picks.launcher = l.id;
      if (derive(d).massMargin >= 0) return d;
    }
    d.picks.launcher = list[list.length - 1].id;
    return d;
  }

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const rolesOf = (key) => (KEY_ROLE[key] ? [KEY_ROLE[key]] : []);

  function set(design, role, key, value) {
    const sc = scenarioOf(design && design.scenario);
    if (!sc) return { error: 'unknown scenario' };
    if (!KEY_ROLE[key]) return { error: `unknown key ${key}` };
    if (KEY_ROLE[key] !== role) return { error: `${role} cannot change ${key}` };
    if (!activeKeys(sc).includes(key)) return { error: `${key} is not used on this mission` };
    const diff = difficultyOf(design.difficulty) || difficultyOf('engineer');
    const allowed = allowedOptions(sc, diff, key);
    const next = clone(design);
    if (key === 'instruments') {
      const max = INSTRUMENT_MAX[diff.id];
      let list;
      if (Array.isArray(value)) list = value.slice();
      else {
        const cur = next.picks[key] || [];
        list = cur.includes(value) ? cur.filter((x) => x !== value) : cur.concat([value]);
      }
      list = list.filter((id, i) => list.indexOf(id) === i);
      if (list.some((id) => !allowed.some((o) => o.id === id))) return { error: 'that part is not available' };
      if (list.length > max) return { error: t('err.maxinst', 'At most {n} instruments on this difficulty.', { n: max }) };
      if (key === 'instruments' && !list.length) return { error: t('err.oneinst', 'Carry at least one instrument.') };
      next.picks[key] = list;
      return next;
    }
    if (!allowed.some((o) => o.id === value)) return { error: 'that option is not available' };
    next.picks[key] = value;
    return next;
  }

  // ---------- Physics summary ----------
  function capacityTo(l, o, sc, route) {
    if (sc.linkMode === 'near') {
      return l.leo * (o.launchFactor || 1) * (route ? route.capacityMult || 1 : 1);
    }
    const c3 = route && route.c3 !== undefined ? route.c3 : sc.c3;
    return l.c0 * Math.exp(-Math.max(0, c3) / l.scale) * (route ? route.capacityMult || 1 : 1);
  }

  function orbitInfo(o, sc) {
    const body = P.PLANETS[o.body];
    const rp = body.radius + o.altKm;
    const ra = o.apoKm ? body.radius + o.apoKm : rp;
    const a = (rp + ra) / 2;
    let periodMin = (2 * Math.PI * Math.sqrt((a * a * a) / body.mu)) / 60;
    if (o.periodMinOverride) periodMin = o.periodMinOverride;
    if (o.periodDaysOverride) periodMin = o.periodDaysOverride * 1440;
    let eclipse = o.eclipseOverride !== undefined ? o.eclipseOverride : Math.asin(clamp(body.radius / a, 0, 1)) / Math.PI;
    if (o.apoKm && o.eclipseOverride === undefined) eclipse *= 0.7;
    return { periodMin, eclipse, body, periodDays: periodMin / 1440 };
  }

  function arrivalDv(o, sc, route) {
    let dv = 0;
    if (o.insertionDv !== undefined) dv = o.insertionDv;
    else if (o.arriveDv === 'circular') dv = TD.captureDv(sc.vinf, o.body, o.altKm, o.altKm);
    else if (o.arriveDv === 'ellipse') dv = TD.captureDv(sc.vinf, o.body, o.altKm, o.apoKm);
    else if (o.arriveDv === 'capture') dv = TD.captureDv(sc.vinf, o.body, o.altKm, o.apoKm);
    else if (o.arriveDv === 'europa') dv = TD.captureDv(sc.vinf, o.body, 4 * 71492, 149 * 71492) + 1.5;
    const extra = route && route.extraDv ? route.extraDv : 0;
    return Math.max(0.05, dv + extra);
  }

  const G0 = P.G0;
  const ISP = 320;
  const propFor = (dry, dv) => dry * (Math.exp(dv / (ISP * G0)) - 1);

  function pickObj(sc, key, id) {
    const list = optionsFor(sc, key);
    return list.find((o) => o.id === id) || list[0];
  }

  // Everything the design implies. Pure and cheap: re-computed on every call.
  function derive(design) {
    const sc = scenarioOf(design.scenario);
    const diff = difficultyOf(design.difficulty) || difficultyOf('engineer');
    const p = design.picks;
    const o = pickObj(sc, 'orbit', p.orbit);
    const launcher = pickObj(sc, 'launcher', p.launcher);
    const route = pickObj(sc, 'route', p.route);
    const life = pickObj(sc, 'lifetime', p.lifetime);
    const sched = pickObj(sc, 'schedule', p.schedule);
    const struct = pickObj(sc, 'structure', p.structure);
    const panel = pickObj(sc, 'panels', p.panels);
    const bat = pickObj(sc, 'batteries', p.batteries);
    const adcs = pickObj(sc, 'adcs', p.adcs);
    const comp = pickObj(sc, 'computer', p.computer);
    const pm = pickObj(sc, 'propMargin', p.propMargin);
    const duty = pickObj(sc, 'duty', p.duty);
    const proc = pickObj(sc, 'processing', p.processing);
    const ant = pickObj(sc, 'antenna', p.antenna);
    const radio = pickObj(sc, 'radio', p.radio);
    const ground = pickObj(sc, 'ground', p.ground);
    const coding = pickObj(sc, 'coding', p.coding);
    const rec = pickObj(sc, 'recorder', p.recorder);
    const insts = (p.instruments || []).map((id) => ({ id, ...INSTRUMENTS[id] }));
    const surf = sc.surface ? surfaceParts(sc, p) : { mass: 0, costM: 0, powerW: 0, list: [] };
    const orb = orbitInfo(o, sc);

    // Power
    const arrayBaseW = panel.rtg ? 0 : panelWatts(panel, sc);
    const rtgW = panel.rtg ? panel.watts : 0;
    const busW = sc.busW + adcs.powerW + comp.powerW + sc.heaterW + proc.powerW;
    const instPowerW = insts.reduce((s, i) => s + i.power, 0);
    const dutyFrac = duty.frac;
    // Cameras only work in sunlight; radars and the rest keep running in shadow.
    const onFraction = (i) => (i.continuous ? 1 : i.needsSun ? Math.min(dutyFrac, 1 - orb.eclipse) : dutyFrac);
    const instAvgW = insts.reduce((s, i) => s + i.power * onFraction(i), 0);
    const eclipseInstW = insts.filter((i) => !i.needsSun).reduce((s, i) => s + i.power * (i.continuous ? 1 : dutyFrac), 0);
    const eclipseH = (orb.periodMin * orb.eclipse) / 60;
    const eclipseWh = (busW + eclipseInstW) * eclipseH;

    // Comms
    const rangeAU = sc.linkMode === 'near' ? (o.rangeKm || 1500) / P.AU : sc.rangeAU || (sc.range ? sc.range.base : 1);
    const pointing = adcs.pointing;
    // A big dish needs steady pointing to hit Earth.
    const pointLoss = ant.diaM >= 2 ? Math.min(1, pointing / (ant.diaM >= 3 ? 1.2 : 0.95)) : 1;
    const K = sc.linkMode === 'near' ? 1.2e-4 : GD_K;
    const rawRate = (K * radio.rfW * ant.diaM * ant.diaM) / (rangeAU * rangeAU);
    const rateMbps = Math.min(radio.maxMbps, rawRate) * coding.rate * pointLoss;
    const pass = o.passes || {};
    let dailySec;
    let gapDays;
    if (pass.continuous) {
      dailySec = 86400;
      gapDays = 0.02;
    } else if (pass.dsn) {
      const hours = Math.min(24, ground.stations * pass.hours);
      dailySec = hours * 3600 * (1 - pass.occult);
      gapDays = Math.max(0, (24 - hours) / 24);
    } else {
      const perDay = ground.stations * pass.perStation;
      dailySec = perDay * pass.passMin * 60;
      gapDays = 1 / perDay;
    }
    const passFrac = dailySec / 86400;
    const downGbitDay = (rateMbps * dailySec) / 1000;

    // Data
    const obsFrac = o.obsFracOverride || 1;
    const rateMult = sc.rateMult || 1;
    const genRates = insts.map((i) => i.rate * rateMult * onFraction(i) * obsFrac * proc.factor);
    const genGbitDay = genRates.reduce((s, x) => s + x, 0);
    let bufferNeed = genGbitDay * Math.max(gapDays, 0.02);
    if (o.tour) bufferNeed = Math.max(bufferNeed, genGbitDay * orb.periodDays);

    // Mass
    const partsMass = (sc.busKg || 0) + insts.reduce((s, i) => s + i.mass, 0) + panelMass(panel) + bat.mass + adcs.mass + comp.mass + ant.mass + radio.mass + rec.mass + surf.mass;
    const structMass = struct.frac * partsMass + struct.mass;
    const thermalMass = sc.thermalFrac * partsMass;
    const engineMass = 20;
    const arrival = arrivalDv(o, sc, route);
    const opsDv = o.dvPerYear * life.years;
    const margin = pm.frac;
    const dv = (arrival + opsDv) * (1 + margin);
    let tankKg = 0;
    let prop = 0;
    let dry = partsMass + structMass + thermalMass + engineMass;
    const dryBase = dry;
    for (let i = 0; i < 6; i++) {
      dry = dryBase + tankKg;
      prop = propFor(dry, dv);
      tankKg = 0.07 * prop;
    }
    const wet = dry + prop;
    const capacity = capacityTo(launcher, o, sc, route);

    // Cost
    const partCost = insts.reduce((s, i) => s + i.cost, 0) + panelCost(panel) + bat.costM + adcs.costM + comp.costM + ant.costM + radio.costM + rec.costM + (struct.costM || 0) + surf.costM;
    const devM = (sc.busCost + 0.05 * dry + partCost) * sched.costMult;
    const launchM = launcher.costM * (route.costMult || 1);
    const groundPerYear = sc.linkMode === 'near' ? ground.nearPerYear : ground.deepPerYear;
    const cruiseYears = (route.opsMonths || 0) / 12;
    const opsM = (sc.opsPerYear + groundPerYear) * (life.years + cruiseYears);
    const devMonths = sc.devBase + 0.8 * Math.max(0, insts.length - 1) + (sched.months || 0) + (sc.surface ? 0.5 * surf.list.length * 0.5 : 0);
    const deadline = sc.deadlineMonths;
    const latePenalty = devMonths > deadline ? (devMonths - deadline) * (sc.dest === 'mars' ? 12 : 5) : 0;
    const costM = devM + launchM + opsM + latePenalty;
    const budget = diff.budgetMult === null ? null : sc.budgetM * diff.budgetMult;

    // Lifetime limits
    const hardness = struct.shieldKrad * comp.radHard;
    const dosePerYear = o.radKrad;
    const radLifeYears = hardness / dosePerYear;
    const dragYears = o.dragYears;

    return {
      _req: design.requirement,
      sc, diff, o, launcher, route, life, sched, struct, panel, bat, adcs, comp, pm, duty, proc, ant, radio, ground, coding, rec, insts, surf, orb,
      arrayBaseW, rtgW, busW, instPowerW, instAvgW, eclipseH, eclipseWh, eclipseInstW, dutyFrac,
      onFraction, rangeAU, pointing, rawRate, rateMbps, dailySec, passFrac, gapDays, downGbitDay, obsFrac, genGbitDay, genRates, bufferNeed,
      partsMass, structMass, thermalMass, dry, prop, wet, capacity, massMargin: capacity - wet, arrival, opsDv, dv, tankKg, partCost, devM, launchM, opsM, costM, budget, latePenalty,
      devMonths, deadline, hardness, dosePerYear, radLifeYears, dragYears, lifeYears: life.years, groundPerYear,
    };
  }
  const GD_K = SMD.data.CONST.linkK;

  function surfaceParts(sc, p) {
    const parts = [];
    const add = (key, id) => {
      const o = pickObj(sc, key, id);
      if (!o) return null;
      parts.push({ key, o });
      return o;
    };
    ['ascent', 'oxygen', 'drill'].forEach((k) => add(k, p[k]));
    const ascentKg = parts.filter((x) => x.key === 'ascent').reduce((s, x) => s + (x.o.extraKg || 0), 0);
    const mass = parts.reduce((s, x) => s + (x.o.mass || 0), 0) + ascentKg;
    const costM = parts.reduce((s, x) => s + (x.o.costM || 0), 0);
    return { list: parts, mass, costM, powerW: parts.reduce((s, x) => s + (x.o.powerW || 0), 0), ascentKg };
  }

  // Average power on an orbit.
  function powerBudget(d) {
    const sunFrac = 1 - d.orb.eclipse;
    const inAvg = d.arrayBaseW * sunFrac + d.rtgW;
    const radioAvg = d.radio.dcW * Math.min(1, d.passFrac);
    const load = d.busW + d.instAvgW + radioAvg;
    return { inAvg, load, marginPct: ((inAvg - load) / Math.max(1, load)) * 100, radioAvg };
  }

  function statusFor(ratio, warnAt) {
    if (ratio <= 1) return ratio >= (warnAt || 0.92) ? 'warn' : 'ok';
    return 'bad';
  }

  function resources(design) {
    const d = derive(design);
    const pb = powerBudget(d);
    const massRatio = d.wet / d.capacity;
    const budgetRatio = d.budget === null ? 0 : d.costM / d.budget;
    const powerRatio = pb.load / Math.max(1, pb.inAvg);
    const bufRatio = d.bufferNeed / d.rec.gbit;
    const commsRatio = d.genGbitDay / Math.max(1e-6, d.downGbitDay);
    const timeRatio = d.deadline ? d.devMonths / d.deadline : 0;
    const lifeShort = d.radLifeYears < d.lifeYears;
    return {
      mass: {
        value: Math.round(d.wet), limit: Math.round(d.capacity), unit: 'kg', status: statusFor(massRatio, 0.9),
        why: T('res.mass.why', { rocket: optionName(d.sc, 'launcher', d.launcher) }),
        dry: Math.round(d.dry), prop: Math.round(d.prop), payload: Math.round(d.partsMass), marginKg: Math.round(d.massMargin),
      },
      power: {
        value: Math.round(pb.inAvg), limit: Math.round(pb.load), unit: 'W', status: statusFor(powerRatio),
        why: T('res.power.why'),
        marginPct: Math.round(pb.marginPct), sunlitW: Math.round(d.arrayBaseW + d.rtgW), eclipseMin: Math.round(d.orb.periodMin * d.orb.eclipse),
        eclipsePct: Math.round(d.orb.eclipse * 100), batteryWh: d.bat.wh, batteryNeedWh: Math.round(d.eclipseWh), loadW: Math.round(pb.load),
      },
      budget: {
        value: Math.round(d.costM), limit: d.budget === null ? null : Math.round(d.budget), unit: '$M', status: d.budget === null ? 'ok' : statusFor(budgetRatio, 0.93),
        why: T('res.budget.why', { dev: Math.round(d.devM), launch: Math.round(d.launchM), ops: Math.round(d.opsM) }),
        devM: Math.round(d.devM), launchM: Math.round(d.launchM), opsM: Math.round(d.opsM), lateM: Math.round(d.latePenalty),
      },
      data: {
        value: round(d.bufferNeed, 1), limit: d.rec.gbit, unit: 'Gbit', status: statusFor(bufRatio, 0.85),
        why: T('res.data.why'),
        generatedGbitDay: round(d.genGbitDay, 1), gapDays: round(d.gapDays, 2), recorderGbit: d.rec.gbit,
      },
      comms: {
        value: round(d.downGbitDay, 1), limit: round(d.genGbitDay, 1), unit: 'Gbit/day', status: d.genGbitDay <= 0 ? 'bad' : commsRatio > 1.15 ? 'bad' : commsRatio > 0.95 ? 'warn' : 'ok',
        why: T('res.comms.why'),
        rateMbps: round(d.rateMbps, 2), passesPerDay: passesPerDay(d), hoursInView: round(d.dailySec / 3600, 1), rangeAU: round(d.rangeAU, 4), stations: d.ground.stations,
      },
      time: {
        value: round(d.devMonths, 1), limit: d.diff.id === 'sandbox' ? null : d.deadline, unit: 'months', status: d.diff.id === 'sandbox' ? 'ok' : (lifeShort || d.devMonths > d.deadline) ? 'bad' : d.devMonths > d.deadline - 2 ? 'warn' : 'ok',
        why: T('res.time.why'),
        lifeYears: d.lifeYears, maxLifeYears: round(d.radLifeYears, 2), lifeLimitedBy: lifeShort ? 'radiation' : d.dragYears < d.lifeYears ? 'drag' : null,
      },
    };
  }
  function passesPerDay(d) {
    const pass = d.o.passes || {};
    if (pass.continuous) return null;
    if (pass.dsn) return null;
    return d.ground.stations * pass.perStation;
  }

  function checks(design) {
    const d = derive(design);
    const pb = powerBudget(d);
    const list = [];
    const massOk = d.wet <= d.capacity;
    const routeBad = d.route.orbitOnly && !d.route.orbitOnly.includes(d.o.id);
    list.push({
      id: 'launcher', hard: true, ok: massOk && !routeBad,
      text: routeBad ? T('check.launcher.routeOnly') : massOk ? T('check.launcher') : T('check.launcher.bad', { rocket: optionName(d.sc, 'launcher', d.launcher), cap: fmt(d.capacity), need: fmt(d.wet) }),
    });
    const over = d.budget !== null ? d.costM - d.budget : -1;
    list.push({ id: 'budget', hard: false, ok: over <= 0, text: over <= 0 ? T('check.budget') : T('check.budget.bad', { over: Math.ceil(over) }) });
    const powerOk = pb.inAvg >= pb.load;
    list.push({ id: 'power', hard: false, ok: powerOk, text: powerOk ? T('check.power') : T('check.power.bad', { w: Math.ceil(pb.load - pb.inAvg) }) });
    const batOk = d.bat.wh >= d.eclipseWh;
    list.push({ id: 'battery', hard: false, ok: batOk, text: batOk ? T('check.battery') : T('check.battery.bad', { need: Math.ceil(d.eclipseWh), have: d.bat.wh }) });
    const commsOk = d.downGbitDay >= d.genGbitDay;
    list.push({ id: 'comms', hard: false, ok: commsOk, text: commsOk ? T('check.comms') : T('check.comms.bad', { gen: round(d.genGbitDay, 1), cap: round(d.downGbitDay, 1) }) });
    const recOk = d.rec.gbit >= d.bufferNeed;
    list.push({ id: 'recorder', hard: false, ok: recOk, text: recOk ? T('check.recorder') : T('check.recorder.bad') });
    const measured = objectiveCoverage(d);
    list.push({ id: 'instruments', hard: false, ok: measured, text: measured ? T('check.instruments') : T('check.instruments.bad') });
    const timeOk = d.diff.id === 'sandbox' || d.devMonths <= d.deadline;
    list.push({ id: 'time', hard: false, ok: timeOk, text: timeOk ? T('check.time') : T('check.time.bad', { months: round(d.devMonths, 1), limit: d.deadline }) });
    const lifeOk = d.radLifeYears >= d.lifeYears;
    list.push({ id: 'life', hard: false, ok: lifeOk, text: lifeOk ? T('check.life') : T('check.life.bad', { max: round(d.radLifeYears, 1) }) });
    return list;
  }
  function objectiveCoverage(d) {
    const req = d.sc.requirements.find((r) => r.id === reqId(d)) || d.sc.requirements[0];
    return d.sc.objectives.some((obj) => req.weights[obj.id] > 0 && d.insts.some((i) => obj.instruments[i.id]));
  }
  function reqId(d) {
    return d._req;
  }

  function preview(design, role, key, value) {
    const next = set(design, role, key, value);
    if (next.error) return next;
    const a = resources(design);
    const b = resources(next);
    const out = {};
    ['mass', 'power', 'budget', 'data', 'comms', 'time'].forEach((k) => {
      out[k] = { from: a[k].value, to: b[k].value, delta: round(b[k].value - a[k].value, 1), status: b[k].status, statusFrom: a[k].status, limit: b[k].limit };
    });
    return out;
  }

  // ---------- Science ----------
  // Effective information returned per objective, in need-normalised units.
  function scienceFrom(d, returned, flawQuality, pointQuality) {
    const req = d.sc.requirements.find((r) => r.id === d._req) || d.sc.requirements[0];
    const proc = d.proc;
    let total = 0;
    const perObjective = {};
    d.sc.objectives.forEach((obj) => {
      const w = req.weights[obj.id] || 0;
      const need = (req.needs && req.needs[obj.id]) || 1;
      let eff = 0;
      d.insts.forEach((inst, idx) => {
        const weight = obj.instruments[inst.id];
        if (!weight) return;
        const fit = fitFor(d, inst);
        const q = proc.quality * flawQuality * instrumentPointing(d, inst, pointQuality);
        eff += ((returned[idx] || 0) / (proc.factor * (d.sc.rateMult || 1))) * weight * fit * q;
      });
      const frac = Math.min(1.15, Math.pow(eff / need, 0.85));
      perObjective[obj.id] = frac;
      total += w * frac;
    });
    return { sciencePct: total * 100, perObjective };
  }
  function fitFor(d, inst) {
    const f = d.o.fit;
    return (f && f[inst.kind] !== undefined ? f[inst.kind] : 1);
  }
  function instrumentPointing(d, inst, mult) {
    const m = mult === undefined ? 1 : mult;
    if (inst.needsPointing) return Math.min(1.1, d.pointing * m);
    return Math.min(1, 0.7 + 0.3 * d.pointing * m);
  }

  // ---------- Crises ----------
  function crisesFor(design, seed) {
    const sc = scenarioOf(design.scenario);
    const diff = difficultyOf(design.difficulty) || difficultyOf('engineer');
    const rng = rngOf(`${seed}:${design.scenario}:crises`);
    const pool = CRISES.slice();
    const picks = [];
    const nCrises = diff.crises;
    for (let i = 0; i < nCrises && pool.length; i++) {
      const idx = Math.floor(rng() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }
    const oppPool = OPPORTUNITIES.filter((o) => o.kinds.includes(sc.kind));
    for (let i = 0; i < diff.opportunities && oppPool.length; i++) {
      const idx = Math.floor(rng() * oppPool.length);
      picks.push({ ...oppPool.splice(idx, 1)[0], kind: 'opportunity' });
    }
    // Timing: spread across the operations phase of the flight.
    const layout = phaseLayout(sc);
    const opsStart = layout.opsStart / FPS;
    const opsDur = layout.opsFrames / FPS;
    const n = picks.length;
    const slots = [];
    for (let i = 0; i < n; i++) slots.push(opsStart + ((i + 0.7) / n) * (opsDur - 8));
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const adcsMagnet = design.picks.adcs === 'magnet';
    return picks
      .map((c, i) => {
        let tpl = c;
        if (c.needsWheels && adcsMagnet) tpl = CRISES.find((x) => x.id === 'antennaGlitch');
        const isOpp = c.kind === 'opportunity';
        return {
          id: `c${i}`,
          type: tpl.id,
          kind: isOpp ? 'opportunity' : 'crisis',
          t: round(slots[i] + (rng() - 0.5), 1),
          role: tpl.role,
          fixRole: tpl.fixRole,
          windowSec: tpl.windowSec,
          title: t(`crisis.${tpl.id}.title`, tpl.title),
          alarm: t(`crisis.${tpl.id}.alarm`, tpl.alarm),
          fix: t(`crisis.${tpl.id}.fix`, tpl.fix),
          actions: tpl.actions.map((a) => ({ id: a.id, label: t(`crisis.${tpl.id}.action.${a.id}`, a.label), correct: !!a.correct })),
          bonus: (tpl.bonus || 0.1) * (diff.oppBonus || 1),
        };
      })
      .sort((a, b) => a.t - b.t);
  }

  function phaseLayout(sc) {
    const launch = 18;
    const cruise = sc.linkMode === 'near' ? 6 : sc.kind === 'moon' ? 12 : 30;
    const insertion = 18;
    const end = 12;
    const opsStart = launch + cruise + insertion;
    const opsFrames = FLIGHT_FRAMES - opsStart - end;
    return { launch, cruise, insertion, end, opsStart, opsFrames };
  }

  // ---------- Flight ----------
  const OUTCOME_FIX = { fixed: true, taken: true };

  function flawsFor(d, seed) {
    if (!d.diff.flaws) return [];
    const rng = rngOf(`${seed}:${d.sc.id}:flaws`);
    const found = [];
    FLAWS.forEach((f) => {
      if (rng() < f.chance * d.sched.flawMult) found.push(f);
    });
    return found;
  }

  function fly(design, seed, outcomes) {
    const d = derive(design);
    const sc = d.sc;
    const rng = rngOf(`${seed}:${sc.id}:fly`);
    const outMap = outcomes || {};
    const layout = phaseLayout(sc);
    const crises = crisesFor(design, seed);
    const events = [];
    const frames = [];
    const hardOk = d.wet <= d.capacity && !(d.route.orbitOnly && !d.route.orbitOnly.includes(d.o.id));

    const flaws = flawsFor(d, seed);
    const applyFlaw = (key, def) => flaws.reduce((acc, f) => acc * (f.effect[key] !== undefined ? f.effect[key] : 1), def);
    let batteryMult = applyFlaw('batteryMult', 1);
    let panelMult = applyFlaw('panelMult', 1);
    const rateMultBase = applyFlaw('rateMult', 1);
    const sciQuality = applyFlaw('sciQuality', 1);
    let pointMult = 1;

    const lifeDays = d.lifeYears * 365.25;
    const nOrbits = Math.max(1, Math.floor(layout.opsFrames / STEPS_PER_ORBIT));
    const opsSteps = nOrbits * STEPS_PER_ORBIT;
    const simDaysCovered = nOrbits * d.orb.periodDays;
    const dtDay = d.orb.periodDays / STEPS_PER_ORBIT;
    const dtHours = dtDay * 24;

    const crisisStep = (c) => clamp(Math.floor(((c.t * FPS - layout.opsStart) / layout.opsFrames) * opsSteps), 0, opsSteps - 1);
    const pending = crises.map((c) => ({ c, step: crisisStep(c), applied: false }));

    const capacityWh = d.bat.wh;
    let batteryWh = capacityWh * batteryMult;
    const buffer = d.insts.map(() => 0);
    const returned = d.insts.map(() => 0);
    let generated = 0;
    let downlinked = 0;
    let overflow = 0;
    let unsent = 0;
    let dead = false;
    let cause = null;
    let brownouts = 0;
    let brownoutInEclipse = false;
    let minBatt = 1;
    let lowBattEvents = 0;
    const totalFuel = d.prop;
    const opsFuel = propFor(d.dry, d.opsDv * (1 + d.pm.frac)) * (1 + 0.07);
    let fuelKg = opsFuel;
    let fuelFrac = 1;
    let dose = 0;
    let instOffUntil = -1;
    let linkOffUntil = -1;
    let pointHoldUntil = -1;
    let scienceBonus = 0;
    let dataFloodUntil = -1;
    const scale = lifeDays / Math.max(1e-6, simDaysCovered);
    let lifeFrac = 1;
    let overflowShown = false;
    let blackoutShown = false;
    let deadT = null;
    let orbiterParked = false;
    let sciCache = 0;

    function pushFrame(frame) {
      frames.push(frame);
    }
    function recordEvent(e) {
      events.push(e);
    }
    const frameT = () => round(frames.length / FPS, 2);
    const phaseEvent = (phase) => recordEvent({ t: frameT(), kind: 'phase', phase, text: T(`phase.${phase}`) });

    if (!hardOk) {
      for (let i = 0; i < FLIGHT_FRAMES; i++) pushFrame({ t: round(i / FPS, 2), phase: 'launch', sunlit: true, inPass: false, battery: 1, powerIn: 0, powerOut: 0, buffer: 0, bufferGbit: 0, downlink: 0, science: 0, fuel: 1, alive: false, orbit: 0 });
      return { frames, events: [{ t: 0, kind: 'dead', text: T('event.dead') }], crises, result: buildResult('breakup', false) };
    }

    // Launch and cruise frames.
    phaseEvent('launch');
    for (let i = 0; i < layout.launch; i++) pushFrame(emptyFrame(i, 'launch'));
    if (layout.cruise) {
      phaseEvent('cruise');
      for (let i = 0; i < layout.cruise; i++) pushFrame(emptyFrame(i, 'cruise'));
    }
    phaseEvent('insertion');
    // Aerobraking has a small chance of going wrong (Mars Climate Orbiter style).
    let insertionFailed = false;
    if (d.route.risk && rng() < d.route.risk * d.sched.flawMult) insertionFailed = true;
    for (let i = 0; i < layout.insertion; i++) pushFrame(emptyFrame(i, 'insertion'));
    function emptyFrame(i, phase) {
      return { t: frameT(), phase, sunlit: true, inPass: false, battery: 1, powerIn: Math.round(d.arrayBaseW + d.rtgW), powerOut: Math.round(d.busW), buffer: 0, bufferGbit: 0, downlink: 0, science: 0, fuel: 1, alive: true, orbit: 0 };
    }

    if (insertionFailed) {
      dead = true;
      cause = 'nav';
      deadT = frameT();
      recordEvent({ t: deadT, kind: 'dead', cause, text: T('cause.nav') });
    } else {
      phaseEvent('ops');
      flaws.forEach((f) => recordEvent({ t: frameT(), kind: 'flaw', id: f.id, text: t(`flaw.${f.id}`, f.text) }));
    }

    const orbitPhase0 = rng();
    const rangePhase = rng();

    // Operations: real orbit dynamics, each orbit stands in for part of the mission.
    for (let step = 0; step < opsSteps; step++) {
      const orbitIdx = Math.floor(step / STEPS_PER_ORBIT);
      const stepInOrbit = step - orbitIdx * STEPS_PER_ORBIT;
      const missionFrac = step / opsSteps;
      const ageYears = missionFrac * d.lifeYears;

      for (const p of pending) {
        if (!dead && !p.applied && step >= p.step) {
          p.applied = true;
          applyCrisis(p.c, outMap[p.c.id], step);
        }
      }

      const eclipseShare = Math.max(0, Math.min(1, (d.orb.eclipse - stepInOrbit / STEPS_PER_ORBIT) * STEPS_PER_ORBIT));
      const sunShare = 1 - eclipseShare;
      const sunlit = eclipseShare < 0.2;

      const panelDeg = Math.pow(0.985, ageYears);
      const batFade = 1 - 0.03 * ageYears;
      const capNow = capacityWh * batteryMult * clamp(batFade, 0.4, 1);
      const powerIn = dead ? 0 : sunShare * d.arrayBaseW * panelMult * panelDeg + d.rtgW;
      const lastStep = false;

      // Radiation.
      if (!dead) {
        dose += d.dosePerYear * (d.lifeYears / opsSteps);
        if (dose >= d.hardness * extraHardness()) markDead('radiation', step);
      }

      const distAU = rangeNow(d, missionFrac, rangePhase);
      const blackout = sc.range && distAU > sc.range.base + sc.range.amp * 0.985;
      if (blackout && !blackoutShown) {
        blackoutShown = true;
        recordEvent({ t: frameT(), kind: 'blackout', text: T('event.blackout') });
      }
      const linkDown = step < linkOffUntil || blackout;

      let vis = 0;
      if (!dead && !linkDown) vis = visibility(d, step, dtDay);
      let rateNow = 0;
      if (vis > 0) {
        const rawRateNow = sc.linkMode === 'near' ? d.rawRate : (d.rawRate * d.rangeAU * d.rangeAU) / (distAU * distAU);
        rateNow = Math.min(d.radio.maxMbps, rawRateNow) * d.coding.rate * pointLossNow(d, step) * rateMultBase;
      }

      // Instruments on this step?
      const socBefore = batteryWh / Math.max(1, capNow);
      const shedInst = socBefore < 0.25 || step < instOffUntil;
      const shedRadio = socBefore < 0.06;
      if (!dead) {
        // Generation
        const flood = step < dataFloodUntil ? 3 : 1;
        d.insts.forEach((inst, i) => {
          let on = false;
          if (!shedInst) {
            if (inst.continuous) on = true;
            else if (inst.needsSun) on = sunlit && dutyGateSun(stepInOrbit, d, inst);
            else on = stepInOrbit / STEPS_PER_ORBIT < d.dutyFrac;
          }
          if (!on) return;
          const gen = inst.rate * (sc.rateMult || 1) * d.proc.factor * dtDay * d.obsFrac * flood;
          generated += gen;
          const total = bufferTotal();
          if (total + gen > d.rec.gbit) {
            const room = Math.max(0, d.rec.gbit - total);
            buffer[i] += room;
            overflow += gen - room;
            if (!overflowShown) {
              overflowShown = true;
              recordEvent({ t: frameT(), kind: 'overflow', role: 'comms', text: T('event.overflow') });
            }
          } else buffer[i] += gen;
        });
        // Downlink
        if (rateNow > 0) {
          const gbit = (rateNow * dtDay * 86400 * vis) / 1000;
          const total = bufferTotal();
          const send = Math.min(total, gbit);
          if (total > 0) {
            buffer.forEach((b, i) => {
              const s = (b / total) * send;
              buffer[i] -= s;
              returned[i] += s;
            });
            downlinked += send;
          }
        }
      }

      // Power this step.
      let instLoad = 0;
      if (!dead && !shedInst) {
        d.insts.forEach((inst) => {
          let on = false;
          if (inst.continuous) on = true;
          else if (inst.needsSun) on = sunlit && dutyGateSun(stepInOrbit, d, inst);
          else on = stepInOrbit / STEPS_PER_ORBIT < d.dutyFrac;
          if (on) instLoad += inst.power;
        });
      }
      const radioLoad = !dead && !shedRadio && vis > 0 ? d.radio.dcW : 0;
      const powerOut = dead ? 0 : d.busW + instLoad + radioLoad;
      if (!dead) {
        const net = powerIn - powerOut;
        batteryWh += (net > 0 ? net * 0.92 : net) * dtHours;
        if (batteryWh > capNow) batteryWh = capNow;
        if (batteryWh <= 0) {
          batteryWh = 0;
          if (!brownoutInEclipse) {
            brownouts += 1;
            brownoutInEclipse = true;
            recordEvent({ t: frameT(), kind: 'brownout', role: 'engineer', text: T('event.brownout'), orbit: orbitIdx });
            if (brownouts >= 3) markDead('power', step);
          }
        } else if (batteryWh > 0.15 * capNow) brownoutInEclipse = false;
        const soc = batteryWh / capNow;
        if (soc < 0.3 && sunlit === false && lowBattEvents < 3 && soc > 0) {
          lowBattEvents += 1;
          recordEvent({ t: frameT(), kind: 'eclipse_low', role: 'engineer', soc: round(soc, 2), text: T('event.eclipse') });
        }
        minBatt = Math.min(minBatt, soc);
      }

      // Fuel for station keeping.
      if (!dead) {
        const use = opsFuel / opsSteps / (1 + d.pm.frac);
        fuelKg = Math.max(0, fuelKg - use);
        fuelFrac = opsFuel > 0 ? fuelKg / opsFuel : 0;
        if (d.opsDv > 0 && fuelKg <= 0 && step < opsSteps - 1) {
          // Only a crisis can drain the tanks early. A landing mission still has a
          // lander to drop: the orbiter stops doing science, the crew still goes down.
          if (sc.surface) {
            if (!orbiterParked) {
              orbiterParked = true;
              instOffUntil = opsSteps;
              lifeFrac = clamp(step / opsSteps, 0, 1);
              recordEvent({ t: frameT(), kind: 'flaw', id: 'fuel_out', text: T('event.fuelout') });
            }
          } else markDead(d.dragYears < 4 ? 'drag' : 'attitude', step);
        }
      }

      if (step % 3 === 0 || dead) sciCache = scienceFrom(d, returned.map((r) => r * scale), sciQuality, pointQualityNow(step)).sciencePct;
      const sciNow = sciCache;
      pushFrame({
        t: frameT(), phase: dead ? 'end' : 'ops', sunlit, inPass: vis > 0, battery: round(clamp(batteryWh / capNow, 0, 1), 3), powerIn: Math.round(powerIn), powerOut: Math.round(powerOut),
        buffer: round(clamp(bufferTotal() / d.rec.gbit, 0, 1), 3), bufferGbit: round(bufferTotal(), 2), downlink: round(rateNow, 3), science: round(Math.min(sciNow + scienceBonus, 130), 2), fuel: round(fuelFrac, 3), alive: !dead, orbit: orbitIdx,
      });
    }

    // Tail frames to a fixed length.
    const endPhaseLen = FLIGHT_FRAMES - frames.length;
    if (!dead) phaseEvent('end');
    for (let i = 0; i < endPhaseLen; i++) {
      const last = frames[frames.length - 1];
      pushFrame({ ...last, t: frameT(), phase: 'end', inPass: false, downlink: 0, alive: !dead });
    }

    // Whatever is still in the recorder never reached Earth.
    unsent = bufferTotal() + 0;
    const finalLifeFrac = lifeFrac;
    const sciFinal = scienceFrom(d, returned.map((r) => r * scale), sciQuality, pointQualityNow(opsSteps)).sciencePct + scienceBonus;
    const science = dead && !cause ? 0 : round(Math.min(sciFinal, 130), 1);
    const genTotal = generated * scale;
    const returnedTotal = returned.reduce((s, r) => s + r, 0) * scale;
    const lostTotal = Math.max(0, genTotal - returnedTotal);
    const overflowTotal = overflow * scale;

    let primaryLoss = null;
    if (genTotal > 0) {
      const lostFrac = lostTotal / genTotal;
      if (overflowTotal / genTotal > 0.15) primaryLoss = 'overflow';
      else if (lostFrac > 0.25) primaryLoss = 'comms';
    }
    if (returnedTotal / Math.max(1e-6, genTotal) < 0.03 && !dead && genTotal > 0) primaryLoss = 'comms';

    // Money: an overrun cuts operations short.
    let budgetCut = false;
    if (d.budget !== null && d.costM > d.budget && !dead) {
      const opsAffordable = Math.max(0, d.budget - d.devM - d.launchM - d.latePenalty);
      const frac = clamp(opsAffordable / Math.max(1, d.opsM), 0, 1);
      if (frac < 1) {
        budgetCut = true;
        lifeFrac = Math.min(lifeFrac, frac);
        if (frac <= 0.05) cause = cause || 'budget';
      }
    }
    const lifeFinal = dead ? lifeFrac : Math.min(lifeFrac, finalLifeFrac);
    const scienceOut = budgetCut ? round(science * lifeFinal, 1) : science;

    const crisesFixed = crises.filter((c) => c.kind === 'crisis' && OUTCOME_FIX[outMap[c.id]]).length;
    const crisesTotal = crises.filter((c) => c.kind === 'crisis').length;
    const opportunitiesTaken = crises.filter((c) => c.kind === 'opportunity' && OUTCOME_FIX[outMap[c.id]]).length;

    if (cause === null && lifeFinal < 1 && budgetCut) cause = 'budget';
    const alive = !dead && !budgetCut;
    let success = 'fail';
    if (scienceOut >= 90 && lifeFinal >= 0.7 && alive) success = 'full';
    else if (scienceOut >= 50) success = 'partial';
    else if (scienceOut >= 30 && lifeFinal >= 0.7) success = 'partial';

    function buildResult(c, al) {
      return { alive: al, cause: c, success: 'fail', science: 0, generatedGbit: 0, returnedGbit: 0, lostGbit: 0, lostFrac: 0, overflowGbit: 0, unsentGbit: 0, dataLost: 0, primaryLoss: null, lifeFraction: 0, lifeDays: 0, crisesFixed: 0, crisesTotal: 0, opportunitiesTaken: 0, brownouts: 0, costM: round(d.costM, 1), wetKg: round(d.wet, 0), minBattery: 0, doseKrad: 0, hardnessKrad: d.hardness, flaws: [], perObjective: {} };
    }

    const result = {
      alive,
      cause,
      success,
      science: scienceOut,
      generatedGbit: round(genTotal, 1),
      returnedGbit: round(returnedTotal, 1),
      lostGbit: round(lostTotal, 1),
      dataLost: round(lostTotal, 1),
      lostFrac: round(genTotal > 0 ? lostTotal / genTotal : 0, 3),
      overflowGbit: round(overflowTotal, 1),
      unsentGbit: round(unsent * scale, 1),
      primaryLoss,
      lifeFraction: round(lifeFinal, 3),
      lifeDays: Math.round(lifeDays * lifeFinal),
      crisesFixed,
      crisesTotal,
      opportunitiesTaken,
      brownouts,
      minBattery: round(minBatt, 3),
      doseKrad: round(dose, 1),
      hardnessKrad: round(d.hardness, 1),
      flaws: flaws.map((f) => f.id),
      costM: round(d.costM, 1),
      wetKg: round(d.wet, 0),
      perObjective: scienceFrom(d, returned.map((r) => r * scale), sciQuality, 1).perObjective,
    };
    return { frames, events: events.sort((a, b) => a.t - b.t), crises, result };

    // --- inner helpers ---
    function markDead(c, step) {
      if (dead) return;
      dead = true;
      cause = c;
      deadT = round(frameT(), 2);
      lifeFrac = clamp(step / opsSteps, 0, 1);
      recordEvent({ t: deadT, kind: 'dead', cause: c, text: T(`cause.${c}`) });
    }
    function extraHardness() {
      return 1;
    }
    function bufferTotal() {
      return buffer.reduce((s, b) => s + b, 0);
    }
    function pointQualityNow(step) {
      return step < pointHoldUntil ? 0.6 * pointMult : pointMult;
    }
    function pointLossNow() {
      const base = d.ant.diaM >= 2 ? Math.min(1, d.pointing / (d.ant.diaM >= 3 ? 1.2 : 0.95)) : 1;
      return base;
    }
    function applyCrisis(c, outcome, step) {
      const fixed = !!OUTCOME_FIX[outcome];
      const nOrb = STEPS_PER_ORBIT;
      recordEvent({ t: frameT(), kind: c.kind, id: c.id, type: c.type, role: c.role, fixRole: c.fixRole, windowSec: c.windowSec, outcome: outcome || (c.kind === 'opportunity' ? 'skipped' : 'missed'), fixed, text: c.title });
      const type = c.type;
      if (c.kind === 'opportunity') {
        if (fixed) scienceBonus += (c.bonus || 0.1) * 100;
        return;
      }
      if (type === 'solarStorm') {
        if (fixed) instOffUntil = Math.max(instOffUntil, step + nOrb);
        else {
          panelMult *= 0.9;
          dose += d.hardness * 0.18;
          instOffUntil = Math.max(instOffUntil, step + 2 * nOrb);
          if (!d.coding.robust) linkOffUntil = Math.max(linkOffUntil, step + 2 * nOrb);
        }
      } else if (type === 'batteryCell') {
        if (fixed) {
          batteryMult *= 0.92;
          instOffUntil = Math.max(instOffUntil, step + nOrb);
        } else batteryMult *= 0.68;
        batteryWh = Math.min(batteryWh, capacityWh * batteryMult);
      } else if (type === 'wheelSat') {
        if (fixed) fuelKg *= 0.98;
        else {
          pointHoldUntil = Math.max(pointHoldUntil, step + 5 * nOrb);
          fuelKg *= 0.96;
        }
      } else if (type === 'dataFlood') {
        if (fixed) linkOffUntil = Math.min(linkOffUntil, step);
        else dataFloodUntil = Math.max(dataFloodUntil, step + 2 * nOrb);
      } else if (type === 'fuelLeak') {
        if (fixed) fuelKg *= 0.97;
        else fuelKg *= 0.68;
      } else if (type === 'antennaGlitch') {
        linkOffUntil = Math.max(linkOffUntil, step + (fixed ? nOrb : 4 * nOrb));
      } else if (type === 'computerFault') {
        if (fixed) {
          if (d.comp.redundancy < 2) instOffUntil = Math.max(instOffUntil, step + nOrb);
        } else {
          if (d.comp.redundancy < 2) {
            buffer.forEach((_, i) => (buffer[i] = 0));
            instOffUntil = Math.max(instOffUntil, step + 3 * nOrb);
            if (dose > d.hardness * 0.5) markDead('computer', step);
          } else instOffUntil = Math.max(instOffUntil, step + nOrb);
        }
      }
    }
  }

  function dutyGateSun(stepInOrbit, d, inst) {
    // Sun-needing instruments run in the sunlit part, for duty share of the orbit.
    const sunlitStart = Math.ceil(d.orb.eclipse * STEPS_PER_ORBIT);
    const onSteps = Math.round(d.onFraction(inst) * STEPS_PER_ORBIT);
    return stepInOrbit - sunlitStart >= 0 && stepInOrbit - sunlitStart < onSteps;
  }

  function rangeNow(d, missionFrac, phase) {
    const sc = d.sc;
    if (!sc.range) return d.rangeAU;
    const lifeDays = d.lifeYears * 365.25;
    const a = 2 * Math.PI * ((missionFrac * lifeDays) / sc.range.periodDays + phase);
    return Math.max(0.05, sc.range.base + sc.range.amp * Math.cos(a));
  }

  // Share of this step when the link to Earth is up.
  function visibility(d, step, dtDay) {
    const pass = d.o.passes || {};
    if (pass.continuous) return 1;
    if (pass.dsn) {
      const hours = Math.min(24, d.ground.stations * pass.hours);
      const stepH = dtDay * 24;
      if (stepH >= 3) return (hours / 24) * (1 - pass.occult);
      const hourNow = ((step * dtDay) % 1) * 24;
      return hourNow < hours ? 1 - pass.occult : 0;
    }
    const perDay = d.ground.stations * pass.perStation;
    const intervalSec = 86400 / perDay;
    const passSec = pass.passMin * 60;
    const stepSec = dtDay * 86400;
    const t0 = step * stepSec;
    const t1 = t0 + stepSec;
    let covered = 0;
    for (let k = Math.floor(t0 / intervalSec); k * intervalSec < t1; k++) {
      const a = Math.max(k * intervalSec, t0);
      const b = Math.min(k * intervalSec + passSec, t1);
      if (b > a) covered += b - a;
    }
    return clamp(covered / stepSec, 0, 1);
  }

  // ---------- Score ----------
  function score(design, flight, teamStats, surfaceSummary) {
    const d = derive(design);
    const r = flight.result;
    const ts = teamStats || {};
    const ss = normalizeSurface(surfaceSummary);
    const scienceFromFlight = clamp(r.science / 100, 0, 1.15);
    let scienceBase = scienceFromFlight;
    let science;
    if (ss) {
      // Surface missions: the data you sent home counts too.
      const surfaceFrac = clamp(ss.scienceFrac, 0, 1);
      scienceBase = 0.55 * Math.min(1, scienceFromFlight) + 0.45 * surfaceFrac;
      science = Math.round(400 * Math.min(1, scienceBase));
    } else {
      science = Math.round(400 * Math.min(1, scienceFromFlight));
    }
    let budgetFrac = 0;
    if (d.budget !== null) budgetFrac = clamp((d.budget - d.costM) / (d.budget * 0.3), 0, 1);
    else budgetFrac = 0.5;
    const massFrac = clamp((d.capacity - d.wet) / (d.capacity * 0.25), 0, 1);
    const lostFrac = clamp(r.lostFrac, 0, 1);
    const eff = Math.round(100 * budgetFrac + 60 * massFrac + 40 * (1 - lostFrac));
    const efficiency = d.budget !== null && d.costM > d.budget ? Math.round(eff * 0.3) : eff;

    const lifeFrac = clamp(r.lifeFraction, 0, 1);
    let survival = Math.round(120 * lifeFrac + (r.alive ? 80 : 0));
    if (ss) {
      const crewFrac = ss.crewTotal > 0 ? clamp(ss.survivors / ss.crewTotal, 0, 1) : 0;
      survival = Math.round(80 * lifeFrac + 120 * crewFrac);
    }
    // Teamwork
    const reqSent = ts.requestsSent || 0;
    const reqAns = ts.requestsAnswered || 0;
    const reqPart = reqSent > 0 ? clamp(reqAns / reqSent, 0, 1) : 0.5;
    const crisesTotal = ts.crisesTotal !== undefined ? ts.crisesTotal : r.crisesTotal;
    const crisesFixed = ts.crisesFixed !== undefined ? ts.crisesFixed : r.crisesFixed;
    const crisisPart = crisesTotal > 0 ? clamp(crisesFixed / crisesTotal, 0, 1) : 0.5;
    let agendaPart = 0.5;
    let agendaList = ts.agendas;
    let agendasMet = 0;
    if (agendaList && agendaList.length) {
      agendasMet = agendaList.filter((a) => agendaMet(a, design, flight)).length;
      agendaPart = agendasMet / agendaList.length;
    }
    const teamwork = Math.round(60 * reqPart + 90 * crisisPart + 50 * agendaPart);
    const total = science + efficiency + survival + teamwork;
    const medal = total >= 850 ? 'gold' : total >= 650 ? 'silver' : total >= 420 ? 'bronze' : 'none';
    return {
      total,
      science,
      efficiency,
      survival,
      teamwork,
      medal,
      medalTitle: T(`medal.${medal}`),
      details: { sciencePct: r.science, agendasMet, agendasTotal: agendaList ? agendaList.length : 0, crisesFixed, crisesTotal, costM: round(d.costM, 1), budgetM: d.budget === null ? null : round(d.budget, 0), massMarginKg: Math.round(d.capacity - d.wet), lifeFrac: round(lifeFrac, 3), surface: ss || null },
    };
  }

  // Tolerant reader for SMD.team.surface.summary(state).
  function normalizeSurface(ss) {
    if (!ss) return null;
    const outcome = ss.outcome || null;
    const crewTotal = num(ss.crewTotal, num(ss.crew, 4));
    let survivors = num(ss.survivors, num(ss.aboard, num(ss.crewHome, null)));
    if (survivors === null) survivors = outcome === 'extracted' ? crewTotal : 0;
    let scienceFrac = num(ss.scienceFrac, num(ss.scienceFraction, null));
    if (scienceFrac === null) {
      const sent = num(ss.valueSent, num(ss.scienceValueSent, num(ss.gbitSent, num(ss.dataSentGbit, null))));
      const total = num(ss.valueTotal, num(ss.scienceValueTotal, num(ss.gbitTotal, null)));
      scienceFrac = sent !== null && total ? sent / total : outcome === 'extracted' ? 0.6 : 0.2;
    }
    return {
      outcome,
      crewTotal,
      survivors,
      scienceFrac,
      gbitSent: num(ss.gbitSent, num(ss.dataSentGbit, 0)),
      setsLost: num(ss.setsLost, num(ss.dataSetsLost, 0)),
      setsTotal: num(ss.setsTotal, num(ss.dataSets, 0)),
      overrunWave: num(ss.overrunWave, num(ss.dishOverrunWave, null)),
      cause: ss.cause || ss.primaryCause || null,
      baseDark: !!(ss.baseDark || ss.wentDark),
      samplesKg: num(ss.samplesKg, num(ss.samplesCollectedKg, 0)),
      samplesLeftKg: num(ss.samplesLeftKg, num(ss.jettisonedKg, 0)),
      liftKg: num(ss.liftKg, null),
      o2LeftS: num(ss.o2LeftS, num(ss.oxygenLeftS, null)),
      raw: ss,
    };
  }
  function num(v, fallback) {
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  // ---------- Agendas ----------
  const UNDER_BUDGET_PCT = { cadet: 80, engineer: 85, director: 90, sandbox: 80 };

  // Goals the balance runs could not meet at all (docs/TEAM-BALANCE.md): never deal one.
  const AGENDA_IMPOSSIBLE = {
    no_spill: { mars: ['engineer', 'director'] },
    power_margin: { europa: ['engineer'] },
    battery_safe: { europa: ['engineer'] },
  };
  function agendas(seed, roles, difficulty, scenarioId) {
    const rs = roles && roles.length ? roles : ROLES;
    const rng = rngOf(`${seed}:agendas`);
    const fair = (a) => !((AGENDA_IMPOSSIBLE[a.id] || {})[scenarioId] || []).includes(difficulty);
    return rs.flatMap((role) => {
      const pool = AGENDAS.filter((a) => a.role === role && fair(a));
      if (!pool.length) return [];
      const a = pool[Math.floor(rng() * pool.length)];
      return [{ role, id: a.id, title: t(`agenda.${a.id}.title`, a.title), text: t(`agenda.${a.id}.text`, a.text, { pct: UNDER_BUDGET_PCT[difficulty] || 80 }), conflictsWith: a.conflictsWith, pct: a.id === 'under_budget' ? UNDER_BUDGET_PCT[difficulty] || 80 : undefined }];
    });
  }

  function agendaMet(agenda, design, flight) {
    const d = derive(design);
    const r = flight.result;
    switch (agenda.id) {
      case 'many_instruments': return (design.picks.instruments || []).length >= 3;
      case 'full_duty': return design.picks.duty === 'd90';
      case 'power_margin': return powerBudget(d).marginPct >= 20;
      case 'battery_safe': return r.minBattery >= 0.4;
      case 'two_stations': return d.ground.stations >= 2;
      case 'no_spill': return r.overflowGbit <= 0.5;
      case 'under_budget': return d.costM <= (agenda.pct || UNDER_BUDGET_PCT[d.diff.id] || 80) / 100 * (d.budget === null ? d.sc.budgetM : d.budget);
      case 'lean_rocket': return smallestRocket(d) === d.launcher.id;
      default: return false;
    }
  }
  function smallestRocket(d) {
    const list = allowedOptions(d.sc, d.diff, 'launcher');
    for (const l of list) {
      const test = capacityTo(l, d.o, d.sc, d.route);
      if (d.wet <= test) return l.id;
    }
    return list[list.length - 1].id;
  }

  // ---------- Encoding ----------
  function b64encode(s) {
    if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
    return btoa(unescape(encodeURIComponent(s)));
  }
  function b64decode(s) {
    if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64').toString('utf8');
    return decodeURIComponent(escape(atob(s)));
  }
  function encode(obj) {
    return b64encode(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(str) {
    try {
      const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      return JSON.parse(b64decode(padded));
    } catch (e) {
      return null;
    }
  }

  // ---------- Single-change search ----------
  function isFlyable(design) {
    return checks(design).filter((c) => c.hard).every((c) => c.ok);
  }
  function neutralScore(design, seed, outcomes) {
    const flight = fly(design, seed, outcomes);
    return { flight, sc: score(design, flight, null) };
  }

  function candidates(design) {
    const sc = scenarioOf(design.scenario);
    const diff = difficultyOf(design.difficulty) || difficultyOf('engineer');
    const out = [];
    activeKeys(sc).forEach((key) => {
      const role = KEY_ROLE[key];
      const list = allowedOptions(sc, diff, key);
      if (key === 'instruments') {
        const cur = design.picks[key] || [];
        list.forEach((o) => {
          const n = set(design, role, key, o.id);
          if (!n.error) out.push({ key, role, value: o.id, design: n });
        });
        return;
      }
      list.forEach((o) => {
        if (o.id === design.picks[key]) return;
        const n = set(design, role, key, o.id);
        if (!n.error) out.push({ key, role, value: o.id, design: n });
      });
    });
    return out;
  }

  function nameOf(design, key, value) {
    const sc = scenarioOf(design.scenario);
    if (Array.isArray(value)) return value.map((v) => nameOf(design, key, v)).join(', ');
    const o = optionsFor(sc, key).find((x) => x.id === value);
    return o ? optionName(sc, key, o) : String(value);
  }

  // The one change the debrief offers: only choices the players can see on a
  // build step (a step's option, or one instrument in or out), so "Fly again
  // with this change" lands on a card they recognise.
  function stepCandidates(design) {
    const out = [];
    buildSteps(design.scenario, design.difficulty).forEach((st) => {
      const cur = stepChoice(design, st);
      st.options.forEach((o) => {
        if (!st.multi && o.id === cur) return;
        const n = applyStep(design, st.id, o.id);
        if (!n || n.error) return;
        const key = st.keys.find((k) => JSON.stringify(n.picks[k]) !== JSON.stringify(design.picks[k])) || st.keys[0];
        out.push({ step: st, option: o, key, role: KEY_ROLE[key] || st.role, value: n.picks[key], design: n });
      });
    });
    return out;
  }

  function stepPickName(design, st, picks) {
    if (st.multi) return nameOf(design, 'instruments', (picks.instruments || []).filter((id) => st.options.some((o) => o.id === id)));
    const hit = st.options.find((o) => Object.keys(o.picks).every((k) => picks[k] === o.picks[k]));
    if (hit) return hit.name;
    return st.keys.map((k) => nameOf(design, k, picks[k])).join(', ');
  }

  // Instruments read as "add" or "leave at home"; every other step as "try X instead of Y".
  function bestText(design, st, next, fromName, toName) {
    if (st.multi) {
      const was = design.picks.instruments || [];
      const now = next.picks.instruments || [];
      const added = now.filter((id) => !was.includes(id));
      const removed = was.filter((id) => !now.includes(id));
      if (added.length && !removed.length) return T('best.add', { step: st.title, name: nameOf(design, 'instruments', added) });
      if (removed.length && !added.length) return T('best.drop', { step: st.title, name: nameOf(design, 'instruments', removed) });
    }
    return T('best.step', { step: st.title, from: fromName, to: toName });
  }

  function bestChange(design, seed, outcomes) {
    const base = neutralScore(design, seed, outcomes);
    let best = null;
    stepCandidates(design).forEach((c) => {
      if (!isFlyable(c.design)) return;
      const alt = neutralScore(c.design, seed, outcomes);
      const gain = alt.sc.total - base.sc.total;
      if (gain > 0 && (!best || gain > best.gain)) best = { ...c, gain, altScience: alt.flight.result.science };
    });
    if (!best) return null;
    const st = best.step;
    const from = design.picks[best.key];
    const fromName = stepPickName(design, st, design.picks);
    const toName = stepPickName(best.design, st, best.design.picks);
    return {
      role: best.role, key: best.key, from, to: best.value, value: best.value, fromName, toName, gain: best.gain,
      step: st.id, stepTitle: st.title, option: best.option.id,
      change: { step: st.id, option: best.option.id, role: best.role, key: best.key, value: best.value },
      text: bestText(design, st, best.design, fromName, toName),
      why: T('best.why', { gain: best.gain }),
      design: best.design,
    };
  }

  // ---------- Consequence chain ----------
  const SHOWN_DELTA = 3;

  // Which single decision, when reverted, helps the most? Re-flies each alternative.
  function findCulprit(design, seed, outcomes, base) {
    let best = null;
    // Only choices the players made on a build step: a part they never saw (duty cycle,
    // ground stations...) cannot be the root of their story.
    stepCandidates(design).forEach((c) => {
      if (!isFlyable(c.design)) return;
      const alt = neutralScore(c.design, seed, outcomes);
      const gain = alt.sc.total - base.sc.total;
      if (!best || gain > best.gain) best = { ...c, gain, alt, altScience: alt.flight.result.science };
    });
    return best;
  }

  function causeName(design, key) {
    return T(`cause.${key}`);
  }

  function chain(design, seed, surfaceSummary, outcomes) {
    const base = neutralScore(design, seed, outcomes);
    const flight = base.flight;
    const r = flight.result;
    const d = derive(design);
    const ss = normalizeSurface(surfaceSummary);
    const steps = [];
    const culprit = findCulprit(design, seed, outcomes, base);
    const hasRoot = culprit && culprit.gain > 0;

    if (hasRoot) rootSteps(steps, design, d, culprit);

    // What actually went wrong, with numbers from the flight.
    if (r.cause === 'power' || r.brownouts > 0) {
      const covered = clamp(d.bat.wh / Math.max(1, d.eclipseWh), 0, 1);
      steps.push({ kind: 'power', text: T('chain.power', { pct: Math.round(covered * 100) }), why: T('chain.why.power', { mins: Math.round(d.orb.periodMin * d.orb.eclipse) }), delta: Math.round(d.bat.wh - d.eclipseWh) });
      const ev = flight.events.find((e) => e.kind === 'brownout');
      if (ev) steps.push({ kind: 'power', text: T('chain.brownout', { orbit: ev.orbit + 1 }), why: T('chain.why.brownout'), delta: -r.brownouts });
    }
    if (r.cause === 'radiation') steps.push({ kind: 'radiation', text: T('chain.radiation', { dose: Math.round(r.doseKrad), shield: Math.round(r.hardnessKrad) }), why: T('chain.why.radiation'), delta: Math.round(r.doseKrad - r.hardnessKrad) });
    if (r.cause === 'drag' || r.cause === 'attitude') steps.push({ kind: 'fuel', text: T('chain.fuel', { days: Math.round((1 - r.lifeFraction) * d.lifeYears * 365) }), why: T('chain.why.fuel'), delta: -Math.round((1 - r.lifeFraction) * d.lifeYears * 365) });
    if (r.primaryLoss === 'overflow') steps.push({ kind: 'data', text: T('chain.overflow', { lost: fmt(r.overflowGbit) }), why: T('chain.why.overflow'), delta: -Math.round(r.overflowGbit) });
    if (r.primaryLoss === 'overflow' || r.primaryLoss === 'comms') {
      if (d.genGbitDay > d.downGbitDay) steps.push({ kind: 'comms', text: T('chain.data.gen', { gen: round(d.genGbitDay, 1), cap: round(d.downGbitDay, 1) }), why: T('chain.why.data', { dist: distText(d) }), delta: round(d.downGbitDay - d.genGbitDay, 1) });
      steps.push({ kind: 'data', text: T('chain.lostfrac', { pct: Math.round(r.lostFrac * 100) }), why: T('chain.why.lostfrac'), delta: -Math.round(r.lostFrac * 100) });
    }
    flight.crises.forEach((c) => {
      if (c.kind === 'crisis' && !(outcomes && OUTCOME_FIX[outcomes[c.id]])) {
        const ev = flight.events.find((e) => e.id === c.id);
        if (ev && steps.length < 7) steps.push({ kind: 'crisis', text: T('chain.crisis', { title: c.title }), why: T('chain.why.crisis'), delta: -1, role: c.role, fixRole: c.fixRole });
      }
    });

    if (r.cause) steps.push({ kind: 'failure', text: T('chain.death', { cause: T(`cause.${r.cause}`) }), why: T('chain.why.death'), delta: -Math.round((1 - r.lifeFraction) * 100), cause: r.cause });

    if (ss) surfaceSteps(steps, design, d, ss);

    steps.push({ kind: 'science', text: T('chain.science', { sci: Math.round(r.science) }), why: T('chain.why.science'), delta: Math.round(r.science) });
    if (hasRoot) {
      const altName = culprit.step ? stepPickName(culprit.design, culprit.step, culprit.design.picks) : nameOf(design, culprit.key, culprit.value);
      steps.push({
        kind: 'revert', text: T('chain.gain', { alt: altName, sci: Math.round(culprit.alt.flight.result.science), delta: signed(Math.round(culprit.alt.flight.result.science - r.science)) }), why: T('chain.why.gain'), delta: culprit.gain, key: culprit.key, value: culprit.value,
      });
    }
    return steps;
  }

  const signed = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x)}`;
  const distText = (d) => (d.sc.linkMode === 'near' ? `${fmt(d.o.rangeKm || 1500)} km to the ground` : `${d.rangeAU.toFixed(2)} AU from Earth`);

  function rootSteps(steps, design, d, culprit) {
    const altD = derive(culprit.design);
    altD._req = design.requirement;
    const key = culprit.key;
    const st = culprit.step;
    const name = st ? stepPickName(design, st, design.picks) : nameOf(design, key, design.picks[key]);
    const altName = st ? stepPickName(culprit.design, st, culprit.design.picks) : nameOf(design, key, culprit.value);
    const dMass = d.wet - altD.wet;
    const dCost = d.costM - altD.costM;
    // Plain words, and only the differences that are really there.
    const diff = [];
    if (Math.abs(dMass) >= SHOWN_DELTA) diff.push(T(dMass > 0 ? 'chain.diff.heavier' : 'chain.diff.lighter', { n: fmt(Math.round(Math.abs(dMass))) }));
    if (Math.abs(dCost) >= 1) diff.push(T(dCost > 0 ? 'chain.diff.dearer' : 'chain.diff.cheaper', { n: fmt(Math.round(Math.abs(dCost))) }));
    let text;
    if (st && st.multi) {
      const was = design.picks.instruments || [];
      const now = culprit.design.picks.instruments || [];
      const added = now.filter((id) => !was.includes(id));
      const removed = was.filter((id) => !now.includes(id));
      text = added.length && !removed.length ? T('chain.root.without', { name: nameOf(design, 'instruments', added) }) : removed.length && !added.length ? T('chain.root.took', { name: nameOf(design, 'instruments', removed) }) : T('chain.root.plain', { name, alt: altName });
    } else text = T('chain.root.plain', { name, alt: altName });
    if (diff.length) text = T('chain.root.with', { text, diff: diff.join(T('chain.diff.and')) });
    steps.push({ kind: 'decision', text, why: T('chain.why.mass'), delta: Math.round(dMass), key, role: culprit.role, value: culprit.value });
    const dProp = d.prop - altD.prop;
    if (Math.abs(dProp) >= SHOWN_DELTA) steps.push({ kind: 'fuel', text: T('chain.prop', { sign: dProp >= 0 ? '+' : '−', kg: fmt(Math.abs(dProp)) }), why: T('chain.why.prop'), delta: Math.round(dProp) });
    const small = smallestRocket(d);
    const altSmall = smallestRocket(altD);
    if (small !== altSmall) {
      const lA = LAUNCHERS.find((x) => x.id === small);
      const lB = LAUNCHERS.find((x) => x.id === altSmall);
      steps.push({ kind: 'launcher', text: T('chain.launcher', { to: optionName(d.sc, 'launcher', lA), sign: '+', cost: lA.costM - lB.costM }), why: T('chain.why.launcher'), delta: lA.costM - lB.costM });
    }
    if (d.budget !== null) {
      const left = d.budget - d.costM;
      if (left < 0) steps.push({ kind: 'budget', text: T('chain.budget', { left: Math.round(left), part: altName }), why: T('chain.why.budget'), delta: Math.round(left) });
    }
  }

  const SURFACE_PART_KEY = { battery: 'batteries', solar: 'panels', radio: 'radio', antenna: 'antenna', dish: 'antenna', recorder: 'recorder', instruments: 'instruments', fuel: 'ascent', spareO2: 'oxygen', orbit: 'orbit', time: 'lifetime' };

  function surfaceRoot(steps, design, d, part) {
    const key = SURFACE_PART_KEY[part];
    if (!key) return;
    const role = KEY_ROLE[key];
    if (!role || design.picks[key] === undefined) return;
    if (Array.isArray(design.picks[key])) return;
    const options = allowedOptions(d.sc, d.diff, key);
    const cur = options.find((o) => o.id === design.picks[key]);
    if (!cur) return;
    const idx = options.indexOf(cur);
    const alt = options[idx + 1];
    if (!alt) return;
    const n = set(design, role, key, alt.id);
    if (n.error) return;
    const altD = derive(n);
    const kg = Math.round(altD.partsMass - d.partsMass);
    steps.push({ kind: 'surface', text: T('chain.surface.root', { name: optionName(d.sc, key, cur), alt: optionName(d.sc, key, alt), kg: Math.abs(kg) }), why: T('chain.why.surface.root'), delta: kg, key, role, value: alt.id });
  }

  function surfaceSteps(steps, design, d, ss) {
    const facts = (ss.raw && ss.raw.facts) || [];
    const bad = facts.filter((f) => f.kind === 'bad');
    const cause = surfaceCause(ss);
    if (bad.length) {
      surfaceRoot(steps, design, d, bad[0].part);
      bad.slice(0, 4).forEach((f) => steps.push({ kind: 'surface', text: f.text, why: f.why || T('chain.why.death'), delta: -Math.round(f.value || 1), part: f.part, factId: f.id }));
      if (cause === 'crew_lost' || cause === 'base_dark') steps.push({ kind: 'surface', text: T('chain.surface.eaten', { where: whereText(ss) }), why: T('chain.why.surface.overrun'), delta: -Math.max(1, ss.crewTotal - ss.survivors) });
      return;
    }
    if (ss.setsLost > 0 || cause === 'data_left') {
      const best = bestSurfaceRate(design, d);
      if (best) {
        steps.push({ kind: 'surface', text: T('chain.surface.radio', { kg: Math.abs(best.massKg) }), why: T('chain.why.uplink'), delta: best.massKg });
        steps.push({ kind: 'surface', text: T('chain.surface.uplink', { pct: Math.round(best.slowerPct) }), why: T('chain.why.uplink'), delta: -Math.round(best.slowerPct) });
      }
      if (ss.overrunWave) steps.push({ kind: 'surface', text: T('chain.surface.overrun', { wave: ss.overrunWave }), why: T('chain.why.surface.overrun'), delta: ss.overrunWave });
      if (ss.setsLost) steps.push({ kind: 'surface', text: T('chain.surface.lost', { sets: ss.setsLost }), why: T('chain.why.surface.overrun'), delta: -ss.setsLost });
    }
    if (cause === 'base_dark') steps.push({ kind: 'surface', text: T('chain.surface.dark'), why: T('chain.why.surface.dark'), delta: Math.round(d.bat.wh) });
    else if (cause === 'oxygen') steps.push({ kind: 'surface', text: T('chain.surface.oxygen', { sec: ss.o2LeftS !== null ? Math.round(ss.o2LeftS) : 0 }), why: T('chain.why.surface.oxygen'), delta: -1 });
    else if (cause === 'stranded') {
      steps.push({ kind: 'surface', text: T('chain.surface.ascent', { lift: Math.round(ss.liftKg !== null ? ss.liftKg : 0), have: Math.round(ss.samplesKg) }), why: T('chain.why.surface.ascent'), delta: -Math.round(ss.samplesLeftKg) });
      if (ss.samplesLeftKg) steps.push({ kind: 'surface', text: T('chain.surface.dropped', { kg: Math.round(ss.samplesLeftKg) }), why: T('chain.why.surface.ascent'), delta: -Math.round(ss.samplesLeftKg) });
    } else if (cause === 'crew_lost') {
      steps.push({ kind: 'surface', text: T('chain.surface.eaten', { where: whereText(ss) }), why: T('chain.why.surface.overrun'), delta: -Math.max(1, ss.crewTotal - ss.survivors) });
    }
  }

  const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];
  function whereText(ss) {
    if (ss.overrunWave) return `${ORDINALS[ss.overrunWave - 1] || 'last'} uplink`;
    return 'landing site';
  }

  function surfaceCause(ss) {
    if (ss.cause) {
      const key = String(ss.cause);
      if (['oxygen', 'stranded', 'base_dark', 'data_left', 'crew_lost'].includes(key)) return key;
    }
    if (ss.outcome === 'stranded') return 'stranded';
    if (ss.outcome === 'wiped' || ss.outcome === 'hull_lost') return ss.baseDark ? 'base_dark' : ss.o2LeftS === 0 ? 'oxygen' : 'crew_lost';
    if (ss.setsLost > 0) return 'data_left';
    return null;
  }

  function bestSurfaceRate(design, d) {
    // Which radio/antenna upgrade would most speed the uplink? Reports the kg saved by the cut.
    const sc = d.sc;
    const candidateKeys = ['radio', 'antenna'];
    let best = null;
    candidateKeys.forEach((key) => {
      const role = KEY_ROLE[key];
      allowedOptions(sc, d.diff, key).forEach((o) => {
        if (o.id === design.picks[key]) return;
        const n = set(design, role, key, o.id);
        if (n.error) return;
        const altD = derive(n);
        if (altD.rateMbps <= d.rateMbps * 1.02) return;
        const slowerPct = 100 * (1 - d.rateMbps / altD.rateMbps);
        if (!best || slowerPct > best.slowerPct) best = { key, massKg: Math.round(altD.partsMass - d.partsMass), slowerPct };
      });
    });
    return best;
  }

  // ---------- Obituary ----------
  function obituary(design, flight, surfaceSummary) {
    const r = flight && flight.result;
    const ss = normalizeSurface(surfaceSummary);
    const sCause = ss ? surfaceCause(ss) : null;
    const crewLost = ss && ss.survivors < ss.crewTotal;
    const hasCause = (r && (r.cause || !r.alive)) || (sCause && (crewLost || ss.outcome !== 'extracted'));
    if (!hasCause) return null;
    const sc = scenarioOf(design.scenario);
    const name = design.name || t(`scn.${sc.id}.title`, sc.title);
    let key;
    let isCrew = false;
    if (sCause && (crewLost || !r.cause)) {
      key = sCause === 'crew_lost' ? 'crew_lost' : sCause;
      isCrew = true;
    } else {
      key = (r && r.cause) || 'silence';
      if (!ANALOGS[key] && !EPITAPHS[key]) key = 'silence';
    }
    const analog = SURFACE_ANALOGS[key] || ANALOGS[key] || ANALOGS.silence;
    const list = EPITAPHS[key] || EPITAPHS.silence;
    const seedish = hash(encode(design.picks));
    const idx = seedish % list.length;
    const where = ss ? whereText(ss) : 'landing site';
    const whenDays = r ? r.lifeDays : 0;
    const epitaphKey = `epitaph.${key}.${idx}`;
    const epitaph = t(epitaphKey, list[idx], { where, survivors: ss ? ss.survivors : 0, when: `${whenDays} days in`, name });
    return {
      title: isCrew ? T('obit.crew', { name }) : T('obit.title', { name }),
      cause: isCrew ? T(`cause.${key}`) : T(`cause.${r.cause || 'overflow'}`),
      causeId: key,
      crew: isCrew,
      epitaph,
      analog: { mission: analog.mission, year: analog.year, story: t(`analog.${key}.story`, analog.story), source: analog.source },
    };
  }

  // ---------- Surface loadout ----------
  function surfaceLoadout(design) {
    const sc = scenarioOf(design.scenario);
    if (!sc || !sc.surface) return null;
    const d = derive(design);
    const p = design.picks;
    const surf = sc.surface;
    // No combat gear any more (TEAM-V2). The drill stays because it pulls ice cores;
    // the old fields stay, empty, so older surface code keeps working.
    const drill = pickObj(sc, 'drill', p.drill);
    const weapons = drill && drill.id !== 'none' ? ['drill'] : [];
    const oxygen = pickObj(sc, 'oxygen', p.oxygen);
    const ascent = pickObj(sc, 'ascent', p.ascent);
    const panel = d.panel;
    const solarW1AU = panel.rtg ? 0 : Math.round(panel.areaM2 * P.solarFlux(1) * panel.eff);
    const instruments = d.insts.map((i) => {
      const f = SCAN_FITS[i.id] || { fits: [], rate: 1, value: 1 };
      return { id: i.id, name: nameOf(design, 'instruments', i.id), fits: f.fits, rate: f.rate, value: f.value };
    });
    const win = UPLINK_WINDOWS[`${sc.id}.${d.o.id}`] || { everyS: 80, windowS: 30, firstS: 55, label: 'relay' };
    // Uplink speed: real link rate relative to a mid design at this destination.
    const ref = refUplinkMbps(d);
    const rateGbitS = round(clamp(5 * Math.sqrt(d.rateMbps / Math.max(1e-6, ref)), 0.8, 20), 2);
    const landing = d.o.landing || { accuracyM: 200, siteFactor: 1, access: 'rock', zone: 'plains' };
    const offsetM = Math.round((landing.accuracyM / 40) * landing.siteFactor);
    const inRange = landingInRange(sc, d.o);
    const lifeBonus = (d.lifeYears >= 4 ? 45 : d.lifeYears >= 2 ? 25 : 0);
    const radiationPenalty = d.radLifeYears < d.lifeYears ? 60 : d.radLifeYears < d.lifeYears * 1.5 ? 25 : 0;
    const lifetimeS = clamp(surf.lifetimeS + lifeBonus + 45 * (oxygen.spareO2 || 0) - radiationPenalty, 150, 360);
    const dvKms = surf.ascentDvKms;
    const massRatio = Math.exp(dvKms / (ISP * G0));
    const liftKg = Math.round((ascent.extraKg || 0) / Math.max(0.01, massRatio - 1));
    return {
      world: surf.world,
      objective: surf.objective,
      platform: surf.platform,
      weapons,
      turrets: 0,
      rover: false,
      roverKind: 'none',
      drones: 0,
      spareO2: oxygen ? oxygen.spareO2 : 0,
      medkits: 0,
      drill: drill ? { id: drill.id, depthM: drill.depthM, speed: drill.speed, damage: drill.damage } : null,
      power: { solarW: solarW1AU, batteryWh: d.bat.wh, rtgW: d.rtgW },
      instruments,
      recorderGbit: d.rec.gbit,
      uplink: { rateGbitS, everyS: win.everyS, windowS: win.windowS, firstS: win.firstS, label: win.label, realMbps: round(d.rateMbps, 3) },
      landing: { offsetM, inRange, zone: landing.zone, accuracyM: landing.accuracyM },
      lifetimeS,
      ascent: { liftKg, extraFuelKg: ascent.extraKg || 0, dvKms, massRatio: round(massRatio, 2) },
      parts: {
        radio: nameOf(design, 'radio', p.radio),
        antenna: nameOf(design, 'antenna', p.antenna),
        battery: nameOf(design, 'batteries', p.batteries),
        solar: nameOf(design, 'panels', p.panels),
        recorder: nameOf(design, 'recorder', p.recorder),
        orbit: nameOf(design, 'orbit', p.orbit),
        ascent: nameOf(design, 'ascent', p.ascent),
      },
      given: T('surface.given'),
      platformNote: surf.platform === 'floating' ? T('surface.platform.floating') : null,
    };
  }
  function refUplinkMbps(d) {
    const sc = d.sc;
    const dist = sc.rangeAU || (sc.range ? sc.range.base : 1);
    return Math.min(400, (GD_K * 50 * 4) / (dist * dist));
  }
  function landingInRange(sc, o) {
    const access = (o.landing && o.landing.access) || '';
    const objective = sc.surface.objective;
    if (objective === 'ice') return access === 'ice';
    if (objective === 'atmosphere') return access === 'cloud';
    if (objective === 'organic') return access === 'plume';
    return true;
  }

  // ---------- The build, one component per step (docs/TEAM-V2.md) ----------
  // buildSteps(sc, diff) -> the ordered steps, each with at most three choices.
  // A choice is { id, name, note, picks:{ key: optionId } }; packs set several keys.
  // stepCards(design, stepId) adds plain pros and cons worked out from the real numbers.
  const SIZE = {
    panels: (o, sc) => (o.rtg ? 1e6 + o.watts : panelWatts(o, sc)),
    batteries: (o) => o.wh,
    recorder: (o) => o.gbit,
    launcher: (o) => o.leo,
    lifetime: (o) => o.years,
    antenna: (o) => o.diaM,
    ascent: (o) => o.extraKg,
  };
  function stepTier(diff) {
    return Math.max(1, Math.min(3, diff.tier || 2));
  }
  function resolvePick(sc, diff, key, id) {
    const all = optionsFor(sc, key);
    const allowed = allowedOptions(sc, diff, key);
    if (allowed.some((o) => o.id === id)) return id;
    const at = all.findIndex((o) => o.id === id);
    if (at < 0 || !allowed.length) return allowed.length ? allowed[0].id : undefined;
    let best = allowed[0].id;
    let gap = Infinity;
    allowed.forEach((o) => {
      const g = Math.abs(all.indexOf(o) - at);
      if (g < gap) {
        gap = g;
        best = o.id;
      }
    });
    return best;
  }
  // Three choices around the sensible default: one smaller, one bigger.
  function threeOf(sc, diff, key) {
    const list = allowedOptions(sc, diff, key);
    if (list.length <= 3) return list;
    const start = defaultValue(sc, diff, key);
    const size = SIZE[key];
    if (!size) {
      const rest = list.filter((o) => o.id !== start).sort((a, b) => (a.tier || 1) - (b.tier || 1));
      const keep = new Set([start].concat(rest.slice(0, 2).map((o) => o.id)));
      return list.filter((o) => keep.has(o.id));
    }
    const sorted = list.slice().sort((a, b) => size(a, sc) - size(b, sc));
    const i = Math.max(0, sorted.findIndex((o) => o.id === start));
    const lo = Math.max(0, Math.min(i - 1, sorted.length - 3));
    return sorted.slice(lo, lo + 3);
  }
  function instrumentChoices(sc, diff) {
    const list = allowedOptions(sc, diff, 'instruments');
    if (list.length <= 3) return list;
    const start = defaultValue(sc, diff, 'instruments');
    const ranked = list.slice().sort((a, b) => scienceValue(sc, b.id) - scienceValue(sc, a.id));
    const keep = ranked.slice(0, 3).map((o) => o.id);
    start.forEach((id) => {
      if (keep.includes(id)) return;
      const out = keep.slice().reverse().find((k) => !start.includes(k));
      if (out) keep[keep.indexOf(out)] = id;
    });
    return list.filter((o) => keep.includes(o.id));
  }
  function stepsFor(sc, diff) {
    const keys = activeKeys(sc);
    const tier = stepTier(diff);
    return TD.BUILD_STEPS.filter((st) => st.tier <= tier && (!st.landing || sc.surface) && st.keys.every((k) => keys.includes(k)));
  }
  function buildSteps(scenarioId, difficulty) {
    const sc = scenarioOf(scenarioId);
    if (!sc) return [];
    const diff = difficultyOf(difficulty) || difficultyOf('engineer');
    return stepsFor(sc, diff).map((st) => {
      const out = { id: st.id, title: t(`step.${st.id}.title`, st.title), ask: t(`step.${st.id}.ask`, st.ask), role: st.role, keys: st.keys.slice(), res: st.res.slice(), multi: !!st.multi };
      if (st.multi) {
        out.max = INSTRUMENT_MAX[diff.id] || 3;
        out.min = 1;
        out.options = instrumentChoices(sc, diff).map((o) => {
          const c = decoratedOption(sc, diff, 'instruments', o);
          return { id: o.id, name: c.name, note: c.note, picks: { instruments: o.id } };
        });
      } else if (st.packs) {
        const seen = new Set();
        out.options = [];
        st.packs.forEach((pk) => {
          const picks = {};
          st.keys.forEach((k) => (picks[k] = resolvePick(sc, diff, k, pk.picks[k])));
          const sig = JSON.stringify(picks);
          if (seen.has(sig)) return;
          seen.add(sig);
          out.options.push({ id: pk.id, name: t(`pack.${st.id}.${pk.id}.name`, pk.name), note: t(`pack.${st.id}.${pk.id}.note`, pk.note), picks });
        });
      } else {
        const key = st.keys[0];
        out.options = threeOf(sc, diff, key).map((o) => {
          const c = decoratedOption(sc, diff, key, o);
          return { id: o.id, name: c.name, note: c.note, picks: { [key]: o.id } };
        });
      }
      return out;
    });
  }
  function findStep(design, stepId) {
    return buildSteps(design.scenario, design.difficulty).find((s) => s.id === stepId) || null;
  }
  // The choice now fitted on this step: an option id, or for instruments the ids.
  function stepChoice(design, step) {
    if (!design || !design.picks) return null;
    const st = typeof step === 'string' ? findStep(design, step) : step;
    if (!st) return null;
    if (st.multi) return (design.picks.instruments || []).filter((id) => st.options.some((o) => o.id === id));
    const hit = st.options.find((o) => Object.keys(o.picks).every((k) => design.picks[k] === o.picks[k]));
    return hit ? hit.id : null;
  }
  // Fit one choice. Instruments toggle (within the difficulty's limits).
  function applyStep(design, stepId, optionId) {
    const st = findStep(design, stepId);
    if (!st) return { error: 'that step is not part of this build' };
    const opt = st.options.find((o) => o.id === optionId);
    if (!opt) return { error: 'that choice is not on this step' };
    if (st.multi) return set(design, 'scientist', 'instruments', optionId);
    let d = design;
    for (const key of Object.keys(opt.picks)) {
      const n = set(d, KEY_ROLE[key], key, opt.picks[key]);
      if (n.error) return n;
      d = n;
    }
    return d;
  }
  function setRequirement(design, requirementId) {
    const sc = scenarioOf(design && design.scenario);
    if (!sc || !sc.requirements.some((r) => r.id === requirementId)) return { error: 'no such requirement' };
    return { ...clone(design), requirement: requirementId };
  }
  // How well the fitted instruments cover what each requirement counts (0..1).
  function requirementFit(design) {
    const sc = scenarioOf(design && design.scenario);
    if (!sc) return [];
    const ids = design.picks.instruments || [];
    return sc.requirements.map((r) => {
      let fit = 0;
      sc.objectives.forEach((obj) => {
        const cover = Math.min(1, Math.max(0, ...ids.map((id) => obj.instruments[id] || 0)));
        fit += (r.weights[obj.id] || 0) * cover;
      });
      return { id: r.id, title: t(`scn.${sc.id}.req.${r.id}.title`, r.title), text: t(`scn.${sc.id}.req.${r.id}.text`, r.text), fit: round(Math.min(1, fit), 2) };
    });
  }
  function partSums(sc, picks) {
    let massKg = 0;
    let powerW = 0;
    let costM = 0;
    Object.keys(picks).forEach((key) => {
      const o = pickObj(sc, key, picks[key]);
      if (!o) return;
      if (key === 'panels') {
        massKg += panelMass(o);
        costM += panelCost(o);
        return;
      }
      massKg += (o.mass || 0) + (key === 'ascent' ? o.extraKg || 0 : 0);
      powerW += o.powerW || o.dcW || 0;
      costM += o.costM || 0;
    });
    return { massKg: round(massKg, 1), powerW: Math.round(powerW), costM: round(costM, 1) };
  }
  const TARGET = { ice: 'ice', atmosphere: 'atmosphere', organic: 'organic' };
  const fmtNum = (v) => (v >= 10 ? Math.round(v) : round(v, 1));
  function stepCards(design, stepId) {
    const st = findStep(design, stepId);
    if (!st) return [];
    const sc = scenarioOf(design.scenario);
    const now = stepChoice(design, st);
    const fitted = design.picks.instruments || [];
    const rows = st.options.map((o) => {
      let d2;
      if (st.multi) {
        d2 = fitted.includes(o.id) ? design : set(design, 'scientist', 'instruments', fitted.concat([o.id]));
        if (d2.error) d2 = set(design, 'scientist', 'instruments', [o.id]);
      } else d2 = applyStep(design, st.id, o.id);
      if (!d2 || d2.error) d2 = design;
      const dv = derive(d2);
      const res = resources(d2);
      const on = st.multi ? fitted.includes(o.id) : now === o.id;
      return { o, d2, dv, res, on, pros: [], cons: [], nums: {} };
    });
    const rel = (val, better, pro, con, eps) => {
      const vals = rows.map(val);
      const hi = Math.max(...vals);
      const lo = Math.min(...vals);
      if (hi - lo <= (eps || 1e-6)) return;
      rows.forEach((r, i) => {
        const best = better > 0 ? vals[i] === hi : vals[i] === lo;
        const worst = better > 0 ? vals[i] === lo : vals[i] === hi;
        if (best && pro) {
          const p = pro(r, vals[i], lo, hi);
          if (p) r.pros.push(p);
        }
        if (worst && con) {
          const c = con(r, vals[i], lo, hi);
          if (c) r.cons.push(c);
        }
      });
    };
    const C = (key, params) => t(key, CARD[key], params);
    const targetKey = `card.target.${TARGET[sc.surface && sc.surface.objective] || 'rock'}`;
    const target = () => C(targetKey);
    rows.forEach((r) => {
      r.nums = partSums(sc, r.o.picks);
    });
    switch (st.id) {
      case 'orbit':
        rows.forEach((r) => {
          r.nums = { fuelKg: Math.round(r.dv.prop) };
          if (sc.surface) {
            const near = landingInRange(sc, r.dv.o);
            (near ? r.pros : r.cons).push(C(near ? 'card.land.near' : 'card.land.far', { target: target() }));
          }
        });
        rel((r) => r.dv.insts.reduce((s, i) => s + fitFor(r.dv, i), 0) / Math.max(1, r.dv.insts.length), 1, () => C('card.view.best'), () => C('card.view.poor'), 0.05);
        rel((r) => Math.round(r.dv.orb.eclipse * 100), -1, (r, v) => C('card.sunlit', { n: 100 - v }), (r, v) => C('card.dark', { n: v }), 2);
        rel((r) => r.dv.prop, -1, () => C('card.fuel.less'), (r, v, lo) => C('card.fuel.more', { n: Math.round(v - lo) }), 5);
        break;
      case 'power':
        rows.forEach((r) => {
          r.nums.powerOutW = Math.round(r.dv.arrayBaseW + r.dv.rtgW);
          delete r.nums.powerW;
          if (r.dv.panel.rtg) r.pros.push(C('card.power.dark'));
          if (r.res.power.status === 'bad') r.cons.push(C('card.power.short'));
        });
        rel((r) => r.dv.arrayBaseW + r.dv.rtgW, 1, (r, v) => C('card.power.most', { n: Math.round(v) }), (r, v) => C('card.power.least', { n: Math.round(v) }), 1);
        break;
      case 'batteries':
        rows.forEach((r) => {
          const ok = r.dv.bat.wh >= r.dv.eclipseWh;
          (ok ? r.pros : r.cons).push(C(ok ? 'card.battery.ok' : 'card.battery.short'));
        });
        break;
      case 'instruments':
        rows.forEach((r) => {
          const i = INSTRUMENTS[r.o.id];
          r.nums = { massKg: i.mass, powerW: i.power, costM: i.cost, dataGb: i.rate };
          if (scienceValue(sc, r.o.id) <= 0) r.cons.push(C('card.sci.none'));
          let best = null;
          sc.objectives.forEach((obj) => {
            const w = obj.instruments[r.o.id] || 0;
            if (w > 0 && (!best || w > best.w)) best = { w, obj };
          });
          if (best) r.pros.push(C('card.helps', { what: t(`scn.${sc.id}.obj.${best.obj.id}`, best.obj.title) }));
        });
        rel((r) => scienceValue(sc, r.o.id), 1, () => C('card.sci.big'), null, 0.01);
        rel((r) => INSTRUMENTS[r.o.id].rate, -1, () => C('card.data.light'), (r, v) => C('card.data.lots', { n: fmtNum(v) }), 0.05);
        rel((r) => INSTRUMENTS[r.o.id].power, -1, null, (r, v) => C('card.hungry', { n: Math.round(v) }), 1);
        rel((r) => INSTRUMENTS[r.o.id].mass, -1, () => C('card.lightest'), null, 0.5);
        break;
      case 'radio':
        rows.forEach((r) => {
          if (r.res.comms.status === 'bad') r.cons.push(C('card.home.short'));
        });
        rel((r) => r.res.comms.value, 1, (r, v) => C('card.home.most', { n: fmtNum(v) }), (r, v) => C('card.home.least', { n: fmtNum(v) }), 0.05);
        rel((r) => r.nums.powerW, -1, null, (r, v) => C('card.hungry', { n: Math.round(v) }), 1);
        break;
      case 'recorder':
        rows.forEach((r) => {
          if (r.res.data.status !== 'bad') r.pros.push(C('card.rec.ok', { n: fmtNum(r.dv.rec.gbit) }));
          else r.cons.push(C('card.rec.full'));
        });
        break;
      case 'computer':
        rows.forEach((r) => {
          if (r.dv.adcs.pointing >= 1.2) r.pros.push(C('card.steady'));
          if (r.dv.adcs.pointing < 0.8) r.cons.push(C('card.wobbly'));
          if (r.dv.comp.radHard > 1) r.pros.push(C('card.radhard'));
        });
        break;
      case 'lifetime':
        rows.forEach((r) => (r.nums = { years: r.dv.lifeYears, costM: Math.round(r.dv.opsM) }));
        rel((r) => r.dv.lifeYears, 1, () => C('card.life.most'), () => C('card.life.least'), 0.1);
        break;
      case 'landing':
        rows.forEach((r) => {
          const L = surfaceLoadout(r.d2);
          const lift = L ? L.ascent.liftKg : 0;
          r.nums.liftKg = lift;
          if (lift > 0) r.pros.push(C('card.lift.kg', { n: lift }));
          else r.cons.push(C('card.lift.none'));
          const air = pickObj(sc, 'oxygen', r.o.picks.oxygen);
          if (air && air.spareO2 > 0) r.pros.push(C('card.air.more'));
          else r.cons.push(C('card.air.none'));
          if (r.o.picks.drill === 'deep') r.pros.push(C('card.drill.deep'));
        });
        break;
      case 'rocket':
        rows.forEach((r) => {
          r.nums = { liftKg: Math.round(r.dv.capacity), costM: Math.round(r.dv.launchM) };
          const spare = Math.round(r.dv.capacity - r.dv.wet);
          if (spare >= 0) r.pros.push(C('card.rocket.fits', { n: spare }));
          else r.cons.push(C('card.rocket.over', { n: -spare }));
        });
        break;
      default:
        break;
    }
    if (st.id !== 'instruments' && st.id !== 'rocket') rel((r) => r.res.mass.value, -1, () => C('card.lightest'), () => C('card.heaviest'), 0.5);
    rel((r) => (st.id === 'instruments' ? INSTRUMENTS[r.o.id].cost : r.res.budget.value), -1, () => C('card.cheapest'), () => C('card.priciest'), 0.5);
    return rows.map((r) => {
      let pros = r.pros.slice(0, 2);
      let cons = r.cons.slice(0, 2);
      while (pros.length + cons.length > 3) {
        if (pros.length > cons.length) pros = pros.slice(0, -1);
        else cons = cons.slice(0, -1);
      }
      const flies = !checks(r.d2).some((c) => c.hard && !c.ok);
      return { id: r.o.id, name: r.o.name, note: r.o.note, picks: r.o.picks, on: r.on, pros, cons, nums: r.nums, flies, resources: r.res };
    });
  }

  // ---------- 3D craft ----------
  function toCraftDesign(design) {
    const d = derive(design);
    const instruments = (design.picks.instruments || []).filter((id) => ['hires', 'context', 'irspec', 'neutron', 'sounder', 'iceRadar', 'sar', 'mag', 'uso'].includes(id));
    const vault = { vault25: 25, vault75: 75, vault150: 150 }[design.picks.structure] || 0;
    return {
      instruments,
      arrays: d.panel.rtg ? 0 : d.panel.areaM2,
      rtg: d.panel.rtg ? d.panel.rtg : 0,
      dish: d.ant.diaM,
      amp: d.radio.rfW,
      recorder: d.rec.gbit,
      shield: vault,
      avionics: d.comp.id === 'dual' ? 'dual' : 'single',
      margin: Math.round(d.pm.frac * 100),
      info: { dryKg: Math.round(d.dry), propKg: Math.round(d.prop) },
    };
  }

  SMD.team.sim = {
    roles: () => ROLES.slice(),
    scenarios,
    difficulties,
    catalog,
    newDesign,
    set,
    rolesOf,
    resources,
    checks,
    preview,
    crisesFor,
    fly,
    score,
    chain,
    bestChange,
    obituary,
    agendas,
    agendaMet,
    encode,
    decode,
    toCraftDesign,
    surfaceLoadout,
    buildSteps,
    stepChoice,
    applyStep,
    stepCards,
    setRequirement,
    requirementFit,
    _derive: derive,
    _hash: hash,
  };
  if (typeof module === 'object' && module.exports) module.exports = SMD.team.sim;
})();
