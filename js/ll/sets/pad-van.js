// The crew van for the pad set: a rounded silver electric van (no logos),
// headlights on, sliding door open with a warm interior.
import { THREE, lightBeam } from './common.js';
import { std, virt, PadBuilder as Builder } from './pad-kit.js';

export function buildVan(M, o = {}) {
  const group = new THREE.Group();
  group.name = 'van';
  const L = 5.9;
  const Wd = 2.0; // body width without the bevel
  const H = 2.45;
  const clr = 0.36;
  const wheelX = [-1.95, 1.9];
  const wr = 0.42;

  // Side profile (x along the length, front at +x), wheel arches cut out.
  const s = new THREE.Shape();
  s.moveTo(-L / 2, clr + 0.1);
  s.lineTo(-L / 2, H - 0.3);
  s.quadraticCurveTo(-L / 2, H, -L / 2 + 0.35, H);
  s.lineTo(1.75, H);
  s.quadraticCurveTo(2.15, H, 2.35, H - 0.35);
  s.lineTo(2.78, 1.42);
  s.quadraticCurveTo(L / 2, 1.3, L / 2, 1.1);
  s.lineTo(L / 2, clr + 0.15);
  s.quadraticCurveTo(L / 2, clr, L / 2 - 0.2, clr);
  for (const wx of [wheelX[1], wheelX[0]]) {
    s.lineTo(wx + wr + 0.1, clr);
    s.absarc(wx, clr, wr + 0.1, 0, Math.PI, false);
  }
  s.lineTo(-L / 2 + 0.15, clr);
  s.quadraticCurveTo(-L / 2, clr, -L / 2, clr + 0.1);
  const bev = 0.09;
  const body = new THREE.ExtrudeGeometry(s, { depth: Wd, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 10 });
  body.translate(0, 0, -Wd / 2);

  // Silver paint, the blue stripe and the rims share one metallic material.
  const vanR = std({ vertexColors: true, roughness: 0.3, metalness: 0.75 });
  if (M.env) (vanR.envMap = M.env), (vanR.envMapIntensity = 1.3);
  const paint = virt(vanR, 0xc5cbd1);
  const stripe = virt(vanR, 0x1d4f91);
  const rim = virt(vanR, 0x9ea6ad);
  const glass = M.glass;
  const trim = M.seat;
  const inside = M.cabinWall;
  const warm = M.lampInside;
  const head = M.lampHead;
  const tail = M.lampTail;
  const B = new Builder();
  B.add(paint, body);
  // Window band (sides), poking out of the body a hair.
  const w = new THREE.Shape();
  w.moveTo(-L / 2 + 0.25, 1.48);
  w.lineTo(-L / 2 + 0.25, H - 0.32);
  w.lineTo(1.7, H - 0.22);
  w.lineTo(2.22, H - 0.4);
  w.lineTo(2.62, 1.52);
  w.lineTo(-L / 2 + 0.25, 1.48);
  const wg = new THREE.ExtrudeGeometry(w, { depth: Wd + bev * 2 + 0.02, bevelEnabled: false });
  wg.translate(0, 0, -(Wd + bev * 2 + 0.02) / 2);
  B.add(glass, wg);
  // Pillars over the glass band.
  for (const px of [-1.4, -0.1, 1.1]) B.add(paint, new THREE.BoxGeometry(0.14, 0.86, Wd + bev * 2 + 0.05), { p: [px, 1.9, 0], r: [0, 0, 0.02] });
  // Windshield on the slope.
  const ws = new THREE.BoxGeometry(1.05, 0.03, Wd - 0.05);
  B.add(glass, ws, { p: [2.5, 1.98, 0], r: [0, 0, -1.03] });
  // Rear window.
  B.add(glass, new THREE.BoxGeometry(0.03, 0.6, 1.5), { p: [-L / 2 - bev - 0.005, 1.85, 0] });
  // Stripe and lower trim.
  for (const sz of [-1, 1]) {
    B.add(stripe, new THREE.BoxGeometry(L - 1.2, 0.12, 0.01), { p: [-0.1, 1.2, sz * (Wd / 2 + bev + 0.004)] });
    B.add(trim, new THREE.BoxGeometry(L - 0.3, 0.22, 0.02), { p: [0, clr + 0.18, sz * (Wd / 2 + bev)] });
    B.add(trim, new THREE.BoxGeometry(0.08, 0.16, 0.2), { p: [2.2, 1.6, sz * (Wd / 2 + bev + 0.12)] });
  }
  // The open sliding door (left side, -z): dark doorway, warm light inside,
  // the door panel slid back along the body.
  const dz = -(Wd / 2 + bev);
  B.add(inside, new THREE.BoxGeometry(1.15, 1.85, 0.04), { p: [0.75, 0.38 + 0.95, dz - 0.005] });
  B.add(warm, new THREE.BoxGeometry(0.9, 0.03, 0.05), { p: [0.75, 2.15, dz - 0.02] });
  B.add(inside, new THREE.BoxGeometry(1.0, 0.45, 0.03), { p: [0.75, 0.82, dz - 0.03] });
  B.add(paint, new THREE.BoxGeometry(1.2, 1.9, 0.06), { p: [-0.55, 1.33, dz - 0.09] });
  B.add(trim, new THREE.BoxGeometry(0.2, 0.1, 0.06), { p: [-0.2, 1.3, dz - 0.13] });
  B.add(trim, new THREE.BoxGeometry(0.5, 0.06, 0.35), { p: [0.75, 0.3, dz - 0.15] });
  // Front: light bar, headlamp units, bumper; rear: tail lights.
  B.add(head, new THREE.BoxGeometry(0.04, 0.06, Wd - 0.1), { p: [L / 2 + bev + 0.01, 1.05, 0] });
  for (const sz of [-1, 1]) {
    B.add(head, new THREE.BoxGeometry(0.05, 0.12, 0.3), { p: [L / 2 + bev + 0.01, 0.82, sz * 0.78] });
    B.add(tail, new THREE.BoxGeometry(0.04, 0.9, 0.08), { p: [-L / 2 - bev - 0.01, 1.4, sz * 0.92] });
  }
  B.add(trim, new THREE.BoxGeometry(0.2, 0.3, Wd + 0.1), { p: [L / 2 + 0.05, 0.5, 0] });
  B.add(trim, new THREE.BoxGeometry(0.2, 0.3, Wd + 0.1), { p: [-L / 2 - 0.05, 0.5, 0] });
  B.add(trim, new THREE.BoxGeometry(L - 1.0, 0.25, Wd - 0.3), { p: [0, 0.4, 0] });
  // Wheels.
  for (const wx of wheelX)
    for (const sz of [-1, 1]) {
      B.add(trim, new THREE.CylinderGeometry(wr, wr, 0.3, 24), { p: [wx, wr, sz * (Wd / 2 - 0.05)], r: [Math.PI / 2, 0, 0] });
      B.add(rim, new THREE.CylinderGeometry(wr * 0.62, wr * 0.62, 0.02, 20), { p: [wx, wr, sz * (Wd / 2 + 0.11)], r: [Math.PI / 2, 0, 0] });
    }
  const meshes = B.bake(group, { castShadow: true, receiveShadow: true });
  for (const m of meshes) if (m.material.isMeshBasicMaterial) m.castShadow = false;

  // Headlight beams (in local space; the group is rotated by the caller).
  const beams = [];
  for (const sz of [-1, 1]) {
    const b = lightBeam({ length: o.low ? 10 : 15, radius: 2.6, radiusTop: 0.12, color: 0xdfe8ff, intensity: 0.22, segments: 16 });
    b.position.set(L / 2 + 0.12, 0.85, sz * 0.78);
    b.rotation.set(0, 0, Math.PI / 2 - 0.08);
    group.add(b);
    beams.push(b);
  }
  const spot = new THREE.SpotLight(0xe6eeff, 220, 45, 0.42, 0.6, 2);
  spot.position.set(L / 2 + 0.2, 0.95, 0);
  spot.target.position.set(L / 2 + 20, -1.5, 0);
  group.add(spot, spot.target);
  return { group, beams, spot, size: { L: L + 0.3, W: Wd + 0.3 } };
}
