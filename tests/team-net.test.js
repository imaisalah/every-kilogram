// The relay and SMD.team.net against the real server, over real sockets.
const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const { createHash, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');
const Room = require('../js/team/room.js');
const Net = require('../js/team/net.js');
const { stubSim, until, sleep } = require('./team-fixture.js');

Room.useSim(stubSim);

// sessionStorage for the host's refresh recovery.
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}
globalThis.sessionStorage = fakeStorage();
// No localStorage: every phone here is its own device, with its own token.

const FAST = { briefMs: 60000, designMs: 60000, lockMs: 60000, armMs: 50, flightMs: 1500, fixedFlight: true, flightHoldMs: 0, landingMs: 60000, surfaceMaxMs: 60000, ascentMs: 60000, graceMs: 300, crisisMs: 2000 };

let serve;
async function serverWith(limits) {
  serve = serve || (await import('../tools/serve.mjs'));
  return serve.startServer({ port: 0, limits });
}

const base = (s) => `http://127.0.0.1:${s.port}`;

async function withServer(limits, body) {
  const s = await serverWith(limits);
  try {
    await body(s);
  } finally {
    await s.close();
  }
}

function freshHost(s, extra = {}) {
  sessionStorage.clear();
  return Net.createHost({ base: base(s), fresh: true, scenarioId: 'moon', seed: 42, timing: FAST, ...extra });
}

async function joined(s, host, name) {
  const phone = Net.join(host.code, name, undefined, { base: base(s) });
  await until(() => phone.playerId && phone.view, `${name} in the room`);
  return phone;
}

// ---- Raw sockets: send exactly the bytes we want ------------------------------
function mask(payload, opcode = 1, fin = true) {
  const key = randomBytes(4);
  const masked = Buffer.from(payload.map ? payload : Buffer.from(payload));
  for (let i = 0; i < masked.length; i++) masked[i] ^= key[i % 4];
  const len = masked.length;
  const first = (fin ? 0x80 : 0) | opcode;
  let head;
  if (len < 126) head = Buffer.from([first, 0x80 | len]);
  else if (len < 65536) {
    head = Buffer.alloc(4);
    head[0] = first;
    head[1] = 0x80 | 126;
    head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = first;
    head[1] = 0x80 | 127;
    head.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([head, key, masked]);
}

function rawSocket(port, target) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1');
    const key = randomBytes(16).toString('base64');
    let buffer = Buffer.alloc(0);
    let shaken = false;
    const out = { sock, frames: [], closed: false, closeCode: null };
    sock.on('error', () => {});
    sock.on('close', () => {
      out.closed = true;
    });
    sock.on('connect', () => sock.write(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    sock.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!shaken) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) return;
        const head = buffer.subarray(0, end).toString();
        if (!head.startsWith('HTTP/1.1 101')) return reject(new Error(head));
        const expected = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
        assert.ok(head.includes(`Sec-WebSocket-Accept: ${expected}`), 'accept header is correct');
        buffer = buffer.subarray(end + 4);
        shaken = true;
        resolve(out);
      }
      while (buffer.length >= 2) {
        let len = buffer[1] & 0x7f;
        let off = 2;
        if (len === 126) {
          if (buffer.length < 4) return;
          len = buffer.readUInt16BE(2);
          off = 4;
        } else if (len === 127) {
          if (buffer.length < 10) return;
          len = Number(buffer.readBigUInt64BE(2));
          off = 10;
        }
        if (buffer.length < off + len) return;
        const opcode = buffer[0] & 0x0f;
        const payload = buffer.subarray(off, off + len);
        if (opcode === 8) out.closeCode = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
        else if (opcode === 1) out.frames.push(JSON.parse(payload.toString()));
        buffer = buffer.subarray(off + len);
      }
    });
  });
}

async function openRoom(s) {
  const host = await rawSocket(s.port, '/ws?as=host');
  const welcome = await until(() => host.frames.find((f) => f.t === 'welcome'), 'host welcome');
  return { host, code: welcome.room, key: welcome.key };
}

async function serverStillWorks(s) {
  const { host, code } = await openRoom(s);
  assert.match(code, /^[A-Z]{4}$/);
  host.sock.destroy();
  const r = await fetch(`${base(s)}/api/info`);
  assert.strictEqual(r.status, 200);
}

function rawHttp(port, requestPath) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1');
    let data = '';
    sock.on('connect', () => sock.write(`GET ${requestPath} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`));
    sock.on('data', (d) => (data += d));
    sock.on('end', () => resolve(data));
    sock.on('error', reject);
  });
}

// ---- Tests -------------------------------------------------------------------
test('whole round over real WebSockets: host and four phones', async () => {
  await withServer({}, async (s) => {
    const host = freshHost(s);
    await until(() => host.code, 'room code');
    assert.match(host.code, /^[ABCDEFGHJKMNPQRSTWXYZ]{4}$/);

    const phones = [];
    for (const name of ['Ada', 'Grace', 'Sally', 'Mae']) phones.push(await joined(s, host, name));
    await until(() => phones.every((p) => p.view.players.length === 4), 'all four visible');
    assert.ok(phones.every((p) => p.status === 'open'));

    assert.ok(host.send({ type: 'start' }));
    await until(() => phones.every((p) => p.view.phase === 'brief'), 'brief on phones');

    phones.forEach((p) => p.send({ type: 'pick' }));
    await until(() => phones.every((p) => p.view.phase === 'questions'), 'criterion choice on phones');
    phones[0].send({ type: 'pick', requirement: 'wide' });
    await until(() => phones.every((p) => p.view.requirementId === 'wide'), 'criterion sync on phones');
    host.send({ type: 'next' });
    await until(() => phones.every((p) => p.view.phase === 'design'), 'design on phones');
    assert.strictEqual(host.state.design.requirement, 'wide');

    // Each phone only has its own panels and its own agenda.
    for (const p of phones) {
      const roles = p.view.me.roles;
      assert.strictEqual(roles.length, 1);
      assert.deepStrictEqual(Object.keys(p.view.catalog.roles), roles);
      assert.ok(p.view.me.agendas[roles[0]]);
    }
    const byRole = (r) => phones.find((p) => p.view.me.roles.includes(r));

    byRole('engineer').send({ type: 'set', role: 'engineer', key: 'solar', value: 'big' });
    await until(() => phones.every((p) => p.view.design.solar === 'big'), 'the change reaches every phone');
    await until(() => phones.every((p) => p.view.resources.power.value === 120), 'numbers move everywhere');

    byRole('scientist').send({ type: 'request', to: 'engineer', preset: 'need-power' });
    await until(() => byRole('engineer').view.inbox.length === 1, 'request pings the right phone');
    assert.strictEqual(byRole('planner').view.inbox.length, 0);
    byRole('engineer').send({ type: 'answer', requestId: byRole('engineer').view.inbox[0].id, reply: 'ok' });
    await until(() => host.state.stats.requestsAnswered === 1, 'answer counted');

    // A phone cannot launch, or act as someone else.
    byRole('planner').send({ type: 'next', by: 'host' });
    byRole('planner').send({ type: 'set', by: byRole('comms').playerId, role: 'comms', key: 'antenna', value: 'high' });
    await until(() => byRole('planner').view.error, 'the bad set was refused');
    assert.strictEqual(host.state.design.antenna, 'low');
    assert.strictEqual(host.state.phase, 'design');

    phones.forEach((p) => p.send({ type: 'vote', yes: true }));
    await until(() => host.state.phase === 'flight', 'launch');

    // A dropped phone comes back to the same seat in the middle of the flight.
    const droppy = phones[1];
    const id = droppy.playerId;
    droppy._dropLink();
    assert.strictEqual(droppy.status, 'reconnecting');
    await until(() => droppy.status === 'open' && host.state.players.find((p) => p.id === id).connected, 'phone reconnected');
    assert.strictEqual(droppy.playerId, id, 'same player after reconnect');

    // Crises: wrong phones see nothing they should not, the fix works.
    const fixedTwo = until(() => host.state.stats.crisesFixed >= 1, 'crisis fixed', 12000);
    const c = await until(() => host.state.crises.find((x) => x.status === 'active'), 'a crisis');
    const fixer = phones.find((p) => p.playerId === c.fixTo);
    const alarmed = phones.find((p) => p.playerId === c.alarmTo);
    assert.notStrictEqual(fixer, alarmed);
    await until(() => fixer.view.crises.length && alarmed.view.crises.length, 'crisis on phones');
    assert.strictEqual(alarmed.view.crises[0].fix, undefined);
    assert.ok(alarmed.view.crises[0].alarm);
    assert.strictEqual(fixer.view.crises[0].alarm, undefined);
    assert.ok(!JSON.stringify(fixer.view).includes('correct'));
    const label = fixer.view.crises[0].fix.options.find((o) => o.label === 'Switch to low gain');
    fixer.send({ type: 'crisisAct', crisisId: c.id, optionId: label.id });
    await fixedTwo;

    await until(() => host.state.phase === 'landing', 'landing', 15000);
    assert.ok(phones.every((p) => p.view.phase !== undefined));
    host.send({ type: 'landingDone' });
    await until(() => phones.every((p) => p.view.phase === 'surface'), 'surface on phones');
    assert.ok(phones.every((p) => p.view.surface.me && p.view.surface.me.controller));

    // Controller input up at 20 Hz, HUD down at 5 Hz.
    const pilot = phones[0];
    const astronaut = pilot.playerId;
    const start = Date.now();
    pilot.sendInput({ mx: 1, my: 0, ax: 0, ay: 0, fire: true });
    await until(() => host.inputs[astronaut] && host.inputs[astronaut].mx === 1, 'first input arrives');
    assert.ok(Date.now() - start < 80, `input latency ${Date.now() - start} ms`);
    assert.ok(host.inputs[astronaut].fire);
    assert.ok(host.state.inputs[astronaut], 'visible through the state too');
    assert.ok(host.surfaceInputs()[astronaut]);

    let huds = 0;
    pilot.on('hud', () => huds++);
    for (let i = 0; i < 12; i++) {
      host.sendHud({ [astronaut]: { hp: 100 - i, ammo: 30 } });
      await sleep(50);
    }
    await sleep(250);
    assert.ok(huds >= 2 && huds <= 5, `about 5 HUD updates a second, got ${huds} in 0.85 s`);

    host.send({ type: 'surfaceDone', summary: { samples: [{ id: 's1', kg: 5 }] } });
    await until(() => phones.every((p) => p.view.phase === 'ascent'), 'ascent on phones');
    phones[2].send({ type: 'ascentDrop', id: 's1', drop: true });
    await until(() => host.state.ascent.dropped.s1, 'sample dropped');
    host.send({ type: 'ascentDone', result: { lifted: true } });
    await until(() => phones.every((p) => p.view.phase === 'debrief'), 'debrief on phones');
    await until(() => phones.every((p) => p.view.debrief && p.view.debrief.agendas.length === 4), 'agendas revealed');

    host.send({ type: 'refly' });
    await until(() => phones.every((p) => p.view.phase === 'design'), 'refly back to design');
    assert.strictEqual(host.state.seed, 42, 'same seed');
    assert.ok(host.state.ghost.frames.length);
    assert.ok(phones[0].view.ghost);

    phones.forEach((p) => p.close());
    host.close();
  });
});

test('wrong codes, full rooms and bad versions get a clear status', async () => {
  await withServer({}, async (s) => {
    const nope = Net.join('ZZZZ', 'x', undefined, { base: base(s) });
    await until(() => nope.status === 'closed', 'wrong code refused');
    assert.strictEqual(nope.statusCode, 'no-room');

    const host = freshHost(s);
    await until(() => host.code, 'code');
    const phones = [];
    for (let i = 0; i < 4; i++) phones.push(await joined(s, host, `P${i}`));
    const fifth = Net.join(host.code, 'Fifth', undefined, { base: base(s) });
    await until(() => fifth.status === 'closed', 'fifth refused');
    assert.strictEqual(fifth.statusCode, 'room-full');
    assert.strictEqual(host.state.players.length, 4);

    const dup = await until(() => host.state.players.map((p) => p.name), 'names');
    assert.strictEqual(new Set(dup).size, 4);
    phones.forEach((p) => p.close());
    host.close();
  });
});

test('lower-case codes work; duplicate names are told apart', async () => {
  await withServer({}, async (s) => {
    const host = freshHost(s);
    await until(() => host.code, 'code');
    const a = Net.join(host.code.toLowerCase(), 'Sam', undefined, { base: base(s) });
    await until(() => a.view, 'lower-case join');
    const b = await joined(s, host, 'Sam');
    await until(() => host.state.players.length === 2, 'two players');
    assert.deepStrictEqual(host.state.players.map((p) => p.name), ['Sam', 'Sam 2']);
    a.close();
    b.close();
    host.close();
  });
});

test('a phone asleep past the grace period gets its seat back from the bot', async () => {
  await withServer({}, async (s) => {
    const host = freshHost(s);
    await until(() => host.code, 'code');
    const phones = [];
    for (const name of ['A', 'B']) phones.push(await joined(s, host, name));
    host.send({ type: 'start' });
    phones.forEach((p) => p.send({ type: 'pick' }));
    await until(() => phones.every((p) => p.view.phase === 'questions'), 'criterion choice');
    phones[0].send({ type: 'pick', requirement: 'wide' });
    await until(() => phones.every((p) => p.view.requirementId === 'wide'), 'criterion sync');
    host.send({ type: 'next' });
    await until(() => host.state.phase === 'design', 'design');
    const sleeper = phones[1];
    const id = sleeper.playerId;
    const roles = Object.keys(host.state.roles).filter((r) => host.state.roles[r] === id);
    const token = sleeper.token;
    sleeper.close(); // the page is gone
    await until(() => host.state.roles[roles[0]].startsWith('bot-'), 'bot covers after the grace period');
    const back = Net.join(host.code, 'B', token, { base: base(s) });
    await until(() => back.view && back.view.me && back.view.me.roles.length === roles.length, 'back in the seat');
    assert.strictEqual(back.playerId, id);
    assert.ok(!host.state.players.some((p) => p.bot));
    phones[0].close();
    back.close();
    host.close();
  });
});

test('host refresh: phones wait, then carry on with the same game', async () => {
  await withServer({}, async (s) => {
    const host = freshHost(s);
    await until(() => host.code, 'code');
    const a = await joined(s, host, 'A');
    const b = await joined(s, host, 'B');
    host.send({ type: 'start' });
    a.send({ type: 'pick' });
    b.send({ type: 'pick' });
    await until(() => a.view.phase === 'questions' && b.view.phase === 'questions', 'criterion choice');
    b.send({ type: 'pick', requirement: 'wide' });
    await until(() => a.view.requirementId === 'wide' && b.view.requirementId === 'wide', 'criterion sync');
    host.send({ type: 'next' });
    await until(() => host.state.phase === 'design', 'design');
    await until(() => JSON.parse(sessionStorage.getItem('ek.team.host') || '{}').state?.phase === 'design', 'snapshot saved', 12000);
    const code = host.code;
    const idA = a.playerId;

    host._vanish();
    await until(() => a.status === 'waiting-host' && b.status === 'waiting-host', 'phones told the host is away');

    assert.deepStrictEqual(Net.resumable() && Net.resumable().code, code);
    const again = Net.createHost({ base: base(s), scenarioId: 'moon', timing: FAST });
    assert.strictEqual(again.state.phase, 'design', 'same game restored');
    await until(() => again.status === 'open', 'host back');
    assert.strictEqual(again.code, code, 'same room code');
    await until(() => a.status === 'open' && b.status === 'open', 'phones see the host again');
    await until(() => again.state.players.find((p) => p.id === idA).connected, 'phones re-attached');
    assert.strictEqual(a.playerId, idA);

    const role = a.view.me.roles[0];
    const key = { planner: 'launcher', engineer: 'solar', scientist: 'camera', comms: 'antenna' }[role];
    const value = { planner: 'tiny', engineer: 'big', scientist: 'super', comms: 'high' }[role];
    a.send({ type: 'set', role, key, value });
    await until(() => b.view.design[key] === value, 'game continues after the refresh');

    a.close();
    b.close();
    again.close();
  });
});

test('a second host with a wrong key is refused', async () => {
  await withServer({}, async (s) => {
    const { host, code } = await openRoom(s);
    const wrong = await rawSocket(s.port, `/ws?as=host&room=${code}&key=guess`);
    await until(() => wrong.closeCode !== null, 'refused');
    assert.strictEqual(wrong.closeCode, 4401);
    host.sock.destroy();
  });
});

test('local transport: the same interface with no network', async () => {
  const session = Net.createLocal({ mode: 'solo', scenarioId: 'moon', seed: 5, timing: FAST });
  assert.strictEqual(session.status, 'open');
  const seen = [];
  session.on('view', (v) => seen.push(v.phase));
  session.send({ type: 'start' });
  assert.strictEqual(session.view.phase, 'brief');
  assert.ok(seen.includes('brief'));
  session.send({ type: 'pick' });
  assert.strictEqual(session.state.phase, 'questions');
  session.send({ type: 'pick', requirement: 'sharp' });
  session.send({ type: 'next' });
  assert.strictEqual(session.state.phase, 'design');
  session.send({ type: 'vote', yes: true });
  await until(() => session.state.phase === 'flight', 'countdown', 12000);
  assert.ok(Array.isArray(session.view.flight.frames), 'the screen that draws gets the frames');
  session.send({ type: 'next' });
  assert.strictEqual(session.state.phase, 'landing');
  session.send({ type: 'landingDone' });
  session.sendInput({ mx: 1, fire: true }, 'p1');
  assert.ok(session.surfaceInputs().p1.fire);
  assert.strictEqual(session.state.surface.roster[0].id, 'p1');
  session.close();
  assert.strictEqual(session.status, 'closed');
});

test('oversized messages are refused and the socket closed', async () => {
  await withServer({}, async (s) => {
    const { host, code } = await openRoom(s);
    const peer = await rawSocket(s.port, `/ws?room=${code}`);
    peer.sock.write(mask(Buffer.alloc(s.limits.maxPeerMessage + 1, 0x20)));
    await until(() => peer.closeCode !== null, 'oversize refused');
    assert.strictEqual(peer.closeCode, 1009);
    assert.ok(!host.frames.some((f) => f.t === 'msg'), 'nothing reached the host');
    host.sock.destroy();
    await serverStillWorks(s);
  });
});

test('a huge length claim is refused before any payload arrives', async () => {
  await withServer({}, async (s) => {
    const { host, code } = await openRoom(s);
    const peer = await rawSocket(s.port, `/ws?room=${code}`);
    const head = Buffer.alloc(14);
    head[0] = 0x81;
    head[1] = 0x80 | 127;
    head.writeBigUInt64BE(BigInt(2 ** 40), 2);
    peer.sock.write(head);
    await until(() => peer.closeCode !== null, 'refused');
    assert.strictEqual(peer.closeCode, 1009);
    host.sock.destroy();
    await serverStillWorks(s);
  });
});

test('fragments cannot be used to get around the size limit', async () => {
  await withServer({}, async (s) => {
    const { host, code } = await openRoom(s);
    const peer = await rawSocket(s.port, `/ws?room=${code}`);
    const piece = Buffer.alloc(s.limits.maxPeerMessage - 100, 0x20);
    peer.sock.write(mask(piece, 1, false));
    peer.sock.write(mask(piece, 0, false));
    await until(() => peer.closeCode !== null, 'refused');
    assert.strictEqual(peer.closeCode, 1009);
    host.sock.destroy();
  });
});

test('a flood of normal messages is dropped and then cut off', async () => {
  await withServer({ floodStrikes: 50 }, async (s) => {
    const { host, code } = await openRoom(s);
    const peer = await rawSocket(s.port, `/ws?room=${code}`);
    const frame = mask(Buffer.from('{"d":{"k":"act"}}'));
    peer.sock.write(Buffer.concat(Array(400).fill(frame)));
    await until(() => peer.closeCode !== null, 'flood cut off');
    assert.strictEqual(peer.closeCode, 4429);
    await sleep(50);
    const got = host.frames.filter((f) => f.t === 'msg').length;
    const allowed = s.limits.peerRate * s.limits.burstSeconds;
    assert.ok(got >= 1 && got <= allowed + s.limits.peerRate, `host received ${got}, burst allows ${allowed} plus up to 1 s of refill on a busy machine`);
    host.sock.destroy();
    await serverStillWorks(s);
  });
});

test('a flood of input frames is cut off, and an oversized one never passes', async () => {
  await withServer({ floodStrikes: 40 }, async (s) => {
    const { host, code } = await openRoom(s);
    const peer = await rawSocket(s.port, `/ws?room=${code}`);
    const frame = mask(Buffer.from('{"i":[1,0,0,0,1]}'));
    peer.sock.write(Buffer.concat(Array(400).fill(frame)));
    await until(() => peer.closeCode !== null, 'input flood cut off');
    assert.strictEqual(peer.closeCode, 4429);
    await sleep(50);
    const got = host.frames.filter((f) => f.t === 'i').length;
    const allowed = s.limits.inputRate * s.limits.burstSeconds;
    assert.ok(got >= 1 && got <= allowed + s.limits.inputRate, `host received ${got} inputs, burst allows ${allowed} plus up to 1 s of refill on a busy machine`);

    const big = await rawSocket(s.port, `/ws?room=${code}`);
    big.sock.write(mask(Buffer.from(`{"i":[${'1,'.repeat(200)}1]}`)));
    big.sock.write(mask(Buffer.from('{"i":[0.5,0,0,0,0]}')));
    await until(() => host.frames.some((f) => f.t === 'i' && f.i[0] === 0.5), 'the small one still arrives');
    assert.ok(!host.frames.some((f) => f.t === 'i' && f.i.length > 10), 'the big one did not');
    host.sock.destroy();
  });
});

test('steering at 20 Hz does not eat the budget for ordinary actions', async () => {
  await withServer({ floodStrikes: 1 }, async (s) => {
    const { host, code } = await openRoom(s);
    const peer = await rawSocket(s.port, `/ws?room=${code}`);
    for (let i = 0; i < 20; i++) {
      peer.sock.write(mask(Buffer.from(`{"i":[${i},0,0,0,0]}`)));
      peer.sock.write(mask(Buffer.from(`{"d":{"n":${i}}}`)));
      await sleep(50);
    }
    await sleep(50);
    assert.strictEqual(peer.closeCode, null, 'never counted as a flood');
    assert.strictEqual(host.frames.filter((f) => f.t === 'i').length, 20);
    assert.strictEqual(host.frames.filter((f) => f.t === 'msg').length, 20);
    host.sock.destroy();
  });
});

test('malformed frames close that socket only and never crash the server', async () => {
  await withServer({}, async (s) => {
    const { host, code } = await openRoom(s);
    const bad = {
      unmasked: Buffer.from([0x81, 0x02, 0x7b, 0x7d]),
      'reserved bits': (() => {
        const f = mask(Buffer.from('{}'));
        f[0] |= 0x40;
        return f;
      })(),
      'unknown opcode': mask(Buffer.from('x'), 3),
      binary: mask(Buffer.from([1, 2, 3]), 2),
      'bad utf8': mask(Buffer.from([0xff, 0xfe])),
      'not json': mask(Buffer.from('hello')),
      'json but not object': mask(Buffer.from('[1,2]')),
      'lone continuation': mask(Buffer.from('x'), 0),
      'long ping': mask(Buffer.alloc(126, 0x41), 9),
      'fragmented ping': mask(Buffer.from('x'), 9, false),
      'one-byte close': mask(Buffer.from([1]), 8),
      'non-minimal length': (() => {
        const key = randomBytes(4);
        const h = Buffer.alloc(8);
        h[0] = 0x81;
        h[1] = 0x80 | 126;
        h.writeUInt16BE(2, 2);
        key.copy(h, 4);
        return Buffer.concat([h, Buffer.from([0x7b ^ key[0], 0x7d ^ key[1]])]);
      })(),
    };
    for (const [name, frame] of Object.entries(bad)) {
      const peer = await rawSocket(s.port, `/ws?room=${code}`);
      peer.sock.write(frame);
      await until(() => peer.closeCode !== null, `${name} refused`);
      assert.ok(peer.closeCode >= 1002 && peer.closeCode <= 1009, `${name}: ${peer.closeCode}`);
      peer.sock.destroy();
    }

    // A frame split into single bytes is still fine, and garbage then a hang-up is too.
    const slow = await rawSocket(s.port, `/ws?room=${code}`);
    for (const byte of mask(Buffer.from('{"d":{"slow":true}}'))) {
      slow.sock.write(Buffer.from([byte]));
      await sleep(1);
    }
    await until(() => host.frames.some((f) => f.t === 'msg' && f.d.slow), 'a byte-at-a-time frame still works');
    const rude = await rawSocket(s.port, `/ws?room=${code}`);
    rude.sock.write(randomBytes(3));
    rude.sock.destroy();

    await serverStillWorks(s);
    assert.ok(!host.closed);
    host.sock.destroy();
    slow.sock.destroy();
  });
});

test('a well-formed close frame is answered', async () => {
  await withServer({}, async (s) => {
    const { host } = await openRoom(s);
    const body = Buffer.alloc(2);
    body.writeUInt16BE(1000);
    host.sock.write(mask(body, 8));
    await until(() => host.closeCode !== null, 'close echoed');
    assert.strictEqual(host.closeCode, 1000);
  });
});

test('not a websocket: refused cleanly', async () => {
  await withServer({}, async (s) => {
    const plain = await fetch(`${base(s)}/ws`);
    assert.strictEqual(plain.status, 426);
    const reply = await new Promise((resolve) => {
      const sock = net.connect(s.port, '127.0.0.1', () => sock.write('GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 12\r\nSec-WebSocket-Key: abc\r\n\r\n'));
      let d = '';
      sock.on('data', (x) => (d += x));
      sock.on('close', () => resolve(d));
      sock.on('error', () => {});
    });
    assert.match(reply, /^HTTP\/1\.1 400/);
    await serverStillWorks(s);
  });
});

test('a page on another site cannot open a socket here', async () => {
  await withServer({}, async (s) => {
    const sock = net.connect(s.port, '127.0.0.1');
    let data = '';
    sock.on('data', (d) => (data += d.toString('latin1')));
    sock.on('error', () => {});
    sock.write(`GET /ws?as=host HTTP/1.1\r\nHost: 127.0.0.1:${s.port}\r\nOrigin: http://evil.example\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\n\r\n`);
    await until(() => data.includes('bad-origin'), 'refused with a readable reason');
    assert.strictEqual(s.roomCount(), 0);
    sock.destroy();
  });
});

test('caps: rooms, and connections to one room', async () => {
  await withServer({ maxRooms: 2, maxPeersPerRoom: 2 }, async (s) => {
    const a = await openRoom(s);
    await openRoom(s);
    const third = await rawSocket(s.port, '/ws?as=host');
    await until(() => third.closeCode !== null, 'third room refused');
    assert.strictEqual(third.closeCode, 4503);
    assert.strictEqual(s.roomCount(), 2);

    await rawSocket(s.port, `/ws?room=${a.code}`);
    await rawSocket(s.port, `/ws?room=${a.code}`);
    const over = await rawSocket(s.port, `/ws?room=${a.code}`);
    await until(() => over.closeCode !== null, 'third peer refused');
    assert.strictEqual(over.closeCode, 4409);
  });
});

test('rooms expire when idle or when the host never returns', async () => {
  await withServer({ roomIdleMs: 150, hostGoneMs: 60, sweepEveryMs: 20 }, async (s) => {
    const idle = await openRoom(s);
    const peer = await rawSocket(s.port, `/ws?room=${idle.code}`);
    await until(() => peer.closeCode !== null, 'idle room closed');
    assert.strictEqual(peer.closeCode, 4408);
    assert.strictEqual(s.roomCount(), 0);

    const gone = await openRoom(s);
    gone.host.sock.destroy();
    await until(() => s.roomCount() === 0, 'hostless room closed');
  });
});

test('a socket that goes silent is dropped by the heartbeat', async () => {
  await withServer({ pingEveryMs: 20, deadAfterMs: 100, roomIdleMs: 60000 }, async (s) => {
    const { host, code } = await openRoom(s);
    const peer = await rawSocket(s.port, `/ws?room=${code}`);
    await until(() => host.frames.some((f) => f.t === 'join'), 'join seen');
    await until(() => host.frames.some((f) => f.t === 'left') || peer.closed, 'silent peer dropped', 12000);
  });
});

test('path attempts outside the game are refused, the game is still served', async () => {
  await withServer({}, async (s) => {
    for (const attempt of ['/../package.json', '/../../../../Windows/win.ini', '/..%2f..%2f..%2fWindows%2fwin.ini', '/%2e%2e/%2e%2e/secret', '/..%5c..%5csecret', '/js/../../secret', '/a%00b']) {
      const reply = await rawHttp(s.port, attempt);
      assert.match(reply, /^HTTP\/1\.1 (403|404)/, attempt);
      assert.ok(!/\[fonts\]|\[extensions\]/i.test(reply), attempt);
    }
    const index = await fetch(`${base(s)}/index.html`);
    assert.strictEqual(index.status, 200);
    assert.match(index.headers.get('content-type'), /text\/html/);
    assert.strictEqual(index.headers.get('cache-control'), 'no-store');
    const root = await fetch(`${base(s)}/`);
    assert.strictEqual(root.status, 200);
    assert.strictEqual((await fetch(`${base(s)}/nope.js`)).status, 404);
  });
});

test('a sibling folder that merely starts with the game folder name is outside', async () => {
  await withServer({}, async (s) => {
    const folder = path.basename(path.resolve(__dirname, '..'));
    const reply = await rawHttp(s.port, `/../${folder}-evil/secret.txt`);
    assert.match(reply, /^HTTP\/1\.1 (403|404)/);
  });
});

test('/api/info says what is there, without exposing rooms', async () => {
  await withServer({}, async (s) => {
    const { code } = await openRoom(s);
    const res = await fetch(`${base(s)}/api/info`);
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
    const text = await res.text();
    const info = JSON.parse(text);
    assert.strictEqual(info.relay, true);
    assert.strictEqual(info.port, s.port);
    assert.strictEqual(info.joinable, false, 'localhost only by default');
    assert.deepStrictEqual(info.urls, []);
    assert.ok(!text.includes(code), 'room codes are not listed');
    const netInfo = await Net.info({ base: base(s) });
    assert.strictEqual(netInfo.relay, true);
  });
});

test('net.info reports no relay when nothing answers', async () => {
  const info = await Net.info({ base: 'http://127.0.0.1:9' });
  assert.deepStrictEqual(info, { relay: false });
});

test('joinUrl builds the phone link', () => {
  assert.strictEqual(Net.joinUrl('abcd', 'http://192.168.1.5:8766/'), 'http://192.168.1.5:8766/join.html?room=ABCD');
});

test('the QR script makes a code from the join link', () => {
  const qrcode = require('../vendor/qrcode.js');
  const qr = qrcode(0, 'M');
  qr.addData('http://192.168.1.5:8766/join.html?room=ABCD');
  qr.make();
  assert.ok(qr.getModuleCount() >= 21);
  assert.match(qr.createSvgTag(4, 8), /^<svg/);
});

test('the command line still works: port and bind address, on any free port', async () => {
  const serverPath = path.resolve(__dirname, '../tools/serve.mjs');
  const free = await new Promise((resolve) => {
    const probe = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
  const child = spawn(process.execPath, [serverPath, String(free), '0.0.0.0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  try {
    await until(() => out.includes('serving'), 'server start', 15000);
    assert.ok(out.includes(`:${free}/`));
    const info = await (await fetch(`http://127.0.0.1:${free}/api/info`)).json();
    assert.strictEqual(info.bound, '0.0.0.0');
    assert.strictEqual(info.joinable, info.lan.length > 0);
    const index = await fetch(`http://127.0.0.1:${free}/index.html`);
    assert.strictEqual(index.status, 200);
  } finally {
    child.kill();
  }
});

test('a phone can be told the host closed the room', async () => {
  await withServer({}, async (s) => {
    const host = freshHost(s);
    await until(() => host.code, 'code');
    const phone = await joined(s, host, 'A');
    host.close();
    await until(() => phone.status === 'closed', 'closed');
    assert.strictEqual(phone.statusCode, 'host-closed');
  });
});

test('no session leaves timers behind: the test process can exit', async () => {
  const s = Net.createLocal({ mode: 'one', scenarioId: 'moon', timing: FAST });
  s.close();
  assert.strictEqual(s.status, 'closed');
});
