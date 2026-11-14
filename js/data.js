// Game content: missions, parts, tests and flaws. Numbers are simplified but
// kept in the range of real missions (sources noted in README).
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});

  const PROJECT_START = Date.UTC(2026, 10, 15); // the hackathon weekend

  const MISSIONS = {
    nile: {
      key: 'nile',
      dest: 'earth',
      kind: 'earth',
      level: 'First mission',
      title: 'Nile from orbit',
      headline: 'Satellite maps every field along the Nile',
      question: 'Farmers need to know which fields are thirsty. Can we watch every field from space?',
      scienceOrbit: { label: '600 km polar orbit', rpAlt: 600, raAlt: 600 },
      maintDv: 0.04,
      turns: 6, // first results inside the first 18 months of the career
      turnDays: 30,
      flybyDuty: 1,
      arrayFactor: 0.62, // a third of every orbit is in Earth's shadow
      heaterW: 10,
      thermalFrac: 0.04,
      thermalRisk: 0,
      radiation: false,
      events: ['solarStorm'],
      objectives: [
        { id: 'fields', label: 'Sharp images of every field, every week', weight: 70, needGbit: 1250, key: true, instruments: { hires: 1, context: 1 } },
        { id: 'water', label: 'Which crops are thirsty (infrared)', weight: 30, needGbit: 200, instruments: { irspec: 1 } },
      ],
    },
    weather: {
      key: 'weather',
      dest: 'earth',
      kind: 'earth',
      level: 'First mission',
      title: 'Storm watcher',
      headline: 'New satellite warns of dust storms days earlier',
      question: 'Dust storms sweep across Egypt every spring. Can we see them coming?',
      scienceOrbit: { label: '800 km polar orbit', rpAlt: 800, raAlt: 800 },
      maintDv: 0.04,
      turns: 6, // first results inside the first 18 months of the career
      turnDays: 30,
      flybyDuty: 1,
      arrayFactor: 0.62,
      heaterW: 10,
      thermalFrac: 0.04,
      thermalRisk: 0,
      radiation: false,
      events: ['solarStorm'],
      objectives: [
        { id: 'storms', label: 'Infrared images of dust in the air', weight: 70, needGbit: 350, key: true, instruments: { irspec: 1 } },
        { id: 'clouds', label: 'Wide views of clouds and dust fronts', weight: 30, needGbit: 400, instruments: { context: 1, hires: 0.5 } },
      ],
    },
    moon: {
      key: 'moon',
      dest: 'moon',
      kind: 'moon',
      level: 'Next step',
      title: 'Lunar water hunter',
      headline: 'Ice found in the Moon’s shadowed craters',
      question: 'Future Moon bases need water. Is there ice in craters that never see sunlight?',
      scienceOrbit: { label: '100 km polar orbit', rpAlt: 100, raAlt: 100 },
      maintDv: 0.12,
      turns: 12,
      turnDays: 30,
      flybyDuty: 1,
      vinf: 0.85,
      tofDays: 5,
      arrayFactor: 0.7,
      heaterW: 30,
      thermalFrac: 0.05,
      thermalRisk: 0.04,
      radiation: false,
      events: ['solarStorm'],
      objectives: [
        { id: 'hydrogen', label: 'Hydrogen map of the poles', weight: 40, needGbit: 40, key: true, instruments: { neutron: 1 } },
        { id: 'craters', label: 'Radar echoes from dark craters', weight: 35, needGbit: 900, instruments: { sounder: 1, iceRadar: 1 } },
        { id: 'images', label: 'Images of crater floors', weight: 25, needGbit: 1200, instruments: { hires: 1, context: 0.4 } },
      ],
    },
    mars: {
      key: 'mars',
      dest: 'mars',
      kind: 'planet',
      title: 'Mars ice mapper',
      level: 'Starter',
      headline: 'Buried ice mapped where the first crews could land',
      question: 'Astronauts will need water. Where is ice hiding just under the Martian dust?',
      budgetM: 430,
      scienceOrbit: { label: '300 km circular orbit', rpAlt: 300, raAlt: 300 },
      captureOrbit: { label: '300 × 45,000 km ellipse', rpAlt: 300, raAlt: 45000 },
      aerobrake: { days: 150, finishDv: 0.1, note: 'Mars Reconnaissance Orbiter dipped into the thin air about 400 times to shrink its orbit.' },
      maintDv: 0.06,
      turns: 12,
      turnDays: 30,
      flybyDuty: 1,
      refVinf: 2.65,
      refC3: 8.7,
      tofRange: [120, 400],
      c3Display: 40,
      arrayFactor: 1,
      heaterW: 30,
      thermalFrac: 0.05,
      thermalRisk: 0,
      radiation: false,
      events: ['dustStorm', 'solarStorm'],
      objectives: [
        { id: 'ice', label: 'Radar sounding of buried ice', weight: 50, needGbit: 1800, key: true, instruments: { sounder: 1, iceRadar: 0.8 } },
        { id: 'sites', label: 'Sharp images of candidate landing sites', weight: 30, needGbit: 4000, instruments: { hires: 1, context: 0.35 } },
        { id: 'hydrogen', label: 'Hydrogen map of the top metre of soil', weight: 20, needGbit: 30, instruments: { neutron: 1 } },
      ],
    },
    venus: {
      key: 'venus',
      dest: 'venus',
      kind: 'planet',
      title: 'Venus radar mapper',
      level: 'Intermediate',
      headline: 'New radar map shows how Venus has changed since the 1990s',
      question: 'Magellan mapped Venus 30 years ago. Is the planet still erupting today?',
      budgetM: 590,
      scienceOrbit: { label: '250 km circular orbit', rpAlt: 250, raAlt: 250 },
      captureOrbit: { label: '250 × 60,000 km ellipse', rpAlt: 250, raAlt: 60000 },
      aerobrake: { days: 180, finishDv: 0.12, note: 'Magellan tested aerobraking at Venus in 1993; VERITAS plans to use it too.' },
      maintDv: 0.08,
      turns: 12,
      turnDays: 30,
      flybyDuty: 1,
      refVinf: 2.75,
      refC3: 6.3,
      tofRange: [80, 260],
      c3Display: 40,
      arrayFactor: 0.3, // panels tilted away from the Sun to stay cool (Magellan made ~1 kW from 12.6 m²)
      heaterW: 0,
      thermalFrac: 0.09, // sunshades and radiators
      thermalRisk: 0.12,
      radiation: false,
      events: ['solarStorm', 'hotPass'],
      objectives: [
        { id: 'map', label: 'Radar map to compare with Magellan', weight: 50, needGbit: 12000, key: true, instruments: { sar: 1 } },
        { id: 'rocks', label: 'Infrared map of surface rock types', weight: 30, needGbit: 220, instruments: { irspec: 1 } },
        { id: 'gravity', label: 'Gravity field: what lies under the crust', weight: 20, needGbit: 12, instruments: { uso: 1 } },
      ],
    },
    jupiter: {
      key: 'jupiter',
      dest: 'jupiter',
      kind: 'planet',
      title: 'Europa ice explorer',
      level: 'Advanced',
      headline: "First radar answer: how thick is Europa's ice?",
      question: 'An ocean hides under Europa’s ice. Is the shell thin enough to ever reach it?',
      budgetM: 950,
      scienceOrbit: { label: '5 × 150 Jupiter-radii orbit with Europa flybys', rpAlt: 5 * 71492 - 71492, raAlt: 150 * 71492 - 71492 },
      captureOrbit: null,
      aerobrake: null,
      maintDv: 0.15, // flyby tour targeting
      turns: 12,
      turnDays: 28, // a Europa flyby about every four weeks; science ends inside the career
      flybyDuty: 0.25, // instruments mostly observe during Europa flybys
      refVinf: 5.65,
      refC3: 35,
      tofRange: [600, 1300],
      c3Display: 120,
      arrayFactor: 0.9, // cold, dim light
      heaterW: 70,
      thermalFrac: 0.06,
      thermalRisk: 0.08,
      radiation: true,
      events: ['solarStorm', 'radiationStorm'],
      objectives: [
        { id: 'shell', label: "Radar sounding of Europa's ice shell", weight: 45, needGbit: 400, key: true, instruments: { iceRadar: 1, sounder: 0.4 } },
        { id: 'ocean', label: 'Magnetic clues to the ocean’s depth and saltiness', weight: 30, needGbit: 3.7, instruments: { mag: 1 } },
        { id: 'surface', label: 'Close-up images of the cracked surface', weight: 25, needGbit: 320, instruments: { hires: 1, context: 0.5 } },
      ],
    },
    // A crewed lunar flyby modelled on Artemis II (1–10 April 2026): four
    // astronauts, a free-return loop 6,545 km past the far side, home in about
    // 9 days. The crew rides it in the "ride" screen. Crew safety dominates the
    // score: a lost crew scores nothing (see SMD.ops.crewFlight).
    crew: {
      key: 'crew',
      dest: 'moon',
      kind: 'crew',
      level: 'Crewed',
      title: 'Crew around the Moon',
      headline: 'Four astronauts fly around the Moon and come home safe',
      question: 'No one has flown beyond low Earth orbit since 1972. Can our capsule carry four people around the Moon and bring them home?',
      scienceOrbit: { label: 'Free-return loop, 6,545 km past the far side', rpAlt: 6545, raAlt: 6545 },
      maintDv: 0,
      turns: 1,
      turnDays: 9,
      flybyDuty: 1,
      tofDays: 9.06, // 9 days, 1 hour, 32 minutes from launch to splashdown
      vinf: 0,
      arrayFactor: 0.9,
      heaterW: 4500, // cabin, air and water: the crew's life support draws power all the time
      thermalFrac: 0,
      thermalRisk: 0.02,
      radiation: false,
      budgetM: 1300,
      launchers: ['superheavy'], // only a crew-rated super heavy rocket can lift the stack
      events: ['solarStorm'],
      objectives: [
        { id: 'home', label: 'Bring the crew home safely', weight: 55, key: true, crew: true, instruments: {} },
        { id: 'farside', label: 'Photos of the Moon’s far side', weight: 25, crew: true, instruments: { hires: 1, context: 0.7 } },
        { id: 'life', label: 'Test life support with four people aboard', weight: 20, crew: true, instruments: {} },
      ],
      // Artemis II–like starting point for "Load a proven design".
      proven: { instruments: ['context'], arrays: 24, dish: 1, amp: 25, recorder: 256, avionics: 'dual', launcher: 'superheavy', margin: 10, lifeDays: 21, heatShield: 1350, abort: 1, shelter: 150, entry: 'direct' },
    },
  };

  // Crewed flight: masses, the rocket's job and the real Artemis II numbers.
  // Sources are in content/sources.js (crew*, sls*, orion*, artemis2*).
  const CREW = {
    people: 4,
    crewKg: 100, // per astronaut, with suit and seat liner
    cmBaseKg: 7700, // crew module without heat shield, consumables or crew (Orion CM: ~10,400 kg at launch)
    smBaseKg: 5800, // service module without solar wings or propellant (ESM dry: 6,185 kg)
    lifeKgPerDay: 45, // food, water, oxygen and spares for four, per day of life support
    lasKg: 7700, // launch abort system at liftoff (NASA: about 17,000 lb)
    lasLiftShare: 0.2, // it falls away 3 min 18 s into the climb, so the rocket carries it only part way (game estimate)
    shieldRef: 1125, // kg of ablator that just survives a nominal direct entry from the Moon (game scale)
    dv: { perigee: 0.03, tli: 0.388, tcm: 0.06, reserve: 0.4, leakNeed: 0.22 }, // km/s; TLI 1,274 ft/s on Artemis II; leakNeed: trims still needed after a leak
    missionDays: 9.06,
    reserveDays: 1, // flight rule here: always one spare day of air and water
    speChance: 0.22, // chance of a strong solar particle event during a 9-day trip near solar maximum (game estimate)
    reentryKms: 11.0, // Artemis II: 11,026 m/s, Mach 33
    flybyKm: 6545,
    maxKm: 406771,
    capsuleCost: 220, // $M, crew module and service module structure (game scale)
    costPerKg: 0.004,
    opsFixed: 40, // mission control, recovery ship and helicopters
    devExtraMonths: 4, // crew rating: more reviews, more tests
    timeline: { maxQ: 70, srbSep: 128, las: 198, meco: 486 }, // seconds after liftoff (Artemis II)
  };

  // rate is science data produced per observing day, in gigabits.
  const INSTRUMENTS = {
    hires: { name: 'Telescopic camera', mass: 65, power: 60, rate: 40, cost: 45, flaw: 0.12, blurb: 'Sees a table-sized rock from orbit. Huge pictures, huge data.' },
    context: { name: 'Context camera', mass: 4, power: 8, rate: 4, cost: 6, flaw: 0.06, blurb: 'Wide, light and cheap. Shows the big picture, not the details.' },
    sounder: { name: 'Shallow radar sounder', mass: 17, power: 30, rate: 6, cost: 28, flaw: 0.1, blurb: 'Radio pulses that echo off layers a few hundred metres down.' },
    iceRadar: { name: 'Ice-penetrating radar', mass: 45, power: 70, rate: 8, cost: 50, flaw: 0.14, blurb: 'Two frequencies and long antennas to see through kilometres of ice.' },
    sar: { name: 'Imaging radar (SAR)', mass: 120, power: 320, rate: 60, cost: 95, flaw: 0.15, blurb: 'Maps the ground through thick clouds. Power hungry and data hungry.' },
    irspec: { name: 'Infrared spectrometer', mass: 22, power: 25, rate: 3, cost: 24, flaw: 0.1, blurb: 'Reads rock and ice chemistry from the colours of heat.' },
    neutron: { name: 'Neutron spectrometer', mass: 10, power: 8, rate: 0.15, cost: 12, flaw: 0.06, blurb: 'Counts neutrons leaking from the ground. Hydrogen slows them down.' },
    mag: { name: 'Magnetometer on a boom', mass: 14, power: 4, rate: 0.03, cost: 10, flaw: 0.08, continuous: true, boom: true, blurb: 'A salty ocean bends Jupiter’s magnetic field. This senses that bend.' },
    uso: { name: 'Radio science oscillator', mass: 3, power: 5, rate: 0.04, cost: 7, flaw: 0.05, continuous: true, needsDish: 2, blurb: 'Turns your radio into a gravity meter. Needs a dish of 2 m or more.' },
  };

  const OPTIONS = {
    launcher: [
      { id: 'light', name: 'Light launcher', c0: 1500, scale: 25, leo: 2200, cost: 65 },
      { id: 'medium', name: 'Medium launcher', c0: 6500, scale: 28, leo: 9000, cost: 140 },
      { id: 'heavy', name: 'Heavy launcher', c0: 15000, scale: 30, leo: 22000, cost: 250 },
      // SLS Block 1 class: more than 27 t to the Moon. Crewed missions only.
      { id: 'superheavy', name: 'Super heavy crew launcher', c0: 27000, scale: 30, leo: 95000, cost: 450, crewOnly: true },
    ],
    // Crewed missions only (design fields lifeDays, heatShield, abort, shelter, entry).
    lifeDays: [
      { id: 12, name: '12 days of air and water', mass: 540, cost: 20 },
      { id: 21, name: '21 days of air and water', mass: 945, cost: 35 },
      { id: 30, name: '30 days of air and water', mass: 1350, cost: 50 },
    ],
    heatShield: [
      { id: 1000, name: 'Thin heat shield', mass: 1000, cost: 30 },
      { id: 1350, name: 'Standard heat shield', mass: 1350, cost: 45 },
      { id: 1750, name: 'Thick heat shield', mass: 1750, cost: 60 },
    ],
    abort: [
      { id: 0, name: 'No abort tower', mass: 0, cost: 0 },
      { id: 1, name: 'Launch abort system', mass: 7700, cost: 70 },
    ],
    shelter: [
      { id: 0, name: 'No storm shelter', mass: 0, cost: 0 },
      { id: 150, name: 'Stowage-bag shelter', mass: 150, cost: 2 },
      { id: 600, name: 'Water-wall shelter', mass: 600, cost: 12 },
    ],
    entry: [
      { id: 'skip', name: 'Skip entry', cost: 0 },
      { id: 'direct', name: 'Direct entry', cost: 0 },
    ],
    dish: [
      { id: 1, name: '1 m dish', mass: 8, cost: 3 },
      { id: 2, name: '2 m dish', mass: 22, cost: 7 },
      { id: 3, name: '3 m dish', mass: 45, cost: 13 },
    ],
    amp: [
      { id: 25, name: '25 W radio', mass: 3, dcW: 45, cost: 3 },
      { id: 50, name: '50 W radio', mass: 5, dcW: 90, cost: 5 },
      { id: 100, name: '100 W radio', mass: 9, dcW: 180, cost: 8 },
    ],
    recorder: [
      { id: 64, name: '64 Gbit', mass: 3, cost: 2 },
      { id: 256, name: '256 Gbit', mass: 5, cost: 4 },
      { id: 1024, name: '1 Tbit', mass: 9, cost: 9 },
    ],
    avionics: [
      { id: 'single', name: 'Single computer', mass: 25, cost: 25 },
      { id: 'dual', name: 'Two computers (backup)', mass: 42, cost: 42 },
    ],
    shield: [
      { id: 0, name: 'No vault', cost: 0 },
      { id: 25, name: '25 kg vault', cost: 3 },
      { id: 75, name: '75 kg vault', cost: 9 },
      { id: 150, name: '150 kg vault', cost: 18 },
    ],
    ground: [
      { id: 4, name: '4 h a day', costPerYear: 4 },
      { id: 8, name: '8 h a day', costPerYear: 8 },
      { id: 12, name: '12 h a day', costPerYear: 14 },
    ],
    margin: [0, 10, 20, 30],
  };

  const CONST = {
    isp: 320, // bipropellant engine, seconds
    engineMass: 20,
    tankFrac: 0.07,
    structureFrac: 0.2,
    batteryMass: 20,
    busPowerW: 180,
    arrayKgPerM2: 3.5,
    arrayCostPerM2: 0.45,
    cellEff: 0.28 * 0.85,
    rtg: { mass: 45, watts: 110, cost: 80, devMonths: 3 },
    busCostBase: 70,
    busCostPerKg: 0.11,
    shieldCostPerKg: 0.12,
    opsBasePerYear: 15,
    tcmDv: 0.05,
    egaDsmDv: 0.4,
    egaExtraDays: 790,
    // Data rate (Mbit/s) = K * radioWatts * dish^2 / distanceAU^2
    linkK: 2e-3,
    storagePerMonth: 3.5, // InSight's 26-month slip cost about $150M
    devBaseMonths: 19,
    blackoutDeg: 3,
  };

  // Hidden flaws: base chance a subsystem ships with a defect.
  const SUBSYSTEMS = {
    structure: { name: 'Structure', fix: { cost: 8, months: 1 } },
    deploy: { name: 'Deployables', fix: { cost: 5, months: 0.5 } },
    thermal: { name: 'Thermal control', fix: { cost: 6, months: 0.5 } },
    power: { name: 'Power electronics', fix: { cost: 7, months: 0.5 } },
    avionics: { name: 'Flight software', fix: { cost: 4, months: 0.5 } },
    comms: { name: 'Radio', fix: { cost: 5, months: 0.5 } },
    propulsion: { name: 'Propulsion', fix: { cost: 6, months: 0.5 } },
    radiation: { name: 'Radiation hardness', fix: { cost: 10, months: 1 } },
    instrument: { name: 'Instrument', fix: { cost: 6, months: 1 } },
    // Crewed missions only.
    lifeSupport: { name: 'Life support', fix: { cost: 9, months: 1 } },
    heatShield: { name: 'Heat shield', fix: { cost: 20, months: 3 } },
    ascent: { name: 'Booster separation', fix: { cost: 15, months: 2 } },
  };

  const FLAW_TEXT = {
    structure: 'A bracket has a hidden crack that grows under launch shaking.',
    deploy: 'A hinge sticks when it is cold.',
    thermal: 'A heater controller drifts out of range.',
    power: 'A power regulator overheats under full load.',
    avionics: 'A rare timing bug can make the computer restart over and over.',
    comms: 'The radio amplifier is weaker than its spec sheet.',
    propulsion: 'A valve seal leaks slowly.',
    radiation: 'Some chips flip bits when hit by fast particles.',
    instrument: 'A detector has a wiring fault.',
    lifeSupport: 'A valve in the air and water system sticks after a few days of use.',
    heatShield: 'The heat shield material cannot let its gases out, so it may crack and shed chunks during entry.',
    ascent: 'A booster separation sensor was bent during final assembly.',
  };

  const TESTS = [
    { id: 'vibe', name: 'Shake and sound test', cost: 6, months: 0.5, covers: { structure: 0.8, deploy: 0.35, instrument: 0.5, ascent: 0.4 }, blurb: 'Rattle the spacecraft like a launch does.' },
    { id: 'tvac', name: 'Thermal-vacuum chamber', cost: 10, months: 1, covers: { thermal: 0.85, power: 0.6, comms: 0.5, instrument: 0.3, lifeSupport: 0.6 }, blurb: 'Weeks of space-like cold, heat and vacuum.' },
    { id: 'ditl', name: '“Day in the life” software run', cost: 4, months: 0.5, covers: { avionics: 0.8, comms: 0.4, lifeSupport: 0.3 }, blurb: 'Fly the whole mission on the ground in fast forward.' },
    { id: 'deploy', name: 'Deployment test', cost: 3, months: 0.5, covers: { deploy: 0.85 }, blurb: 'Unfold every panel, dish and boom, then fold them again.' },
    { id: 'hotfire', name: 'Engine hot-fire and leak check', cost: 5, months: 0.25, covers: { propulsion: 0.85, ascent: 0.5 }, blurb: 'Fire the engine and sniff for leaks.' },
    { id: 'rad', name: 'Radiation beam test', cost: 5, months: 0.5, covers: { radiation: 0.8, avionics: 0.2 }, blurb: 'Fire particles at the electronics in an accelerator.' },
  ];

  // ---------- Agency career ----------
  // Tuned with tools/career-sim.cjs; the numbers and the reasons are in docs/BALANCE.md.
  const CAREER = {
    start: Date.UTC(2027, 0, 1),
    end: Date.UTC(2037, 0, 1),
    startMoney: 550, // enough for two first missions, not three
    startScience: 25, // a seed grant: one research choice on day one
    yearlyBase: 200,
    yearlyPerRep: 5, // reputation helps, but late money must still be earned
    startTeams: 2,
    hireTeamCost: 60,
    maxTeams: 3,
  };

  // Each mission on the board: when it unlocks and what it pays back
  // (scaled by how much of the science you return). devFactor scales the
  // development time (19 months for a full planetary spacecraft).
  const CONTRACTS = {
    nile: { unlockRep: 0, reward: { money: 220, rep: 1, science: 40 }, sponsor: 'Ministry of Agriculture', devFactor: 0.25 },
    weather: { unlockRep: 0, reward: { money: 180, rep: 1, science: 40 }, sponsor: 'Meteorological Authority', devFactor: 0.25 },
    moon: { unlockRep: 0, reward: { money: 60, rep: 2, science: 80 }, devFactor: 0.4 },
    mars: { unlockRep: 2, headline: true, reward: { money: 60, rep: 3, science: 100 }, devFactor: 0.65 },
    venus: { unlockRep: 3, headline: true, reward: { money: 60, rep: 3, science: 100 }, devFactor: 0.6 },
    jupiter: { unlockRep: 4, headline: true, needsTech: ['vault'], reward: { money: 100, rep: 4, science: 150 }, devFactor: 0.65 },
    // Late career: a crew needs a proven agency and the heavy-launcher contract.
    crew: { unlockRep: 5, headline: true, needsTech: ['heavy'], sponsor: 'International partners', reward: { money: 120, rep: 4, science: 120 }, lostRep: -3, devFactor: 0.9 },
  };

  // Research you buy with science points.
  const TECH = [
    { id: 'cells', name: 'High-efficiency solar cells', cost: 30, effect: '+30% power from every square metre of panel.' },
    { id: 'lightPanels', name: 'Lightweight panels', cost: 35, effect: 'Solar panels weigh 40% less.' },
    { id: 'dish3', name: 'Deep-space dish', cost: 30, effect: 'Unlocks the 3 m dish: far more data from far away.' },
    { id: 'amp100', name: 'Power amplifier', cost: 20, effect: 'Unlocks the 100 W radio.' },
    { id: 'rec1t', name: 'Big recorder', cost: 15, effect: 'Unlocks the 1 Tbit recorder.' },
    { id: 'dual', name: 'Backup computer', cost: 15, effect: 'Unlocks a second flight computer that takes over if the first fails.' },
    { id: 'aero', name: 'Aerobraking', cost: 30, effect: 'Brake in a planet’s air instead of burning fuel.' },
    { id: 'heavy', name: 'Heavy launcher contract', cost: 40, effect: 'Unlocks the heavy launcher.' },
    { id: 'iceRadar', name: 'Ice-penetrating radar', cost: 35, effect: 'Unlocks the radar that sees through kilometres of ice.' },
    { id: 'sar', name: 'Imaging radar', cost: 35, effect: 'Unlocks the radar that maps ground through thick clouds.' },
    { id: 'vault', name: 'Radiation vault', cost: 40, effect: 'Shields electronics from Jupiter’s radiation belts.' },
    { id: 'rtg', name: 'Nuclear power (RTG)', cost: 60, effect: 'Power that does not fade far from the Sun.' },
    { id: 'testlab', name: 'Better test lab', cost: 25, effect: 'Every test catches more hidden flaws.' },
  ];

  // Test plans you pick for each project.
  const TEST_PLANS = [
    { id: 'basic', name: 'Basic checks', tests: [], blurb: 'Fast and cheap. Hidden flaws fly with you.' },
    { id: 'standard', name: 'Standard tests', tests: ['vibe', 'tvac', 'ditl'], blurb: 'Shake, heat-and-cold, and a software run.' },
    { id: 'thorough', name: 'Thorough tests', tests: ['vibe', 'tvac', 'ditl', 'deploy', 'hotfire', 'rad', 'vibe', 'tvac'], blurb: 'Every test, some twice. Slow and costly, but safe.' },
  ];

  // Mission names: stars whose names come from Arabic.
  const STAR_NAMES = ['Altair', 'Vega', 'Deneb', 'Rigel', 'Aldebaran', 'Fomalhaut', 'Achernar', 'Mizar', 'Alnilam', 'Shaula', 'Alphard', 'Hamal', 'Markab', 'Mirfak', 'Algol', 'Betelgeuse'];

  const TEAM = [
    { id: 'science', name: 'Dr. Salma', role: 'Science lead' },
    { id: 'systems', name: 'Kenji', role: 'Systems engineer' },
    { id: 'budget', name: 'Ms. Okafor', role: 'Budget' },
    { id: 'safety', name: 'Mateo', role: 'Mission assurance' },
  ];

  // Crew design choices for the designer's parts tray (data-driven: one radio
  // group per field, options from OPTIONS[field]). n1/n2 are filled by the
  // screen from mass and cost.
  const CREW_PARTS = [
    { key: 'abort', cat: 'crew', title: 'Launch abort system', why: 'A rocket tower on the nose that pulls the capsule away from a failing rocket in a split second.' },
    { key: 'heatShield', cat: 'crew', title: 'Heat shield', why: 'The capsule comes home at 11 km/s. A thicker shield survives more, but every kilogram must ride the rocket.' },
    { key: 'entry', cat: 'crew', title: 'Way home through the air', why: 'A skip entry bounces off the air once and is gentler on the crew; a direct entry is shorter and easier on the heat shield.' },
    { key: 'lifeDays', cat: 'crew', title: 'Life support', why: 'The flight takes about 9 days. Spare days of air and water save the crew if something breaks.' },
    { key: 'shelter', cat: 'crew', title: 'Radiation storm shelter', why: 'If the Sun erupts, the crew hides behind mass. Orion’s crew stacks stowage bags around themselves.' },
  ];

  SMD.data = { PROJECT_START, MISSIONS, INSTRUMENTS, OPTIONS, CONST, SUBSYSTEMS, FLAW_TEXT, TESTS, STAR_NAMES, TEAM, CAREER, CONTRACTS, TECH, TEST_PLANS, CREW, CREW_PARTS };
  if (typeof module === 'object' && module.exports) module.exports = SMD.data;
})();
