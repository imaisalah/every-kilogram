// Third-person and first-person play on the surface (docs/TEAM-SURFACE.md). One
// player on their own screen: over the shoulder by default, V for first person,
// where you see your gloved hands holding the scanner. The camera, the input
// and the eye-level overlays (a small radar, the goal marker, the help card)
// live here; the sim still owns where everyone is, in 2D.
//
//   const sh = createShooter({ renderer, stage, myId, S, audio, onPause, solo });
//   sh.frame(dt, t, state);   // before the renderer draws
//   sh.input();               // sim input for this player, this frame
//   sh.raw();                 // the same as a compact controller message
//   sh.setActive(bool);       // false during landing, launch and pause
//   sh.view                   // 'tpp' | 'fpp' | 'group'
//   sh.dispose();
import { THREE } from '../3d/engine.js';
import { makeScanner, ROLE_COLORS, SITE_COLORS } from './surface3d-actors.js';
import { lampify, reducedMotion } from './surface3d-fx.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});
const t_ = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : e);
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const VIEW_KEY = 'ek-surface-view';

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

// Tuning: distances in metres, angles in radians.
const RIG = {
  tpp: { dist: 5.9, height: 1.75, shoulder: 0.9, fov: 60 },
  fpp: { eye: 1.66, fov: 74 },
  pitchMin: -1.15,
  pitchMax: 1.2,
  sprintFov: 4,
};

export function createShooter(o) {
  const { renderer, stage, myId } = o;
  const camera = renderer.camera;
  const scene = renderer.scene;
  const world = renderer.world;
  const reduced = reducedMotion();

  let view = loadView();
  let active = false;
  let yaw = -Math.PI / 2; // looking up the map
  let pitch = -0.1;
  let viewK = view === 'fpp' ? 1 : 0; // 0 third person, 1 first person
  let sprintK = 0;
  let camDist = RIG.tpp.dist;
  let pivotY = 0;
  let ready = false;
  let moveAmt = 0;
  let locked = false;
  let releasing = false;
  let held = false; // a panel needs the mouse (the ascent choice): no capture
  let everLocked = false; // the "click to look around" hint shows until the first capture
  let hintSince = 0;
  let device = 'keyboard';
  let helpOpen = false;
  const keys = new Set();
  const edges = new Set();
  const mouse = { use: false };
  const inp = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, use: false, ability: false, sprint: false, shooter: true, dropBtn: false };
  const canvasOf = () => stage.querySelector('canvas');

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
    if (!locked) mouse.use = false;
    // Esc out of the mouse capture in a solo game is a pause, like any other game.
    if (was && !locked && !releasing && active && o.solo && o.onPause) o.onPause();
    releasing = false;
    paintHint();
  };
  const sens = () => {
    let k = 1;
    try {
      k = (SMD.settings && SMD.settings.lookSpeed) || 1;
    } catch (e) {}
    return k * 0.0021;
  };
  const invert = () => {
    try {
      return SMD.settings && SMD.settings.invertY ? -1 : 1;
    } catch (e) {
      return 1;
    }
  };
  function look(dx, dy) {
    yaw = wrap(yaw + dx * sens());
    pitch = clamp(pitch - dy * sens() * invert(), RIG.pitchMin, RIG.pitchMax);
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
  };
  const onUp = (e) => {
    if (e.button === 0) mouse.use = false;
  };
  const noMenu = (e) => e.preventDefault();
  const GAME = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyQ', 'KeyV', 'KeyH', 'Space', 'KeyX']);
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
    mouse.use = false;
  };
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('mousemove', onMove);
  stage.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  stage.addEventListener('contextmenu', noMenu);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // ---------- Touch: left thumb moves, right side looks ----------
  const touch = { moveId: null, lookId: null, mx: 0, my: 0, lookX: 0, lookY: 0, baseX: 0, baseY: 0, use: false, ability: false, on: false };
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
        const dx = (p.clientX - touch.baseX) / 56;
        const dy = (p.clientY - touch.baseY) / 56;
        const m = Math.min(1, Math.hypot(dx, dy));
        const a = Math.atan2(dy, dx);
        touch.mx = Math.cos(a) * m;
        touch.my = Math.sin(a) * m;
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
  function showName() {
    const el = $('.tv-viewname');
    el.textContent = view === 'fpp' ? t_('team.surface.v.fpp', 'First person') : view === 'tpp' ? t_('team.surface.v.tpp', 'Third person') : t_('team.surface.v.group', 'Top-down view');
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
  const mkArm = (side) => {
    const g = new THREE.Group();
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.32, 4, 10), sleeve);
    fore.rotation.x = -Math.PI / 2 + 0.3;
    fore.position.set(side * 0.03, -0.05, 0.16);
    g.add(fore);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.06, 14), glove);
    cuff.rotation.x = -Math.PI / 2 + 0.3;
    cuff.position.set(side * 0.02, 0.0, -0.02);
    g.add(cuff);
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.068, 2), glove);
    hand.scale.set(1.2, 0.85, 1.25);
    hand.position.set(0, 0.02, -0.08);
    g.add(hand);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.05, 3, 6), glove);
    thumb.rotation.set(Math.PI / 2, 0, side * 0.6);
    thumb.position.set(-side * 0.05, 0.04, -0.1);
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
    const dz = (v, d) => (Math.abs(v) > d ? (v - Math.sign(v) * d) / (1 - d) : 0);
    const pressed = (i) => !!(out.buttons[i] && (out.buttons[i].pressed || out.buttons[i].value > 0.4));
    return { mx: dz(out.axes[0], 0.16), my: dz(out.axes[1], 0.16), lx: dz(out.axes[2], 0.14), ly: dz(out.axes[3], 0.14), a: pressed(0), b: pressed(1), x: pressed(2), y: pressed(3), rt: pressed(7), l3: pressed(10), start: pressed(9) };
  }
  const padPrev = {};
  const padEdge = (name, v) => {
    const was = !!padPrev[name];
    padPrev[name] = v;
    return v && !was;
  };

  // ---------- Each frame, before the renderer draws ----------
  let lastGoal = null;
  const api = {
    get view() {
      return view;
    },
    myId,
    get yaw() {
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
      return { mx: inp.moveX, my: inp.moveY, ax: inp.aimX, ay: inp.aimY, buttons: b };
    },
    // Poll devices: runs once per frame before anyone reads input().
    poll(dt) {
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
      let use = keys.has('KeyE') || keys.has('Space') || mouse.use;
      let ability = keys.has('KeyQ');
      let sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
      let viewToggle = take('KeyV');
      if (take('KeyH')) {
        helpOpen = !helpOpen;
        if (helpOpen) release();
        paintHelp();
        paintHint();
      }
      if (pad) {
        if (Math.abs(pad.mx) + Math.abs(pad.my) + Math.abs(pad.lx) + Math.abs(pad.ly) > 0.02 || pad.rt || pad.a) device = 'gamepad';
        if (pad.lx || pad.ly) look(pad.lx * 900 * dt, pad.ly * 700 * dt);
        if (pad.mx || pad.my) {
          strafe = pad.mx;
          fwd = -pad.my;
        }
        use = use || pad.a || pad.rt;
        ability = ability || pad.x;
        sprint = sprint || pad.l3;
        if (padEdge('y', pad.y)) viewToggle = true;
        if (padEdge('start', pad.start) && o.onPause) o.onPause();
      }
      if (touch.on) {
        strafe = touch.mx || strafe;
        fwd = touch.my ? -touch.my : fwd;
        use = use || touch.use;
        ability = ability || touch.ability;
        if (Math.hypot(touch.mx, touch.my) > 0.92) sprint = true;
      }
      if (viewToggle && !helpOpen) toggleView();
      $('.tv-tbtns').hidden = !(touch.on && device === 'touch');

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
      inp.sprint = sprint && fwd > 0.2 && !helpOpen;
      inp.dropBtn = keys.has('KeyX');
      if (!active) inp.moveX = inp.moveY = 0;
      sprintK = damp(sprintK, inp.sprint ? 1 : 0, 6, dt);
      return api;
    },
    frame(dt, t, state) {
      if (!active) return;
      if (hintSince && !everLocked && !$('.tv-grab').hidden && performance.now() - hintSince > 12000) paintHint();
      const actor = renderer.localActor(myId);
      if (!actor) return;
      const me = actor.e;
      const wantFpp = view === 'fpp' ? 1 : 0;
      viewK = damp(viewK, wantFpp, 10, dt);
      if (Math.abs(viewK - wantFpp) < 0.01) viewK = wantFpp;
      nameT -= dt;
      if (nameT <= 0) $('.tv-viewname').classList.remove('show');
      const x = actor.x;
      const z = actor.z;
      const groundY = world.height(x, z);
      if (!ready) {
        pivotY = groundY;
        ready = true;
      }
      pivotY = damp(pivotY, groundY, 10, dt);
      const cp = Math.cos(pitch);
      const fx = Math.cos(yaw) * cp;
      const fy = Math.sin(pitch);
      const fz = Math.sin(yaw) * cp;
      const rx = -Math.sin(yaw);
      const rz = Math.cos(yaw);
      moveAmt = damp(moveAmt, clamp(Math.hypot(inp.moveX, inp.moveY)), 8, dt);
      const gone = !!me.aboard;
      // A gentle walking sway in first person; none at all with reduced motion.
      const eyeBob = reduced ? 0 : Math.sin(t * (5 + sprintK * 2)) * 0.012 * moveAmt;
      const tp = RIG.tpp;
      const headY = pivotY + lerp(tp.height, RIG.fpp.eye, viewK) + eyeBob * viewK;
      const shoulder = tp.shoulder * (1 - viewK);
      const px = x + rx * shoulder;
      const pz = z + rz * shoulder;
      const wantDist = lerp(tp.dist * (1 + sprintK * 0.05), 0.0, viewK);
      const free = wantDist > 0.05 ? clearBoom(px, headY, pz, -fx, -fy, -fz, wantDist) : 0;
      // Pull in at once, ease back out: a camera that pops out of a rock is worse than one that waits.
      camDist = free < camDist ? free : damp(camDist, free, 4, dt);
      camera.position.set(px - fx * camDist, headY - fy * camDist, pz - fz * camDist);
      _f.set(fx, fy, fz).add(camera.position);
      camera.up.set(0, 1, 0);
      camera.lookAt(_f);
      if (camera.near !== 0.12) {
        camera.near = 0.12;
        camera.far = 1800;
        camera.updateProjectionMatrix();
      }
      const fovBase = lerp(tp.fov + sprintK * RIG.sprintFov, RIG.fpp.fov + sprintK * RIG.sprintFov * 0.6, viewK);
      if (Math.abs(camera.fov - fovBase) > 0.05) {
        camera.fov = lerp(camera.fov, fovBase, 1 - Math.exp(-10 * dt));
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();

      // A soft fill from the camera side, so you are never a black shape against the sun.
      lamps.add(x + rx * 1.2 - fx * 2.5, pivotY + 2.4, z + rz * 1.2 - fz * 2.5, 9, 0.45, 0.45, 0.52);
      // Your own body: gone in first person, and when the camera is on top of you.
      const hideBody = viewK > 0.5 || camDist < 0.75;
      renderer.setBodyHidden(myId, hideBody);
      const groundYAtCam = world.height(camera.position.x, camera.position.z);
      renderer.followView(camera.position.x + fx * 16, camera.position.z + fz * 16, 42, groundYAtCam);

      // Hands and the scanner, lifted a little while it reads a site.
      const scanning = me.useKind === 'scan';
      vm.visible = viewK > 0.6 && !gone;
      if (vm.visible) {
        const sw = reduced ? 0 : Math.sin(t * (5 + sprintK * 2)) * moveAmt;
        const lift = scanning ? 1 : 0;
        vm.position.set(sw * 0.008, -Math.abs(sw) * 0.008 + lift * 0.05 - (me.returning ? 0.12 : 0), lift * -0.03);
        vm.rotation.set(lift * -0.12 + sprintK * 0.12, 0, 0);
        scanner.setActive(scanning ? 1 : 0.2);
        if (scanning) lamps.add(camera.position.x + fx * 1.4, camera.position.y - 0.4, camera.position.z + fz * 1.4, 3, 0.2, 0.45, 0.5);
      }

      // Overlays.
      const fp = viewK > 0.7;
      hud.classList.toggle('tv-fp', fp);
      hud.classList.toggle('tv-eyes', view !== 'group');
      const baseHud = stage.querySelector('.tv-hud');
      if (baseHud) baseHud.classList.toggle('tv-eyes-on', view !== 'group');
      $('.tv-helmet').style.opacity = fp ? 1 : 0;
      $('.tv-dotsight').style.opacity = fp && !gone ? 0.6 : 0;
      radarT -= dt;
      if (radarT <= 0) {
        radarT = 0.12;
        paintRadar(state, { x, z });
      }
      paintDiamond(lastGoal, { x, z });
    },
    dispose() {
      this.setActive(false);
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
      hud.remove();
    },
  };
  setView(view, true);
  return api;
}
