// Last Light: the player's astronaut and the shared controller
// (js/3d/controller.js) set up for a PC game. Click the canvas and the mouse
// looks around (pointer lock; Esc frees it), WASD moves relative to the
// camera, Shift runs, E interacts, Space / C go up and down in zero g. The
// camera sits over the right shoulder, close like The Last of Us.
//
// Sets describe where you can be:
//   walkable: the controller's walkable, plus `zones: [{ minX, maxX, minZ,
//             maxZ, y }]` (floors at different heights; you stay on the one
//             you stand on) and `height(x, z)` (ground height, for ramps).
//   volume:   zero g. { min, max, clamp? } or `boxes: [{ minX, maxX, minY,
//             maxY, minZ, maxZ }]` (rooms joined where they overlap).
import { THREE } from '../3d/engine.js';
import { createController } from '../3d/controller.js';
import { createAstronaut } from '../3d/astronaut.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const coarse = () => {
  try {
    return matchMedia('(pointer: coarse)').matches;
  } catch (e) {
    return false;
  }
};

// Over-the-shoulder rigs. Ground: about three metres back, shoulder height,
// the character left of centre. Zero g: tight and close in the cabins.
export const RIGS = {
  ground: { distance: 3.35, height: 1.55, shoulder: 0.72, min: 1.4, max: 6, pitch: [-0.5, 1.0], pitch0: 0.16, fov: 55, tight: false },
  zeroG: { distance: 2.5, height: 0.95, shoulder: 0.7, min: 0.8, max: 3.4, pitch: [-1.0, 1.15], pitch0: 0.14, fov: 66, tight: false },
};
export const SPEEDS = { walk: 1.85, run: 4.4, accel: 14, turn: 12, float: 1.25 };
const BODY_ZEROG = 0.85; // a floating astronaut curls up: less head room needed

// Keep a foot point inside floor zones at the current height (pure).
export function zonesClamp(zones, p, y, r = 0.3) {
  let best = null;
  let bestD = Infinity;
  for (const z of zones) {
    if (Math.abs((z.y || 0) - y) > 0.75) continue;
    const x0 = z.minX + r;
    const x1 = z.maxX - r;
    const z0 = z.minZ + r;
    const z1 = z.maxZ - r;
    if (p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1) return p;
    const cx = clamp(p.x, x0, x1);
    const cz = clamp(p.z, z0, z1);
    const d = Math.hypot(p.x - cx, p.z - cz);
    if (d < bestD) {
      bestD = d;
      best = { x: cx, z: cz };
    }
  }
  if (best) {
    p.x = best.x;
    p.z = best.z;
  }
  return p;
}
// The zone under a point (for its floor height).
export function zoneAt(zones, x, z, y) {
  let best = null;
  let bd = Infinity;
  for (const zn of zones) {
    if (x < zn.minX - 0.05 || x > zn.maxX + 0.05 || z < zn.minZ - 0.05 || z > zn.maxZ + 0.05) continue;
    const d = Math.abs((zn.y || 0) - y);
    if (d < bd) {
      bd = d;
      best = zn;
    }
  }
  return best;
}

// Zero g in joined rooms: keep the feet point where the body fits (pure).
export function boxesClamp(boxes, p, r = 0.28, body = BODY_ZEROG) {
  let best = null;
  let bestD = Infinity;
  for (const b of boxes) {
    const x0 = b.minX + r;
    const x1 = b.maxX - r;
    const y0 = b.minY + 0.02;
    const y1 = Math.max(y0, b.maxY - body);
    const z0 = b.minZ + r;
    const z1 = b.maxZ - r;
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p.z >= z0 && p.z <= z1) return p;
    const cx = clamp(p.x, x0, x1);
    const cy = clamp(p.y, y0, y1);
    const cz = clamp(p.z, z0, z1);
    const d = Math.hypot(p.x - cx, p.y - cy, p.z - cz);
    if (d < bestD) {
      bestD = d;
      best = [cx, cy, cz];
    }
  }
  if (best) {
    p.x = best[0];
    p.y = best[1];
    p.z = best[2];
  }
  return p;
}
const insideBoxes = (boxes, x, y, z, m = 0.12) => boxes.some((b) => x > b.minX + m && x < b.maxX - m && y > b.minY + m && y < b.maxY - m && z > b.minZ + m && z < b.maxZ - m);

export function createPlayer(o) {
  const { camera, dom } = o;
  const appearance = o.appearance || (SMD.avatar && SMD.avatar.get ? SMD.avatar.get() : null);
  const astro = createAstronaut(appearance, { shadows: true, blob: true, helmet: o.helmet != null ? o.helmet : undefined });
  astro.group.name = 'player';
  let mode = o.mode === 'zeroG' ? 'zeroG' : 'ground';
  let zones = null;
  let heightFn = null;
  let boxes = null;
  const touch = coarse();
  // A phone is a touch device from the first frame (the first moment may be a
  // quick-time event, before any touch on the canvas has told the controller).
  if (touch && SMD.controls && SMD.controls.device !== 'touch') {
    SMD.controls.device = 'touch';
    if (SMD.bus) SMD.bus.emit('controls-device', 'touch');
  }

  const ctl = createController({
    camera,
    dom,
    character: astro,
    mode,
    overlay: o.overlay || null,
    rig: Object.assign({}, RIGS[mode]),
    speeds: Object.assign({}, SPEEDS),
    clickToLock: !touch,
    tapToWalk: touch,
    hint: !touch,
    bodyHeight: BODY_ZEROG,
    targetEye: 0, // anchors and the player are both feet points
    cameraClear: (origin, dir, want) => (boxes && mode === 'zeroG' ? clearInBoxes(origin, dir, want) : want),
    interactables: [],
  });

  // The camera may only travel through the rooms (zero g).
  const cp = new THREE.Vector3();
  function clearInBoxes(origin, dir, want) {
    for (let d = 0.1; d <= want; d += 0.05) {
      cp.copy(origin).addScaledVector(dir, d);
      if (!insideBoxes(boxes, cp.x, cp.y, cp.z, 0.1)) return Math.max(0.25, d - 0.08);
    }
    return want;
  }

  // ----- Where you can be (from the set) -----
  function setArea(set) {
    const w = (set && set.walkable) || {};
    zones = Array.isArray(w.zones) && w.zones.length ? w.zones : null;
    heightFn = typeof w.height === 'function' ? w.height : null;
    const own = w.clamp;
    ctl.setWalkable(
      Object.assign({}, w, {
        clamp: (p) => {
          if (own) {
            const q = own(p, astro.group.position.y);
            if (q && q !== p) {
              p.x = q.x;
              p.z = q.z;
            }
          }
          if (zones) zonesClamp(zones, p, astro.group.position.y);
          return p;
        },
      })
    );
    const v = set && set.volume;
    boxes = v && Array.isArray(v.boxes) && v.boxes.length ? v.boxes : null;
    if (boxes) {
      const min = new THREE.Vector3(Infinity, Infinity, Infinity);
      const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      boxes.forEach((b) => {
        min.min(new THREE.Vector3(b.minX, b.minY, b.minZ));
        max.max(new THREE.Vector3(b.maxX, b.maxY, b.maxZ));
      });
      // The set's own clamp knows its real shape; boxes then only bound the camera.
      const ownClamp = typeof v.clamp === 'function' ? v.clamp : null;
      ctl.setVolume(ownClamp && v.min ? { min: v.min, max: v.max, clamp: ownClamp } : { min, max, clamp: (p) => boxesClamp(boxes, p) });
    } else ctl.setVolume(v || null);
    // Camera: Object3D colliders (raycast) or cheap shapes.
    const col = set && set.colliders;
    if (Array.isArray(col)) ctl.setCameraColliders(col.filter((c) => c && c.isObject3D));
    else ctl.setCameraColliders([]);
    const shapes = (set && set.cameraShapes) || (col && !Array.isArray(col) ? col : null);
    ctl.setCameraShapes({ circles: shapes ? shapes.circles || null : null, boxes: shapes ? shapes.boxes || null : null });
  }

  function setMode(m) {
    const next = m === 'zeroG' ? 'zeroG' : 'ground';
    if (next === mode) return;
    mode = next;
    ctl.setMode(next);
    ctl.setRig(Object.assign({}, RIGS[next]));
    if (astro.setFloat) astro.setFloat(next === 'zeroG');
  }

  // ----- Interactables from several sources (director, lockers, pickups) -----
  const items = new Set();
  let dirty = false;
  function addInteractable(item) {
    items.add(item);
    dirty = true;
    return () => {
      if (items.delete(item)) dirty = true;
    };
  }

  function teleport(pos, yaw) {
    if (pos) {
      const p = { x: pos.x, y: pos.y != null ? pos.y : astro.group.position.y, z: pos.z };
      if (mode === 'ground' && heightFn) p.y = heightFn(p.x, p.z);
      ctl.teleport(p, yaw);
    } else if (yaw != null) ctl.teleport(null, yaw);
    ctl.snapCamera();
    ctl.refreshTarget();
  }

  function update(dt) {
    if (dirty) {
      dirty = false;
      ctl.setInteractables([...items]);
    }
    ctl.update(dt);
    const p = astro.group.position;
    if (mode === 'ground') {
      if (heightFn) p.y = heightFn(p.x, p.z);
      else if (zones) {
        const z = zoneAt(zones, p.x, p.z, p.y);
        if (z) p.y += ((z.y || 0) - p.y) * Math.min(1, dt * 12);
      }
    }
  }

  return {
    astro,
    controller: ctl,
    get group() {
      return astro.group;
    },
    get position() {
      return astro.group.position;
    },
    get yaw() {
      return astro.group.rotation.y;
    },
    get mode() {
      return mode;
    },
    setArea,
    setMode,
    addInteractable,
    // What can be used right now (scripts and tests).
    get interactables() {
      return [...items];
    },
    teleport,
    update,
    // Off: no input at all (menus, choices, the bench). Still: no walking,
    // the mouse keeps looking (quick-time events, lines said to your face).
    setEnabled: (on) => ctl.setEnabled(on),
    setStill: (on) => ctl.setMoveEnabled(!on),
    setSpeedScale: (k) => ctl.setSpeedScale(k),
    on: (n, fn) => ctl.on(n, fn),
    lock: () => ctl.lock(),
    release: () => ctl.release(),
    get locked() {
      return ctl.locked;
    },
    dispose() {
      ctl.dispose();
      astro.dispose();
    },
  };
}
