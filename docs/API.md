# Every Kilogram — developer API (read with docs/GDD.md)

Plain JavaScript, no build step. Classic scripts attach to `globalThis.SMD`. The 3D layer is ES modules in `js/3d/`; `three` maps to `vendor/three.module.js` through the import map in `index.html`. Classic scripts can load 3D modules with dynamic `import(new URL('js/3d/x.js', document.baseURI).href)` (a bare relative path resolves against the script's own URL), so you never need to edit `js/3d/index.js`.

## Running, checking and seeing your work

- **Serve:** `node tools/serve.mjs <port>`. Use your own port (8781–8799) so you don't clash with other agents. Start it in the background.
- **Screenshot:** `node tools/shot.mjs http://127.0.0.1:<port>/ out.png [waitMs] [script.js] [w] [h]`.
  - `script.js` is the body of an async function run in the page after load, e.g. `SMD.quickStartCareer(); SMD.go('hq'); await new Promise(r=>setTimeout(r,1500));`.
  - The tool prints console errors.
  - Then **Read the PNG to look at it**. Do this for every screen you build, at 1440×900 and at 390×844 (phone).
  - WebGL works headless (SwiftShader), just slower.
- **Syntax:**
  - Classic scripts: `node --check file.js`.
  - ES modules: copy to a temp `.mjs` file first (`cp js/3d/x.js /tmp/x.mjs && node --check /tmp/x.mjs`). Plain `node --check` silently passes broken ESM `.js` files.
- **Logic tests:** `node --test "tests/*.test.js"` (Node 24). The tests must keep passing.
- **Do not use the Playwright or Chrome MCP browser tools.** Other agents share them. Use `tools/shot.mjs`.

## Globals

### `SMD.t(key, english, params)` — every visible string
`SMD.t('hq.advance', 'Advance one month')`, `SMD.t('x', 'Launch in {n} months', {n: 3})`. Keys are dotted and namespaced by module (`hq.*`, `design.*`, `review.*`, `film.*`, `map.*`, `research.*`, `archive.*`, `end.*`, `board.*`, `results.*`). Arabic comes later in `js/i18n/ar.js`. Also: `SMD.lang()`, `SMD.dir()`, `SMD.setLang('ar'|'en')`. Write layout with logical CSS properties (`margin-inline-start`, `inset-inline-end`, `text-align: start`) so right-to-left works.

### `SMD.bus`
`on(name, fn) → unsubscribe`, `emit(name, payload)`. Events in use: `'agency'` (state changed), `'lang'`.

### `SMD.game`
`agency` (the career state, see below), `newGame(name)`, `save()`, `load()`, `hasSave()`, `clear()`. Call `SMD.game.save()` after any state change (month advanced, project approved, choice made).
- Saves are `{format:'ek-save', v:2, savedAt, agency}` (old bare-agency saves still load and are repaired). Also `serialize()`, `adopt(obj)`, `brokenSave()` (the unreadable save kept under `ek-save-broken`), `loadError`, `loadNotes`.
- `SMD.store.get/set/remove(key)`: localStorage with an in-memory fallback when storage is blocked or full. Use it instead of `localStorage`.
- `SMD.settings`: `{quality:'auto'|'high'|'low', sound, reducedMotion}` saved under `ek-settings`, with `tier()`, `profile()`, `gpu()`, `autoReason()`. Every change emits bus `'settings'`. `?quality=low|high` in the address forces a tier.

### `SMD.agency` (js/agency.js) — career logic. Do not edit; ask the lead.
- `newAgency(name, seed)`, `parts(ag)` (unlocked part options), `newDesign(ag, missionKey)`, `applyTech(ag, design)`.
- `contractState(ag, key)` returns `'open'|'busy'|'done'|'locked'|'needsTech'`. `nextWindows(ag, key)` returns `[{startMs,endMs,bestMs,minC3}]` (planets only).
- `plan(ag, design, testPlanId, confidenceId)` returns `{ base, ev, launch, readyMs, devMonths, overload, cost:{hardware,tests,storage,build,reserve,launcher,ops,total}, expected:{total,fractions,keyFrac,headline}, riskAnyFlaw, snowball }`.
  - `launch` has `.wet .dry .prop .capacity .launchMargin .launch.departMs .launch.arriveMs .launch.c3 .opsCost .missionYears`.
  - `base` has `.powerAvail .powerReq .powerMargin .instrMass .powerSysMass .dryNoProp .expectedFlaws .planet.name .mission`.
- `checks(ag, plan)` returns `[{id, ok:'ok'|'warn'|'bad', label, detail}]`. The ids are science, lift, power, data, money, risk, window.
- `approve(ag, design, testPlanId, confidenceId)` returns `{ok:true, project}` or `{ok:false, why, text}`.
- `advance(ag)` moves one month and returns events: `{type:'income'|'phase'|'review'|'event'|'ready'|'launch'|'arrival'|'complete'|'unlock'|'broke', project?, review?, eventId?, missionKey?, amount?}`.
  - **The HQ must handle `review` (open the review screen) and `event` (show the choice card) before advancing again.**
  - A project waits at `ready` until its FRR review is resolved.
- `reviewQuestions(ag, p, review)` returns `[{id, who:'science'|'systems'|'budget'|'safety', text, options:[{id,label,effects}]}]`. Then `resolveReview(ag, p, review, {qid: optionId})`.
- `resolveEvent(ag, p, eventId, choiceId)` returns `{event, choice, notes}`.
- `monthsToNextEvent(ag)`, `buyTech(ag, id)`, `hireTeam(ag)`, `isOver(ag)`, `lessons(ag, p)` returns `[{delta, text}]` (what-if lines), `whatIf(p, change)`, `fmtMonth(ms)`, `addMonths`, `monthsBetween`, `CONFIDENCE {lean, standard, safe}`, `flightLost(p)`.

**Agency state** `ag`:
- `name, now (ms, first of month), money ($M), rep, science, teams, tech[], projects[], completed{missionKey:score}, headlines[], discoveries[] (ids), log[{ms, key, en, params, text}]`. `text` is a getter in the current language; old saves have plain `{ms,text}`. Render entries with `SMD.agency.logText(entry)`; `SMD.agency.isSlipNote(text)` spots the schedule-slip note.

**Project** `p`:
- `id, missionKey, design, status ('dev'|'ready'|'flying'|'done'), phase ('B'|'C'|'D'|'E'|'F'), startMs, readyMs, launchMs, arriveMs, endMs, launch, buildCost, devLeft, reserve, reserveLeft, overrun, breach, launcherCost, opsMonthly, expected, reviews{PDR,CDR,FRR}, events[{id,phase,atMs,resolved,choice}], missedWindow, result{score,lost,reward{rep,science,money},success,discoveries[]}`.
- `flight` (after launch) is `{score, timeline:[{kind,ms,title,tone,text,part}], fs, sci}`.
  - After a reload it is the slim form `{score, timeline, lost, manifested, insertion, delivered, lostGbit, scienceEndMs}`.
  - Always read through `p.flight.score`, `p.flight.timeline` and `SMD.agency.flightLost(p)`.
  - Timeline `kind` values: departure, checkout, deploy, tcm, ega, storm, software, arrival, aerobrake, science.

### `SMD.data` (js/data.js)
`MISSIONS[key]` gives `{key, dest, kind:'earth'|'moon'|'planet', title, headline, question, objectives[{id,label,weight,needGbit,key,instruments{instId:quality}}], turns, turnDays, scienceOrbit, aerobrake...}`. The keys are nile, weather, moon, mars, venus, jupiter. Also: `INSTRUMENTS[id] {name, mass, power, rate, cost, blurb}`, `OPTIONS` (launcher, dish, amp, recorder, avionics, shield, ground, margin), `CONTRACTS[key] {unlockRep, reward{money,rep,science}, sponsor, headline, needsTech}`, `TECH[{id,name,cost,effect}]`, `TEST_PLANS[{id,name,tests,blurb}]`, `CAREER`, `CONST`, `STAR_NAMES`.

### `SMD.model`, `SMD.ops`, `SMD.physics`
- Model: `evaluate(design, launch?, {readyMs})`, `computeBase`, `windows`, `snowball(design, ev)`, `opt(list, id)`, `baseGrid`.
- Ops: `autoFlight`, `probePosition(launch, ms)` (heliocentric km, planets), `flawLabel`.
- Physics: `PLANETS`, `planetState(key, ms)` returns `{r:[x,y] km, v}`, `AU`, `lightMinutes(au)`, `earthDistanceAU(dest, ms)`, `solarFlux(au)`.

### `SMD.ui` (js/ui-common.js)
- Helpers: `esc(s)` (**always escape** user and data text in HTML), `fmt(x, digits)`, `money(x)` ("$12M", isolated left-to-right in Arabic), `monthName(i)`, `signed`, `date(ms)`, `monthYear(ms)`, `seg(name, options, value)` (segmented control), `tone(kind, label)` (icon + word), `fitCanvas`, `RAMP` (sequential blue), `rampColor(t)`.
- `screens` registry; `state` (legacy, don't use for career).
- `toast(text, {kind, ms})`, `openSettings()` (graphics, sound, motion, save to/load from file), `downloadText(name, text, type)`.
- Register a screen with `SMD.ui.screens.name = { render(app, params) { ...; return cleanup } }`. Navigate with `SMD.go('name', params)`. `render` must clean up every listener, animation frame and 3D mount in the returned function.

### 3D (ES modules)
- `js/3d/engine.js` exports `THREE, mount(container, sceneObj), stop(), getRenderer(), studioEnv() (Promise<envMap>), input, ease, disposeTree, debug`. `sceneObj = {scene, camera, update(dt,t), onResize(w,h), dispose(), shadows?, exposure?}`. Only one scene is mounted at a time. Also `supported()` (false when WebGL is missing: `mount` then paints a 2D backdrop and scenes still update) and `profile()` (the quality tier's limits); `debug` has `pixelRatio` and `frameMs`.
- **Post-processing (Last Light)**: a scene object with `post: {...}` is drawn through `js/ll/render.js` (bloom, GTAO, ACES + filmic grade, vignette, grain, chromatic aberration, blur, fade; MSAA on high, FXAA on low; the tier follows `SMD.settings.tier()`). Options and their defaults are in `js/ll/post-options.js` (`DEFAULTS`, ready-made `LOOKS.pad` / `LOOKS.interior`). `engine.getPost()` is the live pipeline (null while it loads, without post or without WebGL): `set(partial)` (e.g. `{ blur: 0.4 }` for the CO2 headache, `{ fade: 1 }`), `impact(k)` (chromatic aberration + vignette kick that decays), `info()`. `engine.debug.frame` gives the whole frame's draw calls and triangles. Scenes without `post` render exactly as before.
- **Last Light sets**: `js/ll/sets/index.js` `loadSet('pad'|'capsule'|'tunnel'|'habitat', opts)` → the set (contract at the top of `js/ll/sets/common.js`: `group, anchors, colliders, walkable, volume, lights, mood, ready, update, setAlarm, setPower, dispose`), `applyMood(scene, set)`. Dev viewer: `tools/ll-sets.html?set=pad&cam=<anchor>&anchors=1`, characters `?view=chars`.
- `js/3d/assets.js`: `makePlanet(kind, radius, opts)` (procedural for now; the assets agent upgrades it to the real NASA maps), `makeStars`, `makeSun`, `makeParticles`, `softDot`, `glowTexture`, `canvasTex`, `fbm`, `planetTexture`.
- `js/3d/craft.js`: `buildCraft(design, {dryKg, propKg})` builds the spacecraft group from the design (1 unit = 1 m). `setDeploy(craft, k, stuckPart)`.
- Scenes in use: `title.js` (title backdrop), `hq.js` (campus), `designer.js` (clean room), `films.js` (launch/arrival cinematics), `solarmap.js` (solar system map). The old hand-flying scenes were removed.
- `js/3d/astronaut.js`: `createAstronaut(appearance, opts)` (the player's avatar, 1.75 m, feet at origin), `createWalker`, `createPortrait(appearance, size, opts) → Promise<dataURL>`, `drawPortrait2D`, `createAvatarStage`. See docs/ASTRONAUT.md.
- `SMD.assets` (provided by the assets agent): `texture(id) → Promise<THREE.Texture>`, `model(id) → Promise<THREE.Object3D clone>`, `credits[]`, `warmup()` (idle preloading after the title). The ids are listed in `js/3d/assetmanifest.js`. Always handle a rejected promise with a procedural fallback.

### Other
- `SMD.audio`: `unlock()`, `beep(freq,dur,type,vol)`, `chime(good)`, `alarm()`, `bang()`, `engine()` → `{set(level,brightness), stop()}`, `setMuted`, `isMuted`.
- `SMD.avatar`: `get()`, `set(appearance)`, `default()`, `random()`, `evaluate(ag) → {rank, badges, newlyEarned, rankUp, ...}`, `acknowledge(ag)`, `badgeSVG(id)`, `portrait()`, `RANKS`, `BADGES`. The creator screen is `SMD.go('avatar', {next, back})`.
- **Hands-on screens** (the player's astronaut does the work; every one has a quick path for classroom, demo and soak):
  - Designer: `SMD.go('design', {missionKey, confidence, mode:'hands'|'panel'})`; hands mode is the desktop default (`ek-design-mode`), panel on phones and in the demo. Script handle `SMD.ui.screens.design.hands` (`clickItem`, `goStation`, `mount`, `takeOff`, `putBack`, `setMode`).
  - Test hall: `SMD.go('testlab', {projectId, back:'hq', backParams})`. Rules in `SMD.testlab` (`run(ag,p,stationId,{mode:'hand'|'auto', setup, marks})`, `fix(ag,p,uid)`, `canRun`, `runsLeft`, `known`, `channels`, `SETUPS`); state in `p.testlab`. One run per station per phase.
  - Launch day: HQ sends every `'launch'` event to `SMD.go('launchday', {projectId, next:'film'})`; it goes on to `film`, or `ride` for crew missions. Agency hook `SMD.agency.launchDay(ag, p, {found, fixed, scrubDays, weatherRisk, lightning})` re-flies the mission with launch-day choices; `launchDayOpen(ag,p)`, `scrubCost(p)`, `padFixCost`. Script handle `ui.screens.launchday.current.quick({instant:true})`.
  - HQ: walking (third-person) is the default view, the old overview is the campus map (M). Staff from `content/staff.js` (`js/3d/npc.js`); `ui.screens.hq.current` has `walkTo`, `enter`, `react`, `talk(id)`, `endTalk`, `setView`, `astronaut`.
  - Agency also exports `applyEffects(ag,p,fx)` and `replanLaunch(ag,p)` for screens that spend money or slip schedules.
- **Arabic for feature work** lives in `js/i18n/ar-<feature>.js` (same `SMD.i18nDicts.ar` object; wrap `$` amounts like ar.js does). `tools/i18n-extract.mjs` reads them all.
- `SMD.demo`: `run(opts) → Promise`, `stop()`, `running`, `elapsed` (`#demo`, `#demo-30`, `#demo-raw`).
- `SMD.patch.patchSVG(design, {year})` returns the mission patch SVG string. `downloadPatch`.
- `SMD.content` (provided by the content agent): `events`, `discoveries{missionKey:[...]}`, `realMissions{missionKey:{...}}`, `sources{...}`, `tips[]`. The schemas are in GDD §9.

## Style
- Tokens and base classes are in `css/style.css`:
  - Surfaces: `.screen.day` / `.screen.night`.
  - Buttons: `.btn`, `.btn.primary`, `.btn.ghost`, `.btn.small`.
  - Status: `.tone.ok|warn|bad`.
  - Other: `.seg`, `.meter`, `.display`, `.g-hud`, `.g-end`, `.g-msg`, `.event-card(.dark)`, `kbd`.
- Put your module's CSS in your own `css/<module>.css` and prefix its classes (e.g. `.hq-…`).
- Art direction is in GDD §7: vellum day screens, slate night screens, Archivo, no all-caps labels, no NASA logos.
- Quality floor:
  - Keyboard focus visible.
  - `prefers-reduced-motion` respected.
  - Works at 390 px wide.
  - Text contrast ≥ 4.5:1.
  - Never set innerHTML with unescaped data.
- Code style: match the existing files. 2-space indent, single quotes, short comments that say why. No new dependencies or CDNs; everything is vendored.
