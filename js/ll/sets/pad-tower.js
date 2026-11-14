// The service tower for the pad set: a 120 m steel lattice with platforms,
// stairs, lamps and red aircraft lights, umbilical arms, the elevator (shaft
// and a lit cab that rides), the crew access arm at 92 m and the white room at
// its end against Orion's hatch, with the three crates.
import { THREE, canvasTex } from './common.js';
import { std, lamp, boxUV, signTex, font, hazardTex, PadBuilder as Builder, realOf } from './pad-kit.js';
import { signPlane } from './pad-signs.js';
import { strut, R } from './pad-rocket.js';

export const T = {
  x0: -34,
  x1: -22,
  z0: -8,
  z1: 4,
  h: 120,
  level: 6,
  armY: R.hatchY,
  // Elevator shaft (outside the east face) and its cab.
  shaft: { x0: -22.3, x1: -18.9, z0: 2.6, z1: 5.8 },
  cab: { x0: -22.0, x1: -19.2, z0: 2.85, z1: 5.55, h: 2.7 },
  // Arm level: the landing deck, the arm, the white room, the hatch.
  deck: { x0: -22.3, x1: -17.2, z0: -1.8, z1: 2.6 },
  arm: { x0: -17.2, x1: -6.9, z0: -1.25, z1: 1.25 },
  room: { x0: -6.9, x1: -2.65, z0: -2.0, z1: 2.0, h: 2.9 },
};

// The three cargo crates (separate objects so the story can hide or carry
// the one you pick). Each is a Group with its feet at the floor, two draw
// calls (shared paint + the sign atlas for its label).
function buildCrates(M) {
  const out = {};
  // 1. Extra oxygen tank: a white cylinder with green bands, in a cradle.
  {
    const g = new THREE.Group();
    g.name = 'crate_o2';
    const b = new Builder();
    const tank = M.crateWhite;
    const green = M.crateGreen;
    b.add(tank, new THREE.CylinderGeometry(0.24, 0.24, 0.95, 24, 1), { p: [0, 0.38, 0], r: [0, 0, Math.PI / 2] });
    b.add(tank, new THREE.SphereGeometry(0.24, 20, 12), { p: [0.475, 0.38, 0] });
    b.add(tank, new THREE.SphereGeometry(0.24, 20, 12), { p: [-0.475, 0.38, 0] });
    for (const x of [-0.32, 0.32]) b.add(green, new THREE.CylinderGeometry(0.245, 0.245, 0.06, 24, 1, true), { p: [x, 0.38, 0], r: [0, 0, Math.PI / 2] });
    b.add(green, new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), { p: [0.76, 0.38, 0], r: [0, 0, Math.PI / 2] });
    b.add(M.chrome, new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), { p: [0.86, 0.38, 0], r: [0, 0, Math.PI / 2] });
    b.add(M.chrome, new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), { p: [0.9, 0.44, 0] });
    // Cradle: two saddles on skids.
    for (const x of [-0.3, 0.3]) {
      b.add(M.darkSteel, new THREE.BoxGeometry(0.08, 0.2, 0.6), { p: [x, 0.1, 0] });
      b.add(M.darkSteel, new THREE.TorusGeometry(0.25, 0.025, 6, 16, Math.PI), { p: [x, 0.38, 0], r: [0, Math.PI / 2, Math.PI] });
    }
    for (const z of [-0.26, 0.26]) b.add(M.yellow, new THREE.BoxGeometry(1.15, 0.05, 0.06), { p: [0, 0.025, z] });
    b.add(M.signs, signPlane('o2', 0.38, 0.19), { p: [0, 0.4, 0.243] });
    b.bake(g);
    out.crate_o2 = g;
  }
  // 2. Spare CO2 cartridges: an open grey case of LiOH canisters.
  {
    const g = new THREE.Group();
    g.name = 'crate_co2';
    const b = new Builder();
    const W = 0.78;
    const D = 0.56;
    const H = 0.42;
    const cs = M.crateGrey;
    b.add(cs, new THREE.BoxGeometry(W, 0.04, D), { p: [0, 0.02, 0] });
    b.add(cs, new THREE.BoxGeometry(W, H, 0.03), { p: [0, H / 2, D / 2] });
    b.add(cs, new THREE.BoxGeometry(W, H, 0.03), { p: [0, H / 2, -D / 2] });
    b.add(cs, new THREE.BoxGeometry(0.03, H, D), { p: [W / 2, H / 2, 0] });
    b.add(cs, new THREE.BoxGeometry(0.03, H, D), { p: [-W / 2, H / 2, 0] });
    b.add(cs, new THREE.BoxGeometry(W, 0.03, D), { p: [0, H + 0.24, -D / 2 - 0.12], r: [-1.2, 0, 0] });
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        const x = -0.24 + i * 0.24;
        const z = -0.12 + j * 0.24;
        b.add(M.chrome, new THREE.CylinderGeometry(0.1, 0.1, 0.46, 16), { p: [x, 0.25, z] });
        b.add(M.crateBlue, new THREE.CylinderGeometry(0.102, 0.102, 0.05, 16), { p: [x, 0.48, z] });
      }
    for (const x of [-0.42, 0.42]) b.add(M.darkSteel, new THREE.BoxGeometry(0.04, 0.05, 0.18), { p: [x, H - 0.05, 0] });
    b.add(M.signs, signPlane('co2', 0.4, 0.2), { p: [0, 0.22, D / 2 + 0.017] });
    b.bake(g);
    out.crate_co2 = g;
  }
  // 3. High-res camera: a black hard case with yellow latches, lid open.
  {
    const g = new THREE.Group();
    g.name = 'crate_cam';
    const b = new Builder();
    const W = 0.72;
    const D = 0.5;
    b.add(M.crateBlack, new THREE.BoxGeometry(W, 0.28, D), { p: [0, 0.14, 0] });
    b.add(M.crateFoam, new THREE.BoxGeometry(W - 0.06, 0.02, D - 0.06), { p: [0, 0.285, 0] });
    b.add(M.cabinWall, new THREE.BoxGeometry(0.2, 0.13, 0.15), { p: [-0.12, 0.33, 0.02] });
    b.add(M.cabinWall, new THREE.CylinderGeometry(0.055, 0.06, 0.2, 16), { p: [0.06, 0.32, 0.02], r: [0, 0, Math.PI / 2] });
    b.add(M.lens, new THREE.CylinderGeometry(0.045, 0.045, 0.01, 16), { p: [0.165, 0.32, 0.02], r: [0, 0, Math.PI / 2] });
    b.add(M.cabinWall, new THREE.CylinderGeometry(0.05, 0.05, 0.16, 16), { p: [0.2, 0.32, -0.15], r: [0, 0, Math.PI / 2] });
    b.add(M.crateBlack, new THREE.BoxGeometry(W, 0.14, D), { p: [0, 0.5, -D / 2 - 0.02], r: [-1.35, 0, 0] });
    for (const x of [-0.22, 0.22]) b.add(M.yellow, new THREE.BoxGeometry(0.08, 0.07, 0.03), { p: [x, 0.22, D / 2 + 0.01] });
    b.add(M.yellow, new THREE.BoxGeometry(0.22, 0.03, 0.05), { p: [0, 0.29, D / 2 + 0.02] });
    b.add(M.signs, signPlane('cam', 0.26, 0.13), { p: [0, 0.11, D / 2 + 0.002] });
    b.bake(g);
    out.crate_cam = g;
  }
  return out;
}

export function buildTower(M, o = {}) {
  const low = o.low;
  const group = new THREE.Group();
  group.name = 'tower';
  const S = new Builder(); // steel, grating, lamps, ...
  const { x0, x1, z0, z1, h, level } = T;
  const W = x1 - x0;
  const nLev = Math.round(h / level);
  const cols = [0, 4, 8, 12];

  // ---------- Lattice ----------
  for (const cx of cols)
    for (const cz of cols) {
      const corner = (cx === 0 || cx === 12) && (cz === 0 || cz === 12);
      const edge = cx === 0 || cx === 12 || cz === 0 || cz === 12;
      if (!edge) continue;
      const w = corner ? 0.9 : 0.5;
      S.add(M.steel, new THREE.BoxGeometry(w, h, w), { p: [x0 + cx, h / 2, z0 + cz] });
    }
  for (let L = 1; L <= nLev; L++) {
    const y = L * level;
    // Perimeter beams.
    S.add(M.steel, new THREE.BoxGeometry(W, 0.55, 0.4), { p: [x0 + W / 2, y, z0] });
    S.add(M.steel, new THREE.BoxGeometry(W, 0.55, 0.4), { p: [x0 + W / 2, y, z1] });
    S.add(M.steel, new THREE.BoxGeometry(0.4, 0.55, W), { p: [x0, y, z0 + W / 2] });
    S.add(M.steel, new THREE.BoxGeometry(0.4, 0.55, W), { p: [x1, y, z0 + W / 2] });
    // Mid-level girts on the faces.
    if (!low) {
      S.add(M.steel, new THREE.BoxGeometry(W, 0.2, 0.2), { p: [x0 + W / 2, y - level / 2, z0] });
      S.add(M.steel, new THREE.BoxGeometry(0.2, 0.2, W), { p: [x0, y - level / 2, z0 + W / 2] });
    }
    // Diagonals, alternating per level (a zig-zag up every face).
    for (let bay = 0; bay < 3; bay++) {
      const a = bay * 4;
      const flip = (L + bay) % 2 === 0;
      const ya = y - level;
      const yb = y;
      const u0 = flip ? a : a + 4;
      const u1 = flip ? a + 4 : a;
      strut(S, M.steel, [x0 + u0, ya, z0], [x0 + u1, yb, z0], 0.28);
      strut(S, M.steel, [x0 + u0, ya, z1], [x0 + u1, yb, z1], 0.28);
      strut(S, M.steel, [x0, ya, z0 + u0], [x0, yb, z0 + u1], 0.28);
      strut(S, M.steel, [x1, ya, z0 + u0], [x1, yb, z0 + u1], 0.28);
    }
    // Platforms: grating on half the floor, alternating sides; a full floor
    // every fifth level.
    const full = L % 5 === 0;
    const half = L % 2 === 0;
    const px0 = full || half ? x0 : x0 + W / 2;
    const px1 = full || !half ? x1 : x0 + W / 2;
    S.add(M.grating, new THREE.BoxGeometry(px1 - px0 - 0.4, 0.12, W - 0.4), { p: [(px0 + px1) / 2, y + 0.3, z0 + W / 2] });
    // Stairs: one flight per level on the west side.
    if (L < nLev) strut(S, M.darkSteel, [x0 + 1.4, y + 0.3, z0 + 2 + (L % 2) * 3], [x0 + 1.4, y + level + 0.3, z0 + 5 - (L % 2) * 3], 1.0, 0.12);
    // Lamps: sodium on the south and east faces, xenon now and then.
    for (const [lx, lz, face] of [[x0 + 3, z1 + 0.35, 0], [x0 + 9, z1 + 0.35, 0], [x1 + 0.35, z0 + 3, 1], [x1 + 0.35, z0 + 9, 1]]) {
      if (low && (lx === x0 + 3 || lz === z0 + 3)) continue;
      const m = (L * 7 + lx * 3 + lz) % 5 === 0 ? M.lampXenon : M.lampSodium;
      if (((L * 13 + Math.round(lx + lz)) % 4) === 0) continue; // some are off
      S.add(M.darkSteel, new THREE.BoxGeometry(face ? 0.3 : 0.5, 0.28, face ? 0.5 : 0.3), { p: [lx, y - 0.45, lz] });
      S.add(m, new THREE.BoxGeometry(face ? 0.05 : 0.4, 0.18, face ? 0.4 : 0.05), { p: [lx + (face ? 0.17 : 0), y - 0.47, lz + (face ? 0 : 0.17)] });
    }
  }
  // Pipes and cable trays up the east face (toward the rocket).
  for (const [px, pz, r, mat] of [[x1 + 0.7, z0 + 1.2, 0.32, M.frost], [x1 + 0.7, z0 + 2.1, 0.26, M.silverPipe], [x1 + 0.6, z0 + 10.6, 0.12, M.yellow]]) S.add(mat, new THREE.CylinderGeometry(r, r, 86, 12, 1), { p: [px, 43, pz] });
  S.add(M.darkSteel, new THREE.BoxGeometry(0.5, h - 2, 0.12), { p: [x1 + 0.5, h / 2, z0 + 6] });
  // Lightning mast.
  S.add(M.steel, new THREE.CylinderGeometry(0.25, 0.7, 18, 8), { p: [x0 + W / 2, h + 9, z0 + W / 2] });
  S.add(M.steel, new THREE.BoxGeometry(W, 0.9, W), { p: [x0 + W / 2, h + 0.45, z0 + W / 2] });

  // ---------- Umbilical arms (toward the rocket) ----------
  const armTruss = (y, zc, reachX, w = 2.4, hgt = 2.2, frost = true) => {
    const ax0 = x1;
    const ax1 = reachX;
    for (const dy of [0, hgt])
      for (const dz of [-w / 2, w / 2]) S.add(M.steel, new THREE.BoxGeometry(ax1 - ax0, 0.25, 0.25), { p: [(ax0 + ax1) / 2, y + dy, zc + dz] });
    const n = Math.max(2, Math.round((ax1 - ax0) / 2.2));
    for (let i = 0; i < n; i++) {
      const xa = ax0 + ((ax1 - ax0) * i) / n;
      const xb = ax0 + ((ax1 - ax0) * (i + 1)) / n;
      for (const dz of [-w / 2, w / 2]) strut(S, M.steel, [xa, y + (i % 2 ? hgt : 0), zc + dz], [xb, y + (i % 2 ? 0 : hgt), zc + dz], 0.14);
      S.add(M.steel, new THREE.BoxGeometry(0.14, 0.14, w), { p: [xa, y + hgt, zc] });
    }
    if (frost) {
      S.add(M.frost, new THREE.CylinderGeometry(0.2, 0.2, ax1 - ax0, 10), { p: [(ax0 + ax1) / 2, y + 0.6, zc], r: [0, 0, Math.PI / 2] });
      S.add(M.silverPipe, new THREE.CylinderGeometry(0.15, 0.15, ax1 - ax0, 10), { p: [(ax0 + ax1) / 2, y + 1.2, zc + 0.5], r: [0, 0, Math.PI / 2] });
    }
    S.add(M.darkSteel, new THREE.BoxGeometry(0.8, hgt + 0.6, w + 0.4), { p: [ax1, y + hgt / 2, zc] });
  };
  armTruss(70, -3.5, -R.coreR - 0.6);
  armTruss(80, -3.2, -R.upperR - 0.9);
  armTruss(87, -2.4, -R.upperR - 0.5, 2.0, 1.8);

  // ---------- Base ----------
  S.add(M.concrete2, new THREE.BoxGeometry(W + 3, 0.35, W + 3), { p: [x0 + W / 2, 0.17, z0 + W / 2] });
  // Equipment cabinets along the south face.
  for (let i = 0; i < 4; i++) {
    const cx = x0 + 1.5 + i * 2.1;
    S.add(M.cabinet, new THREE.BoxGeometry(1.6, 2.1, 0.8), { p: [cx, 1.4, z1 + 1.0] });
    S.add(i % 2 ? M.lampGreen : M.lampAmber, new THREE.BoxGeometry(0.08, 0.05, 0.02), { p: [cx + 0.5, 2.1, z1 + 1.41] });
  }

  // ---------- Elevator shaft ----------
  const sh = T.shaft;
  const topY = T.armY + 5;
  for (const [sx, sz] of [[sh.x0, sh.z0], [sh.x1, sh.z0], [sh.x0, sh.z1], [sh.x1, sh.z1]]) S.add(M.steel, new THREE.BoxGeometry(0.3, topY, 0.3), { p: [sx, topY / 2, sz] });
  for (let y = 3; y < topY; y += 3) {
    S.add(M.steel, new THREE.BoxGeometry(sh.x1 - sh.x0, 0.14, 0.14), { p: [(sh.x0 + sh.x1) / 2, y, sh.z1] });
    S.add(M.steel, new THREE.BoxGeometry(0.14, 0.14, sh.z1 - sh.z0), { p: [sh.x1, y, (sh.z0 + sh.z1) / 2] });
    if (!low && y % 6 === 0) strut(S, M.steel, [sh.x1, y - 3, sh.z0], [sh.x1, y, sh.z1], 0.1);
  }
  // Machine room on top.
  S.add(M.cabinet, new THREE.BoxGeometry(sh.x1 - sh.x0 + 0.4, 2.4, sh.z1 - sh.z0 + 0.4), { p: [(sh.x0 + sh.x1) / 2, topY + 1.2, (sh.z0 + sh.z1) / 2] });
  // Ground landing: canopy with a warm lamp over the cab door, hazard sill.
  S.add(M.darkSteel, new THREE.BoxGeometry(4.2, 0.18, 2.6), { p: [(sh.x0 + sh.x1) / 2, 3.25, sh.z1 + 1.1] });
  S.add(M.lampSodium, new THREE.BoxGeometry(1.2, 0.05, 0.3), { p: [(sh.x0 + sh.x1) / 2, 3.14, sh.z1 + 1.4] });
  S.add(M.hazard, new THREE.BoxGeometry(3.0, 0.02, 0.5), { p: [(sh.x0 + sh.x1) / 2, 0.36, sh.z1 + 0.3] });

  // ---------- Arm level: landing deck, crew access arm, white room ----------
  const Y = T.armY;
  const dk = T.deck;
  const am = T.arm;
  const rm = T.room;
  // Landing deck.
  S.add(M.grating, new THREE.BoxGeometry(dk.x1 - dk.x0, 0.25, dk.z1 - dk.z0), { p: [(dk.x0 + dk.x1) / 2, Y - 0.125, (dk.z0 + dk.z1) / 2] });
  S.add(M.steel, new THREE.BoxGeometry(dk.x1 - dk.x0, 0.6, 0.3), { p: [(dk.x0 + dk.x1) / 2, Y - 0.55, dk.z0] });
  for (const [ax, az, bx, bz] of [[dk.x0, dk.z0, dk.x1, dk.z0], [dk.x1, dk.z0, dk.x1, am.z0], [dk.x1, am.z1, dk.x1, dk.z1]]) {
    for (const hh of [1.1, 0.55]) strut(S, M.yellow, [ax, Y + hh, az], [bx, Y + hh, bz], 0.05, 0.05, true);
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 1.2));
    for (let i = 0; i <= n; i++) S.add(M.yellow, new THREE.BoxGeometry(0.05, 1.1, 0.05), { p: [ax + ((bx - ax) * i) / n, Y + 0.55, az + ((bz - az) * i) / n] });
  }
  // Deck lamp (cool) on the tower face.
  S.add(M.lampXenon, new THREE.BoxGeometry(0.06, 0.25, 0.8), { p: [x1 + 0.25, Y + 2.6, 0.4] });

  // The arm: floor, under-truss, low side walls, posts, roof with strip lights.
  const AL = am.x1 - am.x0;
  const acx = (am.x0 + am.x1) / 2;
  S.add(M.grating, new THREE.BoxGeometry(AL, 0.2, am.z1 - am.z0), { p: [acx, Y - 0.1, 0] });
  for (const z of [am.z0, am.z1]) {
    S.add(M.steel, new THREE.BoxGeometry(AL, 0.4, 0.3), { p: [acx, Y - 0.35, z] });
    S.add(M.steel, new THREE.BoxGeometry(AL, 0.3, 0.3), { p: [acx, Y - 1.9, z] });
    const n = 6;
    for (let i = 0; i < n; i++) {
      const xa = am.x0 + (AL * i) / n;
      const xb = am.x0 + (AL * (i + 1)) / n;
      strut(S, M.steel, [xa, Y - (i % 2 ? 0.4 : 1.9), z], [xb, Y - (i % 2 ? 1.9 : 0.4), z], 0.18);
    }
    // Side wall: low panels, posts, upper rail, window frames.
    S.add(M.panel, new THREE.BoxGeometry(AL, 1.0, 0.06), { p: [acx, Y + 0.5, z] });
    for (let i = 0; i <= 6; i++) S.add(M.steel, new THREE.BoxGeometry(0.12, 2.5, 0.12), { p: [am.x0 + (AL * i) / 6, Y + 1.25, z] });
    S.add(M.yellow, new THREE.BoxGeometry(AL, 0.06, 0.08), { p: [acx, Y + 1.05, z + (z < 0 ? 0.08 : -0.08)] });
    S.add(M.steel, new THREE.BoxGeometry(AL, 0.12, 0.12), { p: [acx, Y + 2.5, z] });
  }
  // Roof: panels with a strip light down the middle.
  S.add(M.panel, new THREE.BoxGeometry(AL, 0.12, am.z1 - am.z0 + 0.3), { p: [acx, Y + 2.62, 0] });
  for (let i = 0; i < 4; i++) S.add(M.lampCool, new THREE.BoxGeometry(1.2, 0.04, 0.18), { p: [am.x0 + 1.4 + i * 2.5, Y + 2.54, 0] });
  // Cable tray and pipes under the arm.
  S.add(M.darkSteel, new THREE.BoxGeometry(AL, 0.12, 0.5), { p: [acx, Y - 0.75, 0.3] });
  S.add(M.frost, new THREE.CylinderGeometry(0.09, 0.09, AL, 8), { p: [acx, Y - 0.62, -0.45], r: [0, 0, Math.PI / 2] });
  // Ice on the south rail near the tower (the optional "knock the ice off").
  for (let i = 0; i < 14; i++) {
    const x = am.x0 + 0.4 + i * 0.16 + ((i * 37) % 7) * 0.02;
    const len = 0.08 + ((i * 53) % 9) * 0.025;
    S.add(M.ice, new THREE.ConeGeometry(0.025, len, 5), { p: [x, Y + 1.02 - len / 2, am.z1 - 0.1], r: [Math.PI, 0, 0] });
  }
  S.add(M.ice, new THREE.BoxGeometry(2.4, 0.04, 0.11), { p: [am.x0 + 1.5, Y + 1.09, am.z1 - 0.08] });

  // White room.
  const RH = rm.h;
  const rcx = (rm.x0 + rm.x1) / 2;
  const RL = rm.x1 - rm.x0;
  S.add(M.roomFloor, new THREE.BoxGeometry(RL + 1.2, 0.25, rm.z1 - rm.z0), { p: [rcx + 0.6, Y - 0.125, 0] });
  S.add(M.steel, new THREE.BoxGeometry(RL + 1.2, 1.2, rm.z1 - rm.z0 + 0.2), { p: [rcx + 0.6, Y - 0.85, 0] });
  // Walls (outside white paint, inside light panels: both are the room material).
  const wall = (cx, cy, cz, sx, sy, sz) => S.add(M.roomWall, new THREE.BoxGeometry(sx, sy, sz), { p: [cx, cy, cz] });
  // North wall (solid) and south wall (a window band).
  wall(rcx + 0.6, Y + RH / 2, rm.z0 - 0.06, RL + 1.2, RH, 0.12);
  wall(rcx + 0.6, Y + 0.55, rm.z1 + 0.06, RL + 1.2, 1.1, 0.12);
  wall(rcx + 0.6, Y + RH - 0.35, rm.z1 + 0.06, RL + 1.2, 0.7, 0.12);
  for (const x of [rm.x0 + 0.05, rm.x0 + 1.5, rm.x0 + 3.0, rm.x1 + 0.55]) wall(x, Y + 1.55, rm.z1 + 0.06, 0.16, 0.9, 0.12);
  S.add(M.glass, new THREE.BoxGeometry(RL + 1.2, 0.9, 0.03), { p: [rcx + 0.6, Y + 1.55, rm.z1 + 0.06] });
  // West wall with the door from the arm.
  wall(rm.x0 - 0.06, Y + RH / 2, (rm.z0 + am.z0) / 2 - 0.02, 0.12, RH, am.z0 - rm.z0);
  wall(rm.x0 - 0.06, Y + RH / 2, (rm.z1 + am.z1) / 2 + 0.02, 0.12, RH, rm.z1 - am.z1);
  wall(rm.x0 - 0.06, Y + RH - 0.25, 0, 0.12, 0.5, am.z1 - am.z0);
  // East wall against the capsule, with the hatch opening.
  const hz = 0.62;
  const hy0 = 0.32;
  const hy1 = 1.95;
  wall(rm.x1 + 0.06, Y + RH / 2, (rm.z0 - hz) / 2, 0.12, RH, -hz - rm.z0);
  wall(rm.x1 + 0.06, Y + RH / 2, (rm.z1 + hz) / 2, 0.12, RH, rm.z1 - hz);
  wall(rm.x1 + 0.06, Y + hy0 / 2, 0, 0.12, hy0, hz * 2);
  wall(rm.x1 + 0.06, Y + (RH + hy1) / 2, 0, 0.12, RH - hy1, hz * 2);
  // Side cheeks that close the gap between the flat wall and the round capsule.
  for (const z of [rm.z0 - 0.06, rm.z1 + 0.06]) wall(rm.x1 + 0.6, Y + RH / 2, z, 1.1, RH, 0.12);
  wall(rcx + 0.6, Y + RH + 0.06, 0, RL + 1.2, 0.12, rm.z1 - rm.z0 + 0.24);
  // Hatch frame (dark, chunky) and the hatch door swung open against the wall.
  for (const [cx, cy, sx, sy] of [[0, hy0 - 0.04, hz * 2 + 0.2, 0.1], [0, hy1 + 0.04, hz * 2 + 0.2, 0.1], [-hz - 0.05, (hy0 + hy1) / 2, 0.1, hy1 - hy0], [hz + 0.05, (hy0 + hy1) / 2, 0.1, hy1 - hy0]])
    S.add(M.darkSteel, new THREE.BoxGeometry(0.2, sy, sx), { p: [rm.x1 - 0.02, Y + cy, cx] });
  S.add(M.hatchDoor, new THREE.BoxGeometry(0.12, hy1 - hy0, hz * 2), { p: [rm.x1 - 0.7, Y + (hy0 + hy1) / 2, hz + 0.72], r: [0, -1.25, 0] });
  // Capsule interior glimpse beyond the hatch: dark walls, panels, a seat.
  const ci = { x0: rm.x1 + 0.1, x1: rm.x1 + 2.3 };
  S.add(M.cabinWall, new THREE.BoxGeometry(ci.x1 - ci.x0, 0.1, 1.9), { p: [(ci.x0 + ci.x1) / 2, Y + 0.05, 0] });
  S.add(M.cabinWall, new THREE.BoxGeometry(ci.x1 - ci.x0, 0.1, 1.9), { p: [(ci.x0 + ci.x1) / 2, Y + 2.1, 0] });
  S.add(M.cabinWall, new THREE.BoxGeometry(0.1, 2.1, 1.9), { p: [ci.x1, Y + 1.05, 0] });
  for (const z of [-0.95, 0.95]) S.add(M.cabinWall, new THREE.BoxGeometry(ci.x1 - ci.x0, 2.1, 0.1), { p: [(ci.x0 + ci.x1) / 2, Y + 1.05, z] });
  S.add(M.screen, new THREE.BoxGeometry(0.02, 0.32, 0.5), { p: [ci.x1 - 0.06, Y + 1.5, -0.35], r: [0, 0, 0.3] });
  S.add(M.screen, new THREE.BoxGeometry(0.02, 0.32, 0.5), { p: [ci.x1 - 0.06, Y + 1.5, 0.35], r: [0, 0, 0.3] });
  S.add(M.lampAmber, new THREE.BoxGeometry(0.02, 0.04, 0.6), { p: [ci.x1 - 0.06, Y + 1.15, 0] });
  S.add(M.seat, new THREE.BoxGeometry(0.7, 0.18, 0.6), { p: [ci.x0 + 1.25, Y + 0.55, 0] });
  S.add(M.seat, new THREE.BoxGeometry(0.15, 0.8, 0.6), { p: [ci.x0 + 0.9, Y + 0.95, 0], r: [0, 0, 0.5] });

  // White room interior: ceiling lights, a bench, handrails, floor tape.
  for (const x of [rm.x0 + 1.0, rm.x0 + 2.9]) S.add(M.lampRoom, new THREE.BoxGeometry(1.3, 0.04, 0.5), { p: [x, Y + RH - 0.02, 0] });
  S.add(M.steel, new THREE.BoxGeometry(1.5, 0.08, 0.4), { p: [rm.x0 + 1.4, Y + 0.45, rm.z1 - 0.25] });
  for (const x of [rm.x0 + 0.8, rm.x0 + 2.0]) S.add(M.darkSteel, new THREE.BoxGeometry(0.06, 0.45, 0.35), { p: [x, Y + 0.22, rm.z1 - 0.25] });
  strut(S, M.yellow, [rm.x1 - 0.12, Y + 1.0, -0.9], [rm.x1 - 0.12, Y + 1.9, -0.9], 0.04, 0.04, true);
  strut(S, M.yellow, [rm.x1 - 0.12, Y + 1.0, 0.9], [rm.x1 - 0.12, Y + 1.9, 0.9], 0.04, 0.04, true);
  S.add(M.hazard, new THREE.BoxGeometry(0.25, 0.01, hz * 2 + 0.3), { p: [rm.x1 - 0.2, Y + 0.006, 0] });
  // Shelf with helmet bags on the north wall, above the crates.
  S.add(M.steel, new THREE.BoxGeometry(RL - 0.4, 0.04, 0.35), { p: [rcx, Y + 1.85, rm.z0 + 0.2] });
  for (let i = 0; i < 4; i++) S.add(M.bag, new THREE.BoxGeometry(0.42, 0.34, 0.3), { p: [rm.x0 + 0.6 + i * 0.95, Y + 2.05, rm.z0 + 0.2] });

  // Signs (the shared atlas).
  const sgn = (name, w, h, p, r) => S.add(M.signs, signPlane(name, w, h), { p, r });
  sgn('whiteroom', 1.6, 0.2, [rm.x0 + 0.02, Y + 2.45, 0], [0, Math.PI / 2, 0]);
  sgn('whiteroom', 1.4, 0.175, [rm.x0 - 0.13, Y + 2.45, 0], [0, -Math.PI / 2, 0]);
  sgn('door', 0.5, 0.25, [rm.x0 + 0.02, Y + 1.5, am.z1 + 0.35], [0, Math.PI / 2, 0]);
  sgn('elevator', 1.8, 0.225, [(sh.x0 + sh.x1) / 2, 2.85, sh.z1 + 0.18], [0, 0, 0]);
  sgn('level', 1.4, 0.175, [x1 + 0.02, Y + 1.9, 1.2], [0, Math.PI / 2, 0]);
  sgn('hatch', 1.0, 0.125, [rm.x1 - 0.01, Y + 2.15, 0], [0, -Math.PI / 2, 0]);

  // ---------- Red aircraft warning lights ----------
  const R2 = new Builder();
  for (const y of [30, 60, 90, 120])
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) R2.add(M.lampRed, new THREE.SphereGeometry(0.28, 8, 6), { p: [cx + (cx === x0 ? -0.5 : 0.5), y + 0.6, cz + (cz === z0 ? -0.5 : 0.5)] });
  R2.add(M.lampRed, new THREE.SphereGeometry(0.35, 8, 6), { p: [x0 + W / 2, h + 18.4, z0 + W / 2] });

  const meshes = S.bake(group, { castShadow: true, receiveShadow: true });
  for (const m of meshes) {
    if (m.material === realOf(M.steel) || m.material === realOf(M.concrete2)) boxUV(m.geometry, 3);
    if (m.material === realOf(M.grating)) boxUV(m.geometry, 1.2);
    if (m.material.isMeshBasicMaterial) m.castShadow = false;
  }
  const red = R2.bake(group, { castShadow: false, receiveShadow: false });

  // ---------- Elevator cab (moves) ----------
  const cab = new THREE.Group();
  cab.name = 'elevator-cab';
  const c = T.cab;
  const cw = c.x1 - c.x0;
  const cd = c.z1 - c.z0;
  const CB = new Builder();
  CB.add(M.darkSteel, new THREE.BoxGeometry(cw, 0.15, cd), { p: [0, -0.075, 0] });
  CB.add(M.darkSteel, new THREE.BoxGeometry(cw, 0.12, cd), { p: [0, c.h + 0.06, 0] });
  for (const sx of [-1, 1]) {
    CB.add(M.cabWall, new THREE.BoxGeometry(0.06, 1.1, cd), { p: [(sx * cw) / 2, 0.55, 0] });
    CB.add(M.mesh, new THREE.BoxGeometry(0.03, c.h - 1.1, cd), { p: [(sx * cw) / 2, 1.1 + (c.h - 1.1) / 2, 0] });
    for (const sz of [-1, 1]) CB.add(M.yellow, new THREE.BoxGeometry(0.1, c.h, 0.1), { p: [(sx * cw) / 2, c.h / 2, (sz * cd) / 2] });
  }
  CB.add(M.lampCool, new THREE.BoxGeometry(cw * 0.6, 0.03, cd * 0.5), { p: [0, c.h - 0.02, 0] });
  CB.add(M.yellow, new THREE.BoxGeometry(cw, 0.012, 0.12), { p: [0, 0.006, cd / 2 - 0.1] });
  CB.add(M.yellow, new THREE.BoxGeometry(cw, 0.012, 0.12), { p: [0, 0.006, -cd / 2 + 0.1] });
  CB.add(M.lampAmber, new THREE.BoxGeometry(0.12, 0.2, 0.03), { p: [cw / 2 - 0.25, 1.4, cd / 2 - 0.05] });
  CB.bake(cab, { castShadow: true, receiveShadow: true });
  // Sliding gates (north and south), two leaves each: one instanced mesh.
  const gates = { n: [], s: [] };
  const gateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(cw / 2, c.h - 0.1, 0.04), M.gate, 4);
  gateMesh.castShadow = true;
  gateMesh.frustumCulled = false;
  cab.add(gateMesh);
  for (const side of ['n', 's']) {
    const z = side === 's' ? cd / 2 - 0.03 : -cd / 2 + 0.03;
    for (const sx of [-1, 1]) {
      const leaf = new THREE.Object3D();
      leaf.position.set((sx * cw) / 4, (c.h - 0.1) / 2, z);
      leaf.userData.closedX = (sx * cw) / 4;
      leaf.userData.openX = (sx * cw) / 4 + sx * (cw / 2 - 0.12);
      gates[side].push(leaf);
    }
  }
  const leaves = gates.n.concat(gates.s);
  const syncGates = () => {
    leaves.forEach((l, i) => {
      l.updateMatrix();
      gateMesh.setMatrixAt(i, l.matrix);
    });
    gateMesh.instanceMatrix.needsUpdate = true;
  };
  syncGates();
  const cabLight = new THREE.PointLight(0xdde8ff, 5, 8, 2);
  cabLight.position.set(0, c.h - 0.4, 0);
  cab.add(cabLight);
  cab.position.set((c.x0 + c.x1) / 2, 0.36, (c.z0 + c.z1) / 2);
  group.add(cab);

  // ---------- Crates in the white room ----------
  const crates = buildCrates(M);
  const crateX = { crate_o2: rm.x0 + 0.85, crate_co2: rm.x0 + 2.15, crate_cam: rm.x0 + 3.25 };
  for (const [k, g] of Object.entries(crates)) {
    g.position.set(crateX[k], Y, rm.z0 + 0.42);
    g.traverse((m) => m.isMesh && ((m.castShadow = true), (m.receiveShadow = true)));
    group.add(g);
  }

  return {
    group,
    meshes,
    red,
    cab,
    cabLight,
    gates,
    syncGates,
    crates,
    crateX,
    colliders: {
      circles: [],
      boxes: [
        { minX: x0 - 0.5, maxX: x1 + 0.5, minY: 0, maxY: h + 1, minZ: z0 - 0.5, maxZ: z1 + 0.5 },
        { minX: sh.x0, maxX: sh.x1, minY: 0, maxY: topY, minZ: sh.z0, maxZ: sh.z1 },
      ],
      // The white room walls and roof, for the camera at the arm level.
      room: [
        { minX: rm.x0 - 0.12, maxX: rm.x1 + 1.2, minY: Y - 1.5, maxY: Y, minZ: rm.z0 - 0.12, maxZ: rm.z1 + 0.12 },
        { minX: rm.x0 - 0.12, maxX: rm.x1 + 1.2, minY: Y + RH, maxY: Y + RH + 0.2, minZ: rm.z0 - 0.12, maxZ: rm.z1 + 0.12 },
        { minX: rm.x0 - 0.12, maxX: rm.x1 + 1.2, minY: Y, maxY: Y + RH, minZ: rm.z0 - 0.14, maxZ: rm.z0 },
        { minX: rm.x0 - 0.12, maxX: rm.x1 + 1.2, minY: Y, maxY: Y + RH, minZ: rm.z1, maxZ: rm.z1 + 0.14 },
        { minX: am.x0, maxX: am.x1, minY: Y + 2.55, maxY: Y + 2.7, minZ: am.z0, maxZ: am.z1 },
      ],
    },
  };
}

export { canvasTex, hazardTex, lamp };
