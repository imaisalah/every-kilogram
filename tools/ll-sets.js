// Dev page logic for tools/ll-sets.html (see the comment there for the URLs).
import * as engine from '../js/3d/engine.js';
import '../js/3d/loader.js';
import { loadSet, applyMood } from '../js/ll/sets/index.js';
import { LOOKS } from '../js/ll/render.js';

const { THREE } = engine;
const SMD = globalThis.SMD;
const Q = new URLSearchParams(location.search);
const view = document.getElementById('ll-view');
const hud = document.getElementById('ll-hud');
const labels = document.getElementById('ll-labels');
if (Q.get('hud') === '0') hud.style.display = 'none';
const LL = (window.LL = { engine, THREE });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(Number(Q.get('fov')) || 50, 16 / 9, 0.05, 4000);
LL.scene = scene;
LL.camera = camera;

// ---------- Free camera ----------
const fly = { yaw: 0, pitch: 0, speed: 4, keys: new Set(), drag: null };
function lookAtPoint(target) {
  const d = new THREE.Vector3().subVectors(target, camera.position);
  fly.yaw = Math.atan2(-d.x, -d.z);
  fly.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  applyFly();
}
function applyFly() {
  camera.rotation.set(fly.pitch, fly.yaw, 0, 'YXZ');
}
addEventListener('keydown', (e) => fly.keys.add(e.code));
addEventListener('keyup', (e) => fly.keys.delete(e.code));
view.addEventListener('pointerdown', (e) => (fly.drag = { x: e.clientX, y: e.clientY }));
addEventListener('pointerup', () => (fly.drag = null));
addEventListener('pointermove', (e) => {
  if (!fly.drag) return;
  fly.yaw -= (e.clientX - fly.drag.x) * 0.004;
  fly.pitch = Math.max(-1.5, Math.min(1.5, fly.pitch - (e.clientY - fly.drag.y) * 0.004));
  fly.drag = { x: e.clientX, y: e.clientY };
  applyFly();
});
view.addEventListener('wheel', (e) => (fly.speed = Math.max(0.3, Math.min(80, fly.speed * (e.deltaY > 0 ? 0.85 : 1.18)))), { passive: true });
function stepFly(dt) {
  const k = fly.keys;
  const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
  const s = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
  const u = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
  if (!f && !s && !u) return;
  const v = new THREE.Vector3(s, u, -f).applyEuler(camera.rotation).multiplyScalar(fly.speed * dt * (k.has('ShiftLeft') ? 4 : 1));
  camera.position.add(v);
}

// Frame a spec: an anchor name, or "x,y,z,tx,ty,tz".
function frame(spec) {
  if (!spec) return false;
  const nums = String(spec).split(',').map(Number);
  if (nums.length === 6 && nums.every((n) => isFinite(n))) {
    camera.position.set(nums[0], nums[1], nums[2]);
    lookAtPoint(new THREE.Vector3(nums[3], nums[4], nums[5]));
    return true;
  }
  const set = LL.set;
  const a = set && set.anchors && set.anchors[spec];
  if (!a) return false;
  a.updateWorldMatrix(true, false);
  const p = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld);
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(a.matrixWorld);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
  fwd.normalize();
  const zeroG = !!set.volume;
  const back = zeroG ? 1.6 : 3.2;
  camera.position.copy(p).addScaledVector(fwd, -back).add(new THREE.Vector3(0.35, zeroG ? 1.35 : 1.9, 0));
  lookAtPoint(p.clone().addScaledVector(fwd, 1.5).add(new THREE.Vector3(0, zeroG ? 1.0 : 1.3, 0)));
  return true;
}
LL.frame = frame;

// ---------- Stats ----------
const fpsS = { n: 0, t: 0, fps: 0 };
function stats() {
  const f = engine.debug.frame || {};
  const p = engine.getPost();
  return { fps: fpsS.fps, frameMs: +engine.debug.frameMs.toFixed(1), calls: f.calls, triangles: f.triangles, tier: SMD.settings ? SMD.settings.tier() : '?', post: p ? p.info() : null, pixelRatio: engine.debug.pixelRatio };
}
LL.stats = stats;
LL.post = () => engine.getPost();

// ---------- Anchor labels ----------
const anchorTags = [];
function showAnchors(set) {
  const geo = new THREE.OctahedronGeometry(0.12);
  const mat = new THREE.MeshBasicMaterial({ color: 0x33ddff, depthTest: false });
  for (const [name, a] of Object.entries(set.anchors || {})) {
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 10;
    a.add(m);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8).rotateX(Math.PI / 2).translate(0, 0, 0.3), mat);
    arrow.renderOrder = 10;
    a.add(arrow);
    const el = document.createElement('span');
    el.textContent = name;
    labels.appendChild(el);
    anchorTags.push({ a, el });
  }
}
const tmp = new THREE.Vector3();
function placeTags() {
  const w = view.clientWidth;
  const h = view.clientHeight;
  for (const t of anchorTags) {
    t.a.getWorldPosition(tmp);
    tmp.y += 0.25;
    tmp.project(camera);
    const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
    t.el.style.display = vis ? '' : 'none';
    if (vis) {
      t.el.style.left = ((tmp.x + 1) / 2) * w + 'px';
      t.el.style.top = ((1 - tmp.y) / 2) * h + 'px';
    }
  }
}

// ---------- Views ----------
async function setView(id) {
  const set = await loadSet(id, { appearance: SMD.avatar ? SMD.avatar.get() : null });
  LL.set = set;
  scene.add(set.group);
  applyMood(scene, set);
  const mood = set.mood || {};
  const usePost = Q.get('post') !== '0';
  const sceneObj = {
    scene,
    camera,
    shadows: mood.shadows !== false,
    exposure: mood.exposure || 1,
    post: usePost ? Object.assign({}, set.post || mood.post || LOOKS[set.volume ? 'interior' : 'pad'], Q.get('ao') === '0' ? { ao: false } : {}, Q.get('bloom') === '0' ? { bloom: false } : {}, Q.get('aa') === '0' ? { aa: false } : {}) : null,
    update(dt, t) {
      stepFly(dt);
      set.update(dt, t, camera);
      if (LL.onUpdate) LL.onUpdate(dt, t);
      if (anchorTags.length) placeTags();
    },
    dispose() {
      set.dispose();
    },
  };
  if (Q.get('alarm') === '1') set.setAlarm(true);
  if (Q.get('power')) set.setPower(Number(Q.get('power')));
  if (!frame(Q.get('cam')) && !frame('start')) {
    camera.position.set(0, 2, 6);
    lookAtPoint(new THREE.Vector3(0, 1.5, 0));
  }
  if (Q.get('anchors') === '1') showAnchors(set);
  engine.mount(view, sceneObj);
  await Promise.race([set.ready || Promise.resolve(), new Promise((r) => setTimeout(r, 15000))]).catch(() => {});
  const t = Number(Q.get('t')) || 0;
  for (let s = 0; s < t; s += 1 / 30) set.update(1 / 30, s, camera);
}

async function charsView() {
  const m = await import('../js/ll/lineup.js').catch(() => null);
  if (!m) {
    hud.textContent = 'js/ll/lineup.js is missing';
    return;
  }
  const built = await m.createLineup({ scene, camera, Q });
  LL.lineup = built;
  engine.mount(view, {
    scene,
    camera,
    shadows: true,
    exposure: built.exposure || 1,
    post: Q.get('post') === '0' ? null : built.post || LOOKS.interior,
    update(dt, t) {
      stepFly(dt);
      built.update(dt, t);
    },
    dispose() {
      built.dispose();
    },
  });
  if (!frame(Q.get('cam') && Q.get('cam').includes(',') ? Q.get('cam') : null) && built.frame) built.frame(Q.get('cam'));
  else applyFly();
  await (built.ready || Promise.resolve());
}

// Free-camera orientation follows camera.lookAt calls made by views.
const origLookAt = camera.lookAt.bind(camera);
camera.lookAt = (...a) => {
  origLookAt(...a);
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  fly.yaw = e.y;
  fly.pitch = e.x;
};

let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  fpsS.n++;
  fpsS.t += now - last;
  last = now;
  if (fpsS.t > 1000) {
    fpsS.fps = Math.round((fpsS.n * 1000) / fpsS.t);
    fpsS.n = fpsS.t = 0;
    const s = stats();
    hud.textContent = `${Q.get('set') || Q.get('view') || ''}  ${s.fps} fps  ${s.frameMs} ms\ncalls ${s.calls}  tris ${(s.triangles / 1000).toFixed(0)}k  tier ${s.tier}  pr ${s.pixelRatio}\npost ${s.post ? `ao ${s.post.ao} bloom ${s.post.bloom} aa ${s.post.aa}` : 'off'}`;
  }
}
requestAnimationFrame(tick);

(async () => {
  try {
    if (Q.get('view') === 'chars') await charsView();
    else await setView(Q.get('set') || 'pad');
    // A few frames so the post pipeline and shaders are in.
    await new Promise((r) => setTimeout(r, 600));
    window.testReady = true;
  } catch (e) {
    console.error('ll-sets failed', e);
    hud.textContent = 'failed: ' + (e && e.message);
    window.testReady = true;
  }
})();
