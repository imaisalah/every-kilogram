// Screen router, boot splash, crash and save-recovery screens, developer fixtures.
(function () {
  const SMD = globalThis.SMD;
  const app = document.getElementById('app');
  const t = (k, e, p) => SMD.t(k, e, p);
  const esc = (s) => SMD.ui.esc(s);
  let cleanup = null;
  let booted = false;
  let crashes = 0; // crashes in a row, so a broken HQ cannot loop

  // Screens that only make sense with a career running.
  // The title and the Last Light side mode never need a career.
  const NO_AGENCY = new Set(['start', 'start_career', 'newgame', 'classroom', 'crash', 'recover', 'story', 'avatar', 'll', 'll_title', 'lltest', 'll_chapters', 'll_journal', 'team', 'team_museum']);

  function runCleanup() {
    const fn = cleanup;
    cleanup = null;
    if (fn) {
      try {
        fn();
      } catch (err) {
        console.error('screen cleanup failed', err);
      }
    }
    // A cleanup that threw may have left a 3D scene running.
    try {
      if (SMD.three && SMD.three.engine) SMD.three.engine.stop();
    } catch (e) {}
    document.querySelectorAll('dialog.ek-settings').forEach((d) => d.remove());
  }

  function focusHeading() {
    window.scrollTo(0, 0);
    const h = app.querySelector('h1, h2');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
  }

  let navs = 0;
  SMD.go = function go(screen, params) {
    if (!booted && screen === 'start' && location.hash === '#dev-ll-test') screen = 'lltest';
    booted = true;
    const nav = ++navs;
    hideSplashTimers();
    runCleanup();
    let s = SMD.ui.screens[screen];
    if (!s) {
      console.error('Unknown screen', screen);
      return showCrash(screen, new Error('unknown screen: ' + screen));
    }
    // Opening a career screen with no career: try the save, else explain.
    if (!NO_AGENCY.has(screen) && !SMD.game.agency) {
      if (!SMD.game.load()) return showRecover(screen);
    }
    SMD.ui.state.screen = screen;
    SMD.ui.state.params = params || null;
    let out;
    try {
      out = s.render(app, params || {});
    } catch (err) {
      return showCrash(screen, err);
    }
    // The screen sent us elsewhere while rendering: that screen owns the page now.
    if (nav !== navs) return;
    if (typeof out === 'function') cleanup = out;
    if (screen !== 'crash') crashes = 0;
    focusHeading();
    afterRender(screen);
  };

  // ---------- When a screen breaks ----------
  function showCrash(screen, err) {
    console.error(`Screen "${screen}" failed:`, err);
    runCleanup();
    crashes++;
    SMD.ui.state.screen = 'crash';
    SMD.ui.state.params = { from: screen };
    const ag = SMD.game.agency;
    const canHQ = !!ag && (screen !== 'hq' || crashes < 2) && crashes < 3;
    const detail = err && (err.stack || err.message) ? String(err.message || err) : String(err);
    app.innerHTML = `<main class="screen night ek-sys">
      <div class="ek-sys-card">
        <p class="ek-sys-kicker">${esc(t('sys.crash.kicker', 'Anomaly report'))}</p>
        <h1>${esc(t('sys.crash.title', 'This screen hit a problem'))}</h1>
        <p>${esc(ag ? t('sys.crash.saved', 'Your agency is safe: it was saved at the end of the last month. Head back and carry on.') : t('sys.crash.nosave', 'Nothing was lost. Go back to the title screen and try again.'))}</p>
        <div class="ek-sys-actions">
          ${canHQ ? `<button class="btn primary" data-act="hq">${esc(t('sys.crash.hq', 'Back to HQ'))}</button>` : ''}
          <button class="btn ${canHQ ? 'ghost' : 'primary'}" data-act="title">${esc(t('sys.crash.title_btn', 'Title screen'))}</button>
          <button class="btn ghost" data-act="reload">${esc(t('sys.crash.reload', 'Reload the game'))}</button>
        </div>
        <details class="ek-sys-details"><summary>${esc(t('sys.crash.details', 'Details for your teacher'))}</summary><pre>${esc(screen)}: ${esc(detail)}</pre></details>
      </div>
    </main>`;
    bindSys();
    focusHeading();
  }

  // ---------- When there is no career to show ----------
  function showRecover(screen) {
    const broken = SMD.game.loadError;
    SMD.ui.state.screen = 'recover';
    SMD.ui.state.params = { from: screen };
    app.innerHTML = `<main class="screen night ek-sys">
      <div class="ek-sys-card">
        <p class="ek-sys-kicker">${esc(t('sys.recover.kicker', 'Mission control'))}</p>
        <h1>${esc(broken ? t('sys.recover.title_bad', 'Your saved agency could not be read') : t('sys.recover.title_none', 'No agency yet'))}</h1>
        <p>${esc(broken ? t('sys.recover.bad', 'The save may come from an older version of the game or was cut short. You can start a new agency, or keep a copy of the old save first.') : t('sys.recover.none', 'Found an agency to start your career.'))}</p>
        <div class="ek-sys-actions">
          <button class="btn primary" data-act="new">${esc(t('sys.recover.new', 'Found a new agency'))}</button>
          ${broken ? `<button class="btn ghost" data-act="keep">${esc(t('sys.recover.keep', 'Download the old save'))}</button>` : ''}
          <button class="btn ghost" data-act="title">${esc(t('sys.crash.title_btn', 'Title screen'))}</button>
        </div>
        ${broken ? `<details class="ek-sys-details"><summary>${esc(t('sys.crash.details', 'Details for your teacher'))}</summary><pre>${esc(broken)}</pre></details>` : ''}
      </div>
    </main>`;
    bindSys();
    focusHeading();
  }

  function bindSys() {
    const on = (act, fn) => {
      const b = app.querySelector(`[data-act="${act}"]`);
      if (b) b.addEventListener('click', fn);
    };
    on('hq', () => SMD.go('hq', { resume: true }));
    on('title', () => SMD.go('start'));
    on('reload', () => location.reload());
    on('new', () => {
      SMD.game.clear();
      SMD.go('newgame');
    });
    on('keep', () => {
      const raw = SMD.game.brokenSave();
      if (raw) SMD.ui.downloadText('every-kilogram-old-save.json', raw);
    });
  }

  // An error after a screen rendered (a timer, a promise) that leaves the page
  // blank gets the crash screen instead of an empty window.
  function blankCheck(err) {
    if (!booted) return;
    setTimeout(() => {
      const empty = !app.firstElementChild || (!app.textContent.trim() && !app.querySelector('canvas, svg, img'));
      if (empty) showCrash(SMD.ui.state.screen || '?', err);
    }, 0);
  }
  window.addEventListener('error', (e) => {
    if (e.target && e.target !== window) return; // resource errors are handled below
    blankCheck(e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => blankCheck(e.reason));

  // ---------- After each screen ----------
  let warmed = false;
  function afterRender(screen) {
    if (screen === 'start') {
      addTitleSettings();
      // Warm the caches once the title is up and idle; never blocks a click.
      if (!warmed) {
        warmed = true;
        setTimeout(() => SMD.assets && SMD.assets.warmup && SMD.assets.warmup(), 1200);
      }
    }
    const notes = SMD.game.loadNotes || [];
    if (notes.length && !NO_AGENCY.has(screen)) {
      const dropped = notes.find((n) => n.startsWith('dropped:'));
      if (dropped) SMD.ui.toast(t('sys.save.migrated', 'Your save came from an older version. {n} damaged mission records were removed; everything else carried over.', { n: dropped.split(':')[1] }), { kind: 'warn', ms: 9000 });
      SMD.game.loadNotes = [];
    }
  }

  // The title screen gets a Settings button if it has none of its own.
  function addTitleSettings() {
    const row = app.querySelector('.title-actions');
    if (!row || row.querySelector('[data-act="settings"]')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ghost';
    b.dataset.act = 'settings';
    b.textContent = t('settings.title', 'Settings');
    b.addEventListener('click', () => SMD.ui.openSettings());
    row.appendChild(b);
  }

  // ---------- Boot splash ----------
  // Shown at once while three.js and the title scene load, so the first paint
  // is not a black window. Replaced by the first SMD.go().
  let slowTimer = 0;
  function hideSplashTimers() {
    clearTimeout(slowTimer);
  }
  if (app && !app.firstElementChild) {
    app.innerHTML = `<main class="screen night ek-boot" aria-busy="true">
      <div class="ek-boot-in">
        <p class="ek-boot-name">${esc(t('title.name', 'Every Kilogram'))}</p>
        <div class="ek-boot-bar" aria-hidden="true"><span></span></div>
        <p class="ek-boot-msg" data-boot-msg>${esc(t('sys.boot.loading', 'Preparing mission control…'))}</p>
      </div>
    </main>`;
    slowTimer = setTimeout(() => {
      const m = app.querySelector('[data-boot-msg]');
      if (m && !booted) m.textContent = t('sys.boot.slow', 'Still loading. A slow network can take a minute the first time; after that the game starts quickly.');
    }, 9000);
  }

  // If the 3D module cannot load at all (old browser, missing file), start the
  // game without 3D rather than leaving the splash up forever.
  function bootWithout3D(why) {
    if (booted) return;
    console.warn('Starting without 3D:', why);
    const stub = {
      supported: () => false,
      mount(el, sceneObj) {
        if (el) el.classList.add('ek-no3d');
        return sceneObj;
      },
      stop() {},
      getRenderer() {
        throw new Error('3D engine not loaded');
      },
      studioEnv: () => Promise.resolve(null),
      disposeTree() {},
      input: { down: () => false, any: () => false, take: () => false, flush() {}, capture() {}, bindTouch() {} },
      ease: { outBack: (x) => x, inOut: (x) => x, out: (x) => x },
      debug: {},
    };
    SMD.three = SMD.three || { engine: stub, createTitle: () => ({ scene: null, camera: null }) };
    if (SMD.applyLang) SMD.applyLang();
    SMD.go('start');
    SMD.ui.toast(t('sys.no3d.module', 'The 3D views could not load in this browser, so they are switched off. Everything else works. An up-to-date Chrome, Edge, Firefox or Safari shows them.'), { kind: 'warn', ms: 12000 });
  }
  const importMaps = typeof HTMLScriptElement !== 'undefined' && HTMLScriptElement.supports && HTMLScriptElement.supports('importmap');
  if (!importMaps) setTimeout(() => bootWithout3D('import maps not supported'), 0);
  window.addEventListener(
    'error',
    (e) => {
      const el = e.target;
      if (booted || !el || el === window) return;
      if (el.tagName === 'SCRIPT' && el.type === 'module') bootWithout3D('module failed to load');
    },
    true
  );
  window.addEventListener('error', (e) => {
    if (!booted && /module specifier|importmap|three/i.test(String(e.message || ''))) bootWithout3D(e.message);
  });

  // Developer fixture: a career a few years in, with projects in every state.
  // Used by tools/shot.mjs scripts and by "#dev-<screen>" links.
  SMD.quickStartCareer = function quickStartCareer() {
    const A = SMD.agency;
    const ag = SMD.game.newGame(SMD.t('ng.default', 'Nile Space Agency'));
    ag.money = 900;
    ag.science = 120;
    ['dish3', 'amp100', 'aero'].forEach((id) => ag.tech.push(id));
    const PLAN = {
      nile: { instruments: ['hires', 'irspec'], arrays: 8, dish: 1, amp: 25, recorder: 256, launcher: 'light' },
      weather: { instruments: ['irspec', 'context'], arrays: 5, dish: 1, amp: 25, recorder: 64, launcher: 'light' },
      mars: { instruments: ['sounder', 'hires', 'neutron'], arrays: 6, dish: 3, amp: 100, recorder: 256, launcher: 'light', capture: 'aerobrake', margin: 20 },
    };
    const start = (key) => {
      const d = Object.assign(A.newDesign(ag, key), PLAN[key]);
      A.applyTech(ag, d);
      return A.approve(ag, d, 'standard', 'standard');
    };
    start('weather');
    start('nile');
    const step = (n) => {
      for (let i = 0; i < n; i++) {
        A.advance(ag).forEach((e) => {
          if (e.type === 'review') {
            const qs = A.reviewQuestions(ag, e.project, e.review);
            A.resolveReview(ag, e.project, e.review, Object.fromEntries(qs.map((q) => [q.id, q.options[0].id])));
          }
          if (e.type === 'event') A.resolveEvent(ag, e.project, e.eventId, null);
        });
      }
    };
    step(26); // both near-Earth missions fly and finish
    ag.rep = Math.max(ag.rep, 2);
    ag.teams = 3;
    start('mars');
    step(5);
    SMD.game.save();
    return ag;
  };

  // The 3D module (js/3d/index.js) starts the game once it has loaded.
})();
