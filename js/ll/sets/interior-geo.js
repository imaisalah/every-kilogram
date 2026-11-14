// Geometry helpers for the Last Light interior (js/ll/sets/interior.js).
import { THREE } from './common.js';
import { AXY, DIMS, capRadius } from './interior-volume.js';

// Box-projected UVs in local metres (k tiles per metre): each face takes the
// two axes its normal is not along, so panels keep their size on any box.
export function planarUV(geo, k = 1, ox = 0, oy = 0) {
  const p = geo.attributes.position;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    let u;
    let v;
    if (ax >= ay && ax >= az) (u = p.getZ(i) * Math.sign(n.getX(i) || 1)), (v = p.getY(i));
    else if (ay >= az) (u = p.getX(i)), (v = p.getZ(i) * -Math.sign(n.getY(i) || 1));
    else (u = p.getX(i) * -Math.sign(n.getZ(i) || 1)), (v = p.getY(i));
    uv[i * 2] = u * k + ox;
    uv[i * 2 + 1] = v * k + oy;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Map a geometry's 0..1 UVs into an atlas rect {u0, v0, u1, v1}.
export function uvRect(geo, r) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + (r.u1 - r.u0) * uv.getX(i), r.v0 + (r.v1 - r.v0) * uv.getY(i));
  return geo;
}
// Every vertex gets the same UV (a flat colour patch of an atlas).
export function uvPoint(geo, u, v) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
  return geo;
}

// A box with rounded edges (r) and corners.
export function rbox(w, h, d, r = 0.01, seg = 2) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const g = new THREE.BoxGeometry(w, h, d, seg * 2 + 1, seg * 2 + 1, seg * 2 + 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  const hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    v.sub(c);
    if (v.lengthSq() > 1e-12) v.setLength(r);
    v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Swap winding and normals (show a surface from the other side).
export function flip(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i += 3) {
    const swap = (a) => {
      if (!a) return;
      for (let k = 0; k < a.itemSize; k++) {
        const t = a.array[(i + 1) * a.itemSize + k];
        a.array[(i + 1) * a.itemSize + k] = a.array[(i + 2) * a.itemSize + k];
        a.array[(i + 2) * a.itemSize + k] = t;
      }
    };
    swap(p);
    swap(n);
    swap(uv);
  }
  if (n) for (let i = 0; i < n.array.length; i++) n.array[i] = -n.array[i];
  return g;
}

// A wall of revolution around the stack's axis (the capsule cone, the tunnel
// cylinder), seen from inside. Radius r(z); theta from +y toward +x.
export function revWall(z0, z1, rFn, o = {}) {
  const t0 = o.t0 == null ? 0 : o.t0;
  const tl = o.tl == null ? Math.PI * 2 : o.tl;
  const nt = o.nt || 48;
  const nz = o.nz || 4;
  const ku = o.ku || 1; // tiles around (per full turn when uFixed, else per metre at r)
  const kv = o.kv || 1; // tiles per metre along z
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= nz; j++) {
    const z = z0 + ((z1 - z0) * j) / nz;
    const r = rFn(z);
    const dr = (rFn(z + 0.01) - rFn(z - 0.01)) / 0.02;
    for (let i = 0; i <= nt; i++) {
      const th = t0 + (tl * i) / nt;
      const s = Math.sin(th);
      const c = Math.cos(th);
      pos.push(r * s, AXY + r * c, z);
      // Inward normal of r(z): outward (s, c, -dr) normalised, negated.
      const l = Math.hypot(1, dr);
      nor.push(-s / l, -c / l, dr / l);
      uv.push(((th - t0) / (Math.PI * 2)) * ku, z * kv);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nt; i++) {
      const a = j * (nt + 1) + i;
      const b = a + nt + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// A ring around the axis with a rectangular section: from radius rOut inward
// by depth, width w along z (frames, hatch rims, seals).
export function axisRing(z, rOut, depth, w, seg = 48, t0 = 0, tl = Math.PI * 2) {
  const s = new THREE.Shape();
  s.moveTo(rOut - depth, -w / 2);
  s.lineTo(rOut, -w / 2);
  s.lineTo(rOut, w / 2);
  s.lineTo(rOut - depth, w / 2);
  s.closePath();
  const pts = s.getPoints().map((p) => new THREE.Vector2(p.x, p.y));
  const g = new THREE.LatheGeometry(pts, seg, t0, tl);
  // Lathe: around +y. Turn so +y -> +z (x stays): (x, y, z) -> (x, -z, y).
  g.rotateX(Math.PI / 2);
  g.translate(0, AXY, z);
  return g;
}

// Tube along points (cables, hoses, rails).
export function tube(points, radius, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]))), false, 'catmullrom', o.tension == null ? 0.5 : o.tension);
  return new THREE.TubeGeometry(curve, o.seg || Math.max(6, points.length * 6), radius, o.radial || 6, false);
}

// ---------- The capsule cone wall frame ----------
const ALPHA = Math.atan((DIMS.cap.r0 - DIMS.cap.r1) / (DIMS.cap.z1 - DIMS.cap.z0));
const _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
// A spot on the cone wall at angle theta (from +y toward +x) and z, pushed
// `inset` metres inward. Local frame: +z into the cabin, +y as close to world
// up as the wall allows (or along the wall toward the nose on the ceiling).
export function coneFrame(theta, z, inset = 0) {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const R = capRadius(z);
  const out = new THREE.Vector3(s * Math.cos(ALPHA), c * Math.cos(ALPHA), Math.sin(ALPHA));
  const zAx = out.clone().negate();
  let yAx = UP.clone().addScaledVector(zAx, -UP.dot(zAx));
  if (yAx.lengthSq() < 0.05) yAx = new THREE.Vector3(-s * Math.sin(ALPHA), -c * Math.sin(ALPHA), Math.cos(ALPHA));
  yAx.normalize();
  const xAx = new THREE.Vector3().crossVectors(yAx, zAx).normalize();
  const pos = new THREE.Vector3(s * R, AXY + c * R, z).addScaledVector(zAx, inset);
  _m.makeBasis(xAx, yAx, zAx);
  const quat = new THREE.Quaternion().setFromRotationMatrix(_m);
  const matrix = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
  return { pos, quat, matrix, normal: zAx, up: yAx, right: xAx };
}
// The same for a point given by world y (on the left, +x, or right, -x, wall).
export function coneSide(side, y, z, inset = 0) {
  const R = capRadius(z);
  const dy = y - AXY;
  const theta = side * Math.acos(Math.max(-1, Math.min(1, dy / R)));
  return coneFrame(theta, z, inset);
}

// A matrix from a position, a facing normal (+z) and an up hint.
export function frameMatrix(pos, normal, upHint = UP) {
  const z = normal.clone().normalize();
  let y = upHint.clone().addScaledVector(z, -upHint.dot(z));
  if (y.lengthSq() < 1e-4) y = new THREE.Vector3(0, 0, 1).addScaledVector(z, -z.z);
  y.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos);
}

export function mat4(p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], order = 'XYZ') {
  return new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], order)), new THREE.Vector3(s[0], s[1], s[2]));
}
