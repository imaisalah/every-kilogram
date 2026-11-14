# Mission Sprint v2: calm, guided, one step at a time (binding; overrides TEAM.md where they differ)

The user's team played the build. Their feedback, which this replaces the design with:

- "What's the point of the game?" → the goal must be obvious from the first screen.
- Remove **Last Light**, the **Failure Museum** and **Sandbox** from the title (code may stay, unlinked).
- The "where are we going" screen must be **4 separate steps**: 1 difficulty, 2 pick your character and their job, 3 destination, then the build.
- Later the players must learn **who is with them in the spacecraft through a conversation**.
- **Build the spacecraft first, then the questions** (objective/requirement). The design phase is **way too much**: split it so **each component is its own step**, e.g. the engine step shows **3 engines with simple advantages and disadvantages**, and **the change appears on the spacecraft**.
- They **could not go back** to earlier parts or **stop the game**.
- Each mission needs **a character explaining the steps** (they suggested TARS, Princess Bubblegum, Rocky: these are copyrighted, so we make an **original** guide with that spirit).
- **A tracker showing the % of the mission completed.**
- **Remove the ants (aliens) and the cars (rovers)**.
- **Simplify the interface: calm, it is overstimulating.**

## The point (shown on the title and said by the guide)
"Design a spacecraft, fly it, and bring back the science. Every kilogram counts."

## Flow (every step has Back; Pause is available everywhere)
1. **Title:** Play (solo), Play with friends (own devices / same room / one screen as a secondary choice), Settings, Language. Nothing else.
2. **Difficulty** (own step): Cadet / Engineer / Flight director, one plain line each.
3. **Crew:** a roster of 4 original astronauts, each with a face, a name, a job (Mission planner, Engineer, Scientist, Communications) and one line of personality. Solo: you pick yours, the others join as crewmates. Multiplayer: each player picks one; taken characters are greyed.
4. **Destination:** the six worlds as big calm cards (Moon, Mars, Venus, Europa, plus Earth training flights), one-line science question each.
5. **Briefing by KILO**, the guide (below): 3-4 short lines on what this mission is for and the steps ahead.
6. **Build, one component per step**, in a fixed order with a step bar (for example: Rocket → Orbit → Power → Batteries → Instruments → Antenna & radio → Data recorder → Computer & pointing → Lifetime; Cadet merges and skips the advanced ones). Each step: **at most 3 option cards**, each with a picture, 2-3 plain pros/cons (✓/✗ lines), and its mass/power/cost; selecting one **updates the 3D spacecraft immediately** and the resource bar. The six resources sit in one calm bar, and a step only shows the ones it affects. No design clock (Flight director may keep a soft one). In multiplayer, each step belongs to one job; the owner picks and the others can suggest with one tap.
7. **The questions:** choose the objective and requirement now that you know your ship (KILO comments on how well the ship fits each).
8. **Review & launch:** one summary card; anything that can't work is explained in one line with a "fix it" button that jumps back to that step.
9. **Crew conversation in the cabin** before launch: short lines where each crewmate introduces themselves (name, job, a human detail); 20-30 s, skippable.
10. **Flight:** calm, readable; at most 1-2 crises on Cadet; the live graphs kept simple.
11. **Surface** (landing worlds): calm exploration, no combat (below).
12. **Results:** score, the consequence chain, KILO's one-line verdict, "Fly again with one change".

## KILO, the guide
An original robot: a small floating rectangular unit with a single-screen face showing simple expressions, deadpan humour ("Humour setting 40%." style is fine), never copies a known character's design or name. Appears in a corner with short speech bubbles (one or two lines, never paragraphs), at the briefing, when each build step opens (one line on what the part does), at the questions, before launch, at landing, and at the results. Mission-specific scripts per destination. Can be muted.

## Mission progress tracker
A slim bar always visible at the top with the stages (Crew · Destination · Build · Questions · Launch · Flight · Surface · Home) and a percentage of the whole mission done; inside the surface, the % of the objectives completed.

## Surface v2: calm exploration
Remove aliens, weapons, turrets, drones, medkits, the rover and rogue rovers entirely (from the catalog, the loadout, the sim, the renderer and the HUD). The surface is: land, walk to science sites, scan with the instruments you brought, collect samples, plant the dish and send data in the uplink windows, watch oxygen, battery and daylight, then return to the lander and decide what samples fit in the ascent. Dangers are only real ones: dust storms, rockfalls/moonquakes, cold night, radiation spikes. No downed-and-revive combat; a hazard costs time, oxygen or suit integrity. Third person stays default with first person on V. The world stays beautiful; the HUD becomes minimal.

## Calm interface
Fewer things on screen at once; generous spacing; softer palette (deep navy, off-white, one accent colour, role colours only as small dots); no flashing, pulsing, shaking or glowing borders except for one real alarm; sound and motion subtle; big readable type; never more than one panel of reading. Remove anything decorative that competes for attention.

## As built (guide & crew)
Owner: guide/crew/flight engineer. Files: `js/team/crew.js`, `js/team/guide-lines.js`, `js/team/guide.js`, `js/team/ar-guide.js` (Arabic), the cabin + calm flight in `js/team/view-flight.js` / `js/team/flight3d.js`, the calm results in `js/team/view-debrief.js`, styles in the `tf:` block of `css/team.css`. Load order (already in index.html and join.html): crew.js, guide-lines.js, guide.js before view-setup.js; ar-guide.js after ar-flight.js.

### `SMD.team.guide` (KILO)
- `guide.say(target, lines, opts) -> handle`. `target`: the element KILO sits in (null = document.body; KILO is `position: fixed` in a corner of the viewport either way, one KILO per page: a new `say` replaces the old one). `lines`: a string, an array of strings / `{ text, mood }`, or a moment `{ mission, moment, params }`. `opts`: `{ mood, corner: 'end'|'start' (bottom inline-end is the default), keep: true (after the last line KILO folds into a small face button that replays the script; false = KILO disappears), onDone(), onLine(i) }`. Click the bubble or press Space (when focus is not in a text field or button) to finish the typing, then to go to the next line. Handle: `{ next(), close(), done: Promise, el }`.
- `guide.sayMoment(target, missionId, momentId, opts)` = `say(target, scriptFor(missionId, momentId, opts.params), opts)`.
- `guide.scriptFor(missionId, momentId, params) -> [{ id, text, mood }]`, already translated (SMD.t, keys `guide.<mission>.<moment>.<n>` falling back to `guide.any.<moment>.<n>`). Never empty for a known moment; `[]` for an unknown one.
- Mission ids: `nile`, `storms`, `moon`, `mars`, `venus`, `europa` (anything else uses the common lines).
- Moment ids: `briefing` (3-4 lines), `step.<key>` one line per build step, keys `launcher`, `orbit`, `route`, `panels` (alias `power`), `batteries`, `instruments`, `antenna`, `radio` (`comms` = antenna), `recorder` (alias `data`), `computer`, `adcs` (alias `pointing`), `lifetime`, `structure`, `propMargin` (alias `fuel`), `duty`, `processing`, `coding`, `ground`, `schedule`; `questions` (intro), `objective`, `requirement`, `fit.good` / `fit.ok` / `fit.poor` (params `{ name }`: how well the ship fits the picked objective or requirement), `review`, `review.problem` (params `{ problem }`), `launch`, `cabin`, `flight.start`, `flight.crisis`, `landing`, `surface`, `results.full` / `results.partial` / `results.none` / `results.lost` / `results.crew`.
- `guide.verdict(missionId, debrief) -> { text, mood }`: KILO's one-line results verdict.
- `guide.muted()`, `guide.setMuted(bool)` (saved in localStorage `ek-kilo-muted`; muted KILO is a small dim face button that unmutes on click). `guide.clear()` removes KILO.
- `guide.portrait(mood, { size, talking }) -> SVG string` (2D KILO for any UI), `guide.MOODS` (`neutral`, `deadpan`, `happy`, `proud`, `thinking`, `worried`, `sad`, `surprised`, `wink`), `guide.drawFace(ctx2d, mood, w, h, talking)` (the screen face on a canvas: used by the 3D model).
- 3D: `import { makeKilo } from 'js/team/flight3d.js'` -> `{ group, setMood(m), setTalking(bool), update(dt) }`, about 0.36 m wide, floats and glows softly.

### `SMD.team.crew`
- `crew.roster`: 4 original astronauts, one per job (`planner`, `engineer`, `scientist`, `comms`): `{ id, name, job, color, personality, bio, detail, intro, appearance }`. `appearance` goes straight into `createAstronaut(appearance)` (js/3d/astronaut.js).
- `crew.byId(id)`, `crew.byJob(job)`, `crew.jobName(job)`, `crew.text(member, field)` (translated), `crew.portrait(idOrMember, { size, you }) -> SVG string` (2D head-and-shoulders portrait).
- `crew.lineup(chosen)`: `chosen` = `{ <job>: playerName }` or the id the solo player picked; returns the 4 in order with `{ member, player, you }`.
- `crew.cabinScript(lineup)`: the cabin conversation lines `[{ who: 'kilo'|memberId, text, mood }]`.

### The cabin conversation (before launch)
`SMD.team.views.cabin` is the view for the room's `cabin` phase (lock -> cabin -> flight; on when `timing.cabinMs > 0`, `next` skips it). It shows the 3D cabin (js/3d/capsule.js, the four crew from `crew.appearance`, the 3D KILO by the panel), one speaker at a time with a calm subtitle card (portrait, name, job and home town, the line), the crew strip on top (who is you, who is played by whom), Skip (sends `{ type: 'next' }`), click / Space / Enter to go faster, Esc to skip. About 25 s. Without WebGL it shows the 2D portraits. The lineup comes from `ctx.view.players[]` (`roles`, `crewId`/`crew`/`character`, `me.id` = you; bots are not named as players) via `SMD.team.cabin.lineup(ctx)`. `SMD.team.cabin.play(el, { lineup, onDone(skipped) })` plays it anywhere else.

### Layout notes for the other views
- KILO is `position: fixed` at the bottom inline-end corner (bottom-left in Arabic), z-index 30 (under the shared tracker/pause chrome at 40). Set `--kilo-lift` on any ancestor (or :root) to raise it above a bottom bar, or pass `corner: 'start' | 'top-end' | 'top-start'`, or `inline: true` to put it in the flow of `target`.
- While KILO talks (not in `auto` mode) Space advances it, captured before other handlers unless focus is in a text field; pass `space: false` where Space is a game control (the surface). `auto: true` lines read themselves out and need no input (the flight uses this).
- The flight, cabin and debrief call `kit.pauseMenu(root, { stage, ctx })` (or `kit.tracker` when there is no pause menu) and clean it up on unmount; with the shared chrome on screen that is just a handle. They leave 52 px on top for the chrome bar.
- Calm flight: three graphs (battery, recorder, science home) plus a "Sending data home / Waiting for contact" chip; KILO says the eclipse, contact, low battery, full recorder and landing lines once each; one alarm sound per crisis, no pulsing, no camera shake beyond a nudge; the crisis card closes KILO so there is only one panel of reading.
- Calm results: dominoes (no shake), the score, the tombstone if it died (no Failure Museum link), then the board with KILO's one-line verdict, the one best change and "Fly again with this change"; extras are Mission report, Challenge friends, Save this design. The secret-goals act is left out.

## As built (flow)
Owner: flow engineer. Files: `js/screen-team.js` (title, team screen), `js/team/view-setup.js` (setup views, tracker, pause menu, kit), `js/team/phone.js` (player screen), `js/team/room.js` (phases, Back/Pause), `js/team/data.js` + `js/team/sim.js` (build steps), `css/team.css` (tokens + `ts:` block), `css/team-phone.css`, Arabic in `js/i18n/ar-team.js` and `js/team/ar-sim.js`.

### Phases (room.js)
`lobby → brief → design → questions → lock → cabin → flight → landing → surface → ascent → debrief`
- `lobby` has `view.setupStep`: `room` (own devices / phones only: link, QR, who is in) → `difficulty` → `crew` → `destination`. `view.setupSteps` lists them.
- `brief` is KILO's briefing (no clock). `design` is the build: `view.buildStep` indexes `sim.buildSteps(scenarioId, difficulty)`. `questions` picks the requirement (`pick{requirement}` also sets `design.requirement`). `lock` is the review. `cabin` only happens when `timing.cabinMs > 0` (the game's sessions pass 28 s; tests fly straight on); `next` skips it.
- No design clock. Flight director gets a soft one: `view.clock = { leftS, totalS, overtime, soft: true }` during design/questions/lock; it never moves the phase.
- New actions (all allowed from players): `forward`, `back`, `stepTo{index}` (jump to a build step, used by "Change" and "Fix it"), `build{step, option}` (only the step's job, or anyone on one screen), `suggest{step, option}`, `pause`, `resume`. Host only: `restart` (same crew and world, back to the briefing). `setRole{role, crew}` also records the character (`view.crewPick`, `view.players[].crewId`; a character can't be taken twice).
- Who moves the crew on: in the lobby and briefing the host; in the build the owner of that step or the host; in questions/review anyone. On one screen / solo, the one seat does everything.
- `view` adds: `setupStep, setupSteps, buildStep, suggestions{stepId:{option,by,name,at}}, crewPick, paused{by,name,at}|null, canBack, isHost`.
- Pause freezes the whole room: `tick()` returns the state unchanged, `viewFor()` reports the moment it stopped (clocks and `flight.progress` stand still), `resume` slides every deadline forward. Bots no longer send requests during the build (`timing.botRequests`, off by default).

### Build steps (data.js `BUILD_STEPS`, sim.js)
Order: Orbit → Power → Batteries → Instruments → Antenna & radio → Data recorder → Computer & pointing → Mission length → Landing kit → Rocket (last, once the mass is known). Cadet: Orbit, Power, Instruments, Antenna & radio, Landing kit, Rocket. Engineer adds Batteries, Data recorder, Mission length. Flight director adds Computer & pointing. Landing kit only on worlds you land on. Owners: planner (orbit, length, rocket), engineer (power, batteries, computer), scientist (instruments, landing kit), comms (antenna & radio, recorder).
- `sim.buildSteps(sc, diff)` → `[{ id, title, ask, role, keys, res, multi, max?, options:[{ id, name, note, picks:{key:id} }] }]`, at most 3 options. Single-part steps show the starter and its neighbours by size; packs ("Small dish, small radio"…) set several parts at once.
- `sim.stepCards(design, stepId)` → `[{ id, name, note, on, pros:[text], cons:[text], nums:{massKg,powerW,powerOutW,costM,fuelKg,liftKg,years,dataGb}, flies, resources }]`: plain ✓/✗ lines worked out from the real numbers (≤3 per card), translated.
- `sim.stepChoice(design, step)`, `sim.applyStep(design, stepId, optionId)` (instruments toggle), `sim.setRequirement(design, id)`, `sim.requirementFit(design)` → `[{ id, title, text, fit 0..1 }]`.
- Combat gear is gone from the catalog and the design: weapons, turrets, drones, medkits, rover. `surfaceLoadout()` keeps the old fields, empty (`turrets 0, rover false, drones 0, medkits 0`, `weapons` = `['drill']` when a drill is packed, because the drill pulls ice cores). Oxygen, ascent fuel and the drill stay.

### The tracker: `SMD.team.kit.tracker(el, view)` or `(el, { stage, ctx })`
The team screen mounts one shared bar (`kit.chrome(root, ctx)`) for every phase: the stages Crew · Destination · Build · Questions · Launch · Flight · Surface · Home (Surface hidden on training flights) with the % of the whole mission, a Pause button, and Esc. So a phase view does not need to draw its own:
- `kit.tracker(...)` returns a handle to the shared bar: `{ update(view, { sub }), setSub(fraction 0..1), destroy(), cleanup() }`. The surface view passes objective progress with `setSub(0.4)` (or `kit.setProgress(0.4)`); `null` goes back to the default. Flight progress is read from `view.flight.progress` automatically. With no shared bar on screen (a page of your own), it mounts a standalone bar in `el`.
- `kit.progressOf(view, sub)` → `{ stages, stage, sub, pct }` (pure, tested).
- The bar is 52 px, fixed at the top (z-index 40). Phase views keep their own headers below it (`.ts-stage[data-phase=cabin] .ts-phase` is pushed down 52 px).

### Pause: `SMD.team.kit.pauseMenu(el, { ctx })`
Already wired on every phase by the shared bar: the Pause button and Esc (skipped while the pointer is locked, so the first Esc frees the mouse, and when the event was `preventDefault()`ed by a view). The menu: Resume, Back one step (only in lobby/brief/design/questions/lock, for whoever may steer), Restart mission (host only, tap twice), Quit to title. Opening it sends `pause` (everyone sees "Bea paused the game."), closing sends `resume`.
- `kit.pauseMenu(...)` returns `{ open(), close(), destroy(), cleanup() }`; `kit.openPause()` opens it from code.
- While `ctx.view.paused` is set, a phase that runs its own loop (flight playback, surface sim) should stop stepping and resume when it clears. The room already freezes its own clocks.

### Screens
Title: Play (solo), Play with friends (own devices first, then same room / one screen), Settings, Language, the point in one sentence. Last Light, Failure Museum and Sandbox are no longer linked (code kept). Every setup screen is one calm page with Back and Next at the bottom; KILO speaks inline (briefing: its lines; each build step: one line; questions: the fit; review: the first problem). Phones in the room and players on their own device run the same views (phone.js mounts them), sized by CSS.
