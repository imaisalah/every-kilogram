// Balance guard rails: bots play whole careers (tools/career-sim.cjs) and the
// numbers in js/data.js must keep the career inside the targets in docs/BALANCE.md.
const test = require('node:test');
const assert = require('node:assert');
const sim = require('../tools/career-sim.cjs');
const D = require('../js/data.js');
const A = require('../js/agency.js');

const seeds = (n) => Array.from({ length: n }, (_, i) => ((i + 1) * 2654435761) >>> 0);
const okIds = (checks) => Object.fromEntries(checks.map((c) => [c.id, c.ok]));

// The "Load a proven design" set, as recommended in docs/BALANCE.md.
const PROVEN = {
  ...sim.PROVEN,
  jupiter: { instruments: ['iceRadar', 'mag', 'context'], arrays: 60, dish: 3, amp: 100, recorder: 256, launcher: 'heavy', shield: 75, ground: 12, margin: 10, route: 'direct' },
};
const NEEDS = { nile: [], weather: [], moon: [], mars: ['dish3', 'amp100', 'aero'], venus: ['sar', 'dish3', 'amp100', 'aero', 'rec1t'], jupiter: ['vault', 'iceRadar', 'heavy', 'dish3', 'amp100'] };

function agencyAt(year, tech) {
  const ag = A.newAgency('Test', 7);
  ag.now = Date.UTC(year, 0, 1);
  ag.tech = tech.slice();
  ag.money = 900;
  ag.rep = 5;
  return ag;
}

test('proven designs pass the key checks once their research is done', () => {
  for (const [key, pv] of Object.entries(PROVEN)) {
    const ag = agencyAt(key === 'jupiter' ? 2030 : 2029, NEEDS[key]);
    const d = A.applyTech(ag, Object.assign(A.newDesign(ag, key), JSON.parse(JSON.stringify(pv))));
    const tp = key === 'jupiter' ? 'thorough' : 'standard';
    const c = okIds(A.checks(ag, A.plan(ag, d, tp, 'standard')));
    for (const id of ['science', 'lift', 'power', 'data']) assert.equal(c[id], 'ok', `${key} ${id} is ${c[id]}`);
    assert.notEqual(c.window, 'bad', `${key} launch window`);
    assert.notEqual(c.risk, 'bad', `${key} reliability`);
  }
});

test('Venus: the imaging radar is power hungry, so small panels fail', () => {
  const ag = agencyAt(2030, NEEDS.venus);
  const power = (arrays) => {
    const d = A.applyTech(ag, Object.assign(A.newDesign(ag, 'venus'), PROVEN.venus, { arrays }));
    return okIds(A.checks(ag, A.plan(ag, d, 'standard', 'standard'))).power;
  };
  assert.equal(power(3), 'bad');
  assert.equal(power(5), 'ok');
  // Without the radar the same small panels are plenty.
  const d = A.applyTech(ag, Object.assign(A.newDesign(ag, 'venus'), PROVEN.venus, { arrays: 3, instruments: ['irspec', 'uso'] }));
  assert.equal(okIds(A.checks(ag, A.plan(ag, d, 'standard', 'standard'))).power, 'ok');
});

test('Europa: the slow gravity-assist route started after 2030 cannot finish in time', () => {
  const ag = agencyAt(2031, NEEDS.jupiter);
  const ega = A.applyTech(ag, Object.assign(A.newDesign(ag, 'jupiter'), PROVEN.jupiter, { route: 'ega' }));
  assert.equal(okIds(A.checks(ag, A.plan(ag, ega, 'standard', 'standard'))).window, 'bad');
  const direct = A.applyTech(ag, Object.assign(A.newDesign(ag, 'jupiter'), PROVEN.jupiter));
  assert.notEqual(okIds(A.checks(ag, A.plan(ag, direct, 'standard', 'standard'))).window, 'bad');
  // No vault research, no Europa.
  assert.equal(A.contractState(agencyAt(2031, ['iceRadar', 'heavy']), 'jupiter'), 'needsTech');
});

test('the budget check counts what other projects still owe', () => {
  const ag = A.newAgency('Test', 3);
  const start = (key) => {
    const d = A.applyTech(ag, Object.assign(A.newDesign(ag, key), PROVEN[key]));
    return okIds(A.checks(ag, A.plan(ag, d, 'standard', 'standard'))).money;
  };
  assert.equal(start('nile'), 'ok');
  ag.teams = 3;
  assert.ok(A.approve(ag, A.applyTech(ag, Object.assign(A.newDesign(ag, 'nile'), PROVEN.nile)), 'standard', 'standard').ok);
  assert.ok(A.approve(ag, A.applyTech(ag, Object.assign(A.newDesign(ag, 'moon'), PROVEN.moon)), 'standard', 'standard').ok);
  assert.equal(start('weather'), 'bad', 'a third mission in year one is beyond the budget');
});

test('a careful player: first launch within 15 months, headlines, tight early money', () => {
  const runs = seeds(3).map((s) => sim.playCareer('careful', s));
  for (const r of runs) {
    assert.ok(r.firstLaunch !== null && r.firstLaunch <= 15, `first launch in month ${r.firstLaunch}`);
    assert.ok(r.firstResult <= 20, `first result in month ${r.firstResult}`);
    assert.ok(r.headlines.length >= 1, 'at least one headline');
    assert.ok(r.minMoney > -60, `money dipped to ${Math.round(r.minMoney)}`);
    assert.ok(r.moneyByYear[2028] < 400, `money is tight in year 2 (${r.moneyByYear[2028]})`);
  }
  const mean = runs.reduce((s, r) => s + r.headlines.length, 0) / runs.length;
  assert.ok(mean >= 1.5, `careful mean headlines ${mean}`);
  // Research is scarce: a careful agency cannot own every technology by 2031.
  const total = D.TECH.reduce((s, t) => s + t.cost, 0);
  for (const r of runs) assert.ok(r.ag.tech.length < D.TECH.length || total > 300, 'not everything is affordable');
});

test('a greedy player gets fewer headlines and sees failures', () => {
  const greedy = seeds(3).map((s) => sim.playCareer('greedy', s));
  const careful = seeds(3).map((s) => sim.playCareer('careful', s));
  const h = (runs) => runs.reduce((s, r) => s + r.headlines.length, 0);
  assert.ok(h(greedy) < h(careful), `greedy ${h(greedy)} vs careful ${h(careful)}`);
  const weak = greedy.flatMap((r) => r.results).filter((x) => ['mars', 'venus', 'jupiter'].includes(x.key) && !x.headline);
  assert.ok(weak.length >= 2, 'greedy flies some headline missions that fall short');
});

test('a missed planetary window costs storage and reputation, not the mission', () => {
  const ag = A.newAgency('Test', 5);
  ag.now = Date.UTC(2029, 3, 1);
  ag.tech = NEEDS.mars.slice();
  ag.rep = 3;
  ag.money = 900;
  const d = A.applyTech(ag, Object.assign(A.newDesign(ag, 'mars'), PROVEN.mars));
  const r = A.approve(ag, d, 'standard', 'standard');
  assert.ok(r.ok);
  const p = r.project;
  const before = p.launchMs;
  const money = ag.money;
  // An event choice that slips the schedule by eight months (public path).
  const SMD = globalThis.SMD;
  SMD.content.events = SMD.content.events.concat([{ id: 'test-slip', phase: 'C', choices: [{ id: 'slip', label: 'Slip', effects: { months: 8 } }] }]);
  p.events.push({ id: 'test-slip', phase: 'C', atMs: ag.now, resolved: false });
  A.resolveEvent(ag, p, 'test-slip', 'slip');
  assert.ok(p.launchMs - before > 300 * 864e5, 'the launch moved to a later window');
  assert.ok(p.missedWindow);
  assert.equal(ag.rep, 2, 'reputation −1');
  assert.ok(ag.money < money - 30, 'storage was paid');
  assert.equal(p.status, 'dev', 'the mission is still alive');
});
