// Flight/debrief view logic that can be checked without a browser.
const test = require('node:test');
const assert = require('node:assert/strict');

globalThis.SMD = globalThis.SMD || {};
require('../js/team/view-flight.js');
require('../js/team/view-debrief.js');
const logic = SMD.team.flightLogic;
const deb = SMD.team.debriefLogic;

const frames = (pattern) => pattern.map((sunlit, i) => ({ t: i / 6, sunlit, inPass: false, phase: 'ops', battery: 0.8, buffer: 0.1, downlink: 0, science: i, fuel: 1, alive: true }));

test('orbit angle crosses the shadow exactly when frames say eclipse', () => {
  // 8 sunlit, 4 dark, repeated: the middle of each dark run is half an orbit from the Sun.
  const pattern = [];
  for (let k = 0; k < 6; k++) pattern.push(...new Array(8).fill(true), ...new Array(4).fill(false));
  const beta = Math.PI / 6;
  const ph = logic.buildPhases(frames(pattern), beta);
  for (let i = 0; i < pattern.length; i++) {
    const a = ((ph[i] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const inShadow = Math.abs(a - Math.PI) < beta + 1e-6;
    assert.equal(inShadow, !pattern[i], `frame ${i}: angle ${a.toFixed(2)} sunlit ${pattern[i]}`);
  }
});

test('phases are monotonic so the craft never moves backwards', () => {
  const pattern = [];
  for (let k = 0; k < 4; k++) pattern.push(...new Array(9).fill(true), ...new Array(3).fill(false));
  const ph = logic.buildPhases(frames(pattern), 0.5);
  for (let i = 1; i < ph.length; i++) assert.ok(ph[i] > ph[i - 1], `frame ${i}`);
});

test('contact windows follow the inPass flag', () => {
  const f = frames(new Array(20).fill(true));
  [4, 5, 6, 12].forEach((i) => (f[i].inPass = true));
  const w = logic.contactWindows(f, f.map((_, i) => i * 0.1));
  assert.equal(w.length, 2);
  assert.deepEqual([w[0].a, w[0].b, w[1].a], [4, 6, 12]);
});

test('endings match how the craft died', () => {
  assert.equal(logic.endingOf({ result: { alive: true } }), 'success');
  assert.equal(logic.endingOf({ result: { alive: false, cause: 'drag' } }), 'burnup');
  assert.equal(logic.endingOf({ result: { alive: false, cause: 'breakup' } }), 'breakup');
  assert.equal(logic.endingOf({ result: { alive: false, cause: 'power' } }), 'tumble');
});

test('highlights read per-astronaut stats, else crew totals', () => {
  const crew = deb.highlights({ perPlayer: [{ name: 'Lina', role: 'planner', kills: 3, revives: 1 }, { name: 'Omar', role: 'comms', kills: 9, dropped: 2 }] });
  assert.equal(crew.find((h) => h.id === 'kills').who, 'Omar');
  assert.equal(crew.find((h) => h.id === 'dropped').who, 'Omar');
  const totals = deb.highlights({ items: { weapons: { cutter: { kills: 5 } }, turretKills: 2 }, crew: { revives: 3, downs: 1 }, samples: { jettisoned: 2 } });
  assert.equal(totals.find((h) => h.id === 'kills').value, '7');
  assert.equal(totals.find((h) => h.id === 'dropped').value, '2');
});

test('score reader accepts the sim shape', () => {
  const s = { total: 700, science: 300, efficiency: 150, survival: 150, teamwork: 100, medal: 'silver', medalTitle: 'Silver' };
  assert.equal(deb.totalOf(s), 700);
  assert.equal(deb.axesOf(s).find((a) => a.id === 'science').value, 300);
  assert.equal(deb.medalsOf(s)[0].name, 'Silver');
});

test('the cabin lineup reads the room players (roles, crew ids, me)', () => {
  require('../js/team/crew.js');
  const cabin = SMD.team.cabin;
  const ctx = { view: { me: { id: 'p1' }, players: [{ id: 'p1', name: 'Lina', roles: ['scientist'] }, { id: 'b1', name: 'Salma', bot: true, roles: ['planner', 'engineer'] }, { id: 'p2', name: 'Omar', crewId: 'jonas' }] } };
  const lu = cabin.lineup(ctx);
  assert.deepEqual(lu.map((r) => r.member.id), ['salma', 'mateo', 'priya', 'jonas']);
  assert.equal(lu.find((r) => r.you).member.id, 'priya');
  assert.equal(lu.find((r) => r.member.id === 'jonas').player, 'Omar');
  assert.equal(lu.find((r) => r.member.id === 'salma').player, '', 'bots are not named as players');
  assert.equal(cabin.lineup({ view: {} }).length, 4, 'nobody known: the whole crew still flies');
});

test('attachKit mounts one piece of the shared chrome and cleans it up', () => {
  const calls = [];
  const saved = SMD.team.kit;
  SMD.team.kit = {
    tracker: () => calls.push('tracker'),
    pauseMenu: (el, arg) => {
      calls.push('pause:' + arg.stage);
      return { cleanup: () => calls.push('off') };
    },
  };
  const off = logic.attachKit({}, 'flight', {});
  off();
  assert.deepEqual(calls, ['pause:flight', 'off']);
  SMD.team.kit = { tracker: { mount: () => () => calls.push('t-off') } };
  logic.attachKit({}, 'debrief', {})();
  assert.equal(calls[calls.length - 1], 't-off');
  SMD.team.kit = {
    pauseMenu: () => {
      throw new Error('boom');
    },
  };
  assert.doesNotThrow(() => logic.attachKit({}, 'cabin', {})());
  SMD.team.kit = saved;
});
