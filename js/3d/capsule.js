// An Orion-like crew cabin (metres, y up, the floor is the aft bulkhead over
// the heat shield, +z is the forward panel). Shared by the survival segments
// (js/3d/survival.js) and the story player (js/3d/storystage.js).
//
// createCapsuleInterior(opts) -> {
//   group, seats {you,yusuf,lena,grace}, anchors {name: Object3D}, volume,
//   window, windows[], panels, lockers[], bench, outside, update(dt),
//   setAlarm(on), setPower(0..1), setPanels(0..1), setFrost(0..1),
//   setPlasma(0..1), setView(spec), setAttitude(quaternion|null),
//   setLockerLabel(id, text), openLocker(id, 0..1), addBreather(obj, offset),
//   removeBreather(obj), wallFrame(theta, y, inset), dispose() }
//
// The windows look into a separate "outside" scene (stars, the Sun, Earth,
// the Moon, entry plasma) drawn into a render target from the cabin camera's
// point of view, so the view through the glass has real parallax and the
// cabin lights never touch the planets. Call update(dt) every frame.
// Seat anchors: put an astronaut's group at the anchor's world transform and
// call sitPose(astro) after astro.update(dt) every frame.
import { THREE } from './engine.js';
import { makePlanet, makeStars, makeSun, makeParticles } from './assets.js';

const SMD = globalThis.SMD || {};
const DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const reducedMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches || !!(SMD.settings && SMD.settings.reducedMotion);
  } catch (e) {
    return false;
  }
};

// Cabin shape: a cone frustum like Orion's pressure vessel (5 m across at
// the heat shield in the real one; this one is a little smaller inside).
export const CABIN = { r0: 2.3, r1: 1.05, h: 2.55, tunnelR: 0.56, tunnelTop: 3.25 };
const SLOPE = Math.atan((CABIN.r0 - CABIN.r1) / CABIN.h); // wall lean from vertical
const radiusAt = (y) => CABIN.r0 - (CABIN.r0 - CABIN.r1) * clamp(y / CABIN.h, 0, 1);

// The four crew: shirt-sleeve looks for the cast (docs/STORY.md). The player's
// own astronaut comes from SMD.avatar.get().
export const CREW_LOOKS = {
  yusuf: { name: 'Yusuf', suit: 'navy', skin: 's4', hair: 'short', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: 'teal' },
  lena: { name: 'Lena', suit: 'classic', skin: 's1', hair: 'bun', hairColor: 'blond', visor: 'clear', patch: 'agency', patchColor: 'lapis' },
  grace: { name: 'Grace', suit: 'teal', skin: 's6', hair: 'curly', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: 'violet' },
};

// ---------- Poses (applied after astro.update(dt), which resets the joints) ----------
// With the rigged characters (astro.isRigged) these switch the character to
// the matching animation instead of writing joint angles (idempotent, so
// calling them every frame is fine).
export function sitPose(astro, o = {}) {
  if (astro.isRigged) {
    astro.play(o.drive ? 'drive' : 'sit', { hold: true });
    return;
  }
  const j = astro.joints;
  const k = o.relax == null ? 0 : o.relax;
  j.hipL.rotation.x = j.hipR.rotation.x = -1.5;
  j.hipL.rotation.z = 0.08;
  j.hipR.rotation.z = -0.08;
  j.knL.rotation.x = j.knR.rotation.x = 1.42;
  j.ftL.rotation.x = j.ftR.rotation.x = 0.05;
  j.shL.rotation.x = j.shR.rotation.x = -0.42 - 0.1 * k;
  j.elL.rotation.x = j.elR.rotation.x = -0.75;
}
// Microgravity neutral body posture: hips and knees half bent, arms floating up.
export function floatPose(astro, t = 0, o = {}) {
  if (astro.isRigged) {
    // Zero-g neutral body posture is built into the rigged float; the time
    // argument is not needed (the character keeps its own clock).
    const cur = astro.action;
    if (cur === 'sit' || cur === 'rest' || cur === 'lie' || cur === 'drive') astro.stopAction(cur);
    if (!astro.floating) astro.setFloat(true);
    if (astro.setReach) astro.setReach(o.reach || 0);
    if (!!o.carry !== astro.carrying) astro.carry(o.carry ? { spread: 0.35 } : false);
    return;
  }
  const j = astro.joints;
  const w = o.still ? 0 : Math.sin(t * 0.9) * 0.06;
  j.hipL.rotation.x = -0.75 + w;
  j.hipR.rotation.x = -0.62 - w;
  j.knL.rotation.x = 0.95 - w;
  j.knR.rotation.x = 0.8 + w;
  j.ftL.rotation.x = j.ftR.rotation.x = 0.35;
  if (!o.keepArms) {
    j.shL.rotation.x = -0.55 + w;
    j.shR.rotation.x = -0.5 - w;
    j.shL.rotation.z = 0.55;
    j.shR.rotation.z = -0.55;
    j.elL.rotation.x = j.elR.rotation.x = -0.95;
  }
  if (o.reach) {
    j.shR.rotation.x = -1.35 * o.reach - 0.5 * (1 - o.reach);
    j.shR.rotation.z = -0.25;
    j.elR.rotation.x = -0.2;
  }
  if (o.carry) {
    j.shL.rotation.x = j.shR.rotation.x = -1.05;
    j.shL.rotation.z = 0.25;
    j.shR.rotation.z = -0.25;
    j.elL.rotation.x = j.elR.rotation.x = -0.9;
  }
}
// Lying on the back in the shelter (the group itself is rotated by the caller).
export function liePose(astro) {
  if (astro.isRigged) {
    // The caller rotates the group, so this is the relaxed supine pose in
    // the body's own frame ('rest'), not 'lie' (which lies down on the floor).
    astro.play('rest', { hold: true });
    return;
  }
  const j = astro.joints;
  j.hipL.rotation.x = j.hipR.rotation.x = -0.35;
  j.knL.rotation.x = j.knR.rotation.x = 0.6;
  j.shL.rotation.x = j.shR.rotation.x = -0.25;
  j.shL.rotation.z = 0.25;
  j.shR.rotation.z = -0.25;
  j.elL.rotation.x = j.elR.rotation.x = -1.2;
}

// ---------- Canvas textures ----------
function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rnd(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
// Soft quilted wall panels with seams and fasteners.
function wallTexture() {
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#d9dcd8';
    g.fillRect(0, 0, w, h);
    const r = rnd(5);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const px = x * 128;
        const py = y * 128;
        const gr = g.createLinearGradient(px, py, px + 128, py + 128);
        const v = 214 + Math.floor(r() * 16);
        gr.addColorStop(0, `rgb(${v + 6},${v + 8},${v + 5})`);
        gr.addColorStop(1, `rgb(${v - 12},${v - 10},${v - 12})`);
        g.fillStyle = gr;
        g.fillRect(px + 3, py + 3, 122, 122);
        g.fillStyle = 'rgba(70,78,84,0.55)';
        [
          [10, 10],
          [118, 10],
          [10, 118],
          [118, 118],
        ].forEach(([fx, fy]) => {
          g.beginPath();
          g.arc(px + fx, py + fy, 2.6, 0, Math.PI * 2);
          g.fill();
        });
      }
    }
    g.strokeStyle = 'rgba(60,66,72,0.45)';
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 128, 0);
      g.lineTo(i * 128, h);
      g.moveTo(0, i * 128);
      g.lineTo(w, i * 128);
      g.stroke();
    }
  });
}
function floorTexture() {
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#9da5a8';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,46,52,0.6)';
    g.lineWidth = 4;
    // Floor stowage hatches (the shelter bay lives under these).
    for (let i = 0; i < 4; i++) {
      const x = 96 + i * 82;
      g.strokeRect(x, 200, 72, 120);
      g.fillStyle = 'rgba(30,36,40,0.5)';
      g.fillRect(x + 28, 252, 16, 10);
    }
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 120; i++) g.fillRect((i * 97) % w, (i * 61) % h, 2, 2);
    g.strokeStyle = 'rgba(217,162,27,0.7)';
    g.setLineDash([14, 10]);
    g.lineWidth = 3;
    g.beginPath();
    g.arc(w / 2, h / 2, 238, 0, Math.PI * 2);
    g.stroke();
  });
}
// Frost: crystals that grow in from the window edges.
function frostTexture() {
  return canvas(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rnd(11);
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ex = Math.min(x, w - x) / (w / 2);
        const ey = Math.min(y, h - y) / (h / 2);
        const edge = 1 - Math.min(ex, ey);
        const n = r();
        const v = clamp(edge * 1.25 + (n - 0.5) * 0.35);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    for (let k = 0; k < 70; k++) {
      let x = r() * w;
      let y = r() * h;
      let a = r() * Math.PI * 2;
      g.lineWidth = 0.6 + r() * 1.2;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 9;
        a += (r() - 0.5) * 1.2;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}
// Glass-cockpit pages. kind: 'pfd' | 'sys' | 'traj'.
function drawDisplay(g, w, h, kind, warn) {
  g.fillStyle = '#05080c';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1e3a4a';
  g.lineWidth = 2;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.font = '600 15px Archivo, Arial, sans-serif';
  g.fillStyle = '#7fd8ff';
  if (kind === 'pfd') {
    const cx = w / 2;
    const cy = h / 2 + 6;
    const R = h * 0.34;
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#2a5a8c';
    g.fillRect(cx - R, cy - R, 2 * R, R + 10);
    g.fillStyle = '#6b4a2a';
    g.fillRect(cx - R, cy + 10, 2 * R, R);
    g.strokeStyle = '#e9eef2';
    g.lineWidth = 1.5;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(cx - 22, cy + 10 + i * 18);
      g.lineTo(cx + 22, cy + 10 + i * 18);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = '#f0b429';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 46, cy);
    g.lineTo(cx - 14, cy);
    g.lineTo(cx, cy + 10);
    g.lineTo(cx + 14, cy);
    g.lineTo(cx + 46, cy);
    g.stroke();
    g.fillStyle = '#7fd8ff';
    g.fillText('ATT  HOLD', 18, 28);
    g.fillText('RATE 0.2', w - 92, 28);
  } else if (kind === 'sys') {
    g.fillText('EPS  BUS A / B', 18, 28);
    const bars = [0.82, 0.64, 0.4, 0.71, 0.25, 0.55];
    bars.forEach((b, i) => {
      const x = 24 + i * ((w - 48) / 6);
      g.fillStyle = '#12202b';
      g.fillRect(x, 46, 26, h - 90);
      g.fillStyle = b < 0.3 ? '#f06a5f' : b < 0.5 ? '#f0b429' : '#3fc1b4';
      g.fillRect(x, 46 + (h - 90) * (1 - b), 26, (h - 90) * b);
    });
    g.fillStyle = '#7fd8ff';
    g.fillText('O2  PP  CO2  T', 18, h - 18);
  } else {
    g.fillText('TRAJ  EARTH RETURN', 18, 28);
    g.strokeStyle = '#3fc1b4';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(w * 0.28, h * 0.6, 22, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(w * 0.82, h * 0.42, 9, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([6, 5]);
    g.beginPath();
    g.ellipse(w * 0.55, h * 0.52, w * 0.3, h * 0.2, -0.15, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }
  if (warn) {
    g.fillStyle = '#b4302c';
    g.fillRect(w - 128, h - 40, 112, 26);
    g.fillStyle = '#fff';
    g.fillText('MASTER ALM', w - 120, h - 21);
  }
}
function lockerTexture(id, text) {
  return canvas(256, 200, (g, w, h) => {
    g.fillStyle = '#e8ebe7';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9aa3a6';
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#14273c';
    g.fillRect(14, 14, 56, 34);
    g.fillStyle = '#ffffff';
    g.font = '700 24px Archivo, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(id, 42, 32);
    if (text) {
      g.fillStyle = '#23282e';
      const rtl = SMD.dir && SMD.dir() === 'rtl';
      g.direction = rtl ? 'rtl' : 'ltr';
      let size = 30;
      g.font = `700 ${size}px Archivo, "Noto Kufi Arabic", Arial, sans-serif`;
      while (g.measureText(text).width > w - 30 && size > 14) {
        size -= 2;
        g.font = `700 ${size}px Archivo, "Noto Kufi Arabic", Arial, sans-serif`;
      }
      g.fillText(text, w / 2, h * 0.6);
    }
    g.fillStyle = '#545d66';
    g.fillRect(w / 2 - 34, h - 34, 68, 12);
  });
}

// ---------- The window portal ----------
const PORTAL_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const PORTAL_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uOutside;
uniform sampler2D uFrostMap;
uniform vec2 uRes;
uniform float uFrost;
uniform float uPlasma;
uniform float uDim;
varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 col = texture2D(uOutside, suv).rgb;
  // A faint reflection of the lit cabin on the glass.
  float edge = smoothstep(0.0, 0.18, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
  col += vec3(0.05, 0.06, 0.07) * uDim * (1.0 - vUv.y * 0.6);
  col += vec3(1.0, 0.45, 0.16) * uPlasma * 0.35 * (1.0 - edge * 0.5);
  float f = texture2D(uFrostMap, vUv).r;
  float fr = smoothstep(1.0 - uFrost * 1.15, 1.0 - uFrost * 1.15 + 0.25, f) * uFrost;
  col = mix(col, vec3(0.78, 0.84, 0.9) * (0.35 + 0.5 * uDim), clamp(fr, 0.0, 0.92));
  col *= mix(0.55, 1.0, edge);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function roundedRect(w, h, r) {
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

// Planet directions in the outside scene (cabin frame: +z forward, +y up).
const VIEWS = {
  both: { earth: { dir: [0.55, 0.25, 0.8], deg: 7 }, moon: { dir: [-0.9, 0.1, 0.3], deg: 26 }, sun: [0.3, 0.8, -0.5] },
  earth: { earth: { dir: [0.1, 0.35, 0.93], deg: 11 }, moon: null, sun: [0.2, 0.9, -0.3] },
  moon: { earth: { dir: [0.95, 0.2, -0.2], deg: 3 }, moon: { dir: [-0.2, 0.25, 0.95], deg: 40 }, sun: [0.7, 0.3, -0.6] },
  farside: { earth: null, moon: { dir: [-0.1, 0.2, 0.97], deg: 48 }, sun: [-0.9, 0.2, -0.2] },
  space: { earth: null, moon: null, sun: [0.4, 0.7, -0.6] },
};

export function createCapsuleInterior(opts = {}) {
  const group = new THREE.Group();
  group.name = 'capsule';
  const own = [];
  const keep = (x) => (own.push(x), x);
  const reduced = reducedMotion();

  // ---------- Materials ----------
  const M = {
    wall: keep(new THREE.MeshStandardMaterial({ map: keep(wallTexture()), roughness: 0.85, metalness: 0, side: THREE.DoubleSide })),
    floor: keep(new THREE.MeshStandardMaterial({ map: keep(floorTexture()), roughness: 0.9 })),
    frame: keep(new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.5, metalness: 0.4 })),
    dark: keep(new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.6, metalness: 0.2 })),
    metal: keep(new THREE.MeshStandardMaterial({ color: 0xa9b1b6, roughness: 0.35, metalness: 0.8 })),
    rail: keep(new THREE.MeshStandardMaterial({ color: 0x4e6f8f, roughness: 0.4, metalness: 0.3 })),
    cushion: keep(new THREE.MeshStandardMaterial({ color: 0x2f4a66, roughness: 0.9 })),
    seat: keep(new THREE.MeshStandardMaterial({ color: 0x59636c, roughness: 0.55, metalness: 0.35 })),
    led: keep(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 1.6 })),
    alarm: keep(new THREE.MeshStandardMaterial({ color: 0x5a0d0a, emissive: 0xff2a1a, emissiveIntensity: 0 })),
    amber: keep(new THREE.MeshStandardMaterial({ color: 0x4a3300, emissive: 0xffb020, emissiveIntensity: 0.6 })),
    green: keep(new THREE.MeshStandardMaterial({ color: 0x0c3a20, emissive: 0x3fe08a, emissiveIntensity: 0.7 })),
    bag: keep(new THREE.MeshStandardMaterial({ color: 0xe6e0cf, roughness: 0.95 })),
    medkit: keep(new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.7 })),
    red: keep(new THREE.MeshStandardMaterial({ color: 0xb4302c, roughness: 0.6 })),
  };

  // ---------- Shell ----------
  const prof = [
    new THREE.Vector2(CABIN.r0, -0.02),
    new THREE.Vector2(CABIN.r0 - 0.02, 0.08),
    new THREE.Vector2(CABIN.r1, CABIN.h),
    new THREE.Vector2(CABIN.r1 - 0.1, CABIN.h + 0.12),
    new THREE.Vector2(CABIN.tunnelR + 0.08, CABIN.h + 0.2),
    new THREE.Vector2(CABIN.tunnelR, CABIN.h + 0.28),
    new THREE.Vector2(CABIN.tunnelR, CABIN.tunnelTop),
  ];
  const shellGeo = new THREE.LatheGeometry(prof, 72);
  {
    // Lathe UVs spread v evenly per profile point; use the height instead so
    // the wall panels keep their shape.
    const pa = shellGeo.attributes.position;
    const ua = shellGeo.attributes.uv;
    for (let i = 0; i < ua.count; i++) ua.setY(i, pa.getY(i) / CABIN.tunnelTop);
  }
  M.wall.map.wrapS = M.wall.map.wrapT = THREE.RepeatWrapping;
  M.wall.map.repeat.set(14, 4);
  const shell = new THREE.Mesh(shellGeo, M.wall);
  shell.name = 'shell';
  group.add(shell);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(CABIN.r0, 64), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  group.add(floor);
  // Docking hatch at the top of the tunnel, with its wheel.
  const topHatch = new THREE.Mesh(new THREE.CircleGeometry(CABIN.tunnelR, 40), M.frame);
  topHatch.rotation.x = Math.PI / 2;
  topHatch.position.y = CABIN.tunnelTop - 0.02;
  group.add(topHatch);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 32), M.metal);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.y = CABIN.tunnelTop - 0.06;
  group.add(wheel);

  // A local frame on the wall: +z points into the cabin, +y up the slope.
  function wallFrame(theta, y, inset = 0) {
    const r = radiusAt(y);
    const out = new THREE.Vector3(Math.sin(theta) * Math.cos(SLOPE), Math.sin(SLOPE), Math.cos(theta) * Math.cos(SLOPE));
    const zAx = out.clone().negate();
    const up = new THREE.Vector3(-Math.sin(theta) * Math.sin(SLOPE), Math.cos(SLOPE), -Math.cos(theta) * Math.sin(SLOPE));
    const xAx = new THREE.Vector3().crossVectors(up, zAx).normalize();
    const pos = new THREE.Vector3(Math.sin(theta) * r, y, Math.cos(theta) * r).addScaledVector(zAx, inset);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, up, zAx));
    return { pos, q, normal: zAx, up, right: xAx };
  }
  function onWall(obj, theta, y, inset = 0.01) {
    const f = wallFrame(theta, y, inset);
    obj.position.copy(f.pos);
    obj.quaternion.copy(f.q);
    group.add(obj);
    return obj;
  }

  const anchors = {};
  function anchor(name, pos, lookAt) {
    const a = new THREE.Object3D();
    a.name = 'anchor:' + name;
    a.position.copy(pos);
    if (lookAt) a.lookAt(lookAt);
    group.add(a);
    anchors[name] = a;
    return a;
  }
  // An anchor floating in front of a wall spot, facing into the cabin.
  function wallAnchor(name, theta, y, off = 0.55) {
    const f = wallFrame(theta, y, off);
    const a = anchor(name, f.pos);
    a.quaternion.copy(f.q);
    return a;
  }

  // ---------- The forward panel: three glass-cockpit displays ----------
  const panels = { group: new THREE.Group(), screens: [], level: 1 };
  {
    const f = wallFrame(0, 1.38, 0.2);
    const pg = panels.group;
    pg.position.copy(f.pos);
    pg.quaternion.copy(f.q);
    pg.rotateX(-0.28); // tilt the console toward the seats
    group.add(pg);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 0.16), M.dark);
    pg.add(body);
    const kinds = ['sys', 'pfd', 'traj'];
    kinds.forEach((k, i) => {
      const c = document.createElement('canvas');
      c.width = 384;
      c.height = 256;
      const g = c.getContext('2d');
      drawDisplay(g, 384, 256, k, false);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      own.push(tex);
      const mat = keep(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.37), mat);
      scr.position.set((i - 1) * 0.64, 0.05, 0.081);
      pg.add(scr);
      const bez = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.43, 0.02), M.frame);
      bez.position.set(scr.position.x, 0.05, 0.07);
      pg.add(bez);
      panels.screens.push({ kind: k, mesh: scr, mat, tex, g, canvas: c, warn: false });
    });
    // Switch row and caution lights under the displays.
    const sw = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6), M.metal, 24);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 24; i++) {
      m4.makeRotationX(Math.PI / 2 - 0.3);
      m4.setPosition(-0.9 + i * 0.078, -0.24, 0.1);
      sw.setMatrixAt(i, m4);
    }
    pg.add(sw);
    const lamps = [];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.01), i % 3 === 0 ? M.amber : M.green);
      l.position.set(-0.9 + i * 0.07, 0.29, 0.085);
      pg.add(l);
      lamps.push(l);
    }
    const alarm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.02), M.alarm);
    alarm.position.set(0.82, 0.29, 0.085);
    pg.add(alarm);
    panels.alarm = alarm;
    // Hand controller and a COAS sight bracket.
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.14, 8), M.dark);
    stick.position.set(-0.55, -0.34, 0.14);
    stick.rotation.x = 0.8;
    pg.add(stick);
    ['panel_left', 'panel_center', 'panel_right'].forEach((n, i) => {
      const a = new THREE.Object3D();
      a.position.set((i - 1) * 0.64, 0.05, 0.55);
      pg.add(a);
      a.name = 'anchor:' + n;
      anchors[n] = a;
    });
  }

  // ---------- Windows ----------
  const windowsList = [];
  const frostMap = keep(frostTexture());
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
  own.push(rt);
  const portalU = {
    uOutside: { value: rt.texture },
    uFrostMap: { value: frostMap },
    uRes: { value: new THREE.Vector2(1, 1) },
    uFrost: { value: 0 },
    uPlasma: { value: 0 },
    uDim: { value: 1 },
  };
  const portalMat = keep(new THREE.ShaderMaterial({ uniforms: portalU, vertexShader: PORTAL_VERT, fragmentShader: PORTAL_FRAG }));
  const WINS = [
    { id: 'fwdL', theta: -0.42, y: 2.08, w: 0.42, h: 0.34 },
    { id: 'fwdR', theta: 0.42, y: 2.08, w: 0.42, h: 0.34 },
    { id: 'side', theta: -1.45, y: 1.55, w: 0.4, h: 0.4 },
    { id: 'rear', theta: 2.55, y: 1.75, w: 0.36, h: 0.36 },
  ];
  WINS.forEach((wd) => {
    const g = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(wd.w, wd.h, 0.07), 6), portalMat);
    // ShapeGeometry UVs are in shape units: map them to 0..1.
    const uv = pane.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / wd.w + 0.5, uv.getY(i) / wd.h + 0.5);
    pane.onBeforeRender = renderOutside;
    g.add(pane);
    const ring = roundedRect(wd.w + 0.14, wd.h + 0.14, 0.12);
    ring.holes.push(roundedRect(wd.w - 0.01, wd.h - 0.01, 0.065));
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.07, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 6 }), M.frame);
    frame.position.z = -0.03;
    g.add(frame);
    onWall(g, wd.theta, wd.y, 0.02);
    windowsList.push({ id: wd.id, group: g, pane, theta: wd.theta, y: wd.y, frame: wallFrame(wd.theta, wd.y, 0.02) });
  });
  wallAnchor('window', WINS[0].theta, WINS[0].y - 0.15, 0.6);

  // ---------- Side hatch (with a small round window) ----------
  const hatch = new THREE.Group();
  {
    const door = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(0.92, 1.0, 0.2), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), M.seat);
    hatch.add(door);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 20, Math.PI), M.metal);
    handle.position.set(0.28, 0, 0.1);
    handle.rotation.z = -Math.PI / 2;
    hatch.add(handle);
    const port = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), portalMat);
    port.position.set(-0.12, 0.22, 0.083);
    port.onBeforeRender = renderOutside;
    hatch.add(port);
    const pr = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 24), M.frame);
    pr.position.copy(port.position);
    hatch.add(pr);
    onWall(hatch, Math.PI / 2, 1.05, 0.04);
    wallAnchor('hatch', Math.PI / 2, 1.05, 0.6);
  }

  // ---------- Lockers (aft wall, two rows of four) ----------
  const lockers = [];
  {
    const cols = [Math.PI - 0.66, Math.PI - 0.22, Math.PI + 0.22, Math.PI + 0.66];
    const rows = [1.25, 0.62];
    let n = 0;
    rows.forEach((y) => {
      cols.forEach((th) => {
        n++;
        const id = 'L' + n;
        const g = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.06), M.frame);
        box.position.z = -0.01;
        g.add(box);
        const pivot = new THREE.Group();
        pivot.position.set(-0.22, 0, 0.03);
        g.add(pivot);
        const tex = lockerTexture(String(n), '');
        own.push(tex);
        const doorMat = keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.37, 0.025), [M.medkit, M.medkit, M.medkit, M.medkit, doorMat, M.medkit]);
        door.position.x = 0.215;
        pivot.add(door);
        const inside = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.34), M.dark);
        inside.position.z = 0.021;
        g.add(inside);
        // A stowage bag peeking out of each locker.
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.05), M.bag);
        bag.position.set(0, -0.04, 0.03);
        g.add(bag);
        onWall(g, th, y, 0.03);
        door.userData.lockerId = id;
        box.userData.lockerId = id;
        const a = wallAnchor('locker_' + n, th, y, 0.6);
        lockers.push({ id, n, group: g, door, pivot, doorMat, tex, open: 0, target: 0, anchor: a, theta: th, y, label: '' });
      });
    });
  }

  // ---------- Work surface, medical kit, toilet, camera ----------
  const bench = new THREE.Group();
  {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.36), M.seat);
    top.position.set(0, 0, 0.2);
    bench.add(top);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), M.frame);
    arm.position.set(0, -0.09, 0.08);
    bench.add(arm);
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.3), keep(new THREE.MeshStandardMaterial({ color: 0x24303a, roughness: 0.8 })));
    grid.rotation.x = -Math.PI / 2;
    grid.position.set(0, 0.019, 0.2);
    bench.add(grid);
    const f = wallFrame(-1.0, 0.95, 0.02);
    bench.position.copy(f.pos);
    // Keep the table level: face it along the wall normal projected on the floor.
    const flat = new THREE.Vector3(f.normal.x, 0, f.normal.z).normalize();
    bench.rotation.y = Math.atan2(flat.x, flat.z);
    group.add(bench);
    bench.userData.top = new THREE.Vector3(0, 0.02, 0.2);
    const a = new THREE.Object3D();
    a.position.set(0, 0.25, 0.75);
    bench.add(a);
    anchors.bench = a;
  }
  {
    const kit = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.1), M.medkit);
    kit.add(box);
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.012), M.red);
    c1.position.z = 0.056;
    const c2 = c1.clone();
    c2.rotation.z = Math.PI / 2;
    kit.add(c1, c2);
    onWall(kit, -2.05, 1.5, 0.06);
    wallAnchor('medkit', -2.05, 1.5, 0.6);
  }
  {
    // Toilet bay behind a curtain (Orion's is in the floor-level corner).
    const loo = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.08), M.seat);
    loo.add(cab);
    const cur = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.86), keep(new THREE.MeshStandardMaterial({ color: 0x8aa0b0, roughness: 1, side: THREE.DoubleSide })));
    cur.position.z = 0.06;
    loo.add(cur);
    const sign = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), M.green);
    sign.position.set(0.22, 0.36, 0.07);
    loo.add(sign);
    onWall(loo, 2.1, 0.6, 0.06);
    wallAnchor('toilet', 2.1, 0.6, 0.65);
  }
  {
    // A handheld camera on a bracket by the forward window.
    const cam = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.08), M.dark);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.09, 16), M.dark);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.08;
    cam.add(body, lens);
    onWall(cam, 0.75, 1.95, 0.12);
    wallAnchor('camera', 0.75, 1.95, 0.6);
  }

  // ---------- Handrails ----------
  {
    const railGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.5, 8);
    [
      [-0.85, 1.8],
      [0.85, 1.8],
      [Math.PI / 2 - 0.55, 1.2],
      [Math.PI / 2 + 0.55, 1.2],
      [-1.75, 1.0],
      [2.6, 1.15],
      [-2.6, 1.15],
    ].forEach(([th, y]) => {
      const r = new THREE.Mesh(railGeo, M.rail);
      r.rotation.z = Math.PI / 2;
      const g = new THREE.Group();
      r.position.z = 0.07;
      g.add(r);
      onWall(g, th, y, 0.01);
    });
  }

  // ---------- Seats (two front, two behind and a little higher) ----------
  const seats = {};
  const seatMeshes = {};
  const SEATS = {
    you: { x: -0.46, z: 0.32, y: 0.62 },
    yusuf: { x: 0.46, z: 0.32, y: 0.62 },
    lena: { x: -0.5, z: -0.62, y: 0.86 },
    grace: { x: 0.5, z: -0.62, y: 0.86 },
  };
  Object.keys(SEATS).forEach((id) => {
    const s = SEATS[id];
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    const pan = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.5), M.cushion);
    pan.position.set(0, 0, 0.05);
    g.add(pan);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.08), M.cushion);
    back.position.set(0, 0.36, -0.22);
    back.rotation.x = -0.32;
    g.add(back);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.08), M.cushion);
    head.position.set(0, 0.84, -0.38);
    head.rotation.x = -0.32;
    g.add(head);
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.95), M.seat);
    frameL.position.set(-0.27, -0.06, 0.05);
    const frameR = frameL.clone();
    frameR.position.x = 0.27;
    g.add(frameL, frameR);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, s.y, 8), M.metal);
    strut.position.set(0, -s.y / 2, 0);
    g.add(strut);
    group.add(g);
    seatMeshes[id] = g;
    // Anchor: the astronaut's feet origin; hips land on the back of the pan.
    const a = new THREE.Object3D();
    a.name = 'seat:' + id;
    a.position.set(s.x, s.y + 0.06 - 0.9, s.z - 0.14);
    group.add(a);
    seats[id] = a;
    anchors['seat_' + id] = a;
  });
  anchor('start', new THREE.Vector3(0, 1.0, -0.1));

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xe8eef4, 0x4a4f55, 0.9);
  group.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.18);
  group.add(amb);
  const ceil = [];
  [
    [0, 2.35, 0.35],
    [0, 2.35, -0.5],
    [-1.1, 1.9, -0.6],
    [1.1, 1.9, -0.6],
  ].forEach(([x, y, z]) => {
    const p = new THREE.PointLight(0xfff1dc, 1.7, 6, 1.6);
    p.position.set(x, y, z);
    group.add(p);
    ceil.push(p);
  });
  // LED strips on the upper wall.
  const ledGeo = new THREE.BoxGeometry(0.5, 0.035, 0.02);
  [0.6, 1.6, 2.6, 3.7, 4.7, 5.7].forEach((th) => {
    const l = new THREE.Mesh(ledGeo, M.led);
    onWall(l, th, 2.3, 0.02);
  });
  const ledRing = new THREE.Mesh(new THREE.TorusGeometry(CABIN.tunnelR + 0.03, 0.02, 6, 48), M.led);
  ledRing.rotation.x = Math.PI / 2;
  ledRing.position.y = CABIN.h + 0.27;
  group.add(ledRing);
  const alarmLight = new THREE.PointLight(0xff2a1a, 0, 7, 1.4);
  alarmLight.position.set(0, 1.9, 0.6);
  group.add(alarmLight);
  const plasmaLight = new THREE.PointLight(0xff8a3c, 0, 5, 1.2);
  plasmaLight.position.set(0, 2.0, 1.1);
  group.add(plasmaLight);

  // ---------- The outside scene (seen only through the windows) ----------
  const outside = { scene: new THREE.Scene(), root: new THREE.Group(), camera: new THREE.PerspectiveCamera(50, 1, 5, 2e5), attitude: new THREE.Quaternion() };
  outside.scene.background = new THREE.Color(0x000000);
  outside.scene.add(outside.root);
  const stars = makeStars(3000, 9e4, 13);
  outside.root.add(stars);
  const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
  outside.root.add(sunLight);
  outside.root.add(sunLight.target);
  const sunSprite = makeSun(5200);
  outside.root.add(sunSprite);
  outside.scene.add(new THREE.AmbientLight(0x223344, 0.05));
  let earth = null;
  let moon = null;
  try {
    earth = makePlanet('earth', 1000, { segments: 96 });
    moon = makePlanet('moon', 1000, { segments: 96 });
    outside.root.add(earth, moon);
  } catch (e) {
    console.warn('capsule: planets unavailable', e);
  }
  outside.earth = earth;
  outside.moon = moon;
  outside.sun = sunLight;
  // Entry plasma: a glowing shell around the window camera, plus streaks.
  const plasmaMat = keep(new THREE.MeshBasicMaterial({ color: 0xff7a2c, transparent: true, opacity: 0, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  const plasma = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), plasmaMat);
  plasma.renderOrder = 10;
  outside.scene.add(plasma);
  const streaks = makeParticles(260, { size: 3.2, attenuate: true });
  outside.scene.add(streaks.points);
  streaks.points.renderOrder = 11;
  const skyMat = keep(new THREE.MeshBasicMaterial({ color: 0x6fa8dc, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, depthTest: false }));
  const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 16), skyMat);
  sky.renderOrder = 9;
  outside.scene.add(sky);

  function setView(spec) {
    const v = typeof spec === 'string' ? VIEWS[spec] || VIEWS.both : Object.assign({}, VIEWS.both, spec || {});
    const place = (body, s) => {
      if (!body) return;
      body.visible = !!s;
      if (!s) return;
      const dir = new THREE.Vector3().fromArray(s.dir).normalize();
      const R = 1000;
      const d = R / Math.tan((s.deg * DEG) / 2);
      body.position.copy(dir).multiplyScalar(d);
      if (s.spin != null) body.rotation.y = s.spin;
    };
    place(earth, v.earth);
    place(moon, v.moon);
    const sd = new THREE.Vector3().fromArray(v.sun || [0.4, 0.7, -0.6]).normalize();
    sunLight.position.copy(sd).multiplyScalar(1e5);
    sunLight.target.position.set(0, 0, 0);
    sunSprite.position.copy(sd).multiplyScalar(8e4);
    outside.view = v;
  }
  setView(opts.outside || opts.view || 'both');

  // Draw the outside once per frame, from the cabin camera's point of view.
  let needOutside = true;
  const _q = new THREE.Quaternion();
  const _q2 = new THREE.Quaternion();
  const _v = new THREE.Vector2();
  function renderOutside(renderer, scene, camera) {
    if (!needOutside || renderer.isNullRenderer) return;
    needOutside = false;
    renderer.getDrawingBufferSize(_v);
    const scale = SMD.settings && SMD.settings.tier && SMD.settings.tier() === 'low' ? 0.5 : 0.75;
    const w = Math.max(2, Math.round(_v.x * scale));
    const h = Math.max(2, Math.round(_v.y * scale));
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    portalU.uRes.value.copy(_v);
    const oc = outside.camera;
    oc.fov = camera.fov;
    oc.aspect = camera.aspect;
    oc.updateProjectionMatrix();
    group.getWorldQuaternion(_q).invert();
    camera.getWorldQuaternion(_q2);
    oc.quaternion.copy(_q).multiply(_q2);
    oc.position.set(0, 0, 0);
    outside.root.quaternion.copy(outside.attitude).invert();
    oc.updateMatrixWorld();
    plasma.position.copy(oc.position);
    sky.position.copy(oc.position);
    const cur = renderer.getRenderTarget();
    const xr = renderer.xr.enabled;
    const sh = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(outside.scene, oc);
    renderer.xr.enabled = xr;
    renderer.shadowMap.autoUpdate = sh;
    renderer.setRenderTarget(cur);
  }

  // ---------- Breath fog (cold cabin) ----------
  const fog = makeParticles(160, { size: 0.16, attenuate: true, additive: false });
  fog.points.material.opacity = 0.55;
  group.add(fog.points);
  const breathers = [];
  function addBreather(obj, offset) {
    breathers.push({ obj, offset: offset || new THREE.Vector3(0, 1.58, 0.16), next: Math.random() * 3 });
  }
  function removeBreather(obj) {
    const i = breathers.findIndex((b) => b.obj === obj);
    if (i >= 0) breathers.splice(i, 1);
  }

  // ---------- State ----------
  let alarmOn = false;
  let power = 1;
  let panelsLevel = 1;
  let frost = 0;
  let plasmaK = 0;
  let skyK = 0;
  let time = 0;
  let lastWarn = null;
  const _p = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _w = new THREE.Vector3();

  function redrawScreens(warn) {
    panels.screens.forEach((s) => {
      drawDisplay(s.g, 384, 256, s.kind, warn);
      s.tex.needsUpdate = true;
    });
  }

  function applyLights() {
    const k = power;
    const flick = alarmOn && !reduced ? 0.85 + 0.15 * Math.sin(time * 31) : 1;
    ceil.forEach((p) => (p.intensity = 1.7 * k * flick));
    hemi.intensity = 0.25 + 0.65 * k;
    amb.intensity = 0.06 + 0.12 * k;
    M.led.emissiveIntensity = 0.15 + 1.45 * k;
    const pk = Math.min(panelsLevel, clamp(power * 1.6));
    panels.screens.forEach((s, i) => {
      // Lowest settings keep only the middle (attitude) display alive.
      const on = pk > 0.05 && (pk > 0.4 || i === 1);
      const v = on ? 0.25 + 0.75 * pk : 0.02;
      s.mat.color.setRGB(v, v, v);
    });
    portalU.uDim.value = power;
  }
  if (opts.power != null) power = clamp(Number(opts.power));
  applyLights();

  function update(dt) {
    dt = Math.min(dt || 0, 0.1);
    time += dt;
    needOutside = true;
    // Alarm: a red pulse (steady with reduced motion).
    const pulse = alarmOn ? (reduced ? 0.7 : 0.5 + 0.5 * Math.sign(Math.sin(time * 7))) : 0;
    M.alarm.emissiveIntensity = alarmOn ? 0.4 + 2.6 * pulse : 0;
    alarmLight.intensity = alarmOn ? 2.4 * pulse : 0;
    if (alarmOn !== lastWarn) {
      lastWarn = alarmOn;
      redrawScreens(alarmOn);
    }
    applyLights();
    // Lockers swing open and shut.
    lockers.forEach((l) => {
      l.open += (l.target - l.open) * Math.min(1, dt * 6);
      l.pivot.rotation.y = -l.open * 1.75;
    });
    // Plasma and streaks.
    plasmaMat.opacity = plasmaK * (reduced ? 0.55 : 0.45 + 0.15 * Math.sin(time * 23) * Math.sin(time * 7.3));
    portalU.uPlasma.value = plasmaK;
    plasmaLight.intensity = plasmaK * (reduced ? 2.2 : 1.8 + 0.8 * Math.sin(time * 17));
    if (plasmaK > 0.05) {
      const n = Math.round(plasmaK * 6);
      const oc = outside.camera;
      for (let i = 0; i < n; i++) {
        _dir.set((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2, -1).normalize().applyQuaternion(oc.quaternion);
        _p.copy(_dir).multiplyScalar(30 + Math.random() * 15);
        _w.copy(_dir).multiplyScalar(-55 - Math.random() * 30);
        streaks.emit(_p, _w, 0.5, 0xffd2a0, 0xff4a10);
      }
    }
    streaks.update(dt);
    skyMat.opacity = skyK;
    // Breath fog when cold: an exhale every few seconds.
    if (frost > 0.25 && breathers.length) {
      breathers.forEach((b) => {
        b.next -= dt;
        if (b.next > 0) return;
        b.next = 2.8 + Math.random() * 1.6;
        if (!b.obj.parent) return;
        b.obj.updateWorldMatrix(true, false);
        const head = b.offset.clone().applyMatrix4(b.obj.matrixWorld);
        group.worldToLocal(head);
        const fwd = new THREE.Vector3(0, 0, 1).transformDirection(b.obj.matrixWorld);
        const k = Math.round(4 + frost * 6);
        for (let i = 0; i < k; i++) {
          const v = fwd.clone().multiplyScalar(0.18 + Math.random() * 0.12).add(new THREE.Vector3((Math.random() - 0.5) * 0.06, 0.02 + Math.random() * 0.04, (Math.random() - 0.5) * 0.06));
          fog.emit(head, v, 1.6 + Math.random() * 0.8, 0xdfe8ee, 0x8a949c);
        }
      });
    }
    fog.update(dt, 0.7);
  }

  const api = {
    group,
    seats,
    seatMeshes,
    anchors,
    // Free-float space for the zero-g controller (cabin frame, metres).
    // min/max is the box the shared controller uses (feet origin from min.y
    // to max.y minus the body height); clamp() then keeps it inside the cone.
    volume: {
      min: new THREE.Vector3(-1.45, 0.12, -1.45),
      max: new THREE.Vector3(1.45, 2.7, 1.45),
      // Keep a point (feet origin of a floating astronaut) inside the cone.
      clamp(p, pad = 0.35) {
        p.y = clamp(p.y, 0.05, CABIN.h - 1.2);
        const r = radiusAt(p.y + 0.9) - pad;
        const d = Math.hypot(p.x, p.z);
        if (d > r) {
          p.x *= r / d;
          p.z *= r / d;
        }
        return p;
      },
    },
    // The main forward window (an Object3D, +z into the cabin); windows[] has all.
    window: windowsList[0].group,
    windows: windowsList,
    panels,
    lockers,
    bench,
    hatch,
    outside,
    wallFrame,
    radiusAt,
    update,
    setAlarm(on) {
      alarmOn = !!on;
    },
    setPower(k) {
      power = clamp(Number(k));
    },
    setPanels(k) {
      panelsLevel = clamp(Number(k));
    },
    setFrost(k) {
      frost = clamp(Number(k));
      portalU.uFrost.value = frost;
    },
    setPlasma(k) {
      plasmaK = clamp(Number(k));
    },
    setSky(k) {
      skyK = clamp(Number(k));
    },
    setView,
    // Spacecraft attitude: rotates the outside world past the windows.
    setAttitude(q) {
      if (q) outside.attitude.copy(q);
      else outside.attitude.identity();
    },
    setLockerLabel(id, text) {
      const l = lockers.find((x) => x.id === id);
      if (!l || l.label === text) return;
      l.label = text;
      const tex = lockerTexture(String(l.n), text);
      l.doorMat.map = tex;
      l.doorMat.needsUpdate = true;
      l.tex.dispose();
      l.tex = tex;
      own.push(tex);
    },
    openLocker(id, k) {
      const l = lockers.find((x) => x.id === id);
      if (l) l.target = clamp(k == null ? 1 : k);
    },
    addBreather,
    removeBreather,
    dispose() {
      own.forEach((o) => o && o.dispose && o.dispose());
      outside.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && !(o.material.userData && o.material.userData.keep)) o.material.dispose();
      });
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      if (group.parent) group.parent.remove(group);
    },
  };
  return api;
}
