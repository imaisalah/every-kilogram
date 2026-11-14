// Campus staff: light, stylised people for the HQ (office clothes, not
// spacesuits). Each person is six meshes (torso, head, two arms, two legs)
// that all share ONE vertex-coloured Lambert material, about 2k triangles.
// Far from the camera they swap to one instanced figure for the whole crew
// (a single draw call), and their contact shadows are one instanced mesh too.
//
//   const crew = createStaff(SMD.content.staff, { routes: { id: [{x,z},...] } });
//   scene.add(crew.group);  ...  crew.update(dt, { cam, player, t }) every frame
import { THREE } from './engine.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const HIP_Y = 0.88;
const WALK_SPEED = 1.05; // m/s, an unhurried stroll
const NEAR_LOD = 95; // metres: full figure inside, instanced figure outside
const tmpC = new THREE.Color();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- Geometry: vertex-coloured parts merged per joint ----------
function painted(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  ['uv', 'uv1', 'uv2'].forEach((k) => g.attributes[k] && g.deleteAttribute(k));
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  tmpC.set(color);
  for (let i = 0; i < n; i++) c.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function parts() {
  const list = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      geo.applyMatrix4(m4.compose(p.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(sx, sy, sz)));
      list.push(painted(geo, color));
    },
    mesh(material) {
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (list.length > 1) list.forEach((x) => x.dispose());
      list.length = 0;
      return new THREE.Mesh(g, material);
    },
  };
}

const lathe = (pts, n, phiStart = 0, phiLength = TAU) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n, phiStart, phiLength);
const shade = (hex, k) => '#' + tmpC.set(hex).multiplyScalar(k).getHexString();

// ---------- One person ----------
function buildPerson(def, material) {
  const L = Object.assign({ skin: '#b07a55', hair: 'short', hairColor: '#221a16', shirt: '#2c4a72', pants: '#2b2f36', shoes: '#26211e' }, def.look || {});
  const root = new THREE.Group();
  root.name = `staff-${def.id}`;
  const body = new THREE.Group();
  body.scale.setScalar(L.height || 1);
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = HIP_Y;
  body.add(hips);
  const B = L.build || 1;
  const coat = L.coat || null;
  const sleeve = coat || L.shirt;

  // Torso: pelvis, chest, neck, and whatever they wear over the shirt.
  {
    const b = parts();
    b.add(lathe([[0, -0.13], [0.15, -0.12], [0.168, -0.03], [0.163, 0.05], [0, 0.06]], 12), L.pants, 0, 0, 0, 0, 0, 0, B, 1, 0.78);
    b.add(new THREE.CylinderGeometry(0.166, 0.166, 0.035, 12, 1, true), shade(L.pants, 0.55), 0, 0.045, 0, 0, 0, 0, B, 1, 0.78);
    b.add(lathe([[0, 0.03], [0.162, 0.04], [0.156, 0.14], [0.168, 0.26], [0.19, 0.38], [0.195, 0.43], [0.165, 0.49], [0.08, 0.525], [0, 0.53]], 12), L.shirt, 0, 0, 0, 0, 0, 0, B, 1, 0.74);
    b.add(new THREE.CylinderGeometry(0.047, 0.052, 0.12, 8, 1, true), L.skin, 0, 0.56, 0);
    if (coat) {
      // An open lab coat: a longer shell with a gap at the front.
      b.add(lathe([[0.19, -0.42], [0.185, -0.2], [0.175, 0.0], [0.176, 0.2], [0.2, 0.38], [0.205, 0.43], [0.172, 0.5], [0.1, 0.53]], 12, 0.42, TAU - 0.84), coat, 0, 0, 0, 0, 0, 0, B, 1, 0.78);
      b.add(new THREE.BoxGeometry(0.035, 0.14, 0.01), shade(coat, 0.86), 0.09, 0.3, 0.155, -0.15, 0, 0);
    }
    if (L.vest) b.add(lathe([[0.172, 0.0], [0.17, 0.14], [0.18, 0.26], [0.2, 0.38], [0.2, 0.44], [0.16, 0.5]], 12, 0.36, TAU - 0.72), L.vest, 0, 0, 0, 0, 0, 0, B, 1, 0.77);
    if (L.tie) b.add(new THREE.BoxGeometry(0.05, 0.27, 0.012), L.tie, 0, 0.32, 0.142, -0.12, 0, 0);
    // Agency badge on a lanyard (everyone wears one).
    b.add(new THREE.BoxGeometry(0.05, 0.068, 0.01), '#f4f1e8', -0.075, 0.27, 0.137 * (L.vest || coat ? 1.06 : 1), -0.1, 0, 0);
    b.add(new THREE.BoxGeometry(0.04, 0.016, 0.012), '#17807a', -0.075, 0.293, 0.142 * (L.vest || coat ? 1.06 : 1), -0.1, 0, 0);
    if (L.backpack) {
      b.add(new THREE.BoxGeometry(0.27, 0.33, 0.13), L.backpack, 0, 0.27, -0.185, 0.05, 0, 0);
      b.add(new THREE.BoxGeometry(0.2, 0.12, 0.04), shade(L.backpack, 0.75), 0, 0.2, -0.26, 0.05, 0, 0);
    }
    if (L.headset) b.add(new THREE.BoxGeometry(0.06, 0.09, 0.03), '#2a2c30', 0.13, 0.03, 0.1);
    hips.add(b.mesh(material));
  }

  // Head: face, hair, hats, glasses, headset.
  const head = new THREE.Group();
  head.position.y = 0.6;
  hips.add(head);
  {
    const b = parts();
    const hy = 0.12;
    const r = 0.118;
    b.add(new THREE.SphereGeometry(r, 14, 10), L.skin, 0, hy, 0, 0, 0, 0, 0.94, 1.05, 1);
    b.add(new THREE.SphereGeometry(0.021, 6, 4), shade(L.skin, 0.9), 0, hy - 0.01, 0.112, 0, 0, 0, 1, 1.1, 1);
    b.add(new THREE.SphereGeometry(0.025, 6, 4), L.skin, 0.111, hy - 0.004, 0, 0, 0, 0, 0.5, 1, 0.8);
    b.add(new THREE.SphereGeometry(0.025, 6, 4), L.skin, -0.111, hy - 0.004, 0, 0, 0, 0, 0.5, 1, 0.8);
    [-1, 1].forEach((s) => {
      b.add(new THREE.SphereGeometry(0.017, 6, 4), '#1d1a18', s * 0.041, hy + 0.018, 0.1);
      b.add(new THREE.BoxGeometry(0.042, 0.011, 0.012), L.hair === 'covered' ? '#2a211c' : L.hairColor, s * 0.042, hy + 0.05, 0.104, 0, 0, s * -0.08);
    });
    b.add(new THREE.SphereGeometry(0.024, 8, 4), '#7a3b32', 0, hy - 0.05, 0.1, -0.2, 0, 0, 1.55, 0.42, 0.5);
    const H = L.hairColor;
    const cap = (k = 1.065, theta = Math.PI * 0.52, tilt = -0.5) => b.add(new THREE.SphereGeometry(r * k, 14, 6, 0, TAU, 0, theta), H, 0, hy + 0.008, -0.008, tilt, 0, 0, 0.96, 1.06, 1.04);
    if (L.hair === 'short') {
      cap();
      b.add(new THREE.SphereGeometry(r * 0.82, 10, 5, 0, TAU, 0, Math.PI * 0.5), H, 0, hy + 0.055, -0.01, -0.25, 0, 0, 1.08, 0.85, 1.1);
    } else if (L.hair === 'bun') {
      cap();
      b.add(new THREE.SphereGeometry(0.056, 10, 6), H, 0, hy + 0.1, -0.085);
    } else if (L.hair === 'long') {
      cap(1.07, Math.PI * 0.55, -0.42);
      b.add(new THREE.SphereGeometry(r, 10, 8), H, 0, hy - 0.06, -0.05, 0.12, 0, 0, 1.04, 1.45, 0.55);
      b.add(new THREE.SphereGeometry(r * 0.7, 8, 4, 0, TAU, 0, Math.PI * 0.5), H, 0.02, hy + 0.07, 0.06, 0.95, 0.25, -0.3, 1.2, 0.5, 0.9);
    } else if (L.hair === 'curly') {
      cap(1.06, Math.PI * 0.5, -0.45);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        const up = i % 2 ? 0.55 : 0.95;
        const x = Math.sin(a) * r * Math.sin(up);
        const z = Math.cos(a) * r * Math.sin(up) - 0.015;
        const y = hy + r * Math.cos(up) * 0.95 + 0.01;
        if (z > 0.06 && y < hy + 0.07) continue;
        b.add(new THREE.SphereGeometry(0.042, 6, 4), H, x, y, z);
      }
    } else if (L.hair === 'covered') {
      // Headscarf: wraps the head and neck, leaves the face open.
      const S = L.scarf || '#17807a';
      const R = r * 1.1;
      const w = 0.92;
      b.add(new THREE.SphereGeometry(R, 14, 3, 0, TAU, 0, Math.PI * 0.26), S, 0, hy + 0.006, -0.006);
      b.add(new THREE.SphereGeometry(R, 14, 7, Math.PI / 2 + w, TAU - 2 * w, Math.PI * 0.26, Math.PI * 0.72), S, 0, hy + 0.006, -0.006);
      b.add(new THREE.SphereGeometry(R, 8, 2, Math.PI / 2 - w - 0.02, 2 * w + 0.04, Math.PI * 0.74, Math.PI * 0.22), S, 0, hy + 0.006, -0.006);
      b.add(lathe([[0.175, -0.12], [0.15, -0.07], [0.12, -0.01], [0.105, 0.04]], 12), S, 0, 0, -0.005, 0, 0, 0, 1.08, 1, 0.92);
    }
    if (L.beard) b.add(new THREE.SphereGeometry(r * 1.02, 12, 5, Math.PI / 2 - 1.05, 2.1, Math.PI * 0.6, Math.PI * 0.3), H, 0, hy, 0, 0, 0, 0, 0.96, 1.05, 1.02);
    if (L.hat === 'hardhat') {
      b.add(new THREE.SphereGeometry(0.132, 14, 6, 0, TAU, 0, Math.PI * 0.5), '#f0b92b', 0, hy + 0.03, -0.004, 0, 0, 0, 1, 0.92, 1.08);
      b.add(new THREE.CylinderGeometry(0.158, 0.158, 0.012, 16), '#e2a91f', 0, hy + 0.035, 0.012, 0, 0, 0, 1, 1, 1.12);
      b.add(new THREE.BoxGeometry(0.02, 0.03, 0.2), '#e2a91f', 0, hy + 0.14, 0, 0, 0, 0);
    } else if (L.hat === 'cap') {
      const C = L.capColor || '#17807a';
      b.add(new THREE.SphereGeometry(0.126, 14, 5, 0, TAU, 0, Math.PI * 0.46), C, 0, hy + 0.024, -0.004, -0.12, 0, 0);
      b.add(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 12, 1, false, -Math.PI / 2, Math.PI), C, 0, hy + 0.06, 0.1, 0.18, 0, 0, 1, 1, 1.25);
    }
    if (L.glasses) {
      [-1, 1].forEach((s) => b.add(new THREE.TorusGeometry(0.029, 0.0055, 4, 12), '#262423', s * 0.042, hy + 0.018, 0.112));
      b.add(new THREE.BoxGeometry(0.03, 0.006, 0.006), '#262423', 0, hy + 0.024, 0.116);
    }
    if (L.headset) {
      b.add(new THREE.TorusGeometry(0.127, 0.009, 4, 14, Math.PI), '#2a2c30', 0, hy + 0.01, -0.01);
      [-1, 1].forEach((s) => b.add(new THREE.SphereGeometry(0.036, 8, 5), '#2a2c30', s * 0.118, hy - 0.005, 0, 0, 0, 0, 0.55, 1, 1));
      b.add(new THREE.BoxGeometry(0.008, 0.008, 0.1), '#2a2c30', 0.1, hy - 0.05, 0.06, 0, -0.55, 0);
    }
    head.add(b.mesh(material));
  }

  // Arms hang from the shoulders (one rigid limb each); the right hand holds a prop.
  const arm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.2 * B, 0.45, -0.005);
    hips.add(sh);
    const b = parts();
    b.add(new THREE.SphereGeometry(0.066, 8, 6), sleeve, 0, -0.01, 0);
    const shortSleeve = !coat && L.sleeve === 'short';
    if (shortSleeve) {
      b.add(lathe([[0.06, -0.2], [0.066, -0.1], [0.064, 0.0]], 8), sleeve, 0, 0, 0);
      b.add(lathe([[0.042, -0.52], [0.048, -0.36], [0.052, -0.2]], 8), L.skin, 0, 0, 0);
    } else b.add(lathe([[0.046, -0.52], [0.05, -0.42], [0.056, -0.2], [0.064, -0.05], [0.06, 0.0]], 8), sleeve, 0, 0, 0);
    b.add(new THREE.SphereGeometry(0.048, 8, 6), L.skin, 0, -0.56, 0.008, 0, 0, 0, 0.85, 1.1, 0.9);
    if (side < 0 && L.prop === 'tablet') {
      b.add(new THREE.BoxGeometry(0.17, 0.012, 0.23), '#22262b', 0, -0.6, 0.1, 0.2, 0, 0);
      b.add(new THREE.BoxGeometry(0.15, 0.004, 0.2), '#5fb6c9', 0, -0.592, 0.1, 0.2, 0, 0);
    } else if (side < 0 && L.prop === 'clipboard') {
      b.add(new THREE.BoxGeometry(0.2, 0.012, 0.27), '#8a6440', 0, -0.6, 0.1, 0.25, 0, 0);
      b.add(new THREE.BoxGeometry(0.17, 0.004, 0.22), '#f6f3ea', 0, -0.592, 0.11, 0.25, 0, 0);
    } else if (side < 0 && L.prop === 'camera') {
      b.add(new THREE.BoxGeometry(0.13, 0.085, 0.07), '#25272b', 0, -0.62, 0.05);
      b.add(new THREE.CylinderGeometry(0.03, 0.033, 0.06, 10), '#121314', 0, -0.62, 0.11, Math.PI / 2, 0, 0);
    }
    const m = b.mesh(material);
    sh.add(m);
    return sh;
  };
  const shL = arm(1);
  const shR = arm(-1);

  const leg = (side) => {
    const hp = new THREE.Group();
    hp.position.set(side * 0.088 * B, -0.02, 0);
    hips.add(hp);
    const b = parts();
    b.add(lathe([[0.052, -0.82], [0.058, -0.6], [0.068, -0.3], [0.075, -0.05], [0.07, 0.04]], 8), L.pants, 0, 0, 0);
    b.add(new THREE.BoxGeometry(0.105, 0.07, 0.235), L.shoes, side * 0.004, -0.83, 0.035);
    hp.add(b.mesh(material));
    return hp;
  };
  const hipL = leg(1);
  const hipR = leg(-1);

  return { root, body, hips, head, shL, shR, hipL, hipR, holds: !!L.prop, height: 1.72 * (L.height || 1) };
}

// ---------- Far figure and contact shadows (shared by the crew) ----------
function farGeometry() {
  const b = parts();
  b.add(new THREE.CapsuleGeometry(0.19, 0.95, 2, 8), '#ffffff', 0, 0.68, 0, 0, 0, 0, 1, 1, 0.75);
  b.add(new THREE.SphereGeometry(0.13, 8, 6), '#e6c4a6', 0, 1.6, 0);
  const g = b.mesh(null).geometry;
  return g;
}

let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  blobTex.userData.keep = true;
  return blobTex;
}

// defs: SMD.content.staff. opts: { routes: { id: [{x, z}, ...] } (world points;
// the first is home), groundY, reduced, nearLod (metres, full figures inside) }
export function createStaff(defs, opts = {}) {
  const reduced = !!opts.reduced;
  const nearLod = opts.nearLod || NEAR_LOD;
  const groundY = opts.groundY || 0;
  const group = new THREE.Group();
  group.name = 'staff';
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const people = [];

  const N = defs.length;
  const far = new THREE.InstancedMesh(farGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), Math.max(1, N));
  far.frustumCulled = false;
  group.add(far);
  const blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }), Math.max(1, N));
  blobs.frustumCulled = false;
  blobs.renderOrder = 1;
  group.add(blobs);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  const v = new THREE.Vector3();

  defs.forEach((def, i) => {
    const P = buildPerson(def, material);
    const route = ((opts.routes && opts.routes[def.id]) || []).slice();
    const home = route[0] || { x: 0, z: 0 };
    P.root.position.set(home.x, groundY, home.z);
    P.root.rotation.y = (i * 2.1) % TAU;
    group.add(P.root);
    tmpC.set((def.look && def.look.vest) || (def.look && def.look.coat) || (def.look && def.look.shirt) || '#888888');
    far.setColorAt(i, tmpC);
    people.push({
      id: def.id,
      def,
      P,
      route,
      leg: route.length > 1 ? 1 : 0,
      wait: 1.5 + i * 1.3,
      speed: 0,
      phase: Math.random() * TAU,
      headYaw: 0,
      lookAt: null,
      talking: false,
      held: false, // stopped where they are (someone is coming to talk)
      faceTo: null,
      gesture: null, // { name, t, dur }
      alert: false,
      waved: false,
      near: true,
      t: Math.random() * 10,
      get x() {
        return P.root.position.x;
      },
      get z() {
        return P.root.position.z;
      },
    });
  });
  if (far.instanceColor) far.instanceColor.needsUpdate = true;

  function animate(p, dt) {
    const P = p.P;
    const s = p.speed;
    p.t += dt;
    if (s > 0.01) p.phase += dt * 6.2 * s;
    const sw = Math.sin(p.phase);
    const idle = reduced ? 0 : Math.sin(p.t * 1.6);
    P.hips.position.y = HIP_Y + s * (Math.abs(Math.cos(p.phase)) * 0.028 - 0.014);
    P.hips.rotation.y = sw * 0.06 * s;
    P.hipL.rotation.x = -sw * 0.5 * s;
    P.hipR.rotation.x = sw * 0.5 * s;
    const hold = P.holds ? -0.55 : 0;
    let lx = sw * 0.42 * s + 0.02 * idle * (1 - s);
    let rx = -sw * 0.42 * s * (P.holds ? 0.3 : 1) + hold * (1 - s * 0.4);
    let lz = 0.09;
    let rz = -0.09;
    let headX = -0.01 * idle;
    // Gestures: a wave, or hands that move while they talk.
    const g = p.gesture;
    if (g) {
      g.t += dt;
      const k = Math.min(1, g.t / 0.25, (g.dur - g.t) / 0.3);
      if (g.name === 'wave') {
        rz = rz + (-2.5 + Math.sin(g.t * 11) * 0.3 - rz) * k;
        rx = rx + (-0.2 - rx) * k;
      }
      if (g.t >= g.dur) p.gesture = null;
    } else if (p.talking && !reduced) {
      lx += -0.35 + Math.sin(p.t * 2.7) * 0.18;
      lz += 0.12 + Math.sin(p.t * 1.9) * 0.08;
      if (!P.holds) rx += -0.3 + Math.sin(p.t * 2.3 + 1) * 0.15;
      headX += Math.sin(p.t * 3.1) * 0.05;
    }
    P.shL.rotation.set(lx, 0, lz);
    P.shR.rotation.set(rx, 0, rz);
    // Head: toward what they look at, else a slow glance around.
    let want = reduced ? 0 : Math.sin(p.t * 0.31) * Math.sin(p.t * 0.17) * 0.6 * (1 - s);
    if (p.lookAt) {
      P.root.updateMatrixWorld();
      v.set(p.lookAt.x, groundY, p.lookAt.z);
      P.root.worldToLocal(v);
      want = clamp(Math.atan2(v.x, v.z), -1.1, 1.1);
    }
    p.headYaw += (want - p.headYaw) * Math.min(1, dt * 4);
    P.head.rotation.set(headX, p.headYaw, 0);
  }

  function steer(p, dt, ctx) {
    const pos = p.P.root.position;
    const pl = ctx.player;
    const dPl = pl ? Math.hypot(pl.x - pos.x, pl.z - pos.z) : Infinity;
    // Someone is near: stop and look at them; turn to them while talking.
    p.lookAt = dPl < 7 ? pl : null;
    let move = 0;
    let face = null;
    if ((p.talking || p.held) && pl) face = dPl > 0.3 ? Math.atan2(pl.x - pos.x, pl.z - pos.z) : null;
    else if (p.faceTo) face = Math.atan2(p.faceTo.x - pos.x, p.faceTo.z - pos.z);
    else if (dPl < 2.6) {
      // Polite: wait for the player to pass.
    } else if (p.route.length > 1) {
      if (p.wait > 0) p.wait -= dt;
      else {
        const tgt = p.route[p.leg];
        const dx = tgt.x - pos.x;
        const dz = tgt.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) {
          p.leg = (p.leg + 1) % p.route.length;
          p.wait = 3 + Math.random() * 5;
        } else {
          face = Math.atan2(dx, dz);
          move = Math.min(1, d / 0.8 + 0.3);
        }
      }
    }
    if (face !== null) {
      const diff = wrap(face - p.P.root.rotation.y);
      p.P.root.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), dt * 4.5);
      move *= Math.max(0, Math.cos(diff)) ** 2;
    }
    p.speed += (move - p.speed) * Math.min(1, dt * 5);
    if (p.speed < 0.004 && move === 0) p.speed = 0;
    if (p.speed > 0) {
      const step = p.speed * WALK_SPEED * dt;
      pos.x += Math.sin(p.P.root.rotation.y) * step;
      pos.z += Math.cos(p.P.root.rotation.y) * step;
    }
    // A wave when the player first comes close while they have news for you.
    if (p.alert && !p.waved && dPl < 14 && !p.talking) {
      p.waved = true;
      p.gesture = { name: 'wave', t: 0, dur: 2 };
    }
    if (!p.alert) p.waved = false;
  }

  // ctx: { cam: Vector3, player: {x, z} | null, t }
  function update(dt, ctx = {}) {
    dt = Math.min(dt || 0, 0.1);
    let farDirty = false;
    people.forEach((p, i) => {
      steer(p, dt, ctx);
      const pos = p.P.root.position;
      const dCam = ctx.cam ? ctx.cam.distanceTo(pos) : 0;
      const near = dCam < nearLod;
      if (near) animate(p, dt);
      if (near !== p.near) {
        p.near = near;
        p.P.root.visible = near;
      }
      // The far figure stands in for the person when it is far away.
      if (near) m4.compose(pos, q.identity(), zero);
      else m4.compose(pos, q.setFromAxisAngle(up, p.P.root.rotation.y), v.set(1, 1, 1).multiplyScalar(p.P.body.scale.y));
      far.setMatrixAt(i, m4);
      farDirty = true;
      m4.compose(v.set(pos.x, groundY + 0.012, pos.z), q.identity(), one);
      blobs.setMatrixAt(i, m4);
    });
    if (farDirty) far.instanceMatrix.needsUpdate = true;
    blobs.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    people,
    get(id) {
      return people.find((p) => p.id === id) || null;
    },
    // Head-top position in world space (labels and markers).
    headTop(p, out) {
      return out.set(p.P.root.position.x, groundY + p.P.height + 0.12, p.P.root.position.z);
    },
    talk(id, on) {
      people.forEach((p) => {
        p.talking = on && p.id === id;
        if (p.talking) p.gesture = null;
      });
    },
    wave(id) {
      const p = people.find((x) => x.id === id);
      if (p) p.gesture = { name: 'wave', t: 0, dur: 2 };
    },
    hold(id, on) {
      const p = people.find((x) => x.id === id);
      if (!p) return;
      p.held = !!on;
      if (!on) p.wait = Math.max(p.wait, 2);
    },
    setAlert(id, on) {
      const p = people.find((x) => x.id === id);
      if (p) p.alert = !!on;
    },
    update,
    triangles() {
      let n = 0;
      people.forEach((p) => p.P.root.traverse((o) => o.isMesh && (n += o.geometry.attributes.position.count / 3)));
      return Math.round(n);
    },
    dispose() {
      material.dispose();
    },
  };
}

// ---------- A small painted portrait for the speech card ----------
const portraitCache = new Map();
export function staffPortrait(def, size = 96) {
  const key = `${def.id}|${size}`;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const L = Object.assign({ skin: '#b07a55', hair: 'short', hairColor: '#221a16', shirt: '#2c4a72' }, def.look || {});
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size / 100;
  g.scale(s, s);
  const bg = g.createRadialGradient(50, 38, 6, 50, 50, 60);
  bg.addColorStop(0, '#fdf6e3');
  bg.addColorStop(1, '#d9c79c');
  g.fillStyle = bg;
  g.beginPath();
  g.arc(50, 50, 50, 0, TAU);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(50, 50, 50, 0, TAU);
  g.clip();
  const ell = (x, y, rx, ry, col) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
  };
  // Shoulders and clothes.
  ell(50, 104, 40, 30, L.coat || L.vest || L.shirt);
  if (L.coat || L.vest) {
    g.fillStyle = L.shirt;
    g.beginPath();
    g.moveTo(42, 78);
    g.lineTo(58, 78);
    g.lineTo(54, 100);
    g.lineTo(46, 100);
    g.fill();
  }
  if (L.tie) {
    g.fillStyle = L.tie;
    g.fillRect(47.5, 78, 5, 22);
  }
  if (L.hair === 'long') ell(50, 56, 26, 30, L.hairColor);
  if (L.hair === 'covered') ell(50, 58, 28, 32, L.scarf || '#17807a');
  g.fillStyle = L.skin;
  g.fillRect(44, 62, 12, 16);
  ell(50, 48, 19, 22, L.skin);
  // Hair and hats.
  if (L.hair === 'covered') {
    g.fillStyle = L.scarf || '#17807a';
    g.beginPath();
    g.ellipse(50, 46, 26, 28, 0, Math.PI * 1.0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(50, 50, 26, 30, 0, 0, TAU);
    g.ellipse(50, 51, 17, 19, 0, 0, TAU, true);
    g.fill('evenodd');
  } else if (L.hair !== 'none') {
    g.fillStyle = L.hairColor;
    g.beginPath();
    g.ellipse(50, 41, 20.5, 17, 0, Math.PI * 0.98, Math.PI * 2.02);
    g.fill();
    if (L.hair === 'bun') ell(50, 22, 8, 7, L.hairColor);
    if (L.hair === 'curly') for (let i = 0; i < 7; i++) ell(32 + i * 6, 30 + Math.abs(3 - i) * 1.6, 5.5, 5.5, L.hairColor);
  }
  if (L.beard) {
    g.fillStyle = L.hairColor;
    g.beginPath();
    g.ellipse(50, 54, 18, 16, 0, Math.PI * 0.05, Math.PI * 0.95);
    g.fill();
    ell(50, 62, 4, 2, L.skin);
  }
  if (L.hat === 'hardhat') {
    g.fillStyle = '#f0b92b';
    g.beginPath();
    g.ellipse(50, 37, 23, 18, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillRect(24, 35, 52, 4);
  } else if (L.hat === 'cap') {
    g.fillStyle = L.capColor || '#17807a';
    g.beginPath();
    g.ellipse(50, 37, 21, 16, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillRect(48, 34, 26, 4);
  }
  // Face.
  ell(43, 49, 2.2, 2.6, '#1d1a18');
  ell(57, 49, 2.2, 2.6, '#1d1a18');
  g.strokeStyle = '#7a3b32';
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(50, 56, 6, Math.PI * 0.2, Math.PI * 0.8);
  g.stroke();
  if (L.glasses) {
    g.strokeStyle = '#262423';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(43, 49, 5, 0, TAU);
    g.moveTo(62, 49);
    g.arc(57, 49, 5, 0, TAU);
    g.moveTo(48, 48);
    g.lineTo(52, 48);
    g.stroke();
  }
  if (L.headset) {
    g.strokeStyle = '#2a2c30';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(50, 47, 22, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    ell(29, 50, 3.5, 6, '#2a2c30');
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(30, 55);
    g.quadraticCurveTo(34, 64, 43, 63);
    g.stroke();
  }
  g.restore();
  const url = c.toDataURL('image/png');
  portraitCache.set(key, url);
  return url;
}
