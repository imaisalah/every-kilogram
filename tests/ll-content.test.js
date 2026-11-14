// Last Light level content (content/levels/prologue.js, lifeboat.js) against
// docs/LASTLIGHT.md: runs every section against a recording mock of the
// director `L` for every cargo and every choice, then checks objectives,
// anchors, line length, dialogue runs, timed choices, collectibles, Arabic
// coverage (js/i18n/ar-ll.js) and that the prologue's cargo pays off.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

globalThis.SMD = globalThis.SMD || {};
const SMD = globalThis.SMD;
require('../js/i18n.js');
require('../content/levels/prologue.js');
require('../content/levels/lifeboat.js');
require('../js/i18n/ar-ll.js');

const ROOT = path.join(__dirname, '..');
const SRC = {
  prologue: fs.readFileSync(path.join(ROOT, 'content/levels/prologue.js'), 'utf8'),
  lifeboat: fs.readFileSync(path.join(ROOT, 'content/levels/lifeboat.js'), 'utf8'),
};
const AR = (SMD.i18nDicts && SMD.i18nDicts.ar) || {};
const LEVELS = (SMD.llLevels || []).filter((l) => l.id === 'prologue' || l.id === 'lifeboat').sort((a, b) => a.n - b.n);
const byId = (id) => LEVELS.find((l) => l.id === id);

// ---------- The doc's anchors per set ----------
const n = (p, a, b) => Array.from({ length: b - a + 1 }, (_, i) => p + (a + i));
const INTERIOR = ['start', 'seat_you', 'seat_yusuf', 'seat_lena', 'seat_grace', 'window', 'panel_left', 'panel_center', 'panel_right', 'valve', ...n('breaker_', 1, 8), ...n('locker_', 1, 10), 'tunnel_a', 'tunnel_b', 'hab_bench', 'hab_window', 'hab_lockers', 'medkit'];
const ANCHORS = {
  pad: ['start', 'van', 'kwame', 'nadia', 'tower_base', 'elevator', 'arm_start', 'whiteroom', 'crate_o2', 'crate_co2', 'crate_cam', 'hatch', 'seat_you'],
  capsule: INTERIOR,
  tunnel: INTERIOR,
  habitat: INTERIOR,
};
const CAST = ['you', 'yusuf', 'lena', 'grace', 'nadia', 'kwame', 'mariam'];
const MOODS = ['calm', 'worried', 'angry', 'sad', 'happy', 'scared', 'determined'];
const SFX = 'bang hiss vent clank thud click breaker locker door valve pickup place wrong success fail whoosh radio radioOut objective journal tick qte heartbeat beep alarm rumble creak breath flip open explosion boom craft static'.split(' ');
const MUSIC = ['calm', 'tension', 'action', 'sad', 'wonder', 'dread', 'hope', 'quiet'];
const ITEMS = ['cartridge', 'hose', 'bag', 'tape', 'cover', 'sock', 'food', 'water', 'o2tank', 'camera', 'spare_cartridges', 'medkit', 'flashlight', 'co2adapter', 'patchkit', 'watershield', 'patch13'];

// The director API (docs/LASTLIGHT.md). Anything else is a mistake.
const API = 'fadeIn fadeOut title wait after setScene gravity checkpoint fail end objective waypoint hint reach interact follow say sayAsync radio cast walk anim look choice qte brace timer meters drain onLow limit loot give take has craft collectible shot shake alarm power sfx music state t'.split(' ');
const ACTIONS = new Set(['objective', 'reach', 'interact', 'choice', 'qte', 'brace', 'loot', 'craft', 'shot', 'setScene', 'fadeOut', 'fadeIn', 'title']);
const DIALOGUE = new Set(['say', 'sayAsync', 'radio']);

const words = (s) => String(s).replace(/[—–…]/g, ' ').trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const params = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

// Every (key, English) the levels hand to the director while running.
const seen = new Map();
const note = (o, en, idField = 'id') => {
  if (o && o[idField] && en != null) seen.set(String(o[idField]).startsWith('ll.') ? o[idField] : 'll.' + o[idField], String(en));
};

// ---------- The recording mock ----------
function mockL(level, policy, log) {
  const state = { set: level.set, scene: level.set };
  const flags = Object.assign({}, policy.flags || {});
  const inventory = new Map();
  const qteCount = {};
  const pending = () => {
    const p = new Promise(() => {});
    p.cancel = () => {};
    return p;
  };
  const anchorOk = (a, where) => {
    if (a == null || a === 'player' || CAST.includes(a) || typeof a === 'object') return;
    log.anchors.push({ set: state.set, anchor: a, where, section: log.section });
  };
  const impl = {
    fadeIn: async () => {},
    fadeOut: async () => {},
    title: async (text, sub, o) => {
      assert.ok(o && o.id, 'title without a key: ' + text);
      note(o, text);
      if (sub != null) {
        assert.ok(o.subId, 'subtitle without a key: ' + sub);
        note(o, sub, 'subId');
      }
    },
    after: async () => {},
    wait: async () => {},
    setScene(set, spawn) {
      state.set = set;
      anchorOk(spawn, 'setScene');
    },
    gravity(g) {
      assert.ok(['ground', 'zeroG'].includes(g), 'gravity ' + g);
    },
    checkpoint() {},
    fail(reason) {
      log.fails.push(reason);
    },
    end(next) {
      log.end = next === undefined ? 'missing' : next;
    },
    objective(text, anchor, o) {
      assert.ok(o && o.id, 'objective without a key: ' + text);
      note(o, text);
      log.objectives.push({ text, anchor, section: log.section });
      anchorOk(anchor, 'objective');
    },
    waypoint: (a) => anchorOk(a, 'waypoint'),
    hint(text, o) {
      assert.ok(o && o.id, 'hint without a key: ' + text);
      note(o, text);
    },
    reach: async (a) => anchorOk(a, 'reach'),
    interact(a, label, o) {
      anchorOk(a, 'interact');
      assert.ok(label && typeof label === 'string', 'interact label at ' + a);
      assert.ok(o && o.id, 'interact without a text key at ' + a);
      note(o, label);
      if (policy.interact && !policy.interact(a)) return pending();
      // The player gets there a moment later and presses E (an optional talk
      // happens later still, when the player wanders over).
      return new Promise((r) =>
        setTimeout(
          () => {
            log.trace.push({ kind: 'action', section: log.section });
            r(true);
          },
          o && o.optional ? 2 : 0,
        ),
      );
    },
    follow: async (c) => assert.ok(CAST.includes(c), 'follow ' + c),
    say: async (who, line, o) => (note(o, line), log.lines.push({ who, line, o })),
    sayAsync: async (who, line, o) => (note(o, line), log.lines.push({ who, line, o })),
    radio: async (who, line, o) => (note(o, line), log.lines.push({ who, line, o, radio: true })),
    cast: (c, a) => {
      assert.ok(CAST.includes(c), 'cast ' + c);
      anchorOk(a, 'cast');
    },
    walk: (c, a) => {
      assert.ok(CAST.includes(c), 'walk ' + c);
      anchorOk(a, 'walk');
    },
    anim: (c) => assert.ok(CAST.includes(c), 'anim ' + c),
    look: (c, a) => {
      assert.ok(CAST.includes(c), 'look ' + c);
      anchorOk(a, 'look');
    },
    async choice(options, o) {
      options.forEach((x) => {
        assert.ok(x.key, 'option without a key: ' + x.text);
        seen.set(x.key, x.text);
        if (x.locked) seen.set(x.key + '.locked', x.locked);
      });
      log.choices.push({ id: o && o.id, options, o, section: log.section });
      const pick = policy.choice && policy.choice(o.id, options);
      const open = options.filter((x) => !x.requires || (typeof x.requires === 'string' && x.requires.startsWith('flag:') && flags[x.requires.slice(5)]));
      return pick && open.some((x) => x.id === pick) ? pick : open[0].id;
    },
    async qte(kind, o) {
      assert.ok(['press', 'hold', 'mash', 'turn'].includes(kind), 'qte kind ' + kind);
      note(o, o && o.label);
      const id = (o && o.id) || kind;
      qteCount[id] = (qteCount[id] || 0) + 1;
      log.qtes.push(id);
      return policy.qteFails ? qteCount[id] > 1 : true;
    },
    brace: async (sec, o) => {
      note(o, o && o.label);
      assert.strictEqual(o && o.fail, false, 'a missed brace costs health, not the section');
      return !policy.qteFails;
    },
    timer: (sec, label, o) => {
      note(o, label);
      assert.ok(o && ['o2', 'co2', 'power', 'time'].includes(o.fail), 'timer fail reason');
      const p = new Promise(() => {});
      p.stop = () => {};
      return p;
    },
    limit() {},
    take: (id) => inventory.delete(id),
    state() {},
    t: (key, en) => en,
    meters: (list) => list.forEach((m) => assert.ok(['o2', 'co2', 'power', 'health'].includes(m), 'meter ' + m)),
    drain(r) {
      log.drains.push(Object.assign({}, r));
      Object.keys(r).forEach((k) => assert.ok(['o2', 'co2', 'power', 'health'].includes(k) && Number.isFinite(r[k]), 'drain ' + k));
    },
    onLow: (key, th, fn) => {
      assert.ok(typeof fn === 'function');
      log.watchers.push(fn);
    },
    async loot(a, items, o) {
      anchorOk(a, 'loot');
      if (o && o.label) note(o, o.label);
      (items || []).forEach((i) => {
        log.items.add(i);
        inventory.set(i, (inventory.get(i) || 0) + 1);
      });
    },
    give: (id, k) => {
      log.items.add(id);
      inventory.set(id, (inventory.get(id) || 0) + (k || 1));
    },
    has: (id) => (inventory.get(id) || 0) > 0,
    async craft(recipe, o) {
      log.crafts.push({ recipe, o });
      return true;
    },
    collectible(id, anchor, o) {
      if (anchor) {
        anchorOk(anchor, 'collectible');
        assert.ok(o && o.id && o.label, 'collectible pickup without a label key: ' + id);
        note(o, o.label);
        log.placed.add(id);
      } else log.collectibles.add(id);
    },
    async shot(spec) {
      if (typeof spec === 'string') anchorOk(spec, 'shot');
      else if (spec && typeof spec === 'object') {
        anchorOk(spec.from, 'shot');
        anchorOk(spec.at, 'shot');
      }
    },
    shake() {},
    alarm() {},
    power: (v) => assert.ok(v >= 0 && v <= 1, 'power ' + v),
    sfx: (s) => log.sfx.add(s),
    music: (m) => log.music.add(m),
  };
  const L = {
    flags,
    inventory,
    choices: [],
    res: { o2: 100, co2: 2, power: 100, health: 100 },
    scene: null,
    player: { position: { x: 0, y: 0, z: 0 } },
  };
  for (const name of API) {
    L[name] = (...a) => {
      const kind = name;
      if (DIALOGUE.has(kind)) log.trace.push({ kind: 'line', section: log.section });
      else if (ACTIONS.has(kind)) log.trace.push({ kind: 'action', section: log.section });
      return impl[name](...a);
    };
  }
  return new Proxy(L, {
    get(t, p) {
      if (p in t || typeof p === 'symbol' || p === 'then') return t[p];
      log.unknown.add(String(p));
      return undefined;
    },
  });
}

function newLog() {
  return { section: null, anchors: [], objectives: [], lines: [], choices: [], qtes: [], drains: [], watchers: [], items: new Set(), crafts: [], collectibles: new Set(), placed: new Set(), sfx: new Set(), music: new Set(), fails: [], unknown: new Set(), trace: [], end: undefined, perSection: {} };
}

async function play(level, policy) {
  const log = newLog();
  const L = mockL(level, policy, log);
  for (const s of level.sections) {
    log.section = s.id;
    const before = log.objectives.length;
    await s.run(L);
    await new Promise((r) => setTimeout(r, 5)); // optional finds of this section
    log.perSection[s.id] = { objectives: log.objectives.length - before };
  }
  for (const fn of log.watchers) fn(); // fire the onLow callbacks once
  log.flags = L.flags;
  log.res = L.res;
  return log;
}

// Every combination worth trying: each cargo, each option index, QTE fails.
const CARGOS = ['o2', 'co2', 'cam'];
function policies(levelId) {
  const out = [];
  for (const cargo of CARGOS)
    for (let pick = 0; pick < 3; pick++)
      for (const qteFails of [false, true]) {
        const p = {
          name: `${cargo}/${pick}/${qteFails ? 'miss' : 'hit'}`,
          cargo,
          qteFails,
          choice: (id, options) => options[pick % options.length].id,
        };
        if (levelId === 'prologue') {
          p.interact = (a) => !/^crate_/.test(a) || a === 'crate_' + cargo;
          if (pick === 2) p.flags = {}; // the locked option stays locked unless Grace was met (she always is in the mock)
        } else {
          p.flags = { cargo, stirBy: ['you', 'grace', 'hold'][pick], held: pick === 0, launchedCold: pick !== 0, extraO2: cargo === 'o2', spareCartridges: cargo === 'co2', hiresCamera: cargo === 'cam' };
        }
        out.push(p);
      }
  return out;
}

const RUNS = {};
async function runsFor(id) {
  if (!RUNS[id]) {
    RUNS[id] = [];
    for (const p of policies(id)) RUNS[id].push({ p, log: await play(byId(id), p) });
  }
  return RUNS[id];
}

// Static (key, english) pairs straight from the source, so branches the mock
// never takes are still checked.
function staticPairs(src) {
  const out = new Map();
  for (const m of src.matchAll(/'((?:p|lb)\.[\w.]+)',\s*'((?:[^'\\]|\\.)*)'/g)) out.set('ll.' + m[1], m[2]);
  return out;
}

// ---------------------------------------------------------------------------

test('both levels exist with the doc format', () => {
  assert.strictEqual(LEVELS.length, 2);
  assert.deepStrictEqual(LEVELS.map((l) => [l.id, l.n, l.set]), [
    ['prologue', 0, 'pad'],
    ['lifeboat', 1, 'capsule'],
  ]);
  for (const l of LEVELS) {
    assert.ok(l.title && Array.isArray(l.sections) && l.sections.length >= 5, l.id);
    const ids = l.sections.map((s) => s.id);
    assert.strictEqual(new Set(ids).size, ids.length, l.id + ' section ids unique');
    l.sections.forEach((s) => assert.strictEqual(typeof s.run, 'function', s.id));
  }
});

test('every run plays to the end without unknown director calls', async () => {
  for (const l of LEVELS)
    for (const { p, log } of await runsFor(l.id)) {
      assert.deepStrictEqual([...log.unknown], [], `${l.id} ${p.name}: not in the director API`);
      assert.deepStrictEqual(log.fails, [], `${l.id} ${p.name}: failed`);
      assert.notStrictEqual(log.end, undefined, `${l.id} ${p.name}: never calls end()`);
    }
  assert.strictEqual((await runsFor('prologue'))[0].log.end, 'lifeboat');
});

test('every section has an objective or a cinematic purpose', async () => {
  for (const l of LEVELS) {
    const runs = await runsFor(l.id);
    for (const s of l.sections) {
      assert.ok(typeof s.purpose === 'string' && s.purpose.length > 10, `${l.id}.${s.id}: purpose`);
      if (s.cinematic) continue;
      for (const { p, log } of runs) assert.ok(log.perSection[s.id].objectives > 0, `${l.id}.${s.id} (${p.name}): no objective`);
    }
  }
});

test('only the doc anchors are used, in the right set', async () => {
  for (const l of LEVELS)
    for (const { log } of await runsFor(l.id))
      for (const a of log.anchors) assert.ok((ANCHORS[a.set] || []).includes(a.anchor), `${l.id}.${a.section}: anchor ${a.anchor} not in set ${a.set} (${a.where})`);
});

test('cast, moods, sounds, music and items are the real ones', async () => {
  for (const l of LEVELS)
    for (const { log } of await runsFor(l.id)) {
      for (const x of log.lines) {
        assert.ok(CAST.includes(x.who), 'cast ' + x.who);
        assert.ok(x.o && MOODS.includes(x.o.mood), 'mood ' + (x.o && x.o.mood));
        assert.ok(x.o && x.o.id, 'line without id: ' + x.line);
      }
      [...log.sfx].forEach((s) => assert.ok(SFX.includes(s), 'sfx ' + s));
      [...log.music].forEach((m) => assert.ok(MUSIC.includes(m), 'music ' + m));
      [...log.items].forEach((i) => assert.ok(ITEMS.includes(i), 'item ' + i));
    }
});

test('lines are short: ≤ 12 words (warn), never over 14', async () => {
  const pairs = new Map([...staticPairs(SRC.prologue), ...staticPairs(SRC.lifeboat)]);
  for (const l of LEVELS) await runsFor(l.id);
  for (const [k, v] of seen) pairs.set(k, v);
  const warn = [];
  for (const [key, en] of pairs) {
    const w = words(en);
    assert.ok(w <= 14, `${key}: ${w} words: ${en}`);
    if (w > 12) warn.push(`${key} (${w})`);
  }
  if (warn.length) console.log('# lines over 12 words:', warn.join(', '));
});

test('never more than 3 lines of dialogue without the player doing something', async () => {
  for (const l of LEVELS)
    for (const { p, log } of await runsFor(l.id)) {
      let run = 0;
      let last = null;
      for (const t of log.trace) {
        if (t.section !== last) {
          run = 0;
          last = t.section;
        }
        if (t.kind === 'line') run++;
        else run = 0;
        assert.ok(run <= 3, `${l.id}.${t.section} (${p.name}): ${run} lines in a row`);
      }
    }
});

test('2-3 timed choices per level, ≤ 3 short options, valid timeouts', async () => {
  for (const l of LEVELS) {
    const ids = new Set();
    for (const { log } of await runsFor(l.id))
      for (const c of log.choices) {
        assert.ok(c.id, `${l.id}: choice without id`);
        assert.ok(c.o.timer > 0, `${l.id}.${c.id}: not timed`);
        assert.ok(c.options.length >= 2 && c.options.length <= 3, `${l.id}.${c.id}: options`);
        assert.ok(c.options.some((x) => x.id === c.o.timeout), `${l.id}.${c.id}: timeout is not an option`);
        c.options.forEach((x) => assert.ok(words(x.text) <= 8, `${l.id}.${c.id}.${x.id}: option too long: ${x.text}`));
        ids.add(c.id);
      }
    assert.ok(ids.size >= 2 && ids.size <= 3, `${l.id}: ${ids.size} timed choices (${[...ids]})`);
  }
});

test('6-8 collectibles per level, with sources, all findable', async () => {
  const all = new Set();
  for (const l of LEVELS) {
    const c = l.collectibles || [];
    assert.ok(c.length >= 6 && c.length <= 8, `${l.id}: ${c.length} collectibles`);
    const found = new Set();
    for (const { log } of await runsFor(l.id)) [...log.collectibles, ...log.placed].forEach((x) => found.add(x));
    for (const x of c) {
      assert.ok(!all.has(x.id), 'duplicate collectible ' + x.id);
      all.add(x.id);
      assert.ok(x.title && x.text && x.text.length > 80, `${x.id}: title/text`);
      assert.strictEqual(x.titleKey, `ll.c.${x.id}.title`);
      assert.strictEqual(x.textKey, `ll.c.${x.id}.text`);
      assert.ok(x.source && /^https:\/\/[^\s]+\.[a-z]{2,}\//.test(x.source.url) && x.source.title, `${x.id}: source`);
      assert.ok(found.has(x.id), `${l.id}: collectible ${x.id} is never awarded`);
      assert.ok(x.at === null || (ANCHORS[l.set === 'pad' && x.section !== 'day3' ? 'pad' : 'capsule'] || []).includes(x.at), `${x.id}: anchor ${x.at}`);
    }
    for (const id of found) assert.ok(c.some((x) => x.id === id), `${l.id}: awards unknown collectible ${id}`);
  }
});

test('the prologue cargo choice is physical and pays off in the lifeboat', async () => {
  for (const { p, log } of await runsFor('prologue')) assert.strictEqual(log.flags.cargo, p.cargo, 'cargo picked by carrying ' + p.name);
  assert.match(SRC.lifeboat, /flags\.cargo === 'o2'/);
  assert.match(SRC.lifeboat, /flags\.cargo === 'co2'/);
  assert.match(SRC.lifeboat, /flags\.cargo === 'cam'/);
  const runs = await runsFor('lifeboat');
  const pick = (cargo) => runs.filter((r) => r.p.cargo === cargo && !r.p.qteFails);
  for (const { log } of pick('o2')) {
    assert.ok(log.items.has('o2tank'), 'o2: the tank is carried into Ibis');
    assert.ok(log.drains.some((d) => d.o2 === byId('lifeboat').numbers.RATES.o2Tank), 'o2: slower drain');
  }
  for (const { log } of pick('co2')) {
    assert.ok(log.items.has('spare_cartridges'), 'co2: spares carried');
    assert.ok(log.crafts.every((c) => c.o && c.o.skip && c.o.skip.length > 0), 'co2: easier adapter');
  }
  for (const { log } of pick('cam')) {
    assert.ok(log.collectibles.has('damage'), 'cam: the photo collectible');
    assert.ok(log.flags.photoSent, 'cam: the ground gets the photo');
  }
  for (const { log } of runs.filter((r) => r.p.cargo !== 'cam')) assert.ok(!log.collectibles.has('damage'));
});

test('the power-down reaches home and the trap breaker never counts', async () => {
  for (const { p, log } of await runsFor('lifeboat')) {
    assert.ok(!log.flags.breakers.includes('fans'), p.name + ': fans off');
    assert.ok(log.res.power >= 100 || log.flags.salmaCall, p.name + ': projection reaches home');
  }
});

test('the levels match the real sets (anchors, breaker names and amps)', () => {
  const pad = fs.readFileSync(path.join(ROOT, 'js/ll/sets/pad.js'), 'utf8');
  for (const a of ANCHORS.pad) if (!/^crate_/.test(a)) assert.match(pad, new RegExp(`put\\('${a}'`), 'pad anchor ' + a);
  const interior = fs.readFileSync(path.join(ROOT, 'js/ll/sets/interior.js'), 'utf8');
  for (const a of ['window', 'valve', 'tunnel_a', 'tunnel_b', 'hab_window', 'hab_bench', 'hab_lockers', 'medkit', 'start']) assert.match(interior, new RegExp(`addAnchor\\('${a}'`), 'interior anchor ' + a);
  const screens = fs.readFileSync(path.join(ROOT, 'js/ll/sets/interior-screens.js'), 'utf8');
  const panel = new Map([...screens.matchAll(/\{ n: (\d), label: '[^']+', amps: ([\d.]+) \}/g)].map((m) => ['breaker_' + m[1], Number(m[2])]));
  assert.strictEqual(panel.size, 8, 'breaker table found in the set');
  const { POWER } = byId('lifeboat').numbers;
  assert.strictEqual(POWER.breakers.length, 8);
  for (const b of POWER.breakers) assert.strictEqual(b.amps, panel.get(b.at), `${b.at}: the panel shows ${panel.get(b.at)} A`);
  // The arithmetic the two radio lines promise.
  const cuttable = POWER.breakers.filter((b) => !b.essential);
  const fan = POWER.breakers.find((b) => b.essential).amps;
  const lights = POWER.breakers.find((b) => b.id === 'lights').amps;
  const floor = POWER.coreAmps + fan;
  assert.ok(cuttable.length === 7 && POWER.capacityAh / floor >= POWER.hoursHome, 'every breaker off gets you home');
  assert.ok(POWER.capacityAh / (floor + Math.min(...cuttable.map((b) => b.amps))) < POWER.hoursHome, 'without the photo every breaker has to go');
  assert.ok((POWER.capacityAh + POWER.photoBonusAh) / (floor + lights) >= POWER.hoursHome, 'the photo lets the lights stay on');
  assert.ok(POWER.capacityAh / POWER.hoursHome < 13 && POWER.capacityAh / POWER.hoursHome > 12, 'Kwame: under thirteen');
  assert.ok((POWER.capacityAh + POWER.photoBonusAh) / POWER.hoursHome < 16, 'Kwame: under sixteen');
});

test('with the photo the Ibis lights can stay on', async () => {
  const log = await play(byId('lifeboat'), {
    flags: { cargo: 'cam', stirBy: 'you', held: true },
    choice: (id, options) => options[0].id,
    interact: (a) => a !== 'breaker_5',
  });
  assert.ok(log.flags.lightsOn, 'lights stayed on');
  assert.ok(!log.flags.breakers.includes('lights'));
  assert.ok(log.lines.some((x) => x.o.id === 'lb.cold.y0'), 'Yusuf remarks on it');
});

test('every text key has Arabic with the same placeholders', async () => {
  for (const l of LEVELS) await runsFor(l.id);
  const keys = new Map([...staticPairs(SRC.prologue), ...staticPairs(SRC.lifeboat), ...seen]);
  for (const l of LEVELS)
    for (const c of l.collectibles) {
      keys.set(`ll.c.${c.id}.title`, c.title);
      keys.set(`ll.c.${c.id}.text`, c.text);
    }
  ITEMS.forEach((i) => keys.set('ll.item.' + i, i));
  CAST.forEach((c) => keys.set('ll.cast.' + c, c));
  LEVELS.forEach((l) => keys.set(`ll.level.${l.id}.title`, l.title));
  const missing = [...keys.keys()].filter((k) => !AR[k]);
  assert.deepStrictEqual(missing, [], 'missing Arabic');
  for (const [k, en] of keys) if (!/^ll\.(cast|item|level)\./.test(k)) assert.strictEqual(params(AR[k]), params(en), `${k}: placeholders differ`);
  const stray = Object.keys(AR).filter((k) => k.startsWith('ll.') && !keys.has(k) && !/^ll\.(ui|item|cast|level|fail|recipe|journal)\./.test(k));
  assert.deepStrictEqual(stray, [], 'Arabic keys nothing uses');
});

test('UI keys of the director, HUD and screens have Arabic (warning only)', () => {
  const files = [...fs.readdirSync(path.join(ROOT, 'js/ll')).filter((f) => f.endsWith('.js')).map((f) => 'js/ll/' + f), 'js/screen-ll.js'];
  const missing = new Set();
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/'(ll\.(?:ui|fail)\.[\w.]+)'/g)) if (!AR[m[1]]) missing.add(m[1]);
  }
  if (missing.size) console.log('# UI keys without Arabic:', [...missing].join(', '));
});
