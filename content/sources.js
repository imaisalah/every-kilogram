// Where every number and rule in the game comes from (GDD §9). Screens show
// these as source tooltips: SMD.content.source(key) returns { text, url } with
// the text already translated (key content.sources.<key>).
// Values in js/data.js are simplified game numbers; each text says what the
// real number is, so the tooltip never claims more precision than the game has.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.content = SMD.content || {};

  const NSSDC = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/';
  const MRO_KIT = 'https://www.jpl.nasa.gov/news/press_kits/mro-launch-Aug05.pdf';

  SMD.content.sources = {
    // ---------- Power ----------
    solarFlux: {
      text: 'Sunlight carries 1,361 W per square metre at Earth’s distance and falls with the square of the distance (1/r²).',
      url: `${NSSDC}earthfact.html`,
    },
    solarMars: { text: 'Sunlight at Mars: about 586 W per square metre, 43% of Earth’s.', url: `${NSSDC}marsfact.html` },
    solarJupiter: { text: 'Sunlight at Jupiter: about 50 W per square metre, roughly 27 times weaker than at Earth.', url: `${NSSDC}jupiterfact.html` },
    solarVenus: { text: 'Venus is closer to the Sun, so panels get almost twice Earth’s sunlight, but they run hot and lose efficiency.', url: `${NSSDC}venusfact.html` },
    clipperArrays: {
      text: 'Europa Clipper’s two arrays are each 14.2 m × 4.1 m and give roughly 700 W at Jupiter.',
      url: 'https://www.jpl.nasa.gov/news/nasas-europa-clipper-gets-set-of-super-size-solar-arrays/',
    },
    junoPower: {
      text: 'Juno’s three 9 m solar wings (18,698 cells) make about 14 kW near Earth and about 500 W at Jupiter.',
      url: 'https://www.jpl.nasa.gov/news/nasas-juno-spacecraft-breaks-solar-power-distance-record',
    },
    rtg: {
      text: 'A Multi-Mission RTG makes about 110 W of electricity at launch from the heat of plutonium-238, fading a few percent per year.',
      url: 'https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf',
    },
    mroPower: { text: 'MRO’s 20 m² of solar panels gave about 6,000 W at Earth and 2,000 W at Mars.', url: MRO_KIT },

    // ---------- Propulsion and mass ----------
    rocketEquation: {
      text: 'Propellant comes from the ideal rocket equation: Δv = Isp × g₀ × ln(wet mass ÷ dry mass). Extra mass needs extra propellant, which is more mass.',
      url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/',
    },
    isp: {
      text: 'The game uses Isp 320 s, a round value for storable bipropellant engines. Juno’s main engine is rated about 318 s; NASA research engines aim for 330–335 s.',
      url: 'https://ntrs.nasa.gov/citations/20070031975',
    },
    mroMass: { text: 'MRO launched at 2,180 kg: 139 kg of instruments, 892 kg of other dry mass and 1,149 kg of propellant.', url: MRO_KIT },
    clipperMass: { text: 'Europa Clipper launched at about 5,800 kg, of which about 2,750 kg was propellant.', url: 'https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/' },
    aerobraking: {
      text: 'Aerobraking: MRO used hundreds of careful dips into Mars’ upper air over about six months to shrink its orbit, saving propellant.',
      url: MRO_KIT,
    },
    radiationVault: {
      text: 'Europa Clipper keeps its electronics inside an aluminium vault about 1 cm thick to survive Jupiter’s radiation.',
      url: 'https://europa.nasa.gov/news/96/how-nasa-is-protecting-europa-clipper-from-space-radiation',
    },

    // ---------- Trajectories and launch windows ----------
    ephemeris: {
      text: 'Planet positions come from JPL’s approximate orbital elements (Keplerian elements valid 1800–2050).',
      url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
    },
    lambert: {
      text: 'Launch windows come from solving Lambert’s problem (the transfer orbit between two positions in a given time) on those elements. NASA’s Trajectory Browser lists real options to compare.',
      url: 'https://trajbrowser.arc.nasa.gov/',
    },
    c3: {
      text: 'C3 is launch energy (km²/s²): the energy per kilogram left over after escaping Earth. Higher C3 means a rocket can lift less mass.',
      url: 'https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/',
    },
    marsWindow: { text: 'A launch window to Mars opens about every 26 months.', url: 'https://nssdc.gsfc.nasa.gov/planetary/mars/marslaun.html' },
    missedWindow: {
      text: 'InSight missed the 2016 Mars window because of an instrument leak, waited 26 months and cost about $153.8M more.',
      url: 'https://spacepolicyonline.com/news/vacuum-leaks-delay-launch-of-nasas-insight-mars-mission/',
    },
    jupiterRoute: {
      text: 'Europa Clipper took 5½ years and gravity assists at Mars (2025) and Earth (December 2026) to reach Jupiter in April 2030.',
      url: 'https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/',
    },

    // ---------- Communications ----------
    dataRate: {
      text: 'Data rate grows with transmitter power and with dish area (diameter squared), and falls with distance squared. This is the radio link equation.',
      url: 'https://deepspace.jpl.nasa.gov/dsndocs/810-005/',
    },
    dsn: {
      text: 'NASA’s Deep Space Network has three antenna complexes around the globe, with 34 m and 70 m dishes.',
      url: 'https://www.nasa.gov/communicating-with-missions/dsn/',
    },
    mroLink: { text: 'MRO’s 3 m dish and 100 W radio can send up to 6 Mbps from Mars, more at close range and less far away.', url: MRO_KIT },
    lightTime: {
      text: 'Radio travels at the speed of light. When MRO arrived at Mars in 2006, a signal took 12 minutes one way, so nothing can be steered live.',
      url: MRO_KIT,
    },
    conjunction: {
      text: 'About every 26 months Mars passes behind the Sun as seen from Earth, and radio signals cannot be received reliably.',
      url: MRO_KIT,
    },
    galileoAntenna: { text: 'Galileo’s stuck antenna cut its planned 134 kbps to a few bits per second; compression and arrayed antennas raised it to about 1,000 bps.', url: 'https://llis.nasa.gov/lesson/492' },

    // ---------- Instruments and science ----------
    hirise: { text: 'MRO’s HiRISE camera takes pictures with 30 cm pixels from 300 km up.', url: MRO_KIT },
    landsatRevisit: { text: 'Landsat 8 and 9 together image all of Earth every 8 days. Landsat 9’s OLI-2 has 30 m pixels and a 185 km wide view.', url: 'https://svs.gsfc.nasa.gov/13917/' },
    neutronDepth: { text: 'Neutron spectrometers count neutrons leaking from the ground; hydrogen (in ice) slows them, revealing ice in roughly the top metre.', url: 'https://science.nasa.gov/photojournal/global-map-of-epithermal-neutrons' },
    sharad: { text: 'MRO’s SHARAD radar found a buried ice sheet holding about 14,300 km³ of water under Utopia Planitia.', url: 'https://science.nasa.gov/photojournal/location-of-large-subsurface-water-ice-deposit-in-utopia-planitia-mars' },
    venusSurface: { text: 'Venus’s surface averages 464 °C under 92 bar of pressure.', url: `${NSSDC}venusfact.html` },
    magellanCoverage: { text: 'Magellan’s radar mapped 98% of Venus through the clouds and returned 1,200 gigabits of data.', url: 'https://science.nasa.gov/mission/magellan/' },
    europaIce: { text: 'Juno’s microwave radiometer suggests Europa’s cold outer ice shell is about 29 km thick where it looked.', url: 'https://www.nasa.gov/missions/juno/nasas-juno-measures-thickness-of-europas-ice-shell/' },

    // ---------- Money and management ----------
    discoveryReserve: {
      text: 'NASA Discovery missions must hold at least 25% of Phases A–D as reserve inside the cost cap.',
      url: 'https://astrobiology.nasa.gov/nai/articles/2017/12/15/nasa-discovery-program-announcement-of-opportunity-long-range-planning-information',
    },
    jcl: {
      text: 'NASA budgets big projects at a 70% joint cost and schedule confidence level; the extra money is held as reserve (UFE).',
      url: 'https://explorers.larc.nasa.gov/APMIDEX2016/MO/pdf_files/5_SPD-19_PI-ledmissions_70JCL.pdf',
    },
    congressBreach: {
      text: 'By law, NASA must notify Congress if a major project’s cost grows 15% or a milestone slips 6 months. Above 30% growth, Congress must reauthorize it.',
      url: 'https://www.law.cornell.edu/uscode/text/51/30104',
    },
    gaoReport: {
      text: 'Government auditors (GAO) publish a yearly scorecard of NASA’s major projects. The 2026 report covers 36 projects.',
      url: 'https://files.gao.gov/reports/GAO-26-108556/index.html',
    },
    reserveReturned: {
      text: 'IMAP launched 3 months early and returned $22.2M of unused reserves.',
      url: 'https://files.gao.gov/reports/GAO-26-108556/index.html',
    },
    budgetRequest: {
      text: 'The FY2027 budget request proposed cutting NASA science by about 46%; Congress has pushed back.',
      url: 'https://www.planetary.org/articles/analyzing-the-fy-2027-nasa-budget-request',
    },
    workforce: {
      text: 'Psyche slipped more than a year when too few people were spread across too many projects; VERITAS was delayed to free staff.',
      url: 'https://www.nasa.gov/missions/psyche-mission/review-board-nasa-jpl-psyche-progress-outstanding-launch-on-track/',
    },
    launcherAllIn: {
      text: 'NASA launch contracts include processing on top of the rocket: Landsat 9 on Atlas V 401 cost $153.8M, Europa Clipper on Falcon Heavy $178M, Dragonfly on Falcon Heavy $256.6M.',
      url: 'https://www.nasa.gov/news-release/nasa-awards-launch-services-contract-for-dragonfly-mission/',
    },
    launcherClasses: {
      text: 'The game’s light, medium and heavy launchers are generic classes. Real examples: a Falcon Heavy can send about 16,800 kg toward Mars; a Vulcan Centaur lifts up to 27,200 kg to low orbit.',
      url: 'https://www.ulalaunch.com/rockets/vulcan-centaur',
    },

    // ---------- Life cycle and reviews ----------
    lifecycle: {
      text: 'NASA projects move through Phases A to F, with a Key Decision Point between each phase.',
      url: 'https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/',
    },
    reviews: {
      text: 'Review names are NASA’s: Mission Concept Review (MCR), Preliminary Design Review (PDR), Critical Design Review (CDR) and Flight Readiness Review (FRR).',
      url: 'https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/',
    },
    trl: {
      text: 'Technology Readiness Levels run from 1 (idea) to 9 (flown). NASA wants new technology proven in a realistic test, TRL 6, before the design is fixed.',
      url: 'https://www.nasa.gov/reference/appendix-g-technology-assessment-insertion/',
    },
    testing: {
      text: 'Test as you fly: Mars Polar Lander’s fatal software problem went unseen because a test was run with mis-wired sensors and never repeated.',
      url: 'https://ntrs.nasa.gov/api/citations/20000061966/downloads/20000061966.pdf',
    },
    heritage: {
      text: 'Heritage is not free: Genesis reused a proven design, but its g-switches were installed upside down and its parachute never opened.',
      url: 'https://appel.nasa.gov/2011/08/29/ata_4-6_genesis_launches-html/',
    },
    singleString: {
      text: 'One computer is fragile: Beresheet’s reset command in a crisis shut down its engine.',
      url: 'https://www.planetary.org/articles/software-command-doomed-beresheet',
    },
    lessons: { text: 'NASA keeps a public database of lessons learned from past projects.', url: 'https://llis.nasa.gov/' },
    // ---------- Crew around the Moon (Artemis II) ----------
    artemis2: {
      text: 'Artemis II launched four astronauts on 1 April 2026 and splashed down on 10 April after 9 days, 1 hour and 32 minutes, the first crew beyond low Earth orbit since 1972.',
      url: 'https://www.nasa.gov/mission/artemis-ii/',
    },
    artemis2Flyby: {
      text: 'On 6 April 2026 Artemis II passed 6,545 km above the far side and reached 406,771 km from Earth, a new human distance record (Apollo 13: 400,171 km).',
      url: 'https://www.nasa.gov/mission/artemis-ii/',
    },
    slsLift: {
      text: 'SLS Block 1 can send more than 27 metric tons to the Moon, with two five-segment solid boosters and four RS-25 engines. In the game the super heavy launcher lifts 27 t.',
      url: 'https://www.nasa.gov/reference/space-launch-system/',
    },
    slsAscent: {
      text: 'On Artemis II: max-Q about 1 min 10 s after liftoff, booster separation at about 2 min 8 s, abort tower jettison at 3 min 18 s, core stage cutoff just after 8 minutes.',
      url: 'https://www.nasa.gov/humans-in-space/space-launch-system/',
    },
    orionMass: {
      text: 'Orion’s crew module weighs about 10,400 kg at launch; the European Service Module 15,461 kg with 8,600 kg of propellant; 33,446 kg with the abort system. The game’s stack carries less propellant because a free return needs less.',
      url: 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Orion',
    },
    orionTli: {
      text: 'Artemis II’s translunar burn was made by the European Service Module’s main engine: 5 minutes 49 seconds, 1,274 ft/s (388 m/s).',
      url: 'https://www.nasa.gov/blogs/missions/2026/04/02/artemis-ii-flight-update-perigee-raise-burn-complete/',
    },
    orionLas: {
      text: 'Orion’s launch abort system has three solid motors. The abort motor makes nearly 400,000 lb of thrust within milliseconds to pull the capsule away from a failing rocket. It weighs about 7.7 t and is dropped 3 min 18 s into a normal climb.',
      url: 'https://www.nasa.gov/reference/launch-abort-system/',
    },
    orionHeatShield: {
      text: 'Orion comes home at about 11 km/s (Mach 33) behind the largest heat shield of its kind. On Artemis I its Avcoat lost char because gases could not escape during the skip entry; Artemis II flew a shorter entry instead.',
      url: 'https://www.nasa.gov/missions/artemis/nasa-identifies-cause-of-artemis-i-orion-heat-shield-char-loss/',
    },
    orionShelter: {
      text: 'If the Sun erupts, Orion’s crew builds a storm shelter from the stowage bags on board within an hour, adding mass around themselves instead of carrying a heavy vault.',
      url: 'https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/',
    },
    orionLifeSupport: {
      text: 'Orion’s life support is designed for four people for up to 21 days away from a space station. On Artemis II a water-system valve and the toilet both needed fixing in flight. The game’s spare-day rule is a simplification.',
      url: 'https://www.nasa.gov/mission/artemis-ii/',
    },
    apollo13: {
      text: 'Apollo 13’s oxygen tank exploded about 56 hours into the flight; its heater switches had been damaged by the wrong voltage on the ground. The free-return loop brought the crew home.',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/ap13acc.html',
    },
    artemisCost: {
      text: 'NASA’s Inspector General estimated about $4.1 billion for each early Artemis launch (SLS, Orion and ground systems). Game costs are scaled down like every other mission.',
      url: 'https://oig.nasa.gov/docs/IG-22-003.pdf',
    },
    imagery: {
      text: 'Imagery and models courtesy of NASA, NASA/JPL-Caltech, NASA Earth Observatory, NASA SVS, NASA Trek, USGS Astrogeology. Use does not imply NASA endorsement.',
      url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    },
  };

  // Translated tooltip for a source key, or null for an unknown key.
  SMD.content.source = function source(key) {
    const s = SMD.content.sources[key];
    if (!s) return null;
    return { key, text: SMD.t ? SMD.t(`content.sources.${key}`, s.text) : s.text, url: s.url };
  };
})();
