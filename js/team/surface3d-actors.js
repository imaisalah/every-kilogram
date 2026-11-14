// Surface renderer, part 3 of 3: what stands on the ground. Procedural models
// for the lander, the dish, science sites, samples, canisters and the suit
// gear (backpack, helmet, handheld scanner). Every builder returns plain
// objects the main renderer (surface3d.js) drives from the sim state.
import { THREE } from '../3d/engine.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { beamMaterial, haloMaterial, lampify, LOG_V_PARS, LOG_V, LOG_F_PARS, LOG_F } from './surface3d-fx.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ROLE_COLORS = { planner: '#24d8ff', engineer: '#46f58a', scientist: '#ff4fb2', comms: '#ff9a1f' };
export const ROLES = ['planner', 'engineer', 'scientist', 'comms'];

// Real gravity for the crew's gait (docs/GRAVITY.md): the world's own, or Earth's with
// Settings > "Realistic gravity" off. Read every frame, so the pause-menu toggle is live.
const SMD_ = (globalThis.SMD = globalThis.SMD || {});
export function realGravityOn() {
  try {
    return !(SMD_.settings && SMD_.settings.realGravity === false);
  } catch (e) {
    return true;
  }
}
export function feelGravity(worldId) {
  const S = SMD_.team && SMD_.team.surface;
  if (!S || !S.feelG) return 9.81;
  return S.feelG(worldId, realGravityOn());
}
// For astro.setGravity(): a live reader for one world.
export function crewGravity(worldId) {
  return () => feelGravity(worldId);
}

// Site colours by what's there to find.
export const SITE_COLORS = { ice: '#7ad4ff', mineral: '#ffc867', atmosphere: '#b18cff', thermal: '#ff7a4a', organic: '#6dff9d' };

function std(color, rough = 0.6, metal = 0.1, extra = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));
}

export function makeLander(lamps) {
  const g = new THREE.Group();
  const foil = lampify(std(0xd9a441, 0.42, 0.35), lamps);
  const white = lampify(std(0xeeeae2, 0.55, 0.05), lamps);
  const dark = lampify(std(0x2a2d33, 0.6, 0.4), lamps);
  const orange = lampify(std(0xe1672a, 0.55, 0.05), lamps);
  const down = new THREE.Group();
  g.add(down);
  // Descent stage: gold octagon on four legs.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.3, 8), foil);
  body.position.y = 1.9;
  down.add(body);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.08, 8), dark);
  deck.position.y = 2.6;
  down.add(deck);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 6), dark);
    leg.position.set(Math.cos(a) * 3.0, 1.0, Math.sin(a) * 3.0);
    leg.rotation.set(Math.sin(a) * 0.42, 0, -Math.cos(a) * 0.42);
    down.add(leg);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.1, 10), foil);
    pad.position.set(Math.cos(a) * 3.55, 0.06, Math.sin(a) * 3.55);
    down.add(pad);
  }
  // Engine bell.
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.0, 0.9, 12), dark);
  bell.position.y = 0.95;
  down.add(bell);
  const ascent = new THREE.Group();
  g.add(ascent);
  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 2.8, 8), white);
  cabin.position.y = 4.1;
  ascent.add(cabin);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.5, 8), white);
  nose.position.y = 6.25;
  ascent.add(nose);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 2.02, 0.3, 8), orange);
  stripe.position.y = 3.2;
  ascent.add(stripe);
  const windowM = new THREE.MeshBasicMaterial({ color: 0x8fdcff, toneMapped: false });
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.1), windowM);
  win.position.set(0, 4.5, 1.8);
  ascent.add(win);
  // Ascent thruster flame, hidden until launch.
  const flameMat = beamMaterial(0xffc27a, { opacity: 0, fade: 1.2 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(1.0, 9, 14, 1, true).translate(0, -4.5, 0), flameMat);
  flame.position.y = 2.6;
  flame.rotation.x = Math.PI;
  flame.userData.noAO = true;
  ascent.add(flame);
  const lightSpots = [];
  for (const [x, z] of [
    [2.9, 2.9],
    [-2.9, 2.9],
    [2.9, -2.9],
    [-2.9, -2.9],
  ]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 5), dark);
    post.position.set(x, 2, z);
    down.add(post);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false }));
    lamp.position.set(x, 4.1, z);
    down.add(lamp);
    lightSpots.push({ x, z });
  }
  // A cone of light from each floodlight, seen in the dark. Lives with the base.
  const beamMats = [];
  for (const spot of lightSpots) {
    const m = beamMaterial(0xffe9bf, { opacity: 0.4, fade: 1.2 });
    const c = new THREE.Mesh(new THREE.ConeGeometry(4.4, 7, 14, 1, true).translate(0, -3.5, 0), m);
    c.position.set(spot.x, 4.0, spot.z);
    c.rotation.x = Math.atan2(spot.z, 6) * 0.25;
    c.rotation.z = -Math.atan2(spot.x, 6) * 0.25;
    down.add(c);
    c.userData.noAO = true;
    beamMats.push(m);
  }
  // Energy shield dome.
  const shieldMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uHit: { value: 0 }, uOn: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `${LOG_V_PARS} varying vec3 vN; varying vec3 vV; varying vec3 vL;
      void main() { vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; ${LOG_V}
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); }`,
    fragmentShader: /* glsl */ `${LOG_F_PARS} uniform float uT, uHit, uOn; varying vec3 vN; varying vec3 vV; varying vec3 vL;
      void main() { ${LOG_F}
        float f = pow(max(0.0, 1.0 - abs(dot(normalize(vN), normalize(vV)))), 2.2);
        float hex = abs(sin(vL.x * 3.4 + vL.y) * sin(vL.z * 3.4 - vL.y)) ;
        float grid = smoothstep(0.92, 1.0, hex);
        vec3 c = mix(vec3(0.3, 0.75, 1.0), vec3(1.0, 0.6, 0.5), clamp(uHit, 0.0, 1.0));
        float a = (f * 0.4 + grid * 0.05 + uHit * (0.08 + f * 0.5)) * uOn;
        gl_FragColor = vec4(c, a); }`,
  });
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.55), shieldMat);
  shield.visible = false;
  shield.userData.noAO = true;
  g.add(shield);
  g.traverse((o) => {
    if (o.isMesh && !(o.userData.noAO || o.material.transparent || o.material.isMeshBasicMaterial)) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return {
    group: g,
    ascent,
    flameMat,
    flame,
    shield,
    shieldMat,
    beamMats,
    setShield(on, r, t, hitK) {
      shield.visible = on;
      if (!on) return;
      shield.scale.setScalar(r);
      shieldMat.uniforms.uOn.value = 1;
      shieldMat.uniforms.uT.value = t;
      shieldMat.uniforms.uHit.value = hitK;
    },
    setFlood(k, t) {
      beamMats.forEach((m) => {
        m.uniforms.uOpacity.value = 0.4 * k;
        m.uniforms.uTime.value = t;
      });
    },
    lampSpots: lightSpots,
  };
}

export function makeDish(lamps) {
  const g = new THREE.Group();
  const metal = lampify(std(0xc9cdd3, 0.42, 0.45), lamps);
  const dark = lampify(std(0x33363c, 0.6, 0.3), lamps);
  // Tripod.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.28;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.5, 6), dark);
    leg.position.set(Math.cos(a) * 0.5, 0.7, Math.sin(a) * 0.5);
    leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(leg);
  }
  const head = new THREE.Group();
  head.position.y = 1.4;
  g.add(head);
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const r = (i / 16) * 1.7;
    pts.push(new THREE.Vector2(r, (r * r) / 2.1));
  }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 26), lampify(std(0xe8e6df, 0.35, 0.3, { side: THREE.DoubleSide }), lamps));
  head.add(dish);
  head.rotation.x = -0.45;
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), dark);
  feed.position.y = 0.55;
  head.add(feed);
  const feedHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff9a1f, toneMapped: false }));
  feedHead.position.y = 1.15;
  head.add(feedHead);
  // Uplink beam: the thing you are defending.
  const beamMat = beamMaterial(0x6fd0ff, { opacity: 0, fade: 1.0 });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.26, 70, 16, 1, true).translate(0, 35, 0), beamMat);
  beam.position.y = 1.1;
  beam.userData.noAO = true;
  head.add(beam);
  const planted = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.9, 32).rotateX(-Math.PI / 2), haloMaterial(0x6fd0ff, 0.0));
  planted.position.y = 0.08;
  g.add(planted);
  g.traverse((o) => {
    if (o.isMesh && !o.material.transparent && !o.material.isMeshBasicMaterial) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return {
    group: g,
    head,
    beamMat,
    planted,
    setState(state, t, align, bright) {
      const live = state === 'transmit';
      beamMat.uniforms.uOpacity.value = live ? 0.55 * bright : 0;
      beamMat.uniforms.uTime.value = t;
      planted.material.opacity = (state === 'planted' || live ? 0.6 : 0) * align;
      head.rotation.x = -0.45 - (1 - align) * 0.4 + (live ? Math.sin(t * 1.3) * 0.02 : 0);
    },
  };
}

export function makeSite(kind, lamps) {
  const g = new THREE.Group();
  const col = new THREE.Color(SITE_COLORS[kind] || '#ffffff');
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), lampify(std(0x4d4a48, 0.9, 0.02, { flatShading: true }), lamps));
  rock.scale.set(1.1, 0.7, 1);
  rock.position.y = 0.45;
  rock.castShadow = true;
  g.add(rock);
  const crystalMat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.28;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.1 + (i % 2) * 0.05, 0.7 + (i % 3) * 0.2, 5), crystalMat);
    c.position.set(Math.cos(a) * 0.55, 0.7, Math.sin(a) * 0.55);
    c.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    g.add(c);
  }
  const ringGeo = new THREE.RingGeometry(1.7, 2.3, 48).rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, haloMaterial(col, 0));
  ring.position.y = 0.09;
  ring.userData.noAO = true;
  g.add(ring);
  // Progress ring: built around an angle so the scan fills it.
  const progMat = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color(0xffffff) }, uA: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `${LOG_V_PARS} varying vec2 vP; void main(){ vP = position.xz; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; ${LOG_V}}`,
    fragmentShader: /* glsl */ `${LOG_F_PARS} uniform float uK; uniform float uA; uniform vec3 uCol; varying vec2 vP;
      void main(){ ${LOG_F}
        float ang = (atan(vP.x, -vP.y) + 3.14159265) / 6.2831853;
        float on = step(ang, uK);
        gl_FragColor = vec4(uCol * (on > 0.5 ? 1.0 : 0.22), uA * (0.32 + on * 0.68)); }`,
  });
  const progress = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.7, 56).rotateX(-Math.PI / 2), progMat);
  progress.position.y = 0.1;
  progress.userData.noAO = true;
  g.add(progress);
  // Pillar of light: only while there is something to find.
  const pillarMat = beamMaterial(col.getHex(), { opacity: 0, fade: 0.8 });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.6, 26, 18, 1, true).translate(0, 13, 0), pillarMat);
  pillar.userData.noAO = true;
  g.add(pillar);
  const tick = (t) => {
    ring.rotation.y = t * 0.35;
  };
  return {
    group: g,
    pillarMat,
    ring,
    progMat,
    setState(state, revealed, done, progressK, t) {
      const on = revealed && !done && state !== 'blocked';
      // A steady pillar: calm, never blinking. Brighter while someone scans.
      pillarMat.uniforms.uOpacity.value = on ? (state === 'scanning' ? 0.5 : 0.34) : 0;
      pillarMat.uniforms.uTime.value = t;
      ring.material.opacity = on ? 0.55 : done ? 0.14 : 0.08;
      progMat.uniforms.uK.value = clamp(progressK);
      progMat.uniforms.uA.value = on || done ? 1 : 0.2;
      tick(t);
    },
  };
}

export function makeSample(kind, lamps) {
  const g = new THREE.Group();
  const col = new THREE.Color(SITE_COLORS[kind] || '#ffffff');
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 8), lampify(std(0xcfcfc8, 0.4, 0.3), lamps));
  body.position.y = 0.25;
  body.castShadow = true;
  g.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 8), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
  cap.position.y = 0.45;
  g.add(cap);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.5, 24).rotateX(-Math.PI / 2), haloMaterial(col, 0.5));
  halo.position.y = 0.06;
  g.add(halo);
  return { group: g, halo };
}

const PICKUP_COLOR = { energy: '#ffe14a', o2: '#7ad4ff' };
export function makePickup(item) {
  const g = new THREE.Group();
  const col = new THREE.Color(PICKUP_COLOR[item] || '#ffffff');
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
  core.position.y = 0.55;
  g.add(core);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 24).rotateX(-Math.PI / 2), haloMaterial(col, 0.5));
  ring.position.y = 0.06;
  g.add(ring);
  return {
    group: g,
    update(t) {
      core.rotation.y = t * 0.8;
      core.position.y = 0.55 + Math.sin(t * 1.4) * 0.05;
    },
  };
}


// The life-support pack on the crew's backs. Local axes follow the torso joint:
// the back is -z.
export function makeBackpack(role, lamps) {
  const col = new THREE.Color(ROLE_COLORS[role] || '#ffffff');
  const dark = lampify(std(0x2c2f36, 0.65, 0.2), lamps);
  const white = lampify(std(0xdadad3, 0.55, 0.08), lamps);
  const light = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.1), toneMapped: false });
  const g = new THREE.Group();
  const mkBox = (x, y, z, at) => {
    const b = new THREE.BoxGeometry(x, y, z);
    b.translate(at[0], at[1], at[2]);
    return b.toNonIndexed();
  };
  const body = mergeGeometries([
    mkBox(0.34, 0.5, 0.16, [0, 0.04, -0.2]),
    mkBox(0.3, 0.12, 0.18, [0, 0.33, -0.2]),
    mkBox(0.08, 0.34, 0.06, [0.17, -0.06, -0.26]),
    mkBox(0.08, 0.34, 0.06, [-0.17, -0.06, -0.26]),
    mkBox(0.22, 0.05, 0.05, [0, -0.2, -0.27]),
  ]);
  const shell = new THREE.Mesh(body, white);
  shell.castShadow = true;
  g.add(shell);
  const trim = mergeGeometries([mkBox(0.36, 0.02, 0.18, [0, 0.27, -0.2]), mkBox(0.36, 0.02, 0.18, [0, -0.21, -0.2]), mkBox(0.05, 0.05, 0.05, [0.12, 0.33, -0.3])]);
  g.add(new THREE.Mesh(trim, dark));
  const lamp = new THREE.Mesh(mergeGeometries([mkBox(0.2, 0.024, 0.01, [0, 0.14, -0.285]), mkBox(0.2, 0.024, 0.01, [0, -0.08, -0.285])]), light);
  g.add(lamp);
  g.position.set(0, 0.08, 0);
  return g;
}

// So the helmet from behind is more than a ball: a rear shell, a ridge, a lamp.
export function makeHelmetBack(role, lamps) {
  const col = new THREE.Color(ROLE_COLORS[role] || '#ffffff');
  const dark = lampify(std(0x2c2f36, 0.55, 0.3), lamps);
  const light = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
  const g = new THREE.Group();
  const bits = [new THREE.BoxGeometry(0.03, 0.2, 0.11).translate(0, 0.02, -0.18), new THREE.BoxGeometry(0.1, 0.05, 0.05).translate(0, -0.09, -0.19), new THREE.BoxGeometry(0.06, 0.03, 0.05).translate(0.07, 0.1, -0.13)].map((b) => b.toNonIndexed());
  g.add(new THREE.Mesh(mergeGeometries(bits), dark));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.022, 0.012).translate(0, -0.03, -0.205), light);
  g.add(stripe);
  return g;
}

// The handheld science instrument: what the crew carries instead of anything
// that shoots. Forward is +z, the grip is at the origin. The screen and the
// lens glow softly; setActive brightens them while a scan runs.
export function makeScanner(lamps) {
  const g = new THREE.Group();
  const shell = lampify(std(0xe4e6ea, 0.5, 0.12), lamps);
  const dark = lampify(std(0x30343c, 0.55, 0.35), lamps);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.22).translate(0, 0.02, 0.07), shell);
  g.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.05).translate(0, -0.045, 0.0), dark);
  g.add(grip);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.06, 14).rotateX(Math.PI / 2).translate(0, 0.02, 0.2), dark);
  g.add(head);
  const lensM = new THREE.MeshBasicMaterial({ color: 0x8fe8ff, toneMapped: false });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16).translate(0, 0.02, 0.231), lensM);
  g.add(lens);
  const screenM = new THREE.MeshBasicMaterial({ color: 0x5fd6c6, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.1).rotateX(-Math.PI / 2 + 0.5).translate(0, 0.062, 0.05), screenM);
  g.add(screen);
  g.traverse((o) => {
    if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = true;
  });
  const base = { lens: new THREE.Color(0x8fe8ff), screen: new THREE.Color(0x5fd6c6) };
  return {
    group: g,
    lens,
    setActive(k) {
      const b = 0.55 + clamp(k) * 0.9;
      lensM.color.copy(base.lens).multiplyScalar(b);
      screenM.color.copy(base.screen).multiplyScalar(0.7 + clamp(k) * 0.5);
    },
  };
}
