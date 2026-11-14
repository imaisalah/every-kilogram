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
    cubesat: 'https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf',
    smallsat: 'https://www.nasa.gov/smallsat-institute/sst-soa/',
    thermal: 'https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/',
  };

  const ROLES = ['planner', 'engineer', 'scientist', 'comms'];

  // Surface gear that fights (weapons, turrets, drones, medkits, rovers) is gone (TEAM-V2):
  // the crew carries only oxygen, fuel to get home and a drill that pulls ice cores.
  const KEY_ROLE = {
    orbit: 'planner', launcher: 'planner', route: 'planner', lifetime: 'planner', schedule: 'planner', ascent: 'planner',
    structure: 'engineer', panels: 'engineer', batteries: 'engineer', adcs: 'engineer', computer: 'engineer', propMargin: 'engineer', oxygen: 'engineer', thermal: 'engineer',
    instruments: 'scientist', duty: 'scientist', processing: 'scientist', drill: 'scientist',
    antenna: 'comms', radio: 'comms', ground: 'comms', coding: 'comms', recorder: 'comms',
  };
  const SURFACE_KEYS = ['ascent', 'oxygen', 'drill'];

  const GROUP_TITLES = {
    orbit: 'Orbit', launcher: 'Rocket', route: 'Route', lifetime: 'Mission length', schedule: 'Build schedule', ascent: 'Fuel to get home',
    structure: 'Structure', panels: 'Power source', batteries: 'Batteries', adcs: 'Pointing', computer: 'Flight computer', propMargin: 'Spare fuel', oxygen: 'Spare oxygen', thermal: 'Thermal control',
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
    // CubeSat-scale instruments (the CubeSat scenario only). Masses and powers are
    // typical of flown CubeSat payloads (NASA Small Spacecraft Technology State of the Art).
    cubeWide: { name: 'Wide-field camera', mass: 0.4, power: 2, rate: 2.5, cost: 0.08, kind: 'wide', needsSun: true, tier: 1, note: 'A phone-sized camera that sees a 100 km strip. Fields are just a few pixels.', source: SRC.smallsat },
    cubeCam: { name: 'Four-colour camera', mass: 1.1, power: 4, rate: 12, cost: 0.3, kind: 'optical', needsSun: true, tier: 1, note: 'Sees a 5 m patch in four colours, enough to tell how green a field is.', source: SRC.smallsat },
    cubeTir: { name: 'Thermal camera', mass: 1.4, power: 6, rate: 3, cost: 0.45, kind: 'ir', needsSun: false, tier: 1, trl: 7, note: 'Measures how warm the ground is. Thirsty plants run hot, day and night.', source: SRC.smallsat },
    cubeHyper: { name: 'Hyperspectral imager', mass: 1.7, power: 8, rate: 24, cost: 0.8, kind: 'optical', needsSun: true, tier: 2, trl: 7, note: 'Hundreds of colours: reads plant health in detail. Floods the radio with data.', source: SRC.smallsat },
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

  // Thermal control (TEAM-V3 item 17). `standard` is exactly the old baseline (the
  // scenario's thermalFrac and heaterW), so designs without a thermal pick fly as before.
  // cap: how harsh a world it can handle (scenario thermalNeed 0.5 mild .. 0.9 harsh);
  // ageMult: how fast panels and batteries age (hot-cold swings wear parts out).
  COMMON.thermal = [
    { id: 'blanket', name: 'Blankets and paint', massMult: 0.55, heaterMult: 0.3, powerW: 0, costM: 0, cap: 0.55, ageMult: 1.5, tier: 2, trl: 9, note: 'Gold blankets and white paint. Light and needs no power, but weak where it is very cold or very hot.', source: SRC.thermal },
    { id: 'standard', name: 'Heaters and a radiator', massMult: 1, heaterMult: 1, powerW: 0, costM: 0, cap: 1, ageMult: 1, tier: 1, trl: 9, note: 'Thermostat heaters and a radiator panel: the usual way.', source: SRC.thermal },
    { id: 'louvres', name: 'Louvres and heat pipes', massMult: 1.8, heaterMult: 1.4, powerW: 8, costM: 3, cap: 1.6, ageMult: 0.5, tier: 2, trl: 9, note: 'Shutters and heat pipes keep every part at its favourite temperature. Heavy, but parts age half as fast.', source: SRC.thermal },
  ];
  // Technology readiness of the parts that are not flight-proven many times (default 9).
  [['processing', 'smart', 7], ['recorder', 'rec4096', 7], ['structure', 'vault150', 6], ['drill', 'deep', 6], ['oxygen', 'o2', 8], ['antenna', 'a03', 9]].forEach(([k, id, trl]) => {
    const o = COMMON[k] && COMMON[k].find((x) => x.id === id);
    if (o) o.trl = trl;
  });

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

  // ---------- CubeSat 101 (TEAM-V3 item 15) ----------
  // A 6U or 12U CubeSat watching the Nile from low Earth orbit. Everything is
  // CubeSat scale: kilograms, watts and thousands of dollars ($0.3M = $300k).
  // The ride is a slot on a rideshare (NASA CubeSat 101; ELaNa / CSLI).
  const keep = (key, id, extra) => ({ ...COMMON[key].find((o) => o.id === id), ...extra, source: SRC.smallsat });
  SCENARIOS.cubesat = {
    id: 'cubesat', title: 'CubeSat over the Nile', kind: 'earth', dest: 'earth', training: true, surface: null, cubesat: true,
    budgetM: 3.1, deadlineMonths: 18, devBase: 12, opsPerYear: 0.12, busCost: 0.7, devPerKg: 0.05, latePerMonth: 0.25, thermalFrac: 0.02, heaterW: 1, busW: 5, au: 1,
    rateMult: 1, busKg: 4.2, engineKg: 0, noPropulsion: true, linkK: 6e-8, maxInstrumentKg: 2,
    question: 'Farmers along the Nile need a cheap eye in the sky. Can a satellite the size of a shoebox tell them which fields are thirsty?',
    objective: 'Map crop health along the Nile with a CubeSat.',
    linkMode: 'near',
    noCrises: ['fuelLeak'],
    objectives: [
      { id: 'green', title: 'How green each field is', instruments: { cubeCam: 1, cubeHyper: 1, cubeWide: 0.35 } },
      { id: 'thirst', title: 'Which fields are thirsty (too warm)', instruments: { cubeTir: 1, cubeHyper: 0.4 } },
      { id: 'weekly', title: 'The whole valley, every week', instruments: { cubeWide: 1, cubeCam: 0.5 } },
    ],
    requirements: [
      { id: 'green', title: 'Crop health map', text: 'How green is every field?', weights: { green: 0.6, thirst: 0.15, weekly: 0.25 }, needs: { green: 2300, thirst: 550, weekly: 1550 } },
      { id: 'thirst', title: 'Thirsty fields', text: 'Which fields need water now?', weights: { green: 0.25, thirst: 0.6, weekly: 0.15 }, needs: { green: 2300, thirst: 840, weekly: 1550 } },
    ],
    orbits: [
      orbitEarth({ id: 'iss', name: 'Space station orbit, 415 km', altKm: 415, launchFactor: 1, insertionDv: 0, dvPerYear: 0, radKrad: 1, dragYears: 1.2, revisitDays: 5, fit: { optical: 1.1, wide: 0.9, ir: 1.05 }, passes: { perStation: 4, passMin: 7 }, note: 'Pushed out of the space station. An easy ride, but thin air pulls it down in about a year.', tier: 1, source: SRC.cubesat }),
      orbitEarth({ id: 'sso525', name: 'Sun-synchronous, 525 km', altKm: 525, launchFactor: 1, insertionDv: 0, dvPerYear: 0, radKrad: 1.5, dragYears: 6, revisitDays: 4, fit: { optical: 1, wide: 1, ir: 1 }, passes: { perStation: 4, passMin: 9 }, note: 'Where rideshares drop most CubeSats. Same light every day, lasts for years.', tier: 1, source: SRC.cubesat }),
      orbitEarth({ id: 'geo', name: 'Geostationary, 35,786 km', altKm: 35786, launchFactor: 0.02, insertionDv: 1.75, dvPerYear: 0, radKrad: 8, dragYears: 200, rangeKm: 38000, revisitDays: 0.05, eclipseOverride: 0.05, fit: { optical: 0.12, wide: 0.6, ir: 0.6 }, passes: { continuous: true }, note: 'Hangs over Egypt all day. Far beyond any CubeSat ride.', tier: 1, lockAlways: 'A rideshare drops CubeSats in low orbit, and a CubeSat has no engine to climb 36,000 km.' }),
    ],
    routes: [{ id: 'rideshare', name: 'Rideshare launch', costMult: 1, capacityMult: 1, tier: 1, note: 'Your CubeSat rides in a dispenser next to dozens of others.', source: SRC.cubesat }],
    lifetimes: [{ id: 'm6', years: 0.5, tier: 1 }, { id: 'y1', years: 1, tier: 1 }, { id: 'y2', years: 2, tier: 1 }, { id: 'y3', years: 3, tier: 2 }],
    instruments: ['cubeCam', 'cubeTir', 'cubeWide', 'cubeHyper'],
    panels: [
      { id: 'body', name: 'Cells on the body', areaM2: 0.05, eff: 0.3, kgFixed: 0.2, costFixed: 0.03, tier: 1, note: 'Solar cells glued to the sides. Nothing to unfold, not much power.' },
      { id: 'wings2', name: 'Two fold-out wings', areaM2: 0.14, eff: 0.3, kgFixed: 0.5, costFixed: 0.08, tier: 1, note: 'Wings that spring open in orbit. The usual 6U choice.' },
      { id: 'wings4', name: 'Four fold-out wings', areaM2: 0.26, eff: 0.3, kgFixed: 0.95, costFixed: 0.15, tier: 1, note: 'A big cross of panels. Plenty of power, more to go wrong.' },
    ],
    parts: {
      launcher: [
        { id: 'slot6', name: '6U slot on a rideshare', leo: 12, c0: 12, scale: 1, costM: 0.3, tier: 1, u: 6, note: 'A 6U CubeSat: two milk cartons. Up to 12 kg.', source: SRC.cubesat },
        { id: 'slot12', name: '12U slot on a rideshare', leo: 24, c0: 24, scale: 1, costM: 0.55, tier: 1, u: 12, note: 'A 12U CubeSat: twice the room. Up to 24 kg.', source: SRC.cubesat },
        { id: 'dedicated', name: 'Your own small rocket', leo: 200, c0: 200, scale: 1, costM: 7.5, tier: 1, note: 'Any orbit, any day, and a bill twenty times bigger.', source: SRC.launchers },
      ],
      structure: [keep('structure', 'standard', { frac: 0.15, mass: 0, costM: 0.02, shieldKrad: 12 })],
      batteries: [
        { id: 'b10', name: '10 Wh battery', wh: 10, mass: 0.08, costM: 0.005, tier: 2, note: 'A few phone batteries. Only just enough.' },
        { id: 'b20', name: '20 Wh battery', wh: 20, mass: 0.15, costM: 0.01, tier: 1, note: 'The usual CubeSat battery pack.' },
        { id: 'b40', name: '40 Wh battery', wh: 40, mass: 0.3, costM: 0.02, tier: 1, note: 'Room for the instruments to keep working in the dark.' },
        { id: 'b80', name: '80 Wh battery', wh: 80, mass: 0.6, costM: 0.04, tier: 3, note: 'Heavy for a CubeSat.' },
      ],
      adcs: [keep('adcs', 'magnet', { mass: 0.15, powerW: 0.5, costM: 0.04 }), keep('adcs', 'wheels', { mass: 0.7, powerW: 2, costM: 0.15 }), keep('adcs', 'star', { mass: 1, powerW: 3, costM: 0.35 })],
      computer: [keep('computer', 'single', { mass: 0.1, powerW: 0.4, costM: 0.02 }), keep('computer', 'dual', { mass: 0.2, powerW: 0.8, costM: 0.04 }), keep('computer', 'radhard', { mass: 0.3, powerW: 1, costM: 0.25 })],
      processing: [keep('processing', 'raw', { powerW: 0 }), keep('processing', 'compress', { powerW: 0.4 }), keep('processing', 'smart', { powerW: 1.2 })],
      propMargin: [{ id: 'mnone', name: 'No propulsion', frac: 0, tier: 1, note: 'Most CubeSats have no engine at all.' }],
      antenna: [
        { id: 'whip', name: 'UHF whip antenna', diaM: 0.05, mass: 0.05, costM: 0.005, tier: 1, note: 'A tape-measure strip that springs out.' },
        { id: 'patch', name: 'Patch antenna', diaM: 0.1, mass: 0.1, costM: 0.02, tier: 1, note: 'A flat square on one face.' },
        { id: 'dish05', name: '0.5 m fold-out dish', diaM: 0.5, mass: 1.5, costM: 0.3, tier: 3, trl: 7, note: 'Unfolds like an umbrella (RainCube flew one).' },
      ],
      radio: [
        { id: 'uhf', name: 'UHF radio', rfW: 1, dcW: 3, mass: 0.1, costM: 0.01, maxMbps: 0.0096, tier: 1, note: 'Hobby-radio band. Commands, not pictures.' },
        { id: 'sband', name: 'S-band radio', rfW: 2, dcW: 8, mass: 0.2, costM: 0.05, maxMbps: 2, tier: 1, note: 'A couple of megabits a second.' },
        { id: 'xband', name: 'X-band radio', rfW: 4, dcW: 15, mass: 0.3, costM: 0.15, maxMbps: 100, tier: 1, trl: 8, note: 'Fast, power hungry while it talks.' },
      ],
      recorder: [
        { id: 'rec8', name: '8 Gbit memory card', gbit: 8, mass: 0.02, costM: 0.003, tier: 1, note: 'Fills fast.' },
        { id: 'rec32', name: '32 Gbit memory card', gbit: 32, mass: 0.04, costM: 0.006, tier: 1, note: 'A day of pictures.' },
        { id: 'rec128', name: '128 Gbit recorder', gbit: 128, mass: 0.1, costM: 0.02, tier: 1, note: 'Plenty between passes.' },
      ],
      ground: [
        { id: 'gu1', name: 'One university station', stations: 1, nearPerYear: 0.02, deepPerYear: 0.02, tier: 1, note: 'A dish on a campus roof in Egypt. A few passes a day.' },
        { id: 'gu2', name: 'Two stations', stations: 2, nearPerYear: 0.06, deepPerYear: 0.06, tier: 1, note: 'Rent time on a second station abroad.' },
        { id: 'gu3', name: 'A worldwide network', stations: 3, nearPerYear: 0.18, deepPerYear: 0.18, tier: 2, note: 'Pay per pass on stations all over the world.' },
      ],
      thermal: [keep('thermal', 'blanket', { costM: 0 }), keep('thermal', 'standard', { costM: 0 }), keep('thermal', 'louvres', { costM: 0.05, powerW: 0.5 })],
    },
    packs: {
      radio: [
        { id: 'uhf', name: 'UHF whip and radio', note: 'Tiny and cheap. Fine for commands, far too slow for pictures.', picks: { antenna: 'whip', radio: 'uhf' } },
        { id: 'sband', name: 'S-band patch and radio', note: 'The common CubeSat link: a few megabits a second.', picks: { antenna: 'patch', radio: 'sband' } },
        { id: 'xband', name: 'X-band patch and radio', note: 'Up to 100 megabits a second. Drinks power while it talks.', picks: { antenna: 'patch', radio: 'xband' } },
      ],
    },
    stepText: { rocket: { title: 'Bus and ride', ask: 'Which slot on which rocket carries your CubeSat?' } },
    starter: { orbit: 'sso525', launcher: 'slot6', lifetime: 'y2', panels: 'wings2', batteries: 'b20', instruments: ['cubeWide'], duty: 'd60', antenna: 'patch', radio: 'sband', ground: 'gu1', recorder: 'rec32', structure: 'standard', adcs: 'wheels', computer: 'single', propMargin: 'mnone', processing: 'compress', thermal: 'standard' },
  };
  // Keep the destinations in order: the Earth training flights first.
  ['moon', 'mars', 'venus', 'europa'].forEach((k) => {
    const v = SCENARIOS[k];
    delete SCENARIOS[k];
    SCENARIOS[k] = v;
  });

  // ---------- Science traceability (TEAM-V3 item 3) ----------
  // NASA "Design and Develop Science Missions": science need -> mission goal ->
  // science objectives -> measurement requirements -> mission requirements -> concept.
  // Plain words. thermalNeed: how harsh the world is for electronics (0.5 mild .. 0.9).
  const TRACE = {
    nile: {
      need: 'Egypt grows its food along the Nile, and water is scarce. Farmers need to know which fields are thirsty.', target: 'the farm fields', thermalNeed: 0.5, thermalEnv: 'mild',
      measure: { fields: 'Pictures that show single fields, a few metres per pixel', water: 'Infrared light that shows which plants are short of water', whole: 'The whole valley, seen every few days' },
      concept: 'An Earth-watching satellite in a low orbit photographs the valley and sends the pictures to a station in Egypt.',
    },
    storms: {
      need: 'Dust storms close roads and airports and make people ill. Egypt needs a warning before they arrive.', target: 'the dust storms', thermalNeed: 0.5, thermalEnv: 'mild',
      measure: { storms: 'Infrared pictures that show dust in the air, day and night', fronts: 'Wide pictures that show the edge of a storm as it moves' },
      concept: 'A weather-style satellite watches North Africa and sends warnings home quickly.',
    },
    cubesat: {
      need: 'Small farms cannot pay for a big satellite. A cheap shoebox-sized one could still tell them which fields are thirsty.', target: 'the farm fields', thermalNeed: 0.5, thermalEnv: 'mild',
      measure: { green: 'Pictures in four colours that show how green each field is', thirst: 'Heat pictures: thirsty fields are warmer', weekly: 'Every field seen at least once a week' },
      concept: 'A 6U or 12U CubeSat rides to low orbit on a shared rocket, photographs the valley and talks to a university station in Egypt.',
    },
    moon: {
      need: 'Future Moon bases need water, and carrying it from Earth is very expensive.', target: 'the dark polar craters', thermalNeed: 0.8, thermalEnv: 'cold',
      measure: { hydrogen: 'Count neutrons from the ground to map hydrogen, a sign of water', craters: 'Radar echoes from craters that never see the Sun', images: 'Pictures of crater floors, lit by starlight or laser' },
      concept: 'An orbiter on a low polar orbit maps the ice; then a crew lander goes down to sample it.',
    },
    mars: {
      need: 'Astronauts on Mars will need water to drink and to make fuel.', target: 'the buried ice', thermalNeed: 0.75, thermalEnv: 'cold',
      measure: { ice: 'Radar echoes from ice 1 to 100 m under the dust', sites: 'Pictures sharp enough to see a 1 m boulder', hydrogen: 'Count neutrons to map hydrogen in the top metre' },
      concept: 'An orbiter maps the ice from above and relays data; a crew lands near the ice and drills it.',
    },
    venus: {
      need: 'Venus was once like Earth. Is it still volcanically alive? That tells us how planets change.', target: 'the surface under the clouds', thermalNeed: 0.85, thermalEnv: 'hot',
      measure: { map: 'Radar pictures through the clouds, to compare with Magellan’s', rocks: 'The infrared glow of the surface rock at night', gravity: 'Tiny changes in the radio signal that show the pull of gravity' },
      concept: 'A radar orbiter maps the planet; a crew on a floating platform samples the cloud chemistry.',
    },
    europa: {
      need: 'Europa may hide a salty ocean: one of the best places to look for life beyond Earth.', target: 'the ice shell', thermalNeed: 0.9, thermalEnv: 'cold',
      measure: { shell: 'Radar echoes through kilometres of ice', ocean: 'The magnetic field bent by a salty ocean', surface: 'Close pictures of the cracks and ridges' },
      concept: 'A spacecraft loops around Jupiter past Europa many times; a crew lands where plume material has fallen.',
    },
  };
  Object.keys(TRACE).forEach((id) => Object.assign(SCENARIOS[id], TRACE[id]));
  SCENARIOS.storms.orbits.find((o) => o.id === 'sso600').lockFor = { early: 'Passes over Egypt only every day and a half: too slow for an early warning.' };

  // Three signature missions (TEAM-V3 item 19): Moon, Mars and the CubeSat each add
  // their own mission requirements, their own crises first in the flight, and (Mars)
  // their own build step. keys are judged in sim.requirementStatus.
  SCENARIOS.moon.extraReqs = [{ key: 'night', text: 'Keep the electronics alive through long eclipses and the cold polar night.', steps: ['thermal', 'batteries'], segment: 'space' }];
  SCENARIOS.moon.crisisSet = ['lunarEclipse'];
  SCENARIOS.mars.extraReqs = [
    { key: 'arrive', text: 'Arrive safely and land close to the ice: the arrival and the orbit set how close.', steps: ['route', 'orbit'], segment: 'space' },
    { key: 'dust', text: 'Keep a power reserve for dust storms that dim the Sun.', steps: ['power', 'batteries'], segment: 'space' },
  ];
  SCENARIOS.mars.crisisSet = ['dustStorm'];
  SCENARIOS.mars.routeStep = true;
  SCENARIOS.cubesat.extraReqs = [
    { key: 'box', text: 'Fit everything into a 6U or 12U box and its rideshare slot.', steps: ['rocket', 'instruments'], segment: 'launch' },
    { key: 'databudget', text: 'Send every picture home through a radio the size of a deck of cards.', steps: ['radio', 'ground', 'recorder'], segment: 'ground' },
  ];
  SCENARIOS.cubesat.crisisSet = ['tumble'];

  // Mission requirements every mission shares; {primary} and {target} come from the scenario.
  const MISSION_REQS = [
    { key: 'measure', text: 'Carry instruments for the top objective: {primary}.', steps: ['instruments'], segment: 'space' },
    { key: 'view', text: 'Fly an orbit that sees {target} well.', steps: ['orbit'], segment: 'space' },
    { key: 'power', text: 'Make enough power, in sunlight and in the dark.', steps: ['power', 'batteries', 'thermal'], segment: 'space' },
    { key: 'data', text: 'Get all the science data home to Earth.', steps: ['radio', 'ground', 'recorder'], segment: 'ground' },
    { key: 'life', text: 'Keep working for the whole mission.', steps: ['lifetime', 'computer', 'thermal'], segment: 'space' },
    { key: 'launch', text: 'Fit on one rocket and inside the budget.', steps: ['rocket'], segment: 'launch' },
    { key: 'land', text: 'Land near the {site}, and bring the crew and samples home.', steps: ['landing', 'orbit'], segment: 'space', landing: true },
  ];

  // The four mission segments (NASA "Design and Develop Science Missions").
  const SEGMENTS = [
    { id: 'launch', title: 'Launch segment', blurb: 'The rocket that puts it all in space.' },
    { id: 'space', title: 'Space segment', blurb: 'The spacecraft, its instruments and its orbit.' },
    { id: 'ground', title: 'Ground segment', blurb: 'The stations and the team on Earth that run the mission.' },
    { id: 'user', title: 'User segment', blurb: 'The scientists who use what comes home.' },
  ];

  // Concept maturity depth by difficulty (inspired by JPL's Concept Maturity Levels).
  const CML = {
    cadet: { level: '1–2', name: 'Idea and feasibility', what: 'Plain choices with simple pros and cons: can it work at all?', depth: 1 },
    engineer: { level: '3', name: 'Trade space', what: 'Real specs on every card: compare the options and choose.', depth: 2 },
    director: { level: '4', name: 'Point design', what: 'One detailed design: margins, backups, ageing, readiness, cost confidence and how each requirement is checked.', depth: 3 },
  };
  CML.sandbox = CML.director;

  // How each step's requirement is verified before launch (CML 4 cards).
  const VERIFY = {
    orbit: 'Analysis: an orbit simulation', power: 'Test: lamps shine on the panels', batteries: 'Test: charge and drain cycles', thermal: 'Test: a thermal vacuum chamber',
    instruments: 'Test: calibrate against known targets', radio: 'Test: a radio link end to end', ground: 'Demonstration: a pass with the real station', recorder: 'Test: fill it and read it back',
    computer: 'Test: inject faults on purpose', lifetime: 'Analysis: wear and radiation models', landing: 'Test: drop and fuel-burn tests', rocket: 'Analysis: loads during launch',
  };
  // Where a part has flown before (Engineer cards), by its source.
  const HERITAGE = {
    mro: 'Mars Reconnaissance Orbiter (2005)', landsat: 'Landsat 9 (2021)', lro: 'Lunar Reconnaissance Orbiter (2009)', clipper: 'Europa Clipper (2024)', vault: 'Europa Clipper (2024)',
    magellan: 'Magellan (1989)', rtg: 'Curiosity and Perseverance', dsn: 'NASA Deep Space Network', link: 'NASA Deep Space Network', galileo: 'Galileo (1989)', artemis: 'Artemis II',
    launchers: 'NASA launch services', cubesat: 'NASA CubeSat Launch Initiative', smallsat: 'Flown on many CubeSats', thermal: 'Flown on almost every spacecraft',
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
    { id: 'orbit', keys: ['orbit'], role: 'planner', tier: 1, segment: 'space', title: 'Orbit', ask: 'Where will your spacecraft fly?', res: ['mass', 'power', 'comms'] },
    { id: 'route', keys: ['route'], role: 'planner', tier: 2, segment: 'space', routeOnly: true, title: 'Arrival', ask: 'How will you slow down when you arrive?', res: ['mass', 'budget', 'time'] },
    { id: 'power', keys: ['panels'], role: 'engineer', tier: 1, segment: 'space', title: 'Power', ask: 'How will it make electricity?', res: ['power', 'mass', 'budget'] },
    { id: 'batteries', keys: ['batteries'], role: 'engineer', tier: 2, segment: 'space', title: 'Batteries', ask: 'How will it get through the dark?', res: ['power', 'mass', 'budget'] },
    { id: 'thermal', keys: ['thermal'], role: 'engineer', tier: 2, segment: 'space', title: 'Thermal control', ask: 'How will it stay not too hot and not too cold?', res: ['power', 'mass', 'budget'] },
    { id: 'instruments', keys: ['instruments'], role: 'scientist', tier: 1, segment: 'space', multi: true, title: 'Instruments', ask: 'What will it measure?', res: ['mass', 'power', 'data'] },
    {
      id: 'radio', keys: ['antenna', 'radio'], role: 'comms', tier: 1, segment: 'space', title: 'Antenna & radio', ask: 'How will the data get home?', res: ['comms', 'power', 'mass'],
      packs: [
        { id: 'small', name: 'Small dish, small radio', note: 'Light and cheap. Slow from far away.', picks: { antenna: 'a1', radio: 'r25' } },
        { id: 'mid', name: 'Medium dish, strong radio', note: 'A good middle choice.', picks: { antenna: 'a2', radio: 'r50' } },
        { id: 'big', name: 'Big dish, loud radio', note: 'Fast data home. Heavy and hungry for power.', picks: { antenna: 'a3', radio: 'r100' } },
      ],
    },
    { id: 'ground', keys: ['ground'], role: 'comms', tier: 2, segment: 'ground', title: 'Ground stations', ask: 'Who on Earth will listen?', res: ['comms', 'data', 'budget'] },
    { id: 'recorder', keys: ['recorder'], role: 'comms', tier: 2, segment: 'space', title: 'Data recorder', ask: 'How much can it remember between calls home?', res: ['data', 'mass', 'budget'] },
    {
      id: 'computer', keys: ['computer', 'adcs'], role: 'engineer', tier: 3, segment: 'space', title: 'Computer & pointing', ask: 'How steady, and how tough?', res: ['mass', 'power', 'budget'],
      packs: [
        { id: 'basic', name: 'One computer, magnets', note: 'Cheap and rough. Pictures blur a little.', picks: { computer: 'single', adcs: 'magnet' } },
        { id: 'standard', name: 'One computer, reaction wheels', note: 'The usual: steady enough for most jobs.', picks: { computer: 'single', adcs: 'wheels' } },
        { id: 'tough', name: 'Hardened computer, star trackers', note: 'Takes radiation and points precisely. Expensive.', picks: { computer: 'radhard', adcs: 'star' } },
      ],
    },
    { id: 'lifetime', keys: ['lifetime'], role: 'planner', tier: 2, segment: 'ground', title: 'Mission length', ask: 'How long will it work?', res: ['budget', 'time'] },
    {
      id: 'landing', keys: ['ascent', 'oxygen', 'drill'], role: 'scientist', tier: 1, segment: 'space', landing: true, title: 'Landing kit', ask: 'What do you carry down to the surface?', res: ['mass', 'budget'],
      packs: [
        { id: 'light', name: 'Crew only', note: 'The lander gets you home. No samples, no spare air.', picks: { ascent: 'a0', oxygen: 'o0', drill: 'hand' } },
        { id: 'balanced', name: 'Some samples, spare air', note: 'Fuel for a few samples and a day of spare oxygen.', picks: { ascent: 'a60', oxygen: 'o1', drill: 'hand' } },
        { id: 'heavy', name: 'Big haul, deep drill', note: 'Fuel for a big load of samples and a drill that reaches real ice.', picks: { ascent: 'a150', oxygen: 'o2', drill: 'deep' } },
      ],
    },
    { id: 'rocket', keys: ['launcher'], role: 'planner', tier: 1, segment: 'launch', title: 'Rocket', ask: 'Which rocket can lift all of it?', res: ['mass', 'budget'] },
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

  // ---------- v3 build strings (keys team.*; docs/TEAM-V3.md "As built (v3: build)") ----------
  const V3_STR = {
    'card.thermal.cold': 'Too cold in the dark: parts shut down',
    'card.thermal.hot': 'Overheats in the sunlight',
    'card.thermal.ok': 'Keeps every part in its safe range',
    'card.thermal.age': 'Parts age half as fast',
    'card.thermal.wear': 'Hot-cold swings wear parts faster',
    'card.ground.hours': '{h} hours of contact a day',
    'card.ground.wait': 'Long waits between calls home',
    'card.ride.slot': 'Fits a {u}U CubeSat',
    'lock.orbit': 'From the {orbit} it would see almost nothing.',
    'lock.dish': 'Needs a {n} m dish or bigger (Antenna & radio).',
    'lock.big': 'Too big for a CubeSat: {kg} kg.',
    'lock.useless': 'Measures nothing that “{req}” asks for.',
    'spec.height': 'Height', 'spec.period': 'One lap', 'spec.dark': 'In the dark', 'spec.heritage': 'Flown on', 'spec.area': 'Panel area', 'spec.eff': 'Efficiency',
    'spec.makes': 'Makes here', 'spec.mass': 'Mass', 'spec.power': 'Power', 'spec.data': 'Data', 'spec.energy': 'Energy', 'spec.density': 'Energy per kg', 'spec.heater': 'Heaters',
    'spec.dish': 'Antenna', 'spec.rf': 'Radio power', 'spec.rate': 'Data rate', 'spec.stations': 'Stations', 'spec.contact': 'Contact', 'spec.yearly': 'Running cost',
    'spec.capacity': 'Holds', 'spec.pointing': 'Pointing', 'spec.rad': 'Radiation it takes', 'spec.years': 'Length', 'spec.ops': 'Operations', 'spec.fuel': 'Ascent fuel',
    'spec.sci': 'Science value', 'val.sci': '{n}% of the goal',
    'spec.lift': 'Lifts home', 'spec.air': 'Spare air', 'spec.drill': 'Drill', 'spec.cost': 'Cost', 'spec.liftorbit': 'Lifts to this orbit', 'spec.dose': 'Radiation dose',
    'val.km': '{n} km', 'val.kmkm': '{a} × {b} km', 'val.min': '{n} min', 'val.hours': '{n} h', 'val.days': '{n} days', 'val.pct': '{n}%', 'val.m2': '{n} m²', 'val.w': '{n} W',
    'val.wh': '{n} Wh', 'val.whkg': '{n} Wh/kg', 'val.kg': '{n} kg', 'val.gbd': '{n} Gb a day', 'val.m': '{n} m', 'val.mbps': '{n} Mbit/s', 'val.hday': '{n} h a day',
    'val.money': '${n}M', 'val.moneyk': '${n}k', 'val.peryear': '{m} a year', 'val.gbit': '{n} Gbit', 'val.krad': '{n} krad', 'val.krady': '{n} krad a year', 'val.years': '{n} years', 'val.year1': '1 year',
    'val.months': '{n} months', 'val.rtg': '{n} nuclear batteries', 'val.uses': '{a} W (uses {b} W)', 'val.none': 'None', 'val.n': '{n}',
    'point.rough': 'Rough', 'point.steady': 'Steady', 'point.precise': 'Very steady',
    'det.margin.power': 'Power margin', 'det.margin.battery': 'Battery margin', 'det.margin.mass': 'Mass margin', 'det.margin.thermal': 'Thermal margin',
    'det.margin.comms': 'Downlink margin', 'det.margin.data': 'Recorder margin', 'det.margin.life': 'Lifetime margin',
    'det.redundancy': 'Backup', 'det.degrade': 'Over the mission', 'det.trl': 'Readiness (TRL)', 'det.cost': 'Cost confidence', 'det.verify': 'Verified by',
    'red.wings': 'Two wings: one failure loses half', 'red.rtg': 'Many thermocouples: fades, never fails at once', 'red.cells': 'Several cell strings: one bad cell costs a little',
    'red.passive': 'Nothing that can break', 'red.heaters': 'Heaters on two circuits', 'red.inst': 'One unit, no spare', 'red.lga': 'Plus a small backup antenna',
    'red.stations': '{n} stations: one can be down', 'red.station1': 'One station: if it is down, no contact', 'red.rec': 'Two memory banks', 'red.dual': 'A second computer takes over',
    'red.single': 'One computer: no backup', 'red.rocket': 'A flight-proven rocket', 'red.orbit': 'Spare fuel for corrections', 'red.ops': 'The team on the ground', 'red.air': 'Spare air is the backup',
    'deg.panels': '{w} W at the end ({pct}% lost)', 'deg.rtg': 'Steady output (simplified)', 'deg.battery': '{wh} Wh at the end ({pct}% lost)', 'deg.thermal.fast': 'Parts age 1.5 times as fast',
    'deg.thermal.normal': 'Normal ageing', 'deg.thermal.slow': 'Parts age half as fast', 'deg.rad': 'Radiation: {dose} of {limit} krad by the end', 'deg.drag': 'Air drag pulls it down after {n} years',
    'trl.9': '9 of 9: flown many times', 'trl.8': '8 of 9: qualified for flight', 'trl.7': '7 of 9: prototype tested in space', 'trl.6': '6 of 9: prototype tested on the ground',
    'cost.10': '±10%: well known', 'cost.25': '±25%: some unknowns', 'cost.50': '±50%: could surprise you',
    'det.verify.val': '{how} ({mr})',
    'cml.label': 'Concept maturity {level}', 'cml.short': 'CML {level}',
    'mr.met': 'Met', 'mr.missed': 'Not met',
    'mr.why.measure.ok': 'Your instruments cover it', 'mr.why.measure.bad': 'No instrument measures it',
    'mr.why.measure.flown': '{pct}% of the science goal came home',
    'mr.why.view.ok': 'The instruments see well from this orbit', 'mr.why.view.bad': 'Poor view from this orbit', 'mr.why.view.far': 'It lands far from the {target}',
    'mr.why.power.ok': 'Enough power, day and night', 'mr.why.power.flat': 'Ran flat {n} times in the dark',
    'mr.why.data.ok': '{pct}% of the data came home', 'mr.why.data.bad': '{pct}% of the data never came home',
    'mr.why.life.ok': 'Worked for the whole mission', 'mr.why.life.bad': 'Stopped after {pct}% of the mission',
    'mr.why.launch.ok': 'One rocket, inside the budget',
    'mr.why.land.ok': 'Crew home with samples', 'mr.why.land.empty': 'Crew home, but no samples', 'mr.why.land.lost': 'The crew did not all get home', 'mr.why.land.notyet': 'Decided on the surface',
    'score.axis.requirements': 'Mission requirements', 'score.axis.science': 'Science returned', 'score.axis.efficiency': 'Efficiency', 'score.axis.teamwork': 'Teamwork',
    'score.why.requirements': '{a} of {b} mission requirements met', 'score.why.science': 'What came home, against the goal', 'score.why.efficiency': 'Money, mass and data used well', 'score.why.teamwork': 'Problems fixed, asks answered, hidden goals',
    'score.item.orbit': 'Science from orbit: {pct}% of the goal', 'score.item.surface': 'Science on the surface: {pct}%', 'score.item.budget': 'Budget left: {left}',
    'score.item.over': 'Over budget: efficiency × 0.3', 'score.item.mass': 'Spare lift on the rocket: {n} kg', 'score.item.data': 'Data that got home: {pct}%',
    'score.item.crises': 'Problems fixed: {a} of {b}', 'score.item.crises.none': 'No problems in flight', 'score.item.requests': 'Asks and suggestions answered: {a} of {b}', 'score.item.requests.none': 'No asks sent',
    'score.item.agendas': 'Hidden goals met: {a} of {b}', 'score.item.agendas.none': 'No hidden goals',
    'outcome.full': 'Full success', 'outcome.partial': 'Partial success', 'outcome.fail': 'Science missed', 'outcome.lost': 'Mission lost',
    'outcome.adjust': 'Outcome rule',
    'outcome.why.full': 'A full success always scores at least 750.', 'outcome.why.partial': 'A partial success scores from 450 to 749.',
    'outcome.why.fail': 'A mission that missed its science scores at most 449.', 'outcome.why.lost': 'A lost mission scores at most 299, so it never beats one that came home.',
    'crew.orbit': '{option}: the best view for our instruments.',
    'crew.orbit.land': '{option}: it reaches the {target}, and the instruments see well.',
    'crew.power': 'I fitted {option}: {w} W, enough for everything on board.',
    'crew.batteries': 'I fitted the {option} so we survive the night.',
    'crew.thermal.cold': '{option}: it keeps the electronics warm through the cold.',
    'crew.thermal.hot': '{option}: it keeps us cool this close to the Sun.',
    'crew.thermal.mild': '{option}: enough, this close to home.',
    'crew.instruments': 'I packed the {list}: they answer “{req}”.',
    'crew.radio': '{option}: it sends {home} Gb a day home, and we make {gen}.',
    'crew.ground': '{option}: {h} hours of contact a day.',
    'crew.recorder': 'The {option} holds everything between calls home.',
    'crew.computer': '{option}: steady enough, and tough enough for the radiation here.',
    'crew.lifetime': '{option}: time for the science, and we can pay for it.',
    'crew.landing': '{option}: fuel to lift {lift} kg of samples home.',
    'crew.landing.none': '{option}: the lander gets us home.',
    'crew.rocket': 'The {option} lifts us with {spare} kg to spare. The cheapest one that can.',
    'crew.rocket.none': 'Nothing lifts this yet. I booked the {option}; we have to cut mass.',
    'crew.pick': 'I picked {option}.',
    'crew.adjust': 'The {step} changed, so I switched to {option}.',
    'crew.yes.better': 'Good call: the flight comes out {n} points better.',
    'crew.yes.fix': 'Good call: {check}.',
    'crew.yes.same': 'Fine by me: it works about as well.',
    'crew.no.check': 'Not that one: {check}.',
    'crew.no.worse': 'Not that one: the flight comes out {n} points worse.',
    'crew.no.locked': 'Not that one: {reason}',
    'crew.no.error': 'That does not fit this ship.',
    'check.thermal': 'Stays at a safe temperature', 'check.thermal.cold': 'Too cold in the dark: parts will shut down', 'check.thermal.hot': 'Overheats in the sunlight',
    'event.thermal.cold': 'Too cold in the dark: instruments off to keep warm', 'event.thermal.hot': 'Overheating: instruments throttled',
    'chain.thermal.cold': 'Too cold in every eclipse: the instruments switched off to keep warm',
    'chain.thermal.hot': 'Too hot in the sunlight: the instruments were throttled',
    'chain.why.thermal': 'Electronics only work between about −20 and +50 °C. Blankets alone cannot hold that here.',
    'card.route.risk': 'Risky: a small chance to lose the craft',
    'card.route.slow': '{n} months longer to arrive',
    'card.route.fuel': 'Saves {n} kg of fuel',
    'proof.measure': '{pct}% of “{req}” covered', 'proof.view': 'Instruments see {pct}% as well as the best orbit', 'proof.power': '{in} W made for {load} W used; battery {wh} of {need} Wh',
    'proof.data': 'Sends {down} Gb a day for {gen} Gb made; recorder {rec} Gbit', 'proof.life': 'Lasts {max} for a {life} mission', 'proof.launch': '{wet} of {cap} kg; {cost} of {budget}',
    'proof.land': 'Lifts {lift} kg of samples; lands {where}', 'proof.night': 'Thermal margin {th}; battery {wh} of {need} Wh', 'proof.arrive': 'Lands within {m} m; arrival risk {risk}%',
    'proof.dust': 'Power margin {pct}% (dust needs 30%)', 'proof.box': '{kg} kg in a {u}U slot (max {cap} kg)', 'proof.databudget': 'Sends {down} Gb a day for {gen} Gb made',
    'proof.near': 'near the {site}', 'proof.far': 'far from the {site}', 'proof.long': 'more than 10 years',
    'mr.why.night.cold': 'Too cold in the dark', 'mr.why.arrive.far': 'Lands too far from the ice', 'mr.why.arrive.risky': 'Aerobraking risk is high', 'mr.why.dust.low': 'Too little power to spare for a dust storm',
    'mr.why.box.big': 'Too heavy for its slot', 'mr.why.ok': 'Verified',
    'review.verify': 'Verification', 'chain.reentry': 'The air pulled it down {days} days before the end',
    'chain.why.reentry': 'Low orbits still have a trace of air. It slowly drags a satellite down, and a CubeSat has no engine to climb back up.',
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
  // Signature crises (TEAM-V3 item 19): only on their own mission (scenario crisisSet).
  const SIGNATURE_CRISES = [
    {
      id: 'lunarEclipse', role: 'planner', fixRole: 'engineer', windowSec: 9, weight: 1, only: ['moon'],
      title: 'Long eclipse!', alarm: 'The Earth is sliding in front of the Sun: hours of darkness ahead.', fix: 'Long eclipse: put the heaters in survival mode!',
      actions: [{ id: 'survive', label: 'Survival mode', correct: true }, { id: 'full', label: 'Full power' }, { id: 'open', label: 'Open the shutters' }],
    },
    {
      id: 'dustStorm', role: 'scientist', fixRole: 'engineer', windowSec: 9, weight: 1, only: ['mars'],
      title: 'Global dust storm', alarm: 'Mars is vanishing under dust. Every picture is orange.', fix: 'Dust storm: aim the panels at the Sun and cut the load!',
      actions: [{ id: 'track', label: 'Aim panels, cut load', correct: true }, { id: 'wait', label: 'Carry on' }, { id: 'burn', label: 'Burn engine' }],
    },
    {
      id: 'tumble', role: 'comms', fixRole: 'engineer', windowSec: 8, weight: 1, only: ['cubesat'],
      title: 'Tumbling!', alarm: 'The CubeSat is spinning after it left the rocket. The radio fades in and out.', fix: 'Tumbling: switch on the magnetorquers to stop the spin!',
      actions: [{ id: 'detumble', label: 'Detumble', correct: true }, { id: 'reboot', label: 'Reboot radio' }, { id: 'deploy', label: 'Open the panels' }],
    },
  ];
  CRISES.push(...SIGNATURE_CRISES);
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
    Object.entries(V3_STR).forEach(([k, v]) => add(k, v));
    MISSION_REQS.forEach((m) => add(`mr.${m.key}`, m.text));
    SEGMENTS.forEach((g) => { add(`seg.${g.id}.title`, g.title); add(`seg.${g.id}.blurb`, g.blurb); });
    Object.entries(CML).forEach(([k, c]) => { add(`cml.${k}.name`, c.name); add(`cml.${k}.what`, c.what); });
    Object.entries(VERIFY).forEach(([k, v]) => add(`verify.${k}`, v));
    Object.entries(HERITAGE).forEach(([k, v]) => add(`her.${k}`, v));
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
      ['need', 'target', 'concept'].forEach((f) => add(`scn.${s.id}.${f}`, s[f]));
      (s.extraReqs || []).forEach((m) => add(`scn.${s.id}.mr.${m.key}`, m.text));
      Object.entries(s.measure || {}).forEach(([k, v]) => add(`scn.${s.id}.measure.${k}`, v));
      s.orbits.forEach((o) => { add(`scn.${s.id}.orbit.${o.id}.lock`, o.lockAlways); Object.entries(o.lockFor || {}).forEach(([r, v]) => add(`scn.${s.id}.orbit.${o.id}.lock.${r}`, v)); });
      Object.entries(s.stepText || {}).forEach(([k, v]) => { add(`scn.${s.id}.step.${k}.title`, v.title); add(`scn.${s.id}.step.${k}.ask`, v.ask); });
      Object.entries(s.packs || {}).forEach(([k, list]) => list.forEach((pk) => { add(`pack.${k}.${pk.id}.name`, pk.name); add(`pack.${k}.${pk.id}.note`, pk.note); }));
      Object.entries(s.parts || {}).forEach(([g, list]) => list.forEach((o) => { add(`opt.${g}.${o.id}.name`, o.name); add(`opt.${g}.${o.id}.note`, o.note); }));
      s.lifetimes.filter((l) => l.years < 1).forEach((l) => add(`opt.lifetime.${l.id}.name`, `${Math.round(l.years * 12)} months`));
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

  SMD.team.data = { BUILD_STEPS, CARD_STR, V3_STR, MISSION_REQS, SEGMENTS, CML, VERIFY, HERITAGE, SCAN_FITS, UPLINK_WINDOWS, ROLES, KEY_ROLE, SURFACE_KEYS, GROUP_TITLES, INSTRUMENTS, COMMON, LAUNCHERS, SCENARIOS, DIFFICULTIES, FLAWS, CRISES, OPPORTUNITIES, AGENDAS, ANALOGS, SURFACE_ANALOGS, EPITAPHS, STR, strings, SRC, captureDv, G0 };
  if (typeof module === 'object' && module.exports) module.exports = SMD.team.data;
})();
