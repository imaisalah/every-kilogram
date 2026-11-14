// Loads the NASA textures and models listed in assetmanifest.js.
// SMD.assets.texture(id) -> Promise<THREE.Texture> (cached, shared)
// SMD.assets.model(id, opts) -> Promise<THREE.Object3D> (a fresh clone each call)
// Cached resources are marked userData.keep so engine.disposeTree leaves them
// alone when a scene unmounts; the next scene reuses them without a reload.
import { THREE, getRenderer, studioEnv } from './engine.js';
import { TEXTURES, MODELS, CREDITS, ENDORSEMENT, ALIASES } from './assetmanifest.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});
const root = new URL('../../', import.meta.url);
const url = (file) => new URL(file, root).href;

// The low quality tier (phones, small GPUs, school laptops) gets the 2k
// variants and less memory pressure. SMD.assets.quality = 'lo' | 'hi' still
// forces a choice for tools.
function profile() {
  try {
    return SMD.settings.profile();
  } catch (e) {
    return { textures: '4k', anisotropy: 8, maxTextureWidth: 8192, tier: 'high' };
  }
}
function lowSpec() {
  if (SMD.assets && SMD.assets.quality) return SMD.assets.quality === 'lo';
  return profile().textures === '2k';
}

function maxAniso() {
  try {
    return Math.min(profile().anisotropy, getRenderer().capabilities.getMaxAnisotropy());
  } catch (e) {
    return 2;
  }
}

// Maps with no small file (Earth 4k, Jupiter, Black Marble) are scaled down in
// memory on the low tier: a 4k map is 45 MB of GPU memory, a 2k one 11 MB.
function fitImage(img, maxW) {
  const w = img && (img.naturalWidth || img.width);
  if (!w || w <= maxW || typeof document === 'undefined') return img;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = maxW;
  c.height = Math.round((h * maxW) / w);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// Reject when a load hangs (a stalled school proxy), so the scene keeps its
// procedural fallback instead of waiting forever.
function withTimeout(p, ms, what) {
  let timer = 0;
  const stall = new Promise((_, reject) => (timer = setTimeout(() => reject(new Error('timed out: ' + what)), ms)));
  return Promise.race([p, stall]).finally(() => clearTimeout(timer));
}

// A failed file is retried (flaky network), but not by every scene in a row:
// after a failure the procedural stand-in is used for half a minute.
const failedAt = new Map();
const recentlyFailed = (key) => failedAt.has(key) && Date.now() - failedAt.get(key) < 30000;

// ---------- Textures ----------
const texCache = new Map(); // key -> Promise<Texture>
const texReady = new Map(); // key -> Texture (for synchronous peeks)
let texLoader = null;

const realId = (id) => (TEXTURES[id] ? id : ALIASES[id] || id);

function texKey(id, lo) {
  id = realId(id);
  const t = TEXTURES[id];
  return t && t.lo && (lo === undefined ? lowSpec() : lo) ? id + '@lo' : id;
}

// opts.lo: true forces the small variant, false forces the full one.
export function texture(id, opts = {}) {
  id = realId(id);
  const t = TEXTURES[id];
  if (!t) return Promise.reject(new Error('unknown texture: ' + id));
  const key = texKey(id, opts.lo);
  if (texCache.has(key)) return texCache.get(key);
  if (recentlyFailed(key)) return Promise.reject(new Error('texture unavailable: ' + id));
  texLoader = texLoader || new THREE.TextureLoader();
  const file = key.endsWith('@lo') ? t.lo : t.file;
  const p0 = new Promise((resolve, reject) => {
    texLoader.load(
      url(file),
      (tx) => {
        if (lowSpec()) tx.image = fitImage(tx.image, 2048);
        tx.colorSpace = t.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        tx.anisotropy = maxAniso();
        tx.userData.keep = true;
        tx.userData.id = id;
        tx.name = id;
        texReady.set(key, tx);
        resolve(tx);
      },
      undefined,
      () => reject(new Error('texture failed: ' + id))
    );
  });
  const p = withTimeout(p0, 45000, id);
  // A failed load may be retried later (flaky network), so do not cache it.
  p.catch(() => {
    texCache.delete(key);
    failedAt.set(key, Date.now());
  });
  texCache.set(key, p);
  return p;
}

// The texture if it is already loaded, else null (lets a scene skip the placeholder).
export function peekTexture(id, opts = {}) {
  return texReady.get(texKey(id, opts.lo)) || null;
}

// ---------- Models ----------
let gltfLoaderP = null;
function gltfLoader() {
  if (gltfLoaderP) return gltfLoaderP;
  gltfLoaderP = Promise.all([import('../../vendor/GLTFLoader.js'), import('../../vendor/DRACOLoader.js'), import('../../vendor/meshopt_decoder.module.js')]).then(([g, d, m]) => {
    const loader = new g.GLTFLoader();
    const draco = new d.DRACOLoader();
    draco.setDecoderPath(url('vendor/draco/'));
    draco.setDecoderConfig({ type: 'wasm' });
    draco.preload();
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(m.MeshoptDecoder);
    return loader;
  });
  gltfLoaderP.catch(() => (gltfLoaderP = null));
  return gltfLoaderP;
}

const modelCache = new Map(); // id -> Promise<Group> (the master copy, never shown)
let studio = null;

// Many parts are authored fully metallic; with nothing to reflect they render
// black. When the scene has no environment, lend them the studio reflection
// (unless the caller gave the material its own envMap).
function envFallback(renderer, scene, camera, geometry, material) {
  if (!material || !material.isMeshStandardMaterial) return;
  const want = scene.environment ? null : studio;
  if (material.envMap !== want && (material.envMap === null || material.envMap === studio)) material.envMap = want;
}
// Metadata lives beside the master: Object3D.clone copies userData through JSON.
const meta = new WeakMap();

function keepAll(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.userData.keep = true;
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      m.userData.keep = true;
      for (const k in m) if (m[k] && m[k].isTexture) m[k].userData.keep = true;
    });
  });
}

// Wrap the glTF scene in a pivot so the model is centred on the origin,
// turned to our convention, and carries its size in userData.
async function loadMaster(id) {
  const m = MODELS[id];
  const loader = await gltfLoader();
  const gltf = await loader.loadAsync(url(m.file));
  const inner = gltf.scene;
  if (m.rotate) inner.rotation.set(m.rotate[0], m.rotate[1], m.rotate[2]);
  if (m.drop) m.drop.forEach((name) => inner.getObjectsByProperty('name', name).forEach((o) => o.removeFromParent()));
  const pivot = new THREE.Group();
  pivot.name = id;
  pivot.add(inner);
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner, true);
  const center = box.getCenter(new THREE.Vector3());
  inner.position.sub(center);
  pivot.updateMatrixWorld(true);
  const size = box.getSize(new THREE.Vector3());
  // Unit scale: the file's units are arbitrary, so record what 1 m is.
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  try {
    studio = studio || (await studioEnv());
  } catch (e) {
    studio = null;
  }
  inner.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((mat) => {
      if (mat.map) mat.map.anisotropy = maxAniso();
    });
  });
  keepAll(pivot);
  meta.set(pivot, { id, size, radius: size.length() / 2, unitsPerMetre: maxDim / m.realM, realM: m.realM, title: m.title, credit: m.credit });
  return pivot;
}

// opts.size: scale so the largest dimension equals this many scene units.
// opts.metres: true scales to the real size (1 unit = 1 m, as craft.js uses).
// opts.cloneMaterials: true gives the copy its own materials (for tinting or fading).
export function model(id, opts = {}) {
  if (!MODELS[id]) return Promise.reject(new Error('unknown model: ' + id));
  if (!modelCache.has(id)) {
    if (recentlyFailed(id)) return Promise.reject(new Error('model unavailable: ' + id));
    const p = withTimeout(loadMaster(id), 90000, id);
    p.catch(() => {
      modelCache.delete(id);
      failedAt.set(id, Date.now());
    });
    modelCache.set(id, p);
  }
  return modelCache.get(id).then((master) => {
    const copy = master.clone(true);
    const u = meta.get(master);
    if (opts.cloneMaterials) {
      copy.traverse((o) => {
        if (!o.isMesh) return;
        o.material = Array.isArray(o.material) ? o.material.map((x) => cloneMat(x)) : cloneMat(o.material);
      });
    }
    copy.traverse((o) => {
      if (o.isMesh) o.onBeforeRender = envFallback;
    });
    let s = 1;
    const maxDim = Math.max(u.size.x, u.size.y, u.size.z) || 1;
    if (opts.size) s = opts.size / maxDim;
    else if (opts.metres) s = 1 / u.unitsPerMetre;
    copy.scale.setScalar(s);
    copy.userData = { ...u, size: u.size.clone().multiplyScalar(s), radius: u.radius * s, scale: s };
    return copy;
  });
}

function cloneMat(m) {
  const c = m.clone();
  c.userData = { ...m.userData, keep: false };
  return c;
}

// Upload a texture to the GPU now, so the first frame that shows it does not stall.
function upload(t) {
  try {
    const r = getRenderer();
    if (r.initTexture) r.initTexture(t);
  } catch (e) {}
  return t;
}

function load1(id) {
  if (TEXTURES[realId(id)]) return texture(id).then((t) => (profile().tier === 'low' ? t : upload(t)));
  if (MODELS[id]) return model(id);
  return Promise.reject(new Error('unknown asset: ' + id));
}

// Start loading assets in the background (e.g. while a menu is open).
// Resolves when all have settled; failures are ignored here.
export function preload(ids = []) {
  return Promise.allSettled(ids.map(load1));
}

// ---------- Warm-up after the title shows ----------
// One item at a time, each in an idle moment, so the title never stutters and
// a click is never kept waiting. Most-used first: the 3D code for every scene,
// the HQ campus models, the launch film's Earth, the designer's analog, then
// the planets. Data saver: code only. Low tier: skip the big extras.
const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 8000 }) : setTimeout(fn, 300));
let warming = null;
export function warmup() {
  if (warming) return warming;
  const conn = (typeof navigator !== 'undefined' && navigator.connection) || {};
  const saveData = !!conn.saveData || /2g/.test(conn.effectiveType || '');
  const low = profile().tier === 'low';
  const steps = [() => import('./hq.js'), () => import('./designer.js'), () => import('./solarmap.js'), () => import('./films.js')];
  if (!saveData) {
    steps.push(
      () => load1('model-mobile-launcher'),
      () => load1('model-dsn34'),
      () => load1('earth-day'),
      () => load1('earth-clouds'),
      () => load1('model-landsat'),
      () => load1('mars'),
      () => load1('moon')
    );
    if (!low) steps.push(() => load1('earth-night'), () => load1('jupiter'), () => load1('venus-radar'), () => load1('model-mro'), () => load1('model-lro'));
  }
  const t0 = performance.now();
  let done = 0;
  warming = new Promise((resolve) => {
    const next = () => {
      if (!steps.length) {
        SMD.assets.warmStats = { items: done, ms: Math.round(performance.now() - t0) };
        return resolve(SMD.assets.warmStats);
      }
      const step = steps.shift();
      idle(() => {
        let p;
        try {
          p = Promise.resolve(step());
        } catch (e) {
          p = Promise.resolve();
        }
        p.catch(() => {}).then(() => {
          done++;
          next();
        });
      });
    };
    next();
  });
  return warming;
}

SMD.assets = Object.assign(SMD.assets || {}, {
  texture,
  model,
  peekTexture,
  preload,
  warmup,
  credits: CREDITS,
  endorsement: ENDORSEMENT,
  textures: TEXTURES,
  models: MODELS,
});
export default SMD.assets;
