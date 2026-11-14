// The crewed mission ("Crew around the Moon", Artemis II–like): design
// numbers, crew-safety scoring, flight physics and the agency flow.
const test = require('node:test');
const assert = require('node:assert');
require('../js/physics.js');
const D = require('../js/data.js');
const M = require('../js/model.js');
const O = require('../js/ops.js');
require('../content/events.js');
const A = require('../js/agency.js');

const PROVEN = D.MISSIONS.crew.proven;
function crewAgency(seed = 7) {
  const ag = A.newAgency('Crew test', seed);
  ag.now = Date.UTC(2033, 0, 1);
  ag.rep = 6;
  ag.tech = ['heavy', 'dual'];
  ag.money = 3000;
  ag.teams = 3;
  return ag;
}
const design = (ag, change) => A.applyTech(ag, Object.assign(A.newDesign(ag, 'crew'), JSON.parse(JSON.stringify(PROVEN)), change || {}));
const okIds = (checks) => Object.fromEntries(checks.map((c) => [c.id, c.ok]));
// Fly one design with a chosen set of hidden flaws (none detected).
function fly(change, subs, seed = 11) {
  const d = Object.assign(M.defaultDesign('crew', 'T'), JSON.parse(JSON.stringify(PROVEN)), change || {});
  const ev = M.evaluate(d);
  const flaws = (subs || []).map((sub, i) => ({ uid: sub + i, sub, inst: null, detected: false, fixed: false }));
  return O.autoFlight(d, ev, flaws, seed, {});
}
// A seed whose rolls make a given flaw show up (the rolls are fixed per seed).
function seedWhere(subs, pred) {
  for (let s = 1; s < 400; s++) if (pred(fly({}, subs, s).score.crew)) return s;
  throw new Error('no seed found');
}

test('contract: late career, needs reputation 5 and the heavy-launcher research', () => {
  const ag = crewAgency();
  assert.equal(A.contractState(ag, 'crew'), 'open');
  ag.rep = 4;
  assert.equal(A.contractState(ag, 'crew'), 'locked');
  ag.rep = 6;
  ag.tech = [];
  assert.equal(A.contractState(ag, 'crew'), 'needsTech');
});

test('the Artemis II–like design fits the super heavy rocket and passes its checks', () => {
  const ag = crewAgency();
  const pl = A.plan(ag, design(ag), 'standard', 'standard');
  const c = okIds(A.checks(ag, pl));
  for (const id of ['lift', 'power', 'data']) assert.equal(c[id], 'ok', `${id} is ${c[id]}`);
  assert.equal(M.launcherFor(pl.design), 'superheavy');
  assert.ok(pl.launch.capacity < 27000 && pl.launch.capacity > 25000, 'the abort tower costs part of the 27 t');
  assert.ok(pl.launch.wet > 20000 && pl.launch.wet < 26520, `stack ${Math.round(pl.launch.wet)} kg, lighter than Orion (less propellant)`);
  assert.ok(pl.expected.headline, 'can earn the headline if nothing breaks');
  for (const ck of M.crewChecks(pl.design, pl.base)) assert.equal(ck.ok, 'ok', `crew check ${ck.id}`);
  // Robotic missions never get the crew rocket.
  assert.equal(M.launcherFor({ ...M.defaultDesign('mars', 'x'), launcher: 'superheavy' }), 'heavy');
});

test('every kilogram: maxing every safety option is too heavy for the rocket', () => {
  const ag = crewAgency();
  const pl = A.plan(ag, design(ag, { heatShield: 1750, lifeDays: 30, shelter: 600, margin: 30 }), 'standard', 'standard');
  assert.equal(okIds(A.checks(ag, pl)).lift, 'bad');
  // Dropping the abort tower frees lift (a dangerous trade the checks flag).
  const noLas = A.plan(ag, design(ag, { abort: 0 }), 'standard', 'standard');
  const las = A.plan(ag, design(ag), 'standard', 'standard');
  assert.ok(noLas.launch.capacity - las.launch.capacity > 1000);
  assert.equal(M.crewChecks(noLas.design, noLas.base).find((x) => x.id === 'abort').ok, 'bad');
});

test('a clean flight: TLI 388 m/s, splashdown after about 9 days, headline', () => {
  const r = fly({}, []);
  const c = r.score.crew;
  assert.equal(c.outcome, 'safe');
  assert.equal(c.tli.dv, 388);
  assert.ok(r.fs.scienceEndMs - r.timeline[0].ms < 10 * 864e5);
  assert.ok(r.score.headline);
  assert.ok(r.score.total >= 80 && r.score.total <= 100);
});

test('crew safety dominates: a rocket failure without an abort tower loses the crew', () => {
  const s = seedWhere(['ascent'], (c) => c.ascent.fails);
  const lost = fly({ abort: 0 }, ['ascent'], s);
  assert.equal(lost.score.crew.outcome, 'lost');
  assert.equal(lost.fs.lost, true);
  assert.equal(lost.score.total, 0);
  const saved = fly({ abort: 1 }, ['ascent'], s);
  assert.equal(saved.score.crew.outcome, 'aborted');
  assert.equal(saved.fs.lost, false);
  assert.ok(saved.score.total > 0 && saved.score.total < 70, 'crew safe, mission over, no headline');
});

test('heat shield physics: char loss on a skip entry burns through a thin shield', () => {
  const s = seedWhere(['heatShield'], (c) => c.entry.charLoss);
  assert.equal(fly({ heatShield: 1000, entry: 'skip' }, ['heatShield'], s).score.crew.outcome, 'lost');
  assert.equal(fly({ heatShield: 1350, entry: 'direct' }, ['heatShield'], s).score.crew.entry.burn, 'ok');
  assert.equal(fly({ heatShield: 1350, entry: 'skip' }, ['heatShield'], s).score.crew.entry.burn, 'scorched');
  // Skip entries are gentler on the crew, direct entries on the shield.
  const skip = fly({ entry: 'skip' }, []);
  const direct = fly({ entry: 'direct' }, []);
  assert.ok(skip.score.crew.entry.peakG < direct.score.crew.entry.peakG);
  assert.ok(M.shieldRatio(M.crewFields({ heatShield: 1350, entry: 'skip' })) < M.shieldRatio(M.crewFields({ heatShield: 1350, entry: 'direct' })));
});

test('life support: spare days decide whether a broken valve is an emergency', () => {
  const s = seedWhere(['lifeSupport'], (c) => c.life.fails);
  const short = fly({ lifeDays: 12 }, ['lifeSupport'], s).score.crew;
  const ok = fly({ lifeDays: 21 }, ['lifeSupport'], s).score.crew;
  assert.ok(short.life.emergency);
  assert.ok(!ok.life.emergency);
});

test('a propellant leak makes the entry steeper unless the fuel margin covers it', () => {
  const s = seedWhere(['propulsion'], (c) => c.tli.leak);
  assert.ok(fly({ margin: 0 }, ['propulsion'], s).score.crew.tli.steep);
  assert.ok(!fly({ margin: 20 }, ['propulsion'], s).score.crew.tli.steep);
});

test('the ride can only raise what the crew touched, once, before the results', () => {
  const r = fly({}, []);
  const p = { flight: { score: r.score }, result: null };
  const before = p.flight.score.total;
  assert.ok(O.crewApplyRide(p, { photos: 1 }));
  assert.ok(p.flight.score.total > before);
  assert.equal(p.flight.score.fractions.home, 1);
  assert.equal(O.crewApplyRide(p, { photos: 1 }), false, 'only once');
  const q = { flight: { score: fly({}, []).score }, result: null };
  const t0 = q.flight.score.total;
  O.crewApplyRide(q, { photos: 0 });
  assert.equal(q.flight.score.total, t0, 'a bad ride never lowers the score below the flight team’s');
});

test('same seed, same flight (what-ifs share the luck)', () => {
  const a = fly({}, ['lifeSupport', 'deploy'], 99).score;
  const b = fly({}, ['lifeSupport', 'deploy'], 99).score;
  assert.deepStrictEqual(a, b);
});

test('the agency flies a crew mission: launch, arrival, results within two months', () => {
  const ag = crewAgency(5);
  const r = A.approve(ag, design(ag), 'standard', 'standard');
  assert.ok(r.ok, r.text);
  const p = r.project;
  const seen = new Set();
  for (let i = 0; i < 60 && p.status !== 'done'; i++) {
    A.advance(ag).forEach((e) => {
      seen.add(e.type);
      if (e.type === 'review') {
        const qs = A.reviewQuestions(ag, e.project, e.review);
        A.resolveReview(ag, e.project, e.review, Object.fromEntries(qs.map((q) => [q.id, q.options[0].id])));
      }
      if (e.type === 'event') A.resolveEvent(ag, e.project, e.eventId, null);
    });
  }
  assert.equal(p.status, 'done');
  assert.ok(seen.has('launch') && seen.has('complete'));
  assert.ok(A.monthsBetween(p.launchMs, ag.now) <= 2, 'results the month after launch');
  assert.ok(p.result.score.crew, 'the crew report survives');
  const w = A.whatIf(p, { heatShield: 1750 });
  assert.ok(w.feasible);
  // Many seeds: a careful crew design almost always comes home.
  let home = 0;
  for (let s = 1; s <= 200; s++) {
    const d2 = Object.assign(M.defaultDesign('crew', 'T'), JSON.parse(JSON.stringify(PROVEN)));
    const ev = M.evaluate(d2);
    const fl = O.generateFlaws(d2, ev.base, s * 7919);
    const res = O.autoFlight(d2, ev, fl, s * 7919, {});
    if (!res.fs.lost) home++;
  }
  assert.ok(home >= 194, `crew home in ${home} of 200 untested flights`);
});

test('crew review questions follow the design', () => {
  const ag = crewAgency();
  const r = A.approve(ag, design(ag, { abort: 0, heatShield: 1000, entry: 'skip' }), 'standard', 'standard');
  const qs = M.crewReviewQuestions(r.project, 'CDR');
  const ids = qs.map((q) => q.id);
  assert.ok(ids.includes('crewAbort') && ids.includes('crewShield') && ids.includes('crewLife'));
  const shield = qs.find((q) => q.id === 'crewShield').options[0].mod.heatShield;
  assert.ok(D.OPTIONS.heatShield.some((o) => o.id === 1000 + shield), 'the fix lands on a real option');
});
