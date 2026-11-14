# Credits

> Imagery and models courtesy of NASA, NASA/JPL-Caltech, NASA Earth Observatory, NASA SVS, NASA Trek, USGS Astrogeology. Use does not imply NASA endorsement.

Every Kilogram was made for the NASA Space Apps Challenge 2026 (Space Mission Design Game). It is not a NASA product and is not endorsed by NASA. The game uses no NASA insignia ("meatball"), logotype ("worm") or mission logos. We checked every texture inside the 3D models listed below and found none. The only markings are the historical US flags and "USA" / "UNITED STATES" lettering on the Saturn V.

The game reads this same list at run time from `js/3d/assetmanifest.js` (`CREDITS`, with `SMD.assets.credits` and `SMD.assets.endorsement`). If you add an asset, update both.

## Planet and moon maps (`assets/textures/`)

All maps are equirectangular (simple cylindrical) and in the public domain. Some were resized or stitched; how each one was made is described in `docs/research/nasa-3d-and-textures.md`.

| Id | File | Pixels | Credit | Licence | Source |
|---|---|---|---|---|---|
| `earth-day` | earth_bmng_july_4k.jpg | 4096×2048 | NASA Earth Observatory / Reto Stöckli, Blue Marble Next Generation (July 2004), resized from 5400×2700 | Public domain | earthobservatory.nasa.gov (image record 73751) |
| `earth-night` | earth_blackmarble2016_3600.jpg | 3600×1800 | NASA Earth Observatory / Suomi NPP VIIRS, Black Marble 2016 | Public domain | earthobservatory.nasa.gov (image record 144898) |
| `earth-clouds` | earth_clouds_2k.jpg | 2048×1024 | NASA Goddard Space Flight Center / Reto Stöckli, Blue Marble cloud composite | Public domain | visibleearth.nasa.gov/images/57747 |
| `moon` | moon_lroc_color_4k.jpg (2k: moon_lroc_color_2k.jpg) | 4096×2048 | NASA's Scientific Visualization Studio, CGI Moon Kit (LRO LROC colour), 4k converted from TIFF | Public domain | svs.gsfc.nasa.gov/4720 |
| `moon-height` | moon_ldem_1k.jpg | 1024×512 | NASA's Scientific Visualization Studio, CGI Moon Kit (LRO LOLA elevation) | Public domain | svs.gsfc.nasa.gov/4720 |
| `mars` | mars_viking_4k.jpg (2k: mars_viking_2k.jpg) | 4096×2048 | NASA / USGS Astrogeology, Viking MDIM 2.1 colour mosaic, stitched from NASA Trek map tiles | Public domain | trek.nasa.gov/mars |
| `mars-mola` | mars_mola_clrshade_2k.jpg | 2048×1024 | NASA / JPL / GSFC, MGS MOLA colour shaded relief (USGS), stitched from NASA Trek map tiles | Public domain | trek.nasa.gov/mars |
| `venus-radar` | venus_magellan_radar_nasa3d_1440.jpg | 1440×720 | NASA / JPL, Magellan radar mosaic (NASA 3D Resources) | Public domain | github.com/nasa/NASA-3D-Resources |
| `venus-topo` | venus_magellan_c3mdir_clrtopo_4k.jpg (2k: venus_magellan_c3mdir_clrtopo_2k.jpg) | 4096×2048 | NASA / JPL Magellan; USGS Astrogeology, C3-MDIR colourised topography (false colour, a science view), resized from 5761×2880 | Public domain (USGS: "Use constraints: None") | astrogeology.usgs.gov |
| `jupiter` | jupiter_cassini_pia07782_3601.jpg | 3601×1801 | NASA / JPL / Space Science Institute, Cassini cylindrical map of Jupiter (PIA07782) | Public domain | science.nasa.gov/photojournal (PIA07782) |
| `europa` | europa_voyager_galileo_4k.jpg (2k: europa_voyager_galileo_2k.jpg) | 4096×2048 | NASA / JPL Voyager and Galileo; USGS Astrogeology (T. Becker), Europa global mosaic 500 m, resized from 19631×9816 | Public domain (USGS: "Access and use constraints: None") | astrogeology.usgs.gov |

Notes:
- Europa's mosaic has no data south of about −83°. The game fills that cap with the map's average grey.
- Venus is shown as the Magellan radar surface under a thin cloud veil drawn by the game, because no public-domain global map of the Venus clouds exists. The veil is procedural, not NASA data.

## 3D models (`assets/models/`)

NASA 3D Resources says these files are "free and without copyright" and points to the [NASA Images and Media Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). They are used here in a factual way that does not imply endorsement.

| Id | File | Model | Credit | Source |
|---|---|---|---|---|
| `model-mro` | MRO_A.glb | Mars Reconnaissance Orbiter (A) | NASA 3D Resources | github.com/nasa/NASA-3D-Resources |
| `model-lro` | LRO_B.glb | Lunar Reconnaissance Orbiter (B) | NASA 3D Resources | github.com/nasa/NASA-3D-Resources |
| `model-juno` | Juno_B.glb | Juno (B) | NASA 3D Resources | github.com/nasa/NASA-3D-Resources |
| `model-magellan` | Magellan.glb | Magellan | NASA 3D Resources | github.com/nasa/NASA-3D-Resources |
| `model-landsat` | Landsat8.glb | Landsat 8 | NASA 3D Resources | github.com/nasa/NASA-3D-Resources |
| `model-ssl1300` | SSL1300.glb | Commercial geostationary satellite (SSL-1300 bus) | NASA 3D Resources | github.com/nasa/NASA-3D-Resources |
| `model-saturnv` | SaturnV.glb | Saturn V | NASA 3D Resources | github.com/nasa/NASA-3D-Resources |
| `model-ares1` | Ares1A.glb | Ares I (A) | NASA 3D Resources | github.com/nasa/NASA-3D-Resources |
| `model-mobile-launcher` | ML_assembled.glb | Mobile Launcher (assembled) | NASA 3D Resources | github.com/nasa/NASA-3D-Resources |
| `model-dsn34` | DSN34.glb | Deep Space Network 34 m antenna | NASA 3D Resources | github.com/nasa/NASA-3D-Resources |
| `model-clipper` | europa_clipper_web.glb | Europa Clipper spacecraft | NASA / JPL-Caltech ("Courtesy NASA/JPL-Caltech", JPL image use policy) | science.nasa.gov/mission/europa-clipper |

Notes:
- The Europa Clipper model is a rebuild of NASA's `clipper_spacecraft.glb` (35.7 MB). Its textures are capped at 1024 px and its meshes use meshopt compression, which brings it to 4.25 MB.
- Ares I: the game removes four loose cones that sit about 90 m from the rocket in the source file.
- The `realM` sizes in the manifest are approximate largest dimensions, used only to draw the models at roughly true scale.

## Audio (`assets/Music/`)

| File | Description | Credit | Usage/source |
|---|---|---|---|
| `Mars_Mission.mp3` | 20-second mono MP3 (48 kHz) converted from the supplied `scam-mic-sol001-run001.wav`; used as a looping Mars-mission background sound | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero | NASA Science, [First Audio Recording of Sounds on Mars](https://science.nasa.gov/resource/first-audio-recording-of-sounds-on-mars/). NASA media usage guidelines; use does not imply NASA endorsement. |

## Menu video (`assets/video/`)

| File | Description | Credit/source |
|---|---|---|
| `starfield-menu.mp4` | Vecteezy stock video asset 34968452, re-encoded for the post-Play lobby background | Vecteezy; confirm the creator attribution and license from the download record. See the [Vecteezy License Agreement](https://www.vecteezy.com/licensing-agreement). |

## Characters (`assets/models/characters/`)

The Last Light and career characters are built from two free Quaternius packs, both **CC0** (public domain dedication; no attribution required, credited here anyway). The pack pages and the Quaternius FAQ state the licence: "All models are under the CC0 License."

| File | From | Author | Licence | Source |
|---|---|---|---|---|
| `ek-body-m.glb`, `ek-body-f.glb`, `ek-hair.glb` | Universal Base Characters (Standard), male and female bodies and rigged hairstyles | Quaternius | CC0 | quaternius.com/packs/universalbasecharacters.html |
| `ek-anims.glb` | Universal Animation Library (Standard), `UAL1_Standard.glb`, trimmed to the clips the game uses | Quaternius | CC0 | quaternius.com/packs/universalanimationlibrary.html |

Changes: textures reduced, unused meshes and clips removed by `assets/models/characters/build/` (`build.js`, `run.mjs`; needs the unzipped packs). At run time `js/3d/character.js` adds face morphs, clothes generated from the body surface and recolours each character. `build/GLTFExporter.js` and `build/TextureUtils.js` are from three.js r160 (MIT), used only by that build step. `vendor/SkeletonUtils.js` is from three.js r160 (MIT).

## Code

| Component | Licence |
|---|---|
| three.js r160 (`vendor/three.module.js`, `OrbitControls.js`, `RoomEnvironment.js`, `GLTFLoader.js`, `DRACOLoader.js`, `BufferGeometryUtils.js`, `meshopt_decoder.module.js`; the post-processing examples for Last Light, unchanged from `examples/jsm` of three@0.160.0: `vendor/postprocessing/` EffectComposer, Pass, RenderPass, ShaderPass, MaskPass, OutputPass, UnrealBloomPass, GTAOPass, SMAAPass; `vendor/shaders/` CopyShader, OutputShader, LuminosityHighPassShader, GTAOShader, PoissonDenoiseShader, SMAAShader, FXAAShader; `vendor/math/SimplexNoise.js`) | MIT, © 2010–2023 three.js authors (`vendor/three-LICENSE.txt`) |
| Draco decoder (`vendor/draco/`) | Apache 2.0, © Google (shipped with three.js r160) |
| meshoptimizer decoder (inside `meshopt_decoder.module.js`) | MIT, © Arseny Kapoulkine |
| PeerJS 1.5.4 (`vendor/peerjs-1.5.4.min.js`, unchanged `dist/peerjs.min.js`, connects players directly over WebRTC; uses the free public PeerJS broker and Google's public STUN servers) | MIT, © 2015 Michelle Bu and Eric Zhang (github.com/peers/peerjs) |
| QR Code Generator for JavaScript, qrcode-generator 1.4.4 (`vendor/qrcode.js`, unchanged, draws the join link for phones) | MIT, © 2009 Kazuhiko Arase (github.com/kazuhikoarase/qrcode-generator). "QR Code" is a registered trademark of DENSO WAVE INCORPORATED. |
| Archivo typeface (`assets/fonts/archivo-*.woff2`) | SIL Open Font License 1.1, © 2020 The Archivo Project Authors (github.com/Omnibus-Type/Archivo), `assets/fonts/OFL-Archivo.txt` |
| Noto Kufi Arabic (`assets/fonts/noto-kufi-arabic.woff2`) | SIL Open Font License 1.1, © 2022 The Noto Project Authors (github.com/notofonts/arabic), `assets/fonts/OFL-NotoKufiArabic.txt` |

## NASA media rules we follow

- NASA content is generally not under copyright in the United States. It may be used for education and simulations when it is used factually and does not imply endorsement.
- We acknowledge NASA as the source, and use "Courtesy NASA/JPL-Caltech" for JPL material.
- NASA insignia, logotype and mission identifiers are not public domain. None of them appears in the game.
- We never write "according to NASA" for text that we or an AI wrote.
