# The player's astronaut: integration guide

The player is the agency director, and also an astronaut. This guide explains the character and how it is wired into the game.

**Status: integrated.** What the game does with it now:

- `index.html` links `css/avatar.css`, `js/avatar.js` and `js/screen-avatar.js`; `#dev-avatar` opens the creator.
- New game: `screen-newgame.js` goes to `SMD.go('avatar', { next: 'hq' })`; the HQ tour follows. The HQ top bar has a portrait chip (`.hq-me`: portrait, name, rank) that reopens the creator with `back: 'hq'`.
- HQ campus (`js/3d/hq.js`): the astronaut walks the plaza. Click or tap the ground to walk (grid A* around building footprints, `FOOT` in hq.js); click a building to walk to its door and go in (walks longer than 2.5 s cut to the last steps; reduced motion opens at once); WASD or arrows walk relative to the camera and stepping into a door goes in. The overview stays the default; the "Walk with …" toggle, the mouse wheel or the keys bring a follow camera, Esc goes back. A teal ring and a name tag mark the astronaut from afar. It glances at buildings, waves when a review or decision falls due, and celebrates, cheers or looks sad when you come back from results, a launch film or an approval (`SMD.go('hq', { mood })`). `ui.screens.hq.current` exposes `walkTo`, `enter`, `react`, `setFollow` and `astronaut` for scripts.
- Designer (`js/3d/designer.js`): the 1.75 m scale figure is the astronaut, helmet off, looking at the craft; it cheers when a part pops in.
- Films (`js/3d/films.js`): the launch film cuts to the director at a viewing stand 700 m from the pad (5.6–8.1 s, long lens), cheering and jumping; the arrival film has a 2.2 s mission-control shot where the director turns from the big screen and celebrates, fist-pumps or bows their head.
- Results (`js/screen-results.js`): a portrait with the outcome's expression sits on the patch; rank-ups and new badges show in a short reward card (auto-hides, Esc, "Nice"), then `SMD.avatar.acknowledge()`.
- `createWalker` ignores obstacles beyond the current target, so the last steps to a door are never deflected.

## Files

| File | What it is |
|---|---|
| `js/avatar.js` | Classic script, `SMD.avatar`: the appearance options, save and load, ranks and badges, badge art, portrait helper. |
| `js/3d/astronaut.js` | ES module. `createAstronaut`, `createWalker`, `createPortrait`, `drawPortrait2D`, `createAvatarStage`. |
| `js/screen-avatar.js` | `SMD.ui.screens.avatar`, the character creator. |
| `css/avatar.css` | Styles for the creator (`.av-…`). |
| `tools/astronaut-test.html` | Dev page (not linked from the game). Loads the same scripts as `index.html`. See the views below. |

### Dev page views

`tools/astronaut-test.html` loads with `<base href="../">`, so every path matches `index.html`.

| URL | Shows |
|---|---|
| no query | The creator on a ready-made career. |
| `?fresh=1` | The creator on a new agency, with no badges. |
| `?view=grid` | Six looks doing walk, wave, celebrate, sad, cheer and look-at. Add `&anim=walk` to make all six do one animation. Add `&t=1.2` to freeze at that moment. Add `&cam=close` or `&cam=heads` to change the camera. |
| `?view=portraits` | `createPortrait()` images and the 2D fallback. |
| `?view=campus` | Click or WASD walking with obstacles, door triggers and a follow camera. `&walk=1` walks a set route by itself. |
| `?view=far` | The character at campus distance. |
| `?nogl` | The creator without WebGL. It shows the 2D portrait instead of 3D. |

## 1. index.html

Add the stylesheet next to the other module styles, before `css/rtl.css`:

```html
<link rel="stylesheet" href="css/avatar.css" />
```

Add the two classic scripts after `js/screen-classroom.js` and before `js/demo.js`:

```html
<script src="js/avatar.js"></script>
<script src="js/screen-avatar.js"></script>
```

`js/avatar.js` only needs `SMD.t`, plus `SMD.store`, `SMD.game` and `SMD.bus` when they are available, so it can also go right after `js/patch.js`. `js/screen-avatar.js` needs `SMD.ui`, which comes from `js/ui-common.js`. With `js/screen-avatar.js` loaded, `#dev-avatar` works too: `js/3d/index.js` opens any registered screen on a quick-start career.

## 2. Send new players to the creator

In `js/screen-newgame.js`, after the agency is made (line ~132), replace `SMD.go('hq')` with:

```js
SMD.go('avatar', { next: 'hq' });
```

The creator saves to `agency.avatar` (with `SMD.game.save()`) and to localStorage `ek-avatar`, then goes to `params.next`. Params: `{ next = 'hq', nextParams, back, backParams }`. Pass `back` to show a Cancel button (it shows by default once the agency already has an astronaut). An HQ menu entry for editing the astronaut later:

```js
SMD.go('avatar', { next: 'hq', back: 'hq' });
```

`avatar` is a career screen. Without an agency, `main.js` tries the save, then shows the recovery screen. If the creator must open before an agency exists, add `'avatar'` to `NO_AGENCY` in `js/main.js`. `SMD.avatar.get()` then falls back to localStorage.

## 3. SMD.avatar (js/avatar.js)

```js
SMD.avatar.default()        // a fresh appearance (patch colour = agency patch colour)
SMD.avatar.get()            // agency.avatar if a career runs, else localStorage 'ek-avatar'; always complete and valid
SMD.avatar.set(appearance)  // normalises, stores on the agency + SMD.game.save(), localStorage, emits bus 'avatar'
SMD.avatar.normalize(a)     // fills or repairs any object (old saves, bad input); the name is trimmed to 24 characters
SMD.avatar.random()         // a random look that keeps the name and patch type
SMD.avatar.colors(a)        // { body, accent, trim, skin, hair, patch } as hex strings
SMD.avatar.patchDesign(ag)  // the design used for the 'mission' shoulder patch (latest flown, else latest approved)
SMD.avatar.evaluate(ag?)    // { rank, rankIndex, nextRank, rankUp, badges, all, newlyEarned }; pure, never writes
SMD.avatar.acknowledge(ag?) // marks the current rank and badges as seen (stored in agency.avatarSeen) and saves
SMD.avatar.badgeSVG(id, earned, label?) // inline SVG roundel for a badge (escaped label)
SMD.avatar.portrait(a?, size?)          // Promise<dataURL>, a head-and-shoulders portrait (loads the 3D module on demand)
SMD.avatar.SUITS, SKINS, HAIR, HAIR_COLORS, VISORS, PATCHES, PATCH_COLORS, RANKS, BADGES
```

Appearance: `{ name, suit, skin, hair, hairColor, visor, patch, patchColor }`.

- **suit:** `classic` (white with orange), `gold`, `teal`, `navy`, `orange`, `lavender`.
- **skin:** `s1`…`s6`.
- **hair:** `short`, `curly`, `bun`, `covered` (headscarf; under a helmet it becomes a comms cap in the scarf colour), `helmet` (helmet on).
- **hairColor:** `black`, `brown`, `auburn`, `blond`, `grey`.
- **visor:** `clear`, `gold`.
- **patch:** `agency` (the pyramid-and-orbit agency patch in `patchColor`) or `mission` (`SMD.patch.patchSVG` of the latest mission).
- **patchColor:** the six New agency colours. The headscarf also uses this colour.

**Ranks.** Each rank needs the one before it:

1. Astronaut candidate.
2. Flight engineer: a mission approved.
3. Mission specialist: a mission completed and not lost.
4. Commander: first headline.
5. Flight director: a planet headline.
6. Agency legend: all three planet headlines.

**Badges** (11):

- `firstLaunch`, `firstHeadline`
- `homePlanet`: both Earth missions flown
- `moon`, `mars`, `venus`, `europa`
- `onBudget`: done, not lost, `overrun` 0 and no breach
- `thorough`: launched on the `thorough` test plan
- `comeback`: a headline mission that ended after a lost one
- `allDiscoveries`: every discovery of one mission unlocked

All of them are computed from saved career state (`projects`, `result`, `headlines`, `discoveries`), so they survive a reload.

## 4. The 3D character (js/3d/astronaut.js)

> **Rigged characters (Last Light update).** `createAstronaut` now draws a skeletal human built in `js/3d/character.js` (CC0 Quaternius bodies and animation clips, `assets/models/characters/`, see docs/CREDITS.md), with `SkeletonUtils` clones and an `AnimationMixer`. The API below is unchanged. If the models are not loaded yet it shows the old procedural figure and swaps when they arrive; if they fail, or with `opts.rig === 'procedural'` or `?rig=procedural`, the procedural figure stays. Additions: `isRigged`, `preloadCharacters()` (Promise), `CAST` presets (`you`, `yusuf`, `lena`, `grace`, `kwame`, `nadia`, `mariam`, `tarek`, `omar`, `aiko`), `opts.outfit` (`'launch' | 'flight' | 'ground'`), and `play(name)` accepts `idle, walk, run, float, swim, reach, interact, pickup, wave, sit, lie, stand, talk, cheer, celebrate, sad, carry, brace, tense, lookAround, crouch, torch, fix, push, hop` and more; unknown names map to the nearest clip or are ignored, never an error. With the rigged figure, the numbers in this section differ: about 17k triangles and 4 to 5 draw calls per character per pass. Seat contract: the anchor is the floor point under the front edge of the seat pan; `play('sit', {hold:true})` puts the pelvis about 0.47 m above and 0.12 m behind the origin.

```js
import { createAstronaut, createWalker, createPortrait } from './astronaut.js';

const astro = createAstronaut(SMD.avatar.get(), {
  // env: texture | null  (default: engine studioEnv(); null skips reflections)
  // shadows: true        (cast real shadows)
  // blob: true           (soft contact shadow under the feet; keep it on the campus)
  // design               (design for the 'mission' patch; default SMD.avatar.patchDesign())
  // helmet: true|false   (force the helmet on or off; default follows hair === 'helmet')
});
scene.add(astro.group);      // feet at the origin, facing +Z, metres
// every frame:
astro.update(dt);
```

Units are metres. The character is 1.75 m to the top of the hair, or about 1.82 m with the helmet on (the helmet top). It is about 2.6k–3.3k triangles depending on hair and helmet, and about 35 draw calls. The parts are merged per material for each joint.

| Method | Does |
|---|---|
| `setAppearance(partial)` | Live recolour or restyle. Returns a promise that resolves when the patch art is drawn. |
| `setMove(0..1)` | Walk cycle (legs, arms, bob, twist). 1 is a brisk walk of about 1.6 m/s. Blends in and out smoothly. |
| `wave()`, `celebrate()`, `sad({hold:true})`, `cheer()` | One-shot actions with an expression. `play(name, {duration, hold, onDone})` is the general form. `stopAction()` ends one. |
| `lookAt(vec3 \| object3D \| null)` | Head (and a little torso) turns to a world point. Clamped to about ±70°. |
| `setExpression('smile' \| 'happy' \| 'joy' \| 'sad' \| 'wow' \| null)` | Overrides the face; `null` returns to automatic. |
| `setHelmet(true \| false \| null)` | Puts the helmet on or off, for example on for the launch film. `null` follows the appearance. |
| `joints` | `{ hips, torso, neck, head, shL, shR, elL, elR, hipL, hipR, knL, knR, ftL, ftR, handL, handR, helmet }` for attaching props. |
| `ready` | Promise: patch art and fonts drawn. |
| `seek(seconds)` | Advances the animation (for screenshots). |
| `triangles()` | Visible triangle count. |
| `dispose()` | Frees everything and removes the group from its parent. |

`prefers-reduced-motion` stops the idle sway and glances. Actions still play, because the player asks for them.

## 5. HQ campus: walking around and entering buildings (js/3d/hq.js)

> **Current state:** walking in third person is now the HQ default, and the old overview is the campus map (M key). Six staff (`content/staff.js`, `js/3d/npc.js`) walk the plaza and talk to the player. The astronaut also works in the hands-on designer, the test hall (`testlab`) and on launch day (`launchday`). The snippets below are the original integration notes.

The campus is already in metres: Mission Control is a 30 m block and the plaza is about 116 × 104 m. The overview camera sits about 250 m away, where a 1.75 m person is only a few pixels tall. Walking therefore needs a closer follow camera. Below is a complete recipe written against the current `createHQ`.

**a) Imports and the character.** These go at the top of `hq.js` and inside `createHQ` after `refreshProxy()`:

```js
import { createAstronaut, createWalker } from './astronaut.js';

// Walkable area = the plaza (its shape is rr(-70, -48, 116, 104) rotated onto the ground: x -70..46, z -56..48).
const WALK = { minX: -66, maxX: 42, minZ: -52, maxZ: 44 };
const astro = createAstronaut(SMD.avatar ? SMD.avatar.get() : null);
astro.group.position.set(CENTER.x, 0.06, CENTER.z + 18); // on the plaza (its top is y = 0.06)
astro.group.rotation.y = Math.PI; // facing the buildings
scene.add(astro.group);

// Buildings are circles to walk around; each has a door point facing the plaza centre.
const tmpC = new THREE.Vector3();
const obstacles = picks.filter((p) => p.id !== 'pad').map((p) => {
  p.box.getCenter(tmpC);
  return { x: tmpC.x, z: tmpC.z, r: Math.max(4, p.radius - 6) };
});
const doors = {};
picks.forEach((p) => {
  p.box.getCenter(tmpC);
  const dx = CENTER.x - tmpC.x;
  const dz = CENTER.z - tmpC.z;
  const d = Math.hypot(dx, dz) || 1;
  const r = Math.max(4, p.radius - 6) + 1.2;
  doors[p.id] = { x: tmpC.x + (dx / d) * r, z: tmpC.z + (dz / d) * r };
});
const walker = createWalker(astro, { speed: 3.2, area: WALK, obstacles }); // 3.2 m/s keeps the campus brisk
```

**b) Click-to-move and entering buildings.** In `onUp`, replace `if (id && opts.onPick) opts.onPick(id);` so that a building click walks to its door and enters on arrival, and a ground click walks there:

```js
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.06);
const hit = new THREE.Vector3();
// inside onUp, when !down.dragged:
const id = pickAt(e);
if (id && walking) {
  const door = doors[id];
  walker.goTo(door.x, door.z, () => {
    astro.lookAt(null);
    opts.onPick && opts.onPick(id); // the HQ opens the screen exactly as before
  });
} else if (id) {
  opts.onPick && opts.onPick(id);
} else if (walking && ray.ray.intersectPlane(groundPlane, hit)) {
  walker.goTo(hit.x, hit.z);
}
```

`pickAt` already called `ray.setFromCamera`, so `ray.ray` is ready to use. The pad sits off the plaza; for it, keep the immediate `onPick` or extend `WALK` along the crawlerway. The HTML pins (`.hq-pin`) keep working as direct shortcuts.

**c) WASD and arrows**, relative to the camera. Call `input.capture(true)` from the engine while the HQ is mounted, and `input.capture(false)` in `dispose`. Then in `update(dt)`:

```js
import { input } from './engine.js'; // at the top

const f = (input.any('KeyW', 'ArrowUp') ? 1 : 0) - (input.any('KeyS', 'ArrowDown') ? 1 : 0);
const s = (input.any('KeyD', 'ArrowRight') ? 1 : 0) - (input.any('KeyA', 'ArrowLeft') ? 1 : 0);
// The camera looks along (-sin yaw, -cos yaw); its right is (cos yaw, -sin yaw).
if (f || s) walker.setInput(-Math.sin(camYaw) * f + Math.cos(camYaw) * s, -Math.cos(camYaw) * f - Math.sin(camYaw) * s);
else if (!walker.target) walker.setInput(0, 0);
walker.update(dt); // also calls astro.update(dt)

// Door triggers for keyboard walkers: stepping onto a door enters the building.
const pos = astro.group.position;
for (const [id, d] of Object.entries(doors)) {
  if (Math.hypot(d.x - pos.x, d.z - pos.z) < 1.4 && lastDoor !== id) {
    lastDoor = id;
    opts.onPick && opts.onPick(id);
  }
}
if (lastDoor && Math.hypot(doors[lastDoor].x - pos.x, doors[lastDoor].z - pos.z) > 3) lastDoor = null;
```

**d) Follow camera.** Add a `walking` mode next to the overview orbit and blend between them, so the existing framing and insets keep working:

```js
let walking = false;
let walkK = 0; // 0 = overview, 1 = follow
const follow = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
let camYaw = baseYaw;
function setWalking(on) { walking = on; } // expose in the returned object; screen-hq.js toggles it

// in update(dt), after the overview camera is positioned:
walkK += ((walking ? 1 : 0) - walkK) * Math.min(1, dt * 2.5);
if (walkK > 0.001) {
  const p = astro.group.position;
  camYaw = baseYaw + yawUser;           // dragging still turns the view
  const back = 11, up = 6.5;            // about 12 m behind and above: the astronaut is about 1/5 of the screen height
  const want = new THREE.Vector3(p.x + Math.sin(camYaw) * back, p.y + up, p.z + Math.cos(camYaw) * back);
  follow.pos.lerp(want, Math.min(1, dt * 3));
  follow.look.lerp(new THREE.Vector3(p.x, p.y + 1.2, p.z), Math.min(1, dt * 5));
  camera.position.lerp(follow.pos, walkK);
  const lookNow = look.clone().lerp(follow.look, walkK);
  camera.lookAt(lookNow);
}
```

Set `follow.pos` and `follow.look` from the astronaut once when walking starts, so the blend has a sensible start point. The camera's `near` is 1 m today; use `camera.near = walking ? 0.2 : 1` (then `updateProjectionMatrix()`), or the character clips at close range. The sun's shadow camera covers ±150 m at 2048², which is too coarse for a 1.75 m figure. The blob shadow under the feet grounds it, so real shadows are optional.

**e) Life on the campus (optional).** Call `astro.lookAt(buildingAnchor)` while a building is hovered. Call `astro.wave()` when the HQ opens. Call `astro.celebrate()` on the `approvedProjectId` celebration that `screen-hq.js` already does.

**f) Dispose.** Call `astro.dispose()` in `createHQ().dispose`. `engine.stop()` also disposes the scene tree, so this mainly releases the canvas textures.

## 6. Designer: replace the 1.75 m scale person (js/3d/designer.js)

Replace `makePerson()` (lines 58–90) with the astronaut. Turn the helmet off so the scale reads exactly 1.75 m to the top of the head, matching the 1.75 m rod:

```js
import { createAstronaut } from './astronaut.js';

// in createDesigner, instead of `const person = makePerson();`
const astro = createAstronaut(SMD.avatar ? SMD.avatar.get() : null, { helmet: false, blob: false });
const person = astro.group; // the existing layout code positions `person` and the rod unchanged
// in the designer's per-frame update:
astro.update(dt);
astro.lookAt(turntable); // looks up at the spacecraft (turntable is the spacecraft's group)
// in dispose:
astro.dispose();
```

`layout()` already sets `person.position` and `person.rotation.y = -0.5`. Keep both. When a big part pops in, `astro.play('cheer')` is a nice touch. In the old figure, a person with `hair: 'helmet'` would be bald with the helmet off; this figure wears the comms cap instead.

## 7. Films and results: reactions

**Results screen (2D, cheapest).** A portrait with the matching expression:

```js
import(new URL('js/3d/astronaut.js', document.baseURI).href).then((m) =>
  m.createPortrait(SMD.avatar.get(), 256, { expression: won ? 'joy' : lost ? 'sad' : 'happy', background: null })
).then((url) => { img.src = url; });
```

`createPortrait` uses one small offscreen renderer of its own. It does not touch the shared renderer or the mounted scene. The renderer is released 4 s after the last portrait, and results are cached by appearance and size. Without WebGL it returns the 2D drawing. `SMD.avatar.portrait(a, size)` is the same thing from classic scripts, without the options.

Then announce new ranks and badges and mark them as seen:

```js
const ev = SMD.avatar.evaluate();
if (ev.rankUp) SMD.ui.toast(SMD.t('avatar.toast.rank', 'Promoted: {rank}', { rank: ev.rank.name }));
ev.newlyEarned.forEach((b) => SMD.ui.toast(SMD.t('avatar.toast.badge', 'Badge earned: {name}', { name: b.name })));
SMD.avatar.acknowledge();
```

Show `SMD.avatar.badgeSVG(b.id, true)` next to each one. The two toast keys above are new; add them to `ar.js` with the others.

**Films (3D).** For example, the director at the pad or in mission control:

```js
const astro = createAstronaut(SMD.avatar.get(), { helmet: kind === 'launch' ? false : null });
astro.group.position.set(x, groundY, z);
astro.group.rotation.y = Math.atan2(padX - x, padZ - z); // face the rocket
scene.add(astro.group);
astro.lookAt(rocketGroup);                 // follows the rocket as it climbs
// on the cue for success / loss:
astro.celebrate();  // or: astro.sad({ hold: true });
// each frame: astro.update(dt)
```

Night scenes have no studio environment. The visor and metal still take the shared `studioEnv()` by default, so they keep their reflections.

**HUD badge.** Use `SMD.avatar.portrait(SMD.avatar.get(), 96)` in a 48 px circle, and refresh it on `SMD.bus.on('avatar', …)`.

## 8. Strings (SMD.t keys)

All the keys are under `avatar.*` and are string literals, so `tools/i18n-extract.mjs` finds them:

- **Screen:** `avatar.kicker`, `avatar.title`, `avatar.title.edit`, `avatar.lede`, `avatar.stage`, `avatar.stage.a`, `avatar.poses`, `avatar.pose.wave`, `avatar.pose.celebrate`, `avatar.pose.walk`, `avatar.random`, `avatar.cancel`, `avatar.confirm`, `avatar.confirm.hq`.
- **Fields:** `avatar.name`, `avatar.defaultName`, `avatar.suit`, `avatar.skin`, `avatar.hair`, `avatar.hairColor`, `avatar.hairColor.covered`, `avatar.hairColor.helmet`, `avatar.visor`, `avatar.visor.hint`, `avatar.patch`, `avatar.patch.none`, `avatar.patchColor`, `avatar.patchColor.scarf`.
- **Options:** `avatar.suit.{classic,gold,teal,navy,orange,lavender}`, `avatar.skin.{1..6}`, `avatar.hair.{short,curly,bun,covered,helmet}`, `avatar.hc.{black,brown,auburn,blond,grey}`, `avatar.visor.{clear,gold}`, `avatar.patch.{agency,mission}`, `avatar.pc.{teal,lapis,red,violet,green,graphite}`.
- **Career:** `avatar.rank.kicker`, `avatar.rank.ladder`, `avatar.rank.next` (`{rank}`, `{need}`), `avatar.rank.top`, `avatar.rank.{candidate,engineer,specialist,commander,director,legend}` and each one's `.need`, `avatar.badges`, `avatar.badge.locked` (`{name}`), `avatar.badge.{firstLaunch,firstHeadline,homePlanet,moon,mars,venus,europa,onBudget,thorough,comeback,allDiscoveries}` and each one's `.d`.

The 3D name tag prints the player's name in Latin capitals with Archivo. Arabic names render in the fallback font, and the creator's text uses logical properties for right-to-left.

## 9. Known limits

- The name tag on the chest is a 256 × 64 canvas. Very long names shrink to fit, down to about 30% size.
- The 'mission' patch is drawn from the SVG asynchronously. Until it loads (a few ms), the agency patch shows.
- Animations are procedural (no skinning). Joints are separate rigid parts, so extreme poses can show small gaps at the elbows and knees.
