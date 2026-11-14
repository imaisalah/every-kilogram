// Title screen: the first impression. Three clear ways in (continue, a new
// agency, a classroom mission), the language switch, and the loop in four steps.
(function () {
  const SMD = globalThis.SMD;
  const { ui, patch } = SMD;
  const t = (k, e, p) => SMD.t(k, e, p);
  const esc = (s) => ui.esc(s == null ? '' : String(s));

  const demoDesign = {
    mission: 'mars',
    name: 'Every Kilogram',
    instruments: ['sounder', 'hires', 'neutron', 'context'],
    arrays: 16,
    rtg: 0,
    dish: 3,
    shield: 0,
  };

  // Name and date of the saved agency, without loading it.
  function peekSave() {
    try {
      const raw = SMD.store && SMD.store.get('ek-save');
      if (!raw) return null;
      const o = JSON.parse(raw);
      const ag = o && o.agency ? o.agency : o;
      if (!ag || typeof ag.name !== 'string') return null;
      return { name: ag.name, when: typeof ag.now === 'number' ? ui.monthYear(ag.now) : '' };
    } catch (e) {
      return null;
    }
  }

  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v15M4.5 12h15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>',
    class: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5 12 4l9 4.5-9 4.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 10.6v4.4c0 1.6 2.3 3 5 3s5-1.4 5-3v-4.4M21 8.5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.3 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.3-3.8-8.5S9.4 5.9 12 3.5z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    story: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17c-2.6-2.2-4-5.1-4-8.5s1.4-6.3 4-8.5z" fill="currentColor" opacity=".55"/><circle cx="17.5" cy="6.5" r="1.6" fill="currentColor"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M5.6 18.4l1.9-1.9M16.5 7.5l1.9-1.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  ui.screens.start = {
    render(app) {
      const save = SMD.game.hasSave() ? peekSave() || { name: '', when: '' } : null;
      const ar = SMD.lang() === 'ar';
      const choice = (act, icon, title, sub, primary, extra = '') => `<button type="button" class="ek-title-choice${primary ? ' primary' : ''}${extra}" data-act="${act}">
          <span class="ek-title-ico">${icon}</span>
          <span class="ek-title-txt"><b>${esc(title)}</b><small>${esc(sub)}</small></span>
        </button>`;
      const steps = [
        t('title.step1', 'Win a mission from the board'),
        t('title.step2', 'Design it: every kilogram costs fuel, money and risk'),
        t('title.step3', 'Steer it through NASA-style reviews and real launch windows'),
        t('title.step4', 'Fly it with real NASA data, then learn what shaped it'),
      ];
      app.innerHTML = `<main class="screen night title-3d ek-title">
        <div class="title-bg" data-3d></div>
        <div class="ek-title-shade" aria-hidden="true"></div>
        <div class="title-copy ek-title-copy">
          <div class="ek-title-brand">
            <div class="patch-mini">${patch.patchSVG(demoDesign, { year: 2026 })}</div>
            <p class="ek-title-kicker">${esc(t('title.kicker', 'A space mission design game'))}</p>
          </div>
          <h1 class="display">${esc(t('title.name', 'Every Kilogram'))}</h1>
          <p class="lede">${esc(t('title.lede2', 'Run a young space agency from 2027 to 2036. Design spacecraft where every kilogram counts, steer them through NASA’s real project life cycle, and fly them with real NASA data.'))}</p>
          <div class="title-actions ek-title-actions">
            <div class="ek-title-main">
              ${save ? choice('continue', ICON.play, t('title.continue2', 'Continue'), save.name ? t('title.continue.sub', '{name} · {when}', { name: save.name, when: save.when }) : t('title.continue', 'Continue your agency'), true) : ''}
              ${choice('story', ICON.story, t('title.story', 'Story mode: Last Light'), t('title.story.sub', 'Four episodes. Your choices decide who comes home.'), false, ' story')}
              ${choice('new', ICON.plus, t('title.new', 'Found a new agency'), t('title.new.sub', 'The full career · about an hour'), !save)}
              ${choice('classroom', ICON.class, t('title.classroom', 'Classroom: one Mars mission'), t('title.classroom.sub', 'Guided, 45 minutes, with teacher notes'), false)}
            </div>
            <div class="ek-title-minor">
              <button type="button" class="ek-title-mini" data-act="lang" lang="${ar ? 'en' : 'ar'}" aria-label="${esc(ar ? 'Switch to English' : 'التبديل إلى العربية')}">${ICON.globe}<span>${ar ? 'English' : 'العربية'}</span></button>
              ${ui.openSettings ? `<button type="button" class="ek-title-mini" data-act="settings">${ICON.gear}<span>${esc(t('settings.title', 'Settings'))}</span></button>` : ''}
            </div>
          </div>
          <ol class="ek-title-steps">${steps.map((s, i) => `<li><b class="num">${i + 1}</b><span>${esc(s)}</span></li>`).join('')}</ol>
          <p class="credit">${esc(t('title.credit', 'Made for the NASA Space Apps Challenge 2026, Space Mission Design Game. Imagery and models courtesy of NASA, NASA/JPL-Caltech and USGS. Use does not imply NASA endorsement.'))}</p>
        </div>
      </main>`;
      const on = (act, fn) => {
        const b = app.querySelector(`[data-act="${act}"]`);
        if (b) b.addEventListener('click', fn);
      };
      const unlock = () => {
        try {
          SMD.audio.unlock();
        } catch (e) {}
      };
      on('continue', () => {
        unlock();
        if (SMD.game.load()) SMD.go('hq');
        else SMD.go('start');
      });
      on('new', () => {
        unlock();
        SMD.go('newgame');
      });
      on('story', () => {
        unlock();
        if (SMD.storyGo) SMD.storyGo();
        else SMD.go('story');
      });
      on('classroom', () => {
        unlock();
        SMD.go('classroom');
      });
      on('lang', () => {
        SMD.setLang(SMD.lang() === 'ar' ? 'en' : 'ar');
        SMD.go('start');
      });
      on('settings', () => ui.openSettings());
      const E = SMD.three && SMD.three.engine;
      if (E && SMD.three.createTitle) E.mount(app.querySelector('[data-3d]'), SMD.three.createTitle());
      return () => E && E.stop();
    },
  };
})();
