// One shared WebGL renderer; scenes are mounted into a container and swapped.
// Quality follows SMD.settings.profile(): pixel ratio cap, shadow map size and
// softness; in Automatic mode the resolution also drops while frames are slow.
// Without WebGL, mount() paints a backdrop instead and the game plays on.
import * as THREE from 'three';
export { THREE };

const SMD = (globalThis.SMD = globalThis.SMD || {});
let renderer = null;
let current = null;
let currentEl = null;
let raf = 0;
let ro = null;
let last = 0;
let failed = false; // the renderer could not be created
// Post-processing (js/ll/render.js), loaded on demand for scenes that carry
// `post: {...}`; every other scene renders straight to the canvas as before.
let post = null;
let postFor = null; // the scene object the pipeline belongs to

const FALLBACK_PROFILE = { tier: 'high', pixelRatio: Math.min(2, globalThis.devicePixelRatio || 1), minPixelRatio: 0.85, adaptive: false, antialias: true, shadowMapMax: 2048, softShadows: true, anisotropy: 8 };
export function profile() {
  try {
    return SMD.settings ? SMD.settings.profile() : FALLBACK_PROFILE;
  } catch (e) {
    return FALLBACK_PROFILE;
  }
}

// Whether WebGL works here at all (checked once, without a console error).
export function supported() {
  if (failed) return false;
  try {
    return SMD.settings ? SMD.settings.gpu().webgl : true;
  } catch (e) {
    return true;
  }
}

// Without WebGL, scenes still build (they only read domElement, capabilities
// and the like from the renderer); mount() then paints a backdrop instead.
let nullRenderer = null;
function makeNullRenderer() {
  const noop = () => {};
  const canvas = document.createElement('canvas');
  return {
    isNullRenderer: true,
    domElement: canvas,
    capabilities: { getMaxAnisotropy: () => 1, maxTextureSize: 2048, isWebGL2: false, logarithmicDepthBuffer: true },
    info: { render: { calls: 0, triangles: 0, points: 0, lines: 0, frame: 0 }, memory: { geometries: 0, textures: 0 }, programs: [], reset: noop },
    shadowMap: { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap },
    renderLists: { dispose: noop },
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1,
    getPixelRatio: () => 1,
    getSize: (v) => (v ? v.set(canvas.width, canvas.height) : { x: canvas.width, y: canvas.height }),
    getContext: () => ({ isContextLost: () => true }),
    setPixelRatio: noop,
    setSize: noop,
    setClearColor: noop,
    setRenderTarget: noop,
    clear: noop,
    render: noop,
    compile: noop,
    initTexture: noop,
    dispose: noop,
  };
}

export function getRenderer() {
  if (renderer) return renderer;
  if (!supported()) return (nullRenderer = nullRenderer || makeNullRenderer());
  const q = profile();
  try {
    renderer = new THREE.WebGLRenderer({ antialias: q.antialias, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  } catch (e) {
    failed = true;
    console.warn('WebGL could not start; the 3D views are off', e);
    return (nullRenderer = nullRenderer || makeNullRenderer());
  }
  pixelRatio = q.pixelRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const c = renderer.domElement;
  c.style.display = 'block';
  c.style.width = '100%';
  c.style.height = '100%';
  // A lost context (driver reset, too many tabs) comes back if we ask for it.
  c.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('WebGL context lost; waiting for it to come back');
  });
  c.addEventListener('webglcontextrestored', () => console.warn('WebGL context restored'));
  return renderer;
}

// A shared studio environment map so metals and foil reflect something.
// Resolves null when there is no WebGL (callers just skip reflections).
let envTex = null;
let envP = null;
export function studioEnv() {
  if (envTex) return Promise.resolve(envTex);
  if (envP) return envP;
  envP = (async () => {
    try {
      const r = getRenderer();
      if (r.isNullRenderer) return null;
      const { RoomEnvironment } = await import('../../vendor/RoomEnvironment.js');
      const pm = new THREE.PMREMGenerator(r);
      envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      envTex.userData.keep = true;
      pm.dispose();
      return envTex;
    } catch (e) {
      envP = null;
      return null;
    }
  })();
  return envP;
}

// ---------- Quality: pixel ratio and shadows ----------
let pixelRatio = 1;
const frames = { ema: 16.7, slow: 0, fast: 0, settle: 0 };

function setPixelRatio(pr) {
  if (!renderer || !currentEl) return;
  pixelRatio = pr;
  renderer.setPixelRatio(pr);
  renderer.setSize(Math.max(1, currentEl.clientWidth), Math.max(1, currentEl.clientHeight), false);
  if (post) post.setPixelRatio(pr);
}

// Scenes choose their own shadow map sizes; the low tier caps them.
const asked = new WeakMap(); // light -> the size its scene asked for
function applyShadowCap(scene) {
  if (!scene || !renderer || !renderer.shadowMap.enabled) return;
  const max = profile().shadowMapMax;
  scene.traverse((o) => {
    if (!o.isLight || !o.shadow || !o.castShadow) return;
    const ms = o.shadow.mapSize;
    let want = asked.get(o);
    if (!want || (ms.x !== want.cw || ms.y !== want.ch)) want = { w: ms.x, h: ms.y }; // the scene changed it itself
    const w = Math.min(want.w, max);
    const h = Math.min(want.h, max);
    want.cw = w;
    want.ch = h;
    asked.set(o, want);
    if (ms.x !== w || ms.y !== h) {
      ms.set(w, h);
      if (o.shadow.map) {
        o.shadow.map.dispose();
        o.shadow.map = null;
      }
    }
  });
}

function applyQuality() {
  if (!renderer) return;
  const q = profile();
  renderer.shadowMap.type = q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.needsUpdate = true;
  frames.slow = frames.fast = 0;
  frames.settle = 30;
  if (current) {
    setPixelRatio(q.pixelRatio);
    applyShadowCap(current.scene);
    // The tier changes the pipeline itself (AO, MSAA, bloom size): rebuild it.
    if (current.post) startPost(current);
  } else pixelRatio = q.pixelRatio;
}
if (SMD.bus) SMD.bus.on('settings', (e) => e && e.key === 'quality' && applyQuality());

// Automatic mode: when frames run slow for a while, render fewer pixels;
// when they run fast again, step back up. Big gaps (tab hidden) are ignored.
function adapt(ms) {
  const q = profile();
  if (!q.adaptive || ms > 250) return;
  if (frames.settle > 0) {
    frames.settle--;
    return;
  }
  frames.ema += (ms - frames.ema) * 0.05;
  if (frames.ema > 36) frames.slow++;
  else frames.slow = 0;
  if (frames.ema < 19) frames.fast++;
  else frames.fast = 0;
  if (frames.slow > 90 && pixelRatio > q.minPixelRatio + 0.01) {
    setPixelRatio(Math.max(q.minPixelRatio, pixelRatio * 0.8));
    frames.slow = 0;
    frames.settle = 45;
  } else if (frames.slow > 120 && post && post.options.ao) {
    // Already at the lowest resolution and still slow: ambient occlusion goes
    // first (it re-renders the scene), the rest of the look stays.
    post.set({ ao: false });
    frames.slow = 0;
    frames.settle = 45;
  } else if (frames.fast > 240 && pixelRatio < q.pixelRatio - 0.01) {
    setPixelRatio(Math.min(q.pixelRatio, pixelRatio * 1.15));
    frames.fast = 0;
    frames.settle = 45;
  }
}

// ---------- Mounting ----------
let noticeShown = false;
function paintFallback(el) {
  el.classList.add('ek-no3d');
  const main = el.closest('main, .screen');
  if (main) main.classList.add('no-3d');
  if (!noticeShown && SMD.ui && SMD.ui.toast) {
    noticeShown = true;
    const t = SMD.t || ((k, e) => e);
    SMD.ui.toast(t('sys.no3d', 'This browser could not start 3D graphics (WebGL), so the 3D views are switched off. Everything else in the game works. Turning on hardware acceleration in the browser settings usually brings them back.'), { kind: 'warn', ms: 12000 });
  }
}

// ---------- Post-processing ----------
function dropPost() {
  if (post) {
    try {
      post.dispose();
    } catch (e) {}
  }
  post = null;
  postFor = null;
}
function startPost(sceneObj) {
  dropPost();
  const r = renderer;
  if (!r || !sceneObj || !sceneObj.post) return;
  postFor = sceneObj;
  import('../ll/render.js')
    .then((m) => {
      if (current !== sceneObj || postFor !== sceneObj || post) return;
      post = m.createPost(r, sceneObj.scene, sceneObj.camera, sceneObj.post);
      if (currentEl) post.setSize(Math.max(1, currentEl.clientWidth), Math.max(1, currentEl.clientHeight));
    })
    .catch((e) => {
      console.warn('post-processing is off', e);
    });
}
// The live pipeline of the mounted scene (null while it loads, on scenes
// without post, and without WebGL). See js/ll/render.js for set()/impact().
export function getPost() {
  return post;
}

// sceneObj: { scene, camera, update(dt, t), onResize(w, h), dispose(), shadows?, exposure?, post?, render?(renderer, dt) }
export function mount(el, sceneObj) {
  stop();
  current = sceneObj;
  currentEl = el;
  const r = getRenderer();
  // No WebGL: paint a backdrop, but keep calling update() so films still
  // reach their cues and end, and labels still move.
  const blind = !!r.isNullRenderer;
  if (blind) paintFallback(el);
  mountCanvas(r, el, sceneObj);
  if (!blind && sceneObj.post) startPost(sceneObj);
  // Count the whole frame (shadow maps, post passes), not only the last call.
  if (!blind) r.info.autoReset = false;
  last = performance.now();
  frames.settle = 30; // the first frames compile shaders and upload textures
  let n = 0;
  let errors = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const ms = now - last;
    const dt = Math.min(0.05, ms / 1000);
    last = now;
    if (!current || r.getContext().isContextLost() !== blind) return;
    try {
      if (!blind) r.info.reset();
      if (current.update) current.update(dt, now / 1000);
      if (!blind && current.scene && current.camera) {
        if (post && postFor === current) post.render(dt, current.scene, current.camera);
        else if (typeof current.render === 'function') current.render(r, dt); // the scene draws itself (its own pipeline)
        else r.render(current.scene, current.camera);
      }
      errors = 0;
    } catch (err) {
      // Report once; a scene that keeps failing is frozen instead of spamming.
      if (!errors) console.error('3D frame failed', err);
      if (++errors > 30) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      return;
    }
    if (blind) return;
    adapt(ms);
    // Lights added after mount (async loads) get the shadow cap too.
    if (++n % 120 === 0) applyShadowCap(current.scene);
  };
  raf = requestAnimationFrame(loop);
  return sceneObj;
}

function mountCanvas(r, el, sceneObj) {
  const q = profile();
  r.shadowMap.enabled = !!sceneObj.shadows;
  r.shadowMap.type = q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  r.toneMappingExposure = sceneObj.exposure || 1;
  if (Math.abs(r.getPixelRatio() - q.pixelRatio) > 0.01 && !q.adaptive) r.setPixelRatio(q.pixelRatio);
  pixelRatio = r.getPixelRatio();
  if (!r.isNullRenderer) el.appendChild(r.domElement);
  const resize = () => {
    if (!current || !current.camera) return;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    r.setSize(w, h, false);
    if (post) post.setSize(w, h);
    if (current.camera.isPerspectiveCamera) {
      current.camera.aspect = w / h;
      current.camera.updateProjectionMatrix();
    }
    if (current.onResize) current.onResize(w, h);
  };
  ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();
  applyShadowCap(sceneObj.scene);
}

export const debug = {
  get current() {
    return current;
  },
  get pixelRatio() {
    return pixelRatio;
  },
  get frameMs() {
    return frames.ema;
  },
  get post() {
    return post;
  },
  // Draw calls and triangles of the last whole frame.
  get frame() {
    const i = renderer && renderer.info.render;
    return i ? { calls: i.calls, triangles: i.triangles, points: i.points, lines: i.lines } : null;
  },
};

export function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
  if (ro) ro.disconnect();
  ro = null;
  const was = current;
  current = null;
  currentEl = null;
  dropPost();
  if (was) {
    try {
      if (was.dispose) was.dispose();
    } catch (e) {
      console.warn('scene dispose failed', e);
    }
    try {
      if (was.scene) disposeTree(was.scene);
    } catch (e) {}
  }
  if (renderer) {
    if (renderer.domElement.parentNode) renderer.domElement.remove();
    // Free render lists and the shadow maps of the scene that just left.
    renderer.renderLists.dispose();
  }
}

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      if (m.userData && m.userData.keep) return;
      ['map', 'bumpMap', 'roughnessMap', 'alphaMap', 'emissiveMap', 'normalMap', 'metalnessMap', 'aoMap'].forEach((k) => {
        if (m[k] && !(m[k].userData && m[k].userData.keep)) m[k].dispose();
      });
      m.dispose();
    });
    if (o.isLight && o.shadow && o.shadow.map) {
      o.shadow.map.dispose();
      o.shadow.map = null;
    }
  });
}

// ---------- Keyboard and touch input ----------
const keys = new Set();
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'ShiftLeft']);
let captureKeys = false;
const pressed = [];

window.addEventListener('keydown', (e) => {
  if (!captureKeys) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') && e.code === 'Space') return;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (!keys.has(e.code)) pressed.push(e.code);
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

export const input = {
  down: (code) => keys.has(code),
  any: (...codes) => codes.some((c) => keys.has(c)),
  // Keys pressed since the last call (edge-triggered).
  take: (code) => {
    const i = pressed.indexOf(code);
    if (i >= 0) {
      pressed.splice(i, 1);
      return true;
    }
    return false;
  },
  flush: () => (pressed.length = 0),
  capture: (on) => {
    captureKeys = on;
    keys.clear();
    pressed.length = 0;
  },
  // On-screen buttons that act like keys while held.
  bindTouch(root) {
    root.querySelectorAll('[data-key]').forEach((b) => {
      const code = b.dataset.key;
      const on = (e) => {
        e.preventDefault();
        if (!keys.has(code)) pressed.push(code);
        keys.add(code);
      };
      const off = () => keys.delete(code);
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
    });
  },
};

export const ease = {
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
};
