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
// The separation and descent film at the end of a flight that lands (6-10 s, skippable).
export const LANDING_SECONDS = 9;
export const LANDING_SECONDS_REDUCED = 6.5;

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

// The crew lander for airless worlds (Moon, Europa): a gold descent stage on four
// legs under a white cabin. Docked under the orbiter, it separates and lands on
// its own engine (docs/TEAM-V3.md "Separation and descent").
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
    // Four small thruster quads round the cabin: the RCS that pushes it clear.
    const quad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), dark);
    quad.position.set(Math.cos(a) * 1.75, 2.4, Math.sin(a) * 1.75);
    g.add(quad);
  }
  g.userData.top = 4.15;
  return g;
}

// Mars and Venus: the descent module rides in an aeroshell (a blunt heat shield
// and a backshell), as Viking and every Mars lander since. 1 unit = 1 metre.
function makeAeroshell() {
  const g = new THREE.Group();
  const shieldMat = new THREE.MeshStandardMaterial({ color: 0x5b3b28, metalness: 0.15, roughness: 0.8 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0xaeb4bc, metalness: 0.2, roughness: 0.62 });
  const ring = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.7, roughness: 0.4 });
  const shield = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.7, 32), shieldMat);
  cone.rotation.x = Math.PI; // the blunt nose points down (-Y)
  cone.position.y = -0.35;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.07, 8, 40), ring);
  rim.rotation.x = Math.PI / 2;
  shield.add(cone, rim);
  const back = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.78, 1.45, 32), backMat);
  shell.position.y = 0.72;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.75, 0.32, 24), ring);
  cap.position.y = 1.6;
  back.add(shell, cap);
  // Small thrusters on the backshell: they turn it and fire the deorbit burn.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.26, 10), ring);
    n.position.set(Math.cos(a) * 1.05, 1.3, Math.sin(a) * 1.05);
    back.add(n);
  }
  g.add(shield, back);
  return { shield, back, top: 1.76 };
}

// A supersonic parachute: an orange and white canopy on long lines. Its origin is
// where the lines meet the backshell; the canopy opens `riser` metres above.
function makeChute(radius = 5.5, riser = 9) {
  const g = new THREE.Group();
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 16;
  const x = cv.getContext('2d');
  for (let i = 0; i < 16; i++) {
    x.fillStyle = i % 2 ? '#f4f1ea' : '#e2602a';
    x.fillRect(i * 16, 0, 16, 16);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 10, 0, TAU, 0, Math.PI * 0.42),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0, side: THREE.DoubleSide })
  );
  canopy.scale.y = 0.55;
  canopy.position.y = riser - radius * 0.55 * Math.cos(Math.PI * 0.42);
  const canopyG = new THREE.Group();
  canopyG.add(canopy);
  const rimR = radius * Math.sin(Math.PI * 0.42);
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    pts.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * rimR, riser, Math.sin(a) * rimR));
  }
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xd8d4cc, transparent: true, opacity: 0.7 }));
  g.add(canopyG, lines);
  g.userData.canopy = canopyG;
  g.userData.riser = riser;
  return g;
}

// Venus: no ground landing (the surface is 465 C). The crew's cloud platform hangs
// under a balloon and floats about 50 km up, as in NASA's HAVOC concept.
function makeAerostat() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xece2c6, metalness: 0.35, roughness: 0.4 });
  const deck = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.5, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.5 });
  const env = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(6.5, 32, 20), skin);
  ball.scale.y = 0.82;
  env.add(ball);
  // Seams, so the balloon reads as a made thing.
  for (let i = 0; i < 6; i++) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(6.52, 0.05, 6, 48), dark);
    seam.rotation.y = (i / 6) * Math.PI;
    seam.scale.y = 0.82;
    env.add(seam);
  }
  env.position.y = 13;
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.2, 0.45, 6), deck);
  const hab = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 10, 0, TAU, 0, Math.PI / 2), deck);
  hab.position.y = 0.2;
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    pts.push(new THREE.Vector3(Math.cos(a) * 2.3, 0.2, Math.sin(a) * 2.3), new THREE.Vector3(Math.cos(a) * 3.2, 6.2, Math.sin(a) * 3.2));
  }
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a3428 }));
  g.add(env, plat, hab, lines);
  g.userData.envelope = env;
  g.userData.lines = lines;
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

  // ---------- The descent module (only when the crew goes down) ----------
  // Docked under the orbiter for the whole orbit. At the end it separates and goes
  // down on its own while the orbiter stays up: the relay for the surface uplinks.
  // Moon and Europa: a legged lander on its engine. Mars: an aeroshell, a parachute,
  // then the lander on retro-rockets. Venus: an aeroshell, a parachute, then the
  // cloud platform under its balloon (docs/TEAM-V3.md "Separation and descent").
  const landKind = !opts.lands ? null : body === 'mars' ? 'mars' : body === 'venus' ? 'venus' : 'legs';
  let lander = null;
  let lFlame = null;
  let shell = null;
  let sFlame = null;
  let chute = null;
  let stat = null;
  let entryGlow = null;
  let clouds = null;
  let dockGap = 0;
  const fxG = new THREE.Group(); // effects that travel with the lander
  const puffs = makeParticles(180, { size: 0.55 });
  const trail = makeParticles(520, { size: 0.65 });
  // Dust (Moon, Mars) or ice (Europa) blown out by the engine near the ground.
  const dust = makeParticles(420, { size: 7 });
  fxG.add(puffs.points, trail.points, dust.points);
  const DUST_C = { moon: [0x77736a, 0x1e1c19], mars: [0x8a5434, 0x24130a], europa: [0x8fa6c4, 0x1d2532] }[body] || [0x77736a, 0x1e1c19];
  // The orbiter far away: a moving dot on its orbit.
  const orbDot = glowSprite(0xaef0ff, 0, false);
  orbDot.scale.setScalar(0.024);
  const popGlow = glowSprite(0xdff4ff, 0);
  popGlow.scale.setScalar(2.4);
  if (landKind) {
    scene.add(fxG, orbDot, popGlow);
    lander = makeLander();
    lander.scale.setScalar(landKind === 'legs' ? 0.42 : 0.31);
    scene.add(lander);
    lFlame = rocketPlume({ cores: 0, r: 1.2, s1: 12, s2: 4, fair: 2 }, false);
    lFlame.position.y = -2.3;
    lFlame.visible = false;
    lander.add(lFlame);
    let dockTop = lander.userData.top * lander.scale.y;
    if (landKind !== 'legs') {
      shell = makeAeroshell();
      scene.add(shell.shield, shell.back);
      sFlame = rocketPlume({ cores: 0, r: 0.5, s1: 4, s2: 2, fair: 1 }, false);
      sFlame.rotation.x = Math.PI; // fires out of the top of the backshell
      sFlame.position.y = 1.85;
      sFlame.visible = false;
      shell.back.add(sFlame);
      chute = makeChute();
      chute.visible = false;
      scene.add(chute);
      entryGlow = glowSprite(0xff8a3a, 0);
      entryGlow.scale.setScalar(8);
      scene.add(entryGlow);
      dockTop = shell.top;
      lander.visible = false;
    }
    if (landKind === 'venus') {
      stat = makeAerostat();
      stat.visible = false;
      scene.add(stat);
      clouds = makeParticles(140, { size: 70 });
      fxG.add(clouds.points);
    }
    // The shadow dims the descent module like the orbiter.
    [lander, shell && shell.shield, shell && shell.back, chute, stat].forEach(
      (o) =>
        o &&
        o.traverse((m) => {
          if (m.isMesh && m.material && m.material.color && !mats.includes(m.material)) {
            mats.push(m.material);
            baseColors.push(m.material.color.clone());
          }
        })
    );
    // Docked under the bus, on the side that faces the planet.
    craft.updateMatrixWorld(true);
    const bb = new THREE.Box3();
    craft.children.forEach((c) => {
      if (c !== led) bb.expandByObject(c);
    });
    const bus = Math.max(0.5, Math.min(-bb.min.z, size * 0.3));
    dockGap = bus + 0.12 + dockTop;
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
  let landPhase = null; // the landing film holds its own orbit angle (a sunlit pass)
  const dirBeam = v3(0, 1, 0);

  const nextShot = (kind) => {
    shot = { kind, t: 0, n: shot.n + 1 };
    const post = getPost();
    if (post && post.set) post.set({ fade: 0.0 });
  };
  // With a lander docked underneath, the shot from below would only see the lander.
  const shots = reduced ? ['hero', 'wide'] : ['hero', 'wide', 'limb', landKind ? 'top' : 'under', 'hero', 'top', 'wide', 'limb'];

  const fit = () => (aspect < 1 ? 1.75 / aspect : aspect < 1.4 ? 1.3 : 1);

  function pose() {
    const a = landPhase !== null ? landPhase : shot.kind === 'wide' ? state.fastPhase : state.phase;
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
    const inShadow = landPhase !== null ? false : shot.kind === 'wide' ? !state.sunlitNow : Math.cos(state.phase - Math.PI) > Math.cos(beta) * 0.99;
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

  // ---------- Separation and descent (docs/TEAM-V3.md "Separation and descent") ----------
  // Real missions split here: the orbiter stays in orbit as the relay for the
  // surface uplinks, and the lander separates and goes down on its own (Apollo's
  // LM from the CSM, Viking's lander from its orbiter). landT is the film's own
  // clock in seconds; the beats are written for 9 s and stretch to fit LD.
  //   0    docked: the stack in orbit
  //   1.4  springs and RCS puffs push the lander clear; the orbiter carries on
  //   3.0  the orbiter goes on along its orbit and becomes a moving dot
  //   3.4  deorbit burn
  //   4.8  descent: Moon/Europa engine only; Mars heat shield, parachute, retro-rockets;
  //        Venus heat shield, parachute, balloon, floating in the clouds
  const LD = reduced ? LANDING_SECONDS_REDUCED : LANDING_SECONDS;
  const LAND_A0 = 0.75; // a sunlit stretch of the orbit, the Sun behind the camera
  const W_ORB = 0.006; // the orbiter's apparent orbit rate in the film (rad/s)
  const RELEASE = 1.4;
  const BURN = 3.4;
  const CHUTE = landKind === 'venus' ? 6.2 : 6.4;
  const SHIELD = CHUTE + 0.5; // the heat shield falls away
  const DROP = 7.6; // Mars: the lander drops out of the backshell
  const INFLATE = 7.0; // Venus: the balloon fills
  const CUT = 7.9; // Venus: chute and backshell let go
  const HAZE_C = 0xd8b27a;
  const DESC = 4.8; // the descent starts
  const sinkAt = (tt) => 300 * Math.max(0, tt - BURN) ** 3; // after the deorbit burn the lander starts to sink
  const top = alt - sinkAt(DESC);
  const KNOTS = {
    legs: [[DESC, top], [9, 12]],
    mars: [[DESC, top], [CHUTE, 11e3], [DROP, 1800], [9, 12]],
    venus: [[DESC, top], [CHUTE, 90e3], [INFLATE, 62e3], [8.0, 54e3], [9, 52e3]], // HAVOC floats about 50 km up
  };
  const tL = v3(); // the lander (or the aeroshell) now
  const tU = v3(); // its up (+Y)
  const tB = v3(); // backshell
  const tA = v3();
  const tE = v3();
  const camT = v3();
  const Yax = v3(0, 1, 0);
  const skyC = new THREE.Color();
  const surfMat = planet.userData.surface ? planet.userData.surface.material : null;
  const tQ = new THREE.Quaternion();
  const qDock = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), Math.PI / 2);
  let prevTT = -1;
  let curTT = 0;
  let viewFade = 0;
  let haze = 0;

  // Altitude in metres: log-linear between the knots, easing out on the last stretch.
  function altAt(tt) {
    const K = KNOTS[landKind] || KNOTS.legs;
    if (tt <= K[0][0]) return alt - sinkAt(tt);
    for (let i = 1; i < K.length; i++) {
      if (tt > K[i][0]) continue;
      let k = (tt - K[i - 1][0]) / (K[i][0] - K[i - 1][0]);
      if (i === K.length - 1) k = 1 - (1 - k) * (1 - k);
      return Math.exp(Math.log(K[i - 1][1]) + (Math.log(K[i][1]) - Math.log(K[i - 1][1])) * k);
    }
    return K[K.length - 1][1];
  }
  // The lander's distance from the planet's centre and how far it has fallen
  // behind the orbiter (radians along the orbit). The orbiter stays at the origin.
  const sepDown = (tt) => (tt < RELEASE ? 0 : (tt - RELEASE) * 1.3);
  const pullAhead = (tt) => 1.9 * Math.max(0, tt - 1.8) ** 2;
  function landerAt(out, tt) {
    const k = sat((tt - BURN) / (9 - BURN));
    const r = (tt < BURN ? rOrbit : R + altAt(tt)) - dockGap - sepDown(tt);
    const th = -pullAhead(tt) / rOrbit - (W_ORB * (9 - BURN) * k * k * k) / 3;
    return out.copy(P).multiplyScalar(r * Math.cos(th) - rOrbit).addScaledVector(V, r * Math.sin(th));
  }
  function beatOf(tt) {
    if (tt < RELEASE) return 'docked';
    if (tt < 3.0) return 'separation';
    if (tt < 3.9) return 'orbiter';
    if (tt < 4.8) return 'deorbit';
    if (landKind === 'legs') return 'powered';
    if (tt < CHUTE) return 'entry';
    if (landKind === 'mars') return tt < DROP ? 'chute' : 'retro';
    return tt < INFLATE ? 'chute' : tt < 8.0 ? 'balloon' : 'float';
  }
  const dirMix = (out, a, b, k) => out.copy(a).multiplyScalar(1 - k).addScaledVector(b, k).normalize();

  // Docked: the descent module sits under the bus and moves with it.
  function placeDocked() {
    if (!landKind) return;
    tL.set(0, 0, -dockGap).applyQuaternion(craft.quaternion).add(craft.position);
    tQ.copy(craft.quaternion).multiply(qDock);
    hideRig();
    if (shell) {
      [shell.back, shell.shield].forEach((o) => {
        o.visible = true;
        o.position.copy(tL);
        o.quaternion.copy(tQ);
      });
    } else {
      lander.visible = true;
      lander.position.copy(tL);
      lander.quaternion.copy(tQ);
    }
  }
  function hideRig() {
    if (!landKind) return;
    [lander, lFlame, shell && shell.back, shell && shell.shield, sFlame, chute, stat].forEach((o) => o && (o.visible = false));
    if (entryGlow) entryGlow.material.opacity = 0;
    orbDot.material.opacity = 0;
    popGlow.material.opacity = 0;
  }
  // RCS puffs from four thrusters round the module, in fxG's frame (it rides with the lander).
  function puff(at, up, n, speed) {
    const ax = tA.set(1, 0, 0).applyQuaternion(tQ);
    const az = tE.set(0, 0, 1).applyQuaternion(tQ);
    for (let i = 0; i < n; i++) {
      const a = (i % 4) * (TAU / 4) + TAU / 8 + (Math.random() - 0.5) * 0.3;
      const rad = tmp.copy(ax).multiplyScalar(Math.cos(a)).addScaledVector(az, Math.sin(a));
      const p = tmp2.copy(at).addScaledVector(rad, 0.9);
      const v = rad.multiplyScalar(speed * (0.7 + Math.random() * 0.6)).addScaledVector(up, speed * 0.5 * Math.random());
      puffs.emit(p, v, 0.55 + Math.random() * 0.3, 0xeaf6ff, 0x46566e);
    }
  }

  function updateLanding(dt) {
    const tt = clamp(state.landT, 0, LD + 3) * (LANDING_SECONDS / LD);
    const first = prevTT < 0 || tt < prevTT - 0.5;
    const crossed = (x) => !first && prevTT < x && tt >= x;
    curTT = tt;
    const capsule = landKind !== 'legs';
    beam.visible = false;
    station.material.opacity = 0;
    marker.visible = false;
    shadow.visible = false;
    craft.position.set(0, 0, 0);
    craft.visible = true;
    hideRig();

    // ----- Where the lander is, and which way is up for it -----
    landerAt(tL, tt);
    // Inside the air the planet's haze shells would wash the ground out: the sky tint takes over.
    const atmo = planet.userData.atmosphere;
    if (atmo) atmo.forEach((m) => (m.visible = altAt(tt) > R * 0.014));
    const up = tU.copy(P);
    if (!capsule) {
      // Turn so the engine points along the track, burn, then pitch up to land.
      const retro = tA.copy(V).negate().addScaledVector(P, 0.3).normalize();
      if (tt > 3.1) dirMix(up, P, retro, smooth(3.1, 3.55, tt) * (1 - smooth(4.8, 8.6, tt)));
    } else {
      // Backshell thrusters fire forward for the burn, then it flips heat shield first.
      const burnUp = tA.copy(V).addScaledVector(P, 0.15).normalize();
      const entryUp = tE.copy(V).negate().addScaledVector(P, 0.45).normalize();
      if (tt > 3.1 && tt < 4.4) dirMix(up, P, burnUp, smooth(3.1, 3.5, tt));
      else if (tt >= 4.4 && tt < CHUTE) dirMix(up, burnUp, entryUp, smooth(4.4, 4.9, tt));
      else if (tt >= CHUTE) {
        // Hanging under the parachute: it swings a little, then settles.
        dirMix(up, entryUp, P, smooth(CHUTE, CHUTE + 0.45, tt));
        const sw = tt - CHUTE;
        if (!reduced) up.addScaledVector(V, 0.16 * Math.sin(sw * 5) * Math.exp(-sw * 1.3)).normalize();
      }
    }
    tQ.setFromUnitVectors(Yax, up);
    fxG.position.copy(tL);

    // ----- Separation: springs and RCS puffs -----
    if (crossed(RELEASE)) {
      puff(tB.copy(up).multiplyScalar(capsule ? 1.4 : 1.2), up, 28, 3.2);
      if (!reduced) shake.k = Math.max(shake.k, 0.25);
    }
    if (crossed(2.2) || crossed(3.15) || (capsule && (crossed(3.3) || crossed(4.5) || crossed(4.7)))) puff(tB.copy(up).multiplyScalar(1.1), up, 10, 2.2);
    if (!reduced) {
      popGlow.position.copy(tL).addScaledVector(up, capsule ? 1.8 : 1.7);
      popGlow.material.opacity = smooth(RELEASE - 0.05, RELEASE + 0.05, tt) * (1 - smooth(RELEASE + 0.05, RELEASE + 0.45, tt)) * 0.8;
    }

    // ----- The modules -----
    const rigTop = camT.copy(tL); // what the wide descent shots frame
    if (!capsule) {
      lander.visible = true;
      lander.position.copy(tL);
      lander.quaternion.copy(tQ);
      const burnK = smooth(3.55, 3.8, tt) * (1 - smooth(4.5, 4.75, tt));
      const descK = smooth(4.8, 5.1, tt);
      const k = Math.max(burnK, descK);
      lFlame.visible = k > 0.01;
      if (lFlame.visible) setRocketPlume(lFlame, 7 + 8 * descK + Math.sin(clock * 17) * 0.4, 1.3 + 0.7 * descK, k, 1, clock);
    } else {
      // Backshell (and heat shield until it drops), with the backshell's own burn.
      tB.copy(tL);
      if (landKind === 'mars' && tt > DROP) {
        // The lander falls out; backshell and parachute stay above it.
        const s = tt - DROP;
        tB.addScaledVector(P, 0.6 + 16 * s * s).addScaledVector(V, -3 * s);
      }
      if (landKind === 'venus' && tt > CUT) {
        // The balloon holds the platform; chute and backshell let go and fall away.
        const s = tt - CUT;
        tB.addScaledVector(P, -26 * s * s).addScaledVector(N, 12 * s);
      }
      shell.back.visible = !(landKind === 'venus' && tt > CUT + 1.0);
      shell.back.position.copy(tB);
      shell.back.quaternion.copy(tQ);
      shell.shield.visible = tt < SHIELD + 1.0;
      shell.shield.quaternion.copy(tQ);
      shell.shield.position.copy(tL);
      if (tt > SHIELD) {
        const s = tt - SHIELD;
        shell.shield.position.addScaledVector(P, -(0.4 + 14 * s * s)).addScaledVector(V, 2 * s);
        shell.shield.rotateX(s * 0.8);
      }
      const burnK = smooth(3.55, 3.8, tt) * (1 - smooth(4.25, 4.45, tt));
      sFlame.visible = burnK > 0.01;
      if (sFlame.visible) setRocketPlume(sFlame, 2.6 + Math.sin(clock * 17) * 0.2, 0.55, burnK, 1, clock);
      // Entry: the heat shield glows and a plasma trail streams behind.
      const glowK = smooth(4.85, 5.3, tt) * (1 - smooth(CHUTE - 0.55, CHUTE - 0.05, tt));
      entryGlow.material.opacity = glowK * 0.8;
      entryGlow.position.copy(tL).addScaledVector(up, -0.8);
      entryGlow.scale.setScalar(5.2 + (reduced ? 0 : 0.6 * Math.sin(clock * 9)));
      if (glowK > 0.05) {
        const n = Math.ceil(dt * 420 * glowK);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU;
          const ax = tA.set(Math.cos(a), 0, Math.sin(a)).applyQuaternion(tQ);
          trail.emit(
            tmp2.copy(ax).multiplyScalar(1.7).addScaledVector(up, -0.2),
            tmp.copy(up).multiplyScalar(30 + Math.random() * 26).addScaledVector(ax, 1.5 + Math.random() * 2.5),
            0.28 + Math.random() * 0.2,
            0xffe0a0,
            0x9a2a10
          );
        }
      }
      // Parachute: out of the backshell's top, opening fast.
      if (tt > CHUTE && !(landKind === 'venus' && tt > CUT + 1.0)) {
        chute.visible = true;
        chute.position.copy(tB).addScaledVector(up, shell.top);
        chute.quaternion.copy(tQ);
        const open = 0.12 + 0.88 * smooth(CHUTE, CHUTE + 0.35, tt);
        chute.scale.set(open, 0.6 + 0.4 * open, open);
      }
      if (landKind === 'mars' && tt > SHIELD) {
        // The lander in the open backshell, then on its own retro-rockets.
        lander.visible = true;
        lander.quaternion.copy(tQ);
        lander.position.copy(tL).addScaledVector(up, 0.2);
        const k = smooth(DROP + 0.05, DROP + 0.3, tt);
        lFlame.visible = k > 0.01;
        if (lFlame.visible) setRocketPlume(lFlame, 9 + Math.sin(clock * 17) * 0.5, 1.6, k, 1, clock);
      }
      if (landKind === 'venus' && tt > SHIELD) {
        // The platform drops out on its tether and the balloon fills above it.
        stat.visible = true;
        const lower = 17.5 * smooth(INFLATE - 0.1, INFLATE + 0.6, tt);
        stat.quaternion.setFromUnitVectors(Yax, P);
        stat.position.copy(tL).addScaledVector(P, -0.6 - lower);
        if (tt > CUT && !reduced) stat.position.addScaledVector(P, 0.4 * Math.sin(clock * 1.3));
        const fill = 0.1 + 0.9 * smooth(INFLATE + 0.1, 7.9, tt);
        stat.userData.envelope.scale.set(fill, fill, fill);
        stat.userData.envelope.position.y = 16.2 - 5.0 * fill;
        stat.userData.lines.scale.y = Math.max(0.05, (16.2 - 10 * fill) / 6.2);
        if (tt > INFLATE) rigTop.copy(stat.position).addScaledVector(P, 9);
      }
      // The cloud deck: soft billows streaming up past the module.
      if (clouds && tt > 6.4) {
        const n = Math.ceil(dt * 40 * (reduced ? 0.5 : 1));
        for (let i = 0; i < n; i++) {
          const p = tmp2.copy(V).multiplyScalar((Math.random() - 0.5) * 160).addScaledVector(N, (Math.random() - 0.5) * 160).addScaledVector(P, -40 - Math.random() * 90);
          clouds.emit(p, tmp.copy(P).multiplyScalar(tt < 8 ? 26 : 5).addScaledVector(V, -4), 3.2, 0x8a7046, 0x2a1c0c);
        }
      }
    }

    // ----- Near the ground the engine blows dust (ice on Europa) outwards -----
    const hNow = altAt(tt);
    if (landKind !== 'venus' && hNow < 70 && tt < 9.6) {
      const k = 1 - hNow / 70;
      const n = Math.ceil(dt * 320 * k * (reduced ? 0.5 : 1));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const dir = tA.copy(V).multiplyScalar(Math.cos(a)).addScaledVector(N, Math.sin(a));
        const p = tmp2.copy(P).multiplyScalar(-hNow + 0.6).addScaledVector(dir, 2 + Math.random() * 4);
        dust.emit(p, tmp.copy(dir).multiplyScalar(18 + Math.random() * 26).addScaledVector(P, 1 + Math.random() * 4), 0.9 + Math.random() * 0.6, DUST_C[0], DUST_C[1]);
      }
    }

    // ----- The orbiter carries on: the dot and its orbit -----
    orbDot.position.set(0, 0, 0);
    orbDot.material.opacity = smooth(3.4, 4.1, tt) * 0.95;
    earthDot.visible = false; // one dot in this sky: the orbiter
    orbitG.visible = tt > 3.0 && tt < 4.8;

    // ----- Low in the air the sky is no longer black; Venus sinks into the cloud layer -----
    const airK = landKind === 'mars' ? smooth(CHUTE - 0.4, CHUTE + 0.6, tt) : landKind === 'venus' ? smooth(CHUTE - 0.4, INFLATE, tt) : 0;
    scene.background.setHex(0x02030a).lerp(skyC.setHex(landKind === 'venus' ? 0xc99a62 : 0xb08560), airK);
    // Seen from a few km up, the global map washes out to grey: warm the Martian ground.
    if (landKind === 'mars' && surfMat) surfMat.color.setHex(0xffffff).lerp(skyC.setHex(0xffa070), airK);
    stars.material.opacity = 1 - airK;
    haze = landKind === 'venus' ? smooth(6.6, 8.4, tt) * 0.48 : 0;
    const post = getPost();
    if (post && post.set) post.set({ fade: Math.max(viewFade, haze), fadeColor: landKind === 'venus' ? HAZE_C : 0 });

    // ----- Camera -----
    const fk = aspect < 1 ? 1.25 / aspect : fit(); // portrait: a little closer than the orbit shots
    const narrow = Math.min(1, aspect); // portrait phones: keep the craft near the middle
    camera.up.copy(P);
    const beat = beatOf(tt);
    if (tt < 3.0) {
      // The stack, then the push: both craft in the frame, the lander dropping away.
      const d = (size * 1.0 + dockGap) * fk;
      const drift = reduced ? 0 : tt * 0.04;
      tA.copy(tL).multiplyScalar(0.5);
      camera.position.copy(tA).addScaledVector(V, d * (0.9 - drift)).addScaledVector(N, d * (1.1 + drift)).addScaledVector(P, d * 0.22);
      camera.lookAt(tA);
    } else if (tt < 4.8) {
      // From behind the lander, past it, at the orbiter going on along its orbit.
      // Looking up the line from the lander to the orbiter, a little to the side:
      // the lander on one side of the frame, the orbiter shrinking on the other.
      const dl = 10 * fk;
      tE.copy(tL).negate().normalize();
      camera.position.copy(tL).addScaledVector(tE, -dl * 1.3).addScaledVector(N, dl * 0.6 * narrow).addScaledVector(P, -dl * 0.12);
      tA.copy(tL).addScaledVector(tE, dl * 1.2);
      camera.lookAt(tA);
    } else if ((landKind === 'legs' && tt > 6.2) || beat === 'retro') {
      // Low now: from the side, the horizon in the frame and the ground coming up;
      // at the end the camera backs off to show the dust blowing out under the engine.
      const k = reduced ? 1 : smooth(7.9, 8.9, tt);
      const dl = (14 + 8 * k) * fk * (landKind === 'mars' ? 0.8 : 1);
      const hh = Math.min(hNow, 40);
      camera.position.copy(tL).addScaledVector(V, -dl * 0.95).addScaledVector(N, dl * 0.75).addScaledVector(P, 3 + (5 - hh - 3) * k);
      tA.copy(tL).addScaledVector(V, dl * 0.1).addScaledVector(P, -2 - (hh * 0.5 - 2) * k);
      camera.lookAt(tA);
    } else if (beat === 'chute' || beat === 'balloon' || beat === 'float') {
      // Wide enough for the canopy (and Venus's balloon) above the module.
      const venusUp = landKind === 'venus' && tt > INFLATE;
      const dl = (venusUp ? 30 : 20) * fk;
      tA.copy(rigTop).addScaledVector(P, venusUp ? 0 : 6);
      camera.position.copy(tA).addScaledVector(V, -dl * 1.05).addScaledVector(N, dl * 0.85).addScaledVector(P, dl * 0.12);
      camera.lookAt(tA);
    } else {
      // Above and behind, looking down past the lander at the ground coming up.
      const dl = 9.5 * fk;
      camera.position.copy(tL).addScaledVector(P, dl * 1.2).addScaledVector(V, -dl * 1.35).addScaledVector(N, dl * 0.6 * narrow);
      tA.copy(tL).addScaledVector(P, -dl * 1.4 * narrow).addScaledVector(V, dl * 1.1 * narrow);
      camera.lookAt(tA);
    }
    if (shake.k > 0.001) {
      const s = shake.k * CALM_SHAKE * 0.6;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
      shake.k *= Math.exp(-dt * 4);
    }
    puffs.update(dt, 1.2);
    trail.update(dt);
    dust.update(dt, 0.6);
    if (clouds) clouds.update(dt, 0.3);
    prevTT = tt;
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
      viewFade = k;
      const post = getPost();
      if (post && post.set) post.set({ fade: Math.max(k, haze), fadeColor: landKind === 'venus' && state.mode === 'landing' ? HAZE_C : 0 });
    },
    // The separation and descent film (docs/TEAM-V3.md "Separation and descent").
    landingSeconds: LD,
    landKind,
    // Which beat is on screen: docked, separation, orbiter, deorbit, powered,
    // entry, chute, retro, balloon or float (null outside the film).
    landBeat() {
      return landKind && state.mode === 'landing' ? beatOf(curTT) : null;
    },
    // Where the orbiter and the lander are on screen (-1..1, y up), for the view's labels.
    landTags() {
      if (!landKind || state.mode !== 'landing') return null;
      // Anchored just right of each craft (on screen), so the label never covers it.
      const right = v3(1, 0, 0).applyQuaternion(camera.quaternion);
      const at = (p, r) => {
        p.addScaledVector(right, r * Math.min(1, p.distanceTo(camera.position) / Math.max(1e-6, r * 4)));
        const behind = tmp.copy(p).applyMatrix4(camera.matrixWorldInverse).z > 0;
        tmp.copy(p).project(camera);
        return { x: tmp.x, y: tmp.y, on: !behind && Math.abs(tmp.x) < 0.96 && Math.abs(tmp.y) < 0.92 };
      };
      return { t: curTT, orbiter: at(v3(0, 0, 0), size * 0.45), lander: at(v3().copy(tL), 2.2) };
    },
    update(dt0) {
      const dt = Math.max(0, dt0 || 0); // the first frame can start before the mount's timestamp
      clock += dt;
      if (state.mode === 'launch') {
        hideRig();
        updateLaunch(dt);
        return;
      }
      const landing = state.mode === 'landing' && !!landKind;
      if (!landing && planet.userData.atmosphere) planet.userData.atmosphere.forEach((m) => (m.visible = true));
      if (!landing && surfMat) surfMat.color.setHex(0xffffff);
      if (!landing) earthDot.visible = deep && body !== 'earth';
      landPhase = landing ? LAND_A0 + W_ORB * clamp(state.landT, 0, LD + 3) * (LANDING_SECONDS / LD) : null;
      startOrbit();
      pose();
      lightCraft(dt);
      if (landing) {
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
      if (!landing) placeDocked();
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
  // The chosen guide (KILO unless the player picked another) floats by the forward panel, facing the crew.
  const kilo = makeGuide3D({ reduced, lamp: 0.25, guide: opts.guide });
  const kiloHome = v3(-0.5, kilo.group.name === 'brace' ? 1.66 : 1.78, 0.95);
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

// ---------- v3: the chosen guide in 3D (docs/TEAM-V3.md item 9) ----------
// makeGuide3D(opts) gives the same handle as makeKilo ({ group, setMood,
// setTalking, update, dispose }) for the guide the player chose (opts.guide or
// SMD.team.guide.current()): KILO, BRACE (a tall graphite survey robot),
// Dr. Praline (a floating holo-portrait card) or CAIRN (three stacked stones
// with a glowing geode face).
export function makeGuide3D(opts = {}) {
  const SMD = globalThis.SMD || {};
  const G = SMD.team && SMD.team.guide;
  const id = opts.guide || (G && G.current ? G.current() : 'kilo');
  try {
    if (id === 'brace') return makeBrace(opts);
    if (id === 'praline') return makePraline(opts);
    if (id === 'cairn') return makeCairn(opts);
  } catch (e) {
    console.warn('guide 3D fell back to KILO', e);
  }
  return makeKilo(opts);
}

// Arm angles in radians: [left shoulder, left elbow, right shoulder, right elbow], + is outward.
const BRACE_ARMS3 = { neutral: [0.12, 0, 0.12, 0], deadpan: [0.07, 0, 0.07, 0], happy: [0.45, 0.28, 0.45, 0.28], proud: [0.12, 0, 2.62, 2.03], thinking: [0.12, 0, 0.26, -2.27], worried: [0.25, -0.7, 0.25, -0.7], sad: [0.03, 0, 0.03, 0], surprised: [1.08, 0.7, 1.08, 0.7], wink: [0.12, 0, 1.25, 0.8] };
function makeBrace(opts = {}) {
  const SMD = globalThis.SMD || {};
  const guide = SMD.team && SMD.team.guide;
  const group = new THREE.Group();
  group.name = 'brace';
  const bodyG = new THREE.Group();
  group.add(bodyG);
  const H = 0.62;
  const graphite = new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.55, metalness: 0.45 });
  const joint = new THREE.MeshStandardMaterial({ color: 0x68728a, roughness: 0.4, metalness: 0.6 });
  const amber = new THREE.MeshBasicMaterial({ color: 0xffb24d, toneMapped: false });
  // A tapered square prism, flattened front to back.
  const geo = new THREE.CylinderGeometry(0.125, 0.148, H, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.scale(1, 1, 0.62);
  const body = new THREE.Mesh(geo, graphite);
  bodyG.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.02, 0.105), graphite);
  cap.position.y = H / 2 + 0.006;
  bodyG.add(cap);
  // The face panel: eye and light column, drawn on a canvas.
  const fc = document.createElement('canvas');
  fc.width = 120;
  fc.height = 256;
  const fctx = fc.getContext('2d');
  const faceTex = new THREE.CanvasTexture(fc);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.28), new THREE.MeshBasicMaterial({ map: faceTex, toneMapped: false }));
  face.position.set(0, H * 0.13, 0.0905);
  face.rotation.x = -0.03;
  bodyG.add(face);
  // Two rank chevrons below the face.
  [0, 1].forEach((i) => {
    [-1, 1].forEach((s) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.004), amber);
      bar.position.set(s * 0.021, -H * 0.3 - i * 0.022, 0.093);
      bar.rotation.z = s * -0.5;
      bodyG.add(bar);
    });
  });
  // Arms: shoulder pivot, upper arm, elbow, forearm, an amber hand.
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.135, H * 0.28, 0);
    bodyG.add(pivot);
    pivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), joint));
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 8), graphite);
    upper.position.y = -0.065;
    pivot.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.13;
    pivot.add(elbow);
    elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), joint));
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8), graphite);
    fore.position.y = -0.06;
    elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.02), amber);
    hand.position.y = -0.125;
    elbow.add(hand);
    return { side, pivot, elbow, a1: 0, a2: 0 };
  });
  // The hover pad and its glow.
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.025, 0.1), new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.6, metalness: 0.3 }));
  pad.position.y = -H / 2 - 0.035;
  bodyG.add(pad);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color(0xffb24d), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(0.4, 0.14, 1);
  glow.position.y = -H / 2 - 0.09;
  group.add(glow);
  const lamp = new THREE.PointLight(0xffb24d, opts.lamp == null ? 0.3 : opts.lamp, 1.2, 2);
  lamp.position.set(0, 0.05, 0.25);
  group.add(lamp);

  let mood = 'neutral';
  let talking = false;
  let open = false;
  let tTalk = 0;
  let clock = Math.random() * 10;
  let dirty = true;
  function redraw() {
    if (guide && guide.drawBraceFace) guide.drawBraceFace(fctx, mood, fc.width, fc.height, talking && open);
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
        open = false;
        dirty = true;
      }
    },
    update(dt) {
      clock += dt;
      const still = !!opts.reduced;
      bodyG.position.y = still ? 0 : Math.sin(clock * 1.1) * 0.012;
      bodyG.rotation.y = still ? 0 : Math.sin(clock * 0.4) * 0.06;
      glow.material.opacity = 0.42 + 0.06 * Math.sin(clock * 1.1);
      const A = BRACE_ARMS3[mood] || BRACE_ARMS3.neutral;
      const k = 1 - Math.exp(-dt * 6);
      arms.forEach((a, i) => {
        a.a1 += (A[i * 2] - a.a1) * k;
        a.a2 += (A[i * 2 + 1] - a.a2) * k;
        a.pivot.rotation.z = -a.side * a.a1;
        a.elbow.rotation.z = -a.side * a.a2;
      });
      if (talking) {
        tTalk += dt;
        if (tTalk > 0.12) {
          tTalk = 0;
          open = !open;
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

function makePraline(opts = {}) {
  const SMD = globalThis.SMD || {};
  const guide = SMD.team && SMD.team.guide;
  const group = new THREE.Group();
  group.name = 'praline';
  const card = new THREE.Group();
  group.add(card);
  const W = 0.44;
  const Hc = W * 0.8;
  const c = document.createElement('canvas');
  c.width = 350;
  c.height = 280;
  const cx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, Hc), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
  card.add(plane);
  // A thin honey-gold ring behind the portrait and a rock-sugar crystal circling it.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(Hc * 0.47, 0.006, 8, 64), new THREE.MeshBasicMaterial({ color: 0xe8a93a, transparent: true, opacity: 0.7, toneMapped: false }));
  ring.position.set(0, -0.004, -0.004);
  card.add(ring);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), new THREE.MeshStandardMaterial({ color: 0xb48cff, emissive: 0x5a3c9a, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.1 }));
  group.add(crystal);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color(0xe8a93a), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(0.5, 0.16, 1);
  glow.position.y = -Hc / 2 - 0.05;
  group.add(glow);
  const lamp = new THREE.PointLight(0xffd9a0, opts.lamp == null ? 0.3 : opts.lamp, 1.2, 2);
  lamp.position.set(0, 0, 0.25);
  group.add(lamp);

  // Portraits are SVG: drawn to the canvas through an <img>, cached per look.
  const cache = {};
  let want = '';
  function paint(img) {
    cx.clearRect(0, 0, c.width, c.height);
    cx.drawImage(img, 0, 0, c.width, c.height);
    tex.needsUpdate = true;
  }
  function show(key, mood, talk) {
    want = key;
    const hit = cache[key];
    if (hit && hit.complete && hit.naturalWidth) return paint(hit);
    if (hit) return;
    if (!guide || !guide.portrait) return;
    const svg = guide.portrait(mood, { size: 350, talking: talk, guide: 'praline' }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    const img = new Image();
    img.onload = () => {
      if (want === key) paint(img);
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    cache[key] = img;
  }
  let mood = 'neutral';
  let talking = false;
  let open = false;
  let tTalk = 0;
  let clock = Math.random() * 10;
  const refresh = () => show(`${mood}|${talking && open ? 1 : 0}`, mood, talking && open);
  refresh();
  return {
    group,
    setMood(m) {
      if (m !== mood) {
        mood = m || 'neutral';
        refresh();
      }
    },
    setTalking(on) {
      if (!!on !== talking) {
        talking = !!on;
        open = false;
        refresh();
      }
    },
    update(dt) {
      clock += dt;
      const still = !!opts.reduced;
      card.position.y = still ? 0 : Math.sin(clock * 1.2) * 0.014;
      card.rotation.y = still ? 0 : Math.sin(clock * 0.5) * 0.08;
      const a = clock * 0.9;
      crystal.position.set(Math.cos(a) * W * 0.58, Hc * 0.18 + Math.sin(a * 1.3) * 0.03, Math.sin(a) * 0.08);
      crystal.rotation.y += dt * 1.4;
      if (talking) {
        tTalk += dt;
        if (tTalk > 0.15) {
          tTalk = 0;
          open = !open;
          refresh();
        }
      }
    },
    dispose() {
      tex.dispose();
    },
  };
}

const CAIRN_GLOW3 = { neutral: 0x7fe8d8, deadpan: 0x7fe8d8, happy: 0xffd27a, proud: 0xffd27a, wink: 0xffd27a, thinking: 0x9fb8ff, worried: 0x8fa0d8, sad: 0x8196c8, surprised: 0xb6f3ff };
// Hand offsets from the middle stone [lx, ly, rx, ry] in metres.
const CAIRN_HANDS3 = { neutral: [-0.2, -0.04, 0.2, -0.04], deadpan: [-0.19, -0.06, 0.19, -0.06], happy: [-0.23, 0.08, 0.23, 0.08], proud: [-0.2, -0.04, 0.21, 0.17], thinking: [-0.2, -0.05, 0.11, -0.04], worried: [-0.07, -0.13, 0.07, -0.13], sad: [-0.17, -0.13, 0.17, -0.13], surprised: [-0.25, 0.14, 0.25, 0.14], wink: [-0.2, -0.04, 0.23, 0.13] };
function makeCairn(opts = {}) {
  const SMD = globalThis.SMD || {};
  const guide = SMD.team && SMD.team.guide;
  const group = new THREE.Group();
  group.name = 'cairn';
  const bodyG = new THREE.Group();
  group.add(bodyG);
  bodyG.scale.setScalar(0.72); // about KILO's size in the cabin
  const rock = new THREE.MeshStandardMaterial({ color: 0x6a635e, roughness: 0.92, metalness: 0.02, flatShading: true });
  const stone = (r, sx, sy, sz, y) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), rock);
    m.scale.set(sx, sy, sz);
    m.position.y = y;
    bodyG.add(m);
    return m;
  };
  stone(0.15, 1.2, 0.55, 1, -0.2);
  const mid = stone(0.15, 1.05, 0.9, 0.8, 0);
  stone(0.08, 1.1, 0.7, 0.95, 0.17);
  // The geode face: a dark disc with the crystal eyes and mouth drawn on it.
  const fc = document.createElement('canvas');
  fc.width = 200;
  fc.height = 170;
  const fctx = fc.getContext('2d');
  const faceTex = new THREE.CanvasTexture(fc);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, toneMapped: false }));
  face.scale.set(1, 0.85, 1);
  face.position.set(0, 0, 0.122);
  bodyG.add(face);
  // Crystals around the opening.
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x7fe8d8, emissive: 0x2f8f86, emissiveIntensity: 0.8, roughness: 0.2 });
  [[-0.095, 0.06], [0.095, 0.06], [-0.09, -0.065], [0.09, -0.065]].forEach(([x, y]) => {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.015, 0), crystalMat);
    c.position.set(x, y, 0.1);
    c.scale.set(0.7, 1.3, 0.7);
    bodyG.add(c);
  });
  // Pebble hands; the right one carries a small spanner.
  const hands = [-1, 1].map(() => {
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 1), rock);
    h.scale.set(1, 0.85, 0.9);
    bodyG.add(h);
    return h;
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ced8, roughness: 0.35, metalness: 0.8 });
  const spanner = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.08, 0.008), metal);
  shaft.position.y = 0.05;
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.005, 6, 12, Math.PI * 1.5), metal);
  head.position.y = 0.095;
  spanner.add(shaft, head);
  spanner.rotation.z = -0.6;
  hands[1].add(spanner);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color(0x7fe8d8), transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(0.45, 0.14, 1);
  glow.position.y = -0.3;
  group.add(glow);
  const lamp = new THREE.PointLight(0x7fe8d8, opts.lamp == null ? 0.3 : opts.lamp, 1.2, 2);
  lamp.position.set(0, 0, 0.25);
  group.add(lamp);

  let mood = 'neutral';
  let talking = false;
  let open = false;
  let tTalk = 0;
  let clock = Math.random() * 10;
  let dirty = true;
  const handPos = [new THREE.Vector3(-0.2, -0.04, 0.03), new THREE.Vector3(0.2, -0.04, 0.03)];
  function redraw() {
    if (guide && guide.drawCairnFace) guide.drawCairnFace(fctx, mood, fc.width, fc.height, talking && open);
    faceTex.needsUpdate = true;
    const col = CAIRN_GLOW3[mood] || CAIRN_GLOW3.neutral;
    crystalMat.color.setHex(col);
    crystalMat.emissive.setHex(col).multiplyScalar(0.45);
    glow.material.color.setHex(col);
    lamp.color.setHex(col);
    dirty = false;
  }
  redraw();
  void mid;
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
        open = false;
        dirty = true;
      }
    },
    update(dt) {
      clock += dt;
      const still = !!opts.reduced;
      bodyG.position.y = still ? 0 : Math.sin(clock * 1.2) * 0.012;
      bodyG.rotation.y = still ? 0 : Math.sin(clock * 0.45) * 0.08;
      const H = CAIRN_HANDS3[mood] || CAIRN_HANDS3.neutral;
      const k = 1 - Math.exp(-dt * 6);
      hands.forEach((h, i) => {
        handPos[i].x += (H[i * 2] - handPos[i].x) * k;
        handPos[i].y += (H[i * 2 + 1] - handPos[i].y) * k;
        h.position.set(handPos[i].x, handPos[i].y + (still ? 0 : Math.sin(clock * 1.6 + i) * 0.008), 0.03);
      });
      if (talking) {
        tTalk += dt;
        if (tTalk > 0.14) {
          tTalk = 0;
          open = !open;
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

// ---------- v3: View in VR (docs/TEAM-V3.md item 16) ----------
// Only offered when the browser says a headset can start an immersive-vr session.
export async function vrSupported(nav) {
  try {
    const xr = (nav || globalThis.navigator || {}).xr;
    if (!xr || typeof xr.isSessionSupported !== 'function') return false;
    return !!(await xr.isSessionSupported('immersive-vr'));
  } catch (e) {
    return false;
  }
}

// The flight scene in the headset. A second renderer (WebXR, three r160's own
// WebXRManager) draws the same scene from a still viewpoint a few metres from
// the spacecraft, so only your head moves the view. The page's view keeps
// running beside it. opts: { onChange(on), onStall(nowMs) }: onStall fires
// when the page has stopped drawing (standalone headsets pause the page while
// in VR); the view uses it to keep its own clock moving.
export function createVR(api, opts = {}) {
  let renderer = null;
  let session = null;
  let env = null;
  let lastUpdate = performance.now();
  let lastXR = 0;
  const rig = new THREE.Group();
  rig.name = 'vr-rig';
  const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 6e10);
  rig.add(cam);
  // Notice when the page drives the scene (engine.mount calls update()).
  const origUpdate = api.update;
  api.update = function (dt) {
    lastUpdate = performance.now();
    return origUpdate.apply(this, arguments);
  };
  function place() {
    const s = Math.max(3, api.size || 4);
    const d = s * 2.3;
    rig.position.set(d * 0.55, d * 0.1, d * 0.85);
    rig.rotation.set(0, Math.atan2(rig.position.x, rig.position.z), 0);
  }
  function frame() {
    const now = performance.now();
    const dt = lastXR ? Math.min(0.05, (now - lastXR) / 1000) : 0.016;
    lastXR = now;
    if (now - lastUpdate > 150) {
      try {
        if (opts.onStall) opts.onStall(now);
        origUpdate.call(api, dt);
      } catch (e) {}
    }
    const keep = api.scene.environment;
    if (env) api.scene.environment = env;
    try {
      renderer.render(api.scene, cam);
    } finally {
      api.scene.environment = keep;
    }
  }
  function ended() {
    if (renderer) renderer.setAnimationLoop(null);
    api.scene.remove(rig);
    session = null;
    if (opts.onChange) opts.onChange(false);
  }
  return {
    rig,
    get active() {
      return !!session;
    },
    async enter() {
      if (session) return true;
      const xr = globalThis.navigator && navigator.xr;
      if (!xr) throw new Error('WebXR is not available');
      const s = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      session = s;
      try {
        if (!renderer) {
          renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.xr.enabled = true;
          renderer.xr.setReferenceSpaceType('local');
          import('../../vendor/RoomEnvironment.js')
            .then(({ RoomEnvironment }) => {
              if (!renderer) return;
              const pm = new THREE.PMREMGenerator(renderer);
              env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
              pm.dispose();
            })
            .catch(() => {});
        }
        place();
        api.scene.add(rig);
        s.addEventListener('end', ended);
        await renderer.xr.setSession(s);
        renderer.setAnimationLoop(frame);
        if (opts.onChange) opts.onChange(true);
        return true;
      } catch (e) {
        try {
          await s.end();
        } catch (err) {}
        ended();
        throw e;
      }
    },
    async exit() {
      if (session) await session.end().catch(() => {});
    },
    dispose() {
      if (session) session.end().catch(() => {});
      api.update = origUpdate;
      api.scene.remove(rig);
      if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.dispose();
        renderer = null;
      }
      if (env) env.dispose();
    },
  };
}
