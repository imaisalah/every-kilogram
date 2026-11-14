// The Last Light post pipeline (js/ll/render.js): its option merging and white
// balance (js/ll/post-options.js, import-free), and that every relative import
// of the pipeline, the sets and the vendored three.js examples resolves to a
// file (the browser would otherwise fail the whole module graph at run time).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
let M = null;
async function opts() {
  if (M) return M;
  const src = fs.readFileSync(path.join(ROOT, 'js/ll/post-options.js'), 'utf8');
  M = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
  return M;
}

test('merge changes only the keys given, one level deep', async () => {
  const { DEFAULTS, merge } = await opts();
  const o = merge(DEFAULTS, { bloom: { strength: 2 }, grain: 0 });
  assert.strictEqual(o.bloom.strength, 2);
  assert.strictEqual(o.bloom.radius, DEFAULTS.bloom.radius);
  assert.strictEqual(o.grain, 0);
  assert.strictEqual(o.vignette, DEFAULTS.vignette);
  assert.strictEqual(DEFAULTS.bloom.strength, 0.55, 'the defaults are never mutated');
});

test('false turns a stage off; an object later turns it back on from the defaults', async () => {
  const { DEFAULTS, merge } = await opts();
  const off = merge(DEFAULTS, { ao: false });
  assert.strictEqual(off.ao, false);
  const on = merge(off, { ao: { radius: 2 } });
  assert.strictEqual(on.ao.radius, 2);
  assert.strictEqual(on.ao.intensity, DEFAULTS.ao.intensity);
});

test('undefined keys are ignored and arrays replace', async () => {
  const { DEFAULTS, merge } = await opts();
  const o = merge(DEFAULTS, { blur: undefined, grade: { lift: [0.1, 0, 0] } });
  assert.strictEqual(o.blur, 0);
  assert.deepStrictEqual(o.grade.lift, [0.1, 0, 0]);
  assert.strictEqual(o.grade.contrast, DEFAULTS.grade.contrast);
});

test('white balance: neutral is identity, warm raises red and lowers blue, clamped', async () => {
  const { balance } = await opts();
  assert.deepStrictEqual(balance({}), [1, 1, 1]);
  const w = balance({ temperature: 1 });
  assert.ok(w[0] > 1 && w[2] < 1);
  const c = balance({ temperature: -1 });
  assert.ok(c[0] < 1 && c[2] > 1);
  assert.deepStrictEqual(balance({ temperature: 9 }), balance({ temperature: 1 }));
  const m = balance({ tint: 1 });
  assert.ok(m[1] < 1, 'magenta tint lowers green');
});

test('every look is a valid partial of the defaults', async () => {
  const { DEFAULTS, LOOKS, merge } = await opts();
  for (const [name, look] of Object.entries(LOOKS)) {
    for (const k of Object.keys(look)) assert.ok(k in DEFAULTS, `${name}.${k} is a known option`);
    const o = merge(DEFAULTS, look);
    assert.ok(o.bloom.threshold > 0 && o.bloom.strength >= 0, name);
    assert.ok(o.vignette >= 0 && o.vignette < 1 && o.grain >= 0 && o.grain < 0.2, name);
  }
});

// ---------- Module graph ----------
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
function relImports(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  let m;
  IMPORT.lastIndex = 0;
  while ((m = IMPORT.exec(src))) {
    const spec = m[1] || m[2];
    if (spec && spec.startsWith('.')) out.push(spec);
  }
  return out;
}

test('the post pipeline, the sets and the vendored examples import only files that exist', () => {
  const seen = new Set();
  const queue = ['js/ll/render.js', 'js/3d/engine.js', 'tools/ll-sets.js'];
  const setsDir = path.join(ROOT, 'js/ll/sets');
  if (fs.existsSync(setsDir)) fs.readdirSync(setsDir).filter((f) => f.endsWith('.js')).forEach((f) => queue.push('js/ll/sets/' + f));
  const missing = [];
  while (queue.length) {
    const rel = queue.shift();
    const abs = path.join(ROOT, rel);
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    for (const spec of relImports(abs)) {
      const next = path.relative(ROOT, path.resolve(path.dirname(abs), spec)).split(path.sep).join('/');
      queue.push(next);
    }
  }
  assert.deepStrictEqual(missing, []);
  assert.ok(seen.size >= 15, 'the graph was walked (' + seen.size + ' files)');
});

test('the vendored examples are three r160 and import three through the import map', () => {
  const dirs = ['vendor/postprocessing', 'vendor/shaders', 'vendor/math'];
  for (const d of dirs) {
    for (const f of fs.readdirSync(path.join(ROOT, d))) {
      const src = fs.readFileSync(path.join(ROOT, d, f), 'utf8');
      const bare = [...src.matchAll(/from\s*['"]([^'".][^'"]*)['"]/g)].map((m) => m[1]);
      for (const b of bare) assert.strictEqual(b, 'three', `${d}/${f} imports ${b}`);
    }
  }
});
