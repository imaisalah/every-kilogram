// v3 look & feel (docs/TEAM-V3.md items 7, 8, 9, 10, 19, 23): the three guides and their
// lines, your own astronaut (save, load, the id that carries the look), the
// procedural music planner and scheduler, and the starfield layout.
const test = require('node:test');
const assert = require('node:assert/strict');

// A small localStorage for node.
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => (mem[k] = String(v)),
  removeItem: (k) => delete mem[k],
};
globalThis.SMD = globalThis.SMD || {};
require('../js/team/crew.js');
require('../js/team/guide-lines.js');
require('../js/team/guide.js');
require('../js/team/ar-guide.js');
require('../js/team/music.js');
require('../js/team/starfield.js');
const G = SMD.team.guide;
const C = SMD.team.crew;
const By = SMD.team.guideLinesBy;
const AR = SMD.i18nDicts.ar;
const M = SMD.music;

const MISSIONS = ['nile', 'storms', 'moon', 'mars', 'venus', 'europa', 'cubesat'];
const LANDS = ['moon', 'mars', 'venus', 'europa'];
const STEPS = ['thermal', 'launcher', 'orbit', 'route', 'panels', 'batteries', 'instruments', 'antenna', 'radio', 'recorder', 'computer', 'adcs', 'lifetime', 'structure', 'propMargin', 'duty', 'processing', 'coding', 'ground', 'schedule', 'landing'];
const MOMENTS = ['define', 'questions', 'objective', 'requirement', 'fit.good', 'fit.ok', 'fit.poor', 'review', 'review.problem', 'launch', 'cabin', 'flight.start', 'flight.eclipse', 'flight.contact', 'flight.lowbat', 'flight.overflow', 'flight.crisis', 'landing', 'surface', 'results.full', 'results.partial', 'results.none', 'results.lost', 'results.crew'];
const OTHERS = ['brace', 'praline', 'cairn'];

// ---------- Guides ----------
test('KILO and three original guides, KILO by default, the choice is saved', () => {
  assert.deepEqual(G.GUIDES, ['kilo', 'brace', 'praline', 'cairn']);
  assert.equal(G.current(), 'kilo');
  const names = G.list().map((g) => g.name);
  assert.deepEqual(names, ['KILO', 'BRACE', 'Dr. Praline', 'CAIRN']);
  // Not the copyrighted characters the team mentioned.
  for (const g of G.list()) for (const f of ['name', 'role', 'blurb']) assert.ok(!/tars|bubblegum|candy kingdom|interstellar|adventure time|rocky|eridian|hail mary|amaze/i.test(g[f]), `${g.id}.${f}`);
  assert.equal(G.setCurrent('praline'), 'praline');
  assert.equal(G.current(), 'praline');
  assert.equal(mem['ek-guide'], 'praline');
  assert.equal(G.setCurrent('tars'), 'praline', 'an unknown guide is refused');
  G.setCurrent('kilo');
});

test('every guide has a line for every moment and build step on every mission', () => {
  for (const gid of G.GUIDES) {
    for (const m of MISSIONS) {
      const b = G.scriptFor(m, 'briefing', null, gid);
      assert.ok(b.length >= 3 && b.length <= 4, `${gid} ${m} briefing: ${b.length}`);
      for (const s of STEPS) assert.equal(G.scriptFor(m, `step.${s}`, null, gid).length, 1, `${gid} ${m} step.${s}`);
      for (const mo of MOMENTS) assert.ok(G.scriptFor(m, mo, { name: 'X', problem: 'Y' }, gid).length >= 1, `${gid} ${m} ${mo}`);
    }
    assert.ok(G.scriptFor('pluto', 'briefing', null, gid).length >= 3, `${gid}: unknown mission`);
    assert.equal(G.scriptFor('moon', 'step.nonsense', null, gid).length, 1, `${gid}: unknown step`);
    assert.deepEqual(G.scriptFor('moon', 'no-such-moment', null, gid), [], `${gid}: unknown moment`);
  }
});

test('the new guides speak in their own voice', () => {
  for (const gid of OTHERS) {
    for (const m of MISSIONS) {
      const b = G.scriptFor(m, 'briefing', null, gid);
      assert.ok(b[0].id.startsWith(`guide.${gid}.`), `${gid} ${m}: own hello`);
      assert.ok(b[b.length - 1].id.startsWith(`guide.${gid}.`), `${gid} ${m}: own closing line`);
      assert.ok(G.scriptFor(m, 'launch', null, gid)[0].id.startsWith(`guide.${gid}.${m}.`), `${gid} ${m}: own launch line`);
    }
    for (const m of LANDS) for (const mo of ['landing', 'surface']) assert.ok(G.scriptFor(m, mo, null, gid)[0].id.startsWith(`guide.${gid}.${m}.`), `${gid} ${m} ${mo}`);
    for (const mo of MOMENTS) assert.ok(G.scriptFor('pluto', mo, null, gid)[0].id.startsWith(`guide.${gid}.any.`), `${gid} any ${mo}`);
    for (const mo of ['cabin.open', 'cabin.close', 'hello']) assert.equal(G.scriptFor(null, mo, null, gid).length, 1, `${gid} ${mo}`);
    // Mission facts in build steps are kept (KILO's factual line).
    assert.equal(G.scriptFor('europa', 'step.structure', null, gid)[0].id, 'guide.europa.step.structure.0');
    assert.equal(G.scriptFor('mars', 'step.power', null, gid)[0].id, 'guide.mars.step.panels.0');
    assert.equal(G.scriptFor('moon', 'fit.good', { name: 'Find the ice' }, gid)[0].text.startsWith('Find the ice:'), true);
    assert.match(G.scriptFor('mars', 'review.problem', { problem: 'Too heavy.' }, gid)[0].text, /Too heavy\.$/);
  }
  // The current guide is what scriptFor and the verdict use by default.
  G.setCurrent('brace');
  assert.ok(G.scriptFor('moon', 'launch')[0].id.startsWith('guide.brace.'));
  assert.ok(G.verdict('moon', { result: { alive: true, success: 'full' } }).id.startsWith('guide.brace.'));
  G.setCurrent('kilo');
  assert.equal(G.scriptFor('moon', 'launch')[0].id, 'guide.moon.launch.0');
});

test('the new lines are short, plain, use known moods and have Arabic', () => {
  const missing = [];
  for (const gid of OTHERS) {
    const L = By[gid];
    for (const where of Object.keys(L)) {
      for (const mo of Object.keys(L[where])) {
        L[where][mo].forEach(([mood, text], i) => {
          const id = `${gid}.${where}.${mo}.${i}`;
          assert.ok(G.MOODS.includes(mood), `${id} mood ${mood}`);
          assert.ok(text.length > 0 && text.length <= 125, `${id} is ${text.length} chars`);
          assert.ok(!/[—–]/.test(text), `${id} has a dash`);
          if (!AR[`guide.${id}`]) missing.push(`guide.${id}`);
        });
      }
    }
    for (const f of ['name', 'role', 'blurb']) if (!AR[`guide.${gid}.${f}`]) missing.push(`guide.${gid}.${f}`);
  }
  for (const k of ['guide.kilo.name', 'guide.pick', 'guide.mute.any', 'settings.guide', 'settings.music', 'settings.music.volume', 'team.flight.vr', 'team.flight.vr.exit']) if (!AR[k]) missing.push(k);
  assert.deepEqual(missing, []);
  for (const gid of OTHERS) {
    assert.match(AR[`guide.${gid}.any.fit.good.0`], /\{name\}/);
    assert.match(AR[`guide.${gid}.any.review.problem.0`], /\{problem\}/);
  }
});

test('each guide has its own portrait for every mood', () => {
  for (const gid of G.GUIDES) {
    const seen = new Set();
    for (const mood of G.MOODS) {
      const svg = G.portrait(mood, { size: 100, guide: gid });
      assert.match(svg, /^<svg[^>]*class="tf-kilo-svg/);
      assert.match(svg, new RegExp(`data-mood="${mood}"`));
      seen.add(svg.replace(/id="[a-z]{2}\d+[a-z]?"|url\(#[a-z]{2}\d+[a-z]?\)/g, ''));
      assert.notEqual(G.portrait(mood, { guide: gid, talking: true }).replace(/[a-z]{2}\d+/g, ''), G.portrait(mood, { guide: gid }).replace(/[a-z]{2}\d+/g, ''), `${gid} ${mood} talking`);
    }
    assert.ok(seen.size >= 7, `${gid} moods look different (${seen.size})`);
  }
  assert.match(G.portrait('happy', { guide: 'brace' }), /tf-guide-brace/);
  assert.match(G.portrait('happy', { guide: 'praline' }), /tf-guide-praline/);
  assert.match(G.portrait('happy', { guide: 'cairn' }), /tf-guide-cairn/);
  assert.equal(typeof G.picker(null).destroy, 'function', 'picker is safe without a DOM');
});

// ---------- Your own astronaut ----------
test('a custom astronaut saves, loads and carries its look in its id', () => {
  assert.equal(C.custom(), null);
  const m = C.saveCustom({ name: '  Nour   Adel <b>', job: 'engineer', look: { suit: 'navy', skin: 's5', hair: 'curly', hairColor: 'auburn', visor: 'gold', body: 'f', beard: 'none', patchColor: '#b4302c' } });
  assert.equal(m.name, 'Nour Adel b');
  assert.equal(m.short, 'Nour');
  assert.equal(m.job, 'engineer');
  assert.equal(m.custom, true);
  assert.match(m.id, /^custom-e[0-9a-z]{8}$/);
  assert.ok(/^[\w-]{1,24}$/.test(m.id), 'the room accepts the id');
  const back = C.custom();
  assert.equal(back.id, m.id);
  assert.equal(back.name, m.name);
  assert.deepEqual(back.look, m.look);
  assert.equal(back.appearance.body, 'f');
  assert.equal(back.appearance.visor, 'gold');
  assert.equal(C.customId(), m.id);
  // Any device decodes the look; a teammate's custom shows the player's name.
  const other = C.byId(m.id, { name: 'Lina' });
  assert.equal(other.name, 'Lina');
  assert.deepEqual(other.look, m.look);
  assert.equal(C.byId(m.id).name, 'Nour Adel b');
  assert.equal(C.byId('custom').id, m.id);
  assert.equal(C.byId('custom-zzzz'), null);
  assert.equal(C.isCustom(m.id), true);
  assert.equal(C.isCustom('salma'), false);
  // Junk in, a complete look out.
  const junk = C.makeCustom('', 'pilot', { suit: 'pink', hair: 'mohawk' });
  assert.equal(junk.job, 'planner');
  assert.equal(junk.look.suit, 'classic');
  assert.equal(junk.look.hair, 'short');
  assert.ok(junk.name.length > 0);
});

test('a custom astronaut takes the seat of its job and speaks in the cabin', () => {
  const m = C.custom();
  const lu = C.lineup(m.id);
  assert.deepEqual(lu.map((r) => r.member.job), ['planner', 'engineer', 'scientist', 'comms']);
  assert.equal(lu[1].member.id, m.id);
  assert.equal(lu[1].you, true);
  assert.ok(!lu.some((r) => r.member.id === 'mateo'), 'the roster engineer stays home');
  const team = C.lineup([{ name: 'Omar', crewId: m.id }, { name: 'Bea', crewId: 'salma', you: true }]);
  assert.equal(team[1].member.name, 'Omar');
  assert.equal(team[1].player, 'Omar');
  assert.equal(team.find((r) => r.you).member.id, 'salma');
  const script = C.cabinScript(lu);
  assert.equal(script.length, 6);
  assert.match(script[2].text, /^Nour Adel b, engineer\./);
  assert.match(C.portrait(m.id), /^<svg[^>]*class="tf-crew-face"/);
  assert.match(C.portrait(C.makeCustom('Ana', 'comms', { hair: 'helmet' })), /stroke="#e8edf6"/, 'helmet portrait');
  assert.equal(C.text(m, 'job'), 'Engineer');
  assert.ok(C.text(m, 'personality').length > 5);
  for (const k of ['crew.custom.defaultName', 'crew.custom.personality', 'crew.custom.bio', 'crew.custom.detail', 'crew.custom.from', 'avatar.crew.title', 'avatar.crew.save', 'avatar.crew.job']) assert.ok(AR[k], k);
  for (const j of C.JOBS) assert.match(AR[`crew.custom.intro.${j}`], /\{name\}/);
  assert.equal(C.canCreate(), false, 'no creator without a DOM');
  C.clearCustom();
  assert.equal(C.custom(), null);
});

test('Moon, Mars and the CubeSat have their own lines (item 19)', () => {
  const own = (m, mo) => G.scriptFor(m, mo, null, 'kilo')[0].id.startsWith(`guide.${m}.`);
  for (const m of ['moon', 'mars', 'cubesat']) {
    assert.ok(own(m, 'briefing') && own(m, 'launch') && own(m, 'step.thermal') && own(m, 'step.instruments'), m);
    for (const g of G.GUIDES) assert.ok(G.scriptFor(m, 'briefing', null, g).some((l) => l.id.includes(`.${m}.`)), `${g} ${m} briefing`);
  }
  assert.ok(own('cubesat', 'step.launcher') && own('cubesat', 'results.full'));
  assert.ok(own('mars', 'step.landing'));
});

test('the cabin is opened and closed by the chosen guide', () => {
  G.setCurrent('praline');
  const s = C.cabinScript(C.lineup('priya'));
  assert.equal(s[0].who, 'kilo');
  assert.equal(s[0].guide, 'praline');
  assert.match(s[0].text, /Praline/);
  G.setCurrent('kilo');
  assert.match(C.cabinScript(C.lineup('priya'))[0].text, /KILO/);
});

// ---------- Music ----------
test('music: every phase has a preset; the plan is deterministic and in key', () => {
  assert.deepEqual(M.PHASES, ['menu', 'build', 'flight', 'surface', 'results']);
  for (const ph of M.PHASES) {
    const P = M.PRESETS[ph];
    assert.ok(P && P.bpm >= 40 && P.bpm <= 80, `${ph} is calm`);
    const a = M.plan(ph, 0, 16, 42);
    assert.deepEqual(a, M.plan(ph, 0, 16, 42), `${ph} deterministic`);
    assert.notDeepEqual(a, M.plan(ph, 0, 16, 43), `${ph} seed matters`);
    for (let i = 1; i < a.length; i++) assert.ok(a[i].t >= a[i - 1].t, 'sorted');
    for (const ev of a) {
      assert.ok(ev.t >= 0 && ev.t < 16 * P.beats, 'inside the bars');
      for (const n of ev.notes) assert.ok(P.scale.includes((((n - P.root) % 12) + 12) % 12), `${ph} ${ev.kind} ${n} in the scale`);
      assert.ok(ev.vel > 0 && ev.vel <= 1);
      assert.ok(ev.dur > 0);
    }
    assert.equal(a.filter((e) => e.kind === 'pad').length, 16 / P.chordBars, `${ph} a chord every ${P.chordBars} bars`);
    // Bar by bar equals all at once.
    const byBar = [];
    for (let b = 0; b < 4; b++) M.plan(ph, b, 1, 9).forEach((e) => byBar.push({ ...e, t: e.t + b * P.beats }));
    assert.deepEqual(byBar.map((e) => [e.t, e.kind, e.notes]).sort(), M.plan(ph, 0, 4, 9).map((e) => [e.t, e.kind, e.notes]).sort());
  }
  const bells = (ph) => M.plan(ph, 0, 64, 1).filter((e) => e.kind === 'bell').length / 64;
  assert.ok(bells('surface') < bells('build') && bells('flight') < bells('menu'), 'flight and surface are sparser');
  assert.ok(bells('build') <= 4, 'never busy');
  assert.equal(M.plan('nowhere', 0, 4, 1).length, 0);
  assert.equal(Math.round(M.midiHz(69)), 440);
});

// A stand-in AudioContext that records what the engine builds.
function fakeAudio() {
  const log = { osc: [], gains: [], disconnected: 0 };
  const param = (v = 0) => ({ value: v, events: [], setValueAtTime(x, t) { this.events.push(['set', x, t]); this.value = x; }, linearRampToValueAtTime(x, t) { this.events.push(['lin', x, t]); this.value = x; }, exponentialRampToValueAtTime(x, t) { this.events.push(['exp', x, t]); }, setTargetAtTime(x, t) { this.events.push(['target', x, t]); this.value = x; }, cancelScheduledValues() {} });
  const node = (extra) => Object.assign({ connect() {}, disconnect() { log.disconnected++; } }, extra);
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    createGain() {
      const g = node({ gain: param(1) });
      log.gains.push(g);
      return g;
    },
    createOscillator() {
      const o = node({ type: 'sine', frequency: param(440), detune: param(0), start(t) { o.at = t; }, stop(t) { o.end = t; } });
      log.osc.push(o);
      return o;
    },
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(1000), Q: param(1) }),
    createDelay: () => node({ delayTime: param(0) }),
    createConvolver: () => node({ buffer: null }),
    createBufferSource: () => node({ buffer: null, loop: false, start() {}, stop() {} }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { ctx, log };
}

test('music: the scheduler plans ahead, crossfades between phases and lets old ones go', () => {
  const { ctx, log } = fakeAudio();
  const e = M.createEngine(ctx, { seed: 5, level: 0.4 });
  e.play('menu', 0);
  assert.equal(e.current(), 'menu');
  const first = log.osc.length;
  assert.ok(first > 0, 'notes are scheduled at once');
  const bar = M.barSeconds(M.PRESETS.menu);
  assert.ok(log.osc.every((o) => o.at >= 0 && o.at < 1.5 + bar), 'only the next bar or so is planned');
  // A minute of ticks: notes keep coming, always a little ahead of now.
  for (let t = 0.3; t <= 60; t += 0.3) {
    ctx.currentTime = t;
    e.tick(t);
    assert.ok(log.osc.every((o) => o.at <= t + 1.5 + bar), `nothing planned further than the lookahead at ${t.toFixed(1)}`);
  }
  assert.ok(log.osc.length > first * 3, 'a minute of music');
  // Same phase again: nothing changes.
  assert.equal(e.play('menu', 60), e.buses[0]);
  assert.equal(e.buses.length, 1);
  // A new phase fades in while the old one fades out.
  e.play('flight', 60);
  assert.equal(e.current(), 'flight');
  assert.equal(e.buses.length, 2);
  const [old, now] = e.buses;
  assert.equal(old.endAt, 60 + M.FADE);
  assert.deepEqual(old.gain.gain.events.at(-1).slice(0, 2), ['lin', 0.0001]);
  assert.deepEqual(now.gain.gain.events.at(-1), ['lin', 1, 60 + M.FADE]);
  const oldNotes = old.notes;
  for (let t = 60.3; t <= 75; t += 0.3) {
    ctx.currentTime = t;
    e.tick(t);
  }
  assert.ok(old.notes - oldNotes < 30, 'the old phase stops planning once faded');
  assert.equal(e.buses.length, 1, 'and is let go');
  assert.equal(e.buses[0].phase, 'flight');
  // Stop fades everything out.
  e.stop(80);
  assert.equal(e.current(), null);
  for (let t = 80; t <= 95; t += 0.5) e.tick(t);
  assert.equal(e.buses.length, 0);
  // After a pause, the next bar starts now instead of rushing to catch up.
  e.play('results', 100);
  const b = e.buses[0];
  e.resync(500);
  const before = log.osc.length;
  e.tick(500);
  assert.ok(log.osc.slice(before).every((o) => o.at >= 500), 'no notes in the past');
});

test('music: volume and mute fall back to a local store without game settings', () => {
  assert.equal(M.volume(), 0.5);
  M.setVolume(0.8);
  assert.equal(M.volume(), 0.8);
  M.setVolume(7);
  assert.equal(M.volume(), 1);
  assert.equal(M.muted(), false);
  M.setMuted(true);
  assert.equal(M.muted(), true);
  M.setMuted(false);
  assert.equal(M.detect(), null, 'no screen in node');
});

// ---------- Starfield ----------
test('starfield: a stable, calm sky that fills the page', () => {
  const a = SMD.starfield.layout(1280, 720, 1);
  assert.deepEqual(a, SMD.starfield.layout(1280, 720, 1));
  assert.ok(a.length > 600 && a.length < 2700, `${a.length} stars`);
  assert.ok(SMD.starfield.layout(390, 844, 1).length < a.length, 'fewer on a phone');
  assert.ok(SMD.starfield.layout(5000, 3000, 1).length <= 2600, 'capped');
  for (const s of a) {
    assert.ok(s.x >= -1 && s.x <= 1281 && s.y >= -1 && s.y <= 721);
    assert.ok(s.a > 0 && s.a <= 0.9 && s.r > 0 && s.r < 2);
  }
  const tw = a.filter((s) => s.tw > 0).length / a.length;
  assert.ok(tw > 0.01 && tw < 0.12, `only a few twinkle (${(tw * 100).toFixed(1)}%)`);
  const bright = a.filter((s) => s.a > 0.6).length / a.length;
  assert.ok(bright < 0.15, 'few bright stars');
  const med = a.map((s) => s.a).sort((x, y) => x - y)[a.length >> 1];
  assert.ok(med < 0.3, `mostly faint stars (median ${med.toFixed(2)})`);
});
