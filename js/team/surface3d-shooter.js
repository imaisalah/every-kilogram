// Third-person and first-person play on the surface (docs/TEAM-SURFACE.md). One
// player on their own screen: over the shoulder by default, V for first person,
// where you see your gloved hands holding the scanner. The camera, the input
// and the eye-level overlays (a small radar, the goal marker, the help card)
// live here; the sim still owns where everyone is, in 2D.
//
// Feel (docs/GRAVITY.md, docs/CONTROLS.md): a spring-arm camera with lag and
// collision, aim zoom (right button / LT), shoulder swap (C / right-stick click),
// a sprint lens kick, head-bob only in first person; the body faces where it
// moves, strafes and back-pedals while aiming, leans into turns by a = v·ω vs g,
// turns head and chest toward the aim, breathes, hops (Space / B) as high and as
// long as gravity allows, and kicks up dust that flies like it would on that world.
//
//   const sh = createShooter({ renderer, stage, myId, S, audio, onPause, solo });
//   sh.frame(dt, t, state);   // before the renderer draws
//   sh.input();               // sim input for this player, this frame
//   sh.raw();                 // the same as a compact controller message
//   sh.setActive(bool);       // false during landing, launch and pause
//   sh.view                   // 'tpp' | 'fpp' | 'group'
//   sh.yaw                    // the body's facing (sim heading convention)
//   sh.dispose();
import { THREE } from '../3d/engine.js';
import { makeScanner, ROLE_COLORS, SITE_COLORS, realGravityOn } from './surface3d-actors.js';
import { lampify, reducedMotion, createParticles } from './surface3d-fx.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});
const t_ = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : e);
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dampAngle = (a, b, rate, dt) => a + wrap(b - a) * (1 - Math.exp(-rate * dt));
const VIEW_KEY = 'ek-surface-view';
const EARTH_G = 9.81;

export function loadView() {
  try {
    const v = SMD.store ? SMD.store.get(VIEW_KEY) : localStorage.getItem(VIEW_KEY);
    return v === 'fpp' || v === 'group' ? v : 'tpp';
  } catch (e) {
    return 'tpp';
  }
}
function saveView(v) {
  try {
    if (SMD.store) SMD.store.set(VIEW_KEY, v);
    else localStorage.setItem(VIEW_KEY, v);
  } catch (e) {}
}

// Tuning: distances in metres, angles in radians, rates per second.
const RIG = {
  tpp: { dist: 4.5, height: 1.62, shoulder: 0.72, fov: 58 },
  aim: { dist: 2.5, height: 1.58, shoulder: 0.62, fov: 46 },
  fpp: { eye: 1.66, fov: 74, aimFov: 60 },
  pitchMin: -1.15,
  pitchMax: 1.2,
  sprintFov: 7, // the lens widens this much at a full sprint (not with reduced motion)
  lagTpp: 22, // spring-arm stiffness (critically damped, 1/s): lag 2v/ω, ~0.7 m at a full run
  lagFpp: 45,
  lagY: 7, // the camera rides over bounds and hops softly
};
// Sticks: a radial dead zone, then a power curve (fine aim near the centre).
const PAD = { moveDead: 0.15, lookDead: 0.13, outer: 0.95, moveCurve: 1.0, lookCurve: 1.7, lookYaw: 3.4, lookPitch: 2.3, boost: 1.6, boostAfter: 0.3 };

// Radial dead zone + response curve, for the tests' sake kept pure.
export function stickCurve(x, y, dead, outer, curve) {
  const m = Math.hypot(x, y);
  if (!(m > dead)) return [0, 0];
  const k = Math.pow(clamp((m - dead) / (outer - dead)), curve);
  return [(x / m) * k, (y / m) * k];
}

export function createShooter(o) {
  const { renderer, stage, myId } = o;
  const S = o.S || (SMD.team && SMD.team.surface) || null;
  const camera = renderer.camera;
  const scene = renderer.scene;
  const world = renderer.world;
  const reduced = reducedMotion();
  const cfg = renderer.worldConfig || {};
  // The world: from the first state, guessed from the renderer's gravity until then.
  let worldId = null;
  if (S && S.GRAVITY && cfg.gravity) {
    let best = 9;
    for (const k in S.GRAVITY) {
      const d = Math.abs(S.GRAVITY[k] - Math.abs(cfg.gravity));
      if (d < best && d < 0.2) (best = d), (worldId = k);
    }
  }

  let view = loadView();
  let active = false;
  // Camera look: the target (input lands here) and the applied value (smoothed if asked).
  let yawT = -Math.PI / 2; // looking up the map
  let pitchT = -0.1;
  let yaw = yawT;
  let pitch = pitchT;
  let face = yawT; // the body's facing, in the sim's heading convention
  let viewK = view === 'fpp' ? 1 : 0; // 0 third person, 1 first person
  let aimK = 0;
  let side = 1; // shoulder: 1 right, -1 left
  let sideK = 1;
  let sprintK = 0;
  let camDist = RIG.tpp.dist;
  const piv = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0 };
  let ready = false;
  let locked = false;
  let releasing = false;
  let held = false; // a panel needs the mouse (the ascent choice): no capture
  let everLocked = false; // the "click to look around" hint shows until the first capture
  let hintSince = 0;
  let device = 'keyboard';
  let helpOpen = false;
  let lookIdle = 9; // seconds since the player last turned the camera
  let padBoost = 0;
  const keys = new Set();
  const edges = new Set();
  const mouse = { use: false, aim: false };
  const inp = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, use: false, ability: false, sprint: false, shooter: true, dropBtn: false, g: 0, earthG: false };
  const canvasOf = () => stage.querySelector('canvas');
  // What the body is doing (presentation): measured from where the renderer draws it.
  const body = { x: 0, z: 0, vx: 0, vz: 0, speed: 0, moveYaw: 0, prevMoveYaw: 0, turnRate: 0, still: 0, reverse: false, lean: 0, aiming: false, init: false };
  const gaitCam = { ph: 0, bob: 0, sway: 0, lastStep: 0 };
  const hop = { t: -1, air: 0, h: 0, cool: 0 };
  let guideShown = false;
  let guideTimer = 0;
  const stats = { steps: 0, hops: 0 };

  // ---------- Settings ----------
  const setting = (k, d) => {
    try {
      const v = SMD.settings ? SMD.settings[k] : undefined;
      return v === undefined || v === null ? d : v;
    } catch (e) {
      return d;
    }
  };
  const sens = () => (Number(setting('lookSpeed', 1)) || 1) * 0.0021;
  const invert = () => (setting('invertY', false) ? -1 : 1);
  const feelG = () => (S && S.feelG ? S.feelG(worldId || 'moon', realGravityOn()) : EARTH_G);

  // ---------- Pointer lock: click to capture, Esc to free (and pause), never a trap ----------
  function capture() {
    if (locked || helpOpen || !active || held) return;
    const c = canvasOf();
    if (c && c.requestPointerLock) {
      const p = c.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }
  }
  function release() {
    if (document.pointerLockElement) {
      releasing = true;
      document.exitPointerLock();
    }
  }
  const onLockChange = () => {
    const was = locked;
    locked = document.pointerLockElement === canvasOf() && !!canvasOf();
    if (locked) {
      device = 'keyboard';
      everLocked = true;
    }
    if (!locked) mouse.use = mouse.aim = false;
    // Esc out of the mouse capture in a solo game is a pause, like any other game.
    if (was && !locked && !releasing && active && o.solo && o.onPause) o.onPause();
    releasing = false;
    paintHint();
  };
  // Every look input lands on the target; the frame applies it (smoothed or not).
  function look(dx, dy, scale = 1) {
    yawT = wrap(yawT + dx * sens() * scale);
    pitchT = clamp(pitchT - dy * sens() * scale * invert(), RIG.pitchMin, RIG.pitchMax);
    if (Math.abs(dx) + Math.abs(dy) > 0.5) lookIdle = 0;
  }
  const onMove = (e) => {
    if (locked) look(e.movementX || 0, e.movementY || 0);
  };
  const onDown = (e) => {
    if (!active || helpOpen) return;
    if (!locked) {
      if (!e.target || !e.target.closest || !e.target.closest('button')) capture();
      return;
    }
    if (e.button === 0) mouse.use = true;
    if (e.button === 2) mouse.aim = true;
  };
  const onUp = (e) => {
    if (e.button === 0) mouse.use = false;
    if (e.button === 2) mouse.aim = false;
  };
  const noMenu = (e) => e.preventDefault();
  const GAME = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyQ', 'KeyV', 'KeyH', 'Space', 'KeyX', 'KeyC']);
  const onKeyDown = (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (GAME.has(e.code)) e.preventDefault();
    if (!keys.has(e.code)) edges.add(e.code);
    keys.add(e.code);
    device = 'keyboard';
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => {
    keys.clear();
    mouse.use = mouse.aim = false;
  };
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('mousemove', onMove);
  stage.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  stage.addEventListener('contextmenu', noMenu);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // ---------- Touch: left thumb moves, right side looks (both smoothed) ----------
  const touch = { moveId: null, lookId: null, mx: 0, my: 0, smx: 0, smy: 0, lookX: 0, lookY: 0, baseX: 0, baseY: 0, use: false, ability: false, hop: false, on: false };
  const onTouchStart = (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    device = 'touch';
    touch.on = true;
    for (const p of e.changedTouches) {
      if (p.clientX < stage.clientWidth * 0.42 && touch.moveId === null) {
        touch.moveId = p.identifier;
        touch.baseX = p.clientX;
        touch.baseY = p.clientY;
      } else if (touch.lookId === null) {
        touch.lookId = p.identifier;
        touch.lookX = p.clientX;
        touch.lookY = p.clientY;
      }
    }
    e.preventDefault();
  };
  const onTouchMove = (e) => {
    for (const p of e.changedTouches) {
      if (p.identifier === touch.moveId) {
        const [x, y] = stickCurve((p.clientX - touch.baseX) / 56, (p.clientY - touch.baseY) / 56, 0.12, 1, 1);
        touch.mx = x;
        touch.my = y;
      } else if (p.identifier === touch.lookId) {
        look((p.clientX - touch.lookX) * 2.4, (p.clientY - touch.lookY) * 2.4);
        touch.lookX = p.clientX;
        touch.lookY = p.clientY;
      }
    }
    e.preventDefault();
  };
  const onTouchEnd = (e) => {
    for (const p of e.changedTouches) {
      if (p.identifier === touch.moveId) {
        touch.moveId = null;
        touch.mx = touch.my = 0;
      }
      if (p.identifier === touch.lookId) touch.lookId = null;
    }
  };
  stage.addEventListener('touchstart', onTouchStart, { passive: false });
  stage.addEventListener('touchmove', onTouchMove, { passive: false });
  stage.addEventListener('touchend', onTouchEnd);
  stage.addEventListener('touchcancel', onTouchEnd);

  // ---------- Overlays ----------
  const hud = document.createElement('div');
  hud.className = 'tv-shoot';
  hud.innerHTML = `
    <div class="tv-helmet"></div>
    <div class="tv-dotsight"></div>
    <div class="tv-diamond"><i></i><span></span></div>
    <canvas class="tv-radar" width="200" height="200"></canvas>
    <div class="tv-grab" hidden></div>
    <div class="tv-viewname"></div>
    <div class="tv-tbtns" hidden>
      <button data-t="use">${t_('team.surface.use', 'Use')}</button>
      <button data-t="ability">${t_('team.surface.ability', 'Ability')}</button>
      <button data-t="hop">${t_('team.surface.hop', 'Hop')}</button>
      <button data-t="view">${t_('team.surface.view', 'View')}</button>
    </div>
    <div class="tv-help" hidden><div class="tv-help-card"></div></div>`;
  stage.appendChild(hud);
  const $ = (s) => hud.querySelector(s);
  const radarCanvas = $('.tv-radar');
  const radar = radarCanvas.getContext('2d');
  $('.tv-tbtns')
    .querySelectorAll('[data-t]')
    .forEach((b) => {
      const k = b.dataset.t;
      const set = (v) => (e) => {
        e.preventDefault();
        if (k === 'view') {
          if (v) toggleView();
        } else if (k === 'hop') {
          if (v) edges.add('Space');
        } else touch[k] = v;
      };
      b.addEventListener('touchstart', set(true), { passive: false });
      b.addEventListener('touchend', set(false), { passive: false });
      b.addEventListener('touchcancel', set(false), { passive: false });
    });
  // Once, small, just under the aim point; gone after the first capture or 12 s,
  // and never while a panel (the ascent choice) is open.
  function paintHint() {
    const el = $('.tv-grab');
    let show = active && !locked && !touch.on && device === 'keyboard' && !helpOpen && !held && !everLocked;
    if (show) {
      const now = performance.now();
      if (!hintSince) hintSince = now;
      if (now - hintSince > 12000) show = false;
    }
    el.hidden = !show;
    if (show) el.textContent = t_('team.surface.capture', 'Click to look around');
    hud.classList.toggle('tv-locked', locked);
  }
  function paintHelp() {
    $('.tv-help').hidden = !helpOpen;
    if (!helpOpen) return;
    const L = (a, b) => `<dt>${a}</dt><dd>${b}</dd>`;
    $('.tv-help-card').innerHTML = `<h2>${t_('team.surface.controls', 'Controls')}</h2>
      <dl>
      ${L('W A S D', t_('team.surface.c.move', 'Walk'))}
      ${L('Shift', t_('team.surface.c.sprint', 'Hurry (uses more air)'))}
      ${L(t_('team.surface.c.mouse', 'Mouse'), t_('team.surface.c.look', 'Look around'))}
      ${L(t_('team.surface.c.useKeys', 'E or left button'), t_('team.surface.c.use', 'Use: hold to scan, plant the dish; tap to pick up'))}
      ${L(t_('team.surface.c.rmb', 'Right button'), t_('team.surface.c.aimLook', 'Aim: face where you look, step sideways'))}
      ${L(t_('team.surface.c.space', 'Space'), t_('team.surface.c.hop', 'Hop (as high as the gravity allows)'))}
      ${L('C', t_('team.surface.c.shoulder', 'Other shoulder'))}
      ${L('Q', t_('team.surface.c.ability', 'Role skill'))}
      ${L('V', t_('team.surface.c.view', 'Third / first person'))}
      ${L('Esc', t_('team.surface.c.esc', 'Free the mouse and pause'))}
      </dl>
      <button class="tv-help-b" data-a="group">${view === 'group' ? t_('team.surface.c.tpv', 'Back to behind-the-shoulder') : t_('team.surface.c.groupv', 'Switch to the top-down view')}</button>
      <button class="tv-help-b" data-a="close">${t_('team.surface.close', 'Close')}</button>`;
    $('.tv-help-card')
      .querySelectorAll('[data-a]')
      .forEach((b) =>
        b.addEventListener('click', () => {
          if (b.dataset.a === 'group') setView(view === 'group' ? 'tpp' : 'group');
          helpOpen = false;
          paintHelp();
          paintHint();
        })
      );
  }
  function setView(v, quiet) {
    view = v;
    saveView(v);
    renderer.setShooter(view === 'group' ? null : api);
    // The label only answers a change the player made (not the first view, under the landing).
    if (!quiet) showName();
  }
  function toggleView() {
    setView(view === 'fpp' ? 'tpp' : 'fpp');
  }
  let nameT = 0;
  function showName(text) {
    const el = $('.tv-viewname');
    el.textContent = text || (view === 'fpp' ? t_('team.surface.v.fpp', 'First person') : view === 'tpp' ? t_('team.surface.v.tpp', 'Third person') : t_('team.surface.v.group', 'Top-down view'));
    el.classList.add('show');
    nameT = 1.3;
  }

  // ---------- First person: gloved hands holding the scanner ----------
  const vm = new THREE.Group();
  vm.visible = false;
  camera.add(vm);
  scene.add(camera);
  const lamps = renderer.lamps;
  const sleeveCol = new THREE.Color(ROLE_COLORS[o.role] || '#ffffff').multiplyScalar(0.55);
  const sleeve = lampify(new THREE.MeshStandardMaterial({ color: sleeveCol, roughness: 0.7 }), lamps);
  const glove = lampify(new THREE.MeshStandardMaterial({ color: 0xd8dbe2, roughness: 0.8 }), lamps);
  const mkArm = (sd) => {
    const g = new THREE.Group();
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.32, 4, 10), sleeve);
    fore.rotation.x = -Math.PI / 2 + 0.3;
    fore.position.set(sd * 0.03, -0.05, 0.16);
    g.add(fore);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.06, 14), glove);
    cuff.rotation.x = -Math.PI / 2 + 0.3;
    cuff.position.set(sd * 0.02, 0.0, -0.02);
    g.add(cuff);
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.068, 2), glove);
    hand.scale.set(1.2, 0.85, 1.25);
    hand.position.set(0, 0.02, -0.08);
    g.add(hand);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.05, 3, 6), glove);
    thumb.rotation.set(Math.PI / 2, 0, sd * 0.6);
    thumb.position.set(-sd * 0.05, 0.04, -0.1);
    g.add(thumb);
    return g;
  };
  // Both hands on the instrument, held low and in front, like a field scientist.
  const armR = mkArm(1);
  armR.position.set(0.15, -0.33, -0.52);
  armR.rotation.y = 0.25;
  vm.add(armR);
  const armL = mkArm(-1);
  armL.position.set(-0.13, -0.34, -0.54);
  armL.rotation.y = -0.3;
  vm.add(armL);
  const scanner = makeScanner(lamps);
  scanner.group.scale.setScalar(0.85);
  scanner.group.position.set(0.01, -0.265, -0.7);
  scanner.group.rotation.set(0.7, 0, 0);
  vm.add(scanner.group);
  vm.traverse((m) => {
    if (m.isMesh) {
      m.frustumCulled = false;
      m.castShadow = false;
    }
  });
  const _f = new THREE.Vector3();
  const _look = new THREE.Vector3();

  // ---------- Dust from your own boots: real ballistics for this world ----------
  // Airless (Moon, Europa): every grain flies a clean parabola under g, no drag, no cloud.
  // Mars: thin air drags the grains and the finest dust drifts down slowly. Venus: the
  // platform deck has no dust.
  const dustCfg = S && S.dustOf ? S.dustOf(worldId || 'moon') : { airless: true, drag: 0, fineG: 1.62 };
  const grains = createParticles(360, { additive: false, order: 5, drag: dustCfg.drag });
  const fines = dustCfg.airless ? null : createParticles(200, { additive: false, order: 5, drag: dustCfg.drag * 1.8 });
  scene.add(grains.points);
  if (fines) scene.add(fines.points);
  const dustCol = cfg.dust || [0.5, 0.5, 0.5];
  const noDust = !!cfg.platform;
  // Deterministic little noise (the game's look should not depend on Math.random order).
  let seedN = 1234567;
  const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);
  function kick(x, z, n, power, dirX, dirZ) {
    if (noDust || reduced) n = Math.ceil(n * 0.4);
    if (noDust) return;
    const g = feelG();
    const y0 = world.height(x, z) + 0.04;
    for (let i = 0; i < n; i++) {
      // Thrown backwards and up from the toe: 25-60 degrees, about 0.6-1.8 m/s.
      const a = Math.atan2(-dirZ, -dirX) + (rnd() - 0.5) * 1.6;
      const el = 0.45 + rnd() * 0.6;
      const v = (0.6 + rnd() * 1.2) * power;
      const vy = Math.sin(el) * v;
      const vh = Math.cos(el) * v;
      // Life: until it comes back down to the ground (flight time 2·vy/g).
      const life = Math.min(4, (2 * vy) / g + 0.05);
      const sz = 0.05 + rnd() * 0.07;
      grains.emit(x, y0, z, Math.cos(a) * vh, vy, Math.sin(a) * vh, -g, life, sz, 0, dustCol[0], dustCol[1], dustCol[2], 0.85);
    }
    if (fines) {
      // Fine dust in an atmosphere: slow to rise, slower to settle (drag; Mars ~0.6 kPa).
      for (let i = 0; i < Math.ceil(n / 2); i++) {
        const a = rnd() * 6.283;
        const v = (0.3 + rnd() * 0.5) * power;
        fines.emit(x, y0, z, Math.cos(a) * v, 0.25 + rnd() * 0.4, Math.sin(a) * v, -dustCfg.fineG * 0.35, 1.6 + rnd() * 1.4, 0.25 + rnd() * 0.25, 1, dustCol[0], dustCol[1], dustCol[2], 0.35);
      }
    }
  }
  // A soft step, heard through the suit (there is no air to carry it on the Moon).
  function stepSound(heavy) {
    const A = SMD.audio;
    if (!A || !A.beep || (A.isMuted && A.isMuted())) return;
    try {
      A.beep((noDust ? 150 : 66) + rnd() * 10, heavy ? 0.08 : 0.055, noDust ? 'triangle' : 'sine', heavy ? 0.055 : 0.034);
      if (!noDust && A.bang && heavy) A.bang(0.018, 0.09);
    } catch (e) {}
  }
  function onFootDown(info) {
    stats.steps++;
    const lope = info && (info.gait === 'lope' || info.gait === 'run');
    const foot = info && info.foot === 'l' ? -1 : 1;
    // The foot is under the hip, a little to the side of the line of travel.
    const rx = -Math.sin(face) * 0.13 * foot;
    const rz = Math.cos(face) * 0.13 * foot;
    const dx = Math.cos(face);
    const dz = Math.sin(face);
    kick(body.x + rx, body.z + rz, lope ? 9 : 4, lope ? 1.2 : 0.6, dx, dz);
    stepSound(lope);
  }

  // ---------- Camera collision ----------
  function solidAt(x, z, y, radius) {
    const map = world.map;
    const c = map.cell;
    const ci = Math.floor(x / c);
    const cj = Math.floor(z / c);
    for (let j = cj - 1; j <= cj + 1; j++) {
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (i < 0 || j < 0 || i >= map.w || j >= map.h) continue;
        if (map.tiles[j * map.w + i] !== 1) continue;
        const px = (i + 0.5) * c;
        const pz = (j + 0.5) * c;
        const reach = c * 0.62 + radius;
        if ((x - px) * (x - px) + (z - pz) * (z - pz) < reach * reach && y < world.rockTop + radius) return true;
      }
    }
    for (const b of renderer.cameraBlockers()) {
      const dx = x - b.x;
      const dz = z - b.z;
      if (dx * dx + dz * dz < (b.r + radius) * (b.r + radius) && y < b.h) return true;
    }
    return false;
  }

  function clearBoom(px, py, pz, dx, dy, dz, want) {
    const step = 0.2;
    const radius = 0.32;
    const map = world.map;
    let free = want;
    for (let d = step; d <= want; d += step) {
      const x = px + dx * d;
      const y = py + dy * d;
      const z = pz + dz * d;
      const ground = world.height(x, z) + 0.28;
      if (y < ground || solidAt(x, z, y, radius) || x < -6 || z < -6 || x > map.size + 6 || z > map.size + 6) {
        free = Math.max(0.1, d - step);
        break;
      }
    }
    return free;
  }

  // ---------- Radar: sites, the lander, the dish and the crew; nothing else ----------
  let radarT = 0;
  function paintRadar(state, me) {
    const W = 200;
    const R = 86;
    const SCALE = R / 70; // 70 m radius
    radar.clearRect(0, 0, W, W);
    radar.save();
    radar.translate(W / 2, W / 2);
    radar.beginPath();
    radar.arc(0, 0, R, 0, 7);
    radar.fillStyle = 'rgba(10,16,40,0.55)';
    radar.fill();
    radar.strokeStyle = 'rgba(220,228,255,0.28)';
    radar.lineWidth = 1.5;
    radar.stroke();
    // Forward is up.
    const c = Math.cos(-yaw - Math.PI / 2);
    const s = Math.sin(-yaw - Math.PI / 2);
    const place = (x, z) => {
      const dx = (x - me.x) * SCALE;
      const dz = (z - me.z) * SCALE;
      return [dx * c - dz * s, dx * s + dz * c];
    };
    const dot = (x, z, col, r, kind) => {
      let [px, py] = place(x, z);
      const m = Math.hypot(px, py);
      const off = m > R - 6;
      if (off) {
        px = (px / m) * (R - 6);
        py = (py / m) * (R - 6);
      }
      radar.fillStyle = col;
      radar.strokeStyle = col;
      radar.globalAlpha = off ? 0.55 : 0.95;
      radar.beginPath();
      if (kind === 'square') radar.rect(px - r, py - r, r * 2, r * 2);
      else if (kind === 'ring') {
        radar.lineWidth = 2;
        radar.arc(px, py, r, 0, 7);
        radar.stroke();
        radar.globalAlpha = 1;
        return;
      } else radar.arc(px, py, r, 0, 7);
      radar.fill();
      radar.globalAlpha = 1;
    };
    for (const e of state.entities) {
      if (e.kind === 'site' && !e.done) dot(e.x, e.z, e.fits === false ? 'rgba(200,205,220,0.5)' : SITE_COLORS[e.siteKind] || '#7ad4ff', 4.5, 'ring');
      else if (e.kind === 'sample' && !e.heldBy) dot(e.x, e.z, '#e8eef8', 2.5);
      else if (e.kind === 'lander') dot(e.x, e.z, '#ffe9b0', 5.5, 'square');
      else if (e.kind === 'dish') dot(e.x, e.z, e.planted ? '#9fd8ff' : 'rgba(159,216,255,0.6)', 3.5, 'square');
      else if (e.kind === 'astronaut' && e.playerId !== myId && !e.aboard) dot(e.x, e.z, ROLE_COLORS[e.role] || '#fff', 4);
    }
    // You: a wedge pointing up.
    radar.fillStyle = '#ffffff';
    radar.beginPath();
    radar.moveTo(0, -8);
    radar.lineTo(5.5, 5.5);
    radar.lineTo(-5.5, 5.5);
    radar.closePath();
    radar.fill();
    radar.restore();
  }

  // ---------- The goal marker ----------
  function paintDiamond(goal, me) {
    const el = $('.tv-diamond');
    if (!goal || !goal.target) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    const p = renderer.project(goal.target.x, 2.2, goal.target.z, true);
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    let x = p.x;
    let y = p.y;
    if (p.behind) {
      x = w - x;
      y = h * 0.5;
    }
    const margin = 48;
    const off = p.behind || x < margin || x > w - margin || y < margin || y > h - 120;
    x = clamp(x, margin, w - margin);
    y = clamp(y, margin + 60, h - 120);
    if (p.behind) x = x < w / 2 ? margin : w - margin;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    el.classList.toggle('off', off);
    const dist = Math.hypot(goal.target.x - me.x, goal.target.z - me.z);
    const text = dist > 4 ? t_('team.surface.metres', '{n} m', { n: SMD.dir && SMD.dir() === 'rtl' ? `⁦${Math.round(dist)}⁩` : Math.round(dist) }) : '';
    const span = el.querySelector('span');
    if (span.textContent !== text) span.textContent = text;
  }

  // ---------- Gamepad (Xbox layout) ----------
  function readPad() {
    let out = null;
    try {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const g of list) {
        if (g && g.connected) {
          out = g;
          break;
        }
      }
    } catch (e) {}
    if (!out) return null;
    const pressed = (i) => !!(out.buttons[i] && (out.buttons[i].pressed || out.buttons[i].value > 0.4));
    const [mx, my] = stickCurve(out.axes[0] || 0, out.axes[1] || 0, PAD.moveDead, PAD.outer, PAD.moveCurve);
    const [lx, ly] = stickCurve(out.axes[2] || 0, out.axes[3] || 0, PAD.lookDead, PAD.outer, PAD.lookCurve);
    return { mx, my, lx, ly, lMag: Math.hypot(out.axes[2] || 0, out.axes[3] || 0), a: pressed(0), b: pressed(1), x: pressed(2), y: pressed(3), lt: pressed(6), rt: pressed(7), l3: pressed(10), r3: pressed(11), start: pressed(9) };
  }
  const padPrev = {};
  const padEdge = (name, v) => {
    const was = !!padPrev[name];
    padPrev[name] = v;
    return v && !was;
  };

  // ---------- The guide's one line about gravity, once, after the landing ----------
  function sayGravity() {
    if (guideShown || !worldId || !S || !S.gravityOf) return;
    guideShown = true;
    if (!realGravityOn()) return;
    const G = SMD.team && SMD.team.guide;
    if (!G || !G.scriptFor || !G.say) return;
    const g = S.gravityOf(worldId);
    const params = { g: g.toFixed(2), ratio: (g / EARTH_G).toFixed(2), hop: S.hopOf(g).height.toFixed(1) };
    try {
      const lines = G.scriptFor(worldId, 'gravity.' + worldId, params);
      if (lines && lines.length && lines[0].text) G.say(stage, lines, { auto: true, keep: false });
    } catch (e) {}
  }

  // ---------- The body: facing, strafing, lean, look-at, carry, hop ----------
  const rotYOf = (h) => Math.atan2(Math.cos(h), Math.sin(h));
  function driveBody(actor, me, dt, t) {
    const x = actor.x;
    const z = actor.z;
    if (!body.init) {
      body.x = x;
      body.z = z;
      body.init = true;
      face = yaw; // start facing where the camera looks
    }
    const ivx = dt > 0 ? (x - body.x) / dt : 0;
    const ivz = dt > 0 ? (z - body.z) / dt : 0;
    body.x = x;
    body.z = z;
    // A jump of more than a few metres is a correction or a teleport, not a step.
    if (Math.hypot(ivx, ivz) < 25) {
      body.vx = damp(body.vx, ivx, 18, dt);
      body.vz = damp(body.vz, ivz, 18, dt);
    }
    body.speed = Math.hypot(body.vx, body.vz);
    const moving = body.speed > 0.35;
    const g = feelG();
    if (moving) {
      const my = Math.atan2(body.vz, body.vx);
      body.turnRate = damp(body.turnRate, wrap(my - body.moveYaw) / Math.max(1e-3, dt), 10, dt);
      body.moveYaw = my;
      body.still = 0;
    } else {
      body.turnRate = damp(body.turnRate, 0, 8, dt);
      body.still += dt;
    }
    const busy = me.useKind === 'scan' || me.state === 'scan' || me.state === 'plant' || me.state === 'repair';
    const free = !me.aboard && !me.returning && !(me.restT > 0);
    body.aiming = free && (aimK > 0.5 || busy || viewK > 0.5);
    let want = face;
    let rate = 12;
    body.reverse = false;
    if (body.aiming) {
      // Aiming: the chest follows the camera; the legs go where you walk, back-pedalling
      // when you walk away from where you look.
      if (moving) {
        const off = wrap(body.moveYaw - yaw);
        if (Math.abs(off) > 1.75) {
          want = body.moveYaw + Math.PI;
          body.reverse = true;
        } else want = body.moveYaw - off * 0.35;
      } else want = yaw;
      rate = 14;
    } else if (moving) {
      // Free: face where you go. Quick pivots when slow, the body follows the (traction
      // limited) velocity when running, so the arcs are wide on the Moon.
      want = body.moveYaw;
      rate = lerp(16, 9, clamp(body.speed / 7));
    } else if (body.still > 0.6 && Math.abs(wrap(yaw - face)) > 2.1) {
      // Standing and looking behind you: turn round on the spot.
      want = yaw;
      rate = 5;
    }
    face = dampAngle(face, want, rate, dt);
    const g3 = actor.astro;
    const rotY = rotYOf(face);
    actor.yaw = rotY;
    g3.group.rotation.y = rotY;
    if (g3.setReverse) g3.setReverse(body.reverse);
    // Lean into turns: the ground must push sideways m·v·ω, so tan(lean) = v·ω / g.
    const aLat = body.speed * body.turnRate;
    const wantLean = clamp(-Math.atan2(aLat, g) * 0.5, -0.3, 0.3) * (reduced ? 0.5 : 1) * (body.aiming ? 0.3 : 1);
    body.lean = damp(body.lean, moving ? wantLean : 0, 8 * Math.sqrt(g / EARTH_G) + 1, dt);
    if (g3.setLean) g3.setLean(body.lean);
    // Head and chest toward where the camera aims.
    _look.set(camera.position.x + Math.cos(yaw) * 30, camera.position.y + Math.sin(pitch) * 30 - 0.4, camera.position.z + Math.sin(yaw) * 30);
    if (g3.lookAt) g3.lookAt(viewK < 0.5 && free ? _look : null);
    // Carrying a sample: both arms round it, a little forward.
    const carrying = !!me.carrying;
    if (carrying !== body.carry) {
      body.carry = carrying;
      if (g3.carry) g3.carry(carrying ? { spread: 0.25 } : false);
    }
    if (!body.breath && g3.setBreath) {
      body.breath = true;
      g3.setBreath(true);
    }
    if (g3.onStep !== onFootDown) g3.onStep = onFootDown;
    // The hop.
    hop.cool = Math.max(0, hop.cool - dt);
    if (hop.t >= 0) {
      hop.t += dt;
      if (hop.t >= 0.14 + hop.air) {
        hop.t = -1;
        hop.cool = 0.25;
        kick(body.x, body.z, 14, 1.3, Math.cos(face), Math.sin(face));
        kick(body.x, body.z, 6, 0.9, -Math.cos(face), -Math.sin(face));
        stepSound(true);
      }
    }
    return free && !busy;
  }
  function startHop(actor, me) {
    if (!actor || !me || hop.t >= 0 || hop.cool > 0) return;
    if (me.aboard || me.returning || me.restT > 0 || me.useKind === 'scan') return;
    const H = S && S.hopOf ? S.hopOf(feelG()) : { height: 0.07, airS: 0.24 };
    hop.t = 0;
    hop.air = H.airS;
    hop.h = H.height;
    stats.hops++;
    if (actor.astro.hop) actor.astro.hop({ height: H.height, airS: H.airS });
  }
  // Height of the eye over the ground from the hop, now.
  function hopY() {
    if (hop.t < 0) return 0;
    const x = (hop.t - 0.14) / hop.air;
    if (x <= 0) return -0.06 * clamp(hop.t / 0.14);
    if (x >= 1) return 0;
    return 4 * hop.h * x * (1 - x);
  }

  // ---------- Each frame, before the renderer draws ----------
  let lastGoal = null;
  let wantHop = false;
  const api = {
    get view() {
      return view;
    },
    myId,
    // The body's facing (the sim's heading convention): the renderer draws you this way.
    get yaw() {
      return face;
    },
    get cameraYaw() {
      return yaw;
    },
    get active() {
      return active;
    },
    get eyeLevel() {
      return view !== 'group';
    },
    setActive(on) {
      if (on === active) return;
      active = on;
      hud.classList.toggle('tv-off', !active);
      if (!active) {
        release();
        camera.near = 2;
        camera.far = 1600;
        camera.updateProjectionMatrix();
        vm.visible = false;
        renderer.setBodyHidden(myId, false);
      } else if (!guideShown && !guideTimer) {
        guideTimer = setTimeout(() => {
          guideTimer = 0;
          if (active) sayGravity();
        }, 1600);
      }
      paintHint();
    },
    setObjective(g) {
      lastGoal = g;
    },
    // Free the mouse on purpose (the view is moving to another phase): not a pause.
    freeMouse() {
      release();
    },
    // A panel needs the mouse: free it and stop capturing until it closes.
    hold(on) {
      on = !!on;
      if (on === held) return;
      held = on;
      if (held) release();
      paintHint();
    },
    // Kept for old callers: nothing to hit any more.
    registerHit() {},
    input() {
      return inp;
    },
    raw() {
      let b = 0;
      if (inp.use) b |= 2;
      if (inp.ability) b |= 4;
      if (inp.dropBtn) b |= 16;
      if (inp.sprint) b |= 64;
      b |= 128;
      if (inp.earthG) b |= 256; // "Realistic gravity" off on this device
      return { mx: inp.moveX, my: inp.moveY, ax: inp.aimX, ay: inp.aimY, buttons: b };
    },
    // Poll devices: runs once per frame before anyone reads input().
    poll(dt) {
      dt = Math.min(0.1, dt || 0);
      const take = (c) => {
        if (edges.has(c)) {
          edges.delete(c);
          return true;
        }
        return false;
      };
      const pad = readPad();
      let fwd = 0;
      let strafe = 0;
      if (keys.has('KeyW')) fwd += 1;
      if (keys.has('KeyS')) fwd -= 1;
      if (keys.has('KeyD')) strafe += 1;
      if (keys.has('KeyA')) strafe -= 1;
      let use = keys.has('KeyE') || mouse.use;
      let ability = keys.has('KeyQ');
      let sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
      let aim = mouse.aim;
      let viewToggle = take('KeyV');
      if (take('KeyC')) side = -side;
      if (take('Space')) wantHop = true;
      if (take('KeyH')) {
        helpOpen = !helpOpen;
        if (helpOpen) release();
        paintHelp();
        paintHint();
      }
      lookIdle += dt;
      if (pad) {
        if (Math.abs(pad.mx) + Math.abs(pad.my) + Math.abs(pad.lx) + Math.abs(pad.ly) > 0.02 || pad.rt || pad.a || pad.lt) device = 'gamepad';
        if (pad.lx || pad.ly) {
          // Pushed to the edge for a moment, the turn speeds up (like most console games).
          padBoost = pad.lMag > 0.92 ? padBoost + dt : 0;
          const boost = padBoost > PAD.boostAfter ? lerp(1, PAD.boost, clamp((padBoost - PAD.boostAfter) / 0.4)) : 1;
          const k = (Number(setting('lookSpeed', 1)) || 1) * boost * (aimK > 0.5 ? 0.6 : 1);
          yawT = wrap(yawT + pad.lx * PAD.lookYaw * k * dt);
          pitchT = clamp(pitchT - pad.ly * PAD.lookPitch * k * dt * invert(), RIG.pitchMin, RIG.pitchMax);
          lookIdle = 0;
        } else padBoost = 0;
        if (pad.mx || pad.my) {
          strafe = pad.mx;
          fwd = -pad.my;
        }
        use = use || pad.a || pad.rt;
        ability = ability || pad.x;
        sprint = sprint || pad.l3;
        aim = aim || pad.lt;
        if (padEdge('y', pad.y)) viewToggle = true;
        if (padEdge('b', pad.b)) wantHop = true;
        if (padEdge('r3', pad.r3)) side = -side;
        if (padEdge('start', pad.start) && o.onPause) o.onPause();
      }
      if (touch.on) {
        touch.smx = damp(touch.smx, touch.mx, 22, dt);
        touch.smy = damp(touch.smy, touch.my, 22, dt);
        if (Math.abs(touch.smx) < 0.01 && !touch.mx) touch.smx = 0;
        if (Math.abs(touch.smy) < 0.01 && !touch.my) touch.smy = 0;
        strafe = touch.smx || strafe;
        fwd = touch.smy ? -touch.smy : fwd;
        use = use || touch.use;
        ability = ability || touch.ability;
        if (Math.hypot(touch.mx, touch.my) > 0.92) sprint = true;
      }
      if (viewToggle && !helpOpen) toggleView();
      $('.tv-tbtns').hidden = !(touch.on && device === 'touch');

      // Applied look: straight from the mouse, or smoothed (Settings > Smooth mouse, touch).
      const smoothLook = setting('lookSmooth', false) || device === 'touch';
      if (smoothLook) {
        yaw = dampAngle(yaw, yawT, 26, dt);
        pitch = damp(pitch, pitchT, 26, dt);
      } else {
        yaw = yawT;
        pitch = pitchT;
      }

      const len = Math.hypot(strafe, fwd);
      if (len > 1) {
        strafe /= len;
        fwd /= len;
      }
      // Camera-relative move, in the sim's 2D axes.
      const cf = Math.cos(yaw);
      const sf = Math.sin(yaw);
      inp.moveX = cf * fwd - sf * strafe;
      inp.moveY = sf * fwd + cf * strafe;
      inp.aimX = cf;
      inp.aimY = sf;
      inp.use = use && !helpOpen && active;
      inp.ability = ability && !helpOpen && active;
      // Hurry in any direction when not aiming (the body turns to run); aiming walks.
      inp.sprint = sprint && Math.hypot(fwd, strafe) > 0.2 && !helpOpen && !aim;
      inp.dropBtn = keys.has('KeyX');
      // Real gravity: the traction this player moves with (the host reads earthG).
      inp.earthG = !realGravityOn();
      inp.g = feelG();
      if (!active) {
        inp.moveX = inp.moveY = 0;
        wantHop = false;
      }
      aimK = damp(aimK, aim && active && !helpOpen ? 1 : 0, 12, dt);
      sideK = damp(sideK, side, 7, dt);
      return api;
    },
    frame(dt, t, state) {
      if (!active) return;
      dt = Math.min(0.1, dt || 0);
      if (state && state.world && worldId !== state.world) worldId = state.world;
      if (hintSince && !everLocked && !$('.tv-grab').hidden && performance.now() - hintSince > 12000) paintHint();
      const actor = renderer.localActor(myId);
      if (!actor) return;
      const me = actor.e;
      const wantFpp = view === 'fpp' ? 1 : 0;
      viewK = damp(viewK, wantFpp, 10, dt);
      if (Math.abs(viewK - wantFpp) < 0.01) viewK = wantFpp;
      nameT -= dt;
      if (nameT <= 0) $('.tv-viewname').classList.remove('show');
      const gone = !!me.aboard;
      const canAct = driveBody(actor, me, dt, t);
      if (wantHop) {
        wantHop = false;
        if (canAct) startHop(actor, me);
      }
      const x = actor.x;
      const z = actor.z;
      const g = feelG();
      const groundY = world.height(x, z);
      // Gamepad and touch: the camera eases in behind a forward walk after a moment
      // without looking (Settings > Camera follows automatically). Never with the mouse.
      if ((device === 'gamepad' || device === 'touch') && setting('autoCamera', true) !== false && lookIdle > 1.2 && body.speed > 1 && !body.aiming) {
        const off = wrap(body.moveYaw - yawT);
        if (Math.abs(off) < 1.3) yawT = wrap(yawT + off * (1 - Math.exp(-0.9 * clamp(body.speed / 6) * dt)));
      }

      // First person: the eye rides the gait (stance dip, flight arc), only without reduced motion.
      const G = S && S.gait ? S.gait(body.speed, g, 0.92) : null;
      if (G && body.speed > 0.05) {
        const prev = gaitCam.ph;
        gaitCam.ph += dt * G.cadence;
        const u = gaitCam.ph % 1;
        let y;
        if (u < G.duty) y = -(0.012 + 0.012 * clamp(body.speed / 7)) * Math.sin((Math.PI * u) / G.duty);
        else {
          const k = (u - G.duty) / (1 - G.duty);
          y = 4 * G.apex * k * (1 - k);
        }
        gaitCam.bob = damp(gaitCam.bob, y, 30, dt);
        gaitCam.sway = Math.sin(gaitCam.ph * Math.PI) * 0.01 * clamp(body.speed / 5);
        // In first person the body is hidden, so the steps are timed here.
        if (viewK > 0.5 && Math.floor(gaitCam.ph) !== Math.floor(prev) && body.speed > 0.35) onFootDown({ gait: G.gait, foot: Math.floor(gaitCam.ph) % 2 ? 'l' : 'r' });
      } else {
        gaitCam.bob = damp(gaitCam.bob, 0, 8, dt);
        gaitCam.sway = damp(gaitCam.sway, 0, 8, dt);
      }
      const bobK = reduced ? 0 : 1;

      // Spring-arm pivot: a critically damped follow (lag when you set off, a soft catch-up
      // when you stop), stiff in first person.
      if (!ready) {
        piv.x = x;
        piv.z = z;
        piv.y = groundY;
        ready = true;
      }
      const w = lerp(RIG.lagTpp, RIG.lagFpp, viewK);
      // The exact critically damped step: stable at any frame time.
      const spring = (p, v, target) => {
        const d = piv[p] - target;
        const e = Math.exp(-w * dt);
        const k = (piv[v] + w * d) * dt;
        piv[p] = target + (d + k) * e;
        piv[v] = (piv[v] - w * k) * e;
      };
      if (Math.hypot(x - piv.x, z - piv.z) > 6) {
        piv.x = x;
        piv.z = z;
        piv.vx = piv.vz = 0;
      }
      spring('x', 'vx', x);
      spring('z', 'vz', z);
      // Vertical: the ground plus some of the body's flight (all of it in first person).
      const liftNow = (actor.astro.lift || 0) + hopY();
      const yWant = groundY + lerp(0.2 * liftNow, hopY() + gaitCam.bob * bobK, viewK);
      piv.y = damp(piv.y, yWant, lerp(RIG.lagY, 30, viewK), dt);

      const cp = Math.cos(pitch);
      const fx = Math.cos(yaw) * cp;
      const fy = Math.sin(pitch);
      const fz = Math.sin(yaw) * cp;
      const rx = -Math.sin(yaw);
      const rz = Math.cos(yaw);
      const sprinting = inp.sprint && body.speed > 2;
      sprintK = damp(sprintK, sprinting ? 1 : 0, sprinting ? 4 : 2.5, dt);
      const tp = RIG.tpp;
      const am = RIG.aim;
      const height = lerp(tp.height, am.height, aimK);
      const headY = piv.y + lerp(height, RIG.fpp.eye, viewK);
      const shoulder = lerp(tp.shoulder, am.shoulder, aimK) * sideK * (1 - viewK);
      // In first person the eye sits at the head, not at the lagging pivot.
      const ex = lerp(piv.x, x, viewK) + rx * (shoulder + gaitCam.sway * bobK * viewK);
      const ez = lerp(piv.z, z, viewK) + rz * (shoulder + gaitCam.sway * bobK * viewK);
      const wantDist = lerp(lerp(tp.dist, am.dist, aimK) * (1 + sprintK * 0.06), 0.0, viewK);
      const free = wantDist > 0.05 ? clearBoom(ex, headY, ez, -fx, -fy, -fz, wantDist) : 0;
      // Pull in at once, ease back out: a camera that pops out of a rock is worse than one that waits.
      camDist = free < camDist ? free : damp(camDist, free, 4, dt);
      camera.position.set(ex - fx * camDist, headY - fy * camDist, ez - fz * camDist);
      _f.set(fx, fy, fz).add(camera.position);
      camera.up.set(0, 1, 0);
      camera.lookAt(_f);
      if (camera.near !== 0.12) {
        camera.near = 0.12;
        camera.far = 1800;
        camera.updateProjectionMatrix();
      }
      const lens = reduced ? 0 : sprintK * RIG.sprintFov;
      const fovBase = lerp(lerp(tp.fov, am.fov, aimK) + lens, lerp(RIG.fpp.fov, RIG.fpp.aimFov, aimK) + lens * 0.6, viewK);
      if (Math.abs(camera.fov - fovBase) > 0.05) {
        camera.fov = lerp(camera.fov, fovBase, 1 - Math.exp(-10 * dt));
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();

      // A soft fill from the camera side, so you are never a black shape against the sun.
      lamps.add(x + rx * 1.2 - fx * 2.5, piv.y + 2.4, z + rz * 1.2 - fz * 2.5, 9, 0.45, 0.45, 0.52);
      // Your own body: gone in first person, and when the camera is on top of you.
      const hideBody = viewK > 0.5 || camDist < 0.75;
      renderer.setBodyHidden(myId, hideBody);
      const groundYAtCam = world.height(camera.position.x, camera.position.z);
      renderer.followView(camera.position.x + fx * 16, camera.position.z + fz * 16, 42, groundYAtCam);

      // Hands and the scanner, lifted a little while it reads a site.
      const scanning = me.useKind === 'scan';
      vm.visible = viewK > 0.6 && !gone;
      if (vm.visible) {
        const sw = reduced ? 0 : Math.sin(gaitCam.ph * Math.PI) * clamp(body.speed / 6);
        const lift = scanning ? 1 : aimK * 0.6;
        vm.position.set(sw * 0.008, -Math.abs(sw) * 0.008 + lift * 0.05 - (me.returning ? 0.12 : 0) - (gaitCam.bob * bobK) * 0.3, lift * -0.03);
        vm.rotation.set(lift * -0.12 + sprintK * 0.12, 0, 0);
        scanner.setActive(scanning ? 1 : 0.2);
        if (scanning) lamps.add(camera.position.x + fx * 1.4, camera.position.y - 0.4, camera.position.z + fz * 1.4, 3, 0.2, 0.45, 0.5);
      }
      const viewH = (stage.clientHeight || 720) * Math.min(2, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
      grains.update(t, camera, viewH);
      if (fines) fines.update(t, camera, viewH);

      // Overlays.
      const fp = viewK > 0.7;
      hud.classList.toggle('tv-fp', fp);
      hud.classList.toggle('tv-eyes', view !== 'group');
      const baseHud = stage.querySelector('.tv-hud');
      if (baseHud) baseHud.classList.toggle('tv-eyes-on', view !== 'group');
      $('.tv-helmet').style.opacity = fp ? 1 : 0;
      $('.tv-dotsight').style.opacity = fp && !gone ? 0.6 : aimK > 0.6 && !gone ? 0.5 : 0;
      radarT -= dt;
      if (radarT <= 0) {
        radarT = 0.12;
        paintRadar(state, { x, z });
      }
      paintDiamond(lastGoal, { x, z });
    },
    // For scripts and the headless checks: press keys, move the mouse, read the feel.
    debug: {
      key(code, down) {
        if (down) {
          if (!keys.has(code)) edges.add(code);
          keys.add(code);
        } else keys.delete(code);
      },
      look(dx, dy) {
        look(dx, dy);
      },
      aim(on) {
        mouse.aim = !!on;
      },
      actor: () => renderer.localActor(myId),
      setLook(y, p) {
        yawT = yaw = wrap(y);
        if (p != null) pitchT = pitch = clamp(p, RIG.pitchMin, RIG.pitchMax);
      },
      renderer,
      state() {
        const actor = renderer.localActor(myId);
        const a = actor && actor.astro;
        return { face, camYaw: yaw, camPitch: pitch, speed: body.speed, aimK, sideK, viewK, sprintK, fov: camera.fov, camDist, lift: a ? a.lift : 0, gait: a && a.gait ? Object.assign({}, a.gait) : null, mps: a ? a.mps : 0, reverse: body.reverse, lean: body.lean, g: feelG(), worldId, steps: stats.steps, hops: stats.hops, hopT: hop.t, bob: gaitCam.bob, x: body.x, z: body.z, camToBody: Math.hypot(camera.position.x - body.x, camera.position.z - body.z), pivLag: Math.hypot(piv.x - body.x, piv.z - body.z) };
      },
    },
    dispose() {
      this.setActive(false);
      if (guideTimer) clearTimeout(guideTimer);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMove);
      stage.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      stage.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
      stage.removeEventListener('touchcancel', onTouchEnd);
      scene.remove(grains.points);
      grains.points.geometry.dispose();
      grains.points.material.dispose();
      if (fines) {
        scene.remove(fines.points);
        fines.points.geometry.dispose();
        fines.points.material.dispose();
      }
      hud.remove();
      if (SMD.team && SMD.team.surfaceShooter === api) SMD.team.surfaceShooter = null;
    },
  };
  setView(view, true);
  // The live handle for headless checks and the console (cleared on dispose).
  if (SMD.team) SMD.team.surfaceShooter = api;
  return api;
}
