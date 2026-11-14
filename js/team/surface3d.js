// The surface renderer (docs/TEAM-SURFACE.md). Draws one world from the
// published sim state and nothing else, so the same code runs on the host and,
// from decoded network snapshots, on a client. Calm exploration: the crew, the
// lander, the dish, science sites, samples and the real dangers (dust storms,
// rockfalls, cold nights, radiation shelter). No creatures, no weapons, no
// vehicles, nothing that flashes.
//
//   const r = createSurface({ state, camera: { mode: 'group' } });
//   engine.mount(el, r);                     // r is a scene object
//   r.sync(state, tickSeconds);              // whenever there is a new state; tick 0 = draw it as given
//   r.setCameraTarget({ mode: 'group' } | { mode: 'player', id: playerId });
//   r.cinematic('landing', k, info) / r.cinematic('launch', k) / r.cinematic(null)
//   r.project(x, y, z) -> { x, y, onScreen }    // CSS pixels, for DOM tags
//   r.quality, r.dispose()
import { THREE, profile as engineProfile, getPost } from '../3d/engine.js';
import { createAstronaut } from '../3d/astronaut.js';
import { createLamps, lampify, createParticles, createDecals, beamMaterial, haloMaterial, quality, reducedMotion } from './surface3d-fx.js';
import { buildWorld, WORLDS } from './surface3d-world.js';
import { buildHorizon } from './surface3d-horizon.js';
import { makeBackpack, makeHelmetBack, makeLander, makeDish, makeSite, makeSample, makePickup, makeScanner, ROLE_COLORS, SITE_COLORS } from './surface3d-actors.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const rgb = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const angleLerp = (a, b, k) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};

const FOV = 30;
// Bigger than life so a person across the room can read them.
const CREW_SCALE = 1.35;
const PITCH = THREE.MathUtils.degToRad(54);
const SINP = Math.sin(PITCH);
const COSP = Math.cos(PITCH);
const SKINS_S = ['s3', 's5', 's2', 's4'];
const AMBER = [1.0, 0.72, 0.32];

export function createSurface(opts) {
  const state0 = opts.state;
  const worldId = state0.world;
  const cfg = WORLDS[worldId] || WORLDS.moon;
  const q = quality();
  const low = q.tier === 'low';
  const reduced = reducedMotion();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 2, 1600);
  camera.position.set(0, 80, 60);
  let aspect = 16 / 9;
  let viewH = 900;

  const lamps = createLamps(low ? 8 : 16);
  const keep = state0.entities.filter((e) => e.kind === 'site').map((e) => ({ x: e.x, z: e.z }));
  const world = buildWorld(worldId, state0.map, state0.seed || 1, lamps, keep);
  scene.add(world.group);
  const size = state0.map.size;
  const mid = size / 2;

  if (cfg.fog) scene.fog = new THREE.FogExp2(cfg.fog.color, cfg.fog.density);
  const fogDay = cfg.fog ? new THREE.Color(cfg.fog.color) : null;
  const fogNight = cfg.fog ? new THREE.Color(cfg.fog.nightColor) : null;
  const fogBase = cfg.fog ? cfg.fog.density : 0;

  // ---------- Light ----------
  const hemi = new THREE.HemisphereLight(cfg.ambient.sky, cfg.ambient.ground, cfg.ambient.day);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(cfg.sun.color, cfg.sun.intensity);
  const sunDir = new THREE.Vector3(...cfg.sun.dir).normalize();
  sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.06;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  scene.add(sun.target);

  // ---------- Effects: dust and a few soft glows ----------
  const maxP = Math.round((low ? 1400 : 3000) * (q.particles || 1));
  const particles = {
    glow: createParticles(Math.round(maxP * 0.5), { additive: true, order: 7 }),
    dust: createParticles(maxP, { additive: false, order: 5, drag: 1.6 }),
  };
  scene.add(particles.glow.points, particles.dust.points);
  const decals = createDecals(low ? 60 : 120);
  scene.add(decals.mesh);
  const flashes = []; // short-lived, soft light pulses
  let shake = 0;
  let timeNow = 0;

  function pulse(x, z, y, radius, r, g, b, life) {
    if (flashes.length > 24) flashes.shift();
    flashes.push({ x, z, y, radius, r, g, b, t: 0, life });
  }
  // The camera only ever sways a little: quakes and liftoff, nothing else.
  function addShake(k) {
    shake = Math.min(0.8, shake + k * (reduced ? 0.2 : 0.6));
  }

  // ---------- The base, the dish, what is on the ground ----------
  const landerObj = makeLander(lamps);
  scene.add(landerObj.group);
  let dishObj = null;
  const site = new Map(); // id -> { obj, e }
  const samples = new Map();
  const pickups = new Map();
  const boulders = new Map();
  const hazardDecals = new Map();

  const boulderGeo = new THREE.IcosahedronGeometry(1, 1);
  const boulderMat = lampify(new THREE.MeshStandardMaterial({ color: cfg.rocks.color, roughness: 0.95, flatShading: true }), lamps);

  // ---------- Astronauts ----------
  const crew = new Map(); // id -> actor
  function makeCrew(e) {
    const color = ROLE_COLORS[e.role] || '#ffffff';
    const col = new THREE.Color(color);
    const bottom = '#' + col.clone().multiplyScalar(0.42).getHexString();
    // The character picked in setup (docs/TEAM-V3.md item 6): their build, height and face
    // behind a clear visor; the suit keeps the job colour.
    let look = null;
    try {
      look = opts.lookOf ? opts.lookOf(e) : null;
    } catch (err) {
      look = null;
    }
    const ap = look ? Object.assign({}, look, { name: e.name, visor: 'clear', suit: 'classic' }) : { name: e.name, hair: 'helmet', skin: SKINS_S[e.slot % 4], visor: 'gold', suit: 'classic' };
    const astro = createAstronaut(
      ap,
      { outfit: 'launch', helmet: true, shadows: true, blob: false, colors: { top: color, bottom, accent: '#f4f6fb', trim: '#2b2f37', glove: '#e5e8ee', shoe: '#1b1d22' } }
    );
    const g = astro.group;
    g.scale.setScalar(CREW_SCALE);
    scene.add(g);
    // Role ring on the ground: the single most readable thing from across a room.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.92, 36).rotateX(-Math.PI / 2), haloMaterial(col, 0.6));
    ring.renderOrder = 3;
    ring.userData.noAO = true;
    scene.add(ring);
    // A small marker over the head of anyone a person is driving.
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.68, 16).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: col, toneMapped: false, fog: false }));
    marker.userData.noAO = true;
    marker.visible = false;
    scene.add(marker);
    // Helmet lamp cone, seen in the dark and in dust.
    const beamMat = beamMaterial(0xfff2d8, { opacity: 0, fade: 1.3 });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 11, 16, 1, true).translate(0, -5.5, 0), beamMat);
    beam.userData.noAO = true;
    beam.rotation.order = 'YXZ';
    scene.add(beam);
    // The handheld scanner, in the right hand.
    const hold = new THREE.Group();
    const scanner = makeScanner(lamps);
    scanner.group.rotation.set(-0.3, 0, 0);
    hold.add(scanner.group);
    const gear = { pack: makeBackpack(e.role, lamps), lid: makeHelmetBack(e.role, lamps) };
    const attach = () => {
      const J2 = astro.joints;
      if (!J2) return;
      if (J2.handR && hold.parent !== J2.handR) J2.handR.add(hold);
      if (J2.torso && gear.pack.parent !== J2.torso) J2.torso.add(gear.pack);
      if (J2.helmet && gear.lid.parent !== J2.helmet) J2.helmet.add(gear.lid);
    };
    attach();
    const actor = { id: e.id, astro, ring, marker, beam, beamMat, scanner, color, rgb: rgb(color), x: e.x, z: e.z, heading: e.heading, yaw: 0, pose: '', attach, dustT: 0, sparkT: 0, e };
    // Wrap the suit materials in lamp light whenever the rig has swapped in.
    actor.relight = () => {
      g.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => lampify(m, lamps));
        }
      });
    };
    actor.relight();
    if (astro.ready && astro.ready.then) astro.ready.then(() => actor.relight()).catch(() => {});
    return actor;
  }
  for (const e of state0.entities) if (e.kind === 'astronaut') crew.set(e.id, makeCrew(e));

  // ---------- Ground markers ----------
  const pingGeo = new THREE.RingGeometry(1.2, 1.5, 36).rotateX(-Math.PI / 2);
  const pings = new Map();
  const faults = new Map();
  const markRing = new THREE.RingGeometry(0.94, 1.0, 72).rotateX(-Math.PI / 2);
  const markFill = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);

  // Landing ellipse and flame: only during the descent.
  const landingRing = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 72).rotateX(-Math.PI / 2), haloMaterial(0xffe14a, 0));
  landingRing.renderOrder = 4;
  scene.add(landingRing);
  const descentFlame = new THREE.Mesh(new THREE.ConeGeometry(1.4, 16, 16, 1, true).translate(0, -8, 0), beamMaterial(0xffc27a, { opacity: 0, fade: 1.2 }));
  descentFlame.userData.noAO = true;
  landerObj.group.add(descentFlame);
  descentFlame.position.y = 0.8;

  // ---------- Who the camera watches ----------
  let camTarget = opts.camera || { mode: 'group' };
  let shooter = null; // third/first person, when this screen is one player's own
  let horizon = null;
  const cam = { x: mid, z: mid, dist: 62, focusX: mid, focusZ: mid, ready: false };
  let cinema = null; // { mode, k, info }

  // ---------- Per-entity display memory ----------
  const display = new Map();
  let tickLen = 0.033;
  let syncAt = 0;
  let current = state0;
  let baseGlow = 0;
  let shelterK = 0;
  let stormK = 0;
  let lightSmooth = clamp(state0.sun ? state0.sun.light : 1);

  function rec(e) {
    let d = display.get(e.id);
    if (!d) {
      d = { id: e.id, kind: e.kind, px: e.x, pz: e.z, x: e.x, z: e.z, heading: e.heading, state: e.state };
      display.set(e.id, d);
    }
    return d;
  }

  // A puff of dust from wherever something meets the ground.
  function dustBurst(x, z, n, spread, up, life, size) {
    const d = cfg.dust;
    const y = world.height(x, z) + 0.05;
    const count = Math.round(n * (q.particles || 1));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spread * (0.4 + Math.random() * 0.8);
      particles.dust.emit(x + Math.cos(a) * s * 0.2, y, z + Math.sin(a) * s * 0.2, Math.cos(a) * s, up * (0.4 + Math.random() * 0.8), Math.sin(a) * s, cfg.gravity * 0.18, life * (0.7 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.8), 1, d[0], d[1], d[2], 0.55);
    }
  }

  // ---------- Events: soft, readable feedback ----------
  function handleEvent(ev) {
    const yAt = (x, z) => world.height(x, z);
    switch (ev.type) {
      case 'hit':
        // A rock glanced off a suit: a small sway, a puff of dust.
        addShake(0.12);
        dustBurst(ev.x, ev.z, 6, 2, 1.2, 0.7, 0.5);
        break;
      case 'suitReturn':
        pulse(ev.x, ev.z, 1.2, 7, AMBER[0] * 0.6, AMBER[1] * 0.6, AMBER[2] * 0.6, 0.8);
        break;
      case 'suitPatched':
        pulse(ev.x, ev.z, 1.2, 6, 0.4, 1.0, 0.7, 0.6);
        break;
      case 'scanDone': {
        const obj = site.get(ev.siteId);
        const col = obj ? rgb(SITE_COLORS[obj.e.siteKind] || '#fff') : [1, 1, 1];
        pulse(ev.x, ev.z, 2, 14, col[0] * 0.7, col[1] * 0.7, col[2] * 0.7, 1.2);
        decals.add(ev.x, yAt(ev.x, ev.z), ev.z, 10, 1.4, col[0] * 0.6, col[1] * 0.6, col[2] * 0.6, 2);
        const n = Math.round(18 * (q.particles || 1));
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.28;
          particles.glow.emit(ev.x + Math.cos(a) * 1.5, 0.6, ev.z + Math.sin(a) * 1.5, Math.cos(a) * 0.6, 1.2 + Math.random() * 1.4, Math.sin(a) * 0.6, -0.4, 1.6 + Math.random(), 0.22, 0, col[0], col[1], col[2], 0.8);
        }
        break;
      }
      case 'dishPlanted':
        pulse(ev.x, ev.z, 2, 8, 0.4, 0.75, 1.1, 0.6);
        dustBurst(ev.x, ev.z, 12, 3, 1.4, 0.9, 0.9);
        break;
      case 'quake':
        addShake(0.45);
        dustBurst(ev.x || mid, ev.z || mid, 20, 10, 1.6, 1.4, 1.4);
        break;
      case 'rockfall': {
        const y = yAt(ev.x, ev.z);
        dustBurst(ev.x, ev.z, 22, 5, 3, 1.2, 1.3);
        decals.add(ev.x, y, ev.z, 4.5, 16, 0, 0, 0, 1);
        addShake(0.18);
        break;
      }
      case 'jettison':
        dustBurst(ev.x, ev.z, 10, 2.5, 3, 0.8, 0.6);
        break;
      case 'liftoff':
        addShake(0.7);
        break;
      default:
        break;
    }
  }

  // ---------- Sync: a new state arrived ----------
  function sync(state, tick) {
    current = state;
    tickLen = tick || 0;
    syncAt = performance.now() / 1000;
    const live = new Set();
    for (const e of state.entities) {
      if (e.gone) continue;
      live.add(e.id);
      const d = rec(e);
      d.px = d.x;
      d.pz = d.z;
      d.x = e.x;
      d.z = e.z;
      d.state = e.state;
      d.e = e;
      d.heading = e.heading;
      if (e.kind === 'astronaut') {
        const actor = crew.get(e.id) || (crew.set(e.id, makeCrew(e)), crew.get(e.id));
        actor.e = e;
      }
    }
    for (const id of Array.from(display.keys())) {
      if (!live.has(id)) display.delete(id);
    }

    // Things that come and go, pooled by id.
    syncGroup(state, 'site', site, (e) => {
      const o = makeSite(e.siteKind, lamps);
      o.group.position.set(e.x, world.height(e.x, e.z), e.z);
      scene.add(o.group);
      return o;
    });
    syncGroup(state, 'sample', samples, (e) => {
      const o = makeSample(e.siteKind, lamps);
      scene.add(o.group);
      return o;
    });
    syncGroup(state, 'pickup', pickups, (e) => {
      const o = makePickup(e.item);
      o.group.position.set(e.x, world.height(e.x, e.z), e.z);
      scene.add(o.group);
      return o;
    });
    syncGroup(state, 'boulder', boulders, () => {
      const m = new THREE.Mesh(boulderGeo, boulderMat);
      m.castShadow = true;
      scene.add(m);
      return m;
    });

    for (const ev of state.events || []) handleEvent(ev);
  }

  function syncGroup(state, kind, map, make) {
    const seen = new Set();
    for (const e of state.entities) {
      if (e.kind !== kind || e.gone) continue;
      seen.add(e.id);
      let entry = map.get(e.id);
      if (!entry) {
        entry = { obj: make(e), e };
        map.set(e.id, entry);
      }
      entry.e = e;
    }
    for (const [id, entry] of map) {
      if (seen.has(id)) continue;
      const o = entry.obj;
      const node = o.group || o;
      if (node.parent) node.parent.remove(node);
      map.delete(id);
    }
  }

  // ---------- Frame ----------
  function alpha(now) {
    if (!tickLen) return 1;
    return clamp((now - syncAt) / tickLen);
  }

  function updateCamera(dt, t) {
    const list = [];
    for (const actor of crew.values()) {
      if (actor.e.aboard) continue;
      list.push(actor);
    }
    let minX = 1e9;
    let maxX = -1e9;
    let minZ = 1e9;
    let maxZ = -1e9;
    let sumX = 0;
    let sumZ = 0;
    let focus = null;
    if (camTarget.mode === 'player') {
      for (const actor of crew.values()) if (actor.e.playerId === camTarget.id) focus = actor;
    }
    // Who the shot is about: the people playing. Robots may wander out of it.
    const people = list.filter((a) => !a.e.isBot);
    const framed = people.length ? people : list;
    if (focus) {
      minX = maxX = focus.x;
      minZ = maxZ = focus.z;
      sumX = focus.x;
      sumZ = focus.z;
      const h = focus.e.heading || 0;
      minX -= 5;
      maxX += 5;
      minZ -= 3;
      maxZ += 3;
      sumX += Math.cos(h) * 2.4; // a little ahead of where you're looking
      sumZ += Math.sin(h) * 2.4;
    } else if (framed.length) {
      for (const a of framed) {
        minX = Math.min(minX, a.x);
        maxX = Math.max(maxX, a.x);
        minZ = Math.min(minZ, a.z);
        maxZ = Math.max(maxZ, a.z);
        sumX += a.x;
        sumZ += a.z;
      }
      sumX /= framed.length;
      sumZ /= framed.length;
    } else {
      const L = state0.map.lander;
      minX = maxX = sumX = L.x;
      minZ = maxZ = sumZ = L.z;
    }
    // An uplink or the walk home is about the base: keep it in the shot if the crew is near it.
    if ((current.phase === 'siege' || current.stage === 'extraction') && list.length) {
      const dish = current.entities.find((e) => e.kind === 'dish' && e.planted);
      for (const b of [state0.map.lander, dish].filter(Boolean)) {
        if (Math.hypot(b.x - sumX, b.z - sumZ) > 40) continue;
        minX = Math.min(minX, b.x);
        maxX = Math.max(maxX, b.x);
        minZ = Math.min(minZ, b.z);
        maxZ = Math.max(maxZ, b.z);
      }
    }
    const margin = 5;
    const hw = (maxX - minX) / 2 + margin;
    const hh = (maxZ - minZ) / 2 + margin * 0.8;
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const distH = hw / (tanV * aspect * 0.94);
    const distV = (hh * SINP) / (tanV * 0.7);
    let want = Math.max(distH, distV);
    want = clamp(want, 32, focus ? 46 : 72);
    const cx = ((minX + maxX) / 2) * 0.65 + sumX * 0.35;
    const cz = ((minZ + maxZ) / 2) * 0.65 + sumZ * 0.35;
    if (!cam.ready) {
      cam.x = cx;
      cam.z = cz;
      cam.dist = want;
      cam.ready = true;
    }
    // Slow, smooth follow: the calm camera.
    cam.x = damp(cam.x, cx, 3, dt);
    cam.z = damp(cam.z, cz, 3, dt);
    cam.dist = damp(cam.dist, want, want > cam.dist ? 2.2 : 1.2, dt);
    shake = Math.max(0, shake - dt * 1.6);
    const shk = shake * shake;
    const sx = Math.sin(t * 13) * shk * 0.6;
    const sz = Math.cos(t * 11) * shk * 0.5;

    let camDist = cam.dist;
    let lookX = cam.x;
    let lookZ = cam.z;
    let lookY = 0;
    if (cinema && cinema.mode === 'landing') {
      const k = cinema.k;
      const L = state0.map.lander;
      const a = altitudeAt(k);
      lookX = lerp(L.x + (cinema.info ? cinema.info.driftX : 0) * (1 - k), L.x, smoothstep(0.6, 1, k));
      lookZ = lerp(L.z + (cinema.info ? cinema.info.driftZ : 0) * (1 - k), L.z, smoothstep(0.6, 1, k));
      lookY = a * 0.45;
      camDist = lerp(112, cam.dist, smoothstep(0, 1, k));
    } else if (cinema && cinema.mode === 'launch') {
      const k = cinema.k;
      const L = state0.map.lander;
      lookX = L.x;
      lookZ = L.z;
      // Keep the climbing ascent stage in frame, then let it pull away.
      lookY = Math.min(140, Math.pow(Math.max(0, k - 0.04), 2.3) * 300 * 0.86);
      camDist = lerp(cam.dist, 72, smoothstep(0, 0.4, k));
    }
    camera.position.set(lookX + sx, lookY + camDist * SINP, lookZ + camDist * COSP + sz);
    camera.lookAt(lookX + sx, lookY, lookZ - camDist * 0.025 + sz);
    camera.updateMatrixWorld();
    lamps.uniforms.uLampCamW.value.copy(camera.matrixWorld);
    cam.focusX = lookX;
    cam.focusZ = lookZ;
    lamps.setFocus(lookX, lookZ);

    // The sun's shadow frustum follows the frame.
    const span = camDist * 0.66;
    const sc = sun.shadow.camera;
    const wanted = Math.max(16, span);
    if (Math.abs(sc.right - wanted) > 2) {
      sc.left = -wanted;
      sc.right = wanted;
      sc.top = wanted;
      sc.bottom = -wanted;
      sc.updateProjectionMatrix();
    }
    sun.position.set(lookX + sunDir.x * 300, sunDir.y * 300, lookZ + sunDir.z * 300);
    sun.target.position.set(lookX, 0, lookZ);
  }

  const altitudeAt = (k) => Math.pow(1 - k, 1.7) * 150;

  function updateCrew(dt, t, a, night) {
    const beamOn = night > 0.12 ? smoothstep(0.12, 0.5, night) : 0;
    for (const actor of crew.values()) {
      const e = actor.e;
      const d = display.get(e.id);
      const prevX = actor.x;
      const prevZ = actor.z;
      if (d) {
        actor.x = d.px + (d.x - d.px) * a;
        actor.z = d.pz + (d.z - d.pz) * a;
      }
      const speed = dt > 0 ? Math.min(8, Math.hypot(actor.x - prevX, actor.z - prevZ) / dt) : 0;
      actor.attach();
      const g = actor.astro.group;
      const hidden = !!e.aboard || (cinema && cinema.mode === 'landing') || actor.bodyHidden;
      g.visible = !hidden;
      actor.ring.visible = !e.aboard && !(cinema && cinema.mode === 'landing') && !(shooter && e.playerId === shooter.myId);
      const y = world.height(actor.x, actor.z);
      const isMe = camTarget.mode === 'player' ? e.playerId === camTarget.id : !e.isBot;
      actor.marker.visible = g.visible && isMe && !cinema && !shooter;
      if (actor.marker.visible) actor.marker.position.set(actor.x, y + 2.95 * CREW_SCALE + (reduced ? 0 : Math.sin(t * 1.6) * 0.08), actor.z);
      g.position.set(actor.x, y, actor.z);
      const h = e.heading || 0;
      const moving = speed > 0.4;
      const targetYaw = Math.atan2(Math.cos(h), Math.sin(h));
      actor.yaw = angleLerp(actor.yaw, targetYaw, 1 - Math.exp(-10 * dt));
      g.rotation.y = actor.yaw;

      // Pose from the sim's animation hint.
      const scanning = e.useKind === 'scan' || e.state === 'scan';
      const busy = scanning || e.state === 'plant' || e.state === 'repair' || (e.useT > 0 && (e.useKind === 'plant' || e.useKind === 'align'));
      const pose = busy && speed < 0.5 ? 'crouch' : '';
      if (pose !== actor.pose) {
        if (actor.pose) actor.astro.stopAction(actor.pose);
        actor.pose = pose;
        if (pose) actor.astro.play(pose, { hold: true });
      }
      actor.astro.setSpeed(speed);
      actor.astro.update(dt);
      actor.scanner.setActive(scanning ? 1 : 0);

      // Ring: role colour; a steady amber while a suit is walking its wearer home.
      actor.ring.position.set(actor.x, y + 0.08, actor.z);
      if (e.returning || e.restT > 0) {
        actor.ring.material.color.setRGB(AMBER[0], AMBER[1], AMBER[2]);
        actor.ring.material.opacity = 0.55;
      } else {
        actor.ring.material.color.setRGB(actor.rgb[0], actor.rgb[1], actor.rgb[2]);
        actor.ring.material.opacity = 0.6;
      }
      actor.ring.scale.setScalar(shooter ? 0.62 : isMe ? 1.35 : 1.15);

      // Scanning: a few slow motes rise from the site, and the scanner lights the ground.
      if (scanning && g.visible) {
        actor.sparkT -= dt;
        const s = nearestSite(actor.x, actor.z);
        if (s && actor.sparkT <= 0) {
          actor.sparkT = reduced ? 0.5 : 0.16;
          const col = rgb(SITE_COLORS[s.siteKind] || '#fff');
          const ang = Math.random() * 6.28;
          const rr = Math.random() * 1.6;
          particles.glow.emit(s.x + Math.cos(ang) * rr, world.height(s.x, s.z) + 0.3, s.z + Math.sin(ang) * rr, 0, 0.9 + Math.random() * 0.6, 0, 0, 1.5, 0.16, 0, col[0], col[1], col[2], 0.7);
        }
        lamps.add(actor.x + Math.cos(h) * 1.2, y + 0.8, actor.z + Math.sin(h) * 1.2, 4, 0.25, 0.55, 0.6);
      }

      // Helmet lamp: a cone of light where they look, night and storms only.
      const lampK = Math.max(beamOn, stormK * 0.7);
      const lampOn = g.visible && lampK > 0 && !(cinema && cinema.mode === 'landing');
      actor.beam.visible = lampOn;
      if (lampOn) {
        const dx = Math.cos(h);
        const dz = Math.sin(h);
        actor.beam.position.set(actor.x + dx * 0.25, y + 1.62, actor.z + dz * 0.25);
        actor.beam.rotation.set(1.2, Math.atan2(dx, dz), 0);
        actor.beamMat.uniforms.uOpacity.value = 0.3 * lampK;
        actor.beamMat.uniforms.uTime.value = t;
        const beamK = shooter ? 0.5 : 1;
        lamps.add(actor.x, y + 1.7, actor.z, 18, 2.4 * lampK * beamK, 2.2 * lampK * beamK, 1.8 * lampK * beamK, [dx * 0.88, -0.47, dz * 0.88], 9);
        lamps.add(actor.x, y + 1.5, actor.z, 5.5, actor.rgb[0] * 0.4, actor.rgb[1] * 0.4, actor.rgb[2] * 0.4);
      }

      // Footstep dust.
      actor.dustT -= dt;
      if (moving && actor.dustT <= 0 && !cfg.platform && y > -5) {
        actor.dustT = reduced ? 0.4 : 0.14;
        particles.dust.emit(actor.x, y + 0.08, actor.z, (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2, cfg.gravity * 0.2, 0.8, 0.5, 1, cfg.dust[0], cfg.dust[1], cfg.dust[2], 0.5);
      }
    }
  }

  function nearestSite(x, z) {
    let best = null;
    let bd = 8;
    for (const entry of site.values()) {
      const d = Math.hypot(entry.e.x - x, entry.e.z - z);
      if (d < bd) {
        bd = d;
        best = entry.e;
      }
    }
    return best;
  }

  function updateProps(dt, t, a) {
    for (const entry of site.values()) {
      const e = entry.e;
      const prog = e.done ? 1 : e.scanned || 0;
      entry.obj.setState(e.state, e.revealed !== false, !!e.done, prog, t);
      if (e.revealed !== false && !e.done && e.state !== 'blocked') {
        const c = rgb(SITE_COLORS[e.siteKind] || '#fff');
        lamps.add(e.x, 2.5, e.z, 9, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6);
      }
    }
    for (const entry of samples.values()) {
      const e = entry.e;
      let x = e.x;
      let z = e.z;
      let y = world.height(x, z) + 0.02;
      const carrier = e.heldBy ? crew.get(e.heldBy) : null;
      if (carrier) {
        x = carrier.x;
        z = carrier.z;
        y = world.height(x, z) + 1.5;
      }
      entry.obj.group.position.set(x, y, z);
      entry.obj.halo.material.opacity = e.heldBy ? 0 : 0.45;
      entry.obj.group.rotation.y = t * 0.4;
    }
    for (const entry of pickups.values()) entry.obj.update(t);
    for (const entry of boulders.values()) {
      const e = entry.e;
      const d = display.get(e.id);
      const x = d ? d.px + (d.x - d.px) * a : e.x;
      const z = d ? d.pz + (d.z - d.pz) * a : e.z;
      entry.obj.position.set(x, world.height(x, z) + 0.9, z);
      entry.obj.scale.setScalar(1.1);
    }
  }

  function updateBase(dt, t, night) {
    const B = current.base;
    const L = state0.map.lander;
    if (!cinema || cinema.mode !== 'landing') landerObj.group.position.set(L.x, world.height(L.x, L.z), L.z);
    // Floodlights fade in and out; a base short of power simply goes dim, it never flickers.
    baseGlow = damp(baseGlow, B.lightsOn && !B.dark ? 1 : 0, 2, dt);
    const flood = baseGlow * smoothstep(0.08, 0.5, night);
    // At eye level the cones would fill the screen: they stay faint there.
    landerObj.setFlood(flood * (shooter ? 0.25 : 1), t);
    landerObj.lampSpots.forEach((spot) => {
      // At eye level the ground is right there: floodlights that read from above blow out.
      const fl = flood * (shooter ? 0.3 : 1);
      if (fl > 0.003) lamps.add(L.x + spot.x, 5, L.z + spot.z, (B.lightR || 19) * 1.15, 3.2 * fl, 2.8 * fl, 2.1 * fl);
    });
    // The windows stay warm while the cabin heaters run.
    if (B.heatOn || !night) lamps.add(L.x, 4.6, L.z + 2.2, 5, 0.6, 0.45, 0.25);
    const dish = current.entities.find((e) => e.kind === 'dish');
    if (dish) {
      if (!dishObj) {
        dishObj = makeDish(lamps);
        scene.add(dishObj.group);
      }
      dishObj.group.position.set(dish.x, world.height(dish.x, dish.z), dish.z);
      dishObj.group.visible = !(cinema && cinema.mode === 'landing');
      // Unplanted, the dish waits folded on its pad: a clear thing to walk to.
      dishObj.setState(dish.state, t, clamp(dish.align == null ? 1 : dish.align), 1);
      if (dish.state === 'transmit') lamps.add(dish.x, 3, dish.z, 12, 0.45, 0.85, 1.3);
    }
    // Radiation shelter: during a spike the lander's shielded zone shows as a soft dome.
    const wantShelter = B.shelter && !(cinema && cinema.mode === 'landing') ? 1 : 0;
    shelterK = damp(shelterK, wantShelter, 2.5, dt);
    landerObj.setShield(shelterK > 0.02, B.shieldR || 11, t, 0);
    if (shelterK > 0.02) landerObj.shieldMat.uniforms.uOn.value = shelterK * 0.55;
  }

  function updateHazards(dt, t) {
    const list = current.hazards || [];
    const seen = new Set();
    for (const h of list) {
      // Only falling rocks get a mark on the ground; storms and spikes are everywhere at once.
      if (h.kind !== 'rockfall') continue;
      seen.add(h.id);
      let o = hazardDecals.get(h.id);
      if (!o) {
        // Flat discs would slice through the terrain's bumps: draw them over it.
        const ring = new THREE.Mesh(markRing, haloMaterial(0xffc070, 0.7));
        const fill = new THREE.Mesh(markFill, haloMaterial(0xffc070, 0.1));
        ring.material.depthTest = fill.material.depthTest = false;
        ring.renderOrder = fill.renderOrder = 1;
        ring.userData.noAO = fill.userData.noAO = true;
        ring.position.y = fill.position.y = 0.1;
        scene.add(ring, fill);
        o = { ring, fill, start: h.tLeft || 2 };
        hazardDecals.set(h.id, o);
      }
      // A steady ring, and a disc that fills in as the rock comes down: when it is full, it lands.
      const r = h.r || 3;
      const k = clamp(1 - (h.tLeft || 0) / Math.max(0.5, o.start));
      o.ring.position.x = o.fill.position.x = h.x;
      o.ring.position.z = o.fill.position.z = h.z;
      o.ring.scale.setScalar(r);
      o.fill.scale.setScalar(Math.max(0.05, r * k));
      o.fill.material.opacity = 0.12 + 0.18 * k;
    }
    for (const [id, o] of hazardDecals) {
      if (seen.has(id)) continue;
      scene.remove(o.ring, o.fill);
      o.ring.material.dispose();
      o.fill.material.dispose();
      hazardDecals.delete(id);
    }
    // Pings: a quiet ring where the planner pointed.
    const ids = new Set();
    for (const p of current.pings || []) {
      ids.add(p.id);
      let m = pings.get(p.id);
      if (!m) {
        m = new THREE.Mesh(pingGeo, haloMaterial(0xffffff, 0.6));
        m.userData.noAO = true;
        m.position.y = 0.12;
        scene.add(m);
        pings.set(p.id, m);
      }
      m.position.x = p.x;
      m.position.z = p.z;
      m.material.opacity = Math.min(1, p.tLeft) * 0.6;
    }
    for (const [id, m] of pings) {
      if (ids.has(id)) continue;
      scene.remove(m);
      m.material.dispose();
      pings.delete(id);
    }
    // Lander faults (the engineer's job): a steady amber ring and a soft beam on the hull.
    const fseen = new Set();
    for (const f of current.faults || []) {
      const key = f.kind;
      fseen.add(key);
      let o = faults.get(key);
      if (!o) {
        const ring = new THREE.Mesh(markRing, haloMaterial(0xffb347, 0.75));
        ring.userData.noAO = true;
        ring.renderOrder = 4;
        const fill = new THREE.Mesh(markFill, haloMaterial(0xffb347, 0.18));
        fill.userData.noAO = true;
        fill.renderOrder = 4;
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.5, 7, 12, 1, true).translate(0, 3.5, 0), beamMaterial(0xffb347, { opacity: 0.55, fade: 1.1 }));
        beam.userData.noAO = true;
        scene.add(ring, fill, beam);
        o = { ring, fill, beam };
        faults.set(key, o);
      }
      const y = world.height(f.x, f.z) + 0.1;
      o.ring.position.set(f.x, y, f.z);
      o.fill.position.set(f.x, y + 0.01, f.z);
      o.beam.position.set(f.x, y, f.z);
      o.ring.scale.setScalar(2.4);
      o.fill.scale.setScalar(Math.max(0.05, 2.4 * clamp(f.fixT || 0)));
    }
    for (const [key, o] of faults) {
      if (fseen.has(key)) continue;
      scene.remove(o.ring, o.fill, o.beam);
      o.ring.material.dispose();
      o.fill.material.dispose();
      o.beam.material.dispose();
      o.beam.geometry.dispose();
      faults.delete(key);
    }
  }

  function updateCinematics(dt, t) {
    const L = state0.map.lander;
    const flameD = descentFlame.material;
    flameD.uniforms.uTime.value = t;
    if (cinema && cinema.mode === 'landing') {
      const k = cinema.k;
      const alt = altitudeAt(k);
      const info = cinema.info || {};
      const dx = (info.driftX || 0) * (1 - k);
      const dz = (info.driftZ || 0) * (1 - k);
      const y = world.height(L.x, L.z) + alt;
      landerObj.group.position.set(L.x + dx, y, L.z + dz);
      const thrust = 0.75 + 0.08 * Math.sin(t * 9) + smoothstep(0.5, 0.95, k) * 0.3;
      const done = k >= 1;
      flameD.uniforms.uOpacity.value = done ? 0 : 0.85 * thrust;
      descentFlame.scale.set(1, 0.6 + smoothstep(0.4, 1, k) * 0.7, 1);
      if (!done) lamps.add(L.x + dx, y + 0.5, L.z + dz, 34, 3.2 * thrust, 2.0 * thrust, 0.8 * thrust);
      landingRing.visible = !done;
      landingRing.position.set(L.x, world.height(L.x, L.z) + 0.12, L.z);
      landingRing.scale.setScalar(info.radius || 12);
      landingRing.material.opacity = 0.7 * (1 - smoothstep(0.8, 1, k));
      if (alt < 34 && !done && Math.random() < dt * 140 * (1 - alt / 40) * (q.particles || 1)) {
        const a = Math.random() * 6.28;
        const s = 8 + Math.random() * 18 + (34 - alt) * 0.4;
        const gy = world.height(L.x, L.z);
        particles.dust.emit(L.x + Math.cos(a), gy + 0.3, L.z + Math.sin(a), Math.cos(a) * s, 0.6 + Math.random() * 1.2, Math.sin(a) * s, cfg.gravity * 0.05, 1.6, 2.4 + Math.random() * 2, 1, cfg.dust[0], cfg.dust[1], cfg.dust[2], 0.7);
      }
      if (k >= 1 && !cinema.thumped) {
        cinema.thumped = true;
        addShake(0.5);
        dustBurst(L.x, L.z, 50, 14, 2.5, 1.8, 2.6);
      }
    } else {
      flameD.uniforms.uOpacity.value = 0;
      landingRing.visible = false;
    }
    if (cinema && cinema.mode === 'launch') {
      const k = cinema.k;
      const rise = Math.pow(Math.max(0, k - 0.04), 2.3) * 300;
      landerObj.ascent.position.y = rise;
      const mat = landerObj.flameMat;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uOpacity.value = k < 0.02 ? 0 : 1.0;
      const on = 0.9 + 0.06 * Math.sin(t * 10);
      lamps.add(L.x, 4 + rise * 0.6, L.z, 60, 3.8 * on, 2.4 * on, 0.9 * on);
      if (k < 0.4 && Math.random() < dt * 160 * (q.particles || 1)) {
        const a = Math.random() * 6.28;
        const s = 14 + Math.random() * 22;
        particles.dust.emit(L.x, world.height(L.x, L.z) + 0.3, L.z, Math.cos(a) * s, 1 + Math.random(), Math.sin(a) * s, cfg.gravity * 0.05, 1.4, 2.5 + Math.random() * 2, 1, cfg.dust[0], cfg.dust[1], cfg.dust[2], 0.65);
      }
      shake = Math.max(shake, 0.3 * (1 - smoothstep(0.4, 1, k)));
    }
  }

  // ---------- The loop ----------
  function update(dtIn, t) {
    const dt = Math.min(dtIn, 0.05);
    timeNow = t;
    const now = performance.now() / 1000;
    const a = alpha(now);
    const night = 1 - smoothstep(0.08, 0.72, (lightSmooth = damp(lightSmooth, current.sun ? clamp(current.sun.light) : 1, 1.2, dt)));
    let storm = 0;
    for (const h of current.hazards || []) if ((h.kind === 'storm' || h.kind === 'acid') && h.state === 'active') storm = 1;
    // Storms roll in and out over a few seconds.
    stormK = damp(stormK, storm, 0.6, dt);

    if (!shooter || cinema) updateCamera(dt, t);
    const sunK = cfg.sun.intensity * (1 - night) + cfg.sun.nightIntensity * night;
    sun.intensity = sunK * (1 - stormK * 0.5);
    hemi.intensity = lerp(cfg.ambient.day, cfg.ambient.night, night);
    if (scene.fog && fogDay) {
      scene.fog.color.lerpColors(fogDay, fogNight, night);
      // Dust closes the view in; it never hides the ground at your feet.
      scene.fog.density = fogBase * (1 + stormK * 2.2);
    }

    lamps.begin();
    updateCrew(dt, t, a, night);
    updateProps(dt, t, a);
    updateBase(dt, t, night);
    updateHazards(dt, t);
    updateCinematics(dt, t);
    if (shooter && !cinema) shooter.frame(dt, t, current);
    if (horizon && shooter) {
      horizon.update(t, night, stormK, camera, camera.position.x, camera.position.z);
      world.updateRockLOD(camera.position.x, camera.position.z);
    }
    // Short-lived, soft light pulses.
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.t += dt;
      if (f.t >= f.life) {
        flashes.splice(i, 1);
        continue;
      }
      const k = Math.sin((f.t / f.life) * Math.PI);
      lamps.add(f.x, f.y, f.z, f.radius, f.r * k, f.g * k, f.b * k);
    }
    lamps.end();

    particles.glow.update(t, camera, viewH);
    particles.dust.update(t, camera, viewH);
    decals.update(t);
    world.update(dt, t, night, stormK, camera, aspect);
    const post = getPost();
    if (post) post.set({ fade: api.fade != null ? api.fade : 0, fadeColor: api.fadeColor != null ? api.fadeColor : 0xffffff });
  }

  function onResize(w, h) {
    aspect = w / Math.max(1, h);
    viewH = h * (engineProfile ? engineProfile().pixelRatio || 1 : 1);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  const api = {
    scene,
    camera,
    shadows: true,
    exposure: cfg.exposure,
    post: cfg.post,
    fade: 0,
    fadeColor: 0xffffff,
    get worldConfig() {
      return cfg;
    },
    get night() {
      return 1 - lightSmooth;
    },
    get storm() {
      return stormK;
    },
    get quality() {
      return q;
    },
    update,
    onResize,
    sync,
    setCameraTarget(t) {
      camTarget = t || { mode: 'group' };
      cam.ready = camTarget.mode === 'player' ? false : cam.ready;
    },
    cinematic(mode, k, info) {
      if (!mode) cinema = null;
      else if (cinema && cinema.mode === mode) {
        cinema.k = k;
        if (info) cinema.info = info;
      } else cinema = { mode, k, info };
    },
    // Kept for old callers: there is nothing to fire any more.
    localFire() {},
    // Client-side: what we predict for our own astronaut, overriding the snapshot.
    predictPosition(playerId, x, z, heading) {
      for (const actor of crew.values()) {
        if (actor.e.playerId !== playerId) continue;
        const d = display.get(actor.id);
        if (d) {
          d.px = d.x = x;
          d.pz = d.z = z;
        }
        if (heading != null) actor.e = Object.assign({}, actor.e, { heading });
      }
    },
    project(x, y, z) {
      // Behind the camera, projection flips the point; say so instead of lying.
      const behind = _w.set(x, y, z).applyMatrix4(camera.matrixWorldInverse).z > 0;
      _v.set(x, y, z).project(camera);
      const w = api.el ? api.el.clientWidth : 0;
      const h = api.el ? api.el.clientHeight : 0;
      return { x: ((_v.x + 1) / 2) * w, y: ((1 - _v.y) / 2) * h, onScreen: !behind && Math.abs(_v.x) <= 1 && _v.y <= 1 && _v.y >= -1 && _v.z < 1, ndcX: _v.x, ndcY: _v.y, behind };
    },
    // ---------- Eye-level views (surface3d-shooter.js) ----------
    get lamps() {
      return lamps;
    },
    get world() {
      return world;
    },
    setShooter(s) {
      shooter = s;
      world.setEyeLevel(!!s);
      if (s && !horizon) horizon = buildHorizon({ scene, worldId, cfg, map: state0.map, seed: state0.seed || 1, height: world.height, grit: world.grit, lamps });
      if (horizon) horizon.setVisible(!!s);
      for (const a of crew.values()) a.astro.group.scale.setScalar(s ? 1 : CREW_SCALE);
      if (!s) {
        camera.near = 2;
        camera.far = 1600;
        camera.fov = FOV;
        camera.updateProjectionMatrix();
        for (const a of crew.values()) a.bodyHidden = false;
        cam.ready = false;
      }
    },
    localActor(id) {
      for (const a of crew.values()) if (a.e.playerId === id) return a;
      return null;
    },
    setBodyHidden(id, hidden) {
      for (const a of crew.values()) if (a.e.playerId === id) a.bodyHidden = hidden;
    },
    cameraBlockers() {
      const L = state0.map.lander;
      return [{ x: L.x, z: L.z, r: 3.6, h: 9.5 }];
    },
    followView(x, z, span) {
      lamps.uniforms.uLampCamW.value.copy(camera.matrixWorld);
      lamps.setFocus(camera.position.x, camera.position.z);
      const sc = sun.shadow.camera;
      if (Math.abs(sc.right - span) > 1) {
        sc.left = -span;
        sc.right = span;
        sc.top = span;
        sc.bottom = -span;
        sc.updateProjectionMatrix();
      }
      sun.position.set(x + sunDir.x * 300, sunDir.y * 300, z + sunDir.z * 300);
      sun.target.position.set(x, 0, z);
    },
    crewScreen() {
      const out = [];
      for (const a of crew.values()) out.push({ id: a.id, x: a.x, z: a.z, e: a.e, color: a.color });
      return out;
    },
    groundHeight: world.height,
    get time() {
      return timeNow;
    },
    dispose() {
      world.dispose();
      particles.glow.dispose();
      particles.dust.dispose();
      decals.dispose();
      for (const actor of crew.values()) {
        actor.astro.dispose();
        actor.beam.geometry.dispose();
        actor.beam.material.dispose();
        actor.marker.geometry.dispose();
        actor.marker.material.dispose();
      }
      crew.clear();
    },
  };
  return api;
}
