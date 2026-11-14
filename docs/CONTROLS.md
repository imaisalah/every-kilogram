# One character controller for the whole game (shared spec)

Goal: moving the astronaut feels like a modern third-person game (Assassin's Creed, The Last of Us, Uncharted): the camera sits over the shoulder, the mouse or right stick turns it, WASD / left stick moves relative to the camera, the character accelerates, turns and stops smoothly, Shift runs, one key interacts with whatever is in front of you. Same controls on every screen that has the astronaut: HQ, designer (hands mode), test hall, launch day, story mode and survival segments.

## Module: `js/3d/controller.js` (ES module)

```js
import { createController } from './controller.js';
const ctl = createController({
  camera,                 // THREE.PerspectiveCamera owned by the scene
  dom,                    // the canvas (pointer events, pointer lock)
  character,              // object from createAstronaut()
  mode: 'ground',         // 'ground' | 'zeroG' (floating in the capsule)
  walkable: {             // ground mode: where the feet may go
    bounds: { minX, maxX, minZ, maxZ } | null,
    circles: [{ x, z, r }],          // round obstacles
    boxes: [{ minX, maxX, minZ, maxZ }],
    clamp: (pos) => pos,             // optional custom constraint
  },
  volume: { min: Vector3, max: Vector3 }, // zeroG mode: the cabin box
  cameraColliders: [Object3D],            // meshes the camera must not pass through
  camera: { distance: 4.2, height: 1.55, shoulder: 0.45, min: 1.2, max: 9, pitch: [-0.35, 1.1], fov: 55 },
  speeds: { walk: 1.9, run: 4.6, accel: 9, turn: 10 },
  interactables: [{ id, at: Vector3 | Object3D, radius: 1.6, label: 'Inspect', onInteract: () => {} }],
});
// every frame
ctl.update(dt);
// API
ctl.setEnabled(bool);               // false while a UI card is open (input ignored, camera holds)
ctl.setInteractables(list);
ctl.moveTo(point, { onArrive, run });  // scripted/auto walk (also tap-to-walk on phones)
ctl.teleport(position, yaw);
ctl.focus(target, { distance, duration }); // cinematic: frame a target, then return
ctl.release();                       // exit pointer lock
ctl.on('interact' | 'near' | 'far' | 'arrive', fn); // near: (item) when an interactable becomes the current target
ctl.state;                           // { speed, running, grounded, target (current interactable), locked }
ctl.dispose();
```

## Feel (non-negotiable)

- **Camera:** third person over the right shoulder, smooth damping, collision (pulls in instead of clipping through walls), auto-recenters gently behind the character while moving if the player hasn't touched the camera for ~1.5 s. Zoom with the wheel / pinch within limits.
- **Look:** mouse look while the right button is held, or after clicking the canvas (pointer lock; Esc releases, with a small "click to look around" hint). Left-drag on empty ground also looks. Sensitivity setting and invert-Y in Settings (`SMD.settings.lookSpeed`, `SMD.settings.invertY`).
- **Move:** WASD / arrows relative to the camera, Shift (or holding the stick far) runs, character turns toward the movement direction with smoothing, accelerates/decelerates, slides along obstacles instead of sticking, never walks through walls. Walk/run animations match ground speed (no foot sliding). Space: a small hop on the ground.
- **Interact:** the nearest interactable in front of the character (within radius and ~70° of facing) becomes the target: a floating prompt "E  Inspect" plus a soft highlight. E / Enter / gamepad A / tapping the prompt interacts. Q / Esc / gamepad B backs out of cards.
- **Gamepad** (Gamepad API, Xbox layout): left stick move, right stick camera, A interact, B back, RT or left-stick click run, LB/RB cycle targets, Start = menu.
- **Touch (phones):** a virtual joystick appears where the left thumb touches the left half; dragging on the right half turns the camera; the interact prompt is a big button; tapping the ground still auto-walks there.
- **zeroG mode:** float with inertia; WASD moves relative to the camera, Space up, Ctrl / C down, slow damping, gentle collisions with the cabin walls; grab handholds via interact.
- **Accessibility:** everything also works with keyboard only, reduced motion lowers camera sway/bob, a "Controls" help card (H or ?) shows the bindings for the current input device and switches automatically (keyboard / gamepad / touch icons).

## Who uses it

HQ campus, designer hands mode, test hall, launch day pad and firing room, story-mode scenes where the player walks, survival segments (zeroG). Screen-specific features (doors, racks, stations, pins) become `interactables`; existing click-to-walk stays as `moveTo`.

## Update: the camera follows on its own (binding)

The user: "the camera should move by itself with my movement, like real games". So the camera is **automatic by default**; the mouse/right stick only adjusts it.

- While the character moves, the camera **continuously swings behind the direction of travel** (yaw follows the character's heading with a smooth lag, faster when running, a dead zone for small turns, never snapping). It does not wait for an idle timer.
- **Look-ahead:** the camera target leads slightly in the direction of motion; a little more distance and FOV when running (speed feel), back to normal when walking/stopping.
- **Strafing/back-pedalling** (S or moving toward the camera) does not spin the camera around: auto-follow only engages for forward-ish movement.
- **Manual override:** when the player turns the camera with the mouse/stick, auto-follow pauses for ~1.2 s after they stop, then eases back in while moving.
- **Smart framing:** near walls/doors the camera rises and moves to keep the character visible (no clipping); in tight interiors (capsule, firing room) it pulls closer and higher automatically; when an interactable is targeted it nudges slightly to keep both in frame.
- **Comfort:** no camera bob in reduced motion; settings: "Camera follows automatically" (on by default), look speed, invert Y.
- **Character feel:** responsive (≤100 ms to start moving), momentum without sluggishness, turn-in-place on sharp direction changes, stops cleanly, footsteps sound synced to steps (SMD.audio, soft).

## As built (js/3d/controller.js): what is extra or different

Everything in the sketch above works as written, with these notes. HQ (`js/3d/hq.js`), designer hands mode (`js/3d/designer.js`), test hall (`js/3d/testlab.js`) and launch day (`js/3d/launchday.js`) all use it; read them for working examples.

**Options.** The sketch has two `camera` keys, which one JS object cannot hold: `camera` is the THREE camera and the rig block is spelled **`rig`** (`{ distance, height, shoulder, min, max, pitch: [lo, hi], pitch0, fov, floorY, bounds: { minX, maxX, minZ, maxZ, maxY }, tight }`; `bounds` keeps the camera inside a hall, `tight: true` forces the close interior framing). Other options:
- `walkable` also takes `inside: { x, z, r }` (a round area, e.g. the pad apron). `circles` and `boxes` are read live each frame, so moving obstacles (people) can update their `x`/`z` in place.
- Camera collision: `cameraCircles: [{ x, z, r, h, y0 }]` (footprints with a height, cheap), `cameraBoxes: [{ minX, maxX, minY, maxY, minZ, maxZ }]` (racks, walls, cheap), `cameraColliders: [Object3D]` (raycast, costlier; keep the meshes simple), `cameraClear(origin, dir, want) → distance` (your own test, like the HQ footprints).
- `applyCamera: false`: the controller computes the pose (`ctl.view = { position, target, fov }`) but the scene applies it (the HQ blends it with the campus map, launch day with its opening crane). Call `ctl.syncOverlay()` after you set the camera so the prompt sits on the right spot.
- `yaw` (initial camera yaw), `enabled` (start disabled), `radius` (feet, 0.3 m), `targetAngle` (radians either side of facing for targets; the designer uses `Math.PI` so where you stand decides, as before), `overlay` (element for the prompt, joystick and hint; default the canvas's parent; `false` for none), `prompt: false`, `joystick: false`, `hint: false`, `zoom: false`, `pointerLock: false`, `tapToWalk: true` (walk where a tap lands if no tap handler took it), `autoCamera: false`, `footsteps: false`, `bodyHeight` (zeroG cabin clearance).

**Interactables.** `{ id, at, radius, label, onInteract }` plus: `label` may be a function (re-read every 0.3 s; `''` hides the prompt but keeps the target), `enabled: bool | () => bool`, `priority` (higher wins over closer), `angle`, `promptAt` (Vector3 or Object3D where the prompt floats) or `promptHeight` (metres above `at`, default 1), `ring` (`false`, or a scale for the soft ground ring under the target), `onHighlight(on)` (your own glow). `ctl.state.target` is the item object you passed. `ctl.refreshTarget()` re-picks at once (after a teleport, or when labels change).

**Taps and clicks.** The controller tells a tap from a drag (mouse, touch, joystick) and emits `ctl.on('tap', (info) => handled)` with `info = { x, y, ndc, pointerType, event, preferLook }`. Return `true` when you used it (picked a building, a rack, a station, or walked). `preferLook` is true when the player walks with the keys: a click on empty ground then captures the mouse (pointer lock) instead of walking, so leave the ground alone and return false. Helpers: `ctl.ray(info)` (a Raycaster through the tap), `ctl.groundPoint(info, y)`, `ctl.mark(point)` (the walk-to ring).

**More events.** `'back'` (Q, gamepad B; Esc stays with each screen's own handler), `'wantmove'` (a movement key pressed while disabled, e.g. a card is open: the HQ ends the conversation, the designer closes the card, and they re-enable), `'menu'` (gamepad Start), `'cancel'` (a scripted walk was overridden or got stuck), `'hop'`, `'lock'` / `'unlock'`, `'zoom'`, `'focusend'`.

**More methods.** `ctl.stop()` (cancel a scripted walk), `ctl.setCameraActive(bool, { instant })` (hand the camera to the scene and back; it blends back from wherever the camera is), `ctl.snapCamera(yaw)`, `ctl.recenter()`, `ctl.camYaw` / `ctl.camPitch` / `ctl.zoom` (get and set), `ctl.setRig(partial)`, `ctl.setWalkable(w)`, `ctl.setCameraShapes({ circles, boxes })`, `ctl.setCameraColliders(list)`, `ctl.setVolume(v)`, `ctl.setMode('ground' | 'zeroG')`, `ctl.setSpeedScale(k)` (the designer slows you by the carried mass), `ctl.teleport(pos, yaw, { camera: 'keep' })` (keep the camera's yaw), `ctl.focus(target, { position, distance, duration, fov, instant })` (`position` frames from a fixed spot, like the test hall's console shots; no `duration` holds until `ctl.focus(null)`), `ctl.debug.key(code, down)` and `ctl.debug.look(dx, dy)` for scripts.
- `ctl.update(dt)` also advances the character's animation (do not call `astro.update` yourself) and must run every frame, also while disabled (scripted walks still move). It takes up to 0.25 s per frame and moves in 34 ms steps.
- `ctl.state` also has `auto` (a scripted walk is on), `moving`, `inputActive` (the player is steering this frame), `device`, `enabled`, `camYaw`, `camPitch`, `distance`, `mode`.

**Enabled.** `setEnabled(false)` stops reading the player's input, releases the pointer lock, hides the prompt and joystick and freezes the target; scripted walks (`moveTo`) and the camera still run. Any open `<dialog>` or `[aria-modal="true"]` also pauses input and releases the lock by itself, so the settings dialog and the Controls card never trap the mouse. With a card open, gamepad A presses the focused button and the d-pad moves the focus.

**Pointer lock.** Mouse-only players keep point-and-click: a click walks or picks, a drag (left or right button) turns the camera. Once you walk with the keys, a click on empty ground captures the mouse (a small "Click to look around" hint; "Esc frees the mouse" once captured); a click while captured interacts. Esc, opening a card or any dialog releases it.

**Touch.** Left half: a touch-and-drag is the joystick (pushed far it runs); right half: a drag looks; both at once work (two thumbs). Two fingers that are not the joystick pinch to zoom. A quick tap anywhere is a tap. On touch devices the joystick rests faintly in the bottom-left corner and the prompt docks as a big button bottom-right.

**Keys not in the sketch.** Z / X turn the camera (keyboard only), R puts the camera behind you, gamepad Y hops, the gamepad View button opens the Controls card.

**The camera follows on its own** (the binding update above). While moving forward-ish the camera swings behind the direction of travel: the rate grows with speed and running, there is a 0.05 rad dead zone, and it fades out past about 70° off the camera's forward, so back-pedalling and strafing never spin it. Turning it yourself pauses that for 1.2 s, then it eases back in over 0.7 s, and the pitch drifts back to `pitch0`. Look-ahead leads the target by about 0.24 s of travel (at most 1.1 m); running pulls back 14 % and widens the lens 5°. Smart framing: a wall behind you first raises the camera (up to three 0.22 rad steps) to look down over it, then moves it in; when the space stays tight (clear distance under 55 % of the wanted one) it settles closer and higher; a target in front nudges the look point toward it. Reduced motion: no bob, no lens change, a slower swing. Setting: `SMD.settings.autoCamera` (Settings, "Camera follows automatically", on by default).

**Character feel.** Acceleration 12/s (about 70 % of walking speed after 0.1 s), stops 1.6 times faster than it starts, turns on the spot first when reversing from a standstill, leans into turns. Footsteps: the astronaut calls `onStep({ run, speed })` as each foot lands; the controller plays a soft low `SMD.audio.beep` (silent when the game sound is off).

**Astronaut additions** (`js/3d/astronaut.js`, all backward compatible):
- `setSpeed(mps)`: walk and run cycles blended by the real speed, cadence matched to it. `setMove(v)` is now `setSpeed(v * 1.6)`, and `createWalker` passes the real speed too.
- `setLean(rad)`, `hop()` (also `play('hop')`). The start and stop lean comes from the speed change by itself.
- Carrying is a held layer: `play('carry', { hold: true, spread })`, `carry({ spread })`, `carry(false)`, `stopAction('carry')`. Actions like cheer play over it; the designer no longer overrides joints.
- `setFloat(bool)` and `setSwim(0..1)` (the zero-g pose), `onStep`, and the getters `mps`, `carrying`, `floating`.

**Settings.** `SMD.settings.lookSpeed` (0.3 to 3, default 1), `invertY`, `autoCamera`; all saved in `ek-settings` and shown in the Settings dialog's Camera row.

**Help card.** `js/controls-help.js`: `SMD.controls.help.open(device?)`, `close()`, `toggle()`, `isOpen`. H or ? opens it on any screen while a controller is alive (`SMD.controls.active`); it follows `SMD.controls.device` (`'keyboard' | 'gamepad' | 'touch'`, bus event `'controls-device'`) and has tabs for the other devices. The HQ menu has Controls and Settings entries. Styles are in `css/controls.css` (`.ctl-*`); a screen moves the joystick and hints above its own bottom bar with the CSS variable `--ctl-safe-bottom`.

**zeroG (for survival segments).** `mode: 'zeroG'` and `volume: { min, max }` (the cabin box; the character's feet are its origin, `bodyHeight` keeps the head inside). Thrust with inertia and slow drag, gentle bounces off the walls, Space and C / Ctrl (gamepad RB / LB) for up and down, W toward where the camera looks (pitch included). The astronaut floats (`setFloat`). Handholds are interactables whose `onInteract` does the grab (for example `ctl.moveTo(handhold, { tolerance: 0.2 })`; `moveTo` flies in 3D in this mode). No screen uses it yet, so expect tuning.

**Tests.** `tests/controller.test.js` loads the pure parts (`camRelative`, `resolveGround`, `pickTarget`, `clearCircles`, `clearBoxes`) without THREE.
