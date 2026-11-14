// Last Light title backdrop: the launch pad at night, the camera drifting
// slowly round the tower, through the post pipeline when it is there.
import { THREE, getRenderer } from '../3d/engine.js';
import { createStandin } from './standin.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});

async function padSet(renderer, camera, scene) {
  try {
    if (!SMD.llStandin && !/[?&]standin\b/.test(location.search)) {
      const m = await import('./sets/index.js');
      return await m.loadSet('pad', { THREE, renderer, camera, scene, id: 'pad', title: true });
    }
  } catch (e) {}
  return createStandin('pad');
}

export async function createTitleScene() {
  const renderer = getRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
  const set = await padSet(renderer, camera, scene);
  scene.add(set.group);
  const mood = set.mood || {};
  const pick = (k) => (set[k] !== undefined ? set[k] : mood[k]);
  scene.fog = pick('fog') || null;
  scene.background = pick('background') || new THREE.Color(0x05080c);
  if (pick('environment')) scene.environment = pick('environment');
  if (set.setPower) set.setPower(1);
  let pipeline = null;
  try {
    const R = await import('./render.js');
    if (R.createPipeline && !renderer.isNullRenderer) {
      pipeline = R.createPipeline({ renderer, scene, camera });
      if (pipeline.setScene) pipeline.setScene(scene, camera, set);
    }
  } catch (e) {
    pipeline = null;
  }
  // Circle a point between the tower and the rocket, low, looking up.
  const a = set.anchors || {};
  const focus = new THREE.Vector3();
  if (a.tower_base && a.hatch) {
    a.tower_base.getWorldPosition(focus);
    const h = a.hatch.getWorldPosition(new THREE.Vector3());
    focus.lerp(h, 0.5);
    focus.y = Math.max(14, h.y * 0.55);
  } else focus.set(4, 18, -3);
  const reduced = () => !!(SMD.settings && SMD.settings.reducedMotion);
  let t = 0;
  const rtl = SMD.dir && SMD.dir() === 'rtl';
  return {
    scene,
    camera,
    shadows: pick('shadows') !== false,
    exposure: pick('exposure') || 1,
    update(dt) {
      t += reduced() ? 0 : dt;
      const ang = (rtl ? -1 : 1) * (0.9 + t * 0.018);
      camera.position.set(focus.x + Math.sin(ang) * 46, 3.2 + Math.sin(t * 0.05) * 1.2, focus.z + Math.cos(ang) * 46);
      camera.lookAt(focus.x, focus.y, focus.z);
      if (set.update) set.update(dt, t, camera);
    },
    render(r, dt) {
      if (pipeline) pipeline.render(dt);
      else r.render(scene, camera);
    },
    onResize(w, h) {
      if (pipeline && pipeline.setSize) pipeline.setSize(w, h);
    },
    dispose() {
      if (pipeline && pipeline.dispose) pipeline.dispose();
      if (set.dispose) set.dispose();
    },
  };
}
