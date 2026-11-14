#!/usr/bin/env node
// Headless balance report for the calm surface mission (docs/TEAM-SURFACE.md).
// Usage: node tools/surface-balance.cjs [--seeds 40] [--cf 30] [--worlds moon,mars,venus,europa]
//                                       [--difficulties cadet,engineer,director] [--skip-items] [--with-human]
//   --seeds       missions per design tier, world and difficulty
//   --cf          missions per one-change variant per world (the "what decided it" table)
//   --skip-tiers  only the one-change table
//   --with-human  one seat is an idle person (bots wait for people before calling everyone home)
// Plays all-bot missions. Results: success (extracted, objective met, 25% of the map's science),
// partial (extracted, short of that), stranded (the ascent window closed).
const path = require('node:path');
const SURF = require(path.join(__dirname, '..', 'js', 'team', 'surface-sim.js'));

// Real starter designs from the mission model, when it can be loaded.
let SIM = null;
try {
  require(path.join(__dirname, '..', 'js', 'physics.js'));
  require(path.join(__dirname, '..', 'js', 'data.js'));
  require(path.join(__dirname, '..', 'js', 'model.js'));
  require(path.join(__dirname, '..', 'js', 'team', 'data.js'));
  SIM = require(path.join(__dirname, '..', 'js', 'team', 'sim.js'));
  if (!SIM || !SIM.surfaceLoadout) SIM = (globalThis.SMD.team && globalThis.SMD.team.sim) || null;
} catch (e) {
  SIM = null;
}
function simLoadout(world) {
  for (const sc of SIM.scenarios()) {
    try {
      const req = sc.requirements && sc.requirements[0] ? sc.requirements[0].id : undefined;
      const l = SIM.surfaceLoadout(SIM.newDesign(sc.id, 'engineer', req));
      if (l && l.world === world) return l;
    } catch (e) {}
  }
  return null;
}

// Each variant changes one thing on the mid design, so a flipped outcome is down to that item.
const VARIANTS = {
  baseline: () => {},
  'objective instrument left home': (l) => { l.instruments = l.instruments.slice(-1); },
  'one instrument': (l) => { l.instruments = l.instruments.slice(0, 1); },
  'no drill (scoops only)': (l) => { l.drill = null; },
  'no spare O2': (l) => { l.spareO2 = 0; },
  'small battery': (l) => { l.power.batteryWh *= 0.25; },
  'small solar': (l) => { l.power.solarW *= 0.25; l.power.rtgW *= 0.25; },
  'weak radio': (l) => { l.uplink.rateGbitS *= 0.33; },
  'rare windows': (l) => { l.uplink.everyS *= 2.2; },
  'small recorder': (l) => { l.recorderGbit *= 0.3; },
  'short lifetime': (l) => { l.lifetimeS *= 0.72; },
  'low ascent fuel': (l) => { l.ascent.liftKg *= 0.3; },
  'far landing': (l) => { l.landing.offsetM = 55; },
};

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf('--' + n);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (n) => args.includes('--' + n);
const SEEDS = Number(opt('seeds', 40));
const CF = Number(opt('cf', 30));
const WORLDS = opt('worlds', 'moon,mars,venus,europa').split(',');
const DIFFS = opt('difficulties', 'cadet,engineer,director').split(',');
const humans = flag('with-human') ? [{ id: 'h', role: 'planner' }] : 0;

function play(load, world, seed, difficulty) {
  const st = SURF.create(load, seed, humans, { difficulty, world });
  let guard = 0;
  while (!st.over && guard++ < 30000) SURF.step(st, {}, SURF.TICK);
  return SURF.summary(st);
}

function cell(tier, world, difficulty, n) {
  const out = { success: 0, partial: 0, stranded: 0, t: 0, progress: 0, science: 0, returns: 0, dumped: 0 };
  for (let i = 0; i < n; i++) {
    const load = tier === 'starter' ? simLoadout(world) : SURF.fixture(tier, world);
    if (!load) return null;
    const s = play(load, world, 1000 + i, difficulty);
    out[s.result]++;
    out.t += s.t;
    out.progress += s.progress;
    out.science += s.science.value / Math.max(1, s.science.valueAll);
    out.returns += s.crew.returns;
    out.dumped += s.samples.jettisoned;
  }
  for (const k of ['t', 'progress', 'science', 'returns', 'dumped']) out[k] /= n;
  out.n = n;
  return out;
}

const pct = (x, n) => `${Math.round((100 * x) / n)}%`;
const t0 = Date.now();
console.log(`Surface balance: ${SEEDS} missions per cell, bots${humans ? ' + one idle person' : ' only'}.\n`);
console.log('Completion (success / partial / stranded), average objectives done, share of the map\'s science home, mission length, suit returns, samples thrown overboard:\n');
console.log('| Design | Difficulty | ' + WORLDS.map((w) => w[0].toUpperCase() + w.slice(1)).join(' | ') + ' |');
console.log('|---|---|' + WORLDS.map(() => '---').join('|') + '|');
const tiers = ['good', 'mid', 'poor'].concat(SIM ? ['starter'] : []);
for (const tier of flag('skip-tiers') ? [] : tiers) {
  for (const d of DIFFS) {
    const row = WORLDS.map((w) => {
      const c = cell(tier, w, d, tier === 'starter' ? Math.max(10, Math.round(SEEDS / 2)) : SEEDS);
      if (!c) return 'n/a';
      return `${pct(c.success, c.n)} / ${pct(c.partial, c.n)} / ${pct(c.stranded, c.n)}; obj ${Math.round(c.progress * 100)}%, sci ${Math.round(c.science * 100)}%, ${Math.round(c.t)} s, ret ${c.returns.toFixed(1)}, dump ${c.dumped.toFixed(1)}`;
    });
    console.log(`| ${tier} | ${d} | ${row.join(' | ')} |`);
  }
}

if (!flag('skip-items')) {
  console.log(`\nWhat each item decides (mid design, Engineer, ${CF} missions per world, same seeds, one change):\n`);
  console.log('| Change | Success | Partial | Stranded | Objectives | Science home |');
  console.log('|---|---|---|---|---|---|');
  for (const [name, fn] of Object.entries(VARIANTS)) {
    const agg = { success: 0, partial: 0, stranded: 0, progress: 0, science: 0, n: 0 };
    for (const w of WORLDS) {
      for (let i = 0; i < CF; i++) {
        const load = SURF.fixture('mid', w);
        fn(load);
        const s = play(load, w, 2000 + i, 'engineer');
        agg[s.result]++;
        agg.progress += s.progress;
        agg.science += s.science.value / Math.max(1, s.science.valueAll);
        agg.n++;
      }
    }
    console.log(`| ${name} | ${pct(agg.success, agg.n)} | ${pct(agg.partial, agg.n)} | ${pct(agg.stranded, agg.n)} | ${Math.round((agg.progress / agg.n) * 100)}% | ${Math.round((agg.science / agg.n) * 100)}% |`);
  }
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
