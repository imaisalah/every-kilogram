// Ground, sky and surroundings for the pad set: the wet concrete apron, the
// crew walkway and parking, fuel lines on their rack, light poles and xenon
// flood towers, fences, the far lightning masts, water tower and propellant
// spheres, the sea with distant shore lights, the sky with stars and the Moon.
import { THREE, canvasTex, lightBeam, softDot, rng } from './common.js';
import { std, basic, lamp, boxUV, concreteMaps, signTex, font, noise2, fbm, pixelTex, PadBuilder as Builder, realOf, FOG, SCATTER_GLSL, scatterUniforms } from './pad-kit.js';
import { signPlane } from './pad-signs.js';
import { strut } from './pad-rocket.js';

export const G = {
  // Walk: parking -> north along the walkway -> west past the mount -> tower.
  walkA: { x0: 11.5, x1: 17.5, z0: 11.5, z1: 80 },
  walkB: { x0: -21, x1: 17.5, z0: 11.8, z1: 17.6 },
  parking: { x0: 9, x1: 46, z0: 78, z1: 102 },
  rackX: 22,
  bounds: { minX: -33, maxX: 46, minZ: -14, maxZ: 101 },
};

// ---------- Sky ----------
const SKY_V = /* glsl */ `
  varying vec3 vDir;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;
const SKY_F = /* glsl */ `
  uniform vec3 moonDir;
  uniform vec3 horizon;
  uniform vec3 zenith;
  uniform vec3 glow;
  uniform float stars;
  varying vec3 vDir;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  float h31(vec3 p) { p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
  void main() {
    #include <logdepthbuf_fragment>
    vec3 d = normalize(vDir);
    float h = d.y;
    float up = clamp(h, 0.0, 1.0);
    vec3 col = mix(horizon, zenith, pow(up, 0.42));
    // Light pollution: warm toward the towns in the south and west, low.
    vec2 hz = normalize(d.xz + 1e-5);
    float town = 0.5 + 0.5 * dot(hz, normalize(vec2(-0.45, 0.9)));
    col += glow * exp(-max(h, 0.0) * 9.0) * (0.35 + town * town);
    // Moon halo.
    float md = max(dot(d, moonDir), 0.0);
    col += vec3(0.05, 0.065, 0.085) * pow(md, 60.0) + vec3(0.012, 0.018, 0.026) * pow(md, 7.0);
    // Stars, dimmed by the haze toward the horizon.
    vec3 p = d * 520.0;
    vec3 c = floor(p);
    float r = h31(c);
    if (r > 0.9965) {
      vec3 sp = c + vec3(h31(c + 1.7), h31(c + 3.1), h31(c + 5.3));
      float dd = length(p - sp);
      float tw = 0.6 + 0.4 * sin(r * 900.0);
      col += vec3(0.75, 0.82, 1.0) * stars * smoothstep(0.45, 0.0, dd) * tw * pow(fract(r * 313.0), 2.0) * smoothstep(0.06, 0.45, h) * (1.0 - pow(md, 4.0));
    }
    col += hfScatter(cameraPosition, d, 1500.0) * 0.5;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function buildSky(o = {}) {
  const group = new THREE.Group();
  group.name = 'sky';
  const moonDir = o.moonDir.clone().normalize();
  const mat = new THREE.ShaderMaterial({
    uniforms: scatterUniforms({
      moonDir: { value: moonDir },
      horizon: { value: new THREE.Color(o.horizon || 0x1b2632) },
      zenith: { value: new THREE.Color(0x020409) },
      glow: { value: new THREE.Color(0x2a2116) },
      stars: { value: o.low ? 1.6 : 2.2 },
    }),
    vertexShader: SKY_V,
    fragmentShader: '#define HF_N ' + FOG.n + '\n' + SCATTER_GLSL + SKY_F,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.userData.noAO = true;
  group.add(dome);
  // The Moon: a lit sphere (NASA LRO map when it loads), low in the north.
  const mr = 22;
  const moonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdfe3e8).multiplyScalar(1.25), fog: false, depthWrite: false });
  const fallback = pixelTex(256, 128, (u, v) => {
    const n = noise2(91);
    const k = fbm(n, u, v, 6, 5);
    const mare = k < 0.47 ? 0.55 : 1;
    const x = (150 + k * 90) * mare;
    return [x, x, x * 0.98];
  });
  moonMat.map = fallback;
  const moon = new THREE.Mesh(new THREE.SphereGeometry(mr, 48, 24), moonMat);
  moon.position.copy(moonDir).multiplyScalar(820);
  moon.rotation.set(0.2, -1.2, 0.1);
  moon.renderOrder = -9;
  moon.userData.noAO = true;
  group.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color(0x8aa4c8).multiplyScalar(0.55), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  halo.scale.setScalar(mr * 9);
  halo.position.copy(moon.position).multiplyScalar(0.99);
  halo.renderOrder = -8;
  group.add(halo);
  let ready = Promise.resolve();
  const A = globalThis.SMD && globalThis.SMD.assets;
  if (A && A.texture) {
    ready = A.texture('moon')
      .then((t) => {
        moonMat.map = t;
        moonMat.needsUpdate = true;
        fallback.dispose();
      })
      .catch(() => {});
  }
  return { group, dome, moon, halo, mat, ready };
}

// ---------- Ground ----------
export function buildGround(M, o = {}) {
  const low = o.low;
  const group = new THREE.Group();
  group.name = 'ground';
  const meshes = [];

  // Wet concrete apron.
  const cm = concreteMaps(low ? 512 : 1024, 24, 7);
  const ax0 = -130;
  const ax1 = 140;
  const az0 = -120;
  const az1 = 150;
  const rep = [(ax1 - ax0) / cm.metres, (az1 - az0) / cm.metres];
  for (const t of [cm.map, cm.rough, cm.normal]) t.repeat.set(rep[0], rep[1]);
  const apronMat = std({ map: cm.map, roughnessMap: cm.rough, normalMap: cm.normal, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 1, metalness: 0, color: 0xa9adb0 });
  if (M.env) (apronMat.envMap = M.env), (apronMat.envMapIntensity = 1.0);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(ax1 - ax0, az1 - az0).rotateX(-Math.PI / 2), apronMat);
  apron.position.set((ax0 + ax1) / 2, 0, (az0 + az1) / 2);
  apron.receiveShadow = true;
  apron.name = 'apron';
  group.add(apron);
  meshes.push(apron);
  M.apron = apronMat;

  // Scrub land around, the sea to the east.
  const landTex = pixelTex(256, 256, (u, v) => {
    const n = noise2(61);
    const k = fbm(n, u, v, 8, 4);
    return [18 + k * 22, 22 + k * 24, 16 + k * 16];
  });
  landTex.wrapS = landTex.wrapT = THREE.RepeatWrapping;
  landTex.repeat.set(30, 30);
  const land = new THREE.Mesh(new THREE.CircleGeometry(1300, 48).rotateX(-Math.PI / 2), std({ map: landTex, roughness: 0.95, color: 0x6a705e }));
  land.position.y = -0.06;
  land.receiveShadow = true;
  group.add(land);
  const seaMat = std({ color: 0x03070b, roughness: 0.12, metalness: 0.0 });
  if (M.env) (seaMat.envMap = M.env), (seaMat.envMapIntensity = 2.0);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 2400).rotateX(-Math.PI / 2), seaMat);
  sea.position.set(430 + 600, 0.02, 0);
  group.add(sea);

  const B = new Builder();
  const lamps = new Builder();

  // ---------- Walkway and parking (thin slabs over the apron) ----------
  const slab = (r, mat, y = 0.02) => B.add(mat, new THREE.BoxGeometry(r.x1 - r.x0, 0.04, r.z1 - r.z0), { p: [(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2] });
  slab(G.parking, M.asphalt, 0.015);
  slab(G.walkA, M.walkway, 0.025);
  slab(G.walkB, M.walkway, 0.025);
  // Painted lines: walkway edges (yellow), parking bays (white).
  const line = (x0, z0, x1, z1, mat, wdt = 0.14) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    B.add(mat, new THREE.BoxGeometry(len, 0.01, wdt), { p: [(x0 + x1) / 2, 0.05, (z0 + z1) / 2], r: [0, -Math.atan2(z1 - z0, x1 - x0), 0] });
  };
  const A = G.walkA;
  const Wb = G.walkB;
  line(A.x0 + 0.25, A.z0 + 6, A.x0 + 0.25, A.z1, M.paintYellow);
  line(A.x1 - 0.25, A.z0, A.x1 - 0.25, A.z1, M.paintYellow);
  line(Wb.x0, Wb.z1 - 0.25, A.x0 + 0.25, Wb.z1 - 0.25, M.paintYellow);
  line(Wb.x0, Wb.z0 + 0.25, A.x1 - 0.25, Wb.z0 + 0.25, M.paintYellow);
  for (let i = 0; i < 8; i++) line(G.parking.x0 + 4 + i * 3.6, G.parking.z1 - 6, G.parking.x0 + 4 + i * 3.6, G.parking.z1 - 0.5, M.paintWhite, 0.12);
  // Walkway stencils (one atlas): CREW WALKWAY and arrows.
  const sten = signTex(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(226,180,22,0.92)';
    g.font = font(64, 700);
    g.textAlign = 'center';
    g.fillText('CREW WALKWAY', w / 2, 80);
    g.beginPath();
    g.moveTo(w / 2, 120);
    g.lineTo(w / 2 + 60, 190);
    g.lineTo(w / 2 + 22, 190);
    g.lineTo(w / 2 + 22, 250);
    g.lineTo(w / 2 - 22, 250);
    g.lineTo(w / 2 - 22, 190);
    g.lineTo(w / 2 - 60, 190);
    g.closePath();
    g.fill();
  });
  const stenM = std({ map: sten, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const decal = new Builder();
  const stencil = (x, z, yaw, s = 1) => decal.add(stenM, new THREE.PlaneGeometry(4 * s, 2 * s).rotateX(-Math.PI / 2), { p: [x, 0.06, z], r: [0, yaw, 0] });
  stencil((A.x0 + A.x1) / 2, 70, 0);
  stencil((A.x0 + A.x1) / 2, 44, 0);
  stencil((A.x0 + A.x1) / 2, 22, Math.PI / 4, 0.9);
  stencil(-2, (Wb.z0 + Wb.z1) / 2, Math.PI / 2);
  // Puddles: a few mirror-smooth dark discs on the walkway route.
  const puddleM = std({ color: 0x0b0e11, roughness: 0.07, metalness: 0.0, transparent: true, opacity: 0.86, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  if (M.env) (puddleM.envMap = M.env), (puddleM.envMapIntensity = 1.2);
  const R = rng(17);
  for (const [px, pz, s] of [[14.2, 60, 2.2], [15.6, 33, 1.6], [13.0, 26, 1.2], [4, 14.5, 2.6], [-9, 15.2, 1.8], [-16, 12.5, 1.4], [16.5, 72, 1.1], [13.6, 79, 1.5]]) {
    const pts = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = s * (0.7 + R() * 0.45);
      pts.push(new THREE.Vector2(Math.cos(a) * rr * 1.5, Math.sin(a) * rr));
    }
    decal.add(puddleM, new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateX(-Math.PI / 2), { p: [px, 0.055, pz], r: [0, R() * 3, 0] });
  }
  const decals = decal.bake(group, { castShadow: false, receiveShadow: true });
  decals.forEach((m) => (m.userData.noAO = true));

  // Bollards with amber caps along the walkway (the path forward is lit).
  const bollards = [];
  for (let z = 76; z > 20; z -= 7) bollards.push([A.x0 - 0.5, z]);
  for (let x = 10; x > -18; x -= 7) bollards.push([x, Wb.z1 + 0.5]);
  for (const [x, z] of bollards) {
    B.add(M.darkSteel, new THREE.CylinderGeometry(0.11, 0.13, 0.9, 10), { p: [x, 0.45, z] });
    lamps.add(M.lampAmber, new THREE.CylinderGeometry(0.115, 0.115, 0.12, 10), { p: [x, 0.8, z] });
  }

  // ---------- Fuel lines on their rack ----------
  const rx = G.rackX;
  const rz0 = 9;
  const rz1 = 79;
  const pipes = [
    { dx: -0.55, y: 1.25, r: 0.33, mat: M.frost },
    { dx: 0.35, y: 1.2, r: 0.27, mat: M.silverPipe },
    { dx: 0.9, y: 1.75, r: 0.09, mat: M.yellow },
  ];
  for (const p of pipes) {
    B.add(p.mat, new THREE.CylinderGeometry(p.r, p.r, rz1 - rz0, 14), { p: [rx + p.dx, p.y, (rz0 + rz1) / 2], r: [Math.PI / 2, 0, 0] });
    // The run west into the mount, and east to the tank farm.
    B.add(p.mat, new THREE.CylinderGeometry(p.r, p.r, rx - 13.8 + p.dx, 14), { p: [(rx + p.dx + 13.8) / 2, p.y, rz0 + p.dx], r: [0, 0, Math.PI / 2] });
    B.add(p.mat, new THREE.CylinderGeometry(p.r, p.r, 70, 14), { p: [rx + 35, p.y, rz1 + p.dx], r: [0, 0, Math.PI / 2] });
    B.add(p.mat, new THREE.SphereGeometry(p.r * 1.0, 12, 8), { p: [rx + p.dx, p.y, rz1 + p.dx] });
    B.add(p.mat, new THREE.SphereGeometry(p.r * 1.0, 12, 8), { p: [rx + p.dx, p.y, rz0 + p.dx] });
  }
  const flanges = [];
  for (let z = rz0 + 4; z < rz1; z += 6) {
    // H-frame support.
    B.add(M.steel, new THREE.BoxGeometry(0.2, 2.0, 0.2), { p: [rx - 1.2, 1.0, z] });
    B.add(M.steel, new THREE.BoxGeometry(0.2, 2.0, 0.2), { p: [rx + 1.2, 1.0, z] });
    B.add(M.steel, new THREE.BoxGeometry(2.6, 0.18, 0.25), { p: [rx, 0.85, z] });
    B.add(M.steel, new THREE.BoxGeometry(2.6, 0.14, 0.2), { p: [rx, 1.55, z] });
    B.add(M.concrete2, new THREE.BoxGeometry(3.0, 0.25, 0.7), { p: [rx, 0.12, z] });
    if ((z - rz0) % 12 === 4) {
      B.add(M.frost, new THREE.CylinderGeometry(0.42, 0.42, 0.18, 14), { p: [rx - 0.55, 1.25, z + 3], r: [Math.PI / 2, 0, 0] });
      B.add(M.silverPipe, new THREE.CylinderGeometry(0.34, 0.34, 0.14, 14), { p: [rx + 0.35, 1.2, z + 3], r: [Math.PI / 2, 0, 0] });
      flanges.push([rx - 0.55, 1.25, z + 3]);
    }
  }
  // Ice crust on the ground under the LOX line.
  B.add(M.ice, new THREE.BoxGeometry(1.4, 0.02, rz1 - rz0 - 2), { p: [rx - 0.55, 0.03, (rz0 + rz1) / 2] });

  // ---------- Light poles along the walk (sodium) ----------
  const poles = [
    [17.4, 90.5],
    [A.x0 - 2.2, 52],
    [-6, Wb.z1 + 2.4],
  ];
  const poleBeams = [];
  for (const [x, z] of poles) {
    const h = 13;
    B.add(M.steel, new THREE.CylinderGeometry(0.14, 0.22, h, 10), { p: [x, h / 2, z] });
    B.add(M.concrete2, new THREE.CylinderGeometry(0.45, 0.5, 0.6, 12), { p: [x, 0.3, z] });
    B.add(M.steel, new THREE.BoxGeometry(2.2, 0.12, 0.12), { p: [x + 1.0, h - 0.2, z] });
    B.add(M.darkSteel, new THREE.BoxGeometry(0.9, 0.22, 0.5), { p: [x + 2.0, h - 0.3, z] });
    lamps.add(M.lampSodium, new THREE.BoxGeometry(0.75, 0.04, 0.38), { p: [x + 2.0, h - 0.42, z] });
    poleBeams.push({ at: [x + 2.0, h - 0.45, z], to: [x + 2.0, 0, z] });
  }

  // ---------- Xenon flood towers (the big beams) ----------
  const floods = [
    { at: [48, 0, 46], aim: [0, 46, 0], h: 30 },
    { at: [-64, 0, 34], aim: [-6, 50, 0], h: 30 },
    { at: [54, 0, -50], aim: [0, 60, 0], h: 32 },
    { at: [-58, 0, -54], aim: [-10, 70, -4], h: 32 },
  ];
  for (const f of floods) {
    const [fx, , fz] = f.at;
    const h = f.h;
    // Four-legged tapered lattice.
    const base = 1.6;
    const topw = 0.7;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) strut(B, M.steel, [fx + sx * base, 0, fz + sz * base], [fx + sx * topw, h, fz + sz * topw], 0.22);
    for (let y = 3; y < h; y += 3.2) {
      const k = y / h;
      const wv = base + (topw - base) * k;
      const k2 = (y + 3.2) / h;
      const wv2 = base + (topw - base) * Math.min(1, k2);
      for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) strut(B, M.steel, [fx + ax * wv, y, fz + az * wv], [fx + bx * wv2, Math.min(h, y + 3.2), fz + bz * wv2], 0.08);
    }
    // Lamp head: a frame with 2 x 4 lamps, turned toward the aim point.
    const yaw = Math.atan2(f.aim[0] - fx, f.aim[2] - fz);
    const dist = Math.hypot(f.aim[0] - fx, f.aim[2] - fz);
    const pitch = Math.atan2(f.aim[1] - h, dist);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(fx, h + 1.2, fz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const sub = (geo, mat, p) => B.add(mat, geo, { p, matrix: m });
    sub(new THREE.BoxGeometry(4.2, 2.2, 0.3), M.darkSteel, [0, 0, -0.35]);
    B.add(M.steel, new THREE.BoxGeometry(4.4, 0.3, 2.0), { p: [fx, h + 0.1, fz] });
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 2; j++) {
        sub(new THREE.BoxGeometry(0.8, 0.8, 0.5), M.darkSteel, [-1.5 + i, -0.5 + j, 0]);
        lamps.add(M.lampFlood, new THREE.CircleGeometry(0.34, 16), { p: [-1.5 + i, -0.5 + j, 0.26], matrix: m });
      }
    f.head = new THREE.Vector3(fx, h + 1.2, fz);
    f.dir = new THREE.Vector3(...f.aim).sub(f.head).normalize();
  }

  // ---------- Fences (chain link) around the walk area ----------
  const fenceTex = canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,205,210,1)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(w, h);
    g.moveTo(w, 0);
    g.lineTo(0, h);
    g.stroke();
  });
  fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping;
  const fenceM = std({ map: fenceTex, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.7, color: 0x9aa1a7 });
  const FB = new Builder();
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = -Math.atan2(z1 - z0, x1 - x0);
    const g = new THREE.PlaneGeometry(len, 2.4);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len * 6, uv.getY(i) * 2.4 * 6);
    FB.add(fenceM, g, { p: [(x0 + x1) / 2, 1.2, (z0 + z1) / 2], r: [0, yaw, 0] });
    const n = Math.round(len / 3);
    for (let i = 0; i <= n; i++) B.add(M.steel, new THREE.CylinderGeometry(0.05, 0.05, 2.7, 6), { p: [x0 + ((x1 - x0) * i) / n, 1.35, z0 + ((z1 - z0) * i) / n] });
    strut(B, M.steel, [x0, 2.4, z0], [x1, 2.4, z1], 0.06, 0.06, true);
  };
  const b = G.bounds;
  fence(b.minX - 0.5, b.maxZ + 1.5, b.maxX + 1, b.maxZ + 1.5);
  fence(b.maxX + 1, 30, b.maxX + 1, b.maxZ + 1.5);
  fence(b.minX - 0.5, 22, b.minX - 0.5, b.maxZ + 1.5);
  FB.bake(group, { castShadow: false, receiveShadow: true });

  // ---------- Tower-base props: plaque, Nadia's console, barriers, cones ----------
  B.add(M.concrete2, new THREE.BoxGeometry(1.2, 1.0, 0.6), { p: [-24.4, 0.5, 8.4] });
  B.add(M.signs, signPlane('plaque', 0.9, 0.45).rotateX(-0.6), { p: [-24.4, 1.08, 8.55] });
  // Console table under a work light.
  B.add(M.darkSteel, new THREE.BoxGeometry(1.6, 0.05, 0.8), { p: [-27.2, 0.95, 10.6] });
  for (const [dx, dz] of [[-0.7, -0.33], [0.7, -0.33], [-0.7, 0.33], [0.7, 0.33]]) B.add(M.steel, new THREE.BoxGeometry(0.05, 0.95, 0.05), { p: [-27.2 + dx, 0.475, 10.6 + dz] });
  B.add(M.darkSteel, new THREE.BoxGeometry(0.42, 0.02, 0.3), { p: [-27.4, 0.99, 10.55] });
  B.add(M.darkSteel, new THREE.BoxGeometry(0.42, 0.28, 0.02), { p: [-27.4, 1.13, 10.42], r: [-0.25, 0, 0] });
  lamps.add(M.screenLamp, new THREE.PlaneGeometry(0.38, 0.24), { p: [-27.4, 1.13, 10.435], r: [-0.25, 0, 0] });
  B.add(M.steel, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), { p: [-26.3, 1.2, 10.2] });
  B.add(M.darkSteel, new THREE.BoxGeometry(0.35, 0.2, 0.3), { p: [-26.3, 2.45, 10.4], r: [0.6, 0, 0] });
  lamps.add(M.lampWarm, new THREE.PlaneGeometry(0.28, 0.16).rotateX(Math.PI / 2 + 0.6), { p: [-26.3, 2.36, 10.48] });
  // Jersey barriers along the mount side of the walkway, with hazard tops.
  for (let x = -12; x <= 12; x += 3.2) {
    B.add(M.concrete2, new THREE.BoxGeometry(3.0, 0.8, 0.5), { p: [x, 0.4, 11.75] });
    B.add(M.hazard, new THREE.BoxGeometry(3.0, 0.04, 0.3), { p: [x, 0.82, 11.75] });
  }
  for (const [x, z] of [[17.0, 12.5], [12.0, 81.5], [17.0, 81.5], [-19.5, 17.2]]) {
    B.add(M.orange, new THREE.ConeGeometry(0.2, 0.7, 12), { p: [x, 0.38, z] });
    B.add(M.paintWhite, new THREE.CylinderGeometry(0.12, 0.15, 0.1, 12), { p: [x, 0.45, z] });
    B.add(M.darkSteel, new THREE.BoxGeometry(0.42, 0.04, 0.42), { p: [x, 0.02, z] });
  }
  // Hose reels and a cable run along the tower side of the walkway.
  for (const x of [-15.8, -12.6]) {
    B.add(M.orange, new THREE.CylinderGeometry(0.55, 0.55, 0.35, 16), { p: [x, 0.65, 18.6], r: [Math.PI / 2, 0, 0] });
    B.add(M.darkSteel, new THREE.BoxGeometry(0.9, 0.12, 0.6), { p: [x, 0.06, 18.6] });
  }
  B.add(M.darkSteel, new THREE.BoxGeometry(0.4, 0.12, 30), { p: [-21.6, 0.06, 26] });
  // Signs at the turn and the tower (one atlas).
  const sign = (i, x, z, yaw) => {
    B.add(M.signs, signPlane(i ? 'danger' : 'walkway', 2.0, 1.0), { p: [x, 1.9, z], r: [0, yaw, 0] });
    B.add(M.darkSteel, new THREE.BoxGeometry(2.05, 1.05, 0.04), { p: [x - Math.sin(yaw) * 0.03, 1.9, z - Math.cos(yaw) * 0.03], r: [0, yaw, 0] });
    for (const s of [-0.85, 0.85]) B.add(M.steel, new THREE.BoxGeometry(0.06, 1.4, 0.06), { p: [x + Math.cos(yaw) * s - Math.sin(yaw) * 0.06, 0.7, z - Math.sin(yaw) * s - Math.cos(yaw) * 0.06] });
  };
  sign(0, 10.4, 22, Math.PI * 0.25);
  sign(1, 20.4, 52, -Math.PI / 2);
  sign(1, 20.4, 74, -Math.PI / 2);

  // ---------- Far structures (silhouettes in the fog) ----------
  const FARB = new Builder();
  const far = M.far;
  const masts = [[-96, 70], [102, 54], [6, -132]];
  for (const [x, z] of masts) {
    const h = 150;
    FARB.add(far, new THREE.CylinderGeometry(0.9, 2.6, h, 6), { p: [x, h / 2, z] });
    FARB.add(far, new THREE.CylinderGeometry(0.15, 0.4, 18, 6), { p: [x, h + 9, z] });
    lamps.add(M.lampRed, new THREE.SphereGeometry(0.8, 8, 6), { p: [x, h + 18.5, z] });
    lamps.add(M.lampRed, new THREE.SphereGeometry(0.7, 8, 6), { p: [x, h * 0.5, z] });
  }
  // Catenary wires between the masts (sagging tubes).
  for (let i = 0; i < 3; i++) {
    const [ax, az] = masts[i];
    const [bx, bz] = masts[(i + 1) % 3];
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24;
      pts.push(new THREE.Vector3(ax + (bx - ax) * t, 165 - Math.sin(t * Math.PI) * 55, az + (bz - az) * t));
    }
    FARB.add(far, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.12, 4, false));
  }
  // Water tower (sound suppression), propellant spheres, the big hangar.
  const wt = [118, -96];
  FARB.add(far, new THREE.SphereGeometry(9, 20, 14), { p: [wt[0], 70, wt[1]] });
  FARB.add(far, new THREE.CylinderGeometry(2.0, 2.4, 62, 10), { p: [wt[0], 31, wt[1]] });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    strut(FARB, far, [wt[0] + Math.cos(a) * 9, 0, wt[1] + Math.sin(a) * 9], [wt[0] + Math.cos(a) * 6, 66, wt[1] + Math.sin(a) * 6], 0.6);
  }
  lamps.add(M.lampRed, new THREE.SphereGeometry(0.7, 8, 6), { p: [wt[0], 79.6, wt[1]] });
  for (const [sx, sz, mat] of [[96, 96, M.sphereWhite], [-128, -70, M.sphereWhite]]) {
    FARB.add(mat, new THREE.SphereGeometry(13, 28, 18), { p: [sx, 17, sz] });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      FARB.add(far, new THREE.CylinderGeometry(0.4, 0.4, 12, 6), { p: [sx + Math.cos(a) * 11, 6, sz + Math.sin(a) * 11] });
    }
    for (let i = 0; i < 6; i++) lamps.add(M.lampSodium, new THREE.BoxGeometry(0.6, 0.3, 0.6), { p: [sx + Math.cos(i) * 14, 0.8 + (i % 2) * 6, sz + Math.sin(i) * 14] });
  }
  FARB.add(far, new THREE.BoxGeometry(160, 160, 210), { p: [-330, 80, -640] });
  for (let i = 0; i < 8; i++) lamps.add(M.lampRed, new THREE.SphereGeometry(1.8, 6, 4), { p: [-410 + (i % 4) * 53, 161, -745 + Math.floor(i / 4) * 210] });
  const farMeshes = FARB.bake(group, { castShadow: false, receiveShadow: false });
  farMeshes.forEach((m) => (m.userData.noAO = true));

  const near = B.bake(group, { castShadow: true, receiveShadow: true });
  for (const m of near) {
    if (m.material === realOf(M.steel) || m.material === realOf(M.concrete2)) boxUV(m.geometry, 3);
    if (m.material === realOf(M.walkway)) (boxUV(m.geometry, 8, [0.31, 0.17]), (m.castShadow = false));
    if (m.material.isMeshBasicMaterial) m.castShadow = false;
  }
  const lampMeshes = lamps.bake(group, { castShadow: false, receiveShadow: false });
  lampMeshes.forEach((m) => (m.userData.noAO = true));

  // ---------- Shore lights (fog-independent faint dots) ----------
  const shore = [];
  const SR = rng(23);
  for (let i = 0; i < (low ? 160 : 320); i++) {
    const t = SR();
    // A coast running north-south about 400-480 m east, curving west to the south.
    const z = -700 + t * 1400;
    const x = 420 + Math.sin(z * 0.004) * 40 - Math.max(0, z - 300) * 0.55 + (SR() - 0.5) * 30;
    shore.push(x, 0.5 + SR() * 6, z);
  }
  // Towns to the south-west, on the horizon.
  for (let i = 0; i < (low ? 80 : 160); i++) {
    const a = -2.3 + SR() * 1.6;
    const r = 640 + SR() * 160;
    shore.push(Math.sin(a) * r, 0.5 + SR() * 4, Math.cos(a) * r * -1 * -1);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(shore, 3));
  const sCol = [];
  for (let i = 0; i < shore.length / 3; i++) {
    const warmK = SR();
    sCol.push(1.0, 0.62 + warmK * 0.3, 0.3 + warmK * 0.5);
  }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(sCol, 3));
  const sm = new THREE.ShaderMaterial({
    uniforms: { k: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vC;
      varying float vA;
      uniform float k;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = 2.4;
        vC = color;
        vA = k * 1.6 * exp(-d * 0.0018);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      varying float vA;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(c));
        gl_FragColor = vec4(vC * vA * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shorePts = new THREE.Points(sg, sm);
  shorePts.frustumCulled = false;
  group.add(shorePts);

  return {
    group,
    meshes,
    floods,
    poleBeams,
    flanges,
    apronMat,
    obstacles: {
      circles: [
        ...poles.map(([x, z]) => ({ x, z, r: 0.55 })),
        ...bollards.map(([x, z]) => ({ x, z, r: 0.18 })),
        { x: -24.4, z: 8.4, r: 0.75 },
        { x: -27.2, z: 10.6, r: 0.95 },
        ...[-15.8, -12.6].map((x) => ({ x, z: 18.6, r: 0.6 })),
      ],
      boxes: [
        { minX: rx - 1.6, maxX: rx + 1.6, minZ: rz0 - 0.8, maxZ: rz1 + 1 },
        { minX: 13.8, maxX: rx, minZ: rz0 - 1.2, maxZ: rz0 + 1.2 },
        { minX: -13.6, maxX: 13.6, minZ: 11.45, maxZ: 12.05 },
        { minX: 9.3, maxX: 11.5, minZ: 21.0, maxZ: 23.0 },
      ],
    },
  };
}
