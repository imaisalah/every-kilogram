// Shared by the team room and network tests. A tiny stand-in for SMD.team.sim
// with the shape docs/TEAM.md binds (it is not a *.test.js, so it never runs alone).
const ROLES = ['planner', 'engineer', 'scientist', 'comms'];

const KEY_OWNER = { launcher: 'planner', solar: 'engineer', camera: 'scientist', antenna: 'comms' };
const option = (id, mass, cost) => ({ id, name: id, mass, powerW: mass, costM: cost, dataGbitDay: 1, science: 1, note: '', source: '' });

const stubSim = {
  scenarios: () => [
    { id: 'moon', title: 'Moon ice', body: 'moon', objectives: [{ id: 'ice' }, { id: 'map' }], requirements: [{ id: 'sharp' }, { id: 'wide' }] },
    { id: 'nile', title: 'Nile', body: 'earth', objectives: [{ id: 'flood' }], requirements: [{ id: 'daily' }] },
  ],
  difficulties: () => [{ id: 'engineer' }, { id: 'cadet', designSec: 240 }],
  catalog: () => ({
    roles: {
      planner: [{ key: 'launcher', title: 'Launcher', options: [option('falcon', 0, 60), option('tiny', 0, 5)] }],
      engineer: [{ key: 'solar', title: 'Solar', options: [option('small', 5, 2), option('big', 20, 8)] }],
      scientist: [{ key: 'camera', title: 'Camera', options: [option('basic', 3, 1), option('super', 15, 9)] }],
      comms: [{ key: 'antenna', title: 'Antenna', options: [option('low', 2, 1), option('high', 9, 4)] }],
    },
  }),
  newDesign: (scenario, difficulty, requirement) => ({ scenario, difficulty, requirement, launcher: 'falcon', solar: 'small', camera: 'basic', antenna: 'low' }),
  rolesOf: (key) => [KEY_OWNER[key]],
  set(design, role, key, value) {
    if (KEY_OWNER[key] !== role) return { error: 'not your part' };
    return { ...design, [key]: value };
  },
  resources(d) {
    const res = (value, limit, unit) => ({ value, limit, unit, status: value > limit ? 'bad' : 'ok', why: '' });
    const power = d.solar === 'big' ? 120 : 40;
    return {
      mass: res(d.camera === 'super' ? 400 : 200, 300, 'kg'),
      power: { value: power, limit: 80, unit: 'W', status: power < 80 ? 'bad' : 'ok', why: '' },
      budget: res(d.launcher === 'falcon' ? 200 : 90, 250, '$M'),
      data: res(10, 20, 'Gb'),
      comms: res(10, 20, 'Gb'),
      time: res(10, 20, 'd'),
    };
  },
  checks: (d) => [{ id: 'lift', hard: true, ok: d.launcher !== 'tiny', text: 'The rocket cannot lift this to that orbit.' }],
  preview: () => ({}),
  fly(design, seed, outcomes) {
    const frames = [];
    for (let t = 0; t <= 300; t += 3) frames.push({ t, sunlit: t % 60 < 40, battery: 80, powerIn: 40, powerOut: 30, buffer: 1, downlink: 1, science: t / 3, fuel: 10, alive: true, phase: 'cruise' });
    const events = [
      { id: 'c1', t: 60, kind: 'crisis', role: 'planner', fixRole: 'comms', title: 'Antenna jammed', alarm: 'Tell Comms: switch to low gain', fixLabel: 'Switch to low gain' },
      { id: 'c2', t: 180, kind: 'crisis', role: 'scientist', fixRole: 'engineer', title: 'Battery spike', alarm: 'Tell Engineer: shed load', fixLabel: 'Shed load' },
    ];
    return { frames, events, result: { alive: !design.dies, cause: design.dies ? 'it died' : null, science: 100, dataLost: 0, seed, outcomes: outcomes || null } };
  },
  score: (design, flight, stats) => ({ total: 500, stats }),
  chain: (design, seed, surface) => [{ text: 'A then B', why: 'because', delta: 1, kind: 'cause', surface: surface || null }],
  bestChange: () => ({ role: 'engineer', key: 'solar', value: 'big' }),
  obituary: (design, flight) => (flight.result.alive ? null : { title: 'RIP', cause: 'x', epitaph: 'y', analog: { mission: 'Mars Observer', year: 1993, story: '', source: '' } }),
  agendas: (seed, roles) => roles.map((role) => ({ role, id: `agenda-${role}`, text: `secret goal of ${role}` })),
};

// Spin until a condition holds; fails the test with `what` on timeout.
async function until(check, what, ms = 12000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const value = check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`timed out waiting for ${what}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { ROLES, stubSim, until, sleep };
