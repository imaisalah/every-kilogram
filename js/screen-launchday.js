// Launch day: the player is the launch director.
//  1. Walkdown: the astronaut walks around the rocket on the pad and inspects
//     four hot spots (remove-before-flight tags, a frosty valve, the spacecraft
//     umbilical, an open service hatch). The umbilical brings the spacecraft's
//     telemetry back: a hidden flaw can show up there as one bad reading.
//  2. Go/No-Go poll in the firing room: Range, Weather (real launch commit
//     criteria), Propulsion, Guidance and the spacecraft team report. Go, hold,
//     scrub, or break a weather rule and fly a riskier ride.
//  3. The final count, then the launch film (or the crew ride).
// Everything is seeded from the project, so a replay meets the same day.
// The decisions reach the mission through SMD.agency.launchDay(), which flies
// the mission again with them. "Decide for me" plays the whole day by the book.
// Params: { projectId, next: 'film' (default) | 'hq' }.
//
// Real practice behind it:
//  - Lightning launch commit criteria (Eastern Range, used by NASA and the 45th
//    Weather Squadron): no launch for 30 minutes after lightning within 10 NM of
//    the flight path; never through or within 10 NM of an attached anvil cloud.
//    Apollo 12 was struck twice in 1969; Atlas-Centaur 67 was destroyed by
//    triggered lightning in 1987.
//  - Upper-level winds are measured by weather balloons before launch; strong
//    wind shear loads the rocket and scrubs launches. Ground winds have peak
//    limits for the rocket on the pad.
//  - Remove-before-flight streamers mark ground-only pins and covers; foreign
//    object debris (FOD) walkdowns sweep the pad deck before launch.
//  - A loose boat in the hazard area "fouls the range" and holds the count.
//  - Artemis I's second attempt (3 Sep 2022) was scrubbed by a hydrogen leak
//    at a quick-disconnect; frost on a cryogenic tank alone is normal.
//  - The launch director's Go/No-Go poll during a built-in hold, then the
//    terminal count; the rocket's computers take over in the last half minute.
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const { esc } = ui;
  const t = (k, e, p) => SMD.t(k, e, p);
  const A = () => SMD.agency;
  const D = () => SMD.data;
  const reduced = () => {
    try {
      return matchMedia('(prefers-reduced-motion: reduce)').matches || !!(SMD.settings && SMD.settings.reducedMotion);
    } catch (e) {
      return false;
    }
  };
  const rngOf = (seed) => SMD.ops.rng(seed >>> 0);

  // ---------- The day's plan, all seeded from the project ----------
  const SPOTS = ['rbf', 'valve', 'umbilical', 'hatch'];
  const SPOT_NAME = {
    rbf: () => t('ld.spot.rbf', 'Remove-before-flight tags'),
    valve: () => t('ld.spot.valve', 'Frosty oxygen valve'),
    umbilical: () => t('ld.spot.umbilical', 'Spacecraft umbilical'),
    hatch: () => t('ld.spot.hatch', 'Open service hatch'),
  };
  const STATION_NAME = {
    range: () => t('ld.st.range', 'Range'),
    weather: () => t('ld.st.weather', 'Weather'),
    propulsion: () => t('ld.st.propulsion', 'Propulsion'),
    guidance: () => t('ld.st.guidance', 'Guidance'),
    spacecraft: () => t('ld.st.spacecraft', 'Spacecraft'),
  };
  const STATIONS = ['range', 'weather', 'propulsion', 'guidance', 'spacecraft'];
  const GROUND_LIMIT = 30; // knots, peak, rocket on the pad
  const LIGHTNING_WAIT = 30; // minutes after lightning within 10 NM

  // Spacecraft readings through the umbilical. A hidden flaw of one of these
  // kinds shows as one reading outside its limit.
  const READINGS = {
    propulsion: { label: () => t('ld.tm.prop', 'Propellant tank pressure, change per hour'), limit: () => t('ld.tm.prop.lim', 'within ±2 kPa'), ok: (r) => `${r() < 0.5 ? '−' : '+'}${(0.2 + r() * 0.9).toFixed(1)} kPa`, bad: (r) => `−${(5 + r() * 3).toFixed(1)} kPa` },
    power: { label: () => t('ld.tm.power', 'Battery charge regulator temperature'), limit: () => t('ld.tm.power.lim', 'below 40 °C'), ok: (r) => `${Math.round(24 + r() * 9)} °C`, bad: (r) => `${Math.round(49 + r() * 7)} °C` },
    thermal: { label: () => t('ld.tm.thermal', 'Heater current, instrument deck'), limit: () => t('ld.tm.thermal.lim', '1.6 to 2.4 A'), ok: (r) => `${(1.8 + r() * 0.4).toFixed(1)} A`, bad: (r) => `${(0.2 + r() * 0.3).toFixed(1)} A` },
    comms: { label: () => t('ld.tm.comms', 'Radio signal, compared with testing'), limit: () => t('ld.tm.comms.lim', 'within 2 dB'), ok: (r) => `−${(0.2 + r() * 1.1).toFixed(1)} dB`, bad: (r) => `−${(4.2 + r() * 1.6).toFixed(1)} dB` },
    avionics: { label: () => t('ld.tm.avionics', 'Computer restarts since last night'), limit: () => t('ld.tm.avionics.lim', '0'), ok: () => '0', bad: (r) => String(2 + Math.floor(r() * 2)) },
    instrument: { label: (f) => t('ld.tm.inst', '{inst} self-test channels', { inst: instName(f && f.inst) }), limit: () => t('ld.tm.inst.lim', 'all 64'), ok: () => '64 / 64', bad: (r) => `${60 + Math.floor(r() * 3)} / 64` },
  };
  const instName = (id) => (id && D().INSTRUMENTS[id] ? t('inst.' + id, D().INSTRUMENTS[id].name) : t('ld.tm.inst.any', 'Instrument'));
  const subName = (f) => (f.sub === 'instrument' && f.inst ? instName(f.inst) : t('data.sub.' + f.sub, D().SUBSYSTEMS[f.sub] ? D().SUBSYSTEMS[f.sub].name : f.sub));

  // The one hidden flaw that can show up at the pad (if any).
  function padClue(p) {
    return (p.flaws || []).find((f) => !f.detected && !f.fixed && READINGS[f.sub] && (f.sub !== 'instrument' || f.inst)) || null;
  }

  function telemetry(p, clue) {
    const r = rngOf(p.seed + 4471);
    const kinds = Object.keys(READINGS).filter((k) => k !== 'instrument' || p.design.instruments.length);
    const pickInst = { sub: 'instrument', inst: p.design.instruments[0] };
    const rows = [];
    if (clue) rows.push({ sub: clue.sub, flaw: clue, label: READINGS[clue.sub].label(clue), limit: READINGS[clue.sub].limit(), value: READINGS[clue.sub].bad(r), bad: true });
    const rest = kinds.filter((k) => !clue || k !== clue.sub);
    while (rows.length < 4 && rest.length) {
      const k = rest.splice(Math.floor(r() * rest.length) % rest.length, 1)[0];
      rows.push({ sub: k, label: READINGS[k].label(pickInst), limit: READINGS[k].limit(), value: READINGS[k].ok(r), bad: false });
    }
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    // Readings like "55 °C" stay left to right inside Arabic text.
    rows.forEach((row) => (row.value = '\u2066' + row.value + '\u2069'));
    return rows;
  }

  // Today's weather and range at the start of the window. Attempt 4 and later
  // get a calm day (the forecast team finds a clean morning).
  function weatherFor(p, day) {
    const r = rngOf(p.seed * 31 + 7717 * (day + 1));
    const calm = day >= 3;
    return {
      ground: Math.round(calm ? 8 + r() * 10 : 6 + r() * 27 + (r() < 0.16 ? 9 : 0)),
      upper: Math.round(calm ? 48 + r() * 30 : 42 + r() * 52 + (r() < 0.2 ? 34 : 0)),
      lightning: !calm && r() < 0.26 ? Math.round(4 + r() * 20) : null,
      anvil: !calm && r() < 0.2,
      boat: !calm && r() < 0.25,
      align: !calm && r() < 0.15,
    };
  }

  const windowMin = (m) => ({ earth: 30, moon: 45, planet: 60, crew: 30 })[m.kind] || 45;

  // ---------- Station reports ----------
  function stationsFor(S) {
    const wx = S.wx;
    const out = [];
    const st = (id, status, line, extra = {}) => out.push({ id, status, line, ...extra });
    if (!S.ok.rbf) st('range', 'hold', t('ld.r.range.rbf', 'Hold. The flight termination system reads SAFE: a remove-before-flight pin is still in. A pad crew is going back out.'), { hold: 30, crew: 'rbf' });
    else if (wx.boat) st('range', 'hold', t('ld.r.range.boat', 'Hold. A boat is inside the hazard area. The Coast Guard is escorting it out.'), { hold: 15 });
    else st('range', 'go', t('ld.r.range.go', 'Go. The range is clear and the tracking radars are up.'));

    const rules = weatherRules(S);
    const bad = rules.filter((x) => !x.ok);
    if (!bad.length) st('weather', 'go', t('ld.r.wx.go', 'Go. Every weather rule is met.'), { rules });
    else {
      const holdable = bad.every((x) => x.id !== 'upper');
      let hold = 0;
      if (holdable)
        bad.forEach((x) => {
          if (x.id === 'lightning') hold = Math.max(hold, Math.ceil((LIGHTNING_WAIT - wx.lightning) / 5) * 5);
          else hold = Math.max(hold, 15);
        });
      st('weather', 'nogo', bad.length === 1 ? t('ld.r.wx.one', 'No-Go. We are breaking the rule for {rule}.', { rule: bad[0].name }) : t('ld.r.wx.many', 'No-Go. We are breaking {n} weather rules.', { n: bad.length }), { rules, hold, soft: true, upperOnly: !holdable });
    }

    if (S.leak && !S.ok.valve) st('propulsion', 'nogo', t('ld.r.prop.leak', 'No-Go. The oxygen fill valve is leaking faster than its limit. We cannot fix it inside this window.'), { scrubOnly: true });
    else if (!S.ok.hatch) st('propulsion', 'hold', t('ld.r.prop.hatch', 'Hold. A service hatch shows open on the pad cameras. A crew is going out to close it.'), { hold: 20, crew: 'hatch' });
    else st('propulsion', 'go', t('ld.r.prop.go', 'Go. Tanks are at flight level and the engines are chilled.'));

    if (wx.align) st('guidance', 'hold', t('ld.r.gnc.align', 'Hold. The navigation unit drifted; we are re-aligning it.'), { hold: 10 });
    else st('guidance', 'go', t('ld.r.gnc.go', 'Go. Navigation is aligned and the target for {dest} is loaded.', { dest: S.destName }));

    if (!S.ok.umbilical) st('spacecraft', 'hold', t('ld.r.sc.umb', 'Hold. Telemetry keeps dropping out: the umbilical connector is loose. A crew is going to reseat it.'), { hold: 20, crew: 'umbilical' });
    else if (S.known) st('spacecraft', 'go', t('ld.r.sc.known', 'Go, with a known issue: {flaw}. We accept the risk.', { flaw: subName(S.known) }));
    else st('spacecraft', 'go', t('ld.r.sc.go', 'Go. {name} is healthy and ready.', { name: S.p.design.name }));
    return out;
  }

  function weatherRules(S) {
    const wx = S.wx;
    return [
      { id: 'ground', name: t('ld.wx.ground', 'Ground winds (peak)'), value: t('ld.wx.kt', '{n} knots', { n: wx.ground }), limit: t('ld.wx.ground.lim', '{n} knots or less', { n: GROUND_LIMIT }), ok: wx.ground <= GROUND_LIMIT },
      { id: 'upper', name: t('ld.wx.upper', 'Upper-level winds'), value: t('ld.wx.pct', '{n}% of the load limit', { n: wx.upper }), limit: t('ld.wx.upper.lim', '100% or less'), ok: wx.upper <= 100 },
      { id: 'lightning', name: t('ld.wx.lightning', 'Lightning within 10 nautical miles'), value: wx.lightning === null ? t('ld.wx.none', 'None') : t('ld.wx.ago', '{n} minutes ago', { n: wx.lightning }), limit: t('ld.wx.lightning.lim', 'none in the last 30 minutes'), ok: wx.lightning === null || wx.lightning >= LIGHTNING_WAIT },
      { id: 'anvil', name: t('ld.wx.anvil', 'Anvil cloud within 10 nautical miles'), value: wx.anvil ? t('ld.wx.yes', 'Yes, attached to a storm') : t('ld.wx.none', 'None'), limit: t('ld.wx.none', 'None'), ok: !wx.anvil },
    ];
  }

  // What the director can do now.
  function choices(S, list) {
    const notGo = list.filter((s) => s.status !== 'go');
    if (!notGo.length) return { go: true };
    const holdable = notGo.every((s) => s.hold && !s.scrubOnly && !s.upperOnly);
    const holdMin = holdable ? Math.max(...notGo.map((s) => s.hold)) : 0;
    const left = S.window - S.used;
    return {
      go: false,
      hold: holdable && holdMin <= left ? holdMin : 0,
      tooLong: holdable && holdMin > left,
      override: notGo.every((s) => s.id === 'weather'),
    };
  }

  function holdFor(S, min, list) {
    const r = rngOf(S.p.seed + 131 * (S.day + 1) + 17 * ++S.holds);
    const wx = S.wx;
    const notes = [];
    S.used += min;
    S.holdTotal += min;
    list.forEach((s) => {
      if (s.crew && !S.ok[s.crew]) {
        S.ok[s.crew] = true;
        S.crewFixed.push(s.crew);
        if (S.scene) S.scene.crewFix(s.crew);
      }
    });
    if (wx.boat) {
      wx.boat = r() < 0.2;
      notes.push(wx.boat ? t('ld.n.boat.still', 'The boat is still in the hazard area.') : t('ld.n.boat.gone', 'The boat is out of the hazard area.'));
    }
    if (wx.lightning !== null && wx.lightning < LIGHTNING_WAIT) {
      wx.lightning += min;
      if (r() < 0.25) {
        wx.lightning = Math.round(1 + r() * 6);
        notes.push(t('ld.n.strike', 'A new lightning strike, {n} minutes ago: the 30-minute clock starts again.', { n: wx.lightning }));
      } else notes.push(t('ld.n.calm', 'No new lightning.'));
    }
    if (wx.anvil) {
      wx.anvil = r() < 0.45;
      notes.push(wx.anvil ? t('ld.n.anvil.still', 'The anvil cloud is still close.') : t('ld.n.anvil.gone', 'The anvil cloud drifted away.'));
    }
    if (wx.ground > GROUND_LIMIT) {
      if (r() < 0.55) wx.ground = Math.round(20 + r() * 9);
      notes.push(wx.ground > GROUND_LIMIT ? t('ld.n.wind.still', 'Gusts are still too strong.') : t('ld.n.wind.drop', 'The gusts dropped.'));
    }
    wx.align = false;
    return notes;
  }

  function scrub(S) {
    S.day += 1;
    S.scrubs += 1;
    S.used = 0;
    S.wx = weatherFor(S.p, S.day);
    // A scrub turnaround includes a full pad closeout and a debris sweep.
    ['rbf', 'hatch', 'umbilical', 'valve'].forEach((k) => {
      if (!S.ok[k]) {
        S.ok[k] = true;
        S.crewFixed.push(k);
        if (S.scene) S.scene.crewFix(k);
      }
    });
    if (S.leak) S.leakFixedByScrub = true;
    S.fodLeft = false;
  }

  // How far past the rules the ride goes (0..1) and whether lightning was ignored.
  function risk(S) {
    const wx = S.wx;
    let k = 0;
    const why = [];
    if (wx.upper > 100) {
      k += 0.5 + Math.min(0.5, (wx.upper - 100) / 50);
      why.push('upper');
    }
    if (wx.ground > GROUND_LIMIT) {
      k += 0.45;
      why.push('ground');
    }
    if (S.fodLeft) {
      k += 0.45;
      why.push('fod');
    }
    const lightning = (wx.lightning !== null && wx.lightning < LIGHTNING_WAIT) || wx.anvil;
    if (lightning) why.push('lightning');
    return { k: Math.min(1, k), lightning, why };
  }

  // ---------- The screen ----------
  ui.screens.launchday = {
    render(app, params) {
      const ag = SMD.game.agency;
      const pickProject = () => {
        if (!ag) return null;
        if (params.projectId !== undefined) return ag.projects.find((x) => x.id === params.projectId) || null;
        return ag.projects.find((x) => A().launchDayOpen(ag, x)) || ag.projects.filter((x) => x.status === 'flying').pop() || ag.projects.filter((x) => x.flight).pop() || ag.projects[ag.projects.length - 1] || null;
      };
      const p = pickProject();
      if (!p || !p.design) {
        SMD.go('hq', { resume: true });
        return;
      }
      const m = D().MISSIONS[p.missionKey];
      const live = !!(A().launchDayOpen && A().launchDayOpen(ag, p));
      const P = SMD.physics && SMD.physics.PLANETS;
      const destName = m.kind === 'earth' ? t('film.earth', 'Earth') : P && P[m.dest] ? t('planet.' + m.dest, P[m.dest].name) : m.dest;
      const launcherId = SMD.model.launcherFor ? SMD.model.launcherFor(p.design) : p.design.launcher;
      const launcherOpt = (D().OPTIONS.launcher || []).find((o) => o.id === launcherId);
      const rocketName = t('design.opt.launcher.' + launcherId, launcherOpt ? launcherOpt.name : launcherId);
      const seed = p.seed >>> 0;
      const r0 = rngOf(seed + 2027);
      const clue = padClue(p);
      const S = {
        p,
        ag,
        live,
        destName,
        phase: 'walk',
        leak: r0() < 0.4,
        fod: r0() < 0.5,
        clue,
        rows: telemetry(p, clue),
        ok: { rbf: false, valve: false, umbilical: false, hatch: false },
        byHand: {}, // spot -> what the player decided
        found: [],
        fixed: [],
        known: null,
        flagWrong: 0,
        extraMin: 0,
        day: 0,
        scrubs: 0,
        holds: 0,
        holdTotal: 0,
        used: 0,
        window: windowMin(m),
        wx: null,
        crewFixed: [],
        fodLeft: false,
        quick: false,
        override: null,
        scene: null,
        log: [],
      };
      S.fodLeft = S.fod;
      S.wx = weatherFor(p, 0);
      ui.screens.launchday.state = S; // for tools/shot.mjs scripts

      const date = ui.date ? ui.date(p.launchMs) : '';
      app.innerHTML = `<main class="screen night ld" data-phase="walk">
        <div class="ld-stage" data-3d></div>
        <div class="ld-pins" data-pins aria-hidden="false"></div>
        <header class="ld-top">
          <div class="ld-title">
            <p class="ld-kicker">${esc(t('ld.kicker', 'Launch day · {date}', { date }))}${live ? '' : ` · <span class="ld-rehearsal">${esc(t('ld.rehearsal', 'Rehearsal: this launch already happened'))}</span>`}</p>
            <h1>${esc(t('ld.title', '{name} at the pad', { name: p.design.name }))}</h1>
            <p class="ld-sub">${esc(t('ld.sub', '{rocket} · bound for {dest}', { rocket: rocketName, dest: destName }))}</p>
          </div>
          <div class="ld-top-actions">
            <span class="ld-clock num" data-clock>T−03:00:00</span>
            <button type="button" class="btn small ghost" data-act="auto">${esc(t('ld.auto', 'Decide for me'))}</button>
          </div>
        </header>
        <section class="ld-side" data-side aria-label="${esc(t('ld.walk.title', 'Walkdown'))}"></section>
        <section class="ld-card" data-card hidden role="dialog" aria-modal="false"></section>
        <p class="ld-hint" data-hint></p>
        <p class="ld-sr" aria-live="polite" data-live></p>
        <div class="ld-count" data-countbox hidden aria-live="polite"></div>
        <div class="ld-fade" data-fade aria-hidden="true"></div>
      </main>`;
      const $ = (s) => app.querySelector(s);
      const root = $('.ld');
      const stage = $('[data-3d]');
      const pinsEl = $('[data-pins]');
      const side = $('[data-side]');
      const card = $('[data-card]');
      const hint = $('[data-hint]');
      const liveEl = $('[data-live]');
      const clockEl = $('[data-clock]');
      const countBox = $('[data-countbox]');
      const timers = new Set();
      const later = (fn, ms) => {
        const id = setTimeout(() => {
          timers.delete(id);
          if (alive) fn();
        }, ms);
        timers.add(id);
        return id;
      };
      let alive = true;
      let left = false;
      let scene = null;
      const E = SMD.three && SMD.three.engine;
      const has3D = () => !!(scene && E && E.supported && E.supported());
      const audio = SMD.audio || {};
      const beep = (f, d, ty, v) => {
        try {
          audio.beep && audio.beep(f, d, ty, v);
        } catch (e) {}
      };
      const say = (text) => (liveEl.textContent = text);
      const money = (x) => ui.money(x);

      // ---------- Walkdown ----------
      const spotDone = (id) => !!S.byHand[id];
      function paintSide() {
        if (S.phase !== 'walk') {
          side.hidden = true;
          return;
        }
        side.hidden = false;
        const n = SPOTS.filter(spotDone).length;
        side.innerHTML = `<h2>${esc(t('ld.walk.title', 'Walkdown'))}</h2>
          <p class="ld-side-lede">${esc(t('ld.walk.lede', 'Before the pad is cleared, walk around the rocket and check four hot spots. What you miss here comes back in the countdown.'))}</p>
          <ol class="ld-spots">${SPOTS.map(
            (id, i) => `<li><button type="button" class="ld-spot${spotDone(id) ? ' done' : ''}" data-spot="${id}" ${spotDone(id) ? 'aria-disabled="true"' : ''}>
              <span class="ld-spot-n" aria-hidden="true">${spotDone(id) ? '✓' : i + 1}</span>
              <span>${esc(SPOT_NAME[id]())}</span>
              <span class="ld-spot-s">${esc(spotDone(id) ? t('ld.walk.done', 'Checked') : t('ld.walk.go', 'Walk there'))}</span>
            </button></li>`
          ).join('')}</ol>
          <button type="button" class="btn primary ld-clear" data-act="clear">${esc(n === 4 ? t('ld.walk.clear', 'Clear the pad: to the firing room') : t('ld.walk.clearN', 'Clear the pad ({n} not checked)', { n: 4 - n }))}</button>`;
        side.querySelectorAll('[data-spot]').forEach((b) =>
          b.addEventListener('click', () => {
            const id = b.dataset.spot;
            if (spotDone(id)) return;
            if (has3D()) scene.goToSpot(id);
            else openSpot(id);
          })
        );
        side.querySelector('[data-act="clear"]').addEventListener('click', clearPad);
      }

      function paintHint(nearId) {
        if (S.phase !== 'walk' || !card.hidden) {
          hint.hidden = true;
          return;
        }
        // The "E  Inspect" prompt is the character controller's; this line
        // only reminds how to walk (the no-3D view keeps the old prompt).
        hint.hidden = false;
        hint.innerHTML =
          nearId && !scene
            ? `<kbd>E</kbd> ${esc(t('ld.hint.inspect', 'Inspect: {spot}', { spot: SPOT_NAME[nearId]() }))}`
            : esc(
                window.matchMedia && window.matchMedia('(pointer: coarse)').matches
                  ? t('ld.hint.walkTouch', 'Left thumb: walk · right side: look · tap a marker to inspect')
                  : t('ld.hint.walk2', 'Walk with W A S D (Shift runs), look with the mouse, E inspects what is in front of you. H: controls.')
              );
      }

      // Hot-spot pins: buttons that follow the 3D markers.
      const pinEls = {};
      SPOTS.forEach((id) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ld-pin';
        b.dataset.spot = id;
        b.innerHTML = `<span class="ld-pin-dot" aria-hidden="true"></span><span class="ld-pin-l">${esc(SPOT_NAME[id]())}</span>`;
        b.addEventListener('click', () => scene && scene.goToSpot(id));
        b.hidden = true;
        pinsEl.appendChild(b);
        pinEls[id] = b;
      });
      function onPins(list) {
        list.forEach((pin) => {
          const b = pinEls[pin.id];
          const show = pin.on && !pin.done && S.phase === 'walk' && card.hidden;
          if (b.hidden === show) b.hidden = !show;
          if (!show) return;
          b.style.transform = `translate(${Math.round(pin.x)}px, ${Math.round(pin.y)}px)`;
          b.classList.toggle('near', !!pin.near);
        });
      }

      // Inspection cards.
      let cardSpot = null;
      function openCard(html, spot) {
        cardSpot = spot || null;
        card.innerHTML = html;
        card.hidden = false;
        root.classList.add('has-card');
        if (scene) scene.freeze(true);
        paintHint(null);
        // Focus the title, so no answer is pre-selected for keyboard players.
        const h = card.querySelector('h2');
        if (h) h.setAttribute('tabindex', '-1');
        const f = card.querySelector('[data-focus]') || h;
        if (f) f.focus({ preventScroll: true });
      }
      function closeCard() {
        card.hidden = true;
        card.innerHTML = '';
        cardSpot = null;
        root.classList.remove('has-card');
        if (S.phase === 'walk') {
          if (scene) scene.freeze(false);
        }
        paintHint(scene && scene.near);
      }
      const fact = (text) => `<p class="ld-fact"><span>${esc(t('ld.fact', 'Real practice'))}</span> ${esc(text)}</p>`;
      const spotHead = (id) => `<p class="ld-card-k">${esc(t('ld.card.k', 'Hot spot {n} of 4', { n: SPOTS.indexOf(id) + 1 }))}</p><h2>${esc(SPOT_NAME[id]())}</h2>`;
      const choiceBtn = (act, label, sub, extra = '') => `<button type="button" class="ld-choice" data-c="${act}" ${extra}><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;

      function finishSpot(id, outcome, tone, how = {}) {
        S.byHand[id] = how.choice || 'done';
        if (scene) scene.setSpot(id, how);
        beep(tone === 'ok' ? 988 : 523, 0.12, tone === 'ok' ? 'sine' : 'triangle', 0.1);
        const body = card.querySelector('[data-body]');
        const html = `<div class="ld-outcome ${tone}"><span class="tone ${tone}">${esc(tone === 'ok' ? t('ld.tone.ok', 'Good') : t('ld.tone.warn', 'Noted'))}</span><p>${esc(outcome)}</p></div>
          <button type="button" class="btn primary" data-act="back" data-focus>${esc(t('ld.card.back', 'Back to the walkdown'))}</button>`;
        if (body) body.innerHTML = html;
        say(outcome);
        card.querySelector('[data-act="back"]').addEventListener('click', () => {
          closeCard();
          paintSide();
          if (SPOTS.every(spotDone)) say(t('ld.walk.all', 'All four hot spots checked. Clear the pad when you are ready.'));
        });
        card.querySelector('[data-focus]').focus({ preventScroll: true });
        paintSide();
      }

      function openSpot(id) {
        if (S.phase !== 'walk' || spotDone(id) || !card.hidden) return;
        if (id === 'rbf') {
          openCard(
            `${spotHead(id)}<div data-body>
            <p>${esc(t('ld.rbf.see', 'Three red streamers hang from the safe-and-arm box of the flight termination system. Each one marks a pin that keeps something safe while people work on the pad.'))}</p>
            ${fact(t('ld.rbf.fact', 'Remove-before-flight streamers mark ground-only pins and covers. Crews count every tag back in before the pad is cleared.'))}
            <div class="ld-choices">${choiceBtn('pull', t('ld.rbf.pull', 'Pull the pins and count the tags'), t('ld.rbf.pull.d', 'Two minutes'))}${choiceBtn('leave', t('ld.rbf.leave', 'Leave them for the pad crew'), t('ld.rbf.leave.d', 'Someone will get them later'))}</div></div>`,
            id
          );
          bindChoices((c) => {
            if (c === 'pull') {
              S.ok.rbf = true;
              finishSpot(id, t('ld.rbf.ok', 'Three of three tags in the bag. The safety system can now be armed for flight.'), 'ok', { choice: c, react: true });
            } else finishSpot(id, t('ld.rbf.no', 'The tags stay on. Someone will have to come back for them after the pad is cleared.'), 'warn', { choice: c });
          });
        } else if (id === 'valve') {
          const reading = S.leak ? t('ld.valve.leak', '−0.42 bar per minute, and a faint hiss') : t('ld.valve.ok', '−0.02 bar per minute, steady');
          openCard(
            `${spotHead(id)}<div data-body>
            <p>${esc(t('ld.valve.see', 'White frost covers the valve on the liquid-oxygen fill line, and vapour curls off it. Liquid oxygen is −183 °C. Read the gauge before you decide.'))}</p>
            <dl class="ld-read"><dt>${esc(t('ld.valve.gauge', 'Line pressure change'))}</dt><dd class="num">${esc(reading)}</dd><dt>${esc(t('ld.valve.limit', 'Limit'))}</dt><dd class="num">${esc(t('ld.valve.lim', 'no faster than −0.10 bar per minute'))}</dd></dl>
            ${fact(t('ld.valve.fact', 'Frost on a cold tank or line is normal. A falling pressure or vapour where there should be none is a leak: a hydrogen leak scrubbed Artemis I in September 2022.'))}
            <div class="ld-choices">${choiceBtn('normal', t('ld.valve.normal', 'Normal frost: carry on'), '')}${choiceBtn('leak', t('ld.valve.call', 'Call a leak: tighten it now'), t('ld.valve.call.d', 'A 10-minute job for the pad crew'))}</div></div>`,
            id
          );
          bindChoices((c) => {
            if (c === 'leak' && S.leak) {
              S.ok.valve = true;
              finishSpot(id, t('ld.valve.caught', 'Good call. The crew tightens the seal and the pressure holds. Found now, it costs nothing; found at T−10 minutes, it would cost the day.'), 'ok', { choice: c, fixed: true, react: true });
            } else if (c === 'leak') {
              S.ok.valve = true;
              S.extraMin += 10;
              finishSpot(id, t('ld.valve.false', 'False alarm: the pressure was steady, it was just frost. The check eats 10 minutes of your launch window.'), 'warn', { choice: c });
            } else if (S.leak) {
              S.ok.valve = false;
              finishSpot(id, t('ld.valve.missed', 'You move on. (The gauge was falling faster than its limit.)'), 'warn', { choice: c });
            } else {
              S.ok.valve = true;
              finishSpot(id, t('ld.valve.right', 'Right: just frost. Cold metal in humid air always grows it.'), 'ok', { choice: c });
            }
          });
        } else if (id === 'umbilical') {
          S.ok.umbilical = true;
          if (scene) scene.setSpot('umbilical', {});
          S.byHand.umbilical = 'seated';
          openCard(
            `${spotHead(id)}<div data-body>
            <p>${esc(t('ld.umb.see', 'This cable feeds power and data to {name} inside the nose cone until the last second. Its connector was half out: you push it home. Click. Telemetry comes back on the panel.', { name: p.design.name }))}</p>
            <p class="ld-q">${esc(t('ld.umb.q', 'Check each reading against its limit. Flag the one that is wrong, if any.'))}</p>
            <table class="ld-tm"><thead><tr><th>${esc(t('ld.tm.reading', 'Reading'))}</th><th>${esc(t('ld.tm.now', 'Now'))}</th><th>${esc(t('ld.tm.limit', 'Limit'))}</th><th><span class="ld-sr">${esc(t('ld.tm.flag', 'Flag'))}</span></th></tr></thead>
            <tbody>${S.rows.map((row, i) => `<tr><td>${esc(row.label)}</td><td class="num">${esc(row.value)}</td><td class="num">${esc(row.limit)}</td><td><button type="button" class="btn small ghost" data-row="${i}">${esc(t('ld.tm.flag', 'Flag'))}</button></td></tr>`).join('')}</tbody></table>
            ${fact(t('ld.umb.fact', 'Spacecraft stay plugged into ground power and data through an umbilical until liftoff, so the team can watch every reading to the end.'))}
            <div class="ld-choices">${choiceBtn('allok', t('ld.tm.allok', 'All readings are within limits'), '')}</div></div>`,
            id
          );
          card.querySelectorAll('[data-row]').forEach((b) => b.addEventListener('click', () => flagRow(Number(b.dataset.row))));
          bindChoices(() => {
            S.byHand.umbilical = 'checked';
            finishSpot(id, t('ld.tm.logged', 'Logged. The readings go to the spacecraft team.'), 'ok', { choice: 'allok' });
          });
        } else if (id === 'hatch') {
          openCard(
            `${spotHead(id)}<div data-body>
            <p>${esc(t('ld.hatch.see', 'The hatch of the pad service bay is open. Closeout photos must show every hatch shut and nothing loose nearby. Look around it before you choose.'))}</p>
            ${fact(t('ld.hatch.fact', 'Pad crews walk the deck in a line before launch to pick up foreign object debris: at liftoff the exhaust turns a loose bolt into a bullet.'))}
            <div class="ld-choices">${choiceBtn('close', t('ld.hatch.close', 'Close it and move on'), '')}${choiceBtn('sweep', t('ld.hatch.sweep', 'Sweep the deck for debris, then close it'), t('ld.hatch.sweep.d', '10 minutes of your launch window'))}</div></div>`,
            id
          );
          bindChoices((c) => {
            S.ok.hatch = true;
            if (c === 'sweep') {
              S.extraMin += 10;
              S.fodLeft = false;
              finishSpot(id, S.fod ? t('ld.hatch.found', 'You pick up a wrench lying right where the exhaust will hit, then shut the hatch. Good eyes.') : t('ld.hatch.clean', 'The deck is clean. The hatch is shut, and the sweep cost 10 minutes.'), S.fod ? 'ok' : 'warn', { choice: c, swept: true, react: S.fod });
            } else finishSpot(id, t('ld.hatch.closed', 'The hatch is shut and photographed.'), 'ok', { choice: c });
          });
        }
      }

      function bindChoices(fn) {
        card.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => fn(b.dataset.c)));
      }

      function flagRow(i) {
        const row = S.rows[i];
        const body = card.querySelector('[data-body]');
        if (row.bad) {
          const f = row.flaw;
          if (!S.found.includes(f.uid)) S.found.push(f.uid);
          const cost = A().padFixCost(f);
          const days = A().PAD_FIX_DAYS;
          body.innerHTML = `<div class="ld-outcome ok"><span class="tone ok">${esc(t('ld.tm.catch', 'Good catch'))}</span><p>${esc(t('ld.tm.catch.t', '{reading}: {value}, outside its limit. The cause: {flaw}', { reading: row.label, value: row.value, flaw: SMD.ops.flawLabel(f) }))}</p></div>
            ${fact(t('ld.tm.fix.fact', 'A problem found on the pad is far cheaper than one found in space, but fixing it means rolling back and losing days.'))}
            <div class="ld-choices">${choiceBtn('fix', t('ld.tm.fix', 'Fix it at the pad'), t('ld.tm.fix.d', '+{d} days, {m}', { d: days, m: money(cost + days * A().scrubCost(p)) }), 'data-focus')}${choiceBtn('fly', t('ld.tm.fly', 'Fly with it'), t('ld.tm.fly.d', 'Keep the date and accept the risk'))}</div>`;
          beep(988, 0.12, 'sine', 0.1);
          bindChoices((c) => {
            S.byHand.umbilical = 'caught';
            if (c === 'fix') {
              S.fixed.push(f.uid);
              S.known = null;
              S.day += days;
              S.wx = weatherFor(p, S.day);
              finishSpot('umbilical', t('ld.tm.fixed', 'The rocket rolls back, the {flaw} is fixed, and launch day moves {d} days.', { flaw: subName(f), d: days }), 'ok', { choice: 'fix', react: true });
            } else {
              S.known = f;
              finishSpot('umbilical', t('ld.tm.flying', 'You keep the date. {name} will fly with this flaw, and everyone knows it.', { name: p.design.name }), 'warn', { choice: 'fly' });
            }
          });
          card.querySelector('[data-focus]').focus({ preventScroll: true });
        } else {
          S.flagWrong++;
          S.extraMin += 10;
          const b = card.querySelector(`[data-row="${i}"]`);
          if (b) {
            b.disabled = true;
            b.textContent = t('ld.tm.fine', 'Fine');
          }
          beep(523, 0.15, 'triangle', 0.1);
          say(t('ld.tm.false', 'False alarm: {reading} is within its limit. The double-check eats 10 minutes of the window.', { reading: row.label }));
          let note = card.querySelector('[data-note]');
          if (!note) {
            note = document.createElement('p');
            note.className = 'ld-note';
            note.dataset.note = '';
            card.querySelector('.ld-tm').after(note);
          }
          note.textContent = t('ld.tm.false', 'False alarm: {reading} is within its limit. The double-check eats 10 minutes of the window.', { reading: row.label });
        }
      }

      function clearPad() {
        const missing = SPOTS.filter((id) => !spotDone(id));
        if (missing.length && !S.quick) {
          openCard(
            `<p class="ld-card-k">${esc(t('ld.walk.title', 'Walkdown'))}</p><h2>${esc(t('ld.clear.q', 'Clear the pad now?'))}</h2>
            <p>${esc(t('ld.clear.t', 'Not checked: {list}. Anything you skipped will have to be handled during the countdown.', { list: missing.map((id) => SPOT_NAME[id]()).join(', ') }))}</p>
            <div class="ld-choices">${choiceBtn('stay', t('ld.clear.stay', 'Keep walking'), '', 'data-focus')}${choiceBtn('go', t('ld.clear.go', 'Clear the pad anyway'), '')}</div>`
          );
          bindChoices((c) => {
            closeCard();
            if (c === 'go') toControl();
          });
          return;
        }
        toControl();
      }

      // ---------- The poll ----------
      let pollList = [];
      let polled = false;
      let confirmOverride = false;
      function toControl() {
        S.phase = 'poll';
        root.dataset.phase = 'poll';
        if (E && E.input) E.input.capture(false);
        closeCard();
        paintSide();
        S.used = Math.min(S.window - 5, S.extraMin);
        if (scene) {
          scene.setMode('control');
          STATIONS.forEach((id) => scene.setStation(id, 'idle'));
          scene.setClock('T-00:10:00', t('ld.clock.hold', 'HOLD'));
        }
        clockEl.textContent = 'T−00:10:00';
        polled = false;
        pollList = stationsFor(S);
        paintPoll();
      }

      const statusTone = { go: 'ok', hold: 'warn', nogo: 'bad' };
      const statusWord = { go: () => t('ld.go', 'Go'), hold: () => t('ld.hold', 'Hold'), nogo: () => t('ld.nogo', 'No-Go') };
      function paintPoll(shown = polled ? STATIONS.length : 0) {
        const left = Math.max(0, S.window - S.used);
        const ch = polled ? choices(S, pollList) : null;
        const wxRow = pollList.find((s) => s.id === 'weather');
        const rows = STATIONS.map((id, i) => {
          const s = pollList.find((x) => x.id === id);
          const on = i < shown;
          return `<li class="ld-st${on ? ' ' + s.status : ''}">
            <span class="ld-st-n">${esc(STATION_NAME[id]())}</span>
            ${on ? `<span class="tone ${statusTone[s.status]}">${esc(statusWord[s.status]())}</span><p>${esc(s.line)}</p>` : `<span class="ld-st-wait">${esc(t('ld.poll.wait', 'Waiting'))}</span>`}
            ${on && id === 'weather' ? weatherTable(s.rules) : ''}
          </li>`;
        }).join('');
        let actions = '';
        if (!polled) actions = `<button type="button" class="btn primary" data-act="poll" data-focus>${esc(S.holds || S.scrubs ? t('ld.poll.again', 'Poll the team again') : t('ld.poll.start', 'Poll the team: Go or No-Go?'))}</button>`;
        else if (confirmOverride) {
          const rk = risk(S);
          actions = `<div class="ld-warnbox"><p><b>${esc(t('ld.ov.q', 'Break the weather rules and launch?'))}</b></p>
            <ul>${rk.why.map((w) => `<li>${esc(riskText(w))}</li>`).join('')}</ul>
            <div class="ld-choices row"><button type="button" class="btn ld-danger" data-act="override">${esc(t('ld.ov.yes', 'Launch anyway'))}</button><button type="button" class="btn ghost" data-act="cancel" data-focus>${esc(t('ld.ov.no', 'Back'))}</button></div></div>`;
        } else if (ch.go) actions = `<button type="button" class="btn primary ld-gobtn" data-act="go" data-focus>${esc(t('ld.poll.go', 'Go for launch'))}</button>`;
        else {
          actions = `<div class="ld-choices row">
            ${ch.hold ? `<button type="button" class="btn" data-act="hold" data-focus>${esc(t('ld.poll.hold', 'Hold {n} minutes', { n: ch.hold }))}</button>` : ''}
            <button type="button" class="btn ghost" data-act="scrub" ${ch.hold ? '' : 'data-focus'}>${esc(t('ld.poll.scrub', 'Scrub: try tomorrow ({m})', { m: money(A().scrubCost(p)) }))}</button>
            ${ch.override ? `<button type="button" class="btn ghost ld-danger-ghost" data-act="askov">${esc(t('ld.poll.override', 'Launch anyway…'))}</button>` : ''}
          </div>
          ${ch.tooLong ? `<p class="ld-note">${esc(t('ld.poll.tooLong', 'A hold would run past the end of today’s window.'))}</p>` : ''}
          ${wxRow && wxRow.upperOnly ? `<p class="ld-note">${esc(t('ld.poll.upper', 'Upper-level winds do not change in minutes: the next balloon goes up in hours.'))}</p>` : ''}`;
        }
        const logHtml = S.log.length ? `<ul class="ld-log">${S.log.slice(0, 3).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
        card.hidden = false;
        root.classList.add('has-card');
        card.innerHTML = `<p class="ld-card-k">${esc(t('ld.poll.k', 'Firing room · you are the launch director'))}</p>
          <h2>${esc(t('ld.poll.title', 'Go/No-Go poll'))}</h2>
          <div class="ld-window">
            <span>${esc(S.day ? t('ld.poll.attempt', 'Attempt {n}', { n: S.scrubs + 1 }) : t('ld.poll.first', 'First attempt'))}${S.day > S.scrubs ? ` · ${esc(t('ld.poll.dayN', 'day {n}', { n: S.day + 1 }))}` : ''}</span>
            <span>${esc(t('ld.poll.window', 'Window: {left} of {w} min left', { left, w: S.window }))}</span>
            <i class="ld-window-bar" style="--k:${(left / S.window).toFixed(3)}" aria-hidden="true"></i>
          </div>
          ${logHtml}
          <ol class="ld-stations">${rows}</ol>
          <div class="ld-actions">${actions}</div>`;
        bindPoll();
        const f = card.querySelector('[data-focus]');
        if (f && shown === STATIONS.length) f.focus({ preventScroll: true });
      }

      function riskText(w) {
        if (w === 'upper') return t('ld.ov.upper', 'Upper-level winds at {n}% of the load limit: a rough ride that can crack a weak bracket or mount.', { n: S.wx.upper });
        if (w === 'ground') return t('ld.ov.ground', 'Gusts of {n} knots: the rocket can sway into the tower at liftoff.', { n: S.wx.ground });
        if (w === 'fod') return t('ld.ov.fod', 'Loose debris was left on the pad deck: a rougher ride.');
        return t('ld.ov.lightning', 'Lightning rules broken: a rocket climbing through charged clouds can trigger a strike. Atlas-Centaur 67 was lost this way in 1987.');
      }

      function weatherTable(rules) {
        return `<ul class="ld-wx">${rules
          .map((x) => `<li class="${x.ok ? 'ok' : 'bad'}"><span class="tone ${x.ok ? 'ok' : 'bad'}">${esc(x.name)}</span><b class="num">${esc(x.value)}</b>${x.ok ? '' : `<small>${esc(t('ld.wx.limitIs', 'Limit: {limit}', { limit: x.limit }))}</small>`}</li>`)
          .join('')}</ul>`;
      }
      function bindPoll() {
        const on = (act, fn) => {
          const b = card.querySelector(`[data-act="${act}"]`);
          if (b) b.addEventListener('click', fn);
        };
        on('poll', runPoll);
        on('go', () => launch(null));
        on('hold', () => {
          const ch = choices(S, pollList);
          const notes = holdFor(S, ch.hold, pollList);
          S.log.unshift(t('ld.log.hold', 'Held {n} minutes. {notes}', { n: ch.hold, notes: notes.join(' ') }).trim());
          beep(523, 0.2, 'triangle', 0.12);
          repoll();
        });
        on('scrub', () => {
          scrub(S);
          S.log.unshift(t('ld.log.scrub', 'Scrubbed. The propellant is drained; the team tries again tomorrow ({m}).', { m: money(A().scrubCost(p)) }));
          if (scene) scene.react('scrub');
          beep(330, 0.3, 'sine', 0.12);
          repoll();
        });
        on('askov', () => {
          confirmOverride = true;
          paintPoll();
        });
        on('cancel', () => {
          confirmOverride = false;
          paintPoll();
        });
        on('override', () => {
          confirmOverride = false;
          launch(risk(S));
        });
      }

      function repoll() {
        pollList = stationsFor(S);
        polled = false;
        if (scene) {
          STATIONS.forEach((id) => scene.setStation(id, 'idle'));
          scene.setClock('T-00:10:00', S.scrubs ? t('ld.clock.recycle', 'RECYCLE') : t('ld.clock.hold', 'HOLD'));
        }
        runPoll();
      }

      // Each station answers in turn; the director looks at each console.
      function runPoll() {
        pollList = stationsFor(S);
        polled = true;
        confirmOverride = false;
        const step = reduced() || S.quick ? 0 : 520;
        const show = (i) => {
          if (!alive || S.phase !== 'poll') return;
          paintPoll(i);
          if (i > 0) {
            const s = pollList.find((x) => x.id === STATIONS[i - 1]);
            if (scene) {
              scene.setStation(s.id, s.status);
              scene.lookAtStation(s.id);
            }
            beep(s.status === 'go' ? 880 : s.status === 'hold' ? 523 : 330, 0.09, 'sine', 0.08);
            say(`${STATION_NAME[s.id]()}: ${s.line}`);
          }
          if (i < STATIONS.length) {
            if (step) later(() => show(i + 1), step);
            else show(i + 1);
          } else if (scene) later(() => scene.lookAtStation(null), 600);
        };
        show(0);
      }

      // ---------- Go: apply launch day, show the report, count down ----------
      let result = null;
      function launch(over) {
        S.override = over;
        S.phase = 'report';
        root.dataset.phase = 'report';
        if (scene) {
          STATIONS.forEach((id) => scene.setStation(id, 'go'));
          scene.react('go');
        }
        const rk = over || { k: S.fodLeft ? 0.45 : 0, lightning: false, why: S.fodLeft ? ['fod'] : [] };
        if (S.live) {
          try {
            result = A().launchDay(ag, p, { found: S.found, fixed: S.fixed, scrubDays: S.day, weatherRisk: rk.k, lightning: rk.lightning });
            syncPending();
            SMD.game.save();
          } catch (err) {
            console.error('launch day could not be applied', err);
          }
        }
        report(rk);
      }

      // The HQ queue may hold a 'complete' for a mission that is no longer lost,
      // or miss one for a mission that now is.
      function syncPending() {
        const Q = SMD.game.pending;
        if (!Q) return;
        for (let i = Q.length - 1; i >= 0; i--) if (Q[i].type === 'complete' && Q[i].projectId === p.id && p.status !== 'done') Q.splice(i, 1);
        if (p.status === 'done' && !Q.some((e) => e.type === 'complete' && e.projectId === p.id)) Q.unshift({ type: 'complete', projectId: p.id });
      }

      function reportLines(rk) {
        const L = [];
        const byHand = SPOTS.filter((id) => S.byHand[id]).length;
        L.push({ tone: byHand === 4 ? 'ok' : 'warn', text: S.quick ? t('ld.rep.quick', 'The pad crew did the walkdown by the book ({n} of 4 hot spots by your own hand).', { n: byHand }) : t('ld.rep.walk', 'Walkdown: {n} of 4 hot spots checked by hand.', { n: byHand }) });
        if (S.crewFixed.length) L.push({ tone: 'warn', text: t('ld.rep.crew', 'Sent the pad crew back for what was skipped: {list}.', { list: [...new Set(S.crewFixed)].map((id) => SPOT_NAME[id]()).join(', ') }) });
        if (S.fixed.length && S.clue) L.push({ tone: 'ok', text: t('ld.rep.fixed', 'Caught a hidden flaw at the pad and fixed it: {flaw}.', { flaw: subName(S.clue) }) });
        else if (S.known) L.push({ tone: 'warn', text: t('ld.rep.known', 'Caught a hidden flaw and flew with it: {flaw}.', { flaw: subName(S.known) }) });
        else if (S.clue) {
          const row = S.rows.find((x) => x.bad);
          L.push({ tone: 'bad', text: t('ld.rep.missed', 'Missed a clue: {reading} read {value} (limit {limit}). {name} flies with this flaw.', { reading: row.label, value: row.value, limit: row.limit, name: p.design.name }) });
        } else L.push({ tone: 'ok', text: t('ld.rep.clean', 'The spacecraft readings were all within limits.') });
        if (S.fod && !S.fodLeft) L.push({ tone: 'ok', text: t('ld.rep.fodOk', 'No debris left on the pad deck.') });
        if (S.holdTotal) L.push({ tone: 'warn', text: t('ld.rep.holds', 'Holds: {n} minutes of the window.', { n: S.holdTotal }) });
        if (S.day) L.push({ tone: 'warn', text: t('ld.rep.scrub', 'Extra days at the pad: {n} (scrubs and fixes), {m}.', { n: S.day, m: money((result && result.cost) || S.day * A().scrubCost(p) + S.fixed.length * (S.clue ? A().padFixCost(S.clue) : 0)) }) });
        if (!rk.why.length) L.push({ tone: 'ok', text: t('ld.rep.rules', 'Launched with every launch rule met: a normal ride.') });
        rk.why.forEach((w) => L.push({ tone: 'bad', text: riskText(w) }));
        if (!S.live) L.push({ tone: 'warn', text: t('ld.rep.rehearsal', 'Rehearsal only: this mission has already flown, so nothing changes.') });
        return L;
      }

      function report(rk) {
        const lines = reportLines(rk);
        card.hidden = false;
        root.classList.add('has-card');
        card.innerHTML = `<p class="ld-card-k">${esc(t('ld.rep.k', 'Launch day report'))}</p>
          <h2>${esc(rk.why.length ? t('ld.rep.title.risk', 'Go, against the rules') : t('ld.rep.title', 'Go for launch'))}</h2>
          <ul class="ld-rep">${lines.map((l) => `<li><span class="tone ${l.tone}">${esc(l.tone === 'ok' ? t('ld.tone.ok', 'Good') : l.tone === 'warn' ? t('ld.tone.warn', 'Noted') : t('ld.tone.bad', 'Risk'))}</span> ${esc(l.text)}</li>`).join('')}</ul>
          <p class="ld-note">${esc(t('ld.rep.next', 'What these choices did to the flight shows in the launch film and the results.'))}</p>
          <button type="button" class="btn primary" data-act="count" data-focus>${esc(t('ld.rep.count', 'Start the final count'))}</button>`;
        card.querySelector('[data-act="count"]').addEventListener('click', countdown);
        card.querySelector('[data-focus]').focus({ preventScroll: true });
        say(lines.map((l) => l.text).join(' '));
      }

      // The terminal count: about eight seconds, then the film takes over at T−10 s.
      function countdown() {
        S.phase = 'count';
        root.dataset.phase = 'count';
        card.hidden = true;
        root.classList.remove('has-card');
        countBox.hidden = false;
        const calls = [
          { at: 0, T: 240, text: t('ld.c.resume', 'Resume the count. The team is Go.') },
          { at: 1.7, T: 120, text: t('ld.c.press', 'Tanks pressurised for flight. The vents close.'), pad: true },
          { at: 3.4, T: 60, text: t('ld.c.internal', '{name} switches to its own batteries.', { name: p.design.name }) },
          { at: 5.1, T: 31, text: t('ld.c.auto', 'Auto-sequence start: the rocket’s computers take over.') },
          { at: 6.7, T: 15, text: t('ld.c.range', 'Range: clear to launch.') },
          { at: 8.2, T: 10, end: true },
        ];
        const fmtT = (s) => `T−${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
        countBox.innerHTML = `<p class="ld-count-t num" data-ct>${fmtT(240)}</p><p class="ld-count-c" data-cc></p><button type="button" class="btn small ghost" data-act="skipc">${esc(t('ld.c.skip', 'Skip to liftoff'))} <kbd>Esc</kbd></button>`;
        countBox.querySelector('[data-act="skipc"]').addEventListener('click', leave);
        const ct = countBox.querySelector('[data-ct]');
        const cc = countBox.querySelector('[data-cc]');
        const t0 = performance.now();
        let i = 0;
        const tick = () => {
          if (!alive || left) return;
          const s = (performance.now() - t0) / 1000;
          while (i < calls.length && s >= calls[i].at) {
            const c = calls[i++];
            if (c.end) {
              const fade = $('[data-fade]');
              if (fade) fade.classList.add('on');
              later(leave, reduced() ? 0 : 450);
              return;
            }
            cc.textContent = c.text;
            say(c.text);
            beep(660, 0.12, 'sine', 0.14);
            if (c.pad && scene) {
              scene.setVenting(0.15);
              scene.setMode('pad');
            }
          }
          // The clock runs between the calls.
          const k = calls.findIndex((c) => c.at > s);
          const a = calls[Math.max(0, k - 1)];
          const b = calls[k] || a;
          const T = b === a ? a.T : a.T + ((b.T - a.T) * (s - a.at)) / (b.at - a.at);
          ct.textContent = fmtT(Math.max(10, T));
          if (scene) scene.setClock(fmtT(Math.max(10, T)).replace('−', '-'), t('ld.clock.count', 'COUNTING'), '#3fc1b4');
          clockEl.textContent = fmtT(Math.max(10, T));
          raf = requestAnimationFrame(tick);
        };
        let raf = requestAnimationFrame(tick);
        cleanupCount = () => cancelAnimationFrame(raf);
      }
      let cleanupCount = () => {};

      function leave() {
        if (left) return;
        left = true;
        const crew = m.kind === 'crew';
        if (!S.live && !params.next) return SMD.go('hq', { resume: true });
        if (params.next && params.next !== 'film') return SMD.go(params.next, params.next === 'hq' ? { resume: true } : params.nextParams || { projectId: p.id });
        if (crew && ui.screens.ride) return SMD.go('ride', { projectId: p.id });
        SMD.go('film', { projectId: p.id, kind: 'launch' });
      }

      // ---------- Decide for me: the day by the book ----------
      // Only the hot spots the player has not dealt with by hand.
      function autoWalk() {
        const r = rngOf(seed + 5309);
        const todo = SPOTS.filter((id) => !S.byHand[id]);
        todo.forEach((id) => {
          S.ok[id] = true;
          if (id === 'hatch') S.fodLeft = false;
          if (scene) scene.setSpot(id, { fixed: true, swept: true });
        });
        // The crew reads the telemetry too, but a careful eye catches more.
        if (todo.includes('umbilical') && S.clue && !S.found.includes(S.clue.uid) && r() < 0.5) {
          S.found.push(S.clue.uid);
          if (ag.money > A().padFixCost(S.clue) + 30) {
            S.fixed.push(S.clue.uid);
            S.day += A().PAD_FIX_DAYS;
            S.wx = weatherFor(p, S.day);
          } else S.known = S.clue;
        }
      }
      function autoPoll() {
        for (let guard = 0; guard < 12; guard++) {
          const list = stationsFor(S);
          const ch = choices(S, list);
          if (ch.go) return;
          if (ch.hold) {
            const notes = holdFor(S, ch.hold, list);
            S.log.unshift(t('ld.log.hold', 'Held {n} minutes. {notes}', { n: ch.hold, notes: notes.join(' ') }).trim());
          } else {
            scrub(S);
            S.log.unshift(t('ld.log.scrub', 'Scrubbed. The propellant is drained; the team tries again tomorrow ({m}).', { m: money(A().scrubCost(p)) }));
          }
        }
      }
      // opts.instant: apply and leave at once (soak tests, classroom).
      function quick(opts = {}) {
        if (left) return;
        S.quick = true;
        if (S.phase === 'walk') {
          autoWalk();
          toControlQuiet();
        }
        if (S.phase === 'poll') {
          autoPoll();
          pollList = stationsFor(S);
          launch(null);
        }
        if (opts.instant) leave();
      }
      function toControlQuiet() {
        S.phase = 'poll';
        root.dataset.phase = 'poll';
        S.used = Math.min(S.window - 5, S.extraMin);
        closeCard();
        paintSide();
        if (E && E.input) E.input.capture(false);
        if (scene) scene.setMode('control');
      }

      $('[data-act="auto"]').addEventListener('click', () => {
        if (S.phase === 'walk' || S.phase === 'poll') quick();
        else if (S.phase === 'report') countdown();
        else leave();
      });

      const onKey = (e) => {
        if (e.key !== 'Escape') return;
        if (S.phase === 'count') {
          e.preventDefault();
          leave();
        } else if (S.phase === 'walk' && !card.hidden) {
          e.preventDefault();
          const back = cardSpot && S.byHand[cardSpot];
          closeCard();
          if (back) paintSide();
        }
      };
      window.addEventListener('keydown', onKey);

      // ---------- 3D ----------
      paintSide();
      paintHint(null);
      ui.screens.launchday.current = {
        state: S,
        quick,
        openSpot: (id) => openSpot(id),
        toControl,
        get scene() {
          return scene;
        },
      };
      try {
        audio.unlock && audio.unlock();
      } catch (e) {}
      import(new URL('js/3d/launchday.js', document.baseURI).href)
        .then((mod) => {
          if (!alive) return;
          scene = mod.createLaunchDay({
            launcher: SMD.model.launcherFor ? SMD.model.launcherFor(p.design) : p.design.launcher,
            agencyName: (ag && ag.name) || '',
            leak: S.leak,
            fod: S.fod,
            stationNames: Object.fromEntries(STATIONS.map((id) => [id, STATION_NAME[id]()])),
            statusWords: { go: statusWord.go(), hold: statusWord.hold(), nogo: statusWord.nogo() },
            onPins,
            onSpot: (id) => openSpot(id),
            onNear: (id) => paintHint(id),
            spotLabel: (id) => t('ld.hint.inspect', 'Inspect: {spot}', { spot: SPOT_NAME[id]() }),
          });
          // Q / gamepad B closes an inspection card, like Esc.
          if (scene.controller)
            scene.controller.on('back', () => {
              if (card.hidden) return;
              const was = cardSpot && S.byHand[cardSpot];
              closeCard();
              if (was) paintSide();
            });
          S.scene = scene;
          scene.attach(stage);
          E.mount(stage, scene);
          // Anything decided before the scene loaded.
          SPOTS.forEach((id) => S.byHand[id] && scene.setSpot(id, { fixed: S.ok.valve, swept: !S.fodLeft }));
          if (S.phase !== 'walk') scene.setMode(S.phase === 'count' ? 'pad' : 'control');
          if (!E.supported()) root.classList.add('ld-flat');
        })
        .catch((err) => {
          console.warn('launch day 3D failed', err);
          root.classList.add('ld-flat');
        });

      return () => {
        alive = false;
        timers.forEach(clearTimeout);
        cleanupCount();
        window.removeEventListener('keydown', onKey);
        if (E && E.input) E.input.capture(false);
        if (E) E.stop();
        ui.screens.launchday.current = null;
      };
    },
  };

  // Pure helpers, for tools and tests.
  SMD.launchdayLogic = { weatherFor, stationsFor, choices, holdFor, scrub, risk, padClue, telemetry };
})();
