// Launch day: the agency hook re-flies the mission with the decisions made at
// the pad and in mission control (js/screen-launchday.js).
const test = require('node:test');
const assert = require('node:assert');
require('../js/physics.js');
require('../js/data.js');
require('../js/model.js');
require('../js/ops.js');
const A = require('../js/agency.js');

const PLAN = { instruments: ['sounder', 'hires', 'neutron'], arrays: 6, dish: 3, amp: 100, recorder: 256, launcher: 'light', capture: 'aerobrake', margin: 20 };

// Plays to the month the Mars mission launches; returns the agency and project.
function toLaunch(seed, testPlan = 'basic') {
  const ag = A.newAgency('Pad Agency', seed);
  ag.money = 2000;
  ['dish3', 'amp100', 'aero'].forEach((t) => ag.tech.push(t));
  ag.rep = 3;
  const d = Object.assign(A.newDesign(ag, 'mars'), PLAN);
  A.applyTech(ag, d);
  const r = A.approve(ag, d, testPlan, 'standard');
  assert.ok(r.ok, 'approved');
  const p = r.project;
  for (let i = 0; i < 80; i++) {
    const evs = A.advance(ag);
    evs.forEach((e) => {
      if (e.type === 'review') {
        const qs = A.reviewQuestions(ag, e.project, e.review);
        A.resolveReview(ag, e.project, e.review, Object.fromEntries(qs.map((q) => [q.id, q.options[q.options.length - 1].id])));
      }
      if (e.type === 'event') A.resolveEvent(ag, e.project, e.eventId, null);
    });
    if (evs.some((e) => e.type === 'launch')) return { ag, p };
  }
  throw new Error('never launched');
}

test('launch day is open once, the month of launch', () => {
  const { ag, p } = toLaunch(11);
  assert.ok(A.launchDayOpen(ag, p));
  const r = A.launchDay(ag, p, {});
  assert.ok(r.ok);
  assert.ok(!A.launchDayOpen(ag, p), 'closed after use');
  assert.equal(A.launchDay(ag, p, {}).ok, false, 'a second call does nothing');
});

test('a clean launch day re-flies to the same result (same luck)', () => {
  for (const seed of [3, 7, 21]) {
    const { ag, p } = toLaunch(seed);
    const before = p.flight.score.total;
    const lostBefore = A.flightLost(p);
    const money = ag.money;
    A.launchDay(ag, p, {});
    assert.equal(p.flight.score.total, before, `seed ${seed}: same score`);
    assert.equal(A.flightLost(p), lostBefore);
    assert.equal(ag.money, money, 'nothing spent');
  }
});

test('scrubs and pad fixes cost money; a fixed flaw stays fixed', () => {
  // Find a career where a basic-checks spacecraft flies with a hidden flaw.
  let hit = null;
  for (let seed = 1; seed < 60 && !hit; seed++) {
    const r = toLaunch(seed);
    const f = r.p.flaws.find((x) => !x.fixed && !x.detected);
    if (f) hit = { ...r, f };
  }
  assert.ok(hit, 'some seed has a hidden flaw');
  const { ag, p, f } = hit;
  const money = ag.money;
  const res = A.launchDay(ag, p, { found: [f.uid], fixed: [f.uid], scrubDays: 2 });
  const want = A.padFixCost(f) + 2 * A.scrubCost(p);
  assert.ok(Math.abs(money - ag.money - want) < 1e-6, 'fix + two scrub days paid');
  assert.equal(res.cost, Math.round(want * 10) / 10);
  assert.ok(f.fixed && f.detected && f.foundBy === 'walkdown');
  const manifested = p.flight.fs.manifested.map((m) => m.flaw && m.flaw.uid);
  assert.ok(!manifested.includes(f.uid), 'the fixed flaw never shows up in flight');
  assert.ok(ag.log.some((l) => l.key === 'agency.log.ld.fix'));
});

test('a rough ride (weather override) raises launch stress', () => {
  const { ag, p } = toLaunch(5);
  A.launchDay(ag, p, { weatherRisk: 1 });
  assert.ok(p.launchStress > 0.75);
  assert.ok(ag.log.some((l) => l.key === 'agency.log.ld.override'));
});

test('lightning: same luck every time, and a loss is completed exactly once', () => {
  let sawLost = false;
  let sawHit = false;
  for (let seed = 1; seed < 80 && !(sawLost && sawHit); seed++) {
    const a = toLaunch(seed);
    const b = toLaunch(seed);
    const ra = A.launchDay(a.ag, a.p, { lightning: true });
    const rb = A.launchDay(b.ag, b.p, { lightning: true });
    assert.equal(ra.strike, rb.strike, 'deterministic');
    if (ra.strike === 'lost') {
      sawLost = true;
      assert.ok(A.flightLost(a.p));
      assert.equal(a.p.status, 'done');
      assert.equal(ra.events.filter((e) => e.type === 'complete').length, 1);
      assert.equal(a.p.result.score.total, 0);
      assert.equal(a.ag.log.filter((l) => l.key === 'agency.log.lost').length, 1);
      const w = A.whatIf(a.p, { dish: 2 });
      assert.ok(w.lost, 'what-ifs stay lost');
    }
    if (ra.strike === 'hit') {
      sawHit = true;
      const inst = a.p.launchDay.strikeInst;
      assert.ok(a.p.healthMods[inst] <= 0.6 + 1e-9);
    }
  }
  assert.ok(sawLost && sawHit, 'both outcomes occur');
});

test('a mission lost at launch is taken back and flown again', () => {
  const { ag, p } = toLaunch(9);
  // Pretend advance() lost it at launch and completed it (reputation -1).
  p.flight.fs.lost = true;
  p.endMs = p.launchMs;
  p.status = 'done';
  p.phase = 'F';
  ag.rep = Math.max(0, ag.rep - 1);
  const rep = ag.rep;
  ag.completed.mars = 0;
  p.result = { score: { total: 0 }, lost: true, reward: { rep: -1, science: 0, money: 0 }, success: false, discoveries: [], applied: { rep: -1, science: 0, money: 0, completed: null, headline: false, disc: [] } };
  ag.log.unshift({ ms: ag.now, key: 'agency.log.lost', en: '{name}: lost.', params: { name: p.design.name } });
  assert.ok(A.launchDayOpen(ag, p));
  const res = A.launchDay(ag, p, {});
  assert.ok(res.ok);
  assert.ok(!A.flightLost(p), 'the re-flight (same luck, no forced loss) survives');
  assert.equal(p.status, 'flying');
  assert.equal(p.result, null);
  assert.equal(ag.rep, rep + 1, 'the reputation hit is taken back');
  assert.ok(!('mars' in ag.completed));
  assert.ok(!ag.log.some((l) => l.key === 'agency.log.lost'));
  assert.equal(res.events.length, 0);
});