// Surface renderer, part 2 of 3: the places. Terrain from real NASA maps plus
// procedural grit, the sky band with Earth or Jupiter in it, rocks, Venus's
// floating platform, dust haze. One config per world at the top: to change how
// a world feels, change it here.
import { THREE } from '../3d/engine.js';
import { fbm } from '../3d/assets.js';
import { LOG_V_PARS, LOG_V, LOG_F_PARS, LOG_F, quality, lampify, gritRock } from './surface3d-fx.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Seeded numbers so a map looks the same on every machine.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- The four worlds ----------
// post: the grade each world gets through js/ll/render.js.
// sun: direction toward the sun (shadows fall toward the camera and off to the
// side, so they are seen). sky: linear colours, day and night.
export const WORLDS = {
  moon: {
    macro: 'moon',
    crop: { u: 0.462, v: 0.265, s: 0.04 },
    macroGain: [1.05, 1.03, 1.0],
    grain: [0.74, 1.26],
    gravity: -1.62,
    sun: { dir: [0.74, 0.3, -0.6], color: 0xfff6ea, intensity: 6.4, nightIntensity: 0.0 },
    ambient: { sky: 0x2a3a58, ground: 0x030303, day: 0.09, night: 0.05 },
    roughness: 0.96,
    normal: [0.42, 0.28, 0.34],
    exposure: 0.95,
    fog: null,
    dust: [0.28, 0.27, 0.26],
    goo: [0.55, 0.3, 1.2],
    rocks: { color: 0x585654, color2: 0x7c7875, flat: true },
    sky: {
      zenith: [0, 0, 0],
      horizon: [0.0, 0.0, 0.002],
      nightZenith: [0, 0, 0],
      nightHorizon: [0, 0, 0.002],
      stars: 1,
      ridge: [0.055, 0.052, 0.05],
      ridgeNear: [0.02, 0.019, 0.018],
      band: 0.205,
    },
    planet: { tex: 'earth-day', x: -0.52, y: 0.84, r: 0.26, atmosphere: [0.25, 0.5, 1.0], sun: [0.75, 0.25, 0.62], gain: 1.3 },
    post: {
      bloom: { strength: 0.42, radius: 0.6, threshold: 0.86 },
      ao: false,
      grade: { contrast: 1.2, saturation: 0.82, temperature: -0.06, lift: [0.0, 0.002, 0.008], gain: [1.03, 1.0, 0.96] },
      vignette: 0.42,
      grain: 0.05,
    },
    speedK: 0.75,
  },
  mars: {
    macro: 'mars',
    crop: { u: 0.61, v: 0.53, s: 0.03 },
    macroGain: [1.25, 1.0, 0.86],
    grain: [0.62, 1.4],
    gravity: -3.71,
    sun: { dir: [0.5, 0.42, -0.76], color: 0xffe0bf, intensity: 3.6, nightIntensity: 0 },
    ambient: { sky: 0xc4976a, ground: 0x402518, day: 0.4, night: 0.05 },
    roughness: 0.94,
    normal: [0.85, 0.6, 0.4],
    exposure: 0.95,
    fog: { color: 0xb88a5e, density: 0.0028, nightColor: 0x0d0a10 },
    dust: [0.62, 0.38, 0.22],
    goo: [1.25, 0.65, 0.1],
    rocks: { color: 0x51291a, color2: 0x8a4b2a, flat: true },
    sky: {
      zenith: [0.28, 0.19, 0.12],
      horizon: [0.76, 0.5, 0.3],
      nightZenith: [0.005, 0.006, 0.014],
      nightHorizon: [0.03, 0.022, 0.03],
      stars: 0.75,
      ridge: [0.32, 0.17, 0.09],
      ridgeNear: [0.18, 0.09, 0.05],
      band: 0.205,
    },
    planet: null,
    sunDisc: { x: 0.55, y: 0.74, r: 0.05 },
    post: {
      bloom: { strength: 0.42, radius: 0.65, threshold: 0.88 },
      ao: false,
      grade: { contrast: 1.12, saturation: 1.06, temperature: 0.26, lift: [0.018, 0.008, 0.002], gain: [1.03, 0.99, 0.91] },
      vignette: 0.38,
      grain: 0.06,
    },
    speedK: 0.9,
    haze: 0.16,
  },
  venus: {
    platform: true,
    macro: null,
    gravity: -8.87,
    sun: { dir: [0.45, 0.72, -0.5], color: 0xffcf8a, intensity: 1.9, nightIntensity: 0.35 },
    ambient: { sky: 0xffa24f, ground: 0x80401a, day: 0.75, night: 0.45 },
    roughness: 0.55,
    normal: [0.3, 0.2, 0.2],
    exposure: 0.92,
    fog: { color: 0xc77a2c, density: 0.0034, nightColor: 0x3d1e0d },
    dust: [0.95, 0.62, 0.22],
    goo: [0.25, 1.1, 0.55],
    rocks: { color: 0x3f4347, color2: 0x7a6245, flat: false },
    sky: {
      zenith: [0.3, 0.13, 0.03],
      horizon: [0.92, 0.48, 0.13],
      nightZenith: [0.12, 0.05, 0.02],
      nightHorizon: [0.34, 0.15, 0.04],
      stars: 0,
      ridge: [0.75, 0.42, 0.14],
      ridgeNear: [0.55, 0.3, 0.11],
      band: 0.205,
      clouds: 1,
    },
    planet: null,
    sunDisc: { x: 0.2, y: 0.82, r: 0.09, hazy: 1 },
    post: {
      bloom: { strength: 0.55, radius: 0.75, threshold: 0.82 },
      ao: false,
      grade: { contrast: 1.1, saturation: 1.1, temperature: 0.36, tint: 0.04, lift: [0.03, 0.012, 0.0], gain: [1.05, 0.97, 0.8] },
      vignette: 0.44,
      grain: 0.065,
    },
    speedK: 1,
    haze: 0.16,
  },
  europa: {
    macro: 'europa',
    crop: { u: 0.38, v: 0.47, s: 0.05 },
    macroGain: [0.98, 1.02, 1.1],
    grain: [0.74, 1.26],
    gravity: -1.31,
    cracks: 1,
    sun: { dir: [-0.62, 0.34, -0.7], color: 0xdfe9ff, intensity: 3.1, nightIntensity: 0 },
    ambient: { sky: 0x36618c, ground: 0x041226, day: 0.3, night: 0.11 },
    roughness: 0.34,
    normal: [0.6, 0.45, 0.4],
    exposure: 1.0,
    fog: { color: 0x2c4765, density: 0.0016, nightColor: 0x020610 },
    dust: [0.72, 0.82, 0.98],
    goo: [0.25, 0.95, 1.3],
    rocks: { color: 0x9ec2dc, color2: 0xd8ecfa, flat: true, ice: true },
    sky: {
      zenith: [0.001, 0.002, 0.008],
      horizon: [0.02, 0.05, 0.12],
      nightZenith: [0.0, 0.001, 0.006],
      nightHorizon: [0.006, 0.016, 0.05],
      stars: 1,
      ridge: [0.1, 0.17, 0.26],
      ridgeNear: [0.05, 0.1, 0.17],
      band: 0.205,
    },
    planet: { tex: 'jupiter', x: 0.3, y: 1.05, r: 0.62, atmosphere: [0.9, 0.7, 0.45], sun: [-0.55, 0.3, 0.78], gain: 1.15, axis: 0.12 },
    post: {
      bloom: { strength: 0.5, radius: 0.7, threshold: 0.84 },
      ao: false,
      grade: { contrast: 1.16, saturation: 1.08, temperature: -0.22, lift: [0.0, 0.006, 0.02], gain: [0.98, 1.01, 1.06] },
      vignette: 0.42,
      grain: 0.05,
    },
    speedK: 0.72,
  },
};

// ---------- Grit tile: tileable height, normals and spots in one texture ----------
function tileNoise(size, seedV, period) {
  // Periodic value noise so the tile wraps without a seam.
  const r = rng(seedV);
  const lattice = new Float32Array(period * period);
  for (let i = 0; i < lattice.length; i++) lattice[i] = r();
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const at = (a, b) => lattice[(((a % period) + period) % period) + (((b % period) + period) % period) * period];
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function makeGritTile(size, seed, style) {
  const h = new Float32Array(size * size);
  const octs = [];
  for (let o = 0; o < 6; o++) {
    const period = 4 << o;
    octs.push({ f: tileNoise(size, seed + o * 11, period), period, amp: Math.pow(0.55, o) });
  }
  let min = 1e9;
  let max = -1e9;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0;
      for (let o = 0; o < octs.length; o++) {
        const q = octs[o];
        s += q.f((x / size) * q.period, (y / size) * q.period) * q.amp;
      }
      h[x + y * size] = s;
      if (s < min) min = s;
      if (s > max) max = s;
    }
  }
  const scale = 1 / (max - min);
  for (let i = 0; i < h.length; i++) h[i] = (h[i] - min) * scale;
  // Pits and pebbles stamped in (wrapped): the texture of a surface no rain ever touched.
  const r = rng(seed * 7 + 3);
  const stamps = style === 'moon' ? 900 : style === 'mars' ? 400 : 180;
  for (let n = 0; n < stamps; n++) {
    const cx = r() * size;
    const cy = r() * size;
    const rad = 1.5 + r() * r() * (style === 'moon' ? 12 : 7);
    const depth = (style === 'moon' ? -0.34 : 0.22) * (0.4 + r() * 0.6);
    const R = Math.ceil(rad);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy) / rad;
        if (d >= 1) continue;
        const i = ((cx + dx + size * 2) | 0) % size;
        const j = ((cy + dy + size * 2) | 0) % size;
        const profile = style === 'moon' ? (d < 0.72 ? 1 - (d / 0.72) * (d / 0.72) : -((1 - d) / 0.28) * 0.5) : 1 - d * d;
        h[i + j * size] += depth * profile;
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = x + y * size;
      const hL = h[((x + size - 1) % size) + y * size];
      const hR = h[((x + 1) % size) + y * size];
      const hU = h[x + ((y + size - 1) % size) * size];
      const hD = h[x + ((y + 1) % size) * size];
      const nx = clamp(0.5 + (hL - hR) * 5);
      const nz = clamp(0.5 + (hU - hD) * 5);
      data[i * 4] = clamp(h[i]) * 255;
      data[i * 4 + 1] = nx * 255;
      data[i * 4 + 2] = nz * 255;
      data[i * 4 + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = quality().tier === 'low' ? 2 : 6;
  tex.needsUpdate = true;
  return tex;
}

// Europa: a canvas full of lineae, the long double ridges real Europa is covered in.
function makeCrackTile(seed) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const r = rng(seed);
  const line = (w, a) => {
    let x = r() * S;
    let y = r() * S;
    let ang = r() * 6.28;
    const n = 30 + r() * 60;
    const pts = [];
    for (let i = 0; i < n; i++) {
      pts.push([x, y]);
      ang += (r() - 0.5) * 0.3;
      x += Math.cos(ang) * 22;
      y += Math.sin(ang) * 22;
    }
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        g.beginPath();
        pts.forEach(([px, py], i) => (i ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy)));
        g.lineWidth = w;
        g.strokeStyle = `rgba(255,255,255,${a})`;
        g.stroke();
      }
    }
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 26; i++) line(6 + r() * 12, 0.5);
  for (let i = 0; i < 60; i++) line(1.5 + r() * 3, 0.9);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = quality().tier === 'low' ? 2 : 8;
  return tex;
}

// Venus: deck plates, seams, rivets, hazard paint.
function makeDeckTile() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#7f858c';
  g.fillRect(0, 0, S, S);
  const n = 8;
  const a = S / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = 112 + ((x * 37 + y * 53) % 38);
      g.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
      g.fillRect(x * a + 2, y * a + 2, a - 4, a - 4);
      g.fillStyle = 'rgba(40,40,40,0.35)';
      for (const [px, py] of [
        [10, 10],
        [a - 10, 10],
        [10, a - 10],
        [a - 10, a - 10],
      ]) {
        g.beginPath();
        g.arc(x * a + px, y * a + py, 3, 0, 7);
        g.fill();
      }
      if ((x + y * 3) % 7 === 2) {
        g.fillStyle = 'rgba(60,62,68,0.55)';
        g.fillRect(x * a + 18, y * a + 18, a - 36, a - 36);
        g.strokeStyle = 'rgba(190,190,190,0.2)';
        g.lineWidth = 2;
        g.strokeRect(x * a + 18, y * a + 18, a - 36, a - 36);
      }
    }
  }
  g.strokeStyle = '#2a2c30';
  g.lineWidth = 3;
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo(i * a, 0);
    g.lineTo(i * a, S);
    g.moveTo(0, i * a);
    g.lineTo(S, i * a);
    g.stroke();
  }
  // Warm streaks, because the acid gets everywhere.
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    g.strokeStyle = `rgba(214,150,62,${0.05 + Math.random() * 0.1})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 16, y + 20 + Math.random() * 80);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = quality().tier === 'low' ? 2 : 8;
  return tex;
}

// ---------- Terrain ----------
const FLAT_TEX_DATA = new Uint8Array([128, 128, 128, 255]);
function flatTexture() {
  const t = new THREE.DataTexture(FLAT_TEX_DATA, 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

// map: the published sim map { size, cell, w, h, tiles, lander, dishPad }.
// keep: spots to leave flat and clear, in sim metres ({x, z}).
export function buildWorld(id, map, seed, lamps, keep = []) {
  const cfg = WORLDS[id] || WORLDS.moon;
  const group = new THREE.Group();
  group.name = 'world:' + id;
  const q = quality();
  const low = q.tier === 'low';
  const W = map.size / 2;
  const cx = W;
  const cz = W;
  group.position.set(cx, 0, cz); // sim coordinates start at a corner; the world is built around its middle
  const margin = 64; // the ground carries on past the playable edge
  const size = (W + margin) * 2;
  const seg = low ? 120 : 200;
  const R = rng(seed * 13 + 1);
  // The grit texture is shared by ground, sky and haze, so it is built first.
  const grit = makeGritTile(low ? 256 : 512, 17 + (seed % 5), id === 'moon' ? 'moon' : id === 'mars' ? 'mars' : 'other');

  // ---------- Heights ----------
  const flats = []; // flattened building spots: base, sites
  if (map.lander) flats.push({ x: map.lander.x - cx, z: map.lander.z - cz, r: 15 });
  if (map.dishPad) flats.push({ x: map.dishPad.x - cx, z: map.dishPad.z - cz, r: 5 });
  for (const s of keep) flats.push({ x: s.x - cx, z: s.z - cz, r: 5 });
  const craters = [];
  if (!cfg.platform) {
    const nC = id === 'moon' ? 26 : id === 'mars' ? 9 : 0;
    for (let i = 0; i < nC; i++) {
      const rc = i < 3 ? 12 + R() * 14 : 1.8 + R() * R() * 9;
      craters.push({ x: (R() - 0.5) * (W + 30) * 2, z: (R() - 0.5) * (W + 30) * 2, r: rc, d: rc * (0.18 + R() * 0.08) });
    }
  }
  const relief = cfg.platform ? 0 : id === 'europa' ? 0.55 : id === 'moon' ? 1.4 : 1.25;
  function rawHeight(x, z) {
    if (cfg.platform) return 0;
    const n = (fbm(x * 0.022 + 7, 0, z * 0.022 + 3, 4, 11) - 0.5) * 2 * relief * 3.2;
    const m = (fbm(x * 0.09 + 31, 4, z * 0.09 - 17, 3, 23) - 0.5) * relief * 0.9;
    let h = n + m;
    for (let i = 0; i < craters.length; i++) {
      const c = craters[i];
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d > 2) continue;
      if (d < 1) h += -c.d * (1 - d * d) + c.d * 0.45 * smooth(0.82, 1, d);
      else h += c.d * 0.45 * (1 - smooth(1, 1.9, d));
    }
    for (let i = 0; i < flats.length; i++) {
      const f = flats[i];
      const k = smooth(f.r, f.r * 1.7, Math.hypot(x - f.x, z - f.z));
      h = h * k;
    }
    return h;
  }

  const N = seg + 1;
  const step = size / seg;
  const heights = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) heights[i + j * N] = rawHeight(-size / 2 + i * step, -size / 2 + j * step);
  }
  function height(xSim, zSim) {
    if (cfg.platform) return 0;
    const x = xSim - cx;
    const z = zSim - cz;
    const fx = clamp((x + size / 2) / step, 0, seg - 0.0001);
    const fz = clamp((z + size / 2) / step, 0, seg - 0.0001);
    const i = fx | 0;
    const j = fz | 0;
    const u = fx - i;
    const v = fz - j;
    const a = heights[i + j * N];
    const b = heights[i + 1 + j * N];
    const c = heights[i + (j + 1) * N];
    const d = heights[i + 1 + (j + 1) * N];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  const uniforms = {
    uTiles: { value: tileMask(map) },
    uTileS: { value: 1 / map.size },
    uCenter: { value: new THREE.Vector2(cx, cz) },
    uMacro: { value: flatTexture() },
    uDetail: { value: grit },
    uCrack: { value: null },
    uCrop: { value: new THREE.Vector4(0.5, 0.5, 0.0005, 0) },
    uMacroGain: { value: new THREE.Vector3(...(cfg.macroGain || [1, 1, 1])) },
    uGrain: { value: new THREE.Vector2(...(cfg.grain || [0.6, 1.4])) },
    uNormals: { value: new THREE.Vector3(...cfg.normal) },
    uEdge: { value: W + 2 },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uDeck: { value: null },
    uDust: { value: 0 },
  };

  let ground;
  if (cfg.platform) {
    uniforms.uDeck.value = makeDeckTile();
    // The deck is exactly the cells the sim lets you stand on.
    const geo = deckGeometry(map, cx, cz);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: cfg.roughness, metalness: 0.45 });
    patchGround(mat, uniforms, { WORLD_VENUS: 1 });
    lampify(mat, lamps);
    ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    ground.castShadow = false;
    ground.name = 'deck';
    group.add(ground);
  } else {
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, rawHeightFromArray(pos.getX(i), pos.getZ(i)));
    function rawHeightFromArray(x, z) {
      const i = Math.round((x + size / 2) / step);
      const j = Math.round((z + size / 2) / step);
      return heights[clamp(i, 0, seg) + clamp(j, 0, seg) * N];
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: cfg.roughness, metalness: 0 });
    patchGround(mat, uniforms, { [`WORLD_${id.toUpperCase()}`]: 1 });
    lampify(mat, lamps);
    ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    ground.castShadow = !low; // real crater shadows; the low tier leaves them to the grit
    ground.name = 'ground';
    group.add(ground);
    // The real NASA map: the crop below is the terrain's colour.
    if (cfg.macro && SMD.assets) {
      SMD.assets
        .texture(cfg.macro)
        .then((t) => {
          if (disposed) return;
          uniforms.uMacro.value = t;
          const crop = cfg.crop;
          // One crop-width of the real map covers the whole plane.
          uniforms.uCrop.value.set(crop.u, crop.v, crop.s / size, 1);
        })
        .catch(() => {});
    }
    if (cfg.cracks) uniforms.uCrack.value = makeCrackTile(seed + 3);
  }

  // ---------- Rocks ----------
  const rockSets = buildRocks(id, cfg, map, cx, cz, W, R, height, lamps, low, keep, grit);
  const rockLOD = rockSets.lod || null;
  rockSets.forEach((m) => group.add(m));

  // ---------- Venus: clouds below, struts and balloons under the deck ----------
  let clouds = null;
  if (cfg.platform) clouds = buildVenusRig(group, cfg, map, cx, cz, W, R, lamps, low, uniforms);

  // ---------- Sky band ----------
  const sky = buildSky(cfg, grit, cx, cz);
  group.add(sky.mesh);

  // ---------- Dust haze that drifts across the ground ----------
  const haze = buildHaze(cfg, grit, size);
  if (haze) group.add(haze.mesh);

  let disposed = false;
  const api = {
    group,
    cfg,
    height,
    map,
    grit,
    rockTop: cfg.rocks.ice ? 5.5 : cfg.platform ? 2.6 : 3.2,
    updateRockLOD(camX, camZ) {
      if (rockLOD) rockLOD.update(camX - cx, camZ - cz);
    },
    setEyeLevel(on) {
      sky.mesh.visible = !on;
      if (haze) haze.mesh.visible = !on;
    },
    W,
    size,
    update(dt, t, night, storm, cam, aspect) {
      uniforms.uTime.value = t;
      uniforms.uNight.value = night;
      uniforms.uDust.value = storm;
      sky.update(t, night, storm, cam, aspect);
      if (haze) haze.update(t, night, storm, cam);
      if (clouds) clouds.update(t, night);
    },
    dispose() {
      disposed = true;
      sky.dispose();
      if (haze) haze.dispose();
      grit.dispose();
      if (uniforms.uDeck.value) uniforms.uDeck.value.dispose();
      uniforms.uTiles.value.dispose();
      if (uniforms.uCrack.value) uniforms.uCrack.value.dispose();
    },
  };
  return api;
}

function patchGround(mat, uniforms, defines) {
  mat.defines = Object.assign(mat.defines || {}, defines);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWN = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform sampler2D uMacro;
        uniform sampler2D uDetail;
        uniform sampler2D uCrack;
        uniform sampler2D uDeck;
        uniform sampler2D uTiles;
        uniform float uTileS;
        uniform vec2 uCenter;
        uniform vec4 uCrop;
        uniform vec3 uMacroGain;
        uniform vec2 uGrain;
        uniform vec3 uNormals;
        uniform float uEdge;
        uniform float uNight;
        uniform float uTime;
        uniform float uDust;
        varying vec3 vWP;
        varying vec3 vWN;
        vec3 gritAlbedo;
        float gritRough;
        float crackMask;
        vec3 gritDN;
        `
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec2 wxz = vWP.xz;
        vec4 d1 = texture2D(uDetail, wxz * 0.083);
        vec4 d2 = texture2D(uDetail, wxz * 0.29 + vec2(0.31, 0.77));
        vec4 d3 = texture2D(uDetail, wxz * 0.021 + vec2(0.11, 0.52));
        vec4 d4 = texture2D(uDetail, wxz * 1.03 + vec2(0.61, 0.13));
        float grain = (d1.r * 1.0 + d2.r * 0.7 + d3.r * 1.1 + d4.r * 0.35) / 3.15;
        gritDN = vec3((d1.g - 0.5) * uNormals.x + (d2.g - 0.5) * uNormals.y + (d3.g - 0.5) * uNormals.z + (d4.g - 0.5) * 0.5,
                      0.0,
                      (d1.b - 0.5) * uNormals.x + (d2.b - 0.5) * uNormals.y + (d3.b - 0.5) * uNormals.z + (d4.b - 0.5) * 0.5);
        gritRough = 1.0;
        crackMask = 0.0;
        #ifdef WORLD_VENUS
          vec3 plate = texture2D(uDeck, wxz * 0.0312).rgb;
          diffuseColor.rgb = plate * mix(0.85, 1.15, grain);
          // Worn lanes where feet and carts have been: a warmer scuff near the centre.
          gritRough = mix(1.0, 0.8, smoothstep(0.42, 0.72, d3.r));
        #else
          vec2 fromMid = wxz - uCenter;
          vec3 macro = texture2D(uMacro, uCrop.xy + fromMid * uCrop.z * vec2(1.0, -1.0)).rgb;
          float macroL = dot(macro, vec3(0.3, 0.5, 0.2));
          vec3 alb = macro * uMacroGain * 1.15;
          #ifdef WORLD_MOON
            alb = mix(vec3(macroL), alb, 0.55);
          #endif
          #ifdef WORLD_MARS
            // Basalt scattered in rust: darker, cooler patches in the low spots.
            float rock = smoothstep(0.6, 0.76, d3.r * 0.7 + d2.r * 0.4);
            alb = mix(alb, alb * vec3(0.62, 0.55, 0.52), rock * 0.75);
            alb *= vec3(1.02, 0.98, 0.93);
          #endif
          #ifdef WORLD_EUROPA
            crackMask = texture2D(uCrack, wxz * 0.014).r;
            float fine = texture2D(uCrack, wxz * 0.05 + vec2(0.2, 0.7)).g;
            crackMask = clamp(crackMask + fine * 0.5, 0.0, 1.0);
            alb = mix(alb, vec3(0.3, 0.13, 0.06), smoothstep(0.08, 0.7, crackMask) * 0.92);
            alb = mix(alb, vec3(0.72, 0.86, 1.02) * (0.82 + 0.3 * macroL), (1.0 - crackMask) * 0.62);
            gritRough = mix(1.0, 2.0, smoothstep(0.42, 0.65, d1.r));
          #endif
          diffuseColor.rgb = alb * mix(uGrain.x, uGrain.y, grain);
        #endif
        vec2 fromCentre = vWP.xz - uCenter;
        float edge = smoothstep(uEdge, uEdge + 22.0, max(abs(fromCentre.x), abs(fromCentre.y)));
        diffuseColor.rgb *= 1.0 - edge * 0.65;
        vec4 tileM = texture2D(uTiles, (vWP.xz + (d3.gb - 0.5) * 7.0 + (d2.gb - 0.5) * 2.0) * uTileS);
        // Shadow tiles are the caves and permanent dark: the sim's map, drawn.
        diffuseColor.rgb *= 1.0 - smoothstep(0.1, 0.8, tileM.r) * 0.86;
        // Ice tiles: clean, pale, slick.
        float iceTile = smoothstep(0.32, 0.68, tileM.g);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.8, 1.0) * mix(0.8, 1.2, grain), iceTile * 0.8);
        gritRough = mix(gritRough, 0.42, iceTile);
        `
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        vec3 groundNW = normalize(vWN + gritDN);
        normal = normalize((viewMatrix * vec4(groundNW, 0.0)).xyz);
        `
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= gritRough;')
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        #ifdef WORLD_EUROPA
          // Something faintly alive in the cracks, stronger in the dark.
          float pulse = 0.65 + 0.35 * sin(uTime * 0.7 + vWP.x * 0.05);
          totalEmissiveRadiance += vec3(0.05, 0.3, 0.65) * crackMask * crackMask * (0.25 + uNight * 0.95) * pulse;
        #endif
        #ifdef WORLD_VENUS
          // Deck lights: thin amber seams at the plate joints.
          vec2 gxz = fract(vWP.xz / 32.0 + 0.5);
          float seam = (1.0 - smoothstep(0.0, 0.012, min(abs(gxz.x - 0.5), abs(gxz.y - 0.5))));
          totalEmissiveRadiance += vec3(1.0, 0.55, 0.15) * seam * (0.35 + uNight * 0.6);
        #endif
        `
      );
  };
  mat.customProgramCacheKey = () => 'tv-ground-' + Object.keys(defines).join(',');
}

// ---------- Rocks ----------
function displacedRock(detail, seedV, squash) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const r = rng(seedV);
  const offset = [r() * 9, r() * 9, r() * 9];
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 0.72 + 0.56 * fbm(v.x * 1.4 + offset[0], v.y * 1.4 + offset[1], v.z * 1.4 + offset[2], 3, 7);
    v.multiplyScalar(k);
    v.y *= squash;
    p.setXYZ(i, v.x, Math.max(v.y, -0.24), v.z);
  }
  return g;
}

function buildRocks(id, cfg, map, cx, cz, W, R, height, lamps, low, keep, grit) {
  const out = [];
  const isIce = !!cfg.rocks.ice;
  const base = new THREE.Color(cfg.rocks.color);
  const hi = new THREE.Color(cfg.rocks.color2);
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const col = new THREE.Color();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const heightAt = (x, z) => height(x + cx, z + cz);
  const place = (mesh, i, x, z, s, sy, jitter = 1) => {
    euler.set((R() - 0.5) * 0.3 * jitter, R() * 6.28, (R() - 0.5) * 0.3 * jitter);
    quat.setFromEuler(euler);
    pos.set(x, heightAt(x, z) + sy * 0.28, z);
    m4.compose(pos, quat, scale.set(s, sy, s));
    mesh.setMatrixAt(i, m4);
    col.copy(base).lerp(hi, R() * 0.8);
    mesh.setColorAt(i, col);
  };

  // Solid tiles first: these are the ones you cannot walk through, so they
  // sit exactly where the sim says, and overlap into ridges.
  const cells = [];
  for (let j = 0; j < map.h; j++) {
    for (let i = 0; i < map.w; i++) {
      if (map.tiles[j * map.w + i] === 1) cells.push([(i + 0.5) * map.cell - cx, (j + 0.5) * map.cell - cz]);
    }
  }
  if (cells.length) {
    let g;
    let mat;
    if (cfg.platform) {
      g = new THREE.BoxGeometry(1.5, 1.2, 1.5);
      mat = lampify(new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.5 }), lamps);
    } else if (isIce) {
      g = displacedRock(1, 3, 1.25);
      mat = lampify(gritRock(new THREE.MeshStandardMaterial({ roughness: 0.25, flatShading: true, metalness: 0.08, emissive: 0x0c2334, emissiveIntensity: 1 }), grit, 0.45), lamps);
    } else {
      g = displacedRock(1, 3, 0.8);
      mat = lampify(gritRock(new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: false }), grit), lamps);
    }
    const m = new THREE.InstancedMesh(g, mat, cells.length);
    cells.forEach(([x, z], i) => {
      const jx = (R() - 0.5) * 0.8;
      const jz = (R() - 0.5) * 0.8;
      if (cfg.platform) {
        euler.set(0, ((R() * 4) | 0) * 1.5708, 0);
        quat.setFromEuler(euler);
        const sy = 1 + R() * 1.1;
        m4.compose(pos.set(x, sy * 0.6, z), quat, scale.set(1.9, sy, 1.9));
        m.setMatrixAt(i, m4);
        col.copy(base).lerp(hi, R());
        m.setColorAt(i, col);
      } else {
        const s = map.cell * (0.42 + R() * 0.2);
        if (isIce) {
          // Pressure ridges: long tilted slabs that run with the terrain, not spikes.
          const along = fbm(x * 0.03, 3, z * 0.03, 2, 91) * Math.PI * 3;
          euler.set((R() - 0.5) * 0.9, along + (R() - 0.5) * 0.6, (R() - 0.5) * 0.7);
          quat.setFromEuler(euler);
          const sy = s * (0.55 + R() * 0.7);
          pos.set(x + jx, heightAt(x + jx, z + jz) + sy * 0.2, z + jz);
          m4.compose(pos, quat, scale.set(s * (1.7 + R()), sy, s * (0.55 + R() * 0.3)));
          m.setMatrixAt(i, m4);
          col.copy(base).lerp(hi, R() * 0.8);
          m.setColorAt(i, col);
        } else place(m, i, x + jx, z + jz, s, s * (0.72 + R() * 0.5));
      }
    });
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    out.push(m);
    if (!cfg.platform) out.lod = makeRockLOD(m, cells.length, mat, low);
    if (out.lod) out.push(out.lod.mesh);
  }
  if (cfg.platform) return out;

  // Scatter: small, no collision, lots of them. Kept off the things people
  // need to read: the base and the science.
  const avoid = (x, z, r) => {
    if (map.lander && Math.hypot(x + cx - map.lander.x, z + cz - map.lander.z) < 12 + r) return true;
    for (const s of keep) if (Math.hypot(x + cx - s.x, z + cz - s.z) < 4 + r) return true;
    return false;
  };
  const nBig = low ? 60 : 150;
  const big = new THREE.InstancedMesh(displacedRock(1, 5, 0.75), lampify(gritRock(new THREE.MeshStandardMaterial({ roughness: isIce ? 0.22 : 0.96, flatShading: true, metalness: 0 }), grit), lamps), nBig);
  for (let i = 0; i < nBig; i++) {
    let x;
    let z;
    let s;
    let tries = 0;
    do {
      x = (R() - 0.5) * (W + 40) * 2;
      z = (R() - 0.5) * (W + 40) * 2;
      s = 0.22 + R() * R() * 1.1;
    } while (avoid(x, z, s) && tries++ < 8);
    place(big, i, x, z, s, s * (isIce ? 0.8 : 0.85));
  }
  big.castShadow = true;
  big.receiveShadow = true;
  big.frustumCulled = false;
  out.push(big);

  const nSmall = low ? 160 : 500;
  const small = new THREE.InstancedMesh(displacedRock(0, 9, 0.7), lampify(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), lamps), nSmall);
  for (let i = 0; i < nSmall; i++) {
    const x = (R() - 0.5) * (W + 40) * 2;
    const z = (R() - 0.5) * (W + 40) * 2;
    place(small, i, x, z, 0.05 + R() * 0.25, 0.08 + R() * 0.2);
  }
  small.receiveShadow = true;
  small.frustumCulled = false;
  out.push(small);
  return out;
}

// Close up, the nearest boulders swap to a dense smooth mesh; the distant set
// stays cheap. Near ones in the cheap mesh are scaled to nothing, so the two
// never show at once.
function makeRockLOD(far, count, mat, low) {
  const CAP = low ? 36 : 90;
  const nearGeo = displacedRock(low ? 2 : 3, 3, 0.8);
  const near = new THREE.InstancedMesh(nearGeo, mat, CAP);
  near.castShadow = true;
  near.receiveShadow = true;
  near.frustumCulled = false;
  near.count = 0;
  const saved = Float32Array.from(far.instanceMatrix.array);
  const col = far.instanceColor ? Float32Array.from(far.instanceColor.array) : null;
  const m4 = new THREE.Matrix4();
  const c = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let lastX = 1e9;
  let lastZ = 1e9;
  let current = [];
  return {
    mesh: near,
    update(x, z) {
      if (Math.hypot(x - lastX, z - lastZ) < 2.5) return;
      lastX = x;
      lastZ = z;
      const close = [];
      for (let i = 0; i < count; i++) {
        const dx = saved[i * 16 + 12] - x;
        const dz = saved[i * 16 + 14] - z;
        const d = dx * dx + dz * dz;
        if (d < 34 * 34) close.push([d, i]);
      }
      close.sort((a, b) => a[0] - b[0]);
      const list = close.slice(0, CAP).map((p) => p[1]);
      // Restore the ones that left the near set.
      for (const i of current) {
        if (list.indexOf(i) < 0) {
          m4.fromArray(saved, i * 16);
          far.setMatrixAt(i, m4);
        }
      }
      list.forEach((i, k) => {
        m4.fromArray(saved, i * 16);
        near.setMatrixAt(k, m4);
        if (col) {
          c.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
          near.setColorAt(k, c);
        }
        far.setMatrixAt(i, zero);
      });
      near.count = list.length;
      near.instanceMatrix.needsUpdate = true;
      if (near.instanceColor) near.instanceColor.needsUpdate = true;
      far.instanceMatrix.needsUpdate = true;
      current = list;
    },
  };
}

// ---------- What the sim's tiles mean to the ground shader ----------
function tileMask(map) {
  const data = new Uint8Array(map.w * map.h * 4);
  for (let j = 0; j < map.h; j++) {
    for (let i = 0; i < map.w; i++) {
      const t = map.tiles[j * map.w + i];
      const k = (i + j * map.w) * 4;
      data[k] = t === 4 ? 255 : 0;
      data[k + 1] = t === 2 ? 255 : 0;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, map.w, map.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

function deckGeometry(map, cx, cz) {
  const pos = [];
  const idx = [];
  const c = map.cell;
  for (let j = 0; j < map.h; j++) {
    for (let i = 0; i < map.w; i++) {
      if (map.tiles[j * map.w + i] === 3) continue;
      const x0 = i * c - cx;
      const z0 = j * c - cz;
      const n = pos.length / 3;
      pos.push(x0, 0, z0, x0 + c, 0, z0, x0 + c, 0, z0 + c, x0, 0, z0 + c);
      idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- Venus: gantries, gasbags and the sea of cloud below ----------
function buildVenusRig(group, cfg, map, cx, cz, W, R, lamps, low, groundU) {
  // Where the deck ends: every open cell side next to the void.
  const edgeMat = lampify(new THREE.MeshStandardMaterial({ color: 0x5a5d62, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide }), lamps);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffb060, toneMapped: false });
  const c = map.cell;
  const isVoid = (i, j) => i < 0 || j < 0 || i >= map.w || j >= map.h || map.tiles[j * map.w + i] === 3;
  const edges = [];
  for (let j = 0; j < map.h; j++) {
    for (let i = 0; i < map.w; i++) {
      if (isVoid(i, j)) continue;
      const x0 = i * c - cx;
      const z0 = j * c - cz;
      if (isVoid(i, j - 1)) edges.push([x0, z0, x0 + c, z0]);
      if (isVoid(i, j + 1)) edges.push([x0 + c, z0 + c, x0, z0 + c]);
      if (isVoid(i - 1, j)) edges.push([x0, z0 + c, x0, z0]);
      if (isVoid(i + 1, j)) edges.push([x0 + c, z0, x0 + c, z0 + c]);
    }
  }
  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6);
  const posts = new THREE.InstancedMesh(postGeo, edgeMat, Math.max(1, edges.length));
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), glowMat, Math.max(1, edges.length));
  const m4 = new THREE.Matrix4();
  let pi = 0;
  let li = 0;
  const sv = [];
  edges.forEach(([ax, az, bx, bz], k) => {
    m4.makeTranslation(ax, 0.55, az);
    posts.setMatrixAt(pi++, m4);
    if (k % 3 === 0) {
      m4.makeTranslation(ax, 1.12, az);
      lights.setMatrixAt(li++, m4);
    }
    const h = 2.6;
    sv.push(ax, 0, az, bx, 0, bz, bx, -h, bz, ax, 0, az, bx, -h, bz, ax, -h, az);
  });
  posts.count = pi;
  lights.count = li;
  posts.castShadow = true;
  posts.frustumCulled = false;
  lights.frustumCulled = false;
  group.add(posts);
  group.add(lights);
  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
  skirtGeo.computeVertexNormals();
  const skirt = new THREE.Mesh(skirtGeo, edgeMat);
  group.add(skirt);
  const r = W;

  // Girder lattice below the deck, seen past the rim.
  const girderGeo = new THREE.BoxGeometry(0.4, 0.4, 1);
  const nGird = low ? 40 : 90;
  const gird = new THREE.InstancedMesh(girderGeo, edgeMat, nGird);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 0, 1);
  const dir = new THREE.Vector3();
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  for (let i = 0; i < nGird; i++) {
    const a = R() * 6.28;
    const rA = r * (0.7 + R() * 0.28);
    const rB = r * (0.5 + R() * 0.5);
    pa.set(Math.cos(a) * rA, -2.6, Math.sin(a) * rA);
    pb.set(Math.cos(a + 0.4) * rB, -8 - R() * 8, Math.sin(a + 0.4) * rB);
    dir.copy(pb).sub(pa);
    const len = dir.length();
    dir.normalize();
    q.setFromUnitVectors(up, dir);
    m4.compose(pa.clone().addScaledVector(dir, len / 2), q, new THREE.Vector3(1, 1, len));
    gird.setMatrixAt(i, m4);
  }
  gird.frustumCulled = false;
  group.add(gird);

  // The balloons holding all this up, below the deck edge.
  const bagMat = lampify(new THREE.MeshStandardMaterial({ color: 0xd4c4a4, roughness: 0.42, metalness: 0.05, side: THREE.FrontSide }), lamps);
  const bagGeo = new THREE.SphereGeometry(1, low ? 18 : 32, low ? 14 : 22);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28 + 0.4;
    const bag = new THREE.Mesh(bagGeo, bagMat);
    const rr = r * 0.95;
    bag.position.set(Math.cos(a) * rr, -21 - R() * 5, Math.sin(a) * rr);
    bag.scale.set(11, 7.5, 11);
    bag.castShadow = false;
    group.add(bag);
  }

  // Cloud sea: one big animated plane, far under the deck.
  const cloudU = {
    uTime: { value: 0 },
    uDetail: { value: groundU.uDetail.value },
    uNight: { value: 0 },
    uCam: { value: new THREE.Vector2(0, 0) },
  };
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: cloudU,
    depthWrite: true,
    vertexShader: /* glsl */ `
      ${LOG_V_PARS}
      varying vec2 vXZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vXZ = wp.xz;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        ${LOG_V}
      }`,
    fragmentShader: /* glsl */ `
      ${LOG_F_PARS}
      uniform float uTime;
      uniform sampler2D uDetail;
      uniform float uNight;
      varying vec2 vXZ;
      void main() {
        ${LOG_F}
        vec2 p = vXZ;
        float t = uTime;
        float a = texture2D(uDetail, p * 0.0055 + vec2(t * 0.002, 0.0)).r;
        float b = texture2D(uDetail, p * 0.016 + vec2(-t * 0.005, t * 0.002) + a * 0.12).r;
        float c = texture2D(uDetail, p * 0.05 + vec2(t * 0.012, -t * 0.006) + b * 0.08).r;
        float n = a * 0.6 + b * 0.33 + c * 0.14;
        float folds = smoothstep(0.34, 0.72, n);
        vec3 deep = vec3(0.62, 0.33, 0.09);
        vec3 tops = vec3(1.6, 1.0, 0.44);
        vec3 col = mix(deep, tops, folds);
        col *= mix(1.0, 0.55, uNight);
        col += vec3(1.5, 0.7, 0.15) * pow(folds, 3.0) * 0.5 * (1.0 - uNight * 0.6);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), cloudMat);
  cloud.position.y = -34;
  cloud.frustumCulled = false;
  group.add(cloud);

  return {
    update(t, night) {
      cloudU.uTime.value = t;
      cloudU.uNight.value = night;
    },
  };
}

// ---------- The sky: a strip across the top of the screen ----------
// The camera looks down, so the sky is a matte standing at the far edge of the
// ground in the frame: it hides whatever is beyond, and shows the horizon, the
// stars, the planet overhead. It stays locked to the camera.
function buildSky(cfg, grit, cx, cz) {
  const s = cfg.sky;
  const uniforms = {
    uZenith: { value: new THREE.Vector3(...s.zenith) },
    uHorizon: { value: new THREE.Vector3(...s.horizon) },
    uNightZenith: { value: new THREE.Vector3(...s.nightZenith) },
    uNightHorizon: { value: new THREE.Vector3(...s.nightHorizon) },
    uRidge: { value: new THREE.Vector3(...s.ridge) },
    uRidgeNear: { value: new THREE.Vector3(...s.ridgeNear) },
    uNight: { value: 0 },
    uStorm: { value: 0 },
    uStars: { value: s.stars || 0 },
    uTime: { value: 0 },
    uAspect: { value: 1.6 },
    uCamX: { value: 0 },
    uHorizonY: { value: 1 - 2 * s.band },
    uPlanetOn: { value: cfg.planet ? 1 : 0 },
    uPlanet: { value: new THREE.Vector3(cfg.planet ? cfg.planet.x : 0, cfg.planet ? cfg.planet.y : 0, cfg.planet ? cfg.planet.r : 0) },
    uPlanetTex: { value: null },
    uPlanetSun: { value: new THREE.Vector3(...(cfg.planet ? cfg.planet.sun : [0, 0, 1])) },
    uPlanetAtm: { value: new THREE.Vector3(...(cfg.planet ? cfg.planet.atmosphere : [0, 0, 0])) },
    uPlanetGain: { value: cfg.planet ? cfg.planet.gain : 1 },
    uSunDisc: { value: new THREE.Vector4(cfg.sunDisc ? cfg.sunDisc.x : 0, cfg.sunDisc ? cfg.sunDisc.y : 0, cfg.sunDisc ? cfg.sunDisc.r : 0, cfg.sunDisc && cfg.sunDisc.hazy ? 1 : 0) },
    uClouds: { value: s.clouds || 0 },
    uDetail: { value: grit },
    uFlash: { value: 0 },
    uH: { value: 100 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: true, // hides anything further away, rings and decals included
    vertexShader: /* glsl */ `
      ${LOG_V_PARS}
      varying vec4 vClip;
      varying float vLocal;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        ${LOG_V}
        vClip = gl_Position;
        vLocal = uv.y;
      }`,
    fragmentShader: /* glsl */ `
      ${LOG_F_PARS}
      uniform vec3 uZenith, uHorizon, uNightZenith, uNightHorizon, uRidge, uRidgeNear;
      uniform float uNight, uStorm, uStars, uTime, uAspect, uCamX, uHorizonY, uPlanetOn, uPlanetGain, uClouds, uFlash, uH;
      uniform vec3 uPlanet, uPlanetSun, uPlanetAtm;
      uniform vec4 uSunDisc;
      uniform sampler2D uPlanetTex, uDetail;
      varying vec4 vClip;
      varying float vLocal;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ridge(float x, float seed) {
        float y = 0.0, a = 1.0, f = 1.0;
        for (int i = 0; i < 4; i++) {
          float xf = x * f + seed;
          float ix = floor(xf), fx = fract(xf);
          float u = fx * fx * (3.0 - 2.0 * fx);
          y += a * mix(hash(vec2(ix, seed)), hash(vec2(ix + 1.0, seed)), u);
          a *= 0.5; f *= 2.13;
        }
        return y / 1.875;
      }
      void main() {
        ${LOG_F}
        vec2 ndc = vClip.xy / vClip.w;
        vec2 s = vec2(ndc.x * uAspect, ndc.y);
        float t = clamp((ndc.y - uHorizonY) / max(1.0 - uHorizonY, 0.05), 0.0, 1.0);
        vec3 zenith = mix(uZenith, uNightZenith, uNight);
        vec3 horizon = mix(uHorizon, uNightHorizon, uNight);
        vec3 col = mix(horizon, zenith, pow(t, 0.7));

        // Stars.
        if (uStars > 0.0) {
          vec2 sp = s * 46.0 + vec2(uCamX * 0.012, 0.0);
          vec2 cell = floor(sp);
          float h = hash(cell);
          if (h > 0.94) {
            vec2 f = fract(sp) - 0.5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.7;
            float tw = 0.75 + 0.25 * sin(uTime * (1.6 + h * 5.0) + h * 40.0);
            float bright = (1.0 - smoothstep(0.02, 0.1 + (h - 0.94) * 2.0, length(f)));
            col += vec3(0.9, 0.95, 1.1) * bright * bright * uStars * tw * (1.0 - uStorm * 0.8);
          }
        }

        // The hazy sun (Mars, Venus): a blue halo on Mars, as Curiosity saw.
        if (uSunDisc.z > 0.0) {
          float d = length(s - uSunDisc.xy);
          float disc = (1.0 - smoothstep(uSunDisc.z * 0.82, uSunDisc.z, d));
          float glow = exp(-d * (uSunDisc.w > 0.5 ? 2.4 : 5.5));
          vec3 halo = uSunDisc.w > 0.5 ? vec3(1.2, 0.72, 0.28) : vec3(0.42, 0.62, 0.95);
          float dayK = 1.0 - uNight;
          col += halo * glow * (uSunDisc.w > 0.5 ? 0.7 : 0.35) * dayK;
          col = mix(col, vec3(1.6, 1.3, 0.95), disc * dayK * (uSunDisc.w > 0.5 ? 0.4 : 0.96));
        }

        // The planet overhead: real map on a shaded sphere.
        if (uPlanetOn > 0.5) {
          vec2 q = (s - uPlanet.xy) / uPlanet.z;
          float r2 = dot(q, q);
          if (r2 < 1.0) {
            vec3 n = vec3(q, sqrt(1.0 - r2));
            float lit = max(0.0, dot(n, normalize(uPlanetSun)));
            vec2 ll = vec2(atan(n.x, n.z) / 6.2831853 + 0.5 + uTime * 0.002, asin(clamp(n.y, -1.0, 1.0)) / 3.14159265 + 0.5);
            vec3 tex = texture2D(uPlanetTex, ll, -1.0).rgb;
            vec3 dayCol = tex * uPlanetGain * (0.03 + 1.25 * lit);
            float rim = pow(1.0 - n.z, 3.0);
            dayCol += uPlanetAtm * rim * 0.9 * (0.3 + lit);
            float edge = (1.0 - smoothstep(0.985, 1.0, r2));
            col = mix(col, dayCol, edge);
          } else {
            float h = sqrt(r2) - 1.0;
            col += uPlanetAtm * exp(-h * 13.0) * 0.3 * (0.4 + 0.6 * clamp(dot(q, uPlanetSun.xy) * 0.6 + 0.6, 0.0, 1.0));
          }
        }

        // Venus: cloud walls rolling at the edge of the sky.
        if (uClouds > 0.5) {
          float a = texture2D(uDetail, vec2(ndc.x * 0.8 + uTime * 0.003, t * 0.5 + uTime * 0.0012)).r;
          float b = texture2D(uDetail, vec2(ndc.x * 2.2 - uTime * 0.007, t * 1.2)).r;
          float n = a * 0.7 + b * 0.35;
          float wall = smoothstep(0.42, 0.78, n) * (1.0 - t * 0.9);
          col = mix(col, vec3(1.0, 0.56, 0.17), wall * 0.42);
          col = mix(col, vec3(1.15, 0.8, 0.36) * 0.9, smoothstep(0.62, 0.95, n) * 0.4);
        }

        // Far ridges with parallax against the camera. No planet in front.
        float px = uCamX * 0.0014 + ndc.x * uAspect * 0.6;
        float far = uHorizonY + 0.03 + 0.05 * ridge(px * 1.2, 3.0);
        float near = uHorizonY + 0.005 + 0.045 * ridge(px * 2.9 + uCamX * 0.002, 11.0);
        float aa = fwidth(ndc.y) * 1.2;
        float fk = (1.0 - smoothstep(far - aa, far + aa, ndc.y));
        float nk = (1.0 - smoothstep(near - aa, near + aa, ndc.y));
        vec3 rf = mix(uRidge, uRidge * vec3(0.3, 0.3, 0.45), uNight);
        vec3 rn = mix(uRidgeNear, uRidgeNear * vec3(0.24, 0.26, 0.4), uNight);
        col = mix(col, rf, fk);
        col = mix(col, rn, nk);

        // A storm swallows the sky.
        col = mix(col, horizon * 1.2, uStorm * 0.6);
        col += uFlash * vec3(1.0, 0.9, 0.7) * 0.6;

        gl_FragColor = vec4(col, smoothstep(0.0, 2.2, vLocal * uH));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  mesh.userData.noAO = true;

  if (cfg.planet && SMD.assets) {
    SMD.assets
      .texture(cfg.planet.tex)
      .then((t) => {
        uniforms.uPlanetTex.value = t;
      })
      .catch(() => {
        uniforms.uPlanetOn.value = 0;
      });
  } else uniforms.uPlanetOn.value = 0;

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const camPos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const band = s.band;
  return {
    mesh,
    uniforms,
    update(t, night, storm, cam, aspect) {
      uniforms.uTime.value = t;
      uniforms.uNight.value = night;
      uniforms.uStorm.value = storm;
      uniforms.uAspect.value = aspect;
      cam.getWorldPosition(camPos);
      uniforms.uCamX.value = camPos.x;
      // The matte stands where the band's bottom edge meets the ground.
      ndc.set(0, 1 - 2 * band);
      ray.setFromCamera(ndc, cam);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      const dist = camPos.distanceTo(hit);
      // Tall enough for the top of the frame, wide enough for any screen.
      const height = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * 3.2 + 12;
      const width = height * 4 * aspect;
      mesh.scale.set(width, height, 1);
      dir.subVectors(hit, camPos).setY(0).normalize();
      mesh.position.copy(hit).addScaledVector(dir, 0.15);
      mesh.position.x -= cx;
      mesh.position.z -= cz;
      mesh.position.y = height / 2 - 0.45;
      uniforms.uH.value = height;
      mesh.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

// ---------- Dust haze: a slow, soft layer that catches the light ----------
function buildHaze(cfg, grit, size) {
  if (!cfg.haze) return null;
  const dust = cfg.dust;
  const uniforms = {
    uDetail: { value: grit },
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(dust[0], dust[1], dust[2]) },
    uK: { value: cfg.haze },
    uNight: { value: 0 },
    uStorm: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${LOG_V_PARS}
      varying vec2 vXZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vXZ = wp.xz;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        ${LOG_V}
      }`,
    fragmentShader: /* glsl */ `
      ${LOG_F_PARS}
      uniform sampler2D uDetail;
      uniform float uTime, uK, uNight, uStorm;
      uniform vec3 uColor;
      varying vec2 vXZ;
      void main() {
        ${LOG_F}
        vec2 p = vXZ;
        float t = uTime;
        float a = texture2D(uDetail, p * 0.018 + vec2(t * 0.022, t * 0.006)).r;
        float b = texture2D(uDetail, p * 0.05 + vec2(-t * 0.018, t * 0.01) + a * 0.1).r;
        float n = smoothstep(0.36, 0.82, a * 0.7 + b * 0.5);
        float k = uK * (1.0 - uNight * 0.65) + uStorm * 0.55;
        vec3 c = uColor * (0.6 + 1.2 * n);
        c = mix(c, c * vec3(0.3, 0.33, 0.5), uNight);
        gl_FragColor = vec4(c, n * k);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.15, size * 1.15).rotateX(-Math.PI / 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -3; // before the sky matte, so the sky stays clean
  mesh.position.y = 1.15;
  mesh.userData.noAO = true;
  return {
    mesh,
    update(t, night, storm) {
      uniforms.uTime.value = t;
      uniforms.uNight.value = night;
      uniforms.uStorm.value = storm;
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}
