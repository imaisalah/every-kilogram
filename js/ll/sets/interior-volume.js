// The free-float space of the Last Light interior (capsule "Lantern" ->
// docking tunnel -> habitat "Ibis"), shared by interior.js and the tests.
// Pure maths, no THREE: works on any {x, y, z}.
//
// Frame: metres, y up, +z forward along the stack. The capsule's heat-shield
// bulkhead is at z = 0, the tunnel runs z 2.5 -> 4.4, the habitat z 4.4 -> 9.4.
// The stack's axis is at y = AXY (1.2); the capsule deck is at y = 0, so the
// whole interior is at y >= 0.
//
// The zero-g controller (js/3d/controller.js) passes the character's FEET
// point p. We treat the body as a capsule from p to p + (0, 1, 0) with a
// radius of RB: its centre c = p + (0, 0.5, 0) must stay inside one of three
// overlapping convex parts (the allowed places for c). Outside all of them,
// c moves to the nearest point of the nearest part, which reads as a soft
// wall. The parts overlap where the modules join, so the way through is
// always open; in the tunnel the centre is held close to the axis.

export const AXY = 1.2;
export const DIMS = {
  cap: { z0: 0, z1: 2.5, r0: 2.3, r1: 1.05, deck: 0 },
  tun: { z0: 2.5, z1: 4.4, r: 0.7, clear: 0.6 },
  hab: { z0: 4.4, z1: 9.4, hw: 1.2, hh: 1.15, ch: 0.42, hull: 2.0 },
};

export const BODY = { half: 0.5, radius: 0.28 };

export const capRadius = (z) => {
  const c = DIMS.cap;
  const k = Math.max(0, Math.min(1, (z - c.z0) / (c.z1 - c.z0)));
  return c.r0 + (c.r1 - c.r0) * k;
};

const clampN = (x, a, b) => (x < a ? a : x > b ? b : x);

// Closest point of a disk (centre 0,0, radius r) cut by y >= yMin.
function diskCut(x, y, r, yMin, out) {
  if (y >= yMin && x * x + y * y <= r * r) {
    out.x = x;
    out.y = y;
    return out;
  }
  let px = x;
  let py = y;
  const d = Math.hypot(px, py);
  if (d > r) {
    px = (px / d) * r;
    py = (py / d) * r;
  }
  if (py < yMin) {
    if (yMin > r) {
      // Empty cut: keep the top of the disk.
      out.x = 0;
      out.y = r;
      return out;
    }
    const hw = Math.sqrt(Math.max(0, r * r - yMin * yMin));
    px = clampN(x, -hw, hw);
    py = yMin;
  }
  out.x = px;
  out.y = py;
  return out;
}

// Each part: project(cx, cy, cz, out) -> out {x, y, z}.
const PARTS = [
  {
    id: 'capsule',
    // Both ends of the body (c +- h) inside the cone shrunk by the body
    // radius, and the feet above the deck: a lens cut by a line (convex).
    project(cx, cy, cz, out) {
      const R = BODY.radius;
      const z = clampN(cz, DIMS.cap.z0 + R + 0.02, DIMS.cap.z1);
      const rr = capRadius(z) - R;
      const h = Math.max(0, Math.min(BODY.half, rr - 0.16));
      const yMin = DIMS.cap.deck - AXY + BODY.half + 0.01;
      const inside = (x, y) => y >= yMin - 1e-6 && x * x + (Math.abs(y) + h) ** 2 <= rr * rr + 1e-6;
      let x = cx;
      let y = cy - AXY;
      out.z = z;
      if (inside(x, y)) {
        out.x = x;
        out.y = y + AXY;
        return out;
      }
      // Alternating projections onto the two disks and the deck line.
      for (let k = 0; k < 6; k++) {
        for (const oy of [-h, h]) {
          const dx = x;
          const dy = y - oy;
          const d = Math.hypot(dx, dy);
          if (d > rr) {
            x = (dx / d) * rr;
            y = oy + (dy / d) * rr;
          }
        }
        if (y < yMin) y = yMin;
      }
      if (!inside(x, y)) {
        // Bisect toward a point that is surely inside (on the axis).
        let lo = 0;
        let hi = 1;
        const ay = Math.max(0, yMin);
        for (let k = 0; k < 14; k++) {
          const m = (lo + hi) / 2;
          if (inside(x * m, ay + (y - ay) * m)) lo = m;
          else hi = m;
        }
        x *= lo;
        y = ay + (y - ay) * lo;
      }
      out.x = x;
      out.y = y + AXY;
      return out;
    },
  },
  {
    id: 'tunnel',
    project(cx, cy, cz, out) {
      const z = clampN(cz, DIMS.tun.z0 - 0.2, DIMS.tun.z1 + 0.45);
      diskCut(cx, cy - AXY, 0.14, -1, out);
      out.y += AXY;
      out.z = z;
      return out;
    },
  },
  {
    id: 'habitat',
    project(cx, cy, cz, out) {
      const H = DIMS.hab;
      const R = BODY.radius;
      out.x = clampN(cx, -H.hw + R + 0.02, H.hw - R - 0.02);
      out.y = clampN(cy, AXY - H.hh + BODY.half + 0.01, AXY + H.hh - BODY.half - 0.01);
      out.z = clampN(cz, H.z0 + R + 0.02, H.z1 - R - 0.02);
      return out;
    },
  },
];

const tmp = { x: 0, y: 0, z: 0 };
// Which part holds the body centre for feet point p (or null).
export function partAt(p) {
  const cx = p.x;
  const cy = p.y + BODY.half;
  const cz = p.z;
  for (const part of PARTS) {
    part.project(cx, cy, cz, tmp);
    if (Math.abs(tmp.x - cx) + Math.abs(tmp.y - cy) + Math.abs(tmp.z - cz) < 1e-5) return part.id;
  }
  return null;
}

// Keep the feet point p inside the interior. Mutates and returns p.
export function clampFeet(p) {
  if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {
    p.x = 0;
    p.y = 0.6;
    p.z = 1;
    return p;
  }
  const cx = p.x;
  const cy = p.y + BODY.half;
  const cz = p.z;
  let best = Infinity;
  let bx = cx;
  let by = cy;
  let bz = cz;
  for (const part of PARTS) {
    part.project(cx, cy, cz, tmp);
    const d = (tmp.x - cx) ** 2 + (tmp.y - cy) ** 2 + (tmp.z - cz) ** 2;
    if (d < 1e-10) return p;
    if (d < best) {
      best = d;
      bx = tmp.x;
      by = tmp.y;
      bz = tmp.z;
    }
  }
  p.x = bx;
  p.y = by - BODY.half;
  p.z = bz;
  return p;
}

// The union's bounding box (feet point range for the controller's own box).
export const BOX = {
  min: { x: -DIMS.cap.r0, y: DIMS.cap.deck, z: DIMS.cap.z0 },
  max: { x: DIMS.cap.r0, y: AXY + DIMS.cap.r0, z: DIMS.hab.z1 },
};

// Rooms as boxes (js/ll/player.js: the body and the camera stay inside their
// union): three slices of the capsule cone, the tunnel, the habitat. Each is
// a little inside the real walls; clampFeet() refines the cone.
export const BOXES = [
  { id: 'cap_aft', minX: -1.5, maxX: 1.5, minY: 0, maxY: 2.75, minZ: 0, maxZ: 1.0 },
  { id: 'cap_mid', minX: -1.15, maxX: 1.15, minY: 0, maxY: 2.45, minZ: 0.8, maxZ: 1.9 },
  { id: 'cap_nose', minX: -0.8, maxX: 0.8, minY: 0.25, maxY: 2.15, minZ: 1.7, maxZ: 2.75 },
  { id: 'tunnel', minX: -0.62, maxX: 0.62, minY: AXY - 0.62, maxY: AXY + 0.62, minZ: 2.3, maxZ: 4.9 },
  { id: 'habitat', minX: -1.2, maxX: 1.2, minY: AXY - 1.15, maxY: AXY + 1.15, minZ: 4.4, maxZ: 9.4 },
];
