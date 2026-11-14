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
  const T = (key, params) => t(key, STR[key] !== undefined ? STR[key] : TD.V3_STR[key], params);
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
    if (sc.parts && sc.parts[key]) return sc.parts[key];
    switch (key) {
      case 'orbit': return sc.orbits;
      case 'launcher': return LAUNCHERS;
      case 'route': return sc.routes;
      case 'lifetime': return sc.lifetimes.map((l) => ({ ...l, name: l.years === 1 ? '1 year' : l.years < 1 ? `${Math.round(l.years * 12)} months` : `${l.years} years`, note: lifetimeNote(l, sc) }));
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
      cubesat: !!s.cubesat,
    }));
  }
  function difficulties() {
    return DIFFICULTIES.map((d) => ({ id: d.id, title: t(`diff.${d.id}.title`, d.title), note: t(`diff.${d.id}.note`, d.note), tier: d.tier, designSec: d.designSec, budgetMult: d.budgetMult, crises: d.crises, flaws: d.flaws, instrumentMax: INSTRUMENT_MAX[d.id], cml: cml(d.id) }));
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
    const std = { structure: 'standard', adcs: 'wheels', computer: 'single', propMargin: 'm25', duty: 'd60', processing: 'compress', coding: 'robust', schedule: 'plan', route: list[0] && list[0].id, ascent: 'a60', oxygen: 'o1', drill: 'hand', thermal: 'standard' }[key];
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
    // Thermal control (v3): a design without a pick has the standard system, as before.
    const thermList = optionsFor(sc, 'thermal');
    const therm = thermList.find((o) => o.id === p.thermal) || thermList.find((o) => o.id === 'standard') || thermList[0];
    const thermalNeed = sc.thermalNeed || 0.5;
    const thermalShort = therm.cap < thermalNeed ? sc.thermalEnv || 'cold' : null;
    const insts = (p.instruments || []).map((id) => ({ id, ...INSTRUMENTS[id] }));
    const surf = sc.surface ? surfaceParts(sc, p) : { mass: 0, costM: 0, powerW: 0, list: [] };
    const orb = orbitInfo(o, sc);

    // Power
    const arrayBaseW = panel.rtg ? 0 : panelWatts(panel, sc);
    const rtgW = panel.rtg ? panel.watts : 0;
    const heaterW = sc.heaterW * therm.heaterMult + (therm.powerW || 0);
    const busW = sc.busW + adcs.powerW + comp.powerW + heaterW + proc.powerW;
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
    const K = sc.linkK || (sc.linkMode === 'near' ? 1.2e-4 : GD_K);
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
    const thermalMass = sc.thermalFrac * partsMass * therm.massMult;
    const engineMass = sc.engineKg !== undefined ? sc.engineKg : 20;
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
    const partCost = insts.reduce((s, i) => s + i.cost, 0) + panelCost(panel) + bat.costM + adcs.costM + comp.costM + ant.costM + radio.costM + rec.costM + (struct.costM || 0) + surf.costM + (therm.costM || 0);
    const devM = (sc.busCost + (sc.devPerKg !== undefined ? sc.devPerKg : 0.05) * dry + partCost) * sched.costMult;
    const launchM = launcher.costM * (route.costMult || 1);
    const groundPerYear = sc.linkMode === 'near' ? ground.nearPerYear : ground.deepPerYear;
    const cruiseYears = (route.opsMonths || 0) / 12;
    const opsM = (sc.opsPerYear + groundPerYear) * (life.years + cruiseYears);
    const devMonths = sc.devBase + 0.8 * Math.max(0, insts.length - 1) + (sched.months || 0) + (sc.surface ? 0.5 * surf.list.length * 0.5 : 0);
    const deadline = sc.deadlineMonths;
    const latePenalty = devMonths > deadline ? (devMonths - deadline) * (sc.latePerMonth || (sc.dest === 'mars' ? 12 : 5)) : 0;
    const costM = devM + launchM + opsM + latePenalty;
    const budget = diff.budgetMult === null ? null : sc.budgetM * diff.budgetMult;

    // Lifetime limits
    const hardness = struct.shieldKrad * comp.radHard;
    const dosePerYear = o.radKrad;
    const radLifeYears = hardness / dosePerYear;
    const dragYears = o.dragYears;
    // No engine (CubeSats): thin air ends the mission when it ends.
    const reentryYears = sc.noPropulsion ? dragYears : Infinity;

    return {
      _req: design.requirement,
      sc, diff, o, launcher, route, life, sched, struct, panel, bat, adcs, comp, pm, duty, proc, ant, radio, ground, coding, rec, insts, surf, orb,
      therm, thermalNeed, thermalShort, heaterW, reentryYears,
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
    const lifeShort = d.radLifeYears < d.lifeYears || d.reentryYears < d.lifeYears;
    // CubeSat-scale numbers keep their decimals; big missions round as before.
    const kg = (x) => (Math.abs(x) < 50 ? round(x, 1) : Math.round(x));
    const usd = (x) => (Math.abs(x) < 10 ? round(x, 2) : Math.abs(x) < 50 ? round(x, 1) : Math.round(x));
    return {
      mass: {
        value: kg(d.wet), limit: kg(d.capacity), unit: 'kg', status: statusFor(massRatio, 0.9),
        why: T('res.mass.why', { rocket: optionName(d.sc, 'launcher', d.launcher) }),
        dry: kg(d.dry), prop: kg(d.prop), payload: kg(d.partsMass), marginKg: kg(d.massMargin),
      },
      power: {
        value: Math.round(pb.inAvg), limit: Math.round(pb.load), unit: 'W', status: statusFor(powerRatio),
        why: T('res.power.why'),
        marginPct: Math.round(pb.marginPct), sunlitW: Math.round(d.arrayBaseW + d.rtgW), eclipseMin: Math.round(d.orb.periodMin * d.orb.eclipse),
        eclipsePct: Math.round(d.orb.eclipse * 100), batteryWh: d.bat.wh, batteryNeedWh: Math.round(d.eclipseWh), loadW: Math.round(pb.load),
      },
      budget: {
        value: usd(d.costM), limit: d.budget === null ? null : usd(d.budget), unit: '$M', status: d.budget === null ? 'ok' : statusFor(budgetRatio, 0.93),
        why: T('res.budget.why', { dev: usd(d.devM), launch: usd(d.launchM), ops: usd(d.opsM) }),
        devM: usd(d.devM), launchM: usd(d.launchM), opsM: usd(d.opsM), lateM: usd(d.latePenalty),
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
        lifeYears: d.lifeYears, maxLifeYears: round(Math.min(d.radLifeYears, d.reentryYears), 2), lifeLimitedBy: d.radLifeYears < d.lifeYears ? 'radiation' : d.dragYears < d.lifeYears ? 'drag' : null,
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
    const lifeOk = d.radLifeYears >= d.lifeYears && d.reentryYears >= d.lifeYears;
    list.push({ id: 'life', hard: false, ok: lifeOk, text: lifeOk ? T('check.life') : T('check.life.bad', { max: round(Math.min(d.radLifeYears, d.reentryYears), 1) }) });
    // Thermal control (v3): only when the chosen system is too weak for this world.
    list.push({ id: 'thermal', hard: false, ok: !d.thermalShort, text: d.thermalShort ? T(d.thermalShort === 'hot' ? 'check.thermal.hot' : 'check.thermal.cold') : T('check.thermal') });
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
    const pool = CRISES.filter((c) => !(sc.noCrises || []).includes(c.id) && !c.only);
    const picks = [];
    const nCrises = diff.crises;
    for (let i = 0; i < nCrises && pool.length; i++) {
      const idx = Math.floor(rng() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }
    // A signature mission always meets its own problem (TEAM-V3 item 19): it takes the
    // last drawn crisis's place, so the random draws and timings stay as they were.
    (sc.crisisSet || []).forEach((id, k) => {
      const sig = CRISES.find((c) => c.id === id);
      const at = picks.length - 1 - k;
      if (sig && at >= 0) picks[at] = sig;
    });
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
    // Overheating (thermal control too weak on a hot world) throttles the instruments.
    const sciQuality = applyFlaw('sciQuality', 1) * (d.thermalShort === 'hot' ? 0.75 : 1);
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
    let thermalShown = false;

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

      const panelDeg = Math.pow(0.985, ageYears * d.therm.ageMult);
      const batFade = 1 - 0.03 * ageYears * d.therm.ageMult;
      // Too cold a ship in the dark: cold cells hold less, and the instruments are
      // switched off to keep the electronics warm (thermal control too weak, v3).
      const coldNow = d.thermalShort === 'cold' && (eclipseShare > 0.5 || (sc.au > 3 && step % 2 === 0));
      const capNow = capacityWh * batteryMult * clamp(batFade, 0.4, 1) * (coldNow ? 0.8 : 1);
      if (!dead && d.thermalShort && !thermalShown && (coldNow || (d.thermalShort === 'hot' && sunShare > 0.5))) {
        thermalShown = true;
        recordEvent({ t: frameT(), kind: 'thermal', role: 'engineer', env: d.thermalShort, text: T(d.thermalShort === 'hot' ? 'event.thermal.hot' : 'event.thermal.cold') });
      }
      // No engine (CubeSats): the air pulls it down when its time is up.
      if (!dead && missionFrac * d.lifeYears >= d.reentryYears) markDead('drag', step);
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
      const shedInst = socBefore < 0.25 || step < instOffUntil || coldNow;
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
      } else if (type === 'lunarEclipse') {
        // Signature crises (v3): a fix costs nothing, a miss hurts.
        if (!fixed) {
          batteryMult *= 0.85;
          instOffUntil = Math.max(instOffUntil, step + 2 * nOrb);
          batteryWh = Math.min(batteryWh, capacityWh * batteryMult * 0.4);
        }
      } else if (type === 'dustStorm') {
        if (!fixed) {
          panelMult *= 0.8;
          pointHoldUntil = Math.max(pointHoldUntil, step + 3 * nOrb);
        }
      } else if (type === 'tumble') {
        if (!fixed) linkOffUntil = Math.max(linkOffUntil, step + 3 * nOrb);
        if (!fixed) pointHoldUntil = Math.max(pointHoldUntil, step + 4 * nOrb);
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

  // ---------- Score (docs/TEAM-V3.md item 12) ----------
  // Four axes, every point traceable to one line: mission requirements met (300),
  // science returned (300), efficiency (200) and teamwork (200). The outcome sets a
  // band the total must sit in, so a lost or failed mission never beats a successful one.
  const BANDS = { full: [750, 1000], partial: [450, 749], fail: [0, 449], lost: [0, 299] };
  const DEATHS = ['power', 'drag', 'radiation', 'computer', 'attitude', 'nav', 'breakup', 'insertion', 'flaw', 'deploy'];
  function outcomeOf(flight, ss) {
    const r = (flight && flight.result) || {};
    if (DEATHS.includes(r.cause)) return 'lost';
    if (ss) {
      if (ss.crewTotal > 0 && ss.survivors < ss.crewTotal) return 'lost';
      if (ss.outcome && ss.outcome !== 'extracted') return 'lost';
    }
    const orbit = r.success === 'full' || r.success === 'partial' ? r.success : 'fail';
    if (!ss) return orbit;
    const raw = ss.raw || {};
    const won = raw.won !== undefined ? !!raw.won : ss.scienceFrac >= 0.6;
    const met = !!(raw.science && raw.science.objectiveMet);
    if (orbit === 'full' && won) return 'full';
    if (orbit !== 'fail' || won || met || ss.scienceFrac >= 0.3) return 'partial';
    return 'fail';
  }
  // Integer points that add up exactly: each item rounds against the running total.
  function share(list) {
    let acc = 0;
    let given = 0;
    return list.map((x) => {
      acc += x.raw;
      const pts = Math.round(acc) - given;
      given += pts;
      const out = { ...x, points: pts };
      delete out.raw;
      return out;
    });
  }
  function axis(id, items, max, params) {
    const value = items.reduce((s, x) => s + x.points, 0);
    return { value, max, why: T(`score.why.${id}`, params), items };
  }
  function score(design, flight, teamStats, surfaceSummary) {
    const d = derive(design);
    const r = flight.result;
    const ts = teamStats || {};
    const ss = normalizeSurface(surfaceSummary);

    // 1. Mission requirements, from the traceability table, judged on what happened.
    const reqs = requirementStatus(design, flight, surfaceSummary);
    const each = 300 / Math.max(1, reqs.length);
    const reqItems = share(reqs.map((q) => ({ id: q.id, key: q.key, label: `${q.id}: ${q.text}`, raw: q.met ? each : 0, max: Math.round(each), met: q.met, why: q.why })));
    const reqMet = reqs.filter((q) => q.met).length;

    // 2. Science returned.
    const orbitFrac = clamp((r.science || 0) / 100, 0, 1);
    const sciList = [];
    if (ss) {
      const surfaceFrac = clamp(ss.scienceFrac, 0, 1);
      sciList.push({ id: 'orbit', label: T('score.item.orbit', { pct: Math.round(orbitFrac * 100) }), raw: 165 * orbitFrac, max: 165 });
      sciList.push({ id: 'surface', label: T('score.item.surface', { pct: Math.round(surfaceFrac * 100) }), raw: 135 * surfaceFrac, max: 135 });
    } else sciList.push({ id: 'orbit', label: T('score.item.orbit', { pct: Math.round(orbitFrac * 100) }), raw: 300 * orbitFrac, max: 300 });
    const sciItems = share(sciList);

    // 3. Efficiency: money left, lift to spare, data that got home.
    const budgetFrac = d.budget !== null ? clamp((d.budget - d.costM) / (d.budget * 0.3), 0, 1) : 0.5;
    const massFrac = clamp((d.capacity - d.wet) / (d.capacity * 0.25), 0, 1);
    const lostFrac = clamp(r.lostFrac || 0, 0, 1);
    const over = d.budget !== null && d.costM > d.budget;
    const effList = [
      { id: 'budget', label: T('score.item.budget', { left: moneyText(d.budget === null ? 0 : d.budget - d.costM) }), raw: 80 * budgetFrac, max: 80 },
      { id: 'mass', label: T('score.item.mass', { n: fmtKg(d.capacity - d.wet) }), raw: 60 * massFrac, max: 60 },
      { id: 'data', label: T('score.item.data', { pct: Math.round((1 - lostFrac) * 100) }), raw: 60 * (1 - lostFrac), max: 60 },
    ];
    if (over) {
      const sum = effList.reduce((s, x) => s + x.raw, 0);
      effList.push({ id: 'over', label: T('score.item.over'), raw: -0.7 * sum, max: 0 });
    }
    const effItems = share(effList);

    // 4. Teamwork.
    const reqSent = ts.requestsSent || 0;
    const reqAns = ts.requestsAnswered || 0;
    const reqPart = reqSent > 0 ? clamp(reqAns / reqSent, 0, 1) : 0.5;
    const crisesTotal = ts.crisesTotal !== undefined ? ts.crisesTotal : r.crisesTotal;
    const crisesFixed = ts.crisesFixed !== undefined ? ts.crisesFixed : r.crisesFixed;
    const crisisPart = crisesTotal > 0 ? clamp(crisesFixed / crisesTotal, 0, 1) : 0.5;
    const agendaList = ts.agendas;
    let agendaPart = 0.5;
    let agendasMet = 0;
    if (agendaList && agendaList.length) {
      agendasMet = agendaList.filter((a) => agendaMet(a, design, flight)).length;
      agendaPart = agendasMet / agendaList.length;
    }
    const teamItems = share([
      { id: 'crises', label: crisesTotal > 0 ? T('score.item.crises', { a: crisesFixed || 0, b: crisesTotal }) : T('score.item.crises.none'), raw: 90 * crisisPart, max: 90 },
      { id: 'requests', label: reqSent > 0 ? T('score.item.requests', { a: reqAns, b: reqSent }) : T('score.item.requests.none'), raw: 60 * reqPart, max: 60 },
      { id: 'agendas', label: agendaList && agendaList.length ? T('score.item.agendas', { a: agendasMet, b: agendaList.length }) : T('score.item.agendas.none'), raw: 50 * agendaPart, max: 50 },
    ]);

    const axes = {
      requirements: axis('requirements', reqItems, 300, { a: reqMet, b: reqs.length }),
      science: axis('science', sciItems, 300),
      efficiency: axis('efficiency', effItems, 200),
      teamwork: axis('teamwork', teamItems, 200),
    };
    const earned = axes.requirements.value + axes.science.value + axes.efficiency.value + axes.teamwork.value;
    const oid = outcomeOf(flight, ss);
    const band = BANDS[oid];
    const total = clamp(earned, band[0], band[1]);
    const adjust = total - earned;
    const medal = total >= 850 ? 'gold' : total >= 650 ? 'silver' : total >= 420 ? 'bronze' : 'none';
    return {
      total,
      requirements: axes.requirements.value,
      science: axes.science.value,
      efficiency: axes.efficiency.value,
      teamwork: axes.teamwork.value,
      axes,
      outcome: { id: oid, title: T(`outcome.${oid}`), band: band.slice(), earned, adjust, label: T('outcome.adjust'), why: T(`outcome.why.${oid}`) },
      medal,
      medalTitle: T(`medal.${medal}`),
      details: { sciencePct: r.science, requirementsMet: reqMet, requirementsTotal: reqs.length, agendasMet, agendasTotal: agendaList ? agendaList.length : 0, crisesFixed, crisesTotal, costM: round(d.costM, 2), budgetM: d.budget === null ? null : round(d.budget, 2), massMarginKg: round(d.capacity - d.wet, 1), lifeFrac: round(clamp(r.lifeFraction || 0, 0, 1), 3), surface: ss || null },
    };
  }
  function fmtKg(x) {
    return Math.abs(x) < 50 ? String(round(x, 1)) : fmt(x);
  }
  function moneyText(x) {
    const a = Math.abs(x);
    const sign = x < 0 ? '−' : '';
    if (a < 1) return t('val.moneyk', TD.V3_STR['val.moneyk'], { n: `${sign}${fmt(a * 1000)}` });
    return t('val.money', TD.V3_STR['val.money'], { n: `${sign}${a < 10 ? round(a, 1) : fmt(a)}` });
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
        if (lockOf(design, st.id, o.id)) return;
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
    if (d.thermalShort) steps.push({ kind: 'power', text: T(d.thermalShort === 'hot' ? 'chain.thermal.hot' : 'chain.thermal.cold'), why: T('chain.why.thermal'), delta: -Math.round((d.thermalNeed - d.therm.cap) * 100) });
    if (r.cause === 'radiation') steps.push({ kind: 'radiation', text: T('chain.radiation', { dose: Math.round(r.doseKrad), shield: Math.round(r.hardnessKrad) }), why: T('chain.why.radiation'), delta: Math.round(r.doseKrad - r.hardnessKrad) });
    if (r.cause === 'drag' && d.sc.noPropulsion) steps.push({ kind: 'fuel', text: T('chain.reentry', { days: Math.round((1 - r.lifeFraction) * d.lifeYears * 365) }), why: T('chain.why.reentry'), delta: -Math.round((1 - r.lifeFraction) * d.lifeYears * 365) });
    else if (r.cause === 'drag' || r.cause === 'attitude') steps.push({ kind: 'fuel', text: T('chain.fuel', { days: Math.round((1 - r.lifeFraction) * d.lifeYears * 365) }), why: T('chain.why.fuel'), delta: -Math.round((1 - r.lifeFraction) * d.lifeYears * 365) });
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
      const lA = optionsFor(d.sc, 'launcher').find((x) => x.id === small);
      const lB = optionsFor(d.sc, 'launcher').find((x) => x.id === altSmall);
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
      power: { solarW: solarW1AU, batteryWh: d.thermalShort === 'cold' ? Math.round(d.bat.wh * 0.8) : d.bat.wh, rtgW: d.rtgW },
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
    return TD.BUILD_STEPS.filter((st) => st.tier <= tier && (!st.landing || sc.surface) && (!st.routeOnly || sc.routeStep) && st.keys.every((k) => keys.includes(k)));
  }
  function buildSteps(scenarioId, difficulty) {
    const sc = scenarioOf(scenarioId);
    if (!sc) return [];
    const diff = difficultyOf(difficulty) || difficultyOf('engineer');
    return stepsFor(sc, diff).map((st) => {
      const text = sc.stepText && sc.stepText[st.id];
      const out = {
        id: st.id,
        title: text ? t(`scn.${sc.id}.step.${st.id}.title`, text.title) : t(`step.${st.id}.title`, st.title),
        ask: text ? t(`scn.${sc.id}.step.${st.id}.ask`, text.ask) : t(`step.${st.id}.ask`, st.ask),
        role: st.role, keys: st.keys.slice(), res: st.res.slice(), multi: !!st.multi, segment: st.segment, serves: servesOf(sc, st.id),
      };
      const packs = (sc.packs && sc.packs[st.id]) || st.packs;
      if (st.multi) {
        out.max = INSTRUMENT_MAX[diff.id] || 3;
        out.min = 1;
        out.options = instrumentChoices(sc, diff).map((o) => {
          const c = decoratedOption(sc, diff, 'instruments', o);
          return { id: o.id, name: c.name, note: c.note, picks: { instruments: o.id } };
        });
      } else if (packs) {
        const seen = new Set();
        out.options = [];
        packs.forEach((pk) => {
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
    const depth = cml(design.difficulty).depth;
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
    const C = (key, params) => t(key, CARD[key] !== undefined ? CARD[key] : TD.V3_STR[key], params);
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
          r.nums = { massKg: i.mass, powerW: i.power, costM: i.cost, dataGb: i.rate, sciPct: Math.round(scienceValue(sc, r.o.id, reqOf(sc, design)) * 100) };
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
      case 'route':
        rows.forEach((r) => {
          r.nums = { fuelKg: Math.round(r.dv.prop), costM: round(r.dv.opsM, 0) };
          if (r.dv.route.risk) r.cons.push(C('card.route.risk'));
          if (r.dv.route.opsMonths) r.cons.push(C('card.route.slow', { n: r.dv.route.opsMonths }));
        });
        rel((r) => r.dv.prop, -1, (r, v, lo, hi) => C('card.route.fuel', { n: fmt(hi - v) }), null, 5);
        break;
      case 'thermal':
        rows.forEach((r) => {
          r.nums = { massKg: round(r.dv.thermalMass, r.dv.thermalMass < 10 ? 1 : 0), powerW: Math.round(r.dv.heaterW), costM: r.dv.therm.costM || 0 };
          if (r.dv.thermalShort) r.cons.push(C(r.dv.thermalShort === 'hot' ? 'card.thermal.hot' : 'card.thermal.cold'));
          else r.pros.push(C('card.thermal.ok'));
          if (r.dv.therm.ageMult < 1) r.pros.push(C('card.thermal.age'));
          if (r.dv.therm.ageMult > 1) r.cons.push(C('card.thermal.wear'));
        });
        break;
      case 'ground':
        rows.forEach((r) => {
          r.nums = { costM: round(r.dv.groundPerYear * r.dv.lifeYears, 2) };
          if (r.res.comms.status === 'bad') r.cons.push(C('card.home.short'));
        });
        rel((r) => r.dv.dailySec, 1, (r) => C('card.ground.hours', { h: fmtNum(r.dv.dailySec / 3600) }), () => C('card.ground.wait'), 60);
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
          r.nums = { liftKg: r.dv.capacity < 50 ? round(r.dv.capacity, 1) : Math.round(r.dv.capacity), costM: r.dv.launchM < 10 ? round(r.dv.launchM, 2) : Math.round(r.dv.launchM) };
          if (r.dv.launcher.u) r.pros.push(C('card.ride.slot', { u: r.dv.launcher.u }));
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
      const card = { id: r.o.id, name: r.o.name, note: r.o.note, picks: r.o.picks, on: r.on, pros, cons, nums: r.nums, flies, resources: r.res, locked: lockOf(design, st.id, r.o.id), serves: st.serves, segment: st.segment };
      // Concept maturity depth (v3 item 4): Engineer adds real specs, Flight director the point-design detail.
      if (depth >= 2) card.specs = specsOf(sc, st, r);
      if (depth >= 3) card.detail = detailOf(sc, st, r, st.serves);
      return card;
    });
  }

  // ---------- v3: traceability, segments, CML depth, locks, AI crewmates ----------
  // docs/TEAM-V3.md "As built (v3: build)". Pure, like everything else here.
  const V = (key, params) => t(key, TD.V3_STR[key], params);

  function segments() {
    return TD.SEGMENTS.map((g) => ({ id: g.id, title: t(`seg.${g.id}.title`, g.title), blurb: t(`seg.${g.id}.blurb`, g.blurb) }));
  }
  function cml(difficulty) {
    const id = TD.CML[difficulty] ? difficulty : 'engineer';
    const c = TD.CML[id];
    const key = id === 'sandbox' ? 'director' : id;
    return { id, level: c.level, depth: c.depth, name: t(`cml.${key}.name`, c.name), what: t(`cml.${key}.what`, c.what), label: V('cml.label', { level: c.level }), short: V('cml.short', { level: c.level }) };
  }
  const reqOf = (sc, design) => sc.requirements.find((r) => r.id === (design && design.requirement)) || sc.requirements[0];
  function primaryOf(sc, req) {
    return sc.objectives.reduce((a, o) => ((req.weights[o.id] || 0) > (req.weights[a.id] || 0) ? o : a), sc.objectives[0]);
  }
  const siteText = (sc) => t(`card.target.${TARGET[sc.surface && sc.surface.objective] || 'rock'}`, CARD[`card.target.${TARGET[sc.surface && sc.surface.objective] || 'rock'}`]);
  // The mission requirements of a scenario, numbered MR-1.. (landing worlds add one).
  function missionReqs(sc, design) {
    const req = reqOf(sc, design);
    const primary = primaryOf(sc, req);
    const params = { primary: t(`scn.${sc.id}.obj.${primary.id}`, primary.title), target: t(`scn.${sc.id}.target`, sc.target || ''), site: sc.surface ? siteText(sc) : '' };
    const base = TD.MISSION_REQS.filter((m) => !m.landing || sc.surface).map((m) => ({ key: m.key, text: t(`mr.${m.key}`, m.text, params), steps: m.steps.slice(), segment: m.segment }));
    const extra = (sc.extraReqs || []).map((m) => ({ key: m.key, text: t(`scn.${sc.id}.mr.${m.key}`, m.text, params), steps: m.steps.slice(), segment: m.segment }));
    return base.concat(extra).map((m, i) => ({ id: `MR-${i + 1}`, ...m }));
  }
  function servesOf(sc, stepId) {
    return missionReqs(sc, null).filter((m) => m.steps.includes(stepId)).map((m) => m.id);
  }
  // NASA's chain: need -> goal -> objectives -> measurements -> mission requirements -> concept.
  function traceability(design) {
    const sc = scenarioOf(design && design.scenario);
    if (!sc) return null;
    const req = reqOf(sc, design);
    const primary = primaryOf(sc, req);
    const objectives = sc.objectives
      .map((o) => ({
        id: o.id,
        title: t(`scn.${sc.id}.obj.${o.id}`, o.title),
        weight: req.weights[o.id] || 0,
        primary: o.id === primary.id,
        measure: t(`scn.${sc.id}.measure.${o.id}`, (sc.measure || {})[o.id] || o.title),
        instruments: Object.keys(o.instruments).filter((id) => sc.instruments.includes(id) && o.instruments[id] >= 0.5).map((id) => ({ id, name: t(`instr.${id}.name`, INSTRUMENTS[id].name) })),
      }))
      .sort((a, b) => b.weight - a.weight);
    return {
      scenario: sc.id,
      title: t(`scn.${sc.id}.title`, sc.title),
      requirement: { id: req.id, title: t(`scn.${sc.id}.req.${req.id}.title`, req.title), text: t(`scn.${sc.id}.req.${req.id}.text`, req.text) },
      need: t(`scn.${sc.id}.need`, sc.need || sc.question),
      question: t(`scn.${sc.id}.question`, sc.question),
      goal: t(`scn.${sc.id}.objective`, sc.objective),
      objectives,
      missionReqs: missionReqs(sc, design),
      concept: t(`scn.${sc.id}.concept`, sc.concept || ''),
      target: t(`scn.${sc.id}.target`, sc.target || ''),
      landing: !!sc.surface,
    };
  }
  // Which mission requirements this design meets: from the design alone before the
  // flight, from what actually happened after it.
  function requirementStatus(design, flight, surfaceSummary) {
    const sc = scenarioOf(design && design.scenario);
    if (!sc) return [];
    const d = derive(design);
    const ck = {};
    checks(design).forEach((c) => (ck[c.id] = c));
    const r = flight && flight.result;
    const ss = normalizeSurface(surfaceSummary);
    const req = reqOf(sc, design);
    const primary = primaryOf(sc, req);
    const fitAvg = d.insts.length ? d.insts.reduce((s, i) => s + fitFor(d, i), 0) / d.insts.length : 0;
    const bad = (...ids) => ids.map((id) => ck[id]).find((c) => c && !c.ok);
    return missionReqs(sc, design).map((m) => {
      let met = false;
      let why = '';
      switch (m.key) {
        case 'measure': {
          const covers = d.insts.some((i) => (primary.instruments[i.id] || 0) >= 0.5);
          if (r) {
            const frac = (r.perObjective && r.perObjective[primary.id]) || 0;
            met = frac >= 0.6;
            why = V('mr.why.measure.flown', { pct: Math.round(Math.min(1, frac) * 100) });
          } else {
            met = covers;
            why = V(covers ? 'mr.why.measure.ok' : 'mr.why.measure.bad');
          }
          break;
        }
        case 'view': {
          met = fitAvg >= 0.75;
          why = V(met ? 'mr.why.view.ok' : 'mr.why.view.bad');
          break;
        }
        case 'power': {
          const c = bad('power', 'battery', 'thermal');
          if (r && r.brownouts > 0) {
            met = false;
            why = V('mr.why.power.flat', { n: r.brownouts });
          } else if (r && r.cause === 'power') {
            met = false;
            why = T('cause.power');
          } else {
            met = !c;
            why = c ? c.text : V('mr.why.power.ok');
          }
          break;
        }
        case 'data': {
          if (r && r.generatedGbit > 0) {
            const home = clamp(1 - (r.lostFrac || 0), 0, 1);
            met = home >= 0.8;
            why = V(met ? 'mr.why.data.ok' : 'mr.why.data.bad', { pct: Math.round((met ? home : 1 - home) * 100) });
          } else {
            const c = bad('comms', 'recorder');
            met = !c && !(r && !r.generatedGbit);
            why = c ? c.text : V('mr.why.ok');
          }
          break;
        }
        case 'life': {
          if (r) {
            const frac = clamp(r.lifeFraction || 0, 0, 1);
            met = !!r.alive && frac >= 0.95;
            why = met ? V('mr.why.life.ok') : r.cause && r.cause !== 'budget' ? T(`cause.${r.cause}`) : V('mr.why.life.bad', { pct: Math.round(frac * 100) });
          } else {
            const c = bad('life', 'time');
            met = !c;
            why = c ? c.text : V('mr.why.ok');
          }
          break;
        }
        case 'launch': {
          const c = bad('launcher', 'budget');
          met = !c;
          why = c ? c.text : V('mr.why.launch.ok');
          break;
        }
        case 'land': {
          const near = landingInRange(sc, d.o);
          if (!near) {
            met = false;
            why = V('mr.why.view.far', { target: siteText(sc) });
          } else if (ss) {
            const home = ss.crewTotal > 0 && ss.survivors >= ss.crewTotal && (!ss.outcome || ss.outcome === 'extracted');
            const raw = ss.raw || {};
            const samples = raw.samples ? raw.samples.returned || 0 : ss.samplesKg - ss.samplesLeftKg > 0 ? 1 : 0;
            met = home && samples > 0;
            why = V(!home ? 'mr.why.land.lost' : samples > 0 ? 'mr.why.land.ok' : 'mr.why.land.empty');
          } else if (r) {
            met = false;
            why = V('mr.why.land.lost');
          } else {
            met = true;
            why = V('mr.why.land.notyet');
          }
          break;
        }
        case 'night': {
          const c = bad('thermal', 'battery');
          met = !c && !(r && r.brownouts > 0);
          why = c ? c.text : r && r.brownouts > 0 ? V('mr.why.power.flat', { n: r.brownouts }) : V('mr.why.ok');
          break;
        }
        case 'arrive': {
          const near = landingInRange(sc, d.o);
          const risky = (d.route.risk || 0) > 0.1;
          if (r && r.cause === 'nav') {
            met = false;
            why = T('cause.nav');
          } else {
            met = near && (!!r || !risky);
            why = !near ? V('mr.why.arrive.far') : !r && risky ? V('mr.why.arrive.risky') : V('mr.why.ok');
          }
          break;
        }
        case 'dust': {
          const pb = powerBudget(d);
          met = pb.marginPct >= 30 && !(r && r.brownouts > 0);
          why = met ? V('mr.why.ok') : V('mr.why.dust.low');
          break;
        }
        case 'box': {
          met = d.wet <= d.capacity && !!d.launcher.u;
          why = met ? V('mr.why.ok') : V('mr.why.box.big');
          break;
        }
        case 'databudget': {
          if (r && r.generatedGbit > 0) {
            const home = clamp(1 - (r.lostFrac || 0), 0, 1);
            met = home >= 0.85;
            why = V(met ? 'mr.why.data.ok' : 'mr.why.data.bad', { pct: Math.round((met ? home : 1 - home) * 100) });
          } else {
            const c = bad('comms', 'recorder');
            met = !c;
            why = c ? c.text : V('mr.why.ok');
          }
          break;
        }
        default:
          break;
      }
      return { id: m.id, key: m.key, text: m.text, met, why, proof: proofOf(m.key, d, sc, design), fix: fixStep(m.steps), steps: m.steps, segment: m.segment };
    });
    function fixStep(ids) {
      const steps = buildSteps(design.scenario, design.difficulty);
      return ids.find((id) => steps.some((st) => st.id === id)) || null;
    }
  }
  // The number that proves a requirement (TEAM-V3 item 21), for the review checklist.
  function proofOf(key, d, sc, design) {
    const pb = powerBudget(d);
    const money = (x) => moneyText(x);
    const life = (y) => (y === 1 ? V('val.year1') : y < 1 ? V('val.months', { n: Math.round(y * 12) }) : V('val.years', { n: nf(y) }));
    switch (key) {
      case 'measure': {
        const req = reqOf(sc, design);
        const fit = requirementFit(design).find((f) => f.id === req.id);
        return V('proof.measure', { pct: Math.round(((fit && fit.fit) || 0) * 100), req: t(`scn.${sc.id}.req.${req.id}.title`, req.title) });
      }
      case 'view': {
        const fit = d.insts.length ? d.insts.reduce((s, i) => s + fitFor(d, i), 0) / d.insts.length : 0;
        return V('proof.view', { pct: Math.round(Math.min(1.5, fit) * 100) });
      }
      case 'power': return V('proof.power', { in: fmt(pb.inAvg), load: fmt(pb.load), wh: fmt(d.bat.wh), need: fmt(d.eclipseWh) });
      case 'data': case 'databudget': return V(key === 'data' ? 'proof.data' : 'proof.databudget', { down: nf(d.downGbitDay), gen: nf(d.genGbitDay), rec: fmt(d.rec.gbit) });
      case 'life': {
        const max = Math.min(d.radLifeYears, d.reentryYears);
        return V('proof.life', { max: max > 10 ? V('proof.long') : life(round(max, 1)), life: life(d.lifeYears) });
      }
      case 'launch': return V('proof.launch', { wet: fmtKg(d.wet), cap: fmtKg(d.capacity), cost: money(d.costM), budget: d.budget === null ? '∞' : money(d.budget) });
      case 'land': {
        const L = surfaceLoadout(design);
        const near = landingInRange(sc, d.o);
        return V('proof.land', { lift: L ? L.ascent.liftKg : 0, where: V(near ? 'proof.near' : 'proof.far', { site: siteText(sc) }) });
      }
      case 'night': return V('proof.night', { th: marginText((d.therm.cap - d.thermalNeed) / d.thermalNeed), wh: fmt(d.bat.wh), need: fmt(d.eclipseWh) });
      case 'arrive': return V('proof.arrive', { m: fmt((d.o.landing && d.o.landing.accuracyM) || 0), risk: Math.round((d.route.risk || 0) * 100) });
      case 'dust': return V('proof.dust', { pct: Math.round(pb.marginPct) });
      case 'box': return V('proof.box', { kg: fmtKg(d.wet), u: d.launcher.u || '–', cap: fmtKg(d.capacity) });
      default: return '';
    }
  }

  // ---------- Locked choices (item 14) ----------
  // null, or { reason } when this option cannot serve the objective here. A fitted
  // instrument is never locked (taking it out is always allowed).
  function lockOf(design, stepId, optionId) {
    const sc = scenarioOf(design && design.scenario);
    if (!sc) return null;
    if (stepId === 'orbit') {
      const o = sc.orbits.find((x) => x.id === optionId);
      if (!o) return null;
      if (o.lockAlways) return { reason: t(`scn.${sc.id}.orbit.${o.id}.lock`, o.lockAlways) };
      const r = o.lockFor && o.lockFor[design.requirement];
      if (r) return { reason: t(`scn.${sc.id}.orbit.${o.id}.lock.${design.requirement}`, r) };
      return null;
    }
    if (stepId !== 'instruments') return null;
    const inst = INSTRUMENTS[optionId];
    if (!inst || (design.picks.instruments || []).includes(optionId)) return null;
    if (sc.maxInstrumentKg && inst.mass > sc.maxInstrumentKg) return { reason: V('lock.big', { kg: inst.mass }) };
    const d = derive(design);
    const f = d.o.fit && d.o.fit[inst.kind] !== undefined ? d.o.fit[inst.kind] : 1;
    if (f < 0.25) return { reason: V('lock.orbit', { orbit: optionName(sc, 'orbit', d.o) }) };
    if (inst.needsDish && d.ant.diaM < inst.needsDish) return { reason: V('lock.dish', { n: inst.needsDish }) };
    const req = reqOf(sc, design);
    if (!sc.objectives.some((obj) => (req.weights[obj.id] || 0) > 0 && obj.instruments[optionId])) return { reason: V('lock.useless', { req: t(`scn.${sc.id}.req.${req.id}.title`, req.title) }) };
    return null;
  }

  // ---------- CML depth on the cards (item 4) ----------
  const nf = (x, d) => (Math.abs(x) >= 100 ? fmt(x) : String(round(x, d === undefined ? (Math.abs(x) < 10 ? 1 : 0) : d)));
  const HERITAGE_BY_URL = {};
  Object.keys(TD.SRC).forEach((k) => (HERITAGE_BY_URL[TD.SRC[k]] = k));
  function heritageOf(o, key) {
    const k = o && o.source ? HERITAGE_BY_URL[o.source] : null;
    const id = k && TD.HERITAGE[k] ? k : key === 'launcher' ? 'launchers' : 'thermal';
    return t(`her.${id}`, TD.HERITAGE[id]);
  }
  function trlOfCard(sc, st, o) {
    if (st.multi) return (INSTRUMENTS[o.id] && INSTRUMENTS[o.id].trl) || 9;
    return Object.keys(o.picks).reduce((m, k) => {
      const x = pickObj(sc, k, o.picks[k]);
      return Math.min(m, (x && x.trl) || 9);
    }, 9);
  }
  const marginStatus = (m) => (m >= 0.2 ? 'ok' : m >= 0 ? 'warn' : 'bad');
  const marginText = (m) => {
    if (!isFinite(m) || m > 3) return '>+300%';
    const p = Math.round(m * 100);
    return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`;
  };
  function marginOf(stepId, dv) {
    const pb = powerBudget(dv);
    switch (stepId) {
      case 'power': case 'instruments': return { id: 'power', m: (pb.inAvg - pb.load) / Math.max(1e-6, pb.load) };
      case 'batteries': return { id: 'battery', m: (dv.bat.wh - dv.eclipseWh) / Math.max(1e-6, dv.eclipseWh) };
      case 'thermal': return { id: 'thermal', m: (dv.therm.cap - dv.thermalNeed) / dv.thermalNeed };
      case 'radio': case 'ground': return { id: 'comms', m: dv.genGbitDay > 0 ? (dv.downGbitDay - dv.genGbitDay) / dv.genGbitDay : Infinity };
      case 'recorder': return { id: 'data', m: (dv.rec.gbit - dv.bufferNeed) / Math.max(1e-6, dv.bufferNeed) };
      case 'computer': case 'lifetime': return { id: 'life', m: (Math.min(dv.radLifeYears, dv.reentryYears) - dv.lifeYears) / dv.lifeYears };
      default: return { id: 'mass', m: (dv.capacity - dv.wet) / Math.max(1e-6, dv.wet) };
    }
  }
  function specsOf(sc, st, r) {
    const dv = r.dv;
    const s = [];
    const add = (id, value) => value !== undefined && value !== null && value !== '' && s.push({ id, label: V(`spec.${id}`), value });
    const kg = (x) => V('val.kg', { n: nf(x) });
    const w = (x) => V('val.w', { n: nf(x, 0) });
    const money = (x) => moneyText(x);
    switch (st.id) {
      case 'orbit': {
        const o = dv.o;
        add('height', o.apoKm && o.apoKm !== o.altKm ? V('val.kmkm', { a: fmt(o.altKm), b: fmt(o.apoKm) }) : V('val.km', { n: fmt(o.altKm) }));
        add('period', dv.orb.periodMin >= 2880 ? V('val.days', { n: nf(dv.orb.periodDays, 0) }) : V('val.min', { n: fmt(dv.orb.periodMin) }));
        add('dark', V('val.pct', { n: Math.round(dv.orb.eclipse * 100) }));
        add('heritage', heritageOf(o, 'orbit'));
        break;
      }
      case 'power': {
        const p = dv.panel;
        if (p.rtg) add('area', V('val.rtg', { n: p.rtg }));
        else {
          add('area', V('val.m2', { n: nf(p.areaM2, p.areaM2 < 1 ? 2 : 0) }));
          add('eff', V('val.pct', { n: Math.round(p.eff * 100) }));
        }
        add('makes', w(dv.arrayBaseW + dv.rtgW));
        add('mass', kg(panelMass(p)));
        add('cost', money(panelCost(p)));
        add('heritage', heritageOf(p, 'panels'));
        break;
      }
      case 'batteries':
        add('energy', V('val.wh', { n: fmt(dv.bat.wh) }));
        add('density', V('val.whkg', { n: Math.round(dv.bat.wh / Math.max(0.01, dv.bat.mass)) }));
        add('mass', kg(dv.bat.mass));
        add('cost', money(dv.bat.costM));
        add('heritage', heritageOf(dv.bat, 'batteries'));
        break;
      case 'thermal':
        add('mass', kg(dv.thermalMass));
        add('heater', w(dv.heaterW));
        add('cost', dv.therm.costM ? money(dv.therm.costM) : V('val.none'));
        add('heritage', heritageOf(dv.therm, 'thermal'));
        break;
      case 'instruments': {
        const i = INSTRUMENTS[r.o.id];
        add('mass', kg(i.mass));
        add('power', w(i.power));
        add('data', V('val.gbd', { n: nf(i.rate * (sc.rateMult || 1)) }));
        add('cost', money(i.cost));
        add('sci', V('val.sci', { n: Math.round(scienceValue(sc, r.o.id, reqOf(sc, r.d2)) * 100) }));
        add('heritage', heritageOf(i, 'instruments'));
        break;
      }
      case 'radio':
        add('dish', V('val.m', { n: nf(dv.ant.diaM, dv.ant.diaM < 1 ? 2 : 1) }));
        add('rf', V('val.uses', { a: nf(dv.radio.rfW, 0), b: nf(dv.radio.dcW, 0) }));
        add('rate', V('val.mbps', { n: nf(dv.rateMbps, dv.rateMbps < 1 ? 2 : 1) }));
        add('mass', kg(dv.ant.mass + dv.radio.mass));
        add('cost', money(dv.ant.costM + dv.radio.costM));
        add('heritage', heritageOf(dv.radio.source ? dv.radio : dv.ant, 'radio'));
        break;
      case 'ground':
        add('stations', V('val.n', { n: dv.ground.stations }));
        add('contact', V('val.hday', { n: nf(dv.dailySec / 3600, 1) }));
        add('yearly', V('val.peryear', { m: money(dv.groundPerYear) }));
        add('heritage', heritageOf(dv.ground, 'ground'));
        break;
      case 'recorder':
        add('capacity', V('val.gbit', { n: fmt(dv.rec.gbit) }));
        add('mass', kg(dv.rec.mass));
        add('cost', money(dv.rec.costM));
        add('heritage', heritageOf(dv.rec, 'recorder'));
        break;
      case 'computer':
        add('mass', kg(dv.comp.mass + dv.adcs.mass));
        add('power', w(dv.comp.powerW + dv.adcs.powerW));
        add('pointing', V(dv.adcs.pointing >= 1.2 ? 'point.precise' : dv.adcs.pointing >= 0.9 ? 'point.steady' : 'point.rough'));
        add('rad', V('val.krad', { n: fmt(dv.hardness) }));
        add('cost', money(dv.comp.costM + dv.adcs.costM));
        break;
      case 'lifetime':
        add('years', dv.lifeYears === 1 ? V('val.year1') : dv.lifeYears < 1 ? V('val.months', { n: Math.round(dv.lifeYears * 12) }) : V('val.years', { n: dv.lifeYears }));
        add('ops', V('val.peryear', { m: money(dv.sc.opsPerYear + dv.groundPerYear) }));
        add('cost', money(dv.opsM));
        add('dose', V('val.krady', { n: nf(dv.dosePerYear) }));
        break;
      case 'landing': {
        const L = surfaceLoadout(r.d2);
        const air = pickObj(sc, 'oxygen', r.o.picks.oxygen);
        const drill = pickObj(sc, 'drill', r.o.picks.drill);
        add('fuel', kg(L ? L.ascent.extraFuelKg : 0));
        add('lift', kg(L ? L.ascent.liftKg : 0));
        add('air', V('val.days', { n: (air && air.spareO2) || 0 }));
        add('drill', drill && drill.depthM ? V('val.m', { n: drill.depthM }) : V('val.none'));
        add('mass', kg(r.nums.massKg || 0));
        add('cost', money(r.nums.costM || 0));
        break;
      }
      case 'rocket':
        add('liftorbit', kg(dv.capacity));
        add('cost', money(dv.launchM));
        add('heritage', heritageOf(dv.launcher, 'launcher'));
        break;
      default:
        break;
    }
    return s.slice(0, 6);
  }
  function detailOf(sc, st, r, serves) {
    const dv = r.dv;
    const out = [];
    const mg = marginOf(st.id, dv);
    out.push({ id: 'margin', label: V(`det.margin.${mg.id}`), value: marginText(mg.m), status: marginStatus(mg.m) });
    const red = {
      power: dv.panel.rtg ? 'red.rtg' : 'red.wings', batteries: 'red.cells', thermal: dv.therm.id === 'blanket' ? 'red.passive' : 'red.heaters', instruments: 'red.inst', radio: 'red.lga',
      ground: dv.ground.stations > 1 ? 'red.stations' : 'red.station1', recorder: 'red.rec', computer: dv.comp.redundancy > 1 ? 'red.dual' : 'red.single', lifetime: 'red.ops',
      landing: 'red.air', rocket: 'red.rocket', orbit: 'red.orbit',
    }[st.id];
    if (red && !(st.id === 'orbit' && sc.noPropulsion)) out.push({ id: 'redundancy', label: V('det.redundancy'), value: V(red, { n: dv.ground.stations }) });
    let deg = null;
    const years = dv.lifeYears;
    if (st.id === 'power') {
      if (dv.panel.rtg) deg = V('deg.rtg');
      else {
        const k = Math.pow(0.985, years * dv.therm.ageMult);
        deg = V('deg.panels', { w: nf(dv.arrayBaseW * k, 0), pct: nf((1 - k) * 100, 1) });
      }
    } else if (st.id === 'batteries') {
      const k = clamp(1 - 0.03 * years * dv.therm.ageMult, 0.4, 1);
      deg = V('deg.battery', { wh: fmt(dv.bat.wh * k), pct: nf((1 - k) * 100, 1) });
    } else if (st.id === 'thermal') deg = V(dv.therm.ageMult > 1 ? 'deg.thermal.fast' : dv.therm.ageMult < 1 ? 'deg.thermal.slow' : 'deg.thermal.normal');
    else if (st.id === 'computer' || st.id === 'lifetime' || st.id === 'orbit') deg = sc.noPropulsion && st.id !== 'computer' ? V('deg.drag', { n: nf(dv.dragYears, 1) }) : V('deg.rad', { dose: nf(dv.dosePerYear * years), limit: fmt(dv.hardness) });
    if (deg) out.push({ id: 'degrade', label: V('det.degrade'), value: deg });
    const trl = trlOfCard(sc, st, r.o);
    out.push({ id: 'trl', label: V('det.trl'), value: V(`trl.${Math.max(6, Math.min(9, trl))}`) });
    out.push({ id: 'cost', label: V('det.cost'), value: V(trl >= 9 ? 'cost.10' : trl >= 7 ? 'cost.25' : 'cost.50'), status: trl >= 9 ? 'ok' : trl >= 7 ? 'warn' : 'bad' });
    out.push({ id: 'verify', label: V('det.verify'), value: V('det.verify.val', { how: t(`verify.${st.id}`, TD.VERIFY[st.id] || ''), mr: serves.join(', ') }) });
    return out;
  }

  // ---------- AI crewmates (item 2) ----------
  // In solo, the three crewmates pick their own steps: the option that flies best for
  // this requirement and difficulty (crises fixed, the rocket fitted afterwards), and
  // they judge the player's suggestions the same way.
  const PLAN_SEED = 'crew-plan';
  const ACCEPT_TOLERANCE = 30;
  function planScore(design) {
    let d = design;
    if (!isFlyable(d)) {
      const f = fitLauncher(d);
      if (isFlyable(f)) d = f;
    }
    const outcomes = {};
    crisesFor(d, PLAN_SEED).forEach((c) => (outcomes[c.id] = c.kind === 'opportunity' ? 'taken' : 'fixed'));
    const f = fly(d, PLAN_SEED, outcomes);
    // Points earned, with the outcome first: no band clamp, so better is always visible.
    const sc = score(d, f);
    return { full: 3000, partial: 2000, fail: 1000, lost: 0 }[sc.outcome.id] + sc.outcome.earned - 0.0005 * derive(d).costM;
  }
  function crewLine(design, st, optionName) {
    const sc = scenarioOf(design.scenario);
    const dv = derive(design);
    const option = optionName;
    switch (st.id) {
      case 'orbit': return sc.surface && landingInRange(sc, dv.o) ? V('crew.orbit.land', { option, target: siteText(sc) }) : V('crew.orbit', { option });
      case 'power': return V('crew.power', { option, w: fmt(dv.arrayBaseW + dv.rtgW) });
      case 'batteries': return V('crew.batteries', { option });
      case 'thermal': return V(`crew.thermal.${sc.thermalEnv || 'mild'}`, { option });
      case 'instruments': {
        const req = reqOf(sc, design);
        return V('crew.instruments', { list: option, req: t(`scn.${sc.id}.req.${req.id}.title`, req.title) });
      }
      case 'radio': return V('crew.radio', { option, home: nf(dv.downGbitDay), gen: nf(dv.genGbitDay) });
      case 'ground': return V('crew.ground', { option, h: nf(dv.dailySec / 3600, 1) });
      case 'recorder': return V('crew.recorder', { option });
      case 'computer': return V('crew.computer', { option });
      case 'lifetime': return V('crew.lifetime', { option });
      case 'landing': {
        const L = surfaceLoadout(design);
        return L && L.ascent.liftKg > 0 ? V('crew.landing', { option, lift: L.ascent.liftKg }) : V('crew.landing.none', { option });
      }
      case 'rocket': return dv.wet <= dv.capacity ? V('crew.rocket', { option, spare: fmtKg(dv.capacity - dv.wet) }) : V('crew.rocket.none', { option });
      default: return V('crew.pick', { option });
    }
  }
  function subsets(ids, max) {
    const out = [];
    for (let mask = 1; mask < 1 << ids.length; mask++) {
      const set = ids.filter((_, i) => mask & (1 << i));
      if (set.length <= max) out.push(set);
    }
    return out;
  }
  // The crewmate's choice for one step: { option (id, or ids for instruments), design, line }.
  function crewPick(design, stepId) {
    const st = findStep(design, stepId);
    if (!st) return null;
    const free = st.options.filter((o) => !lockOf(design, st.id, o.id) || (st.multi && (design.picks.instruments || []).includes(o.id)));
    if (!free.length) return null;
    if (st.id === 'rocket') {
      const tries = free.map((o) => ({ o, d2: applyStep(design, st.id, o.id) })).filter((x) => !x.d2.error);
      const fits = tries.filter((x) => isFlyable(x.d2)).sort((a, b) => derive(a.d2).launchM - derive(b.d2).launchM);
      const pick = fits[0] || tries.sort((a, b) => derive(b.d2).capacity - derive(a.d2).capacity)[0];
      if (!pick) return null;
      return { option: pick.o.id, design: pick.d2, line: crewLine(pick.d2, st, pick.o.name) };
    }
    if (st.id === 'landing') {
      // The flight cannot value samples, so the scientist brings home as much as the
      // budget and some rocket allow.
      const tries = free
        .map((o) => ({ o, d2: applyStep(design, st.id, o.id) }))
        .filter((x) => !x.d2.error)
        .map((x) => ({ ...x, lift: (surfaceLoadout(x.d2) || { ascent: { liftKg: 0 } }).ascent.liftKg, fitted: fitLauncher(x.d2) }))
        .sort((a, b) => b.lift - a.lift);
      const ok = tries.find((x) => isFlyable(x.fitted) && checks(x.fitted).find((c) => c.id === 'budget').ok) || tries[tries.length - 1];
      if (!ok) return null;
      return { option: ok.o.id, design: ok.d2, line: crewLine(ok.d2, st, ok.o.name) };
    }
    if (st.multi) {
      const lockedOut =(design.picks.instruments || []).filter((id) => !st.options.some((o) => o.id === id));
      let best = null;
      subsets(free.filter((o) => !lockOf({ ...design, picks: { ...design.picks, instruments: [] } }, st.id, o.id)).map((o) => o.id), st.max || 3).forEach((ids) => {
        const d2 = set(design, 'scientist', 'instruments', lockedOut.concat(ids).slice(0, st.max || 3));
        if (!d2 || d2.error) return;
        const sc2 = planScore(d2);
        if (!best || sc2 > best.score + 1e-9) best = { ids, d2, score: sc2 };
      });
      if (!best) return null;
      const names = best.ids.map((id) => (st.options.find((o) => o.id === id) || {}).name).filter(Boolean);
      return { option: best.ids, design: best.d2, line: crewLine(best.d2, st, names.join(', ')) };
    }
    let best = null;
    free.forEach((o) => {
      const d2 = applyStep(design, st.id, o.id);
      if (!d2 || d2.error) return;
      const s2 = planScore(d2);
      if (!best || s2 > best.score + 1e-9) best = { o, d2, score: s2 };
    });
    if (!best) return null;
    return { option: best.o.id, design: best.d2, line: crewLine(best.d2, st, best.o.name) };
  }
  // The whole crew's plan for the steps they own: the coupled core (instruments, radio,
  // power) is searched together, then everyone re-checks their own step twice, and the
  // rocket comes last. -> { design, picks: { stepId: { option, line } } }
  function crewPlan(design, stepIds) {
    const ids = (stepIds || []).filter((id) => findStep(design, id));
    let d = design;
    const core = ['instruments', 'radio', 'power'].filter((id) => ids.includes(id));
    if (core.length > 1) {
      const choices = core.map((id) => {
        const st = findStep(d, id);
        if (st.multi) return subsets(st.options.filter((o) => !lockOf({ ...d, picks: { ...d.picks, instruments: [] } }, id, o.id)).map((o) => o.id), st.max || 3).map((x) => ({ multi: true, value: x }));
        return st.options.filter((o) => !lockOf(d, id, o.id)).map((o) => ({ value: o.id }));
      });
      let best = null;
      const walk = (i, cur) => {
        if (i === core.length) {
          const sc2 = planScore(cur);
          if (!best || sc2 > best.score + 1e-9) best = { d: cur, score: sc2 };
          return;
        }
        choices[i].forEach((c) => {
          const n = c.multi ? set(cur, 'scientist', 'instruments', c.value) : applyStep(cur, core[i], c.value);
          if (n && !n.error) walk(i + 1, n);
        });
      };
      walk(0, d);
      if (best) d = best.d;
    }
    const order = ids.filter((id) => id !== 'rocket');
    for (let round = 0; round < 2; round++) {
      order.forEach((id) => {
        const p = crewPick(d, id);
        if (p && p.design && !p.design.error) d = p.design;
      });
    }
    if (ids.includes('rocket')) {
      const p = crewPick(d, 'rocket');
      if (p && p.design && !p.design.error) d = p.design;
    }
    const picks = {};
    ids.forEach((id) => {
      const st = findStep(d, id);
      const now = stepChoice(d, st);
      const names = (Array.isArray(now) ? now : [now]).map((x) => (st.options.find((o) => o.id === x) || {}).name).filter(Boolean).join(', ');
      picks[id] = { option: now, line: crewLine(d, st, names) };
    });
    return { design: d, picks };
  }
  // A crewmate's answer to a suggestion: { ok, line, design (when ok) }.
  function crewReview(design, stepId, optionId) {
    const st = findStep(design, stepId);
    if (!st) return { ok: false, line: V('crew.no.error') };
    const lock = lockOf(design, stepId, optionId);
    if (lock) return { ok: false, line: V('crew.no.locked', { reason: lock.reason }) };
    const next = applyStep(design, stepId, optionId);
    if (!next || next.error) return { ok: false, line: next && typeof next.error === 'string' ? next.error : V('crew.no.error') };
    if (stepId === 'landing') {
      // Samples are judged on the surface: fine as long as we can afford and lift it.
      const fitted = fitLauncher(next);
      const bad = checks(fitted).find((c) => (c.id === 'launcher' || c.id === 'budget') && !c.ok);
      return bad ? { ok: false, line: V('crew.no.check', { check: bad.text }), gain: 0 } : { ok: true, line: V('crew.yes.same'), design: next, gain: 0, pickLine: crewLine(next, findStep(next, stepId), (findStep(next, stepId).options.find((o) => o.id === optionId) || {}).name || optionId) };
    }
    const gain = Math.round(planScore(next) - planScore(design));
    const before = {};
    checks(design).forEach((c) => (before[c.id] = c.ok));
    const after = checks(next).filter((c) => c.id !== 'launcher');
    const broke = after.find((c) => !c.ok && before[c.id]);
    const fixed = after.find((c) => c.ok && before[c.id] === false);
    if (gain >= -ACCEPT_TOLERANCE && !(broke && gain < 5)) {
      const line = gain > 5 ? V('crew.yes.better', { n: gain }) : fixed ? V('crew.yes.fix', { check: fixed.text }) : V('crew.yes.same');
      const st2 = findStep(next, stepId);
      const now = stepChoice(next, st2);
      const names = (Array.isArray(now) ? now : [now]).map((x) => (st2.options.find((o) => o.id === x) || {}).name).filter(Boolean).join(', ');
      return { ok: true, line, design: next, gain, pickLine: crewLine(next, st2, names) };
    }
    return { ok: false, line: broke ? V('crew.no.check', { check: broke.text }) : V('crew.no.worse', { n: -gain }), gain };
  }

  // ---------- 3D craft ----------
  function toCraftDesign(design) {
    const d = derive(design);
    const CUBE = { cubeCam: 'context', cubeWide: 'context', cubeTir: 'irspec', cubeHyper: 'irspec' };
    const instruments = (design.picks.instruments || []).map((id) => CUBE[id] || id).filter((id, i, a) => a.indexOf(id) === i && ['hires', 'context', 'irspec', 'neutron', 'sounder', 'iceRadar', 'sar', 'mag', 'uso'].includes(id));
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
      cubesat: !!d.sc.cubesat,
      units: d.launcher.u || null,
      thermal: d.therm.id,
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
    // v3 (docs/TEAM-V3.md "As built (v3: build)")
    segments,
    cml,
    traceability,
    requirementStatus,
    lockOf,
    crewPick,
    crewPlan,
    crewReview,
    _derive: derive,
    _hash: hash,
  };
  if (typeof module === 'object' && module.exports) module.exports = SMD.team.sim;
})();
