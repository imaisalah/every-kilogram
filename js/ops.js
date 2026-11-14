// Hidden flaws, tests, cruise events and orbit insertion.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const P = SMD.physics;
  const D = SMD.data;
  const M = SMD.model;
  const { INSTRUMENTS, SUBSYSTEMS, FLAW_TEXT, TESTS, CONST, MISSIONS } = D;

  // Flight texts go through SMD.t when it is loaded (the browser); node tests
  // load this file without it and get the English with {placeholders} filled.
  // A timeline is written once, at launch, in the language of that moment.
  const fill = (e, p) => (p ? String(e).replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : e);
  const tr = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : fill(e, p));
  // English names sit mid-sentence in lower case; Arabic has no case.
  const lower = (s) => (SMD.lang && SMD.lang() === 'ar' ? s : s.toLowerCase());
  const instName = (id) => lower(tr('inst.' + id, INSTRUMENTS[id].name));
  const planetName = (k) => tr('planet.' + k, P.PLANETS[k].name);

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

  // ---------- Hidden flaws ----------
  function generateFlaws(design, base, seed) {
    const key = JSON.stringify([design.instruments, design.arrays, design.rtg, design.dish, design.amp, design.avionics, design.shield, design.capture]);
    const r = rng(seed ^ hash(key));
    const flaws = [];
    Object.entries(base.risk).forEach(([sub, p]) => {
      if (r() < p) flaws.push({ uid: `${sub}`, sub, inst: null, detected: false, fixed: false });
    });
    Object.entries(base.instRisk).forEach(([id, p]) => {
      if (r() < p) flaws.push({ uid: `instrument-${id}`, sub: 'instrument', inst: id, detected: false, fixed: false });
    });
    return flaws;
  }

  function flawLabel(f) {
    const flaw = tr('data.flaw.' + f.sub, FLAW_TEXT[f.sub]);
    const name = f.sub === 'instrument' ? tr('inst.' + f.inst, INSTRUMENTS[f.inst].name) : tr('data.sub.' + f.sub, SUBSYSTEMS[f.sub].name);
    return tr('ops.flawLabel', '{name}: {flaw}', { name, flaw: SMD.lang && SMD.lang() === 'ar' ? flaw : flaw.charAt(0).toLowerCase() + flaw.slice(1) });
  }

  // Each run of a test can find flaws it covers; returns the newly found ones.
  function runTest(flaws, testId, seed, runIndex) {
    const test = TESTS.find((t) => t.id === testId);
    const r = rng(seed + 7919 * (runIndex + 1) + hash(testId));
    const found = [];
    flaws.forEach((f) => {
      if (f.detected) return;
      const p = test.covers[f.sub] || 0;
      if (p && r() < p) {
        f.detected = true;
        f.foundBy = testId;
        found.push(f);
      }
    });
    return found;
  }

  // Which test is most likely to catch a flaw of this kind?
  function bestTestFor(sub) {
    let best = null;
    TESTS.forEach((t) => {
      const p = t.covers[sub] || 0;
      if (p && (!best || p > best.p)) best = { test: t, p };
    });
    return best;
  }

  // ---------- Flight ----------
  const ve = () => CONST.isp * P.G0;
  function burn(fs, dv) {
    const m0 = fs.dry + fs.prop;
    const used = m0 * (1 - Math.exp(-dv / ve()));
    fs.prop = Math.max(0, fs.prop - used);
    return used;
  }
  const dvAvailable = (fs) => ve() * Math.log((fs.dry + fs.prop) / fs.dry);

  function latent(fs, sub) {
    return fs.flaws.filter((f) => f.sub === sub && !f.fixed);
  }

  function newFlight(design, ev, flaws, seed) {
    const L = ev.launch;
    return {
      design,
      ev,
      flaws,
      seed,
      r: rng(seed + 31337),
      prop: L.prop,
      dry: L.dry,
      cost: 0,
      lost: false,
      health: M.defaultHealth(design),
      manifested: [],
      log: [],
      scienceNotes: {},
      orbit: 'planned',
      extraDays: 0,
    };
  }

  function note(fs, turn, text) {
    (fs.scienceNotes[turn] = fs.scienceNotes[turn] || []).push(text);
  }

  function manifest(fs, flaw, text) {
    flaw.manifested = true;
    fs.manifested.push({ flaw, text });
  }

  // Builds the list of cruise events. Each event has an optional set of
  // choices; resolve(choiceId) applies its effects and returns the outcome text.
  function planCruise(fs) {
    const { design, ev } = fs;
    const m = MISSIONS[design.mission];
    const L = ev.launch;
    const r = fs.r;
    const lightAt = (frac) => {
      if (m.kind !== 'planet') return m.kind === 'moon' ? 0.02 : 0;
      const ms = L.launch.departMs + frac * L.launch.tofDays * 864e5;
      const pos = SMD.ops.probePosition(L.launch, ms);
      const e = P.planetState('earth', ms).r;
      return P.lightMinutes(P.norm(P.sub(pos, e)) / P.AU);
    };
    const events = [];

    // Finish the departure burn if the launch left the job short.
    if (fs.shortfallDv > 0.0005) {
      events.push({
        at: 0.005,
        kind: 'departure',
        title: tr('ops.depart.title', 'Finish the departure burn'),
        body: tr('ops.depart.body', 'The upper stage ran out before reaching the planned speed. Your own engine must add {dv} m/s.', { dv: Math.round(fs.shortfallDv * 1000) }),
        dv: fs.shortfallDv,
        resolve(choice, opts) {
          const dv = opts && opts.dv !== undefined ? opts.dv : fs.shortfallDv;
          const used = burn(fs, dv);
          return { tone: 'warn', text: tr('ops.depart.done', 'Burn complete. It cost {kg} kg of the propellant you saved for {planet}.', { kg: Math.round(used), planet: planetName(m.dest) }) };
        },
      });
    }

    // Health check after the launch ride.
    const stress = fs.launchStress || 0;
    const struct = latent(fs, 'structure')[0];
    const structHits = design.instruments.length && ((struct && r() < (stress > 0.5 ? 0.95 : 0.6)) || (!struct && stress > 0.75 && r() < 0.4));
    const struckInst = structHits ? pick(r, design.instruments) : null;
    events.push({
      at: 0.01,
      kind: 'checkout',
      title: tr('ops.checkout.title', 'Health check after launch'),
      body: tr('ops.checkout.body', 'Engineers switch on every instrument one by one.'),
      resolve() {
        if (structHits) {
          fs.health.instQuality[struckInst] *= 0.5;
          const text =
            stress > 0.5
              ? tr('ops.checkout.crack', 'The rough launch cracked a mount. The {inst} is misaligned and now works at half quality.', { inst: instName(struckInst) })
              : tr('ops.checkout.crack2', 'Launch shaking cracked a mount. The {inst} is misaligned and now works at half quality.', { inst: instName(struckInst) });
          if (struct) manifest(fs, struct, text);
          else fs.manifested.push({ flaw: { sub: 'structure', uid: 'stress' }, text });
          return { tone: 'bad', text };
        }
        return { tone: 'ok', text: tr('ops.checkout.ok', 'Every instrument answers. A clean start.') };
      },
    });

    // Deployments
    const dep = latent(fs, 'deploy')[0];
    const depHits = dep && r() < 0.8;
    const parts = [];
    if (design.arrays > 0) parts.push('arrays', 'arrays');
    if (design.dish >= 2) parts.push('dish', 'dish');
    if (design.instruments.includes('mag')) parts.push('boom');
    const depPart = depHits && parts.length ? pick(r, parts) : null;
    const freeRoll = r();
    if (depPart === 'dish') {
      events.push({
        at: 0.03,
        kind: 'deploy',
        part: 'dish',
        title: tr('ops.dish.title', 'The big dish is stuck'),
        body: tr('ops.dish.body', 'Three of its ribs will not unfold. Without it the radio falls back to a small antenna. (Galileo’s dish jammed the same way in 1991.)'),
        choices: [
          { id: 'cycle', label: tr('ops.dish.cycle', 'Warm it up and cool it down, again and again'), detail: tr('ops.dish.cycle.d', 'About 40% chance it frees itself. Takes a month of cruise time.') },
          { id: 'compress', label: tr('ops.dish.compress', 'Give up on it and compress data hard'), detail: tr('ops.dish.compress.d', 'Data rate drops to a quarter. Pictures lose some detail.') },
        ],
        resolve(choice) {
          if (choice === 'cycle' && freeRoll < 0.4) {
            dep.manifested = true;
            fs.manifested.push({ flaw: dep, text: tr('ops.dish.freedFlaw', 'The dish stuck after launch but freed itself after thermal cycling.') });
            return { tone: 'ok', text: tr('ops.dish.freed', 'On the ninth cycle the ribs snap open. Full data rate restored.') };
          }
          if (choice === 'cycle') {
            fs.health.rateFactor *= 0.1;
            manifest(fs, dep, tr('ops.dish.neverFlaw', 'The dish never opened. Data had to squeeze through a small antenna.'));
            return { tone: 'bad', text: tr('ops.dish.jammed', 'The ribs stay jammed. We will talk to Earth through the small antenna: one tenth of the planned data rate.') };
          }
          fs.health.rateFactor *= 0.25;
          ['hires', 'context'].forEach((id) => fs.health.instQuality[id] !== undefined && (fs.health.instQuality[id] *= 0.7));
          manifest(fs, dep, tr('ops.dish.compressFlaw', 'The dish never opened. Heavy data compression saved part of the science.'));
          return { tone: 'warn', text: tr('ops.dish.compressed', 'New compression software is uploaded. A quarter of the planned data rate, slightly softer images.') };
        },
      });
    } else if (depPart) {
      events.push({
        at: 0.03,
        kind: 'deploy',
        part: depPart === 'arrays' ? 'arrayR' : 'mag',
        title: depPart === 'arrays' ? tr('ops.wing.title', 'One solar wing only half open') : tr('ops.boom.title', 'Magnetometer boom jammed'),
        body: depPart === 'arrays' ? tr('ops.wing.body', 'A hinge froze before the wing locked.') : tr('ops.boom.body', 'The boom stopped halfway, too close to the spacecraft’s own magnetic noise.'),
        resolve() {
          if (depPart === 'arrays') {
            fs.health.powerFactor *= 0.7;
            manifest(fs, dep, tr('ops.wing.flaw', 'A solar wing never fully opened: 30% less power for the whole mission.'));
            return { tone: 'bad', text: tr('ops.wing.text', 'We lose 30% of our power for the rest of the mission.') };
          }
          fs.health.instQuality.mag *= 0.4;
          manifest(fs, dep, tr('ops.boom.flaw', 'The magnetometer boom jammed halfway; its readings are noisy.'));
          return { tone: 'bad', text: tr('ops.boom.text', 'The magnetometer still works, but its readings are much noisier.') };
        },
      });
    } else {
      events.push({
        at: 0.03,
        kind: 'deploy',
        title: tr('ops.deploy.title', 'Unfolding'),
        body: tr('ops.deploy.body', 'Solar wings, dish and booms swing open one by one.'),
        resolve: () => ({ tone: 'ok', text: tr('ops.deploy.ok', 'Everything deployed and locked.') }),
      });
    }

    // First course correction
    const prop = latent(fs, 'propulsion')[0];
    const leak = prop && r() < 0.8;
    events.push({
      at: 0.1,
      kind: 'tcm',
      title: m.kind === 'planet' ? tr('ops.tcm.title.planet', 'First course correction') : m.kind === 'moon' ? tr('ops.tcm.title.moon', 'Trim burn on the way to the Moon') : tr('ops.tcm.title.earth', 'Orbit trim burn'),
      body: m.kind === 'planet' ? tr('ops.tcm.body.planet', 'Navigators measured our path with radio tracking. A short burn trims it.') : tr('ops.tcm.body', 'Tracking shows the orbit is slightly off. A short burn trims it.'),
      dv: CONST.tcmDv,
      resolve(choice, opts) {
        const dv = opts && opts.dv !== undefined ? opts.dv : CONST.tcmDv;
        burn(fs, dv);
        const err = opts && opts.error ? opts.error : 0;
        if (err > 0) {
          fs.navError = (fs.navError || 0) + err;
          burn(fs, err / 1000);
        }
        if (leak && fs.prop * 0.2 >= 1) {
          const lost = fs.prop * 0.2;
          fs.prop -= lost;
          manifest(fs, prop, tr('ops.tcm.leakFlaw', 'A valve seal leaked {kg} kg of propellant during cruise.', { kg: Math.round(lost) }));
          return { tone: 'bad', text: tr('ops.tcm.leak', 'The burn works, but pressure keeps dropping afterwards: a leak. We lose {kg} kg of propellant before we can isolate it.', { kg: Math.round(lost) }) };
        }
        if (err > 0.3 * dv * 1000) return { tone: 'warn', text: tr('ops.tcm.sloppy', 'A sloppy burn. The clean-up burn ate extra fuel: {kg} kg of propellant left.', { kg: Math.round(fs.prop) }) };
        return { tone: 'ok', text: tr('ops.tcm.ok', 'Burn complete. {kg} kg of propellant left.', { kg: Math.round(fs.prop) }) };
      },
    });

    // Earth gravity assist
    if (L.launch.route === 'ega') {
      events.push({
        at: 0.32,
        kind: 'ega',
        title: tr('ops.ega.title', 'Earth flyby'),
        body: tr('ops.ega.body', 'We swing past home at 800 km to steal speed from Earth’s orbit. The aim has to be precise.'),
        dv: CONST.egaDsmDv,
        choices: [
          { id: 'track', label: tr('ops.ega.track', 'Pay for extra tracking ($6M)'), detail: tr('ops.ega.track.d', 'Pinpoint aim, no extra fuel.') },
          { id: 'standard', label: tr('ops.ega.standard', 'Standard tracking'), detail: tr('ops.ega.standard.d', 'A small miss costs about 0.04 km/s of fuel to fix.') },
        ],
        resolve(choice, opts) {
          if (opts && opts.dv !== undefined) {
            burn(fs, opts.dv);
            const err = opts.error || 0;
            fs.navError = (fs.navError || 0) + err;
            if (err > 0) burn(fs, err / 1000);
            return err < 5
              ? { tone: 'ok', text: tr('ops.ega.perfect', 'A perfect pass. Earth flings us outward for free.') }
              : { tone: 'warn', text: tr('ops.ega.error', 'A {err} m/s aiming error, fixed with a clean-up burn.', { err: Math.round(err) }) };
          }
          burn(fs, CONST.egaDsmDv);
          if (choice === 'track') {
            fs.cost += 6;
            return { tone: 'ok', text: tr('ops.ega.perfect2', 'A perfect pass. Our speed jumps by several km/s for free.') };
          }
          burn(fs, 0.04);
          return { tone: 'warn', text: tr('ops.ega.miss', 'A tiny miss, corrected with a short burn.') };
        },
      });
    }

    // Solar storm
    if (m.events.includes('solarStorm') && r() < 0.65) {
      const upset = r();
      events.push({
        at: 0.35 + r() * 0.3,
        kind: 'storm',
        title: tr('ops.storm.title', 'Solar storm'),
        body: tr('ops.storm.body', 'A burst of fast particles from the Sun will sweep past us in hours.'),
        choices: [
          { id: 'safe', label: tr('ops.storm.safe', 'Go into safe mode'), detail: tr('ops.storm.safe.d', 'Lose a week of navigation; the next fix costs about 0.03 km/s.') },
          { id: 'ride', label: tr('ops.storm.ride', 'Ride it out'), detail: design.avionics === 'dual' ? tr('ops.storm.ride.dual', 'Small risk: we have a backup computer.') : tr('ops.storm.ride.single', 'Risky with only one computer.') },
        ],
        resolve(choice, opts) {
          if (choice === 'shield') {
            const exposure = Math.max(0, Math.min(1, (opts && opts.exposure) || 0));
            const risk = (design.avionics === 'dual' ? 0.08 : 0.45) * Math.min(1, exposure * 2.2);
            if (upset < risk) {
              fs.health.skipTurns[0] = true;
              note(fs, 0, tr('ops.storm.note', 'Storm damage to the computer memory delayed the start of science.'));
              return { tone: 'bad', text: tr('ops.storm.vaultHit', 'Particles slip past the vault and flip bits in memory. Repairs will delay the start of science by a month.') };
            }
            return exposure < 0.15
              ? { tone: 'ok', text: tr('ops.storm.vaultOk', 'The vault took the hit. Electronics untouched.') }
              : { tone: 'ok', text: tr('ops.storm.someThrough', 'Some particles got through, but nothing broke this time.') };
          }
          if (choice === 'safe') {
            burn(fs, 0.03);
            return { tone: 'ok', text: tr('ops.storm.safeOk', 'Safe mode works. We wake up, re-aim, and burn a little extra fuel.') };
          }
          const risk = design.avionics === 'dual' ? 0.05 : 0.3;
          if (upset < risk) {
            fs.health.skipTurns[0] = true;
            note(fs, 0, tr('ops.storm.note', 'Storm damage to the computer memory delayed the start of science.'));
            return { tone: 'bad', text: tr('ops.storm.bitFlip', 'A particle flips bits in memory. Repairs will delay the start of science by a month.') };
          }
          return { tone: 'ok', text: tr('ops.storm.passes', 'The storm passes. Nothing broke this time.') };
        },
      });
    }

    // Software reset loop
    const av = latent(fs, 'avionics')[0];
    if (av && r() < 0.75) {
      const roll = r();
      const roll2 = r();
      const lm = lightAt(0.55);
      if (design.avionics === 'dual') {
        events.push({
          at: 0.55,
          kind: 'software',
          title: tr('ops.sw.title', 'Computer restarting over and over'),
          body: tr('ops.sw.body.dual', 'A rare timing bug traps the main computer in a reset loop.'),
          resolve() {
            manifest(fs, av, tr('ops.sw.backupFlaw', 'A software bug hit the main computer; the backup took over.'));
            return { tone: 'warn', text: tr('ops.sw.backup', 'The backup computer takes over automatically. We fix the bug and keep flying, with no spare left.') };
          },
        });
      } else {
        events.push({
          at: 0.55,
          kind: 'software',
          title: tr('ops.sw.title', 'Computer restarting over and over'),
          body: tr('ops.sw.body', 'A rare timing bug traps our only computer in a reset loop. Every command takes {min} minutes to arrive.', { min: lm.toFixed(0) }),
          choices: [
            { id: 'patch', label: tr('ops.sw.patch', 'Write and test a software patch'), detail: tr('ops.sw.patch.d', 'Three weeks of careful work. Very likely to work.') },
            { id: 'reboot', label: tr('ops.sw.reboot', 'Send a hard reboot now'), detail: tr('ops.sw.reboot.d', 'Fast and cheap. A gamble.') },
          ],
          resolve(choice) {
            if (choice === 'patch') {
              fs.cost += 4;
              if (roll < 0.9) {
                manifest(fs, av, tr('ops.sw.patchedFlaw', 'A software bug caused a reset loop; a patch fixed it.'));
                return { tone: 'ok', text: tr('ops.sw.patched', 'The patch is uploaded and the loop stops.') };
              }
              fs.health.skipTurns[1] = true;
              manifest(fs, av, tr('ops.sw.patch2Flaw', 'A software bug caused a reset loop and cost a month of science.'));
              return { tone: 'warn', text: tr('ops.sw.patch2', 'The first patch fails; the second works. We lose a month of science.') };
            }
            if (roll < 0.6) {
              manifest(fs, av, tr('ops.sw.rebootOkFlaw', 'A software bug caused a reset loop; a lucky reboot cleared it.'));
              return { tone: 'ok', text: tr('ops.sw.rebootOk', 'The reboot clears it. Lucky.') };
            }
            if (roll2 < 0.5) {
              fs.lost = true;
              manifest(fs, av, tr('ops.sw.lostFlaw', 'A software bug in our only computer ended the mission.'));
              return { tone: 'bad', text: tr('ops.sw.rebootLost', 'The reboot fails mid-sequence. The spacecraft stops answering. Mission lost.') };
            }
            [2, 3, 4].forEach((t) => (fs.health.skipTurns[t] = true));
            manifest(fs, av, tr('ops.sw.loopFlaw', 'A software bug caused a reset loop and cost three months of science.'));
            return { tone: 'bad', text: tr('ops.sw.loop', 'The loop returns. It takes months to recover by hand.') };
          },
        });
      }
    }
    return events.sort((a, b) => a.at - b.at);
  }

  // Aerobraking campaign (Mars and Venus only).
  function planAerobrake(fs) {
    const { design } = fs;
    const m = MISSIONS[design.mission];
    if (!(design.capture === 'aerobrake' && m.aerobrake)) return null;
    const r = fs.r;
    const hasEvent = r() < 0.5;
    const roll = r();
    const what = design.mission === 'mars' ? tr('ops.aero.what.mars', 'A dust storm heats and puffs up the Martian air.') : tr('ops.aero.what.venus', 'Venus’s upper air swells on the day side.');
    if (!hasEvent)
      return {
        title: tr('ops.aero.title', 'Aerobraking'),
        body: tr('ops.aero.body', '{days} days of skimming the upper air to shrink our orbit. {note}', { days: m.aerobrake.days, note: tr('mission.' + design.mission + '.aeroNote', m.aerobrake.note || '') }),
        resolve: () => ({ tone: 'ok', text: tr('ops.aero.ok', 'Hundreds of passes later we are in the science orbit.') }),
      };
    return {
      title: tr('ops.aero.thick.title', 'Aerobraking: the air thickens'),
      body: tr('ops.aero.thick.body', '{what} Our next dip will be deeper and hotter than planned.', { what }),
      choices: [
        { id: 'raise', label: tr('ops.aero.raise', 'Raise the low point and wait'), detail: tr('ops.aero.raise.d', '30 days late and about 0.02 km/s of fuel.') },
        { id: 'keep', label: tr('ops.aero.keep', 'Keep dipping'), detail: tr('ops.aero.keep.d', 'About 30% chance of overheating the solar panels.') },
      ],
      resolve(choice) {
        if (choice === 'raise') {
          burn(fs, 0.02);
          fs.extraDays += 30;
          return { tone: 'ok', text: tr('ops.aero.waited', 'We wait out the storm, then finish aerobraking a month late.') };
        }
        if (roll < 0.3) {
          fs.health.powerFactor *= 0.85;
          return { tone: 'bad', text: tr('ops.aero.scorch', 'A scorching pass: the panels survive but lose 15% of their power.') };
        }
        return { tone: 'ok', text: tr('ops.aero.hot', 'Hot, but within limits. We stay on schedule.') };
      },
    };
  }

  // Orbit insertion outcome after the cruise.
  function insertion(fs) {
    const { design, ev } = fs;
    const m = MISSIONS[design.mission];
    const L = ev.launch;
    const need = L.captureDv;
    const avail = dvAvailable(fs);
    const rest = L.dvTotal - need - CONST.tcmDv - (L.launch.dsmDv || 0); // aerobrake finish + maintenance
    let out;
    if (fs.lost) return { tone: 'bad', text: tr('ops.arrive.nobody', 'There is no one at the controls. The spacecraft drifts past.'), result: 'lost' };
    if (avail >= need) {
      burn(fs, need);
      const left = dvAvailable(fs);
      if (left >= rest) out = { tone: 'ok', text: tr('ops.arrive.orbit', 'Burn complete. We are in orbit around {planet}, with {kg} kg of propellant to spare.', { planet: planetName(m.dest), kg: Math.round(fs.prop) }), result: 'orbit' };
      else {
        const frac = Math.max(0, left / rest);
        const lostTurns = Math.ceil((1 - frac) * 4);
        for (let t = m.turns - lostTurns; t < m.turns; t++) fs.health.skipTurns[t] = true;
        note(fs, m.turns - lostTurns, tr('ops.arrive.dryNote', 'Out of propellant to hold the science orbit.'));
        out = { tone: 'warn', text: tr('ops.arrive.short', 'We made orbit, but the tank is nearly dry. We can hold our orbit for only part of the mission.'), result: 'orbit-short' };
      }
    } else if (avail >= 0.7 * need) {
      fs.prop = 0;
      fs.health.orbitQuality = 0.55;
      fs.orbit = 'high';
      out = { tone: 'warn', text: tr('ops.arrive.high', 'The tank runs dry before the burn ends. We are captured, but into a much higher orbit than planned. Data will be blurrier.'), result: 'high' };
    } else {
      fs.health.orbitQuality = 0.35;
      for (let t = 1; t < m.turns; t++) fs.health.skipTurns[t] = true;
      fs.orbit = 'flyby';
      out = { tone: 'bad', text: tr('ops.arrive.flyby', 'Not enough propellant to be captured. We fly past, taking what data we can in a single pass.'), result: 'flyby' };
    }
    return out;
  }

  // Science-phase consequences of remaining flaws, rolled before science starts.
  function planScience(fs) {
    const { design } = fs;
    const m = MISSIONS[design.mission];
    const r = rng(fs.seed + 4242);
    const h = fs.health;
    const th = latent(fs, 'thermal')[0];
    if (th && r() < 0.7) {
      const t = 2 + Math.floor(r() * 5);
      h.skipTurns[t] = true;
      manifest(fs, th, tr('ops.heater.flaw', 'A heater controller failed; instruments went cold for a month.'));
      note(fs, t, tr('ops.heater.note', 'A heater controller fails. Instruments are off for a month while we work around it.'));
    }
    const pw = latent(fs, 'power')[0];
    if (pw && r() < 0.7) {
      h.powerFactor *= 0.8;
      manifest(fs, pw, tr('ops.power.flaw', 'A power regulator overheated: 20% less power during science.'));
      note(fs, 0, tr('ops.power.note', 'A power regulator runs hot. We lose 20% of our power for the whole science phase.'));
    }
    const cm = latent(fs, 'comms')[0];
    if (cm && r() < 0.7) {
      h.rateFactor *= 0.6;
      manifest(fs, cm, tr('ops.amp.flaw', 'The radio amplifier was weaker than its spec: 40% less data rate.'));
      note(fs, 0, tr('ops.amp.note', 'Our radio amplifier is weaker than its spec sheet. Data rate is 40% lower than planned.'));
    }
    fs.flaws
      .filter((f) => f.sub === 'instrument' && !f.fixed)
      .forEach((f) => {
        if (r() < 0.75) {
          const t = 1 + Math.floor(r() * 8);
          h.dead[f.inst] = t;
          manifest(fs, f, tr('ops.inst.failFlaw', 'The {inst} failed in month {month} of science.', { inst: instName(f.inst), month: t * Math.round(m.turnDays / 30) }));
          note(fs, t, tr('ops.inst.failNote', 'The {inst} stops responding. A wiring fault.', { inst: instName(f.inst) }));
        }
      });
    const rad = latent(fs, 'radiation')[0];
    if (m.radiation) {
      const perTurn = rad ? 0.18 : 0.02;
      for (let t = 4; t < m.turns; t++) {
        const alive = design.instruments.filter((id) => h.dead[id] === undefined);
        if (alive.length && r() < perTurn) {
          const id = pick(r, alive);
          h.dead[id] = t;
          note(fs, t, tr('ops.rad.killNote', "Radiation kills the {inst}'s electronics.", { inst: instName(id) }));
          if (rad && !rad.manifested) manifest(fs, rad, tr('ops.rad.flaw', 'Radiation-sensitive chips failed inside Jupiter’s belts.'));
        }
      }
    } else if (rad && r() < 0.5 && design.instruments.length) {
      const id = pick(r, design.instruments);
      h.instQuality[id] *= 0.7;
      manifest(fs, rad, tr('ops.ray.flaw', "A cosmic ray damaged the {inst}'s detector.", { inst: instName(id) }));
      note(fs, 3, tr('ops.ray.note', "A cosmic ray damages the {inst}'s detector. Its data is noisier from now on.", { inst: instName(id) }));
    }
    if (design.mission === 'mars' && r() < 0.55) {
      const t = 3 + Math.floor(r() * 6);
      [t, t + 1].forEach((k) => {
        if (k >= m.turns) return;
        h.turnQuality[k] = { hires: 0.25, context: 0.25, irspec: 0.5 };
      });
      note(fs, t, tr('ops.dust.note', 'A global dust storm hides the surface. Pictures taken now are nearly useless; radar sees straight through.'));
    }
  }

  // Spacecraft path during cruise. A gravity-assist route first flies a
  // two-year loop that returns to Earth (like Juno), then heads out.
  function probePath(launch) {
    const dest = MISSIONS[launch.mission].dest;
    if (MISSIONS[launch.mission].kind !== 'planet') return { at: (ms) => P.planetState('earth', ms).r };
    if (launch.route === 'ega') {
      const loopDays = 730.5;
      const flyMs = launch.departMs + loopDays * 864e5;
      const e0 = P.planetState('earth', launch.departMs);
      const a = Math.pow(2, 2 / 3) * P.AU;
      const r = P.norm(e0.r);
      const vp = Math.sqrt(P.MU_SUN * (2 / r - 1 / a));
      const ve0 = P.norm(e0.v);
      const loop = { r1: e0.r, v1: [(e0.v[0] / ve0) * vp, (e0.v[1] / ve0) * vp], tofDays: loopDays, r2: e0.r };
      const leg = P.transfer(dest, flyMs, (launch.arriveMs - flyMs) / 864e5);
      return {
        flybyMs: flyMs,
        at: (ms) => (ms < flyMs || !leg ? P.transferPosition(loop, (ms - launch.departMs) / 1000) : P.transferPosition(leg, (ms - flyMs) / 1000)),
      };
    }
    const tr = P.transfer(dest, launch.departMs, launch.tofDays);
    return { at: (ms) => P.transferPosition(tr, Math.max(0, (ms - launch.departMs) / 1000)) };
  }

  function probePosition(launch, ms) {
    if (!launch._path) Object.defineProperty(launch, '_path', { value: probePath(launch), enumerable: false });
    return launch._path.at(ms);
  }

  // ---------- Crewed flight (Artemis II–like free return) ----------
  // Everything that will happen is decided at launch from the design, the
  // hidden flaws and the seed, and written to score.crew (which survives a
  // save). The ride screen plays it; the crew's own work during the ride
  // (photos, fixing the air system) can only raise the parts it touches, via
  // crewApplyRide. Default decisions (the "skip" path) are the flight team's.
  const DAYMS = 864e5;
  const AUTO_PHOTOS = 0.7; // share of far-side targets the crew gets without the player
  function crewFractions(c, perf) {
    const P2 = perf || {};
    if (c.outcome === 'lost') return { home: 0, photos: 0, life: 0 };
    if (c.outcome === 'aborted') return { home: 0.7, photos: 0, life: 0 };
    let home = 1;
    if (c.spe.hits && c.spe.dose === 'high') home *= 0.75;
    if (c.entry.burn === 'scorched') home *= 0.8;
    if (c.life.emergency) home *= 0.8;
    const hit = P2.photos !== undefined ? P2.photos : AUTO_PHOTOS;
    const photos = c.photos.cam * c.photos.factor * (0.5 + 0.5 * hit);
    let life = 1;
    if (c.life.fails) life = c.life.emergency ? 0.3 : P2.scrubber ? 0.9 : 0.75;
    if (c.cold) life *= 0.85;
    if (c.lowPower) life *= 0.8;
    return { home, photos, life };
  }

  function crewFlight(design, ev, flaws, seed, opts = {}) {
    const C = D.CREW;
    const fs = newFlight(design, ev, flaws, seed);
    if (opts.instQuality) Object.entries(opts.instQuality).forEach(([id, f]) => fs.health.instQuality[id] !== undefined && (fs.health.instQuality[id] *= f));
    const r = fs.r;
    // Every roll is drawn up front, in a fixed order, so a what-if (another
    // design, or one flaw fixed) flies with exactly the same luck.
    const roll = { asc: r(), leak: r(), life: r(), cold: r(), spe: r(), speDay: r(), av: r(), char: r(), chute: r() };
    const base = ev.base;
    const cf = base.crew;
    const L = ev.launch.launch;
    const t0 = L.departMs;
    const at = (days) => t0 + days * DAYMS;
    const timeline = [];
    const push = (kind, days, title, tone, text) => timeline.push({ kind, ms: at(days), title, tone, text });
    const crew = {
      v: 1,
      outcome: 'safe',
      lostAt: null,
      las: cf.abort,
      ascent: { fails: false, at: 128 },
      tli: { dv: Math.round(C.dv.tli * 1000), leak: false, leakKg: 0, steep: false },
      life: { fails: false, days: cf.lifeDays, effDays: cf.lifeDays, need: cf.lifeNeed, emergency: false },
      cold: false,
      lowPower: base.powerMargin < 1,
      spe: { hits: false, day: 0, shelter: cf.shelter, dose: 'low' },
      avionics: { fails: false, dual: design.avionics === 'dual' },
      photos: { cam: M.crewCamera(design, fs.health.instQuality), factor: opts.scienceBoost || 1 },
      entry: { profile: cf.entry, shieldKg: cf.heatShield, ratio: 0, charLoss: false, steep: false, peakG: 0, burn: 'ok' },
      chutes: { failed: 0 },
      splashMs: at(C.missionDays),
      played: false,
    };
    const finish = () => {
      const fr = crewFractions(crew, null);
      const score = M.crewScore(fr.home, fr.photos, fr.life);
      score.crew = crew;
      fs.lost = crew.outcome === 'lost';
      fs.insertion = { result: crew.outcome, tone: crew.outcome === 'safe' ? 'ok' : crew.outcome === 'lost' ? 'bad' : 'warn', text: '' };
      fs.scienceEndMs = crew.outcome === 'safe' || crew.outcome === 'close' ? crew.splashMs : t0;
      timeline.sort((a, b) => a.ms - b.ms);
      return { fs, sci: null, score, timeline };
    };

    // 1. The climb. A bent separation sensor makes a booster hit the core stage
    // as it leaves (Soyuz MS-10, 2018), if no test caught it.
    const asc = latent(fs, 'ascent')[0];
    if (asc && roll.asc < 0.75) {
      crew.ascent.fails = true;
      if (cf.abort) {
        crew.outcome = 'aborted';
        manifest(fs, asc, tr('crew.f.abortFlaw', 'A booster hit the core stage as it separated; the abort tower pulled the crew to safety.'));
        push('departure', 0, tr('crew.f.abort.title', 'Launch abort'), 'warn', tr('crew.f.abort.text', 'At booster separation, 2 minutes 8 seconds after liftoff, one booster swung into the core stage. The abort motor pulled the capsule clear and it splashed down under parachutes. The crew is safe; the mission is over.'));
      } else {
        crew.outcome = 'lost';
        crew.lostAt = 'ascent';
        manifest(fs, asc, tr('crew.f.lostFlaw', 'A booster hit the core stage as it separated, and there was no abort tower to save the crew.'));
        push('departure', 0, tr('crew.f.lost.title', 'Rocket failure'), 'bad', tr('crew.f.lost.text', 'At booster separation, one booster swung into the core stage and the rocket broke up. Without an abort tower the crew had no way out.'));
      }
      return finish();
    }
    push('departure', 0.006, tr('crew.f.orbit.title', 'In orbit'), 'ok', tr('crew.f.orbit.text', 'Boosters gone at 2 min 8 s, abort tower at 3 min 18 s, core stage at about 8 minutes. The crew is in orbit.'));

    // 2. Leaving Earth: the service module's engine does the translunar burn.
    burn(fs, C.dv.perigee);
    const err = opts.tliError || 0;
    burn(fs, C.dv.tli + err / 1000);
    const pr = latent(fs, 'propulsion')[0];
    if (pr && roll.leak < 0.8) {
      const lost = fs.prop * 0.6;
      fs.prop -= lost;
      crew.tli.leak = true;
      crew.tli.leakKg = Math.round(lost);
      manifest(fs, pr, tr('crew.f.leakFlaw', 'A propellant valve leaked {kg} kg after the burn to the Moon.', { kg: Math.round(lost) }));
    }
    const dvLeft = dvAvailable(fs);
    crew.tli.dvLeft = Math.round(dvLeft * 1000);
    // After a leak the path home needs extra trims (the leak itself pushed the capsule off course).
    if (dvLeft < (crew.tli.leak ? C.dv.leakNeed : C.dv.tcm)) crew.tli.steep = true;
    burn(fs, Math.min(dvLeft * 0.95, C.dv.tcm));
    crew.tli.propLeft = Math.round(fs.prop);
    push('tcm', 1.1, tr('crew.f.tli.title', 'Burn to the Moon'), crew.tli.leak ? 'warn' : 'ok',
      crew.tli.leak
        ? crew.tli.steep
          ? tr('crew.f.tli.steep', 'The burn added 388 m/s, then a valve leaked {kg} kg of propellant. Too little is left to fine-tune the way home: the entry will be steeper.', { kg: crew.tli.leakKg })
          : tr('crew.f.tli.leak', 'The burn added 388 m/s, then a valve leaked {kg} kg of propellant. The fuel margin covered it.', { kg: crew.tli.leakKg })
        : tr('crew.f.tli.ok', 'Six minutes of burn added 388 m/s. The capsule is on a free-return path around the Moon.'));

    // 3. Air and water. A stuck valve eats into the spare days.
    const ls = latent(fs, 'lifeSupport')[0];
    if (ls && roll.life < 0.85) {
      crew.life.fails = true;
      crew.life.effDays = Math.round(cf.lifeDays * 0.55 * 10) / 10;
      crew.life.emergency = crew.life.effDays < cf.lifeNeed;
      manifest(fs, ls, crew.life.emergency ? tr('crew.f.lifeEmFlaw', 'The air system failed and the crew ran short of spare days.') : tr('crew.f.lifeFlaw', 'A valve in the air and water system stuck; the spare days covered it.'));
      push('software', 2.6, tr('crew.f.life.title', 'Air system fault'), crew.life.emergency ? 'bad' : 'warn',
        crew.life.emergency
          ? tr('crew.f.life.em', 'A valve sticks and the carbon dioxide scrubber falls behind. Only {d} days of clean air are left for a 9-day trip: the crew lives in their suits for the way home, like the Apollo 13 crew improvised.', { d: crew.life.effDays })
          : tr('crew.f.life.fix', 'A valve sticks and the carbon dioxide scrubber falls behind. The crew swaps to the backup loop; {d} days of air are still enough.', { d: crew.life.effDays }));
    }
    const th = latent(fs, 'thermal')[0] || latent(fs, 'power')[0];
    if (th && roll.cold < 0.6) {
      crew.cold = true;
      manifest(fs, th, tr('crew.f.coldFlaw', 'A heater fault made the cabin cold for days.'));
      push('software', 3.4, tr('crew.f.cold.title', 'A cold cabin'), 'warn', tr('crew.f.cold.text', 'A heater controller fails. The cabin drops to 12 °C; the crew wears every layer they brought.'));
    }

    // 4. The Sun. Strong particle events are rare but real near solar maximum.
    if (roll.spe < C.speChance) {
      crew.spe.hits = true;
      crew.spe.day = Math.round((2 + roll.speDay * 4) * 10) / 10;
      crew.spe.dose = cf.shelter ? 'low' : 'high';
      push('storm', crew.spe.day, tr('crew.f.spe.title', 'Solar storm'), cf.shelter ? 'ok' : 'bad',
        cf.shelter
          ? tr('crew.f.spe.ok', 'A burst of fast protons from the Sun. The crew builds the shelter in under an hour and waits it out behind {kg} kg of supplies.', { kg: cf.shelter })
          : tr('crew.f.spe.bad', 'A burst of fast protons from the Sun, and no shelter planned. The crew huddles in the most shielded corner, but takes a heavy dose.'));
    }

    // 5. The flyby: the far side, 6,545 km below.
    const av = latent(fs, 'avionics')[0];
    if (av && roll.av < 0.7) {
      crew.avionics.fails = true;
      if (!crew.avionics.dual) crew.photos.factor *= 0.4;
      manifest(fs, av, crew.avionics.dual ? tr('crew.f.avDualFlaw', 'A flight computer reset behind the Moon; the backup took over.') : tr('crew.f.avFlaw', 'The only flight computer reset behind the Moon and the crew lost the photo window.'));
    }
    push('arrival', 5.1, tr('crew.f.flyby.title', 'Around the far side'), crew.avionics.fails && !crew.avionics.dual ? 'warn' : 'ok',
      crew.avionics.fails && !crew.avionics.dual
        ? tr('crew.f.flyby.reset', 'Behind the Moon, out of radio contact, the only flight computer resets. By the time it is back the best views are gone.')
        : tr('crew.f.flyby.ok', '6,545 km above the far side, 406,771 km from home: the farthest humans have ever been. The crew photographs craters no human eye had seen.'));

    // 6. Home through the air at 11 km/s.
    const hs = latent(fs, 'heatShield')[0];
    crew.entry.charLoss = !!(hs && roll.char < 0.9);
    crew.entry.steep = crew.tli.steep;
    crew.entry.ratio = M.shieldRatio(cf, { charLoss: crew.entry.charLoss, steep: crew.entry.steep });
    crew.entry.peakG = Math.round(((cf.entry === 'skip' ? 4.1 : 6.3) + (crew.entry.steep ? 0.9 : 0)) * 10) / 10;
    crew.entry.burn = crew.entry.ratio >= 1 ? 'ok' : crew.entry.ratio >= 0.8 ? 'scorched' : 'through';
    if (crew.entry.charLoss) manifest(fs, hs, tr('crew.f.charFlaw', 'The heat shield shed chunks of char during entry, like Artemis I.'));
    const eDay = C.missionDays - 0.02;
    if (crew.entry.burn === 'through') {
      crew.outcome = 'lost';
      crew.lostAt = 'entry';
      push('aerobrake', eDay, tr('crew.f.entry.title', 'Entry'), 'bad', tr('crew.f.entry.lost', 'The heat shield wears through. The capsule breaks up in the plasma.'));
      return finish();
    }
    push('aerobrake', eDay, tr('crew.f.entry.title', 'Entry'), crew.entry.burn === 'ok' ? 'ok' : 'warn',
      crew.entry.burn === 'ok'
        ? crew.entry.charLoss
          ? tr('crew.f.entry.char', 'Chunks of char break off the heat shield, but it holds. Peak {g} g.', { g: crew.entry.peakG })
          : tr('crew.f.entry.ok', 'Mach 33 into the air. Plasma glows around the windows for six minutes of radio silence. Peak {g} g.', { g: crew.entry.peakG })
        : tr('crew.f.entry.scorch', 'The heat shield is eaten almost to the structure. The crew survives, but engineers will study this shield for years.'));
    const dep = latent(fs, 'deploy')[0];
    if (dep && roll.chute < 0.7) {
      crew.chutes.failed = 1;
      manifest(fs, dep, tr('crew.f.chuteFlaw', 'One of the three main parachutes did not open.'));
    }
    if (crew.entry.burn === 'scorched' || crew.life.emergency || (crew.spe.hits && crew.spe.dose === 'high')) crew.outcome = 'close';
    push('science', C.missionDays, tr('crew.f.splash.title', 'Splashdown'), crew.outcome === 'safe' ? 'ok' : 'warn',
      crew.chutes.failed
        ? tr('crew.f.splash.two', 'One main parachute stays furled, but two are enough (Apollo 15 landed the same way). Splashdown in the Pacific, 9 days after launch.')
        : tr('crew.f.splash.ok', 'Three main parachutes, splashdown in the Pacific at about 30 km/h, 9 days and 1 hour after launch. Divers open the hatch.'));
    return finish();
  }

  // The crew's own work during the ride: { photos: 0..1 share of targets
  // snapped, scrubber: true when they fixed the air system, abortedBy: 'crew' }.
  // Only raises what the crew touched, before the mission completes.
  function crewApplyRide(p, perf) {
    if (!p || !p.flight || !p.flight.score || !p.flight.score.crew || p.result) return false;
    const c = p.flight.score.crew;
    if (c.played) return false;
    const auto = crewFractions(c, null);
    const mine = crewFractions(c, perf);
    const best = { home: auto.home, photos: Math.max(auto.photos, mine.photos), life: Math.max(auto.life, mine.life) };
    const score = M.crewScore(best.home, best.photos, best.life);
    score.crew = Object.assign(c, { played: true, perf: perf || {} });
    p.flight.score = score;
    return true;
  }

  // Fly a whole mission with the flight team's default decisions. Returns the
  // flight state, a timeline of what happened and the science result.
  function autoFlight(design, ev, flaws, seed, opts = {}) {
    const m = MISSIONS[design.mission];
    if (m.kind === 'crew') return crewFlight(design, ev, flaws, seed, opts);
    const fs = newFlight(design, ev, flaws, seed);
    // Lasting effects from development events and review decisions.
    if (opts.instQuality) Object.entries(opts.instQuality).forEach(([id, f]) => fs.health.instQuality[id] !== undefined && (fs.health.instQuality[id] *= f));
    if (opts.scienceBoost) fs.health.orbitQuality *= opts.scienceBoost;
    fs.launchStress = opts.launchStress || 0.2;
    fs.shortfallDv = 0;
    const timeline = [];
    const L = ev.launch.launch;
    const atMs = (frac) => L.departMs + frac * (L.arriveMs - L.departMs);
    for (const e of planCruise(fs)) {
      let out;
      if (e.kind === 'storm') out = e.resolve('shield', { exposure: design.shield > 0 ? 0.05 : 0.45 });
      else if (e.choices) {
        const pickId = { deploy: 'compress', software: 'patch', ega: 'standard' }[e.kind] || e.choices[0].id;
        out = e.resolve(pickId);
      } else out = e.resolve();
      timeline.push({ kind: e.kind, ms: atMs(e.at), title: e.title, part: e.part, ...out });
      if (fs.lost) break;
    }
    if (!fs.lost) {
      fs.insertion = m.kind === 'earth' ? { result: 'orbit', tone: 'ok', text: tr('ops.earth.released', 'Released straight into its orbit by the rocket.') } : insertion(fs);
      timeline.push({ kind: 'arrival', ms: L.arriveMs, title: m.kind === 'earth' ? tr('ops.arrival.inOrbit', 'In orbit') : tr('ops.arrival.at', 'Arrival at {planet}', { planet: planetName(m.dest) }), tone: fs.insertion.tone, text: fs.insertion.text });
      if (fs.insertion.result === 'lost') fs.lost = true;
    }
    if (!fs.lost && (fs.insertion.result === 'orbit' || fs.insertion.result === 'orbit-short')) {
      const ab = planAerobrake(fs);
      if (ab) {
        const out = ab.resolve(ab.choices ? 'raise' : undefined);
        timeline.push({ kind: 'aerobrake', ms: L.arriveMs + 30 * 864e5, title: ab.title, ...out });
      }
    }
    let sci = null;
    if (!fs.lost) {
      planScience(fs);
      const start = ev.launch.scienceStartMs + (fs.extraDays || 0) * 864e5;
      sci = M.runScienceAuto(design, ev.base, start, fs.health);
      Object.keys(fs.scienceNotes).forEach((t) => {
        fs.scienceNotes[t].forEach((text) => timeline.push({ kind: 'science', ms: start + Number(t) * m.turnDays * 864e5, title: tr('ops.science.title', 'During science'), tone: 'warn', text }));
      });
      fs.scienceEndMs = start + m.turns * m.turnDays * 864e5;
    }
    timeline.sort((a, b) => a.ms - b.ms);
    const score = sci ? sci.score : { total: 0, fractions: Object.fromEntries(m.objectives.map((o) => [o.id, 0])), keyFrac: 0, headline: false };
    return { fs, sci, score, timeline };
  }

  SMD.ops = {
    autoFlight,
    crewFlight,
    crewApplyRide,
    crewFractions,
    rng,
    hash,
    generateFlaws,
    flawLabel,
    runTest,
    bestTestFor,
    newFlight,
    planCruise,
    planAerobrake,
    insertion,
    planScience,
    probePosition,
    dvAvailable,
    burn,
  };
  if (typeof module === 'object' && module.exports) module.exports = SMD.ops;
})();
