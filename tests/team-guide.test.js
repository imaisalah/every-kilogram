// KILO (js/team/guide.js + guide-lines.js), the crew (js/team/crew.js) and their
// Arabic (js/team/ar-guide.js): content and logic that run without a browser.
const test = require('node:test');
const assert = require('node:assert/strict');

globalThis.SMD = globalThis.SMD || {};
require('../js/team/crew.js');
require('../js/team/guide-lines.js');
require('../js/team/guide.js');
require('../js/team/ar-guide.js');
const G = SMD.team.guide;
const C = SMD.team.crew;
const L = SMD.team.guideLines;
const AR = SMD.i18nDicts.ar;

const MISSIONS = ['nile', 'storms', 'moon', 'mars', 'venus', 'europa'];
const LANDS = ['moon', 'mars', 'venus', 'europa'];
const STEPS = ['launcher', 'orbit', 'route', 'panels', 'batteries', 'instruments', 'antenna', 'radio', 'recorder', 'computer', 'adcs', 'lifetime', 'structure', 'propMargin', 'duty', 'processing', 'coding', 'ground', 'schedule', 'landing'];
const MOMENTS = ['questions', 'objective', 'requirement', 'fit.good', 'fit.ok', 'fit.poor', 'review', 'review.problem', 'launch', 'cabin', 'flight.start', 'flight.crisis', 'landing', 'surface', 'results.full', 'results.partial', 'results.none', 'results.lost', 'results.crew'];

test('every mission has a 3-4 line briefing that says what it is for', () => {
  for (const m of MISSIONS) {
    const b = G.scriptFor(m, 'briefing');
    assert.ok(b.length >= 3 && b.length <= 4, `${m}: ${b.length} lines`);
    assert.ok(b.every((l) => l.id.startsWith(`guide.${m}.`)), `${m} has its own briefing`);
  }
});

test('every build step, question and moment has a line for every mission', () => {
  for (const m of MISSIONS) {
    for (const s of STEPS) assert.equal(G.scriptFor(m, `step.${s}`).length, 1, `${m} step.${s}`);
    for (const mo of MOMENTS) assert.ok(G.scriptFor(m, mo).length >= 1, `${m} ${mo}`);
  }
  for (const m of LANDS) assert.ok(G.scriptFor(m, 'landing')[0].id.startsWith(`guide.${m}.`), `${m} has its own landing line`);
});

test('step aliases and unknown steps still get a line; unknown moments get none', () => {
  assert.equal(G.scriptFor('mars', 'step.power')[0].id, 'guide.mars.step.panels.0');
  assert.equal(G.scriptFor('moon', 'step.pointing')[0].id, 'guide.any.step.adcs.0');
  assert.equal(G.scriptFor('moon', 'step.comms')[0].id, 'guide.any.step.antenna.0');
  assert.equal(G.scriptFor('moon', 'step.nonsense')[0].id, 'guide.any.step.other.0');
  assert.deepEqual(G.scriptFor('moon', 'no-such-moment'), []);
  assert.ok(G.scriptFor('pluto', 'briefing').length >= 3, 'an unknown mission uses the common lines');
});

test('lines are short, plain and use known moods', () => {
  for (const m of Object.keys(L)) {
    if (m === 'ALIAS') continue;
    for (const k of Object.keys(L[m])) {
      L[m][k].forEach(([mood, text], i) => {
        assert.ok(G.MOODS.includes(mood), `${m}.${k}.${i} mood ${mood}`);
        assert.ok(text.length > 0 && text.length <= 125, `${m}.${k}.${i} is ${text.length} chars`);
        assert.ok(!/[—–]/.test(text), `${m}.${k}.${i} has a dash`);
      });
    }
  }
});

test('params fill in', () => {
  assert.equal(G.scriptFor('moon', 'fit.good', { name: 'Find the ice' })[0].text, 'Find the ice: your ship is built for this.');
  assert.match(G.scriptFor('mars', 'review.problem', { problem: 'The rocket is too small.' })[0].text, /The rocket is too small\.$/);
});

test('the verdict reads the debrief', () => {
  assert.equal(G.verdict('moon', { result: { alive: true, success: 'full' } }).kind, 'full');
  assert.equal(G.verdict('moon', { result: { alive: true, success: 'partial' } }).kind, 'partial');
  assert.equal(G.verdict('moon', { result: { alive: true, success: 'fail' } }).kind, 'none');
  assert.equal(G.verdict('mars', { result: { alive: false } }).kind, 'lost');
  assert.match(G.verdict('mars', { result: { alive: false } }).text, /Mars/);
  assert.equal(G.verdict('moon', { result: { alive: true }, surface: { outcome: 'stranded' } }).kind, 'crew');
  assert.equal(G.verdict('moon', { result: { alive: true }, surface: { outcome: 'extracted', won: true } }).kind, 'full');
  assert.ok(G.verdict('moon', {}).text.length > 0);
});

test('KILO faces: every mood is 16 x 8 pixels, talking opens the mouth', () => {
  for (const m of G.MOODS) {
    const rows = G.faceRows(m);
    assert.equal(rows.length, 8, m);
    rows.forEach((r) => assert.equal(r.length, 16, `${m}: ${r}`));
    assert.ok(rows.join('').includes('#'), m);
    assert.notDeepEqual(G.faceRows(m, true), rows, `${m} talking`);
  }
  const svg = G.portrait('happy', { size: 100 });
  assert.match(svg, /^<svg[^>]*class="tf-kilo-svg"/);
  assert.match(svg, /data-mood="happy"/);
  assert.match(G.portrait('no-such-mood'), /data-mood="neutral"/);
});

test('say() is safe without a DOM', async () => {
  const h = G.say(null, ['hi']);
  await h.done;
  assert.equal(typeof h.next, 'function');
  assert.equal(G.muted(), false);
});

test('the crew: four originals, one per job, with faces and looks', () => {
  assert.equal(C.roster.length, 4);
  assert.deepEqual(C.roster.map((m) => m.job).sort(), ['comms', 'engineer', 'planner', 'scientist']);
  assert.equal(new Set(C.roster.map((m) => m.id)).size, 4);
  const KNOWN = ['yusuf', 'lena', 'grace', 'kwame', 'nadia', 'mariam', 'tarek', 'omar', 'aiko'];
  for (const m of C.roster) {
    assert.ok(!KNOWN.includes(m.short.toLowerCase()), `${m.name} is not a Last Light cast name`);
    for (const f of ['name', 'personality', 'bio', 'detail', 'intro', 'from']) assert.ok(m[f] && m[f].length > 5, `${m.id}.${f}`);
    assert.ok(m.intro.length <= 125, `${m.id} intro is short`);
    const a = m.appearance;
    assert.ok(['s1', 's2', 's3', 's4', 's5', 's6'].includes(a.skin));
    assert.ok(['short', 'curly', 'bun', 'covered'].includes(a.hair));
    assert.ok(['classic', 'gold', 'teal', 'navy', 'orange', 'lavender'].includes(a.suit));
    assert.ok(['m', 'f'].includes(a.body));
    assert.match(C.portrait(m.id), /^<svg[^>]*class="tf-crew-face"/);
    assert.equal(C.byJob(m.job), m);
    assert.equal(C.byId(m.id), m);
  }
  assert.equal(new Set(C.roster.map((m) => m.appearance.skin)).size >= 3, true, 'diverse');
});

test('lineup and the cabin script', () => {
  const solo = C.lineup('priya');
  assert.deepEqual(solo.map((r) => r.member.job), ['planner', 'engineer', 'scientist', 'comms']);
  assert.equal(solo.find((r) => r.you).member.id, 'priya');
  const team = C.lineup([{ name: 'Lina', role: 'engineer', you: true }, { name: 'Omar', crewId: 'jonas' }]);
  assert.equal(team.find((r) => r.member.id === 'mateo').player, 'Lina');
  assert.equal(team.find((r) => r.member.id === 'jonas').player, 'Omar');
  assert.equal(team.find((r) => r.you).member.id, 'mateo');
  const script = C.cabinScript(solo);
  assert.equal(script.length, 6);
  assert.equal(script[0].who, 'kilo');
  assert.equal(script[script.length - 1].who, 'kilo');
  assert.deepEqual(script.slice(1, 5).map((l) => l.who), ['salma', 'mateo', 'priya', 'jonas']);
  // About 20-30 seconds when typed and read at the cabin's pace.
  const secs = script.reduce((s, l) => s + l.text.length * 0.024 + Math.min(4, Math.max(2, 1.1 + l.text.length * 0.022)), 0);
  assert.ok(secs >= 18 && secs <= 34, `cabin takes ${secs.toFixed(1)} s`);
});

test('Arabic covers every KILO line, the crew and the cabin', () => {
  const missing = [];
  for (const m of Object.keys(L)) {
    if (m === 'ALIAS') continue;
    for (const k of Object.keys(L[m])) L[m][k].forEach((_, i) => AR[`guide.${m}.${k}.${i}`] || missing.push(`guide.${m}.${k}.${i}`));
  }
  for (const m of C.roster) for (const f of ['name', 'short', 'from', 'personality', 'bio', 'detail', 'intro']) AR[`crew.${m.id}.${f}`] || missing.push(`crew.${m.id}.${f}`);
  for (const j of C.JOBS) AR[`crew.job.${j}`] || missing.push(`crew.job.${j}`);
  for (const k of ['crew.cabin.open', 'crew.cabin.close', 'guide.mute', 'guide.next', 'guide.gotit', 'guide.name', 'team.cabin.title', 'team.cabin.skip', 'team.cabin.you', 'team.cabin.kilojob', 'team.cabin.go']) AR[k] || missing.push(k);
  assert.deepEqual(missing, []);
  for (const k of ['guide.any.fit.good.0', 'guide.any.review.problem.0']) assert.match(AR[k], /\{(name|problem)\}/, k);
});
