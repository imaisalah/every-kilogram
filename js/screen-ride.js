// The crewed ride: you are one of the four astronauts. Walk the access arm,
// ride the climb from your seat, burn for the Moon, swing around the far side
// and come home through the plasma. What happens was decided at launch by the
// design (SMD.ops.crewFlight, stored in score.crew); the crew's own calls,
// photos and fixes during the ride feed back through SMD.ops.crewApplyRide.
// Params: { projectId }. Skip (Esc) keeps the flight team's default result.
// Ends with SMD.go('hq', { resume: true, mood }); results follow the normal
// calendar flow (the mission completes the month after launch).
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const { esc } = ui;
  const t = (k, e, p) => SMD.t(k, e, p);
  const reduced = () => {
    try {
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  };

  const isCrew = (p) => p && p.design && SMD.data.MISSIONS[p.missionKey] && SMD.data.MISSIONS[p.missionKey].kind === 'crew';
  function pickProject(ag, params) {
    if (!ag) return null;
    if (params.projectId !== undefined) return ag.projects.find((p) => p.id === params.projectId) || null;
    const flown = ag.projects.filter((p) => isCrew(p) && p.flight);
    return flown[flown.length - 1] || null;
  }

  // A crew project for dev links and screenshots (#dev-ride): approved, flown
  // and added to the agency. force: fields merged into score.crew to see a
  // branch (e.g. { ascent: { fails: true }, outcome: 'aborted' }).
  function fixture(force) {
    const ag = SMD.game.agency;
    const A = SMD.agency;
    const D = SMD.data;
    ag.rep = Math.max(ag.rep, 6);
    ['heavy', 'dual'].forEach((x) => !ag.tech.includes(x) && ag.tech.push(x));
    ag.money = Math.max(ag.money, 3000);
    ag.teams = Math.max(ag.teams, 3);
    const d = Object.assign(A.newDesign(ag, 'crew'), JSON.parse(JSON.stringify(D.MISSIONS.crew.proven)));
    d.launcher = 'superheavy';
    const r = A.approve(ag, d, 'standard', 'standard');
    if (!r.ok) return null;
    const p = r.project;
    const ev = SMD.model.evaluate(p.design, p.launch, { readyMs: p.readyMs });
    p.ev = ev;
    p.flight = SMD.ops.autoFlight(p.design, ev, p.flaws, p.seed, {});
    p.status = 'flying';
    p.phase = 'E';
    if (force) {
      const c = p.flight.score.crew;
      Object.keys(force).forEach((k) => (c[k] = force[k] && typeof force[k] === 'object' && !Array.isArray(force[k]) ? Object.assign({}, c[k], force[k]) : force[k]));
    }
    SMD.game.save();
    return p;
  }

  ui.screens.ride = {
    fixture,
    render(app, params) {
      params = params || {};
      const ag = SMD.game.agency;
      let p = pickProject(ag, params);
      if (!p && params.projectId === undefined) p = fixture(params.force);
      const crew = p && p.flight && p.flight.score && p.flight.score.crew;
      if (!p || !crew) {
        SMD.go('hq', { resume: true });
        return;
      }
      const audio = SMD.audio;
      const m = SMD.data.MISSIONS[p.missionKey];
      app.innerHTML = `<main class="screen night ride" data-phase="walk">
        <div class="ride-stage" data-3d></div>
        <div class="ride-vignette" aria-hidden="true"></div>
        <div class="ride-tint" data-tint aria-hidden="true"></div>
        <div class="ride-flash" data-flash aria-hidden="true"></div>
        <header class="ride-head">
          <div class="ride-title">
            <span class="ride-tag">${esc(t('ride.tag', 'You are on board'))}</span>
            <h1>${esc(p.design.name)}</h1>
            <span class="ride-sub">${esc(t('mission.crew.title', m.title))} · <b data-phasename>${esc(t('ride.ph.walk', 'Walk out'))}</b></span>
          </div>
          <p class="ride-met num" data-met aria-hidden="true"></p>
          <div class="ride-actions">
            <button type="button" class="btn small ghost" data-act="mute" aria-pressed="${audio.isMuted() ? 'true' : 'false'}">${esc(audio.isMuted() ? t('film.sound.off', 'Sound off') : t('film.sound.on', 'Sound on'))}</button>
            <button type="button" class="btn small" data-act="skip">${esc(t('ride.skip', 'Skip ride'))} <kbd>Esc</kbd></button>
          </div>
        </header>
        <aside class="ride-gauges" aria-hidden="true" data-gauges>
          <div class="ride-gmeter"><span class="ride-gbar"><i data-gbar></i><s style="--at:33%"></s></span><b class="num" data-g>1.0 g</b><small>${esc(t('ride.g', 'Load on your body'))}</small></div>
          <dl class="ride-read">
            <div><dt>${esc(t('ride.scr.alt', 'Altitude'))}</dt><dd class="num" data-alt>—</dd></div>
            <div><dt>${esc(t('ride.scr.speed', 'Speed'))}</dt><dd class="num" data-speed>—</dd></div>
          </dl>
        </aside>
        <div class="ride-count" data-count aria-hidden="true"></div>
        <section class="ride-caption" data-caption aria-live="polite" aria-atomic="true"></section>
        <div class="ride-dv" data-dv hidden aria-hidden="true"><span class="ride-dv-k">${esc(t('ride.dv', 'Speed added'))}</span><b class="num" data-dvv>0</b><span class="ride-dv-u">/ 388 m/s</span><span class="ride-dv-bar"><i data-dvbar></i><s></s></span></div>
        <div class="ride-reticles" data-reticles aria-hidden="true"></div>
        <p class="ride-photos num" data-photos hidden></p>
        <div class="ride-prompt" data-prompt hidden role="group" aria-live="assertive"></div>
        <button type="button" class="ride-abort" data-abort hidden></button>
        <div class="ride-card" data-card hidden role="dialog" aria-modal="false" aria-labelledby="ride-card-h"></div>
        <div class="ride-progress" aria-hidden="true"><i data-progress></i></div>
        <p class="ride-loading" data-loading>${esc(t('ride.loading', 'Suiting up…'))}</p>
      </main>`;

      const $ = (s) => app.querySelector(s);
      const root = $('.ride');
      const stage = $('[data-3d]');
      const capEl = $('[data-caption]');
      const promptEl = $('[data-prompt]');
      const abortEl = $('[data-abort]');
      const countEl = $('[data-count]');
      const cardEl = $('[data-card]');
      const tintEl = $('[data-tint]');
      const flashEl = $('[data-flash]');
      const dvEl = $('[data-dv]');
      const retEl = $('[data-reticles]');
      const photosEl = $('[data-photos]');
      const timers = new Set();
      const later = (fn, ms) => {
        const id = setTimeout(() => {
          timers.delete(id);
          fn();
        }, ms);
        timers.add(id);
        return id;
      };
      let alive = true;
      let done = false;
      let ride = null;
      let engineSnd = null;
      // What the crew did: the player's calls, photos and fixes.
      const perf = { calls: 0, callsOk: 0, photos: undefined, photoHits: 0, photoTotal: 0, scrubber: false, shelter: false, dvError: null, abortedBy: null };
      let activePrompt = null;
      let activeTarget = null;
      let decision = null;

      // ---------- Ending ----------
      function moodFor() {
        if (crew.outcome === 'lost') return 'sad';
        if (crew.outcome === 'aborted') return 'cheer';
        return 'celebrate';
      }
      function commit(played) {
        if (!played) return;
        const out = {};
        if (perf.photoTotal) out.photos = perf.photoHits / 5; // 5 targets on a full flyby
        if (perf.scrubber) out.scrubber = true;
        try {
          if (SMD.ops.crewApplyRide(p, out)) SMD.game.save();
        } catch (e) {
          console.warn('ride result not applied', e);
        }
      }
      function finish(played) {
        if (done) return;
        done = true;
        commit(played);
        SMD.go('hq', { resume: true, mood: moodFor() });
      }

      // ---------- Cue handlers ----------
      const TONE = { ok: () => t('film.tone.ok', 'Good'), warn: () => t('film.tone.warn', 'Watch'), bad: () => t('film.tone.bad', 'Problem') };
      function caption(c) {
        const tone = ['ok', 'warn', 'bad'].includes(c.tone) ? c.tone : 'info';
        const mark = tone === 'info' ? '' : `<span class="tone ${tone}">${esc(TONE[tone]())}</span>`;
        capEl.classList.remove('show');
        later(() => {
          if (!alive) return;
          capEl.innerHTML = `<div class="ride-cap ${tone}"><p class="ride-kicker">${mark}<span>${esc(c.kicker || '')}</span></p><h2>${esc(c.title || '')}</h2>${c.text ? `<p>${esc(c.text)}</p>` : ''}</div>`;
          void capEl.offsetWidth;
          capEl.classList.add('show');
        }, capEl.innerHTML ? 160 : 0);
        if (c.sound) sound(c.sound);
      }
      function sound(name) {
        try {
          if (name === 'ok') audio.beep(988, 0.12, 'sine', 0.1);
          else if (name === 'warn') audio.beep(523, 0.2, 'triangle', 0.14);
          else if (name === 'bad') audio.alarm();
          else if (name === 'good') audio.chime(true);
          else if (name === 'liftoff') audio.bang(0.7, 2.2);
          else if (name === 'stage') audio.bang(0.8, 0.9);
          else if (name === 'fairing') audio.bang(0.4, 0.5);
        } catch (e) {}
      }
      function engine(level, bright) {
        try {
          if (!engineSnd && level > 0) engineSnd = audio.engine();
          if (engineSnd) engineSnd.set(level, bright);
        } catch (e) {}
      }
      let alarmTimer = 0;
      function alarm(on, caution) {
        clearInterval(alarmTimer);
        root.classList.toggle('alarm', !!on && !caution);
        if (caution) {
          root.classList.add('caution');
          later(() => root.classList.remove('caution'), 2600);
          sound('warn');
          return;
        }
        if (on) {
          sound('bad');
          alarmTimer = setInterval(() => alive && sound('bad'), 900);
        }
      }

      // Prompts: a crew call the player confirms with Space (or a tap).
      function showPrompt(c) {
        hidePrompt(false);
        perf.calls++;
        activePrompt = { id: c.id, until: ride.time + c.window, dv: !!c.dv };
        promptEl.innerHTML = `<button type="button" class="ride-prompt-btn" data-go><kbd>${esc(t('ride.key.space', 'Space'))}</kbd><span>${esc(c.label)}</span></button><span class="ride-prompt-time" aria-hidden="true"><i data-ptime style="animation-duration:${Number(c.window) || 2}s"></i></span>`;
        promptEl.hidden = false;
        promptEl.classList.remove('done', 'miss');
        promptEl.querySelector('[data-go]').addEventListener('click', confirmPrompt);
        try {
          audio.beep(1175, 0.06, 'sine', 0.08);
        } catch (e) {}
      }
      function hidePrompt(missed) {
        if (!activePrompt) return;
        const was = activePrompt;
        activePrompt = null;
        if (missed) {
          promptEl.classList.add('miss');
          const span = promptEl.querySelector('.ride-prompt-btn span');
          if (span) span.textContent = was.dv ? t('ride.p.auto', 'The computer cut the engine at 388 m/s') : t('ride.p.missed', 'Mission Control called it for you');
        }
        later(() => {
          if (!activePrompt) promptEl.hidden = true;
        }, missed ? 1100 : 500);
      }
      function confirmPrompt() {
        if (!activePrompt) return false;
        const id = activePrompt.id;
        perf.callsOk++;
        if (id === 'scrubber') perf.scrubber = true;
        if (id === 'shelter') perf.shelter = true;
        let note = t('ride.p.ok', 'Copy that');
        if (activePrompt.dv) {
          const dv = Math.round(lastFrame.dv || 0);
          perf.dvError = dv - 388;
          note = t('ride.p.dvok', 'Cutoff at {dv} m/s ({err} m/s)', { dv, err: (perf.dvError >= 0 ? '+' : '') + perf.dvError });
          dvEl.classList.add('stopped');
        }
        promptEl.classList.add('done');
        const span = promptEl.querySelector('.ride-prompt-btn span');
        if (span) span.textContent = note;
        try {
          audio.beep(1568, 0.08, 'sine', 0.12);
        } catch (e) {}
        hidePrompt(false);
        activePrompt = null;
        return true;
      }

      // Photo targets on the far side: a reticle over the target; Space snaps it.
      function showTarget(c) {
        activeTarget = { idx: c.idx, until: ride.time + c.dur, el: document.createElement('div'), hit: false };
        activeTarget.el.className = 'ride-reticle';
        activeTarget.el.innerHTML = `<i></i><span>${esc(c.name)}</span>`;
        retEl.appendChild(activeTarget.el);
        perf.photoTotal++;
        updatePhotos();
        try {
          audio.beep(880, 0.05, 'triangle', 0.08);
        } catch (e) {}
      }
      function snap() {
        if (!activeTarget || activeTarget.hit) return false;
        activeTarget.hit = true;
        perf.photoHits++;
        activeTarget.el.classList.add('hit');
        flashEl.classList.remove('on');
        void flashEl.offsetWidth;
        if (!reduced()) flashEl.classList.add('on');
        try {
          audio.beep(2400, 0.03, 'square', 0.06);
          later(() => audio.beep(1800, 0.04, 'square', 0.05), 60);
        } catch (e) {}
        updatePhotos();
        return true;
      }
      function updatePhotos() {
        photosEl.hidden = false;
        photosEl.textContent = t('ride.photos', 'Far-side photos: {n} of {all}', { n: perf.photoHits, all: perf.photoTotal });
      }

      // The abort decision.
      function showAbort(c) {
        decision = c;
        abortEl.hidden = false;
        abortEl.classList.toggle('none', !c.las);
        abortEl.innerHTML = `<b>${esc(t('ride.abort', 'Abort'))}</b><kbd>A</kbd><small>${esc(c.las ? t('ride.abort.las', 'Fire the abort motor') : t('ride.abort.none', 'No abort system fitted'))}</small>`;
        abortEl.focus({ preventScroll: true });
      }
      function doAbort() {
        if (!decision) return;
        perf.abortedBy = 'crew';
        if (!decision.las) {
          abortEl.classList.add('dead');
          abortEl.querySelector('small').textContent = t('ride.abort.nothing', 'Nothing happens. There is no abort tower.');
        }
        ride.act('abort');
      }

      function card(c) {
        const res = c.result;
        const lines = [];
        if (perf.calls) lines.push(t('ride.card.calls', 'Crew calls on time: {n} of {all}', { n: perf.callsOk, all: perf.calls }));
        if (perf.photoTotal) lines.push(t('ride.card.photos', 'Far-side photos: {n} of {all} targets', { n: perf.photoHits, all: perf.photoTotal }));
        if (crew.life.fails && res !== 'aborted' && res !== 'lost') lines.push(perf.scrubber ? t('ride.card.scrub', 'You swapped the air system to its backup loop yourself.') : t('ride.card.scrub.no', 'Mission Control talked the crew through the air system fix.'));
        if (perf.dvError !== null) lines.push(t('ride.card.dv', 'Burn to the Moon stopped at {err} m/s from the target.', { err: (perf.dvError >= 0 ? '+' : '') + perf.dvError }));
        if (crew.entry && crew.entry.peakG && res !== 'aborted' && !(res === 'lost' && crew.lostAt === 'ascent')) lines.push(t('ride.card.g', 'Peak load during entry: {g} g ({how} entry).', { g: crew.entry.peakG, how: crew.entry.profile === 'skip' ? t('ride.card.skip', 'skip') : t('ride.card.direct', 'direct') }));
        const head =
          res === 'lost'
            ? t('ride.card.lost', 'The crew did not come home')
            : res === 'aborted'
              ? t('ride.card.aborted', 'Abort: the crew is safe')
              : res === 'close'
                ? t('ride.card.close', 'Home, but it was close')
                : t('ride.card.safe', 'Welcome home');
        const sub =
          res === 'lost'
            ? crew.lostAt === 'ascent'
              ? t('ride.card.lost.asc', 'The design had no launch abort system. The mission report at HQ shows what would have saved them.')
              : t('ride.card.lost.entry', 'The heat shield had no margin for this entry. The mission report at HQ shows what would have saved them.')
            : t('ride.card.next', 'The mission report will be ready at HQ next month.');
        cardEl.innerHTML = `<div class="ride-card-in ${esc(res)}">
          <p class="ride-kicker">${esc(t('ride.card.k', 'Mission debrief'))}</p>
          <h2 id="ride-card-h">${esc(head)}</h2>
          <p>${esc(sub)}</p>
          ${lines.length ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
          <button type="button" class="btn primary" data-act="continue">${esc(t('ride.card.go', 'Back to HQ'))}</button>
        </div>`;
        cardEl.hidden = false;
        void cardEl.offsetWidth;
        cardEl.classList.add('show');
        const b = cardEl.querySelector('[data-act="continue"]');
        b.addEventListener('click', () => finish(true));
        later(() => alive && b.focus({ preventScroll: true }), 300);
      }

      let lastFrame = {};
      const metEl = $('[data-met]');
      const gEl = $('[data-g]');
      const gBar = $('[data-gbar]');
      const altEl = $('[data-alt]');
      const spEl = $('[data-speed]');
      const progEl = $('[data-progress]');
      const dvV = $('[data-dvv]');
      const dvBar = $('[data-dvbar]');
      const fmtMet = (met) => {
        if (met === undefined || met === null) return '';
        if (met < 0) return `T−${Math.ceil(-met)} s`;
        if (met < 86400) {
          const h = Math.floor(met / 3600);
          const mi = Math.floor((met % 3600) / 60);
          const s = Math.floor(met % 60);
          return `T+${h ? h + ':' : ''}${String(mi).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
        }
        return t('ride.day', 'Day {d}', { d: Math.floor(met / 86400) + 1 });
      };
      function frame(f) {
        lastFrame = f;
        metEl.textContent = fmtMet(f.met);
        const g = Math.max(0, f.g || 0);
        gEl.textContent = `${ui.fmt(g, 1)} g`;
        gBar.style.blockSize = `${Math.min(100, (g / 8) * 100)}%`;
        gBar.parentNode.classList.toggle('hi', g > 3.5);
        altEl.textContent = f.alt !== undefined ? t('ride.km', '{n} km', { n: ui.fmt(f.alt, f.alt < 10 ? 1 : 0) }) : '—';
        spEl.textContent = f.speed !== undefined ? t('ride.kmh', '{n} km/h', { n: ui.fmt(f.speed) }) : '—';
        progEl.style.inlineSize = `${Math.min(100, (f.t / f.dur) * 100)}%`;
        tintEl.style.opacity = f.white ? String(f.white) : '';
        tintEl.classList.toggle('white', !!f.white);
        if (!dvEl.hidden && !dvEl.classList.contains('stopped')) {
          dvV.textContent = String(Math.round(f.dv || 0));
          dvBar.style.inlineSize = `${Math.min(100, ((f.dv || 0) / 420) * 100)}%`;
        }
        if (activePrompt && ride.time > activePrompt.until) hidePrompt(true);
        if (activeTarget) {
          const pos = ride.targetScreen(activeTarget.idx);
          if (pos) {
            activeTarget.el.style.insetInlineStart = '';
            activeTarget.el.style.left = `${pos.x * 100}%`;
            activeTarget.el.style.top = `${pos.y * 100}%`;
            activeTarget.el.hidden = false;
          } else activeTarget.el.hidden = true;
          if (ride.time > activeTarget.until) {
            const el = activeTarget.el;
            el.classList.add('gone');
            later(() => el.remove(), 400);
            activeTarget = null;
          }
        }
        root.classList.toggle('window', !!f.window);
      }

      function onCue(c) {
        if (!alive) return;
        switch (c.type) {
          case 'frame':
            frame(c);
            break;
          case 'caption':
            caption(c);
            break;
          case 'phase':
            root.dataset.phase = c.id;
            countEl.classList.remove('show'); // a big word never outlives its phase
            $('[data-phasename]').textContent = c.label;
            break;
          case 'prompt':
            showPrompt(c);
            break;
          case 'count':
            countEl.textContent = String(c.value);
            countEl.className = 'ride-count show tick';
            void countEl.offsetWidth;
            countEl.classList.remove('tick');
            try {
              audio.beep(660, 0.12, 'sine', 0.18);
            } catch (e) {}
            break;
          case 'big':
            countEl.textContent = c.text;
            countEl.className = 'ride-count show big';
            later(() => countEl.classList.remove('show'), 1500);
            break;
          case 'sound':
            sound(c.name);
            break;
          case 'engine':
            engine(c.level, c.bright);
            break;
          case 'alarm':
            alarm(c.on, c.caution);
            break;
          case 'abortWindow':
            showAbort(c);
            break;
          case 'aborted':
            decision = null;
            if (!perf.abortedBy) perf.abortedBy = c.by;
            later(() => (abortEl.hidden = true), c.las ? 300 : 1400);
            alarm(false);
            break;
          case 'dvMeter':
            if (c.done) later(() => (dvEl.hidden = true), 1600);
            else {
              dvEl.hidden = false;
              dvEl.classList.remove('stopped');
            }
            break;
          case 'target':
            showTarget(c);
            break;
          case 'photos':
            if (c.done) later(() => (photosEl.hidden = true), 1800);
            break;
          case 'fade':
            root.classList.remove('fading', 'black');
            void root.offsetWidth;
            root.classList.add(c.black ? 'black' : 'fading');
            break;
          case 'card':
            card(c);
            break;
          case 'end':
            if (cardEl.hidden) finish(true);
            break;
          default:
        }
      }

      // ---------- Controls ----------
      $('[data-act="skip"]').addEventListener('click', () => finish(false));
      const muteBtn = $('[data-act="mute"]');
      muteBtn.addEventListener('click', () => {
        audio.setMuted(!audio.isMuted());
        muteBtn.textContent = audio.isMuted() ? t('film.sound.off', 'Sound off') : t('film.sound.on', 'Sound on');
        muteBtn.setAttribute('aria-pressed', audio.isMuted() ? 'true' : 'false');
      });
      abortEl.addEventListener('click', doAbort);
      // Tapping the picture works like Space (phones).
      stage.addEventListener('pointerdown', () => {
        if (!confirmPrompt()) snap();
      });
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (!cardEl.hidden) finish(true);
          else finish(false);
          return;
        }
        if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter') && !e.target.closest('.ride-prompt')) return;
        if ((e.key === 'a' || e.key === 'A') && decision) {
          e.preventDefault();
          doAbort();
          return;
        }
        if (e.key === ' ' || e.key === 'Enter') {
          if (decision) {
            e.preventDefault();
            doAbort();
            return;
          }
          if (activePrompt || activeTarget) {
            e.preventDefault();
            if (!confirmPrompt()) snap();
          }
        }
      };
      window.addEventListener('keydown', onKey);

      // ---------- Start ----------
      try {
        audio.unlock();
      } catch (e) {}
      const E = SMD.three && SMD.three.engine;
      import(new URL('js/3d/ride.js', document.baseURI).href)
        .then((mod) => {
          if (!alive) return;
          ride = mod.createRide({ project: p, crew, design: p.design, appearance: SMD.avatar ? SMD.avatar.get() : null, agencyName: ag.name, onCue });
          ride.skip = () => finish(false); // the soak bot and scripts can leave like the Skip button
          ui.screens.ride.current = ride; // for tools/shot.mjs scripts
          const loading = $('[data-loading]');
          if (loading) loading.remove();
          E.mount(stage, ride);
        })
        .catch((err) => {
          console.warn('ride failed', err);
          if (alive) finish(false);
        });

      return () => {
        alive = false;
        timers.forEach(clearTimeout);
        clearInterval(alarmTimer);
        window.removeEventListener('keydown', onKey);
        try {
          if (engineSnd) engineSnd.stop();
        } catch (e) {}
        if (E) E.stop();
        ui.screens.ride.current = null;
      };
    },
  };
})();
