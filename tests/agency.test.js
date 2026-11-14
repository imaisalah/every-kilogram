// A bot plays a whole agency career to check the economy and progression.
const test = require('node:test');
const assert = require('node:assert');
require('../js/physics.js');
const D = require('../js/data.js');
require('../js/model.js');
require('../js/ops.js');
const A = require('../js/agency.js');

const PLANS = {
  nile: { instruments: ['hires', 'irspec'], arrays: 8, dish: 1, amp: 25, recorder: 256, launcher: 'light' },
  weather: { instruments: ['irspec', 'context'], arrays: 5, dish: 1, amp: 25, recorder: 64, launcher: 'light' },
  moon: { instruments: ['neutron', 'sounder', 'context'], arrays: 6, dish: 1, amp: 25, recorder: 256, launcher: 'light' },
  mars: { instruments: ['sounder', 'hires', 'neutron'], arrays: 6, dish: 3, amp: 100, recorder: 256, launcher: 'light', capture: 'aerobrake', margin: 20 },
  venus: { instruments: ['sar', 'irspec', 'uso'], arrays: 5, dish: 3, amp: 100, recorder: 1024, launcher: 'medium', capture: 'aerobrake', margin: 20 },
  jupiter: { instruments: ['iceRadar', 'mag', 'hires'], arrays: 70, dish: 3, amp: 100, recorder: 1024, launcher: 'heavy', shield: 75, ground: 12, margin: 20 },
};
const RESEARCH = ['dish3', 'amp100', 'aero', 'sar', 'rec1t', 'heavy', 'vault', 'iceRadar', 'cells', 'dual'];

function playCareer(seed, verbose) {
  const ag = A.newAgency('Bot Agency', seed);
  const timeline = [];
  let guard = 0;
  while (!A.isOver(ag) && guard++ < 200) {
    RESEARCH.forEach((t) => A.buyTech(ag, t));
    for (const key of Object.keys(PLANS)) {
      if (A.contractState(ag, key) !== 'open' || A.busyTeams(ag) >= ag.teams) continue;
      const d = Object.assign(A.newDesign(ag, key), PLANS[key]);
      A.applyTech(ag, d);
      const r = A.approve(ag, d, 'standard');
      if (r.ok && verbose) timeline.push(`${A.fmtMonth(ag.now)} approve ${key} launch ${A.fmtMonth(r.project.launchMs)} cost ${Math.round(r.project.buildCost + r.project.launcherCost)}`);
    }
    if (ag.teams < 3 && ag.money > 400) A.hireTeam(ag);
    const n = A.monthsToNextEvent(ag);
    for (let i = 0; i < n; i++) {
      A.advance(ag).forEach((e) => {
        if (e.type === 'review') {
          const qs = A.reviewQuestions(ag, e.project, e.review);
          const ans = Object.fromEntries(qs.map((q) => [q.id, q.options[0].id]));
          A.resolveReview(ag, e.project, e.review, ans);
        }
        if (e.type === 'event') A.resolveEvent(ag, e.project, e.eventId, null);
        if (verbose && e.type === 'complete') timeline.push(`${A.fmtMonth(ag.now)} ${e.project.missionKey} score ${Math.round(e.project.result.score.total)} lost=${e.project.result.lost} rep=${ag.rep} money=${Math.round(ag.money)} sci=${ag.science}`);
      });
    }
  }
  return { ag, timeline };
}

test('a sensible bot career reaches deep space and earns headlines', () => {
  const res = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    const { ag, timeline } = playCareer(seed * 1013, seed === 1);
    if (seed === 1) console.log(timeline.join('\n'));
    res.push({ seed, headlines: ag.headlines.length, money: Math.round(ag.money), rep: ag.rep, end: A.fmtMonth(ag.now) });
  }
  console.log(JSON.stringify(res));
  assert.ok(res.some((r) => r.headlines >= 1), 'at least one career earns a headline');
  assert.ok(res.every((r) => r.money > -500), 'no career ends deeply bankrupt');
});

test('checks flag an empty design', () => {
  const ag = A.newAgency('X', 9);
  const d = A.newDesign(ag, 'nile');
  const pl = A.plan(ag, d, 'basic');
  const c = A.checks(ag, pl);
  assert.equal(c.find((x) => x.id === 'science').ok, 'bad');
});
