// History-based events (GDD §9). Each one is a real moment from a NASA (or
// partner) mission, turned into a choice the player makes on their own project.
// The card screen translates every string with the key
// content.events.<id>.title | body | mission | lesson | choice.<choiceId>.
//
// Effects keys: money ($M, negative = cost), months (schedule slip), rep,
// science, hiddenFlaw (a subsystem id from SMD.data.SUBSYSTEMS, never
// 'instrument'), instrumentQuality ({instrumentId: factor}), dropInstrument,
// scienceBoost (multiplies the science orbit quality).
// Balance rule: every choice costs something (money, time, science or risk),
// so none is strictly better than another.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.content = SMD.content || {};

  const has = (id) => (d) => !!(d && d.instruments && d.instruments.includes(id));

  SMD.content.events = [
    // ---------- Phase C: final design and building ----------
    {
      id: 'units-mismatch',
      phase: 'C',
      chance: 0.3,
      when: { kinds: ['moon', 'planet'] },
      title: 'Two teams, two units',
      body: 'Your navigation team sends thruster data in pound-force seconds, but the spacecraft software expects newton-seconds. Nobody has run the two programs together yet.',
      realStory: {
        mission: 'Mars Climate Orbiter',
        year: 1999,
        lesson: 'A units mix-up made every thruster firing look 4.45 times smaller than it was. The orbiter flew too low at Mars and was lost. Write interface rules down and test them end to end.',
        source: 'https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf',
      },
      choices: [
        { id: 'test', label: 'Pay for an end-to-end interface test', effects: { money: -8, months: 1 } },
        { id: 'review', label: 'Have a second team check every interface on paper', effects: { money: -3, months: 2 } },
        { id: 'trust', label: 'Trust the spec and move on', effects: { hiddenFlaw: 'propulsion' } },
      ],
    },
    {
      id: 'galileo-antenna',
      phase: 'C',
      chance: 0.25,
      when: { kinds: ['planet'], needs: (d) => !!d && d.dish >= 2 },
      title: 'An umbrella that must open once',
      body: 'Your big dish folds like an umbrella for launch. Its ribs slide on a dry lubricant that trucking and long storage can rub away.',
      realStory: {
        mission: 'Galileo',
        year: 1991,
        lesson: 'Three of the 18 ribs on Galileo’s main antenna stuck. Data had to squeeze through a tiny backup antenna, and clever compression saved most of the science. Shipping and storage count as environments too.',
        source: 'https://llis.nasa.gov/lesson/492',
      },
      choices: [
        { id: 'retest', label: 'Re-test the deployment after every move', effects: { money: -5, months: 2 } },
        { id: 'solid', label: 'Switch to a heavier, solid dish that never folds', effects: { money: -9, scienceBoost: 0.95 } },
        { id: 'fly', label: 'It opened fine in the lab. Fly it', effects: { hiddenFlaw: 'deploy' } },
      ],
    },
    {
      id: 'hubble-mirror',
      phase: 'C',
      chance: 0.3,
      when: { needs: has('hires') },
      title: 'Two tests disagree',
      body: 'The main test says your telescope mirror is perfect. A quick second test hints it is slightly the wrong shape.',
      realStory: {
        mission: 'Hubble Space Telescope',
        year: 1990,
        lesson: 'A test tool was set up 1.3 mm out of place, so Hubble’s mirror was polished to the wrong shape. Other tests showed the error and were dismissed. Astronauts fitted corrective optics in 1993. Never trust one test tool alone.',
        source: 'https://science.nasa.gov/mission/hubble/observatory/design/optics/hubbles-mirror-flaw/',
      },
      choices: [
        { id: 'crosscheck', label: 'Stop and run an independent test', effects: { money: -7, months: 1 } },
        { id: 'sharpen', label: 'Fly it and sharpen the images with software', effects: { money: -2, instrumentQuality: { hires: 0.8 } } },
        { id: 'trust', label: 'Trust the main test', effects: { instrumentQuality: { hires: 0.55 } } },
      ],
    },
    {
      id: 'lucy-array',
      phase: 'C',
      chance: 0.25,
      title: 'A wing that might not latch',
      body: 'Each solar wing opens with one motor pulling a cord. If the cord snags, the wing could stop short of locking.',
      realStory: {
        mission: 'Lucy',
        year: 2021,
        lesson: 'One of Lucy’s round solar arrays snagged its cord and stopped short of latching. Running the main and backup motors together pulled it to about 353–357 of 360 degrees, enough to fly. A backup motor saved the mission.',
        source: 'https://science.nasa.gov/blogs/lucy/2023/01/19/nasas-lucy-mission-suspending-further-solar-array-deployment-activities/',
      },
      choices: [
        { id: 'motor', label: 'Add a backup motor to every wing', effects: { money: -6 } },
        { id: 'test', label: 'Run extra cold deployment tests', effects: { money: -2, months: 2 } },
        { id: 'fly', label: 'Keep the single motor', effects: { hiddenFlaw: 'deploy' } },
      ],
    },
    {
      id: 'observer-valves',
      phase: 'C',
      chance: 0.25,
      when: { kinds: ['moon', 'planet'] },
      title: 'Fuel that waits for months',
      body: 'Your engine will sit unused for the whole cruise, then must fire perfectly at arrival. Vapour can creep past the one-way valves while it waits.',
      realStory: {
        mission: 'Mars Observer',
        year: 1993,
        lesson: 'Three days before arriving at Mars, Mars Observer went silent while pressurizing its fuel tanks. The review board judged that oxidizer had seeped past check valves during the 11-month cruise and burst a fuel line. Isolate idle propulsion and check it before you need it.',
        source: 'https://nssdc.gsfc.nasa.gov/planetary/text/marsob.txt',
      },
      choices: [
        { id: 'isolate', label: 'Add isolation valves to keep fuel and oxidizer apart', effects: { money: -7 } },
        { id: 'procedure', label: 'Write and rehearse a safe pressurizing sequence', effects: { money: -2, months: 2 } },
        { id: 'fly', label: 'Keep the simple plumbing', effects: { hiddenFlaw: 'propulsion' } },
      ],
    },
    {
      id: 'mgs-damper',
      phase: 'C',
      chance: 0.3,
      when: { kinds: ['planet'], needs: (d) => !!d && d.capture === 'aerobrake' },
      title: 'A cracked part on the solar wing',
      body: 'Aerobraking uses your solar wings as air brakes in the planet’s thin upper air. An inspection finds a small crack in a damper arm on one wing.',
      realStory: {
        mission: 'Mars Global Surveyor',
        year: 1997,
        lesson: 'A solar wing that never fully latched (a damper arm probably broke) flexed during aerobraking. NASA slowed aerobraking to about a third of the planned rate, and mapping started a year late in a different orbit.',
        source: 'https://nssdc.gsfc.nasa.gov/planetary/text/mgs_pr_971030.txt',
      },
      choices: [
        { id: 'replace', label: 'Replace the part and re-test the wing', effects: { money: -6, months: 1 } },
        { id: 'gentle', label: 'Plan gentler, slower aerobraking', effects: { scienceBoost: 0.9 } },
        { id: 'fly', label: 'The crack is tiny. Fly it', effects: { hiddenFlaw: 'structure' } },
      ],
    },

    // ---------- Phase B: preliminary design ----------
    {
      id: 'genesis-heritage',
      phase: 'B',
      chance: 0.3,
      title: 'Free parts from an old mission',
      body: 'You can reuse a sensor box that flew before, with its old drawings. It is cheaper, but nobody has checked it fits the way your spacecraft is built.',
      realStory: {
        mission: 'Genesis',
        year: 2004,
        lesson: 'Genesis reused a proven design, but a drawing error meant its g-switches were installed upside down. The parachute never opened and the capsule crashed in Utah. Reviews trusted the heritage and skipped a test. Heritage is not free: verify it again.',
        source: 'https://appel.nasa.gov/2011/08/29/ata_4-6_genesis_launches-html/',
      },
      choices: [
        { id: 'reverify', label: 'Use it, but test it again in the new design', effects: { money: 3, months: 1 } },
        { id: 'new', label: 'Build a new sensor box', effects: { money: -6 } },
        { id: 'trust', label: 'It flew before. Use it as is', effects: { money: 5, hiddenFlaw: 'avionics' } },
      ],
    },
    {
      id: 'psyche-workforce',
      phase: 'B',
      chance: 0.3,
      title: 'Too few hands',
      body: 'Your software engineers are split across several projects. The flight software is falling behind, and the team is tired.',
      realStory: {
        mission: 'Psyche',
        year: 2022,
        lesson: 'Psyche’s flight software arrived too late to test before its launch window. A review board blamed too much work for too few people at JPL. Psyche launched more than a year late, and VERITAS was pushed back to free up staff.',
        source: 'https://www.nasa.gov/missions/psyche-mission/review-board-nasa-jpl-psyche-progress-outstanding-launch-on-track/',
      },
      choices: [
        { id: 'hire', label: 'Hire experienced contractors', effects: { money: -12 } },
        { id: 'slip', label: 'Give the team more time', effects: { months: 3 } },
        { id: 'crunch', label: 'Ask the team to work weekends', effects: { rep: -1, hiddenFlaw: 'avionics' } },
      ],
    },
    {
      id: 'beresheet-single-string',
      phase: 'B',
      chance: 0.35,
      when: { needs: (d) => !!d && d.avionics !== 'dual' },
      title: 'One brain, no backup',
      body: 'Your spacecraft has a single flight computer, and software fixes live only in its memory. If it reboots in a crisis, those fixes vanish.',
      realStory: {
        mission: 'Beresheet (SpaceIL, Israel)',
        year: 2019,
        lesson: 'During its Moon landing, a sensor failed on Beresheet. A quick reset command set off a chain of errors that shut down the main engine, and it crashed. With one computer, every command in a crisis must already be tested.',
        source: 'https://www.planetary.org/articles/software-command-doomed-beresheet',
      },
      choices: [
        { id: 'rehearse', label: 'Rehearse every emergency command on a test bench', effects: { money: -6, months: 1 } },
        { id: 'store', label: 'Store fixes in permanent memory (more testing later)', effects: { months: 2 } },
        { id: 'accept', label: 'Accept the risk', effects: { hiddenFlaw: 'avionics' } },
      ],
    },
    {
      id: 'budget-storm',
      phase: 'B',
      chance: 0.25,
      title: 'Budget storm',
      body: 'The new national budget request cuts science spending almost in half. Your project is on the list of missions to slow down.',
      realStory: {
        mission: 'FY2027 NASA budget request',
        year: 2026,
        lesson: 'The FY2027 request proposed cutting NASA science by about 46% and ending more than 40 missions. Congress pushed back. Missions survive storms by holding reserves and showing value.',
        source: 'https://www.planetary.org/articles/analyzing-the-fy-2027-nasa-budget-request',
      },
      choices: [
        { id: 'absorb', label: 'Absorb the cut from agency funds', effects: { money: -15 } },
        { id: 'stretch', label: 'Stretch the schedule to spread the cost', effects: { money: -4, months: 4 } },
        { id: 'descope', label: 'Shrink the science operations plan', effects: { scienceBoost: 0.85 } },
      ],
    },
    {
      id: 'icemag-cost',
      phase: 'B',
      chance: 0.35,
      when: { kinds: ['planet'], needs: has('mag') },
      title: 'The magnetometer costs three times more',
      body: 'Your magnetometer team needs far more money than they proposed. Its fancy helium sensors are proving hard to build.',
      realStory: {
        mission: 'Europa Clipper (ICEMAG)',
        year: 2019,
        lesson: 'The ICEMAG magnetometer grew to about three times its proposed cost. NASA cancelled it and flew a simpler, cheaper magnetometer instead. Cost caps protect the rest of the mission.',
        source: 'https://spacepolicyonline.com/news/zurbuchen-cancels-europa-clipper-instrument-due-to-cost-overruns/',
      },
      choices: [
        { id: 'pay', label: 'Pay what it takes', effects: { money: -20 } },
        { id: 'simpler', label: 'Swap in a simpler magnetometer', effects: { money: -5, instrumentQuality: { mag: 0.75 } } },
        { id: 'drop', label: 'Drop the magnetometer', effects: { dropInstrument: 'mag' } },
      ],
    },

    // ---------- Phase D: assembly, test and launch ----------
    {
      id: 'polar-lander-test',
      phase: 'D',
      chance: 0.3,
      title: 'A test that proved nothing',
      body: 'Your deployment test passed, but now you learn a switch was wired wrong during the run. The test may not have checked what it was meant to check.',
      realStory: {
        mission: 'Mars Polar Lander',
        year: 1999,
        lesson: 'Shaking from the landing legs opening looked like touchdown, so the engines probably cut off about 40 m up. The test that should have caught it was run with mis-wired sensors and never repeated. Test as you fly, and re-test after any fix.',
        source: 'https://ntrs.nasa.gov/api/citations/20000061966/downloads/20000061966.pdf',
      },
      choices: [
        { id: 'retest', label: 'Fix the wiring and run the whole test again', effects: { money: -5, months: 1 } },
        { id: 'skip', label: 'The test passed. Move on', effects: { hiddenFlaw: 'avionics' } },
      ],
    },
    {
      id: 'insight-leak',
      phase: 'D',
      chance: 0.25,
      when: { kinds: ['planet'] },
      title: 'A leak in the vacuum seal',
      body: 'Your lead instrument’s sensor sits inside a sealed vacuum box, and the final test finds a tiny leak. A proper repair takes months, and planets do not wait.',
      realStory: {
        mission: 'InSight',
        year: 2015,
        lesson: 'A leak in InSight’s seismometer could not be fixed before the 2016 Mars window. The lander waited 26 months for the next window, and the delay cost about $153.8 million.',
        source: 'https://spacepolicyonline.com/news/vacuum-leaks-delay-launch-of-nasas-insight-mars-mission/',
      },
      choices: [
        { id: 'fix', label: 'Fix it properly, even if we miss the window', effects: { money: -15, months: 4 } },
        { id: 'patch', label: 'Patch it quickly and hope it holds', effects: { money: -6, months: 1, scienceBoost: 0.92 } },
        { id: 'fly', label: 'Fly with the leak and get less sharp data', effects: { scienceBoost: 0.8 } },
      ],
    },
    {
      id: 'juno-valves',
      phase: 'D',
      chance: 0.25,
      when: { kinds: ['moon', 'planet'] },
      title: 'Slow valves',
      body: 'In the last engine test, two valves take minutes to open instead of seconds. Your plan needs a big burn after arrival to reach the best science orbit.',
      realStory: {
        mission: 'Juno',
        year: 2016,
        lesson: 'Two helium check valves on Juno opened slowly. Rather than risk the main engine, NASA kept Juno in its 53-day orbit instead of the planned 14-day one. The science still came back, more slowly. Accepting less can save the mission.',
        source: 'https://www.nasa.gov/news-release/nasas-juno-mission-to-remain-in-current-orbit-at-jupiter/',
      },
      choices: [
        { id: 'replace', label: 'Replace the valves and re-test', effects: { money: -10, months: 2 } },
        { id: 'safe', label: 'Plan to stay in a safer, slower orbit', effects: { scienceBoost: 0.85 } },
        { id: 'fly', label: 'Fly the original plan', effects: { hiddenFlaw: 'propulsion' } },
      ],
    },
    {
      id: 'clipper-transistors',
      phase: 'D',
      chance: 0.25,
      when: { kinds: ['moon', 'planet'] },
      title: 'Parts alert from industry',
      body: 'A supplier warns that a batch of radiation-hardened transistors fails at lower radiation doses than promised. Your spacecraft has hundreds of them.',
      realStory: {
        mission: 'Europa Clipper',
        year: 2024,
        lesson: 'Months before launch, Europa Clipper’s transistors were found to be weaker than their rating. Engineers spent the summer testing them and showed the spacecraft could still fly its tour. It launched in October 2024.',
        source: 'https://science.nasa.gov/blogs/europa-clipper/2024/08/28/nasas-europa-clipper-mission-moving-toward-october-launch-date/',
      },
      choices: [
        { id: 'test', label: 'Test the parts to learn their true limit', effects: { money: -12, months: 1 } },
        { id: 'swap', label: 'Replace the parts', effects: { money: -6, months: 3 } },
        { id: 'adapt', label: 'Fly as is and limit time in high radiation', effects: { scienceBoost: 0.88 } },
      ],
    },
    {
      id: 'noaa-tipover',
      phase: 'D',
      chance: 0.2,
      title: 'Paperwork before the move',
      body: 'Your spacecraft is about to be tilted on its handling cart. Checking every bolt against the procedure will cost the team a day you do not have.',
      realStory: {
        mission: 'NOAA-N Prime',
        year: 2003,
        lesson: 'Another team had removed 24 bolts from the turn-over cart without logging it, and nobody checked before tilting. The weather satellite slid off and hit the factory floor. It needed years of repairs before launch in 2009.',
        source: 'https://www.nasa.gov/pdf/65776main_noaa_np_mishap.pdf',
      },
      choices: [
        { id: 'check', label: 'Follow the procedure, every step', effects: { months: 1 } },
        { id: 'spot', label: 'Pay for an extra safety inspector', effects: { money: -3 } },
        { id: 'rush', label: 'Skip the check, it is routine', effects: { hiddenFlaw: 'structure' } },
      ],
    },
    // ---------- Crewed missions only ----------
    {
      id: 'apollo1-fire',
      phase: 'B',
      chance: 0.9,
      when: { kinds: ['crew'] },
      title: 'A spark in a pure-oxygen cabin',
      body: 'Engineers plan to fill the capsule with pure oxygen for ground tests, the cabin is full of foam and nylon, and the hatch opens inward. Your safety lead wants all three changed before anyone sits inside.',
      realStory: {
        mission: 'Apollo 1',
        year: 1967,
        lesson: 'A spark started a fire during a launch-pad test. In pure oxygen it spread in seconds, and the inward hatch took 90 seconds to open. Three astronauts died. NASA redesigned the hatch to open outward, removed flammable materials and used a nitrogen–oxygen mix at launch.',
        source: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo1info.html',
      },
      choices: [
        { id: 'redesign', label: 'Outward hatch, fireproof materials, safer air', effects: { money: -15, months: 2 } },
        { id: 'materials', label: 'Swap the flammable materials only', effects: { money: -6, months: 1, hiddenFlaw: 'thermal' } },
        { id: 'keep', label: 'Keep the design. Tests on the ground are short', effects: { rep: -1, hiddenFlaw: 'lifeSupport' } },
      ],
    },
    {
      id: 'apollo13-tank',
      phase: 'C',
      chance: 0.9,
      when: { kinds: ['crew'] },
      title: 'A heater switch from the old design',
      body: 'Your oxygen tanks now run on a higher ground voltage, but the little thermostat switches inside were never upgraded. On paper they are fine. Nobody has tested them at the new voltage.',
      realStory: {
        mission: 'Apollo 13',
        year: 1970,
        lesson: 'Switches rated for 28 volts met 65 volts during ground tests, welded shut and cooked the wiring inside oxygen tank 2. About 56 hours into the flight the tank exploded. The crew lived in the lunar module and swung around the Moon to come home.',
        source: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/ap13acc.html',
      },
      choices: [
        { id: 'check', label: 'Check every switch against the new voltage', effects: { money: -10, months: 1 } },
        { id: 'test', label: 'Run a full tank test at the new voltage', effects: { money: -4, months: 2 } },
        { id: 'trust', label: 'The specs say it is fine. Move on', effects: { hiddenFlaw: 'lifeSupport' } },
      ],
    },
    {
      id: 'artemis1-char',
      phase: 'D',
      chance: 0.9,
      when: { kinds: ['crew'] },
      title: 'Chunks missing from the heat shield',
      body: 'Your test capsule came back from a high-speed entry with pieces of charred heat shield missing in places nobody predicted. The material may trap its own gases and crack.',
      realStory: {
        mission: 'Artemis I',
        year: 2022,
        lesson: 'Orion’s Avcoat shield lost char in several places. Gases could not escape the material during the skip entry, so it cracked. NASA flew Artemis II with the same shield but a different entry, and is making later shields more permeable.',
        source: 'https://www.nasa.gov/missions/artemis/nasa-identifies-cause-of-artemis-i-orion-heat-shield-char-loss/',
      },
      choices: [
        { id: 'arcjet', label: 'Arc-jet tests and a more permeable ablator', effects: { money: -25, months: 3 } },
        { id: 'fly', label: 'The crew would still be safe. Fly it', effects: { hiddenFlaw: 'heatShield' } },
      ],
    },
    {
      id: 'soyuz-ms10',
      phase: 'D',
      chance: 0.6,
      when: { kinds: ['crew'] },
      title: 'A bent sensor on the rocket',
      body: 'During final assembly a technician reports that a booster separation sensor might have been bent. Taking the stack apart to look costs weeks.',
      realStory: {
        mission: 'Soyuz MS-10',
        year: 2018,
        lesson: 'A sensor bent during assembly kept one booster from separating cleanly about two minutes into the flight. It hit the core stage. The abort system pulled the capsule away and both crew members landed safely.',
        source: 'https://www.esa.int/ESA_Multimedia/Images/2018/11/The_type_of_sensor_that_caused_the_malfunction_during_launch',
      },
      choices: [
        { id: 'inspect', label: 'Take it apart and inspect every sensor', effects: { money: -6, months: 1 } },
        { id: 'fly', label: 'It is probably fine. Keep the schedule', effects: { hiddenFlaw: 'ascent' } },
      ],
    },
    {
      id: 'imap-early',
      phase: 'D',
      chance: 0.2,
      title: 'Early and under budget',
      body: 'Testing went smoothly and your spacecraft is ready ahead of schedule. Part of the reserve was never needed.',
      realStory: {
        mission: 'IMAP',
        year: 2025,
        lesson: 'The Interstellar Mapping and Acceleration Probe launched 3 months early and returned $22.2 million of unused reserves, a rare result noted by government auditors. Good management is rewarded.',
        source: 'https://files.gao.gov/reports/GAO-26-108556/index.html',
      },
      choices: [
        { id: 'return', label: 'Return the unused reserve', effects: { money: 12, rep: 1 } },
        { id: 'calibrate', label: 'Spend it on extra instrument calibration', effects: { scienceBoost: 1.1 } },
      ],
    },
  ];
})();
