# Every Kilogram: NASA 3D models and planet textures you can ship

**Bottom line:** every item below is NASA or USGS public domain except the optional Solar System Scope fallback. I downloaded and checked every URL marked **[V]** on 2026-10-26: it returns HTTP 200, and I measured the size and pixel dimensions myself. Items marked **[U]** I did not check. The recommended set is already processed and comes to about 30 MB.

**Ready-to-copy bundle** (37 MB with both the 2k and 4k variants; 4k for Earth/Mars/Venus, 2k for the rest ≈ 30 MB):
- Textures: `C:\Users\abdel\AppData\Local\Temp\claude\c--Users-abdel-Desktop-Projects-Client-Client\77e318db-cbb6-4c2c-b9dd-74673941dd28\scratchpad\out\`
- Models: `...\scratchpad\out\models\`
- Scripts that rebuild the processed files: `...\scratchpad\stitch.py` (joins NASA Trek map tiles into one image) and `...\scratchpad\shrink_glb_tex.py` (shrinks GLB textures).

I did not copy anything into the project.

## 0. Engine notes for the repo (three.js r160 in `vendor/`, no glTF loader yet)

- **Draco compression.** The models in `github.com/nasa/NASA-3D-Resources` were re-exported with Blender 4.2 and use `KHR_draco_mesh_compression`, many also `EXT_texture_webp` (GLTFLoader reads webp natively). You need `GLTFLoader` plus `DRACOLoader` and the Draco decoder files. All of these are [V] 200:
  - `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js` (108 KB)
  - `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js`
  - `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/draco_decoder.wasm` (192 KB)
  - `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js`
  - `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js` (needed for my Europa Clipper web build)
  - `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js` (GLTFLoader imports it)
- **Imports.** GLTFLoader imports `'three'` and `'../utils/BufferGeometryUtils.js'`. Either add an import map pointing `three` at `vendor/three.module.js` or fix the import paths when vendoring.
- **Host files yourself.** Copy the files into the repo rather than hot-linking `raw.githubusercontent.com`, which is rate-limited.

## 1. NASA 3D models

**Licence:** the repo README says the assets are "free and without copyright" and points to the [NASA Images & Media Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). [science.nasa.gov/3d-resources](https://science.nasa.gov/3d-resources/) mirrors the same files: "All of these assets are free to download and use."

**Raw URL base:** `https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/` followed by the folder and file names. Spaces must be `%20`. Brackets can stay as they are.

| Model | Path after base | Size [V] | Content (measured) |
|---|---|---|---|
| **MRO (A)** best | `Mars%20Reconnaissance%20Orbiter%20(MRO)%20(A)/Mars%20Reconnaissance%20Orbiter%20(MRO)%20(A).glb` | 2.65 MB | 88k verts, webp textures, Draco |
| MRO (C) | `Mars%20Reconnaissance%20Orbiter%20(MRO)%20(C)/Mars%20Reconnaissance%20Orbiter%20(MRO)%20(C).glb` | 1.22 MB | 11k verts, textured |
| MRO (B) | `.../(MRO)%20(B).glb` | 16 KB | low-poly placeholder |
| **LRO (B)** best | `Lunar%20Reconnaissance%20Orbiter%20(B)/Lunar%20Reconnaissance%20Orbiter%20(B).glb` | 2.90 MB | 7.5k verts, 10 webp textures |
| LRO (A) | `Lunar%20Reconnaissance%20Orbiter%20(A)/Lunar%20Reconnaissance%20Orbiter%20(A).glb` | 654 KB | 229k verts, no textures (flat colours) |
| **Juno (B)** light | `Juno%20(B)/Juno%20(B).glb` | 262 KB | 90k verts, no textures |
| Juno (A) hero | `Juno%20(A)/Juno%20(A).glb` | 9.0 MB | 24k verts, 14 webp textures (shrink before shipping) |
| **Magellan** | `Magellan/Magellan.glb` | 3.16 MB | 6.7k verts, 6 webp textures |
| **Landsat 8** | `Landsat%208/Landsat%208.glb` | 780 KB | 256k verts, no textures |
| Landsat 7 | `Landsat%207/Landsat%207.glb` | 160 KB | — |
| Terra (Earth observation) | `Terra/Terra.glb` (also `Terra.fbx` 2.8 MB) | 2.15 MB | 61k verts, assimp export, no Draco |
| Generic commercial geostationary bus | `Space%20Systems%20Loral%20(SSL-1300)/Space%20Systems%20Loral%20(SSL-1300).glb` | 510 KB | 248k verts |
| **Satellite Kit** (modular body 1–3, radio 1–3, wings 1–3) | `Satellite%20Kit/Satellite%20Kit%20body%201.glb` etc. | 3–15 KB each | low-poly parts; ideal for snapping together in the spacecraft designer |
| CubeSat 1U / 2U | `CubeSat%20-%202%20RU%20Generic/CubeSat%20-%202%20RU%20Generic.glb` | 206 KB | — |
| **Saturn V** (rocket) | `Saturn%20V/Saturn%20V.glb` | 927 KB | 22k verts, textured |
| Ares I (A) (generic-looking launcher) | `Ares%201%20(A)/Ares%201%20(A).glb` | 98 KB | 14k verts |
| Shuttle solid rocket booster / external tank | `Space%20Shuttle%20Parts/Solid%20Rocket%20Booster.glb`, `.../External%20tank.glb` | 2.67 MB / 848 KB | — |
| **Mobile Launcher (assembled)** = launch tower | `Mobile%20Launcher/Mobile%20Launcher%20(assembled).glb` | 198 KB | 30k verts, textured |
| Mobile Launcher (pad only) | `Mobile%20Launcher/Mobile%20Launcher%20(pad%20only).glb` | 149 KB | — |
| Crawler, Gantry, Vehicle Assembly Building | `Crawler/Crawler.glb`, `Gantry/Gantry.glb`, `Vehicle%20Assembly%20Building%20(VAB)/...glb` | 1.6 / 1.4 / 6.5 MB | — |
| **Deep Space Network 34 m dish** (ground station) | `Deep%20Space%20Network%2034-meter/Deep%20Space%20Network%2034-meter.glb` | 2.90 MB | textured |

Every model folder also has a `.png` preview render.

**Europa Clipper** (not in the GitHub repo; hosted on NASA Science):
- Full spacecraft: `https://assets.science.nasa.gov/content/dam/science/missions/europa-clipper/3d/clipper_spacecraft.glb` [V], 35.7 MB, 352k verts, 16 named nodes (`reason`, `mise`, `eis`, `suda`, `maspex`, `magnetometer`, `solar_cells`, …), so you can highlight individual instruments. I found the filename by probing the NASA asset folder; it is not linked from any page I fetched. It sits next to the instrument models, so treat it as NASA/JPL-Caltech material.
- One normal map inside it weighs 18.6 MB. I rebuilt the file with all textures capped at 1024 px plus meshopt compression: **4.25 MB**, and `gltf-transform validate` reports no errors. That file is at `out/models/europa_clipper_web.glb` and needs `setMeshoptDecoder`.
- Individual instruments, all [V] (from the [Gravity/Radio Science page](https://science.nasa.gov/missions/europa-clipper/europa-clipper-resources/gravityradio-science/) and its sibling pages, same `.../europa-clipper/3d/` folder): `clipper_telecom.glb` 685 KB, `clipper_eis.glb` 496 KB, `clipper_mise.glb` 912 KB, `clipper_reason.glb` 921 KB, `clipper_suda.glb` 842 KB, `clipper_maspex.glb` 1.67 MB, `clipper_pims.glb` 568 KB, `clipper_vault_plate.glb` 1.63 MB. Clicking an instrument could open its own close-up view.
- Printable version (STL only): https://science.nasa.gov/resource/europa-clipper-scale-model-3d-print-version-2025d/

**Not available as NASA GLB:**
- **Falcon 9 / Atlas V:** no NASA model exists. They are company designs and trademarks. Recommendation: build our own generic launchers in code (LatheGeometry with fairing, stages and boosters, sized from the real vehicles' mass and dimension tables), and use Saturn V and Ares I as NASA heritage models.
- **SLS Block 1:** only archives exist.
  - GitHub: `Space%20Launch%20System%20Block%201/Block%201%20(GNC%20markings).7z` (14.2 MB) [V size from repo tree].
  - NASA Science: `https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/space-launch-system-block-1/Block%201%20(GNC%20markings).zip` (64.5 MB) [U].
  - What format is inside is unverified; no 7-Zip was available here to open it.
  - There is also a 3D-printing STL: `3D%20Printing/Space%20Launch%20System%20(SLS)%20Block%201/...stl` (13.7 MB). It would need converting and shrinking.

## 2. Planet and moon maps (equirectangular)

| Body | Source / URL | Pixels [V] | Size | Licence |
|---|---|---|---|---|
| **Earth day** (July, no snow; best for the Nile mission) | `https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x5400x2700.jpg` (mirror: `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x5400x2700.jpg`) | 5400×2700, resized to 4096×2048 | 2.31 MB raw, 1.21 MB at 4k | PD |
| Earth day (December) | `https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg` | 5400×2700 | 2.57 MB | PD |
| **Earth night** (Black Marble 2016) | `https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg` | 3600×1800 | 780 KB | PD |
| Earth night, high resolution | `.../144898/BlackMarble_2016_3km.jpg` | 13500×6750 | 8.1 MB | PD |
| **Earth clouds** | `https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg` | 2048×1024 | 829 KB | PD |
| **Moon colour** (NASA Scientific Visualization Studio CGI Moon Kit, LRO LROC) | `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg` | 2048×1024 | 458 KB | PD |
| Moon 4k | `.../a004720/lroc_color_poles_4k.tif` (12.5 MB TIFF, converted to JPG) | 4096×2048 | 1.70 MB as JPG | PD |
| **Moon height map** | `.../a004720/ldem_3_8bit.jpg` | 1024×512 | 112 KB | PD |
| **Mars colour** (USGS Viking MDIM 2.1 colour mosaic) | stitched from NASA Trek tiles: `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{row}/{col}.jpg` (zoom 3 = 16×8 tiles of 256 px) | 4096×2048 | 2.19 MB (2k: 583 KB) | PD |
| Mars elevation (MOLA colour shaded relief; use for the "buried ice" science overlay) | same tile service, layer `Mars_MGS_MOLA_ClrShade_merge_global_463m`, zoom 2 | 2048×1024 | 683 KB | PD |
| Mars, source GeoTIFF | `https://planetarymaps.usgs.gov/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif` | 92160×46080 | 12.7 GB, unusable | PD |
| **Venus radar** (Magellan, orange-tinted) | `https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/Images%20and%20Textures/Venus/Venus.jpg` | 1440×720 | 1.17 MB | PD |
| Venus radar + topography (USGS Magellan C3-MDIR, false colour) | `https://planetarymaps.usgs.gov/mosaic/Venus_Magellan_C3-MDIR_ClrTopo_Global_Mosaic_6600m.tif` (redirects to S3; use `curl -L`), resized | 5761×2880, resized to 4096×2048 | 49.8 MB raw, 2.59 MB at 4k | PD ("Use constraints: None") |
| **Jupiter** (Cassini, [PIA07782](https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map/)) | `https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia07/pia07782/PIA07782.jpg` | 3601×1801 | 441 KB | PD; credit NASA/JPL/Space Science Institute |
| **Europa** (USGS Voyager–Galileo SSI 500 m mosaic) | `https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif`, resized | 19631×9816, resized to 4096×2048 | 193 MB raw, 1.76 MB at 4k | PD (Access and Use constraints: None) |
| Europa preview | `https://astrogeology.usgs.gov/ckan/dataset/4080036f-afc5-422e-abe9-1c0c8e4f98ea/resource/3647e7b3-425e-4dcf-951b-cc4a22fb0129/download/europa_voyager_galileossi_global_mosaic_500m_1024.jpg` | 1024 wide | 72 KB | PD |
| Starfield (Tycho catalogue) | `https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/Images%20and%20Textures/Tycho%20Star%20Map/Tycho%20Star%20Map.jpg` | 2880×1440 | 4.15 MB (re-save smaller) | PD |
| Starfield (Hipparcos, lighter) | `.../Hipparcos%20Star%20Map/Hipparcos%20Star%20Map.jpg` | 2880×1440 | 2.78 MB | PD |

Other files in the repo's `Images and Textures/` folder that I rejected:
- `Mars/Mars.jpg` and `Jupiter - Europa/...jpg`: 1440×720, lower quality.
- `Jupiter/Jupiter.jpg`: 720×360.
- `Earth (A)`: a topographic map, not true colour.
- `Earth (B)` and `Moon`: photos of the disk, not flat maps.

Caveats on the processed maps:
- **Europa:** the bottom roughly 3% (around the south pole) has no data and is black. Fill it, or fade it out at the pole in the shader.
- **Venus C3-MDIR:** it is false colour; label it as a radar/topography science view. Use the NASA 3D Resources Venus radar map as the "surface" view and a cloud layer from the fallback below.

**Fallback: Solar System Scope**, [solarsystemscope.com/textures](https://www.solarsystemscope.com/textures/). Licence is CC BY 4.0: "You may use, adapt, and share these textures for any purpose, even commercially."
- Files: `https://www.solarsystemscope.com/textures/download/{2k|8k}_{earth_daymap|earth_nightmap|earth_clouds|moon|mars|venus_surface|jupiter|stars_milky_way}.jpg`, plus `2k_` / `4k_venus_atmosphere.jpg`.
- **[U]:** scripted requests get an HTML page back, so download them by hand in a browser.
- The page gives no exact credit wording. CC BY requires one, so use: *"Planet textures: Solar System Scope (solarsystemscope.com), based on NASA imagery, CC BY 4.0."*
- Only worth using for the **Venus cloud layer**: no public-domain NASA global Venus cloud map turned up.

## 3. NASA media usage rules (for the submission)

- **Allowed:** NASA content is "generally not subject to copyright in the United States." It may be used for education, simulations and websites without permission, as long as it is "used in a factual manner that does not imply endorsement."
- **Credit:** "NASA should be acknowledged as the source." For JPL material the [JPL policy](https://www.jpl.nasa.gov/jpl-image-use-policy/) asks for "Courtesy NASA/JPL-Caltech."
- **Logos are not public domain.** The insignia ("meatball"), logotype ("worm") and mission identifiers are "protected by law" and need written approval. NASA also does not allow its insignia "with AI generated imagery."
  - Space Apps terms tell people to use Space Apps branding, never the NASA insignia, logotype or mission logos.
  - Check whether model textures (e.g. Saturn V, SLS markings) carry the meatball or worm, and paint them out.
  - No NASA logo anywhere in our UI.
- **No endorsement:** never phrase things as if NASA backs the game. The only allowed use of the word NASA in branding is inside the Space Apps logo.
- **Third-party material:** images marked with another copyright holder are not covered; contact that holder.
- **AI text:** never write "according to NASA" for AI-generated text, and mark AI output as AI-generated.
- **People:** don't use the likeness of current astronauts or employees.

Sources: [NASA guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/), [JPL policy](https://www.jpl.nasa.gov/jpl-image-use-policy/), [Space Apps navigator terms](https://www.spaceappschallenge.org/navigator-terms-conditions/), [Space Apps brand](https://spaceappschallenge.org/brand).

## 4. Recommended set (≈ 30 MB total, all processed copies in `scratchpad/out/`)

**Textures** (the 4k files total about 14 MB, or about 10 MB if you drop to 2k for Mars and Venus):

| Asset | URL / origin | Size | Licence | Credit line |
|---|---|---|---|---|
| earth_bmng_july_4k.jpg | NASA Earth Observatory 73751, July 5400 px, resized | 1.21 MB | PD | NASA Earth Observatory / Reto Stöckli, Blue Marble Next Generation |
| earth_blackmarble2016_3600.jpg | 144898 `BlackMarble_2016_01deg.jpg` | 0.78 MB | PD | NASA Earth Observatory / Suomi NPP VIIRS, Black Marble 2016 |
| earth_clouds_2k.jpg | 57747 `cloud_combined_2048.jpg` | 0.83 MB | PD | NASA Goddard / Reto Stöckli |
| moon_lroc_color_4k.jpg + moon_ldem_1k.jpg | NASA SVS 4720 | 1.70 + 0.11 MB | PD | NASA's Scientific Visualization Studio (LRO LROC/LOLA) |
| mars_viking_4k.jpg | NASA Trek Viking MDIM 2.1 colour tiles | 2.19 MB | PD | NASA/USGS Viking MDIM 2.1 colour mosaic (via NASA Trek) |
| mars_mola_clrshade_2k.jpg | NASA Trek MOLA tiles | 0.68 MB | PD | NASA/JPL/GSFC MGS MOLA (USGS) |
| venus_magellan_radar_nasa3d_1440.jpg | NASA 3D Resources | 1.17 MB | PD | NASA/JPL Magellan |
| venus_magellan_c3mdir_clrtopo_2k.jpg (science overlay) | USGS 6600 m GeoTIFF, resized | 0.80 MB | PD | NASA/JPL Magellan; USGS Astrogeology |
| jupiter_cassini_pia07782_3601.jpg | PIA07782 | 0.44 MB | PD | NASA/JPL/Space Science Institute |
| europa_voyager_galileo_4k.jpg | USGS 500 m GeoTIFF, resized | 1.76 MB | PD | NASA/JPL Voyager & Galileo; USGS Astrogeology (T. Becker) |
| Starfield: Hipparcos 2880 | NASA 3D Resources | 2.78 MB (≈1 MB re-saved) | PD | NASA 3D Resources |
| Venus clouds (optional) | Solar System Scope `4k_venus_atmosphere.jpg` [U] | ~1 MB | CC BY 4.0 | Solar System Scope, CC BY 4.0 |

**Models** (≈ 16 MB; in `out/models/` except where noted):

| Model | Size |
|---|---|
| MRO (A) | 2.65 MB |
| LRO (B) | 2.90 MB |
| Juno (B) | 0.26 MB |
| Magellan | 3.16 MB |
| europa_clipper_web.glb | 4.25 MB |
| Landsat 8 | 0.78 MB |
| SSL-1300 | 0.51 MB |
| Satellite Kit, all 9 parts (not yet downloaded into the bundle) | 0.07 MB |
| Saturn V | 0.93 MB |
| Ares I (A) | 0.10 MB |
| Mobile Launcher (assembled) | 0.20 MB |
| DSN 34 m (optional) | 2.90 MB |

- Credit for the NASA 3D Resources models: *"3D models: NASA 3D Resources (github.com/nasa/NASA-3D-Resources)."*
- Credit for Europa Clipper: *"Europa Clipper model: NASA/JPL-Caltech."*

**Credits screen text:** "Imagery and models courtesy of NASA, NASA/JPL-Caltech, NASA Earth Observatory, NASA SVS, NASA Trek, USGS Astrogeology. Use does not imply NASA endorsement."

**Unverified [U]:**
- Solar System Scope files (not checked by script).
- SLS archive contents.
- The NASA Science SLS zip URL.
- The exact Black Marble and Blue Marble credit wording: the NASA pages state no credit line, so the lines above are the usual Earth Observatory credits.