// Launch day, in 3D: the pad before dawn (the walkdown) and the firing room
// 500 m away (the Go/No-Go poll). The player's astronaut walks around the
// rocket with the shared character controller (js/3d/controller.js: WASD,
// stick, thumb joystick, a click or tap on the ground) and inspects hot spots
// with E, A, the big button, a click or a tap. One scene holds both places; the camera
// switches between them. Metres throughout; the rocket stands at the origin.
import { THREE, studioEnv, getRenderer } from './engine.js';
import { makeStars, softDot, canvasTex, fbm } from './assets.js';
import { createAstronaut } from './astronaut.js';
import { createController } from './controller.js';

const SMD = globalThis.SMD;
const DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

// Same generic launcher classes as the launch film (js/3d/films.js), so the
// pad can be laid out before the film module (and its rocket) has loaded.
const LOOKS = {
  light: { id: 'light', r: 1.0, s1: 17, s2: 5, fair: 6, fr: 1.2, solids: 0, cores: 0, body: '#25282c' },
  medium: { id: 'medium', r: 1.9, s1: 32, s2: 11, fair: 12, fr: 1.1, solids: 2, cores: 0, body: '#eceff1' },
  heavy: { id: 'heavy', r: 2.5, s1: 40, s2: 13, fair: 17, fr: 1.08, solids: 0, cores: 2, body: '#d8813f' },
};

// Where the firing room stands, along +Z from the pad (real firing rooms are
// a few kilometres away; 400 m keeps the rocket readable through the window).
const ROOM_Z = 400;
// Station consoles in the firing room, front row, left to right.
export const STATIONS = ['range', 'weather', 'propulsion', 'guidance', 'spacecraft'];

function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}

// A small pool of soft sprites for vapour (cold oxygen boil-off sinks and drifts).
function vapour(scene, max, color = 0xe8eef6) {
  const P = [];
  for (let i = 0; i < max; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false;
    scene.add(s);
    P.push({ s, life: 0, max: 1, v: new THREE.Vector3(), s0: 1, s1: 2, a: 0.5 });
  }
  let next = 0;
  return {
    emit(p, v, life, s0, s1, a) {
      const q = P[next];
      next = (next + 1) % max;
      q.s.position.copy(p);
      q.v.copy(v);
      q.life = q.max = life;
      q.s0 = s0;
      q.s1 = s1;
      q.a = a;
      q.s.visible = true;
    },
    update(dt) {
      P.forEach((q) => {
        if (q.life <= 0) return;
        q.life -= dt;
        if (q.life <= 0) {
          q.s.visible = false;
          return;
        }
        const age = 1 - q.life / q.max;
        q.s.position.addScaledVector(q.v, dt);
        q.v.y -= dt * 0.25;
        q.s.scale.setScalar(lerp(q.s0, q.s1, age));
        q.s.material.opacity = q.a * Math.min(1, age * 6) * (1 - age);
      });
    },
  };
}

// Words drawn on a canvas (console screens, the countdown clock, tags).
function textCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { c, ctx: c.getContext('2d'), tex };
}
const FONT = "Archivo, 'Noto Kufi Arabic', 'Arial Narrow', sans-serif";

// opts: { launcher, agencyName, appearance, leak (the valve really leaks),
//         fod (a tool lies near the hatch), stationNames {id: label},
//         onPins(list), onSpot(id), onNear(id|null), spotLabel(id) (prompt text) }
export function createLaunchDay(opts = {}) {
  const look = LOOKS[opts.launcher] || LOOKS.medium;
  const r = look.r;
  const reduced = (() => {
    try {
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  })();
  const Lr = look.s1 + 2.2 + look.s2 + look.fair; // rocket length
  const legR = Math.max(2.2, r * (look.cores ? 3.4 : look.solids ? 1.9 : 1.25));
  const mountH = Math.max(3.5, r * 3.2);
  const tw = Math.max(2.2, r * 1.8);
  const towerX = -(Math.max(legR + tw / 2 + 1.2, r * 3.4 + tw / 2));
  const apronR = legR * 1.3 + 24;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 8000);
  let aspect = 1.6;
  studioEnv()
    .then((t) => {
      if (!t) return;
      scene.environment = t;
      scene.environmentIntensity = 0.25;
    })
    .catch(() => {});

  // ---------- Sky, ground, light: an hour before dawn ----------
  const skyTex = canvasTex(8, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#040912');
    g.addColorStop(0.3, '#0b1a36');
    g.addColorStop(0.44, '#26355e');
    g.addColorStop(0.485, '#6a5a78');
    g.addColorStop(0.497, '#d08a62');
    g.addColorStop(0.5, '#f0b07a');
    g.addColorStop(0.51, '#1b1c22');
    g.addColorStop(1, '#0b0d12');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -2;
  scene.add(sky);
  const stars = makeStars(1800, 3600);
  stars.material.transparent = true;
  stars.material.opacity = 0.55;
  stars.material.fog = false;
  stars.renderOrder = -1;
  scene.add(stars);
  const dawn = glow(0xffa860, 1800, 0.45);
  dawn.material.fog = false;
  dawn.position.set(3200, 40, -1400);
  scene.add(dawn);
  scene.fog = new THREE.FogExp2(0x1c2740, 0.0011);
  const hemi = new THREE.HemisphereLight(0x8ea4d4, 0x4c4842, 0.8);
  const moon = new THREE.DirectionalLight(0xbfd0ff, 0.55);
  moon.position.set(-300, 500, 400);
  scene.add(hemi, moon, moon.target);

  const grassTex = canvasTex(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const n = fbm(i / 22, j / 22, 0.4, 4, 33);
        img.data.set([28 + n * 34, 40 + n * 38, 30 + n * 18, 255], (j * w + i) * 4);
      }
    ctx.putImageData(img, 0, 0);
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(140, 140);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3000, 64), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  // The concrete apron: slabs, a yellow safety ring, a painted walkway.
  const apronTex = canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#6e716f';
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    for (let j = 0; j < h; j += 2)
      for (let i = 0; i < w; i += 2) {
        const n = (fbm(i / 60, j / 60, 0.2, 4, 9) - 0.5) * 34;
        for (let d = 0; d < 4; d++) {
          const k = ((j + (d >> 1)) * w + i + (d & 1)) * 4;
          img.data[k] += n;
          img.data[k + 1] += n;
          img.data[k + 2] += n;
        }
      }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(40,40,40,0.35)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += w / 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, x);
      ctx.lineTo(w, x);
      ctx.stroke();
    }
    // Keep-out ring around the mount, painted in safety yellow.
    const R = (legR * 1.45) / (apronR * 2);
    ctx.strokeStyle = '#d9a21b';
    ctx.lineWidth = 9;
    ctx.setLineDash([26, 18]);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, R * w, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  apronTex.anisotropy = 4;
  const apron = new THREE.Mesh(new THREE.CircleGeometry(apronR, 96), new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.92 }));
  apron.rotation.x = -Math.PI / 2;
  scene.add(apron);

  // ---------- The launch mount, flame trench and tower ----------
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a3a2a, roughness: 0.65, metalness: 0.35 });
  const mountMat = new THREE.MeshStandardMaterial({ color: 0x5c6066, roughness: 0.8, metalness: 0.3 });
  const greyMat = new THREE.MeshStandardMaterial({ color: 0x6f757c, roughness: 0.7, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 1 });
  const colW = Math.max(0.8, r * 0.55);
  const cols = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(colW, mountH, colW), mountMat);
    leg.position.set(Math.cos(a) * legR, mountH / 2, Math.sin(a) * legR);
    scene.add(leg);
    cols.push(leg.position.clone());
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(legR * 2.3, 0.6, legR * 2.3), mountMat);
  deck.position.y = mountH - 0.3;
  scene.add(deck);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.62, 32), new THREE.MeshBasicMaterial({ color: 0x0a0b0d }));
  hole.position.y = mountH - 0.3;
  scene.add(hole);
  // The trench runs away from the walkway, behind the rocket (-Z).
  const trenchLen = apronR + 6;
  const trench = new THREE.Mesh(new THREE.BoxGeometry(r * 3.2, 0.06, trenchLen), darkMat);
  trench.position.set(0, 0.02, -trenchLen / 2);
  scene.add(trench);
  [-1, 1].forEach((sd) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, trenchLen - legR), new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.6 }));
    rail.position.set(sd * (r * 1.6 + 0.2), 0.5, -(trenchLen + legR) / 2);
    scene.add(rail);
  });

  const tower = new THREE.Group();
  const tH = Lr + mountH + 6;
  const post = new THREE.BoxGeometry(0.4, tH, 0.4);
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([a, b]) => {
    const m1 = new THREE.Mesh(post, steel);
    m1.position.set((a * tw) / 2, tH / 2, (b * tw) / 2);
    tower.add(m1);
  });
  const rungX = new THREE.BoxGeometry(tw, 0.25, 0.25);
  const rungZ = new THREE.BoxGeometry(0.25, 0.25, tw);
  const diag = new THREE.BoxGeometry(0.16, Math.hypot(tw, 3.2), 0.16);
  for (let y = 3; y < tH; y += 3.2) {
    [-1, 1].forEach((sd) => {
      const a1 = new THREE.Mesh(rungX, steel);
      a1.position.set(0, y, (sd * tw) / 2);
      const a2 = new THREE.Mesh(rungZ, steel);
      a2.position.set((sd * tw) / 2, y, 0);
      const d1 = new THREE.Mesh(diag, steel);
      d1.position.set(0, y - 1.6, (sd * tw) / 2);
      d1.rotation.z = Math.atan2(tw, 3.2) * sd;
      tower.add(a1, a2, d1);
    });
  }
  const armLen = -towerX - tw / 2 - r * 0.95;
  [mountH + Lr * 0.55, mountH + Lr * 0.86].forEach((y) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.5, 0.9), steel);
    arm.position.set(tw / 2 + armLen / 2, y, 0);
    tower.add(arm);
  });
  const beacon = glow(0xff3b2e, 3, 1);
  beacon.position.y = tH + 0.6;
  tower.add(beacon);
  tower.position.x = towerX;
  scene.add(tower);

  // Floodlights on tall poles.
  const floods = [];
  [
    [1, 1],
    [-1, 1],
    [1, -1],
  ].forEach(([a, b], i) => {
    const R = apronR * 0.82;
    const x = a * R * 0.7;
    const z = b * R * 0.7;
    const h = Math.max(16, Lr * 0.6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, h, 8), greyMat);
    pole.position.set(x, h / 2, z);
    const g = glow(0xfff0d0, 6, 0.95);
    g.position.set(x, h, z);
    const pl = new THREE.PointLight(0xfff0d8, (i === 0 ? 1 : 0.7) * (Lr * Lr * 0.9 + 700), 0, 2);
    pl.position.set(x * 0.85, h, z * 0.85);
    scene.add(pole, g, pl);
    floods.push(g);
  });

  // Lightning protection: tall masts around the pad carry catenary wires above
  // the rocket, the way real pads (LC-39B's three towers) shield the vehicle.
  const masts = [];
  {
    const mastH = mountH + Lr * 1.35;
    const mastR = apronR * 0.95;
    const tops = [0.45, 2.6, 5.35].map((a) => new THREE.Vector3(Math.cos(a) * mastR, mastH, -Math.sin(a) * mastR * 0.9));
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.6, metalness: 0.4 });
    const wireMat = new THREE.LineBasicMaterial({ color: 0x55606a, transparent: true, opacity: 0.7 });
    tops.forEach((p) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.7, mastH, 8), mastMat);
      m.position.set(p.x, mastH / 2, p.z);
      scene.add(m);
      masts.push({ x: p.x, z: p.z, r: 1.1 });
    });
    const peak = new THREE.Vector3(0, mountH + Lr + 8, 0);
    tops.forEach((p) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const k = i / 24;
        const q = p.clone().lerp(peak, k);
        q.y -= Math.sin(k * Math.PI) * 6; // the wire sags
        pts.push(q);
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    });
  }

  // ---------- The rocket (the film's model, with a stand-in until it loads) ----------
  const rocketHolder = new THREE.Group();
  rocketHolder.position.y = mountH;
  rocketHolder.rotation.y = -Math.PI / 2; // the agency name faces the walkway (+Z)
  scene.add(rocketHolder);
  const stand = new THREE.Group();
  {
    const body = new THREE.MeshStandardMaterial({ color: look.body, roughness: 0.55, metalness: 0.15 });
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(r, r, look.s1 + 2.2 + look.s2, 32), body);
    s1.position.y = (look.s1 + 2.2 + look.s2) / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(r * look.fr, look.fair, 32), new THREE.MeshStandardMaterial({ color: 0xf1f3f4, roughness: 0.5 }));
    nose.position.y = look.s1 + 2.2 + look.s2 + look.fair / 2;
    stand.add(s1, nose);
  }
  rocketHolder.add(stand);
  let disposed = false;
  import('./films.js')
    .then((m) => {
      if (disposed || !m.rocketMesh) return;
      const L = (m.ROCKET_LOOKS && m.ROCKET_LOOKS[look.id]) || look;
      const rk = m.rocketMesh(L, opts.agencyName || '');
      rocketHolder.remove(stand);
      rocketHolder.add(rk);
    })
    .catch((e) => console.warn('launch day: film rocket unavailable, using a stand-in', e));
  // Oxygen boil-off venting from the first stage, and frost on its tank.
  const vent = vapour(scene, 46);
  const ventAt = new THREE.Vector3(r * 0.9, mountH + look.s1 * 0.82, 0.3);
  let venting = 1;

  // ---------- Hot spots ----------
  const spots = {};
  const pickables = [];
  const ringMat = () => new THREE.MeshBasicMaterial({ color: 0x3fc1b4, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  function addSpot(id, anchor, approach, face) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 40), ringMat());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(approach.x, 0.03, approach.z);
    scene.add(ring);
    const beaconS = glow(0x3fc1b4, 1.1, 0.8);
    beaconS.position.copy(anchor).add(new THREE.Vector3(0, 0.5, 0));
    scene.add(beaconS);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(anchor);
    hit.userData.spot = id;
    scene.add(hit);
    pickables.push(hit);
    spots[id] = { id, anchor: anchor.clone(), approach: approach.clone(), face, ring, beacon: beaconS, done: false };
  }

  // 1) Remove-before-flight streamers on the safe-and-arm box of the front-right column.
  const fr = cols.find((c) => c.x > 0 && c.z > 0);
  const sa = new THREE.Group();
  sa.position.set(fr.x, 0, fr.z + colW / 2 + 0.12);
  scene.add(sa);
  const saBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.22), new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.5 }));
  saBox.position.y = 1.55;
  sa.add(saBox);
  const tagTex = canvasTex(64, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c8211b';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = `800 30px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('REMOVE BEFORE FLIGHT', 0, 0, h * 0.92);
    ctx.restore();
  });
  const streamers = [];
  [-0.17, 0, 0.17].forEach((x, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.36, 0.12);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.62), new THREE.MeshStandardMaterial({ map: tagTex, side: THREE.DoubleSide, roughness: 0.8 }));
    st.position.y = -0.31;
    pivot.add(st);
    pivot.userData.ph = i * 1.7;
    sa.add(pivot);
    streamers.push(pivot);
  });
  addSpot('rbf', new THREE.Vector3(fr.x, 1.5, fr.z + colW / 2 + 0.2), new THREE.Vector3(fr.x + 0.3, 0, fr.z + colW / 2 + 1.9), 0);

  // 2) The liquid-oxygen fill line and its frosty valve (+X side).
  const pipeZ = -1.2;
  const pipeX0 = legR * 0.75;
  const pipeX1 = apronR + 30;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, pipeX1 - pipeX0, 16), new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.45, metalness: 0.6 }));
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set((pipeX0 + pipeX1) / 2, 0.5, pipeZ);
  scene.add(pipe);
  for (let x = pipeX0 + 3; x < pipeX1; x += 5) {
    const sup = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.6), greyMat);
    sup.position.set(x, 0.16, pipeZ);
    scene.add(sup);
  }
  const valveX = legR + 6;
  const frost = new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.95, metalness: 0 });
  const valve = new THREE.Group();
  valve.position.set(valveX, 0.5, pipeZ);
  const vBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 20), frost);
  vBody.rotation.z = Math.PI / 2;
  const vStem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 10), frost);
  vStem.position.y = 0.55;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 24), new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.5 }));
  wheel.rotation.x = Math.PI / 2;
  wheel.position.y = 0.86;
  valve.add(vBody, vStem, wheel);
  scene.add(valve);
  // A pressure gauge on a post beside it.
  const gauge = textCanvas(128, 128);
  const drawGauge = (k, leak) => {
    const { ctx } = gauge;
    ctx.fillStyle = '#f2f2ee';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1b1e22';
    ctx.stroke();
    ctx.strokeStyle = '#b4302c';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(64, 64, 46, Math.PI * 0.15, Math.PI * 0.45);
    ctx.stroke();
    const a = Math.PI * (0.75 + 1.5 * k);
    ctx.strokeStyle = '#1b1e22';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44);
    ctx.stroke();
    gauge.tex.needsUpdate = true;
  };
  const gaugePost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), greyMat);
  gaugePost.position.set(valveX + 0.9, 0.65, pipeZ + 0.45);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshStandardMaterial({ map: gauge.tex, roughness: 0.4 }));
  dial.position.set(valveX + 0.9, 1.32, pipeZ + 0.5);
  scene.add(gaugePost, dial);
  const leaking = !!opts.leak;
  let leakFixed = false;
  const valveVapour = vapour(scene, 34, 0xf2f6fa);
  addSpot('valve', new THREE.Vector3(valveX, 0.9, pipeZ), new THREE.Vector3(valveX, 0, pipeZ + 2.1), Math.PI);

  // 3) The spacecraft umbilical: a junction box at the tower's foot, a cable up
  //    the tower to the upper arm, and one connector hanging half out.
  const jx = towerX + tw / 2 + 0.9;
  const jz = tw / 2 + 1.0;
  const jbox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 0.55), new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.55, metalness: 0.4 }));
  jbox.position.set(jx, 0.65, jz);
  scene.add(jbox);
  const jpanel = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.4, emissive: 0x0b3a36, emissiveIntensity: 0.9 }));
  jpanel.position.set(jx, 0.9, jz + 0.28);
  scene.add(jpanel);
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.7 });
  const armY = mountH + Lr * 0.86;
  const up = new THREE.CatmullRomCurve3([new THREE.Vector3(jx, 1.2, jz - 0.2), new THREE.Vector3(towerX + tw / 2, 3, tw / 2), new THREE.Vector3(towerX + tw / 2, armY - 1, tw / 2 - 0.2), new THREE.Vector3(towerX + tw / 2 + 0.5, armY - 0.4, 0.3), new THREE.Vector3(-r * 1.02, armY - 0.6, 0.2)]);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(up, 80, 0.07, 6), cableMat));
  const socket = new THREE.Vector3(jx + 0.25, 0.55, jz + 0.3);
  const plug = new THREE.Group();
  const plugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.4, metalness: 0.5 }));
  plug.add(plugBody);
  scene.add(plug);
  const plugLoose = { p: new THREE.Vector3(jx + 0.42, 0.24, jz + 0.55), rz: 1.1 };
  const plugHome = { p: socket.clone().add(new THREE.Vector3(0, 0, 0.1)), rz: 0 };
  let plugK = 0; // 0 loose, 1 seated
  const loopCable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(jx + 0.2, 1.0, jz + 0.25), new THREE.Vector3(jx + 0.7, 0.2, jz + 0.7), plugLoose.p.clone()), 20, 0.03, 5), cableMat);
  scene.add(loopCable);
  addSpot('umbilical', new THREE.Vector3(jx, 0.9, jz + 0.3), new THREE.Vector3(jx + 0.4, 0, jz + 2.1), Math.PI);

  // 4) The service bay of the launch mount with its hatch left open, and maybe
  //    a forgotten wrench on the deck (foreign object debris).
  const hx = -(legR * 0.72) - 3.4;
  const hz = legR * 0.72 + 7.5;
  const bay = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 1.4), mountMat);
  bay.position.set(hx, 1.0, hz);
  scene.add(bay);
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.5), new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0xffd9a0, emissiveIntensity: 0.55 }));
  inside.position.set(hx + 0.2, 0.95, hz + 0.705);
  scene.add(inside);
  const doorPivot = new THREE.Group();
  doorPivot.position.set(hx - 0.3, 0.95, hz + 0.72);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.55, 0.05), new THREE.MeshStandardMaterial({ color: 0x7c8289, roughness: 0.6, metalness: 0.4 }));
  door.position.x = 0.5;
  doorPivot.add(door);
  doorPivot.rotation.y = -1.9;
  scene.add(doorPivot);
  let doorK = 0; // 0 open, 1 closed
  const wrench = new THREE.Group();
  const wMat = new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 0.85, roughness: 0.3 });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.05), new THREE.MeshStandardMaterial({ color: 0xe0661c, roughness: 0.5 }));
  const headA = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.018, 6, 12), wMat);
  headA.rotation.x = Math.PI / 2;
  headA.position.x = 0.25;
  wrench.add(handle, headA);
  wrench.position.set(hx + 1.0, 0.03, hz + 1.5);
  wrench.rotation.y = 0.6;
  wrench.visible = !!opts.fod;
  const glint = glow(0xfff2c8, 0.45, 0.9);
  glint.position.set(0.25, 0.06, 0);
  wrench.add(glint);
  scene.add(wrench);
  addSpot('hatch', new THREE.Vector3(hx, 1.1, hz + 0.7), new THREE.Vector3(hx + 0.2, 0, hz + 2.6), Math.PI);

  // ---------- The firing room, 400 m away, looking at the pad ----------
  // Room coordinates: the window wall at z = -3.5, the director's desk at
  // DIR.x, z = 2.6; the stations' consoles in a row in front of it.
  const room = new THREE.Group();
  room.position.set(0, 0, ROOM_Z);
  scene.add(room);
  const DIR = { x: 4.5, z: 2.6 };
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x31363d, roughness: 0.85 });
  const W = 24;
  const RX = 2; // room centre x
  const D0 = -3.5;
  const D1 = 13;
  const DEPTH = D1 - D0;
  const DZ = (D0 + D1) / 2;
  const winH0 = 0.8;
  const winH1 = 4.2;
  const ceil = 5.0;
  const addBox = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    room.add(m);
    return m;
  };
  addBox(W, 0.2, DEPTH, RX, -0.1, DZ, floorMat);
  addBox(W, 0.2, DEPTH, RX, ceil + 0.1, DZ, wallMat);
  addBox(W, ceil, 0.2, RX, ceil / 2, D1, wallMat);
  addBox(0.2, ceil, DEPTH, RX - W / 2, ceil / 2, DZ, wallMat);
  addBox(0.2, ceil, DEPTH, RX + W / 2, ceil / 2, DZ, wallMat);
  addBox(W, winH0, 0.3, RX, winH0 / 2, D0, wallMat);
  addBox(W, ceil - winH1, 0.3, RX, (ceil + winH1) / 2, D0, wallMat);
  for (let x = RX - W / 2; x <= RX + W / 2 + 0.01; x += 3) addBox(0.16, winH1 - winH0, 0.24, x, (winH0 + winH1) / 2, D0, wallMat);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, winH1 - winH0), new THREE.MeshBasicMaterial({ color: 0x5a7a9a, transparent: true, opacity: 0.07, depthWrite: false }));
  glass.position.set(RX, (winH0 + winH1) / 2, D0 + 0.05);
  room.add(glass);
  // Ceiling light strips, room light and console glow.
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x8f9fb4 });
  [1, 5, 9].forEach((z) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(W - 3, 0.18), stripMat);
    s.rotation.x = Math.PI / 2;
    s.position.set(RX, ceil - 0.01, z);
    room.add(s);
  });
  const roomLight = new THREE.PointLight(0x9fb4d0, 34, 24, 2);
  roomLight.position.set(RX, 4.4, 5);
  const deskLight = new THREE.PointLight(0x5fd6c8, 10, 8, 2);
  deskLight.position.set(DIR.x, 1.7, DIR.z - 0.6);
  room.add(roomLight, deskLight);
  // The countdown clock above the window.
  const clock = textCanvas(1024, 160);
  const clockMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.62), new THREE.MeshBasicMaterial({ map: clock.tex, toneMapped: false }));
  clockMesh.position.set(DIR.x - 0.5, (winH1 + ceil) / 2, D0 + 0.17);
  room.add(clockMesh);
  function setClock(text, sub, color = '#f0b429') {
    const { ctx, c } = clock;
    ctx.fillStyle = '#05080c';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = color;
    ctx.font = `800 104px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, 30, 84, 660);
    ctx.fillStyle = '#a9b6c2';
    ctx.font = `700 46px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(sub || '', c.width - 30, 84, 320);
    clock.tex.needsUpdate = true;
  }
  setClock('T-00:10:00', 'HOLD');

  // Consoles: five stations in the front row, the director's desk behind.
  const consoleMat = new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.6, metalness: 0.2 });
  const screens = {};
  const names = opts.stationNames || {};
  const STATUS_COL = { idle: '#22344a', go: '#17807a', hold: '#b57d00', nogo: '#b4302c' };
  function drawScreen(id, status) {
    const s = screens[id];
    if (!s) return;
    const { ctx, c } = s;
    ctx.fillStyle = '#0c141c';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = STATUS_COL[status] || STATUS_COL.idle;
    ctx.fillRect(0, 0, c.width, 46);
    ctx.fillStyle = '#e9eef2';
    ctx.font = `800 30px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(names[id] || id, c.width / 2, 24, c.width - 16);
    // A little live trace, so the screens look busy.
    ctx.strokeStyle = 'rgba(63,193,180,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = 12 + (i / 40) * (c.width - 24);
      const y = 110 + Math.sin(i * 0.6 + s.ph) * 18 + Math.sin(i * 1.7 + s.ph * 2) * 8;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    if (status === 'go' || status === 'hold' || status === 'nogo') {
      ctx.fillStyle = STATUS_COL[status];
      ctx.font = `900 34px ${FONT}`;
      const words = opts.statusWords || { go: 'GO', hold: 'HOLD', nogo: 'NO-GO' };
      ctx.fillText(words[status], c.width / 2, 150, c.width - 16);
    }
    s.tex.needsUpdate = true;
  }
  const consolePos = {};
  STATIONS.forEach((id, i) => {
    const x = RX + (i - 2) * 3.0;
    const z = -0.6;
    addBox(2.4, 0.78, 0.9, x, 0.39, z, consoleMat);
    const tc = textCanvas(256, 176);
    screens[id] = { ...tc, ph: i * 1.3, status: 'idle' };
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.76), new THREE.MeshBasicMaterial({ map: tc.tex, toneMapped: false }));
    scr.position.set(x, 1.2, z - 0.25);
    scr.rotation.x = -0.18; // faces the operators (+Z), tipped back
    room.add(scr);
    drawScreen(id, 'idle');
    consolePos[id] = new THREE.Vector3(x, 1.2, ROOM_Z + z);
  });
  addBox(3.2, 0.78, 1.0, DIR.x, 0.39, DIR.z, consoleMat);
  const dirScr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshStandardMaterial({ color: 0x0c141c, emissive: 0x17807a, emissiveIntensity: 0.2 }));
  dirScr.position.set(DIR.x, 1.18, DIR.z - 0.25);
  dirScr.rotation.x = -0.2;
  room.add(dirScr);

  // ---------- The astronaut ----------
  const T2 = (k, en, p) => (SMD && SMD.t ? SMD.t(k, en, p) : en);
  const spotItems = () =>
    Object.values(spots).map((sp) => ({
      id: sp.id,
      at: sp.approach,
      radius: 2.6,
      ring: false,
      promptAt: sp.anchor.clone().add(new THREE.Vector3(0, 0.9, 0)),
      enabled: () => !sp.done,
      label: () => (opts.spotLabel ? opts.spotLabel(sp.id) : T2('ld.p.inspect', 'Inspect')),
      onInteract: () => !frozen && mode === 'walk' && opts.onSpot && opts.onSpot(sp.id),
    }));
  let astro = null;
  try {
    astro = createAstronaut(opts.appearance || (SMD.avatar ? SMD.avatar.get() : null), { helmet: false, shadows: false });
  } catch (e) {
    console.warn('launch day astronaut unavailable', e);
  }
  const startPos = new THREE.Vector3(legR * 0.4, 0, legR * 0.72 + 13);
  const obstacles = cols.map((c) => ({ x: c.x, z: c.z, r: colW * 0.9 }));
  obstacles.push({ x: 0, z: 0, r: legR * 0.55 });
  obstacles.push({ x: towerX, z: 0, r: tw * 0.85 });
  obstacles.push({ x: jx, z: jz, r: 0.75 });
  obstacles.push({ x: hx, z: hz, r: 1.35 });
  obstacles.push(...masts);
  for (let x = pipeX0; x < apronR + 4; x += 1.1) obstacles.push({ x, z: pipeZ, r: 0.45 });
  for (let z = -legR - 1; z > -apronR; z -= 2) obstacles.push({ x: 0, z, r: r * 1.6 + 0.4 });
  if (astro) {
    astro.group.position.copy(startPos);
    astro.group.rotation.y = Math.PI; // faces the rocket (-Z)
    scene.add(astro.group);
  }
  // The controller walks and films the director on the pad. The opening crane
  // shot and the firing room / countdown cameras are the scene's own.
  const ctl = astro
    ? createController({
        camera,
        dom: getRenderer().domElement,
        character: astro,
        applyCamera: false,
        walkable: { inside: { x: 0, z: 0, r: apronR - 2 }, circles: obstacles },
        cameraCircles: [
          { x: 0, z: 0, r: legR * 0.9, h: mountH + Lr },
          { x: towerX, z: 0, r: tw * 0.75, h: mountH + Lr + 10 },
        ],
        rig: { distance: 7, height: 1.6, shoulder: 0.55, min: 2.4, max: 16, pitch: [-0.35, 1.1], pitch0: 0.2, fov: 50, floorY: 0 },
        speeds: { walk: 2.2, run: 5, accel: 12, turn: 11 },
      })
    : null;
  const tapPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const tapHit = new THREE.Vector3();
  // A work light that follows the astronaut, so the character always reads.
  const workLight = new THREE.PointLight(0xfff1dc, 4, 8, 2);
  scene.add(workLight);

  // ---------- Cameras ----------
  let mode = 'walk';
  let frozen = false;
  let intro = reduced ? 1 : 0;
  if (ctl) {
    ctl.setInteractables(spotItems());
    // Taps: a hot spot walks there and opens it; the ground walks there.
    ctl.on('tap', (info) => {
      if (mode !== 'walk' || frozen) return false;
      const ray = ctl.ray(info);
      const hit = ray.intersectObjects(pickables, false)[0];
      if (hit) {
        api.goToSpot(hit.object.userData.spot);
        return true;
      }
      if (info.preferLook) return false;
      if (ray.ray.intersectPlane(tapPlane, tapHit)) {
        pendingSpot = null;
        ctl.moveTo({ x: tapHit.x, z: tapHit.z });
        ctl.mark(tapHit);
        return true;
      }
      return false;
    });
  }
  const follow = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  let near = null;
  let pendingSpot = null;
  let t = 0;

  function followTarget(out, look) {
    if (ctl) {
      out.copy(ctl.view.position);
      look.copy(ctl.view.target);
      return;
    }
    const p = startPos;
    out.set(p.x, p.y + 2.3, p.z + 8.4);
    look.set(p.x, p.y + 3.3, p.z - 3);
  }
  followTarget(follow.pos, follow.look);

  // Firing room: behind and beside the director, the pad through the window.
  const roomCam = { pos: new THREE.Vector3(7.0, 2.15, ROOM_Z + 10.6), look: new THREE.Vector3(20, 8, 0) };
  // Countdown: low on the pad, looking up at the venting rocket.
  const padCam = { pos: new THREE.Vector3(legR * 1.4 + 10, 1.6, legR * 1.2 + 22), look: new THREE.Vector3(0, mountH + Lr * 0.42, 0) };
  let roomLook = null; // the director looks at a console during the poll

  let modeT = 0;
  function setMode(m) {
    mode = m;
    modeT = t;
    applyFov();
    if (ctl) {
      ctl.stop();
      ctl.setEnabled(m === 'walk' && !frozen);
      ctl.setCameraActive(m === 'walk' && intro >= 1);
    }
    if (m === 'control' && astro) {
      if (ctl) ctl.teleport({ x: DIR.x, y: 0, z: ROOM_Z + DIR.z + 1.0 }, Math.PI);
      astro.setMove(0);
      astro.lookAt(null);
    }
    if (m === 'walk' && astro && astro.group.position.z > ROOM_Z - 50 && ctl) ctl.teleport(startPos, Math.PI);
    Object.values(spots).forEach((s) => {
      s.ring.visible = m === 'walk' && !s.done;
      s.beacon.visible = m === 'walk' && !s.done;
    });
  }

  // ---------- Per-frame ----------
  const pinList = Object.keys(spots).map((id) => ({ id, x: 0, y: 0, on: false, near: false }));
  function update(dt) {
    t += dt;
    // Beacon blink, streamers in the breeze, rings pulsing.
    beacon.material.opacity = Math.sin(t * 5) > 0 ? 1 : 0.15;
    streamers.forEach((s) => (s.rotation.x = Math.sin(t * 2.3 + s.userData.ph) * 0.22 + 0.08));
    const pulse = 0.55 + 0.35 * Math.sin(t * 4);
    Object.values(spots).forEach((s) => {
      s.ring.material.opacity = pulse;
      s.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 4));
      s.beacon.material.opacity = 0.35 + 0.45 * pulse;
    });
    glint.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(t * 3.1)) ** 6;
    // The gauge needle: a leak wobbles in the red, frost sits steady.
    if (Math.floor(t * 10) % 2 === 0) drawGauge(leaking && !leakFixed ? 0.25 + 0.03 * Math.sin(t * 9) : 0.55, leaking);
    // Vapour.
    if (venting > 0.01 && !reduced) {
      if (Math.random() < 0.6 * venting) vent.emit(ventAt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6, 0)), new THREE.Vector3(1.2 + Math.random(), -0.4, (Math.random() - 0.5) * 0.6), 3.5, r * 0.6, r * 2.8, 0.38);
      const strong = leaking && !leakFixed;
      if (Math.random() < (strong ? 0.9 : 0.18)) valveVapour.emit(new THREE.Vector3(valveX + (strong ? 0.45 : 0), 0.62, pipeZ + 0.2), new THREE.Vector3(strong ? 1.6 : 0.1, strong ? 0.25 : 0.12, 0.35), strong ? 1.6 : 2.2, 0.18, strong ? 1.1 : 0.6, strong ? 0.6 : 0.3);
    }
    vent.update(dt);
    valveVapour.update(dt);
    // Umbilical plug and hatch door.
    const pk = plugK;
    plug.position.lerpVectors(plugLoose.p, plugHome.p, pk);
    plug.rotation.set(Math.PI / 2 * pk + (1 - pk) * 0.4, 0, plugLoose.rz * (1 - pk));
    loopCable.visible = pk < 0.5;
    if (spots.umbilical.done && plugK < 1) plugK = Math.min(1, plugK + dt * 3);
    if (spots.hatch.done && doorK < 1) doorK = Math.min(1, doorK + dt * 1.6);
    doorPivot.rotation.y = lerp(-1.9, 0, smooth(0, 1, doorK));
    inside.material.emissiveIntensity = 0.55 * (1 - doorK);

    // Walking: the controller (keys, stick, thumb, taps) moves and films.
    if (ctl) {
      if (mode === 'walk') ctl.setEnabled(!frozen && intro >= 1);
      ctl.update(dt);
    } else if (astro) astro.update(dt);
    if (mode === 'walk' && ctl && astro) {
      if (ctl.state.inputActive) pendingSpot = null;
      // The hot spot in front of you (the controller's target).
      const p = astro.group.position;
      const tg = ctl.state.target;
      const best = tg ? tg.id : null;
      if (best !== near) {
        near = best;
        if (opts.onNear) opts.onNear(near);
        astro.lookAt(near ? spots[near].anchor : null);
      }
      const cy = ctl.camYaw;
      workLight.position.set(p.x + Math.sin(cy) * 2, p.y + 2.6, p.z + Math.cos(cy) * 2);
    } else if (astro) {
      workLight.position.set(DIR.x + 1.5, 2.6, ROOM_Z + DIR.z + 3.2);
    }

    // Camera.
    if (mode === 'walk') {
      followTarget(follow.pos, follow.look);
      if (intro < 1) {
        // Opening crane: from beside the nose cone down to the astronaut.
        intro = Math.min(1, intro + dt / 3.2);
        const e = smooth(0, 1, intro);
        const craneP = tmp.set(legR * 2 + 16, mountH + Lr * 1.05, legR + 26);
        const craneL = tmp2.set(0, mountH + Lr * 0.8, 0);
        camera.position.lerpVectors(craneP, follow.pos, e);
        camera.lookAt(craneL.lerp(follow.look, e));
        if (Math.abs(camera.fov - 50) > 0.01 && aspect >= 1) {
          camera.fov = 50;
          camera.updateProjectionMatrix();
        }
        if (intro >= 1 && ctl) ctl.setCameraActive(true, { instant: true });
      } else if (!ctl) {
        camera.position.copy(follow.pos);
        camera.lookAt(follow.look);
      }
    } else if (mode === 'control') {
      // Portrait phones show the room above a bottom sheet: aim low so the
      // rocket sits high in the window.
      if (aspect < 0.9) {
        camera.position.set(3.4, 2.2, ROOM_Z + 10.4);
        if (!reduced) camera.position.x += Math.sin(t * 0.25) * 0.1;
        camera.lookAt(tmp.set(0, -112, 0));
      } else {
        camera.position.copy(roomCam.pos);
        if (!reduced) camera.position.x += Math.sin(t * 0.25) * 0.15;
        camera.lookAt(roomCam.look);
      }
    } else if (mode === 'pad') {
      const k = reduced ? 0 : Math.min(1, (t - modeT) * 0.08);
      camera.position.copy(padCam.pos).add(tmp.set(-k * 4, k * 2, -k * 6));
      camera.lookAt(padCam.look);
    }

    // Pins for the HTML hot-spot buttons.
    if (opts.onPins) {
      const w = vp.w;
      const h = vp.h;
      pinList.forEach((pin) => {
        const s = spots[pin.id];
        tmp.copy(s.anchor).add(tmp2.set(0, 0.9, 0)).project(camera);
        pin.x = ((tmp.x + 1) / 2) * w;
        pin.y = ((1 - tmp.y) / 2) * h;
        pin.on = mode === 'walk' && intro >= 1 && tmp.z < 1 && tmp.z > -1 && pin.x > -40 && pin.x < w + 40 && pin.y > -40 && pin.y < h + 40;
        pin.done = s.done;
        pin.near = near === pin.id;
      });
      opts.onPins(pinList);
    }
  }

  const vp = { w: 1440, h: 900 };
  function onResize(w, h) {
    vp.w = w;
    vp.h = h;
    aspect = w / h;
    applyFov();
  }
  // Portrait phones get a wider vertical view; the firing room uses a longer
  // lens so the far rocket reads through the window.
  function applyFov() {
    camera.aspect = aspect;
    camera.fov = mode === 'control' ? (aspect < 0.9 ? 58 : 36) : aspect < 1 ? 62 : 50;
    camera.updateProjectionMatrix();
    if (ctl) ctl.setRig({ fov: aspect < 1 ? 62 : 50, distance: aspect < 1 ? 8.5 : 7 });
  }

  const api = {
    scene,
    camera,
    update,
    onResize,
    exposure: 1.05,
    shadows: false,
    get astronaut() {
      return astro;
    },
    get mode() {
      return mode;
    },
    get near() {
      return near;
    },
    // The shared character controller (docs/CONTROLS.md), for scripts.
    get controller() {
      return ctl;
    },
    attach() {},
    setMode,
    // Freeze walking while a card is open.
    freeze(on) {
      frozen = !!on;
      if (ctl) {
        if (frozen) ctl.stop();
        ctl.setEnabled(!frozen && mode === 'walk' && intro >= 1);
      }
    },
    skipIntro() {
      intro = 1;
      if (ctl && mode === 'walk') ctl.setCameraActive(true, { instant: true });
    },
    // Walk to a hot spot, face it, then ask the screen to open its card.
    goToSpot(id) {
      const s = spots[id];
      if (!s || !ctl || mode !== 'walk' || frozen) return;
      pendingSpot = id;
      ctl.moveTo(s.approach, {
        run: Math.hypot(s.approach.x - astro.group.position.x, s.approach.z - astro.group.position.z) > 8,
        onArrive: () => {
          if (pendingSpot !== id) return;
          pendingSpot = null;
          astro.group.rotation.y = Math.atan2(s.anchor.x - astro.group.position.x, s.anchor.z - astro.group.position.z);
          astro.lookAt(s.anchor);
          if (opts.onSpot) opts.onSpot(id);
        },
      });
    },
    // A hot spot was dealt with: show it in the world.
    setSpot(id, how = {}) {
      const s = spots[id];
      if (!s) return;
      s.done = true;
      s.ring.visible = false;
      s.beacon.visible = false;
      if (id === 'rbf') streamers.forEach((x) => (x.visible = false));
      if (id === 'valve' && how.fixed) leakFixed = true;
      if (id === 'hatch' && how.swept) wrench.visible = false;
      if (astro && how.react) astro.cheer({ duration: 0.9 });
      if (near === id) {
        near = null;
        if (opts.onNear) opts.onNear(null);
      }
    },
    // The pad crew sorts out whatever the walkdown missed (after a hold or a scrub).
    crewFix(id) {
      const s = spots[id];
      if (!s) return;
      s.done = true;
      if (id === 'rbf') streamers.forEach((x) => (x.visible = false));
      if (id === 'valve') leakFixed = true;
    },
    setStation(id, status) {
      if (!screens[id] || screens[id].status === status) return;
      screens[id].status = status;
      drawScreen(id, status);
    },
    lookAtStation(id) {
      if (!astro) return;
      roomLook = id ? consolePos[id] : null;
      astro.lookAt(roomLook ? roomLook.clone() : null);
    },
    react(kind) {
      if (!astro) return;
      if (kind === 'go') astro.cheer({ duration: 1.2 });
      else if (kind === 'yay') astro.celebrate();
      else if (kind === 'scrub') astro.sad();
      else if (kind === 'wave') astro.wave();
    },
    setClock,
    setVenting(k) {
      venting = k;
    },
    dispose() {
      disposed = true;
      if (ctl) ctl.dispose();
      if (astro) astro.dispose();
      [gauge.tex, clock.tex, ...Object.values(screens).map((s) => s.tex)].forEach((x) => x.dispose());
    },
  };
  setMode('walk');
  return api;
}
