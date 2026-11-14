// Last Light level framework: the pure rules in js/ll/logic.js that
// js/ll/director.js runs on (checkpoints, survival meters, inventory,
// crafting, timed choices, quick-time events, the save profile).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let M = null;
async function mod() {
  if (M) return M;
  const src = fs.readFileSync(path.join(__dirname, '../js/ll/logic.js'), 'utf8');
  M = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
  return M;
}

test('meters drain toward the bad side and stay in range', async () => {
  const { newRes, stepMeters } = await mod();
  const res = newRes();
  assert.strictEqual(res.o2, 100);
  assert.strictEqual(res.co2, 2);
  stepMeters(res, { o2: 2, co2: 0.5 }, 10);
  assert.strictEqual(res.o2, 80, 'o2 falls');
  assert.strictEqual(res.co2, 7, 'co2 rises');
  stepMeters(res, { co2: -1 }, 100);
  assert.strictEqual(res.co2, 0, 'a negative drain recovers, clamped at the floor');
  stepMeters(res, { o2: 50 }, 10);
  assert.strictEqual(res.o2, 0, 'clamped at empty');
});

test('onLow watchers fire once per crossing and re-arm after recovery', async () => {
  const { newRes, checkWatchers } = await mod();
  const res = newRes();
  const w = [{ key: 'o2', threshold: 40 }, { key: 'co2', threshold: 15 }];
  assert.strictEqual(checkWatchers(res, w).length, 0);
  res.o2 = 39;
  assert.deepStrictEqual(checkWatchers(res, w).map((x) => x.key), ['o2']);
  res.o2 = 30;
  assert.strictEqual(checkWatchers(res, w).length, 0, 'no repeat while still low');
  res.o2 = 60;
  checkWatchers(res, w);
  res.o2 = 20;
  assert.deepStrictEqual(checkWatchers(res, w).map((x) => x.key), ['o2'], 're-armed');
  res.co2 = 16;
  assert.deepStrictEqual(checkWatchers(res, w).map((x) => x.key), ['co2'], 'co2 is bad when high');
});

test('failure lines and CO2 effects', async () => {
  const { failed, severity, co2Effects } = await mod();
  assert.ok(failed('o2', 0));
  assert.ok(!failed('o2', 1));
  assert.ok(failed('co2', 30));
  assert.ok(!failed('power', 0), 'power never fails by itself');
  assert.ok(failed('co2', 20, { co2: { fail: 20 } }), 'levels can move the line');
  assert.strictEqual(severity('co2', 10), 0);
  assert.ok(severity('co2', 22) > 0.4 && severity('co2', 22) < 0.6);
  const e = co2Effects(30);
  assert.ok(e.blur > 3 && e.speed < 0.6, 'headache blur and slower movement');
  assert.strictEqual(co2Effects(5).speed, 1);
});

test('inventory adds, takes and round-trips', async () => {
  const { invAdd, invHas, invTake, invToObj, invFromObj, normItems } = await mod();
  const inv = new Map();
  invAdd(inv, 'tape', 2);
  invAdd(inv, 'sock');
  assert.ok(invHas(inv, 'tape', 2));
  assert.ok(!invHas(inv, 'tape', 3));
  assert.ok(invTake(inv, 'tape'));
  assert.ok(!invTake(inv, 'hose'));
  invAdd(inv, 'sock', -5);
  assert.ok(!inv.has('sock'), 'never negative, empty entries go away');
  assert.deepStrictEqual(invToObj(invFromObj(invToObj(inv))), { tape: 1 });
  assert.deepStrictEqual(normItems(['tape', ['bag', 2], { id: 'sock', n: 3 }]), [['tape', 1], ['bag', 2], ['sock', 3]]);
  assert.deepStrictEqual(normItems({ hose: 1 }), [['hose', 1]]);
});

test('the CO2 adapter is built from its parts in order', async () => {
  const { RECIPES, recipeSteps, craftTry, craftMissing, invFromObj } = await mod();
  const steps = recipeSteps(RECIPES.co2adapter);
  assert.deepStrictEqual(steps, ['cartridge', 'hose', 'bag', 'tape', 'cover', 'sock']);
  const inv = invFromObj({ cartridge: 1, hose: 1, bag: 1, tape: 1, cover: 1 });
  assert.deepStrictEqual(craftMissing(steps, 0, inv), ['sock']);
  let r = craftTry(steps, 0, 'hose', inv);
  assert.strictEqual(r.reason, 'wrong', 'the hose cannot go first');
  assert.strictEqual(inv.get('hose'), 1, 'a wrong part is not used up');
  let p = 0;
  for (const id of ['cartridge', 'hose', 'bag', 'tape', 'cover']) {
    r = craftTry(steps, p, id, inv);
    assert.ok(r.ok, id);
    p = r.progress;
  }
  r = craftTry(steps, p, 'sock', inv);
  assert.strictEqual(r.reason, 'missing');
  inv.set('sock', 1);
  r = craftTry(steps, p, 'sock', inv);
  assert.ok(r.ok && r.complete);
  assert.strictEqual(inv.size, 0, 'every part was used');
  assert.deepStrictEqual(recipeSteps(RECIPES.co2adapter, { skip: ['cover', 'sock'] }), ['cartridge', 'hose', 'bag', 'tape'], 'levels can make it easier');
});

test('a timed choice falls to its timeout option', async () => {
  const { choiceState } = await mod();
  const c = choiceState([{ id: 'hold' }, { id: 'go' }], { timer: 8, timeout: 'go' });
  assert.strictEqual(c.tick(5), null);
  assert.ok(Math.abs(c.fraction - 3 / 8) < 1e-9);
  assert.strictEqual(c.tick(3.1), 'go');
  assert.ok(c.timedOut);
  assert.ok(!c.pick('hold'), 'too late');
  const d = choiceState([{ id: 'a' }, { id: 'b' }], { timer: 4 });
  assert.ok(d.pick('b'));
  assert.strictEqual(d.tick(10), 'b', 'a pick before the end stands');
  const e = choiceState([{ id: 'x' }], {});
  assert.strictEqual(e.tick(999), null, 'no timer, no timeout');
  assert.strictEqual(choiceState([1, 2, 3, 4].map((i) => ({ id: 'o' + i }))).options.length, 3, 'max three options');
});

test('locked options need their item or flag', async () => {
  const { choiceState, optionOpen, invFromObj } = await mod();
  const ctx = { flags: { sawData: true }, inventory: invFromObj({ camera: 1 }) };
  assert.ok(optionOpen({ requires: 'flag:sawData' }, ctx));
  assert.ok(!optionOpen({ requires: 'flag:other' }, ctx));
  assert.ok(optionOpen({ requires: 'camera' }, ctx));
  assert.ok(!optionOpen({ requires: ['camera', 'tape'] }, ctx));
  assert.ok(optionOpen({ requires: (L) => L.flags.sawData }, ctx));
  const c = choiceState([{ id: 'data', requires: 'flag:nope' }, { id: 'go' }], { timer: 2, ctx });
  assert.ok(!c.pick('data'), 'a locked option cannot be picked');
  assert.strictEqual(c.tick(3), 'go', 'the timeout skips locked options');
});

test('quick-time events: press, hold, mash, turn, brace', async () => {
  const { qteState, braceState } = await mod();
  let q = qteState('press', { time: 2 });
  q.tick(0.5, {});
  q.tick(0.1, { pressed: 1 });
  assert.ok(q.done && q.ok);
  q = qteState('press', { time: 1 });
  q.tick(1.2, {});
  assert.ok(q.done && !q.ok, 'missed window');
  q = qteState('hold', { hold: 1, time: 5 });
  for (let i = 0; i < 6; i++) q.tick(0.1, { down: true });
  q.tick(0.5, { down: false });
  assert.ok(!q.done && q.progress > 0.3, 'letting go only decays slowly');
  for (let i = 0; i < 8; i++) q.tick(0.1, { down: true });
  assert.ok(q.ok);
  q = qteState('mash', { count: 5, time: 3 });
  for (let i = 0; i < 4; i++) q.tick(0.05, { pressed: 1 });
  assert.ok(!q.done, 'four of five presses');
  for (let i = 0; i < 2; i++) q.tick(0.05, { pressed: 1 });
  assert.ok(q.ok);
  q = qteState('turn', { turns: 1, time: 5 });
  for (let i = 0; i < 20; i++) q.tick(0.05, { turn: 0.4 });
  assert.ok(q.ok, 'eight radians is more than one turn');
  const easy = qteState('press', { time: 2, assist: 1 });
  assert.ok(easy.window > 3, 'assist stretches the window');
  let b = braceState(3);
  for (let i = 0; i < 31; i++) b.tick(0.1, { down: true });
  assert.ok(b.done && b.ok);
  b = braceState(10);
  for (let i = 0; i < 40; i++) b.tick(0.1, { down: false });
  assert.ok(b.done && !b.ok, 'never holding loses the grip');
});

test('a checkpoint snapshot restores the section start exactly', async () => {
  const { makeSnapshot, restoreSnapshot, invFromObj, newRes } = await mod();
  const live = {
    level: 'lifeboat',
    section: 2,
    sectionId: 'co2',
    flags: { cargo: 'o2', told: true },
    inventory: invFromObj({ tape: 1, sock: 1 }),
    res: newRes({ o2: 71, co2: 9 }),
    drains: { co2: 0.2 },
    meters: ['o2', 'co2', 'nonsense'],
    choices: [{ id: 'truth', pick: 'tell' }],
    looted: ['locker_3'],
    world: { set: 'capsule', player: { x: 1, y: 0.5, z: -1, yaw: 2 }, gravity: 'zeroG' },
  };
  const snap = makeSnapshot(live);
  // The section goes on and changes everything...
  live.flags.cargo = 'cam';
  live.inventory.set('hose', 1);
  live.res.o2 = 3;
  live.looted.push('locker_4');
  // ...then fails, and comes back to the start.
  const back = restoreSnapshot(snap);
  assert.strictEqual(back.section, 2);
  assert.deepStrictEqual(back.flags, { cargo: 'o2', told: true });
  assert.deepStrictEqual([...back.inventory.entries()], [['tape', 1], ['sock', 1]]);
  assert.strictEqual(back.res.o2, 71);
  assert.strictEqual(back.res.power, 100, 'missing meters take their start value');
  assert.deepStrictEqual(back.meters, ['o2', 'co2'], 'unknown meters are dropped');
  assert.deepStrictEqual(back.looted, ['locker_3']);
  assert.strictEqual(back.world.gravity, 'zeroG');
  // Restoring twice gives independent copies.
  const again = restoreSnapshot(snap);
  again.flags.cargo = 'x';
  assert.strictEqual(restoreSnapshot(snap).flags.cargo, 'o2');
});

test('the save profile round-trips and rejects junk', async () => {
  const { newProfile, parseProfile, serializeProfile, makeSnapshot, unlockedLevels } = await mod();
  const p = newProfile();
  p.checkpoint = makeSnapshot({ level: 'lifeboat', section: 1, flags: { a: 1 } });
  p.starts.prologue = makeSnapshot({ level: 'prologue', section: 0 });
  p.done.prologue = true;
  p.journal.challenger = 123;
  p.creator = true;
  const back = parseProfile(serializeProfile(p));
  assert.strictEqual(back.checkpoint.level, 'lifeboat');
  assert.strictEqual(back.checkpoint.section, 1);
  assert.ok(back.done.prologue && back.creator && back.journal.challenger === 123);
  assert.deepStrictEqual(parseProfile('not json'), newProfile());
  assert.deepStrictEqual(parseProfile(JSON.stringify({ v: 99, checkpoint: {} })), newProfile(), 'other versions start fresh');
  const bad = parseProfile(JSON.stringify({ v: 1, checkpoint: { level: 5 }, journal: [], done: 'x' }));
  assert.strictEqual(bad.checkpoint, null);
  const levels = [{ id: 'lifeboat', n: 1 }, { id: 'prologue', n: 0 }, { id: 'storm', n: 2 }];
  const open = unlockedLevels(levels, back);
  assert.ok(open.has('prologue') && open.has('lifeboat') && !open.has('storm'));
});

test('text keys and subtitle timing', async () => {
  const { textKey, lineDuration } = await mod();
  assert.strictEqual(textKey('prologue', 'arrive', 3), 'll.prologue.arrive.3');
  assert.strictEqual(textKey('prologue', 'arrive', 3, 'kwame.cold'), 'll.kwame.cold');
  assert.strictEqual(textKey('prologue', 'arrive', 3, 'll.kwame.cold'), 'll.kwame.cold');
  assert.ok(lineDuration('Go.') >= 1.8);
  assert.ok(lineDuration('Minus four. These seals never saw cold like this.') > 2.5);
  assert.strictEqual(lineDuration('x', { wait: 0.5 }), 0.5);
});
