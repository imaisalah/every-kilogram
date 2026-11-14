// Asset ids -> files, sizes and credits. See docs/CREDITS.md and
// docs/research/nasa-3d-and-textures.md for sources and usage notes.
// Paths are relative to the game root; the loader resolves them from its own URL.
//
// Texture fields: file, lo (optional smaller variant for phones and distant
// views), px [w, h], kb, srgb (false for data maps: heights, cloud alpha), credit.
// Model fields: file, kb, realM (approximate largest real dimension in metres,
// so a scene can show it at true scale), rotate (Euler in radians that turns
// the file to our convention: +Y up, rockets standing up), drop (names of stray
// nodes to remove), credit. All files already load upright, so none needs rotate.

const C = {
  bmng: 'NASA Earth Observatory / Reto Stöckli, Blue Marble Next Generation (July 2004)',
  blackMarble: 'NASA Earth Observatory / Suomi NPP VIIRS, Black Marble 2016',
  clouds: 'NASA Goddard Space Flight Center / Reto Stöckli, Blue Marble cloud composite',
  svsMoon: "NASA's Scientific Visualization Studio, CGI Moon Kit (LRO LROC and LOLA)",
  viking: 'NASA / USGS Astrogeology, Viking MDIM 2.1 colour mosaic (via NASA Trek)',
  mola: 'NASA / JPL / GSFC, MGS MOLA colour shaded relief (USGS, via NASA Trek)',
  magellan: 'NASA / JPL, Magellan radar mosaic (NASA 3D Resources)',
  magellanTopo: 'NASA / JPL Magellan; USGS Astrogeology, C3-MDIR colourised topography',
  cassini: 'NASA / JPL / Space Science Institute, Cassini map of Jupiter (PIA07782)',
  europa: 'NASA / JPL Voyager and Galileo; USGS Astrogeology (T. Becker), Europa global mosaic',
  nasa3d: 'NASA 3D Resources (github.com/nasa/NASA-3D-Resources)',
  clipper: 'NASA / JPL-Caltech, Europa Clipper spacecraft model',
  marsAudio: 'NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero',
};

const SRC = {
  bmng: 'https://earthobservatory.nasa.gov/features/BlueMarble',
  blackMarble: 'https://earthobservatory.nasa.gov/features/NightLights',
  clouds: 'https://visibleearth.nasa.gov/images/57747',
  svsMoon: 'https://svs.gsfc.nasa.gov/4720',
  trek: 'https://trek.nasa.gov/mars/',
  nasa3d: 'https://github.com/nasa/NASA-3D-Resources',
  magellanTopo: 'https://astrogeology.usgs.gov/search/map/venus_magellan_c3_mdir_colorized_topographic_mosaic_6600m',
  cassini: 'https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map/',
  europa: 'https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m',
  clipper: 'https://science.nasa.gov/mission/europa-clipper/',
  marsAudio: 'https://science.nasa.gov/resource/first-audio-recording-of-sounds-on-mars/',
};

const tex = (file, px, kb, credit, source, more = {}) => ({ file: 'assets/textures/' + file, px, kb, srgb: true, credit, source, licence: 'Public domain', ...more });

export const TEXTURES = {
  'earth-day': tex('earth_bmng_july_4k.jpg', [4096, 2048], 1185, C.bmng, SRC.bmng, { title: 'Earth, Blue Marble (July)' }),
  'earth-night': tex('earth_blackmarble2016_3600.jpg', [3600, 1800], 761, C.blackMarble, SRC.blackMarble, { title: 'Earth at night, Black Marble 2016' }),
  'earth-clouds': tex('earth_clouds_2k.jpg', [2048, 1024], 810, C.clouds, SRC.clouds, { title: 'Earth clouds', srgb: false }),
  moon: tex('moon_lroc_color_4k.jpg', [4096, 2048], 1660, C.svsMoon, SRC.svsMoon, { title: 'Moon colour (LRO LROC)', lo: 'assets/textures/moon_lroc_color_2k.jpg' }),
  'moon-height': tex('moon_ldem_1k.jpg', [1024, 512], 109, C.svsMoon, SRC.svsMoon, { title: 'Moon elevation (LRO LOLA)', srgb: false }),
  mars: tex('mars_viking_4k.jpg', [4096, 2048], 2143, C.viking, SRC.trek, { title: 'Mars colour (Viking MDIM 2.1)', lo: 'assets/textures/mars_viking_2k.jpg' }),
  'mars-mola': tex('mars_mola_clrshade_2k.jpg', [2048, 1024], 667, C.mola, SRC.trek, { title: 'Mars elevation (MOLA shaded relief)' }),
  'venus-radar': tex('venus_magellan_radar_nasa3d_1440.jpg', [1440, 720], 1140, C.magellan, SRC.nasa3d, { title: 'Venus surface radar (Magellan)' }),
  'venus-topo': tex('venus_magellan_c3mdir_clrtopo_4k.jpg', [4096, 2048], 2527, C.magellanTopo, SRC.magellanTopo, { title: 'Venus radar and topography (false colour)', lo: 'assets/textures/venus_magellan_c3mdir_clrtopo_2k.jpg' }),
  jupiter: tex('jupiter_cassini_pia07782_3601.jpg', [3601, 1801], 431, C.cassini, SRC.cassini, { title: 'Jupiter (Cassini)' }),
  europa: tex('europa_voyager_galileo_4k.jpg', [4096, 2048], 1718, C.europa, SRC.europa, { title: 'Europa (Voyager and Galileo)', lo: 'assets/textures/europa_voyager_galileo_2k.jpg' }),
};

const mdl = (file, kb, realM, title, more = {}) => ({ file: 'assets/models/' + file, kb, realM, title, credit: C.nasa3d, source: SRC.nasa3d, licence: 'Public domain (NASA media guidelines)', ...more });

export const MODELS = {
  'model-mro': mdl('MRO_A.glb', 2590, 13.6, 'Mars Reconnaissance Orbiter'),
  'model-lro': mdl('LRO_B.glb', 2835, 4.3, 'Lunar Reconnaissance Orbiter'),
  'model-juno': mdl('Juno_B.glb', 256, 20.1, 'Juno'),
  'model-magellan': mdl('Magellan.glb', 3083, 9.2, 'Magellan'),
  'model-clipper': mdl('europa_clipper_web.glb', 4153, 30.5, 'Europa Clipper', { credit: C.clipper, source: SRC.clipper, licence: 'Public domain (JPL image use policy)' }),
  'model-landsat': mdl('Landsat8.glb', 762, 9.8, 'Landsat 8'),
  'model-ssl1300': mdl('SSL1300.glb', 498, 26, 'Commercial geostationary satellite (SSL-1300 bus)'),
  'model-saturnv': mdl('SaturnV.glb', 905, 110.6, 'Saturn V'),
  // Four loose cones sit ~90 m from the rocket in the source file.
  'model-ares1': mdl('Ares1A.glb', 96, 94, 'Ares I', { drop: ['group2_pCo', 'group3_pCo', 'pCone1_gro', 'pCone1_gr1'] }),
  'model-mobile-launcher': mdl('ML_assembled.glb', 194, 116, 'Mobile Launcher'),
  // realM is the largest dimension: for the antenna that is its height (the dish is 34 m across).
  'model-dsn34': mdl('DSN34.glb', 2835, 36.8, 'Deep Space Network 34 m antenna'),
};

export const AUDIO = {
  'mars-sound': {
    file: 'assets/Music/Mars_Mission.mp3',
    title: 'First audio recording of sounds on Mars',
    credit: C.marsAudio,
    source: SRC.marsAudio,
    licence: 'NASA media usage guidelines',
  },
};

export const EXTERNAL_MEDIA = [
  {
    id: 'menu-starfield',
    kind: 'video',
    title: 'Traveling through star fields (Vecteezy asset 34968452)',
    credit: 'Vecteezy; creator attribution per download license',
    licence: 'Vecteezy License Agreement',
    source: 'https://www.vecteezy.com/licensing-agreement',
    file: 'assets/video/starfield-menu.mp4',
  },
];

// Other names that callers have used for the same maps.
export const ALIASES = { earth: 'earth-day', clouds: 'earth-clouds', venus: 'venus-radar', earthDay: 'earth-day', venusRadar: 'venus-radar', marsColor: 'mars', moonColor: 'moon' };

export const ENDORSEMENT = 'Imagery and models courtesy of NASA, NASA/JPL-Caltech, NASA Earth Observatory, NASA SVS, NASA Trek, USGS Astrogeology. Use does not imply NASA endorsement.';

// One row per asset, for a credits screen: { id, kind, title, credit, licence, source, file }.
export const CREDITS = [
  ...Object.entries(TEXTURES).map(([id, t]) => ({ id, kind: 'texture', title: t.title, credit: t.credit, licence: t.licence, source: t.source, file: t.file })),
  ...Object.entries(MODELS).map(([id, m]) => ({ id, kind: 'model', title: m.title, credit: m.credit, licence: m.licence, source: m.source, file: m.file })),
  ...Object.entries(AUDIO).map(([id, a]) => ({ id, kind: 'audio', title: a.title, credit: a.credit, licence: a.licence, source: a.source, file: a.file })),
  ...EXTERNAL_MEDIA,
];
