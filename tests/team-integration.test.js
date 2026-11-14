// Run with: node --test "tests/*.test.js"
// The joins between the team-game parts: the choice at the lander door, the room's
// ascent phase on real surface output, controller buttons, fair agendas, flight deaths.
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/team/surface-sim.js');
const Sim = require('../js/team/sim.js');
const Room = require('../js/team/room.js');
Room.useSim(Sim);

const WORLDS = ['moon', 'mars', 'venus', 'europa'];

// A mission at the door: everyone at the lander, extraction called, a rack too heavy to lift.
function atTheDoor(world = 'mars', opts = {}) {
  const load = S.fixture('good', world);
  load.ascent.liftKg = 40;
  const st = S.create(load, 77, [{ id: 'h', role: 'planner' }], {});
  while (st.stage === 'intro') S.step(st, {}, S.TICK);
  const L = st.entities.find((e) => e.kind === 'lander');
  for (const p of st.entities.filter((e) => e.kind === 'astronaut')) {
    p.x = L.x + 0.1;
    p.z = L.z + 0.1;
  }
  st.ascent.rack.push({ id: 'cheap', siteKind: 'mineral', massKg: 60, value: 5, core: false }, { id: 'prize', siteKind: 'ice', massKg: 30, value: 200, core: true });
  st.ascent.loadedKg = 90;
  st.ascent.overKg = 50;
  st.extraction.called = true;
  st.extraction.timer = 30;
  st.stage = 'extraction';
  return st;
}

test('over capacity at the door opens a decision window instead of launching at once', () => {
  const st = atTheDoor();
  S.step(st, {}, S.TICK);
  assert.strictEqual(st.over, false, 'it does not launch in the same tick');
  // A calm window (TUNE.decisionS, 15 s): enough to read the grouped plan and confirm.
  assert.ok(st.extraction.decision >= 10 && st.extraction.decision <= S.TUNE.decisionS, `window ${st.extraction.decision}`);
  const status = S.statusFor(st, 'h');
  assert.strictEqual(status.rack.items.length, 2, 'the phone sees the real rack');
  assert.ok(status.decision > 0);
  assert.strictEqual(status.rack.items[0].kg, 60);
  // Nothing moves during the window: the crew cannot be killed while choosing.
  const hp = st.entities.find((e) => e.kind === 'astronaut').hp;
  for (let i = 0; i < 20; i++) S.step(st, {}, S.TICK);
  assert.strictEqual(st.entities.find((e) => e.kind === 'astronaut').hp, hp);
  assert.strictEqual(st.over, false);
});

test('throwing enough overboard ends the window and lifts off with the crew\'s choice', () => {
  const st = atTheDoor();
  S.step(st, {}, S.TICK);
  assert.strictEqual(S.jettison(st, 'cheap'), true);
  S.step(st, {}, S.TICK * 2);
  assert.strictEqual(st.over, true);
  assert.strictEqual(st.outcome, 'extracted');
  const sum = S.summary(st);
  assert.deepStrictEqual(sum.ascent.rack.map((r) => r.id), ['prize'], 'the crew chose what stayed');
  assert.deepStrictEqual(sum.ascent.jettisoned.map((r) => r.id), ['cheap']);
});

test('if nobody chooses, the launch computer dumps the worst value per kilo after the window', () => {
  const st = atTheDoor();
  const ticks = Math.ceil(S.TUNE.decisionS * 30) + 40;
  for (let i = 0; i < ticks && !st.over; i++) S.step(st, {}, S.TICK);
  assert.strictEqual(st.over, true);
  assert.deepStrictEqual(S.summary(st).ascent.rack.map((r) => r.id), ['prize']);
});

test('the whole plan can go overboard in one input (the chooser confirm)', () => {
  const st = atTheDoor();
  S.step(st, {}, S.TICK);
  const plan = S.ascentPlan(st.ascent.rack, st.ascent.liftKg, st.loadout.objective);
  S.step(st, { h: { jettison: plan.drop } }, S.TICK);
  S.step(st, {}, S.TICK);
  assert.strictEqual(st.over, true);
  assert.deepStrictEqual(S.summary(st).ascent.jettisoned.map((r) => r.id).sort(), plan.drop.slice().sort());
});

test('a jettison input reaches the rack during the window too', () => {
  const st = atTheDoor();
  S.step(st, {}, S.TICK);
  S.step(st, { h: { jettison: 'cheap' } }, S.TICK);
  assert.ok(st.ascent.jettisoned.some((r) => r.id === 'cheap'));
});

test('a light rack launches at once, no window', () => {
  const st = atTheDoor();
  st.ascent.rack = st.ascent.rack.filter((r) => r.id === 'prize');
  st.ascent.loadedKg = 30;
  st.ascent.overKg = 0;
  S.step(st, {}, S.TICK);
  assert.strictEqual(st.over, true);
});

test('the room ascent reads the real rack and what was left behind', () => {
  const st = atTheDoor();
  S.step(st, {}, S.TICK);
  S.jettison(st, 'cheap');
  S.step(st, {}, S.TICK * 2);
  const summary = S.summary(st);
  let r = Room.create({ mode: 'solo', seed: 5, scenarioId: 'moon', timing: { flightHoldMs: 0, landingMs: 500, flightMs: 500, fixedFlight: true, surfaceMaxMs: 3000, ascentMs: 500 } });
  r = Room.reduce(r, { type: 'start', by: 'local' }, 100);
  r = Room.reduce(r, { type: 'next', by: 'local' }, 200);
  const requirement = Sim.scenarios().find((x) => x.id === 'moon').requirements[0].id;
  r = Room.reduce(r, { type: 'pick', by: 'local', requirement }, 250);
  r = Room.reduce(r, { type: 'next', by: 'local' }, 300);
  r = Room.reduce(r, { type: 'lock', by: 'local' }, 350);
  r = Room.reduce(r, { type: 'next', by: 'local' }, 400);
  assert.strictEqual(r.phase, 'flight');
  r = Room.reduce(r, { type: 'next', by: 'local' }, 500);
  r = Room.reduce(r, { type: 'landingDone', by: 'host' }, 600);
  r = Room.reduce(r, { type: 'surfaceDone', summary, by: 'host' }, 700);
  assert.strictEqual(r.phase, 'ascent');
  const view = Room.viewFor(r, 'local', 800);
  assert.deepStrictEqual(view.ascent.samples.map((s) => s.id), ['prize']);
  assert.deepStrictEqual(view.ascent.jettisoned.map((s) => s.id), ['cheap']);
  assert.strictEqual(view.ascent.capacityKg, 40);
});

test('the phone swap button reaches the sim input', () => {
  const r = Room.create({ mode: 'phones' });
  Room.applyInput(r, 'p1', { mx: 0, my: 0, ax: 0, ay: 0, buttons: Room.BUTTONS.swap }, 1000);
  assert.strictEqual(r.inputs.p1.swap, true);
});

test('agendas that cannot be met are not dealt in that scenario and difficulty', () => {
  for (let seed = 1; seed < 400; seed++) {
    const mars = Sim.agendas(seed, Room.ROLES.slice(), 'engineer', 'mars');
    assert.ok(mars.every((a) => a.id !== 'no_spill'), 'no_spill on mars');
    const marsD = Sim.agendas(seed, Room.ROLES.slice(), 'director', 'mars');
    assert.ok(marsD.every((a) => a.id !== 'no_spill'));
    const eur = Sim.agendas(seed, Room.ROLES.slice(), 'engineer', 'europa');
    assert.ok(eur.every((a) => a.id !== 'power_margin' && a.id !== 'battery_safe'), 'europa power goals');
  }
  // Without a scenario the deal is unchanged, so old callers still get a full hand.
  assert.strictEqual(Sim.agendas(5).length, 4);
});

test('a default design reaches the surface on every world even if every crisis is missed', () => {
  for (const sc of WORLDS) {
    const info = Sim.scenarios().find((x) => x.id === sc);
    for (const req of info.requirements) {
      for (const diff of ['cadet', 'engineer', 'director']) {
        const d = Sim.newDesign(sc, diff, req.id);
        for (let seed = 1; seed <= 20; seed++) {
          const f = Sim.fly(d, seed * 131);
          assert.notStrictEqual(f.result.cause, 'attitude', `${sc} ${diff}: attitude death`);
          assert.notStrictEqual(f.result.cause, 'drag', `${sc} ${diff}: drag death`);
        }
      }
    }
  }
});

test('a whole v2 round on the real simulation: setup steps, every build step, questions, review, cabin, flight', () => {
  for (const sc of ['nile', 'venus']) {
    let r = Room.create({ mode: 'solo', seed: 9, timing: { cabinMs: 900, flightMs: 500, fixedFlight: true, flightHoldMs: 0, landingMs: 500, surfaceMaxMs: 3000, ascentMs: 500 } });
    let now = 0;
    const a = (type, extra) => {
      r = Room.reduce(r, { type, by: 'local', ...extra }, (now += 50));
      assert.ok(r.last.ok, `${sc} ${type}: ${r.last.text}`);
    };
    a('setup', { difficulty: 'engineer' });
    a('forward');
    a('setRole', { role: 'comms', crew: 'jonas' });
    a('forward');
    a('setup', { scenarioId: sc });
    a('forward');
    assert.strictEqual(r.phase, 'brief');
    a('forward');
    assert.strictEqual(r.phase, 'questions');
    const req = Sim.scenarios().find((x) => x.id === sc).requirements[0];
    a('pick', { requirement: req.id });
    a('forward');
    const steps = Sim.buildSteps(sc, 'engineer');
    for (const st of steps) {
      assert.strictEqual(Room.viewFor(r, 'local').buildStep, steps.indexOf(st));
      const cards = Sim.stepCards(r.design, st.id);
      const pick = cards.find((c) => !c.on && c.flies && !st.multi) || cards.find((c) => c.on);
      if (pick && !st.multi) a('build', { step: st.id, option: pick.id });
      a('forward');
    }
    assert.strictEqual(r.phase, 'lock');
    const hard = r.checks.filter((c) => c.hard && !c.ok);
    if (hard.length) {
      a('stepTo', { index: steps.length - 1 });
      a('build', { step: 'rocket', option: 'heavy' });
      a('forward');
      a('forward');
    }
    a('vote', { yes: true });
    r = Room.tick(r, r.armedAt + 1);
    assert.strictEqual(r.phase, 'cabin');
    a('next');
    assert.strictEqual(r.phase, 'flight');
    assert.strictEqual(r.design.requirement, req.id);
  }
});
