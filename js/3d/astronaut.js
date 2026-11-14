// The player's astronaut: a friendly, low-poly spacesuit character, 1.75 m
// tall with the feet at the origin, facing +Z. Parts are grouped by joint and
// merged per material, so the whole character is ~30 draw calls and under
// 3k triangles. Animation is procedural: walk cycle, wave, celebrate, sad,
// look-at, idle breathing and blinking.
//
//   const astro = createAstronaut(SMD.avatar.get());
//   scene.add(astro.group);  ...  astro.update(dt) every frame
//
// Also: createPortrait(appearance, size) -> Promise<dataURL> for the UI,
// createWalker(astro, opts) for click-to-move and WASD walking, and
// createAvatarStage(appearance, opts) (the creator's turntable scene).
import { THREE, studioEnv } from './engine.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { preloadCharacters, charactersReady, charactersFailed, createRigged, CAST, resolveLook } from './character.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});
const TAU = Math.PI * 2;
const HEIGHT = 1.75;

// ---------- Appearance (works even before js/avatar.js is loaded) ----------
const FALLBACK = { name: 'Director', suit: 'classic', skin: 's3', hair: 'short', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#17807a' };
function norm(a) {
  if (SMD.avatar && SMD.avatar.normalize) return SMD.avatar.normalize(a);
  return Object.assign({}, FALLBACK, a || {});
}
function colorsOf(a) {
  if (SMD.avatar && SMD.avatar.colors) return SMD.avatar.colors(a);
  return { body: '#eceee9', accent: '#e3662a', trim: '#5a636b', skin: '#cf9a6c', hair: '#1f1b19', patch: a.patchColor || '#17807a' };
}

// ---------- Geometry helpers ----------
// A box with rounded edges (after three's RoundedBoxGeometry): the middle row
// of a segmented box collapses onto the flat faces, the outer rows bend round.
function roundedBox(w, h, d, r, seg = 2) {
  const s = seg * 2 + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, s, s, s);
  const half = 0.5 / s;
  const bx = w / 2 - r;
  const by = h / 2 - r;
  const bz = d / 2 - r;
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.set(v.x - Math.sign(v.x) * half, v.y - Math.sign(v.y) * half, v.z - Math.sign(v.z) * half).normalize();
    pos.setXYZ(i, bx * Math.sign(v.x) + n.x * r, by * Math.sign(v.y) + n.y * r, bz * Math.sign(v.z) + n.z * r);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

// Collects pieces per material for one joint, then merges them into one mesh
// per material. pieces: add(material, geometry, x, y, z, rx, ry, rz, sx, sy, sz).
function builder() {
  const byMat = new Map();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    add(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      m4.compose(p.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(sx, sy, sz));
      geo.applyMatrix4(m4);
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push(geo);
      return geo;
    },
    bake(parent, castShadow) {
      byMat.forEach((geos, mat) => {
        // Polyhedra are not indexed; merging needs all or none.
        if (geos.some((g) => !g.index)) geos = geos.map((g) => (g.index ? g.toNonIndexed() : g));
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        if (geos.length > 1) geos.forEach((g) => g.dispose());
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = !!castShadow;
        parent.add(mesh);
      });
      byMat.clear();
    },
  };
}

// Gives every vertex of a geometry the same UV (a plain-colour spot of a texture).
function flatUV(geo, u, v) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
  return geo;
}

// ---------- Shared textures ----------
let fabricTex = null;
// Fine weave and quilting seams for the suit fabric (bump map, shared).
function fabric() {
  if (fabricTex) return fabricTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 128, 128);
  // Weave: a faint cross-hatch with noise.
  for (let y = 0; y < 128; y += 2) {
    for (let x = 0; x < 128; x += 2) {
      const n = 118 + ((x * 7 + y * 13) % 5) * 4 + Math.random() * 12;
      g.fillStyle = `rgb(${n},${n},${n})`;
      g.fillRect(x, y, ((x + y) / 2) % 2 ? 2 : 1, 1);
    }
  }
  // Quilted seams.
  g.strokeStyle = 'rgba(40,40,40,0.75)';
  g.lineWidth = 2;
  for (const y of [32, 96]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(220,220,220,0.5)';
  g.lineWidth = 1;
  for (const y of [34, 98]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y);
    g.stroke();
  }
  fabricTex = new THREE.CanvasTexture(c);
  fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping;
  fabricTex.repeat.set(3, 3);
  fabricTex.userData.keep = true;
  return fabricTex;
}

let blobTex = null;
function blob() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  blobTex.userData.keep = true;
  return blobTex;
}

// ---------- Face ----------
// The head is a sphere whose equirectangular map puts +Z (the face) at u = 0.25.
const FACE_W = 512;
const FACE_H = 256;
function drawFace(ctx, col, expr, blink) {
  const W = FACE_W;
  const H = FACE_H;
  ctx.fillStyle = col.skin;
  ctx.fillRect(0, 0, W, H);
  const cx = W * 0.25;
  const ink = '#2a201c';
  const skin = new THREE.Color(col.skin);
  const hsl = {};
  skin.getHSL(hsl);
  // Cheeks: warmer and a little darker than the skin.
  const cheek = new THREE.Color().setHSL(0.02, Math.min(0.75, hsl.s + 0.25), Math.max(0.25, hsl.l - 0.08));
  ctx.fillStyle = `rgba(${Math.round(cheek.r * 255)},${Math.round(cheek.g * 255)},${Math.round(cheek.b * 255)},0.42)`;
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(cx + s * 40, 146, 14, 9, 0, 0, TAU);
    ctx.fill();
  });
  // Nose: a soft shadow.
  const shade = new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0.12, hsl.l - 0.14));
  ctx.strokeStyle = `rgba(${Math.round(shade.r * 255)},${Math.round(shade.g * 255)},${Math.round(shade.b * 255)},0.85)`;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, 132, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Eyes.
  const eyeY = 114;
  [-1, 1].forEach((s) => {
    const x = cx + s * 27;
    if (blink || expr === 'joy') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      if (expr === 'joy') ctx.arc(x, eyeY + 4, 8, 1.15 * Math.PI, 1.85 * Math.PI);
      else ctx.arc(x, eyeY - 4, 8, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(x, eyeY, 7.5, expr === 'wow' ? 11 : 10, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 2.6, eyeY - 4, 2.8, 0, TAU);
    ctx.fill();
  });
  // Brows in the hair colour (darkened a little on light hair so they read).
  const brow = new THREE.Color(col.hair);
  const bh = {};
  brow.getHSL(bh);
  brow.setHSL(bh.h, bh.s, Math.min(bh.l, 0.42));
  ctx.strokeStyle = `#${brow.getHexString()}`;
  ctx.lineWidth = 4;
  [-1, 1].forEach((s) => {
    const x = cx + s * 27;
    ctx.beginPath();
    if (expr === 'sad') {
      ctx.moveTo(x - s * 10, 94);
      ctx.lineTo(x + s * 9, 100);
    } else {
      const lift = expr === 'joy' || expr === 'wow' ? -5 : 0;
      ctx.moveTo(x - 10, 98 + lift);
      ctx.quadraticCurveTo(x, 92 + lift, x + 10, 98 + lift);
    }
    ctx.stroke();
  });
  // Mouth.
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  const my = 156;
  if (expr === 'joy' || expr === 'happy') {
    const w = expr === 'joy' ? 17 : 13;
    ctx.fillStyle = '#5b1f1d';
    ctx.beginPath();
    ctx.moveTo(cx - w, my - 4);
    ctx.quadraticCurveTo(cx, my - 1, cx + w, my - 4);
    ctx.quadraticCurveTo(cx + w * 0.8, my + w * 0.95, cx, my + w * 0.95);
    ctx.quadraticCurveTo(cx - w * 0.8, my + w * 0.95, cx - w, my - 4);
    ctx.fill();
    ctx.fillStyle = '#e57b6e';
    ctx.beginPath();
    ctx.ellipse(cx, my + w * 0.68, w * 0.5, w * 0.25, 0, 0, TAU);
    ctx.fill();
  } else if (expr === 'sad') {
    ctx.beginPath();
    ctx.arc(cx, my + 12, 10, 1.2 * Math.PI, 1.8 * Math.PI);
    ctx.stroke();
  } else if (expr === 'wow') {
    ctx.fillStyle = '#5b1f1d';
    ctx.beginPath();
    ctx.ellipse(cx, my + 2, 6, 8, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx, my - 8, 12, 0.22 * Math.PI, 0.78 * Math.PI);
    ctx.stroke();
  }
}

// ---------- Patch and name tag art ----------
// The agency patch (as on the New agency screen): gold ring, a pyramid by
// the river under an orbit. Drawn in 2D so it is ready at once.
function drawAgencyPatch(ctx, S, field) {
  const c = S / 2;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#d9a21b';
  ctx.beginPath();
  ctx.arc(c, c, S * 0.49, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#7a5a0c';
  ctx.lineWidth = S * 0.012;
  ctx.setLineDash([S * 0.02, S * 0.015]);
  ctx.beginPath();
  ctx.arc(c, c, S * 0.455, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, S * 0.36, 0, TAU);
  ctx.clip();
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#e9c58c';
  ctx.fillRect(0, c + S * 0.09, S, S);
  ctx.fillStyle = '#3f7fa8';
  ctx.beginPath();
  ctx.moveTo(0, c + S * 0.15);
  ctx.quadraticCurveTo(c * 0.6, c + S * 0.1, c, c + S * 0.15);
  ctx.quadraticCurveTo(c * 1.4, c + S * 0.2, S, c + S * 0.15);
  ctx.lineTo(S, S);
  ctx.lineTo(0, S);
  ctx.fill();
  ctx.fillStyle = '#f4e4b5';
  ctx.beginPath();
  ctx.moveTo(c - S * 0.2, c + S * 0.11);
  ctx.lineTo(c, c - S * 0.19);
  ctx.lineTo(c + S * 0.2, c + S * 0.11);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.moveTo(c, c - S * 0.19);
  ctx.lineTo(c + S * 0.2, c + S * 0.11);
  ctx.lineTo(c + S * 0.07, c + S * 0.11);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#7a5a0c';
  ctx.lineWidth = S * 0.012;
  ctx.beginPath();
  ctx.arc(c, c, S * 0.36, 0, TAU);
  ctx.stroke();
  ctx.save();
  ctx.translate(c, c - S * 0.01);
  ctx.rotate(-0.28);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = S * 0.018;
  ctx.setLineDash([S * 0.035, S * 0.025]);
  ctx.beginPath();
  ctx.ellipse(0, 0, S * 0.4, S * 0.12, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
  ctx.setLineDash([]);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(c + S * 0.31, c - S * 0.12, S * 0.04, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#d9a21b';
  ctx.beginPath();
  ctx.arc(c + S * 0.31, c - S * 0.12, S * 0.018, 0, TAU);
  ctx.fill();
}

function fontReady() {
  try {
    return document.fonts && document.fonts.load ? document.fonts.load('800 40px Archivo').catch(() => null) : Promise.resolve();
  } catch (e) {
    return Promise.resolve();
  }
}

function drawNameTag(ctx, W, H, name, accent) {
  ctx.fillStyle = '#23282e';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, H * 0.28, H);
  ctx.fillStyle = '#f4f1e8';
  let size = H * 0.62;
  ctx.font = `800 ${size}px Archivo, 'Arial Narrow', sans-serif`;
  const text = String(name || '').toUpperCase();
  const room = W - H * 0.6;
  while (ctx.measureText(text).width > room && size > H * 0.3) {
    size -= 2;
    ctx.font = `800 ${size}px Archivo, 'Arial Narrow', sans-serif`;
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, H * 0.14 + W / 2, H * 0.54);
}

// The chest control box: a graphite panel with knobs and a tiny display.
function drawPanel(ctx, S, accent) {
  ctx.fillStyle = '#3a4047';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#2b3036';
  ctx.fillRect(S * 0.06, S * 0.08, S * 0.88, S * 0.84);
  ctx.fillStyle = '#9fe0d0';
  ctx.fillRect(S * 0.12, S * 0.18, S * 0.34, S * 0.3);
  ctx.fillStyle = '#5fb8a6';
  ctx.fillRect(S * 0.14, S * 0.28, S * 0.2, S * 0.04);
  ctx.fillRect(S * 0.14, S * 0.36, S * 0.14, S * 0.04);
  const knob = (x, y, r, c) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU);
    ctx.fill();
  };
  knob(S * 0.62, S * 0.32, S * 0.1, accent);
  knob(S * 0.83, S * 0.32, S * 0.07, '#d9a21b');
  knob(S * 0.22, S * 0.72, S * 0.07, '#b4302c');
  knob(S * 0.42, S * 0.72, S * 0.07, '#e9eef2');
  knob(S * 0.62, S * 0.72, S * 0.07, '#e9eef2');
  knob(S * 0.82, S * 0.72, S * 0.07, '#17807a');
}

function canvasTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, ctx: c.getContext('2d'), tex };
}

// ---------- The character ----------
// Joint layout (metres): hips 0.90, knees 0.50, ankles 0.12, shoulders 1.38,
// head centre 1.60 (head radius 0.13; the top of the hair is at 1.75).
const HIP_Y = 0.9;
const SH = { x: 0.238, y: 0.475 }; // shoulder, from the hips
const NECK_Y = 0.53;
const HEAD_C = 0.14; // head centre above the neck pivot
const HEAD_R = 0.142;
const HELMET_R = 0.217;

// opts: { env (THREE.Texture | null: skip reflections; default studioEnv()),
//         shadows (cast shadows, default true), blob (contact shadow, default true),
//         design (design for the 'mission' shoulder patch), helmet (true/false: override) }
function createProcedural(appearance, opts = {}) {
  let ap = norm(appearance);
  let col = colorsOf(ap);
  const castShadow = opts.shadows !== false;
  const disposables = [];
  const own = (x) => (disposables.push(x), x);

  // Materials (one set per astronaut, so colours can change live).
  const fab = fabric();
  const M = {
    suit: own(new THREE.MeshStandardMaterial({ color: col.body, roughness: 0.86, metalness: 0, bumpMap: fab, bumpScale: 0.6 })),
    shell: own(new THREE.MeshStandardMaterial({ color: 0xf3f4f1, roughness: 0.32, metalness: 0.05 })),
    accent: own(new THREE.MeshStandardMaterial({ color: col.accent, roughness: 0.6, metalness: 0.02 })),
    trim: own(new THREE.MeshStandardMaterial({ color: col.trim, roughness: 0.72, metalness: 0.05 })),
    metal: own(new THREE.MeshStandardMaterial({ color: 0xc4cad0, roughness: 0.28, metalness: 0.9 })),
    sole: own(new THREE.MeshStandardMaterial({ color: 0x2d3136, roughness: 0.9 })),
    skin: own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 })),
    hair: own(new THREE.MeshStandardMaterial({ color: col.hair, roughness: 0.66, metalness: 0.02 })),
    scarf: own(new THREE.MeshStandardMaterial({ color: col.patch, roughness: 0.9, bumpMap: fab, bumpScale: 0.3 })),
    cap: own(new THREE.MeshStandardMaterial({ color: 0x4a3f38, roughness: 0.85 })),
    visorClear: own(new THREE.MeshStandardMaterial({ color: 0xb8d2e2, roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.6 })),
    visorGold: own(new THREE.MeshStandardMaterial({ color: 0xf0bb45, roughness: 0.2, metalness: 0.85, emissive: 0x4a3300, emissiveIntensity: 0.6, envMapIntensity: 1.6 })),
    light: own(new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff1c8, emissiveIntensity: 0.9, roughness: 0.4 })),
  };
  M.liner = own(new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.95, side: THREE.BackSide }));

  // Canvas textures: face, patch, name tag, chest panel.
  const face = canvasTexture(FACE_W, FACE_H);
  own(face.tex);
  M.skin.map = face.tex;
  const patch = canvasTexture(256, 256);
  own(patch.tex);
  const tag = canvasTexture(256, 64);
  own(tag.tex);
  const panel = canvasTexture(128, 128);
  own(panel.tex);
  M.patch = own(new THREE.MeshStandardMaterial({ map: patch.tex, roughness: 0.92, transparent: true, alphaTest: 0.4 }));
  M.tag = own(new THREE.MeshStandardMaterial({ map: tag.tex, roughness: 0.8 }));
  M.panel = own(new THREE.MeshStandardMaterial({ map: panel.tex, roughness: 0.55, metalness: 0.1 }));

  // ---------- Skeleton ----------
  const group = new THREE.Group();
  group.name = 'astronaut';
  const hips = new THREE.Group();
  hips.position.y = HIP_Y;
  group.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  const neck = new THREE.Group();
  neck.position.y = NECK_Y;
  torso.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.02;
  neck.add(head);

  const mk = (parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const shL = mk(torso, SH.x, SH.y, -0.01);
  const shR = mk(torso, -SH.x, SH.y, -0.01);
  const elL = mk(shL, 0, -0.27, 0);
  const elR = mk(shR, 0, -0.27, 0);
  const hipL = mk(hips, 0.102, -0.02, 0);
  const hipR = mk(hips, -0.102, -0.02, 0);
  const knL = mk(hipL, 0, -0.38, 0);
  const knR = mk(hipR, 0, -0.38, 0);
  const ftL = mk(knL, 0, -0.38, 0);
  const ftR = mk(knR, 0, -0.38, 0);

  // ---------- Torso ----------
  {
    const b = builder();
    // Puffy suit body: wide chest, slightly narrower waist, oval cross-section.
    const prof = [
      [0.0, -0.1],
      [0.12, -0.09],
      [0.165, -0.04],
      [0.17, 0.06],
      [0.168, 0.16],
      [0.19, 0.28],
      [0.2, 0.38],
      [0.19, 0.46],
      [0.15, 0.51],
      [0.1, 0.535],
      [0.0, 0.545],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    b.add(M.suit, new THREE.LatheGeometry(prof, 12), 0, 0, 0, 0, 0, 0, 1.12, 1, 0.84);
    // Waist seal: a metal ring with an accent band above it.
    b.add(M.metal, new THREE.CylinderGeometry(0.178, 0.178, 0.035, 16, 1, true), 0, 0.1, 0, 0, 0, 0, 1.12, 1, 0.86);
    b.add(M.accent, new THREE.CylinderGeometry(0.174, 0.172, 0.045, 16, 1, true), 0, 0.135, 0, 0, 0, 0, 1.12, 1, 0.86);
    // Neck ring: helmet mount.
    b.add(M.metal, new THREE.TorusGeometry(0.118, 0.022, 4, 12), 0, NECK_Y - 0.005, 0, Math.PI / 2, 0, 0);
    b.add(M.accent, new THREE.CylinderGeometry(0.128, 0.142, 0.03, 14, 1, true), 0, NECK_Y - 0.03, 0);
    // Backpack (life support) with an accent band and a darker top.
    b.add(M.shell, roundedBox(0.36, 0.46, 0.17, 0.045, 1), 0, 0.3, -0.235);
    b.add(M.accent, new THREE.BoxGeometry(0.364, 0.06, 0.174), 0, 0.42, -0.235);
    b.add(M.trim, new THREE.BoxGeometry(0.24, 0.04, 0.09), 0, 0.535, -0.24);
    // Shoulder straps.
    [-1, 1].forEach((s) => b.add(M.trim, new THREE.BoxGeometry(0.045, 0.2, 0.03), s * 0.12, 0.42, 0.14, -0.32, 0, 0));
    // Hose from the backpack round to the chest box.
    const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.17, 0.2, -0.16), new THREE.Vector3(-0.21, 0.14, 0.0), new THREE.Vector3(-0.13, 0.17, 0.16), new THREE.Vector3(-0.06, 0.24, 0.2)]);
    b.add(M.trim, new THREE.TubeGeometry(hose, 6, 0.018, 4, false));
    b.bake(torso, castShadow);
    // Chest box: panel art on the front face only.
    const box = roundedBox(0.19, 0.11, 0.07, 0.018, 1);
    const chest = new THREE.Mesh(box, [M.trim, M.trim, M.trim, M.trim, M.panel, M.trim]);
    chest.position.set(0, 0.25, 0.168);
    chest.rotation.x = -0.12;
    chest.castShadow = castShadow;
    torso.add(chest);
    // Name tag across the chest, between the straps.
    const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.0375), M.tag);
    tagMesh.position.set(0, 0.37, 0.171);
    torso.add(tagMesh);
  }

  // ---------- Arms ----------
  // Limbs are lathes with a puffy profile (points listed bottom to top).
  const lathe = (pts, n) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);
  function arm(sh, el, side) {
    const b = builder();
    b.add(M.suit, lathe([[0, -0.29], [0.064, -0.272], [0.073, -0.2], [0.078, -0.1], [0.092, -0.02], [0.082, 0.05], [0, 0.088]], 8));
    b.add(M.accent, new THREE.CylinderGeometry(0.077, 0.075, 0.03, 9, 1, true), 0, -0.225, 0);
    b.bake(sh, castShadow);
    const f = builder();
    f.add(M.suit, lathe([[0, -0.245], [0.055, -0.238], [0.071, -0.21], [0.065, -0.15], [0.07, -0.05], [0.062, 0.02], [0, 0.035]], 8));
    f.add(M.accent, new THREE.CylinderGeometry(0.074, 0.074, 0.035, 9, 1, true), 0, -0.21, 0);
    // Glove: one rounded block for palm and fingers, curled a little, and a thumb.
    f.add(M.trim, roundedBox(0.084, 0.122, 0.058, 0.027, 1), 0, -0.3, 0.008, 0.12, 0, 0);
    f.add(M.trim, new THREE.CapsuleGeometry(0.017, 0.035, 1, 4), side * -0.012, -0.28, 0.04, 0.7, 0, side * 0.45);
    f.bake(el, castShadow);
  }
  arm(shL, elL, 1);
  arm(shR, elR, -1);
  // Shoulder patch on the left upper arm, facing out.
  const patchMesh = new THREE.Mesh(new THREE.CircleGeometry(0.048, 20), M.patch);
  patchMesh.position.set(0.0705, -0.13, 0);
  patchMesh.rotation.y = Math.PI / 2;
  shL.add(patchMesh);

  // ---------- Legs ----------
  function leg(hip, kn, ft, side) {
    const b = builder();
    b.add(M.suit, lathe([[0, -0.42], [0.07, -0.405], [0.086, -0.33], [0.096, -0.18], [0.1, -0.04], [0.08, 0.03], [0, 0.05]], 9));
    b.add(M.accent, new THREE.CylinderGeometry(0.102, 0.1, 0.035, 9, 1, true), 0, -0.11, 0);
    b.bake(hip, castShadow);
    const k = builder();
    k.add(M.suit, lathe([[0, -0.38], [0.074, -0.365], [0.076, -0.32], [0.081, -0.2], [0.088, -0.06], [0.078, 0.02], [0, 0.045]], 9));
    k.add(M.accent, new THREE.BoxGeometry(0.1, 0.085, 0.036), 0, -0.02, 0.076);
    k.bake(kn, castShadow);
    // Boot: rounded upper, dark sole, accent strap.
    const f = builder();
    f.add(M.shell, roundedBox(0.15, 0.135, 0.265, 0.055, 1), side * 0.006, -0.045, 0.04);
    f.add(M.sole, new THREE.BoxGeometry(0.152, 0.034, 0.272), side * 0.006, -0.103, 0.042);
    f.add(M.accent, new THREE.CylinderGeometry(0.087, 0.087, 0.03, 9, 1, true), 0, 0.014, 0.0);
    f.bake(ft, castShadow);
  }
  leg(hipL, knL, ftL, 1);
  leg(hipR, knR, ftR, -1);

  // ---------- Head ----------
  const headGeo = new THREE.SphereGeometry(HEAD_R, 18, 12);
  headGeo.scale(1, 1.04, 1);
  const headMesh = new THREE.Mesh(headGeo, M.skin);
  headMesh.position.y = HEAD_C;
  headMesh.castShadow = castShadow;
  head.add(headMesh);
  // Neck (skin coloured: all its UVs point at plain skin in the face map).
  const neckMesh = new THREE.Mesh(flatUV(new THREE.CylinderGeometry(0.052, 0.058, 0.12, 9, 1, true), 0.75, 0.2), M.skin);
  neckMesh.position.y = 0.04;
  head.add(neckMesh);
  // Ears: little bumps on the sides.
  const ears = new THREE.Mesh(
    flatUV(
      mergeGeometries([new THREE.SphereGeometry(0.028, 6, 5).scale(0.42, 1, 0.75).translate(HEAD_R * 0.97, HEAD_C - 0.012, -0.004), new THREE.SphereGeometry(0.028, 6, 5).scale(0.42, 1, 0.75).translate(-HEAD_R * 0.97, HEAD_C - 0.012, -0.004)]),
      0.75,
      0.5
    ),
    M.skin
  );
  head.add(ears);

  const hairSlot = new THREE.Group();
  hairSlot.position.y = HEAD_C;
  head.add(hairSlot);

  // Helmet: a hard shell with a front window, the visor over the window,
  // side lights, and the comms cap underneath.
  const helmet = new THREE.Group();
  helmet.position.set(0, HEAD_C + 0.012, 0.004);
  head.add(helmet);
  let visorMesh = null;
  {
    const R = HELMET_R;
    const w = 1.08; // half-width of the window (radians around +Z)
    const t1 = 0.29 * Math.PI; // window top
    const t2 = 0.66 * Math.PI; // window bottom
    const tb = 0.8 * Math.PI; // open at the neck
    const f = Math.PI / 2 - w;
    const b = builder();
    b.add(M.shell, new THREE.SphereGeometry(R, 14, 8, Math.PI / 2 + w, TAU - 2 * w, 0, tb));
    b.add(M.shell, new THREE.SphereGeometry(R, 6, 3, f, 2 * w, 0, t1));
    b.add(M.shell, new THREE.SphereGeometry(R, 6, 2, f, 2 * w, t2, tb - t2));
    // Side pods with forward-facing lamps.
    [-1, 1].forEach((s) => {
      b.add(M.accent, new THREE.CylinderGeometry(0.034, 0.034, 0.05, 8), s * (R + 0.01), 0.0, -0.01, 0, 0, Math.PI / 2);
      b.add(M.trim, new THREE.BoxGeometry(0.026, 0.024, 0.05), s * (R - 0.004), 0.048, 0.02);
    });
    // Padded lining: only its inside faces draw, so it shows through the window.
    b.add(M.liner, new THREE.SphereGeometry(R * 0.975, 8, 5, 0, TAU, 0, tb));
    b.bake(helmet, castShadow);
    const lights = builder();
    [-1, 1].forEach((s) => lights.add(M.light, new THREE.CircleGeometry(0.01, 8), s * (R - 0.004), 0.048, 0.0455));
    lights.bake(helmet, false);
    visorMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 10, 5, f - 0.04, 2 * w + 0.08, t1 - 0.04, t2 - t1 + 0.08), M.visorClear);
    visorMesh.renderOrder = 3;
    helmet.add(visorMesh);
  }

  // ---------- Hair ----------
  function buildHair() {
    hairSlot.children.slice().forEach((c) => {
      hairSlot.remove(c);
      c.geometry.dispose();
    });
    const b = builder();
    const r = HEAD_R;
    const helmetOn = isHelmetOn();
    // Under the helmet everyone wears the comms cap (scarf colour when covered);
    // 'helmet' with the helmet taken off (setHelmet(false)) shows the cap too.
    if (helmetOn || ap.hair === 'helmet') {
      const cm = ap.hair === 'covered' ? M.scarf : M.cap;
      b.add(cm, new THREE.SphereGeometry(r * 1.06, 12, 6, 0, TAU, 0, Math.PI * 0.62), 0, 0.004, -0.004, -0.42, 0, 0, 1, 1.04, 1.02);
      // Ear cups.
      [-1, 1].forEach((s) => b.add(cm, new THREE.SphereGeometry(0.035, 6, 4), s * r * 1.0, -0.01, -0.01, 0, 0, 0, 0.6, 1, 1));
      b.bake(hairSlot, castShadow);
      return;
    }
    if (ap.hair === 'short' || ap.hair === 'curly' || ap.hair === 'bun') {
      // Cap of hair, tilted back so the forehead shows.
      b.add(M.hair, new THREE.SphereGeometry(r * 1.065, 14, 6, 0, TAU, 0, Math.PI * 0.52), 0, 0.008, -0.008, -0.55, 0, 0, 1.0, 1.06, 1.04);
      if (ap.hair === 'short') {
        // Tufts along the hairline and a little volume on top, so it reads as hair, not a cap.
        [[-0.06, 0.098, 0.072, 0.5], [-0.012, 0.112, 0.08, 0.2], [0.04, 0.108, 0.074, -0.15], [0.078, 0.084, 0.058, -0.5]].forEach(([x, y, z, rz]) => b.add(M.hair, new THREE.SphereGeometry(0.036, 7, 4), x, y, z, 0.5, 0, rz, 1.35, 0.62, 1.1));
        b.add(M.hair, new THREE.SphereGeometry(r * 0.8, 10, 5, 0, TAU, 0, Math.PI * 0.5), 0, 0.06, -0.01, -0.2, 0, 0, 1.08, 0.9, 1.1);
      }
      // Bun: a side-swept fringe.
      if (ap.hair === 'bun') b.add(M.hair, new THREE.SphereGeometry(r * 0.62, 8, 4, 0, TAU, 0, Math.PI * 0.5), 0.03, 0.082, 0.062, 0.9, 0.3, -0.35, 1.25, 0.55, 0.9);
    }
    if (ap.hair === 'curly') {
      // Curls: a ring of small blobs over the cap.
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const up = i % 2 ? 0.5 : 0.85;
        const rr = r * 1.04;
        const x = Math.sin(a) * rr * Math.sin(up + 0.25);
        const z = Math.cos(a) * rr * Math.sin(up + 0.25) - 0.012;
        const y = rr * Math.cos(up + 0.25) * 0.98 + 0.012;
        if (z > 0.07 && y < 0.07) continue; // keep the face clear
        b.add(M.hair, new THREE.SphereGeometry(0.046, 6, 4), x, y, z, a, a * 2, 0);
      }
      b.add(M.hair, new THREE.SphereGeometry(0.055, 8, 5), 0, r * 1.02, -0.01);
    }
    if (ap.hair === 'bun') {
      b.add(M.hair, new THREE.SphereGeometry(0.058, 10, 6), 0, r * 0.98, -0.07);
      b.add(M.accent, new THREE.TorusGeometry(0.03, 0.009, 5, 12), 0, r * 0.87, -0.055, -0.85, 0, 0);
    }
    if (ap.hair === 'covered') {
      // Headscarf: wraps the head and neck and leaves the face open.
      const R = r * 1.1;
      const w = 0.95;
      const tTop = 0.24 * Math.PI;
      b.add(M.scarf, new THREE.SphereGeometry(R, 12, 3, 0, TAU, 0, tTop), 0, 0.006, -0.006);
      b.add(M.scarf, new THREE.SphereGeometry(R, 12, 7, Math.PI / 2 + w, TAU - 2 * w, tTop, Math.PI - tTop - 0.05), 0, 0.006, -0.006);
      // Round the neck, ending inside the suit's neck ring.
      const drape = [
        [0.112, 0.0],
        [0.122, -0.06],
        [0.124, -0.11],
        [0.118, -0.16],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      b.add(M.scarf, new THREE.LatheGeometry(drape.reverse(), 12), 0, -0.03, -0.005, 0, 0, 0, 1.05, 1, 0.95);
      b.add(M.scarf, new THREE.SphereGeometry(R, 8, 2, Math.PI / 2 - w - 0.02, 2 * w + 0.04, 0.73 * Math.PI, 0.2 * Math.PI), 0, 0.006, -0.006);
    }
    b.bake(hairSlot, castShadow);
  }

  // ---------- Blob shadow ----------
  let shadowBlob = null;
  if (opts.blob !== false) {
    const sm = own(new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false, opacity: 0.85 }));
    shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), sm);
    shadowBlob.rotation.x = -Math.PI / 2;
    shadowBlob.position.y = 0.004;
    shadowBlob.renderOrder = 1;
    group.add(shadowBlob);
  }

  // ---------- Appearance ----------
  let helmetOverride = typeof opts.helmet === 'boolean' ? opts.helmet : null;
  function isHelmetOn() {
    return helmetOverride !== null ? helmetOverride : ap.hair === 'helmet';
  }
  let faceState = '';
  let expr = 'smile';
  let exprOverride = null;
  let blinking = false;
  function paintFace(force) {
    const key = `${expr}|${blinking ? 1 : 0}|${col.skin}|${col.hair}`;
    if (!force && key === faceState) return;
    faceState = key;
    drawFace(face.ctx, col, expr, blinking);
    face.tex.needsUpdate = true;
  }
  function paintTag() {
    drawNameTag(tag.ctx, 256, 64, ap.name, col.accent);
    tag.tex.needsUpdate = true;
  }
  let patchToken = 0;
  function paintPatch() {
    const token = ++patchToken;
    drawAgencyPatch(patch.ctx, 256, ap.patchColor);
    patch.tex.needsUpdate = true;
    const design = ap.patch === 'mission' ? opts.design || (SMD.avatar && SMD.avatar.patchDesign && SMD.avatar.patchDesign()) : null;
    if (!design || !SMD.patch || !SMD.patch.patchSVG) return Promise.resolve();
    return new Promise((resolve) => {
      let svg;
      try {
        svg = SMD.patch.patchSVG(design, {}).replace('<svg ', '<svg width="256" height="256" ');
      } catch (e) {
        return resolve();
      }
      const img = new Image();
      img.onload = () => {
        if (token === patchToken && !disposed) {
          patch.ctx.clearRect(0, 0, 256, 256);
          patch.ctx.drawImage(img, 0, 0, 256, 256);
          patch.tex.needsUpdate = true;
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  function applyAppearance() {
    col = colorsOf(ap);
    M.suit.color.set(col.body);
    M.accent.color.set(col.accent);
    M.trim.color.set(col.trim);
    M.hair.color.set(col.hair);
    M.scarf.color.set(col.patch);
    // Shell: white, except a touch of the suit colour on the dark suits.
    const body = new THREE.Color(col.body);
    M.shell.color.set(0xf3f4f1).lerp(body, 0.12);
    const helmetOn = isHelmetOn();
    helmet.visible = helmetOn;
    visorMesh.material = ap.visor === 'gold' ? M.visorGold : M.visorClear;
    drawPanel(panel.ctx, 128, col.accent);
    panel.tex.needsUpdate = true;
    paintFace(true);
    paintTag();
    buildHair();
    return paintPatch();
  }

  // Reflections: the shared studio environment, unless the caller gave one.
  const reflect = [M.visorClear, M.visorGold, M.metal, M.shell];
  const useEnv = (env) => {
    if (!env || disposed) return;
    reflect.forEach((m) => {
      m.envMap = env;
      m.needsUpdate = true;
    });
    M.shell.envMapIntensity = 0.55;
    M.metal.envMapIntensity = 1.1;
  };
  let disposed = false;
  if (opts.env !== undefined) useEnv(opts.env);
  else studioEnv().then(useEnv, () => {});

  let ready = Promise.all([applyAppearance(), fontReady().then(() => !disposed && paintTag())]);

  // ---------- Animation ----------
  // A pose is a set of joint angles; actions override some of them and are
  // blended in and out.
  const REST = { lean: 0, bodyY: 0, torsoX: 0, torsoY: 0, torsoZ: 0, headX: 0, headY: 0, headZ: 0, shLx: 0.04, shLz: 0.13, shRx: 0.04, shRz: -0.13, elLx: -0.22, elRx: -0.22, elLz: 0, elRz: 0, hipLx: 0, hipRx: 0, hipLz: 0.02, hipRz: -0.02, knL: 0.04, knR: 0.04, ftL: -0.04, ftR: -0.04 };
  const pose = Object.assign({}, REST);
  const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Ground speed in m/s (setSpeed; setMove(v) is v * 1.6 m/s). The cycle's
  // cadence follows the real speed, so the feet do not slide.
  let speedTarget = 0;
  let speed = 0;
  let speedPrev = 0;
  let accelS = 0; // smoothed acceleration (start / stop lean)
  let leanTarget = 0;
  let leanNow = 0;
  let floatTarget = 0;
  let floatK = 0;
  let swim = 0;
  let carry = null; // { spread, w, want }
  let phase = 0;
  let stepIdx = 0;
  let onStep = opts.onStep || null;
  let time = Math.random() * 10;
  let blinkIn = 1.5 + Math.random() * 3;
  let action = null; // { name, t, dur, hold, fn, expr }
  let lookTarget = null;
  const look = { yaw: 0, pitch: 0 };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const headWorld = new THREE.Vector3();
  const baseScratch = {};

  const smooth = (x) => x * x * (3 - 2 * x);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;

  const ACTIONS = {
    // Right hand up and waving, head tilted, smiling.
    wave: {
      dur: 2.3,
      expr: 'happy',
      fn(u, t) {
        return { shRz: -2.55, shRx: -0.25, elRz: -0.35 + Math.sin(t * 11) * 0.42, elRx: -0.15, headZ: 0.12, headY: -0.12, torsoZ: -0.04 };
      },
    },
    // A small hop on the spot or on the move (Space).
    hop: {
      dur: 0.62,
      fadeIn: 0.06,
      fn(u) {
        let crouch = 0;
        let lift = 0;
        if (u < 0.16) crouch = smooth(u / 0.16) * 0.8;
        else if (u < 0.24) crouch = 0.8 * (1 - smooth((u - 0.16) / 0.08));
        if (u >= 0.2 && u < 0.8) lift = Math.sin(((u - 0.2) / 0.6) * Math.PI);
        if (u >= 0.8) crouch = Math.sin(((u - 0.8) / 0.2) * Math.PI) * 0.5;
        return {
          bodyY: -0.1 * crouch + 0.26 * lift,
          hipLx: -0.45 * crouch - 0.45 * lift,
          hipRx: -0.45 * crouch - 0.3 * lift,
          knL: 0.9 * crouch + 0.85 * lift,
          knR: 0.9 * crouch + 0.6 * lift,
          ftL: -0.4 * crouch + 0.2 * lift,
          ftR: -0.4 * crouch + 0.2 * lift,
          torsoX: 0.16 * crouch - 0.04 * lift,
          shLx: -0.5 * lift + 0.3 * crouch,
          shRx: -0.5 * lift + 0.3 * crouch,
          shLz: 0.13 + 0.35 * lift,
          shRz: -0.13 - 0.35 * lift,
        };
      },
    },
    // Crouch, jump with both arms up, land.
    celebrate: {
      dur: 1.7,
      expr: 'joy',
      fn(u) {
        const out = {};
        let crouch = 0;
        let lift = 0;
        let arms = 0;
        if (u < 0.22) crouch = smooth(u / 0.22);
        else if (u < 0.3) crouch = 1 - smooth((u - 0.22) / 0.08);
        if (u >= 0.24 && u < 0.72) {
          const k = (u - 0.24) / 0.48;
          lift = Math.sin(k * Math.PI);
        }
        if (u >= 0.72 && u < 0.86) crouch = Math.sin(((u - 0.72) / 0.14) * Math.PI) * 0.55;
        arms = u < 0.2 ? -0.4 * smooth(u / 0.2) : u < 0.32 ? lerp(-0.4, 1, smooth((u - 0.2) / 0.12)) : u < 0.8 ? 1 : 1 - smooth((u - 0.8) / 0.2) * 0.2;
        out.bodyY = -0.13 * crouch + 0.34 * lift;
        out.hipLx = out.hipRx = -0.55 * crouch - 0.25 * lift;
        out.knL = out.knR = 1.05 * crouch + 0.45 * lift;
        out.ftL = out.ftR = -0.5 * crouch + 0.25 * lift;
        out.torsoX = 0.22 * crouch - 0.06 * lift;
        const up = Math.max(0, arms);
        out.shLz = lerp(0.2, 2.75, up);
        out.shRz = -out.shLz;
        out.shLx = out.shRx = arms < 0 ? -arms * 0.9 : -0.15 * up;
        out.elLx = out.elRx = lerp(-0.3, -0.1, up);
        out.elLz = 0.25 * up;
        out.elRz = -0.25 * up;
        out.headX = -0.25 * up;
        return out;
      },
    },
    // Head down, shoulders slumped, arms hanging forward.
    sad: {
      dur: 3.4,
      fadeIn: 0.7,
      expr: 'sad',
      fn(u, t) {
        return { headX: 0.5 + Math.sin(t * 0.8) * 0.03, headY: 0.08, torsoX: 0.2, bodyY: -0.025, shLx: -0.12, shRx: -0.12, shLz: 0.06, shRz: -0.06, elLx: -0.18, elRx: -0.18, knL: 0.12, knR: 0.12, hipLx: -0.07, hipRx: -0.07, ftL: -0.05, ftR: -0.05 };
      },
    },
    // A proud thumbs-up-ish fist pump (for small wins).
    cheer: {
      dur: 1.3,
      expr: 'happy',
      fn(u, t) {
        const pump = Math.abs(Math.sin(u * Math.PI * 3)) * 0.4;
        return { shRz: -0.5, shRx: -1.2 - pump, elRx: -1.5, elRz: 0, headX: -0.1, torsoY: -0.12 };
      },
    },
  };

  function play(name, o = {}) {
    // Carrying is a layer under the actions: a cheer or a wave plays over it
    // and the arms go back round the part afterwards.
    if (name === 'carry') {
      const spread = o.spread != null ? o.spread : 0.25;
      carry = carry ? Object.assign(carry, { spread, want: 1 }) : { spread, w: 0, want: 1 };
      return;
    }
    const a = ACTIONS[name];
    if (!a) return;
    action = { name, t: 0, dur: o.duration || a.dur, hold: !!o.hold, fn: a.fn, expr: a.expr, fadeIn: a.fadeIn || 0.22, fadeOut: 0.35, done: o.onDone || null };
  }

  function applyPose() {
    hips.position.y = HIP_Y + pose.bodyY;
    hips.rotation.z = pose.lean * 0.45;
    torso.rotation.set(pose.torsoX, pose.torsoY, pose.torsoZ + pose.lean * 0.55);
    neck.rotation.set(pose.headX * 0.35, pose.headY * 0.3, pose.headZ * 0.3);
    head.rotation.set(pose.headX * 0.65, pose.headY * 0.7, pose.headZ * 0.7);
    shL.rotation.set(pose.shLx, 0, pose.shLz);
    shR.rotation.set(pose.shRx, 0, pose.shRz);
    elL.rotation.set(pose.elLx, 0, pose.elLz);
    elR.rotation.set(pose.elRx, 0, pose.elRz);
    hipL.rotation.set(pose.hipLx, 0, pose.hipLz);
    hipR.rotation.set(pose.hipRx, 0, pose.hipRz);
    knL.rotation.x = pose.knL;
    knR.rotation.x = pose.knR;
    ftL.rotation.x = pose.ftL;
    ftR.rotation.x = pose.ftR;
    if (shadowBlob) {
      const k = clamp(1 - pose.bodyY * 1.6, 0.55, 1.15);
      shadowBlob.scale.set(k, k, k);
      shadowBlob.material.opacity = 0.85 * clamp(1 - pose.bodyY * 1.8, 0.35, 1) * (1 - floatK);
    }
  }

  function update(dt) {
    if (disposed) return;
    dt = Math.min(dt || 0, 0.1);
    time += dt;
    speed += (speedTarget - speed) * Math.min(1, dt * 10);
    if (speed < 0.003 && speedTarget === 0) speed = 0;
    // Start / stop: lean into the push off, settle back when stopping.
    const acc = dt > 0 ? (speed - speedPrev) / dt : 0;
    speedPrev = speed;
    accelS += (acc - accelS) * Math.min(1, dt * 8);
    leanNow += (leanTarget - leanNow) * Math.min(1, dt * 8);
    floatK += (floatTarget - floatK) * Math.min(1, dt * 2.5);
    if (carry) {
      carry.w += (carry.want - carry.w) * Math.min(1, dt * 6);
      if (!carry.want && carry.w < 0.01) carry = null;
    }

    // Base: idle breathing blended with the walk and run cycles.
    const sN = speed / 1.6; // 1 = the old brisk walk
    const ground = 1 - floatK;
    const A = smooth(clamp(sN * 1.4, 0, 1)) * ground;
    const runK = smooth(clamp((speed - 2.3) / 1.6, 0, 1)) * ground;
    // Cadence (cycles per second): a walking stride grows with speed, a run
    // takes long bounding strides at about 2.9 steps a second.
    const walkCad = speed > 0 ? speed / (1.0 + 0.27 * speed) : 0;
    const runCad = speed / (1.25 + 0.45 * speed);
    const cad = lerp(walkCad, runCad, runK);
    if (speed > 0) phase += dt * cad;
    // A foot lands twice a cycle: tell whoever listens (footsteps).
    const si = Math.floor(phase * 2 + 0.25);
    if (si !== stepIdx) {
      stepIdx = si;
      if (onStep && speed > 0.35 && ground > 0.5) onStep({ run: runK > 0.5, speed });
    }
    const p = phase * TAU;
    const s = Math.sin(p);
    const c = Math.cos(p);
    const breathe = reduced ? 0 : Math.sin(time * 1.7);
    const base = Object.assign(baseScratch, REST);
    base.torsoX = 0.012 * breathe * (1 - A) + 0.09 * A;
    base.shLz = REST.shLz + 0.012 * breathe * (1 - A);
    base.shRz = REST.shRz - 0.012 * breathe * (1 - A);
    base.headX = -0.01 * breathe * (1 - A);
    // Idle weight shift and an occasional glance around.
    if (!reduced && !lookTarget) {
      base.headY = Math.sin(time * 0.37) * Math.sin(time * 0.13) * 0.35 * (1 - A);
      base.hipLz += Math.sin(time * 0.4) * 0.015 * (1 - A);
      base.hipRz += Math.sin(time * 0.4) * 0.015 * (1 - A);
    }
    if (A > 0) {
      const W = A * (1 - runK); // walk weight
      const Rn = A * runK; // run weight
      const amp = 0.52 * W + 0.82 * Rn;
      base.hipLx = -s * amp - 0.1 * Rn;
      base.hipRx = s * amp - 0.1 * Rn;
      base.knL = REST.knL + W * (0.95 * Math.pow(Math.max(0, c), 1.5) + 0.1 * Math.max(0, -s)) + Rn * (0.3 + 1.55 * Math.pow(Math.max(0, c), 1.2) + 0.25 * Math.max(0, -s));
      base.knR = REST.knR + W * (0.95 * Math.pow(Math.max(0, -c), 1.5) + 0.1 * Math.max(0, s)) + Rn * (0.3 + 1.55 * Math.pow(Math.max(0, -c), 1.2) + 0.25 * Math.max(0, s));
      base.ftL = -(base.hipLx + base.knL) * 0.7 + 0.1 * A * Math.max(0, -s);
      base.ftR = -(base.hipRx + base.knR) * 0.7 + 0.1 * A * Math.max(0, s);
      // Arms: a loose swing walking; bent at the elbow and pumping running.
      base.shLx = REST.shLx + s * (0.5 * W + 0.78 * Rn);
      base.shRx = REST.shRx - s * (0.5 * W + 0.78 * Rn);
      base.shLz = lerp(base.shLz, 0.2, Rn);
      base.shRz = lerp(base.shRz, -0.2, Rn);
      base.elLx = REST.elLx - W * (0.3 + 0.25 * Math.max(0, -s)) - Rn * (1.2 + 0.3 * Math.max(0, -s));
      base.elRx = REST.elRx - W * (0.3 + 0.25 * Math.max(0, s)) - Rn * (1.2 + 0.3 * Math.max(0, s));
      // Bob: highest at mid-stance walking, in the flight phase running.
      base.bodyY = W * (0.032 * Math.abs(c) - 0.026) + Rn * (0.055 * Math.abs(s) - 0.05);
      base.torsoX = 0.012 * breathe * (1 - A) + 0.09 * W + 0.24 * Rn;
      base.torsoY = s * (0.09 * W + 0.13 * Rn);
      base.torsoZ = c * 0.02 * A;
      base.headY = -base.torsoY * 0.8 + base.headY;
      base.headX -= 0.12 * Rn; // eyes up the road
    }
    // Start / stop lean and the lean into turns.
    if (ground > 0) {
      base.torsoX += clamp(accelS * 0.03, -0.1, 0.14) * ground;
      if (accelS < -2 && speed < 1.2) base.bodyY -= Math.min(0.03, -accelS * 0.003) * ground;
      base.lean = leanNow * ground;
    }
    // Floating in zero-g: knees soft, arms out for balance, a slow drift; a
    // gentle swimming sweep when moving.
    if (floatK > 0.001) {
      const tt = reduced ? 0 : time;
      const sw = swim * Math.sin(tt * 2.2);
      const F = {
        bodyY: Math.sin(tt * 0.8) * 0.025,
        torsoX: 0.06 + 0.04 * swim,
        hipLx: -0.32 + Math.sin(tt * 0.6) * 0.07 - 0.12 * sw,
        hipRx: -0.18 - Math.sin(tt * 0.6) * 0.07 + 0.12 * sw,
        hipLz: 0.1,
        hipRz: -0.1,
        knL: 0.55 + Math.sin(tt * 0.6) * 0.06,
        knR: 0.4 - Math.sin(tt * 0.6) * 0.06,
        ftL: -0.25,
        ftR: -0.2,
        shLz: 0.62 + Math.sin(tt * 0.9) * 0.06 - 0.25 * sw,
        shRz: -0.62 - Math.sin(tt * 0.9 + 1) * 0.06 + 0.25 * sw,
        shLx: -0.25 - 0.2 * swim,
        shRx: -0.25 - 0.2 * swim,
        elLx: -0.55,
        elRx: -0.55,
        headX: -0.06,
      };
      for (const k in F) base[k] = lerp(base[k], F[k], floatK);
    }
    // Carrying: shoulders forward, elbows bent, hands round the part.
    if (carry && carry.w > 0.001) {
      const sp = 0.12 + carry.spread * 0.45;
      const Cw = carry.w;
      const Cp = { shLx: -0.62, shLz: sp, shRx: -0.62, shRz: -sp, elLx: -1.05, elLz: -sp * 0.55, elRx: -1.05, elRz: sp * 0.55 };
      for (const k in Cp) base[k] = lerp(base[k], Cp[k], Cw);
      base.torsoX -= 0.05 * Cw;
    }

    // Look-at: turn the head (and a little of the body) toward the target.
    if (lookTarget) {
      headMesh.updateWorldMatrix(true, false);
      headWorld.setFromMatrixPosition(headMesh.matrixWorld);
      group.updateWorldMatrix(true, false);
      const lt = lookTarget.isObject3D ? lookTarget.getWorldPosition(tmp) : tmp.copy(lookTarget);
      const local = group.worldToLocal(tmp2.copy(lt));
      local.sub(group.worldToLocal(headWorld));
      const yaw = clamp(Math.atan2(local.x, local.z), -1.2, 1.2);
      const pitch = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.55, 0.6);
      look.yaw += (yaw - look.yaw) * Math.min(1, dt * 5);
      look.pitch += (pitch - look.pitch) * Math.min(1, dt * 5);
    } else {
      look.yaw *= 1 - Math.min(1, dt * 3);
      look.pitch *= 1 - Math.min(1, dt * 3);
    }
    base.headY += look.yaw * 0.8;
    base.torsoY += look.yaw * 0.2;
    base.headX += look.pitch;

    // Action overlay.
    let faceExpr = 'smile';
    Object.assign(pose, base);
    if (action) {
      action.t += dt;
      const u = clamp(action.t / action.dur, 0, 1);
      let w = smooth(clamp(action.t / action.fadeIn, 0, 1));
      if (!action.hold) w *= smooth(clamp((action.dur - action.t) / action.fadeOut, 0, 1));
      const over = action.fn(u, action.t);
      for (const k in over) pose[k] = lerp(base[k], over[k], w);
      if (action.expr && w > 0.35) faceExpr = action.expr;
      if (!action.hold && action.t >= action.dur) {
        const done = action.done;
        action = null;
        if (done) done();
      }
    }
    applyPose();

    // Blinks.
    blinkIn -= dt;
    if (blinkIn <= 0 && !blinking) {
      blinking = true;
      blinkIn = 0.13;
    } else if (blinkIn <= 0 && blinking) {
      blinking = false;
      blinkIn = 2.2 + Math.random() * 3.5;
    }
    if (exprOverride) blinking = false;
    expr = exprOverride || faceExpr;
    paintFace(false);
  }

  applyPose();

  const api = {
    group,
    height: HEIGHT,
    isRigged: false,
    headHeight: HIP_Y + NECK_Y + 0.02 + HEAD_C,
    setReach() {},
    setOutfit() {},
    // Promise: resolves when the patch art and fonts have been drawn.
    get ready() {
      return ready;
    },
    get appearance() {
      return Object.assign({}, ap);
    },
    // 0..1 like setMove (the brisk walk is 1); mps is the ground speed.
    get speed() {
      return speed / 1.6;
    },
    get mps() {
      return speed;
    },
    // A foot lands: fn({ run, speed }). The controller plays soft footsteps here.
    get onStep() {
      return onStep;
    },
    set onStep(fn) {
      onStep = typeof fn === 'function' ? fn : null;
    },
    get carrying() {
      return !!(carry && carry.want);
    },
    get floating() {
      return floatTarget > 0;
    },
    get action() {
      return action ? action.name : null;
    },
    // Joint groups, for attaching props (e.g. a flag in the right hand: joints.handR).
    joints: { hips, torso, neck, head, shL, shR, elL, elR, hipL, hipR, knL, knR, ftL, ftR, handL: elL, handR: elR, helmet },
    setAppearance(a) {
      ap = norm(Object.assign({}, ap, a || {}));
      ready = applyAppearance();
      return ready;
    },
    // true / false forces the helmet on or off; null follows the hair choice.
    setHelmet(on) {
      helmetOverride = typeof on === 'boolean' ? on : null;
      helmet.visible = isHelmetOn();
      buildHair();
    },
    // null returns to the automatic face ('smile', 'happy', 'joy', 'sad', 'wow').
    setExpression(e) {
      exprOverride = e || null;
    },
    update,
    // 0 = standing, 1 = brisk walk (about 1.6 m/s; see createWalker).
    setMove(v) {
      speedTarget = clamp(Number(v) || 0, 0, 1) * 1.6;
    },
    // Ground speed in m/s: walk below about 2.3, run above about 3.9, blended
    // between; the cadence matches the speed (no foot sliding).
    setSpeed(mps) {
      speedTarget = clamp(Number(mps) || 0, 0, 9);
    },
    // Lean into a turn (radians, + leans left); the controller sets it.
    setLean(rad) {
      leanTarget = clamp(Number(rad) || 0, -0.35, 0.35);
    },
    // Zero-g float pose on / off; setSwim(0..1) adds a swimming sweep.
    setFloat(on) {
      floatTarget = on ? 1 : 0;
    },
    setSwim(k) {
      swim = clamp(Number(k) || 0, 0, 1);
    },
    hop(o) {
      play('hop', o);
    },
    // Hold a part in both arms (spread 0..1 by its width); false lets go.
    carry(o) {
      if (o === false || o === null) {
        if (carry) carry.want = 0;
      } else play('carry', Object.assign({ hold: true }, o || {}));
    },
    wave(o) {
      play('wave', o);
    },
    celebrate(o) {
      play('celebrate', o);
    },
    // { hold: true } keeps the head down until another action or stop().
    sad(o) {
      play('sad', o);
    },
    cheer(o) {
      play('cheer', o);
    },
    play,
    // stopAction() ends the current action; stopAction('carry') lets go of a carried part.
    stopAction(name) {
      if (name === 'carry') {
        if (carry) carry.want = 0;
        return;
      }
      action = null;
    },
    // A THREE.Vector3 (world), an Object3D, or null to look ahead again.
    lookAt(target) {
      lookTarget = target || null;
    },
    // Jump the animation clock (screenshots and tests).
    seek(seconds) {
      const step = 1 / 30;
      for (let s = 0; s < seconds; s += step) update(step);
    },
    triangles() {
      let n = 0;
      group.traverse((o) => {
        let shown = o.isMesh && !!o.geometry;
        for (let q = o; shown && q; q = q.parent) shown = q.visible;
        if (shown) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      });
      return Math.round(n);
    },
    dispose() {
      disposed = true;
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      disposables.forEach((d) => d.dispose && d.dispose());
      if (group.parent) group.parent.remove(group);
    },
  };
  return api;
}

// ---------- The public character: rigged when the models are in ----------
// The rigged humans (js/3d/character.js) start loading when this module is
// imported. createAstronaut stays synchronous: if they are not loaded yet it
// returns the procedural figure inside a wrapper that swaps the rigged one in
// as soon as they are (state, held poses and props on the joints carry over).
// opts.rig === 'procedural' forces the old figure; without WebGL, or if the
// models fail to load, the procedural figure stays.
function webglOff() {
  try {
    return !!(SMD.settings && SMD.settings.gpu && !SMD.settings.gpu().webgl);
  } catch (e) {
    return false;
  }
}
if (typeof window !== 'undefined' && !/[?&]rig=procedural/.test(location.search)) preloadCharacters().catch(() => {});
export { preloadCharacters, charactersReady, CAST, resolveLook };

export function createAstronaut(appearance, opts = {}) {
  const wantRig = opts.rig !== 'procedural' && !webglOff() && !(typeof location !== 'undefined' && /[?&]rig=procedural/.test(location.search));
  if (wantRig && charactersReady()) {
    try {
      return createRigged(appearance, opts);
    } catch (e) {
      console.warn('rigged character failed; procedural instead', e);
    }
  }
  const proc = createProcedural(appearance, opts);
  if (!wantRig || charactersFailed()) return proc;
  return swappable(proc, appearance, opts);
}

function swappable(first, appearance, opts) {
  let impl = first;
  let ap = Object.assign({}, appearance || {});
  const outer = new THREE.Group();
  outer.name = 'astronaut';
  outer.add(impl.group);
  // What the caller asked for, replayed onto the rigged figure.
  const st = { speed: null, move: null, lean: 0, float: false, swim: 0, helmet: undefined, expr: null, look: null, carry: null, hold: null, reach: 0, outfit: null };
  let onStep = opts.onStep || null;
  const own = {};
  for (const k in impl.joints) {
    own[k] = new Set();
    impl.joints[k].children.forEach((c) => own[k].add(c));
  }
  let swapped = false;
  const swapP = preloadCharacters().then(
    () => {
      if (disposed || swapped) return;
      let next;
      try {
        next = createRigged(ap, Object.assign({}, opts, st.outfit ? { outfit: st.outfit } : {}, st.helmet !== undefined && st.helmet !== null ? { helmet: st.helmet } : {}));
      } catch (e) {
        console.warn('rigged character failed; keeping the procedural one', e);
        return;
      }
      swapped = true;
      // Props hung on the old joints move to the new ones.
      for (const k in impl.joints) {
        const nj = next.joints[k];
        if (!nj) continue;
        impl.joints[k].children.slice().forEach((c) => {
          if (!own[k].has(c)) nj.add(c);
        });
      }
      if (st.speed !== null) next.setSpeed(st.speed);
      else if (st.move !== null) next.setMove(st.move);
      next.setLean(st.lean);
      next.setFloat(st.float);
      next.setSwim(st.swim);
      if (st.expr) next.setExpression(st.expr);
      if (st.look) next.lookAt(st.look);
      if (st.carry) next.carry(st.carry);
      if (st.hold) next.play(st.hold.name, st.hold.o);
      if (st.reach) next.setReach(st.reach);
      next.onStep = onStep;
      next.group.position.copy(impl.group.position);
      outer.remove(impl.group);
      impl.dispose();
      impl = next;
      outer.add(impl.group);
      next.update(0);
    },
    () => {}
  );
  let disposed = false;
  const api = {
    group: outer,
    get isRigged() {
      return !!impl.isRigged;
    },
    get impl() {
      return impl;
    },
    get height() {
      return impl.height;
    },
    get headHeight() {
      return impl.headHeight;
    },
    get ready() {
      return Promise.all([first.ready, swapP]).then(() => impl.ready);
    },
    get appearance() {
      return impl.appearance;
    },
    get speed() {
      return impl.speed;
    },
    get mps() {
      return impl.mps;
    },
    get onStep() {
      return onStep;
    },
    set onStep(fn) {
      onStep = typeof fn === 'function' ? fn : null;
      impl.onStep = onStep;
    },
    get carrying() {
      return impl.carrying;
    },
    get floating() {
      return impl.floating;
    },
    get action() {
      return impl.action;
    },
    get joints() {
      return impl.joints;
    },
    get outfit() {
      return impl.outfit || st.outfit || null;
    },
    setAppearance(a) {
      ap = Object.assign({}, ap, a || {});
      return impl.setAppearance(a);
    },
    setOutfit(o) {
      st.outfit = o;
      if (impl.setOutfit) impl.setOutfit(o);
    },
    setHelmet(on) {
      st.helmet = on;
      impl.setHelmet(on);
    },
    setExpression(e) {
      st.expr = e || null;
      impl.setExpression(e);
    },
    update(dt) {
      impl.update(dt);
    },
    setMove(v) {
      st.move = v;
      st.speed = null;
      impl.setMove(v);
    },
    setSpeed(m) {
      st.speed = m;
      impl.setSpeed(m);
    },
    setLean(r) {
      st.lean = r;
      impl.setLean(r);
    },
    setFloat(on) {
      st.float = !!on;
      impl.setFloat(on);
    },
    setSwim(k) {
      st.swim = k;
      impl.setSwim(k);
    },
    setReach(k) {
      st.reach = k;
      if (impl.setReach) impl.setReach(k);
    },
    hop(o) {
      impl.hop(o);
    },
    carry(o) {
      st.carry = o === false || o === null ? null : o || {};
      impl.carry(o);
    },
    wave(o) {
      impl.wave(o);
    },
    celebrate(o) {
      impl.celebrate(o);
    },
    sad(o) {
      impl.sad(o);
    },
    cheer(o) {
      impl.cheer(o);
    },
    play(name, o = {}) {
      if (o.hold || ['sit', 'lie', 'rest', 'drive', 'crouch', 'torch', 'sitTalk'].includes(name)) st.hold = { name, o };
      if (name === 'stand') st.hold = null;
      if (name === 'float') st.float = true;
      return impl.play(name, o);
    },
    stopAction(name) {
      if (!name || (st.hold && st.hold.name === name)) st.hold = null;
      if (name === 'carry') st.carry = null;
      impl.stopAction(name);
    },
    lookAt(t) {
      st.look = t || null;
      impl.lookAt(t);
    },
    seek(s) {
      impl.seek(s);
    },
    triangles() {
      return impl.triangles();
    },
    dispose() {
      disposed = true;
      impl.dispose();
      if (outer.parent) outer.parent.remove(outer);
    },
  };
  return api;
}

// ---------- Walking: click-to-move and WASD ----------
// opts: { speed (m/s at a full walk, default 1.6), turn (rad/s, default 7),
//         area: { minX, maxX, minZ, maxZ } or { x, z, r } (walkable region),
//         obstacles: [{ x, z, r }] (circles to walk around), onArrive() }
export function createWalker(astro, opts = {}) {
  const g = astro.group;
  const maxSpeed = opts.speed || 1.6;
  const turn = opts.turn || 7;
  const obstacles = opts.obstacles || [];
  let area = opts.area || null;
  let target = null;
  let onArrive = null;
  const input = new THREE.Vector2();
  let vel = 0;

  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function clampArea(p) {
    if (!area) return;
    if (area.r !== undefined) {
      const dx = p.x - area.x;
      const dz = p.z - area.z;
      const d = Math.hypot(dx, dz);
      if (d > area.r) {
        p.x = area.x + (dx / d) * area.r;
        p.z = area.z + (dz / d) * area.r;
      }
    } else {
      p.x = Math.max(area.minX, Math.min(area.maxX, p.x));
      p.z = Math.max(area.minZ, Math.min(area.maxZ, p.z));
    }
  }
  function pushOut(p) {
    obstacles.forEach((o) => {
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + 0.3;
      if (d < min && d > 1e-6) {
        p.x = o.x + (dx / d) * min;
        p.z = o.z + (dz / d) * min;
      }
    });
  }
  // A step around an obstacle in the way: steer to its side. Obstacles past
  // the target (maxD metres ahead) are not in the way.
  function avoid(dir, p, maxD = Infinity) {
    for (const o of obstacles) {
      const ox = o.x - p.x;
      const oz = o.z - p.z;
      const along = ox * dir.x + oz * dir.y;
      if (along < 0 || along > o.r + 3) continue;
      const side = ox * dir.y - oz * dir.x;
      const reach = o.r + 0.5;
      if (Math.abs(side) < reach && along - Math.sqrt(reach * reach - side * side) < maxD) {
        const s = side >= 0 ? -1 : 1;
        dir.set(dir.x + s * dir.y * 1.2, dir.y - s * dir.x * 1.2).normalize();
      }
    }
    return dir;
  }

  return {
    // Walk to a world point (y ignored). onArrive fires once on arrival.
    goTo(x, z, cb) {
      const p = { x, z };
      clampArea(p);
      target = new THREE.Vector2(p.x, p.z);
      onArrive = cb || opts.onArrive || null;
    },
    stop() {
      target = null;
      input.set(0, 0);
    },
    // Direct control: x/z in world axes, length 0..1 (e.g. WASD turned by the camera yaw).
    setInput(x, z) {
      input.set(x, z);
      if (input.lengthSq() > 1) input.normalize();
      if (input.lengthSq() > 0.01) target = null;
    },
    setArea(a) {
      area = a;
    },
    get target() {
      return target;
    },
    get moving() {
      return vel > 0.05;
    },
    update(dt) {
      const p = g.position;
      let want = 0;
      const dir = new THREE.Vector2();
      if (input.lengthSq() > 0.01) {
        dir.copy(input).normalize();
        want = input.length();
      } else if (target) {
        dir.set(target.x - p.x, target.y - p.z);
        const d = dir.length();
        if (d < 0.25) {
          target = null;
          const cb = onArrive;
          onArrive = null;
          if (cb) cb();
        } else {
          dir.divideScalar(d);
          avoid(dir, p, d);
          want = Math.min(1, d / 1.4 + 0.25);
        }
      }
      if (want > 0) {
        const yaw = Math.atan2(dir.x, dir.y);
        const diff = wrapAngle(yaw - g.rotation.y);
        g.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), turn * dt);
        // Turn on the spot first when the target is behind.
        want *= Math.max(0, Math.cos(diff)) ** 2;
      }
      vel += (want - vel) * Math.min(1, dt * 5);
      if (vel < 0.003 && want === 0) vel = 0;
      if (astro.setSpeed) astro.setSpeed(vel * maxSpeed);
      else astro.setMove(vel);
      if (vel > 0) {
        const step = vel * maxSpeed * dt;
        p.x += Math.sin(g.rotation.y) * step;
        p.z += Math.cos(g.rotation.y) * step;
        pushOut(p);
        clampArea(p);
      }
      astro.update(dt);
    },
  };
}

// ---------- Portraits ----------
// One small offscreen renderer, made on demand and released when idle.
let pr = null;
let prEnv = null;
let prIdle = 0;
const prCache = new Map();
function portraitRenderer(size) {
  if (!pr) {
    const canvas = document.createElement('canvas');
    pr = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    pr.outputColorSpace = THREE.SRGBColorSpace;
    pr.toneMapping = THREE.ACESFilmicToneMapping;
    pr.toneMappingExposure = 1.05;
    pr.setPixelRatio(1);
  }
  pr.setSize(size, size, false);
  clearTimeout(prIdle);
  return pr;
}
function releaseSoon() {
  clearTimeout(prIdle);
  prIdle = setTimeout(() => {
    if (!pr) return;
    if (prEnv) prEnv.dispose();
    prEnv = null;
    // dispose() frees the GL resources; forcing a context loss each time makes
    // Chrome block WebGL for the page after a few portraits.
    pr.dispose();
    pr = null;
  }, 4000);
}
async function portraitEnv(r) {
  if (prEnv) return prEnv;
  try {
    const { RoomEnvironment } = await import('../../vendor/RoomEnvironment.js');
    const pm = new THREE.PMREMGenerator(r);
    prEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  } catch (e) {
    prEnv = null;
  }
  return prEnv;
}

// A flat illustrated portrait for browsers without WebGL.
export function drawPortrait2D(canvas, appearance) {
  const a = norm(appearance);
  const col = colorsOf(a);
  const S = canvas.width;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, S, S);
  const cx = S / 2;
  // Shoulders and backpack.
  g.fillStyle = '#f3f4f1';
  g.beginPath();
  g.ellipse(cx, S * 1.0, S * 0.46, S * 0.34, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = col.body;
  g.beginPath();
  g.ellipse(cx, S * 1.02, S * 0.4, S * 0.3, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = col.accent;
  g.fillRect(cx - S * 0.4, S * 0.86, S * 0.8, S * 0.035);
  g.fillStyle = '#c4cad0';
  g.beginPath();
  g.ellipse(cx, S * 0.73, S * 0.17, S * 0.05, 0, 0, TAU);
  g.fill();
  const helmetOn = a.hair === 'helmet';
  const hy = S * 0.46;
  const hr = S * 0.2;
  if (helmetOn) {
    g.fillStyle = '#f3f4f1';
    g.beginPath();
    g.arc(cx, hy, S * 0.3, 0, TAU);
    g.fill();
  }
  // Face.
  const fc = document.createElement('canvas');
  fc.width = FACE_W;
  fc.height = FACE_H;
  drawFace(fc.getContext('2d'), col, 'smile', false);
  g.save();
  g.beginPath();
  g.ellipse(cx, hy, hr * 0.92, hr, 0, 0, TAU);
  g.clip();
  g.drawImage(fc, FACE_W * 0.25 - 128, 0, 256, FACE_H, cx - hr * 1.6, hy - hr * 1.6, hr * 3.2, hr * 3.2);
  g.restore();
  if (a.hair === 'covered') {
    g.strokeStyle = a.patchColor;
    g.lineWidth = S * 0.06;
    g.beginPath();
    g.ellipse(cx, hy, hr * 0.98, hr * 1.06, 0, 0, TAU);
    g.stroke();
  } else if (!helmetOn) {
    g.fillStyle = col.hair;
    g.beginPath();
    g.ellipse(cx, hy - hr * 0.45, hr * 1.02, hr * 0.62, 0, Math.PI, 0);
    g.fill();
    if (a.hair === 'bun') {
      g.beginPath();
      g.arc(cx, hy - hr * 1.15, hr * 0.38, 0, TAU);
      g.fill();
    }
  }
  if (helmetOn) {
    g.fillStyle = a.visor === 'gold' ? 'rgba(217,162,27,0.92)' : 'rgba(184,210,226,0.25)';
    g.beginPath();
    g.ellipse(cx, hy + S * 0.01, S * 0.23, S * 0.2, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath();
    g.ellipse(cx - S * 0.1, hy - S * 0.08, S * 0.05, S * 0.025, -0.6, 0, TAU);
    g.fill();
  }
  return canvas;
}

// Head-and-shoulders portrait, transparent background unless opts.background.
// Resolves to a PNG data URL; falls back to the 2D drawing without WebGL.
export function createPortrait(appearance, size = 256, opts = {}) {
  const a = norm(appearance);
  const key = JSON.stringify([a, size, opts.background || '', opts.expression || '', opts.angle || 0]);
  if (prCache.has(key)) return prCache.get(key);
  const job = (async () => {
    let r;
    try {
      if (SMD.settings && SMD.settings.gpu && !SMD.settings.gpu().webgl) throw new Error('no webgl');
      r = portraitRenderer(size);
    } catch (e) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      return drawPortrait2D(c, a).toDataURL('image/png');
    }
    const env = await portraitEnv(r);
    const scene = new THREE.Scene();
    if (opts.background) scene.background = new THREE.Color(opts.background);
    scene.add(new THREE.HemisphereLight(0xf5f2ea, 0x8a948f, 1.1));
    const key1 = new THREE.DirectionalLight(0xfff1dc, 2.4);
    key1.position.set(1.2, 2.6, 2.2);
    scene.add(key1);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 1.6);
    rim.position.set(-1.6, 2.2, -1.4);
    scene.add(rim);
    // The rigged figure when it can load in time (portraits are small and cached).
    if (!opts.procedural) await Promise.race([preloadCharacters().catch(() => null), new Promise((res) => setTimeout(res, 4000))]);
    const astro = createAstronaut(a, { env, shadows: false, blob: false, rig: opts.procedural ? 'procedural' : undefined, outfit: opts.outfit });
    astro.group.rotation.y = opts.angle !== undefined ? opts.angle : -0.32;
    scene.add(astro.group);
    if (opts.expression) astro.setExpression(opts.expression);
    const cam = new THREE.PerspectiveCamera(18, 1, 0.05, 20);
    const helmetOn = a.hair === 'helmet';
    const cy = astro.isRigged ? astro.headHeight - (helmetOn ? 0.03 : 0.05) : helmetOn ? 1.585 : 1.56;
    cam.position.set(0.1, cy + 0.06, astro.isRigged ? (helmetOn ? 2.0 : 1.75) : helmetOn ? 2.05 : 1.9);
    cam.lookAt(0, cy, 0);
    astro.lookAt(cam.position.clone());
    await Promise.race([astro.ready, new Promise((res) => setTimeout(res, 800))]);
    for (let i = 0; i < 20; i++) astro.update(1 / 30);
    astro.stopAction();
    r.setClearColor(0x000000, 0);
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png');
    astro.dispose();
    scene.traverse((o) => o.isLight && o.dispose && o.dispose());
    releaseSoon();
    return url;
  })();
  prCache.set(key, job);
  if (prCache.size > 24) prCache.delete(prCache.keys().next().value);
  job.catch(() => prCache.delete(key));
  return job;
}

// ---------- The creator's turntable ----------
// A clean pedestal on drafting vellum. opts: { el (pointer target for drag) }.
// Returns a scene object for engine.mount plus setAppearance, focus(), act().
export function createAvatarStage(appearance, opts = {}) {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);

  // Background: vellum with a faint drafting grid, lighter in the middle.
  const bg = document.createElement('canvas');
  bg.width = 512;
  bg.height = 512;
  {
    const g = bg.getContext('2d');
    const gr = g.createRadialGradient(256, 210, 30, 256, 256, 380);
    gr.addColorStop(0, '#f3f6f3');
    gr.addColorStop(0.6, '#e6ece8');
    gr.addColorStop(1, '#d3ddd7');
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(155,172,163,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i <= 512; i += 24) {
      g.beginPath();
      g.moveTo(i + 0.5, 0);
      g.lineTo(i + 0.5, 512);
      g.moveTo(0, i + 0.5);
      g.lineTo(512, i + 0.5);
      g.stroke();
    }
  }
  const bgTex = new THREE.CanvasTexture(bg);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;

  scene.add(new THREE.HemisphereLight(0xf7f4ec, 0x9aa49e, 1.15));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.6);
  key.position.set(2.2, 4.2, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -1.4;
  sc.right = sc.top = 1.4;
  sc.near = 1;
  sc.far = 10;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe2ff, 1.7);
  rim.position.set(-2.6, 2.6, -2.4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe6c8, 0.5);
  fill.position.set(-2.5, 1.2, 2.5);
  scene.add(fill);

  // Pedestal: graphite disc with a gold edge, a soft shadow on the floor.
  const PED = 0.14;
  const ped = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, PED, 48), new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.42, metalness: 0.3 }));
  top.position.y = PED / 2;
  top.receiveShadow = true;
  ped.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.625, 0.008, 6, 64), new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.3, metalness: 0.8 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = PED + 0.001;
  ped.add(ring);
  // Faint tick marks round the top, like a turntable.
  const ticks = new THREE.Group();
  const tickMat = new THREE.MeshBasicMaterial({ color: 0x59636c });
  for (let i = 0; i < 36; i++) {
    const tk = new THREE.Mesh(new THREE.PlaneGeometry(0.006, i % 9 === 0 ? 0.06 : 0.03), tickMat);
    const a = (i / 36) * TAU;
    tk.rotation.set(-Math.PI / 2, 0, -a);
    tk.position.set(Math.sin(a) * 0.57, PED + 0.002, Math.cos(a) * 0.57);
    ticks.add(tk);
  }
  ped.add(ticks);
  scene.add(ped);
  const floorBlob = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false, opacity: 0.5 }));
  floorBlob.rotation.x = -Math.PI / 2;
  floorBlob.position.y = 0.002;
  scene.add(floorBlob);

  const astro = createAstronaut(appearance, { blob: true });
  astro.group.position.y = PED;
  scene.add(astro.group);
  studioEnv().then((env) => {
    if (env) scene.environment = env;
  });

  // Camera: full body, or close on the face, or on the shoulder patch.
  const VIEWS = {
    body: { y: 1.0, h: 2.6, w: 0.62, yaw: 0 },
    face: { y: 1.6 + PED, h: 0.95, w: 0.85, yaw: 0 },
    patch: { y: 1.28 + PED, h: 1.15, w: 0.8, yaw: -1.2 },
  };
  let view = 'body';
  const cam = { y: VIEWS.body.y, h: VIEWS.body.h, w: VIEWS.body.w };
  let W = 1;
  let H = 1;
  let yaw = 0.35;
  let yawVel = 0;
  let dragging = null;
  let lastTouch = -10;
  let t = 0;
  let walking = false;

  function place() {
    const fov = (camera.fov * Math.PI) / 180;
    const aspect = W / H;
    // Fit the view height, and enough width for the character on narrow stages.
    const needH = cam.h;
    const needW = cam.h * cam.w;
    const dist = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * aspect)) * 1.04;
    camera.position.set(0, cam.y + dist * 0.06, dist);
    camera.lookAt(0, cam.y, 0);
  }

  const el = opts.el || null;
  const onDown = (e) => {
    dragging = { x: e.clientX, yaw, id: e.pointerId };
    lastTouch = t;
    if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x;
    const ny = dragging.yaw + dx * 0.012;
    yawVel = (ny - yaw) * 30;
    yaw = ny;
    lastTouch = t;
  };
  const onUp = () => {
    dragging = null;
  };
  if (el) {
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }

  function update(dt) {
    t += dt;
    if (astro.isRigged) VIEWS.face.y = astro.headHeight - 0.04 + PED;
    const v = VIEWS[view];
    const k = reduced ? 1 : Math.min(1, dt * 4);
    cam.y += (v.y - cam.y) * k;
    cam.h += (v.h - cam.h) * k;
    cam.w += (v.w - cam.w) * k;
    place();
    if (!dragging) {
      yawVel *= Math.pow(0.04, dt);
      yaw += yawVel * dt;
      // Settle toward the view's angle, with a gentle sway while idle.
      if (t - lastTouch > 2.5) {
        const sway = reduced ? 0 : Math.sin(t * 0.35) * 0.45;
        const goal = v.yaw + (view === 'body' ? sway + 0.2 : 0.15 * Math.sin(t * 0.3) * (reduced ? 0 : 1));
        yaw += (goal - yaw) * Math.min(1, dt * 1.2);
      }
    }
    astro.group.rotation.y = yaw;
    ped.rotation.y = yaw;
    astro.update(dt);
  }

  return {
    scene,
    camera,
    shadows: true,
    exposure: 1.0,
    astro,
    update,
    onResize(w, h) {
      W = w;
      H = h;
      place();
    },
    setAppearance(a) {
      return astro.setAppearance(a);
    },
    // 'body' | 'face' | 'patch'
    focus(name) {
      if (VIEWS[name]) {
        view = name;
        lastTouch = t - 10;
      }
    },
    // Turn the turntable by d radians (keyboard).
    turn(d) {
      yaw += d;
      yawVel = 0;
      lastTouch = t;
    },
    act(name) {
      if (name === 'walk') {
        walking = !walking;
        astro.setMove(walking ? 0.8 : 0);
        return walking;
      }
      if (walking) {
        walking = false;
        astro.setMove(0);
      }
      astro.play(name);
      return false;
    },
    dispose() {
      if (el) {
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
      }
      astro.dispose();
      bgTex.dispose();
    },
  };
}
