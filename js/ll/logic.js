// Last Light: the pure rules of the level framework (docs/LASTLIGHT.md).
// No imports, no DOM, no THREE: js/ll/director.js uses these and
// tests/ll-director.test.js loads this file on its own.
//
// Survival meters, inventory, crafting recipes, timed choices, the quick-time
// event state machine, checkpoint snapshots, the save profile and the text
// keys for translation all live here.

export const SAVE_KEY = 'ek-ll';
export const SAVE_VERSION = 1;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

// ---------- Survival meters ----------
// bad: which direction hurts. warn: where the screen starts reacting.
// fail: where the section is lost (null: never by itself).
// Drain rates are "per second toward bad": o2/power/health fall, co2 rises;
// a negative rate is recovery.
export const METERS = {
  o2: { start: 100, min: 0, max: 100, bad: 'low', warn: 30, fail: 0, unit: '%' },
  co2: { start: 2, min: 0, max: 40, bad: 'high', warn: 15, fail: 30, unit: 'mmHg' },
  power: { start: 100, min: 0, max: 100, bad: 'low', warn: 20, fail: null, unit: '%' },
  health: { start: 100, min: 0, max: 100, bad: 'low', warn: 35, fail: 0, unit: '%' },
};
export const METER_KEYS = Object.keys(METERS);

export function newRes(over) {
  const r = {};
  METER_KEYS.forEach((k) => (r[k] = METERS[k].start));
  if (over) Object.keys(over).forEach((k) => k in r && Number.isFinite(over[k]) && (r[k] = over[k]));
  return r;
}

export function clampMeter(key, v) {
  const m = METERS[key];
  return m ? clamp(v, m.min, m.max) : v;
}

// One step of the drains. Mutates res; returns the keys that changed.
export function stepMeters(res, drains, dt) {
  const changed = [];
  if (!drains || !(dt > 0)) return changed;
  for (const k of Object.keys(drains)) {
    const rate = Number(drains[k]);
    const m = METERS[k];
    if (!m || !rate) continue;
    const dir = m.bad === 'low' ? -1 : 1;
    const before = res[k];
    res[k] = clampMeter(k, res[k] + dir * rate * dt);
    if (res[k] !== before) changed.push(k);
  }
  return changed;
}

// How bad a meter is, 0 (fine) .. 1 (at the failure line). Used for effects.
export function severity(key, v, limits) {
  const m = METERS[key];
  if (!m) return 0;
  const warn = limits && limits[key] && limits[key].warn != null ? limits[key].warn : m.warn;
  const failAt = limits && limits[key] && limits[key].fail !== undefined ? limits[key].fail : m.fail;
  const end = failAt != null ? failAt : m.bad === 'low' ? m.min : m.max;
  if (m.bad === 'low') return v >= warn ? 0 : clamp((warn - v) / Math.max(1e-6, warn - end), 0, 1);
  return v <= warn ? 0 : clamp((v - warn) / Math.max(1e-6, end - warn), 0, 1);
}

// Past the failure line (only for meters that can fail).
export function failed(key, v, limits) {
  const m = METERS[key];
  if (!m) return false;
  const f = limits && limits[key] && limits[key].fail !== undefined ? limits[key].fail : m.fail;
  if (f == null) return false;
  return m.bad === 'low' ? v <= f : v >= f;
}

// Is the value on the bad side of a threshold for this meter?
export const beyond = (key, v, threshold) => ((METERS[key] && METERS[key].bad === 'high') ? v >= threshold : v <= threshold);

// onLow watchers: { key, threshold, fn, armed }. Fires once on crossing,
// re-arms when the meter recovers past the threshold (with a little slack).
// Returns the watchers that fire now (and updates their armed state).
export function checkWatchers(res, watchers) {
  const out = [];
  for (const w of watchers) {
    const v = res[w.key];
    if (v == null) continue;
    const bad = beyond(w.key, v, w.threshold);
    if (bad && w.armed !== false) {
      w.armed = false;
      out.push(w);
    } else if (!bad && w.armed === false) {
      const m = METERS[w.key];
      const span = m ? (m.max - m.min) * 0.02 : 0;
      const ok = m && m.bad === 'high' ? v < w.threshold - span : v > w.threshold + span;
      if (ok) w.armed = true;
    }
  }
  return out;
}

// CO2 effects: headache blur and slower movement past the warning line.
export function co2Effects(co2, limits) {
  const k = severity('co2', co2, limits);
  return { blur: k * 3.2, speed: 1 - 0.45 * k, k };
}

// ---------- Items ----------
// Names are English defaults; the HUD wraps them in SMD.t('ll.item.<id>').
export const ITEMS = {
  cartridge: { name: 'CO2 cartridge', icon: 'cartridge' },
  hose: { name: 'Suit hose', icon: 'hose' },
  bag: { name: 'Plastic bag', icon: 'bag' },
  tape: { name: 'Duct tape', icon: 'tape' },
  cover: { name: 'Flight plan cover', icon: 'cover' },
  sock: { name: 'Sock', icon: 'sock' },
  food: { name: 'Food pack', icon: 'food' },
  water: { name: 'Water bag', icon: 'water' },
  o2tank: { name: 'Oxygen tank', icon: 'tank' },
  camera: { name: 'High-res camera', icon: 'camera' },
  patch13: { name: 'Apollo 13 patch', icon: 'patch' },
  spare_cartridges: { name: 'Spare CO2 cartridges', icon: 'cartridge' },
  medkit: { name: 'Medical kit', icon: 'medkit' },
  flashlight: { name: 'Flashlight', icon: 'light' },
  co2adapter: { name: 'CO2 adapter', icon: 'adapter' },
  patchkit: { name: 'Patch kit', icon: 'patch' },
  watershield: { name: 'Water-bag shield', icon: 'shield' },
};

export function itemName(id) {
  return (ITEMS[id] && ITEMS[id].name) || String(id).replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function invAdd(inv, id, n = 1) {
  const k = Math.round(Number(n));
  if (!id || !Number.isFinite(k) || k === 0) return inv.get(id) || 0;
  const v = Math.max(0, (inv.get(id) || 0) + k);
  if (v) inv.set(id, v);
  else inv.delete(id);
  return v;
}
export const invHas = (inv, id, n = 1) => (inv.get(id) || 0) >= n;
export function invTake(inv, id, n = 1) {
  if (!invHas(inv, id, n)) return false;
  invAdd(inv, id, -n);
  return true;
}
export const invToObj = (inv) => Object.fromEntries([...inv.entries()].filter(([, v]) => v > 0));
export function invFromObj(obj) {
  const m = new Map();
  if (obj && typeof obj === 'object') Object.keys(obj).forEach((k) => Number(obj[k]) > 0 && m.set(k, Math.round(Number(obj[k]))));
  return m;
}
// loot() items: ['tape', 'sock'] or { tape: 1, sock: 2 } or [['tape', 2]].
export function normItems(items) {
  const out = [];
  if (!items) return out;
  if (Array.isArray(items))
    items.forEach((x) => {
      if (typeof x === 'string') out.push([x, 1]);
      else if (Array.isArray(x)) out.push([x[0], x[1] || 1]);
      else if (x && x.id) out.push([x.id, x.n || 1]);
    });
  else Object.keys(items).forEach((k) => out.push([k, Number(items[k]) || 1]));
  return out.filter(([id, n]) => id && n > 0);
}

// ---------- Crafting ----------
// steps: the parts in the order they go on. Each step uses one of that item.
export const RECIPES = {
  // Apollo 13's "mailbox": the square command-module cartridge on the round
  // lunar-module socket, made from what was on board.
  co2adapter: { name: 'CO2 adapter', makes: 'co2adapter', steps: ['cartridge', 'hose', 'bag', 'tape', 'cover', 'sock'] },
  patchkit: { name: 'Patch kit', makes: 'patchkit', steps: ['cover', 'bag', 'tape'] },
  watershield: { name: 'Water-bag shield', makes: 'watershield', steps: ['water', 'water', 'bag', 'tape'] },
};

// The steps of a recipe after the level's changes (skip some, or replace them).
export function recipeSteps(recipe, opts = {}) {
  if (!recipe) return [];
  let steps = (opts.steps || recipe.steps).slice();
  if (opts.skip) {
    const skip = [].concat(opts.skip);
    skip.forEach((s) => {
      const i = steps.indexOf(s);
      if (i >= 0) steps.splice(i, 1);
    });
  }
  return steps;
}

// Try to put item `id` on next. progress = number of steps already done.
// Returns { ok, reason: 'done'|'placed'|'wrong'|'missing', progress, next, complete }.
export function craftTry(steps, progress, id, inv) {
  if (progress >= steps.length) return { ok: false, reason: 'done', progress, next: null, complete: true };
  const want = steps[progress];
  if (id !== want) return { ok: false, reason: 'wrong', progress, next: want, complete: false };
  if (!invHas(inv, id)) return { ok: false, reason: 'missing', progress, next: want, complete: false };
  invTake(inv, id);
  const p = progress + 1;
  return { ok: true, reason: 'placed', progress: p, next: p < steps.length ? steps[p] : null, complete: p >= steps.length };
}

// What is still missing to finish from here (counting repeats).
export function craftMissing(steps, progress, inv) {
  const need = {};
  for (let i = progress; i < steps.length; i++) need[steps[i]] = (need[steps[i]] || 0) + 1;
  return Object.keys(need).filter((id) => (inv.get(id) || 0) < need[id]);
}

// ---------- Choices ----------
// An option is available unless `requires` fails: a string item id (or
// 'flag:name' / '!flag:name'), a function (ctx) => bool, or an array of those.
export function optionOpen(opt, ctx) {
  const req = opt && opt.requires;
  if (req == null) return true;
  const one = (r) => {
    if (typeof r === 'function') {
      try {
        return !!r(ctx.L || ctx);
      } catch (e) {
        return false;
      }
    }
    if (typeof r === 'string') {
      if (r.startsWith('flag:')) return !!(ctx.flags && ctx.flags[r.slice(5)]);
      if (r.startsWith('!flag:')) return !(ctx.flags && ctx.flags[r.slice(6)]);
      return !!(ctx.inventory && invHas(ctx.inventory, r));
    }
    if (r && typeof r === 'object' && r.flag) return !!(ctx.flags && ctx.flags[r.flag]) === (r.is !== false);
    return !!r;
  };
  return Array.isArray(req) ? req.every(one) : one(req);
}

// The timed choice as a small state machine: tick(dt) returns the picked id
// once the time runs out. timeout: an option id, or null to take the first
// open option (Telltale's "silence" needs an explicit id).
export function choiceState(options, o = {}) {
  const list = (options || []).slice(0, 3);
  const timer = Number(o.timer) > 0 ? Number(o.timer) : 0;
  const s = {
    options: list,
    timer,
    left: timer,
    picked: null,
    timedOut: false,
    tick(dt) {
      if (s.picked != null || !timer) return s.picked;
      s.left = Math.max(0, s.left - dt);
      if (s.left <= 0) {
        s.timedOut = true;
        s.picked = o.timeout !== undefined && o.timeout !== null ? o.timeout : null;
        if (s.picked == null) {
          const open = list.find((x) => optionOpen(x, o.ctx || {}));
          s.picked = open ? open.id : list[0] ? list[0].id : null;
        }
      }
      return s.picked;
    },
    pick(id) {
      if (s.picked != null) return false;
      const opt = list.find((x) => x.id === id);
      if (!opt || !optionOpen(opt, o.ctx || {})) return false;
      s.picked = id;
      return true;
    },
    get fraction() {
      return timer ? s.left / timer : 1;
    },
  };
  return s;
}

// ---------- Quick-time events ----------
// kind: 'press' (once within the window), 'hold' (keep it down for `hold`
// seconds), 'mash' (`count` presses), 'turn' (`turns` of rotation).
// Generous by design: a long window, slow decay. `assist` (0..1, from
// reduced motion or easy mode) stretches the window and softens the decay.
export function qteState(kind, o = {}) {
  const assist = clamp(Number(o.assist) || 0, 0, 1);
  const stretch = 1 + assist * 0.6;
  const k = ['press', 'hold', 'mash', 'turn'].includes(kind) ? kind : 'press';
  const window = (Number(o.time) > 0 ? Number(o.time) : { press: 3, hold: 6, mash: 5, turn: 7 }[k]) * stretch;
  const need = k === 'hold' ? (Number(o.hold) > 0 ? Number(o.hold) : 1.4) : k === 'mash' ? Math.max(1, Math.round(Number(o.count) > 0 ? Number(o.count) : 8)) : k === 'turn' ? (Number(o.turns) > 0 ? Number(o.turns) : 1.5) : 1;
  const decay = { press: 0, hold: 0.35, mash: 0.12, turn: 0.04 }[k] * (1 - 0.6 * assist);
  const s = {
    kind: k,
    window,
    left: window,
    progress: 0, // 0..1
    done: false,
    ok: false,
    down: false,
    // input: { down (held now), pressed (edges this frame), turn (radians this frame) }
    tick(dt, input = {}) {
      if (s.done) return s;
      s.left -= dt;
      const pressed = input.pressed || 0;
      s.down = !!input.down;
      if (k === 'press') {
        if (pressed > 0) s.progress = 1;
      } else if (k === 'hold') {
        if (input.down) s.progress += dt / need;
        else s.progress -= decay * dt;
      } else if (k === 'mash') {
        s.progress += pressed / need;
        s.progress -= decay * dt;
      } else if (k === 'turn') {
        s.progress += Math.abs(input.turn || 0) / (need * Math.PI * 2);
        s.progress -= decay * dt;
      }
      s.progress = clamp(s.progress, 0, 1);
      if (s.progress >= 1) {
        s.done = true;
        s.ok = true;
      } else if (s.left <= 0) {
        s.done = true;
        s.ok = false;
      }
      return s;
    },
    get timeFraction() {
      return clamp(s.left / window, 0, 1);
    },
  };
  return s;
}

// Brace: keep a grip meter up for `seconds` while it shakes. Holding fills
// it, letting go drains it; empty = lost. Starts full.
export function braceState(seconds, o = {}) {
  const assist = clamp(Number(o.assist) || 0, 0, 1);
  const dur = Number(seconds) > 0 ? Number(seconds) : 4;
  const drain = (o.drain || 0.32) * (1 - 0.5 * assist);
  const s = {
    duration: dur,
    t: 0,
    grip: 1,
    done: false,
    ok: false,
    tick(dt, input = {}) {
      if (s.done) return s;
      s.t += dt;
      s.grip = clamp(s.grip + (input.down ? 0.9 : -drain) * dt, 0, 1);
      if (s.grip <= 0) {
        s.done = true;
        s.ok = false;
      } else if (s.t >= dur) {
        s.done = true;
        s.ok = true;
      }
      return s;
    },
    get fraction() {
      return clamp(s.t / dur, 0, 1);
    },
  };
  return s;
}

// ---------- Subtitles ----------
// How long a line stays up: about 3.2 words a second, never under 1.8 s.
export function lineDuration(text, o = {}) {
  if (o.wait != null && Number(o.wait) >= 0) return Number(o.wait);
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  const chars = String(text || '').length;
  return clamp(0.9 + Math.max(words / 3.2, chars / 17), 1.8, 7);
}

// ---------- Text keys ----------
// Explicit opts.id wins ('ll.' is added unless present); otherwise
// ll.<level>.<section>.<n>, n counting the section's text calls from 1.
export function textKey(levelId, sectionId, n, explicit) {
  if (explicit) return String(explicit).startsWith('ll.') ? String(explicit) : 'll.' + explicit;
  return `ll.${levelId || 'x'}.${sectionId || 'x'}.${n}`;
}

// ---------- Checkpoints ----------
// Everything needed to replay a section from its start. `world` holds the
// scene side (set, player spot, cast, lights) that director.js fills in.
export function makeSnapshot(st) {
  return clone({
    level: st.level,
    section: st.section,
    sectionId: st.sectionId || null,
    flags: st.flags || {},
    inventory: st.inventory instanceof Map ? invToObj(st.inventory) : st.inventory || {},
    res: st.res || newRes(),
    drains: st.drains || {},
    meters: st.meters || [],
    limits: st.limits || {},
    choices: st.choices || [],
    looted: st.looted || [],
    crafted: st.crafted || {},
    world: st.world || {},
  });
}

export function restoreSnapshot(snap) {
  const s = clone(snap) || {};
  return {
    level: s.level,
    section: s.section | 0,
    sectionId: s.sectionId || null,
    flags: s.flags && typeof s.flags === 'object' ? s.flags : {},
    inventory: invFromObj(s.inventory),
    res: newRes(s.res),
    drains: s.drains && typeof s.drains === 'object' ? s.drains : {},
    meters: Array.isArray(s.meters) ? s.meters.filter((k) => METERS[k]) : [],
    limits: s.limits && typeof s.limits === 'object' ? s.limits : {},
    choices: Array.isArray(s.choices) ? s.choices : [],
    looted: Array.isArray(s.looted) ? s.looted : [],
    crafted: s.crafted && typeof s.crafted === 'object' ? s.crafted : {},
    world: s.world && typeof s.world === 'object' ? s.world : {},
  };
}

// ---------- The save profile (SMD.store 'ek-ll') ----------
// { v, checkpoint (snapshot | null), starts { levelId: snapshot at its first
//   section }, done { levelId: true }, journal { id: foundAtMs }, creator
//   (the astronaut creator was offered), summary { levelId: {...} } }
export function newProfile() {
  return { v: SAVE_VERSION, checkpoint: null, starts: {}, done: {}, journal: {}, creator: false, summary: {}, savedAt: 0 };
}

export function parseProfile(raw) {
  const p = newProfile();
  if (!raw) return p;
  let o = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch (e) {
      return p;
    }
  }
  if (!o || typeof o !== 'object' || o.v !== SAVE_VERSION) return p;
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  if (o.checkpoint && typeof o.checkpoint === 'object' && typeof o.checkpoint.level === 'string') p.checkpoint = o.checkpoint;
  p.starts = {};
  Object.keys(obj(o.starts)).forEach((k) => {
    const s = o.starts[k];
    if (s && typeof s === 'object' && typeof s.level === 'string') p.starts[k] = s;
  });
  p.done = {};
  Object.keys(obj(o.done)).forEach((k) => o.done[k] && (p.done[k] = true));
  p.journal = {};
  Object.keys(obj(o.journal)).forEach((k) => (p.journal[k] = Number(o.journal[k]) || 1));
  p.creator = !!o.creator;
  p.summary = obj(o.summary);
  p.savedAt = Number(o.savedAt) || 0;
  return p;
}

export function serializeProfile(p) {
  return JSON.stringify(Object.assign({}, p, { v: SAVE_VERSION, savedAt: Date.now() }));
}

// Which levels the chapter list can start: the first one, every finished one,
// every one with a saved start, and the one the checkpoint is in.
export function unlockedLevels(levels, profile) {
  const sorted = (levels || []).slice().sort((a, b) => (a.n || 0) - (b.n || 0));
  const open = new Set();
  sorted.forEach((lv, i) => {
    if (i === 0 || profile.done[lv.id] || profile.starts[lv.id] || (profile.checkpoint && profile.checkpoint.level === lv.id)) open.add(lv.id);
  });
  return open;
}
