// Last Light screens (docs/LASTLIGHT.md), a side mode of the game: its title
// 'll_title', the chapter list, the journal, and 'll', the game itself with
// its pause menu and chapter end card. The level runtime is js/ll/director.js.
// js/screen-team.js loads after this file and takes over 'start' (docs/TEAM.md);
// until it does, 'start' is this title. The career title stays registered as
// 'start_career', unlinked.
(function () {
  const SMD = globalThis.SMD;
  const ui = SMD.ui;
  const t = (k, e, p) => SMD.t(k, e, p);
  const esc = (s) => ui.esc(s == null ? '' : String(s));
  const SAVE_KEY = 'ek-ll';

  // The old title stays reachable for code (and for teachers' links), not from the UI.
  if (ui.screens.start && !ui.screens.start_career) ui.screens.start_career = ui.screens.start;

  // ---------- Save profile (read-only here; the director writes it) ----------
  function profile() {
    try {
      const raw = SMD.store && SMD.store.get(SAVE_KEY);
      const o = raw ? JSON.parse(raw) : null;
      if (o && o.v === 1) return Object.assign({ checkpoint: null, starts: {}, done: {}, journal: {}, creator: false, summary: {} }, o);
    } catch (e) {}
    return { v: 1, checkpoint: null, starts: {}, done: {}, journal: {}, creator: false, summary: {} };
  }
  function saveCreatorSeen() {
    const p = profile();
    p.creator = true;
    try {
      SMD.store.set(SAVE_KEY, JSON.stringify(p));
    } catch (e) {}
  }
  const levels = () => (SMD.llLevels || []).filter((l) => l && !l.dev).slice().sort((a, b) => (a.n || 0) - (b.n || 0));
  const levelTitle = (lv) => t(lv.titleKey || 'll.level.' + lv.id + '.title', lv.title || lv.id);
  const levelNum = (lv) => (lv.n ? t('ll.ui.chapter', 'Chapter {n}', { n: lv.n }) : t('ll.ui.prologue', 'Prologue'));
  function unlocked(p) {
    const open = new Set();
    levels().forEach((lv, i) => {
      if (i === 0 || p.done[lv.id] || p.starts[lv.id] || (p.checkpoint && p.checkpoint.level === lv.id)) open.add(lv.id);
    });
    return open;
  }
  function collectiblesOf(lv) {
    const c = lv.collectibles;
    if (!c) return [];
    return Array.isArray(c) ? c.filter(Boolean) : Object.keys(c).map((id) => Object.assign({ id }, c[id]));
  }
  const unlockAudio = () => {
    try {
      SMD.audio.unlock();
    } catch (e) {}
  };

  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19V5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M5.6 18.4l1.9-1.9M16.5 7.5l1.9-1.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.3 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.3-3.8-8.5S9.4 5.9 12 3.5z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  };

  // A 3D backdrop: the launch pad at night, slowly circled (js/ll/title.js).
  function mountBackdrop(el) {
    const E = SMD.three && SMD.three.engine;
    if (!E || !el) return () => {};
    let gone = false;
    import(new URL('js/ll/title.js', document.baseURI).href)
      .then((m) => m.createTitleScene())
      .then((sceneObj) => {
        if (gone || !sceneObj) return sceneObj && sceneObj.dispose && sceneObj.dispose();
        E.mount(el, sceneObj);
        el.classList.add('ready');
      })
      .catch((e) => console.warn('title backdrop is off', e));
    return () => {
      gone = true;
      E.stop();
    };
  }

  function shell(app, cls, inner) {
    app.innerHTML = `<main class="screen ll-menu-screen ${cls}"><div class="ll-bg" data-3d aria-hidden="true"></div><div class="ll-bg-shade" aria-hidden="true"></div>${inner}</main>`;
    return app.querySelector('main');
  }

  // Developer fixture: the director's test level (#dev-ll-test, #dev-lltest).
  ui.screens.lltest = {
    render(app) {
      app.innerHTML = '<main class="screen ll-menu-screen"></main>';
      loadScript('tests/fixtures/ll-test-level.js').then(() => SMD.go('ll', { level: 'lltest' }));
      return () => {};
    },
  };

  // ---------- Title ----------
  ui.screens.ll_title = {
    render(app) {
      const p = profile();
      const lv = levels();
      const cp = p.checkpoint && lv.find((l) => l.id === p.checkpoint.level);
      const ar = SMD.lang() === 'ar';
      const playSub = cp ? `${levelNum(cp)} · ${levelTitle(cp)}` : lv[0] ? `${levelNum(lv[0])} · ${levelTitle(lv[0])}` : '';
      const main = shell(
        app,
        'll-title-screen',
        `<div class="ll-title-copy">
          <p class="ll-kicker">${esc(t('ll.ui.kicker', 'Every Kilogram'))}</p>
          <h1 class="ll-logo">${esc(t('ll.ui.name', 'Last Light'))}</h1>
          <p class="ll-tag">${esc(t('ll.ui.tagline', 'Four astronauts. One broken ship. Every kilogram counts.'))}</p>
          <nav class="ll-title-nav" aria-label="${esc(t('ll.ui.menu', 'Menu'))}">
            <button type="button" class="ll-btn primary big" data-act="play">${ICON.play}<span><b>${esc(cp ? t('ll.ui.continue', 'Continue') : t('ll.ui.play', 'Play'))}</b>${playSub ? `<small>${esc(playSub)}</small>` : ''}</span></button>
            <button type="button" class="ll-btn" data-act="chapters">${ICON.list}<span>${esc(t('ll.ui.chapters', 'Chapters'))}</span></button>
            <button type="button" class="ll-btn" data-act="journal">${ICON.book}<span>${esc(t('ll.ui.journal', 'Journal'))}</span></button>
            <div class="ll-title-row">
              <button type="button" class="ll-btn ghost" data-act="settings">${ICON.gear}<span>${esc(t('settings.title', 'Settings'))}</span></button>
              <button type="button" class="ll-btn ghost" data-act="lang" lang="${ar ? 'en' : 'ar'}">${ICON.globe}<span>${ar ? 'English' : 'العربية'}</span></button>
              ${ui.screens.start !== ui.screens.ll_title ? `<button type="button" class="ll-btn ghost" data-act="main">${ICON.back}<span>${esc(t('ll.ui.maingame', 'Main game'))}</span></button>` : ''}
            </div>
          </nav>
        </div>
        <p class="ll-credit">${esc(t('ll.ui.credit', 'NASA Space Apps Challenge 2026 · Space Mission Design Game. Inspired by real NASA history. Not endorsed by NASA.'))}</p>
        <div class="ll-creator" hidden></div>`
      );
      const on = (act, fn) => {
        const b = main.querySelector(`[data-act="${act}"]`);
        if (b) b.addEventListener('click', fn);
      };
      on('play', () => {
        unlockAudio();
        if (!p.creator && !cp) return offerCreator(main);
        SMD.go('ll', cp ? { resume: true } : { level: lv[0] && lv[0].id });
      });
      on('chapters', () => SMD.go('ll_chapters'));
      on('journal', () => SMD.go('ll_journal'));
      on('settings', () => ui.openSettings && ui.openSettings());
      on('lang', () => {
        SMD.setLang(SMD.lang() === 'ar' ? 'en' : 'ar');
        SMD.go('ll_title');
      });
      on('main', () => SMD.go('start'));
      const stop = mountBackdrop(main.querySelector('[data-3d]'));
      return stop;
    },
  };

  // Until js/screen-team.js registers the new title, this is the way in.
  ui.screens.start = ui.screens.ll_title;

  // First run: your astronaut, once, skippable.
  function offerCreator(main) {
    saveCreatorSeen();
    const box = main.querySelector('.ll-creator');
    const a = SMD.avatar && SMD.avatar.get ? SMD.avatar.get() : { name: '' };
    box.innerHTML = `<div class="ll-creator-card" role="dialog" aria-modal="true" aria-labelledby="ll-cr-h">
        <div class="ll-creator-face" aria-hidden="true"></div>
        <div class="ll-creator-txt">
          <p class="ll-kicker">${esc(t('ll.ui.creator.kicker', 'Your astronaut'))}</p>
          <h2 id="ll-cr-h">${esc(a.name || t('ll.cast.you', 'Commander'))}</h2>
          <p>${esc(t('ll.ui.creator.body', 'You command the crew. Make them yours, or go as you are.'))}</p>
          <div class="ll-creator-actions">
            <button type="button" class="ll-btn primary" data-act="go">${ICON.play}<span>${esc(t('ll.ui.creator.go', 'Start'))}</span></button>
            <button type="button" class="ll-btn ghost" data-act="look"><span>${esc(t('ll.ui.creator.look', 'Change the look'))}</span></button>
          </div>
        </div>
      </div>`;
    box.hidden = false;
    const first = levels()[0];
    box.querySelector('[data-act="go"]').addEventListener('click', () => SMD.go('ll', { level: first && first.id }));
    box.querySelector('[data-act="look"]').addEventListener('click', () => SMD.go('avatar', { next: 'll', nextParams: { level: first && first.id }, back: 'll_title' }));
    box.querySelector('[data-act="go"]').focus();
    if (SMD.avatar && SMD.avatar.portrait)
      SMD.avatar
        .portrait(a, 256)
        .then((url) => {
          const f = box.querySelector('.ll-creator-face');
          if (f && url) f.style.backgroundImage = `url("${url}")`;
        })
        .catch(() => {});
    const onKey = (e) => {
      if (e.key === 'Escape') {
        box.hidden = true;
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey);
  }

  function loadScript(src) {
    return new Promise((res) => {
      if (document.querySelector(`script[data-ll-src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src;
      s.dataset.llSrc = src;
      s.onload = () => res();
      s.onerror = () => res();
      document.body.appendChild(s);
    });
  }

  // ---------- Chapters ----------
  ui.screens.ll_chapters = {
    render(app) {
      const p = profile();
      const open = unlocked(p);
      const main = shell(
        app,
        'll-list-screen',
        `<header class="ll-list-head"><button type="button" class="ll-btn ghost" data-act="back">${ICON.back}<span>${esc(t('ll.ui.back', 'Back'))}</span></button><h1>${esc(t('ll.ui.chapters', 'Chapters'))}</h1></header>
        <ol class="ll-chapters">${levels()
          .map((lv) => {
            const ok = open.has(lv.id);
            const cs = collectiblesOf(lv);
            const found = cs.filter((c) => p.journal[c.id]).length;
            return `<li><button type="button" class="ll-chapter${ok ? '' : ' locked'}" data-level="${esc(lv.id)}" ${ok ? '' : 'aria-disabled="true"'}>
              <span class="ll-chapter-n">${esc(levelNum(lv))}</span>
              <b class="ll-chapter-t">${esc(levelTitle(lv))}</b>
              <span class="ll-chapter-meta">${ok ? `${p.done[lv.id] ? esc(t('ll.ui.done', 'Finished')) + ' · ' : ''}${esc(t('ll.ui.found', 'Found {n} of {m}', { n: found, m: cs.length }))}${lv.minutes ? ' · ' + esc(t('ll.ui.minutes', 'About {n} min', { n: lv.minutes })) : ''}` : `${ICON.lock}${esc(t('ll.ui.locked', 'Play on to unlock'))}`}</span>
            </button></li>`;
          })
          .join('')}</ol>`
      );
      main.querySelector('[data-act="back"]').addEventListener('click', () => SMD.go('ll_title'));
      main.querySelectorAll('.ll-chapter').forEach((b) =>
        b.addEventListener('click', () => {
          if (b.classList.contains('locked')) return;
          unlockAudio();
          SMD.go('ll', { level: b.dataset.level });
        })
      );
      return mountBackdrop(main.querySelector('[data-3d]'));
    },
  };

  // ---------- Journal ----------
  ui.screens.ll_journal = {
    render(app, params) {
      const p = profile();
      const all = [];
      levels().forEach((lv) => collectiblesOf(lv).forEach((c) => all.push(Object.assign({ lv }, c))));
      const foundN = all.filter((c) => p.journal[c.id]).length;
      const main = shell(
        app,
        'll-list-screen ll-journal-screen',
        `<header class="ll-list-head"><button type="button" class="ll-btn ghost" data-act="back">${ICON.back}<span>${esc(t('ll.ui.back', 'Back'))}</span></button><h1>${esc(t('ll.ui.journal', 'Journal'))}</h1><p class="ll-list-sub num">${esc(t('ll.ui.found', 'Found {n} of {m}', { n: foundN, m: all.length }))}</p></header>
        <div class="ll-journal">${
          levels()
            .map((lv) => {
              const cs = collectiblesOf(lv);
              if (!cs.length) return '';
              return `<section><h2>${esc(levelNum(lv))} · ${esc(levelTitle(lv))}</h2><div class="ll-entries">${cs
                .map((c) => {
                  if (!p.journal[c.id]) return `<article class="ll-entry missing"><p class="ll-entry-t">${ICON.lock}<span>${esc(t('ll.ui.notfound', 'Not found yet'))}</span></p></article>`;
                  const title = t(c.titleKey || 'll.journal.' + c.id + '.title', c.title || c.id);
                  const text = t(c.textKey || 'll.journal.' + c.id + '.text', c.text || '');
                  const src = c.source || null;
                  const srcTitle = src ? t(c.sourceKey || 'll.journal.' + c.id + '.source', src.title || src.url || '') : '';
                  return `<article class="ll-entry"><h3 class="ll-entry-t">${esc(title)}</h3><p>${esc(text)}</p>${src ? `<p class="ll-entry-src">${src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(srcTitle)}</a>` : esc(srcTitle)}</p>` : ''}</article>`;
                })
                .join('')}</div></section>`;
            })
            .join('') || `<p class="ll-empty">${esc(t('ll.ui.journal.empty', 'Logs, photos and patches you find on the way end up here.'))}</p>`
        }</div>`
      );
      main.querySelector('[data-act="back"]').addEventListener('click', () => SMD.go(params && params.back ? params.back : 'll_title', params && params.backParams));
      return mountBackdrop(main.querySelector('[data-3d]'));
    },
  };

  // ---------- The game ----------
  ui.screens.ll = {
    current: null,
    render(app, params = {}) {
      app.innerHTML = `<main class="screen ll-screen" dir="${SMD.dir()}"><div class="ll-stage" data-3d></div><h1 class="sr-only">${esc(t('ll.ui.name', 'Last Light'))}</h1></main>`;
      const main = app.querySelector('main');
      const stage = main.querySelector('.ll-stage');
      const E = SMD.three && SMD.three.engine;
      let game = null;
      let gone = false;
      let pausedAt = 0;
      const self = this;
      const p0 = profile();
      const spec = params.resume && p0.checkpoint ? { snapshot: p0.checkpoint } : { level: params.level || (levels()[0] || {}).id, section: params.section };
      if (params.level === 'lltest' && !(SMD.llLevels || []).some((l) => l.id === 'lltest')) {
        loadScript('tests/fixtures/ll-test-level.js').then(() => !gone && SMD.go('ll', params));
        return () => {
          gone = true;
        };
      }

      function pauseMenu(open) {
        if (!game) return;
        if (open) {
          if (game.paused) return;
          pausedAt = performance.now();
          game.pause(true);
          game.hud.menu(
            `<div class="ll-menu-card"><p class="ll-kicker">${esc(levelNum(game.state.level))} · ${esc(levelTitle(game.state.level))}</p><h2>${esc(t('ll.ui.paused', 'Paused'))}</h2>
              <div class="ll-menu-btns">
                <button type="button" class="ll-btn primary" data-act="resume">${ICON.play}<span>${esc(t('ll.ui.resume', 'Resume'))}</span></button>
                <button type="button" class="ll-btn" data-act="restart"><span>${esc(t('ll.ui.restart', 'Restart checkpoint'))}</span></button>
                <button type="button" class="ll-btn" data-act="settings">${ICON.gear}<span>${esc(t('settings.title', 'Settings'))}</span></button>
                <button type="button" class="ll-btn" data-act="controls"><span>${esc(t('ll.ui.controls', 'Controls'))}</span></button>
                <button type="button" class="ll-btn ghost" data-act="quit"><span>${esc(t('ll.ui.quit', 'Quit to title'))}</span></button>
              </div><p class="ll-menu-note">${esc(t('ll.ui.saved', 'Progress saves at every checkpoint.'))}</p></div>`,
            (act) => {
              if (act === 'resume') resume(true);
              if (act === 'restart') {
                resume(false);
                game.restartCheckpoint();
              }
              if (act === 'settings') ui.openSettings && ui.openSettings();
              if (act === 'controls' && SMD.controls && SMD.controls.help) SMD.controls.help.open();
              if (act === 'quit') SMD.go('ll_title');
            }
          );
        } else resume(true);
      }
      function resume(lock) {
        if (!game || !game.paused) return;
        game.hud.menu(null);
        game.pause(false);
        if (lock && SMD.controls && SMD.controls.device === 'keyboard') game.player.lock();
      }
      function onPause(from) {
        if (!game || gone) return;
        if (document.querySelector('dialog[open]')) return;
        if (game.paused) {
          if (from === 'key' && performance.now() - pausedAt > 350 && !game.state.ending) resume(true);
          return;
        }
        pauseMenu(true);
      }
      function onEnd({ level, next, summary }) {
        const nextLv = next && (SMD.llLevels || []).find((l) => l.id === next);
        const row = (label, value) => (value ? `<div class="ll-end-row"><span>${esc(label)}</span><b>${esc(value)}</b></div>` : '');
        game.hud.fade(1, 1.2).then(() => {
          if (gone) return;
          game.hud.menu(
            `<div class="ll-menu-card ll-end"><p class="ll-kicker">${esc(levelNum(level))} · ${esc(t('ll.ui.complete', 'Complete'))}</p><h2>${esc(levelTitle(level))}</h2>
              <div class="ll-end-rows">
                ${row(t('ll.ui.end.carried', 'You carried'), summary.carried)}
                ${row(t('ll.ui.end.choice', 'Your call'), summary.choice ? `“${summary.choice}”` : '')}
                ${summary.total ? row(t('ll.ui.end.found', 'Found'), t('ll.ui.of', '{n} of {m}', { n: summary.found, m: summary.total })) : ''}
              </div>
              <div class="ll-menu-btns">
                ${nextLv ? `<button type="button" class="ll-btn primary big" data-act="next">${ICON.play}<span><b>${esc(t('ll.ui.next', 'Continue'))}</b><small>${esc(levelNum(nextLv))} · ${esc(levelTitle(nextLv))}</small></span></button>` : `<p class="ll-tbc">${esc(t('ll.ui.tbc', 'To be continued.'))}</p>`}
                <button type="button" class="ll-btn ghost" data-act="title"><span>${esc(t('ll.ui.title', 'Title screen'))}</span></button>
              </div></div>`,
            (act) => {
              if (act === 'next') SMD.go('ll', { level: nextLv.id });
              if (act === 'title') SMD.go('ll_title');
            }
          );
          main.querySelector('.ll-menu').classList.add('ll-end-wrap');
        });
      }

      if (!E) {
        main.insertAdjacentHTML('beforeend', `<p class="ll-empty">${esc(t('ll.ui.no3d', 'Last Light needs 3D graphics (WebGL).'))}</p>`);
        return () => {};
      }
      import(new URL('js/ll/director.js', document.baseURI).href)
        .then((mod) => {
          if (gone) return;
          game = mod.createGame({ root: main, stage, levels: SMD.llLevels || [], onEnd, onPause: (from) => onPause(from || 'key') });
          self.current = game;
          main.querySelector('.ll-pausebtn').addEventListener('click', () => pauseMenu(true));
          E.mount(stage, game.sceneObj);
          return game.start(spec);
        })
        .catch((err) => {
          console.error('Last Light failed to start', err);
          if (!gone) SMD.go('ll_title');
        });
      return () => {
        gone = true;
        self.current = null;
        if (E) E.stop();
        if (game) game.dispose();
      };
    },
  };
})();
