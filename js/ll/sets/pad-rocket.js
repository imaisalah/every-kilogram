// The rocket (an SLS-like stack) on its launch mount, for the pad set.
// Sizes are true to life: an 8.4 m orange core stage, two 3.7 m white
// boosters with five segments, the stage adapter, the upper stage, Orion's
// service module fairing, the crew module under the abort fairing and the
// launch abort tower; about 100 m from the deck to the tip.
import { THREE } from './common.js';
import { std, boxUV, coreMaps, paintMaps, bumpTex, PadBuilder as Builder, realOf } from './pad-kit.js';

export const R = {
  deck: 8, // top of the mount deck
  coreR: 4.2,
  core0: 11, // bottom of the core stage tanks (boattail below)
  core1: 76,
  boosterR: 1.85,
  boosterX: 6.45,
  upperR: 2.6,
  hatchY: 92, // white room floor = hatch sill height
  top: 108,
};

// A lathe profile from [[r, y], ...].
function lathe(pts, seg = 48, phi0 = 0, phiLen = Math.PI * 2) {
  return new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
    phi0,
    phiLen,
  );
}

// A strut between two points (a thin box or cylinder along a segment).
export function strut(b, mat, a, c, w = 0.3, d = w, round = false) {
  const A = new THREE.Vector3(...a);
  const C = new THREE.Vector3(...c);
  const len = A.distanceTo(C);
  const mid = A.clone().add(C).multiplyScalar(0.5);
  const geo = round ? new THREE.CylinderGeometry(w / 2, w / 2, len, 8, 1) : new THREE.BoxGeometry(w, len, d);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), C.clone().sub(A).normalize());
  const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
  b.add(mat, geo, { matrix: m });
}

export function buildRocket(M, o = {}) {
  const group = new THREE.Group();
  group.name = 'rocket';
  const low = o.low;
  const seg = low ? 40 : 72;
  const D = R.deck;

  // ---------- Materials made for the rocket ----------
  const cm = coreMaps(R.core1 - R.core0, { intertank: [0.6, 0.69] });
  const foamBump = bumpTex(256, 24, 41);
  foamBump.repeat.set(10, 40);
  const foam = std({ map: cm.map, roughnessMap: cm.rough, bumpMap: foamBump, bumpScale: 1.5, roughness: 1, metalness: 0, color: 0xffffff });
  const bp = paintMaps({ joints: [0.0, 0.2, 0.4, 0.6, 0.8, 0.985], seams: 6, seed: 33 });
  const boosterPaint = std({ map: bp.map, roughness: 0.55, metalness: 0.05, color: 0xf2f2f2 });
  const up = paintMaps({ joints: [], seams: 12, seed: 35, h: 1024 });
  const upperPaint = std({ map: up.map, roughness: 0.45, metalness: 0.08, color: 0xf4f4f4 });
  const mats = { foam, boosterPaint, upperPaint };
  if (M.env) for (const m of Object.values(mats)) (m.envMap = M.env), (m.envMapIntensity = 0.6);

  const B = new Builder();

  // ---------- Core stage ----------
  const coreH = R.core1 - R.core0;
  const core = new THREE.CylinderGeometry(R.coreR, R.coreR, coreH, seg, 1, true);
  B.add(foam, core, { p: [0, R.core0 + coreH / 2, 0], r: [0, Math.PI * 0.5, 0] });
  // Boattail (dark heat shield) and engines below the tanks.
  B.add(M.darkSteel, lathe([[0.5, D + 0.6], [3.2, D + 1.1], [4.1, R.core0 - 0.3], [R.coreR, R.core0]], seg), {});
  for (const [ex, ez] of [[1.7, 1.7], [-1.7, 1.7], [1.7, -1.7], [-1.7, -1.7]]) {
    const bell = lathe([[0.32, 0], [0.42, -0.4], [0.75, -1.6], [1.15, -3.3], [1.2, -3.4]], 24);
    B.add(M.darkSteel, bell, { p: [ex, D + 1.2, ez] });
    B.add(M.frost, new THREE.TorusGeometry(1.17, 0.06, 6, 24), { p: [ex, D + 1.2 - 3.35, ez], r: [Math.PI / 2, 0, 0] });
  }
  // Forward skirt band and the top of the LOX tank.
  B.add(M.darkSteel, new THREE.CylinderGeometry(R.coreR + 0.03, R.coreR + 0.03, 0.35, seg, 1, true), { p: [0, R.core1 - 1.2, 0] });
  // LOX feedlines and the systems tunnel, down the side that faces the walkway.
  for (const a of [0.22, -0.22]) {
    const r = R.coreR + 0.38;
    const x = Math.sin(a + 0.35) * r;
    const z = Math.cos(a + 0.35) * r;
    B.add(M.frost, new THREE.CylinderGeometry(0.24, 0.24, 41, 12, 1), { p: [x, R.core0 + 0.5 + 20.5, z] });
    for (let y = R.core0 + 2; y < R.core0 + 40; y += 4.2) B.add(M.darkSteel, new THREE.BoxGeometry(0.75, 0.22, 0.75), { p: [x * 0.97, y, z * 0.97], r: [0, a + 0.35, 0] });
    // Elbow into the intertank.
    B.add(M.frost, new THREE.SphereGeometry(0.32, 10, 8), { p: [x, R.core0 + 41, z] });
  }
  {
    const a = -0.55;
    const r = R.coreR + 0.18;
    B.add(M.darkSteel, new THREE.BoxGeometry(0.5, 58, 0.36), { p: [Math.sin(a) * r, R.core0 + 30, Math.cos(a) * r], r: [0, a, 0] });
  }

  // ---------- Boosters ----------
  for (const sx of [-1, 1]) {
    const x = sx * R.boosterX;
    const b0 = D + 3.6; // body starts above the aft skirt
    const b1 = 58;
    B.add(boosterPaint, new THREE.CylinderGeometry(R.boosterR, R.boosterR, b1 - b0, low ? 28 : 40, 1, true), { p: [x, (b0 + b1) / 2, 0] });
    // Aft skirt (flared) and nozzle into the deck hole.
    B.add(upperPaint, lathe([[2.55, D], [2.45, D + 1.2], [1.95, D + 3.2], [R.boosterR, b0]], 32), { p: [x, 0, 0] });
    B.add(M.darkSteel, lathe([[0.8, D + 0.2], [1.0, D - 0.6], [1.6, D - 3.0], [1.75, D - 3.4]], 24), { p: [x, 0, 0] });
    // Stiffener rings at the segment joints.
    for (let i = 1; i < 5; i++) B.add(M.steel, new THREE.CylinderGeometry(R.boosterR + 0.05, R.boosterR + 0.05, 0.28, 32, 1, true), { p: [x, b0 + ((b1 - b0) * i) / 5, 0] });
    // Forward skirt and nose.
    B.add(upperPaint, lathe([[R.boosterR, b1], [R.boosterR, b1 + 2.2], [1.7, b1 + 3.2], [1.3, b1 + 4.6], [0.7, b1 + 5.7], [0.15, b1 + 6.3], [0, b1 + 6.35]], 32), { p: [x, 0, 0] });
    // Systems tunnel down the outer side.
    B.add(M.steel, new THREE.BoxGeometry(0.28, b1 - b0 - 1, 0.42), { p: [x + sx * (R.boosterR + 0.12), (b0 + b1) / 2, 0] });
    // Attach struts to the core: three at the aft ring, a thrust beam forward.
    const inner = sx * (R.boosterX - R.boosterR);
    const coreX = sx * R.coreR;
    for (const [zz, y2] of [[0.9, D + 6], [-0.9, D + 6], [0, D + 4.2]]) strut(B, M.darkSteel, [inner, D + 5, zz], [coreX, y2, zz * 0.5], 0.22, 0.22, true);
    B.add(M.darkSteel, new THREE.BoxGeometry(Math.abs(inner - coreX) + 0.6, 0.6, 0.8), { p: [(inner + coreX) / 2, 53, 0] });
    // Hold-down posts under the aft skirt.
    for (const a of [0.6, 2.5, 3.8, 5.7]) B.add(M.steel, new THREE.BoxGeometry(0.7, 1.2, 0.7), { p: [x + Math.cos(a) * 2.2, D + 0.3, Math.sin(a) * 2.2] });
  }

  // ---------- Upper stack ----------
  const U = R.upperR;
  // Stage adapter cone (core 8.4 m to 5 m).
  B.add(upperPaint, lathe([[R.coreR, R.core1], [R.coreR - 0.05, R.core1 + 0.6], [U + 0.1, R.core1 + 7.6], [U, R.core1 + 8]], seg), {});
  B.add(M.darkSteel, new THREE.CylinderGeometry(R.coreR + 0.04, R.coreR + 0.04, 0.3, seg, 1, true), { p: [0, R.core1 + 0.15, 0] });
  // Upper stage / adapter, then the service module fairing panels.
  B.add(upperPaint, new THREE.CylinderGeometry(U, U, 4, seg, 1, true), { p: [0, 86, 0] });
  B.add(M.darkSteel, new THREE.CylinderGeometry(U + 0.03, U + 0.03, 0.25, seg, 1, true), { p: [0, 88.1, 0] });
  B.add(upperPaint, new THREE.CylinderGeometry(U + 0.04, U + 0.04, 3.7, seg, 1, true), { p: [0, 90.05, 0] });
  B.add(M.darkSteel, new THREE.CylinderGeometry(U + 0.06, U + 0.06, 0.2, seg, 1, true), { p: [0, 91.9, 0] });
  // Abort fairing over the crew module: the band at the white room has a
  // gap where the hatch is (facing -X, toward the tower).
  const fairing = (y0, y1, r0, r1, n = 6) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      pts.push([r0 + (r1 - r0) * Math.sin((k * Math.PI) / 2) ** 1.3, y0 + (y1 - y0) * k]);
    }
    return pts;
  };
  const gap = 0.3; // radians either side of -X
  B.add(upperPaint, lathe(fairing(92, 95.2, U, 2.05, 4), seg, -Math.PI / 2 + gap, Math.PI * 2 - gap * 2), {});
  // The gap lies at phi = -PI/2 in lathe space (x = sin(phi) r): -X. A lip around it.
  B.add(upperPaint, lathe([[2.05, 95.2], [1.75, 96.6], [1.25, 97.6], [0.82, 98.1]], seg), {});
  // Abort motor, nozzles, attitude control ring, jettison motor, nose.
  B.add(upperPaint, new THREE.CylinderGeometry(0.78, 0.82, 4.8, 32, 1, true), { p: [0, 100.5, 0] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    B.add(M.darkSteel, new THREE.CylinderGeometry(0.16, 0.34, 0.9, 12, 1, true), { p: [Math.cos(a) * 0.95, 102.2, Math.sin(a) * 0.95], r: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9], order: 'XYZ' });
  }
  B.add(M.darkSteel, new THREE.CylinderGeometry(0.8, 0.8, 1.3, 32, 1), { p: [0, 103.6, 0] });
  B.add(upperPaint, lathe([[0.8, 104.25], [0.7, 105.6], [0.45, 106.5], [0.12, 107.6], [0.02, 108.2]], 24), {});
  B.add(M.steel, new THREE.CylinderGeometry(0.025, 0.04, 1.4, 6, 1), { p: [0, 108.8, 0] });

  // ---------- The mount: a steel deck on pedestals over the flame trench ----------
  const MB = new Builder();
  const hole = { x: 9.4, z: 3.4 };
  const dx = 14;
  const dz = 11.5;
  const slab = (x0, x1, z0, z1) => MB.add(M.steel, new THREE.BoxGeometry(x1 - x0, 3, z1 - z0), { p: [(x0 + x1) / 2, D - 1.5, (z0 + z1) / 2] });
  slab(-dx, dx, hole.z, dz);
  slab(-dx, dx, -dz, -hole.z);
  slab(-dx, -hole.x, -hole.z, hole.z);
  slab(hole.x, dx, -hole.z, hole.z);
  // Pedestals.
  for (const px of [-11.5, 0, 11.5]) for (const pz of [-8.5, 8.5]) MB.add(M.concrete2, new THREE.BoxGeometry(3.2, D - 3, 3.2), { p: [px, (D - 3) / 2, pz] });
  for (const px of [-11.5, 11.5]) MB.add(M.concrete2, new THREE.BoxGeometry(3.2, D - 3, 2.4), { p: [px, (D - 3) / 2, 0] });
  // Deck girders along the edges (depth).
  for (const pz of [-dz, dz]) MB.add(M.darkSteel, new THREE.BoxGeometry(dx * 2 + 0.4, 0.6, 0.5), { p: [0, D - 3.2, pz] });
  // Flame trench: a dark pit under the hole.
  MB.add(M.pit, new THREE.BoxGeometry(hole.x * 2 + 2, 0.1, hole.z * 2 + 8), { p: [0, 0.02, 0] });
  // Tail service masts (umbilical towers at the back of the core).
  for (const sx of [-1, 1]) {
    const x = sx * 3.0;
    MB.add(M.darkSteel, new THREE.BoxGeometry(2.0, 9, 2.2), { p: [x, D + 4.5, -6.6] });
    MB.add(M.steel, new THREE.BoxGeometry(2.3, 0.4, 2.5), { p: [x, D + 9.2, -6.6] });
    MB.add(M.frost, new THREE.CylinderGeometry(0.26, 0.26, 4.2, 10), { p: [x * 0.9, D + 4.6, -4.9], r: [Math.PI / 2 - 0.25, 0, 0] });
    MB.add(M.darkSteel, new THREE.BoxGeometry(1.2, 1.2, 0.5), { p: [x * 0.75, D + 4, -R.coreR + 0.4] });
  }
  // Deck railing (yellow) along the front edge.
  for (const [x0, z0, x1, z1] of [[-dx + 0.3, dz - 0.3, dx - 0.3, dz - 0.3], [dx - 0.3, -dz + 0.3, dx - 0.3, dz - 0.3], [-dx + 0.3, -dz + 0.3, -dx + 0.3, dz - 0.3]]) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.round(len / 2);
    for (const h of [1.05, 0.55]) strut(MB, M.yellow, [x0, D + h, z0], [x1, D + h, z1], 0.06, 0.06, true);
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      MB.add(M.yellow, new THREE.BoxGeometry(0.06, 1.1, 0.06), { p: [x0 + (x1 - x0) * k, D + 0.55, z0 + (z1 - z0) * k] });
    }
  }
  // Up-light fixtures on the deck corners (lamps glow; beams in pad.js).
  const upLights = [];
  for (const [x, z] of [[11.5, 9.5], [-11.5, 9.5], [11.5, -9.5], [-11.5, -9.5], [0, 10.3]]) {
    MB.add(M.darkSteel, new THREE.BoxGeometry(1.1, 0.7, 0.8), { p: [x, D + 0.35, z], r: [0.5 * Math.sign(z), 0, 0] });
    MB.add(M.lampXenon, new THREE.BoxGeometry(0.9, 0.05, 0.6), { p: [x, D + 0.71, z - 0.15 * Math.sign(z)], r: [0.5 * Math.sign(z), 0, 0] });
    upLights.push([x, D + 0.8, z]);
  }

  const meshes = B.bake(group, { castShadow: true, receiveShadow: true });
  const mount = MB.bake(group, { castShadow: true, receiveShadow: true });
  for (const m of mount) if (m.material === realOf(M.steel) || m.material === realOf(M.concrete2)) boxUV(m.geometry, 6);

  return {
    group,
    meshes: meshes.concat(mount),
    mats,
    upLights,
    // Vapour sources (world positions).
    vents: {
      base: [0, D - 1, 0],
      intertankFront: [0.6, R.core0 + 0.64 * (R.core1 - R.core0), R.coreR + 0.2],
      intertankBack: [-0.6, R.core0 + 0.64 * (R.core1 - R.core0), -R.coreR - 0.2],
      top: [-1.6, R.core1 - 1.5, -R.coreR],
      tsm: [[-3, D + 6, -5.2], [3, D + 6, -5.2]],
    },
    deck: { minX: -dx, maxX: dx, minZ: -dz, maxZ: dz, hole },
    colliders: {
      circles: [
        { x: 0, z: 0, r: R.coreR + 0.3, h: R.top, y0: D },
        { x: R.boosterX, z: 0, r: R.boosterR + 0.25, h: 64, y0: D },
        { x: -R.boosterX, z: 0, r: R.boosterR + 0.25, h: 64, y0: D },
      ],
      boxes: [{ minX: -dx, maxX: dx, minY: 0, maxY: D, minZ: -dz, maxZ: dz }],
    },
  };
}
