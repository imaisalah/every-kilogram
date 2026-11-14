// Survival segments of story mode (docs/STORY.md): short, hands-on survival
// play between the story beats, driven by the real Apollo 13 / Orion numbers
// in content/story/survival.js.
//
// SMD.storySurvival.run(host, segmentId, state) -> Promise<{ result, state }>
//   mounts inside host, plays, mutates state.res / state.health / state.flags.
// SMD.storySurvival.quick(segmentId, state, 'good'|'bad') -> { result, state }
//   the same state changes without play (tests, the "Skip (auto)" button).
// SMD.storySurvival.SEGMENTS: the five segment ids.
// Dev: index.html#dev-survival-ep2.co2 (any id) mounts one on a blank screen.
//
// The segment numbers are pure functions (SMD.storySurvival.models) so
// tests/survival.test.js can check them without a browser.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const HAS_DOM = typeof document !== 'undefined' && typeof window !== 'undefined';
  const fill = (s, p) => (p ? String(s).replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : String(s));
  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : fill(e, p));
  // English for the longer texts (the code passes the short ones inline).
  const EN = {
    kicker: 'Survival · Episode {n}',
    'cast.you': 'Commander',
    // ----- ep2.power -----
    'power.title': 'Power down',
    'power.goal': 'Make the battery last until home, with margin.',
    'power.lede': 'The oxygen tank is gone, and the main power with it. The emergency battery is all you have, and it was never meant to last this long. Every system you leave on drains it. Every system you turn off makes the cabin colder, darker or quieter.',
    'power.controls': 'Click or tap On, Low or Off for each system (Tab and Enter work too).|Watch the battery line: it must reach home, plus a 5% margin.|The battery drains while you decide. Lock in your plan before the clock runs out.',
    'power.win': 'The battery reaches home',
    'power.lose': 'Not enough power',
    'power.real': 'After Apollo 13’s oxygen tank exploded, the lunar module’s batteries (about 2,200 amp-hours) had to keep three men alive for about 87 hours, though they were meant for two men for about 45. Ground teams cut the draw from about 50 amps toward 12. The crew lived at roughly 3 to 11 °C, and the guidance computer stayed off until the last burns. About 129 amp-hours went back to recharge the capsule’s entry batteries.',
    'power.sys.core': 'Life support core',
    'power.note.core': 'Oxygen flow, cabin pressure, caution and warning.',
    'power.sys.fans': 'Scrubber fans',
    'power.note.fans': 'Push air through the CO2 cartridges. Low: CO2 builds up faster later.',
    'power.sys.heaters': 'Cabin heaters',
    'power.note.heaters': 'Low: about 11 °C. Off: about 4 °C, like Apollo 13.',
    'power.sys.comms': 'Radio',
    'power.note.comms': 'Low: voice only. Off: Houston cannot hear you.',
    'power.sys.guidance': 'Guidance computer',
    'power.note.guidance': 'The biggest load. Off: the next burn is flown by hand.',
    'power.sys.displays': 'Cockpit displays',
    'power.note.displays': 'Low: only one display stays lit.',
    'power.sys.lights': 'Cabin lights',
    'power.note.lights': 'Low: work lights only. Off: flashlights.',
    'power.sys.water': 'Water heater',
    'power.note.water': 'Hot water for food and drinks.',
    'power.sys.windows': 'Window heaters',
    'power.note.windows': 'Off: the windows fog and frost over.',
    'power.sys.radar': 'Docking radar',
    'power.note.radar': 'There is nothing to dock with now.',
    'power.sys.camera': 'Science camera',
    'power.note.camera': 'Cameras and recorders.',
    // ----- ep2.co2 -----
    'co2.title': 'The square peg',
    'co2.goal': 'Build the CO2 adapter before the cabin air makes the crew sick.',
    'co2.lede': 'The scrubbers that clean CO2 out of the air are full. The spare cartridges are square; the slots here are round. Houston has built a fix on the ground from things you have aboard. Find the parts, then follow their steps, in order.',
    'co2.controls': 'Move: W A S D or the arrow keys, Space up, C down. Drag to look around.|Open lockers and use the work surface with E, or click or tap them. The “Float to” buttons take you there.|At the work surface, pick the part each step needs. A wrong part costs time.',
    'co2.win': 'CO2 falling',
    'co2.lose': 'CO2 poisoning',
    'co2.real': 'On Apollo 13, the lunar module’s round lithium hydroxide canisters were meant for two people for about two days, and the command module’s square ones did not fit. Engineers in Houston built an adapter from a plastic bag, a suit hose, gray tape, the cardboard cover of the flight plan and socks, and read the steps up to the crew. The CO2 reading had climbed to about 15 mmHg; within an hour of fitting two “mailboxes” it was down to a few tenths. Socks were on the real parts list; this game uses one to pad the hose joint.',
    'co2.locker.cartridge': 'Spare CO2 cartridges',
    'co2.locker.hose': 'Suit hoses',
    'co2.locker.bag': 'Cooling-garment bags',
    'co2.locker.tape': 'Tool kit',
    'co2.locker.cover': 'Flight plan and checklists',
    'co2.locker.sock': 'Crew clothing',
    'co2.locker.L7': 'Food',
    'co2.locker.L8': 'Medical kit',
    'co2.item.cartridge': 'Square cartridge',
    'co2.item.hose': 'Suit hose',
    'co2.item.bag': 'Plastic bag',
    'co2.item.tape': 'Gray tape',
    'co2.item.cover': 'Flight-plan cover',
    'co2.item.sock': 'Sock',
    'co2.step.1': 'Start with one square cartridge, inlet side up.',
    'co2.step.2': 'Bend something stiff into an arch over the inlet, so the bag cannot collapse onto it.',
    'co2.step.3': 'Wrap it all in something airtight, so air can only leave through the cartridge.',
    'co2.step.4': 'Give the suit loop a way in: push its air hose into the bag.',
    'co2.step.5': 'Seal every seam airtight. Tear it down the middle: it goes twice as far.',
    'co2.step.6': 'Pad the joint where the hose goes in, so the seal holds and the bag does not tear.',
    'co2.hint.1': 'Everything is built around the cartridge.',
    'co2.hint.2': 'Without an arch over the inlet, the bag is sucked onto it and blocks the air.',
    'co2.hint.3': 'The air needs a closed path: wrap it first, then bring the hose in.',
    'co2.hint.4': 'The hose goes into the bag before you seal it.',
    'co2.hint.5': 'Nothing holds until the seams are taped airtight.',
    'co2.hint.6': 'Last of all, pad the hose joint.',
    // ----- ep3.storm -----
    'storm.title': 'Storm shelter',
    'storm.goal': 'Keep all four crew under 250 mSv (Orion’s goal is 150) before the protons peak.',
    'storm.lede': 'Behind the Moon, a huge solar flare. Fast protons are coming. The only shield you have is mass: water, food, clothes, anything you can pile between the crew and space. The floor bay over the heat shield is the best-protected place. It has four berths, and one is next to the thin hatch wall.',
    'storm.controls': 'Pick a bag type, then press “Add bag” on a berth. Each bag takes a moment to float over.|Pick a crew member, then a berth, to put them there. Press a bag in a stack to take it back.|Seal the shelter when you are ready. When time runs out, it seals as it is.',
    'storm.win': 'Everyone sheltered',
    'storm.lose': 'Too much dose',
    'storm.real': 'In August 1972, between Apollo 16 and 17, one of the biggest solar storms on record swept the space between Earth and the Moon. Estimates say a crew inside an Apollo-type capsule could have taken about 0.35 to 1.8 sieverts. Orion was designed for this: the crew moves into the middle of the cabin over the heat shield and builds a wall of stowage and water bags. The design goal is under 150 mSv for an event like 1972, and measurements on Artemis I showed the shelter can do it. NASA’s 30-day limit for blood-forming organs is 250.',
    'storm.where.b1': 'Middle of the floor bay, over the heat shield',
    'storm.where.b2': 'Floor bay, under the front seats',
    'storm.where.b3': 'Floor bay, by the lockers',
    'storm.where.b4': 'Next to the side hatch: the thinnest wall',
    // ----- ep4.burn -----
    'burn.title': 'Fourteen seconds',
    'burn.goal': 'Hold the Earth’s terminator on the sight’s line while the engine fires; shut down by hand near 14 seconds.',
    'burn.lede': 'The guidance computer is off, and the path home is too shallow: you would skim the atmosphere and skip back into space. One short burn fixes it, flown by eye the way Apollo 13 did: keep the line between day and night on Earth on the mark in the window.',
    'burn.controls': 'Up and down arrows (or W and S): move the Earth up or down. Left and right (A and D): turn it.|Or drag on the view, or hold the round buttons.|Space or the big button: ignite, then shut down. Keep the rates under 10°/s or the burn rule stops you.',
    'burn.win': 'In the corridor',
    'burn.lose': 'Off the corridor',
    'burn.real': 'With the computer powered down, Apollo 13’s crew flew a course correction by hand at 105 hours 30 minutes into the flight. Lovell held the attitude by keeping the Earth’s terminator on the line of the alignment sight in the window, the lit half on top. Houston told them to shut the engine down by hand at 14 seconds, and a rule said to stop if the rates went over 10° per second. It worked: they came home inside the corridor.',
    // ----- ep4.entry -----
    'entry.title': 'Blackout',
    'entry.goal': 'Keep the entry angle between 5.5° and 7.5° through the heat, then wait out the blackout.',
    'entry.lede': 'You hit the atmosphere at 11 kilometres a second with a damaged heat shield. Too shallow and the capsule skips back out into space. Too steep and the heat and the g-load climb. Then the plasma cuts the radio, and all you can do is wait.',
    'entry.controls': 'Up arrow or W: roll the lift up, the path gets shallower. Down arrow or S: steeper.|Or hold the buttons, or drag up and down on the view.|Watch the heat shield and the skip-out risk. After the heat pulse there is nothing left to do but wait.',
    'entry.win': 'Home',
    'entry.lose': 'A hard way home',
    'entry.real': 'Apollo capsules came home at about 11 km/s and had to hit a narrow band of entry angles. Apollo 13’s radio blackout lasted about six minutes, 87 seconds longer than predicted; Mission Control waited in silence until the crew answered. On the uncrewed Artemis I flight in 2022, Orion’s heat shield lost charred material in more than 100 places during its skip entry; NASA flew Artemis II on a more direct entry.',
  };
  const T = (k, e, p) => t('sv.' + k, EN[k] || e || k, p);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  const num = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '–');

  const CREW = ['you', 'yusuf', 'lena', 'grace'];
  const SEGMENTS = ['ep2.power', 'ep2.co2', 'ep3.storm', 'ep4.burn', 'ep4.entry'];
  const KEY = { 'ep2.power': 'power', 'ep2.co2': 'co2', 'ep3.storm': 'storm', 'ep4.burn': 'burn', 'ep4.entry': 'entry' };
  const EP = { power: 2, co2: 2, storm: 3, burn: 4, entry: 4 };

  function data() {
    const d = SMD.storySurvivalData;
    if (!d) throw new Error('survival: content/story/survival.js is not loaded');
    return d;
  }
  function youName() {
    try {
      const a = SMD.avatar && SMD.avatar.get();
      if (a && a.name) return a.name;
    } catch (e) {}
    return T('cast.you', 'Commander');
  }
  const CAST_EN = { yusuf: 'Yusuf', lena: 'Lena', grace: 'Grace', nadia: 'Nadia', kwame: 'Kwame', mariam: 'Mariam', omar: 'Omar' };
  const castName = (id) => (id === 'you' ? youName() : T('cast.' + id, CAST_EN[id] || id));

  // ---------- Story state ----------
  function ensure(state) {
    state = state || {};
    state.res = Object.assign({ o2: 100, power: 100, water: 100, co2: 0, food: 100 }, state.res || {});
    state.health = Object.assign({ you: 100, yusuf: 100, lena: 100, grace: 100 }, state.health || {});
    state.flags = state.flags || {};
    return state;
  }
  function hurt(state, id, n) {
    state.health[id] = clamp(Math.round((state.health[id] == null ? 100 : state.health[id]) - n), 0, 100);
  }
  const hurtAll = (state, n) => CREW.forEach((id) => hurt(state, id, n));
  // Spend the lifeboat battery up to a trip hour (ep2.power set the draw):
  // the far-side storm is about hour 30, the manual burn hour 60, home hour 77.
  function drainTo(state, hour) {
    const f = state.flags;
    if (!Number.isFinite(f.powerAmps) || !Number.isFinite(f.powerHour) || hour <= f.powerHour) return;
    const cfg = data().power;
    const ah = f.powerAmps * (hour - f.powerHour);
    state.res.power = Math.max(0, state.res.power - Math.round(((cfg.fullAt || 100) * ah) / cfg.capacityAh));
    f.powerHour = hour;
  }

  // =====================================================================
  // Models (pure)
  // =====================================================================

  // ---------- ep2.power ----------
  const power = {
    defaults(cfg) {
      const sel = {};
      cfg.systems.forEach((s) => (sel[s.id] = s.states ? s.states[0] : 'on'));
      return sel;
    },
    tune(cfg, state) {
      const f = (state && state.flags) || {};
      if (!f.hiresCamera) return cfg;
      // Mariam's high-resolution camera (ep1) pulls more than the standard one.
      return Object.assign({}, cfg, { systems: cfg.systems.map((x) => (x.id === 'camera' ? Object.assign({}, x, { amps: [5, 0] }) : x)) });
    },
    ampsOf(sys, st) {
      if (!sys.states) return sys.amps[0];
      const i = Math.max(0, sys.states.indexOf(st));
      return sys.amps[i];
    },
    amps(cfg, sel) {
      return r1(cfg.systems.reduce((a, s) => a + power.ampsOf(s, sel[s.id]), 0));
    },
    // Battery (Ah) available now from the story's res.power: the lifeboat
    // battery is full at cfg.fullAt (what is left after the tank rupture).
    battery(cfg, resPower) {
      const full = cfg.fullAt || 100;
      return cfg.capacityAh * clamp((resPower == null ? full : resPower) / full, 0, 1.1);
    },
    // res.power for a battery holding ah amp-hours (same scale as battery()).
    level(cfg, ah) {
      return clamp(Math.round(((cfg.fullAt || 100) * Math.max(0, ah)) / cfg.capacityAh), 0, 100);
    },
    // How long the battery lasts at this draw, keeping the entry reserve.
    hours(cfg, ahNow, amps) {
      return Math.max(0, ahNow - cfg.reserveAh) / Math.max(0.1, amps);
    },
    morale(sel) {
      let m = 100;
      m -= { on: 0, low: 12, off: 30 }[sel.heaters] || 0;
      m -= { on: 0, low: 4, off: 12 }[sel.lights] || 0;
      m -= { on: 0, low: 6, off: 18 }[sel.comms] || 0;
      m -= sel.water === 'off' ? 8 : 0;
      m -= sel.displays === 'low' ? 2 : 0;
      return clamp(m, 0, 100);
    },
    outcome(cfg, resPower, sel, spentAh) {
      const amps = power.amps(cfg, sel);
      const ahNow = power.battery(cfg, resPower) - (spentAh || 0);
      const hours = power.hours(cfg, ahNow, amps);
      const need = cfg.hoursHome * cfg.margin;
      const atHome = ahNow - amps * cfg.hoursHome;
      return {
        sel: Object.assign({}, sel),
        amps,
        spentAh: Math.round(spentAh || 0),
        ahNow: Math.round(ahNow),
        hours: r1(hours),
        hoursHome: cfg.hoursHome,
        win: hours >= need,
        atHomeAh: Math.round(atHome),
        cabinC: cfg.cabinC[sel.heaters] != null ? cfg.cabinC[sel.heaters] : cfg.cabinC.on,
        morale: power.morale(sel),
      };
    },
  };

  // ---------- ep2.co2 ----------
  const co2 = {
    start(cfg, state) {
      const f = (state && state.flags) || {};
      const fromRes = state && state.res && state.res.co2 ? state.res.co2 / 5 : 0;
      let v = clamp(Math.max(f.fansLow ? cfg.startFansLow : cfg.start, fromRes), cfg.start, cfg.danger - 3);
      // Lena's spare cartridges (ep1) bought a day; a late trip to fetch them cost time.
      if (f.spareCartridges) v -= 1.5;
      if (f.fetchedLate) v += 0.5;
      return r1(Math.max(5.5, v));
    },
    // Grace leading the build (ep2) reads every step back: mistakes cost less.
    penalty(cfg, state) {
      return cfg.wrongPenalty * (state && state.flags && state.flags.graceBuilt ? 0.5 : 1);
    },
    // Step check: returns { ok, next } for picking item at step index i.
    pick(cfg, i, item) {
      return { ok: cfg.steps[i] === item, next: cfg.steps[i] === item ? i + 1 : i };
    },
  };

  // ---------- ep3.storm ----------
  const storm = {
    // The story's choices: a head start, and Mariam's plan to wall off the
    // hatch berth with the food lockers (flags.doseShared).
    tune(cfg, state) {
      const f = (state && state.flags) || {};
      const c = Object.assign({}, cfg);
      if (f.headStart) c.warnSeconds = cfg.warnSeconds + 20;
      if (f.doseShared) c.berths = cfg.berths.map((b) => (b.id === 'b4' ? Object.assign({}, b, { shield: b.shield + 6 }) : b));
      return c;
    },
    // Who the story put at the hatch end (ep3 choice), if anyone.
    edge(state) {
      const f = (state && state.flags) || {};
      return f.doseLena === true ? 'lena' : f.doseYusuf === true ? 'yusuf' : f.doseGrace === true ? 'grace' : null;
    },
    dose(cfg, shield) {
      return cfg.doseRef * Math.exp(-(shield - cfg.refShield) / cfg.lambda);
    },
    shield(cfg, berthId, bags) {
      const b = cfg.berths.find((x) => x.id === berthId);
      if (!b) return cfg.refShield;
      return b.shield + (bags || []).reduce((a, k) => a + cfg.bags[k].gcm2, 0);
    },
    // layout: { b1: ['water', 'stow'], ... }; crewAt: { you: 'b4', ... } (null: not in the shelter)
    outcome(cfg, layout, crewAt) {
      const doses = {};
      CREW.forEach((id) => {
        const b = crewAt[id];
        doses[id] = Math.round(b ? storm.dose(cfg, storm.shield(cfg, b, layout[b])) : cfg.doseRef);
      });
      const max = Math.max(...CREW.map((id) => doses[id]));
      const taker = CREW.reduce((a, id) => (doses[id] > doses[a] ? id : a), CREW[0]);
      return { layout: JSON.parse(JSON.stringify(layout)), crewAt: Object.assign({}, crewAt), doses, max, taker, win: max <= cfg.limit, good: max <= cfg.goal };
    },
  };

  // ---------- ep4.burn ----------
  const burn = {
    // Who flies (ep4 choice): tired hands drift more, a fever adds a tremor,
    // two pilots sharing the axes drift less. A rough earlier burn left the
    // path shallower.
    tune(cfg, state) {
      const f = (state && state.flags) || {};
      const c = Object.assign({ drift: 1, jitter: 0 }, cfg);
      if (f.youFlew && f.youTired) c.drift = 1.35;
      if (f.yusufFlew && f.yusufFever) c.jitter = 1.4;
      if (f.flewTogether) c.drift *= 0.8;
      if (f.roughAim) c.gammaShift = -0.4;
      return c;
    },
    create(cfg, seed = 1) {
      return { phase: 'arm', t: 0, armLeft: cfg.armSeconds, pitch: 0.6, roll: -1.2, pr: 0, rr: 0, burnT: 0, gamma: cfg.gamma0 + (cfg.gammaShift || 0), offsetKm: 0, abort: false, maxRate: 0, seed, tq: { p: 0.2, r: -0.15 }, tqT: 0 };
    },
    rand(s) {
      s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
      return s.seed / 4294967296;
    },
    // input: { pitch: -1..1, roll: -1..1 } (pitch +: the picture moves up)
    step(cfg, s, input, dt) {
      if (s.phase === 'done') return s;
      s.t += dt;
      s.tqT -= dt;
      if (s.tqT <= 0) {
        s.tqT = 2.5;
        const k = s.phase === 'burn' ? 1 : 0.35;
        const m = cfg.drift || 1;
        s.tq.p = ((burn.rand(s) - 0.35) * 1.3 * k + (s.phase === 'burn' ? 0.55 : 0)) * m;
        s.tq.r = ((burn.rand(s) - 0.6) * 1.1 * k - (s.phase === 'burn' ? 0.35 : 0)) * m;
      }
      if (cfg.jitter) {
        s.pr += (burn.rand(s) - 0.5) * cfg.jitter * 20 * dt;
        s.rr += (burn.rand(s) - 0.5) * cfg.jitter * 20 * dt;
      }
      const auth = 2.4; // °/s² from the hand controller
      // With the terminator tilted you cannot judge up from down as well.
      const judge = Math.max(0.3, Math.cos((s.roll * 2 * Math.PI) / 180));
      s.pr += (s.tq.p + auth * judge * clamp(input.pitch || 0, -1, 1)) * dt;
      s.rr += (s.tq.r + auth * clamp(input.roll || 0, -1, 1)) * dt;
      // Crews damp rates by instinct; a little damping keeps it fair.
      s.pr *= Math.exp(-0.12 * dt);
      s.rr *= Math.exp(-0.12 * dt);
      s.pitch = clamp(s.pitch + s.pr * dt, -30, 30);
      s.roll = clamp(s.roll + s.rr * dt, -45, 45);
      s.maxRate = Math.max(s.maxRate, Math.abs(s.pr), Math.abs(s.rr));
      if (s.phase === 'arm') {
        s.armLeft -= dt;
        if (s.armLeft <= 0) burn.ignite(cfg, s);
      } else if (s.phase === 'burn') {
        s.burnT += dt;
        const gain = (cfg.gammaTarget - cfg.gamma0) / cfg.burnSeconds;
        const p = (s.pitch * Math.PI) / 180;
        // Off-line pitch both wastes thrust and tips it: too high a picture
        // means the nose points low, the push goes shallow.
        s.gamma += (gain * Math.cos(p) - gain * 3 * Math.sin(p)) * dt;
        s.offsetKm += Math.abs(s.roll) * 0.9 * dt;
        if (Math.abs(s.pr) > cfg.rateLimit || Math.abs(s.rr) > cfg.rateLimit) {
          s.abort = true;
          burn.cut(cfg, s);
        } else if (s.burnT >= cfg.maxBurn) burn.cut(cfg, s);
      }
      return s;
    },
    ignite(cfg, s) {
      if (s.phase !== 'arm') return;
      s.phase = 'burn';
      s.tqT = 0;
    },
    cut(cfg, s) {
      if (s.phase !== 'burn') return;
      s.phase = 'done';
    },
    outcome(cfg, s) {
      const g = r2(s.gamma);
      const ok = !s.abort && g >= cfg.corridor[0] && g <= cfg.corridor[1];
      return { gamma: g, burnT: r1(s.burnT), abort: !!s.abort, offsetKm: Math.round(s.offsetKm), win: ok, corridorOk: ok, maxRate: r1(s.maxRate) };
    },
    // The entry angle a burn of `sec` seconds with `pitchDeg` average error gives.
    predict(cfg, sec, pitchDeg = 0) {
      const gain = (cfg.gammaTarget - cfg.gamma0) / cfg.burnSeconds;
      const p = (pitchDeg * Math.PI) / 180;
      return cfg.gamma0 + (gain * Math.cos(p) - gain * 3 * Math.sin(p)) * sec;
    },
  };

  // ---------- ep4.entry ----------
  const entry = {
    // The entry profile chosen in ep4: direct is short and hard (more g, less
    // heat soak), skip is gentler on the crew and harder on the shield (the
    // Artemis I lesson); rolling the damaged edge out of the heat helps.
    tune(cfg, state) {
      const f = (state && state.flags) || {};
      const c = Object.assign({ gAdd: 0, heatMul: 1, dmgMul: 1.3, bias: 0.16 }, cfg);
      if (f.directEntry) Object.assign(c, { controlSeconds: cfg.controlSeconds - 6, gAdd: 0.7, heatMul: 0.95 });
      if (f.skipEntry) Object.assign(c, { controlSeconds: cfg.controlSeconds + 8, gAdd: -1, heatMul: 1.2 });
      if (f.protectEdge) Object.assign(c, { dmgMul: 1.1, bias: 0.08 });
      return c;
    },
    create(cfg, state, seed = 3) {
      const f = (state && state.flags) || {};
      const g0 = Number.isFinite(f.entryAngle) ? f.entryAngle : cfg.gamma0;
      // The story's heat shield is damaged (ep3) unless a script says otherwise.
      const damaged = f.shieldDamaged !== false;
      return { phase: 'control', t: 0, gamma: clamp(g0, 4, 9.5), shield: damaged ? cfg.shieldDamaged : cfg.shieldStart, damaged, skip: 0, g: 0, peakG: 0, gDose: 0, seed, drift: 0, burned: false, skipped: false };
    },
    bell(cfg, t) {
      const u = clamp(t / cfg.controlSeconds);
      return Math.pow(Math.sin(Math.PI * u), 1.5);
    },
    // input: lift -1..1 (+1: roll the lift up, the path gets shallower)
    step(cfg, s, lift, dt) {
      if (s.phase !== 'control') return s;
      s.t += dt;
      const u = clamp(s.t / cfg.controlSeconds);
      const bell = entry.bell(cfg, s.t);
      s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
      s.drift += ((s.seed / 4294967296 - 0.5) * 0.9 - s.drift * 0.4) * dt;
      // The damaged shield's uneven char tips the capsule steeper in waves.
      const push = 0.32 * Math.sin(s.t * 0.47 + 0.6) + 0.18 * Math.sin(s.t * 1.21) + (s.damaged ? (cfg.bias != null ? cfg.bias : 0.16) : 0.05) + s.drift;
      s.gamma = clamp(s.gamma + (push * (0.4 + bell) - 0.95 * clamp(lift || 0, -1, 1)) * dt, 3, 11);
      const steep = Math.max(0, s.gamma - cfg.corridor[1]);
      const shallow = Math.max(0, cfg.corridor[0] - s.gamma);
      s.g = Math.min(12, 0.3 + bell * Math.max(1.5, 3.2 + (cfg.gAdd || 0) + 1.9 * Math.max(0, s.gamma - 5)));
      s.peakG = Math.max(s.peakG, s.g);
      if (s.g > 8) s.gDose += (s.g - 8) * dt;
      // Heat: steep is a hot spike; shallow is a long soak (the Artemis I lesson).
      s.shield -= 1.15 * (cfg.heatMul || 1) * bell * (1 + 2.2 * steep + 0.7 * shallow) * (s.damaged ? cfg.dmgMul || 1.3 : 1) * dt;
      if (shallow > 0) s.skip += shallow * 20 * (1 - u * 0.7) * dt;
      else s.skip = Math.max(0, s.skip - 6 * dt);
      if (s.shield <= 0) {
        s.shield = 0;
        s.burned = true;
        s.phase = 'done';
      } else if (s.skip >= 100) {
        s.skip = 100;
        s.skipped = true;
        s.phase = 'done';
      } else if (s.t >= cfg.controlSeconds) s.phase = 'silence';
      return s;
    },
    outcome(cfg, s) {
      return { skipped: !!s.skipped, burned: !!s.burned, peakG: r1(s.peakG), gDose: r1(s.gDose), shield: Math.round(s.shield), gamma: r2(s.gamma), win: !s.skipped && !s.burned };
    },
  };

  // =====================================================================
  // Applying an outcome to the story state (the same for play and quick)
  // =====================================================================
  const APPLY = {
    power(state, o, cfg) {
      const f = state.flags;
      const s = o.sel;
      f.heatersOff = s.heaters === 'off' || !o.win;
      f.heatersLow = s.heaters === 'low';
      f.coldCabin = s.heaters !== 'on' || !o.win;
      f.commsOff = s.comms === 'off';
      f.commsLow = s.comms === 'low';
      f.guidanceOff = s.guidance === 'off';
      f.fansLow = s.fans === 'low';
      f.windowHeatersOff = s.windows === 'off';
      f.lightsOff = s.lights === 'off' || !o.win;
      f.hotWaterOff = s.water === 'off';
      f.powerShort = !o.win;
      f.powerAmps = o.amps;
      f.powerMarginH = r1(o.hours - o.hoursHome);
      f.cabinC = o.win ? o.cabinC : Math.min(o.cabinC, cfg.cabinC.off);
      f.morale = o.win ? o.morale : Math.min(o.morale, 40);
      // The gauge shows the battery now; later segments drain it at this draw
      // along the trip (drainTo), so it reaches home at the projected margin.
      // Short of power, the crew is forced into a deeper power-down later
      // that just gets them home with almost nothing left.
      state.res.power = power.level(cfg, o.ahNow);
      f.powerAmps = o.win ? o.amps : Math.min(o.amps, r1(Math.max(0, o.ahNow - 60) / cfg.hoursHome));
      f.powerHour = 0;
      if (f.cabinC <= 5) hurtAll(state, 4);
      else if (f.cabinC <= 12) hurtAll(state, 1);
      return { result: o.win ? 'win' : 'lose' };
    },
    co2(state, o, cfg) {
      const f = state.flags;
      f.adapterBuilt = !!o.built;
      f.co2Peak = r1(o.peak);
      f.co2Headaches = o.peak >= cfg.danger;
      f.co2Mistakes = o.wrong || 0;
      state.res.co2 = clamp(Math.round((o.built ? o.final : o.peak) * 5), 0, 100);
      if (o.peak >= cfg.danger) hurtAll(state, Math.round((o.peak - cfg.danger) * 3) + 3);
      if (!o.built) hurtAll(state, 10);
      return { result: o.built ? 'win' : 'lose' };
    },
    storm(state, o, cfg) {
      const f = state.flags;
      CREW.forEach((id) => {
        f['mSv' + id[0].toUpperCase() + id.slice(1)] = o.doses[id];
        hurt(state, id, o.doses[id] * cfg.healthPerMSv);
      });
      f.doseMax = o.max;
      f.doseTaker = o.taker;
      f.youTookWorst = o.taker === 'you' && o.doses.you > Math.min(...CREW.map((id) => o.doses[id])) + 5;
      f.shelterGood = !!o.good;
      f.shelterCrew = Object.keys(o.crewAt).filter((id) => o.crewAt[id]).length;
      drainTo(state, 30);
      return { result: o.win ? 'win' : 'lose' };
    },
    burn(state, o) {
      const f = state.flags;
      f.corridorOk = !!o.corridorOk;
      f.entryAngle = o.gamma;
      f.burnSeconds = o.burnT;
      f.burnAbort = !!o.abort;
      f.splashOffsetKm = o.offsetKm;
      drainTo(state, 60);
      return { result: o.win ? 'win' : 'lose' };
    },
    entry(state, o, cfg) {
      const f = state.flags;
      f.landed = !o.skipped;
      f.skipped = !!o.skipped;
      f.shieldBurn = !!o.burned;
      f.peakG = o.peakG;
      f.blackoutS = cfg.blackoutActual;
      f.shieldLeft = o.shield;
      drainTo(state, data().power.hoursHome);
      let n = 2 + Math.max(0, o.peakG - 6) * 4 + o.gDose * 5;
      if (o.shield < 25) n += 8;
      if (o.burned) n += 25;
      if (o.skipped) n += 30;
      // Hurt, never killed by the numbers alone: the story tells the rest.
      hurtAll(state, Math.min(n, 55));
      return { result: o.win ? 'win' : 'lose' };
    },
  };

  // Representative outcomes for quick(): 'good' is a solid, by-the-book run
  // (what "Skip (auto)" gives), 'bad' a run that fails for the usual reason.
  const QUICK = {
    power(cfg, state, good) {
      const sel = power.defaults(cfg);
      if (good) Object.assign(sel, { heaters: 'low', comms: 'low', guidance: 'off', displays: 'low', lights: 'low', water: 'off', windows: 'off', radar: 'off', camera: 'off' });
      else Object.assign(sel, { radar: 'off', camera: 'off' });
      return power.outcome(cfg, state.res.power, sel, good ? 45 : 150);
    },
    co2(cfg, state, good) {
      return good ? { built: true, peak: Math.max(co2.start(cfg, state), 11.2), final: 0.8, wrong: 1 } : { built: false, peak: cfg.fail, final: cfg.fail, wrong: 3 };
    },
    storm(cfg, state, good) {
      if (good) {
        const edge = storm.edge(state) || 'you';
        const others = CREW.filter((id) => id !== edge);
        const at = { [edge]: 'b4', [others[0]]: 'b1', [others[1]]: 'b2', [others[2]]: 'b3' };
        return storm.outcome(cfg, { b1: ['stow', 'stow', 'stow'], b2: ['water', 'water'], b3: ['water', 'water', 'stow', 'stow'], b4: ['water', 'water', 'water', 'stow'] }, at);
      }
      return storm.outcome(cfg, { b1: ['water', 'water'], b2: ['water'], b3: [], b4: [] }, { you: 'b1', yusuf: 'b2', lena: 'b3', grace: null });
    },
    burn(cfg, state, good) {
      return good ? { gamma: 6.4, burnT: 14.1, abort: false, offsetKm: 6, win: true, corridorOk: true, maxRate: 3.1 } : { gamma: 5.02, burnT: 9.2, abort: false, offsetKm: 22, win: false, corridorOk: false, maxRate: 6.8 };
    },
    entry(cfg, state, good) {
      return good ? { skipped: false, burned: false, peakG: r1(6.2 + (cfg.gAdd || 0)), gDose: 0, shield: state.flags.shieldDamaged !== false ? 36 : 66, gamma: 6.5, win: true } : { skipped: false, burned: true, peakG: 8.6, gDose: 1.4, shield: 0, gamma: 8.4, win: false };
    },
  };

  // The segment's numbers, tuned by what the story did before it.
  function cfgFor(k, state) {
    const base = data()[k];
    const m = { power, storm, burn, entry }[k];
    return m && m.tune ? m.tune(base, state) : base;
  }

  function quick(segmentId, state, how) {
    const k = KEY[segmentId];
    if (!k) throw new Error('survival: unknown segment ' + segmentId);
    ensure(state);
    const cfg = cfgFor(k, state);
    const o = QUICK[k](cfg, state, how !== 'bad');
    const r = APPLY[k](state, o, cfg);
    return { result: r.result, state, outcome: o };
  }

  // =====================================================================
  // UI (browser only)
  // =====================================================================
  const reducedMotion = () => {
    try {
      return matchMedia('(prefers-reduced-motion: reduce)').matches || !!(SMD.settings && SMD.settings.reducedMotion);
    } catch (e) {
      return false;
    }
  };
  const mmss = (s) => {
    s = Math.max(0, Math.ceil(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const ltr = (s) => (SMD.dir && SMD.dir() === 'rtl' ? `⁦${s}⁩` : s);
  const unit = (x, u, d = 0) => ltr(`${num(x, d)} ${u}`);
  const GROUND = { nadia: 1, kwame: 1, mariam: 1, omar: 1 };
  const ICON = {
    check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1" fill="currentColor"/><path d="M5 7V5a3 3 0 016 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    up: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3l5 7H3z" fill="currentColor"/></svg>',
    down: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13l5-7H3z" fill="currentColor"/></svg>',
    ccw: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8a4 4 0 107.5-2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M11 2v4H7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    cw: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12 8a4 4 0 11-7.5-2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 2v4h4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  };
  const ITEM_SVG = {
    cartridge: '<rect x="5" y="7" width="14" height="13" rx="1.5" fill="#8f989e"/><rect x="7" y="4" width="10" height="3" fill="#545d66"/>',
    hose: '<path d="M4 18c4-10 12-10 16-4" fill="none" stroke="#e06a5f" stroke-width="3.2" stroke-linecap="round"/>',
    bag: '<path d="M5 7h14l-1 13H6z" fill="#dfe8ee" opacity=".85"/><path d="M8 7c0-3 8-3 8 0" fill="none" stroke="#a9b6c2" stroke-width="1.5"/>',
    tape: '<circle cx="12" cy="12" r="7.5" fill="#8a8f93"/><circle cx="12" cy="12" r="3.2" fill="#172431"/>',
    cover: '<path d="M5 18c0-9 14-9 14 0" fill="none" stroke="#5aa0e0" stroke-width="3"/><rect x="5" y="17" width="14" height="2" fill="#5aa0e0"/>',
    sock: '<path d="M9 3h6v9l4 4-3 4-7-6z" fill="#f2f0ea"/>',
  };
  const itemIcon = (id) => `<svg class="sv-ico" viewBox="0 0 24 24" aria-hidden="true">${ITEM_SVG[id] || ''}</svg>`;

  function makeCtx(host, k, state, cfg) {
    const root = document.createElement('section');
    root.className = `sv sv-${k}`;
    root.setAttribute('dir', SMD.dir ? SMD.dir() : 'ltr');
    root.setAttribute('aria-label', T(k + '.title', k));
    host.appendChild(root);
    const timers = [];
    const offs = [];
    const keys = new Set();
    let raf = 0;
    let engineSnd = null;
    const ctx = {
      k,
      state,
      cfg,
      root,
      reduced: reducedMotion(),
      three: null,
      stopped: false,
      keys,
      speed: () => (SMD.storySurvival && SMD.storySurvival.timeScale) || 1,
      $: (sel) => root.querySelector(sel),
      $$: (sel) => [...root.querySelectorAll(sel)],
      on(el, ev, fn, opt) {
        if (!el) return;
        el.addEventListener(ev, fn, opt);
        offs.push(() => el.removeEventListener(ev, fn, opt));
      },
      after(sec, fn) {
        const id = setTimeout(() => !ctx.stopped && fn(), (sec * 1000) / ctx.speed());
        timers.push(id);
        return id;
      },
      loop(fn) {
        let last = performance.now();
        const tick = (now) => {
          if (ctx.stopped) return;
          const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)) * ctx.speed();
          last = now;
          if (fn(dt) === false) return;
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      radio(who, text) {
        const el = ctx.$('[data-radio]');
        if (!el) return;
        const label = who ? (GROUND[who] ? T('radio.ground', '{name} · Houston', { name: castName(who) }) : castName(who)) : '';
        el.innerHTML = `${label ? `<b>${esc(label)}</b> ` : ''}<span>${esc(fill(text, { you: youName() }))}</span>`;
        el.classList.remove('sv-radio-new');
        void el.offsetWidth;
        el.classList.add('sv-radio-new');
        if (who && GROUND[who]) ctx.sfx('beep', 1320, 0.05, 'sine', 0.06);
      },
      clock(text, tone) {
        const el = ctx.$('[data-clock]');
        if (!el) return;
        if (el.textContent !== text) el.textContent = text;
        el.dataset.tone = tone || '';
      },
      sfx(name, ...a) {
        try {
          if (SMD.audio && SMD.audio[name]) return SMD.audio[name](...a);
        } catch (e) {}
        return null;
      },
      engine(level, bright) {
        try {
          if (!engineSnd && level > 0 && SMD.audio && SMD.audio.engine) engineSnd = SMD.audio.engine();
          if (engineSnd) engineSnd.set(Math.max(0, level), bright == null ? 0.5 : bright);
          if (engineSnd && level <= 0) {
            engineSnd.stop();
            engineSnd = null;
          }
        } catch (e) {}
      },
      // Keyboard state for the flying segments (ignored while typing).
      captureKeys() {
        const typing = (e) => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
        const GAME = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
        ctx.on(window, 'keydown', (e) => {
          if (typing(e) || ctx.root.classList.contains('sv-has-card')) return;
          if (GAME.has(e.code) && !(e.code === 'Space' && e.target && e.target.tagName === 'BUTTON')) e.preventDefault();
          if (!e.repeat && ctx.onKey) ctx.onKey(e);
          keys.add(e.code);
        });
        ctx.on(window, 'keyup', (e) => keys.delete(e.code));
        ctx.on(window, 'blur', () => keys.clear());
      },
      // Buttons that act like held keys (touch and mouse).
      bindHold(scope) {
        (scope || root).querySelectorAll('[data-hold]').forEach((b) => {
          const code = b.dataset.hold;
          const on = (e) => {
            e.preventDefault();
            keys.add(code);
            b.classList.add('is-held');
          };
          const off = () => {
            keys.delete(code);
            b.classList.remove('is-held');
          };
          ctx.on(b, 'pointerdown', on);
          ctx.on(b, 'pointerup', off);
          ctx.on(b, 'pointerleave', off);
          ctx.on(b, 'pointercancel', off);
          ctx.on(b, 'contextmenu', (e) => e.preventDefault());
        });
      },
      axis(neg, pos) {
        const d = (codes) => codes.some((c) => keys.has(c));
        return (d(pos) ? 1 : 0) - (d(neg) ? 1 : 0);
      },
      stop() {
        ctx.stopped = true;
        timers.forEach(clearTimeout);
        offs.forEach((f) => f());
        cancelAnimationFrame(raf);
        ctx.engine(0);
        keys.clear();
      },
    };
    root.innerHTML = `
      <div class="sv-stage" data-stage></div>
      <div class="sv-fx" data-fx aria-hidden="true"></div>
      <header class="sv-top">
        <div class="sv-head">
          <p class="sv-kicker">${esc(T('kicker', 'Survival · Episode {n}', { n: EP[k] }))}</p>
          <h2 class="sv-title" tabindex="-1">${esc(T(k + '.title', k))}</h2>
        </div>
        <p class="sv-goal"><b>${esc(T('goal', 'Goal'))}</b> <span>${esc(T(k + '.goal', ''))}</span></p>
        <p class="sv-clock" data-clock></p>
        <button type="button" class="btn ghost small sv-skip" data-skip>${esc(T('skip', 'Skip (auto)'))}</button>
      </header>
      <div class="sv-body" data-body></div>
      <p class="sv-radio" data-radio aria-live="polite"></p>
      <div class="sv-card-wrap" data-card hidden></div>`;
    return ctx;
  }

  function showCard(ctx, html, onButton) {
    const wrap = ctx.$('[data-card]');
    wrap.innerHTML = `<div class="sv-card" role="dialog" aria-modal="true" aria-labelledby="sv-card-h">${html}</div>`;
    wrap.hidden = false;
    ctx.root.classList.add('sv-has-card');
    wrap.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => onButton(b.dataset.act)));
    const first = wrap.querySelector('.btn.primary') || wrap.querySelector('button');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  }
  function hideCard(ctx) {
    const wrap = ctx.$('[data-card]');
    wrap.hidden = true;
    wrap.innerHTML = '';
    ctx.root.classList.remove('sv-has-card');
  }

  function introCard(ctx) {
    const k = ctx.k;
    const ctrls = T(k + '.controls', '').split('|').filter(Boolean);
    return `<p class="sv-card-kicker">${esc(T('kicker', 'Survival · Episode {n}', { n: EP[k] }))}</p>
      <h2 id="sv-card-h">${esc(T(k + '.title', k))}</h2>
      <p class="sv-card-lede">${esc(fill(T(k + '.lede', ''), { you: youName() }))}</p>
      <p class="sv-card-goal"><b>${esc(T('goal', 'Goal'))}</b> ${esc(T(k + '.goal', ''))}</p>
      ${ctrls.length ? `<h3>${esc(T('howto', 'How to play'))}</h3><ul class="sv-card-list">${ctrls.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      <div class="sv-card-actions">
        <button type="button" class="btn primary" data-act="start">${esc(T('start', 'Start'))}</button>
        <button type="button" class="btn ghost" data-act="skip">${esc(T('skip', 'Skip (auto)'))}</button>
      </div>`;
  }

  function endCard(ctx, result, lines, why, skipped) {
    const k = ctx.k;
    const srcs = (ctx.cfg.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('');
    return `<p class="sv-card-kicker">${esc(skipped ? T('end.skipped', 'Skipped: the crew followed the ground team’s plan') : T('kicker', 'Survival · Episode {n}', { n: EP[k] }))}</p>
      <h2 id="sv-card-h" class="sv-result-${result}">${esc(result === 'win' ? T(k + '.win', 'Made it') : T(k + '.lose', 'It went wrong'))}</h2>
      <ul class="sv-card-stats">${lines.map((l) => `<li><span>${esc(l[0])}</span><b>${esc(l[1])}</b></li>`).join('')}</ul>
      ${why ? `<p class="sv-card-why">${esc(fill(why, { you: youName() }))}</p>` : ''}
      <section class="sv-real">
        <h3>${esc(T('real', 'How real crews did it'))}</h3>
        <p>${esc(T(k + '.real', ''))}</p>
        ${srcs ? `<ul class="sv-src">${srcs}</ul>` : ''}
      </section>
      <div class="sv-card-actions"><button type="button" class="btn primary" data-act="continue">${esc(T('continue', 'Continue'))}</button></div>`;
  }

  // Lines and an explanation for the end card, from an outcome.
  const SUMMARY = {
    power(o, cfg, st) {
      const lines = [
        [T('power.s.amps', 'Power draw'), unit(o.amps, 'A', 1)],
        [T('power.s.lasts', 'Battery lasts'), unit(o.hours, T('u.h', 'h'))],
        [T('power.s.home', 'Time to home'), unit(o.hoursHome, T('u.h', 'h'))],
        [T('power.s.cabin', 'Cabin settles at'), unit(st.flags.cabinC, '°C')],
        [T('power.s.morale', 'Crew morale'), ltr(`${st.flags.morale}%`)],
        [T('power.s.left', 'Battery left at home'), ltr(`${st.res.power}%`)],
      ];
      const why = o.win
        ? o.sel.heaters === 'on'
          ? T('power.why.warm', 'You kept the cabin warm by giving up something else, and the line still reaches home.')
          : T('power.why.cold', 'The battery reaches home. The price is a cold, dim cabin: the crew will feel it for days.')
        : T('power.why.short', 'At {amps} A the battery runs out {n} hours short. The crew has to cut everything later, in the dark and the cold, with less left for the entry.', { amps: num(o.amps, 1), n: num(Math.max(1, cfg.hoursHome * cfg.margin - o.hours), 0) });
      return { lines, why };
    },
    co2(o, cfg) {
      const lines = [
        [T('co2.s.peak', 'Highest CO2'), unit(o.peak, 'mmHg', 1)],
        [T('co2.s.final', 'CO2 now'), unit(o.built ? o.final : o.peak, 'mmHg', 1)],
        [T('co2.s.wrong', 'Wrong steps'), String(o.wrong || 0)],
      ];
      const why = o.built
        ? o.peak >= cfg.danger
          ? T('co2.why.late', 'The adapter works, but the CO2 went past 15 mmHg first: the crew has pounding headaches.')
          : T('co2.why.ok', 'The square cartridge now breathes through the round port. The CO2 falls within minutes.')
        : T('co2.why.fail', 'CO2 reached {n} mmHg before the adapter was sealed. The crew went back on suit oxygen with splitting headaches while Houston talked them through it again.', { n: num(cfg.fail) });
      return { lines, why };
    },
    storm(o, cfg) {
      const lines = CREW.map((id) => [castName(id), `${unit(o.doses[id], 'mSv')}${o.crewAt[id] ? '' : ' · ' + T('storm.s.outside', 'not in the shelter')}`]);
      lines.push([T('storm.s.limit', 'Orion design limit / NASA 30-day limit'), ltr(`${cfg.goal} / ${cfg.limit} mSv`)]);
      const why = o.good
        ? T('storm.why.good', 'Everyone stays under Orion’s 150 mSv design limit. The water bags did most of the work.')
        : o.win
          ? T('storm.why.ok', 'Everyone stays under NASA’s 30-day limit, but {name} took {n} mSv: that spot had too little mass over it.', { name: castName(o.taker), n: num(o.doses[o.taker]) })
          : T('storm.why.bad', '{name} took {n} mSv, over NASA’s 30-day limit of 250. Expect nausea and tiredness in the days ahead. Mass between you and space is what stops protons.', { name: castName(o.taker), n: num(o.doses[o.taker]) });
      return { lines, why };
    },
    burn(o, cfg) {
      const lines = [
        [T('burn.s.time', 'Burn time'), unit(o.burnT, 's', 1)],
        [T('burn.s.gamma', 'Entry angle now'), unit(o.gamma, '°', 2)],
        [T('burn.s.corridor', 'Corridor'), ltr(`${cfg.corridor[0]}° – ${cfg.corridor[1]}°`)],
        [T('burn.s.offset', 'Landing spot moved'), unit(o.offsetKm, 'km')],
      ];
      const why = o.abort
        ? T('burn.why.abort', 'The rates went over 10°/s, so the rule says shut down. The burn stopped early and the path is still too shallow.')
        : o.win
          ? T('burn.why.ok', 'You held the terminator on the line and cut off close to 14 seconds. The capsule is inside the entry corridor.')
          : o.gamma < cfg.corridor[0]
            ? T('burn.why.shallow', 'Too little push: at {g}° the capsule would skim the atmosphere and skip back out.', { g: num(o.gamma, 2) })
            : T('burn.why.steep', 'Too much push: at {g}° the capsule dives in steep, with more heat and g-load.', { g: num(o.gamma, 2) });
      return { lines, why };
    },
    entry(o, cfg) {
      const lines = [
        [T('entry.s.g', 'Peak g-load'), unit(o.peakG, 'g', 1)],
        [T('entry.s.shield', 'Heat shield left'), ltr(`${o.shield}%`)],
        [T('entry.s.blackout', 'Radio blackout'), ltr(`${mmss(cfg.blackoutActual)} (${T('entry.s.expected', 'expected')} ${mmss(cfg.blackoutExpected)})`)],
      ];
      const why = o.skipped
        ? T('entry.why.skip', 'Too shallow for too long: the capsule skipped off the top of the atmosphere, back into space, with almost no power left.')
        : o.burned
          ? T('entry.why.burn', 'Too steep: the heat beat the damaged shield at one spot. The capsule held together, but the cabin cooked and the crew was hurt.')
          : T('entry.why.ok', 'You kept the angle in the corridor through the heat pulse. Then six minutes of silence, and a voice from Houston.');
      return { lines, why };
    },
  };

  // ---------- 3D ----------
  function load3D(ctx, mode) {
    const eng = SMD.three && SMD.three.engine;
    if (!eng || !eng.mount) return Promise.resolve(null);
    return import(new URL('js/3d/survival.js', document.baseURI).href)
      .then((m) => {
        if (ctx.stopped) return null;
        const so = m.createSurvivalScene({ mode, appearance: SMD.avatar ? SMD.avatar.get() : null, overlay: ctx.root });
        eng.mount(ctx.$('[data-stage]'), so);
        ctx.three = so;
        if (ctx.on3D) ctx.on3D(so);
        return so;
      })
      .catch((e) => {
        console.warn('survival: 3D view unavailable', e);
        return null;
      });
  }
  const cap = (ctx) => (ctx.three ? ctx.three.capsule : null);

  // =====================================================================
  // ep2.power
  // =====================================================================
  function playPower(ctx) {
    const cfg = ctx.cfg;
    const st = ctx.state;
    const sel = power.defaults(cfg);
    let spent = 0;
    let left = cfg.decisionSeconds;
    let elapsed = 0;
    let locked = false;
    let temp = 21;
    let frost = 0;
    let wonOnce = false;
    const said = {};
    const ahStart = power.battery(cfg, st.res.power);
    const label = (s) => T('power.state.' + s, { on: 'On', low: 'Low', off: 'Off' }[s]);
    ctx.$('[data-body]').innerHTML = `
      <div class="sv-power">
        <section class="sv-panel sv-proj" aria-label="${esc(T('power.proj', 'Battery projection'))}">
          <h3>${esc(T('power.proj', 'Battery projection'))}</h3>
          <svg class="sv-proj-chart" viewBox="0 0 400 66" aria-hidden="true">
            <rect x="0" y="22" width="400" height="18" class="sv-proj-track"/>
            <rect x="0" y="22" width="0" height="18" class="sv-proj-bar" data-bar/>
            <rect x="0" y="16" width="0" height="30" class="sv-proj-margin" data-marginz/>
            <line x1="0" x2="0" y1="10" y2="50" class="sv-proj-home" data-home/>
            <text x="0" y="62" class="sv-proj-t" data-homet></text>
            <text x="2" y="13" class="sv-proj-t" data-lastt></text>
          </svg>
          <dl class="sv-stats">
            <div><dt>${esc(T('power.s.amps', 'Power draw'))}</dt><dd data-amps></dd></div>
            <div><dt>${esc(T('power.s.lasts', 'Battery lasts'))}</dt><dd data-lasts></dd></div>
            <div><dt>${esc(T('power.s.home', 'Time to home'))}</dt><dd>${unit(cfg.hoursHome, T('u.h', 'h'))}</dd></div>
            <div><dt>${esc(T('power.s.spent', 'Used while deciding'))}</dt><dd data-spent></dd></div>
          </dl>
          <p class="sv-verdict" data-verdict></p>
          <div class="sv-cabin">
            <div><span>${esc(T('power.s.temp', 'Cabin'))}</span> <b data-temp></b></div>
            <div class="sv-meter"><span>${esc(T('power.s.morale', 'Crew morale'))}</span><i><em data-morale></em></i></div>
          </div>
        </section>
        <section class="sv-panel sv-board" aria-label="${esc(T('power.board', 'Power board'))}">
          <h3>${esc(T('power.board', 'Power board'))} <small>${esc(T('power.bus', '28 V bus'))}</small></h3>
          <ul class="sv-sys-list">
            ${cfg.systems
              .map(
                (s) => `<li class="sv-sys" data-sys="${s.id}">
                <div class="sv-sys-text"><b>${esc(T('power.sys.' + s.id, s.id))}</b><small>${esc(T('power.note.' + s.id, ''))}</small></div>
                <span class="sv-sys-amps" data-a="${s.id}"></span>
                ${
                  s.states
                    ? `<div class="seg sv-seg" role="group" aria-label="${esc(T('power.sys.' + s.id, s.id))}">${s.states.map((x) => `<button type="button" data-set="${s.id}" data-v="${x}" aria-pressed="${sel[s.id] === x}">${esc(label(x))}</button>`).join('')}</div>`
                    : `<span class="sv-locked">${ICON.lock}${esc(T('power.locked', 'Always on'))}</span>`
                }
              </li>`
              )
              .join('')}
          </ul>
          <button type="button" class="btn primary sv-lock" data-lockin>${esc(T('power.lockin', 'Lock in the power-down'))}</button>
        </section>
      </div>`;
    const $ = ctx.$;
    const render = () => {
      const o = power.outcome(cfg, st.res.power, sel, spent);
      const need = cfg.hoursHome * cfg.margin;
      const scale = 400 / 110;
      const bar = $('[data-bar]');
      bar.setAttribute('width', Math.min(400, o.hours * scale));
      bar.classList.toggle('ok', o.win);
      const hx = cfg.hoursHome * scale;
      $('[data-home]').setAttribute('x1', hx);
      $('[data-home]').setAttribute('x2', hx);
      $('[data-marginz]').setAttribute('x', hx);
      $('[data-marginz]').setAttribute('width', (need - cfg.hoursHome) * scale);
      const ht = $('[data-homet]');
      ht.setAttribute('x', hx);
      ht.setAttribute('text-anchor', 'middle');
      ht.textContent = T('power.chart.home', 'Home: {n} h', { n: cfg.hoursHome });
      $('[data-lastt]').textContent = T('power.chart.lasts', 'Battery: {n} h', { n: num(o.hours) });
      $('[data-amps]').textContent = unit(o.amps, 'A', 1);
      $('[data-lasts]').textContent = unit(o.hours, T('u.h', 'h'));
      $('[data-spent]').textContent = unit(spent, 'Ah');
      const v = $('[data-verdict]');
      v.textContent = o.win ? T('power.v.ok', 'Reaches home with {n} h to spare.', { n: num(o.hours - cfg.hoursHome) }) : T('power.v.short', 'Runs out {n} h too soon (home plus a 5% margin).', { n: num(Math.max(1, need - o.hours)) });
      v.dataset.tone = o.win ? 'ok' : 'bad';
      cfg.systems.forEach((s) => {
        const a = power.ampsOf(s, sel[s.id]);
        const el = $(`[data-a="${s.id}"]`);
        el.textContent = unit(a, 'A', a % 1 ? 1 : 0);
        el.classList.toggle('zero', a === 0);
      });
      $('[data-temp]').textContent = unit(temp, '°C');
      const m = power.morale(sel);
      const me = $('[data-morale]');
      me.style.inlineSize = m + '%';
      me.dataset.tone = m > 70 ? 'ok' : m > 45 ? 'warn' : 'bad';
      if (o.win && !wonOnce && !locked) {
        wonOnce = true;
        ctx.radio('yusuf', T('power.r.win', 'That’s it, the line reaches home. Lock it in before we burn any more.'));
      }
      if (!o.win) wonOnce = false;
      return o;
    };
    const apply3D = () => {
      const c = cap(ctx);
      if (!c) return;
      c.setPower({ on: 1, low: 0.45, off: 0.12 }[sel.lights]);
      c.setPanels(sel.displays === 'on' ? 1 : 0.3);
      c.setFrost(frost);
    };
    ctx.on3D = () => {
      cap(ctx).setAlarm(true);
      ctx.after(2.5, () => cap(ctx) && cap(ctx).setAlarm(false));
      apply3D();
    };
    ctx.$$('[data-set]').forEach((b) =>
      ctx.on(b, 'click', () => {
        if (locked) return;
        sel[b.dataset.set] = b.dataset.v;
        ctx.$$(`[data-set="${b.dataset.set}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === b.dataset.v)));
        ctx.sfx('beep', b.dataset.v === 'off' ? 520 : 760, 0.05, 'square', 0.05);
        if (ctx.three && ctx.three.handles.reach) ctx.three.handles.reach();
        apply3D();
        render();
      })
    );
    return new Promise((resolve) => {
      const lockIn = () => {
        if (locked) return;
        locked = true;
        ctx.$$('[data-set]').forEach((b) => (b.disabled = true));
        $('[data-lockin]').disabled = true;
        // Fast-forward to home: the cabin settles, frost forms, the battery drains.
        const o0 = power.outcome(cfg, st.res.power, sel, spent);
        const dur = ctx.reduced ? 0.6 : 4;
        let ft = 0;
        const frostTo = Math.min(1, { on: 0, low: 0.4, off: 0.9 }[sel.heaters] + (o0.win ? 0 : 0.3));
        const temp0 = temp;
        ctx.radio('nadia', T('power.r.locked', 'Copy your power-down. We’ll talk to you on the other side of the Moon.'));
        ctx.loop((dt) => {
          ft += dt;
          const u = clamp(ft / dur);
          temp = temp0 + ((o0.win ? o0.cabinC : cfg.cabinC.off) - temp0) * u;
          frost += (frostTo - frost) * Math.min(1, dt * 1.5);
          if (cap(ctx)) cap(ctx).setFrost(frost);
          ctx.clock(T('power.ff', 'Hour {h} of {n}', { h: Math.round(cfg.hoursHome * u), n: cfg.hoursHome }));
          $('[data-temp]').textContent = unit(temp, '°C');
          if (u >= 1) {
            resolve(power.outcome(cfg, st.res.power, sel, spent));
            return false;
          }
        });
      };
      ctx.on($('[data-lockin]'), 'click', lockIn);
      ctx.debug = { set: (id, v) => ctx.$(`[data-set="${id}"][data-v="${v}"]`).click(), lock: lockIn, sel };
      render();
      ctx.radio('nadia', T('power.r.start', 'We need you powered down to stretch that battery home. Every amp you leave on right now is time you won’t have later.'));
      let acc = 0;
      ctx.loop((dt) => {
        if (locked) return false;
        elapsed += dt;
        left -= dt;
        const amps = power.amps(cfg, sel);
        spent = Math.min(ahStart, spent + amps * cfg.hoursPerSecond * dt);
        temp += (Math.min(21, cfg.cabinC[sel.heaters]) - temp) * Math.min(1, dt * 0.05);
        frost += (({ on: 0, low: 0.22, off: 0.45 }[sel.heaters] || 0) - frost) * Math.min(1, dt * 0.08);
        acc += dt;
        if (acc > 0.1) {
          acc = 0;
          render();
          apply3D();
        }
        ctx.clock(T('power.clock', 'Plan due in {t}', { t: mmss(left) }), left < 30 ? 'bad' : left < 60 ? 'warn' : '');
        if (elapsed > 22 && !said.junk && (sel.radar === 'on' || sel.camera === 'on')) {
          said.junk = 1;
          ctx.radio('grace', T('power.r.junk', 'The docking radar and the camera are pulling seven amps for nothing.'));
        }
        if (elapsed > 45 && !said.gnc && sel.guidance === 'on') {
          said.gnc = 1;
          ctx.radio('kwame', T('power.r.gnc', 'The guidance computer is ten amps by itself. Apollo 13 flew its last burns by hand. So can you.'));
        }
        if (elapsed > 80 && !said.short && !power.outcome(cfg, st.res.power, sel, spent).win) {
          said.short = 1;
          ctx.radio('kwame', T('power.r.short', 'Still short. Heat and radio are what’s left. Something has to give.'));
        }
        if (left <= 0) {
          lockIn();
          return false;
        }
      });
    });
  }

  // =====================================================================
  // ep2.co2
  // =====================================================================
  function playCO2(ctx) {
    const cfg = ctx.cfg;
    const st = ctx.state;
    let level = co2.start(cfg, st);
    let peak = level;
    let step = 0;
    let wrong = 0;
    let phase = 'collect';
    let busy = false;
    let near = null;
    let sinceAlarm = 0;
    const inv = new Set();
    // The square cartridges were carried over from Lantern in the story.
    if (st.flags.tookCartridges) inv.add('cartridge');
    const opened = new Set();
    const said = {};
    const lockerLabel = (l) => T('co2.locker.' + (l.item || l.id), l.item || l.id);
    const itemName = (id) => T('co2.item.' + id, id);
    ctx.$('[data-body]').innerHTML = `
      <div class="sv-co2">
        <section class="sv-panel sv-gauge" aria-label="${esc(T('co2.gauge', 'Cabin CO2'))}">
          <h3>${esc(T('co2.gauge', 'Cabin CO2'))}</h3>
          <div class="sv-gauge-row">
            <div class="sv-gauge-bar" role="meter" aria-valuemin="0" aria-valuemax="20" aria-label="${esc(T('co2.gauge', 'Cabin CO2'))}" data-meter>
              <i data-fill></i>
              <span class="mk" style="inset-block-end:${(cfg.safe / 20) * 100}%">${cfg.safe}</span>
              <span class="mk warn" style="inset-block-end:${(cfg.amber / 20) * 100}%">${cfg.amber}</span>
              <span class="mk bad" style="inset-block-end:${(cfg.danger / 20) * 100}%">${cfg.danger}</span>
            </div>
            <div>
              <p class="sv-big" data-level></p>
              <p class="sv-small" data-trend></p>
              <p class="sv-small" data-symptom></p>
            </div>
          </div>
        </section>
        <section class="sv-panel sv-proc" aria-label="${esc(T('co2.proc', 'Procedure from Houston'))}">
          <h3>${esc(T('co2.proc', 'Procedure from Houston'))}</h3>
          <ol class="sv-steps">${cfg.steps.map((s, i) => `<li data-step="${i}">${esc(T('co2.step.' + (i + 1), s))}</li>`).join('')}</ol>
          <h3>${esc(T('co2.goto', 'Float to'))}</h3>
          <div class="sv-chips">
            ${cfg.lockers.map((l, i) => `<button type="button" class="sv-chip" data-go="${l.id}"><b>${i + 1}</b> ${esc(lockerLabel(l))}</button>`).join('')}
            <button type="button" class="sv-chip sv-chip-bench" data-go="bench">${esc(T('co2.bench', 'Work surface'))}</button>
          </div>
        </section>
        <div class="sv-inv" role="list" aria-label="${esc(T('co2.inv', 'Found'))}">
          ${cfg.steps.map((id) => `<span class="sv-slot" role="listitem" data-inv="${id}">${itemIcon(id)}<small>${esc(itemName(id))}</small></span>`).join('')}
        </div>
        <button type="button" class="sv-prompt" data-prompt hidden></button>
        <div class="sv-assembly" data-assembly hidden role="dialog" aria-labelledby="sv-asm-h">
          <h3 id="sv-asm-h">${esc(T('co2.asm', 'Build the adapter'))}</h3>
          <p class="sv-asm-step" data-asm-step></p>
          <svg class="sv-asm-pic" viewBox="0 0 120 90" aria-hidden="true" data-asm-pic></svg>
          <div class="sv-asm-items" data-asm-items></div>
          <p class="sv-asm-msg" data-asm-msg aria-live="assertive"></p>
          <button type="button" class="btn ghost small" data-asm-close>${esc(T('co2.asm.back', 'Back (Esc)'))}</button>
        </div>
      </div>`;
    const $ = ctx.$;
    const lockers = cfg.lockers;
    const s3h = () => (ctx.three ? ctx.three.handles : null);
    function render() {
      const fillEl = $('[data-fill]');
      fillEl.style.blockSize = clamp(level / 20) * 100 + '%';
      fillEl.dataset.tone = level >= cfg.danger ? 'bad' : level >= cfg.amber ? 'warn' : level >= cfg.safe ? 'watch' : 'ok';
      $('[data-meter]').setAttribute('aria-valuenow', r1(level));
      $('[data-level]').textContent = unit(level, 'mmHg', 1);
      $('[data-trend]').textContent = phase === 'scrub' ? T('co2.trend.down', 'Falling fast') : T('co2.trend.up', 'Rising {n} per minute', { n: num(cfg.rate * 60, 1) });
      $('[data-symptom]').textContent = level >= cfg.danger ? T('co2.sym.bad', 'Headaches, fast breathing') : level >= cfg.amber ? T('co2.sym.warn', 'Amber light on, dull headaches') : level >= cfg.safe ? T('co2.sym.watch', 'Above the safe line') : T('co2.sym.ok', 'Safe');
      ctx.$$('[data-step]').forEach((li) => {
        const i = Number(li.dataset.step);
        li.classList.toggle('done', i < step);
        li.classList.toggle('now', i === step && phase === 'assemble');
        if (i < step && !li.dataset.done) {
          li.dataset.done = '1';
          li.innerHTML = `${ICON.check}<b>${esc(itemName(cfg.steps[i]))}</b> <span>${esc(T('co2.step.' + (i + 1), ''))}</span>`;
        }
      });
      ctx.$$('[data-inv]').forEach((el) => {
        el.classList.toggle('have', inv.has(el.dataset.inv));
        el.classList.toggle('used', cfg.steps.indexOf(el.dataset.inv) < step);
      });
      ctx.$$('[data-go]').forEach((b) => b.classList.toggle('opened', opened.has(b.dataset.go)));
    }
    function ownPrompt() {
      return !ctx.three || ctx.three.handles.ownPrompt !== false;
    }
    function setPrompt(id) {
      near = id;
      const p = $('[data-prompt]');
      if (!id || !ownPrompt() || phase !== 'collect') {
        p.hidden = true;
        return;
      }
      const l = lockers.find((x) => x.id === id);
      p.innerHTML = `<kbd>E</kbd> <span>${esc(id === 'bench' ? T('co2.prompt.bench', 'Build the adapter') : T('co2.prompt.locker', 'Open locker {n}: {label}', { n: lockers.indexOf(l) + 1, label: lockerLabel(l) }))}</span>`;
      p.hidden = false;
    }
    function openLocker(id) {
      if (busy || phase !== 'collect') return;
      if (id === 'bench') return openAssembly();
      const l = lockers.find((x) => x.id === id);
      if (!l) return;
      busy = true;
      const c = cap(ctx);
      if (c) c.openLocker(id, 1);
      const h = s3h();
      if (h && h.reach) h.reach();
      ctx.sfx('beep', 300, 0.08, 'triangle', 0.06);
      ctx.after(0.6, () => {
        busy = false;
        opened.add(id);
        const n = lockers.indexOf(l) + 1;
        if (l.item && !inv.has(l.item)) {
          inv.add(l.item);
          ctx.sfx('beep', 990, 0.09, 'triangle', 0.08);
          ctx.radio('you', T('co2.found', 'Locker {n}, {label}: {item}. Got it.', { n, label: lockerLabel(l), item: itemName(l.item) }));
          if (inv.size === cfg.steps.length) ctx.after(1.6, () => ctx.radio('kwame', T('co2.r.all', 'That’s everything. Take it to the work surface and we’ll go step by step.')));
        } else if (l.item) ctx.radio('you', T('co2.empty', 'Locker {n} is empty now.', { n }));
        else ctx.radio('you', T('co2.nothing', 'Locker {n}, {label}: nothing for the adapter.', { n, label: lockerLabel(l) }));
        render();
        ctx.after(1.8, () => c && c.openLocker(id, 0));
      });
    }
    function go(id) {
      if (phase !== 'collect' || busy) return;
      const h = s3h();
      if (h && h.goTo) h.goTo(id, () => openLocker(id));
      else {
        // No 3D: the float takes a moment, then the locker opens.
        busy = true;
        ctx.after(ctx.reduced ? 0.2 : 1.1, () => {
          busy = false;
          openLocker(id);
        });
      }
    }
    // ----- Assembly -----
    const PIC = {
      cartridge: '<rect x="44" y="40" width="32" height="32" rx="2" fill="#8f989e"/><rect x="48" y="36" width="24" height="5" fill="#545d66"/>',
      cover: '<path d="M42 40c0-18 36-18 36 0" fill="none" stroke="#5aa0e0" stroke-width="3"/>',
      bag: '<path d="M34 24h52l-3 52H37z" fill="#dfe8ee" opacity=".45" stroke="#a9b6c2"/>',
      hose: '<path d="M84 30c14-6 24 0 30 12" fill="none" stroke="#e06a5f" stroke-width="5" stroke-linecap="round"/>',
      tape: '<rect x="34" y="34" width="52" height="5" fill="#8a8f93"/><rect x="34" y="66" width="52" height="5" fill="#8a8f93"/><rect x="80" y="26" width="9" height="9" fill="#8a8f93"/>',
      sock: '<circle cx="86" cy="30" r="5" fill="#f2f0ea"/>',
    };
    function renderAssembly(msg, tone) {
      $('[data-asm-step]').textContent = step < cfg.steps.length ? T('co2.asm.step', 'Step {n} of {m}: {text}', { n: step + 1, m: cfg.steps.length, text: T('co2.step.' + (step + 1), '') }) : T('co2.asm.done', 'Sealed. Connect it to the suit loop.');
      $('[data-asm-pic]').innerHTML = cfg.steps
        .slice(0, step)
        .map((id) => PIC[id])
        .join('');
      $('[data-asm-items]').innerHTML = cfg.steps
        .filter((id) => cfg.steps.indexOf(id) >= step)
        .map((id) => `<button type="button" class="sv-asm-item" data-item="${id}" ${inv.has(id) ? '' : 'disabled'}>${itemIcon(id)}<span>${esc(itemName(id))}</span>${inv.has(id) ? '' : `<small>${esc(T('co2.asm.missing', 'not found yet'))}</small>`}</button>`)
        .join('');
      const m = $('[data-asm-msg]');
      m.textContent = msg || '';
      m.dataset.tone = tone || '';
      ctx.$$('[data-item]').forEach((b) => ctx.on(b, 'click', () => useItem(b.dataset.item)));
    }
    function openAssembly() {
      if (phase !== 'collect') return;
      phase = 'assemble';
      if (ctx.three && ctx.three.handles.controller) ctx.three.handles.controller.setEnabled(false);
      setPrompt(null);
      $('[data-assembly]').hidden = false;
      $('[data-assembly]').setAttribute('aria-modal', 'true');
      renderAssembly(inv.size ? '' : T('co2.asm.empty', 'You have nothing to build with yet. Check the lockers first.'));
      const f = $('[data-asm-items] button:not([disabled])') || $('[data-asm-close]');
      f.focus({ preventScroll: true });
      ctx.radio('kwame', T('co2.r.step', 'Step {n}: {text}', { n: step + 1, text: T('co2.step.' + (step + 1), '') }));
      render();
    }
    function closeAssembly() {
      if (phase !== 'assemble') return;
      phase = 'collect';
      $('[data-assembly]').hidden = true;
      $('[data-assembly]').removeAttribute('aria-modal');
      if (ctx.three && ctx.three.handles.controller) ctx.three.handles.controller.setEnabled(true);
      render();
    }
    function useItem(id) {
      if (phase !== 'assemble' || !inv.has(id)) return;
      const r = co2.pick(cfg, step, id);
      if (r.ok) {
        step = r.next;
        ctx.sfx('beep', 880, 0.07, 'triangle', 0.08);
        const h = s3h();
        if (h && h.showPart) h.showPart(id);
        if (step >= cfg.steps.length) {
          renderAssembly(T('co2.asm.ok', '{item}: done.', { item: itemName(id) }), 'ok');
          ctx.after(0.9, () => {
            $('[data-assembly]').hidden = true;
            $('[data-assembly]').removeAttribute('aria-modal');
            phase = 'scrub';
            ctx.radio('kwame', T('co2.r.done', 'Now hook it to the suit loop and watch the gauge.'));
            render();
          });
        } else {
          renderAssembly(T('co2.asm.ok', '{item}: done.', { item: itemName(id) }), 'ok');
          ctx.radio('kwame', T('co2.r.step', 'Step {n}: {text}', { n: step + 1, text: T('co2.step.' + (step + 1), '') }));
          const f = $('[data-asm-items] button:not([disabled])');
          if (f) f.focus({ preventScroll: true });
        }
      } else {
        wrong++;
        level += co2.penalty(cfg, st);
        ctx.sfx('beep', 200, 0.18, 'sawtooth', 0.08);
        renderAssembly(T('co2.wrong', 'Not the {item} yet: undoing it costs time while the CO2 climbs. {hint}', { item: itemName(id), hint: T('co2.hint.' + (step + 1), '') }), 'bad');
        const card = $('[data-assembly]');
        card.classList.remove('sv-shake');
        void card.offsetWidth;
        if (!ctx.reduced) card.classList.add('sv-shake');
      }
      render();
    }
    ctx.on($('[data-asm-close]'), 'click', closeAssembly);
    ctx.on(window, 'keydown', (e) => {
      if (ctx.root.classList.contains('sv-has-card')) return;
      if (e.code === 'Escape' || e.code === 'KeyQ') closeAssembly();
      if ((e.code === 'KeyE' || (e.code === 'Enter' && !(e.target && e.target.tagName === 'BUTTON'))) && near && phase === 'collect' && ownPrompt()) {
        e.preventDefault();
        openLocker(near);
      }
    });
    ctx.on($('[data-prompt]'), 'click', () => near && openLocker(near));
    ctx.$$('[data-go]').forEach((b) => ctx.on(b, 'click', () => go(b.dataset.go)));
    ctx.on3D = (so) => {
      const c = so.capsule;
      lockers.forEach((l) => c.setLockerLabel(l.id, lockerLabel(l)));
      so.handles.onPick = (id) => go(id);
      const ctl = so.handles.controller;
      if (ctl) {
        const items = lockers.map((l) => ({ id: l.id, at: so.handles.interactPoint(l.id), radius: 1.25, label: () => T('co2.prompt.locker', 'Open locker {n}: {label}', { n: lockers.indexOf(l) + 1, label: lockerLabel(l) }), onInteract: () => openLocker(l.id) }));
        items.push({ id: 'bench', at: so.handles.interactPoint('bench'), radius: 1.3, label: () => T('co2.prompt.bench', 'Build the adapter'), onInteract: () => openAssembly() });
        ctl.setInteractables(items);
        ctl.on('near', (it) => setPrompt(it && it.id));
        ctl.on('far', () => setPrompt(null));
        // A movement key while the build card is open closes it.
        ctl.on('wantmove', () => phase === 'assemble' && closeAssembly());
        if (phase !== 'collect' || ctx.root.classList.contains('sv-has-card')) ctl.setEnabled(false);
      }
      c.setFrost(st.flags.heatersOff ? 0.6 : st.flags.heatersLow ? 0.3 : 0);
      c.setPower(st.flags.lightsOff ? 0.25 : 0.75);
    };
    return new Promise((resolve) => {
      ctx.debug = {
        go,
        open: openLocker,
        openAssembly,
        use: useItem,
        close: closeAssembly,
        get level() {
          return level;
        },
        set level(v) {
          level = v;
        },
        get step() {
          return step;
        },
        get phase() {
          return phase;
        },
        inv,
        collectAll: () => lockers.forEach((l) => l.item && inv.add(l.item)),
      };
      render();
      ctx.radio('kwame', T('co2.r.start', 'We have a fix for the CO2. You’ll need a square cartridge, a suit hose, a plastic bag, the gray tape, a flight-plan cover and a sock. Find them, then we read you the steps.'));
      if (ctx.three && ctx.three.handles.controller) ctx.three.handles.controller.setEnabled(true);
      let acc = 0;
      let doneT = 0;
      ctx.loop((dt) => {
        if (phase === 'scrub') {
          level = Math.max(0.8, level - 1.2 * dt);
          if (level <= 1.5) doneT += dt;
          if (level < cfg.safe && cap(ctx)) cap(ctx).setAlarm(false);
          if (doneT > 1.2) {
            render();
            resolve({ built: true, peak: r1(peak), final: r1(level), wrong });
            return false;
          }
        } else {
          level += cfg.rate * dt;
          peak = Math.max(peak, level);
        }
        const bad = level >= cfg.danger && phase !== 'scrub';
        ctx.root.classList.toggle('sv-headache', bad && !ctx.reduced);
        ctx.root.classList.toggle('sv-headache-still', bad && ctx.reduced);
        const ctl = ctx.three && ctx.three.handles.controller;
        if (ctl && ctl.setSpeedScale) ctl.setSpeedScale(bad ? 0.6 : 1);
        if (level >= cfg.amber && phase !== 'scrub') {
          if (cap(ctx)) cap(ctx).setAlarm(true);
          sinceAlarm -= dt;
          if (sinceAlarm <= 0) {
            sinceAlarm = 4;
            ctx.sfx('alarm');
          }
          if (!said.amber) {
            said.amber = 1;
            ctx.radio('grace', T('co2.r.amber', 'CO2 light. Ten millimetres and climbing.'));
          }
        }
        if (bad && !said.danger) {
          said.danger = 1;
          ctx.radio('lena', T('co2.r.danger', 'Headaches starting. Slow, deep breaths, and keep working.'));
        }
        if (level >= cfg.fail && phase !== 'scrub') {
          resolve({ built: false, peak: r1(Math.max(peak, level)), final: r1(level), wrong });
          return false;
        }
        acc += dt;
        if (acc > 0.12) {
          acc = 0;
          render();
        }
        ctx.clock(phase === 'scrub' ? T('co2.clock.scrub', 'Scrubbing') : T('co2.clock', 'Headaches at {d} mmHg', { d: cfg.danger }), level >= cfg.danger ? 'bad' : level >= cfg.amber ? 'warn' : '');
      });
    });
  }

  // =====================================================================
  // ep3.storm
  // =====================================================================
  function playStorm(ctx) {
    const cfg = ctx.cfg;
    const pool = { water: cfg.bags.water.n, stow: cfg.bags.stow.n };
    const layout = {};
    cfg.berths.forEach((b) => (layout[b.id] = []));
    const crewAt = { you: null, yusuf: null, lena: null, grace: null };
    const edge = storm.edge(ctx.state);
    if (edge) crewAt[edge] = 'b4';
    let selBag = 'water';
    let selCrew = null;
    let busy = 0;
    let left = cfg.warnSeconds;
    let sealed = false;
    let elapsed = 0;
    const said = {};
    const bagName = (k) => T('storm.bag.' + k, k === 'water' ? 'Water bag' : 'Stowage bag');
    const tone = (d) => (d <= cfg.goal ? 'ok' : d <= cfg.limit ? 'warn' : 'bad');
    ctx.$('[data-body]').innerHTML = `
      <div class="sv-storm">
        <section class="sv-panel sv-pool">
          <h3>${esc(T('storm.flux', 'Proton flux'))}</h3>
          <div class="sv-flux"><i data-flux></i></div>
          <h3>${esc(T('storm.move', 'Shielding to move'))}</h3>
          <div class="seg sv-bagsel" role="group" aria-label="${esc(T('storm.move', 'Shielding to move'))}">
            ${['water', 'stow'].map((k) => `<button type="button" data-bag="${k}" aria-pressed="${k === selBag}"><span class="sv-bagdot ${k}"></span>${esc(bagName(k))} <small>+${cfg.bags[k].gcm2} g/cm²</small> <b data-n="${k}"></b></button>`).join('')}
          </div>
          <h3>${esc(T('storm.crew', 'Crew'))}</h3>
          <div class="sv-crew">${CREW.map((id) => `<button type="button" class="sv-crewchip" data-crew="${id}" aria-pressed="false"><b>${esc(castName(id))}</b><small data-where="${id}"></small></button>`).join('')}</div>
          <p class="sv-hint" data-hint>${esc(T('storm.hint', 'Pick a bag type, then press “Add bag” on a berth. Pick a crew member, then their berth.'))}</p>
          <button type="button" class="btn primary" data-seal>${esc(T('storm.seal', 'Seal the shelter'))}</button>
        </section>
        <section class="sv-berths" aria-label="${esc(T('storm.berths', 'Floor bay berths'))}">
          ${cfg.berths
            .map(
              (b, i) => `<article class="sv-berth" data-berth="${b.id}">
              <header><b>${esc(T('storm.berth', 'Berth {n}', { n: i + 1 }))}</b><small>${esc(T('storm.where.' + b.id, ''))}</small></header>
              <div class="sv-stack" data-stack="${b.id}"></div>
              <button type="button" class="btn small sv-add" data-add="${b.id}">${esc(T('storm.add', '+ Add bag'))}</button>
              <p class="sv-shield"><span>${esc(T('storm.shield', 'Shielding'))}</span> <b data-shield="${b.id}"></b></p>
              <p class="sv-dose"><span>${esc(T('storm.dose', 'Dose'))}</span> <b data-dose="${b.id}"></b></p>
              <button type="button" class="sv-slot-btn" data-slot="${b.id}"></button>
            </article>`
            )
            .join('')}
        </section>
      </div>`;
    const $ = ctx.$;
    function render() {
      ['water', 'stow'].forEach((k) => ($(`[data-n="${k}"]`).textContent = '×' + pool[k]));
      ctx.$$('[data-bag]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bag === selBag)));
      cfg.berths.forEach((b, i) => {
        const bags = layout[b.id];
        const st = $(`[data-stack="${b.id}"]`);
        let h = '';
        for (let k = 0; k < cfg.capacity; k++) {
          const bg = bags[k];
          h += bg ? `<button type="button" class="sv-bag ${bg}" data-remove="${b.id}:${k}" aria-label="${esc(T('storm.remove', 'Take back {bag}', { bag: bagName(bg) }))}"></button>` : '<span class="sv-bag empty"></span>';
        }
        st.innerHTML = h;
        const sh = storm.shield(cfg, b.id, bags);
        const d = Math.round(storm.dose(cfg, sh));
        $(`[data-shield="${b.id}"]`).textContent = unit(sh, 'g/cm²');
        const de = $(`[data-dose="${b.id}"]`);
        de.textContent = ltr(`~${num(d)} mSv`);
        de.dataset.tone = tone(d);
        const who = CREW.find((id) => crewAt[id] === b.id);
        const slot = $(`[data-slot="${b.id}"]`);
        slot.textContent = who ? castName(who) : selCrew ? T('storm.place', 'Place {name} here', { name: castName(selCrew) }) : T('storm.empty', 'Empty berth');
        slot.classList.toggle('has', !!who);
        $(`[data-add="${b.id}"]`).disabled = sealed || bags.length >= cfg.capacity || (pool.water + pool.stow === 0);
      });
      ctx.$$('[data-remove]').forEach((x) => ctx.on(x, 'click', () => removeBag(x.dataset.remove)));
      CREW.forEach((id) => {
        $(`[data-where="${id}"]`).textContent = crewAt[id] ? T('storm.berth', 'Berth {n}', { n: cfg.berths.findIndex((b) => b.id === crewAt[id]) + 1 }) : T('storm.out', 'Not in the shelter');
        $(`[data-crew="${id}"]`).setAttribute('aria-pressed', String(selCrew === id));
      });
      if (ctx.three) {
        ctx.three.handles.setBags(layout, pool);
        ctx.three.handles.setCrew(crewAt);
      }
    }
    const hint = (text) => ($('[data-hint]').textContent = text);
    function addBag(b) {
      if (sealed) return;
      if (busy > 0) return hint(T('storm.busy', 'Still floating the last bag over.'));
      if (layout[b].length >= cfg.capacity) return hint(T('storm.full', 'No room for more bags over that berth.'));
      if (!pool[selBag]) selBag = selBag === 'water' ? 'stow' : 'water';
      if (!pool[selBag]) return hint(T('storm.none', 'Every bag is in place.'));
      const k = selBag;
      pool[k]--;
      busy = cfg.carrySeconds;
      if (ctx.three) ctx.three.handles.carry(k, b, cfg.carrySeconds / ctx.speed());
      ctx.sfx('beep', 420, 0.06, 'triangle', 0.05);
      ctx.after(cfg.carrySeconds, () => {
        layout[b].push(k);
        render();
      });
      render();
    }
    function removeBag(key) {
      if (sealed || busy > 0) return;
      const [b, i] = key.split(':');
      const k = layout[b].splice(Number(i), 1)[0];
      if (k) pool[k]++;
      busy = cfg.carrySeconds * 0.5;
      render();
    }
    function slot(b) {
      if (sealed) return;
      const who = CREW.find((id) => crewAt[id] === b);
      if (selCrew) {
        if (who && who !== selCrew) crewAt[who] = crewAt[selCrew];
        crewAt[selCrew] = b;
        selCrew = null;
      } else if (who) selCrew = who;
      render();
    }
    ctx.$$('[data-bag]').forEach((x) =>
      ctx.on(x, 'click', () => {
        selBag = x.dataset.bag;
        render();
      })
    );
    ctx.$$('[data-add]').forEach((x) => ctx.on(x, 'click', () => addBag(x.dataset.add)));
    ctx.$$('[data-slot]').forEach((x) => ctx.on(x, 'click', () => slot(x.dataset.slot)));
    ctx.$$('[data-crew]').forEach((x) =>
      ctx.on(x, 'click', () => {
        selCrew = selCrew === x.dataset.crew ? null : x.dataset.crew;
        render();
      })
    );
    ctx.on3D = (so) => {
      so.capsule.setAlarm(true);
      ctx.after(3, () => so.capsule.setAlarm(false));
      so.capsule.setPower(0.6);
      render();
    };
    return new Promise((resolve) => {
      const seal = () => {
        if (sealed) return;
        sealed = true;
        selCrew = null;
        render();
        ctx.$$('.sv-storm button').forEach((b) => (b.disabled = true));
        const o = storm.outcome(cfg, layout, crewAt);
        ctx.radio('mariam', T('storm.r.sealed', 'Peak flux in the next few hours. Stay down there and stay still.'));
        if (cap(ctx)) {
          cap(ctx).setAlarm(true);
          cap(ctx).setPower(0.35);
        }
        // The storm passes: each berth's dose counts up.
        const dur = ctx.reduced ? 0.8 : 5;
        let ft = 0;
        ctx.loop((dt) => {
          ft += dt;
          const u = clamp(ft / dur);
          $('[data-flux]').style.inlineSize = Math.round(100 * Math.sin(Math.PI * Math.min(1, 0.5 + u * 0.5)) + 0) + '%';
          CREW.forEach((id) => {
            const b = o.crewAt[id];
            if (b) {
              const de = $(`[data-dose="${b}"]`);
              de.textContent = ltr(`${num(Math.round(o.doses[id] * u))} mSv`);
              de.dataset.tone = tone(o.doses[id] * u);
            }
          });
          ctx.clock(T('storm.passing', 'Storm passing: hour {h} of 14', { h: Math.round(14 * u) }), 'warn');
          if (u >= 1) {
            if (cap(ctx)) cap(ctx).setAlarm(false);
            resolve(o);
            return false;
          }
        });
      };
      ctx.on($('[data-seal]'), 'click', seal);
      ctx.debug = { add: (b, k) => ((selBag = k || selBag), addBag(b)), place: (id, b) => ((selCrew = id), slot(b)), seal, layout, crewAt, pool, get busy() { return busy; } };
      render();
      ctx.radio('mariam', T('storm.r.start', 'Proton flux is climbing fast. Peak in about thirty minutes. Get everyone into the floor bay and pile every bag you can over them.'));
      let acc = 0;
      ctx.loop((dt) => {
        if (sealed) return false;
        elapsed += dt;
        left -= dt;
        busy = Math.max(0, busy - dt);
        $('[data-flux]').style.inlineSize = Math.round(10 + 40 * (1 - left / cfg.warnSeconds)) + '%';
        ctx.clock(T('storm.clock', 'Protons peak in {t}', { t: mmss(left) }), left < 15 ? 'bad' : left < 35 ? 'warn' : '');
        acc += dt;
        if (acc > 1 && cap(ctx)) {
          acc = 0;
          if (left < 20) ctx.sfx('alarm');
        }
        if (elapsed > 18 && !said.water) {
          said.water = 1;
          ctx.radio('grace', T('storm.r.water', 'Water is the best shield we have: lots of hydrogen. Every litre counts.'));
        }
        if (elapsed > 40 && !said.hatch) {
          said.hatch = 1;
          ctx.radio('nadia', T('storm.r.hatch', 'Whoever lies by the hatch has the thinnest wall. Decide who, and give them more bags.'));
        }
        if (left <= 0) {
          ctx.radio('mariam', T('storm.r.time', 'Time’s up. Seal it now, whatever you have.'));
          seal();
          return false;
        }
      });
    });
  }

  // =====================================================================
  // ep4.burn
  // =====================================================================
  function playBurn(ctx) {
    const cfg = ctx.cfg;
    const s = burn.create(cfg, 7);
    const drag = { on: false, x: 0, y: 0, dx: 0, dy: 0 };
    const said = {};
    ctx.$('[data-body]').innerHTML = `
      <div class="sv-burn">
        <svg class="sv-coas" viewBox="-100 -100 200 200" aria-hidden="true">
          <g data-earthg><g data-earth2d class="sv-earth2d" hidden><circle r="34" fill="#071526"/><path d="M-34 0A34 34 0 0 1 34 0Z" fill="#4f9dff"/></g><line x1="-40" x2="40" y1="0" y2="0" class="sv-term" data-term/></g>
          <circle r="72" class="ret faint"/>
          <circle r="4" class="ret"/>
          <line x1="-96" x2="-10" y1="0" y2="0" class="ret yy"/><line x1="10" x2="96" y1="0" y2="0" class="ret yy"/>
          <line x1="0" x2="0" y1="-96" y2="-10" class="ret"/><line x1="0" x2="0" y1="10" y2="96" class="ret"/>
          ${[-60, -40, -20, 20, 40, 60].map((v) => `<line x1="${v}" x2="${v}" y1="-3" y2="3" class="ret"/><line y1="${v}" y2="${v}" x1="-3" x2="3" class="ret"/>`).join('')}
          <text x="78" y="-5" class="ret-t">Y–Y</text>
        </svg>
        <section class="sv-panel sv-att">
          <h3>${esc(T('burn.att', 'Attitude'))}</h3>
          <p><span>${esc(T('burn.pitch', 'Terminator off the line'))}</span> <b data-pv></b></p>
          <p><span>${esc(T('burn.roll', 'Terminator tilt'))}</span> <b data-rv></b></p>
          <div class="sv-rate"><span>${esc(T('burn.rates', 'Rates (limit 10°/s)'))}</span><i><em data-rate></em></i></div>
        </section>
        <section class="sv-panel sv-bclock">
          <p class="sv-bigclock" data-bt>0.0</p>
          <p class="sv-small">${esc(T('burn.target', 'seconds · shut down by hand at {n}', { n: cfg.burnSeconds }))}</p>
          <h3>${esc(T('burn.gamma', 'Entry angle'))}</h3>
          <div class="sv-htape"><span class="band" style="inset-inline-start:${((cfg.corridor[0] - 3) / 7) * 100}%;inline-size:${((cfg.corridor[1] - cfg.corridor[0]) / 7) * 100}%"></span><i data-gm></i></div>
          <p class="sv-small" data-gv></p>
        </section>
        <div class="sv-pad">
          <div class="sv-dpad">
            <button type="button" class="sv-hold" data-hold="ArrowUp" aria-label="${esc(T('burn.up', 'Earth up'))}">${ICON.up}</button>
            <button type="button" class="sv-hold" data-hold="ArrowLeft" aria-label="${esc(T('burn.ccw', 'Turn left'))}">${ICON.ccw}</button>
            <button type="button" class="sv-hold" data-hold="ArrowRight" aria-label="${esc(T('burn.cw', 'Turn right'))}">${ICON.cw}</button>
            <button type="button" class="sv-hold" data-hold="ArrowDown" aria-label="${esc(T('burn.down', 'Earth down'))}">${ICON.down}</button>
          </div>
          <button type="button" class="btn primary sv-fire" data-fire>${esc(T('burn.ignite', 'Ignite (Space)'))}</button>
        </div>
      </div>`;
    const $ = ctx.$;
    ctx.captureKeys();
    ctx.bindHold();
    const stage = $('[data-stage]');
    ctx.on(stage, 'pointerdown', (e) => {
      drag.on = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.dx = drag.dy = 0;
    });
    ctx.on(window, 'pointermove', (e) => {
      if (!drag.on) return;
      drag.dx = clamp((e.clientX - drag.x) / 80, -1, 1);
      drag.dy = clamp((e.clientY - drag.y) / 80, -1, 1);
    });
    ctx.on(window, 'pointerup', () => (drag.on = false));
    const fire = () => {
      if (s.phase === 'arm') {
        burn.ignite(cfg, s);
        onIgnite();
      } else if (s.phase === 'burn') burn.cut(cfg, s);
    };
    const onIgnite = () => {
      $('[data-fire]').textContent = T('burn.cut', 'Shut down (Space)');
      ctx.radio('yusuf', T('burn.r.ign', 'Ignition. Hold her steady.'));
      ctx.sfx('bang', 0.35, 0.4);
    };
    ctx.onKey = (e) => {
      if (e.code === 'Space') fire();
    };
    ctx.on($('[data-fire]'), 'click', fire);
    ctx.on3D = (so) => {
      if (SMD.three.engine.supported && !SMD.three.engine.supported()) $('[data-earth2d]').hidden = false;
      so.capsule.setFrost(ctx.state.flags.windowHeatersOff ? 0.35 : 0);
      so.capsule.setPower(ctx.state.flags.lightsOff ? 0.2 : 0.5);
    };
    if (!SMD.three || !SMD.three.engine || (SMD.three.engine.supported && !SMD.three.engine.supported())) $('[data-earth2d]').hidden = false;
    return new Promise((resolve) => {
      ctx.debug = {
        sim: s,
        ignite: () => s.phase === 'arm' && (burn.ignite(cfg, s), onIgnite()),
        cut: () => burn.cut(cfg, s),
        autopilot: false,
      };
      ctx.radio('kwame', T('burn.r.start', 'No computer for this one. Lit half of the Earth in the top of the sight, the terminator on the Y–Y line, and hold it there. Ignite when you are steady; shut down by hand at fourteen seconds.'));
      let acc = 0;
      let doneT = 0;
      let wasPhase = s.phase;
      ctx.loop((dt) => {
        let p = ctx.axis(['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW']) - drag.dy;
        let r = ctx.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']) + drag.dx;
        if (ctx.debug.autopilot) {
          // A steady hand (tests): damp the rates, then pull the errors in.
          p = clamp(-(s.pitch * 0.6 + s.pr * 1.2), -1, 1);
          r = clamp(-(s.roll * 0.6 + s.rr * 1.2), -1, 1);
          if (s.phase === 'burn' && s.burnT >= (ctx.debug.cutAt || cfg.burnSeconds)) burn.cut(cfg, s);
        }
        burn.step(cfg, s, { pitch: p, roll: r }, dt);
        if (wasPhase === 'arm' && s.phase === 'burn' && !ctx.debug.ignited) onIgnite();
        if (s.phase === 'burn') ctx.debug.ignited = true;
        wasPhase = s.phase;
        if (ctx.three) {
          ctx.three.handles.setAttitude(-s.pitch, -s.roll);
          ctx.three.handles.setShake(s.phase === 'burn' ? 0.5 : 0);
        }
        // SVG units per degree, so the guide sits on the 3D Earth.
        const svg = $('.sv-coas');
        const fov = ctx.three ? ctx.three.camera.fov : 40;
        const k = svg && svg.clientHeight ? (200 / svg.clientHeight) * ($('[data-stage]').clientHeight / fov) : 7.5;
        const R = 4.5 * k;
        const term = $('[data-term]');
        term.setAttribute('x1', -R);
        term.setAttribute('x2', R);
        $('[data-earth2d]').setAttribute('transform', `scale(${R / 34})`);
        $('[data-earthg]').setAttribute('transform', `translate(0 ${-s.pitch * k}) rotate(${s.roll})`);
        ctx.engine(s.phase === 'burn' ? 0.55 : 0, 0.35);
        acc += dt;
        if (acc > 0.05) {
          acc = 0;
          $('[data-pv]').textContent = unit(s.pitch, '°', 1);
          $('[data-pv]').dataset.tone = Math.abs(s.pitch) < 3 ? 'ok' : Math.abs(s.pitch) < 8 ? 'warn' : 'bad';
          $('[data-rv]').textContent = unit(s.roll, '°', 1);
          $('[data-rv]').dataset.tone = Math.abs(s.roll) < 5 ? 'ok' : Math.abs(s.roll) < 12 ? 'warn' : 'bad';
          const rate = Math.max(Math.abs(s.pr), Math.abs(s.rr));
          const re = $('[data-rate]');
          re.style.inlineSize = clamp(rate / cfg.rateLimit) * 100 + '%';
          re.dataset.tone = rate < 5 ? 'ok' : rate < 8 ? 'warn' : 'bad';
          $('[data-bt]').textContent = num(s.burnT, 1);
          $('[data-gm]').style.insetInlineStart = clamp((s.gamma - 3) / 7) * 100 + '%';
          const ok = s.gamma >= cfg.corridor[0] && s.gamma <= cfg.corridor[1];
          $('[data-gv]').textContent = T('burn.gv', '{g}° · {state}', { g: num(s.gamma, 2), state: ok ? T('burn.in', 'in the corridor') : s.gamma < cfg.corridor[0] ? T('burn.shallow', 'too shallow: skip-out') : T('burn.steep', 'too steep') });
          $('[data-gv]').dataset.tone = ok ? 'ok' : 'bad';
        }
        if (s.phase === 'arm') ctx.clock(T('burn.clock.arm', 'Ignition window closes in {t}', { t: mmss(s.armLeft) }), s.armLeft < 8 ? 'warn' : '');
        else if (s.phase === 'burn') ctx.clock(T('burn.clock.burn', 'Engine firing'), 'warn');
        if (s.phase === 'burn') {
          if (s.burnT >= 10 && !said.ten) {
            said.ten = 1;
            ctx.radio('grace', T('burn.r.ten', 'Ten seconds.'));
          }
          if (Math.abs(s.pitch) > 8 && !said.drift) {
            said.drift = 1;
            ctx.radio('yusuf', T('burn.r.drift', 'She’s drifting! Bring the Earth back to the line.'));
          }
        }
        if (s.phase === 'done') {
          if (!doneT) {
            ctx.engine(0);
            $('[data-fire]').disabled = true;
            if (s.abort) ctx.radio('lena', T('burn.r.abort', 'Rates over ten! Shut it down!'));
            else ctx.radio('kwame', T('burn.r.cut', 'Shutdown at {n} seconds. Stand by for tracking.', { n: num(s.burnT, 1) }));
            if (ctx.three) ctx.three.handles.setShake(0);
          }
          doneT += dt;
          if (doneT > 1.6) {
            resolve(burn.outcome(cfg, s));
            return false;
          }
        }
      });
    });
  }

  // =====================================================================
  // ep4.entry
  // =====================================================================
  function playEntry(ctx) {
    const cfg = ctx.cfg;
    const st = ctx.state;
    const s = entry.create(cfg, st, 5);
    const total = cfg.controlSeconds + cfg.silenceSeconds;
    const rate = cfg.blackoutActual / (total - 3);
    const drag = { on: false, y: 0, dy: 0 };
    const said = {};
    let T0 = 0;
    ctx.$('[data-body]').innerHTML = `
      <div class="sv-entry">
        <section class="sv-panel sv-vtape-wrap">
          <h3>${esc(T('entry.gamma', 'Entry angle'))}</h3>
          <div class="sv-vtape">
            <small class="end top">${esc(T('entry.shallow', 'Shallow: skip out'))}</small>
            <span class="band" style="inset-block-start:${((cfg.corridor[0] - 3) / 8) * 100}%;block-size:${((cfg.corridor[1] - cfg.corridor[0]) / 8) * 100}%"></span>
            <i data-gm></i>
            <small class="end bot">${esc(T('entry.steep', 'Steep: heat and g'))}</small>
          </div>
          <p class="sv-big" data-gv></p>
        </section>
        <section class="sv-panel sv-entry-hud">
          <p class="sv-big" data-g></p>
          <p class="sv-small">${esc(T('entry.gload', 'g-load'))}</p>
          <div class="sv-meter"><span>${esc(T('entry.shield', 'Heat shield'))}</span><i><em data-shield></em></i></div>
          <div class="sv-meter"><span>${esc(T('entry.skip', 'Skip-out risk'))}</span><i><em data-skip></em></i></div>
        </section>
        <div class="sv-pad sv-pad-v" data-pad>
          <button type="button" class="sv-hold wide" data-hold="ArrowUp">${ICON.up}<span>${esc(T('entry.up', 'Lift up: shallower'))}</span></button>
          <button type="button" class="sv-hold wide" data-hold="ArrowDown">${ICON.down}<span>${esc(T('entry.down', 'Lift down: steeper'))}</span></button>
        </div>
      </div>`;
    const $ = ctx.$;
    ctx.captureKeys();
    ctx.bindHold();
    const stage = $('[data-stage]');
    ctx.on(stage, 'pointerdown', (e) => {
      drag.on = true;
      drag.y = e.clientY;
      drag.dy = 0;
    });
    ctx.on(window, 'pointermove', (e) => drag.on && (drag.dy = clamp((e.clientY - drag.y) / 80, -1, 1)));
    ctx.on(window, 'pointerup', () => (drag.on = false));
    ctx.on3D = (so) => {
      so.capsule.setPower(0.55);
    };
    return new Promise((resolve) => {
      ctx.debug = { sim: s, autopilot: false };
      ctx.radio('nadia', T('entry.r.start', 'Entry interface in thirty seconds. You’ll lose us in the blackout. Keep the angle in the corridor: 5.5 to 7.5 degrees. We’ll be waiting.'));
      let acc = 0;
      let endT = 0;
      ctx.loop((dt) => {
        T0 += dt;
        let lift = ctx.axis(['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW']) - drag.dy;
        if (ctx.debug.autopilot) lift = clamp((s.gamma - 6.5) * 1.5 + 0.3, -1, 1);
        if (s.phase === 'control') entry.step(cfg, s, lift, dt);
        else if (s.phase === 'silence') s.t += dt;
        const bell = entry.bell(cfg, Math.min(s.t, cfg.controlSeconds));
        const m = Math.max(0, (T0 - 3) * rate);
        const plasma = s.phase === 'control' ? clamp(T0 / 4) * (0.35 + 0.65 * bell) : Math.max(0, 0.35 - (s.t - cfg.controlSeconds) * 0.03);
        if (ctx.three) {
          ctx.three.handles.setPlasma(plasma);
          ctx.three.handles.setShake(s.phase === 'control' ? s.g / 6 : 0.05);
          cap(ctx).setAlarm(s.shield < 30 || s.skip > 50);
        }
        ctx.engine(s.phase === 'control' ? 0.2 + 0.6 * bell : 0.08, 0.25);
        acc += dt;
        if (acc > 0.05) {
          acc = 0;
          $('[data-gm]').style.insetBlockStart = clamp((s.gamma - 3) / 8) * 100 + '%';
          const ok = s.gamma >= cfg.corridor[0] && s.gamma <= cfg.corridor[1];
          const gv = $('[data-gv]');
          gv.textContent = unit(s.gamma, '°', 2);
          gv.dataset.tone = ok ? 'ok' : 'bad';
          $('[data-g]').textContent = unit(s.phase === 'control' ? s.g : 1, 'g', 1);
          $('[data-g]').dataset.tone = s.g > 8 ? 'bad' : s.g > 6.5 ? 'warn' : '';
          const sh = $('[data-shield]');
          sh.style.inlineSize = clamp(s.shield / 100) * 100 + '%';
          sh.dataset.tone = s.shield > 40 ? 'ok' : s.shield > 20 ? 'warn' : 'bad';
          const sk = $('[data-skip]');
          sk.style.inlineSize = clamp(s.skip / 100) * 100 + '%';
          sk.dataset.tone = s.skip < 35 ? 'ok' : s.skip < 70 ? 'warn' : 'bad';
          ctx.root.classList.toggle('sv-gray', s.g > 8 && !ctx.reduced);
        }
        if (T0 > 3 && s.phase !== 'done') ctx.clock(T('entry.clock', 'Radio blackout {t} · expected {e}', { t: mmss(Math.min(m, cfg.blackoutActual)), e: mmss(cfg.blackoutExpected) }), m > cfg.blackoutExpected ? 'bad' : 'warn');
        else if (s.phase !== 'done') ctx.clock(T('entry.clock.pre', 'Entry interface'));
        if (T0 > 3 && !said.lost) {
          said.lost = 1;
          ctx.radio('yusuf', T('entry.r.lost', 'There’s the glow. We’ve lost Houston.'));
          if (s.damaged) ctx.after(5, () => ctx.radio('grace', T('entry.r.damaged', 'The damaged side is pulling us steep. Watch the angle.')));
        }
        if (s.phase === 'silence' && !said.silence) {
          said.silence = 1;
          $('[data-pad]').hidden = true;
          ctx.radio('lena', T('entry.r.over', 'The worst of the heat is behind us. Now we wait.'));
        }
        if (m >= cfg.blackoutExpected && !said.late) {
          said.late = 1;
          ctx.radio('grace', T('entry.r.late', 'Four and a half minutes. They should hear us by now.'));
        }
        if (m >= cfg.blackoutExpected + 35 && !said.call1 && s.phase === 'silence') {
          said.call1 = 1;
          ctx.radio('nadia', T('entry.r.call', '{you}, Houston, standing by. Over.'));
        }
        if (m >= cfg.blackoutExpected + 65 && !said.call2 && s.phase === 'silence') {
          said.call2 = 1;
          ctx.radio('nadia', T('entry.r.call2', '{you}, Houston. Standing by. Over.'));
        }
        if (s.phase === 'silence' && m >= cfg.blackoutActual) {
          if (!said.home) {
            said.home = 1;
            ctx.radio('you', T('entry.r.home', 'Houston, this is {you}. We hear you.'));
            ctx.after(1.6, () => ctx.radio('nadia', T('entry.r.welcome', 'Welcome home. Drogues, then mains. We see three good chutes.')));
            if (ctx.three) ctx.three.handles.setSky(0.9);
            ctx.engine(0);
          }
          endT += dt;
          if (endT > 3.4) {
            resolve(entry.outcome(cfg, s));
            return false;
          }
        }
        if (s.phase === 'done') {
          if (!said.fail) {
            said.fail = 1;
            ctx.engine(0);
            ctx.sfx('alarm');
            ctx.radio(s.skipped ? 'yusuf' : 'lena', s.skipped ? T('entry.r.skip', 'We’re climbing. We skipped out!') : T('entry.r.burn', 'Temperature spike at the damaged spot! Hold on!'));
          }
          endT += dt;
          if (endT > 1.8) {
            resolve(entry.outcome(cfg, s));
            return false;
          }
        }
      });
    });
  }

  const PLAY = { power: playPower, co2: playCO2, storm: playStorm, burn: playBurn, entry: playEntry };

  // =====================================================================
  // run(): intro card, play, apply, end card
  // =====================================================================
  function run(host, segmentId, state) {
    const k = KEY[segmentId];
    if (!k) return Promise.reject(new Error('survival: unknown segment ' + segmentId));
    ensure(state);
    if (!HAS_DOM || !host) return Promise.resolve(quick(segmentId, state, 'good'));
    const cfg = cfgFor(k, state);
    return new Promise((resolve) => {
      if (api.current && api.current.cancel) api.current.cancel();
      const ctx = makeCtx(host, k, state, cfg);
      let finished = false;
      const cur = {
        id: segmentId,
        ctx,
        get debug() {
          return ctx.debug;
        },
        cancel() {
          if (finished) return;
          finished = true;
          cleanup();
        },
        skip: () => finish(QUICK[k](cfg, state, true), true),
      };
      api.current = cur;
      load3D(ctx, k);
      function cleanup() {
        ctx.stop();
        const eng = SMD.three && SMD.three.engine;
        try {
          if (eng && ctx.three && eng.debug && eng.debug.current === ctx.three) eng.stop();
        } catch (e) {}
        ctx.root.remove();
        if (api.current === cur) api.current = null;
      }
      function finish(o, skipped) {
        if (finished) return;
        finished = true;
        ctx.stop();
        const r = APPLY[k](state, o, cfg);
        const sum = SUMMARY[k](o, cfg, state);
        api.last = { id: segmentId, result: r.result, outcome: o, skipped: !!skipped };
        ctx.sfx('chime', r.result === 'win');
        const so = ctx.three;
        if (so) {
          if (so.handles.controller) so.handles.controller.setEnabled(false);
          if (so.handles.setShake) so.handles.setShake(0);
          so.capsule.setAlarm(false);
        }
        ctx.root.classList.remove('sv-headache', 'sv-headache-still', 'sv-gray');
        ctx.root.classList.add('sv-ended');
        showCard(ctx, endCard(ctx, r.result, sum.lines, sum.why, skipped), () => {
          cleanup();
          resolve({ result: r.result, state });
        });
      }
      ctx.on(ctx.$('[data-skip]'), 'click', () => cur.skip());
      showCard(ctx, introCard(ctx), (act) => {
        hideCard(ctx);
        if (act === 'skip') return cur.skip();
        const h = ctx.$('.sv-title');
        if (h) h.focus({ preventScroll: true });
        ctx.root.classList.add('sv-playing');
        const playing = PLAY[k](ctx);
        // The 3D view may have loaded during the intro card: set it up now.
        if (ctx.three && ctx.on3D) ctx.on3D(ctx.three);
        playing.then((o) => finish(o, false));
      });
    });
  }

  // A story state for dev links and tests, with what earlier episodes set.
  function fixture(segmentId) {
    const s = ensure({ episode: segmentId.slice(0, 3), scene: 'dev', beat: 0, flags: {}, trust: {}, res: {}, health: {}, choices: {}, log: [], done: [] });
    // Episode 2 takes 40% off for the tank rupture just before ep2.power.
    if (segmentId === 'ep2.power') s.res.power = 60;
    if (segmentId === 'ep2.co2') s.flags.heatersLow = true;
    if (segmentId === 'ep4.burn') s.flags.guidanceOff = true;
    if (segmentId === 'ep4.burn') s.flags.youFlew = true;
    if (segmentId === 'ep4.entry') Object.assign(s.flags, { entryAngle: 6.3, corridorOk: true, directEntry: true });
    return s;
  }

  const api = (SMD.storySurvival = {
    run,
    quick,
    SEGMENTS,
    models: { power, co2, storm, burn, entry },
    cfgFor,
    apply: APPLY,
    fixture,
    ensure,
    timeScale: 1,
    current: null,
    last: null,
  });

  // ---------- Dev screen: #dev-survival-<segmentId> ----------
  if (HAS_DOM) {
    const devSeg = () => {
      const m = /^#dev-survival-(ep\d\.\w+)$/.exec(location.hash || '');
      return m && KEY[m[1]] ? m[1] : null;
    };
    SMD.ui = SMD.ui || {};
    SMD.ui.screens = SMD.ui.screens || {};
    SMD.ui.screens.survivaldev = {
      render(app, params) {
        const id = (params && params.seg) || devSeg() || SEGMENTS[0];
        app.innerHTML = '<main class="screen night sv-dev"><div class="sv-dev-host" data-host></div></main>';
        const host = app.querySelector('[data-host]');
        let alive = true;
        const state = fixture(id);
        run(host, id, state).then((r) => {
          if (!alive) return;
          api.lastDev = r;
          host.innerHTML = `<div class="sv-dev-done"><h1>${esc(id)}: ${esc(r.result)}</h1>
            <pre>${esc(JSON.stringify({ res: r.state.res, health: r.state.health, flags: r.state.flags }, null, 2))}</pre>
            <div class="sv-dev-links">${SEGMENTS.map((s) => `<button type="button" class="btn small ${s === id ? 'primary' : 'ghost'}" data-seg="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
          host.querySelectorAll('[data-seg]').forEach((b) =>
            b.addEventListener('click', () => {
              if (location.hash === '#dev-survival-' + b.dataset.seg) SMD.go('survivaldev', { seg: b.dataset.seg });
              else location.hash = '#dev-survival-' + b.dataset.seg;
            })
          );
        });
        return () => {
          alive = false;
          if (api.current) api.current.cancel();
        };
      },
    };
    const route = () => {
      const id = devSeg();
      if (!id || !SMD.go || !SMD.game) return;
      // The router wants a career for every screen: borrow the saved one, or
      // an unsaved throwaway (never written to storage).
      if (!SMD.game.agency) {
        try {
          if (!SMD.game.load()) SMD.game.agency = SMD.agency.newAgency('Dev agency', 1);
        } catch (e) {
          SMD.game.agency = SMD.agency.newAgency('Dev agency', 1);
        }
      }
      SMD.go('survivaldev', { seg: id });
    };
    window.addEventListener('DOMContentLoaded', () => setTimeout(route, 0));
    window.addEventListener('hashchange', route);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
