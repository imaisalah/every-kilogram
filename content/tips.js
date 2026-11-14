// "Did you know" lines shown while players wait or plan (loading, calendar,
// designer). Each one ties a real fact to something the player does, and
// carries its source. topic lets a screen pick a relevant tip:
// mass, power, window, comms, money, people, testing, science, ops.
// Translation key: content.tips.<id>.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.content = SMD.content || {};

  const MRO_KIT = 'https://www.jpl.nasa.gov/news/press_kits/mro-launch-Aug05.pdf';
  const NSSDC = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/';
  const GAO = 'https://files.gao.gov/reports/GAO-26-108556/index.html';

  SMD.content.tips = [
    // Mass and propulsion
    { id: 'snowball', topic: 'mass', text: 'Every kilogram you add needs propellant to push it, and that propellant needs propellant too. The rocket equation makes mass snowball.', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/' },
    { id: 'mro-mass', topic: 'mass', text: 'More than half of MRO’s 2,180 kg at launch was propellant: 1,149 kg.', url: MRO_KIT },
    { id: 'clipper-mass', topic: 'mass', text: 'Europa Clipper weighed about 5,800 kg at launch, and about 2,750 kg of that was propellant.', url: 'https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/' },
    { id: 'aerobraking', topic: 'mass', text: 'MRO saved propellant by dipping into Mars’ upper air hundreds of times over about six months to shrink its orbit.', url: MRO_KIT },
    { id: 'launch-price', topic: 'money', text: 'NASA paid $153.8M to launch Landsat 9 and $256.6M to launch Dragonfly. The ride to space is a big part of the bill.', url: 'https://www.nasa.gov/news-release/nasa-awards-launch-services-contract-for-dragonfly-mission/' },

    // Power
    { id: 'sun-mars', topic: 'power', text: 'Mars gets 586 W of sunlight per square metre, less than half of Earth’s 1,361 W. Your panels must be bigger there.', url: `${NSSDC}marsfact.html` },
    { id: 'sun-jupiter', topic: 'power', text: 'At Jupiter sunlight is about 27 times weaker than at Earth. That is why Juno and Europa Clipper carry giant solar wings.', url: `${NSSDC}jupiterfact.html` },
    { id: 'clipper-arrays', topic: 'power', text: 'Each of Europa Clipper’s two solar arrays is 14.2 m long, yet together they make only about 700 W at Jupiter.', url: 'https://www.jpl.nasa.gov/news/nasas-europa-clipper-gets-set-of-super-size-solar-arrays/' },
    { id: 'juno-power', topic: 'power', text: 'Juno’s solar wings make about 14 kW near Earth but only about 500 W at Jupiter.', url: 'https://www.jpl.nasa.gov/news/nasas-juno-spacecraft-breaks-solar-power-distance-record' },
    { id: 'rtg', topic: 'power', text: 'A nuclear power source (MMRTG) gives about 110 W at launch, about as much as a bright light bulb, and fades a few percent each year.', url: 'https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf' },
    { id: 'venus-hot', topic: 'power', text: 'Venus’s surface averages 464 °C under 92 bar of pressure. Orbiters there fight heat, not cold.', url: `${NSSDC}venusfact.html` },

    // Launch windows
    { id: 'mars-window', topic: 'window', text: 'A launch window to Mars opens about every 26 months. Miss it and your spacecraft waits on the ground.', url: 'https://nssdc.gsfc.nasa.gov/planetary/mars/marslaun.html' },
    { id: 'insight-window', topic: 'window', text: 'InSight missed its 2016 window because of a small leak. It waited 26 months, and the delay cost about $153.8M.', url: 'https://spacepolicyonline.com/news/vacuum-leaks-delay-launch-of-nasas-insight-mars-mission/' },
    { id: 'clipper-route', topic: 'window', text: 'Europa Clipper swings past Mars and Earth to gain speed, and reaches Jupiter in April 2030 after 5½ years.', url: 'https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/' },

    // Communications
    { id: 'mro-dish', topic: 'comms', text: 'MRO’s 3 m dish and 100 W radio can send up to 6 Mbps from Mars. A bigger dish or radio means more data.', url: MRO_KIT },
    { id: 'mro-data', topic: 'comms', text: 'MRO was planned to return more than five times as much data as all earlier Mars missions combined.', url: MRO_KIT },
    { id: 'light-time', topic: 'comms', text: 'When MRO arrived at Mars, radio signals took 12 minutes to reach Earth. Every arrival burn runs on autopilot.', url: MRO_KIT },
    { id: 'conjunction', topic: 'comms', text: 'About every 26 months Mars slips behind the Sun as seen from Earth, and radio contact becomes unreliable.', url: MRO_KIT },
    { id: 'dsn', topic: 'comms', text: 'NASA’s Deep Space Network has three antenna sites spread around the globe, so a spacecraft can always be heard as Earth turns.', url: 'https://www.nasa.gov/communicating-with-missions/dsn/' },
    { id: 'galileo-dish', topic: 'comms', text: 'Galileo’s main antenna never opened. Clever compression squeezed its science through a tiny backup antenna at about 1,000 bits per second.', url: 'https://llis.nasa.gov/lesson/492' },

    // Money and management
    { id: 'reserve', topic: 'money', text: 'NASA Discovery missions must hold back at least 25% of their budget as a reserve for surprises.', url: 'https://astrobiology.nasa.gov/nai/articles/2017/12/15/nasa-discovery-program-announcement-of-opportunity-long-range-planning-information' },
    { id: 'congress', topic: 'money', text: 'If a big NASA project’s cost grows by 15% or it slips 6 months, NASA must tell Congress by law.', url: 'https://www.law.cornell.edu/uscode/text/51/30104' },
    { id: 'jcl', topic: 'money', text: 'NASA plans big projects so they have a 70% chance of finishing on budget and on time.', url: 'https://explorers.larc.nasa.gov/APMIDEX2016/MO/pdf_files/5_SPD-19_PI-ledmissions_70JCL.pdf' },
    { id: 'imap', topic: 'money', text: 'IMAP launched 3 months early and handed back $22.2M of reserve it never needed.', url: GAO },
    { id: 'gao', topic: 'money', text: 'Every year government auditors grade NASA’s biggest projects in public. The 2026 report checked 36 of them.', url: GAO },
    { id: 'psyche', topic: 'people', text: 'Psyche launched more than a year late partly because too few engineers were spread over too many projects.', url: 'https://www.nasa.gov/missions/psyche-mission/review-board-nasa-jpl-psyche-progress-outstanding-launch-on-track/' },

    // Testing and lessons
    { id: 'mco', topic: 'testing', text: 'Mars Climate Orbiter was lost in 1999 because one team worked in pounds and another in newtons.', url: 'https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf' },
    { id: 'hubble', topic: 'testing', text: 'Hubble’s blurry mirror came from a test tool set up 1.3 mm out of place. Cross-check every test.', url: 'https://science.nasa.gov/mission/hubble/observatory/design/optics/hubbles-mirror-flaw/' },
    { id: 'genesis', topic: 'testing', text: 'Genesis crashed because sensors copied from a proven design were installed upside down. Reused parts still need testing.', url: 'https://appel.nasa.gov/2011/08/29/ata_4-6_genesis_launches-html/' },
    { id: 'juno-orbit', topic: 'ops', text: 'Juno stayed in a 53-day orbit instead of a 14-day one rather than risk its engine. Less science per year, but a safe spacecraft.', url: 'https://www.nasa.gov/news-release/nasas-juno-mission-to-remain-in-current-orbit-at-jupiter/' },

    // Science
    { id: 'landsat-free', topic: 'science', text: 'Landsat 8 and 9 together image all of Earth every 8 days, and the archive’s images are free for anyone.', url: 'https://svs.gsfc.nasa.gov/13917/' },
    { id: 'egypt-farmland', topic: 'science', text: 'Only about 4% of Egypt’s land is good for farming, which is why satellites watch the Nile so closely.', url: 'https://science.nasa.gov/earth/earth-observatory/the-nile-deltas-disappearing-farmland-149183/' },
    { id: 'dust-amazon', topic: 'science', text: 'About 27.7 million tonnes of Sahara dust fall on the Amazon each year, carrying fertilizer for the rainforest.', url: 'https://svs.gsfc.nasa.gov/4273/' },
    { id: 'hirise', topic: 'science', text: 'MRO’s HiRISE camera sees details 30 cm across from 300 km up, small enough to spot a kitchen table.', url: MRO_KIT },
    { id: 'lro-cold', topic: 'science', text: 'LRO measured −248 °C in a crater near the Moon’s north pole, colder than the surface of Pluto.', url: 'https://svs.gsfc.nasa.gov/10595/' },
    { id: 'magellan', topic: 'science', text: 'Magellan’s radar mapped 98% of Venus straight through its clouds.', url: 'https://science.nasa.gov/mission/magellan/' },
    { id: 'europa-ice', topic: 'science', text: 'Juno’s measurements suggest Europa’s cold outer ice shell is about 29 km thick where it looked.', url: 'https://www.nasa.gov/missions/juno/nasas-juno-measures-thickness-of-europas-ice-shell/' },
  ];

  // A translated tip: by index, or a stable pick from a seed (e.g. the month).
  // topic narrows the pick ('power', 'comms', ...); unknown topics fall back to all.
  SMD.content.tip = function tip(seed, topic) {
    const all = SMD.content.tips;
    const pool = topic ? all.filter((x) => x.topic === topic) : all;
    const list = pool.length ? pool : all;
    const n = Math.abs(Math.floor(Number(seed) || 0)) % list.length;
    const x = list[n];
    return { id: x.id, topic: x.topic, text: SMD.t ? SMD.t(`content.tips.${x.id}`, x.text) : x.text, url: x.url };
  };
})();
