// Mission review (js/team/mission-review.js), real space weather (js/team/real-data.js)
// and their Arabic (js/team/ar-review.js): logic that runs without a browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

globalThis.SMD = globalThis.SMD || {};
require('../js/team/data.js');
const sim = require('../js/team/sim.js');
require('../content/realMissions.js');
require('../js/team/real-data.js');
require('../js/team/mission-review.js');
require('../js/team/ar-review.js');
const R = SMD.team.review;
const RD = SMD.team.realData;
const AR = SMD.i18nDicts.ar;

const MISSIONS = ['nile', 'storms', 'moon', 'mars', 'venus', 'europa'];
const DIFFS = ['cadet', 'engineer', 'director', 'sandbox'];

test('four segments for every mission and difficulty, with a valid status and real text', () => {
  for (const m of MISSIONS) {
    for (const dfc of DIFFS) {
      const d = sim.newDesign(m, dfc);
      const f = sim.fly(d, 11);
      const segs = R.segments(sim, d, f.result, null);
      assert.deepEqual(segs.map((s) => s.id), ['launch', 'space', 'ground', 'user'], `${m}/${dfc}`);
      for (const s of segs) {
        assert.ok(['ok', 'warn', 'bad'].includes(s.status), `${m}/${dfc}/${s.id} status`);
        assert.ok(s.title && s.blurb && s.lines.length >= 2, `${m}/${dfc}/${s.id} text`);
        assert.ok(s.lines.every((l) => l.label && String(l.value).length), `${m}/${dfc}/${s.id} lines`);
      }
    }
  }
});

test('the user segment follows how the mission ended', () => {
  const d = sim.newDesign('mars', 'engineer');
  const mk = (success) => R.segments(sim, d, { success, science: 50, alive: true }, null).find((s) => s.id === 'user').status;
  assert.equal(mk('full'), 'ok');
  assert.equal(mk('partial'), 'warn');
  assert.equal(mk('fail'), 'bad');
});

test('CML-inspired game progress follows its simplified game checks', () => {
  const d = sim.newDesign('moon', 'engineer');
  const f = sim.fly(d, 11);
  assert.ok(R.cml(sim, d, f.result, 0).level >= 2, 'a launchable design is at least feasible');
  assert.equal(R.cml(sim, d, { ...f.result, success: 'fail' }, 1).level, 3, 'game progress uses its round counter, not a NASA trade-study assessment');
  // Break the hard launch check by choosing the smallest rocket for a heavy mission.
  const heavy = sim.newDesign('europa', 'engineer');
  const cat = sim.catalog('europa', 'engineer');
  const launchers = [].concat(...Object.values(cat.roles)).find((st) => st.key === 'launcher').options;
  const broken = launchers.map((o) => ({ ...heavy, picks: { ...heavy.picks, launcher: o.id } })).find((x) => sim.checks(x).some((c) => c.hard && !c.ok));
  if (broken) {
    const c = R.cml(sim, broken, sim.fly(broken, 11).result, 5);
    assert.equal(c.level, 1, 'cannot reach feasibility if the rocket cannot lift it');
    assert.ok(c.next && c.next.hint);
  }
  const levels = R.cml(sim, d, f.result, 0).levels;
  assert.equal(levels.length, 4);
  for (let i = 1; i < 4; i++) assert.ok(!levels[i].reached || levels[i - 1].reached, 'levels are reached in order');
});

test('every difficulty maps to a NASA Mission Design Lab study level', () => {
  const names = new Set(DIFFS.map((x) => R.mdl(x).name));
  assert.equal(names.size, 4);
  assert.ok(R.mdl('nonsense').name, 'unknown difficulty falls back');
});

test('every mission can be compared with a real NASA mission, with a source', () => {
  for (const m of MISSIONS) {
    const d = sim.newDesign(m, 'engineer');
    const c = R.realCompare(sim, d);
    assert.ok(c && c.name, m);
    assert.equal(c.rows.length, 3, m);
    assert.ok(/^https:\/\//.test(c.source), `${m} source`);
    assert.ok(/^https:\/\/eyes\.nasa\.gov/.test(c.eyes));
    assert.ok(c.rows.find((r) => r.id === 'mass').you.endsWith('kg'));
  }
});

test('the ConOps timeline lists the phases once and ends with the end of the mission', () => {
  const d = sim.newDesign('mars', 'engineer');
  const f = sim.fly(d, 11);
  const c = R.conops(f.events, f.result, null, null);
  const ids = c.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'no repeats');
  assert.ok(ids.includes('launch') && ids.includes('ops'));
  assert.equal(ids[ids.length - 1], 'end');
  assert.ok(R.conops(f.events, f.result, { x: 1 }, { y: 1 }).some((x) => x.id === 'surface'));
  assert.ok(R.conops(f.events, f.result, { x: 1 }, { y: 1 }).some((x) => x.id === 'ascent'));
  assert.equal(R.conops(undefined, undefined, null, null).length, 1, 'safe with nothing');
});

test('the learning check asks three different questions about what happened', () => {
  for (const m of MISSIONS) {
    const d = sim.newDesign(m, 'cadet');
    const f = sim.fly(d, 11);
    const qs = R.pickQuestions(sim, d, f.result, null);
    assert.equal(qs.length, 3, m);
    assert.equal(new Set(qs.map((q) => q.id)).size, 3, m);
    for (const q of qs) {
      assert.equal(q.options.length, 3);
      assert.ok(q.answer >= 0 && q.answer < 3);
      assert.ok(q.why);
    }
  }
  const all = R.bank();
  assert.ok(new Set(all.map((q) => q.ok)).size >= 3, 'the right answer is not always in the same place');
});

test('grading counts right answers', () => {
  const qs = [{ id: 'a', answer: 1 }, { id: 'b', answer: 0 }, { id: 'c', answer: 2 }];
  const g = R.grade(qs, [1, 1, 2]);
  assert.equal(g.correct, 2);
  assert.equal(g.total, 3);
});

test('the teacher CSV has a header, one row per flight and escapes text', () => {
  const csv = R.csvOf([{ when: '2026-11-14', mission: 'mars', difficulty: 'engineer', attempt: 2, score: 640, cml: 3, quiz_correct: 2, quiz_total: 3, questions: ['mass', 'dish'] }, { mission: 'a,"b"' }]);
  const lines = csv.split('\n');
  assert.equal(lines[0], R.CSV_HEAD.join(','));
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes('mars') && lines[1].endsWith('mass dish'));
  assert.ok(lines[2].includes('"a,""b"""'));
  assert.equal(R.csvOf(null).split('\n').length, 1);
});

test('real space weather: each event has a NASA source, the pick is deterministic', () => {
  assert.ok(RD.SPACE_WEATHER.length >= 3);
  for (const ev of RD.SPACE_WEATHER) {
    assert.ok(/^https:\/\/science\.nasa\.gov\//.test(ev.source), ev.id);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(ev.date), ev.id);
    assert.ok(ev.title && ev.text && ev.lesson && ev.sourceName, ev.id);
  }
  assert.equal(RD.spaceWeatherFor('seed:c0').id, RD.spaceWeatherFor('seed:c0').id);
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(RD.spaceWeatherFor(`s${i}:c1`).id);
  assert.ok(seen.size >= 2, 'different rounds meet different events');
});

test('DONKI flare ranking picks the strongest class and ignores junk', () => {
  const best = RD.pickStrongest([{ classType: 'C2.1' }, { classType: 'M1.4' }, { classType: 'X1.2' }, { classType: 'X0.9' }, { classType: 'junk' }, null]);
  assert.equal(best.classType, 'X1.2');
  assert.equal(RD.pickStrongest([]), null);
  assert.equal(RD.pickStrongest('nope'), null);
  assert.ok(RD.flareRank('M5') > RD.flareRank('C9.9'));
});

test('the live lookup never throws or hangs the game when the network fails', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error('offline'));
  try {
    assert.equal(await RD.liveRecentFlare({ timeoutMs: 50 }), null);
    globalThis.fetch = async () => ({ ok: false });
    assert.equal(await RD.liveRecentFlare({ timeoutMs: 50 }), null);
    globalThis.fetch = async () => ({ ok: true, json: async () => [{ classType: 'M2.0', peakTime: '2026-11-01T10:00Z', flrID: 'x' }] });
    const f = await RD.liveRecentFlare({ timeoutMs: 50 });
    assert.equal(f.classType, 'M2.0');
  } finally {
    globalThis.fetch = saved;
  }
});

test('every string key used by the review code and the real-event line has Arabic', () => {
  const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const keys = new Set();
  for (const f of ['js/team/mission-review.js', 'js/team/view-debrief.js', 'js/team/view-flight.js']) {
    for (const m of read(f).matchAll(/t\('((?:team\.rev|team\.flight\.real)[\w.]*)'/gi)) keys.add(m[1]);
    for (const m of read(f).matchAll(/T\('(team\.rev[\w.]*)'/g)) keys.add(m[1]);
  }
  for (const ev of RD.SPACE_WEATHER) {
    keys.add(`team.rd.${ev.id}.title`);
    keys.add(`team.rd.${ev.id}.lesson`);
  }
  assert.ok(keys.size > 80, `found ${keys.size} keys`);
  const missing = [...keys].filter((k) => !AR[k]);
  assert.deepEqual(missing, [], 'missing Arabic');
  for (const k of keys) assert.ok(/[\u0600-\u06FF]/.test(AR[k]), `${k} is Arabic`);
});
