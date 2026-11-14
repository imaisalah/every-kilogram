// Mission Sprint flight (docs/TEAM.md): the launch, the real orbit, and the ending.
//
// Everything is in real metres with a floating origin: the spacecraft stays at
// (0,0,0) and the planet moves around it, so a 4 m bus and a 6,000 km world share
// one scene with no jitter. view-flight.js owns the clock and the data; each
// frame it writes into `state` (below) and this file only draws what it is told.
import { THREE, studioEnv, getPost, supported } from '../3d/engine.js';
import { makePlanet, makeStars, makeSun, makeParticles, softDot } from '../3d/assets.js';
import { buildCraft, setDeploy } from '../3d/craft.js';
import { ROCKET_LOOKS, rocketMesh, rocketPlume, setRocketPlume } from '../3d/films.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sat = (x) => clamp(x, 0, 1);
const smooth = (a, b, x) => {
  const k = sat((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// Calm (docs/TEAM-V2.md): camera shake is a nudge, never a jolt.
const CALM_SHAKE = 0.3;

export const BODIES = {
  earth: { R: 6.371e6, atmo: true },
  moon: { R: 1.737e6, atmo: false },
  mars: { R: 3.39e6, atmo: true },
  venus: { R: 6.052e6, atmo: true },
  europa: { R: 1.561e6, atmo: false },
  jupiter: { R: 6.99e7, atmo: true },
};

// How long the launch film runs (the view waits for it). Short and loud.
export const LAUNCH_SECONDS = 8.4;
export const LAUNCH_SECONDS_REDUCED = 4;
export const LANDING_SECONDS = 6.5;

// Which rocket a design flies on: real launcher ids vary, so match on the word.
function lookFor(id) {
  const s = String(id || '').toLowerCase();
  if (ROCKET_LOOKS[s]) return ROCKET_LOOKS[s];
  if (/super|sls|starship/.test(s)) return ROCKET_LOOKS.superheavy;
  if (/heavy|falcon.?h|delta.?iv|vulcan/.test(s)) return ROCKET_LOOKS.heavy;
  if (/light|electron|small|rocketlab/.test(s)) return ROCKET_LOOKS.light;
  return ROCKET_LOOKS.medium;
}

// Soft, glowing shapes used for flashes, markers and the sun's halo.
function glowSprite(color, opacity = 1, attenuate = true) {
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: attenuate }));
}

// The downlink: a tapering cone with packets of light running down it.
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uTime: { value: 0 }, uRate: { value: 1 }, uC: { value: new THREE.Color(0x63e6ff) } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vY = uv.y;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform float uK; uniform float uTime; uniform float uRate; uniform vec3 uC;
      varying float vY; varying vec3 vN; varying vec3 vV;
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
        float pulse = pow(0.5 + 0.5 * sin((vY * 42.0 + uTime * uRate * 26.0)), 6.0);
        float a = rim * uK * (0.16 + 1.15 * pulse) * (1.0 - 0.6 * vY) * smoothstep(0.0, 0.03, 1.0 - vY);
        gl_FragColor = vec4(uC * (1.0 + pulse * 1.6), clamp(a, 0.0, 1.0));
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

// A tiny crew lander (the sponsor's, per docs/TEAM.md): only ever seen leaving.
function makeLander() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xc79a34, metalness: 0.8, roughness: 0.35, emissive: 0x201202 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe9eef2, metalness: 0.1, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.5 });
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.6, 2.2, 8), gold);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.7, 2, 12), white);
  cab.position.y = 2.1;
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.1, 12), white);
  top.position.y = 3.6;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 1.1, 1.3, 16, 1, true), dark);
  nozzle.position.y = -1.7;
  g.add(stage, cab, top, nozzle);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + TAU / 8;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.2, 6), dark);
    leg.position.set(Math.cos(a) * 3.2, -1.7, Math.sin(a) * 3.2);
    leg.lookAt(Math.cos(a) * 6, -3.8, Math.sin(a) * 6);
    leg.rotateX(Math.PI / 2);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 10), dark);
    foot.position.set(Math.cos(a) * 4.6, -3.5, Math.sin(a) * 4.6);
    g.add(leg, foot);
  }
  return g;
}

// opts: { body, altKm, inclDeg, craft, info:{dryKg,propKg}, launcher, deep, lands, reduced, low }
export function createFlight(opts) {
  const body = BODIES[opts.body] ? opts.body : 'earth';
  const B = BODIES[body];
  const R = B.R;
  const alt = Math.max(30e3, (opts.altKm || 600) * 1000);
  const rOrbit = R + alt;
  const reduced = !!opts.reduced;
  const low = !!opts.low;
  const deep = !!opts.deep; // the launch leaves Earth for somewhere else

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.25, 6e10);
  let aspect = 1.6;

  // ---------- What the view tells us each frame ----------
  const state = {
    mode: 'launch', // launch | orbit | landing | end
    launchT: 0,
    phase: 0, // the slow apparent orbit used by the close-ups (radians, PI = mid eclipse)
    fastPhase: 0, // the sim's true orbit, shown in the wide shot
    sunlitNow: true, // the sim's sunlit flag this frame
    sun: 1, // 1 in sunlight, 0 in shadow (smoothed here)
    link: 0, // downlink strength 0..1
    stationPhase: 0, // orbit angle of the station being talked to
    spill: 0, // 0..1 how hard data is overflowing
    alarm: 0, // 0..1 crisis on
    fuel: 1,
    landT: 0,
    end: null, // { kind: 'success'|'tumble'|'breakup'|'burnup', t }
  };

  // ---------- Sun and sky ----------
  const S = v3(0.8, 0.16, 0.58).normalize(); // the Sun, seen from the planet
  const N = v3().crossVectors(S, v3(0.1, 1, -0.24)).normalize(); // orbit plane holds the Sun: longest eclipse
  const Vaxis = v3().crossVectors(N, S).normalize();
  const sun = new THREE.DirectionalLight(0xfff4e2, 2.7);
  sun.position.copy(S).multiplyScalar(1000);
  scene.add(sun, sun.target);
  const fill = new THREE.HemisphereLight(0x6c86c2, 0x3a3226, 0.32);
  scene.add(fill);
  const stars = makeStars(low ? 2000 : 3800, 2.2e9);
  stars.material.transparent = true;
  stars.renderOrder = -2;
  scene.add(stars);
  const sunSprite = makeSun(9e8);
  sunSprite.position.copy(S).multiplyScalar(1.6e10);
  scene.add(sunSprite);

  // ---------- The destination ----------
  const world = new THREE.Group();
  scene.add(world);
  const planet = makePlanet(body, R, { segments: low ? 96 : 192, glow: true });
  world.add(planet);
  let backdrop = null;
  if (body === 'europa') {
    // Europa orbits Jupiter: the giant hangs in its sky.
    backdrop = makePlanet('jupiter', BODIES.jupiter.R, { segments: 96 });
    backdrop.position.set(-4.4e8, 2.1e8, -4.5e8);
    world.add(backdrop);
  }
  // Orbit line, sunlit part and shadow part, and the shadow itself.
  const orbitG = new THREE.Group();
  world.add(orbitG);
  const beta = Math.asin(R / rOrbit);
  const arc = (from, to, color, op) => {
    const pts = [];
    const n = 128;
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n;
      pts.push(S.clone().multiplyScalar(Math.cos(a) * rOrbit).addScaledVector(Vaxis, Math.sin(a) * rOrbit));
    }
    const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.frustumCulled = false;
    orbitG.add(m);
    return m;
  };
  arc(-(Math.PI - beta), Math.PI - beta, 0x8fe6ff, 0.75);
  arc(Math.PI - beta, Math.PI + beta, 0xffa040, 0.95);
  const shadow = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.002, R * 1.002, rOrbit * 3.2, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x4a3fb8, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  shadow.quaternion.setFromUnitVectors(v3(0, 1, 0), S.clone().negate());
  shadow.position.copy(S).multiplyScalar(-rOrbit * 1.6);
  orbitG.add(shadow);

  // A marker so the craft reads in the wide shot; station and Earth dots.
  const marker = glowSprite(0xffffff, 0.9, false);
  marker.scale.setScalar(0.05);
  scene.add(marker);
  const station = glowSprite(0x63e6ff, 1, false);
  station.scale.setScalar(0.028);
  world.add(station);
  const earthDot = glowSprite(0x7ab7ff, 1, false);
  earthDot.scale.setScalar(0.024);
  earthDot.visible = deep && body !== 'earth';
  const earthDir = S.clone().multiplyScalar(-0.42).add(v3(0.3, 0.86, -0.1)).normalize();
  earthDot.position.copy(earthDir).multiplyScalar(5e9);
  scene.add(earthDot);

  // ---------- The spacecraft, built from the team's real parts ----------
  const craft = buildCraft(opts.craft || { arrays: 8, dish: 1, instruments: ['hires'] }, opts.info || {});
  const size = craft.userData.size || 6;
  setDeploy(craft, 1);
  // Own copies of the shared materials so the shadow can dim them for this craft only.
  const matCopies = new Map();
  craft.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      if (!matCopies.has(m)) {
        const c = m.clone();
        c.envMapIntensity = 0.7;
        matCopies.set(m, c);
      }
      return matCopies.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    o.castShadow = o.receiveShadow = false;
  });
  const mats = [...matCopies.values()].filter((m) => m.color);
  const baseColors = mats.map((m) => m.color.clone());
  scene.add(craft);
  const parts = craft.userData.parts || {};
  const arrays = ['arrayL', 'arrayR'].map((k) => parts[k]).filter(Boolean);
  if (craft.userData.crew) for (let i = 0; i < 4; i++) if (parts['wing' + i]) arrays.push(parts['wing' + i]);
  const dishG = parts.dish ? parts.dish.children[0] : null;

  // A small red status light: visible in eclipse, flatlines at the end.
  const led = glowSprite(0xff3355, 0, true);
  led.scale.setScalar(size * 0.09);
  led.position.set(0, (size * 0.12), size * 0.36);
  craft.add(led);
  const alarmLight = new THREE.PointLight(0xff2244, 0, 0, 2);
  alarmLight.position.set(size * 0.6, size * 0.7, size * 0.6);
  scene.add(alarmLight);

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.012, 1, 20, 1, true).translate(0, 0.5, 0).rotateX(0), beamMaterial());
  beam.frustumCulled = false;
  beam.visible = false;
  scene.add(beam);

  const spill = makeParticles(300, { size: size * 0.05 });
  spill.points.renderOrder = 3;
  scene.add(spill.points);
  const showers = makeParticles(900, { size: size * 0.05 });
  scene.add(showers.points);
  // Sparks for a break-up, from where the craft was.
  const flash = glowSprite(0xffffff, 0, false);
  flash.scale.setScalar(0.7);
  scene.add(flash);

  // ---------- The launch set: pad, rocket, sky ----------
  const look = lookFor(opts.launcher);
  const launchG = new THREE.Group();
  scene.add(launchG);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uHigh: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `varying vec3 vP;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform float uHigh; uniform float uFade; varying vec3 vP;
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        float h = clamp(vP.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 a = mix(vec3(0.95,0.56,0.34), vec3(0.32,0.28,0.5), smoothstep(0.5,0.58,h));
        a = mix(a, vec3(0.05,0.09,0.24), smoothstep(0.56,0.86,h));
        a = mix(a, vec3(0.012,0.02,0.05), smoothstep(0.4,1.0,uHigh));
        float ground = smoothstep(0.5,0.47,h);
        a = mix(a, vec3(0.02,0.022,0.04), ground * (1.0 - uHigh));
        gl_FragColor = vec4(a * uFade, 1.0); }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8e4, 32, 24), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -3;
  launchG.add(sky);

  const rocket = rocketMesh(look, '');
  const L = rocket.userData.length;
  const flame = rocketPlume(look, true);
  flame.visible = false;
  rocket.add(flame);
  const vacFlame = rocketPlume(look, false);
  vacFlame.visible = false;
  vacFlame.position.y = -2.0;
  rocket.userData.s2.add(vacFlame);
  launchG.add(rocket);

  const padG = new THREE.Group();
  launchG.add(padG);
  const concrete = new THREE.MeshStandardMaterial({ color: 0x6b6c6a, roughness: 0.95 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(look.r * 12, look.r * 14, 3, 32), concrete);
  pad.position.y = -1.5;
  padG.add(pad);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4000, 32), new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.9;
  padG.add(ground);
  const steel = new THREE.MeshStandardMaterial({ color: 0x7a3528, roughness: 0.65, metalness: 0.35 });
  const tH = L * 1.05;
  const tw = Math.max(2.4, look.r * 1.7);
  const towerX = -look.r * 6;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, tH, 0.4), steel);
    p.position.set(towerX + (a * tw) / 2, tH / 2, (b * tw) / 2);
    padG.add(p);
  });
  for (let y = 3; y < tH; y += 3.4) {
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.24, 0.24), steel);
    r1.position.set(towerX, y, tw / 2);
    const r2 = r1.clone();
    r2.position.z = -tw / 2;
    padG.add(r1, r2);
  }
  // Floodlights, the only stars at the pad.
  const floods = [[-L * 0.9, L * 0.7, L * 0.8], [L * 1.0, L * 0.5, L * 0.7], [-L * 0.3, L * 0.9, -L * 0.9]];
  floods.forEach((p) => {
    const f = glowSprite(0xd8e6ff, 0.9);
    f.position.set(...p);
    f.scale.setScalar(L * 0.18);
    padG.add(f);
  });
  // Lit from a floodlight so the rocket is easy to see before ignition.
  const padLight = new THREE.DirectionalLight(0xdfe6ff, 2.1);
  padLight.position.set(L, L * 1.2, L * 0.9);
  padG.add(padLight);
  padG.add(padLight.target);
  const smoke = makeParticles(700, { size: L * 0.14, additive: false });
  launchG.add(smoke.points);
  // The Earth under the top of the climb, once the rocket is out of the air.
  let earth = null;
  if (body === 'earth') earth = planet;
  else {
    earth = makePlanet('earth', BODIES.earth.R, { segments: low ? 64 : 128, res: 512 });
    earth.visible = false;
    scene.add(earth);
  }

  // ---------- Lander (only when the crew goes down) ----------
  let lander = null;
  let lFlame = null;
  let entryGlow = null;
  if (opts.lands) {
    lander = makeLander();
    lander.visible = false;
    scene.add(lander);
    lFlame = rocketPlume({ cores: 0, r: 1.2, s1: 12, s2: 4, fair: 2 }, false);
    lFlame.position.y = -2.3;
    lFlame.visible = false;
    lander.add(lFlame);
    entryGlow = glowSprite(0xff8a3a, 0);
    entryGlow.scale.setScalar(26);
    entryGlow.position.y = -4;
    lander.add(entryGlow);
  }

  // Metals reflect a little studio light; the planet ignores it.
  studioEnv().then((t) => t && (scene.environment = t)).catch(() => {});

  // ---------- Frame basis, reused every frame ----------
  const P = v3(); // up, away from the planet
  const V = v3(); // along the orbit
  const cw = v3(); // the craft's position relative to the planet centre
  const tmp = v3();
  const tmp2 = v3();
  const q = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const shake = { k: 0 };
  let clock = 0;
  let shot = { kind: 'hero', t: 0, n: 0 };
  let wasLink = false;
  let wasAlarm = false;
  let forced = null;
  const dirBeam = v3(0, 1, 0);

  const nextShot = (kind) => {
    shot = { kind, t: 0, n: shot.n + 1 };
    const post = getPost();
    if (post && post.set) post.set({ fade: 0.0 });
  };
  const shots = reduced ? ['hero', 'wide'] : ['hero', 'wide', 'limb', 'under', 'hero', 'top', 'wide', 'limb'];

  const fit = () => (aspect < 1 ? 1.75 / aspect : aspect < 1.4 ? 1.3 : 1);

  function pose() {
    const a = shot.kind === 'wide' ? state.fastPhase : state.phase;
    cw.copy(S).multiplyScalar(Math.cos(a) * rOrbit).addScaledVector(Vaxis, Math.sin(a) * rOrbit);
    P.copy(cw).normalize();
    V.copy(Vaxis).multiplyScalar(Math.cos(a)).addScaledVector(S, -Math.sin(a)).normalize();
    world.position.copy(cw).negate();
    // Craft axes: -Z looks at the ground, +Y flies forward.
    tmp.crossVectors(V, P).normalize();
    m4.makeBasis(tmp, V, P);
    craft.quaternion.setFromRotationMatrix(m4);
    // Planets turn, slowly: time is compressed, so a true rate would look like a blender.
    planet.rotation.y = clock * 0.012;
  }

  // Sun-tracking wings: panel faces are +Y; turn each about X until they face the Sun.
  function pointArrays(dt) {
    if (!arrays.length) return;
    tmp.copy(S).applyQuaternion(tmp2Quat(craft.quaternion));
    const want = Math.atan2(tmp.z, tmp.y);
    arrays.forEach((h) => {
      const k = 1 - Math.exp(-dt * 3);
      let d = want - h.rotation.x;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      h.rotation.x += d * k;
    });
  }
  const invQ = new THREE.Quaternion();
  function tmp2Quat(cq) {
    return invQ.copy(cq).invert();
  }

  function aimDish(dt) {
    if (!dishG) return;
    const off = state.link > 0.01;
    let want = v3(0, 1, 0);
    if (off) {
      want = dirBeam.clone().applyQuaternion(invQ.copy(craft.quaternion).invert());
      const c = clamp(want.y, -0.5, 1);
      if (want.y < c) want.y = c;
      want.normalize();
    }
    q.setFromUnitVectors(v3(0, 1, 0), want);
    dishG.quaternion.slerp(q, 1 - Math.exp(-dt * 4));
  }

  function updateBeam(dt) {
    const on = state.link > 0.01 && !state.end;
    beam.visible = on;
    station.material.opacity = on ? Math.min(1, state.link * 2) : 0;
    if (!on) return;
    let target;
    if (deep && body !== 'earth') {
      target = tmp.copy(earthDir).multiplyScalar(5e9);
    } else {
      const a = state.stationPhase;
      station.position.copy(S).multiplyScalar(Math.cos(a) * R).addScaledVector(Vaxis, Math.sin(a) * R);
      target = tmp.copy(station.position).add(world.position);
    }
    const origin = tmp2.set(0, 0, 0);
    if (dishG) dishG.getWorldPosition(origin);
    dirBeam.copy(target).sub(origin).normalize();
    const dist = Math.min(target.distanceTo(origin), 4e9);
    // A pencil to Earth; a wider wedge down to a nearby ground station.
    const foot = deep && body !== 'earth' ? size * 2.2 : dist * 0.05;
    beam.position.copy(origin);
    q.setFromUnitVectors(v3(0, 1, 0), dirBeam);
    beam.quaternion.copy(q);
    beam.scale.set(foot, dist, foot);
    const u = beam.material.uniforms;
    u.uK.value = Math.min(1, state.link * 1.4);
    u.uRate.value = 0.5 + state.link * 2;
    u.uTime.value = clock;
  }

  // Sky-glow: planets stay lit by the Sun, but the craft goes dark in shadow.
  let sunK = 1;
  function lightCraft(dt) {
    const k = state.end && state.end.kind !== 'success' ? Math.max(0, 1 - state.end.t * 0.5) : 1;
    // Close-ups follow the slow orbit's own shadow crossing; the wide shot the sim's flag.
    const inShadow = shot.kind === 'wide' ? !state.sunlitNow : Math.cos(state.phase - Math.PI) > Math.cos(beta) * 0.99;
    const targetSun = inShadow ? 0 : 1;
    sunK += (targetSun - sunK) * (1 - Math.exp(-dt * 7));
    state.sun = sunK;
    const lit = 0.03 + 0.97 * sunK;
    const v = lit * k;
    mats.forEach((m, i) => {
      m.color.copy(baseColors[i]).multiplyScalar(0.05 + 0.95 * v);
      m.envMapIntensity = 0.7 * v;
    });
    const eclipse = 1 - sunK;
    const blink = 0.5 + 0.5 * Math.sin(clock * 1.6); // a slow breath, not a flash
    let on = eclipse > 0.2 ? 0.35 + blink * 0.65 : 0;
    if (state.alarm > 0) on = Math.max(on, 0.85); // steady while a problem is open
    if (state.end && state.end.kind !== 'success') on = Math.max(0, 1 - state.end.t * 0.35) * (state.end.t < 2 ? 1 : 0);
    led.material.opacity = on;
    led.material.color.setHex(state.alarm > 0 ? 0xff2244 : 0xff9a3a);
    alarmLight.intensity = state.alarm > 0 && !state.end ? 9 * size * size : 0;
  }

  function direct(dt) {
    shot.t += dt;
    if (forced) return;
    const linkNow = state.link > 0.02;
    const alarmNow = state.alarm > 0;
    const dur = reduced ? 16 : 11; // long, quiet shots
    if (state.end) {
      if (shot.kind !== 'hero' && shot.kind !== 'wide' && state.end.t < 0.1) nextShot('hero');
    } else if (alarmNow && !wasAlarm && !reduced) {
      nextShot('hero');
    } else if (linkNow && !wasLink && shot.t > 2.5 && !reduced) {
      nextShot('beam');
    } else if (shot.t > (shot.kind === 'beam' ? 4.5 : dur)) {
      const k = shots[(shot.n + 1) % shots.length];
      nextShot(k);
    }
    wasLink = linkNow;
    wasAlarm = alarmNow;
  }

  function aimCamera(dt) {
    const t = shot.t;
    const d = size * 1.15 * fit();
    const pull = state.end && state.end.kind !== 'success' ? 1 + Math.min(6, state.end.t * 0.6) : 1;
    const drift = reduced ? 0 : t;
    camera.up.copy(P);
    let target = tmp.set(0, 0, 0);
    switch (shot.kind) {
      case 'wide': {
        const dc = Math.max(R * 3.2, rOrbit * 1.7) * fit();
        const a = 0.55 + drift * 0.015;
        const cdir = tmp2.copy(S).multiplyScalar(Math.cos(a) * 0.72).addScaledVector(Vaxis, -Math.sin(a) * 0.72).addScaledVector(N, 0.32).normalize();
        camera.position.copy(world.position).addScaledVector(cdir, dc);
        camera.up.copy(N).negate();
        target = tmp.copy(world.position);
        break;
      }
      case 'beam': {
        tmp2.copy(dirBeam);
        camera.position.copy(tmp2).multiplyScalar(-d * (1.4 + drift * 0.02)).addScaledVector(P, d * 0.5).addScaledVector(N, d * 0.32);
        target = tmp.copy(tmp2).multiplyScalar(size * 3).addScaledVector(P, -size * 0.2);
        break;
      }
      case 'limb':
        camera.position.copy(V).multiplyScalar(d * (1.5 - drift * 0.01)).addScaledVector(N, d * (0.55 + drift * 0.03)).addScaledVector(P, d * 0.16);
        target = tmp.copy(P).multiplyScalar(-size * 0.42);
        break;
      case 'under':
        camera.position.copy(P).multiplyScalar(-d * 1.05).addScaledVector(N, d * (0.5 - drift * 0.04)).addScaledVector(V, d * 0.5);
        target = tmp.copy(P).multiplyScalar(size * 0.15);
        camera.up.copy(V);
        break;
      case 'top':
        camera.position.copy(P).multiplyScalar(d * 1.75).addScaledVector(V, d * -0.75).addScaledVector(N, d * (0.28 + drift * 0.04));
        target = tmp.copy(P).multiplyScalar(-size * 0.9);
        camera.up.copy(V);
        break;
      default: {
        // hero: behind and to the side, horizon in the lower part of the frame.
        const w = Math.sin(drift * 0.16) * 0.28;
        // Stand on the Sun's side of the craft so the wings face the lens; when the Sun
        // is below the horizon, stay level behind it instead.
        if (shot.side === undefined) shot.side = S.dot(V) >= 0 ? 1 : -1;
        const sunUp = S.dot(P);
        camera.position.copy(V).multiplyScalar(shot.side * d * (sunUp > -0.2 ? 0.95 : 1.5));
        if (sunUp > -0.2) camera.position.addScaledVector(S, d * 1.1 * (0.75 + 0.25 * Math.sin(drift * 0.11)));
        camera.position.addScaledVector(N, d * (0.5 + w)).addScaledVector(P, d * 0.42);
        camera.position.multiplyScalar(pull);
        target = tmp.copy(P).multiplyScalar(-d * 0.3);
      }
    }
    if (shake.k > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake.k * d * 0.05 * CALM_SHAKE;
      camera.position.y += (Math.random() - 0.5) * shake.k * d * 0.05 * CALM_SHAKE;
      camera.position.z += (Math.random() - 0.5) * shake.k * d * 0.05 * CALM_SHAKE;
      shake.k *= Math.exp(-dt * 3);
    }
    camera.lookAt(target);
    const wide = shot.kind === 'wide';
    orbitG.visible = wide || shot.kind === 'beam';
    shadow.visible = wide;
    marker.visible = wide;
    if (wide) marker.scale.setScalar(0.045 + 0.012 * Math.sin(clock * 3));
    marker.position.set(0, 0, 0);
  }

  function updateEnd(dt) {
    const e = state.end;
    if (!e) return;
    const was = e.t;
    e.t += dt;
    if (e.kind === 'success') {
      if (Math.random() < dt * 80)
        showers.emit(tmp.set((Math.random() - 0.5) * size, (Math.random() - 0.2) * size, (Math.random() - 0.5) * size), tmp2.set((Math.random() - 0.5) * size, Math.random() * size * 0.8, (Math.random() - 0.5) * size), 2.2, 0xffe14a, 0xff7a2a);
      return;
    }
    // Start of an ending: the jolt.
    if (was === 0) {
      shake.k = reduced ? 0 : 1;
      const post = getPost();
      if (post && post.impact) post.impact(1);
      if (e.kind === 'breakup' && !reduced) flash.material.opacity = 1;
    }
    flash.material.opacity = Math.max(0, flash.material.opacity - dt * 1.4);
    if (reduced) return;
    if (e.kind === 'tumble') {
      craft.rotateX(dt * 0.5);
      craft.rotateZ(dt * 0.33);
    } else if (e.kind === 'breakup') {
      Object.values(parts).forEach((h, i) => {
        const u = h.userData;
        if (!u.fly) {
          u.fly = v3(Math.cos(i * 2.4), 0.3 + Math.sin(i * 1.7), Math.sin(i * 3.1)).normalize().multiplyScalar(size * (0.18 + (i % 4) * 0.08));
          u.spin = v3(Math.sin(i), Math.cos(i * 2), Math.sin(i * 0.7)).multiplyScalar(0.9);
        }
        h.position.addScaledVector(u.fly, dt);
        h.rotation.x += u.spin.x * dt;
        h.rotation.y += u.spin.y * dt;
        h.rotation.z += u.spin.z * dt;
      });
      for (let i = 0; i < 4; i++)
        showers.emit(tmp.set(0, 0, 0), tmp2.set((Math.random() - 0.5) * size * 3, (Math.random() - 0.5) * size * 3, (Math.random() - 0.5) * size * 3), 1.6, 0xffb04a, 0x6a2a10);
    } else if (e.kind === 'burnup') {
      craft.rotateX(dt * 0.7);
      for (let i = 0; i < 5; i++) showers.emit(tmp.set((Math.random() - 0.5) * size * 0.6, (Math.random() - 0.5) * size * 0.6, (Math.random() - 0.5) * size * 0.6), tmp2.copy(P).multiplyScalar(size * (1 + Math.random() * 2)).addScaledVector(V, (Math.random() - 0.5) * size), 1.1, 0xffe0a0, 0xff4a20);
      flash.material.opacity = Math.max(flash.material.opacity, 0.28 * Math.min(1, e.t));
    }
  }

  function updateLanding(dt) {
    const t = state.landT;
    lander.visible = true;
    craft.visible = t < 4.2;
    // Drop away from the orbiter, then fire and dive.
    const dropK = smooth(0, 1.3, t);
    const dive = smooth(1.2, LANDING_SECONDS, t);
    const away = -5 * dropK - alt * 0.9 * dive * dive;
    lander.position.copy(P).multiplyScalar(away).addScaledVector(V, -size * 0.4 * dropK);
    lander.quaternion.setFromUnitVectors(v3(0, 1, 0), tmp.copy(P).multiplyScalar(0.92).addScaledVector(V, -0.38).normalize());
    const ignite = smooth(1.15, 1.7, t);
    lFlame.visible = ignite > 0;
    if (ignite > 0) setRocketPlume(lFlame, 9 + 16 * dive, 1.6 + dive * 1.8, ignite, 1, clock);
    if (B.atmo) {
      entryGlow.material.opacity = smooth(2.4, 4.6, t) * 0.85;
      entryGlow.scale.setScalar(20 + 90 * dive);
    }
    if (t < 1.3 && !reduced) shake.k = Math.max(shake.k, 0.4);
    // Camera above and behind, looking down past the lander at the surface.
    const d = 22;
    camera.up.copy(P);
    camera.position.copy(lander.position).addScaledVector(P, d * 1.45).addScaledVector(V, -d * 1.05).addScaledVector(N, d * 0.55);
    tmp2.copy(lander.position).addScaledVector(P, -d * 2.2).addScaledVector(V, d * 0.9);
    camera.lookAt(tmp2);
    orbitG.visible = false;
    marker.visible = false;
  }

  // ---------- Launch film ----------
  const nozzle = v3();
  let lastSmoke = 0;
  function updateLaunch(dt) {
    const T = state.launchT;
    const dur = reduced ? LAUNCH_SECONDS_REDUCED : LAUNCH_SECONDS;
    const orbitPart = T >= (reduced ? 2.4 : 6.1);
    const lit = orbitPart;
    world.visible = lit && body === 'earth';
    craft.visible = false;
    smoke.points.visible = T < 4.6;
    if (lit) sun.position.set(0.35, 0.9, 0.4).multiplyScalar(1000); // the Earth below is in daylight
    else sun.position.copy(S).multiplyScalar(1000);
    stars.material.opacity = lit ? 0.9 : 0.15 + smooth(4.6, 6, T) * 0.6;
    sky.visible = !lit;
    padG.visible = T < 4.6 && !reduced ? true : !lit && reduced;
    rocket.visible = true;
    fill.intensity = lit ? 0.3 : 0.65;

    if (reduced) {
      // A calm version: the stack on the pad, then already in space.
      if (!lit) {
        camera.position.set(L * 0.55, 6, L * 1.3);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, L * 0.55, 0);
        flame.visible = T > 1.2;
        setRocketPlume(flame, look.r * 9 * (T > 1.2 ? 1 : 0), look.r * 1.2, 0.8, 0, clock);
      } else {
        rocket.visible = false;
        craft.visible = true;
        craft.quaternion.identity();
        setDeploy(craft, smooth(2.6, 3.6, T));
        if (earth && earth !== planet) earth.visible = false;
        world.position.set(0, -(R + 300e3), 0);
        camera.up.set(0, 1, 0);
        camera.position.set(size * 1.8, size * 0.5, size * 1.8);
        camera.lookAt(0, 0, 0);
      }
      return;
    }

    let h = 0;
    if (T > 3.0) {
      const k = T - 3.0;
      h = 1.6 * k * k * k * k + 2.6 * k * k;
    }
    const ignited = T > 2.55;
    flame.visible = ignited && T < 5.6;
    if (ignited && T < 5.6) {
      const ign = smooth(2.55, 3.0, T);
      setRocketPlume(flame, look.r * (9 + (T - 2.55) * 12), look.r * (1.15 + (T - 2.55) * 0.6), ign, sat((T - 4.6) / 1.2), clock);
      if (T < 3.6 && T > 2.7) shake.k = Math.max(shake.k, smooth(2.7, 3.6, T) * 1.2);
      // Smoke rolling out of the flame trench.
      lastSmoke += dt;
      while (lastSmoke > 0.009) {
        lastSmoke -= 0.009;
        const a = Math.random() * TAU;
        const sp = look.r * (2.6 + Math.random() * 5);
        const base = T < 4.2 ? 0.5 : h;
        smoke.emit(tmp.set(Math.cos(a) * look.r, base, Math.sin(a) * look.r), tmp2.set(Math.cos(a) * sp * 2, Math.random() * look.r * 1.2, Math.sin(a) * sp * 2), 2.4 + Math.random() * 1.4, 0xd7d0c6, 0x2a2a30);
      }
    }
    smoke.update(dt, 0.8);
    rocket.position.y = h;
    rocket.position.x = 0;

    if (T < 4.6) {
      // Shots A and B: under the rocket, looking up, then it is gone.
      camera.up.set(0, 1, 0);
      if (T < 2.7) {
        const push = 1 - T * 0.03;
        camera.position.set(L * 0.5 * push, 3.5, L * 1.12 * push);
        camera.lookAt(0, L * 0.5, 0);
      } else {
        camera.position.set(L * 0.42, 2.4, L * 0.72);
        camera.lookAt(0, Math.max(L * 0.42, h + L * 0.25), 0);
      }
    } else if (T < 6.1) {
      // Shot C: alongside the rocket at altitude; dark sky, blue limb, stage separation.
      const high = smooth(4.6, 5.6, T);
      skyMat.uniforms.uHigh.value = high;
      if (earth !== planet) {
        earth.visible = true;
        earth.position.set(0, h - BODIES.earth.R - 45e3, 0);
      } else {
        world.visible = true;
        world.position.set(0, h - R - 45e3, 0);
      }
      sky.position.y = h;
      camera.up.set(0, 1, 0);
      const cy = rocket.position.y + L * 0.55;
      camera.position.set(L * 0.7 + Math.sin(T) * 2, cy - L * 0.25, L * 0.85);
      camera.lookAt(0, cy, 0);
      if (T > 5.45 && !rocket.userData.sep) {
        rocket.userData.sep = true;
        flame.visible = false;
        if (flame.userData.light) flame.userData.light.intensity = 0;
        shake.k = Math.max(shake.k, 0.8);
        const post = getPost();
        if (post && post.impact) post.impact(0.5);
      }
      if (rocket.userData.sep) {
        rocket.userData.s1.position.y -= dt * 28 * (T - 5.45 + 0.2);
        vacFlame.visible = true;
        setRocketPlume(vacFlame, look.r * 7, look.r * 1.4, 1, 1, clock);
      }
    } else {
      // Shot D: fairing halves swing off, the real spacecraft unfolds.
      skyMat.uniforms.uHigh.value = 1;
      if (flame.userData.light) flame.userData.light.intensity = 0;
      flame.visible = false;
      const earthR = BODIES.earth.R;
      const eH = 260e3;
      if (earth !== planet) {
        earth.visible = !deep || T < 8.05;
        earth.position.set(0, -earthR - eH, 0);
        world.visible = false;
      } else {
        world.visible = true;
        world.position.set(0, -earthR - eH, 0);
        planet.rotation.y = 1.2;
      }
      const tt = T - 6.1;
      // Upper stage sits under the craft.
      rocket.position.y = -rocket.userData.payloadY - tt * tt * 1.2 - tt * 1.3;
      rocket.userData.s1.visible = false;
      const open = smooth(0.15, 1.1, tt);
      rocket.userData.halves.forEach((h2, i) => {
        const s = i ? 1 : -1;
        h2.rotation.x = s * open * 1.4;
        h2.position.z = s * open * 2.5;
        h2.position.y = rocket.userData.s2.position.y * 0 + look.s2 + open * 3.5;
        if (open > 0.6) h2.visible = open < 1;
      });
      vacFlame.visible = deep && tt > 1.25;
      if (vacFlame.visible) setRocketPlume(vacFlame, look.r * 12, look.r * 1.6, 1, 1, clock);
      craft.visible = true;
      craft.quaternion.identity();
      arrays.forEach((h) => (h.rotation.x = -0.9));
      setDeploy(craft, smooth(0.9, 2, tt));
      camera.up.set(0, 1, 0);
      const d = size * 1.2 * fit();
      camera.position.set(Math.cos(0.8 + tt * 0.12) * d, d * 0.15 - tt * 0.05 * d, Math.sin(0.8 + tt * 0.12) * d);
      camera.lookAt(0, -size * 0.2, 0);
      // The launch group sits at the origin too: only the sky must hide at the top.
      sun.intensity = 3.3;
    }
    if (shake.k > 0.001) {
      const s = shake.k * CALM_SHAKE * (T < 4.6 ? L * 0.012 : look.r * 0.2);
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
      shake.k *= Math.exp(-dt * 5);
    }
    if (T > dur - 0.05) shake.k = 0;
  }

  let orbitStarted = false;
  function startOrbit() {
    if (orbitStarted) return;
    orbitStarted = true;
    launchG.visible = false;
    craft.visible = true;
    setDeploy(craft, 1);
    world.visible = true;
    if (earth && earth !== planet) earth.visible = false;
    stars.material.opacity = 1;
    craft.position.set(0, 0, 0);
    planet.position.set(0, 0, 0);
    fill.intensity = 0.3;
    smoke.points.visible = false;
    sun.position.copy(S).multiplyScalar(1000);
    nextShot('hero');
  }

  const api = {
    scene,
    camera,
    state,
    exposure: 1,
    post: low
      ? false
      : { ao: false, bloom: { strength: 0.42, radius: 0.6, threshold: 0.92 }, grade: { contrast: 1.12, saturation: 1.04, exposure: 1 }, vignette: 0.42, grain: 0.05, aa: true },
    size,
    beta,
    onResize(w, h) {
      aspect = w / Math.max(1, h);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    set(partial) {
      Object.assign(state, partial);
    },
    // For tests: hold one camera shot ('hero', 'wide', 'limb', 'under', 'top', 'beam').
    forceShot(kind) {
      shot = { kind, t: 0, n: 999 };
      forced = kind;
    },
    kick(k) {
      shake.k = Math.max(shake.k, reduced ? 0 : k);
      const post = getPost();
      if (post && post.impact) post.impact(k * 0.5);
    },
    fadeTo(k) {
      const post = getPost();
      if (post && post.set) post.set({ fade: k });
    },
    update(dt0) {
      const dt = Math.max(0, dt0 || 0); // the first frame can start before the mount's timestamp
      clock += dt;
      if (state.mode === 'launch') {
        updateLaunch(dt);
        return;
      }
      startOrbit();
      pose();
      lightCraft(dt);
      if (state.mode === 'landing') {
        updateLanding(dt);
      } else {
        direct(dt);
        pointArrays(dt);
        aimDish(dt);
        updateBeam(dt);
        aimCamera(dt);
      }
      pointArrays(dt);
      updateEnd(dt);
      if (state.spill > 0 && !state.end) {
        const n = Math.ceil(state.spill * 2.2);
        for (let i = 0; i < n; i++) {
          tmp.set((Math.random() - 0.5) * size * 0.4, (Math.random() - 0.5) * size * 0.4, (Math.random() - 0.5) * size * 0.4);
          tmp2.copy(tmp).normalize().multiplyScalar(size * (0.25 + Math.random() * 0.5));
          spill.emit(tmp, tmp2, 1.6, Math.random() < 0.5 ? 0xff4fb2 : 0x9c7bff, 0x4a1a66);
        }
      }
      spill.update(dt);
      showers.update(dt);
    },
    dispose() {
      matCopies.forEach((m) => m.dispose());
    },
  };
  return api;
}

// A quick check the flight can run at all (no WebGL means the 2D fallback).
export function canRun3D() {
  try {
    return supported();
  } catch (e) {
    return false;
  }
}

// ---------- KILO in 3D (docs/TEAM-V2.md "As built (guide & crew)") ----------
// A small floating rounded box with one screen face (the same pixel face as the
// 2D portrait in guide.js), two slim folding side panels and a soft glow under
// it. About 0.36 m wide. Call update(dt) every frame.
const KILO_ARMS = { neutral: [0, 0], deadpan: [0.1, 0.07], happy: [-0.21, -0.24], proud: [-0.31, -0.35], thinking: [0, 0, -0.28, -0.38], worried: [0.17, 0.24], sad: [0.28, 0.31], surprised: [-0.42, -0.17], wink: [-0.14, -0.17, 0, 0] };
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function cellTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 192;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 64, 192);
  grd.addColorStop(0, '#2d4f8e');
  grd.addColorStop(1, '#152a55');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 192);
  g.strokeStyle = 'rgba(140,180,240,0.55)';
  g.lineWidth = 2;
  for (let y = 48; y < 192; y += 48) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(64, y);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(32, 0);
  g.lineTo(32, 192);
  g.stroke();
  g.strokeStyle = '#dfe6f0';
  g.lineWidth = 6;
  g.strokeRect(0, 0, 64, 192);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export function makeKilo(opts = {}) {
  const SMD = globalThis.SMD || {};
  const guide = SMD.team && SMD.team.guide;
  const group = new THREE.Group();
  group.name = 'kilo';
  const bodyG = new THREE.Group();
  group.add(bodyG);
  const W = 0.36;
  const H = 0.29;
  const D = 0.13;
  const shell = new THREE.MeshStandardMaterial({ color: 0xd9dfe8, roughness: 0.5, metalness: 0.08 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xa9b3c5, roughness: 0.5, metalness: 0.3 });
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(W - 0.05, H - 0.05, 0.075), { depth: D, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 5, curveSegments: 10 });
  geo.translate(0, 0, -D / 2);
  const body = new THREE.Mesh(geo, shell);
  bodyG.add(body);
  // The screen: a dark bezel and the face, drawn on a canvas.
  const bezel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(W * 0.8, H * 0.7, 0.045), 8), new THREE.MeshStandardMaterial({ color: 0x2a3346, roughness: 0.4, metalness: 0.4 }));
  bezel.position.z = D / 2 + 0.026;
  bodyG.add(bezel);
  const fc = document.createElement('canvas');
  fc.width = 256;
  fc.height = 168;
  const fctx = fc.getContext('2d');
  const faceTex = new THREE.CanvasTexture(fc);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(W * 0.74, H * 0.62, 0.035), 8), new THREE.MeshBasicMaterial({ map: faceTex, toneMapped: false }));
  // ShapeGeometry UVs are in shape units: map them onto 0..1.
  {
    const uv = screen.geometry.attributes.uv;
    const pos = screen.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (W * 0.74) + 0.5, pos.getY(i) / (H * 0.62) + 0.5);
  }
  screen.position.z = D / 2 + 0.028;
  bodyG.add(screen);
  // Status light on top.
  const glowC = new THREE.Color(0x9ff3dc);
  const light = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.03, 4, 8), new THREE.MeshBasicMaterial({ color: glowC }));
  light.rotation.z = Math.PI / 2;
  light.position.set(0, H / 2 + 0.012, 0.02);
  bodyG.add(light);
  // Side panels: strut, joint, panel. Pivots at the body sides.
  const cellsMat = new THREE.MeshStandardMaterial({ map: cellTexture(), roughness: 0.35, metalness: 0.5 });
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (W / 2 + 0.015), 0, 0);
    bodyG.add(pivot);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.014), grey);
    strut.position.x = side * 0.025;
    pivot.add(strut);
    const elbow = new THREE.Group();
    elbow.position.x = side * 0.05;
    pivot.add(elbow);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), shell);
    elbow.add(joint);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.17, 0.008), [grey, grey, grey, grey, cellsMat, cellsMat]);
    panel.position.x = side * 0.034;
    elbow.add(panel);
    return { side, pivot, elbow, a1: 0, a2: 0 };
  });
  // The glow under it.
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: glowC, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(0.42, 0.16, 1);
  glow.position.y = -H / 2 - 0.07;
  group.add(glow);
  const lamp = new THREE.PointLight(0x9ff3dc, opts.lamp == null ? 0.35 : opts.lamp, 1.2, 2);
  lamp.position.set(0, -0.05, 0.25);
  group.add(lamp);

  let mood = 'neutral';
  let talking = false;
  let mouthOpen = false;
  let tTalk = 0;
  let clock = Math.random() * 10;
  let dirty = true;
  function redraw() {
    if (guide && guide.drawFace) guide.drawFace(fctx, mood, fc.width, fc.height, talking && mouthOpen);
    else {
      fctx.fillStyle = '#0a1428';
      fctx.fillRect(0, 0, fc.width, fc.height);
    }
    faceTex.needsUpdate = true;
    dirty = false;
  }
  redraw();
  return {
    group,
    setMood(m) {
      if (m !== mood) {
        mood = m || 'neutral';
        dirty = true;
      }
    },
    setTalking(on) {
      if (!!on !== talking) {
        talking = !!on;
        mouthOpen = false;
        dirty = true;
      }
    },
    update(dt) {
      clock += dt;
      const still = !!opts.reduced;
      bodyG.position.y = still ? 0 : Math.sin(clock * 1.3) * 0.018;
      bodyG.rotation.y = still ? 0 : Math.sin(clock * 0.55) * 0.1;
      bodyG.rotation.z = still ? 0 : Math.sin(clock * 0.8) * 0.025;
      glow.material.opacity = 0.45 + 0.08 * Math.sin(clock * 1.3);
      const A = KILO_ARMS[mood] || KILO_ARMS.neutral;
      const k = 1 - Math.exp(-dt * 6);
      arms.forEach((a, i) => {
        const t1 = i === 1 && A.length > 2 ? A[2] : A[0];
        const t2 = i === 1 && A.length > 2 ? A[3] : A[1];
        a.a1 += (t1 - a.a1) * k;
        a.a2 += (t2 - a.a2) * k;
        a.pivot.rotation.z = -a.side * a.a1;
        a.elbow.rotation.z = -a.side * a.a2;
      });
      if (talking) {
        tTalk += dt;
        if (tTalk > 0.12) {
          tTalk = 0;
          mouthOpen = !mouthOpen;
          dirty = true;
        }
      }
      if (dirty) redraw();
    },
    dispose() {
      faceTex.dispose();
    },
  };
}

// ---------- The cabin before launch: the crew introduce themselves ----------
// opts: { lineup: [{ member }] (crew.js lineup), reduced, low }. Async: the
// cabin (js/3d/capsule.js) and the people (js/3d/astronaut.js) load on demand.
// Returns { scene, camera, update, onResize, focus(who), talk(who, on), kilo, dispose, post }.
export async function createCabin(opts = {}) {
  const [cabMod, astroMod] = await Promise.all([import('../3d/capsule.js'), import('../3d/astronaut.js')]);
  const reduced = !!opts.reduced;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080c);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 80);
  const cap = cabMod.createCapsuleInterior({ outside: 'space' });
  if (cap.setSky) cap.setSky(1); // still on the pad: blue sky in the windows
  scene.add(cap.group);
  try {
    if (astroMod.preloadCharacters) astroMod.preloadCharacters().catch(() => null);
  } catch (e) {}
  const SEAT_OF = { planner: 'you', engineer: 'yusuf', scientist: 'lena', comms: 'grace' };
  const SEAT_NUDGE = v3(0, 0.42, 0.13);
  const people = {};
  (opts.lineup || []).forEach((row) => {
    const m = row.member;
    const seat = cap.seats[SEAT_OF[m.job]];
    if (!seat) return;
    const a = astroMod.createAstronaut(m.appearance, { blob: false, shadows: false, outfit: 'flight', helmet: false });
    cap.group.add(a.group);
    // The seated clip puts the hips behind the feet origin: move forward onto the pan.
    a.group.position.copy(seat.position).add(SEAT_NUDGE);
    a.group.quaternion.copy(seat.quaternion);
    a.group.rotation.x = -0.12;
    // Where the face is once seated (the anchor is the feet origin).
    const head = new THREE.Object3D();
    head.position.copy(seat.position).add(SEAT_NUDGE).add(v3(0, 1.18, -0.06));
    cap.group.add(head);
    people[m.id] = { astro: a, seat, head };
  });
  // Handrails are left out of the crew scene: from the wide shot one runs through the
  // planner's head (js/3d/capsule.js keeps them for the flight cabin).
  {
    cap.group.updateMatrixWorld(true);
    const heads = Object.values(people).map((p) => p.head.getWorldPosition(new THREE.Vector3()));
    const hide = [];
    cap.group.traverse((o) => {
      const g = o.isMesh && o.geometry && o.geometry.parameters;
      if (!g || o.geometry.type !== 'CylinderGeometry' || Math.abs((g.radiusTop || 0) - 0.016) > 1e-4 || Math.abs((g.height || 0) - 0.5) > 1e-3) return;
      // Every shot sweeps the small cabin, and from the side a rail on the hull lines up
      // with a face: in this scene the rails go (they are only decoration).
      void heads;
      hide.push(o);
    });
    hide.forEach((o) => (o.visible = false));
  }
  // KILO floats by the forward panel, facing the crew.
  const kilo = makeKilo({ reduced, lamp: 0.25 });
  const kiloHome = v3(-0.5, 1.78, 0.95);
  kilo.group.position.copy(kiloHome);
  kilo.group.rotation.y = Math.PI - 0.35;
  cap.group.add(kilo.group);
  const kiloLook = new THREE.Object3D();
  kiloLook.position.copy(kiloHome);
  cap.group.add(kiloLook);
  // A warm key light on the faces.
  const key = new THREE.PointLight(0xfff0dc, 1.1, 4, 1.5);
  key.position.set(0, 1.9, 1.0);
  cap.group.add(key);

  // Shots: the wide one and a close one per speaker.
  // Wide: all four from the corner by the panel. Close-ups: from in front of each
  // face (the back row is seen from the aisle between the front seats).
  const shots = { wide: { pos: v3(0.85, 1.78, 0.95), at: v3(-0.2, 1.2, -0.3) } };
  Object.keys(people).forEach((id) => {
    const hp = people[id].head.position;
    shots[id] = hp.z < 0 ? { pos: v3(hp.x * 0.12, hp.y + 0.08, hp.z + 0.68), at: v3(hp.x, hp.y - 0.03, hp.z) } : { pos: v3(hp.x * 0.55, hp.y + 0.06, hp.z + 0.74), at: v3(hp.x, hp.y - 0.03, hp.z) };
  });
  {
    const f = v3(Math.sin(kilo.group.rotation.y), 0, Math.cos(kilo.group.rotation.y));
    shots.kilo = { pos: kiloHome.clone().addScaledVector(f, 1.15).add(v3(0.12, -0.12, 0)), at: kiloHome.clone().add(v3(0.1, -0.08, 0)) };
  }
  let shot = shots.wide;
  const camPos = shot.pos.clone();
  const camAt = shot.at.clone();
  let speaker = null;

  return {
    scene,
    camera,
    kilo,
    shots,
    post: opts.low ? false : { ao: false, bloom: { strength: 0.3, radius: 0.5, threshold: 0.9 }, grade: { contrast: 1.05, saturation: 1.02, exposure: 1.05 }, vignette: 0.32, grain: 0.03, aa: true },
    onResize(w, h) {
      camera.aspect = w / Math.max(1, h);
      // The cabin stage is a wide band on desktop: a slightly wider vertical view keeps
      // a whole head and shoulders in a close-up; tall phones need more still.
      camera.fov = camera.aspect < 0.9 ? 60 : camera.aspect > 2 ? 46 : 42;
      camera.updateProjectionMatrix();
    },
    // who: 'wide' | 'kilo' | a crew id.
    focus(who) {
      shot = shots[who] || shots.wide;
      speaker = who;
      if (reduced) {
        camPos.copy(shot.pos);
        camAt.copy(shot.at);
      }
    },
    talk(who, on) {
      if (who === 'kilo') kilo.setTalking(on);
    },
    update(dt0) {
      const dt = Math.max(0, dt0 || 0);
      const k = 1 - Math.exp(-dt * (reduced ? 50 : 2.4));
      camPos.lerp(shot.pos, k);
      camAt.lerp(shot.at, k);
      camera.position.copy(camPos);
      camera.lookAt(camAt);
      cap.update(dt);
      kilo.update(dt);
      Object.keys(people).forEach((id) => {
        const a = people[id].astro;
        a.update(dt);
        const isSpeaker = speaker === id;
        if (a.isRigged && isSpeaker) a.play('sitTalk', { hold: true });
        else cabMod.sitPose(a);
        try {
          a.setExpression(isSpeaker ? 'smile' : 'neutral');
          a.lookAt(isSpeaker ? null : speaker === 'kilo' ? kiloLook : speaker && people[speaker] ? people[speaker].head : null);
        } catch (e) {}
      });
    },
    dispose() {
      kilo.dispose();
      Object.values(people).forEach((p) => {
        try {
          if (p.astro.dispose) p.astro.dispose();
        } catch (e) {}
      });
      try {
        cap.dispose();
      } catch (e) {}
    },
  };
}
