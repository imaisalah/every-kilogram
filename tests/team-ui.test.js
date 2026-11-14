// The parts of the team screens that are pure logic: what a change costs, how
// numbers are worded, and whether every string on those screens has Arabic.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
globalThis.SMD = {};
for (const f of ['js/i18n.js', 'js/i18n/ar-team.js', 'js/team/ar-sim.js', 'js/team/view-setup.js']) require(path.join(root, f));
const sim = require(path.join(root, 'js/team/sim.js'));
const kit = SMD.team.kit;

const res = (dry, prop, cost) => ({ mass: { value: dry + prop, limit: 1000, dry, prop }, budget: { value: cost, limit: 500 } });

test('a heavier part snowballs into fuel and money', () => {
  const steps = kit.snowballSteps(res(100, 50, 200), res(112, 84, 240));
  assert.strictEqual(steps.length, 3);
  assert.match(steps[0].label, /\+12 kg/);
  assert.strictEqual(steps[1].kind, 'fuel');
  assert.match(steps[1].label, /\+34 kg/);
  assert.strictEqual(steps[2].kind, 'money');
  assert.match(steps[2].label, /\+\$40M/);
});

test('no snowball when no mass changed or there is no earlier state', () => {
  assert.strictEqual(kit.snowballSteps(res(100, 50, 200), res(100, 50, 260)), null);
  assert.strictEqual(kit.snowballSteps(null, res(100, 50, 200)), null);
});

test('a lighter part shows its savings with a minus', () => {
  const steps = kit.snowballSteps(res(100, 50, 200), res(90, 40, 200));
  assert.match(steps[0].label, /−10 kg/);
  assert.match(steps[1].label, /−10 kg/);
});

test('previews mark better and worse per resource, and say when nothing changes', () => {
  const html = kit.previewChips({ mass: { delta: 22 }, power: { delta: 40 }, budget: { delta: -5 }, comms: { delta: 0 } });
  assert.match(html, /bad[^]*\+22 kg/);
  assert.match(html, /good[^]*\+40 W/);
  assert.match(html, /good[^]*−\$5M/);
  assert.match(kit.previewChips({ mass: { delta: 0 } }), /No change/);
  assert.strictEqual(kit.previewChips({ error: 'nope' }), '');
});

test('text from players is escaped', () => {
  assert.strictEqual(kit.esc('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
  assert.strictEqual(kit.esc(null), '');
});

test('the clock reads minutes and seconds, and infinity in the sandbox', () => {
  assert.strictEqual(kit.clockText({ leftS: 65 }), '1:05');
  assert.strictEqual(kit.clockText({ leftS: 0 }), '0:00');
  assert.strictEqual(kit.clockText(null), '∞');
});

test('the landing kit reads as packing, ship parts do not, and combat gear is gone', () => {
  assert.strictEqual(kit.isPack({ key: 'ascent' }), true);
  assert.strictEqual(kit.isPack({ key: 'oxygen' }), true);
  assert.strictEqual(kit.isPack({ key: 'antenna' }), false);
  assert.strictEqual(kit.isPack({ key: 'weapons' }), false);
});

test('the tracker only ever moves forward through a whole mission, and ends at 100%', () => {
  const base = { scenarioId: 'mars', difficulty: 'engineer', mode: 'solo' };
  const n = sim.buildSteps('mars', 'engineer').length;
  const path = [
    { phase: 'lobby', setupStep: 'difficulty' },
    { phase: 'lobby', setupStep: 'crew' },
    { phase: 'lobby', setupStep: 'destination' },
    { phase: 'brief' },
    { phase: 'questions' },
    ...Array.from({ length: n }, (_, i) => ({ phase: 'design', buildStep: i })),
    { phase: 'lock' },
    { phase: 'cabin' },
    { phase: 'flight', flight: { progress: 0.1 } },
    { phase: 'flight', flight: { progress: 0.9 } },
    { phase: 'landing' },
    { phase: 'surface' },
    { phase: 'ascent' },
    { phase: 'debrief' },
  ];
  let last = -1;
  for (const p of path) {
    const pr = kit.progressOf({ ...base, ...p });
    assert.ok(pr.pct >= last, `${JSON.stringify(p)}: ${pr.pct} after ${last}`);
    assert.ok(pr.pct >= 0 && pr.pct <= 100);
    last = pr.pct;
  }
  assert.strictEqual(last, 100);
  assert.deepStrictEqual(kit.progressOf({ ...base, phase: 'surface' }).stages, ['crew', 'destination', 'questions', 'build', 'launch', 'flight', 'surface', 'home']);
  const earth = kit.progressOf({ ...base, scenarioId: 'nile', phase: 'flight', flight: { progress: 0.5 } });
  assert.ok(!earth.stages.includes('surface'), 'training flights have no surface stage');
  const lo = kit.progressOf({ ...base, phase: 'surface' }, 0.1).pct;
  const hi = kit.progressOf({ ...base, phase: 'surface' }, 0.8).pct;
  assert.ok(hi > lo, 'the surface passes its objective progress in');
});

test('who may move the crew on: everyone at one screen, the host, or the step owner', () => {
  assert.strictEqual(kit.canSteer({ mode: 'solo', phase: 'lobby' }), true);
  assert.strictEqual(kit.canSteer({ mode: 'devices', phase: 'lobby', isHost: false, me: { id: 'p2', roles: ['planner'] } }), false);
  assert.strictEqual(kit.canSteer({ mode: 'devices', phase: 'lobby', isHost: true, me: { id: 'p1', roles: [] } }), true);
  const build = { mode: 'devices', phase: 'design', scenarioId: 'moon', difficulty: 'engineer', buildStep: 0, isHost: false };
  assert.strictEqual(kit.canSteer({ ...build, me: { id: 'p2', roles: ['planner'] } }), true, 'the orbit belongs to the planner');
  assert.strictEqual(kit.canSteer({ ...build, me: { id: 'p3', roles: ['comms'] } }), false);
});

test('picks work for single and multiple choices', () => {
  const d = { picks: { orbit: 'a', instruments: ['x', 'y'] } };
  assert.strictEqual(kit.isPicked(d, 'orbit', 'a'), true);
  assert.strictEqual(kit.isPicked(d, 'instruments', 'y'), true);
  assert.strictEqual(kit.isPicked(d, 'instruments', 'z'), false);
  const slot = { key: 'instruments', options: [{ id: 'x', name: 'Camera' }, { id: 'y', name: 'Radar' }] };
  assert.deepStrictEqual(kit.pickNames(slot, d), ['Camera', 'Radar']);
});

test('every string on the setup screens has Arabic', () => {
  const re = /\bt\(\s*'(team\.[\w.-]+)'\s*,/g;
  const missing = [];
  for (const f of ['js/screen-team.js', 'js/team/view-setup.js', 'js/team/phone.js']) {
    const s = fs.readFileSync(path.join(root, f), 'utf8');
    let m;
    while ((m = re.exec(s))) if (!SMD.i18nDicts.ar[m[1]]) missing.push(m[1]);
  }
  assert.deepStrictEqual([...new Set(missing)], []);
});

test('the ascent chooser preselects exactly what the launch computer would throw out', () => {
  const S = require(path.join(root, 'js/team/surface-sim.js'));
  const saved = SMD.team.surface;
  delete SMD.team.surface; // the phone page has no sim: kit uses its own copy
  try {
    const rnd = (a) => () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    const kinds = ['ice', 'mineral', 'organic', 'thermal'];
    for (let seed = 1; seed < 60; seed++) {
      const r = rnd(seed);
      const items = Array.from({ length: 2 + Math.floor(r() * 9) }, (_, i) => ({ id: 's' + i, kind: kinds[Math.floor(r() * 4)], kg: 10 + Math.round(r() * 50), value: 40 + Math.round(r() * 150) }));
      const lift = 40 + Math.round(r() * 160);
      const obj = kinds[Math.floor(r() * 4)];
      const mine = kit.ascentPlan(items, lift, obj);
      const ref = S.ascentPlan(items.map((x) => ({ id: x.id, siteKind: x.kind, massKg: x.kg, value: x.value })), lift, obj);
      assert.deepStrictEqual(mine.drop.slice().sort(), ref.drop.slice().sort(), `seed ${seed}`);
      assert.ok(mine.overKg <= 0.001 || mine.drop.length === items.length);
      // Keeping the plan's own counts gives the same samples.
      const again = kit.ascentPlan(items, lift, obj, mine.keep);
      assert.ok(again.keptKg >= mine.keptKg - 1e-6 || again.overKg === 0);
    }
  } finally {
    SMD.team.surface = saved;
  }
});

test('the debrief best change names a build step the players saw', () => {
  for (const s of sim.scenarios()) for (const df of ['cadet', 'engineer', 'director']) {
    const d = sim.newDesign(s.id, df, s.requirements[0].id);
    const b = sim.bestChange(d, 7);
    if (!b) continue;
    const steps = sim.buildSteps(s.id, df);
    const st = steps.find((x) => x.id === b.step);
    assert.ok(st, `${s.id}/${df}: ${b.key} has a step`);
    assert.ok(st.keys.includes(b.key));
    assert.ok(b.text.startsWith(st.title), b.text);
    assert.ok(b.text.length < 90, b.text);
    assert.deepStrictEqual(b.design, sim.applyStep(d, b.step, b.option));
  }
});

test('v3: the Mission definition sits in the success-criterion stage; solo owns only its job', () => {
  const base = { mode: 'solo', scenarioId: 'mars', difficulty: 'engineer' };
  const q = kit.progressOf({ ...base, phase: 'questions' }).pct;
  const d = kit.progressOf({ ...base, phase: 'define' }).pct;
  const b = kit.progressOf({ ...base, phase: 'design', buildStep: 0 }).pct;
  assert.ok(q < d && d < b, 'questions < define < build');
  assert.strictEqual(kit.canSteer({ ...base, phase: 'define' }), true);
  const steps = sim.buildSteps('mars', 'engineer');
  const v = { ...base, phase: 'design', soloJob: 'comms', me: { id: 'local', roles: ['planner', 'engineer', 'scientist', 'comms'] } };
  assert.deepStrictEqual(steps.filter((st) => kit.ownsStep(v, st)).map((st) => st.role).filter((r, i, a) => a.indexOf(r) === i), ['comms']);
  assert.ok(steps.every((st) => kit.ownsStep({ ...v, soloJob: null }, st)), 'no job picked: every step');
  assert.ok(SMD.team.views.define && typeof SMD.team.views.define.mount === 'function');
});
