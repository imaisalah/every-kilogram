# Last Light: the game becomes a linear story game (binding design)

The user played the build and was not having fun: "too many things and I don't know what to do, the controls and camera, too much text to read, it doesn't look good". Decision: the whole game becomes ONE linear, cinematic survival story, like *The Last of Us*. No career, no HQ, no budget screens. The NASA challenge (design a mission, manage limited resources, see how each choice shapes the outcome) lives *inside* the story.

## Golden rules
1. **Never lost.** Exactly one current objective at a time, a short line top-left + an on-screen waypoint marker (diamond with distance, clamps to the screen edge when off-screen). Levels are linear spaces; the path forward is lit (light, colour, open door).
2. **Play, don't read.** No line over ~12 words. Characters talk while you move (subtitles bottom-centre, never blocking). No info cards during play. Real-history facts are optional **collectibles** (logs/photos/patches you find, like TLOU artefacts) readable later in a Journal.
3. **Feel.** Responsive third-person movement, mouse look like a PC game (click to capture the mouse; Esc frees it), over-the-shoulder camera that follows you, stable 60 fps on a normal laptop. Every action has animation, sound and a camera reaction.
4. **Tension, not menus.** Survival meters (O2, CO2, power, suit/health) only when they matter. Scavenge lockers for items, craft tools from them, quick-time moments for physical actions (grab, brace, pull, hold), timed choices only at 2-3 big moments per chapter.
5. **Looks.** Cinematic lighting and post-processing (bloom, ambient occlusion, tone mapping, film grain/vignette, depth fog), detailed sets, believable characters with real skeletal animation where possible.

## Structure
- Title screen → **Play** (continue from last checkpoint) / **Chapters** / **Journal** / **Settings** / language. The old career is no longer reachable from the title (its code stays in the repo, dormant).
- Character: the player's astronaut (name + look from the existing creator, offered once before the prologue, skippable).
- **Vertical slice first (this build): Prologue + Chapter 1.** Chapters 2-3 come after the user plays the slice.

### Prologue: "Cold Morning" (~8 min, set `pad`)
Night before launch, -4 °C, floodlights, fog breath. Learn to move by walking the pad to Kwame (tutorial is diegetic: prompts appear once). The **design choice** of the challenge: in the white room before boarding, 40 kg of margin left: carry ONE of three crates onto the capsule (extra oxygen tank / spare CO2 cartridges / high-res camera) — you physically pick it up and load it. Kwame warns about the cold seals; a timed choice: Go or argue for a hold (Challenger history as a collectible). Suit-up, walk the access arm, strap in, launch as a short playable sequence (hold to brace through max-Q shake, QTE at staging). Ends on day 3: quiet cabin, then the bang.

### Chapter 1: "Lifeboat" (~12-15 min, sets `capsule` + `tunnel` + `habitat`)
The service-module tank ruptures. Alarms, venting, the cabin spins. Zero-g movement through the capsule (Lantern), the docking tunnel and the small habitat module (Ibis).
- QTE: grab the handhold as the jolt hits; close the valve wheel (hold/turn).
- Power-down: physically float to panels and flip breakers off (each one shows its amps; the battery-life projection updates on a small wrist display) until you make it home on the battery.
- Scavenge: lockers in both modules contain hoses, tape, bags, a sock, flight-plan covers, cartridges, food, water (and whatever you loaded in the prologue).
- Craft: the CO2 adapter from found items on the work surface (Apollo 13's "mailbox"), against the rising CO2 gauge (headache blur and slower movement past 15 mmHg).
- One big timed choice (tell the crew the real numbers or not), crewmates react later.
- Ends behind the Moon, radio silence, Mariam's last broken warning about the Sun.

Failure (O2 out, CO2 too high, missed QTE that matters) fades to black and **retries from the last checkpoint** quickly; no long fail screens.

## Code layout and APIs (binding for the three engineers)

### Level framework (gameplay engineer): `js/ll/director.js` (ES module) + `js/screen-ll.js`
Levels are linear scripts of named **sections**; each section start is a checkpoint (state saved: section id, flags, inventory, resources, health, choices).

```js
// content/levels/<id>.js (classic script)
SMD.llLevels = SMD.llLevels || [];
SMD.llLevels.push({
  id: 'prologue', n: 0, title: 'Cold Morning', set: 'pad',
  sections: [
    { id: 'arrive', run: async (L) => {
        await L.fadeIn();
        L.objective('Find Kwame at the umbilical tower', 'kwame');
        await L.reach('kwame', 2.5);
        await L.say('kwame', 'Minus four. These seals never saw cold like this.', { mood: 'worried' });
        const pick = await L.choice([{ id: 'hold', text: 'We hold the launch.' }, { id: 'go', text: 'We fly at dawn.' }], { timer: 8, timeout: 'go' });
        L.flags.argued = pick === 'hold';
    } },
    { id: 'whiteroom', run: async (L) => { /* ... */ } },
  ],
});
```

Director `L` (all text goes through `SMD.t('ll.' + key, english)`; writers pass an explicit key as `{ id }` in opts or the framework derives one from level/section/index — the framework must make Arabic possible via `js/i18n/ar-ll.js`):
- Flow: `fadeIn()`, `fadeOut()`, `title(text, sub)`, `wait(s)`, `setScene(setId, spawnAnchor)`, `gravity('ground'|'zeroG')`, `checkpoint()` (implicit at section start), `fail(reason)` (retry from the section start), `end(nextLevelId)`.
- Guidance: `objective(text, anchorOrNull)`, `waypoint(anchorOrNull)`, `hint(text)`.
- Movement goals: `reach(anchor, radius)`, `interact(anchor, label)` (resolves when the player presses E there), `follow(castId)`.
- People: `say(castId, line, opts)` (subtitles; non-blocking variant `sayAsync`), `radio(castId, line)`, `cast(castId, anchor)`, `walk(castId, anchor)`, `anim(castId, name)`, `look(castId, target)`.
- Choices: `choice(options, { timer, timeout })` → option id (max 3 options, short text; `requires` + `locked` text supported).
- Action: `qte(kind, opts)` → boolean (`kind`: 'press' | 'hold' | 'mash' | 'turn'; key/button shown in-world), `brace(seconds)`, `timer(seconds, label)` (visible countdown; rejects → `fail`).
- Survival: `res` object `{ o2, co2, power, health }` and `meters(['o2','co2'])` to show/hide them; `drain({ o2: perSecond, ... })`; `onLow(key, threshold, fn)`.
- Items: `inventory` (Map id→count), `loot(anchor, items)` (a locker that gives items when opened), `give(id, n)`, `has(id)`, `craft(recipeId)` (opens the crafting bench UI; resolves true when built), `collectible(id)` (journal entry found).
- Camera & mood: `shot(name|{ from, at, duration })` (short cinematic camera, then back to the player), `shake(strength, seconds)`, `alarm(on)`, `power(level)` (lights), `sfx(name)`, `music(mood)`.
- `flags`, `choices` (history), `player` (position, astronaut).

`js/screen-ll.js` registers `SMD.ui.screens.ll` (playing), the new title screen (`SMD.ui.screens.start` is replaced by the Last Light title; the old start screen is kept as `start_career` but unlinked), chapter select, journal, pause menu (resume, restart checkpoint, settings, controls, quit to title), death/retry fade, chapter end card (short: chapter title, what you carried, key choice, collectibles found x/y; no long recap).

### Art & tech (art engineer): `js/ll/render.js`, `js/ll/sets/*.js`, character upgrades
- Post-processing pipeline for the whole game (vendor what is needed from three r160 examples into `vendor/`: EffectComposer, RenderPass, OutputPass, UnrealBloomPass, GTAOPass or SAOPass, SMAA or FXAA, plus a custom vignette/grain/colour-grade pass), quality tiers (high/low) that keep 60 fps on a normal laptop and stay clean on low.
- Sets (ES modules returning `{ group, anchors: { name: Object3D }, colliders, walkable, volume?, lights, update(dt), setAlarm(on), setPower(0..1), dispose() }`):
  - `pad`: night launch pad: floodlit tower, crew access arm at height, white room at the arm's end, the rocket (SLS-like) venting, fuel lines, frost, fog, a path from the parking area to the tower elevator. Anchors: `start`, `van`, `kwame`, `nadia`, `tower_base`, `elevator`, `arm_start`, `whiteroom`, `crate_o2`, `crate_co2`, `crate_cam`, `hatch`, `seat_you`.
  - `capsule` (reuse/upgrade js/3d/capsule.js), `tunnel`, `habitat`: one connected zero-g interior. Anchors: `start`, `seat_you`, `seat_yusuf`, `seat_lena`, `seat_grace`, `window`, `panel_left`, `panel_center`, `panel_right`, `valve`, `breaker_1`..`breaker_8`, `locker_1`..`locker_10`, `tunnel_a`, `tunnel_b`, `hab_bench` (crafting), `hab_window`, `hab_lockers`, `medkit`.
- Characters: replace the toy-like blocky look with believable proportions and real skeletal animation. Preferred: CC0 rigged models + animations (e.g. Quaternius on poly.pizza or the Quaternius site; check licence = CC0, record in docs/CREDITS.md) loaded with GLTFLoader + AnimationMixer, recoloured per character (suit colours, skin tones, hair). Fallback: a much better procedural rig. Must support the controller (`js/3d/controller.js`) interface the current astronaut provides (`setSpeed`, `setFloat`, `play`, `lookAt`, `setExpression` where possible).

### Level design & script (writer/level engineer): `content/levels/prologue.js`, `content/levels/lifeboat.js`, `js/i18n/ar-ll.js`, `docs/LASTLIGHT-SCRIPT.md`
Writes both levels with the director API and the anchors above; short punchy lines; 2-3 timed choices per chapter; the prologue cargo choice changes Chapter 1 (extra O2 = slower drain, spare cartridges = the CO2 craft is easier, camera = a key collectible and a later payoff); 6-8 collectibles per chapter (real NASA history: Challenger, Apollo 13's mailbox, the lifeboat procedure, Orion facts) with sources; Arabic for every line.
