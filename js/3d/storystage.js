// Story mode sets ("Last Light"): the places the scenes play in, the people
// standing in them, and the cinematic cameras that cut between them.
//
//   const st = createStoryStage({ set: 'pad', cast: ['you', 'kwame'], you, looks, staff, capsule });
//   engine.mount(el, st);           // st is a scene object (scene, camera, update...)
//   st.shot('close:kwame');         // wide | close:id | two:a,b | window
//   st.speak('kwame', 'worried', 'you');
//   st.anim('you', 'look'); st.alarm(true); st.shake(1); st.power(0.4);
//
// Sets: pad (night, record cold, the floodlit rocket), control (mission
// control), briefing (crew quarters briefing room), capsule (capsule.js when
// it exists, else a stand-in cabin), space (the spacecraft between Earth and
// the Moon), black (darkness; a single cold light on whoever is there).
// Units are metres. Crew are createAstronaut figures; ground staff are the HQ
// people from npc.js. Cameras cut (Telltale style) and drift slowly in a shot.
// Every set has the named anchors of docs/STORY.md (explore spawns and items);
// st.beginExplore({ controller, dom, spawn, items, onInteract }) hands 'you'
// and the camera to the shared controller (js/3d/controller.js) until
// st.endExplore(); st.cinematic(true) takes the camera back for a talk.
import { THREE, studioEnv } from './engine.js';
import { makePlanet, makeStars, makeSun, softDot, canvasTex } from './assets.js';
import { createAstronaut } from './astronaut.js';
import { createStaff } from './npc.js';
import { rocketMesh, ROCKET_LOOKS } from './films.js';

const SMD = globalThis.SMD || {};
const DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// Which person in content/staff.js plays each ground role.
const STAFF_OF = { nadia: 'director', kwame: 'engineer', mariam: 'scientist', tarek: 'budget', omar: 'intern', aiko: 'outreach' };
const CREW = ['you', 'yusuf', 'lena', 'grace'];
const EXPR = { happy: 'happy', sad: 'sad', scared: 'wow', worried: 'sad', determined: null, angry: null, calm: null };

// The crewmates' looks (the player's is their own avatar). A crewmate never
// wears the player's suit colour, so everyone reads apart at a glance.
const LOOKS = {
  yusuf: { name: 'YUSUF', suit: 'navy', skin: 's4', hair: 'short', hairColor: 'black', visor: 'gold', patch: 'agency', patchColor: '#b4302c' },
  lena: { name: 'LENA', suit: 'teal', skin: 's1', hair: 'bun', hairColor: 'blond', visor: 'clear', patch: 'agency', patchColor: '#2a5aa8' },
  grace: { name: 'GRACE', suit: 'lavender', skin: 's6', hair: 'curly', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#3d8b4e' },
};
const SPARE_SUITS = ['orange', 'gold', 'classic', 'navy', 'teal', 'lavender'];
export function crewLook(id, you) {
  const base = Object.assign({}, LOOKS[id]);
  const taken = new Set([you && you.suit]);
  ['yusuf', 'lena', 'grace'].forEach((k) => {
    if (k === id) return;
    taken.add(LOOKS[k].suit);
  });
  if (you && base.suit === you.suit) base.suit = SPARE_SUITS.find((s) => !taken.has(s)) || 'classic';
  return base;
}

const reducedMotion = () => {
  try {
    return !!(SMD.settings ? SMD.settings.reducedMotion : matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) {
    return false;
  }
};

// ---------- Small shared pieces ----------
function skyDome(radius, top, mid, bottom) {
  const tex = canvasTex(4, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(0.46, mid);
    g.addColorStop(0.5, bottom);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10;
  return m;
}
function glowSprite(color, size, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size);
  return s;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0.05 }, o));
const glow = (color, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });

// Drifting puffs (vapour, dust, venting gas): a pool of sprites.
function puffs(n, opts) {
  const g = new THREE.Group();
  const list = [];
  const tex = softDot();
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: opts.color || 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: opts.fog !== false }));
    g.add(s);
    list.push({ s, age: (i / n) * opts.life, life: opts.life * (0.7 + Math.random() * 0.6), seed: Math.random() });
  }
  g.userData.update = (dt) => {
    list.forEach((p) => {
      p.age += dt;
      if (p.age > p.life) {
        p.age = 0;
        p.seed = Math.random();
      }
      const k = p.age / p.life;
      const pos = opts.at(p.seed, k);
      p.s.position.copy(pos);
      p.s.scale.setScalar(lerp(opts.size[0], opts.size[1], k));
      p.s.material.opacity = Math.sin(k * Math.PI) * (opts.opacity || 0.35);
    });
  };
  return g;
}

// A screen texture for consoles and walls: plots, numbers, a title strip.
function consoleTex(seed, hue = 'green', title = '') {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const col = hue === 'amber' ? '#f0b429' : hue === 'blue' ? '#7fc4ff' : hue === 'red' ? '#ff6a5a' : '#62e0a8';
  return canvasTex(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#05100c';
    if (hue === 'blue') ctx.fillStyle = '#04101c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.18;
    for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 1, h);
    for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      let y = h * (0.35 + k * 0.3);
      for (let x = 8; x < w - 8; x += 6) {
        y += (r() - 0.5) * 10;
        y = Math.max(28, Math.min(h - 10, y));
        x === 8 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.globalAlpha = k ? 0.6 : 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 0.9;
    ctx.font = '700 13px monospace';
    for (let i = 0; i < 3; i++) ctx.fillText((r() * 999).toFixed(1).padStart(6, '0'), 8 + i * 82, 18);
    if (title) {
      ctx.font = '800 15px Archivo, sans-serif';
      ctx.fillText(title, 8, h - 10);
    }
  });
}

// The window view in the capsule stand-in: Earth (or the Moon) in black.
function windowTex(view) {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#010205';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
    }
    const moon = view === 'moon';
    const cx = w * 0.62;
    const cy = h * 0.6;
    const R = moon ? w * 0.42 : w * 0.2;
    const g = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.35, R * 0.1, cx, cy, R);
    if (moon) {
      g.addColorStop(0, '#c9c6c0');
      g.addColorStop(0.7, '#8d8a84');
      g.addColorStop(1, '#4a4844');
    } else {
      g.addColorStop(0, '#d9ecff');
      g.addColorStop(0.35, '#4f8fd6');
      g.addColorStop(0.8, '#1d4f9a');
      g.addColorStop(1, '#0d2550');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    if (moon) {
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(40,38,36,${0.15 + Math.random() * 0.25})`;
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * R * 0.9;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 4 + Math.random() * 18, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * R * 0.85;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 6 + Math.random() * 16, 3 + Math.random() * 5, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The night side: a terminator shadow across the disc.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + 1, 0, Math.PI * 2);
    ctx.clip();
    const sh = ctx.createLinearGradient(cx - R * 0.2, 0, cx + R, 0);
    sh.addColorStop(0, 'rgba(1,2,5,0)');
    sh.addColorStop(0.5, 'rgba(1,2,5,0.85)');
    sh.addColorStop(1, 'rgba(1,2,5,0.98)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    if (!moon) {
      ctx.strokeStyle = 'rgba(140,190,255,0.35)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 2, Math.PI * 0.55, Math.PI * 1.45);
      ctx.stroke();
    }
  });
}

// ---------- Sets ----------
// Each returns { root, anchors: { name: {x, y, z, ry, at?} }, walk: { bounds,
// boxes, circles }, marks(n) (dialogue positions), wide(), window(),
// audience (Vector3: the side cameras sit on), update(dt, t), alarm(on), power(k) }.
// An anchor is where a person stands (facing ry); `at` is the thing there
// (the highlight and what the player turns to), defaulting to the spot itself.
const A = (x, z, ry = 0, at = null, y = 0) => ({ x, y, z, ry, at });
const FACE_N = Math.PI; // facing -Z
const FACE_E = Math.PI / 2; // facing +X
const FACE_W = -Math.PI / 2;

function padSet(scene) {
  const root = new THREE.Group();
  scene.background = new THREE.Color(0x060b14);
  scene.fog = new THREE.FogExp2(0x0b1522, 0.0085);
  root.add(skyDome(900, '#02040a', '#0f1d30', '#16263a'));
  const stars = makeStars(1600, 850, 21);
  stars.material.fog = false;
  stars.material.opacity = 0.7;
  stars.material.transparent = true;
  root.add(stars);
  // Ground: concrete with a skin of frost.
  const groundTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#30363c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 40 + Math.random() * 60;
      ctx.fillStyle = `rgba(${v + 120},${v + 140},${v + 160},${Math.random() * 0.18})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.strokeStyle = 'rgba(217,162,27,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(w, 6);
    ctx.stroke();
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(90, 90);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), std(0x8a949c, { map: groundTex, roughness: 0.62, metalness: 0.1 }));
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);

  // The rocket on its plinth; the tower beside it.
  const RX = -6;
  const RZ = -32;
  const rocket = rocketMesh(ROCKET_LOOKS.superheavy, '');
  rocket.position.set(RX, 6, RZ);
  root.add(rocket);
  const H = rocket.userData.length + 12;
  root.add(box(26, 6, 22, std(0x5a5f63, { roughness: 0.9 }), RX, 0, RZ));
  // Flame trench edge stripes on the plinth face.
  root.add(box(26.1, 0.25, 0.1, glow(0xd9a21b, 0.5), RX, 5.6, RZ + 11.02));
  const steel = std(0x6d5040, { roughness: 0.7, metalness: 0.4 });
  const tower = new THREE.Group();
  const TX = 12;
  const TZ = -30;
  [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]].forEach(([x, z]) => tower.add(box(0.6, H, 0.6, steel, TX + x, 0, TZ + z)));
  for (let y = 4; y < H; y += 7) {
    tower.add(box(5.6, 0.4, 0.4, steel, TX, y, TZ - 2.5), box(5.6, 0.4, 0.4, steel, TX, y, TZ + 2.5));
    tower.add(box(0.4, 0.4, 5.6, steel, TX - 2.5, y, TZ), box(0.4, 0.4, 5.6, steel, TX + 2.5, y, TZ));
  }
  // The crew access arm reaching across to the capsule, and its elevator.
  const armY = H - 24;
  tower.add(box(TX - RX - 4, 1.6, 2, std(0x8a8e92, { roughness: 0.6 }), (TX + RX) / 2 + 1, armY, TZ));
  tower.add(box(1.8, 2.6, 0.3, std(0x9aa0a6, { metalness: 0.5, roughness: 0.4 }), TX + 3.4, 0, TZ + 2.6));
  const elevLamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.1), glow(0x62e0a8, 2));
  elevLamp.position.set(TX + 3.4, 2.9, TZ + 2.8);
  tower.add(elevLamp);
  // Icicles hanging off the tower beams: the Challenger morning, 1986.
  const iceMat = std(0xdff3ff, { roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85, emissive: 0x204060, emissiveIntensity: 0.4 });
  for (let i = 0; i < 80; i++) {
    const len = 0.3 + Math.random() * 1.4;
    const ic = new THREE.Mesh(new THREE.ConeGeometry(0.06, len, 5), iceMat);
    ic.rotation.x = Math.PI;
    const y = 4 + Math.floor(Math.random() * Math.min(6, (H - 6) / 7)) * 7;
    ic.position.set(TX - 2.5 + Math.random() * 5, y - len / 2, TZ + 2.5);
    tower.add(ic);
  }
  root.add(tower);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), glow(0xff3020, 2));
  beacon.position.set(TX, H + 0.6, TZ);
  const beaconGlow = glowSprite(0xff3a20, 7, 0.9);
  beaconGlow.position.copy(beacon.position);
  root.add(beacon, beaconGlow);

  // The LOX line valve rack, white with frost; the oxygen umbilical up the plinth.
  const frost = std(0xe6f0f6, { roughness: 0.35, metalness: 0.2 });
  const pipe = (len, x, y, z, rz = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, len, 14), frost);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    root.add(m);
    return m;
  };
  pipe(8, -14, 0.8, -21.5, Math.PI / 2);
  pipe(1.6, -12.5, 1.6, -21.5);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 20), std(0xb4302c, { roughness: 0.5 }));
  wheel.position.set(-12.5, 2.45, -21.5);
  wheel.rotation.x = Math.PI / 2;
  root.add(wheel);
  for (let i = 0; i < 12; i++) {
    const ic = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3 + Math.random() * 0.5, 5), iceMat);
    ic.rotation.x = Math.PI;
    ic.position.set(-17.5 + i * 0.6, 0.45, -21.3);
    root.add(ic);
  }
  pipe(7, -3, 3.4, -20.6, 0, 0.35);
  root.add(box(1.2, 0.8, 1.2, std(0x7a8288, { metalness: 0.5 }), -3, 0, -19.4));
  // The pad-side weather and data console: a rugged terminal on a stand.
  root.add(box(1.4, 1.0, 0.6, std(0x3a4148, { roughness: 0.6, metalness: 0.3 }), 6, 0, -7));
  const conScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62), new THREE.MeshBasicMaterial({ map: consoleTex(77, 'amber', 'T-0 WX  -4 C'), toneMapped: false }));
  conScreen.position.set(6, 1.36, -6.86);
  conScreen.rotation.x = -0.3;
  root.add(conScreen, box(1.4, 0.7, 0.08, std(0x2a3036), 6, 1.0, -7.1));
  // The crew van, its lights on; the blockhouse door.
  const vanBody = std(0xeef0f0, { roughness: 0.4, metalness: 0.2 });
  root.add(box(5.6, 2.4, 2.4, vanBody, 14, 0.35, 11));
  root.add(box(1.4, 0.06, 2.2, glow(0x6fa8ff, 1), 14 - 2.0, 2.78, 11));
  [-1.9, 1.9].forEach((dx) => [-1.15, 1.15].forEach((dz) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), std(0x1a1a1a));
    w.rotation.x = Math.PI / 2;
    w.position.set(14 + dx, 0.4, 11 + dz);
    root.add(w);
  }));
  const head1 = glowSprite(0xfff2d0, 2.2, 0.7);
  head1.position.set(16.9, 1.1, 10.4);
  const head2 = head1.clone();
  head2.position.set(16.9, 1.1, 11.6);
  root.add(head1, head2);
  root.add(box(8, 3.4, 9, std(0x6e7378, { roughness: 0.95 }), -18, 0, 8));
  root.add(box(0.12, 2.2, 1.2, std(0x2c4a72, { roughness: 0.5 }), -13.95, 0, 8));
  const doorLamp = glowSprite(0xffd9a8, 1.6, 0.7);
  doorLamp.position.set(-13.8, 2.6, 8);
  root.add(doorLamp);

  // Floodlights: xenon lamps on poles, aimed at the rocket.
  const lampMat = glow(0xeaf4ff, 3);
  [[-46, -14], [36, -18], [-30, -80], [30, -76]].forEach(([x, z], i) => {
    root.add(box(0.5, 24, 0.5, std(0x40464c), x, 0, z));
    const lamp = box(3.4, 1.6, 0.6, lampMat, x, 24, z);
    lamp.lookAt(RX, 40, RZ);
    root.add(lamp);
    const gl = glowSprite(0xd8ecff, 26, 0.55);
    gl.position.set(x, 25, z);
    root.add(gl);
    if (i < 2) {
      const sp = new THREE.SpotLight(0xdfeeff, 6000, 200, 18 * DEG, 0.45, 1.6);
      sp.position.set(x, 26, z);
      sp.target.position.set(RX, 40, RZ);
      root.add(sp, sp.target);
    }
  });
  // Cold blue night, and warm work lights where people stand.
  root.add(new THREE.HemisphereLight(0x3a5a88, 0x10141a, 0.6));
  [[2.8, 3.4], [6.5, -4.6], [-11, -18], [10, -22]].forEach(([x, z]) => {
    const work = new THREE.PointLight(0xffc68a, 22, 14, 1.6);
    work.position.set(x - 0.2, 3.2, z - 0.2);
    root.add(work, box(0.12, 3.2, 0.12, std(0x30343a), x, 0, z));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow(0xffd9a8, 2.5));
    lamp.position.set(x - 0.05, 3.25, z - 0.1);
    const gl = glowSprite(0xffc68a, 2.4, 0.6);
    gl.position.copy(lamp.position);
    root.add(lamp, gl);
  });
  const rim = new THREE.DirectionalLight(0xa9c8ff, 1.1);
  rim.position.set(-4, 8, -30);
  root.add(rim);
  // LOX venting off the rocket; low fog over the pad.
  const vent = puffs(26, { life: 7, size: [4, 14], opacity: 0.28, color: 0xe8f2ff, at: (s, k) => V(RX + 4.4 + k * 12 + s * 3, 36 + s * 25 - k * 10, RZ + (s - 0.5) * 6) });
  const valveVent = puffs(10, { life: 3.5, size: [0.3, 1.6], opacity: 0.35, color: 0xf2f8ff, at: (s, k) => V(-12.5 + (s - 0.5) * 0.4 + k * 0.6, 2.3 + k * 1.2, -21.5 + (s - 0.5) * 0.4) });
  const groundFog = puffs(16, { life: 12, size: [8, 20], opacity: 0.12, color: 0xbcd0e8, at: (s, k) => V((s - 0.5) * 60 + k * 10, 0.5, RZ + 20 + (s - 0.5) * 30) });
  root.add(vent, valveVent, groundFog);
  scene.add(root);
  let blink = 0;
  return {
    root,
    audience: V(0, 0, 1),
    anchors: {
      start: A(0, 6, FACE_N),
      tower: A(12, -26.2, FACE_N, V(12, 3, -27.5)),
      arm: A(15.4, -26, FACE_N, V(15.4, 1.4, -27.4)),
      valve: A(-12.5, -19.8, FACE_N, V(-12.5, 1.6, -21.5)),
      umbilical: A(-3, -17.8, FACE_N, V(-3, 1.6, -19.4)),
      console: A(6, -5.6, FACE_N, V(6, 1.3, -6.9)),
      kwame: A(4.2, -6.6, FACE_E * 0.4),
      nadia: A(-2.6, 1.6, 0.3),
      door: A(-12.9, 8, FACE_W, V(-13.9, 1.2, 8)),
      van: A(13.8, 9, 0, V(13.8, 1.3, 9.8)),
    },
    walk: {
      bounds: { minX: -13.4, maxX: 20, minZ: -26.4, maxZ: 13 },
      boxes: [
        { minX: RX - 13, maxX: RX + 13, minZ: RZ - 11, maxZ: RZ + 11 },
        { minX: 9.2, maxX: 14.8, minZ: -33, maxZ: -27.2 },
        { minX: 5.2, maxX: 6.8, minZ: -7.4, maxZ: -6.6 },
        { minX: 11.1, maxX: 16.9, minZ: 9.7, maxZ: 12.3 },
        { minX: -22, maxX: -13.9, minZ: 3.4, maxZ: 12.6 },
        { minX: -18, maxX: -10, minZ: -22, maxZ: -21 },
        { minX: -3.7, maxX: -2.3, minZ: -20.1, maxZ: -18.7 },
      ],
      circles: [],
    },
    marks: (n) => row(n, 0, 0, 1.15, 0),
    wide: () => ({ pos: V(2.4, 1.35, 7.4), look: V(-0.8, 4.2, -20), fov: 50 }),
    window: () => ({ pos: V(1.5, 1.6, 4), look: V(RX, 60, RZ), fov: 34 }),
    update(dt) {
      vent.userData.update(dt);
      valveVent.userData.update(dt);
      groundFog.userData.update(dt);
      blink += dt;
      const on = blink % 1.6 < 0.5;
      beacon.visible = on;
      beaconGlow.visible = on;
    },
  };
}

function controlSet(scene) {
  const root = new THREE.Group();
  scene.background = new THREE.Color(0x05080d);
  scene.fog = new THREE.Fog(0x05080d, 14, 36);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std(0x1a2028, { roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  const wallMat = std(0x141b24, { roughness: 0.9 });
  root.add(box(30, 7, 0.3, wallMat, 0, 0, -6.2), box(30, 7, 0.3, wallMat, 0, 0, 11.2));
  root.add(box(0.3, 7, 18, wallMat, -11, 0, 2.5), box(0.3, 7, 18, wallMat, 11, 0, 2.5));
  // The big front screen: the flight path out to the Moon and back.
  const big = canvasTex(1024, 420, (ctx, w, h) => {
    ctx.fillStyle = '#03101c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(127,196,255,0.14)';
    for (let x = 0; x < w; x += 32) ctx.strokeRect(x, 0, 0.5, h);
    for (let y = 0; y < h; y += 32) ctx.strokeRect(0, y, w, 0.5);
    ctx.fillStyle = '#4f8fd6';
    ctx.beginPath();
    ctx.arc(170, 210, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9b6b0';
    ctx.beginPath();
    ctx.arc(860, 200, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f0b429';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(214, 190);
    ctx.bezierCurveTo(420, 60, 700, 80, 860, 170);
    ctx.bezierCurveTo(930, 230, 880, 260, 840, 228);
    ctx.bezierCurveTo(700, 330, 420, 360, 214, 232);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(520, 104, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7fc4ff';
    ctx.font = '800 26px Archivo, sans-serif';
    ctx.fillText('LANTERN', 24, 42);
    ctx.font = '600 18px monospace';
    ctx.fillText('FLIGHT DAY 1   MET 000:00:00', 24, 72);
    ctx.fillText('EARTH', 136, 290);
    ctx.fillText('MOON', 832, 256);
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: big, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.9), screenMat);
  screen.position.set(0, 3.6, -6.0);
  root.add(screen);
  const sideTex = [consoleTex(3, 'blue', 'TRAJ'), consoleTex(8, 'amber', 'EECOM')];
  [-8.4, 8.4].forEach((x, i) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4), new THREE.MeshBasicMaterial({ map: sideTex[i], toneMapped: false }));
    s.position.set(x, 3.4, -6.0);
    root.add(s);
  });
  // Three rows of consoles; each controller faces the big screen.
  const desk = std(0x2a323c, { roughness: 0.6, metalness: 0.2 });
  const hues = ['green', 'amber', 'blue'];
  const ROWS = [2.6, 5.4, 8.2];
  ROWS.forEach((z, r) => {
    root.add(box(16, 0.85, 0.9, desk, 0, 0, z));
    for (let x = -7; x <= 7.01; x += 1.4) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.68), new THREE.MeshBasicMaterial({ map: consoleTex(r * 31 + Math.round(x * 7) + 40, hues[Math.abs(r + Math.round(x)) % 3]), toneMapped: false }));
      m.position.set(x, 1.25, z + 0.15);
      m.rotation.x = -0.25; // tilted back, toward whoever sits behind the desk
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.74, 0.05), std(0x1b2128));
      back.position.set(x, 1.25, z + 0.11);
      back.rotation.x = -0.25;
      root.add(back, m);
    }
  });
  // The coffee corner: a counter, a machine, a red light.
  root.add(box(0.7, 0.95, 1.4, std(0x3a3128), -10.5, 0, -0.2), box(0.4, 0.5, 0.35, std(0x15181b, { metalness: 0.6 }), -10.5, 0.95, -0.4));
  const cofLed = glowSprite(0xff5040, 0.4, 0.9);
  cofLed.position.set(-10.28, 1.3, -0.4);
  root.add(cofLed);
  // The viewing window at the back: the night outside, the pad far away.
  const winTex = canvasTex(512, 200, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#04070e');
    g.addColorStop(1, '#14223a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rg = ctx.createRadialGradient(w * 0.5, h * 0.7, 2, w * 0.5, h * 0.7, 50);
    rg.addColorStop(0, 'rgba(220,235,255,0.9)');
    rg.addColorStop(1, 'rgba(220,235,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8a060';
    ctx.fillRect(w * 0.497, h * 0.42, 5, h * 0.4);
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.8), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false }));
  win.position.set(-3, 2.1, 11.04);
  win.rotation.y = Math.PI;
  root.add(win);
  // The door out, on the right wall.
  root.add(box(0.1, 2.3, 1.3, std(0x2c4a72), 10.84, 0, 8.6));
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), glow(0x62e0a8, 1.5));
  exitSign.position.set(10.82, 2.6, 8.6);
  exitSign.rotation.y = -Math.PI / 2;
  root.add(exitSign);
  // Light: the screen's blue wash, a warm key, cool strips overhead.
  root.add(new THREE.HemisphereLight(0x5a7090, 0x14181e, 1.35));
  const wash = new THREE.PointLight(0x5c9cff, 30, 16, 1.4);
  wash.position.set(0, 3.4, -4.6);
  root.add(wash);
  const key = new THREE.SpotLight(0xffd7aa, 160, 30, 34 * DEG, 0.6, 1.5);
  key.position.set(3.5, 5.5, 9);
  key.target.position.set(0, 1.4, 0);
  root.add(key, key.target);
  const fillL = new THREE.PointLight(0xc8d6ff, 12, 12, 1.5);
  fillL.position.set(-5, 4, 6);
  root.add(fillL);
  for (let x = -8; x <= 8; x += 4) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), glow(0xc8d6e8, 0.9));
    p.position.set(x, 6.9, 3);
    p.rotation.x = Math.PI / 2;
    root.add(p);
  }
  scene.add(root);
  let alarmOn = false;
  let t = 0;
  return {
    root,
    audience: V(0, 0, 1),
    anchors: {
      start: A(7.4, 6.8, FACE_W),
      console: A(-1.4, 3.6, FACE_N, V(-1.4, 1.2, 2.75)),
      bigscreen: A(0, -4.4, FACE_N, V(0, 2.4, -6)),
      kwame: A(6.6, 3.7, FACE_N),
      nadia: A(0.7, 6.5, FACE_N),
      tarek: A(-6.2, 6.5, FACE_N),
      mariam: A(-4.6, 3.7, FACE_N),
      omar: A(-9.5, 1.6, FACE_E),
      aiko: A(4.2, 9.3, FACE_N),
      coffee: A(-9.5, -0.3, FACE_W, V(-10.4, 1.1, -0.3)),
      window: A(-3, 10.2, 0, V(-3, 2, 11)),
      door: A(10.1, 8.6, FACE_E, V(10.8, 1.2, 8.6)),
    },
    walk: {
      bounds: { minX: -10.5, maxX: 10.5, minZ: -5.6, maxZ: 10.6 },
      room: { minX: -10.6, maxX: 10.6, minZ: -5.8, maxZ: 10.8, maxY: 6.2 },
      boxes: ROWS.map((z) => ({ minX: -8.1, maxX: 8.1, minZ: z - 0.5, maxZ: z + 0.5 })).concat([{ minX: -11, maxX: -10.1, minZ: -1, maxZ: 0.6 }]),
      circles: [],
    },
    marks: (n) => row(n, 0, -1.6, 1.25, 0.18),
    wide: () => ({ pos: V(2.2, 2.3, 7.2), look: V(-0.3, 2.0, -4), fov: 46 }),
    window: () => ({ pos: V(0.6, 2.2, 0.6), look: V(0, 3.4, -6), fov: 50 }),
    alarm(on) {
      alarmOn = on;
    },
    update(dt) {
      t += dt;
      const k = alarmOn ? 0.55 + 0.45 * Math.sin(t * 8) : 1;
      screenMat.color.setRGB(1, alarmOn ? k * 0.55 : 1, alarmOn ? k * 0.5 : 1);
      wash.color.setHex(alarmOn ? 0xff4a3a : 0x5c9cff);
      cofLed.material.opacity = 0.6 + 0.3 * Math.sin(t * 2);
    },
  };
}

function briefingSet(scene) {
  const root = new THREE.Group();
  scene.background = new THREE.Color(0x0b0d10);
  scene.fog = new THREE.Fog(0x0b0d10, 12, 28);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), std(0x3a3430, { roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  const wall = std(0xd9d4c8, { roughness: 0.95 });
  root.add(box(18, 4, 0.2, wall, -1, 0, -4.2), box(0.2, 4, 14, wall, -8.6, 0, 2), box(18, 4, 0.2, wall, -1, 0, 8.1), box(0.2, 4, 12.4, std(0x9a958a, { roughness: 0.95 }), 6.62, 0, 1.95));
  // Night windows on the right wall: far off, the floodlit rocket on its pad.
  const winTex = canvasTex(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#04070e');
    g.addColorStop(1, '#1a2a40');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.6})`;
      ctx.fillRect(Math.random() * w, Math.random() * h * 0.6, 1.2, 1.2);
    }
    ctx.fillStyle = '#0a0f16';
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
    const rg = ctx.createRadialGradient(w * 0.62, h * 0.55, 2, w * 0.62, h * 0.55, 60);
    rg.addColorStop(0, 'rgba(220,235,255,0.9)');
    rg.addColorStop(1, 'rgba(220,235,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8a060';
    ctx.fillRect(w * 0.615, h * 0.38, 7, h * 0.44);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(w * 0.6, h * 0.5, 4, h * 0.32);
    ctx.fillRect(w * 0.636, h * 0.5, 4, h * 0.32);
    ctx.fillStyle = '#ff3a20';
    ctx.fillRect(w * 0.66, h * 0.3, 3, 3);
  });
  const winMat = new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false });
  [-1.2, 3.2].forEach((z) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.9), winMat);
    w.position.set(6.4, 1.9, z);
    w.rotation.y = -Math.PI / 2;
    root.add(w, box(0.12, 0.1, 3.8, std(0x30302c), 6.4, 0.9, z));
  });
  // The wall screen: the mission patch and the plan.
  const slide = canvasTex(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#0f1a26';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d9a21b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(w * 0.27, h * 0.5, 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#14273c';
    ctx.beginPath();
    ctx.arc(w * 0.27, h * 0.5, 144, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9b6b0';
    ctx.beginPath();
    ctx.arc(w * 0.31, h * 0.44, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4f8fd6';
    ctx.beginPath();
    ctx.arc(w * 0.21, h * 0.62, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2e6c8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(w * 0.27, h * 0.52, 120, 42, -0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e9eef2';
    ctx.font = '800 64px Archivo, sans-serif';
    ctx.fillText('LANTERN', w * 0.48, h * 0.42);
    ctx.fillStyle = '#a9b6c2';
    ctx.font = '600 28px Archivo, sans-serif';
    ctx.fillText('Crewed lunar flyby · 4 crew', w * 0.48, h * 0.55);
    ctx.fillText('Loading list · margin 40 kg', w * 0.48, h * 0.64);
  });
  const sMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3), new THREE.MeshBasicMaterial({ map: slide, toneMapped: false }));
  sMesh.position.set(-0.6, 2.25, -4.08);
  root.add(sMesh);
  // The long table, two end chairs, and the spacecraft model on it.
  const wood = std(0x5a3b26, { roughness: 0.5 });
  root.add(box(5.4, 0.08, 1.5, wood, 0, 0.74, 0.6));
  [[-2.4, 0.1], [2.4, 0.1], [-2.4, 1.1], [2.4, 1.1]].forEach(([x, z]) => root.add(box(0.1, 0.74, 0.1, std(0x2a2522), x, 0, z)));
  const chairMat = std(0x22303e, { roughness: 0.8 });
  [-3.3, 3.3].forEach((x) => root.add(box(0.5, 0.48, 0.5, chairMat, x, 0, 0.6), box(0.08, 0.5, 0.5, chairMat, x + Math.sign(x) * 0.22, 0.48, 0.6)));
  const model = new THREE.Group();
  const mShell = std(0xdfe3e6, { roughness: 0.45, metalness: 0.3 });
  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.16, 0.2, 20), mShell);
  c1.position.y = 0.38;
  const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 20), std(0xbfc4c8, { metalness: 0.5, roughness: 0.4 }));
  c2.position.y = 0.15;
  const hab = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16), std(0xe3662a));
  hab.position.y = 0.57;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.12, 0.04, 16), std(0x1d1d1d));
  model.add(c1, c2, hab, stand);
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.004, 0.11), std(0x1d3a6a, { metalness: 0.4 }));
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    w.position.set(Math.cos(a) * 0.35, 0.15, Math.sin(a) * 0.35);
    w.rotation.y = -a;
    model.add(w);
  }
  model.position.set(1.6, 0.82, 0.6);
  root.add(model);
  // The door out, on the left wall.
  root.add(box(0.1, 2.2, 1.2, std(0x2c4a72), -8.46, 0, 4.4));
  // Warm pendant lamps over the table.
  root.add(new THREE.HemisphereLight(0xfff0dc, 0x2a2420, 0.6));
  [-1.6, 1.6].forEach((x) => {
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.26, 18, 1, true), std(0x1d1d1d, { side: THREE.DoubleSide }));
    shade.position.set(x, 2.55, 0.6);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glow(0xfff1d0, 2));
    bulb.position.set(x, 2.45, 0.6);
    const l = new THREE.PointLight(0xffd9a8, 9, 7, 1.5);
    l.position.set(x, 2.3, 0.6);
    root.add(shade, bulb, l, box(0.01, 1.2, 0.01, std(0x111111), x, 2.68, 0.6));
  });
  const key = new THREE.DirectionalLight(0xffe8cc, 1.1);
  key.position.set(4, 5, 8);
  root.add(key);
  const moonLight = new THREE.DirectionalLight(0x9ab8ff, 0.6);
  moonLight.position.set(8, 3, 0);
  root.add(moonLight);
  scene.add(root);
  let t = 0;
  return {
    root,
    audience: V(0, 0, 1),
    anchors: {
      start: A(-5.6, 5.6, 2.3),
      table: A(-1.2, 1.95, FACE_N, V(-1.2, 0.85, 0.9)),
      screen: A(-0.6, -3.2, FACE_N, V(-0.6, 2.0, -4.1)),
      model: A(1.6, 1.95, FACE_N, V(1.6, 1.1, 0.6)),
      kwame: A(3.4, 1.7, -0.9),
      nadia: A(-3.6, -2.5, 0.4),
      tarek: A(5.2, -2.4, -0.7),
      aiko: A(-4.9, 1.2, 0.9),
      door: A(-7.8, 4.4, FACE_W, V(-8.45, 1.2, 4.4)),
    },
    walk: {
      bounds: { minX: -8.2, maxX: 6.0, minZ: -3.8, maxZ: 7.7 },
      room: { minX: -8.35, maxX: 6.25, minZ: -3.95, maxZ: 7.85, maxY: 3.6 },
      boxes: [{ minX: -2.85, maxX: 2.85, minZ: -0.3, maxZ: 1.5 }, { minX: -3.65, maxX: -2.95, minZ: 0.25, maxZ: 0.95 }, { minX: 2.95, maxX: 3.65, minZ: 0.25, maxZ: 0.95 }],
      circles: [],
    },
    marks: (n) => row(n, 0, -0.9, 1.05, 0.1),
    wide: () => ({ pos: V(1.4, 1.75, 5.6), look: V(-0.3, 1.45, -2), fov: 48 }),
    window: () => ({ pos: V(2.6, 1.7, 1.2), look: V(6.4, 1.9, -1.2), fov: 42 }),
    update(dt) {
      t += dt;
      model.rotation.y = t * 0.15;
    },
  };
}

function capsuleSet(scene, opts) {
  const root = new THREE.Group();
  scene.background = new THREE.Color(0x020306);
  scene.fog = null;
  let cap = null;
  if (opts.capsule && typeof opts.capsule.createCapsuleInterior === 'function') {
    try {
      cap = opts.capsule.createCapsuleInterior({ reduced: opts.reduced, outside: opts.view || 'both', power: opts.power, vent: opts.vent });
    } catch (e) {
      console.warn('capsule interior failed, using the stand-in', e);
      cap = null;
    }
  }
  if (!cap || !cap.group) cap = standInCapsule(opts.view);
  root.add(cap.group);
  scene.add(root);
  cap.group.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(cap.group);
  const center = bb.getCenter(V());
  const size = bb.getSize(V());
  const floorY = cap.floorY !== undefined ? cap.floorY : bb.min.y;
  const R = Math.max(1.2, Math.min(size.x, size.z) * 0.5 - 0.5);
  if (cap.setPower && opts.power !== undefined) cap.setPower(opts.power);
  const worldOf = (o) => {
    if (!o) return null;
    if (o.isVector3) return o.clone();
    if (o.isObject3D) return o.getWorldPosition(V());
    if (typeof o.x === 'number') return V(o.x, o.y || 0, o.z);
    return null;
  };
  // Anchors: what capsule.js names (cap.anchors), else from seats, window and
  // panels, else spots around the stand-in's wall.
  const anchors = {};
  const toward = (p) => Math.atan2(center.x - p.x, center.z - p.z);
  const stand = (thing, inward = 0.55) => {
    const p = worldOf(thing);
    if (!p) return null;
    const d = V(center.x - p.x, 0, center.z - p.z);
    const len = d.length();
    if (len > 0.01) d.multiplyScalar(Math.min(inward, len) / len);
    const spot = V(p.x + d.x, floorY, p.z + d.z);
    return { x: spot.x, y: floorY, z: spot.z, ry: toward(spot) + Math.PI, at: p };
  };
  const given = cap.anchors || {};
  const names = ['start', 'seat_you', 'seat_yusuf', 'seat_lena', 'seat_grace', 'window', 'panel_left', 'panel_center', 'panel_right', 'locker_1', 'locker_2', 'locker_3', 'locker_4', 'locker_5', 'locker_6', 'hatch', 'medkit', 'toilet', 'camera'];
  const ring = (deg, inward = 0.55) => {
    const a = deg * DEG;
    const p = V(center.x + Math.sin(a) * (R + 0.4), floorY + 1.3, center.z + Math.cos(a) * (R + 0.4));
    return stand(p, inward);
  };
  const FALL = { start: [0, -1], seat_you: [-30], seat_yusuf: [30], seat_lena: [-80], seat_grace: [80], window: [200], panel_left: [140], panel_center: [180], panel_right: [220], locker_1: [-100], locker_2: [-125], locker_3: [-150], locker_4: [100], locker_5: [125], locker_6: [150], hatch: [0], medkit: [-55], toilet: [55], camera: [245] };
  names.forEach((n) => {
    let a = null;
    if (given[n]) a = stand(given[n], 0);
    else if (n.startsWith('seat_') && cap.seats && cap.seats[n.slice(5)]) a = stand(cap.seats[n.slice(5)], 0);
    else if (n === 'window' && cap.window) a = stand(cap.window, 0.7);
    else if (n.startsWith('panel_') && Array.isArray(cap.panels) && cap.panels.length >= 3) a = stand(cap.panels[{ panel_left: 0, panel_center: 1, panel_right: 2 }[n]], 0.6);
    if (!a && n === 'start') a = { x: center.x, y: floorY, z: center.z + 0.2, ry: Math.PI, at: null };
    if (!a) a = ring(FALL[n][0]);
    anchors[n] = a;
  });
  // The crew float upright where their seats are (the couches are below them).
  const seatOf = (id) => anchors['seat_' + id];
  return {
    root,
    cap,
    capPoses: opts.capsule && opts.capsule.sitPose ? { sitPose: opts.capsule.sitPose, floatPose: opts.capsule.floatPose } : null,
    zeroG: true,
    anchors,
    floorY,
    volume: { min: V(center.x - R, floorY, center.z - R), max: V(center.x + R, floorY + Math.max(0.3, size.y - 2.0), center.z + R) },
    walk: { bounds: null, circles: [], boxes: [], clamp: cap.volume && cap.volume.clamp ? (p) => cap.volume.clamp(p) : (p) => {
      const dx = p.x - center.x;
      const dz = p.z - center.z;
      const d = Math.hypot(dx, dz);
      if (d > R) {
        p.x = center.x + (dx / d) * R;
        p.z = center.z + (dz / d) * R;
      }
      return p;
    } },
    audience: V(0, 0, 1),
    marks(n, ids) {
      return ids.map((id, i) => {
        const s = seatOf(id);
        const a = (i / Math.max(1, n) - 0.5) * 2.2;
        const x = s ? s.x : center.x + Math.sin(a) * 1.0;
        const z = s ? s.z : center.z + Math.cos(a) * 0.9 - 0.2;
        return { x, y: floorY + 0.12, z, ry: Math.atan2(center.x - x, center.z + 1.2 - z), float: true };
      });
    },
    // capsule.js: +z is the forward panel, the crew sit facing it; the wide
    // shot looks back at them from beside the panel.
    wide: () =>
      cap.radiusAt
        ? { pos: V(0.35, floorY + 1.5, cap.radiusAt(1.5) - 0.25), look: V(-0.05, floorY + 0.95, -0.7), fov: 74 }
        : { pos: V(center.x + 0.3, floorY + 1.9, center.z + R * 0.95), look: V(center.x - 0.1, floorY + 1.45, center.z - R * 0.5), fov: 70 },
    // Keeps a camera inside the cabin walls.
    clampCam(p) {
      const y = p.y - floorY;
      const r = (cap.radiusAt ? cap.radiusAt(clamp(y, 0, 2.55)) : R + 0.4 - y * 0.4) - 0.18;
      const dx = p.x - center.x;
      const dz = p.z - center.z;
      const d = Math.hypot(dx, dz);
      if (d > r) {
        p.x = center.x + (dx / d) * r;
        p.z = center.z + (dz / d) * r;
      }
      p.y = clamp(p.y, floorY + 0.3, floorY + (cap.radiusAt ? 2.45 : 2.6));
      return p;
    },
    window: () => {
      const w = cap.window;
      if (!w) return { pos: V(0, floorY + 2, 0.4), look: V(0, floorY + 2.2, -2), fov: 50 };
      const p = worldOf(w);
      const dir = p.clone().sub(center).setY(0).normalize();
      return { pos: p.clone().sub(dir.multiplyScalar(0.75)).add(V(0, -0.05, 0)), look: p, fov: 52 };
    },
    alarm(on) {
      if (cap.setAlarm) cap.setAlarm(on);
    },
    power(k) {
      if (cap.setPower) cap.setPower(k);
    },
    frost(k) {
      if (cap.setFrost) cap.setFrost(k);
    },
    update(dt) {
      if (cap.update) cap.update(dt);
    },
    dispose() {
      if (cap.dispose) cap.dispose();
    },
  };
}
function standInCapsule(view) {
  const group = new THREE.Group();
  const pad = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c9ccc6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(60,60,60,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= w; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,40,40,0.35)';
    for (let x = 16; x < w; x += 32) for (let y = 16; y < h; y += 32) ctx.fillRect(x - 1, y - 1, 3, 3);
  });
  pad.wrapS = pad.wrapT = THREE.RepeatWrapping;
  pad.repeat.set(8, 3);
  const wallMat = std(0xffffff, { map: pad, roughness: 0.9, side: THREE.BackSide });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 2.5, 2.9, 40, 1, true), wallMat);
  shell.position.y = 1.45;
  group.add(shell);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.5, 40), std(0x5d6268, { roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const ceil = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), std(0xb9bcb6));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 2.9;
  group.add(ceil);
  // The main display and switch panel, curved across the front.
  const panelTex = canvasTex(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2b3036';
    ctx.fillRect(0, 0, w, h);
    const hues = ['#62e0a8', '#7fc4ff', '#f0b429'];
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 330;
      ctx.fillStyle = '#05100c';
      ctx.fillRect(x, 30, 280, 150);
      ctx.strokeStyle = hues[i];
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k < 280; k += 8) ctx.lineTo(x + k, 110 + Math.sin(k * 0.05 + i) * 40 * Math.random());
      ctx.stroke();
      ctx.fillStyle = hues[i];
      ctx.font = '700 22px monospace';
      ctx.fillText(['ECLSS', 'GNC', 'POWER'][i], x + 10, 56);
    }
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = i % 7 === 0 ? '#d9a21b' : '#9aa2aa';
      ctx.fillRect(30 + (i % 30) * 32, 200 + Math.floor(i / 30) * 24, 14, 10);
    }
  });
  const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, emissive: 0xffffff, emissiveMap: panelTex, emissiveIntensity: 0.7, roughness: 0.6, side: THREE.DoubleSide });
  const panel = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.15, 0.9, 32, 1, true, Math.PI - 0.9, 1.8), panelMat);
  panel.position.y = 1.55;
  group.add(panel);
  // Two windows looking out.
  const wt = windowTex(view);
  const windows = [];
  [-0.55, 0.55].forEach((a) => {
    const r = 1.62;
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.26, 28), new THREE.MeshBasicMaterial({ map: wt, toneMapped: false }));
    w.position.set(Math.sin(Math.PI + a) * r, 2.3, Math.cos(Math.PI + a) * r);
    w.lookAt(0, 2.0, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 28), std(0x3c4148, { metalness: 0.5, roughness: 0.4 }));
    ring.position.copy(w.position);
    ring.quaternion.copy(w.quaternion);
    group.add(w, ring);
    windows.push(w);
  });
  // Seats: low couches on the floor, the crew float above them.
  const seats = {};
  const seatMat = std(0x3a4148, { roughness: 0.7 });
  [['you', -0.5], ['yusuf', 0.5], ['lena', -1.4], ['grace', 1.4]].forEach(([id, a]) => {
    const anchor = new THREE.Object3D();
    anchor.position.set(Math.sin(a) * 1.15, 0, Math.cos(a) * 1.15 - 0.2);
    group.add(anchor);
    seats[id] = anchor;
    const s = box(0.6, 0.3, 0.9, seatMat, anchor.position.x, 0, anchor.position.z);
    s.rotation.y = a;
    group.add(s);
  });
  // Stowage around the wall: six lockers, the medical kit, the toilet
  // curtain, a camera on its bracket, and the hatch. Angles match the
  // fallback anchors in capsuleSet.
  const onWall = (deg, y, mesh) => {
    const a = deg * DEG;
    const r = 2.5 - (y / 2.9) * 1.25 - 0.06;
    mesh.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    mesh.lookAt(0, y, 0);
    group.add(mesh);
    return mesh;
  };
  const lockerMat = std(0xa8aea8, { roughness: 0.7 });
  [-100, -125, -150, 100, 125, 150].forEach((d) => {
    onWall(d, 0.9, new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.05), lockerMat));
    onWall(d, 0.78, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.08), std(0x30343a)));
  });
  onWall(-55, 1.1, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.08), std(0xe8e8e2)));
  onWall(-55, 1.1, new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), glow(0xd02a20, 1))).translateZ(0.05);
  onWall(-55, 1.1, new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.16), glow(0xd02a20, 1))).translateZ(0.05);
  onWall(55, 1.1, new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), std(0x6a7a8a, { roughness: 1, side: THREE.DoubleSide })));
  onWall(245, 2.1, new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.14), std(0x1d1f22, { metalness: 0.4 })));
  onWall(0, 1.25, new THREE.Mesh(new THREE.CircleGeometry(0.55, 28), std(0x8d949a, { metalness: 0.5, roughness: 0.4 }))).translateZ(-0.02);
  onWall(0, 1.25, new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 28), std(0x3c4148, { metalness: 0.5 })));
  const panelMarks = [-0.55, 0, 0.55].map((a) => {
    const o = new THREE.Object3D();
    o.position.set(Math.sin(Math.PI + a) * 2.05, 1.55, Math.cos(Math.PI + a) * 2.05);
    group.add(o);
    return o;
  });
  // Cabin light strips, and the red master alarm.
  const strips = glow(0xe8f0ff, 1.4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.06), strips);
    s.position.set(Math.sin(a) * 1.32, 2.78, Math.cos(a) * 1.32);
    s.rotation.y = a;
    group.add(s);
  }
  const cabin = new THREE.PointLight(0xeef4ff, 14, 8, 1.4);
  cabin.position.set(0, 2.6, 0.4);
  const fill = new THREE.HemisphereLight(0xdfe8f2, 0x3a3e44, 0.6);
  const red = new THREE.PointLight(0xff2a1a, 0, 7, 1.4);
  red.position.set(0, 2.2, -1.2);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow(0xff3020, 1));
  lamp.position.set(0.0, 2.05, -1.95);
  group.add(cabin, fill, red, lamp);
  let alarmOn = false;
  let pw = 1;
  let t = 0;
  return {
    group,
    seats,
    window: windows[0],
    panels: panelMarks,
    floorY: 0,
    update(dt) {
      t += dt;
      const k = alarmOn ? Math.max(0, Math.sin(t * 7)) : 0;
      red.intensity = k * 28;
      lamp.material.color.setRGB(alarmOn ? 1.2 + k * 2 : 0.3, alarmOn ? 0.15 : 0.05, 0.05);
      cabin.intensity = 14 * pw;
      fill.intensity = 0.15 + 0.45 * pw;
      strips.color.setRGB(1.4 * pw, 1.45 * pw, 1.55 * pw);
      panelMat.emissiveIntensity = 0.15 + 0.55 * pw;
    },
    setAlarm(on) {
      alarmOn = !!on;
    },
    setPower(k) {
      pw = clamp(k, 0, 1);
    },
    setFrost() {},
    dispose() {},
  };
}

function spacecraft(vent) {
  const g = new THREE.Group();
  const shellMat = std(0xdfe3e6, { roughness: 0.45, metalness: 0.3 });
  const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 2.5, 3.2, 40), shellMat);
  capsule.position.y = 1.6 + 4.6;
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(2.52, 2.52, 0.18, 40), std(0x5a4030, { roughness: 0.9 }));
  shield.position.y = 4.6 + 0.09;
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 4.2, 40), std(0xbfc4c8, { roughness: 0.5, metalness: 0.5 }));
  sm.position.y = 2.4;
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.2, 1.8, 24, 1, true), std(0x3a3632, { metalness: 0.85, roughness: 0.4, side: THREE.DoubleSide }));
  bell.position.y = -0.6;
  g.add(capsule, shield, sm, bell);
  const cells = canvasTex(64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0d1c3a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4a6a9a';
    for (let y = 0; y < h; y += 16) ctx.strokeRect(2, y + 1, w - 4, 14);
  });
  const wingMat = std(0xffffff, { map: cells, roughness: 0.35, metalness: 0.4, emissive: 0x0a1428 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 7), wingMat);
    w.position.set(Math.cos(a) * 6.1, 1.6, Math.sin(a) * 6.1);
    w.rotation.y = -a + Math.PI / 2;
    w.rotation.z = 0;
    w.lookAt(Math.cos(a) * 20, 1.6, Math.sin(a) * 20);
    w.rotateY(Math.PI / 2);
    g.add(w);
  }
  if (vent) {
    // Something venting from the service module: Apollo 13, 1970.
    const v = puffs(30, { life: 4, size: [0.6, 7], opacity: 0.5, color: 0xf2f6ff, fog: false, at: (s, k) => V(2.5 + k * 16 + s * 2, 2.6 + (s - 0.5) * 2 * k * 5, 0.6 + (s - 0.5) * k * 8) });
    g.add(v);
    g.userData.vent = v;
  }
  return g;
}

function spaceSet(scene, opts) {
  const root = new THREE.Group();
  scene.background = new THREE.Color(0x000000);
  scene.fog = null;
  root.add(makeStars(4000, 4e4, 13));
  const sunDir = V(-0.6, 0.25, 0.75).normalize();
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.2);
  sun.position.copy(sunDir).multiplyScalar(100);
  root.add(sun, new THREE.AmbientLight(0x404a58, 0.18));
  const sunSprite = makeSun(1800);
  sunSprite.position.copy(sunDir).multiplyScalar(3e4);
  root.add(sunSprite);
  const earth = makePlanet('earth', 640, { segments: 96, res: 1024 });
  earth.position.set(-900, -420, -4200);
  earth.rotation.y = 2.4;
  const moon = makePlanet('moon', 300, { segments: 72, res: 512 });
  moon.position.set(1400, 260, -2600);
  root.add(earth, moon);
  const ship = spacecraft(opts.vent);
  ship.rotation.set(0.35, 0.6, -0.95);
  root.add(ship);
  scene.add(root);
  return {
    root,
    audience: V(0, 0, 1),
    marks: () => [],
    wide: () => ({ pos: V(15, 7, 40), look: V(-7, 1.5, 0), fov: 40 }),
    window: () => ({ pos: V(4, 4, 15), look: V(-260, -140, -4200), fov: 34 }),
    update(dt) {
      earth.rotation.y += dt * 0.004;
      ship.rotation.y += dt * 0.012;
      if (ship.userData.vent) ship.userData.vent.userData.update(dt);
    },
  };
}

function blackSet(scene) {
  const root = new THREE.Group();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 4, 14);
  const spot = new THREE.SpotLight(0xbfd4ff, 60, 14, 28 * DEG, 0.75, 1.4);
  spot.position.set(0.6, 6, 2.2);
  spot.target.position.set(0, 1.2, 0);
  root.add(spot, spot.target, new THREE.AmbientLight(0x10141c, 0.4));
  const motes = puffs(14, { life: 9, size: [0.04, 0.08], opacity: 0.6, color: 0xbfd4ff, at: (s, k) => V((s - 0.5) * 3, 2.8 - k * 2.6, (s * 7) % 1.4 - 0.4) });
  root.add(motes);
  scene.add(root);
  return {
    root,
    audience: V(0, 0, 1),
    marks: (n) => row(n, 0, 0, 1.0, 0.25),
    wide: () => ({ pos: V(0.8, 1.6, 6.2), look: V(0, 1.2, 0), fov: 40 }),
    window: () => ({ pos: V(0, 1.6, 4), look: V(0, 2.4, -4), fov: 40 }),
    update(dt) {
      motes.userData.update(dt);
    },
  };
}


// People in a gentle arc facing the audience (+Z). curve bends the ends forward.
function row(n, cx, cz, gap, curve) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = i - (n - 1) / 2;
    const x = cx + u * gap;
    const z = cz + Math.abs(u) * (curve || 0) * gap;
    out.push({ x, y: 0, z, ry: -u * 0.14 });
  }
  return out;
}

// ---------- The stage ----------
// opts: { set, cast, place ({castId: anchor}), layout ('anchors' | 'marks'),
//         you (appearance), staff (SMD.content.staff), capsule (capsule.js module),
//         view ('both'|'earth'|'moon'|'farside'), power (0..1), vent (bool), reduced }
export function createStoryStage(opts = {}) {
  const reduced = opts.reduced !== undefined ? !!opts.reduced : reducedMotion();
  const setName = ['pad', 'control', 'briefing', 'capsule', 'space', 'black'].includes(opts.set) ? opts.set : 'black';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 1e5);
  let aspect = 16 / 9;
  const S = setName === 'pad' ? padSet(scene) : setName === 'control' ? controlSet(scene) : setName === 'briefing' ? briefingSet(scene) : setName === 'capsule' ? capsuleSet(scene, Object.assign({ reduced }, opts)) : setName === 'space' ? spaceSet(scene, opts) : blackSet(scene);
  S.anchors = S.anchors || { start: { x: 0, y: 0, z: 0, ry: 0, at: null } };
  S.walk = S.walk || { bounds: { minX: -3, maxX: 3, minZ: -3, maxZ: 3 }, boxes: [], circles: [] };
  let disposed = false;
  if (setName !== 'space' && setName !== 'black') {
    studioEnv()
      .then((t) => {
        if (disposed) return;
        scene.environment = t;
        scene.environmentIntensity = setName === 'capsule' ? 0.35 : 0.22;
      })
      .catch(() => {});
  }

  // ---------- Cast ----------
  const castIds = setName === 'space' ? [] : (opts.cast || []).filter((id) => CREW.includes(id) || STAFF_OF[id]);
  const place = opts.place || {};
  const anchored = opts.layout === 'anchors';
  const zeroG = !!S.zeroG;
  const seated = setName === 'capsule' && !!(S.cap && S.cap.seatMeshes);
  const marks = S.marks(castIds.length, castIds) || [];
  // Where each person stands. Anchored scenes: their own anchor (kwame stands
  // at 'kwame'), the scene's `place`, else around the start.
  const spots = castIds.map((id, i) => {
    if (anchored) {
      const name = place[id] || (S.anchors[id] ? id : null) || (id === 'you' ? 'start' : null);
      const a = name && S.anchors[name];
      if (a) return { x: a.x, y: a.y || 0, z: a.z, ry: a.ry || 0, anchor: name };
      const st = S.anchors.start;
      const k = i + 1;
      const ang = (st.ry || 0) + Math.PI / 2;
      return { x: st.x + Math.sin(ang) * 1.1 * (k % 2 ? 1 : -1) * Math.ceil(k / 2), y: st.y || 0, z: st.z + Math.cos(ang) * 1.1 * (k % 2 ? 1 : -1) * Math.ceil(k / 2), ry: st.ry || 0 };
    }
    return marks[i] || { x: i, y: 0, z: 0, ry: 0 };
  });
  const actors = {};
  const staffIds = castIds.filter((id) => STAFF_OF[id]);
  let crew = null;
  const defs = (opts.staff || (SMD.content && SMD.content.staff) || []).slice();
  if (staffIds.length && defs.length) {
    const want = staffIds.map((id) => defs.find((d) => d.id === STAFF_OF[id])).filter(Boolean);
    const routes = {};
    want.forEach((d) => {
      const id = staffIds.find((k) => STAFF_OF[k] === d.id);
      const m = spots[castIds.indexOf(id)] || { x: 0, z: 0 };
      routes[d.id] = [{ x: m.x, z: m.z }];
    });
    crew = createStaff(want, { routes, reduced, nearLod: 400 });
    scene.add(crew.group);
  }
  function addAstro(id, m) {
    const ap = id === 'you' ? opts.you || (SMD.avatar && SMD.avatar.get()) : crewLook(id, opts.you);
    const astro = createAstronaut(ap, { shadows: false, blob: !zeroG && setName !== 'black', helmet: false });
    astro.group.position.set(m.x, m.y || 0, m.z);
    astro.group.rotation.y = m.ry || 0;
    scene.add(astro.group);
    const sit = seated && !anchored ? true : seated && anchored && !!(m.anchor && m.anchor.startsWith('seat_')) && id !== 'you';
    actors[id] = { id, kind: 'astro', astro, root: astro.group, base: V(m.x, m.y || 0, m.z), ry: m.ry || 0, float: (zeroG && !sit) || !!m.float, sit, phase: Object.keys(actors).length * 1.7, mood: null, talk: 0, look: null, moodK: {} };
    if (sit && seated) {
      const a = S.cap.seats[id];
      if (a) {
        const p = a.getWorldPosition(V());
        astro.group.position.copy(p);
        astro.group.quaternion.copy(a.getWorldQuaternion(new THREE.Quaternion()));
        actors[id].base.copy(p);
        actors[id].ry = astro.group.rotation.y;
      }
    }
    if (zeroG && !sit && anchored && m.anchor && S.anchors[m.anchor] && S.anchors[m.anchor].at) {
      // Floating at a wall spot: feet below it, head about level with it.
      const at = S.anchors[m.anchor].at;
      actors[id].base.y = Math.max((S.floorY || 0) + 0.05, at.y - 1.35);
      astro.group.position.y = actors[id].base.y;
    }
    return actors[id];
  }
  castIds.forEach((id, i) => {
    const m = spots[i];
    if (CREW.includes(id)) addAstro(id, m);
    else if (crew) {
      const p = crew.get(STAFF_OF[id]);
      if (!p) return;
      p.P.root.rotation.y = m.ry || 0;
      actors[id] = { id, kind: 'staff', p, root: p.P.root, base: V(m.x, 0, m.z), ry: m.ry || 0, mood: null, talk: 0, look: null, yaw: 0 };
    }
  });
  let ids = Object.keys(actors);
  const center = V();
  ids.forEach((id) => center.add(actors[id].base));
  if (ids.length) center.multiplyScalar(1 / ids.length);

  const tmp = V();
  // World position of the middle of a head.
  function head(id, out = V()) {
    const a = actors[id];
    if (!a) return out.copy(center).setY(1.55);
    if (a.kind === 'astro') {
      a.astro.joints.head.getWorldPosition(out);
      return out.add(tmp.set(0, 0.13, 0));
    }
    a.p.P.head.getWorldPosition(out);
    return out.add(tmp.set(0, 0.12 * (a.p.P.body.scale.y || 1), 0));
  }

  // ---------- Cameras ----------
  let spec = { type: 'wide' };
  let shotT = 0;
  let side = 1;
  let shake = 0;
  const camPos = V();
  const camLook = V();
  const fovFor = (f) => (aspect < 1 ? Math.min(95, f * (1 + (1 - aspect) * 1.05)) : f);
  function listenerOf(id) {
    const others = ids.filter((k) => k !== id);
    if (!others.length) return null;
    const a = actors[id];
    if (a && a.look && actors[a.look] && a.look !== id) return a.look;
    if (others.includes('you')) return 'you';
    // The nearest person.
    let best = others[0];
    let bd = Infinity;
    others.forEach((k) => {
      const d = actors[k].root.position.distanceTo(a ? a.root.position : center);
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    return best;
  }
  // Fills camPos / camLook for the current shot; returns the fov.
  function frame() {
    let fov = 40;
    if (spec.type === 'close' && actors[spec.id]) {
      const H = head(spec.id);
      const L = listenerOf(spec.id);
      const dir = L ? head(L).sub(H).setY(0) : S.audience.clone();
      if (dir.lengthSq() < 1e-4) dir.copy(S.audience);
      dir.normalize();
      // Toward the listener, turned around to a 3/4 face on the audience side.
      const aud = anchored || exploring ? dir.clone() : S.audience.clone();
      const turn = Math.sign(dir.clone().cross(aud).y || 1) * side;
      dir.applyAxisAngle(UP, turn * 0.55);
      if (!anchored && dir.dot(aud) < -0.2) dir.lerp(aud, 0.6).normalize();
      const dist = (aspect < 1 ? 1.45 : 1.75) * (zeroG ? 0.8 : 1);
      camPos.copy(H).addScaledVector(dir, dist).add(tmp.set(0, 0.03, 0));
      const perp = dir.clone().cross(UP).normalize();
      camLook.copy(H).add(tmp.set(0, -0.06, 0)).addScaledVector(perp, aspect < 1 ? 0 : 0.16 * turn);
      fov = 32;
    } else if (spec.type === 'two' && actors[spec.a] && actors[spec.b]) {
      const Ah = head(spec.a);
      const Bh = head(spec.b);
      const mid = Ah.clone().add(Bh).multiplyScalar(0.5);
      const ab = Bh.clone().sub(Ah).setY(0);
      const len = Math.max(0.4, ab.length());
      const perp = V(-ab.z, 0, ab.x).normalize();
      const pref = exploring || anchored ? camera.position.clone().sub(mid).setY(0) : S.audience;
      if (perp.dot(pref) < 0) perp.negate();
      const dist = Math.min(zeroG ? 2.0 : 9, len * (aspect < 1 ? 2.3 : 1.15) + (zeroG ? 0.6 : 1.0));
      camPos.copy(mid).addScaledVector(perp, dist).addScaledVector(ab.normalize(), -0.25 * len).add(tmp.set(0, 0.05, 0));
      camLook.copy(mid).add(tmp.set(0, -0.1, 0));
      fov = zeroG ? 50 : 36;
    } else if (spec.type === 'window') {
      const w = S.window();
      camPos.copy(w.pos);
      camLook.copy(w.look);
      fov = w.fov;
    } else if (anchored && ids.length && setName !== 'capsule') {
      // Wide in an explorable set: frame everyone from the start side.
      const st = S.anchors.start;
      let r = 1;
      ids.forEach((id) => (r = Math.max(r, actors[id].root.position.distanceTo(center))));
      const back = V(Math.sin(st.ry || 0), 0, Math.cos(st.ry || 0)).negate();
      camPos.copy(center).addScaledVector(back, r * 1.3 + 4).add(tmp.set(1.2, 2.2, 0));
      camLook.copy(center).add(tmp.set(0, 1.2, 0));
      fov = 50;
    } else {
      const w = S.wide();
      camPos.copy(w.pos);
      camLook.copy(w.look);
      fov = w.fov;
      if (ids.length && setName !== 'capsule' && setName !== 'pad') {
        let r = 0;
        ids.forEach((id) => (r = Math.max(r, Math.abs(actors[id].base.x - center.x))));
        camPos.z = Math.max(camPos.z, center.z + r * 1.6 + 3.2);
      }
    }
    if (S.clampCam && spec.type !== 'window') S.clampCam(camPos);
    // Inside a room the camera never ends up behind a wall.
    const room = S.walk && S.walk.room;
    if (room) {
      camPos.x = clamp(camPos.x, room.minX + 0.3, room.maxX - 0.3);
      camPos.z = clamp(camPos.z, room.minZ + 0.3, room.maxZ - 0.3);
      if (room.maxY != null) camPos.y = Math.min(camPos.y, room.maxY - 0.2);
    }
    return fovFor(fov);
  }
  function shot(value) {
    const v = String(value || 'wide');
    if (v.startsWith('close:')) spec = { type: 'close', id: v.slice(6) };
    else if (v.startsWith('two:')) {
      const [a, b] = v.slice(4).split(',');
      spec = { type: 'two', a, b };
    } else if (v === 'window') spec = { type: 'window' };
    else spec = { type: 'wide' };
    if (spec.type === 'close' && !actors[spec.id]) spec = { type: 'wide' };
    if (spec.type === 'two' && (!actors[spec.a] || !actors[spec.b])) spec = { type: 'wide' };
    side = -side;
    shotT = 0;
  }
  // The automatic cut for a line: the speaker close, now and then a two-shot.
  let autoN = 0;
  function autoShot(speaker, prev) {
    if (!actors[speaker]) {
      // An off-screen voice (the radio): hold on someone listening.
      const l = ids.includes('you') ? 'you' : ids[0];
      if (l) shot('close:' + l);
      else if (spec.type !== 'wide' && spec.type !== 'window') shot('wide');
      return;
    }
    autoN++;
    if (prev && prev !== speaker && actors[prev] && autoN % 3 === 0) shot(`two:${speaker},${prev}`);
    else shot('close:' + speaker);
  }

  // ---------- Acting ----------
  let speaker = null;
  function speak(id, mood, listener) {
    speaker = actors[id] ? id : null;
    ids.forEach((k) => {
      const a = actors[k];
      a.talk = k === speaker ? 1 : 0;
      if (k === speaker) a.look = listener && actors[listener] && listener !== k ? listener : listenerOf(k);
      else if (speaker) a.look = speaker;
    });
    if (crew) staffIds.forEach((k) => actors[k] && crew.talk(STAFF_OF[k], false));
    if (speaker && actors[speaker].kind === 'staff') crew.talk(STAFF_OF[speaker], true);
    if (speaker && mood) setMood(speaker, mood);
  }
  function quiet() {
    speaker = null;
    ids.forEach((k) => (actors[k].talk = 0));
    if (crew) staffIds.forEach((k) => actors[k] && crew.talk(STAFF_OF[k], false));
  }
  function setMood(id, mood) {
    const a = actors[id];
    if (!a) return;
    a.mood = mood || null;
    if (a.kind === 'astro') {
      a.astro.setExpression(mood && EXPR[mood] !== undefined ? EXPR[mood] : null);
      if (mood === 'sad' && !a.astro.action && !a.sit) a.astro.sad();
    }
  }
  const lookAway = {};
  function anim(id, name) {
    const a = actors[id];
    if (!a) return;
    if (a.kind === 'astro') {
      if (name === 'look') {
        lookAway[id] = 2.6;
        return;
      }
      if (['wave', 'celebrate', 'sad', 'cheer'].includes(name)) a.astro.play(a.sit && name === 'celebrate' ? 'cheer' : name);
    } else if (name === 'wave' || name === 'cheer' || name === 'celebrate') crew.wave(STAFF_OF[id]);
    else if (name === 'look') lookAway[id] = 2.6;
  }

  // ---------- Exploring (the shared controller drives 'you' and the camera) ----------
  let ctl = null;
  let exploring = false;
  let cine = false;
  let items = [];
  const markers = new THREE.Group();
  scene.add(markers);
  function anchorSpot(name) {
    const a = S.anchors[name] || S.anchors.start;
    return a;
  }
  // The point an item sits at: the person standing there, else the thing.
  function itemPoint(it) {
    const who = Object.keys(actors).find((k) => k !== 'you' && (k === it.at || (actors[k] && spots[castIds.indexOf(k)] && spots[castIds.indexOf(k)].anchor === it.at)));
    if (who) return { obj: actors[who].kind === 'astro' ? actors[who].astro.joints.head : actors[who].p.P.head, who };
    const a = anchorSpot(it.at);
    return { pos: a.at ? a.at.clone() : V(a.x, (a.y || 0) + 1.1, a.z) };
  }
  function beginExplore(o) {
    const Ctl = o.controller;
    if (!Ctl || !Ctl.createController) throw new Error('no controller module');
    if (!actors.you) {
      const st = anchorSpot('start');
      addAstro('you', { x: st.x, y: st.y || 0, z: st.z, ry: st.ry || 0 });
      ids = Object.keys(actors);
    }
    const you = actors.you;
    you.sit = false;
    you.float = false;
    const sp = anchorSpot(o.spawn || 'start');
    const spawn = V(sp.x, zeroG ? Math.max((S.floorY || 0) + 0.2, sp.at ? sp.at.y - 1.4 : (sp.y || 0) + 0.3) : sp.y || 0, sp.z);
    // Other people are round obstacles; the camera keeps clear of the set's boxes.
    const circles = (S.walk.circles || []).slice();
    ids.forEach((k) => k !== 'you' && circles.push({ x: actors[k].root.position.x, z: actors[k].root.position.z, r: 0.38 }));
    const walkable = Object.assign({}, S.walk, { circles });
    const room = S.walk.room || null;
    // The camera stops short of the room's walls (it pulls in, never clips).
    const cameraClear = room
      ? (o, d, want) => {
          let tMax = want;
          if (d.x > 1e-6) tMax = Math.min(tMax, (room.maxX - o.x) / d.x);
          if (d.x < -1e-6) tMax = Math.min(tMax, (room.minX - o.x) / d.x);
          if (d.z > 1e-6) tMax = Math.min(tMax, (room.maxZ - o.z) / d.z);
          if (d.z < -1e-6) tMax = Math.min(tMax, (room.minZ - o.z) / d.z);
          if (room.maxY != null && d.y > 1e-6) tMax = Math.min(tMax, (room.maxY - o.y) / d.y);
          return Math.max(0.6, tMax - 0.15);
        }
      : null;
    ctl = Ctl.createController({
      cameraClear,
      camera,
      dom: o.dom,
      overlay: o.overlay,
      character: you.astro,
      mode: zeroG ? 'zeroG' : 'ground',
      walkable,
      volume: zeroG ? (S.cap && S.cap.volume) || S.volume : null,
      cameraBoxes: S.walk.boxes,
      rig: zeroG ? { distance: 1.9, height: 1.45, shoulder: 0.3, min: 0.9, max: 2.6, fov: 64, tight: true } : setName === 'pad' ? { distance: 4.4, fov: 55 } : { distance: 3.8, min: 1.2, max: 5.5, fov: 58, tight: true, bounds: room },
      speeds: setName === 'pad' ? { walk: 2.2, run: 5.2 } : undefined,
      interactables: [],
    });
    ctl.teleport(spawn, sp.ry || 0);
    if (ctl.snapCamera) ctl.snapCamera();
    exploring = true;
    cine = false;
    if (o.items) setItems(o.items, o.onInteract);
    return ctl;
  }
  function setItems(list, onInteract) {
    items = (list || []).map((it) => Object.assign({}, it));
    while (markers.children.length) {
      const m = markers.children.pop();
      m.material.dispose();
    }
    if (!ctl) return;
    const recs = items.map((it) => {
      const pt = itemPoint(it);
      const at = pt.obj || pt.pos;
      if (pt.pos && !it.used) {
        // A faint mote marks what can be looked at; brighter until it is used.
        const s = glowSprite(it.exit ? 0x62e0a8 : it.clue ? 0xf0b429 : 0xbfe4ff, zeroG ? 0.18 : 0.32, it.locked ? 0.25 : 0.6);
        s.position.copy(pt.pos);
        s.userData.base = s.material.opacity;
        markers.add(s);
      }
      return { id: it.id, at, radius: zeroG ? 1.15 : pt.who ? 1.9 : 1.7, label: it.label, enabled: !it.locked, ring: !zeroG, priority: it.exit ? -1 : it.clue && !it.used ? 1 : 0, onInteract: () => onInteract && onInteract(it) };
    });
    ctl.setInteractables(recs);
    if (ctl.refreshTarget) ctl.refreshTarget();
  }
  // Dialogue during exploring: the controller lets go, the cameras cut.
  function cinematic(on) {
    if (!ctl) return;
    cine = !!on;
    ctl.setEnabled(!on);
    if (ctl.setCameraActive) ctl.setCameraActive(!on);
    const you = actors.you;
    if (on && you) {
      you.base.copy(you.root.position);
      you.ry = you.root.rotation.y;
    }
    if (on) shotT = 0;
  }
  function endExplore() {
    if (!ctl) return;
    const you = actors.you;
    if (you) {
      you.base.copy(you.root.position);
      you.ry = you.root.rotation.y;
      you.astro.setMove(0);
    }
    try {
      ctl.dispose();
    } catch (e) {}
    ctl = null;
    exploring = false;
    cine = false;
    items = [];
    while (markers.children.length) markers.children.pop().material.dispose();
    // Back to cinematic framing, from about where the follow camera was.
    shot('wide');
  }

  // ---------- Per frame ----------
  const lookPoint = V();
  const poi = () => S.window().look;
  let t = 0;
  const offsets = { worried: [0.1, 0.04], angry: [-0.03, 0.08], scared: [-0.06, -0.06], sad: [0.22, 0.08], determined: [-0.06, 0.02] };
  const youPos = () => (actors.you ? actors.you.root.position : null);
  function act(dt) {
    const yp = youPos();
    ids.forEach((id) => {
      const a = actors[id];
      if (lookAway[id] > 0) lookAway[id] -= dt;
      const away = lookAway[id] > 0;
      const free = id === 'you' && exploring;
      // While exploring, people turn to look at you as you come close.
      let lookId = a.look;
      if (exploring && !cine && id !== 'you' && yp && a.root.position.distanceTo(yp) < 4.5) lookId = 'you';
      const target = away ? poi() : lookId && actors[lookId] && lookId !== id ? head(lookId, lookPoint) : null;
      if (a.kind === 'astro') {
        if (!free) {
          if (a.float && !reduced) {
            a.root.position.set(a.base.x + Math.sin(t * 0.37 + a.phase) * 0.03, a.base.y + Math.sin(t * 0.61 + a.phase) * 0.045, a.base.z + Math.cos(t * 0.29 + a.phase) * 0.03);
            a.root.rotation.z = Math.sin(t * 0.33 + a.phase) * 0.025;
          }
          if (target && !a.sit) {
            const want = Math.atan2(target.x - a.base.x, target.z - a.base.z);
            // Lined up for a scene: a small turn. Standing around a set: turn to face them.
            const lim = anchored ? want : a.ry + clamp(wrap(want - a.ry), -0.6, 0.6);
            a.root.rotation.y += wrap(lim - a.root.rotation.y) * Math.min(1, dt * 2.5);
          }
        } else if (cine && target) {
          // Turn to whoever you talk to, then the controller takes over again.
          const want = Math.atan2(target.x - a.root.position.x, target.z - a.root.position.z);
          a.root.rotation.y += wrap(want - a.root.rotation.y) * Math.min(1, dt * 4);
        }
        a.astro.lookAt(target ? target.clone() : free && !cine ? null : null);
        if (!free) a.astro.update(dt); // the controller updates 'you' itself
        const J = a.astro.joints;
        if (a.sit && S.cap && S.capPoses) S.capPoses.sitPose(a.astro, { relax: 0.3 });
        else if (a.float && zeroG && S.capPoses && !a.astro.action) S.capPoses.floatPose(a.astro, t + a.phase, { keepArms: a.talk > 0 });
        // Mood and talking on top of the pose the astronaut just set.
        const o = offsets[a.mood] || [0, 0];
        a.moodK.h = lerp(a.moodK.h || 0, o[0], Math.min(1, dt * 3));
        a.moodK.t = lerp(a.moodK.t || 0, o[1], Math.min(1, dt * 3));
        a.talkK = lerp(a.talkK || 0, a.talk, Math.min(1, dt * 5));
        if (!a.astro.action) {
          J.head.rotation.x += a.moodK.h;
          J.torso.rotation.x += a.moodK.t;
          if (a.talkK > 0.01 && !reduced) {
            const big = a.mood === 'angry' || a.mood === 'determined' ? 1.6 : a.mood === 'sad' ? 0.5 : 1;
            J.head.rotation.x += (Math.sin(t * 6.1) * 0.03 + Math.sin(t * 2.3) * 0.02) * a.talkK;
            J.head.rotation.z += Math.sin(t * 1.7) * 0.03 * a.talkK;
            J.shR.rotation.x += (-0.28 - Math.max(0, Math.sin(t * 2.4)) * 0.22 * big) * a.talkK;
            J.elR.rotation.x += (-0.7 - Math.sin(t * 3.1) * 0.15 * big) * a.talkK;
            if (big > 1) J.shL.rotation.x += (-0.15 - Math.max(0, Math.sin(t * 2.0 + 1)) * 0.2) * a.talkK;
          }
          if (a.mood === 'scared' && !reduced) J.torso.rotation.y += Math.sin(t * 9) * 0.006;
        }
      } else {
        a.p.faceTo = target ? { x: target.x, z: target.z } : { x: a.base.x + Math.sin(a.ry), z: a.base.z + Math.cos(a.ry) };
        a.lookTarget = target ? target.clone() : null;
      }
    });
    if (crew) {
      crew.update(dt, { cam: camera.position, player: null, t });
      // Head turns toward whoever they listen to (npc.js only knows the player).
      ids.forEach((id) => {
        const a = actors[id];
        if (a.kind !== 'staff') return;
        const target = a.lookTarget;
        let want = 0;
        if (target) want = clamp(wrap(Math.atan2(target.x - a.root.position.x, target.z - a.root.position.z) - a.root.rotation.y), -1.1, 1.1);
        a.yaw = lerp(a.yaw, want, Math.min(1, dt * 4));
        const H = a.p.P.head;
        H.rotation.y = a.yaw;
        const o = offsets[a.mood] || [0, 0];
        H.rotation.x += o[0] * 0.8;
      });
    }
    // Item motes breathe gently.
    markers.children.forEach((m, i) => {
      m.material.opacity = m.userData.base * (reduced ? 1 : 0.65 + 0.35 * Math.sin(t * 2.2 + i));
    });
  }

  function update(dt) {
    dt = Math.min(dt || 0, 0.1);
    t += dt;
    shotT += dt;
    if (S.update) S.update(dt, t);
    if (ctl) ctl.update(dt);
    act(dt);
    if (exploring && !cine) return; // the controller places the camera
    const fov = frame();
    // A slow push-in and a breath of handheld sway inside each shot.
    if (!reduced) {
      const k = Math.min(1, shotT / 9);
      const push = spec.type === 'wide' ? 0.05 : 0.035;
      camPos.lerp(camLook, push * k);
      camPos.x += Math.sin(t * 0.43) * 0.015;
      camPos.y += Math.sin(t * 0.61) * 0.012;
      if (shake > 0.001) {
        camPos.x += (Math.random() - 0.5) * shake * 0.12;
        camPos.y += (Math.random() - 0.5) * shake * 0.12;
        camLook.x += (Math.random() - 0.5) * shake * 0.05;
        shake *= Math.exp(-dt * 2.4);
      }
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  shot('wide');
  return {
    scene,
    camera,
    exposure: setName === 'pad' ? 1.05 : setName === 'space' ? 1.1 : 1,
    shadows: false,
    set: setName,
    get cast() {
      return ids.slice();
    },
    zeroG,
    anchors: S.anchors,
    actor: (id) => actors[id] || null,
    has: (id) => !!actors[id],
    head,
    get shotSpec() {
      return Object.assign({}, spec);
    },
    get exploring() {
      return exploring;
    },
    get controller() {
      return ctl;
    },
    onResize(w, h) {
      aspect = w / Math.max(1, h);
    },
    update,
    shot,
    autoShot,
    speak,
    quiet,
    mood: setMood,
    anim,
    beginExplore,
    setItems,
    cinematic,
    endExplore,
    // Screen position (0..1) of a world point, for labels.
    project(p) {
      const v = p.clone().project(camera);
      return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, visible: v.z < 1 };
    },
    alarm(on) {
      if (S.alarm) S.alarm(!!on);
    },
    shake(k = 1) {
      if (!reduced) shake = Math.max(shake, k);
    },
    power(k) {
      if (S.power) S.power(k);
    },
    frost(k) {
      if (S.frost) S.frost(k);
    },
    // Advance time (screenshots, tests).
    seek(seconds) {
      for (let s = 0; s < seconds; s += 1 / 30) update(1 / 30);
    },
    dispose() {
      disposed = true;
      endExplore();
      ids.forEach((id) => actors[id].kind === 'astro' && actors[id].astro.dispose());
      if (crew) crew.dispose();
      if (S.dispose) S.dispose();
    },
  };
}
