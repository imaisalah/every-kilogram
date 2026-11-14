// The designer's clean room: your spacecraft on a turntable, rebuilt live as you
// pick parts, with the player's own astronaut (1.75 m, helmet off) and a real
// NASA spacecraft at true scale standing nearby so the student can feel how
// big real hardware is.
//
// Hands-on mode (scene.hands): the room grows racks and benches full of parts.
// The astronaut walks the floor with the shared character controller
// (js/3d/controller.js: WASD / stick / thumb joystick, the camera over the
// shoulder, E at a rack; clicks and taps still walk there), picks a part off
// a rack, carries it in both arms and mounts it on the spacecraft. The screen
// (js/screen-design.js) owns the rules; this file owns the room, the walking,
// the carrying and the picking, and reports what the player did via
// opts.onHand({ type, ... }).
import { THREE, ease, studioEnv } from './engine.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { buildCraft } from './craft.js';
import { canvasTex } from './assets.js';
import { createAstronaut } from './astronaut.js';
import { createController } from './controller.js';

const STAND_H = 1.2;
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// A text label that always faces the camera. `h` is its height in metres.
function makeLabel(text, sub, h = 0.5, depth = false) {
  const font = '700 44px Archivo, "Noto Kufi Arabic", "Arial Narrow", sans-serif';
  const subFont = '500 30px Archivo, "Noto Kufi Arabic", "Arial Narrow", sans-serif';
  const rtl = globalThis.SMD && globalThis.SMD.dir && globalThis.SMD.dir() === 'rtl';
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
    ctx.fillRect(rtl ? W - 6 : 0, 10, 6, H - 20);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (rtl) ctx.direction = 'rtl';
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
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: depth, transparent: true });
  const s = new THREE.Sprite(mat);
  s.renderOrder = depth ? 2 : 10;
  s.scale.set((h * W) / H, h, 1);
  s.center.set(0.5, 0);
  return s;
}

// The scale figure is the player's astronaut (js/3d/astronaut.js): 1.75 m to
// the top of the head with the helmet off, exactly the height of the rod.

// A thin scale rod next to the engineer with ticks every 25 cm.
function makeScaleRod() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x23282e });
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.015, 1.75, 0.015), mat);
  rod.position.y = 0.875;
  g.add(rod);
  for (let i = 0; i <= 7; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(i % 4 === 0 ? 0.14 : 0.07, 0.012, 0.012), mat);
    tick.position.set(0.03, i * 0.25, 0);
    g.add(tick);
  }
  return g;
}

// ---------- Hands-on room: layout ----------
// The walkable floor, the racks around it (their back to the wall, their
// front to the spacecraft) and how close counts as "at" something.
const ROOM = { minX: -8.6, maxX: 8.6, minZ: -5.95, maxZ: 5.0 };
const STATIONS = {
  tests: { x: -7.0, z: -6.95, ry: 0, w: 1.9, d: 0.6 },
  inst: { x: -3.5, z: -6.95, ry: 0, w: 3.7, d: 0.7 },
  launch: { x: 3.4, z: -6.95, ry: 0, w: 3.1, d: 0.7 },
  power: { x: 7.0, z: -6.95, ry: 0, w: 2.9, d: 0.85 },
  prop: { x: -9.65, z: -2.4, ry: Math.PI / 2, w: 2.9, d: 0.9 },
  shield: { x: -9.65, z: 2.0, ry: Math.PI / 2, w: 2.5, d: 0.7 },
  capsule: { x: -9.65, z: 2.0, ry: Math.PI / 2, w: 3.0, d: 0.7 }, // crew missions, in place of the shield pallet
  comms: { x: 9.65, z: -2.4, ry: -Math.PI / 2, w: 3.0, d: 0.85 },
  brains: { x: 9.65, z: 2.0, ry: -Math.PI / 2, w: 2.5, d: 0.62 },
};
const NEAR = 1.55; // metres from a rack's front spot
// Around the stand (grown to the spacecraft's footprint by setDesign):
const GROUND = { keep: 1.75, stop: 2.45, near: 3.4 }; // keep-out radius, where walks end, "at the spacecraft"
const PLINTH = { x: -3.4, z: -2.7 }; // where the chosen launcher's model stands
const TURN_HANDS = Math.PI + 0.6; // in hands-on mode the instrument deck faces the room
const CARRY_FIT = 0.72; // the largest side of anything carried, in metres

// Pedestal x positions on the launcher wall for n models.
function launchXs(n, w) {
  const step = n > 1 ? Math.min(1.02, (w - 0.7) / (n - 1)) : 0;
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * step);
}
function boxAt(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}
function merged(geos, mat, shadow = true) {
  const g = mergeGeometries(geos, false);
  geos.forEach((x) => x.dispose());
  const m = new THREE.Mesh(g, mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// Icon atlas for the flight cases: the same line icons as the parts tray.
// Cell 0 is a plain case side; then, per icon, a label and a starred label.
const CELL = 128;
const COLS = 8;
function makeAtlas(icons) {
  const keys = Object.keys(icons || {});
  const rows = Math.max(1, Math.ceil((1 + keys.length * 2) / COLS));
  const W = CELL * COLS;
  const H = CELL * rows;
  const at = (i) => [(i % COLS) * CELL, Math.floor(i / COLS) * CELL];
  const frame = (ctx, x, y) => {
    ctx.fillStyle = '#f4f5f4';
    ctx.fillRect(x, y, CELL, CELL);
    ctx.strokeStyle = '#8f979e';
    ctx.lineWidth = 7;
    ctx.strokeRect(x + 5, y + 5, CELL - 10, CELL - 10);
    ctx.fillStyle = '#5d656c';
    [
      [8, 8],
      [CELL - 22, 8],
      [8, CELL - 22],
      [CELL - 22, CELL - 22],
    ].forEach(([a, b]) => ctx.fillRect(x + a, y + b, 14, 14));
  };
  const star = (ctx, cx, cy, r) => {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  const tex = canvasTex(W, H, (ctx) => {
    for (let i = 0; i < 1 + keys.length * 2; i++) {
      const [x, y] = at(i);
      frame(ctx, x, y);
      if (i === 0) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 20, y + 20, CELL - 40, CELL - 40);
      if (i % 2 === 0) {
        ctx.fillStyle = '#23282e';
        star(ctx, x + CELL - 30, y + 30, 15);
      }
    }
  });
  tex.anisotropy = 4;
  // Icons are SVG paths: draw them through an <img> once it decodes.
  const cells = keys
    .map((k, n) =>
      [1 + n * 2, 2 + n * 2]
        .map((i) => {
          const [x, y] = at(i);
          return `<g transform="translate(${x + 30} ${y + 30}) scale(${(CELL - 60) / 24})" fill="none" stroke="#1e2328" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" color="#1e2328">${icons[k]}</g>`;
        })
        .join('')
    )
    .join('');
  const img = new Image();
  img.onload = () => {
    try {
      tex.image.getContext('2d').drawImage(img, 0, 0);
      tex.needsUpdate = true;
    } catch (e) {}
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${cells}</svg>`);
  const uvOf = (i) => {
    const [x, y] = at(i);
    const p = 3;
    return [(x + p) / W, 1 - (y + CELL - p) / H, (x + CELL - p) / W, 1 - (y + p) / H];
  };
  return {
    tex,
    side: uvOf(0),
    label: (key, starred) => {
      const n = keys.indexOf(key);
      return n < 0 ? uvOf(0) : uvOf(1 + n * 2 + (starred ? 1 : 0));
    },
  };
}

// A flight case: the front (+z) face carries the label.
function caseGeo(w, h, d, front, side) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const r = f === 4 ? front : side;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1]));
    }
  }
  return g;
}

// A dish at real size (the item is scaled down on the bench).
function dishGeo(D) {
  const f = 0.38 * D;
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const r = (D / 2) * (i / 14);
    pts.push(new THREE.Vector2(r, (r * r) / (4 * f)));
  }
  const rimY = (D * D) / 4 / (4 * f);
  const bowl = new THREE.LatheGeometry(pts, 36);
  const rim = new THREE.TorusGeometry(D / 2, 0.025 + D * 0.006, 6, 36);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, rimY, 0);
  const horn = new THREE.CylinderGeometry(0.06 + D * 0.015, 0.035, 0.14 + D * 0.03, 12);
  horn.translate(0, f, 0);
  const geos = [bowl, rim, horn];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
    const from = new THREE.Vector3(Math.cos(a) * D * 0.46, rimY * 0.93, Math.sin(a) * D * 0.46);
    const to = new THREE.Vector3(0, f, 0);
    const dir = new THREE.Vector3().subVectors(to, from);
    const strut = new THREE.CylinderGeometry(0.014 + D * 0.003, 0.014 + D * 0.003, dir.length(), 5);
    strut.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
    strut.translate(from.x + dir.x / 2, from.y + dir.y / 2, from.z + dir.z / 2);
    geos.push(strut);
  }
  const g = mergeGeometries(geos, false);
  geos.forEach((x) => x.dispose());
  return g;
}

// Scale rocket models (1:25): light, medium with two strap-on boosters,
// heavy with two full-size side boosters.
function rocketGeos(id) {
  const body = [];
  const band = [];
  const stack = (r, h, nose, x = 0) => {
    const c = new THREE.CylinderGeometry(r, r, h, 18);
    c.translate(x, h / 2, 0);
    body.push(c);
    const n = new THREE.ConeGeometry(r * (nose > 0 ? 1.15 : 1), Math.abs(nose), 18);
    n.translate(x, h + Math.abs(nose) / 2, 0);
    body.push(n);
    const b = new THREE.CylinderGeometry(r * 1.02, r * 1.02, h * 0.06, 18);
    b.translate(x, h * 0.62, 0);
    band.push(b);
  };
  const orange = [];
  if (id === 'superheavy') {
    // SLS-like: an orange core with two white boosters, then the upper stage,
    // the crew capsule and its escape tower (98 m tall, so 3.9 m at 1:25).
    const core = new THREE.CylinderGeometry(0.168, 0.168, 2.6, 20);
    core.translate(0, 1.3, 0);
    orange.push(core);
    const up = new THREE.CylinderGeometry(0.1, 0.168, 0.5, 20);
    up.translate(0, 2.85, 0);
    body.push(up);
    const cap = new THREE.CylinderGeometry(0.06, 0.1, 0.2, 18);
    cap.translate(0, 3.2, 0);
    body.push(cap);
    const las = new THREE.ConeGeometry(0.06, 0.4, 14);
    las.translate(0, 3.5, 0);
    band.push(las);
    [-1, 1].forEach((sx) => {
      const b = new THREE.CylinderGeometry(0.074, 0.074, 2.15, 14);
      b.translate(sx * 0.255, 1.075, 0);
      body.push(b);
      const n = new THREE.ConeGeometry(0.074, 0.26, 14);
      n.translate(sx * 0.255, 2.28, 0);
      body.push(n);
    });
    const ring = new THREE.CylinderGeometry(0.171, 0.171, 0.08, 20);
    ring.translate(0, 2.6, 0);
    band.push(ring);
  } else if (id === 'light') {
    stack(0.07, 1.05, 0.22);
    for (let k = 0; k < 3; k++) {
      const fin = new THREE.BoxGeometry(0.01, 0.16, 0.08);
      fin.translate(0, 0.08, 0.1);
      fin.rotateY((k / 3) * Math.PI * 2);
      band.push(fin);
    }
  } else if (id === 'medium') {
    stack(0.095, 1.85, 0.32);
    [-1, 1].forEach((s) => {
      const b = new THREE.CylinderGeometry(0.035, 0.035, 0.6, 10);
      b.translate(s * 0.13, 0.3, 0);
      body.push(b);
      const n = new THREE.ConeGeometry(0.035, 0.1, 10);
      n.translate(s * 0.13, 0.65, 0);
      body.push(n);
    });
  } else {
    stack(0.1, 2.15, 0.36);
    [-1, 1].forEach((s) => {
      const b = new THREE.CylinderGeometry(0.1, 0.1, 1.85, 16);
      b.translate(s * 0.205, 0.925, 0);
      body.push(b);
      const n = new THREE.ConeGeometry(0.1, 0.22, 16);
      n.translate(s * 0.205, 1.96, 0);
      body.push(n);
      const bb = new THREE.CylinderGeometry(0.102, 0.102, 0.11, 16);
      bb.translate(s * 0.205, 1.15, 0);
      band.push(bb);
    });
  }
  const out = [];
  [
    [body, 'white'],
    [band, 'band'],
    [orange, 'foam'],
  ].forEach(([list, mat]) => {
    if (!list.length) return;
    out.push([mergeGeometries(list, false), mat]);
    list.forEach((x) => x.dispose());
  });
  return out;
}

export function createDesigner(canvasEl, opts = {}) {
  const scene = new THREE.Scene();
  const bg = 0xdfe6e2;
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, 60, 170);
  studioEnv().then((t) => {
    scene.environment = t;
  });
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 600);
  camera.position.set(9, 6, 11);

  // ---------- Lighting: soft studio key, cool rim, warm bounce ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb5c2bb, 1.0));
  const key = new THREE.DirectionalLight(0xfffaf0, 2.3);
  key.position.set(10, 18, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  scene.add(key.target);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.0);
  rim.position.set(-12, 7, -10);
  scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xffe6c0, 0.35);
  bounce.position.set(-4, -2, 10);
  scene.add(bounce);

  // ---------- The room ----------
  const grid = canvasTex(512, 512, (ctx, w, h) => {
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
  });
  grid.wrapS = grid.wrapT = THREE.RepeatWrapping;
  grid.repeat.set(16, 16);
  grid.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(90, 72), new THREE.MeshStandardMaterial({ map: grid, roughness: 0.85, metalness: 0.0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // A curved backdrop (cyclorama) so the room has a horizon, not a void.
  const cyc = new THREE.Mesh(
    new THREE.CylinderGeometry(88, 88, 46, 72, 1, true, Math.PI * 0.55, Math.PI * 1.1),
    new THREE.MeshStandardMaterial({ color: 0xe9eeeb, roughness: 1, side: THREE.BackSide })
  );
  cyc.position.y = 23;
  scene.add(cyc);
  // Tall light strips on the backdrop: the clean-room ceiling lights.
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.62 + (i / 8) * Math.PI * 0.96;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 30), stripMat);
    strip.position.set(Math.sin(a) * 87, 21, Math.cos(a) * 87);
    strip.lookAt(0, 21, 0);
    scene.add(strip);
  }

  // Safety line around the stand (yellow and black, like real clean rooms).
  const stripes = canvasTex(512, 32, (ctx, w, h) => {
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
  stripes.wrapS = THREE.RepeatWrapping;
  stripes.repeat.set(10, 1);
  const safety = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.42, 96, 1), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.7 }));
  safety.rotation.x = -Math.PI / 2;
  safety.position.y = 0.006;
  safety.receiveShadow = true;
  scene.add(safety);

  // Stand and turntable.
  const metal = new THREE.MeshStandardMaterial({ color: 0x7d8790, roughness: 0.42, metalness: 0.65 });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 1.0, STAND_H - 0.08, 40), metal);
  stand.position.y = (STAND_H - 0.08) / 2;
  stand.castShadow = stand.receiveShadow = true;
  scene.add(stand);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0x3d444b, roughness: 0.35, metalness: 0.7 }));
  plate.position.y = STAND_H - 0.04;
  plate.receiveShadow = true;
  scene.add(plate);

  // The player's astronaut stands beside the stand and looks up at the craft.
  const astro = createAstronaut(globalThis.SMD.avatar ? globalThis.SMD.avatar.get() : null, { helmet: false, blob: false });
  const person = astro.group;
  const craftLook = new THREE.Vector3(0, STAND_H + 1.5, 0);
  astro.lookAt(craftLook);
  const rod = makeScaleRod();
  let personLabel = null;
  scene.add(person, rod);
  const scaleSpot = { x: 2.2, z: 2.2 };

  // ---------- Camera ----------
  const controls = new OrbitControls(camera, canvasEl);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.5;
  controls.maxDistance = 140;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 2.4, 0);
  let framing = 0; // seconds left of the automatic camera move
  // Panels float over the top and bottom of the clean room; keep the craft in
  // the clear band between them (the HQ campus does the same).
  let vw = 1;
  let vh = 1;
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  const freeK = () => Math.max(0.45, (vh - insets.top - insets.bottom) / vh);
  function applyInsets() {
    const dy = (insets.top - insets.bottom) / 2;
    const dx = ((insets.right || 0) - (insets.left || 0)) / 2;
    if (Math.abs(dy) > 0.5 || Math.abs(dx) > 0.5) camera.setViewOffset(vw, vh, dx, -dy, vw, vh);
    else camera.clearViewOffset();
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
  }
  function setInsets(i) {
    const before = freeK();
    Object.assign(insets, i || {});
    applyInsets();
    if (Math.abs(before - freeK()) > 0.02) layout(false);
  }
  let dragging = false;
  const goal = { target: new THREE.Vector3(0, 2.4, 0), dist: 12 };
  const down = { x: 0, y: 0, t: 0, on: false };
  const onDown = (e) => {
    framing = 0;
    dragging = true;
    down.x = e.clientX;
    down.y = e.clientY;
    down.t = performance.now();
    down.on = true;
  };
  const onUp = (e) => {
    dragging = false;
    if (!down.on) return;
    down.on = false;
    if (e.target !== canvasEl) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7 || performance.now() - down.t > 700) return;
    handClick(e);
  };
  const onWheel = () => (framing = 0);
  canvasEl.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  canvasEl.addEventListener('wheel', onWheel, { passive: true });

  // ---------- The spacecraft ----------
  const turntable = new THREE.Group();
  turntable.position.y = STAND_H;
  scene.add(turntable);
  let craft = null;
  let prevSizes = {};
  let craftSize = 4;
  let craftHeight = 3;
  const anims = []; // { obj, t, dur, from, axis, out }
  let view = 'craft';
  let highlight = null;
  const hiMats = new Map(); // original material -> glowing clone

  function partSizes(c, design) {
    const p = c.userData.parts;
    const out = {};
    if (p.tank) out.tank = p.tank.children[0].geometry.parameters.radius;
    if (p.arrayL) out.arrayL = out.arrayR = p.arrayL.children[0].userData.length;
    if (p.dish) out.dish = design.dish;
    if (p.vault) out.vault = design.shield;
    return out;
  }

  function disposeObj(o) {
    o.traverse((x) => x.geometry && x.geometry.dispose());
  }

  function setDesign(design, info = {}) {
    const old = craft;
    const oldKeys = old ? Object.keys(old.userData.parts) : [];
    craft = buildCraft(design, info);
    const box = new THREE.Box3().setFromObject(craft);
    // Footprint at walking height: parts whose underside is above head height
    // (wings, booms) are walked under, not around.
    const lift = STAND_H + 0.04 - box.min.y; // craft-local y to height above the floor
    let reach = 0;
    const cb = new THREE.Box3();
    craft.children.forEach((c) => {
      cb.setFromObject(c);
      if (cb.isEmpty() || cb.min.y + lift > 2.1) return;
      const ax = Math.max(-cb.min.x, cb.max.x);
      const az = Math.max(-cb.min.z, cb.max.z);
      // Between a box corner and a circle: round parts are not square.
      reach = Math.max(reach, (Math.hypot(ax, az) + Math.max(ax, az)) / 2);
    });
    GROUND.keep = clamp(reach * 0.9 + 0.35, 1.75, 6);
    GROUND.stop = GROUND.keep + 0.7;
    GROUND.near = GROUND.stop + 0.95;
    standObstacle.r = GROUND.keep;
    if (H.ctl) H.ctl.setCameraShapes({ circles: [{ x: 0, z: 0, r: Math.max(0.9, reach * 0.6), h: STAND_H + craftHeight + 0.3 }] });
    craftRing.geometry.dispose();
    craftRing.geometry = new THREE.RingGeometry(GROUND.stop - 0.15, GROUND.stop + 0.1, 72);
    craft.position.y = -box.min.y + 0.04;
    turntable.add(craft);
    const parts = craft.userData.parts;
    const sizes = partSizes(craft, design);
    const quick = reduceMotion();

    if (old) {
      // Parts that left the design shrink away instead of vanishing.
      oldKeys.forEach((k) => {
        if (parts[k] || quick) return;
        const h = old.userData.parts[k];
        turntable.attach(h);
        anims.push({ obj: h, t: 0, dur: 0.28, out: true });
      });
      turntable.remove(old);
      disposeObj(old);
      // New parts pop in; resized parts (tank, wings, dish) grow from their old size.
      Object.keys(parts).forEach((k) => {
        if (quick) return;
        if (!oldKeys.includes(k)) anims.push({ obj: parts[k], t: 0, dur: 0.5, pop: true });
        else if (sizes[k] && prevSizes[k] && Math.abs(sizes[k] - prevSizes[k]) > 1e-3) {
          const from = prevSizes[k] / sizes[k];
          anims.push({ obj: parts[k], t: 0, dur: k === 'tank' ? 0.7 : 0.45, from, axis: k.startsWith('array') ? 'x' : null });
        }
      });
      anims.forEach((a) => a.obj && !a.out && applyAnim(a));
    } else if (!quick) {
      // First build: the parts assemble one after another.
      Object.keys(parts).forEach((k, i) => anims.push({ obj: parts[k], t: -0.08 * i, dur: 0.5, pop: true }));
      anims.forEach((a) => applyAnim(a));
    }
    prevSizes = sizes;
    // A new part pops in: the astronaut gives it a little cheer.
    if (old && !quick && Object.keys(parts).some((k) => !oldKeys.includes(k)) && !astro.action && !H.carry) astro.cheer();
    craftHeight = box.max.y - box.min.y;
    craftLook.y = STAND_H + Math.max(0.6, craftHeight * 0.5);
    craftSize = craft.userData.size;
    if (highlight) applyHighlight(highlight);
    layout(!info.keepCamera);
  }

  // Where everything stands, and where the camera wants to be.
  let analog = null;
  let analogLabel = null;
  let analogSize = 0;
  let analogDims = null;
  function layout(force) {
    const r = Math.max(1.6, craftSize * 0.5);
    scaleSpot.x = Math.max(2.1, Math.min(r * 0.62, 6));
    scaleSpot.z = Math.max(2.2, Math.min(r * 0.55, 5));
    // In hands-on mode the astronaut walks; the rod keeps its place.
    if (!H.on || view === 'compare') {
      person.position.set(scaleSpot.x, 0, scaleSpot.z);
      // Half turned toward the craft so the head can look up at it.
      person.rotation.y = -0.85;
    }
    rod.position.set(scaleSpot.x + 0.42, 0, scaleSpot.z);
    H.rodObstacle.x = rod.position.x;
    H.rodObstacle.z = rod.position.z;
    if (personLabel) personLabel.position.set(rod.position.x, 1.86, rod.position.z);
    if (analog) {
      const ar = Math.max(analogDims.x, analogDims.z) / 2;
      // Behind and to the side, so it frames the craft instead of hiding it.
      analog.position.x = -(r + ar * 0.85 + 1.8);
      analog.position.z = -(ar * 0.45 + 0.5);
      if (analogLabel) analogLabel.position.set(analog.position.x, analogDims.y + 0.5, analog.position.z);
    }
    const before = goal.dist;
    if (view === 'compare' && analog) {
      const left = analog.position.x - Math.max(analogDims.x, analogDims.z) / 2;
      const right = r + 1;
      const cx = (left + right) / 2;
      const width = right - left;
      const tall = Math.max(craftHeight + STAND_H, analogDims.y);
      goal.target.set(cx, Math.max(2, tall * 0.42), analog.position.z * 0.4);
      goal.dist = (Math.max(width * 1.15, tall * 2.2) + 4) / freeK();
    } else {
      goal.target.set(0, STAND_H + Math.max(0.9, craftHeight * 0.48), 0);
      goal.dist = Math.max(7.5, craftSize * 1.3 + 4.5) / Math.sqrt(freeK());
    }
    if (!H.on && (force || view === 'compare' || Math.abs(before - goal.dist) > 0.6)) framing = 1.4;
    if (H.on && view === 'compare' && force) framing = 1.4;
    // Keep shadows crisp around whatever is on the floor (the racks too).
    const ext = Math.max(H.on ? 16 : 14, craftSize, analog ? Math.abs(analog.position.x) + analogSize : 0) + 4;
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -ext;
    sc.right = sc.top = ext;
    sc.far = 120;
    sc.updateProjectionMatrix();
  }

  // ---------- The real NASA spacecraft for comparison ----------
  let analogToken = 0;
  function setAnalog(spec) {
    const token = ++analogToken;
    clearAnalog();
    if (!spec || !spec.id || !globalThis.SMD.assets || !globalThis.SMD.assets.model) return Promise.resolve(false);
    let p;
    try {
      p = globalThis.SMD.assets.model(spec.id);
    } catch (e) {
      return Promise.resolve(false);
    }
    return Promise.resolve(p)
      .then((obj) => {
        if (token !== analogToken || !obj) return false;
        const holder = new THREE.Group();
        holder.add(obj);
        // Scale the model so its largest dimension matches the real spacecraft.
        let box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        obj.scale.multiplyScalar(spec.sizeM / maxDim);
        box = new THREE.Box3().setFromObject(obj);
        const c = box.getCenter(new THREE.Vector3());
        obj.position.x -= c.x;
        obj.position.z -= c.z;
        obj.position.y -= box.min.y - 0.25;
        obj.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        const dims = box.getSize(new THREE.Vector3());
        dims.y += 0.25;
        // A low plinth so it reads as an exhibit.
        const pr = Math.max(dims.x, dims.z) * 0.32;
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr * 1.04, 0.25, 48), new THREE.MeshStandardMaterial({ color: 0xc9d2cd, roughness: 0.8 }));
        plinth.position.y = 0.125;
        plinth.receiveShadow = true;
        holder.add(plinth);
        holder.userData.plinth = plinth;
        analog = holder;
        analogDims = dims;
        analogSize = Math.max(dims.x, dims.z);
        scene.add(holder);
        holder.visible = view === 'compare';
        if (spec.label) {
          analogLabel = makeLabel(spec.label, spec.sub, clamp(spec.sizeM * 0.1, 0.7, 2.6));
          analogLabel.visible = holder.visible;
          scene.add(analogLabel);
        }
        layout(false);
        return true;
      })
      .catch(() => false);
  }

  function clearAnalog() {
    if (analog) {
      scene.remove(analog);
      const pl = analog.userData.plinth;
      if (pl) {
        pl.geometry.dispose();
        pl.material.dispose();
      }
    }
    if (analogLabel) {
      scene.remove(analogLabel);
      analogLabel.material.map.dispose();
      analogLabel.material.dispose();
    }
    analog = analogLabel = null;
    analogDims = null;
    analogSize = 0;
  }

  function setPersonLabel(text) {
    if (personLabel) {
      scene.remove(personLabel);
      personLabel.material.map.dispose();
      personLabel.material.dispose();
    }
    personLabel = makeLabel(text, null, 0.24);
    scene.add(personLabel);
    layout(false);
  }

  function setView(v) {
    const was = view;
    view = v === 'compare' && analog ? 'compare' : 'craft';
    if (analog) {
      const show = view === 'compare';
      if (show && !analog.visible && !reduceMotion()) anims.push({ obj: analog, t: -0.25, dur: 0.9, pop: true });
      analog.visible = show;
      if (analogLabel) analogLabel.visible = show;
    }
    if (H.on && was !== view) {
      if (view === 'compare') {
        // The astronaut steps next to the rod: the human scale for the comparison.
        H.saved = { x: person.position.x, z: person.position.z, ry: person.rotation.y };
        cancelPath();
        ctl.stop();
        ctl.setEnabled(false);
        H.room.visible = false;
        dropCarryVisual();
        setHandsCamera(false, true);
        astro.lookAt(craftLook);
      } else {
        H.room.visible = true;
        if (H.saved) ctl.teleport({ x: H.saved.x, y: 0, z: H.saved.z }, H.saved.ry);
        astro.lookAt(null);
        if (H.carry) showCarryVisual(H.carry.id);
        setHandsCamera(true);
      }
    }
    layout(true);
    return view;
  }

  // ---------- Hover highlight ----------
  function glowFor(mat) {
    if (hiMats.has(mat)) return hiMats.get(mat);
    const g = mat.clone();
    g.emissive = new THREE.Color(0xd9a21b);
    g.emissiveIntensity = 0.6;
    g.userData = { glow: true };
    hiMats.set(mat, g);
    return g;
  }
  function eachMesh(keys, fn) {
    if (!craft) return;
    const parts = craft.userData.parts;
    keys.forEach((k) => {
      Object.keys(parts)
        // The crew stack names its parts differently: wings and a service module.
        .filter((pk) => pk === k || (k === 'rtg' && pk.startsWith('rtg')) || (k === 'arrays' && (pk.startsWith('array') || pk.startsWith('wing'))) || (k === 'tank' && pk === 'sm'))
        .forEach((pk) => parts[pk].traverse((o) => o.isMesh && fn(o)));
    });
  }
  function applyHighlight(keys) {
    eachMesh(keys, (o) => {
      if (Array.isArray(o.material)) {
        o.userData.orig = o.material;
        o.material = o.material.map(glowFor);
      } else {
        o.userData.orig = o.material;
        o.material = glowFor(o.material);
      }
    });
  }
  function clearHighlight(keys) {
    eachMesh(keys, (o) => {
      if (o.userData.orig) {
        o.material = o.userData.orig;
        delete o.userData.orig;
      }
    });
  }
  function highlightPart(key) {
    const keys = key ? (Array.isArray(key) ? key : [key]) : null;
    if (highlight) clearHighlight(highlight);
    highlight = keys && keys.length ? keys : null;
    if (highlight) applyHighlight(highlight);
  }

  function applyAnim(a) {
    const k = clamp(a.t / a.dur, 0, 1);
    if (a.out) {
      a.obj.scale.setScalar(Math.max(0.001, 1 - ease.out(k)));
      return;
    }
    if (a.pop) {
      a.obj.scale.setScalar(k >= 1 ? 1 : Math.max(0.01, ease.outBack(k)));
      return;
    }
    const s = a.from + (1 - a.from) * (k >= 1 ? 1 : ease.outBack(k));
    if (a.axis === 'x') a.obj.scale.x = s;
    else a.obj.scale.setScalar(s);
  }

  // =====================================================================
  // Hands-on mode
  // =====================================================================
  const emit = (e) => {
    try {
      if (opts.onHand) opts.onHand(e);
    } catch (err) {
      console.warn('hands event failed', err);
    }
  };
  const H = {
    on: false,
    room: new THREE.Group(),
    stations: new Map(), // id -> { id, group, front, hit, def, label }
    items: new Map(), // id -> { id, spec, obj, meshes, station, slot, state, locked, tint, lock }
    pickItems: [],
    pickStations: [],
    carry: null, // { id, obj, mass }
    near: null,
    faceYaw: null,
    autoT: 0, // seconds the camera keeps steering after a walk
    path: null, // waypoints still to walk: [[x, z], …]
    pathCb: null,
    tripK: 1,
    enterT: 0,
    saved: null,
    beacon: null,
    built: false,
    rodObstacle: { x: 2.6, z: 2.2, r: 0.12 },
  };
  H.room.visible = false;
  scene.add(H.room);
  const standObstacle = { x: 0, z: 0, r: GROUND.keep };
  const obstacles = [standObstacle, { x: PLINTH.x, z: PLINTH.z, r: 0.45 }, H.rodObstacle];
  // The shared controller walks and films the astronaut in hands mode. Where
  // you stand decides the rack (targetAngle: all round), like before.
  let promptFn = null;
  const ctl = createController({
    camera,
    dom: canvasEl,
    character: astro,
    enabled: false,
    applyCamera: false,
    walkable: { bounds: ROOM, circles: obstacles },
    rig: { distance: 5.4, height: 1.45, shoulder: 0.5, min: 2.2, max: 12, pitch: [-0.15, 1.2], pitch0: 0.42, fov: 50, floorY: 0 },
    speeds: { walk: 2.1, run: 4.4, accel: 12, turn: 11 },
    targetAngle: Math.PI,
  });
  H.ctl = ctl;
  const craftItem = {
    id: 'craft',
    at: new THREE.Vector3(0, 0, 0),
    get radius() {
      return GROUND.near;
    },
    priority: 1,
    ring: false,
    promptAt: new THREE.Vector3(0, STAND_H + 0.6, 0),
    label: () => (promptFn ? promptFn('craft') : ''),
  };
  ctl.on('interact', () => {
    if (H.on && view !== 'compare' && H.built) emit({ type: 'interact', near: H.near });
  });
  // Q / gamepad B: close the card, or put the carried part back.
  ctl.on('back', () => {
    if (H.on && view !== 'compare') emit({ type: 'back' });
  });
  // A key with a card open walks away from it (the screen closes the card).
  ctl.on('wantmove', () => {
    if (H.on && view !== 'compare' && H.cardOpen) emit({ type: 'walk' });
  });
  ctl.on('tap', (info) => {
    if (!H.on || view === 'compare' || !H.built) return false;
    const t = pickAt(info.event, true);
    if (t) {
      emit({ type: 'click', target: t });
      return true;
    }
    if (info.preferLook) return false;
    if (ray.ray.intersectPlane(groundPlane, hitV)) {
      walkToPoint(hitV.x, hitV.z);
      ctl.mark(hitV);
      emit({ type: 'walk' });
      return true;
    }
    return false;
  });

  // Shared materials for the furniture and the parts on it.
  const HM = {
    rack: new THREE.MeshStandardMaterial({ color: 0xd3d9dd, roughness: 0.5, metalness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3d444b, roughness: 0.55, metalness: 0.5 }),
    esd: new THREE.MeshStandardMaterial({ color: 0x2f7f84, roughness: 0.85 }),
    board: new THREE.MeshStandardMaterial({ color: 0xf6f8f7, roughness: 0.35 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xfffdf4, roughness: 0.9, side: THREE.DoubleSide }),
    cell: new THREE.MeshStandardMaterial({ color: 0x1f3d72, roughness: 0.3, metalness: 0.45 }),
    white: new THREE.MeshStandardMaterial({ color: 0xeef1f3, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide }),
    ti: new THREE.MeshStandardMaterial({ color: 0xa3abb3, roughness: 0.32, metalness: 0.85 }),
    tank: new THREE.MeshStandardMaterial({ color: 0xc9d0d6, roughness: 0.22, metalness: 0.8 }),
    rtg: new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.5, metalness: 0.6 }),
    band: new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.5, metalness: 0.3 }),
    foam: new THREE.MeshStandardMaterial({ color: 0xd8813f, roughness: 0.75 }),
    ablator: new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb4302c, roughness: 0.5 }),
    tape: new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.7 }),
    locked: new THREE.MeshStandardMaterial({ color: 0x8a9298, roughness: 0.8, metalness: 0.1, transparent: true, opacity: 0.55 }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  };
  const CASE_TINT = { key: 0xf0c04a, goal: 0x7cc7c0, off: 0xc9d0d5, plain: 0xdfe4e7 };
  const caseMats = {};
  let atlas = null;
  const itemGlow = new Map();
  const glowItem = (m) => {
    if (itemGlow.has(m)) return itemGlow.get(m);
    const g = m.clone();
    g.emissive = new THREE.Color(0xd9a21b);
    g.emissiveIntensity = 0.38;
    itemGlow.set(m, g);
    return g;
  };

  // Floor marks: the work area, the spot you are at, the spot to go to.
  {
    const t = 0.07;
    const x0 = ROOM.minX - 0.45;
    const x1 = ROOM.maxX + 0.45;
    const z0 = ROOM.minZ - 0.4;
    const z1 = ROOM.maxZ + 0.5;
    const geos = [boxAt(x1 - x0, 0.01, t, (x0 + x1) / 2, 0.005, z0), boxAt(x1 - x0, 0.01, t, (x0 + x1) / 2, 0.005, z1), boxAt(t, 0.01, z1 - z0, x0, 0.005, (z0 + z1) / 2), boxAt(t, 0.01, z1 - z0, x1, 0.005, (z0 + z1) / 2)];
    const tape = merged(geos, HM.tape, false);
    H.room.add(tape);
  }
  const padMat = new THREE.MeshBasicMaterial({ color: 0x17807a, transparent: true, opacity: 0.55, depthWrite: false });
  const nearPad = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 40), padMat);
  nearPad.rotation.x = -Math.PI / 2;
  nearPad.position.y = 0.012;
  nearPad.visible = false;
  H.room.add(nearPad);
  const craftRingMat = new THREE.MeshBasicMaterial({ color: 0x17807a, transparent: true, opacity: 0.5, depthWrite: false });
  const craftRing = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.55, 72), craftRingMat);
  craftRing.rotation.x = -Math.PI / 2;
  craftRing.position.y = 0.014;
  craftRing.visible = false;
  H.room.add(craftRing);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xd9a21b, emissive: 0xd9a21b, emissiveIntensity: 0.5, roughness: 0.4 });
  const beacon = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 18), beaconMat);
  beacon.rotation.x = Math.PI;
  beacon.visible = false;
  H.room.add(beacon);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.3, 32), HM.dark);
  plinth.position.set(PLINTH.x, 0.15, PLINTH.z);
  plinth.castShadow = plinth.receiveShadow = true;
  H.room.add(plinth);

  // A padlock sprite for parts that need research first.
  const lockTex = canvasTex(64, 64, (ctx) => {
    ctx.fillStyle = '#23282e';
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f4f7f5';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(32, 26, 9, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#f4f7f5';
    ctx.fillRect(19, 26, 26, 19);
  });
  const lockMat = new THREE.SpriteMaterial({ map: lockTex, depthTest: true, transparent: true });

  // ----- Station furniture -----
  function furniture(id, def, list = []) {
    const g = [];
    const w = def.w;
    const d = def.d;
    const out = [];
    const post = (x, h, z) => g.push(boxAt(0.06, h, 0.06, x, h / 2, z));
    if (id === 'inst' || id === 'capsule') {
      // A three-shelf rack.
      [-w / 2 + 0.03, w / 2 - 0.03].forEach((x) => [-d / 2 + 0.03, d / 2 - 0.03].forEach((z) => post(x, 2.2, z)));
      [0.08, 0.78, 1.48, 2.18].forEach((y) => g.push(boxAt(w, 0.04, d, 0, y, 0)));
      g.push(boxAt(w, 2.2, 0.02, 0, 1.1, -d / 2 + 0.01));
      out.push(merged(g, HM.rack));
      return { meshes: out, top: 2.25 };
    }
    if (id === 'power') {
      g.push(boxAt(w, 0.14, d, 0, 0.07, 0));
      [-w / 2 + 0.03, w / 2 - 0.03].forEach((x) => post(x, 1.2, -d / 2 + 0.03));
      g.push(boxAt(w, 0.05, 0.05, 0, 1.2, -d / 2 + 0.03));
      out.push(merged(g, HM.rack));
      // Yellow and black stripes under the RTG: handle with care.
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.012, 0.6), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.7 }));
      stripe.position.set(w / 2 - 0.42, 0.146, 0);
      out.push(stripe);
      return { meshes: out, top: 1.3 };
    }
    if (id === 'comms' || id === 'prop') {
      const top = id === 'comms' ? 0.86 : 0.42;
      g.push(boxAt(w, 0.05, d, 0, top - 0.025, 0));
      [-w / 2 + 0.05, w / 2 - 0.05].forEach((x) => [-d / 2 + 0.05, d / 2 - 0.05].forEach((z) => post(x, top - 0.05, z)));
      out.push(merged(g, HM.rack));
      if (id === 'comms') {
        const mat = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.012, d - 0.12), HM.esd);
        mat.position.y = top + 0.006;
        mat.receiveShadow = true;
        out.push(mat);
      }
      return { meshes: out, top: id === 'comms' ? 1.9 : 1.5 };
    }
    if (id === 'brains') {
      [-w / 2 + 0.03, w / 2 - 0.03].forEach((x) => g.push(boxAt(0.05, 1.9, d, x, 0.95, 0)));
      [0.05, 0.62, 1.32, 1.88].forEach((y) => g.push(boxAt(w, 0.04, d, 0, y, 0)));
      out.push(merged(g, HM.dark));
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, 1.9, 0.02), HM.rack);
      back.position.set(0, 0.95, -d / 2 + 0.01);
      out.push(back);
      return { meshes: out, top: 1.95 };
    }
    if (id === 'shield') {
      g.push(boxAt(w, 0.1, d, 0, 0.05, 0));
      for (let k = -2; k <= 2; k++) g.push(boxAt(0.04, 0.5, d * 0.9, k * 0.38, 0.35, 0));
      out.push(merged(g, HM.dark));
      return { meshes: out, top: 1.2 };
    }
    if (id === 'launch') {
      const tall = list.some((it) => it.look && it.look.id === 'superheavy') ? 4.3 : 3.3;
      g.push(boxAt(w, tall, 0.06, 0, tall / 2, -d / 2 + 0.03));
      launchXs(Math.max(1, list.length), w).forEach((x) => g.push(boxAt(0.5, 0.34, 0.5, x, 0.17, 0.05)));
      out.push(merged(g, HM.dark));
      // A metric grid on the wall: the models are 1:25.
      const grid2 = canvasTex(256, 256, (ctx, w2, h2) => {
        ctx.fillStyle = '#2b3138';
        ctx.fillRect(0, 0, w2, h2);
        ctx.strokeStyle = 'rgba(233,238,242,0.25)';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
          ctx.beginPath();
          ctx.moveTo(0, (i * h2) / 8);
          ctx.lineTo(w2, (i * h2) / 8);
          ctx.stroke();
        }
      });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, tall - 0.1), new THREE.MeshStandardMaterial({ map: grid2, roughness: 0.9 }));
      face.position.set(0, tall / 2, -d / 2 + 0.065);
      out.push(face);
      return { meshes: out, top: tall + 0.05 };
    }
    // tests: a whiteboard on legs with three test plans pinned to it.
    [-w / 2 + 0.05, w / 2 - 0.05].forEach((x) => post(x, 2.0, 0));
    g.push(boxAt(w, 1.2, 0.05, 0, 1.3, 0));
    out.push(merged(g, HM.dark));
    const board = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 1.1, 0.02), HM.board);
    board.position.set(0, 1.3, 0.03);
    out.push(board);
    const sheets = [];
    [-1, 0, 1].forEach((k) => sheets.push(boxAt(0.42, 0.56, 0.005, k * 0.56, 1.3, 0.045)));
    out.push(merged(sheets, HM.paper, false));
    return { meshes: out, top: 2.0 };
  }

  // ----- Parts on the racks -----
  function caseMat(tint) {
    const k = tint || 'plain';
    if (!caseMats[k]) caseMats[k] = new THREE.MeshStandardMaterial({ map: atlas ? atlas.tex : null, color: CASE_TINT[k] || CASE_TINT.plain, roughness: 0.55, metalness: 0.08 });
    return caseMats[k];
  }
  // Returns { obj, meshes } for one part. `obj` sits on its base at y = 0.
  function partObj(spec) {
    const L = spec.look || {};
    const grp = new THREE.Group();
    const meshes = [];
    const add = (m) => {
      grp.add(m);
      meshes.push(m);
      m.castShadow = false;
      m.receiveShadow = true;
      return m;
    };
    if (L.shape === 'panels') {
      const geos = [];
      const n = L.n || 1;
      for (let i = 0; i < n; i++) {
        geos.push(boxAt(0.46, 0.03, 0.62, 0, 0.015 + i * 0.042, 0));
        geos.push(boxAt(0.04, 0.012, 0.04, 0.18, 0.036 + i * 0.042, 0.25));
      }
      add(merged(geos, HM.cell, false));
    } else if (L.shape === 'rtg') {
      const geos = [new THREE.CylinderGeometry(0.12, 0.12, 0.66, 14).translate(0, 0.33, 0)];
      for (let f = 0; f < 6; f++) {
        const fin = new THREE.BoxGeometry(0.32, 0.6, 0.012);
        fin.rotateY((f / 6) * Math.PI);
        fin.translate(0, 0.33, 0);
        geos.push(fin);
      }
      geos.push(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 14).translate(0, 0.66, 0));
      add(merged(geos, HM.rtg, false));
    } else if (L.shape === 'dish') {
      const k = 0.32;
      const geo = dishGeo(L.d || 1);
      geo.scale(k, k, k);
      geo.rotateX(Math.PI / 2);
      const r = ((L.d || 1) * k) / 2;
      geo.translate(0, 0.1 + r, 0.04);
      const post = new THREE.CylinderGeometry(0.02, 0.03, 0.1 + r, 8).translate(0, (0.1 + r) / 2, 0);
      const base = new THREE.CylinderGeometry(0.09, 0.1, 0.03, 14).translate(0, 0.015, 0);
      const g2 = mergeGeometries([geo, post, base], false);
      [geo, post, base].forEach((x) => x.dispose());
      add(new THREE.Mesh(g2, HM.white));
    } else if (L.shape === 'plate') {
      const t = L.t || 0.06;
      add(merged([boxAt(0.62, 0.62, t, 0, 0.31, 0), boxAt(0.66, 0.03, t + 0.02, 0, 0.6, 0)], HM.ti, false));
    } else if (L.shape === 'tank') {
      const r = L.r || 0.3;
      const s = new THREE.SphereGeometry(r, 22, 14).translate(0, r + 0.08, 0);
      const weld = new THREE.TorusGeometry(r * 1.004, 0.008 + r * 0.012, 6, 30);
      weld.rotateX(Math.PI / 2);
      weld.translate(0, r + 0.08, 0);
      const cradle = new THREE.TorusGeometry(r * 0.62, 0.025, 6, 24);
      cradle.rotateX(Math.PI / 2);
      cradle.translate(0, 0.08 + r * 0.22, 0);
      add(merged([s, weld], HM.tank, false));
      add(merged([cradle, new THREE.CylinderGeometry(r * 0.66, r * 0.7, 0.06, 18).translate(0, 0.03, 0)], HM.dark, false));
    } else if (L.shape === 'heatshield') {
      // Ablator dish on its edge, facing the room: thicker means more kilograms.
      const t = L.t || 0.06;
      const disc = new THREE.CylinderGeometry(0.3, 0.3, t, 32);
      disc.rotateX(Math.PI / 2);
      disc.translate(0, 0.36, 0);
      add(merged([disc], HM.ablator, false));
      const rim = new THREE.TorusGeometry(0.3, 0.018, 6, 32);
      rim.translate(0, 0.36, t / 2);
      add(merged([rim, boxAt(0.32, 0.06, 0.16, 0, 0.03, 0)], HM.dark, false));
    } else if (L.shape === 'tower') {
      // Launch abort tower model: ogive fairing, tower, abort motor, nose.
      const fair = new THREE.ConeGeometry(0.15, 0.24, 20).translate(0, 0.12, 0);
      const tower = new THREE.CylinderGeometry(0.032, 0.04, 0.26, 10).translate(0, 0.37, 0);
      const nose = new THREE.ConeGeometry(0.04, 0.09, 12).translate(0, 0.585, 0);
      add(merged([fair, tower, nose], HM.white, false));
      add(merged([new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14).translate(0, 0.515, 0)], HM.red, false));
    } else if (L.shape === 'rocket') {
      rocketGeos(L.id).forEach(([g, mat]) => add(new THREE.Mesh(g, HM[mat])));
    } else {
      // A flight case with the part's icon on the front.
      const s = L.size || 0.34;
      const w = s * 1.25;
      const h = s;
      const d = s * 0.9;
      const geo = atlas ? caseGeo(w, h, d, atlas.label(L.icon, L.star), atlas.side) : new THREE.BoxGeometry(w, h, d);
      geo.translate(0, h / 2, 0);
      const m = add(new THREE.Mesh(geo, caseMat(spec.tint)));
      m.userData.isCase = true;
    }
    grp.userData.size = new THREE.Box3().setFromObject(grp).getSize(new THREE.Vector3());
    return { obj: grp, meshes };
  }

  // Slots: where each part sits on its station (station-local, base of the part).
  function slotsFor(id, list, def) {
    const out = [];
    const w = def.w;
    if (id === 'inst' || id === 'capsule') {
      const shelfY = [0.8, 1.5, 0.1];
      const xs = [-w / 3, 0, w / 3];
      list.forEach((it, i) => out.push(new THREE.Vector3(xs[i % 3], shelfY[Math.floor(i / 3) % 3], 0.02)));
    } else if (id === 'power') {
      let i = 0;
      list.forEach((it) => {
        if (it.look.shape === 'rtg') out.push(new THREE.Vector3(w / 2 - 0.42, 0.152, 0));
        else out.push(new THREE.Vector3(-w / 2 + 0.36 + i++ * 0.53, 0.14, 0.02));
      });
    } else if (id === 'comms') {
      let a = 0;
      let b = 0;
      list.forEach((it) => {
        if (it.look.shape === 'dish') out.push(new THREE.Vector3(-1.0 + a++ * 0.9, 0.86, -0.18));
        else out.push(new THREE.Vector3(-1.15 + b++ * 0.5, 0.86, 0.24));
      });
    } else if (id === 'brains') {
      let a = 0;
      let b = 0;
      list.forEach((it) => {
        if (it.group === 'recorder') out.push(new THREE.Vector3(-0.75 + a++ * 0.75, 0.64, 0.02));
        else out.push(new THREE.Vector3(-0.5 + b++ * 1.0, 1.34, 0.02));
      });
    } else if (id === 'shield') {
      list.forEach((it, i) => out.push(new THREE.Vector3(-0.76 + i * 0.76, 0.1, 0)));
    } else if (id === 'prop') {
      let a = 0;
      let b = 0;
      list.forEach((it) => {
        if (it.look.shape === 'tank') out.push(new THREE.Vector3(-0.95 + a++ * 0.9, 0.42, -0.08));
        else out.push(new THREE.Vector3(0.95 - b++ * 0.5, 0.42, 0.28));
      });
    } else if (id === 'launch') {
      const xs = launchXs(list.length, w);
      list.forEach((it, i) => out.push(new THREE.Vector3(xs[i], 0.34, 0.05)));
    } else list.forEach(() => out.push(new THREE.Vector3(0, 0.1, 0.1)));
    return out;
  }

  // catalog: { stations: [{ id, label }], items: [{ id, station, look, group, state, locked, tint }], icons }
  const rackBoxes = [];
  const rackItems = [];
  function buildRoom(catalog) {
    atlas = makeAtlas(catalog.icons || {});
    const byStation = {};
    (catalog.items || []).forEach((it) => (byStation[it.station] = byStation[it.station] || []).push(it));
    (catalog.stations || []).forEach((s) => {
      if (!STATIONS[s.id]) return;
      const def = Object.assign({}, STATIONS[s.id]);
      if (s.id === 'launch' && (byStation.launch || []).length > 3) def.w = 3.7;
      const group = new THREE.Group();
      group.position.set(def.x, 0, def.z);
      group.rotation.y = def.ry;
      const f = furniture(s.id, def, byStation[s.id] || []);
      f.meshes.forEach((m) => group.add(m));
      const hit = new THREE.Mesh(new THREE.BoxGeometry(def.w + 0.2, f.top + 0.2, def.d + 0.5), HM.hit);
      hit.position.set(0, (f.top + 0.2) / 2, 0.2);
      hit.userData.hand = { kind: 'station', id: s.id };
      group.add(hit);
      H.pickStations.push(hit);
      const label = makeLabel(s.label, null, 0.42, true);
      label.position.set(0, f.top + 0.22, 0);
      group.add(label);
      H.room.add(group);
      // The spot in front of the rack where you stand to use it.
      const front = new THREE.Vector3(0, 0, def.d / 2 + 0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.ry).add(group.position);
      front.x = clamp(front.x, ROOM.minX, ROOM.maxX);
      front.z = clamp(front.z, ROOM.minZ, ROOM.maxZ);
      H.stations.set(s.id, { id: s.id, group, front, hit, def, label, top: f.top, look: new THREE.Vector3(def.x, 1.2, def.z) });
      // The rack is something to use (E) and something the camera stays out of.
      const side = Math.abs(Math.sin(def.ry)) > 0.5;
      const hw = (side ? def.d : def.w) / 2 + 0.08;
      const hd = (side ? def.w : def.d) / 2 + 0.08;
      rackBoxes.push({ minX: def.x - hw, maxX: def.x + hw, minY: 0, maxY: 2.5, minZ: def.z - hd, maxZ: def.z + hd });
      rackItems.push({ id: s.id, at: front, radius: NEAR, ring: false, promptAt: new THREE.Vector3(front.x, 1.75, front.z), label: () => (promptFn ? promptFn(s.id) : '') });
    });
    Object.entries(byStation).forEach(([sid, list]) => {
      const st = H.stations.get(sid);
      if (!st) return;
      const slots = slotsFor(sid, list, st.def);
      list.forEach((it, i) => {
        const { obj, meshes } = partObj(it);
        obj.position.copy(slots[i]);
        st.group.add(obj);
        meshes.forEach((m) => {
          m.userData.hand = { kind: 'item', id: it.id };
          H.pickItems.push(m);
        });
        const rec = { id: it.id, spec: it, obj, meshes, station: sid, slot: slots[i].clone(), state: 'rack', locked: false, tint: it.tint, lock: null, glow: false };
        rec.base = meshes.map((m) => m.material);
        H.items.set(it.id, rec);
        applyItem(rec, it);
      });
    });
    H.built = true;
    ctl.setInteractables([craftItem, ...rackItems]);
    ctl.setCameraShapes({ boxes: rackBoxes });
  }

  function setMats(rec) {
    rec.meshes.forEach((m, i) => {
      let mat = rec.locked ? HM.locked : m.userData.isCase ? caseMat(rec.tint) : rec.base[i];
      if (rec.glow && !rec.locked) mat = glowItem(mat);
      m.material = mat;
    });
  }
  function applyItem(rec, it) {
    rec.state = it.state || 'rack';
    rec.locked = !!it.locked;
    rec.tint = it.tint || rec.tint;
    setMats(rec);
    const st = H.stations.get(rec.station);
    // The chosen launcher's model stands on the plinth by the spacecraft.
    if (rec.spec.look.shape === 'rocket' && rec.state === 'mounted') {
      if (rec.obj.parent !== H.room) H.room.add(rec.obj);
      rec.obj.position.set(PLINTH.x, 0.3, PLINTH.z);
      rec.obj.rotation.y = 0;
      rec.obj.visible = true;
    } else {
      if (rec.obj.parent !== st.group) st.group.add(rec.obj);
      rec.obj.position.copy(rec.slot);
      rec.obj.visible = rec.state === 'rack';
    }
    if (rec.locked && rec.obj.visible) {
      if (!rec.lock) {
        rec.lock = new THREE.Sprite(lockMat);
        rec.lock.scale.set(0.2, 0.2, 1);
        rec.lock.renderOrder = 3;
        rec.obj.add(rec.lock);
      }
      rec.lock.position.set(0, rec.obj.userData.size.y + 0.14, 0.1);
      rec.lock.visible = true;
    } else if (rec.lock) rec.lock.visible = false;
  }

  // ----- Carrying -----
  const carryAnchor = new THREE.Group();
  astro.joints.torso.add(carryAnchor);
  function showCarryVisual(id) {
    dropCarryVisual();
    const rec = H.items.get(id);
    if (!rec) return;
    const { obj } = partObj(rec.spec);
    const size = obj.userData.size;
    const k = Math.min(1, CARRY_FIT / Math.max(size.x, size.y, size.z, 0.01));
    obj.scale.setScalar(k);
    // Held in front of the chest, a little below the shoulders.
    obj.position.set(0, 0.16 - (size.y * k) / 2 + 0.02, 0.2 + (size.z * k) / 2);
    if (rec.spec.look.shape === 'rocket') obj.position.y = -0.05;
    carryAnchor.add(obj);
    H.carry.obj = obj;
  }
  function dropCarryVisual() {
    if (H.carry && H.carry.obj) {
      carryAnchor.remove(H.carry.obj);
      disposeObj(H.carry.obj);
      H.carry.obj = null;
    }
  }
  function setCarry(id, info = {}) {
    if (!id) {
      dropCarryVisual();
      H.carry = null;
      craftRing.visible = false;
      return;
    }
    if (H.carry) dropCarryVisual();
    H.carry = { id, obj: null, mass: info.mass || 0 };
    if (view !== 'compare') showCarryVisual(id);
    craftRing.visible = H.on;
    astro.lookAt(null);
  }
  // The arms go round the part through the astronaut's carry layer (update).
  // A short flight from the hands to a point, then gone.
  const flights = [];
  function fly(obj, to, dur, cb) {
    if (!obj || reduceMotion()) {
      if (obj) {
        if (obj.parent) obj.parent.remove(obj);
        disposeObj(obj);
      }
      if (cb) cb();
      return;
    }
    scene.attach(obj);
    flights.push({ obj, from: obj.position.clone(), to: to.clone(), s0: obj.scale.x, t: 0, dur, cb });
  }

  function placeFx(cb) {
    if (!H.carry) return cb && cb();
    const obj = H.carry.obj;
    H.carry.obj = null;
    const to = new THREE.Vector3(0, STAND_H + Math.max(0.8, craftHeight * 0.45), 0);
    fly(obj, to, 0.32, cb);
    H.carry = null;
    craftRing.visible = false;
  }
  function returnFx(cb) {
    if (!H.carry) return cb && cb();
    const rec = H.items.get(H.carry.id);
    const obj = H.carry.obj;
    H.carry.obj = null;
    H.carry = null;
    craftRing.visible = false;
    if (!rec) return fly(obj, person.position, 0.1, cb);
    const st = H.stations.get(rec.station);
    const to = rec.slot.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), st.def.ry).add(st.group.position);
    to.y += 0.25;
    fly(obj, to, 0.42, cb);
  }

  // ----- Walking -----
  function stationFront(id) {
    if (id === 'craft') {
      // Mount parts on the side facing the camera, so you see them go on.
      const p = person.position;
      const camA = Math.atan2(camera.position.x, camera.position.z);
      let a = Math.atan2(p.x, p.z);
      const off = wrapA(a - camA);
      if (Math.abs(off) > 0.95) a = camA + Math.sign(off) * 0.95;
      return new THREE.Vector3(Math.sin(a) * GROUND.stop, 0, Math.cos(a) * GROUND.stop);
    }
    const st = H.stations.get(id);
    return st ? st.front.clone() : null;
  }
  function facing(id) {
    const p = person.position;
    if (id === 'craft') return Math.atan2(-p.x, -p.z);
    const st = H.stations.get(id);
    return st ? Math.atan2(st.def.x - p.x, st.def.z - p.z) : null;
  }
  // A route around the stand: if the straight line passes through it, go
  // round on a circle, then straight on. The controller walks each leg.
  function route(x, z, cb) {
    const p = person.position;
    const pts = [];
    const dx = x - p.x;
    const dz = z - p.z;
    const L2 = dx * dx + dz * dz;
    // Does the straight line from (ax, az) to the target pass through the stand?
    const blocked = (ax, az) => {
      const ex = x - ax;
      const ez = z - az;
      const l2 = ex * ex + ez * ez;
      const k = l2 ? clamp(-(ax * ex + az * ez) / l2, 0, 1) : 0;
      return k > 0 && k < 1 && Math.hypot(ax + ex * k, az + ez * k) < GROUND.keep + 0.75;
    };
    if (L2 > 0.01 && blocked(p.x, p.z)) {
      const a0 = Math.atan2(p.x, p.z);
      const da = wrapA(Math.atan2(x, z) - a0);
      const steps = Math.max(2, Math.ceil(Math.abs(da) / (Math.PI / 8)));
      for (let i = 1; i < steps; i++) {
        const a = a0 + (da * i) / steps;
        const wx = Math.sin(a) * (GROUND.keep + 0.85);
        const wz = Math.cos(a) * (GROUND.keep + 0.85);
        pts.push([wx, wz]);
        if (!blocked(wx, wz)) break;
      }
    }
    pts.push([x, z]);
    H.path = pts;
    H.pathCb = cb || null;
    stepPath();
  }
  function stepPath() {
    if (!H.path || !H.path.length) return;
    const [x, z] = H.path.shift();
    const last = !H.path.length;
    const cb = H.pathCb;
    const run = H.run;
    if (last) H.path = H.pathCb = null;
    ctl.moveTo({ x, z }, { run, tolerance: last ? 0.25 : 0.7, onArrive: last ? cb : stepPath });
  }
  function cancelPath() {
    H.path = H.pathCb = null;
  }

  // Walk to a station ('craft' for the spacecraft) and call cb on arrival.
  function walkTo(id, cb) {
    const to = stationFront(id);
    if (!to) return;
    const dist = Math.hypot(to.x - person.position.x, to.z - person.position.z);
    const arrive = () => {
      H.tripK = 1;
      H.faceYaw = facing(id);
      updateNear(true);
      if (cb) cb();
    };
    H.faceYaw = null;
    if (reduceMotion() || dist < 0.3) {
      // No long walks with reduced motion: step straight there.
      cancelPath();
      ctl.teleport({ x: to.x, y: 0, z: to.z }, null);
      arrive();
      return;
    }
    // Far away: jog.
    H.run = dist > 4;
    route(to.x, to.z, arrive);
  }
  function walkToPoint(x, z) {
    H.faceYaw = null;
    H.run = Math.hypot(x - person.position.x, z - person.position.z) > 6;
    route(x, z, null);
  }

  // Where you stand: the controller's target (a rack's front spot, or the
  // spacecraft when you are close to it).
  function updateNear(force) {
    if (force) ctl.refreshTarget();
    const tg = ctl.state.target;
    const id = tg ? tg.id : null;
    if (id !== H.near || force) {
      const was = H.near;
      H.near = id;
      if (id && id !== 'craft') {
        const f = H.stations.get(id).front;
        nearPad.position.set(f.x, 0.012, f.z);
        nearPad.visible = true;
      } else nearPad.visible = false;
      if (id !== was) emit({ type: 'near', id });
    }
  }

  function setBeacon(id) {
    H.beacon = id || null;
    const st = id && id !== 'craft' ? H.stations.get(id) : null;
    beacon.visible = !!(st || id === 'craft');
    // Over the spot where you stand to use it, pointing down at the floor.
    if (st) beacon.position.set(st.front.x, 2.3, st.front.z);
    else if (id === 'craft') beacon.position.set(0, STAND_H + craftHeight + 0.9, 0);
    beacon.userData.y = beacon.position.y;
  }

  // ----- Keys: the controller (E uses, Q puts back / closes) -----
  // ----- Pointer: hover and click -----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitV = new THREE.Vector3();
  const shown = (o) => {
    for (let q = o; q; q = q.parent) if (!q.visible) return false;
    return true;
  };
  function aim(e) {
    const r = canvasEl.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  const PART_STATION = (k) =>
    k.startsWith('array') || k.startsWith('wing') || k.startsWith('rtg')
      ? 'power'
      : k === 'dish'
      ? 'comms'
      : k === 'bus'
      ? 'brains'
      : k === 'vault'
      ? 'shield'
      : k === 'tank' || k === 'sm'
      ? 'prop'
      : k === 'capsule' || k === 'heatshield' || k === 'las'
      ? 'capsule'
      : 'inst';
  function pickAt(e, withCraft) {
    aim(e);
    const it = ray.intersectObjects(H.pickItems, false).find((h) => shown(h.object));
    if (it) return Object.assign({ point: it.point }, it.object.userData.hand);
    if (withCraft && craft) {
      const c = ray.intersectObject(turntable, true)[0];
      if (c) {
        let o = c.object;
        const parts = craft.userData.parts;
        const holders = new Map(Object.entries(parts).map(([k, v]) => [v, k]));
        while (o && !holders.has(o) && o !== turntable) o = o.parent;
        const k = o && holders.get(o);
        return k ? { kind: 'part', key: k, station: PART_STATION(k), point: c.point } : { kind: 'craft', point: c.point };
      }
      const sh = ray.intersectObjects([stand, plate], false)[0];
      if (sh) return { kind: 'craft', point: sh.point };
    }
    const st = ray.intersectObjects(H.pickStations, false).find((h) => shown(h.object));
    if (st) return Object.assign({ point: st.point }, st.object.userData.hand);
    return null;
  }
  function handClick(e) {
    // Hands mode: the controller sorts taps from drags (see ctl.on('tap')).
    if (!H.on || view === 'compare' || !H.built || H.on) return;
    const t = pickAt(e, true);
    if (t) {
      emit({ type: 'click', target: t });
      return;
    }
    if (ray.ray.intersectPlane(groundPlane, hitV)) {
      walkToPoint(hitV.x, hitV.z);
      emit({ type: 'walk' });
    }
  }
  let hoverRec = null;
  let hoverT = 0;
  let lastMove = null;
  const onMove = (e) => {
    if (!H.on || view === 'compare' || !H.built || e.pointerType === 'touch' || ctl.locked || e.buttons) return;
    lastMove = e;
    const now = performance.now();
    if (now - hoverT < 70) return;
    hoverT = now;
    hoverAt(e);
  };
  function hoverAt(e) {
    const t = dragging ? null : pickAt(e, true);
    const rec = t && t.kind === 'item' ? H.items.get(t.id) : null;
    if (rec !== hoverRec) {
      if (hoverRec) {
        hoverRec.glow = false;
        setMats(hoverRec);
      }
      hoverRec = rec;
      if (rec) {
        rec.glow = true;
        setMats(rec);
      }
    }
    canvasEl.style.cursor = t ? 'pointer' : '';
    const r = canvasEl.getBoundingClientRect();
    emit({ type: 'hover', target: t ? { kind: t.kind, id: t.id, key: t.key, station: t.station } : null, x: e.clientX - r.left, y: e.clientY - r.top });
  }
  const onLeave = () => {
    if (hoverRec) {
      hoverRec.glow = false;
      setMats(hoverRec);
      hoverRec = null;
    }
    canvasEl.style.cursor = '';
    if (H.on) emit({ type: 'hover', target: null });
  };
  canvasEl.addEventListener('pointermove', onMove);
  canvasEl.addEventListener('pointerleave', onLeave);

  // ----- Camera -----
  // Hands mode: the controller's over-the-shoulder camera; otherwise (and in
  // the comparison view) the orbit camera.
  function setHandsCamera(on, keepLimits) {
    if (on) {
      controls.enabled = false;
      ctl.setCameraActive(true);
    } else {
      ctl.setCameraActive(false);
      controls.enabled = true;
      controls.target.copy(ctl.view.target);
      controls.minDistance = 2.5;
      controls.maxDistance = 140;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.enablePan = true;
      void keepLimits;
    }
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
  }
  const handsCam = () => H.on && view !== 'compare';
  const offV = new THREE.Vector3();

  // ----- On and off -----
  function setOn(on) {
    on = !!on;
    if (on === H.on) return;
    H.on = on;
    H.room.visible = on && view !== 'compare';
    cancelPath();
    if (on) {
      // In front of the racks, facing the back wall and the spacecraft.
      ctl.teleport({ x: 2.2, y: 0, z: 2.95 }, Math.atan2(-1.1, -2.95));
      astro.lookAt(null);
      H.faceYaw = null;
      if (view !== 'compare') {
        setHandsCamera(true);
        if (!reduceMotion()) setTimeout(() => H.on && !H.carry && astro.wave(), 500);
      }
      updateNear(true);
    } else {
      ctl.stop();
      ctl.setEnabled(false);
      setCarry(null);
      setBeacon(null);
      onLeave();
      nearPad.visible = false;
      astro.setMove(0);
      astro.lookAt(craftLook);
      setHandsCamera(false);
      H.near = null;
    }
    layout(true);
  }

  // Where the astronaut is on screen (CSS pixels): head top, feet, and a
  // rough half-width, so the HUD can place a card beside it.
  const feetV = new THREE.Vector3();
  function headScreen() {
    offV.copy(person.position);
    offV.y += 1.95;
    offV.project(camera);
    feetV.copy(person.position).project(camera);
    const x = ((offV.x + 1) / 2) * vw;
    const y = ((1 - offV.y) / 2) * vh;
    const fy = ((1 - feetV.y) / 2) * vh;
    return { x, y, feetY: fy, half: Math.max(14, (fy - y) * 0.28), ok: offV.z < 1 && Math.abs(offV.x) < 1.2 && Math.abs(offV.y) < 1.2 };
  }

  let spin = 0;
  let lastS = 0;
  const off = new THREE.Vector3();
  const tmpYaw = { f: 0, s: 0 };
  return {
    scene,
    camera,
    shadows: true,
    exposure: 1.02,
    setDesign,
    setAnalog,
    setPersonLabel,
    setView,
    setInsets,
    highlightPart,
    hands: {
      setCatalog: (c) => {
        if (!H.built) buildRoom(c);
      },
      update(list) {
        (list || []).forEach((it) => {
          const rec = H.items.get(it.id);
          if (rec) applyItem(rec, it);
        });
      },
      setOn,
      get on() {
        return H.on;
      },
      get near() {
        return H.near;
      },
      get carrying() {
        return H.carry ? H.carry.id : null;
      },
      get moving() {
        return ctl.state.moving;
      },
      // The screen's prompt text for a rack id or 'craft' ('' hides it).
      setPrompt(fn) {
        promptFn = typeof fn === 'function' ? fn : null;
        ctl.refreshTarget();
      },
      refreshPrompt() {
        ctl.refreshTarget();
      },
      // A card is open: the keys stop walking (a key press asks to walk away).
      setCard(open) {
        H.cardOpen = !!open;
      },
      get controller() {
        return ctl;
      },
      get position() {
        return { x: person.position.x, z: person.position.z };
      },
      carry: setCarry,
      placeFx,
      returnFx,
      walkTo,
      walkToPoint,
      stop() {
        cancelPath();
        ctl.stop();
      },
      beacon: setBeacon,
      headScreen,
      react(kind) {
        if (reduceMotion() && kind !== 'nope') return;
        if (kind === 'nope') astro.setExpression('wow'), setTimeout(() => astro.setExpression(null), 700);
        else if (kind === 'cheer' && !astro.action) astro.cheer();
        else if (kind === 'celebrate') astro.celebrate();
      },
      // For scripts and tests: the station positions and the room bounds.
      stations: () => [...H.stations.values()].map((s) => ({ id: s.id, x: s.front.x, z: s.front.z })),
      room: ROOM,
      get ground() {
        return Object.assign({}, GROUND);
      },
    },
    onResize(w, h) {
      vw = w;
      vh = h;
      applyInsets();
    },
    get view() {
      return view;
    },
    get hasAnalog() {
      return !!analog;
    },
    update(dtFrame, t) {
      // Animations run on wall-clock time so a slow frame rate (a big NASA model
      // on a school laptop) never leaves parts half-grown.
      const nowS = performance.now() / 1000;
      const dt = Math.min(0.25, Math.max(dtFrame, nowS - (lastS || nowS)));
      lastS = nowS;
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i];
        a.t += dt;
        applyAnim(a);
        if (a.t >= a.dur) {
          anims.splice(i, 1);
          if (a.out) {
            turntable.remove(a.obj);
            disposeObj(a.obj);
          }
        }
      }
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i];
        f.t += dt;
        const k = clamp(f.t / f.dur, 0, 1);
        const e2 = ease.inOut(k);
        f.obj.position.lerpVectors(f.from, f.to, e2);
        f.obj.position.y += Math.sin(k * Math.PI) * 0.5;
        f.obj.scale.setScalar(f.s0 * (1 - 0.6 * e2));
        if (k >= 1) {
          flights.splice(i, 1);
          scene.remove(f.obj);
          disposeObj(f.obj);
          if (f.cb) f.cb();
        }
      }
      if (H.on) {
        // Parked: the instrument deck faces the room so new parts are seen going on.
        spin += wrapA(TURN_HANDS - spin) * Math.min(1, dt * 2.5);
        turntable.rotation.y = spin;
      } else if (!dragging && !reduceMotion()) {
        // A slow display turn; it pauses while the student drags the view.
        spin += dt * 0.16;
        turntable.rotation.y = spin;
      }
      if (H.on && view !== 'compare') {
        // The controller: keys, stick, thumb or clicks; it moves the astronaut,
        // films it over the shoulder and finds the rack in front of you.
        ctl.setEnabled(H.built && !H.cardOpen);
        if (ctl.state.inputActive) {
          H.faceYaw = null;
          cancelPath();
        }
        // Heavy parts slow you down a little: every kilogram counts.
        ctl.setSpeedScale(H.carry ? 1 - 0.32 * clamp((H.carry.mass || 0) / 150, 0, 1) : 1);
        // Arms round the part you carry.
        if (H.carry && H.carry.obj) astro.carry({ spread: Math.min(0.5, H.carry.obj.userData.size.x * H.carry.obj.scale.x) });
        else astro.carry(false);
        ctl.update(dt);
        // Turn to face what you arrived at.
        if (H.faceYaw != null && !ctl.state.moving && !H.path) {
          const d = wrapA(H.faceYaw - person.rotation.y);
          person.rotation.y += d * Math.min(1, dt * 8);
          if (Math.abs(d) < 0.01) H.faceYaw = null;
        }
        updateNear(false);
        // Look at the rack you are standing at.
        if (!H.carry) astro.lookAt(H.near && !ctl.state.moving ? (H.near === 'craft' ? craftLook : H.stations.get(H.near).look) : null);
        const pulse = reduceMotion() ? 0.5 : 0.35 + 0.25 * Math.sin(t * 4);
        craftRingMat.opacity = H.near === 'craft' ? 0.75 : pulse;
        padMat.opacity = H.carry ? 0.35 : 0.55;
        if (beacon.visible) {
          beacon.rotation.y += dt * 1.5;
          beacon.position.y = beacon.userData.y + (reduceMotion() ? 0 : Math.sin(t * 3) * 0.12);
        }
        if (lastMove && !ctl.state.moving && performance.now() - hoverT > 400) {
          hoverAt(lastMove);
          lastMove = null;
        }
      } else {
        if (H.on) ctl.update(dt);
        else astro.update(dt);
      }
      // Glow pulse on hovered parts.
      if (highlight) hiMats.forEach((m) => (m.emissiveIntensity = 0.45 + 0.3 * Math.sin(t * 6)));
      // Ease the camera to frame the craft (or the craft and the real one).
      if (framing > 0) {
        framing -= dt;
        const k = Math.min(1, dt * 3.2);
        controls.target.lerp(goal.target, k);
        off.copy(camera.position).sub(controls.target);
        const d = off.length();
        off.setLength(d + (goal.dist - d) * k);
        camera.position.copy(controls.target).add(off);
      }
      if (!handsCam()) controls.update();
    },
    dispose() {
      ctl.dispose();
      canvasEl.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      canvasEl.removeEventListener('wheel', onWheel);
      canvasEl.removeEventListener('pointermove', onMove);
      canvasEl.removeEventListener('pointerleave', onLeave);
      canvasEl.style.cursor = '';
      controls.dispose();
      highlightPart(null);
      hiMats.forEach((m) => m.dispose());
      hiMats.clear();
      itemGlow.forEach((m) => m.dispose());
      itemGlow.clear();
      // The real spacecraft may share geometry with the asset cache: never dispose it.
      analogToken++;
      clearAnalog();
      if (personLabel) {
        scene.remove(personLabel);
        personLabel.material.map.dispose();
        personLabel.material.dispose();
      }
      grid.dispose();
      stripes.dispose();
      lockTex.dispose();
      if (atlas) atlas.tex.dispose();
      astro.dispose();
    },
  };
}
