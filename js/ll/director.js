// Last Light level director (docs/LASTLIGHT.md, "Level framework"). Runs one
// level (content/levels/<id>.js) as a linear list of sections; each section
// start is a checkpoint. The level script gets the director `L` and awaits
// its moments: walk there, press E, say a line, a quick-time event, a timed
// choice, the bench. A failure fades to black and replays the section.
//
//   const game = createGame({ root, stage, levels, onEnd, onQuit, onPause });
//   engine.mount(stage, game.sceneObj);
//   game.start({ level: 'prologue' })            // or { snapshot } to continue
//
// Everything in the level script that waits returns a promise tied to the
// current run; a failure or the chapter's end rejects them all with an abort
// (caught here), so section code simply stops.
import { THREE, getRenderer } from '../3d/engine.js';
import { createAstronaut } from '../3d/astronaut.js';
import * as G0 from './logic.js';
import { createPlayer } from './player.js';
import { createHud, iconFor, ICONS } from './hud.js';
import { createSound } from './sound.js';
import { createStandin, hasStandin } from './standin.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});
const { METERS, newRes, stepMeters, severity, failed, checkWatchers, co2Effects, ITEMS, itemName, invAdd, invHas, invTake, normItems, RECIPES, recipeSteps, craftTry, choiceState, optionOpen, qteState, braceState, lineDuration, textKey, makeSnapshot, restoreSnapshot, parseProfile, serializeProfile, newProfile, SAVE_KEY } = G0;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tt = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : e);
const reducedMotion = () => {
  try {
    if (SMD.settings && SMD.settings.reducedMotion !== undefined) return !!SMD.settings.reducedMotion;
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};
const smooth = (k) => k * k * (3 - 2 * k);

// ---------- The cast ----------
// Subtitle colours and looks (the player's own look comes from SMD.avatar).
// A level may add or change people with `cast: { id: { name, color, look } }`.
export const CAST = {
  you: { name: 'You', color: '#ffd36a' },
  kwame: { name: 'Kwame', color: '#7fd1c7', look: { suit: 'navy', skin: 's5', hair: 'short', hairColor: 'grey', visor: 'clear', patch: 'agency', patchColor: '#24539a' } },
  nadia: { name: 'Nadia', color: '#f3a8bb', look: { suit: 'classic', skin: 's3', hair: 'covered', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#5b4a8a' } },
  yusuf: { name: 'Yusuf', color: '#f0b429', look: { suit: 'navy', skin: 's4', hair: 'short', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#17807a' } },
  lena: { name: 'Lena', color: '#9cc7e8', look: { suit: 'classic', skin: 's1', hair: 'bun', hairColor: 'blond', visor: 'clear', patch: 'agency', patchColor: '#24539a' } },
  grace: { name: 'Grace', color: '#c4b2ea', look: { suit: 'teal', skin: 's6', hair: 'curly', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#5b4a8a' } },
  mariam: { name: 'Mariam', color: '#9fe0a8', look: { suit: 'teal', skin: 's3', hair: 'covered', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#4f7a32' } },
  tarek: { name: 'Tarek', color: '#e8c9a0', look: { suit: 'gold', skin: 's3', hair: 'short', hairColor: 'brown', visor: 'clear', patch: 'agency', patchColor: '#23282e' } },
  omar: { name: 'Omar', color: '#ffb38a', look: { suit: 'orange', skin: 's5', hair: 'curly', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#b4302c' } },
  aiko: { name: 'Aiko', color: '#f5d76e', look: { suit: 'lavender', skin: 's2', hair: 'bun', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#5b4a8a' } },
  control: { name: 'Control', color: '#c9d3dc' },
};
const MOOD_FACE = { worried: 'sad', sad: 'sad', scared: 'wow', surprised: 'wow', shocked: 'wow', happy: 'happy', glad: 'happy', joy: 'joy', relieved: 'happy', calm: null, neutral: null, angry: 'sad', tired: 'sad' };

const FAIL_TEXT = {
  o2: ['ll.fail.o2', 'The oxygen ran out.'],
  co2: ['ll.fail.co2', 'The air turned to poison.'],
  health: ['ll.fail.health', 'Your body gave out.'],
  power: ['ll.fail.power', 'The batteries died.'],
  time: ['ll.fail.time', 'Too late.'],
  qte: ['ll.fail.qte', 'You lost your grip.'],
  brace: ['ll.fail.brace', 'You lost your grip.'],
  error: ['ll.fail.error', 'Something broke. Trying that again.'],
};

class LLAbort extends Error {
  constructor(why) {
    super('ll-abort:' + (why || ''));
    this.llAbort = true;
  }
}
export const isAbort = (e) => !!(e && e.llAbort);

// ---------- Sets ----------
// js/ll/sets/<id>.js (the art engineer's) when it exists, else a stand-in.
// A set module exports `default`, `createSet` or `create`: (opts) => set |
// Promise<set>, with opts = { THREE, renderer, camera, scene, quality, reducedMotion, id }.
// The art sets load through js/ll/sets/index.js loadSet(id, opts). `?standin`
// in the address (or SMD.llStandin = true) forces the blockouts.
const INTERIOR = ['capsule', 'tunnel', 'habitat'];
let setsIndex;
async function setFactory(id) {
  try {
    if (SMD.llStandin || /[?&]standin\b/.test(location.search)) return null;
  } catch (e) {}
  if (setsIndex === undefined) {
    try {
      setsIndex = await import('./sets/index.js');
    } catch (e) {
      setsIndex = null;
    }
  }
  if (!setsIndex || !setsIndex.loadSet || (setsIndex.SETS && !setsIndex.SETS.includes(id))) return null;
  return (opts) => setsIndex.loadSet(id, opts);
}

// ---------- Render pipeline (js/ll/render.js, when the art engineer adds it) ----------
let renderMod;
async function renderPipeline() {
  if (renderMod !== undefined) return renderMod;
  try {
    renderMod = await import('./render.js');
  } catch (e) {
    renderMod = null;
  }
  return renderMod;
}

export function createGame(o) {
  const root = o.root;
  const stage = o.stage;
  const levels = o.levels || [];
  const sound = createSound();
  const hud = createHud(root, { sound, items: ITEMS });
  const renderer = getRenderer();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080c);
  const camera = new THREE.PerspectiveCamera(56, 1, 0.05, 2500);
  camera.position.set(0, 2, 5);
  const world = new THREE.Group();
  scene.add(world);

  // ---------- State ----------
  const G = {
    level: null,
    sectionIndex: 0,
    sectionId: null,
    flags: {},
    inventory: new Map(),
    res: newRes(),
    drains: {},
    meters: [],
    limits: {},
    choices: [],
    looted: new Set(),
    crafted: {},
    spots: new Map(), // key -> { key, anchor, items, collectible }
    watchers: [],
    set: null,
    setId: null,
    gravity: 'ground',
    cast: new Map(),
    power: 1,
    alarm: false,
    mood: null,
    runs: new Set(),
    run: null,
    paused: false,
    ending: false,
    failing: false,
    ui: 0, // HUD moments that own the input (QTE, choice, bench)
    cine: 0, // cinematic shots
    time: 0,
    idle: 0,
    objText: '',
    objAge: 0,
    hintText: '',
    hintNow: 0,
    way: null,
    wayPulse: false,
    shake: null,
    timerUI: null,
    frameInput: null,
    actionKey: 'KeyE',
    snapshot: null,
    keys: new Map(), // text key -> English (dev: SMD.llKeys())
    started: false,
    fadeTouched: false,
  };
  let profile = loadProfile();
  let player = null;
  let pipeline = null;
  let disposed = false;
  let runId = 0;
  const warned = new Set();
  const warnOnce = (msg) => {
    if (warned.has(msg)) return;
    warned.add(msg);
    console.warn('[Last Light] ' + msg);
  };

  // ---------- Profile (SMD.store 'ek-ll') ----------
  function loadProfile() {
    try {
      return parseProfile(SMD.store ? SMD.store.get(SAVE_KEY) : null);
    } catch (e) {
      return newProfile();
    }
  }
  function saveProfile() {
    try {
      if (SMD.store) SMD.store.set(SAVE_KEY, serializeProfile(profile));
    } catch (e) {}
  }

  // ---------- Runs and waits ----------
  function newRun() {
    const r = { id: ++runId, aborted: false, waits: new Set(), textN: 0, section: G.sectionIndex };
    G.runs.add(r);
    G.run = r;
    return r;
  }
  function abortAll(why) {
    for (const r of [...G.runs]) {
      r.aborted = true;
      for (const w of [...r.waits]) {
        if (w.done) continue;
        w.done = true;
        w.cleanup.forEach((fn) => {
          try {
            fn(true);
          } catch (e) {}
        });
        w.reject(new LLAbort(why));
      }
      r.waits.clear();
    }
    G.runs.clear();
  }
  // A promise tied to the current run. setup(w): w.tick(dt) runs every frame,
  // w.finish(v) resolves, w.cleanup holds undo functions.
  // keep: survives the end of its section (speech, walks, waits, fades);
  // everything else (an optional interact, a choice) resolves false then.
  // The promise has cancel(): resolve it now with false.
  function pending(setup, keep) {
    const r = G.run;
    let w = null;
    const p = new Promise((resolve, reject) => {
      if (!r || r.aborted || disposed) return reject(new LLAbort('stale'));
      w = { r, done: false, tick: null, cleanup: [], resolve, reject, keep: !!keep };
      w.finish = (v) => {
        if (w.done) return;
        w.done = true;
        r.waits.delete(w);
        w.cleanup.forEach((fn) => {
          try {
            fn(false);
          } catch (e) {}
        });
        resolve(v);
      };
      r.waits.add(w);
      try {
        setup(w);
      } catch (err) {
        console.error('[Last Light] director call failed', err);
        w.finish(undefined);
      }
    });
    p.catch(() => {});
    p.cancel = () => w && w.finish(false);
    return p;
  }
  // A section ended normally: its pending moments that were not awaited
  // (an optional find, a choice left open) are over.
  function closeRun(r) {
    for (const w of [...r.waits]) if (!w.keep) w.finish(false);
  }
  const settled = (v) => {
    const p = Promise.resolve(v);
    return p;
  };

  // ---------- Text ----------
  function tx(english, opts, explicitKey) {
    if (english == null) return '';
    const r = G.run;
    const n = r ? ++r.textN : 0;
    const key = textKey(G.level ? G.level.id : 'x', G.sectionId, n, explicitKey || (opts && opts.id));
    G.keys.set(key, String(english));
    return tt(key, String(english), Object.assign({ you: castName('you') }, opts || {}, (opts && opts.params) || {}));
  }
  function optKey(opt, suffix = '') {
    return textKey(G.level ? G.level.id : 'x', G.sectionId, 'opt.' + opt.id + suffix, opt.key ? opt.key + suffix : null);
  }
  const castInfo = (id) => Object.assign({}, CAST[id] || {}, (G.level && G.level.cast && G.level.cast[id]) || {}, (SMD.llCast && SMD.llCast[id]) || {});
  function castName(id) {
    if (id === 'you') {
      const a = SMD.avatar && SMD.avatar.get ? SMD.avatar.get() : null;
      return (a && a.name) || tt('ll.cast.you', 'You');
    }
    const c = castInfo(id);
    return tt('ll.cast.' + id, c.name || String(id).replace(/^./, (x) => x.toUpperCase()));
  }
  const nameOf = (id) => tt('ll.item.' + id, itemName(id));

  // ---------- Positions ----------
  const tmpV = new THREE.Vector3();
  function anchorObj(name) {
    if (!G.set || !G.set.anchors) return null;
    return G.set.anchors[name] || null;
  }
  // Where a target is: a cast id, an anchor name, 'you', an Object3D or {x,y,z}.
  // A name that is both a person and an anchor ('kwame') means the person,
  // except where a place is wanted (preferAnchor: placing, walking to).
  function locate(target, out = new THREE.Vector3(), preferAnchor) {
    if (target == null) return null;
    if (typeof target === 'string') {
      if (target === 'you' || target === 'player') return out.copy(player.position);
      const a = anchorObj(target);
      if (a && preferAnchor) return a.getWorldPosition(out);
      const c = G.cast.get(target);
      if (c && c.astro.group.visible) return out.copy(c.astro.group.position);
      if (a) return a.getWorldPosition(out);
      if (G.set && G.set.props && G.set.props[target]) return G.set.props[target].getWorldPosition(out);
      if (!G.loading) warnOnce(`unknown anchor or cast "${target}" in set ${G.setId}`);
      return null;
    }
    if (target.isObject3D) return target.getWorldPosition(out);
    if (typeof target.x === 'number') return out.set(target.x, target.y || 0, target.z);
    return null;
  }
  const isCastTarget = (t) => typeof t === 'string' && G.cast.has(t);
  // A point to aim markers at: heads for people, a little above floor anchors.
  function markPoint(target, out = new THREE.Vector3()) {
    const p = locate(target, out);
    if (!p) return null;
    // Anchors are feet points (zero g too): aim at the chest or the head.
    if (isCastTarget(target) || target === 'you') p.y += G.gravity === 'zeroG' ? 1.0 : 1.95;
    else p.y += G.gravity === 'zeroG' ? 0.9 : 1.1;
    return p;
  }
  // The player's reference point: feet on the ground, chest in zero g.
  function playerPoint(out = new THREE.Vector3()) {
    return out.copy(player.position);
  }
  function distTo(target) {
    const p = locate(target, new THREE.Vector3());
    if (!p) return Infinity;
    const me = playerPoint();
    if (G.gravity === 'zeroG') return me.distanceTo(p);
    const dy = Math.max(0, Math.abs(p.y - me.y) - 1.2);
    return Math.hypot(p.x - me.x, p.z - me.z, dy);
  }
  const proj = new THREE.Vector3();
  function screenOf(target) {
    const p = markPoint(target, proj);
    if (!p) return null;
    p.project(camera);
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    if (p.z > 1) return null;
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
  }

  // ---------- Sets ----------
  let loadStarted = 0;
  async function loadSet(id) {
    if (G.set && (G.setId === id || (G.set.includes || []).includes(id))) return G.set;
    loadStarted = performance.now();
    const make = await setFactory(id);
    let set = null;
    const opts = { THREE, renderer, camera, scene, id, appearance: SMD.avatar && SMD.avatar.get ? SMD.avatar.get() : null, quality: SMD.settings && SMD.settings.tier ? SMD.settings.tier() : 'high', reducedMotion: reducedMotion() };
    if (make) {
      try {
        set = await make(opts);
      } catch (err) {
        console.error(`[Last Light] set "${id}" failed to build; using a stand-in`, err);
        set = null;
      }
    }
    if (!set) {
      if (!hasStandin(id)) warnOnce(`no set "${id}"; using the pad stand-in`);
      set = createStandin(id);
    }
    set.id = set.id || id;
    set.includes = set.includes || (INTERIOR.includes(id) ? INTERIOR.slice() : [id]);
    if (!set.includes.includes(id)) set.includes = set.includes.concat(id);
    const mood = set.mood || {};
    // Swap (people cast while it loaded stay; the old set's go).
    for (const c of [...G.cast.values()]) if (!c.anchor || c.born < loadStarted) removeCast(c.id);
    if (G.set) {
      try {
        G.set.dispose && G.set.dispose();
      } catch (e) {}
      if (G.set.group && G.set.group.parent) G.set.group.parent.remove(G.set.group);
    }
    G.set = set;
    G.setId = id;
    if (set.group) world.add(set.group);
    const pick = (k) => (set[k] !== undefined ? set[k] : mood[k]);
    scene.fog = pick('fog') || null;
    scene.background = pick('background') || new THREE.Color(0x05080c);
    scene.environment = pick('environment') || null;
    renderer.toneMappingExposure = pick('exposure') || 1;
    renderer.shadowMap.enabled = pick('shadows') !== false;
    if (set.ready && set.ready.then) set.ready.catch(() => {});
    player.setArea(set);
    if (set.setPower) set.setPower(G.power);
    if (set.setAlarm) set.setAlarm(G.alarm);
    sound.ambience(set.ambience || (G.gravity === 'zeroG' ? 'fans' : 'wind'), G.power);
    syncSpots();
    if (pipeline && pipeline.setScene) pipeline.setScene(scene, camera, set);
    return set;
  }
  function spawnAt(anchor) {
    const name = anchor || 'start';
    const a = typeof name === 'string' ? anchorObj(name) : null;
    const p = locate(name, new THREE.Vector3(), true) || new THREE.Vector3();
    let yaw = null;
    if (a) {
      const q = a.getWorldQuaternion(new THREE.Quaternion());
      const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
      yaw = e.y;
    }
    player.teleport(p, yaw);
    // Spawned on a seat: strapped in (sitting, no walking) until the script
    // moves you on (another spawn, zero g, or anim('you', 'stand')).
    seatPlayer(typeof name === 'string' && /^seat_/.test(name));
  }
  function seatPlayer(on) {
    G.seated = !!on;
    if (!player) return;
    player.setStill(G.seated || G.ui > 0);
    const a = player.astro;
    if (a.isRigged && a.play) a.play(G.seated ? 'sit' : 'stand', G.seated ? { hold: true } : {});
  }

  // ---------- The cast (people in the scene) ----------
  function makeCast(id, opts = {}) {
    let c = G.cast.get(id);
    if (c) return c;
    const info = castInfo(id);
    const astro = createAstronaut(Object.assign({ name: info.name || id }, info.look || {}), { shadows: true, blob: G.gravity === 'ground', helmet: opts.helmet != null ? opts.helmet : false });
    astro.group.name = 'cast:' + id;
    world.add(astro.group);
    if (G.gravity === 'zeroG' && astro.setFloat) astro.setFloat(true);
    c = { id, astro, walk: null, pose: null, prop: null, looking: null, anchor: null, speed: 0, born: performance.now() };
    if (opts.pose) setPose(c, opts.pose);
    G.cast.set(id, c);
    return c;
  }
  function removeCast(id) {
    const c = G.cast.get(id);
    if (!c) return;
    if (c.prop && c.prop.parent === c.astro.group) c.astro.group.remove(c.prop);
    c.astro.dispose();
    G.cast.delete(id);
  }
  function clearCast() {
    [...G.cast.keys()].forEach(removeCast);
  }
  function placeCast(c, target, yawOverride) {
    const a = typeof target === 'string' ? anchorObj(target) : target && target.isObject3D ? target : null;
    c.anchor = typeof target === 'string' ? target : null;
    if (G.loading) return; // placed when the new set is in
    const p = locate(target, new THREE.Vector3(), true);
    if (!p) return;
    c.astro.group.position.copy(p);
    if (yawOverride != null) c.astro.group.rotation.y = yawOverride;
    else if (a) c.astro.group.rotation.y = new THREE.Euler().setFromQuaternion(a.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
    else c.astro.group.rotation.y = Math.atan2(player.position.x - p.x, player.position.z - p.z);
    if (typeof target === 'string' && /^seat_/.test(target)) setPose(c, 'sit');
    else if (c.pose === 'sit') setPose(c, null);
  }
  function setPose(c, pose) {
    c.pose = pose || null;
    const a = c.astro;
    if (a.isRigged && a.play) a.play(pose || 'stand', pose ? { hold: true } : {});
  }
  function poseCast(c, dt) {
    const j = c.astro.joints;
    if (c.astro.isRigged || !j || !j.hipL) return;
    if (c.pose === 'sit') {
      j.hipL.rotation.x = j.hipR.rotation.x = -1.5;
      j.knL.rotation.x = j.knR.rotation.x = 1.42;
      j.shL.rotation.x = j.shR.rotation.x = -0.42;
      j.elL.rotation.x = j.elR.rotation.x = -0.75;
    } else if (c.pose === 'lie') {
      j.hipL.rotation.x = j.hipR.rotation.x = -0.35;
      j.knL.rotation.x = j.knR.rotation.x = 0.6;
    }
  }
  function updateCast(dt) {
    for (const c of G.cast.values()) {
      const g = c.astro.group;
      if (c.walk) {
        const w = c.walk;
        const dx = w.to.x - g.position.x;
        const dy = w.to.y - g.position.y;
        const dz = w.to.z - g.position.z;
        const d = G.gravity === 'zeroG' ? Math.hypot(dx, dy, dz) : Math.hypot(dx, dz);
        if (d < 0.12) {
          c.speed = 0;
          const done = w.done;
          c.walk = null;
          if (w.yaw != null) g.rotation.y = w.yaw;
          if (done) done();
        } else {
          const top = w.speed;
          c.speed += (Math.min(top, d * 2 + 0.3) - c.speed) * Math.min(1, dt * 6);
          const step = Math.min(d, c.speed * dt);
          g.position.x += (dx / d) * step;
          g.position.z += (dz / d) * step;
          if (G.gravity === 'zeroG') g.position.y += (dy / d) * step;
          else g.position.y += dy * Math.min(1, dt * 4);
          const want = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y));
          g.rotation.y += diff * Math.min(1, dt * 8);
        }
      } else {
        c.speed += (0 - c.speed) * Math.min(1, dt * 8);
        // Turn to face you while talking (people do).
        if (c.turnTo != null && G.gravity === 'ground' && c.pose !== 'sit') {
          const diff = Math.atan2(Math.sin(c.turnTo - g.rotation.y), Math.cos(c.turnTo - g.rotation.y));
          g.rotation.y += diff * Math.min(1, dt * 5);
          if (Math.abs(diff) < 0.01) c.turnTo = null;
        }
      }
      if (G.gravity === 'ground' && c.astro.setSpeed) c.astro.setSpeed(c.speed);
      if (G.gravity === 'zeroG' && c.astro.setSwim) c.astro.setSwim(Math.min(1, c.speed));
      c.astro.update(dt);
      poseCast(c, dt);
    }
  }
  const faceYaw = (c) => Math.atan2(player.position.x - c.astro.group.position.x, player.position.z - c.astro.group.position.z);
  function castSnapshot() {
    return [...G.cast.values()].map((c) => ({ id: c.id, x: c.astro.group.position.x, y: c.astro.group.position.y, z: c.astro.group.position.z, yaw: c.astro.group.rotation.y, pose: c.pose, anchor: c.anchor }));
  }

  // ---------- Loot spots and collectible pickups (world objects) ----------
  const spotItems = new Map(); // key -> remove fn of its interactable
  function syncSpots() {
    if (!player) return;
    for (const [key, rm] of spotItems) {
      const s = G.spots.get(key);
      if (!s || G.looted.has(key) || !locate(s.anchor, tmpV)) {
        rm();
        spotItems.delete(key);
      }
    }
    for (const s of G.spots.values()) {
      if (spotItems.has(s.key) || G.looted.has(s.key)) continue;
      const at = typeof s.anchor === 'string' ? anchorObj(s.anchor) : null;
      if (!at && typeof s.anchor === 'string') continue;
      const item = {
        id: 'spot:' + s.key,
        at: at || new THREE.Vector3(s.anchor.x, s.anchor.y, s.anchor.z),
        radius: s.radius || (G.gravity === 'zeroG' ? 1.6 : 1.8),
        promptHeight: 1.0,
        label: () => s.label || (s.collectible ? tt('ll.ui.pickup', 'Pick up') : tt('ll.ui.search', 'Search')),
        enabled: () => !G.ui && !G.cine && !G.failing,
        onInteract: () => openSpot(s),
      };
      spotItems.set(s.key, player.addInteractable(item));
    }
  }
  function openSpot(s) {
    if (G.looted.has(s.key)) return;
    G.looted.add(s.key);
    syncSpots();
    if (s.collectible) {
      sound.sfx('pickup');
      foundCollectible(s.collectible);
    } else {
      if (G.set && G.set.openLocker) G.set.openLocker(typeof s.anchor === 'string' ? s.anchor : s.key);
      if (G.set && G.set.setState) G.set.setState(typeof s.anchor === 'string' ? s.anchor : s.key, 'open');
      sound.sfx('locker');
      const list = normItems(s.items);
      if (!list.length) hud.toast(`<span>${esc(tt('ll.ui.empty', 'Empty.'))}</span>`, { kind: 'dim', ms: 1600 });
      list.forEach(([id, n], i) => hud.later(260 + i * 240, () => give(id, n)));
    }
    (s.waiters || []).forEach((fn) => fn(normItems(s.items)));
    s.waiters = [];
  }

  // ---------- Collectibles and the journal ----------
  function collectibleDef(id) {
    for (const lv of levels) {
      const list = lv.collectibles;
      if (!list) continue;
      const d = Array.isArray(list) ? list.find((x) => x && x.id === id) : list[id] ? Object.assign({ id }, list[id]) : null;
      if (d) return Object.assign({ level: lv.id }, d);
    }
    return (SMD.llJournal && SMD.llJournal[id]) || null;
  }
  function foundCollectible(id) {
    const fresh = !profile.journal[id];
    profile.journal[id] = profile.journal[id] || Date.now();
    saveProfile();
    const d = collectibleDef(id);
    const title = d ? tt(d.titleKey || 'll.journal.' + id + '.title', d.title || id) : id;
    sound.sfx('journal');
    hud.toast(`${ICONS.book}<span><small>${esc(fresh ? tt('ll.ui.journal.new', 'Journal') : tt('ll.ui.journal.again', 'Journal · already found'))}</small>${esc(title)}</span>`, { kind: 'journal', ms: 3200 });
  }

  // ---------- Items ----------
  function give(id, n = 1, opts = {}) {
    const v = invAdd(G.inventory, id, n);
    if (n > 0 && !opts.silent) {
      sound.sfx('pickup');
      hud.toast(`${iconFor(id, ITEMS)}<span>${n > 1 ? `<b class="num">+${n}</b> ` : '+ '}${esc(nameOf(id))}</span>`, { kind: 'item' });
    }
    return v;
  }

  // ---------- Snapshots ----------
  function worldSnapshot() {
    const p = player.position;
    return {
      set: G.setId,
      gravity: G.gravity,
      player: { x: p.x, y: p.y, z: p.z, yaw: player.yaw },
      cast: castSnapshot(),
      power: G.power,
      alarm: G.alarm,
      music: G.mood,
      spots: [...G.spots.values()].filter((s) => typeof s.anchor === 'string').map((s) => ({ key: s.key, anchor: s.anchor, items: s.items || null, collectible: s.collectible || null, label: s.label || null })),
    };
  }
  function takeSnapshot() {
    return makeSnapshot({
      level: G.level.id,
      section: G.sectionIndex,
      sectionId: G.sectionId,
      flags: G.flags,
      inventory: G.inventory,
      res: G.res,
      drains: G.drains,
      meters: G.meters,
      limits: G.limits,
      choices: G.choices,
      looted: [...G.looted],
      crafted: G.crafted,
      world: worldSnapshot(),
    });
  }
  async function applySnapshot(snap) {
    const s = restoreSnapshot(snap);
    G.flags = s.flags;
    G.inventory = s.inventory;
    G.res = s.res;
    G.drains = s.drains;
    G.limits = s.limits;
    G.choices = s.choices;
    G.looted = new Set(s.looted);
    G.crafted = s.crafted;
    setMeters(s.meters);
    const w = s.world || {};
    gravity(w.gravity || G.level.gravity || 'ground');
    await loadSet(w.set || G.level.set || 'pad');
    G.spots = new Map();
    (w.spots || []).forEach((sp) => G.spots.set(sp.key, Object.assign({ waiters: [] }, sp)));
    clearCast();
    (w.cast || []).forEach((cs) => {
      const c = makeCast(cs.id);
      c.astro.group.position.set(cs.x, cs.y, cs.z);
      c.astro.group.rotation.y = cs.yaw || 0;
      setPose(c, cs.pose || null);
      c.anchor = cs.anchor || null;
    });
    if (w.player) player.teleport({ x: w.player.x, y: w.player.y, z: w.player.z }, w.player.yaw);
    else spawnAt('start');
    power(w.power != null ? w.power : 1);
    alarm(!!w.alarm);
    G.mood = null;
    if (w.music) sound.music(w.music), (G.mood = w.music);
    syncSpots();
  }

  // ---------- Meters ----------
  function setMeters(keys) {
    G.meters = (keys || []).filter((k) => METERS[k]);
    hud.setMeters(G.meters);
  }
  const activeMeter = (k) => G.meters.includes(k) || !!G.drains[k];

  // ---------- Level flow ----------
  async function start(spec = {}) {
    let level = null;
    let snap = spec.snapshot || null;
    const id = snap ? snap.level : spec.level;
    level = levels.find((l) => l.id === id) || levels[0];
    if (!level) throw new Error('no Last Light levels loaded');
    G.level = level;
    G.ending = false;
    G.started = true;
    hud.fade(1, 0);
    // Continue from a level's saved start (its carried-over flags and items).
    if (!snap && spec.section == null && profile.starts[level.id]) snap = profile.starts[level.id];
    const idx = snap ? clamp(snap.section | 0, 0, level.sections.length - 1) : clamp(spec.section | 0, 0, level.sections.length - 1);
    G.sectionIndex = idx;
    G.sectionId = level.sections[idx] && level.sections[idx].id;
    if (snap) {
      await applySnapshot(snap);
    } else {
      G.flags = {};
      G.inventory = new Map();
      G.res = newRes();
      G.drains = {};
      G.choices = [];
      G.looted = new Set();
      G.crafted = {};
      G.spots = new Map();
      setMeters([]);
      gravity(level.gravity || 'ground');
      await loadSet(level.set || 'pad');
      spawnAt(level.spawn || 'start');
      power(1);
      alarm(false);
    }
    // A level's start is a place the chapter list can replay from.
    if (idx === 0 && !profile.starts[level.id]) {
      profile.starts[level.id] = takeSnapshot();
      saveProfile();
    }
    const resumed = !!snap && !(idx === 0 && !spec.snapshot);
    runFrom(idx, { resumed: !!spec.snapshot || resumed });
  }

  async function runFrom(idx, o = {}) {
    const level = G.level;
    for (let i = idx; i < level.sections.length; i++) {
      if (disposed || G.ending) return;
      const sec = level.sections[i];
      G.sectionIndex = i;
      G.sectionId = sec.id || String(i);
      // Watchers registered by this section (or later ones) go on a replay.
      G.watchers = G.watchers.filter((w) => w.section < i);
      const r = newRun();
      G.snapshot = takeSnapshot();
      profile.checkpoint = G.snapshot;
      saveProfile();
      if (o.resumed && i === idx) {
        G.fadeTouched = true;
        hud.fade(0, 0.8);
        o.resumed = false;
      } else if (i === idx) {
        // A fresh level: its script fades in; if it forgets, do it for it.
        G.fadeTouched = false;
        hud.later(1600, () => {
          if (!G.fadeTouched && G.run === r && !r.aborted) hud.fade(0, 1);
        });
      }
      try {
        await sec.run(L);
      } catch (err) {
        if (isAbort(err)) return; // fail() or end() took over
        console.error(`[Last Light] section "${G.sectionId}" of ${level.id} threw`, err);
        if (!G.failing && !G.ending) fail('error');
        return;
      }
      if (r.aborted) return;
      closeRun(r);
    }
    if (!G.ending && !disposed) end(null);
  }

  function fail(reason) {
    if (G.failing || G.ending || disposed) return pendingNever();
    G.failing = true;
    const key = typeof reason === 'string' ? reason : 'error';
    const text = FAIL_TEXT[key] ? tt(FAIL_TEXT[key][0], FAIL_TEXT[key][1]) : tx(String(reason || ''), null);
    abortAll('fail');
    closeMoments();
    sound.sfx('fail');
    sound.alarm(false);
    hud.fadeMessage(text, tt('ll.ui.retrying', 'Back to the last checkpoint…'));
    hud.fade(1, reducedMotion() ? 0.2 : 0.8).then(async () => {
      await new Promise((res) => hud.later(1300, res));
      if (disposed) return;
      hud.fadeMessage('', '');
      try {
        await applySnapshot(G.snapshot);
      } catch (err) {
        console.error('[Last Light] restore failed', err);
      }
      G.failing = false;
      if (!disposed) runFrom(G.sectionIndex, { resumed: true });
    });
    return pendingNever();
  }
  // Something to `await` that never comes back (the section stops there).
  function pendingNever() {
    const p = Promise.reject(new LLAbort('stop'));
    p.catch(() => {});
    return p;
  }
  function closeMoments() {
    G.ui = 0;
    G.cine = 0;
    hud.letterbox(false);
    hud.sub(null);
    hud.timer(null);
    hud.objective(null);
    G.timerUI = null;
    G.way = null;
    G.shake = null;
    subQ.length = 0;
    subNow = null;
    if (player) {
      player.setEnabled(true);
      player.setStill(false);
      player.controller.setCameraActive(true, { instant: true });
    }
  }

  function end(nextId) {
    if (G.ending || disposed) return pendingNever();
    G.ending = true;
    abortAll('end');
    closeMoments();
    const level = G.level;
    const next = nextId === undefined || nextId === null ? (levels.slice().sort((a, b) => (a.n || 0) - (b.n || 0)).find((l) => (l.n || 0) > (level.n || 0)) || {}).id || null : nextId;
    profile.done[level.id] = true;
    const summary = summarize(level);
    profile.summary[level.id] = summary;
    if (next && levels.find((l) => l.id === next)) {
      const carry = makeSnapshot({ level: next, section: 0, flags: G.flags, inventory: G.inventory, res: newRes(), choices: G.choices, world: {} });
      profile.starts[next] = carry;
      profile.checkpoint = carry;
    } else profile.checkpoint = null;
    saveProfile();
    sound.music(null);
    if (o.onEnd) o.onEnd({ level, next, summary });
    return pendingNever();
  }
  function summarize(level) {
    const f = G.flags || {};
    let carried = '';
    if (typeof f.carried === 'string') carried = f.carried;
    else if (f.cargo) {
      // The cargo is chosen in one chapter and carried through the next.
      const owner = [level].concat(levels).find((l) => l.cargo && l.cargo[f.cargo]);
      const it = owner && owner.cargo[f.cargo].item;
      carried = it ? nameOf(it) : ITEMS[f.cargo] ? nameOf(f.cargo) : '';
    }
    const key = G.choices.filter((c) => c && c.level === level.id && (c.key || c.timed));
    // The chapter's last big call; the cargo already has its own row.
    const big = key.filter((c) => c.text !== carried);
    const pick = big.filter((c) => c.key).pop() || big[big.length - 1] || null;
    const list = level.collectibles ? (Array.isArray(level.collectibles) ? level.collectibles.map((c) => c.id) : Object.keys(level.collectibles)) : [];
    return { carried, choice: pick ? pick.text : '', found: list.filter((id) => profile.journal[id]).length, total: list.length };
  }

  // ---------- The director API ----------
  const L = {
    // Flow
    fadeIn(s = 1.2) {
      G.fadeTouched = true;
      return pending((w) => hud.fade(0, s).then(() => w.finish()), true);
    },
    fadeOut(s = 1.0) {
      G.fadeTouched = true;
      return pending((w) => hud.fade(1, s).then(() => w.finish()), true);
    },
    title(text, sub, opts = {}) {
      G.fadeTouched = true;
      const lv = G.level;
      const main = text != null ? tx(text, opts) : tt(lv.titleKey || 'll.level.' + lv.id + '.title', lv.title || lv.id);
      const small = sub != null ? tx(sub, opts, opts.subId) : lv.n ? tt('ll.ui.chapter', 'Chapter {n}', { n: lv.n }) : tt('ll.ui.prologue', 'Prologue');
      return pending((w) => hud.title(main, small, opts.seconds || 3.6).then(() => w.finish()), true);
    },
    wait(s) {
      return pending((w) => {
        let left = Number(s) || 0;
        w.tick = (dt) => {
          left -= dt;
          if (left <= 0) w.finish();
        };
      }, true);
    },
    // Run fn after s seconds of game time (cancelled by a failure).
    after(s, fn) {
      return L.wait(s).then(() => fn && fn(L));
    },
    setScene(setId, spawnAnchor) {
      const same = G.set && (G.setId === setId || (G.set.includes || []).includes(setId));
      // People cast right after this call (before the set has loaded) are
      // placed on the new set's anchors once it is in.
      if (!same) {
        clearCast();
        G.loading = setId;
      }
      return pending(async (w) => {
        await loadSet(setId);
        if (G.loading === setId) G.loading = null;
        for (const c of G.cast.values()) if (c.anchor) placeCast(c, c.anchor);
        if (!same || spawnAnchor) spawnAt(spawnAnchor || 'start');
        w.finish(G.set);
      }, true);
    },
    gravity(mode) {
      gravity(mode);
      return settled(G.gravity);
    },
    checkpoint() {
      // Sections are the checkpoints; this saves the current one again.
      profile.checkpoint = G.snapshot;
      saveProfile();
      return settled(true);
    },
    fail,
    end,

    // Guidance
    objective(text, anchor, opts = {}) {
      const s = text ? tx(text, opts) : '';
      G.objText = s;
      G.objAge = 0;
      G.idle = 0;
      G.hintText = '';
      G.wayPulse = false;
      hud.objective(s || null);
      if (s) sound.sfx('objective');
      G.way = anchor === undefined ? null : anchor;
      return settled(true);
    },
    waypoint(anchor) {
      G.way = anchor == null ? null : anchor;
      return settled(true);
    },
    hint(text, opts = {}) {
      G.hintText = text ? tx(text, opts) : '';
      G.hintNow = opts.now ? 6 : 0;
      if (!text) hud.hint(null);
      return settled(true);
    },

    // Movement goals
    reach(anchor, radius = 2) {
      return pending((w) => {
        w.tick = () => {
          if (distTo(anchor) <= radius) w.finish(true);
        };
      });
    },
    interact(anchor, label, opts = {}) {
      return pending((w) => {
        const at = typeof anchor === 'string' ? (G.cast.get(anchor) || {}).astro || anchorObj(anchor) : anchor;
        const atObj = at && at.group ? at.group : at;
        if (!atObj) {
          warnOnce(`interact: no anchor "${anchor}"`);
          return;
        }
        const text = label ? tx(label, opts) : tt('ll.ui.use', 'Use');
        const castT = isCastTarget(anchor);
        const rm = player.addInteractable({
          id: 'int:' + (typeof anchor === 'string' ? anchor : 'x') + ':' + w.r.id,
          at: atObj,
          radius: opts.radius || (G.gravity === 'zeroG' ? 1.6 : 1.9),
          priority: 2,
          promptHeight: castT ? 1.7 : 1.0,
          angle: opts.angle,
          label: text,
          enabled: () => !G.ui && !G.cine && !G.failing,
          onInteract: () => {
            sound.sfx('click');
            w.finish(true);
          },
        });
        w.cleanup.push(rm);
      });
    },
    follow(castId, opts = {}) {
      return pending((w) => {
        const before = G.way;
        G.way = castId;
        w.cleanup.push(() => G.way === castId && (G.way = before));
        const r = opts.radius || 3.2;
        w.tick = () => {
          const c = G.cast.get(castId);
          if (!c) return w.finish(false);
          if (!c.walk && distTo(castId) <= r) w.finish(true);
        };
      });
    },

    // People
    say(castId, line, opts = {}) {
      return speak(castId, line, opts, false);
    },
    sayAsync(castId, line, opts = {}) {
      speak(castId, line, opts, false);
      return settled(true);
    },
    radio(castId, line, opts = {}) {
      return speak(castId, line, Object.assign({}, opts), true);
    },
    cast(castId, anchor, opts = {}) {
      if (anchor === null || anchor === false) {
        removeCast(castId);
        return settled(null);
      }
      const c = makeCast(castId, opts);
      c.walk = null;
      if (anchor !== undefined) placeCast(c, anchor, opts.yaw);
      if (opts.pose !== undefined) c.pose = opts.pose;
      return settled(c.astro);
    },
    walk(castId, anchor, opts = {}) {
      return pending((w) => {
        const c = castId === 'you' ? null : G.cast.get(castId) || makeCast(castId);
        if (castId === 'you') {
          const p = locate(anchor, new THREE.Vector3(), true);
          if (!p) return w.finish(false);
          player.controller.moveTo(p, { run: !!opts.run, onArrive: () => w.finish(true) });
          return;
        }
        const p = locate(anchor, new THREE.Vector3(), true);
        if (!p) return w.finish(false);
        const a = typeof anchor === 'string' ? anchorObj(anchor) : null;
        if (c.pose) setPose(c, null);
        c.anchor = typeof anchor === 'string' ? anchor : null;
        c.walk = { to: p, speed: opts.speed || (opts.run ? 3.6 : G.gravity === 'zeroG' ? 0.8 : 1.45), yaw: a ? new THREE.Euler().setFromQuaternion(a.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y : null, done: () => w.finish(true) };
        if (opts.wait === false) w.finish(true);
      });
    },
    anim(castId, name, opts = {}) {
      const c = castId === 'you' ? { astro: player.astro, you: true } : G.cast.get(castId);
      if (!c) {
        warnOnce(`anim: no cast "${castId}"`);
        return settled(false);
      }
      const a = c.astro;
      switch (name) {
        case 'carry': {
          if (a.carry) a.carry({ spread: opts.spread != null ? opts.spread : 0.35 });
          const prop = opts.prop ? findProp(opts.prop) : null;
          if (prop) {
            c.propHome = c.propHome || { obj: prop, parent: prop.parent, pos: prop.position.clone(), quat: prop.quaternion.clone() };
            a.group.add(prop);
            prop.position.set(0, 1.0, 0.42);
            prop.quaternion.identity();
            c.prop = prop;
            if (c.you) G.carryProp = { name: opts.prop };
          }
          break;
        }
        case 'drop':
        case 'put': {
          if (a.carry) a.carry(false);
          const prop = c.prop;
          if (prop) {
            const at = opts.at ? locate(opts.at, new THREE.Vector3()) : null;
            if (at) {
              world.add(prop);
              prop.position.copy(at);
            } else prop.visible = opts.keep !== false ? false : prop.visible;
            c.prop = null;
          }
          break;
        }
        case 'sit':
        case 'lie':
          if (c.you) {
            if (name === 'sit') seatPlayer(true);
          } else setPose(c, name);
          break;
        case 'stand':
          if (c.you) seatPlayer(false);
          else setPose(c, null);
          break;
        case 'float':
          if (a.setFloat) a.setFloat(true);
          break;
        case 'helmet':
          if (a.setHelmet) a.setHelmet(true);
          break;
        case 'nohelmet':
          if (a.setHelmet) a.setHelmet(false);
          break;
        default:
          if (a.play) a.play(name, opts);
      }
      if (opts.face && a.setExpression) a.setExpression(opts.face);
      return settled(true);
    },
    look(castId, target) {
      const a = castId === 'you' ? player.astro : (G.cast.get(castId) || {}).astro;
      if (!a || !a.lookAt) return settled(false);
      if (target == null) a.lookAt(null);
      else if (target === 'you' || target === 'player') a.lookAt(player.group);
      else if (isCastTarget(target)) a.lookAt(G.cast.get(target).astro.group);
      else {
        const obj = typeof target === 'string' ? anchorObj(target) : target;
        if (obj && obj.isObject3D) a.lookAt(obj);
        else {
          const p = locate(target, new THREE.Vector3());
          if (p) a.lookAt(p);
        }
      }
      const c = G.cast.get(castId);
      if (c) c.looking = target;
      return settled(true);
    },

    // Choices
    choice(options, opts = {}) {
      return pending((w) => {
        const ctx = { flags: G.flags, inventory: G.inventory, L };
        const list = (options || []).slice(0, 3);
        if ((options || []).length > 3) warnOnce('choice: only three options are shown');
        const shown = list.map((op) => ({
          id: op.id,
          text: tt(optKey(op), op.text || op.id),
          locked: !optionOpen(op, ctx),
          lockedText: op.locked ? tt(optKey(op, '.locked'), op.locked) : '',
        }));
        list.forEach((op) => G.keys.set(optKey(op), op.text || op.id));
        const st = choiceState(list, { timer: opts.timer, timeout: opts.timeout, ctx });
        G.ui++;
        player.setStill(true);
        const wasLocked = player.locked;
        if (SMD.controls && SMD.controls.device !== 'gamepad') player.release();
        let h = null;
        const done = (id) => {
          if (w.done) return;
          const op = list.find((x) => x.id === id) || { id, text: id };
          h.close(id);
          G.choices.push({ level: G.level.id, section: G.sectionId, key: !!opts.key, id: opts.id || G.sectionId, pick: id, text: tt(optKey(op), op.text || id), timed: !!opts.timer, timedOut: st.timedOut });
          sound.sfx('click');
          if (wasLocked && SMD.controls && SMD.controls.device === 'keyboard') player.lock();
          w.finish(id);
        };
        h = hud.choiceOpen(shown, {
          timed: !!opts.timer,
          onPick: (id) => {
            if (st.pick(id)) {
              if (wasLocked) player.lock();
              done(id);
            }
          },
        });
        let since = 0;
        w.tick = (dt) => {
          const id = st.tick(dt);
          if (id != null) return done(id);
          h.update(st.fraction, (since += dt) > 0.3 ? G.frameInput : null);
        };
        w.cleanup.push((aborted) => {
          G.ui = Math.max(0, G.ui - 1);
          player.setStill(G.seated);
          if (aborted) h.close(null);
        });
      });
    },

    // Action
    qte(kind, opts = {}) {
      return pending((w) => {
        const st = qteState(kind, { time: opts.time, hold: opts.hold, count: opts.count, turns: opts.turns, assist: assist() });
        const label = opts.label ? tx(opts.label, opts) : '';
        G.ui++;
        G.actionKey = keyCode(opts.key);
        player.setStill(true);
        const h = hud.qteOpen({ kind: st.kind, key: opts.key || 'E', label });
        const at = opts.at || null;
        w.tick = (dt) => {
          st.tick(dt, G.frameInput || {});
          h.update(st, at ? screenOf(at) : null);
          if (st.done) {
            h.close(st.ok);
            sound.sfx(st.ok ? 'success' : 'wrong');
            if (st.ok) shakeCam(0.25, 0.25);
            w.finish(st.ok);
            if (!st.ok && opts.fail) fail(opts.fail === true ? 'qte' : opts.fail);
          }
        };
        w.cleanup.push((aborted) => {
          G.ui = Math.max(0, G.ui - 1);
          G.actionKey = 'KeyE';
          player.setStill(G.seated);
          if (aborted) h.close(false);
        });
      });
    },
    brace(seconds, opts = {}) {
      return pending((w) => {
        const st = braceState(seconds, { assist: assist(), drain: opts.drain });
        G.ui++;
        G.actionKey = keyCode(opts.key || 'Space');
        player.setStill(true);
        const label = opts.label ? tx(opts.label, opts) : '';
        const h = hud.qteOpen({ kind: 'hold', key: opts.key || 'Space', label: label || tt('ll.ui.brace', 'Brace') });
        const s0 = opts.shake != null ? opts.shake : 0.7;
        w.tick = (dt) => {
          st.tick(dt, G.frameInput || {});
          h.update({ progress: st.grip, timeFraction: 1 - st.fraction, down: (G.frameInput || {}).down }, null);
          if (s0) shakeCam(s0 * (0.6 + 0.4 * Math.sin(G.time * 7)), 0.12);
          if (st.done) {
            h.close(st.ok);
            sound.sfx(st.ok ? 'success' : 'wrong');
            w.finish(st.ok);
            if (!st.ok && opts.fail) fail(opts.fail === true ? 'brace' : opts.fail);
          }
        };
        w.cleanup.push((aborted) => {
          G.ui = Math.max(0, G.ui - 1);
          G.actionKey = 'KeyE';
          player.setStill(G.seated);
          if (aborted) h.close(false);
        });
      });
    },
    timer(seconds, label, opts = {}) {
      const text = label ? tx(label, opts) : '';
      let handle = null;
      const p = pending((w) => {
        let left = Number(seconds) || 0;
        const ui = { label: text, get left() {
          return left;
        } };
        G.timerUI = ui;
        w.tick = (dt) => {
          left -= dt;
          if (left <= 0) {
            w.finish(false);
            fail(opts.fail || 'time');
          }
        };
        w.cleanup.push(() => {
          if (G.timerUI === ui) {
            G.timerUI = null;
            hud.timer(null);
          }
        });
        handle = {
          stop: () => w.finish(true),
          add: (s) => (left += Number(s) || 0),
          get left() {
            return left;
          },
        };
      });
      if (handle) Object.assign(p, handle);
      return p;
    },

    // Survival
    get res() {
      return G.res;
    },
    meters(keys) {
      setMeters(keys || []);
      return settled(G.meters);
    },
    drain(rates) {
      Object.keys(rates || {}).forEach((k) => {
        if (!METERS[k]) return warnOnce(`drain: unknown meter "${k}"`);
        const v = Number(rates[k]) || 0;
        if (v) G.drains[k] = v;
        else delete G.drains[k];
      });
      return settled(G.drains);
    },
    onLow(key, threshold, fn) {
      const w = { key, threshold, fn, armed: true, section: G.sectionIndex };
      G.watchers.push(w);
      return () => {
        const i = G.watchers.indexOf(w);
        if (i >= 0) G.watchers.splice(i, 1);
      };
    },
    // Move a meter's warning or failure line: L.limit('co2', { fail: 25 }).
    limit(key, lim) {
      G.limits[key] = Object.assign({}, G.limits[key] || {}, lim || {});
      return settled(G.limits[key]);
    },

    // Items
    get inventory() {
      return G.inventory;
    },
    loot(anchor, items, opts = {}) {
      const key = opts.id || (typeof anchor === 'string' ? anchor : 'loot' + G.spots.size);
      let s = G.spots.get(key);
      if (!s) {
        s = { key, anchor, items, label: opts.label ? tx(opts.label, opts) : null, waiters: [] };
        G.spots.set(key, s);
      } else Object.assign(s, { anchor, items });
      syncSpots();
      if (G.looted.has(key)) return settled(normItems(items));
      return new Promise((res) => s.waiters.push(res));
    },
    give(id, n = 1, opts = {}) {
      give(id, n, opts);
      return settled(G.inventory.get(id) || 0);
    },
    take(id, n = 1) {
      return invTake(G.inventory, id, n);
    },
    has(id, n = 1) {
      return invHas(G.inventory, id, n);
    },
    craft(recipeId, opts = {}) {
      return pending((w) => {
        const recipe = (G.level.recipes && G.level.recipes[recipeId]) || RECIPES[recipeId];
        if (!recipe) {
          warnOnce(`craft: no recipe "${recipeId}"`);
          return w.finish(false);
        }
        const steps = recipeSteps(recipe, opts);
        let progress = Math.min(G.crafted[recipeId] || 0, steps.length);
        if (progress >= steps.length) return w.finish(true);
        G.ui++;
        player.setEnabled(false);
        const name = tt('ll.recipe.' + recipeId, recipe.name || nameOf(recipe.makes));
        const shotAt = opts.at || (G.set && G.set.shots && G.set.shots.bench ? 'bench' : null);
        let shotOn = false;
        if (shotAt && G.set.shots && G.set.shots[shotAt]) {
          shotOn = true;
          startShot(G.set.shots[shotAt], true);
        }
        let h = null;
        const finish = (ok) => {
          h.close();
          w.finish(ok);
        };
        h = hud.craftOpen({
          name,
          steps,
          get progress() {
            return progress;
          },
          inventory: G.inventory,
          itemName: nameOf,
          onPick: (id) => {
            const r = craftTry(steps, progress, id, G.inventory);
            if (r.ok) {
              progress = r.progress;
              G.crafted[recipeId] = progress;
              sound.sfx('place');
              h.refresh();
              if (r.complete) {
                const made = recipe.makes || recipeId;
                hud.later(350, () => {
                  if (w.done) return;
                  invAdd(G.inventory, made, 1);
                  sound.sfx('success');
                  hud.toast(`${iconFor(made, ITEMS)}<span><small>${esc(tt('ll.ui.built', 'Built'))}</small>${esc(nameOf(made))}</span>`, { kind: 'item', ms: 3000 });
                  finish(true);
                });
              }
            } else if (r.reason === 'wrong') {
              sound.sfx('wrong');
              h.refresh(true);
            } else if (r.reason === 'missing') {
              sound.sfx('wrong');
              h.refresh(true);
            }
          },
          onLeave: () => finish(false),
        });
        let since = 0;
        w.tick = (dt) => {
          const inp = G.frameInput;
          // The key that opened the bench must not also pick the first thing.
          if (!inp || (since += dt) < 0.3) return;
          if (inp.num) h.pickDigit(inp.num);
          else h.update(inp);
        };
        w.cleanup.push((aborted) => {
          G.ui = Math.max(0, G.ui - 1);
          player.setEnabled(true);
          if (shotOn) endShot();
          if (aborted) h.close();
        });
      });
    },
    get recipes() {
      return RECIPES;
    },
    collectible(id, anchor, opts = {}) {
      if (anchor) {
        const key = 'c:' + id;
        if (!G.spots.has(key)) G.spots.set(key, { key, anchor, collectible: id, label: opts.label ? tx(opts.label, opts) : null, waiters: [] });
        syncSpots();
        return settled(true);
      }
      foundCollectible(id);
      return settled(true);
    },

    // Camera and mood
    shot(spec, opts = {}) {
      return pending((w) => {
        const s = resolveShot(spec, opts);
        if (!s) return w.finish(false);
        startShot(s);
        let t = 0;
        w.tick = (dt) => {
          t += dt;
          if (t >= s.duration) w.finish(true);
        };
        w.cleanup.push(() => endShot());
      });
    },
    shake(strength = 0.5, seconds = 0.6) {
      shakeCam(strength, seconds);
      return settled(true);
    },
    alarm(on) {
      alarm(on);
      return settled(!!on);
    },
    power(level) {
      power(level);
      return settled(G.power);
    },
    sfx(name) {
      if (!sound.sfx(name)) {
        const A = SMD.audio;
        if (A && typeof A[name] === 'function') A[name]();
        else warnOnce(`sfx: unknown sound "${name}"`);
      }
      return settled(true);
    },
    music(mood) {
      G.mood = mood || null;
      sound.music(mood || null);
      return settled(true);
    },
    // Set-specific state (a breaker light, a valve): passed to set.setState.
    state(name, value) {
      const s = G.set;
      if (!s) return settled(false);
      if (s.setState) return settled(!!s.setState(name, value));
      if (/^breaker_\d+$/.test(name) && s.setBreaker) return settled((s.setBreaker(name, !!value), true));
      if (name === 'valve' && s.setValve) return settled((s.setValve(value ? 1 : 0), true));
      return settled(false);
    },

    // State
    get flags() {
      return G.flags;
    },
    set flags(v) {
      G.flags = v && typeof v === 'object' ? v : {};
    },
    get choices() {
      return G.choices;
    },
    player: {
      get position() {
        return player.position;
      },
      get astronaut() {
        return player.astro;
      },
      get yaw() {
        return player.yaw;
      },
      get controller() {
        return player.controller;
      },
    },
    get scene() {
      return G.set;
    },
    get level() {
      return G.level;
    },
    get section() {
      return G.sectionId;
    },
    t: (key, english, params) => tt(String(key).startsWith('ll.') ? key : 'll.' + key, english, params),
  };

  // ---------- Speech ----------
  const subQ = [];
  let subNow = null;
  function speak(castId, line, opts, radio) {
    const text = tx(line, opts);
    return pending((w) => {
      const item = { castId, text, opts, radio, w, t: 0, dur: lineDuration(text, opts) + (radio ? 0.3 : 0) };
      subQ.push(item);
      if (!subNow) nextSub();
      w.cleanup.push(() => {
        const i = subQ.indexOf(item);
        if (i >= 0) subQ.splice(i, 1);
        if (subNow === item) {
          subNow = null;
          hud.sub(null);
          endSpeaker(item);
          nextSub();
        }
      });
    });
  }
  function nextSub() {
    subNow = subQ.shift() || null;
    if (!subNow) return hud.sub(null);
    const it = subNow;
    const info = castInfo(it.castId);
    hud.sub({ name: castName(it.castId), color: info.color || '#ffd36a', text: it.text, radio: it.radio });
    if (it.radio) sound.sfx('radio');
    const c = G.cast.get(it.castId);
    const a = it.castId === 'you' ? player.astro : c && c.astro;
    if (a && a.setExpression) {
      const face = it.opts.mood && MOOD_FACE[it.opts.mood] !== undefined ? MOOD_FACE[it.opts.mood] : it.opts.face;
      if (face !== undefined) a.setExpression(face);
    }
    // People near you turn to you while they talk.
    if (c && it.opts.look !== false && distTo(it.castId) < 7) {
      if (!c.looking) c.astro.lookAt(player.group);
      if (!c.walk && distTo(it.castId) < 4.5) c.turnTo = faceYaw(c);
    }
    if (it.opts.anim && a && a.play) a.play(it.opts.anim);
  }
  function endSpeaker(it) {
    const c = G.cast.get(it.castId);
    if (c && !c.looking && c.astro.lookAt) c.astro.lookAt(null);
    if (it.radio) sound.sfx('radioOut');
  }
  function tickSubs(dt) {
    if (!subNow) return;
    subNow.t += dt;
    if (subNow.t >= subNow.dur) {
      const it = subNow;
      subNow = null;
      endSpeaker(it);
      it.w.finish(true);
      nextSub();
    }
  }

  // ---------- Cinematic shots ----------
  let shotS = null;
  function resolveShot(spec, opts) {
    if (!spec) return null;
    if (typeof spec === 'string') {
      const named = G.set && G.set.shots && G.set.shots[spec];
      if (!named && !isCastTarget(spec) && !anchorObj(spec) && spec !== 'you') return null;
      if (named) return Object.assign({ duration: 3 }, named, opts);
      // Frame a person's face or an anchor from where you stand.
      const who = G.cast.get(spec);
      if (who && !who.walk && who.pose !== 'sit') who.astro.group.rotation.y = who.turnTo = faceYaw(who);
      const head = markPoint(spec, new THREE.Vector3());
      if (!head) return null;
      const me = player.position.clone();
      me.y = head.y;
      const dir = me.sub(head);
      if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
      dir.normalize();
      const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(0.5);
      const from = head.clone().addScaledVector(dir, isCastTarget(spec) ? 1.6 : 3.2).add(side);
      from.y += isCastTarget(spec) ? -0.05 : 0.6;
      const to = from.clone().addScaledVector(dir, -0.25);
      return Object.assign({}, opts, { from, to, at: head, duration: opts.duration || 2.6, fov: isCastTarget(spec) ? 40 : 50 });
    }
    // { name, from, at, duration }: the set's named shot if it has one,
    // else from/at (anchors are feet: lift them to eye height).
    if (spec.name && G.set && G.set.shots && G.set.shots[spec.name]) return Object.assign({ duration: spec.duration || 3 }, G.set.shots[spec.name], opts);
    const f = spec.from != null ? locate(spec.from, new THREE.Vector3()) : null;
    const a = spec.at != null ? locate(spec.at, new THREE.Vector3()) : null;
    if (!f || !a || f.distanceTo(a) < 0.6) return typeof spec.at === 'string' ? resolveShot(spec.at, Object.assign({ duration: spec.duration }, opts)) : null;
    const lift = (t) => (typeof t === 'string' ? (isCastTarget(t) ? (G.gravity === 'zeroG' ? 1.0 : 1.7) : G.gravity === 'zeroG' ? 1.0 : 1.6) : 0);
    f.y += lift(spec.from);
    a.y += lift(spec.at) * 0.8;
    const to = spec.to ? locate(spec.to, new THREE.Vector3()) : f.clone().lerp(a, 0.08);
    return Object.assign({}, opts, { from: f, to, at: a, duration: spec.duration || opts.duration || 3, fov: spec.fov || null });
  }
  function startShot(s, hold) {
    const from = locate(s.from, new THREE.Vector3()) || camera.position.clone();
    const to = s.to ? locate(s.to, new THREE.Vector3()) : null;
    const at = locate(s.at, new THREE.Vector3()) || player.position.clone();
    G.cine++;
    player.setEnabled(false);
    player.controller.setCameraActive(false);
    hud.letterbox(true);
    shotS = { from, to: to || from.clone().lerp(at, 0.06), at, at2: s.at2 ? locate(s.at2, new THREE.Vector3()) : null, duration: s.duration || 3, t: 0, fov: s.fov || null, hold: !!hold, fov0: camera.fov };
  }
  function endShot() {
    G.cine = Math.max(0, G.cine - 1);
    if (G.cine) return;
    shotS = null;
    hud.letterbox(false);
    if (!G.ui) player.setEnabled(true);
    player.controller.setCameraActive(true);
  }
  function updateShot(dt) {
    if (!shotS) return;
    const s = shotS;
    s.t += dt;
    const k = smooth(clamp(s.t / s.duration, 0, 1));
    camera.position.lerpVectors(s.from, s.to, reducedMotion() ? 0 : k);
    if (s.at2) tmpV.lerpVectors(s.at, s.at2, k);
    else tmpV.copy(s.at);
    camera.lookAt(tmpV);
    const f = s.fov || s.fov0;
    if (Math.abs(camera.fov - f) > 0.05) {
      camera.fov += (f - camera.fov) * Math.min(1, dt * 6);
      camera.updateProjectionMatrix();
    }
  }

  // ---------- Mood helpers ----------
  function gravity(mode) {
    const m = mode === 'zeroG' ? 'zeroG' : 'ground';
    G.gravity = m;
    if (player) player.setMode(m);
    if (m === 'zeroG' && G.seated) seatPlayer(false);
    for (const c of G.cast.values()) if (c.astro.setFloat) c.astro.setFloat(m === 'zeroG');
  }
  function power(level) {
    G.power = clamp(Number(level), 0, 1);
    if (G.set && G.set.setPower) G.set.setPower(G.power);
    if (G.set) sound.ambience(G.set.ambience || 'fans', Math.max(0.15, G.power));
  }
  function alarm(on) {
    G.alarm = !!on;
    if (G.set && G.set.setAlarm) G.set.setAlarm(G.alarm);
    sound.alarm(G.alarm);
  }
  function shakeCam(strength, seconds) {
    const s = Number(strength) || 0;
    const d = Number(seconds) || 0.3;
    if (!G.shake || G.shake.left < d || G.shake.s < s) G.shake = { s, left: d, dur: d };
    if (s >= 0.6 && d >= 0.5 && pipeline && pipeline.impact) pipeline.impact(Math.min(1.2, s));
  }
  const assist = () => (reducedMotion() ? 0.6 : 0) + (SMD.settings && SMD.settings.llAssist ? 0.4 : 0);
  const keyCode = (k) => (!k ? 'KeyE' : k === 'Space' ? 'Space' : /^[A-Z]$/i.test(k) ? 'Key' + k.toUpperCase() : k);
  function findProp(name) {
    if (!G.set) return null;
    return (G.set.props && G.set.props[name]) || (G.set.group && G.set.group.getObjectByName(name)) || null;
  }

  // ---------- Frame ----------
  const wayV = new THREE.Vector3();
  let dotT = 0;
  function update(dt) {
    if (disposed) return;
    // SMD.llTimeScale: faster game time for scripted test runs (headless GPUs are slow).
    dt = Math.min(dt || 0, 0.1) * (Number(SMD.llTimeScale) > 0 ? Math.min(8, Number(SMD.llTimeScale)) : 1);
    const input = hud.readInput(G.actionKey);
    if (input.pause && !G.ui && !G.ending && !G.failing && G.started) {
      if (o.onPause) o.onPause('key');
      return;
    }
    if (G.paused) return;
    G.frameInput = input;
    G.time += dt;
    if (!player) return;
    // People and the player.
    player.update(dt);
    if (G.seated && !player.astro.isRigged) poseCast({ astro: player.astro, pose: 'sit' }, dt);
    updateCast(dt);
    if (G.set && G.set.update) {
      try {
        G.set.update(dt, G.time, camera);
      } catch (err) {
        warnOnce('set update failed: ' + err.message);
      }
    }
    // Waits (copy: finishing one can start another).
    for (const r of [...G.runs]) {
      for (const w of [...r.waits]) if (!w.done && w.tick) w.tick(dt);
      if (!r.waits.size && r !== G.run) G.runs.delete(r);
    }
    tickSubs(dt);
    root.classList.toggle('ll-busy', G.ui > 0);
    // Survival.
    if (!G.failing && !G.ending) {
      stepMeters(G.res, G.drains, dt);
      for (const k of Object.keys(METERS)) {
        if (activeMeter(k) && failed(k, G.res[k], G.limits)) {
          fail(k);
          break;
        }
      }
      if (!G.failing)
        checkWatchers(G.res, G.watchers).forEach((wt) => {
          try {
            const r = wt.fn(L, G.res[wt.key]);
            if (r && r.catch) r.catch((e) => !isAbort(e) && console.error(e));
          } catch (err) {
            if (!isAbort(err)) console.error('[Last Light] onLow handler failed', err);
          }
        });
    }
    const sev = {};
    Object.keys(METERS).forEach((k) => (sev[k] = activeMeter(k) ? severity(k, G.res[k], G.limits) : 0));
    const co2 = activeMeter('co2') ? co2Effects(G.res.co2, G.limits) : { blur: 0, speed: 1 };
    player.setSpeedScale(co2.speed);
    sound.heartbeat(Math.max(sev.o2, sev.health * 0.8), dt);
    // The CO2 headache blurs through the post pipeline (cheap); CSS without it.
    let cssBlur = co2.blur;
    if (pipeline && pipeline.set) {
      const b = Math.round(clamp(co2.blur / 3.2, 0, 1) * 0.6 * 50) / 50;
      if (b !== G.postBlur) {
        G.postBlur = b;
        pipeline.set({ blur: b });
      }
      cssBlur = 0;
    }
    hud.effects({ o2: sev.o2 * 0.95, hurt: sev.health, blur: cssBlur, alarm: G.alarm }, renderer.domElement);
    if (G.meters.length) hud.meters(G.res, { meta: METERS, sev });
    // Countdown.
    if (G.timerUI) hud.timer(G.timerUI.label, G.timerUI.left);
    // Shots and shake.
    updateShot(dt);
    if (G.shake) {
      G.shake.left -= dt;
      const k = Math.max(0, G.shake.left / G.shake.dur);
      const s = G.shake.s * k * (reducedMotion() ? 0.15 : 1) * 0.06;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
      if (G.shake.left <= 0) G.shake = null;
    }
    // Guidance: idle hint, waypoint, nearby things.
    const moving = player.controller.state.moving;
    G.idle = moving ? 0 : G.idle + dt;
    G.objAge += dt;
    if (G.hintNow > 0) G.hintNow -= dt;
    const showHint = G.hintText && !G.ui && !G.cine && (G.hintNow > 0 || (G.objText && (G.idle > 12 || G.objAge > 40)));
    hud.hint(showHint ? G.hintText : null);
    G.wayPulse = !!G.objText && !G.hintText && G.idle > 10;
    updateWaypoint();
    if ((dotT -= dt) <= 0) {
      dotT = 0.05;
      updateDots();
    }
    if (pipeline && pipeline.update) pipeline.update(dt);
  }
  function updateWaypoint() {
    if (G.way == null || G.cine || G.ui || G.failing || hud.fadeK > 0.5) return hud.waypoint(null);
    const p = markPoint(G.way, wayV);
    if (!p) return hud.waypoint(null);
    const d = distTo(G.way);
    if (d < (G.gravity === 'zeroG' ? 0.9 : 1.6)) return hud.waypoint(null);
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    const v = p.clone().project(camera);
    const behind = v.z > 1;
    let x = ((v.x + 1) / 2) * w;
    let y = ((1 - v.y) / 2) * h;
    if (behind) {
      x = w - x;
      y = h - y;
    }
    const m = 44;
    const top = 70;
    const bottom = 110;
    const inside = !behind && x > m && x < w - m && y > top && y < h - bottom;
    let angle = 0;
    if (!inside) {
      const cx = w / 2;
      const cy = h / 2;
      let dx = x - cx;
      let dy = y - cy;
      if (behind && Math.abs(dy) < 1) dy = 1;
      angle = Math.atan2(dy, dx);
      const sx = (w / 2 - m) / Math.max(1e-6, Math.abs(dx));
      const sy = ((dy > 0 ? h - bottom : h - top) / 2 - 0) / Math.max(1e-6, Math.abs(dy));
      const s = Math.min(sx, sy, 1e6);
      x = clamp(cx + dx * s, m, w - m);
      y = clamp(cy + dy * s, top, h - bottom);
    }
    hud.waypoint({ on: true, x, y, dist: d, edge: !inside, angle, pulse: G.wayPulse });
  }
  function updateDots() {
    if (G.cine || G.ui || hud.fadeK > 0.5) return hud.dots([]);
    const out = [];
    const me = playerPoint();
    for (const s of G.spots.values()) {
      if (G.looted.has(s.key)) continue;
      const p = locate(s.anchor, new THREE.Vector3());
      if (!p) continue;
      const d = p.distanceTo(me);
      p.y += s.collectible ? 0.6 : 1.0;
      if (d > 7 || d < 1.2) continue;
      const v = p.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      out.push({ x: ((v.x + 1) / 2) * (stage.clientWidth || 1), y: ((1 - v.y) / 2) * (stage.clientHeight || 1), kind: s.collectible ? 'collectible' : 'loot', alpha: clamp((7 - d) / 3, 0, 1) });
    }
    hud.dots(out);
  }

  // ---------- Build ----------
  player = createPlayer({ camera, dom: renderer.domElement, overlay: stage });
  world.add(player.group);
  player.on('unlock', (info) => {
    if (info && info.byCode) return;
    if (!G.ui && !G.cine && !G.ending && !G.failing && G.started && o.onPause) o.onPause('unlock');
  });
  player.on('menu', () => o.onPause && !G.ending && o.onPause('key'));
  renderPipeline().then((mod) => {
    if (disposed || !mod) return;
    const make = mod.createPipeline;
    if (typeof make !== 'function' || renderer.isNullRenderer) return;
    try {
      pipeline = make({ renderer, scene, camera }) || null;
      if (pipeline && pipeline.setScene && G.set) pipeline.setScene(scene, camera, G.set);
      if (pipeline && pipeline.setSize) pipeline.setSize(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight));
    } catch (err) {
      console.warn('[Last Light] render pipeline failed; plain rendering', err);
      pipeline = null;
    }
  });

  const sceneObj = {
    scene,
    camera,
    shadows: true,
    exposure: 1,
    update,
    // engine.js calls render(renderer) instead of its own render when present.
    render(r, dt) {
      if (pipeline && pipeline.render) pipeline.render(dt);
      else r.render(scene, camera);
    },
    onResize(w, h) {
      if (pipeline && pipeline.setSize) pipeline.setSize(w, h);
    },
    dispose() {
      game.dispose();
    },
  };

  const game = {
    L,
    sceneObj,
    start,
    get profile() {
      return profile;
    },
    get state() {
      return G;
    },
    get player() {
      return player;
    },
    get hud() {
      return hud;
    },
    get sound() {
      return sound;
    },
    get paused() {
      return G.paused;
    },
    pause(on) {
      G.paused = !!on;
      if (G.paused) {
        player.setEnabled(false);
        sound.alarm(false);
      } else {
        if (!G.ui && !G.cine) player.setEnabled(true);
        if (G.alarm) sound.alarm(true);
      }
    },
    restartCheckpoint() {
      if (!G.snapshot || G.failing || G.ending) return;
      G.paused = false;
      G.failing = true;
      abortAll('restart');
      closeMoments();
      hud.fade(1, 0.4).then(async () => {
        await applySnapshot(G.snapshot);
        G.failing = false;
        runFrom(G.sectionIndex, { resumed: true });
      });
    },
    keys: () => [...G.keys.entries()],
    dispose() {
      if (disposed) return;
      disposed = true;
      abortAll('dispose');
      try {
        sound.dispose();
      } catch (e) {}
      try {
        hud.dispose();
      } catch (e) {}
      try {
        if (pipeline && pipeline.dispose) pipeline.dispose();
      } catch (e) {}
      clearCast();
      try {
        player.dispose();
      } catch (e) {}
      if (G.set) {
        try {
          G.set.dispose && G.set.dispose();
        } catch (e) {}
      }
      try {
        renderer.domElement.style.filter = '';
      } catch (e) {}
    },
  };
  SMD.llKeys = () => game.keys();
  return game;
}
