// The crewed ride: the player is one of four astronauts on an Artemis II–like
// flight. A clock (seconds of ride time) runs a list of shots; each shot uses
// one of four sets:
//   pad     metres, the launch tower, the crew access arm and the rocket
//   cabin   metres, the player's seat: panel, windows, a crewmate, the plush
//   space   kilometres, Orion at the origin, Earth, the Moon (real NASA maps)
//   ocean   metres, parachutes, splashdown, the recovery ship
// The cabin windows show the space set through a small render target.
// What happens comes from score.crew (decided at launch by SMD.ops.crewFlight);
// cues (captions, prompts, alarms, HUD values) go to the screen via onCue.
import { THREE, disposeTree, getRenderer, studioEnv } from './engine.js';
import { makePlanet, makeStars, makeSun, softDot, canvasTex } from './assets.js';
import { buildCraft, setDeploy } from './craft.js';
import { crewRocket, rocketPlume, setRocketPlume, ROCKET_LOOKS } from './films.js';
import { createAstronaut } from './astronaut.js';

const SMD = globalThis.SMD;
const tr = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : e);
const DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const at = (o, x, y, z) => {
  o.position.set(x, y, z);
  return o;
};
const reducedMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};

// Mission elapsed seconds for ride time T during the climb (liftoff at T_LIFT).
// Booster separation (128 s) arrives 8 s after liftoff, core stage cutoff
// (486 s) 12 s later: two speeds so the busy first minutes are readable.
const T_LIFT = 14;
const T_SEP = 22;
const T_MECO = 34;
function metAt(T) {
  if (T < T_LIFT) return T - T_LIFT;
  if (T < T_SEP) return ((T - T_LIFT) / (T_SEP - T_LIFT)) * 128;
  return 128 + ((T - T_SEP) / (T_MECO - T_SEP)) * (486 - 128);
}
const tAtMet = (met) => (met <= 128 ? T_LIFT + (met / 128) * (T_SEP - T_LIFT) : T_SEP + ((met - 128) / (486 - 128)) * (T_MECO - T_SEP));
// Rough SLS climb profile for the HUD: altitude (km), speed (km/h), g.
function climb(met) {
  const m = Math.max(0, met);
  const alt = m < 128 ? 0.5 * 0.0052 * m * m * (1 - m / 600) : 45 + (m - 128) * 0.37;
  const speed = m < 128 ? m * m * 0.27 + m * 4 : 4900 + ((m - 128) / 358) * (28000 - 4900) * (0.4 + 0.6 * ((m - 128) / 358));
  let g = 1.2 + m / 128 * 1.3;
  if (m > 55 && m < 85) g -= 0.35 * Math.sin(((m - 55) / 30) * Math.PI); // throttle down through max-Q
  if (m >= 128) g = 0.95 + ((m - 128) / 358) * 2.15; // the core stage alone, lighter every second
  if (m >= 486) g = 0;
  return { alt: Math.min(alt, 180), speed: Math.min(speed, 28200), g: Math.max(0, g) };
}

// ---------- Shared bits ----------
function skyDome(radius) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(0x1f5fa8) },
      uMid: { value: new THREE.Color(0x9cc8ee) },
      uBot: { value: new THREE.Color(0xc9d6dd) },
      uSun: { value: new THREE.Vector3(0.45, 0.5, -0.74).normalize() },
      uK: { value: 0 },
      uWarm: { value: 0 },
    },
    vertexShader: `varying vec3 vD;
      void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; uniform vec3 uSun; uniform float uK; uniform float uWarm;
      varying vec3 vD;
      void main() {
        vec3 d = normalize(vD);
        float h = d.y;
        vec3 c = h > 0.0 ? mix(uMid, uTop, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(uMid, uBot, clamp(-h * 5.0, 0.0, 1.0));
        c = mix(c, vec3(0.92, 0.6, 0.38), uWarm * (1.0 - clamp(abs(h) * 3.0, 0.0, 1.0)));
        c = mix(c, vec3(0.004, 0.007, 0.014), uK);
        float s = max(0.0, dot(d, normalize(uSun)));
        c += vec3(1.0, 0.93, 0.8) * pow(s, 400.0) * 3.0 + vec3(1.0, 0.85, 0.6) * pow(s, 9.0) * 0.22 * (1.0 - uK);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

// Billowing smoke and steam: sprites that grow and fade.
function smoke(max, color = 0xd8d4cc) {
  const g = new THREE.Group();
  const tex = softDot();
  const items = [];
  for (let i = 0; i < max; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false;
    g.add(s);
    items.push({ s, age: 99, life: 1, v: new THREE.Vector3(), size: 1 });
  }
  let next = 0;
  g.userData.emit = (pos, vel, size, life) => {
    const it = items[next];
    next = (next + 1) % max;
    it.s.position.copy(pos);
    it.v.copy(vel);
    it.size = size;
    it.life = life;
    it.age = 0;
    it.s.visible = true;
  };
  g.userData.update = (dt) => {
    items.forEach((it) => {
      if (it.age >= it.life) {
        it.s.visible = false;
        return;
      }
      it.age += dt;
      const k = it.age / it.life;
      it.s.position.addScaledVector(it.v, dt);
      it.v.multiplyScalar(1 - dt * 0.5);
      it.s.scale.setScalar(it.size * (0.4 + k * 1.8));
      it.s.material.opacity = 0.55 * Math.sin(Math.min(1, k * 1.4) * Math.PI) * (1 - k * 0.4);
    });
  };
  return g;
}

function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}

// A parachute canopy: a shallow dome with orange and white gores, and risers.
function parachute(radius, orange = true) {
  const g = new THREE.Group();
  const tex = canvasTex(256, 64, (c, w, h) => {
    for (let i = 0; i < 16; i++) {
      c.fillStyle = orange && i % 2 ? '#e8742c' : '#f2f2ee';
      c.fillRect((i / 16) * w, 0, w / 16 + 1, h);
    }
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.fillRect(0, h * 0.86, w, h * 0.14);
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 }));
  g.add(dome);
  const lines = [];
  const rim = radius * Math.sin(Math.PI * 0.42);
  const rimY = radius * Math.cos(Math.PI * 0.42);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    lines.push(new THREE.Vector3(Math.cos(a) * rim, rimY, Math.sin(a) * rim), new THREE.Vector3(0, -radius * 2.6, 0));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: 0x8a8f94, transparent: true, opacity: 0.7 })));
  g.userData.dome = dome;
  return g;
}

// ---------- The ride ----------
// opts: { project, crew (score.crew), design, appearance, agencyName, onCue(cue) }
export function createRide(opts) {
  const { project, crew, onCue } = opts;
  const design = opts.design || project.design;
  const reduced = reducedMotion();
  const R = getRenderer();
  const sets = [];
  const cues = [];
  const shots = [];
  let T = 0;
  let rate = 1;
  let fired = 0;
  let ended = false;
  let disposed = false;
  let cur = null;
  let aspect = 16 / 9;
  const outcome = crew.outcome;
  const lostAscent = outcome === 'lost' && crew.lostAt === 'ascent';
  const lostEntry = outcome === 'lost' && crew.lostAt === 'entry';
  const cue = (t, type, data) => cues.push({ t, type, ...data });
  const shot = (t0, t1, set, fn) => shots.push({ t0, t1, set, update: fn });
  let endAt = 90;
  let targetWorld = () => new THREE.Vector3();
  const fovFor = (f) => (aspect < 1 ? Math.min(100, f * (1 + (1 - aspect) * 0.9)) : f);
  const state = { shake: 0, g: 1, met: -10, abortAt: null, abortBy: null, phase: 'walk', dv: 0, plasma: 0, white: 0, black: 0, cover: 1, float: 0 };

  // ================= Pad set (metres) =================
  function padSet() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 60000);
    const sky = skyDome(30000);
    scene.add(sky);
    const sunDir = new THREE.Vector3(0.45, 0.5, -0.74).normalize();
    const sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
    sun.position.copy(sunDir).multiplyScalar(500);
    scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight(0xbcd6ef, 0x5d5a4c, 1.1));
    // Ground: scrub, the concrete pad and the flame trench; the sea beyond.
    const ground = new THREE.Mesh(new THREE.CircleGeometry(9000, 64), new THREE.MeshStandardMaterial({ color: 0x6f7a55, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(40000, 60000), new THREE.MeshStandardMaterial({ color: 0x2c5f7c, roughness: 0.35, metalness: 0.1 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(21200, 0.05, 0); // the coast runs 1.2 km east of the pad
    scene.add(sea);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(140, 150, 2, 48), new THREE.MeshStandardMaterial({ color: 0xa9a59c, roughness: 0.95 }));
    pad.position.y = 1;
    scene.add(pad);
    // Mobile launcher: a deck under the rocket and a 110 m truss tower beside it.
    const steel = new THREE.MeshStandardMaterial({ color: 0x8b9196, metalness: 0.4, roughness: 0.6 });
    const deckH = 8;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(48, deckH, 42), steel);
    deck.position.set(-8, 2 + deckH / 2, 0);
    scene.add(deck);
    const tower = new THREE.Group();
    const tw = 12;
    const th = 120;
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.9, th, 0.9), steel), (sx * tw) / 2, th / 2, (sz * tw) / 2))));
    for (let y = 6; y < th; y += 6) {
      [-1, 1].forEach((s) => {
        tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(tw, 0.45, 0.45), steel), 0, y, (s * tw) / 2));
        tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, tw), steel), (s * tw) / 2, y, 0));
      });
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8.4, 0.3), steel);
      brace.position.set(0, y - 3, tw / 2);
      brace.rotation.z = 0.78 * (y % 12 ? 1 : -1);
      tower.add(brace);
      const b2 = brace.clone();
      b2.position.z = -tw / 2;
      tower.add(b2);
    }
    tower.position.set(-24, 2 + deckH, 0);
    scene.add(tower);
    // The rocket, its capsule hatch turned toward the tower.
    const rocket = crewRocket(design, opts.agencyName || '');
    rocket.position.y = 2 + deckH;
    const craft = rocket.userData.craft;
    craft.rotation.y = -Math.PI / 2;
    scene.add(rocket);
    rocket.updateMatrixWorld(true);
    // Hatch height: the capsule's base plus about 1.2 m.
    const capBase = new THREE.Vector3();
    craft.getWorldPosition(capBase);
    const hatchY = capBase.y + 0.45 + 1.15;
    // Crew access arm and the white room at its end.
    const armMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.7 });
    const arm = new THREE.Group();
    const armLen = 24 - 2.6 - 6;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.3, 2.2), steel);
    floor.position.set(armLen / 2, -0.15, 0);
    arm.add(floor);
    [-1, 1].forEach((s) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.5 }));
      rail.position.set(armLen / 2, 1.05, s * 1.05);
      arm.add(rail);
      for (let x = 0; x <= armLen; x += 1.6) arm.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), steel), x, 0.52, s * 1.05));
      // Truss under the walkway.
      const tr2 = new THREE.Mesh(new THREE.BoxGeometry(armLen, 1.2, 0.12), steel);
      tr2.position.set(armLen / 2, -0.9, s * 1.0);
      arm.add(tr2);
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.08, 2.4), new THREE.MeshStandardMaterial({ color: 0xe8e8e4, emissive: 0x6a6c70, roughness: 0.8 }));
    roof.position.set(armLen / 2, 2.5, 0);
    arm.add(roof);
    const white = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.0, 3.6), armMat);
    white.position.set(armLen + 1.4, 1.3, 0);
    white.material = armMat.clone();
    white.material.transparent = true;
    white.material.opacity = 0.35;
    arm.add(white);
    // Lights along the walkway.
    for (let x = 1; x < armLen; x += 3) arm.add(at(glowSprite(0xfff3d6, 0.22, 0.7), x, 2.35, 0));
    arm.position.set(-24 + 6, hatchY, 0);
    scene.add(arm);
    // The player, suited up, helmet on.
    const astro = createAstronaut(opts.appearance || (SMD.avatar ? SMD.avatar.get() : null), { helmet: true, blob: false });
    astro.group.position.set(-24 + 6 + 1, hatchY, 0);
    astro.group.rotation.y = Math.PI / 2; // walking toward +X, the capsule
    scene.add(astro.group);
    // Exhaust: core plume and two booster plumes, plus smoke.
    const look = ROCKET_LOOKS.superheavy;
    const corePlume = rocketPlume(look, true);
    rocket.userData.s1.add(corePlume);
    const rb = look.r * look.solidR;
    const sidePlumes = [-1, 1].map((sd) => {
      const p = rocketPlume(ROCKET_LOOKS.light, true);
      p.position.set(0, -0.5, sd * (look.r + rb * 0.95));
      rocket.userData.s1.add(p);
      return p;
    });
    const fx = smoke(220);
    scene.add(fx);
    const fireball = glowSprite(0xffa040, 1, 0);
    scene.add(fireball);
    const lasPlumes = [];
    studioEnv().then((env) => env && !disposed && (scene.environment = env));
    const set = {
      scene,
      camera,
      sky,
      rocket,
      astro,
      hatchY,
      armX0: -24 + 6,
      update() {},
      lasPlumes,
      corePlume,
      sidePlumes,
      fx,
      fireball,
      dispose() {
        astro.dispose();
      },
    };
    sets.push(set);
    return set;
  }

  // ================= Space set (kilometres, Orion at the origin) =================
  function spaceSet() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.002, 4e6);
    const sky = skyDome(3e6);
    sky.material.uniforms.uK.value = 1;
    scene.add(sky);
    const sunDir = new THREE.Vector3(0.8, 0.25, 0.55).normalize();
    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.position.copy(sunDir).multiplyScalar(1e5);
    scene.add(sun, sun.target);
    scene.add(new THREE.AmbientLight(0x8090a0, 0.12));
    const sunSprite = makeSun(9e4);
    sunSprite.position.copy(sunDir).multiplyScalar(2.5e6);
    scene.add(sunSprite);
    const stars = makeStars(3200, 3.5e6, 11);
    scene.add(stars);
    const earth = makePlanet('earth', 6371, { segments: 128, res: 2048 });
    scene.add(earth);
    const moon = makePlanet('moon', 1737.4, { segments: 128, res: 2048, bumpScale: 2.6 });
    scene.add(moon);
    // Orion, metres scaled to kilometres.
    const orion = buildCraft(design, { showShield: true });
    orion.scale.setScalar(0.001);
    scene.add(orion);
    const parts = orion.userData.parts;
    if (parts.las) parts.las.visible = false;
    if (parts.heatshield) parts.heatshield.visible = false;
    studioEnv().then((env) => {
      if (!env || disposed) return;
      orion.traverse((o) => o.isMesh && o.material && 'envMapIntensity' in o.material && !o.material.envMap && (o.material = Object.assign(o.material.clone(), { envMap: env, envMapIntensity: 0.35 })));
    });
    // Service-module engine plume (vacuum flame).
    const plume = rocketPlume(ROCKET_LOOKS.light, false);
    orion.add(plume);
    plume.position.set(0, orion.userData.nozzleY, 0);
    plume.scale.setScalar(1);
    // Entry plasma: a glowing shell around the heat shield.
    const plasmaMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const plasma = new THREE.Mesh(new THREE.ConeGeometry(4.2, 9, 32, 1, true), plasmaMat);
    plasma.rotation.x = Math.PI;
    plasma.position.y = 4.4;
    orion.add(plasma);
    const plasmaGlow = glowSprite(0xffa060, 14, 0);
    plasmaGlow.position.y = -1;
    orion.add(plasmaGlow);
    // Char and sparks streaming off during entry.
    const sparks = smoke(60, 0xffb070);
    sparks.scale.setScalar(1);
    orion.add(sparks);
    // The service module after separation (drifts away).
    const view = new THREE.PerspectiveCamera(62, 1.6, 0.002, 4e6);
    scene.add(view);
    const set = { scene, camera, sky, earth, moon, orion, plume, plasma, plasmaGlow, sparks, view, sunDir };
    sets.push(set);
    return set;
  }

  // ================= Cabin set (metres) =================
  function cabinSet(space) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, aspect, 0.02, 50);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0.12, -1);
    scene.add(camera);
    const rt = new THREE.WebGLRenderTarget(640, 400, { colorSpace: THREE.SRGBColorSpace });
    // Walls: a dim, padded cone around the seat.
    const wallTex = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#3a4048';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        c.fillStyle = `rgba(${200 + (i % 3) * 10},${195 + (i % 4) * 8},${180},0.9)`;
        const x = (i * 53) % w;
        const y = (i * 97) % h;
        c.fillRect(x, y, 28 + (i % 3) * 10, 18 + (i % 2) * 10);
        c.strokeStyle = 'rgba(0,0,0,0.3)';
        c.strokeRect(x, y, 28 + (i % 3) * 10, 18 + (i % 2) * 10);
      }
    });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(4, 2);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 2.1, 3.2, 40, 1, true), new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 0.9 }));
    wall.rotation.x = Math.PI / 2;
    wall.position.z = -0.4;
    scene.add(wall);
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.9 }));
    ceil.position.z = -2.0;
    scene.add(ceil);
    // Instrument panel: three big displays in a dark frame, switch rows below.
    const panel = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 0.06), new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.6, metalness: 0.3 }));
    panel.add(board);
    const screens = [-0.64, 0, 0.64].map((x) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 340;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.385), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      m.position.set(x, 0.04, 0.035);
      panel.add(m);
      return { canvas, tex, ctx: canvas.getContext('2d') };
    });
    for (let i = 0; i < 18; i++) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.03), new THREE.MeshStandardMaterial({ color: i % 5 === 0 ? 0xd9a21b : 0x9aa1a8, metalness: 0.6, roughness: 0.4 }));
      sw.position.set(-0.85 + i * 0.1, -0.24, 0.045);
      panel.add(sw);
    }
    panel.position.set(0, -0.3, -0.95);
    panel.rotation.x = -0.32;
    scene.add(panel);
    // Two windows above the panel, showing the space set.
    const winMat = new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false });
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.8 });
    const windows = [-0.52, 0.52].map((x, i) => {
      const g = new THREE.Group();
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), winMat);
      // Each window sees half of the render target.
      const uv = w.geometry.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, i * 0.5 + uv.getX(k) * 0.5);
      g.add(w);
      const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.47, 0.35), coverMat);
      cover.position.z = 0.002;
      g.add(cover);
      g.userData.cover = cover;
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 8, 4), new THREE.MeshStandardMaterial({ color: 0x5b636c, metalness: 0.7, roughness: 0.4 }));
      frame.rotation.z = Math.PI / 4;
      frame.scale.set(1.12, 0.84, 1);
      g.add(frame);
      g.position.set(x, 0.42, -1.05);
      g.rotation.x = 0.25;
      g.rotation.y = -x * 0.35;
      scene.add(g);
      return g;
    });
    // Plasma glow over the windows during entry.
    const plasmaMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    windows.forEach((g) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), plasmaMat);
      p.position.z = 0.004;
      g.add(p);
    });
    // Lights: cabin LEDs, panel glow, and light through the windows.
    const cabinLight = new THREE.PointLight(0xdfe8ff, 2.2, 6, 1.5);
    cabinLight.position.set(0, 0.8, 0.2);
    scene.add(cabinLight);
    scene.add(new THREE.AmbientLight(0x6a7480, 0.55));
    const winLight = new THREE.DirectionalLight(0xffffff, 0);
    winLight.position.set(0, 1.5, -1);
    scene.add(winLight, winLight.target);
    const alarmLight = new THREE.PointLight(0xff2a1a, 0, 4, 1.5);
    alarmLight.position.set(0, 0.2, -0.6);
    scene.add(alarmLight);
    // A crewmate in the next seat, and the plush zero-g indicator on its tether.
    let mate = null;
    try {
      const look = SMD.avatar && SMD.avatar.random ? SMD.avatar.random() : null;
      if (look) look.name = tr('ride.mate', 'Commander');
      mate = createAstronaut(look, { helmet: true, blob: false });
      mate.group.position.set(-0.95, -1.45, -0.25);
      mate.group.rotation.set(-1.15, 0.35, 0);
      scene.add(mate.group);
    } catch (e) {
      mate = null;
    }
    const plush = new THREE.Group();
    const plushBall = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 14), new THREE.MeshStandardMaterial({ color: 0xc9c6bd, roughness: 1 }));
    plush.add(plushBall);
    [[-0.03, 0.02], [0.03, 0.02]].forEach(([x, y]) => plush.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1b1e22 })), x, y, 0.06)));
    const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.4, 4), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    tether.position.y = 0.2;
    plush.add(tether);
    plush.position.set(0.25, 0.55, -0.7);
    scene.add(plush);
    const set = { scene, camera, rt, screens, windows, plasmaMat, cabinLight, winLight, alarmLight, mate, plush, space, panel };
    sets.push(set);
    return set;
  }

  // ================= Ocean set (metres) =================
  function oceanSet() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.2, 40000);
    const sky = skyDome(30000);
    sky.material.uniforms.uTop.value.set(0x3f7cc0);
    scene.add(sky);
    const sun = new THREE.DirectionalLight(0xfff4e2, 3.0);
    sun.position.set(300, 400, -500);
    scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight(0xc4dcf2, 0x1d4058, 1.2));
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 120, 120), new THREE.MeshStandardMaterial({ color: 0x1f5878, roughness: 0.28, metalness: 0.15 }));
    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    const far = new THREE.Mesh(new THREE.CircleGeometry(30000, 48), new THREE.MeshStandardMaterial({ color: 0x245e80, roughness: 0.35 }));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -2.5;
    scene.add(far);
    // The capsule alone: service module and abort tower are long gone.
    const cap = buildCraft(design, { showShield: true });
    const p = cap.userData.parts;
    ['sm', 'las', 'wing0', 'wing1', 'wing2', 'wing3'].forEach((k) => p[k] && (p[k].visible = false));
    const capG = new THREE.Group();
    cap.position.y = 0.45;
    capG.add(cap);
    scene.add(capG);
    const chutes = [0, 1, 2].map((i) => {
      const c = parachute(17, true);
      const a = (i / 3) * Math.PI * 2;
      c.position.set(Math.cos(a) * 13, 52, Math.sin(a) * 13);
      c.rotation.z = Math.cos(a) * 0.22;
      c.rotation.x = -Math.sin(a) * 0.22;
      capG.add(c);
      return c;
    });
    const drogues = [-1, 1].map((s) => {
      const c = parachute(3.2, false);
      c.position.set(s * 2.5, 22, 0);
      capG.add(c);
      return c;
    });
    const spray = smoke(60, 0xffffff);
    scene.add(spray);
    // The recovery ship on the horizon and a helicopter.
    const ship = new THREE.Group();
    const grey = new THREE.MeshStandardMaterial({ color: 0x7b858d, roughness: 0.7 });
    ship.add(at(new THREE.Mesh(new THREE.BoxGeometry(200, 14, 30), grey), 0, 7, 0));
    ship.add(at(new THREE.Mesh(new THREE.BoxGeometry(60, 26, 22), grey), -30, 24, 0));
    ship.position.set(-900, 0, -2400);
    ship.rotation.y = 0.3;
    scene.add(ship);
    studioEnv().then((env) => env && !disposed && (scene.environment = env));
    const set = { scene, camera, water, capG, chutes, drogues, spray, sky };
    sets.push(set);
    return set;
  }

  const pad = padSet();
  const space = spaceSet();
  const cabin = cabinSet(space);
  const ocean = oceanSet();

  // ---------- Cabin displays ----------
  let screenClock = 0;
  const C = SMD.data && SMD.data.CREW;
  function drawScreens() {
    const [a, b, c] = cabin.screens;
    const ink = '#d9e4ee';
    const dim = '#7d8b98';
    const green = '#3fc1b4';
    const amber = '#f0b429';
    const red = '#ff5a4f';
    const head = (ctx, title) => {
      ctx.fillStyle = '#081018';
      ctx.fillRect(0, 0, 512, 340);
      ctx.fillStyle = '#132230';
      ctx.fillRect(0, 0, 512, 44);
      ctx.fillStyle = ink;
      ctx.font = "700 26px Archivo, 'Noto Kufi Arabic', sans-serif";
      ctx.textBaseline = 'middle';
      ctx.fillText(title, 16, 23);
    };
    const met = state.met;
    // Left: flight data.
    head(a.ctx, tr('ride.scr.flight', 'Flight'));
    a.ctx.font = "600 22px Archivo, sans-serif";
    const rows = [
      [tr('ride.scr.met', 'Mission time'), fmtMet(met)],
      [tr('ride.scr.g', 'Load'), `${state.g.toFixed(1)} g`],
      [tr('ride.scr.alt', 'Altitude'), state.alt !== undefined ? `${SMD.ui ? SMD.ui.fmt(state.alt) : Math.round(state.alt)} km` : '—'],
      [tr('ride.scr.speed', 'Speed'), state.speed !== undefined ? `${SMD.ui ? SMD.ui.fmt(state.speed) : Math.round(state.speed)} km/h` : '—'],
    ];
    rows.forEach(([k, v], i) => {
      a.ctx.fillStyle = dim;
      a.ctx.fillText(k, 16, 80 + i * 62);
      a.ctx.fillStyle = ink;
      a.ctx.font = "700 30px Archivo, sans-serif";
      a.ctx.fillText(v, 16, 108 + i * 62);
      a.ctx.font = "600 22px Archivo, sans-serif";
    });
    // Middle: where we are on the loop around the Moon.
    head(b.ctx, tr('ride.scr.path', 'Path'));
    const x = b.ctx;
    x.strokeStyle = '#2b4a63';
    x.lineWidth = 3;
    x.beginPath();
    x.ellipse(256, 190, 200, 70, 0, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = '#2f6fb0';
    x.beginPath();
    x.arc(76, 190, 26, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#9aa1a8';
    x.beginPath();
    x.arc(436, 190, 12, 0, Math.PI * 2);
    x.fill();
    const k = clamp(state.loop || 0);
    const ang = Math.PI - k * Math.PI * 2;
    x.fillStyle = amber;
    x.beginPath();
    x.arc(256 + Math.cos(ang) * 200, 190 - Math.sin(ang) * 70, 8, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = dim;
    x.font = "600 20px Archivo, sans-serif";
    x.fillText(tr('ride.scr.earth', 'Earth'), 40, 250);
    x.fillText(tr('ride.scr.moon', 'Moon'), 410, 250);
    // Right: systems.
    head(c.ctx, tr('ride.scr.sys', 'Systems'));
    const sys = [
      [tr('ride.scr.air', 'Air (CO₂)'), state.co2 ? red : green, state.co2 ? tr('ride.scr.high', 'High') : tr('ride.scr.ok', 'OK')],
      [tr('ride.scr.rad', 'Radiation'), state.rad ? amber : green, state.rad ? tr('ride.scr.storm', 'Storm') : tr('ride.scr.ok', 'OK')],
      [tr('ride.scr.prop', 'Propellant'), state.leak ? amber : green, state.leak ? tr('ride.scr.leak', 'Leak') : tr('ride.scr.ok', 'OK')],
      [tr('ride.scr.abort', 'Abort system'), crew.las ? (state.cover ? green : dim) : red, crew.las ? (state.cover ? tr('ride.scr.armed', 'Armed') : tr('ride.scr.gone', 'Jettisoned')) : tr('ride.scr.none', 'None')],
    ];
    sys.forEach(([kk, col, v], i) => {
      c.ctx.fillStyle = dim;
      c.ctx.font = "600 22px Archivo, sans-serif";
      c.ctx.fillText(kk, 16, 84 + i * 64);
      c.ctx.fillStyle = col;
      c.ctx.font = "800 26px Archivo, sans-serif";
      c.ctx.fillText(v, 300, 84 + i * 64);
    });
    cabin.screens.forEach((s) => (s.tex.needsUpdate = true));
  }
  function fmtMet(met) {
    if (met < 0) return `T−${Math.ceil(-met)}`;
    if (met < 86400) {
      const h = Math.floor(met / 3600);
      const m = Math.floor((met % 3600) / 60);
      const s = Math.floor(met % 60);
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const d = Math.floor(met / 86400);
    const h = Math.floor((met % 86400) / 3600);
    return tr('ride.scr.day', 'Day {d} {h} h', { d: d + 1, h });
  }

  // ---------- Window view (space set seen from the seat) ----------
  // dir: where the window camera looks (space-set frame); render each frame
  // while the cabin is on screen.
  const viewDir = new THREE.Vector3(0, 1, 0);
  const viewUp = new THREE.Vector3(0, 0, -1);
  function renderWindow() {
    if (R.isNullRenderer) return;
    const v = space.view;
    v.position.set(0, 0, 0);
    v.up.copy(viewUp);
    v.lookAt(viewDir);
    v.aspect = 640 / 400;
    v.updateProjectionMatrix();
    const vis = space.orion.visible;
    space.orion.visible = false;
    const prev = R.getRenderTarget();
    R.setRenderTarget(cabin.rt);
    R.render(space.scene, v);
    R.setRenderTarget(prev);
    space.orion.visible = vis;
  }

  // ---------- Placing Earth and the Moon (space set) ----------
  // Orion is always at the origin; the bodies move around it.
  function placeEarthBelow(altKm, tilt = 0) {
    space.earth.position.set(0, -(6371 + altKm), 0);
    space.earth.rotation.set(tilt, 1.2, 0);
    space.earth.visible = true;
  }
  function placeMoon(distKm, dir) {
    space.moon.position.copy(dir).normalize().multiplyScalar(distKm);
    space.moon.visible = true;
  }

  // ================= Script =================
  const DAY = 86400;
  const totalLength = () => shots[shots.length - 1].t1;
  const caption = (t, kicker, title, text, tone = 'info', sound) => cue(t, 'caption', { kicker, title, text, tone, sound });
  const prompt = (t, id, label, win, key = 'Space', extra) => cue(t, 'prompt', { id, label, window: win, key, ...extra });

  // --- Walk to the capsule (third person) ---
  const dateStr = SMD.ui && SMD.ui.date ? SMD.ui.date(project.launchMs || Date.now()) : '';
  cue(0, 'phase', { id: 'walk', label: tr('ride.ph.walk', 'Walk out') });
  caption(0.3, tr('ride.k.launchday', 'Launch day · {date}', { date: dateStr }), tr('ride.walk.title', 'Walk the crew access arm'), tr('ride.walk.text', '83 metres above the pad. You and three crewmates are strapping into {name}.', { name: design.name }));
  shot(0, 6.6, pad, (t, dt) => {
    const k = clamp(t / 6.2);
    const x0 = pad.armX0 + 1;
    const x1 = pad.armX0 + 15.2;
    const ax = lerp(x0, x1, k);
    pad.astro.group.position.x = ax;
    pad.astro.setMove(k < 1 ? 0.75 : 0);
    pad.astro.update(dt);
    const cam = pad.camera;
    // Over the shoulder, a little above, the capsule ahead; a slow swing.
    const sw = Math.sin(t * 0.35) * 0.6;
    cam.position.set(ax - 4.6, pad.hatchY + 2.0, 1.6 + sw);
    cam.lookAt(ax + 6, pad.hatchY + 0.8, 0);
    cam.fov = fovFor(58);
    cam.updateProjectionMatrix();
    state.met = -600 + t * 10;
  });
  cue(6.1, 'fade', { dur: 0.9 });

  // --- In the seat: countdown ---
  cue(6.6, 'phase', { id: 'countdown', label: tr('ride.ph.count', 'Countdown') });
  caption(6.8, tr('ride.k.seat', 'Seat 2 · Pilot'), tr('ride.seat.title', 'Strapped in'), tr('ride.seat.text', 'The windows are covered by the abort tower’s shroud until it falls away in the climb.'));
  prompt(7.6, 'visor', tr('ride.p.visor', 'Close your visor'), 2.6);
  for (let i = 10; i >= 1; i--) cue(T_LIFT - i * 0.5, 'count', { value: i });
  cue(T_LIFT, 'big', { text: tr('ride.liftoff', 'Liftoff') });
  cue(T_LIFT, 'sound', { name: 'liftoff' });
  cue(T_LIFT - 0.3, 'engine', { level: 0.9, bright: 0.8 });
  shot(6.6, T_LIFT, cabin, (t) => {
    state.met = metAt(t);
    state.g = 1;
    state.shake = t > T_LIFT - 0.6 ? 0.3 : 0.02;
    state.cover = 1;
  });

  // --- Liftoff seen from the ground ---
  shot(T_LIFT, T_LIFT + 3.4, pad, (t, dt) => {
    const k = t - T_LIFT;
    const met = metAt(t);
    const y0 = 2 + 8;
    const climbM = 0.5 * 6 * k * k * 1.6; // slow motion: clearing the tower
    pad.rocket.position.y = y0 + climbM;
    const thrust = smooth(0, 0.4, k);
    setRocketPlume(pad.corePlume, 26 + climbM * 0.2, 4.5, thrust, 0, t);
    pad.sidePlumes.forEach((p) => setRocketPlume(p, 34, 4.2, thrust, 0, t));
    for (let i = 0; i < 4; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      pad.fx.userData.emit(new THREE.Vector3(-8 + (Math.random() - 0.5) * 20, 6 + Math.random() * 4, side * (20 + Math.random() * 20)), new THREE.Vector3((Math.random() - 0.5) * 30, 6 + Math.random() * 8, side * (30 + Math.random() * 40)), 22 + Math.random() * 18, 5 + Math.random() * 3);
    }
    pad.fx.userData.update(dt);
    const cam = pad.camera;
    cam.position.set(-170, 8, 230);
    cam.lookAt(0, 45 + climbM * 0.85, 0);
    cam.fov = fovFor(38);
    cam.updateProjectionMatrix();
    state.met = met;
    state.shake = 0.35;
  });
  caption(T_LIFT + 0.4, tr('ride.k.t0', 'T+0'), tr('ride.lift.title', 'Liftoff'), tr('ride.lift.text', 'Two boosters and four main engines: about 39 meganewtons of thrust. You are pushed into your seat.'));

  // --- The climb, from the seat ---
  const ascentEnd = crew.ascent.fails ? T_SEP + 0.48 : T_MECO + 1.5;
  shot(T_LIFT + 3.4, ascentEnd, cabin, (t) => {
    const met = metAt(Math.min(t, T_MECO));
    const c = climb(met);
    state.met = met;
    state.g = c.g;
    state.alt = c.alt;
    state.speed = c.speed;
    state.cover = met < 198 && crew.las ? 1 : 0;
    state.shake = met < 128 ? 0.55 - met / 400 : met < 486 ? 0.12 : 0;
    if (met > 55 && met < 85) state.shake += 0.25;
    // Window: sky darkens with height; the rocket pitches over until the horizon shows.
    const alt = c.alt;
    space.sky.material.uniforms.uK.value = smooth(15, 80, alt);
    space.sky.material.uniforms.uWarm.value = 0;
    placeEarthBelow(Math.max(0.5, alt));
    space.moon.visible = false;
    const pitch = lerp(85, 12, smooth(20, 486, met)) * DEG;
    viewDir.set(0, Math.sin(pitch), -Math.cos(pitch));
    viewUp.set(0, Math.cos(pitch), Math.sin(pitch));
    if (met >= 486) state.float = Math.min(1, state.float + 0.02);
  });
  cue(tAtMet(70), 'caption', { kicker: tr('ride.k.maxq', 'T+1:10'), title: tr('ride.maxq.title', 'Max-Q'), text: tr('ride.maxq.text', 'The air pushes hardest on the rocket now. The engines throttle down to ease the load.'), tone: 'info' });
  cue(T_LIFT + 3.4, 'phase', { id: 'ascent', label: tr('ride.ph.ascent', 'Climb') });

  if (crew.ascent.fails) {
    // ---------- Abort branch ----------
    cue(T_SEP, 'alarm', { on: true });
    cue(T_SEP, 'abortWindow', { las: !!crew.las, auto: 2.4 });
    cue(T_SEP, 'caption', { kicker: tr('ride.k.sep', 'T+2:08'), title: tr('ride.ab.title', 'Booster separation failure'), text: tr('ride.ab.text', 'One booster swings into the core stage. Master alarm. Abort now!'), tone: 'bad', sound: 'bad' });
    // The decision holds the clock (slow motion) until the player acts or the
    // flight computer acts for them; then the branch continues from T_SEP + 0.4.
    const tA = T_SEP + 0.5;
    if (crew.las) {
      shot(T_SEP + 0.48, tA + 5, pad, (t, dt) => abortShot(t - tA, dt, true));
      cue(tA, 'sound', { name: 'stage' });
      cue(tA, 'engine', { level: 1, bright: 1 });
      cue(tA + 0.2, 'caption', { kicker: tr('ride.k.abort', 'Launch abort'), title: tr('ride.ab.las.title', 'The abort motor fires'), text: tr('ride.ab.las.text', 'Nearly 400,000 pounds of thrust pull the capsule away from the failing rocket in a split second.'), tone: 'warn' });
      cue(tA + 4.5, 'engine', { level: 0, bright: 0 });
      cue(tA + 4.6, 'fade', { dur: 0.7 });
      chutesAndSplash(tA + 5, true);
    } else {
      shot(T_SEP + 0.48, tA + 4.5, pad, (t, dt) => abortShot(t - tA, dt, false));
      cue(tA + 0.1, 'caption', { kicker: tr('ride.k.noabort', 'No abort system'), title: tr('ride.ab.none.title', 'There is no way out'), text: tr('ride.ab.none.text', 'The design has no abort tower. The rocket breaks up.'), tone: 'bad' });
      cue(tA + 0.3, 'sound', { name: 'stage' });
      cue(tA + 0.5, 'engine', { level: 0, bright: 0 });
      cue(tA + 3.2, 'fade', { dur: 1.2, black: true });
      cue(tA + 4.5, 'card', { result: 'lost' });
      finishAt(tA + 4.6);
    }
  } else {
    // ---------- Nominal climb ----------
    cue(T_SEP, 'sound', { name: 'stage' });
    cue(T_SEP, 'caption', { kicker: tr('ride.k.sep', 'T+2:08'), title: tr('ride.sep.title', 'Booster separation'), text: tr('ride.sep.text', 'The two solid boosters burn out and fall away. Smoother now: just the four main engines.'), tone: 'ok' });
    prompt(T_SEP + 0.2, 'sep', tr('ride.p.sep', 'Call it: “Boosters away”'), 2.2);
    const tLas = tAtMet(198);
    if (crew.las) {
      cue(tLas, 'sound', { name: 'fairing' });
      cue(tLas, 'caption', { kicker: tr('ride.k.las', 'T+3:18'), title: tr('ride.las.title', 'Abort tower jettisoned'), text: tr('ride.las.text', 'The shroud goes with it. For the first time, daylight floods through the windows.'), tone: 'ok' });
    }
    cue(T_MECO, 'engine', { level: 0, bright: 0 });
    cue(T_MECO, 'big', { text: tr('ride.meco', 'Main engine cutoff') });
    cue(T_MECO + 0.2, 'caption', { kicker: tr('ride.k.meco', 'T+8:06'), title: tr('ride.meco.title', 'Weightless'), text: tr('ride.meco.text', 'The engines stop and the push is gone. The little plush toy on its tether floats up: zero g.'), tone: 'ok', sound: 'good' });
    prompt(T_MECO + 0.3, 'meco', tr('ride.p.meco', 'Report: “Main engine cutoff”'), 2.2);
    flightToMoon(T_MECO + 1.5);
  }

  function abortShot(k, dt, las) {
    // Seen from a chase plane: the stack high over the sea, a booster swinging in.
    const cam = pad.camera;
    const met = 128;
    const alt = 3200; // compressed for the shot
    const r = pad.rocket;
    r.position.set(0, alt, 0);
    // After the hit the stack starts to break up and tumble.
    r.rotation.z = -Math.min(0.6, Math.max(0, k - 0.2) * 0.14);
    r.userData.s1.children.forEach((c, i) => c.isGroup && c.children.length === 3 && (c.rotation.x = Math.min(0.5, Math.max(0, k) * 0.2) * (i % 2 ? 1 : -1)));
    pad.sky.material.uniforms.uK.value = 0.25;
    const look = ROCKET_LOOKS.superheavy;
    setRocketPlume(pad.corePlume, 40, 5, k < 0.2 ? 1 : clamp(1 - (k - 0.2) * 2), 0.4, k);
    pad.sidePlumes.forEach((p) => setRocketPlume(p, 30, 4, 0, 0.3, k));
    // The fireball where the booster hits the core.
    const fb = pad.fireball;
    fb.position.set(0, alt + 40, 6);
    fb.material.color.setHex(0xff7a24);
    fb.material.opacity = k > 0 ? 0.85 * clamp(1 - (k - 0.4) * 0.35) : 0;
    fb.scale.setScalar(k > 0 ? 10 + Math.min(k, 2.5) * 22 : 1);
    if (las && k > 0) {
      // Capsule and tower leave upward and sideways.
      const craft = r.userData.craft;
      const up = 0.5 * 70 * Math.pow(Math.max(0, k), 2) + 30 * k;
      craft.position.y = r.userData.payloadY + 4.4 - r.userData.s2.position.y + up;
      craft.position.x = -up * 0.25;
      if (!pad.lasPlumes.length) {
        for (let i = 0; i < 4; i++) {
          const p = rocketPlume(ROCKET_LOOKS.light, true);
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          p.position.set(Math.cos(a) * 0.7, 3.3 + 2.0 + 0.45, Math.sin(a) * 0.7);
          p.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
          craft.add(p);
          pad.lasPlumes.push(p);
        }
      }
      pad.lasPlumes.forEach((p) => setRocketPlume(p, 9, 1.4, k < 3 ? 1 : 0, 0.3, k));
      cam.position.set(-420, alt + 70 + up * 0.45, 540);
      cam.lookAt(craft.position.x * 0.4, alt + 55 + up * 0.5, 0);
    } else {
      cam.position.set(-300, alt + 60, 400);
      cam.lookAt(0, alt + 45, 0);
    }
    cam.fov = fovFor(40);
    cam.updateProjectionMatrix();
    for (let i = 0; i < 3 && k > 0 && k < 3; i++) pad.fx.userData.emit(new THREE.Vector3((Math.random() - 0.5) * 20, alt + 20 + Math.random() * 40, (Math.random() - 0.5) * 20), new THREE.Vector3((Math.random() - 0.5) * 30, -10, (Math.random() - 0.5) * 30), 30, 3);
    pad.fx.userData.update(dt || 0.016);
    state.shake = k > 0 && k < 2 ? 0.6 : 0.1;
    state.g = las && k > 0 && k < 1.5 ? 7.5 - k * 3 : 1;
    state.met = met + Math.max(0, k) * 10;
    state.abortK = k;
  }

  // ---------- Earth orbit, the burn to the Moon, the coast, the flyby ----------
  function flightToMoon(t) {
    // Day 1: Orion over Earth, wings unfolding; the burn to the Moon.
    const tOrbit = t;
    cue(tOrbit, 'phase', { id: 'tli', label: tr('ride.ph.tli', 'To the Moon') });
    cue(tOrbit, 'fade', { dur: 0.6 });
    caption(tOrbit + 0.3, tr('ride.k.day1', 'Day 1 · high Earth orbit'), tr('ride.orbit.title', 'Wings out'), tr('ride.orbit.text', 'Four solar wings unfold: about 11 kilowatts for the air, water and computers that keep you alive.'));
    const tBurn = tOrbit + 3.4;
    const burnDur = 4.2;
    prompt(tBurn - 0.9, 'arm', tr('ride.p.arm', 'Arm the main engine'), 2.0);
    cue(tBurn, 'engine', { level: 0.35, bright: 0.35 });
    cue(tBurn, 'caption', { kicker: tr('ride.k.tli', 'Translunar injection'), title: tr('ride.tli.title', 'The burn to the Moon'), text: tr('ride.tli.text', 'The service module’s engine fires for almost six minutes and adds 388 m/s. Stop it on the number.'), tone: 'info' });
    cue(tBurn, 'dvMeter', { target: 388, dur: burnDur });
    prompt(tBurn + burnDur * 0.72, 'cutoff', tr('ride.p.cutoff', 'Cut off at 388 m/s'), burnDur * 0.5, 'Space', { dv: true });
    cue(tBurn + burnDur + 0.1, 'engine', { level: 0, bright: 0 });
    cue(tBurn + burnDur + 0.2, 'dvMeter', { done: true });
    if (crew.tli.leak) {
      cue(tBurn + burnDur + 0.6, 'alarm', { on: false, caution: true });
      cue(tBurn + burnDur + 0.6, 'caption', { kicker: tr('ride.k.caution', 'Caution'), title: tr('ride.leak.title', 'Propellant pressure dropping'), text: crew.tli.steep ? tr('ride.leak.steep', 'A valve leaks {kg} kg. Too little is left to fine-tune the way home: the entry will be steeper and hotter.', { kg: crew.tli.leakKg }) : tr('ride.leak.ok', 'A valve leaks {kg} kg. Your fuel margin covers it.', { kg: crew.tli.leakKg }), tone: 'warn', sound: 'warn' });
    }
    shot(tOrbit, tBurn + burnDur + 1.6, space, (tt, dt) => {
      const k = tt - tOrbit;
      placeEarthBelow(380, 0.3);
      space.earth.rotation.y = 1.2 + k * 0.01;
      space.moon.visible = false;
      space.orion.visible = true;
      setDeploy(space.orion, smooth(0.2, 2.6, k));
      const burning = tt >= tBurn && tt < tBurn + burnDur;
      setRocketPlume(space.plume, 9, 1.3, burning ? 1 : 0, 1, tt);
      space.plume.visible = burning;
      state.dv = burning ? clamp((tt - tBurn) / burnDur) * 388 * 1.08 : state.dv;
      state.g = burning ? 0.25 : 0;
      state.shake = burning ? 0.04 : 0;
      state.loop = 0.02 + smooth(tBurn, tBurn + burnDur, tt) * 0.04;
      state.met = DAY * 1 + k * 400;
      const cam = space.camera;
      const ang = 0.9 + k * 0.05;
      cam.position.set(Math.cos(ang) * 0.034, 0.008, Math.sin(ang) * 0.034);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, -0.002, 0);
      cam.fov = fovFor(50);
      cam.updateProjectionMatrix();
    });
    // The coast: Earth shrinks, the Moon grows; maybe trouble.
    const tCoast = tBurn + burnDur + 1.6;
    cue(tCoast, 'phase', { id: 'coast', label: tr('ride.ph.coast', 'Coast') });
    caption(tCoast + 0.2, tr('ride.k.coast', 'Days 2–5'), tr('ride.coast.title', 'Earth gets smaller'), tr('ride.coast.text', 'Four days of coasting. You eat, sleep strapped to the wall, exercise and check every system.'));
    let tc = tCoast + 2.2;
    if (crew.life.fails) {
      cue(tc, 'alarm', { on: true });
      cue(tc, 'flag', { key: 'co2', value: true });
      cue(tc, 'caption', { kicker: tr('ride.k.alarm', 'Master alarm · Day 3'), title: tr('ride.co2.title', 'Carbon dioxide rising'), text: crew.life.emergency ? tr('ride.co2.em', 'A valve sticks and the scrubber falls behind. Only {d} days of clean air left for a 9-day trip.', { d: crew.life.effDays }) : tr('ride.co2.fix', 'A valve sticks and the scrubber falls behind. Switch to the backup loop.'), tone: 'bad', sound: 'bad' });
      prompt(tc + 0.4, 'scrubber', tr('ride.p.scrubber', 'Swap to the backup scrubber loop'), 3.2);
      cue(tc + 3.8, 'alarm', { on: false });
      cue(tc + 3.8, 'flag', { key: 'co2', value: false });
      tc += 4.2;
    }
    if (crew.spe.hits) {
      cue(tc, 'alarm', { on: true });
      cue(tc, 'flag', { key: 'rad', value: true });
      cue(tc, 'caption', { kicker: tr('ride.k.spe', 'Space weather · Day {d}', { d: Math.ceil(crew.spe.day) }), title: tr('ride.spe.title', 'Solar storm'), text: crew.spe.shelter ? tr('ride.spe.ok', 'Fast protons from the Sun, arriving within the hour. Build the shelter from the stowage bags.') : tr('ride.spe.none', 'Fast protons from the Sun, and no shelter planned. Huddle in the most shielded corner.'), tone: crew.spe.shelter ? 'warn' : 'bad', sound: 'bad' });
      if (crew.spe.shelter) prompt(tc + 0.4, 'shelter', tr('ride.p.shelter', 'Build the storm shelter'), 3.2);
      cue(tc + 3.8, 'alarm', { on: false });
      cue(tc + 3.8, 'flag', { key: 'rad', value: false });
      tc += 4.2;
    }
    if (crew.cold) {
      cue(tc, 'caption', { kicker: tr('ride.k.day4', 'Day 4'), title: tr('ride.cold.title', 'A cold cabin'), text: tr('ride.cold.text', 'A heater controller fails. 12 °C inside: every layer you packed goes on.'), tone: 'warn', sound: 'warn' });
      tc += 2.6;
    }
    const tFly = Math.max(tc + 1.2, tCoast + 5.2);
    shot(tCoast, tFly, cabin, (tt) => {
      const k = clamp((tt - tCoast) / (tFly - tCoast));
      state.met = DAY * (1.3 + k * 3.6);
      state.g = 0;
      state.cover = 0;
      state.shake = 0;
      state.alt = 30000 + k * 300000;
      state.speed = 9000 - k * 6000;
      state.loop = 0.06 + k * 0.36;
      state.float = 1;
      // Earth behind (one window), the Moon ahead (the other): a wide view.
      const dE = 30000 + k * 300000;
      space.earth.position.set(-dE * 0.55, -dE * 0.15, dE * 0.82);
      space.earth.visible = true;
      placeMoon(lerp(360000, 60000, k), new THREE.Vector3(0.25, 0.05, -1));
      space.sky.material.uniforms.uK.value = 1;
      viewDir.set(-0.15, -0.05, 1).normalize().lerp(new THREE.Vector3(0.25, 0.05, -1).normalize(), smooth(0.35, 0.75, k));
      viewUp.set(0, 1, 0);
    });

    // The flyby: through the window, the far side passes 6,545 km below.
    cue(tFly, 'phase', { id: 'flyby', label: tr('ride.ph.flyby', 'Far side') });
    cue(tFly, 'fade', { dur: 0.6 });
    caption(tFly + 0.3, tr('ride.k.day6', 'Day 6 · lunar flyby'), tr('ride.fly.title', 'Behind the Moon'), tr('ride.fly.text', '6,545 km above the far side and 406,771 km from Earth: farther than any human has ever been. No radio for 40 minutes.'), 'ok', 'good');
    const tHero = tFly + 2.6;
    shot(tFly, tHero, space, (tt) => {
      const k = (tt - tFly) / (tHero - tFly);
      space.earth.visible = false;
      space.moon.position.set(0, 0, -(1737.4 + 6545));
      space.moon.rotation.set(0, Math.PI * 0.5 + k * 0.05, 0);
      space.orion.visible = true;
      setDeploy(space.orion, 1);
      space.plume.visible = false;
      const cam = space.camera;
      cam.position.set(0.012, 0.004, 0.022 - k * 0.004);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, 0, -0.02);
      cam.fov = fovFor(48);
      cam.updateProjectionMatrix();
      state.met = DAY * 5.0 + k * 3600;
      state.loop = 0.45;
    });
    // Photo targets through the window (the screen draws the reticles).
    const nT = crew.avionics.fails && !crew.avionics.dual ? 2 : 5;
    // Real far-side features (latitude, longitude in degrees) and Earthset.
    const targets = [
      { lat: -5.9, lon: 179.4, name: tr('ride.tg.daedalus', 'Daedalus crater') },
      { lat: -4.0, lon: -157.4, name: tr('ride.tg.korolev', 'Korolev crater') },
      { lat: 2.6, lon: -128.7, name: tr('ride.tg.hertz', 'Hertzsprung basin') },
      { lat: -36.1, lon: -151.8, name: tr('ride.tg.apollo', 'Apollo basin') },
      { name: tr('ride.tg.earthset', 'Earthset'), earth: true },
    ];
    const tWin = tHero;
    const tWinEnd = tWin + 9.6;
    targets.forEach((tg, i) => {
      const t0 = tWin + 0.8 + i * 1.7;
      if (i < nT || tg.earth) cue(t0, 'target', { id: 'photo' + i, name: tg.name, dur: 1.6, idx: i });
    });
    cue(tWin + 0.2, 'photos', { total: nT });
    if (nT < 5) cue(tWin + 0.8 + 2 * 1.7, 'caption', { kicker: tr('ride.k.reset', 'Caution'), title: tr('ride.reset.title', 'Flight computer reset'), text: tr('ride.reset.text', 'Out of radio contact, the only flight computer restarts. By the time it is back, the best craters are behind you.'), tone: 'warn', sound: 'warn' });
    // Geometry of the window view: the Moon 6,545 km below, Earth above its limb.
    const moonC = new THREE.Vector3(0.1, -0.32, -0.94).normalize().multiplyScalar(1737.4 + 6545);
    const cHat = moonC.clone().normalize();
    const right = new THREE.Vector3().crossVectors(cHat, new THREE.Vector3(0, 1, 0)).normalize();
    const upV = new THREE.Vector3().crossVectors(right, cHat).normalize();
    const faceQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 0, 0), cHat.clone().negate());
    const spinQ = new THREE.Quaternion();
    const Y = new THREE.Vector3(0, 1, 0);
    const lookAtV = cHat.clone().add(upV.clone().multiplyScalar(0.07));
    const latLon = (lat, lon) => {
      const p = lat * DEG;
      const l = lon * DEG;
      return new THREE.Vector3(Math.cos(p) * Math.cos(l), Math.sin(p), -Math.cos(p) * Math.sin(l));
    };
    targetWorld = (i) => {
      const tg = targets[i];
      if (tg.earth) return space.earth.position.clone();
      const w = latLon(tg.lat, tg.lon).applyQuaternion(space.moon.quaternion);
      // Only the half that faces you can be photographed.
      if (w.dot(cHat) > -0.05) return new THREE.Vector3(0, 0, 1e9);
      return w.multiplyScalar(1737.4).add(space.moon.position);
    };
    shot(tWin, tWinEnd, space, (tt) => {
      const k = (tt - tWin) / (tWinEnd - tWin);
      space.orion.visible = false; // you are inside it, looking out
      space.moon.visible = true;
      space.moon.position.copy(moonC);
      // The Moon turns beneath you: far-side longitudes sweep past the window.
      spinQ.setFromAxisAngle(Y, lerp(0.45, -0.75, k));
      space.moon.quaternion.copy(faceQ).multiply(spinQ);
      space.earth.visible = true;
      // Earth sinks toward the limb and sets behind it at the end.
      const a = lerp(17, 9, smooth(0.55, 1, k)) * DEG;
      space.earth.position.copy(cHat).multiplyScalar(Math.cos(a)).addScaledVector(upV, Math.sin(a)).multiplyScalar(392000);
      const cam = space.camera;
      cam.position.set(0, 0, 0);
      cam.up.copy(upV);
      cam.lookAt(lookAtV);
      cam.fov = fovFor(46);
      cam.updateProjectionMatrix();
      state.met = DAY * 5.1 + k * 3 * 3600;
      state.loop = 0.45 + k * 0.1;
      state.window = true;
    });
    cue(tWinEnd - 0.1, 'photos', { done: true });
    homeAndEntry(tWinEnd);
  }

  // ---------- Home: service module separation, entry, parachutes ----------
  function homeAndEntry(t) {
    cue(t, 'phase', { id: 'entry', label: tr('ride.ph.entry', 'Entry') });
    cue(t, 'fade', { dur: 0.6 });
    caption(t + 0.3, tr('ride.k.day9', 'Day 9'), tr('ride.smsep.title', 'Goodbye, service module'), tr('ride.smsep.text', 'Twenty minutes before entry the service module lets go. Only the capsule and its heat shield come home.'));
    const tSep = t;
    const tEntry = t + 3.2;
    shot(tSep, tEntry, space, (tt) => {
      const k = (tt - tSep) / (tEntry - tSep);
      placeEarthBelow(5000 - k * 3000, 0.5);
      space.moon.visible = false;
      space.orion.visible = true;
      const p = space.orion.userData.parts;
      ['sm', 'wing0', 'wing1', 'wing2', 'wing3'].forEach((key) => {
        if (!p[key]) return;
        p[key].position.y = -smooth(0.15, 1, k) * 9;
        p[key].rotation.z = smooth(0.15, 1, k) * 0.4;
      });
      if (p.heatshield) p.heatshield.visible = true;
      const cam = space.camera;
      cam.position.set(0.016, 0.004, 0.016);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, -0.007, 0);
      cam.fov = fovFor(50);
      cam.updateProjectionMatrix();
      state.met = DAY * 9 - 1800 + k * 600;
      state.loop = 0.97;
    });
    // Entry from the seat: plasma at the windows, the g-meter climbs.
    const skip = crew.entry.profile === 'skip';
    const peak = crew.entry.peakG;
    const tEnd = tEntry + 7.2;
    cue(tEntry, 'phase', { id: 'entry2', label: tr('ride.ph.entry', 'Entry') });
    caption(tEntry + 0.2, tr('ride.k.ei', 'Entry interface · 122 km'), tr('ride.ei.title', '11 km/s into the air'), skip ? tr('ride.ei.skip', 'A skip entry: dip in, bounce out, dip again. Gentler g, but the shield heats for longer.') : tr('ride.ei.direct', 'A direct entry: one long dive. Harder g, but a shorter time in the heat.'), 'info');
    cue(tEntry + 1.6, 'caption', { kicker: tr('ride.k.blackout', 'Radio blackout'), title: tr('ride.bo.title', 'Plasma'), text: tr('ride.bo.text', 'Air turns to glowing plasma around the shield at about 2,700 °C. For six minutes no radio gets through.'), tone: 'warn' });
    if (crew.entry.charLoss) cue(tEntry + 3.0, 'caption', { kicker: tr('ride.k.caution', 'Caution'), title: tr('ride.char.title', 'Chunks of char breaking off'), text: crew.entry.burn === 'through' ? tr('ride.char.bad', 'The shield is shedding faster than it can burn away safely.') : tr('ride.char.ok', 'Like Artemis I, the shield sheds pieces. It is holding.'), tone: crew.entry.burn === 'through' ? 'bad' : 'warn', sound: 'warn' });
    cue(tEntry + 0.6, 'engine', { level: 0.5, bright: 0.2 });
    shot(tEntry, lostEntry ? tEntry + 4.6 : tEnd, cabin, (tt) => {
      const k = (tt - tEntry) / (tEnd - tEntry);
      // g profile: one hump (direct) or two (skip).
      let gk = skip ? Math.max(Math.exp(-Math.pow((k - 0.3) / 0.1, 2)) * 0.8, Math.exp(-Math.pow((k - 0.65) / 0.12, 2))) : Math.exp(-Math.pow((k - 0.45) / 0.16, 2));
      state.g = 1 * smooth(0.85, 1, k) + gk * peak;
      state.plasma = clamp(gk * 1.4 + (skip ? 0 : 0) + (k < 0.85 ? 0.15 * smooth(0.05, 0.2, k) : 0));
      if (lostEntry) state.white = smooth(0.45, 0.62, k);
      state.shake = 0.15 + gk * 0.45;
      state.met = DAY * 9 - 1200 + k * 900;
      state.alt = lerp(122, 8, k);
      state.speed = lerp(39600, 900, smooth(0, 0.9, k));
      state.cover = 0;
      state.float = 1 - smooth(0.05, 0.3, k);
      placeEarthBelow(Math.max(5, lerp(120, 10, k)), 0.5);
      space.sky.material.uniforms.uK.value = 1 - smooth(0.3, 0.9, k);
      viewDir.set(0, 0.2, -1).normalize();
      viewUp.set(0, 1, 0);
      state.loop = 0.99;
    });
    cue(tEntry + 0.8, 'peak', { g: peak });
    if (lostEntry) {
      cue(tEntry + 3.3, 'alarm', { on: true });
      cue(tEntry + 3.6, 'caption', { kicker: tr('ride.k.signal', 'Signal lost'), title: tr('ride.through.title', 'The heat shield wore through'), text: tr('ride.through.text', 'The shield had no margin left for this entry.'), tone: 'bad' });
      cue(tEntry + 4.0, 'engine', { level: 0, bright: 0 });
      cue(tEntry + 4.2, 'fade', { dur: 1.2, black: true });
      cue(tEntry + 5.4, 'card', { result: 'lost' });
      finishAt(tEntry + 5.5);
      return;
    }
    cue(tEnd - 0.4, 'engine', { level: 0, bright: 0 });
    chutesAndSplash(tEnd, false);
  }

  function chutesAndSplash(t, aborted) {
    const tD = t;
    cue(tD, 'phase', { id: 'chutes', label: tr('ride.ph.chutes', 'Parachutes') });
    cue(tD, 'fade', { dur: 0.5 });
    cue(tD + 0.4, 'sound', { name: 'fairing' });
    caption(tD + 0.3, aborted ? tr('ride.k.atlantic', 'Off the Florida coast') : tr('ride.k.pacific', 'Pacific Ocean, off San Diego'), tr('ride.chute.title', 'Parachutes'), tr('ride.chute.text', 'Two drogues steady the capsule, then three huge mains open. From 500 km/h down to about 30 km/h.'));
    prompt(tD + 0.7, 'drogue', tr('ride.p.drogue', 'Confirm: drogues out'), 1.8);
    const tM = tD + 2.4;
    cue(tM, 'sound', { name: 'stage' });
    if (crew.chutes.failed && !aborted) cue(tM + 0.4, 'caption', { kicker: tr('ride.k.caution', 'Caution'), title: tr('ride.chute2.title', 'One main stays furled'), text: tr('ride.chute2.text', 'Two of three are enough: Apollo 15 landed the same way in 1971.'), tone: 'warn', sound: 'warn' });
    prompt(tM + 0.3, 'mains', tr('ride.p.mains', 'Confirm: three mains'), 1.8);
    const tS = tM + 3.6;
    const tEnd = tS + 3.2;
    shot(tD, tEnd, ocean, (tt, dt) => {
      const k = tt - tD;
      const fall = tt < tS ? 1 - (tt - tD) / (tS - tD) : 0;
      ocean.capG.position.y = 2 + fall * 420;
      ocean.capG.rotation.z = Math.sin(tt * 1.3) * 0.06 * (fall > 0 ? 1 : 0.3);
      ocean.capG.rotation.x = Math.cos(tt * 0.9) * 0.05;
      const mainsOpen = tt >= tM;
      ocean.drogues.forEach((c) => (c.visible = tt < tM));
      ocean.chutes.forEach((c, i) => {
        const failed = crew.chutes.failed && !aborted && i === 2;
        c.visible = mainsOpen && tt < tS + 0.6;
        const open = smooth(tM, tM + 1.2, tt);
        c.scale.set(failed ? 0.18 : 0.15 + open * 0.85, failed ? 0.9 : 0.4 + open * 0.6, failed ? 0.18 : 0.15 + open * 0.85);
      });
      if (tt >= tS && tt < tS + 0.6) for (let i = 0; i < 4; i++) ocean.spray.userData.emit(new THREE.Vector3((Math.random() - 0.5) * 6, 1, (Math.random() - 0.5) * 6), new THREE.Vector3((Math.random() - 0.5) * 14, 9 + Math.random() * 8, (Math.random() - 0.5) * 14), 7, 1.8);
      ocean.spray.userData.update(dt || 0.016);
      // Gentle swell on the water near the capsule.
      const pos = ocean.water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setZ(i, Math.sin(x * 0.05 + tt * 1.1) * 0.25 + Math.cos(y * 0.07 + tt * 0.8) * 0.2);
      }
      pos.needsUpdate = true;
      const cam = ocean.camera;
      const cy = ocean.capG.position.y;
      if (tt < tS) {
        cam.position.set(-80, cy + 18, 130);
        cam.lookAt(0, cy + 24, 0);
      } else {
        cam.position.set(-26, 6, 34);
        cam.lookAt(0, 2, 0);
      }
      cam.fov = fovFor(50);
      cam.updateProjectionMatrix();
      state.g = tt < tM ? 1.4 : tt < tM + 0.8 ? 2.2 : 1;
      state.shake = tt >= tM && tt < tM + 0.6 ? 0.3 : 0.03;
      state.alt = Math.max(0, cy / 1000);
      state.speed = tt >= tS ? 0 : tt < tM ? 300 : lerp(300, 30, smooth(tM, tM + 1.2, tt));
      state.met = (aborted ? 300 : DAY * 9) + k * 60;
    });
    cue(tS, 'sound', { name: 'liftoff' });
    cue(tS, 'big', { text: tr('ride.splash', 'Splashdown') });
    cue(tS + 0.3, 'caption', { kicker: aborted ? tr('ride.k.safe', 'Crew safe') : tr('ride.k.home', 'Home'), title: aborted ? tr('ride.splash.abort', 'The crew is safe') : tr('ride.splash.title', 'Welcome home'), text: aborted ? tr('ride.splash.abort.text', 'The abort system did its job. The rocket is lost, the mission is over, and all four of you are alive.') : tr('ride.splash.text', '9 days, 1 hour and 32 minutes after launch. Divers from the recovery ship reach the hatch.'), tone: 'ok', sound: 'good' });
    cue(tEnd - 0.4, 'card', { result: aborted ? 'aborted' : outcome });
    finishAt(tEnd + 0.2);
  }

  function finishAt(t) {
    endAt = t;
  }

  cues.sort((a, b) => a.t - b.t);
  shots.sort((a, b) => a.t0 - b.t0);

  // ---------- Per-frame ----------
  const shakeV = new THREE.Vector3();
  const baseQ = new THREE.Quaternion();
  let decision = null; // { until, auto } while the abort decision holds the clock
  function emit(c) {
    if (c.type === 'abortWindow') {
      decision = { at: T, auto: c.auto };
      rate = reduced ? 0.15 : 0.22;
    }
    if (c.type === 'flag') state[c.key] = c.value;
    if (c.type === 'alarm' && !c.caution) state.alarm = !!c.on;
    if (onCue) onCue(c);
  }

  function step(dt) {
    if (ended || disposed) return;
    const d = Math.max(0, dt || 0) * rate;
    // The abort decision waits for the player (slow motion), then the flight
    // computer acts at the deadline.
    if (decision && !decision.done && T + d >= T_SEP + 0.45) {
      T = T_SEP + 0.45;
      decision.wait = (decision.wait || 0) + (dt || 0);
      if (decision.wait >= decision.auto) act('abortAuto');
    } else T += d;
    while (fired < cues.length && cues[fired].t <= T) emit(cues[fired++]);
    if (T >= endAt) {
      ended = true;
      if (onCue) onCue({ type: 'end' });
      return;
    }
    const sh = shots.find((x) => T >= x.t0 && T < x.t1) || shots[shots.length - 1];
    if (sh !== cur) {
      cur = sh;
      state.window = false;
    }
    sh.update(T, d);
    // Cabin extras.
    if (sh.set === cabin) {
      const cam = cabin.camera;
      const s = reduced ? 0 : state.shake;
      shakeV.set((Math.random() - 0.5) * s * 0.02, (Math.random() - 0.5) * s * 0.02, 0);
      cam.position.copy(shakeV);
      // Heavy g presses you back into the seat: the view narrows a little.
      cam.fov = fovFor(70) - clamp(state.g - 1, 0, 6) * 1.6;
      cam.updateProjectionMatrix();
      cabin.windows.forEach((w) => (w.userData.cover.visible = state.cover > 0.5));
      cabin.plasmaMat.opacity = clamp(state.plasma) * (0.7 + 0.3 * Math.sin(T * 40));
      cabin.winLight.intensity = state.cover > 0.5 ? 0 : 1.2 + state.plasma * 3;
      cabin.winLight.color.setHex(state.plasma > 0.1 ? 0xff9a50 : 0xffffff);
      cabin.alarmLight.intensity = state.alarm ? (Math.sin(T * 12 * (1 / Math.max(rate, 0.2))) > 0 ? 1.4 : 0.2) : 0;
      // Zero g: the plush floats up on its tether and the crewmate's arms drift.
      const f = state.float;
      cabin.plush.position.y = 0.55 - (1 - f) * 0.18 + Math.sin(T * 0.8) * 0.02 * f;
      cabin.plush.rotation.z = Math.sin(T * 0.5) * 0.4 * f;
      if (cabin.mate) cabin.mate.update(d);
      screenClock -= dt || 0;
      if (screenClock <= 0) {
        screenClock = 0.12;
        drawScreens();
      }
      renderWindow();
    } else if (sh.set === pad || sh.set === ocean) {
      const cam = sh.set.camera;
      const s = reduced ? 0 : state.shake;
      cam.position.x += (Math.random() - 0.5) * s * 0.6;
      cam.position.y += (Math.random() - 0.5) * s * 0.6;
    } else if (sh.set === space) {
      const s = reduced ? 0 : state.shake;
      space.camera.position.x += (Math.random() - 0.5) * s * 0.0004;
    }
    if (onCue) onCue({ type: 'frame', t: T, dur: endAt, g: state.g, met: state.met, alt: state.alt, speed: state.speed, dv: state.dv, white: state.white, window: !!state.window });
  }

  // Player actions from the screen.
  function act(id) {
    if (id === 'abort' || id === 'abortAuto') {
      if (!decision || decision.done) return false;
      decision.done = true;
      state.abortBy = id === 'abort' ? 'crew' : 'auto';
      rate = 1;
      T = T_SEP + 0.5;
      while (fired < cues.length && cues[fired].t <= T) emit(cues[fired++]);
      if (onCue) onCue({ type: 'aborted', by: state.abortBy, las: !!crew.las });
      return true;
    }
    if (id === 'alarm') state.alarm = false;
    return true;
  }

  const v3 = new THREE.Vector3();
  const obj = {
    get scene() {
      return (cur || shots[0]).set.scene;
    },
    get camera() {
      return (cur || shots[0]).set.camera;
    },
    exposure: 1.05,
    get duration() {
      return endAt;
    },
    get time() {
      return T;
    },
    get state() {
      return state;
    },
    update(dt) {
      step(dt);
    },
    onResize(w, h) {
      aspect = w / Math.max(1, h);
      sets.forEach((s) => {
        s.camera.aspect = aspect;
        // Phones in portrait: widen the view so the scene still fits.
        if (aspect < 1 && !s.camera.userData.baseFov) s.camera.userData.baseFov = s.camera.fov;
        s.camera.updateProjectionMatrix();
      });
    },
    act,
    setAlarm(on) {
      state.alarm = on;
    },
    // Screen position (0..1) of a photo target, or null when off screen.
    targetScreen(i) {
      if (!cur || cur.set !== space) return null;
      v3.copy(targetWorld(i));
      v3.project(space.camera);
      if (v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) return null;
      return { x: (v3.x + 1) / 2, y: (1 - v3.y) / 2 };
    },
    seek(target) {
      let guard = 0;
      while (T < target - 1e-6 && !ended && guard++ < 20000) {
        if (decision && !decision.done && T >= T_SEP + 0.44) act('abortAuto');
        step(0.05 / Math.max(rate, 0.05));
      }
    },
    dispose() {
      disposed = true;
      cabin.rt.dispose();
      sets.forEach((s) => {
        if (s.dispose) s.dispose();
        if (s !== (cur || shots[0]).set) disposeTree(s.scene);
      });
      if (cabin.mate) cabin.mate.dispose();
    },
  };
  cur = shots[0];
  return obj;
}
