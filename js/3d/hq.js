// The agency campus at golden hour: a low-poly diorama on the edge of the
// desert, with the Nile, its palms and the pyramids on the far bank. Every
// building is a door into the game (mission board, clean room, map, research,
// archive, launch pad). Built from code so it stays light on a school laptop;
// real NASA models replace the pad tower and the DSN dish when they load.
import { THREE, profile, getRenderer } from './engine.js';
import { fbm, makeParticles } from './assets.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { createAstronaut } from './astronaut.js';
import { createController } from './controller.js';
import { createStaff, staffPortrait } from './npc.js';

const SUN_DIR = new THREE.Vector3(-0.6, 0.3, 0.74).normalize();
const CENTER = new THREE.Vector3(6, 0, -4);

// ---------- The player's astronaut on the campus ----------
// Walkable ground: the plaza and the sand just in front of the archive.
const WALK = { minX: -66, maxX: 42, minZ: -52, maxZ: 58 };
const WALK_SPEED = 2.6; // m/s at a full walk: brisk, and the feet keep up
const PLAZA_Y = 0.06;
// Each building's footprint as circles in its own frame [x, z, r, height]
// (metres), and the spot in front of its door [x, z]. Measured from the
// builders below. The heights keep the walking camera out of the walls.
const FOOT = {
  board: { c: [[-8, 0, 9.9, 10.5], [8, 0, 9.9, 10.5], [-2, 7, 9.6, 10.5]], door: [-2, 17.6] },
  design: { c: [[-4.5, -5, 6.8, 29], [4.5, -5, 6.8, 29], [-4.5, 5, 6.8, 29], [4.5, 5, 6.8, 29], [-12.5, 2, 8.8, 10], [-19, 2, 8.8, 10], [-25.5, 2, 8.8, 10]], door: [0, 11.9] },
  research: { c: [[-5, 0, 8.3, 16.5], [5, 0, 8.3, 16.5], [-9.7, 2.2, 8.8, 2.4], [-19.3, 2.2, 8.8, 2.4]], door: [0, 8.7] },
  archive: {
    c: [[-4.2, 0, 3.4, 15], [-9, 0, 3.4, 15], [4.2, 0, 3.4, 15], [9, 0, 3.4, 15], [0, -0.4, 2.4, 16], [-4.5, -9, 7.5, 8], [4.5, -9, 7.5, 8], [-4, 5, 1.1, 1.7], [-4, 8.4, 1.1, 1.7], [-4, 11.8, 1.1, 1.7], [-4, 15.2, 1.1, 1.7], [4, 5, 1.1, 1.7], [4, 8.4, 1.1, 1.7], [4, 11.8, 1.1, 1.7], [4, 15.2, 1.1, 1.7]],
    door: [0, 3.1],
  },
  map: { c: [[0, 0, 13.3, 24]], door: null }, // door: toward the plaza centre
  testlab: { c: [[-4.6, -3.2, 5.6, 12], [4.6, -3.2, 5.6, 12], [-4.6, 3.2, 5.6, 12], [4.6, 3.2, 5.6, 12]], door: [0, 9.8] },
};
// Where the test hall stands (only built when the test lab screen exists).
const TEST_HALL = { x: 36, z: 17 };
// Where the astronaut stood when the campus last closed (this session), so
// coming back from a building starts at its door.
let lastSpot = null;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const PAL = {
  sand: 0xdcb784,
  sandDark: 0xc99e68,
  sandLight: 0xe8c99a,
  green: 0x7c9a43,
  green2: 0x93a94d,
  green3: 0x5f7f35,
  mud: 0x9b8a5c,
  plaza: 0xe6d8bf,
  road: 0x9a8b78,
  white: 0xf3ede2,
  cream: 0xe9dcc4,
  stone: 0xd8c29c,
  concrete: 0xb9ad9c,
  glass: 0x2a3d4f,
  teal: 0x17807a,
  gold: 0xd9a21b,
  red: 0xb4302c,
  steel: 0xb5532f,
  grey: 0x8c9399,
  window: 0xffd08a,
  palmTrunk: 0x8a6a45,
  palmLeaf: 0x5d7b32,
};

// Flat-shaded matte materials are Lambert (about half the cost of PBR on a
// school laptop GPU); only the few shiny things (gold, glass, panels) are PBR.
function mat(color, opts = {}) {
  const base = { color, flatShading: opts.flat !== false, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1, side: opts.side ?? THREE.FrontSide };
  if (opts.pbr) return new THREE.MeshStandardMaterial({ ...base, roughness: opts.rough ?? 0.82, metalness: opts.metal ?? 0 });
  return new THREE.MeshLambertMaterial(base);
}

// Real models arrive with heavy PBR/physical materials; repaint them matte.
function cheapen(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (m) => {
      if (!m || m.isMeshLambertMaterial || m.isMeshBasicMaterial) return m;
      const n = new THREE.MeshLambertMaterial({ color: m.color ? m.color.clone() : 0xdddddd, map: m.map || null, emissive: m.emissive ? m.emissive.clone() : 0x000000, emissiveMap: m.emissiveMap || null, side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest });
      return n;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
  return obj;
}

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d, material, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y + h / 2, z);

// A building's static parts merged into one mesh per material: the campus
// draws in far fewer calls (twice over, with the shadow pass). keep: parts
// that move (doors, domes) stay separate.
function mergeStatic(g, keep = []) {
  const by = new Map();
  g.children.slice().forEach((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.children.length || keep.includes(o) || Array.isArray(o.material)) return;
    o.updateMatrix();
    const geo = o.geometry.clone().applyMatrix4(o.matrix);
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(geo);
    g.remove(o);
    o.geometry.dispose();
  });
  by.forEach((geos, m) => {
    const list = geos.some((x) => !x.index) ? geos.map((x) => (x.index ? x.toNonIndexed() : x)) : geos;
    let merged = null;
    try {
      merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    } catch (e) {
      merged = null;
    }
    const add = (geo) => {
      const mm = new THREE.Mesh(geo, m);
      mm.castShadow = !m.isMeshBasicMaterial;
      mm.receiveShadow = true;
      g.add(mm);
    };
    if (merged) {
      add(merged);
      if (list.length > 1) list.forEach((x) => x.dispose());
    } else list.forEach(add);
  });
  return g;
}

// A thin box from a to b (struts, braces, masts).
const _up = new THREE.Vector3(0, 1, 0);
function strutMatrix(a, b, t) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize());
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return new THREE.Matrix4().compose(mid, q, new THREE.Vector3(t, len, t));
}

function instanced(geo, material, matrices) {
  const im = new THREE.InstancedMesh(geo, material, matrices.length);
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = true;
  im.receiveShadow = true;
  im.instanceMatrix.needsUpdate = true;
  return im;
}

// Deterministic random so the campus looks the same every visit.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The Nile bends gently behind the campus.
const riverZ = (x) => -205 + 26 * Math.sin(x * 0.0055 + 0.8) + 9 * Math.sin(x * 0.017);

// ---------- Sky ----------
function makeSky() {
  const uniforms = {
    top: { value: new THREE.Color(0x5a7bb0) },
    mid: { value: new THREE.Color(0xe0a9a2) },
    horizon: { value: new THREE.Color(0xffd1a0) },
    ground: { value: new THREE.Color(0xe9bf8e) },
    sunCol: { value: new THREE.Color(0xffb259) },
    sunDir: { value: SUN_DIR.clone() },
  };
  const m = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunCol; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        float s = max(dot(d, sunDir), 0.0);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.12, h));
        c = mix(c, top, smoothstep(0.1, 0.55, h));
        // warmer horizon toward the sun
        c = mix(c, horizon * 1.08, pow(s, 3.0) * (1.0 - smoothstep(0.0, 0.5, h)) * 0.6);
        c = mix(ground, c, smoothstep(-0.05, 0.01, h));
        c += sunCol * (pow(s, 10.0) * 0.45 + pow(s, 120.0) * 1.1);
        c += vec3(1.0, 0.93, 0.78) * smoothstep(0.99955, 0.9998, s) * 2.5;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), m);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

// ---------- Terrain: flat campus, dunes, the river valley ----------
function makeTerrain() {
  const size = 1800;
  const seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const sand = new THREE.Color(PAL.sand);
  const sandD = new THREE.Color(PAL.sandDark);
  const sandL = new THREE.Color(PAL.sandLight);
  const greens = [new THREE.Color(PAL.green), new THREE.Color(PAL.green2), new THREE.Color(PAL.green3), new THREE.Color(0xa7a556)];
  const mud = new THREE.Color(PAL.mud);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x - CENTER.x, (z - CENTER.z) * 1.15);
    const rz = riverZ(x);
    const dr = Math.abs(z - rz);
    const n = fbm(x * 0.006, 0.3, z * 0.006, 4, 3);
    let y = 0;
    // Dunes rise away from the campus and away from the valley.
    const duneMask = smooth(150, 420, d) * smooth(95, 220, dr);
    // Beyond the river the desert stays low so the sky and pyramids show.
    const farSide = z < rz ? 0.22 : 1;
    y += duneMask * farSide * (Math.max(0, n) * 46 + Math.sin(x * 0.018 + z * 0.01) * 4 + 6);
    // The valley floor and the river bed.
    if (dr < 26) y = -2.6 * (1 - dr / 26) - 0.4;
    // Fields along both banks.
    const fieldMask = 1 - smooth(55, 95, dr);
    if (dr >= 26 && fieldMask > 0) y = y * (1 - fieldMask) + 0.25 * fieldMask;
    pos.setY(i, y);
    // Colour: sand with soft variation, fields in a patchwork of greens.
    c.copy(sand).lerp(n > 0.05 ? sandL : sandD, Math.min(1, Math.abs(n) * 1.6));
    if (dr < 30) c.lerp(mud, 0.85);
    else if (fieldMask > 0.01) {
      const patch = (Math.floor((x + 900) / 26) * 7 + Math.floor((z - rz + 400) / 18) * 3) % 4;
      c.lerp(greens[patch], fieldMask);
    }
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  terrain.receiveShadow = true;
  return terrain;
}

function makeRiver() {
  const pts = [];
  const idx = [];
  const n = 90;
  for (let i = 0; i <= n; i++) {
    const x = -900 + (1800 * i) / n;
    const z = riverZ(x);
    pts.push(x, -0.55, z - 21, x, -0.55, z + 21);
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x4f8db0, roughness: 0.18, metalness: 0.25, emissive: 0x23455e, emissiveIntensity: 0.35 }));
  water.receiveShadow = true;
  return water;
}

function makePyramids() {
  const g = new THREE.Group();
  const m = mat(0xd6aa72);
  [
    [-470, -780, 62, 74],
    [-385, -815, 50, 60],
    [-325, -795, 21, 25],
  ].forEach(([x, z, r, h]) => {
    const p = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4, 1), m);
    p.position.set(x, h / 2 - 1, z);
    p.rotation.y = Math.PI / 4 + 0.12;
    g.add(p);
  });
  return g;
}

// Low-poly date palms, instanced. Returns { group, sway(t) }.
function makePalms(spots) {
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 1, 5, 1);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.ConeGeometry(1, 0.42, 7, 1, true);
  crownGeo.rotateX(Math.PI);
  crownGeo.translate(0, -0.12, 0);
  const trunkM = mat(PAL.palmTrunk);
  const leafM = mat(PAL.palmLeaf, { side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkM, spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, leafM, spots.length);
  trunks.castShadow = crowns.castShadow = true;
  const tops = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  spots.forEach((s, i) => {
    e.set(s.lean, s.rot, s.lean * 0.6);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(1, s.h, 1));
    trunks.setMatrixAt(i, m4);
    const top = new THREE.Vector3(0, s.h, 0).applyQuaternion(q).add(new THREE.Vector3(s.x, s.y, s.z));
    tops.push({ top, rot: s.rot, r: s.crown, phase: s.phase });
  });
  const g = new THREE.Group();
  g.add(trunks, crowns);
  const sway = (t) => {
    tops.forEach((p, i) => {
      e.set(Math.sin(t * 0.9 + p.phase) * 0.06, p.rot + Math.sin(t * 0.5 + p.phase) * 0.05, Math.cos(t * 0.7 + p.phase) * 0.06);
      q.setFromEuler(e);
      m4.compose(p.top, q, new THREE.Vector3(p.r, p.r, p.r));
      crowns.setMatrixAt(i, m4);
    });
    crowns.instanceMatrix.needsUpdate = true;
  };
  sway(0);
  return { group: g, sway };
}

// ---------- Buildings ----------
function windowStrip(w, h, material, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), material);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

function makeMissionControl(M) {
  const g = new THREE.Group();
  // Long low block with a rounded glass front facing the campus square.
  g.add(box(30, 7, 14, M.cream, 0, 0, 0));
  g.add(box(30.6, 0.8, 14.6, M.teal, 0, 7, 0));
  const front = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 9.5, 18, 1, false, -Math.PI / 2, Math.PI), M.glass);
  front.position.set(-2, 4.75, 7);
  front.castShadow = true;
  g.add(front);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 0.7, 18, 1, false, -Math.PI / 2, Math.PI), M.cream);
  roof.position.set(-2, 9.85, 7);
  roof.castShadow = true;
  g.add(roof);
  // Warm lit floors behind the glass.
  for (let k = 0; k < 2; k++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, 1.3, 18, 1, true, -Math.PI / 2, Math.PI), M.window);
    band.position.set(-2, 2.6 + k * 3.6, 7);
    g.add(band);
  }
  for (let k = 0; k < 5; k++) g.add(windowStrip(1.6, 2.2, M.window, 7 + k * 1.9, 3.8, 7.05));
  // Rooftop antennas: a small dish and a mast with a blinking light.
  const mast = box(0.35, 9, 0.35, M.grey, 11, 7.8, -3);
  g.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), M.white);
  dish.position.set(6, 9.2, -3);
  dish.rotation.x = -0.9;
  dish.castShadow = true;
  g.add(dish);
  g.add(box(0.6, 1.2, 0.6, M.grey, 6, 7.8, -3));
  g.userData.lights = [new THREE.Vector3(11, 17.2, -3)];
  g.userData.anchor = new THREE.Vector3(-2, 11.5, 6);
  return g;
}

function makeCleanRoom(M) {
  const g = new THREE.Group();
  // High bay with a tall door, low annex beside it.
  g.add(box(18, 27, 20, M.white, 0, 0, 0));
  g.add(box(18.6, 1, 20.6, M.cream, 0, 27, 0));
  g.add(box(22, 9, 16, M.cream, -19, 0, 2));
  g.add(box(22.4, 0.7, 16.4, M.teal, -19, 9, 2));
  // Door frame and the sliding door panels (they part when a spacecraft is being built).
  g.add(box(11, 23, 0.6, M.stone, 0, 0, 10.1));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 21.6), M.inside);
  glow.position.set(0, 10.8, 10.35);
  g.add(glow);
  const doorL = box(4.9, 21.8, 0.5, M.white, -2.45, 0, 10.6);
  const doorR = box(4.9, 21.8, 0.5, M.white, 2.45, 0, 10.6);
  g.add(doorL, doorR);
  // A gold stripe down the high bay, the agency's colour.
  g.add(box(1.2, 27, 0.3, M.gold, -8, 0, 10.1));
  for (let k = 0; k < 6; k++) g.add(windowStrip(2.2, 1.6, M.window, -27 + k * 3.2, 5, 10.05));
  // Roof units.
  g.add(box(3, 1.6, 3, M.grey, 4, 28, -4), box(3, 1.6, 3, M.grey, -4, 28, -4));
  g.userData.doors = { doorL, doorR, glow };
  g.userData.lights = [new THREE.Vector3(8.5, 28.6, 9.5)];
  g.userData.anchor = new THREE.Vector3(0, 29, 6);
  return g;
}

function makeResearchLab(M) {
  const g = new THREE.Group();
  g.add(box(20, 8, 13, M.stone, 0, 0, 0));
  g.add(box(20.4, 0.6, 13.4, M.cream, 0, 8, 0));
  for (let k = 0; k < 6; k++) g.add(windowStrip(2, 2, M.window, -7.5 + k * 3, 4.2, 6.55));
  // Observatory drum and dome with a slit.
  const drum = mesh(new THREE.CylinderGeometry(4.6, 4.6, 3, 16), M.white, 4, 10, -1);
  const dome = mesh(new THREE.SphereGeometry(4.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.white, 4, 11.5, -1);
  const slit = mesh(new THREE.BoxGeometry(1.4, 4.2, 9.4), M.glass, 4, 13.2, -1);
  slit.rotation.x = 0.0;
  g.add(drum, dome, slit);
  g.userData.dome = { dome, slit };
  g.userData.anchor = new THREE.Vector3(4, 16.5, 0);
  // A small solar field beside the lab.
  const panelGeo = new THREE.BoxGeometry(4.2, 0.18, 2.4);
  const ms = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) {
      const m4 = new THREE.Matrix4().compose(new THREE.Vector3(-22 + c * 5, 1.4, -4 + r * 4.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, 0, 0)), new THREE.Vector3(1, 1, 1));
      ms.push(m4);
    }
  g.add(instanced(panelGeo, M.panel, ms));
  const legGeo = new THREE.BoxGeometry(0.2, 1.4, 0.2);
  g.add(instanced(legGeo, M.grey, ms.map((m4) => m4.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.7, 0)))));
  return g;
}

// The Discovery Archive is a modern take on a temple gateway (a pylon).
function makeArchive(M) {
  const g = new THREE.Group();
  const pylonGeo = new THREE.CylinderGeometry(4.2 / Math.SQRT2, 6 / Math.SQRT2, 15, 4, 1);
  pylonGeo.rotateY(Math.PI / 4);
  pylonGeo.scale(1.6, 1, 0.75);
  const left = mesh(pylonGeo, M.stone, -6.6, 7.5, 0);
  const right = mesh(pylonGeo, M.stone, 6.6, 7.5, 0);
  g.add(left, right);
  g.add(box(4.6, 11, 4, M.cream, 0, 0, -0.4));
  g.add(box(5.6, 1.2, 4.6, M.gold, 0, 11, -0.4));
  // A gold disc above the gate, the patch the agency stitches for each mission.
  const disc = mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.4, 20), M.gold, 0, 14.4, 0.2);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6.5), M.inside);
  door.position.set(0, 3.25, 1.62);
  g.add(door);
  // Hall behind the gate.
  g.add(box(18, 7, 12, M.cream, 0, 0, -9));
  g.add(box(18.4, 0.6, 12.4, M.teal, 0, 7, -9));
  // Two rows of stone blocks leading in.
  for (let k = 0; k < 4; k++) {
    g.add(box(1.3, 1.6, 1.3, M.stone, -4, 0, 5 + k * 3.4), box(1.3, 1.6, 1.3, M.stone, 4, 0, 5 + k * 3.4));
  }
  g.userData.disc = disc;
  g.userData.anchor = new THREE.Vector3(0, 16.5, 0);
  return g;
}

// The test hall: a vaulted hangar with a thermal-vacuum chamber behind its big
// door and a shaker table outside. Spacecraft in Phase C/D are tested here.
function makeTestHall(M) {
  const g = new THREE.Group();
  g.add(box(18, 7, 14, M.cream, 0, 0, 0));
  // Half a cylinder lying along x: the upper half after the turn.
  const vault = mesh(new THREE.CylinderGeometry(7, 7, 18, 16, 1, false, 0, Math.PI), M.white, 0, 7, 0);
  vault.rotation.z = Math.PI / 2;
  g.add(vault);
  // End walls of the vault (half discs).
  [-9.01, 9.01].forEach((x) => {
    const cap = mesh(new THREE.CircleGeometry(7, 16, 0, Math.PI), M.cream, x, 7, 0);
    cap.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(cap);
  });
  // Big door frame, glowing inside, with the round hatch of the vacuum chamber.
  g.add(box(10.5, 10, 0.6, M.stone, 0, 0, 7));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 8.8), M.inside);
  glow.position.set(0, 4.4, 7.32);
  g.add(glow);
  const hatch = new THREE.Mesh(new THREE.TorusGeometry(3, 0.45, 6, 24), M.grey);
  hatch.position.set(0, 4.6, 7.2);
  g.add(hatch);
  // A teal stripe and a gold bar over the door: the agency colours.
  g.add(box(18.2, 0.8, 14.2, M.teal, 0, 6.6, 0));
  g.add(box(6, 0.9, 0.4, M.gold, 0, 10.4, 7.1));
  // The shaker table outside: a block with a test article on top.
  g.add(box(3.2, 1, 3.2, M.dark, 7.4, 0, 9.4));
  g.add(box(1.4, 1.8, 1.4, M.gold, 7.4, 1, 9.4));
  g.add(box(2.6, 0.12, 0.8, M.panel, 7.4, 2.2, 9.4));
  g.userData.lights = [new THREE.Vector3(0, 14.4, 0)];
  g.userData.anchor = new THREE.Vector3(0, 16, 0);
  return g;
}

function makeCodeDish(M) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(3.4, 4.4, 9, 10), M.cream, 0, 4.5, 0));
  g.add(mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.8, 12), M.grey, 0, 9.4, 0));
  const az = new THREE.Group();
  az.position.y = 9.8;
  g.add(az);
  // Yoke arms.
  az.add(box(1, 7, 3, M.white, -4.2, 0, 0), box(1, 7, 3, M.white, 4.2, 0, 0), box(9.4, 1, 3.4, M.white, 0, 0, 0));
  const el = new THREE.Group();
  el.position.y = 6;
  az.add(el);
  // Parabolic dish from a lathe profile, open side up before tilting.
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const r = (i / 10) * 11;
    prof.push(new THREE.Vector2(r, (r * r) / 44));
  }
  const dishGeo = new THREE.LatheGeometry(prof, 28);
  const dish = new THREE.Mesh(dishGeo, M.dish);
  dish.castShadow = true;
  dish.receiveShadow = true;
  el.add(dish);
  el.add(mesh(new THREE.CylinderGeometry(2.2, 1.6, 2.4, 10), M.cream, 0, -1, 0));
  // Subreflector on a tripod.
  const sub = mesh(new THREE.CylinderGeometry(1.1, 0.4, 0.8, 10), M.white, 0, 8.6, 0);
  el.add(sub);
  const legs = [0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2;
    return strutMatrix(new THREE.Vector3(Math.cos(a) * 7.5, 1.3, Math.sin(a) * 7.5), new THREE.Vector3(0, 8.4, 0), 0.25);
  });
  el.add(instanced(new THREE.BoxGeometry(1, 1, 1), M.grey, legs));
  g.userData.az = az;
  g.userData.el = el;
  return g;
}

// Launch tower: an instanced lattice with service arms.
function makeCodeTower(M) {
  const g = new THREE.Group();
  const H = 46;
  const w = 3.2;
  const ms = [];
  const corners = [
    [-w, -w],
    [w, -w],
    [w, w],
    [-w, w],
  ];
  corners.forEach(([x, z]) => ms.push(strutMatrix(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, H, z), 0.55)));
  for (let y = 0; y < H; y += 4) {
    for (let k = 0; k < 4; k++) {
      const [x1, z1] = corners[k];
      const [x2, z2] = corners[(k + 1) % 4];
      ms.push(strutMatrix(new THREE.Vector3(x1, y + 4, z1), new THREE.Vector3(x2, y + 4, z2), 0.32));
      ms.push(strutMatrix(new THREE.Vector3(x1, y, z1), new THREE.Vector3(x2, y + 4, z2), 0.22));
    }
  }
  g.add(instanced(new THREE.BoxGeometry(1, 1, 1), M.steel, ms));
  // Service arms toward the rocket (+x side).
  [14, 26, 36].forEach((y) => g.add(box(7, 1, 1.6, M.steel, w + 3.5, y, 0)));
  g.add(box(9, 1.2, 9, M.steel, 0, H, 0));
  // Lightning mast on top.
  g.add(box(0.3, 8, 0.3, M.grey, 0, H + 1.2, 0));
  g.userData.lights = [new THREE.Vector3(0, H + 9.4, 0)];
  return g;
}

function makePad(M) {
  const g = new THREE.Group();
  // Hardstand, flame trench and a ramp.
  g.add(box(46, 1.6, 40, M.concrete, 0, 0, 0));
  g.add(box(6, 1.7, 22, M.dark, 9, 0, 0));
  g.add(box(9, 3.4, 9, M.concrete, 9, 0, 0));
  // Water tower (sound suppression) on four legs.
  const wt = new THREE.Group();
  wt.position.set(-30, 0, 14);
  const legs = [];
  [
    [-2, -2],
    [2, -2],
    [2, 2],
    [-2, 2],
  ].forEach(([x, z]) => legs.push(strutMatrix(new THREE.Vector3(x * 1.4, 0, z * 1.4), new THREE.Vector3(x, 16, z), 0.5)));
  wt.add(instanced(new THREE.BoxGeometry(1, 1, 1), M.grey, legs));
  wt.add(mesh(new THREE.SphereGeometry(4.6, 14, 10), M.white, 0, 19.5, 0));
  g.add(wt);
  // Three lightning masts around the pad.
  [
    [-18, -17],
    [22, -16],
    [20, 18],
  ].forEach(([x, z]) => g.add(box(0.6, 34, 0.6, M.grey, x, 0, z)));
  g.userData.lights = [new THREE.Vector3(-18, 34.4, -17), new THREE.Vector3(22, 34.4, -16), new THREE.Vector3(20, 34.4, 18)];
  g.userData.anchor = new THREE.Vector3(2, 40, 0);
  return g;
}

// Generic launcher sized by class: light, medium or heavy.
function makeRocket(M, cls) {
  const g = new THREE.Group();
  const spec = { light: { h: 26, r: 1.5, boosters: 0 }, medium: { h: 36, r: 1.9, boosters: 2 }, heavy: { h: 42, r: 2.1, boosters: 2 } }[cls] || { h: 34, r: 1.9, boosters: 0 };
  const coreH = spec.h * 0.68;
  g.add(mesh(new THREE.CylinderGeometry(spec.r, spec.r, coreH, 16), M.white, 0, coreH / 2, 0));
  g.add(mesh(new THREE.CylinderGeometry(spec.r * 1.01, spec.r * 1.01, 1.2, 16), M.dark, 0, coreH - 0.6, 0));
  g.add(mesh(new THREE.CylinderGeometry(spec.r * 1.01, spec.r * 1.01, 0.8, 16), M.gold, 0, coreH * 0.35, 0));
  // Fairing: cylinder plus an ogive nose.
  const fr = spec.r * 1.12;
  const fH = spec.h * 0.16;
  g.add(mesh(new THREE.CylinderGeometry(fr, spec.r, 1.2, 16), M.white, 0, coreH + 0.6, 0));
  g.add(mesh(new THREE.CylinderGeometry(fr, fr, fH, 16), M.white, 0, coreH + 1.2 + fH / 2, 0));
  const prof = [];
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    prof.push(new THREE.Vector2(fr * Math.sqrt(1 - k * k), k * spec.h * 0.15));
  }
  prof.reverse();
  const nose = mesh(new THREE.LatheGeometry(prof, 16), M.white, 0, coreH + 1.2 + fH, 0);
  g.add(nose);
  for (let b = 0; b < spec.boosters; b++) {
    const side = b === 0 ? -1 : 1;
    const bh = spec.h * (cls === 'heavy' ? 0.68 : 0.42);
    const br = cls === 'heavy' ? spec.r : spec.r * 0.55;
    const bx = side * (spec.r + br + 0.15);
    g.add(mesh(new THREE.CylinderGeometry(br, br, bh, 12), M.white, bx, bh / 2 + 0.3, 0));
    g.add(mesh(new THREE.ConeGeometry(br, br * 2.4, 12), cls === 'heavy' ? M.white : M.dark, bx, bh + 0.3 + br * 1.2, 0));
  }
  g.userData.height = spec.h;
  return g;
}

// A flock of ibises: body, left wings and right wings are three instanced
// meshes for the whole flock (3 draw calls). Returns { group, set(i, pos, yaw, flap) }.
function makeFlock(material, n) {
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.4, 0, 0, 0.5, 2.2, 0.0, 0.1], 3));
  wingGeo.computeVertexNormals();
  const bodyGeo = new THREE.ConeGeometry(0.22, 1.6, 4).rotateX(Math.PI / 2);
  const parts = [bodyGeo, wingGeo, wingGeo].map((geo) => {
    const im = new THREE.InstancedMesh(geo, material, n);
    im.frustumCulled = false;
    return im;
  });
  const group = new THREE.Group();
  group.add(...parts);
  const base = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const sc = new THREE.Vector3(0.9, 0.9, 0.9);
  const flip = new THREE.Matrix4().makeScale(-1, 1, 1);
  const rot = new THREE.Matrix4();
  return {
    group,
    set(i, pos, yaw, flap) {
      base.compose(pos, q.setFromAxisAngle(up, yaw), sc);
      parts[0].setMatrixAt(i, base);
      parts[1].setMatrixAt(i, m.copy(base).multiply(rot.makeRotationZ(flap)));
      parts[2].setMatrixAt(i, m.copy(base).multiply(rot.makeRotationZ(-flap)).multiply(flip));
    },
    done() {
      parts.forEach((p) => (p.instanceMatrix.needsUpdate = true));
    },
  };
}

// Plaza furniture, all instanced: lamps that flank every door (so doors read
// from far away), a rocket monument, benches, planters and flags.
// spots: { lamps: [[x, z]], benches: [[x, z, ry]], planters: [[x, z]], flags: [[x, z, colour]], monument: [x, z] }
function makeProps(M, spots, low) {
  const g = new THREE.Group();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const at = (x, y, z, ry = 0, s = one) => m4.clone().compose(new THREE.Vector3(x, y, z), q.clone().setFromAxisAngle(up, ry), s);
  const inst = (geo, mat, list, shadow) => {
    if (!list.length) return null;
    const im = instanced(geo, mat, list);
    im.castShadow = !!shadow;
    g.add(im);
    return im;
  };
  // Lamps: a slim post and a warm lantern.
  const post = new THREE.CylinderGeometry(0.08, 0.11, 4.2, 6).translate(0, 2.1, 0);
  const head = new THREE.BoxGeometry(0.46, 0.3, 0.46).translate(0, 4.3, 0);
  inst(post, M.dark, spots.lamps.map(([x, z]) => at(x, 0, z)), !low);
  inst(head, M.lamp, spots.lamps.map(([x, z]) => at(x, 0, z)), false);
  // Benches: seat, backrest and two legs in one geometry.
  const bench = mergeGeometries([new THREE.BoxGeometry(1.8, 0.1, 0.5).translate(0, 0.45, 0), new THREE.BoxGeometry(1.8, 0.45, 0.07).translate(0, 0.72, -0.24), new THREE.BoxGeometry(0.08, 0.42, 0.44).translate(-0.8, 0.21, 0), new THREE.BoxGeometry(0.08, 0.42, 0.44).translate(0.8, 0.21, 0)]);
  inst(bench, M.wood, spots.benches.map(([x, z, ry]) => at(x, 0, z, ry)), false);
  // Planters: a stone pot and a round shrub.
  inst(new THREE.CylinderGeometry(0.62, 0.52, 0.7, 8).translate(0, 0.35, 0), M.stone, spots.planters.map(([x, z]) => at(x, 0, z)), false);
  inst(new THREE.IcosahedronGeometry(0.72, 1).translate(0, 1.15, 0), M.shrub, spots.planters.map(([x, z]) => at(x, 0, z)), false);
  // Flags in the agency colours.
  inst(new THREE.CylinderGeometry(0.06, 0.08, 7, 6).translate(0, 3.5, 0), M.grey, spots.flags.map(([x, z]) => at(x, 0, z)), !low);
  const flagGeo = new THREE.PlaneGeometry(1.7, 1.05, 4, 1).translate(0.85, 6.35, 0);
  const flags = inst(flagGeo, M.flag, spots.flags.map(([x, z]) => at(x, 0, z)), false);
  if (flags) spots.flags.forEach(([, , c], i) => flags.setColorAt(i, new THREE.Color(c)));
  // The monument: a scale rocket on a stepped plinth.
  const mon = new THREE.Group();
  const [mx, mz] = spots.monument;
  mon.position.set(mx, 0, mz);
  mon.add(box(4.2, 0.35, 4.2, M.stone, 0, 0, 0), box(3.2, 1.1, 3.2, M.cream, 0, 0.35, 0), box(3.3, 0.14, 3.3, M.gold, 0, 1.45, 0));
  mon.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.6, 12), M.white, 0, 3.4, 0));
  mon.add(mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.3, 12), M.gold, 0, 2.6, 0));
  mon.add(mesh(new THREE.ConeGeometry(0.42, 1.3, 12), M.white, 0, 5.85, 0));
  for (let k = 0; k < 3; k++) {
    const fin = box(0.06, 0.9, 0.7, M.teal, 0, 1.6, 0);
    fin.position.set(Math.sin((k / 3) * Math.PI * 2) * 0.55, 1.6, Math.cos((k / 3) * Math.PI * 2) * 0.55);
    fin.rotation.y = (k / 3) * Math.PI * 2;
    mon.add(fin);
  }
  mergeStatic(mon);
  g.add(mon);
  return { group: g, flags };
}

// Normalise a loaded model to a given height and stand it on the ground.
function fitModel(obj, height) {
  const b = new THREE.Box3().setFromObject(obj);
  const size = b.getSize(new THREE.Vector3());
  const s = height / Math.max(0.001, size.y);
  obj.scale.multiplyScalar(s);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= b2.min.y;
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return obj;
}

// opts: { el (pointer target), labelLayer (element for the HTML pins), labels {id:{title, sub}}, onPick(id), onHover(id),
//         canWalk(), onFollow(walking), testHall (build the test hall), spawn (building id: start at its door),
//         view ('walk' default | 'map'), staff (SMD.content.staff), staffLabels {id:{name, role, talk}},
//         onTalk(id), onTalkEnd(id), onBack() (Q / gamepad B while walking) }
export function createHQ(opts = {}) {
  const SMD = globalThis.SMD;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf3cfa4, 260, 1150);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 3000);

  // Golden hour: a low warm sun, cool sky fill, long shadows.
  const hemi = new THREE.HemisphereLight(0x9db6dc, 0xc98f5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb871, 3.3);
  sun.position.copy(CENTER).addScaledVector(SUN_DIR, 260);
  sun.target.position.copy(CENTER);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -150;
  sc.right = 150;
  sc.top = 120;
  sc.bottom = -120;
  sc.near = 20;
  sc.far = 600;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const bounce = new THREE.DirectionalLight(0xffe2bf, 0.35);
  bounce.position.set(120, 60, 160);
  scene.add(bounce);

  // Shared materials for the campus.
  const M = {
    white: mat(PAL.white),
    cream: mat(PAL.cream),
    stone: mat(PAL.stone),
    concrete: mat(PAL.concrete),
    teal: mat(PAL.teal),
    gold: mat(PAL.gold, { pbr: true, rough: 0.45, metal: 0.35 }),
    grey: mat(PAL.grey),
    steel: mat(PAL.steel),
    dark: mat(0x3a3836),
    glass: mat(0x6f93ad, { pbr: true, rough: 0.12, metal: 0.55, emissive: 0x3c5466, ei: 0.5 }),
    window: new THREE.MeshLambertMaterial({ color: 0x6a4a22, emissive: PAL.window, emissiveIntensity: 0.9 }),
    inside: new THREE.MeshBasicMaterial({ color: 0xffe2a8 }),
    panel: mat(0x22406b, { pbr: true, rough: 0.25, metal: 0.5, emissive: 0x0b1a2e, ei: 0.4 }),
    dish: mat(0xf1ece2, { side: THREE.DoubleSide }),
    road: mat(PAL.road),
    plaza: mat(PAL.plaza),
    bird: new THREE.MeshBasicMaterial({ color: 0x3a2f2a, side: THREE.DoubleSide, fog: true }),
    lamp: new THREE.MeshLambertMaterial({ color: 0x8a6a3a, emissive: 0xffd9a0, emissiveIntensity: 0.8 }),
    wood: mat(0x8a6440),
    shrub: mat(0x6f8f3a),
    flag: new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
  };

  scene.add(makeSky());
  scene.add(makeTerrain());
  scene.add(makeRiver());
  scene.add(makePyramids());

  // Campus square and roads.
  const plazaShape = new THREE.Shape();
  const rr = (x, y, w, h, r) => {
    plazaShape.moveTo(x + r, y);
    plazaShape.lineTo(x + w - r, y);
    plazaShape.quadraticCurveTo(x + w, y, x + w, y + r);
    plazaShape.lineTo(x + w, y + h - r);
    plazaShape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    plazaShape.lineTo(x + r, y + h);
    plazaShape.quadraticCurveTo(x, y + h, x, y + h - r);
    plazaShape.lineTo(x, y + r);
    plazaShape.quadraticCurveTo(x, y, x + r, y);
  };
  rr(-70, -48, 116, 104, 10);
  const plaza = new THREE.Mesh(new THREE.ShapeGeometry(plazaShape, 4), M.plaza);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.06;
  plaza.receiveShadow = true;
  scene.add(plaza);
  const road = (x1, z1, x2, z2, w = 6) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, len), M.road);
    r.rotation.x = -Math.PI / 2;
    r.rotation.z = Math.atan2(x2 - x1, z2 - z1);
    r.position.set((x1 + x2) / 2, 0.1, (z1 + z2) / 2);
    r.receiveShadow = true;
    scene.add(r);
  };
  const PAD = new THREE.Vector3(86, 0, -58);
  // The crawlerway to the pad and a ring road.
  const padRoute = [new THREE.Vector3(30, 0, 30), new THREE.Vector3(56, 0, 30), new THREE.Vector3(70, 0, 0), new THREE.Vector3(PAD.x - 26, 0, PAD.z + 2)];
  for (let i = 0; i < padRoute.length - 1; i++) road(padRoute[i].x, padRoute[i].z, padRoute[i + 1].x, padRoute[i + 1].z, 5);
  road(-70, 64, 56, 64, 4.5);
  road(56, 64, 56, 30, 4.5);

  // Buildings, each one a door into the game.
  const picks = [];
  const place = (id, group, x, z, ry = 0) => {
    group.position.set(x, 0, z);
    group.rotation.y = ry;
    group.userData.pick = id;
    scene.add(group);
    picks.push({ id, group });
    return group;
  };
  const control = place('board', makeMissionControl(M), -24, 10, 0.12);
  const clean = place('design', makeCleanRoom(M), 26, -18, -0.18);
  const lab = place('research', makeResearchLab(M), -40, -30, 0.32);
  const archive = place('archive', makeArchive(M), 12, 38, -0.1);
  const dsn = new THREE.Group();
  const dishCode = makeCodeDish(M);
  dsn.add(dishCode);
  // A low mound under the dish.
  const mound = mesh(new THREE.CylinderGeometry(9, 13, 1.4, 10), M.stone, 0, 0.7, 0);
  dsn.add(mound);
  dsn.userData.anchor = new THREE.Vector3(0, 24, 0);
  place('map', dsn, -50, 30, 0);
  // The test hall faces the plaza centre.
  const testHall = opts.testHall ? place('testlab', makeTestHall(M), TEST_HALL.x, TEST_HALL.z, Math.atan2(CENTER.x - TEST_HALL.x, CENTER.z - TEST_HALL.z)) : null;
  const pad = place('pad', makePad(M), PAD.x, PAD.z, 0);
  mergeStatic(control);
  mergeStatic(clean, [clean.userData.doors.doorL, clean.userData.doors.doorR, clean.userData.doors.glow]);
  mergeStatic(lab, [lab.userData.dome.dome, lab.userData.dome.slit]);
  mergeStatic(archive, [archive.userData.disc]);
  mergeStatic(pad);
  if (testHall) mergeStatic(testHall);
  const towerSlot = new THREE.Group();
  towerSlot.position.set(-6, 1.6, 0);
  pad.add(towerSlot);
  const codeTower = makeCodeTower(M);
  towerSlot.add(codeTower);
  const rocketSlot = new THREE.Group();
  rocketSlot.position.set(9, 3.4, 0);
  pad.add(rocketSlot);

  // Real NASA models, when the asset module can supply them.
  let disposed = false;
  const tryModel = (id, slot, fallback, height) => {
    if (!SMD.assets || !SMD.assets.model) return;
    let p;
    try {
      p = SMD.assets.model(id);
    } catch (e) {
      return;
    }
    if (!p || !p.then) return;
    p.then((obj) => {
      if (disposed || !obj) return;
      fitModel(cheapen(obj), height);
      fallback.visible = false;
      slot.add(obj);
      // Heavy real models: pick by their box, not by every triangle.
      let g = slot;
      while (g && !g.userData.pick) g = g.parent;
      if (g) g.userData.coarse = true;
      refreshProxy();
    }).catch(() => {});
  };
  tryModel('model-mobile-launcher', towerSlot, codeTower, 52);
  const dsnSlot = new THREE.Group();
  dsnSlot.position.y = 1.4;
  dsn.add(dsnSlot);
  tryModel('model-dsn34', dsnSlot, dishCode, 26);

  // Palms: along both banks of the Nile and an oasis by the archive.
  const r = rng(11);
  const spots = [];
  for (let i = 0; i < 90; i++) {
    const x = -520 + r() * 1040;
    const side = r() < 0.5 ? -1 : 1;
    const z = riverZ(x) + side * (28 + r() * 40);
    spots.push({ x, y: 0.2, z, h: 7 + r() * 6, crown: 3 + r() * 1.4, lean: (r() - 0.5) * 0.25, rot: r() * 6.28, phase: r() * 6.28 });
  }
  [
    [-6, 54],
    [-10, 49],
    [33, 52],
    [38, 44],
    [-46, 54],
    [-84, 10],
    [-88, -4],
    [50, 10],
    [-90, 44],
  ].forEach(([x, z]) => spots.push({ x, y: 0, z, h: 7 + r() * 4, crown: 3 + r() * 1, lean: (r() - 0.5) * 0.2, rot: r() * 6.28, phase: r() * 6.28 }));
  // A row of palms along the front road.
  for (let x = -62; x <= 50; x += 14) spots.push({ x: x + r() * 4, y: 0, z: 70 + r() * 3, h: 6.5 + r() * 3, crown: 2.8 + r() * 0.8, lean: (r() - 0.5) * 0.18, rot: r() * 6.28, phase: r() * 6.28 });
  const palms = makePalms(spots);
  scene.add(palms.group);

  // Rocks scattered on the desert floor.
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rocks = [];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const d = 150 + r() * 140;
    const x = CENTER.x + Math.cos(a) * d;
    const z = CENTER.z + Math.sin(a) * d * 0.8;
    if (Math.abs(z - riverZ(x)) < 90) continue;
    const s = 0.8 + r() * 2.6;
    rocks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, s * 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())), new THREE.Vector3(s, s * 0.6, s)));
  }
  scene.add(instanced(rockGeo, mat(0xb8885a), rocks));
  // Desert scrub in the foreground and around the campus edge.
  const scrub = [];
  for (let i = 0; i < 80; i++) {
    const x = -140 + r() * 320;
    const z = 40 + r() * 140;
    if (x > -74 && x < 50 && z < 70) continue;
    const s2 = 0.6 + r() * 1.1;
    scrub.push(new THREE.Matrix4().compose(new THREE.Vector3(x, s2 * 0.25, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s2 * 1.3, s2 * 0.7, s2 * 1.3)));
  }
  const scrubMesh = instanced(new THREE.IcosahedronGeometry(1, 0), mat(0x8a8a48), scrub);
  scrubMesh.castShadow = false;
  scene.add(scrubMesh);

  // Two trucks shuttle along the crawlerway.
  const truckGeo = new THREE.BoxGeometry(2.4, 2, 5);
  const trucks = [0, 0.5].map((off, i) => {
    const t = new THREE.Group();
    t.add(mesh(truckGeo, i ? M.white : M.teal, 0, 1.5, 0));
    t.add(mesh(new THREE.BoxGeometry(2.4, 1.6, 1.6), M.cream, 0, 1.3, 3));
    scene.add(t);
    return { g: t, off };
  });
  const routeLen = [];
  let total = 0;
  for (let i = 0; i < padRoute.length - 1; i++) {
    const l = padRoute[i].distanceTo(padRoute[i + 1]);
    routeLen.push(l);
    total += l;
  }
  const routeAt = (u, out) => {
    // u in 0..1 there and back again
    let d = (u < 0.5 ? u * 2 : (1 - u) * 2) * total;
    for (let i = 0; i < routeLen.length; i++) {
      if (d <= routeLen[i] || i === routeLen.length - 1) {
        const k = Math.min(1, d / routeLen[i]);
        out.lerpVectors(padRoute[i], padRoute[i + 1], k);
        return u < 0.5 ? padRoute[i + 1].clone().sub(padRoute[i]) : padRoute[i].clone().sub(padRoute[i + 1]);
      }
      d -= routeLen[i];
    }
    return new THREE.Vector3(1, 0, 0);
  };

  // A small flock of ibises circling over the valley.
  const birds = [];
  const flock = makeFlock(M.bird, 7);
  scene.add(flock.group);
  for (let i = 0; i < 7; i++) birds.push({ a: (i / 7) * 0.9, rad: 70 + (i % 3) * 6, y: 46 + (i % 2) * 4, ph: i * 0.9, pos: new THREE.Vector3() });

  // Blinking aviation lights.
  const lightTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  const blinkers = [];
  const addLights = (group, color, phase) => {
    (group.userData.lights || []).forEach((p, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: lightTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      s.position.copy(p);
      s.scale.setScalar(3.2);
      group.add(s);
      blinkers.push({ s, phase: phase + i * 0.37 });
    });
  };
  addLights(control, 0xff4a3a, 0);
  addLights(clean, 0xff4a3a, 0.5);
  addLights(codeTower, 0xff4a3a, 0.2);
  addLights(pad, 0xff4a3a, 0.7);
  if (testHall) addLights(testHall, 0xff4a3a, 0.35);
  dishCode.userData.lights = [new THREE.Vector3(0, 17.5, 0)];

  // Venting vapour around a fuelled rocket.
  const vapour = makeParticles(160, { size: 4, additive: false });
  vapour.points.material.opacity = 0.55;
  scene.add(vapour.points);

  // Hover highlight: a gold ring on the ground under the building.
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 64), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  ring.renderOrder = 2;
  scene.add(ring);

  // Invisible pick boxes (cheap raycasts, and they cover loaded models too).
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const proxies = [];
  function refreshProxy() {
    proxies.forEach((p) => p.parent && p.parent.remove(p));
    proxies.length = 0;
    picks.forEach((p) => {
      p.group.updateMatrixWorld(true);
      const b = new THREE.Box3();
      p.group.traverse((o) => {
        if (o.isMesh && o.visible && o.material !== proxyMat && !o.isSprite) b.expandByObject(o);
      });
      const size = b.getSize(new THREE.Vector3());
      const c = b.getCenter(new THREE.Vector3());
      const px = new THREE.Mesh(new THREE.BoxGeometry(size.x + 2, size.y + 2, size.z + 2), proxyMat);
      px.position.copy(c);
      px.userData.pick = p.id;
      scene.add(px);
      proxies.push(px);
      p.box = b;
      const an = p.group.userData.anchor;
      p.anchor = an ? p.group.localToWorld(an.clone()) : new THREE.Vector3(c.x, b.max.y + 2, c.z);
      p.radius = Math.max(size.x, size.z) * 0.62 + 4;
    });
  }
  refreshProxy();

  // ---------- HTML pins ----------
  const pins = {};
  const layer = opts.labelLayer || null;
  let curLabels = opts.labels || {};
  function setLabels(labels) {
    curLabels = Object.assign({}, curLabels, labels || {});
    if (!layer) return;
    Object.entries(labels || {}).forEach(([id, l]) => {
      let b = pins[id];
      if (!b) {
        b = document.createElement('button');
        b.type = 'button';
        b.className = 'hq-pin';
        b.dataset.pick = id;
        b.innerHTML = '<span class="hq-pin-dot" aria-hidden="true"></span><span class="hq-pin-text"><b></b><small></small></span>';
        b.addEventListener('click', () => opts.onPick && opts.onPick(id));
        b.addEventListener('pointerenter', () => setHover(id));
        b.addEventListener('pointerleave', () => setHover(null));
        b.addEventListener('focus', () => setHover(id));
        b.addEventListener('blur', () => setHover(null));
        layer.appendChild(b);
        pins[id] = b;
      }
      b._w = 0;
      b.querySelector('b').textContent = l.title;
      b.querySelector('small').textContent = l.sub || '';
      b.setAttribute('aria-label', l.sub ? `${l.title}: ${l.sub}` : l.title);
      if (l.badge) b.dataset.badge = l.badge;
      else delete b.dataset.badge;
    });
  }
  setLabels(opts.labels);

  // ---------- The player's astronaut ----------
  // The shared character controller (js/3d/controller.js) walks and films the
  // astronaut: WASD / stick / thumb joystick relative to the camera, Shift to
  // run, E at a door or a person. Clicks still walk (A* round the buildings).
  // The third-person camera is the default view; the campus map (M, the
  // toggle, or zooming all the way out) shows it all.
  const tmpC = new THREE.Vector3();
  const obstacles = [];
  const camObs = []; // footprints with heights: the walking camera stays out of them
  const doors = {};
  picks.forEach((p) => {
    const f = FOOT[p.id];
    const g = p.group;
    const w = (x, z) => {
      tmpC.set(x, 0, z);
      g.localToWorld(tmpC);
      return { x: tmpC.x, z: tmpC.z };
    };
    if (f) {
      f.c.forEach(([x, z, r, h]) => {
        const at = w(x, z);
        obstacles.push(Object.assign({}, at, { r }));
        camObs.push(Object.assign({}, at, { r, h: h || 10 }));
      });
    }
    if (f && f.door) {
      const d = w(f.door[0], f.door[1]);
      const inside = w(f.door[0], f.door[1] - 4);
      doors[p.id] = { x: d.x, z: d.z, face: Math.atan2(inside.x - d.x, inside.z - d.z) };
    } else if (f) {
      // Round buildings: the door faces the plaza centre.
      const c = w(0, 0);
      const dx = CENTER.x - c.x;
      const dz = CENTER.z - c.z;
      const l = Math.hypot(dx, dz) || 1;
      const r = f.c[0][2] + 1.5;
      doors[p.id] = { x: c.x + (dx / l) * r, z: c.z + (dz / l) * r, face: Math.atan2(-dx, -dz) };
    }
  });
  // The pad is off the plaza: its "door" is where the crawlerway leaves it.
  doors.pad = { x: 40.5, z: 29.5, face: Math.atan2(PAD.x - 40.5, PAD.z - 29.5) };
  // Palms on or near the walkable ground.
  spots.forEach((s) => {
    if (s.x > WALK.minX - 2 && s.x < WALK.maxX + 2 && s.z > WALK.minZ - 2 && s.z < WALK.maxZ + 2) obstacles.push({ x: s.x, z: s.z, r: 1.1 });
  });

  // Plaza furniture, kept clear of footprints, doorways and each other.
  const MONUMENT = [4, 6];
  const roomFor = (x, z, r) =>
    x > WALK.minX + 1 && x < WALK.maxX - 1 && z > WALK.minZ + 1 && z < WALK.maxZ - 1 &&
    !obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 0.4) &&
    !Object.values(doors).some((d) => Math.hypot(d.x - x, d.z - z) < 2.2 + r);
  const furniture = { lamps: [], benches: [], planters: [], flags: [], monument: MONUMENT };
  const put = (list, item, r) => {
    if (!roomFor(item[0], item[1], r)) return false;
    list.push(item);
    obstacles.push({ x: item[0], z: item[1], r });
    return true;
  };
  obstacles.push({ x: MONUMENT[0], z: MONUMENT[1], r: 2.6 });
  // Two lamps beside every door, a little out from the wall.
  Object.entries(doors).forEach(([id, d]) => {
    const ox = -Math.sin(d.face);
    const oz = -Math.cos(d.face);
    const sx = Math.cos(d.face);
    const sz = -Math.sin(d.face);
    const w = id === 'testlab' || id === 'design' ? 5.2 : 3.4;
    [-1, 1].forEach((k) => put(furniture.lamps, [d.x + sx * w * k + ox * 1.2, d.z + sz * w * k + oz * 1.2], 0.25));
  });
  // Around the monument: benches facing it, planters between them, lamps outside.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    put(furniture.benches, [MONUMENT[0] + Math.sin(a) * 6.2, MONUMENT[1] + Math.cos(a) * 6.2, a + Math.PI], 1.0);
    const b = a + Math.PI / 4;
    put(furniture.planters, [MONUMENT[0] + Math.sin(b) * 6.4, MONUMENT[1] + Math.cos(b) * 6.4], 0.7);
    put(furniture.lamps, [MONUMENT[0] + Math.sin(a) * 10, MONUMENT[1] + Math.cos(a) * 10], 0.25);
  }
  // Flags along the front of mission control.
  if (doors.board) {
    const d = doors.board;
    const sx = Math.cos(d.face);
    const sz = -Math.sin(d.face);
    const ox = -Math.sin(d.face);
    const oz = -Math.cos(d.face);
    [[6.5, '#17807a'], [8.5, '#d9a21b'], [10.5, '#f3ede2']].forEach(([w, c]) => put(furniture.flags, [d.x + sx * w + ox * 0.6, d.z + sz * w + oz * 0.6, c], 0.3));
  }
  // The low quality tier: no shadows from the small props, people simplify sooner.
  let lowTier = false;
  try {
    lowTier = profile().tier === 'low';
  } catch (e) {
    lowTier = false;
  }
  const props = makeProps(M, furniture, lowTier);
  scene.add(props.group);
  // In the walking view the building pins hang over the doors.
  const doorPin = {};
  Object.entries(doors).forEach(([id, d]) => (doorPin[id] = new THREE.Vector3(d.x, id === 'design' || id === 'testlab' ? 6.5 : 5, d.z)));
  let pinBlend = 0;

  // A coarse walk grid (1 m) for paths around the buildings.
  const CELL = 1;
  const GX = Math.round((WALK.maxX - WALK.minX) / CELL) + 1;
  const GZ = Math.round((WALK.maxZ - WALK.minZ) / CELL) + 1;
  const blocked = new Uint8Array(GX * GZ);
  for (let j = 0; j < GZ; j++) {
    const z = WALK.minZ + j * CELL;
    for (let i = 0; i < GX; i++) {
      const x = WALK.minX + i * CELL;
      for (const o of obstacles) {
        const dx = x - o.x;
        const dz = z - o.z;
        if (dx * dx + dz * dz < (o.r + 0.6) * (o.r + 0.6)) {
          blocked[j * GX + i] = 1;
          break;
        }
      }
    }
  }
  const cellOf = (x, z) => {
    const i = Math.max(0, Math.min(GX - 1, Math.round((x - WALK.minX) / CELL)));
    const j = Math.max(0, Math.min(GZ - 1, Math.round((z - WALK.minZ) / CELL)));
    return j * GX + i;
  };
  const cellX = (c) => WALK.minX + (c % GX) * CELL;
  const cellZ = (c) => WALK.minZ + Math.floor(c / GX) * CELL;
  function nearestFree(c) {
    if (!blocked[c]) return c;
    const ci = c % GX;
    const cj = Math.floor(c / GX);
    for (let r = 1; r < 30; r++) {
      let best = -1;
      let bd = Infinity;
      for (let j = cj - r; j <= cj + r; j++) {
        for (let i = ci - r; i <= ci + r; i++) {
          if (i < 0 || j < 0 || i >= GX || j >= GZ) continue;
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
          const k = j * GX + i;
          const d = (i - ci) ** 2 + (j - cj) ** 2;
          if (!blocked[k] && d < bd) {
            bd = d;
            best = k;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
  // Straight line clear of every footprint?
  function clearLine(ax, az, bx, bz) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.4);
    for (let s = 1; s <= n; s++) {
      const k = s / n;
      if (blocked[cellOf(ax + (bx - ax) * k, az + (bz - az) * k)]) return false;
    }
    return true;
  }
  // A* on the grid, then string-pulled to a few waypoints. null: no way there.
  function findPath(sx, sz, tx, tz) {
    const goal = nearestFree(cellOf(tx, tz));
    if (goal < 0) return null;
    let gx = tx;
    let gz = tz;
    if (blocked[cellOf(tx, tz)] || tx < WALK.minX || tx > WALK.maxX || tz < WALK.minZ || tz > WALK.maxZ) {
      gx = cellX(goal);
      gz = cellZ(goal);
    }
    if (clearLine(sx, sz, gx, gz)) return [{ x: gx, z: gz }];
    const start = nearestFree(cellOf(sx, sz));
    if (start < 0) return null;
    const N = GX * GZ;
    const gs = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const shut = new Uint8Array(N);
    const heap = [];
    const fOf = new Float32Array(N);
    const h = (c) => Math.hypot(cellX(c) - cellX(goal), cellZ(c) - cellZ(goal));
    const push = (c) => {
      heap.push(c);
      let i = heap.length - 1;
      while (i > 0) {
        const pa = (i - 1) >> 1;
        if (fOf[heap[pa]] <= fOf[c]) break;
        heap[i] = heap[pa];
        i = pa;
      }
      heap[i] = c;
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          if (l >= heap.length) break;
          const r = l + 1;
          const m = r < heap.length && fOf[heap[r]] < fOf[heap[l]] ? r : l;
          if (fOf[heap[m]] >= fOf[last]) break;
          heap[i] = heap[m];
          i = m;
        }
        heap[i] = last;
      }
      return top;
    };
    gs[start] = 0;
    fOf[start] = h(start);
    push(start);
    let found = false;
    let guard = 0;
    while (heap.length && guard++ < N * 2) {
      const c = pop();
      if (shut[c]) continue;
      if (c === goal) {
        found = true;
        break;
      }
      shut[c] = 1;
      const ci = c % GX;
      const cj = Math.floor(c / GX);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= GX || j >= GZ) continue;
          const k = j * GX + i;
          if (blocked[k] || shut[k]) continue;
          // No cutting corners between two blocked cells.
          if (di && dj && (blocked[cj * GX + i] || blocked[j * GX + ci])) continue;
          const ng = gs[c] + (di && dj ? 1.4142 : 1);
          if (ng < gs[k]) {
            gs[k] = ng;
            came[k] = c;
            fOf[k] = ng + h(k);
            push(k);
          }
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = goal; c !== -1 && c !== start; c = came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => ({ x: cellX(c), z: cellZ(c) }));
    pts[pts.length - 1] = { x: gx, z: gz };
    // Keep only the corners: the farthest point still in a straight line.
    const out = [];
    let cx = sx;
    let cz = sz;
    let k = 0;
    while (k < pts.length) {
      let best = k;
      for (let m = pts.length - 1; m > k; m--) {
        if (clearLine(cx, cz, pts[m].x, pts[m].z)) {
          best = m;
          break;
        }
      }
      out.push(pts[best]);
      cx = pts[best].x;
      cz = pts[best].z;
      k = best + 1;
    }
    return out;
  }

  const astro = createAstronaut(SMD.avatar ? SMD.avatar.get() : null, { shadows: false, blob: true });
  const me = astro.group;
  const clampWalk = (x, z) => ({ x: Math.max(WALK.minX + 1, Math.min(WALK.maxX - 1, x)), z: Math.max(WALK.minZ + 1, Math.min(WALK.maxZ - 1, z)) });
  // A free spot on the walk grid near (x, z).
  const freeSpot = (x, z) => {
    const p = clampWalk(x, z);
    const c = cellOf(p.x, p.z);
    if (!blocked[c]) return p;
    const n = nearestFree(c);
    return n < 0 ? p : { x: cellX(n), z: cellZ(n) };
  };
  // Where to start: a few steps out of the building you just left, else where
  // you stood last time, else the middle of the plaza.
  const fromDoor = opts.spawn && doors[opts.spawn] ? opts.spawn : null;
  let startYaw;
  if (fromDoor) {
    const d = doors[fromDoor];
    const s = freeSpot(d.x - Math.sin(d.face) * 6.5, d.z - Math.cos(d.face) * 6.5);
    me.position.set(s.x, PLAZA_Y, s.z);
    me.rotation.y = d.face + Math.PI; // facing out onto the plaza
    startYaw = d.face + 0.45; // the camera on the building's side, a little to one side
  } else if (lastSpot) {
    me.position.set(lastSpot.x, PLAZA_Y, lastSpot.z);
    me.rotation.y = lastSpot.ry;
    startYaw = typeof lastSpot.camYaw === 'number' ? lastSpot.camYaw : lastSpot.ry + Math.PI;
  } else {
    // On the plaza in the sun, looking up the valley: mission control and the
    // lab on the left, the clean room on the right, the Nile beyond.
    me.position.set(14, PLAZA_Y, 12);
    me.rotation.y = Math.atan2(-34, -32);
    startYaw = me.rotation.y + Math.PI;
  }
  scene.add(me);

  // A ring under the feet and a name tag, so you can find yourself from far away.
  const meRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.95, 48), new THREE.MeshBasicMaterial({ color: 0x3fc1b4, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  meRing.rotation.x = -Math.PI / 2;
  meRing.renderOrder = 3;
  scene.add(meRing);
  const goRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  goRing.rotation.x = -Math.PI / 2;
  goRing.renderOrder = 3;
  scene.add(goRing);
  let goFade = 0;
  let meTag = null;
  if (layer) {
    meTag = document.createElement('div');
    meTag.className = 'hq-me-pin';
    meTag.setAttribute('aria-hidden', 'true');
    meTag.innerHTML = '<span class="hq-me-tag"></span>';
    layer.appendChild(meTag);
  }
  const setTagName = (a) => {
    if (meTag) meTag.firstChild.textContent = (a && a.name) || '';
  };
  setTagName(astro.appearance);
  // A quick dip to the campus colour hides the jump on long walks (follow view).
  let fadeEl = null;
  if (opts.el) {
    fadeEl = document.createElement('div');
    fadeEl.className = 'hq-fade';
    fadeEl.setAttribute('aria-hidden', 'true');
    opts.el.insertBefore(fadeEl, opts.el.firstChild);
  }

  // ---------- The staff on the campus ----------
  // Each person walks a short loop in front of their building's door.
  const staffDefs = (opts.staff || []).filter((d) => d && d.id);
  const routes = {};
  staffDefs.forEach((def) => {
    const door = doors[def.post] || doors.board;
    const ox = -Math.sin(door.face);
    const oz = -Math.cos(door.face);
    const sx = Math.cos(door.face);
    const sz = -Math.sin(door.face);
    const pts = [];
    (def.route && def.route.length ? def.route : [[0, 5]]).forEach(([s, o]) => {
      const p = freeSpot(door.x + ox * o + sx * s, door.z + oz * o + sz * s);
      // Never park in a doorway, and keep each leg of the loop clear.
      if (Object.values(doors).some((d) => Math.hypot(d.x - p.x, d.z - p.z) < 2.5)) return;
      const prev = pts[pts.length - 1];
      if (prev && !clearLine(prev.x, prev.z, p.x, p.z)) return;
      pts.push(p);
    });
    if (pts.length > 2 && !clearLine(pts[pts.length - 1].x, pts[pts.length - 1].z, pts[0].x, pts[0].z)) pts.pop();
    routes[def.id] = pts.length ? pts : [freeSpot(door.x + ox * 5, door.z + oz * 5)];
  });
  const crew = staffDefs.length ? createStaff(staffDefs, { routes, groundY: PLAZA_Y, reduced, nearLod: lowTier ? 55 : 95 }) : null;
  if (crew) scene.add(crew.group);
  // People are obstacles the astronaut steps around (not part of the path grid).
  const crewObs = crew ? crew.people.map((p) => {
    const o = { x: p.x, z: p.z, r: 0.32 };
    obstacles.push(o);
    return o;
  }) : [];
  const plPos = { x: 0, z: 0 };
  // Name tags (buttons: click or tap to talk), the "!" marker and the E prompt.
  const tags = {};
  if (layer && crew) {
    crew.people.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hq-npc is-off';
      b.dataset.npc = p.id;
      b.innerHTML = '<span class="hq-npc-alert" aria-hidden="true">!</span><span class="hq-npc-tag"><b></b><small></small><span class="hq-npc-key"><kbd>E</kbd><span></span></span></span>';
      b.addEventListener('click', () => talk(p.id));
      layer.appendChild(b);
      tags[p.id] = b;
    });
  }
  function setStaffLabels(l) {
    Object.entries(l || {}).forEach(([id, x]) => {
      const b = tags[id];
      if (!b) return;
      b.querySelector('b').textContent = x.name || '';
      b.querySelector('small').textContent = x.role || '';
      b.querySelector('.hq-npc-key > span').textContent = x.talk || '';
      b.setAttribute('aria-label', x.aria || x.name || id);
    });
  }
  setStaffLabels(opts.staffLabels);

  let route = null; // { pts, i, cur, onDone }
  let camYaw = 0.3; // the overview camera's current yaw (set every frame)
  // Two views: walking (third person, the default) and the campus map.
  let follow = opts.view !== 'map';
  // Coming back from a building: already behind you. First visit: swoop down from the map.
  let walkK = follow && (fromDoor || lastSpot || reduced) ? 1 : 0;
  const DIST0 = 6.5;
  const DMAX = 24;
  const fPos = new THREE.Vector3();
  const fLook = new THREE.Vector3();
  const lookBlend = new THREE.Vector3();
  // Talking: a two-shot of you and the person you talk to.
  let talking = null;
  let talkWho = null;
  let talkK = 0;
  let talkSide = 1;
  let talkYaw = 0;
  let nearId = null;
  let hoverNpc = null;
  const tPos = new THREE.Vector3();
  const tLook = new THREE.Vector3();
  const timers = []; // { at, fn } on the scene clock
  const later = (s, fn) => timers.push({ at: t + s, fn });
  let faceYaw = null;
  let pendingReact = null;
  let lastDoor = fromDoor;
  let glanceIn = 6;
  let glanceUntil = 0;
  let idle = 0;
  // Doors and people are the things to use (E, A, the big button, a click).
  const staffAt = {};
  if (crew) crew.people.forEach((p) => (staffAt[p.id] = new THREE.Vector3(p.x, PLAZA_Y, p.z)));
  const T = (k, en, p) => (SMD.t ? SMD.t(k, en, p) : en);
  const doorName = (id) => (curLabels[id] && curLabels[id].title) || id;
  const staffName = (id) => (opts.staffLabels && opts.staffLabels[id] && opts.staffLabels[id].name) || id;
  const interactables = [
    ...Object.keys(doors).map((id) => ({ id: 'door:' + id, kind: 'door', door: id, at: new THREE.Vector3(doors[id].x, PLAZA_Y, doors[id].z), radius: 3.4, promptHeight: 2.3, ring: 1.4, label: () => T('hq.w.goIn', 'Go in: {name}', { name: doorName(id) }), onInteract: () => enter(id) })),
    ...(crew ? crew.people.map((p) => ({ id: 'npc:' + p.id, kind: 'npc', npc: p.id, at: staffAt[p.id], radius: 2.9, promptHeight: 2.1, priority: 1, ring: false, enabled: () => talking !== p.id, label: () => T('hq.w.talkTo2', 'Talk to {name}', { name: staffName(p.id) }), onInteract: () => talk(p.id) })) : []),
  ];
  const ctl = createController({
    camera,
    dom: getRenderer().domElement,
    overlay: opts.el || null,
    character: astro,
    walkable: { bounds: WALK, circles: obstacles },
    cameraClear: (o, d, want) => camClear(o, d, want),
    rig: { distance: DIST0, height: 1.62, shoulder: 0.55, min: 2.4, max: DMAX, pitch: [-0.25, 1.15], pitch0: 0.24, fov: 52, floorY: PLAZA_Y },
    speeds: { walk: 2.6, run: 6.2, accel: 12, turn: 11 },
    yaw: startYaw,
    applyCamera: false,
    interactables,
  });
  const ctlMoving = () => ctl.state.moving;
  // A key pressed while talking walks away (and ends the conversation).
  ctl.on('wantmove', () => {
    if (talking && follow && (!opts.canWalk || opts.canWalk())) endTalk();
  });
  ctl.on('back', () => {
    if (opts.onBack) opts.onBack();
    else if (talking) endTalk();
  });

  function cancelRoute() {
    route = null;
    ctl.stop();
    timers.length = 0;
    if (fadeEl) fadeEl.classList.remove('on');
  }
  function stepRoute() {
    const r = route;
    if (!r) return;
    if (r.i >= r.pts.length) {
      route = null;
      if (r.onDone) r.onDone();
      return;
    }
    r.cur = r.pts[r.i++];
    ctl.moveTo({ x: r.cur.x, z: r.cur.z }, { onArrive: () => route === r && stepRoute(), run: r.run });
  }
  function followRoute(pts, onDone) {
    faceYaw = null;
    astro.lookAt(null);
    // Long walks across the plaza jog.
    route = { pts, i: 0, cur: null, onDone, run: pathLen(pts) > 16 && !reduced };
    stepRoute();
  }
  const pathLen = (pts) => {
    let l = 0;
    let x = me.position.x;
    let z = me.position.z;
    pts.forEach((p) => {
      l += Math.hypot(p.x - x, p.z - z);
      x = p.x;
      z = p.z;
    });
    return l;
  };
  function markGoal(x, z) {
    goRing.position.set(x, PLAZA_Y + 0.08, z);
    goFade = 1;
  }

  // Walk to a ground point.
  function walkTo(x, z) {
    const pts = findPath(me.position.x, me.position.z, x, z);
    if (!pts) return false;
    endTalk();
    timers.length = 0;
    const last = pts[pts.length - 1];
    markGoal(last.x, last.z);
    followRoute(pts, null);
    return true;
  }

  // Walk to a spot, then onArrive. Long walks cut to the last steps so a
  // click never takes more than about two and a half seconds.
  function goNear(x, z, onArrive, faceAt) {
    cancelRoute();
    const arrive = () => {
      if (faceAt !== undefined && faceAt !== null) me.rotation.y = faceAt;
      if (onArrive) onArrive();
    };
    const teleport = (tx, tz, ry) => ctl.teleport({ x: tx, y: PLAZA_Y, z: tz }, ry, { camera: 'keep' });
    if (reduced) {
      teleport(x, z, faceAt !== undefined && faceAt !== null ? faceAt : me.rotation.y);
      arrive();
      return;
    }
    const pts = findPath(me.position.x, me.position.z, x, z);
    if (!pts) {
      teleport(x, z, faceAt !== undefined && faceAt !== null ? faceAt : me.rotation.y);
      arrive();
      return;
    }
    markGoal(x, z);
    if (pathLen(pts) / (pathLen(pts) > 16 ? 6.2 : WALK_SPEED) <= 2.5) {
      followRoute(pts, arrive);
      return;
    }
    // Set off, then cut: the last 2.4 m before the goal.
    followRoute(pts, null);
    const lastFrom = pts.length > 1 ? pts[pts.length - 2] : { x: me.position.x, z: me.position.z };
    const end = pts[pts.length - 1];
    const dx = end.x - lastFrom.x;
    const dz = end.z - lastFrom.z;
    const l = Math.hypot(dx, dz) || 1;
    const back = Math.min(2.4, l * 0.8);
    const sx = end.x - (dx / l) * back;
    const sz = end.z - (dz / l) * back;
    const cut = () => {
      route = null;
      ctl.stop();
      teleport(sx, sz, Math.atan2(dx, dz));
      followRoute([{ x: end.x, z: end.z }], arrive);
    };
    if (walkK > 0.5 && fadeEl) {
      later(0.3, () => fadeEl.classList.add('on'));
      later(0.48, () => {
        cut();
        fadeEl.classList.remove('on');
      });
    } else later(0.4, cut);
  }

  // Going in may leave the HQ: never inside a frame (the engine is mid-render).
  const openLater = (id) =>
    Promise.resolve().then(() => {
      if (!disposed && opts.onPick) opts.onPick(id);
    });
  // Walk to a building's door and go in.
  function enter(id) {
    const d = doors[id];
    const open = () => openLater(id);
    if (!d) return open();
    endTalk();
    goNear(
      d.x,
      d.z,
      () => {
        astro.lookAt(null);
        lastDoor = id;
        lastSpot = { x: me.position.x, z: me.position.z, ry: d.face + Math.PI, door: id };
        open();
      },
      d.face
    );
  }

  // Walk up to someone and talk. The screen shows what they say (onTalk).
  function talk(id) {
    const p = crew && crew.get(id);
    if (!p) return false;
    if (talking === id) return true;
    endTalk();
    if (!follow) setFollow(true);
    crew.hold(id, true);
    const begin = () => {
      if (disposed) return;
      talking = talkWho = id;
      crew.talk(id, true);
      faceYaw = Math.atan2(p.x - me.position.x, p.z - me.position.z);
      astro.lookAt(new THREE.Vector3(p.x, PLAZA_Y + p.P.height * 0.92, p.z));
      // Frame the pair from the side the camera is already on.
      const ux = p.x - me.position.x;
      const uz = p.z - me.position.z;
      talkSide = Math.sign(uz * Math.sin(ctl.camYaw) - ux * Math.cos(ctl.camYaw)) || 1;
      Promise.resolve().then(() => !disposed && talking === id && opts.onTalk && opts.onTalk(id));
    };
    const dx = me.position.x - p.x;
    const dz = me.position.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d <= 2.6) begin();
    else goNear(p.x + (dx / d) * 1.5, p.z + (dz / d) * 1.5, begin);
    return true;
  }
  function endTalk(quiet) {
    if (!talking) {
      if (crew) crew.people.forEach((p) => p.held && crew.hold(p.id, false));
      return;
    }
    const id = talking;
    talking = null;
    crew.talk(id, false);
    crew.hold(id, false);
    astro.lookAt(null);
    // The walking camera carries on from where the conversation left it.
    if (talkK > 0.5) ctl.camYaw = talkYaw;
    if (!quiet && opts.onTalkEnd) opts.onTalkEnd(id);
  }

  // One-shot reactions: wave, celebrate, cheer, sad. Turns to the camera first.
  function react(name) {
    if (!['wave', 'celebrate', 'cheer', 'sad'].includes(name)) return;
    if (route || ctlMoving()) {
      pendingReact = name;
      return;
    }
    pendingReact = null;
    astro.lookAt(null);
    faceYaw = Math.atan2(camera.position.x - me.position.x, camera.position.z - me.position.z);
    later(reduced ? 0 : 0.35, () => astro[name]());
  }

  // ---------- Keys: the controller walks; M opens the campus map ----------
  // Not while typing or using a menu, or while a control has the keyboard
  // focus; a button you just clicked with the mouse does not count.
  const keysBlocked = (a) => {
    if (!a || a === document.body) return false;
    if (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.getAttribute('role') === 'menuitem') return true;
    if (/^(BUTTON|A)$/.test(a.tagName)) {
      try {
        return a.matches(':focus-visible');
      } catch (e) {
        return true;
      }
    }
    return false;
  };
  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (keysBlocked(document.activeElement)) return;
    if (opts.canWalk && !opts.canWalk()) return;
    if (e.code === 'KeyM' && !e.repeat) {
      e.preventDefault();
      setFollow(!follow);
    }
  };
  window.addEventListener('keydown', onKeyDown);

  function setFollow(on, quiet) {
    on = !!on;
    if (on === follow) return;
    follow = on;
    if (on) {
      // Carry on in the direction the campus map was looking.
      ctl.zoom = DIST0;
      ctl.snapCamera(camYaw);
    } else {
      endTalk();
      ctl.release();
    }
    if (!quiet && opts.onFollow) opts.onFollow(on);
  }

  // Mouse wheel: zoom; all the way out opens the campus map, in walks again.
  let wheelOut = 0;
  const onWheel = (e) => {
    if (W < 760) return;
    if (!follow) {
      if (e.deltaY < 0) {
        e.preventDefault();
        setFollow(true);
      }
      return;
    }
    // The controller zooms; past the far end three more notches open the map.
    e.preventDefault();
    if (e.deltaY > 0 && ctl.zoom >= DMAX - 0.01) {
      if (++wheelOut >= 3) {
        wheelOut = 0;
        setFollow(false);
      }
      return;
    }
    wheelOut = 0;
  };
  if (opts.el) opts.el.addEventListener('wheel', onWheel, { passive: false });

  // How far the camera can sit from o along d before a building gets in the
  // way (footprint circles with heights; the ray rises, so roofs end it).
  function camClear(o, d, want) {
    let best = want;
    const a = d.x * d.x + d.z * d.z;
    if (a < 1e-6) return best;
    for (const c of camObs) {
      const fx = o.x - c.x;
      const fz = o.z - c.z;
      const b = 2 * (fx * d.x + fz * d.z);
      const cc = fx * fx + fz * fz - c.r * c.r;
      const disc = b * b - 4 * a * cc;
      if (disc <= 0) continue;
      let s = (-b - Math.sqrt(disc)) / (2 * a);
      if (s < 0) {
        if (cc > 0) continue;
        s = 0;
      }
      if (s >= best || o.y + d.y * s > c.h + 0.3) continue;
      best = Math.max(1.4, s - 0.4);
    }
    return best;
  }

  function updateAstro(dt) {
    // Scheduled steps (the cut on long walks, reactions).
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].at <= t) {
        const fn = timers[i].fn;
        timers.splice(i, 1);
        fn();
      }
    }
    // The controller: keys, stick or thumb (relative to the camera). Taking
    // over by hand cancels a click-walk.
    ctl.setEnabled(follow && walkK > 0.5 && !talking && (!opts.canWalk || opts.canWalk()));
    const keyed = ctl.state.inputActive;
    if (keyed) {
      if (route) {
        route = null;
        timers.length = 0;
        if (fadeEl) fadeEl.classList.remove('on');
      }
      faceYaw = null;
    }
    // Corners of a route: move on before slowing down.
    if (route && route.cur && route.i < route.pts.length && Math.hypot(route.cur.x - me.position.x, route.cur.z - me.position.z) < 1.1) stepRoute();
    // Turning on the spot to face someone (reactions, conversations).
    if (faceYaw !== null && !ctlMoving()) {
      const d = wrapAngle(faceYaw - me.rotation.y);
      me.rotation.y += d * Math.min(1, dt * 7);
      if (Math.abs(d) < 0.01) faceYaw = null;
    }
    if (crew) crew.people.forEach((p) => staffAt[p.id] && staffAt[p.id].set(p.x, PLAZA_Y, p.z));
    ctl.update(dt);
    me.position.y = PLAZA_Y;
    // Walking into a door with the keys goes in.
    if (keyed) {
      for (const id in doors) {
        const d = doors[id];
        if (lastDoor !== id && Math.hypot(d.x - me.position.x, d.z - me.position.z) < 1.6) {
          lastDoor = id;
          ctl.stop();
          ctl.setEnabled(false);
          me.rotation.y = d.face;
          lastSpot = { x: me.position.x, z: me.position.z, ry: d.face + Math.PI, door: id };
          openLater(id);
          break;
        }
      }
    }
    if (lastDoor && doors[lastDoor] && Math.hypot(doors[lastDoor].x - me.position.x, doors[lastDoor].z - me.position.z) > 3.5) lastDoor = null;
    const moving = ctlMoving() || !!route;
    // The person in front of you (the controller's target), walking view only.
    const tg = ctl.state.target;
    nearId = crew && !talking && walkK > 0.5 && tg && tg.kind === 'npc' ? tg.npc : null;
    // Idle life: look at who is near or what you point at, glance at the buildings now and then.
    idle = moving ? 0 : idle + dt;
    if (!moving && pendingReact) {
      const n = pendingReact;
      pendingReact = null;
      react(n);
    }
    if (!moving && !astro.action && faceYaw === null && !talking) {
      const hp = hover && picks.find((p) => p.id === hover);
      const np = nearId && crew.get(nearId);
      if (np) {
        astro.lookAt(tmpC.set(np.x, PLAZA_Y + np.P.height * 0.92, np.z).clone());
        glanceUntil = t + 0.6;
      } else if (hp) {
        astro.lookAt(hp.box.getCenter(tmpC).setY(Math.min(8, hp.box.max.y * 0.5)).clone());
        glanceUntil = t + 1.5;
      } else if (!reduced && idle > 2) {
        glanceIn -= dt;
        if (glanceIn <= 0) {
          glanceIn = 6 + Math.random() * 6;
          const p = picks[Math.floor(Math.random() * picks.length)];
          astro.lookAt(p.box.getCenter(new THREE.Vector3()).setY(6));
          glanceUntil = t + 2.4;
        }
      }
      if (glanceUntil && t > glanceUntil) {
        glanceUntil = 0;
        astro.lookAt(null);
      }
    }
  }

  // After the camera has moved: the staff (detail by camera distance) and the rings.
  function updateLife(dt) {
    // The staff: walk their loops, look at you, step aside.
    plPos.x = me.position.x;
    plPos.z = me.position.z;
    if (crew) {
      crew.update(dt, { cam: camera.position, player: plPos });
      crew.people.forEach((p, i) => {
        crewObs[i].x = p.x;
        crewObs[i].z = p.z;
      });
    }
    // Marker ring and the goal ring.
    const camD = camera.position.distanceTo(me.position);
    const rs = Math.max(0.8, Math.min(3.2, camD * 0.009));
    meRing.position.set(me.position.x, PLAZA_Y + 0.07, me.position.z);
    meRing.scale.set(rs, rs, 1);
    meRing.material.opacity = (0.55 + 0.35 * (reduced ? 1 : 0.5 + 0.5 * Math.sin(t * 3.2))) * (1 - 0.6 * walkK);
    if (goFade > 0) {
      goFade = Math.max(0, goFade - dt * (route ? 0.5 : 2));
      goRing.material.opacity = goFade * 0.9;
      const gs = rs * (0.9 + (1 - goFade) * 0.3);
      goRing.scale.set(gs, gs, 1);
    }
    goRing.visible = goFade > 0;
  }

  // ---------- Pointer: hover, pick, orbit, pinch ----------
  let hover = null;
  function setHover(id) {
    if (hover === id) return;
    hover = id;
    Object.entries(pins).forEach(([k, b]) => b.classList.toggle('is-hot', k === id));
    if (opts.onHover) opts.onHover(id);
  }
  function setHoverNpc(id) {
    if (hoverNpc === id) return;
    hoverNpc = id;
    Object.entries(tags).forEach(([k, b]) => b.classList.toggle('is-hot', k === id));
  }
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLAZA_Y);
  const groundHit = new THREE.Vector3();
  const npcC = new THREE.Vector3();
  let down = null;
  let pendingHover = null;
  let yawUser = 0;
  const pointers = new Map();
  let pinch = null;
  const aimAt = (e) => {
    const rect = opts.el.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  // The building under the pointer (after aimAt), and how far along the ray.
  let pickDist = Infinity;
  const pickAt = () => {
    pickDist = Infinity;
    // Cheap boxes first, then confirm on the building's own meshes (boxes overlap).
    const hits = ray.intersectObjects(proxies, false);
    for (const h of hits) {
      const p = picks.find((x) => x.id === h.object.userData.pick);
      if (!p) continue;
      if (p.group.userData.coarse) {
        pickDist = h.distance;
        return p.id;
      }
      const m = ray.intersectObject(p.group, true).find((x) => !x.object.isSprite);
      if (m) {
        pickDist = m.distance;
        return p.id;
      }
    }
    return null;
  };
  // A person under the pointer (after aimAt), unless a building is in front.
  const pickNpc = (buildingDist) => {
    if (!crew) return null;
    let best = null;
    let bd = Infinity;
    const r = walkK > 0.5 ? 0.6 : 2.2;
    crew.people.forEach((p) => {
      npcC.set(p.x, PLAZA_Y + 0.95, p.z);
      if (ray.ray.distanceSqToPoint(npcC) > r * r) return;
      const d = ray.ray.origin.distanceTo(npcC);
      if (d < bd && d < buildingDist) {
        bd = d;
        best = p.id;
      }
    });
    return best;
  };
  // Pins and buttons of their own: never walk under them.
  const fromPin = (e) => e.target && e.target.closest && e.target.closest('.hq-pin, .hq-npc, button, .hq-view');
  // In the walking view the controller owns drags, pinches and taps (see the
  // 'tap' handler below); these handlers run the campus map and the hover.
  const walkMode = () => follow && walkK > 0.5;
  const onMove = (e) => {
    if (walkMode()) {
      if (!fromPin(e) && e.pointerType === 'mouse' && !e.buttons && !ctl.locked) pendingHover = e;
      return;
    }
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const k = pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
      if (!follow && k < 0.8) {
        setFollow(true);
        pinch = null;
      }
      return;
    }
    if (down) {
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (!down.dragged && Math.hypot(dx, dy) > 5) down.dragged = true;
      if (down.dragged) {
        if (!follow) yawUser = Math.max(-1.1, Math.min(1.1, down.yaw - dx * 0.004));
        void dy;
        return;
      }
    }
    if (fromPin(e)) return;
    if (e.pointerType === 'mouse') pendingHover = e;
  };
  const onDown = (e) => {
    if (fromPin(e) || walkMode()) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)) };
      down = null;
      return;
    }
    // The right button always turns the camera; the left one walks unless you drag.
    down = { x: e.clientX, y: e.clientY, yaw: yawUser, dragged: e.button === 2, button: e.button, touch: e.pointerType === 'touch' };
  };
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (walkMode()) {
      down = null;
      pinch = null;
      return;
    }
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      down = null;
      return;
    }
    if (fromPin(e)) {
      down = null;
      return;
    }
    if (down && !down.dragged && down.button === 0) {
      // A person: go and talk. A building: walk to its door and go in. The ground: walk there.
      aimAt(e);
      const id = pickAt();
      const who = pickNpc(pickDist);
      if (who) talk(who);
      else if (id) enter(id);
      else if (ray.ray.intersectPlane(groundPlane, groundHit)) walkTo(groundHit.x, groundHit.z);
    }
    down = null;
  };
  const onCancel = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    down = null;
  };
  const onLeave = () => {
    down = null;
    pendingHover = null;
    setHover(null);
    setHoverNpc(null);
  };
  const onMenu = (e) => {
    if (!fromPin(e)) e.preventDefault();
  };
  // A tap or click in the walking view: a person talks, a building is
  // walked to and entered, the ground is walked to (unless the click is
  // meant to capture the mouse for looking around).
  ctl.on('tap', (info) => {
    if (!walkMode() || !opts.el) return false;
    aimAt(info.event);
    const id = pickAt();
    const who = pickNpc(pickDist);
    if (who) {
      talk(who);
      return true;
    }
    if (id) {
      enter(id);
      return true;
    }
    if (info.preferLook) return false;
    if (ray.ray.intersectPlane(groundPlane, groundHit)) return walkTo(groundHit.x, groundHit.z) !== false;
    return false;
  });
  if (opts.el) {
    opts.el.addEventListener('pointermove', onMove);
    opts.el.addEventListener('pointerdown', onDown);
    opts.el.addEventListener('pointerup', onUp);
    opts.el.addEventListener('pointercancel', onCancel);
    opts.el.addEventListener('pointerleave', onLeave);
    opts.el.addEventListener('contextmenu', onMenu);
  }

  // ---------- State from the career ----------
  const state = { rocket: null, building: false, flying: 0, research: false };
  let rocket = null;
  let doorOpen = 0;
  function setState(s) {
    Object.assign(state, s || {});
    if ((rocket && rocket.userData.cls) !== state.rocket) {
      if (rocket) {
        rocketSlot.remove(rocket);
        rocket.traverse((o) => o.geometry && o.geometry.dispose());
        rocket = null;
      }
      if (state.rocket) {
        rocket = makeRocket(M, state.rocket);
        rocket.userData.cls = state.rocket;
        rocketSlot.add(rocket);
      }
    }
  }

  // ---------- Camera framing ----------
  let W = 1;
  let H = 1;
  const insets = { left: 0, right: 0, top: 0, bottom: 0 };
  let dist = 250;
  function frame() {
    const aspect = W / H;
    const freeW = Math.max(1, W - insets.left - insets.right);
    const freeH = Math.max(1, H - insets.top - insets.bottom);
    // Keep the whole campus in view in the free part of the screen.
    // World width seen in the free area grows with dist * freeW / H; fit both ways.
    dist = Math.min(700, Math.max(292 * (H / freeW), 175 * (H / freeH), 220));
    // Small screens: crop tighter, the pins carry the names.
    if (W < 760) dist *= 0.95;
    if (insets.left || insets.right || insets.top || insets.bottom) {
      const dx = (insets.left - insets.right) / 2;
      const dy = (insets.top - insets.bottom) / 2;
      camera.setViewOffset(W, H, -dx, -dy, W, H);
    } else camera.clearViewOffset();
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  function setInsets(i) {
    Object.assign(insets, i || {});
    frame();
  }

  let t = 0;
  const tmpV = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const look = new THREE.Vector3(CENTER.x + 2, 8, CENTER.z - 24);
  const baseYaw = 0.3;
  const smooth01 = (k) => k * k * (3 - 2 * k);

  // The walking camera: behind and above the astronaut, out of the walls,
  // and a two-shot while you talk to someone. Writes fPos and fLook.
  function walkCamera(dt) {
    const p = me.position;
    fPos.copy(ctl.view.position);
    fLook.copy(ctl.view.target);
    talkK += ((talking ? 1 : 0) - talkK) * Math.min(1, dt * (reduced ? 30 : 3));
    if (talkK < 0.002) talkK = 0;
    const who = talkK > 0 && talkWho && crew ? crew.get(talkWho) : null;
    if (who) {
      const ux0 = who.x - p.x;
      const uz0 = who.z - p.z;
      const ul = Math.hypot(ux0, uz0) || 1;
      const ux = ux0 / ul;
      const uz = uz0 / ul;
      // To the side of the pair, a little behind you.
      const ox = uz * talkSide * 0.85 - ux * 0.5;
      const oz = -ux * talkSide * 0.85 - uz * 0.5;
      talkYaw = Math.atan2(ox, oz);
      const tp = 0.2;
      tmpDir.set(Math.sin(talkYaw) * Math.cos(tp), Math.sin(tp), Math.cos(talkYaw) * Math.cos(tp));
      tLook.set((p.x + who.x) / 2, PLAZA_Y + 1.35, (p.z + who.z) / 2);
      const td = camClear(tLook, tmpDir, W < 760 ? 6.4 : 5.4);
      tPos.copy(tLook).addScaledVector(tmpDir, td);
      // Wide screens: the pair sits left of centre, the speech card on the right.
      if (W >= 760) {
        const side = SMD.dir && SMD.dir() === 'rtl' ? -1 : 1;
        tLook.x += Math.cos(talkYaw) * 0.9 * side;
        tLook.z -= Math.sin(talkYaw) * 0.9 * side;
      }
      const k = smooth01(talkK);
      fPos.lerp(tPos, k);
      fLook.lerp(tLook, k);
    }
  }

  function update(dt) {
    t += dt;
    // The campus map: a gentle orbit; drag adds yaw. Reduced motion keeps it still.
    const drift = reduced ? 0 : Math.sin(t * 0.045) * 0.22;
    if (!down) yawUser *= 1 - Math.min(1, dt * 0.08);
    const yaw = baseYaw + drift + yawUser;
    camYaw = yaw;
    const pitch = (W < 760 ? 0.34 : 0.22) + (reduced ? 0 : Math.sin(t * 0.07) * 0.01);
    camera.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);

    // The astronaut walks, then the walking camera blends in over the map.
    updateAstro(dt);
    walkK += ((follow ? 1 : 0) - walkK) * Math.min(1, dt * (reduced ? 30 : 2.2));
    if (walkK < 0.002) walkK = 0;
    if (walkK > 0.998) walkK = 1;
    if (walkK > 0) {
      walkCamera(dt);
      const k = smooth01(walkK);
      camera.position.lerp(fPos, k);
      lookBlend.copy(look).lerp(fLook, k);
      camera.lookAt(lookBlend);
    } else camera.lookAt(look);
    // The lens: the map's long lens, the walking camera's wider one.
    const fovWant = 40 + (ctl.view.fov - 40) * smooth01(walkK);
    if (Math.abs(camera.fov - fovWant) > 0.02) {
      camera.fov = fovWant;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    ctl.syncOverlay();
    updateLife(dt);
    const wantNear = walkK > 0.02 ? 0.2 : 1;
    if (camera.near !== wantNear) {
      camera.near = wantNear;
      camera.updateProjectionMatrix();
    }

    // DSN dish: slow tracking, faster when a spacecraft is flying.
    const az = dishCode.userData.az;
    const el = dishCode.userData.el;
    const busy = state.flying > 0;
    az.rotation.y = -0.6 + Math.sin(t * (busy ? 0.11 : 0.05)) * 1.1;
    dsnSlot.rotation.y = az.rotation.y * 0.5;
    el.rotation.x = -(busy ? 0.7 : 0.95) + Math.sin(t * 0.07) * 0.12;

    // Clean room doors part while a spacecraft is in the building.
    const target = state.building ? 1 : 0;
    doorOpen += (target - doorOpen) * Math.min(1, dt * 1.5);
    const dr = clean.userData.doors;
    dr.doorL.position.x = -2.45 - doorOpen * 3.6;
    dr.doorR.position.x = 2.45 + doorOpen * 3.6;

    // Archive disc turns slowly; the observatory dome sweeps when research is on.
    archive.userData.disc.rotation.z = t * 0.4;
    const dome = lab.userData.dome;
    dome.dome.rotation.y = dome.slit.rotation.y = Math.sin(t * 0.08) * 1.4;

    palms.sway(t);

    blinkers.forEach((b) => {
      const on = (t * 0.8 + b.phase) % 1 < 0.18;
      b.s.material.opacity = on ? 1 : 0.06;
    });

    trucks.forEach((tr) => {
      const u = ((t * 0.012 + tr.off) % 1 + 1) % 1;
      const dir = routeAt(u, tr.g.position);
      tr.g.rotation.y = Math.atan2(dir.x, dir.z);
    });

    birds.forEach((b, i) => {
      const a = t * 0.06 + b.a;
      b.pos.set(-60 + Math.cos(a) * b.rad * 1.6, b.y + Math.sin(t * 0.5 + b.ph) * 1.5, -150 + Math.sin(a) * b.rad);
      flock.set(i, b.pos, -a + Math.PI, Math.sin(t * 7 + b.ph) * 0.5);
    });
    flock.done();

    // Vapour from a fuelled rocket.
    if (rocket && !reduced) {
      const h = rocket.userData.height;
      for (let k = 0; k < 2; k++) {
        tmpV.set(PAD.x + 9 + (Math.random() - 0.5) * 3, 3.4 + Math.random() * h * 0.6, PAD.z + (Math.random() - 0.5) * 3);
        tmpDir.set((Math.random() - 0.2) * 2.2, -0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 2);
        vapour.emit(tmpV, tmpDir, 2.2 + Math.random(), 0xf4ede4, 0xd8c6ae);
      }
    }
    vapour.update(dt, 0.3);

    if (pendingHover) {
      aimAt(pendingHover);
      const id = pickAt();
      const who = pickNpc(pickDist);
      setHover(who ? null : id);
      setHoverNpc(who);
      if (opts.el) opts.el.style.cursor = ctl.locked ? '' : id || who ? 'pointer' : '';
      pendingHover = null;
    }

    // Hover ring.
    const hp = picks.find((p) => p.id === hover);
    const ringTarget = hp ? 0.95 : 0;
    ring.material.opacity += (ringTarget - ring.material.opacity) * Math.min(1, dt * 10);
    if (hp) {
      ring.position.x = hp.box.getCenter(tmpV).x;
      ring.position.z = tmpV.z;
      const s = hp.radius * (1 + Math.sin(t * 3) * 0.02);
      ring.scale.set(s, s, 1);
    }

    // Pins follow their buildings on screen (over the doors while walking).
    pinBlend = walkK > 0.5 ? 1 : 0;
    if (layer && W > 1) {
      picks.forEach((p) => {
        const b = pins[p.id];
        if (!b) return;
        tmpV.copy(pinBlend && doorPin[p.id] ? doorPin[p.id] : p.anchor).project(camera);
        const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05;
        const x = ((tmpV.x + 1) / 2) * W;
        const y = ((1 - tmpV.y) / 2) * H;
        b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        b.classList.toggle('is-off', !vis);
        // Keep the label inside the stage; the dot stays on the building.
        if (!b._w) b._w = (b.firstElementChild && b.firstElementChild.nextElementSibling && b.firstElementChild.nextElementSibling.offsetWidth) || 0;
        const half = b._w / 2 + 6;
        const dx = x - half < 0 ? half - x : x + half > W ? W - half - x : 0;
        if (b._dx !== dx) {
          b._dx = dx;
          b.style.setProperty('--dx', `${dx.toFixed(0)}px`);
        }
      });
      // Staff: name tags up close, the "!" marker from anywhere, the E prompt when near.
      if (crew) {
        crew.people.forEach((p) => {
          const b = tags[p.id];
          if (!b) return;
          crew.headTop(p, tmpV);
          const dCam = camera.position.distanceTo(tmpV);
          tmpV.project(camera);
          const onScreen = tmpV.z < 1 && Math.abs(tmpV.x) < 1.02 && Math.abs(tmpV.y) < 1.02;
          const walkView = walkK > 0.5;
          const showTag = walkView && dCam < 34 && talking !== p.id;
          const showAlert = p.alert && talking !== p.id;
          const st = onScreen && (showTag || showAlert) ? (showTag ? (nearId === p.id ? 'near' : 'tag') : 'far') : 'off';
          if (b._st !== st) {
            b._st = st;
            b.classList.toggle('is-off', st === 'off');
            b.classList.toggle('is-far', st === 'far');
            b.classList.toggle('is-near', st === 'near');
          }
          b.classList.toggle('has-alert', !!p.alert);
          if (st !== 'off') b.style.transform = `translate(${(((tmpV.x + 1) / 2) * W).toFixed(1)}px, ${(((1 - tmpV.y) / 2) * H).toFixed(1)}px)`;
        });
      }
    }
    // The name tag over the astronaut, while the camera is far away.
    if (meTag && W > 1) {
      tmpV.copy(me.position);
      tmpV.y += 2.3;
      tmpV.project(camera);
      const vis = walkK < 0.55 && tmpV.z < 1 && Math.abs(tmpV.x) < 1.02 && Math.abs(tmpV.y) < 1.02;
      meTag.style.transform = `translate(${(((tmpV.x + 1) / 2) * W).toFixed(1)}px, ${(((1 - tmpV.y) / 2) * H).toFixed(1)}px)`;
      meTag.classList.toggle('is-off', !vis);
    }
  }

  return {
    scene,
    camera,
    shadows: true,
    exposure: 1.02,
    update,
    onResize(w, h) {
      W = w;
      H = h;
      frame();
    },
    setState,
    setInsets,
    setLabels,
    setHover,
    // The view: walking (third person) or the campus map. setFollow(true) walks.
    setFollow(on) {
      setFollow(on, true);
    },
    get follow() {
      return follow;
    },
    get view() {
      return follow ? 'walk' : 'map';
    },
    setView(v) {
      setFollow(v !== 'map', true);
    },
    react,
    setAvatar(a) {
      astro.setAppearance(a || (SMD.avatar ? SMD.avatar.get() : {}));
      setTagName(astro.appearance);
    },
    // For tests and scripts: where the astronaut is and whether it is walking.
    get astronaut() {
      return { x: me.position.x, z: me.position.z, walking: !!route || ctlMoving(), follow, view: follow ? 'walk' : 'map', walkK, doors, near: nearId, talking, target: ctl.state.target ? ctl.state.target.id : null };
    },
    // The shared character controller (docs/CONTROLS.md), for scripts.
    get controller() {
      return ctl;
    },
    walkTo,
    enter,
    // The staff: talk(id) walks up to someone and starts the conversation
    // (onTalk fires); endTalk() lets them go back to work.
    talk,
    endTalk() {
      endTalk(true);
    },
    get talking() {
      return talking;
    },
    get staff() {
      return crew ? crew.people.map((p) => ({ id: p.id, x: p.x, z: p.z, alert: p.alert, near: nearId === p.id })) : [];
    },
    setStaffLabels,
    // { id: true } puts the "!" marker over whoever has news for you.
    setStaffState(alerts) {
      if (!crew) return;
      crew.people.forEach((p) => crew.setAlert(p.id, !!(alerts && alerts[p.id])));
    },
    staffPortrait(id) {
      const def = staffDefs.find((d) => d.id === id);
      return def ? staffPortrait(def, 112) : null;
    },
    dispose() {
      disposed = true;
      if (!lastSpot || Math.hypot(lastSpot.x - me.position.x, lastSpot.z - me.position.z) > 0.5) lastSpot = { x: me.position.x, z: me.position.z, ry: me.rotation.y, door: null };
      lastSpot.camYaw = ctl.camYaw;
      window.removeEventListener('keydown', onKeyDown);
      ctl.dispose();
      if (opts.el) opts.el.removeEventListener('wheel', onWheel);
      if (meTag) meTag.remove();
      if (fadeEl) fadeEl.remove();
      Object.values(tags).forEach((b) => b.remove());
      astro.dispose();
      if (crew) crew.dispose();
      if (opts.el) {
        opts.el.removeEventListener('pointermove', onMove);
        opts.el.removeEventListener('pointerdown', onDown);
        opts.el.removeEventListener('pointerup', onUp);
        opts.el.removeEventListener('pointercancel', onCancel);
        opts.el.removeEventListener('pointerleave', onLeave);
        opts.el.removeEventListener('contextmenu', onMenu);
        opts.el.style.cursor = '';
      }
      Object.values(pins).forEach((b) => b.remove());
      lightTex.dispose();
    },
  };
}
