// Plays whole missions headlessly with fixed choices to catch crashes and
// check that outcomes stay in range.
const test = require('node:test');
const assert = require('node:assert');
require('../js/physics.js');
const D = require('../js/data.js');
const M = require('../js/model.js');
const O = require('../js/ops.js');

const designs = {
  mars: { instruments: ['sounder', 'hires', 'neutron'], arrays: 6, dish: 3, amp: 100, launcher: 'light', capture: 'aerobrake' },
  venus: { instruments: ['sar', 'irspec', 'uso'], arrays: 5, dish: 3, amp: 100, recorder: 1024, launcher: 'medium', capture: 'aerobrake' },
  jupiter: { instruments: ['iceRadar', 'mag', 'hires'], arrays: 70, dish: 3, amp: 100, recorder: 1024, launcher: 'heavy', shield: 75 },
};

function play(mission, seed, choose) {
  const d = { ...M.defaultDesign(mission, 'Test'), ...designs[mission] };
  const ev = M.evaluate(d);
  const flaws = O.generateFlaws(d, ev.base, seed);
  const fs = O.newFlight(d, ev, flaws, seed);
  for (const e of O.planCruise(fs)) {
    const out = e.resolve(e.choices ? choose(e) : undefined);
    assert.ok(out && out.text, `event ${e.title} has an outcome`);
    if (fs.lost) break;
    const pos = O.probePosition(ev.launch.launch, ev.launch.launch.departMs + e.at * ev.launch.launch.tofDays * 864e5);
    assert.ok(pos.every(Number.isFinite), 'probe position is finite');
  }
  const ab = O.planAerobrake(fs);
  if (ab) ab.resolve(ab.choices ? choose(ab) : undefined);
  const ins = O.insertion(fs);
  O.planScience(fs);
  const st = M.newScienceState(d, ev.base, ev.launch.scienceStartMs + fs.extraDays * 864e5, fs.health);
  const on = Object.fromEntries(d.instruments.map((id) => [id, true]));
  if (!fs.lost) while (st.turn < D.MISSIONS[mission].turns) M.stepScience(d, st, M.autoPriorities(d, st), on);
  return { fs, ins, score: M.scienceScore(d, st) };
}

for (const mission of Object.keys(designs)) {
  test(`${mission}: 40 seeded missions play to the end`, () => {
    let headlines = 0;
    const results = {};
    for (let s = 1; s <= 40; s++) {
      const { ins, score } = play(mission, s * 101, (e) => e.choices[0].id);
      results[ins.result] = (results[ins.result] || 0) + 1;
      assert.ok(score.total >= 0 && score.total <= 100.0001, 'score in range');
      if (score.headline) headlines++;
    }
    console.log(mission, 'headlines', headlines, '/ 40', JSON.stringify(results));
    assert.ok(headlines > 0, 'a good design earns the headline at least sometimes');
  });
}
