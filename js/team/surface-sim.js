// Every Kilogram: the co-op surface mission (SMD.team.surface), v2 "calm exploration".
// Land, walk to science sites, scan them with the instruments you brought, carry samples
// home, plant the dish and send data in the uplink windows, watch oxygen, suit battery and
// daylight, then decide what fits in the ascent. Dangers are real ones only: dust storms,
// moonquakes and rockfalls, cold nights, radiation spikes (and sulfuric haze on Venus).
// Nobody dies: a crew member who runs out walks back to the lander on autopilot.
// Pure, deterministic, fixed-tick and JSON-safe. Runs in the browser and in node.
// Contract and tuning notes: docs/TEAM-SURFACE.md.
(function () {
  'use strict';
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};

  // ---------------------------------------------------------------- constants
  const TICK = 1 / 30;
  const N = 64;
  const CELL = 3;
  const SIZE = N * CELL;
  const T_FLOOR = 0;
  const T_ROCK = 1;
  const T_ICE = 2;
  const T_VOID = 3;
  const T_SHADOW = 4;
  const UNREACH = 32000;
  const ROLES = ['planner', 'engineer', 'scientist', 'comms'];
  const SITE_KINDS = ['ice', 'mineral', 'atmosphere', 'thermal', 'organic'];

  // Tuning. Everything a designer might want to change lives in this block.
  const TUNE = {
    moveSpeed: 7.2,
    sprintFactor: 1.35, // eye-level views only: Shift
    sprintO2: 0.6, // extra oxygen per second while sprinting
    carryPenaltyPerKg: 0.012, // fraction of speed lost per kg carried
    carryMinFactor: 0.55,
    o2Drain: 0.56, // per second; a full tank lasts about 180 s
    o2Tank: 100,
    o2Stock: 100, // the lander's own reserve
    o2PerCanister: 70,
    o2Refill: 40,
    suitMax: 100, // suit integrity: hazards wear it down
    suitPatch: 6, // per second at the lander
    energyMax: 100,
    energyIdle: 0.1, // suit battery per second: life support fans and radio
    energyScan: 0.8, // extra while an instrument is running
    energyCold: 0.35, // extra at night away from the lander lights (heaters)
    energyStorm: 0.3, // extra in a dust storm or haze
    energyRecharge: 30,
    landerRadius: 8, // boarding, refill and charging radius
    shelterRadius: 11, // the lander's hull shields radiation within this radius
    returnSpeed: 0.8, // autopilot speed factor when a suit sends someone home
    restS: 8, // a returned astronaut rests this long while the suit is serviced
    hoursPerS: 0.145, // game time compression: 1 s of play covers this many hours of base load
    loadIdleW: 60,
    loadHeatW: 140, // cabin heaters at night
    loadLightsW: 110,
    loadChargerW: 160,
    extractionS: 30,
    autoExtractLeftS: 34,
    waitMaxS: 15, // after the call runs out the lander waits this long for the last crew member
    boilKgPerS: 0.8, // ascent margin lost per second of waiting (propellant boil-off)
    decisionS: 15, // the launch computer waits this long when the rack is over the lift limit (time holds)
    introS: 3.5,
    dishHoldR: 10,
    plantS: { comms: 2.2, other: 6 },
    scanOther: 0.5, // non-scientists scan at this rate
    scanOverclock: 1.9,
    radiationDose: 3.4, // suit integrity per second outside shelter during a spike
    acidDose: 0.9,
    rockfallHit: 18,
    winScienceFrac: 0.25, // share of ALL the science on the map a full success needs
    repairS: 4, // the engineer fixes a lander fault in this long (hold Use at the fault)
    repairR: 2.8,
    panelsFaultFactor: 0.35, // dusty or slipped solar panels give this share of their power
    botDecideS: 3, // with no person to choose, the crew's own plan goes after this long
  };

  // docs/TEAM-V3.md item 5: on the surface each person does only their job. Each task
  // belongs to one job; carrying samples, topping up, sheltering and going home are everyone's.
  const TASK_JOB = {
    scan: 'scientist', choose: 'scientist', plant: 'comms', align: 'comms', uplink: 'comms', boost: 'comms',
    repair: 'engineer', patch: 'engineer', call: 'planner', route: 'planner',
  };
  // Who chooses what stays behind at the door: the scientist's samples, the planner's ascent plan.
  const CHOOSERS = ['scientist', 'planner'];
  // Which job each surface objective belongs to (null: the whole crew).
  const OBJECTIVE_JOB = { scan: 'scientist', sample: 'scientist', dish: 'comms', send: 'comms', systems: 'engineer', science: null, home: 'planner', shadow: 'scientist', core: 'scientist' };
  const FAULTS = { cadet: 1, engineer: 2, director: 3 };

  const DIFFICULTY = {
    cadet: { hazard: 0.7, drain: 0.85, bot: 1.1 },
    engineer: { hazard: 1.0, drain: 1.0, bot: 1.0 },
    director: { hazard: 1.3, drain: 1.12, bot: 0.92 },
  };

  // Solar flux from real distances; day lengths are compressed to fit a 5 minute round (see docs).
  const WORLDS = {
    moon: {
      name: 'the Moon', flux: 1361, nightStart: 0.62, nightLen: 0.3, speed: 1.05, gravity: 1.62, objective: 'ice',
      rockT: 0.66, iceT: 0.15, siteMix: { ice: 3, mineral: 2, thermal: 1, organic: 1 },
      hazards: { quake: 2, radiation: 2 },
      labels: { ice: 'Permanent shadow ice', mineral: 'KREEP outcrop', thermal: 'Cold trap', organic: 'Carbon volatile patch', atmosphere: 'Exosphere trap' },
    },
    mars: {
      name: 'Mars', flux: 586, nightStart: 0.55, nightLen: 0.42, speed: 1.0, gravity: 3.71, objective: 'ice',
      rockT: 0.64, iceT: 0.1, siteMix: { ice: 3, mineral: 2, organic: 1, atmosphere: 1 },
      hazards: { storm: 2, radiation: 1 },
      labels: { ice: 'Buried ice sheet', mineral: 'Clay-bearing rock', thermal: 'Fumarole vent', organic: 'Organic mudstone', atmosphere: 'Methane plume' },
    },
    venus: {
      name: 'Venus', flux: 2601, nightStart: 0.5, nightLen: 0.45, speed: 0.96, gravity: 8.87, objective: 'atmosphere',
      rockT: 0.74, iceT: -1, siteMix: { atmosphere: 3, thermal: 2, mineral: 1, organic: 1 },
      hazards: { acid: 2, radiation: 1 },
      labels: { ice: 'Condensate trap', mineral: 'Aerosol collector', thermal: 'Thermal updraft', organic: 'Dark absorber patch', atmosphere: 'Sulfuric cloud layer' },
    },
    europa: {
      name: 'Europa', flux: 50, nightStart: 0.6, nightLen: 0.35, speed: 0.98, gravity: 1.31, objective: 'organic',
      rockT: 0.67, iceT: 0.55, siteMix: { organic: 3, ice: 2, mineral: 1, thermal: 1 },
      hazards: { quake: 2, radiation: 3 },
      labels: { ice: 'Clean ice ridge', mineral: 'Salt deposit', thermal: 'Warm crack', organic: 'Plume deposit', atmosphere: 'Sputtered vapor' },
    },
  };

  // How each mission objective is weighed for the progress tracker.
  const OBJECTIVE_WEIGHT = { scan: 0.22, sample: 0.13, dish: 0.1, send: 0.18, science: 0.14, systems: 0.08, home: 0.15, shadow: 0.1, core: 0.1 };
  // docs/TEAM-V3.md item 19: each signature mission asks something of its own down here.
  // Moon: polar ice in a crater that never sees the Sun (bitter cold for suits, the night to
  // survive). Mars: drill an ice core and bring it home, with dust on the solar panels.
  const SIGNATURE = { moon: 'shadow', mars: 'core' };
  // What goes wrong on each world's lander: Martian and Venusian dust or haze on the panels;
  // the cold of the Moon and Europa trips the suit charger first.
  const FAULT_KINDS = { mars: ['panels'], venus: ['panels'], moon: ['charger', 'panels'], europa: ['charger', 'panels'] };

  // ---------------------------------------------------------------- helpers
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const len = (x, z) => Math.sqrt(x * x + z * z);
  const dist = (a, b) => len(a.x - b.x, a.z - b.z);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  function hash32(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rnd(S) {
    S.rng = (S.rng + 0x6d2b79f5) | 0;
    let t = Math.imul(S.rng ^ (S.rng >>> 15), 1 | S.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function emit(S, type, x, z, extra) {
    if (S.events.length >= 300) return;
    const ev = { type, t: S.t, x: x || 0, z: z || 0 };
    if (extra) Object.assign(ev, extra);
    S.events.push(ev);
  }

  // ---------------------------------------------------------------- loadout
  // Weapons, turrets, drones, medkits and the rover are no longer part of the game: old
  // loadouts may still carry them and they are simply ignored. A drill (picked as a part,
  // or still listed under weapons) pulls heavier, more valuable cores.
  function normalizeLoadout(raw, opts) {
    const l = raw || {};
    const worldId = (opts && opts.world) || l.world;
    const world = WORLDS[worldId] ? worldId : 'mars';
    const instruments = [];
    for (const it of Array.isArray(l.instruments) ? l.instruments : []) {
      if (!it) continue;
      const fits = (Array.isArray(it.fits) ? it.fits : []).filter((k) => SITE_KINDS.indexOf(k) >= 0);
      if (!fits.length) continue;
      instruments.push({ id: String(it.id || it.name || 'instrument'), name: String(it.name || it.id || 'Instrument'), fits, rate: clamp(num(it.rate, 1), 0.3, 3), value: clamp(num(it.value, 1), 0.2, 3) });
    }
    const p = l.power || {};
    const up = l.uplink || {};
    const land = l.landing || {};
    const asc = l.ascent || {};
    const drillPicked = l.drill && typeof l.drill === 'object' && l.drill.id !== 'none';
    const drillListed = Array.isArray(l.weapons) && l.weapons.some((w) => w === 'drill' || (w && w.id === 'drill'));
    return {
      world,
      scenarioId: l.scenarioId || l.scenario || null,
      objective: SITE_KINDS.indexOf(l.objective) >= 0 ? l.objective : WORLDS[world].objective,
      spareO2: clamp(Math.floor(num(l.spareO2, 0)), 0, 6),
      power: { solarW: clamp(num(p.solarW, 0), 0, 40000), batteryWh: clamp(num(p.batteryWh, 0), 0, 80000), rtgW: clamp(num(p.rtgW, 0), 0, 4000) },
      instruments,
      recorderGbit: clamp(num(l.recorderGbit, 0), 0, 4000),
      uplink: {
        rateGbitS: clamp(num(up.rateGbitS, 0), 0, 60),
        everyS: clamp(num(up.everyS, 90), 30, 240),
        windowS: clamp(num(up.windowS, 25), 5, 90),
        firstS: clamp(num(up.firstS, 55), 15, 160),
        label: String(up.label || 'orbiter'),
      },
      landing: { offsetM: clamp(num(land.offsetM, 0), 0, 75), inRange: land.inRange !== false },
      lifetimeS: clamp(num(l.lifetimeS, 280), 150, 360),
      ascent: { liftKg: clamp(num(asc.liftKg, 0), 0, 1000) },
      drill: normalizeDrill(drillPicked || drillListed ? l.drill || {} : null),
      parts: Object.assign({}, l.parts || {}),
    };
  }

  function normalizeDrill(d) {
    if (!d) return { has: false, depthM: 0, coreMass: 1, coreValue: 0.42 };
    const deep = num(d.depthM, 3) >= 2;
    return { has: true, depthM: num(d.depthM, 3), coreMass: deep ? 2.1 : 1.45, coreValue: deep ? 0.9 : 0.62 };
  }

  // ---------------------------------------------------------------- map generation
  function smoothNoise(rng, step) {
    const g = (step + 2) * (step + 2);
    const grid = [];
    for (let i = 0; i < g; i++) grid.push(rng());
    return function (x, y) {
      const fx = (x / N) * step;
      const fy = (y / N) * step;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => grid[(j * (step + 2) + i) % g];
      const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
      const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
      return a + (b - a) * sy;
    };
  }

  function carveCircle(tiles, ci, cj, r, value) {
    const R = Math.ceil(r);
    for (let j = cj - R; j <= cj + R; j++) {
      for (let i = ci - R; i <= ci + R; i++) {
        if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) continue;
        if ((i - ci) * (i - ci) + (j - cj) * (j - cj) > r * r) continue;
        const t = tiles[j * N + i];
        if (t === T_ROCK || t === T_VOID) tiles[j * N + i] = value;
      }
    }
  }

  function carveRoute(tiles, a, b, rng, width, routes) {
    let x = a.i;
    let y = a.j;
    const pts = [{ x: (x + 0.5) * CELL, z: (y + 0.5) * CELL }];
    let guard = 0;
    while ((Math.abs(x - b.i) > 1 || Math.abs(y - b.j) > 1) && guard++ < 400) {
      const dx = b.i - x;
      const dy = b.j - y;
      const d = Math.max(1, len(dx, dy));
      const wobble = rng() * 1.6 - 0.8;
      x = clamp(Math.round(x + dx / d + (-dy / d) * wobble), 3, N - 4);
      y = clamp(Math.round(y + dy / d + (dx / d) * wobble), 3, N - 4);
      carveCircle(tiles, x, y, width, T_FLOOR);
      if (guard % 4 === 0) pts.push({ x: (x + 0.5) * CELL, z: (y + 0.5) * CELL });
    }
    pts.push({ x: (b.i + 0.5) * CELL, z: (b.j + 0.5) * CELL });
    routes.push(pts);
  }

  function floodFrom(tiles, si, sj) {
    const seen = new Uint8Array(N * N);
    const q = [sj * N + si];
    seen[q[0]] = 1;
    while (q.length) {
      const c = q.pop();
      const i = c % N;
      const j = (c / N) | 0;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [di, dj] of nb) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const k = nj * N + ni;
        if (seen[k]) continue;
        const t = tiles[k];
        if (t === T_ROCK || t === T_VOID) continue;
        seen[k] = 1;
        q.push(k);
      }
    }
    return seen;
  }

  function genMap(world, seed, ld) {
    const W = WORLDS[world];
    const rng = mulberry(hash32('map|' + seed + '|' + world + '|' + Math.round(ld.landing.offsetM) + '|' + ld.landing.inRange));
    const tiles = new Array(N * N).fill(T_FLOOR);
    const nA = smoothNoise(rng, 9);
    const nB = smoothNoise(rng, 16);
    const isVenus = world === 'venus';

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const v = nA(i, j) * 0.62 + nB(i, j) * 0.38;
        const k = j * N + i;
        if (v > W.rockT) tiles[k] = T_ROCK;
        else if (v < W.iceT) tiles[k] = T_ICE;
        if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) tiles[k] = T_ROCK;
        if (isVenus) {
          const d = len(i - N / 2 + 0.5, j - N / 2 + 0.5);
          if (d > N * 0.46) tiles[k] = T_VOID;
        }
      }
    }

    // Science cluster centre sits near the map centre, the lander near it (or far, if the orbit was poor).
    const cCi = Math.round(N / 2 + rng() * 6 - 3);
    const cCj = Math.round(N / 2 + rng() * 6 - 3);
    const landAng = rng() * Math.PI * 2;
    const offCells = (ld.landing.offsetM + (ld.landing.inRange ? 0 : 32)) / CELL + rng() * 2;
    const margin = isVenus ? 16 : 10;
    const li = clamp(Math.round(cCi + Math.cos(landAng) * offCells), margin, N - margin - 1);
    const lj = clamp(Math.round(cCj + Math.sin(landAng) * offCells), margin, N - margin - 1);
    carveCircle(tiles, li, lj, 7, T_FLOOR);
    for (let j = lj - 5; j <= lj + 5; j++) {
      for (let i = li - 5; i <= li + 5; i++) {
        if (i > 1 && j > 1 && i < N - 2 && j < N - 2 && tiles[j * N + i] === T_ICE) tiles[j * N + i] = T_FLOOR;
      }
    }

    // Sites around the cluster. Always at least two of the objective kind.
    const kinds = [];
    Object.keys(W.siteMix).forEach((k) => {
      for (let i = 0; i < W.siteMix[k]; i++) kinds.push(k);
    });
    for (let i = kinds.length - 1; i > 0; i--) {
      const r = Math.floor(rng() * (i + 1));
      const tmp = kinds[i];
      kinds[i] = kinds[r];
      kinds[r] = tmp;
    }
    const nSites = Math.min(kinds.length, 6 + Math.floor(rng() * 2));
    const chosen = kinds.slice(0, nSites);
    let objs = chosen.filter((k) => k === ld.objective).length;
    for (let i = 0; i < chosen.length && objs < 2; i++) {
      if (chosen[i] !== ld.objective) {
        chosen[i] = ld.objective;
        objs++;
      }
    }

    const siteDefs = [];
    const routes = [];
    const baseCell = { i: li, j: lj };
    const startA = rng() * Math.PI * 2;
    for (let s = 0; s < chosen.length; s++) {
      const ang = startA + (s / chosen.length) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const rad = (isVenus ? 12 : 15) + rng() * (isVenus ? 7 : 10);
      const si = clamp(Math.round(cCi + Math.cos(ang) * rad), 5, N - 6);
      const sj = clamp(Math.round(cCj + Math.sin(ang) * rad), 5, N - 6);
      carveCircle(tiles, si, sj, 4, T_FLOOR);
      siteDefs.push({ i: si, j: sj, kind: chosen[s], ang });
    }
    for (const sd of siteDefs) carveRoute(tiles, baseCell, sd, rng, 2.2, routes);
    siteDefs.sort((a, b) => a.ang - b.ang);
    for (let s = 0; s < siteDefs.length; s++) {
      if (rng() < 0.7) carveRoute(tiles, siteDefs[s], siteDefs[(s + 1) % siteDefs.length], rng, 1.6, routes);
    }

    // Dish pad: a clear patch a short jog from the lander.
    let best = null;
    for (let tries = 0; tries < 24; tries++) {
      const a = (tries / 24) * Math.PI * 2 + rng() * 0.2;
      const r = 6 + rng() * 2;
      const i = clamp(Math.round(li + Math.cos(a) * r), 4, N - 5);
      const j = clamp(Math.round(lj + Math.sin(a) * r), 4, N - 5);
      let open = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (tiles[(j + dj) * N + i + di] !== T_ROCK && tiles[(j + dj) * N + i + di] !== T_VOID) open++;
      if (!best || open > best.open) best = { i, j, open };
    }
    carveCircle(tiles, best.i, best.j, 3, T_FLOOR);
    carveRoute(tiles, baseCell, best, rng, 2.2, routes);

    // Caves: shadow rooms ringed by rock with one door. Radiation shelter and spare canisters.
    const caves = [];
    for (let c = 0; c < 8 && caves.length < 3; c++) {
      const ci = 8 + Math.floor(rng() * (N - 16));
      const cj = 8 + Math.floor(rng() * (N - 16));
      if (len(ci - li, cj - lj) < 12 || siteDefs.some((s) => len(s.i - ci, s.j - cj) < 9)) continue;
      const r = 2 + rng() * 2;
      const R = Math.ceil(r) + 2;
      for (let j = cj - R; j <= cj + R; j++) {
        for (let i = ci - R; i <= ci + R; i++) {
          if (i < 3 || j < 3 || i >= N - 3 || j >= N - 3) continue;
          const d = len(i - ci, j - cj);
          if (d <= r) tiles[j * N + i] = T_SHADOW;
          else if (d <= r + 1.8 && tiles[j * N + i] !== T_VOID) tiles[j * N + i] = T_ROCK;
        }
      }
      const a = rng() * Math.PI * 2;
      for (let m = r; m < r + 7; m += 0.5) {
        const i = clamp(Math.round(ci + Math.cos(a) * m), 3, N - 4);
        const j = clamp(Math.round(cj + Math.sin(a) * m), 3, N - 4);
        carveCircle(tiles, i, j, 1.4, T_FLOOR);
      }
      caves.push({ i: ci, j: cj, r });
    }

    // Anything the crew cannot reach becomes rock. Clear routes are guaranteed.
    carveCircle(tiles, li, lj, 7, T_FLOOR);
    let seen = floodFrom(tiles, li, lj);
    for (const sd of siteDefs) {
      if (!seen[sd.j * N + sd.i]) {
        carveRoute(tiles, baseCell, sd, rng, 2.2, routes);
        seen = floodFrom(tiles, li, lj);
      }
    }
    for (let k = 0; k < N * N; k++) {
      if (!seen[k] && tiles[k] !== T_VOID) tiles[k] = T_ROCK;
    }

    const toPos = (c) => ({ x: (c.i + 0.5) * CELL, z: (c.j + 0.5) * CELL });
    const caveList = caves.filter((c) => seen[c.j * N + c.i]).map((c) => Object.assign(toPos(c), { r: c.r * CELL }));
    return {
      map: {
        uid: 'm' + hash32(tiles.join('')).toString(36),
        size: SIZE,
        cell: CELL,
        w: N,
        h: N,
        world,
        tiles,
        lander: toPos({ i: li, j: lj }),
        dishPad: toPos(best),
        routes,
        caves: caveList,
      },
      siteDefs,
      caves: caveList,
    };
  }

  // ---------------------------------------------------------------- geometry and nav
  function tileAt(map, x, z) {
    const i = Math.floor(x / CELL);
    const j = Math.floor(z / CELL);
    if (i < 0 || j < 0 || i >= N || j >= N) return T_ROCK;
    return map.tiles[j * N + i];
  }

  const blocked = (t) => t === T_ROCK || t === T_VOID;

  function circleFree(map, x, z, r) {
    return !(blocked(tileAt(map, x - r, z - r)) || blocked(tileAt(map, x + r, z - r)) || blocked(tileAt(map, x - r, z + r)) || blocked(tileAt(map, x + r, z + r)));
  }

  function moveBy(map, e, dx, dz) {
    const r = Math.min(e.r, 1.3);
    if (dx && circleFree(map, e.x + dx, e.z, r)) e.x += dx;
    if (dz && circleFree(map, e.x, e.z + dz, r)) e.z += dz;
  }

  // Pure movement: position + input + dt + map -> new position. Nothing else feeds it, so a
  // client can run the same code for prediction. pos = { x, z, vx, vz, r, speed, instant? };
  // speed is the top speed in m/s. instant skips acceleration.
  function stepMove(pos, input, dt, map) {
    let mx = clamp(+(input && input.moveX) || 0, -1, 1);
    let mz = clamp(+(input && input.moveY) || 0, -1, 1);
    const mag = len(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }
    const grip = tileAt(map, pos.x, pos.z) === T_ICE ? 0.14 : 0.5;
    const k = pos.instant ? 1 : 1 - Math.pow(1 - grip, dt / TICK);
    const vx = (pos.vx || 0) + (mx * pos.speed - (pos.vx || 0)) * k;
    const vz = (pos.vz || 0) + (mz * pos.speed - (pos.vz || 0)) * k;
    const next = { x: pos.x, z: pos.z, vx, vz, r: pos.r };
    moveBy(map, next, vx * dt, vz * dt);
    return next;
  }

  function hasLOS(map, x0, z0, x1, z1) {
    const d = len(x1 - x0, z1 - z0);
    const n = Math.ceil(d / 1.6);
    for (let k = 1; k < n; k++) {
      if (tileAt(map, x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n) === T_ROCK) return false;
    }
    return true;
  }

  const cellIndex = (x, z) => clamp(Math.floor(z / CELL), 0, N - 1) * N + clamp(Math.floor(x / CELL), 0, N - 1);

  const bfsQueue = new Int32Array(N * N * 2);
  function bfs(map, sources, field) {
    field.fill(UNREACH);
    let head = 0;
    let tail = 0;
    for (const s of sources) {
      if (field[s] !== 0) {
        field[s] = 0;
        bfsQueue[tail++] = s;
      }
    }
    const tiles = map.tiles;
    while (head < tail) {
      const c = bfsQueue[head++];
      const i = c % N;
      const j = (c / N) | 0;
      const v = field[c] + 1;
      if (i > 0) tail = bfsVisit(tiles, field, c - 1, v, tail);
      if (i < N - 1) tail = bfsVisit(tiles, field, c + 1, v, tail);
      if (j > 0) tail = bfsVisit(tiles, field, c - N, v, tail);
      if (j < N - 1) tail = bfsVisit(tiles, field, c + N, v, tail);
    }
  }
  function bfsVisit(tiles, field, k, v, tail) {
    const t = tiles[k];
    if (field[k] > v && t !== T_ROCK && t !== T_VOID) {
      field[k] = v;
      bfsQueue[tail++] = k;
    }
    return tail;
  }

  // Static-goal fields depend only on the map and the goal cell, so a module cache is safe.
  const navCache = new Map();
  function fieldTo(map, x, z) {
    const key = map.uid + ':' + cellIndex(x, z);
    let f = navCache.get(key);
    if (!f) {
      f = new Int16Array(N * N);
      bfs(map, [cellIndex(x, z)], f);
      navCache.set(key, f);
      if (navCache.size > 400) navCache.delete(navCache.keys().next().value);
    }
    return f;
  }

  const fd = { x: 0, z: 0, ok: false };
  function flow(map, field, x, z) {
    const i = clamp(Math.floor(x / CELL), 0, N - 1);
    const j = clamp(Math.floor(z / CELL), 0, N - 1);
    const here = field[j * N + i];
    let best = here;
    let bi = -1;
    let bj = -1;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const v = field[nj * N + ni];
        if (v >= best) continue;
        if (di && dj) {
          const t1 = map.tiles[j * N + ni];
          const t2 = map.tiles[nj * N + i];
          if (t1 === T_ROCK || t1 === T_VOID || t2 === T_ROCK || t2 === T_VOID) continue;
        }
        best = v;
        bi = ni;
        bj = nj;
      }
    }
    fd.ok = false;
    if (bi < 0) return fd;
    const dx = (bi + 0.5) * CELL - x;
    const dz = (bj + 0.5) * CELL - z;
    const m = len(dx, dz) || 1;
    fd.x = dx / m;
    fd.z = dz / m;
    fd.ok = true;
    return fd;
  }

  function freeSpot(S, x, z, spread, tries) {
    for (let k = 0; k < (tries || 16); k++) {
      const a = rnd(S) * Math.PI * 2;
      const r = rnd(S) * spread;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (circleFree(S.map, px, pz, 1)) return { x: px, z: pz };
    }
    return null;
  }

  // ---------------------------------------------------------------- entities
  function markGone(S, e) {
    e.gone = true;
    S.anyGone = true;
  }

  function spawn(S, kind, fields) {
    const e = Object.assign({ id: kind[0] + S.nextId++, kind, x: 0, z: 0, heading: 0, hp: 1, maxHp: 1, r: 1, state: 'idle' }, fields);
    S.entities.push(e);
    return e;
  }

  // Rebuilt at the start of every tick and never stored on the state, so the state stays plain JSON.
  let lookup = new Map();
  function byId(S, id) {
    return lookup.get(id) || null;
  }

  let viewEntities = null;
  let viewLength = -1;
  let viewCache = null;
  function buildViews(S) {
    if (S.entities === viewEntities && S.entities.length === viewLength) return viewCache;
    const V = { players: [], samples: [], pickups: [], sites: [], boulders: [], dish: null, lander: null };
    lookup = new Map();
    for (const e of S.entities) {
      lookup.set(e.id, e);
      switch (e.kind) {
        case 'astronaut': V.players.push(e); break;
        case 'sample': V.samples.push(e); break;
        case 'pickup': V.pickups.push(e); break;
        case 'site': V.sites.push(e); break;
        case 'boulder': V.boulders.push(e); break;
        case 'dish': V.dish = e; break;
        case 'lander': V.lander = e; break;
        default: break;
      }
    }
    viewEntities = S.entities;
    viewLength = S.entities.length;
    viewCache = V;
    return V;
  }

  // ---------------------------------------------------------------- create
  function pickRoles(given) {
    const left = ROLES.slice();
    const out = [];
    for (const r of given) {
      const i = left.indexOf(r);
      if (i >= 0) {
        left.splice(i, 1);
        out.push(r);
      } else out.push(null);
    }
    return out.map((r) => r || left.shift() || 'planner');
  }

  function create(loadout, seed, players, opts) {
    opts = opts || {};
    const ld = normalizeLoadout(loadout, opts);
    const world = ld.world;
    // 'realistic' and 'anomalies' were the alien switch; both now mean the same calm mission.
    const hazardsMode = opts.hazards === 'realistic' ? 'realistic' : 'anomalies';
    const difficulty = DIFFICULTY[opts.difficulty] ? opts.difficulty : /flight|director|hard/i.test(opts.difficulty || '') ? 'director' : /cadet|easy/i.test(opts.difficulty || '') ? 'cadet' : 'engineer';
    const gen = genMap(world, seed, ld);
    const map = gen.map;

    const list = [];
    if (Array.isArray(players)) {
      for (const p of players.slice(0, 4)) list.push(typeof p === 'object' && p ? Object.assign({}, p) : { id: String(p) });
    } else {
      const humans = clamp(Math.floor(num(players, 0)), 0, 4);
      for (let i = 0; i < humans; i++) list.push({ id: 'p' + i });
    }
    const fill = opts.fillBots !== false;
    while (fill && list.length < 4) list.push({ bot: true });
    if (!list.length) list.push({ bot: true });
    list.forEach((p, i) => {
      if (p.id == null) p.id = (p.bot ? 'bot' : 'p') + i;
      if (!p.name) p.name = p.bot ? ['Bot Ada', 'Bot Otis', 'Bot Vera', 'Bot Sol'][i] : 'Player ' + (i + 1);
    });
    const roles = pickRoles(list.map((p) => p.role));

    const S = {
      version: 2, seed, world, hazardsMode, difficulty, diff: Object.assign({}, DIFFICULTY[difficulty]),
      t: 0, tick: 0, T: ld.lifetimeS, acc: 0, over: false, outcome: null, stage: 'intro', phase: 'calm', intensity: 0,
      rng: hash32('run|' + seed + '|' + world) | 0, nextId: 1,
      loadout: ld, map, entities: [], events: [], prompts: {}, pings: [],
      sun: { up: true, elevation: 1, light: 1, nextChangeIn: 0 },
      base: null, recorder: { usedGbit: 0, capacityGbit: ld.recorderGbit, sets: [] },
      uplink: null,
      ascent: { liftKg: ld.ascent.liftKg, loadedKg: 0, overKg: 0, rack: [], jettisoned: [] },
      extraction: { called: false, timer: 0, by: null, decision: 0, decided: false, reason: null, waiting: 0 },
      team: {},
      hazards: [], hazardPlan: [],
      // Lander faults the engineer fixes (docs/TEAM-V3.md item 5), and the planner's marked site.
      jobs: opts.jobs !== false, faults: [], faultPlan: [], faultTotal: 0, route: null,
      objectives: [], progress: 0,
      stats: newStats(),
    };

    const L = map.lander;
    spawn(S, 'lander', { id: 'lander', x: L.x, z: L.z, hp: 1, maxHp: 1, r: 3.5, state: 'idle' });
    S.base = {
      battery: ld.power.batteryWh, batteryMax: ld.power.batteryWh, solarW: 0, loadW: 0,
      shieldOn: false, lightsOn: false, chargerOn: false, heatOn: false, dark: false, shelter: false,
      hull: 1, hullMax: 1,
      o2Stock: TUNE.o2Stock + ld.spareO2 * TUNE.o2PerCanister,
      o2StockMax: TUNE.o2Stock + ld.spareO2 * TUNE.o2PerCanister,
      shieldR: TUNE.shelterRadius, lightR: 19,
    };

    spawn(S, 'dish', { id: 'dish', x: map.dishPad.x, z: map.dishPad.z, hp: 1, maxHp: 1, r: 1.4, state: 'idle', align: 0, planted: false, plantT: 0 });

    gen.siteDefs.forEach((sd, idx) => {
      const isObj = sd.kind === ld.objective;
      const fitsList = ld.instruments.filter((it) => it.fits.indexOf(sd.kind) >= 0);
      const mapRng = mulberry(hash32('site|' + seed + '|' + idx));
      const gbit = 28 + mapRng() * 28;
      const value = (70 + mapRng() * 60) * (isObj ? 1.5 : 1);
      const massKg = 12 + mapRng() * 16;
      spawn(S, 'site', {
        id: 'site' + idx, x: (sd.i + 0.5) * CELL, z: (sd.j + 0.5) * CELL, r: 6, state: fitsList.length ? 'idle' : 'blocked',
        siteKind: sd.kind, label: WORLDS[world].labels[sd.kind], objective: isObj,
        gbit, value, massKg, scanS: 8 + mapRng() * 4, scanned: 0, done: false, fits: fitsList.length > 0,
        instrument: fitsList.length ? fitsList[0].name : null,
        revealed: true, sampleTaken: false, valueBonus: fitsList.length ? Math.max(...fitsList.map((f) => f.value)) : 1,
      });
    });

    // The Moon's signature site: the objective site farthest from the lander lies in a crater
    // that never sees the Sun. Suits run cold there, day or night.
    if (SIGNATURE[world] === 'shadow') {
      let far = null;
      for (const e of S.entities) if (e.kind === 'site' && e.objective && e.fits && (!far || dist(e, L) > dist(far, L))) far = e;
      if (!far) for (const e of S.entities) if (e.kind === 'site' && e.objective && (!far || dist(e, L) > dist(far, L))) far = e;
      if (far) {
        far.shadow = true;
        far.label = 'Permanently shadowed crater';
      }
    }

    // Spare canisters in the caves, a short detour from the work.
    gen.caves.forEach((c, i) => {
      spawn(S, 'pickup', { x: c.x, z: c.z, r: 0.8, item: i % 2 ? 'energy' : 'o2', state: 'idle' });
    });

    list.forEach((p, i) => {
      const a = (i / list.length) * Math.PI * 2;
      spawn(S, 'astronaut', {
        id: 'a' + i, slot: i, playerId: String(p.id), name: String(p.name).slice(0, 40), role: roles[i], isBot: !!p.bot,
        // The character picked in setup (js/team/crew.js) and the person playing it, when known.
        crewId: p.crewId ? String(p.crewId).slice(0, 40) : null, playerName: p.playerName ? String(p.playerName).slice(0, 40) : null,
        x: L.x + Math.cos(a) * 5, z: L.z + Math.sin(a) * 5, r: 0.7, hp: TUNE.suitMax, maxHp: TUNE.suitMax, state: 'idle',
        vx: 0, vz: 0, o2: TUNE.o2Tank, energy: TUNE.energyMax, weapon: null, weapons: [],
        carrying: null, mounted: null, downed: false, downT: 0, reviveT: 0, dead: false, respawnT: 0, aboard: false, useT: 0, useKind: null,
        returning: null, restT: 0, abilityCd: 0, abilityHold: 0, overclockT: 0, slowT: 0, sprinting: false,
        tally: { scans: 0, carried: 0, dropped: 0, returns: 0, plants: 0, aligns: 0, repairs: 0, patches: 0, routes: 0, calls: 0, boosts: 0, overclocks: 0, heldS: 0 }, prev: { use: false, ability: false },
        bot: p.bot ? { task: null, think: 0, stuckT: 0, lastX: 0, lastZ: 0 } : null,
      });
    });

    S.uplink = planUplink(S);
    S.hazardPlan = planHazards(S);
    S.faultPlan = planFaults(S);
    S.faultTotal = S.jobs ? S.faultPlan.length : 0;
    if (!S.jobs) S.faultPlan = [];
    S.objectives = objectivesOf(S, buildViews(S));
    return S;
  }

  function newStats() {
    return {
      darkS: 0, firstDarkT: -1, batteryLowFrac: 1, nightS: 0, darkDuringNightS: 0, nightEndured: 0,
      returns: 0, returnsBy: { oxygen: 0, battery: 0, suit: 0, call: 0 }, firstReturnT: -1,
      hazardHits: { radiation: 0, rockfall: 0, acid: 0 }, radiationS: 0, shelteredS: 0, rockfallsDodged: 0,
      o2Used: 0, o2StockOut: -1, canistersUsed: 0, energyOutS: 0,
      gbitScanned: 0, gbitOverwritten: 0, valueOverwritten: 0, recorderFullS: 0,
      gbitSent: 0, valueSent: 0, windows: [], dishDowns: 0, plantT: -1,
      samplesTaken: 0, samplesDelivered: 0, samplesLeft: 0, carriedSamples: 0,
      scansBlocked: {}, waitS: 0, boilKg: 0,
      faultsSeen: 0, faultsFixed: 0, faultS: { panels: 0, charger: 0 },
    };
  }

  function planUplink(S) {
    const up = S.loadout.uplink;
    const windows = [];
    let t = up.firstS;
    let i = 0;
    while (t < S.T - TUNE.autoExtractLeftS - 4 && i < 8) {
      windows.push({ i, start: t, dur: up.windowS, rateGbitS: up.rateGbitS, sentGbit: 0, state: 'upcoming', planted: false, heldS: 0, unheldS: 0, availableGbit: 0, lostToDish: 0, dishDown: false, dataDry: 0 });
      t += up.everyS + up.windowS;
      i++;
    }
    return { windows, open: -1, nextIn: windows.length ? windows[0].start : 0, planted: false, align: 0, rateNow: 0, gbitSent: 0, valueSent: 0, label: up.label, holdR: TUNE.dishHoldR, tickAcc: 0, boostT: 0 };
  }

  // Hazards are planned up front from the seed: same seed, same weather.
  function planHazards(S) {
    const W = WORLDS[S.world];
    const rng = mulberry(hash32('haz|' + S.seed + '|' + S.world));
    const plan = [];
    const h = W.hazards;
    const mult = S.diff.hazard;
    const add = (kind, count, fn) => {
      const n = Math.max(1, Math.round(count * mult));
      for (let i = 0; i < n; i++) {
        const t = S.T * (0.18 + 0.66 * ((i + 0.3 + rng() * 0.4) / n));
        plan.push(Object.assign({ kind, t }, fn()));
      }
    };
    if (h.storm) add('storm', h.storm, () => ({ warn: 10, dur: 24 + rng() * 14 }));
    if (h.acid) add('acid', h.acid, () => ({ warn: 10, dur: 18 + rng() * 10 }));
    if (h.radiation) add('radiation', h.radiation, () => ({ warn: 12, dur: 10 + rng() * 6 }));
    if (h.quake) add('quake', h.quake, () => ({ warn: 4, dur: 4 + rng() * 2 }));
    plan.sort((a, b) => a.t - b.t);
    // Never two warnings on top of each other: one alarm at a time.
    for (let i = 1; i < plan.length; i++) {
      const prev = plan[i - 1];
      const minT = prev.t + prev.dur + plan[i].warn + 6;
      if (plan[i].t < minT) plan[i].t = minT;
    }
    return plan.filter((p) => p.t < S.T - TUNE.autoExtractLeftS - 6);
  }

  // Lander faults, planned from the seed like the weather. Each sits at a fixed spot on the
  // lander's hull: dusty or slipped solar panels (less power) or a tripped suit charger (no
  // recharging) until the engineer holds Use there.
  function planFaults(S) {
    const rng = mulberry(hash32('fault|' + S.seed + '|' + S.world));
    const n = FAULTS[S.difficulty] || 2;
    const L = S.map.lander;
    const base = FAULT_KINDS[S.world] || ['panels', 'charger'];
    const kinds = base.length > 1 && rng() < 0.5 ? base.slice().reverse() : base.slice();
    const spots = { panels: { x: L.x + 4.8, z: L.z + 0.6 }, charger: { x: L.x - 4.6, z: L.z - 0.8 } };
    const plan = [];
    for (let i = 0; i < n; i++) {
      const kind = kinds[i % kinds.length];
      const t = S.T * (0.2 + 0.48 * ((i + 0.25 + rng() * 0.5) / n));
      plan.push({ kind, t, x: spots[kind].x, z: spots[kind].z });
    }
    return plan.filter((f) => f.t < S.T - TUNE.autoExtractLeftS - 30);
  }

  function updateFaults(S, V) {
    while (S.faultPlan.length && S.t >= S.faultPlan[0].t) {
      const f = S.faultPlan.shift();
      // One fault of a kind at a time: a second one on the same part just adds to the first.
      if (S.faults.some((x) => x.kind === f.kind)) continue;
      S.faults.push({ id: 'f' + S.nextId++, kind: f.kind, x: f.x, z: f.z, fixT: 0, since: S.t });
      S.stats.faultsSeen++;
      emit(S, 'fault', f.x, f.z, { kind: f.kind });
    }
    for (const f of S.faults) S.stats.faultS[f.kind] = (S.stats.faultS[f.kind] || 0) + TICK;
  }

  const faultOn = (S, kind) => S.faults.some((f) => f.kind === kind);

  // ---------------------------------------------------------------- jobs
  // May this astronaut do this task? Their job, or nobody holding that job is still out there
  // (an empty seat, or the one who has it is aboard for good), or the jobs rule is off.
  function owns(S, V, p, task) {
    if (!S.jobs) return true;
    const job = TASK_JOB[task];
    if (!job) return true;
    const jobs = task === 'choose' ? CHOOSERS : [job];
    if (jobs.indexOf(p.role) >= 0) return true;
    return !V.players.some((q) => jobs.indexOf(q.role) >= 0 && !q.aboard);
  }

  // ---------------------------------------------------------------- fixtures
  function fixture(name, world) {
    world = WORLDS[world] ? world : 'mars';
    const instruments = {
      moon: [
        { id: 'spectrometer', name: 'Neutron spectrometer', fits: ['ice', 'mineral'], rate: 1, value: 1 },
        { id: 'thermal', name: 'Thermal imager', fits: ['thermal', 'organic'], rate: 1, value: 1 },
      ],
      mars: [
        { id: 'spectrometer', name: 'Mass spectrometer', fits: ['ice', 'mineral'], rate: 1, value: 1 },
        { id: 'chem', name: 'Gas chromatograph', fits: ['organic', 'atmosphere', 'thermal'], rate: 1, value: 1 },
      ],
      venus: [
        { id: 'gas', name: 'Cloud sampler', fits: ['atmosphere', 'organic'], rate: 1, value: 1 },
        { id: 'thermal', name: 'IR radiometer', fits: ['thermal', 'mineral'], rate: 1, value: 1 },
      ],
      europa: [
        { id: 'mass', name: 'Plume mass spectrometer', fits: ['organic', 'ice'], rate: 1, value: 1 },
        { id: 'thermal', name: 'Thermal imager', fits: ['thermal', 'mineral'], rate: 1, value: 1 },
      ],
    }[world];
    const sunMul = { moon: 1, mars: 1.4, venus: 0.6, europa: 0 }[world];
    const rtg = world === 'europa' ? 1 : 0;
    const base = {
      world,
      spareO2: 2,
      drill: { id: 'deep', depthM: 3 },
      power: { solarW: 3200 * sunMul, batteryWh: 7000, rtgW: rtg * 700 },
      instruments,
      recorderGbit: 130,
      uplink: { rateGbitS: 5.5, everyS: 62, windowS: 34, firstS: 52, label: 'relay orbiter' },
      landing: { offsetM: 6, inRange: true },
      lifetimeS: 300,
      ascent: { liftKg: 110 },
      parts: { radio: '20 W radio', antenna: '1.5 m dish', battery: '7 kWh battery', solar: 'solar array', recorder: '130 Gbit recorder' },
    };
    const presets = {
      good: base,
      poor: Object.assign({}, base, {
        spareO2: 0, drill: null,
        power: { solarW: 900 * sunMul, batteryWh: 1800, rtgW: rtg * 200 },
        instruments: instruments.slice(0, 1),
        recorderGbit: 40,
        uplink: { rateGbitS: 1.4, everyS: 96, windowS: 16, firstS: 70, label: 'direct to Earth' },
        landing: { offsetM: 34, inRange: true },
        lifetimeS: 245,
        ascent: { liftKg: 25 },
        parts: { radio: '5 W radio', antenna: '0.5 m dish', battery: '1.8 kWh battery', solar: 'small array', recorder: '40 Gbit recorder' },
      }),
      empty: { world, spareO2: 0, power: { solarW: 0, batteryWh: 0, rtgW: 0 }, instruments: [], recorderGbit: 0, uplink: { rateGbitS: 0, everyS: 200, windowS: 5, firstS: 150 }, landing: { offsetM: 70, inRange: false }, lifetimeS: 150, ascent: { liftKg: 0 } },
      maxed: Object.assign({}, base, {
        spareO2: 6,
        power: { solarW: 12000, batteryWh: 30000, rtgW: 2000 },
        recorderGbit: 600,
        uplink: { rateGbitS: 25, everyS: 40, windowS: 50, firstS: 35, label: 'relay orbiter' },
        landing: { offsetM: 0, inRange: true },
        lifetimeS: 360,
        ascent: { liftKg: 500 },
      }),
    };
    presets.mid = Object.assign({}, base, {
      spareO2: 1, drill: { id: 'hand', depthM: 1 },
      power: { solarW: 1900 * sunMul, batteryWh: world === 'venus' ? 6500 : 4200, rtgW: rtg * 300 },
      recorderGbit: 80,
      uplink: { rateGbitS: 3, everyS: 74, windowS: 26, firstS: 60, label: 'relay orbiter' },
      landing: { offsetM: 16, inRange: true },
      lifetimeS: 275,
      ascent: { liftKg: 45 },
      parts: { radio: '10 W radio', antenna: '1 m dish', battery: '4.2 kWh battery', solar: 'mid array', recorder: '80 Gbit recorder' },
    });
    const out = presets[name] || presets.good;
    return JSON.parse(JSON.stringify(out));
  }

  // ---------------------------------------------------------------- crew wellbeing
  function dropCarried(S, p) {
    const s = byId(S, p.carrying);
    p.carrying = null;
    if (!s) return;
    p.tally.dropped++;
    s.heldBy = null;
    s.state = 'ground';
    s.x = p.x;
    s.z = p.z;
    emit(S, 'sampleDrop', p.x, p.z, { id: s.id });
  }

  // A suit that runs out of air, power or integrity flies its wearer home. No combat, no death.
  function sendHome(S, p, reason) {
    if (p.returning || p.aboard) return;
    p.returning = reason;
    p.restT = 0;
    if (p.carrying) dropCarried(S, p);
    if (reason !== 'call') {
      S.stats.returns++;
      S.stats.returnsBy[reason] = (S.stats.returnsBy[reason] || 0) + 1;
      if (S.stats.firstReturnT < 0) S.stats.firstReturnT = S.t;
      p.tally.returns++;
    } else S.stats.returnsBy.call++;
    emit(S, 'suitReturn', p.x, p.z, { id: p.id, reason });
  }

  function wearSuit(S, p, amount, source) {
    if (p.aboard || p.returning || amount <= 0) return;
    p.hp = Math.max(0, p.hp - amount);
    if (source && S.stats.hazardHits[source] != null && amount >= 1) S.stats.hazardHits[source]++;
    if (p.hp <= 0) sendHome(S, p, 'suit');
  }

  // ---------------------------------------------------------------- sun, power and base
  function updateSun(S) {
    const W = WORLDS[S.world];
    const start = W.nightStart * S.T;
    const end = start + W.nightLen * S.T;
    const up = S.t < start || S.t >= end;
    // The sun ramps over the 30 s around each sunset and sunrise.
    const edge = S.t < start ? start - S.t : S.t - end;
    const el = up ? clamp(0.1 + edge / 30, 0, 1) : 0;
    if (up !== S.sun.up) {
      emit(S, up ? 'sunrise' : 'sunset', 0, 0);
      if (!up) S.stats.nightEndured++;
    }
    S.sun.up = up;
    S.sun.elevation = Math.max(0, el);
    let light = up ? 0.35 + 0.65 * Math.min(1, el * 2) : 0.12;
    for (const h of S.hazards) {
      if (h.state === 'active' && (h.kind === 'storm' || h.kind === 'acid')) light *= 0.6;
    }
    S.sun.light = light;
    S.sun.nextChangeIn = S.t < start ? start - S.t : S.t < end ? end - S.t : -1;
  }

  function hazardActive(S, kind) {
    for (const h of S.hazards) if (h.kind === kind && h.state === 'active') return h;
    return null;
  }

  function updateBase(S, V) {
    const B = S.base;
    const ld = S.loadout;
    const flux = WORLDS[S.world].flux / 1361;
    const stormed = hazardActive(S, 'storm') ? 0.25 : hazardActive(S, 'acid') ? 0.6 : 1;
    const panels = faultOn(S, 'panels') ? TUNE.panelsFaultFactor : 1;
    const solar = ld.power.solarW * flux * S.sun.elevation * stormed * panels + ld.power.rtgW;
    B.solarW = solar;

    const needCharge = V.players.some((p) => !p.aboard && dist(p, V.lander) < TUNE.landerRadius && p.energy < TUNE.energyMax - 1);
    const night = !S.sun.up || S.sun.light < 0.3;

    const hrs = TUNE.hoursPerS * TICK;
    const avail = B.battery / hrs + solar;
    let load = TUNE.loadIdleW;
    const shed = (w) => {
      if (load + w <= avail + 1e-6) {
        load += w;
        return true;
      }
      return false;
    };
    // Shedding order when power runs short: the charger goes first, then the lights, then the heat.
    const heat = !S.sun.up && shed(TUNE.loadHeatW);
    const lights = night && shed(TUNE.loadLightsW);
    const charger = needCharge && !faultOn(S, 'charger') && shed(TUNE.loadChargerW);

    B.battery = clamp(B.battery + (solar - load) * hrs, 0, B.batteryMax);
    B.loadW = load;

    const frac = B.batteryMax > 0 ? B.battery / B.batteryMax : 0;
    if (B.batteryMax > 0 && frac < S.stats.batteryLowFrac) S.stats.batteryLowFrac = frac;

    B.heatOn = heat;
    B.lightsOn = lights;
    B.chargerOn = charger;
    // "Dark" means the base cannot even keep the cabin warm and the lights on when it needs them.
    const nowDark = (!S.sun.up && !heat) || (night && !lights);
    if (nowDark !== B.dark) {
      B.dark = nowDark;
      emit(S, nowDark ? 'baseDark' : 'baseLit', V.lander.x, V.lander.z);
      if (nowDark && S.stats.firstDarkT < 0) S.stats.firstDarkT = S.t;
    }
    V.lander.state = B.dark ? 'dark' : 'idle';
    if (!S.sun.up) S.stats.nightS += TICK;
    if (B.dark) {
      S.stats.darkS += TICK;
      if (!S.sun.up) S.stats.darkDuringNightS += TICK;
    }
    B.shelter = S.hazards.some((h) => h.kind === 'radiation' && (h.state === 'active' || h.state === 'warn'));
  }

  // ---------------------------------------------------------------- uplink and recorder
  function storeData(S, site, gbit, value) {
    if (S.recorder.capacityGbit <= 0) return;
    const R = S.recorder;
    let room = R.capacityGbit - R.usedGbit;
    if (room < gbit) {
      // Overwrite the worst data per Gbit until the new data fits.
      let need = gbit - room;
      R.sets.sort((a, b) => a.value / Math.max(a.gbit, 0.01) - b.value / Math.max(b.gbit, 0.01));
      const density = value / Math.max(gbit, 0.001);
      for (const set of R.sets) {
        if (need <= 0) break;
        if (set.siteId === site.id) continue;
        if (set.value / Math.max(set.gbit, 0.01) >= density) break;
        const cut = Math.min(set.gbit, need);
        const lostV = (cut / set.gbit) * set.value;
        set.gbit -= cut;
        set.value -= lostV;
        S.stats.gbitOverwritten += cut;
        S.stats.valueOverwritten += lostV;
        R.usedGbit -= cut;
        need -= cut;
      }
      R.sets = R.sets.filter((s) => s.gbit > 0.001);
      room = R.capacityGbit - R.usedGbit;
      if (room < gbit - 1e-6) {
        S.stats.recorderFullS += TICK;
        const frac = room / gbit;
        gbit = room;
        value *= frac;
        if (S.tick % 30 === 0) emit(S, 'recorderFull', site.x, site.z);
        if (gbit <= 0.0001) return;
      } else if (S.tick % 30 === 0) {
        emit(S, 'dataOverwritten', site.x, site.z, { gbit: Math.round(gbit) });
      }
    }
    let set = R.sets.find((s) => s.siteId === site.id);
    if (!set) {
      set = { siteId: site.id, siteKind: site.siteKind, gbit: 0, value: 0 };
      R.sets.push(set);
    }
    set.gbit += gbit;
    set.value += value;
    R.usedGbit += gbit;
    S.stats.gbitScanned += gbit;
  }

  function updateUplink(S, V) {
    const U = S.uplink;
    const dish = V.dish;
    U.planted = !!dish.planted;
    U.align = dish.planted ? dish.align : 0;
    U.rateNow = 0;
    U.boostT = Math.max(0, (U.boostT || 0) - TICK);

    if (U.open < 0) {
      const next = U.windows.find((w) => w.state === 'upcoming');
      if (next) {
        U.nextIn = next.start - S.t;
        if (S.t >= next.start) {
          next.state = 'open';
          next.planted = U.planted;
          U.open = next.i;
          emit(S, 'windowOpen', dish.x, dish.z, { i: next.i });
        }
      } else U.nextIn = -1;
    }

    if (U.open >= 0) {
      const w = U.windows[U.open];
      w.availableGbit = Math.max(w.availableGbit, S.recorder.usedGbit);
      const elapsed = S.t - w.start;
      if (elapsed >= w.dur || S.stage === 'over') {
        w.state = 'done';
        U.open = -1;
        emit(S, 'windowClose', dish.x, dish.z, { i: w.i, sentGbit: w.sentGbit });
        S.stats.windows.push(windowFact(w));
      } else if (U.planted) {
        w.planted = true;
        dish.state = 'transmit';
        const holders = V.players.filter((p) => !p.aboard && !p.returning && dist(p, dish) < TUNE.dishHoldR && owns(S, V, p, 'uplink'));
        // Jobs: Communications runs the uplink alone, at the full rate a pair used to manage.
        const hold = holders.length === 0 ? 0.35 : holders.length === 1 && !S.jobs ? 0.8 : 1;
        for (const p of holders) p.tally.heldS += TICK;
        const commsBonus = holders.some((p) => p.role === 'comms') ? 1.25 : 1;
        const boost = U.boostT > 0 ? 1.4 : 1;
        if (holders.length) w.heldS += TICK;
        else w.unheldS += TICK;
        const rate = w.rateGbitS * hold * commsBonus * boost * clamp(dish.align, 0.15, 1);
        U.rateNow = rate;
        let budget = rate * TICK;
        if (S.recorder.usedGbit <= 0.001) w.dataDry += TICK;
        const R = S.recorder;
        R.sets.sort((a, b) => b.value / Math.max(b.gbit, 0.01) - a.value / Math.max(a.gbit, 0.01));
        let sent = 0;
        for (const set of R.sets) {
          if (budget <= 0) break;
          const cut = Math.min(set.gbit, budget);
          const v = (cut / set.gbit) * set.value;
          set.gbit -= cut;
          set.value -= v;
          budget -= cut;
          sent += cut;
          U.valueSent += v;
          S.stats.valueSent += v;
          const site = byId(S, set.siteId);
          if (site) site.valueSent = (site.valueSent || 0) + v;
        }
        R.sets = R.sets.filter((s) => s.gbit > 0.001);
        R.usedGbit = Math.max(0, R.usedGbit - sent);
        w.sentGbit += sent;
        U.gbitSent += sent;
        S.stats.gbitSent += sent;
        U.tickAcc += sent;
        if (U.tickAcc >= 0.5 || (sent > 0 && S.tick % 8 === 0)) {
          emit(S, 'uplinkTick', dish.x, dish.z, { gbit: U.tickAcc, i: w.i });
          U.tickAcc = 0;
        }
      } else {
        w.lostToDish += TICK;
      }
    }

    if (!dish.planted) dish.state = 'idle';
    else if (U.open < 0) dish.state = 'planted';
  }

  function windowFact(w) {
    return { i: w.i, start: w.start, dur: w.dur, rateGbitS: w.rateGbitS, sentGbit: w.sentGbit, planted: w.planted, heldS: w.heldS, unheldS: w.unheldS, availableGbit: w.availableGbit, lostToDish: w.lostToDish, dishDown: false };
  }

  // ---------------------------------------------------------------- hazards
  function updateHazards(S, V) {
    while (S.hazardPlan.length && S.t >= S.hazardPlan[0].t - S.hazardPlan[0].warn) {
      const h = S.hazardPlan.shift();
      const hz = { id: 'h' + S.nextId++, kind: h.kind, x: V.lander.x, z: V.lander.z, r: 999, state: 'warn', tLeft: h.warn, dur: h.dur, warned: true };
      S.hazards.push(hz);
      emit(S, 'hazardWarn', 0, 0, { kind: h.kind, inS: h.warn });
    }
    const keep = [];
    for (const h of S.hazards) {
      h.tLeft -= TICK;
      if (h.kind === 'rockfall') {
        if (h.tLeft <= 0) {
          emit(S, 'rockfall', h.x, h.z, { r: h.r });
          for (const p of V.players) {
            if (p.aboard || p.returning) continue;
            if (len(p.x - h.x, p.z - h.z) < h.r) {
              wearSuit(S, p, TUNE.rockfallHit * S.diff.hazard, 'rockfall');
              p.slowT = 1.2;
              emit(S, 'hit', p.x, p.z, { target: p.id, amount: Math.round(TUNE.rockfallHit), by: 'rockfall' });
            } else if (len(p.x - h.x, p.z - h.z) < h.r + 6) S.stats.rockfallsDodged++;
          }
          if (V.dish.planted && len(V.dish.x - h.x, V.dish.z - h.z) < h.r + 1) {
            V.dish.align = Math.max(0.15, V.dish.align - 0.3);
            S.stats.dishDowns++;
          }
          spawn(S, 'boulder', { x: h.x, z: h.z, r: 1.2, tLeft: 20, state: 'idle' });
          continue;
        }
        keep.push(h);
        continue;
      }
      if (h.state === 'warn' && h.tLeft <= 0) {
        h.state = 'active';
        h.tLeft = h.dur;
        emit(S, 'hazardStart', 0, 0, { kind: h.kind });
        if (h.kind === 'quake') onQuake(S, V);
      } else if (h.state === 'active' && h.tLeft <= 0) {
        emit(S, 'hazardEnd', 0, 0, { kind: h.kind });
        continue;
      }
      if (h.state === 'active') applyHazard(S, V, h);
      keep.push(h);
    }
    S.hazards = keep;
    for (const b of V.boulders) {
      b.tLeft -= TICK;
      if (b.tLeft <= 0) markGone(S, b);
    }
  }

  // A quake shakes the dish out of alignment and drops a few rocks near the crew,
  // each one marked on the ground well before it lands.
  function onQuake(S, V) {
    emit(S, 'quake', 0, 0);
    if (V.dish.planted) V.dish.align = Math.max(0.15, V.dish.align - 0.4);
    const live = V.players.filter((p) => !p.aboard && !p.returning && dist(p, V.lander) > TUNE.landerRadius);
    const n = Math.round(4 * S.diff.hazard);
    for (let i = 0; i < n && live.length; i++) {
      const p = live[Math.floor(rnd(S) * live.length)];
      const a = rnd(S) * Math.PI * 2;
      const r = 2 + rnd(S) * 9;
      S.hazards.push({ id: 'h' + S.nextId++, kind: 'rockfall', x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, r: 3, state: 'warn', tLeft: 1.8 + rnd(S) * 0.8, warned: false });
    }
  }

  function sheltered(S, V, p) {
    if (tileAt(S.map, p.x, p.z) === T_SHADOW) return true;
    return dist(p, V.lander) < TUNE.shelterRadius;
  }

  function applyHazard(S, V, h) {
    if (h.kind === 'radiation') {
      for (const p of V.players) {
        if (p.aboard || p.returning) continue;
        if (sheltered(S, V, p)) {
          S.stats.shelteredS += TICK;
          continue;
        }
        S.stats.radiationS += TICK;
        wearSuit(S, p, TUNE.radiationDose * TICK * S.diff.hazard, S.tick % 30 === 0 ? 'radiation' : null);
      }
    } else if (h.kind === 'storm') {
      if (V.dish.planted && S.tick % 15 === 0) V.dish.align = Math.max(0.35, V.dish.align - 0.01);
    } else if (h.kind === 'acid') {
      for (const p of V.players) {
        if (p.aboard || p.returning || sheltered(S, V, p)) continue;
        wearSuit(S, p, TUNE.acidDose * TICK * S.diff.hazard, S.tick % 30 === 0 ? 'acid' : null);
      }
    }
  }

  // ---------------------------------------------------------------- samples and ascent
  function deliver(S, V, sample) {
    if (!sample || sample.gone) return;
    markGone(S, sample);
    S.ascent.rack.push({ id: sample.id, siteKind: sample.siteKind, massKg: sample.massKg, value: sample.value, core: sample.core, siteId: sample.siteId });
    updateAscent(S);
    S.stats.samplesDelivered++;
    S.stats.carriedSamples++;
    emit(S, 'sampleDelivered', V.lander.x, V.lander.z, { id: sample.id, via: 'carry' });
  }

  function updateAscent(S) {
    const A = S.ascent;
    A.loadedKg = A.rack.reduce((sum, r) => sum + r.massKg, 0);
    A.overKg = Math.max(0, A.loadedKg - A.liftKg);
  }

  function jettison(S, V, id) {
    const A = S.ascent;
    const i = A.rack.findIndex((r) => r.id === id);
    if (i < 0) return false;
    const r = A.rack.splice(i, 1)[0];
    A.jettisoned.push(Object.assign({ reason: 'crew' }, r));
    updateAscent(S);
    emit(S, 'jettison', V.lander.x, V.lander.z, { id: r.id, massKg: r.massKg, value: r.value });
    return true;
  }

  // ---------------------------------------------------------------- player control
  function pickup(S, V, p) {
    for (const k of V.pickups) {
      if (k.gone) continue;
      if (len(k.x - p.x, k.z - p.z) > 1.8) continue;
      if (k.item === 'energy') p.energy = TUNE.energyMax;
      else if (k.item === 'o2') {
        p.o2 = TUNE.o2Tank;
        S.base.o2Stock = Math.min(S.base.o2StockMax, S.base.o2Stock + 40);
        S.stats.canistersUsed++;
      }
      markGone(S, k);
      emit(S, 'pickup', p.x, p.z, { item: k.item, by: p.id });
    }
  }

  function speedOf(S, p) {
    let sp = TUNE.moveSpeed * WORLDS[S.world].speed;
    if (p.carrying) {
      const s = byId(S, p.carrying);
      if (s) sp *= Math.max(TUNE.carryMinFactor, 1 - s.massKg * TUNE.carryPenaltyPerKg);
    }
    if (p.slowT > 0) sp *= 0.62;
    if (hazardActive(S, 'storm') || hazardActive(S, 'acid')) sp *= 0.8;
    if (p.sprinting) sp *= TUNE.sprintFactor;
    return sp;
  }

  // At the lander: air from the reserve, a charged battery if the base has power, a patched suit.
  function service(S, V, p) {
    if (dist(p, V.lander) >= TUNE.landerRadius) return false;
    if (S.base.o2Stock > 0 && p.o2 < TUNE.o2Tank) {
      const take = Math.min(TUNE.o2Refill * TICK, S.base.o2Stock, TUNE.o2Tank - p.o2);
      p.o2 += take;
      S.base.o2Stock -= take;
      if (S.base.o2Stock <= 0 && S.stats.o2StockOut < 0) {
        S.stats.o2StockOut = S.t;
        emit(S, 'o2StockOut', V.lander.x, V.lander.z);
      }
    }
    if (S.base.chargerOn && p.energy < TUNE.energyMax) p.energy = Math.min(TUNE.energyMax, p.energy + TUNE.energyRecharge * TICK);
    if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + TUNE.suitPatch * TICK * (p.role === 'engineer' ? 1.6 : 1));
    return true;
  }

  function control(S, V, p, inp) {
    if (p.aboard) {
      p.state = 'idle';
      return;
    }
    p.abilityCd = Math.max(0, p.abilityCd - TICK);
    p.overclockT = Math.max(0, p.overclockT - TICK);
    p.slowT = Math.max(0, p.slowT - TICK);
    S.prompts[p.playerId] = null;

    // Autopilot home: the suit takes over, no input, the emergency reserve keeps them breathing.
    if (p.returning) {
      p.useKind = null;
      p.useT = 0;
      p.sprinting = false;
      const L = V.lander;
      if (dist(p, L) < TUNE.landerRadius - 2) {
        const reason = p.returning;
        p.returning = null;
        p.vx = p.vz = 0;
        if (reason === 'call') {
          p.state = 'idle';
          return;
        }
        p.restT = TUNE.restS;
        p.o2 = Math.max(p.o2, 8);
        p.energy = Math.max(p.energy, 6);
        emit(S, 'suitHome', p.x, p.z, { id: p.id });
      } else {
        const dir = { moveX: 0, moveY: 0 };
        steerTo(S, p, L.x, L.z, dir);
        const next = stepMove({ x: p.x, z: p.z, vx: p.vx, vz: p.vz, r: p.r, speed: TUNE.moveSpeed * WORLDS[S.world].speed * TUNE.returnSpeed }, dir, TICK, S.map);
        p.x = next.x;
        p.z = next.z;
        p.vx = next.vx;
        p.vz = next.vz;
        if (len(p.vx, p.vz) > 0.5) p.heading = Math.atan2(p.vz, p.vx);
        p.state = 'return';
        S.prompts[p.playerId] = 'returning';
        return;
      }
    }
    // Resting at the lander while the suit is serviced.
    if (p.restT > 0) {
      p.restT -= TICK;
      service(S, V, p);
      p.state = 'rest';
      p.vx = p.vz = 0;
      S.prompts[p.playerId] = 'rest';
      // No air left anywhere: this astronaut stays aboard for the rest of the mission.
      if (p.restT <= 0 && p.o2 < 20 && S.base.o2Stock <= 0) {
        p.aboard = true;
        emit(S, 'boarded', p.x, p.z, { id: p.id, reason: 'oxygen' });
      }
      return;
    }

    // Air, battery, cold.
    const nearLander = dist(p, V.lander) < TUNE.landerRadius;
    const nearLight = S.base.lightsOn && dist(p, V.lander) < S.base.lightR;
    const inShadow = S.world === 'moon' && V.sites.some((s) => s.shadow && dist(s, p) < s.r + 3);
    const cold = (!S.sun.up && !nearLight) || inShadow;
    const drain = TUNE.o2Drain * S.diff.drain * (cold ? 1.25 : 1) * TICK;
    if (!nearLander) {
      p.o2 = Math.max(0, p.o2 - drain);
      S.stats.o2Used += drain;
      let e = TUNE.energyIdle;
      if (cold) e += TUNE.energyCold;
      if (hazardActive(S, 'storm') || hazardActive(S, 'acid')) e += TUNE.energyStorm;
      if (p.useKind === 'scan') e += TUNE.energyScan;
      p.energy = Math.max(0, p.energy - e * S.diff.drain * TICK);
    }
    service(S, V, p);
    if (p.o2 <= 0) {
      sendHome(S, p, 'oxygen');
      return;
    }
    if (p.energy <= 0) {
      S.stats.energyOutS += TICK;
      sendHome(S, p, 'battery');
      return;
    }
    if ((p.o2 < 22 || p.energy < 15) && S.tick % 150 === p.slot * 30) emit(S, p.o2 < 22 ? 'lowO2' : 'lowBattery', p.x, p.z, { id: p.id });

    const use = !!(inp.use || inp.fire);
    const useEdge = use && !p.prev.use;
    const abilityEdge = !!inp.ability && !p.prev.ability;
    p.prev.use = use;
    p.prev.ability = !!inp.ability;

    if (inp.jettison && S.stage === 'extraction' && owns(S, V, p, 'choose') && jettison(S, V, String(inp.jettison))) p.tally.dropped++;

    // Movement.
    const mx = clamp(+inp.moveX || 0, -1, 1);
    const mz = clamp(+inp.moveY || 0, -1, 1);
    const mag = Math.min(1, len(mx, mz));
    p.sprinting = !!inp.sprint && mag > 0.2 && !p.carrying && p.o2 > 0;
    if (p.sprinting && !nearLander) p.o2 = Math.max(0, p.o2 - TUNE.sprintO2 * TICK);
    const next = stepMove({ x: p.x, z: p.z, vx: p.vx, vz: p.vz, r: p.r, speed: speedOf(S, p) }, { moveX: mx, moveY: mz }, TICK, S.map);
    p.x = next.x;
    p.z = next.z;
    p.vx = next.vx;
    p.vz = next.vz;
    const spd = len(p.vx, p.vz);
    p.state = spd > 0.8 ? (p.carrying ? 'carry' : 'walk') : p.carrying ? 'carry' : 'idle';
    if (inp.shooter && len(inp.aimX || 0, inp.aimY || 0) > 0.15) p.heading = Math.atan2(inp.aimY, inp.aimX);
    else if (spd > 0.8) p.heading = Math.atan2(p.vz, p.vx);
    else if (len(inp.aimX || 0, inp.aimY || 0) > 0.15) p.heading = Math.atan2(inp.aimY, inp.aimX);

    pickup(S, V, p);
    interact(S, V, p, use, useEdge);
    role(S, V, p, inp, abilityEdge);
  }

  function interact(S, V, p, use, useEdge) {
    const was = p.useKind;
    p.useKind = null;
    interactOne(S, V, p, use, useEdge);
    p.useT = p.useKind && p.useKind === was ? p.useT + TICK : p.useKind ? TICK : 0;
  }

  function interactOne(S, V, p, use, useEdge) {
    if (p.carrying) {
      S.prompts[p.playerId] = 'deliver';
      if (dist(p, V.lander) < TUNE.landerRadius) {
        const s = byId(S, p.carrying);
        p.carrying = null;
        if (s) {
          deliver(S, V, s);
          p.tally.carried++;
        }
        return;
      }
      if (useEdge) {
        dropCarried(S, p);
        return;
      }
      return;
    }

    let near = null;
    for (const s of V.samples) {
      if (s.gone || s.heldBy) continue;
      if (dist(s, p) < 2.6) near = s;
    }
    if (near) {
      S.prompts[p.playerId] = 'pickup';
      if (useEdge) {
        near.heldBy = p.id;
        near.state = 'carried';
        p.carrying = near.id;
        emit(S, 'samplePickup', p.x, p.z, { id: near.id, by: p.id });
        return;
      }
    }

    // Lander faults: the engineer's.
    if (S.faults.length && owns(S, V, p, 'repair')) {
      const f = S.faults.find((x) => dist(x, p) < TUNE.repairR);
      if (f) {
        S.prompts[p.playerId] = 'repair';
        if (use) {
          p.useKind = 'repair';
          p.state = 'repair';
          f.fixT += TICK / TUNE.repairS;
          if (f.fixT >= 1) {
            S.faults = S.faults.filter((x) => x !== f);
            S.stats.faultsFixed++;
            p.tally.repairs++;
            emit(S, 'faultFixed', f.x, f.z, { kind: f.kind, by: p.id });
          }
          return;
        }
      }
    }

    // Science sites: the scientist's.
    let site = null;
    if (owns(S, V, p, 'scan')) {
      for (const s of V.sites) {
        if (s.done) continue;
        if (dist(s, p) < s.r) site = s;
      }
    }
    if (site) {
      if (!site.fits) {
        S.prompts[p.playerId] = 'needs_instrument';
        S.stats.scansBlocked[site.id] = true;
      } else {
        S.prompts[p.playerId] = 'scan';
        if (use) {
          scan(S, V, p, site);
          return;
        }
      }
    }

    // Dish.
    const dish = V.dish;
    const dishD = dist(p, dish);
    if (dishD < 4.5 && owns(S, V, p, 'plant')) {
      if (!dish.planted) {
        S.prompts[p.playerId] = 'plant';
        if (use) {
          p.useKind = 'plant';
          p.state = 'plant';
          const need = p.role === 'comms' ? TUNE.plantS.comms : TUNE.plantS.other;
          dish.plantT += TICK / need;
          if (dish.plantT >= 1) {
            p.tally.plants++;
            dish.planted = true;
            dish.align = 1;
            dish.plantT = 0;
            if (S.stats.plantT < 0) S.stats.plantT = S.t;
            emit(S, 'dishPlanted', dish.x, dish.z, { by: p.id });
          }
          return;
        }
      } else if (dish.align < 0.99) {
        S.prompts[p.playerId] = 'align';
        if (use) {
          p.useKind = 'align';
          p.state = 'repair';
          dish.align = Math.min(1, dish.align + (p.role === 'comms' ? 0.5 : 0.2) * TICK);
          if (dish.align >= 0.99) p.tally.aligns++;
          return;
        }
      }
    }
    if (!S.prompts[p.playerId] && S.base.shelter && !sheltered(S, V, p)) S.prompts[p.playerId] = 'shelter';
  }

  function scan(S, V, p, site) {
    p.useKind = 'scan';
    p.state = 'scan';
    site.state = 'scanning';
    const fits = S.loadout.instruments.filter((it) => it.fits.indexOf(site.siteKind) >= 0);
    let best = fits[0];
    for (const it of fits) if (it.rate > best.rate) best = it;
    const roleF = p.role === 'scientist' ? 1 : TUNE.scanOther;
    const oc = p.overclockT > 0 ? TUNE.scanOverclock : 1;
    const rate = (best.rate * roleF * oc) / site.scanS;
    const dp = Math.min(rate * TICK, 1 - site.scanned);
    site.scanned += dp;
    const value = site.value * site.valueBonus * dp;
    storeData(S, site, site.gbit * dp, value);
    if (S.tick % 10 === 0) emit(S, 'scan', site.x, site.z, { siteId: site.id, progress: site.scanned, by: p.id });
    if (site.scanned >= 0.9999) {
      site.done = true;
      site.state = 'done';
      p.tally.scans++;
      if (S.route && S.route.siteId === site.id) S.route = null;
      emit(S, 'scanDone', site.x, site.z, { siteId: site.id, by: p.id });
      // The scan leaves a physical sample. A drill pulls a heavy, valuable core.
      if (!site.sampleTaken) {
        site.sampleTaken = true;
        const spot = freeSpot(S, site.x, site.z, 4, 16) || { x: site.x, z: site.z };
        const core = S.loadout.drill.has;
        const massKg = site.massKg * S.loadout.drill.coreMass;
        const value2 = site.value * S.loadout.drill.coreValue;
        spawn(S, 'sample', { x: spot.x, z: spot.z, r: 0.7, state: 'ground', siteKind: site.siteKind, siteId: site.id, massKg, value: value2, core, heldBy: null, objective: !!site.objective });
        S.stats.samplesTaken++;
        emit(S, 'sampleTaken', spot.x, spot.z, { siteId: site.id });
      }
    }
  }

  // Role abilities are small helps, never weapons.
  function role(S, V, p, inp, abilityEdge) {
    if (p.role === 'planner') {
      if (inp.ability) {
        p.abilityHold += TICK;
        if (p.abilityHold >= 1.2 && !S.extraction.called && S.t > 30 && S.stage === 'play') {
          callExtraction(S, V, p.id);
          p.tally.calls++;
        }
      } else {
        if (p.abilityHold > 0 && p.abilityHold < 1.2 && p.abilityCd <= 0) {
          p.abilityCd = 3;
          // The route: a tap marks the site you face (or the one nearest the ping) for the scientist.
          const site = routeSite(S, V, p);
          const at = site || { x: p.x + Math.cos(p.heading) * 18, z: p.z + Math.sin(p.heading) * 18 };
          const ping = { id: 'pg' + S.nextId++, x: at.x, z: at.z, by: p.id, tLeft: 8 };
          S.pings.push(ping);
          if (site) {
            S.route = { siteId: site.id, by: p.id, t: S.t };
            p.tally.routes++;
          }
          emit(S, 'ping', ping.x, ping.z, { id: ping.id, by: p.id, site: site ? site.id : null });
        }
        p.abilityHold = 0;
      }
      return;
    }
    if (!abilityEdge || p.abilityCd > 0) return;
    if (p.role === 'engineer') {
      // Patch the most worn suit within reach, your own included.
      let best = null;
      for (const q of V.players) {
        if (q.aboard || q.returning || dist(p, q) > 4) continue;
        if (!best || q.hp < best.hp) best = q;
      }
      if (best && best.hp < best.maxHp - 5) {
        best.hp = Math.min(best.maxHp, best.hp + 35);
        p.abilityCd = 16;
        p.tally.patches++;
        emit(S, 'suitPatched', best.x, best.z, { id: best.id, by: p.id });
      }
    } else if (p.role === 'scientist') {
      p.overclockT = 8;
      p.abilityCd = 18;
      p.tally.overclocks++;
      emit(S, 'overclock', p.x, p.z, { by: p.id });
    } else if (p.role === 'comms') {
      if (dist(p, V.dish) < TUNE.dishHoldR && S.uplink.open >= 0) {
        S.uplink.boostT = 8;
        p.abilityCd = 20;
        p.tally.boosts++;
        emit(S, 'uplinkBoost', V.dish.x, V.dish.z, { by: p.id });
      } else if (V.dish.planted && V.dish.align < 0.99 && dist(p, V.dish) < 6) {
        V.dish.align = 1;
        p.abilityCd = 12;
        p.tally.aligns++;
      }
    }
  }

  // The unscanned site a planner is facing (within 20 degrees), or the one nearest the ping.
  function routeSite(S, V, p) {
    let best = null;
    let bestA = 0.35;
    const px = p.x + Math.cos(p.heading) * 18;
    const pz = p.z + Math.sin(p.heading) * 18;
    let near = null;
    let nd = 22;
    for (const s of V.sites) {
      if (s.done || !s.fits) continue;
      const d = dist(p, s);
      if (d < 3) continue;
      let a = Math.abs(Math.atan2(s.z - p.z, s.x - p.x) - p.heading);
      if (a > Math.PI) a = Math.PI * 2 - a;
      if (a < bestA) {
        bestA = a;
        best = s;
      }
      const dp = len(s.x - px, s.z - pz);
      if (dp < nd) {
        nd = dp;
        near = s;
      }
    }
    return best || near;
  }

  function callExtraction(S, V, by) {
    if (S.extraction.called || S.stage !== 'play') return;
    S.extraction.called = true;
    S.extraction.timer = TUNE.extractionS;
    S.extraction.by = by;
    S.stage = 'extraction';
    emit(S, 'extractionCalled', V.lander.x, V.lander.z, { by });
  }

  // ---------------------------------------------------------------- bots
  function blankInput() {
    return { moveX: 0, moveY: 0, aimX: 0, aimY: 0, use: false, ability: false };
  }

  function assignTask(S, V, p) {
    const b = p.bot;
    const left = S.T - S.t;
    const lander = V.lander;
    const humanLead = V.players.find((q) => !q.isBot && !q.aboard && !q.returning && q.restT <= 0);

    // Boarding beats everything once the clock is short.
    if (S.stage === 'extraction' || left < TUNE.autoExtractLeftS + 6) {
      b.task = { type: 'board', x: lander.x, z: lander.z };
      return;
    }

    // Shelter from a radiation spike (and from the haze when the suit is worn).
    const rad = S.hazards.find((h) => (h.kind === 'radiation' && (h.state === 'active' || h.tLeft < 9)) || (h.kind === 'acid' && h.state === 'active' && p.hp < 60));
    if (rad) {
      const spot = shelterSpot(S, V, p);
      if (spot) {
        b.task = { type: 'shelter', x: spot.x, z: spot.z };
        return;
      }
    }

    if (p.carrying) {
      b.task = { type: 'deliver', x: lander.x, z: lander.z };
      return;
    }

    // The engineer keeps the lander running.
    if (S.faults.length && owns(S, V, p, 'repair')) {
      const f = S.faults[0];
      b.task = { type: 'repair', target: f.id, x: f.x, z: f.z };
      return;
    }

    const dishPlanted = V.dish.planted;
    const openSoon = S.uplink.open >= 0 || (S.uplink.nextIn >= 0 && S.uplink.nextIn < 9);
    const hasData = S.recorder.usedGbit > 2;

    // Plant the dish in good time. The comms bot is on point; anyone covers if comms is busy.
    if (!dishPlanted && (openSoon || S.t > 28) && S.uplink.windows.length) {
      const comms = V.players.find((q) => q.role === 'comms' && q.isBot && !q.aboard && !q.returning);
      if (S.jobs ? owns(S, V, p, 'plant') : p.role === 'comms' || !comms) {
        b.task = { type: 'plant', x: V.dish.x, z: V.dish.z };
        return;
      }
    }

    if (S.uplink.open >= 0 && dishPlanted && (hasData || S.uplink.windows[S.uplink.open].sentGbit > 0)) {
      // Comms always holds the ring; one more helper is plenty.
      const holding = V.players.filter((q) => q !== p && q.bot && q.bot.task && q.bot.task.type === 'hold').length;
      if (S.jobs ? owns(S, V, p, 'uplink') : p.role === 'comms' || holding < 1 || (V.dish.align < 0.6 && holding < 2)) {
        b.task = { type: 'hold', x: V.dish.x, z: V.dish.z };
        return;
      }
    }

    // Top up before the walk out, with a margin for the walk back.
    const homeD = dist(p, lander);
    const needO2 = 14 + homeD * 0.11;
    if (p.o2 < needO2 && S.base.o2Stock > 0) {
      b.task = { type: 'resupply', x: lander.x, z: lander.z };
      return;
    }
    const canCharge = S.base.battery > S.base.batteryMax * 0.05 || S.base.solarW > TUNE.loadChargerW + TUNE.loadIdleW;
    if (p.energy < 10 + homeD * 0.07 && canCharge) {
      b.task = { type: 'resupply', x: lander.x, z: lander.z };
      return;
    }
    if (p.hp < 30) {
      b.task = { type: 'resupply', x: lander.x, z: lander.z };
      return;
    }

    // Stage near the dish just before a window with data to send.
    if (S.uplink.nextIn >= 0 && S.uplink.nextIn < 5 && hasData && S.uplink.planted && (S.jobs ? owns(S, V, p, 'uplink') : p.role === 'comms')) {
      b.task = { type: 'hold', x: V.dish.x, z: V.dish.z };
      return;
    }

    // Carry samples home.
    const loose = V.samples.filter((s) => !s.gone && !s.heldBy);
    const s = loose.length ? nearestLooseSample(S, V, p, 90, p.id) : null;
    if (s && (p.role !== 'scientist' || !owns(S, V, p, 'scan') || !scanTarget(S, V, p))) {
      b.task = { type: 'fetch', target: s.id };
      return;
    }

    // Science: the scientist (or, without the jobs rule, everyone who can) takes the best site.
    const site = owns(S, V, p, 'scan') ? scanTarget(S, V, p) : null;
    if (site) {
      b.task = { type: 'scan', target: site.id, x: site.x, z: site.z };
      return;
    }

    // Nothing to do: stay with the human, or wait by the dish.
    if (humanLead && humanLead !== p) {
      b.task = { type: 'escort', target: humanLead.id };
      return;
    }
    b.task = { type: 'guard', x: V.dish.x, z: V.dish.z, R: 8 };
  }

  function nearestLooseSample(S, V, from, maxD, claimer) {
    let best = null;
    let bd = maxD;
    for (const s of V.samples) {
      if (s.gone || s.heldBy) continue;
      if (claimer && V.players.some((q) => q.id !== claimer && q.bot && q.bot.task && q.bot.task.type === 'fetch' && q.bot.task.target === s.id)) continue;
      const d = dist(from, s);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  function shelterSpot(S, V, p) {
    let best = V.lander;
    let bd = dist(p, V.lander);
    for (const c of S.map.caves || []) {
      const d = dist(p, c);
      if (d < bd - 6) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  function scanTarget(S, V, p) {
    let best = null;
    let bestScore = -Infinity;
    const R = S.recorder;
    for (const s of V.sites) {
      if (s.done || !s.fits) continue;
      if (R.capacityGbit > 0 && R.usedGbit >= R.capacityGbit * 0.97) {
        // Recorder nearly full: only a clearly better site is worth overwriting data for.
        const lowest = R.sets.reduce((m, x) => Math.min(m, x.value / Math.max(x.gbit, 0.01)), Infinity);
        if (s.value / s.gbit <= lowest * 1.1) continue;
      }
      let score = -dist(p, s) * 0.08;
      if (s.objective) score += 3;
      if (S.route && S.route.siteId === s.id) score += 30; // the planner marked it: it comes first
      score += s.scanned * 4;
      const others = V.players.filter((q) => q !== p && q.bot && q.bot.task && q.bot.task.target === s.id).length;
      if (p.role !== 'scientist') score -= 2.5 * others;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }

  function steerTo(S, p, tx, tz, out) {
    const d = len(tx - p.x, tz - p.z);
    if (d < 0.2) return d;
    if (d < 6 || (d < 18 && hasLOS(S.map, p.x, p.z, tx, tz))) {
      out.moveX = (tx - p.x) / d;
      out.moveY = (tz - p.z) / d;
      return d;
    }
    const field = fieldTo(S.map, tx, tz);
    const f = flow(S.map, field, p.x, p.z);
    if (f.ok) {
      out.moveX = f.x;
      out.moveY = f.z;
    } else {
      out.moveX = (tx - p.x) / d;
      out.moveY = (tz - p.z) / d;
    }
    return d;
  }

  function botMove(S, V, p, out) {
    const b = p.bot;
    const t = b.task;
    if (!t) return;
    const pulse = S.tick % 6 < 3;
    switch (t.type) {
      case 'board':
      case 'resupply':
      case 'deliver': {
        const d = dist(p, V.lander);
        if (d > TUNE.landerRadius - 3) steerTo(S, p, t.x, t.z, out);
        else if (t.type === 'resupply' && p.o2 > 95 && p.energy > 90 && p.hp > 90) b.think = 0;
        break;
      }
      case 'shelter': {
        if (!sheltered(S, V, p) || dist(p, t) > 5) steerTo(S, p, t.x, t.z, out);
        break;
      }
      case 'plant': {
        const d = steerTo(S, p, t.x, t.z, out);
        if (d < 3.5) {
          out.moveX = 0;
          out.moveY = 0;
          out.use = true;
        }
        break;
      }
      case 'hold': {
        const d = dist(p, V.dish);
        if (d > 4 + p.slot * 1.5) steerTo(S, p, t.x, t.z, out);
        // Whoever is close keeps the dish aligned.
        if (d < 4.2 && V.dish.align < 0.95) out.use = true;
        if (p.role === 'comms' && d < 8 && p.abilityCd <= 0 && S.uplink.open >= 0 && S.recorder.usedGbit > 4) out.ability = true;
        break;
      }
      case 'guard': {
        const d = len(t.x - p.x, t.z - p.z);
        if (d > (t.R || 8)) steerTo(S, p, t.x, t.z, out);
        break;
      }
      case 'fetch': {
        const s = byId(S, t.target);
        if (!s || s.gone || s.heldBy) {
          b.task = null;
          break;
        }
        const d = steerTo(S, p, s.x, s.z, out);
        if (d < 2.4) {
          out.use = pulse;
          out.moveX *= 0.2;
          out.moveY *= 0.2;
        }
        break;
      }
      case 'scan': {
        const s = byId(S, t.target);
        if (!s || s.done) {
          b.task = null;
          break;
        }
        const d = steerTo(S, p, s.x, s.z, out);
        if (d < s.r - 1.2) {
          out.moveX = 0;
          out.moveY = 0;
          out.use = true;
          if (p.role === 'scientist' && p.abilityCd <= 0 && s.scanned < 0.5) out.ability = true;
        }
        break;
      }
      case 'repair': {
        if (!S.faults.some((f) => f.id === t.target)) {
          b.task = null;
          break;
        }
        const d = steerTo(S, p, t.x, t.z, out);
        if (d < TUNE.repairR - 1) {
          out.moveX = 0;
          out.moveY = 0;
          out.use = true;
        }
        break;
      }
      case 'escort': {
        const q = byId(S, t.target);
        if (!q || q.aboard) {
          b.task = null;
          break;
        }
        const d = dist(p, q);
        if (d > 6 + p.slot) steerTo(S, p, q.x, q.z, out);
        break;
      }
      default:
        break;
    }
  }

  function botInput(S, V, p) {
    const out = blankInput();
    const b = p.bot;
    b.think -= TICK;
    if (b.think <= 0) {
      b.think = 0.3 + rnd(S) * 0.2;
      assignTask(S, V, p);
    }
    botMove(S, V, p, out);
    // The engineer patches worn suits nearby.
    if (p.role === 'engineer' && p.abilityCd <= 0 && V.players.some((q) => !q.aboard && !q.returning && q.hp < 60 && dist(p, q) < 4)) out.ability = true;
    // The planner calls everyone home once the work is done.
    // With people in the crew it waits for them: they may still be exploring.
    const allBots = V.players.every((q) => q.isBot);
    if (p.role === 'planner' && S.stage === 'play' && S.t > 60 && (allBots || S.T - S.t < 70)) {
      if (workDone(S, V)) out.ability = true;
    }
    // Step out from under a marked rockfall.
    for (const h of S.hazards) {
      if (h.kind !== 'rockfall') continue;
      const d = len(p.x - h.x, p.z - h.z);
      if (d >= h.r + 0.6) continue;
      if (rnd(S) > 0.97 * S.diff.bot) break; // bots are not perfect either
      out.moveX = (p.x - h.x) / (d || 1);
      out.moveY = (p.z - h.z) / (d || 1);
      out.use = false;
      break;
    }
    // Unstick: if not making progress on a move order, wiggle out.
    const moved = len(p.x - b.lastX, p.z - b.lastZ);
    if (len(out.moveX, out.moveY) > 0.3 && moved < 0.05) b.stuckT += TICK;
    else b.stuckT = Math.max(0, b.stuckT - TICK * 2);
    b.lastX = p.x;
    b.lastZ = p.z;
    if (b.stuckT > 0.7) {
      const a = rnd(S) * 6.28;
      out.moveX = Math.cos(a);
      out.moveY = Math.sin(a);
      b.stuckT = 0.2;
    }
    return out;
  }

  // ---------------------------------------------------------------- objectives (progress tracker)
  function objectivesOf(S, V) {
    const ld = S.loadout;
    const kind = ld.objective;
    const objSites = V.sites.filter((s) => s.objective);
    const need = Math.max(1, objSites.length);
    const scanned = objSites.reduce((n, s) => n + (s.done ? 1 : s.scanned * 0.9), 0);
    const delivered = S.ascent.rack.some((r) => r.siteKind === kind);
    const objValueAll = objSites.reduce((n, s) => n + s.value * s.valueBonus, 0);
    const sentObj = objSites.reduce((n, s) => n + (s.valueSent || 0), 0);
    const sendTarget = Math.max(25, objValueAll * 0.5);
    const home = S.over && S.outcome === 'extracted';
    // A full success also needs a real share of everything on the map: data sent plus samples aboard.
    const all = V.sites.reduce((n, s) => n + s.value * s.valueBonus + s.value * 0.9, 0);
    const lost = S.over && S.outcome !== 'extracted';
    const have = S.stats.valueSent + (lost ? 0 : S.ascent.rack.reduce((n, r) => n + r.value, 0));
    const sciFrac = all > 0 ? clamp(have / (all * TUNE.winScienceFrac), 0, 1) : 0;
    const list = [
      { id: 'scan', kind, n: Math.min(need, Math.floor(scanned + 1e-6)), of: need, frac: clamp(scanned / need, 0, 1), done: scanned >= need - 1e-6 },
      { id: 'sample', kind, frac: delivered ? 1 : 0, done: !!delivered },
      { id: 'dish', frac: V.dish.planted ? 1 : clamp(V.dish.plantT || 0, 0, 0.99), done: !!V.dish.planted },
      { id: 'send', kind, frac: clamp(sentObj / sendTarget, 0, 1), done: sentObj >= sendTarget - 1e-6 },
      { id: 'science', frac: sciFrac, done: sciFrac >= 1 - 1e-6, pct: Math.round(TUNE.winScienceFrac * 100) },
    ];
    // The signature objective of this world (item 19).
    if (SIGNATURE[S.world] === 'shadow') {
      const sh = V.sites.find((s) => s.shadow);
      if (sh) list.push({ id: 'shadow', kind, frac: sh.done ? 1 : clamp(sh.scanned || 0, 0, 0.99), done: !!sh.done });
    } else if (SIGNATURE[S.world] === 'core') {
      const core = S.ascent.rack.some((r) => r.core && r.siteKind === kind) && !lost;
      const loose = V.samples.some((x) => x.core && x.siteKind === kind && !x.gone);
      list.push({ id: 'core', kind, frac: core ? 1 : loose ? 0.5 : 0, done: core });
    }
    // The engineer's: every lander fault fixed (none planned, or the jobs rule off: nothing to do).
    if (S.jobs && S.faultTotal > 0) {
      // Once the mission is over, only the faults that really happened count.
      const of = S.over ? S.stats.faultsSeen || 0 : S.faultTotal;
      const fixed = (S.stats.faultsFixed || 0) + (S.faults ? S.faults.reduce((n, f) => n + f.fixT * 0.9, 0) : 0);
      const n = S.stats.faultsFixed || 0;
      list.push({ id: 'systems', n, of, frac: of > 0 ? clamp(fixed / of, 0, 1) : 1, done: n >= of });
    }
    list.push({ id: 'home', frac: home ? 1 : 0, done: home });
    const wsum = list.reduce((n, o) => n + OBJECTIVE_WEIGHT[o.id], 0);
    for (const o of list) {
      o.weight = OBJECTIVE_WEIGHT[o.id] / wsum;
      o.job = OBJECTIVE_JOB[o.id] || null;
      o.text = objectiveText(o);
      o.key = 'team.surface.goal.' + o.id;
    }
    return list;
  }

  function objectiveText(o) {
    const k = label('kind', o.kind || 'ice', o.kind || 'ice');
    if (o.id === 'scan') return tr('team.surface.goal.scan', STRINGS['team.surface.goal.scan'], { kind: k, n: o.n, of: o.of });
    if (o.id === 'sample') return tr('team.surface.goal.sample', STRINGS['team.surface.goal.sample'], { kind: k });
    if (o.id === 'dish') return tr('team.surface.goal.dish', STRINGS['team.surface.goal.dish']);
    if (o.id === 'send') return tr('team.surface.goal.send', STRINGS['team.surface.goal.send'], { kind: k });
    if (o.id === 'science') return tr('team.surface.goal.science', STRINGS['team.surface.goal.science'], { pct: o.pct });
    if (o.id === 'systems') return tr('team.surface.goal.systems', STRINGS['team.surface.goal.systems'], { n: o.n, of: o.of });
    if (o.id === 'shadow') return tr('team.surface.goal.shadow', STRINGS['team.surface.goal.shadow'], { kind: k });
    if (o.id === 'core') return tr('team.surface.goal.core', STRINGS['team.surface.goal.core'], { kind: k });
    return tr('team.surface.goal.home', STRINGS['team.surface.goal.home']);
  }

  const progressOf = (list) => clamp(list.reduce((n, o) => n + o.weight * o.frac, 0), 0, 1);

  function updateObjectives(S, V, force) {
    if (!force && S.tick % 10 !== 0) return;
    S.objectives = objectivesOf(S, V);
    S.progress = progressOf(S.objectives);
  }

  // ---------------------------------------------------------------- mission end
  // What goes overboard so the rack fits the lift. Without `keep`: the launch computer's
  // plan, worst value per kilogram first, keeping the last objective sample if it fits at
  // all. With `keep` ({ kind: n }): the n best (value per kg) of each kind stay, the rest go.
  // Pure; the HUD uses it to preselect "keep the best". Returns { drop: [ids], keep, keptKg, overKg }.
  function ascentPlan(rack, liftKg, objective, keep) {
    const list = (rack || []).slice();
    const ratio = (r) => (r.value || 0) / Math.max(0.001, r.massKg || 0);
    const drop = [];
    if (keep) {
      const byKind = {};
      for (const r of list) (byKind[r.siteKind] = byKind[r.siteKind] || []).push(r);
      for (const k in byKind) {
        byKind[k].sort((a, b) => ratio(b) - ratio(a));
        const n = Math.max(0, Math.min(byKind[k].length, keep[k] === undefined ? byKind[k].length : keep[k] | 0));
        byKind[k].slice(n).forEach((r) => drop.push(r.id));
      }
    } else {
      let rest = list;
      let kg = rest.reduce((n, r) => n + r.massKg, 0);
      while (kg > liftKg + 1e-6 && rest.length) {
        rest.sort((a, b) => ratio(a) - ratio(b));
        const objLeft = rest.filter((r) => r.siteKind === objective);
        let idx = 0;
        if (objLeft.length === 1 && rest.length > 1 && objLeft[0].massKg <= liftKg) idx = rest[0].siteKind === objective ? 1 : 0;
        const r = rest[idx];
        rest = rest.filter((x) => x !== r);
        kg -= r.massKg;
        drop.push(r.id);
      }
    }
    const kept = list.filter((r) => !drop.includes(r.id));
    const keptKg = kept.reduce((n, r) => n + r.massKg, 0);
    const counts = {};
    for (const r of list) counts[r.siteKind] = counts[r.siteKind] || 0;
    for (const r of kept) counts[r.siteKind]++;
    return { drop, keep: counts, keptKg, overKg: Math.max(0, keptKg - liftKg) };
  }

  function launch(S, V, reason) {
    const lander = V.lander;
    const aboard = V.players.filter((p) => p.aboard || dist(p, lander) < TUNE.landerRadius + 1);
    if (!aboard.length) {
      finish(S, V, 'stranded', 0);
      return;
    }
    const A = S.ascent;
    // Anything over capacity goes overboard, worst value-per-kilogram first (ascentPlan).
    for (const id of ascentPlan(A.rack, A.liftKg, S.loadout.objective).drop) {
      const i = A.rack.findIndex((r) => r.id === id);
      if (i < 0) continue;
      const r = A.rack.splice(i, 1)[0];
      A.jettisoned.push(Object.assign({ reason: 'liftoff' }, r));
      updateAscent(S);
      emit(S, 'jettison', lander.x, lander.z, { id: r.id, massKg: r.massKg, value: r.value, forced: true });
    }
    for (const p of aboard) p.aboard = true;
    emit(S, 'liftoff', lander.x, lander.z, { aboard: aboard.length, reason });
    finish(S, V, 'extracted', aboard.length);
  }

  function finish(S, V, outcome, aboard) {
    S.over = true;
    S.stage = 'over';
    S.outcome = outcome;
    S.aboardN = aboard;
    if (S.uplink.open >= 0) {
      const w = S.uplink.windows[S.uplink.open];
      w.state = 'done';
      S.uplink.open = -1;
      S.stats.windows.push(windowFact(w));
    }
    S.stats.samplesLeft = V.samples.filter((s) => !s.gone).length;
    updateObjectives(S, V, true);
  }

  const atDoor = (V, p) => p.aboard || dist(p, V.lander) < TUNE.landerRadius + 1;

  function checkEnd(S, V) {
    if (S.over) return;
    // Everyone already aboard (out of air with the reserve empty): go home now.
    if (S.stage === 'play' && V.players.every((p) => p.aboard)) callExtraction(S, V, 'oxygen');
    if (S.stage === 'play' && S.T - S.t <= TUNE.autoExtractLeftS) callExtraction(S, V, 'clock');
    // The work is done and the people have come back to the lander: nobody should stand
    // there for minutes waiting for the clock. After 6 s at the door, the crew goes home.
    if (S.stage === 'play' && S.t > 60) {
      const people = V.players.filter((p) => !p.isBot);
      const home = people.length && people.every((p) => atDoor(V, p) && !p.returning && !p.carrying);
      const done = home && workDone(S, V);
      S.extraction.doorT = done ? (S.extraction.doorT || 0) + TICK : 0;
      if (S.extraction.doorT >= 6) callExtraction(S, V, 'crew');
    }
    if (S.stage === 'extraction') {
      S.extraction.timer = Math.max(0, S.extraction.timer - TICK);
      const everyoneThere = V.players.every((p) => atDoor(V, p) && !p.returning);
      if (everyoneThere) {
        tryLaunch(S, V, S.extraction.timer > 0 ? 'all_aboard' : 'called');
        return;
      }
      if (S.extraction.timer <= 0) {
        // The call ran out: suits steer the stragglers in while the lander waits, and the
        // waiting costs ascent margin. Wait too long and the orbiter's window is gone.
        for (const p of V.players) if (!atDoor(V, p) && !p.returning) sendHome(S, p, 'call');
        S.extraction.waiting += TICK;
        S.stats.waitS += TICK;
        const boil = Math.min(S.ascent.liftKg, TUNE.boilKgPerS * TICK);
        S.ascent.liftKg -= boil;
        S.stats.boilKg += boil;
        updateAscent(S);
        if (S.extraction.waiting >= TUNE.waitMaxS) finish(S, V, 'stranded', V.players.filter((p) => atDoor(V, p)).length);
      }
    }
  }

  // Over the lift limit with someone at the door: stop and let the crew choose
  // what stays behind. Time itself holds while they choose.
  function tryLaunch(S, V, reason) {
    const X = S.extraction;
    if (!X.decided && S.ascent.overKg > 0.5 && S.ascent.rack.length) {
      X.decided = true;
      // A person who may choose gets the full time; a crew of bots goes with its own plan quickly.
      const person = V.players.some((q) => !q.isBot && owns(S, V, q, 'choose'));
      X.decision = person ? TUNE.decisionS : TUNE.botDecideS;
      X.byPeople = person;
      X.reason = reason;
      emit(S, 'decisionOpen', V.lander.x, V.lander.z, { overKg: S.ascent.overKg });
      return;
    }
    launch(S, V, reason);
  }

  function decisionTick(S, V, inputs) {
    for (const p of V.players) {
      const inp = p.isBot ? null : inputs[p.playerId];
      if (!inp || !inp.jettison || !owns(S, V, p, 'choose')) continue;
      for (const id of Array.isArray(inp.jettison) ? inp.jettison : [inp.jettison]) if (jettison(S, V, String(id))) p.tally.dropped++;
    }
    S.extraction.decision = S.ascent.overKg > 0.5 ? S.extraction.decision - TICK : 0;
    updateObjectives(S, V);
    if (S.extraction.decision > 0) return;
    S.extraction.decision = 0;
    launch(S, V, S.extraction.reason || 'called');
  }

  function updatePhase(S) {
    let phase = 'calm';
    if (S.stage === 'extraction') phase = 'frantic';
    else if (S.uplink.open >= 0 && S.uplink.planted) phase = 'siege';
    else if (S.hazards.some((h) => h.state === 'active' || h.kind === 'radiation')) phase = 'pressure';
    if (phase !== S.phase) {
      S.phase = phase;
      emit(S, 'phase', 0, 0, { phase });
    }
    S.intensity = phase === 'frantic' ? 0.5 : phase === 'pressure' ? 0.3 : phase === 'siege' ? 0.25 : 0.1;
  }

  // ---------------------------------------------------------------- tick
  function tick(S, inputs) {
    S.tick++;
    S.t = S.tick * TICK;
    const V = buildViews(S);

    if (S.stage === 'intro') {
      updateSun(S);
      if (S.t >= TUNE.introS) S.stage = 'play';
      updateBase(S, V);
      updateUplink(S, V);
      updateObjectives(S, V);
      return;
    }

    if (S.extraction.decision > 0) {
      decisionTick(S, V, inputs);
      return;
    }

    updateSun(S);
    updateHazards(S, V);
    if (S.jobs && S.stage === 'play') updateFaults(S, V);
    else if (S.jobs) for (const f of S.faults) S.stats.faultS[f.kind] = (S.stats.faultS[f.kind] || 0) + TICK;
    for (const p of V.players) {
      const inp = p.isBot ? botInput(S, V, p) : inputs[p.playerId] || blankInput();
      control(S, V, p, inp);
    }
    for (const g of S.pings) g.tLeft -= TICK;
    if (S.pings.length && S.pings[0].tLeft <= 0) S.pings = S.pings.filter((g) => g.tLeft > 0);
    updateBase(S, V);
    updateUplink(S, V);
    updatePhase(S);
    updateObjectives(S, V);
    checkEnd(S, V);

    if (S.anyGone) {
      S.anyGone = false;
      S.entities = S.entities.filter((e) => !e.gone);
    }
  }

  function step(S, inputs, dt) {
    if (!S) return S;
    S.events = [];
    if (!S.faults) S.faults = [];
    if (!S.faultPlan) S.faultPlan = [];
    if (!S.stats.faultS) Object.assign(S.stats, { faultsSeen: 0, faultsFixed: 0, faultS: { panels: 0, charger: 0 } });
    if (S.over) return S;
    const d = typeof dt === 'number' && dt > 0 ? dt : TICK;
    S.acc += d;
    let n = Math.floor(S.acc / TICK + 1e-9);
    if (n > 12) n = 12;
    S.acc = Math.max(0, S.acc - n * TICK);
    if (S.acc < 1e-9) S.acc = 0;
    for (let i = 0; i < n && !S.over; i++) tick(S, inputs || {});
    return S;
  }

  // ---------------------------------------------------------------- reports
  // Every sentence the summary can say, for translators: key -> English with {params}.
  const STRINGS = {
    'team.surface.goal.scan': 'Scan the {kind} sites ({n} of {of})',
    'team.surface.goal.sample': 'Load {kind} samples into the lander',
    'team.surface.goal.dish': 'Plant the dish',
    'team.surface.goal.send': 'Send the {kind} data home',
    'team.surface.goal.science': 'Bring home {pct}% of the science on the map',
    'team.surface.goal.home': 'Lift off with the crew',
    'team.surface.goal.systems': 'Keep the lander running: fix the faults ({n} of {of})',
    'team.surface.goal.shadow': 'Scan the {kind} in the permanently shadowed crater',
    'team.surface.goal.core': 'Bring home a drilled {kind} core',
    'team.surface.fact.shadow_done': 'The crew scanned the ice in the permanently shadowed crater.',
    'team.surface.why.shadow_done': 'Water ice survives only where the Sun never shines; suits run very cold there.',
    'team.surface.fact.shadow_missed': 'Nobody scanned the permanently shadowed crater.',
    'team.surface.why.shadow_missed': 'It was the farthest site and the coldest place on the map: plan air and suit power for it.',
    'team.surface.fact.core_home': 'A drilled {kind} core is coming home.',
    'team.surface.why.core_home': 'A core keeps the layers in order: the best record of how the ice was laid down.',
    'team.surface.fact.core_missed': 'No drilled {kind} core came home.',
    'team.surface.why.core_nodrill': 'No drill was packed: scoops only skim the surface.',
    'team.surface.why.core_left': 'The cores were left on the ground or thrown overboard.',
    'team.surface.fact.faults_open': 'Lander faults left unfixed for {s} s ({what}).',
    'team.surface.why.faults_open': 'Dusty panels give a third of their power; a tripped charger cannot recharge suits. The engineer fixes them at the lander.',
    'team.surface.fact.faults_fixed': 'The engineer fixed all {n} lander faults.',
    'team.surface.why.faults_fixed': 'Power and suit charging stayed up.',
    'team.surface.fault.panels': 'dusty solar panels',
    'team.surface.fault.charger': 'tripped suit charger',
    'team.surface.fact.base_dark': 'The base ran short of power for {s} s (first at {at} s).',
    'team.surface.why.base_dark': '{battery} carries the night heaters and lights for about {cover} s without sun; {solar} gives {watts} W at noon on {world}.',
    'team.surface.fact.base_lit': 'The base stayed warm and lit through the night.',
    'team.surface.why.base_lit': '{battery} and {solar} covered the load.',
    'team.surface.fact.uplink_weak': 'Uplink too slow: only {sent} of {scanned} Gbit got home.',
    'team.surface.why.uplink_weak': '{radio} and {antenna} give {rate} Gbit/s in {window} s windows.',
    'team.surface.fact.uplink_rare': 'Orbit gave a window only every {every} s.',
    'team.surface.why.uplink_rare': '{label} set a long gap between passes.',
    'team.surface.fact.uplink_missed': 'Uplink windows missed because the dish was not up: {n}.',
    'team.surface.why.uplink_missed': 'Plant the dish before the window opens.',
    'team.surface.fact.data_lost_unsent': '{gbit} Gbit was still on the recorder at liftoff and never got home.',
    'team.surface.fact.data_lost_end': '{gbit} Gbit was still on the recorder when the mission ended and never got home.',
    'team.surface.why.data_lost_unsent': 'Data only counts after uplink.',
    'team.surface.fact.recorder_full': 'Recorder full: {gbit} Gbit overwritten.',
    'team.surface.why.recorder_full': '{recorder} holds {cap} Gbit.',
    'team.surface.fact.no_instrument': 'Science sites that could not be scanned: {n}. No instrument for {kinds}.',
    'team.surface.why.no_instrument': 'Only instruments you brought can scan the sites they fit.',
    'team.surface.fact.objective_missed': 'The objective ({objective}) was not met.',
    'team.surface.why.objective_missed': 'The crew never got it home.',
    'team.surface.why.objective_unreadable': 'No instrument aboard could read it.',
    'team.surface.fact.ascent_dump': 'Samples thrown overboard so the lander could lift off: {n} ({kg} kg).',
    'team.surface.why.ascent_dump': 'The ascent fuel lifts only {lift} kg of samples.',
    'team.surface.why.ascent_dump_forced': 'The ascent fuel lifts only {lift} kg of samples; the launch computer dumped the rest.',
    'team.surface.fact.ascent_ok': 'All delivered samples lifted off: {n} ({kg} of {lift} kg).',
    'team.surface.why.ascent_ok': 'The ascent fuel had the margin.',
    'team.surface.fact.samples_left': 'Samples left on the ground: {n}.',
    'team.surface.why.samples_left': 'On foot, samples weigh you down: there was no time to carry them all.',
    'team.surface.fact.o2_out': 'The lander ran out of spare oxygen at {at} s.',
    'team.surface.why.o2_out': 'Spare canisters packed: {spare}.',
    'team.surface.fact.suit_returns': 'Suits sent astronauts back to the lander {n} times ({why}).',
    'team.surface.why.suit_returns': 'Every walk home is time not spent on science.',
    'team.surface.fact.radiation': 'Radiation spikes wore down suits caught outside: {s} s in the open.',
    'team.surface.why.radiation': 'The lander and caves are shelter; warnings come {warn} s ahead.',
    'team.surface.fact.waited': 'The lander waited {s} s for the crew: {kg} kg of ascent margin boiled off.',
    'team.surface.why.waited': 'Cryogenic propellant boils away while the engine waits.',
    'team.surface.fact.end_stranded': 'The ascent window closed before the crew was aboard.',
    'team.surface.why.end_stranded': 'Mission lifetime was {lifetime} s; the call home came {call} s before the end.',
    'team.surface.why.o2': 'oxygen',
    'team.surface.why.battery': 'suit battery',
    'team.surface.why.suit': 'suit wear',
    'team.surface.kind.ice': 'ice',
    'team.surface.kind.mineral': 'mineral',
    'team.surface.kind.atmosphere': 'atmosphere',
    'team.surface.kind.thermal': 'thermal',
    'team.surface.kind.organic': 'organic',
    'team.surface.world.moon': 'the Moon',
    'team.surface.world.mars': 'Mars',
    'team.surface.world.venus': 'Venus',
    'team.surface.world.europa': 'Europa',
  };

  function fillText(text, params) {
    return String(text).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] !== undefined ? params[k] : m));
  }
  const tr = (key, english, params) => (SMD.t ? SMD.t(key, english, params) : fillText(english, params));
  const label = (group, id, english) => tr('team.surface.' + group + '.' + id, english);

  // The one line a HUD shows: what to do next, where. With the jobs rule, only your job's
  // tasks (plus what everyone does: carry samples, top up, shelter, go home).
  function nextGoal(S, p) {
    const V = buildViews(S);
    const L = V.lander;
    if (S.over) return { id: 'over', target: L };
    if (S.stage === 'extraction') return { id: 'return', target: L };
    if (p && p.returning) return { id: 'returning', target: L };
    if (p && p.restT > 0) return { id: 'rest', target: L };
    const shelter = S.hazards.find((h) => h.kind === 'radiation');
    if (shelter && p && !sheltered(S, V, p)) return { id: 'shelter', target: shelterSpot(S, V, p) };
    if (p && p.carrying) return { id: 'deliver', target: L };
    if (p && (p.o2 < 22 || p.energy < 15)) return { id: 'resupply', target: L };
    if (S.jobs && p && p.role) return jobGoal(S, V, p);
    if (S.uplink.open >= 0 && !V.dish.planted) return { id: 'plant', target: V.dish };
    if (S.uplink.open >= 0 && S.recorder.usedGbit > 1) return { id: 'hold', target: V.dish };
    if (!V.dish.planted && S.uplink.windows.length && (S.uplink.nextIn < 25 || S.t > 60)) return { id: 'plant', target: V.dish };
    const site = bestSite(S, V, p || L);
    const sample = nearestSample(V, p || L);
    if (sample && (!site || dist(p || L, sample) < dist(p || L, site) - (site.objective ? 25 : 0))) return { id: 'sample', target: sample };
    if (site) return { id: 'scan', target: site };
    if (S.recorder.usedGbit > 1 && S.uplink.windows.some((w) => w.state === 'upcoming')) return { id: 'wait', target: V.dish };
    return { id: 'home', target: L };
  }

  function bestSite(S, V, from) {
    let site = null;
    let bd = Infinity;
    for (const s of V.sites) {
      if (s.done || !s.fits) continue;
      const d = dist(from, s) - (s.objective ? 25 : 0) - (S.route && S.route.siteId === s.id ? 1000 : 0);
      if (d < bd) {
        bd = d;
        site = s;
      }
    }
    return site;
  }

  function nearestSample(V, from) {
    let sample = null;
    let sd = Infinity;
    for (const s of V.samples) {
      if (s.heldBy || s.gone) continue;
      const d = dist(from, s);
      if (d < sd) {
        sd = d;
        sample = s;
      }
    }
    return sample;
  }

  // Everything is done that the clock still allows: time to call the crew home.
  function workDone(S, V) {
    const unfinished = V.sites.some((s) => s.fits && !s.done);
    const loose = V.samples.some((s) => !s.gone);
    const unsent = S.recorder.usedGbit > 3 && S.uplink.windows.some((w) => w.state !== 'done');
    return !unfinished && !loose && !unsent && !(S.faults && S.faults.length);
  }

  function jobGoal(S, V, p) {
    const L = V.lander;
    const U = S.uplink;
    const dish = V.dish;
    const sample = nearestSample(V, p);
    const help = sample && dist(p, sample) < 60 ? { id: 'sample', target: sample } : null;
    switch (p.role) {
      case 'comms':
        if (!dish.planted) return { id: 'plant', target: dish };
        if (dish.align < 0.9) return { id: 'align', target: dish };
        if (U.open >= 0) return { id: 'hold', target: dish };
        if (U.nextIn >= 0 && U.nextIn < 12 && S.recorder.usedGbit > 1) return { id: 'wait', target: dish };
        return help || { id: U.windows.some((w) => w.state === 'upcoming') ? 'wait' : 'home', target: U.windows.some((w) => w.state === 'upcoming') ? dish : L };
      case 'scientist': {
        const site = bestSite(S, V, p);
        if (site) return { id: 'scan', target: site };
        return help || { id: 'home', target: L };
      }
      case 'engineer': {
        if (S.faults.length) {
          let f = S.faults[0];
          for (const x of S.faults) if (dist(p, x) < dist(p, f)) f = x;
          return { id: 'repair', target: f };
        }
        const worn = V.players.filter((q) => q !== p && !q.aboard && !q.returning && q.restT <= 0 && q.hp < 60 && dist(p, q) < 45).sort((a, b) => a.hp - b.hp)[0];
        if (worn) return { id: 'patch', target: worn };
        return help || { id: 'systems', target: L };
      }
      case 'planner': {
        if (S.stage === 'play' && S.t > 30 && (workDone(S, V) || S.T - S.t < 70)) return { id: 'call', target: L };
        const routed = S.route ? V.sites.find((s) => s.id === S.route.siteId && !s.done) : null;
        if (!routed) {
          const site = bestSite(S, V, V.players.find((q) => q.role === 'scientist' && !q.aboard) || p);
          if (site) return { id: 'route', target: site };
        }
        return help || { id: 'watch', target: L };
      }
      default:
        return { id: 'home', target: L };
    }
  }

  function statusFor(S, playerId) {
    const p = S.entities.find((e) => e.kind === 'astronaut' && e.playerId === String(playerId));
    if (!p) return null;
    const goal = nextGoal(S, p);
    return {
      hp: Math.round(p.hp), suit: Math.round(p.hp), o2: Math.round(p.o2), energy: Math.round(p.energy), weapon: null, role: p.role,
      downed: false, dead: false, carrying: !!p.carrying, aboard: p.aboard, returning: p.returning || null, resting: p.restT > 0,
      prompt: S.prompts[p.playerId] || null,
      stage: S.stage, phase: S.phase, t: Math.round(S.t), left: Math.round(S.T - S.t),
      windowIn: S.uplink.nextIn >= 0 ? Math.round(S.uplink.nextIn) : -1, windowOpen: S.uplink.open >= 0,
      recorderFrac: S.recorder.capacityGbit ? S.recorder.usedGbit / S.recorder.capacityGbit : 0,
      extractionIn: S.extraction.called ? Math.round(S.extraction.timer) : -1,
      overKg: Math.round(S.ascent.overKg),
      progress: Math.round((S.progress || 0) * 100), goal: goal.id,
      goalDistM: goal.target ? Math.round(dist(p, goal.target)) : 0,
      // The sample rack, only while it can still change: phones choose what stays.
      rack: S.stage === 'extraction' && owns(S, buildViews(S), p, 'choose') ? { liftKg: Math.round(S.ascent.liftKg), loadedKg: Math.round(S.ascent.loadedKg), objective: S.loadout.objective || null, items: S.ascent.rack.map((r) => ({ id: r.id, kind: r.siteKind, kg: Math.round(r.massKg), value: Math.round(r.value), core: !!r.core })), dropped: S.ascent.jettisoned.length } : null,
      decision: S.extraction.decision > 0 ? Math.ceil(S.extraction.decision) : 0,
      job: p.role, crewId: p.crewId || null, name: p.name,
    };
  }

  function summary(S) {
    const st = S.stats;
    const ld = S.loadout;
    const V = buildViews(S);
    const players = S.entities.filter((e) => e.kind === 'astronaut');
    const sites = S.entities.filter((e) => e.kind === 'site');
    const pn = (k, d) => ld.parts[k] || d;
    const A = S.ascent;
    const R = S.recorder;
    const out = S.outcome;
    const extracted = out === 'extracted';
    // Only a crew that lifted off is home: a stranded crew brings nobody back, however many
    // of them sat in the cabin when the ascent window closed (docs/TEAM-V3.md item 12).
    const aboard = extracted ? players.filter((p) => p.aboard).length : 0;
    const lost = extracted ? players.length - aboard : S.over ? players.length : 0;
    const returned = extracted ? A.rack : [];
    const valueReturned = returned.reduce((s, r) => s + r.value, 0);
    const massReturned = returned.reduce((s, r) => s + r.massKg, 0);
    const valueDropped = A.jettisoned.reduce((s, r) => s + r.value, 0);
    const scienceValue = st.valueSent + valueReturned;
    const unsentValue = R.sets.reduce((s, x) => s + x.value, 0);
    const unsentGbit = R.usedGbit;
    const objectiveSites = sites.filter((s) => s.objective);
    const objectiveScanned = objectiveSites.filter((s) => s.done).length;
    const objectiveSent = objectiveSites.reduce((s, x) => s + (x.valueSent || 0), 0);
    const objectiveBack = returned.filter((r) => r.siteKind === ld.objective).length;
    const objectiveMet = objectiveSent > 25 || objectiveBack > 0;
    const blockedKinds = {};
    for (const s of sites) if (!s.fits) blockedKinds[s.siteKind] = (blockedKinds[s.siteKind] || 0) + 1;
    const sitesDone = sites.filter((s) => s.done).length;
    const objectives = S.over ? objectivesOf(S, V) : S.objectives && S.objectives.length ? S.objectives : objectivesOf(S, V);
    const progress = progressOf(objectives);

    const windows = S.uplink.windows.map((w) => ({
      i: w.i, start: Math.round(w.start), dur: w.dur, rateGbitS: w.rateGbitS, sentGbit: Math.round(w.sentGbit * 10) / 10, planted: w.planted,
      heldS: Math.round(w.heldS), unheldS: Math.round(w.unheldS), availableGbit: Math.round(w.availableGbit), dishDown: false, state: w.state,
    }));

    const facts = [];
    const worldName = label('world', S.world, WORLDS[S.world].name);
    // text and why are in the current language when a dictionary has the key, otherwise English.
    // key, whyKey and params let a screen re-render a fact in another language.
    const fact = (id, kind, part, value, params, ids) => {
      const textId = (ids && ids.text) || id;
      const whyId = (ids && ids.why) || id;
      const key = 'team.surface.fact.' + textId;
      const whyKey = 'team.surface.why.' + whyId;
      facts.push({ id, kind, part, value, key, whyKey, params, text: tr(key, STRINGS[key], params), why: tr(whyKey, STRINGS[whyKey], params) });
    };
    const R0 = Math.round;

    // Why the mission ended the way it did comes first.
    if (out === 'stranded') fact('end_stranded', 'bad', 'time', 1, { lifetime: R0(S.T), call: TUNE.autoExtractLeftS });

    // Instruments and the objective
    const blockedList = Object.keys(blockedKinds);
    if (!objectiveMet && S.over) fact('objective_missed', 'bad', 'instruments', 1, { objective: label('kind', ld.objective, ld.objective) }, { why: objectiveSites.some((x) => x.fits) ? 'objective_missed' : 'objective_unreadable' });
    if (blockedList.length) {
      const n = blockedList.reduce((sum, k) => sum + blockedKinds[k], 0);
      fact('no_instrument', 'bad', 'instruments', n, { n, kinds: blockedList.map((k) => label('kind', k, k)).join(', ') });
    }

    // Uplink
    let missedWindows = 0;
    let weakWindows = 0;
    for (const w of S.uplink.windows) {
      if (w.state !== 'done') continue;
      if (!w.planted) missedWindows++;
      const could = w.dur * w.rateGbitS;
      if (w.planted && w.availableGbit > could * 0.95 && w.sentGbit < could * 0.9) weakWindows++;
    }
    const weak = S.uplink.windows.length && st.gbitSent < st.gbitScanned * 0.7 && ld.uplink.rateGbitS < 3;
    if (weak || weakWindows) fact('uplink_weak', 'bad', 'radio', st.gbitScanned - st.gbitSent, { sent: R0(st.gbitSent), scanned: R0(st.gbitScanned), radio: pn('radio', 'The radio'), antenna: pn('antenna', 'the antenna'), rate: ld.uplink.rateGbitS.toFixed(1), window: R0(ld.uplink.windowS) });
    if (ld.uplink.everyS > 85) fact('uplink_rare', 'bad', 'orbit', ld.uplink.everyS, { every: R0(ld.uplink.everyS), label: ld.uplink.label });
    if (missedWindows) fact('uplink_missed', 'bad', 'dish', missedWindows, { n: missedWindows });
    if (unsentGbit > 1 && S.over) fact('data_lost_unsent', 'bad', 'radio', unsentGbit, { gbit: R0(unsentGbit) }, { text: extracted ? 'data_lost_unsent' : 'data_lost_end', why: 'data_lost_unsent' });

    // Recorder
    if (st.gbitOverwritten > 1 || st.recorderFullS > 4) fact('recorder_full', 'bad', 'recorder', st.gbitOverwritten, { gbit: R0(st.gbitOverwritten), recorder: pn('recorder', 'The recorder'), cap: R0(ld.recorderGbit) });

    // Ascent
    if (A.jettisoned.length) {
      const kg = A.jettisoned.reduce((sum, r) => sum + r.massKg, 0);
      const forced = A.jettisoned.some((r) => r.reason === 'liftoff');
      fact('ascent_dump', 'bad', 'fuel', valueDropped, { n: A.jettisoned.length, kg: R0(kg), lift: R0(ld.ascent.liftKg) }, { why: forced ? 'ascent_dump_forced' : 'ascent_dump' });
    } else if (returned.length && extracted) {
      fact('ascent_ok', 'good', 'fuel', 0, { n: returned.length, kg: R0(massReturned), lift: R0(ld.ascent.liftKg) });
    }
    if (st.waitS > 1) fact('waited', 'bad', 'fuel', st.boilKg, { s: R0(st.waitS), kg: R0(st.boilKg) });
    if (st.samplesLeft > 0 && S.over) fact('samples_left', 'bad', 'time', st.samplesLeft, { n: st.samplesLeft });

    // Power
    if (st.darkS > 3) {
      const coverS = ld.power.batteryWh / (TUNE.loadIdleW + TUNE.loadHeatW + TUNE.loadLightsW) / TUNE.hoursPerS;
      fact('base_dark', 'bad', 'battery', st.darkS, { s: R0(st.darkS), at: R0(st.firstDarkT), battery: pn('battery', 'The battery'), cover: R0(coverS), solar: pn('solar', 'the solar array'), watts: R0((ld.power.solarW * WORLDS[S.world].flux) / 1361), world: worldName });
    } else if (st.nightEndured > 0) {
      fact('base_lit', 'good', 'battery', 0, { battery: pn('battery', 'The battery'), solar: pn('solar', 'the solar array') });
    }

    // Crew wellbeing
    if (st.o2StockOut >= 0) fact('o2_out', 'bad', 'spareO2', 1, { at: R0(st.o2StockOut), spare: ld.spareO2 });
    if (st.returns > 0) {
      const by = st.returnsBy;
      const why = [by.oxygen ? label('why', 'o2', 'oxygen') : null, by.battery ? label('why', 'battery', 'suit battery') : null, by.suit ? label('why', 'suit', 'suit wear') : null].filter(Boolean).join(', ');
      const part = by.oxygen >= by.battery && by.oxygen >= by.suit ? 'spareO2' : by.battery >= by.suit ? 'battery' : 'time';
      fact('suit_returns', 'bad', part, st.returns, { n: st.returns, why });
    }
    if (st.radiationS > 6) fact('radiation', 'bad', 'time', st.radiationS, { s: R0(st.radiationS), warn: 12 });

    // The signature objective (item 19)
    if (S.over && SIGNATURE[S.world] === 'shadow') {
      const sh = sites.find((x) => x.shadow);
      if (sh) fact(sh.done ? 'shadow_done' : 'shadow_missed', sh.done ? 'good' : 'bad', sh.done ? 'instruments' : 'spareO2', sh.done ? 0 : 1, {});
    } else if (S.over && SIGNATURE[S.world] === 'core') {
      const kindName = label('kind', ld.objective, ld.objective);
      const home = extracted && A.rack.some((r) => r.core && r.siteKind === ld.objective);
      if (home) fact('core_home', 'good', 'drill', 0, { kind: kindName });
      else fact('core_missed', 'bad', ld.drill.has ? 'fuel' : 'drill', 1, { kind: kindName }, { why: ld.drill.has ? 'core_left' : 'core_nodrill' });
    }

    // Lander systems (the engineer's)
    const faultS = st.faultS || {};
    const openS = (faultS.panels || 0) + (faultS.charger || 0);
    if (S.faultTotal > 0 && openS > 20) {
      const what = ['panels', 'charger'].filter((k) => (faultS[k] || 0) > 5).map((k) => label('fault', k, STRINGS['team.surface.fault.' + k])).join(', ');
      fact('faults_open', 'bad', faultS.panels >= (faultS.charger || 0) ? 'solar' : 'battery', openS, { s: R0(openS), what });
    } else if (S.faultTotal > 0 && (st.faultsFixed || 0) >= S.faultTotal && S.over) {
      fact('faults_fixed', 'good', 'battery', 0, { n: S.faultTotal });
    }

    const scienceMax = sites.reduce((sum, s) => sum + (s.fits ? s.value * s.valueBonus + s.value * ld.drill.coreValue : 0), 0);
    const scienceAll = sites.reduce((sum, s) => sum + s.value * s.valueBonus + s.value * 0.9, 0);
    const leftKg = S.entities.filter((e) => e.kind === 'sample').reduce((sum, e) => sum + e.massKg, 0);
    const jetKg = A.jettisoned.reduce((sum, r) => sum + r.massKg, 0);
    let cause = null;
    if (out === 'stranded') cause = 'stranded';
    else if (extracted && st.o2StockOut >= 0 && st.returnsBy.oxygen > 1) cause = 'oxygen';
    else if (extracted && R.sets.length) cause = 'data_left';
    const crewFrac = extracted ? aboard / Math.max(1, players.length) : 0;
    const won = extracted && objectiveMet && scienceValue >= scienceAll * TUNE.winScienceFrac;
    const result = won ? 'success' : extracted ? 'partial' : S.over ? 'stranded' : null;
    return {
      // Flat fields for SMD.team.sim chain / score / obituary.
      crewTotal: players.length, survivors: aboard, scienceFrac: scienceMax > 0 ? clamp(scienceValue / scienceMax, 0, 1) : 0,
      valueSent: st.valueSent, gbitSent: st.gbitSent, setsLost: S.over ? R.sets.length : 0, setsTotal: sitesDone,
      overrunWave: null, cause, baseDark: false,
      samplesKg: massReturned + jetKg + leftKg, samplesLeftKg: jetKg + leftKg, liftKg: A.liftKg,
      o2LeftS: st.o2StockOut >= 0 ? Math.max(0, S.T - st.o2StockOut) : null,
      crewAlive: true,

      outcome: out, over: S.over, extracted, won, result, seed: S.seed, world: S.world, hazards: S.hazardsMode, difficulty: S.difficulty,
      t: S.t, T: S.T,
      // The mission's surface objectives, for the progress tracker (0..1 overall).
      progress, objectives: objectives.map((o) => ({ id: o.id, text: o.text, key: o.key, frac: o.frac, done: o.done, weight: o.weight, n: o.n, of: o.of, kind: o.kind, job: o.job || null })),
      crew: { total: players.length, aboard, lost, downs: 0, revives: 0, deaths: 0, respawns: 0, returns: st.returns, returnsBy: Object.assign({}, st.returnsBy) },
      science: { sitesTotal: sites.length, sitesDone, gbitScanned: st.gbitScanned, gbitSent: st.gbitSent, gbitLost: unsentGbit, gbitOverwritten: st.gbitOverwritten, valueSent: st.valueSent, valueUnsent: unsentValue, value: scienceValue, valueMax: scienceMax, valueAll: scienceAll, objective: ld.objective, objectiveMet, objectiveScanned, objectiveSites: objectiveSites.length, blockedKinds },
      samples: { taken: st.samplesTaken, delivered: st.samplesDelivered, left: st.samplesLeft, returned: returned.length, jettisoned: A.jettisoned.length, massReturnedKg: massReturned, valueReturned, valueJettisoned: valueDropped },
      power: { darkS: st.darkS, firstDarkT: st.firstDarkT, batteryLowFrac: st.batteryLowFrac, hullDmg: 0, hullDmgDark: 0, nights: st.nightEndured, batteryWh: ld.power.batteryWh, solarW: ld.power.solarW },
      dangers: { radiationS: st.radiationS, shelteredS: st.shelteredS, hits: Object.assign({}, st.hazardHits), rockfallsDodged: st.rockfallsDodged },
      uplink: { windows, gbitSent: st.gbitSent, missedWindows, dishDowns: st.dishDowns, rateGbitS: ld.uplink.rateGbitS, everyS: ld.uplink.everyS, windowS: ld.uplink.windowS },
      ascent: { liftKg: A.liftKg, loadedKg: A.loadedKg, massReturnedKg: massReturned, rack: A.rack.slice(), jettisoned: A.jettisoned.slice(), waitedS: st.waitS, boiledKg: st.boilKg },
      items: { o2: { used: st.o2Used, stockOutT: st.o2StockOut, canisters: st.canistersUsed }, drill: ld.drill.has },
      facts,
      perPlayer: players.map((p) => {
        const T0 = p.tally || {};
        const n = (k) => Math.round(T0[k] || 0);
        return { name: p.name, role: p.role, job: p.role, crewId: p.crewId || null, playerName: p.playerName || null, playerId: p.playerId, isBot: p.isBot, scans: n('scans'), carried: n('carried'), dropped: n('dropped'), returns: n('returns'), plants: n('plants'), aligns: n('aligns'), repairs: n('repairs'), patches: n('patches'), routes: n('routes'), calls: n('calls'), boosts: n('boosts'), overclocks: n('overclocks'), heldS: n('heldS') };
      }),
      jobs: !!S.jobs,
      signature: SIGNATURE[S.world] || null,
      faults: { total: S.faultTotal || 0, seen: st.faultsSeen || 0, fixed: st.faultsFixed || 0, open: (S.faults || []).length, panelsS: Math.round((st.faultS || {}).panels || 0), chargerS: Math.round((st.faultS || {}).charger || 0) },
      score: {
        science: scienceMax > 0 ? clamp(scienceValue / scienceMax, 0, 1) : 0,
        survival: crewFrac,
        objectives: progress,
        timeUsed: clamp(S.t / S.T, 0, 1.3),
      },
    };
  }

  const api = {
    TICK, WORLDS, TUNE, ROLES, DIFFICULTY, STRINGS, OBJECTIVE_WEIGHT, OBJECTIVE_JOB, TASK_JOB, CHOOSERS, SIGNATURE,
    // Kept empty so old callers that look these up find nothing to arm.
    WEAPONS: {}, ALIENS: {},
    create, step, stepMove, summary, statusFor, fixture, normalizeLoadout, ascentPlan,
    // The one next thing for a person to do, and where: { id, target: {x, z} }.
    nextGoal(S, playerId) {
      const p = S && S.entities ? S.entities.find((e) => e.kind === 'astronaut' && e.playerId === String(playerId)) : null;
      return nextGoal(S, p);
    },
    // May this player do this task now (docs/TEAM-V3.md item 5)? task: scan, plant, align,
    // uplink, repair, patch, call, route, choose.
    canDo(S, playerId, task) {
      const p = S && S.entities ? S.entities.find((e) => e.kind === 'astronaut' && e.playerId === String(playerId)) : null;
      if (!p) return false;
      if (S.jobs === undefined) return true;
      return owns(S, buildViews(S), p, task);
    },
    // Throw a rack sample overboard now, whoever pressed the button (the room may
    // have no live astronaut to carry it). True if it was on the rack.
    jettison(S, id) {
      if (!S || S.stage !== 'extraction') return false;
      return jettison(S, buildViews(S), String(id));
    },
  };
  SMD.team.surface = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
