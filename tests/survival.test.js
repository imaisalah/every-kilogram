// Story-mode survival segments (js/story/survival.js): the numbers behind each
// segment, quick() for every id, and the story state each one writes.
const test = require('node:test');
const assert = require('node:assert');
require('../content/story/survival.js');
const S = require('../js/story/survival.js');
require('../js/i18n/ar-survival.js');

const D = globalThis.SMD.storySurvivalData;
const { power, co2, storm, burn, entry } = S.models;
const fresh = (flags) => S.ensure({ flags: Object.assign({}, flags || {}) });

test('the five segment ids are exactly the ones the writers use', () => {
  assert.deepStrictEqual(S.SEGMENTS, ['ep2.power', 'ep2.co2', 'ep3.storm', 'ep4.burn', 'ep4.entry']);
  assert.throws(() => S.quick('ep9.nope', fresh(), 'good'));
});

test('quick(): good wins and bad loses for every segment, on an empty state too', () => {
  S.SEGMENTS.forEach((id) => {
    const good = S.quick(id, {}, 'good');
    assert.strictEqual(good.result, 'win', id);
    const bad = S.quick(id, {}, 'bad');
    assert.strictEqual(bad.result, 'lose', id);
    ['res', 'health', 'flags'].forEach((k) => assert.ok(bad.state[k], `${id} fills state.${k}`));
    Object.values(bad.state.health).forEach((h) => assert.ok(h >= 0 && h <= 100, `${id} health in 0-100`));
  });
});

test('run() without a page falls back to the quick good path', async () => {
  const st = fresh();
  const r = await S.run(null, 'ep4.burn', st);
  assert.strictEqual(r.result, 'win');
  assert.strictEqual(st.flags.corridorOk, true);
});

test('ep2.power: Apollo 13-like loads; only a real power-down reaches home', () => {
  const cfg = D.power;
  const all = power.defaults(cfg);
  assert.strictEqual(power.amps(cfg, all), 49.5);
  assert.strictEqual(power.outcome(cfg, 60, all, 0).win, false);
  const plan = Object.assign(power.defaults(cfg), { guidance: 'off', radar: 'off', camera: 'off', heaters: 'low', comms: 'low', displays: 'low', lights: 'off', water: 'off', windows: 'off' });
  const o = power.outcome(cfg, 60, plan, 45);
  assert.ok(o.win, `${o.hours} h should beat ${cfg.hoursHome * cfg.margin}`);
  // Deciding slowly costs battery.
  assert.ok(power.outcome(cfg, 60, plan, 400).hours < o.hours);
  // Keeping the heaters on costs something else.
  const warm = Object.assign({}, plan, { heaters: 'on' });
  assert.strictEqual(power.outcome(cfg, 60, warm, 45).win, false);
  assert.ok(power.outcome(cfg, 60, Object.assign({}, warm, { comms: 'off', fans: 'low' }), 45).win);
  assert.ok(power.morale(plan) < power.morale(all));
  // The story state: heatersOff, res.power and a cold cabin.
  const st = fresh();
  const cold = Object.assign({}, plan, { heaters: 'off' });
  S.apply.power(st, power.outcome(cfg, 60, cold, 45), cfg);
  assert.strictEqual(st.flags.heatersOff, true);
  assert.strictEqual(st.flags.guidanceOff, true);
  assert.ok(st.res.power > 0 && st.res.power < 100);
  assert.ok(st.health.you < 100);
});

test('the power gauge stays coherent from the rupture to splashdown', () => {
  const cfg = D.power;
  const st = S.ensure({ res: { power: 60 } }); // ep2 applies power -40 for the rupture
  assert.strictEqual(S.quick('ep2.power', st, 'good').result, 'win');
  const afterPlan = st.res.power;
  assert.ok(afterPlan >= 50, `the gauge shows the battery now (${afterPlan}%), not 0`);
  S.quick('ep3.storm', st, 'good');
  const afterStorm = st.res.power;
  S.quick('ep4.burn', st, 'good');
  S.quick('ep4.entry', st, 'good');
  assert.ok(afterStorm < afterPlan && st.res.power < afterStorm, 'the trip drains it');
  // It lands at the projected margin (what the plan had left at home).
  const o = power.outcome(cfg, 60, Object.assign(power.defaults(cfg), { heaters: 'low', comms: 'low', guidance: 'off', displays: 'low', lights: 'low', water: 'off', windows: 'off', radar: 'off', camera: 'off' }), 45);
  assert.ok(Math.abs(st.res.power - power.level(cfg, o.atHomeAh)) <= 2, `${st.res.power} vs ${power.level(cfg, o.atHomeAh)}`);
  assert.ok(st.res.power > 5);
  // Short of power: a forced deep power-down gets them home with almost nothing.
  const sh = S.ensure({ res: { power: 60 } });
  S.quick('ep2.power', sh, 'bad');
  S.quick('ep3.storm', sh, 'good');
  S.quick('ep4.burn', sh, 'good');
  S.quick('ep4.entry', sh, 'good');
  assert.ok(sh.res.power <= 5);
});

test('ep2.co2: the real 15 mmHg line, the procedure order, the ep1/ep2 choices', () => {
  const cfg = D.co2;
  assert.strictEqual(cfg.danger, 15);
  assert.deepStrictEqual(cfg.steps, ['cartridge', 'cover', 'bag', 'hose', 'tape', 'sock']);
  assert.strictEqual(co2.pick(cfg, 0, 'cartridge').ok, true);
  assert.strictEqual(co2.pick(cfg, 1, 'bag').ok, false);
  // Every part sits in some locker.
  cfg.steps.forEach((it) => assert.ok(cfg.lockers.some((l) => l.item === it), it));
  const base = co2.start(cfg, fresh());
  assert.ok(co2.start(cfg, fresh({ spareCartridges: true })) < base, 'spare cartridges buy time');
  assert.ok(co2.start(cfg, fresh({ fansLow: true })) > base, 'low fans start higher');
  assert.ok(co2.penalty(cfg, fresh({ graceBuilt: true })) < co2.penalty(cfg, fresh()));
  const win = S.quick('ep2.co2', fresh(), 'good').state;
  assert.strictEqual(win.flags.adapterBuilt, true);
  assert.ok(win.res.co2 < 20);
  const lose = S.quick('ep2.co2', fresh(), 'bad').state;
  assert.strictEqual(lose.flags.adapterBuilt, false);
  assert.strictEqual(lose.flags.co2Headaches, true);
  assert.ok(lose.health.lena < 100);
});

test('ep3.storm: dose falls with mass; the best layout meets Orion’s 150 mSv', () => {
  const cfg = D.storm;
  assert.strictEqual(Math.round(storm.dose(cfg, cfg.refShield)), cfg.doseRef);
  assert.ok(storm.dose(cfg, 30) < storm.dose(cfg, 20));
  const empty = { b1: [], b2: [], b3: [], b4: [] };
  const bare = storm.outcome(cfg, empty, { you: 'b1', yusuf: 'b2', lena: 'b3', grace: 'b4' });
  assert.strictEqual(bare.win, false, 'no bags is not enough');
  const st = fresh();
  const r = S.quick('ep3.storm', st, 'good');
  const o = r.outcome;
  const used = { water: 0, stow: 0 };
  Object.values(o.layout).forEach((bags) => {
    assert.ok(bags.length <= cfg.capacity);
    bags.forEach((k) => used[k]++);
  });
  assert.ok(used.water <= cfg.bags.water.n && used.stow <= cfg.bags.stow.n, 'never more bags than aboard');
  assert.ok(o.max <= cfg.goal);
  assert.strictEqual(st.flags.shelterGood, true);
  assert.ok(st.health.you < 100, 'everyone takes some dose');
  // Someone left outside takes the bare-hull dose.
  const out = storm.outcome(cfg, o.layout, Object.assign({}, o.crewAt, { grace: null }));
  assert.strictEqual(out.doses.grace, cfg.doseRef);
  assert.strictEqual(out.win, false);
});

test('ep3.storm follows the writer’s choices without clobbering their flags', () => {
  const cfg = D.storm;
  const t = storm.tune(cfg, fresh({ headStart: true, doseShared: true }));
  assert.strictEqual(t.warnSeconds, cfg.warnSeconds + 20);
  assert.ok(t.berths.find((b) => b.id === 'b4').shield > cfg.berths.find((b) => b.id === 'b4').shield);
  const st = fresh({ doseYusuf: true });
  const r = S.quick('ep3.storm', st, 'good');
  assert.strictEqual(r.outcome.crewAt.yusuf, 'b4', 'the edge volunteer takes the hatch berth');
  assert.strictEqual(st.flags.doseYusuf, true, 'the story’s boolean survives');
  assert.ok(Number.isFinite(st.flags.mSvYusuf));
});

function flyBurn(cfg, cutAt, hold = true) {
  const s = burn.create(cfg, 7);
  let t = 0;
  while (s.phase !== 'done' && t < 90) {
    const p = hold ? Math.max(-1, Math.min(1, -(s.pitch * 0.6 + s.pr * 1.2))) : 0;
    const r = hold ? Math.max(-1, Math.min(1, -(s.roll * 0.6 + s.rr * 1.2))) : 0;
    if (s.phase === 'arm' && t > 3) burn.ignite(cfg, s);
    if (s.phase === 'burn' && s.burnT >= cutAt) burn.cut(cfg, s);
    burn.step(cfg, s, { pitch: p, roll: r }, 1 / 60);
    t += 1 / 60;
  }
  return burn.outcome(cfg, s);
}

test('ep4.burn: a steady 14-second burn lands in the corridor; short, long or drifting does not', () => {
  const cfg = D.burn;
  assert.strictEqual(cfg.burnSeconds, 14);
  assert.strictEqual(cfg.rateLimit, 10);
  assert.ok(flyBurn(cfg, 14).corridorOk);
  assert.strictEqual(flyBurn(cfg, 7).corridorOk, false);
  assert.strictEqual(flyBurn(cfg, 23).corridorOk, false);
  assert.strictEqual(flyBurn(cfg, 14, false).corridorOk, false, 'letting it drift misses');
  assert.ok(Math.abs(burn.predict(cfg, 14) - cfg.gammaTarget) < 0.01);
  // The real burn rule: rates over 10°/s shut the engine down.
  const s = burn.create(cfg, 1);
  burn.ignite(cfg, s);
  for (let i = 0; i < 600 && s.phase !== 'done'; i++) burn.step(cfg, s, { pitch: 1, roll: 0 }, 1 / 30);
  assert.strictEqual(s.abort, true);
  // A tired pilot drifts more.
  assert.ok(burn.tune(cfg, fresh({ youFlew: true, youTired: true })).drift > 1);
});

function flyEntry(flags, steer) {
  const st = fresh(Object.assign({ entryAngle: 6.3 }, flags));
  const cfg = S.cfgFor('entry', st);
  const s = entry.create(cfg, st, 5);
  while (s.phase === 'control') entry.step(cfg, s, steer(s), 1 / 60);
  return entry.outcome(cfg, s);
}

test('ep4.entry: holding the 5.5-7.5° corridor lands; drifting steep burns; shallow skips', () => {
  assert.deepStrictEqual(D.entry.corridor, [5.5, 7.5]);
  assert.ok(D.entry.blackoutActual - D.entry.blackoutExpected === 87, 'Apollo 13 ran 87 s long');
  const hold = (s) => Math.max(-1, Math.min(1, (s.gamma - 6.5) * 1.5 + 0.3));
  ['directEntry', 'skipEntry'].forEach((p) => assert.ok(flyEntry({ [p]: true }, hold).win, p));
  assert.ok(flyEntry({ directEntry: true }, () => 0).burned, 'no hands: the damaged shield pulls it steep');
  assert.ok(flyEntry({}, () => 1).skipped, 'all lift up: skip-out');
  // Direct is harder on the crew, skip harder on the shield.
  const d = flyEntry({ directEntry: true }, hold);
  const k = flyEntry({ skipEntry: true }, hold);
  assert.ok(d.peakG > k.peakG);
  assert.ok(k.shield < d.shield);
  const st = fresh({ directEntry: true });
  S.quick('ep4.entry', st, 'good');
  assert.strictEqual(st.flags.landed, true);
  const bad = fresh();
  S.quick('ep4.entry', bad, 'bad');
  assert.ok(bad.health.grace < 100 && bad.health.grace > 0, 'hurt, never killed by the numbers alone');
});

test('every survival string has an Arabic translation with the same placeholders', () => {
  const ar = globalThis.SMD.i18nDicts.ar;
  const src = require('fs').readFileSync(require('path').join(__dirname, '../js/story/survival.js'), 'utf8');
  const keys = new Map();
  for (const m of src.matchAll(/T\('([\w.]+)',\s*'((?:[^'\\]|\\.)*)'/g)) keys.set(m[1], m[2]);
  const en = src.slice(src.indexOf('const EN = {'), src.indexOf('\n  };', src.indexOf('const EN = {')));
  for (const m of en.matchAll(/'([\w.]+)':\s*'((?:[^'\\]|\\.)*)'/g)) keys.set(m[1], m[2]);
  assert.ok(keys.size > 150);
  for (const [k, e] of keys) {
    const a = ar['sv.' + k];
    assert.ok(a, 'missing Arabic for sv.' + k);
    const ph = (x) => (x.match(/\{\w+\}/g) || []).sort().join();
    assert.strictEqual(ph(a), ph(e), 'placeholders of sv.' + k);
  }
});
