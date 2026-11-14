// The whole connected zero-g interior of Last Light, Chapter 1 "Lifeboat":
// the capsule "Lantern" (an Orion-like cone, heat-shield bulkhead at z = 0,
// deck at y = 0), the docking tunnel (z 2.5 -> 4.4) and the small habitat
// "Ibis" (z 4.4 -> 9.4, an ISS-like rack-lined module with a big window to
// the Moon at its far end). capsule.js, tunnel.js and habitat.js all build
// this; they differ only in where `start` is.
//
// createInterior({ start: 'capsule' | 'tunnel' | 'habitat', view }) -> set
// (the contract in common.js) plus:
//   setBreaker(i 1..8, on), openLocker(id 1..10 | 'locker_3', 0..1),
//   setValve(0..1) (the O2 valve wheel: 1 = closed), setCO2(0..1) (0..30
//   mmHg on the gauge and the displays), windowView('approach' | 'farside' |
//   'earth' | 'space' | spec), setFrost(0..1), state (read only).
// Breakers 1-4 are on the capsule's right wall (CB PNL 1), 5-8 on the
// habitat's left wall (CB PNL 2). Lockers 1-6: the capsule's aft bulkhead;
// 7-10: the habitat's right wall.
import { THREE, Builder, anchor, lightBeam, disposeGroup, tier, reducedMotion, clamp, lerp, smooth, rng } from './common.js';
import { LOOKS } from '../render.js';
import { AXY, DIMS, BOX, BOXES, capRadius, clampFeet } from './interior-volume.js';
import * as TX from './interior-tex.js';
import { createScreens, BREAKERS } from './interior-screens.js';
import { createOutside } from './interior-outside.js';
import { planarUV, uvRect, rbox, revWall, axisRing, coneFrame, coneSide, frameMatrix, mat4 } from './interior-geo.js';
import { COL, put, decal, placard, stencil, stowLabel, bolts, velcro, handrail, cable, bundle, bag, strap, seat, toggle, knob, led, windowFrame, windowShape, locker, breakerPanel, laptop, beacon } from './interior-props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

export const STARTS = {
  capsule: [0, 0.35, 0.45, 0],
  tunnel: [0, AXY - 0.5, 2.72, 0],
  habitat: [0, 0.3, 5.2, 0],
};

export function createInterior(opts = {}) {
  const T = opts.quality || tier();
  const low = T === 'low';
  const reduced = opts.reducedMotion != null ? !!opts.reducedMotion : reducedMotion();
  const group = new THREE.Group();
  group.name = 'interior';
  const zones = { cap: new THREE.Group(), tun: new THREE.Group(), hab: new THREE.Group() };
  zones.cap.name = 'capsule';
  zones.tun.name = 'tunnel';
  zones.hab.name = 'habitat';
  group.add(zones.cap, zones.tun, zones.hab);
  const R = rng(1971);

  // ---------- Textures and materials ----------
  const atlas = TX.createAtlas(2048);
  const screens = createScreens({ tier: T });
  const pm = TX.panelMaps(low ? 512 : 1024);
  const fm = TX.fabricMaps(low ? 256 : 512);
  const dm = TX.deckMaps(low ? 512 : 1024);
  const metalR = TX.metalRough(256);
  const env = TX.cabinEnv();
  const frost = TX.frostTexture(256);
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ envMap: env, envMapIntensity: 0.35 }, o));
  const M = {
    panel: std({ map: pm.map, normalMap: pm.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: pm.roughnessMap, roughness: 1, metalness: 0, vertexColors: true }),
    fabric: std({ map: fm.map, normalMap: fm.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.95, metalness: 0, vertexColors: true, envMapIntensity: 0.15 }),
    deck: std({ map: dm.map, normalMap: dm.normalMap, roughness: 0.62, metalness: 0.35, vertexColors: true }),
    metal: std({ roughnessMap: metalR, roughness: 0.42, metalness: 0.85, vertexColors: true, envMapIntensity: 0.7 }),
    paint: std({ roughnessMap: metalR, roughness: 0.62, metalness: 0.08, vertexColors: true }),
    rubber: std({ roughness: 0.72, metalness: 0, vertexColors: true, envMapIntensity: 0.2 }),
    label: std({ map: atlas.texture, roughness: 0.55, metalness: 0, alphaTest: 0.5, envMapIntensity: 0.25 }),
    door: std({ map: atlas.texture, roughness: 0.6, metalness: 0 }),
    capLED: new THREE.MeshBasicMaterial({ vertexColors: true }),
    tunLED: new THREE.MeshBasicMaterial({ vertexColors: true }),
    habLED: new THREE.MeshBasicMaterial({ vertexColors: true }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffc480 }),
    emer: new THREE.MeshBasicMaterial({ vertexColors: true }),
    alarm: new THREE.MeshBasicMaterial({ color: 0x400806 }),
    capScreen: new THREE.MeshBasicMaterial({ map: screens.texture }),
    habScreen: new THREE.MeshBasicMaterial({ map: screens.texture }),
  };
  [pm.map, fm.map, dm.map].forEach((t) => (t.anisotropy = 8));
  const B = { cap: new Builder(), tun: new Builder(), hab: new Builder() };
  M.screenOf = (b) => (b === B.hab ? M.habScreen : M.capScreen);
  const K = { M, atlas, screens, low };

  const anchors = {};
  const addAnchor = (name, x, y, z, yaw = 0) => {
    const a = anchor(name, x, y, z, yaw);
    group.add(a);
    anchors[name] = a;
    return a;
  };
  // An anchor floating in front of a world point p (on a wall facing n):
  // feet `drop` metres below it, `off` metres out, facing the point.
  const facing = (name, p, n, off = 0.62, drop = 1.0) => {
    const h = V(n.x, 0, n.z);
    if (h.lengthSq() < 1e-4) h.set(0, 0, 1);
    h.normalize();
    const a = p.clone().addScaledVector(h, off);
    a.y = p.y - drop;
    return addAnchor(name, a.x, a.y, a.z, Math.atan2(p.x - a.x, p.z - a.z));
  };
  const cylFrame = (theta, z, r, inset = 0) => {
    const n = V(-Math.sin(theta), -Math.cos(theta), 0);
    const pos = V(Math.sin(theta) * r, AXY + Math.cos(theta) * r, z).addScaledVector(n, inset);
    const up = Math.abs(n.y) > 0.9 ? V(0, 0, 1) : V(0, 1, 0);
    return frameMatrix(pos, n, up);
  };
  // A long strip between two points on a surface (ribs, LED strips, trays).
  const strip = (b, mat, p0, p1, n, w, t, color) => {
    const len = p0.distanceTo(p1);
    const mid = p0.clone().add(p1).multiplyScalar(0.5).addScaledVector(n, t / 2);
    const m = frameMatrix(mid, n, p1.clone().sub(p0));
    put(b, mat, rbox(w, len, t, Math.min(w, t) * 0.3, 1), m, { color });
  };
  const conePt = (theta, z, inset = 0) => {
    const r = capRadius(z) - inset;
    return V(Math.sin(theta) * r, AXY + Math.cos(theta) * r, z);
  };
  const coneN = (theta) => {
    const a = Math.atan((DIMS.cap.r0 - DIMS.cap.r1) / 2.5);
    return V(-Math.sin(theta) * Math.cos(a), -Math.cos(theta) * Math.cos(a), -Math.sin(a));
  };

  // =====================================================================
  // CAPSULE "LANTERN"
  // =====================================================================
  const bc = B.cap;
  {
    // Cone wall, in 12 sectors of closeout panels with slightly different tints.
    const tints = [0xc9ccc8, 0xbfc3c1, 0xccc7bc, 0xb6bec3, 0xc6c8c4, 0xbdc1be];
    for (let i = 0; i < 12; i++) {
      const g = revWall(0, DIMS.cap.z1, capRadius, { t0: (i * PI) / 6, tl: PI / 6, nt: 6, nz: 5, ku: 12, kv: 1 });
      g.attributes.uv.array.forEach((v, k, arr) => k % 2 === 0 && (arr[k] = v + i));
      bc.add(M.panel, g, { color: tints[i % tints.length] });
    }
    // Ribs (stringers) between the sectors, ring frames.
    for (let i = 0; i < 12; i++) {
      const th = (i * PI) / 6;
      if (Math.cos(th) < -0.55) continue; // under the deck
      strip(bc, M.paint, conePt(th, 0.06, 0.012), conePt(th, 2.44, 0.012), coneN(th), 0.045, 0.028, COL.off);
    }
    [0.82, 1.66].forEach((z) => bc.add(M.paint, axisRing(z, capRadius(z) + 0.01, 0.05, 0.075, 64), { color: 0xc9ced1 }));
    // Aft (heat-shield) bulkhead: a disc with a central boss and radial beams.
    const disc = planarUV(new THREE.CircleGeometry(DIMS.cap.r0, 64), 1);
    bc.add(M.panel, disc, { p: [0, AXY, 0.002], color: 0xd9dcd8 });
    bc.add(M.paint, axisRing(0.02, 0.42, 0.06, 0.05, 32), { color: COL.alu });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + 0.26;
      const p0 = V(Math.sin(a) * 0.45, AXY + Math.cos(a) * 0.45, 0.01);
      const p1 = V(Math.sin(a) * 2.2, AXY + Math.cos(a) * 2.2, 0.01);
      strip(bc, M.paint, p0, p1, V(0, 0, 1), 0.06, 0.035, 0xcfd3d5);
    }
    // Forward bulkhead around the tunnel mouth.
    const fwd = new THREE.RingGeometry(0.7, 1.08, 48);
    fwd.rotateY(PI);
    bc.add(M.panel, planarUV(fwd, 1), { p: [0, AXY, 2.5], color: 0xd2d7da });
    // Deck: the floor across the cone.
    const sh = new THREE.Shape();
    const zEnd = 2.2;
    const hw = (z) => Math.sqrt(Math.max(0, capRadius(z) ** 2 - AXY * AXY));
    sh.moveTo(-hw(0), 0);
    for (let k = 0; k <= 22; k++) sh.lineTo(hw((zEnd * k) / 22), (-zEnd * k) / 22);
    for (let k = 22; k >= 0; k--) sh.lineTo(-hw((zEnd * k) / 22), (-zEnd * k) / 22);
    const deck = new THREE.ShapeGeometry(sh, 4);
    deck.rotateX(-PI / 2);
    planarUV(deck, 1, 0.5, 0);
    bc.add(M.deck, deck, { p: [0, 0.002, 0], color: 0xffffff });
    // Kick strip where the deck meets the wall, and a photoluminescent edge.
    for (const s of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const z = 0.05 + (2.1 * k) / 10;
        pts.push(V(s * (hw(z) - 0.02), 0.03, z));
      }
      cable(K, bc, pts, 0.03, COL.dark);
      put(bc, M.emer, rbox(0.02, 0.008, 1.6, 0.003, 1), null, { p: [s * 0.15, 0.006, 1.32], color: 0x7dffb0 });
    }
    // Rear-row platforms (Lena and Grace sit a step higher).
    for (const s of [-1, 1]) {
      put(bc, M.deck, planarUV(rbox(0.86, 0.25, 1.0, 0.02, 1), 1), null, { p: [s * 1.16, 0.125, 0.51], color: 0xd0d4d6 });
      put(bc, M.paint, rbox(0.86, 0.03, 0.04, 0.01, 1), null, { p: [s * 1.16, 0.25, 1.01], color: COL.yellow });
    }
  }

  // ---------- Seats ----------
  const SEATS = { you: [0.4, 0, 1.12, 'CDR'], yusuf: [-0.4, 0, 1.12, 'PLT'], lena: [1.02, 0.25, 0.62, 'MS1'], grace: [-1.02, 0.25, 0.62, 'MS2'] };
  for (const [id, [x, y, z, tag]] of Object.entries(SEATS)) {
    seat(K, bc, mat4([x, y, z]), tag);
    addAnchor('seat_' + id, x, y, z, 0);
  }

  // ---------- Main display console ----------
  const consM = new THREE.Matrix4().compose(V(0, 0.6, 1.8), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.62, PI, 0, 'YXZ')), V(1, 1, 1));
  {
    const C = consM;
    put(bc, M.paint, rbox(2.08, 0.88, 0.07, 0.02, 2), C, { p: [0, -0.08, -0.035], color: 0x2c3036 });
    put(bc, M.paint, rbox(2.02, 0.03, 0.17, 0.01, 1), C, { p: [0, 0.35, 0.07], color: 0x1d2024 });
    [-1, 1].forEach((s) => put(bc, M.paint, rbox(0.06, 0.9, 0.32, 0.02, 2), C, { p: [s * 1.05, -0.08, -0.06], color: 0x33383e }));
    const dx = [-0.68, 0, 0.68];
    const regs = ['d0', 'd1', 'd2'];
    dx.forEach((x, i) => {
      put(bc, M.paint, rbox(0.63, 0.47, 0.035, 0.015, 2), C, { p: [x, 0.08, 0.016], color: 0x1a1d21 });
      put(bc, M.capScreen, uvRect(new THREE.PlaneGeometry(0.56, 0.36), screens.regions[regs[i]]), C, { p: [x, 0.09, 0.035] });
      // Bezel softkeys.
      for (let k = 0; k < 6; k++) put(bc, M.paint, rbox(0.05, 0.02, 0.012, 0.004, 1), C, { p: [x - 0.22 + k * 0.088, -0.123, 0.035], color: 0x4a5058 });
      for (let k = 0; k < 4; k++) {
        put(bc, M.paint, rbox(0.018, 0.04, 0.012, 0.004, 1), C, { p: [x - 0.302, 0.0 + k * 0.07, 0.035], color: 0x4a5058 });
        put(bc, M.paint, rbox(0.018, 0.04, 0.012, 0.004, 1), C, { p: [x + 0.302, 0.0 + k * 0.07, 0.035], color: 0x4a5058 });
      }
      bolts(K, bc, C, [[x - 0.3, 0.3], [x + 0.3, 0.3], [x - 0.3, -0.14], [x + 0.3, -0.14]], 0.006, COL.alu);
    });
    // Chin: switch legends (atlas), toggles in groups, the C&W panel, knobs.
    const chin = atlas.add(
      2000,
      300,
      (g, W, H) => {
      g.fillStyle = '#353b42';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = '#d8dee2';
      g.lineWidth = 3;
      const grp = (x, w, title, names) => {
        g.strokeRect(x, 14, w, H - 28);
        g.fillStyle = '#353b42';
        g.font = `800 26px ${TX.FONT}`;
        const tw = g.measureText(title).width + 20;
        g.fillRect(x + 20, 2, tw, 26);
        g.fillStyle = '#e8edf0';
        g.textAlign = 'left';
        g.textBaseline = 'top';
        g.fillText(title, x + 30, 2);
        g.font = `700 21px ${TX.FONT}`;
        g.textAlign = 'center';
        names.forEach((n, i) => {
          const cx = x + (w * (i + 0.5)) / names.length;
          g.fillText(n, cx, 44);
          g.font = `600 16px ${TX.FONT}`;
          g.fillText('ON', cx, 96);
          g.fillText('OFF', cx, 238);
          g.font = `700 21px ${TX.FONT}`;
        });
      };
      grp(20, 560, 'ECLSS', ['FAN 1', 'FAN 2', 'SUIT CMP', 'H2O SEP', 'CO2 SCRB']);
      grp(1420, 560, 'EPS', ['BUS A', 'BUS B', 'BAT 1', 'BAT 2', 'INVERTER']);
      g.fillStyle = '#e8edf0';
      g.font = `800 24px ${TX.FONT}`;
      g.textAlign = 'center';
      g.fillText('CAUTION & WARNING', W / 2, 20);
      g.font = `700 20px ${TX.FONT}`;
      g.fillText('LAMP TEST', W / 2 - 300, 246);
      g.fillText('ALARM SILENCE', W / 2 + 300, 246);
      },
      0.75
    );
    decal(K, bc, chin, 2.0, 0.3, C, { p: [0, -0.35, 0.001] });
    const tx = (gx, w, n, i) => -1.0 + (gx + (w * (i + 0.5)) / n) / 1000;
    for (let i = 0; i < 5; i++) {
      toggle(K, bc, C, tx(20, 560, 5, i), -0.37, { guard: i === 4, guardColor: COL.red });
      toggle(K, bc, C, tx(1420, 560, 5, i), -0.37, { guard: i < 2, up: i !== 1 });
    }
    // C&W annunciator (live, in the screens atlas) and its two knobs.
    put(bc, M.paint, rbox(0.56, 0.22, 0.02, 0.008, 1), C, { p: [0, -0.34, 0.006], color: 0x111316 });
    put(bc, M.capScreen, uvRect(new THREE.PlaneGeometry(0.5, 0.185), screens.regions.cw), C, { p: [0, -0.34, 0.018] });
    knob(K, bc, C, -0.31, -0.45, 0.018);
    knob(K, bc, C, 0.31, -0.45, 0.018);
    // Glare shield placard and side handholds.
    placard(K, bc, 0.3, 0.04, { bg: '#1c1f23', fg: '#dfe6ea', lines: [['ATT HOLD  ·  MODE 2', 24, 700]] }, C, { p: [0.62, -0.19, 0.004] });
  }
  // Master alarm lamps on the glare shield corners (flash with the alarm).
  {
    const mb = new Builder();
    [-0.93, 0.93].forEach((x) => mb.add(M.alarm, rbox(0.1, 0.055, 0.03, 0.008, 1), { matrix: consM.clone().multiply(mat4([x, 0.3, 0.03])) }));
    const meshes = mb.bake(zones.cap, { castShadow: false });
    meshes.forEach((m) => (m.userData.noAO = true));
  }
  {
    // Console body down to the deck, its kick panel, hand controllers.
    put(bc, M.paint, rbox(1.96, 0.24, 0.7, 0.03, 1), null, { p: [0, 0.12, 1.86], color: 0x3a4047 });
    put(bc, M.paint, rbox(1.9, 0.02, 0.02, 0.005, 1), null, { p: [0, 0.2, 1.505], color: COL.yellow });
    for (const s of [-1, 1]) {
      cable(K, bc, [V(s * 0.9, 0, 1.42), V(s * 0.9, 0.3, 1.42), V(s * 0.92, 0.52, 1.38)], 0.025, COL.steel);
      put(bc, M.paint, rbox(0.1, 0.06, 0.12, 0.02, 2), null, { p: [s * 0.92, 0.55, 1.38], color: COL.dark });
      put(bc, M.paint, rbox(0.05, 0.13, 0.055, 0.02, 2), null, { p: [s * 0.92, 0.64, 1.37], r: [0.25, 0, 0], color: COL.black });
      put(bc, M.paint, rbox(0.02, 0.025, 0.02, 0.006, 1), null, { p: [s * 0.92, 0.7, 1.4], color: COL.red });
    }
    // Checklists velcroed on the console's left cheek; a pen on a tether.
    const ck = frameMatrix(V(1.08, 0.62, 1.6), V(-0.9, 0.2, -0.4).normalize());
    put(bc, M.paint, rbox(0.17, 0.22, 0.02, 0.005, 1), ck, { color: 0x8a1c18 });
    placard(K, bc, 0.14, 0.05, { bg: '#f2efe4', lines: [['EMER PROC', 26, 800], ['CB 3.2  CO2  O2', 16, 600]] }, ck, { p: [0, 0.05, 0.011] });
    put(bc, M.paint, rbox(0.17, 0.22, 0.02, 0.005, 1), ck, { p: [0.03, -0.05, -0.022], color: 0x1f4a7a });
    cable(K, bc, [V(1.0, 0.52, 1.55), V(0.96, 0.45, 1.5), V(0.98, 0.4, 1.47)], 0.003, 0xd9d9d9);
    put(bc, M.paint, new THREE.CylinderGeometry(0.005, 0.005, 0.13, 6), null, { p: [0.98, 0.36, 1.46], r: [0.3, 0, 0.2], color: 0x1d3a6a });
  }
  ['panel_left', 'panel_center', 'panel_right'].forEach((n, i) => addAnchor(n, [0.68, 0, -0.68][i], 0.03, 1.3, 0));

  // ---------- Capsule windows (left: the view; right: the Sun comes in) ----------
  const panes = [];
  const capWin = new Builder();
  const winSpecs = [
    { side: 1, y: 1.85, z: 1.45 },
    { side: -1, y: 1.85, z: 1.45 },
  ];
  const capWinFrames = winSpecs.map((w) => {
    const f = coneSide(w.side, w.y, w.z, 0.012);
    windowFrame(K, bc, f.matrix, 0.3, 0.28, 0.07, 0.07, 0.065);
    const pane = new THREE.ShapeGeometry(windowShape(0.3, 0.28, 0.07), 6);
    const uv = pane.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.3 + 0.5, uv.getY(i) / 0.28 + 0.5);
    capWin.add(null, pane, { matrix: f.matrix.clone().multiply(mat4([0, 0, -0.004])) });
    // A velcro shade folded above the window, a label.
    put(bc, M.fabric, rbox(0.34, 0.06, 0.03, 0.012, 1), f.matrix, { p: [0, 0.23, 0.03], color: 0x2a2f36 });
    placard(K, bc, 0.12, 0.03, { bg: '#e9e8e0', lines: [[w.side > 0 ? 'WINDOW 2' : 'WINDOW 3', 20, 800]] }, f.matrix, { p: [0, -0.22, 0.012] });
    return f;
  });
  addAnchor('window', 0, 0, 0); // placed below once the hatch is known
  {
    const f = capWinFrames[0];
    const p = f.pos.clone();
    const a = p.clone().addScaledVector(V(f.normal.x, 0, f.normal.z).normalize(), 0.7);
    anchors.window.position.set(a.x, p.y - 1.05, a.z - 0.1);
    anchors.window.rotation.y = Math.atan2(p.x - a.x, p.z - (a.z - 0.1));
  }

  // ---------- Side hatch (left wall) with its small window ----------
  {
    const f = coneSide(1, 1.42, 0.78, 0.1);
    const H = f.matrix;
    const ring = windowShape(1.04, 1.08, 0.3);
    ring.holes.push(windowShape(0.9, 0.94, 0.24));
    put(bc, M.paint, new THREE.ExtrudeGeometry(ring, { depth: 0.12, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 8 }), H, { p: [0, 0, -0.1], color: 0xb9c0c5 });
    put(bc, M.paint, new THREE.ExtrudeGeometry(windowShape(0.9, 0.94, 0.24), { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 8 }), H, { p: [0, 0, -0.03], color: 0xdadfe2 });
    put(bc, M.rubber, new THREE.TorusGeometry(0.075, 0.012, 6, 24), H, { p: [-0.2, 0.22, 0.035], color: COL.black });
    capWin.add(null, new THREE.CircleGeometry(0.07, 24), { matrix: H.clone().multiply(mat4([-0.2, 0.22, 0.03])) });
    // Handle, latch levers, hinges, a pressure-equalisation valve.
    put(bc, M.metal, new THREE.TorusGeometry(0.11, 0.016, 8, 20, PI), H, { p: [0.22, -0.05, 0.05], r: [0, 0, -PI / 2], color: COL.alu });
    [-0.36, 0.36].forEach((y) => {
      put(bc, M.metal, rbox(0.16, 0.03, 0.03, 0.01, 1), H, { p: [0.32, y, 0.04], color: COL.alu });
      put(bc, M.paint, rbox(0.08, 0.12, 0.06, 0.015, 1), H, { p: [-0.5, y, 0.0], color: COL.dark });
    });
    knob(K, bc, H, 0.05, 0.3, 0.025, COL.yellow);
    placard(K, bc, 0.26, 0.09, { bg: '#e7c43a', fg: '#16130a', border: '#16130a', lines: [['SIDE HATCH', 26, 800], ['EQUALISE BEFORE OPENING', 15, 700]] }, H, { p: [-0.05, -0.27, 0.031] });
    bolts(K, bc, H, Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * PI * 2) * 0.49, Math.sin((i / 16) * PI * 2) * 0.51, 0.025]), 0.008, COL.alu);
  }

  // ---------- CB PNL 1 (right wall) ----------
  const leverDefs = [];
  {
    const f = coneSide(-1, 1.58, 1.0, 0.06);
    // Fill the gap to the curved wall with a backing box.
    put(bc, M.paint, rbox(0.72, 0.54, 0.12, 0.02, 1), f.matrix, { p: [0, 0, -0.09], color: 0x50565c });
    const levers = breakerPanel(K, bc, f.matrix, 'CB PNL 1|MAIN BUS A  ·  LANTERN', BREAKERS.slice(0, 4), 'brk1');
    levers.forEach((l, i) => {
      leverDefs.push({ M: f.matrix.clone().multiply(l.local), L: f.matrix.clone().multiply(l.lamp) });
      const p = V(0, 0, 0).applyMatrix4(leverDefs[i].M);
      facing('breaker_' + (i + 1), p, f.normal, 0.62, 1.0);
    });
    bundle(K, bc, [conePt(-1.45, 1.0, 0.03), conePt(-1.6, 1.4, 0.03), conePt(-1.75, 1.9, 0.03)], 4, 5, 4);
  }

  // ---------- Aft bulkhead: lockers 1-6, the O2 valve, bags ----------
  const lockers = [];
  {
    const bank = mat4([0, 0, 0]);
    const xs = [-0.53, 0, 0.53];
    const ys = [1.8, 1.29];
    // Frame bars (full depth), top surface.
    [1.03, 1.545, 2.06].forEach((y) => put(bc, M.paint, rbox(1.66, 0.05, 0.34, 0.012, 1), bank, { p: [0, y, 0.17], color: COL.off }));
    [-0.795, -0.265, 0.265, 0.795].forEach((x) => put(bc, M.paint, rbox(0.05, 1.08, 0.34, 0.012, 1), bank, { p: [x, 1.545, 0.17], color: COL.off }));
    const LOCK = [
      ['L1', 'FOOD  ·  DAY 3-4'],
      ['L2', 'HYGIENE KIT'],
      ['L3', 'CREW PREF  ·  SOCKS'],
      ['L4', 'ECLSS SPARES  ·  HOSE'],
      ['L5', 'DRINK BAGS  ·  H2O'],
      ['L6', 'FLIGHT PLAN  ·  DOCS'],
    ];
    const contents = (k) => (b, Mx, w, h, d) => {
      const r = rng(k + 3);
      for (let i = 0; i < 3; i++) {
        const cw = 0.12 + r() * 0.12;
        const ch = 0.1 + r() * 0.16;
        const col = [COL.nomex, COL.ctb, 0xd8742a, 0x9aa7b4, 0xe7e2cf][Math.floor(r() * 5)];
        put(b, M.fabric, rbox(cw, ch, 0.18, 0.03, 1), Mx, { p: [-w / 2 + 0.08 + i * 0.14, -h / 2 + ch / 2 + 0.02, -0.14], r: [0, 0, (r() - 0.5) * 0.2], color: col });
      }
      if (k === 3) put(b, M.rubber, new THREE.TorusGeometry(0.1, 0.022, 8, 24), Mx, { p: [0.08, 0.06, -0.12], color: 0x2c2f33 });
      if (k === 5) for (let i = 0; i < 3; i++) put(b, M.paint, rbox(0.03, 0.26, 0.2, 0.004, 1), Mx, { p: [0.1 + i * 0.035, 0.0, -0.12], color: [0x1f4a7a, 0x8a1c18, 0x2e6b3a][i] });
    };
    let n = 0;
    ys.forEach((y) => {
      xs.forEach((x) => {
        const Mx = mat4([x, y, 0.34]);
        const L = locker(K, bc, zones.cap, Mx, 0.48, 0.46, 0.3, LOCK[n][0], LOCK[n][1], contents(n));
        L.id = n + 1;
        lockers.push(L);
        addAnchor('locker_' + (n + 1), x, y - 1.0, 0.98, PI);
        n++;
      });
    });
    stencil(K, bc, 0.5, 0.06, 'AFT BAY  ·  STOWAGE', mat4([0, 2.13, 0.34]), { color: 'rgba(40,46,52,0.85)', tint: 0x283034 });
    // Bags strapped above the lockers, a net, a handrail.
    bag(K, bc, mat4([-0.42, 2.42, 0.004]), 0.5, 0.36, 0.26, { label: ['B07', 'CLOTHING  ·  CREW'] });
    bag(K, bc, mat4([0.36, 2.38, 0.004], [0, 0, 0.04]), 0.42, 0.3, 0.24, { color: COL.nomex, label: ['B11', 'TOWELS  ·  WIPES'] });
    bag(K, bc, mat4([-0.05, 2.82, 0.004]), 0.36, 0.26, 0.2, { color: 0xb9c3ca, label: ['B02', 'CAMERA  ·  LENSES'] });
    handrail(K, bc, V(-0.55, 2.16, 0.34), V(0.55, 2.16, 0.34), V(0, 0, 1), COL.rail, 0.05);
    // Under the lockers, between the rear seats: a water dispenser panel.
    put(bc, M.paint, rbox(0.5, 0.52, 0.12, 0.02, 2), null, { p: [0, 0.62, 0.06], color: 0xc7ccd0 });
    placard(K, bc, 0.3, 0.07, { bg: '#2a4f7a', fg: '#fff', lines: [['POTABLE WATER', 26, 800], ['HOT  ·  AMBIENT', 16, 600]] }, mat4([0, 0.8, 0.121]));
    put(bc, M.metal, new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), null, { p: [-0.08, 0.6, 0.15], r: [PI / 2, 0, 0], color: COL.alu });
    put(bc, M.metal, new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), null, { p: [0.08, 0.6, 0.15], r: [PI / 2, 0, 0], color: COL.red });
    // Foot restraints on the deck by the start spot.
    [-0.2, 0.2].forEach((x) => cable(K, bc, [V(x - 0.1, 0.0, 0.5), V(x - 0.06, 0.07, 0.5), V(x + 0.06, 0.07, 0.5), V(x + 0.1, 0.0, 0.5)], 0.012, COL.rail));
  }
  // O2 valve on the aft bulkhead (left).
  let valveWheel;
  {
    const W = mat4([1.25, 2.0, 0.0]);
    put(bc, M.paint, rbox(0.34, 0.3, 0.1, 0.02, 2), W, { p: [0, 0, 0.05], color: 0x5b6670 });
    put(bc, M.metal, new THREE.CylinderGeometry(0.03, 0.03, 0.08, 12).rotateX(PI / 2), W, { p: [0, 0, 0.13], color: COL.alu });
    // Supply lines (green-banded O2 pipes) into the wall.
    cable(K, bc, [V(1.25, 2.15, 0.06), V(1.25, 2.45, 0.06), V(1.1, 2.75, 0.06), V(0.8, 3.05, 0.04)], 0.022, COL.alu);
    cable(K, bc, [V(1.25, 1.85, 0.06), V(1.3, 1.55, 0.06), V(1.55, 1.2, 0.06), V(1.65, 0.6, 0.06)], 0.022, COL.alu);
    [2.32, 1.7].forEach((y) => put(bc, M.paint, new THREE.CylinderGeometry(0.026, 0.026, 0.05, 12), null, { p: [y > 2 ? 1.25 : 1.27, y, 0.06], color: 0x2e8a4a }));
    // Gauge.
    const gr = atlas.add(220, 220, (g, w, h) => {
      g.fillStyle = '#f2f1ea';
      g.beginPath();
      g.arc(w / 2, h / 2, w / 2 - 2, 0, PI * 2);
      g.fill();
      g.strokeStyle = '#222';
      g.lineWidth = 3;
      for (let i = 0; i <= 10; i++) {
        const a = PI * 0.75 + (i / 10) * PI * 1.5;
        g.beginPath();
        g.moveTo(w / 2 + Math.cos(a) * 80, h / 2 + Math.sin(a) * 80);
        g.lineTo(w / 2 + Math.cos(a) * 96, h / 2 + Math.sin(a) * 96);
        g.stroke();
      }
      g.fillStyle = '#222';
      g.font = `800 26px ${TX.FONT}`;
      g.textAlign = 'center';
      g.fillText('O2', w / 2, h / 2 - 24);
      g.font = `600 17px ${TX.FONT}`;
      g.fillText('kPa x100', w / 2, h / 2 + 56);
      g.strokeStyle = '#c0261c';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(w / 2, h / 2);
      g.lineTo(w / 2 + Math.cos(PI * 0.82) * 76, h / 2 + Math.sin(PI * 0.82) * 76);
      g.stroke();
    });
    put(bc, M.metal, new THREE.CylinderGeometry(0.07, 0.07, 0.04, 20).rotateX(PI / 2), null, { p: [1.25, 2.36, 0.02], color: COL.alu });
    decal(K, bc, gr, 0.12, 0.12, mat4([1.25, 2.36, 0.042]));
    placard(K, bc, 0.3, 0.08, { bg: '#2e8a4a', fg: '#fff', lines: [['O2 SUPPLY', 28, 800], ['CLOSE  ↻  CLOCKWISE', 16, 700]] }, mat4([1.25, 1.74, 0.012]));
    // The wheel (turns with setValve).
    const wb = new Builder();
    wb.add(M.paint, new THREE.TorusGeometry(0.15, 0.019, 10, 36), { color: 0xc23a22 });
    for (let i = 0; i < 3; i++) wb.add(M.metal, rbox(0.016, 0.3, 0.014, 0.005, 1), { r: [0, 0, (i / 3) * PI], color: COL.alu });
    wb.add(M.metal, new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12).rotateX(PI / 2), { color: COL.alu });
    valveWheel = new THREE.Group();
    valveWheel.position.set(1.25, 2.0, 0.19);
    wb.bake(valveWheel, { castShadow: true });
    zones.cap.add(valveWheel);
    addAnchor('valve', 1.05, 1.0, 0.78, Math.atan2(1.25 - 1.05, 0.19 - 0.78));
  }

  // ---------- Capsule walls: lights, bags, rails, cables, safety kit ----------
  {
    // LED light panels on the upper cone.
    for (const th of [-0.72, 0.72]) {
      for (const [z0, z1] of [
        [0.3, 0.95],
        [1.1, 1.75],
      ]) {
        const p0 = conePt(th, z0, 0.012);
        const p1 = conePt(th, z1, 0.012);
        strip(bc, M.paint, p0, p1, coneN(th), 0.17, 0.03, 0x9aa2a8);
        strip(bc, M.capLED, p0.clone().addScaledVector(coneN(th), 0.031), p1.clone().addScaledVector(coneN(th), 0.031), coneN(th), 0.13, 0.004, 0xffffff);
      }
    }
    // Ribbed stowage net with bags across the ceiling.
    const top = (z, w, h, d, col, lab, rot = 0) => {
      const f = coneFrame(0, z, 0.0);
      bag(K, bc, f.matrix.clone().multiply(mat4([0, 0, 0], [0, 0, rot])), w, h, d, { color: col, label: lab });
    };
    top(0.42, 0.52, 0.36, 0.22, COL.ctb, ['B04', 'CREW PROVISIONS']);
    top(1.25, 0.44, 0.32, 0.2, COL.nomex, ['B09', 'MEDICAL SPARES'], 0.06);
    for (const s of [-1, 1]) {
      const f = coneFrame(s * 1.2, 0.42, 0.0);
      bag(K, bc, f.matrix, 0.42, 0.3, 0.22, { color: s > 0 ? 0xc9c1aa : COL.nomex, label: s > 0 ? ['B05', 'LiOH  ·  SPARE'] : ['B03', 'FOOD  ·  SNACKS'] });
      strap(K, bc, f.matrix, -0.28, 0, 0.5, 0.1);
    }
    // Handrails.
    for (const s of [-1, 1]) {
      handrail(K, bc, conePt(s * 0.38, 0.55, 0.01), conePt(s * 0.38, 1.0, 0.01), coneN(s * 0.38), COL.rail);
      handrail(K, bc, conePt(s * 1.95, 0.4, 0.01), conePt(s * 1.95, 0.85, 0.01), coneN(s * 1.95), COL.rail);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      const p0 = V(Math.sin(a - 0.3) * 0.86, AXY + Math.cos(a - 0.3) * 0.86, 2.5);
      const p1 = V(Math.sin(a + 0.3) * 0.86, AXY + Math.cos(a + 0.3) * 0.86, 2.5);
      if (Math.cos(a) < -0.5) continue;
      handrail(K, bc, p0, p1, V(0, 0, -1), COL.yellow, 0.05);
    }
    // Cable bundles along the low walls, around the forward bulkhead.
    for (const s of [-1, 1]) bundle(K, bc, [conePt(s * 1.95, 0.1, 0.03), conePt(s * 1.93, 0.9, 0.03), conePt(s * 1.9, 1.6, 0.03), conePt(s * 1.88, 2.3, 0.03)], 5, s > 0 ? 2 : 3, 7);
    bundle(K, bc, [V(-0.95, AXY + 0.2, 2.47), V(-0.8, AXY + 0.6, 2.47), V(-0.3, AXY + 0.9, 2.47), V(0.3, AXY + 0.92, 2.47)], 3, 9, 3);
    // Velcro patches and fire ports on the panels.
    for (let i = 0; i < 26; i++) {
      const th = (R() - 0.5) * 3.6;
      const z = 0.2 + R() * 2.0;
      const f = coneFrame(th, z, 0.004);
      velcro(K, bc, f.matrix, 0, 0, 0.04 + R() * 0.03, 0.04 + R() * 0.04);
    }
    for (const [th, z] of [
      [0.42, 1.95],
      [-1.0, 0.3],
    ]) {
      const f = coneFrame(th, z, 0.004);
      put(bc, M.rubber, new THREE.CircleGeometry(0.022, 16), f.matrix, { p: [0, 0, 0.002], color: 0x0c0d0e });
      put(bc, M.paint, new THREE.TorusGeometry(0.03, 0.006, 6, 18), f.matrix, { p: [0, 0, 0.003], color: COL.red });
      placard(K, bc, 0.09, 0.025, { bg: '#b3261e', fg: '#fff', lines: [['FIRE PORT', 17, 800]] }, f.matrix, { p: [0, -0.06, 0.004] });
    }
    // Fire extinguisher and breathing kit beside the console (right).
    const pf = coneSide(-1, 0.85, 1.72, 0.12);
    put(bc, M.paint, new THREE.CylinderGeometry(0.06, 0.06, 0.42, 16), pf.matrix, { color: COL.red });
    put(bc, M.paint, new THREE.CylinderGeometry(0.035, 0.05, 0.06, 12), pf.matrix, { p: [0, 0.24, 0], color: COL.black });
    put(bc, M.paint, rbox(0.03, 0.1, 0.03, 0.01, 1), pf.matrix, { p: [0.03, 0.3, 0.02], r: [0, 0, 0.6], color: COL.black });
    [-0.12, 0.12].forEach((y) => put(bc, M.metal, rbox(0.16, 0.025, 0.08, 0.008, 1), pf.matrix, { p: [0, y, -0.04], color: COL.alu }));
    placard(K, bc, 0.09, 0.05, { bg: '#fff', fg: '#b3261e', lines: [['PFE', 30, 800]] }, pf.matrix, { p: [0, 0.02, 0.061] });
    const pb = coneSide(-1, 1.12, 1.72, 0.08);
    put(bc, M.fabric, rbox(0.2, 0.16, 0.1, 0.04, 2), pb.matrix, { p: [0.0, 0.05, 0.0], color: COL.yellow });
    placard(K, bc, 0.12, 0.04, { bg: '#16130a', fg: '#e0b021', lines: [['PBA', 26, 800]] }, pb.matrix, { p: [0, 0.06, 0.052] });
    // Tunnel arrow on the forward bulkhead.
    placard(K, bc, 0.26, 0.06, { bg: '#1c2b3a', fg: '#e8eef2', lines: [['IBIS  ↑  TUNNEL', 28, 800]] }, mat4([0, AXY + 0.83, 2.48], [0, PI, 0]));
    // Chemlight taped by the console (emergency glow).
    put(bc, M.emer, new THREE.CylinderGeometry(0.008, 0.008, 0.15, 8), null, { p: [-1.02, 0.95, 1.95], r: [0.2, 0, 0.9], color: 0x6dff8a });
  }

  // =====================================================================
  // TUNNEL
  // =====================================================================
  const bt = B.tun;
  const TR = DIMS.tun.r;
  {
    bt.add(M.panel, revWall(2.5, 4.4, () => TR, { nt: 40, nz: 4, ku: 5, kv: 1 }), { color: 0xc5ccd0 });
    // Hatch rims, docking rings with the latch hooks, seals, frames.
    [2.53, 4.37].forEach((z) => bt.add(M.paint, axisRing(z, TR + 0.02, 0.13, 0.09, 48), { color: 0xa9b1b7 }));
    [3.36, 3.54].forEach((z) => bt.add(M.metal, axisRing(z, TR + 0.01, 0.11, 0.12, 48), { color: COL.alu }));
    bt.add(M.rubber, axisRing(3.45, TR - 0.02, 0.04, 0.05, 48), { color: 0x101112 });
    [2.95, 3.95].forEach((z) => bt.add(M.paint, axisRing(z, TR + 0.01, 0.035, 0.05, 40), { color: 0xb8c0c5 }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2 + 0.13;
      const m = cylFrame(a, 3.45, TR, 0.1);
      put(bt, M.paint, rbox(0.07, 0.06, 0.05, 0.01, 1), m, { p: [0, 0, 0.0], color: 0x2d3238 });
      put(bt, M.metal, rbox(0.03, 0.12, 0.02, 0.006, 1), m, { p: [0, 0, 0.03], color: COL.alu });
      put(bt, M.metal, new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), m, { p: [0.0, 0.0, -0.01], r: [PI / 2, 0, 0], color: 0x707880 });
    }
    // Bolt circles on the rims.
    for (const z of [2.585, 4.315]) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * PI * 2;
        const m = frameMatrix(V(Math.sin(a) * 0.63, AXY + Math.cos(a) * 0.63, z), V(0, 0, z < 3 ? 1 : -1));
        bolts(K, bt, m, [[0, 0, 0]], 0.009, COL.alu);
      }
    }
    // Strip lights along the top, either side of the docking rings.
    for (const th of [-0.55, 0.55]) {
      for (const [z0, z1] of [
        [2.68, 3.25],
        [3.66, 4.22],
      ]) {
        const n = V(-Math.sin(th), -Math.cos(th), 0);
        const p0 = V(Math.sin(th) * TR, AXY + Math.cos(th) * TR, z0);
        const p1 = V(Math.sin(th) * TR, AXY + Math.cos(th) * TR, z1);
        strip(bt, M.paint, p0, p1, n, 0.08, 0.03, 0x8e969c);
        strip(bt, M.tunLED, p0.clone().addScaledVector(n, 0.031), p1.clone().addScaledVector(n, 0.031), n, 0.055, 0.004, 0xffffff);
      }
    }
    // Handrails along the walls.
    for (const th of [1.25, -1.25, 2.3, -2.3]) {
      const n = V(-Math.sin(th), -Math.cos(th), 0);
      for (const [z0, z1] of [
        [2.72, 3.22],
        [3.68, 4.18],
      ])
        handrail(K, bt, V(Math.sin(th) * TR, AXY + Math.cos(th) * TR, z0), V(Math.sin(th) * TR, AXY + Math.cos(th) * TR, z1), n, th > 2 || th < -2 ? COL.yellow : COL.rail, 0.06);
    }
    // Flexible ventilation duct through the hatchway, capsule to habitat.
    const duct = [V(-0.45, 0.62, 1.95), V(-0.38, 0.72, 2.5), V(-0.3, AXY - 0.52, 3.1), V(-0.24, AXY - 0.56, 3.8), V(-0.3, AXY - 0.5, 4.4), V(-0.62, 0.42, 5.0), V(-0.78, 0.22, 5.3)];
    cable(K, bt, duct, 0.07, 0xd8dbd6);
    {
      const curve = new THREE.CatmullRomCurve3(duct);
      for (let i = 1; i < 60; i++) {
        const t = i / 60;
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), curve.getTangent(t));
        bt.add(M.rubber, new THREE.TorusGeometry(0.071, 0.006, 4, 16), { matrix: new THREE.Matrix4().compose(curve.getPoint(t), q, V(1, 1, 1)), color: 0xbfc3bf });
      }
    }
    // Umbilical jumpers across the docking interface.
    for (let i = 0; i < 3; i++) {
      const th = 2.5 + i * 0.22;
      const p = (z, r) => V(Math.sin(th) * r, AXY + Math.cos(th) * r, z);
      cable(K, bt, [p(3.15, 0.62), p(3.3, 0.5), p(3.45, 0.48), p(3.6, 0.5), p(3.75, 0.62)], 0.012, [COL.black, 0x7a2a22, 0x2a4f7a][i]);
      [3.15, 3.75].forEach((z) => put(bt, M.paint, rbox(0.06, 0.04, 0.08, 0.01, 1), cylFrame(th, z, TR, 0.06), { color: 0x2d3238 }));
    }
    // Labels.
    placard(K, bt, 0.3, 0.07, { bg: '#1c2b3a', fg: '#e8eef2', lines: [['IBIS  →', 34, 800]] }, cylFrame(1.62, 2.9, TR, 0.004));
    placard(K, bt, 0.3, 0.07, { bg: '#1c2b3a', fg: '#e8eef2', lines: [['←  LANTERN', 34, 800]] }, cylFrame(1.62, 4.05, TR, 0.004));
    placard(K, bt, 0.36, 0.09, { bg: '#e7c43a', fg: '#16130a', border: '#16130a', lines: [['DUCT IN HATCHWAY', 24, 800], ['DO NOT CLOSE HATCH', 18, 700]] }, cylFrame(-1.62, 2.9, TR, 0.004));
    stencil(K, bt, 0.42, 0.06, 'NDS  ·  DOCKING INTERFACE', cylFrame(-1.62, 3.88, TR, 0.004), { color: 'rgba(40,46,52,0.85)' });
    put(bt, M.emer, new THREE.CylinderGeometry(0.008, 0.008, 0.15, 8), cylFrame(2.0, 3.0, TR, 0.03), { r: [0, 0, PI / 2], color: 0x6dff8a });
  }
  // The capsule's docking hatch, swung open into the cabin (hinged left).
  {
    const H = new THREE.Matrix4().compose(V(0.68, AXY, 2.47), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (-125 * PI) / 180, 0)), V(1, 1, 1));
    const hatchDoor = (b, Hm, label) => {
      put(b, M.paint, new THREE.CylinderGeometry(0.64, 0.64, 0.07, 48).rotateX(PI / 2), Hm, { p: [-0.66, 0, 0], color: 0xc3c9cd });
      for (let i = 0; i < 2; i++) put(b, M.paint, rbox(1.14, 0.05, 0.045, 0.01, 1), Hm, { p: [-0.66, 0, 0.05], r: [0, 0, (i / 2) * PI + PI / 4], color: 0xa9b0b5 });
      put(b, M.paint, new THREE.TorusGeometry(0.42, 0.025, 6, 40), Hm, { p: [-0.66, 0, 0.05], color: 0xa9b0b5 });
      put(b, M.paint, rbox(0.5, 0.3, 0.012, 0.01, 1), Hm, { p: [-0.66, 0.3, 0.04], color: 0xd9dde0 });
      put(b, M.paint, rbox(0.3, 0.2, 0.08, 0.02, 2), Hm, { p: [-0.66, 0, 0.08], color: 0x5b636a });
      put(b, M.metal, new THREE.TorusGeometry(0.1, 0.014, 8, 24), Hm, { p: [-0.66, 0, 0.13], color: COL.alu });
      put(b, M.rubber, new THREE.TorusGeometry(0.62, 0.02, 6, 48), Hm, { p: [-0.66, 0, -0.04], color: 0x0f1011 });
      put(b, M.paint, rbox(0.1, 0.24, 0.1, 0.02, 1), Hm, { p: [-0.02, 0.3, 0], color: 0x3a4148 });
      put(b, M.paint, rbox(0.1, 0.24, 0.1, 0.02, 1), Hm, { p: [-0.02, -0.3, 0], color: 0x3a4148 });
      placard(K, b, 0.22, 0.06, { bg: '#e9e8e0', lines: [[label, 28, 800]] }, Hm, { p: [-0.66, -0.22, 0.123] });
      bolts(K, b, Hm, Array.from({ length: 20 }, (_, i) => [-0.66 + Math.cos((i / 20) * PI * 2) * 0.56, Math.sin((i / 20) * PI * 2) * 0.56, 0.036]), 0.009, COL.alu);
    };
    hatchDoor(bc, H, 'HATCH 1');
    const H2 = new THREE.Matrix4().compose(V(0.68, AXY, 4.43), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (100 * PI) / 180, 0)), V(1, 1, 1));
    hatchDoor(B.hab, H2.clone().multiply(mat4([0, 0, 0], [PI, 0, 0])), 'HATCH 2');
  }
  addAnchor('tunnel_a', 0, AXY - 0.5, 2.62, 0);
  addAnchor('tunnel_b', 0, AXY - 0.5, 4.3, 0);

  // =====================================================================
  // HABITAT "IBIS"
  // =====================================================================
  const bh = B.hab;
  const HD = DIMS.hab;
  const HC = HD.hw - HD.ch; // where the chamfers start
  const HV = HD.hh - HD.ch;
  const lockerHole = { z0: 5.4, z1: 6.4, y0: AXY - 0.47, y1: AXY + 0.58 };
  {
    const tintsW = [0xc8cac6, 0xbcc1c0, 0xcbc6ba, 0xbfc5c9, 0xc5c7c3];
    for (let i = 0; i < 5; i++) {
      const z0 = HD.z0 + i;
      const z1 = z0 + 1;
      const zc = (z0 + z1) / 2;
      const tw = tintsW[i];
      // Deck plate.
      put(bh, M.deck, planarUV(rbox(2 * HC, 0.04, 0.98, 0.01, 1), 1, 0.5, i * 0.37), null, { p: [0, AXY - HD.hh - 0.02, zc], color: 0xd6dadc });
      // Overhead.
      put(bh, M.panel, planarUV(rbox(2 * HC, 0.03, 0.98, 0.01, 1), 1, i * 0.3, 0.2), null, { p: [0, AXY + HD.hh + 0.015, zc], color: tw });
      // Side racks.
      for (const s of [-1, 1]) {
        const x = s * (HD.hw + 0.015);
        if (s < 0 && i === 1) {
          // Right wall around the locker block.
          put(bh, M.panel, planarUV(rbox(0.03, lockerHole.y0 - (AXY - HV), 0.98, 0.01, 1), 1), null, { p: [x, (AXY - HV + lockerHole.y0) / 2, zc], color: tw });
          put(bh, M.panel, planarUV(rbox(0.03, AXY + HV - lockerHole.y1, 0.98, 0.01, 1), 1), null, { p: [x, (AXY + HV + lockerHole.y1) / 2, zc], color: tw });
        } else put(bh, M.panel, planarUV(rbox(0.03, 2 * HV, 0.98, 0.01, 1), 1, i * 0.41, 0.1), null, { p: [x, AXY, zc], color: tw });
        // Chamfers: upper and lower.
        for (const u of [-1, 1]) {
          const cx = s * (HC + HD.ch / 2);
          const cy = AXY + u * (HV + HD.ch / 2);
          put(bh, M.panel, planarUV(rbox(0.03, HD.ch * Math.SQRT2, 0.98, 0.01, 1), 1), null, { p: [cx + s * 0.011, cy + u * 0.011, zc], r: [0, 0, s * u * (PI / 4)], color: 0xc9cfd3 });
        }
        // Rack seams: dark posts between bays, rack handles.
        put(bh, M.paint, rbox(0.04, 2 * HV + 0.02, 0.03, 0.008, 1), null, { p: [s * (HD.hw - 0.0), AXY, z0 + 0.005], color: 0x40464c });
      }
      // Seat-track rails on the deck edges, overhead light fixtures.
      for (const s of [-1, 1]) {
        put(bh, M.metal, rbox(0.05, 0.02, 0.98, 0.006, 1), null, { p: [s * (HC - 0.05), AXY - HD.hh + 0.01, zc], color: COL.alu });
        put(bh, M.paint, rbox(0.2, 0.035, 0.74, 0.01, 1), null, { p: [s * 0.42, AXY + HD.hh - 0.016, zc], color: 0x9aa2a8 });
        put(bh, M.habLED, rbox(0.15, 0.006, 0.68, 0.002, 1), null, { p: [s * 0.42, AXY + HD.hh - 0.036, zc], color: 0xffffff });
      }
      // Photoluminescent strips along the deck edges.
      for (const s of [-1, 1]) put(bh, M.emer, rbox(0.02, 0.006, 0.9, 0.002, 1), null, { p: [s * (HC - 0.12), AXY - HD.hh + 0.003, zc], color: 0x7dffb0 });
      // Handrails along the lower chamfers.
      for (const s of [-1, 1]) {
        const n = V(-s, 1, 0).normalize();
        const base = (z) => V(s * (HC + HD.ch * 0.45), AXY - HV - HD.ch * 0.55, z);
        handrail(K, bh, base(z0 + 0.2), base(z1 - 0.2), n, i % 2 ? COL.rail : COL.yellow, 0.05);
      }
    }
    // Cable trays and ducts on the upper chamfers, the full length.
    for (const s of [-1, 1]) {
      const n = V(-s, -1, 0).normalize();
      const p = (z, o = 0) => V(s * (HC + HD.ch * 0.5), AXY + HV + HD.ch * 0.5, z).addScaledVector(n, o);
      strip(bh, M.paint, p(4.45), p(9.35), n, 0.16, 0.03, 0x6a7178);
      bundle(K, bh, [p(4.45, 0.06), p(6, 0.07), p(7.5, 0.06), p(9.3, 0.07)], 5, s > 0 ? 21 : 23, 9);
      cable(K, bh, [p(4.45, 0.16).add(V(-s * 0.1, 0, 0)), p(9.3, 0.16).add(V(-s * 0.1, 0, 0))], 0.045, 0xd8dbd6);
    }
    // End caps: aft bulkhead (round hatchway) and forward (the big window).
    const oct = (hole) => {
      const s = new THREE.Shape();
      const P = [
        [-HC, -HD.hh],
        [HC, -HD.hh],
        [HD.hw, -HV],
        [HD.hw, HV],
        [HC, HD.hh],
        [-HC, HD.hh],
        [-HD.hw, HV],
        [-HD.hw, -HV],
      ];
      s.moveTo(P[0][0], P[0][1]);
      P.slice(1).forEach((p) => s.lineTo(p[0], p[1]));
      s.closePath();
      const h = new THREE.Path();
      h.absarc(0, hole.y, hole.r, 0, PI * 2, true);
      s.holes.push(h);
      return planarUV(new THREE.ShapeGeometry(s, 24), 1);
    };
    bh.add(M.panel, oct({ y: 0, r: TR + 0.02 }), { p: [0, AXY, HD.z0 + 0.002], color: 0xd7dbdc });
    const end = oct({ y: 0.05, r: 0.6 });
    end.rotateY(PI);
    bh.add(M.panel, end, { p: [0, AXY, HD.z1 - 0.002], color: 0xd2d7d9 });
  }
  // The big window at the far end.
  const habWin = new Builder();
  {
    const c = V(0, AXY + 0.05, HD.z1);
    const ring = (z, rOut, depth, w, col, mat = M.paint) => {
      const g = axisRing(z, rOut, depth, w, 64);
      g.translate(0, 0.05, 0);
      bh.add(mat, g, { color: col });
    };
    const well = revWall(HD.z1, HD.z1 + 0.24, () => 0.6, { nt: 48, nz: 1 });
    well.translate(0, 0.05, 0);
    bh.add(M.metal, well, { color: 0x7d868d });
    ring(HD.z1 - 0.03, 0.78, 0.18, 0.07, COL.alu, M.metal);
    ring(HD.z1 - 0.075, 0.66, 0.03, 0.02, 0x50575e);
    for (const s of [-1, 1]) put(bh, M.metal, rbox(0.035, 1.75, 0.04, 0.008, 1), null, { p: [s * 0.86, c.y + 0.15, HD.z1 - 0.03], color: 0x8f989e });
    ring(HD.z1 + 0.2, 0.62, 0.05, 0.03, 0x15171a, M.rubber);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 2;
      bolts(K, bh, frameMatrix(V(Math.sin(a) * 0.7, c.y + Math.cos(a) * 0.7, HD.z1 - 0.065), V(0, 0, -1)), [[0, 0, 0]], 0.012, COL.alu);
    }
    const pane = new THREE.CircleGeometry(0.6, 48);
    pane.rotateY(PI);
    habWin.add(null, pane, { p: [0, c.y, HD.z1 + 0.22] });
    // Shutter, open (hinged up), handholds either side, a camera on a bracket.
    put(bh, M.paint, rbox(1.0, 0.16, 0.05, 0.02, 2), null, { p: [0, c.y + 0.86, HD.z1 - 0.05], color: 0x8f989e });
    put(bh, M.metal, rbox(0.9, 0.02, 0.03, 0.006, 1), null, { p: [0, c.y + 0.78, HD.z1 - 0.08], color: COL.alu });
    placard(K, bh, 0.24, 0.05, { bg: '#1c2b3a', fg: '#e8eef2', lines: [['SHUTTER  ·  OPEN', 22, 800]] }, frameMatrix(V(0, c.y + 0.86, HD.z1 - 0.076), V(0, 0, -1)));
    for (const s of [-1, 1]) handrail(K, bh, V(s * 0.92, c.y - 0.25, HD.z1), V(s * 0.92, c.y + 0.3, HD.z1), V(0, 0, -1), COL.yellow, 0.07);
    const cm = frameMatrix(V(-0.84, c.y + 0.5, HD.z1 - 0.12), V(0.3, 0, -1).normalize());
    put(bh, M.paint, rbox(0.15, 0.11, 0.08, 0.02, 2), cm, { color: COL.black });
    put(bh, M.paint, new THREE.CylinderGeometry(0.04, 0.045, 0.12, 16).rotateX(PI / 2), cm, { p: [0.0, 0, 0.09], color: 0x1a1c1f });
    put(bh, M.paint, new THREE.CylinderGeometry(0.034, 0.034, 0.01, 16).rotateX(PI / 2), cm, { p: [0.0, 0, 0.152], color: 0x0b0d10 });
    cable(K, bh, [V(-0.84, c.y + 0.44, HD.z1 - 0.12), V(-0.9, c.y + 0.2, HD.z1 - 0.05), V(-1.1, c.y + 0.1, HD.z1 - 0.02)], 0.012, COL.dark);
    placard(K, bh, 0.42, 0.09, { bg: '#e7c43a', fg: '#16130a', border: '#16130a', lines: [['WINDOW 1', 26, 800], ['CLOSE SHUTTER WHEN NOT IN USE', 15, 700]] }, frameMatrix(V(0, c.y - 0.86, HD.z1 - 0.004), V(0, 0, -1)));
  }
  addAnchor('hab_window', 0, 0.3, 8.62, 0);

  // ---------- Habitat left wall (+x): CB PNL 2, the bench, the sleep station ----------
  const wallL = (y, z, inset = 0) => frameMatrix(V(HD.hw - inset, y, z), V(-1, 0, 0));
  const wallR = (y, z, inset = 0) => frameMatrix(V(-HD.hw + inset, y, z), V(1, 0, 0));
  {
    // Behind the open hatch: stowage bags.
    bag(K, bh, wallL(1.55, 4.75), 0.48, 0.34, 0.24, { label: ['H01', 'TRASH  ·  WET'] });
    bag(K, bh, wallL(0.95, 4.85), 0.52, 0.38, 0.26, { color: COL.nomex, label: ['H02', 'TRASH  ·  DRY'] });
    // CB PNL 2.
    const f = wallL(1.45, 5.85, 0.03);
    put(bh, M.paint, rbox(0.72, 0.54, 0.05, 0.02, 1), f, { p: [0, 0, -0.03], color: 0x50565c });
    const levers = breakerPanel(K, bh, f, 'CB PNL 2|HAB BUS  ·  IBIS', BREAKERS.slice(4, 8), 'brk2');
    levers.forEach((l, i) => {
      leverDefs.push({ M: f.clone().multiply(l.local), L: f.clone().multiply(l.lamp) });
      const p = V(0, 0, 0).applyMatrix4(leverDefs[4 + i].M);
      facing('breaker_' + (5 + i), p, V(-1, 0, 0), 0.62, 1.0);
    });
    // The work bench: a fold-out table, a velcro mat, tools, the CO2 parts.
    const z0 = 6.55;
    const z1 = 7.75;
    const zc = (z0 + z1) / 2;
    const ty = 1.05;
    put(bh, M.paint, rbox(0.52, 0.035, z1 - z0, 0.01, 2), null, { p: [HD.hw - 0.26, ty, zc], color: 0xb9c1c6 });
    put(bh, M.paint, rbox(0.03, 0.05, z1 - z0, 0.01, 1), null, { p: [HD.hw - 0.52, ty + 0.025, zc], color: COL.dark });
    put(bh, M.fabric, planarUV(rbox(0.44, 0.006, z1 - z0 - 0.1, 0.002, 1), 3), null, { p: [HD.hw - 0.27, ty + 0.02, zc], color: 0x3a3f45 });
    for (const z of [z0 + 0.1, z1 - 0.1]) cable(K, bh, [V(HD.hw - 0.48, ty - 0.02, z), V(HD.hw - 0.2, ty - 0.25, z), V(HD.hw - 0.01, ty - 0.42, z)], 0.014, COL.alu);
    const top = ty + 0.024;
    // Square LiOH cartridge, the round one, a hose coil, tape, bags, a card, scissors, pliers, a sock.
    put(bh, M.paint, rbox(0.17, 0.17, 0.17, 0.012, 2), null, { p: [0.92, top + 0.085, 7.4], r: [0, 0.3, 0], color: 0xd7d9d6 });
    stowLabel(K, bh, 0.12, 0.05, 'C1', 'LiOH  CM  SQUARE', frameMatrix(V(0.83, top + 0.1, 7.36), V(-0.95, 0, -0.3).normalize()));
    put(bh, M.paint, new THREE.CylinderGeometry(0.075, 0.075, 0.16, 20), null, { p: [1.02, top + 0.08, 7.62], color: 0xbfc5c9 });
    put(bh, M.metal, new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20), null, { p: [1.02, top + 0.166, 7.62], color: COL.alu });
    put(bh, M.rubber, new THREE.TorusGeometry(0.075, 0.016, 8, 24), null, { p: [0.95, top + 0.016, 6.95], r: [PI / 2, 0, 0], color: 0x2c3036 });
    put(bh, M.rubber, new THREE.TorusGeometry(0.06, 0.016, 8, 24), null, { p: [0.96, top + 0.03, 6.95], r: [PI / 2, 0, 0.3], color: 0x2c3036 });
    put(bh, M.paint, new THREE.CylinderGeometry(0.055, 0.055, 0.05, 20, 1, true), null, { p: [0.84, top + 0.026, 7.12], color: 0x8e9396 });
    put(bh, M.paint, new THREE.CylinderGeometry(0.03, 0.03, 0.052, 16), null, { p: [0.84, top + 0.026, 7.12], color: 0x5a4a32 });
    put(bh, M.fabric, rbox(0.22, 0.012, 0.3, 0.004, 1), null, { p: [1.05, top + 0.006, 6.75], r: [0, 0.2, 0], color: 0xe9ecee });
    put(bh, M.paint, rbox(0.2, 0.004, 0.28, 0.002, 1), null, { p: [0.86, top + 0.003, 6.72], r: [0, -0.15, 0], color: 0xd9c9a3 });
    placard(K, bh, 0.16, 0.05, { bg: '#d9c9a3', fg: '#3a2a12', lines: [['FLIGHT PLAN', 24, 800]] }, mat4([0.86, top + 0.0055, 6.72], [-PI / 2, 0, PI / 2 - 0.15]));
    put(bh, M.metal, rbox(0.012, 0.004, 0.12, 0.002, 1), null, { p: [0.76, top + 0.004, 7.0], r: [0, 0.25, 0], color: COL.alu });
    put(bh, M.metal, rbox(0.012, 0.004, 0.12, 0.002, 1), null, { p: [0.765, top + 0.008, 7.0], r: [0, -0.1, 0], color: COL.alu });
    put(bh, M.paint, rbox(0.03, 0.01, 0.06, 0.004, 1), null, { p: [0.75, top + 0.008, 6.92], color: COL.red });
    put(bh, M.paint, rbox(0.03, 0.012, 0.16, 0.004, 1), null, { p: [0.8, top + 0.007, 7.55], r: [0, 0.4, 0], color: 0x2a4f7a });
    put(bh, M.fabric, rbox(0.09, 0.03, 0.2, 0.014, 1), null, { p: [1.1, top + 0.015, 7.18], r: [0, -0.5, 0], color: 0x6b7f5a });
    // Tool board above the bench with bungee straps and tools.
    const tb = wallL(1.58, zc, 0.0);
    put(bh, M.paint, rbox(1.1, 0.48, 0.02, 0.01, 1), tb, { p: [0, 0, 0.01], color: 0x7d868d });
    for (const y of [-0.12, 0.1]) put(bh, M.rubber, rbox(1.06, 0.012, 0.012, 0.004, 1), tb, { p: [0, y, 0.03], color: 0x1d1f22 });
    for (let i = 0; i < 6; i++) {
      const x = -0.45 + i * 0.17;
      put(bh, M.paint, rbox(0.022, 0.2 + (i % 3) * 0.03, 0.016, 0.006, 1), tb, { p: [x, 0.0, 0.03], r: [0, 0, (i - 2.5) * 0.04], color: [COL.black, COL.red, 0x2a4f7a, COL.yellow, COL.black, 0x7a2a22][i] });
      put(bh, M.metal, rbox(0.008, 0.12, 0.008, 0.003, 1), tb, { p: [x, -0.15, 0.032], color: COL.alu });
    }
    placard(K, bh, 0.34, 0.06, { bg: '#1c2b3a', fg: '#e8eef2', lines: [['WORK BENCH  ·  TOOLS', 26, 800]] }, tb, { p: [0, 0.205, 0.022] });
    // Gooseneck task lamp.
    const lampBase = V(HD.hw - 0.02, 1.98, zc + 0.15);
    const lampHead = V(HD.hw - 0.36, 1.62, zc + 0.05);
    cable(K, bh, [lampBase, V(HD.hw - 0.12, 2.03, zc + 0.12), V(HD.hw - 0.3, 1.86, zc + 0.08), lampHead.clone().add(V(0, 0.06, 0))], 0.012, COL.dark);
    put(bh, M.paint, new THREE.CylinderGeometry(0.025, 0.075, 0.09, 20, 1, true), null, { p: [lampHead.x, lampHead.y, lampHead.z], r: [0, 0, 0.35], color: 0x24282c });
    put(bh, M.lamp, new THREE.CircleGeometry(0.062, 20).rotateX(PI / 2), null, { p: [lampHead.x - 0.016, lampHead.y - 0.042, lampHead.z], r: [0, 0, 0.35] });
    K.lampHead = lampHead;
    addAnchor('hab_bench', 0.4, 0.2, zc + 0.05, PI / 2);
    // CO2 gauge beside the tool board.
    const gf = wallL(1.62, 6.3, 0.0);
    const gface = atlas.add(260, 260, (g, w, h) => {
      g.fillStyle = '#101418';
      g.beginPath();
      g.arc(w / 2, h / 2, w / 2 - 2, 0, PI * 2);
      g.fill();
      const arc = (a0, a1, col) => {
        g.strokeStyle = col;
        g.lineWidth = 14;
        g.beginPath();
        g.arc(w / 2, h / 2, 100, a0, a1);
        g.stroke();
      };
      const A = (v) => PI * 0.75 + (v / 30) * PI * 1.5;
      arc(A(0), A(8), '#2fbf6a');
      arc(A(8), A(15), '#e3a21a');
      arc(A(15), A(30), '#d8352a');
      g.strokeStyle = '#e8ecef';
      g.lineWidth = 3;
      g.fillStyle = '#e8ecef';
      g.font = `700 20px ${TX.FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let v = 0; v <= 30; v += 5) {
        const a = A(v);
        g.beginPath();
        g.moveTo(w / 2 + Math.cos(a) * 84, h / 2 + Math.sin(a) * 84);
        g.lineTo(w / 2 + Math.cos(a) * 94, h / 2 + Math.sin(a) * 94);
        g.stroke();
        g.fillText(String(v), w / 2 + Math.cos(a) * 66, h / 2 + Math.sin(a) * 66);
      }
      g.font = `800 22px ${TX.FONT}`;
      g.fillText('ppCO2', w / 2, h / 2 + 84);
      g.font = `600 16px ${TX.FONT}`;
      g.fillText('mmHg', w / 2, h / 2 - 28);
    });
    put(bh, M.metal, new THREE.CylinderGeometry(0.11, 0.11, 0.04, 28).rotateX(PI / 2), gf, { p: [0, 0, 0.02], color: COL.alu });
    decal(K, bh, gface, 0.19, 0.19, gf, { p: [0, 0, 0.041] });
    K.gaugeM = gf;
    placard(K, bh, 0.2, 0.045, { bg: '#e9e8e0', lines: [['CABIN CO2', 24, 800]] }, gf, { p: [0, -0.15, 0.003] });
    // Sleep station: a sleeping bag strapped to the wall, a hood, a small kit.
    const sl = wallL(1.25, 8.7, 0.0);
    put(bh, M.paint, rbox(0.9, 1.5, 0.03, 0.02, 1), sl, { p: [0, 0, 0.015], color: 0xc9d0d4 });
    put(bh, M.fabric, planarUV(rbox(0.6, 1.3, 0.2, 0.09, 3), 2), sl, { p: [-0.02, -0.05, 0.12], color: COL.blue });
    put(bh, M.fabric, rbox(0.36, 0.3, 0.16, 0.08, 2), sl, { p: [-0.02, 0.62, 0.13], color: 0x24497c });
    for (const y of [-0.4, 0.05, 0.42]) strap(K, bh, sl, -0.02, y, 0.66, PI / 2, 0x1a1d22);
    for (const y of [-0.4, 0.05, 0.42]) put(bh, M.fabric, rbox(0.64, 0.035, 0.012, 0.004, 1), sl, { p: [-0.02, y, 0.225], color: 0x1a1d22 });
    // A photo and a child's drawing tucked in a strap.
    const photo = atlas.add(150, 110, (g, w, h) => {
      g.fillStyle = '#fafafa';
      g.fillRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#6f9ccc');
      gr.addColorStop(0.6, '#c9b48a');
      gr.addColorStop(1, '#8a6f45');
      g.fillStyle = gr;
      g.fillRect(8, 8, w - 16, h - 26);
      g.fillStyle = '#2b2b2b';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(40 + i * 34, 60 - i * 3, 9, 0, PI * 2);
        g.fill();
        g.fillRect(32 + i * 34, 68 - i * 3, 16, 20);
      }
    });
    decal(K, bh, photo, 0.1, 0.073, sl, { p: [0.38, 0.45, 0.034], r: [0, 0, -0.06] });
    const draw2 = atlas.add(150, 110, (g, w, h) => {
      g.fillStyle = '#fffdf5';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2b6cc4';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(46, 52, 26, 0, PI * 2);
      g.stroke();
      g.fillStyle = '#e3a21a';
      g.beginPath();
      g.arc(118, 30, 14, 0, PI * 2);
      g.fill();
      g.strokeStyle = '#c0261c';
      g.beginPath();
      g.moveTo(60, 95);
      g.lineTo(90, 60);
      g.lineTo(104, 76);
      g.stroke();
      g.fillStyle = '#333';
      g.font = `700 14px ${TX.FONT}`;
      g.fillText('COME HOME', 52, 104);
    });
    decal(K, bh, draw2, 0.1, 0.073, sl, { p: [0.38, 0.33, 0.034], r: [0, 0, 0.05] });
    placard(K, bh, 0.26, 0.05, { bg: '#1c2b3a', fg: '#e8eef2', lines: [['CREW QTRS  ·  SLEEP', 24, 800]] }, sl, { p: [0, 0.7, 0.031] });
  }

  // ---------- Habitat right wall (-x): laptops, lockers 7-10, medkit ----------
  {
    // Laptops on articulated arms, a status display.
    const lapAt = (z, region) => {
      const base = wallR(1.32, z, 0.0);
      cable(K, bh, [V(-HD.hw + 0.02, 1.25, z), V(-HD.hw + 0.12, 1.18, z), V(-HD.hw + 0.24, 1.26, z)], 0.016, COL.alu);
      laptop(K, bh, frameMatrix(V(-HD.hw + 0.22, 1.29, z - 0.0), V(1, 0, 0)).multiply(mat4([0, 0, -0.1])), region);
      put(bh, M.paint, rbox(0.08, 0.06, 0.02, 0.01, 1), base, { p: [0, -0.07, 0.01], color: COL.dark });
    };
    lapAt(4.72, screens.regions.lapB);
    lapAt(5.12, screens.regions.lapA);
    // A loose laptop power cable floating in a lazy arc.
    cable(K, bh, [V(-0.95, 1.24, 5.12), V(-0.7, 1.05, 5.0), V(-0.55, 1.2, 4.75), V(-0.8, 1.45, 4.62), V(-1.18, 1.62, 4.6)], 0.006, COL.black);
    const st = wallR(1.92, 4.9, 0.0);
    put(bh, M.paint, rbox(0.42, 0.29, 0.03, 0.012, 1), st, { p: [0, 0, 0.015], color: 0x16191c });
    put(bh, M.habScreen, uvRect(new THREE.PlaneGeometry(0.36, 0.235), screens.regions.hab), st, { p: [0, 0, 0.032] });
    // Lockers 7-10 (2 x 2), recessed into the rack.
    const LOCK = [
      ['L7', 'LiOH CARTRIDGES'],
      ['L8', 'TOOLS  ·  TAPE'],
      ['L9', 'HOSES  ·  DUCT'],
      ['L10', 'CLOTHING  ·  BAGS'],
    ];
    const ys = [AXY + 0.29, AXY - 0.21];
    const zs = [5.65, 6.15];
    let n = 6;
    const contents = (k) => (b, Mx, w, h) => {
      const r = rng(k + 30);
      if (k === 0) for (let i = 0; i < 3; i++) put(b, M.paint, rbox(0.12, 0.14, 0.12, 0.01, 1), Mx, { p: [-0.13 + i * 0.13, -h / 2 + 0.09, -0.12], color: 0xd7d9d6 });
      else if (k === 2) put(b, M.rubber, new THREE.TorusGeometry(0.11, 0.025, 8, 24), Mx, { p: [0, -0.04, -0.12], color: 0x2c3036 });
      else for (let i = 0; i < 2; i++) put(b, M.fabric, rbox(0.18, 0.16 + r() * 0.1, 0.18, 0.03, 1), Mx, { p: [-0.1 + i * 0.2, -h / 2 + 0.12, -0.13], color: [COL.ctb, COL.nomex, 0x8b9aa6][k % 3] });
    };
    ys.forEach((y) => {
      zs.forEach((z) => {
        const Mx = wallR(y, z, 0.0);
        const L = locker(K, bh, zones.hab, Mx, 0.48, 0.48, 0.32, LOCK[n - 6][0], LOCK[n - 6][1], contents(n - 6));
        L.id = n + 1;
        lockers.push(L);
        addAnchor('locker_' + (n + 1), -HD.hw + 0.62, y - 1.0, z, -PI / 2);
        n++;
      });
    });
    addAnchor('hab_lockers', -HD.hw + 0.66, AXY + 0.04 - 1.0, 5.9, -PI / 2);
    // Medkit, a CTB stack, the extinguisher, drawer fronts.
    const mk = wallR(1.55, 6.95, 0.0);
    put(bh, M.fabric, rbox(0.4, 0.28, 0.14, 0.05, 2), mk, { p: [0, 0, 0.07], color: 0xe8ebe6 });
    const cross = atlas.add(120, 120, (g, w, h) => {
      g.fillStyle = '#2f8a4e';
      rr2(g, 0, 0, w, h, 14);
      g.fillStyle = '#fff';
      g.fillRect(w * 0.38, h * 0.16, w * 0.24, h * 0.68);
      g.fillRect(w * 0.16, h * 0.38, w * 0.68, h * 0.24);
    });
    decal(K, bh, cross, 0.1, 0.1, mk, { p: [-0.1, 0.02, 0.142] });
    placard(K, bh, 0.16, 0.05, { bg: '#f4f3ee', lines: [['MEDICAL', 26, 800], ['KIT A', 14, 700]] }, mk, { p: [0.08, 0.02, 0.142] });
    for (const x of [-0.12, 0.12]) put(bh, M.fabric, rbox(0.035, 0.3, 0.15, 0.006, 1), mk, { p: [x, 0, 0.07], color: 0x5b5f55 });
    addAnchor('medkit', -HD.hw + 0.62, 0.55, 6.95, -PI / 2);
    bag(K, bh, wallR(1.0, 7.7), 0.52, 0.4, 0.28, { label: ['H05', 'FOOD  ·  DAY 5-8'] });
    bag(K, bh, wallR(1.48, 7.75, 0.0).multiply(mat4([0, 0, 0], [0, 0, 0.05])), 0.46, 0.32, 0.24, { color: COL.nomex, label: ['H06', 'WATER  ·  BAGS'] });
    const pf = wallR(1.15, 8.3, 0.08);
    put(bh, M.paint, new THREE.CylinderGeometry(0.06, 0.06, 0.42, 16), pf, { color: COL.red });
    put(bh, M.paint, new THREE.CylinderGeometry(0.035, 0.05, 0.06, 12), pf, { p: [0, 0.24, 0], color: COL.black });
    placard(K, bh, 0.09, 0.05, { bg: '#fff', fg: '#b3261e', lines: [['PFE', 30, 800]] }, pf, { p: [0, 0.02, 0.061] });
    for (let i = 0; i < 4; i++) {
      const d = wallR(AXY - 0.45 + i * 0.3, 8.95, 0.0);
      put(bh, M.paint, rbox(0.8, 0.26, 0.03, 0.01, 1), d, { p: [0, 0, 0.015], color: [0xd8dcda, 0xc9d0d4, 0xd8dcda, 0xe2e3df][i] });
      put(bh, M.metal, rbox(0.16, 0.025, 0.03, 0.008, 1), d, { p: [0, 0.06, 0.04], color: COL.alu });
      stowLabel(K, bh, 0.15, 0.05, 'D' + (i + 1), ['SPARES  ·  ECLSS', 'CABLES  ·  USB', 'HYGIENE', 'CAMERA  ·  CARDS'][i], d, { p: [-0.25, 0.0, 0.032] });
    }
    // Chemlight by the lockers.
    put(bh, M.emer, new THREE.CylinderGeometry(0.008, 0.008, 0.15, 8), null, { p: [-HD.hw + 0.02, AXY + 0.72, 6.43], r: [0, 0, 0.4], color: 0x6dff8a });
  }
  // Deck: foot restraints at the bench, the window and the lockers; bags.
  {
    const loop = (x, z, rot = 0) => {
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const P = (dx, dy) => V(x + dx * c, 0.07 + dy, z + dx * s);
      cable(K, bh, [P(-0.12, 0), P(-0.08, 0.07), P(0.08, 0.07), P(0.12, 0)], 0.014, COL.rail);
    };
    loop(0.45, 7.0, PI / 2);
    loop(0.45, 7.3, PI / 2);
    loop(-0.15, 8.6);
    loop(0.15, 8.6);
    loop(-0.45, 5.8, PI / 2);
    bag(K, bh, frameMatrix(V(-0.4, 0.07, 8.0), V(0, 1, 0), V(0, 0, 1)), 0.5, 0.36, 0.22, { color: COL.ctb, label: ['H09', 'EXERCISE KIT'] });
    placard(K, bh, 0.3, 0.06, { bg: '#e7c43a', fg: '#16130a', lines: [['AIR RETURN  ·  KEEP CLEAR', 22, 800]] }, frameMatrix(V(0.3, 0.075, 5.2), V(0, 1, 0), V(0, 0, 1)));
    // Overhead: the hab ID and a vent.
    placard(K, bh, 0.5, 0.08, { bg: '#1c2b3a', fg: '#e8eef2', lines: [['IBIS  ·  HAB MODULE', 34, 800]] }, frameMatrix(V(0, AXY + HD.hh - 0.004, 4.7), V(0, -1, 0), V(0, 0, 1)));
  }

  // ---------- Mechanical density: avionics, fans, nets, vents ----------
  {
    // An equipment box: ribbed sides, connectors with cables, LEDs, a label.
    const unit = (b, Mx, w, h, d, o = {}) => {
      put(b, M.paint, rbox(w, h, d, 0.012, 1), Mx, { p: [0, 0, d / 2], color: o.color || 0x5d666e });
      for (let i = 0; i < Math.floor(w / 0.035); i++) put(b, M.paint, rbox(0.012, h * 0.62, 0.012, 0.003, 1), Mx, { p: [-w / 2 + 0.03 + i * 0.035, h * 0.08, d + 0.005], color: 0x3f474e });
      for (let i = 0; i < (o.plugs || 3); i++) {
        const x = -w / 2 + 0.05 + i * 0.06;
        put(b, M.metal, new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10).rotateX(PI / 2), Mx, { p: [x, -h / 2 + 0.05, d + 0.012], color: COL.alu });
      }
      const L = o.zone === 'hab' ? M.habLED : M.capLED;
      for (let i = 0; i < 3; i++) put(b, L, new THREE.CylinderGeometry(0.005, 0.005, 0.004, 8).rotateX(PI / 2), Mx, { p: [w / 2 - 0.04 - i * 0.025, -h / 2 + 0.05, d + 0.002], color: [0x40ff80, 0x40ff80, 0xffb020][i] });
      if (o.label) placard(K, b, Math.min(0.2, w * 0.5), 0.04, { bg: '#e9e8e0', lines: [[o.label, 20, 800]] }, Mx, { p: [w * 0.18, h / 2 - 0.04, d + 0.002] });
    };
    // Capsule: avionics beside the console, under the windows.
    for (const s of [-1, 1]) {
      const f = coneSide(s, 0.55, 1.62, 0.16);
      unit(bc, f.matrix, 0.34, 0.26, 0.12, { label: s > 0 ? 'AV BAY 2' : 'AV BAY 3', color: 0x4c555d });
      cable(K, bc, [V(0, 0, 0.13).applyMatrix4(f.matrix).add(V(0, -0.08, 0)), V(0, 0, 0.2).applyMatrix4(f.matrix).add(V(0, -0.25, 0)), V(s * 1.0, 0.03, 1.55)], 0.01, COL.black);
      const f2 = coneSide(s, 1.25, 2.1, 0.1);
      unit(bc, f2.matrix, 0.26, 0.2, 0.09, { plugs: 2, color: 0x6b747c });
    }
    // Cargo net over the ceiling bags.
    const net = atlas.add(256, 192, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#2b2f33';
      g.lineWidth = 4;
      for (let k = -h; k < w + h; k += 28) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k + h, h);
        g.moveTo(k + h, 0);
        g.lineTo(k, h);
        g.stroke();
      }
      g.strokeStyle = '#d8b02a';
      g.lineWidth = 7;
      g.strokeRect(4, 4, w - 8, h - 8);
    });
    {
      const f = coneFrame(0, 0.85, 0.27);
      decal(K, bc, net, 1.2, 0.95, f.matrix);
      for (const x of [-0.58, 0.58]) for (const y of [-0.45, 0.45]) put(bc, M.metal, rbox(0.04, 0.04, 0.27, 0.01, 1), f.matrix, { p: [x, y, -0.135], color: COL.alu });
    }
    // Habitat: fan units, a payload rack box, an ECLSS panel, overhead vents.
    unit(bh, wallL(0.8, 5.85), 0.56, 0.34, 0.1, { zone: 'hab', label: 'CABIN FAN 2' });
    const grille = atlas.add(256, 160, (g, w, h) => {
      g.fillStyle = '#23282c';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#0e1012';
      for (let y = 10; y < h - 8; y += 12) g.fillRect(10, y, w - 20, 6);
    });
    decal(K, bh, grille, 0.28, 0.17, wallL(0.8, 5.85).multiply(mat4([-0.08, 0.0, 0.106])));
    unit(bh, wallR(0.85, 6.95), 0.62, 0.36, 0.14, { zone: 'hab', label: 'PAYLOAD 04', color: 0x7b858c, plugs: 5 });
    unit(bh, wallR(0.82, 4.95), 0.6, 0.3, 0.08, { zone: 'hab', label: 'ECLSS  ·  HAB', color: 0x9aa3a9, plugs: 4 });
    for (let i = 0; i < 5; i++) {
      const z = HD.z0 + 0.5 + i;
      const m = frameMatrix(V(0, AXY + HD.hh - 0.006, z), V(0, -1, 0), V(0, 0, 1));
      if (i !== 2) decal(K, bh, grille, 0.36, 0.22, m);
    }
    // Checklist cards and a tethered pen velcroed on the racks.
    const card = (b, Mx, title, line) => placard(K, b, 0.13, 0.18, { bg: '#f4f2ea', fg: '#16202a', radius: 4, lines: [[title, 26, 800], [line, 15, 600], ['1. ____', 14, 600], ['2. ____', 14, 600], ['3. ____', 14, 600]] }, Mx);
    card(bh, wallR(1.55, 7.25, 0.006), 'O2', 'EMER  ·  MASK');
    card(bh, wallL(1.2, 6.05, 0.006), 'CO2', 'ADAPTER  ·  2.14');
    card(bc, coneSide(1, 1.0, 1.45, 0.02).matrix, 'PWR', 'DOWN  ·  CB 1-8');
  }

  // ---------- Bake the static geometry ----------
  for (const [k, b] of Object.entries(B)) {
    const meshes = b.bake(zones[k], { castShadow: k === 'cap', receiveShadow: true });
    meshes.forEach((m) => {
      if (m.material.isMeshBasicMaterial) {
        m.castShadow = false;
        m.userData.noAO = true;
      }
    });
  }
  // Window panes (portal material), one mesh per module.
  const outside = createOutside({ tier: T, frost, view: opts.view || 'approach' });
  const paneMeshes = [];
  for (const [b, zone] of [
    [capWin, zones.cap],
    [habWin, zones.hab],
  ]) {
    const geos = [];
    for (const [, list] of b.parts) geos.push(...list);
    b.parts.clear();
    const bb = new Builder();
    geos.forEach((g) => bb.parts.set(outside.material, (bb.parts.get(outside.material) || []).concat([g])));
    const [m] = bb.bake(zone, { castShadow: false, receiveShadow: false });
    m.userData.noAO = true;
    m.onBeforeRender = (renderer, scene, camera) => outside.render(renderer, scene, camera, group);
    paneMeshes.push(m);
  }

  // ---------- Dynamic: breaker levers and lamps (instanced, all 8) ----------
  const leverGeo = new THREE.CylinderGeometry(0.009, 0.012, 0.075, 8);
  leverGeo.translate(0, 0.037, 0);
  const leverTip = new THREE.BoxGeometry(0.03, 0.022, 0.03);
  leverTip.translate(0, 0.08, 0);
  const lb = new Builder();
  lb.add(M.paint, leverGeo, { color: 0xdfe3e6 });
  lb.add(M.paint, leverTip, { color: 0xeeeeee });
  const leverMerged = (() => {
    const tmp = new THREE.Group();
    const [m] = lb.bake(tmp);
    return m.geometry;
  })();
  const levers = new THREE.InstancedMesh(leverMerged, M.paint, 8);
  const lamps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 12).rotateX(PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), 8);
  lamps.userData.noAO = true;
  levers.name = 'breaker-levers';
  lamps.name = 'breaker-lamps';
  levers.frustumCulled = lamps.frustumCulled = false;
  group.add(levers, lamps);
  const breakerOn = [true, true, true, true, true, true, true, true];
  const breakerK = [1, 1, 1, 1, 1, 1, 1, 1];
  const _lm = new THREE.Matrix4();
  const _c = new THREE.Color();
  function layoutBreakers() {
    for (let i = 0; i < 8; i++) {
      const a = lerp(-0.6, 0.6, breakerK[i]);
      _lm.multiplyMatrices(leverDefs[i].M, mat4([0, 0, 0], [a, 0, 0]));
      levers.setMatrixAt(i, _lm);
      lamps.setMatrixAt(i, leverDefs[i].L);
    }
    levers.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
  }
  function colourLamps(powerK) {
    for (let i = 0; i < 8; i++) {
      const on = breakerOn[i];
      const live = powerK > 0.03 ? 1 : 0.15;
      if (on) _c.setRGB(0.3 * live, 1.25 * live, 0.45 * live);
      else _c.setRGB(1.3 * live, 0.4 * live, 0.04 * live);
      lamps.setColorAt(i, _c);
    }
    lamps.instanceColor.needsUpdate = true;
  }
  layoutBreakers();
  colourLamps(1);

  // ---------- Dynamic: CO2 gauge needle ----------
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.075, 0.004).translate(0, 0.03, 0), new THREE.MeshBasicMaterial({ color: 0xff5a2a }));
  {
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.matrix.copy(K.gaugeM).multiply(mat4([0, 0, 0.046]));
    holder.add(needle);
    zones.hab.add(holder);
    needle.userData.noAO = true;
  }

  // ---------- Dynamic: alarm beacons ----------
  const capBeaconM = coneFrame(0, 2.12, 0.0).matrix.multiply(mat4([0, 0, 0], [PI / 2, 0, 0]));
  const habBeaconM = frameMatrix(V(0, AXY + HD.hh - 0.02, 7.0), V(0, -1, 0), V(0, 0, 1)).multiply(mat4([0, 0, 0], [PI / 2, 0, 0]));
  const beacons = [beacon(K, B.cap, capBeaconM), beacon(K, B.hab, habBeaconM)];
  {
    // The beacon housings went into fresh builders after the bake: bake them.
    B.cap.bake(zones.cap);
    B.hab.bake(zones.hab);
  }
  zones.cap.add(beacons[0]);
  zones.hab.add(beacons[1]);

  // ---------- Floating debris (instanced) ----------
  const floatN = low ? 6 : 12;
  const floatGeo = (() => {
    const fb = new Builder();
    fb.add(M.fabric, planarUV(rbox(0.11, 0.045, 0.15, 0.02, 2), 3), { color: 0xffffff });
    fb.add(M.fabric, rbox(0.115, 0.05, 0.022, 0.005, 1), { p: [0, 0, 0.03], color: 0x555555 });
    fb.add(M.fabric, rbox(0.04, 0.012, 0.06, 0.004, 1), { p: [0, 0.028, -0.03], color: 0x555555 });
    const tmp = new THREE.Group();
    const [m] = fb.bake(tmp);
    return m.geometry;
  })();
  const floaters = new THREE.InstancedMesh(floatGeo, M.fabric, floatN);
  floaters.name = 'floaters';
  const floatData = [];
  {
    const spots = [
      [0.3, 1.9, 0.7],
      [-0.5, 1.6, 1.3],
      [0.1, 2.3, 0.9],
      [0.25, 1.35, 3.3],
      [0.4, 1.5, 6.2],
      [-0.3, 1.9, 7.4],
      [0.2, 0.9, 8.0],
      [-0.6, 1.2, 5.6],
      [0.6, 1.8, 2.0],
      [-0.2, 0.8, 6.8],
      [0.5, 2.0, 8.6],
      [-0.4, 2.1, 0.4],
    ];
    const cols = [0xd8742a, COL.nomex, 0xe7e2cf, 0x9aa7b4, 0x2a4f7a, 0xd9c9a3];
    for (let i = 0; i < floatN; i++) {
      const s = spots[i];
      const sc = 0.55 + R() * 0.5;
      floatData.push({ p: V(s[0], s[1], s[2]), q: new THREE.Euler(R() * 6, R() * 6, R() * 6), w: V((R() - 0.5) * 0.3, (R() - 0.5) * 0.3, (R() - 0.5) * 0.3), ph: R() * 6, s: V(sc, sc * (0.6 + R()), sc) });
      floaters.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    }
  }
  group.add(floaters);

  // ---------- Dust motes, lit only inside the light shafts ----------
  const moteN = low ? 160 : 520;
  const motes = (() => {
    const pos = new Float32Array(moteN * 3);
    const seed = new Float32Array(moteN);
    for (let i = 0; i < moteN; i++) {
      const z = R() * 9.2 + 0.1;
      const r = z < 2.5 ? capRadius(z) * 0.8 : z < 4.4 ? 0.6 : 1.1;
      pos[i * 3] = (R() - 0.5) * 2 * r;
      pos[i * 3 + 1] = Math.max(0.1, AXY + (R() - 0.5) * 2 * r);
      pos[i * 3 + 2] = z;
      seed[i] = R();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        beams: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
        dirs: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
        cols: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] },
        ambient: { value: 0.05 },
        size: { value: low ? 2.6 : 3.2 },
      },
      vertexShader: /* glsl */ `
        uniform float time;
        uniform vec4 beams[3];
        uniform vec4 dirs[3];
        uniform vec3 cols[3];
        uniform float ambient;
        uniform float size;
        attribute float seed;
        varying vec3 vC;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main() {
          vec3 p = position;
          p += vec3(sin(time * 0.11 + seed * 40.0), sin(time * 0.07 + seed * 17.0), cos(time * 0.09 + seed * 23.0)) * 0.12;
          vec3 c = vec3(ambient);
          for (int i = 0; i < 3; i++) {
            vec3 d = p - beams[i].xyz;
            float along = dot(d, dirs[i].xyz);
            float r = length(d - dirs[i].xyz * along);
            float k = smoothstep(beams[i].w * 1.2, beams[i].w * 0.4, r) * step(0.0, along) * smoothstep(dirs[i].w, dirs[i].w * 0.4, along);
            c += cols[i] * k;
          }
          vC = c * (0.6 + 0.4 * sin(time * 1.3 + seed * 60.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = size * (0.5 + seed) * (2.0 / max(0.3, -mv.z));
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC;
        #include <common>
        #include <logdepthbuf_pars_fragment>
        void main() {
          #include <logdepthbuf_fragment>
          vec2 q = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(q));
          gl_FragColor = vec4(vC * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.name = 'motes';
    return pts;
  })();
  group.add(motes);

  // ---------- Lights ----------
  const lights = [];
  const L = (l, parent = group) => (parent.add(l), lights.push(l), l);
  const capKey = L(new THREE.SpotLight(0xdfe9ff, 9, 0, 1.05, 0.95, 2));
  capKey.position.set(0, AXY + 1.45, 0.75);
  capKey.target.position.set(0, 0.35, 1.35);
  group.add(capKey.target);
  const capFill = L(new THREE.PointLight(0xdfe9ff, 3, 0, 2));
  capFill.position.set(0, AXY + 0.75, 1.95);
  const consoleGlow = L(new THREE.PointLight(0x7fc4ff, 0.9, 2.6, 2));
  consoleGlow.position.set(0, 1.05, 1.42);
  const tunLight = L(new THREE.PointLight(0xe6efff, 2.2, 0, 2));
  tunLight.position.set(0, AXY + 0.35, 3.45);
  const habA = L(new THREE.SpotLight(0xe3ecff, 9, 0, 1.1, 1, 2));
  habA.position.set(0, AXY + 1.1, 5.6);
  habA.target.position.set(0, 0, 5.75);
  group.add(habA.target);
  const habB = L(new THREE.SpotLight(0xe3ecff, 9, 0, 1.1, 1, 2));
  // The master alarm washes the cabin red with each pulse (the sweeping beacons alone only touch a wall).
  const ALARM_RED = new THREE.Color(0xff2412);
  const keyBase = { cap: capKey.color.clone(), tun: tunLight.color.clone(), hab: habA.color.clone() };
  habB.position.set(0, AXY + 1.1, 7.9);
  habB.target.position.set(0, 0, 8.0);
  group.add(habB.target);
  // Moonlight spilling round the window frame and the end wall.
  const moonSpill = L(new THREE.PointLight(0x9fb6ff, 0.9, 2.6, 2));
  moonSpill.position.set(0, AXY + 0.05, HD.z1 - 0.45);
  // Warm task light over the bench.
  const benchLamp = L(new THREE.SpotLight(0xffb468, 3.5, 3.5, 0.75, 0.6, 2));
  benchLamp.position.copy(K.lampHead).add(V(-0.02, -0.05, 0));
  benchLamp.target.position.set(HD.hw - 0.3, 1.0, K.lampHead.z);
  group.add(benchLamp.target);
  // Sunlight through the right capsule window: the one shadow caster.
  const sunWin = capWinFrames[1];
  const sun = L(new THREE.SpotLight(0xfff0dc, 90, 7, 0.2, 0.35, 2));
  sun.position.copy(sunWin.pos).addScaledVector(sunWin.normal, -0.3);
  group.add(sun.target);
  sun.castShadow = !low;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.2;
  sun.shadow.camera.far = 6;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  // Moonlight through the habitat window.
  const moon = L(new THREE.SpotLight(0xc4d4ff, 9, 9, 0.62, 0.8, 2));
  moon.position.set(0, AXY + 0.05, HD.z1 + 0.4);
  moon.target.position.set(0.1, 0.5, 6.0);
  group.add(moon.target);
  // Rotating red alarm lights.
  const alarmSpots = [0, 1].map((i) => {
    const s = L(new THREE.SpotLight(0xff2010, 0, 6, 0.55, 0.5, 2));
    const m = i ? habBeaconM : capBeaconM;
    s.position.setFromMatrixPosition(m).add(V(0, i ? -0.12 : -0.12, 0));
    group.add(s.target);
    return s;
  });

  // Light shafts (visual cones) and their dust.
  const beams = [];
  const sunBeam = lightBeam({ length: 3.4, radius: 0.55, radiusTop: 0.17, color: 0xfff0d8, intensity: 0.32, noise: 0.5 });
  const moonBeam = lightBeam({ length: 4.2, radius: 1.3, radiusTop: 0.6, color: 0xbcd0ff, intensity: 0.15, noise: 0.5 });
  const lampBeam = lightBeam({ length: 0.7, radius: 0.36, radiusTop: 0.06, color: 0xffc080, intensity: 0.18, noise: 0.2 });
  beams.push(sunBeam, moonBeam, lampBeam);
  beams.forEach((b) => group.add(b));
  function aimBeam(b, from, dir) {
    b.position.copy(from);
    b.quaternion.setFromUnitVectors(V(0, -1, 0), dir.clone().normalize());
  }
  const moonDir = V(0.02, -0.2, -1).normalize();
  aimBeam(moonBeam, V(0, AXY + 0.05, HD.z1 + 0.15), moonDir);
  aimBeam(lampBeam, K.lampHead.clone().add(V(-0.02, -0.05, 0)), V(0.25, -1, 0));
  let sunDir = V(0.89, -0.37, -0.26).normalize();
  function aimSun() {
    const v = outside.view;
    if (v && v.sun) sunDir = V(-v.sun[0], -v.sun[1], -v.sun[2]).normalize();
    const vis = !!(v && v.sun) && sunDir.dot(sunWin.normal) > 0.2;
    sun.intensity = vis ? 90 : 0;
    sunBeam.visible = vis;
    sun.target.position.copy(sun.position).addScaledVector(sunDir, 3);
    aimBeam(sunBeam, sunWin.pos.clone().addScaledVector(sunWin.normal, 0.02), sunDir);
    const mvis = !!(v && v.moon);
    moon.intensity = mvis ? (v.sun ? 9 : 1.5) : 0.6;
    moonBeam.visible = mvis && !!v.sun;
    const U = motes.material.uniforms;
    U.beams.value[0].set(sunWin.pos.x, sunWin.pos.y, sunWin.pos.z, 0.32);
    U.dirs.value[0].set(sunDir.x, sunDir.y, sunDir.z, vis ? 3.4 : 0);
    U.cols.value[0].setRGB(vis ? 1.6 : 0, vis ? 1.45 : 0, vis ? 1.2 : 0);
    U.beams.value[1].set(0, AXY + 0.05, HD.z1 + 0.1, 0.9);
    U.dirs.value[1].set(moonDir.x, moonDir.y, moonDir.z, mvis ? 4.4 : 0);
    U.cols.value[1].setRGB(0.55, 0.65, 0.95);
    U.beams.value[2].set(K.lampHead.x, K.lampHead.y, K.lampHead.z, 0.2);
    U.dirs.value[2].set(0.24, -0.97, 0, 0.75);
    U.cols.value[2].setRGB(0.9, 0.6, 0.3);
  }
  aimSun();

  // ---------- State ----------
  const state = { alarm: false, power: 1, co2: 0.12, valve: 0, frost: 0, breakers: breakerOn };
  let time = 0;
  let valveK = 0;
  let co2K = 0.12;
  const LED_BASE = 2.4;
  function zoneK(p) {
    return {
      hab: smooth(clamp((p - 0.55) / 0.35)),
      tun: smooth(clamp((p - 0.35) / 0.3)),
      cap: smooth(clamp((p - 0.1) / 0.45)),
      emer: 1 - smooth(clamp(p / 0.5)),
    };
  }
  function applyPower(pulse = 0) {
    const p = state.power;
    const z = zoneK(p);
    const flick = state.alarm && !reduced ? 0.93 + 0.07 * Math.sin(time * 37) * Math.sin(time * 11) : 1;
    const red = state.alarm ? 0.55 * pulse : 0;
    const led = (mat, k) => mat.color.setRGB(LED_BASE * k * flick + red * 1.6, LED_BASE * k * flick * (1 - red * 0.6), LED_BASE * k * flick * (1 - red * 0.6));
    led(M.capLED, z.cap);
    led(M.tunLED, z.tun);
    led(M.habLED, z.hab);
    capKey.intensity = 9 * z.cap * flick;
    tunLight.intensity = 2.2 * z.tun * flick;
    habA.intensity = 9 * z.hab * flick;
    // Fill lights turn into the green emergency glow as power drops.
    const e = z.emer;
    capFill.intensity = 0.9 * z.cap * flick + 0.35 * e;
    capFill.color.setRGB(lerp(0.88, 0.35, e), lerp(0.91, 1.0, e), lerp(1.0, 0.55, e));
    habB.intensity = 9 * z.hab * flick + 1.0 * e;
    habB.color.copy(capFill.color);
    const wash = state.alarm ? (reduced ? 0.7 : 0.5 + 0.45 * pulse) : 0;
    capKey.color.copy(keyBase.cap).lerp(ALARM_RED, wash);
    tunLight.color.copy(keyBase.tun).lerp(ALARM_RED, wash);
    habA.color.copy(keyBase.hab).lerp(ALARM_RED, wash);
    habB.color.lerp(ALARM_RED, wash);
    capFill.color.lerp(ALARM_RED, wash * 0.9);
    consoleGlow.intensity = (p > 0.08 ? 0.35 + 0.65 * z.cap : 0) * 0.9;
    const lampK = p > 0.06 ? 0.45 + 0.55 * z.hab : 0;
    benchLamp.intensity = 3.5 * lampK;
    lampBeam.visible = lampK > 0;
    lampBeam.material.uniforms.intensity.value = 0.18 * lampK;
    M.lamp.color.setRGB(3.2 * lampK + 0.05, 2.2 * lampK + 0.04, 1.1 * lampK + 0.03);
    M.emer.color.setScalar(0.25 + 1.6 * e);
    const s = 0.3 + 0.95 * smooth(clamp(p / 0.6));
    M.capScreen.color.setRGB(s * (1 + red * 0.4), s * (1 - red * 0.35), s * (1 - red * 0.35));
    M.habScreen.color.setScalar(0.85);
    // Ambient bounce on the materials follows the lights.
    const envK = 0.025 + 0.09 * (0.5 * z.cap + 0.5 * z.hab);
    [M.panel, M.paint, M.deck, M.label, M.door].forEach((m) => (m.envMapIntensity = envK));
    M.metal.envMapIntensity = envK * 2;
    M.fabric.envMapIntensity = envK * 0.5;
    outside.uniforms.uDim.value = 0.25 + 0.75 * z.cap;
    outside.uniforms.uRed.value = red;
    motes.material.uniforms.ambient.value = 0.03 + 0.05 * z.cap;
  }
  screens.set({ power: 1, co2: co2K });
  applyPower();

  // ---------- Anchors (start, and the rest set above) ----------
  const st = STARTS[opts.start] || STARTS.capsule;
  addAnchor('start', st[0], st[1], st[2], st[3]);

  // ---------- Camera colliders (keep the camera out of solid things) ----------
  const colliders = {
    circles: [],
    boxes: [
      { minX: -1.05, maxX: 1.05, minY: 0, maxY: 0.9, minZ: 1.5, maxZ: 2.4 },
      { minX: 0.1, maxX: 0.7, minY: 0, maxY: 1.25, minZ: 0.55, maxZ: 1.12 },
      { minX: -0.7, maxX: -0.1, minY: 0, maxY: 1.25, minZ: 0.55, maxZ: 1.12 },
      { minX: 0.72, maxX: 1.32, minY: 0.25, maxY: 1.5, minZ: 0.05, maxZ: 0.62 },
      { minX: -1.32, maxX: -0.72, minY: 0.25, maxY: 1.5, minZ: 0.05, maxZ: 0.62 },
      { minX: -0.82, maxX: 0.82, minY: 1.0, maxY: 2.1, minZ: 0, maxZ: 0.34 },
      { minX: HD.hw - 0.55, maxX: HD.hw, minY: 0.6, maxY: 1.1, minZ: 6.5, maxZ: 7.8 },
    ],
  };

  // ---------- Ready: fonts and the Moon/Earth maps ----------
  const ready = (async () => {
    try {
      if (document.fonts && document.fonts.load) {
        await Promise.race([Promise.all([document.fonts.load(`700 20px Archivo`), document.fonts.load(`800 20px Archivo`), document.fonts.load(`600 20px Archivo`)]), new Promise((r) => setTimeout(r, 3000))]);
        atlas.redraw();
        screens.redrawAll();
      }
    } catch (e) {}
    try {
      const SMD = globalThis.SMD;
      if (SMD && SMD.assets && SMD.assets.texture) await Promise.race([Promise.allSettled([SMD.assets.texture('moon'), SMD.assets.texture('earth-day')]), new Promise((r) => setTimeout(r, 8000))]);
    } catch (e) {}
  })();

  // ---------- Update ----------
  const _e = new THREE.Euler();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  let disposed = false;
  function update(dt, t) {
    if (disposed) return;
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    time = t != null ? t : time + dt;
    outside.frame();
    // Alarm: pulse and sweep.
    const pulse = state.alarm ? (reduced ? 0.75 : 0.5 + 0.5 * Math.sin(time * 6.5)) : 0;
    const flash = state.alarm ? (reduced ? 1 : Math.sin(time * 6.5) > 0 ? 1 : 0.25) : 0;
    M.alarm.color.setRGB(state.alarm ? 0.6 + 5.4 * flash : 0.25, state.alarm ? 0.05 + 0.25 * flash : 0.03, state.alarm ? 0.02 : 0.02);
    alarmSpots.forEach((s, i) => {
      s.intensity = state.alarm ? 28 * (reduced ? 0.7 : 1) : 0;
      const a = reduced ? 0.6 + i : time * 4.2 + i * 1.7;
      const m = i ? habBeaconM : capBeaconM;
      // Sweep round the beacon's axis (its local y).
      const ax = V(0, 1, 0).transformDirection(m);
      const perp = V(1, 0, 0).transformDirection(m);
      const d = perp.clone().applyAxisAngle(ax, a).addScaledVector(ax, 0.25).normalize();
      s.target.position.copy(s.position).addScaledVector(d, 3);
    });
    applyPower(pulse);
    // Lockers swing.
    for (const l of lockers) {
      if (Math.abs(l.target - l.open) > 1e-4) {
        l.open += (l.target - l.open) * Math.min(1, dt * 5);
        l.pivot.rotation.y = -smooth(clamp(l.open)) * 1.85;
      }
    }
    // Valve wheel, breaker levers, gauge needle.
    if (Math.abs(state.valve - valveK) > 1e-4) {
      valveK += (state.valve - valveK) * Math.min(1, dt * 3);
      valveWheel.rotation.z = -valveK * PI * 4;
    }
    let lev = false;
    for (let i = 0; i < 8; i++) {
      const want = breakerOn[i] ? 1 : 0;
      if (Math.abs(want - breakerK[i]) > 1e-3) {
        breakerK[i] += (want - breakerK[i]) * Math.min(1, dt * 18);
        if (Math.abs(want - breakerK[i]) < 0.01) breakerK[i] = want;
        lev = true;
      }
    }
    if (lev) layoutBreakers();
    co2K += (state.co2 - co2K) * Math.min(1, dt * 2);
    needle.rotation.z = -(PI * 0.75 + co2K * PI * 1.5) - PI / 2 + (reduced ? 0 : Math.sin(time * 9) * 0.004);
    // Floaters drift and tumble.
    for (let i = 0; i < floatN; i++) {
      const f = floatData[i];
      _p.copy(f.p).add(_s.set(Math.sin(time * 0.13 + f.ph) * 0.08, Math.sin(time * 0.17 + f.ph * 2) * 0.06, Math.cos(time * 0.11 + f.ph) * 0.08));
      _e.set(f.q.x + time * f.w.x, f.q.y + time * f.w.y, f.q.z + time * f.w.z);
      _q.setFromEuler(_e);
      _m.compose(_p, _q, f.s);
      floaters.setMatrixAt(i, _m);
    }
    floaters.instanceMatrix.needsUpdate = true;
    motes.material.uniforms.time.value = time;
    beams.forEach((b) => (b.material.uniforms.time.value = time));
    screens.update(dt);
  }

  // ---------- The set ----------
  const post = Object.assign({}, LOOKS.interior, {
    bloom: { strength: 0.62, radius: 0.5, threshold: 0.86 },
    ao: { radius: 0.42, intensity: 1.15, distanceFallOff: 1, thickness: 1 },
    grade: { contrast: 1.12, saturation: 0.95, temperature: -0.05, tint: 0, lift: [0.008, 0.013, 0.022], gain: [1.0, 1.0, 1.02] },
    vignette: 0.42,
    grain: 0.05,
  });
  const background = new THREE.Color(0x020304);
  const fog = new THREE.FogExp2(0x0a1018, 0.02);
  const mood = { background, fog, exposure: 0.95, shadows: !low, post };
  const lockerOf = (id) => {
    const n = typeof id === 'number' ? id : parseInt(String(id).replace(/\D+/g, ''), 10);
    return lockers.find((l) => l.id === n);
  };
  const set = {
    id: opts.id || 'capsule',
    includes: ['capsule', 'tunnel', 'habitat'],
    group,
    anchors,
    colliders,
    walkable: null,
    volume: {
      min: V(BOX.min.x, BOX.min.y, BOX.min.z),
      max: V(BOX.max.x, BOX.max.y, BOX.max.z),
      boxes: BOXES.map((b) => Object.assign({}, b)),
      clamp: (p) => clampFeet(p),
    },
    lights,
    mood,
    background,
    fog,
    exposure: mood.exposure,
    post,
    shadows: mood.shadows,
    ambience: 'fans',
    ready,
    state,
    zones,
    update,
    setAlarm(on) {
      state.alarm = !!on;
      screens.set({ alarm: state.alarm });
    },
    setPower(k) {
      state.power = clamp(Number(k));
      if (!isFinite(state.power)) state.power = 1;
      screens.set({ power: state.power });
      colourLamps(state.power);
      applyPower();
    },
    setBreaker(i, on) {
      const n = typeof i === 'number' ? i : parseInt(String(i).replace(/\D+/g, ''), 10);
      if (!(n >= 1 && n <= 8)) return;
      breakerOn[n - 1] = !!on;
      screens.set({ breaker: [n - 1, !on] });
      colourLamps(state.power);
    },
    breaker(i) {
      return breakerOn[i - 1];
    },
    openLocker(id, k = 1) {
      const l = lockerOf(id);
      if (l) l.target = clamp(Number(k));
    },
    setValve(k) {
      state.valve = clamp(Number(k));
      screens.set({ valve: state.valve });
    },
    setCO2(k) {
      state.co2 = clamp(Number(k));
      screens.set({ co2: state.co2 });
    },
    setFrost(k) {
      state.frost = clamp(Number(k));
      outside.uniforms.uFrost.value = state.frost;
    },
    windowView(spec) {
      outside.setView(spec);
      aimSun();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      outside.dispose();
      disposeGroup(group);
      [atlas.texture, screens.texture, pm.map, pm.normalMap, pm.roughnessMap, fm.map, fm.normalMap, dm.map, dm.normalMap, metalR, env, frost].forEach((t) => t && t.dispose());
      Object.values(M).forEach((m) => m && m.dispose && m.dispose());
    },
  };
  return set;
}

function rr2(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
}
