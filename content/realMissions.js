// The real NASA mission to compare each design with ("Your design vs the real
// mission", GDD §9). Only numbers checked against a NASA or official source
// are used; null means no single published figure was found, and the matching
// note says what is known instead. Translation keys:
// content.realMissions.<missionKey>.fact | powerNote | costNote | massNote | dataNote,
// and content.realMissions.<missionKey>.related.<i> for the related missions.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.content = SMD.content || {};

  SMD.content.realMissions = {
    nile: {
      name: 'Landsat 9',
      launchMassKg: 2711,
      massNote: null,
      powerW: null,
      powerNote: 'NASA does not publish a single power figure for Landsat 9.',
      dataRate: 'About 740 scenes a day',
      dataNote: 'Its camera sees a strip of Earth 185 km wide, with 30 m pixels.',
      costM: 885,
      costNote: 'Life-cycle cost baseline set in 2017, including the launch.',
      launch: 'Atlas V 401, Vandenberg, 27 September 2021',
      launchYear: 2021,
      launchCostM: 153.8,
      instruments: ['Operational Land Imager 2 (OLI-2)', 'Thermal Infrared Sensor 2 (TIRS-2)'],
      fact: 'Landsat 8 and Landsat 9 together photograph all of Earth every 8 days, and the 9 million images in the Landsat archive are free for anyone to download.',
      source: 'https://science.nasa.gov/mission/landsat-9/',
      sources: [
        'https://landsat.gsfc.nasa.gov/article/landsat-9-project-on-track-u-s-general-accounting-office-assesses',
        'https://www.nasa.gov/press-release/nasa-awards-launch-services-contract-for-landsat-9-mission',
        'https://svs.gsfc.nasa.gov/13917/',
      ],
      related: [],
    },
    weather: {
      name: 'Terra',
      launchMassKg: 5190,
      massNote: 'About the size of a small school bus.',
      powerW: 2530,
      powerNote: 'Orbit-average power. The solar array was sized for more than 5,000 W at the end of its design life.',
      dataRate: '13.125 Mbps',
      dataNote: 'Direct broadcast of MODIS data to anyone with a 3 m dish; recorded science goes down faster links.',
      costM: null,
      costNote: 'No single NASA total for Terra alone was found.',
      launch: 'Atlas IIAS, Vandenberg, 18 December 1999',
      launchYear: 1999,
      launchCostM: null,
      instruments: ['MODIS', 'ASTER', 'CERES', 'MISR', 'MOPITT'],
      fact: 'Terra has flown for more than 25 years, far longer than it was designed for, and its MODIS camera sees almost the whole Earth every day.',
      source: 'https://terra.nasa.gov/about',
      sources: ['https://ntrs.nasa.gov/citations/20000070467', 'https://science.nasa.gov/mission/terra/'],
      related: [],
    },
    moon: {
      name: 'Lunar Reconnaissance Orbiter (LRO)',
      launchMassKg: 1916,
      massNote: 'Including about 894 kg of propellant. Sources give 1,846–1,916 kg.',
      powerW: 823,
      powerNote: 'Orbit average; about 1,850 W peak from a 10.7 m² solar array.',
      dataRate: '100 Mbps',
      dataNote: 'Ka-band downlink.',
      costM: 504,
      costNote: 'LRO alone; $583M together with the LCROSS impactor that shared its rocket.',
      launch: 'Atlas V 401, Cape Canaveral, 18 June 2009',
      launchYear: 2009,
      launchCostM: 136.2,
      instruments: ['LROC camera', 'LOLA laser altimeter', 'LEND neutron detector', 'Diviner radiometer', 'LAMP ultraviolet spectrograph', 'CRaTER radiation telescope', 'Mini-RF radar'],
      fact: 'LRO launched on the same rocket as LCROSS, which later crashed into Cabeus crater on purpose while LRO watched, and found water in the debris.',
      source: 'https://ntrs.nasa.gov/api/citations/20180000056/downloads/20180000056.pdf',
      sources: ['https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031A', 'https://science.nasa.gov/mission/lro/'],
      related: [],
    },
    mars: {
      name: 'Mars Reconnaissance Orbiter (MRO)',
      launchMassKg: 2180,
      massNote: '139 kg of instruments, 892 kg of other dry mass and 1,149 kg of propellant.',
      powerW: 2000,
      powerNote: 'At Mars. The same 20 m² of panels give about 6,000 W near Earth.',
      dataRate: 'Up to 6 Mbps',
      dataNote: '3 m dish and 100 W radio; the rate drops as Mars moves away from Earth.',
      costM: 720,
      costNote: 'About $450M for the spacecraft and instruments, $90M for the launch and $180M for operations.',
      launch: 'Atlas V 401, Cape Canaveral, 12 August 2005',
      launchYear: 2005,
      launchCostM: 90,
      instruments: ['HiRISE camera', 'Context Camera (CTX)', 'CRISM spectrometer', 'MARCI weather camera', 'Mars Climate Sounder', 'SHARAD radar'],
      fact: 'MRO was planned to send home more than five times as much data as all earlier Mars missions combined.',
      source: 'https://www.jpl.nasa.gov/news/press_kits/mro-launch-Aug05.pdf',
      sources: ['https://science.nasa.gov/mission/mars-reconnaissance-orbiter/'],
      related: [],
    },
    venus: {
      name: 'Magellan',
      launchMassKg: 3445,
      massNote: null,
      powerW: 1029,
      powerNote: 'At least 1,029 W at the end of the mission, from two solar panels totalling 12.6 m².',
      dataRate: '268.8 kbps',
      dataNote: 'X-band through a 3.7 m dish; 115.2 kbps backup.',
      costM: 551,
      costNote: 'Including about $95M for operations. Some hardware came free from storage.',
      launch: 'Space Shuttle Atlantis (STS-30) with an upper stage, 4 May 1989',
      launchYear: 1989,
      launchCostM: null,
      instruments: ['Synthetic aperture radar (also used as an altimeter and radiometer)'],
      fact: 'Magellan sent back 1,200 gigabits of data, more than all of NASA’s earlier planetary missions combined.',
      source: 'https://science.nasa.gov/mission/magellan/',
      sources: ['https://pds-engineering.jpl.nasa.gov/wp-content/uploads/documents/catalog_search/CatalogTemplateInstrumentHost-Magellan.cat'],
      related: [
        {
          name: 'VERITAS',
          text: 'NASA’s planned Venus orbiter, launching no earlier than 2031, will remap Venus with a sharper radar to look for changes since Magellan.',
          source: 'https://science.nasa.gov/mission/veritas/',
        },
      ],
    },
    jupiter: {
      name: 'Europa Clipper',
      launchMassKg: 5800,
      massNote: 'About 2,750 kg of that was propellant.',
      powerW: 700,
      powerNote: 'Roughly 700 W at Jupiter from two arrays of 14.2 m × 4.1 m, because sunlight there is only 3–4% as strong as at Earth.',
      dataRate: null,
      dataNote: 'Sends data through a 3 m X- and Ka-band dish; the rate changes with distance.',
      costM: 5200,
      costNote: 'Full life-cycle cost from 2015 to the end of the prime mission in 2034.',
      launch: 'Falcon Heavy, Kennedy Space Center, 14 October 2024',
      launchYear: 2024,
      launchCostM: 178,
      instruments: ['E-THEMIS thermal imager', 'MISE infrared spectrometer', 'EIS cameras', 'Europa-UVS', 'REASON ice-penetrating radar', 'ECM magnetometer', 'PIMS plasma instrument', 'SUDA dust analyzer', 'MASPEX mass spectrometer', 'Gravity and radio science'],
      fact: 'Clipper travels about 2.9 billion km over 5½ years, swinging past Mars and Earth to reach Jupiter in April 2030.',
      source: 'https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/',
      sources: ['https://www.jpl.nasa.gov/news/nasas-europa-clipper-gets-set-of-super-size-solar-arrays/', 'https://science.nasa.gov/mission/europa-clipper/'],
      related: [
        {
          name: 'Juno',
          text: 'Juno’s three 9 m solar wings make about 14 kW near Earth but only about 500 W at Jupiter, which gets about 25 times less sunlight.',
          source: 'https://www.jpl.nasa.gov/news/nasas-juno-spacecraft-breaks-solar-power-distance-record',
        },
      ],
    },
    crew: {
      name: 'Artemis II (Orion “Integrity”)',
      launchMassKg: 26520,
      massNote: 'Crew module and European Service Module together; 33,446 kg with the launch abort system.',
      powerW: 11000,
      powerNote: 'Four solar wings on the European Service Module make about 11 kW.',
      dataRate: null,
      dataNote: 'Orion talks to Earth through the Deep Space Network; 40 minutes of silence behind the Moon.',
      costM: 4100,
      costNote: 'NASA Inspector General estimate for one early Artemis launch: SLS, Orion and ground systems (2021).',
      launch: 'SLS Block 1, Kennedy Space Center, 1 April 2026',
      launchYear: 2026,
      launchCostM: 2200,
      instruments: ['Handheld cameras at the windows', 'Radiation sensors (HERA)', 'Crew health studies'],
      fact: 'On 6 April 2026 the crew passed 6,545 km above the far side and reached 406,771 km from Earth, farther than any humans before. They splashed down off San Diego on 10 April after 9 days, 1 hour and 32 minutes, hitting the air at 11 km/s.',
      source: 'https://www.nasa.gov/mission/artemis-ii/',
      sources: [
        'https://www.nasa.gov/reference/space-launch-system/',
        'https://www.nasa.gov/missions/artemis/nasa-identifies-cause-of-artemis-i-orion-heat-shield-char-loss/',
        'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Orion',
        'https://oig.nasa.gov/docs/IG-22-003.pdf',
      ],
      related: [
        {
          name: 'Apollo 8',
          text: 'Apollo 8 carried the first crew around the Moon in December 1968, 10 orbits in all, and took the Earthrise photo.',
          source: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1968-118A',
        },
        {
          name: 'Apollo 13',
          text: 'Apollo 13 held the human distance record (400,171 km) for 56 years, until Artemis II passed it on the same kind of free-return loop.',
          source: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/ap13acc.html',
        },
      ],
    },
  };

  // A real mission with its notes translated.
  SMD.content.realMission = function realMission(missionKey) {
    const m = SMD.content.realMissions[missionKey];
    if (!m) return null;
    const t = SMD.t || ((k, e) => e);
    const k = `content.realMissions.${missionKey}`;
    const tr = (field) => (m[field] ? t(`${k}.${field}`, m[field]) : m[field]);
    return {
      ...m,
      fact: tr('fact'),
      powerNote: tr('powerNote'),
      costNote: tr('costNote'),
      massNote: tr('massNote'),
      dataNote: tr('dataNote'),
      related: m.related.map((r, i) => ({ ...r, text: t(`${k}.related.${i}`, r.text) })),
    };
  };
})();
