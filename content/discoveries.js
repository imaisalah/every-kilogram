// Real NASA discoveries a mission unlocks when enough science comes home
// (GDD §9). A card unlocks when the mission's science score reaches minScore.
// Images are public NASA files, downloaded and resized into assets/discoveries/
// so the game works offline; the credit line must be shown with each image.
// Translation keys: content.discoveries.<id>.title | caption. Credits are
// never translated. fit: 'contain' marks maps and charts that must not be
// cropped (show them whole, e.g. object-fit: contain on a dark backdrop).
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.content = SMD.content || {};

  const img = (id) => `assets/discoveries/${id}.jpg`;
  const EO = 'https://science.nasa.gov/earth/earth-observatory/';
  const PJ = 'https://science.nasa.gov/photojournal/';
  const EO_LANDSAT = (who) => `NASA Earth Observatory images by ${who}, using Landsat data from the U.S. Geological Survey.`;

  SMD.content.discoveries = {
    nile: [
      {
        id: 'nile-oweinat-circles',
        title: 'Green circles in the Sahara',
        caption: 'Each green dot is a field watered by a giant rotating sprinkler, up to about 800 m across. The water is pumped from an ancient underground aquifer that refills extremely slowly.',
        mission: 'Landsat 8',
        instrument: 'OLI',
        year: 2017,
        image: img('nile-oweinat-circles'),
        sourceUrl: `${EO}cultivating-egypts-desert-89820/`,
        credit: EO_LANDSAT('Joshua Stevens'),
        minScore: 0,
      },
      {
        id: 'nile-new-delta',
        title: 'A new delta in the desert',
        caption: 'Egypt is digging canals to carry water into the desert west of the Nile Delta. Between 2018 and 2024, Landsat watched new fields appear where there was only sand.',
        mission: 'Landsat 9',
        instrument: 'OLI-2',
        year: 2024,
        image: img('nile-new-delta'),
        sourceUrl: `${EO}a-new-delta-in-the-desert-153752/`,
        credit: EO_LANDSAT('Lauren Dauphin'),
        minScore: 40,
      },
      {
        id: 'nile-delta-cities',
        title: 'Cities growing over farmland',
        caption: 'Only about 4% of Egypt’s land can be farmed, and much of it is here in the Nile Delta. Landsat images 37 years apart show towns spreading over the green fields.',
        mission: 'Landsat 8',
        instrument: 'OLI',
        year: 2021,
        image: img('nile-delta-cities'),
        sourceUrl: `${EO}the-nile-deltas-disappearing-farmland-149183/`,
        credit: EO_LANDSAT('Lauren Dauphin'),
        minScore: 70,
      },
      {
        id: 'nile-gerd-reservoir',
        title: 'A new lake upstream',
        caption: 'A huge new dam on the Blue Nile in Ethiopia began filling its reservoir, and satellites watched it grow. The Blue Nile supplies about 60% of the Nile’s water, so Egypt watches closely.',
        mission: 'Landsat 8',
        instrument: 'OLI',
        year: 2022,
        image: img('nile-gerd-reservoir'),
        sourceUrl: `${EO}keeping-a-satellite-eye-on-gerd-149699/`,
        credit: EO_LANDSAT('Lauren Dauphin'),
        minScore: 90,
      },
    ],

    weather: [
      {
        id: 'weather-dust-wall',
        title: 'A wall of dust crosses Egypt',
        caption: 'A giant dust storm swept over Egypt and Sudan toward the Red Sea in July 2010. By the afternoon pass, the Nile had almost vanished beneath it.',
        mission: 'Aqua',
        instrument: 'MODIS',
        year: 2010,
        image: img('weather-dust-wall'),
        sourceUrl: `${EO}dust-storm-in-egypt-and-sudan-44659/`,
        credit: 'NASA images courtesy Jeff Schmaltz, MODIS Rapid Response Team at NASA GSFC.',
        minScore: 0,
      },
      {
        id: 'weather-godzilla-plume',
        title: 'A dust cloud the size of an ocean',
        caption: 'In June 2020 one of the largest dust clouds in decades streamed off Africa. It stretched more than 3,000 km across the Atlantic toward the Caribbean.',
        mission: 'Suomi NPP',
        instrument: 'VIIRS',
        year: 2020,
        image: img('weather-godzilla-plume'),
        sourceUrl: 'https://www.nasa.gov/missions/suomi-npp/nasa-observes-large-saharan-dust-plume-over-atlantic-ocean/',
        credit: 'NASA Worldview',
        minScore: 40,
      },
      {
        id: 'weather-dust-feeds-amazon',
        title: 'Desert dust feeds a rainforest',
        caption: 'A laser on the CALIPSO satellite tracked Sahara dust crossing the Atlantic for seven years. About 27.7 million tonnes land on the Amazon each year, and the phosphorus they carry helps fertilize the forest.',
        mission: 'CALIPSO',
        instrument: 'CALIOP lidar',
        year: 2015,
        image: img('weather-dust-feeds-amazon'),
        sourceUrl: 'https://svs.gsfc.nasa.gov/4273/',
        credit: 'NASA’s Scientific Visualization Studio',
        minScore: 70,
      },
      {
        id: 'weather-emit-minerals',
        title: 'What desert dust is made of',
        caption: 'A spectrometer on the Space Station mapped the minerals in the world’s dry lands. Dark, iron-rich dust warms the air, while pale clay dust reflects sunlight and cools it.',
        mission: 'EMIT (International Space Station)',
        instrument: 'Imaging spectrometer',
        year: 2023,
        image: img('weather-emit-minerals'),
        fit: 'contain', // a map or chart: show it whole, do not crop
        sourceUrl: `${PJ}nasas-emit-mission-produces-maps-of-arid-region-surface-minerals`,
        credit: 'NASA/JPL-Caltech',
        minScore: 90,
      },
    ],

    moon: [
      {
        id: 'moon-lcross-impact',
        title: 'Crashing into a crater on purpose',
        caption: 'In 2009 NASA crashed an empty rocket stage into Cabeus crater, and the cloud it threw up contained water. This visualization shows LRO flying past to watch the impact.',
        mission: 'LCROSS and LRO',
        instrument: 'LCROSS spectrometers, LRO Diviner and LEND',
        year: 2009,
        image: img('moon-lcross-impact'),
        sourceUrl: 'https://svs.gsfc.nasa.gov/3760/',
        credit: 'NASA/Goddard Space Flight Center Scientific Visualization Studio',
        minScore: 0,
      },
      {
        id: 'moon-lend-hydrogen',
        title: 'Hydrogen hiding at the south pole',
        caption: 'LRO counted neutrons leaking from the Moon’s soil, which hydrogen slows down. The blue patches mark places that may hold buried ice, such as Cabeus, Shoemaker and Faustini craters.',
        mission: 'LRO',
        instrument: 'LEND neutron detector',
        year: 2015,
        image: img('moon-lend-hydrogen'),
        sourceUrl: 'https://svs.gsfc.nasa.gov/11756/',
        credit: 'NASA’s Goddard Space Flight Center',
        minScore: 40,
      },
      {
        id: 'moon-coldest-crater',
        title: 'Colder than Pluto',
        caption: 'LRO measured −248 °C on the floor of Hermite crater near the Moon’s north pole, the coldest temperature then measured in the Solar System. Places this cold can trap ice for billions of years.',
        mission: 'LRO',
        instrument: 'Diviner radiometer',
        year: 2010,
        image: img('moon-coldest-crater'),
        fit: 'contain', // a map or chart: show it whole, do not crop
        sourceUrl: 'https://svs.gsfc.nasa.gov/10595/',
        credit: 'NASA/Goddard/University of California, Los Angeles',
        minScore: 70,
      },
      {
        id: 'moon-ice-confirmed',
        title: 'Ice confirmed at both poles',
        caption: 'A NASA instrument on India’s Chandrayaan-1 found the infrared fingerprint of water ice in shadowed craters at both poles (the blue dots). There, the warmest it ever gets is about −157 °C.',
        mission: 'Chandrayaan-1 (ISRO)',
        instrument: 'Moon Mineralogy Mapper (M3)',
        year: 2018,
        image: img('moon-ice-confirmed'),
        fit: 'contain', // a map or chart: show it whole, do not crop
        sourceUrl: 'https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles',
        credit: 'NASA',
        minScore: 90,
      },
    ],

    mars: [
      {
        id: 'mars-odyssey-hydrogen',
        title: 'A hydrogen map of Mars',
        caption: 'Mars Odyssey counted neutrons leaking from the soil, and hydrogen in ice slows them down. The deep blue near both poles shows the top metre of ground is rich in ice.',
        mission: 'Mars Odyssey',
        instrument: 'Neutron Spectrometer',
        year: 2002,
        image: img('mars-odyssey-hydrogen'),
        fit: 'contain', // a map or chart: show it whole, do not crop
        sourceUrl: `${PJ}global-map-of-epithermal-neutrons`,
        credit: 'NASA/JPL/University of Arizona/Los Alamos National Laboratories',
        minScore: 0,
      },
      {
        id: 'mars-sharad-ice',
        title: 'A buried ice sheet as big as New Mexico',
        caption: 'Radar pulses from MRO found a hidden ice sheet under Utopia Planitia (the hatched area). It holds about 14,300 km³ of water, about as much as Lake Superior.',
        mission: 'MRO',
        instrument: 'SHARAD radar',
        year: 2016,
        image: img('mars-sharad-ice'),
        fit: 'contain', // a map or chart: show it whole, do not crop
        sourceUrl: `${PJ}location-of-large-subsurface-water-ice-deposit-in-utopia-planitia-mars`,
        credit: 'NASA/JPL-Caltech/Univ. of Rome/ASI/PSI',
        minScore: 40,
      },
      {
        id: 'mars-ice-cliffs',
        title: 'Cliffs of nearly pure ice',
        caption: 'Eroding slopes expose thick layers of nearly pure ice starting only a metre or two below the dust. The blue is enhanced colour that makes the ice stand out.',
        mission: 'MRO',
        instrument: 'HiRISE camera',
        year: 2018,
        image: img('mars-ice-cliffs'),
        sourceUrl: `${PJ}underground-martian-ice-deposit-exposed-at-scarp`,
        credit: 'NASA/JPL-Caltech/UA/USGS',
        minScore: 70,
      },
      {
        id: 'mars-impact-ice',
        title: 'A meteoroid digs up ice',
        caption: 'A space rock hit Mars on 24 December 2021 and threw out boulder-sized chunks of ice around a 150 m crater. It is the closest to the equator that buried ice has ever been found, where future crews might land.',
        mission: 'MRO',
        instrument: 'HiRISE camera',
        year: 2022,
        image: img('mars-impact-ice'),
        sourceUrl: `${PJ}hirise-views-a-mars-impact-crater-surrounded-by-water-ice/`,
        credit: 'NASA/JPL-Caltech/University of Arizona',
        minScore: 90,
      },
    ],

    venus: [
      {
        id: 'venus-global-radar',
        title: 'Seeing through the clouds',
        caption: 'Thick clouds hide Venus completely, but radar passes straight through them. Magellan mapped 98% of the surface this way in the early 1990s.',
        mission: 'Magellan',
        instrument: 'Synthetic aperture radar',
        year: 1991,
        image: img('venus-global-radar'),
        sourceUrl: `${PJ}venus-computer-simulated-global-view-centered-at-180-degrees-east-longitude`,
        credit: 'NASA/JPL',
        minScore: 0,
      },
      {
        id: 'venus-maat-mons',
        title: 'A volcano caught changing',
        caption: 'Scientists compared Magellan radar images of Maat Mons taken eight months apart in 1991. A volcanic vent had doubled in size, the first direct sign of a recent eruption on Venus.',
        mission: 'Magellan',
        instrument: 'Synthetic aperture radar',
        year: 2023,
        image: img('venus-maat-mons'),
        sourceUrl: 'https://www.nasa.gov/solar-system/nasas-magellan-data-reveals-volcanic-activity-on-venus/',
        credit: 'NASA/JPL',
        minScore: 60,
      },
      {
        id: 'venus-sif-mons-flows',
        title: 'Fresh lava on Sif Mons',
        caption: 'A second study found new lava flows that appeared during Magellan’s mission, about 30 km² of fresh rock at Sif Mons. Venus is volcanically alive, and NASA’s planned VERITAS orbiter will look for more.',
        mission: 'Magellan',
        instrument: 'Synthetic aperture radar',
        year: 2024,
        image: img('venus-sif-mons-flows'),
        sourceUrl: 'https://www.nasa.gov/centers-and-facilities/jpl/ongoing-venus-volcanic-activity-discovered-with-nasas-magellan-data',
        credit: 'NASA/JPL',
        minScore: 85,
      },
    ],

    jupiter: [
      {
        id: 'europa-galileo-color',
        title: 'A moon wrapped in cracked ice',
        caption: 'Europa’s icy surface is criss-crossed by long reddish cracks and ridges. This colour view was rebuilt from Galileo spacecraft images taken in the late 1990s.',
        mission: 'Galileo',
        instrument: 'Solid State Imager',
        year: 2014,
        image: img('europa-galileo-color'),
        sourceUrl: `${PJ}europas-stunning-surface-2`,
        credit: 'NASA/JPL-Caltech/SETI Institute',
        minScore: 0,
      },
      {
        id: 'europa-hidden-ocean',
        title: 'An ocean under the ice',
        caption: 'Galileo’s magnetometer felt Europa bending Jupiter’s magnetic field, just as a salty ocean would. This cutaway shows the idea: an ice shell over liquid water, around a rocky interior.',
        mission: 'Galileo',
        instrument: 'Magnetometer',
        year: 2000,
        image: img('europa-hidden-ocean'),
        sourceUrl: `${PJ}pj-interior-of-europa`,
        credit: 'NASA/JPL',
        minScore: 40,
      },
      {
        id: 'europa-plume',
        title: 'A plume in the same spot, twice',
        caption: 'Hubble saw what looks like a plume of water vapour rising from Europa in 2014 and again in 2016, in the same place. It might be ocean water escaping into space.',
        mission: 'Hubble Space Telescope',
        instrument: 'STIS',
        year: 2017,
        image: img('europa-plume'),
        fit: 'contain', // a map or chart: show it whole, do not crop
        sourceUrl: `${PJ}hubble-sees-recurring-plume-erupting-from-europa`,
        credit: 'NASA/ESA/W. Sparks (STScI)/USGS Astrogeology Science Center',
        minScore: 70,
      },
      {
        id: 'europa-ice-thickness',
        title: 'How thick is the ice? About 29 km',
        caption: 'On the flyby that took this picture, Juno’s microwave radiometer sensed heat rising through the ice. Where it looked, the cold outer shell is about 29 km thick, so the ocean lies deep below.',
        mission: 'Juno',
        instrument: 'Microwave Radiometer (image: JunoCam)',
        year: 2025,
        image: img('europa-ice-thickness'),
        sourceUrl: 'https://www.nasa.gov/missions/juno/nasas-juno-measures-thickness-of-europas-ice-shell/',
        credit: 'NASA/JPL-Caltech/SwRI/MSSS',
        minScore: 90,
      },
    ],
  };

  // Every discovery in one list (for the archive), with its mission key.
  SMD.content.allDiscoveries = function allDiscoveries() {
    const out = [];
    Object.entries(SMD.content.discoveries).forEach(([missionKey, list]) => list.forEach((d) => out.push({ ...d, missionKey })));
    return out;
  };

  // A discovery by id, with title and caption translated.
  SMD.content.discovery = function discovery(id) {
    const d = SMD.content.allDiscoveries().find((x) => x.id === id);
    if (!d) return null;
    const t = SMD.t || ((k, e) => e);
    return { ...d, title: t(`content.discoveries.${id}.title`, d.title), caption: t(`content.discoveries.${id}.caption`, d.caption) };
  };
})();
