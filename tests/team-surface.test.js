// Run with: node --test "tests/*.test.js"
// The surface mission (js/team/surface-sim.js), v2 calm exploration: determinism, no softlocks,
// no aliens or weapons, the loop completes on every world, hazards are fair, design choices matter.
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/team/surface-sim.js');

const WORLDS = ['moon', 'mars', 'venus', 'europa'];
const CALM_KINDS = new Set(['astronaut', 'lander', 'dish', 'site', 'sample', 'pickup', 'boulder']);
const COMBAT_EVENTS = new Set(['shot', 'turretShot', 'burst', 'down', 'dead', 'respawn', 'revive', 'hunterSpawn', 'hunterRoar', 'spit', 'burrowRumble', 'burrowPop', 'turretBuilt', 'droneOut', 'dry']);

function run(loadout, seed, opts, humans, inputFn, onTick) {
  const st = S.create(loadout, seed, humans || 0, opts || {});
  let guard = 0;
  while (!st.over && guard++ < 20000) {
    S.step(st, inputFn ? inputFn(st) : {}, S.TICK);
    if (onTick) onTick(st);
  }
  return st;
}

// Runs past the intro. step() caps a single call at 12 ticks, so a long dt would not get there.
function pastIntro(st) {
  while (st.stage === 'intro') S.step(st, {}, S.TICK);
}

function fingerprint(st) {
  return JSON.stringify({ t: st.t, outcome: st.outcome, rng: st.rng, ents: st.entities.map((e) => [e.id, e.kind, Math.round(e.x * 100), Math.round(e.z * 100), Math.round(e.hp * 10), e.state]) });
}

// Everyone else out of the way, parked aboard the lander.
function alone(st, keep) {
  for (const e of st.entities) if (e.kind === 'astronaut' && e !== keep) e.aboard = true;
}

test('same seed, loadout and inputs give the same mission', () => {
  for (const world of WORLDS) {
    const a = run(S.fixture('mid', world), 42);
    const b = run(S.fixture('mid', world), 42);
    assert.strictEqual(fingerprint(a), fingerprint(b), world);
  }
});

test('different seeds give different maps', () => {
  const uids = new Set();
  for (let seed = 0; seed < 8; seed++) uids.add(S.create(S.fixture('mid', 'mars'), seed, 0, {}).map.uid);
  assert.ok(uids.size >= 7, `only ${uids.size} distinct maps`);
});

test('state is plain JSON and a round trip continues the identical mission', () => {
  const a = S.create(S.fixture('good', 'mars'), 11, 0, {});
  for (let i = 0; i < 2400; i++) S.step(a, {}, S.TICK);
  const b = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 1800; i++) {
    S.step(a, {}, S.TICK);
    S.step(b, {}, S.TICK);
  }
  assert.strictEqual(fingerprint(a), fingerprint(b));
});

test('state carries no functions or shared object references', () => {
  const st = S.create(S.fixture('good', 'moon'), 3, 0, {});
  for (let i = 0; i < 1500; i++) S.step(st, {}, S.TICK);
  const seen = new Set();
  (function walk(v, path) {
    assert.notStrictEqual(typeof v, 'function', `function at ${path}`);
    if (v === null || typeof v !== 'object') return;
    assert.ok(!seen.has(v), `object referenced twice at ${path}`);
    seen.add(v);
    for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`);
  })(st, 'state');
});

test('movement is a small pure function a client can predict with', () => {
  const st = S.create(S.fixture('mid', 'mars'), 5, 0, {});
  const pos = Object.freeze({ x: st.map.lander.x + 5, z: st.map.lander.z, vx: 0, vz: 0, r: 0.7, speed: 7 });
  const input = Object.freeze({ moveX: 1, moveY: 0 });
  const tiles = st.map.tiles.slice();
  const a = S.stepMove(pos, input, S.TICK, st.map);
  const b = S.stepMove(pos, input, S.TICK, st.map);
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(st.map.tiles, tiles);
  assert.ok(a.x > pos.x, 'moved along +x');
  let p = { x: st.map.lander.x, z: st.map.lander.z, vx: 0, vz: 0, r: 0.7, speed: 20 };
  for (let i = 0; i < 900; i++) p = Object.assign(S.stepMove(p, { moveX: 1, moveY: 0.3 }, S.TICK, st.map), { speed: 20 });
  const cell = Math.floor(p.z / st.map.cell) * st.map.w + Math.floor(p.x / st.map.cell);
  assert.notStrictEqual(st.map.tiles[cell], 1, 'ended inside rock');
});

test('every map connects the lander to the dish, every site and every cave', () => {
  for (const world of WORLDS) {
    for (let seed = 0; seed < 40; seed++) {
      const load = S.fixture('mid', world);
      if (seed % 2) load.landing.offsetM = 60;
      const st = S.create(load, seed, 0, {});
      const { map } = st;
      const seen = new Set();
      const start = Math.floor(map.lander.z / map.cell) * map.w + Math.floor(map.lander.x / map.cell);
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const c = stack.pop();
        const i = c % map.w;
        for (const [n, ok] of [[c - 1, i > 0], [c + 1, i < map.w - 1], [c - map.w, c >= map.w], [c + map.w, c < map.w * (map.h - 1)]]) {
          if (!ok || seen.has(n)) continue;
          if (map.tiles[n] === 1 || map.tiles[n] === 3) continue;
          seen.add(n);
          stack.push(n);
        }
      }
      const reach = (e) => seen.has(Math.floor(e.z / map.cell) * map.w + Math.floor(e.x / map.cell));
      for (const e of st.entities) {
        if (e.kind === 'dish' || e.kind === 'site' || e.kind === 'pickup') assert.ok(reach(e), `${world} seed ${seed}: ${e.kind} ${e.id} unreachable`);
      }
    }
  }
});

test('no aliens, weapons, turrets, drones, medkits or rovers: old loadouts that still list them are ignored', () => {
  assert.deepStrictEqual(Object.keys(S.WEAPONS), []);
  assert.deepStrictEqual(Object.keys(S.ALIENS), []);
  for (const world of WORLDS) {
    const load = Object.assign(S.fixture('good', world), { weapons: ['cutter', 'laser', 'drill', 'flare'], turrets: 4, rover: true, drones: 2, medkits: 5 });
    run(load, 15, { hazards: world === 'mars' ? 'realistic' : 'anomalies' }, 1, () => ({ p0: { fire: true, swap: true, weapon: 'laser', ability: true } }), (st) => {
      for (const e of st.entities) assert.ok(CALM_KINDS.has(e.kind), `${world}: ${e.kind}`);
      for (const ev of st.events) assert.ok(!COMBAT_EVENTS.has(ev.type), `${world}: ${ev.type}`);
    });
  }
  // A drill listed under weapons still pulls cores; nothing else of the arsenal survives.
  const ld = S.normalizeLoadout({ weapons: ['drill'], rover: true, turrets: 3 });
  assert.ok(ld.drill.has);
  for (const k of ['weapons', 'rover', 'turrets', 'drones', 'medkits']) assert.ok(!(k in ld), k);
});

test('every loadout extreme runs to a real ending, on every world and difficulty', () => {
  for (const world of WORLDS) {
    for (const tier of ['empty', 'poor', 'mid', 'good', 'maxed']) {
      for (const difficulty of ['cadet', 'director']) {
        const st = run(S.fixture(tier, world), 77, { difficulty });
        assert.ok(st.over, `${world}/${tier}/${difficulty} never ended`);
        assert.ok(['extracted', 'stranded'].includes(st.outcome), `${world}/${tier}: ${st.outcome}`);
        // + the lander's wait and the 6.5 s throw-science-overboard decision.
        assert.ok(st.t <= st.T + S.TUNE.waitMaxS + S.TUNE.decisionS + 1, `${world}/${tier} ran past its clock: ${st.t}`);
      }
    }
  }
});

test('junk loadouts and inputs never crash the sim', () => {
  for (const raw of [undefined, null, {}, { weapons: 'gun', instruments: [null, 3], power: 'lots', uplink: { rateGbitS: NaN } }, { world: 'pluto', turrets: -4, medkits: 1e9, lifetimeS: 1, drill: 'yes' }]) {
    const st = S.create(raw, 1, [{ id: 'a', role: 'nonsense' }], { difficulty: 'wat', hazards: 'x' });
    for (let i = 0; i < 700 && !st.over; i++) S.step(st, { a: { moveX: 'left', moveY: Infinity, aimX: NaN, fire: 1, use: 'yes', ability: {}, weapon: 'bazooka', jettison: 'nope' } }, S.TICK);
    S.summary(st);
    S.statusFor(st, 'a');
    S.nextGoal(st, 'a');
  }
});

test('the whole loop completes on every world: scan, sample, dish, uplink, home', () => {
  for (const world of WORLDS) {
    for (let i = 0; i < 4; i++) {
      const st = run(S.fixture('good', world), 700 + i);
      const sum = S.summary(st);
      assert.strictEqual(sum.outcome, 'extracted', `${world} ${i}`);
      assert.strictEqual(sum.result, 'success', `${world} ${i}: ${sum.facts.map((f) => f.id)}`);
      assert.ok(sum.science.sitesDone >= sum.science.sitesTotal - 1, `${world}: ${sum.science.sitesDone}/${sum.science.sitesTotal} sites`);
      assert.ok(sum.samples.delivered >= 3, `${world}: samples ${sum.samples.delivered}`);
      assert.ok(sum.gbitSent > 50, `${world}: sent ${sum.gbitSent}`);
      assert.ok(sum.objectives.every((o) => o.done), `${world}: ${sum.objectives.filter((o) => !o.done).map((o) => o.id)}`);
      assert.strictEqual(sum.progress, 1);
      assert.strictEqual(sum.survivors, 4);
      assert.ok(st.t > 90 && st.t < st.T + 10, `${world}: ${st.t}`);
    }
  }
});

test('a good design succeeds and a poor one only partly, across many seeds', () => {
  for (const world of WORLDS) {
    const tally = (tier) => {
      const out = { success: 0, partial: 0, stranded: 0, value: 0 };
      for (let i = 0; i < 6; i++) {
        const sum = S.summary(run(S.fixture(tier, world), 300 + i));
        out[sum.result]++;
        out.value += sum.science.value;
      }
      return out;
    };
    const good = tally('good');
    const poor = tally('poor');
    assert.ok(good.success >= 5, `${world}: good succeeded ${good.success}/6`);
    assert.ok(poor.partial >= 4 && poor.success <= 1, `${world}: poor ${JSON.stringify(poor)}`);
    assert.ok(good.value > poor.value * 2, `${world}: science good ${good.value} vs poor ${poor.value}`);
  }
});

test('a human slot with no input does not break the bots, and the suit brings them home at the end', () => {
  const st = run(S.fixture('good', 'mars'), 9, {}, 1);
  assert.ok(st.over);
  assert.strictEqual(st.outcome, 'extracted');
  const me = st.entities.find((e) => e.kind === 'astronaut' && !e.isBot);
  assert.ok(me.aboard, 'the idle human is aboard at liftoff');
});

test('the ascent trade-off really happens: low fuel throws science overboard', () => {
  let dumped = 0;
  let heavy = 0;
  let light = 0;
  for (let i = 0; i < 6; i++) {
    const heavyLoad = S.fixture('good', 'mars');
    heavyLoad.ascent.liftKg = 500;
    const lightLoad = S.fixture('good', 'mars');
    lightLoad.ascent.liftKg = 30;
    const a = S.summary(run(heavyLoad, 900 + i));
    const b = S.summary(run(lightLoad, 900 + i));
    if (b.samples.jettisoned > 0) dumped++;
    assert.ok(b.ascent.massReturnedKg <= 30.001, 'never lifts more than the fuel allows');
    heavy += a.samples.valueReturned;
    light += b.samples.valueReturned;
  }
  assert.ok(dumped >= 4, `samples dumped in only ${dumped}/6 missions`);
  assert.ok(heavy > light * 1.5, `samples returned: rich fuel ${heavy}, poor fuel ${light}`);
});

test('a crew can choose what goes overboard', () => {
  const st = S.create(S.fixture('good', 'mars'), 8, 0, {});
  st.stage = 'extraction';
  st.extraction.called = true;
  st.extraction.timer = 5;
  st.ascent.rack.push({ id: 'x1', siteKind: 'ice', massKg: 200, value: 1, core: false }, { id: 'x2', siteKind: 'ice', massKg: 5, value: 50, core: false });
  st.ascent.loadedKg = 205;
  const human = st.entities.find((e) => e.kind === 'astronaut');
  human.isBot = false;
  human.bot = null;
  S.step(st, { [human.playerId]: { jettison: 'x1' } }, S.TICK);
  assert.ok(st.ascent.jettisoned.some((r) => r.id === 'x1'));
  assert.ok(st.ascent.loadedKg <= 110);
});

test('each role does its own job, and none of them is a weapon', () => {
  const crew = (role) => {
    const st = S.create(S.fixture('good', 'mars'), 2, [{ id: 'h', role }], {});
    const p = st.entities.find((e) => e.playerId === 'h');
    pastIntro(st);
    alone(st, p);
    return { st, p };
  };
  const plantTime = (role) => {
    const { st, p } = crew(role);
    const dish = st.entities.find((e) => e.kind === 'dish');
    p.x = dish.x + 1;
    p.z = dish.z;
    let n = 0;
    while (!dish.planted && n++ < 400) S.step(st, { h: { use: true } }, S.TICK);
    return n;
  };
  assert.ok(plantTime('comms') * 2 < plantTime('planner'), 'comms plants faster');
  const scanTime = (role) => {
    const { st, p } = crew(role);
    const site = st.entities.find((e) => e.kind === 'site' && e.fits);
    p.x = site.x;
    p.z = site.z;
    let n = 0;
    while (!site.done && n++ < 1200) S.step(st, { h: { use: true } }, S.TICK);
    return n;
  };
  assert.ok(scanTime('scientist') * 1.6 < scanTime('comms'), 'scientist scans fastest');
  // The engineer patches a worn suit.
  {
    const { st, p } = crew('engineer');
    p.hp = 40;
    S.step(st, { h: { ability: true } }, S.TICK);
    assert.ok(p.hp >= 74, `patched to ${p.hp}`);
  }
  // The planner calls everyone home by holding the ability.
  {
    const { st } = crew('planner');
    for (let i = 0; i < 45 * 30; i++) S.step(st, {}, S.TICK);
    let n = 0;
    while (st.stage === 'play' && n++ < 60) S.step(st, { h: { ability: true } }, S.TICK);
    assert.ok(st.extraction.called && st.stage !== 'play', st.stage);
    assert.strictEqual(st.extraction.by, st.entities.find((e) => e.playerId === 'h').id);
  }
});

test('out of air, an astronaut walks home on autopilot, rests, and carries on: nobody dies', () => {
  const st = S.create(S.fixture('good', 'mars'), 2, [{ id: 'h', role: 'scientist' }], {});
  pastIntro(st);
  const p = st.entities.find((e) => e.playerId === 'h');
  alone(st, p);
  const site = st.entities.find((e) => e.kind === 'site');
  p.x = site.x;
  p.z = site.z;
  p.o2 = 0.01;
  S.step(st, { h: { moveX: 1 } }, S.TICK);
  assert.strictEqual(p.returning, 'oxygen');
  const L = st.map.lander;
  const x0 = p.x;
  let n = 0;
  // Input is ignored on the way home.
  while (p.returning && n++ < 3000) S.step(st, { h: { moveX: x0 > L.x ? 1 : -1, use: true } }, S.TICK);
  assert.ok(!p.returning, 'reached the lander');
  assert.ok(Math.hypot(p.x - L.x, p.z - L.z) < S.TUNE.landerRadius, 'at the lander');
  assert.ok(p.restT > 0, 'resting while the suit is serviced');
  for (let i = 0; i < (S.TUNE.restS + 1) * 30; i++) S.step(st, {}, S.TICK);
  assert.ok(p.restT <= 0 && p.o2 > 60, `back out with air: ${p.o2}`);
  assert.ok(!p.downed && !p.dead && !p.aboard);
  assert.strictEqual(st.stats.returns, 1);
  assert.strictEqual(S.summary(st).crew.returnsBy.oxygen, 1);
});

test('a worn-out suit and a flat battery send people home too', () => {
  for (const [field, reason] of [['hp', 'suit'], ['energy', 'battery']]) {
    const st = S.create(S.fixture('good', 'moon'), 4, [{ id: 'h' }], {});
    pastIntro(st);
    const p = st.entities.find((e) => e.playerId === 'h');
    alone(st, p);
    const site = st.entities.find((e) => e.kind === 'site');
    p.x = site.x;
    p.z = site.z;
    p[field] = 0;
    S.step(st, {}, S.TICK);
    if (field === 'hp') {
      // Wear only counts through hazards: drop a rock on them.
      st.hazards.push({ id: 'hx', kind: 'rockfall', x: p.x, z: p.z, r: 3, state: 'warn', tLeft: 0.01 });
      p.hp = 1;
      S.step(st, {}, S.TICK * 2);
    }
    assert.strictEqual(p.returning, reason, field);
  }
});

test('radiation is fair: a long warning, shelter at the lander protects, the open costs suit wear but not a life', () => {
  for (const world of ['moon', 'europa']) {
    let warned = null;
    let started = null;
    const st = S.create(S.fixture('good', world), 5, [{ id: 'in' }, { id: 'out' }], { fillBots: false });
    pastIntro(st);
    const [pin, pout] = ['in', 'out'].map((id) => st.entities.find((e) => e.playerId === id));
    const L = st.map.lander;
    const far = st.entities.filter((e) => e.kind === 'site').sort((a, b) => Math.hypot(b.x - L.x, b.z - L.z) - Math.hypot(a.x - L.x, a.z - L.z))[0];
    let worn = 0;
    while (!st.over && st.t < st.T - 40) {
      // Keep both topped up so only radiation matters.
      pin.o2 = pout.o2 = 100;
      pin.energy = pout.energy = 100;
      pin.x = L.x + 3;
      pin.z = L.z;
      if (!pout.returning && pout.restT <= 0) {
        pout.x = far.x;
        pout.z = far.z;
      }
      const before = pout.hp;
      S.step(st, {}, S.TICK);
      worn += Math.max(0, before - pout.hp);
      for (const ev of st.events) {
        if (ev.type === 'hazardWarn' && ev.kind === 'radiation' && warned === null) warned = ev.t;
        if (ev.type === 'hazardStart' && ev.kind === 'radiation' && started === null) started = ev.t;
      }
      assert.strictEqual(pin.hp, 100, `${world}: sheltered astronaut took wear at ${st.t}`);
      assert.ok(!pout.dead && !pout.downed);
    }
    assert.ok(warned !== null && started !== null, `${world}: a radiation spike happened`);
    assert.ok(started - warned >= 10, `${world}: warned ${started - warned} s ahead`);
    assert.ok(worn > 20, `${world}: the open cost ${worn} suit`);
  }
});

test('rockfalls are marked well before they land and cost a bounded amount', () => {
  let quakes = 0;
  for (let seed = 0; seed < 4; seed++) {
    const st = S.create(S.fixture('good', 'moon'), seed, 0, {});
    const marked = new Map();
    while (!st.over) {
      S.step(st, {}, S.TICK);
      for (const h of st.hazards) if (h.kind === 'rockfall' && !marked.has(h.id)) marked.set(h.id, { at: st.t, left: h.tLeft });
      for (const ev of st.events) if (ev.type === 'quake') quakes++;
    }
    for (const m of marked.values()) assert.ok(m.left >= 1.7, `a rock gave only ${m.left.toFixed(2)} s warning`);
  }
  assert.ok(quakes > 0, 'moonquakes happen');
});

test('dust storms slow the walk and drain the suit battery; cold nights cost more air', () => {
  const walk = (stormy) => {
    const st = S.create(S.fixture('good', 'mars'), 3, [{ id: 'h' }], {});
    pastIntro(st);
    const p = st.entities.find((e) => e.playerId === 'h');
    alone(st, p);
    st.hazardPlan = [];
    if (stormy) st.hazards.push({ id: 'hs', kind: 'storm', x: 0, z: 0, r: 999, state: 'active', tLeft: 60, dur: 60 });
    const site = st.entities.find((e) => e.kind === 'site');
    p.x = site.x;
    p.z = site.z;
    const e0 = p.energy;
    let moved = 0;
    for (let i = 0; i < 60; i++) {
      const x = p.x;
      const z = p.z;
      S.step(st, { h: { moveX: i % 40 < 20 ? 1 : -1 } }, S.TICK);
      moved += Math.hypot(p.x - x, p.z - z);
    }
    return { moved, used: e0 - p.energy };
  };
  const calm = walk(false);
  const storm = walk(true);
  assert.ok(storm.moved < calm.moved * 0.9, `storm walk ${storm.moved} vs ${calm.moved}`);
  assert.ok(storm.used > calm.used * 1.5, `storm battery ${storm.used} vs ${calm.used}`);

  const air = (night) => {
    const st = S.create(S.fixture('good', 'mars'), 3, [{ id: 'h' }], {});
    pastIntro(st);
    const p = st.entities.find((e) => e.playerId === 'h');
    alone(st, p);
    const site = st.entities.find((e) => e.kind === 'site');
    if (night) while (st.sun.up) S.step(st, {}, S.TICK);
    p.x = site.x;
    p.z = site.z;
    p.o2 = 100;
    for (let i = 0; i < 90; i++) S.step(st, {}, S.TICK);
    return 100 - p.o2;
  };
  assert.ok(air(true) > air(false) * 1.15, 'the cold costs air');
});

test('one alarm at a time: hazard warnings never overlap', () => {
  for (const world of WORLDS) {
    for (let seed = 0; seed < 10; seed++) {
      const st = S.create(S.fixture('good', world), seed, 0, { difficulty: 'director' });
      const plan = st.hazardPlan;
      for (let i = 1; i < plan.length; i++) {
        const prevEnd = plan[i - 1].t + plan[i - 1].dur;
        assert.ok(plan[i].t - plan[i].warn >= prevEnd, `${world} seed ${seed}: ${plan[i - 1].kind} and ${plan[i].kind} overlap`);
      }
      assert.ok(plan.every((h) => h.warn >= 4), 'every hazard is announced');
    }
  }
});

test('no softlocks: wandering, idle and button-mashing people always reach an ending', () => {
  for (const world of WORLDS) {
    for (const difficulty of ['cadet', 'engineer', 'director']) {
      let r = 12345;
      const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      let held = { moveX: 0, moveY: 0 };
      const st = run(S.fixture('mid', world), 61, { difficulty }, [{ id: 'w' }, { id: 'i' }, { id: 'm' }], (s) => {
        if (s.tick % 45 === 0) held = { moveX: rand() * 2 - 1, moveY: rand() * 2 - 1 };
        return { w: held, m: { use: s.tick % 3 === 0, ability: s.tick % 7 === 0, sprint: true, moveX: Math.sin(s.t), moveY: Math.cos(s.t * 0.7) } };
      });
      assert.ok(st.over, `${world}/${difficulty}`);
      assert.ok(st.t <= st.T + S.TUNE.waitMaxS + S.TUNE.decisionS + 1, `${world}/${difficulty}: ${st.t}`);
      const sum = S.summary(st);
      assert.ok(['success', 'partial', 'stranded'].includes(sum.result));
    }
  }
});

test('a crew member who ignores the call home can strand the mission, and the summary says why', () => {
  const st = S.create(S.fixture('good', 'mars'), 12, [{ id: 'h' }], {});
  pastIntro(st);
  const p = st.entities.find((e) => e.playerId === 'h');
  const L = st.map.lander;
  // The farthest walkable cell from the lander.
  let far = null;
  let fd = 0;
  for (let j = 0; j < st.map.h; j++) {
    for (let i = 0; i < st.map.w; i++) {
      const t = st.map.tiles[j * st.map.w + i];
      if (t === 1 || t === 3) continue;
      const x = (i + 0.5) * st.map.cell;
      const z = (j + 0.5) * st.map.cell;
      const d = Math.hypot(x - L.x, z - L.z);
      if (d > fd) {
        fd = d;
        far = { x, z };
      }
    }
  }
  assert.ok(fd > 110, `farthest point only ${fd} m`);
  st.stage = 'extraction';
  st.extraction.called = true;
  st.extraction.timer = 0.2;
  let n = 0;
  while (!st.over && n++ < 3000) {
    if (!p.returning) {
      p.x = far.x;
      p.z = far.z;
    }
    p.o2 = 100;
    S.step(st, {}, S.TICK);
  }
  assert.strictEqual(st.outcome, 'stranded');
  const sum = S.summary(st);
  assert.strictEqual(sum.result, 'stranded');
  assert.strictEqual(sum.extracted, false);
  assert.ok(sum.facts.some((f) => f.id === 'end_stranded'));
  assert.ok(!sum.facts.some((f) => f.id === 'ascent_ok'), 'no liftoff claimed');
  assert.ok(st.stats.boilKg > 5, 'waiting boiled off ascent margin');
});

test('only carried instruments can scan what they fit', () => {
  const load = S.fixture('good', 'mars');
  load.instruments = [{ id: 'x', fits: ['thermal'], rate: 1, value: 1 }];
  const st = S.create(load, 4, 0, {});
  for (const e of st.entities) if (e.kind === 'site') assert.strictEqual(e.fits, e.siteKind === 'thermal', e.siteKind);
  const sum = S.summary(run(load, 4));
  assert.ok(!sum.science.objectiveMet, 'the objective cannot be met without its instrument');
  assert.notStrictEqual(sum.result, 'success');
  assert.ok(sum.facts.some((f) => f.id === 'no_instrument'), 'the summary says why');
});

test('data only counts after uplink, and a dead radio sends nothing', () => {
  const load = S.fixture('good', 'mars');
  load.uplink.rateGbitS = 0;
  const sum = S.summary(run(load, 6));
  assert.strictEqual(sum.science.gbitSent, 0);
  assert.strictEqual(sum.science.valueSent, 0);
  assert.ok(sum.science.gbitScanned > 0, 'the crew still scanned');
  assert.ok(sum.facts.some((f) => f.id === 'data_lost_unsent'));
});

test('a full recorder stops new data', () => {
  const st = S.create(Object.assign(S.fixture('good', 'mars'), { recorderGbit: 12 }), 3, 0, {});
  for (let i = 0; i < 4000 && !st.over; i++) {
    S.step(st, {}, S.TICK);
    assert.ok(st.recorder.usedGbit <= 12.001, `recorder held ${st.recorder.usedGbit}`);
  }
});

test('small batteries run short at night, big ones do not', () => {
  const dark = (wh, solar) => {
    let total = 0;
    for (let i = 0; i < 4; i++) {
      const load = S.fixture('good', 'mars');
      load.power.batteryWh = wh;
      load.power.solarW = solar;
      load.lifetimeS = 330;
      // Mixed crew: bots wait for the person, so the mission runs into the night.
      total += S.summary(run(load, 40 + i, {}, 1)).power.darkS;
    }
    return total / 4;
  };
  const small = dark(300, 1500);
  const big = dark(40000, 20000);
  assert.ok(small > 25, `small battery was short ${small.toFixed(0)} s`);
  assert.ok(big < 1, `big battery was short ${big.toFixed(1)} s`);
});

test('uplink windows follow the orbit choice', () => {
  const windows = (everyS, windowS) => S.create(Object.assign(S.fixture('good', 'mars'), { uplink: { rateGbitS: 4, everyS, windowS, firstS: 40 } }), 1, 0, {}).uplink.windows;
  assert.ok(windows(40, 20).length > windows(140, 20).length);
  assert.ok(windows(60, 30).every((w) => w.dur === 30));
});

test('the progress tracker climbs to 100% on a good mission and statusFor carries it', () => {
  const st = S.create(S.fixture('good', 'venus'), 33, [{ id: 'h' }], {});
  let last = 0;
  let drops = 0;
  let guard = 0;
  while (!st.over && guard++ < 20000) {
    S.step(st, {}, S.TICK);
    if (st.progress < last - 0.05) drops++;
    last = st.progress;
    assert.ok(st.progress >= 0 && st.progress <= 1);
  }
  assert.strictEqual(drops, 0, 'progress never falls back noticeably');
  const sum = S.summary(st);
  assert.ok(sum.progress > 0.95, `ended at ${sum.progress}`);
  assert.deepStrictEqual(sum.objectives.map((o) => o.id), ['scan', 'sample', 'dish', 'send', 'science', 'home']);
  for (const o of sum.objectives) assert.ok(o.text && !/\{\w+\}/.test(o.text), o.text);
  const mid = S.create(S.fixture('good', 'mars'), 1, [{ id: 'h' }], {});
  for (let i = 0; i < 900; i++) S.step(mid, {}, S.TICK);
  const status = S.statusFor(mid, 'h');
  assert.ok(Number.isInteger(status.progress) && status.progress >= 0 && status.progress <= 100);
  assert.strictEqual(typeof status.goal, 'string');
  assert.ok(status.weapon === null && status.flares === undefined && status.medkits === undefined);
});

test('the next goal always points somewhere real', () => {
  for (const world of WORLDS) {
    const st = S.create(S.fixture('mid', world), 7, [{ id: 'h' }], {});
    let guard = 0;
    while (!st.over && guard++ < 20000) {
      S.step(st, {}, S.TICK);
      if (st.tick % 60) continue;
      const g = S.nextGoal(st, 'h');
      assert.ok(g && g.id && g.target && Number.isFinite(g.target.x) && Number.isFinite(g.target.z), `${world} at ${st.t}: ${JSON.stringify(g)}`);
    }
  }
});

test('the summary explains the mission with causal facts the debrief chain can read', () => {
  const sum = S.summary(run(S.fixture('poor', 'mars'), 21));
  assert.ok(sum.facts.length > 0);
  for (const f of sum.facts) assert.ok(f.id && f.kind && f.text && f.part, JSON.stringify(f));
  for (const k of ['outcome', 'crewTotal', 'survivors', 'scienceFrac', 'gbitSent', 'baseDark', 'samplesKg', 'samplesLeftKg', 'liftKg', 'setsLost', 'overrunWave', 'cause']) assert.ok(k in sum, `missing ${k}`);
  // Nothing in it may read as combat: no "overrun" wave, no "eaten" cause.
  assert.strictEqual(sum.overrunWave, null);
  assert.ok(!['crew_lost', 'base_dark'].includes(sum.cause), sum.cause);
});

test('perPlayer credits each astronaut for what they did, without kills', () => {
  const st = run(S.fixture('good', 'mars'), 31);
  const sum = S.summary(st);
  assert.strictEqual(sum.perPlayer.length, 4);
  for (const p of sum.perPlayer) {
    for (const k of ['name', 'role']) assert.strictEqual(typeof p[k], 'string', k);
    for (const k of ['scans', 'carried', 'dropped', 'returns']) assert.ok(Number.isInteger(p[k]) && p[k] >= 0, k);
    for (const k of ['kills', 'revives', 'downs']) assert.ok(!(k in p), k);
  }
  const total = (k) => sum.perPlayer.reduce((n, p) => n + p[k], 0);
  assert.ok(total('scans') >= sum.science.sitesDone - 0, 'every finished scan is credited');
  assert.ok(total('carried') <= sum.samples.delivered);
  assert.strictEqual(total('returns'), sum.crew.returns);
});

test('every fact has a translation key and fills its English', () => {
  const ids = new Set();
  const loads = [S.fixture('poor', 'mars'), S.fixture('good', 'mars'), S.fixture('empty', 'moon'), S.fixture('mid', 'europa')];
  loads.forEach((load, i) => {
    for (let seed = 0; seed < 4; seed++) {
      for (const f of S.summary(run(load, 80 + i * 10 + seed)).facts) {
        ids.add(f.id);
        assert.ok(f.key in S.STRINGS, f.key);
        assert.ok(f.whyKey in S.STRINGS, f.whyKey);
        assert.ok(f.params && typeof f.params === 'object', f.id);
        assert.ok(!/\{\w+\}/.test(f.text + f.why), 'unfilled placeholder: ' + f.text + ' / ' + f.why);
      }
    }
  });
  assert.ok(ids.size >= 7, 'only saw ' + [...ids].join(','));
});

test('facts come out in the current language when a dictionary has them', () => {
  const SMD = globalThis.SMD;
  const had = SMD.t;
  SMD.t = (key, english, params) => (key === 'team.surface.fact.objective_missed' ? 'AR' : String(english).replace(/\{(\w+)\}/g, (m, k) => params[k]));
  try {
    const load = S.fixture('good', 'mars');
    load.instruments = [{ id: 'x', fits: ['thermal'], rate: 1, value: 1 }];
    const sum = S.summary(run(load, 3));
    assert.strictEqual(sum.facts.find((f) => f.id === 'objective_missed').text, 'AR');
  } finally {
    if (had) SMD.t = had;
    else delete SMD.t;
  }
});

test('a single step call catches up gradually instead of spiralling', () => {
  const st = S.create(S.fixture('good', 'mars'), 1, 0, {});
  S.step(st, {}, 10);
  assert.strictEqual(st.tick, 12);
  S.step(st, {}, 0);
  assert.ok(st.acc > 0, 'the rest of the time is carried over');
});

test('events are emitted for one step only', () => {
  const st = S.create(S.fixture('good', 'mars'), 1, 0, {});
  S.step(st, {}, 8);
  const stamp = st.t;
  for (const e of st.events) assert.ok(e.t > 0 && e.t <= stamp + 1e-9 && typeof e.type === 'string');
  S.step(st, {}, 0.001);
  assert.ok(st.events.length === 0 || st.events.every((e) => e.t >= stamp));
});

test('nothing hurts an idle crew in the first 25 seconds, on the real designs', () => {
  const vm = require('vm');
  const fs = require('fs');
  const ctx = { console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['js/physics.js', 'js/data.js', 'js/model.js', 'js/team/data.js', 'js/team/sim.js', 'js/team/surface-sim.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  const { sim: Sim, surface: U } = ctx.SMD.team;
  for (const scn of WORLDS) {
    for (let seed = 1; seed <= 6; seed++) {
      const d = Sim.newDesign(scn, 'engineer', Sim.scenarios().find((x) => x.id === scn).requirements[0].id);
      const players = ['planner', 'engineer', 'scientist', 'comms'].map((r, i) => ({ id: 'p' + i, name: r, role: r, bot: false }));
      const load = Sim.surfaceLoadout(d);
      const st = U.create(load, seed * 101, players, { difficulty: 'engineer', world: load.world });
      for (let t = 0; t < 25; t += 1 / 30) {
        U.step(st, {}, 1 / 30);
        const hurt = (st.events || []).find((e) => e.type === 'hit' || e.type === 'suitReturn');
        assert.equal(hurt, undefined, `${scn} seed ${seed} at ${t.toFixed(1)}s: ${JSON.stringify(hurt)}`);
      }
    }
  }
});

test('network snapshots carry the calm state: suits, autopilot, objectives and progress', () => {
  const Net = require('../js/team/surface-net.js');
  const st = S.create(S.fixture('good', 'mars'), 5, [{ id: 'h' }], {});
  for (let i = 0; i < 2600; i++) S.step(st, {}, S.TICK);
  const p = st.entities.find((e) => e.playerId === 'h');
  const far = st.entities.find((e) => e.kind === 'site');
  p.x = far.x;
  p.z = far.z;
  p.returning = 'oxygen';
  const enc = Net.createEncoder();
  const dec = Net.createDecoder();
  for (const c of Net.chunks(enc.init(st))) dec.packet(c);
  let max = 0;
  let out = null;
  for (let i = 0; i < 6; i++) {
    const bytes = enc.encode(st, { slow: i === 0 });
    max = Math.max(max, bytes.length);
    if (dec.packet(bytes) === 'snapshot') out = dec.latest;
    S.step(st, {}, S.TICK);
  }
  assert.ok(out, 'decoded');
  assert.ok(max < Net.MAX_BYTES, `snapshot ${max} bytes`);
  const me = out.entities.find((e) => e.kind === 'astronaut' && e.playerId === 'h');
  assert.strictEqual(me.returning, 'oxygen');
  assert.ok(Math.abs(out.progress - st.progress) < 0.02);
  assert.deepStrictEqual(out.objectives.map((o) => o.id), st.objectives.map((o) => o.id));
  assert.ok(out.objectives.every((o) => typeof o.text === 'string' && o.text.length));
  assert.ok(out.map.caves.length === st.map.caves.length);
  assert.ok(out.entities.every((e) => CALM_KINDS.has(e.kind)));
  // The HUD's next-goal reader works on a decoded state too.
  const g = S.nextGoal(out, 'h');
  assert.ok(g && g.target && Number.isFinite(g.target.x));
});
