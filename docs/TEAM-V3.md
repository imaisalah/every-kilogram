# v3: the team's playtest fixes + the Resources tab (binding; builds on TEAM-V2.md)

The team played the game. Their list, plus what the Resources tab implies. Everything here is in scope. Stability first: the game must keep working at every step; tests must pass.

## Errors the team found
1. **Playing together on different devices "isn't available".** Root cause: the game must be opened from a hosted URL (GitHub Pages) for friends' devices to reach it; from `localhost` an invite link is useless to others. Fix: when the page is served from localhost/127.0.0.1/file, the Play-with-friends screen says so plainly and offers the right path (the hosted link, or `play-team.bat` on the same Wi-Fi with the LAN address); invite links always use a reachable origin. (Lead.)
2. **Roles must own their components.** If I am the Communications engineer, I choose only the communications parts (antenna, radio, ground stations, recorder…), not science. Each build step belongs to one job. In **solo**, the player builds only their own job's steps; the three AI crewmates make the other choices themselves (sensibly, for the chosen requirement and difficulty), and each crewmate's pick appears on its step with one line in their voice ("Mateo: I fitted the 2,000 Wh battery so we survive the night."). The player can view those steps and **suggest** a change (the crewmate may accept with a reason), but cannot just overwrite them. In multiplayer, owners pick and others suggest (already so).
3. **Each mission is defined by its need, goals, concept and requirements**, as in NASA's *Design and Develop Science Missions*: Science need → mission goal → science objectives → measurement requirements → mission requirements → mission concept. A **Mission definition** screen before the build shows this chain for the chosen destination in plain words (a science traceability table a 13-year-old can read), and the chosen requirement level feeds it. The build steps then show which requirement each part serves.
4. **Difficulty must change the depth of detail, not just the numbers**, as in JPL's **Concept Maturity Levels**: Cadet ≈ CML 1-2 (idea and feasibility: plain choices, simple pros/cons); Engineer ≈ CML 3 (trade space: real specs on each card: mass, power, data rate, efficiency, heritage); Flight director ≈ CML 4 (point design: margins, redundancy, degradation over lifetime, technology readiness, cost confidence, and requirement verification). Show the CML label and what it means on the difficulty step and in the build header.
5. **On the surface I'm responsible only for my job.** Communications: plant/align the dish and run uplinks; Scientist: scan sites and pick samples; Engineer: power, suits, lander systems and repairs; Mission planner: route, timing, call home and the ascent plan. Interactions outside your job are done by crewmates (bots or other players); your objective line shows your job's tasks.
6. **Character names on the surface differ from the ones picked at the start.** Use the crew chosen in setup everywhere (cabin, flight, surface tags, HUD, results).

## Additions
7. **Website background: stars** (a calm starfield) instead of flat blue, on every screen.
8. **Pick one of the four astronauts or create your own** (name, look, job) with the existing astronaut creator.
9. **Choose your guide.** The team asked for TARS (Interstellar) or Princess Bubblegum (Adventure Time). Those are copyrighted, and this is a public submission, so we offer **original guides inspired by those vibes**: KILO (the existing deadpan box robot), plus two new originals, e.g. a monolith-style tall robot with dry military humour (not TARS's exact look or name) and a cheerful scientist from a sweet-planet kingdom (not Bubblegum's look or name). Each with its own portrait, voice in text, and lines for every moment.
10. **Music:** an original, procedurally generated calm space soundtrack (Web Audio, no licensing), by phase (menu, build, flight, surface, results), with a volume slider and mute in Settings.
11. **Make the mission's goal and need clear to the player before and during the landing**: a short "Why we're here" card before descent and a persistent goal line during landing and on the surface.
12. **Fix the scoring.** Make it traceable and fair: points come from requirements met (from the traceability table), science returned, resource efficiency, teamwork; it must never contradict the outcome (e.g. a wiped or stranded mission can't outscore a successful one), and the results show exactly where every point came from.

## Resources-tab gaps
13. **Segments in the build:** label every build step with its segment (Launch, Space, Ground, User).
14. **Incompatible choices locked:** instruments/orbits that cannot serve the chosen objective are shown locked with a one-line reason (as in NASA's telescope learning game).
15. **CubeSat mission** (NASA CubeSat 101): a small-satellite scenario (e.g. a 6U CubeSat watching the Nile from low Earth orbit) with CubeSat-scale parts, rideshare launch, and ConOps steps.
16. **VR view** (2023 Space Apps VR challenge): a "View in VR" option for the flight/orbit 3D via WebXR when a headset is available.
17. **Thermal control** as a build step on Engineer and above (MDL discipline): heaters/radiators/insulation with real consequences (power, mass, survival in cold or hot worlds).
18. **DONKI live lookup** (team addition) uses an endpoint that currently returns 404 (lead fixes).

## As built (v3: look & feel)
Owner: look & feel engineer (items 7, 8 creator side, 9, 10, 16). Files: `css/stars.css`, `js/team/starfield.js`, `js/team/music.js` (new); `js/team/crew.js`, `js/team/guide.js`, `js/team/guide-lines.js`, `js/team/ar-guide.js`, `js/team/flight3d.js`, `js/team/view-flight.js`, `js/screen-avatar.js`, `js/avatar.js`, `css/avatar.css`, the `tf:` block of `css/team.css`, plus a Guide and a Music row in Settings (`js/ui-common.js`, `js/game.js`).

### Tags the lead adds (index.html and join.html)
- `<link rel="stylesheet" href="css/stars.css" />` after `css/team.css` (join.html: after `css/team-phone.css`).
- `<script src="js/team/starfield.js"></script>` and `<script src="js/team/music.js"></script>` right after `js/team/guide.js` (both are classic scripts with no dependencies; they start themselves).

### 7. Starfield: `SMD.starfield`
One fixed layer behind every page (`<div class="ek-stars">` with two canvases, `z-index: -1`, `pointer-events: none`); `html.ek-stars-on` makes the calm screens' flat navy transparent so the stars show through (`css/stars.css`). Stars are drawn once per resize; about 5% twinkle slowly at 12 fps; one faint shooting star every minute or so. Reduced motion: no twinkle, no shooting stars. The twinkle stops while the tab is hidden and while a full-screen 3D phase is up (cabin, flight, landing, surface, ascent). API: `start()`, `stop()`, `pause()`, `resume()`, `layout(w, h, seed)` (pure, tested). A view that wants its own opaque background just sets one; nothing else is needed.

### 8. Your own astronaut: `SMD.team.crew` additions
- `crew.canCreate()`: true when the creator (`js/avatar.js` + `js/screen-avatar.js`) is loaded (index.html; not join.html).
- `crew.openCreator({ job, onDone(member), onCancel() }) -> { close() }`: opens the existing astronaut creator as a full-screen overlay above the current screen (the room keeps running underneath): name, job (the 4 jobs), build, beard and the whole look; Save stores it and calls `onDone(member)`.
- `crew.custom()` -> the saved member or null; `crew.saveCustom({ name, job, appearance })`; `crew.clearCustom()`. Saved in localStorage `ek-crew-custom`.
- The member is `{ id, custom: true, name, short, job, color, personality, bio, detail, intro, from, appearance }` like the roster. Its `id` is `custom-<code>`: the look and job are encoded in the id (`crew.customId(member)`), so in multiplayer every device can draw it from `crewId` alone (the room already accepts it: `setRole{ role: member.job, crew: member.id }`). `crew.byId(id)` decodes any `custom-…` id (the name comes from the local save when it is yours, else pass the player's name: `crew.byId(id, { name })`). `crew.isCustom(id)`.
- `crew.lineup(...)` puts a custom astronaut in the seat of its job (that roster member stays home); `crew.cabinScript`, `crew.portrait`, `crew.text` all work with it.
- Crew step (build engineer): show the four, plus a fifth card "Create your own" (or the saved custom with "Edit"): `crew.openCreator({ onDone: (m) => ctx.send({ type: 'setRole', role: m.job, crew: m.id }) })`. Hide it when `!crew.canCreate()`.

### 9. Choose your guide: `SMD.team.guide` additions
Three original guides: `kilo` (unchanged), `brace` and `praline` (described in the lead's report). Everything that already calls `guide.say/sayMoment/scriptFor/verdict/portrait` follows the chosen guide automatically.
- `guide.list()` -> `[{ id, name, role, blurb }]`; `guide.current()` -> id; `guide.setCurrent(id)` (saved in localStorage `ek-guide`, emits bus `guide`); `guide.info(id)`; `guide.name()` (the current guide's display name: use it instead of a hard-coded "KILO").
- `guide.scriptFor(mission, moment, params, guideId?)`: same moments as before for every guide; `guide.portrait(mood, { size, talking, guide })`.
- `guide.picker(el, { onPick(id), compact })` -> `{ destroy() }`: three calm cards (portrait, name, one line); picking one makes it say hello in place. Mount it on the difficulty or crew step; it is also in Settings.
- 3D: `import { makeGuide3D } from 'js/team/flight3d.js'` -> same handle as `makeKilo` (`{ group, setMood, setTalking, update }`) for the chosen guide.

### 10. Music: `SMD.music`
Original procedural calm space music (Web Audio, no files). Phases `menu`, `build`, `flight`, `surface`, `results`, each its own key, scale, tempo and voices (pad, sparse bell melody, low drone, echo), crossfading over about 3 s. It follows the screen by itself (title -> menu; lobby/brief/questions/design/lock -> build; cabin/flight -> flight; landing/surface/ascent -> surface; debrief -> results), so no view has to call it; `music.play(phase)` / `music.stop()` override. Starts on the first click or key (browser autoplay rules). Settings: Music On/Off and a volume slider (`SMD.settings.music`, `SMD.settings.musicVolume`, 0..1); the main Sound Off silences it too. API: `play(phase)`, `stop()`, `phase()`, `setVolume(v)`, `volume()`, `setMuted(b)`, `muted()`, `plan(phase, fromBar, bars, seed)` (pure, tested).

### 16. View in VR
On the flight screen a "View in VR" button appears in the top bar only when `navigator.xr.isSessionSupported('immersive-vr')` resolves true and the 3D view is running. It renders the same flight scene in the headset (a still viewpoint a few metres from your spacecraft, the planet turning below; no camera moves, so no motion sickness). `flight3d.js` exports `vrSupported()` and `createVR(api)`. Uses three r160's built-in WebXR (no extra vendor file).

## As built (v3: build)
Owner: build engineer (items 2, 3, 4, 12, 13, 14, 15, 17 and the build side of 8). Files: `js/team/data.js`, `js/team/sim.js`, `js/team/room.js`, `js/team/view-setup.js`, `js/team/phone.js`, `js/i18n/ar-team.js`, `js/team/ar-sim.js`, the `ts:` block and the tokens at the top of `css/team.css`, `tests/team-{sim,room,ui,integration}.test.js`. Status: being built; this section is the contract and is kept current.

### Phases: a Mission definition screen (item 3)
`lobby → brief → questions → define → design → lock → cabin → flight → …`. `define` is new: the science traceability chain for the chosen destination and success criterion (Back → questions, Next → the build). `stepTo{index}` also works from `questions` and `define` (it creates the design if there is none yet). Views keyed by phase: `SMD.team.views.define` (view-setup.js). The tracker counts `define` inside the "Success criterion" stage. Music/other code that lists the setup phases should treat `define` like `questions`.

### Roles own their build steps (item 2)
Step → job (`step.role` from `sim.buildSteps`): **planner** orbit, lifetime (Mission length), rocket · **engineer** power, batteries, thermal, computer (Computer & pointing) · **scientist** instruments, landing (Landing kit) · **comms** radio (Antenna & radio), ground (Ground stations), recorder (Data recorder).
- Multiplayer: owners pick (`build`), everyone else suggests (`suggest`), unchanged.
- Solo: `view.soloJob` = the job of the astronaut the player picked (`setRole{role, crew}`; null = old behaviour, the player owns every step). The player builds only steps with `step.role === soloJob`. The other steps are picked by the AI crewmates when the build opens, and re-checked after each of the player's changes (the crewmate rocket is always re-fitted to the cheapest rocket that lifts the ship).
- `view.crewNotes[stepId] = { role, crewId, name, option, text, at }`: the crewmate's pick and one line in their voice ("Mateo: I fitted the 2,000 Wh battery so we survive the night."). `name` is the roster member's short name (`SMD.team.crew.byJob(role)`).
- In solo a `suggest` (or a `build`, e.g. from js/demo.js) on a crewmate's step is answered at once: `view.suggestions[stepId] = { option, by, name, at, reply: 'ok'|'no', replyText, replyBy }`; on 'ok' the change is fitted.
- Pure helpers: `sim.crewPick(design, stepId, { seed }) -> { option, line }`, `sim.crewReview(design, stepId, optionId, { seed }) -> { ok, line, design }`.

### Segments (item 13)
Every build step has `step.segment`: `launch` (rocket) · `space` (orbit, power, batteries, thermal, instruments, radio, recorder, computer, landing) · `ground` (ground stations, mission length: the team on the ground runs and pays for operations) · `user` (the success criterion and the Mission definition: the scientists who use the data). `sim.segments() -> [{ id, title, blurb }]` (translated). Debrief: the build labels are the source of truth; mission-review.js may align its `keys` lists with `step.segment`.

### Traceability (item 3) and requirements served
- `sim.traceability(design) -> { scenario, requirement:{id,title,text}, need, goal, objectives:[{ id, title, weight, primary, measure, instruments:[{id,name}] }], missionReqs:[{ id:'MR-1'…, key, text, steps:[stepId], segment }], concept }`. Plain words, translated. Mission requirement keys: `measure` (instruments that answer the question), `view` (an orbit that sees the target), `power`, `data` (data home), `life` (lasts the mission), `launch` (one rocket and the budget), `land` (landing worlds: land near the target, lift samples home).
- `step.serves = ['MR-2', …]` on each build step (ids from the table above).
- `sim.requirementStatus(design, flight?, surfaceSummary?) -> [{ id, key, text, met, why, steps }]`: before flight from the design checks, after flight from what actually happened. The score's requirement points use the after-flight version.

### Concept maturity depth (item 4)
`sim.cml(difficulty) -> { id, level:'1–2'|'3'|'4', name, what, depth: 1|2|3 }` (Cadet 1, Engineer 2, Flight director and Sandbox 3). Shown on the difficulty step and the build header. `sim.stepCards` cards gain:
- `specs: [{ id, label, value }]` at depth ≥ 2 (Engineer: real mass, power, data rate, efficiency, heritage …);
- `detail: [{ id, label, value, status? }]` at depth 3 (Flight director: margin, redundancy, degradation over the lifetime, TRL, cost confidence, how the requirement is verified);
- `locked: null | { reason }` (item 14) and `serves`.

### Locked choices (item 14)
`card.locked = { reason }` when an option cannot serve the objective here (an instrument that sees almost nothing from this orbit, radio science without a big enough dish, an instrument too big for a CubeSat, an orbit the requirement or the launch cannot use). Locked cards cannot be fitted: the room refuses `build`/`set` with code `locked` and the reason; the AI never picks them; the debrief's best change never proposes them.

### CubeSat (item 15)
Scenario id **`cubesat`** ("CubeSat over the Nile"): a training flight in low Earth orbit (`training: true`, `kind: 'earth'`, `dest: 'earth'`, no surface). CubeSat-scale parts (kg, W, $k), rideshare: the Rocket step is "Bus and ride" (6U slot, 12U slot, or a dedicated small rocket). KILO lines: `guide.scriptFor('cubesat', …)` falls back to the common lines unless guide-lines.js adds a `cubesat` script. Mission review real-mission compare: none yet (REAL_KEY has no `cubesat`).

### Thermal control (item 17)
New engineer key `thermal` and build step `thermal` (Engineer and Flight director; Cadet keeps the standard system). Options: blankets and paint (light, no heater power, too weak where it is very cold or hot and parts age faster), heaters and a radiator (the old baseline), louvres and heat pipes (heavy and power hungry, parts age half as fast). Too weak a system on Moon/Mars/Europa means cold nights (battery capacity drops, instruments switch off in the dark); on Venus it overheats in the sunlight (science quality drops). New flight event kind `thermal`, new check id `thermal` (fix step `thermal`). Designs without a `thermal` pick behave exactly as before (standard).

### Score (item 12): `sim.score(design, flight, teamStats?, surfaceSummary?)`
`{ total, medal, medalTitle, outcome, axes, requirements, science, efficiency, teamwork, details }`
- Axes (points, max): `requirements` 300 (mission requirements met after the flight, equal share each), `science` 300 (science returned; landing worlds 55% orbit, 45% surface), `efficiency` 200 (budget left 80, mass margin 60, data that got home 60; over budget × 0.3), `teamwork` 200 (problems fixed 90, requests/suggestions answered 60, hidden goals 50).
- `axes[id] = { value, max, why, items:[{ id, label, points, max, met?, why }] }` for `requirements`, `science`, `efficiency`, `teamwork` (every point comes from one item). There is no `survival` axis any more: survival is the `life` requirement (and, on landing worlds, `land`: the crew home).
- `outcome = { id:'full'|'partial'|'fail'|'lost', title, band:[min,max], earned, adjust, why }`. The total is `earned + adjust`, clamped into the band of the outcome: lost (spacecraft dead, crew lost or stranded) ≤ 299, failed (alive, science missed) ≤ 449, partial 450–749, full 750–1000. So a lost or failed mission can never outscore a successful one. `adjust` is shown as its own line ("Outcome rule").
- `total === requirements + science + efficiency + teamwork + outcome.adjust`.

## Round 2 additions (team's second list, binding)
19. **Three signature missions, each unique:** make the Moon, Mars and CubeSat missions clearly distinct in what you build, what the flight shows and what the surface asks. Each gets its own Mission definition chain (item 3), its own parts emphasis (e.g. CubeSat: rideshare + tiny bus + data budget; Moon: polar ice + night survival; Mars: aerobraking/landing accuracy + dust), its own crisis set, its own surface objectives, and its own KILO/guide lines. Other destinations stay but can share patterns.
20. **Mission Viz on the launch and cruise:** an interactive trajectory view (in the spirit of NASA Mission Viz) in the flight phase: orbit/transfer path drawn in 3D with the real bodies, a time scrubber, mission events as markers on the path (launch, separation, burns, arrival, orbit insertion, science passes), free orbit camera; usable on phones. Must not break the existing flight film or the calm pacing; it's a "Mission Viz" button/tab during flight and in the debrief.
21. **Verification before launch:** the review screen must explicitly verify every requirement from the Mission definition against the chosen design (a checklist with ✓/✗ per requirement, the number that proves it, and a "fix" jump to the step). Launch is blocked only by hard failures, but unverified requirements must be visible and explained, and feed the score (item 12).
22. **Cost on every instrument card** (and on every part card): mass, power, data rate, cost, science value; the bug where instruments show no cost must be fixed on all build cards, in all difficulties.
23. **Guide roster:** add a third new original guide inspired by the "Rocky from Project Hail Mary" vibe (a non-human, rock-like engineer-scientist who speaks in a musical cadence and loves fixing things; not copying the book's design or name). Original only; no copyrighted names.
24. **Multiplayer:** fix anything that fails in own-device play; make the Play-with-friends flow explain hosting (item 1); test a full round with 3 clients over the real broker; add an in-game connection check ("Can your friends reach you?") that detects localhost/file and a failed ICE and tells the player what to do.
