// Shared pieces for the pad set (js/ll/sets/pad.js): height fog patched into
// standard materials, world-space box UVs for merged geometry, tileable noise
// and the procedural textures (wet concrete, foam, paint, steel, frost).
import { THREE, canvasTex, rng, clamp, Builder } from './common.js';

// ---------- Height fog ----------
// Thick at the ground, thin up high: the arm at 90 m looks down on a sea of
// fog, the rocket's nose stands clear of it. Every pad material shares these
// uniforms (pad.js updates them once a frame).
//   params: x density at the base (per m), y falloff (per m), z base height,
//           w density everywhere (thin haze)
export const FOG = {
  params: { value: new THREE.Vector4(0.011, 0.05, 0, 0.0016) },
  glowDir: { value: new THREE.Vector3(0, 0.15, -1).normalize() },
  glowColor: { value: new THREE.Color(0x24303c) },
  // Lamps that light the haze around them (in-scattering): xyz, strength.
  n: 8,
  lights: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, -1000, 0, 0)) },
  lightCols: { value: Array.from({ length: 8 }, () => new THREE.Color(0, 0, 0)) },
};

// GLSL: light scattered toward the eye by the haze along a ray (closed form
// for point lights with 1/d^2 falloff, clamped near the lamp).
export const SCATTER_GLSL = /* glsl */ `
  uniform vec4 hfL[HF_N];
  uniform vec3 hfLC[HF_N];
  vec3 hfScatter(vec3 ro, vec3 rd, float t) {
    vec3 s = vec3(0.0);
    for (int i = 0; i < HF_N; i++) {
      vec3 q = hfL[i].xyz - ro;
      float b = dot(q, rd);
      float h = sqrt(max(dot(q, q) - b * b, 1.0));
      float I = (atan((t - b) / h) - atan(-b / h)) / h;
      // A tight core (halo) on top of the broad glow.
      float e = t - b;
      float J = (e / sqrt(h * h + e * e) + b / sqrt(h * h + b * b)) / (h * h);
      s += hfLC[i] * (hfL[i].w * (0.35 * I + 3.0 * J));
    }
    return s;
  }
`;
export function scatterUniforms(u) {
  u.hfL = FOG.lights;
  u.hfLC = FOG.lightCols;
  return u;
}

const FOG_VERT_PARS = 'varying vec3 vHFWorld;\n';
const FOG_VERT = /* glsl */ `
#ifdef USE_FOG
  vec4 hfW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    hfW = instanceMatrix * hfW;
  #endif
  vHFWorld = (modelMatrix * hfW).xyz;
#endif
`;
const FOG_FRAG_PARS = 'varying vec3 vHFWorld;\nuniform vec4 hfParams;\nuniform vec3 hfGlowDir;\nuniform vec3 hfGlowColor;\n';
export const FOG_FRAG = /* glsl */ `
#ifdef USE_FOG
  {
    vec3 hfRd = vHFWorld - cameraPosition;
    float hfDist = length(hfRd);
    float hfK = hfParams.y * hfRd.y;
    float hfRatio = abs(hfK) > 1e-4 ? (1.0 - exp(-hfK)) / hfK : 1.0;
    float hfInt = hfParams.x * exp(-hfParams.y * (cameraPosition.y - hfParams.z)) * hfDist * hfRatio + hfParams.w * hfDist;
    float hfF = 1.0 - exp(-hfInt);
    vec3 hfC = fogColor + hfGlowColor * pow(max(dot(hfRd / max(hfDist, 1e-3), hfGlowDir), 0.0), 6.0);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, hfC, hfF) + hfScatter(cameraPosition, hfRd / max(hfDist, 1e-3), hfDist);
  }
#endif
`;

// Patch a built-in material (Standard, Basic, Lambert, Physical) to use the
// height fog instead of three's distance fog.
export function fogify(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.hfParams = FOG.params;
    sh.uniforms.hfGlowDir = FOG.glowDir;
    sh.uniforms.hfGlowColor = FOG.glowColor;
    scatterUniforms(sh.uniforms);
    sh.vertexShader = FOG_VERT_PARS + sh.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n' + FOG_VERT);
    sh.fragmentShader = '#define HF_N ' + FOG.n + '\n' + FOG_FRAG_PARS + SCATTER_GLSL + sh.fragmentShader.replace('#include <fog_fragment>', FOG_FRAG);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => 'padfog' + FOG.n + '|' + key();
  return mat;
}

export function std(o = {}) {
  return fogify(new THREE.MeshStandardMaterial(o));
}
export function basic(o = {}) {
  return fogify(new THREE.MeshBasicMaterial(o));
}
// An HDR emissive colour for lamps (bloom picks it up): fog-free so lamps glow
// through the haze.
export function lamp(hex, k = 6) {
  const c = new THREE.Color(hex).multiplyScalar(k);
  const m = new THREE.MeshBasicMaterial({ color: c, fog: false });
  m.userData.base = c.clone();
  return m;
}

// ---------- Virtual materials ----------
// Many looks share one real material through vertex colours: the pad has
// dozens of paints and lamps but only a handful of draw calls.
//   M.yellow = virt(M.paintR, 0xd9a514); builder.add(M.yellow, geo)
export function virt(real, color) {
  return { isVirtual: true, real, color: color && color.isColor ? color.clone() : new THREE.Color(color) };
}
export const realOf = (m) => (m && m.isVirtual ? m.real : m);
export class PadBuilder extends Builder {
  add(mat, geo, o = {}) {
    if (mat && mat.isVirtual) return super.add(mat.real, geo, Object.assign({}, o, { color: mat.color }));
    return super.add(mat, geo, o);
  }
}

// ---------- World-space UVs ----------
// Box mapping by the dominant normal: textures keep one scale (metres per
// repeat) across every merged piece, whatever its size.
export function boxUV(geo, scale = 1, offset = [0, 0]) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    let u;
    let v;
    if (ay >= ax && ay >= az) (u = p.getX(i)), (v = p.getZ(i));
    else if (ax >= az) (u = p.getZ(i)), (v = p.getY(i));
    else (u = p.getX(i)), (v = p.getY(i));
    uv[i * 2] = u / scale + offset[0];
    uv[i * 2 + 1] = v / scale + offset[1];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// ---------- Noise ----------
// Tileable value noise on an n x n lattice (wraps at `period`).
export function noise2(seed = 1) {
  const R = rng(seed);
  const N = 256;
  const perm = new Uint8Array(N * 2);
  const val = new Float32Array(N);
  for (let i = 0; i < N; i++) (perm[i] = i), (val[i] = R());
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const at = (x, y, P) => val[perm[(perm[((x % P) + P) % P] + (((y % P) + P) % P)) & 255]];
  return (x, y, P = 256) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi, P);
    const b = at(xi + 1, yi, P);
    const c = at(xi, yi + 1, P);
    const d = at(xi + 1, yi + 1, P);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

// Fractal noise in 0..1, tileable over the texture when `cells` divides it.
export function fbm(n, x, y, cells, oct = 4) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    s += a * n(x * f * cells, y * f * cells, cells * f);
    norm += a;
    a *= 0.5;
    f *= 2;
  }
  return s / norm;
}

// Fill a canvas pixel by pixel: fn(u, v) -> [r, g, b, a?] (0..255).
export function pixelTex(w, h, fn, o = {}) {
  return canvasTex(
    w,
    h,
    (g) => {
      const img = g.createImageData(w, h);
      const d = img.data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const c = fn(x / w, y / h, x, y);
          const i = (y * w + x) * 4;
          d[i] = c[0];
          d[i + 1] = c[1];
          d[i + 2] = c[2];
          d[i + 3] = c.length > 3 ? c[3] : 255;
        }
      g.putImageData(img, 0, 0);
      if (o.after) o.after(g, w, h);
    },
    o,
  );
}

// A normal map from a height function (tangent space).
export function normalTex(w, h, height, strength = 2, o = {}) {
  const H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = height(x / w, y / h);
  return pixelTex(
    w,
    h,
    (u, v, x, y) => {
      const l = H[y * w + ((x - 1 + w) % w)];
      const r = H[y * w + ((x + 1) % w)];
      const t = H[((y - 1 + h) % h) * w + x];
      const b = H[((y + 1) % h) * w + x];
      let nx = (l - r) * strength;
      let ny = (b - t) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      return [((nx / len) * 0.5 + 0.5) * 255, ((ny / len) * 0.5 + 0.5) * 255, ((nz / len) * 0.5 + 0.5) * 255];
    },
    Object.assign({ srgb: false }, o),
  );
}

const hexRgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// ---------- Textures ----------
// Wet concrete apron: slabs with sawn joints, stains, tyre-dark patches and
// puddles (dark, mirror-smooth in the roughness map). One tile = `metres`.
export function concreteMaps(size = 1024, metres = 24, seed = 7) {
  const n = noise2(seed);
  const n2 = noise2(seed + 11);
  const slab = 6; // metres per slab
  const joints = metres / slab;
  const puddle = (u, v) => {
    const p = fbm(n2, u, v, 3, 4);
    return clamp((p - 0.56) / 0.07, 0, 1);
  };
  const base = hexRgb(0x8d8f8e);
  const dark = hexRgb(0x555a5c);
  const height = (u, v) => {
    const g = fbm(n, u, v, 48, 3);
    const ju = Math.abs(((u * joints) % 1) - 0.5) * 2;
    const jv = Math.abs(((v * joints) % 1) - 0.5) * 2;
    const j = Math.max(ju, jv) > 0.994 ? -0.6 : 0;
    return g * 0.5 + j - puddle(u, v) * 0.4;
  };
  const map = pixelTex(size, size, (u, v) => {
    const g = fbm(n, u, v, 8, 5);
    const fine = fbm(n, u + 0.37, v + 0.11, 96, 2);
    let c = mix3(dark, base, clamp(0.35 + (g - 0.5) * 1.4 + (fine - 0.5) * 0.35, 0, 1));
    const ju = Math.abs(((u * joints) % 1) - 0.5) * 2;
    const jv = Math.abs(((v * joints) % 1) - 0.5) * 2;
    if (Math.max(ju, jv) > 0.993) c = mix3(c, [40, 42, 44], 0.75);
    const stain = clamp((fbm(n2, u + 0.5, v, 6, 3) - 0.58) * 4, 0, 1);
    c = mix3(c, [70, 66, 58], stain * 0.5);
    const p = puddle(u, v);
    c = mix3(c, [34, 38, 42], p * 0.75);
    return c;
  });
  const rough = pixelTex(
    size,
    size,
    (u, v) => {
      const g = fbm(n, u, v, 64, 2);
      const p = puddle(u, v);
      const wet = fbm(n2, u + 0.2, v + 0.7, 5, 3);
      let r = 0.8 + (g - 0.5) * 0.2 - clamp((wet - 0.5) * 2.0, 0, 0.45);
      r = r * (1 - p) + 0.04 * p;
      const x = clamp(r, 0, 1) * 255;
      return [x, x, x];
    },
    { srgb: false },
  );
  const normal = normalTex(size / 2, size / 2, height, 3.5);
  for (const t of [map, rough, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, rough, normal, metres };
}

// Generic grime for painted steel, booster paint, the mount: a light grey
// field with streaks running down (rain) and soft blotches.
export function grimeTex(size = 512, seed = 3, o = {}) {
  const n = noise2(seed);
  const lo = o.lo != null ? o.lo : 150;
  const hi = o.hi != null ? o.hi : 235;
  const t = pixelTex(size, size, (u, v) => {
    const blot = fbm(n, u, v, 4, 4);
    const streak = fbm(n, u * 1, v * 0.06 + 0.3, 24, 3);
    let k = 0.65 + (blot - 0.5) * 0.6 - clamp((streak - 0.55) * 2.2, 0, 0.35);
    k = clamp(k, 0, 1);
    const x = lo + (hi - lo) * k;
    return [x, x, x];
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A bump field (grey, linear) for foam, frost, paint orange-peel.
export function bumpTex(size = 256, cells = 16, seed = 5) {
  const n = noise2(seed);
  const t = pixelTex(
    size,
    size,
    (u, v) => {
      const x = fbm(n, u, v, cells, 3) * 255;
      return [x, x, x];
    },
    { srgb: false },
  );
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Steel deck grating: a bar grid (dark) on a darker void.
export function gratingTex(size = 256) {
  const t = canvasTex(size, size, (g, w, h) => {
    g.fillStyle = '#16191c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5d6266';
    const bars = 16;
    for (let i = 0; i < bars; i++) g.fillRect(0, (i * h) / bars, w, 3);
    g.fillStyle = '#464b4f';
    for (let i = 0; i < bars / 2; i++) g.fillRect((i * w * 2) / bars, 0, 2, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Frost: white crystalline speckle (map) for the cryogenic lines.
export function frostTex(size = 512, seed = 9) {
  const n = noise2(seed);
  const t = pixelTex(size, size, (u, v) => {
    const a = fbm(n, u, v, 12, 4);
    const s = fbm(n, u + 0.3, v + 0.9, 90, 2);
    const k = clamp(0.62 + (a - 0.5) * 0.9 + (s - 0.5) * 0.7, 0, 1);
    return [190 + 60 * k, 198 + 55 * k, 205 + 50 * k];
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// The core stage: orange spray-on foam, weld bands, the ribbed intertank,
// frost patches and frost streaks under the vents. u wraps around, v runs up.
//   H: stage height in metres; intertank [v0, v1] as fractions.
export function coreMaps(H = 65, o = {}) {
  const W = 1024;
  const HH = 2048;
  const n = noise2(21);
  const n2 = noise2(22);
  const it0 = o.intertank ? o.intertank[0] : 0.6;
  const it1 = o.intertank ? o.intertank[1] : 0.69;
  const foamA = hexRgb(0xc2632b);
  const foamB = hexRgb(0x9c4a22);
  const foamC = hexRgb(0xd47a3c);
  const frostC = [222, 232, 240];
  const welds = [0.08, 0.17, 0.27, 0.37, 0.47, 0.55, it0, it1, 0.78, 0.88, 0.955];
  const frostAt = (u, v) => {
    // More frost low on each tank and in streaks under the intertank.
    const patch = fbm(n2, u, v * 4, 6, 4);
    const streak = fbm(n2, u * 3 + 0.2, v * 0.4, 16, 2);
    let f = clamp((patch - 0.58) * 3.2, 0, 1);
    const lowLH2 = v < 0.2 ? (0.2 - v) * 3 : 0;
    const lowLOX = v > it1 && v < it1 + 0.07 ? 0.5 : 0;
    const under = v < it0 && v > it0 - 0.25 ? clamp((streak - 0.6) * 4, 0, 1) * (1 - (it0 - v) / 0.25) : 0;
    f = clamp(f + lowLH2 * 0.6 + lowLOX * clamp(patch * 1.2 - 0.3, 0, 1) + under, 0, 1);
    return f;
  };
  const map = pixelTex(W, HH, (u, vv) => {
    const v = 1 - vv;
    const g = fbm(n, u, v * 2, 24, 5);
    const fine = fbm(n, u + 0.5, v * 2, 160, 2);
    let c = mix3(foamB, foamA, clamp(0.55 + (g - 0.5) * 1.3, 0, 1));
    c = mix3(c, foamC, clamp((fine - 0.55) * 1.5, 0, 0.4));
    // Intertank: darker, vertical stringers.
    if (v > it0 && v < it1) {
      const rib = Math.abs(((u * 180) % 1) - 0.5) * 2;
      c = mix3(c, foamB, 0.45);
      c = mix3(c, [58, 30, 18], rib > 0.82 ? 0.55 : 0);
      c = mix3(c, foamC, rib < 0.2 ? 0.25 : 0);
    }
    for (const w of welds) {
      const d = Math.abs(v - w) * HH;
      if (d < 3) c = mix3(c, [70, 36, 20], (1 - d / 3) * 0.6);
      else if (d < 9) c = mix3(c, foamC, (1 - d / 9) * 0.18);
    }
    const f = frostAt(u, v);
    c = mix3(c, frostC, f * 0.85);
    return c;
  });
  const rough = pixelTex(
    W / 2,
    HH / 2,
    (u, vv) => {
      const v = 1 - vv;
      const f = frostAt(u, v);
      const x = clamp(0.78 + f * 0.15, 0, 1) * 255;
      return [x, x, x];
    },
    { srgb: false },
  );
  map.anisotropy = 8;
  return { map, rough };
}

// White painted shell with panel lines and joints (boosters, upper stack).
//   joints: v fractions for the dark segment joints; seams: count of
//   vertical panel seams around.
export function paintMaps(o = {}) {
  const W = 512;
  const H = o.h || 2048;
  const n = noise2(o.seed || 31);
  const joints = o.joints || [];
  const seams = o.seams || 8;
  const base = hexRgb(o.color || 0xe6e8ea);
  const map = pixelTex(W, H, (u, vv) => {
    const v = 1 - vv;
    const g = fbm(n, u, v * (H / W), 6, 4);
    const streak = fbm(n, u * 2, v * 0.1 + 0.3, 30, 2);
    let c = mix3(base, [168, 172, 176], clamp((0.5 - g) * 0.9 + clamp((streak - 0.6) * 1.5, 0, 0.3), 0, 1));
    for (const j of joints) {
      const d = Math.abs(v - j) * H;
      if (d < 4) c = mix3(c, [40, 42, 46], 0.9);
      else if (d < 10) c = mix3(c, [120, 124, 128], 0.5 * (1 - (d - 4) / 6));
    }
    const s = Math.abs(((u * seams) % 1) - 0.5) * 2;
    if (s > 0.992) c = mix3(c, [120, 124, 130], 0.6);
    return c;
  });
  map.anisotropy = 8;
  return { map };
}

// A sign or label: draw(ctx, w, h) on a canvas, sRGB, mipmapped.
export function signTex(w, h, draw) {
  const t = canvasTex(w, h, draw);
  t.anisotropy = 8;
  return t;
}

export const FONT = "600 {s}px Archivo, 'Arial Narrow', Arial, sans-serif";
export const font = (s, weight = 600) => `${weight} ${s}px Archivo, 'Arial Narrow', Arial, sans-serif`;

// Hazard stripes (yellow/black), for the edges of steps, the cab, the deck.
export function hazardTex() {
  const t = canvasTex(128, 32, (g, w, h) => {
    g.fillStyle = '#e2b416';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#16161a';
    for (let x = -h; x < w + h; x += 32) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 16, h);
      g.lineTo(x + 16 + h, 0);
      g.lineTo(x + h, 0);
      g.closePath();
      g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
