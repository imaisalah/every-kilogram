// Last Light, the Prologue's set: launch pad 39B the night before launch.
// -4 °C, ground fog, xenon floodlights cutting through it, the rocket venting
// cryogenic vapour, the service tower with its elevator, the crew access arm
// at 92 m and the white room against Orion's hatch.
//
// Layout (metres; x east, z south, y up): the rocket stands on its mount at
// the origin; the tower is west of it (x -34..-22); the crew van is parked
// 90 m south. The walk: parking -> north along the crew walkway (fuel lines on
// the right, light poles on the left) -> west past the mount -> Kwame at the
// tower base -> elevator -> the arm level (y 92) -> white room -> hatch.
//
// Beyond the set contract (common.js) this set also returns
//   walkable.zones  [{ minX, maxX, minZ, maxZ, y }] (ground and arm level)
//   walkable.clamp(p, y)  obstacles of the level at height y
//   walkables: { ground, arm }  each level alone (controller format, with y)
//   elevator: { ride(toLevel 'arm'|'ground', seconds = 8, rider?) -> Promise, level, cab }
//   props: { crate_o2, crate_co2, crate_cam }  the crate objects (hide/carry)
//   fog, background, exposure, post  (= mood.*, for the director)
import { THREE, anchor, lightBeam, disposeGroup, tier, reducedMotion, clamp, smooth } from './common.js';
import { LOOKS, merge } from '../post-options.js';
import { std, lamp, virt, FOG, grimeTex, gratingTex, frostTex, hazardTex } from './pad-kit.js';
import { signAtlas } from './pad-signs.js';
import { buildRocket, R } from './pad-rocket.js';
import { buildTower, T } from './pad-tower.js';
import { buildGround, buildSky, G } from './pad-ground.js';
import { buildVan } from './pad-van.js';
import { createVapour, createFogSheets } from './pad-fx.js';
import { resolveGround } from '../../3d/controller.js';
import { getRenderer } from '../../3d/engine.js';

const ARM = T.armY;
const FOG_COLOR = 0x121b25;

// ---------- Materials ----------
// A handful of real materials; every paint, metal and lamp colour is a
// virtual material (vertex colours) on one of them.
function materials(low) {
  const M = {};
  const grime = grimeTex(low ? 256 : 512, 3);
  // Painted steel, concrete-free: towers, rails, cabinets, panels, walls.
  M.paintR = std({ map: grime, vertexColors: true, roughness: 0.55, metalness: 0.2 });
  M.steel = virt(M.paintR, 0x8f979e);
  M.darkSteel = virt(M.paintR, 0x2a2f35);
  M.yellow = virt(M.paintR, 0xd9a514);
  M.cabinet = virt(M.paintR, 0x76816f);
  M.panel = virt(M.paintR, 0xcfd4d8);
  M.roomWall = virt(M.paintR, 0xc6cacf);
  M.hatchDoor = virt(M.paintR, 0xe4e7ea);
  M.cabinWall = virt(M.paintR, 0x3a3f45);
  M.seat = virt(M.paintR, 0x1b1e22);
  M.bag = virt(M.paintR, 0x2f5c8a);
  M.cabWall = virt(M.paintR, 0x5c656d);
  M.orange = virt(M.paintR, 0xe0561c);
  M.crateWhite = virt(M.paintR, 0xeef0ee);
  M.crateGreen = virt(M.paintR, 0x1f9d55);
  M.crateGrey = virt(M.paintR, 0x8b939a);
  M.crateBlack = virt(M.paintR, 0x17191c);
  M.crateBlue = virt(M.paintR, 0x2d6fb5);
  M.crateFoam = virt(M.paintR, 0x2a2c30);
  // Bare metal: vacuum-jacketed lines, ice, rims, gates.
  M.metalR = std({ vertexColors: true, roughness: 0.28, metalness: 0.9 });
  M.silverPipe = virt(M.metalR, 0xb8c0c7);
  M.ice = virt(M.metalR, 0xe6eef4);
  M.chrome = virt(M.metalR, 0xd0d6dc);
  M.lens = virt(M.metalR, 0x0b0e14);
  const gr = gratingTex();
  M.gratingR = std({ map: gr, vertexColors: true, roughness: 0.6, metalness: 0.5 });
  M.grating = virt(M.gratingR, 0xb9c0c5);
  M.roomFloor = virt(M.gratingR, 0xe2e6e9);
  const fr = frostTex(low ? 256 : 512);
  fr.repeat.set(2, 6);
  M.frost = std({ map: fr, color: 0xffffff, roughness: 0.92, metalness: 0 });
  const cg = grimeTex(256, 13, { lo: 120, hi: 200 });
  M.concreteR = std({ map: cg, vertexColors: true, roughness: 0.85 });
  M.concrete2 = virt(M.concreteR, 0xa3a39e);
  M.pit = virt(M.concreteR, 0x050607);
  M.pavingR = std({ map: grimeTex(256, 19, { lo: 150, hi: 210 }), vertexColors: true, roughness: 0.45 });
  M.walkway = virt(M.pavingR, 0x9b9d9b);
  M.asphalt = virt(M.pavingR, 0x2c3034);
  M.paintYellow = virt(M.pavingR, 0xc89a12);
  M.paintWhite = virt(M.pavingR, 0xd8d8d2);
  M.farR = std({ vertexColors: true, roughness: 0.9 });
  M.far = virt(M.farR, 0x1a1f25);
  M.sphereWhite = virt(M.farR, 0xc9ccce);
  M.glass = std({ color: 0x0b1218, roughness: 0.05, metalness: 0.3 });
  M.mesh = std({ color: 0x454b51, roughness: 0.6, metalness: 0.6, transparent: true, opacity: 0.45, depthWrite: false });
  M.gate = std({ color: 0x8d969d, roughness: 0.5, metalness: 0.7, transparent: true, opacity: 0.8, depthWrite: false });
  const hz = hazardTex();
  hz.repeat.set(6, 1);
  M.hazard = std({ map: hz, roughness: 0.6 });
  M.signs = std({ map: signAtlas(), roughness: 0.5 });
  // Lamps: fog-free HDR emissive (bloom picks them up), one real material.
  M.lampR = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  M.lampR.userData.base = new THREE.Color(1, 1, 1);
  const L = (hex, k) => virt(M.lampR, new THREE.Color(hex).multiplyScalar(k));
  M.lampSodium = L(0xffa24a, 7);
  M.lampXenon = L(0xe8f0ff, 9);
  M.lampFlood = L(0xf3f6ff, 16);
  M.lampCool = L(0xeef4ff, 5);
  M.lampRoom = L(0xf2f6ff, 2.6); // the white room's ceiling: a small white box blooms into fog at full strength
  M.lampAmber = L(0xffa020, 6);
  M.lampGreen = L(0x38ff70, 4);
  M.lampWarm = L(0xffc68a, 6);
  M.lampHead = L(0xeef4ff, 14);
  M.lampTail = L(0xff2010, 5);
  M.lampInside = L(0xffb36b, 1.6);
  M.screen = L(0x6fd0ff, 1.2);
  M.screenLamp = L(0x9fd8ff, 1.6);
  // Aircraft warning lights blink: their own material.
  M.lampRed = lamp(0xff2214, 9);
  return M;
}

// A night environment for reflections: dark sky, the town glow, the
// floodlights and the Moon as bright patches (puddles, paint and glass catch them).
function nightEnv(moonDir) {
  let r;
  try {
    r = getRenderer();
  } catch (e) {
    return null;
  }
  if (!r || r.isNullRenderer) return null;
  const s = new THREE.Scene();
  const sky = new THREE.SphereGeometry(50, 32, 16);
  const col = [];
  const p = sky.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50;
    const k = Math.max(0, y);
    const c = new THREE.Color(0x1d2836).lerp(new THREE.Color(0x03050a), Math.pow(k, 0.5));
    if (y < 0) c.set(0x07090c);
    col.push(c.r, c.g, c.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const blob = (dir, color, k, size) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) }));
    m.position.copy(dir).normalize().multiplyScalar(40);
    s.add(m);
  };
  blob(moonDir, 0xdde6f2, 2.5, 0.6);
  for (const [x, y, z, c, k] of [[48, 30, 46, 0xf0f4ff, 9], [-64, 30, 34, 0xf0f4ff, 9], [54, 32, -50, 0xf0f4ff, 7], [-58, 32, -54, 0xf0f4ff, 7], [10, 13, 60, 0xffa24a, 5], [-30, 18, 10, 0xffa24a, 6], [0, 60, 0, 0xc2632b, 0.6]]) blob(new THREE.Vector3(x, y, z), c, k * 0.5, 0.8);
  const pm = new THREE.PMREMGenerator(r);
  const rt = pm.fromScene(s, 0.02, 0.1, 100);
  pm.dispose();
  s.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return rt;
}

// Keep a point inside a union of rectangles (nearest point when outside).
function rectsClamp(rects, p, r = 0.3) {
  let best = null;
  let bd = Infinity;
  for (const z of rects) {
    const x0 = z.minX + r;
    const x1 = z.maxX - r;
    const z0 = z.minZ + r;
    const z1 = z.maxZ - r;
    if (p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1) return p;
    const cx = clamp(p.x, x0, x1);
    const cz = clamp(p.z, z0, z1);
    const d = Math.hypot(p.x - cx, p.z - cz);
    if (d < bd) (bd = d), (best = { x: cx, z: cz });
  }
  if (best) (p.x = best.x), (p.z = best.z);
  return p;
}

export function create(opts = {}) {
  const T0 = performance.now();
  const low = (opts.quality || tier()) === 'low';
  const calm = opts.reducedMotion != null ? !!opts.reducedMotion : reducedMotion();
  const group = new THREE.Group();
  group.name = 'pad';
  FOG.n = low ? 3 : 5;
  const M = materials(low);
  const moonDir = new THREE.Vector3(0.1, 0.2, -0.975).normalize();
  FOG.glowDir.value.copy(moonDir);
  FOG.params.value.set(0.0105, 0.055, 0, 0.0017);
  FOG.glowColor.value.set(0x1c2836);
  const envRT = nightEnv(moonDir);
  M.env = envRT ? envRT.texture : null;
  if (M.env) {
    for (const k of ['paintR', 'metalR', 'gratingR', 'glass', 'pavingR', 'gate', 'concreteR']) {
      M[k].envMap = M.env;
      M[k].envMapIntensity = k === 'glass' || k === 'metalR' ? 1.4 : k === 'pavingR' ? 1.2 : 0.6;
    }
  }

  // ---------- Build ----------
  const rocket = buildRocket(M, { low });
  const tower = buildTower(M, { low });
  const ground = buildGround(M, { low });
  const sky = buildSky({ moonDir, low, horizon: 0x1a2531 });
  const van = buildVan(M, { low });
  van.group.position.set(24.2, 0, 84.6);
  van.group.rotation.y = Math.PI / 2; // front toward the pad (-z)
  group.add(rocket.group, tower.group, ground.group, sky.group, van.group);

  // Lamps that light the haze (in-scattering in the fog shaders).
  {
    const F = ground.floods;
    const cool = new THREE.Color(0xdfe8ff);
    const sodium = new THREE.Color(0xffa04a);
    const list = [
      [F[0].head, cool, 0.4],
      [F[1].head, cool, 0.4],
      [new THREE.Vector3(0, R.deck + 1.5, 10.5), cool, 0.2],
      [new THREE.Vector3(-21.4, 15.5, 2.6), sodium, 0.22],
      [F[2].head, cool, 0.32],
      [F[3].head, cool, 0.32],
      [new THREE.Vector3(...ground.poleBeams[0].at), sodium, 0.14],
      [new THREE.Vector3(...ground.poleBeams[1].at), sodium, 0.14],
    ];
    FOG.lights.value.forEach((v, i) => {
      const L = list[i];
      if (L && i < FOG.n) {
        v.set(L[0].x, L[0].y, L[0].z, L[2]);
        FOG.lightCols.value[i].copy(L[1]);
      } else v.set(0, -1000, 0, 0);
    });
  }

  // ---------- Beams ----------
  const beams = [];
  const addBeam = (from, to, o) => {
    const b = lightBeam(o);
    b.position.set(...from);
    const dir = new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).normalize();
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    group.add(b);
    beams.push(b);
    return b;
  };
  ground.floods.forEach((f, i) => {
    if (low && i > 1) return;
    const to = f.head.clone().addScaledVector(f.dir, 10);
    addBeam(f.head.toArray(), to.toArray(), { length: i < 2 ? 85 : 95, radius: 15, radiusTop: 1.4, color: 0xdfe8ff, intensity: i < 2 ? 0.3 : 0.38, segments: 20, noise: 0.5 });
  });
  // Up-lights from the deck along the core and boosters.
  rocket.upLights.forEach(([x, y, z], i) => {
    if (low && i !== 4) return;
    const tx = i === 4 ? 0 : x * 0.35;
    const tz = i === 4 ? 2 : z * 0.2;
    addBeam([x, y, z], [tx, y + 40, tz], { length: i === 4 ? 70 : 48, radius: i === 4 ? 7 : 5, radiusTop: 0.5, color: 0xeaf0ff, intensity: i === 4 ? 0.16 : 0.12, segments: 16 });
  });
  ground.poleBeams.forEach((pb, i) => {
    if (low && i > 0) return;
    addBeam(pb.at, pb.to, { length: 13, radius: 5.5, radiusTop: 0.35, color: 0xffb066, intensity: 0.3, segments: 16 });
  });
  van.beams.forEach((b) => beams.push(b));
  // The tower lamp over Kwame.
  const keyBFrom = [-21.4, 15.5, 2.6];
  const keyBTo = [-17.5, 0, 13];
  addBeam(keyBFrom, keyBTo, { length: 19, radius: 6.5, radiusTop: 0.4, color: 0xffb36a, intensity: 0.22, segments: 16 });

  // ---------- Lights ----------
  const lights = [];
  const groundL = [];
  const armL = [];
  const add = (l, where = 'both') => {
    group.add(l);
    if (l.target) group.add(l.target);
    lights.push(l);
    l.userData.base = l.intensity;
    if (where === 'ground') groundL.push(l);
    if (where === 'arm') armL.push(l);
    return l;
  };
  add(new THREE.HemisphereLight(0x3a4d68, 0x0d0f12, 0.4));
  const moonL = add(new THREE.DirectionalLight(0xa9bddc, 0.32));
  moonL.position.copy(moonDir).multiplyScalar(300);
  moonL.target.position.set(0, 0, 0);
  // Key: the south-east xenon tower on the rocket and the walkway's end.
  const F1 = ground.floods[0];
  const keyA = add(new THREE.SpotLight(0xf2f5ff, 14000, 220, 0.52, 0.55, 2));
  keyA.position.copy(F1.head);
  keyA.target.position.set(-2, 34, 4);
  keyA.castShadow = true;
  keyA.shadow.mapSize.set(2048, 2048);
  keyA.shadow.bias = -0.0004;
  keyA.shadow.normalBias = 0.06;
  keyA.shadow.camera.near = 20;
  keyA.shadow.camera.far = 200;
  // Second shadow light: the sodium lamp on the tower over the meeting point.
  const keyB = add(new THREE.SpotLight(0xffae62, 900, 45, 0.78, 0.6, 2), 'ground');
  keyB.position.set(...keyBFrom);
  keyB.target.position.set(...keyBTo);
  keyB.castShadow = true;
  keyB.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  keyB.shadow.bias = -0.0005;
  keyB.shadow.normalBias = 0.04;
  keyB.shadow.camera.near = 2;
  keyB.shadow.camera.far = 50;
  // The core lit from the deck, up its whole height.
  const up = add(new THREE.SpotLight(0xe8eeff, 3000, 140, 0.32, 0.6, 2));
  up.position.set(0, R.deck + 0.8, 13);
  up.target.position.set(0, 60, 0);
  // West flood: a cool rim on the rocket and the tower.
  const F2 = ground.floods[1];
  if (!low) {
    const rim = add(new THREE.SpotLight(0xd8e4ff, 4500, 200, 0.45, 0.6, 2));
    rim.position.copy(F2.head);
    rim.target.position.set(-12, 40, 0);
  }
  // Pools of sodium light on the wet walkway.
  ground.poleBeams.forEach((pb, i) => {
    if (low ? i > 0 : i > 1) return;
    const l = add(new THREE.SpotLight(0xffa858, 420, 30, 0.95, 0.75, 2), 'ground');
    l.position.set(...pb.at);
    l.target.position.set(pb.at[0] + 1, 0, pb.at[2]);
  });
  // Van headlights.
  van.spot.userData.base = van.spot.intensity;
  lights.push(van.spot);
  groundL.push(van.spot);
  // Arm level: the white room and a lamp along the arm.
  const roomL = add(new THREE.PointLight(0xe9f1ff, 5.5, 9, 2), 'arm');
  roomL.position.set((T.room.x0 + T.room.x1) / 2, ARM + 2.4, 0);
  const armSpot = add(new THREE.SpotLight(0xdfe8ff, 160, 26, 0.6, 0.6, 2), 'arm');
  armSpot.position.set(T.deck.x0 + 0.6, ARM + 3.0, 0.4);
  armSpot.target.position.set(-8, ARM, 0);
  tower.cabLight.userData.base = tower.cabLight.intensity;
  lights.push(tower.cabLight);

  // ---------- Vapour ----------
  const deck = rocket.deck;
  const floor = (x, z) => {
    if (x > deck.minX && x < deck.maxX && z > deck.minZ && z < deck.maxZ && !(Math.abs(x) < deck.hole.x && Math.abs(z) < deck.hole.z)) return R.deck;
    return 0.15;
  };
  const V = rocket.vents;
  const rate = low ? 0.4 : 1;
  const coreMid = (R.core0 + R.core1) / 2;
  const emitters = [
    // Pouring out under the deck and rolling over the apron.
    { name: 'base', at: V.base, rate: 14, life: 9, size: [3, 12], vel: [0, -1.2, 0], spread: 2.4, jitter: 4, alpha: 0.24, color: 0xd6dfe8, bright: 1.25, sink: 0.25, drag: 0.35 },
    { name: 'deck', at: (Rn) => [(Rn() - 0.5) * 16, R.deck + 0.5, (Rn() - 0.5) * 6], rate: 5, life: 8, size: [3, 10], vel: [0, -0.2, 0], spread: 1.0, jitter: 1, alpha: 0.22, color: 0xdde6ee, bright: 1.1, sink: 0.2, drag: 0.5 },
    // Intertank vents: a jet out, then falling.
    { name: 'vent1', at: V.intertankFront, rate: 16, life: 6.5, size: [0.6, 6.5], vel: [0.6, 0.2, 4.0], spread: 0.45, jitter: 0.25, alpha: 0.2, color: 0xe4ecf3, bright: 1.15, sink: 0.55, drag: 0.6 },
    { name: 'vent2', at: V.intertankBack, rate: 12, life: 6.5, size: [0.6, 6.5], vel: [-0.4, 0.2, -4.0], spread: 0.45, jitter: 0.25, alpha: 0.2, color: 0xe4ecf3, bright: 1.0, sink: 0.55, drag: 0.6 },
    { name: 'top', at: V.top, rate: 9, life: 8, size: [0.8, 8], vel: [0.4, 0.4, -2.5], spread: 0.35, jitter: 0.3, alpha: 0.2, color: 0xe4ecf3, bright: 1.0, sink: 0.4, drag: 0.5 },
    // Cold mist sliding down the core and boosters.
    { name: 'mist', ring: { x: 0, z: 0, r: R.coreR + 0.4, y0: R.core0 + 2, y1: R.core1 - 6 }, out: 0.35, vel: [0, -0.8, 0], rate: 22, life: 5, size: [1.2, 4.5], alpha: 0.1, color: 0xe8f0f6, bright: 1.0, sink: 0.12, drag: 0.8 },
    // Tail service masts.
    { name: 'tsm', at: (Rn) => V.tsm[Rn() < 0.5 ? 0 : 1], rate: 2.5, life: 6, size: [0.8, 5], vel: [0, -0.3, 1.2], spread: 0.5, jitter: 0.4, alpha: 0.3, color: 0xe4ecf3, bright: 1.0, sink: 0.35, drag: 0.6 },
    // Wisps at the frosted flanges along the walk.
    { name: 'pipes', at: (Rn) => ground.flanges[Math.floor(Rn() * ground.flanges.length)], rate: ground.flanges.length * 0.9, life: 4, size: [0.3, 2.4], vel: [-0.25, -0.05, 0], spread: 0.15, jitter: 0.25, alpha: 0.28, color: 0xdfe6ee, bright: 0.75, sink: 0.25, drag: 0.9 },
    // Ground fog drifting over the apron (big, faint).
    { name: 'groundfog', at: (Rn) => [-40 + Rn() * 90, 0.6, -20 + Rn() * 120], rate: 2.2, life: 26, size: [10, 22], vel: [0.3, 0, 0.1], spread: 0.2, jitter: 0, alpha: 0.075, color: 0x9fb0c2, bright: 0.55, sink: 0, drag: 0.2 },
  ];
  const vapour = createVapour({ max: low ? 300 : 950, emitters, floor, rateScale: rate, fogColor: new THREE.Color(FOG_COLOR), wind: [0.45, 0, 0.18] });
  group.add(vapour.mesh);
  const sheets = createFogSheets({ count: low ? 26 : 64, area: [-95, -75, 200, 205], top: 8, opacity: 0.55, color: 0x1b2530 });
  group.add(sheets.mesh);
  vapour.prewarm(calm ? 6 : 10);

  // ---------- Anchors ----------
  const rm = T.room;
  const anchors = {};
  const put = (name, x, y, z, yaw) => {
    const a = anchor(name, x, y, z, yaw);
    group.add(a);
    anchors[name] = a;
    return a;
  };
  put('start', 20.5, 0, 86.5, Math.atan2(-20.5, -86.5));
  put('van', 22.2, 0, 84.4, -Math.PI / 2 + 0.35);
  put('kwame', -16.5, 0, 14.4, Math.PI / 2);
  put('nadia', -26.0, 0, 11.6, 1.15);
  put('tower_base', -20.6, 0, 9.6, 0);
  put('elevator', -20.6, 0, 7.0, Math.PI);
  put('arm_start', -18.6, ARM, 0.4, Math.PI / 2);
  put('whiteroom', -5.6, ARM, 0.5, Math.PI / 2);
  for (const k of ['crate_o2', 'crate_co2', 'crate_cam']) {
    const a = put(k, tower.crateX[k], ARM, rm.z0 + 1.25, Math.PI);
    a.userData.prop = tower.crates[k];
  }
  put('hatch', rm.x1 - 0.55, ARM, 0, Math.PI / 2);
  put('seat_you', rm.x1 + 1.35, ARM, 0, Math.PI / 2);

  // ---------- Walkable ----------
  const B = G.bounds;
  const shaftBox = { minX: T.shaft.x0, maxX: T.shaft.x1, minZ: T.shaft.z0, maxZ: T.shaft.z1 };
  const cab = T.cab;
  const groundObs = {
    circles: ground.obstacles.circles.concat(
      ground.floods.map((f) => ({ x: f.at[0], z: f.at[2], r: 2.2 })),
      [{ x: 0, z: 0, r: 1 }],
    ),
    boxes: ground.obstacles.boxes.concat([
      { minX: -14, maxX: 14, minZ: -11.5, maxZ: 11.5 },
      { minX: T.x0 - 1.5, maxX: T.x1 + 0.4, minZ: T.z0 - 1.5, maxZ: T.z1 + 1.6 },
      { minX: van.group.position.x - van.size.W / 2, maxX: van.group.position.x + van.size.W / 2, minZ: van.group.position.z - van.size.L / 2, maxZ: van.group.position.z + van.size.L / 2 },
    ]),
  };
  // The shaft blocks the feet unless the cab is down there with its doors open.
  const shaftWalls = [
    { minX: shaftBox.minX, maxX: cab.x0 + 0.05, minZ: shaftBox.minZ, maxZ: shaftBox.maxZ },
    { minX: cab.x1 - 0.05, maxX: shaftBox.maxX, minZ: shaftBox.minZ, maxZ: shaftBox.maxZ },
    { minX: shaftBox.minX, maxX: shaftBox.maxX, minZ: shaftBox.minZ, maxZ: cab.z0 + 0.05 },
  ];
  const elevatorState = { level: 'ground', y: 0, moving: null };
  const groundWalk = {
    y: 0,
    bounds: { minX: B.minX, maxX: B.maxX, minZ: B.minZ, maxZ: B.maxZ },
    circles: groundObs.circles,
    get boxes() {
      return elevatorState.level === 'ground' && !elevatorState.moving ? groundObs.boxes.concat(shaftWalls) : groundObs.boxes.concat([shaftBox]);
    },
  };
  // Arm level: deck, cab, arm, white room, hatch (overlapping so you pass).
  const armRects = [
    { minX: T.deck.x0 + 0.1, maxX: T.deck.x1 + 0.6, minZ: T.deck.z0, maxZ: T.deck.z1 + 0.6 },
    { minX: cab.x0 + 0.06, maxX: cab.x1 - 0.06, minZ: cab.z0 - 0.8, maxZ: cab.z1 - 0.05 },
    { minX: T.arm.x0 - 0.6, maxX: T.arm.x1 + 0.6, minZ: T.arm.z0 + 0.12, maxZ: T.arm.z1 - 0.12 },
    { minX: rm.x0 - 0.6, maxX: rm.x1, minZ: rm.z0 + 0.05, maxZ: rm.z1 - 0.05 },
    { minX: rm.x1 - 0.5, maxX: rm.x1 + 2.1, minZ: -0.62, maxZ: 0.62 },
  ];
  const crateBoxes = Object.entries(tower.crates).map(([k, g]) => {
    const half = k === 'crate_o2' ? 0.6 : 0.42;
    return { prop: g, box: { minX: g.position.x - half, maxX: g.position.x + half, minZ: g.position.z - 0.35, maxZ: g.position.z + 0.33 } };
  });
  const armWalk = {
    y: ARM,
    bounds: null,
    circles: [],
    get boxes() {
      // A crate you picked up (hidden or moved) no longer blocks.
      return crateBoxes.filter((c) => c.prop.visible && c.prop.parent === tower.group).map((c) => c.box);
    },
    clamp: (p) => rectsClamp(armRects, p),
  };
  const zones = [
    { minX: B.minX, maxX: B.maxX, minZ: B.minZ, maxZ: B.maxZ, y: 0, level: 'ground' },
    ...armRects.map((r) => Object.assign({ y: ARM, level: 'arm' }, r)),
  ];
  const walkable = {
    zones,
    bounds: null,
    circles: [],
    boxes: [],
    // Obstacles of the level at height y (the player passes its feet height).
    clamp(p, y) {
      const atArm = y != null ? y > ARM * 0.5 : p.y > ARM * 0.5;
      if (atArm) {
        resolveGround(p, { boxes: armWalk.boxes }, 0.3);
        rectsClamp(armRects, p);
      } else resolveGround(p, groundWalk, 0.3);
      return p;
    },
  };

  // ---------- Colliders (camera) ----------
  const colliders = {
    circles: rocket.colliders.circles.concat(
      ground.floods.map((f) => ({ x: f.at[0], z: f.at[2], r: 2.0, h: f.h + 2, y0: 0 })),
      ground.obstacles.circles.filter((c) => c.r > 0.5).map((c) => ({ x: c.x, z: c.z, r: c.r, h: 14, y0: 0 })),
    ),
    boxes: rocket.colliders.boxes.concat(tower.colliders.boxes, tower.colliders.room, [
      { minX: van.group.position.x - 1.1, maxX: van.group.position.x + 1.1, minY: 0, maxY: 2.5, minZ: van.group.position.z - 3.0, maxZ: van.group.position.z + 3.0 },
    ]),
  };

  // ---------- Mood ----------
  const fog = new THREE.FogExp2(FOG_COLOR, 0.0045);
  const background = new THREE.Color(0x060a10);
  const exposure = 1.0;
  const post = merge(LOOKS.pad, {
    bloom: { strength: low ? 0.6 : 0.72, radius: 0.72, threshold: 0.85 },
    ao: { radius: 2.4, intensity: 0.85, distanceFallOff: 1.2, thickness: 3, scale: 1 },
    grade: { contrast: 1.16, saturation: 0.9, temperature: -0.12, tint: -0.03, lift: [0.008, 0.018, 0.032], gain: [1.05, 1.0, 0.94], exposure: 1.0 },
    vignette: 0.44,
    grain: 0.055,
  });
  const mood = { background, fog, exposure, shadows: true, post };

  // ---------- Elevator ----------
  const cabG = tower.cab;
  const gates = tower.gates;
  const cabY = { ground: 0, arm: ARM };
  cabG.position.y = 0;
  let gateOpen = { s: 1, n: 0 }; // 1 = open
  const gateWant = { s: 1, n: 0 };
  const elevator = {
    cab: cabG,
    get level() {
      return elevatorState.level;
    },
    get moving() {
      return !!elevatorState.moving;
    },
    // Ride the cab to a level; the rider (an Object3D) rides along.
    ride(toLevel = 'arm', seconds = 8, rider = null) {
      const to = toLevel === 'ground' ? 'ground' : 'arm';
      if (elevatorState.moving) elevatorState.moving.resolve();
      return new Promise((resolve) => {
        const from = cabG.position.y;
        const dur = Math.max(0, seconds);
        if (rider) {
          // Bring the rider inside the cab footprint, standing on its floor.
          const cx = (cab.x0 + cab.x1) / 2;
          const cz = (cab.z0 + cab.z1) / 2;
          rider.position.x = clamp(rider.position.x, cab.x0 + 0.45, cab.x1 - 0.45);
          rider.position.z = clamp(rider.position.z, cab.z0 + 0.45, cab.z1 - 0.45);
          if (Math.hypot(rider.position.x - cx, rider.position.z - cz) > 2) (rider.position.x = cx), (rider.position.z = cz);
        }
        elevatorState.moving = { from, to: cabY[to], toLevel: to, t: 0, dur, rider, resolve, gatesClosed: false };
        gateWant.s = gateWant.n = 0;
        if (dur === 0) step(0, true);
      });
    },
  };
  function step(dt, instant = false) {
    const m = elevatorState.moving;
    // Gates: ease toward what is wanted.
    for (const side of ['s', 'n']) {
      const k = instant ? 1 : Math.min(1, dt * 1.6);
      gateOpen[side] += (gateWant[side] - gateOpen[side]) * k;
      if (Math.abs(gateWant[side] - gateOpen[side]) < 0.01) gateOpen[side] = gateWant[side];
      for (const leaf of gates[side]) leaf.position.x = leaf.userData.closedX + (leaf.userData.openX - leaf.userData.closedX) * gateOpen[side];
    }
    tower.syncGates();
    if (!m) return;
    if (!m.gatesClosed) {
      if (instant || (gateOpen.s < 0.02 && gateOpen.n < 0.02)) m.gatesClosed = true;
      else return;
    }
    m.t += instant ? m.dur : dt;
    const k = m.dur > 0 ? clamp(m.t / m.dur) : 1;
    const e = smooth(k);
    const y = m.from + (m.to - m.from) * e;
    cabG.position.y = y;
    elevatorState.y = y;
    if (m.rider) m.rider.position.y = y;
    if (k >= 1) {
      elevatorState.level = m.toLevel;
      elevatorState.moving = null;
      if (m.toLevel === 'ground') gateWant.s = 1;
      else gateWant.n = 1;
      if (instant) step(0, true);
      m.resolve();
    }
  }

  // ---------- Alarm, power ----------
  let alarm = false;
  let power = 1;
  const lampMats = [M.lampR];
  function applyPower() {
    for (const m of lampMats) m.color.copy(m.userData.base).multiplyScalar(power);
    for (const l of lights) if (!l.isHemisphereLight && !l.isDirectionalLight) l.intensity = l.userData.base * power;
    for (const b of beams) b.visible = power > 0.05;
    for (const b of beams) b.material.uniforms.intensity.value = (b.userData.i0 != null ? b.userData.i0 : (b.userData.i0 = b.material.uniforms.intensity.value)) * power;
  }

  // ---------- Per frame ----------
  let level = 'ground';
  let tAcc = 0;
  function setLevel(next) {
    if (next === level) return;
    level = next;
    for (const l of groundL) l.visible = next === 'ground';
    for (const l of armL) l.visible = next === 'arm';
  }
  setLevel('arm');
  setLevel('ground');
  const redBase = M.lampRed.userData.base;
  function update(dt, t, camera) {
    dt = Math.min(dt || 0, 0.1);
    tAcc += dt;
    const time = t != null ? t : tAcc;
    if (camera) {
      sky.group.position.copy(camera.position);
      setLevel(camera.position.y > 45 ? 'arm' : camera.position.y < 35 ? 'ground' : level);
    }
    for (const b of beams) b.material.uniforms.time.value = time;
    vapour.update(dt, time);
    sheets.update(dt, time);
    step(dt);
    // Aircraft lights flash about 40 times a minute; faster on alarm.
    const ph = alarm ? (time * 3.2) % 1 : (time * 0.68) % 1;
    const on = alarm ? ph < 0.5 : ph < 0.22;
    M.lampRed.color.copy(redBase).multiplyScalar(on ? 1 : 0.04);
    if (alarm) {
      const k = 0.55 + 0.45 * Math.sin(time * 9);
      roomL.color.setRGB(1, 0.35 + 0.3 * k, 0.3 + 0.3 * k);
    }
  }

  const ready = Promise.all([sky.ready]).then(() => {});
  const set = {
    id: 'pad',
    group,
    anchors,
    colliders,
    walkable,
    walkables: { ground: groundWalk, arm: armWalk },
    volume: null,
    lights,
    mood,
    fog,
    background,
    exposure,
    post,
    ambience: 'wind',
    props: tower.crates,
    elevator,
    ready,
    update,
    setAlarm(on) {
      alarm = !!on;
      if (!alarm) roomL.color.set(0xe9f1ff);
    },
    setPower(k) {
      power = clamp(Number(k) || 0, 0, 1);
      applyPower();
    },
    dispose() {
      disposeGroup(group);
      if (envRT) envRT.dispose();
    },
    buildMs: 0,
  };
  set.buildMs = Math.round(performance.now() - T0);
  return set;
}

export default create;
