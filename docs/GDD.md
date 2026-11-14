# Every Kilogram — Game Design Document

**One line:** Run a young space agency from 2027 to 2036. Win missions, design spacecraft where every kilogram costs fuel, money and risk, steer them through NASA's real project life cycle, and watch them fly with real NASA data, real launch windows and real lessons from missions that failed.

**Challenge (Space Apps 2026, Space Mission Design Game):** "create an interactive game that allows participants to design, manage, and simulate a complete space mission while making engineering decisions, managing limited resources, and evaluating how each choice shapes the success of their mission." Audience: students aged 13–18 who have never seen a whole mission from concept to operations.

**Award targets:** Best Mission Concept (first), Best Use of Data, Art & Technology, Most Inspirational. Research behind this document is in `docs/research/`.

---

## 1. Pillars

1. **Design is the game.** The most fun part is building the spacecraft. Every part changes mass, power, data, cost, risk and schedule, and the player sees the change happen at once in 3D and in the requirements.
2. **NASA data is the engine, not decoration.** The things that drive gameplay are real: planet positions and launch windows (Lambert solver on JPL mean elements), solar flux, data rates, rocket-equation propellant, real NASA surface maps and spacecraft models, real science results unlocked as "discoveries", real failures turned into events, and real mission numbers to compare against. Every number has a source tooltip.
3. **Manage like NASA.** The real life cycle drives the career: Phase A–F, review boards (MCR, PDR, CDR, FRR), reserves, schedule margin, launch windows that do not wait, a shared pool of teams, research.
4. **Evaluate every choice.** After each mission, the report says what each decision did, with what-if numbers ("A 3 m dish would have returned 41% more data"), and puts your spacecraft next to the real NASA mission.
5. **Short loops, clear goals.** A mission from proposal to results takes 6–10 minutes. A full career takes 45–60 minutes. Classroom mode plays one mission in 45 minutes with a teacher sheet.
6. **Beautiful and light.** 3D in the browser, no install, runs on a school laptop. English and Arabic (right to left).

## 2. Structure

```
Title ─► New agency (name, logo patch, home country flag-free)
      ─► HQ (3D campus hub, calendar, money, reputation, teams)
            ├─ Mission Board (Announcements of Opportunity)
            │     └─ Proposal ─► Phase A Design (3D clean room) ─► MCR review
            │                    ─► Phase B/C (months pass; events; PDR, CDR reviews)
            │                    ─► Phase D Test campaign ─► FRR (Go/No-Go)
            │                    ─► Launch film ─► Cruise ─► Arrival film (CERR)
            │                    ─► Phase E Operations (science, space weather, DSN)
            │                    ─► Results + Discoveries + "Your design vs the real mission"
            ├─ Solar System Map (3D, real positions, launch windows, active missions)
            ├─ Research Lab (tech tree bought with science points)
            ├─ Discovery Archive (real NASA images and data you have unlocked)
            └─ Patch Wall (every mission flown)
End: 2037 or all three headline missions earned ─► Agency legacy
```

## 3. Missions (contracts)

| Key | Title | Destination | Unlock | Headline instrument | Real NASA analog for comparison |
|---|---|---|---|---|---|
| nile | Nile from orbit | Earth, 600 km polar | start | camera (Landsat-style) | Landsat 9 (2,711 kg) |
| weather | Storm watcher | Earth, 800 km polar | start | infrared spectrometer | Terra/MODIS |
| moon | Lunar water hunter | Moon, 100 km polar | open at the start | neutron spectrometer | LRO (1,916 kg, 823 W average) |
| mars | Buried ice on Mars | Mars | reputation 2 | shallow radar sounder | MRO (2,180 kg, ~2,000 W at Mars, 6 Mbps) |
| venus | Is Venus still erupting? | Venus | reputation 3 | imaging radar (SAR) | Magellan (3,449 kg, 268.8 kbps) / VERITAS |
| jupiter | How thick is Europa's ice? | Jupiter / Europa | reputation 4 + radiation vault research | ice-penetrating radar | Europa Clipper (~6,000 kg) / Juno (~400–435 W at Jupiter) |
| crew | Crew around the Moon (you fly on it) | Free-return loop, 6,545 km past the far side | reputation 5 + heavy launcher research | none: bring the crew home safely | Artemis II, Orion "Integrity" (1–10 April 2026) |

Mission data lives in `js/data.js` (`MISSIONS`, `CONTRACTS`). Physics and simulation live in `js/physics.js`, `js/model.js`, `js/ops.js`. The career lives in `js/agency.js`.

### 3.1 Crew around the Moon (kind `crew`)

A late-career crewed lunar flyby modelled on Artemis II: four astronauts (the player is one of them) on a super heavy rocket (SLS Block 1 class, 27 t), about 9 days, home at 11 km/s. Numbers and sources: `D.CREW` in `js/data.js`, `content/sources.js` (artemis2, slsLift, slsAscent, orionMass, orionTli, orionLas, orionHeatShield, orionShelter, orionLifeSupport, artemisCost).

- **Design choices** (normal parts plus five crew fields, `OPTIONS.*` and `CREW_PARTS`): launch abort system (7.7 t tower, costs about 1.5 t of lift), heat shield (1,000 / 1,350 / 1,750 kg of ablator), entry (skip: gentler g, more heat; direct: Artemis II), life support (12 / 21 / 30 days of air and water), storm shelter (none / stowage bags / water wall), service-module fuel margin, cameras for the far side, one or two flight computers. Maxing everything is too heavy for the rocket.
- **Goals and scoring:** bring the crew home safely (55 points, key goal), far-side photos (25), test life support with four aboard (20). A lost crew scores 0 (and loses reputation); an abort that saves the crew scores about 38. Headline: 70 points with the crew home at 80% or better.
- **Flight** (`SMD.ops.crewFlight`, all rolls drawn up front so what-ifs share the luck): a bent booster sensor (Soyuz MS-10) means an abort, or the loss of the crew without a tower; the service module burns 388 m/s for the Moon, and a leak with too little margin makes the entry steeper; a stuck air-system valve eats spare days (Apollo 13 lesson); a solar storm (22%) needs the shelter; one flight computer can reset behind the Moon and spoil the photos; the heat shield ratio (capacity against the heat of the entry, worse with Artemis I-style char loss, a skip entry or a steep corridor) decides ok / scorched / burned through; a parachute flaw leaves two mains (Apollo 15).
- **Events:** `apollo1-fire`, `apollo13-tank`, `artemis1-char`, `soyuz-ms10` (crew missions only).
- **The ride** (`js/screen-ride.js`, `js/3d/ride.js`): walk the crew access arm, countdown from the seat, liftoff, max-Q, booster separation, abort tower jettison (light floods the windows), main engine cutoff (the plush floats), the burn to the Moon (stop it at 388 m/s), the coast, the far side through the window (snap real far-side features and Earthset), service-module separation, entry plasma and g, parachutes and splashdown. About 85 seconds; Esc skips and keeps the flight team's result. The crew's calls, photos and fixes raise the score through `SMD.ops.crewApplyRide`; the design decides whether the crew lives.
- **Flow:** launch day → `film` (crew launch → `ride`) → HQ; the next month brings the arrival (skipped for crews) and the results.

## 4. The mission loop in detail

### 4.1 Announcement of Opportunity (Mission Board)
- Card per mission: real science question, a real NASA image (the "why"), sponsor, reward, difficulty, next launch window.
- Picking a card opens the proposal: choose a **cost confidence** (Lean / Standard / Safe). Lean asks for less money (more likely to be selected and more reputation) but carries a smaller reserve. Standard = 25% reserve (Discovery rule). Safe = 40%.

### 4.2 Phase A — Design (the core)
- 3D clean room with the spacecraft on a stand, a 1.75 m person for scale, and real NASA hardware nearby for comparison (an MRO or LRO model in the corner).
- **Parts tray** (big tiles with icons, 2 numbers each): instruments, solar panels (stepper), RTG, dish, radio power, recorder, computer (single/dual), radiation vault, propellant margin, capture method (burn/aerobrake), launcher.
- **Requirements panel** (live, green/amber/red, with a short reason): headline instrument, rocket can lift it, power at destination, science returned, budget, reliability, launch window reachable.
- **Every-kilogram ribbon:** "+1 kg of hardware = +2.3 kg at launch" and an animated snowball when mass grows.
- **Trade study button:** compares the current design with the last two saved versions on a small chart (mass, power, cost, expected science).
- **Real mission card:** your spacecraft vs the NASA analog (mass, power, data rate, cost).
- Every number shows a source on hover (`content/sources.js`).

### 4.3 Review boards (MCR, PDR, CDR, FRR)
- A short scene with four board members (Science, Systems, Budget, Safety). Each one asks a question generated from the design checks ("Power margin is 4%. Engineers want 20%. Your call?").
- The player answers with a choice card: fix it (cost or time), accept the risk, or descope (drop an instrument, shorter operations).
- Outcome: Pass, Pass with actions (small cost), or Fail and redesign. Reviews happen automatically at the right months; the calendar stops for them.

### 4.4 Phases B–D on the calendar (management)
- Months pass on the HQ calendar (advance one month, or skip to the next event).
- **Money:** a yearly government budget (plus reputation bonus), the project reserve bar (UFE), and monthly spending.
- **Teams:** 2 teams at the start, up to 4. Overloading slows every project (Psyche lesson).
- **Events from real history** (`content/events.js`), each one a choice card with effects, for example:
  - *Units mismatch* (Mars Climate Orbiter): pay for an end-to-end interface test or risk a navigation error at arrival.
  - *Upside-down sensor* (Genesis): heritage parts are cheap but carry a hidden flaw unless re-verified.
  - *Vacuum leak in an instrument* (InSight): fix it and miss the window (26 months, +cost) or fly a degraded instrument.
  - *Workforce overload* (Psyche): delay another project or hire.
  - *Bad transistors* (Europa Clipper): pay for more testing, swap parts (slip) or fly with a reduced plan.
  - *Budget storm* (FY2027 request): the yearly budget drops unless reputation is high.
- **Test campaign (Phase D):** choose test depth per subsystem group (Inspect / Test / Test-as-you-fly). Tests reveal hidden flaws; fixing costs money and weeks.
- **Launch windows are hard deadlines.** Planets have real windows (Mars every ~26 months). Missing one costs storage money and reputation.

### 4.5 Launch, cruise and arrival (simulate)
- **Launch film** (3D, ~15 s): generic launcher on the pad (sized to the chosen class), ascent, staging, fairing, Earth curvature. No player piloting.
- **Cruise** on the Solar System Map: the spacecraft's real Lambert trajectory; events appear as captions (solar storm from real space-weather statistics, deployments, course corrections).
- **Arrival film** (~15 s): planet with real NASA texture, orbit insertion burn, with the radio-delay countdown ("this happened 13 minutes ago"). The result comes from the propellant the design actually carries.

### 4.6 Phase E — Operations
- A 3D orbit view over the real planet map, instruments scanning, data flowing home through a DSN dish. Time-lapse of 12 science months (~20 s).
- Space weather, dust storms, solar conjunction blackouts (computed from real geometry), instrument failures from untested flaws.
- One or two **operations decisions** during the phase (e.g., Juno-style "risky burn vs safe orbit", "extend the mission?").

### 4.7 Results (evaluate)
- Score per science goal, headline earned or not.
- **"What shaped this mission"**: 3–5 cause→effect lines with numbers from what-if reruns (dish, panels, tests, margin, launcher).
- **Your design vs the real mission** card.
- **Discoveries unlocked:** real NASA images/data from the matching mission, with caption and credit (`content/discoveries.js`). They go to the Discovery Archive.
- Rewards: reputation, science points, money (commercial contracts), the mission patch.

## 5. Career systems
- **Reputation** unlocks harder missions and raises the yearly budget.
- **Science points** buy research (`TECH` in `js/data.js`).
- **Calendar** 2027–2036. Ending: Agency legacy page (headlines, patches, discoveries, best decisions, total science).
- **Agency score** for the end screen and a shareable patch image.

## 6. Classroom mode
- One mission (Mars), guided, 45 minutes, with a printable teacher sheet (`docs/teacher.md`): learning objectives, NGSS mapping (MS-ETS1-1..4, HS-ETS1-1..4, HS-ESS1-4, HS-PS2-4), discussion questions.

## 7. Art direction
- Day screens (HQ, designer, research): drafting vellum `#E6ECE8`, graphite ink `#23282E`, review-board red pen `#B4302C`, teal for good `#17807A`, patch gold `#D9A21B`.
- Night screens (films, map, operations): slate `#101922`, chalk `#E9EEF2`, data in a single-hue blue ramp.
- Type: Archivo (variable width): condensed heavy for headlines, normal for body. No all-caps labels.
- The mission patch is the signature object: it is drawn from the design and stitched at the end of each mission.
- **No NASA logos or insignia anywhere.** Credits read: "Imagery and models courtesy of NASA, NASA/JPL-Caltech, NASA Earth Observatory, NASA SVS, NASA Trek, USGS Astrogeology. Use does not imply NASA endorsement."

## 8. Technical architecture

- Plain JavaScript, no build step. Classic scripts attach to `globalThis.SMD`; the 3D layer is ES modules under `js/3d/` using `three` from `vendor/three.module.js` via an import map.
- **Screens:** `SMD.ui.screens[name] = { render(app, params) → optional cleanup }`; navigate with `SMD.go(name, params)`.
- **3D scenes:** `SMD.three.engine.mount(container, { scene, camera, update(dt), dispose() })`, one shared renderer.
- **Assets:** `SMD.assets.texture(id)` and `SMD.assets.model(id)` return promises (manifest in `js/3d/assetmanifest.js`); every 3D scene must still look right if an asset fails (procedural fallback in `js/3d/assets.js`).
- **Strings:** every visible string goes through `SMD.t(key, englishText, params)`; Arabic lives in `js/i18n/ar.js`.
- **Events:** `SMD.bus.on(name, fn)` / `SMD.bus.emit(name, payload)` for HUD updates.
- **Career state:** `SMD.game.agency` (from `js/agency.js`), saved to localStorage under `ek-save` after each month.
- **CSS:** shared tokens in `css/style.css`; each module adds its own file `css/<module>.css`.
- **Tests:** `node --test "tests/*.test.js"`.

## 9. Content schemas

```js
// content/events.js  — SMD.content.events = [ ... ]
{
  id: 'units-mismatch',
  phase: 'C',                      // when it can happen: 'A'|'B'|'C'|'D'|'E'
  chance: 0.25,                    // per eligible project, once
  when: { kinds: ['planet','moon'] },   // optional filter
  title: 'Two teams, two units',
  body: 'Navigation software writes thruster data in pound-force seconds, the spacecraft expects newton-seconds…',
  realStory: { mission: 'Mars Climate Orbiter', year: 1999, lesson: 'Write interface specs down and test them end to end.', source: 'https://llis.nasa.gov/...' },
  choices: [
    { id: 'test', label: 'Pay for an end-to-end interface test', effects: { money: -8, months: 1 } },
    { id: 'skip', label: 'Trust the spec and move on', effects: { hiddenFlaw: 'navigation' } },
  ],
}
// effects keys: money (M$), months (schedule slip), rep, science, reserve (M$ from project reserve),
// hiddenFlaw (subsystem id added as an untested flaw), instrumentQuality ({id: factor}), dropInstrument (id)

// when.kinds may include 'crew' (crewed missions); hiddenFlaw may also be 'lifeSupport', 'heatShield' or 'ascent'.

// content/discoveries.js — SMD.content.discoveries = { nile: [ ... ], weather: [...], moon: [...], mars: [...], venus: [...], jupiter: [...] }
{ id: 'mars-sharad-ice', title: 'Ice sheets hidden under Mars dust', caption: '...', mission: 'MRO', instrument: 'SHARAD', year: 2016,
  image: 'assets/discoveries/mars-sharad-ice.jpg', sourceUrl: 'https://...', credit: 'NASA/JPL-Caltech/...', minScore: 40 }

// content/realMissions.js — SMD.content.realMissions = { mars: { name: 'Mars Reconnaissance Orbiter', launchMassKg: 2180, powerW: 2000, dataRate: '6 Mbps', costM: 720, launch: 'Atlas V 401, 2005', source: 'https://...' }, ... }

// content/sources.js — SMD.content.sources = { solarFlux: { text: 'Solar flux 1361 W/m² at 1 AU, falls with 1/r²', url: 'https://...' }, ... }
```

## 10. Build plan (parallel modules)

| Module | Files it owns |
|---|---|
| Assets and loaders | `vendor/GLTFLoader.js`, `vendor/DRACOLoader.js`, `vendor/draco/*`, `vendor/meshopt_decoder.module.js`, `vendor/BufferGeometryUtils.js`, `js/3d/assetmanifest.js`, `js/3d/loader.js`, `assets/discoveries/*` |
| Content | `content/events.js`, `content/discoveries.js`, `content/realMissions.js`, `content/sources.js`, `docs/teacher.md` |
| HQ campus 3D + hub screen | `js/3d/hq.js`, `js/screen-hq.js`, `css/hq.css` |
| Solar System Map | `js/3d/solarmap.js`, `js/screen-map.js`, `css/map.css` |
| Designer | `js/screen-design.js`, `js/3d/designer.js`, `css/design.css` |
| Reviews, events and board | `js/screen-review.js`, `js/screen-board.js`, `css/review.css` |
| Films and operations | `js/3d/films.js`, `js/screen-film.js`, `js/screen-results.js`, `css/film.css` |
| Research, archive, patches, end | `js/screen-research.js`, `js/screen-archive.js`, `js/screen-end.js`, `css/meta.css` |
| i18n | `js/i18n/ar.js`, RTL rules in `css/rtl.css` |
| Core (lead) | `js/agency.js`, `js/model.js`, `js/ops.js`, `js/data.js`, `js/main.js`, `index.html`, `js/i18n.js`, `js/bus.js` |
