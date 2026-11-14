// Orbital mechanics for the game. Planets move on circular, coplanar orbits
// (a simplification), transfers are solved with Lambert's problem.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});

  const MU_SUN = 1.32712440018e11; // km^3/s^2
  const AU = 1.495978707e8; // km
  const DAY = 86400; // s
  const C_LIGHT = 299792.458; // km/s
  const G0 = 9.80665e-3; // km/s^2
  const J2000 = Date.UTC(2000, 0, 1, 12);
  const DEG = Math.PI / 180;

  // Mean longitude at J2000 and orbital period (JPL approximate elements).
  const PLANETS = {
    venus: { name: 'Venus', a: 0.72333566, L0: 181.9790995, T: 224.701, mu: 324859, radius: 6051.8 },
    earth: { name: 'Earth', a: 1.00000261, L0: 100.46457166, T: 365.256, mu: 398600.4418, radius: 6371 },
    mars: { name: 'Mars', a: 1.52371034, L0: -4.55343205, T: 686.98, mu: 42828.37, radius: 3389.5 },
    jupiter: { name: 'Jupiter', a: 5.202887, L0: 34.39644051, T: 4332.59, mu: 126686534, radius: 71492 },
    // The Moon shares Earth's distance from the Sun (only a, mu and radius are used).
    moon: { name: 'the Moon', a: 1.00000261, L0: 100.46457166, T: 365.256, mu: 4902.8, radius: 1737.4 },
  };

  const daysSinceJ2000 = (ms) => (ms - J2000) / (DAY * 1000);

  function planetAngle(key, ms) {
    const p = PLANETS[key];
    return (p.L0 + (360 / p.T) * daysSinceJ2000(ms)) * DEG;
  }

  // Heliocentric state [x, y] km and [vx, vy] km/s.
  function planetState(key, ms) {
    const p = PLANETS[key];
    const th = planetAngle(key, ms);
    const r = p.a * AU;
    const v = Math.sqrt(MU_SUN / r);
    return {
      r: [r * Math.cos(th), r * Math.sin(th)],
      v: [-v * Math.sin(th), v * Math.cos(th)],
    };
  }

  const norm = (a) => Math.hypot(a[0], a[1]);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

  function stumpffC(z) {
    if (z > 1e-8) return (1 - Math.cos(Math.sqrt(z))) / z;
    if (z < -1e-8) return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
    return 1 / 2 - z / 24 + (z * z) / 720;
  }

  function stumpffS(z) {
    if (z > 1e-8) {
      const s = Math.sqrt(z);
      return (s - Math.sin(s)) / (s * s * s);
    }
    if (z < -1e-8) {
      const s = Math.sqrt(-z);
      return (Math.sinh(s) - s) / (s * s * s);
    }
    return 1 / 6 - z / 120 + (z * z) / 5040;
  }

  // Prograde, zero-revolution Lambert solver (universal variables, bisection).
  // Returns { v1, v2 } or null when no solution exists.
  function lambert(r1v, r2v, dt, mu) {
    const r1 = norm(r1v);
    const r2 = norm(r2v);
    const cross = r1v[0] * r2v[1] - r1v[1] * r2v[0];
    const cosd = Math.max(-1, Math.min(1, dot(r1v, r2v) / (r1 * r2)));
    let dth = Math.acos(cosd);
    if (cross < 0) dth = 2 * Math.PI - dth;
    // A transfer of exactly 0 or 180 degrees has no unique plane.
    if (Math.abs(Math.sin(dth)) < 1e-6) return null;

    const A = Math.sin(dth) * Math.sqrt((r1 * r2) / (1 - Math.cos(dth)));
    const y = (z) => r1 + r2 + (A * (z * stumpffS(z) - 1)) / Math.sqrt(stumpffC(z));
    const F = (z) => {
      const yz = y(z);
      return Math.pow(yz / stumpffC(z), 1.5) * stumpffS(z) + A * Math.sqrt(yz) - Math.sqrt(mu) * dt;
    };

    const zMax = 4 * Math.PI * Math.PI - 1e-7;
    let lo = -400;
    if (A > 0) {
      // y(z) grows with z; find where it becomes positive.
      let a = -400;
      let b = zMax;
      if (y(b) <= 0) return null;
      for (let i = 0; i < 100; i++) {
        const m = (a + b) / 2;
        if (y(m) > 0) b = m;
        else a = m;
      }
      lo = b;
    }
    let hi = zMax;
    if (!(F(lo) < 0) || !(F(hi) > 0)) return null;
    for (let i = 0; i < 120; i++) {
      const m = (lo + hi) / 2;
      if (F(m) > 0) hi = m;
      else lo = m;
    }
    const z = (lo + hi) / 2;
    const yz = y(z);
    const f = 1 - yz / r1;
    const g = A * Math.sqrt(yz / mu);
    const gdot = 1 - yz / r2;
    const v1 = [(r2v[0] - f * r1v[0]) / g, (r2v[1] - f * r1v[1]) / g];
    const v2 = [(gdot * r2v[0] - r1v[0]) / g, (gdot * r2v[1] - r1v[1]) / g];
    return { v1, v2, dth };
  }

  // Earth -> destination transfer for a departure date and time of flight.
  function transfer(dest, departMs, tofDays) {
    const arriveMs = departMs + tofDays * DAY * 1000;
    const e = planetState('earth', departMs);
    const p = planetState(dest, arriveMs);
    const sol = lambert(e.r, p.r, tofDays * DAY, MU_SUN);
    if (!sol) return null;
    const vinfDep = norm(sub(sol.v1, e.v));
    const vinfArr = norm(sub(sol.v2, p.v));
    return {
      departMs,
      arriveMs,
      tofDays,
      c3: vinfDep * vinfDep,
      vinfDep,
      vinfArr,
      r1: e.r,
      v1: sol.v1,
      r2: p.r,
      dth: sol.dth,
    };
  }

  // Burn needed to capture from a hyperbola into an orbit with periapsis rp
  // and apoapsis ra around a body with gravitational parameter mu.
  function captureDv(vinf, mu, rp, ra) {
    const vHyp = Math.sqrt(vinf * vinf + (2 * mu) / rp);
    const vOrbit = Math.sqrt((2 * mu * ra) / (rp * (ra + rp)));
    return vHyp - vOrbit;
  }

  // Propellant needed (kg) for a delta-v (km/s) given the dry mass (kg).
  function propellantFor(dryKg, dv, isp) {
    return dryKg * (Math.exp(dv / (isp * G0)) - 1);
  }

  // Position along the transfer conic at time t (s) after departure.
  // Uses the orbit's elements; transfers in this game are always elliptic.
  function transferPosition(tr, tSec) {
    const r0 = tr.r1;
    const v0 = tr.v1;
    const mu = MU_SUN;
    const r = norm(r0);
    const v2 = dot(v0, v0);
    const h = r0[0] * v0[1] - r0[1] * v0[0];
    const ex = ((v2 - mu / r) * r0[0] - dot(r0, v0) * v0[0]) / mu;
    const ey = ((v2 - mu / r) * r0[1] - dot(r0, v0) * v0[1]) / mu;
    const e = Math.hypot(ex, ey);
    const a = 1 / (2 / r - v2 / mu);
    if (e >= 1 || a <= 0) {
      // Fallback: straight interpolation (never expected in normal play).
      const k = Math.min(1, tSec / (tr.tofDays * DAY));
      return [r0[0] + (tr.r2[0] - r0[0]) * k, r0[1] + (tr.r2[1] - r0[1]) * k];
    }
    const w = Math.atan2(ey, ex);
    const n = Math.sqrt(mu / (a * a * a));
    const nu0 = Math.atan2(r0[1], r0[0]) - w;
    const E0 = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu0 / 2));
    const M0 = E0 - e * Math.sin(E0);
    const M = M0 + n * tSec * Math.sign(h || 1);
    let E = M;
    for (let i = 0; i < 30; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const rr = a * (1 - e * Math.cos(E));
    return [rr * Math.cos(nu + w), rr * Math.sin(nu + w)];
  }

  // Sun-Earth-Probe angle in degrees: small values mean the Sun blocks radio.
  function sepAngle(earthR, probeR) {
    const toSun = [-earthR[0], -earthR[1]];
    const toProbe = sub(probeR, earthR);
    const c = dot(toSun, toProbe) / (norm(toSun) * norm(toProbe));
    return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
  }

  function earthDistanceAU(dest, ms) {
    const e = planetState('earth', ms).r;
    const p = planetState(dest, ms).r;
    return norm(sub(p, e)) / AU;
  }

  const lightMinutes = (au) => (au * AU) / C_LIGHT / 60;

  // Solar flux in W/m^2 at a distance in AU.
  const solarFlux = (au) => 1361 / (au * au);

  SMD.physics = {
    MU_SUN,
    AU,
    DAY,
    C_LIGHT,
    G0,
    PLANETS,
    planetState,
    planetAngle,
    lambert,
    transfer,
    captureDv,
    propellantFor,
    transferPosition,
    sepAngle,
    earthDistanceAU,
    lightMinutes,
    solarFlux,
    norm,
    sub,
  };
  if (typeof module === 'object' && module.exports) module.exports = SMD.physics;
})();
