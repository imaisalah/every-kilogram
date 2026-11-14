// Story mode engine (js/story/engine.js): expressions, the beat runner,
// effects, save and load, replays, recaps, and the script checker. Runs on the
// fixture in tests/story-fixture.js, plus a check of the real episodes in
// content/story/ when they exist.
const test = require('node:test');
const assert = require('node:assert');
const SE = require('../js/story/engine.js');

const SMD = globalThis.SMD;
const real = () => SMD.story.episodes.filter((e) => /^ep\d$/.test(e.id));

// Load the real episodes first (they may still be placeholders), then the fixture.
['ep1', 'ep2', 'ep3', 'ep4'].forEach((id) => {
  try {
    require(`../content/story/${id}.js`);
  } catch (e) {
    // A broken script must fail its own test below, not the whole file.
    SMD.story.brokenLoad = (SMD.story.brokenLoad || []).concat([`${id}: ${e.message}`]);
  }
});
const realEpisodes = real().slice();
SMD.story.episodes.length = 0;
require('./story-fixture.js');

// Plays until the runner wants input; returns the events seen.
function until(run, stop = ['choice', 'survival', 'end', 'explore']) {
  const evs = [];
  for (let i = 0; i < 500; i++) {
    const e = run.next();
    if (!e) break;
    evs.push(e);
    if (stop.includes(e.type)) break;
  }
  return evs;
}

test('expressions: flags, trust, resources, choices, and/or/not', () => {
  const s = SE.blankState();
  s.flags.pushedKwame = true;
  s.trust.nadia = 2;
  s.res.o2 = 25;
  s.choices['ep1.pad.c1'] = 'push';
  const T = (e) => SE.evaluate(e, s);
  assert.equal(T('flags.pushedKwame'), true);
  assert.equal(T('!flags.pushedKwame'), false);
  assert.equal(T('flags.missing'), false);
  assert.equal(T('!flags.missing'), true);
  assert.equal(T('trust.nadia >= 2'), true);
  assert.equal(T('trust.nadia > 2'), false);
  assert.equal(T('trust.kwame == 0'), true);
  assert.equal(T('res.o2 < 30'), true);
  assert.equal(T("choice['ep1.pad.c1'] == 'push'"), true);
  assert.equal(T('choice["ep1.pad.c1"] != "ask"'), true);
  assert.equal(T("choice['nope'] == 'push'"), false);
  assert.equal(T('flags.pushedKwame && res.o2 < 30'), true);
  assert.equal(T('flags.missing || trust.nadia >= 2'), true);
  assert.equal(T('!(flags.missing || res.o2 > 50) && trust.nadia === 2'), true);
  assert.equal(T('health.you >= 100'), true);
  assert.equal(T('res.co2 > -1'), true);
  s.flags.count = 3;
  assert.equal(T('flags.count >= 3 && flags.count < 4'), true);
  // Broken expressions are false (and warned), not a crash; checkExpr reports them.
  const warn = console.warn;
  console.warn = () => {};
  assert.equal(T('flags.x &&'), false);
  assert.equal(T('window.alert(1)'), false);
  console.warn = warn;
  assert.ok(SE.checkExpr('flags.x &&'));
  assert.equal(SE.checkExpr("trust.kwame >= 1 && choice['a.b'] == 'c'"), null);
});

test('a new story starts at episode one with its resources', () => {
  const s = SE.newState();
  assert.equal(s.episode, 'fx1');
  assert.equal(s.scene, 'pad_night');
  assert.equal(s.res.o2, 90);
  assert.equal(s.trust.kwame, 0);
  assert.equal(s.health.grace, 100);
  assert.ok(s.starts.fx1, 'snapshot kept for replays');
});

test('runner: scene, lines, a timed choice with remember, if branches, fact, goto', () => {
  const s = SE.newState();
  const run = SE.createRun(s);
  let evs = until(run);
  assert.deepEqual(
    evs.map((e) => e.type),
    ['scene', 'narrate', 'camera', 'say', 'choice']
  );
  assert.equal(evs[0].set, 'pad');
  assert.deepEqual(evs[0].cast, ['you', 'kwame']);
  assert.equal(evs[3].who, 'kwame');
  assert.equal(evs[3].mood, 'worried');
  const ch = evs[4];
  assert.equal(ch.timer, 8);
  assert.equal(ch.timeout, 'quiet');
  assert.equal(run.waiting, 'choice');
  assert.equal(run.next(), ch, 'next() repeats the pending choice');
  const r = run.choose('push');
  assert.deepEqual(r.remember, ['kwame']);
  assert.equal(s.trust.kwame, -1);
  assert.equal(s.flags.pushedKwame, true);
  assert.equal(s.choices['fx1.pad.c1'], 'push');
  evs = until(run);
  const types = evs.map((e) => e.type);
  assert.deepEqual(types.slice(0, 4), ['say', 'anim', 'fact', 'scene']);
  assert.equal(evs[0].id, 'fx1.pad.k2', 'the then branch ran');
  assert.equal(evs[1].who, 'you');
  assert.equal(evs[1].name, 'look');
  assert.equal(evs[2].fact.title, 'Challenger, 28 January 1986');
  assert.equal(evs[3].id, 'control');
  assert.equal(s.scene, 'control');
  assert.equal(s.beat, 4, 'top-level beat index follows the run');
});

test('runner: option beats run inline, timeouts pick the quiet option, effects clamp', () => {
  const s = SE.newState();
  const run = SE.createRun(s);
  until(run);
  run.choose(run.timeoutOption(run.next()), 'timeout');
  assert.equal(s.choices['fx1.pad.c1'], 'quiet');
  const log = s.log.find((x) => x.kind === 'choice');
  assert.equal(log.timedOut, true);
  let evs = until(run);
  assert.equal(evs[0].id, 'fx1.pad.k3', 'the else branch ran');
  assert.equal(evs[evs.length - 1].id, 'fx1.ctl.go');
  run.choose('wait');
  assert.equal(s.trust.kwame, 2);
  assert.equal(s.trust.tarek, -1);
  evs = until(run);
  assert.equal(evs[0].id, 'fx1.ctl.t2', 'option beats come straight after the pick');
  assert.equal(evs[1].type, 'choice');
  run.choose('o2');
  assert.equal(s.res.o2, 100);
  assert.equal(s.hud, false, 'a gain does not bring the gauges up');
  SE.applyEffects(s, { res: { power: -5 } });
  assert.equal(s.hud, true, 'a loss turns the gauges on');
  SE.applyEffects(s, { trust: { kwame: 5 }, res: { o2: 50, co2: -10 } });
  assert.equal(s.trust.kwame, 3);
  assert.equal(s.res.o2, 100);
  assert.equal(s.res.co2, 0);
});

test('runner: end with a cliffhanger, chain to the next episode, survival goes to win or lose', () => {
  const s = SE.newState();
  let run = SE.createRun(s);
  until(run);
  run.choose('ask');
  until(run);
  run.choose('go');
  until(run);
  run.choose('cam');
  const evs = until(run);
  const types = evs.map((e) => e.type);
  assert.ok(types.includes('sfx'));
  const eff = evs.find((e) => e.type === 'effect');
  assert.deepEqual(eff.changes.res, { o2: -20, power: -15 });
  const end = evs[evs.length - 1];
  assert.equal(end.type, 'end');
  assert.equal(end.ending, 'cliff');
  assert.equal(end.next, 'fx2');
  assert.equal(run.next(), null);
  assert.deepEqual(s.done, ['fx1']);
  assert.equal(s.endings.fx1, 'cliff');
  // Recap: three choices with what they changed, and the history card.
  const rc = SE.recap(s, 'fx1');
  assert.equal(rc.choices.length, 3);
  assert.deepEqual(rc.choices[1].fx.trust, { tarek: 1, kwame: -1 });
  assert.equal(rc.facts.length, 1);
  assert.equal(rc.endingDef.title, 'Day 3');
  // Episode two inherits the state.
  SE.startEpisode(s, 'fx2');
  assert.equal(s.res.o2, 70);
  run = SE.createRun(s);
  const e2 = until(run);
  assert.equal(e2[1].id, 'fx2.cab.l1', "the if reads episode one's choice");
  const sv = e2[e2.length - 1];
  assert.equal(sv.type, 'survival');
  assert.equal(sv.id, 'ep2.co2');
  s.res.co2 = 12; // the segment changed the state
  run.survivalDone('lose', s);
  assert.equal(s.survival['ep2.co2'], 'lose');
  const e3 = until(run);
  assert.equal(e3[0].type, 'scene');
  assert.equal(e3[0].id, 'headache');
  assert.equal(e3[e3.length - 1].type, 'end');
  assert.equal(e3[e3.length - 1].next, null, 'no episode after the last');
  assert.equal(s.res.co2, 27);
});

test('save and load round-trip; saves resume at the saved scene', () => {
  const s = SE.newState();
  const run = SE.createRun(s);
  until(run);
  run.choose('ask');
  until(run); // now in "control", waiting on the Go choice
  SE.clear();
  assert.equal(SE.load(), null);
  // Save at the scene start, like the screen does.
  const snap = JSON.parse(JSON.stringify(s));
  snap.beat = 0;
  SE.save(snap);
  const back = SE.load();
  assert.equal(back.scene, 'control');
  assert.equal(back.trust.kwame, 1);
  const r2 = SE.createRun(back);
  const first = r2.next();
  assert.equal(first.type, 'scene');
  assert.equal(first.id, 'control');
  assert.equal(r2.next().id, 'fx1.ctl.n1');
  // Broken saves and missing scenes are repaired.
  SE._store.set(SE.KEY, '{not json');
  assert.equal(SE.load(), null);
  SE.save({ episode: 'fx1', scene: 'gone', trust: { kwame: 99 }, res: { o2: 'x' } });
  const fixed = SE.load();
  assert.equal(fixed.scene, 'pad_night');
  assert.equal(fixed.trust.kwame, 3);
  assert.equal(fixed.res.o2, 0);
  assert.deepEqual(fixed.done, []);
  SE.clear();
});

test('replaying an episode restores the state from its start', () => {
  const s = SE.newState();
  const run = SE.createRun(s);
  until(run);
  run.choose('push');
  until(run);
  run.choose('go');
  until(run);
  run.choose('o2');
  until(run);
  SE.startEpisode(s, 'fx2');
  assert.ok(s.starts.fx2);
  const again = SE.replayEpisode(s, 'fx1');
  assert.equal(again.scene, 'pad_night');
  assert.equal(again.trust.kwame, 0);
  assert.deepEqual(again.choices, {});
  assert.deepEqual(again.done, []);
  assert.ok(again.starts.fx1 && !again.starts.fx2, 'later episodes are forgotten');
  const ep2 = SE.replayEpisode(s, 'fx2');
  assert.equal(ep2.episode, 'fx2');
  assert.equal(ep2.choices['fx1.pad.c1'], 'push', 'episode one choices stay');
});

test('text: story keys, {you}, cast names', () => {
  SMD.avatar = { get: () => ({ name: 'Salma' }) };
  assert.equal(SE.text('x.y', 'Hello {you}.'), 'Hello Salma.');
  assert.equal(SE.castName('you'), 'Salma');
  assert.equal(SE.castName('kwame'), 'Kwame');
  assert.equal(SE.castFull('lena'), 'Lena Hoffmann');
  delete SMD.avatar;
});

test('seen lines and preferences persist', () => {
  SE._resetSeen();
  assert.equal(SE.isSeen('a.b'), false);
  SE.markSeen('a.b');
  SE.flushSeen();
  SE._resetSeen();
  assert.equal(SE.isSeen('a.b'), true);
  assert.equal(SE.prefs().speed, 'normal');
  SE.setPrefs({ speed: 'fast', auto: true });
  assert.equal(SE.prefs().speed, 'fast');
  assert.equal(SE.prefs().auto, true);
});

test('the checker passes the fixture and catches broken scripts', () => {
  const errs = SE.validate().filter((p) => p.level === 'error');
  assert.deepEqual(errs, []);
  const bad = [
    {
      id: 'bad',
      n: 9,
      start: 'a',
      scenes: {
        a: {
          set: 'pad',
          cast: ['you', 'zed'],
          beats: [
            { say: 'you', line: 'x', id: 'dup' },
            { narrate: 'y', id: 'dup' },
            { if: 'flags.x &&', then: [] },
            { goto: 'nowhere' },
            { choice: { id: 'c', timer: 3, timeout: 'zz', options: [{ id: 'o', text: 'o', remember: 'ghost' }, { id: 'o', text: 'p' }] } },
          ],
        },
      },
    },
  ];
  const msgs = SE.validate(bad)
    .filter((p) => p.level === 'error')
    .map((p) => p.msg)
    .join('\n');
  ['zed', 'used twice', 'bad condition', 'nowhere', 'timeout', 'ghost', 'option id "o" twice'].forEach((w) => assert.ok(msgs.includes(w), 'reports ' + w));
});

test('the runner never loops forever and survives odd beats', () => {
  SMD.story.episodes.push({ id: 'loop', n: 50, start: 'a', scenes: { a: { set: 'black', beats: [{}, { if: 'true', then: [{ goto: 'b' }] }] }, b: { set: 'nowhere', cast: ['nobody'], beats: [{ narrate: 'x', id: 'l.x' }] } } });
  const s = SE.newState('loop');
  const run = SE.createRun(s);
  const evs = until(run);
  assert.deepEqual(
    evs.map((e) => e.type),
    ['scene', 'scene', 'narrate', 'end']
  );
  assert.equal(evs[1].set, 'black', 'an unknown set falls back to black');
  assert.deepEqual(evs[1].cast, []);
  SMD.story.episodes.pop();
});

// The real episodes, once the writer has delivered them: every one plays to an
// end with any choices (random, seeded), and the checker finds no errors.
test('real episodes: scripts load, check clean, and play to an end', (t) => {
  if (SMD.story.brokenLoad) assert.fail('a script failed to load: ' + SMD.story.brokenLoad.join('; '));
  if (!realEpisodes.length) return t.skip('no episodes written yet');
  const keep = SMD.story.episodes.slice();
  SMD.story.episodes.length = 0;
  realEpisodes.forEach((e) => SMD.story.episodes.push(e));
  try {
    const errs = SE.validate().filter((p) => p.level === 'error');
    assert.deepEqual(errs, [], 'script errors');
    let seed = 7;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let round = 0; round < 12; round++) {
      let s = SE.newState();
      for (let epi = 0; epi < 8 && s; epi++) {
        const run = SE.createRun(s);
        let end = null;
        for (let i = 0; i < 5000 && !end; i++) {
          const e = run.next();
          if (!e) break;
          if (e.type === 'choice') {
            const open = e.options.filter((o) => !o.locked);
            run.choose(open[Math.floor(rnd() * open.length)].id);
          }
          if (e.type === 'explore') {
            // Look at a few things, then leave as soon as the exit opens.
            const st = run.exploreState();
            const exit = st.items.find((it) => it.exit && !it.locked);
            const unused = st.items.filter((it) => !it.exit && !it.used);
            if (exit && (!unused.length || rnd() < 0.35)) run.interact(exit.id);
            else if (unused.length) run.interact(unused[Math.floor(rnd() * unused.length)].id);
            else assert.fail(`${e.id}: the exit never opens after every item is used`);
          }
          if (e.type === 'survival') run.survivalDone(rnd() < 0.5 ? 'win' : 'lose', s);
          if (e.type === 'end') end = e;
        }
        assert.ok(end, `${s.episode} reaches an end (round ${round})`);
        if (!end.next) break;
        SE.startEpisode(s, end.next);
      }
    }
  } finally {
    SMD.story.episodes.length = 0;
    keep.forEach((e) => SMD.story.episodes.push(e));
  }
});

test('explore: items, clues, once, requires, a locked exit, then key choices with locked options', () => {
  SMD.story.episodes.push({
    id: 'xp',
    n: 60,
    start: 'pad',
    scenes: {
      pad: {
        set: 'pad',
        cast: ['you', 'kwame'],
        beats: [
          {
            explore: {
              id: 'xp.pad.ex',
              objective: 'Look around.',
              exitWhen: 'flags.readSeals',
              items: [
                { id: 'seals', at: 'console', label: 'Read the seal data', clue: true, once: true, set: { readSeals: true }, beats: [{ narrate: 'Scorched seals.', id: 'xp.n1' }] },
                { id: 'kwame', at: 'kwame', label: 'Talk to Kwame', beats: [{ say: 'kwame', line: 'Cold.', id: 'xp.k1' }] },
                { id: 'secret', at: 'van', label: 'Open the van', requires: 'flags.readSeals', clue: true },
                { id: 'leave', at: 'door', label: 'Go', exit: true },
              ],
            },
          },
          {
            choice: {
              id: 'xp.c1',
              key: true,
              timer: 5,
              options: [
                { id: 'data', text: 'Show the data.', requires: 'flags.readSeals && flags.sawVan', lockedHint: 'You never opened the van.' },
                { id: 'go', text: 'Go.', goto: 'end' },
                { id: 'wait', text: 'Wait.', goto: 'end' },
              ],
            },
          },
        ],
      },
      end: { set: 'black', beats: [{ end: 'done' }] },
    },
  });
  try {
    assert.deepEqual(SE.validate(SMD.story.episodes.filter((e) => e.id === 'xp')).filter((p) => p.level === 'error'), []);
    const s = SE.newState('xp');
    const run = SE.createRun(s);
    let e = until(run);
    let x = e[e.length - 1];
    assert.equal(x.type, 'explore');
    assert.deepEqual(x.items.map((i) => i.id), ['seals', 'kwame', 'leave'], 'requires hides the van');
    assert.equal(x.items.find((i) => i.id === 'leave').locked, true);
    assert.equal(run.interact('leave').locked, true, 'the exit stays shut until exitWhen');
    const r = run.interact('seals');
    assert.equal(r.clue, true);
    e = until(run);
    assert.deepEqual(e.map((v) => v.type), ['narrate', 'explore'], 'item beats, then exploring again');
    x = e[1];
    assert.deepEqual(x.items.map((i) => i.id), ['kwame', 'secret', 'leave'], 'once items go; requires items appear');
    assert.equal(x.exitOpen, true);
    assert.deepEqual(x.clues, [{ id: 'seals', found: true }, { id: 'secret', found: false }]);
    run.interact('kwame');
    until(run);
    run.interact('leave');
    e = until(run);
    const ch = e[e.length - 1];
    assert.equal(ch.type, 'choice');
    assert.equal(ch.key, true);
    assert.equal(ch.options[0].locked, true);
    assert.throws(() => run.choose('data'), /locked/);
    assert.notEqual(run.timeoutOption(ch), 'data', 'a timeout never picks a locked option');
    run.choose('go');
    e = until(run);
    assert.equal(e[e.length - 1].type, 'end');
    // The flowchart: two nodes on the path, the key choice with the option taken, one clue missed.
    const fc = SE.flowchart(s, 'xp');
    assert.deepEqual(fc.path, ['pad', 'end']);
    const pad = fc.nodes.find((n) => n.id === 'pad');
    assert.equal(pad.choices[0].taken, 'go');
    assert.deepEqual(pad.clues.map((c) => c.found), [true, false]);
    assert.ok(fc.completion > 0 && fc.completion < 1);
    // Replay from the second checkpoint: the state from when "end" began.
    const again = SE.replayFrom(s, 'xp', 1);
    assert.equal(again.scene, 'end');
    assert.equal(again.choices['xp.c1'], 'go');
    const back = SE.replayFrom(s, 'xp', 0);
    assert.equal(back.scene, 'pad');
    assert.equal(back.flags.readSeals, undefined, 'state from before the scene');
    assert.deepEqual(back.explored, {});
  } finally {
    SMD.story.episodes.splice(SMD.story.episodes.findIndex((e) => e.id === 'xp'), 1);
  }
});
