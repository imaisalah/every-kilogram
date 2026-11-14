// Mission Sprint: the flight (docs/TEAM.md, calmed by docs/TEAM-V2.md). Launch, a
// real orbit with the team's actual spacecraft, three simple live graphs, KILO's
// short notes in a corner, crises on the big screen, and a definite ending:
// mission success, the loss of the craft, or (when the crew lands) the drop to the surface.
// Also here: the crew conversation in the cabin before launch (views.cabin).
//
// The numbers all come from SMD.team.sim.fly; this view only plays them back.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};
  const views = (SMD.team.views = SMD.team.views || {});
  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : e);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduced = () => {
    try {
      return !!(SMD.settings && SMD.settings.reducedMotion) || (globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const beep = (...a) => {
    try {
      SMD.audio && SMD.audio.beep(...a);
    } catch (e) {}
  };
  const seq = (notes, step, type, v) => notes.forEach((f, i) => setTimeout(() => beep(f, 0.2, type, v), i * step));
  const roleName = (r) => (SMD.team.kit && SMD.team.kit.roleName ? SMD.team.kit.roleName(r) : r);

  const BODY_R = { earth: 6371, moon: 1737, mars: 3390, venus: 6052, europa: 1561, jupiter: 69911 };

  // The flight record comes from the room: view.flight holds frames, events and
  // result on the screen that draws it; state.run is the same run in the host.
  function flightOf(ctx) {
    const s = ctx.state || {};
    const v = ctx.view || {};
    const f = v.flight;
    if (f && Array.isArray(f.frames) && f.frames.length) return f;
    if (v.flightTape && Array.isArray(v.flightTape.frames) && v.flightTape.frames.length) return v.flightTape;
    const r = s.run;
    if (r && Array.isArray(r.frames) && r.frames.length) return r;
    if (s.flight && Array.isArray(s.flight.frames)) return s.flight; // stand-ins
    return null;
  }
  // Scenario, orbit and rocket facts for the scene.
  function missionInfo(ctx, flight) {
    const s = ctx.state || {};
    const v = ctx.view || {};
    const sim = ctx.sim || SMD.team.sim;
    const design = s.design || v.design || {};
    const scenarioId = v.scenarioId || s.scenarioId || design.scenario;
    let list = [];
    try {
      list = sim.scenarios ? sim.scenarios() : [];
    } catch (e) {}
    const meta = list.find((x) => x.id === scenarioId) || {};
    const TD = (SMD.team.data && SMD.team.data.SCENARIOS) || {};
    const full = TD[scenarioId] || {};
    const picks = design.picks || {};
    const orbit = (full.orbits || []).find((o) => o.id === picks.orbit) || (full.orbits || [])[0] || {};
    // Europa: the tour and the low orbit both say "jupiter"; the crew's world is Europa.
    let body = orbit.body || meta.dest || 'earth';
    if (scenarioId === 'europa' || (meta.dest === 'jupiter' && body === 'jupiter')) body = 'europa';
    let altKm = orbit.altKm || 600;
    if (body === 'europa' && altKm > 3000) altKm = 200; // the flyby tour, drawn at its Europa pass
    return {
      scenarioId,
      name: meta.title || full.title || '',
      orbitName: orbit.id ? t(`team.scn.${scenarioId}.orbit.${orbit.id}.name`, orbit.name || '') : orbit.name || '',
      body,
      altKm,
      apoKm: orbit.apoKm || 0,
      lands: !!meta.landing,
      deep: body !== 'earth',
      launcher: picks.launcher || design.launcher,
      lifeDays: (flight.result && flight.result.lifeDays) || 0,
      design,
    };
  }

  // How the craft dies decides what the camera sees.
  function endingOf(flight) {
    const r = flight.result || {};
    if (r.alive) return 'success';
    if (r.cause === 'budget') return 'tumble';
    const k = String(r.cause || '').toLowerCase();
    if (/drag/.test(k)) return 'burnup';
    if (/breakup|nav|insertion|flaw|deploy|silence/.test(k)) return 'breakup';
    return 'tumble';
  }

  // ---------- Reading the frames ----------
  // The orbit angle comes from the sunlit flag itself, so the craft really is
  // behind the planet exactly when the battery sags. PI is the middle of eclipse.
  function buildPhases(frames, beta) {
    const runs = [];
    for (let i = 0; i < frames.length; i++) {
      const lit = !!frames[i].sunlit;
      const last = runs[runs.length - 1];
      if (last && last.lit === lit) last.b = i;
      else runs.push({ lit, a: i, b: i });
    }
    const out = new Float64Array(frames.length);
    if (runs.length < 3) {
      const orbits = Math.max(1, Math.round(frames.length / 80));
      for (let i = 0; i < frames.length; i++) out[i] = (i / frames.length) * orbits * Math.PI * 2;
      return out;
    }
    const lits = runs.filter((r) => r.lit).slice(1, -1).map((r) => r.b - r.a + 1);
    const darks = runs.filter((r) => !r.lit).slice(1, -1).map((r) => r.b - r.a + 1);
    const typical = (arr, fb) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : fb);
    const litN = typical(lits, runs[0].lit ? runs[0].b - runs[0].a + 1 : 40);
    const darkN = typical(darks, 20);
    const sunArc = 2 * (Math.PI - beta);
    const darkArc = 2 * beta;
    let rev = 0;
    for (let r = 0; r < runs.length; r++) {
      const run = runs[r];
      const n = run.b - run.a + 1;
      const base = rev * Math.PI * 2;
      for (let i = run.a; i <= run.b; i++) {
        const k = (i - run.a + 0.5) / n;
        if (run.lit) {
          // Partial first and last runs keep their true place on the arc.
          let a0 = -(Math.PI - beta);
          let a1 = Math.PI - beta;
          if (r === 0 && n < litN) a0 = a1 - sunArc * (n / litN);
          if (r === runs.length - 1 && n < litN) a1 = a0 + sunArc * (n / litN);
          out[i] = base + a0 + (a1 - a0) * k;
        } else {
          let a0 = Math.PI - beta;
          let a1 = Math.PI + beta;
          if (r === 0 && n < darkN) a0 = a1 - darkArc * (n / darkN);
          if (r === runs.length - 1 && n < darkN) a1 = a0 + darkArc * (n / darkN);
          out[i] = base + a0 + (a1 - a0) * k;
        }
      }
      if (!run.lit) rev++;
    }
    return out;
  }

  function contactWindows(frames, phases) {
    const wins = [];
    let open = null;
    const on = (f) => (f.inPass !== undefined ? !!f.inPass : (f.downlink || 0) > 0);
    for (let i = 0; i < frames.length; i++) {
      if (on(frames[i]) && !open) open = { a: i, b: i };
      else if (on(frames[i]) && open) open.b = i;
      else if (open) {
        open.phase = phases[Math.round((open.a + open.b) / 2)];
        wins.push(open);
        open = null;
      }
    }
    if (open) {
      open.phase = phases[Math.round((open.a + open.b) / 2)];
      wins.push(open);
    }
    return wins;
  }

  // Bounds so each graph uses its whole height, and always the same scale.
  function scales(frames, ghostFrames) {
    const all = ghostFrames ? frames.concat(ghostFrames) : frames;
    const max = (key) => all.reduce((m, f) => Math.max(m, f[key] || 0), 0);
    return {
      battery: 1,
      buffer: 1,
      downlink: Math.max(1e-6, max('downlink')),
      science: Math.max(100, max('science') * 1.05),
    };
  }

  // The flow engineer's progress tracker and pause menu (docs/TEAM-V2.md "As built (flow)"),
  // when they exist: SMD.team.kit.tracker / kit.pauseMenu, as a function (root, { stage, ctx })
  // or an object with mount(root, { stage, ctx }). Returns the cleanup.
  function attachKit(root, stage, ctx) {
    const kit = SMD.team.kit || {};
    const offs = [];
    // With the shared chrome on screen both return handles; without it, the pause
    // menu brings its own small tracker, so only one of the two is mounted.
    (kit.pauseMenu ? ['pauseMenu'] : ['tracker']).forEach((name) => {
      const f = kit[name];
      const fn = typeof f === 'function' ? f : f && typeof f.mount === 'function' ? f.mount.bind(f) : null;
      if (!fn) return;
      try {
        const out = fn(root, { stage, ctx });
        if (typeof out === 'function') offs.push(out);
        else if (out && typeof out.cleanup === 'function') offs.push(() => out.cleanup());
        else if (out && typeof out.destroy === 'function') offs.push(() => out.destroy());
      } catch (e) {
        console.warn(`kit.${name} failed`, e);
      }
    });
    return () =>
      offs.forEach((off) => {
        try {
          off();
        } catch (e) {}
      });
  }

  SMD.team.flightLogic = { buildPhases, contactWindows, scales, endingOf, attachKit };

  // ---------- The cabin conversation before launch (docs/TEAM-V2.md step 9) ----------
  // Each crewmate says who they are, their job and one human thing, KILO opens
  // and closes. About 25 seconds, skippable. 3D cabin when WebGL is there,
  // calm 2D portraits when it is not.
  function cabinLineup(ctx) {
    const crew = SMD.team.crew;
    if (!crew) return [];
    const v = (ctx && ctx.view) || {};
    const meId = v.me && v.me.id;
    const arr = [];
    (Array.isArray(v.players) ? v.players : []).forEach((p) => {
      if (!p) return;
      const name = p.bot ? '' : p.name || '';
      const you = !!meId && p.id === meId;
      const cid = p.crewId || p.crew || p.character;
      // A player who picked a character is that character, even when (solo) they hold every job.
      if (cid) arr.push({ name, crewId: cid, you });
      else (p.roles || (p.role ? [p.role] : [])).forEach((r) => arr.push({ name, role: r, you }));
    });
    if (!arr.length && ctx && ctx.state && ctx.state.crewId) return crew.lineup(ctx.state.crewId);
    return crew.lineup(arr);
  }

  // opts: { lineup, onDone(skipped), reduced, low }. Returns { skip(), cleanup() }.
  function playCabin(el, opts = {}) {
    const crew = SMD.team.crew;
    const guide = SMD.team.guide;
    const RM = opts.reduced != null ? !!opts.reduced : reduced();
    const lineup = opts.lineup && opts.lineup.length ? opts.lineup : crew ? crew.lineup(null) : [];
    const script = crew ? crew.cabinScript(lineup) : [];
    const kiloFace = (mood, talking) => (guide && guide.portrait ? guide.portrait(mood || 'neutral', { size: 64, talking }) : '');
    const faceOf = (who, size) => (who === 'kilo' ? kiloFace('neutral') : crew ? crew.portrait(who, { size }) : '');
    el.innerHTML = `<div class="tf-cabin">
      <div class="tf-stage" data-stage></div>
      <div class="tf-cabin-flat" data-flat hidden>${lineup.map((r) => `<div class="tf-cabin-seat" data-seat="${esc(r.member.id)}">${faceOf(r.member.id, 132)}</div>`).join('')}</div>
      <header class="tf-cabin-top">
        <div class="tf-cabin-title"><span>${esc(t('team.cabin.title', 'In the capsule'))}</span><small>${esc(t('team.cabin.sub', 'Meet your crew'))}</small></div>
        <ol class="tf-cabin-cast" aria-label="${esc(t('team.cabin.cast', 'The crew'))}">
        ${lineup
          .map(
            (r) => `<li data-cast="${esc(r.member.id)}" style="--c:${r.member.color}">${faceOf(r.member.id, 44)}<span class="tf-cabin-cname">${esc(crew.text(r.member, 'short'))}</span><span class="tf-cabin-cjob"><i aria-hidden="true"></i>${esc(crew.jobName(r.member.job))}</span>${r.you ? `<b class="tf-cabin-you">${esc(t('team.cabin.you', 'You'))}</b>` : r.player ? `<b class="tf-cabin-pl">${esc(r.player)}</b>` : ''}</li>`
          )
          .join('')}
      </ol>
        <button type="button" class="tf-cabin-skip" data-skip>${esc(t('team.cabin.skip', 'Skip to launch'))}</button>
      </header>
      <section class="tf-cabin-say" data-say aria-live="polite">
        <div class="tf-cabin-face" data-face></div>
        <div class="tf-cabin-body">
          <p class="tf-cabin-who"><strong data-name></strong><span data-job></span></p>
          <p class="tf-cabin-line" data-line></p>
        </div>
        <div class="tf-cabin-dots" aria-hidden="true">${script.map((_, i) => `<i data-dot="${i}"></i>`).join('')}</div>
      </section>
    </div>`;
    const root = el.querySelector('.tf-cabin');
    const $ = (q) => root.querySelector(q);
    const stageEl = $('[data-stage]');
    const faceEl = $('[data-face]');
    const nameEl = $('[data-name]');
    const jobEl = $('[data-job]');
    const lineEl = $('[data-line]');
    let dead = false;
    let api3d = null;
    let i = -1;
    let typing = 0;
    let hold = 0;
    let finished = false;

    // 3D cabin, else the flat portraits.
    const flat = () => {
      $('[data-flat]').hidden = false;
      root.classList.add('tf-cabin-2d');
    };
    const have3D = SMD.three && SMD.three.engine && SMD.three.engine.supported && SMD.three.engine.supported();
    if (!have3D || opts.no3d) flat();
    else
      import(new URL('js/team/flight3d.js', document.baseURI).href)
        .then((m) => m.createCabin({ lineup, reduced: RM, low: !!(SMD.settings && SMD.settings.tier && SMD.settings.tier() === 'low') }))
        .then((api) => {
          if (dead) return api.dispose();
          api3d = api;
          SMD.three.engine.mount(stageEl, api);
          const cur = script[Math.max(0, i)];
          if (cur) api.focus(cur.who);
          if (cur && cur.who === 'kilo') api.kilo.setMood(cur.mood);
        })
        .catch((e) => {
          console.warn('cabin 3D could not load', e);
          flat();
        });

    function stopTyping() {
      clearInterval(typing);
      typing = 0;
      const cur = script[i];
      if (api3d && cur) api3d.talk(cur.who, false);
      if (cur && cur.who === 'kilo') faceEl.innerHTML = kiloFace(cur.mood, false);
    }
    function show(n) {
      i = n;
      const line = script[i];
      clearTimeout(hold);
      stopTyping();
      root.querySelectorAll('[data-dot]').forEach((d, k) => d.classList.toggle('tf-on', k <= i));
      root.querySelectorAll('[data-cast]').forEach((c) => c.classList.toggle('tf-on', c.dataset.cast === line.who));
      root.querySelectorAll('[data-seat]').forEach((c) => c.classList.toggle('tf-on', c.dataset.seat === line.who));
      if (line.who === 'kilo') {
        nameEl.textContent = guide && guide.name ? guide.name() : t('guide.name', 'KILO');
        jobEl.textContent = t('team.cabin.kilojob', 'Mission guide');
        faceEl.innerHTML = kiloFace(line.mood, true);
        root.style.setProperty('--speaker', ({ brace: '#ffb24d', praline: '#e8a93a', cairn: '#7fe8d8' })[guide && guide.current ? guide.current() : 'kilo'] || '#9ff3dc');
      } else {
        const m = crew.byId(line.who);
        nameEl.textContent = crew.text(m, 'name');
        jobEl.textContent = `${crew.jobName(m.job)} · ${crew.text(m, 'from')}${line.you ? ` · ${t('team.cabin.you', 'You')}` : line.player ? ` · ${line.player}` : ''}`;
        faceEl.innerHTML = crew.portrait(m, { size: 64 });
        root.style.setProperty('--speaker', m.color);
      }
      if (api3d) {
        api3d.focus(line.who);
        if (line.who === 'kilo') api3d.kilo.setMood(line.mood);
        api3d.talk(line.who, true);
      }
      const full = line.text;
      if (RM) {
        lineEl.textContent = full;
        return afterTyped();
      }
      let k = 0;
      lineEl.textContent = '';
      typing = setInterval(() => {
        if (dead) return stopTyping();
        k = Math.min(full.length, k + 1);
        lineEl.textContent = full.slice(0, k);
        if (k >= full.length) {
          stopTyping();
          afterTyped();
        }
      }, 24);
    }
    function afterTyped() {
      const len = (script[i] && script[i].text.length) || 0;
      hold = setTimeout(autoNext, clamp(1100 + len * 22, 2000, 4000));
    }
    // The room is paused: wait, then carry on.
    function autoNext() {
      if (typeof opts.paused === 'function' && opts.paused()) {
        hold = setTimeout(autoNext, 400);
        return;
      }
      next();
    }
    function next() {
      if (dead || finished) return;
      if (typing) {
        stopTyping();
        lineEl.textContent = script[i].text;
        return afterTyped();
      }
      if (i < script.length - 1) return show(i + 1);
      done(false);
    }
    function done(skipped) {
      if (finished) return;
      finished = true;
      clearTimeout(hold);
      stopTyping();
      root.classList.add('tf-cabin-go');
      lineEl.textContent = t('team.cabin.go', 'Launching…');
      if (api3d) api3d.focus('wide');
      if (typeof opts.onDone === 'function') {
        try {
          opts.onDone(!!skipped);
        } catch (e) {}
      }
    }
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
        if (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
        e.preventDefault();
        next();
      } else if (e.key === 'Escape') done(true);
    };
    $('[data-say]').addEventListener('click', next);
    stageEl.addEventListener('click', next);
    $('[data-skip]').addEventListener('click', () => done(true));
    document.addEventListener('keydown', onKey);
    if (script.length) show(0);
    else done(false);

    return {
      skip: () => done(true),
      next,
      cleanup() {
        dead = true;
        clearTimeout(hold);
        clearInterval(typing);
        document.removeEventListener('keydown', onKey);
        try {
          if (api3d) {
            SMD.three.engine.stop();
            api3d.dispose();
          }
        } catch (e) {}
      },
    };
  }
  SMD.team.cabin = { play: playCabin, lineup: cabinLineup };

  // The phase view: the room enters 'cabin' between lock and flight (see docs/TEAM-V2.md).
  views.cabin = {
    mount(el, ctx) {
      let sent = false;
      const h = playCabin(el, {
        lineup: cabinLineup(ctx),
        paused: () => !!(ctx.view && ctx.view.paused),
        onDone() {
          if (sent) return;
          sent = true;
          try {
            if (ctx.send) ctx.send({ type: 'skipCabin' });
          } catch (e) {}
        },
      });
      const kitOff = attachKit(el.querySelector('.tf-cabin') || el, 'cabin', ctx);
      return {
        cleanup() {
          kitOff();
          h.cleanup();
        },
      };
    },
  };

  // ---------- The view ----------
  views.flight = {
    mount(el, ctx) {
      const firstFlight = flightOf(ctx);
      if (!firstFlight) {
        el.innerHTML = `<div class="tf-flight"><div class="tf-end tf-show"><h1 class="tf-end-title">${esc(t('team.flight.noflight', 'No flight data yet.'))}</h1></div></div>`;
        return () => {};
      }
      let flight = firstFlight;
      const info = missionInfo(ctx, flight);
      const RM = reduced();
      const body = BODY_R[info.body] ? info.body : 'earth';
      const R = BODY_R[body] * 1000;
      const beta = Math.asin(R / (R + info.altKm * 1000));

      let frames;
      let phases;
      let wins;
      let slowK = 1;
      let T0 = 0;
      let tEnd = 0;
      let tOps = 0;
      let tEndPhase = 0;
      let tDead = null;
      let sc;
      const ghostRaw = (ctx.state && ctx.state.ghost) || null;
      const ghostFrames = ghostRaw && Array.isArray(ghostRaw.frames) && ghostRaw.frames.length ? ghostRaw.frames : null;

      function loadFlight(f) {
        flight = f;
        frames = f.frames;
        phases = buildPhases(frames, beta);
        wins = contactWindows(frames, phases);
        T0 = frames[0].t;
        tEnd = frames[frames.length - 1].t;
        const ops = frames.findIndex((x) => x.phase === 'ops');
        tOps = ops >= 0 ? frames[ops].t : T0;
        const endI = frames.findIndex((x) => x.phase === 'end' && x.alive !== false);
        tEndPhase = endI >= 0 ? frames[endI].t : tEnd;
        // First frame after the craft died (the run keeps ticking after it, on purpose).
        const deadI = frames.findIndex((x) => x.alive === false);
        tDead = deadI >= 0 ? frames[deadI].t : null;
        // The sim flies an orbit in a couple of seconds; the wide shot shows that,
        // the close-ups use a slower apparent orbit so the world does not blur.
        const revs = Math.max(1 / 8, Math.abs(phases[phases.length - 1] - phases[0]) / (Math.PI * 2));
        const period = (tEnd - T0) / revs;
        slowK = Math.max(1, Math.round(14 / Math.max(0.1, period)));
        sc = scales(frames, ghostFrames);
      }
      loadFlight(flight);

      // ---------- DOM ----------
      // Three calm graphs. Whether the data is going home right now is the link chip.
      const G = [
        { id: 'battery', label: t('team.flight.battery', 'Battery'), color: '#7fe0a8', bad: (v) => v < 0.25 },
        { id: 'buffer', label: t('team.flight.buffer', 'Recorder'), color: '#f2c57c', bad: (v) => v > 0.95 },
        { id: 'science', label: t('team.flight.science', 'Science'), color: '#9fc3ff', bad: () => false },
      ];
      el.innerHTML = `<div class="tf-flight" data-phase="launch">
        <div class="tf-stage" data-stage></div>
        <canvas class="tf-2d" data-2d hidden aria-hidden="true"></canvas>
        <div class="tf-eclipse-tint" aria-hidden="true"></div>
        <header class="tf-top">
          <div class="tf-mission"><span class="tf-mission-name">${esc(info.name)}</span><span class="tf-mission-orbit">${esc(info.orbitName)}</span></div>
          <div class="tf-day-wrap"><div class="tf-sunbadge" data-sunbadge><span class="tf-sunicon" aria-hidden="true"></span><span data-sunword></span></div><div class="tf-day" data-daybox hidden><span class="tf-day-num" data-day>0</span><span class="tf-day-of" data-dayof></span></div></div>
          <div class="tf-link" data-link><span class="tf-link-dot" aria-hidden="true"></span><span data-linkword>${esc(t('team.flight.nolinkyet', 'Waiting for contact'))}</span></div>
          ${ghostFrames ? `<div class="tf-ghost-chip"><span aria-hidden="true"></span>${esc(t('team.flight.ghost', 'Ghost: your last flight'))}</div>` : ''}
          <button type="button" class="tf-vr" data-vr hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v6a2.5 2.5 0 0 1-2.5 2.5h-3.2l-1.6-2.4a2 2 0 0 0-3.4 0L8.7 17H5.5A2.5 2.5 0 0 1 3 14.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="8" cy="11.5" r="1.8" fill="currentColor"/><circle cx="16" cy="11.5" r="1.8" fill="currentColor"/></svg><span data-vr-label>${esc(t('team.flight.vr', 'View in VR'))}</span></button>
        </header>
        <div class="tf-coach" data-coach aria-live="polite"></div>
        <div class="tf-alarm" data-alarm hidden role="alert"></div>
        <div class="tf-countdown" data-count aria-live="assertive"></div>
        <section class="tf-graphs" data-graphs aria-label="${esc(t('team.flight.graphs', 'Live graphs'))}">
          ${G.map(
            (g) => `<div class="tf-g" data-g="${g.id}" style="--c:${g.color}">
            <div class="tf-g-head"><span class="tf-g-label">${esc(g.label)}</span><span class="tf-g-value" data-v>0</span></div>
            <div class="tf-g-chart"><canvas data-c></canvas></div>
            <div class="tf-g-note" data-n></div>
          </div>`
          ).join('')}
        </section>
        <div class="tf-end" data-end hidden></div>
        <div class="tf-landtags" data-landtags aria-hidden="true"><span class="tf-landtag" data-tag="orbiter" hidden></span><span class="tf-landtag" data-tag="lander" hidden></span></div>
        <button type="button" class="tf-skip tf-landskip" data-landskip hidden>${esc(t('team.flight.skipland', 'Skip'))}</button>
      </div>`;
      const root = el.querySelector('.tf-flight');
      const $ = (q) => root.querySelector(q);
      const stageEl = $('[data-stage]');
      const cv2 = $('[data-2d]');
      const graphEls = {};
      G.forEach((g) => {
        const w = root.querySelector(`[data-g="${g.id}"]`);
        graphEls[g.id] = { el: w, c: w.querySelector('[data-c]'), v: w.querySelector('[data-v]'), n: w.querySelector('[data-n]'), g, last: '' };
      });

      // ---------- Clock and 3D ----------
      let api3d = null;
      const VR_ON = false;
      let flightMod = null;
      let vrOK = false;
      let vr = null;
      let lastWinFrame = performance.now();
      let dead = false;
      let use2D = false;
      const filmSeconds3D = () => (api3d && api3d.filmSeconds) || (RM ? 4 : 8.4);
      let landingLen = 6.5;
      let mode = 'film'; // film | cruise | orbit | end
      let raf = 0;
      let last = performance.now();
      const landAfter = () => !!(info.lands && flight.result && flight.result.alive && tDead === null);
      const ending = endingOf(flight);
      const engineSnd = { h: null };
      const t0Local = performance.now();
      let t0LocalShift = 0; // time spent paused, when the clock is local

      function simNow() {
        const fl = ctx.state && ctx.state.flight;
        if (fl && Number.isFinite(fl.startedAt) && fl.msPerT > 0) return nowMs(fl) / fl.msPerT;
        return T0 + (performance.now() - t0Local - t0LocalShift) / 1000;
      }
      // The room clock is the host's Date.now.
      function nowMs(fl) {
        const n = Date.now();
        return Math.abs(n - fl.startedAt) < 1e7 ? n - fl.startedAt : performance.now() - t0Local;
      }

      const start3D = (mod) => {
        if (dead) return;
        const engine = SMD.three.engine;
        landingLen = (RM && mod.LANDING_SECONDS_REDUCED) || mod.LANDING_SECONDS;
        let craft = null;
        try {
          craft = ctx.sim.toCraftDesign(info.design);
        } catch (e) {}
        const cdesign = craft || { arrays: 10, dish: 2, instruments: ['hires'] };
        api3d = mod.createFlight({
          body,
          altKm: info.altKm,
          craft: cdesign,
          info: cdesign.info || { dryKg: 400, propKg: 200 },
          launcher: info.launcher,
          deep: info.deep,
          lands: info.lands,
          reduced: RM,
          low: !!(SMD.settings && SMD.settings.tier && SMD.settings.tier() === 'low'),
        });
        api3d.filmSeconds = RM ? mod.LAUNCH_SECONDS_REDUCED : mod.LAUNCH_SECONDS;
        engine.mount(stageEl, api3d);
        // View in VR (docs/TEAM-V3.md item 16): only when a headset can start a session.
        flightMod = mod;
        // Parked for now (scope cut, TEAM-V3.md): set VR_ON to offer it again.
        if (VR_ON && mod.vrSupported)
          mod
            .vrSupported()
            .then((ok) => {
              vrOK = !!ok && !dead;
              showVR();
            })
            .catch(() => {});
      };
      const start2D = () => {
        if (dead || use2D) return;
        use2D = true;
        cv2.hidden = false;
        root.classList.add('tf-no3d');
      };
      const have3D = SMD.three && SMD.three.engine && SMD.three.engine.supported && SMD.three.engine.supported();
      if (!have3D) start2D();
      else
        import(new URL('js/team/flight3d.js', document.baseURI).href)
          .then((m) => {
            try {
              start3D(m);
            } catch (e) {
              console.warn('flight 3D failed, using the 2D view', e);
              start2D();
            }
          })
          .catch((e) => {
            console.warn('flight 3D could not load', e);
            start2D();
          });

      // ---------- Film time ----------
      // The sim gives the launch and cruise only a few seconds before orbit; the
      // film is cut to fit exactly into them.
      const filmEnd = () => Math.max(3, Math.min(filmSeconds3D(), tOps - T0 > 0 ? tOps - T0 : filmSeconds3D()));
      const filmT = (tv) => clamp((tv - T0) / filmEnd(), 0, 1) * filmSeconds3D();

      function launchSound(T, prev) {
        const crossed = (x) => prev < x && T >= x;
        [0.05, 1, 2].forEach((x) => {
          if (crossed(x)) beep(880, 0.12, 'square', 0.16);
        });
        if (crossed(2.55) && !RM) {
          try {
            SMD.audio.bang(0.8, 1.2);
            engineSnd.h = SMD.audio.engine();
            engineSnd.h.set(0.5, 0.25);
          } catch (e) {}
        }
        const dur = filmSeconds3D();
        if (engineSnd.h && T > 2.6 && T < dur) engineSnd.h.set(0.55 - (T / dur) * 0.3, 0.15 + (T / dur) * 0.8);
        if (crossed(5.45) && !RM) seq([1200, 700], 60, 'sine', 0.2);
      }

      const countEl = $('[data-count]');
      function launchOverlay(T) {
        if (RM) return;
        let text = '';
        if (T < 0.95) text = '3';
        else if (T < 1.9) text = '2';
        else if (T < 2.55) text = '1';
        else if (T < 3.6) text = t('team.flight.liftoff', 'Liftoff');
        else if (T > 5.3 && T < 6.2) text = t('team.flight.stagesep', 'Stage separation');
        else if (T > 6.5 && T < 7.8) text = t('team.flight.deploy', 'Panels open');
        if (countEl.dataset.t !== text) {
          countEl.dataset.t = text;
          countEl.textContent = text;
          countEl.classList.remove('tf-pop');
          void countEl.offsetWidth;
          countEl.classList.add('tf-pop');
        }
      }

      // ---------- Coaching, numbers ----------
      // KILO says it in a corner, one short line at a time; the old centre line is the fallback.
      const coachEl = $('[data-coach]');
      let coachTimer = 0;
      const MOOD_OF = { bad: 'worried', dark: 'thinking', contact: 'happy', info: 'neutral' };
      const guide = SMD.team.guide;
      function coach(text, kind, mood) {
        if (!text) return;
        if (guide && guide.say) {
          if (shownCrisis) return; // never two panels of reading
          guide.say(root, [{ text, mood: mood || MOOD_OF[kind] || 'neutral' }], { auto: true, keep: false });
          return;
        }
        coachEl.textContent = text;
        coachEl.className = 'tf-coach tf-show' + (kind ? ` tf-${kind}` : '');
        clearTimeout(coachTimer);
        coachTimer = setTimeout(() => (coachEl.className = 'tf-coach'), 3000);
      }
      // KILO's own words for a moment, else the given fallback.
      const kiloLine = (moment, fb) => {
        const l = guide && guide.scriptFor ? guide.scriptFor(info.scenarioId, moment)[0] : null;
        return l || { text: fb, mood: 'neutral' };
      };
      function kiloOnce(id, moment, fb, kind) {
        if (told[id]) return;
        told[id] = 1;
        const l = kiloLine(moment, fb);
        coach(l.text, kind, l.mood);
      }
      const told = {};
      function once(id, text, kind) {
        if (told[id]) return;
        told[id] = 1;
        coach(text, kind);
      }

      const sunWord = $('[data-sunword]');
      const sunBadge = $('[data-sunbadge]');
      const dayEl = $('[data-day]');
      const dayOf = $('[data-dayof]');
      const dayBox = $('[data-daybox]');
      if (info.lifeDays) {
        dayBox.hidden = false;
        dayOf.textContent = t('team.flight.dayof', 'of {d} days', { d: info.lifeDays });
      }
      let wasLit = null;
      let linkHold = 0;
      let wasLink = false;
      let lowBatTold = false;
      const linkChip = $('[data-link]');
      const linkWord = $('[data-linkword]');

      function sample(i0) {
        const i = clamp(i0, 0, frames.length - 1);
        const a = Math.floor(i);
        const b = Math.min(frames.length - 1, a + 1);
        const k = i - a;
        const fa = frames[a];
        const fb = frames[b];
        const mix = (key) => (fa[key] || 0) + ((fb[key] || 0) - (fa[key] || 0)) * k;
        const phase = phases[a] + (phases[b] - phases[a]) * k;
        return { i, a, sunlit: !!fa.sunlit, inPass: !!fa.inPass, battery: mix('battery'), buffer: mix('buffer'), downlink: mix('downlink'), science: mix('science'), fuel: mix('fuel'), alive: fa.alive !== false, phase };
      }
      function idxForT(tv) {
        const n = frames.length;
        let i = clamp(Math.round(((tv - T0) / Math.max(1e-6, tEnd - T0)) * (n - 1)), 0, n - 1);
        while (i > 0 && frames[i].t > tv) i--;
        while (i < n - 1 && frames[i + 1].t <= tv) i++;
        const next = frames[Math.min(n - 1, i + 1)];
        const seg = next.t - frames[i].t;
        return i + (seg > 0 ? clamp((tv - frames[i].t) / seg, 0, 1) : 0);
      }

      // ---------- Graphs ----------
      function fitCanvas(c) {
        const r = c.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.round(r.width * dpr));
        const h = Math.max(1, Math.round(r.height * dpr));
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        return { w, h, dpr };
      }
      const seriesNorm = (id, f) => ((f && f[id]) || 0) / sc[id];
      const opsStartIdx = () => Math.max(0, frames.findIndex((x) => x.phase === 'ops'));

      function drawGraph(g, curIdx) {
        const c = graphEls[g.id].c;
        const { w, h, dpr } = fitCanvas(c);
        const x = c.getContext('2d');
        x.clearRect(0, 0, w, h);
        const pad = 2 * dpr;
        const H = h - pad * 2;
        const W = w - pad * 2;
        // Plot from the start of orbit: launch frames are flat and only waste width.
        const i0 = opsStartIdx();
        const n = frames.length - i0;
        const px = (i) => pad + ((i - i0) / Math.max(1, n - 1)) * W;
        const py = (v) => pad + (1 - clamp(v, -0.05, 1.1)) * H * 0.9 + H * 0.05;
        if (g.id === 'battery' || g.id === 'buffer') {
          x.fillStyle = 'rgba(140,150,230,0.13)'; // the shadow, softly
          let s0 = null;
          for (let i = i0; i < frames.length; i++) {
            const lit = frames[i].sunlit;
            if (!lit && s0 === null) s0 = i;
            if ((lit || i === frames.length - 1) && s0 !== null) {
              x.fillRect(px(s0), 0, Math.max(1, px(i) - px(s0)), h);
              s0 = null;
            }
          }
        }
        if (g.id === 'buffer' || g.id === 'science') {
          x.strokeStyle = 'rgba(242,245,255,0.35)';
          x.setLineDash([6 * dpr, 5 * dpr]);
          x.lineWidth = 1.5 * dpr;
          x.beginPath();
          const y0 = g.id === 'buffer' ? py(1) : py(100 / sc.science);
          x.moveTo(0, y0);
          x.lineTo(w, y0);
          x.stroke();
          x.setLineDash([]);
        }
        if (ghostFrames) {
          x.strokeStyle = 'rgba(242,245,255,0.6)';
          x.lineWidth = 2 * dpr;
          x.setLineDash([3 * dpr, 4 * dpr]);
          x.beginPath();
          const gn = ghostFrames.length;
          const gStart = Math.max(0, ghostFrames.findIndex((f) => f.phase === 'ops'));
          let moved = false;
          for (let i = gStart; i < gn; i += Math.max(1, Math.floor(gn / 300))) {
            const X = pad + ((i - gStart) / Math.max(1, gn - gStart - 1)) * W;
            const Y = py(seriesNorm(g.id, ghostFrames[i]));
            if (!moved) {
              x.moveTo(X, Y);
              moved = true;
            } else x.lineTo(X, Y);
          }
          x.stroke();
          x.setLineDash([]);
        }
        const end = Math.floor(curIdx);
        if (end > i0) {
          const color = g.color;
          {
            x.beginPath();
            const step = Math.max(1, Math.floor(n / 400));
            for (let i = i0; i <= end; i += step) {
              const y = py(seriesNorm(g.id, frames[i]));
              if (i === i0) x.moveTo(px(i), y);
              else x.lineTo(px(i), y);
            }
            x.lineTo(px(end), py(seriesNorm(g.id, frames[end])));
            x.lineWidth = 2.5 * dpr;
            x.strokeStyle = color;
            x.lineJoin = 'round';
            x.stroke();
            x.lineTo(px(end), h);
            x.lineTo(px(i0), h);
            x.closePath();
            x.globalAlpha = 0.12;
            x.fillStyle = color;
            x.fill();
            x.globalAlpha = 1;
          }
          const cy = py(seriesNorm(g.id, frames[end]));
          x.fillStyle = '#fff';
          x.beginPath();
          x.arc(px(end), cy, 3.5 * dpr, 0, Math.PI * 2);
          x.fill();
        }
      }

      // ---------- Alarms: read from the room ----------
      const alarmEl = $('[data-alarm]');
      let shownCrisis = null;
      // Real space weather (js/team/real-data.js): name a real event on the solar-storm alarm,
      // and warm the optional live NASA DONKI lookup so a recent real flare can be shown too.
      const RD = SMD.team.realData;
      let liveFlare = null;
      if (RD && RD.liveRecentFlare) RD.liveRecentFlare().then((f) => (liveFlare = f)).catch(() => {});
      function realEventLine(c) {
        if (!RD || !c || c.type !== 'solarStorm') return '';
        const ev = RD.spaceWeatherFor(`${(ctx.state && ctx.state.seed) || ''}:${c.id}`);
        let line = `${t('team.flight.real', 'Real event')}: ${t(`team.rd.${ev.id}.title`, ev.title)} (${ev.date}). ${t(`team.rd.${ev.id}.lesson`, ev.lesson)}`;
        if (liveFlare && liveFlare.classType) line += ` ${t('team.flight.realnow', 'Latest flare NASA lists in the last 30 days: {c}.', { c: liveFlare.classType })}`;
        return `<p class="tf-alarm-real" title="${esc(ev.sourceName)}">${esc(line)}</p>`;
      }
      function activeCrisis() {
        const list = (ctx.view && ctx.view.crises) || [];
        return list.find((c) => c.status === 'active' || c.status === undefined) || null;
      }
      function renderCrisis(c) {
        if (!c) {
          if (shownCrisis) {
            alarmEl.hidden = true;
            alarmEl.innerHTML = '';
            root.classList.remove('tf-alarming');
            if (api3d) api3d.set({ alarm: 0 });
            shownCrisis = null;
          }
          return;
        }
        const id = c.id;
        const dur = c.duration || 8;
        let left = c.endsAt && Math.abs(c.endsAt - Date.now()) < 6e4 ? (c.endsAt - Date.now()) / 1000 : c.leftS;
        left = clamp(left, 0, dur);
        if (id !== shownCrisis) {
          shownCrisis = id;
          const opp = c.kind === 'opportunity';
          alarmEl.hidden = false;
          alarmEl.className = `tf-alarm${opp ? ' tf-opp' : ''}`;
          const fixRole = c.fixRole ? roleName(c.fixRole) : '';
          const alarmRole = c.role ? roleName(c.role) : '';
          const oneScreen = ctx.device === 'one' || !!c.fixes;
          const cr = (part, en) => {
            if (!c.type || !en) return en;
            const D = SMD.team.data || {};
            const tpl = (D.CRISES || []).concat(D.OPPORTUNITIES || []).find((x) => x.id === c.type);
            let base = en;
            if (tpl && part === 'title') base = tpl.title || en;
            else if (tpl && part === 'alarm') base = tpl.alarm || en;
            else if (tpl && part.startsWith('action.')) base = ((tpl.actions || []).find((a) => `action.${a.id}` === part) || {}).label || en;
            return t(`team.crisis.${c.type}.${part}`, base);
          };
          const title = cr('title', c.title || (c.alarm && c.alarm.title) || '');
          const text = cr('alarm', (c.alarm && c.alarm.text) || '');
          alarmEl.innerHTML = `<div class="tf-alarm-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" class="tf-ring-bg"/><circle cx="50" cy="50" r="44" class="tf-ring" data-ring pathLength="1"/></svg><span class="tf-ring-num" data-left></span></div>
            <div class="tf-alarm-body">
              <p class="tf-alarm-kick">${esc(opp ? t('team.flight.opp', 'Opportunity') : t('team.flight.problem', 'Problem'))}</p>
              <h2 class="tf-alarm-title">${esc(title)}</h2>
              ${text && text !== title ? `<p class="tf-alarm-text">${esc(text)}</p>` : ''}
              ${realEventLine(c)}
              ${!oneScreen && fixRole ? `<p class="tf-alarm-shout">${esc(alarmRole)} <span aria-hidden="true">${SMD.dir && SMD.dir() === 'rtl' ? '&larr;' : '&rarr;'}</span> <strong>${esc(t('team.flight.shoutfix', '{r} has the fix. Shout!', { r: fixRole }))}</strong></p>` : ''}
              ${oneScreen && c.fixes && c.fixes.length ? `<div class="tf-alarm-fixes">${c.fixes.map((f) => `<button type="button" class="tf-fix" data-fix="${esc(f.id)}">${esc(cr(`action.${f.id}`, f.label))}</button>`).join('')}</div>` : ''}
            </div>`;
          alarmEl.querySelectorAll('[data-fix]').forEach((b) =>
            b.addEventListener('click', () => {
              ctx.send({ type: 'crisisAct', crisisId: id, optionId: b.dataset.fix });
              alarmEl.classList.add('tf-acted');
            })
          );
          root.classList.add('tf-alarming');
          if (guide && guide.clear) guide.clear(); // one panel of reading at a time
          if (api3d) api3d.set({ alarm: opp ? 0.4 : 1 });
          // One alarm sound when it starts, not a siren.
          try {
            if (!opp) SMD.audio.alarm();
            else seq([740, 988], 90, 'triangle', 0.1);
          } catch (e) {}
        }
        const ring = alarmEl.querySelector('[data-ring]');
        const num = alarmEl.querySelector('[data-left]');
        if (ring) ring.style.strokeDashoffset = String(1 - left / dur);
        if (num) num.textContent = Math.ceil(left);
      }

      // ---------- Endings ----------
      const endEl = $('[data-end]');
      const fanfare = () => seq([523, 659, 784, 1047], 150, 'triangle', 0.1);
      const dirge = () => seq([330, 247, 196], 560, 'triangle', 0.1);
      const causeText = (c) => t(`team.cause.${c}`, (SMD.team.data && SMD.team.data.STR && SMD.team.data.STR[`cause.${c}`]) || c);

      function showEnding(kind) {
        const r = flight.result || {};
        let html;
        if (kind === 'dead') {
          dirge();
          html = `<p class="tf-end-kick tf-bad">${esc(t('team.flight.lost', 'Signal lost'))}</p>
            <h1 class="tf-end-title">${esc(r.cause ? causeText(r.cause) : t('team.flight.lostcause', 'We lost the spacecraft.'))}</h1>`;
        } else if (kind === 'landing') {
          html = `<p class="tf-end-kick">${esc(t('team.flight.orbitok', 'Orbit reached'))}</p><h1 class="tf-end-title">${esc(t('team.flight.landingnext', 'Crew: going down'))}</h1><div class="tf-end-sub">${esc(t('team.flight.grabctl', 'Grab your controllers.'))}</div>`;
        } else {
          fanfare();
          const good = r.success === 'full' || r.success === 'partial';
          html = `<p class="tf-end-kick ${good ? 'tf-gold' : ''}">${esc(good ? t('team.flight.success', 'Mission success') : t('team.flight.finished', 'Mission over'))}</p>
            <h1 class="tf-end-title">${esc(good ? t('team.flight.trainingdone', 'Training flight complete') : t('team.flight.lowsci', 'The science barely got home'))}</h1>
            <div class="tf-end-sub">${esc(t('team.flight.sciencehome', 'Science: {s}', { s: `${Math.round(r.science || 0)}%` }))}</div>`;
        }
        endEl.innerHTML = html;
        endEl.hidden = false;
        requestAnimationFrame(() => endEl.classList.add('tf-show'));
        root.classList.add(kind === 'dead' ? 'tf-lost' : 'tf-won');
      }

      function startEnding() {
        if (mode === 'end') return;
        mode = 'end';
        root.dataset.phase = 'end';
        renderCrisis(null);
        const r = flight.result || {};
        if (landAfter()) {
          showEnding('landing');
          const ll = kiloLine('landing', t('team.flight.landingnext', 'Crew: going down'));
          coach(ll.text, 'info', ll.mood);
          if (api3d) api3d.set({ mode: 'landing' });
          if (api3d && api3d.landKind === 'venus') root.style.setProperty('--tf-fade-c', '#d8b27a'); // into the clouds, not the dark
          root.classList.add('tf-landfilm');
          landSkipEl.hidden = false;
        } else if (r.alive === false || tDead !== null) {
          showEnding('dead');
          if (api3d) api3d.set({ end: { kind: ending, t: 0 } });
        } else {
          showEnding('success');
          if (api3d) api3d.set({ end: { kind: 'success', t: 0 } });
        }
      }

      // ---------- Separation and descent: what the film is showing ----------
      // The orbiter stays up as the relay; the lander goes down on its own.
      const landSkipEl = $('[data-landskip]');
      const tagsEl = $('[data-landtags]');
      const tagEls = { orbiter: tagsEl.querySelector('[data-tag="orbiter"]'), lander: tagsEl.querySelector('[data-tag="lander"]') };
      let landSkipped = false;
      const BEAT_TEXT = {
        docked: () => (info.body === 'venus' ? t('team.flight.beat.dockedVenus', 'Orbiter and cloud platform, docked') : t('team.flight.beat.docked', 'Orbiter and lander, docked')),
        separation: () => t('team.flight.beat.separation', 'Separation'),
        orbiter: () => t('team.flight.beat.orbiter', 'The orbiter stays in orbit'),
        deorbit: () => t('team.flight.beat.deorbit', 'Deorbit burn'),
        powered: () => t('team.flight.beat.powered', 'Rocket descent: no air here for a parachute'),
        entry: () => t('team.flight.beat.entry', 'Entry: the heat shield glows'),
        chute: () => t('team.flight.beat.chute', 'Parachute'),
        retro: () => t('team.flight.beat.retro', 'Retro-rockets'),
        balloon: () => t('team.flight.beat.balloon', 'The balloon fills'),
        float: () => t('team.flight.beat.float', 'Floating in the clouds, about 50 km up'),
      };
      const beatText = (b) => (BEAT_TEXT[b] ? BEAT_TEXT[b]() : '');
      function landBeats(beat, lt) {
        if (beat === 'separation' && !told.sep) {
          told.sep = 1;
          const l = kiloLine('separation', t('team.flight.sepline', 'The orbiter stays up there. It will carry our data home.'));
          coach(l.text, 'info', l.mood);
          if (!RM) beep(196, 0.18, 'triangle', 0.08); // the springs let go
        }
        if (beat === 'deorbit' && !told.burn) {
          told.burn = 1;
          if (!RM) {
            try {
              engineSnd.h = SMD.audio.engine();
              engineSnd.h.set(0.3, 0.3);
            } catch (e) {}
          }
        }
        if (landSkipped || lt > landingLen - 1.2) landSkipEl.hidden = true;
        // Labels on the two craft while both are worth naming.
        const tags = api3d && api3d.landTags ? api3d.landTags() : null;
        const W = stageEl.clientWidth;
        const H = stageEl.clientHeight;
        ['orbiter', 'lander'].forEach((id) => {
          const el = tagEls[id];
          const p = tags && tags[id];
          const show = !!p && p.on && tags.t > 0.5 && tags.t < (id === 'orbiter' ? 4.8 : 3.0) && !landSkipped;
          el.hidden = !show;
          if (!show) return;
          if (!el.textContent) el.textContent = id === 'orbiter' ? t('team.flight.tag.orbiter', 'Orbiter: our relay') : info.body === 'venus' ? t('team.flight.tag.platform', 'Cloud platform') : t('team.flight.tag.lander', 'Lander');
          el.style.transform = `translate(${Math.round(((p.x + 1) / 2) * W)}px, ${Math.round(((1 - p.y) / 2) * H)}px)`;
          el.classList.toggle('tf-flip', p.x > 0.3); // near the right edge: label on the left
        });
      }
      landSkipEl.addEventListener('click', () => {
        if (landSkipped) return;
        landSkipped = true;
        landSkipEl.hidden = true;
        // The host (or a solo player) moves the room on; anyone else just skips the picture.
        if (!activeCrisis()) {
          try {
            ctx.send({ type: 'next' });
          } catch (e) {}
        }
      });

      // ---------- Each animation frame ----------
      let filmPrev = 0;
      // The separation and descent film (docs/TEAM-V3.md) starts where the old landing dive
      // did, LAND_LEAD flight seconds before the last frame (so crises are hidden exactly as
      // before), and runs on in real seconds into the room's short hold after the flight.
      const LAND_LEAD = 6.5;
      const secPerT = () => {
        const fl = ctx.state && ctx.state.flight;
        return fl && fl.msPerT > 0 ? fl.msPerT / 1000 : 1;
      };
      function endingStart() {
        if (landAfter()) return tEnd - Math.min(landingLen, LAND_LEAD);
        if (tDead !== null) return tDead;
        return tEndPhase;
      }
      // Paused (docs/TEAM-V2.md "Pause"): hold the picture; the room slides its clock forward.
      let pausedAt = 0;
      function frame(now) {
        if (dead) return;
        raf = requestAnimationFrame(frame);
        lastWinFrame = performance.now();
        step(now);
      }
      function step(now) {
        if (dead) return;
        if (ctx.view && ctx.view.paused) {
          if (!pausedAt) pausedAt = performance.now();
          last = now;
          return;
        }
        if (pausedAt) {
          t0LocalShift += performance.now() - pausedAt;
          pausedAt = 0;
        }
        const dt = clamp((now - last) / 1000, 0, 0.06);
        last = now;
        const tNow = simNow();

        if (mode === 'film') {
          const T = filmT(tNow);
          launchSound(T, filmPrev);
          filmPrev = T;
          launchOverlay(T);
          if (api3d) api3d.set({ mode: 'launch', launchT: T });
          if (use2D) draw2D(T, null);
          if (T >= filmSeconds3D()) {
            mode = 'cruise';
            countEl.textContent = '';
            if (engineSnd.h) {
              engineSnd.h.stop();
              engineSnd.h = null;
            }
            if (info.deep && tOps - tNow > 1.6) coach(t('team.flight.arrival', 'Months later. We have arrived.'), 'info');
            else kiloOnce('start', 'flight.start', 'We are up. Watch the battery in the shadow, and the data going home.', 'info');
          }
          return;
        }

        // Launch ended before the 3D scene arrived, or the view mounted mid-flight.
        if (api3d && api3d.state.mode === 'launch') api3d.set({ mode: 'orbit' });
        const iv = idxForT(clamp(tNow, T0, tEnd));
        const f = sample(iv);
        const inOps = tNow >= tOps;

        if (inOps && root.dataset.phase === 'launch') root.dataset.phase = 'orbit';

        // Numbers run the whole time they are on screen.
        if (inOps) {
          G.forEach((g) => updateGraph(g, f));
          const spill = clamp((f.buffer / sc.buffer - 0.985) * 40, 0, 1);
          if (info.lifeDays) dayEl.textContent = Math.round(clamp((tNow - tOps) / Math.max(1e-6, tEnd - tOps), 0, 1) * info.lifeDays);

          if (wasLit !== f.sunlit) {
            if (wasLit !== null) {
              if (!f.sunlit) {
                kiloOnce('eclipse', 'flight.eclipse', t('team.flight.c.shadow', 'In the shadow: the panels stop, the battery takes over.'), 'dark');
                beep(240, 0.25, 'triangle', 0.05);
              } else beep(660, 0.08, 'triangle', 0.05);
            }
            wasLit = f.sunlit;
            root.classList.toggle('tf-dark', !f.sunlit);
            sunWord.textContent = f.sunlit ? t('team.flight.sun', 'Sunlight') : t('team.flight.shadow', 'Shadow');
            sunBadge.classList.toggle('tf-shadow', !f.sunlit);
          }
          linkHold = f.inPass ? 1.3 : Math.max(0, linkHold - dt);
          const linkOn = linkHold > 0 && f.alive;
          if (linkOn && !wasLink) {
            once('contact', info.deep ? t('team.flight.c.deepcontact', 'Earth is in view: the data can go home!') : t('team.flight.c.contact', 'Ground station in view: the data can go home!'), 'contact');
            seq([1100, 1500], 60, 'sine', 0.05);
          }
          if (linkOn !== wasLink) {
            linkChip.classList.toggle('tf-on', linkOn);
            linkWord.textContent = linkOn ? t('team.flight.linkon', 'Sending data home') : t('team.flight.nolinkyet', 'Waiting for contact');
          }
          wasLink = linkOn;
          // Said once, calmly. No heartbeat.
          if (f.battery < 0.22 && f.alive && !lowBatTold) {
            lowBatTold = true;
            coach(t('team.flight.c.lowbat', 'Battery nearly flat!'), 'bad');
          }
          if (spill > 0.2 && f.alive) once('overflow', t('team.flight.c.overflow', 'Recorder full. New science is spilling into space.'), 'bad');

          if (api3d) {
            const station = f.phase / slowK + 0.35;
            api3d.set({ phase: f.phase / slowK, fastPhase: f.phase, link: linkOn ? clamp(f.downlink / sc.downlink, 0.35, 1) : 0, stationPhase: station, spill: spill * 0.5, fuel: f.fuel, sunlitNow: f.sunlit, beta });
          }
          if (use2D) draw2D(0, { phase: f.phase, link: linkOn ? 1 : 0, station: f.phase * 0.9, spill });
        } else if (mode === 'cruise') {
          if (api3d) api3d.set({ phase: 0.4 + ((tNow - tOps) / Math.max(1, slowK)) * 0.05, fastPhase: 0.4, link: 0, stationPhase: 0, spill: 0, sunlitNow: true, beta });
          if (use2D) draw2D(0, { phase: 0.4, link: 0, station: 0, spill: 0 });
        }
        if (mode === 'cruise' && inOps) mode = 'orbit';

        if (mode === 'orbit' || mode === 'cruise') {
          renderCrisis(activeCrisis());
          if (inOps && tNow >= endingStart()) startEnding();
          return;
        }
        // Ending: the crisis banner stays off, the rest keeps ticking until the room moves on.
        if (mode === 'end') {
          if (landAfter()) {
            const lt = landSkipped ? landingLen : (tNow - endingStart()) * secPerT();
            const fadeK = clamp((lt - (landingLen - 1.8)) / 1.5, 0, 1);
            const beat = api3d && api3d.landBeat ? api3d.landBeat() : null;
            landBeats(beat, lt);
            if (lt > landingLen - 2.2 && guide && guide.clear && !told.landClear) {
              told.landClear = 1;
              guide.clear();
            }
            if (api3d) {
              api3d.set({ landT: Math.max(0, lt) });
              api3d.fadeTo(fadeK);
            }
            root.style.setProperty('--tf-fade', String(fadeK));
            if (lt > 0.9) {
              endEl.classList.remove('tf-show');
              const left = Math.max(1, Math.ceil(landingLen - lt));
              const txt = beat ? beatText(beat) : t('team.flight.touchdown', 'Touchdown in {s}', { s: left });
              if (countEl.textContent !== txt) countEl.textContent = txt;
              countEl.classList.add('tf-land');
            }
            if (engineSnd.h) engineSnd.h.set(0.25 + fadeK * 0.5, 0.3 + fadeK);
          }
          if (use2D) draw2D(0, { phase: f.phase, link: 0, station: 0, spill: 0 });
        }
      }

      function updateGraph(g, f) {
        const hEl = graphEls[g.id];
        const raw = f[g.id] || 0;
        const norm = raw / sc[g.id];
        let text;
        if (g.id === 'battery') text = `${Math.round(clamp(norm, 0, 1) * 100)}%`;
        else if (g.id === 'buffer') text = `${Math.round(clamp(norm, 0, 1) * 100)}%`;
        else if (g.id === 'downlink') text = raw > 0 ? (raw >= 10 ? String(Math.round(raw)) : raw >= 1 ? raw.toFixed(1) : raw.toFixed(2)) : t('team.flight.nolink', 'no link');
        else text = `${Math.round(raw)}%`;
        if (text !== hEl.last) {
          hEl.v.textContent = text;
          hEl.last = text;
          if (g.id === 'downlink') hEl.v.classList.toggle('tf-g-small', raw <= 0);
        }
        hEl.el.classList.toggle('tf-bad', g.bad(clamp(norm, 0, 1)));
        let note = '';
        if (g.id === 'battery') note = f.sunlit ? t('team.flight.n.charge', 'charging in sunlight') : t('team.flight.n.drain', 'draining in shadow');
        else if (g.id === 'buffer') note = norm > 0.985 ? t('team.flight.n.spill', 'FULL: data lost') : t('team.flight.n.waiting', 'waiting to go home');
        else if (g.id === 'downlink') note = raw > 0 ? t('team.flight.n.mbps', 'Mbps, in contact') : info.deep ? t('team.flight.n.waitearth', 'waiting for Earth') : t('team.flight.n.waitpass', 'waiting for a pass');
        else note = ghostFrames ? ghostDelta(f) : t('team.flight.n.science', 'of the goal, home so far');
        if (note !== hEl.lastN) {
          hEl.n.textContent = note;
          hEl.lastN = note;
        }
        drawGraph(g, f.i);
      }
      function ghostDelta(f) {
        const gf = ghostFrames[Math.min(ghostFrames.length - 1, Math.floor((f.i / frames.length) * ghostFrames.length))];
        const d = Math.round((f.science || 0) - (gf.science || 0));
        return d >= 0 ? t('team.flight.n.ahead', '+{d} vs ghost', { d }) : t('team.flight.n.behind', '{d} vs ghost', { d });
      }

      // ---------- 2D view when there is no WebGL ----------
      const planetColors = { earth: ['#2b78cc', '#0c2f66'], moon: ['#b5b5b8', '#54545a'], mars: ['#c1683c', '#6f3320'], venus: ['#d9b56a', '#8a6a2e'], europa: ['#c9c5b3', '#6c675c'], jupiter: ['#d4b48c', '#7e6549'] };
      function draw2D(T, st) {
        if (cv2.hidden) return;
        const { w, h, dpr } = fitCanvas(cv2);
        const x = cv2.getContext('2d');
        x.fillStyle = '#04061a';
        x.fillRect(0, 0, w, h);
        const cx = w * 0.5;
        const cy = h * 0.32;
        const pr = Math.min(w * 0.22, h * 0.21);
        const orbitR = pr * (1 + clamp((info.altKm / BODY_R[body]) * 2.4, 0.16, 0.5));
        x.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 0; i < 110; i++) x.fillRect((i * 137.5) % w, (i * 83.1 + 19) % (h * 0.78), 1.4 * dpr, 1.4 * dpr);
        if (!st) {
          const k = clamp((T - 2.5) / 4, 0, 1);
          const y = h * 0.6 - h * 0.52 * k * k;
          x.fillStyle = '#f2f5ff';
          x.fillRect(cx - 7 * dpr, y, 14 * dpr, 46 * dpr);
          if (T > 2.5) {
            x.fillStyle = '#ffb04a';
            x.beginPath();
            x.moveTo(cx - 10 * dpr, y + 46 * dpr);
            x.lineTo(cx + 10 * dpr, y + 46 * dpr);
            x.lineTo(cx, y + (74 + 22 * Math.sin(T * 40)) * dpr);
            x.closePath();
            x.fill();
          }
          return;
        }
        const pal = planetColors[body];
        const grd = x.createRadialGradient(cx + pr * 0.5, cy - pr * 0.3, pr * 0.1, cx, cy, pr * 1.05);
        grd.addColorStop(0, pal[0]);
        grd.addColorStop(1, pal[1]);
        x.fillStyle = grd;
        x.beginPath();
        x.arc(cx, cy, pr, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = 'rgba(3,4,18,0.85)';
        x.beginPath();
        x.arc(cx, cy, pr, Math.PI / 2, -Math.PI / 2);
        x.closePath();
        x.fill();
        x.fillStyle = 'rgba(80,70,210,0.26)';
        x.fillRect(cx - orbitR - 40 * dpr, cy - pr, orbitR + 40 * dpr, pr * 2);
        x.strokeStyle = 'rgba(143,230,255,0.75)';
        x.lineWidth = 1.5 * dpr;
        x.beginPath();
        x.arc(cx, cy, orbitR, 0, Math.PI * 2);
        x.stroke();
        const ax = cx + Math.cos(st.phase) * orbitR;
        const ay = cy + Math.sin(st.phase) * orbitR;
        if (st.link > 0.02) {
          x.strokeStyle = '#63e6ff';
          x.lineWidth = 2.5 * dpr;
          x.beginPath();
          x.moveTo(ax, ay);
          x.lineTo(cx + Math.cos(st.station) * pr, cy + Math.sin(st.station) * pr);
          x.stroke();
        }
        x.fillStyle = st.spill > 0.2 ? '#ff4fb2' : '#fff';
        x.beginPath();
        x.arc(ax, ay, 7 * dpr, 0, Math.PI * 2);
        x.fill();
      }

      // ---------- View in VR ----------
      const vrBtn = $('[data-vr]');
      const vrLabel = vrBtn.querySelector('[data-vr-label]');
      function showVR() {
        // Offered once the spacecraft is in orbit (the launch film moves the camera a lot).
        const ready = vrOK && !!api3d && !use2D && api3d.state && api3d.state.mode !== 'launch';
        if (vrBtn.hidden === ready) vrBtn.hidden = !ready;
      }
      vrBtn.addEventListener('click', () => {
        if (!flightMod || !api3d) return;
        if (vr && vr.active) {
          vr.exit();
          return;
        }
        if (!vr)
          vr = flightMod.createVR(api3d, {
            onChange(on) {
              vrBtn.classList.toggle('on', on);
              vrLabel.textContent = on ? t('team.flight.vr.exit', 'Exit VR') : t('team.flight.vr', 'View in VR');
            },
            // Standalone headsets pause the page while in VR: keep the flight clock going.
            onStall(now) {
              if (performance.now() - lastWinFrame > 150) step(now);
            },
          });
        vr.enter().catch((e) => {
          console.warn('VR could not start', e);
          if (SMD.ui && SMD.ui.toast) SMD.ui.toast(t('team.flight.vr.fail', 'VR could not start on this device.'), { kind: 'warn' });
        });
      });
      const vrTimer = setInterval(showVR, 500);

      raf = requestAnimationFrame(frame);
      const kitOff = attachKit(root, 'flight', ctx);

      // A crisis outcome re-flies the mission: pick up the new frames.
      function update(c) {
        if (dead) return;
        const fresh = flightOf(c);
        if (fresh && fresh.frames !== frames && fresh.frames && fresh.frames.length) loadFlight(fresh);
      }
      const offSub = ctx.subscribe ? ctx.subscribe(update) : null;

      const cleanup = () => {
        dead = true;
        cancelAnimationFrame(raf);
        clearTimeout(coachTimer);
        if (offSub) offSub();
        kitOff();
        if (guide && guide.clear) guide.clear();
        if (engineSnd.h) engineSnd.h.stop();
        clearInterval(vrTimer);
        try {
          if (vr) vr.dispose();
        } catch (e) {}
        try {
          if (SMD.three && SMD.three.engine && api3d) SMD.three.engine.stop();
        } catch (e) {}
      };
      return { cleanup, update };
    },
  };
})();
