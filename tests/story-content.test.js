// Story mode scripts (content/story/ep1-4.js) against docs/STORY.md:
// ids, beat types, targets, survival ids, timers, explore anchors, clue locks,
// expressions, reachability, dead ends, flowchart titles and Arabic coverage.
const test = require('node:test');
const assert = require('node:assert');

globalThis.SMD = globalThis.SMD || {};
for (const f of ['ep1', 'ep2', 'ep3', 'ep4']) require(`../content/story/${f}.js`);
require('../js/i18n/ar-story.js');

const SMD = globalThis.SMD;
const EPISODES = SMD.story.episodes.filter((e) => /^ep[1-4]$/.test(e.id)).sort((a, b) => a.n - b.n);
const AR = (SMD.i18nDicts && SMD.i18nDicts.ar) || {};

const CAST = ['you', 'yusuf', 'lena', 'grace', 'nadia', 'kwame', 'mariam', 'tarek', 'omar', 'aiko'];
const TRUST = CAST.filter((c) => c !== 'you');
const RES = ['o2', 'power', 'water', 'co2', 'food'];
const HEALTH = ['you', 'yusuf', 'lena', 'grace'];
const SETS = ['pad', 'control', 'briefing', 'capsule', 'space', 'black'];
const MOODS = ['calm', 'worried', 'angry', 'sad', 'happy', 'scared', 'determined'];
const SFX = ['alarm', 'bang', 'radio', 'silence'];
const ANIMS = ['wave', 'celebrate', 'sad', 'cheer', 'look'];
const SURVIVAL = ['ep2.power', 'ep2.co2', 'ep3.storm', 'ep4.burn', 'ep4.entry'];
// Flags the survival segments set (docs/STORY.md, Survival API).
const SURVIVAL_FLAGS = ['heatersOff', 'adapterBuilt', 'shelterGood', 'corridorOk', 'landed'];
const LOCKERS = ['locker_1', 'locker_2', 'locker_3', 'locker_4', 'locker_5', 'locker_6'];
const ANCHORS = {
  pad: ['start', 'tower', 'arm', 'valve', 'umbilical', 'console', 'kwame', 'nadia', 'door', 'van'],
  control: ['start', 'console', 'bigscreen', 'kwame', 'nadia', 'tarek', 'mariam', 'omar', 'aiko', 'coffee', 'window', 'door'],
  briefing: ['start', 'table', 'screen', 'model', 'kwame', 'nadia', 'tarek', 'aiko', 'door'],
  capsule: ['start', 'seat_you', 'seat_yusuf', 'seat_lena', 'seat_grace', 'window', 'panel_left', 'panel_center', 'panel_right', ...LOCKERS, 'hatch', 'medkit', 'toilet', 'camera'],
  space: ['start'],
  black: ['start'],
};
// One primary key per beat.
const BEAT_KEYS = ['narrate', 'say', 'choice', 'if', 'set', 'trust', 'res', 'health', 'survival', 'fact', 'camera', 'anim', 'sfx', 'wait', 'goto', 'end', 'explore'];
const ITEM_BEAT_KEYS = ['narrate', 'say', 'if', 'set', 'trust', 'res', 'health', 'fact', 'camera', 'anim', 'sfx', 'wait'];

const kind = (b) => BEAT_KEYS.filter((k) => k in b);

// Walk every beat (nested branches, option beats, explore item beats).
// visit(beat, ctx) where ctx = { ep, sceneId, scene, inItem }.
function walk(beats, ctx, visit) {
  for (const b of beats || []) {
    visit(b, ctx);
    if (b.if !== undefined) {
      walk(b.then, ctx, visit);
      walk(b.else, ctx, visit);
    }
    if (b.choice) for (const o of b.choice.options || []) walk(o.beats, ctx, visit);
    if (b.explore) for (const it of b.explore.items || []) walk(it.beats, { ...ctx, inItem: true }, visit);
  }
}
function eachBeat(visit) {
  for (const ep of EPISODES) for (const [sceneId, scene] of Object.entries(ep.scenes)) walk(scene.beats, { ep, sceneId, scene }, visit);
}

// Every translation key the player can see, with its English text.
function textKeys() {
  const out = new Map();
  const add = (k, en) => {
    assert.ok(typeof en === 'string' && en.trim(), `empty text for ${k}`);
    assert.ok(!out.has(k), `duplicate text key ${k}`);
    out.set(k, en);
  };
  for (const ep of EPISODES) {
    add(`story.${ep.id}.title`, ep.title);
    add(`story.${ep.id}.subtitle`, ep.subtitle);
    for (const e of Object.values(ep.endings || {})) {
      add(`story.${e.id}.title`, e.title);
      add(`story.${e.id}.text`, e.text);
    }
    for (const [sid, sc] of Object.entries(ep.scenes)) add(`story.${ep.id}.${sid}.title`, sc.title);
  }
  eachBeat((b) => {
    if (b.narrate !== undefined) add(`story.${b.id}`, b.narrate);
    if (b.say !== undefined) add(`story.${b.id}`, b.line);
    if (b.fact) {
      add(`story.${b.fact.id}.title`, b.fact.title);
      add(`story.${b.fact.id}.text`, b.fact.text);
    }
    if (b.choice)
      for (const o of b.choice.options) {
        add(`story.${b.choice.id}.${o.id}`, o.text);
        if (o.lockedHint) add(`story.${b.choice.id}.${o.id}.locked`, o.lockedHint);
      }
    if (b.explore) {
      add(`story.${b.explore.id}.objective`, b.explore.objective);
      if (b.explore.hint) add(`story.${b.explore.id}.hint`, b.explore.hint);
      for (const it of b.explore.items) add(`story.${b.explore.id}.${it.id}.label`, it.label);
    }
  });
  return out;
}
module.exports = { textKeys };

// Flags that some script or segment can set.
function settableFlags() {
  const out = new Set(SURVIVAL_FLAGS);
  const addAll = (m) => m && Object.keys(m).forEach((k) => out.add(k));
  eachBeat((b) => {
    addAll(b.set);
    if (b.choice) b.choice.options.forEach((o) => addAll(o.set));
    if (b.explore) b.explore.items.forEach((it) => addAll(it.set));
  });
  return out;
}

// All choices by id, across episodes (choice['id'] can look back).
function allChoices() {
  const out = new Map();
  eachBeat((b) => b.choice && out.set(b.choice.id, b.choice));
  return out;
}

const TERM = [
  /^!?flags\.(\w+)$/,
  /^(trust|res|health)\.(\w+)\s*(>=|<=|>|<|==|!=)\s*-?\d+$/,
  /^choice\['([\w.]+)'\]\s*==\s*'(\w+)'$/,
  /^(true|false)$/,
];
function checkExpr(expr, where, flags, choices) {
  assert.equal(typeof expr, 'string', `${where}: expression must be a string`);
  assert.ok(!/[()]/.test(expr), `${where}: no parentheses in "${expr}"`);
  for (const raw of expr.split(/&&|\|\|/)) {
    const t = raw.trim();
    const m = TERM.map((re) => t.match(re)).find(Boolean);
    assert.ok(m, `${where}: unknown term "${t}" in "${expr}"`);
    if (/^!?flags\./.test(t)) assert.ok(flags.has(m[1]), `${where}: flag ${m[1]} is never set`);
    if (/^(trust|res|health)\./.test(t)) assert.ok({ trust: TRUST, res: RES, health: HEALTH }[m[1]].includes(m[2]), `${where}: unknown ${m[1]} key ${m[2]}`);
    if (/^choice/.test(t)) {
      const c = choices.get(m[1]);
      assert.ok(c, `${where}: unknown choice ${m[1]}`);
      assert.ok(c.options.some((o) => o.id === m[2]), `${where}: choice ${m[1]} has no option ${m[2]}`);
    }
  }
}

// Scenes a list of beats can jump to; and whether it always leaves the scene.
function targets(beats, out = []) {
  for (const b of beats || []) {
    if (b.goto) out.push(b.goto);
    if (b.survival) out.push(b.win, b.lose);
    if (b.if !== undefined) {
      targets(b.then, out);
      targets(b.else, out);
    }
    if (b.choice) b.choice.options.forEach((o) => (o.goto && out.push(o.goto), targets(o.beats, out)));
  }
  return out;
}
const ENDS = (beats) => {
  for (const b of beats || []) if (b.end) return true;
  for (const b of beats || []) {
    if (b.if !== undefined && (ENDS(b.then) || ENDS(b.else))) return true;
  }
  return false;
};
function terminates(beats) {
  for (const b of beats || []) {
    if (b.goto || b.end || b.survival) return true;
    if (b.if !== undefined && terminates(b.then) && terminates(b.else)) return true;
    if (b.choice && b.choice.options.every((o) => o.goto || terminates(o.beats))) return true;
  }
  return false;
}

test('four episodes in order, chained with next', () => {
  assert.deepEqual(
    EPISODES.map((e) => e.id),
    ['ep1', 'ep2', 'ep3', 'ep4'],
  );
  assert.ok(EPISODES[0].resources, 'ep1 sets the starting resources');
  for (const k of RES) assert.equal(typeof EPISODES[0].resources[k], 'number');
  for (const ep of EPISODES.slice(1)) assert.ok(!ep.resources, `${ep.id} inherits resources`);
  const nexts = [];
  eachBeat((b, c) => b.end && b.next && nexts.push([c.ep.id, b.next]));
  for (const [from, to] of [['ep1', 'ep2'], ['ep2', 'ep3'], ['ep3', 'ep4']]) assert.ok(nexts.some(([a, b]) => a === from && b === to), `${from} chains to ${to}`);
  for (const ep of EPISODES) assert.ok(ep.scenes[ep.start], `${ep.id} start scene exists`);
});

test('every id is unique and every beat has one known type', () => {
  const ids = new Map();
  const note = (id, where) => {
    assert.ok(typeof id === 'string' && /^ep[1-4]\.[\w.]+$/.test(id), `bad id ${id} at ${where}`);
    assert.ok(!ids.has(id), `id ${id} used twice (${ids.get(id)} and ${where})`);
    ids.set(id, where);
  };
  eachBeat((b, c) => {
    const where = `${c.ep.id}/${c.sceneId}`;
    const k = kind(b);
    assert.equal(k.length, 1, `${where}: beat must have exactly one type, has [${k}] ${JSON.stringify(b).slice(0, 80)}`);
    if (c.inItem) assert.ok(ITEM_BEAT_KEYS.includes(k[0]), `${where}: "${k[0]}" not allowed inside an explore item`);
    if (b.narrate !== undefined || b.say !== undefined) note(b.id, where);
    if (b.fact) note(b.fact.id, where);
    if (b.choice) note(b.choice.id, where);
    if (b.explore) note(b.explore.id, where);
    if (b.id && b.narrate === undefined && b.say === undefined) assert.fail(`${where}: stray id on a ${k[0]} beat`);
  });
});

test('cast, moods, camera, anim, sfx, trust, res and survival ids follow the spec', () => {
  for (const ep of EPISODES)
    for (const [sid, sc] of Object.entries(ep.scenes)) {
      assert.ok(SETS.includes(sc.set), `${ep.id}/${sid}: unknown set ${sc.set}`);
      for (const c of sc.cast) assert.ok(CAST.includes(c), `${ep.id}/${sid}: unknown cast ${c}`);
      for (const [who, at] of Object.entries(sc.place || {})) {
        assert.ok(sc.cast.includes(who), `${ep.id}/${sid}: place for ${who} who is not in the cast`);
        assert.ok(ANCHORS[sc.set].includes(at), `${ep.id}/${sid}: place anchor ${at}`);
      }
    }
  const trustMap = (m, where) => m && Object.entries(m).forEach(([k, v]) => (assert.ok(TRUST.includes(k), `${where}: trust ${k}`), assert.ok(Number.isInteger(v) && Math.abs(v) <= 3)));
  const resMap = (m, where) => m && Object.entries(m).forEach(([k, v]) => (assert.ok(RES.includes(k), `${where}: res ${k}`), assert.equal(typeof v, 'number')));
  eachBeat((b, c) => {
    const where = `${c.ep.id}/${c.sceneId}`;
    const cast = c.scene.cast;
    if (b.say !== undefined) {
      assert.ok(CAST.includes(b.say) && b.say !== 'you', `${where}: speaker ${b.say}`);
      if (b.mood) assert.ok(MOODS.includes(b.mood), `${where}: mood ${b.mood}`);
    }
    if (b.camera) {
      const m = String(b.camera).match(/^(wide|window|close:(\w+)|two:(\w+),(\w+))$/);
      assert.ok(m, `${where}: camera ${b.camera}`);
      for (const who of [m[2], m[3], m[4]].filter(Boolean)) assert.ok(cast.includes(who), `${where}: camera on ${who}, not in the scene`);
    }
    if (b.anim) {
      const [who, verb] = String(b.anim).split(':');
      assert.ok(cast.includes(who), `${where}: anim on ${who}, not in the scene`);
      assert.ok(ANIMS.includes(verb), `${where}: anim ${verb}`);
    }
    if (b.sfx) assert.ok(SFX.includes(b.sfx), `${where}: sfx ${b.sfx}`);
    if (b.wait !== undefined) assert.ok(b.wait > 0 && b.wait <= 5, `${where}: wait ${b.wait}`);
    if (b.survival) assert.ok(SURVIVAL.includes(b.survival), `${where}: survival ${b.survival}`);
    if (b.survival) assert.ok(b.survival.startsWith(c.ep.id + '.'), `${where}: ${b.survival} belongs to its own episode`);
    trustMap(b.trust, where);
    resMap(b.res, where);
    if (b.health) Object.entries(b.health).forEach(([k, v]) => (assert.ok(HEALTH.includes(k), `${where}: health ${k}`), assert.equal(typeof v, 'number')));
    if (b.fact) {
      assert.ok(/^https:\/\//.test(b.fact.source), `${where}: fact ${b.fact.id} needs an https source`);
      assert.ok(b.fact.title && b.fact.text, `${where}: fact ${b.fact.id} title/text`);
    }
    if (b.choice)
      for (const o of b.choice.options) {
        trustMap(o.trust, `${where}/${o.id}`);
        resMap(o.res, `${where}/${o.id}`);
        if (o.remember) assert.ok(TRUST.includes(o.remember), `${where}: remember ${o.remember}`);
        if (o.remember) assert.ok(o.trust && o.trust[o.remember], `${where}: "${o.remember} will remember" needs a trust change`);
      }
  });
  // The five survival segments each appear exactly once, in their episode.
  const seen = [];
  eachBeat((b) => b.survival && seen.push(b.survival));
  assert.deepEqual(seen.slice().sort(), SURVIVAL.slice().sort());
});

test('choices: timeouts match an open option, locks have hints, 4-6 key choices per episode', () => {
  const flags = settableFlags();
  const choices = allChoices();
  const keyCount = {};
  eachBeat((b, c) => {
    if (!b.choice) return;
    const ch = b.choice;
    const where = `${c.ep.id}/${c.sceneId}/${ch.id}`;
    assert.ok(ch.options.length >= 2, `${where}: at least two options`);
    const optIds = ch.options.map((o) => o.id);
    assert.equal(new Set(optIds).size, optIds.length, `${where}: option ids unique`);
    if (ch.timer !== undefined) {
      assert.ok(ch.timer >= 5 && ch.timer <= 20, `${where}: timer ${ch.timer}`);
      const t = ch.options.find((o) => o.id === ch.timeout);
      assert.ok(t, `${where}: timeout "${ch.timeout}" is not an option`);
      assert.ok(!t.requires, `${where}: the timeout option must never be locked`);
      assert.ok(ch.key, `${where}: a timed choice is a key choice`);
    }
    assert.ok(ch.options.some((o) => !o.requires), `${where}: at least one option is always open`);
    for (const o of ch.options) {
      if (o.requires) {
        assert.ok(o.lockedHint, `${where}/${o.id}: locked option needs a lockedHint`);
        checkExpr(o.requires, `${where}/${o.id}`, flags, choices);
      } else assert.ok(!o.lockedHint, `${where}/${o.id}: lockedHint without requires`);
      if (o.goto) assert.ok(c.ep.scenes[o.goto], `${where}/${o.id}: goto ${o.goto} missing`);
    }
    if (ch.key) (keyCount[c.ep.id] = keyCount[c.ep.id] || new Set()).add(ch.id);
  });
  for (const ep of EPISODES) {
    const k = (keyCount[ep.id] || new Set()).size;
    assert.ok(k >= 4 && k <= 6, `${ep.id}: ${k} key choices (want 4-6)`);
  }
});

test('explore beats: anchors from the set list, clue locks, an exit item', () => {
  const flags = settableFlags();
  const choices = allChoices();
  let clues = 0;
  eachBeat((b, c) => {
    if (!b.explore) return;
    const ex = b.explore;
    const where = `${c.ep.id}/${c.sceneId}/${ex.id}`;
    const anchors = ANCHORS[c.scene.set];
    assert.ok(!['space', 'black'].includes(c.scene.set), `${where}: no exploration on ${c.scene.set}`);
    assert.ok(ex.objective, `${where}: objective`);
    assert.ok(anchors.includes(ex.spawn || 'start'), `${where}: spawn ${ex.spawn}`);
    checkExpr(ex.exitWhen || 'true', `${where}: exitWhen`, flags, choices);
    const ids = ex.items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `${where}: item ids unique`);
    const exits = ex.items.filter((i) => i.exit);
    assert.equal(exits.length, 1, `${where}: exactly one exit item`);
    assert.ok(!exits[0].requires, `${where}: the exit item is gated by exitWhen, not requires`);
    for (const it of ex.items) {
      assert.ok(anchors.includes(it.at), `${where}/${it.id}: anchor "${it.at}" not in the ${c.scene.set} set`);
      assert.ok(it.label, `${where}/${it.id}: label`);
      if (it.requires) checkExpr(it.requires, `${where}/${it.id}`, flags, choices);
      if (it.clue) {
        clues++;
        assert.ok(it.set && Object.keys(it.set).length, `${where}/${it.id}: a clue sets a flag`);
      }
      if (!it.exit) assert.ok((it.beats && it.beats.length) || it.set, `${where}/${it.id}: does something`);
    }
    // exitWhen must be reachable: every flag it needs is set by an item here (or earlier).
    for (const m of String(ex.exitWhen || '').matchAll(/(?<!!)flags\.(\w+)/g)) assert.ok(flags.has(m[1]), `${where}: exitWhen flag ${m[1]}`);
  });
  assert.ok(clues >= 12, `clues across the season: ${clues}`);
});

test('every clue-locked option can actually be unlocked by an earlier clue', () => {
  // Each requires flag of a locked option must be set by some explore item or
  // earlier choice; the lock is meaningful only if exploring can open it.
  const fromItems = new Set();
  eachBeat((b) => {
    if (b.explore) for (const it of b.explore.items) Object.keys(it.set || {}).forEach((k) => fromItems.add(k));
    if (b.explore) for (const it of b.explore.items) walk(it.beats, {}, (x) => x.set && Object.keys(x.set).forEach((k) => fromItems.add(k)));
  });
  const flags = settableFlags();
  eachBeat((b, c) => {
    if (!b.choice) return;
    for (const o of b.choice.options.filter((x) => x.requires)) {
      const needed = [...o.requires.matchAll(/(?<!!)flags\.(\w+)/g)].map((m) => m[1]);
      if (!needed.length) continue; // trust-gated
      assert.ok(needed.some((f) => fromItems.has(f) || flags.has(f)), `${c.ep.id}/${b.choice.id}/${o.id}: nothing unlocks ${o.requires}`);
    }
  });
});

test('expressions use only the spec grammar and known flags/choices', () => {
  const flags = settableFlags();
  const choices = allChoices();
  eachBeat((b, c) => {
    if (b.if !== undefined) {
      checkExpr(b.if, `${c.ep.id}/${c.sceneId}`, flags, choices);
      assert.ok(Array.isArray(b.then) && Array.isArray(b.else), `${c.ep.id}/${c.sceneId}: if needs then and else arrays`);
    }
  });
});

test('targets exist, every scene is reachable, no dead ends, every scene reaches an end', () => {
  for (const ep of EPISODES) {
    const edges = {};
    for (const [sid, sc] of Object.entries(ep.scenes)) {
      assert.ok(sc.title, `${ep.id}/${sid}: needs a flowchart title`);
      assert.ok(terminates(sc.beats) || ENDS(sc.beats), `${ep.id}/${sid}: dead end (the scene can run out of beats)`);
      // A scene that can end must end on every path.
      assert.ok(terminates(sc.beats), `${ep.id}/${sid}: some path neither jumps nor ends`);
      edges[sid] = targets(sc.beats);
      for (const t of edges[sid]) assert.ok(ep.scenes[t], `${ep.id}/${sid}: target ${t} does not exist`);
    }
    // Forward reachability from start.
    const seen = new Set([ep.start]);
    const stack = [ep.start];
    while (stack.length) for (const t of edges[stack.pop()]) if (!seen.has(t)) (seen.add(t), stack.push(t));
    for (const sid of Object.keys(ep.scenes)) assert.ok(seen.has(sid), `${ep.id}/${sid}: unreachable`);
    // Every scene can reach a scene with an end beat.
    const enders = new Set(Object.keys(ep.scenes).filter((sid) => ENDS(ep.scenes[sid].beats)));
    assert.ok(enders.size, `${ep.id}: has an end`);
    let grew = true;
    while (grew) {
      grew = false;
      for (const sid of Object.keys(ep.scenes)) if (!enders.has(sid) && edges[sid].some((t) => enders.has(t))) (enders.add(sid), (grew = true));
    }
    for (const sid of Object.keys(ep.scenes)) assert.ok(enders.has(sid), `${ep.id}/${sid}: can never reach an end`);
    // End ids pick epilogue text from the episode's endings table.
    eachBeat((b, c) => {
      if (c.ep !== ep || !b.end) return;
      assert.ok(ep.endings && ep.endings[b.end], `${ep.id}: end "${b.end}" has no entry in endings`);
    });
  }
  // The finale has the four endings.
  assert.deepEqual(Object.keys(EPISODES[3].endings).sort(), ['home_all', 'home_apart', 'home_hurt', 'lost']);
});

test('every story text has Arabic with the same placeholders', () => {
  const keys = textKeys();
  const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  const missing = [...keys.keys()].filter((k) => !AR[k] || !String(AR[k]).trim());
  assert.deepEqual(missing.slice(0, 20), [], `${missing.length} story keys without Arabic`);
  for (const [k, en] of keys) assert.equal(holes(AR[k]), holes(en), `${k}: placeholders differ`);
  for (const [k, en] of keys) for (const word of ['{you}']) if (en.includes(word)) assert.ok(AR[k].includes(word), `${k}: keep ${word}`);
  const stray = Object.keys(AR).filter((k) => k.startsWith('story.ep') && !keys.has(k));
  assert.deepEqual(stray, [], 'Arabic keys that no script uses');
});

test('a scripted playthrough reaches every ending of the finale', () => {
  // Tiny interpreter: enough of the spec to walk the ending logic of ep4.
  const ep4 = EPISODES[3];
  const evalExpr = (expr, st) =>
    expr.split('||').some((or) =>
      or.split('&&').every((t) => {
        t = t.trim();
        let m;
        if (t === 'true') return true;
        if (t === 'false') return false;
        if ((m = t.match(/^(!?)flags\.(\w+)$/))) return m[1] ? !st.flags[m[2]] : !!st.flags[m[2]];
        if ((m = t.match(/^(trust|res|health)\.(\w+)\s*(>=|<=|>|<|==|!=)\s*(-?\d+)$/))) {
          const v = (st[m[1]][m[2]] || 0) * 1;
          const r = Number(m[4]);
          return { '>=': v >= r, '<=': v <= r, '>': v > r, '<': v < r, '==': v === r, '!=': v !== r }[m[3]];
        }
        if ((m = t.match(/^choice\['([\w.]+)'\]\s*==\s*'(\w+)'$/))) return st.choices[m[1]] === m[2];
        throw new Error(t);
      }),
    );
  function run(scene, st, pick, surv) {
    for (let guard = 0; guard < 200; guard++) {
      const out = runBeats(ep4.scenes[scene].beats, st, pick, surv);
      if (out.end) return out.end;
      scene = out.goto;
    }
    throw new Error('loop');
  }
  function runBeats(beats, st, pick, surv) {
    for (const b of beats) {
      if (b.set) Object.assign(st.flags, b.set);
      if (b.trust) for (const [k, v] of Object.entries(b.trust)) st.trust[k] = (st.trust[k] || 0) + v;
      if (b.res) for (const [k, v] of Object.entries(b.res)) st.res[k] += v;
      if (b.health) for (const [k, v] of Object.entries(b.health)) st.health[k] += v;
      if (b.if !== undefined) {
        const r = runBeats(evalExpr(b.if, st) ? b.then : b.else, st, pick, surv);
        if (r) return r;
      }
      if (b.explore) for (const it of b.explore.items) if (!it.exit && (!it.requires || evalExpr(it.requires, st))) (Object.assign(st.flags, it.set || {}), runBeats(it.beats || [], st, pick, surv));
      if (b.choice) {
        const open = b.choice.options.filter((o) => !o.requires || evalExpr(o.requires, st));
        const o = open.find((x) => x.id === pick[b.choice.id]) || open.find((x) => x.id === b.choice.timeout) || open[0];
        st.choices[b.choice.id] = o.id;
        Object.assign(st.flags, o.set || {});
        const r = runBeats(o.beats || [], st, pick, surv);
        if (r) return r;
        if (o.goto) return { goto: o.goto };
      }
      if (b.survival) return { goto: surv[b.survival] === 'lose' ? b.lose : b.win };
      if (b.goto) return { goto: b.goto };
      if (b.end) return { end: b.end };
    }
    return null;
  }
  const fresh = (flags = {}, trust = {}, health = {}) => ({ flags: { ...flags }, trust: { grace: 0, yusuf: 0, lena: 0, nadia: 0, tarek: 0, ...trust }, res: { o2: 50, power: 50, water: 50, co2: 10, food: 50 }, health: { you: 100, yusuf: 100, lena: 100, grace: 100, ...health }, choices: {} });
  assert.equal(run(ep4.start, fresh({ shieldMapped: true, crewKnowsShield: true }, { grace: 1 }), {}, {}), 'home_all');
  assert.equal(run(ep4.start, fresh({ crewHurt: true, hurtRadiation: true, crewKnowsShield: true }), {}, {}), 'home_hurt');
  assert.equal(run(ep4.start, fresh({ crewKnowsShield: true }, { grace: -3 }), {}, {}), 'home_apart');
  // Health lost in the survival segments decides "hurt" too.
  assert.equal(run(ep4.start, fresh({ crewKnowsShield: true }, {}, { lena: 30 }), {}, {}), 'home_hurt');
  assert.equal(run(ep4.start, fresh({ crewKnowsShield: true }), {}, { 'ep4.entry': 'lose' }), 'lost');
  // The mapped shield (Mariam's camera) saves a failed entry.
  assert.equal(run(ep4.start, fresh({ shieldMapped: true, crewKnowsShield: true, medsKept: true }), { 'ep4.entry.c1': 'roll' }, { 'ep4.entry': 'lose' }), 'home_all');
});
