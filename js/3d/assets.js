// Planets (real NASA maps with procedural fallbacks), stars, the Sun, glows.
import { THREE } from './engine.js';
import { texture, peekTexture } from './loader.js';

// Quality profile (SMD.settings): the low tier draws fewer stars, particles
// and sphere segments. Read at creation time, so the next scene follows a change.
function quality() {
  try {
    return globalThis.SMD.settings.profile();
  } catch (e) {
    return { stars: 1, particles: 1, segments: 256 };
  }
}

// ---------- Noise ----------
function hash3(x, y, z, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(seed, 144665)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function vnoise(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const c = (a, b, d) => hash3(xi + a, yi + b, zi + d, seed);
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u;
  const x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u;
  const x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

export function fbm(x, y, z, oct = 5, seed = 1) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, z * f, seed + i * 17);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

const mix = (a, b, t) => a + (b - a) * t;
const mixc = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const sat = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => {
  const t = sat((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function genCanvas(w, h, fn, alpha) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat);
    const sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2;
      const x = cl * Math.cos(lon);
      const z = cl * Math.sin(lon);
      const col = fn(x, sl, z, lat, lon);
      const k = (j * w + i) * 4;
      d[k] = col[0];
      d[k + 1] = col[1];
      d[k + 2] = col[2];
      d[k + 3] = alpha ? col[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const PALETTES = {
  mars(x, y, z, lat) {
    const n = fbm(x * 2.2, y * 2.2, z * 2.2, 6, 3);
    const dark = smooth(0.52, 0.66, fbm(x * 1.3 + 4, y * 1.3, z * 1.3, 4, 9));
    let c = mixc(hex(0xa94a24), hex(0xdc9257), n);
    c = mixc(c, hex(0x5e2918), dark * 0.7);
    const crater = smooth(0.78, 0.86, fbm(x * 9, y * 9, z * 9, 2, 21));
    c = mixc(c, hex(0x7a3418), crater * 0.4);
    const cap = smooth(1.28, 1.42, Math.abs(lat) + 0.08 * fbm(x * 6, y * 6, z * 6, 3, 5));
    return mixc(c, hex(0xf3ece4), cap);
  },
  earth(x, y, z, lat) {
    const n = fbm(x * 1.7, y * 1.7, z * 1.7, 6, 11);
    const land = smooth(0.51, 0.53, n);
    const coast = smooth(0.45, 0.51, n);
    const ocean = mixc(hex(0x0e2f63), hex(0x2a6bb0), coast * 0.8);
    const desert = smooth(0.15, 0.45, 1 - Math.abs(Math.abs(lat) - 0.42) * 3) * fbm(x * 3, y * 3, z * 3, 3, 4);
    let g = mixc(hex(0x3f6b2f), hex(0x6f8a3c), fbm(x * 4, y * 4, z * 4, 3, 2));
    g = mixc(g, hex(0xc2a46b), sat(desert * 1.6));
    let c = mixc(ocean, g, land);
    const ice = smooth(1.12, 1.25, Math.abs(lat) + 0.1 * fbm(x * 5, y * 5, z * 5, 3, 8));
    return mixc(c, hex(0xf2f5f7), ice);
  },
  // Greyscale: used as an alpha map (white = cloud).
  clouds(x, y, z) {
    const n = fbm(x * 3.2 + 7, y * 6, z * 3.2, 6, 31);
    const a = Math.round(smooth(0.55, 0.72, n) * 230);
    return [a, a, a];
  },
  venus(x, y, z, lat) {
    const warp = fbm(x * 2, y * 2, z * 2, 4, 13);
    const band = Math.sin(lat * 9 + warp * 5) * 0.5 + 0.5;
    const n = fbm(x * 3 + warp, y * 8, z * 3, 5, 14);
    return mixc(mixc(hex(0xc9a35a), hex(0xf1dcaa), band * 0.6 + n * 0.4), hex(0xe7c98c), 0.2);
  },
  jupiter(x, y, z, lat, lon) {
    const turb = fbm(x * 4, y * 14, z * 4, 5, 41);
    const b = Math.sin(lat * 14 + turb * 3.2);
    let c = b > 0.2 ? mixc(hex(0xefe2c6), hex(0xd8c39b), turb) : mixc(hex(0xb57a4e), hex(0x8f5634), turb);
    c = mixc(c, hex(0xc98b5a), smooth(0.6, 0.9, fbm(x * 8, y * 20, z * 8, 3, 2)) * 0.4);
    const dl = (lat + 0.38) / 0.07;
    const dlon = Math.atan2(Math.sin(lon - 1.2), Math.cos(lon - 1.2)) / 0.16;
    const spot = sat(1 - (dl * dl + dlon * dlon));
    return mixc(c, hex(0xb4482c), smooth(0, 0.5, spot));
  },
  // The Moon: grey highlands, dark maria (mostly on the near side), craters.
  moon(x, y, z, lat, lon) {
    const n = fbm(x * 3, y * 3, z * 3, 6, 61);
    const near = smooth(-0.2, 0.8, Math.cos(lon - Math.PI) * Math.cos(lat));
    const mare = smooth(0.5, 0.58, fbm(x * 1.6 + 3, y * 1.6, z * 1.6, 4, 62) + near * 0.12);
    let c = mixc(hex(0x8d8a84), hex(0xb9b5ad), n);
    c = mixc(c, hex(0x55524e), mare * 0.8);
    const cr = fbm(x * 14, y * 14, z * 14, 2, 63);
    c = mixc(c, hex(0x3f3d3a), smooth(0.7, 0.78, cr) * 0.35);
    c = mixc(c, hex(0xd8d4cb), smooth(0.8, 0.84, cr) * 0.5);
    return c;
  },
  europa(x, y, z) {
    const base = mixc(hex(0xe9e2cf), hex(0xcdb894), fbm(x * 2, y * 2, z * 2, 5, 51) * 0.8);
    const r1 = Math.abs(fbm(x * 3, y * 3, z * 3, 4, 52) - 0.5);
    const r2 = Math.abs(fbm(x * 5 + 2, y * 5, z * 5, 4, 53) - 0.5);
    const crack = Math.max(1 - smooth(0.0, 0.018, r1), 1 - smooth(0.0, 0.012, r2));
    return mixc(base, hex(0x8b5636), crack * 0.85);
  },
};

const texCache = {};
export function planetTexture(kind, w = 1024) {
  const key = kind + w;
  if (texCache[key]) return texCache[key];
  const canvas = genCanvas(w, w / 2, PALETTES[kind], false);
  const t = new THREE.CanvasTexture(canvas);
  if (kind !== 'clouds') t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.keep = true;
  return (texCache[key] = t);
}

// ---------- Planets with real NASA maps ----------
// Each planet starts with a quick procedural map so the scene shows at once,
// then swaps to the real NASA map when it has loaded. If loading fails the
// full-resolution procedural map stays.
// atmo: color (day side), sunset (terminator tint), scale (halo radius / R),
// gain (halo strength), rim (strength of the haze over the disk).
const KINDS = {
  earth: { map: 'earth-day', night: 'earth-night', clouds: 'earth-clouds', roughness: 0.92, atmo: { color: 0x4f9dff, sunset: 0xff9a3c, scale: 1.035, gain: 1.35, rim: 1.1 } },
  moon: { map: 'moon', bump: 'moon-height', roughness: 1 },
  mars: { map: 'mars', roughness: 0.96, atmo: { color: 0xe39a63, sunset: 0x8fb4e6, scale: 1.025, gain: 0.75, rim: 0.55 } },
  venus: { map: 'venus-radar', roughness: 0.95, atmo: { color: 0xf6d89c, sunset: 0xff9c4a, scale: 1.05, gain: 1.4, rim: 1.25 } },
  jupiter: { map: 'jupiter', roughness: 0.9, atmo: { color: 0xeadbbd, sunset: 0xd99a5f, scale: 1.02, gain: 0.35, rim: 0.4 } },
  europa: { map: 'europa', roughness: 0.8 },
};

// Point on a planet made by makePlanet, in its local frame: lat, lon in degrees
// (east positive), matching the NASA equirectangular maps.
export function latLonToVec3(lat, lon, radius = 1, out = new THREE.Vector3()) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return out.set(Math.cos(la) * Math.cos(lo) * radius, Math.sin(la) * radius, -Math.cos(la) * Math.sin(lo) * radius);
}

// The brightest directional (or point) light in a scene is taken as the Sun.
const sunCache = new WeakMap();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
function findSun(scene) {
  const e = sunCache.get(scene);
  if (e && e.light && e.light.parent) return e.light;
  if (e && !e.light && ++e.misses % 60) return null;
  let best = null;
  scene.traverse((o) => {
    if ((o.isDirectionalLight || o.isPointLight) && o.visible && (!best || o.intensity > best.intensity)) best = o;
  });
  sunCache.set(scene, { light: best, misses: 0 });
  return best;
}

// Shared per-planet uniforms, refreshed just before any of its meshes draws.
function sunUpdater(U, group, haloRadius) {
  return function (renderer, scene, camera) {
    const sun = findSun(scene);
    group.getWorldPosition(_b);
    if (sun) {
      sun.getWorldPosition(_a);
      if (sun.isDirectionalLight) _a.sub(sun.target.getWorldPosition(_c));
      else _a.sub(_b);
      if (_a.lengthSq() > 0) U.uSunW.value.copy(_a.normalize());
    } else U.uSunW.value.copy(camera.getWorldPosition(_a).sub(_b).normalize());
    U.uSunV.value.copy(U.uSunW.value).transformDirection(camera.matrixWorldInverse);
    if (haloRadius) {
      // Fade the halo out when the camera flies inside it (aerobraking, low orbit).
      const s = group.matrixWorld.getMaxScaleOnAxis();
      const d = camera.getWorldPosition(_a).distanceTo(_b) / (haloRadius * s);
      U.uFade.value = THREE.MathUtils.smoothstep(d, 1.0, 1.25);
    }
  };
}

const ATMO_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN;
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;

// Fresnel atmosphere. uBack = 1: the outer halo (back faces of a larger shell,
// brightest at the limb, fading to nothing at its edge). uBack = 0: the haze
// over the disk, brightest at grazing angles. Both only on the sunlit side,
// with a sunset tint along the terminator.
const ATMO_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform vec3 uSunset;
uniform vec3 uSunW;
uniform float uGain;
uniform float uEdge;
uniform float uBack;
uniform float uFade;
varying vec3 vN;
varying vec3 vW;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float d = abs(dot(n, v));
  float a = uBack > 0.5 ? pow(clamp(d / uEdge, 0.0, 1.0), 2.6) * uFade : pow(1.0 - d, 3.2);
  float l = dot(n, uSunW);
  float lit = smoothstep(-0.18, 0.5, l);
  // A thin warm band where sunlight grazes the terminator.
  float dusk = smoothstep(-0.16, 0.0, l) * (1.0 - smoothstep(0.0, 0.2, l));
  vec3 col = uColor * lit + uSunset * dusk * 0.4;
  gl_FragColor = vec4(col * a * uGain, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function atmoMaterial(spec, U, back) {
  const q = 1 / spec.scale;
  return new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(spec.color) },
      uSunset: { value: new THREE.Color(spec.sunset) },
      uSunW: U.uSunW,
      uGain: { value: back ? spec.gain : spec.rim },
      uEdge: { value: Math.sqrt(1 - q * q) },
      uBack: { value: back ? 1 : 0 },
      uFade: U.uFade,
    },
    side: back ? THREE.BackSide : THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Earth: night lights only on the dark side, and a sun glint on water.
// Europa: the map has no data south of about -83 degrees, so fill it with the
// map's average grey (measured in linear light) and blend the edge.
function patchSurface(mat, kind, U) {
  if (kind !== 'earth' && kind !== 'europa') return;
  mat.customProgramCacheKey = () => 'ek-planet-' + kind;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSunV = U.uSunV;
    sh.uniforms.uNight = U.uNight;
    sh.uniforms.uReal = U.uReal;
    let f = 'uniform vec3 uSunV;\nuniform float uNight;\nuniform float uReal;\n' + sh.fragmentShader;
    if (kind === 'earth') {
      f = f
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float ekWater = smoothstep(0.004, 0.03, diffuseColor.b - max(diffuseColor.r, diffuseColor.g));
          roughnessFactor = mix(roughnessFactor, 0.38, ekWater);`
        )
        .replace(
          '#include <aomap_fragment>',
          `#include <aomap_fragment>
          float ekDark = smoothstep(0.1, -0.2, dot(normal, uSunV));
          // Black Marble has a navy base under the lights; keep only the lights.
          float ekL = dot(totalEmissiveRadiance, vec3(0.2126, 0.7152, 0.0722));
          totalEmissiveRadiance *= smoothstep(0.04, 0.22, ekL) * ekDark * uNight;`
        );
    } else {
      f = f.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28), (1.0 - smoothstep(0.048, 0.085, vMapUv.y)) * uReal);
        #endif`
      );
    }
    sh.fragmentShader = f;
  };
}

// Put a real NASA map in place when it arrives; on failure call fallback.
// Returns true when the map was already loaded and applied synchronously.
function useReal(id, lo, apply, fallback) {
  const ready = peekTexture(id, { lo });
  if (ready) {
    apply(ready);
    return true;
  }
  texture(id, { lo }).then(apply, () => fallback && fallback());
  return false;
}

// A planet group: surface, optional clouds and an atmosphere.
// opts: segments, res (procedural size; also picks the small real map when <= 512),
// glow (false = no atmosphere), real (false = procedural only),
// map (texture id to show instead, e.g. 'mars-mola' or 'venus-topo'),
// clouds (Venus: false hides the cloud veil, or a number for its opacity),
// bumpScale (Moon relief strength).
// userData: kind, surface, clouds, glow (the outer halo), atmosphere (both shells).
export function makePlanet(kind, radius, opts = {}) {
  const spec = KINDS[kind] || {};
  const g = new THREE.Group();
  g.userData.kind = kind;
  const seg = Math.max(24, Math.min(opts.segments || 96, quality().segments)) & ~1;
  const res = opts.res || 1024;
  const real = opts.real !== false && !!spec.map;
  const lo = res <= 512 ? true : undefined;
  const U = { uSunW: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() }, uSunV: { value: new THREE.Vector3(0, 0, 1) }, uFade: { value: 1 }, uNight: { value: 0 }, uReal: { value: 0 } };
  const halo = spec.atmo && opts.glow !== false ? radius * spec.atmo.scale : 0;
  const onSun = sunUpdater(U, g, halo);

  const proc = (w) => planetTexture(PALETTES[kind] ? kind : 'moon', w);
  // Planets in space are lit by the Sun alone: ignore any studio environment
  // the scene uses for its spacecraft (it would flatten the terminator).
  const mat = new THREE.MeshStandardMaterial({ roughness: spec.roughness || 0.95, metalness: 0, envMapIntensity: 0 });
  patchSurface(mat, kind, U);
  const surf = new THREE.Mesh(new THREE.SphereGeometry(radius, seg, seg / 2), mat);
  surf.onBeforeRender = onSun;
  g.add(surf);
  g.userData.surface = surf;
  // Swap a slot only while it still holds what makePlanet put there, so a
  // caller that sets its own map is never overwritten by a late load.
  const loaded = (m, slot) => {
    const was = m[slot];
    return (t) => {
      if (m[slot] !== was) return;
      m[slot] = t;
      m.needsUpdate = true;
    };
  };
  // A small placeholder while the real map loads costs a few percent of a full one.
  const mapId = opts.map || spec.map;
  const hasReal = real && !!peekTexture(mapId, { lo });
  mat.map = hasReal ? peekTexture(mapId, { lo }) : proc(real ? Math.min(res, 256) : res);
  if (hasReal) U.uReal.value = 1;
  else if (real) {
    const toReal = loaded(mat, 'map');
    const toProc = loaded(mat, 'map');
    texture(mapId, { lo }).then(
      (t) => {
        if (mat.map === mat.userData.placeholder) U.uReal.value = 1;
        toReal(t);
      },
      () => toProc(proc(res))
    );
  }
  mat.userData.placeholder = mat.map;

  if (real && spec.bump) {
    useReal(spec.bump, undefined, (t) => {
      mat.bumpScale = opts.bumpScale || 2.2;
      loaded(mat, 'bumpMap')(t);
    });
  }
  if (real && spec.night) {
    useReal(spec.night, undefined, (t) => {
      mat.emissive.set(0xffd7a0);
      mat.emissiveIntensity = 1.6;
      U.uNight.value = 1;
      loaded(mat, 'emissiveMap')(t);
    });
  }

  if (kind === 'earth') {
    const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, depthWrite: false, roughness: 1, envMapIntensity: 0 });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.006, seg, seg / 2), cm);
    clouds.onBeforeRender = onSun;
    const ready = real && peekTexture(spec.clouds);
    cm.alphaMap = ready || planetTexture('clouds', real ? 256 : 1024);
    if (real && !ready) {
      const toReal = loaded(cm, 'alphaMap');
      const toProc = loaded(cm, 'alphaMap');
      texture(spec.clouds).then(toReal, () => toProc(planetTexture('clouds', 1024)));
    }
    g.add(clouds);
    g.userData.clouds = clouds;
  }
  // Venus: the radar map shows the ground; a thin veil of the procedural
  // cloud bands keeps it reading as a cloud-wrapped world.
  if (kind === 'venus' && real && opts.clouds !== false && !opts.map) {
    const vm = new THREE.MeshStandardMaterial({ map: planetTexture('venus', 512), transparent: true, opacity: typeof opts.clouds === 'number' ? opts.clouds : 0.42, depthWrite: false, roughness: 1, envMapIntensity: 0 });
    const veil = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.008, seg, seg / 2), vm);
    veil.onBeforeRender = onSun;
    g.add(veil);
    g.userData.clouds = veil;
  }

  if (halo) {
    const outer = new THREE.Mesh(new THREE.SphereGeometry(halo, seg, seg / 2), atmoMaterial(spec.atmo, U, true));
    const inner = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, seg, seg / 2), atmoMaterial(spec.atmo, U, false));
    outer.onBeforeRender = onSun;
    inner.onBeforeRender = onSun;
    // Draw after the clouds so the haze sits on top.
    outer.renderOrder = inner.renderOrder = 2;
    g.add(inner, outer);
    g.userData.glow = outer;
    g.userData.atmosphere = [inner, outer];
  }
  g.userData.real = hasReal;
  return g;
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.36, 'rgba(255,255,255,0)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.65)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 256, 256);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.userData.keep = true;
  return glowTex;
}

let softTex = null;
export function softDot() {
  if (softTex) return softTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  softTex = new THREE.CanvasTexture(c);
  softTex.userData.keep = true;
  return softTex;
}

export function makeSun(size) {
  const g = new THREE.Group();
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xfff1c4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  core.scale.setScalar(size);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xf0b429, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(size * 4);
  g.add(halo, core);
  return g;
}

export function makeStars(count = 3500, radius = 4e4, seed = 7) {
  count = Math.max(200, Math.round(count * quality().stars));
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let s = seed;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1;
    const th = r() * Math.PI * 2;
    const q = Math.sqrt(1 - u * u);
    pos.set([radius * q * Math.cos(th), radius * u, radius * q * Math.sin(th)], i * 3);
    const b = 0.45 + r() * 0.55;
    const warm = r();
    col.set([b, b * (0.92 + warm * 0.08), b * (0.85 + (1 - warm) * 0.15)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false });
  return new THREE.Points(geo, mat);
}

// Canvas texture helper for small procedural maps.
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A simple particle emitter for exhaust, smoke and storms.
const _col = new THREE.Color();
export function makeParticles(max, opts = {}) {
  max = Math.max(16, Math.round(max * quality().particles));
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const size = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    map: softDot(),
    size: opts.size || 1,
    sizeAttenuation: opts.attenuate !== false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const parts = [];
  for (let i = 0; i < max; i++) parts.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c0: new THREE.Color(), c1: new THREE.Color() });
  let next = 0;
  return {
    points: pts,
    emit(p, v, life, c0, c1) {
      const q = parts[next];
      next = (next + 1) % max;
      q.p.copy(p);
      q.v.copy(v);
      q.life = life;
      q.max = life;
      q.c0.set(c0);
      q.c1.set(c1 === undefined ? c0 : c1);
    },
    update(dt, drag = 0) {
      for (let i = 0; i < max; i++) {
        const q = parts[i];
        if (q.life > 0) {
          q.life -= dt;
          q.p.addScaledVector(q.v, dt);
          if (drag) q.v.multiplyScalar(Math.max(0, 1 - drag * dt));
        }
        const k = Math.max(0, q.life / q.max);
        pos[i * 3] = q.p.x;
        pos[i * 3 + 1] = q.p.y;
        pos[i * 3 + 2] = q.p.z;
        const c = _col.copy(q.c1).lerp(q.c0, k);
        col[i * 3] = c.r * k;
        col[i * 3 + 1] = c.g * k;
        col[i * 3 + 2] = c.b * k;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
