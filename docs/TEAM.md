# Mission Sprint: the team game (binding spec)

The official challenge's direct objective is an interactive game where participants design, manage and simulate a complete mission, make engineering decisions, manage limited resources, and evaluate how choices shape mission success. Its **Potential Considerations** section presents detailed features (objectives and requirements, components, resource dashboards, solo/team modes up to four, repeat simulations and post-mission analysis) as optional ideas, not mandatory specifications. This game chooses to implement many of them. *Last Light* (docs/LASTLIGHT.md) is a side mode from the title.

The user's two demands: **it must never be boring, and it must be creative.** Earlier versions failed by having too many systems, too much reading, and no clear next action.

## Golden rules
1. **A round is 5-8 minutes.** Design under a clock, fly for about a minute, see why, go again. Nothing long.
2. **Always one obvious next thing.** Big type, icons, numbers. Sentences only where they teach, one line, plain words a 13-year-old knows. Every concept (orbit altitude, data rate, payload capacity) is introduced by playing with it, never by a text wall.
3. **Every choice visibly costs something.** Change one part and every affected number moves, on every screen, at once.
4. **Talking is the game.** Players each hold part of the picture, so they must shout at each other.
5. **Failure is funny and fascinating**, never a dead end. A failed mission is the best content in the game.
6. **Honest numbers.** Masses, powers, launchers, orbits and real-failure stories come from real NASA data with sources; simplified where needed, and the game says so.

## The round
`lobby → brief → design → lock → flight → debrief → (refly | next)`

- **Lobby:** host screen shows a big room code and QR; phones join with a name, pick or get a role. Modes: **Team on phones** (2-4), **One screen** (everyone at one device, four panels), **Solo** (same four panels; bot crewmates send requests). With fewer than 4 players, roles are shared out.
- **Brief (20 s):** a scenario card with a real science question. The team picks an objective and one requirement level (e.g. sharper images vs wider coverage), which sets what success means.
- **Design (180 s; Cadet 240 s):** the clock runs. Shared dashboard always visible: **Mass, Power, Budget, Data, Comms, Time**. Roles own different decisions and see different detail:
  - **Mission planner:** orbit, launch vehicle, lifetime, schedule. Sees launcher capacity and orbit coverage.
  - **Spacecraft engineer:** structure, solar panels, batteries, attitude control, onboard computer, propellant margin. Sees power budget in sun and eclipse.
  - **Scientist:** instruments and how often they run. Sees science value and data generated.
  - **Communications:** antenna, radio power, ground stations, recorder. Sees data generated vs data that can get home.
  - **Requests:** one tap sends a preset ask to another role ("Need 50 W", "Cut 30 kg", "Less data!"), pinging their phone.
  - **Secret agendas:** every role privately gets a bonus goal that conflicts with another role's (Scientist: carry 3+ instruments; Engineer: keep 20% power margin; Comms: two ground stations; Planner: finish under 80% of budget). Revealed at the debrief.
- **Lock:** all roles vote Launch. A hard check blocks a launch the rocket can't physically lift to that orbit and says why. Anything else may fly and fail.
- **Flight (60-90 s):** the mission plays at high speed: the real orbit in 3D, the spacecraft built from the chosen parts, live graphs of battery, data buffer and downlink, science climbing. You *see* consequences: the battery drains in eclipse, the buffer overflows and data spills. **Crises** hit: the alarm appears on one phone but **the fix is on someone else's phone**, so they have to yell (Spaceteam style), 6-10 seconds each. Opportunities too ("Volcano erupting! Retask?").
- **Debrief:**
  - **Consequence chain:** dominoes falling, one line each: *Camera +12 kg → fuel +84 kg → heavier rocket −$40M → no second antenna → 30% of the data never came home.* Generated from the real simulation by re-flying with decisions reverted.
  - **Score** out of 1000: Science, Efficiency, Survival, Teamwork (requests answered, crises fixed, agendas). Medals, agendas revealed.
  - **Mission report**, one page, printable.
  - **Obituary** if it died: a funny, shareable tombstone card naming the cause and the **real NASA mission that died the same way**.
  - **Fly again with one change:** the game suggests the single change that would have helped most; or change anything and fly the same seed with your last run as a **ghost** on the graphs.

## Signature creative features
1. Consequence chain dominoes. 2. The fix is on someone else's phone. 3. Secret agendas. 4. Mission obituaries + **Failure Museum** (a collection of every way you've wrecked a mission beside the real one: Mars Climate Orbiter, Mars Observer, Genesis, Galileo's antenna, Hubble's mirror, CONTOUR, Beagle 2...). 5. Ghost refly. 6. **Challenge links**: encode a design and score in a URL; another team designs for the same objective and sees whether they beat you (competitive mode without a server).

Also required: at least 6 scenarios (reuse MISSIONS: Nile, storms, Moon ice, Mars ice, Venus, Europa), difficulty levels (**Cadet**: few simple parts; **Engineer**; **Flight director**: tighter budget, hidden flaws), **Sandbox** (no budget/clock), local leaderboard per scenario, save/compare designs, optional 60-second tutorial played on a real round, English + Arabic (RTL), phone-friendly, reduced motion, no WebGL fallback on the flight view.

## Visual direction
Night-shift mission control with arcade energy: deep ink background, loud signal colours per role, huge numerals, chunky buttons, satisfying motion and sound on every change (SMD.audio synth). Readable from across a room on the host screen. Not the old vellum look. Real NASA imagery and 3D where it adds wow (Earth, planets, real spacecraft models).

## The surface: where the game becomes a real game (binding, added by the user)

The user's vision: "My team and I build the rocket, fly the mission, land on the planet, find things to do there, and hit trouble: aliens or strange things we escape from or kill with weapons. Do what the challenge asks, but make it truly fun." Think **Helldivers / Lethal Company / Deep Rock Galactic on a shared screen**, with the design phase as the most consequential loadout screen ever made.

New round: `lobby → brief → design → lock → flight → landing → surface → ascent → debrief → (refly | next)`, about 10 minutes. Moon, Mars, Venus and Europa land; Venus plays on a floating cloud-top platform (the real NASA HAVOC concept). Earth-orbit scenarios (Nile, storms) are short **training flights** with no surface. The crew's lander and suits are provided by the sponsor (a stated simplification); the team designs everything it brings.

**One camera, no camera controls.** The host screen shows one 3D top-down/isometric view framing all four astronauts (Alien Swarm / Overcooked feel). Each phone becomes a **controller**: virtual stick to move, aim stick or auto-aim, fire, use, role ability. The host runs everything and renders alone, so only inputs travel up (≤20 Hz per phone) and small status goes down (≤5 Hz: health, ammo, objective, prompts). One screen: P1 WASD + mouse or keys, P2 arrows, P3/P4 gamepads. Solo: three bot crewmates who follow, shoot, revive and carry.

**Every design decision shows up on the surface. That is the point:**
- **Mass:** every kilo carried costs propellant and launcher money. Weapons, rover, drill, turrets, drones, spare oxygen, medkits are parts with mass, power and cost, competing directly with science instruments. *Do you bring the heavy gun or the second spectrometer?*
- **Power:** solar panels and batteries run the lander: shield, floodlights, charging. When night falls (real day length/eclipse by planet and orbit) a weak power design means the base goes dark and the aliens come.
- **Instruments are the tools** you carry: only the instruments you brought can scan the science sites they fit. Scanning generates data.
- **Data and recorder:** the recorder has a real capacity. Full recorder = you must upload or drop data.
- **Comms and orbit:** data only counts once it is sent home. Your antenna, radio and orbiter choice set when the **uplink windows** open and how fast they run. Those windows are the set-piece: plant the dish, hold the position against waves while the bar fills.
- **Time:** mission lifetime is your clock (oxygen, sunlight, storm or lifetime limit). Then you must reach the lander.
- **Ascent:** the fuel you brought decides how much mass can lift off. **Samples are heavy. At the end you may have to throw science overboard to get home.** That is the game's title, played for real.
- **Budget** bought all of it.
- **Orbit** decides the landing zone and accuracy (polar orbit reaches the ice, a poor choice lands you far from the sites) and how often the orbiter passes.

**Objectives per scenario** map to the real science question: find water ice at the lunar pole, drill Martian ice, sample Venus's cloud chemistry, reach Europa's plume deposits. Procedural map per seed: landing site, science sites, nests, caves, ice, hazards.

**Trouble:** aliens with distinct behaviours (swarmers drawn by light and noise, spitters, ambush burrowers, one huge thing you can only run from), themed per world (Martian dust stalkers, Europa ice worms, Venus cloud floaters, Moon things that live in permanent shadow). Environmental hazards are real ones: dust storms, solar radiation spikes, cold nights, moonquakes. Weapons are repurposed gear (plasma cutter, sampling laser, drill, flare gun, turret). Teen-appropriate: creatures burst into glowing goo, downed astronauts are revived by teammates, no gore. A **Hazards setting: Anomalies / Realistic only** (Realistic swaps aliens for storms, rockfalls and rogue rovers) keeps the classroom version honest.

**Roles on the surface:** Planner: map pings, calls waypoints and the extraction, sees timers. Engineer: repairs, builds turrets, restores power. Scientist: only one who can run the scanner fast, reads what sites hold. Comms: plants and aligns the dish, runs drones. Everyone fights. Team revive, shared ammo and oxygen pickups, and shouting.

**Debrief** chains now run through the surface: *"Second radio cut to save 8 kg → uplink 40% slower → dish overrun in the second wave → 2 of 3 data sets lost."* Obituaries for crews and missions alike ("Eaten at the second uplink. Should have packed the bigger battery.").

Code: `js/team/surface-sim.js` (classic, pure, fixed-tick, node-testable, `SMD.team.surface`: `create(design, seed, players, opts)`, `step(state, inputs, dt)`, `summary(state)`), `js/team/view-surface.js`, `js/team/surface3d.js` (ES module). `SMD.team.sim` adds `surfaceLoadout(design)` and surface parts in `catalog`, and `chain` takes the surface summary.

## Every player on their own device (binding, user's decision: WebRTC)

Besides the shared-screen mode, a team can play **each on their own device, in real time, from anywhere**, with no game server. One player's browser is the authoritative host; the others are clients.

- **Transport:** WebRTC data channels through a vendored `peerjs` (MIT, exact version pinned in `vendor/`, listed in docs/CREDITS.md). Signaling via the free public PeerJS broker, room code → peer id; Google's public STUN. So the site can be hosted statically (GitHub Pages) and needs no account or server.
- **Channels:** one reliable ordered channel for room actions and views; one unreliable unordered channel for inputs (client → host, up to 20 Hz) and surface snapshots (host → client, 10-15 Hz, compact, quantised, delta where useful, under about 3 KB per snapshot).
- **Same interface:** `webrtc` is another transport beside `local` and the LAN WebSocket relay in `SMD.team.net`; game code doesn't know which one is in use. Mode picks: *Everyone on their own device* (webrtc), *Same room with phones* (host screen + controllers over webrtc or LAN relay), *One screen*, *Solo*.
- **Connection failure is expected:** roughly 15-25% of connections cannot go direct (mobile carrier NAT) without TURN, and we have no TURN yet. Detect it (ICE failed or timeout) and say so plainly, per player, with what to try: join the same Wi-Fi, or a different network, or use Same room / One screen. Never hang silently. Leave a clean `iceServers` config hook for TURN credentials, which must be short-lived and minted server-side, never a key embedded in the client. If the public broker is down, say that and offer the LAN and One screen modes.
- **Client rendering:** a client runs `view-surface` from snapshots with interpolation (about 100 ms buffer) and a camera over its own astronaut, with **client-side prediction of its own movement** via the sim's pure movement function, corrected smoothly. Fire feedback (muzzle flash, sound) is immediate; hits are the host's call. Design, brief, lock and debrief use the same per-role views as phones, sized for a laptop.
- **Host leaving:** the round pauses for everyone with a clear message and resumes if the host returns within 2 minutes (the host state is checkpointed in its local storage); no host migration.
- Phones that can't handle the 3D fall back to controller mode with a note.

## Third person and first person on the surface (binding, user's request)

"I want to control the player in third person, with the camera moving with me, and be able to play TPP or FPP." So on the surface, **when a player has their own screen (Solo and Everyone on their own device), the default is a real third-person shooter view, with first person one key away.** The shared-screen modes (Same room with phones, One screen) keep the group camera, because one screen can't follow four people.

- **Views:** TPP over the shoulder (default), FPP. `V` / gamepad Y toggles with a quick smooth transition; remembered in settings. A settings option offers the top-down group view too.
- **Camera moves with you:** mouse look with pointer lock (click to capture, Esc to free, never trapping the UI). The character faces where the camera aims while moving (modern shooter style: Fortnite, The Last of Us). On gamepad and touch, the camera also swings gently behind the direction of travel, per docs/CONTROLS.md. Smooth follow, no jitter, camera collision against rocks and the lander, sprint widens the lens a little, right mouse / LT aims with a tighter view.
- **Controls:** WASD camera-relative, Shift sprint, LMB fire, RMB aim, E use, Q ability, R or wheel swap weapon, V view, H help. Gamepad: sticks move and look, RT fire, LT aim, A use, X ability, RB swap, Y view, L3 sprint. Touch with 3D on own device: left stick, drag right side to look, fire and use buttons.
- **The sim stays 2D** (x, z): the input aim is the camera's yaw, sent as the existing aim vector; a light aim assist inside a small cone near the crosshair replaces the stronger twin-stick assist in these views. Sprint needs a small sim addition (costs oxygen). Other players' aim yaw goes in snapshots.
- **Eye level must look great.** The top-down world was only built to be seen from above. It needs: terrain with real relief (a visual height function shared by feet, aliens and camera, no effect on the 2D sim), proper horizon and sky per world (Earth, Jupiter, sun, atmosphere haze), distant crater rims/mountains/ice ridges, map edges disguised as cliffs, ground detail that holds up at 2 metres, boulders at believable scale, close-up quality for the lander, dish, turrets and rover, aliens that look scary and well animated up close (arriving out of the dark, leaping, rearing), and the rigged astronauts running and aiming.
- **FPP:** gloved hands holding the current weapon with recoil and reload-ish motion, helmet rim and visor reflections, own body hidden, breathing that speeds up as oxygen falls, cracks on the visor at low health.
- **Never lost at eye level:** on-screen objective diamond with distance, a small radar (aliens as red blips, teammates, lander, dish, sites), teammate name tags and downed markers through walls, the crosshair and hit markers.
- Reduced motion: no bob or sway. Keep 60 fps on a mid laptop; distance fog and LOD do the work.

## Code layout and contracts (binding)

All under `js/team/`, `SMD.team` namespace. Classic scripts unless noted; pure logic must load in node for tests. Arabic: `js/i18n/ar-team.js`; every string via `SMD.t('team.…', english)`.

### Model (`js/team/data.js`, `js/team/sim.js`): `SMD.team.sim`
Reuse `SMD.physics` and the real numbers in `js/data.js` / `js/model.js` (rocket equation, link rate ∝ P·D²/d², solar flux, launchers, instruments) wherever they fit.
- `scenarios()`, `difficulties()`, `catalog(scenarioId, difficulty)` → `{ roles: { planner|engineer|scientist|comms: [{ key, title, options:[{ id, name, mass, powerW, costM, dataGbitDay, science, note, source, ... }] }] } }`.
- `newDesign(scenarioId, difficulty, requirementId)`, `set(design, role, key, value)` → new design or `{error}` when that role may not change that key; `rolesOf(key)`.
- `resources(design)` → `{ mass, power, budget, data, comms, time }`, each `{ value, limit, unit, status:'ok'|'warn'|'bad', why }` plus detail fields; `checks(design)` → `[{ id, hard, ok, text }]` (launcher/orbit compatibility is hard); `preview(design, role, key, value)` → per-resource deltas.
- `fly(design, seed, crisisOutcomes?)` → deterministic `{ frames:[{ t, sunlit, battery, powerIn, powerOut, buffer, downlink, science, fuel, alive, phase }], events:[{ t, kind, role, fixRole, ... }], result:{ alive, cause, science, dataLost, ... } }`.
- `score(design, flight, teamStats)`, `chain(design, seed)` → `[{ text, why, delta, kind }]` ordered as cause → effect, `bestChange(design, seed)`, `obituary(design, flight)` → `{ title, cause, epitaph, analog:{ mission, year, story, source } } | null`, `agendas(seed, roles)`, `crisesFor(...)`, `encode(obj)` / `decode(str)` (URL-safe), `toCraftDesign(design)` (a design `js/3d/craft.js` buildCraft can draw).

### Room (`js/team/room.js`, pure): `SMD.team.room`
Authoritative state machine on the host: `create(opts)`, `reduce(state, action, now)`, `viewFor(state, playerId)` (hides other players' agendas and crisis fixes), `tick(state, now)`. Actions: `join, leave, reconnect, setRole, pick, set, request, answer, vote, crisisAct, next, refly, …`.

### Network (`js/team/net.js`, `tools/serve.mjs`)
- WebSocket relay built into `tools/serve.mjs` on the same port, **no npm dependencies** (hand-written RFC 6455), `/ws?room=CODE&...`. The host browser is authoritative; the server only relays between host and phones in a room. Limits on room count, message size and rate; rooms expire. `GET /api/info` returns LAN addresses so the host can show a joinable URL.
- `SMD.team.net`: `createHost()`, `join(code, name, token)`; plus a **local transport** with the same interface for One screen / Solo, so all game code is transport-agnostic. Reconnect by token after a phone sleeps. If the relay is absent, the title explains and offers One screen.
- `play-team.bat`: serves on `0.0.0.0` so phones on the same Wi-Fi can join. `play.bat` stays localhost-only. Server must keep serving static files exactly as now and never expose paths outside the project.

### Screens
`js/screen-team.js` registers the new title (`SMD.ui.screens.start`; it loads after `js/screen-ll.js` and first keeps the Last Light title as `SMD.ui.screens.ll_title`) and `SMD.ui.screens.team`, which mounts views by room phase: `SMD.team.views[phase] = { mount(el, ctx) → cleanup }`, `ctx = { state, view, send, sim, device:'host'|'one' }`.
- Lobby, brief, design, lock views: `js/team/view-setup.js`. Flight and debrief views: `js/team/view-flight.js`, `js/team/view-debrief.js`, 3D in `js/team/flight3d.js` (ES module).
- Phone client: `join.html` + `js/team/phone.js` + `css/team-phone.css`. No three.js, loads fast on a cheap phone.
- `css/team.css`, Museum and leaderboard in `js/team/view-debrief.js` or its own view.

## As built: `SMD.team.sim` (model engineer; kept accurate)
Files: `js/team/data.js` (`SMD.team.data`: content), `js/team/sim.js` (`SMD.team.sim`: logic), `js/team/ar-sim.js` (Arabic, needs a `<script>` after `js/i18n/ar-team.js`). All load in node. Balance: `docs/TEAM-BALANCE.md`.

- **Design** (plain JSON, safe in room state): `{ v:1, scenario, difficulty, requirement, picks:{...} }`. Keys by role: planner `orbit launcher route lifetime schedule ascent rover`; engineer `structure panels batteries adcs computer propMargin turrets oxygen`; scientist `instruments duty processing weapons drill`; comms `antenna radio ground coding recorder drones medkits`. Surface keys (`ascent rover turrets oxygen weapons drill drones medkits`) exist only on landing scenarios.
- `roles()`; `scenarios()` → `[{ id, title, question, kind, dest, objective, training, landing, platform, requirements:[{ id, title, text }], objectives:[{ id, title }] }]`. Six scenarios: `nile storms moon mars venus europa`; `nile` and `storms` are `training:true` with no surface; Venus has `platform:'floating'`.
- `difficulties()` → `[{ id:'cadet'|'engineer'|'director'|'sandbox', title, note, tier, designSec, budgetMult, crises, flaws, instrumentMax }]`; `designSec` and `budgetMult` are null in sandbox.
- `catalog(sc, diff)` → `{ scenario, difficulty, roles:{ planner:[{ key, title, multi?, max?, min?, surface?, options:[{ id, name, note, source, tier, mass, powerW, costM, dataGbitDay, science, scienceFor:{reqId}, scanFits?, ... }] }], ... } }`. Extras by key: launcher `capacityByOrbit:{orbitId:kg}`, ground `costPerYear`, orbit `periodMin eclipsePct revisitDays`. A key with one option left after the difficulty filter is omitted and stays fixed.
- `newDesign(sc, diff, req)` always launches. `set(design, role, key, value)` → new design or `{ error }`; `instruments` and `weapons` take a full id array, or one id to toggle. `rolesOf(key)` → `['planner']` etc.
- `resources(d)` → `{ mass, power, budget, data, comms, time }`, each `{ value, limit, unit, status, why, ...detail }`:
  - mass: wet kg vs launcher capacity to this orbit (`dry prop payload marginKg`)
  - power: orbit-average in vs load W (`marginPct sunlitW eclipseMin eclipsePct batteryWh batteryNeedWh loadW`)
  - budget: $M (`devM launchM opsM lateM`)
  - data: peak buffer between passes vs recorder Gbit (`generatedGbitDay gapDays recorderGbit`)
  - comms: downlink vs generated Gbit/day (`rateMbps passesPerDay hoursInView rangeAU stations`)
  - time: dev months vs deadline (`lifeYears maxLifeYears lifeLimitedBy`). Sandbox `limit` is null for budget and time.
- `checks(d)` → `[{ id, hard, ok, text }]`; ids `launcher` (the only hard one) `budget power battery comms recorder instruments time life`. `preview(d, role, key, value)` → `{ mass:{from,to,delta,status,statusFrom,limit}, power, budget, data, comms, time }` or `{ error }`.
- `crisesFor(design, seed)` → `[{ id, type, t, kind:'crisis'|'opportunity', role, fixRole, windowSec, title, alarm, fix, actions:[{ id, label, correct }], bonus? }]`, `t` in playback seconds; `role` always differs from `fixRole`. Slots depend only on seed and scenario, not the design.
- `fly(design, seed, outcomes?)` → `{ frames, events, result, crises }`, exactly 420 frames (6 fps, 70 s). `outcomes` = `{ [crisisId]: 'fixed'|'missed' }`, opportunities `'taken'|'skipped'`; a missing entry counts as missed/skipped. A crisis only changes frames after its `t`, so you can re-fly with the outcomes so far and keep playing.
  - Frame: `{ t, phase:'launch'|'cruise'|'insertion'|'ops'|'end', sunlit, inPass, battery(0-1), powerIn, powerOut, buffer(0-1), bufferGbit, downlink(Mbit/s), science(%), fuel(0-1), alive, orbit }`.
  - Event: `{ t, kind:'phase'|'crisis'|'opportunity'|'eclipse_low'|'brownout'|'overflow'|'blackout'|'flaw'|'dead', role?, fixRole?, id?, type?, outcome?, fixed?, text }`.
  - `result`: `{ alive, cause, success:'full'|'partial'|'fail', science, generatedGbit, returnedGbit, lostGbit, dataLost, lostFrac, overflowGbit, unsentGbit, primaryLoss:'overflow'|'comms'|null, lifeFraction, lifeDays, crisesFixed, crisesTotal, opportunitiesTaken, brownouts, minBattery, doseKrad, hardnessKrad, flaws, costM, wetKg, perObjective }`. `cause`: `power drag radiation computer attitude nav breakup budget`, or null.
- `score(design, flight, teamStats?, surfaceSummary?)` → `{ total, science, efficiency, survival, teamwork, medal:'gold'|'silver'|'bronze'|'none', medalTitle, details }`, axes max 400/200/200/200. `teamStats`: `{ requestsSent, requestsAnswered, crisesFixed?, crisesTotal?, agendas? }`. With a surface summary, science is 55% orbit and 45% surface, and survival is 80 for the spacecraft plus 120 for the crew.
- `chain(design, seed, surfaceSummary?, outcomes?)` → ordered `[{ text, why, delta, kind, key?, role?, value? }]`; `kind`: `decision fuel launcher budget power radiation data comms crisis failure surface science revert`. It re-flies each alternative; the first step is the reverted decision and the last is what that change achieved.
- `bestChange(design, seed, outcomes?)` → `{ role, key, from, to, fromName, toName, gain, text, why, design } | null`.
- `obituary(design, flight, surfaceSummary?)` → `{ title, cause, causeId, crew, epitaph, analog:{ mission, year, story, source } } | null`.
- `agendas(seed, roles?, difficulty?)` → `[{ role, id, title, text, conflictsWith, pct? }]` (serializable; pass difficulty so the under-budget percent is right). `agendaMet(agenda, design, flight)` → bool.
- `encode(obj)` / `decode(str)` (null if invalid). `toCraftDesign(design)` → buildCraft fields plus `info:{ dryKg, propKg }`.
- `surfaceLoadout(design)` → null on Earth flights, else the shape in `docs/TEAM-SURFACE.md`: `{ world, objective, platform, weapons:[ids incl. 'drill'], turrets, rover:bool, roverKind, drones, spareO2, medkits, drill:{id,depthM,speed,damage}|null, power:{solarW(1 AU),batteryWh,rtgW}, instruments:[{id,name,fits,rate,value}], recorderGbit, uplink:{rateGbitS,everyS,windowS,firstS,label,realMbps}, landing:{offsetM,inRange,zone,accuracyM}, lifetimeS, ascent:{liftKg,extraFuelKg,dvKms,massRatio}, parts:{radio,antenna,battery,solar,recorder,orbit,ascent}, given, platformNote }`.
- Strings: `SMD.t('team.…', english)`; `SMD.team.data.strings()` lists every key with its English.
