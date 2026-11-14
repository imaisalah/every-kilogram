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
  // Honest inputs for the score: a stranded crew brought nobody home, however many sat in the cabin.
  assert.strictEqual(sum.survivors, 0);
  assert.strictEqual(sum.crew.aboard, 0);
  assert.strictEqual(sum.score.survival, 0);
  assert.strictEqual(sum.samples.returned, 0);
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
  assert.deepStrictEqual(sum.objectives.map((o) => o.id), ['scan', 'sample', 'dish', 'send', 'science', 'systems', 'home']);
  assert.ok(Math.abs(sum.objectives.reduce((n, o) => n + o.weight, 0) - 1) < 1e-9, 'weights add up to 1');
  for (const o of sum.objectives) assert.strictEqual(o.job, S.OBJECTIVE_JOB[o.id], o.id);
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
  const st = S.create(S.fixture('good', 'mars'), 5, [{ id: 'h', role: 'engineer', name: 'Mateo', crewId: 'mateo', playerName: 'Bea' }], {});
  for (let i = 0; i < 2600; i++) S.step(st, {}, S.TICK);
  st.faults.push({ id: 'fq', kind: 'charger', x: st.map.lander.x - 4.6, z: st.map.lander.z, fixT: 0.5, since: st.t });
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
  // v3: the character, the person, the jobs rule and the lander faults travel too.
  assert.strictEqual(me.crewId, 'mateo');
  assert.strictEqual(me.playerName, 'Bea');
  assert.strictEqual(me.name, 'Mateo');
  assert.strictEqual(out.jobs, true);
  assert.ok(out.faults.some((f) => f.kind === 'charger' && Math.abs(f.fixT - st.faults.find((x) => x.id === 'fq').fixT) < 0.02), JSON.stringify(out.faults));
  me.returning = null;
  me.restT = 0;
  me.carrying = null;
  me.o2 = 90;
  me.energy = 90;
  out.hazards = [];
  assert.strictEqual(S.nextGoal(out, 'h').id, 'repair', 'the engineer is sent to the fault on a client too');
});

// ---------------------------------------------------------------- docs/TEAM-V3.md item 5: jobs
// One person in a job; the other three are people standing at the lander (so their jobs are taken).
function jobCrew(role, world) {
  const st = S.create(S.fixture('good', world || 'mars'), 2, [{ id: 'h', role }], {});
  const p = st.entities.find((e) => e.playerId === 'h');
  pastIntro(st);
  for (const e of st.entities) {
    if (e.kind !== 'astronaut' || e === p) continue;
    e.isBot = false;
    e.bot = null;
    e.x = st.map.lander.x;
    e.z = st.map.lander.z;
  }
  return { st, p };
}

test('jobs: only the scientist scans, only Communications plants the dish', () => {
  const scans = (role) => {
    const { st, p } = jobCrew(role);
    const site = st.entities.find((e) => e.kind === 'site' && e.fits);
    p.x = site.x;
    p.z = site.z;
    for (let i = 0; i < 90; i++) S.step(st, { h: { use: true } }, S.TICK);
    return { scanned: site.scanned, prompt: st.prompts.h };
  };
  assert.ok(scans('scientist').scanned > 0.1, 'the scientist scans');
  assert.strictEqual(scans('scientist').prompt, 'scan');
  for (const role of ['planner', 'engineer', 'comms']) {
    const r = scans(role);
    assert.strictEqual(r.scanned, 0, `${role} cannot scan`);
    assert.ok(r.prompt !== 'scan' && r.prompt !== 'needs_instrument', `${role} gets no scan prompt (${r.prompt})`);
  }
  const plants = (role) => {
    const { st, p } = jobCrew(role);
    const dish = st.entities.find((e) => e.kind === 'dish');
    p.x = dish.x + 1;
    p.z = dish.z;
    for (let i = 0; i < 200; i++) S.step(st, { h: { use: true } }, S.TICK);
    return dish.planted;
  };
  assert.ok(plants('comms'), 'Communications plants the dish');
  for (const role of ['planner', 'engineer', 'scientist']) assert.ok(!plants(role), `${role} cannot plant`);
  // Carrying samples is everyone's.
  const { st, p } = jobCrew('engineer');
  p.x += 20;
  st.entities.push({ id: 'sx', kind: 'sample', x: p.x + 1, z: p.z, r: 0.7, state: 'ground', siteKind: 'ice', siteId: 'site0', massKg: 10, value: 50, core: false, heldBy: null, objective: false, heading: 0, hp: 1, maxHp: 1 });
  S.step(st, { h: { use: true } }, S.TICK);
  assert.strictEqual(p.carrying, 'sx', 'the engineer picks up a sample');
});

test('jobs: with nobody in a job, anyone covers it; jobs:false is the old shared mission', () => {
  const st = S.create(S.fixture('good', 'mars'), 2, [{ id: 'h', role: 'comms' }], { fillBots: false });
  pastIntro(st);
  const p = st.entities.find((e) => e.playerId === 'h');
  const site = st.entities.find((e) => e.kind === 'site' && e.fits);
  p.x = site.x;
  p.z = site.z;
  for (let i = 0; i < 60; i++) S.step(st, { h: { use: true } }, S.TICK);
  assert.ok(site.scanned > 0, 'a lone comms astronaut may scan');
  const old = S.create(S.fixture('good', 'mars'), 2, [{ id: 'h', role: 'comms' }], { jobs: false });
  pastIntro(old);
  const q = old.entities.find((e) => e.playerId === 'h');
  const s2 = old.entities.find((e) => e.kind === 'site' && e.fits);
  q.x = s2.x;
  q.z = s2.z;
  for (let i = 0; i < 60; i++) S.step(old, { h: { use: true } }, S.TICK);
  assert.ok(s2.scanned > 0);
  assert.strictEqual(old.faultTotal, 0);
  assert.ok(!S.summary(run(S.fixture('good', 'moon'), 5, { jobs: false })).objectives.some((o) => o.id === 'systems'));
});

test('jobs: the engineer fixes lander faults; left alone they cost power and suit charging', () => {
  const { st, p } = jobCrew('engineer');
  st.faultPlan = [];
  const L = st.map.lander;
  st.faults.push({ id: 'fx', kind: 'panels', x: L.x + 4.8, z: L.z + 0.6, fixT: 0, since: st.t });
  st.faults.push({ id: 'fy', kind: 'charger', x: L.x - 4.6, z: L.z - 0.8, fixT: 0, since: st.t });
  const base0 = S.create(S.fixture('good', 'mars'), 2, 0, {});
  pastIntro(base0);
  S.step(st, {}, S.TICK);
  S.step(base0, {}, S.TICK);
  assert.ok(st.base.solarW < base0.base.solarW * 0.5, `dusty panels: ${st.base.solarW} vs ${base0.base.solarW}`);
  p.energy = 20;
  p.x = L.x - 4.6;
  p.z = L.z - 0.8;
  S.step(st, {}, S.TICK);
  assert.ok(!st.base.chargerOn, 'a tripped charger does not charge');
  assert.strictEqual(st.prompts.h, 'repair');
  let n = 0;
  while (st.faults.some((f) => f.id === 'fy') && n++ < 400) S.step(st, { h: { use: true } }, S.TICK);
  assert.ok(n < 400 && n >= S.TUNE.repairS * 30 - 2, `fixed in ${n} ticks`);
  assert.strictEqual(p.tally.repairs, 1);
  // A scientist standing on it cannot fix it.
  const sc = jobCrew('scientist');
  sc.st.faultPlan = [];
  sc.st.faults.push({ id: 'fz', kind: 'panels', x: sc.p.x, z: sc.p.z, fixT: 0, since: 0 });
  for (let i = 0; i < 200; i++) S.step(sc.st, { h: { use: true } }, S.TICK);
  assert.ok(sc.st.faults.length === 1 && sc.st.prompts.h !== 'repair');
  // All-bot crews fix every fault that happens.
  for (const world of WORLDS) {
    const sum = S.summary(run(S.fixture('good', world), 710));
    assert.ok(sum.faults.seen >= 1 && sum.faults.fixed === sum.faults.seen, `${world}: ${JSON.stringify(sum.faults)}`);
  }
});

test('jobs: the next goal and the prompts are only about your own job', () => {
  const allowed = {
    scientist: ['scan', 'sample', 'home'],
    comms: ['plant', 'align', 'hold', 'wait', 'sample', 'home'],
    engineer: ['repair', 'patch', 'sample', 'systems'],
    planner: ['call', 'route', 'sample', 'watch'],
  };
  const shared = ['over', 'return', 'returning', 'rest', 'shelter', 'deliver', 'resupply'];
  const promptsOf = { scientist: ['scan', 'needs_instrument'], comms: ['plant', 'align'], engineer: ['repair'], planner: [] };
  const jobPrompts = ['scan', 'needs_instrument', 'plant', 'align', 'repair'];
  for (const role of Object.keys(allowed)) {
    for (const world of ['moon', 'venus']) {
      const st = S.create(S.fixture('mid', world), 31, [{ id: 'h', role }], {});
      const me = st.entities.find((e) => e.playerId === 'h');
      let guard = 0;
      // The person wanders across the map holding Use, so they walk into every kind of ring.
      while (!st.over && guard++ < 20000) {
        const a = st.t * 0.21 + role.length;
        S.step(st, { h: { moveX: Math.cos(a), moveY: Math.sin(a * 0.7), use: true } }, S.TICK);
        const pr = st.prompts.h;
        if (pr && jobPrompts.includes(pr)) assert.ok(promptsOf[role].includes(pr), `${role} got the ${pr} prompt`);
        if (st.tick % 30) continue;
        const g = S.nextGoal(st, 'h');
        assert.ok(allowed[role].includes(g.id) || shared.includes(g.id), `${role} on ${world}: goal ${g.id}`);
        assert.ok(g.target && Number.isFinite(g.target.x), `${role}: ${g.id} has a target`);
      }
      assert.ok(me.tally.scans === 0 || role === 'scientist', `${role} scanned`);
      assert.ok(me.tally.plants === 0 || role === 'comms', `${role} planted`);
      assert.ok(me.tally.repairs === 0 || role === 'engineer', `${role} repaired`);
    }
  }
});

test('jobs: the planner marks a site and the scientist goes there first', () => {
  const st = S.create(S.fixture('good', 'mars'), 4, [{ id: 'h', role: 'planner' }], {});
  pastIntro(st);
  const p = st.entities.find((e) => e.playerId === 'h');
  const sci = st.entities.find((e) => e.role === 'scientist');
  const sites = st.entities.filter((e) => e.kind === 'site' && e.fits);
  const target = sites.slice().sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z))[0];
  p.heading = Math.atan2(target.z - p.z, target.x - p.x);
  S.step(st, { h: { ability: true } }, S.TICK);
  S.step(st, { h: { ability: false } }, S.TICK);
  assert.ok(st.route && st.route.siteId === target.id, 'the route is set');
  assert.strictEqual(S.nextGoal(st, sci.playerId).target.id, target.id);
  let n = 0;
  while (!target.done && n++ < 3600) S.step(st, {}, S.TICK);
  assert.ok(target.done, 'the marked site got scanned');
  assert.strictEqual(st.entities.filter((e) => e.kind === 'site' && e.done).length, 1, 'and it was the first one');
  assert.strictEqual(p.tally.routes, 1);
});

test('jobs: only the scientist and the planner choose what stays behind; bots choose quickly', () => {
  const setup = (role) => {
    const st = S.create(S.fixture('good', 'mars'), 8, [{ id: 'h', role }], {});
    pastIntro(st);
    st.stage = 'extraction';
    st.extraction.called = true;
    st.extraction.timer = 5;
    st.ascent.rack.push({ id: 'x1', siteKind: 'ice', massKg: 200, value: 1, core: false }, { id: 'x2', siteKind: 'ice', massKg: 5, value: 50, core: false });
    st.ascent.loadedKg = 205;
    st.ascent.overKg = 205 - st.ascent.liftKg;
    st.extraction.decided = true;
    st.extraction.decision = 10;
    return st;
  };
  const a = setup('comms');
  S.step(a, { h: { jettison: 'x1' } }, S.TICK);
  assert.ok(!a.ascent.jettisoned.some((r) => r.id === 'x1'), 'Communications does not choose');
  assert.ok(!a.over, 'the door is still open');
  assert.strictEqual(S.statusFor(a, 'h').rack, null, 'and its phone shows no chooser');
  const b = setup('scientist');
  assert.ok(S.statusFor(b, 'h').rack, 'the scientist has the rack on the phone');
  S.step(b, { h: { jettison: 'x1' } }, S.TICK);
  assert.ok(b.ascent.jettisoned.some((r) => r.id === 'x1' && r.reason === 'crew'), 'and chooses');
  // An all-bot door decision takes a few seconds, not the full fifteen.
  const st = S.create(S.fixture('good', 'mars'), 8, 0, {});
  st.ascent.liftKg = 20;
  st.loadout.ascent.liftKg = 20;
  let opened = -1;
  let guard = 0;
  while (!st.over && guard++ < 20000) {
    S.step(st, {}, S.TICK);
    if (opened < 0 && st.events.some((e) => e.type === 'decisionOpen')) opened = st.t;
  }
  assert.ok(opened >= 0, 'the door decision opened');
  assert.ok(st.t - opened <= S.TUNE.botDecideS + 0.5, `bots took ${st.t - opened} s`);
  const fresh = S.create(S.fixture('good', 'mars'), 8, 0, {});
  assert.strictEqual(S.canDo(fresh, fresh.entities.find((e) => e.role === 'comms').playerId, 'scan'), false);
  assert.strictEqual(S.canDo(fresh, fresh.entities.find((e) => e.role === 'scientist').playerId, 'scan'), true);
  assert.strictEqual(S.canDo(fresh, fresh.entities.find((e) => e.role === 'planner').playerId, 'choose'), true);
});

test("jobs: summaries carry each astronaut's job work, character and player", () => {
  const st = run(S.fixture('good', 'moon'), 12, {}, [{ id: 'h', role: 'scientist', name: 'Priya', crewId: 'priya', playerName: 'Bea', bot: true }]);
  const sum = S.summary(st);
  const me = sum.perPlayer.find((x) => x.playerId === 'h');
  assert.strictEqual(me.name, 'Priya');
  assert.strictEqual(me.crewId, 'priya');
  assert.strictEqual(me.playerName, 'Bea');
  assert.strictEqual(me.job, 'scientist');
  assert.ok(me.scans >= 3, JSON.stringify(me));
  const comms = sum.perPlayer.find((x) => x.job === 'comms');
  assert.ok(comms.plants === 1 && comms.heldS > 5, JSON.stringify(comms));
  const eng = sum.perPlayer.find((x) => x.job === 'engineer');
  assert.ok(eng.repairs >= 1, JSON.stringify(eng));
  assert.ok(sum.perPlayer.filter((x) => x.job !== 'scientist').every((x) => x.scans === 0), 'only the scientist scanned');
});

// ---------------------------------------------------------------- docs/TEAM-V3.md item 19
test('signature missions: the Moon asks for the permanently shadowed crater, Mars for a drilled core', () => {
  const ids = (sum) => sum.objectives.map((o) => o.id);
  const moon = S.summary(run(S.fixture('good', 'moon'), 41));
  const mars = S.summary(run(S.fixture('good', 'mars'), 41));
  assert.ok(ids(moon).includes('shadow') && !ids(moon).includes('core'), ids(moon).join());
  assert.ok(ids(mars).includes('core') && !ids(mars).includes('shadow'), ids(mars).join());
  for (const w of ['venus', 'europa']) assert.ok(!ids(S.summary(run(S.fixture('good', w), 41))).some((id) => id === 'shadow' || id === 'core'), w);
  assert.strictEqual(moon.signature, 'shadow');
  assert.strictEqual(mars.signature, 'core');
  assert.ok(moon.objectives.find((o) => o.id === 'shadow').done && moon.facts.some((f) => f.id === 'shadow_done'));
  assert.ok(mars.objectives.find((o) => o.id === 'core').done && mars.facts.some((f) => f.id === 'core_home'));
  // Mars without a drill: no core, and the summary says the drill was missing.
  const noDrill = S.fixture('good', 'mars');
  noDrill.drill = null;
  const nd = S.summary(run(noDrill, 41));
  assert.ok(!nd.objectives.find((o) => o.id === 'core').done);
  assert.ok(nd.facts.some((f) => f.id === 'core_missed' && f.whyKey === 'team.surface.why.core_nodrill'));
  // The shadowed crater is cold for suits even in daylight.
  const st = S.create(S.fixture('good', 'moon'), 41, [{ id: 'h', role: 'scientist' }], {});
  pastIntro(st);
  const p = st.entities.find((e) => e.playerId === 'h');
  const sh = st.entities.find((e) => e.kind === 'site' && e.shadow);
  assert.ok(sh && sh.objective, 'one objective site is in permanent shadow');
  alone(st, p);
  const drainAt = (x, z) => {
    p.x = x;
    p.z = z;
    p.energy = 100;
    for (let i = 0; i < 60; i++) S.step(st, {}, S.TICK);
    return 100 - p.energy;
  };
  const far = st.entities.find((e) => e.kind === 'site' && !e.shadow && Math.hypot(e.x - sh.x, e.z - sh.z) > 20);
  assert.ok(st.sun.up);
  assert.ok(drainAt(sh.x, sh.z) > drainAt(far.x, far.z) * 1.5, 'colder in the crater');
});

test('every surface and results string has Arabic (view-surface, the sim summary, the v3 debrief lines)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  for (const f of fs.readdirSync(path.join(root, 'js', 'i18n'))) if (f.endsWith('.js')) require(path.join(root, 'js', 'i18n', f));
  for (const f of ['ar-surface.js', 'ar-sim.js', 'ar-guide.js', 'ar-review.js', 'ar-flight.js']) require(path.join(root, 'js', 'team', f));
  const AR = globalThis.SMD.i18nDicts.ar;
  const keys = new Set(Object.keys(S.STRINGS));
  for (const m of fs.readFileSync(path.join(root, 'js', 'team', 'view-surface.js'), 'utf8').matchAll(/\bt\('(team\.surface\.[\w.]*\w)'/g)) keys.add(m[1]);
  for (const m of fs.readFileSync(path.join(root, 'js', 'team', 'view-debrief.js'), 'utf8').matchAll(/\bt\('(team\.deb\.(?:did|points|rule|band|total|crew)[\w.]*|team\.score\.requirements)'/g)) keys.add(m[1]);
  const missing = [...keys].filter((k) => !AR[k]);
  assert.deepStrictEqual(missing, []);
});

// ---------- Real gravity (docs/GRAVITY.md) ----------
const MOVE_WORLDS = { moon: 1.62, mars: 3.71, venus: 8.71, europa: 1.315 };

// Run stepMove from rest at the world's top speed for `runS`, release, and return the
// distance slid to a stop, the time to 90% speed and the stop time.
function runAndStop(world, g, runS) {
  const st = S.create(S.fixture('good', world), 7, 0, {});
  // An open stretch of flat floor (no rock, no ice) to run along +x.
  const map = { tiles: st.map.tiles.map(() => 0) };
  const top = S.TUNE.moveSpeed * S.WORLDS[world].speed;
  let p = { x: 40, z: 96, vx: 0, vz: 0, r: 0.6, speed: top };
  let t90 = null;
  for (let i = 0; i < Math.round(runS / S.TICK); i++) {
    p = Object.assign(S.stepMove(p, { moveX: 1, moveY: 0, g }, S.TICK, map), { speed: top });
    if (t90 === null && p.vx >= 0.9 * top) t90 = (i + 1) * S.TICK;
  }
  const x0 = p.x;
  let n = 0;
  while (Math.hypot(p.vx, p.vz) > 0.01 && n < 600) {
    p = Object.assign(S.stepMove(p, { moveX: 0, moveY: 0, g }, S.TICK, map), { speed: top });
    n++;
  }
  return { stop: p.x - x0, stopS: n * S.TICK, t90, top };
}

test('gravity: each world has its real surface gravity; the toggle gives Earth everywhere', () => {
  for (const [w, g] of Object.entries(MOVE_WORLDS)) {
    assert.strictEqual(S.gravityOf(w), g, w);
    assert.strictEqual(S.feelG(w, true), g, w);
    assert.strictEqual(S.feelG(w, false), S.EARTH_G, w + ' with Realistic gravity off');
  }
  assert.strictEqual(S.EARTH_G, 9.81);
  assert.strictEqual(S.gravityOf('nowhere'), S.EARTH_G);
});

test('gravity: traction is proportional to g (a <= k mu g), half on ice', () => {
  for (const g of Object.values(MOVE_WORLDS).concat([S.EARTH_G])) {
    assert.ok(Math.abs(S.traction(g) - S.MOVE.tractionK * S.MOVE.mu * g) < 1e-9);
    assert.ok(Math.abs(S.traction(g, true) - S.MOVE.tractionK * S.MOVE.iceMu * g) < 1e-9);
  }
  assert.ok(Math.abs(S.traction(1.62) / S.traction(9.81) - 1.62 / 9.81) < 1e-9);
  assert.ok(Math.abs(S.stopDistance(7, 1.62) - 49 / (2 * S.traction(1.62))) < 1e-9);
});

test('gravity: the gait follows the Froude number, Polet et al. take-off speed and h = vz²/2g', () => {
  const L = S.MOVE.legL;
  for (const g of Object.values(MOVE_WORLDS).concat([S.EARTH_G])) {
    // Walk below Fr 0.5, run above: the transition speed is sqrt(0.5 g L).
    const vt = Math.sqrt(0.5 * g * L);
    assert.strictEqual(S.gait(vt * 0.95, g).gait, 'walk', 'walks below the transition at g=' + g);
    assert.notStrictEqual(S.gait(vt * 1.05, g).gait, 'walk', 'runs above the transition at g=' + g);
    const v = 6;
    const G = S.gait(v, g);
    assert.ok(Math.abs(G.froude - (v * v) / (g * L)) < 1e-9);
    const vz = S.MOVE.vzEarth(v) * Math.sqrt(g / S.EARTH_G);
    assert.ok(Math.abs(G.vz - vz) < 1e-9);
    assert.ok(Math.abs(G.flightS - (2 * vz) / g) < 1e-9, 'flight = 2 vz / g');
    assert.ok(Math.abs(G.apex - (vz * vz) / (2 * g)) < 1e-9, 'apex = vz² / 2g');
    assert.ok(Math.abs(G.cadence - 1 / (G.contactS + G.flightS)) < 1e-9);
    assert.ok(Math.abs(G.stepLen - v / G.cadence) < 1e-9);
  }
  // With vz proportional to sqrt(g) the ballistic height is the same on every world (Polet
  // et al. 2018), while the time in the air grows as 1/sqrt(g): the low-gravity float.
  const moon = S.gait(7.5, 1.62);
  const earth = S.gait(7.5, S.EARTH_G);
  assert.ok(Math.abs(moon.apex - earth.apex) < 1e-9);
  assert.ok(Math.abs(moon.flightS / earth.flightS - Math.sqrt(S.EARTH_G / 1.62)) < 1e-9);
  // At the game's running speed: a lope on the Moon, Mars and Europa, a run on Venus and Earth.
  for (const w of ['moon', 'mars', 'europa']) assert.strictEqual(S.gait(S.TUNE.moveSpeed * S.WORLDS[w].speed, S.gravityOf(w)).gait, 'lope', w);
  assert.strictEqual(S.gait(S.TUNE.moveSpeed * S.WORLDS.venus.speed, S.gravityOf('venus')).gait, 'run');
  assert.strictEqual(S.gait(S.TUNE.moveSpeed, S.EARTH_G).gait, 'run');
  assert.ok(S.gait(7.5, 1.62).cadence < S.gait(7.5, S.EARTH_G).cadence, 'fewer, longer steps on the Moon');
  // Walking cadence scales with sqrt(g) at the same Froude number (dynamic similarity).
  const fr = 0.25;
  const wm = S.gait(Math.sqrt(fr * 1.62 * L), 1.62);
  const we = S.gait(Math.sqrt(fr * S.EARTH_G * L), S.EARTH_G);
  assert.ok(Math.abs(wm.cadence / we.cadence - Math.sqrt(1.62 / S.EARTH_G)) < 1e-9);
});

test('gravity: a hop is v0²/2g high and 2·v0/g long (Apollo 16: 0.42 m, 1.45 s on the Moon)', () => {
  for (const g of Object.values(MOVE_WORLDS).concat([S.EARTH_G])) {
    const h = S.hopOf(g);
    assert.ok(Math.abs(h.height - (h.v0 * h.v0) / (2 * g)) < 1e-12);
    assert.ok(Math.abs(h.airS - (2 * h.v0) / g) < 1e-12);
  }
  const moon = S.hopOf(1.62);
  assert.ok(Math.abs(moon.height - 0.42) < 0.01, 'John Young: 0.42 m');
  assert.ok(Math.abs(moon.airS - 1.45) < 0.02, 'John Young: 1.45 s');
});

test('gravity: dust flies clean parabolas without air (Moon, Europa) and drags in air (Mars, Venus)', () => {
  for (const w of ['moon', 'europa']) {
    const d = S.dustOf(w);
    assert.ok(d.airless && d.drag === 0 && d.fineG === d.g, w);
  }
  for (const w of ['mars', 'venus']) {
    const d = S.dustOf(w);
    assert.ok(!d.airless && d.drag > 0 && d.fineG < d.g, w);
  }
  assert.ok(S.dustOf('venus').drag > S.dustOf('mars').drag, 'denser air drags more');
});

test('gravity: stopping distance and start follow traction: under 0.5 m on Venus, metres on the Moon', () => {
  const out = {};
  for (const w of Object.keys(MOVE_WORLDS)) out[w] = runAndStop(w, S.gravityOf(w), 2.5);
  assert.ok(out.venus.stop < 0.5, 'Venus stop ' + out.venus.stop);
  assert.ok(out.moon.stop > 2 && out.moon.stop < 3.5, 'Moon stop ' + out.moon.stop);
  assert.ok(out.europa.stop > out.moon.stop, 'Europa slides further than the Moon');
  assert.ok(out.mars.stop > out.venus.stop && out.mars.stop < out.moon.stop, 'Mars in between');
  assert.ok(out.moon.t90 > out.mars.t90 && out.mars.t90 > out.venus.t90, 'starts take longer in low g');
  // The analytic stop (v²/2a) within 20% (the last few centimetres ease off exponentially).
  for (const w of Object.keys(MOVE_WORLDS)) {
    const a = S.stopDistance(out[w].top, S.gravityOf(w));
    assert.ok(Math.abs(out[w].stop - a) / a < 0.2, `${w}: ${out[w].stop} vs ${a}`);
  }
  // Realistic gravity off: Earth's traction on every world, the same quick stop.
  for (const w of Object.keys(MOVE_WORLDS)) {
    const e = runAndStop(w, S.feelG(w, false), 2.5);
    assert.ok(e.stop < 0.5, w + ' with Earth gravity: ' + e.stop);
    assert.ok(e.t90 <= 0.2, w + ' with Earth gravity starts at once: ' + e.t90);
  }
});

test('gravity: turning at speed draws a wide arc on the Moon and a tight one on Venus', () => {
  const st = S.create(S.fixture('good', 'moon'), 7, 0, {});
  const map = { tiles: st.map.tiles.map(() => 0) };
  const widest = (g) => {
    let p = { x: 40, z: 96, vx: 7.2, vz: 0, r: 0.6, speed: 7.2 };
    let carry = 0;
    for (let i = 0; i < 90; i++) {
      p = Object.assign(S.stepMove(p, { moveX: 0, moveY: 1, g }, S.TICK, map), { speed: 7.2 });
      carry = Math.max(carry, p.x - 40);
    }
    return carry;
  };
  assert.ok(widest(1.62) > 3, 'Moon overshoot ' + widest(1.62));
  assert.ok(widest(8.71) < 0.8, 'Venus overshoot ' + widest(8.71));
  assert.ok(widest(1.62) > 4 * widest(8.71), 'the arc scales with 1/g');
});

test('gravity: stepMove stays pure and deterministic; without g it is exactly the old movement', () => {
  const st = S.create(S.fixture('mid', 'moon'), 5, 0, {});
  const pos = Object.freeze({ x: st.map.lander.x + 5, z: st.map.lander.z, vx: 1, vz: -0.5, r: 0.7, speed: 7 });
  const inp = Object.freeze({ moveX: 0.6, moveY: -0.8, g: 1.62 });
  assert.deepStrictEqual(S.stepMove(pos, inp, S.TICK, st.map), S.stepMove(pos, inp, S.TICK, st.map));
  // The old formula, by hand (grip 0.5 a tick off ice).
  const k = 1 - Math.pow(0.5, 1);
  const vx = 1 + (0.6 * 7 - 1) * k;
  const vz = -0.5 + (-0.8 * 7 + 0.5) * k;
  const legacy = S.stepMove(pos, { moveX: 0.6, moveY: -0.8 }, S.TICK, st.map);
  assert.strictEqual(legacy.vx, vx);
  assert.strictEqual(legacy.vz, vz);
  // g: 0 is the same as no g.
  assert.deepStrictEqual(S.stepMove(pos, { moveX: 0.6, moveY: -0.8, g: 0 }, S.TICK, st.map), legacy);
});

test('gravity: in the sim a person in an eye-level view moves with real traction, bots do not', () => {
  const firstSteps = (inputExtra) => {
    const st = S.create(S.fixture('good', 'moon'), 11, [{ id: 'p1', name: 'P', role: 'planner' }], { difficulty: 'cadet' });
    pastIntro(st);
    const me = st.entities.find((e) => e.kind === 'astronaut' && e.playerId === 'p1');
    alone(st, me);
    const x0 = me.x;
    const z0 = me.z;
    for (let i = 0; i < 6; i++) S.step(st, { p1: Object.assign({ moveX: 1, moveY: 0, aimX: 1, aimY: 0 }, inputExtra) }, S.TICK);
    return { d: Math.hypot(me.x - x0, me.z - z0), st };
  };
  const moon = firstSteps({ shooter: true });
  const earth = firstSteps({ shooter: true, earthG: true });
  const phone = firstSteps({});
  assert.ok(moon.d < earth.d * 0.6, `Moon start ${moon.d} vs Earth ${earth.d}`);
  assert.ok(Math.abs(earth.d - phone.d) < 0.35, `Earth feel is about the old quick start: ${earth.d} vs ${phone.d}`);
  // Determinism with the feel on: the same inputs give the same mission.
  const again = firstSteps({ shooter: true });
  assert.strictEqual(fingerprint(again.st), fingerprint(moon.st));
});
