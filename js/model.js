// The spacecraft model: turns a design into masses, power, cost, risk,
// launch options and expected science. Pure functions, no DOM.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const P = SMD.physics;
  const D = SMD.data;
  const { MISSIONS, INSTRUMENTS, OPTIONS, CONST } = D;
  const DAY_MS = 864e5;

  const opt = (list, id) => list.find((o) => o.id === id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function defaultDesign(missionKey, name) {
    const near = MISSIONS[missionKey].kind !== 'planet';
    if (MISSIONS[missionKey].kind === 'crew') return crewDefault(missionKey, name);
    return {
      mission: missionKey,
      name,
      instruments: [],
      arrays: missionKey === 'jupiter' ? 40 : near ? 4 : 6,
      rtg: 0,
      dish: near ? 1 : 2,
      amp: near ? 25 : 50,
      recorder: near ? 64 : 256,
      avionics: 'single',
      shield: 0,
      ground: 8,
      margin: 10,
      capture: missionKey === 'jupiter' || near ? 'propulsive' : 'aerobrake',
      launcher: missionKey === 'jupiter' ? 'heavy' : near ? 'light' : 'medium',
      route: missionKey === 'jupiter' ? 'ega' : 'direct',
      ballast: 0,
      cellBoost: 1, // research upgrades, copied in when a project is approved
      panelMass: 1,
    };
  }

  // ---------- Crewed missions ----------
  // A crew design is a normal design plus five crew fields (OPTIONS.lifeDays,
  // heatShield, abort, shelter, entry). Defaults follow Artemis II.
  const isCrew = (design) => !!design && !!MISSIONS[design.mission] && MISSIONS[design.mission].kind === 'crew';
  function crewDefault(missionKey, name) {
    return {
      mission: missionKey,
      name,
      instruments: [],
      arrays: 24,
      rtg: 0,
      dish: 1,
      amp: 25,
      recorder: 256,
      avionics: 'single',
      shield: 0,
      ground: 8,
      margin: 10,
      capture: 'propulsive',
      launcher: 'superheavy',
      route: 'direct',
      ballast: 0,
      cellBoost: 1,
      panelMass: 1,
      lifeDays: 21,
      heatShield: 1350,
      abort: 1,
      shelter: 150,
      entry: 'direct',
    };
  }
  // Crew fields with safe fallbacks (old saves, partial designs).
  function crewFields(design) {
    const pick = (list, v, def) => (opt(list, v) ? v : def);
    return {
      lifeDays: pick(OPTIONS.lifeDays, Number(design.lifeDays), 21),
      heatShield: pick(OPTIONS.heatShield, Number(design.heatShield), 1350),
      abort: Number(design.abort) ? 1 : 0,
      shelter: pick(OPTIONS.shelter, Number(design.shelter), 0),
      entry: design.entry === 'skip' ? 'skip' : 'direct',
    };
  }
  // The rocket that really flies: crewed missions always ride a crew-rated
  // launcher, robotic ones never do (whatever the design field says).
  function launcherFor(design) {
    const m = MISSIONS[design.mission];
    const l = opt(OPTIONS.launcher, design.launcher);
    if (m && m.kind === 'crew') return l && l.crewOnly ? l.id : (m.launchers && m.launchers[0]) || 'superheavy';
    return l && !l.crewOnly ? l.id : 'heavy';
  }
  // Heat shield capacity against the heat of the way home (1 = just enough).
  // charLoss: the Artemis I problem; steep: no fuel left to trim the entry path.
  function shieldRatio(cf, extra) {
    const x = extra || {};
    let load = cf.entry === 'skip' ? 1.1 : 1; // a skip entry heats for longer
    if (x.charLoss) load *= cf.entry === 'skip' ? 1.25 : 1.08; // Artemis I's char loss came from the skip
    if (x.steep) load *= 1.15;
    return cf.heatShield / D.CREW.shieldRef / load;
  }

  function computeCrewBase(design) {
    const m = MISSIONS[design.mission];
    const C = D.CREW;
    const cf = crewFields(design);
    const planet = P.PLANETS[m.dest];
    const insts = design.instruments.map((id) => ({ id, ...INSTRUMENTS[id] }));
    const instrMass = insts.reduce((s, x) => s + x.mass, 0);
    const instrPower = insts.reduce((s, x) => s + x.power, 0);
    const instrCost = insts.reduce((s, x) => s + x.cost, 0);
    const dish = opt(OPTIONS.dish, design.dish) || OPTIONS.dish[0];
    const amp = opt(OPTIONS.amp, design.amp) || OPTIONS.amp[0];
    const rec = opt(OPTIONS.recorder, design.recorder) || OPTIONS.recorder[0];
    const av = opt(OPTIONS.avionics, design.avionics) || OPTIONS.avionics[0];
    const shield = opt(OPTIONS.shield, design.shield) || OPTIONS.shield[0];
    const ground = opt(OPTIONS.ground, design.ground) || OPTIONS.ground[1];
    const life = opt(OPTIONS.lifeDays, cf.lifeDays);
    const hs = opt(OPTIONS.heatShield, cf.heatShield);
    const las = opt(OPTIONS.abort, cf.abort);
    const shel = opt(OPTIONS.shelter, cf.shelter);

    const flux = P.solarFlux(planet.a);
    const arrayW = design.arrays * flux * CONST.cellEff * m.arrayFactor * (design.cellBoost || 1);
    const powerAvail = arrayW;
    const fixedW = CONST.busPowerW + amp.dcW + m.heaterW;
    const powerReq = fixedW + instrPower;
    const powerMargin = powerAvail / powerReq;
    const instrDuty = instrPower > 0 ? clamp((powerAvail - fixedW) / instrPower, 0, 1) : 1;
    const powerSysMass = design.arrays * CONST.arrayKgPerM2 * (design.panelMass || 1) + CONST.batteryMass;
    const commsMass = dish.mass + amp.mass;
    // Crew module: cabin, crew, consumables, heat shield, storm shelter, avionics, cameras.
    const cmKg = C.cmBaseKg + C.people * C.crewKg + life.mass + hs.mass + shel.mass + av.mass + rec.mass + commsMass + instrMass;
    // Service module: engine, tanks, structure and the solar wings.
    const smKg = C.smBaseKg + powerSysMass;
    const dryNoProp = cmKg + smKg + (design.ballast || 0);
    const fixedDv = C.dv.perigee + C.dv.tli + C.dv.tcm + C.dv.reserve;
    const hwCost = C.capsuleCost + life.cost + hs.cost + las.cost + shel.cost + instrCost + design.arrays * CONST.arrayCostPerM2 + dish.cost + amp.cost + rec.cost + av.cost;
    const risk = {
      structure: 0.08,
      deploy: 0.12, // parachutes and solar wings
      thermal: 0.1 + m.thermalRisk,
      power: 0.1,
      avionics: 0.25,
      comms: 0.08,
      propulsion: 0.14, // Artemis II flew with a troublesome propellant valve
      lifeSupport: 0.28, // Artemis II's water valve and toilet both gave trouble
      heatShield: 0.15, // Artemis I's Avcoat shed char where nobody expected it (tests cannot see it)
      ascent: 0.05,
    };
    const instRisk = {};
    insts.forEach((x) => (instRisk[x.id] = x.flaw));
    const expectedFlaws = Object.values(risk).reduce((s, x) => s + x, 0) + Object.values(instRisk).reduce((s, x) => s + x, 0);
    const devFactor = (D.CONTRACTS && D.CONTRACTS[m.key] && D.CONTRACTS[m.key].devFactor) || 1;
    const devMonths = devFactor * (CONST.devBaseMonths + C.devExtraMonths + 0.8 * insts.length + (design.avionics === 'dual' ? 1 : 0));
    return {
      mission: m,
      planet,
      insts,
      instrMass,
      instrPower,
      instrCost,
      arrayW,
      rtgW: 0,
      powerAvail,
      powerReq,
      powerMargin,
      instrDuty,
      powerSysMass,
      commsMass,
      structure: 0,
      thermal: 0,
      dryNoProp,
      fixedDv,
      hwCost,
      risk,
      instRisk,
      expectedFlaws,
      devMonths,
      readyMs: addMonths(D.PROJECT_START, devMonths),
      dish,
      amp,
      rec,
      av,
      shield,
      ground,
      crew: {
        ...cf,
        cmKg,
        smKg,
        lasKg: cf.abort ? C.lasKg : 0,
        lasLift: cf.abort ? C.lasKg * C.lasLiftShare : 0,
        shieldRatio: shieldRatio(cf),
        shieldRatioBad: shieldRatio(cf, { charLoss: true }),
        lifeNeed: C.missionDays + C.reserveDays,
      },
    };
  }

  // Best camera on board for the far-side photos (else the crew's handheld cameras).
  function crewCamera(design, quality) {
    const q = quality || {};
    const obj = MISSIONS[design.mission].objectives.find((o) => o.id === 'farside');
    let best = 0.35;
    design.instruments.forEach((id) => (best = Math.max(best, (obj.instruments[id] || 0) * (q[id] !== undefined ? q[id] : 1))));
    return best;
  }
  // Score from the three crew goals (fractions 0..1). Crew safety is the key goal.
  function crewScore(home, photos, life) {
    const fractions = { home: clamp(home, 0, 1), farside: clamp(photos, 0, 1), life: clamp(life, 0, 1) };
    let total = 0;
    MISSIONS.crew.objectives.forEach((o) => (total += o.weight * fractions[o.id]));
    return { fractions, total, keyFrac: fractions.home, headline: total >= 70 && fractions.home >= 0.8 };
  }
  // Expected result if nothing breaks and the Sun stays quiet (the flight
  // itself, with flaws and storms, is SMD.ops.crewFlight).
  function crewExpected(design, base) {
    const ratio = base.crew.shieldRatio;
    const home = ratio < 0.8 ? 0 : ratio < 1 ? 0.8 : 1;
    const photos = home ? crewCamera(design) * 0.85 : 0;
    const life = home ? (base.powerMargin < 1 ? 0.8 : 1) : 0;
    return crewScore(home, photos, life);
  }

  // ---------- Launch grid (design independent, cached) ----------
  const GRID_START = Date.UTC(2027, 0, 1);
  const GRID_DAYS = 3650;
  const GRID_COLS = 365;
  const GRID_ROWS = 41;
  const gridCache = {};

  function baseGrid(missionKey) {
    if (gridCache[missionKey]) return gridCache[missionKey];
    const m = MISSIONS[missionKey];
    const [t0, t1] = m.tofRange;
    const deps = [];
    const tofs = [];
    for (let i = 0; i < GRID_COLS; i++) deps.push(GRID_START + Math.round((i * GRID_DAYS) / GRID_COLS) * DAY_MS);
    for (let j = 0; j < GRID_ROWS; j++) tofs.push(t0 + ((t1 - t0) * j) / (GRID_ROWS - 1));
    const c3 = new Float32Array(GRID_COLS * GRID_ROWS).fill(NaN);
    const vinf = new Float32Array(GRID_COLS * GRID_ROWS).fill(NaN);
    for (let i = 0; i < GRID_COLS; i++) {
      for (let j = 0; j < GRID_ROWS; j++) {
        const tr = P.transfer(m.dest, deps[i], tofs[j]);
        if (!tr) continue;
        c3[j * GRID_COLS + i] = tr.c3;
        vinf[j * GRID_COLS + i] = tr.vinfArr;
      }
    }
    return (gridCache[missionKey] = { deps, tofs, c3, vinf, cols: GRID_COLS, rows: GRID_ROWS });
  }

  // A launch option for one grid cell, adjusted for the chosen route.
  function cellLaunch(missionKey, route, i, j) {
    const g = baseGrid(missionKey);
    const k = j * g.cols + i;
    let c3 = g.c3[k];
    const vinf = g.vinf[k];
    if (!Number.isFinite(c3) || !Number.isFinite(vinf)) return null;
    let tof = g.tofs[j];
    let dsm = 0;
    if (route === 'ega') {
      // Simplified Earth gravity assist (like Juno): a cheaper launch, a
      // deep-space burn and about two extra years of cruise.
      c3 = 0.4 * c3 + 4;
      tof += CONST.egaExtraDays;
      dsm = CONST.egaDsmDv;
    }
    return { mission: missionKey, i, j, departMs: g.deps[i], tofDays: tof, arriveMs: g.deps[i] + tof * DAY_MS, c3, vinfArr: vinf, dsmDv: dsm, route };
  }

  // Mass a launcher can lift: to low Earth orbit, or to a departure energy C3.
  const launcherCapacity = (launcherId, c3, leo) => {
    const l = opt(OPTIONS.launcher, launcherId);
    if (leo) return l.leo;
    return l.c0 * Math.exp(-Math.max(0, c3) / l.scale);
  };

  // ---------- Window-independent part of the design ----------
  function computeBase(design) {
    if (isCrew(design)) return computeCrewBase(design);
    const m = MISSIONS[design.mission];
    const planet = P.PLANETS[m.dest];
    const insts = design.instruments.map((id) => ({ id, ...INSTRUMENTS[id] }));
    const instrMass = insts.reduce((s, x) => s + x.mass, 0);
    const instrPower = insts.reduce((s, x) => s + x.power, 0);
    const instrCost = insts.reduce((s, x) => s + x.cost, 0);

    const dish = opt(OPTIONS.dish, design.dish);
    const amp = opt(OPTIONS.amp, design.amp);
    const rec = opt(OPTIONS.recorder, design.recorder);
    const av = opt(OPTIONS.avionics, design.avionics);
    const shield = opt(OPTIONS.shield, design.shield);
    const ground = opt(OPTIONS.ground, design.ground);

    // Power at the destination.
    const flux = P.solarFlux(planet.a);
    const arrayW = design.arrays * flux * CONST.cellEff * m.arrayFactor * (design.cellBoost || 1);
    const rtgW = design.rtg * CONST.rtg.watts;
    const powerAvail = arrayW + rtgW;
    const fixedW = CONST.busPowerW + amp.dcW + m.heaterW;
    const powerReq = fixedW + instrPower;
    const powerMargin = powerAvail / powerReq;
    const instrDuty = instrPower > 0 ? clamp((powerAvail - fixedW) / instrPower, 0, 1) : 1;
    const powerSysMass = design.arrays * CONST.arrayKgPerM2 * (design.panelMass || 1) + design.rtg * CONST.rtg.mass + CONST.batteryMass;

    const commsMass = dish.mass + amp.mass;
    const subtotal = instrMass + powerSysMass + commsMass + rec.mass + av.mass + design.shield + design.ballast;
    const structure = subtotal * CONST.structureFrac;
    const thermal = (subtotal + structure) * m.thermalFrac;
    const dryNoProp = subtotal + structure + thermal + CONST.engineMass;

    // Delta-v that does not depend on the arrival speed.
    const aero = design.capture === 'aerobrake' && m.aerobrake;
    const fixedDv = CONST.tcmDv + m.maintDv + (aero ? m.aerobrake.finishDv : 0);

    // Hardware cost (launcher, ops and propellant tanks come later).
    const hwCost =
      CONST.busCostBase +
      instrCost +
      design.arrays * CONST.arrayCostPerM2 +
      design.rtg * CONST.rtg.cost +
      dish.cost +
      amp.cost +
      rec.cost +
      av.cost +
      design.shield * CONST.shieldCostPerKg;

    const hasMag = design.instruments.includes('mag');
    const risk = {
      structure: 0.12 + dryNoProp / 5000,
      deploy: 0.12 + design.arrays * 0.002 + (design.dish === 3 ? 0.06 : 0) + (hasMag ? 0.05 : 0),
      thermal: 0.12 + m.thermalRisk,
      power: 0.1 + (design.arrays > 40 ? 0.05 : 0) + (design.rtg ? 0.03 : 0),
      avionics: 0.3,
      comms: 0.1 + (design.amp === 100 ? 0.03 : 0),
      propulsion: 0.12,
      radiation: m.radiation ? clamp(0.75 - design.shield / 200, 0.05, 0.75) : 0.03,
    };
    const instRisk = {};
    insts.forEach((x) => (instRisk[x.id] = x.flaw));
    const expectedFlaws = Object.values(risk).reduce((s, x) => s + x, 0) + Object.values(instRisk).reduce((s, x) => s + x, 0);

    const devFactor = (D.CONTRACTS && D.CONTRACTS[m.key] && D.CONTRACTS[m.key].devFactor) || 1;
    const devMonths =
      devFactor *
      (CONST.devBaseMonths + 0.8 * insts.length + (design.rtg ? CONST.rtg.devMonths : 0) + (design.avionics === 'dual' ? 1 : 0) + dryNoProp / 500 + (design.dish === 3 ? 0.5 : 0));

    return {
      mission: m,
      planet,
      insts,
      instrMass,
      instrPower,
      instrCost,
      arrayW,
      rtgW,
      powerAvail,
      powerReq,
      powerMargin,
      instrDuty,
      powerSysMass,
      commsMass,
      structure,
      thermal,
      dryNoProp,
      fixedDv,
      hwCost,
      risk,
      instRisk,
      expectedFlaws,
      devMonths,
      readyMs: addMonths(D.PROJECT_START, devMonths),
      dish,
      amp,
      rec,
      av,
      shield,
      ground,
    };
  }

  function addMonths(ms, months) {
    return ms + months * 30.44 * DAY_MS;
  }

  // Propellant and wet mass for a total delta-v, with tanks scaling with propellant.
  function wetFor(dryNoProp, dv, marginPct) {
    const dvm = dv * (1 + marginPct / 100);
    const R = Math.exp(dvm / (CONST.isp * P.G0)) - 1;
    const denom = 1 - CONST.tankFrac * R;
    if (denom <= 0.1) return { prop: Infinity, dry: Infinity, wet: Infinity, dv: dvm };
    const prop = (dryNoProp * R) / denom;
    const dry = dryNoProp + CONST.tankFrac * prop;
    return { prop, dry, wet: dry + prop, dv: dvm, dvNominal: dv };
  }

  function arrivalDv(base, design, vinfArr) {
    const m = base.mission;
    if (m.kind === 'earth' || m.kind === 'crew') return 0; // straight into orbit, or a free return that needs no capture
    const pl = base.planet;
    const aero = design.capture === 'aerobrake' && m.aerobrake;
    const orbit = aero ? m.captureOrbit : m.scienceOrbit;
    return P.captureDv(vinfArr, pl.mu, pl.radius + orbit.rpAlt, pl.radius + orbit.raAlt);
  }

  // Everything that depends on the launch choice.
  function computeLaunch(base, design, launch) {
    const m = base.mission;
    const capture = arrivalDv(base, design, launch.vinfArr);
    const dvTotal = capture + base.fixedDv + launch.dsmDv;
    const mass = wetFor(base.dryNoProp, dvTotal, design.margin);
    const crew = m.kind === 'crew';
    const lid = launcherFor(design);
    // The abort tower rides only the first minutes of the climb: it costs part of its mass in lift.
    const capacity = launcherCapacity(lid, launch.c3, launch.leo) - (crew ? base.crew.lasLift : 0);
    const aeroDays = design.capture === 'aerobrake' && m.aerobrake ? m.aerobrake.days : 0;
    const scienceStartMs = crew ? launch.departMs : launch.arriveMs + (aeroDays + 30) * DAY_MS;
    const missionYears = crew ? launch.tofDays / 365.25 : (launch.tofDays + aeroDays + 30 + m.turns * m.turnDays) / 365.25;
    const opsCost = missionYears * (CONST.opsBasePerYear + base.ground.costPerYear) + (crew ? D.CREW.opsFixed : 0);
    const launcherCost = opt(OPTIONS.launcher, lid).cost;
    const waitMonths = Math.max(0, (launch.departMs - base.readyMs) / (30.44 * DAY_MS));
    const storageCost = waitMonths * CONST.storagePerMonth;
    const busMassCost = mass.dry * (crew ? D.CREW.costPerKg : CONST.busCostPerKg);
    return {
      launch,
      captureDv: capture,
      dvTotal,
      ...mass,
      capacity,
      launchMargin: capacity - mass.wet,
      aeroDays,
      scienceStartMs,
      missionYears,
      opsCost,
      launcherCost,
      waitMonths,
      storageCost,
      busMassCost,
    };
  }

  // Near-Earth missions can launch any month.
  function nearLaunch(m, readyMs) {
    const d = new Date(readyMs);
    const departMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (d.getUTCDate() > 1 ? 1 : 0), 1);
    const lunar = m.kind === 'moon' || m.kind === 'crew';
    const tofDays = lunar ? m.tofDays : 1;
    return {
      mission: m.key,
      departMs,
      tofDays,
      arriveMs: departMs + tofDays * DAY_MS,
      c3: lunar ? -2 : 0,
      leo: m.kind === 'earth',
      vinfArr: m.kind === 'moon' ? m.vinf : 0,
      dsmDv: 0,
      route: 'direct',
    };
  }

  // Launch windows (planets only): spans of dates when the trip is cheap.
  const windowCache = {};
  function windows(missionKey, route) {
    const key = missionKey + route;
    if (windowCache[key]) return windowCache[key];
    const g = baseGrid(missionKey);
    const best = [];
    for (let i = 0; i < g.cols; i++) {
      let lo = Infinity;
      for (let j = 0; j < g.rows; j++) {
        const L = cellLaunch(missionKey, route, i, j);
        if (L && L.c3 < lo) lo = L.c3;
      }
      best.push(lo);
    }
    const minAll = Math.min(...best.filter(Number.isFinite));
    const limit = minAll * 1.6 + 4;
    const out = [];
    let cur = null;
    best.forEach((c3, i) => {
      if (c3 <= limit) {
        if (!cur) cur = { startMs: g.deps[i], endMs: g.deps[i], bestMs: g.deps[i], minC3: c3 };
        cur.endMs = g.deps[i];
        if (c3 < cur.minC3) {
          cur.minC3 = c3;
          cur.bestMs = g.deps[i];
        }
      } else if (cur) {
        out.push(cur);
        cur = null;
      }
    });
    if (cur) out.push(cur);
    return (windowCache[key] = out);
  }

  // The best launch in the first window after the spacecraft is ready.
  function referenceLaunch(base, design, readyMs) {
    if (base.mission.kind !== 'planet') return computeLaunch(base, design, nearLaunch(base.mission, readyMs));
    const g = baseGrid(design.mission);
    let best = null;
    let inWindow = false;
    for (let i = 0; i < g.cols; i++) {
      if (g.deps[i] < readyMs) continue;
      let colBest = null;
      for (let j = 0; j < g.rows; j++) {
        const L = cellLaunch(design.mission, design.route, i, j);
        if (!L) continue;
        const r = computeLaunch(base, design, L);
        if (r.launchMargin >= 0 && (!colBest || r.launchMargin > colBest.launchMargin)) colBest = r;
      }
      if (colBest) {
        inWindow = true;
        if (!best || colBest.launchMargin > best.launchMargin) best = colBest;
      } else if (inWindow) break;
    }
    if (best) return best;
    // Nothing fits: report the launch with the lowest energy after ready.
    let low = null;
    for (let i = 0; i < g.cols; i++) {
      if (g.deps[i] < readyMs) continue;
      for (let j = 0; j < g.rows; j++) {
        const L = cellLaunch(design.mission, design.route, i, j);
        if (!L) continue;
        if (!low || L.c3 < low.c3) low = L;
      }
    }
    return low ? computeLaunch(base, design, low) : null;
  }

  // ---------- Science operations ----------
  // Close to Earth the link is limited by the ground station, not the distance.
  const NEAR_RATE_CAP = 150; // Mbit/s
  function linkRateMbps(design, distAU, factor) {
    const r = (CONST.linkK * design.amp * design.dish * design.dish) / (distAU * distAU);
    return Math.min(NEAR_RATE_CAP, r) * (factor || 1);
  }

  // Data each instrument contributes to each objective (quality 0..1).
  function objectiveQuality(mission, design, objective, instId) {
    let q = objective.instruments[instId] || 0;
    const inst = INSTRUMENTS[instId];
    if (q && inst.needsDish && design.dish < inst.needsDish) q *= 0.3;
    return q;
  }

  // Downlink forecast per turn from real planet geometry.
  function forecast(design, scienceStartMs, health) {
    const m = MISSIONS[design.mission];
    const turns = [];
    const rateFactor = health ? health.rateFactor : 1;
    for (let t = 0; t < m.turns; t++) {
      const start = scienceStartMs + t * m.turnDays * DAY_MS;
      const days = [];
      let cap = 0;
      let blackout = 0;
      let distSum = 0;
      for (let d = 0; d < m.turnDays; d++) {
        const ms = start + d * DAY_MS;
        let dist;
        let sep = 180;
        if (m.kind === 'planet') {
          const e = P.planetState('earth', ms).r;
          const p = P.planetState(m.dest, ms).r;
          dist = P.norm(P.sub(p, e)) / P.AU;
          sep = P.sepAngle(e, p);
        } else dist = m.kind === 'moon' ? 0.00257 : 0.00001;
        const black = sep < CONST.blackoutDeg;
        const gbit = black ? 0 : (linkRateMbps(design, dist, rateFactor) * design.ground * 3600) / 1000;
        days.push({ ms, dist, sep, black, gbit });
        cap += gbit;
        if (black) blackout++;
        distSum += dist;
      }
      turns.push({ t, start, days, capacity: cap, blackout, dist: distSum / m.turnDays });
    }
    return turns;
  }

  function newScienceState(design, base, scienceStartMs, health) {
    const ids = design.instruments.slice();
    const st = {
      turn: 0,
      ids,
      buffer: {},
      bufferQ: {},
      delivered: {},
      deliveredQ: {},
      generated: {},
      lost: {},
      forecast: forecast(design, scienceStartMs, health),
      health: health || defaultHealth(design),
      history: [],
    };
    ids.forEach((id) => {
      st.buffer[id] = 0;
      st.bufferQ[id] = 0;
      st.delivered[id] = 0;
      st.deliveredQ[id] = 0;
      st.generated[id] = 0;
      st.lost[id] = 0;
    });
    st.base = base;
    return st;
  }

  function defaultHealth(design) {
    const q = {};
    design.instruments.forEach((id) => (q[id] = 1));
    return { instQuality: q, dead: {}, rateFactor: 1, powerFactor: 1, orbitQuality: 1, skipTurns: {}, turnQuality: {} };
  }

  // Smart default priorities: favour data that closes the most science per gigabit.
  function autoPriorities(design, st) {
    const m = MISSIONS[design.mission];
    const fr = objectiveFractions(design, st);
    const w = {};
    st.ids.forEach((id) => {
      let s = 0;
      m.objectives.forEach((o) => {
        const q = objectiveQuality(m, design, o, id);
        if (q > 0) s += (o.weight * q * (1 - fr[o.id])) / o.needGbit;
      });
      w[id] = s;
    });
    const max = Math.max(1e-12, ...Object.values(w));
    const out = {};
    st.ids.forEach((id) => (out[id] = w[id] > 0 ? Math.max(1, Math.round((w[id] / max) * 4)) : 0));
    return out;
  }

  function objectiveFractions(design, st) {
    const m = MISSIONS[design.mission];
    const out = {};
    m.objectives.forEach((o) => {
      let eff = 0;
      st.ids.forEach((id) => (eff += st.deliveredQ[id] * objectiveQuality(m, design, o, id)));
      out[o.id] = clamp(eff / o.needGbit, 0, 1);
    });
    return out;
  }

  // Simulate one turn of science operations, one day at a time.
  // priorities: { instId: 0..4 }, on: { instId: bool }
  function stepScience(design, st, priorities, on) {
    const m = MISSIONS[design.mission];
    const base = st.base;
    const h = st.health;
    const turn = st.forecast[st.turn];
    const rec = design.recorder;
    const skip = !!h.skipTurns[st.turn];
    const powerAvail = base.powerAvail * h.powerFactor;
    const fixedW = CONST.busPowerW + base.amp.dcW + m.heaterW;
    const onIds = st.ids.filter((id) => on[id] !== false && !(h.dead[id] !== undefined && st.turn >= h.dead[id]));
    const onPower = onIds.reduce((s, id) => s + INSTRUMENTS[id].power, 0);
    const duty = onPower > 0 ? clamp((powerAvail - fixedW) / onPower, 0, 1) : 1;
    const summary = { turn: st.turn, generated: 0, sent: 0, lost: 0, duty, skip, capacity: turn.capacity };

    for (const day of turn.days) {
      if (!skip) {
        for (const id of onIds) {
          const inst = INSTRUMENTS[id];
          const g = inst.rate * (inst.continuous ? 1 : m.flybyDuty) * duty;
          const tq = (h.turnQuality[st.turn] && h.turnQuality[st.turn][id]) || 1;
          const q = h.instQuality[id] * h.orbitQuality * tq;
          st.buffer[id] += g;
          st.bufferQ[id] += g * q;
          st.generated[id] += g;
          summary.generated += g;
        }
      }
      // Downlink by priority.
      let cap = day.gbit;
      for (let pass = 0; pass < 6 && cap > 1e-9; pass++) {
        const active = st.ids.filter((id) => st.buffer[id] > 1e-9 && (priorities[id] || 0) > 0);
        const wsum = active.reduce((s, id) => s + priorities[id], 0);
        if (!wsum) break;
        let used = 0;
        for (const id of active) {
          const share = (cap * priorities[id]) / wsum;
          const take = Math.min(share, st.buffer[id]);
          const qRatio = st.buffer[id] > 0 ? st.bufferQ[id] / st.buffer[id] : 0;
          st.buffer[id] -= take;
          st.bufferQ[id] -= take * qRatio;
          st.delivered[id] += take;
          st.deliveredQ[id] += take * qRatio;
          used += take;
        }
        cap -= used;
        summary.sent += used;
        if (used < 1e-9) break;
      }
      // Recorder overflow: lowest priority data is overwritten first.
      let total = st.ids.reduce((s, id) => s + st.buffer[id], 0);
      if (total > rec) {
        const order = st.ids.slice().sort((a, b) => (priorities[a] || 0) - (priorities[b] || 0) || st.buffer[b] - st.buffer[a]);
        for (const id of order) {
          if (total <= rec) break;
          const drop = Math.min(st.buffer[id], total - rec);
          const qRatio = st.buffer[id] > 0 ? st.bufferQ[id] / st.buffer[id] : 0;
          st.buffer[id] -= drop;
          st.bufferQ[id] -= drop * qRatio;
          st.lost[id] += drop;
          summary.lost += drop;
          total -= drop;
        }
      }
    }
    st.history.push(summary);
    st.turn++;
    return summary;
  }

  function scienceScore(design, st) {
    const m = MISSIONS[design.mission];
    const fr = objectiveFractions(design, st);
    let total = 0;
    m.objectives.forEach((o) => (total += o.weight * fr[o.id]));
    const key = m.objectives.find((o) => o.key);
    return { fractions: fr, total, keyFrac: fr[key.id], headline: total >= 70 && fr[key.id] >= 0.8 };
  }

  function runScienceAuto(design, base, scienceStartMs, health) {
    const st = newScienceState(design, base, scienceStartMs, health);
    const on = {};
    st.ids.forEach((id) => (on[id] = true));
    while (st.turn < MISSIONS[design.mission].turns) stepScience(design, st, autoPriorities(design, st), on);
    return { st, score: scienceScore(design, st) };
  }

  // ---------- Full evaluation ----------
  function evaluate(design, chosenLaunch, extra) {
    const base = computeBase(design);
    const readyMs = extra && extra.readyMs ? extra.readyMs : base.readyMs;
    // The wait before the window (and its storage cost) runs from the real ready date.
    base.readyMs = readyMs;
    const launch = chosenLaunch ? computeLaunch(base, design, chosenLaunch) : referenceLaunch(base, design, readyMs);
    const testCost = (extra && extra.testCost) || 0;
    const cost = {
      hardware: base.hwCost + (launch ? launch.busMassCost : 0),
      launcher: launch ? launch.launcherCost : 0,
      ops: launch ? launch.opsCost : 0,
      storage: launch ? launch.storageCost : 0,
      tests: testCost,
    };
    cost.total = cost.hardware + cost.launcher + cost.ops + cost.storage + cost.tests;
    const budget = base.mission.budgetM;
    if (base.mission.kind === 'crew') return { design, base, launch, cost, budget, reserve: budget - cost.total, science: launch ? crewExpected(design, base) : null, sciState: null };
    const sci = launch ? runScienceAuto(design, base, launch.scienceStartMs) : null;
    return { design, base, launch, cost, budget, reserve: budget - cost.total, science: sci ? sci.score : null, sciState: sci ? sci.st : null };
  }

  // Extra launch mass caused by one more kilogram of hardware.
  function snowball(design, ev) {
    if (!ev.launch) return null;
    const d2 = { ...design, ballast: design.ballast + 1 };
    const b2 = computeBase(d2);
    const l2 = computeLaunch(b2, d2, ev.launch.launch);
    return l2.wet - ev.launch.wet;
  }

  // ---------- Review board ----------
  function review(ev) {
    if (ev.base.mission.kind === 'crew') return crewReview(ev);
    const { design, base, launch, science } = ev;
    const m = base.mission;
    const out = {};
    const keyObj = m.objectives.find((o) => o.key);
    const fmt = (x) => Math.round(x).toLocaleString('en-US');

    // Science lead
    const canKey = design.instruments.some((id) => keyObj.instruments[id]);
    if (!design.instruments.length) out.science = { tone: 'bad', line: `We have no instruments yet. Our headline needs: ${keyObj.label.toLowerCase()}.` };
    else if (!canKey) out.science = { tone: 'bad', line: `Nothing on board can do “${keyObj.label}”. That is our headline.` };
    else if (science && science.headline) out.science = { tone: 'ok', line: `This design can earn the headline (about ${fmt(science.total)} science points). Protect it.` };
    else if (science) {
      const st = ev.sciState;
      const gen = Object.values(st.generated).reduce((s, x) => s + x, 0);
      const sent = Object.values(st.delivered).reduce((s, x) => s + x, 0);
      const weakest = m.objectives.slice().sort((a, b) => science.fractions[a.id] - science.fractions[b.id])[0];
      if (gen > 0 && sent / gen < 0.6)
        out.science = { tone: 'warn', line: `Only ${Math.round((100 * sent) / gen)}% of our data makes it home. A bigger dish, a stronger radio or more antenna time would help.` };
      else out.science = { tone: 'warn', line: `About ${fmt(science.total)} points. Weakest goal: ${weakest.label.toLowerCase()}.` };
    }

    // Systems engineer
    const planet = base.planet.name;
    if (base.powerMargin < 1) out.systems = { tone: 'bad', line: `We need ${fmt(base.powerReq)} W but only make ${fmt(base.powerAvail)} W at ${planet}. Instruments will have to take turns.` };
    else if (launch && launch.launchMargin < 0) out.systems = { tone: 'bad', line: `We are ${fmt(-launch.launchMargin)} kg too heavy for the ${opt(OPTIONS.launcher, design.launcher).name.toLowerCase()} in the next window.` };
    else if (base.powerMargin < 1.2) out.systems = { tone: 'warn', line: `Power margin is ${Math.round((base.powerMargin - 1) * 100)}%. Engineers like at least 20% for ageing panels and surprises.` };
    else if (design.margin === 0) out.systems = { tone: 'warn', line: 'Zero fuel margin. One unplanned burn and we cannot reach our orbit.' };
    else {
      const sb = snowball(design, ev);
      out.systems = { tone: 'ok', line: sb ? `Margins look healthy. Each kilogram we add becomes ${sb.toFixed(1)} kg on the launch pad.` : 'Margins look healthy.' };
    }

    // Budget
    const res = ev.reserve;
    if (res < 0) out.budget = { tone: 'bad', line: `We are $${fmt(-res)}M over our $${fmt(ev.budget)}M cap.` };
    else if (res < 0.1 * ev.budget) out.budget = { tone: 'warn', line: `Only $${fmt(res)}M left for tests and for fixing what they find.` };
    else out.budget = { tone: 'ok', line: `$${fmt(res)}M in reserve. That pays for testing and surprises.` };

    // Mission assurance
    if (m.radiation && design.shield < 75) out.safety = { tone: design.shield ? 'warn' : 'bad', line: 'Jupiter’s radiation belts will fry unshielded electronics. Put them in a thicker vault.' };
    else if (design.avionics === 'single') out.safety = { tone: 'warn', line: `One computer and no backup. Expect about ${base.expectedFlaws.toFixed(1)} hidden flaws; test well.` };
    else out.safety = { tone: 'ok', line: `Backup computer on board. Expect about ${base.expectedFlaws.toFixed(1)} hidden flaws until we test.` };
    return out;
  }

  // ---------- Crew safety: board lines, checks and review questions ----------
  // Strings go through SMD.t in the browser; tests get the English.
  const fillT = (e, p) => (p ? String(e).replace(/\{(\w+)\}/g, (mm, k) => (p[k] !== undefined ? p[k] : mm)) : e);
  const tr = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : fillT(e, p));
  const pct = (x) => Math.round(x * 100);

  // What the crew-safety panel says about a design: [{id, ok, label, detail}].
  function crewChecks(design, base) {
    const cf = base.crew;
    const out = [];
    out.push({
      id: 'abort',
      ok: cf.abort ? 'ok' : 'bad',
      label: tr('crew.check.abort', 'Crew escape at launch'),
      detail: cf.abort ? tr('crew.check.abort.ok', 'Abort tower fitted: it can pull the capsule clear in a split second') : tr('crew.check.abort.bad', 'No abort tower: if the rocket fails, the crew has no way out'),
    });
    const r = cf.shieldRatio;
    const rb = cf.shieldRatioBad;
    out.push({
      id: 'shield',
      ok: r < 1 ? 'bad' : rb < 1 ? 'warn' : 'ok',
      label: tr('crew.check.shield', 'Heat shield margin'),
      detail:
        r < 1
          ? tr('crew.check.shield.bad', 'Only {pct}% of the heat of a normal entry. Thicker shield or a direct entry', { pct: pct(r) })
          : rb < 1
            ? tr('crew.check.shield.warn', '{pct}% of a normal entry, but only {bad}% if the shield sheds char like Artemis I', { pct: pct(r), bad: pct(rb) })
            : tr('crew.check.shield.ok', '{pct}% of a normal entry, {bad}% even with char loss', { pct: pct(r), bad: pct(rb) }),
    });
    const spare = cf.lifeDays * 0.55;
    out.push({
      id: 'life',
      ok: cf.lifeDays < cf.lifeNeed ? 'bad' : spare < cf.lifeNeed ? 'warn' : 'ok',
      label: tr('crew.check.life', 'Air and water'),
      detail:
        spare < cf.lifeNeed
          ? tr('crew.check.life.warn', '{days} days for a 9-day trip. If a valve fails, the crew runs short', { days: cf.lifeDays })
          : tr('crew.check.life.ok', '{days} days for a 9-day trip: enough even if a system fails', { days: cf.lifeDays }),
    });
    out.push({
      id: 'shelter',
      ok: cf.shelter ? 'ok' : 'warn',
      label: tr('crew.check.shelter', 'Solar storm shelter'),
      detail: cf.shelter ? tr('crew.check.shelter.ok', 'The crew can hide behind {kg} kg of supplies or water', { kg: cf.shelter }) : tr('crew.check.shelter.bad', 'No shelter: a solar storm would give the crew a heavy radiation dose'),
    });
    return out;
  }

  function crewReview(ev) {
    const { design, base, launch } = ev;
    const cf = base.crew;
    const out = {};
    const sci = ev.science;
    out.science = sci && sci.headline ? { tone: 'ok', line: tr('crew.rev.sci.ok', 'If everyone comes home, the far-side photos will make the front pages. About {pts} points.', { pts: Math.round(sci.total) }) } : { tone: 'warn', line: tr('crew.rev.sci.warn', 'A camera at the window would make the far-side photos far better.') };
    if (launch && launch.launchMargin < 0) out.systems = { tone: 'bad', line: tr('crew.rev.lift', 'The stack is {kg} kg too heavy for the super heavy rocket. Something has to go.', { kg: Math.round(-launch.launchMargin) }) };
    else if (cf.shieldRatio < 1) out.systems = { tone: 'bad', line: tr('crew.rev.shield', 'The heat shield is too thin for this entry. The capsule could burn through.') };
    else if (base.powerMargin < 1.1) out.systems = { tone: 'warn', line: tr('crew.rev.power', 'Life support needs {need} W and the wings make {make} W. Add panel area.', { need: Math.round(base.powerReq), make: Math.round(base.powerAvail) }) };
    else out.systems = { tone: 'ok', line: tr('crew.rev.sys.ok', 'The stack fits the rocket with {kg} kg to spare.', { kg: Math.round(launch ? launch.launchMargin : 0) }) };
    const res = ev.reserve;
    out.budget = res < 0 ? { tone: 'bad', line: tr('crew.rev.budget.bad', 'We are ${m}M over the ${cap}M cap.', { m: Math.round(-res), cap: Math.round(ev.budget) }) } : { tone: 'ok', line: tr('crew.rev.budget.ok', '${m}M left under the cap for tests and surprises.', { m: Math.round(res) }) };
    if (!cf.abort) out.safety = { tone: 'bad', line: tr('crew.rev.abort', 'No abort tower. I will not sign off on a crewed launch without a way out.') };
    else if (cf.shieldRatioBad < 1) out.safety = { tone: 'warn', line: tr('crew.rev.char', 'If the shield sheds char like Artemis I did, this entry leaves no margin.') };
    else if (!cf.shelter) out.safety = { tone: 'warn', line: tr('crew.rev.shelter', 'No storm shelter. One solar eruption could give the crew a heavy dose.') };
    else out.safety = { tone: 'ok', line: tr('crew.rev.safe.ok', 'Escape tower, shield margin and shelter are in place. Test the life support hard.') };
    return out;
  }

  // Crew-safety questions for the review boards (same shape as
  // SMD.agency.reviewQuestions). mod values are added to the design fields.
  function crewReviewQuestions(p, review) {
    const d = p.design;
    if (!isCrew(d)) return [];
    const base = computeBase(d);
    const cf = base.crew;
    const qs = [];
    if (!cf.abort)
      qs.push({
        id: 'crewAbort',
        who: 'safety',
        text: tr('crew.q.abort', 'There is no launch abort system. If the rocket fails in the first minutes, the crew dies. Add one?'),
        options: [
          { id: 'add', label: tr('crew.q.abort.add', 'Add the abort tower (+$70M, +2 months)'), effects: { money: -70, months: 2 }, mod: { abort: 1 } },
          { id: 'accept', label: tr('crew.q.abort.no', 'Fly without it and trust the rocket'), effects: { rep: -1 } },
        ],
      });
    const nextShield = OPTIONS.heatShield.find((o) => o.id > cf.heatShield);
    if (cf.shieldRatioBad < 1 && nextShield)
      qs.push({
        id: 'crewShield',
        who: 'systems',
        text: tr('crew.q.shield', 'Artemis I came home with chunks of char missing from its heat shield. Ours has {pct}% margin if that happens. Thicken it?', { pct: pct(cf.shieldRatioBad) }),
        options: [
          { id: 'thicker', label: tr('crew.q.shield.add', 'Add {kg} kg of ablator (+$15M, +1 month)', { kg: nextShield.id - cf.heatShield }), effects: { money: -15, months: 1 }, mod: { heatShield: nextShield.id - cf.heatShield } },
          { id: 'accept', label: tr('crew.q.shield.no', 'Keep it as it is'), effects: {} },
        ],
      });
    if (review === 'CDR')
      qs.push({
        id: 'crewLife',
        who: 'science',
        text: tr('crew.q.life', 'Before people fly, engineers can run the air and water system for weeks with volunteers in a sealed chamber. Do it?'),
        options: [
          { id: 'test', label: tr('crew.q.life.test', 'Run the crewed chamber test (+$12M, +1 month)'), effects: { money: -12, months: 1 }, runTests: 'recheck' },
          { id: 'skip', label: tr('crew.q.life.skip', 'The parts passed their own tests. Skip it'), effects: {} },
        ],
      });
    return qs;
  }

  SMD.model = {
    crewChecks,
    crewReviewQuestions,
    crewScore,
    crewCamera,
    crewFields,
    shieldRatio,
    launcherFor,
    isCrew,
    defaultDesign,
    baseGrid,
    cellLaunch,
    launcherCapacity,
    computeBase,
    computeLaunch,
    referenceLaunch,
    wetFor,
    evaluate,
    snowball,
    review,
    forecast,
    newScienceState,
    stepScience,
    autoPriorities,
    scienceScore,
    objectiveFractions,
    objectiveQuality,
    runScienceAuto,
    defaultHealth,
    linkRateMbps,
    addMonths,
    opt,
    clamp,
    GRID_START,
    windows,
    nearLaunch,
  };
  if (typeof module === 'object' && module.exports) module.exports = SMD.model;
})();
