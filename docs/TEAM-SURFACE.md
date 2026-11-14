# Team surface mission (`js/team/surface-sim.js`), v2: calm exploration

The surface behind `SMD.team.surface`, rebuilt for docs/TEAM-V2.md ("Surface v2: calm exploration", "Calm interface"). No aliens, no weapons, no turrets, drones, medkits or rovers. Pure, deterministic, fixed 30 Hz tick, plain-JSON state, loads in node. Tests: `tests/team-surface.test.js`. Balance: `node tools/surface-balance.cjs`.

## The loop

Land. Walk to the glowing science sites and **hold Use** in the ring to scan them with the instruments the team brought (a site no instrument fits says so). Each scan leaves a **sample** (a heavy core if a drill was packed): pick it up and walk it into the lander ring. **Plant the dish** by the lander; data on the recorder only counts once it goes home in an **uplink window**. Watch **oxygen, suit battery and daylight**; top up at the lander. Go home before the clock runs out; at the door, if the rack is too heavy for the ascent fuel, the crew **chooses what to throw overboard** (6.5 s, time holds).

| Beat | What happens |
|---|---|
| Intro (3.5 s) | Landing; no input. |
| Play | Explore, scan, carry, plant the dish, hold it during windows. |
| Call home | The planner holds the ability, or the clock calls it 34 s before the end, or everyone is aboard. 30 s to get to the lander. |
| Door | Everyone there: launch. Over the lift limit: the throw-overboard choice first. |
| Late | When the 30 s run out, suits steer stragglers home on autopilot while the lander waits; propellant boils off (0.8 kg of lift per second). After 15 s the ascent window closes: **stranded**. |

### Real dangers only

| Danger | Where | Warning | Effect | Answer |
|---|---|---|---|---|
| Dust storm | Mars | 10 s | Light x0.6, solar x0.25, walking x0.8, suit battery +0.3/s, dish drifts | Carry on carefully; top up power |
| Sulfuric haze | Venus | 10 s | As a storm, plus suit wear 0.9/s outside shelter | Shelter if worn |
| Radiation spike | all | 12 s, the one alarm | Suit wear 3.4/s outside shelter | The lander dome (11 m) or a cave |
| Moonquake / icequake | Moon, Europa | 4 s | Dish knocked out of line; 4 rocks fall near the crew, each marked 1.8-2.6 s ahead | Step out of the circles (18 wear if hit) |
| Cold night | all | the clock shows a moon | Air x1.25, suit battery +0.35/s away from the lander lights; the base needs heat and light power | A battery that lasts the night |

Hazards are planned from the seed and never overlap (one alarm at a time). Difficulty scales their number and strength.

### Nobody dies

A suit that runs out of **air**, **battery** or **integrity** walks its wearer back to the lander on autopilot (no input, emergency air), then they rest 8 s while it is refilled, charged and patched. If the lander has no spare air left, a crew member with an empty tank stays aboard for the rest of the mission; if all are aboard, everyone goes home. Each walk home is counted (`crew.returns`, `returnsBy`) and costs time, not lives.

### Outcomes

`summary.result`: **success** (extracted, objective met, at least 25% of all the science on the map home), **partial** (extracted, short of that), **stranded** (the ascent window closed). `outcome` is `'extracted'` or `'stranded'`.

### Roles

| Role | Strength | Ability (Q / ability button) |
|---|---|---|
| Planner | | Tap: ping a spot. Hold 1.2 s: call everyone home. |
| Engineer | Patches suits 1.6x faster at the lander | Patch the most worn suit within 4 m (+35) |
| Scientist | Scans 2x faster than anyone | Overclock: scan 1.9x for 8 s |
| Comms | Plants the dish in 2.2 s (others 6 s); +25% uplink while in the ring | In a window by the dish: +40% uplink for 8 s; otherwise realign the dish |

Bots fill empty seats: they plant the dish, scan, carry samples home, hold the dish in windows, shelter from radiation, top up before they run low, dodge marked rocks (not perfectly), wait for the people, and the planner bot calls home only in an all-bot crew or in the last 70 s.

## Objectives and progress (for the mission tracker)

`state.objectives` (refreshed every 10 ticks) and `summary.objectives`: `[{ id, text, key, frac 0..1, done, weight, n?, of?, kind? }]`; `state.progress` / `summary.progress` is the weighted share done (0..1).

| id | Text | Weight |
|---|---|---|
| scan | Scan the {kind} sites (n of m) | 0.25 |
| sample | Load {kind} samples into the lander | 0.15 |
| dish | Plant the dish | 0.10 |
| send | Send the {kind} data home (half the objective sites' value) | 0.20 |
| science | Bring home 25% of the science on the map | 0.15 |
| home | Lift off with the crew | 0.15 |

All six done is a success. The view publishes progress three ways: `SMD.team.kit.setProgress(progress)` feeds the shared mission bar's Surface stage (reset to `null` when the session ends); `SMD.team.surfaceProgress()` returns `{ progress, objectives, stage, over }`; and a `window` event `ek-surface-progress` carries the same `detail`. `statusFor` gives phones `progress` (0-100), `goal` and `goalDistM`.

## The view (`js/team/view-surface.js`, `surface3d*.js`)

- **Third person by default, V for first person** (gloved hands holding the scanner; the screen and lens light up while it reads a site), H for help, the top-down view from the help card. Mouse captures on click. Right mouse / LT aims (zoom over the shoulder, face where you look, strafe and back-pedal), C / right-stick click swaps the shoulder, Space / gamepad B hops (height and hang time from the world's gravity), Shift / L3 hurries in any direction. The camera is a spring arm with collision; the body faces where it moves, leans by v·ω/g, looks where you aim, breathes, and kicks up dust that flies like it would on that world (docs/GRAVITY.md).
- **HUD**: top left the one objective line with distance and the tracker (% always, the checklist opens for a few seconds when something is done, or on hover); top right the clock (sun or moon), the next uplink and a pause button; bottom left one suit pill (air, battery, and wear only once it matters) or, on a shared screen, a quiet crew strip; bottom centre what Use does now; bottom right a small radar in eye-level view (sites, samples, the lander, the dish, teammates). One amber alarm card: radiation, the call home, or your own low air. Soft notes, one at a time, no flashing, pulsing or shaking HUD; the camera only sways on quakes and liftoff.
- **Pause**: the session takes a handle from `SMD.team.kit.pauseMenu(stage, { ctx })`. With the shared bar on screen, its Pause button and Esc do the work, the HUD moves 52 px down and hides its own pause button; the gamepad Start button and leaving mouse capture in a solo game call `handle.open()`. Without the kit, Esc, P and a HUD pause button send the room `pause` and show a small Resume card. While `view.paused` is set the host does not step the sim.
- **World**: the same terrain, skies and horizons; the base, the folded dish waiting on its pad, steady light pillars over the sites, samples, canisters in the caves, rockfall marks that fill in as the rock comes down, a soft shelter dome during radiation, helmet lamps at night and in storms. Nothing that reads as a vehicle.

## Tuning (`SMD.team.surface.TUNE`)

Walk 7.2 m/s (Moon 1.05x, Venus 0.96x, Europa 0.98x), sprint 1.35x (+0.6 air/s). Air 100 per tank, 0.56/s (x1.25 in the cold), lander reserve 100 + 70 per spare canister, refill 40/s. Suit battery 100: 0.1/s, +0.8 scanning, +0.35 cold, +0.3 storm; recharge 30/s if the base can run the charger. Suit integrity 100, patched 6/s at the lander. Base load: 60 W idle, 140 W heat at night, 110 W lights in the dark, 160 W charger; shed charger first, then lights, then heat; 0.145 game hours per second. Carrying slows by 1.2% per kg (to 55%). A person in an eye-level view (input `shooter`) starts, stops and turns with real traction for the world's gravity (`input.g` in `stepMove`; `earthG` = their "Realistic gravity" is off): docs/GRAVITY.md. Bots, phones and the suit autopilot keep the old quick approach, so the balance below is unchanged.

## Balance report

`node tools/surface-balance.cjs --seeds 30 --cf 20` (bots only, 2026-11-12). Success / partial / stranded, average objectives, share of the map's science home:

| Design | Difficulty | Moon | Mars | Venus | Europa |
|---|---|---|---|---|---|
| Good | Cadet | 100/0/0, sci 69% | 100/0/0, 70% | 100/0/0, 68% | 100/0/0, 70% |
| Good | Engineer | 100/0/0, 69% | 100/0/0, 70% | 100/0/0, 68% | 100/0/0, 70% |
| Good | Flight director | 100/0/0, 68% | 100/0/0, 70% | 100/0/0, 68% | 100/0/0, 67% |
| Mid | Cadet | 100/0/0, 40% | 100/0/0, 41% | 100/0/0, 48% | 100/0/0, 39% |
| Mid | Engineer | 100/0/0, 38% | 100/0/0, 39% | 100/0/0, 48% | 97/3/0, 35% |
| Mid | Flight director | 83/17/0, 32% | 100/0/0, 40% | 100/0/0, 48% | 47/53/0, 26% |
| Poor | any | 0/100/0, 11-17% | 0/100/0, 15-16% | 7/93/0, 19-20% | 0/100/0, 9-12% |

With one idle person in the crew (`--with-human`, bots wait for people), the real starter designs from `sim.surfaceLoadout` succeed on every world (objectives 85-100%, science 29-55%).

What each item decides (mid design, Engineer, one change, with an idle person, 12 missions per world):

| Change | Success | Objectives | Science home |
|---|---|---|---|
| Baseline | 94% | 100% | 35% |
| Objective instrument left home | 0% | 36% | 19% |
| Weak radio (a third) | 8% | 90% | 18% |
| Short lifetime (72%) | 44% | 96% | 24% |
| Rare windows (x2.2) | 67% | 98% | 27% |
| Low ascent fuel (30%) | 71% | 84% | 28% |
| Small recorder (30%) | 81% | 99% | 30% |
| One instrument, no drill, no spare O2, small battery, small solar, far landing | 94-98% | 100% | 34-36% |

## Known limits

- Bots plan air and power perfectly, so spare oxygen, battery, solar and landing distance barely change bot outcomes (the lander's spare air does run out, and the debrief says so). People wander; expect those parts to matter more by hand. Nobody has played v2 by hand yet.
- Good designs succeed every time with bots; the human pace is untested.
- A good design throws about 4 of 7 cores overboard at the door: that is the intended "every kilogram" moment, but it may feel like a lot.
- The 'realistic' hazards setting now means the same calm mission.

## Contract

```js
const S = SMD.team.surface;
const state = S.create(loadout, seed, players, { difficulty: 'engineer', world: 'mars' });
S.step(state, inputs, 1 / 30);    // mutates and returns state; state.events holds only this step's events
S.summary(state);                 // scoring, objectives and consequence-chain facts (works mid-mission too)
S.statusFor(state, playerId);     // small HUD payload for a phone
S.nextGoal(state, playerId);      // { id, target: { x, z } }: the one next thing for that person
S.fixture('good', 'mars');        // sample loadout: 'good' 'mid' 'poor' 'empty' 'maxed'
S.stepMove(pos, input, dt, map);  // pure movement for client prediction (input.g: real traction, docs/GRAVITY.md)
S.gait(v, g) / S.hopOf(g) / S.dustOf(world) / S.feelG(world, realistic)  // the gravity model the view draws with
S.jettison(state, sampleId);      // throw a rack sample overboard during the call home
S.STRINGS;                        // every summary and objective sentence, key -> English
```

`players`: `[{ id, name, role, bot }]`, a number of humans, or empty; empty slots become bots unless `opts.fillBots === false`.

**Inputs** `inputs[playerId] = { moveX, moveY, aimX?, aimY?, use, ability, sprint?, shooter?, earthG?, jettison? }` (`earthG`: Realistic gravity off on that player's device; room button bit 256). `use` is held (scan, plant, align; edge: pick up or set down a sample). An old controller's `fire` counts as `use`. `swap` and `weapon` are ignored.

**Loadout** (from `SMD.team.sim.surfaceLoadout`): `world, objective, spareO2, drill {id, depthM}, power {solarW, batteryWh, rtgW}, instruments [{id, name, fits, rate, value}], recorderGbit, uplink {rateGbitS, everyS, windowS, firstS, label}, landing {offsetM, inRange}, lifetimeS, ascent {liftKg}, parts`. `weapons`, `turrets`, `rover`, `drones` and `medkits` are ignored when present (a `'drill'` in `weapons` still counts as a drill).

**State** (what the renderer and HUD read): `version 2, seed, world, difficulty, t, tick, T, over, outcome, stage ('intro' | 'play' | 'extraction' | 'over'), phase ('calm' | 'pressure' | 'siege' | 'frantic', for sound), sun {up, elevation, light, nextChangeIn}, map {size, cell, w, h, tiles, lander, dishPad, routes, caves}, entities, base {battery, batteryMax, solarW, loadW, heatOn, lightsOn, chargerOn, dark, shelter, o2Stock, o2StockMax, shieldR (shelter radius), lightR}, recorder, uplink, ascent {liftKg, loadedKg, overKg, rack, jettisoned}, extraction {called, timer, decision, waiting}, hazards [{id, kind: storm|acid|radiation|quake|rockfall, x, z, r, state: warn|active, tLeft}], pings, prompts {playerId: scan|plant|align|pickup|deliver|needs_instrument|shelter|returning|rest}, objectives, progress`.

Entities: `astronaut` (`slot, playerId, name, role, isBot, o2, energy, hp = suit integrity, carrying, aboard, returning (null | oxygen | battery | suit | call), restT, useT, useKind`; state `idle walk carry scan plant repair return rest`), `lander`, `dish` (`planted, align, plantT`), `site` (`siteKind, label, objective, fits, instrument, scanned, done, sampleTaken`), `sample` (`siteKind, massKg, value, core, heldBy, objective`), `pickup` (`item: o2 | energy`), `boulder`.

Events: `scan scanDone sampleTaken samplePickup sampleDrop sampleDelivered pickup windowOpen windowClose uplinkTick dishPlanted recorderFull dataOverwritten sunset sunrise baseDark baseLit hazardWarn hazardStart hazardEnd quake rockfall hit (a rock on a suit) suitReturn suitHome suitPatched boarded lowO2 lowBattery o2StockOut overclock uplinkBoost ping extractionCalled decisionOpen jettison liftoff phase`.

**Summary** keeps every field the room, chain, score and obituary read: `crewTotal, survivors, scienceFrac, valueSent, gbitSent, setsLost, setsTotal, overrunWave (always null), cause (null | stranded | oxygen | data_left; never a combat cause), baseDark (false), samplesKg, samplesLeftKg, liftKg, o2LeftS, crewAlive (true), outcome, extracted, won, result, progress, objectives, crew {total, aboard, lost, returns, returnsBy, downs 0, revives 0, deaths 0}, science, samples, power, dangers, uplink, ascent, items {o2, drill}, facts [{id, kind, part, value, text, why, key, whyKey, params}], perPlayer [{name, role, playerId, isBot, scans, carried, dropped, returns}], score {science, survival, objectives, timeUsed}`.

Network snapshots (`js/team/surface-net.js`) carry the same calm state, including `returning`, `restT`, the objectives and progress; the init carries the caves and the objective kind.

## v3 (docs/TEAM-V3.md items 5, 6, 11, 12, 19)

### Jobs
`opts.jobs` (default `true`; `false` = the v2 shared mission). `TASK_JOB`: scan/choose → scientist (choose also planner), plant/align/uplink/boost → comms, repair/patch → engineer, call/route → planner. `owns(S, V, p, task)`: your job, or nobody who holds that job is still outside. Gated: site scans and the `needs_instrument` prompt, dish plant/align and the `plant`/`align` prompts, holding the uplink ring (only Communications counts as a holder; one holder now gives the full rate a pair used to), fault repair, the door jettison (inputs, phones' `ascentDrop`, the drop button). Not gated: picking up and carrying samples, canisters, resupply, shelter, boarding.

Bots: only the comms bot plants/holds; only the scientist bot scans; the engineer bot repairs faults first (after shelter and delivery); others carry samples. `workDone` (used by the planner bot and the crew-at-the-door call) also waits for open faults. Door decision: `TUNE.decisionS` (15 s) when a person may choose, `TUNE.botDecideS` (3 s) otherwise.

`nextGoal` with jobs: scientist `scan` (the planner's routed site first) → `sample` → `home`; comms `plant` → `align` (< 0.9) → `hold` → `wait` / `sample`; engineer `repair` → `patch` (a crewmate under 60 within 45 m) → `sample` → `systems`; planner `call` (work done or < 70 s left) → `route` (an unmarked site) → `sample` → `watch`. Shared goals first: over, return, returning, rest, shelter, deliver, resupply.

### Lander faults (the engineer's)
`S.faults [{ id, kind: 'panels'|'charger', x, z, fixT, since }]`, planned from the seed (`planFaults`, Cadet 1 / Engineer 2 / Flight director 3, between 20% and 68% of the lifetime, only during play; one per kind at a time). Spots: panels 4.8 m east of the lander, charger 4.6 m west. `panels`: solar × `TUNE.panelsFaultFactor` (0.35); `charger`: no suit charging. Fix: hold Use within `TUNE.repairR` (2.8 m) for `TUNE.repairS` (4 s). Kinds by world: Mars and Venus panels only; Moon and Europa charger and panels. Events `fault {kind}`, `faultFixed {kind, by}`; prompt `repair`; objective `systems` (counts only faults that happened once the mission is over); summary `faults { total, seen, fixed, open, panelsS, chargerS }`, facts `faults_open` / `faults_fixed`.

### Planner route
A tap of the ability (under 1.2 s) marks the unscanned site the planner faces (within 20°, else the one nearest the ping): `S.route { siteId, by, t }`, the ping sits on the site, `ping` carries `site`. The scientist's bot and goal take it first; it clears when scanned.

### Signature objectives (item 19)
`SIGNATURE = { moon: 'shadow', mars: 'core' }`. Moon: the objective site farthest from the lander gets `shadow: true` (label "Permanently shadowed crater"); within its radius + 3 m suits are cold (air ×1.25, +0.35 battery/s) day or night; objective `shadow`, facts `shadow_done` / `shadow_missed`. Mars: objective `core` (a drilled core of the objective kind on the rack; half while one lies on the ground), facts `core_home` / `core_missed` (why: `core_nodrill` or `core_left`). `summary.signature`.

### Objectives
`scan 0.22, sample 0.13, dish 0.10, send 0.18, science 0.14, systems 0.08, home 0.15, shadow 0.10, core 0.10`, normalised over the ones present. Each objective has `job` (`OBJECTIVE_JOB`, null = the crew).

### Crew
`players[]` take `crewId` and `playerName` (stored on the astronaut, sent in the network init, kept in `perPlayer`). `perPlayer` adds `job, crewId, playerName, plants, aligns, repairs, patches, routes, calls, boosts, overclocks, heldS`. `statusFor` adds `job, crewId, name`; `rack` only for those who may choose.

### Honest summary (item 12)
Stranded: `survivors 0`, `crew.aboard 0`, `crew.lost` = everyone, `score.survival 0`, nothing returned, `result 'stranded'`. `sim.score` then caps the mission at 299 ("Mission lost").

### Network
Words added (`panels charger systems route patch watch shadow core`), events `fault`, `faultFixed`, `ping.site`; init `jobs`, `faultTotal`, players `crewId`/`playerName`, sites `shadow`; slow section `faults` (kind, x, z, fixT). Decoded states carry `jobs`, `faults`, `faultTotal`.

### Balance (v3, bots only, `node tools/surface-balance.cjs --seeds 12 --cf 8`, 2026-11-14)
Good designs: 100% success on every world and difficulty, science home 65-73%. Mid: 100% on every world at Cadet and Engineer; Flight director Moon 92%, Europa 17% (83% partial). Poor: 0-25% success (partial otherwise), science 8-24%. Starter designs from `sim.surfaceLoadout`: 100% success everywhere. No stranded crews. One change on the mid design: objective instrument left home 0% success, weak radio 22%, short lifetime 56%, small recorder 88%, rare windows 91%, low ascent fuel 94%, the rest 100%.
With one idle person (`--with-human --human-job <job>`, Engineer): planner or engineer idle, 100% success; scientist idle, 0% (nothing gets scanned); comms idle, 0-17% (no dish, no data home). Jobs matter: a person who does nothing leaves their job undone. `--no-jobs` runs the v2 shared mission.
