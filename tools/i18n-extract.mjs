// String catalogue for translators: every SMD.t(key, english) the game can show.
// Usage:
//   node tools/i18n-extract.mjs                 summary + keys missing from ar.js
//   node tools/i18n-extract.mjs --json out.json  write { key: english } for all keys
//   node tools/i18n-extract.mjs --missing        print missing keys as JSON (key: english)
//   node tools/i18n-extract.mjs --dynamic        list call sites whose key is built at runtime
//   node tools/i18n-extract.mjs --unused         list Arabic keys no call site uses
// Static keys come from string-literal calls to t / tr / SMD.t in js/** and
// content/*. Keys built at runtime ('mission.' + key + '.title', `hq.month.${i}`)
// are enumerated from the game data (js/data.js, content/*) by the table below.
// Placeholders ({n}) in a translation must match the English ones; mismatches
// are reported.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const args = process.argv.slice(2);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// Split the argument list that starts after '(' at index i. Skips strings,
// templates (with nested ${}) and comments; returns raw top-level arguments.
function readArgs(src, i) {
  const parts = [];
  let depth = 0;
  let start = i;
  const stack = [];
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (stack.length && stack[stack.length - 1] === '`') {
      if (c === '\\') j++;
      else if (c === '`') stack.pop();
      else if (c === '$' && src[j + 1] === '{') {
        stack.push('{');
        j++;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      for (j++; j < src.length && src[j] !== c; j++) if (src[j] === '\\') j++;
      continue;
    }
    if (c === '`') {
      stack.push('`');
      continue;
    }
    if (c === '/' && src[j + 1] === '/') {
      j = src.indexOf('\n', j);
      continue;
    }
    if (c === '/' && src[j + 1] === '*') {
      j = src.indexOf('*/', j) + 1;
      continue;
    }
    if (stack.length && stack[stack.length - 1] === '{') {
      if (c === '{') stack.push('{');
      else if (c === '}') stack.pop();
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) {
        parts.push(src.slice(start, j).trim());
        return parts;
      }
      depth--;
    } else if (c === ',' && depth === 0) {
      parts.push(src.slice(start, j).trim());
      start = j + 1;
    }
  }
  return parts;
}

// A plain literal ('x', "x", `x` without ${}) as its value, else null.
function literal(raw) {
  if (!raw) return null;
  if (/^'(?:[^'\\]|\\.)*'$/.test(raw) || /^"(?:[^"\\]|\\.)*"$/.test(raw) || /^`(?:[^`\\$]|\\.|\$(?!\{))*`$/.test(raw)) {
    try {
      return new Function(`return ${raw}`)();
    } catch (e) {
      return null;
    }
  }
  return null;
}

const CALL = /(?:\bSMD\.t|(?<![\w$.])tr?)\s*\(/g;
const LOG = /(?<![\w$.])log\s*\((?=\s*ag\s*,)/g;

async function staticKeys() {
  const files = [...(await walk(join(ROOT, 'js'))), ...(await walk(join(ROOT, 'content')))].filter((f) => !/[\\/]i18n[\\/]/.test(f) && !f.endsWith('i18n.js'));
  const keys = new Map();
  const dynamic = [];
  const conflicts = [];
  for (const f of files) {
    const src = await readFile(f, 'utf8');
    const rel = relative(ROOT, f).replace(/\\/g, '/');
    for (const m of src.matchAll(CALL)) {
      const a = readArgs(src, m.index + m[0].length);
      if (a.length < 2 || !a[0]) continue; // t(key, english[, params]) always has the English
      const line = src.slice(0, m.index).split('\n').length;
      const key = literal(a[0]);
      if (key === null) {
        if (/^(k|key|s)$/.test(a[0]) || !a[1]) continue; // wrapper definitions and non-t calls
        dynamic.push({ at: `${rel}:${line}`, key: a[0], english: a[1] || '' });
        continue;
      }
      if (!/^[A-Za-z][\w.-]*$/.test(key)) continue; // not a key: a word like "it(" in prose
      const en = literal(a[1]);
      const prev = keys.get(key);
      if (prev && en !== null && prev.en !== null && prev.en !== en) conflicts.push({ key, a: prev.en, b: en, at: `${rel}:${line}` });
      if (!prev || prev.en === null) keys.set(key, { en, at: `${rel}:${line}` });
    }
    // agency.js news lines: log(ag, 'agency.log.x', 'English {name}', params).
    for (const m of src.matchAll(LOG)) {
      const a = readArgs(src, m.index + m[0].length);
      const key = literal(a[1]);
      if (key && /^[A-Za-z][\w.-]*$/.test(key) && !keys.has(key)) keys.set(key, { en: literal(a[2]), at: `${rel}:${src.slice(0, m.index).split('\n').length}` });
    }
  }
  return { keys, dynamic, conflicts };
}

async function loadGame() {
  const ctx = { console, Math, Date, JSON, Object, Array, Number, String, Set, Map };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['js/physics.js', 'js/data.js', 'js/model.js', 'js/ops.js', 'js/agency.js', 'content/events.js', 'content/discoveries.js', 'content/realMissions.js', 'content/sources.js', 'content/tips.js']) {
    try {
      vm.runInContext(await readFile(join(ROOT, f), 'utf8'), ctx, { filename: f });
    } catch (e) {
      console.error(`could not load ${f}: ${e.message}`);
    }
  }
  if (ctx.SMD) ctx.SMD.__agencySrc = await readFile(join(ROOT, 'js/agency.js'), 'utf8');
  return ctx.SMD;
}

// js/ui-common.js PHASES (the mission track): ui.phase.<id>.
const PHASES = [
  { id: 'goal', label: 'Goal' },
  { id: 'build', label: 'Build' },
  { id: 'test', label: 'Test' },
  { id: 'window', label: 'Launch window' },
  { id: 'launch', label: 'Launch' },
  { id: 'flight', label: 'Flight' },
  { id: 'science', label: 'Science' },
  { id: 'legacy', label: 'Legacy' },
];

// Keys built at runtime, enumerated from the data. Keep in step with the
// call sites printed by --dynamic.
function dynamicKeys(SMD) {
  const out = new Map();
  const add = (k, en) => en && out.set(k, { en: String(en), at: 'data' });
  const D = SMD.data || {};
  const C = SMD.content || {};
  const P = (SMD.physics && SMD.physics.PLANETS) || {};
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  MONTHS.forEach((m, i) => add(`hq.month.${i}`, m));
  MONTHS.forEach((m, i) => add(`ui.month.${i}`, m));
  ((SMD.ui && SMD.ui.PHASES) || PHASES).forEach((x) => add(`ui.phase.${x.id}`, x.label));
  // Part, subsystem, flaw and test names (ui-cards, research, ops flawLabel, lessons).
  for (const [list, opts] of Object.entries(D.OPTIONS || {})) (opts || []).forEach((o) => o && o.name && add(`data.opt.${list}.${o.id}`, o.name));
  for (const [id, x] of Object.entries(D.SUBSYSTEMS || {})) add(`data.sub.${id}`, x.name);
  for (const [id, text] of Object.entries(D.FLAW_TEXT || {})) add(`data.flaw.${id}`, text);
  (D.TESTS || []).forEach((x) => {
    add(`data.test.${x.id}`, x.name);
    add(`data.test.${x.id}.blurb`, x.blurb);
  });
  const DEST = { nile: 'Earth orbit · over the Nile', weather: 'Earth orbit · over the Sahara', moon: 'The Moon · polar orbit', mars: 'Mars orbit', venus: 'Venus orbit', jupiter: 'Jupiter · Europa flybys' };
  for (const [key, m] of Object.entries(D.MISSIONS || {})) {
    for (const pre of ['hq.m', 'archive.mission', 'end.mission', 'map.mission', 'research.mission']) add(`${pre}.${key}`, m.title);
    add(`mission.${key}.title`, m.title);
    add(`mission.${key}.question`, m.question);
    add(`mission.${key}.headline`, m.headline);
    add(`archive.question.${key}`, m.question);
    add(`end.question.${key}`, m.question);
    add(`end.headline.${key}`, m.headline);
    if (m.aerobrake && m.aerobrake.note) add(`mission.${key}.aeroNote`, m.aerobrake.note);
    (m.objectives || []).forEach((o) => add(`mission.${key}.obj.${o.id}`, o.label));
    add(`board.dest.${key}`, DEST[key] || (P[m.dest] && P[m.dest].name));
    add(`board.body.${key === 'jupiter' ? 'europa' : m.dest}`, key === 'jupiter' ? 'Europa' : cap(m.dest));
    if (D.CONTRACTS && D.CONTRACTS[key]) add(`board.sponsor.${key}`, D.CONTRACTS[key].sponsor);
  }
  for (const [k, p] of Object.entries(P)) {
    add(`planet.${k}`, p.name);
    add(`end.planet.${k}`, p.name);
  }
  for (const [id, x] of Object.entries(D.INSTRUMENTS || {})) {
    add(`inst.${id}`, x.name);
    add(`inst.${id}.blurb`, x.blurb);
    add(`hq.inst.${id}`, x.name);
  }
  (D.TECH || []).forEach((x) => {
    add(`tech.${x.id}`, x.name);
    add(`research.tech.${x.id}.name`, x.name);
    add(`research.tech.${x.id}.effect`, x.effect);
  });
  (D.TEST_PLANS || []).forEach((x) => {
    add(`tests.${x.id}`, x.name);
    add(`tests.${x.id}.blurb`, x.blurb);
  });
  ((D.OPTIONS && D.OPTIONS.launcher) || []).forEach((o) => add(`design.opt.launcher.${o.id}`, o.name));
  const CONF = (SMD.agency && SMD.agency.CONFIDENCE) || D.CONFIDENCE || {};
  for (const [id, c] of Object.entries(CONF)) {
    add(`conf.${id}`, c.name);
    add(`conf.${id}.blurb`, c.blurb);
  }
  // approve() refusals: { ok: false, why: 'busy', text: '...' } in js/agency.js
  for (const m of (SMD.__agencySrc || '').matchAll(/why: '(\w+)', text: '((?:[^'\\]|\\.)*)'/g)) add(`design.fail.${m[1]}`, m[2].replace(/\\'/g, "'"));
  (C.events || []).forEach((e) => {
    const k = `content.events.${e.id}`;
    add(`${k}.title`, e.title);
    add(`${k}.body`, e.body);
    if (e.realStory) {
      add(`${k}.mission`, e.realStory.mission);
      add(`${k}.lesson`, e.realStory.lesson);
    }
    (e.choices || []).forEach((c) => add(`${k}.choice.${c.id}`, c.label));
  });
  for (const list of Object.values(C.discoveries || {}))
    (list || []).forEach((d) => {
      add(`content.discoveries.${d.id}.title`, d.title);
      add(`content.discoveries.${d.id}.caption`, d.caption);
    });
  for (const [key, m] of Object.entries(C.realMissions || {})) {
    const k = `content.realMissions.${key}`;
    ['fact', 'powerNote', 'costNote', 'massNote', 'dataNote'].forEach((f) => add(`${k}.${f}`, m[f]));
    (m.related || []).forEach((r, i) => add(`${k}.related.${i}`, r.text));
  }
  for (const [key, s] of Object.entries(C.sources || {})) if (s && s.text) add(`content.sources.${key}`, s.text);
  (C.tips || []).forEach((x) => add(`content.tips.${x.id}`, x.text));
  return out;
}

async function loadAr() {
  const ctx = { globalThis: null };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(await readFile(join(ROOT, 'js/i18n/ar.js'), 'utf8'), ctx);
  // Feature files (ar-hands.js, ar-testlab.js, ...) add their keys to the same dictionary.
  const extra = (await readdir(join(ROOT, 'js/i18n'))).filter((f) => /^ar-[\w-]+\.js$/.test(f)).sort();
  for (const f of extra) vm.runInContext(await readFile(join(ROOT, 'js/i18n', f), 'utf8'), ctx);
  // The team game keeps part of its Arabic next to its code.
  const team = (await readdir(join(ROOT, 'js/team'))).filter((f) => /^ar-[\w-]+\.js$/.test(f)).sort();
  for (const f of team) vm.runInContext(await readFile(join(ROOT, 'js/team', f), 'utf8'), ctx);
  return (ctx.SMD && ctx.SMD.i18nDicts && ctx.SMD.i18nDicts.ar) || {};
}

const holes = (s) => [...String(s || '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const { keys, dynamic, conflicts } = await staticKeys();
const SMD = await loadGame();
const dyn = dynamicKeys(SMD);
const all = new Map([...dyn, ...keys].map(([k, v]) => [k, v]));
for (const [k, v] of keys) if (v.en === null && dyn.has(k)) all.set(k, dyn.get(k));
const ar = await loadAr();
const missing = [...all.keys()].filter((k) => !ar[k]).sort();
const extra = Object.keys(ar).filter((k) => !all.has(k)).sort();
const badHoles = [...all].filter(([k, v]) => ar[k] && v.en && holes(v.en) !== holes(ar[k])).map(([k]) => k);

if (args[0] === '--json') {
  const obj = Object.fromEntries([...all].sort().map(([k, v]) => [k, v.en]));
  await writeFile(args[1] || 'i18n-en.json', JSON.stringify(obj, null, 1));
  console.log(`wrote ${Object.keys(obj).length} keys`);
} else if (args[0] === '--missing') {
  console.log(JSON.stringify(Object.fromEntries(missing.map((k) => [k, all.get(k).en])), null, 1));
} else if (args[0] === '--unused') {
  extra.forEach((k) => console.log(k));
} else if (args[0] === '--dynamic') {
  dynamic.forEach((d) => console.log(`${d.at}  ${d.key}  ${d.english.slice(0, 60)}`));
} else {
  console.log(`keys: ${all.size} (${keys.size} literal, ${dyn.size} from data)`);
  console.log(`arabic: ${Object.keys(ar).length}, missing: ${missing.length}, unused: ${extra.length}, placeholder mismatches: ${badHoles.length}`);
  if (conflicts.length) console.log('same key, different English:\n  ' + conflicts.map((c) => `${c.key} @ ${c.at}: "${c.a}" vs "${c.b}"`).join('\n  '));
  if (badHoles.length) console.log('placeholder mismatches:\n  ' + badHoles.join('\n  '));
  if (missing.length) console.log('missing (first 40):\n  ' + missing.slice(0, 40).join('\n  '));
  if (extra.length) console.log('unused (first 40):\n  ' + extra.slice(0, 40).join('\n  '));
  process.exitCode = missing.length || badHoles.length ? 1 : 0;
}
