// Run with: node --test tests
const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/physics.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b} ±${tol}`);

test('Lambert reproduces an Earth-Mars Hohmann transfer', () => {
  const r1 = [P.AU, 0];
  const ang = 179.9 * (Math.PI / 180);
  const r2 = [1.52371034 * P.AU * Math.cos(ang), 1.52371034 * P.AU * Math.sin(ang)];
  const a = (1 + 1.52371034) / 2 * P.AU;
  const tof = Math.PI * Math.sqrt((a * a * a) / P.MU_SUN);
  const sol = P.lambert(r1, r2, tof, P.MU_SUN);
  assert.ok(sol, 'solution exists');
  const vE = Math.sqrt(P.MU_SUN / P.AU);
  const vinf = Math.hypot(sol.v1[0], sol.v1[1] - vE);
  near(vinf, 2.94, 0.05, 'departure v-infinity');
  near(tof / P.DAY, 259, 1, 'Hohmann time of flight in days');
});

test('Lambert end velocity lands on the target after propagation', () => {
  const tr = P.transfer('mars', Date.UTC(2028, 11, 1), 220);
  assert.ok(tr);
  const end = P.transferPosition(tr, 220 * P.DAY);
  const err = Math.hypot(end[0] - tr.r2[0], end[1] - tr.r2[1]);
  assert.ok(err < 2e4, `propagated end within 20,000 km of Mars, got ${err.toFixed(0)} km`);
});

test('a Mars window near late 2028 has a low launch energy', () => {
  let best = Infinity;
  for (let d = 0; d < 200; d += 4) {
    for (let tof = 150; tof <= 360; tof += 10) {
      const tr = P.transfer('mars', Date.UTC(2028, 8, 1) + d * 864e5, tof);
      if (tr) best = Math.min(best, tr.c3);
    }
  }
  assert.ok(best < 16, `minimum C3 in late 2028 should be modest, got ${best.toFixed(1)}`);
});

test('Juno-like Jupiter capture costs about half a km/s', () => {
  const dv = P.captureDv(5.6, P.PLANETS.jupiter.mu, 71492 + 4200, 8.1e6);
  near(dv, 0.55, 0.05, 'capture delta-v');
});

test('rocket equation', () => {
  near(P.propellantFor(1000, 3.138, 320), 1718, 5, 'propellant for 1 exhaust velocity of delta-v');
});

test('solar flux and light time', () => {
  near(P.solarFlux(5.2), 50.3, 0.5, 'flux at Jupiter');
  near(P.lightMinutes(1), 8.32, 0.02, 'light minutes per AU');
});
