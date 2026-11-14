// Prop builders for the Last Light interior. Each takes the build context K
// (materials K.M, the label atlas K.atlas, the screens atlas K.screens) and a
// Builder (static geometry merged per material, one per zone), plus a placing
// matrix whose +z is the prop's front.
import { THREE, Builder, rng } from './common.js';
import { rbox, planarUV, uvRect, uvPoint, tube, mat4 } from './interior-geo.js';
import { drawPlacard, drawStencil, drawBarcode, rr, FONT, MONO } from './interior-tex.js';

export const COL = {
  white: 0xe4e6e2,
  off: 0xd5d8d4,
  beige: 0xd9cfba,
  bluegrey: 0xb3bec6,
  alu: 0xc5cbd0,
  steel: 0x8f979d,
  dark: 0x2a2e33,
  black: 0x141619,
  rail: 0x6d8fb4,
  yellow: 0xe0b021,
  red: 0xb3261e,
  navy: 0x33465d,
  seat: 0x3d4f66,
  strap: 0x2b3038,
  ctb: 0xd8ccb0,
  nomex: 0xe9e6dc,
  blue: 0x2f5f9e,
  green: 0x2f8a4e,
  orange: 0xd8742a,
  copper: 0xb87333,
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpM = new THREE.Matrix4();
const tmpM2 = new THREE.Matrix4();

// Add geometry under a placing matrix with local p/r/s.
export function put(b, mat, geo, M, o = {}) {
  const local = mat4(o.p, o.r, o.s, o.order);
  const m = M ? tmpM.multiplyMatrices(M, local) : local;
  b.add(mat, geo, { matrix: m.clone(), color: o.color });
  geo.dispose();
}

// ---------- Labels ----------
const PX = 800; // atlas pixels per metre for labels
export function decal(K, b, region, w, h, M, o = {}) {
  const g = uvRect(new THREE.PlaneGeometry(w, h), region);
  put(b, K.M.label, g, M, o);
}
export function placard(K, b, w, h, spec, M, o = {}) {
  const px = o.px || PX;
  const r = K.atlas.add(w * px, h * px, (g, W, H) => drawPlacard(g, W, H, spec));
  decal(K, b, r, w, h, M, o);
  return r;
}
export function stencil(K, b, w, h, text, M, o = {}) {
  const px = o.px || PX;
  const r = K.atlas.add(w * px, h * px, (g, W, H) => drawStencil(g, W, H, text, o));
  decal(K, b, r, w, h, M, { p: o.p, r: o.r });
  return r;
}
// A white stowage label with an ID, a content line and a barcode.
export function stowLabel(K, b, w, h, id, line, M, o = {}) {
  const seed = id.length * 31 + line.length;
  const r = K.atlas.add(w * PX, h * PX, (g, W, H) => {
    g.fillStyle = '#f4f3ee';
    rr(g, 1, 1, W - 2, H - 2, 6);
    g.fill();
    g.fillStyle = '#1d2a3a';
    g.fillRect(6, 6, H * 0.62, H * 0.62);
    g.fillStyle = '#fff';
    g.font = `800 ${Math.round(H * 0.34)}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(id, 6 + H * 0.31, 6 + H * 0.33);
    g.fillStyle = '#1b1f24';
    g.textAlign = 'left';
    let s = Math.round(H * 0.26);
    g.font = `700 ${s}px ${FONT}`;
    while (g.measureText(line).width > W - H * 0.62 - 22 && s > 8) g.font = `700 ${--s}px ${FONT}`;
    g.fillText(line, H * 0.62 + 14, H * 0.3);
    drawBarcode(g, H * 0.62 + 14, H * 0.52, W - H * 0.62 - 26, H * 0.3, seed);
    g.font = `600 ${Math.round(H * 0.13)}px ${MONO}`;
    g.fillStyle = '#555';
    g.fillText('SEQ ' + (1000 + seed * 7), 10, H - 10);
  });
  decal(K, b, r, w, h, M, o);
  return r;
}

// ---------- Small hardware ----------
export function bolts(K, b, M, pts, r = 0.008, color = COL.steel) {
  const g = new THREE.CylinderGeometry(r, r, 0.006, 6).rotateX(Math.PI / 2);
  pts.forEach(([x, y, z]) => b.add(K.M.metal, g, { matrix: tmpM2.multiplyMatrices(M, mat4([x, y, (z || 0) + 0.003])).clone(), color }));
  g.dispose();
}
export function velcro(K, b, M, x, y, w = 0.05, h = 0.05) {
  put(b, K.M.rubber, rbox(w, h, 0.004, 0.006, 1), M, { p: [x, y, 0.002], color: 0x3a3d40 });
}
// A handrail between two points, standing off a surface along normal n.
export function handrail(K, b, a, c, n, color = COL.rail, off = 0.06) {
  const A = a.clone().addScaledVector(n, off);
  const C = c.clone().addScaledVector(n, off);
  const len = A.distanceTo(C);
  const mid = A.clone().add(C).multiplyScalar(0.5);
  const dir = C.clone().sub(A).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
  const bar = new THREE.CylinderGeometry(0.016, 0.016, len, 10);
  b.add(K.M.paint, bar, { matrix: new THREE.Matrix4().compose(mid, q, V(1, 1, 1)), color });
  bar.dispose();
  // Standoffs.
  [a, c].forEach((p) => {
    const s = p.clone().addScaledVector(n, off * 0.5);
    const qs = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n);
    const g = new THREE.CylinderGeometry(0.012, 0.018, off, 8);
    b.add(K.M.paint, g, { matrix: new THREE.Matrix4().compose(s, qs, V(1, 1, 1)), color });
    g.dispose();
    const foot = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 10);
    b.add(K.M.metal, foot, { matrix: new THREE.Matrix4().compose(p.clone().addScaledVector(n, 0.004), qs, V(1, 1, 1)), color: COL.alu });
    foot.dispose();
  });
}
// A cable or hose along points, with ties every so often.
export function cable(K, b, pts, r = 0.008, color = COL.black, ties = 0) {
  const g = tube(pts, r, { radial: 6 });
  b.add(K.M.rubber, g, { color });
  if (ties) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V(p[0], p[1], p[2]))));
    for (let i = 1; i <= ties; i++) {
      const t = i / (ties + 1);
      const p = curve.getPoint(t);
      const d = curve.getTangent(t);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d);
      const tg = new THREE.TorusGeometry(r * 1.25, 0.0025, 4, 10);
      b.add(K.M.paint, tg, { matrix: new THREE.Matrix4().compose(p, q, V(1, 1, 1)), color: 0xe8e8e0 });
      tg.dispose();
    }
  }
  g.dispose();
}
// A bundle of 3-5 cables following the same path (slight offsets).
export function bundle(K, b, pts, n = 4, seed = 1, ties = 5) {
  const r = rng(seed);
  const cols = [COL.black, 0x3b3f44, 0xe0ded6, 0x7a2a22, 0x2a4f7a, COL.yellow];
  for (let i = 0; i < n; i++) {
    const o = V((r() - 0.5) * 0.025, (r() - 0.5) * 0.025, (r() - 0.5) * 0.025);
    cable(K, b, pts.map((p) => (p.isVector3 ? p.clone() : V(p[0], p[1], p[2])).add(o)), 0.0055 + r() * 0.004, cols[Math.floor(r() * cols.length)], i === 0 ? ties : 0);
  }
}

// ---------- Soft goods ----------
// A cargo transfer bag (soft box) with straps, a handle and a stowage label.
export function bag(K, b, M, w, h, d, o = {}) {
  const color = o.color || COL.ctb;
  put(b, K.M.fabric, planarUV(rbox(w, h, d, Math.min(w, h, d) * 0.22, 2), 2), M, { p: [0, 0, d / 2], color });
  // Straps across.
  const sc = o.strap || 0x5b5f55;
  put(b, K.M.fabric, rbox(0.035, h + 0.012, d + 0.012, 0.004, 1), M, { p: [-w * 0.28, 0, d / 2], color: sc });
  put(b, K.M.fabric, rbox(0.035, h + 0.012, d + 0.012, 0.004, 1), M, { p: [w * 0.28, 0, d / 2], color: sc });
  // Handle on top.
  put(b, K.M.fabric, rbox(w * 0.36, 0.02, 0.035, 0.008, 1), M, { p: [0, h / 2 + 0.008, d / 2], color: sc });
  if (o.label) stowLabel(K, b, Math.min(0.16, w * 0.42), Math.min(0.06, h * 0.3), o.label[0], o.label[1], M, { p: [0, h * 0.12, d + 0.004] });
  // Buckles.
  [-w * 0.28, w * 0.28].forEach((x) => put(b, K.M.paint, rbox(0.05, 0.03, 0.012, 0.004, 1), M, { p: [x, -h * 0.18, d + 0.008], color: COL.black }));
}
// A bungee/strap holding something to a wall: a flat band.
export function strap(K, b, M, x, y, len, angle = 0, color = 0x30343a) {
  put(b, K.M.fabric, rbox(0.03, len, 0.006, 0.002, 1), M, { p: [x, y, 0.004], r: [0, 0, angle], color });
}

// ---------- Seats (the seat contract: origin = floor under the pan's front
// edge, pan top 0.45 m up and 0.45 m deep toward -z, backrest behind) ----------
export function seat(K, b, M, tag) {
  const C = COL.seat;
  // Pan and back cushions (fabric), bolsters, headrest.
  put(b, K.M.fabric, planarUV(rbox(0.5, 0.075, 0.46, 0.03, 2), 2), M, { p: [0, 0.413, -0.23], color: C });
  const tilt = -0.2;
  const back = (o) => {
    const m = mat4([0, 0.45, -0.47], [tilt, 0, 0]);
    return tmpM2.multiplyMatrices(M, m).clone();
  };
  const BM = back();
  put(b, K.M.fabric, planarUV(rbox(0.48, 0.8, 0.075, 0.03, 2), 2), BM, { p: [0, 0.42, 0], color: C });
  put(b, K.M.fabric, rbox(0.07, 0.62, 0.13, 0.03, 2), BM, { p: [-0.26, 0.36, 0.03], color: C });
  put(b, K.M.fabric, rbox(0.07, 0.62, 0.13, 0.03, 2), BM, { p: [0.26, 0.36, 0.03], color: C });
  put(b, K.M.fabric, rbox(0.3, 0.2, 0.09, 0.035, 2), BM, { p: [0, 0.94, 0.01], color: C });
  // Shell behind the back (composite, light grey) with the crew tag.
  put(b, K.M.paint, rbox(0.56, 1.02, 0.04, 0.02, 2), BM, { p: [0, 0.5, -0.06], color: COL.off });
  placard(K, b, 0.16, 0.06, { bg: '#1f2a36', fg: '#e8eef2', lines: [[tag, 40, 800]] }, BM, { p: [0, 0.86, -0.082], r: [0, Math.PI, 0] });
  // Frame: side rails along the pan and up the back, pedestal and struts.
  const rail = (sx) => {
    cable(K, b, [tmpPt(M, sx * 0.29, 0.38, 0.03), tmpPt(M, sx * 0.29, 0.38, -0.44), tmpPt(BM, sx * 0.29, 0.75, -0.04)], 0.017, COL.alu);
  };
  rail(-1);
  rail(1);
  put(b, K.M.metal, rbox(0.22, 0.3, 0.3, 0.02, 1), M, { p: [0, 0.2, -0.24], color: COL.steel });
  put(b, K.M.metal, rbox(0.54, 0.035, 0.05, 0.01, 1), M, { p: [0, 0.355, -0.02], color: COL.alu });
  put(b, K.M.metal, rbox(0.54, 0.035, 0.05, 0.01, 1), M, { p: [0, 0.355, -0.44], color: COL.alu });
  [-0.2, 0.2].forEach((x) => {
    cable(K, b, [tmpPt(M, x, 0.0, -0.05), tmpPt(M, x * 0.9, 0.18, -0.12), tmpPt(M, x * 0.8, 0.35, -0.2)], 0.016, COL.steel);
    cable(K, b, [tmpPt(M, x, 0.0, -0.46), tmpPt(M, x * 0.9, 0.2, -0.4), tmpPt(M, x * 0.8, 0.35, -0.32)], 0.016, COL.steel);
    put(b, K.M.metal, rbox(0.09, 0.012, 0.09, 0.004, 1), M, { p: [x, 0.006, -0.05], color: COL.dark });
    put(b, K.M.metal, rbox(0.09, 0.012, 0.09, 0.004, 1), M, { p: [x, 0.006, -0.46], color: COL.dark });
  });
  // Shock strut (silver piston) behind.
  put(b, K.M.metal, new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10), M, { p: [0, 0.2, -0.5], r: [0.5, 0, 0], color: COL.alu });
  // Five-point harness lying on the seat.
  const S = COL.strap;
  [-0.12, 0.12].forEach((x) => {
    put(b, K.M.fabric, rbox(0.045, 0.62, 0.006, 0.002, 1), BM, { p: [x * 0.8, 0.52, 0.042], r: [0, 0, x > 0 ? -0.08 : 0.08], color: S });
    put(b, K.M.fabric, rbox(0.045, 0.006, 0.26, 0.002, 1), M, { p: [x * 1.5, 0.454, -0.22], r: [0, x > 0 ? 0.35 : -0.35, 0], color: S });
  });
  put(b, K.M.fabric, rbox(0.045, 0.006, 0.18, 0.002, 1), M, { p: [0, 0.454, -0.09], color: S });
  put(b, K.M.metal, rbox(0.08, 0.016, 0.08, 0.008, 2), M, { p: [0, 0.462, -0.13], color: COL.alu });
}
const _pt = new THREE.Vector3();
function tmpPt(M, x, y, z) {
  return _pt.set(x, y, z).applyMatrix4(M).clone();
}

// ---------- Toggle switches, knobs, LEDs (on a panel at z = 0) ----------
export function toggle(K, b, M, x, y, o = {}) {
  put(b, K.M.metal, new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8).rotateX(Math.PI / 2), M, { p: [x, y, 0.006], color: COL.alu });
  const up = o.up === false ? -1 : 1;
  put(b, K.M.metal, new THREE.CylinderGeometry(0.0035, 0.0045, 0.03, 6), M, { p: [x, y + up * 0.008, 0.022], r: [up * 1.1, 0, 0], color: 0xdfe3e6 });
  if (o.guard) {
    [-1, 1].forEach((s) => put(b, K.M.paint, rbox(0.004, 0.034, 0.03, 0.001, 1), M, { p: [x + s * 0.014, y, 0.016], color: o.guardColor || COL.dark }));
  }
}
export function knob(K, b, M, x, y, r = 0.016, color = COL.black) {
  put(b, K.M.paint, new THREE.CylinderGeometry(r, r * 1.08, 0.02, 16).rotateX(Math.PI / 2), M, { p: [x, y, 0.01], color });
  put(b, K.M.paint, rbox(0.004, r * 1.6, 0.006, 0.001, 1), M, { p: [x, y, 0.021], color: 0xe8e8e8 });
}
export function led(K, b, mat, M, x, y, color, s = 0.008) {
  put(b, mat, new THREE.CylinderGeometry(s, s, 0.006, 8).rotateX(Math.PI / 2), M, { p: [x, y, 0.004], color });
}

// ---------- Window frame (pane added separately with the portal material) ----------
export function windowShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function windowFrame(K, b, M, w, h, r, depth = 0.08, rim = 0.07) {
  const ring = windowShape(w + rim * 2, h + rim * 2, r + rim);
  ring.holes.push(windowShape(w, h, r));
  const g = new THREE.ExtrudeGeometry(ring, { depth, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 8 });
  put(b, K.M.metal, g, M, { p: [0, 0, -0.01], color: 0xaab2b8 });
  // Inner reveal (the window well).
  const well = new THREE.ExtrudeGeometry(windowShape(w + 0.01, h + 0.01, r), { depth: depth * 0.9, bevelEnabled: false, curveSegments: 8 });
  put(b, K.M.paint, flipNormalsKeepFaces(well), M, { p: [0, 0, -0.005], color: 0x3a4046 });
  // Bolt ring.
  const pts = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * (w / 2 + rim * 0.55), Math.sin(a) * (h / 2 + rim * 0.55), depth]);
  }
  bolts(K, b, M, pts, 0.007, COL.alu);
}
// An extruded solid seen from inside (for wells): reverse faces.
function flipNormalsKeepFaces(g) {
  const ng = g.index ? g.toNonIndexed() : g;
  const p = ng.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    for (let k = 0; k < 3; k++) {
      const t = p.array[(i + 1) * 3 + k];
      p.array[(i + 1) * 3 + k] = p.array[(i + 2) * 3 + k];
      p.array[(i + 2) * 3 + k] = t;
    }
  }
  ng.computeVertexNormals();
  return ng;
}

// ---------- Lockers ----------
// A locker: a recessed cavity (in the static builder) and a door (its own
// mesh on a hinge pivot). Returns { pivot, door } in `parent` space.
export function locker(K, b, parent, M, w, h, depth, id, line, contents) {
  // Cavity: an inside-out box, open at the front (the front face is culled).
  const cav = new THREE.BoxGeometry(w - 0.02, h - 0.02, depth);
  const ci = cav.index.array;
  for (let i = 0; i < ci.length; i += 3) {
    const t = ci[i + 1];
    ci[i + 1] = ci[i + 2];
    ci[i + 2] = t;
  }
  cav.computeVertexNormals();
  put(b, K.M.paint, cav, M, { p: [0, 0, -depth / 2], color: 0x30363c });
  // Contents.
  if (contents) contents(b, M, w, h, depth);
  // Door: atlas-mapped face (label, latch, ID).
  const dr = K.atlas.add(
    w * 600,
    h * 600,
    (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#e9ebe8');
    gr.addColorStop(1, '#cfd3d2');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(70,78,86,0.6)';
    g.lineWidth = 4;
    rr(g, 10, 10, W - 20, H - 20, 14);
    g.stroke();
    // Latch recess.
    g.fillStyle = '#2b3036';
    rr(g, W - 58, H / 2 - 34, 30, 68, 8);
    g.fill();
    g.fillStyle = '#9aa3a8';
    rr(g, W - 52, H / 2 - 26, 18, 52, 5);
    g.fill();
    // Label.
    g.fillStyle = '#f7f6f1';
    rr(g, 22, 22, W - 100, H * 0.42, 6);
    g.fill();
    g.fillStyle = '#1d2a3a';
    g.fillRect(28, 28, H * 0.3, H * 0.3);
    g.fillStyle = '#fff';
    g.font = `800 ${Math.round(H * 0.15)}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(id, 28 + H * 0.15, 28 + H * 0.155);
    g.fillStyle = '#16202a';
    g.textAlign = 'left';
    let s = Math.round(H * 0.1);
    g.font = `800 ${s}px ${FONT}`;
    while (g.measureText(line).width > W - 130 - H * 0.3 && s > 9) g.font = `800 ${--s}px ${FONT}`;
    g.fillText(line, 40 + H * 0.3, 28 + H * 0.1);
    drawBarcode(g, 40 + H * 0.3, 28 + H * 0.19, W - 150 - H * 0.3, H * 0.12, id.charCodeAt(1) || 3);
    // Scuffs near the latch.
    g.strokeStyle = 'rgba(60,60,60,0.25)';
    for (let i = 0; i < 9; i++) {
      g.lineWidth = 1 + (i % 3);
      g.beginPath();
      g.moveTo(W - 80 - i * 6, H / 2 + 30 - i * 5);
      g.lineTo(W - 70 - i * 3, H / 2 + 46 - i * 4);
      g.stroke();
    }
    // Velcro patch.
    g.fillStyle = '#3a3d40';
    rr(g, 30, H - 70, 60, 40, 6);
    g.fill();
    },
    0.75
  );
  const grey = K.atlas.flat || (K.atlas.flat = K.atlas.add(8, 8, (g) => ((g.fillStyle = '#c9cecf'), g.fillRect(0, 0, 8, 8))));
  const pivot = new THREE.Group();
  const hingeLocal = new THREE.Vector3(-w / 2 + 0.01, 0, 0.016);
  pivot.matrixAutoUpdate = true;
  const holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  holder.matrix.copy(M);
  parent.add(holder);
  pivot.position.copy(hingeLocal);
  holder.add(pivot);
  const db = new Builder();
  const front = uvRect(new THREE.PlaneGeometry(w - 0.02, h - 0.02), dr);
  db.add(K.M.door, front, { p: [w / 2 - 0.02, 0, 0.012] });
  const body = uvPoint(new THREE.BoxGeometry(w - 0.02, h - 0.02, 0.022), (grey.u0 + grey.u1) / 2, (grey.v0 + grey.v1) / 2);
  db.add(K.M.door, body, { p: [w / 2 - 0.02, 0, 0] });
  const hinge = uvPoint(new THREE.CylinderGeometry(0.008, 0.008, h * 0.8, 8), (grey.u0 + grey.u1) / 2, (grey.v0 + grey.v1) / 2);
  db.add(K.M.door, hinge, { p: [-0.008, 0, 0] });
  const [door] = db.bake(pivot, { castShadow: false });
  door.name = 'locker-door-' + id;
  // Frame lip around the opening.
  put(b, K.M.paint, rbox(w + 0.03, 0.025, 0.03, 0.006, 1), M, { p: [0, h / 2, 0], color: COL.dark });
  put(b, K.M.paint, rbox(w + 0.03, 0.025, 0.03, 0.006, 1), M, { p: [0, -h / 2, 0], color: COL.dark });
  put(b, K.M.paint, rbox(0.025, h, 0.03, 0.006, 1), M, { p: [-w / 2, 0, 0], color: COL.dark });
  put(b, K.M.paint, rbox(0.025, h, 0.03, 0.006, 1), M, { p: [w / 2, 0, 0], color: COL.dark });
  return { pivot, door, holder, open: 0, target: 0 };
}

// ---------- Breaker panel (4 breakers) ----------
// Returns the lever pivots' matrices (relative to the panel) for instancing.
export function breakerPanel(K, b, M, title, list, readout) {
  const w = 0.64;
  const h = 0.46;
  put(b, K.M.paint, rbox(w + 0.04, h + 0.04, 0.09, 0.012, 2), M, { p: [0, 0, -0.045], color: 0x30353b });
  const face = K.atlas.add(
    w * 1000,
    h * 1000,
    (g, W, H) => {
    g.fillStyle = '#3a4048';
    g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,255,255,0.06)');
    gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#e8ecef';
    g.lineWidth = 3;
    g.strokeRect(14, 14, W - 28, H - 28);
    g.fillStyle = '#e8ecef';
    const [t1, t2] = title.split('|');
    g.font = `800 34px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(t1, 30, 58);
    g.font = `700 22px ${FONT}`;
    g.fillStyle = '#b9c4cb';
    g.fillText(t2 || '', 30, 88);
    list.forEach((bk, i) => {
      const x = W * (0.125 + i * 0.25);
      g.textAlign = 'center';
      g.fillStyle = '#e8ecef';
      g.font = `800 30px ${FONT}`;
      g.fillText('CB' + bk.n, x, 196);
      g.font = `700 22px ${FONT}`;
      g.fillText(bk.label, x, 382);
      g.font = `600 21px ${MONO}`;
      g.fillStyle = '#c7d0d6';
      g.fillText(bk.amps.toFixed(1) + ' A', x, 410);
      g.strokeStyle = '#c7d0d6';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 50, 214);
      g.lineTo(x + 50, 214);
      g.stroke();
      g.font = `700 17px ${FONT}`;
      g.fillText('CLOSED', x, 238);
      g.fillText('OPEN', x, 352);
    });
    // Screw heads.
    [
      [24, 24],
      [W - 24, 24],
      [24, H - 24],
      [W - 24, H - 24],
    ].forEach(([x, y]) => {
      g.fillStyle = '#9aa4ab';
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
    });
    },
    0.8
  );
  decal(K, b, face, w, h, M, { p: [0, 0, 0.001] });
  // LCD readout.
  const R = K.screens.regions[readout];
  const lcd = uvRect(new THREE.PlaneGeometry(0.29, 0.073), R);
  put(b, K.M.screenOf(b), lcd, M, { p: [0.14, 0.16, 0.0105] });
  put(b, K.M.paint, rbox(0.31, 0.092, 0.012, 0.004, 1), M, { p: [0.14, 0.16, 0.003], color: COL.black });
  const levers = [];
  list.forEach((bk, i) => {
    const x = -w / 2 + w * (0.125 + i * 0.25);
    // Base, guards.
    put(b, K.M.metal, rbox(0.05, 0.07, 0.022, 0.006, 1), M, { p: [x, 0.0, 0.011], color: COL.alu });
    [-1, 1].forEach((s) => put(b, K.M.paint, rbox(0.006, 0.09, 0.05, 0.002, 1), M, { p: [x + s * 0.034, 0.0, 0.025], color: COL.yellow }));
    levers.push({ local: mat4([x, 0.0, 0.022]), lamp: mat4([x, 0.065, 0.004]) });
  });
  return levers;
}

// ---------- Laptop on an arm (screen region from the screens atlas) ----------
export function laptop(K, b, M, region) {
  put(b, K.M.paint, rbox(0.34, 0.022, 0.24, 0.01, 2), M, { p: [0, 0, 0.12], color: COL.black });
  // Keyboard plate.
  put(b, K.M.paint, rbox(0.3, 0.004, 0.12, 0.002, 1), M, { p: [0, 0.012, 0.15], color: 0x24272b });
  const LM = tmpM2.multiplyMatrices(M, mat4([0, 0.012, 0.0], [-0.22, 0, 0])).clone();
  put(b, K.M.paint, rbox(0.34, 0.23, 0.012, 0.008, 2), LM, { p: [0, 0.115, -0.006], color: COL.black });
  put(b, K.M.screenOf(b), uvRect(new THREE.PlaneGeometry(0.31, 0.194), region), LM, { p: [0, 0.118, 0.001] });
  // Velcro + bracket to the arm.
  put(b, K.M.metal, rbox(0.12, 0.012, 0.12, 0.004, 1), M, { p: [0, -0.017, 0.12], color: COL.steel });
}

// ---------- Alarm beacon (rotating red light) ----------
export function beacon(K, b, M) {
  put(b, K.M.paint, new THREE.CylinderGeometry(0.06, 0.07, 0.04, 16), M, { p: [0, 0.02, 0], color: COL.dark });
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.08, 16, 1, false), K.M.alarm);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), K.M.alarm);
  dome.position.y = 0.08;
  cap.position.y = 0.12;
  const g = new THREE.Group();
  g.matrixAutoUpdate = false;
  g.matrix.copy(M);
  g.add(dome, cap);
  dome.userData.noAO = cap.userData.noAO = true;
  return g;
}
