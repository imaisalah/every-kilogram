// The room state machine, with a stand-in simulation and a hand-driven clock.
const test = require('node:test');
const assert = require('node:assert');
const Room = require('../js/team/room.js');
const { ROLES, stubSim } = require('./team-fixture.js');

Room.useSim(stubSim);

const TIMING = { briefMs: 1000, designMs: 5000, lockMs: 1000, armMs: 100, flightMs: 10000, fixedFlight: true, flightHoldMs: 0, landingMs: 500, surfaceMaxMs: 3000, ascentMs: 500, graceMs: 1000, crisisMs: 800, requestMs: 700, botRequestMinMs: 100, botRequestMaxMs: 200 };

function setup(n, opts = {}) {
  let s = Room.create({ mode: 'phones', code: 'ABCD', seed: 7, scenarioId: 'moon', timing: TIMING, ...opts });
  const ids = [];
  for (let i = 0; i < n; i++) {
    s = Room.reduce(s, { type: 'join', name: `P${i}`, token: `tok${i}`, by: 'host' }, 0);
    assert.ok(s.last.ok, s.last.text);
    ids.push(s.last.playerId);
  }
  return { s, ids };
}

const act = (s, by, type, extra, now = s.now) => Room.reduce(s, { type, by, ...extra }, now);

function toDesign(n = 4, opts) {
  const made = setup(n, opts);
  let s = act(made.s, 'host', 'start');
  assert.strictEqual(s.phase, 'brief');
  s = Room.tick(s, 2000);
  assert.strictEqual(s.phase, 'questions');
  s = act(s, made.ids[0], 'forward');
  assert.strictEqual(s.phase, 'design');
  return { s, ids: made.ids };
}

function voteAll(s, ids) {
  for (const id of ids) s = act(s, id, 'vote', { yes: true });
  return s;
}

function toFlight(n = 4, opts) {
  const made = toDesign(n, opts);
  let s = voteAll(made.s, made.ids);
  assert.strictEqual(s.phase, 'lock');
  assert.ok(s.armedAt);
  s = Room.tick(s, s.armedAt + 1);
  assert.strictEqual(s.phase, 'flight');
  return { s, ids: made.ids };
}

function advanceTo(s, ms) {
  return Room.tick(s, ms);
}

function activeCrisis(s) {
  return s.crises.find((c) => c.status === 'active');
}

test('players join, names stay unique, the fifth is turned away', () => {
  let { s, ids } = setup(3);
  s = act(s, 'host', 'join', { name: 'p0', token: 'x1' });
  assert.ok(s.last.ok);
  assert.strictEqual(s.players[3].name, 'p0 2', 'duplicate names get a suffix, any case');
  ids = s.players.map((p) => p.id);
  s = act(s, 'host', 'join', { name: 'Zed', token: 'x2' });
  assert.strictEqual(s.last.ok, false);
  assert.strictEqual(s.last.code, 'room-full');
  assert.strictEqual(s.players.length, 4);
  assert.ok(ids.length === 4);
});

test('a name cannot smuggle markup or run on forever', () => {
  let { s } = setup(0);
  s = act(s, 'host', 'join', { name: '<img src=x onerror=1>' + 'a'.repeat(50), token: 'n' });
  assert.ok(!/[<>]/.test(s.players[0].name));
  assert.ok(s.players[0].name.length <= 16);
});

test('with fewer than four players the roles are shared out', () => {
  for (const [n, counts] of [
    [2, [2, 2]],
    [3, [2, 1, 1]],
  ]) {
    const { s, ids } = setup(n);
    assert.ok(ROLES.every((r) => s.roles[r]), 'every role has an owner');
    assert.deepStrictEqual(ids.map((id) => ROLES.filter((r) => s.roles[r] === id).length).sort().reverse(), counts);
  }
});

test('a chosen role is respected, and teams need two people', () => {
  let { s, ids } = setup(1);
  s = act(s, 'host', 'start');
  assert.strictEqual(s.last.code, 'need-players');
  s = act(s, 'host', 'join', { name: 'B', token: 'b' });
  const b = s.last.playerId;
  s = act(s, b, 'setRole', { role: 'scientist' });
  assert.strictEqual(s.roles.scientist, b);
  s = act(s, ids[0], 'setRole', { role: 'scientist' });
  assert.strictEqual(s.roles.scientist, ids[0], 'the last to ask gets it');
  assert.ok(ROLES.filter((r) => s.roles[r] === b).length > 0, 'the other player still has work');
});

test('phones cannot perform host actions or pose as someone else', () => {
  const { s, ids } = toDesign();
  for (const type of ['start', 'next', 'refly', 'kick', 'surfaceDone']) {
    const r = act(s, ids[0], type);
    assert.strictEqual(r.last.code, 'host-only', type);
    assert.strictEqual(r.phase, s.phase);
  }
  const planner = s.roles.planner;
  const r = act(s, s.roles.engineer, 'set', { role: 'planner', key: 'launcher', value: 'tiny' });
  assert.strictEqual(r.last.code, 'not-your-role');
  assert.strictEqual(r.design.launcher, 'falcon');
  assert.notStrictEqual(planner, s.roles.engineer);
});

test('brief leads to a pre-build success criterion, then spacecraft design', () => {
  let { s, ids } = setup(2);
  s = act(s, 'host', 'start');
  s = Room.tick(s, 2000);
  assert.strictEqual(s.phase, 'questions');
  s = act(s, ids[0], 'pick', { requirement: 'wide' });
  s = act(s, ids[0], 'forward');
  assert.strictEqual(s.phase, 'design');
  assert.strictEqual(s.design.requirement, 'wide');
});

test('a configured design clock is authoritative (older rooms and tests)', () => {
  const { s } = toDesign();
  const v = Room.viewFor(s, s.players[0].id, s.phaseEndsAt - 2500);
  assert.strictEqual(v.clock.leftS, 3);
  const later = Room.tick(s, s.phaseEndsAt + 1);
  assert.strictEqual(later.phase, 'lock');
});

test('by default there is no clock: not in the briefing, the build, or the review', () => {
  for (const difficulty of ['cadet', 'engineer']) {
    let s = Room.create({ mode: 'solo', seed: 3, scenarioId: 'moon', difficulty });
    s = act(s, 'local', 'start', {}, 10);
    assert.strictEqual(s.phase, 'brief');
    s = Room.tick(s, 10 * 60 * 1000);
    assert.strictEqual(s.phase, 'brief', 'the briefing has no default timer');
    s = act(s, 'local', 'next', {}, s.now + 5);
    assert.strictEqual(s.phase, 'questions', 'the criterion choice follows the briefing');
    s = act(s, 'local', 'pick', { requirement: s.requirementId }, s.now + 5);
    s = act(s, 'local', 'next', {}, s.now + 5);
    assert.strictEqual(s.phase, 'design');
    assert.strictEqual(Room.viewFor(s, 'local').clock, null);
    assert.strictEqual(Room.tick(s, 60 * 60 * 1000).phase, 'design', 'the build waits');
  }
});

test('Flight director gets a soft clock that only says overtime', () => {
  let s = Room.create({ mode: 'solo', seed: 3, scenarioId: 'moon', difficulty: 'director' });
  s = act(s, 'local', 'start', {}, 0);
  s = act(s, 'local', 'next', {}, 0);
  s = act(s, 'local', 'next', {}, 0);
  const v = Room.viewFor(s, 'local', 1000);
  assert.ok(v.clock && v.clock.soft && v.clock.leftS > 60);
  const late = Room.tick(s, 60 * 60 * 1000);
  assert.strictEqual(late.phase, 'design', 'never takes the controls away');
  assert.ok(Room.viewFor(late, 'local', 60 * 60 * 1000).clock.overtime);
});

test('changing the design moves the numbers and clears the votes', () => {
  let { s, ids } = toDesign();
  const engineer = s.roles.engineer;
  s = act(s, ids[0], 'vote', { yes: true });
  assert.ok(Object.keys(s.votes).length);
  const before = s.resources.power.value;
  s = act(s, engineer, 'set', { role: 'engineer', key: 'solar', value: 'big' });
  assert.ok(s.last.ok);
  assert.notStrictEqual(s.resources.power.value, before);
  assert.deepStrictEqual(s.votes, {});
});

test('a launch the rocket cannot lift is blocked with the reason', () => {
  let { s, ids } = toDesign();
  s = act(s, s.roles.planner, 'set', { role: 'planner', key: 'launcher', value: 'tiny' });
  const r = act(s, ids[0], 'vote', { yes: true });
  assert.strictEqual(r.last.code, 'hard-check');
  assert.match(r.last.text, /cannot lift/);
  assert.strictEqual(r.errors[ids[0]].code, 'hard-check');
  let t = Room.tick(s, s.phaseEndsAt + 1);
  assert.strictEqual(t.phase, 'lock');
  t = Room.tick(t, t.phaseEndsAt + 1);
  assert.strictEqual(t.phase, 'lock', 'a hard failure never launches');
  assert.ok(Room.viewFor(t, ids[0]).clock.overtime);
  t = act(t, t.roles.planner, 'set', { role: 'planner', key: 'launcher', value: 'falcon' }, t.now);
  assert.ok(t.phaseEndsAt > t.now, 'fixing it restarts the lock clock');
  t = voteAll(t, ids);
  t = Room.tick(t, t.armedAt + 1);
  assert.strictEqual(t.phase, 'flight');
});

test('a soft problem may fly and fail; the clock launches it', () => {
  const { s } = toDesign();
  let t = Room.tick(s, s.phaseEndsAt + 1);
  t = Room.tick(t, t.phaseEndsAt + 1);
  assert.strictEqual(t.phase, 'flight');
});

test('withdrawing a vote, or changing the design, disarms the countdown', () => {
  const { s, ids } = toDesign();
  const armed = voteAll(s, ids);
  assert.ok(armed.armedAt);
  const off = act(armed, ids[0], 'vote', { yes: false });
  assert.strictEqual(off.armedAt, 0);
  const t = Room.tick(off, armed.armedAt + 1);
  assert.strictEqual(t.phase, 'lock', 'not launched');
  const changed = act(armed, armed.roles.comms, 'set', { role: 'comms', key: 'antenna', value: 'high' });
  assert.strictEqual(changed.armedAt, 0);
});

test('requests reach the right role, count when answered, expire when ignored', () => {
  let { s } = toDesign();
  const sci = s.roles.scientist;
  const eng = s.roles.engineer;
  s = act(s, sci, 'request', { to: 'engineer', preset: 'need-power' });
  assert.ok(s.last.ok);
  let v = Room.viewFor(s, eng);
  assert.strictEqual(v.inbox.length, 1);
  assert.strictEqual(Room.viewFor(s, sci).inbox.length, 0);
  assert.strictEqual(act(s, sci, 'answer', { requestId: v.inbox[0].id }).last.code, 'not-your-role');
  s = act(s, eng, 'answer', { requestId: v.inbox[0].id, reply: 'ok' });
  assert.strictEqual(s.stats.requestsAnswered, 1);
  assert.strictEqual(act(s, sci, 'request', { to: 'engineer', preset: 'nonsense' }).last.code, 'bad-preset');
  s = act(s, sci, 'request', { to: 'comms', preset: 'more-downlink' });
  s = Room.tick(s, s.now + 800);
  assert.strictEqual(s.requests[1].status, 'expired');
  assert.strictEqual(s.stats.requestsSent, 2);
  assert.strictEqual(s.stats.requestsAnswered, 1);
});

test('a player never sees another player’s agenda, until the debrief', () => {
  const { s, ids } = toDesign();
  for (const id of ids) {
    const v = Room.viewFor(s, id);
    const mine = ROLES.filter((r) => s.roles[r] === id);
    assert.deepStrictEqual(Object.keys(v.me.agendas).sort(), mine.slice().sort());
    const text = JSON.stringify(v);
    for (const r of ROLES) if (!mine.includes(r)) assert.ok(!text.includes(`secret goal of ${r}`), `${id} saw ${r}`);
  }
  const spectator = JSON.stringify(Room.viewFor(s, null));
  assert.ok(!spectator.includes('secret goal'), 'the shared screen is public');
  assert.strictEqual(Room.viewFor(s, null).me, null);
});

test('no view ever contains a token', () => {
  const { s, ids } = toDesign();
  for (const id of [...ids, null]) assert.ok(!JSON.stringify(Room.viewFor(s, id)).includes('tok'), String(id));
});

test('catalog: a phone only gets its own roles', () => {
  const { s } = toDesign();
  const v = Room.viewFor(s, s.roles.comms);
  assert.deepStrictEqual(Object.keys(v.catalog.roles), ['comms']);
  assert.deepStrictEqual(Object.keys(Room.viewFor(s, null).catalog.roles).sort(), ROLES.slice().sort());
});

test('crisis: the alarm and the fix are on different phones and hidden from each other', () => {
  const { s } = toFlight();
  const c0 = s.crises[0];
  let t = advanceTo(s, s.flight.startedAt + c0.at + 1);
  const c = activeCrisis(t);
  assert.ok(c, 'crisis went active');
  assert.notStrictEqual(c.alarmTo, c.fixTo);
  const alarm = Room.viewFor(t, c.alarmTo).crises[0];
  assert.ok(alarm.alarm.text, 'alarm holder gets the alarm');
  assert.strictEqual(alarm.fix, undefined, 'alarm holder does not get the controls');
  const fix = Room.viewFor(t, c.fixTo).crises[0];
  assert.strictEqual(fix.alarm, undefined, 'fix holder does not get the alarm');
  assert.ok(fix.fix.options.length >= 3, 'real control plus decoys');
  assert.ok(fix.fix.options.every((o) => o.correct === undefined), 'nothing says which is right');
  const shared = Room.viewFor(t, null).crises[0];
  assert.strictEqual(shared.fix, undefined);
  assert.strictEqual(shared.fixes, undefined);
  const bystander = t.players.find((p) => p.id !== c.alarmTo && p.id !== c.fixTo);
  const seen = JSON.stringify(Room.viewFor(t, bystander.id).crises);
  assert.ok(!seen.includes('low gain'), 'bystander sees neither');
});

test('crisis: only the fixer can act, wrong buttons count, the right one fixes it', () => {
  const { s } = toFlight();
  let t = advanceTo(s, s.flight.startedAt + s.crises[0].at + 1);
  const c = activeCrisis(t);
  const correct = c.options.find((o) => o.correct);
  const wrong = c.options.find((o) => !o.correct);
  assert.strictEqual(act(t, c.alarmTo, 'crisisAct', { crisisId: c.id, optionId: correct.id }).last.code, 'not-your-fix');
  t = act(t, c.fixTo, 'crisisAct', { crisisId: c.id, optionId: wrong.id });
  assert.strictEqual(t.stats.wrongPresses, 1);
  assert.strictEqual(activeCrisis(t).status, 'active');
  t = act(t, c.fixTo, 'crisisAct', { crisisId: c.id, fix: correct.id });
  assert.strictEqual(t.crises.find((x) => x.id === c.id).status, 'fixed');
  assert.strictEqual(t.stats.crisesFixed, 1);
  assert.strictEqual(t.outcomes[c.key], 'fixed', 'the outcome reaches the simulation');
  assert.ok(t.run.result.outcomes, 'and the flight was flown again with it');
});

test('crisis: ignored, it is missed', () => {
  const { s } = toFlight();
  let t = advanceTo(s, s.flight.startedAt + s.crises[0].at + 1);
  const c = activeCrisis(t);
  t = Room.tick(t, c.endsAt + 1);
  assert.strictEqual(t.crises.find((x) => x.id === c.id).status, 'missed');
  assert.strictEqual(t.stats.crisesMissed, 1);
  assert.strictEqual(t.outcomes[c.key], 'missed');
});

test('with two players one still holds the alarm and the other the fix', () => {
  const { s, ids } = toFlight(2);
  // Make one person hold both roles of the first crisis.
  const forced = { ...s, roles: { ...s.roles, planner: ids[0], comms: ids[0] } };
  const t = Room.tick(forced, s.flight.startedAt + s.crises[0].at + 1);
  const c = activeCrisis(t);
  assert.strictEqual(c.alarmTo, ids[0]);
  assert.strictEqual(c.fixTo, ids[1]);
});

function finishFlight(s) {
  return act(s, 'host', 'next', {}, s.now);
}

test('moon round: flight -> landing -> surface -> ascent -> debrief', () => {
  const { s } = toFlight();
  let t = finishFlight(s);
  assert.strictEqual(t.phase, 'landing');
  assert.strictEqual(t.surface.roster.length, 4);
  assert.ok(t.surface.roster.every((a) => !a.bot));
  t = Room.tick(t, t.phaseEndsAt + 1);
  assert.strictEqual(t.phase, 'surface');
  const summary = { samples: [{ id: 'ice1', kg: 12 }, { id: 'ice2', kg: 8 }], crewAlive: true };
  assert.strictEqual(act(t, t.players[0].id, 'surfaceDone', { summary }).last.code, 'host-only');
  t = act(t, 'host', 'surfaceDone', { summary });
  assert.strictEqual(t.phase, 'ascent');
  t = act(t, t.players[0].id, 'ascentDrop', { id: 'ice2', drop: true });
  assert.ok(t.ascent.dropped.ice2);
  t = act(t, 'host', 'ascentDone', { result: { lifted: true } });
  assert.strictEqual(t.phase, 'debrief');
  assert.strictEqual(t.debrief.surface, summary);
  assert.deepStrictEqual(t.debrief.ascent, { lifted: true });
  assert.strictEqual(t.debrief.chain[0].surface, summary, 'chain gets the surface summary');
});

test('the timers carry an unattended round all the way to the debrief', () => {
  const { s } = toFlight();
  let t = s;
  for (let now = s.now; t.phase === 'flight' && now < s.now + 20000; now += 100) t = Room.tick(t, now);
  assert.strictEqual(t.phase, 'landing');
  t = Room.tick(t, t.phaseEndsAt + 1);
  assert.strictEqual(t.phase, 'surface');
  t = Room.tick(t, t.phaseEndsAt + 1);
  assert.strictEqual(t.phase, 'ascent');
  t = Room.tick(t, t.phaseEndsAt + 1);
  assert.strictEqual(t.phase, 'debrief');
});

test('a crew lost on the surface skips the ascent', () => {
  const { s } = toFlight();
  let t = finishFlight(s);
  t = act(t, 'host', 'landingDone');
  t = act(t, 'host', 'surfaceDone', { summary: { crewAlive: false } });
  assert.strictEqual(t.phase, 'debrief');
});

test('Earth scenarios are training flights: straight to the debrief', () => {
  const { s } = toFlight(4, { scenarioId: 'nile' });
  assert.strictEqual(Room.hasSurface(s), false);
  assert.strictEqual(finishFlight(s).phase, 'debrief');
});

test('a mission that dies in flight skips the surface', () => {
  const { s } = toFlight();
  const dead = { ...s, run: { ...s.run, result: { alive: false, cause: 'boom' } } };
  assert.strictEqual(finishFlight(dead).phase, 'debrief');
});

test('debrief: every agenda is revealed and team stats are scored', () => {
  const { s } = toFlight(4, { scenarioId: 'nile' });
  const t = finishFlight(s);
  assert.strictEqual(t.debrief.agendas.length, 4);
  assert.ok(JSON.stringify(Room.viewFor(t, t.players[0].id).debrief).includes('secret goal of comms'));
  assert.deepStrictEqual(t.debrief.score.stats, t.debrief.stats);
});

test('a dropped phone keeps its seat through the grace period and takes it back', () => {
  let { s, ids } = toDesign();
  const id = ids[1];
  const roles = ROLES.filter((r) => s.roles[r] === id);
  s = act(s, 'host', 'drop', { playerId: id });
  assert.strictEqual(s.players.find((p) => p.id === id).connected, false);
  let t = Room.tick(s, s.now + 500);
  assert.strictEqual(t === s ? t.roles[roles[0]] : t.roles[roles[0]], id, 'seat kept during the grace period');
  t = Room.tick(s, s.now + 1100);
  assert.ok(t.roles[roles[0]].startsWith('bot-'), 'then a bot covers');
  t = act(t, 'host', 'reconnect', { token: 'tok1' });
  assert.ok(t.last.ok);
  assert.strictEqual(t.last.playerId, id);
  assert.strictEqual(t.roles[roles[0]], id, 'the role comes back');
  assert.ok(!t.players.some((p) => p.bot), 'and the bot leaves');
});

test('a reconnect keeps the player’s agenda and design state', () => {
  let { s, ids } = toDesign();
  const agenda = Room.viewFor(s, ids[2]).me.agendas;
  s = act(s, 'host', 'drop', { playerId: ids[2] });
  s = act(s, 'host', 'reconnect', { token: 'tok2' });
  assert.deepStrictEqual(Room.viewFor(s, ids[2]).me.agendas, agenda);
});

test('a player leaving mid-round hands their role to a bot; a late joiner takes it over', () => {
  let { s, ids } = toDesign();
  const role = ROLES.find((r) => s.roles[r] === ids[0]);
  s = act(s, ids[0], 'leave');
  assert.ok(s.roles[role].startsWith('bot-'));
  assert.ok(!s.players.some((p) => p.id === ids[0]));
  s = act(s, 'host', 'join', { name: 'Late', token: 'late' });
  assert.ok(s.last.ok);
  assert.strictEqual(s.roles[role], s.last.playerId);
  assert.ok(!s.players.some((p) => p.bot));
});

test('a late joiner to a small crew gets a role from someone holding two', () => {
  let { s, ids } = toDesign(2);
  s = act(s, 'host', 'join', { name: 'Late', token: 'late' });
  const late = s.last.playerId;
  assert.strictEqual(ROLES.filter((r) => s.roles[r] === late).length, 1);
  assert.ok(ids.every((id) => ROLES.filter((r) => s.roles[r] === id).length >= 1));
});

test('bots vote once the people have, so a team with a bot can still launch', () => {
  let { s, ids } = toDesign();
  s = act(s, ids[3], 'leave');
  assert.strictEqual(s.phase, 'design');
  s = voteAll(s, ids.slice(0, 3));
  assert.strictEqual(s.phase, 'lock');
  s = Room.tick(s, s.armedAt + 1);
  assert.strictEqual(s.phase, 'flight');
});

test('a bot holding a role answers requests and improves the design', () => {
  let { s, ids } = toDesign(4, { timing: { ...TIMING, requestMs: 20000, designMs: 60000 } });
  const engineer = s.roles.engineer;
  s = act(s, engineer, 'leave');
  const asker = ids.find((id) => id !== engineer);
  s = act(s, asker, 'request', { to: 'engineer', preset: 'need-power' });
  let t = s;
  for (let now = s.now + 100; now < s.now + 7000 && t.requests[0].status === 'open'; now += 100) t = Room.tick(t, now);
  assert.strictEqual(t.requests[0].status, 'answered');
  assert.strictEqual(t.design.solar, 'big', 'it fitted the bigger panels');
});

test('a bot holding the fix acts on crises', () => {
  let { s, ids } = toFlight();
  const fixer = s.roles.comms;
  s = act(s, fixer, 'leave');
  assert.ok(s.roles.comms.startsWith('bot-'));
  let t = Room.tick(s, s.flight.startedAt + s.crises[0].at + 1);
  const c = activeCrisis(t);
  assert.ok(c.fixTo.startsWith('bot-'));
  assert.notStrictEqual(c.botWill, undefined);
  c.botWill = true;
  t = Room.tick(t, c.botAt + 1);
  assert.strictEqual(t.crises.find((x) => x.id === c.id).status, 'fixed');
  assert.ok(ids.length);
});

test('solo: bot crewmates stay quiet during the build unless asked to nag', () => {
  let q = Room.create({ mode: 'solo', seed: 3, scenarioId: 'moon', timing: TIMING });
  q = act(q, 'local', 'start');
  q = Room.tick(q, 2000);
  for (let now = 2100; now < 3000; now += 100) q = Room.tick(q, now);
  assert.strictEqual(q.requests.length, 0, 'calm by default');
});

test('solo: one seat holds all four panels and bot crewmates ask for things', () => {
  let s = Room.create({ mode: 'solo', seed: 3, scenarioId: 'moon', timing: { ...TIMING, botRequests: true } });
  assert.ok(ROLES.every((r) => s.roles[r] === 'local'));
  s = act(s, 'local', 'start');
  s = Room.tick(s, 2000);
  s = act(s, 'local', 'next');
  assert.strictEqual(s.phase, 'design');
  const v = Room.viewFor(s, 'local');
  assert.strictEqual(v.me.roles.length, 4);
  assert.strictEqual(Object.keys(v.me.agendas).length, 4);
  assert.strictEqual(v.players.length, 1, 'crew bots are not shown as seated players');
  let t = s;
  for (let now = 2100; now < 3000; now += 100) t = Room.tick(t, now);
  assert.ok(t.requests.length > 0, 'a bot asked');
  assert.strictEqual(t.requests[0].preset, 'need-power', 'about the resource that is actually in trouble');
  assert.ok(Room.viewFor(t, 'local').inbox.length > 0);
});

test('solo: a crisis shows both halves, and a crewmate may rescue a slow player', () => {
  let s = Room.create({ mode: 'solo', seed: 3, scenarioId: 'moon', timing: TIMING });
  s = act(s, 'local', 'start');
  s = Room.tick(s, 2000);
  s = act(s, 'local', 'next');
  s = act(s, 'local', 'vote', { yes: true });
  s = Room.tick(s, s.armedAt + 1);
  assert.strictEqual(s.phase, 'flight');
  let t = Room.tick(s, s.flight.startedAt + s.crises[0].at + 1);
  const c = activeCrisis(t);
  const seen = Room.viewFor(t, 'local').crises[0];
  assert.ok(seen.alarm && seen.fix);
  assert.ok(c.botAt > t.now);
  c.botWill = true;
  t = Room.tick(t, c.botAt + 1);
  assert.strictEqual(t.crises.find((x) => x.id === c.id).status, 'fixed');
});

test('one screen: four panels, no bots asking', () => {
  let s = Room.create({ mode: 'one', seed: 3, scenarioId: 'moon', timing: TIMING });
  s = act(s, 'local', 'start');
  s = Room.tick(s, 2000);
  let t = s;
  for (let now = 2100; now < 3000; now += 100) t = Room.tick(t, now);
  assert.strictEqual(t.requests.length, 0);
});

test('surface: bots fill empty roles and one person drives one astronaut', () => {
  const { s, ids } = toFlight(2);
  const t = finishFlight(s);
  const roster = t.surface.roster;
  assert.strictEqual(roster.length, 4);
  assert.strictEqual(roster.filter((a) => !a.bot).length, 2);
  assert.deepStrictEqual(roster.filter((a) => !a.bot).map((a) => a.id).sort(), ids.slice().sort());
  assert.ok(roster.filter((a) => a.bot).every((a) => a.id.startsWith('bot-')));
  const v = Room.viewFor(t, ids[0]);
  assert.ok(v.surface.me.controller);
});

test('surface: solo is one person and three bots, one screen seats local pads', () => {
  const run = (opts) => {
    let s = Room.create({ seed: 3, scenarioId: 'moon', timing: TIMING, ...opts });
    s = act(s, 'local', 'start');
    s = Room.tick(s, 2000);
    s = act(s, 'local', 'next');
    s = act(s, 'local', 'vote', { yes: true });
    s = Room.tick(s, s.armedAt + 1);
    return finishFlight(s);
  };
  const solo = run({ mode: 'solo' });
  assert.deepStrictEqual(solo.surface.roster.map((a) => a.id), ['p1', 'bot-engineer', 'bot-scientist', 'bot-comms']);
  const one = run({ mode: 'one', localSeats: 3 });
  assert.deepStrictEqual(one.surface.roster.map((a) => a.bot), [false, false, false, true]);
});

test('surface: a dropped phone becomes a bot at once and comes back on reconnect', () => {
  let { s, ids } = toFlight();
  s = act(finishFlight(s), 'host', 'landingDone');
  s = act(s, 'host', 'drop', { playerId: ids[0] });
  assert.strictEqual(s.surface.roster.find((a) => a.id === ids[0]).bot, true);
  s = act(s, 'host', 'reconnect', { token: 'tok0' });
  assert.strictEqual(s.surface.roster.find((a) => a.id === ids[0]).bot, false);
});

test('input: decoded, clamped, shared with the surface, stale input falls away', () => {
  let { s, ids } = toFlight();
  s = act(finishFlight(s), 'host', 'landingDone');
  const before = s.rev;
  Room.applyInput(s, ids[0], [2, -0.5, NaN, 0.25, Room.BUTTONS.fire | Room.BUTTONS.use], 1000);
  assert.strictEqual(s.rev, before, 'input is not a game event');
  const got = Room.surfaceInputs(s, 1100)[ids[0]];
  assert.strictEqual(got.mx, 1, 'clamped');
  assert.strictEqual(got.my, -0.5);
  assert.strictEqual(got.ax, 0, 'NaN is zero');
  assert.ok(got.fire && got.use && !got.ability);
  assert.deepStrictEqual(Room.surfaceInputs(s, 5000), {}, 'a silent phone stops steering');
  const copy = Room.reduce(s, { type: 'nonsense', by: 'host' }, 2000);
  Room.applyInput(s, ids[1], { mx: 0.1, buttons: 0 }, 2000);
  assert.ok(copy.inputs[ids[1]], 'every copy of the state shares the mailbox');
});

test('input: named buttons work too, and junk is harmless', () => {
  assert.strictEqual(Room.decodeInput({ fire: true, ability: true }).buttons, Room.BUTTONS.fire | Room.BUTTONS.ability);
  const blank = { mx: 0, my: 0, ax: 0, ay: 0, buttons: 0, moveX: 0, moveY: 0, aimX: 0, aimY: 0, weapon: null };
  assert.deepStrictEqual(Room.decodeInput('garbage'), blank);
  assert.deepStrictEqual(Room.decodeInput(null), blank);
  const named = Room.decodeInput([0.5, -1, 0, 1, 0, 2]);
  assert.strictEqual(named.moveX, 0.5, 'the names surface-sim reads');
  assert.strictEqual(named.aimY, 1);
  assert.strictEqual(named.weapon, 2);
});

test('input for a bot-held astronaut is ignored', () => {
  let { s } = toFlight(2);
  s = finishFlight(s);
  Room.applyInput(s, 'bot-comms', [1, 1, 0, 0, 1], 1000);
  assert.ok(!('bot-comms' in Room.surfaceInputs(s, 1000)));
});

test('refly: same seed, a ghost, the design kept, a suggested change applied', () => {
  const { s } = toFlight(4, { scenarioId: 'nile' });
  const t = finishFlight(s);
  assert.strictEqual(act(t, 'host', 'next').phase, 'brief');
  const r = act(t, 'host', 'refly', { change: { role: 'engineer', key: 'solar', value: 'big' } });
  assert.strictEqual(r.phase, 'design');
  assert.strictEqual(r.seed, t.seed);
  assert.strictEqual(r.design.solar, 'big');
  assert.ok(r.ghost.frames.length > 0, 'last run kept as a ghost');
  assert.ok(r.ghost.frames.length <= 241);
  assert.strictEqual(r.debrief, null);
  assert.strictEqual(r.stats.crisesTotal, 0);
  assert.ok(Room.viewFor(r, r.players[0].id).ghost);
  assert.strictEqual(Room.viewFor(r, r.players[0].id).ghost.frames, undefined, 'phones get the summary, not the frames');
  const instant = act(t, 'host', 'refly', { instant: true });
  assert.strictEqual(instant.phase, 'lock');
});

test('next: a new seed, a new brief, and the crew is dealt in again', () => {
  let { s, ids } = toFlight(4, { scenarioId: 'nile' });
  s = act(s, ids[0], 'leave');
  const t = finishFlight(s);
  const n = act(t, 'host', 'next', { scenarioId: 'moon' });
  assert.strictEqual(n.phase, 'brief');
  assert.notStrictEqual(n.seed, t.seed);
  assert.strictEqual(n.scenarioId, 'moon');
  assert.ok(ROLES.every((r) => !player(n, n.roles[r]).bot), 'no bots while people can hold the roles');
});

function player(s, id) {
  return s.players.find((p) => p.id === id);
}

test('flight view: phones get the current frame only; the drawing device gets the record', () => {
  const { s, ids } = toFlight();
  const t = Room.tick(s, s.now + 100);
  const phone = Room.viewFor(t, ids[0], s.flight.startedAt + 5000);
  assert.strictEqual(phone.flight.frames, undefined);
  assert.strictEqual(phone.flight.result, null, 'the ending stays a surprise');
  assert.ok(phone.flight.frame && phone.flight.progress === 0.5);
  const big = Room.viewFor(t, null, s.flight.startedAt + 5000);
  assert.ok(Array.isArray(big.flight.frames));
});

test('reduce and tick never mutate the state they are given', () => {
  const { s, ids } = toDesign();
  const before = JSON.stringify(s);
  act(s, ids[0], 'vote', { yes: true });
  act(s, s.roles.engineer, 'set', { role: 'engineer', key: 'solar', value: 'big' });
  act(s, 'host', 'kick', { playerId: ids[1] });
  Room.tick(s, s.phaseEndsAt + 1);
  assert.strictEqual(JSON.stringify(s), before);
});

test('tick returns the same object when nothing happens', () => {
  const { s } = toDesign();
  assert.strictEqual(Room.tick(s, s.now + 10), s);
});

test('bad actions are refused without changing the game', () => {
  const { s } = toDesign();
  for (const action of [{ type: 'nope', by: 'host' }, { type: '__proto__', by: 'host' }, { type: 'constructor', by: 'host' }, {}, { type: 'set', by: 'nobody' }, { type: 'crisisAct', by: s.players[0].id, crisisId: 'x' }]) {
    const r = Room.reduce(s, action, s.now);
    assert.strictEqual(r.last.ok, false, JSON.stringify(action));
    assert.strictEqual(r.phase, s.phase);
    assert.strictEqual(r.design, s.design);
  }
  assert.strictEqual(Room.reduce(s, null, s.now).last.ok, false);
});

test('the error reaches only the player who made it', () => {
  const { s, ids } = toDesign();
  const r = act(s, ids[0], 'set', { role: ROLES.find((x) => s.roles[x] !== ids[0]), key: 'launcher', value: 'tiny' });
  assert.strictEqual(Room.viewFor(r, ids[0]).error.code, 'not-your-role');
  assert.strictEqual(Room.viewFor(r, ids[1]).error, null);
});

test('snapshot and restore survive a host refresh mid-flight', () => {
  const { s, ids } = toFlight();
  const t = Room.tick(s, s.flight.startedAt + s.crises[0].at + 1);
  const saved = JSON.parse(JSON.stringify(Room.snapshot(t)));
  assert.strictEqual(saved.run, undefined, 'the heavy flight record is flown again instead');
  const back = Room.restore(saved, t.now);
  assert.strictEqual(back.phase, 'flight');
  assert.ok(back.run.frames.length > 0);
  assert.ok(back.catalog);
  assert.deepStrictEqual(back.players.map((p) => p.name), t.players.map((p) => p.name));
  assert.ok(back.players.every((p) => !p.connected), 'nobody counts as here until they say hello again');
  let on = back;
  for (let now = back.now; on.phase === 'flight' && now < back.now + 20000; now += 100) on = Room.tick(on, now);
  assert.notStrictEqual(on.phase, 'flight');
});

test('kick removes a player, in the lobby or mid-round', () => {
  let { s, ids } = setup(3);
  s = act(s, 'host', 'kick', { playerId: ids[0] });
  assert.ok(!player(s, ids[0]));
  assert.ok(ROLES.every((r) => s.roles[r]));
});

test('restore slides every deadline forward by the time the host was away', () => {
  const { s } = toDesign();
  const saved = JSON.parse(JSON.stringify(Room.snapshot(s)));
  const back = Room.restore(saved, s.now + 90000);
  assert.strictEqual(back.phaseEndsAt, s.phaseEndsAt + 90000);
  assert.strictEqual(Room.viewFor(back, s.players[0].id, back.now).clock.leftS, Room.viewFor(s, s.players[0].id, s.now).clock.leftS);
});

test('a host who is also a player has host rights, and a phone does not', () => {
  let s = Room.create({ mode: 'devices', seed: 7, scenarioId: 'moon', timing: TIMING });
  s = Room.reduce(s, { type: 'join', name: 'Host', token: 'h', asHost: true, by: 'host' }, 0);
  const host = s.last.playerId;
  assert.strictEqual(s.hostPlayer, host);
  s = Room.reduce(s, { type: 'join', name: 'B', token: 'b', by: 'host' }, 0);
  const other = s.last.playerId;
  assert.strictEqual(act(s, other, 'start').last.code, 'host-only');
  s = act(s, host, 'start');
  assert.strictEqual(s.phase, 'brief');
  assert.ok(Room.viewFor(s, host).me.roles.length > 0, 'and holds a seat like anyone else');
  const restored = Room.restore(JSON.parse(JSON.stringify(Room.snapshot(s))), s.now);
  assert.strictEqual(restored.players.find((p) => p.id === host).connected, true, 'the host comes back with the page');
  assert.strictEqual(restored.players.find((p) => p.id === other).connected, false);
});

test('asHost cannot be claimed by a phone', () => {
  let s = Room.create({ mode: 'devices', seed: 7, scenarioId: 'moon', timing: TIMING });
  s = Room.reduce(s, { type: 'join', name: 'X', token: 'x', asHost: true, by: 'p9' }, 0);
  assert.strictEqual(s.hostPlayer, null);
});

test('jettison during the surface reaches the sim for a moment', () => {
  let { s, ids } = toFlight();
  s = act(finishFlight(s), 'host', 'landingDone');
  Room.applyInput(s, ids[0], [0, 0, 0, 0, 0], 1000);
  s = act(s, ids[0], 'ascentDrop', { id: 'core1' }, 1000);
  assert.strictEqual(Room.surfaceInputs(s, 1100)[ids[0]].jettison, 'core1');
  Room.applyInput(s, ids[0], [0, 0, 0, 0, 0], 1500);
  assert.strictEqual(Room.surfaceInputs(s, 1500)[ids[0]].jettison, undefined, 'then it is gone');
});

test('the ascent chooser sends its whole plan at once', () => {
  let { s, ids } = toFlight();
  s = act(finishFlight(s), 'host', 'landingDone');
  Room.applyInput(s, ids[0], [0, 0, 0, 0, 0], 1000);
  s = act(s, ids[0], 'ascentDrop', { ids: ['core1', 'core2', 'core3'], drop: true }, 1000);
  assert.ok(s.last.ok);
  assert.deepStrictEqual(Room.surfaceInputs(s, 1100)[ids[0]].jettison, ['core1', 'core2', 'core3']);
});

test('fly again with a build-step change opens the build on that step', () => {
  const sim = stubSim;
  const had = sim.applyStep;
  sim.applyStep = (d, step, option) => ({ ...d, solar: option });
  const hadSteps = sim.buildSteps;
  sim.buildSteps = () => [{ id: 'orbit', keys: ['launcher'] }, { id: 'power', keys: ['solar'] }, { id: 'rocket', keys: ['camera'] }];
  try {
    let { s } = toFlight();
    s = act(finishFlight(s), 'host', 'landingDone');
    s = act(s, 'host', 'surfaceDone', { summary: { scienceFrac: 0.5 } });
    for (let i = 0; i < 20 && s.phase !== 'debrief'; i++) s = Room.tick(s, s.now + 2000);
    assert.strictEqual(s.phase, 'debrief');
    s = act(s, 'host', 'refly', { change: { step: 'power', option: 'big' } });
    assert.strictEqual(s.phase, 'design');
    assert.strictEqual(s.design.solar, 'big');
    assert.strictEqual(s.buildStep, 1);
  } finally {
    sim.applyStep = had;
    sim.buildSteps = hadSteps;
  }
});

test('a crash inside an action is refused, not fatal', () => {
  const { s, ids } = toDesign();
  const bad = Room.reduce(s, { type: 'set', by: s.roles.engineer, role: 'engineer', key: 'solar', value: { toString: null } }, s.now);
  assert.ok(bad.phase === 'design' && ids.length);
  const broken = Room.reduce({ ...s, requests: null }, { type: 'answer', by: ids[0], requestId: 'x' }, s.now);
  assert.strictEqual(broken.last.code, 'internal');
});

// ---- Against the real simulation ----------------------------------------------
test('a whole Moon round on the real simulation, including the surface hand-off', () => {
  const realSim = require('../js/team/sim.js');
  Room.useSim(realSim);
  try {
    const list = realSim.scenarios();
    const landing = list.find((x) => x.landing);
    const orbit = list.find((x) => x.training || !x.landing);
    assert.ok(landing && orbit, 'scenarios of both kinds');

    let { s, ids } = setup(4, { scenarioId: landing.id, timing: { ...TIMING, designMs: 180000, flightMs: 75000, fixedFlight: false } });
    s = act(s, 'host', 'start');
    assert.ok(s.requirementId, 'a real requirement is preselected');
    for (const id of ids) s = act(s, id, 'pick', { requirement: s.requirementId });
    s = act(s, ids[0], 'forward');
    assert.strictEqual(s.phase, 'design');
    assert.strictEqual(s.design.scenario, landing.id);
    assert.ok(s.resources.mass && s.resources.power, 'real dashboard');
    assert.strictEqual(s.phaseTotalMs, 180000, 'real designSec');
    assert.ok(s.agendas.engineer && s.agendas.comms, 'real agendas');

    const group = s.catalog.roles.engineer.find((g) => (g.options || []).length > 1 && g.key !== 'instruments');
    const value = group.options.find((o) => o.id !== s.design.picks[group.key]).id;
    const after = act(s, s.roles.engineer, 'set', { role: 'engineer', key: group.key, value });
    assert.ok(after.last.ok, after.last.text);
    assert.strictEqual(after.design.picks[group.key], value);

    assert.deepStrictEqual(s.checks.filter((c) => c.hard && !c.ok), [], 'the starter design can launch');
    s = voteAll(s, ids);
    s = Room.tick(s, s.armedAt + 1);
    assert.strictEqual(s.phase, 'flight');
    assert.ok(s.run.frames.length > 100);
    assert.ok(s.crises.length > 0, 'real crises scheduled');
    const span = s.run.frames[s.run.frames.length - 1].t;
    assert.ok(span <= 150, 'short enough to play in real time');
    assert.strictEqual(s.flight.durationMs, span * 1000, 'the room agrees with the flight view on the length');

    const c0 = s.crises.find((c) => c.kind === 'crisis') || s.crises[0];
    assert.ok(c0.title && c0.alarm && c0.options.length >= 2, 'alarm text and controls from the sim');
    assert.ok(c0.options.some((o) => o.correct));
    let t = s;
    let last = s.now;
    for (let now = s.now; now < s.flight.startedAt + c0.at + 300; now += 150) {
      t = Room.tick(t, now);
      last = now;
    }
    const active = t.crises.find((x) => x.id === c0.id);
    assert.strictEqual(active.status, 'active');
    const right = active.options.find((o) => o.correct);
    t = act(t, active.fixTo, 'crisisAct', { crisisId: active.id, optionId: right.id }, last);
    assert.strictEqual(t.outcomes[active.key], active.kind === 'opportunity' ? 'taken' : 'fixed');
    const evt = t.run.events.find((e) => e.id === active.key);
    assert.ok(!evt || evt.fixed === true, 'the flight really was re-flown with the fix');

    for (let now = last; t.phase === 'flight' && now < last + 200000; now += 150) t = Room.tick(t, now);
    assert.ok(['landing', 'debrief'].includes(t.phase), t.phase);
    if (t.phase === 'landing') {
      t = act(t, 'host', 'landingDone');
      assert.strictEqual(t.phase, 'surface');
      const Surface = require('../js/team/surface-sim.js');
      const roster = t.surface.roster;
      let S = Surface.create(realSim.surfaceLoadout(t.design), t.seed, roster, { hazards: t.hazards, difficulty: t.difficulty });
      for (const id of ids) Room.applyInput(t, id, { mx: 0.5, fire: true }, t.now);
      const inputs = Room.surfaceInputs(t, t.now);
      assert.strictEqual(Object.keys(inputs).length, 4, 'one input per person');
      for (let i = 0; i < 40; i++) S = Surface.step(S, inputs, Surface.TICK) || S;
      assert.ok(S.entities.some((e) => e.kind === 'astronaut' && roster.some((a) => a.id === e.playerId)), 'surface astronauts match the room roster');
      const summary = Surface.summary(S);
      t = act(t, 'host', 'surfaceDone', { summary: { ...summary, extracted: true } });
      assert.strictEqual(t.phase, 'ascent');
      t = act(t, 'host', 'ascentDone', { result: { lifted: true } });
    }
    assert.strictEqual(t.phase, 'debrief');
    assert.ok(Number.isFinite(t.debrief.score.total), 'real score');
    assert.ok(Array.isArray(t.debrief.chain));
    assert.strictEqual(t.debrief.agendas.length, 4);
    assert.ok(t.debrief.stats.agendasTotal === 4);
    const v = Room.viewFor(t, ids[0]);
    assert.ok(v.debrief.score.total === t.debrief.score.total);

    const r = act(t, 'host', 'refly', {});
    assert.strictEqual(r.seed, t.seed);
    assert.ok(r.ghost.frames.length > 0);

    let e = setup(2, { scenarioId: orbit.id, timing: { ...TIMING, designMs: 180000 } }).s;
    e = act(e, 'host', 'start');
    e = Room.tick(e, e.phaseEndsAt + 1);
    assert.strictEqual(Room.hasSurface(e), false, 'Earth is a training flight');
  } finally {
    Room.useSim(stubSim);
  }
});

// ---------- The v2 flow on the real simulation (docs/TEAM-V2.md) ----------
const Sim = require('../js/team/sim.js');
function withSim(fn) {
  Room.useSim(Sim);
  try {
    fn();
  } finally {
    Room.useSim(stubSim);
  }
}
const v2 = (s, by = 'local', now) => Room.viewFor(s, by, now);

test('setup is three steps (four with a room), each with Back', () =>
  withSim(() => {
    let s = Room.create({ mode: 'solo', seed: 3 });
    assert.strictEqual(s.setupStep, 'difficulty');
    assert.strictEqual(act(s, 'local', 'back').last.code, 'no-back', 'nothing before the first step');
    s = act(s, 'local', 'setup', { difficulty: 'cadet' });
    s = act(s, 'local', 'forward');
    assert.strictEqual(s.setupStep, 'crew');
    s = act(s, 'local', 'setRole', { role: 'scientist', crew: 'nadia' });
    assert.strictEqual(v2(s).crewPick.local, 'nadia');
    s = act(s, 'local', 'forward');
    assert.strictEqual(s.setupStep, 'destination');
    s = act(s, 'local', 'back');
    assert.strictEqual(s.setupStep, 'crew');
    s = act(s, 'local', 'forward');
    s = act(s, 'local', 'setup', { scenarioId: 'mars' });
    s = act(s, 'local', 'forward');
    assert.strictEqual(s.phase, 'brief');
    assert.strictEqual(s.difficulty, 'cadet');
    s = act(s, 'local', 'back');
    assert.strictEqual(s.phase, 'lobby');
    assert.strictEqual(s.setupStep, 'destination', 'back from the briefing lands on the destination');
    const net = Room.create({ mode: 'devices', seed: 3 });
    assert.deepStrictEqual(v2(net, null).setupSteps, ['room', 'difficulty', 'crew', 'destination']);
  }));

test('the build goes one step at a time and Back never loses a choice', () =>
  withSim(() => {
    let s = Room.create({ mode: 'solo', seed: 3, scenarioId: 'mars', difficulty: 'engineer' });
    s = act(s, 'local', 'start');
    s = act(s, 'local', 'forward');
    assert.strictEqual(s.phase, 'questions');
    s = act(s, 'local', 'pick', { requirement: 'sites' });
    s = act(s, 'local', 'forward');
    assert.strictEqual(s.phase, 'design');
    assert.strictEqual(s.buildStep, 0);
    const steps = Sim.buildSteps('mars', 'engineer');
    s = act(s, 'local', 'build', { step: 'orbit', option: 'polar300' });
    assert.ok(s.last.ok, s.last.text);
    s = act(s, 'local', 'forward');
    s = act(s, 'local', 'build', { step: 'power', option: 'tj8' });
    assert.ok(s.last.ok, s.last.text);
    s = act(s, 'local', 'back');
    s = act(s, 'local', 'back');
    assert.strictEqual(s.phase, 'questions', 'back from the first step returns to the success criterion');
    s = act(s, 'local', 'forward');
    assert.strictEqual(s.design.picks.orbit, 'polar300', 'kept through Back');
    assert.strictEqual(s.design.picks.panels, 'tj8');
    for (let i = 0; i < steps.length; i++) s = act(s, 'local', 'forward');
    assert.strictEqual(s.phase, 'lock');
    s = act(s, 'local', 'back');
    assert.strictEqual(s.phase, 'design');
    assert.strictEqual(s.buildStep, steps.length - 1, 'back from the questions is the last build step');
    s = act(s, 'local', 'stepTo', { index: 1 });
    assert.strictEqual(s.buildStep, 1);
    assert.strictEqual(s.design.picks.panels, 'tj8');
    assert.strictEqual(act(s, 'local', 'stepTo', { index: 99 }).last.code, 'bad-step');
  }));

test('Fix it: the review can jump to a step, and a launch still needs every key', () =>
  withSim(() => {
    let s = Room.create({ mode: 'solo', seed: 3, scenarioId: 'mars', difficulty: 'engineer' });
    s = act(s, 'local', 'start');
    s = act(s, 'local', 'forward');
    s = act(s, 'local', 'forward');
    const last = Sim.buildSteps('mars', 'engineer').length - 1;
    s = act(s, 'local', 'stepTo', { index: last });
    s = act(s, 'local', 'build', { step: 'rocket', option: 'light' });
    s = act(s, 'local', 'forward');
    assert.strictEqual(s.phase, 'lock');
    const r = act(s, 'local', 'vote', { yes: true });
    assert.strictEqual(r.last.code, 'hard-check', 'the light rocket cannot lift Mars');
    s = act(s, 'local', 'stepTo', { index: last });
    assert.strictEqual(s.phase, 'design');
    s = act(s, 'local', 'build', { step: 'rocket', option: 'medium' });
    s = act(s, 'local', 'forward');
    s = act(s, 'local', 'vote', { yes: true }, 100);
    assert.ok(s.armedAt);
    assert.strictEqual(Room.tick(s, s.armedAt + 1).phase, 'flight');
  }));

test('multiplayer: the step owner picks, others suggest, and only the owner or host moves on', () =>
  withSim(() => {
    let s = Room.create({ mode: 'devices', seed: 3, scenarioId: 'moon', difficulty: 'engineer' });
    s = Room.reduce(s, { type: 'join', name: 'Host', token: 'h', asHost: true, by: 'host' }, 0);
    const host = s.last.playerId;
    s = Room.reduce(s, { type: 'join', name: 'Bea', token: 'b', by: 'host' }, 0);
    const bea = s.last.playerId;
    assert.strictEqual(act(s, bea, 'forward').last.code, 'not-yours', 'the lobby moves with the host');
    s = act(s, host, 'forward');
    assert.strictEqual(s.setupStep, 'difficulty');
    s = act(s, host, 'forward');
    s = act(s, bea, 'setRole', { role: 'planner', crew: 'kofi' });
    assert.strictEqual(act(s, host, 'setRole', { role: 'engineer', crew: 'kofi' }).last.code, 'crew-taken', 'one person per character');
    s = act(s, host, 'start');
    s = act(s, host, 'forward');
    s = act(s, host, 'pick', { requirement: s.requirementId });
    s = act(s, host, 'forward');
    assert.strictEqual(s.phase, 'design');
    assert.strictEqual(s.roles.planner, bea, 'the orbit step belongs to the planner');
    const notMine = act(s, host, 'build', { step: 'orbit', option: 'frozen' });
    assert.strictEqual(notMine.last.code, 'not-your-role');
    s = act(s, host, 'suggest', { step: 'orbit', option: 'frozen' });
    assert.strictEqual(v2(s, bea).suggestions.orbit.option, 'frozen');
    assert.strictEqual(v2(s, bea).suggestions.orbit.name, 'Host');
    s = act(s, bea, 'build', { step: 'orbit', option: 'frozen' });
    assert.ok(s.last.ok);
    assert.strictEqual(v2(s, bea).suggestions.orbit, undefined, 'taking a suggestion clears it');
    s = act(s, bea, 'forward');
    assert.strictEqual(s.buildStep, 1);
    assert.strictEqual(Room.viewFor(s, host).buildStep, 1, 'everyone sees the same step');
    assert.strictEqual(act(s, bea, 'forward').last.code, 'not-yours', 'the power step belongs to the engineer');
  }));

test('pause freezes the room for everyone and resume picks up where it stopped', () => {
  let { s, ids } = toFlight(2);
  const at = s.now + 1000;
  const before = Room.viewFor(s, ids[0], at).flight.progress;
  s = act(s, ids[1], 'pause', {}, at);
  assert.ok(s.paused);
  assert.strictEqual(Room.viewFor(s, ids[0], at + 999999).paused.name, 'P1');
  assert.strictEqual(Room.viewFor(s, ids[0], at + 999999).flight.progress, before, 'the flight stands still');
  assert.strictEqual(Room.tick(s, at + 999999), s, 'nothing ticks while paused');
  const t = act(s, ids[0], 'resume', {}, at + 60000);
  assert.strictEqual(t.paused, null);
  assert.strictEqual(Room.viewFor(t, ids[0], t.now).flight.progress, before, 'resumes at the same moment');
  assert.strictEqual(act(s, 'nobody', 'pause').last.code, 'not-in-crew');
});

test('restart starts the same mission again from the briefing, host only', () => {
  const { s, ids } = toFlight(2);
  assert.strictEqual(act(s, ids[1], 'restart').last.code, 'host-only');
  const r = act(s, 'host', 'restart');
  assert.strictEqual(r.phase, 'brief');
  assert.strictEqual(r.scenarioId, s.scenarioId);
  assert.strictEqual(r.design, null);
  assert.strictEqual(r.players.filter((p) => !p.bot).length, 2, 'the crew stays');
});

test('the cabin conversation sits between the review and the flight when the session asks for it', () => {
  let { s, ids } = toDesign(2, { timing: { ...TIMING, cabinMs: 900 } });
  s = voteAll(s, ids);
  s = Room.tick(s, s.armedAt + 1);
  assert.strictEqual(s.phase, 'cabin');
  assert.strictEqual(Room.tick(s, s.now + 500).phase, 'cabin');
  assert.strictEqual(Room.tick(s, s.now + 901).phase, 'flight', 'the timer is a safety net');
  assert.strictEqual(act(s, 'host', 'next').phase, 'flight', 'Skip goes straight to the flight');
  s = act(s, 'host', 'setRole', { role: 'planner' });
  assert.strictEqual(Room.viewFor(s, ids[0]).players[0].crewId, null);
});
