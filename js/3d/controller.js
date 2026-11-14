// One third-person character controller for every screen with the astronaut
// (docs/CONTROLS.md is the spec): an over-the-shoulder camera that the mouse,
// the right stick or a drag turns; WASD / the left stick / a thumb joystick
// move relative to the camera; Shift (or the stick held far) runs; E / A / a
// tap on the prompt interacts with whatever is in front of you. The same code
// runs the HQ campus, the designer's hands mode, the test hall and launch day,
// and story mode and survival segments adopt it the same way.
//
// The pure parts (camera-relative direction, sliding along obstacles, target
// picking, camera clearance) are exported for tests/controller.test.js; they
// never touch THREE, so the test can load this file without the import map.
import { THREE } from './engine.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth01 = (k) => k * k * (3 - 2 * k);
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- Pure math ----------
// The camera sits at `camYaw` around the character (offset (sin, cos) of the
// yaw on the ground) and looks back along (-sin yaw, -cos yaw). Forward input
// f and sideways input s (both -1..1) become a world direction on the ground.
export function camRelative(f, s, camYaw) {
  const sy = Math.sin(camYaw);
  const cy = Math.cos(camYaw);
  let x = -sy * f + cy * s;
  let z = -cy * f - sy * s;
  const l = Math.hypot(x, z);
  if (l > 1) {
    x /= l;
    z /= l;
  }
  return { x, z };
}

// Push a foot position {x, z} out of round obstacles and boxes, then keep it
// inside the bounds and the custom clamp. Pushing out along the contact normal
// keeps the sideways part of a step, so the character slides along walls and
// around pillars instead of sticking. Mutates and returns p.
export function resolveGround(p, walk, radius = 0.3) {
  if (!walk) return p;
  for (let it = 0; it < 4; it++) {
    let moved = false;
    const cs = walk.circles;
    if (cs)
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (!c) continue;
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const min = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        if (d > 1e-6) {
          p.x = c.x + (dx / d) * min;
          p.z = c.z + (dz / d) * min;
        } else p.x = c.x + min;
        moved = true;
      }
    const bs = walk.boxes;
    if (bs)
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        if (!b) continue;
        const cx = clamp(p.x, b.minX, b.maxX);
        const cz = clamp(p.z, b.minZ, b.maxZ);
        const dx = p.x - cx;
        const dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * radius;
          p.z = cz + (dz / d) * radius;
        } else {
          // Inside the box: out through the nearest side.
          const l = p.x - b.minX;
          const r = b.maxX - p.x;
          const n = p.z - b.minZ;
          const f = b.maxZ - p.z;
          const m = Math.min(l, r, n, f);
          if (m === l) p.x = b.minX - radius;
          else if (m === r) p.x = b.maxX + radius;
          else if (m === n) p.z = b.minZ - radius;
          else p.z = b.maxZ + radius;
        }
        moved = true;
      }
    const B = walk.bounds;
    if (B) {
      const x = clamp(p.x, B.minX, B.maxX);
      const z = clamp(p.z, B.minZ, B.maxZ);
      if (x !== p.x || z !== p.z) {
        p.x = x;
        p.z = z;
      }
    }
    if (walk.inside) {
      // A round walkable area (a launch pad apron).
      const a = walk.inside;
      const dx = p.x - a.x;
      const dz = p.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > a.r) {
        p.x = a.x + (dx / d) * a.r;
        p.z = a.z + (dz / d) * a.r;
      }
    }
    if (walk.clamp) {
      const q = walk.clamp(p);
      if (q && q !== p) {
        p.x = q.x;
        p.z = q.z;
      }
    }
    if (!moved) break;
  }
  return p;
}

// The interactable to aim at: within its radius and within `angle` radians of
// where the character faces (ignored when standing right on it). Higher
// `priority` wins; then the closest and most straight-ahead. `current` keeps
// the target you already have unless another is clearly better (no flicker).
// items: [{ id, x, z, radius, angle, priority, enabled }]
export function pickTarget(pos, yaw, items, opts = {}) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  let best = null;
  let bestScore = Infinity;
  let bestPri = -Infinity;
  let curScore = Infinity;
  let curPri = -Infinity;
  const cur = opts.current || null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || it.enabled === false) continue;
    const dx = it.x - pos.x;
    const dz = it.z - pos.z;
    // Floating (zero-g): things stacked above each other are told apart by height too.
    const dy = opts.vertical ? (it.y || 0) - ((pos.y || 0) + (opts.eye != null ? opts.eye : 1)) : 0;
    const d = Math.hypot(dx, dz, dy);
    const r = it.radius != null ? it.radius : 1.6;
    if (d > r) continue;
    const half = it.angle != null ? it.angle : opts.angle != null ? opts.angle : 1.22; // about 70°
    let off = 0;
    if (d > (opts.close != null ? opts.close : 0.6)) {
      const dh = Math.hypot(dx, dz);
      off = dh > 1e-4 ? Math.acos(clamp((dx * fx + dz * fz) / dh, -1, 1)) : 0;
      if (off > half) continue;
    }
    const pri = it.priority || 0;
    const score = d / Math.max(0.01, r) + (off / Math.PI) * 0.8;
    if (cur && (it === cur || (cur.id != null && it.id === cur.id))) {
      curScore = score;
      curPri = pri;
    }
    if (pri > bestPri || (pri === bestPri && score < bestScore)) {
      bestPri = pri;
      bestScore = score;
      best = it;
    }
  }
  if (best && cur && best !== cur && curScore < Infinity && curPri >= bestPri && curScore < bestScore + 0.18) {
    return items.find((it) => it === cur || (cur.id != null && it && it.id === cur.id)) || best;
  }
  return best;
}

// How far a camera can sit from origin o along unit direction d before it
// meets a vertical cylinder { x, z, r, h, y0 } (a building footprint).
export function clearCircles(o, d, want, circles, margin = 0.35, min = 0.8) {
  let best = want;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8 || !circles) return best;
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    if (!c) continue;
    const fx = o.x - c.x;
    const fz = o.z - c.z;
    const b = 2 * (fx * d.x + fz * d.z);
    const cc = fx * fx + fz * fz - c.r * c.r;
    const disc = b * b - 4 * a * cc;
    if (disc <= 0) continue;
    let s = (-b - Math.sqrt(disc)) / (2 * a);
    if (s < 0) {
      if (cc > 0) continue; // behind the camera
      s = 0; // the origin is inside the footprint (under an overhang)
    }
    const y = o.y + d.y * s;
    if (s >= best || y > (c.h != null ? c.h : 1e9) + 0.3 || y < (c.y0 || -1e9)) continue;
    best = Math.max(min, s - margin);
  }
  return best;
}

// The same against axis-aligned boxes { minX, maxX, minY, maxY, minZ, maxZ }
// (racks, walls). A box that holds the origin is ignored.
export function clearBoxes(o, d, want, boxes, margin = 0.3, min = 0.8) {
  let best = want;
  if (!boxes) return best;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b) continue;
    if (o.x > b.minX && o.x < b.maxX && o.y > (b.minY != null ? b.minY : -1e9) && o.y < (b.maxY != null ? b.maxY : 1e9) && o.z > b.minZ && o.z < b.maxZ) continue;
    let t0 = 0;
    let t1 = best;
    const axes = [
      [o.x, d.x, b.minX, b.maxX],
      [o.y, d.y, b.minY != null ? b.minY : -1e9, b.maxY != null ? b.maxY : 1e9],
      [o.z, d.z, b.minZ, b.maxZ],
    ];
    let hit = true;
    for (let k = 0; k < 3 && hit; k++) {
      const [oo, dd, lo, hi] = axes[k];
      if (Math.abs(dd) < 1e-9) {
        if (oo < lo || oo > hi) hit = false;
        continue;
      }
      let ta = (lo - oo) / dd;
      let tb = (hi - oo) / dd;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) hit = false;
    }
    if (hit && t0 < best) best = Math.max(min, t0 - margin);
  }
  return best;
}

// ---------- Shared state for every controller (and js/controls-help.js) ----------
const C = (SMD.controls = SMD.controls || {});
C.active = C.active || 0;
C.device = C.device || 'keyboard';
function setDevice(dev) {
  if (C.device === dev) return;
  C.device = dev;
  if (SMD.bus) SMD.bus.emit('controls-device', dev);
}
const tr = (k, en, p) => (SMD.t ? SMD.t(k, en, p) : en.replace(/\{(\w+)\}/g, (m, n) => (p && p[n] != null ? p[n] : m)));
const reducedMotion = () => {
  try {
    if (SMD.settings && SMD.settings.reducedMotion !== undefined) return !!SMD.settings.reducedMotion;
  } catch (e) {}
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
};
const lookSpeed = () => {
  const v = SMD.settings && Number(SMD.settings.lookSpeed);
  return v > 0 ? clamp(v, 0.2, 4) : 1;
};
const invertY = () => !!(SMD.settings && SMD.settings.invertY);
const coarsePointer = () => {
  try {
    return matchMedia('(pointer: coarse)').matches;
  } catch (e) {
    return false;
  }
};

// Keys never move the character while the player types, uses a menu, or has a
// control focused with the keyboard (a button clicked with the mouse does not count).
function typing(a) {
  if (!a || a === document.body) return false;
  return !!(a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || (a.getAttribute && a.getAttribute('role') === 'menuitem'));
}
function keyFocused(a) {
  if (!a || a === document.body || !/^(BUTTON|A|SUMMARY)$/.test(a.tagName)) return false;
  try {
    return a.matches(':focus-visible');
  } catch (e) {
    return true;
  }
}
function modalOpen() {
  try {
    return !!document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])');
  } catch (e) {
    return false;
  }
}

const MOVE_KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };

// ---------- The controller ----------
// See docs/CONTROLS.md. The second `camera` block of the spec sketch is
// spelled `rig` here (a JS object cannot have two `camera` keys).
export function createController(o = {}) {
  const camera = o.camera && o.camera.isCamera ? o.camera : null;
  const dom = o.dom || null;
  const ch = o.character;
  const g = ch.group;
  const R = Object.assign({ distance: 4.2, height: 1.55, shoulder: 0.45, min: 1.2, max: 9, pitch: [-0.35, 1.1], fov: 55, pitch0: 0.3, floorY: null, bounds: null }, o.rig || o.cameraRig || (o.camera && !o.camera.isCamera ? o.camera : null) || {});
  const S = Object.assign({ walk: 1.9, run: 4.6, accel: 12, turn: 11, float: 1.3 }, o.speeds || {});
  let mode = o.mode === 'zeroG' ? 'zeroG' : 'ground';
  let walk = Object.assign({ bounds: null, circles: [], boxes: [], clamp: null }, o.walkable || {});
  let volume = o.volume || null;
  const radius = o.radius || 0.3;
  let colliders = o.cameraColliders || [];
  let camCircles = o.cameraCircles || null;
  let camBoxes = o.cameraBoxes || null;
  const camClear = typeof o.cameraClear === 'function' ? o.cameraClear : null;
  let items = [];
  const listeners = {};
  const ray = new THREE.Raycaster();

  // ----- State -----
  let enabled = o.enabled !== false;
  let camActive = o.applyCamera !== false;
  let disposed = false;
  let speedScale = 1;
  const vel = new THREE.Vector3();
  let speedNow = 0; // ground speed actually covered (m/s)
  let running = false;
  let grounded = true;
  let hopT = 0;
  let auto = null; // { x, y, z, onArrive, run, tol, speed, stuck, best }
  let target = null; // the current interactable (wrapped record)
  let manual = false; // movement input this frame
  let lastManual = -10;
  let kbWalk = !!o.clickToLock; // the player walks with the keys (or the screen asks for it): a click captures the mouse
  let moveOn = true; // setMoveEnabled(false): hold still, keep looking around
  let camYaw = o.yaw != null ? o.yaw : g.rotation.y + Math.PI;
  let camPitch = clamp(R.pitch0, R.pitch[0], R.pitch[1]);
  let dist = clamp(R.distance, R.min, R.max);
  let distNow = dist;
  let lastCamTouch = -10;
  let recenterT = 0;
  let time = 0;
  let stepPhase = 0;
  let fovNow = R.fov;
  let yawPrev = g.rotation.y;
  let lean = 0;
  const pivot = new THREE.Vector3();
  const view = { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: R.fov };
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const dirV = new THREE.Vector3();
  const rightV = new THREE.Vector3();
  const tmpP = { x: 0, z: 0 };
  let modal = false;
  let modalCheck = 0;
  let snap = true;

  const emit = (name, a, b) => {
    const l = listeners[name];
    let ret = false;
    if (l)
      l.slice().forEach((fn) => {
        try {
          if (fn(a, b) === true) ret = true;
        } catch (err) {
          console.warn(`controller ${name} handler failed`, err);
        }
      });
    return ret;
  };

  // ----- Keyboard -----
  const held = new Set();
  let pressedHop = false;
  const onKeyDown = (e) => {
    if (disposed) return;
    const code = e.code;
    if (e.metaKey || e.altKey) return;
    if (e.ctrlKey && code !== 'ControlLeft' && code !== 'ControlRight') return;
    const a = document.activeElement;
    if (typing(a) || typing(e.target)) return;
    const live = enabled && !modal;
    const mv = MOVE_KEYS[code];
    if (mv) {
      if (keyFocused(a)) return;
      if (code.startsWith('Arrow') && e.target && e.target.closest && e.target.closest('[data-nowalk], [role="dialog"], dialog')) return;
      setDevice('keyboard');
      if (!live) {
        if (!e.repeat) emit('wantmove', code);
        held.add(code);
        return;
      }
      e.preventDefault();
      held.add(code);
      kbWalk = true;
      return;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyZ' || code === 'KeyX' || code === 'KeyC' || code === 'ControlLeft' || code === 'ControlRight') {
      held.add(code);
      return;
    }
    if (e.repeat) return;
    const onPage = !a || a === document.body || a === dom || (dom && dom.contains && dom.contains(a));
    if (code === 'Space') {
      if (!live || !onPage) return;
      e.preventDefault();
      setDevice('keyboard');
      held.add(code);
      if (mode === 'ground' && moveOn) pressedHop = true;
      return;
    }
    if (code === 'KeyE' || (code === 'Enter' && onPage)) {
      if (!live || keyFocused(a)) return;
      e.preventDefault();
      setDevice('keyboard');
      interact();
      return;
    }
    if (code === 'KeyQ') {
      if (keyFocused(a) && !modal) return;
      setDevice('keyboard');
      emit('back', 'key');
      return;
    }
    if (code === 'KeyR' && live) recenterT = 0.9;
  };
  const onKeyUp = (e) => held.delete(e.code);
  const onBlur = () => {
    held.clear();
    pointers.clear();
    joy = null;
    look = null;
    pinch = null;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // ----- Pointer: look, joystick, pinch, taps, pointer lock -----
  const pointers = new Map(); // id -> { x, y }
  let look = null; // { id, x, y, x0, y0, t, moved, kind }
  let joy = null; // { id, x0, y0, x, y, t, moved }
  let pinch = null; // { d, dist }
  let lookDX = 0;
  let lookDY = 0;
  let locked = false;
  let lockHintT = 0;
  const lockOK = () => !!(dom && dom.requestPointerLock) && o.pointerLock !== false;
  const isUI = (t) => t && t !== dom && t.closest && t.closest('button, a, input, select, textarea, label, [role="button"], [data-ctl-ignore]');
  const rectOf = () => (dom && dom.getBoundingClientRect ? dom.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 });

  function requestLock() {
    if (!lockOK() || locked) return false;
    try {
      const p = dom.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }
  let releasing = false; // the code let go of the mouse (not the player's Esc)
  function release() {
    try {
      if (document.pointerLockElement && document.pointerLockElement === dom) {
        releasing = true;
        document.exitPointerLock();
      }
    } catch (e) {}
  }
  const onLockChange = () => {
    const was = locked;
    locked = !!dom && document.pointerLockElement === dom;
    if (locked && !was) {
      lockHintT = 3.2;
      emit('lock');
    }
    // { byCode: true } when a card, a dialog or setEnabled(false) released it;
    // false when the player pressed Esc (or the window lost focus).
    if (!locked && was) emit('unlock', { byCode: releasing });
    releasing = false;
    paintHint();
  };
  document.addEventListener('pointerlockchange', onLockChange);

  const onDown = (e) => {
    if (disposed || !enabled || modal) return;
    if (isUI(e.target)) return;
    if (locked) {
      if (e.button === 0) {
        e.preventDefault();
        interact();
      }
      return;
    }
    if (e.pointerType === 'touch') setDevice('touch');
    else if (C.device === 'touch' || C.device === 'gamepad') setDevice('keyboard');
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      dom.setPointerCapture(e.pointerId);
    } catch (err) {}
    // Two fingers pinch to zoom, unless one of them is on the joystick (then
    // the other thumb looks around while you walk).
    if (pointers.size >= 2 && !joy) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), dist };
      look = null;
      return;
    }
    const now = performance.now();
    if (e.pointerType === 'touch') {
      const r = rectOf();
      const left = e.clientX - r.left < r.width * 0.5;
      if (left && !joy && o.joystick !== false) {
        joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: now, moved: false };
        return;
      }
      if (look) return; // a third finger
      look = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: now, moved: false, kind: 'touch' };
      return;
    }
    if (e.button === 2) look = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: now, moved: true, kind: 'right' };
    else if (e.button === 0) look = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: now, moved: false, kind: 'left' };
  };
  const onMove = (e) => {
    if (disposed) return;
    if (locked) {
      if (enabled && !modal) {
        lookDX += e.movementX || 0;
        lookDY += e.movementY || 0;
      }
      return;
    }
    if (e.pointerType === 'mouse' && (Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 3) && C.device === 'gamepad') setDevice('keyboard');
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const k = pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
      dist = clamp(pinch.dist * k, R.min, R.max);
      lastCamTouch = time;
      return;
    }
    if (joy && joy.id === e.pointerId) {
      joy.x = e.clientX;
      joy.y = e.clientY;
      if (Math.hypot(joy.x - joy.x0, joy.y - joy.y0) > 8) joy.moved = true;
      return;
    }
    if (look && look.id === e.pointerId) {
      const dx = e.clientX - look.x;
      const dy = e.clientY - look.y;
      if (!look.moved && Math.hypot(e.clientX - look.x0, e.clientY - look.y0) > 6) look.moved = true;
      if (look.moved) {
        lookDX += dx * (look.kind === 'touch' ? 1.25 : 1.5);
        lookDY += look.kind === 'touch' ? dy * 0.9 : dy * 1.5;
      }
      look.x = e.clientX;
      look.y = e.clientY;
    }
  };
  const onUp = (e) => {
    if (disposed) return;
    const was = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    try {
      if (dom.hasPointerCapture && dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    } catch (err) {}
    if (!was) return;
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      if (look && look.id === e.pointerId) look = null;
      if (joy && joy.id === e.pointerId) joy = null;
      return;
    }
    const now = performance.now();
    if (joy && joy.id === e.pointerId) {
      const j = joy;
      joy = null;
      if (!j.moved && now - j.t < 450 && e.type === 'pointerup') tap(e);
      return;
    }
    if (look && look.id === e.pointerId) {
      const l = look;
      look = null;
      if (!l.moved && l.kind !== 'right' && now - l.t < 700 && e.type === 'pointerup') tap(e);
    }
  };
  const onMenu = (e) => {
    if (!isUI(e.target)) e.preventDefault();
  };
  const onWheel = (e) => {
    if (disposed || !enabled || modal || o.zoom === false) return;
    e.preventDefault();
    const steps = clamp(e.deltaY / (e.deltaMode === 1 ? 3 : 100), -3, 3) || Math.sign(e.deltaY);
    dist = clamp(dist * Math.pow(1.12, steps), R.min, R.max);
    lastCamTouch = time;
    emit('zoom', dist);
  };
  let oldTouchAction = '';
  if (dom && dom.addEventListener) {
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('pointercancel', onUp);
    dom.addEventListener('contextmenu', onMenu);
    dom.addEventListener('wheel', onWheel, { passive: false });
    oldTouchAction = dom.style.touchAction;
    dom.style.touchAction = 'none';
  }

  // A tap or a click without a drag. Screens pick what is under it
  // (ctl.on('tap', (info) => …), returning true when they used it); otherwise a
  // keyboard walker's click captures the mouse, and tapToWalk walks there.
  function tap(e) {
    const r = rectOf();
    const info = {
      x: e.clientX,
      y: e.clientY,
      ndc: { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 },
      pointerType: e.pointerType,
      event: e,
      preferLook: e.pointerType === 'mouse' && kbWalk && lockOK(),
    };
    if (emit('tap', info)) return;
    if (info.preferLook && requestLock()) return;
    if (o.tapToWalk && camera) {
      const p = groundPoint(info);
      if (p) {
        moveTo(p);
        markAt(p);
      }
    }
  }
  function rayFrom(info) {
    if (camera) ray.setFromCamera(info.ndc, camera);
    return ray;
  }
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function groundPoint(info, y) {
    plane.constant = -(y != null ? y : g.position.y);
    const out = new THREE.Vector3();
    return rayFrom(info).ray.intersectPlane(plane, out) ? out : null;
  }

  // ----- Gamepad -----
  const pad = { lx: 0, ly: 0, rx: 0, ry: 0, run: false, up: false, down: false, prev: [] };
  const DZ = 0.18;
  const dead = (v) => (Math.abs(v) < DZ ? 0 : (v - Math.sign(v) * DZ) / (1 - DZ));
  function pollPad() {
    pad.lx = pad.ly = pad.rx = pad.ry = 0;
    pad.run = pad.up = pad.down = false;
    let gp = null;
    try {
      const all = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of all) if (p && p.connected) {
        gp = p;
        break;
      }
    } catch (e) {}
    if (!gp) return;
    const ax = gp.axes || [];
    const bt = gp.buttons || [];
    const pr = (i) => !!(bt[i] && (bt[i].pressed || bt[i].value > 0.5));
    pad.lx = dead(ax[0] || 0);
    pad.ly = dead(ax[1] || 0);
    pad.rx = dead(ax[2] || 0);
    pad.ry = dead(ax[3] || 0);
    // The d-pad walks too.
    if (pr(12)) pad.ly = -1;
    if (pr(13)) pad.ly = 1;
    if (pr(14)) pad.lx = -1;
    if (pr(15)) pad.lx = 1;
    pad.run = pr(7) || pr(10);
    const now = bt.map((b, i) => pr(i));
    const edge = (i) => now[i] && !pad.prev[i];
    const any = Math.abs(pad.lx) + Math.abs(pad.ly) + Math.abs(pad.rx) + Math.abs(pad.ry) > 0 || now.some(Boolean);
    if (any) setDevice('gamepad');
    const live = enabled && !modal;
    if (mode === 'zeroG') {
      pad.up = pr(5);
      pad.down = pr(4);
    }
    if (edge(0)) {
      if (live) interact();
      else padClickFocused();
    }
    if (edge(1)) emit('back', 'pad');
    if (live && mode === 'ground') {
      if (edge(4)) cycle(-1);
      if (edge(5)) cycle(1);
      if (edge(3)) pressedHop = true;
    }
    if (edge(9)) emit('menu');
    if (edge(8) && C.help && C.help.toggle) C.help.toggle();
    if (!live && (edge(12) || edge(13) || edge(14) || edge(15))) padFocus(edge(12) || edge(14) ? -1 : 1);
    if (!live) pad.lx = pad.ly = pad.rx = pad.ry = 0;
    pad.prev = now;
  }
  // With a card open, A presses the focused button and the d-pad moves the focus.
  function padClickFocused() {
    const a = document.activeElement;
    if (a && a !== document.body && typeof a.click === 'function' && /^(BUTTON|A|SUMMARY|INPUT)$/.test(a.tagName)) a.click();
  }
  function padFocus(step) {
    const scope = document.querySelector('dialog[open]') || document.querySelector('[aria-modal="true"]:not([hidden])') || document.querySelector('[role="dialog"]:not([hidden])') || document.body;
    const list = [...scope.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')].filter((b) => b.offsetParent !== null);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const n = list[(i + step + list.length) % list.length] || list[0];
    n.focus();
  }

  // ----- Interactables -----
  const recs = []; // { item, x, y, z, radius, angle, priority, enabled, id }
  const atV = new THREE.Vector3();
  function wrapItems(list) {
    recs.length = 0;
    (list || []).forEach((it) => it && recs.push({ item: it, id: it.id, x: 0, y: 0, z: 0, radius: it.radius != null ? it.radius : 1.6, angle: it.angle, priority: it.priority, enabled: it.enabled }));
    refreshPositions();
    // Keep the same target if it is still offered.
    if (target) {
      const same = recs.find((r) => r.item === target.item || (target.id != null && r.id === target.id));
      if (same) target = same;
      else setTarget(null);
    }
  }
  function posOf(at, out) {
    if (!at) return out.set(0, 0, 0);
    if (at.isObject3D) return at.getWorldPosition(out);
    return out.set(at.x || 0, at.y || 0, at.z || 0);
  }
  function refreshPositions() {
    recs.forEach((r) => {
      posOf(r.item.at, atV);
      r.x = atV.x;
      r.y = atV.y;
      r.z = atV.z;
      r.enabled = typeof r.item.enabled === 'function' ? r.item.enabled() !== false : r.item.enabled !== false;
      r.radius = r.item.radius != null ? r.item.radius : 1.6;
    });
  }
  function setTarget(rec) {
    if (rec === target) return;
    const was = target;
    target = rec;
    if (was) {
      if (was.item.onHighlight) was.item.onHighlight(false);
      emit('far', was.item);
    }
    if (rec) {
      if (rec.item.onHighlight) rec.item.onHighlight(true);
      emit('near', rec.item);
    }
    labelT = 0;
    paintPrompt(true);
  }
  let manualPick = null; // LB / RB chose this one
  let manualFrom = null;
  function cycle(step) {
    const p = g.position;
    const list = recs.filter((r) => r.enabled !== false && Math.hypot(r.x - p.x, r.z - p.z) <= r.radius).sort((a, b) => wrapAngle(Math.atan2(a.x - p.x, a.z - p.z) - g.rotation.y) - wrapAngle(Math.atan2(b.x - p.x, b.z - p.z) - g.rotation.y));
    if (!list.length) return;
    const i = list.indexOf(target);
    const n = list[(i + step + list.length * 2) % list.length];
    manualPick = n;
    manualFrom = { x: p.x, z: p.z };
    setTarget(n);
  }
  function chooseTarget() {
    const p = g.position;
    if (manualPick) {
      const ok = recs.includes(manualPick) && manualPick.enabled !== false && Math.hypot(manualPick.x - p.x, manualPick.z - p.z) <= manualPick.radius && Math.hypot(p.x - manualFrom.x, p.z - manualFrom.z) < 1.2;
      if (ok) return manualPick;
      manualPick = null;
    }
    return pickTarget(p, g.rotation.y, recs, { current: target, angle: o.targetAngle, vertical: mode === 'zeroG', eye: o.targetEye });
  }
  function interact(rec) {
    const r = rec || target;
    const item = r ? r.item : null;
    if (item && item.onInteract) {
      try {
        item.onInteract(item);
      } catch (err) {
        console.warn('interact failed', err);
      }
    }
    emit('interact', item);
  }

  // ----- Overlay: the prompt, the joystick, the hint, the target ring -----
  let layer = null;
  let promptEl = null;
  let joyEl = null;
  let hintEl = null;
  let labelT = 0;
  let promptText = '';
  function attach() {
    const parent = o.overlay || (dom && dom.parentElement) || null;
    if (!parent || o.overlay === false) return;
    if (layer && layer.parentElement === parent) return;
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'ctl-layer';
      layer.innerHTML = '<button type="button" class="ctl-prompt" hidden></button><div class="ctl-joy" aria-hidden="true" hidden><span class="ctl-joy-knob"></span></div><p class="ctl-hint" hidden></p>';
      promptEl = layer.querySelector('.ctl-prompt');
      joyEl = layer.querySelector('.ctl-joy');
      hintEl = layer.querySelector('.ctl-hint');
      promptEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (enabled && !modal) interact();
      });
      // Taps on the prompt never become walks or looks.
      promptEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    parent.appendChild(layer);
    paintHint();
  }
  function labelOf(item) {
    try {
      return typeof item.label === 'function' ? item.label(item) || '' : item.label || '';
    } catch (e) {
      return '';
    }
  }
  function glyph() {
    if (C.device === 'gamepad') return '<span class="ctl-pad ctl-pad-a" aria-hidden="true">A</span>';
    if (C.device === 'touch') return '';
    return '<kbd aria-hidden="true">E</kbd>';
  }
  let promptDev = '';
  function paintPrompt(force) {
    if (!promptEl) return;
    const show = !!(target && enabled && !modal && o.prompt !== false);
    const text = show ? labelOf(target.item) : '';
    if (!show || !text) {
      if (!promptEl.hidden) promptEl.hidden = true;
      promptText = '';
      return;
    }
    if (force || text !== promptText || promptDev !== C.device) {
      promptText = text;
      promptDev = C.device;
      promptEl.innerHTML = `${glyph()}<span>${text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])}</span>`;
      promptEl.classList.toggle('is-touch', C.device === 'touch');
      promptEl.setAttribute('aria-label', text);
    }
    promptEl.hidden = false;
  }
  const promptV = new THREE.Vector3();
  function placePrompt() {
    if (!promptEl || promptEl.hidden || !target || !camera) return;
    if (C.device === 'touch') {
      promptEl.style.transform = '';
      promptEl.classList.add('is-dock');
      return;
    }
    promptEl.classList.remove('is-dock');
    const it = target.item;
    if (it.promptAt) posOf(it.promptAt, promptV);
    else promptV.set(target.x, target.y + (it.promptHeight != null ? it.promptHeight : 1.0), target.z);
    promptV.project(camera);
    const w = layer.clientWidth || 1;
    const h = layer.clientHeight || 1;
    const behind = promptV.z > 1;
    let x = ((promptV.x + 1) / 2) * w;
    let y = ((1 - promptV.y) / 2) * h;
    if (behind) {
      x = w / 2;
      y = h * 0.62;
    }
    const pw = promptEl.offsetWidth || 120;
    x = clamp(x, pw / 2 + 10, w - pw / 2 - 10);
    y = clamp(y, 40, h - 90);
    promptEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
  function paintJoy() {
    if (!joyEl) return;
    const touchy = C.device === 'touch' || (coarsePointer() && C.device !== 'gamepad');
    const show = !!(enabled && !modal && o.joystick !== false && (joy || touchy));
    joyEl.hidden = !show;
    if (!show) return;
    const knob = joyEl.firstChild;
    if (joy) {
      const lr = layer.getBoundingClientRect();
      joyEl.classList.add('is-on');
      joyEl.style.left = `${(joy.x0 - lr.left).toFixed(0)}px`;
      joyEl.style.top = `${(joy.y0 - lr.top).toFixed(0)}px`;
      joyEl.style.bottom = 'auto';
      const v = joyVec();
      knob.style.transform = `translate(${(v.x * 44).toFixed(1)}px, ${(v.y * 44).toFixed(1)}px)`;
    } else {
      joyEl.classList.remove('is-on');
      joyEl.style.left = '';
      joyEl.style.top = '';
      joyEl.style.bottom = '';
      knob.style.transform = '';
    }
  }
  function joyVec() {
    if (!joy) return { x: 0, y: 0, m: 0 };
    const R0 = 48;
    let x = (joy.x - joy.x0) / R0;
    let y = (joy.y - joy.y0) / R0;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    return { x, y, m: Math.min(1, m) };
  }
  let hintKey = '';
  function paintHint() {
    if (!hintEl) return;
    let text = '';
    let key = 'none';
    if (enabled && !modal && o.hint !== false && C.device === 'keyboard' && lockOK()) {
      if (locked && lockHintT > 0) {
        key = 'locked';
        text = tr('ctl.hint.free', 'Esc frees the mouse');
      } else if (!locked && kbWalk) {
        key = 'click';
        text = tr('ctl.hint.click', 'Click to look around · H: controls');
      }
    }
    if (key === hintKey) return;
    hintKey = key;
    hintEl.textContent = text;
    hintEl.hidden = !text;
  }
  // A soft ring under the current target, and the walk-to marker.
  let ring = null;
  let marker = null;
  let markerT = 0;
  function ensureRings() {
    const sc = g.parent;
    if (!sc || ring) return;
    ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.6, 40), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 4;
    ring.visible = false;
    marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2;
    marker.renderOrder = 4;
    marker.visible = false;
    sc.add(ring, marker);
  }
  function markAt(p) {
    ensureRings();
    if (!marker) return;
    marker.position.set(p.x, g.position.y + 0.03, p.z);
    markerT = 1;
  }

  // ----- Movement -----
  function moveTo(point, opt = {}) {
    if (!point) return;
    const p = { x: point.x, z: point.z };
    if (mode === 'ground') resolveGround(p, { bounds: walk.bounds, inside: walk.inside, clamp: walk.clamp }, radius);
    auto = { x: p.x, y: point.y != null ? point.y : g.position.y, z: p.z, onArrive: opt.onArrive || null, run: !!opt.run, tol: opt.tolerance != null ? opt.tolerance : 0.25, speed: opt.speed || null, stuck: 0, best: Infinity };
  }
  function stop() {
    auto = null;
    vel.set(0, 0, 0);
  }
  function arrive() {
    const a = auto;
    auto = null;
    if (a && a.onArrive) a.onArrive();
    emit('arrive', a ? { x: a.x, z: a.z } : null);
  }
  // A step around a round obstacle in the way of a scripted walk (the
  // collision then slides along it); obstacles past the goal are ignored.
  function avoid(dx, dz, maxD) {
    const cs = walk.circles || [];
    const p = g.position;
    for (const c of cs) {
      if (!c) continue;
      const ox = c.x - p.x;
      const oz = c.z - p.z;
      const along = ox * dx + oz * dz;
      if (along < 0 || along > c.r + 3) continue;
      const side = ox * dz - oz * dx;
      const reach = c.r + radius + 0.25;
      if (Math.abs(side) < reach && along - Math.sqrt(Math.max(0, reach * reach - side * side)) < maxD) {
        const s = side >= 0 ? -1 : 1;
        const nx = dx + s * dz * 1.2;
        const nz = dz - s * dx * 1.2;
        const l = Math.hypot(nx, nz) || 1;
        dx = nx / l;
        dz = nz / l;
      }
    }
    return { x: dx, z: dz };
  }

  function readInput() {
    let f = 0;
    let s = 0;
    let run = false;
    let u = 0;
    const live = enabled && !modal && moveOn;
    if (live) {
      const has = (k) => {
        for (const c of held) if (MOVE_KEYS[c] === k) return true;
        return false;
      };
      f = (has('f') ? 1 : 0) - (has('b') ? 1 : 0);
      s = (has('r') ? 1 : 0) - (has('l') ? 1 : 0);
      if (f && s) {
        f *= Math.SQRT1_2;
        s *= Math.SQRT1_2;
      }
      run = held.has('ShiftLeft') || held.has('ShiftRight');
      if (mode === 'zeroG') u = (held.has('Space') ? 1 : 0) - (held.has('KeyC') || held.has('ControlLeft') || held.has('ControlRight') ? 1 : 0);
      if (joy && joy.moved) {
        const v = joyVec();
        if (v.m > 0.12) {
          f = -v.y;
          s = v.x;
          run = run || v.m > 0.92;
        }
      }
      const pm = Math.hypot(pad.lx, pad.ly);
      if (pm > 0) {
        f = -pad.ly;
        s = pad.lx;
        run = run || pad.run || pm > 0.93;
      }
      if (pad.up) u = 1;
      if (pad.down) u = -1;
    }
    return { f, s, run, u };
  }

  function updateGround(dt, inp) {
    const p = g.position;
    const mag = Math.min(1, Math.hypot(inp.f, inp.s));
    let wx = 0;
    let wz = 0;
    let want = 0;
    let wantRun = false;
    manual = mag > 0.08;
    if (manual) {
      if (auto) {
        auto = null;
        emit('cancel');
      }
      lastManual = time;
      const d = camRelative(inp.f, inp.s, camYaw);
      const l = Math.hypot(d.x, d.z) || 1;
      wx = d.x / l;
      wz = d.z / l;
      wantRun = inp.run;
      want = (wantRun ? S.run : S.walk * Math.min(1, mag / 0.9)) * speedScale;
      // A sharp change of direction from a standstill: turn on the spot first.
      const sharp = Math.abs(wrapAngle(Math.atan2(wx, wz) - g.rotation.y));
      if (sharp > 2.0 && speedNow < 1.0) want *= 0.25;
    } else if (auto) {
      const dx = auto.x - p.x;
      const dz = auto.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d <= auto.tol) {
        arrive();
      } else {
        const a = avoid(dx / d, dz / d, d);
        wx = a.x;
        wz = a.z;
        const top = auto.speed || (auto.run ? S.run : S.walk);
        wantRun = auto.run;
        want = Math.min(top * speedScale, d * 2.4 + 0.35);
        // Stuck behind something: give up (arrive when close enough).
        if (d < auto.best - 0.05) {
          auto.best = d;
          auto.stuck = 0;
        } else if ((auto.stuck += dt) > 1.6) {
          if (d < Math.max(1.4, auto.tol * 3)) arrive();
          else {
            auto = null;
            emit('cancel');
          }
          want = 0;
        }
      }
    }
    running = wantRun && want > S.walk * 1.05;
    // Accelerate toward the wanted velocity; stop a little faster than you start.
    const tvx = wx * want;
    const tvz = wz * want;
    const decel = want < Math.hypot(vel.x, vel.z) - 0.05;
    const k = 1 - Math.exp(-(decel ? S.accel * 1.6 : S.accel) * dt);
    vel.x += (tvx - vel.x) * k;
    vel.z += (tvz - vel.z) * k;
    if (want === 0 && vel.x * vel.x + vel.z * vel.z < 0.0004) vel.set(0, 0, 0);
    // Turn toward where you are going.
    if (want > 0.05) {
      const ty = Math.atan2(wx, wz);
      const diff = wrapAngle(ty - g.rotation.y);
      g.rotation.y += diff * Math.min(1, S.turn * dt);
    }
    // Move, then slide out of whatever is in the way.
    const ox = p.x;
    const oz = p.z;
    if (vel.x || vel.z) {
      tmpP.x = p.x + vel.x * dt;
      tmpP.z = p.z + vel.z * dt;
      resolveGround(tmpP, walk, radius);
      p.x = tmpP.x;
      p.z = tmpP.z;
    }
    const moved = Math.hypot(p.x - ox, p.z - oz) / Math.max(1e-4, dt);
    speedNow += (moved - speedNow) * Math.min(1, dt * 12);
    if (speedNow < 0.02 && !vel.x && !vel.z) speedNow = 0;
    // Lean into turns (yaw rate times speed), gently.
    const yawRate = wrapAngle(g.rotation.y - yawPrev) / Math.max(1e-4, dt);
    yawPrev = g.rotation.y;
    const wantLean = clamp(-yawRate * speedNow * 0.035, -0.22, 0.22) * (reducedMotion() ? 0.5 : 1);
    lean += (wantLean - lean) * Math.min(1, dt * 8);
    if (ch.setLean) ch.setLean(lean);
    if (ch.setSpeed) ch.setSpeed(speedNow);
    else if (ch.setMove) ch.setMove(Math.min(1, speedNow / 1.6));
    if ('onStep' in ch && ch.onStep !== footstep) ch.onStep = footstep;
    // A small hop.
    if (pressedHop) {
      pressedHop = false;
      if (grounded && enabled && !modal) {
        grounded = false;
        hopT = 0.62;
        if (ch.hop) ch.hop();
        emit('hop');
      }
    }
    if (!grounded && (hopT -= dt) <= 0) grounded = true;
    stepPhase += speedNow * dt * 1.9;
  }

  // Soft footsteps, on the frame each foot lands (the astronaut calls onStep).
  let stepAlt = 0;
  function footstep(info) {
    if (o.footsteps === false || mode !== 'ground' || !grounded || disposed) return;
    const A = SMD.audio;
    if (!A || !A.beep || (A.isMuted && A.isMuted())) return;
    const run = !!(info && info.run);
    stepAlt ^= 1;
    try {
      A.beep((run ? 120 : 96) + stepAlt * 9 + Math.random() * 8, run ? 0.05 : 0.045, 'sine', run ? 0.05 : 0.032);
    } catch (e) {}
  }

  function updateFloat(dt, inp) {
    const p = g.position;
    const live = enabled && !modal;
    manual = live && Math.hypot(inp.f, inp.s, inp.u) > 0.08;
    const cp = Math.cos(camPitch);
    // Camera forward (into the screen), right, and world up.
    const fx = -Math.sin(camYaw) * cp;
    const fy = -Math.sin(camPitch);
    const fz = -Math.cos(camYaw) * cp;
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    let tx = 0;
    let ty = 0;
    let tz = 0;
    const top = (inp.run ? S.float * 1.7 : S.float) * speedScale;
    if (manual) {
      if (auto) {
        auto = null;
        emit('cancel');
      }
      lastManual = time;
      tx = fx * inp.f + rx * inp.s;
      ty = fy * inp.f + inp.u;
      tz = fz * inp.f + rz * inp.s;
      const l = Math.hypot(tx, ty, tz);
      if (l > 1) {
        tx /= l;
        ty /= l;
        tz /= l;
      }
    } else if (auto) {
      const dx = auto.x - p.x;
      const dy = auto.y - p.y;
      const dz = auto.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d <= auto.tol) arrive();
      else {
        const k = Math.min(1, d / 1.2);
        tx = (dx / d) * k;
        ty = (dy / d) * k;
        tz = (dz / d) * k;
      }
    }
    // Thrust with inertia and a slow drag: you drift after letting go.
    const acc = 2.4;
    vel.x += tx * acc * dt;
    vel.y += ty * acc * dt;
    vel.z += tz * acc * dt;
    const drag = Math.exp(-(manual || auto ? 0.9 : 0.55) * dt);
    vel.multiplyScalar(drag);
    const sp = vel.length();
    if (sp > top) vel.multiplyScalar(top / sp);
    p.addScaledVector(vel, dt);
    // Gentle bumps off the cabin walls.
    if (volume) {
      const mn = volume.min;
      const mx = volume.max;
      const r = radius + 0.05;
      const H = o.bodyHeight != null ? o.bodyHeight : 1.75;
      if (p.x < mn.x + r) (p.x = mn.x + r), (vel.x = Math.abs(vel.x) * 0.3);
      if (p.x > mx.x - r) (p.x = mx.x - r), (vel.x = -Math.abs(vel.x) * 0.3);
      if (p.y < mn.y) (p.y = mn.y), (vel.y = Math.abs(vel.y) * 0.3);
      if (p.y > mx.y - H) (p.y = mx.y - H), (vel.y = -Math.abs(vel.y) * 0.3);
      if (p.z < mn.z + r) (p.z = mn.z + r), (vel.z = Math.abs(vel.z) * 0.3);
      if (p.z > mx.z - r) (p.z = mx.z - r), (vel.z = -Math.abs(vel.z) * 0.3);
      // Non-box cabins (the capsule's cone) refine the box with their own limit.
      if (typeof volume.clamp === 'function') {
        const bx = p.x, by = p.y, bz = p.z;
        volume.clamp(p);
        if (p.x !== bx || p.y !== by || p.z !== bz) vel.multiplyScalar(0.3);
      }
    }
    speedNow = vel.length();
    running = manual && inp.run;
    grounded = false;
    // Slowly turn the body toward the drift (or the camera's forward).
    const hx = manual ? fx : vel.x;
    const hz = manual ? fz : vel.z;
    if (Math.hypot(hx, hz) > 0.12) g.rotation.y += wrapAngle(Math.atan2(hx, hz) - g.rotation.y) * Math.min(1, S.turn * 0.25 * dt);
    if (ch.setFloat) ch.setFloat(true);
    if (ch.setSpeed) ch.setSpeed(0);
    if (ch.setSwim) ch.setSwim(Math.min(1, speedNow / Math.max(0.1, S.float)));
    pressedHop = false;
  }

  // ----- Camera -----
  let focusS = null; // { target, position, distance, duration, t, want, fov, height }
  let focusK = 0;
  let blendK = 1;
  const blendFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: R.fov };
  const look2 = new THREE.Vector3();
  const pos2 = new THREE.Vector3();
  function applyLookInput(dt) {
    const live = enabled && !modal;
    const ls = lookSpeed();
    const inv = invertY() ? -1 : 1;
    let touched = false;
    if (live && (lookDX || lookDY)) {
      const k = (locked ? 0.0026 : 0.0034) * ls;
      camYaw -= lookDX * k;
      camPitch += lookDY * k * inv * 0.8;
      touched = true;
    }
    lookDX = lookDY = 0;
    if (live && (pad.rx || pad.ry)) {
      camYaw -= pad.rx * 2.6 * ls * dt;
      camPitch += pad.ry * 1.6 * ls * dt * inv;
      touched = true;
    }
    if (live) {
      const turn = (held.has('KeyZ') ? 1 : 0) - (held.has('KeyX') ? 1 : 0);
      if (turn) {
        camYaw += turn * 1.9 * ls * dt;
        touched = true;
      }
    }
    if (touched) {
      lastCamTouch = time;
      recenterT = 0;
      followW = 0; // the player steers the camera: stop following at once
    }
    camPitch = clamp(camPitch, R.pitch[0], R.pitch[1]);
    camYaw = wrapAngle(camYaw);
    // The camera follows by itself (docs/CONTROLS.md, the camera follows on
    // its own): while you move it swings in behind the direction of travel,
    // faster when running, with a small dead zone. Back-pedalling and
    // strafing never spin it round, and turning it yourself pauses the follow
    // for about 1.2 s, after which it eases back in. R recenters at once.
    const rm = reducedMotion();
    if (recenterT > 0) {
      recenterT -= dt;
      camYaw += wrapAngle(g.rotation.y + Math.PI - camYaw) * Math.min(1, dt * 6);
      return;
    }
    const autoOn = o.autoCamera !== false && !(SMD.settings && SMD.settings.autoCamera === false);
    const hs = Math.hypot(vel.x, vel.z);
    if (!autoOn || mode !== 'ground' || speedNow < 0.3 || hs < 0.2) {
      followW = Math.max(0, followW - dt * 2);
      return;
    }
    const since = time - lastCamTouch;
    const resume = clamp((since - 1.2) / 0.7, 0, 1);
    // How much the travel points away from the camera (1 = straight ahead).
    const fwd = (-Math.sin(camYaw) * vel.x - Math.cos(camYaw) * vel.z) / hs;
    const engage = clamp((fwd - 0.25) / 0.55, 0, 1);
    followW += (engage * resume - followW) * Math.min(1, dt * 3);
    if (followW < 0.002) return;
    const heading = Math.atan2(vel.x, vel.z);
    let diff = wrapAngle(heading + Math.PI - camYaw);
    const dz = 0.05;
    diff = Math.sign(diff) * Math.max(0, Math.abs(diff) - dz);
    const runK = clamp((speedNow - S.walk) / Math.max(0.5, S.run - S.walk), 0, 1);
    const rate = (1.1 + 1.6 * runK) * Math.min(1, speedNow / Math.max(0.5, S.walk)) * (auto ? 0.8 : 1) * (rm ? 0.7 : 1);
    camYaw += diff * Math.min(1, dt * rate * followW);
    // The pitch drifts back to the usual angle too.
    camPitch += (clamp(R.pitch0, R.pitch[0], R.pitch[1]) - camPitch) * Math.min(1, dt * 0.7 * followW);
  }
  let followW = 0;
  let boost = 0; // extra pitch to see over a wall
  let tightK = R.tight ? 1 : 0; // a tight interior: closer and higher
  const lead = new THREE.Vector3();
  function clearAlong(origin, dir, want) {
    let clear = want;
    if (camClear) clear = Math.min(clear, camClear(origin, dir, clear));
    if (camCircles) clear = clearCircles(origin, dir, clear, camCircles, 0.35, R.min * 0.6);
    if (camBoxes) clear = clearBoxes(origin, dir, clear, camBoxes, 0.3, R.min * 0.6);
    return clear;
  }
  function computeView(dt) {
    const p = g.position;
    const hTarget = R.height + 0.18 * tightK;
    // Look-ahead: the target leads a little in the direction of motion.
    const la = mode === 'ground' ? 0.24 : 0.1;
    v3.set(vel.x * la, 0, vel.z * la);
    if (v3.length() > 1.1) v3.setLength(1.1);
    lead.lerp(v3, Math.min(1, dt * 3));
    v1.set(p.x + lead.x, p.y + hTarget, p.z + lead.z);
    if (snap) {
      pivot.copy(v1);
      snap = false;
    } else {
      const kx = 1 - Math.exp(-14 * dt);
      const ky = 1 - Math.exp(-(mode === 'zeroG' ? 6 : 9) * dt);
      pivot.x += (v1.x - pivot.x) * kx;
      pivot.z += (v1.z - pivot.z) * kx;
      pivot.y += (v1.y - pivot.y) * ky;
    }
    rightV.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
    // Over the right shoulder (less of it when zoomed far out or tight).
    const sh = R.shoulder * clamp(1.25 - dist / (R.max * 1.6), 0.4, 1) * (1 - 0.4 * tightK);
    const origin = v2.copy(pivot).addScaledVector(rightV, sh);
    // A little farther back when running (speed feel); closer when tight.
    const runK0 = clamp((speedNow - S.walk) / Math.max(0.5, S.run - S.walk), 0, 1);
    const want = clamp(dist * (1 + 0.14 * runK0) * (1 - 0.3 * tightK), R.min, R.max * 1.2);
    // Smart framing: a wall behind you first raises the camera to look down
    // over it (keeping you in view), then it moves in.
    let bestPitch = camPitch;
    let clear = 0;
    for (let k = 0; k < 4; k++) {
      const pk = Math.min(R.pitch[1] + 0.15, camPitch + k * 0.22);
      const c0 = Math.cos(pk);
      dirV.set(Math.sin(camYaw) * c0, Math.sin(pk), Math.cos(camYaw) * c0);
      const c = clearAlong(origin, dirV, want);
      if (c > clear + 0.4) {
        clear = c;
        bestPitch = pk;
      }
      if (c >= want * 0.8) break;
    }
    const tightWant = R.tight ? 1 : clear < want * 0.55 ? 1 : 0;
    tightK += (tightWant - tightK) * Math.min(1, dt * (tightWant ? 1.2 : 0.5));
    boost += (bestPitch - camPitch + 0.12 * tightK - boost) * Math.min(1, dt * 3.5);
    const pitchNow = clamp(camPitch + boost, R.pitch[0], R.pitch[1] + 0.2);
    const cp = Math.cos(pitchNow);
    dirV.set(Math.sin(camYaw) * cp, Math.sin(pitchNow), Math.cos(camYaw) * cp);
    clear = clearAlong(origin, dirV, want);
    if (colliders && colliders.length) {
      ray.set(origin, dirV);
      ray.near = 0;
      ray.far = clear + 0.3;
      const hit = ray.intersectObjects(colliders, true).find((h) => h.object.visible !== false && !h.object.isSprite);
      if (hit) clear = Math.max(R.min * 0.6, hit.distance - 0.3);
    }
    // The floor (when the camera dips below the shoulder).
    const floorY = R.floorY != null ? R.floorY : mode === 'ground' ? p.y : -Infinity;
    if (dirV.y < -0.01 && isFinite(floorY)) {
      const s = (origin.y - (floorY + 0.25)) / -dirV.y;
      if (s < clear) clear = Math.max(0.6, s);
    }
    if (clear < distNow) distNow = clear;
    else distNow += (clear - distNow) * Math.min(1, dt * 2.2);
    pos2.copy(origin).addScaledVector(dirV, distNow);
    // A box the camera must stay inside (a hall).
    const B = R.bounds;
    if (B) {
      pos2.x = clamp(pos2.x, B.minX, B.maxX);
      pos2.z = clamp(pos2.z, B.minZ, B.maxZ);
      if (B.maxY != null) pos2.y = Math.min(pos2.y, B.maxY);
    }
    look2.copy(origin);
    // An interactable in front of you: nudge the framing so both stay in view.
    if (target && enabled && !modal && mode === 'ground') {
      v3.set(target.x - origin.x, 0, target.z - origin.z);
      const l = v3.length();
      if (l > 0.01) look2.addScaledVector(v3, Math.min(0.9, l * 0.18) / l);
    }
    // Running: a touch of bob and a wider lens (not with reduced motion).
    const rm = reducedMotion();
    const runK = clamp((speedNow - S.walk) / Math.max(0.5, S.run - S.walk), 0, 1);
    if (!rm && mode === 'ground') pos2.y += Math.sin(stepPhase * TAU) * 0.018 * runK;
    const fovWant = R.fov + (rm || mode !== 'ground' ? 0 : 5 * runK);
    fovNow += (fovWant - fovNow) * Math.min(1, dt * 3);
    view.position.copy(pos2);
    view.target.copy(look2);
    view.fov = fovNow;
    // Cinematic focus: frame a target, then come back.
    if (focusS) {
      focusS.t += dt;
      if (focusS.duration && focusS.t > focusS.duration) focusS.want = 0;
      const rate = rm ? 60 : 2.6;
      focusK += ((focusS.want ? 1 : 0) - focusK) * Math.min(1, dt * rate);
      if (!focusS.want && focusK < 0.003) {
        focusK = 0;
        focusS = null;
        emit('focusend');
      } else {
        const tg = posOf(focusS.target, v3);
        if (focusS.lookY) tg.y += focusS.lookY;
        let fp;
        if (focusS.position) fp = posOf(focusS.position, atV);
        else {
          const fd = focusS.distance || 5;
          fp = atV.set(Math.sin(camYaw) * Math.cos(0.32), Math.sin(0.32), Math.cos(camYaw) * Math.cos(0.32)).multiplyScalar(fd).add(tg);
        }
        const k = smooth01(clamp(focusK, 0, 1));
        view.position.lerp(fp, k);
        view.target.lerp(tg, k);
        if (focusS.fov) view.fov = lerp(view.fov, focusS.fov, k);
      }
    }
  }
  function applyCamera(dt) {
    if (!camera || !camActive) return;
    if (blendK < 1) {
      blendK = Math.min(1, blendK + dt / (reducedMotion() ? 0.01 : 0.75));
      const k = smooth01(blendK);
      camera.position.lerpVectors(blendFrom.pos, view.position, k);
      v1.lerpVectors(blendFrom.look, view.target, k);
      camera.lookAt(v1);
      const f = lerp(blendFrom.fov, view.fov, k);
      if (Math.abs(camera.fov - f) > 0.01) {
        camera.fov = f;
        camera.updateProjectionMatrix();
      }
    } else {
      camera.position.copy(view.position);
      camera.lookAt(view.target);
      if (Math.abs(camera.fov - view.fov) > 0.01) {
        camera.fov = view.fov;
        camera.updateProjectionMatrix();
      }
    }
    camera.updateMatrixWorld();
  }

  // ----- Frame -----
  let lastInput = null;
  let wasEnabled = enabled;
  function update(dt) {
    if (disposed) return;
    // Up to a quarter second per frame (slow school laptops keep real-time
    // walking), moved in small steps so collisions stay solid.
    dt = Math.min(0.25, Math.max(0, dt || 0));
    time += dt;
    if ((modalCheck -= dt) <= 0) {
      modalCheck = 0.2;
      const m = modalOpen();
      if (m !== modal) {
        modal = m;
        if (m) release();
        paintHint();
      }
    }
    if (enabled !== wasEnabled) wasEnabled = enabled;
    pollPad();
    const inp = readInput();
    lastInput = inp;
    const n = Math.max(1, Math.ceil(dt / 0.034));
    for (let i = 0; i < n; i++) {
      if (mode === 'zeroG') updateFloat(dt / n, inp);
      else updateGround(dt / n, inp);
    }
    ch.update(dt);
    // Targets: positions move (people walk), so re-check every frame. While a
    // card is open the target holds still.
    refreshPositions();
    if (enabled) setTarget(chooseTarget());
    else if (target && target.enabled === false) setTarget(null);
    applyLookInput(dt);
    computeView(dt);
    applyCamera(dt);
    syncOverlay(dt);
  }
  function syncOverlay(dt = 0) {
    attach();
    if ((labelT -= dt) <= 0) {
      labelT = 0.3;
      paintPrompt(false);
      paintHint();
    }
    placePrompt();
    paintJoy();
    if (lockHintT > 0 && (lockHintT -= dt) <= 0) paintHint();
    // The ring under the target and the walk-to marker.
    ensureRings();
    if (ring) {
      const on = !!(target && enabled && !modal && target.item.ring !== false && mode === 'ground');
      const want = on ? 0.55 + (reducedMotion() ? 0 : 0.2 * Math.sin(time * 4)) : 0;
      ring.material.opacity += (want - ring.material.opacity) * Math.min(1, dt * 10);
      ring.visible = ring.material.opacity > 0.02;
      if (target && on) {
        const rr = target.item.ring || 1;
        ring.position.set(target.x, g.position.y + 0.025, target.z);
        ring.scale.setScalar(typeof rr === 'number' ? rr : 1);
      }
    }
    if (marker) {
      if (markerT > 0) markerT = Math.max(0, markerT - dt * 1.3);
      marker.material.opacity = markerT * 0.9;
      marker.visible = markerT > 0;
      marker.scale.setScalar(1 + (1 - markerT) * 0.8);
    }
  }

  // ----- API -----
  C.active++;
  wrapItems(o.interactables || []);
  const api = {
    update,
    setEnabled(on) {
      on = !!on;
      if (on === enabled) return;
      enabled = on;
      if (!on) {
        release();
        held.clear();
        look = null;
        joy = null;
        pinch = null;
        pointers.clear();
        lookDX = lookDY = 0;
        pressedHop = false;
      }
      paintPrompt(true);
      paintHint();
      paintJoy();
    },
    get enabled() {
      return enabled;
    },
    // false: movement input is ignored (a quick-time event, a line said to
    // your face) while the mouse stays captured and the camera still turns.
    setMoveEnabled(on) {
      moveOn = !!on;
      if (!moveOn) pressedHop = false;
    },
    get moveEnabled() {
      return moveOn;
    },
    // Ask for the pointer lock (only works inside a click or key handler).
    lock: () => requestLock(),
    setInteractables(list) {
      wrapItems(list);
    },
    // Re-check the target now (after a teleport, or when labels changed).
    refreshTarget() {
      refreshPositions();
      setTarget(chooseTarget());
      paintPrompt(true);
    },
    moveTo,
    stop,
    teleport(position, yaw, opt = {}) {
      if (position) g.position.set(position.x, position.y != null ? position.y : g.position.y, position.z);
      if (yaw != null) {
        g.rotation.y = yaw;
        yawPrev = yaw;
        if (opt.camera !== 'keep') camYaw = yaw + Math.PI;
      }
      auto = null;
      vel.set(0, 0, 0);
      speedNow = 0;
      snap = true;
      distNow = Math.min(distNow, dist);
    },
    focus(tg, opt = {}) {
      if (!tg) {
        if (focusS) focusS.want = 0;
        return;
      }
      focusS = { target: tg, position: opt.position || null, distance: opt.distance, duration: opt.duration || 0, t: 0, want: 1, fov: opt.fov || null, lookY: opt.lookY || 0 };
      if (opt.instant || reducedMotion()) focusK = 1;
    },
    get focusing() {
      return !!(focusS && focusS.want);
    },
    release,
    interact() {
      interact();
    },
    on(name, fn) {
      (listeners[name] = listeners[name] || []).push(fn);
      return () => {
        const l = listeners[name];
        const i = l ? l.indexOf(fn) : -1;
        if (i >= 0) l.splice(i, 1);
      };
    },
    get state() {
      return {
        speed: speedNow,
        running,
        grounded,
        target: target ? target.item : null,
        locked,
        auto: !!auto,
        moving: speedNow > 0.05 || !!auto,
        inputActive: manual,
        device: C.device,
        enabled,
        camYaw,
        camPitch,
        distance: dist,
        mode,
      };
    },
    // Extras (documented in docs/CONTROLS.md).
    view,
    get camYaw() {
      return camYaw;
    },
    set camYaw(v) {
      camYaw = v;
      lastCamTouch = time;
    },
    get camPitch() {
      return camPitch;
    },
    set camPitch(v) {
      camPitch = clamp(v, R.pitch[0], R.pitch[1]);
    },
    get zoom() {
      return dist;
    },
    set zoom(v) {
      dist = clamp(v, R.min, R.max);
    },
    rig: R,
    speeds: S,
    setRig(part) {
      Object.assign(R, part || {});
      dist = clamp(part && part.distance != null ? part.distance : dist, R.min, R.max);
      camPitch = clamp(part && part.pitch0 != null ? part.pitch0 : camPitch, R.pitch[0], R.pitch[1]);
    },
    setWalkable(w) {
      walk = Object.assign({ bounds: null, circles: [], boxes: [], clamp: null }, w || {});
    },
    get walkable() {
      return walk;
    },
    setVolume(v) {
      volume = v;
    },
    setCameraColliders(list) {
      colliders = list || [];
    },
    setCameraShapes(s = {}) {
      if ('circles' in s) camCircles = s.circles;
      if ('boxes' in s) camBoxes = s.boxes;
    },
    setMode(m) {
      const next = m === 'zeroG' ? 'zeroG' : 'ground';
      if (next === mode) return;
      mode = next;
      vel.set(0, 0, 0);
      auto = null;
      grounded = next === 'ground';
      if (next === 'ground' && ch.setFloat) ch.setFloat(false);
    },
    setSpeedScale(k) {
      speedScale = clamp(Number(k) || 1, 0.1, 3);
    },
    // false: the scene drives the camera (cut scenes, map views); the view
    // pose keeps updating. true: blend back from wherever the camera is.
    setCameraActive(on, opt = {}) {
      on = !!on;
      if (on === camActive) return;
      camActive = on;
      if (on && camera) {
        blendFrom.pos.copy(camera.position);
        camera.getWorldDirection(v1);
        blendFrom.look.copy(camera.position).addScaledVector(v1, Math.max(2, camera.position.distanceTo(view.target)));
        blendFrom.fov = camera.fov;
        blendK = opt.instant ? 1 : 0;
      }
    },
    get cameraActive() {
      return camActive;
    },
    // Put the camera behind the character at once (after a cut).
    snapCamera(yaw) {
      camYaw = yaw != null ? yaw : g.rotation.y + Math.PI;
      snap = true;
      distNow = dist;
      blendK = 1;
    },
    recenter() {
      recenterT = 0.9;
    },
    // Taps: a raycaster aimed through the tap, and the ground point under it.
    ray: rayFrom,
    groundPoint,
    mark: markAt,
    syncOverlay() {
      placePrompt();
    },
    get locked() {
      return locked;
    },
    // Tests and scripts: drive the inputs without real devices.
    debug: {
      key(code, down) {
        if (down) {
          held.add(code);
          if (MOVE_KEYS[code]) kbWalk = true;
        } else held.delete(code);
      },
      look(dx, dy) {
        lookDX += dx;
        lookDY += dy;
      },
      get held() {
        return [...held];
      },
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      C.active = Math.max(0, C.active - 1);
      release();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (dom && dom.removeEventListener) {
        dom.removeEventListener('pointerdown', onDown);
        dom.removeEventListener('pointermove', onMove);
        dom.removeEventListener('pointerup', onUp);
        dom.removeEventListener('pointercancel', onUp);
        dom.removeEventListener('contextmenu', onMenu);
        dom.removeEventListener('wheel', onWheel);
        dom.style.touchAction = oldTouchAction;
      }
      if (layer) layer.remove();
      [ring, marker].forEach((m) => {
        if (!m) return;
        if (m.parent) m.parent.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      });
      Object.keys(listeners).forEach((k) => delete listeners[k]);
    },
  };
  return api;
}
