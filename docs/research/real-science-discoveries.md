# "Every Kilogram": real NASA discoveries to reveal when a mission succeeds

Every image URL below was checked with curl on 2026-10-26 and returned HTTP 200 with an image type. All the images come from NASA. Where other agencies or citizen processors are involved, the credit line names them.

## 0. Image URL rules found while checking (these affect the build)

1. **Photojournal direct links no longer work.** `https://photojournal.jpl.nasa.gov/jpeg/PIAxxxxx.jpg` now 301-redirects to the Photojournal home page, so it will not load as an image. Catalog pages (`/catalog/PIAxxxxx`) redirect to `science.nasa.gov/photojournal/<slug>`.
   - The working file pattern is `https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia{NN}/pia{NNNNN}/PIA{NNNNN}.jpg`, where NN is the first two digits. Replacing `.jpg` with `.tif` gives the full-resolution file.
2. **Earth Observatory has moved.** It now lives at `science.nasa.gov/earth/earth-observatory/<slug>-<id>/`. The images are at `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/<bucket>/<id>/<file>_lrg.jpg`.
3. **CORS, which matters for three.js textures:**
   - `assets.science.nasa.gov` and `www.nasa.gov/wp-content` send `Access-Control-Allow-Origin: *`, so they work as textures.
   - `svs.gsfc.nasa.gov` returned a CORS header for an unrelated origin, and JPL's CDN (`d2pn8kiwq2w21t.cloudfront.net`) sent none. Neither will work as a WebGL texture.
   - **Recommendation: download every image into `/assets/discoveries/`.** That also keeps the judged build working offline and avoids broken links.
4. **NASA media use.** NASA imagery is generally not copyrighted, but the credit line must be shown. Do not use the NASA logo in a way that implies endorsement.
   - JunoCam images processed by citizen scientists are listed as CC BY 3.0, so name the processor.
   - Webb and Hubble images credit NASA/ESA (and CSA for Webb). M3 images credit ISRO as well.

---

## 1. The Nile and Egyptian farming from orbit

**N1. The Nile Delta's disappearing farmland (1984 vs 2021)**
- **Caption:** Cities are spreading over Egypt's best farmland. Comparing Landsat images 37 years apart shows the delta's green fields being paved over.
- **Mission:** Landsat 5 TM and Landsat 8 OLI. Published 2021.
- **Images:**
  - 1984: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/149000/149183/niledeltaurban_tm5_1984207_lrg.jpg
  - 2021: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/149000/149183/niledeltaurban_oli_2021228_lrg.jpg
- **Page:** https://science.nasa.gov/earth/earth-observatory/the-nile-deltas-disappearing-farmland-149183/
- **Credit:** NASA Earth Observatory images by Lauren Dauphin, using Landsat data from the U.S. Geological Survey.
- **Facts on the page:** Only 4% of Egypt's land is suitable for farming. Egypt loses about 2% of its arable land per decade to cities. 95% of Egyptians live in the Nile floodplain. Population grew from 45 million in the 1980s to more than 100 million.

**N2. A "New Delta" in the desert (2018 vs 2024)**
- **Caption:** Egypt is building canals to carry water into the desert west of the Nile. Satellites watched new green fields appear where there was only sand.
- **Mission:** Landsat 8 and Landsat 9 OLI. Published 2024.
- **Images:**
  - 2018: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/153000/153752/egyptag_oli_20181128_lrg.jpg
  - 2024: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/153000/153752/egyptag_oli2_20241120_lrg.jpg
- **Page:** https://science.nasa.gov/earth/earth-observatory/a-new-delta-in-the-desert-153752/
- **Credit:** NASA Earth Observatory images by Lauren Dauphin, using Landsat data from the U.S. Geological Survey.
- **Facts:** The goal is 2.2 million feddans (9,240 km²) of new farmland. A treatment plant handles 7.5 million m³ of wastewater per day. 16,000 km² of new farmland has been mapped in Egypt. Over the same period, 1,700 km² of farmland was abandoned and 2,300 km² was built over.

**N3. Crop circles in the Sahara (East Oweinat)**
- **Caption:** These perfect green circles are fields watered by giant rotating sprinklers. The water is pumped from an ancient underground aquifer that refills extremely slowly.
- **Mission:** Landsat 8 OLI, image of 26 Feb 2017.
- **Image:** https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/89000/89820/egypt_oli_2017057_lrg.jpg
- **Page:** https://science.nasa.gov/earth/earth-observatory/cultivating-egypts-desert-89820/
- **Credit:** NASA Earth Observatory images by Joshua Stevens, using Landsat data from the U.S. Geological Survey.
- **Facts:** The farms covered about 5,000 km² (2010 study). Each pivot is about 700–820 m across. The water comes from the Nubian Sandstone Aquifer and is treated as non-renewable.

**N4. Toshka Lakes: lakes that come and go**
- **Caption:** Overflow from Lake Nasser created lakes in the middle of the Sahara. They shrank by about 80%, then refilled after record Nile floods in 2019–2020.
- **Mission:** ISS Crew Earth Observations, astronaut photos from 2002, 2012 and 2021.
- **Images:**
  - 2002: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/149000/149334/ISS005-E-13562_lrg.jpg
  - 2021: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/149000/149334/iss066e091633_lrg.jpg
- **Page:** https://science.nasa.gov/earth/earth-observatory/two-decades-of-change-at-toshka-lakes-149334/
- **Credit:** Astronaut photographs ISS005-E-13562 and ISS066-E-91633, courtesy of the ISS Crew Earth Observations facility and the Earth Science and Remote Sensing Unit, Johnson Space Center.
- **Facts:** The lakes peaked at about 1,450 km². By June 2012 they covered 307 km², about 80% smaller than in 2002. 2020 brought the highest Lake Nasser level ever recorded.

**N5. The Grand Ethiopian Renaissance Dam (GERD) reservoir fills (2019 vs 2022), plus the Nile at night**
- **Caption:** A huge new dam upstream on the Blue Nile can be watched filling from space. That matters because most of Egypt's water comes from upstream.
- **Mission:** Landsat 8 OLI, and Suomi NPP VIIRS (Black Marble night lights). Published 2022.
- **Images:**
  - GERD 2019: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/149000/149699/grandeth_oli_201937_lrg.jpg
  - GERD 2022: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/149000/149699/grandeth_oli_202245_lrg.jpg
  - Night lights: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/149000/149691/nile_vir_2016_lrg.jpg
- **Pages:**
  - https://science.nasa.gov/earth/earth-observatory/keeping-a-satellite-eye-on-gerd-149699/
  - https://science.nasa.gov/earth/earth-observatory/a-grand-new-dam-on-the-nile-149691/
- **Credit:** NASA Earth Observatory images by Lauren Dauphin, using Landsat data from the USGS and Black Marble data from NASA/GSFC.
- **Facts:** The Blue Nile supplies 60% of the Nile's water. 95% of Egypt's farmland lies near the riverbanks. In Feb 2022 the reservoir was under 15% full. The project cost $5 billion. Later fillings could exceed 25 billion m³ each.

**Bonus Nile images:**
- *Nile Delta at night*, ISS025-E-9858, 2010: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/46000/46820/ISS025-E-09858_lrg.jpg
- *Foggy Nile*, Terra MODIS, 7 Jan 2024: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/152000/152302/deltafog_tmo_20240107_lrg.jpg
  - Credit: NASA Earth Observatory image by Wanmei Liang, using MODIS data from NASA EOSDIS LANCE and GIBS/Worldview.

**Gameplay numbers (Earth observation)**

| Sensor | Values |
|---|---|
| Landsat 8/9 OLI | 30 m pixels (15 m panchromatic), 16-day revisit for each satellite, 8 days combined, 185 km swath |
| MODIS (Terra/Aqua) | 250 m–1 km pixels, 2,330 km swath, near-daily global coverage |
| VIIRS | 375–750 m, 3,000 km swath |

- Farmland figures: Nile Delta about 25,000 km². Egypt's arable land is about 4%.

---

## 2. Dust storms over Egypt and the Sahara

**D1. A wall of dust crosses Egypt and Sudan in three hours (15 Jul 2010)**
- **Caption:** Two satellites passed three hours apart and caught a giant dust storm racing toward Saudi Arabia. By afternoon the Nile had almost disappeared beneath it.
- **Mission:** Terra MODIS (morning) and Aqua MODIS (afternoon).
- **Images:**
  - Terra: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/44000/44659/RedSea_TMO_2010196_lrg.jpg
  - Aqua: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/44000/44659/RedSea_AMO_2010196_lrg.jpg
- **Page:** https://science.nasa.gov/earth/earth-observatory/dust-storm-in-egypt-and-sudan-44659/
- **Credit:** NASA images courtesy Jeff Schmaltz, MODIS Rapid Response Team at NASA GSFC.

**D2. Dust over Cairo out to the Mediterranean (29 Jan 2011)**
- **Caption:** A plume from Egypt's Western Desert blew over Cairo and the Nile Delta and almost reached Lebanon.
- **Mission:** Aqua MODIS.
- **Image:** https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/49000/49034/egypt_amo_2011029_lrg.jpg
- **Page:** https://science.nasa.gov/earth/earth-observatory/dust-storm-in-egypt-49034/
- **Credit:** NASA image by Jeff Schmaltz, MODIS Rapid Response Team at NASA GSFC.
- **Alternate images:**
  - 22 Mar 2013, hiding the Nile and the Gulf of Suez: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/80000/80718/egypt_amo_2013081_lrg.jpg (credit: Jeff Schmaltz, LANCE MODIS Rapid Response)
  - 26 May 2010, comma-shaped storm over Egypt and Libya: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/44000/44161/Egypt_AMO_2010146_lrg.jpg

**D3. Sahara dust feeds the Amazon rainforest**
- **Caption:** Each year Saharan dust crosses the Atlantic. The phosphorus it carries fertilizes the Amazon, replacing about what the rain washes away.
- **Mission:** CALIPSO lidar (CALIOP), data 2007–2013, study by Yu et al., 2015.
- **Images:**
  - With labels: https://svs.gsfc.nasa.gov/vis/a000000/a004200/a004273/SaharaDust_Flat_WithLabels_print.jpg
  - Still: https://svs.gsfc.nasa.gov/vis/a000000/a004200/a004273/4273_African_Dust_Still_print.jpg
- **Page:** https://svs.gsfc.nasa.gov/4273/
- **Credit:** NASA's Goddard Space Flight Center Scientific Visualization Studio.
- **Facts:** 182 million t of dust leaves the Sahara each year. 27.7 million t (15%) settles on the Amazon basin. That dust carries about 22,000 t of phosphorus per year. The amount varied by up to 86% between 2007 and 2011. A major source is the Bodélé Depression in Chad.

**D4. The June 2020 "Godzilla" dust plume**
- **Caption:** One of the biggest dust clouds in decades stretched more than 2,000 miles across the Atlantic to the Caribbean and the Gulf of Mexico.
- **Mission:** Suomi NPP, with VIIRS for the picture and OMPS for the aerosol index. 13–24 Jun 2020.
- **Images:**
  - Still: https://www.nasa.gov/wp-content/uploads/2020/06/africandustnpp-friday.jpg
  - Animated GIF: https://www.nasa.gov/wp-content/uploads/2020/06/omps_ai_viirs_rgb_sahara_2020_06_13-18.gif
- **Page:** https://www.nasa.gov/missions/suomi-npp/nasa-observes-large-saharan-dust-plume-over-atlantic-ocean/
- **Credit:** NASA Worldview / NASA Goddard, Colin Seftor.

**D5. What the dust is made of (EMIT mineral maps)**
- **Caption:** An instrument on the Space Station maps the minerals in desert soils. Dark iron-rich dust warms the air, while pale clay dust cools it.
- **Mission:** EMIT imaging spectrometer on the ISS. First light 2022; global maps Dec 2023.
- **Images:**
  - Global hematite/goethite/kaolinite map, PIA26116: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia26/pia26116/PIA26116.jpg
  - First light over the Sahara in SW Libya, PIA25424: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia25/pia25424/PIA25424.jpg
- **Credit:** NASA/JPL-Caltech.
- **Facts:** Launched 14 Jul 2022. Tracks 10 target minerals. Covers 50°N–50°S.
  - From memory, not re-checked today: about 285 spectral bands from 380 to 2,500 nm, and about 60 m pixels.

**Gameplay numbers:** MODIS revisit is about 1–2 per day (Terra morning, Aqua afternoon). CALIPSO was a lidar profiler with a 16-day repeat, a narrow nadir "curtain". EMIT revisit is irregular because it rides the ISS orbit.

---

## 3. Water ice at the lunar poles

**M1. First direct sighting of surface ice at both poles (2018)**
- **Caption:** A NASA instrument on India's Chandrayaan-1 caught the infrared fingerprint of real water ice in craters that never see sunlight.
- **Mission:** Moon Mineralogy Mapper (M3), a NASA/JPL instrument on ISRO's Chandrayaan-1. Data 2008–09; study by Li et al. in PNAS, 2018.
- **Image (JPL CDN, download it locally):** https://d2pn8kiwq2w21t.cloudfront.net/original_images/imagesmoon20180820elphic20180820-16.jpg
- **Page:** https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles
- **Credit:** NASA.
- **Facts:** Several thousand 280 × 280 m pixels show ice within 20° of the poles. Only about 3.5% of cold traps show exposed ice. The detected ice is in the top few millimetres. Temperatures there stay below −250 °F (about −157 °C).

**M2. Water and hydroxyl across the Moon (2009)**
- **Caption:** The Moon is not bone-dry. Its soil holds traces of water, more of it toward the poles.
- **Mission:** M3 on Chandrayaan-1, 2009.
- **Images:**
  - PIA12237: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia12/pia12237/PIA12237.jpg
  - Alternate PIA12235: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia12/pia12235/PIA12235.jpg
- **Credit:** ISRO/NASA/JPL-Caltech/Brown Univ./USGS.

**M3. LCROSS hits Cabeus crater and finds water (9 Oct 2009)**
- **Caption:** NASA deliberately crashed a spent rocket stage into a dark crater. The debris cloud contained water.
- **Mission:** LCROSS (NIR spectrometers on the shepherding spacecraft), plus the LAMP instrument on LRO, which watched the vapor cloud.
- **Images:**
  - Impact: https://svs.gsfc.nasa.gov/vis/a000000/a003700/a003760/lcross_impact.jpg
  - LAMP view of the vapor cloud: https://svs.gsfc.nasa.gov/vis/a000000/a003700/a003785/lcross_lamp_cloud.jpg
- **Pages:** https://svs.gsfc.nasa.gov/3760/ and https://svs.gsfc.nasa.gov/3785/
- **Credit:** NASA's Goddard Space Flight Center Scientific Visualization Studio.
- **Facts:** The Centaur stage was about 2 t and hit at 11:31 UT. About 155 kg of water vapor and ice was seen. Water ice is about 5.6% ± 2.9% of the crater material by mass. The plume rose 6–8 km. Results appeared in Science, 22 Oct 2010.

**M4. The coldest place measured in the Solar System**
- **Caption:** The floor of Hermite crater near the north pole is colder than Pluto's surface, cold enough to trap ice for billions of years.
- **Mission:** LRO Diviner Lunar Radiometer, 2009–2010.
- **Image:** https://svs.gsfc.nasa.gov/vis/a010000/a010500/a010595/LRO_coldest_lg.jpg
- **Page:** https://svs.gsfc.nasa.gov/10595/
- **Credit:** NASA/GSFC/UCLA.
- **Facts:** About 26 K (−247/−248 °C).
- **Related:** Diviner and LOLA frost map, 2017: https://svs.gsfc.nasa.gov/vis/a000000/a004500/a004574/frost.0720_print.jpg (page https://svs.gsfc.nasa.gov/4574/).
- **Related:** LEND hydrogen map of the south pole, 2009–2011, which flags Cabeus, Shoemaker and Faustini: https://svs.gsfc.nasa.gov/vis/a010000/a011700/a011756/c-1280.jpg (page https://svs.gsfc.nasa.gov/11756/).

**M5. Seeing inside permanent shadow (2023)**
- **Caption:** A super-sensitive NASA camera on Korea's Danuri orbiter photographs crater floors lit only by light bouncing off crater walls, the places future astronauts may mine for ice.
- **Mission:** ShadowCam (NASA) on KARI's Danuri (KPLO). LROC is shown alongside for comparison.
- **Image:** https://www.nasa.gov/wp-content/uploads/2023/02/ShadowCam-Shackleton-Crater.png
- **Page:** https://www.nasa.gov/blogs/missions/2023/02/09/nasas-shadowcam-images-permanently-shadowed-regions-from-lunar-orbit
- **Credit:** NASA/KARI/ASU.
- **Facts:** 200 times more sensitive than LROC. About 1.7 m per pixel. Each panel shows 1,800 × 2,200 m of Shackleton crater.

**Bonus: SOFIA finds water on the sunlit Moon (announced 26 Oct 2020, six years ago today)**
- Clavius crater, 100–412 ppm.
- Image: https://www.nasa.gov/wp-content/uploads/2020/10/578d41c5-4e1a-4911-a5be-4267ad719db0-376875849.jpg
- Page: https://www.nasa.gov/news-release/nasas-sofia-discovers-water-on-sunlit-surface-of-moon/

**Gameplay numbers**
- LRO launched 18 Jun 2009 on the same Atlas V as LCROSS, into a 50 km orbit.
- LEND detects hydrogen by counting neutrons. It sees roughly the top metre of soil (general neutron-sensing depth, not re-checked today).
- From memory, not re-checked today: M3 covers 0.43–3.0 µm, with the water/OH feature near 3 µm.

---

## 4. Buried ice on Mars

**R1. Cliffs of pure ice (2018)**
- **Caption:** Eroding slopes on Mars expose sheets of nearly pure ice more than 100 m thick, starting only 1–2 m below the surface. Future astronauts could mine them.
- **Mission:** MRO HiRISE (Dundas et al., Science 2018).
- **Image (PIA22077):** https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia22/pia22077/PIA22077.jpg
- **Credit:** NASA/JPL-Caltech/UA/USGS.
- **Facts (from the 2018 paper, not re-checked today):** Ice more than 100 m thick, under 1–2 m of cover.

**R2. A Lake Superior of ice under Utopia Planitia (2016)**
- **Caption:** Radar beamed down from orbit found a buried ice sheet as large as New Mexico, holding as much water as Lake Superior.
- **Mission:** MRO SHARAD (built by ASI), more than 600 orbital passes.
- **Images:**
  - Radargrams, PIA21137: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia21/pia21137/PIA21137.jpg
  - Map, PIA21138: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia21/pia21138/PIA21138.jpg
  - Scalloped terrain, PIA21136: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia21/pia21136/PIA21136.jpg
- **Credit:** NASA/JPL-Caltech/Univ. of Rome/ASI/PSI. For PIA21136: NASA/JPL-Caltech/Univ. of Arizona.
- **Facts:** About 14,300 km³ of water. The deposit is 80–170 m thick, 50–85% ice, under 1–10 m of soil.

**R3. A fresh meteoroid crater throws out ice boulders (24 Dec 2021)**
- **Caption:** A 5–12 m space rock hit Mars hard enough to register as a magnitude 4 quake on the InSight lander. The crater revealed ice closer to the equator than ever seen before.
- **Mission:** MRO HiRISE and CTX, plus the InSight SEIS seismometer. Published 2022.
- **Images:**
  - Ice boulders, PIA25583: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia25/pia25583/PIA25583.jpg
  - CTX before/after, PIA25584: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia25/pia25584/PIA25584.jpg
- **Credits:** NASA/JPL-Caltech/University of Arizona for PIA25583; NASA/JPL-Caltech/MSSS for PIA25584.
- **Facts:** The crater is about 150 m across and 21 m deep, in Amazonis Planitia. InSight was more than 3,500 km away.
- **2009 precursor:** Ice exposed by small new craters at about 43°N, PIA12217: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia12/pia12217/PIA12217.jpg

**R4. Mars Odyssey's hydrogen map (2002)**
- **Caption:** By counting neutrons leaking from the soil, Odyssey showed the top metre of Mars near the poles is packed with ice.
- **Mission:** Mars Odyssey Gamma Ray Spectrometer suite (Neutron Spectrometer and HEND).
- **Images:**
  - Global map, PIA03800: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia03/pia03800/PIA03800.jpg
  - Two-season view, PIA03744: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia03/pia03744/PIA03744.jpg
- **Credit:** NASA/JPL/University of Arizona/Los Alamos National Laboratories.
- **Facts:** Up to 50% ice in the upper 1 m in polar areas. About 60% by volume in parts of the south. Up to 90% in some northern areas (PIA04593).

**R5. SWIM: where astronauts should land for water (2023)**
- **Caption:** NASA combined data from several orbiters into one treasure map of shallow buried ice at latitudes where landing is possible.
- **Mission:** SWIM (Subsurface Water Ice Mapping), using MRO, Odyssey and MGS data, led by the Planetary Science Institute.
- **Images:**
  - PIA26045: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia26/pia26045/PIA26045.jpg
  - Top-metre globes, PIA26046: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia26/pia26046/PIA26046.jpg
- **Credit:** NASA/JPL-Caltech/Planetary Science Institute.

**Bonus: ice disappears before Phoenix's eyes (2008)**
- PIA10906: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia10/pia10906/PIA10906.jpg
- Credit: NASA/JPL-Caltech/University of Arizona/Texas A&M.
- Ice chunks in the "Dodo-Goldilocks" trench sublimated within 4 sols.

**Gameplay numbers**

| Item | Values |
|---|---|
| SHARAD | 20 MHz centre frequency, 15–25 MHz chirp (10 MHz bandwidth), 85 µs pulse |
| SHARAD resolution and depth | 15 m range resolution in vacuum, 5–8 m vertical in rock, 300–1,000 m along-track, 1.5–8 km across-track. Penetrates several hundred metres to about 1 km |
| SHARAD pointing | MRO must roll up to about 25° to aim it at nadir |
| MRO downlink | Up to about 6 Mbps at closest Earth–Mars distance, about 0.6 Mbps at farthest. 3 m high-gain antenna, 100 W X-band transmitter |
| MRO total data | More than 200 Tbit returned by Nov 2013 (no newer total found) |
| HiRISE | 30 cm/pixel from about 300 km |
| Odyssey neutron sensing | About the top 1 m |

---

## 5. Venus surface change and volcanism

**V1. A volcano caught changing (Maat Mons, 1991 data, found 2023)**
- **Caption:** Comparing radar images taken eight months apart, scientists saw a volcanic vent double in size and fill, probably with lava. It is the first direct evidence of a recent eruption on Venus.
- **Mission:** Magellan synthetic aperture radar. Herrick & Hensley, Science 2023.
- **Images:**
  - Study-area figure: https://www.nasa.gov/wp-content/uploads/2023/03/2-study_area_for_pub_jan23-1041.jpg
  - Maat Mons 3D view, PIA00106: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia00/pia00106/PIA00106.jpg
- **Page:** https://www.nasa.gov/solar-system/nasas-magellan-data-reveals-volcanic-activity-on-venus/
- **Credit:** NASA/JPL-Caltech, with the study figure by Robert Herrick (UAF).
- **Facts:** The vent grew from about 2.2 km² (Feb 1991) to about 4 km² and changed from round to kidney-shaped.

**V2. New lava flows at Sif Mons and Niobe Planitia (1990–92 data, found 2024)**
- **Caption:** A second study found fresh lava flows that appeared during Magellan's mission, so Venus is volcanically alive today.
- **Mission:** Magellan SAR and altimetry. Sulcanese, Mitri et al., Nature Astronomy 2024.
- **Images:**
  - Sif Mons 3D, PIA00108: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia00/pia00108/PIA00108.jpg
  - Sif Mons flows, PIA00471: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia00/pia00471/PIA00471.jpg
- **Page:** https://www.nasa.gov/centers-and-facilities/jpl/ongoing-venus-volcanic-activity-discovered-with-nasas-magellan-data
- **Credit:** NASA/JPL.
- **Facts:** About 30 km² of new rock at Sif Mons (enough to fill 36,000 Olympic pools). About 45 km² at Niobe Planitia (54,000 pools). Flows are 3–20 m deep.

**V3. The whole surface of Venus mapped through the clouds**
- **Caption:** Clouds hide Venus completely, but radar went straight through them and mapped the surface.
- **Mission:** Magellan, 1990–1994.
- **Images:**
  - Global view, PIA00104: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia00/pia00104/PIA00104.jpg
  - Northern hemisphere, PIA00271: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia00/pia00271/PIA00271.jpg
- **Credit:** NASA/JPL.

**V4. Future discovery cards (status as of spring 2026)**
- **VERITAS:** An orbiter carrying the X-band InSAR radar VISAR and the VEM emissivity mapper. It would remap the surface to detect change since Magellan.
  - NASA's page says launch no earlier than 2031. Press reports point to Nov 2032, with arrival mid-2033.
  - Page: https://science.nasa.gov/mission/veritas/overview
- **DAVINCI:** An atmospheric descent probe. Reported target is a Dec 2030 launch, with probe release about 3 Oct 2032.
- **Budget:** The FY2026 budget request proposed cancelling both missions. Congress funded them (at least $99M and $36.1M). The planetary division received $2.54B for 2026.
- **Recommendation:** Present these as "planned" in-game, not as sure things.

**Gameplay numbers**
- Venus surface is about 465 °C at about 92 bar.
- From memory, not re-checked today:
  - Magellan radar: 12.6 cm wavelength (2.385 GHz, S-band), about 98% of the surface mapped at about 100–120 m resolution.
  - VISAR: about 30 m imaging.

---

## 6. Europa's ice shell and ocean

**E1. A hidden salty ocean revealed by magnetism (Galileo, 2000)**
- **Caption:** Jupiter's magnetic field flips direction as seen from Europa every 5.5 hours. Europa responds like a metal detector would to a salty ocean, which is the best evidence the ocean exists today.
- **Mission:** Galileo magnetometer (Kivelson et al., Science 2000, Jan 2000 flyby).
- **Images:**
  - Interior cutaway, PIA01130: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia01/pia01130/PIA01130.jpg
  - Reprocessed Galileo color view, PIA19048: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia19/pia19048/PIA19048.jpg
- **Credits:** NASA/JPL for PIA01130; NASA/JPL-Caltech/SETI Institute for PIA19048.
- **Facts:** The ocean lies within the outer about 100 km, the ice-plus-water layer. Conductivity must exceed 0.06 S/m within about 200 km of the surface.

**E2. Juno's close flyby (29 Sep 2022)**
- **Caption:** Juno flew just 352 km over Europa, the closest pass in more than 20 years. It photographed cracks, ridges and chaos terrain.
- **Mission:** Juno JunoCam.
- **Images:**
  - First image, PIA25330: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia25/pia25330/PIA25330.jpg
  - Composite, PIA26331: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia26/pia26331/PIA26331.jpg
  - Close-up, PIA25334: https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia25/pia25334/PIA25334.jpg
- **Credit:** NASA/JPL-Caltech/SwRI/MSSS, plus the processor (Björn Jónsson for PIA26331 and PIA25334). Listed as CC BY 3.0.
- **Facts:** About 1 km per pixel. Only the third close pass of Europa in history.

**E3. How thick is the ice? About 29 km (published Dec 2025)**
- **Caption:** Juno's microwave radiometer "felt" heat coming up through the ice. In the region it saw, the cold, rigid outer shell is about 29 km thick, so the ocean is deep below.
- **Mission:** Juno Microwave Radiometer (MWR). Levin et al., Nature Astronomy, 17 Dec 2025; NASA release Jan 2026.
- **Image:** https://www.nasa.gov/wp-content/uploads/2024/05/1-pia26331-europa-junocam.png
- **Page:** https://www.nasa.gov/missions/juno/nasas-juno-measures-thickness-of-europas-ice-shell/
- **Credit:** NASA/JPL-Caltech/SwRI/MSSS.
- **Facts:** 29 ± 10 km for a pure-ice conductive layer. Salt would thin the estimate by about 5 km. A warmer convecting layer underneath would make the shell thicker.

**E4. Plumes erupting from the same spot twice (Hubble, 2014 and 2016)**
- **Caption:** Hubble saw what looks like a water plume rising from Europa in the same place two years apart. It may be ocean water reaching space.
- **Mission:** Hubble STIS in ultraviolet, seen against Jupiter. Released 2017.
- **Image (PIA21443):** https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia21/pia21443/PIA21443.jpg
- **Credit:** NASA/ESA/W. Sparks (STScI)/USGS Astrogeology Science Center.
- **Facts:** The plume was about 100 km tall in 2016 and about 50 km in 2014. The spot matches a Galileo warm spot.

**E5. Carbon from the ocean (Webb, 2023) and oxygen from the ice (Juno, 2024)**
- **Caption:** Webb found CO₂ concentrated in young, broken-up "chaos" terrain, likely carried up from the ocean. Juno measured the surface making about 12 kg of oxygen every second.
- **Missions:** JWST NIRSpec and NIRCam (Tara Regio). Juno JADE (oxygen).
- **Images:**
  - Webb CO₂ map: https://assets.science.nasa.gov/content/dam/science/missions/webb/science/2023/09/STScI-01H69PESJ0JQJG7E50SJTH5347.png (credit: NASA, ESA, CSA, G. Villanueva (NASA/GSFC), S. Trumbo (Cornell Univ.), A. Pagan (STScI))
  - Oxygen illustration: https://www.nasa.gov/wp-content/uploads/2024/03/pia26239-europa-o2-illo.jpg (credit: NASA/JPL-Caltech/SwRI/PU)
- **Page:** https://www.nasa.gov/missions/juno/nasas-juno-mission-measures-oxygen-production-at-europa/

**E6. Europa Clipper's radar works (Mars flyby, 1 Mar 2025)**
- **Caption:** On its way to Jupiter, Clipper tested its ice-penetrating radar on Mars and got a clean 900 km profile.
- **Mission:** Europa Clipper REASON radar.
- **Image (PIA26568):** https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia26/pia26568/PIA26568.jpg
- **Credit:** NASA/JPL-Caltech/UT-Austin.
- **Facts:** Radar ran for about 40 minutes. Image released 1 Aug 2025.

**Gameplay numbers**

| Item | Values |
|---|---|
| Europa Clipper launch | 14 Oct 2024, Falcon Heavy |
| Earth gravity assist | 3 Dec 2026, about 5 weeks from today, which could be a timely hook for the pitch |
| Jupiter orbit insertion | 11 Apr 2030 |
| Europa flybys | Begin early 2031. 49 flybys, as low as 25 km. Prime mission ends Jun 2034 |
| Launch mass | About 6,065 kg including 2,750 kg propellant (JPL says about 5,800 kg) |
| Solar arrays | About 700 W at Jupiter, which gets only 3–4% of Earth's sunlight |
| REASON | 9 MHz and 60 MHz. Press reports say it reaches down to about 30 km (not in the primary paper's abstract) |
| Juno | 3 arrays about 9 m long, 18,698 cells. About 14 kW at Earth distance, about 500 W at Jupiter (25 times less sunlight). About half the power goes to heating |
| Juno flyby | 352–360 km over Europa |
| Europa | Diameter 3,100 km. 5.5-hour field-flip period at Europa |

---

## Sources

**Earth Observatory pages:**
- https://science.nasa.gov/earth/earth-observatory/the-nile-deltas-disappearing-farmland-149183/
- https://science.nasa.gov/earth/earth-observatory/a-new-delta-in-the-desert-153752/
- https://science.nasa.gov/earth/earth-observatory/cultivating-egypts-desert-89820/
- https://science.nasa.gov/earth/earth-observatory/two-decades-of-change-at-toshka-lakes-149334/
- https://science.nasa.gov/earth/earth-observatory/keeping-a-satellite-eye-on-gerd-149699/
- https://science.nasa.gov/earth/earth-observatory/a-grand-new-dam-on-the-nile-149691/
- https://science.nasa.gov/earth/earth-observatory/nile-river-delta-at-night-46820/
- https://science.nasa.gov/earth/earth-observatory/foggy-nile-152302/
- https://science.nasa.gov/earth/earth-observatory/dust-storm-in-egypt-and-sudan-44659/
- https://science.nasa.gov/earth/earth-observatory/dust-storm-in-egypt-49034/
- https://science.nasa.gov/earth/earth-observatory/dust-storm-in-egypt-80718/

**Dust and EMIT:**
- https://svs.gsfc.nasa.gov/4273/
- https://www.nasa.gov/missions/suomi-npp/nasa-observes-large-saharan-dust-plume-over-atlantic-ocean/
- https://science.nasa.gov/photojournal/nasas-emit-mission-produces-maps-of-arid-region-surface-minerals

**Moon:**
- https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles
- https://svs.gsfc.nasa.gov/10595/
- https://svs.gsfc.nasa.gov/3760/
- https://svs.gsfc.nasa.gov/3785/
- https://svs.gsfc.nasa.gov/4574/
- https://svs.gsfc.nasa.gov/11756/
- https://www.nasa.gov/blogs/missions/2023/02/09/nasas-shadowcam-images-permanently-shadowed-regions-from-lunar-orbit
- https://www.nasa.gov/news-release/nasas-sofia-discovers-water-on-sunlit-surface-of-moon/
- https://spaceflightnow.com/lcross/091113results/

**Mars:**
- https://science.nasa.gov/photojournal/underground-martian-ice-deposit-exposed-at-scarp/
- https://science.nasa.gov/photojournal/location-of-large-subsurface-water-ice-deposit-in-utopia-planitia-mars
- https://science.nasa.gov/photojournal/hirise-views-a-mars-impact-crater-surrounded-by-water-ice/
- https://science.nasa.gov/photojournal/swim-map-shows-subsurface-water-ice-on-mars/
- https://pds-geosciences.wustl.edu/mro/mro-m-sharad-4-rdr-v1/mrosh_1001/document/rdrsis.htm
- https://www.universetoday.com/106318/how-much-science-data-has-the-mars-reconnaissance-orbiter-sent-to-earth

**Venus:**
- https://www.nasa.gov/solar-system/nasas-magellan-data-reveals-volcanic-activity-on-venus/
- https://www.nasa.gov/centers-and-facilities/jpl/ongoing-venus-volcanic-activity-discovered-with-nasas-magellan-data
- https://science.nasa.gov/mission/veritas/overview
- https://skyandtelescope.org/astronomy-news/nasas-budget-woes-are-over-for-now/

**Europa and Juno:**
- https://www.jpl.nasa.gov/news/galileo-evidence-points-to-possible-water-world-under-europas-icy-crust
- https://science.nasa.gov/photojournal/first-image-of-europa-from-junos-close-flyby/
- https://www.nasa.gov/missions/juno/nasas-juno-measures-thickness-of-europas-ice-shell/
- https://www.nasa.gov/missions/juno/nasas-juno-mission-measures-oxygen-production-at-europa/
- https://science.nasa.gov/photojournal/hubble-sees-recurring-plume-erupting-from-europa/
- https://science.nasa.gov/asset/webb/europa-carbon-dioxide-distribution-nircam-and-nirspec-ifu-image/
- https://science.nasa.gov/photojournal/europa-clipper-team-produces-radargram-from-mars-flyby-data/
- https://www.jpl.nasa.gov/news/nasas-europa-clipper-gets-set-of-super-size-solar-arrays/
- https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/
- https://www.jpl.nasa.gov/news/nasas-juno-spacecraft-breaks-solar-power-distance-record

**Helper scripts** (they turn a PIA number into its image URL and check that it loads):
- C:\Users\abdel\AppData\Local\Temp\claude\c--Users-abdel-Desktop-Projects-Client-Client\77e318db-cbb6-4c2c-b9dd-74673941dd28\scratchpad\scripts\pia.py
- C:\Users\abdel\AppData\Local\Temp\claude\c--Users-abdel-Desktop-Projects-Client-Client\77e318db-cbb6-4c2c-b9dd-74673941dd28\scratchpad\scripts\img.py