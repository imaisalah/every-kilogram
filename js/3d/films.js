// Mission films: short, skippable cinematics for the launch and the arrival.
// Nothing here is interactive. A film is a list of shots on a clock; each shot
// belongs to a "set" (its own scene and camera) and the engine renders
// whichever set is on screen. Captions, sounds and HUD values are cues on the
// same clock, handed to the screen through onCue.
import { THREE, studioEnv, disposeTree } from './engine.js';
import { makePlanet, makeStars, makeSun, softDot, canvasTex, fbm } from './assets.js';
import { buildCraft, setDeploy } from './craft.js';
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
const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const reduced = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};

// ---------- Real NASA maps ----------
// Asset ids from js/3d/assetmanifest.js, for the credit line.
const TEX_ID = { earth: 'earth-day', clouds: 'earth-clouds', moon: 'moon', mars: 'mars', venus: 'venus-radar', jupiter: 'jupiter', europa: 'europa' };

export function mapCredit(kind) {
  const A = SMD.assets;
  const t = A && A.textures && A.textures[TEX_ID[kind]];
  return t ? t.credit : '';
}

// A planet or moon with its real NASA map (makePlanet loads it and keeps a
// procedural stand-in until it arrives). Close shots ask for the full map.
// opts: segments, res (<= 512 picks the small map), sunDir (adds the limb
// glow unless atmo is false), clouds (false hides Earth's clouds).
function body(kind, radius, opts = {}) {
  const g = makePlanet(kind, radius, { segments: opts.segments || 128, res: opts.res || 2048, glow: !!opts.sunDir && opts.atmo !== false });
  if (opts.clouds === false && kind === 'earth' && g.userData.clouds) g.userData.clouds.visible = false;
  // Fade the limb glow (close to the ground it would wash the surface out).
  g.userData.setGlow = (k) =>
    (g.userData.atmosphere || []).forEach((m) => {
      const u = m.material.uniforms.uGain;
      if (u.base === undefined) u.base = u.value;
      u.value = u.base * k;
    });
  return g;
}

// Direction of a latitude/longitude on a makePlanet sphere (longitude 0 on +X).
function latLonDir(lat, lon) {
  const p = lat * DEG;
  const l = lon * DEG;
  return new THREE.Vector3(Math.cos(p) * Math.cos(l), Math.sin(p), -Math.cos(p) * Math.sin(l));
}

// Turn a planet so the given place is on top (+Y) with east along +X.
function placeOnTop(group, lat, lon) {
  const up = latLonDir(lat, lon);
  const l = lon * DEG;
  const east = new THREE.Vector3(-Math.sin(l), 0, -Math.cos(l)).normalize();
  const south = new THREE.Vector3().crossVectors(east, up).normalize();
  const B = new THREE.Matrix4().makeBasis(east, up, south);
  group.quaternion.setFromRotationMatrix(B.invert());
}

// ---------- Small helpers ----------
function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}

// A screen-sized dot that stays visible from any distance.
function marker(color, px = 0.03) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(px);
  s.renderOrder = 20;
  return s;
}

// Text label as a sprite (keeps a constant size on screen).
function label(text, color = '#e9eef2', h = 0.026) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = "600 40px Archivo, 'Noto Kufi Arabic', 'Arial Narrow', sans-serif";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  c.width = w;
  c.height = 60;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(16,25,34,0.55)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 6, w, 48, 10);
  else ctx.rect(0, 6, w, 48);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, 14, 31);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false }));
  s.scale.set((h * w) / 60, h, 1);
  s.center.set(-0.12, 0.5);
  s.renderOrder = 21;
  return s;
}

function line(points, color, opacity = 1) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}

function ring(r, color, opacity, n = 256) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3(r * Math.cos((i / n) * Math.PI * 2), 0, -r * Math.sin((i / n) * Math.PI * 2)));
  return line(pts, color, opacity);
}

// Soft particles with real per-particle alpha and size (smoke must fade out,
// not fade to black). Works with the renderer's logarithmic depth buffer.
function puffs(max, additive = false) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const alp = new Float32Array(max);
  const siz = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alp, 1));
  geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: softDot() }, scale: { value: 600 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color;
      uniform float scale; varying float vA; varying vec3 vC;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vA = alpha; vC = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = alpha > 0.001 ? clamp(size * scale / max(0.1, -mv.z), 1.0, 900.0) : 0.0;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC;
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        float a = texture2D(map, gl_PointCoord).a * vA;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vC, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const P = [];
  for (let i = 0; i < max; i++) P.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s0: 1, s1: 1, c0: new THREE.Color(), c1: new THREE.Color(), a: 1 });
  let next = 0;
  const tmpC = new THREE.Color();
  return {
    points: pts,
    material: mat,
    emit(p, v, life, s0, s1, c0, c1, a = 1) {
      const q = P[next];
      next = (next + 1) % max;
      q.p.copy(p);
      q.v.copy(v);
      q.life = q.max = life;
      q.s0 = s0;
      q.s1 = s1;
      q.c0.set(c0);
      q.c1.set(c1 === undefined ? c0 : c1);
      q.a = a;
    },
    update(dt, drag = 0, lift = 0) {
      for (let i = 0; i < max; i++) {
        const q = P[i];
        if (q.life > 0) {
          q.life -= dt;
          q.p.addScaledVector(q.v, dt);
          if (drag) q.v.multiplyScalar(Math.max(0, 1 - drag * dt));
          if (lift) q.v.y += lift * dt;
        }
        const age = 1 - Math.max(0, q.life) / q.max;
        const alive = q.life > 0;
        pos[i * 3] = q.p.x;
        pos[i * 3 + 1] = q.p.y;
        pos[i * 3 + 2] = q.p.z;
        tmpC.copy(q.c0).lerp(q.c1, age);
        col[i * 3] = tmpC.r;
        col[i * 3 + 1] = tmpC.g;
        col[i * 3 + 2] = tmpC.b;
        alp[i] = alive ? q.a * Math.min(1, age * 10) * Math.pow(1 - age, 1.3) : 0;
        siz[i] = lerp(q.s0, q.s1, age);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.alpha.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
    },
    clear() {
      P.forEach((q) => (q.life = 0));
    },
  };
}

const INST_COLOR = { sounder: 0x9ec5f4, iceRadar: 0x7fd1ff, sar: 0xc6a6ff, hires: 0xf0b429, context: 0xe9eef2, irspec: 0xf06a5f, neutron: 0x3fc1b4, mag: 0x3fc1b4, uso: 0x9ec5f4 };
const BEAMED = ['sounder', 'iceRadar', 'sar', 'hires', 'context', 'irspec', 'neutron'];

// ---------- Launchers ----------
// Generic rockets sized to the three launcher classes (metres). No real
// vehicle and no insignia: a carbon light launcher, a white medium launcher
// with two solid boosters, and an orange-foam heavy with two side cores.
// s1 / s2: stage lengths; fair: fairing length; r: core radius.
export const ROCKET_LOOKS = {
  light: { id: 'light', r: 1.0, s1: 17, s2: 5, fair: 6, fr: 1.2, body: '#25282c', band: '#e9eef2', bells: 5, solids: 0, cores: 0 },
  medium: { id: 'medium', r: 1.9, s1: 32, s2: 11, fair: 12, fr: 1.1, body: '#eceff1', band: '#1b1e22', bells: 2, solids: 2, cores: 0 },
  heavy: { id: 'heavy', r: 2.5, s1: 40, s2: 13, fair: 17, fr: 1.08, body: '#d8813f', band: '#2a2420', bells: 1, solids: 0, cores: 2 },
  // SLS Block 1 class: an 8.4 m orange core with four engines, two long white
  // solid boosters, a 5 m upper stage, and the crew capsule on top (no fairing).
  superheavy: { id: 'superheavy', r: 4.2, s1: 65, s2: 13.7, s2r: 2.5, fair: 0, fr: 1, body: '#d8813f', band: '#2a2420', bells: 4, solids: 2, solidLen: 0.83, solidR: 0.44, cores: 0, crew: true, foam: true },
};
const INTERSTAGE = 2.2;

const rocketTexCache = {};
// Stage skin: stringer lines, weld rings, a dark band and the agency's name
// running down the side the way real rockets carry their operator's name.
function stageSkin(look, text, key) {
  const id = `${look.id}:${key}:${text}`;
  if (rocketTexCache[id]) return rocketTexCache[id];
  const tex = canvasTex(512, 1024, (ctx, w, h) => {
    ctx.fillStyle = look.body;
    ctx.fillRect(0, 0, w, h);
    // Foam or paint mottling.
    const img = ctx.getImageData(0, 0, w, h);
    for (let j = 0; j < h; j += 2)
      for (let i = 0; i < w; i += 2) {
        const n = (fbm(i / 40, j / 40, 0.5, 3, 5) - 0.5) * (look.id === 'heavy' || look.foam ? 46 : 14);
        for (let dj = 0; dj < 2; dj++)
          for (let di = 0; di < 2; di++) {
            const k = ((j + dj) * w + i + di) * 4;
            img.data[k] = clamp(img.data[k] + n, 0, 255);
            img.data[k + 1] = clamp(img.data[k + 1] + n, 0, 255);
            img.data[k + 2] = clamp(img.data[k + 2] + n * 0.8, 0, 255);
          }
      }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 24) * w, 0);
      ctx.lineTo((i / 24) * w, h);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    for (let j = 1; j < 6; j++) {
      ctx.beginPath();
      ctx.moveTo(0, (j / 6) * h);
      ctx.lineTo(w, (j / 6) * h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (key === 's1') {
      ctx.fillStyle = look.band;
      ctx.fillRect(0, 0, w, h * 0.035);
      ctx.fillRect(0, h * 0.965, w, h * 0.035);
    }
    if (text) {
      // Vertical lettering on the camera-facing side (u ~ 0.25 faces +X).
      ctx.save();
      ctx.translate(w * 0.25, h * 0.5);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = look.id === 'light' ? '#e9eef2' : '#1b1e22';
      ctx.font = "800 54px Archivo, 'Noto Kufi Arabic', 'Arial Narrow', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.toUpperCase().slice(0, 26), 0, 0, h * 0.8);
      ctx.restore();
    }
  });
  tex.anisotropy = 4;
  tex.userData.keep = true;
  rocketTexCache[id] = tex;
  return tex;
}

let rocketMats = null;
function rocketMaterials() {
  if (rocketMats) return rocketMats;
  rocketMats = {
    bell: new THREE.MeshStandardMaterial({ color: 0x3a3632, metalness: 0.85, roughness: 0.42, side: THREE.DoubleSide }),
    bellHot: new THREE.MeshStandardMaterial({ color: 0x5a4636, metalness: 0.7, roughness: 0.5, emissive: 0x2a0c02, side: THREE.DoubleSide }),
    nio: new THREE.MeshStandardMaterial({ color: 0x5b5048, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }),
    black: new THREE.MeshStandardMaterial({ color: 0x17191c, metalness: 0.2, roughness: 0.55 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf1f3f4, metalness: 0.05, roughness: 0.5 }),
    fairIn: new THREE.MeshStandardMaterial({ color: 0xd9dcd6, metalness: 0, roughness: 0.9, side: THREE.DoubleSide }),
    adapter: new THREE.MeshStandardMaterial({ color: 0x8e969e, metalness: 0.8, roughness: 0.35 }),
    solid: new THREE.MeshStandardMaterial({ color: 0xe6e8e9, metalness: 0.1, roughness: 0.55 }),
  };
  Object.values(rocketMats).forEach((m) => (m.userData.keep = true));
  return rocketMats;
}

// A bell nozzle (exit at y=0, throat up), radius re at the exit.
function bell(re, len, mat) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    pts.push(new THREE.Vector2(re * (0.32 + 0.68 * Math.pow(1 - k, 1.6)), k * len));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 28), mat);
}

// The rocket stands on its first-stage nozzles at y = 0, nose up (+Y).
// userData: length, s1 (first stage + boosters), s2 (upper stage), halves.
export function rocketMesh(look, agencyName = '') {
  const M = rocketMaterials();
  const r = look.r;
  const root = new THREE.Group();
  const bellLen = r * 0.9;
  const s1 = new THREE.Group();
  root.add(s1);
  const skin1 = new THREE.MeshStandardMaterial({ map: stageSkin(look, agencyName, 's1'), metalness: 0.15, roughness: 0.55 });
  const tank1 = new THREE.Mesh(new THREE.CylinderGeometry(r, r, look.s1 - bellLen, 48), skin1);
  tank1.position.y = bellLen + (look.s1 - bellLen) / 2;
  s1.add(tank1);
  // Thrust section skirt and engines.
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, bellLen * 0.5, 48, 1, true), M.black);
  skirt.position.y = bellLen * 1.2;
  s1.add(skirt);
  const nb = look.bells;
  for (let i = 0; i < nb; i++) {
    const re = nb === 1 ? r * 0.62 : nb === 2 ? r * 0.42 : r * 0.3;
    const b = bell(re, bellLen, M.bellHot);
    if (nb > 1) {
      const a = (i / (nb === 5 ? 4 : nb)) * Math.PI * 2;
      const rr = nb === 2 ? r * 0.44 : r * 0.55;
      if (nb === 5 && i === 4) b.position.set(0, 0, 0);
      else b.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    }
    s1.add(b);
  }
  // Interstage hides the upper-stage nozzle until staging (a cone when the upper stage is narrower).
  const inter = new THREE.Mesh(new THREE.CylinderGeometry(look.s2r || r, r, INTERSTAGE, 48, 1, true), look.s2r ? M.white : M.black);
  inter.position.y = look.s1 + INTERSTAGE / 2;
  s1.add(inter);
  // Strap-on solids or side cores (they leave with the first stage).
  const side = (rb, len, mat, nose) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rb, rb, len, 32), mat);
    c.position.y = bellLen * 0.6 + len / 2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rb, nose, 32), mat);
    cone.position.y = bellLen * 0.6 + len + nose / 2;
    const n = bell(rb * 0.7, bellLen * 0.6, M.bell);
    g.add(c, cone, n);
    return g;
  };
  [-1, 1].forEach((sd) => {
    if (look.solids) {
      const rb = r * (look.solidR || 0.42);
      const g = side(rb, look.s1 * (look.solidLen || 0.5), M.solid, rb * 3);
      g.position.z = sd * (r + rb * 0.95);
      s1.add(g);
    }
    if (look.cores) {
      const skinC = new THREE.MeshStandardMaterial({ map: stageSkin(look, '', 'core'), metalness: 0.15, roughness: 0.6 });
      const g = side(r, look.s1 - bellLen * 0.6, skinC, r * 2.6);
      const b = g.children[2];
      b.geometry.dispose();
      g.remove(b);
      const bb = bell(r * 0.62, bellLen, M.bellHot);
      g.add(bb);
      g.position.z = sd * r * 2.06;
      s1.add(g);
    }
  });

  // Upper stage: origin at its base, nozzle hanging below in the interstage.
  const s2 = new THREE.Group();
  s2.position.y = look.s1 + INTERSTAGE;
  root.add(s2);
  const skin2 = new THREE.MeshStandardMaterial({ map: stageSkin(look, '', 's2'), metalness: 0.15, roughness: 0.55 });
  const r2 = look.s2r || r;
  const tank2 = new THREE.Mesh(new THREE.CylinderGeometry(r2, r2, look.s2, 48), look.id === 'medium' ? M.white : skin2);
  tank2.position.y = look.s2 / 2;
  s2.add(tank2);
  const vac = bell(r2 * 0.5, INTERSTAGE * 0.92, M.nio);
  vac.position.y = -INTERSTAGE * 0.95;
  s2.add(vac);
  const adapter = new THREE.Mesh(new THREE.CylinderGeometry(r2 * 0.45, r2 * 0.8, 0.4, 32), M.adapter);
  adapter.position.y = look.s2 + 0.2;
  s2.add(adapter);
  // Fairing: two clam-shell halves (tangent-ogive nose), hinged at the base.
  const rf = r * look.fr;
  const fpts = [new THREE.Vector2(r, 0), new THREE.Vector2(rf, look.fair * 0.06)];
  const cyl = look.fair * 0.52;
  fpts.push(new THREE.Vector2(rf, cyl));
  const nose = look.fair - cyl;
  const rho = (rf * rf + nose * nose) / (2 * rf);
  for (let i = 1; i <= 14; i++) {
    const y = (i / 14) * nose;
    const x = Math.sqrt(Math.max(0, rho * rho - y * y)) + rf - rho;
    fpts.push(new THREE.Vector2(Math.max(0.02, x), cyl + y));
  }
  const halves = (look.crew ? [] : [0, 1]).map((h) => {
    const g = new THREE.Group();
    const geo = new THREE.LatheGeometry(fpts, 24, h ? Math.PI / 2 : -Math.PI / 2, Math.PI);
    const outer = new THREE.Mesh(geo, M.white);
    const inner = new THREE.Mesh(geo, M.fairIn);
    inner.scale.setScalar(0.985);
    g.add(outer, inner);
    g.position.y = look.s2 + 0.05;
    s2.add(g);
    return g;
  });
  // Seam line down the fairing.
  root.userData = { length: look.s1 + INTERSTAGE + look.s2 + look.fair, s1, s2, fair: look.fair, halves, look, payloadY: look.s1 + INTERSTAGE + look.s2 + 0.4 };
  root.traverse((o) => o.isMesh && (o.castShadow = false));
  return root;
}

// The crew stack: the super heavy rocket with the capsule, its service module
// (wings folded inside white fairing panels) and the abort tower on top.
// userData adds: craft, smFairing (panels), height (to the tip).
export function crewRocket(design, agencyName = '') {
  const look = ROCKET_LOOKS.superheavy;
  const rocket = rocketMesh(look, agencyName);
  const craft = buildCraft(design, {});
  setDeploy(craft, 0);
  const y0 = rocket.userData.payloadY;
  craft.position.y = y0 + 4.4;
  rocket.userData.s2.add(craft);
  craft.position.y -= rocket.userData.s2.position.y;
  // Spacecraft adapter and the three fairing panels around the service module.
  const M = rocketMaterials();
  const osa = new THREE.Mesh(new THREE.CylinderGeometry(2.6, look.s2r, 1.2, 40, 1, true), M.white);
  osa.position.y = y0 + 0.6 - rocket.userData.s2.position.y;
  rocket.userData.s2.add(osa);
  const smFairing = [0, 1, 2].map((k) => {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, 3.2, 16, 1, true, (k / 3) * Math.PI * 2, (Math.PI * 2) / 3), M.white);
    g.position.y = y0 + 3.0 - rocket.userData.s2.position.y;
    rocket.userData.s2.add(g);
    return g;
  });
  rocket.userData.craft = craft;
  rocket.userData.smFairing = smFairing;
  rocket.userData.height = y0 + 4.4 + (craft.userData.top || 4);
  return rocket;
}

// Exhaust: a hot core and an outer flame (shader cones, additive), a glow at
// the nozzle and a light that paints the pad and the smoke.
const PLUME_VS = `varying float vT; varying vec3 vN; varying vec3 vV;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vT = -position.y;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;
const PLUME_FS = `uniform float uK; uniform float uThin; uniform float uTime; uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uTail;
  varying float vT; varying vec3 vN; varying vec3 vV;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float t = clamp(vT, 0.0, 1.0);
    float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.35);
    vec3 col = mix(uCore, uMid, smoothstep(0.0, 0.32, t));
    col = mix(col, uTail, smoothstep(0.32, 1.0, t));
    float diamonds = 1.0 + 0.6 * pow(max(0.0, sin(t * 34.0)), 8.0) * (1.0 - t) * (1.0 - uThin);
    float flick = 0.9 + 0.1 * sin(uTime * 53.0 + t * 20.0);
    float a = rim * pow(1.0 - t, 1.5) * smoothstep(0.0, 0.04, t + 0.02) * uK * diamonds * flick;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`;
function plumeCone(core) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const k = i / 16;
    const rad = core ? 0.55 * (1 - Math.pow(k, 1.4)) + 0.05 : 0.45 + 0.75 * Math.sqrt(k);
    pts.push(new THREE.Vector2(Math.max(0.01, rad), -k));
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uK: { value: 1 },
      uThin: { value: 0 },
      uTime: { value: 0 },
      uCore: { value: new THREE.Color(core ? 0xfffbea : 0xfff0c0) },
      uMid: { value: new THREE.Color(core ? 0xffe2a0 : 0xff9a3a) },
      uTail: { value: new THREE.Color(core ? 0xff9a50 : 0xb8401a) },
    },
    vertexShader: PLUME_VS,
    fragmentShader: PLUME_FS,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mat);
  mesh.frustumCulled = false;
  return mesh;
}
// look: the rocket look; main = first stage (several cores) or the upper stage.
export function rocketPlume(look, main = true) {
  const g = new THREE.Group();
  const spots = main && look.cores ? [0, -1, 1].map((z) => z * look.r * 2.06) : [0];
  g.userData.parts = spots.map((z) => {
    const outer = plumeCone(false);
    const core = plumeCone(true);
    const p = new THREE.Group();
    p.add(outer, core);
    p.position.z = z;
    g.add(p);
    return { p, outer, core };
  });
  const halo = glow(main ? 0xffc27a : 0xbfd6ff, 1, 0.9);
  g.add(halo);
  g.userData.halo = halo;
  if (main) {
    const light = new THREE.PointLight(0xffa04a, 0, 0, 2);
    light.position.y = -look.r * 3;
    g.add(light);
    g.userData.light = light;
  }
  g.userData.look = look;
  g.userData.vacuum = !main;
  return g;
}
// length and width in metres; k: 0..1 throttle/ignition; thin: 0 sea level, 1 vacuum.
export function setRocketPlume(flame, len, width, k, thin = 0, time = 0) {
  const u = flame.userData;
  u.parts.forEach(({ outer, core }) => {
    outer.scale.set(width, len, width);
    core.scale.set(width * 0.9, Math.min(len, width * (u.vacuum ? 3 : 4.5)), width * 0.9);
    [outer, core].forEach((m) => {
      m.material.uniforms.uK.value = k * (m === core ? 0.85 : 0.75);
      m.material.uniforms.uThin.value = u.vacuum ? 1 : thin;
      m.material.uniforms.uTime.value = time;
    });
    if (u.vacuum) {
      outer.material.uniforms.uMid.value.setHex(0xa8c4ff);
      outer.material.uniforms.uTail.value.setHex(0x3b4f9a);
    }
  });
  u.halo.scale.setScalar(width * (u.vacuum ? 3 : 6) * (0.6 + 0.4 * k));
  u.halo.material.opacity = 0.85 * k;
  if (u.light) {
    const L = u.look.s1 + u.look.s2 + u.look.fair;
    u.light.intensity = L * L * 14 * k * (1 - thin);
  }
}

// An instrument's field of view as a soft light cone: brightest along its
// axis, fading at the edges and toward the ground.
function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uOp: { value: 0.5 } },
    vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vT = -position.y;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 uC; uniform float uOp; varying float vT; varying vec3 vN; varying vec3 vV;
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        float core = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float a = uOp * core * (0.25 + 0.75 * (1.0 - vT)) * smoothstep(0.0, 0.06, vT);
        gl_FragColor = vec4(uC, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

// ======================================================================
export function createFilm({ project, kind, onCue, onFrame }) {
  const A = SMD.agency;
  const D = SMD.data;
  const P = SMD.physics;
  const p = project;
  const design = p.design;
  const m = D.MISSIONS[p.missionKey];
  const timeline = ((p.flight && p.flight.timeline) || []).slice().sort((a, b) => a.ms - b.ms);
  const lost = A.flightLost(p);
  let ev = null;
  try {
    ev = SMD.model.evaluate(design, p.launch, { readyMs: p.readyMs });
  } catch (e) {
    ev = null;
  }
  const L = ev && ev.launch;
  const info = { dry: L ? L.dry : 400, prop: L ? L.prop : 150, wet: L ? L.wet : 600, cap: L ? L.capacity : 2000 };
  const destKind = p.missionKey === 'jupiter' ? 'jupiter' : m.dest;
  const name = design.name || 'Spacecraft';
  const agencyName = (SMD.game && SMD.game.agency && SMD.game.agency.name) || '';
  const destName = m.kind === 'earth' ? tr('film.earth', 'Earth') : P.PLANETS[m.dest] ? P.PLANETS[m.dest].name : m.dest;
  const shake = !reduced();

  const sets = [];
  const shots = [];
  const cues = [];
  let vpH = 900;
  let aspect = 1.6;
  let T = 0;
  let fired = 0;
  let cur = null;
  let ended = false;
  let disposed = false;
  const hudLast = {};

  const emit = (c) => onCue && onCue(c);
  const cue = (t, type, data = {}) => cues.push({ t, type, ...data });
  const hud = (key, label, value) => {
    if (hudLast[key] === value) return;
    hudLast[key] = value;
    emit({ type: 'hud', key, label, value });
  };
  const shot = (t0, t1, set, update) => shots.push({ t0, t1, set, update });

  function newSet(fov, near, far) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    const s = { scene, camera, baseFov: fov, puffs: [] };
    sets.push(s);
    return s;
  }
  // Portrait phones get a wider vertical view so the subject still fits.
  function fitFov(s) {
    const cam = s.camera;
    cam.aspect = aspect;
    const hb = 2 * Math.atan(Math.tan((s.baseFov * DEG) / 2) * 1.6);
    let v = s.baseFov;
    if (aspect < 1.6) v = Math.min(Math.max(s.baseFov, 80), (2 * Math.atan(Math.tan(hb / 2) / aspect)) / DEG);
    cam.fov = v;
    cam.updateProjectionMatrix();
    const k = vpH / (2 * Math.tan((cam.fov * DEG) / 2));
    s.puffs.forEach((pf) => (pf.material.uniforms.scale.value = k));
  }
  const addPuffs = (s, max, additive) => {
    const pf = puffs(max, additive);
    s.puffs.push(pf);
    s.scene.add(pf.points);
    return pf;
  };
  const shaker = (cam, amount, t) => {
    if (!shake || amount <= 0) return;
    cam.position.x += Math.sin(t * 71) * amount;
    cam.position.y += Math.sin(t * 53 + 1) * amount;
    cam.position.z += Math.sin(t * 89 + 2) * amount * 0.6;
  };

  // The spacecraft as designed, with booms that can fold away for launch.
  function makeCraft() {
    const c = buildCraft(design, { dryKg: info.dry, propKg: info.prop });
    c.userData.booms = ['sounder', 'iceRadar', 'mag', 'sar'].map((k) => c.userData.parts[k]).filter(Boolean);
    return c;
  }
  function deployCraft(c, k, stuck) {
    setDeploy(c, k, stuck);
    c.userData.booms.forEach((b) => {
      const kk = stuck === 'mag' && b === c.userData.parts.mag ? Math.min(k, 0.5) : k;
      b.scale.setScalar(Math.max(0.001, kk));
    });
  }
  const depItem = timeline.find((e) => e.kind === 'deploy');
  const stuckPart = depItem && depItem.tone !== 'ok' && depItem.part ? depItem.part : null;
  const arrivalItem = timeline.find((e) => e.kind === 'arrival');
  const aeroItem = timeline.find((e) => e.kind === 'aerobrake');

  const captionOf = (e, kicker) => ({ kicker, title: e.title, text: e.text, tone: e.tone || 'info' });
  const dsnCredit = () => ({ text: tr('film.credit.dsn', '3D model: Deep Space Network 34 m antenna, NASA 3D Resources') });
  const mapCue = (k) => ({ text: mapCredit(k) ? tr('film.credit.map', 'Imagery: {c}', { c: mapCredit(k) }) : '' });
  const dateStr = (ms) => (SMD.ui && SMD.ui.date ? SMD.ui.date(ms) : new Date(ms).toISOString().slice(0, 10));

  // ====================================================================
  // LAUNCH: pad, liftoff and ascent (one set, metres, the rocket climbs)
  function padSet(look) {
    const s = newSet(40, 0.3, 3e7);
    const { scene, camera } = s;
    studioEnv()
      .then((t) => {
        scene.environment = t;
        scene.environmentIntensity = 0.3;
      })
      .catch(() => {});
    const R = 6.371e6;
    const skyTex = canvasTex(8, 512, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#02050c');
      g.addColorStop(0.28, '#081631');
      g.addColorStop(0.42, '#1d2c52');
      g.addColorStop(0.47, '#5a4f72');
      g.addColorStop(0.49, '#c9805d');
      g.addColorStop(0.5, '#f4b678');
      g.addColorStop(0.51, '#3a3238');
      g.addColorStop(1, '#0b0d12');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1e5, 48, 32), skyMat);
    sky.renderOrder = -2;
    scene.add(sky);
    const stars = makeStars(2500, 9e4);
    stars.material.transparent = true;
    stars.material.opacity = 0.25;
    stars.material.fog = false;
    stars.renderOrder = -1;
    scene.add(stars);
    const sunDir = new THREE.Vector3(1, -0.02, -0.35).normalize();
    const dawn = glow(0xffa860, 5e4, 0.55);
    dawn.material.fog = false;
    scene.add(dawn);

    scene.fog = new THREE.FogExp2(0x2a3354, 4.5e-5);
    const hemi = new THREE.HemisphereLight(0x6d82b8, 0x1b1d22, 0.75);
    const sun = new THREE.DirectionalLight(0xffb27a, 0.5);
    sun.position.copy(sunDir).multiplyScalar(1000);
    scene.add(hemi, sun, sun.target);

    // The whole Earth under the pad (seen once the rocket is high).
    const earth = body('earth', R, { segments: 192, clouds: false });
    placeOnTop(earth, 28.5, -80.6);
    earth.position.set(0, -R - 40, 0);
    scene.add(earth);

    // Ground near the pad: scrub, a beach, the sea to the east. Fades at the edge.
    const groundTex = canvasTex(512, 512, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const x = i / w - 0.5;
          const y = j / h - 0.5;
          const n = fbm(x * 7, y * 7, 0.3, 5, 61);
          const coast = 0.22 + (n - 0.5) * 0.18 - x;
          let c;
          if (coast > 0.012) c = [44 + n * 50, 64 + n * 50, 38 + n * 22];
          else if (coast > 0) c = [190, 176, 140];
          else c = [16 + n * 12, 40 + n * 22, 66 + n * 30];
          const r = Math.hypot(x, y) * 2;
          const a = 255 * (1 - smooth(0.6, 1, r));
          img.data.set([c[0], c[1], c[2], a], (j * w + i) * 4);
        }
      ctx.putImageData(img, 0, 0);
    });
    const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, transparent: true });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30000, 96), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    scene.add(ground);

    // Pad, flame trench, tower and floodlights.
    const rocket = rocketMesh(look, agencyName);
    const Lr = rocket.userData.length;
    const concrete = new THREE.MeshStandardMaterial({ color: 0x8d8f8c, roughness: 0.95 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(look.r * 12, look.r * 14, 3, 48), concrete);
    pad.position.y = -1.5;
    scene.add(pad);
    const trench = new THREE.Mesh(new THREE.BoxGeometry(look.r * 3, 0.2, look.r * 26), new THREE.MeshStandardMaterial({ color: 0x2b2c2e, roughness: 1 }));
    trench.position.y = 0.02;
    scene.add(trench);
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a3a2a, roughness: 0.65, metalness: 0.35 });
    const tower = new THREE.Group();
    // The rocket stands on a launch mount so its flame can reach the trench.
    const mountH = Math.max(3.5, look.r * 3.2);
    const tH = Lr + mountH + 6;
    const tw = Math.max(2.2, look.r * 1.8);
    const post = new THREE.BoxGeometry(0.4, tH, 0.4);
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach(([a, b]) => {
      const m1 = new THREE.Mesh(post, steel);
      m1.position.set((a * tw) / 2, tH / 2, (b * tw) / 2);
      tower.add(m1);
    });
    const rungX = new THREE.BoxGeometry(tw, 0.25, 0.25);
    const rungZ = new THREE.BoxGeometry(0.25, 0.25, tw);
    for (let y = 3; y < tH; y += 3.2) {
      [-1, 1].forEach((sd) => {
        const a1 = new THREE.Mesh(rungX, steel);
        a1.position.set(0, y, (sd * tw) / 2);
        const a2 = new THREE.Mesh(rungZ, steel);
        a2.position.set((sd * tw) / 2, y, 0);
        tower.add(a1, a2);
      });
    }
    [mountH + Lr * 0.55, mountH + Lr * 0.86].forEach((y) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(look.r * 3.4 - look.r, 0.5, 0.9), steel);
      arm.position.set(tw / 2 + (look.r * 2.4) / 2 - 0.2, y, 0);
      tower.add(arm);
    });
    const beacon = glow(0xff3b2e, 5, 1);
    beacon.position.y = tH + 0.6;
    tower.add(beacon);
    tower.position.x = -(look.r * 3.4 + tw / 2);
    scene.add(tower);
    const lights = [];
    [
      [-1, 1],
      [1, -1],
      [-1, -1],
    ].forEach(([a, b]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, Lr * 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 0.7 }));
      const x = a * look.r * 16;
      const z = b * look.r * 16;
      pole.position.set(x, Lr * 0.35, z);
      const g = glow(0xfff0d0, look.r * 7, 0.95);
      g.position.set(x, Lr * 0.7, z);
      const pl = new THREE.PointLight(0xfff0d8, Lr * Lr * 4, Lr * 6, 2);
      pl.position.set(x * 0.8, Lr * 0.7, z * 0.8);
      scene.add(pole, g, pl);
      lights.push(g);
    });

    rocket.traverse((o) => o.isMesh && (o.castShadow = false));
    scene.add(rocket);
    const mountMat = new THREE.MeshStandardMaterial({ color: 0x5c6066, roughness: 0.8, metalness: 0.3 });
    const legR = look.r * (look.cores ? 3.4 : look.solids ? 1.9 : 1.25);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(look.r * 0.5, mountH, look.r * 0.5), mountMat);
      leg.position.set(Math.cos(a) * legR, mountH / 2, Math.sin(a) * legR);
      scene.add(leg);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(legR * 2.3, 0.6, legR * 2.3), mountMat);
    deck.position.y = mountH - 0.3;
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(look.r * 1.15, look.r * 1.15, 0.62, 32), new THREE.MeshBasicMaterial({ color: 0x0a0b0d }));
    hole.position.y = mountH - 0.3;
    scene.add(deck, hole);
    const flame = rocketPlume(look, true);
    flame.visible = false;
    rocket.add(flame);

    // The viewing stand, 700 m from the pad: the director (the player's
    // astronaut, helmet off) watches the launch and cheers.
    const STAND_Z = 700;
    const standY = -0.1;
    const stand = new THREE.Group();
    stand.position.set(0, -0.4, STAND_Z);
    scene.add(stand);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x5d6168, roughness: 0.9 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.45, metalness: 0.6 });
    const standDeck = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 6), deckMat);
    standDeck.position.y = 0.15;
    stand.add(standDeck);
    [0.5, 0.95].forEach((y) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(16, 0.06, 0.06), railMat);
      bar.position.set(0, 0.3 + y, -2.6);
      stand.add(bar);
    });
    const postGeo = new THREE.BoxGeometry(0.07, 0.95, 0.07);
    for (let x = -8; x <= 8; x += 2) {
      const post = new THREE.Mesh(postGeo, railMat);
      post.position.set(x, 0.3 + 0.475, -2.6);
      stand.add(post);
    }
    // A floodlit sign post and its warm lamp behind the crowd line.
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), railMat);
    lampPole.position.set(4.2, 2.4, 1.6);
    stand.add(lampPole);
    const lampGlow = glow(0xffe2b8, 1.4, 0.9);
    lampGlow.position.set(4.2, 4.5, 1.6);
    stand.add(lampGlow);
    const lamp = new THREE.PointLight(0xffe2b8, 26, 16, 2);
    lamp.position.set(3.2, 4.2, 1.8);
    stand.add(lamp);
    // The launch glow on the watchers' faces (follows the engines).
    const padGlow = new THREE.PointLight(0xffa860, 0, 18, 2);
    padGlow.position.set(-0.6, 2.4, -7);
    stand.add(padGlow);
    let astro = null;
    try {
      astro = createAstronaut(SMD.avatar ? SMD.avatar.get() : null, { helmet: false, shadows: false });
      astro.group.position.set(-0.4, 0.3, -1.6);
      astro.group.rotation.y = Math.PI; // faces the pad (-z)
      stand.add(astro.group);
    } catch (e) {
      console.warn('film astronaut unavailable', e);
      astro = null;
    }
    const acted = {};
    const camWant = new THREE.Vector3();
    // The stand shot uses a long lens: the far rocket reads, the director stays near.
    let zoomNow = 1;
    const setZoom = (z) => {
      if (zoomNow === z) return;
      zoomNow = z;
      camera.zoom = z;
      camera.updateProjectionMatrix();
      const k = (vpH / (2 * Math.tan((camera.fov * DEG) / 2))) * z;
      s.puffs.forEach((pf) => (pf.material.uniforms.scale.value = k));
    };

    const smoke = addPuffs(s, 1400, false);
    const fire = addPuffs(s, 500, true);
    const trail = addPuffs(s, 1400, false);

    // Clouds the rocket climbs through.
    const cloudMat = new THREE.SpriteMaterial({ map: softDot(), color: 0x8f9ab8, transparent: true, opacity: 0.55, depthWrite: false });
    for (let i = 0; i < 46; i++) {
      const c = new THREE.Sprite(cloudMat);
      const sz = 900 + Math.random() * 2400;
      c.scale.set(sz * 2.4, sz * 0.8, 1);
      const a = Math.random() * Math.PI * 2;
      const r = 1500 + Math.random() * 14000;
      c.position.set(Math.cos(a) * r + 2000, 1800 + Math.random() * 4200, Math.sin(a) * r);
      scene.add(c);
    }

    const tLift = 3.5;
    const nozzle = new THREE.Vector3();
    const lastNozzle = new THREE.Vector3();
    const tail = new THREE.Vector3();
    let hadNozzle = false;
    const rnd = (k) => (Math.random() - 0.5) * k;

    // Altitude (m) and downrange (m) at film time t (cinematic, not physical).
    const altAt = (t) => {
      if (t < tLift) return 0;
      const u = t - tLift;
      const a = Lr * 0.34;
      const near = 0.5 * a * u * u;
      return u < 3 ? near : 0.5 * a * 9 + Math.pow(u - 3, 2.6) * 2600;
    };
    const pitchAt = (t) => smooth(6, 9.5, t) * 32 * DEG;

    s.update = (t, dt, mode) => {
      const h = altAt(t);
      const pitch = pitchAt(t);
      const x = t > 6 ? Math.pow(Math.max(0, t - 6), 2.4) * 380 : 0;
      rocket.position.set(x, h + mountH, 0);
      rocket.rotation.z = -pitch;
      const hk = clamp(h / 45000);
      skyMat.color.setScalar(1 - 0.92 * Math.pow(hk, 0.55));
      stars.material.opacity = 0.25 + 0.75 * smooth(0.2, 0.8, hk);
      scene.fog.density = 4.5e-5 * Math.pow(1 - hk, 4);
      groundMat.opacity = 1 - smooth(5000, 16000, h);
      sun.intensity = 0.5 + 2.6 * smooth(800, 9000, h);
      hemi.intensity = 0.75 * (1 - 0.6 * hk);
      beacon.material.opacity = Math.sin(t * 5) > 0 ? 1 : 0.15;

      // Engine
      const ign = smooth(2.9, tLift, t);
      const thin = clamp(h / 30000);
      flame.visible = ign > 0.02;
      if (flame.visible) setRocketPlume(flame, look.r * (9 + 30 * thin) * (0.6 + 0.4 * ign) * (1 + 0.05 * Math.sin(t * 40)), look.r * (1.15 + 2.6 * thin), ign, thin, t);
      rocket.updateMatrixWorld(true);
      nozzle.set(0, -look.r * 0.8, 0).applyMatrix4(rocket.matrixWorld);
      // The smoke trail starts behind the flame, so the flame stays in view.
      tail.set(0, -look.r * (6 + 22 * thin), 0).applyMatrix4(rocket.matrixWorld);

      // Vapour before ignition, ground smoke at liftoff, a trail on the way up.
      if (t < tLift + 0.3 && t > 0.2) {
        for (let i = 0; i < 2; i++)
          smoke.emit(new THREE.Vector3(rnd(look.r * 2), Lr * (0.3 + Math.random() * 0.4), look.r * 1.05), new THREE.Vector3(rnd(1), -1.5, 1.2 + Math.random()), 2.5, look.r * 1.2, look.r * 4, 0xd8dde6, 0x8890a0, 0.35);
      }
      if (ign > 0 && h < 400) {
        const n = Math.round(14 * ign);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 15 + Math.random() * 35;
          smoke.emit(new THREE.Vector3(rnd(look.r * 3), 1 + Math.random() * 2, rnd(look.r * 3)), new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp), 6 + Math.random() * 3, look.r * 4, look.r * 16, Math.random() < 0.5 ? 0xffd9b0 : 0xf3eee6, 0x5d6470, 0.7);
        }
        for (let i = 0; i < 6 * ign; i++) fire.emit(nozzle.clone().add(new THREE.Vector3(rnd(look.r), -1, rnd(look.r))), new THREE.Vector3(rnd(10), -20 - Math.random() * 20, rnd(10)), 0.5, look.r * 2.2, look.r * 0.6, 0xffc070, 0xff5a10, 0.6);
      }
      if (t > tLift + 0.6 && h < 40000) {
        if (!hadNozzle) lastNozzle.copy(tail);
        const steps = 8;
        for (let i = 0; i < steps; i++) {
          const q = lastNozzle.clone().lerp(tail, i / steps);
          trail.emit(q.add(new THREE.Vector3(rnd(look.r), rnd(look.r), rnd(look.r))), new THREE.Vector3(rnd(4), rnd(4), rnd(4)), 5, look.r * (2 + thin * 8), look.r * (10 + thin * 30), 0xf1ece4, 0x9aa2ae, 0.55 * (1 - thin));
        }
        hadNozzle = true;
      }
      lastNozzle.copy(tail);
      padGlow.intensity = 34 * ign * (1 - smooth(1500, 6000, h)) * (1 + 0.15 * Math.sin(t * 37));
      if (astro) {
        // Watch the rocket from ignition; cheer as it clears the tower, then jump.
        if (!acted.look && t > 2.6) {
          acted.look = true;
          astro.lookAt(rocket);
          astro.setExpression('wow');
        }
        if (!acted.cheer && t >= 5.85) {
          acted.cheer = true;
          astro.setExpression(null);
          astro.cheer({ duration: 1.3 });
        }
        if (!acted.joy && t >= 7.1) {
          acted.joy = true;
          astro.celebrate();
        }
        astro.update(dt);
      }
      smoke.update(dt, 0.35, 1.2);
      fire.update(dt);
      trail.update(dt, 0.1);

      // Cameras
      if (mode !== 'viewer') setZoom(1);
      if (mode === 'wide') {
        const k = easeIO(clamp(t / tLift));
        camera.position.set(lerp(Lr * 2.4, Lr * 1.7, k), lerp(Lr * 0.25, Lr * 0.42, k), lerp(Lr * 2.6, Lr * 1.9, k));
        camera.lookAt(0, Lr * 0.55, 0);
        shaker(camera, ign * 0.08, t);
      } else if (mode === 'low') {
        camera.position.set(Lr * 1.7, 2.2, Lr * 1.9);
        camera.lookAt(x, h + Lr * lerp(0.32, 0.5, smooth(3.5, 6, t)), 0);
        const u = t - tLift;
        shaker(camera, (0.5 * Math.exp(-u * 0.8) + 0.08) * look.r, t);
      } else if (mode === 'viewer') {
        // Over the director's shoulder at the viewing stand, on a long lens:
        // the rocket climbs off the horizon and out of the frame, its trail
        // stays. Phones keep the figure nearer the middle.
        setZoom(1.8);
        // The camera stands to the director's left, so the figure sits on the
        // right (captions live bottom-left) and the trail arcs over them.
        const side = aspect < 1 ? 0.5 : 1.45;
        const k = easeIO(clamp((t - 5.6) / 2.5));
        camera.position.set(-0.4 - side + 0.2 * k, standY + (aspect < 1 ? 1.9 : 1.62), STAND_Z - 1.6 + 6.4 - 0.9 * k);
        const pitch = (aspect < 1 ? 6 : 2.5 + 1.5 * k) * DEG;
        const yaw = clamp(Math.atan2(x - camera.position.x, camera.position.z) * 0.15, 0, 2.5 * DEG);
        camWant.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).add(camera.position);
        camera.lookAt(camWant);
        shaker(camera, 0.01 * ign, t);
      } else {
        // Chase: beside and a little below, horizon and trail in view.
        const u = clamp((t - 6.5) / 3);
        const side = new THREE.Vector3(Lr * (0.2 - 0.9 * u), Lr * (0.45 + 0.25 * u), Lr * (1.8 + 0.5 * u));
        camera.position.copy(rocket.position).add(side);
        camera.lookAt(rocket.position.x + Lr * 0.2, rocket.position.y + Lr * 0.1, 0);
        shaker(camera, look.r * 0.05, t);
      }
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      dawn.position.copy(camera.position).addScaledVector(sunDir, 8e4);
      const fw = (u) => (u < 60 ? `T−00:00:0${Math.max(0, Math.ceil(-u))}` : '');
      const mt = t < tLift ? fw(t - tLift) : `T+${String(Math.floor(((t - tLift) * 26) / 60)).padStart(2, '0')}:${String(Math.floor((t - tLift) * 26) % 60).padStart(2, '0')}`;
      hud('clock', tr('film.hud.clock', 'Mission clock'), mt);
      if (t >= tLift) {
        hud('alt', tr('film.hud.alt', 'Altitude'), h < 1000 ? `${SMD.ui.fmt(h)} m` : `${SMD.ui.fmt(h / 1000, h < 10000 ? 1 : 0)} km`);
        hud('speed', tr('film.hud.speed', 'Speed'), `${SMD.ui.fmt(Math.min(7.8, 0.02 + (t - tLift) * 0.32 + Math.pow(Math.max(0, t - 6), 2) * 0.2), 2)} km/s`);
      }
    };
    s.dispose = () => {
      groundTex.dispose();
      skyTex.dispose();
      if (astro) astro.dispose();
    };
    return s;
  }

  // LAUNCH: staging, fairing, separation and deployment above the Earth.
  function spaceSet(look) {
    const s = newSet(40, 0.1, 6e7);
    const { scene, camera } = s;
    scene.background = new THREE.Color(0x01030a);
    studioEnv()
      .then((t) => {
        scene.environment = t;
        scene.environmentIntensity = 0.45;
      })
      .catch(() => {});
    const R = 6.371e6;
    const h = 190e3;
    const sunDir = new THREE.Vector3(1, 0.12, -0.42).normalize();
    const sunL = new THREE.DirectionalLight(0xfff1dc, 2.6);
    sunL.position.copy(sunDir).multiplyScalar(100);
    scene.add(sunL, sunL.target, new THREE.AmbientLight(0x51657d, 0.35));
    const earthFill = new THREE.DirectionalLight(0x7fa8d8, 0.55);
    earthFill.position.set(0, -100, 20);
    scene.add(earthFill);
    scene.add(makeStars(4000, 4e7));
    const sunSpr = makeSun(1.2e6);
    sunSpr.position.copy(sunDir).multiplyScalar(3e7);
    scene.add(sunSpr);
    const earth = body('earth', R, { segments: 256, sunDir });
    placeOnTop(earth, 17, 4);
    earth.position.set(0, -R - h, 0);
    scene.add(earth);

    const rocket = rocketMesh(look, agencyName);
    const Lr = rocket.userData.length;
    const { s1, s2, fair, halves } = rocket.userData;
    // The spacecraft sits inside the fairing.
    const craft = makeCraft();
    deployCraft(craft, 0, null);
    craft.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(craft);
    const bs = box.getSize(new THREE.Vector3());
    const fitR = look.r * 0.95;
    const sc = Math.min(1, (fitR * 2) / Math.max(bs.x, bs.z, 0.1), (look.fair * 0.72) / Math.max(bs.y, 0.1));
    craft.scale.setScalar(sc);
    const craftHolder = new THREE.Group();
    craftHolder.add(craft);
    craftHolder.position.y = look.s2 + 0.2 + -box.min.y * sc;
    s2.add(craftHolder);
    const flame2 = rocketPlume(look, false);
    flame2.position.y = -2.2;
    s2.add(flame2);
    rocket.rotation.z = -Math.PI / 2; // nose along +X (east)
    scene.add(rocket);
    const craftSize = craft.userData.size * sc;
    const stowedSize = Math.max(bs.x, bs.y, bs.z) * sc;

    const debris = [];
    const detach = (obj, v, spin) => {
      scene.attach(obj);
      debris.push({ obj, v, spin });
    };
    let staged = false;
    let fairingOff = false;
    let separated = false;
    const tmp = new THREE.Vector3();
    const t0 = 9.5;
    const craftDrift = new THREE.Vector3();
    const sepPos = new THREE.Vector3();
    const sepQ = new THREE.Quaternion();

    s.update = (t, dt) => {
      const u = t - t0;
      if (u >= 0.3 && !staged) {
        staged = true;
        detach(s1, new THREE.Vector3(-3, -1.2, 0.3), new THREE.Vector3(0.05, 0.12, 0.25));
      }
      if (u >= 2.1 && !fairingOff) {
        fairingOff = true;
        if (halves.length) {
          detach(halves[0], new THREE.Vector3(-1.5, 0.6, 5.5), new THREE.Vector3(0.6, 0.1, 0));
          detach(halves[1], new THREE.Vector3(-1.5, 0.6, -5.5), new THREE.Vector3(-0.6, -0.1, 0));
        }
      }
      if (u >= 3.8 && !separated) {
        separated = true;
        scene.attach(craftHolder);
        sepPos.copy(craftHolder.position);
        sepQ.copy(craftHolder.quaternion);
      }
      // The upper stage pushes, so dropped parts fall behind (-X).
      const burning = u > 0.9 && u < 3.5;
      debris.forEach((d) => {
        d.v.x -= (burning ? 6 : 0.4) * dt;
        d.obj.position.addScaledVector(d.v, dt);
        d.obj.rotation.x += d.spin.x * dt;
        d.obj.rotation.y += d.spin.y * dt;
        d.obj.rotation.z += d.spin.z * dt;
      });
      const k2 = smooth(0.8, 1.1, u) * (1 - smooth(3.3, 3.5, u));
      flame2.visible = k2 > 0.02;
      if (flame2.visible) setRocketPlume(flame2, look.r * (8 + 0.5 * Math.sin(t * 30)), look.r * 1.9, k2, 1, t);
      if (separated) {
        const v = u - 3.8;
        craftDrift.set(0.45 * v + 0.04 * v * v, 0.1 * v, 0);
        craftHolder.position.copy(sepPos).add(craftDrift);
        craftHolder.quaternion.copy(sepQ);
        craftHolder.rotateY(0.14 * v);
        craftHolder.rotateZ(0.05 * v);
        rocket.position.x = -0.35 * v;
      }
      const dk = smooth(5.0, 7.3, u);
      deployCraft(craft, dk, stuckPart);

      // Cameras: the stack from the side, then the spacecraft close up.
      const stackMid = new THREE.Vector3(Lr * 0.25, 0, 0);
      if (u < 2.0) {
        const k = easeIO(clamp(u / 2));
        camera.position.set(lerp(-Lr * 0.6, -Lr * 0.1, k), Lr * 0.18, lerp(Lr * 1.3, Lr * 0.95, k));
        camera.lookAt(stackMid.x, -Lr * 0.12, 0);
      } else if (u < 3.8) {
        const k = easeIO(clamp((u - 2) / 1.8));
        const payload = rocket.localToWorld(tmp.set(0, look.s1 + 2.2 + look.s2 + look.fair * 0.4, 0)).clone();
        camera.position.set(payload.x - lerp(Lr * 0.12, look.fair * 0.8, k), payload.y + look.fair * 0.5, payload.z + lerp(Lr * 0.7, look.fair * 2.2, k));
        camera.lookAt(payload.x, payload.y - look.fair * 0.2, payload.z);
      } else {
        const k = easeIO(clamp((u - 3.8) / 4));
        const c = craftHolder.position;
        // Start close on the folded spacecraft and pull back as it unfolds.
        const d = Math.max(lerp(stowedSize * 2.6, craftSize * 1.35, smooth(5.0, 7.3, u)), 2);
        const yaw = lerp(1.9, 2.6, k);
        camera.position.set(c.x + Math.cos(yaw) * d, c.y + d * 0.35, c.z + Math.sin(yaw) * d);
        camera.lookAt(c.x, c.y - d * 0.15, c.z);
      }
      shaker(camera, burning ? 0.015 * look.r : 0, t);
      earth.rotation.y += dt * 0.0006;
      hud('clock', tr('film.hud.clock', 'Mission clock'), `T+${String(8 + Math.floor(u * 0.4)).padStart(2, '0')}:${String(Math.floor(u * 9) % 60).padStart(2, '0')}`);
      hud('alt', tr('film.hud.alt', 'Altitude'), `${SMD.ui.fmt(lerp(175, 205, clamp(u / 8)), 0)} km`);
      hud('speed', tr('film.hud.speed', 'Speed'), `${SMD.ui.fmt(Math.min(7.8, 6.2 + u * 0.4), 2)} km/s`);
    };
    return s;
  }

  // LAUNCH (planets): the cruise drawn on a mini solar system from the real
  // Lambert trajectory, with the cruise events as captions.
  function trajectorySet(t0, dur, items, lossMs) {
    const s = newSet(40, 0.5, 1e6);
    const { scene, camera } = s;
    scene.background = new THREE.Color(0x05080e);
    const AU = P.AU;
    const S = 60; // scene units per AU
    const toV = (r) => new THREE.Vector3((r[0] / AU) * S, 0, (-r[1] / AU) * S);
    scene.add(makeStars(3000, 5e5));
    const sun = makeSun(18);
    scene.add(sun, new THREE.AmbientLight(0x8090a0, 0.5));
    const sunLight = new THREE.PointLight(0xfff1dc, 3, 0, 0);
    scene.add(sunLight);
    const dest = m.dest;
    const aDest = P.PLANETS[dest].a;
    const ringCol = { mars: 0xd2693c, venus: 0xe6c37a, jupiter: 0xd9b38c }[dest] || 0xa9b6c2;
    scene.add(ring(S * P.PLANETS.earth.a, 0x6fa8dc, 0.45), ring(S * aDest, ringCol, 0.55));
    const sizes = { earth: 3.4, mars: 3.0, venus: 3.2, jupiter: 7 };
    const earthB = body('earth', sizes.earth, { segments: 48, res: 512, atmo: false });
    const destB = body(destKind, sizes[dest] || 2.2, { segments: 48, res: 512, atmo: false });
    scene.add(earthB, destB);
    const earthL = label(tr('film.earth', 'Earth'), '#9ec5f4');
    const destL = label(destName, '#f0c75e');
    // Labels sit above their planet, and a dot keeps each planet visible.
    earthL.center.set(0.5, -0.4);
    destL.center.set(0.5, -0.4);
    const earthM = marker(0x6fa8dc, 0.02);
    const destM = marker(ringCol, 0.024);
    earthB.add(earthM);
    destB.add(destM);
    scene.add(earthL, destL);

    const launch = p.launch;
    const dep = launch.departMs;
    const arr = launch.arriveMs;
    const endMs = lossMs || arr;
    const N = 240;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const ms = dep + ((arr - dep) * i) / N;
      let r;
      try {
        r = SMD.ops.probePosition(launch, ms);
      } catch (e) {
        r = null;
      }
      pts.push(r ? toV(r) : pts.length ? pts[pts.length - 1].clone() : toV(P.planetState('earth', dep).r));
    }
    const path = line(pts, 0xf0c75e, 0.95);
    path.geometry.setDrawRange(0, 0);
    scene.add(path);
    const ghost = line(pts, 0xf0c75e, 0.18);
    scene.add(ghost);
    const probe = marker(lossMs ? 0xff8a7a : 0xffffff, 0.034);
    const probeHalo = marker(0xf0c75e, 0.085);
    probeHalo.material.opacity = 0.5;
    scene.add(probe, probeHalo);
    const probeL = label(name, "#ffffff", 0.022);
    probeL.center.set(1.12, 0.5);
    scene.add(probeL);
    // Cruise events as small marks along the path.
    items.forEach((e) => {
      const i = Math.round(clamp((e.ms - dep) / (arr - dep)) * N);
      const mk = marker(e.tone === 'bad' ? 0xf06a5f : e.tone === 'warn' ? 0xf0b429 : 0x3fc1b4, 0.018);
      mk.position.copy(pts[i]);
      mk.visible = false;
      mk.userData.ms = e.ms;
      scene.add(mk);
      e._mark = mk;
    });
    let storm = null;
    let stormT0 = null;
    const stormItem = items.find((e) => e.kind === 'storm');
    if (stormItem) {
      storm = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), new THREE.MeshBasicMaterial({ color: 0xf0b429, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      storm.rotation.x = -Math.PI / 2;
      scene.add(storm);
    }
    const reach = Math.max(aDest, 1.15, ...pts.map((v) => v.length() / S));
    const yawArr = Math.atan2(-pts[N].z, -pts[N].x);
    s.update = (t) => {
      const u = clamp((t - t0) / dur);
      const k = clamp(easeIO(clamp((u - 0.04) / 0.86)));
      const ms = dep + (endMs - dep) * k;
      const frac = (ms - dep) / (arr - dep);
      const n = Math.max(2, Math.round(frac * N));
      path.geometry.setDrawRange(0, n + 1);
      const i0 = Math.min(N, Math.floor(frac * N));
      const pp = pts[i0].clone().lerp(pts[Math.min(N, i0 + 1)], frac * N - i0);
      probe.position.copy(pp);
      probeHalo.position.copy(pp);
      probeL.position.copy(pp);
      if (lossMs && frac >= (lossMs - dep) / (arr - dep) - 1e-3) {
        probe.material.color.setHex(0xf06a5f);
        probeHalo.material.opacity = 0.2 + 0.2 * Math.sin(t * 6);
      } else probeHalo.material.opacity = 0.35 + 0.15 * Math.sin(t * 4);
      const ep = toV(P.planetState('earth', ms).r);
      const dp = toV(P.planetState(dest, ms).r);
      earthB.position.copy(ep);
      destB.position.copy(dp);
      earthL.position.copy(ep);
      destL.position.copy(dp);
      earthB.rotation.y += 0.02;
      destB.rotation.y += 0.01;
      items.forEach((e) => e._mark && (e._mark.visible = ms >= e.ms));
      if (storm) {
        if (stormT0 === null && ms >= stormItem.ms) stormT0 = t;
        const su = stormT0 === null ? -1 : (t - stormT0) / 1.8;
        storm.visible = su > 0 && su < 1;
        if (storm.visible) {
          storm.scale.setScalar(S * (0.2 + su * 1.4));
          storm.material.opacity = 0.7 * (1 - su);
        }
      }
      probeL.visible = frac > 0.12;
      // Camera: high and tilted, opposite the arrival point, so the meeting
      // with the planet happens near the top of the frame, clear of captions.
      // Fit the whole transfer: distance from the vertical field of view.
      const fit = reach * S * 1.1;
      const tv = Math.tan((camera.fov * DEG) / 2);
      const D = (fit / Math.min(tv, tv * camera.aspect)) * 1.18;
      const yaw = yawArr - Math.PI / 2 - 0.12 + u * 0.18;
      const tilt = lerp(1.2, 1.1, u);
      camera.position.set(Math.cos(yaw) * Math.cos(tilt) * D, Math.sin(tilt) * D, Math.sin(yaw) * Math.cos(tilt) * D);
      // Aim a little toward the camera so the drawing sits above the captions.
      camera.lookAt(Math.cos(yaw) * fit * 0.16, 0, Math.sin(yaw) * fit * 0.16);
      hud('date', tr('film.hud.date', 'Date'), dateStr(ms));
      const day = Math.max(0, Math.round((ms - dep) / 864e5));
      hud('day', tr('film.hud.day', 'Day of cruise'), String(day));
      const lm = P.lightMinutes(P.norm(P.sub(SMD.ops.probePosition(launch, ms), P.planetState('earth', ms).r)) / AU);
      hud('light', tr('film.hud.light', 'Radio delay'), lm < 1 ? `${Math.round(lm * 60)} s` : `${SMD.ui.fmt(lm, 1)} min`);
    };
    return s;
  }

  // LAUNCH (Moon): the five-day coast from Earth to lunar orbit.
  function moonTransferSet(t0, dur, lossFrac) {
    const s = newSet(40, 0.1, 1e6);
    const { scene, camera } = s;
    scene.background = new THREE.Color(0x03060c);
    scene.add(makeStars(3000, 5e5));
    const sunDir = new THREE.Vector3(1, 0.3, 0.4).normalize();
    const sunL = new THREE.DirectionalLight(0xfff1dc, 3);
    sunL.position.copy(sunDir).multiplyScalar(100);
    scene.add(sunL, new THREE.AmbientLight(0x6f8090, 0.25));
    const RM = 60;
    const earthB = body('earth', 4.2, { segments: 96, res: 512, sunDir });
    scene.add(earthB, ring(RM, 0xa9b6c2, 0.3));
    const moonB = body('moon', 1.6, { segments: 64, res: 512 });
    scene.add(moonB);
    const moonL = label(tr('film.moon', 'Moon'), '#e9eef2');
    scene.add(moonL);
    const tof = (p.launch && p.launch.tofDays) || 5;
    const th1 = 2.1; // where the Moon will be on arrival
    const th0 = th1 - (tof / 27.32) * Math.PI * 2;
    const pts = [];
    const rp = 4.9;
    const ra = RM;
    const e = (ra - rp) / (ra + rp);
    const a = (ra + rp) / 2;
    for (let i = 0; i <= 160; i++) {
      const nu = (i / 160) * Math.PI;
      const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
      const ang = th1 - Math.PI + nu;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, 0, -Math.sin(ang) * r));
    }
    const path = line(pts, 0xf0c75e, 0.95);
    scene.add(path, line(pts, 0xf0c75e, 0.18));
    const probe = marker(0xffffff, 0.026);
    scene.add(probe);
    s.update = (t) => {
      const u = clamp((t - t0) / dur);
      const k = Math.min(lossFrac || 1, easeIO(clamp((u - 0.05) / 0.85)));
      const th = lerp(th0, th1, k);
      moonB.position.set(Math.cos(th) * RM, 0, -Math.sin(th) * RM);
      moonL.position.copy(moonB.position).add(new THREE.Vector3(0, 2.6, 0));
      const n = Math.round(k * 160);
      path.geometry.setDrawRange(0, n + 1);
      probe.position.copy(pts[n]);
      earthB.rotation.y += 0.004;
      const yaw = th1 - Math.PI / 2 + 0.5 - u * 0.3;
      camera.position.set(Math.cos(yaw) * 70, 62, -Math.sin(yaw) * 70);
      camera.lookAt(Math.cos(th1) * 22, -6, -Math.sin(th1) * 22);
      const dep = p.launch ? p.launch.departMs : p.launchMs;
      hud('date', tr('film.hud.date', 'Date'), dateStr(dep + k * tof * 864e5));
      hud('day', tr('film.hud.day', 'Day of cruise'), SMD.ui.fmt(k * tof, 1));
    };
    return s;
  }

  // NEAR-EARTH: a dive from deep space down to the satellite over Egypt.
  function earthOrbitSet(t0, dur) {
    const s = newSet(40, 0.1, 8e7);
    const { scene, camera } = s;
    scene.background = new THREE.Color(0x01030a);
    studioEnv()
      .then((t) => {
        scene.environment = t;
        scene.environmentIntensity = 0.45;
      })
      .catch(() => {});
    const R = 6.371e6;
    const alt = ((m.scienceOrbit && m.scienceOrbit.rpAlt) || 600) * 1000;
    const site = p.missionKey === 'nile' ? [30.2, 31.2] : [26.5, 29.5];
    const n = latLonDir(site[0], site[1]);
    const lon = site[1] * DEG;
    const east = new THREE.Vector3(-Math.sin(lon), 0, -Math.cos(lon)).normalize();
    const north = new THREE.Vector3().crossVectors(n, east).normalize();
    const sunDir = n.clone().multiplyScalar(0.85).addScaledVector(east, 0.45).addScaledVector(north, -0.2).normalize();
    const sunL = new THREE.DirectionalLight(0xfff4e6, 2.3);
    sunL.position.copy(sunDir).multiplyScalar(100);
    scene.add(sunL, sunL.target, new THREE.AmbientLight(0x51657d, 0.22));
    scene.add(makeStars(4000, 6e7));
    const earth = body('earth', R, { segments: 256, sunDir, clouds: p.missionKey !== 'nile' });
    scene.add(earth);
    const craft = makeCraft();
    deployCraft(craft, 1, stuckPart);
    const holder = new THREE.Group();
    holder.add(craft);
    scene.add(holder);
    const size = craft.userData.size;
    // Instrument footprint on the ground.
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x3fc1b4, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beamGeo = new THREE.ConeGeometry(1, 1, 48, 1, true);
    beamGeo.translate(0, -0.5, 0);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    scene.add(beam);
    const swath = 60e3;
    const tmp = new THREE.Vector3();
    // Ground track (polar orbit along this meridian) and the strip already imaged.
    const track = [];
    for (let la = -89; la <= 89; la += 1) track.push(latLonDir(la, site[1]).multiplyScalar(R + alt));
    const trackLine = line(track, 0xf0c75e, 0.85);
    scene.add(trackLine);
    const half = ((p.missionKey === 'nile' ? 185e3 : 900e3) / 2 / R) / DEG;
    const stripLat = [];
    for (let la = 62; la >= -20; la -= 0.5) stripLat.push(la);
    const sv = [];
    for (let i = 0; i < stripLat.length - 1; i++) {
      const a = stripLat[i];
      const b = stripLat[i + 1];
      const q = (la, dl) => latLonDir(la, site[1] + dl / Math.cos(la * DEG)).multiplyScalar(R * 1.0006);
      [q(a, -half), q(a, half), q(b, -half), q(a, half), q(b, half), q(b, -half)].forEach((v) => sv.push(v.x, v.y, v.z));
    }
    const stripGeo = new THREE.BufferGeometry();
    stripGeo.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
    const strip = new THREE.Mesh(stripGeo, new THREE.MeshBasicMaterial({ color: 0x3fc1b4, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    scene.add(strip);
    const dot = marker(0xffffff, 0.02);
    const dotHalo = marker(0xf0c75e, 0.05);
    const dotL = label(`${name} · ${SMD.ui.fmt(alt / 1000)} km`, '#ffffff', 0.024);
    scene.add(dot, dotHalo, dotL);
    const northAt = (la, lo) => new THREE.Vector3(-Math.sin(la * DEG) * Math.cos(lo * DEG), Math.cos(la * DEG), Math.sin(la * DEG) * Math.sin(lo * DEG));
    const split = 0.52;
    s.update = (t, dt) => {
      const u = clamp((t - t0) / dur);
      // The satellite heads south along its polar orbit (cinematically slow).
      const lat = site[0] + 3.2 - u * 5.4;
      const cn = latLonDir(lat, site[1]);
      const cpos = cn.clone().multiplyScalar(R + alt);
      holder.position.copy(cpos);
      holder.lookAt(tmp.copy(cpos).add(cn));
      holder.rotateZ(Math.PI / 2);
      const imaged = clamp((62 - lat) / 0.5, 0, stripLat.length - 1);
      stripGeo.setDrawRange(0, Math.floor(imaged) * 6);
      const mapView = u < split;
      dot.visible = dotHalo.visible = dotL.visible = trackLine.visible = mapView;
      holder.visible = !mapView;
      if (mapView) {
        // A map view from high above Egypt: north up, the orbit drawn in gold.
        const k = easeIO(clamp(u / (split * 0.8)));
        const h = R * 2.3 * Math.pow(2.7e6 / (R * 2.3), k);
        const cLat = lerp(site[0] - 6, site[0] - 2.5, k);
        const cDir = latLonDir(cLat, site[1]);
        camera.position.copy(cDir).multiplyScalar(R + h);
        camera.up.copy(northAt(cLat, site[1]));
        camera.lookAt(cDir.clone().multiplyScalar(R * (1 - 0.15 * (1 - k))));
        dot.position.copy(cpos);
        dotHalo.position.copy(cpos);
        dotL.position.copy(cpos);
        dotHalo.material.opacity = 0.5 + 0.3 * Math.sin(t * 5);
      } else {
        // Close behind the satellite, looking south along the river.
        const k = easeIO(clamp((u - split) / (1 - split)));
        const fwd = northAt(lat, site[1]).negate();
        const eastV = new THREE.Vector3().crossVectors(fwd, cn).negate();
        camera.position.copy(cpos).addScaledVector(cn, size * lerp(0.75, 0.5, k)).addScaledVector(fwd, -size * lerp(2.6, 1.9, k)).addScaledVector(eastV, size * lerp(1.1, 0.7, k));
        camera.up.copy(cn);
        camera.lookAt(tmp.copy(cpos).addScaledVector(fwd, size * 5).addScaledVector(cn, -size * 1.6));
        earth.userData.setGlow(0.3);
      }
      // Beam to the ground in the close-up.
      const bk = mapView ? 0 : 1;
      beamMat.opacity = 0.12 * bk * (0.8 + 0.2 * Math.sin(t * 9));
      beam.position.copy(cpos).addScaledVector(cn, -size * 0.4);
      beam.lookAt(tmp.copy(beam.position).add(cn));
      beam.rotateX(Math.PI / 2);
      beam.scale.set(swath, alt, swath);
      if (earth.userData.clouds) earth.userData.clouds.rotation.y += dt * 0.0004;
      const h = Math.max(alt, camera.position.length() - R);
      hud('alt', tr('film.hud.camAlt', 'Camera height'), `${SMD.ui.fmt(h / 1000, 0)} km`);
      hud('orbit', tr('film.hud.orbit', 'Orbit'), (m.scienceOrbit && m.scienceOrbit.label) || '');
    };
    return s;
  }

  // ====================================================================
  // ARRIVAL: approach, insertion burn, capture path and aerobraking
  function approachSet() {
    const s = newSet(42, 0.05, 1e6);
    const { scene, camera } = s;
    scene.background = new THREE.Color(0x01030a);
    studioEnv()
      .then((t) => {
        scene.environment = t;
        scene.environmentIntensity = 0.5;
      })
      .catch(() => {});
    const PR = 100;
    const sunDir = new THREE.Vector3(-0.55, 0.22, 0.8).normalize();
    const sunL = new THREE.DirectionalLight(0xfff1dc, destKind === 'jupiter' ? 2.4 : 3.2);
    sunL.position.copy(sunDir).multiplyScalar(500);
    scene.add(sunL, sunL.target, new THREE.AmbientLight(0x5a6b7d, 0.22));
    scene.add(makeStars(4500, 4e5));
    const sunSpr = makeSun(destKind === 'jupiter' ? 1800 : 5000);
    sunSpr.position.copy(sunDir).multiplyScalar(2e5);
    scene.add(sunSpr);
    const planet = body(destKind, PR, { segments: 160, sunDir });
    planet.rotation.z = 0.2;
    scene.add(planet);
    if (destKind === 'jupiter') {
      const eu = body('europa', 6, { segments: 48, res: 512 });
      eu.position.set(-260, 30, -380);
      scene.add(eu);
    }
    const craft = makeCraft();
    deployCraft(craft, 1, stuckPart);
    const cs = 1.6 / craft.userData.size;
    craft.scale.setScalar(cs);
    const holder = new THREE.Group();
    holder.add(craft);
    scene.add(holder);
    // Engine plume for the burn (along the craft's -Y).
    const plume = rocketPlume(ROCKET_LOOKS.light, false);
    plume.position.y = craft.userData.nozzleY;
    plume.visible = false;
    craft.add(plume);

    // Orbit geometry (scene units, plane tilted a little for depth).
    const plane = new THREE.Group();
    plane.rotation.set(0.32, 0, 0.12);
    scene.add(plane);
    const rp = PR * 1.14;
    const res = arrivalItem ? arrivalItem.text : '';
    const result = lost ? 'lost' : /fly past|flyby|single pass/i.test(res) ? 'flyby' : /higher orbit/i.test(res) ? 'high' : 'orbit';
    const aero = !!aeroItem && result !== 'flyby';
    const eHyp = 1.6;
    const eCap = result === 'high' ? 0.8 : aero ? 0.62 : 0.06;
    const conic = (e, nu) => {
      const r = (rp * (1 + e)) / (1 + e * Math.cos(nu));
      // Flown so the approach comes in from the far side, clear of the captions.
      return new THREE.Vector3(r * Math.cos(nu), 0, r * Math.sin(nu));
    };
    const nuInf = Math.acos(-1 / eHyp) - 0.22;
    const inPts = [];
    for (let i = 0; i <= 120; i++) inPts.push(conic(eHyp, lerp(-nuInf, 0, i / 120)));
    const outPts = [];
    if (result === 'flyby' || result === 'lost') for (let i = 0; i <= 120; i++) outPts.push(conic(eHyp, lerp(0, nuInf, i / 120)));
    else for (let i = 0; i <= 200; i++) outPts.push(conic(eCap, (i / 200) * Math.PI * 2));
    const inLine = line(inPts, 0xe9eef2, 0.75);
    const outLine = line(outPts, result === 'flyby' || result === 'lost' ? 0xf06a5f : 0xf0c75e, 0.95);
    inLine.geometry.setDrawRange(0, 0);
    outLine.geometry.setDrawRange(0, 0);
    plane.add(inLine, outLine);
    const dot = marker(0xffffff, 0.024);
    dot.visible = false;
    plane.add(dot);
    const heat = glow(0xff7a2e, 18, 0);
    plane.add(heat);
    // Aerobraking: a shrinking ellipse redrawn every frame.
    const abGeo = new THREE.BufferGeometry().setFromPoints(outPts);
    const abLine = new THREE.Line(abGeo, new THREE.LineBasicMaterial({ color: 0xf0c75e, transparent: true, opacity: 0.95, depthWrite: false }));
    abLine.visible = false;
    plane.add(abLine);
    const ghostRings = [];
    s.result = result;
    const arriveMsA = p.arriveMs || (p.launch && p.launch.arriveMs) || 0;
    const dAU = m.kind === 'planet' ? P.earthDistanceAU(m.dest, arriveMsA) : 0.00257;
    const distA = dAU < 0.05 ? `${SMD.ui.fmt(dAU * P.AU)} km` : `${SMD.ui.fmt(dAU * P.AU / 1e6)} million km`;
    s.aero = aero;

    const tmp = new THREE.Vector3();
    s.update = (t, dt, mode, lt, len) => {
      planet.rotation.y += dt * 0.025;
      const k = clamp(lt / len);
      if (mode !== 'aero') {
        hud('date', tr('film.hud.date', 'Date'), dateStr(arriveMsA));
        hud('dist', tr('film.hud.dist', 'From Earth'), distA);
      }
      if (mode === 'approach') {
        // The spacecraft in the foreground, the planet growing behind it.
        const c = new THREE.Vector3(lerp(330, 250, k), lerp(70, 52, k), lerp(240, 175, k));
        holder.position.copy(c);
        holder.lookAt(0, 0, 0);
        holder.rotateY(0.75);
        holder.rotateZ(0.3);
        holder.rotateX(-0.3);
        plume.visible = false;
        camera.position.copy(c).add(new THREE.Vector3(lerp(3.2, 2.6, k), 0.9, lerp(2.8, 2.2, k)));
        camera.lookAt(c.clone().lerp(new THREE.Vector3(0, 0, 0), 0.06));
      } else if (mode === 'burn') {
        // Engine forward, firing against the direction of travel.
        const c = new THREE.Vector3(150, 40, 110);
        holder.position.copy(c);
        holder.lookAt(c.clone().add(new THREE.Vector3(0.8, 0.1, -1)));
        holder.rotateX(Math.PI / 2);
        const on = smooth(0.05, 0.12, k) * (1 - smooth(0.9, 0.98, k));
        plume.visible = on > 0.01;
        if (plume.visible) setRocketPlume(plume, 5.5 * (0.85 + 0.15 * on), 0.55, on, 1, t);
        const yaw = lerp(-0.4, 0.5, easeIO(k));
        camera.position.copy(c).add(new THREE.Vector3(Math.cos(yaw) * 4.2, 1.3, Math.sin(yaw) * 4.2));
        camera.lookAt(c.clone().add(new THREE.Vector3(-1, -0.8, -0.6)));
        shaker(camera, on * 0.01, t);
      } else if (mode === 'path') {
        dot.visible = true;
        holder.visible = false;
        const kin = clamp(k / 0.45);
        inLine.geometry.setDrawRange(0, Math.round(kin * 120) + 1);
        const nOut = outPts.length - 1;
        const kout = clamp((k - 0.45) / 0.5);
        outLine.geometry.setDrawRange(0, kout > 0 ? Math.round(kout * nOut) + 1 : 0);
        if (kin < 1) dot.position.copy(inPts[Math.round(kin * 120)]);
        else dot.position.copy(outPts[Math.round(kout * nOut)]);
        heat.material.opacity = 0;
        camera.position.set(lerp(420, 330, k), lerp(340, 280, k), lerp(380, 270, k));
        camera.lookAt(-110, -30, -20);
      } else if (mode === 'aero') {
        holder.visible = false;
        inLine.visible = false;
        outLine.material.opacity = 0.18;
        abLine.visible = true;
        // Apoapsis shrinks pass after pass; the periapsis glows each time.
        const e = lerp(eCap, 0.05, easeIO(k));
        const pts = [];
        for (let i = 0; i <= 200; i++) pts.push(conic(e, (i / 200) * Math.PI * 2));
        abGeo.setFromPoints(pts);
        const passes = 9;
        const ph = (k * passes) % 1;
        const nu = ph * Math.PI * 2;
        dot.position.copy(conic(e, nu));
        const nearP = Math.cos(nu);
        heat.position.copy(conic(e, 0)).multiplyScalar(1.0);
        heat.material.opacity = Math.max(0, nearP - 0.86) * 6;
        dot.material.color.setHex(nearP > 0.9 ? 0xffa060 : 0xffffff);
        if (ghostRings.length < 6 && k > ghostRings.length * 0.16) {
          const g = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf0c75e, transparent: true, opacity: 0.16, depthWrite: false }));
          plane.add(g);
          ghostRings.push(g);
        }
        camera.position.set(lerp(330, 300, k), lerp(260, 300, k), lerp(300, 240, k));
        camera.lookAt(-110, -30, -20);
        hud('passes', tr('film.hud.passes', 'Passes through the air'), String(Math.max(1, Math.round(lerp(1, 400, k)))));
      }
      tmp.set(0, 0, 0);
    };
    return s;
  }

  // ARRIVAL: science operations time-lapse over the real planet map.
  function opsSet(t0, dur, totalGbit) {
    const s = newSet(50, 0.5, 2e5);
    const { scene, camera } = s;
    scene.background = new THREE.Color(0x01030a);
    studioEnv()
      .then((t) => {
        scene.environment = t;
        scene.environmentIntensity = 0.45;
      })
      .catch(() => {});
    const PR = 260;
    const ALT = 24;
    const bodyKind = p.missionKey === 'jupiter' ? 'europa' : m.dest === 'earth' ? 'earth' : destKind;
    const sunDir = new THREE.Vector3(0.45, 0.75, -0.45).normalize();
    const sunL = new THREE.DirectionalLight(0xfff4e0, 2.9);
    sunL.position.copy(sunDir).multiplyScalar(1000);
    scene.add(sunL, sunL.target, new THREE.AmbientLight(0x6f8090, 0.3));
    scene.add(makeStars(4000, 8e4));
    const planet = body(bodyKind, PR, { segments: 192, sunDir });
    // Close to the ground the limb glow would wash the surface out.
    planet.userData.setGlow(0.28);
    scene.add(planet);
    if (p.missionKey === 'jupiter') {
      const jup = body('jupiter', 900, { segments: 96, res: 512, sunDir });
      jup.position.set(-2600, 1400, -6200);
      scene.add(jup);
    }
    // Earth as a bright point in the sky, where the data goes.
    const earthDot = marker(0x9ec5f4, 0.022);
    earthDot.position.set(-70, PR + ALT + 70, -220);
    scene.add(earthDot);
    const earthL = label(tr('film.earth', 'Earth'), '#9ec5f4', 0.022);
    earthL.position.copy(earthDot.position);
    scene.add(earthL);

    const craft = makeCraft();
    deployCraft(craft, 1, stuckPart);
    const cs = 7 / craft.userData.size;
    craft.scale.setScalar(cs);
    craft.rotation.x = -Math.PI / 2; // instruments (-Z) look down
    const holder = new THREE.Group();
    holder.add(craft);
    holder.position.set(0, PR + ALT, 0);
    scene.add(holder);

    const insts = design.instruments.filter((id) => BEAMED.includes(id));
    const beams = insts.map((id, i) => {
      const col = INST_COLOR[id] || 0xe9eef2;
      const g = new THREE.ConeGeometry(1, 1, 32, 1, true);
      g.translate(0, -0.5, 0);
      const cone = new THREE.Mesh(g, beamMaterial(col));
      scene.add(cone);
      return { id, col, cone, phase: i * 1.7, foot: id === 'hires' ? 2.6 : id === 'sar' ? 7 : 4.5 };
    });
    // Swath marks painted on the ground; they ride the rotating planet.
    const marks = addPuffs(s, 1600, true);
    planet.add(marks.points);
    s.scene.remove(marks.points);
    const packets = addPuffs(s, 500, true);
    let angle = 0;
    const tmp = new THREE.Vector3();
    const fp = new THREE.Vector3();
    let markT = 0;
    let pktT = 0;
    s.update = (t, dt) => {
      const u = clamp((t - t0) / dur);
      angle += dt * 0.22;
      planet.rotation.x = angle;
      holder.rotation.z = Math.sin(t * 0.8) * 0.06;
      markT += dt;
      beams.forEach((b, i) => {
        const off = Math.sin(t * 1.3 + b.phase) * 22 * (insts.length > 1 ? 1 : 0.5) + (i - (insts.length - 1) / 2) * 6;
        fp.set(off, Math.sqrt(PR * PR - off * off), -2);
        const from = holder.position;
        const len = from.distanceTo(fp);
        b.cone.position.copy(from);
        b.cone.lookAt(fp);
        b.cone.rotateX(-Math.PI / 2);
        b.cone.scale.set(b.foot, len, b.foot);
        b.cone.material.uniforms.uOp.value = 0.5 + 0.12 * Math.sin(t * 18 + i);
        if (markT > 0.03) {
          const local = planet.worldToLocal(tmp.copy(fp).multiplyScalar(1.002));
          marks.emit(local, new THREE.Vector3(), 3.2, b.foot * 0.9, b.foot * 1.1, b.col, b.col, 0.4);
        }
      });
      if (markT > 0.03) markT = 0;
      // Data packets stream to Earth.
      pktT += dt;
      while (pktT > 0.025) {
        pktT -= 0.025;
        const dir = earthDot.position.clone().sub(holder.position);
        packets.emit(holder.position.clone().add(new THREE.Vector3(0, 2, 0)), dir.multiplyScalar(1 / 1.6), 1.6, 0.7, 0.5, 0x9ec5f4, 0xcde2fb, 0.95);
      }
      marks.update(dt);
      packets.update(dt);
      const yaw = lerp(0.35, -0.15, u);
      camera.position.set(Math.sin(yaw) * 20 + 6, PR + ALT + 30, 34 + Math.cos(yaw) * 4);
      camera.lookAt(0, PR + ALT - 24, -30);
      const turns = m.turns || 12;
      hud('month', tr('film.hud.month', 'Science month'), `${Math.min(turns, 1 + Math.floor(u * turns))} / ${turns}`);
      hud('data', tr('film.hud.data', 'Data returned'), fmtData(totalGbit * easeIO(u) * 0.85));
    };
    return s;
  }

  // ARRIVAL: a Deep Space Network dish at night catching the data.
  function dsnSet(t0, dur, totalGbit) {
    const s = newSet(40, 0.3, 5e5);
    const { scene, camera } = s;
    const skyTex = canvasTex(8, 512, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#01030a');
      g.addColorStop(0.42, '#071229');
      g.addColorStop(0.5, '#1b2a48');
      g.addColorStop(0.52, '#0b0d12');
      g.addColorStop(1, '#050608');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(4e4, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false }));
    sky.renderOrder = -2;
    scene.add(sky);
    const stars = makeStars(3500, 3.5e4);
    scene.add(stars);
    studioEnv()
      .then((t) => {
        scene.environment = t;
        scene.environmentIntensity = 0.25;
      })
      .catch(() => {});
    const moonL = new THREE.DirectionalLight(0xbcd0ff, 1.4);
    moonL.position.set(-60, 80, 40);
    scene.add(moonL, new THREE.HemisphereLight(0x33476e, 0x0b0b0e, 0.6));
    // Desert ground and hills.
    const ground = new THREE.Mesh(new THREE.CircleGeometry(3000, 64), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    for (let i = 0; i < 9; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(300 + Math.random() * 300, 24, 12), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 1 }));
      const a = -0.6 + (i / 8) * 2.6;
      hill.position.set(Math.cos(a) * 1900, -220, -Math.abs(Math.sin(a)) * 1900 - 300);
      hill.scale.y = 0.35;
      scene.add(hill);
    }
    // A procedural 34 m dish; the NASA model replaces it when it loads.
    const dishGroup = new THREE.Group();
    scene.add(dishGroup);
    const white = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide });
    const grey = new THREE.MeshStandardMaterial({ color: 0x8e969e, roughness: 0.6, metalness: 0.4 });
    const fallback = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 12, 24), grey);
    ped.position.y = 6;
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 6), grey);
    yoke.position.y = 15;
    const dishPts = [];
    for (let i = 0; i <= 24; i++) {
      const r = 17 * (i / 24);
      dishPts.push(new THREE.Vector2(r, (r * r) / (4 * 9)));
    }
    const dish = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 64), white);
    const tilt = new THREE.Group();
    tilt.add(dish);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 11, 6), grey);
      leg.position.set(Math.cos(a) * 6, 6.5, Math.sin(a) * 6);
      leg.lookAt(0, 12, 0);
      leg.rotateX(Math.PI / 2);
      tilt.add(leg);
    }
    const sub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 2, 16), grey);
    sub.position.y = 12;
    tilt.add(sub);
    tilt.position.y = 19;
    tilt.rotation.x = -0.45;
    fallback.add(ped, yoke, tilt);
    dishGroup.add(fallback);
    const focus = new THREE.Vector3(0, 19 + 10, -4.5);
    let dishH = 36;
    if (SMD.assets && SMD.assets.model)
      SMD.assets
        .model('model-dsn34', { metres: true })
        .then((obj) => {
          if (disposed) return;
          fallback.visible = false;
          const sz = obj.userData.size || new THREE.Vector3(34, 34, 34);
          obj.position.y = sz.y / 2;
          focus.set(0, sz.y * 0.8, 0);
          dishH = sz.y;
          dishGroup.add(obj);
        })
        .catch(() => {});
    const packets = addPuffs(s, 600, true);
    const skyPt = new THREE.Vector3(-70, 190, -240);
    let pktT = 0;
    s.update = (t, dt) => {
      const u = clamp((t - t0) / dur);
      pktT += dt;
      while (pktT > 0.03) {
        pktT -= 0.03;
        const start = skyPt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0));
        const v = focus.clone().sub(start).multiplyScalar(1 / 1.2);
        packets.emit(start, v, 1.2, 4, 1.6, 0xcde2fb, 0xffffff, 1);
      }
      packets.update(dt);
      const k = easeIO(u);
      camera.position.set(lerp(70, 54, k), lerp(8, 11, k), lerp(64, 50, k));
      camera.lookAt(0, lerp(dishH * 0.5, dishH * 0.56, k), 0);
      hud('data', tr('film.hud.data', 'Data returned'), fmtData(totalGbit * lerp(0.85, 1, smooth(0, 0.8, u))));
    };
    s.dispose = () => skyTex.dispose();
    return s;
  }

  // ARRIVAL: mission control. The director watches the big screen, then
  // turns to the team: a jump for joy, a fist pump, or a bowed head.
  // reaction: 'celebrate' | 'cheer' | 'sad'. dur: seconds on screen.
  const PLANET_INK = { earth: '#2a6bb0', moon: '#b9b9b4', mars: '#c0552a', venus: '#e2b867', jupiter: '#d9c8a8', europa: '#e3dccb' };
  function controlSet(t0, dur, reaction) {
    const s = newSet(34, 0.05, 120);
    const { scene, camera } = s;
    const bg = 0x0b1420;
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, 16, 44);
    studioEnv()
      .then((tx) => {
        scene.environment = tx;
        scene.environmentIntensity = 0.3;
      })
      .catch(() => {});
    scene.add(new THREE.HemisphereLight(0x6a86b0, 0x161a22, 1.1));
    const keyL = new THREE.DirectionalLight(0xfff0dc, 1.7);
    keyL.position.set(4, 7, 6);
    scene.add(keyL, keyL.target);
    const good = reaction !== 'sad';
    // The big screen: the planet, and the orbit you got (or the line that missed).
    const ink = PLANET_INK[destKind] || PLANET_INK[m.dest] || '#9ec5f4';
    const scrTex = canvasTex(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#071423';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120,170,220,0.14)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      const cx = w * 0.38;
      const cy = h * 0.52;
      const g = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, 110);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, ink);
      g.addColorStop(1, '#0d1724');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 104, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      if (reaction === 'sad') {
        // A dashed line that never closes into an orbit.
        ctx.strokeStyle = '#f06a5f';
        ctx.setLineDash([18, 14]);
        ctx.beginPath();
        ctx.moveTo(40, h * 0.12);
        ctx.quadraticCurveTo(cx + 120, cy - 40, w - 30, h * 0.92);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = reaction === 'cheer' ? '#f0b429' : '#3fc1b4';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 190, 92, -0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx + 182, cy - 50, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      // Telemetry bars down the side (no words, so it reads in any language).
      for (let i = 0; i < 7; i++) {
        const y = 70 + i * 52;
        ctx.fillStyle = 'rgba(158,197,244,0.25)';
        ctx.fillRect(w * 0.7, y, w * 0.25, 18);
        ctx.fillStyle = reaction === 'sad' && i > 3 ? '#f06a5f' : i % 3 === 0 ? '#f0b429' : '#3fc1b4';
        ctx.fillRect(w * 0.7, y, w * 0.25 * (0.3 + ((i * 37) % 60) / 100), 18);
      }
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
    screen.position.set(-0.6, 3.3, -7);
    scene.add(screen);
    const scrLight = new THREE.PointLight(good ? 0x8fc4ff : 0xff9a8a, 30, 18, 2);
    scrLight.position.set(-0.6, 3, -4.5);
    scene.add(scrLight);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), new THREE.MeshStandardMaterial({ color: 0x17212d, roughness: 0.95 }));
    wall.position.set(0, 6, -7.1);
    scene.add(wall);
    // Two rows of consoles with glowing monitors.
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x2b333d, roughness: 0.6, metalness: 0.3 });
    const monMat = [new THREE.MeshBasicMaterial({ color: 0x3fc1b4 }), new THREE.MeshBasicMaterial({ color: 0x5d8fd6 }), new THREE.MeshBasicMaterial({ color: 0xf0b429 })];
    const deskGeo = new THREE.BoxGeometry(3.4, 0.8, 0.9);
    const monGeo = new THREE.BoxGeometry(0.5, 0.3, 0.04);
    [-3.6, -0.6].forEach((z, row) => {
      for (let i = 0; i < 4; i++) {
        const x = -6.3 + i * 3.6 + row * 0.8;
        const d = new THREE.Mesh(deskGeo, deskMat);
        d.position.set(x, 0.4, z);
        scene.add(d);
        for (let k = 0; k < 2; k++) {
          const mon = new THREE.Mesh(monGeo, monMat[(i + k + row) % 3]);
          mon.position.set(x - 0.6 + k * 1.2, 1.05, z - 0.25);
          mon.rotation.x = -0.15;
          scene.add(mon);
        }
      }
    });
    // The flight team at the front row: simple figures, backs to us.
    const team = [];
    const shirt = new THREE.MeshStandardMaterial({ color: 0x31465f, roughness: 0.8 });
    const skins = [0xc99a6c, 0x8a5a36, 0xe8bd98, 0x5e3a22].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
    const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.5, 4, 10);
    const headGeo = new THREE.SphereGeometry(0.13, 14, 10);
    const armGeo = new THREE.CapsuleGeometry(0.055, 0.42, 4, 8);
    armGeo.translate(0, -0.22, 0);
    [-6.1, -3.0, 1.2, 3.9].forEach((x, i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, -2.8);
      const b = new THREE.Mesh(bodyGeo, shirt);
      b.position.y = 1.15;
      const hd = new THREE.Mesh(headGeo, skins[i % skins.length]);
      hd.position.y = 1.62;
      const arms = [-1, 1].map((sd) => {
        const a = new THREE.Mesh(armGeo, shirt);
        a.position.set(sd * 0.21, 1.47, 0);
        g.add(a);
        return a;
      });
      g.add(b, hd);
      scene.add(g);
      team.push({ g, arms, hd, ph: i * 0.7 });
    });
    // The director, standing behind the second row.
    const spot = new THREE.Vector3(1.1, 0, 0.9);
    let astro = null;
    try {
      astro = createAstronaut(SMD.avatar ? SMD.avatar.get() : null, { helmet: false, shadows: false });
      astro.group.position.copy(spot);
      scene.add(astro.group);
      astro.lookAt(screen);
    } catch (e) {
      console.warn('film astronaut unavailable', e);
      astro = null;
    }
    // Wide on the room and the big screen, then easing in on the director,
    // who stands right of centre (captions live bottom-left).
    const phone = aspect < 1;
    const camA = new THREE.Vector3(3.4, 1.8, 7.0);
    const camB = phone ? new THREE.Vector3(2.2, 1.55, 6.0) : new THREE.Vector3(2.9, 1.6, 5.6);
    const lookA = new THREE.Vector3(-0.3, 2.3, -4);
    const lookB = phone ? new THREE.Vector3(1.0, 1.25, 0.8) : new THREE.Vector3(0.1, 1.3, 0.6);
    const lookNow = new THREE.Vector3();
    const faceScreen = Math.atan2(screen.position.x - spot.x, screen.position.z - spot.z);
    const faceCam = Math.atan2(camB.x - spot.x, camB.z - spot.z);
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    if (astro) astro.group.rotation.y = faceScreen;
    let acted = false;
    s.update = (t, dt) => {
      const lt = Math.max(0, t - t0);
      const u = clamp(lt / dur);
      // Turn from the screen to the team, then react.
      const turn = easeIO(clamp((lt - 0.2) / 0.45));
      if (astro) {
        astro.group.rotation.y = faceScreen + wrap(faceCam - faceScreen) * turn;
        if (!acted && lt >= 0.35) {
          acted = true;
          astro.lookAt(null);
          if (reaction === 'sad') astro.sad({ hold: true });
          else if (reaction === 'cheer') astro.cheer({ duration: 1.6 });
          else astro.celebrate({ duration: 1.8 });
        }
        astro.update(dt);
      }
      team.forEach((p) => {
        const r = clamp((lt - 0.15 - p.ph * 0.1) / 0.4);
        if (good) {
          const up = reduced() ? r : r * (0.85 + 0.15 * Math.sin(lt * 9 + p.ph));
          p.arms[0].rotation.z = -2.6 * up;
          p.arms[1].rotation.z = 2.6 * up;
          p.g.position.y = reduced() ? 0 : Math.max(0, Math.sin(lt * 7 + p.ph)) * 0.08 * r;
        } else {
          p.hd.position.y = 1.62 - 0.07 * r;
          p.hd.position.z = 0.06 * r;
        }
      });
      const k = easeIO(u);
      camera.position.lerpVectors(camA, camB, k);
      lookNow.lerpVectors(lookA, lookB, easeIO(clamp((lt - 0.1) / 0.9)));
      camera.lookAt(lookNow);
    };
    s.dispose = () => {
      scrTex.dispose();
      if (astro) astro.dispose();
    };
    return s;
  }

  // How the director takes the news: lost or missed means a bowed head.
  function reactionOf(tone) {
    if (lost) return 'sad';
    if (m.kind === 'earth') {
      const fr = (p.flight && p.flight.score && p.flight.score.fractions) || (p.result && p.result.score && p.result.score.fractions) || {};
      const key = m.objectives.find((o) => o.key) || m.objectives[0];
      const f = fr[key.id] || 0;
      return f >= 0.8 ? 'celebrate' : f >= 0.4 ? 'cheer' : 'sad';
    }
    return tone === 'ok' ? 'celebrate' : tone === 'warn' ? 'cheer' : 'sad';
  }

  function fmtData(gbit) {
    if (gbit >= 1000) return `${SMD.ui.fmt(gbit / 1000, 1)} Tbit`;
    return `${SMD.ui.fmt(gbit, gbit < 10 ? 1 : 0)} Gbit`;
  }

  // ====================================================================
  // Scripts
  function buildLaunch() {
    const lid = SMD.model.launcherFor ? SMD.model.launcherFor(design) : design.launcher;
    const look = ROCKET_LOOKS[lid] || ROCKET_LOOKS.medium;
    const launcher = SMD.model.opt(D.OPTIONS.launcher, lid);
    const rocketEn = launcher ? launcher.name : design.launcher;
    const rocketTr = tr('design.opt.launcher.' + lid, rocketEn);
    // English reads "on a medium rocket"; other languages keep their own case.
    const rocketName = rocketTr === rocketEn ? rocketEn.toLowerCase() : rocketTr;
    const pad = padSet(look);
    const space = spaceSet(look);
    shot(0, 3.5, pad, (t, dt) => pad.update(t, dt, 'wide'));
    shot(3.5, 5.6, pad, (t, dt) => pad.update(t, dt, 'low'));
    // The director at the viewing stand, watching it go (2.5 s).
    shot(5.6, 8.1, pad, (t, dt) => pad.update(t, dt, 'viewer'));
    shot(8.1, 9.5, pad, (t, dt) => pad.update(t, dt, 'chase'));
    shot(9.5, 17, space, (t, dt) => space.update(t, dt));
    const launchMs = p.launchMs || (p.launch && p.launch.departMs);
    cue(0, 'credit', mapCue('earth'));
    cue(0.1, 'caption', {
      kicker: tr('film.launch.kicker', 'Launch day · {date}', { date: dateStr(launchMs) }),
      title: tr('film.launch.title', '{name} on a {rocket}', { name, rocket: rocketName }),
      text: tr('film.launch.mass', 'Launch mass {wet} kg: {pct}% of what this rocket can lift.', { wet: SMD.ui.fmt(info.wet), pct: Math.round((info.wet / info.cap) * 100) }),
      tone: 'info',
    });
    [3, 2, 1].forEach((n, i) => cue(0.6 + i, 'count', { value: n }));
    cue(3.5, 'count', { value: null });
    cue(5.0, 'count', { value: null });
    cue(3.5, 'count', { value: null });
    cue(3.5, 'big', { text: tr('film.liftoff', 'Liftoff') });
    cue(3.5, 'engine', { level: 0.85, bright: 0.45 });
    cue(3.5, 'sound', { name: 'liftoff' });
    cue(6.6, 'caption', { kicker: tr('film.ascent', 'Ascent'), title: tr('film.maxq', 'Max-Q'), text: tr('film.maxq.text', 'The moment the air pushes hardest on the rocket. The engines throttle down to get through it.'), tone: 'info' });
    cue(6.6, 'engine', { level: 0.7, bright: 0.7 });
    cue(9.8, 'sound', { name: 'stage' });
    cue(9.8, 'engine', { level: 0.08, bright: 0.2 });
    cue(9.8, 'caption', { kicker: tr('film.staging', 'Staging'), title: tr('film.stage.title', 'Stage separation'), text: tr('film.stage.text', 'The first stage is empty and falls away. The upper stage lights up and carries on.'), tone: 'info' });
    cue(10.4, 'engine', { level: 0.32, bright: 0.85 });
    cue(11.6, 'sound', { name: 'fairing' });
    cue(11.6, 'caption', { kicker: tr('film.staging', 'Staging'), title: tr('film.fairing.title', 'Fairing jettison'), text: tr('film.fairing.text', 'Above the air, the nose cone splits open. {name} sees space for the first time.', { name }), tone: 'info' });
    cue(12.9, 'engine', { level: 0, bright: 0 });
    cue(13.3, 'sound', { name: 'sep' });
    cue(13.3, 'caption', { kicker: tr('film.inspace', 'In space'), title: tr('film.sep.title', 'Spacecraft separation'), text: tr('film.sep.text', 'Springs push {name} gently away from the upper stage. From now on it flies on its own.', { name }), tone: 'ok' });
    const check = timeline.find((e) => e.kind === 'checkout');
    if (check) cue(14.3, 'caption', { ...captionOf(check, tr('film.inspace', 'In space')), sound: check.tone });
    if (depItem) cue(15.6, 'caption', { ...captionOf(depItem, tr('film.inspace', 'In space')), sound: depItem.tone });
    const t1 = 17;
    const cruise = timeline.filter((e) => ['departure', 'tcm', 'storm', 'ega', 'software'].includes(e.kind));
    const lossItem = lost ? cruise.find((e) => e.tone === 'bad' && /lost|stops answering/i.test(e.text || '')) || cruise.filter((e) => e.tone === 'bad').pop() || cruise[cruise.length - 1] : null;
    const shown = lossItem ? cruise.slice(0, cruise.indexOf(lossItem) + 1) : cruise;
    if (m.kind === 'earth') {
      const extra = 1;
      const dur = clamp(3.6 + (shown.length + extra) * 2.2, 7.5, 8.5);
      const set = earthOrbitSet(t1, dur);
      shot(t1, t1 + dur, set, (t, dt) => set.update(t, dt));
      let c = t1 + 0.4;
      cue(t1, 'clearHud', {});
      if (arrivalItem && !lost)
        cue(c, 'caption', { kicker: tr('film.orbit.kicker', 'In orbit · {orbit}', { orbit: (m.scienceOrbit && m.scienceOrbit.label) || '' }), title: arrivalItem.title, text: arrivalItem.text, tone: arrivalItem.tone, sound: 'ok' });
      c += 2.6;
      cue(c, 'caption', {
        kicker: tr('film.below', 'Below'),
        title: p.missionKey === 'nile' ? tr('film.nile.title', 'The Nile and its delta') : tr('film.egypt.title', 'Egypt and the Sahara'),
        text: p.missionKey === 'nile' ? tr('film.nile.text', 'A thin green line through the desert. About 95% of Egyptians live along it.') : tr('film.egypt.text', 'Every spring, dust storms rise from this desert. Your infrared eye will watch them form.'),
        tone: 'info',
      });
      c += 2.4;
      shown.forEach((e) => {
        cue(c, 'caption', { ...captionOf(e, tr('film.first.kicker', 'First weeks')), sound: e.tone });
        c += 2.2;
      });
      finish(t1 + dur);
    } else if (m.kind === 'moon') {
      const dur = clamp(2.4 + shown.length * 2.2, 7, 8.5);
      const lossFrac = lossItem ? 0.55 : null;
      const set = moonTransferSet(t1, dur, lossFrac);
      shot(t1, t1 + dur, set, (t, dt) => set.update(t, dt));
      cue(t1, 'clearHud', {});
      cue(t1, 'credit', mapCue('moon'));
      cruiseCaptions(shown, t1, dur, lossItem);
      finish(t1 + dur);
    } else {
      const dur = clamp(2.6 + shown.length * 2.3, 7.5, 8.5);
      const set = trajectorySet(t1, dur, shown, lossItem ? lossItem.ms : null);
      shot(t1, t1 + dur, set, (t, dt) => set.update(t, dt));
      cue(t1, 'clearHud', {});
      cue(t1, 'credit', { text: tr('film.traj.credit', 'Trajectory: Lambert solution on JPL mean planetary elements') });
      cruiseCaptions(shown, t1, dur, lossItem);
      finish(t1 + dur);
    }
  }

  function cruiseCaptions(items, t1, dur, lossItem) {
    const tof = p.launch ? Math.round(p.launch.tofDays) : 0;
    cue(t1 + 0.2, 'caption', {
      kicker: tr('film.cruise.kicker', 'Cruise'),
      title: tr('film.cruise.title', '{days} days to {dest}', { days: tof, dest: destName }),
      text: p.launch && p.launch.route === 'ega' ? tr('film.cruise.ega', 'First a loop back past Earth to steal speed from it, then out to {dest}.', { dest: destName }) : tr('film.cruise.text', 'Not a straight line: an arc around the Sun that meets {dest} where it will be, not where it is today.', { dest: destName }),
      tone: 'info',
    });
    let c = t1 + 2.5;
    const span = t1 + dur - 2.2;
    items.forEach((e, i) => {
      const at = Math.max(c, Math.min(span, t1 + 1.2 + (i + 1) * ((dur - 3) / (items.length + 1))));
      cue(at, 'caption', { ...captionOf(e, tr('film.cruise.kicker', 'Cruise')), sound: e.tone });
      c = at + 2.1;
    });
    if (lossItem) {
      cue(t1 + dur - 1.6, 'caption', { kicker: tr('film.lost.kicker', 'Mission control'), title: tr('film.lost.title', 'Contact lost'), text: tr('film.lost.text', 'The spacecraft has stopped answering. The flight team will keep listening, but the mission is over.'), tone: 'bad', sound: 'bad' });
    } else {
      cue(t1 + dur - 1.4, 'caption', {
        kicker: tr('film.next', 'Next: orbit insertion'),
        title: tr('film.arrive.title', 'Arrival at {dest}: {date}', { dest: destName, date: dateStr(p.arriveMs || (p.launch && p.launch.arriveMs)) }),
        text: tr('film.arrive.text', 'The spacecraft coasts most of the way. The flight team will wake it up for the big burn.'),
        tone: 'info',
      });
    }
  }

  function buildArrival() {
    const deliveredMap = (p.flight && (p.flight.sci && p.flight.sci.st ? p.flight.sci.st.delivered : p.flight.delivered)) || {};
    const totalGbit = Object.values(deliveredMap).reduce((a, b) => a + (b || 0), 0);
    const arriveMs = p.arriveMs || (p.launch && p.launch.arriveMs) || Date.now();
    if (m.kind === 'earth') {
      // Near-Earth missions have no arrival: show operations over Earth.
      const ops = opsSet(0, 8, totalGbit);
      shot(0, 8, ops, (t, dt) => ops.update(t, dt));
      cue(0, 'credit', mapCue('earth'));
      scienceCaptions(0.3, 7.5);
      const dsn = dsnSet(8, 3.4, totalGbit);
      shot(8, 11.4, dsn, (t, dt) => dsn.update(t, dt));
      cue(8, 'credit', dsnCredit());
      dataCaption(8.4, totalGbit);
      // Mission control takes the news (2.2 s).
      const ctl = controlSet(11.4, 2.2, reactionOf('ok'));
      shot(11.4, 13.6, ctl, (t, dt) => ctl.update(t, dt));
      cue(11.4, 'credit', { text: '' });
      finish(13.6);
      return;
    }
    const ap = approachSet();
    const result = ap.result;
    const aero = ap.aero;
    const delayMin = P.lightMinutes(P.earthDistanceAU(m.dest === 'moon' ? 'moon' : m.dest, arriveMs));
    const delaySec = m.kind === 'moon' ? 1.3 : delayMin * 60;
    let t = 0;
    const seg = (t0, len, mode) => shot(t0, t0 + len, ap, (tt, dt) => ap.update(tt, dt, mode, tt - t0, len));
    seg(0, 4, 'approach');
    cue(0, 'credit', mapCue(destKind));
    cue(0.1, 'caption', {
      kicker: tr('film.arrival.kicker', 'Arrival · {date}', { date: dateStr(arriveMs) }),
      title: tr('film.arrival.title', '{name} reaches {dest}', { name, dest: destName }),
      text: tr('film.arrival.text', 'After {days} days in space, one burn decides everything: slow down enough to be caught by {dest}’s gravity, or fly past.', { days: Math.round((p.launch && p.launch.tofDays) || 0), dest: destName }),
      tone: 'info',
    });
    cue(0.2, 'delay', { seconds: delaySec, from: destName });
    t = 4;
    const capDv = L && L.captureDv ? Math.round(L.captureDv * 1000) : null;
    seg(t, 4.4, 'burn');
    cue(t + 0.1, 'caption', {
      kicker: tr('film.insertion.kicker', 'Orbit insertion'),
      title: capDv ? tr('film.burn.title', 'Main engine burn: {dv} m/s', { dv: SMD.ui.fmt(capDv) }) : tr('film.burn.title0', 'Main engine burn'),
      text: tr('film.burn.text', 'Commands were sent long ago. Mission control can only wait for the signal to cross the gap.'),
      tone: 'info',
    });
    cue(t + 0.3, 'engine', { level: 0.22, bright: 0.9 });
    cue(t + 0.3, 'delayCount', { seconds: delaySec, dur: 3.9 });
    cue(t + 4.1, 'engine', { level: 0, bright: 0 });
    t = 8.4;
    seg(t, 3, 'path');
    const tone = arrivalItem ? arrivalItem.tone : result === 'orbit' ? 'ok' : 'bad';
    cue(t + 0.1, 'signal', { tone });
    cue(t + 0.1, 'caption', { kicker: tr('film.signal', 'Signal received'), title: arrivalItem ? arrivalItem.title : tr('film.arrival.short', 'Arrival'), text: arrivalItem ? arrivalItem.text : '', tone, sound: tone === 'ok' ? 'good' : tone });
    t += 3;
    // Mission control takes the news (2.2 s).
    const ctl = controlSet(t, 2.2, reactionOf(tone));
    shot(t, t + 2.2, ctl, (tt, dt) => ctl.update(tt, dt));
    cue(t, 'credit', { text: '' });
    cue(t + 1.8, 'delayHide', {});
    t += 2.2;
    if (lost) {
      finish(t + 0.6);
      return;
    }
    if (aero) {
      seg(t, 3.2, 'aero');
      cue(t + 0.1, 'caption', { ...captionOf(aeroItem, tr('film.aero.kicker', 'Aerobraking · {days} days', { days: (m.aerobrake && m.aerobrake.days) || '' })), sound: aeroItem.tone });
      t += 3.2;
    }
    const nCap = scienceCount();
    const opsDur = clamp(2.4 + nCap * 2, 5.5, 6.8);
    const ops = opsSet(t, opsDur, totalGbit);
    shot(t, t + opsDur, ops, (tt, dt) => ops.update(tt, dt));
    cue(t, 'clearHud', {});
    if (p.missionKey === 'jupiter') cue(t, 'credit', mapCue('europa'));
    cue(t, 'caption', {
      kicker: tr('film.ops.kicker', 'Operations · time-lapse'),
      title: result === 'flyby' ? tr('film.ops.flyby', 'One fast pass') : tr('film.ops.title', '{n} months of science', { n: m.turns || 12 }),
      text: tr('film.ops.text', 'Every instrument maps its strip of ground. The recorder fills, then empties toward Earth whenever the dish can see home.'),
      tone: 'info',
    });
    scienceCaptions(t + 2.2, opsDur - 2.2);
    t += opsDur;
    const dsn = dsnSet(t, 3, totalGbit);
    shot(t, t + 3, dsn, (tt, dt) => dsn.update(tt, dt));
    cue(t, 'credit', dsnCredit());
    dataCaption(t + 0.3, totalGbit);
    finish(t + 3);
  }

  // Operations montage: at most one thing that happened, then the headline
  // goal with the other goals in one line (the results screen has the rest).
  function scienceItems() {
    const notes = timeline.filter((e) => e.kind === 'science').slice(0, 1);
    const fr = (p.flight && p.flight.score && p.flight.score.fractions) || (p.result && p.result.score && p.result.score.fractions) || {};
    const pct = (o) => Math.round((fr[o.id] || 0) * 100);
    const goal = (o) => tr(`mission.${p.missionKey}.obj.${o.id}`, o.label);
    const key = m.objectives.find((o) => o.key) || m.objectives[0];
    const others = m.objectives.filter((o) => o !== key).slice(0, 3);
    const f = (fr[key.id] || 0);
    const objs = [
      {
        title: tr('film.goal.title', '{goal}: {pct}%', { goal: goal(key), pct: pct(key) }),
        text: others.length ? tr('film.goal.others', 'The headline goal. Also: {list}.', { list: others.map((o) => `${goal(o)} ${pct(o)}%`).join(' · ') }) : tr('film.goal.key', 'The headline goal. {pct}% of the data it needs came home.', { pct: pct(key) }),
        tone: f >= 0.8 ? 'ok' : f >= 0.4 ? 'warn' : 'bad',
      },
    ];
    return { notes, objs };
  }
  function scienceCount() {
    const s = scienceItems();
    return s.notes.length + s.objs.length;
  }
  function scienceCaptions(t0, dur) {
    const { notes, objs } = scienceItems();
    const list = notes.map((e) => ({ kicker: tr('film.ops.during2', 'Operations'), title: e.title, text: e.text, tone: e.tone || 'warn' })).concat(objs.map((o) => ({ kicker: tr('film.ops.goal', 'Science goal'), ...o })));
    const step = dur / Math.max(1, list.length);
    list.forEach((c, i) => cue(t0 + i * step, 'caption', { ...c, sound: c.tone }));
  }
  function dataCaption(t0, gbit) {
    cue(t0, 'caption', {
      kicker: tr('film.dsn.kicker', 'Deep Space Network'),
      title: tr('film.dsn.title', 'Data returned: {data}', { data: fmtData(gbit) }),
      text: m.kind === 'earth' ? tr('film.dsn.earth', 'Ground stations catch every pass. The science team turns the data into maps.') : tr('film.dsn.text', 'A 34 m dish on Earth catches a signal weaker than a phone battery’s glow. The science team turns it into discoveries.'),
      tone: 'ok',
      sound: 'good',
    });
  }

  function finish(tEnd) {
    cue(tEnd - 0.05, 'fade', {});
    cue(tEnd, 'end', {});
    duration = tEnd;
  }

  let duration = 20;
  if (kind === 'arrival') buildArrival();
  else buildLaunch();
  cues.sort((a, b) => a.t - b.t);
  sets.forEach(fitFov);

  function step(dt) {
    if (ended || disposed) return;
    // The first animation frame can carry a timestamp from before mount().
    T += Math.max(0, dt || 0);
    while (fired < cues.length && cues[fired].t <= T) emit(cues[fired++]);
    if (T >= duration) {
      ended = true;
      return;
    }
    const sh = shots.find((x) => T >= x.t0 && T < x.t1) || (T < shots[0].t0 ? shots[0] : shots[shots.length - 1]);
    if (sh !== cur) cur = sh;
    sh.update(T, dt);
    if (onFrame) onFrame(T, duration);
  }

  const obj = {
    get scene() {
      return (cur || shots[0]).set.scene;
    },
    get camera() {
      return (cur || shots[0]).set.camera;
    },
    exposure: 1.05,
    get duration() {
      return duration;
    },
    get time() {
      return T;
    },
    update(dt) {
      step(dt);
    },
    onResize(w, h) {
      aspect = w / Math.max(1, h);
      vpH = h * Math.min(2, window.devicePixelRatio || 1);
      sets.forEach(fitFov);
    },
    // Jump ahead (for skipping a part or for screenshots): plays the
    // skipped time in coarse steps so particles and cues stay consistent.
    seek(target) {
      while (T < target - 1e-6 && !ended) step(Math.min(0.05, target - T));
    },
    dispose() {
      disposed = true;
      sets.forEach((s) => {
        if (s.dispose) s.dispose();
        if (s !== (cur || shots[0]).set) disposeTree(s.scene);
      });
    },
  };
  // Start on the first frame so captions and the first shot are in place.
  cur = shots[0];
  return obj;
}
