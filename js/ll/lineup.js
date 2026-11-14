// The character lineup for tools/ll-sets.html?view=chars (dev page): a dark
// cinematic stage with a warm key and cool rims, the cast in a row, each one
// doing a different animation.
//   &anim=<name>    everyone does one animation (idle, walk, run, sprint, float,
//                   swim, reach, wave, sit, talk, cheer, celebrate, sad, carry,
//                   brace, lookAround, interact, pickup, crouch, torch, lie ...)
//   &n=<count>      how many characters (1..10)
//   &cam=close|face (&who=<index> for the face)
//   &outfit=launch|flight|ground   everyone in one outfit
//   &helmet=1       helmets on
//   &speed=<m/s>    walk speed for 'walk'
//   &t=<s>          run the animations this long before the shot
//   &expr=<name>    everyone makes one face (smile, happy, joy, sad, wow, tense ...)
import { THREE } from '../3d/engine.js';
import { createAstronaut, preloadCharacters } from '../3d/astronaut.js';
import { LOOKS, merge } from './post-options.js';

const ROSTER = [
  { id: 'you', outfit: 'launch', helmet: true },
  { id: 'yusuf', outfit: 'flight' },
  { id: 'lena', outfit: 'flight' },
  { id: 'grace', outfit: 'flight' },
  { id: 'kwame', outfit: 'ground' },
  { id: 'nadia', outfit: 'ground' },
  { id: 'mariam', outfit: 'ground' },
  { id: 'aiko', outfit: 'ground' },
  { id: 'omar', outfit: 'ground' },
  { id: 'tarek', outfit: 'ground' },
];
const ANIMS = ['idle', 'walk', 'run', 'float', 'reach', 'wave', 'sit', 'talk', 'cheer', 'lookAround'];
const SPACING = 1.2;

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 256, 10, 256, 256, 256);
  gr.addColorStop(0, '#3a3c40');
  gr.addColorStop(0.5, '#1c1e21');
  gr.addColorStop(1, '#0a0b0d');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 512);
  // Concrete speckle.
  for (let i = 0; i < 9000; i++) {
    const v = 20 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 4},${Math.random() * 0.25})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function createLineup({ scene, camera, Q }) {
  const SMD = globalThis.SMD || {};
  await Promise.race([preloadCharacters().catch(() => null), new Promise((r) => setTimeout(r, 20000))]);
  const own = [];
  scene.background = new THREE.Color(0x06080b);
  scene.fog = new THREE.Fog(0x06080b, 10, 26);

  // ---------- Stage ----------
  const floorTex = floorTexture();
  own.push(floorTex);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // A curved backdrop (cyclorama).
  const cyc = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 9, 64, 1, true, Math.PI * 0.6, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.95, side: THREE.BackSide }));
  cyc.position.set(0, 4.5, 4);
  scene.add(cyc);

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0x5a6878, 0x120e0a, 0.3);
  scene.add(hemi);
  const key = new THREE.SpotLight(0xffe2c0, 75, 30, 0.62, 0.55, 1.6);
  key.position.set(3.2, 6.2, 6.5);
  key.target.position.set(0, 1.0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 20;
  scene.add(key, key.target);
  const rimL = new THREE.DirectionalLight(0x9cc4ff, 1.5);
  rimL.position.set(-5, 4, -5);
  const rimR = new THREE.DirectionalLight(0x8fb8ff, 1.1);
  rimR.position.set(5, 3.5, -4.5);
  const fill = new THREE.DirectionalLight(0xffd8b0, 0.35);
  fill.position.set(-4, 1.5, 5);
  scene.add(rimL, rimR, fill);
  // A soft studio environment for the visors and eyes.
  try {
    const { studioEnv } = await import('../3d/engine.js');
    const env = await studioEnv();
    if (env) {
      scene.environment = env;
      if ('environmentIntensity' in scene) scene.environmentIntensity = 0.25;
    }
  } catch (e) {}

  // ---------- Cast ----------
  const n = Math.max(1, Math.min(ROSTER.length, Number(Q.get('n')) || 7));
  const one = Q.get('anim');
  const forceOutfit = Q.get('outfit');
  const helmetQ = Q.get('helmet');
  const actors = [];
  const stoolMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.6 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.7 });
  own.push(stoolMat, seatMat);
  for (let i = 0; i < n; i++) {
    const r = ROSTER[i];
    const appearance = r.id === 'you' ? Object.assign({}, SMD.avatar ? SMD.avatar.get() : { name: 'You' }) : { name: r.id[0].toUpperCase() + r.id.slice(1), cast: r.id };
    if (r.id === 'you' && appearance.hair === 'helmet') appearance.hair = 'short';
    const outfit = forceOutfit || r.outfit;
    const helmet = helmetQ != null ? helmetQ === '1' : outfit === 'launch' && !!r.helmet;
    const astro = createAstronaut(appearance, { cast: r.id === 'you' ? null : r.id, outfit, helmet, shadows: true, blob: true });
    const x = (i - (n - 1) / 2) * SPACING;
    astro.group.position.set(x, 0, 0);
    astro.group.rotation.y = -x * 0.06;
    scene.add(astro.group);
    const anim = one || ANIMS[i % ANIMS.length];
    const a = { astro, anim, x, next: 0, stool: null };
    if (anim === 'sit' || anim === 'sitTalk' || anim === 'drive') {
      // A stool whose front edge is over the character origin (seat contract).
      const st = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 24), seatMat);
      top.position.set(0, 0.395, -0.2);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.37, 10), stoolMat);
      leg.position.set(0, 0.185, -0.2);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.02, 24), stoolMat);
      base.position.set(0, 0.01, -0.2);
      [top, leg, base].forEach((m) => {
        m.castShadow = m.receiveShadow = true;
        st.add(m);
      });
      astro.group.add(st);
      a.stool = st;
    }
    start(a);
    actors.push(a);
  }
  function start(a) {
    const A = a.astro;
    const anim = a.anim;
    const speed = Number(Q.get('speed')) || 0;
    if (anim === 'walk') A.setSpeed(speed || 1.45);
    else if (anim === 'run') A.setSpeed(speed || 3.8);
    else if (anim === 'sprint') A.setSpeed(speed || 6.5);
    else if (anim === 'jog') A.setSpeed(speed || 2.6);
    else if (anim === 'float') {
      A.setFloat(true);
      A.group.position.y = 0.3;
    } else if (anim === 'swim') {
      A.setFloat(true);
      A.setSwim(1);
      A.group.position.y = 0.3;
    } else if (anim === 'carry') A.carry({ spread: 0.35 });
    else if (['sit', 'sitTalk', 'drive', 'lie', 'rest', 'crouch', 'torch', 'fall'].includes(anim)) A.play(anim, { hold: true });
    if (Q.get('expr')) A.setExpression(Q.get('expr'));
  }
  const repeat = { wave: 3.2, reach: 3, cheer: 2.4, celebrate: 2.6, sad: 4, talk: 3.2, lookAround: 3.6, interact: 2.6, pickup: 2, brace: 2.6, hop: 1.4, point: 2.4, nod: 2, shake: 2, tense: 2.4, salute: 2.6, push: 3, fix: 5.4, dance: 2, hit: 1.2, jumpStart: 2, sitDown: 3, standUp: 2 };

  let time = 0;
  function update(dt) {
    time += dt;
    for (const a of actors) {
      const rp = repeat[a.anim];
      if (rp && time >= a.next) {
        a.next = time + rp;
        a.astro.play(a.anim);
      }
      a.astro.update(dt);
    }
  }
  // Settle (and optionally run to a given time) before the first frame.
  const t0 = Number(Q.get('t')) || 0.6;
  for (let s = 0; s < t0; s += 1 / 30) update(1 / 30);
  actors.forEach((a) => a.astro.seek(0));

  function frame(spec) {
    if (spec === 'face') {
      const i = Math.max(0, Math.min(actors.length - 1, Q.get('who') != null ? Number(Q.get('who')) : 1));
      const a = actors[i];
      const y = (a.astro.headHeight || 1.62) + (a.astro.group.position.y || 0);
      const yaw = a.astro.group.rotation.y + 0.25;
      const p = new THREE.Vector3(Math.sin(yaw) * 0.62, y + 0.03, Math.cos(yaw) * 0.62).add(a.astro.group.position.clone().setY(0));
      camera.position.copy(p);
      camera.fov = 40;
      camera.updateProjectionMatrix();
      camera.lookAt(a.x, y - 0.02, 0);
      return;
    }
    if (spec === 'close') {
      camera.position.set(0, 1.35, 4.1);
      camera.fov = 40;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 1.0, 0);
      return;
    }
    const w = Math.max(4, actors.length * SPACING + 1.2);
    camera.fov = 38;
    camera.updateProjectionMatrix();
    const dist = w / 2 / Math.tan((camera.fov * Math.PI) / 360) / (camera.aspect || 16 / 9);
    camera.position.set(0, 1.45, Math.max(5, dist * 1.02));
    camera.lookAt(0, 0.95, 0);
  }

  return {
    update,
    frame,
    actors,
    ready: Promise.all(actors.map((a) => a.astro.ready)).catch(() => null),
    exposure: 1.0,
    post: merge(LOOKS.interior, { bloom: { strength: 0.35, radius: 0.5, threshold: 0.95 }, vignette: 0.45 }),
    stats() {
      return actors.map((a) => ({ anim: a.anim, rigged: !!a.astro.isRigged, tris: a.astro.triangles(), calls: a.astro.impl && a.astro.impl.drawCalls ? a.astro.impl.drawCalls() : a.astro.drawCalls ? a.astro.drawCalls() : null }));
    },
    dispose() {
      actors.forEach((a) => a.astro.dispose());
      own.forEach((o) => o.dispose && o.dispose());
      floor.geometry.dispose();
      cyc.geometry.dispose();
    },
  };
}
