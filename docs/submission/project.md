# Every Kilogram: Space Apps 2026 project page

Copy each section below into the matching field of the Space Apps project page. Everything is in English, as the rules require. Text in `[square brackets]` is for the team to fill in. Work through `checklist.md` in this folder before submitting.

- **Challenge:** Space Mission Design Game
- **Team:** Jet and Brains
- **Team members:** Omitted at the team's request.
- **Local event:** Not provided.
- **Link to Project Demo:** Not available yet.
- **Link to Final Project:** [GitHub repository](https://github.com/imaisalah/every-kilogram). `[Add playable URL when available.]`

---

## Project Name

Every Kilogram

## High-Level Project Summary

Every Kilogram is a free 3D browser game where you design a space mission, fly it and bring the science home, alone or as a crew of up to four. Choose a destination and science result to count as success before building a spacecraft: orbit, power, instruments, radio, landing kit and a rocket that must lift it all. Every choice moves six budgets: mass, power, money, data, communications and time. The mission is then simulated: sunlight and shadow, battery, data and radio passes, crises to fix. On the Moon, Mars, Venus and Europa the crew lands, scans sites and decides which samples the fuel can lift home. Finally a chain of falling dominoes, computed by re-flying the mission, shows why it worked or failed, and you fly again with one change. It runs in English and Arabic on a school laptop.

(141 words)

## Detailed Project Description

### What it does

The official challenge's direct objective is to create an interactive game where participants design, manage and simulate a complete space mission, make engineering decisions, manage limited resources, and evaluate how each choice shapes mission success. The separate **Potential Considerations** section explicitly says these ideas are optional. It suggests examples such as defining objectives and requirements, configuring spacecraft and instruments, team play for up to four, and post-mission analysis; these are opportunities for a strong solution, not individual mandatory requirements. Every Kilogram addresses the direct objective and implements many of those suggestions. The first table row maps to the direct ask; all following rows map to optional considerations.

| Brief element | In Every Kilogram |
|---|---|
| **Direct challenge objective** | An interactive game lets participants plan, configure, fly and evaluate a complete science mission. Players make engineering decisions under resource limits and see how those choices affect mission performance. |
| **Optional consideration: objective and requirements** | Each destination begins with a real science question and objective ("Astronauts will need water. Where is ice hiding just under the Martian dust?"; goal: find and drill Martian ice). Before spacecraft design, the crew chooses the measurable result that counts as success (for Mars: *Find the ice* or *Choose the landing site*). This requirement sets how science is weighted and scored, so teams can design toward it from the start. |
| **Spacecraft components** | The build is one component per step, with at most three cards each: orbit, power source (silicon or high-efficiency panels, or RTGs at Jupiter), batteries, instruments, antenna and radio, data recorder, computer and pointing, mission length, landing kit (ascent fuel, spare oxygen, drill) and the rocket. Each card lists plain ✓/✗ lines computed from its real numbers ("Most power: 1,484 W", "Heaviest of the three") with its mass, power and cost. The 3D spacecraft changes as soon as a card is picked. |
| **Instruments** | Eleven instruments sized like real ones (camera, wide imager, infrared spectrometer, radar sounder, ice-penetrating radar, synthetic-aperture radar, neutron spectrometer, magnetometer, radio science, laser altimeter). Each serves some science objectives and not others, and the same instruments are the only tools that can scan the matching science sites on the surface. |
| **Launch vehicles, with capacity checks** | Light, medium and heavy launcher classes. Lift capacity depends on the target orbit and on the departure energy (C3) for deep-space missions; the rocket step comes last, when the mass is known, and shows which rockets can lift the ship. The review blocks a launch the rocket cannot physically make and says why. Everything else is allowed to fly and fail. |
| **Orbits, explained plainly** | Two to four real orbits per mission: sun-synchronous, dawn-dusk, low, geostationary, polar, frozen, a long ellipse, a Jupiter flyby tour, low Europa orbit. Each card shows a small diagram, facts in plain words (height, how long one lap takes, how much of it is in the dark, how many hours a day it can talk to Earth) and pros and cons computed from them ("Lands near the ice", "In the dark 37% of each orbit", "Least fuel to get there"). The orbit sets eclipse length, ground passes, insertion fuel, radiation, drag and, on landing missions, where and how accurately the crew can land. |
| **The six resources** | A calm bar shows mass (against what the rocket lifts), power (made against used, sunlight and shadow), budget, data (recorder against the longest gap between passes), comms (data sent home against data made) and time (build months against the launch deadline). Each step shows only the resources it affects; each turns amber or red with a one-line reason. |
| **Team play, up to four, roles and negotiation** | Four original astronauts, one per job: mission planner (orbit, mission length, rocket), engineer (power, batteries, computer), scientist (instruments, landing kit), communications (antenna and radio, recorder). Each build step belongs to one job; the others can tap a card to suggest it, and the suggestion shows on the owner's screen. In flight, a problem's alarm and its fix are sent to different players, so they have to talk. On the surface each job has an ability (the planner calls everyone home, the engineer patches suits, the scientist scans faster, comms plants and boosts the dish). Modes: Solo (bot crewmates), everyone on their own device over WebRTC, the same room with phones as controllers, or one screen. |
| **Simulation** | A deterministic simulation (`js/team/sim.js`) flies the mission frame by frame: sunlight and eclipse from the orbit, battery charge, recorder fill, downlink during real ground passes, science per objective, fuel, radiation dose, drag and failures. The flight view plays it in about a minute: launch, the real orbit in 3D with the spacecraft the team built, three live graphs (battery, recorder, science) and whether data is going home. Landing missions continue on the surface (`js/team/surface-sim.js`): scanning sites, carrying samples, planting a dish, uplink windows paced by the chosen orbit, oxygen, suit battery, day and night, and an ascent whose fuel decides how much mass lifts off. |
| **Re-simulation** | "Fly again with this change" applies the single change that would have helped most and flies again with the same seed; "Change anything" reopens the build. The last flight is drawn as a ghost on the graphs, with "+N vs ghost" on the science graph and "+N on your last flight" on the score. |
| **Scoring** | A score out of 1000 in four parts: science (up to 400, split between orbit and surface on landing missions), efficiency (200), survival (200, spacecraft and crew) and teamwork (200: problems fixed, requests answered, hidden goals). Gold, silver and bronze medals. |
| **Post-mission analysis** | The consequence chain: a row of dominoes that fall one by one, each with a line of text and a number, from a decision to its result ("Chose One ground station instead of Two…", "Science sites that could not be scanned: 2. No instrument for organic, atmosphere.", "Samples thrown overboard so the lander could lift off: 4 (112 kg)"). It is computed by re-flying the mission with that decision reverted, not written by hand. Then KILO's one-line verdict and "the one change that helps most", with its gain. If the mission died, a tombstone names the cause and the real mission that died the same way. |
| **Scenarios** | Six: Nile from orbit (farmland and thirsty crops) and Storm watcher (Saharan dust storms) are Earth-orbit training flights; Lunar water hunter, Mars ice mapper, Venus cloud explorer (a floating cloud-top platform, after NASA's HAVOC concept) and Europa ice explorer land a crew. |
| **Difficulty levels** | Cadet (up to six build steps, 25% more money, two problems in flight), Engineer (up to nine steps, the real trade-offs, three problems), Flight director (up to ten steps, a tighter budget, four problems, hidden flaws such as a weak radio amplifier or a mirror ground slightly wrong, and a soft clock). |
| **Random events** | Problems and opportunities in flight (solar storm, failing battery cell, saturated reaction wheels, data flood, fuel leak, lost ground contact, frozen computer, a once-in-a-decade event below, free ground-station time), each with a short window and one right fix. Hidden flaws on Flight director. On the surface: dust storms, sulfuric haze on Venus, radiation spikes, moonquakes and icequakes with falling rocks, and cold nights. All are planned from the round's seed, so a re-fly meets the same events. |
| **NASA mission-process references** | After the score, a **Mission review** shows the flight through NASA's four mission segments (launch, space, ground, user), a simplified learning ladder inspired by JPL's CML framework, and a study-type analogy inspired by NASA's Mission Design Lab. These are educational analogies, not NASA CML ratings or MDL studies. A ConOps timeline lists the mission's phases. |
| **Your ship vs the real mission** | The review compares launch mass, power and cost with the real NASA mission for that destination (Landsat 9, Terra, LRO, MRO, Magellan, Europa Clipper), with its NASA source and a link to NASA Eyes. |
| **Real space weather** | The "Solar storm!" problem names a real event from NASA's pages (May 2024, July 2012, October 2003) and, when the browser is online, the strongest flare NASA's DONKI service lists in the last 30 days. The physics is unchanged; offline it uses the saved events. |
| **Learning check and teacher log** | Three short questions chosen from what happened in the flight, and a CSV of every flight (mission, score, concept level, quiz result, no names) for teachers. `docs/CLASSROOM.md` is a 45-minute lesson plan. |
| **Reports** | A one-page printable mission report (what happened, cause and effect, the score) from the results screen. |
| **Save, share and compare** | "Save this design" keeps the design in the browser. "Challenge friends" copies a challenge link (`#c=…`) holding the mission, difficulty, seed, design and score; the rival team plays the same mission and seed and the results screen shows both designs and scores side by side ("BEATEN!" or "NOT YET"). No server or account is needed. |

Around that loop: KILO, an original deadpan robot guide, says one or two lines at each step, with scripts written for each mission; a slim bar at the top shows the mission's stages and the percentage done (on the surface, the share of the surface objectives done); every step has Back, and Pause works everywhere. Before launch the crew meet in a 3D capsule and introduce themselves.

### How it works

- **Mass and fuel:** the rocket equation with Isp 320 s. Capture burns come from each planet's mass and radius (NSSDC fact sheets) and the arrival speed, so a low polar orbit at Mars costs much more fuel than a long ellipse, and every kilogram of payload drags extra propellant with it.
- **Launchers:** capacity to low Earth orbit times an orbit factor near Earth, and `c0 · exp(−C3 / scale)` beyond.
- **Power:** 1,361 W/m² of sunlight at Earth, falling with distance squared; panel area × efficiency; RTGs from the MMRTG fact sheet. Batteries must carry the load through each eclipse.
- **Data:** instruments generate data by duty cycle and processing; the recorder holds it between ground passes; the downlink scales with transmitter power × dish diameter² ÷ distance² (DSN link design handbook), with a lower near-Earth constant and a cap per radio.
- **Surface:** a fixed-step simulation at 30 Hz that loads in Node for tests. Bots fill empty seats. Nobody dies: a suit that runs out walks its wearer back to the lander, which costs time.
- **Balance:** checked by flying thousands of designs: every scenario and difficulty has several different winning orbit-and-instrument strategies, and taking the biggest option everywhere never fits (`docs/TEAM-BALANCE.md`).
- **Networking:** one browser is the authoritative host; others connect over WebRTC data channels (PeerJS) or, in the same room, a small WebSocket relay built into `tools/serve.mjs` with no npm dependencies. Only room actions and controller input travel.

The game is plain HTML, CSS and JavaScript with no build step. The 3D uses three.js. All sound is synthesized in the browser. The whole interface is in English and Arabic, with a right-to-left layout for Arabic.

### Benefits

- **Trade-offs learned by making them.** One heavier instrument really does push the ship past what the rocket lifts, and a smaller dish really does leave data on the recorder.
- **Cause and effect made visible.** The consequence chain turns a score into an explanation, and "fly again with one change" turns the explanation into an experiment.
- **Talking is part of the game.** Roles hold different parts of the ship, and in flight the alarm and the fix land on different screens.
- **Reach.** Free, no account, runs in a browser on a school laptop, works with one device or several, and comes in Arabic as well as English. The Nile and Saharan dust-storm missions give students in Egypt and the region a mission about their own home.

### What we hoped to achieve

A student should finish one round able to explain why a heavier camera can need a bigger rocket, why the orbit decides how much data gets home, and why a lander cannot bring every sample back. Next: classroom trials with teachers, more destinations, and live data where it adds the most.

### Tools and languages

JavaScript (ES2020), HTML, CSS, WebGL through three.js r160, WebRTC through PeerJS 1.5.4, the Web Audio API, and Node.js for tests and the local server. Playwright Core drives headless screenshots and the demo checks during development (not shipped to players). Built with Claude Code; see "Use of Super Intelligence" below.

## NASA Data

Each source below drives a specific part of the game. The links are also in the code (`js/team/data.js`, `content/sources.js`, `js/3d/assetmanifest.js`); `docs/CREDITS.md` lists every file.

| NASA resource | URL | What it drives |
|---|---|---|
| NSSDC planetary fact sheets (Earth, Moon, Mars, Venus, Jupiter, Galilean moons) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/ | Sunlight at each world (1,361 W/m² at Earth, falling with distance squared), and the planet masses and radii behind orbital periods, eclipse length and capture burns. |
| NASA Glenn, Beginner's Guide to Aeronautics: ideal rocket equation | https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/ | Propellant for every orbit and the ascent fuel that lifts samples off the surface. |
| NASA launch services contract awards | https://www.nasa.gov/news-release/nasa-awards-launch-services-contract-for-dragonfly-mission/ | Launcher cost classes. |
| DSN Telecommunications Link Design Handbook (810-005) and the Deep Space Network | https://deepspace.jpl.nasa.gov/dsndocs/810-005/ · https://www.nasa.gov/communicating-with-missions/dsn/ | The downlink equation, dish options and ground stations. |
| Mars Reconnaissance Orbiter launch press kit | https://www.jpl.nasa.gov/news/press_kits/mro-launch-Aug05.pdf | Camera, radar sounder, spectrometer and 100 W radio figures; aerobraking; the low polar orbit. |
| LRO (NSSDC) | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031A | Neutron spectrometer and laser altimeter; lunar orbits. |
| Europa Clipper quick facts and radiation vault | https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/ · https://europa.nasa.gov/news/96/how-nasa-is-protecting-europa-clipper-from-space-radiation | Ice radar, magnetometer, the flyby tour and the radiation vault options. |
| Magellan | https://science.nasa.gov/mission/magellan/ | Venus radar mapping, the Magellan-style ellipse and aerobraking at Venus; the 3.7 m dish. |
| Landsat (NASA SVS) | https://svs.gsfc.nasa.gov/13917/ | The wide-swath imager and the sun-synchronous orbit. |
| MMRTG fact sheet | https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf | The nuclear battery option at Jupiter. |
| Galileo high-gain antenna lesson (NASA LLIS 492) | https://llis.nasa.gov/lesson/492 | Strong error correction; the comms failure story. |
| Artemis II | https://www.nasa.gov/mission/artemis-ii/ | Scale for the spare-oxygen mass in the landing kit. |
| HAVOC (NASA Langley, NTRS) | https://ntrs.nasa.gov/api/citations/20160006580/downloads/20160006580.pdf | The floating cloud-top platform on Venus. |
| How NASA tracked the most intense solar storm in decades (May 2024) | https://science.nasa.gov/science-research/heliophysics/how-nasa-tracked-the-most-intense-solar-storm-in-decades/ | The real event named on the solar-storm problem (a G5 storm, X5.8 flare, the first G5 since 2003). |
| Science@NASA: Near Miss, the Solar Superstorm of July 2012 | https://science.nasa.gov/science-news/science-at-nasa/2014/23jul_superstorm/ | The second real event named on the solar-storm problem. |
| DONKI (Space Weather Database Of Notifications, Knowledge, Information) | https://ccmc.gsfc.nasa.gov/tools/DONKI/ | The optional live lookup of the strongest solar flare in the last 30 days, shown on the solar-storm problem when the browser is online (`js/team/real-data.js`). |
| NASA Eyes on the Solar System | https://eyes.nasa.gov/ | Linked from the Mission review so players can see real missions in 3D. A link only; no data is loaded from it. |
| NASA *Design and Develop Science Missions* webinar (PDF supplied with the project) | https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf | Mission segments, ConOps, and the science-need → requirements → design sequence. The game now asks the team to choose its success criterion before spacecraft design. |
| JPL Concept Maturity Levels paper (PDF supplied with the project) | https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299 | Inspiration for the CML-inspired learning ladder. The game does not claim to conduct a NASA CML assessment. |
| NASA Mission Design Lab | https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/ | Inspiration for the difficulty-linked study-type analogy. The game does not claim to perform an MDL study. |
| General Mission Analysis Tool (GMAT) | https://software.nasa.gov/software/GSC-19468-1 | Focused external validation of simplified Earth-orbit periods. GMAT is not integrated into the game. See `docs/VALIDATION.md` for run status, version, assumptions and results. |
| NASA mishap reports, LLIS and mission pages | links in `js/team/data.js` (`ANALOGS`, `SURFACE_ANALOGS`) | Real missions named on the tombstone when a mission dies the same way: Mars Global Surveyor, Skylab, Telstar 1, Spirit, Galileo, Mars Observer, Mars Climate Orbiter, Kepler, Mars Polar Lander, Hubble, CONTOUR, Pioneer 10, Genesis, Apollo 13, Opportunity. Hidden flaws on Flight director borrow Hubble's mirror and Lucy's solar array. |
| NASA Earth Observatory Blue Marble; NASA SVS CGI Moon Kit (LRO) | https://earthobservatory.nasa.gov/ · https://svs.gsfc.nasa.gov/4720 | Earth and the Moon in the flight and in the surface skies. |
| Viking Mars mosaic (NASA/USGS, via NASA Trek); Cassini Jupiter map (PIA07782); Voyager/Galileo Europa mosaic (NASA/JPL, USGS) | https://trek.nasa.gov/mars/ · https://science.nasa.gov/photojournal · https://astrogeology.usgs.gov/ | Mars, Jupiter and Europa in the flight and in the surface skies. |

## Space Agency Partner & Other Data

- **ESA:** the Beagle 2 lander page (https://sci.esa.int/web/mars-express/-/55263-beagle-2-lander-found-on-mars) is the source for one tombstone story (a lander whose panels never fully opened). No partner dataset drives a mechanic at this time.
- **USGS Astrogeology Science Center:** processed Europa and Mars maps (public domain).
- **Other sources for failure stories:** Scientific American (Mars Global Surveyor, Telstar 1), The Planetary Society (Spirit), SpacePolicyOnline (Kepler), Sky & Telescope (Opportunity), each linked in `js/team/data.js`.

## Educational and visualization references

The [Space Apps challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources) lists optional NASA, CSA, and prior-challenge references. The table also includes the Level 1–3 Science PDFs supplied with the project. These are source material and design examples, not instructions to copy; they are not data integrations unless stated above.

| Reference | Use in this project |
|---|---|
| NASA Webb [*Build It Yourself*](https://science.nasa.gov/mission/webb/game-build-it-yourself/) activity and attached `Satlite_Options.pdf` transcript | Science-goal-first design pattern; informs the order of the success-criterion choice and spacecraft build. |
| NASA Webb [*Scope It Out*](https://science.nasa.gov/mission/webb/game-scope-it-out/) activity and supplied transcript | Reviewed as a telescope-teaching example; no specific game mechanic or data was adopted. |
| NASA [Mission Viz](https://nasa.github.io/mission-viz/) and supplied `mission-viz-main.zip` | Reviewed as a 3D mission-visualization reference; the game uses its own visualization code and does not include Mission Viz code. |
| NASA [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) | Reviewed for context; the game is not a CubeSat development trainer and does not use the guide as a source for its mission model. |
| NASA Level 1, Level 2 and Level 3 Science PDFs | Reviewed for science-result presentation patterns; the game does not reproduce their results as outputs from the simulated missions. |
| Canadian Space Agency [Digital Games and Activities](https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp) | Reviewed as a catalog of educational design examples; no CSA dataset is integrated. |
| Space Apps 2023 *Visualize a Space Mission Using Virtual Reality* (named on the 2026 Resources tab) | Related challenge context for explaining mission concepts, trajectories and timelines; no VR mode or 2023 project code is included. |

**Challenge and resource review:** the official [challenge details](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=details) and [NASA Data & Resources tab](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources) were reviewed from the supplied page text. The Resources tab says NASA does not endorse non-U.S. Government entities and that their data-use terms apply; this project does not represent NASA endorsement, and external resources remain subject to their own stated terms.

**Supplied-PDF source check:** the NASA systems-engineering webinar and JPL CML paper directly inform the mission flow and explicitly “inspired by” progress labels. `Satlite_Options.pdf` was used as a science-goal-first design reference. The Scope It Out transcript, Level 1–3 Science PDFs, and CubeSat 101 guide were reviewed but are not sources for current game mechanics or simulated results. NASA Mission Viz and the 2023 VR challenge are visualization/design references only; their code is not included.
- **Code:** three.js r160 (MIT), PeerJS 1.5.4 (MIT; uses the free public PeerJS broker and Google's public STUN servers), qrcode-generator 1.4.4 (MIT), the Draco decoder (Apache 2.0), the meshoptimizer decoder (MIT). Playwright Core (Apache 2.0) for development only.
- **Characters:** Quaternius Universal Base Characters and Universal Animation Library, CC0.
- **Fonts:** Archivo and Noto Kufi Arabic, SIL Open Font License 1.1.
- **Sounds:** none recorded; all synthesized with the Web Audio API.
- **Our own art:** KILO, the four astronauts' 2D portraits, the spacecraft, lander, capsule and surface worlds are drawn in code.
- **Licence of our work:** Apache-2.0 (`LICENSE`).

## Use of Super Intelligence (SI)

(The 2026 FAQ uses "Super Intelligence (SI)" for what the 2025 form called "Use of Artificial Intelligence". Paste this into whichever name the form uses.)

- **Tool:** Claude Code, Anthropic's AI coding assistant, running Claude models. We ran it as a team of agents: a lead agent kept the design documents (`docs/TEAM.md`, `docs/TEAM-V2.md`, `docs/TEAM-SURFACE.md`) and the contracts between modules, and specialist agents worked in parallel on separate files: the simulation and balance, the room and networking, the setup and build screens, KILO and the crew, the flight and cabin, the surface, the results, the Arabic translation, the scripted demo and this submission text.
- **What SI generated:**
  - most of the JavaScript, HTML and CSS: the simulations (`js/team/sim.js`, `js/team/surface-sim.js`), the room and network code, all screens and the 3D scenes;
  - first drafts of the game text, KILO's and the crew's lines, the Arabic translation and this submission text;
  - research summaries compiled from the NASA pages they cite (`docs/research/`).
  - **What the team did:** decided what the game is and redesigned it after playtesting (the "calm, one step at a time" version in `docs/TEAM-V2.md` came from our own play sessions), reviewed the design, played every version and checked the facts. Individual review assignments and hand-authored contributions were not provided.
- **What SI did not generate:** no images, video, audio or 3D models taken from an image or video generator. Planet maps are NASA and USGS material; the characters are CC0 models by Quaternius; KILO, the spacecraft and the worlds are drawn by code; all sound is synthesized by code. The demo video is a screen recording of the game playing itself.
- **How we checked the output:** automated tests in Node (`tests/team-*.test.js`: the simulation, balance targets, the room state machine, networking, the surface, KILO's scripts, the flight and the interface); a bot balance search over thousands of designs (`docs/TEAM-BALANCE.md`); headless-browser screenshots of every screen with the console checked for errors; and links and numbers checked against the cited sources. Numbers simplified for play are stated as such.
- **Rules we kept:** no NASA logos or mission insignia, no SI-generated imagery presented as NASA's, and we never write "according to NASA" for text that we or an SI tool wrote.
