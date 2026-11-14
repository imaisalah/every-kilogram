// Last Light stand-in sets: simple, lit blockouts with every anchor named in
// docs/LASTLIGHT.md, so levels run before (or without) the art sets in
// js/ll/sets/*.js. Same shape as a real set:
//   { id, includes, group, anchors, colliders, walkable, volume?, lights,
//     shots, props, update(dt), setAlarm(on), setPower(0..1),
//     setState(name, value), openLocker(name), dispose() }
// 'pad' is the night launch pad (ground). 'capsule', 'tunnel' and 'habitat'
// are one joined zero-g interior.
import { THREE } from '../3d/engine.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function base(id, includes) {
  const group = new THREE.Group();
  group.name = 'standin:' + id;
  const own = [];
  const keep = (x) => (own.push(x), x);
  const anchors = {};
  const props = {};
  function anchor(name, x, y, z, yaw = 0) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(x, y, z);
    a.rotation.y = yaw;
    group.add(a);
    anchors[name] = a;
    return a;
  }
  const mat = (color, o = {}) => keep(new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0.1 }, o)));
  const box = (w, h, d, m, x, y, z, parent = group) => {
    const g = keep(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const set = {
    id,
    includes: includes || [id],
    standin: true,
    group,
    anchors,
    props,
    colliders: [],
    lights: [],
    shots: {},
    alarm: false,
    power: 1,
    update() {},
    setAlarm(on) {
      set.alarm = !!on;
    },
    setPower(k) {
      set.power = Math.max(0, Math.min(1, Number(k)));
    },
    setState() {},
    openLocker() {},
    dispose() {
      own.forEach((x) => x.dispose && x.dispose());
      if (group.parent) group.parent.remove(group);
    },
  };
  return { set, group, anchor, mat, box, keep };
}

// ---------- The pad (night, ground) ----------
function pad() {
  const { set, group, anchor, mat, box, keep } = base('pad');
  set.fog = new THREE.FogExp2(0x0b1522, 0.016);
  set.background = new THREE.Color(0x070c14);
  set.ambience = 'wind';
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(260, 260)), mat(0x2a2f33, { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  // The walkway from the parking area to the tower, lit.
  const path = new THREE.Mesh(keep(new THREE.PlaneGeometry(4, 36)), mat(0x4a4f52, { roughness: 0.7 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.01, 19);
  path.receiveShadow = true;
  group.add(path);
  const lineM = mat(0xd9a21b, { emissive: 0x6b4a00, emissiveIntensity: 0.6 });
  for (let z = 3; z < 37; z += 3) box(0.12, 0.02, 1.4, lineM, 0, 0.02, z);
  // The van at the parking area.
  const van = box(2.2, 2.1, 5, mat(0xdfe3e6, { roughness: 0.5 }), -5.2, 1.15, 31);
  van.castShadow = true;
  box(2.25, 0.5, 1.2, mat(0x1a2836, { roughness: 0.2, metalness: 0.4 }), -5.2, 1.7, 28.7);
  // The tower: a lattice to 62 m with the crew access arm at 40 m.
  const steel = mat(0x8c3b26, { roughness: 0.6, metalness: 0.5 });
  const TW = { x0: -3, x1: 3, z0: -6, z1: 0 };
  [[TW.x0, TW.z0], [TW.x1, TW.z0], [TW.x0, TW.z1], [TW.x1, TW.z1]].forEach(([x, z]) => {
    const post = box(0.5, 62, 0.5, steel, x, 31, z);
    post.castShadow = true;
  });
  for (let y = 4; y < 62; y += 4) {
    box(6.5, 0.3, 0.3, steel, 0, y, TW.z0);
    box(6.5, 0.3, 0.3, steel, 0, y, TW.z1);
    box(0.3, 0.3, 6.5, steel, TW.x0, y, -3);
    box(0.3, 0.3, 6.5, steel, TW.x1, y, -3);
  }
  // Elevator car at the base, lit door.
  box(2, 2.6, 0.1, mat(0x101820, { emissive: 0xffd36a, emissiveIntensity: 0.35 }), -1.2, 1.3, 0.1);
  // Platform at the top of the elevator, the arm, the white room.
  const deck = mat(0x5d646b, { roughness: 0.7, metalness: 0.4 });
  box(6, 0.3, 6, deck, 0, 39.85, -3);
  box(8.5, 0.3, 2.2, deck, 5.2, 39.85, -3);
  const white = mat(0xf2f2ee, { roughness: 0.6 });
  box(3.9, 0.12, 3.8, white, 7.35, 40.06, -3);
  box(3.9, 2.6, 0.12, white, 7.35, 41.3, -4.9);
  box(3.9, 2.6, 0.12, white, 7.35, 41.3, -1.1);
  box(3.9, 0.12, 3.8, white, 7.35, 42.6, -3);
  // Railings along the arm.
  const rail = mat(0xb0b6bb, { metalness: 0.6, roughness: 0.4 });
  box(4.2, 0.06, 0.06, rail, 3.3, 41, -4.1);
  box(4.2, 0.06, 0.06, rail, 3.3, 41, -1.9);
  // The rocket: an orange core stage, two white boosters, the capsule on top.
  const R = { x: 12.4, z: -3 };
  const core = new THREE.Mesh(keep(new THREE.CylinderGeometry(2.6, 2.6, 42, 32)), mat(0xd0702e, { roughness: 0.65 }));
  core.position.set(R.x, 21, R.z);
  core.castShadow = true;
  group.add(core);
  [-1, 1].forEach((s) => {
    const b = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.1, 1.1, 34, 20)), mat(0xeeeeea, { roughness: 0.55 }));
    b.position.set(R.x, 17, R.z + s * 3.7);
    b.castShadow = true;
    group.add(b);
    const nose = new THREE.Mesh(keep(new THREE.ConeGeometry(1.1, 3, 20)), mat(0xeeeeea));
    nose.position.set(R.x, 35.5, R.z + s * 3.7);
    group.add(nose);
  });
  const stage2 = new THREE.Mesh(keep(new THREE.CylinderGeometry(2.0, 2.6, 4, 32)), mat(0xe8e8e4));
  stage2.position.set(R.x, 44, R.z);
  group.add(stage2);
  const cap = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.0, 2.0, 2.4, 32)), mat(0xdedfe0, { metalness: 0.3, roughness: 0.4 }));
  cap.position.set(R.x, 47.2, R.z);
  group.add(cap);
  const las = new THREE.Mesh(keep(new THREE.ConeGeometry(0.9, 6, 16)), mat(0xf4f4f0));
  las.position.set(R.x, 51.4, R.z);
  group.add(las);
  // Frost and venting: a few drifting puffs off the core.
  const puffTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return keep(new THREE.CanvasTexture(c));
  })();
  const puffM = keep(new THREE.SpriteMaterial({ map: puffTex, color: 0xdfe8f0, transparent: true, depthWrite: false, opacity: 0.5 }));
  const puffs = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(puffM);
    s.userData.seed = Math.random() * 10;
    group.add(s);
    puffs.push(s);
  }
  // Floodlights: lamps on masts, and the light they throw.
  const lampM = mat(0xffffff, { emissive: 0xfff1d0, emissiveIntensity: 3 });
  const masts = [
    [-14, 22],
    [14, 16],
    [-12, -10],
  ];
  masts.forEach(([x, z], i) => {
    box(0.4, 24, 0.4, mat(0x3a4148), x, 12, z);
    box(2.4, 1, 0.6, lampM, x, 24, z);
    const sp = new THREE.SpotLight(0xfff0d8, i === 0 ? 900 : 600, 120, 0.55, 0.6, 1.6);
    sp.position.set(x, 24, z);
    sp.target.position.set(R.x * 0.5, 0, (z + R.z) * 0.4);
    if (i === 0) {
      sp.castShadow = true;
      sp.shadow.mapSize.set(1024, 1024);
      sp.shadow.bias = -0.0004;
    }
    group.add(sp, sp.target);
    set.lights.push(sp);
  });
  const hemi = new THREE.HemisphereLight(0x5a7090, 0x1a1a1a, 0.55);
  group.add(hemi);
  const warm = new THREE.PointLight(0xffc27a, 9, 14, 2);
  warm.position.set(0, 4.5, 4);
  group.add(warm);
  const park = new THREE.PointLight(0xcfe0ff, 14, 16, 2);
  park.position.set(-1, 4.5, 31);
  group.add(park);
  set.lights.push(park);
  const top = new THREE.PointLight(0xffe2b0, 5, 12, 2);
  top.position.set(4, 43.5, -3);
  group.add(top);
  set.lights.push(hemi, warm, top);
  // Red aircraft-warning beacon on the tower top.
  const beacon = box(0.5, 0.5, 0.5, mat(0x400000, { emissive: 0xff2010, emissiveIntensity: 2 }), 0, 62.4, -3);
  // Crates in the white room (o2 tank, CO2 cartridges, camera).
  const crate = (name, color, x) => {
    const c = box(0.62, 0.46, 0.5, mat(color, { roughness: 0.6 }), x, 40.35, -4.35);
    c.name = name;
    c.castShadow = true;
    set.props[name] = c;
    return c;
  };
  crate('crate_o2', 0x2f6fa8, 6.3);
  crate('crate_co2', 0xb4302c, 7.35);
  crate('crate_cam', 0x2b2b2b, 8.4);

  // Anchors (docs/LASTLIGHT.md).
  anchor('start', 0, 0, 37, Math.PI);
  anchor('van', -3.4, 0, 30.5, Math.PI / 2);
  anchor('nadia', -2.6, 0, 26.5, Math.PI * 0.75);
  anchor('kwame', 2.2, 0, 9, -Math.PI * 0.8);
  anchor('tower_base', 0, 0, 2.6, Math.PI);
  anchor('elevator', -1.2, 0, 1.0, 0);
  anchor('arm_start', 1.6, 40, -3, -Math.PI / 2);
  anchor('whiteroom', 7.0, 40, -3, -Math.PI / 2);
  anchor('crate_o2', 6.3, 40, -3.8, Math.PI);
  anchor('crate_co2', 7.35, 40, -3.8, Math.PI);
  anchor('crate_cam', 8.4, 40, -3.8, Math.PI);
  anchor('hatch', 8.4, 40, -3, -Math.PI / 2);
  anchor('seat_you', 9.1, 40, -3, -Math.PI / 2); // just through the hatch
  anchor('rocket', R.x, 20, R.z);

  set.walkable = {
    zones: [
      { minX: -11, maxX: 11, minZ: 1, maxZ: 40, y: 0 },
      { minX: -3, maxX: 3, minZ: -6, maxZ: 0, y: 40 },
      { minX: 0, maxX: 9.3, minZ: -4, maxZ: -2, y: 40 },
      { minX: 5.4, maxX: 9.3, minZ: -4.85, maxZ: -1.15, y: 40 },
    ],
    boxes: [{ minX: -7, maxX: -3.6, minZ: 28, maxZ: 34 }],
  };
  set.cameraShapes = {
    circles: [{ x: R.x, z: R.z, r: 2.8, h: 60 }],
    boxes: [
      { minX: -6.4, maxX: -4, minY: 0, maxY: 2.3, minZ: 28.4, maxZ: 33.6 },
      { minX: 5.4, maxX: 9.3, minY: 42.5, maxY: 43, minZ: -5, maxZ: -1 },
    ],
  };
  set.shots = {
    rocket: { from: V(-6, 3, 20), at: V(R.x, 30, R.z), duration: 4 },
    tower: { from: V(4, 1.6, 8), at: V(0, 40, -3), duration: 3.5 },
    arm: { from: V(-2, 44, 6), at: V(7, 40.5, -3), duration: 3.5 },
  };
  let t = 0;
  set.update = (dt) => {
    t += dt;
    puffs.forEach((s, i) => {
      const k = (t * 0.08 + s.userData.seed) % 1;
      const a = s.userData.seed * 3 + i;
      s.position.set(R.x + Math.cos(a) * (2.8 + k * 3), 4 + (i % 9) * 4.5 + k * 3, R.z + Math.sin(a) * (2.8 + k * 3));
      s.scale.setScalar(2 + k * 5);
    });
    puffM.opacity = 0.16;
    beacon.material.emissiveIntensity = Math.sin(t * 3) > 0.3 ? 2.5 : 0.2;
  };
  set.setPower = (k) => {
    set.power = Math.max(0, Math.min(1, Number(k)));
    set.lights.forEach((l) => (l.visible = set.power > 0.05));
  };
  set.exposure = 1.0;
  return set;
}

// ---------- Capsule + tunnel + habitat (zero g) ----------
function interior() {
  const { set, group, anchor, mat, box, keep } = base('interior', ['capsule', 'tunnel', 'habitat']);
  set.background = new THREE.Color(0x020306);
  set.ambience = 'fans';
  const rooms = {
    capsule: { minX: -2.1, maxX: 2.1, minY: 0, maxY: 2.9, minZ: -2.1, maxZ: 2.1 },
    tunnel: { minX: 1.9, maxX: 5.3, minY: 0.55, maxY: 2.35, minZ: -0.85, maxZ: 0.85 },
    habitat: { minX: 5.1, maxX: 11.2, minY: 0, maxY: 3.1, minZ: -2.1, maxZ: 2.1 },
  };
  const wallM = mat(0xc9ced1, { roughness: 0.85, side: THREE.BackSide });
  const habM = mat(0xd8d2c4, { roughness: 0.9, side: THREE.BackSide });
  const tunM = mat(0x8d969c, { roughness: 0.6, metalness: 0.3, side: THREE.BackSide });
  Object.keys(rooms).forEach((k) => {
    const b = rooms[k];
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ)), k === 'capsule' ? wallM : k === 'habitat' ? habM : tunM);
    m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
    m.receiveShadow = true;
    group.add(m);
  });
  // Openings: dark rings where the tunnel meets the rooms.
  const ringM = mat(0x2a3036, { metalness: 0.5, roughness: 0.4 });
  [2.08, 5.12].forEach((x) => {
    const r = new THREE.Mesh(keep(new THREE.TorusGeometry(0.95, 0.07, 8, 32)), ringM);
    r.rotation.y = Math.PI / 2;
    r.position.set(x, 1.45, 0);
    group.add(r);
  });
  const dark = mat(0x1b2026, { roughness: 0.6, metalness: 0.3 });
  const frame = mat(0x3a4148, { roughness: 0.5, metalness: 0.4 });
  // Seats (aft), the panels (forward), the window (left).
  const seatM = mat(0x59636c, { metalness: 0.35, roughness: 0.55 });
  [['you', -1.35], ['yusuf', -0.45], ['lena', 0.45], ['grace', 1.35]].forEach(([id, x]) => {
    box(0.7, 0.12, 1.1, seatM, x, 0.42, -1.25);
    box(0.7, 0.9, 0.12, seatM, x, 0.85, -1.85);
    anchor('seat_' + id, x, 0, -0.7, 0); // floor under the seat's front edge
  });
  const screen = (x, y, z, ry, color) => {
    const s = box(0.62, 0.42, 0.04, mat(0x0a1016, { emissive: color, emissiveIntensity: 0.9 }), x, y, z);
    s.rotation.y = ry;
    return s;
  };
  box(3.2, 1.0, 0.25, dark, 0, 1.55, 2.0);
  const screens = [screen(-1.0, 1.6, 1.86, 0, 0x2a6f9a), screen(0, 1.6, 1.86, 0, 0x2a7f5a), screen(1.0, 1.6, 1.86, 0, 0x7a5a1a)];
  // Anchors are feet points (zero g too): the body floats from there, so the
  // hands are about a metre above.
  anchor('panel_left', -1.0, 0.55, 1.25, 0);
  anchor('panel_center', 0, 0.55, 1.25, 0);
  anchor('panel_right', 1.0, 0.55, 1.25, 0);
  const win = box(0.05, 0.6, 0.8, mat(0x05070a, { emissive: 0x0d2240, emissiveIntensity: 0.6, roughness: 0.1 }), -2.05, 1.9, 0.9);
  anchor('window', -1.35, 0.9, 0.9, -Math.PI / 2);
  // The O2 valve wheel.
  const valve = new THREE.Mesh(keep(new THREE.TorusGeometry(0.16, 0.025, 8, 24)), mat(0xb4302c, { metalness: 0.4 }));
  valve.position.set(-0.8, 2.4, 2.0);
  group.add(valve);
  set.props.valve = valve;
  anchor('valve', -0.8, 1.3, 1.3, 0);
  // Eight breakers on the right wall, each with a light.
  const breakers = {};
  for (let i = 0; i < 8; i++) {
    const row = i < 4 ? 0 : 1;
    const z = -0.9 + (i % 4) * 0.6;
    const y = 2.15 - row * 0.5;
    box(0.06, 0.3, 0.2, dark, 2.05, y, z);
    const lamp = box(0.04, 0.06, 0.06, mat(0x0c3a20, { emissive: 0x3fe08a, emissiveIntensity: 1.2 }), 2.02, y + 0.12, z);
    breakers['breaker_' + (i + 1)] = lamp;
    anchor('breaker_' + (i + 1), 1.4, y - 1.0, z, Math.PI / 2);
  }
  // Lockers: 1-6 in the capsule (aft wall, up high), 7-10 in the habitat.
  const lockers = {};
  const lockerM = mat(0xe6e0cf, { roughness: 0.9 });
  const locker = (n, x, y, z, ry, ax, ay, az) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    group.add(g);
    box(0.5, 0.42, 0.06, frame, 0, 0, 0, g);
    const door = new THREE.Group();
    door.position.set(-0.25, 0, 0.04);
    g.add(door);
    box(0.5, 0.42, 0.03, lockerM, 0.25, 0, 0, door);
    box(0.08, 0.03, 0.03, dark, 0.42, 0, 0.03, door);
    lockers['locker_' + n] = { door, open: 0, target: 0 };
    anchor('locker_' + n, ax, ay, az, ry);
  };
  [-1.2, 0, 1.2].forEach((x, i) => locker(i + 1, x, 2.2, -2.05, 0, x, 1.2, -1.3));
  [-1.2, 0, 1.2].forEach((x, i) => locker(i + 4, x, 1.6, -2.05, 0, x, 0.6, -1.3));
  [6.3, 7.6, 8.9, 10.2].forEach((x, i) => locker(i + 7, x, 1.6, 2.05, Math.PI, x, 0.6, 1.3));
  anchor('hab_lockers', 8.3, 0.6, 1.3, Math.PI);
  // Medkit.
  box(0.34, 0.26, 0.1, mat(0xf2f2ee), -2.0, 1.2, -0.6).rotation.y = Math.PI / 2;
  anchor('medkit', -1.4, 0.2, -0.6, -Math.PI / 2);
  // Habitat: the bench, a big window, sleep bags.
  box(1.4, 0.06, 0.6, seatM, 8.0, 1.05, -1.75);
  box(1.36, 0.02, 0.56, mat(0x24303a), 8.0, 1.09, -1.75);
  set.props.bench = group.children[group.children.length - 1];
  anchor('hab_bench', 8.0, 0.3, -1.0, 0);
  box(0.05, 1.0, 1.4, mat(0x05070a, { emissive: 0x0a1a33, emissiveIntensity: 0.7 }), 11.15, 1.6, 0);
  anchor('hab_window', 10.4, 0.6, 0, -Math.PI / 2);
  box(0.6, 1.6, 0.25, mat(0x6b4a2a, { roughness: 1 }), 5.6, 1.4, -1.9);
  anchor('tunnel_a', 2.6, 0.65, 0, -Math.PI / 2);
  anchor('tunnel_b', 4.7, 0.65, 0, -Math.PI / 2);
  anchor('start', 0, 0.6, 0.2, Math.PI);
  // Handrails along the tunnel.
  for (let x = 2.2; x < 5.2; x += 0.75) box(0.05, 0.05, 0.05, frame, x, 2.2, 0.75);
  // Lights: LED strips per room and a red alarm light.
  const led = mat(0xffffff, { emissive: 0xfff3dc, emissiveIntensity: 1.4 });
  const strips = [box(3.2, 0.04, 0.12, led, 0, 2.86, 0), box(2.8, 0.04, 0.12, led, 3.6, 2.31, 0), box(5, 0.04, 0.12, led, 8.2, 3.06, 0)];
  const lamps = [
    [0, 2.5, 0, 6],
    [3.6, 2.0, 0, 3],
    [8.2, 2.7, 0, 7],
  ].map(([x, y, z, i]) => {
    const l = new THREE.PointLight(0xfff1e0, i, 7, 1.6);
    l.position.set(x, y, z);
    group.add(l);
    return l;
  });
  lamps[0].castShadow = true;
  lamps[0].shadow.mapSize.set(512, 512);
  const red = new THREE.PointLight(0xff2a1a, 0, 9, 1.4);
  red.position.set(1.5, 2.4, 1.2);
  group.add(red);
  const fill = new THREE.HemisphereLight(0xb9c8d8, 0x30343a, 0.35);
  group.add(fill);
  set.lights.push(...lamps, red, fill);
  let t = 0;
  let powerK = 1;
  set.update = (dt) => {
    t += dt;
    const p = set.power;
    powerK += (p - powerK) * Math.min(1, dt * 3);
    lamps.forEach((l, i) => (l.intensity = [6, 3, 7][i] * powerK));
    strips.forEach((s) => (s.material.emissiveIntensity = 1.4 * powerK));
    fill.intensity = 0.08 + 0.3 * powerK;
    screens.forEach((s, i) => (s.material.emissiveIntensity = 0.9 * Math.max(0.05, powerK) * (set.alarm && i === 1 ? 0.6 + 0.4 * Math.sin(t * 8) : 1)));
    red.intensity = set.alarm ? (Math.sin(t * 5) > 0 ? 6 : 0.6) : 0;
    Object.values(lockers).forEach((l) => {
      l.open += (l.target - l.open) * Math.min(1, dt * 5);
      l.door.rotation.y = -l.open * 1.9;
    });
  };
  set.setState = (name, value) => {
    const b = breakers[name];
    if (b) {
      b.material.emissive.setHex(value ? 0x3fe08a : 0x601010);
      b.material.emissiveIntensity = value ? 1.2 : 0.5;
      return true;
    }
    if (name === 'valve' && valve) valve.rotation.z = value ? Math.PI * 1.5 : 0;
    return false;
  };
  set.openLocker = (name) => {
    if (lockers[name]) lockers[name].target = 1;
  };
  set.volume = { boxes: Object.values(rooms) };
  set.walkable = {};
  set.shots = {
    cabin: { from: V(1.6, 2.3, 1.6), at: V(-0.6, 1.0, -1.0), duration: 3 },
    window: { from: V(-0.8, 1.5, 0.2), at: V(-2.0, 1.9, 0.9), duration: 3 },
    habitat: { from: V(10.6, 2.6, 1.6), at: V(6.5, 1.0, -1.0), duration: 3 },
    bench: { from: V(8.5, 1.9, 0.2), at: V(8.0, 1.05, -1.75), duration: 2.5 },
  };
  set.exposure = 1.05;
  return set;
}

const BUILDERS = { pad, capsule: interior, tunnel: interior, habitat: interior, interior };
export function hasStandin(id) {
  return !!BUILDERS[id];
}
export function createStandin(id) {
  const b = BUILDERS[id] || pad;
  return b();
}
