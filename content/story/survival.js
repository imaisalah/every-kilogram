// Survival segments of story mode (docs/STORY.md): the numbers each segment
// plays with and where they come from. Real values are kept next to the game
// values so a teacher can see what was scaled and why.
// Read by js/story/survival.js at run time (this file loads after it).
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});

  const S = {
    a13ops: { title: 'Apollo 13 Mission Operations Report (NASA, 1970)', url: 'https://www.nasa.gov/wp-content/uploads/static/history/afj/ap13fj/pdf/a13-mission-ops-report-19700428.pdf' },
    afjHome: { title: 'Apollo Flight Journal: Apollo 13, day 4 (homeward)', url: 'https://www.nasa.gov/history/afj/ap13fj/14day4-homeward.html' },
    sp350: { title: 'Apollo Expeditions to the Moon (NASA SP-350), chapter 13', url: 'https://apolloexplorer.co.uk/books/sp-350/ch-13-3.html' },
    mailbox: { title: 'NASA: Apollo 13 crew installing the "mail box" CO2 adapter', url: 'https://www.nasa.gov/image-article/apollo-13-crew-installing-mail-box-purging-carbon-dioxide-from-lunar-module-april-14-1970' },
    afjMailbox: { title: 'Apollo Flight Journal: building the CO2 adapter', url: 'https://www.nasa.gov/history/afj/ap13fj/15day4-mailbox.html' },
    afjBurn: { title: 'Apollo Flight Journal: the manual course correction', url: 'https://www.nasa.gov/history/afj/ap13fj/19day5-themanualcoursecorrection.html' },
    afjReturn: { title: 'Apollo Flight Journal: Apollo 13 return home', url: 'https://www.nasa.gov/history/afj/ap13fj/29day6-returnhome.html' },
    spe1972: { title: 'NASA technical report on the August 1972 solar particle event doses (2004)', url: 'https://ntrs.nasa.gov/citations/20040100724' },
    nrc2006: { title: 'Space Radiation Hazards and the Vision for Space Exploration (National Academies, 2006)', url: 'https://www.nationalacademies.org/read/11760/chapter/3' },
    orionShelter: { title: 'Space.com: how Artemis crews would weather a solar storm in Orion', url: 'https://www.space.com/space-exploration/artemis/how-the-artemis-2-astronauts-could-weather-a-solar-storm-during-their-moon-mission' },
    artemis1Dose: { title: 'DLR: Orion radiation protection measured on Artemis I (2024)', url: 'https://www.dlr.de/en/latest/news/2024/orion-spacecraft-radiation-protection-tested-initial-findings-from-artemis-i-moon-mission' },
    radLimits: { title: 'NASA OCHMO radiation protection technical brief', url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf' },
    oigHeat: { title: 'NASA Inspector General IG-24-011: Artemis II readiness (heat shield char loss)', url: 'https://oig.nasa.gov/wp-content/uploads/2024/05/ig-24-011.pdf' },
    blackout: { title: 'Universe Today: the longer-than-expected Apollo 13 blackout', url: 'https://www.universetoday.com/articles/13-more-things-that-saved-apollo-13-part-6-the-mysterious-longer-than-expected-communications-blackout' },
  };

  SMD.storySurvivalData = {
    sources: S,

    // ---------- ep2.power: stretch the lifeboat battery ----------
    // Real: the Apollo 13 LM had four descent batteries (about 400 Ah each)
    // and two ascent batteries (296 Ah each), about 2,200 Ah. It was meant to
    // keep two people alive for about 45 hours; it had to keep three alive for
    // about 87 hours (explosion at 55:55 to splashdown at 142:55). Ground cut
    // the draw from a normal ~50 A toward 12 A; the crew reported 14-16 A
    // powered down. About 129 Ah went back to recharge the capsule's entry
    // batteries. Game: a four-seat capsule's emergency battery, same ratios.
    power: {
      capacityAh: 1700, // the lifeboat battery when full
      fullAt: 60, // res.power that means a full lifeboat battery (ep2 takes 40 for the rupture)
      reserveAh: 300, // kept for the entry batteries (Apollo 13 moved ~129 Ah)
      hoursHome: 77, // time to splashdown from here
      margin: 1.05, // the projection must beat hoursHome by 5%
      decisionSeconds: 150, // real seconds to decide
      hoursPerSecond: 0.05, // mission hours that pass per real second (3 min)
      systems: [
        { id: 'core', amps: [5], locked: true },
        { id: 'fans', amps: [4, 2], states: ['on', 'low'] },
        { id: 'heaters', amps: [7, 3, 0], states: ['on', 'low', 'off'] },
        { id: 'comms', amps: [6, 2, 0], states: ['on', 'low', 'off'] },
        { id: 'guidance', amps: [10, 0], states: ['on', 'off'] },
        { id: 'displays', amps: [4, 1], states: ['on', 'low'] },
        { id: 'lights', amps: [3, 1, 0], states: ['on', 'low', 'off'] },
        { id: 'water', amps: [2, 0], states: ['on', 'off'] },
        { id: 'windows', amps: [1.5, 0], states: ['on', 'off'] },
        { id: 'radar', amps: [4, 0], states: ['on', 'off'] },
        { id: 'camera', amps: [3, 0], states: ['on', 'off'] },
      ],
      // Cabin temperature the cabin settles to for each heater setting (°C).
      // Apollo 13's crew lived in the upper 30s to low 50s °F (about 3-11 °C).
      cabinC: { on: 19, low: 11, off: 4 },
      sources: [S.a13ops, S.afjHome, S.sp350],
    },

    // ---------- ep2.co2: the "mailbox" adapter ----------
    // Real: the LM's round lithium hydroxide canisters were sized for two
    // people for two days. The capsule's square ones did not fit. The CO2
    // reading was allowed to reach 14.9 mmHg; the adapter (bag, tape, suit
    // hose, flight-plan cover, socks) brought it down to 0.1-1.8 mmHg.
    // Swigert: "reading about 15 ... within an hour was down to 2 tenths".
    // The ground procedure: below 8 is safe; the amber light is set at 10.
    co2: {
      start: 7.5, // mmHg when the segment starts
      startFansLow: 9, // ... when the fans were turned down in ep2.power
      rate: 0.065, // mmHg per real second (compressed)
      safe: 8,
      amber: 10,
      danger: 15, // headaches, the flight-rule danger line
      fail: 18, // the crew goes back on suit oxygen: the segment is lost
      wrongPenalty: 0.6, // mmHg for a wrong step (time lost re-doing it)
      lockers: [
        { id: 'L1', item: 'cartridge' },
        { id: 'L2', item: 'hose' },
        { id: 'L3', item: 'bag' },
        { id: 'L4', item: 'tape' },
        { id: 'L5', item: 'cover' },
        { id: 'L6', item: 'sock' },
        { id: 'L7', item: null },
        { id: 'L8', item: null },
      ],
      // The order the game asks for, following the ground procedure.
      steps: ['cartridge', 'cover', 'bag', 'hose', 'tape', 'sock'],
      sources: [S.mailbox, S.afjMailbox, S.sp350],
    },

    // ---------- ep3.storm: radiation shelter ----------
    // Real: the August 1972 event, between Apollo 16 and 17. Estimates for a
    // crew inside an aluminium pressure vessel run from about 0.35 to 1.8 Sv
    // to the blood-forming organs depending on the model. Orion's answer: the
    // crew moves into the best-shielded middle of the cabin and piles
    // stowage and water bags around themselves; the design limit is 150 mSv
    // for the reference event, measured as reachable on Artemis I. NASA's
    // 30-day limit for the blood-forming organs is 250 mGy-Eq.
    storm: {
      doseRef: 900, // mSv behind the bare 10 g/cm² hull, for this event
      refShield: 10, // g/cm²
      lambda: 12, // g/cm²: each 12 g/cm² more cuts the dose by e (about 2.7×)
      berths: [
        { id: 'b1', shield: 24 }, // the middle of the floor bay, over the heat shield
        { id: 'b2', shield: 22 },
        { id: 'b3', shield: 18 },
        { id: 'b4', shield: 14 }, // next to the side hatch: the thinnest wall
      ],
      capacity: 4, // bags over each berth
      bags: { water: { n: 7, gcm2: 5, kg: 10 }, stow: { n: 6, gcm2: 3, kg: 8 } },
      warnSeconds: 75, // real seconds until the protons peak
      carrySeconds: 1.4, // the commander floats each bag over
      goal: 150, // mSv: Orion's design limit
      limit: 250, // mSv: NASA 30-day limit; over it the segment is lost
      healthPerMSv: 1 / 25, // health points lost per mSv
      sources: [S.spe1972, S.nrc2006, S.orionShelter, S.artemis1Dose, S.radLimits],
    },

    // ---------- ep4.burn: the manual course correction ----------
    // Real: Apollo 13's midcourse correction at 105:30 GET with the guidance
    // computer off. Ground told the crew to shut down by hand at 14 seconds.
    // Lovell held attitude on the Earth's terminator in the COAS sight (lit
    // Earth in the top half, the cusp on the Y-Y line); a burn rule said to
    // shut down if rates went over 10°/s. Venting had made the entry path
    // too shallow; the burn steepened it into the corridor.
    burn: {
      gamma0: 3.0, // entry angle before the burn (game value: far too shallow, a skip-out)
      gammaTarget: 6.5,
      burnSeconds: 14,
      corridor: [5.5, 7.5],
      rateLimit: 10, // °/s: the real burn rule
      armSeconds: 25, // real seconds to line up before ignition
      maxBurn: 26, // the burn is cut for you after this
      sources: [S.afjBurn, S.a13ops],
    },

    // ---------- ep4.entry: the corridor with a damaged shield ----------
    // Real: Apollo entered at about 11 km/s; the corridor is a band of entry
    // angles of a degree or two around -6.5°. Too shallow and the capsule
    // skips back out; too steep and heating and g-load climb. Artemis I's
    // shield lost char in more than 100 places. Apollo 13's blackout ran
    // about 6 minutes, 87 seconds longer than predicted.
    entry: {
      corridor: [5.5, 7.5],
      gamma0: 6.5, // used when ep4.burn did not run
      controlSeconds: 46, // real seconds of the heat pulse
      silenceSeconds: 22, // real seconds of the long blackout after it
      blackoutExpected: 270, // s (4:30)
      blackoutActual: 357, // s (about 6:00, 87 s longer)
      shieldStart: 100, // %
      shieldDamaged: 72, // % when flags.shieldDamaged is set by the story
      sources: [S.oigHeat, S.blackout, S.afjReturn],
    },
  };
})();
