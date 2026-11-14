// The test hall: the player's spacecraft, three environmental test stations
// (shake table, thermal-vacuum chamber, deployment rig with gravity offload)
// and the player's astronaut, who walks between them (the shared character
// controller, js/3d/controller.js) and runs each test by hand. The screen (js/screen-testlab.js) owns the rules and the data; this
// module only shows them. 1 unit = 1 metre, like the designer's clean room.
import { THREE, studioEnv } from './engine.js';
import { buildCraft } from './craft.js';
import { canvasTex } from './assets.js';
import { createAstronaut } from './astronaut.js';
import { createController } from './controller.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
const reduceMotion = () => {
  const S = globalThis.SMD && globalThis.SMD.settings;
  try {
    if (S && S.reducedMotion !== undefined) return !!S.reducedMotion;
  } catch (e) {}
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// A text label that always faces the camera (same look as the designer's).
function makeLabel(text, sub, h = 0.5) {
  const font = '700 44px Archivo, "Noto Kufi Arabic", "Arial Narrow", sans-serif';
  const subFont = '500 30px Archivo, "Noto Kufi Arabic", "Arial Narrow", sans-serif';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  let w = probe.measureText(text).width;
  if (sub) {
    probe.font = subFont;
    w = Math.max(w, probe.measureText(sub).width);
  }
  const W = Math.ceil(w + 48);
  const H = sub ? 112 : 72;
  const tex = canvasTex(W, H, (ctx) => {
    ctx.fillStyle = 'rgba(244,247,245,0.94)';
    const r = 12;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(W, 0, W, H, r);
    ctx.arcTo(W, H, 0, H, r);
    ctx.arcTo(0, H, 0, 0, r);
    ctx.arcTo(0, 0, W, 0, r);
    ctx.fill();
    ctx.fillStyle = '#d9a21b';
    ctx.fillRect(0, 10, 6, H - 20);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#23282e';
    ctx.font = font;
    ctx.fillText(text, W / 2, sub ? 38 : H / 2);
    if (sub) {
      ctx.fillStyle = '#545d66';
      ctx.font = subFont;
      ctx.fillText(sub, W / 2, 82);
    }
  });
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const s = new THREE.Sprite(mat);
  s.renderOrder = 10;
  s.scale.set((h * W) / H, h, 1);
  s.center.set(0.5, 0);
  return s;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Yellow and black floor tape, like a real clean room.
function stripeTex() {
  const t = canvasTex(256, 32, (ctx, w, h) => {
    ctx.fillStyle = '#d9a21b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#23282e';
    for (let x = -h; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 16, h);
      ctx.lineTo(x + 16 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.fill();
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// A small console desk with two screens that glow in the station's colour.
function makeDesk(mats, screenMat) {
  const g = new THREE.Group();
  g.add(box(1.5, 0.08, 0.75, mats.deskTop, 0, 0.82, 0));
  g.add(box(1.4, 0.78, 0.6, mats.deskBody, 0, 0.39, -0.04));
  [-0.36, 0.36].forEach((x) => {
    const s = new THREE.Group();
    s.add(box(0.62, 0.42, 0.04, mats.dark, 0, 0, 0));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36), screenMat);
    face.position.z = 0.022;
    s.add(face);
    s.add(box(0.05, 0.22, 0.05, mats.dark, 0, -0.3, -0.02));
    s.position.set(x, 1.18, -0.18);
    s.rotation.set(-0.12, x < 0 ? 0.16 : -0.16, 0);
    // Screens face the person standing in front of the desk (+Z).
    g.add(s);
  });
  return g;
}

// A screen texture: a few chart lines in the station's colour.
function screenTex(color) {
  return canvasTex(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#0f1820';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(169,182,194,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * h) / 4);
      ctx.lineTo(w, (i * h) / 4);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = 30 + row * 46 + Math.sin(x * 0.05 + row * 2) * 10 * Math.exp(-Math.pow((x - 90 - row * 40) / 30, 2)) + Math.sin(x * 0.4 + row) * 2;
        if (x) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  });
}

// opts: { design, info:{dryKg, propKg}, labels:{vibe,tvac,deploy,home}, subs:{...},
//         onNear(id|null), onUse(id), onPick(id), onArrive(id) }
export function createTestHall(canvasEl, opts = {}) {
  const SMD = globalThis.SMD || {};
  const scene = new THREE.Scene();
  const bg = 0xdfe6e2;
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, 70, 190);
  let disposed = false;
  studioEnv().then((t) => {
    if (!disposed && t) scene.environment = t;
  });
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

  // ---------- Lighting: soft studio key, cool rim, warm bounce ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb5c2bb, 1.0));
  const key = new THREE.DirectionalLight(0xfffaf0, 2.1);
  key.position.set(12, 22, 14);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 0.9);
  rim.position.set(-14, 9, -12);
  scene.add(rim);

  // ---------- Materials (shared, disposed with the scene) ----------
  const textures = [];
  const T = (t) => (textures.push(t), t);
  const mats = {
    metal: new THREE.MeshStandardMaterial({ color: 0x7d8790, roughness: 0.42, metalness: 0.65 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb9c1c7, roughness: 0.35, metalness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.5, metalness: 0.4 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x3d444b, roughness: 0.35, metalness: 0.7 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x3b5b78, roughness: 0.45, metalness: 0.35 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9aa39f, roughness: 0.95 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f4f3, roughness: 0.6 }),
    deskTop: new THREE.MeshStandardMaterial({ color: 0xf4f7f5, roughness: 0.5 }),
    deskBody: new THREE.MeshStandardMaterial({ color: 0xc9d2cd, roughness: 0.7 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.4, metalness: 0.3 }),
    cable: new THREE.MeshBasicMaterial({ color: 0x23282e }),
    ring: new THREE.MeshBasicMaterial({ color: 0x17807a, transparent: true, opacity: 0.85, depthWrite: false }),
    stripe: new THREE.MeshStandardMaterial({ map: T(stripeTex()), roughness: 0.7 }),
  };
  const screenMats = {
    vibe: new THREE.MeshBasicMaterial({ map: T(screenTex('#3fc1b4')) }),
    tvac: new THREE.MeshBasicMaterial({ map: T(screenTex('#f0b429')) }),
    deploy: new THREE.MeshBasicMaterial({ map: T(screenTex('#e9eef2')) }),
  };

  // ---------- The spacecraft (sized first: the hall is laid out around it) ----------
  const craft = buildCraft(opts.design || { instruments: [], arrays: 6, dish: 1 }, opts.info || {});
  const cparts = craft.userData.parts;
  const hasPart = {
    arrayL: !!cparts.arrayL,
    arrayR: !!cparts.arrayR,
    dish: !!cparts.dish && (opts.design ? opts.design.dish >= 2 : false),
    boom: !!cparts.mag,
  };
  const partK = { arrayL: 1, arrayR: 1, dish: 1, boom: 1 };
  function applyPart(key, k) {
    partK[key] = k;
    if (key === 'arrayL' || key === 'arrayR') {
      const w = cparts[key];
      if (w) w.scale.x = 0.08 + 0.92 * k;
    } else if (key === 'dish') {
      if (cparts.dish) cparts.dish.scale.set(0.25 + 0.75 * k, 1, 0.25 + 0.75 * k);
    } else if (key === 'boom') {
      const inner = cparts.mag && cparts.mag.children[0];
      if (inner) inner.scale.y = 0.1 + 0.9 * k;
    }
  }
  const measure = () => new THREE.Box3().setFromObject(craft);
  const depBox = measure();
  const depSize = depBox.getSize(new THREE.Vector3());
  ['arrayL', 'arrayR', 'dish', 'boom'].forEach((k) => hasPart[k] && applyPart(k, 0));
  const stowBox = measure();
  const stowSize = stowBox.getSize(new THREE.Vector3());
  craft.position.y = -stowBox.min.y;
  const stowR = Math.max(stowSize.x, stowSize.z) / 2;
  const stowH = stowSize.y;
  const holder = new THREE.Group(); // the crane moves this between stations
  holder.add(craft);
  scene.add(holder);
  const shakeG = new THREE.Group(); // jitter applied here, on top of the holder
  holder.add(shakeG);
  shakeG.add(craft);

  // ---------- Layout ----------
  const depW = Math.max(depSize.x, stowSize.x);
  const R = Math.max(3.2, stowR + 1.7); // chamber radius
  const CH = Math.max(5.2, stowH + 3); // chamber height
  const rigHalf0 = Math.max(depW / 2 + 0.8, 3);
  // Stations are spaced by their real footprints so even a 10 m radar
  // dipole or a 25 m wingspan never pokes into the next station.
  const ST = {
    home: { x: 0, z: 1, top: 0.9 },
    vibe: { x: -Math.max(9, stowR + 7.5, R + stowR + 2), z: -2, top: 1.12 },
    tvac: { x: 0, z: -Math.max(10.5, R + 7.5, stowR + R + 3), top: 0.55 },
    deploy: { x: Math.max(10, depW / 2 + 4.5, R + rigHalf0 + 2), z: -2, top: 1.4 },
  };
  // Desks stand in front of each station; the player stands in front of the desk.
  const DESK = {
    vibe: { x: ST.vibe.x + 2.2, z: ST.vibe.z + 3.9 },
    tvac: { x: ST.tvac.x + R * 0.55 + 1.6, z: ST.tvac.z + R + 2.6 },
    deploy: { x: ST.deploy.x - 2.0, z: ST.deploy.z + Math.max(4.2, stowR + 3) },
  };
  const STAND = {};
  Object.keys(DESK).forEach((id) => (STAND[id] = { x: DESK[id].x, z: DESK[id].z + 1.15 }));
  const hall = {
    minX: ST.vibe.x - 8,
    maxX: ST.deploy.x + Math.max(8, depW / 2 + 4),
    minZ: ST.tvac.z - R - 5,
    maxZ: Math.max(13, stowR + 10),
  };
  const WALK = { minX: hall.minX + 1.2, maxX: hall.maxX - 1.2, minZ: ST.vibe.z - 3.2, maxZ: hall.maxZ - 1.2 };

  // ---------- The room ----------
  const grid = T(
    canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#e7ece9';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#cdd7d1';
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 16; i++) {
        ctx.beginPath();
        ctx.moveTo((i * w) / 16, 0);
        ctx.lineTo((i * w) / 16, h);
        ctx.moveTo(0, (i * h) / 16);
        ctx.lineTo(w, (i * h) / 16);
        ctx.stroke();
      }
      ctx.strokeStyle = '#b8c5be';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, w, h);
    })
  );
  grid.wrapS = grid.wrapT = THREE.RepeatWrapping;
  const fw = hall.maxX - hall.minX;
  const fd = hall.maxZ - hall.minZ;
  grid.repeat.set(fw / 4, fd / 4);
  grid.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), new THREE.MeshStandardMaterial({ map: grid, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((hall.minX + hall.maxX) / 2, 0, (hall.minZ + hall.maxZ) / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  // Back wall: a grid of HEPA filter panels, the mark of a clean room.
  const hepa = T(
    canvasTex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#d5ddd8';
      ctx.fillRect(0, 0, w, h);
      for (let a = 0; a < 8; a++)
        for (let b = 0; b < 4; b++) {
          ctx.fillStyle = '#f1f4f2';
          ctx.fillRect(a * 64 + 4, b * 64 + 4, 56, 56);
          ctx.strokeStyle = '#e1e7e3';
          for (let k = 10; k < 56; k += 6) {
            ctx.beginPath();
            ctx.moveTo(a * 64 + 4, b * 64 + 4 + k);
            ctx.lineTo(a * 64 + 60, b * 64 + 4 + k);
            ctx.stroke();
          }
        }
    })
  );
  hepa.wrapS = hepa.wrapT = THREE.RepeatWrapping;
  hepa.repeat.set(fw / 16, 2);
  const wallMat = new THREE.MeshStandardMaterial({ map: hepa, roughness: 0.9 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xe9eeeb, roughness: 1 });
  const WH = 16;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(fw, WH), wallMat);
  back.position.set(floor.position.x, WH / 2, hall.minZ);
  back.receiveShadow = true;
  scene.add(back);
  [hall.minX, hall.maxX].forEach((x, i) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(fd, WH), sideMat);
    s.position.set(x, WH / 2, floor.position.z);
    s.rotation.y = i ? -Math.PI / 2 : Math.PI / 2;
    s.receiveShadow = true;
    scene.add(s);
  });
  // Light strips high on the walls.
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let x = hall.minX + 4; x < hall.maxX - 2; x += 6) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.35), stripMat);
    l.position.set(x, WH - 1.4, hall.minZ + 0.02);
    scene.add(l);
  }
  // Overhead crane rails along the hall (the crane carries the spacecraft).
  const railY = 13.5;
  [hall.minZ + 2, Math.min(hall.maxZ - 3, 6)].forEach((z) => scene.add(box(fw - 1, 0.35, 0.3, mats.gold, floor.position.x, railY, z)));
  const bridge = box(0.4, 0.45, Math.abs(Math.min(hall.maxZ - 3, 6) - (hall.minZ + 2)) + 0.6, mats.gold, 0, railY - 0.4, (hall.minZ + 2 + Math.min(hall.maxZ - 3, 6)) / 2);
  bridge.castShadow = false;
  scene.add(bridge);
  const trolley = box(0.9, 0.5, 0.9, mats.dark, 0, railY - 0.8, 0);
  trolley.castShadow = false;
  scene.add(trolley);
  const hookCable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), mats.cable);
  hookCable.visible = false;
  scene.add(hookCable);

  // Safety tape square around a footprint.
  function tape(cx, cz, w, d) {
    const g = new THREE.Group();
    const seg = (len, x, z, rot) => {
      const tx = mats.stripe.map.clone();
      tx.needsUpdate = true;
      tx.repeat.set(len / 1.4, 1);
      textures.push(tx);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.22), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 }));
      m.rotation.set(-Math.PI / 2, 0, rot);
      m.position.set(x, 0.006, z);
      m.receiveShadow = true;
      g.add(m);
    };
    seg(w, cx, cz - d / 2, 0);
    seg(w, cx, cz + d / 2, 0);
    seg(d, cx - w / 2, cz, Math.PI / 2);
    seg(d, cx + w / 2, cz, Math.PI / 2);
    scene.add(g);
  }

  const pickables = []; // meshes that stand for a station (click to go there)
  const tagPick = (obj, id) => obj.traverse((o) => o.isMesh && ((o.userData.station = id), pickables.push(o)));

  // ---------- Station 1: shake table ----------
  const vibeG = new THREE.Group();
  vibeG.position.set(ST.vibe.x, 0, ST.vibe.z);
  vibeG.add(box(4.2, 0.3, 4.2, mats.concrete, 0, 0.15, 0)); // seismic mass
  const shakerBody = cyl(0.95, 1.05, 0.62, mats.blue, 0, 0.62, 0, 40);
  vibeG.add(shakerBody);
  [-1, 1].forEach((s) => {
    vibeG.add(box(0.3, 0.9, 1.6, mats.blue, s * 1.25, 0.6, 0)); // trunnion supports
    const axle = cyl(0.18, 0.18, 0.5, mats.metal, s * 1.05, 0.7, 0, 16);
    axle.rotation.z = Math.PI / 2;
    vibeG.add(axle);
  });
  const vibeHead = cyl(Math.max(1.1, Math.min(1.8, stowR * 0.7)), Math.max(1.1, Math.min(1.8, stowR * 0.7)), 0.12, mats.plate, 0, ST.vibe.top - 0.06, 0, 40);
  vibeG.add(vibeHead);
  // Bolt circle on the head expander.
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    vibeG.add(cyl(0.035, 0.035, 0.05, mats.steel, Math.cos(a) * 0.85, ST.vibe.top + 0.02, Math.sin(a) * 0.85, 8));
  }
  // An amplifier rack beside the shaker.
  vibeG.add(box(0.8, 1.9, 0.7, mats.dark, -2.6, 0.95, -1.2));
  for (let k = 0; k < 5; k++) vibeG.add(box(0.7, 0.04, 0.02, mats.steel, -2.6, 0.4 + k * 0.32, -0.84));
  scene.add(vibeG);
  tagPick(vibeG, 'vibe');
  tape(ST.vibe.x, ST.vibe.z, 5.4, 5.4);

  // ---------- Station 2: thermal-vacuum chamber ----------
  // An open-fronted cylinder with a sliding door, so the craft stays visible.
  const tvacG = new THREE.Group();
  tvacG.position.set(ST.tvac.x, 0, ST.tvac.z);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xc8d0d4, roughness: 0.35, metalness: 0.75, side: THREE.DoubleSide });
  const gap = 0.24 * Math.PI;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, CH, 56, 1, true, gap, Math.PI * 2 - gap * 2), shellMat);
  shell.position.y = CH / 2;
  shell.castShadow = shell.receiveShadow = true;
  tvacG.add(shell);
  // Inner shroud: black panels that turn blue when cold and orange when hot.
  const shroudMat = new THREE.MeshStandardMaterial({ color: 0x1b2229, roughness: 0.8, metalness: 0.2, emissive: new THREE.Color(0x000000), side: THREE.BackSide });
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.18, R - 0.18, CH - 0.3, 56, 1, true, gap, Math.PI * 2 - gap * 2), shroudMat);
  shroud.position.y = CH / 2;
  tvacG.add(shroud);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 56), shellMat);
  cap.rotation.x = Math.PI / 2;
  cap.position.y = CH;
  tvacG.add(cap);
  const capDome = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 12, 0, Math.PI * 2, 0, Math.PI * 0.18), shellMat);
  capDome.position.y = CH - R * Math.cos(Math.PI * 0.18);
  tvacG.add(capDome);
  for (let k = 0; k < 4; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.06, 0.07, 8, 56, Math.PI * 2 - gap * 2), mats.metal);
    ring.rotation.set(Math.PI / 2, 0, Math.PI / 2 + gap);
    ring.position.y = 0.4 + (k * (CH - 0.8)) / 3;
    tvacG.add(ring);
  }
  tvacG.add(cyl(R - 0.25, R - 0.25, 0.5, mats.plate, 0, 0.25, 0, 48)); // floor platform
  // The door: a glass-and-steel segment that slides round to close the gap.
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  const door = new THREE.Group();
  const doorGlass = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.12, R + 0.12, CH, 24, 1, true, -gap - 0.04, gap * 2 + 0.08), doorMat);
  doorGlass.position.y = CH / 2;
  door.add(doorGlass);
  [-1, 1].forEach((s) => {
    const a = s * (gap + 0.04);
    door.add(box(0.12, CH, 0.12, mats.metal, Math.sin(a) * (R + 0.12), CH / 2, Math.cos(a) * (R + 0.12)));
  });
  tvacG.add(door);
  const tvacLight = new THREE.PointLight(0xffffff, 0, R * 3, 1.5);
  tvacLight.position.set(0, CH * 0.6, 0);
  tvacG.add(tvacLight);
  // Cryopumps and a nitrogen line on the side.
  [-1, 1].forEach((s) => {
    const pump = cyl(0.45, 0.45, 1.4, mats.steel, s * (R + 0.9), 0.7, -R * 0.5, 24);
    tvacG.add(pump);
    tvacG.add(cyl(0.12, 0.12, 2.6, mats.metal, s * (R + 0.9), 2.6, -R * 0.5, 10));
  });
  scene.add(tvacG);
  tagPick(tvacG, 'tvac');

  // ---------- Station 3: deployment rig with gravity offload ----------
  const depG = new THREE.Group();
  depG.position.set(ST.deploy.x, 0, ST.deploy.z);
  depG.add(cyl(0.55, 0.85, ST.deploy.top - 0.08, mats.metal, 0, (ST.deploy.top - 0.08) / 2, 0, 32));
  depG.add(cyl(1.0, 1.0, 0.08, mats.plate, 0, ST.deploy.top - 0.04, 0, 40));
  const rigHalf = rigHalf0;
  const rigZ = Math.max(1.6, stowR + 0.9);
  const rigH = ST.deploy.top + Math.max(stowH, 2) + 2.2;
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      depG.add(box(0.16, rigH, 0.16, mats.gold, sx * rigHalf, rigH / 2, sz * rigZ));
    })
  );
  [-1, 1].forEach((sz) => depG.add(box(rigHalf * 2 + 0.16, 0.2, 0.2, mats.gold, 0, rigH, sz * rigZ)));
  [-1, 1].forEach((sx) => depG.add(box(0.2, 0.2, rigZ * 2 + 0.16, mats.gold, sx * rigHalf, rigH, 0)));
  // Offload cables: one pair per wing, they follow the wing tip.
  const offload = {};
  ['arrayL', 'arrayR'].forEach((k) => {
    if (!hasPart[k]) return;
    const g = new THREE.Group();
    const cables = [0, 1].map(() => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 6), mats.cable);
      g.add(c);
      return c;
    });
    const trolleyBox = box(0.3, 0.16, rigZ * 2, mats.dark, 0, rigH - 0.18, 0);
    trolleyBox.castShadow = false;
    g.add(trolleyBox);
    g.visible = false;
    depG.add(g);
    offload[k] = { g, cables, trolleyBox };
  });
  scene.add(depG);
  tagPick(depG, 'deploy');
  tape(ST.deploy.x, ST.deploy.z, Math.min(rigHalf * 2 + 1.4, 60), rigZ * 2 + 1.6);

  // ---------- Home: the transport dolly in the middle of the hall ----------
  const homeG = new THREE.Group();
  homeG.position.set(ST.home.x, 0, ST.home.z);
  homeG.add(box(2.4, 0.18, 2.4, mats.plate, 0, 0.75, 0));
  homeG.add(box(2.0, 0.5, 2.0, mats.deskBody, 0, 0.42, 0));
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => homeG.add(cyl(0.12, 0.12, 0.1, mats.dark, sx * 0.85, 0.12, sz * 0.85, 12))));
  scene.add(homeG);

  // ---------- Desks, standing rings and labels ----------
  const rings = {};
  const labels = {};
  let mode = 'walk'; // 'walk' | 'operate'
  let opStation = null;
  Object.keys(DESK).forEach((id) => {
    const d = makeDesk(mats, screenMats[id]);
    d.position.set(DESK[id].x, 0, DESK[id].z);
    d.rotation.y = Math.PI; // screens face the player at +Z
    scene.add(d);
    tagPick(d, id);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 40), mats.ring.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(STAND[id].x, 0.012, STAND[id].z);
    scene.add(ring);
    rings[id] = ring;
  });
  // Signs hang over each console: that is where the player has to go.
  function labelAt(id) {
    return new THREE.Vector3(DESK[id].x, 2.45, DESK[id].z - 0.3);
  }
  const labelNames = {};
  function setLabel(id, text, sub) {
    if (text) labelNames[id] = text;
    if (labels[id]) {
      scene.remove(labels[id]);
      labels[id].material.map.dispose();
      labels[id].material.dispose();
    }
    if (!text) return;
    const s = makeLabel(text, sub, sub ? 0.95 : 0.6);
    s.position.copy(labelAt(id));
    s.visible = mode === 'walk';
    scene.add(s);
    labels[id] = s;
  }
  ['vibe', 'tvac', 'deploy'].forEach((id) => opts.labels && opts.labels[id] && setLabel(id, opts.labels[id], opts.subs && opts.subs[id]));

  // Where the craft sits at each station.
  const SEAT = {
    home: new THREE.Vector3(ST.home.x, ST.home.top, ST.home.z),
    vibe: new THREE.Vector3(ST.vibe.x, ST.vibe.top, ST.vibe.z),
    tvac: new THREE.Vector3(ST.tvac.x, ST.tvac.top, ST.tvac.z),
    deploy: new THREE.Vector3(ST.deploy.x, ST.deploy.top, ST.deploy.z),
  };
  let craftAt = 'home';
  holder.position.copy(SEAT.home);

  // ---------- The astronaut ----------
  const astro = createAstronaut(SMD.avatar ? SMD.avatar.get() : null, { helmet: false, blob: true });
  astro.group.position.set(0, 0, Math.min(WALK.maxZ - 1, ST.home.z + Math.max(5, stowR + 3.5)));
  astro.group.rotation.y = Math.PI;
  scene.add(astro.group);
  const obstacles = [
    { x: ST.vibe.x, z: ST.vibe.z, r: 2.4 },
    { x: ST.tvac.x, z: ST.tvac.z, r: R + 0.4 },
    { x: ST.deploy.x, z: ST.deploy.z, r: Math.max(1.3, stowR + 0.4) },
    { x: ST.home.x, z: ST.home.z, r: Math.max(1.5, stowR * 0.8) },
    ...Object.keys(DESK).map((id) => ({ x: DESK[id].x, z: DESK[id].z, r: 0.8 })),
  ];
  const T2 = (k, en, p) => (SMD.t ? SMD.t(k, en, p) : en);
  const ctl = createController({
    camera,
    dom: canvasEl,
    character: astro,
    walkable: { bounds: WALK, circles: obstacles },
    // The camera stays inside the hall and out of the big test rigs.
    cameraCircles: [
      { x: ST.vibe.x, z: ST.vibe.z, r: 1.9, h: ST.vibe.top + stowH + 0.4 },
      { x: ST.tvac.x, z: ST.tvac.z, r: R, h: CH + 0.4 },
    ],
    rig: { distance: 6.2, height: 1.55, shoulder: 0.5, min: 2.2, max: 14, pitch: [-0.15, 1.15], pitch0: 0.34, fov: 52, floorY: 0, bounds: { minX: hall.minX + 0.6, maxX: hall.maxX - 0.6, minZ: hall.minZ + 0.6, maxZ: hall.maxZ + 12, maxY: railY - 1.5 } },
    speeds: { walk: 2.2, run: 4.8, accel: 12, turn: 11 },
    interactables: Object.keys(STAND).map((id) => ({
      id,
      at: new THREE.Vector3(STAND[id].x, 0, STAND[id].z),
      radius: 1.7,
      ring: false,
      promptAt: new THREE.Vector3(DESK[id].x, 1.9, DESK[id].z),
      label: () => T2('testlab.p.use', 'Use the console: {name}', { name: labelNames[id] || id }),
      enabled: () => !opts.canUse || opts.canUse(id),
      onInteract: () => opts.onUse && opts.onUse(id),
    })),
  });

  // ---------- Camera ----------
  // Walking: the controller's camera over the shoulder. At a console: a
  // framed shot of the station (ctl.focus), back to walking afterwards.
  let W = 1;
  let H = 1;
  const want = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  // Start wide (the whole hall), then settle behind the astronaut.
  if (!reduceMotion()) ctl.focus(new THREE.Vector3(0, 1.5, ST.vibe.z), { position: new THREE.Vector3(floor.position.x * 0.3, 16, hall.maxZ + 8), duration: 1.4, instant: true });

  // Each station is filmed from its own side, looking away from the others,
  // with the console (and the astronaut at it) in the corner of the frame.
  const VIEW_YAW = { vibe: 0.55, tvac: 0.22, deploy: 0.32 };
  function frameStation(id) {
    const c = id === 'deploy' ? new THREE.Vector3(ST.deploy.x, ST.deploy.top + stowH * 0.35, ST.deploy.z) : SEAT[id].clone().add(new THREE.Vector3(0, stowH * 0.45, 0));
    const size = id === 'deploy' ? Math.max(depW * 0.75, 5) : id === 'tvac' ? Math.max(R * 1.9, CH) : Math.max(stowH, stowR * 1.5, 3.2);
    const tall = H > W * 1.05; // phone in portrait: back off to fit the width
    const dist = (size * 1.05 + 4) * (tall ? 1.5 : 1);
    const yw = VIEW_YAW[id] || 0;
    const dir = new THREE.Vector3(Math.sin(yw), 0, Math.cos(yw));
    want.pos.copy(c).addScaledVector(dir, dist).add(new THREE.Vector3(0, dist * 0.3 + 1.2, 0));
    want.look.copy(c);
    ctl.focus(want.look.clone(), { position: want.pos.clone(), fov: 40 });
  }

  // ---------- Taps: a station walks there and opens it, the floor walks ----------
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitP = new THREE.Vector3();
  ctl.on('tap', (info) => {
    if (mode !== 'walk') return false;
    const ray = ctl.ray(info);
    const hits = ray.intersectObjects(pickables, false);
    if (hits.length) {
      const id = hits[0].object.userData.station;
      if (id && opts.onPick) opts.onPick(id);
      return true;
    }
    if (info.preferLook) return false;
    if (ray.ray.intersectPlane(groundPlane, hitP)) {
      walkCb = null;
      ctl.moveTo({ x: hitP.x, z: hitP.z });
      ctl.mark(hitP);
      return true;
    }
    return false;
  });

  // ---------- Walking to a station ----------
  let nearId = null;
  let walkCb = null;
  function walkTo(id, cb) {
    const s = STAND[id];
    if (!s) return;
    walkCb = cb || null;
    ctl.moveTo({ x: s.x, z: s.z }, {
      run: Math.hypot(s.x - astro.group.position.x, s.z - astro.group.position.z) > 7,
      onArrive: () => {
        faceStation(id);
        const fn = walkCb;
        walkCb = null;
        if (fn) fn(id);
      },
    });
  }
  // Put the astronaut at a station's console at once (quick paths, reduced motion).
  function placeAt(id) {
    const s = STAND[id];
    if (!s) return;
    walkCb = null;
    faceStation(id);
    ctl.teleport({ x: s.x, y: 0, z: s.z }, faceYaw);
    ctl.refreshTarget();
  }
  function stationCenter(id) {
    return new THREE.Vector3(ST[id].x, (ST[id].top || 1) + stowH * 0.5, ST[id].z);
  }
  let faceYaw = null;
  function faceStation(id) {
    const s = STAND[id];
    const c = stationCenter(id);
    faceYaw = Math.atan2(c.x - s.x, c.z - s.z);
    astro.lookAt(c);
  }

  // ---------- Crane: carry the craft to a station ----------
  let crane = null; // { from, to, t, dur, resolve }
  function moveCraft(id) {
    if (!SEAT[id]) return Promise.resolve();
    if (crane && crane.resolve) {
      crane.resolve();
      crane = null;
    }
    if (craftAt === id) return Promise.resolve();
    const from = holder.position.clone();
    craftAt = id;
    if (reduceMotion()) {
      holder.position.copy(SEAT[id]);
      return Promise.resolve();
    }
    const dist = from.distanceTo(SEAT[id]);
    return new Promise((resolve) => {
      crane = { from, to: SEAT[id].clone(), t: 0, dur: clamp(1.2 + dist * 0.07, 1.6, 3.2), resolve };
    });
  }
  const liftY = Math.max(stowH + 3.2, CH + 1.2);
  function updateCrane(dt) {
    if (!crane) {
      hookCable.visible = false;
      return;
    }
    crane.t += dt;
    const k = clamp(crane.t / crane.dur, 0, 1);
    const up = 0.25;
    const down2 = 0.75;
    const p = holder.position;
    const top = liftY;
    if (k < up) {
      const u = smooth(k / up);
      p.set(crane.from.x, lerp(crane.from.y, top, u), crane.from.z);
    } else if (k < down2) {
      const u = smooth((k - up) / (down2 - up));
      p.set(lerp(crane.from.x, crane.to.x, u), top, lerp(crane.from.z, crane.to.z, u));
    } else {
      const u = smooth((k - down2) / (1 - down2));
      p.set(crane.to.x, lerp(top, crane.to.y, u), crane.to.z);
    }
    // Cable from the trolley to the top of the craft.
    trolley.position.set(p.x, railY - 0.8, p.z);
    bridge.position.x = p.x;
    const topY = p.y + stowH + 0.1;
    const len = Math.max(0.1, railY - 1.05 - topY);
    hookCable.visible = true;
    hookCable.scale.y = len;
    hookCable.position.set(p.x, topY + len / 2, p.z);
    if (k >= 1) {
      p.copy(crane.to);
      const r = crane.resolve;
      crane = null;
      hookCable.visible = false;
      if (r) r();
    }
  }

  // ---------- Effects the screen drives ----------
  const fx = { shake: 0, door: 0, doorWant: 0, temp: 0, offload: false, parts: {} };
  function setShake(a) {
    fx.shake = clamp(a || 0, 0, 1.2);
  }
  function setChamber(o) {
    if (o.door !== undefined) fx.doorWant = clamp(o.door, 0, 1);
    if (o.temp !== undefined) fx.temp = clamp(o.temp, -1, 1);
  }
  function setOffload(on) {
    fx.offload = !!on;
    Object.values(offload).forEach((o) => (o.g.visible = !!on));
  }
  function setPartK(keyName, k) {
    if (!hasPart[keyName]) return;
    applyPart(keyName, clamp(k, 0, 1));
  }
  function stowAll() {
    ['arrayL', 'arrayR', 'dish', 'boom'].forEach((k) => hasPart[k] && applyPart(k, 0));
  }
  const tmpBox = new THREE.Box3();
  function updateOffload() {
    if (!fx.offload) return;
    Object.entries(offload).forEach(([k, o]) => {
      const w = cparts[k];
      if (!w) return;
      tmpBox.setFromObject(w);
      const tipX = k === 'arrayL' ? tmpBox.min.x : tmpBox.max.x;
      const midX = (tipX + (k === 'arrayL' ? tmpBox.max.x : tmpBox.min.x)) / 2;
      const lx = (k === 'arrayL' ? Math.min(tipX + 0.4, midX) : Math.max(tipX - 0.4, midX)) - depG.position.x;
      const y = (tmpBox.min.y + tmpBox.max.y) / 2;
      o.trolleyBox.position.x = lx;
      o.cables.forEach((c, i) => {
        const z = (i ? 1 : -1) * Math.min(rigZ * 0.6, (tmpBox.max.z - tmpBox.min.z) * 0.35) + (tmpBox.min.z + tmpBox.max.z) / 2 - depG.position.z;
        const len = Math.max(0.1, rigH - 0.25 - y);
        c.scale.y = len;
        c.position.set(lx, y + len / 2, z);
      });
    });
  }

  function setMode(m, id) {
    mode = m === 'operate' ? 'operate' : 'walk';
    opStation = mode === 'operate' ? id : null;
    // Signs hide while you work at a station, so they never block the view.
    Object.values(labels).forEach((l) => (l.visible = mode === 'walk'));
    ctl.stop();
    ctl.setEnabled(mode === 'walk');
    if (mode === 'operate' && id) {
      faceStation(id);
      frameStation(id);
    } else {
      faceYaw = null;
      astro.lookAt(null);
      ctl.focus(null);
    }
  }

  function react(kind) {
    if (kind === 'cheer') astro.cheer();
    else if (kind === 'celebrate') astro.celebrate();
    else if (kind === 'sad') astro.sad();
    else if (kind === 'wave') astro.wave();
  }

  // ---------- Frame update ----------
  let time = 0;
  let lastS = 0;
  const lookNow = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const coldC = new THREE.Color(0x3a7bd5);
  const hotC = new THREE.Color(0xff7a2a);
  return {
    scene,
    camera,
    shadows: true,
    exposure: 1.02,
    walkTo,
    placeAt,
    moveCraft,
    setMode,
    setShake,
    setChamber,
    setOffload,
    setPart: setPartK,
    stowAll,
    setLabel,
    react,
    hasPart,
    astronaut: astro,
    get near() {
      return nearId;
    },
    // The shared character controller (docs/CONTROLS.md), for scripts.
    controller: ctl,
    get craftAt() {
      return craftAt;
    },
    get mode() {
      return mode;
    },
    onResize(w, h) {
      W = w;
      H = h;
      ctl.setRig({ distance: H > W * 1.05 ? 8 : 6.2 });
      if (mode === 'operate' && opStation) frameStation(opStation);
    },
    update(dtFrame) {
      // Wall-clock time, so a slow frame rate (a school laptop) never leaves
      // the crane or the camera crawling in slow motion.
      const nowS = performance.now() / 1000;
      const dt = Math.min(0.25, Math.max(dtFrame, nowS - (lastS || nowS)));
      lastS = nowS;
      time += dt;
      const rm = reduceMotion();
      // The controller walks (keys, stick, thumb, taps) and films.
      ctl.update(dt);
      // Turn to face the station while operating it.
      if (faceYaw !== null && !ctl.state.moving) {
        const g = astro.group;
        const d = Math.atan2(Math.sin(faceYaw - g.rotation.y), Math.cos(faceYaw - g.rotation.y));
        g.rotation.y += d * Math.min(1, dt * 6);
      }
      if (ctl.state.inputActive) walkCb = null;
      // Which station is the astronaut standing at?
      // (the controller's target: the console in front of you).
      const p = astro.group.position;
      const tg = ctl.state.target;
      const best = tg ? tg.id : null;
      if (best !== nearId) {
        nearId = best;
        if (opts.onNear) opts.onNear(nearId);
      }
      Object.entries(rings).forEach(([id, r]) => {
        const on = id === nearId || id === opStation;
        r.material.opacity = on ? 0.95 : 0.45 + (rm ? 0 : 0.2 * Math.sin(time * 3));
        r.scale.setScalar(on ? 1.15 : 1);
      });

      updateCrane(dt);

      // Shake table: the head expander and the craft ride the shaker.
      const amp = rm ? fx.shake * 0.15 : fx.shake;
      if (amp > 0.001) {
        const j = 0.012 * amp;
        shakeG.position.set(Math.sin(time * 97) * j * 0.4, Math.sin(time * 131) * j + Math.sin(time * 57) * j * 0.6, Math.sin(time * 113) * j * 0.4);
        vibeHead.position.y = ST.vibe.top - 0.06 + shakeG.position.y;
      } else if (shakeG.position.lengthSq() > 0) {
        shakeG.position.set(0, 0, 0);
        vibeHead.position.y = ST.vibe.top - 0.06;
      }
      // Chamber door and shroud colour.
      fx.door += (fx.doorWant - fx.door) * Math.min(1, dt * (rm ? 20 : 2.4));
      door.rotation.y = (1 - fx.door) * (Math.PI * 0.62);
      const tAbs = Math.abs(fx.temp);
      shroudMat.emissive.copy(fx.temp < 0 ? coldC : hotC).multiplyScalar(tAbs * 0.75);
      tvacLight.color.copy(fx.temp < 0 ? coldC : hotC);
      tvacLight.intensity = tAbs * 14;
      updateOffload();

      // A little camera rumble at full shake (not with reduced motion).
      if (!rm && mode === 'operate' && opStation === 'vibe' && fx.shake > 0.5) {
        tmpV.set(Math.sin(time * 71), Math.sin(time * 83), 0).multiplyScalar(0.012 * fx.shake);
        camera.position.add(tmpV);
      }
      // Shadows follow the action.
      key.target.position.set(p.x * 0.5, 0, (p.z + ST.tvac.z) * 0.5);
      key.position.set(key.target.position.x + 12, 22, key.target.position.z + 14);
      const sc = key.shadow.camera;
      const ext = Math.max(fw, fd) * 0.62;
      if (sc.right !== ext) {
        sc.left = sc.bottom = -ext;
        sc.right = sc.top = ext;
        sc.far = 80;
        sc.updateProjectionMatrix();
      }
    },
    dispose() {
      disposed = true;
      ctl.dispose();
      Object.keys(labels).forEach((id) => setLabel(id, null));
      if (crane && crane.resolve) crane.resolve();
      crane = null;
      textures.forEach((t) => t.dispose());
      astro.dispose();
    },
  };
}
