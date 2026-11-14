// Mission Sprint: game content for the team game (docs/TEAM.md).
// Numbers come from js/data.js (NASA-sourced, see content/sources.js) wherever
// they fit; simplifications are stated in docs/TEAM-BALANCE.md.
// All English text lives here; SMD.team.data.strings() lists every key so the
// Arabic file can be checked for completeness.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  if (typeof module === 'object' && module.exports) {
    if (!SMD.physics) require('../physics.js');
    if (!SMD.data) require('../data.js');
  }
  const P = SMD.physics;
  const GD = SMD.data;
  SMD.team = SMD.team || {};

  const G0 = P.G0;
  const NSSDC = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/';
  const SRC = {
    solar: `${NSSDC}earthfact.html`,
    mars: `${NSSDC}marsfact.html`,
    venus: `${NSSDC}venusfact.html`,
    jupiter: `${NSSDC}jupiterfact.html`,
    moon: `${NSSDC}moonfact.html`,
    rocket: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/',
    link: 'https://deepspace.jpl.nasa.gov/dsndocs/810-005/',
    dsn: 'https://www.nasa.gov/communicating-with-missions/dsn/',
    mro: 'https://www.jpl.nasa.gov/news/press_kits/mro-launch-Aug05.pdf',
    landsat: 'https://svs.gsfc.nasa.gov/13917/',
    launchers: 'https://www.nasa.gov/news-release/nasa-awards-launch-services-contract-for-dragonfly-mission/',
    lro: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031A',
    clipper: 'https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/',
    vault: 'https://europa.nasa.gov/news/96/how-nasa-is-protecting-europa-clipper-from-space-radiation',
    magellan: 'https://science.nasa.gov/mission/magellan/',
    rtg: 'https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf',
    havoc: 'https://ntrs.nasa.gov/api/citations/20160006580/downloads/20160006580.pdf',
    artemis: 'https://www.nasa.gov/mission/artemis-ii/',
    mav: 'https://science.nasa.gov/mission/mars-sample-return/',
    europa: `${NSSDC}galileanfact.html`,
    galileo: 'https://llis.nasa.gov/lesson/492',
    insight: 'https://spacepolicyonline.com/news/vacuum-leaks-delay-launch-of-nasas-insight-mars-mission/',
  };

  const ROLES = ['planner', 'engineer', 'scientist', 'comms'];

  // Surface gear that fights (weapons, turrets, drones, medkits, rovers) is gone (TEAM-V2):
  // the crew carries only oxygen, fuel to get home and a drill that pulls ice cores.
  const KEY_ROLE = {
    orbit: 'planner', launcher: 'planner', route: 'planner', lifetime: 'planner', schedule: 'planner', ascent: 'planner',
    structure: 'engineer', panels: 'engineer', batteries: 'engineer', adcs: 'engineer', computer: 'engineer', propMargin: 'engineer', oxygen: 'engineer',
    instruments: 'scientist', duty: 'scientist', processing: 'scientist', drill: 'scientist',
    antenna: 'comms', radio: 'comms', ground: 'comms', coding: 'comms', recorder: 'comms',
  };
  const SURFACE_KEYS = ['ascent', 'oxygen', 'drill'];

  const GROUP_TITLES = {
    orbit: 'Orbit', launcher: 'Rocket', route: 'Route', lifetime: 'Mission length', schedule: 'Build schedule', ascent: 'Fuel to get home',
    structure: 'Structure', panels: 'Power source', batteries: 'Batteries', adcs: 'Pointing', computer: 'Flight computer', propMargin: 'Spare fuel', oxygen: 'Spare oxygen',
    instruments: 'Instruments', duty: 'How often they run', processing: 'Onboard processing', drill: 'Drill',
    antenna: 'Antenna', radio: 'Radio', ground: 'Ground stations', coding: 'Signal coding', recorder: 'Data recorder',
  };

  // tier: 1 Cadet (simple), 2 Engineer, 3 Flight director (advanced).
  // kind drives how an instrument works with the orbit (orbit.fit[kind]).
  const INSTRUMENTS = {
    hires: { ...pick(GD.INSTRUMENTS.hires), kind: 'optical', needsSun: true, tier: 1, needsPointing: 1, note: 'Sees a table-sized rock. Huge pictures, huge data.', source: SRC.mro },
    context: { ...pick(GD.INSTRUMENTS.context), kind: 'wide', needsSun: true, tier: 1, note: 'Wide, light and cheap. The big picture, not the details.', source: SRC.mro },
    wide: { name: 'Wide-swath imager', mass: 42, power: 45, rate: 16, cost: 30, kind: 'wide', needsSun: true, tier: 1, note: 'A very wide strip of ground on every pass, like a weather satellite.', source: SRC.landsat },
    irspec: { ...pick(GD.INSTRUMENTS.irspec), kind: 'ir', needsSun: false, tier: 1, note: 'Reads chemistry and heat from the colours of infrared light.', source: SRC.mro },
    sounder: { ...pick(GD.INSTRUMENTS.sounder), kind: 'radar', needsSun: false, tier: 1, note: 'Radio pulses that echo off layers a few hundred metres down.', source: SRC.mro },
    iceRadar: { ...pick(GD.INSTRUMENTS.iceRadar), kind: 'radar', needsSun: false, tier: 2, note: 'Long antennas that see through kilometres of ice.', source: SRC.clipper },
    sar: { ...pick(GD.INSTRUMENTS.sar), kind: 'radar', needsSun: false, tier: 1, note: 'Maps ground through thick clouds. Power hungry and data hungry.', source: SRC.magellan },
    neutron: { ...pick(GD.INSTRUMENTS.neutron), kind: 'neutron', needsSun: false, tier: 1, note: 'Counts neutrons leaking from the ground. Hydrogen slows them down.', source: SRC.lro },
    mag: { ...pick(GD.INSTRUMENTS.mag), kind: 'field', needsSun: false, tier: 1, continuous: true, note: 'Feels a salty ocean bend Jupiter’s magnetic field.', source: SRC.clipper },
    uso: { ...pick(GD.INSTRUMENTS.uso), kind: 'radio', needsSun: false, tier: 2, continuous: true, needsDish: 2, note: 'Turns your radio into a gravity meter. Needs a 2 m dish or bigger.', source: SRC.magellan },
    lidar: { name: 'Laser altimeter', mass: 15, power: 34, rate: 1.2, cost: 22, kind: 'laser', needsSun: false, tier: 2, note: 'Measures height with laser pulses, even inside dark craters.', source: SRC.lro },
  };
  function pick(i) {
    return { name: i.name, mass: i.mass, power: i.power, rate: i.rate, cost: i.cost };
  }

  // ---------- Shared option lists ----------
  const panelsSi = (id, area, tier) => ({ id, name: `${area} m² silicon panels`, areaM2: area, eff: 0.18, kgPerM2: 3.5, costPerM2: 0.35, tier, note: 'Cheap and simple. Bigger area, more mass.' });
  const panelsTJ = (id, area, tier) => ({ id, name: `${area} m² high-efficiency panels`, areaM2: area, eff: 0.238, kgPerM2: 3.2, costPerM2: 0.6, tier, note: 'More power per square metre, higher price.' });
  const COMMON = {
    route: {},
    lifetime: {},
    schedule: [
      { id: 'rush', name: 'Rush the build', months: -4, costMult: 1.12, flawMult: 1.8, tier: 2, note: 'Done sooner, but overtime costs money and flaws slip through.' },
      { id: 'plan', name: 'Normal schedule', months: 0, costMult: 1, flawMult: 1, tier: 1, note: 'The plan everyone agreed.' },
      { id: 'careful', name: 'Extra testing', months: 4, costMult: 1.08, flawMult: 0.4, tier: 2, note: 'More tests catch hidden flaws, but take time and money.' },
    ],
    structure: [
      { id: 'light', name: 'Light frame', frac: 0.14, mass: 0, costM: 2, shieldKrad: 20, tier: 2, note: 'Saves mass. Less protection from radiation.' },
      { id: 'standard', name: 'Standard frame', frac: 0.2, mass: 0, costM: 0, shieldKrad: 30, tier: 1, note: 'A sensible aluminium box.' },
      { id: 'vault25', name: 'Standard + 25 kg vault', frac: 0.2, mass: 25, costM: 3, shieldKrad: 150, tier: 2, note: 'A small lead-and-titanium closet for the computer.', source: SRC.vault },
      { id: 'vault75', name: 'Standard + 75 kg vault', frac: 0.2, mass: 75, costM: 9, shieldKrad: 500, tier: 2, note: 'Keeps electronics alive near Jupiter.', source: SRC.vault },
      { id: 'vault150', name: 'Standard + 150 kg vault', frac: 0.2, mass: 150, costM: 18, shieldKrad: 1100, tier: 3, note: 'Heavy armour against radiation.', source: SRC.vault },
    ],
    batteries: [
      { id: 'b300', name: '300 Wh battery', wh: 300, mass: 3, costM: 1, tier: 2, note: 'Barely gets a small craft through one night.' },
      { id: 'b800', name: '800 Wh battery', wh: 800, mass: 7, costM: 2, tier: 1, note: 'Enough for a small spacecraft.' },
      { id: 'b2000', name: '2,000 Wh battery', wh: 2000, mass: 17, costM: 5, tier: 1, note: 'A comfortable reserve.' },
      { id: 'b5000', name: '5,000 Wh battery', wh: 5000, mass: 42, costM: 12, tier: 1, note: 'Heavy, but radar can keep working in the dark.' },
      { id: 'b12000', name: '12,000 Wh battery', wh: 12000, mass: 96, costM: 26, tier: 3, note: 'For very long nights and hungry radars.' },
    ],
    adcs: [
      { id: 'magnet', name: 'Magnets and sun sensors', mass: 8, powerW: 8, costM: 4, pointing: 0.55, tier: 2, note: 'Cheap and rough: cameras blur, big dishes miss Earth.' },
      { id: 'wheels', name: 'Reaction wheels', mass: 28, powerW: 40, costM: 12, pointing: 1, tier: 1, note: 'Spinning wheels hold the craft steady.' },
      { id: 'star', name: 'Star trackers + wheels', mass: 45, powerW: 62, costM: 24, pointing: 1.3, tier: 2, note: 'Very steady. Sharp images and tight dish pointing.' },
    ],
    computer: [
      { id: 'single', name: 'One computer', mass: GD.OPTIONS.avionics[0].mass, powerW: 22, costM: 18, redundancy: 1, radHard: 1, tier: 1, note: 'If it fails, you are on your own.' },
      { id: 'dual', name: 'Two computers', mass: GD.OPTIONS.avionics[1].mass, powerW: 32, costM: 34, redundancy: 2, radHard: 1, tier: 1, note: 'A backup takes over if the first one dies.' },
      { id: 'radhard', name: 'Radiation-hardened computer', mass: 34, powerW: 28, costM: 44, redundancy: 1, radHard: 2.5, tier: 2, note: 'Built to take radiation. Slow, tough and expensive.' },
    ],
    propMargin: [
      { id: 'm0', name: 'No spare fuel', frac: 0, tier: 3, note: 'Exactly enough, if nothing goes wrong.' },
      { id: 'm10', name: '10% spare fuel', frac: 0.1, tier: 1, note: 'A small cushion.' },
      { id: 'm25', name: '25% spare fuel', frac: 0.25, tier: 1, note: 'Survives a leak. Costs mass.' },
      { id: 'm50', name: '50% spare fuel', frac: 0.5, tier: 3, note: 'Very safe, very heavy.' },
    ],
    duty: [
      { id: 'd30', name: 'Run 30% of the time', frac: 0.3, tier: 1, note: 'Sips power and data.' },
      { id: 'd60', name: 'Run 60% of the time', frac: 0.6, tier: 1, note: 'A balanced plan.' },
      { id: 'd90', name: 'Run 90% of the time', frac: 0.9, tier: 1, note: 'Lots of science, lots of data, lots of power.' },
    ],
    processing: [
      { id: 'raw', name: 'Send raw data', factor: 1, quality: 1, powerW: 0, tier: 1, note: 'Nothing lost, nothing saved.' },
      { id: 'compress', name: 'Compress data', factor: 0.5, quality: 0.98, powerW: 12, tier: 1, note: 'Half the data for a little computer power.' },
      { id: 'smart', name: 'Keep only the best', factor: 0.2, quality: 0.8, powerW: 30, tier: 2, note: 'Sends a fifth of the data. Some science is thrown away.' },
    ],
    antenna: GD.OPTIONS.dish.map((x) => ({ id: `a${x.id}`, name: x.name, diaM: x.id, mass: x.mass, costM: x.cost, tier: 1, note: x.id === 1 ? 'Small and cheap. Weak signal from far away.' : x.id === 2 ? 'A good middle choice.' : 'Big signal, needs steady pointing.', source: SRC.link })).concat([
      { id: 'a03', name: '30 cm patch', diaM: 0.3, mass: 2, costM: 1, tier: 2, note: 'Tiny. Fine close to Earth, useless far away.', source: SRC.link },
      { id: 'a4', name: '3.7 m dish', diaM: 3.7, mass: 70, costM: 22, tier: 3, note: 'Magellan-sized. Strong signal, needs precise pointing.', source: SRC.magellan },
    ]),
    radio: [
      { id: 'r5', name: '5 W radio', rfW: 5, dcW: 14, mass: 2, costM: 1, maxMbps: 8, tier: 2, note: 'Small and light. Slow.' },
      { id: 'r25', name: '25 W radio', rfW: 25, dcW: 45, mass: 3, costM: 3, maxMbps: 150, tier: 1, note: 'The everyday radio.', source: SRC.link },
      { id: 'r50', name: '50 W radio', rfW: 50, dcW: 90, mass: 5, costM: 5, maxMbps: 400, tier: 1, note: 'Twice the signal, twice the power.', source: SRC.link },
      { id: 'r100', name: '100 W radio', rfW: 100, dcW: 180, mass: 9, costM: 8, maxMbps: 800, tier: 1, note: 'Same power class as MRO. Drinks electricity.', source: SRC.mro },
    ],
    coding: [
      { id: 'fast', name: 'Fast coding', rate: 1, robust: false, tier: 2, note: 'Full speed, but static can wreck a transmission.' },
      { id: 'robust', name: 'Strong error correction', rate: 0.7, robust: true, tier: 1, note: '30% slower. Survives radio static.', source: SRC.galileo },
    ],
    recorder: [
      ...GD.OPTIONS.recorder.map((x) => ({ id: `rec${x.id}`, name: x.id === 1024 ? '1 Tbit recorder' : `${x.id} Gbit recorder`, gbit: x.id, mass: x.mass, costM: x.cost, tier: 1, note: x.id === 64 ? 'Fills fast. Better have a pass soon.' : x.id === 256 ? 'Holds a good day of pictures.' : 'Holds plenty of data for long gaps.' })),
      { id: 'rec4096', name: '4 Tbit recorder', gbit: 4096, mass: 18, costM: 20, tier: 3, note: 'A warehouse in orbit.' },
    ],
    // Surface parts (only on scenarios that land).
    oxygen: [
      { id: 'o0', name: 'No spare oxygen', spareO2: 0, spareSec: 0, mass: 0, costM: 0, tier: 1, note: 'The clock is the clock.' },
      { id: 'o1', name: 'Spare oxygen: 1 extra day', spareO2: 1, spareSec: 75, mass: 45, costM: 1, tier: 1, note: 'About 45 kg of air, water and spares for four people.', source: SRC.artemis },
      { id: 'o2', name: 'Spare oxygen: 2 extra days', spareO2: 2, spareSec: 150, mass: 90, costM: 2, tier: 2, note: 'Twice the time on the surface. Twice the mass.', source: SRC.artemis },
    ],
    drill: [
      { id: 'none', name: 'No drill', depthM: 0, speed: 0, damage: 0, mass: 0, powerW: 0, costM: 0, tier: 1, note: 'You can only pick things up.' },
      { id: 'hand', name: 'Hand drill', depthM: 0.5, speed: 1, damage: 12, mass: 8, powerW: 90, costM: 2, tier: 1, note: 'Half a metre down. Pulls a small core at each site.' },
      { id: 'deep', name: 'Deep core drill', depthM: 3, speed: 1.6, damage: 30, mass: 45, powerW: 300, costM: 9, tier: 2, note: 'Reaches real ice. Heavy and power hungry.' },
    ],
  };

  COMMON.ground = [
    { id: 'g1', name: 'One ground station', stations: 1, nearPerYear: 4, deepPerYear: 12, tier: 1, note: 'One stop on Earth. Long waits between passes.', source: SRC.dsn },
    { id: 'g2', name: 'Two ground stations', stations: 2, nearPerYear: 8, deepPerYear: 22, tier: 1, note: 'Twice the time in contact, and twice the bill.', source: SRC.dsn },
    { id: 'g3', name: 'Three stations, one at the pole', stations: 3, nearPerYear: 15, deepPerYear: 36, tier: 2, note: 'Hears you on almost every orbit. Costs a fortune to run.', source: SRC.dsn },
  ];

  // Which science sites each instrument can scan on the surface (TEAM-SURFACE.md kinds).
  const SCAN_FITS = {
    neutron: { fits: ['ice'], rate: 1.1, value: 1 },
    sounder: { fits: ['ice', 'mineral'], rate: 0.9, value: 1 },
    iceRadar: { fits: ['ice'], rate: 1.2, value: 1.3 },
    hires: { fits: ['mineral', 'thermal'], rate: 0.8, value: 1 },
    context: { fits: ['mineral'], rate: 1.2, value: 0.6 },
    wide: { fits: ['atmosphere'], rate: 0.9, value: 0.8 },
    irspec: { fits: ['mineral', 'atmosphere', 'organic', 'thermal'], rate: 1, value: 1.1 },
    sar: { fits: ['mineral', 'thermal'], rate: 0.7, value: 1 },
    mag: { fits: ['organic'], rate: 0.8, value: 1.1 },
    uso: { fits: ['thermal'], rate: 0.7, value: 0.8 },
    lidar: { fits: ['mineral', 'ice'], rate: 1, value: 0.9 },
  };

  // Uplink windows on the surface: how the orbit paces them (game seconds).
  const UPLINK_WINDOWS = {
    'moon.polar100': { everyS: 60, windowS: 30, firstS: 40, label: 'polar orbiter overhead' },
    'moon.frozen': { everyS: 75, windowS: 45, firstS: 45, label: 'frozen-orbit relay' },
    'moon.equator': { everyS: 95, windowS: 30, firstS: 70, label: 'low relay, rarely overhead' },
    'mars.polar300': { everyS: 65, windowS: 28, firstS: 45, label: 'polar orbiter overhead' },
    'mars.ellipse': { everyS: 105, windowS: 55, firstS: 55, label: 'high ellipse, long but rare' },
    'mars.dust': { everyS: 75, windowS: 30, firstS: 50, label: 'afternoon relay pass' },
    'venus.circ250': { everyS: 70, windowS: 26, firstS: 50, label: 'low orbiter overhead' },
    'venus.ellipse': { everyS: 95, windowS: 50, firstS: 55, label: 'Magellan-style ellipse relay' },
    'europa.tour': { everyS: 120, windowS: 60, firstS: 70, label: 'Jupiter tour relay, weeks between flybys in real life' },
    'europa.orbit': { everyS: 60, windowS: 32, firstS: 42, label: 'Europa orbiter overhead' },
  };

  // Launchers: classes from js/data.js (capacity depends on the orbit).
  const LAUNCHERS = GD.OPTIONS.launcher
    .filter((l) => !l.crewOnly)
    .map((l) => ({ id: l.id, name: l.name, c0: l.c0, scale: l.scale, leo: l.leo, costM: l.cost, tier: 1, source: SRC.launchers, note: l.id === 'light' ? 'Cheap, small.' : l.id === 'medium' ? 'The workhorse.' : 'Lifts almost anything. Costs a lot.' }));

  // ---------- Orbits ----------
  const orbitEarth = (o) => ({
    body: 'earth',
    rangeKm: o.rangeKm || 1500,
    au: 1,
    ...o,
  });

  // Moon, Mars, Venus, Europa helper: capture from vinf into this orbit.
  const captureDv = (vinf, body, rpAlt, raAlt) => {
    const p = P.PLANETS[body];
    return P.captureDv(vinf, p.mu, p.radius + rpAlt, p.radius + raAlt);
  };

  // ---------- Scenarios ----------
  const SCENARIOS = {
    nile: {
      id: 'nile', title: 'Nile from orbit', kind: 'earth', dest: 'earth', training: true, surface: null, budgetM: 215, deadlineMonths: 30, devBase: 16, opsPerYear: 3, busCost: 34, thermalFrac: 0.03, heaterW: 10, busW: 60, au: 1,
      rateMult: 6, busKg: 110,
      question: 'Farmers need to know which fields are thirsty. Can we watch every field from space?',
      objective: 'Map the farmland along the Nile.',
      linkMode: 'near',
      objectives: [
        { id: 'fields', title: 'Sharp images of every field', instruments: { hires: 1, wide: 0.5, context: 0.3 } },
        { id: 'water', title: 'Which crops are thirsty', instruments: { irspec: 1 } },
        { id: 'whole', title: 'The whole valley, often', instruments: { wide: 1, context: 0.6, hires: 0.3 } },
      ],
      requirements: [
        { id: 'sharp', title: 'Sharper images', text: 'Every field in fine detail.', weights: { fields: 0.8, water: 0.2, whole: 0 }, needs: { fields: 3200, water: 250, whole: 900 } },
        { id: 'wide', title: 'Wider coverage', text: 'The whole valley, often.', weights: { fields: 0.15, water: 0.25, whole: 0.6 }, needs: { fields: 3200, water: 250, whole: 1100 } },
      ],
      orbits: [
        orbitEarth({ id: 'sso600', name: 'Sun-synchronous, 600 km', altKm: 600, launchFactor: 0.75, insertionDv: 0.05, dvPerYear: 0.01, radKrad: 1.5, dragYears: 15, revisitDays: 8, fit: { optical: 1, wide: 1, ir: 1 }, passes: { perStation: 4, passMin: 9 }, note: 'The classic. Same light every day. Dark for a third of each orbit.', tier: 1, source: SRC.landsat }),
        orbitEarth({ id: 'dd650', name: 'Dawn-dusk orbit, 650 km', altKm: 650, launchFactor: 0.72, insertionDv: 0.05, dvPerYear: 0.01, radKrad: 1.5, dragYears: 20, revisitDays: 8, eclipseOverride: 0.03, fit: { optical: 0.55, wide: 0.75, ir: 0.8 }, passes: { perStation: 4, passMin: 9 }, note: 'Rides the day-night line: almost no shadow, but long shadows on the ground blur the farms.', tier: 2 }),
        orbitEarth({ id: 'leo400', name: 'Low orbit, 400 km', altKm: 400, launchFactor: 0.9, insertionDv: 0.03, dvPerYear: 0.075, radKrad: 1, dragYears: 1.5, revisitDays: 12, fit: { optical: 1.3, wide: 0.7, ir: 1.1 }, passes: { perStation: 5, passMin: 8 }, note: 'Sharper pictures. Thin air slowly drags you down: bring fuel or fall.', tier: 1 }),
        orbitEarth({ id: 'geo', name: 'Geostationary, 35,786 km', altKm: 35786, launchFactor: 0.34, insertionDv: 1.75, dvPerYear: 0.05, radKrad: 8, dragYears: 200, rangeKm: 38000, revisitDays: 0.05, eclipseOverride: 0.05, fit: { optical: 0.12, wide: 0.75, ir: 0.8 }, passes: { continuous: true }, note: 'Hangs over one spot, always in view of your station. So far up that fine detail is gone.', tier: 2 }),
      ],
      routes: [
        { id: 'direct', name: 'Own rocket', costMult: 1, capacityMult: 1, tier: 1, note: 'Your rocket, your orbit, your schedule.' },
        { id: 'rideshare', name: 'Share a rocket', costMult: 0.45, capacityMult: 0.3, tier: 2, orbitOnly: ['sso600'], note: 'Cheap ride to a sun-synchronous orbit, but only a small share of the rocket and only that orbit.' },
      ],
      lifetimes: [{ id: 'y1', years: 1, tier: 1 }, { id: 'y2', years: 2, tier: 1 }, { id: 'y3', years: 3, tier: 1 }, { id: 'y5', years: 5, tier: 2 }],
      instruments: ['hires', 'context', 'wide', 'irspec'],
      panels: [panelsSi('p2', 2, 1), panelsSi('p4', 4, 1), panelsSi('p8', 8, 1), panelsTJ('tj3', 3, 2), panelsTJ('tj6', 6, 2)],
      starter: { orbit: 'sso600', launcher: 'light', lifetime: 'y2', panels: 'p4', batteries: 'b800', instruments: ['context'], duty: 'd60', antenna: 'a1', radio: 'r25', ground: 'g2', recorder: 'rec64' },
    },
    storms: {
      id: 'storms', title: 'Storm watcher', kind: 'earth', dest: 'earth', training: true, surface: null, budgetM: 282, deadlineMonths: 30, devBase: 16, opsPerYear: 3, busCost: 36, thermalFrac: 0.03, heaterW: 10, busW: 60, au: 1,
      rateMult: 3, busKg: 120,
      question: 'Dust storms sweep across Egypt every spring. Can we see them coming?',
      objective: 'Warn of dust storms before they arrive.',
      linkMode: 'near',
      objectives: [
        { id: 'storms', title: 'Infrared images of dust in the air', instruments: { irspec: 1 } },
        { id: 'fronts', title: 'Wide views of dust fronts', instruments: { wide: 1, context: 0.8, hires: 0.2 } },
      ],
      requirements: [
        { id: 'early', title: 'Early warning', text: 'See dust the moment it lifts.', weights: { storms: 0.75, fronts: 0.25 }, needs: { storms: 1800, fronts: 500 }, revisitGoalDays: 0.5 },
        { id: 'track', title: 'Track the whole storm', text: 'Follow every storm across Egypt.', weights: { storms: 0.35, fronts: 0.65 }, needs: { storms: 1800, fronts: 2500 }, revisitGoalDays: 0.2 },
      ],
      orbits: [
        orbitEarth({ id: 'geo', name: 'Geostationary, 35,786 km', altKm: 35786, launchFactor: 0.34, insertionDv: 1.75, dvPerYear: 0.05, radKrad: 8, dragYears: 200, rangeKm: 38000, revisitDays: 0.02, eclipseOverride: 0.05, fit: { optical: 0.3, wide: 1.2, ir: 1.1 }, passes: { continuous: true }, note: 'Watches Egypt all the time. The climb to that height burns most of your fuel.', tier: 1 }),
        orbitEarth({ id: 'polar800', name: 'Polar orbit, 800 km', altKm: 800, launchFactor: 0.7, insertionDv: 0.06, dvPerYear: 0.008, radKrad: 2, dragYears: 80, revisitDays: 1, fit: { optical: 1, wide: 1, ir: 1 }, passes: { perStation: 4, passMin: 11 }, note: 'Passes overhead twice a day. Cheap to reach, but storms can sneak up between passes.', tier: 1 }),
        orbitEarth({ id: 'sso600', name: 'Sun-synchronous, 600 km', altKm: 600, launchFactor: 0.75, insertionDv: 0.05, dvPerYear: 0.01, radKrad: 1.5, dragYears: 15, revisitDays: 1.5, fit: { optical: 1.1, wide: 0.8, ir: 1.05 }, passes: { perStation: 4, passMin: 9 }, note: 'Good light every day, but rarely over the storm when it starts.', tier: 2 }),
      ],
      routes: [{ id: 'direct', name: 'Own rocket', costMult: 1, capacityMult: 1, tier: 1, note: 'Your rocket, your orbit, your schedule.' }],
      lifetimes: [{ id: 'y1', years: 1, tier: 1 }, { id: 'y3', years: 3, tier: 1 }, { id: 'y5', years: 5, tier: 2 }],
      instruments: ['irspec', 'wide', 'context', 'hires'],
      panels: [panelsSi('p2', 2, 1), panelsSi('p4', 4, 1), panelsSi('p8', 8, 1), panelsTJ('tj3', 3, 2), panelsTJ('tj6', 6, 2)],
      starter: { orbit: 'polar800', launcher: 'light', lifetime: 'y3', panels: 'p4', batteries: 'b800', instruments: ['context'], duty: 'd60', antenna: 'a1', radio: 'r25', ground: 'g2', recorder: 'rec64' },
    },
    moon: {
      id: 'moon', title: 'Lunar water hunter', kind: 'moon', dest: 'moon', budgetM: 340, deadlineMonths: 32, devBase: 20, opsPerYear: 8, busCost: 58, thermalFrac: 0.05, heaterW: 30, busW: 90, au: 1,
      rateMult: 2, busKg: 260,
      question: 'Future Moon bases need water. Is there ice in craters that never see sunlight?',
      objective: 'Find water ice at the lunar pole.',
      linkMode: 'dsn',
      c3: -2, // translunar injection
      rangeAU: 0.00257,
      surface: { world: 'moon', platform: 'ground', ascentDvKms: 1.87, solarFactor: 0.72, dayLengthH: 708, nightStartFrac: 0.62, nightFrac: 0.3, objective: 'ice', lifetimeS: 260 },
      objectives: [
        { id: 'hydrogen', title: 'Hydrogen map of the poles', instruments: { neutron: 1, lidar: 0.2 } },
        { id: 'craters', title: 'Radar echoes from dark craters', instruments: { sounder: 1, iceRadar: 1 } },
        { id: 'images', title: 'Images of crater floors', instruments: { hires: 1, context: 0.4, lidar: 0.35 } },
      ],
      requirements: [
        { id: 'map', title: 'Map the ice', text: 'Where is it, and how much?', weights: { hydrogen: 0.6, craters: 0.3, images: 0.1 }, needs: { hydrogen: 40, craters: 600, images: 900 } },
        { id: 'see', title: 'See the craters', text: 'Sharp pictures for future landing crews.', weights: { hydrogen: 0.2, craters: 0.3, images: 0.5 }, needs: { hydrogen: 40, craters: 600, images: 2200 } },
      ],
      orbits: [
        { id: 'polar100', name: 'Polar orbit, 100 km', body: 'moon', altKm: 100, insertionDv: 0.92, dvPerYear: 0.06, radKrad: 1, dragYears: 3, fit: { optical: 1, wide: 1, radar: 1, neutron: 1, laser: 1 }, passes: { dsn: true, occult: 0.33, hours: 12 }, landing: { zone: 'pole', accuracyM: 80, siteFactor: 1, access: 'ice' }, note: 'Reaches the poles every two hours. Lumpy gravity slowly bends the orbit, so bring fuel.', tier: 1, source: SRC.lro },
        { id: 'frozen', name: 'Frozen orbit, 30×216 km', body: 'moon', altKm: 110, apoKm: 216, insertionDv: 0.82, dvPerYear: 0.015, radKrad: 1, dragYears: 12, fit: { optical: 0.75, wide: 0.9, radar: 0.85, neutron: 0.9, laser: 0.7 }, passes: { dsn: true, occult: 0.33, hours: 12 }, landing: { zone: 'pole', accuracyM: 130, siteFactor: 1.2, access: 'ice' }, note: 'A stable orbit that needs almost no fuel to keep, but science is lower down at one end only.', tier: 2, source: SRC.lro },
        { id: 'equator', name: 'Equatorial orbit, 100 km', body: 'moon', altKm: 100, insertionDv: 0.8, dvPerYear: 0.04, radKrad: 1, dragYears: 5, fit: { optical: 0.8, wide: 0.8, radar: 0.4, neutron: 0.3, laser: 0.7 }, passes: { dsn: true, occult: 0.33, hours: 12 }, landing: { zone: 'equator', accuracyM: 60, siteFactor: 2.2, access: 'rock' }, note: 'Cheap to reach and easy to land from, but it never flies over the poles where the ice is.', tier: 1 },
      ],
      routes: [
        { id: 'direct', name: 'Fast transfer, 5 days', costMult: 1, capacityMult: 1, extraDv: 0, tier: 1, note: 'A short, simple trip.' },
        { id: 'weak', name: 'Low-energy route, 3 months', costMult: 1, capacityMult: 1, extraDv: -0.1, opsMonths: 3, tier: 2, note: 'Saves fuel, adds three months of operating costs.' },
      ],
      lifetimes: [{ id: 'y1', years: 1, tier: 1 }, { id: 'y2', years: 2, tier: 1 }, { id: 'y3', years: 3, tier: 2 }],
      instruments: ['neutron', 'sounder', 'iceRadar', 'hires', 'context', 'lidar'],
      panels: [panelsSi('p3', 3, 1), panelsSi('p6', 6, 1), panelsSi('p10', 10, 1), panelsTJ('tj4', 4, 2), panelsTJ('tj8', 8, 2), panelsTJ('tj14', 14, 3)],
      starter: { orbit: 'polar100', launcher: 'medium', lifetime: 'y1', panels: 'p6', batteries: 'b2000', instruments: ['neutron'], duty: 'd60', antenna: 'a1', radio: 'r25', ground: 'g1', recorder: 'rec256' },
    },
    mars: {
      id: 'mars', title: 'Mars ice mapper', kind: 'planet', dest: 'mars', budgetM: 605, deadlineMonths: 26, devBase: 22, opsPerYear: 10, busCost: 92, thermalFrac: 0.05, heaterW: 30, busW: 110, au: 1.52, range: { base: 1.5, amp: 0.95, periodDays: 780 },
      rateMult: 2.5, busKg: 420,
      question: 'Astronauts will need water. Where is ice hiding just under the Martian dust?',
      objective: 'Find and drill Martian ice.',
      linkMode: 'dsn',
      c3: 8.7, vinf: 2.65, capture: { rpAlt: 300, raAlt: 45000 },
      surface: { world: 'mars', platform: 'ground', ascentDvKms: 4.1, solarFactor: 0.62, dayLengthH: 24.6, nightStartFrac: 0.55, nightFrac: 0.42, objective: 'ice', lifetimeS: 260 },
      objectives: [
        { id: 'ice', title: 'Radar sounding of buried ice', instruments: { sounder: 1, iceRadar: 0.9 } },
        { id: 'sites', title: 'Sharp images of landing sites', instruments: { hires: 1, context: 0.35 } },
        { id: 'hydrogen', title: 'Hydrogen map of the top metre', instruments: { neutron: 1 } },
      ],
      requirements: [
        { id: 'ice', title: 'Find the ice', text: 'Where to land to drink.', weights: { ice: 0.65, sites: 0.15, hydrogen: 0.2 }, needs: { ice: 2000, sites: 3500, hydrogen: 25 } },
        { id: 'sites', title: 'Choose the landing site', text: 'Sharp images of where crews land.', weights: { ice: 0.2, sites: 0.65, hydrogen: 0.15 }, needs: { ice: 1500, sites: 3500, hydrogen: 25 } },
      ],
      orbits: [
        { id: 'polar300', name: 'Low polar orbit, 300 km', body: 'mars', altKm: 300, arriveDv: 'circular', dvPerYear: 0.04, radKrad: 1, dragYears: 40, fit: { optical: 1, wide: 1, radar: 1, neutron: 1 }, passes: { dsn: true, occult: 0.32, hours: 8 }, landing: { zone: 'polar plains', accuracyM: 120, siteFactor: 1, access: 'ice' }, note: 'Sees every part of Mars, close up. Costs the most fuel to get into.', tier: 1, source: SRC.mro },
        { id: 'ellipse', name: 'Long ellipse, 300×45,000 km', body: 'mars', altKm: 300, apoKm: 45000, arriveDv: 'ellipse', dvPerYear: 0.02, radKrad: 1, dragYears: 100, fit: { optical: 0.45, wide: 0.75, radar: 0.5, neutron: 0.6 }, passes: { dsn: true, occult: 0.1, hours: 8 }, landing: { zone: 'mid plains', accuracyM: 260, siteFactor: 1.6, access: 'rock' }, note: 'Much cheaper to capture into. Low over Mars for only part of each orbit.', tier: 1 },
        { id: 'dust', name: 'Afternoon orbit, 400 km', body: 'mars', altKm: 400, arriveDv: 'circular', dvPerYear: 0.03, radKrad: 1, dragYears: 60, fit: { optical: 1.15, wide: 1.1, radar: 0.9, neutron: 0.9 }, passes: { dsn: true, occult: 0.3, hours: 8 }, landing: { zone: 'mid plains', accuracyM: 150, siteFactor: 1.35, access: 'rock' }, note: 'Long afternoon shadows make terrain pop. Slightly further from the poles.', tier: 2, source: SRC.mro },
      ],
      routes: [
        { id: 'capture', name: 'Fire the engine to arrive', extraDv: 0, tier: 1, note: 'Simple and quick. Costs a lot of fuel.', costMult: 1, capacityMult: 1 },
        { id: 'aerobrake', name: 'Aerobrake in the air', extraDv: -0.75, opsMonths: 6, lifeLossYears: 0.4, risk: 0.12, costMult: 1, capacityMult: 1, tier: 2, note: 'Skim the thin air for six months to slow down. Saves fuel, takes time and nerve.', source: SRC.mro },
      ],
      lifetimes: [{ id: 'y1', years: 1, tier: 1 }, { id: 'y2', years: 2, tier: 1 }, { id: 'y4', years: 4, tier: 2 }],
      instruments: ['sounder', 'iceRadar', 'hires', 'context', 'neutron'],
      panels: [panelsSi('p4', 4, 1), panelsSi('p8', 8, 1), panelsSi('p14', 14, 1), panelsTJ('tj8', 8, 2), panelsTJ('tj14', 14, 2), panelsTJ('tj22', 22, 3)],
      starter: { orbit: 'ellipse', launcher: 'medium', lifetime: 'y1', panels: 'p8', batteries: 'b2000', instruments: ['neutron'], duty: 'd60', antenna: 'a2', radio: 'r50', ground: 'g1', recorder: 'rec256' },
    },
    venus: {
      id: 'venus', title: 'Venus cloud explorer', kind: 'planet', dest: 'venus', budgetM: 630, deadlineMonths: 34, devBase: 24, opsPerYear: 11, busCost: 104, thermalFrac: 0.09, heaterW: 0, busW: 120, au: 0.723, arrayFactor: 0.3, range: { base: 1.0, amp: 0.7, periodDays: 584 },
      rateMult: 1, busKg: 480,
      question: 'Magellan mapped Venus 30 years ago. Is the planet still erupting today?',
      objective: 'Sample cloud chemistry, map for eruptions.',
      linkMode: 'dsn',
      c3: 6.3, vinf: 2.75, capture: { rpAlt: 250, raAlt: 60000 },
      surface: { world: 'venus', platform: 'floating', ascentDvKms: 7.3, solarFactor: 1.6, dayLengthH: 96, nightStartFrac: 0.5, nightFrac: 0.45, objective: 'atmosphere', lifetimeS: 240 },
      objectives: [
        { id: 'map', title: 'Radar map to compare with Magellan', instruments: { sar: 1, sounder: 0.25 } },
        { id: 'rocks', title: 'Infrared map of surface rock', instruments: { irspec: 1 } },
        { id: 'gravity', title: 'Gravity: what lies under the crust', instruments: { uso: 1 } },
      ],
      requirements: [
        { id: 'map', title: 'Map for eruptions', text: 'Find what changed since Magellan.', weights: { map: 0.65, rocks: 0.25, gravity: 0.1 }, needs: { map: 7000, rocks: 180, gravity: 10 } },
        { id: 'chem', title: 'Read the rocks', text: 'What is the crust made of?', weights: { map: 0.2, rocks: 0.6, gravity: 0.2 }, needs: { map: 5000, rocks: 400, gravity: 10 } },
      ],
      orbits: [
        { id: 'circ250', name: 'Low circular, 250 km', body: 'venus', altKm: 250, arriveDv: 'circular', dvPerYear: 0.05, radKrad: 1.5, dragYears: 60, fit: { optical: 0.1, wide: 0.1, radar: 1, ir: 1, radio: 1 }, passes: { dsn: true, occult: 0.32, hours: 8 }, landing: { zone: 'high clouds, sunlit side', accuracyM: 200, siteFactor: 1, access: 'cloud' }, note: 'Best radar. Hardest to reach, and you spend a third of every orbit in shadow.', tier: 1, source: SRC.magellan },
        { id: 'ellipse', name: 'Magellan-style ellipse', body: 'venus', altKm: 300, apoKm: 8500, arriveDv: 'ellipse', dvPerYear: 0.03, radKrad: 1.5, dragYears: 200, fit: { optical: 0.05, wide: 0.05, radar: 0.55, ir: 0.7, radio: 0.8 }, passes: { dsn: true, occult: 0.15, hours: 8 }, landing: { zone: 'high clouds, dawn side', accuracyM: 400, siteFactor: 1.5, access: 'cloud' }, note: 'Cheap to reach and easy on power, but radar only works near the low end.', tier: 1, source: SRC.magellan },
      ],
      routes: [
        { id: 'capture', name: 'Fire the engine to arrive', extraDv: 0, tier: 1, costMult: 1, capacityMult: 1, note: 'Simple and quick. Costs a lot of fuel.' },
        { id: 'aerobrake', name: 'Aerobrake in the air', extraDv: -0.9, opsMonths: 8, lifeLossYears: 0.5, risk: 0.14, costMult: 1, capacityMult: 1, tier: 2, note: 'Magellan tested this at Venus in 1993. Slow and risky, huge fuel saving.', source: SRC.magellan },
      ],
      lifetimes: [{ id: 'y1', years: 1, tier: 1 }, { id: 'y2', years: 2, tier: 1 }, { id: 'y3', years: 3, tier: 2 }],
      instruments: ['sar', 'sounder', 'irspec', 'uso'],
      panels: [panelsSi('p4', 4, 1), panelsSi('p7', 7, 1), panelsSi('p12', 12, 1), panelsTJ('tj4', 4, 2), panelsTJ('tj8', 8, 2), panelsTJ('tj14', 14, 3)],
      starter: { orbit: 'ellipse', launcher: 'medium', lifetime: 'y1', panels: 'p7', batteries: 'b2000', instruments: ['irspec'], duty: 'd60', antenna: 'a2', radio: 'r50', ground: 'g1', recorder: 'rec256' },
    },
    europa: {
      id: 'europa', title: 'Europa ice explorer', kind: 'planet', dest: 'jupiter', budgetM: 950, deadlineMonths: 34, devBase: 26, opsPerYear: 18, busCost: 170, thermalFrac: 0.06, heaterW: 70, busW: 130, au: 5.2, arrayFactor: 0.9, range: { base: 5.2, amp: 1, periodDays: 400 },
      rateMult: 4, busKg: 850,
      question: 'An ocean hides under Europa’s ice. Is the shell thin enough to ever reach it?',
      objective: 'Reach Europa’s plume deposits.',
      linkMode: 'dsn',
      c3: 35, vinf: 5.65, capture: { rpAlt: 4 * 71492, raAlt: 149 * 71492 },
      surface: { world: 'europa', platform: 'ground', ascentDvKms: 1.4, solarFactor: 0.9, dayLengthH: 85.2, nightStartFrac: 0.6, nightFrac: 0.35, objective: 'organic', lifetimeS: 220 },
      objectives: [
        { id: 'shell', title: 'Radar sounding of the ice shell', instruments: { iceRadar: 1, sounder: 0.5 } },
        { id: 'ocean', title: 'Magnetic clues to the ocean', instruments: { mag: 1 } },
        { id: 'surface', title: 'Close-up images of the cracked surface', instruments: { hires: 1, context: 0.5, irspec: 0.5 } },
      ],
      requirements: [
        { id: 'shell', title: 'Measure the ice', text: 'How thick is the shell?', weights: { shell: 0.7, ocean: 0.2, surface: 0.1 }, needs: { shell: 250, ocean: 3, surface: 200 } },
        { id: 'ocean', title: 'Find the ocean', text: 'How deep, how salty?', weights: { shell: 0.3, ocean: 0.55, surface: 0.15 }, needs: { shell: 200, ocean: 4, surface: 200 } },
      ],
      orbits: [
        { id: 'tour', name: 'Flyby tour around Jupiter', body: 'jupiter', altKm: 4 * 71492, apoKm: 149 * 71492, tour: true, periodDaysOverride: 14, arriveDv: 'capture', dvPerYear: 0.1, radKrad: 180, dragYears: 200, obsFracOverride: 0.18, eclipseOverride: 0.01, fit: { optical: 1, wide: 1, radar: 1, field: 1 }, passes: { dsn: true, occult: 0.1, hours: 8 }, landing: { zone: 'cracked plains', accuracyM: 500, siteFactor: 1.3, access: 'plume' }, note: 'Swings past Europa every two weeks and escapes the worst radiation. Like Clipper.', tier: 1, source: SRC.clipper },
        { id: 'orbit', name: 'Low orbit around Europa', body: 'jupiter', altKm: 100, apoKm: 100, periodMinOverride: 130, arriveDv: 'europa', dvPerYear: 0.15, radKrad: 950, dragYears: 200, eclipseOverride: 0.04, fit: { optical: 1.5, wide: 1.5, radar: 1.6, field: 1.7 }, passes: { dsn: true, occult: 0.35, hours: 8 }, landing: { zone: 'chaos terrain', accuracyM: 90, siteFactor: 1, access: 'plume' }, note: 'Best science anywhere. The radiation kills most spacecraft in weeks.', tier: 2, source: SRC.vault },
      ],
      routes: [
        { id: 'veega', name: 'Gravity assists, 5.5 years', extraDv: -0.25, c3: 16, opsMonths: 30, costMult: 1, capacityMult: 1, tier: 1, note: 'Swing past Earth and Mars for a free push, like Clipper. Long and cheap on fuel.', source: SRC.clipper },
        { id: 'direct', name: 'Fast direct, 3 years', extraDv: 0, costMult: 1, capacityMult: 1, tier: 2, note: 'Needs a huge rocket, but saves two and a half years of operating costs.' },
      ],
      lifetimes: [{ id: 'y1', years: 1, tier: 1 }, { id: 'y2', years: 2, tier: 1 }, { id: 'y4', years: 4, tier: 2 }],
      instruments: ['iceRadar', 'sounder', 'mag', 'hires', 'context', 'irspec'],
      panels: [panelsSi('p40', 40, 1), panelsSi('p70', 70, 1), panelsTJ('tj60', 60, 1), panelsTJ('tj90', 90, 2), { id: 'rtg1', name: '1 nuclear battery (RTG)', areaM2: 0, rtg: 1, watts: 110, kgFixed: 45, costFixed: 80, tier: 2, note: '110 W day and night. Heavy, expensive, plutonium paperwork.', source: SRC.rtg }, { id: 'rtg3', name: '3 nuclear batteries (RTG)', areaM2: 0, rtg: 3, watts: 330, kgFixed: 135, costFixed: 240, tier: 3, note: '330 W anywhere, any time. Very expensive.', source: SRC.rtg }],
      cadetExtra: { panels: ['tj60'], structure: ['vault75'], instruments: ['iceRadar'] },
      starter: { orbit: 'tour', launcher: 'heavy', route: 'veega', lifetime: 'y1', panels: 'tj60', batteries: 'b2000', instruments: ['mag'], duty: 'd60', antenna: 'a2', radio: 'r50', ground: 'g1', recorder: 'rec256', structure: 'vault75' },
    },
  };

  // Surface parts per mission world.
  const ASCENT = [
    { id: 'a0', name: 'Crew only, no samples', extraKg: 0, costM: 0, tier: 1, note: 'The lander gets you home. Nothing else comes with you.' },
    { id: 'a60', name: '60 kg extra fuel', extraKg: 60, costM: 1, tier: 1, note: 'Lifts a few samples.' },
    { id: 'a150', name: '150 kg extra fuel', extraKg: 150, costM: 3, tier: 1, note: 'Lifts a good load of samples.' },
    { id: 'a300', name: '300 kg extra fuel', extraKg: 300, costM: 5, tier: 1, note: 'Bring home plenty. Every kilo of fuel had to come from Earth.' },
    { id: 'a600', name: '600 kg extra fuel', extraKg: 600, costM: 10, tier: 2, note: 'For worlds with strong gravity. Enormous mass.' },
  ];
  COMMON.ascent = ASCENT;

  // ---------- The build, one component per step (TEAM-V2) ----------
  // Fixed order. tier: the lowest difficulty tier that gets the step (Cadet 1,
  // Engineer 2, Flight director 3); Cadet skips the advanced ones. landing: only
  // on worlds you land on. packs: steps that set several parts at once, as three
  // ready-made choices. Every step shows at most three cards.
  const BUILD_STEPS = [
    { id: 'orbit', keys: ['orbit'], role: 'planner', tier: 1, title: 'Orbit', ask: 'Where will your spacecraft fly?', res: ['mass', 'power', 'comms'] },
    { id: 'power', keys: ['panels'], role: 'engineer', tier: 1, title: 'Power', ask: 'How will it make electricity?', res: ['power', 'mass', 'budget'] },
    { id: 'batteries', keys: ['batteries'], role: 'engineer', tier: 2, title: 'Batteries', ask: 'How will it get through the dark?', res: ['power', 'mass', 'budget'] },
    { id: 'instruments', keys: ['instruments'], role: 'scientist', tier: 1, multi: true, title: 'Instruments', ask: 'What will it measure?', res: ['mass', 'power', 'data'] },
    {
      id: 'radio', keys: ['antenna', 'radio'], role: 'comms', tier: 1, title: 'Antenna & radio', ask: 'How will the data get home?', res: ['comms', 'power', 'mass'],
      packs: [
        { id: 'small', name: 'Small dish, small radio', note: 'Light and cheap. Slow from far away.', picks: { antenna: 'a1', radio: 'r25' } },
        { id: 'mid', name: 'Medium dish, strong radio', note: 'A good middle choice.', picks: { antenna: 'a2', radio: 'r50' } },
        { id: 'big', name: 'Big dish, loud radio', note: 'Fast data home. Heavy and hungry for power.', picks: { antenna: 'a3', radio: 'r100' } },
      ],
    },
    { id: 'recorder', keys: ['recorder'], role: 'comms', tier: 2, title: 'Data recorder', ask: 'How much can it remember between calls home?', res: ['data', 'mass', 'budget'] },
    {
      id: 'computer', keys: ['computer', 'adcs'], role: 'engineer', tier: 3, title: 'Computer & pointing', ask: 'How steady, and how tough?', res: ['mass', 'power', 'budget'],
      packs: [
        { id: 'basic', name: 'One computer, magnets', note: 'Cheap and rough. Pictures blur a little.', picks: { computer: 'single', adcs: 'magnet' } },
        { id: 'standard', name: 'One computer, reaction wheels', note: 'The usual: steady enough for most jobs.', picks: { computer: 'single', adcs: 'wheels' } },
        { id: 'tough', name: 'Hardened computer, star trackers', note: 'Takes radiation and points precisely. Expensive.', picks: { computer: 'radhard', adcs: 'star' } },
      ],
    },
    { id: 'lifetime', keys: ['lifetime'], role: 'planner', tier: 2, title: 'Mission length', ask: 'How long will it work?', res: ['budget', 'time'] },
    {
      id: 'landing', keys: ['ascent', 'oxygen', 'drill'], role: 'scientist', tier: 1, landing: true, title: 'Landing kit', ask: 'What do you carry down to the surface?', res: ['mass', 'budget'],
      packs: [
        { id: 'light', name: 'Crew only', note: 'The lander gets you home. No samples, no spare air.', picks: { ascent: 'a0', oxygen: 'o0', drill: 'hand' } },
        { id: 'balanced', name: 'Some samples, spare air', note: 'Fuel for a few samples and a day of spare oxygen.', picks: { ascent: 'a60', oxygen: 'o1', drill: 'hand' } },
        { id: 'heavy', name: 'Big haul, deep drill', note: 'Fuel for a big load of samples and a drill that reaches real ice.', picks: { ascent: 'a150', oxygen: 'o2', drill: 'deep' } },
      ],
    },
    { id: 'rocket', keys: ['launcher'], role: 'planner', tier: 1, title: 'Rocket', ask: 'Which rocket can lift all of it?', res: ['mass', 'budget'] },
  ];

  // Plain pros and cons on the cards, worked out from the real numbers.
  const CARD_STR = {
    'card.lightest': 'Lightest of the three',
    'card.heaviest': 'Heaviest of the three',
    'card.cheapest': 'Cheapest of the three',
    'card.priciest': 'Most expensive of the three',
    'card.sunlit': 'In sunlight {n}% of each orbit',
    'card.dark': 'In the dark {n}% of each orbit',
    'card.fuel.less': 'Least fuel to get there',
    'card.fuel.more': 'Needs {n} kg more fuel to get there',
    'card.land.near': 'Lands near the {target}',
    'card.land.far': 'Lands far from the {target}',
    'card.view.best': 'Best view for your instruments',
    'card.view.poor': 'Poor view for your instruments',
    'card.power.most': 'Most power: {n} W',
    'card.power.least': 'Least power: {n} W',
    'card.power.short': 'Not enough power for your ship',
    'card.power.dark': 'Works in the dark, far from the Sun',
    'card.battery.ok': 'Lasts through the dark',
    'card.battery.short': 'Runs flat in the dark',
    'card.sci.big': 'Big science on this mission',
    'card.sci.none': 'Little science on this mission',
    'card.data.lots': 'Lots of data: {n} Gb a day',
    'card.data.light': 'Light on data',
    'card.hungry': 'Power hungry: {n} W',
    'card.home.most': 'Sends {n} Gb a day home',
    'card.home.least': 'Only {n} Gb a day home',
    'card.home.short': 'Cannot send all your data home',
    'card.rec.ok': 'Holds {n} Gb between calls home',
    'card.rec.full': 'Fills up before the next call home',
    'card.steady': 'Steady pointing: sharp pictures',
    'card.wobbly': 'Wobbly pointing: blurry pictures',
    'card.radhard': 'Shrugs off radiation',
    'card.life.most': 'Most time for science',
    'card.life.least': 'Least time for science',
    'card.lift.kg': 'Lifts {n} kg of samples home',
    'card.lift.none': 'No samples come home',
    'card.air.more': 'Spare air: more time outside',
    'card.air.none': 'No spare air',
    'card.drill.deep': 'Drill reaches real ice',
    'card.rocket.fits': 'Lifts your ship with {n} kg to spare',
    'card.rocket.over': 'Too weak: {n} kg too heavy',
    'card.target.ice': 'ice',
    'card.target.atmosphere': 'cloud samples',
    'card.target.organic': 'plume deposits',
    'card.target.rock': 'science sites',
    'card.helps': 'Helps with: {what}',
    'card.life.short': 'Short and cheap: ops money only for a year.',
    'card.life.long': 'More orbits, more science, {n} years of ops bills.',
  };

  // ---------- Difficulties ----------
  const DIFFICULTIES = [
    { id: 'cadet', title: 'Cadet', tier: 1, designSec: 240, budgetMult: 1.25, crises: 1, opportunities: 1, oppBonus: 1.5, flaws: false, note: 'Few, simple parts. Extra money.' },
    { id: 'engineer', title: 'Engineer', tier: 2, designSec: 180, budgetMult: 1.0, crises: 3, opportunities: 1, flaws: false, note: 'The real trade-offs.' },
    { id: 'director', title: 'Flight director', tier: 3, designSec: 180, budgetMult: 0.94, crises: 4, opportunities: 1, flaws: true, note: 'Tight budget, hidden flaws.' },
    { id: 'sandbox', title: 'Sandbox', tier: 3, designSec: null, budgetMult: null, crises: 3, opportunities: 2, flaws: false, note: 'No budget, no clock. Break anything.' },
  ];

  // ---------- Hidden flaws (Flight director) ----------
  const FLAWS = [
    { id: 'battery', chance: 0.25, text: 'A battery cell shipped faulty.', effect: { batteryMult: 0.78 } },
    { id: 'radio', chance: 0.22, text: 'The radio amplifier is weaker than its spec sheet.', effect: { rateMult: 0.65 } },
    { id: 'mirror', chance: 0.2, text: 'The main camera’s optics are slightly off, like Hubble’s.', effect: { sciQuality: 0.8 } },
    { id: 'panel', chance: 0.18, text: 'One panel wing only opened most of the way, like Lucy.', effect: { panelMult: 0.85 } },
  ];

  // ---------- Crises and opportunities ----------
  // The alarm appears on `role`'s phone; the fix is on `fixRole`'s phone.
  const CRISES = [
    {
      id: 'solarStorm', role: 'comms', fixRole: 'engineer', windowSec: 9, weight: 1,
      title: 'Solar storm!', alarm: 'Radio full of static. Something big just left the Sun.', fix: 'Solar storm: turn off the sensitive electronics!',
      actions: [{ id: 'safe', label: 'Safe mode', correct: true }, { id: 'heaters', label: 'Heaters on' }, { id: 'burn', label: 'Burn engine' }],
    },
    {
      id: 'batteryCell', role: 'engineer', fixRole: 'scientist', windowSec: 8, weight: 1,
      title: 'Battery cell failing', alarm: 'A battery cell is failing. Eclipse power is dropping.', fix: 'Battery trouble! Cut instrument power before the next shadow.',
      actions: [{ id: 'shed', label: 'Turn instruments down', correct: true }, { id: 'boost', label: 'Run them harder' }, { id: 'recal', label: 'Recalibrate' }],
    },
    {
      id: 'wheelSat', role: 'scientist', fixRole: 'planner', windowSec: 8, weight: 1, needsWheels: true,
      title: 'Wheels saturated', alarm: 'Pictures are smearing. The wheels are spinning too fast.', fix: 'Reaction wheels full: schedule a thruster burn to unload them!',
      actions: [{ id: 'dump', label: 'Thruster burn', correct: true }, { id: 'coast', label: 'Coast' }, { id: 'lower', label: 'Lower orbit' }],
    },
    {
      id: 'dataFlood', role: 'scientist', fixRole: 'comms', windowSec: 8, weight: 1,
      title: 'Data flood', alarm: 'An instrument is stuck on high rate. The recorder is filling!', fix: 'Recorder filling fast! Dump it to the next ground pass now.',
      actions: [{ id: 'dump', label: 'Priority downlink', correct: true }, { id: 'radio', label: 'Radio off' }, { id: 'add', label: 'Add a station' }],
    },
    {
      id: 'fuelLeak', role: 'planner', fixRole: 'engineer', windowSec: 9, weight: 1,
      title: 'Fuel gauge dropping', alarm: 'Fuel is going down and nobody is burning.', fix: 'Fuel leak! Close the isolation valve!',
      actions: [{ id: 'valve', label: 'Close the valve', correct: true }, { id: 'tank', label: 'Pressurise the tank' }, { id: 'fire', label: 'Fire engine' }],
    },
    {
      id: 'antennaGlitch', role: 'comms', fixRole: 'engineer', windowSec: 7, weight: 1,
      title: 'Lost the ground', alarm: 'Downlink signal lost. Is the dish pointing at Earth?', fix: 'Dish is off target: re-point the spacecraft!',
      actions: [{ id: 'point', label: 'Re-point', correct: true }, { id: 'reset', label: 'Restart the radio' }, { id: 'heat', label: 'Warm the dish' }],
    },
    {
      id: 'computerFault', role: 'scientist', fixRole: 'comms', windowSec: 7, weight: 0.9,
      title: 'Computer froze', alarm: 'All the instruments stopped answering.', fix: 'Computer hung! Send the reboot command up!',
      actions: [{ id: 'reboot', label: 'Send reboot', correct: true }, { id: 'more', label: 'Ask for more data' }, { id: 'wait', label: 'Wait it out' }],
    },
  ];
  const OPPORTUNITIES = [
    { id: 'eruption', role: 'scientist', fixRole: 'comms', windowSec: 9, kinds: ['earth', 'moon', 'planet'], title: 'Something is happening below!', alarm: 'Sensors flagged something once-in-a-decade. Point everything at it?', fix: 'Scientist needs a downlink slot right now for a rare event. Give it to them!', actions: [{ id: 'give', label: 'Give the slot', correct: true }, { id: 'hold', label: 'Hold the schedule' }, { id: 'nope', label: 'Ignore it' }], bonus: 0.12 },
    { id: 'dsnSlot', role: 'comms', fixRole: 'planner', windowSec: 8, kinds: ['earth', 'moon', 'planet'], title: 'Free antenna time', alarm: 'Another mission cancelled its slot. Free ground-station time on offer!', fix: 'Take the free station time before someone else does!', actions: [{ id: 'accept', label: 'Accept', correct: true }, { id: 'refuse', label: 'Decline' }, { id: 'later', label: 'Ask for next month' }], bonus: 0.08 },
  ];

  // ---------- Secret agendas ----------
  const AGENDAS = [
    { id: 'many_instruments', role: 'scientist', title: 'Instrument collector', text: 'Fly with 3 or more instruments.', conflictsWith: 'engineer' },
    { id: 'full_duty', role: 'scientist', title: 'Never stop observing', text: 'Run the instruments 90% of the time.', conflictsWith: 'comms' },
    { id: 'power_margin', role: 'engineer', title: 'Power reserve', text: 'Keep 20% power margin.', conflictsWith: 'scientist' },
    { id: 'battery_safe', role: 'engineer', title: 'Never below 40%', text: 'Keep the battery above 40% the whole flight.', conflictsWith: 'scientist' },
    { id: 'two_stations', role: 'comms', title: 'Two ground stations', text: 'Use 2 or more ground stations.', conflictsWith: 'planner' },
    { id: 'no_spill', role: 'comms', title: 'Not a bit spilled', text: 'Lose no data to a full recorder.', conflictsWith: 'scientist' },
    { id: 'under_budget', role: 'planner', title: 'Under budget', text: 'Finish under {pct}% of the budget.', conflictsWith: 'comms' },
    { id: 'lean_rocket', role: 'planner', title: 'Cheapest rocket', text: 'Launch on the smallest rocket that lifts it.', conflictsWith: 'engineer' },
  ];

  // ---------- Obituaries: the real mission that died the same way ----------
  const ANALOGS = {
    power: { mission: 'Mars Global Surveyor', year: 2006, story: 'A memory-load command sent to the wrong address started a chain of faults, and its batteries ran flat within about 11 hours. NASA lost it after nine years at Mars.', source: 'https://www.scientificamerican.com/article/human-error-caused-mars-g/' },
    drag: { mission: 'Skylab', year: 1979, story: 'A busier Sun puffed up the air high above Earth, the drag grew, and the station fell before the first Shuttle was ready to boost it.', source: 'https://www.nasa.gov/history/45-years-ago-skylab-reenters-earths-atmosphere/' },
    radiation: { mission: 'Telstar 1', year: 1963, story: 'Launched by NASA in 1962, it flew into belts of radiation swollen by a high-altitude nuclear test. Its transistors gave up within months.', source: 'https://www.scientificamerican.com/article/how-us-accidentally-nuked-own-communications-satellite' },
    overflow: { mission: 'Spirit rover', year: 2004, story: 'Its flash memory got so full of files that the computer rebooted over and over. Engineers deleted thousands of files to save it. Unlike you, it got to carry on.', source: 'https://www.planetary.org/articles/0126_spirit_is_in_recovery' },
    comms: { mission: 'Galileo', year: 1991, story: 'Its big antenna would not open: 134,000 bits per second became a trickle. Clever compression and linked ground antennas lifted it to about 1,000 bits per second and saved most of the science.', source: 'https://llis.nasa.gov/lesson/492' },
    insertion: { mission: 'Mars Observer', year: 1993, story: 'Lost days before arrival, most likely when fuel lines ruptured as the tanks were pressurised. It never fired its engine at Mars.', source: 'https://www.jpl.nasa.gov/news/potential-causes-of-the-loss-of-mars-observer-identified/' },
    nav: { mission: 'Mars Climate Orbiter', year: 1999, story: 'One team used pounds, the other used newtons. It came in far too low and was destroyed in the Martian air.', source: 'https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf' },
    attitude: { mission: 'Kepler', year: 2013, story: 'A second reaction wheel failed and the planet hunter could not hold still any more. Engineers invented a clever new way to keep going, as K2, for more than four more years.', source: 'https://spacepolicyonline.com/news/kepler-down-but-not-out/' },
    computer: { mission: 'Mars Polar Lander', year: 1999, story: 'Software mistook the shake of its landing legs for touchdown and shut the engines off about 40 m up. The test that could have caught it was run with wired-wrong sensors.', source: 'https://ntrs.nasa.gov/api/citations/20000061966/downloads/20000061966.pdf' },
    flaw: { mission: 'Hubble', year: 1990, story: 'A test tool about a millimetre out of place meant the mirror was ground to the wrong shape. Other tests had warned about it. Astronauts fixed it in 1993.', source: 'https://science.nasa.gov/mission/hubble/observatory/design/optics/hubbles-mirror-flaw/' },
    breakup: { mission: 'CONTOUR', year: 2002, story: 'It broke up during its big rocket burn, most likely overheated by its own exhaust. Nobody could watch because no radio was planned during the burn.', source: 'https://nssdc.gsfc.nasa.gov/planetary/text/contour_pr_20031015.txt' },
    budget: { mission: 'Pioneer 10', year: 1997, story: 'Still working, 10 billion kilometres out, but routine tracking stopped in 1997 because the budget ran out.', source: 'https://nssdc.gsfc.nasa.gov/planetary/text/pioneer_10-11_status_971201.txt' },
    silence: { mission: 'Genesis', year: 2004, story: 'Its parachute switches were installed upside down, and a test that could have caught it was skipped. It hit the Utah desert at speed, but some science was saved.', source: 'https://appel.nasa.gov/2011/08/29/ata_4-6_genesis_launches-html/' },
    deploy: { mission: 'Beagle 2 (ESA)', year: 2003, story: 'Found in 2015 by a NASA orbiter, sitting on Mars with its solar panels only partly opened, so its antenna never showed.', source: 'https://sci.esa.int/web/mars-express/-/55263-beagle-2-lander-found-on-mars' },
  };

  // Crew-themed surface causes (see chain/obituary in sim.js).
  const SURFACE_ANALOGS = {
    crew_lost: { mission: 'Apollo 13 (the near miss)', year: 1970, story: 'An oxygen tank blew up on the way to the Moon. The crew made it home only because a team on the ground treated oxygen and power like every last gram mattered.', source: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/ap13acc.html' },
    oxygen: { mission: 'Apollo 13', year: 1970, story: 'The oxygen tank exploded 56 hours in. The crew lived on the lunar module’s supplies and came home.', source: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/ap13acc.html' },
    stranded: { mission: 'Genesis', year: 2004, story: 'The return capsule worked perfectly until the very last step: the parachute. Getting home is always the hard part.', source: 'https://appel.nasa.gov/2011/08/29/ata_4-6_genesis_launches-html/' },
    base_dark: { mission: 'Opportunity', year: 2018, story: 'A planet-wide dust storm blotted out the Sun and the solar-powered rover never woke up again.', source: 'https://skyandtelescope.org/astronomy-news/opportunity-end-long-road/' },
    data_left: { mission: 'Genesis', year: 2004, story: 'It brought solar wind home through three years in space, then crashed in the desert. The samples were cracked but much of the science was saved.', source: 'https://appel.nasa.gov/2011/08/29/ata_4-6_genesis_launches-html/' },
  };

  // Epitaphs: funny and kind. One per cause; {x} filled in from the flight.
  const EPITAPHS = {
    power: ['Here lies a spacecraft that believed in itself all the way to sundown.', 'Ran out of electricity {when}. Passed peacefully in the shade.'],
    drag: ['Fell for the planet. Fell a lot.', 'Brought an atmosphere to a fuel fight.'],
    radiation: ['Glowed a little, near the end.', 'It was the electrons, officer.'],
    overflow: ['Full of data, and that was the problem.', 'Remembered everything. Sent none of it.'],
    comms: ['Spoke softly. Nobody could hear it.', 'The most successful mission nobody ever heard about.'],
    insertion: ['Arrived at speed. Left at speed.', 'Waved at the planet on the way past.'],
    nav: ['Took the scenic route, and the scenery won.', 'Pounds, newtons, who is counting.'],
    attitude: ['Spent its last days staring at nothing in particular.', 'Pointed the wrong way at all the right moments.'],
    computer: ['Have you tried turning it off and on again? It did. Forever.', 'Blue-screened, a long way from anyone who could help.'],
    flaw: ['There was a tiny flaw. There is always a tiny flaw.', 'Passed every test it was given. It was not given the right tests.'],
    breakup: ['Came apart in the end, like all good stories.', 'Every part still works. Separately.'],
    budget: ['Killed by a spreadsheet.', 'Money ran out before the mission did.'],
    silence: ['Went quiet. We still talk about it, though.', 'Gone, but the data rate never was.'],
    deploy: ['Almost opened up. So close.', 'Unfolded exactly most of the way.'],
    crew_lost: ['Eaten at the {where}. Should have packed the bigger battery.', 'They scanned one more rock. It was worth it. It was not worth it.', 'Survived by {survivors} crewmates who owe them a sandwich.'],
    oxygen: ['Took one last breath of the good stuff.', 'Should have packed 45 more kilograms of air.'],
    stranded: ['Stayed behind to look after the samples. And the rover. And forever.', 'They did not throw enough science overboard.'],
    base_dark: ['The base went dark, and then the base had guests.', 'Should have packed a bigger battery. Should have packed a much bigger battery.'],
    data_left: ['Got everything. Sent nothing.', 'The science of the century, still safe on the recorder, still in orbit.'],
  };

  // ---------- Consequence-chain strings (English; keys team.chain.*) ----------
  const STR = {
    'chain.root.part': '{name}: {massText} and {costText}',
    'chain.root.swap': 'Chose {name} instead of {alt}: {massText} and {costText}',
    'chain.root.power': '{name} instead of {alt}: {deltaW} less power',
    'chain.root.plain': 'You picked {name}, not {alt}',
    'chain.root.without': 'You flew without the {name}',
    'chain.root.took': 'You took the {name} along',
    'chain.root.with': '{text}: {diff}',
    'chain.diff.heavier': '{n} kg heavier',
    'chain.diff.lighter': '{n} kg lighter',
    'chain.diff.dearer': '${n}M more',
    'chain.diff.cheaper': '${n}M less',
    'chain.diff.and': ' and ',
    'chain.why.mass': 'Every kilogram has to be carried. That part of your choice shows up everywhere.',
    'chain.prop': 'Fuel {sign}{kg} kg',
    'chain.why.prop': 'Heavier craft need more fuel, and the extra fuel is itself more mass to push. That is the rocket equation.',
    'chain.launcher': 'Needs the {to}: {sign}${cost}M',
    'chain.why.launcher': 'The rocket has to lift the whole stack to this orbit. Bigger stack, bigger rocket, bigger bill.',
    'chain.budget': 'Budget left: ${left}M. Could not afford {part}.',
    'chain.why.budget': 'Money spent on mass is money you cannot spend on anything else.',
    'chain.power': 'Battery covered {pct}% of the eclipse',
    'chain.why.power': 'Eclipse lasts {mins} min. The battery must hold every watt-hour the craft uses in the dark.',
    'chain.brownout': 'Brown-out in the dark at orbit {orbit}: instruments off',
    'chain.why.brownout': 'With an empty battery the spacecraft sheds load to stay alive, and science stops.',
    'chain.data.gen': 'Instruments made {gen} Gbit a day; the radio could send {cap} Gbit a day',
    'chain.why.data': 'Data rate falls with the square of the distance. {dist}. Everything you cannot send waits in the recorder.',
    'chain.overflow': 'Recorder full: {lost} Gbit spilled away',
    'chain.why.overflow': 'A recorder holds only what fits between passes. New data has nowhere to go.',
    'chain.lostfrac': '{pct}% of the data never came home',
    'chain.why.lostfrac': 'Science only counts if it gets home.',
    'chain.science': 'Science reached {sci}% of the goal',
    'chain.why.science': 'Your requirement sets what counts as success.',
    'chain.gain': 'With {alt}, the same flight reached {sci}% (science {delta})',
    'chain.why.gain': 'Same mission, same seed, one decision reverted. This is what the simulation says.',
    'chain.death': '{cause}',
    'chain.why.death': 'See the mission report for what happened in the final seconds.',
    'chain.crisis': 'Missed crisis: {title}',
    'chain.why.crisis': 'The alarm was on one phone and the fix on another. Somebody had to yell.',
    'chain.radiation': 'Radiation dose {dose} krad against {shield} krad of shielding',
    'chain.why.radiation': 'Close to Jupiter, particles punch through electronics. Dose adds up every day.',
    'chain.fuel': 'Fuel ran out {days} days before the end',
    'chain.why.fuel': 'Low orbits need small burns to stay up. No fuel, no burns.',
    'chain.rad.lifetime': 'Radiation limit: electronics last {max} years',
    'chain.link': 'Antenna: {dish} m at {au} AU',
    'chain.surface.radio': 'Second radio cut to save {kg} kg',
    'chain.surface.uplink': 'Uplink {pct}% slower',
    'chain.why.uplink': 'Dish size and radio power set the speed of the data home, on the surface too.',
    'chain.surface.overrun': 'Dish overrun in wave {wave}',
    'chain.surface.lost': '{sets} data set(s) lost',
    'chain.why.surface.overrun': 'Slower uplink means more time holding the dish against the swarm.',
    'chain.surface.battery': 'Base power: {w} W for {load} W of load',
    'chain.surface.dark': 'The lights went out at night',
    'chain.why.surface.dark': 'No sun at night. A small battery means the shield, lights and heaters die first.',
    'chain.surface.ascent': 'Rocket could lift {lift} kg of the {have} kg of samples',
    'chain.surface.dropped': 'Left {kg} kg of samples behind',
    'chain.why.surface.ascent': 'Rocket equation again: every kilo of samples needs fuel brought all the way from Earth.',
    'chain.surface.oxygen': 'Oxygen ran out with {sec} s left on the clock',
    'chain.why.surface.oxygen': 'Air is mass. Every spare day is 45 kg you left on Earth.',
    'chain.surface.cause': 'Surface: {cause}',
    'chain.surface.root': '{name} packed instead of {alt}: {kg} kg saved',
    'chain.surface.eaten': 'The crew were overrun at the {where}',
    'chain.why.surface.root': 'Everything you bring has mass. Everything you leave behind might have saved you.',
    'cause.power': 'Battery ran flat',
    'cause.drag': 'Dragged out of orbit',
    'cause.radiation': 'Radiation killed the electronics',
    'cause.insertion': 'Missed the orbit burn',
    'cause.computer': 'Computer lost',
    'cause.attitude': 'Lost the ability to point',
    'cause.flaw': 'A hidden flaw',
    'cause.breakup': 'Broke up',
    'cause.comms': 'Could not get data home',
    'cause.budget': 'Ran out of money',
    'cause.none': 'Mission complete',
    'cause.overflow': 'Recorder overflowed',
    'cause.crew_lost': 'Crew lost on the surface',
    'cause.oxygen': 'Oxygen ran out',
    'cause.stranded': 'Stranded on the surface',
    'cause.base_dark': 'The base went dark',
    'cause.data_left': 'The data never got home',
    'cause.nav': 'Wrong orbit',
    'cause.deploy': 'Panels never opened',
    'check.launcher': 'Launcher can lift this to orbit',
    'check.launcher.bad': '{rocket} lifts {cap} kg to this orbit, you need {need} kg. Cut mass or pick a bigger rocket.',
    'check.launcher.routeOnly': 'A shared ride only goes to a sun-synchronous orbit.',
    'check.budget': 'Under budget', 'check.budget.bad': 'Over budget by ${over}M',
    'check.power': 'Enough power', 'check.power.bad': 'Average power falls short by {w} W',
    'check.battery': 'Battery lasts the eclipse', 'check.battery.bad': 'Battery needs {need} Wh, you have {have} Wh',
    'check.comms': 'Data gets home', 'check.comms.bad': 'Instruments make {gen} Gbit/day, you can send {cap}',
    'check.recorder': 'Recorder holds the wait', 'check.recorder.bad': 'Recorder overflows between passes',
    'check.instruments': 'Has an instrument for the objective', 'check.instruments.bad': 'No instrument measures this objective',
    'check.time': 'Ready on time', 'check.time.bad': 'Ready in {months} months, deadline {limit}',
    'check.life': 'Lasts the mission', 'check.life.bad': 'Radiation or drag ends it after {max} years',
    'res.mass.why': 'Whole stack with fuel, against what {rocket} lifts to this orbit.',
    'res.power.why': 'Average over one orbit: sunlight in, everything on board out.',
    'res.budget.why': 'Build {dev} + launch {launch} + operations {ops}.',
    'res.data.why': 'How much waits on board between passes, against the recorder.',
    'res.comms.why': 'What the radio can send each day, against what the instruments make.',
    'res.time.why': 'How long to build, against the launch deadline.',
    'phase.launch': 'Liftoff', 'phase.cruise': 'Cruising', 'phase.insertion': 'Orbit insertion', 'phase.ops': 'Science', 'phase.end': 'Mission over',
    'event.eclipse': 'Battery low in eclipse', 'event.brownout': 'Brown-out: load shed', 'event.overflow': 'Recorder full!', 'event.blackout': 'Sun in the way: no signal',
    'event.dead': 'Signal lost',
    'event.fuelout': 'Orbiter out of fuel: science stops, the lander still goes',
    'best.why': 'Re-flown on the same seed: the score goes up by {gain} with this one change.',
    'best.text': 'Try {to} instead of {from}',
    'best.step': '{step}: try {to} instead of {from}',
    'best.add': '{step}: add the {name}',
    'best.drop': '{step}: leave the {name} at home',
    'medal.gold': 'Gold', 'medal.silver': 'Silver', 'medal.bronze': 'Bronze', 'medal.none': 'No medal',
    'obit.title': 'Here lies {name}',
    'obit.crew': 'The crew of {name}',
    'surface.given': 'The lander and suits are provided by the sponsor. You design everything you bring.',
    'surface.platform.floating': 'A floating cloud-top platform (NASA’s HAVOC concept).',
  };

  // Every English string with its i18n key.
  function strings() {
    const out = [];
    const add = (key, en) => { if (en !== undefined && en !== null) out.push({ key: `team.${key}`, en }); };
    Object.entries(STR).forEach(([k, v]) => add(k, v));
    Object.entries(CARD_STR).forEach(([k, v]) => add(k, v));
    BUILD_STEPS.forEach((st) => {
      add(`step.${st.id}.title`, st.title);
      add(`step.${st.id}.ask`, st.ask);
      (st.packs || []).forEach((pk) => { add(`pack.${st.id}.${pk.id}.name`, pk.name); add(`pack.${st.id}.${pk.id}.note`, pk.note); });
    });
    Object.entries(GROUP_TITLES).forEach(([k, v]) => add(`group.${k}`, v));
    ROLES.forEach((r) => add(`role.${r}`, r[0].toUpperCase() + r.slice(1)));
    DIFFICULTIES.forEach((d) => { add(`diff.${d.id}.title`, d.title); add(`diff.${d.id}.note`, d.note); });
    Object.values(SCENARIOS).forEach((s) => {
      add(`scn.${s.id}.title`, s.title); add(`scn.${s.id}.question`, s.question); add(`scn.${s.id}.objective`, s.objective);
      s.objectives.forEach((o) => add(`scn.${s.id}.obj.${o.id}`, o.title));
      s.requirements.forEach((r) => { add(`scn.${s.id}.req.${r.id}.title`, r.title); add(`scn.${s.id}.req.${r.id}.text`, r.text); });
      s.orbits.forEach((o) => { add(`scn.${s.id}.orbit.${o.id}.name`, o.name); add(`scn.${s.id}.orbit.${o.id}.note`, o.note); });
      s.routes.forEach((o) => { add(`scn.${s.id}.route.${o.id}.name`, o.name); add(`scn.${s.id}.route.${o.id}.note`, o.note); });
    });
    Object.entries(COMMON).forEach(([g, list]) => {
      if (!Array.isArray(list)) return;
      list.forEach((o) => { add(`opt.${g}.${o.id}.name`, o.name); add(`opt.${g}.${o.id}.note`, o.note); });
    });
    LAUNCHERS.forEach((o) => { add(`opt.launcher.${o.id}.name`, o.name); add(`opt.launcher.${o.id}.note`, o.note); });
    Object.entries(INSTRUMENTS).forEach(([id, i]) => { add(`instr.${id}.name`, i.name); add(`instr.${id}.note`, i.note); });
    Object.values(SCENARIOS).forEach((s) => s.panels.forEach((p) => { add(`opt.panels.${p.id}.name`, p.name); add(`opt.panels.${p.id}.note`, p.note); }));
    CRISES.concat(OPPORTUNITIES).forEach((c) => {
      add(`crisis.${c.id}.title`, c.title); add(`crisis.${c.id}.alarm`, c.alarm); add(`crisis.${c.id}.fix`, c.fix);
      c.actions.forEach((a) => add(`crisis.${c.id}.action.${a.id}`, a.label));
    });
    AGENDAS.forEach((a) => { add(`agenda.${a.id}.title`, a.title); add(`agenda.${a.id}.text`, a.text); });
    FLAWS.forEach((f) => add(`flaw.${f.id}`, f.text));
    Object.entries(Object.assign({}, ANALOGS, SURFACE_ANALOGS)).forEach(([k, a]) => add(`analog.${k}.story`, a.story));
    Object.entries(EPITAPHS).forEach(([k, list]) => list.forEach((e, i) => add(`epitaph.${k}.${i}`, e)));
    return out.filter((x, i, a) => a.findIndex((y) => y.key === x.key) === i);
  }

  SMD.team.data = { BUILD_STEPS, CARD_STR, SCAN_FITS, UPLINK_WINDOWS, ROLES, KEY_ROLE, SURFACE_KEYS, GROUP_TITLES, INSTRUMENTS, COMMON, LAUNCHERS, SCENARIOS, DIFFICULTIES, FLAWS, CRISES, OPPORTUNITIES, AGENDAS, ANALOGS, SURFACE_ANALOGS, EPITAPHS, STR, strings, SRC, captureDv, G0 };
  if (typeof module === 'object' && module.exports) module.exports = SMD.team.data;
})();
