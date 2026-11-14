// Title backdrop: a spacecraft arriving at Mars, lit by a low Sun so the
// real Viking map reads across a wide crescent, with the thin dusty limb.
import { THREE, studioEnv } from './engine.js';
import { makePlanet, makeStars, makeSun } from './assets.js';
import { buildCraft, setDeploy } from './craft.js';

export function createTitle() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a);
  studioEnv()
    .then((t) => {
      scene.environment = t;
      scene.environmentIntensity = 0.55;
    })
    .catch(() => {});
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1e6);
  const sunDir = new THREE.Vector3(-0.35, 0.42, 0.84).normalize();
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
  sun.position.copy(sunDir).multiplyScalar(500);
  scene.add(sun, sun.target, new THREE.AmbientLight(0x6f8090, 0.12));
  // A faint blue fill from behind, as if from the far side of the planet.
  const rim = new THREE.DirectionalLight(0x7fa8d8, 0.5);
  rim.position.set(30, -10, -40);
  scene.add(rim);
  scene.add(makeStars(6000, 5e5));
  const sunSprite = makeSun(5000);
  sunSprite.position.set(-1, 0.55, -0.4).normalize().multiplyScalar(2e5);
  scene.add(sunSprite);

  // Right-to-left: the title copy sits on the right, so mirror the scene.
  const sx = document.documentElement.dir === 'rtl' ? -1 : 1;
  sunDir.x *= sx;
  sun.position.copy(sunDir).multiplyScalar(500);
  rim.position.x *= sx;
  sunSprite.position.x *= sx;
  const mars = makePlanet('mars', 60, { segments: 160, res: 2048 });
  mars.position.set(44 * sx, -46, -92);
  mars.rotation.set(0.25, 2.2, 0.2);
  scene.add(mars);
  // Phobos, a small grey speck catching the light.
  const phobos = makePlanet('moon', 0.9, { segments: 24, res: 256, real: false });
  phobos.scale.set(1.25, 0.95, 1);
  scene.add(phobos);

  const design = { mission: 'mars', instruments: ['sounder', 'hires', 'neutron', 'context'], arrays: 14, rtg: 0, dish: 3, shield: 0 };
  const craft = buildCraft(design, { dryKg: 380, propKg: 180 });
  setDeploy(craft, 1);
  const holder = new THREE.Group();
  craft.scale.setScalar(0.5);
  holder.add(craft);
  scene.add(holder);

  const motion = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let t = 6;
  let aspect = 1.6;
  return {
    scene,
    camera,
    exposure: 1.12,
    onResize(w, h) {
      aspect = w / Math.max(1, h);
    },
    update(dt) {
      if (motion) t += dt;
      mars.rotation.y += motion ? dt * 0.012 : 0;
      const a = t * 0.05;
      phobos.position.set(sx * (44 + Math.cos(a) * 88), -46 + Math.sin(a) * 18, -92 + Math.sin(a) * 60);
      // Wide screens: the craft sits right of the title; phones: up top.
      const wide = aspect > 1.1;
      const cx = wide ? 7.6 : 2.2;
      const cy = wide ? 1.4 : 6.6;
      holder.position.set(sx * (cx + Math.sin(t * 0.11) * 0.6), cy + Math.sin(t * 0.3) * 0.25, -7.5);
      holder.rotation.set(0.35 + Math.sin(t * 0.17) * 0.08, -0.9 + t * 0.06, 0.18);
      camera.position.set(Math.sin(t * 0.04) * 1.2, 0.6 + Math.sin(t * 0.07) * 0.3, 10);
      camera.lookAt(sx * (wide ? 4.5 : 0.6), wide ? -1 : 0.8, -20);
    },
  };
}
