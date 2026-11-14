// Mission films (simulate): the launch and the arrival as short cinematics.
// Params: { projectId, kind: 'launch' | 'arrival' }. When the film ends or is
// skipped: SMD.go('hq', { resume: true }).
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const { esc } = ui;
  const t = (k, e, p) => SMD.t(k, e, p);

  // Dev links (#dev-film) open without params: pick a project that has flown.
  function pickProject(ag, params) {
    if (!ag) return null;
    if (params.projectId !== undefined) return ag.projects.find((p) => p.id === params.projectId) || null;
    const flown = ag.projects.filter((p) => p.flight);
    return flown[flown.length - 1] || null;
  }

  const TONE_WORD = {
    ok: () => t('film.tone.ok', 'Good'),
    warn: () => t('film.tone.warn', 'Watch'),
    bad: () => t('film.tone.bad', 'Problem'),
  };

  ui.screens.film = {
    render(app, params) {
      const ag = SMD.game.agency;
      const p = pickProject(ag, params || {});
      if (!p || !p.design) {
        SMD.go('hq', { resume: true });
        return;
      }
      const kind = params.kind === 'arrival' ? 'arrival' : 'launch';
      const m = SMD.data.MISSIONS[p.missionKey];
      // Crewed missions: the launch is the ride (you are on board), and the
      // ride already flew the way home, so the arrival goes straight on.
      if (m.kind === 'crew') {
        if (kind === 'launch' && SMD.ui.screens.ride) SMD.go('ride', { projectId: p.id });
        else SMD.go('hq', { resume: true });
        return;
      }
      const audio = SMD.audio;
      const tag = kind === 'arrival' ? t('film.tag.arrival', 'Arrival film') : t('film.tag.launch', 'Launch film');

      app.innerHTML = `<main class="screen night film" data-kind="${kind}">
        <div class="film-stage" data-3d></div>
        <div class="film-vignette" aria-hidden="true"></div>
        <div class="film-bar top" aria-hidden="true"></div>
        <div class="film-bar bottom" aria-hidden="true"></div>
        <header class="film-head">
          <div class="film-title">
            <span class="film-tag">${esc(tag)}</span>
            <h1>${esc(p.design.name)}</h1>
            <span class="film-sub">${esc(t(`mission.${p.missionKey}.title`, m.title))}</span>
          </div>
          <dl class="film-hud" data-hud></dl>
        </header>
        <div class="film-count" data-count aria-hidden="true"></div>
        <aside class="film-delay" data-delay hidden></aside>
        <section class="film-caption" data-caption aria-live="polite" aria-atomic="true"></section>
        <footer class="film-foot">
          <p class="film-credit" data-credit></p>
          <div class="film-actions">
            <button type="button" class="btn small ghost" data-act="mute" aria-pressed="${audio.isMuted() ? 'true' : 'false'}">${esc(audio.isMuted() ? t('film.sound.off', 'Sound off') : t('film.sound.on', 'Sound on'))}</button>
            <button type="button" class="btn small" data-act="skip">${esc(t('film.skip', 'Skip film'))} <kbd>Esc</kbd></button>
          </div>
        </footer>
        <div class="film-progress" aria-hidden="true"><i data-progress></i></div>
        <div class="film-fade" data-fade aria-hidden="true"></div>
        <p class="film-loading" data-loading>${esc(t('film.loading', 'Rolling film…'))}</p>
      </main>`;

      const $ = (s) => app.querySelector(s);
      const stage = $('[data-3d]');
      const hudEl = $('[data-hud]');
      const countEl = $('[data-count]');
      const delayEl = $('[data-delay]');
      const capEl = $('[data-caption]');
      const creditEl = $('[data-credit]');
      const progEl = $('[data-progress]');
      const fadeEl = $('[data-fade]');
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
      let engineSnd = null;
      let delayRaf = 0;
      let film = null;

      function finish() {
        if (done) return;
        done = true;
        // Back on campus the astronaut is still cheering the launch.
        let mood = null;
        try {
          if (kind === 'launch') mood = SMD.agency.flightLost(p) ? 'sad' : 'cheer';
        } catch (e) {}
        SMD.go('hq', mood ? { resume: true, mood } : { resume: true });
      }

      // ---------- Cue handlers ----------
      const hudRows = new Map();
      function setHud(key, label, value) {
        let row = hudRows.get(key);
        if (!row) {
          row = document.createElement('div');
          row.className = 'film-hud-row';
          row.innerHTML = '<dt></dt><dd class="num"></dd>';
          hudEl.appendChild(row);
          hudRows.set(key, row);
        }
        row.firstChild.textContent = label;
        row.lastChild.textContent = value;
      }

      let capTimer = 0;
      function caption(c) {
        const tone = ['ok', 'warn', 'bad'].includes(c.tone) ? c.tone : 'info';
        const mark = tone === 'info' ? '' : `<span class="tone ${tone}">${esc(TONE_WORD[tone]())}</span>`;
        const html = `<div class="film-cap ${tone}">
          <p class="film-kicker">${mark}<span>${esc(c.kicker || '')}</span></p>
          <h2>${esc(c.title || '')}</h2>
          ${c.text ? `<p class="film-text">${esc(c.text)}</p>` : ''}
        </div>`;
        capEl.classList.remove('show');
        clearTimeout(capTimer);
        capTimer = later(() => {
          capEl.innerHTML = html;
          void capEl.offsetWidth;
          capEl.classList.add('show');
        }, capEl.innerHTML ? 180 : 0);
        if (c.sound) sound(c.sound);
      }

      function sound(name) {
        if (!alive) return;
        try {
          if (name === 'ok') audio.beep(988, 0.12, 'sine', 0.1);
          else if (name === 'warn') audio.beep(523, 0.2, 'triangle', 0.14);
          else if (name === 'bad') audio.alarm();
          else if (name === 'good') audio.chime(true);
          else if (name === 'liftoff') audio.bang(0.55, 1.6);
          else if (name === 'stage') audio.bang(0.7, 0.7);
          else if (name === 'fairing') audio.bang(0.35, 0.45);
          else if (name === 'sep') {
            audio.beep(880, 0.08, 'sine', 0.12);
            later(() => audio.beep(1320, 0.12, 'sine', 0.12), 110);
          }
        } catch (e) {}
      }

      function count(v) {
        if (v === null || v === undefined) {
          countEl.classList.remove('show');
          return;
        }
        countEl.textContent = String(v);
        countEl.className = 'film-count show tick';
        void countEl.offsetWidth;
        countEl.classList.remove('tick');
        audio.beep(660, 0.15, 'sine', 0.2);
      }

      function big(text) {
        countEl.textContent = text;
        countEl.className = 'film-count show big';
        audio.beep(1320, 0.4, 'triangle', 0.22);
        later(() => countEl.classList.remove('show'), 1600);
      }

      function engine(level, bright) {
        try {
          if (!engineSnd && level > 0) engineSnd = audio.engine();
          if (engineSnd) engineSnd.set(level, bright);
        } catch (e) {}
      }

      const fmtDelay = (sec) => {
        if (sec < 60) return t('film.delay.sec', '{s} s', { s: ui.fmt(sec, sec < 10 ? 1 : 0) });
        const mi = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return t('film.delay.min', '{m} min {s} s', { m: mi, s });
      };
      const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

      // The radio delay: how long ago this happened, a light pulse crossing
      // from the planet to Earth, and the countdown until the result arrives.
      function delay(sec, from) {
        const ago = sec < 60 ? t('film.delay.agoSec', 'Everything you see happened {s} ago.', { s: fmtDelay(sec) }) : t('film.delay.ago', 'Everything you see happened {m} minutes ago.', { m: Math.round(sec / 60) });
        delayEl.innerHTML = `<p class="film-delay-k">${esc(t('film.delay.k', 'One-way radio delay'))}</p>
          <p class="film-delay-v num">${esc(fmtDelay(sec))}</p>
          <p class="film-delay-t">${esc(ago)}</p>
          <div class="film-delay-track" aria-hidden="true">
            <span class="film-delay-end from">${esc(from || '')}</span>
            <span class="film-delay-line"><i data-pulse></i></span>
            <span class="film-delay-end to">${esc(t('film.earth', 'Earth'))}</span>
          </div>
          <p class="film-delay-c num" data-dc hidden></p>`;
        delayEl.hidden = false;
        delayEl.className = 'film-delay';
      }

      function pulseAt(k) {
        const el = delayEl.querySelector('[data-pulse]');
        if (!el) return;
        el.style.insetInlineStart = `${Math.round(k * 1000) / 10}%`;
        el.parentNode.style.setProperty('--k', String(k));
      }

      function delayCount(sec, dur) {
        const el = delayEl.querySelector('[data-dc]');
        if (!el) return;
        el.hidden = false;
        delayEl.classList.add('counting');
        const t0 = film ? film.time : 0;
        const tick = () => {
          if (!alive || !film || signalled) return;
          const k = Math.min(1, (film.time - t0) / dur);
          el.textContent = t('film.delay.count', 'Result reaches Earth in {c}', { c: clock(sec * (1 - k)) });
          pulseAt(k);
          if (k < 1 && !signalled) delayRaf = requestAnimationFrame(tick);
        };
        tick();
      }

      let signalled = false;
      function signal(tone) {
        signalled = true;
        cancelAnimationFrame(delayRaf);
        const el = delayEl.querySelector('[data-dc]');
        if (el) {
          el.hidden = false;
          el.textContent = t('film.delay.received', 'Signal received at Earth');
        }
        pulseAt(1);
        delayEl.classList.remove('counting');
        delayEl.classList.add('got', tone || 'ok');
        audio.chime(tone !== 'bad');
      }

      function onCue(c) {
        if (!alive) return;
        switch (c.type) {
          case 'caption':
            caption(c);
            break;
          case 'count':
            count(c.value);
            break;
          case 'big':
            big(c.text);
            break;
          case 'sound':
            sound(c.name);
            break;
          case 'engine':
            engine(c.level, c.bright);
            break;
          case 'hud':
            setHud(c.key, c.label, c.value);
            break;
          case 'clearHud':
            hudEl.innerHTML = '';
            hudRows.clear();
            break;
          case 'credit':
            creditEl.textContent = c.text || '';
            break;
          case 'delay':
            delay(c.seconds, c.from);
            break;
          case 'delayCount':
            delayCount(c.seconds, c.dur);
            break;
          case 'delayHide':
            delayEl.hidden = true;
            break;
          case 'signal':
            signal(c.tone);
            break;
          case 'fade':
            fadeEl.classList.add('on');
            break;
          case 'end':
            later(finish, 450);
            break;
          default:
        }
      }

      // ---------- Controls ----------
      $('[data-act="skip"]').addEventListener('click', finish);
      const muteBtn = $('[data-act="mute"]');
      muteBtn.addEventListener('click', () => {
        audio.setMuted(!audio.isMuted());
        muteBtn.textContent = audio.isMuted() ? t('film.sound.off', 'Sound off') : t('film.sound.on', 'Sound on');
        muteBtn.setAttribute('aria-pressed', audio.isMuted() ? 'true' : 'false');
      });
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          finish();
        }
      };
      window.addEventListener('keydown', onKey);

      // ---------- Start ----------
      try {
        audio.unlock();
      } catch (e) {}
      const E = SMD.three && SMD.three.engine;
      import('./3d/films.js')
        .then((mod) => {
          if (!alive) return;
          film = mod.createFilm({
            project: p,
            kind,
            onCue,
            onFrame: (time, dur) => (progEl.style.inlineSize = `${Math.min(100, (time / dur) * 100)}%`),
          });
          ui.screens.film.current = film; // for tools/shot.mjs scripts
          const loading = $('[data-loading]');
          if (loading) loading.remove();
          E.mount(stage, film);
        })
        .catch((err) => {
          console.warn('film failed', err);
          if (alive) finish();
        });

      return () => {
        alive = false;
        timers.forEach(clearTimeout);
        cancelAnimationFrame(delayRaf);
        window.removeEventListener('keydown', onKey);
        try {
          if (engineSnd) engineSnd.stop();
        } catch (e) {}
        if (E) E.stop();
        ui.screens.film.current = null;
      };
    },
  };
})();
