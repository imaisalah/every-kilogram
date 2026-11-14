// Story mode, "Last Light" (docs/STORY.md): the episode menu, the commander
// intro, the scene player (cinematic dialogue, timed choices, "X will
// remember that", exploration with the shared controller, survival segments,
// history cards) and the end of each episode: the Detroit-style flowchart and
// the Telltale-style "your choices" recap.
//
//   SMD.storyGo(params)   opens story mode (works without a career)
//   params: { view: 'menu'|'play'|'flow'|'recap', episode, fast }
//   SMD.ui.screens.story.current   script handle (advance, choose, interact, ...)
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const SE = SMD.storyEngine;
  const t = (k, e, p) => SMD.t(k, e, p);
  const u = (k, e, p) => SMD.t('story.ui.' + k, e, p);
  const esc = (s) => ui.esc(s == null ? '' : String(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const reduced = () => {
    try {
      return !!(SMD.settings ? SMD.settings.reducedMotion : matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  };
  const devUnlock = () => /^#dev-story/.test(location.hash || '');

  // ---------- Routing: story mode needs no career ----------
  // main.js opens career screens only with an agency loaded. Until it lists
  // 'story' among the screens that need none, the story (and the astronaut
  // creator on its way back to the story) opens with a placeholder agency
  // that only lives while the screen renders.
  function ensureRoute() {
    if (!SMD.go || SMD.go.storyAware) return;
    const real = SMD.go;
    const go = function (screen, params) {
      const g = SMD.game;
      const needs = g && !g.agency && (screen === 'story' || (screen === 'avatar' && params && params.next === 'story'));
      if (!needs) return real.apply(this, arguments);
      g.agency = { name: '', projects: [], headlines: [], storyPlaceholder: true };
      try {
        return real.apply(this, arguments);
      } finally {
        if (g.agency && g.agency.storyPlaceholder) g.agency = null;
      }
    };
    go.storyAware = true;
    SMD.go = go;
  }
  SMD.storyGo = (params) => {
    ensureRoute();
    SMD.go('story', params || {});
  };

  // ---------- 3D modules (loaded on demand, never required) ----------
  const mods = {};
  const load = (name, path) => (mods[name] = mods[name] || import(new URL(path, document.baseURI).href).catch((e) => (console.warn(`story: ${path} did not load`, e), null)));
  const stageModule = () => load('stage', 'js/3d/storystage.js');
  const capsuleModule = () => load('capsule', 'js/3d/capsule.js');
  const controllerModule = () => load('controller', 'js/3d/controller.js');
  const astroModule = () => load('astro', 'js/3d/astronaut.js');
  const npcModule = () => load('npc', 'js/3d/npc.js');

  // Portraits for the name plate and the toasts (cached per person).
  const portraits = {};
  function portraitOf(id) {
    if (portraits[id]) return portraits[id];
    const C = SE.CAST[id];
    let job;
    if (C && C.staff) {
      const def = ((SMD.content && SMD.content.staff) || []).find((d) => d.id === C.staff);
      job = def ? npcModule().then((m) => (m && m.staffPortrait ? m.staffPortrait(def, 96) : null)) : Promise.resolve(null);
    } else {
      job = Promise.all([astroModule(), stageModule()]).then(([m, st]) => {
        if (!m || !m.createPortrait) return null;
        const you = SMD.avatar ? SMD.avatar.get() : null;
        const ap = id === 'you' ? you : st && st.crewLook ? st.crewLook(id, you) : null;
        return m.createPortrait(ap, 128, { expression: 'smile' });
      });
    }
    portraits[id] = job.catch(() => null);
    return portraits[id];
  }
  // The crew's portraits come from one offscreen WebGL renderer that
  // astronaut.js releases (forcing a context loss) a few seconds after the last
  // request. Asking for all four at once keeps that to one renderer per visit:
  // Chrome blocks WebGL for a page that loses contexts again and again.
  const warmPortraits = () => ['you', 'yusuf', 'lena', 'grace'].forEach(portraitOf);
  const initials = (id) => (SE.castName(id) || '?').trim().slice(0, 1).toUpperCase();
  function faceHTML(id, cls = '') {
    const c = (SE.CAST[id] && SE.CAST[id].color) || '#a9b6c2';
    return `<span class="st-face ${cls}" data-face="${esc(id)}" style="--c:${esc(c)}"><b>${esc(initials(id))}</b></span>`;
  }
  function fillFaces(root) {
    root.querySelectorAll('[data-face]:not([data-filled])').forEach((el) => {
      el.dataset.filled = '1';
      portraitOf(el.dataset.face).then((url) => {
        if (!url || !el.isConnected) return;
        el.style.backgroundImage = `url("${url}")`;
        el.classList.add('has-img');
      });
    });
  }

  // ---------- Sound: the radio, the master alarm, the room ----------
  function crackle(sec = 0.6, vol = 0.12) {
    if (!SMD.audio || SMD.audio.isMuted()) return;
    let c;
    try {
      c = SMD.audio.unlock();
    } catch (e) {}
    if (!c) return;
    const n = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.04 ? 1 : 0.25);
    const src = c.createBufferSource();
    src.buffer = b;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + sec);
    src.connect(bp).connect(g).connect(c.destination);
    src.start();
  }
  // The Quindar tones: a 2525 Hz beep opens a radio call, 2475 Hz closes it.
  const quindar = (open = true) => SMD.audio && SMD.audio.beep(open ? 2525 : 2475, 0.25, 'sine', 0.08);
  function radioCall() {
    quindar(true);
    setTimeout(() => crackle(0.5, 0.09), 260);
  }

  // ---------- Text ----------
  const lineText = (ev) => SE.text(ev.id || '', ev.text);
  const optText = (choiceId, o) => SE.text(choiceId + '.' + o.id, o.text);
  const epTitle = (ep) => SE.text(ep.id + '.title', ep.title || ep.id);
  const epSub = (ep) => SE.text(ep.id + '.subtitle', ep.subtitle || '');
  function endingText(ep, endingId) {
    const d = ep && ep.endings && endingId ? ep.endings[endingId] : null;
    if (!d) return null;
    const o = typeof d === 'string' ? { text: d } : d;
    const key = o.id || ep.id + '.ending.' + endingId;
    return { title: o.title ? SE.text(key + '.title', o.title) : '', text: o.text ? SE.text(key + '.text', o.text) : '' };
  }
  const RES_LABEL = () => ({ o2: u('res.o2', 'Oxygen'), power: u('res.power', 'Power'), co2: u('res.co2', 'CO₂'), water: u('res.water', 'Water'), food: u('res.food', 'Food') });
  const signed = (n) => (n > 0 ? '+' : '−') + Math.abs(n);

  // Episode art: a painted panel per episode (no images needed).
  const ART = {
    1: '<svg viewBox="0 0 200 120" aria-hidden="true"><defs><linearGradient id="a1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a14"/><stop offset="1" stop-color="#1c2f48"/></linearGradient></defs><rect width="200" height="120" fill="url(#a1)"/><g fill="#e9eef2" opacity=".7"><circle cx="20" cy="18" r="1"/><circle cx="160" cy="12" r="1"/><circle cx="120" cy="30" r=".8"/><circle cx="60" cy="26" r=".8"/></g><rect x="96" y="22" width="12" height="78" rx="5" fill="#d8813f"/><rect x="88" y="44" width="5" height="56" rx="2.5" fill="#e6e8e9"/><rect x="111" y="44" width="5" height="56" rx="2.5" fill="#e6e8e9"/><path d="M96 22 102 8 108 22z" fill="#f1f3f4"/><rect x="124" y="14" width="4" height="86" fill="#6d5040"/><g stroke="#cfe8ff" stroke-width="1.2" opacity=".9"><path d="M124 40v6M126 54v8M128 70v5"/></g><rect y="100" width="200" height="20" fill="#30363c"/><circle cx="40" cy="60" r="22" fill="#dfeeff" opacity=".12"/></svg>',
    2: '<svg viewBox="0 0 200 120" aria-hidden="true"><rect width="200" height="120" fill="#03050a"/><circle cx="160" cy="90" r="40" fill="#1d4f9a"/><circle cx="168" cy="82" r="40" fill="#03050a" opacity=".55"/><g transform="translate(70 60) rotate(-25)"><rect x="-26" y="-12" width="40" height="24" rx="3" fill="#bfc4c8"/><path d="M14-12 34-6 34 6 14 12z" fill="#dfe3e6"/><rect x="-60" y="-4" width="32" height="8" fill="#1d3a6a"/></g><g fill="#f2f6ff" opacity=".55"><circle cx="58" cy="78" r="6"/><circle cx="48" cy="88" r="9"/><circle cx="36" cy="100" r="12"/></g><circle cx="62" cy="70" r="5" fill="#ffb060"/></svg>',
    3: '<svg viewBox="0 0 200 120" aria-hidden="true"><rect width="200" height="120" fill="#020306"/><circle cx="110" cy="130" r="80" fill="#8d8a84"/><circle cx="90" cy="120" r="10" fill="#6a6762"/><circle cx="140" cy="100" r="6" fill="#6a6762"/><circle cx="30" cy="24" r="12" fill="#f0b429"/><g stroke="#f0b429" stroke-width="1.5" opacity=".7"><path d="M45 30 190 60M44 36 180 80M40 40 150 96"/></g></svg>',
    4: '<svg viewBox="0 0 200 120" aria-hidden="true"><defs><radialGradient id="a4" cx=".5" cy="1.4" r="1.2"><stop offset=".55" stop-color="#4f8fd6"/><stop offset=".62" stop-color="#9cc8f0"/><stop offset=".64" stop-color="#03050a"/></radialGradient></defs><rect width="200" height="120" fill="url(#a4)"/><g transform="translate(100 46)"><path d="M-10 -8 10 -8 16 8 -16 8z" fill="#dfe3e6"/><path d="M-18 8h36l-4 6h-28z" fill="#5a4030"/></g><path d="M86 62 70 110M100 62 100 116M114 62 130 110" stroke="#ffb060" stroke-width="5" opacity=".55"/></svg>',
  };

  // =====================================================================
  ui.screens.story = {
    current: null,
    render(app, params) {
      ensureRoute();
      delete portraits.you; // the astronaut may have changed since last time
      let alive = true;
      const cleanups = [];
      const E = SMD.three && SMD.three.engine;
      let view = null;
      let viewClean = null;
      const handle = {};
      ui.screens.story.current = handle;
      const fast = () => !!(params.fast || handle.fast);

      app.innerHTML = `<main class="screen night st${SMD.dir() === 'rtl' ? ' rtl' : ''}" aria-live="off"></main>`;
      const root = app.querySelector('main');
      function setView(name, fn) {
        if (viewClean) {
          try {
            viewClean();
          } catch (e) {
            console.error('story view cleanup failed', e);
          }
        }
        viewClean = null;
        if (E) E.stop();
        view = name;
        handle.view = name;
        root.className = `screen night st st-v-${name}${SMD.dir() === 'rtl' ? ' rtl' : ''}`;
        viewClean = fn() || null;
        const h = root.querySelector('h1, h2');
        if (h && name !== 'play') {
          h.setAttribute('tabindex', '-1');
          h.focus({ preventScroll: true });
        }
      }

      // ================= Menu: episode select =================
      function showMenu() {
        setView('menu', () => {
          const eps = SE.episodes();
          const save = SE.load();
          const done = save ? save.done : [];
          const unlockAll = devUnlock();
          const cards = eps
            .map((ep, i) => {
              const isDone = done.includes(ep.id);
              const prev = eps[i - 1];
              const open = unlockAll || i === 0 || (prev && done.includes(prev.id)) || isDone || (save && save.episode === ep.id);
              const now = save && save.episode === ep.id && !isDone;
              const fc = save && (isDone || now) ? SE.flowchart(save, ep.id) : null;
              const pct = fc ? Math.round(fc.completion * 100) : 0;
              const status = isDone ? u('menu.done', 'Complete') : now ? u('menu.inProgress', 'In progress') : open ? u('menu.ready', 'Ready') : u('menu.locked', 'Finish episode {n} first', { n: prev ? prev.n : 1 });
              return `<li class="st-ep${isDone ? ' is-done' : ''}${now ? ' is-now' : ''}${open ? '' : ' is-locked'}">
                <div class="st-ep-art">${ART[ep.n] || ART[1]}<span class="st-ep-n">${esc(u('menu.episode', 'Episode {n}', { n: ep.n }))}</span></div>
                <div class="st-ep-body">
                  <h3>${esc(epTitle(ep))}</h3>
                  <p>${esc(epSub(ep))}</p>
                  <p class="st-ep-status">${isDone ? '<span class="st-tick" aria-hidden="true">✓</span>' : !open ? '<span aria-hidden="true">🔒&#xFE0E;</span>' : ''}${esc(status)}${fc ? ` · ${esc(u('menu.found', '{p}% found', { p: pct }))}` : ''}</p>
                  <div class="st-ep-acts">
                    ${open && now ? `<button type="button" class="btn primary small" data-act="continue">${esc(u('menu.continue', 'Continue'))}</button>` : ''}
                    ${open && !now ? `<button type="button" class="btn ${isDone ? 'ghost' : 'primary'} small" data-act="play" data-ep="${esc(ep.id)}">${esc(isDone ? u('menu.replay', 'Replay') : u('menu.play', 'Play'))}</button>` : ''}
                    ${fc ? `<button type="button" class="btn ghost small" data-act="flow" data-ep="${esc(ep.id)}">${esc(u('menu.flow', 'Flowchart'))}</button>` : ''}
                  </div>
                </div>
              </li>`;
            })
            .join('');
          const later = [1, 2, 3, 4].filter((n) => !eps.some((e) => e.n === n));
          root.innerHTML = `<div class="st-menu-bg" data-3d aria-hidden="true"></div><div class="st-menu-shade" aria-hidden="true"></div>
          <div class="st-menu">
            <header class="st-menu-head">
              <p class="st-kicker">${esc(u('menu.kicker', 'Every Kilogram · Story mode'))}</p>
              <h1 class="st-logo">${esc(u('title', 'Last Light'))}</h1>
              <p class="st-lede">${esc(u('menu.lede', 'A crewed flyby of the Moon goes wrong. You are the commander. Your choices decide who comes home, and how.'))}</p>
              <div class="st-menu-main">
                ${save && save.episode && !done.includes(save.episode) ? `<button type="button" class="btn primary" data-act="continue">${esc(u('menu.continueEp', 'Continue: Episode {n}', { n: (SE.episode(save.episode) || {}).n || 1 }))}</button>` : ''}
                <button type="button" class="btn ${save ? 'ghost' : 'primary'}" data-act="new">${esc(save ? u('menu.restart', 'Start a new story') : u('menu.begin', 'Begin the story'))}</button>
                <button type="button" class="btn ghost" data-act="prefs">${esc(u('menu.settings', 'Story settings'))}</button>
                <button type="button" class="btn ghost" data-act="title">${esc(u('menu.back', 'Back to title'))}</button>
              </div>
              <p class="st-note">${esc(u('menu.note', 'Inspired by real events: Challenger (1986), Apollo 13 (1970), the August 1972 solar storm, the Artemis I heat shield (2022). Tense, never gory. About 10 to 15 minutes an episode. Progress saves at the start of every scene.'))}</p>
            </header>
            ${eps.length ? `<ol class="st-eps">${cards}${later.map((n) => `<li class="st-ep is-locked is-soon"><div class="st-ep-art">${ART[n]}<span class="st-ep-n">${esc(u('menu.episode', 'Episode {n}', { n }))}</span></div><div class="st-ep-body"><h3>${esc(u('menu.soon', 'Coming soon'))}</h3><p>${esc(u('menu.soon.d', 'This episode is still being written.'))}</p></div></li>`).join('')}</ol>` : `<p class="st-empty">${esc(u('menu.none', 'The episodes are still being written. Check back soon.'))}</p>`}
          </div>`;
          const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => b.addEventListener('click', fn));
          on('[data-act="continue"]', () => {
            const s = SE.load();
            if (s) startPlay(s, { resume: true });
          });
          on('[data-act="new"]', () => {
            if (save && save.log.length && !confirm(u('menu.restart.confirm', 'Start again from Episode 1? Your current story is replaced.'))) return;
            showIntro();
          });
          on('[data-act="play"]', (e) => {
            const id = e.currentTarget.dataset.ep;
            const list = SE.episodes();
            const i = list.findIndex((x) => x.id === id);
            const cur = SE.load();
            if (i === 0 && !(cur && cur.log.length)) return showIntro();
            let st;
            if (cur && cur.starts && cur.starts[id]) st = SE.replayEpisode(cur, id);
            else if (cur && i > 0 && cur.done.includes(list[i - 1].id)) st = SE.startEpisode(cur, id);
            else st = SE.newState(id);
            startPlay(st, {});
          });
          on('[data-act="flow"]', (e) => showEnd(e.currentTarget.dataset.ep, { from: 'menu', tab: 'flow' }));
          on('[data-act="prefs"]', () => openPrefs());
          on('[data-act="title"]', () => SMD.go('start'));
          let stage = null;
          if (E && !fast()) {
            stageModule().then((m) => {
              if (!alive || view !== 'menu' || !m) return;
              stage = m.createStoryStage({ set: 'space', cast: [], vent: false, reduced: reduced() });
              stage.shot('wide');
              E.mount(root.querySelector('[data-3d]'), stage);
            });
          }
          return () => {};
        });
      }

      // ================= Intro: you are the commander =================
      function showIntro() {
        warmPortraits();
        setView('intro', () => {
          const me = SMD.avatar ? SMD.avatar.get() : { name: SE.youName() };
          const crew = ['yusuf', 'lena', 'grace'];
          const BIO = {
            yusuf: u('intro.yusuf', 'Egyptian, ex-air force. Jokes when things get bad, and proud of it.'),
            lena: u('intro.lena', 'ESA astronaut and a physician from Germany. Calm, and blunt.'),
            grace: u('intro.grace', 'From Nigeria. A systems genius. Quiet, and too quick to blame herself.'),
          };
          root.innerHTML = `<div class="st-intro">
            <p class="st-kicker">${esc(u('title', 'Last Light'))}</p>
            <h1>${esc(u('intro.title', 'You are the commander'))}</h1>
            <div class="st-intro-me">
              <div class="st-intro-face">${faceHTML('you', 'big')}</div>
              <div>
                <p class="st-intro-name">${esc(u('intro.name', 'Commander {name}', { name: me.name || SE.youName() }))}</p>
                <p>${esc(u('intro.me', 'Four people, one small capsule, nine days around the Moon and back. Everyone on the ground and in the cabin will look to you. They will remember what you say.'))}</p>
                ${SMD.ui.screens.avatar ? `<button type="button" class="btn ghost small" data-act="avatar">${esc(u('intro.edit', 'Change your astronaut'))}</button>` : ''}
              </div>
            </div>
            <h2 class="st-intro-h">${esc(u('intro.crew', 'Your crew'))}</h2>
            <ul class="st-crew">${crew
              .map((id) => `<li>${faceHTML(id, 'big')}<div><b>${esc(SE.castFull(id))}</b><small>${esc(SE.castRole(id))}</small><p>${esc(BIO[id])}</p></div></li>`)
              .join('')}</ul>
            <div class="st-how">
              <h2 class="st-intro-h">${esc(u('intro.how', 'How it plays'))}</h2>
              <ul>
                <li>${esc(u('intro.how1', 'Walk around, look at things and talk to people. What you find changes what you can say later.'))}</li>
                <li>${esc(u('intro.how2', 'A few choices are timed. When the bar runs out, silence is an answer too.'))}</li>
                <li>${esc(u('intro.how3', 'Keep an eye on oxygen, power, CO₂ and water once things go wrong.'))}</li>
                <li>${esc(u('intro.how4', 'At the end of each episode, a flowchart shows what you did and what you could have done.'))}</li>
              </ul>
            </div>
            <div class="st-intro-acts">
              <button type="button" class="btn primary" data-act="begin">${esc(u('intro.begin', 'Begin Episode 1'))}</button>
              <button type="button" class="btn ghost" data-act="back">${esc(u('back', 'Back'))}</button>
            </div>
          </div>`;
          fillFaces(root);
          root.querySelector('[data-act="begin"]').addEventListener('click', () => {
            try {
              SMD.audio.unlock();
            } catch (e) {}
            startPlay(SE.newState(), {});
          });
          root.querySelector('[data-act="back"]').addEventListener('click', showMenu);
          const av = root.querySelector('[data-act="avatar"]');
          if (av) av.addEventListener('click', () => SMD.go('avatar', { next: 'story', nextParams: { view: 'intro' }, back: 'story', backParams: { view: 'intro' } }));
        });
      }

      // ================= Story settings =================
      function openPrefs(onClose) {
        const p = SE.prefs();
        const seg = (name, list, value) => `<div class="seg st-seg" role="group" aria-label="${esc(name)}">${list.map(([id, label]) => `<button type="button" data-v="${esc(id)}" aria-pressed="${String(id === String(value))}">${esc(label)}</button>`).join('')}</div>`;
        const d = document.createElement('div');
        d.className = 'st-modal';
        d.setAttribute('role', 'dialog');
        d.setAttribute('aria-modal', 'true');
        d.setAttribute('aria-labelledby', 'st-prefs-h');
        d.innerHTML = `<div class="st-modal-card">
          <h2 id="st-prefs-h">${esc(u('prefs.title', 'Story settings'))}</h2>
          <div class="st-pref"><span>${esc(u('prefs.speed', 'Text speed'))}</span><div data-pref="speed">${seg(u('prefs.speed', 'Text speed'), [['slow', u('prefs.slow', 'Slow')], ['normal', u('prefs.normal', 'Normal')], ['fast', u('prefs.fast', 'Fast')], ['instant', u('prefs.instant', 'Instant')]], p.speed)}</div></div>
          <div class="st-pref"><span>${esc(u('prefs.auto', 'Lines go on by themselves'))}</span><div data-pref="auto">${seg(u('prefs.auto', 'Auto-advance'), [['false', u('off', 'Off')], ['true', u('on', 'On')]], p.auto)}</div></div>
          <div class="st-pref"><span>${esc(u('prefs.skip', 'Skip lines I have already seen'))}</span><div data-pref="skipSeen">${seg(u('prefs.skip', 'Skip seen lines'), [['false', u('off', 'Off')], ['true', u('on', 'On')]], p.skipSeen)}</div></div>
          <div class="st-pref"><span>${esc(u('prefs.timers', 'Timed choices'))}</span><div data-pref="timers">${seg(u('prefs.timers', 'Timed choices'), [['normal', u('prefs.timers.normal', 'Normal')], ['relaxed', u('prefs.timers.relaxed', 'Twice as long')], ['off', u('prefs.timers.off', 'No timer')]], p.timers)}</div></div>
          <p class="st-pref-note">${esc(u('prefs.note', 'Sound, graphics and reduced motion are in the game settings.'))}</p>
          <div class="st-modal-acts">
            ${ui.openSettings ? `<button type="button" class="btn ghost" data-act="game">${esc(u('prefs.game', 'Game settings'))}</button>` : ''}
            <button type="button" class="btn primary" data-act="close">${esc(u('done', 'Done'))}</button>
          </div>
        </div>`;
        root.appendChild(d);
        d.querySelectorAll('[data-pref]').forEach((g) =>
          g.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-v]');
            if (!b) return;
            const key = g.dataset.pref;
            let v = b.dataset.v;
            if (v === 'true' || v === 'false') v = v === 'true';
            SE.setPrefs({ [key]: v });
            g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          })
        );
        const close = () => {
          d.remove();
          document.removeEventListener('keydown', onEsc, true);
          if (onClose) onClose();
        };
        const onEsc = (e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            e.preventDefault();
            close();
          }
        };
        document.addEventListener('keydown', onEsc, true);
        d.querySelector('[data-act="close"]').addEventListener('click', close);
        const gs = d.querySelector('[data-act="game"]');
        if (gs) gs.addEventListener('click', () => ui.openSettings());
        d.querySelector('[data-act="close"]').focus();
        return close;
      }

      // ================= The player =================
      function startPlay(state, opts = {}) {
        warmPortraits();
        setView('play', () => player(state, opts));
      }

      function player(state, opts) {
        let s = state;
        let run;
        try {
          run = SE.createRun(s);
        } catch (e) {
          console.error(e);
          showMenu();
          return () => {};
        }
        const ep = run.episode;
        let token = { alive: true };
        const live = () => token.alive && alive;
        root.innerHTML = `
          <div class="st-stage" data-3d></div>
          <div class="st-vignette" aria-hidden="true"></div>
          <div class="st-bars" aria-hidden="true"><i class="top"></i><i class="bot"></i></div>
          <div class="st-flash" aria-hidden="true"></div>
          <div class="st-obj" hidden><p class="st-obj-k">${esc(u('obj', 'Objective'))}</p><p class="st-obj-t" data-obj></p><p class="st-obj-c" data-clues hidden></p><p class="st-obj-h" data-hint hidden></p></div>
          <div class="st-toasts" aria-live="polite"></div>
          <div class="st-hud" hidden></div>
          <div class="st-top">
            <button type="button" class="st-iconbtn" data-act="pause" aria-label="${esc(u('pause', 'Pause menu'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
          </div>
          <div class="st-sub" hidden>
            <div class="st-plate"><span class="st-plate-face"></span><span class="st-plate-txt"><b data-name></b><small data-role></small></span></div>
            <p class="st-line" data-line></p>
            <span class="st-next" aria-hidden="true">▸</span>
          </div>
          <div class="st-choices" hidden></div>
          <div class="st-layer"></div>
          <div class="st-fade on" aria-hidden="true"></div>
          <p class="st-sr" aria-live="polite" data-sr></p>`;
        const $ = (sel) => root.querySelector(sel);
        const stageEl = $('.st-stage');
        const sub = $('.st-sub');
        const lineEl = $('[data-line]');
        const choicesEl = $('.st-choices');
        const layer = $('.st-layer');
        const fadeEl = $('.st-fade');
        const flashEl = $('.st-flash');
        const hudEl = $('.st-hud');
        const toasts = $('.st-toasts');
        const objEl = $('.st-obj');
        const srEl = $('[data-sr]');
        const prefs = () => SE.prefs();

        // ----- Stage -----
        let stage = null;
        let stageKey = '';
        let stageStale = false;
        let scene = null; // the current scene event
        let holdShots = 0;
        let prevSpeaker = null;
        let exploring = null; // { id, t0, hinted }
        let pausedT = 0;

        async function buildStage(ev, force) {
          const sc = ev.scene || {};
          const anchors = sceneExplores(sc) || !!sc.place;
          const key = [ev.set, ev.cast.join(','), anchors ? 'a' : 'm', JSON.stringify(sc.place || {})].join('|');
          if (!force && stage && key === stageKey && !stageStale && E && E.debug && E.debug.current === stage) return;
          const m = await stageModule();
          const cap = ev.set === 'capsule' ? await capsuleModule() : null;
          if (!live()) return;
          if (E) E.stop();
          stage = null;
          if (!m) return;
          try {
            stage = m.createStoryStage({
              set: ev.set,
              cast: ev.cast,
              place: sc.place || null,
              layout: anchors ? 'anchors' : 'marks',
              you: SMD.avatar ? SMD.avatar.get() : null,
              capsule: cap,
              view: sc.view || (s.flags.farSide ? 'farside' : ep.n >= 3 ? 'moon' : 'both'),
              power: s.res.power < 100 && ep.n >= 2 ? clamp(0.25 + (s.res.power / 100) * 0.75, 0.25, 1) : 1,
              vent: ep.n === 2,
              reduced: reduced(),
            });
            stageKey = key;
            stageStale = false;
            if (E) E.mount(stageEl, stage);
            if (s.flags.heatersOff && stage.frost) stage.frost(0.6);
          } catch (e) {
            console.error('story stage failed', e);
            stage = null;
          }
        }
        const sceneExplores = (sc) => {
          let found = false;
          const visit = (beats) =>
            (beats || []).forEach((b) => {
              if (!b || found) return;
              if (b.explore) found = true;
              if (b.then) visit(b.then);
              if (b.else) visit(b.else);
            });
          visit(sc.beats);
          return found;
        };
        const S = (fn) => {
          if (!stage) return;
          try {
            fn(stage);
          } catch (e) {
            console.warn('stage call failed', e);
          }
        };

        // ----- Fades, bars, cards -----
        const fade = async (on, ms = 420) => {
          fadeEl.classList.toggle('on', on);
          if (!fast()) await sleep(reduced() ? 120 : ms);
        };
        const bars = (on) => root.classList.toggle('st-letterbox', on);
        function flash(kind = 'white') {
          if (reduced()) return;
          flashEl.className = `st-flash ${kind}`;
          void flashEl.offsetWidth;
          flashEl.classList.add('go');
        }

        // ----- Input: advance -----
        let waiter = null; // { resolve, skip() } for the line on screen
        let lineAt = 0;
        function advance() {
          if (!waiter) return false;
          if (performance.now() - lineAt < 220) return false; // the key that opened this line
          const w = waiter;
          if (w.typing) w.finish();
          else {
            waiter = null;
            w.resolve();
          }
          return true;
        }
        function onKey(e) {
          if (!live()) return;
          if (root.querySelector('.st-modal')) return;
          const k = e.key;
          if (choiceKeys && /^[1-4]$/.test(k)) {
            e.preventDefault();
            choiceKeys(Number(k) - 1);
            return;
          }
          if ((k === 'Escape' || k === 'p' || k === 'P') && !(stage && stage.controller && stage.controller.locked)) {
            if (k === 'Escape' && layer.querySelector('[data-escape]')) return;
            e.preventDefault();
            pause();
            return;
          }
          if ((k === ' ' || k === 'Enter') && waiter) {
            const tag = e.target && e.target.tagName;
            if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT') return;
            e.preventDefault();
            advance();
          }
        }
        window.addEventListener('keydown', onKey);
        const onClick = (e) => {
          if (!waiter) return;
          if (e.target.closest('button, a, .st-choices, .st-layer, .st-modal, .st-hud, .ctl-layer')) return;
          advance();
        };
        root.addEventListener('click', onClick);
        $('[data-act="pause"]').addEventListener('click', () => pause());

        // ----- Lines -----
        const CPS = { slow: 28, normal: 50, fast: 110, instant: 1e6 };
        function typeLine(text) {
          return new Promise((resolve) => {
            const p = prefs();
            const seenSkip = false;
            const cps = fast() ? 1e6 : CPS[p.speed] || 50;
            const chars = Array.from(text);
            let shown = 0;
            lineEl.innerHTML = `<span class="typed"></span><span class="rest"></span>`;
            const typed = lineEl.firstChild;
            const rest = lineEl.lastChild;
            rest.textContent = text;
            let raf = 0;
            const t0 = performance.now();
            const w = {
              typing: true,
              finish() {
                cancelAnimationFrame(raf);
                typed.textContent = text;
                rest.textContent = '';
                w.typing = false;
                sub.classList.add('done');
              },
              resolve,
            };
            sub.classList.remove('done');
            const step = (now) => {
              if (!w.typing) return;
              const n = Math.min(chars.length, Math.floor(((now - t0) / 1000) * cps) + 1);
              if (n !== shown) {
                shown = n;
                typed.textContent = chars.slice(0, n).join('');
                rest.textContent = chars.slice(n).join('');
              }
              if (n >= chars.length) w.finish();
              else raf = requestAnimationFrame(step);
            };
            if (cps >= 1e5 || seenSkip) w.finish();
            else raf = requestAnimationFrame(step);
            waiter = w;
            lineAt = performance.now();
          });
        }
        async function showLine(ev) {
          const who = ev.type === 'say' ? ev.who : null;
          const text = lineText(ev);
          const onStage = who && stage && stage.has(who);
          const C = who ? SE.CAST[who] : null;
          if (exploring && stage) S((st) => st.cinematic(true));
          if (who) {
            S((st) => {
              st.speak(who, ev.mood, prevSpeaker && prevSpeaker !== who ? prevSpeaker : null);
              if (holdShots > 0) holdShots--;
              else st.autoShot(who, prevSpeaker);
            });
            if (!onStage && C && !C.crew) radioCall();
          } else S((st) => st.quiet());
          sub.hidden = false;
          sub.className = `st-sub ${who ? 'is-say' : 'is-narrate'}${who && !onStage && C && !C.crew ? ' is-radio' : ''}`;
          sub.style.setProperty('--c', (C && C.color) || '#e9eef2');
          $('[data-name]').textContent = who ? SE.castName(who) : '';
          $('[data-role]').textContent = who ? (!onStage && C && !C.crew ? u('radio', 'Radio · {role}', { role: SE.castRole(who) }) : SE.castRole(who)) : '';
          const face = $('.st-plate-face');
          face.innerHTML = who ? faceHTML(who) : '';
          fillFaces(face);
          srEl.textContent = (who ? SE.castName(who) + ': ' : '') + text;
          const seen = ev.id && SE.isSeen(ev.id);
          const p = prefs();
          const done = typeLine(text);
          if (p.skipSeen && seen) waiter && waiter.finish();
          let autoT = 0;
          const autoWait = () => {
            if (!waiter || waiter.typing) return;
            const ms = fast() ? 0 : p.skipSeen && seen ? 350 : Math.max(1600, Array.from(text).length * 55);
            autoT = setTimeout(() => {
              if (waiter && !waiter.typing) {
                const w = waiter;
                waiter = null;
                w.resolve();
              }
            }, ms);
          };
          // Auto-advance: after typing finishes, wait in proportion to the line.
          const poll = setInterval(() => {
            if ((p.auto || fast() || (p.skipSeen && seen)) && waiter && !waiter.typing && !autoT) autoWait();
          }, 60);
          await done;
          clearInterval(poll);
          clearTimeout(autoT);
          if (ev.id) SE.markSeen(ev.id);
          if (who) prevSpeaker = who;
        }

        // ----- Toasts -----
        function toast(html, cls = '') {
          const el = document.createElement('div');
          el.className = 'st-toast ' + cls;
          el.innerHTML = html;
          toasts.appendChild(el);
          fillFaces(el);
          while (toasts.children.length > 3) toasts.firstElementChild.remove();
          requestAnimationFrame(() => el.classList.add('in'));
          setTimeout(() => {
            el.classList.remove('in');
            setTimeout(() => el.remove(), 500);
          }, fast() ? 600 : 4200);
        }
        function remember(id) {
          toast(`${faceHTML(id, 'sm')}<span>${esc(u('remember', '{name} will remember that.', { name: SE.castName(id) }))}</span>`, 'is-remember');
          if (SMD.audio) SMD.audio.beep(330, 0.35, 'triangle', 0.05);
        }

        // ----- Resources -----
        let hudShown = false;
        function hud(changes) {
          if (!s.hud) {
            hudEl.hidden = true;
            return;
          }
          const L = RES_LABEL();
          const keys = ['o2', 'power', 'co2', 'water'];
          if (!hudShown) {
            hudShown = true;
            hudEl.hidden = false;
            hudEl.innerHTML = keys.map((k) => `<div class="st-g" data-g="${k}"><span class="st-g-l">${esc(L[k])}</span><span class="st-g-bar"><i></i></span><b class="st-g-v"></b><em class="st-g-d"></em></div>`).join('');
            hudEl.setAttribute('aria-label', u('res.title', 'Life support'));
          }
          keys.forEach((k) => {
            const g = hudEl.querySelector(`[data-g="${k}"]`);
            const v = Math.round(s.res[k]);
            const bad = k === 'co2' ? v >= 60 : v <= 25;
            const warn = k === 'co2' ? v >= 35 : v <= 45;
            g.className = `st-g${bad ? ' bad' : warn ? ' warn' : ''}`;
            g.querySelector('i').style.inlineSize = v + '%';
            g.querySelector('.st-g-v').textContent = k === 'co2' ? v : v + '%';
            const d = changes && changes[k];
            const de = g.querySelector('.st-g-d');
            if (d) {
              de.textContent = signed(d);
              de.className = 'st-g-d show ' + ((k === 'co2' ? d < 0 : d > 0) ? 'up' : 'down');
              clearTimeout(de._t);
              de._t = setTimeout(() => (de.className = 'st-g-d'), 2600);
            }
          });
        }

        // ----- Sound effects -----
        let alarmLoop = 0;
        function stopAlarm() {
          clearInterval(alarmLoop);
          alarmLoop = 0;
          root.classList.remove('st-alarm');
          S((st) => st.alarm(false));
        }
        function sfx(kind) {
          if (kind === 'alarm') {
            stopAlarm();
            S((st) => st.alarm(true));
            root.classList.add('st-alarm');
            let n = 0;
            const ring = () => {
              if (SMD.audio) SMD.audio.alarm();
              if (++n > 7) clearInterval(alarmLoop);
            };
            ring();
            alarmLoop = setInterval(ring, 760);
          } else if (kind === 'bang') {
            if (SMD.audio) SMD.audio.bang(1, 1.3);
            S((st) => st.shake(1.6));
            flash('white');
            root.classList.remove('st-jolt');
            void root.offsetWidth;
            if (!reduced()) root.classList.add('st-jolt');
          } else if (kind === 'radio') radioCall();
          else if (kind === 'silence') {
            stopAlarm();
            ambient.pause(3000);
          }
        }
        // The room: a fan hum in the capsule, chatter in control, wind on the pad.
        const ambient = (() => {
          let hum = null;
          let chat = 0;
          let quietUntil = 0;
          let kind = null;
          return {
            set(k) {
              if (k === kind) return;
              kind = k;
              if (hum) hum.stop();
              hum = null;
              clearInterval(chat);
              if (!SMD.audio || fast()) return;
              const lvl = { capsule: [0.035, 0.12], pad: [0.03, 0.35], control: [0.018, 0.08], briefing: [0.01, 0.05] }[k];
              if (lvl) {
                hum = SMD.audio.engine();
                hum.set(lvl[0], lvl[1]);
              }
              if (k === 'control' || k === 'capsule') {
                chat = setInterval(() => {
                  if (performance.now() < quietUntil || waiter) return;
                  if (Math.random() < 0.45) radioCall();
                }, 9000);
              }
            },
            pause(ms) {
              quietUntil = performance.now() + ms;
              if (hum) {
                hum.set(0, 0.1);
                const h = hum;
                setTimeout(() => {
                  if (hum === h && kind) {
                    const lvl = { capsule: [0.035, 0.12], pad: [0.03, 0.35], control: [0.018, 0.08], briefing: [0.01, 0.05] }[kind];
                    if (lvl) h.set(lvl[0], lvl[1]);
                  }
                }, ms);
              }
            },
            stop() {
              if (hum) hum.stop();
              hum = null;
              clearInterval(chat);
              kind = null;
            },
          };
        })();

        // ----- Title cards -----
        async function titleCard(kicker, title, subtitle, ms = 3400) {
          const el = document.createElement('div');
          el.className = 'st-title';
          el.innerHTML = `<p class="st-title-k">${esc(kicker)}</p><h2>${esc(title)}</h2>${subtitle ? `<p class="st-title-s">${esc(subtitle)}</p>` : ''}<p class="st-title-skip">${esc(u('skip', 'Click or press Space to skip'))}</p>`;
          layer.appendChild(el);
          srEl.textContent = `${kicker}. ${title}. ${subtitle || ''}`;
          requestAnimationFrame(() => el.classList.add('in'));
          await new Promise((res) => {
            let done = false;
            const end = () => {
              if (done) return;
              done = true;
              window.removeEventListener('keydown', key, true);
              el.removeEventListener('click', end);
              res();
            };
            const key = (e) => {
              if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                end();
              }
            };
            window.addEventListener('keydown', key, true);
            el.addEventListener('click', end);
            setTimeout(end, fast() ? 0 : ms);
          });
          el.classList.remove('in');
          await sleep(fast() ? 0 : 450);
          el.remove();
        }
        async function previously() {
          const prevEps = SE.episodes().filter((e) => e.n < ep.n);
          const last = prevEps[prevEps.length - 1];
          if (!last) return;
          const rc = SE.recap(s, last.id);
          const picks = rc.choices.slice(-4);
          if (!picks.length) return;
          const el = document.createElement('div');
          el.className = 'st-prev';
          el.innerHTML = `<p class="st-title-k">${esc(u('previously', 'Previously on Last Light'))}</p>
            <ul>${picks.map((c) => `<li>${esc(SE.text(c.id + '.' + c.opt, c.text))}</li>`).join('')}</ul>`;
          layer.appendChild(el);
          requestAnimationFrame(() => el.classList.add('in'));
          await Promise.race([sleep(fast() ? 0 : 4200), new Promise((r) => el.addEventListener('click', r))]);
          el.classList.remove('in');
          await sleep(fast() ? 0 : 400);
          el.remove();
        }

        // ----- Scenes -----
        let firstScene = true;
        async function enterScene(ev) {
          const setChanged = !scene || scene.set !== ev.set || stageStale || !stage;
          if (exploring) endExplore();
          stopAlarm();
          if (setChanged || !firstScene) await fade(true, setChanged ? 420 : 200);
          scene = ev;
          prevSpeaker = null;
          holdShots = 0;
          s.beat = 0;
          SE.save(s);
          SE.flushSeen();
          SE.flushFound();
          if (firstScene) {
            firstScene = false;
            const fresh = ev.id === SE.firstScene(ep) && !s.log.some((x) => x.ep === ep.id);
            sub.hidden = true;
            if (fresh) {
              if (ep.n > 1) await previously();
              await titleCard(u('episode', 'Episode {n}', { n: ep.n }), epTitle(ep), epSub(ep));
            } else if (opts.resume) await titleCard(u('episode', 'Episode {n}', { n: ep.n }), epTitle(ep), u('resume', 'Continuing from the start of the scene'), 1800);
          }
          await buildStage(ev, setChanged);
          if (!live()) return;
          ambient.set(ev.set);
          S((st) => st.shot('wide'));
          bars(!sceneExplores(ev.scene || {}));
          hud();
          await fade(false, 500);
        }

        // ----- Choices -----
        let choiceKeys = null;
        function showChoice(ev) {
          return new Promise((resolve) => {
            if (exploring) S((st) => st.cinematic(true));
            sub.hidden = true;
            const p = prefs();
            const secs = ev.timer && p.timers !== 'off' ? ev.timer * (p.timers === 'relaxed' ? 2 : 1) : 0;
            const opts = ev.options;
            const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
            choicesEl.innerHTML = `${ev.key ? `<p class="st-key"><span aria-hidden="true">◆</span>${esc(u('key', 'Key choice'))}</p>` : ''}
              ${secs ? '<div class="st-timer" aria-hidden="true"><i></i></div>' : ''}
              <div class="st-opts n${opts.length}" role="group" aria-label="${esc(u('choose', 'Choose what to say or do'))}">${opts
                .map((o, i) => {
                  const txt = optText(ev.id, o);
                  if (o.locked) {
                    const hint = o.lockedHint ? SE.text(ev.id + '.' + o.id + '.locked', o.lockedHint) : u('lockedHint', 'You missed something that would open this.');
                    return `<button type="button" class="st-opt is-locked" disabled aria-disabled="true"><kbd>${i + 1}</kbd><span class="st-opt-t">${LOCK}${esc(txt)}</span><small>${esc(hint)}</small></button>`;
                  }
                  return `<button type="button" class="st-opt" data-i="${i}"><kbd>${i + 1}</kbd><span class="st-opt-t">${esc(txt)}</span></button>`;
                })
                .join('')}</div>`;
            choicesEl.hidden = false;
            srEl.textContent = u('choose', 'Choose what to say or do') + (secs ? ' ' + u('timed', '({n} seconds)', { n: Math.round(secs) }) : '');
            requestAnimationFrame(() => choicesEl.classList.add('in'));
            const first = choicesEl.querySelector('.st-opt:not(.is-locked)');
            if (first && !('ontouchstart' in window)) first.focus({ preventScroll: true });
            let picked = false;
            let timerT = 0;
            let raf = 0;
            const pick = (i, how) => {
              if (picked) return;
              const o = opts[i];
              if (!o || o.locked) return;
              picked = true;
              choiceKeys = null;
              cancelAnimationFrame(raf);
              clearTimeout(timerT);
              choicesEl.querySelectorAll('.st-opt').forEach((b, j) => b.classList.add(j === i ? 'is-picked' : 'is-gone'));
              if (SMD.audio) SMD.audio.beep(how === 'timeout' ? 300 : 660, 0.12, 'triangle', 0.08);
              setTimeout(
                () => {
                  choicesEl.classList.remove('in');
                  choicesEl.hidden = true;
                  choicesEl.innerHTML = '';
                  resolve({ id: o.id, how });
                },
                fast() ? 0 : 520
              );
            };
            choiceKeys = (i) => pick(i, 'key');
            handle.pick = (id) => pick(opts.findIndex((o) => o.id === id), 'script');
            choicesEl.querySelectorAll('.st-opt[data-i]').forEach((b) => b.addEventListener('click', () => pick(Number(b.dataset.i), 'click')));
            if (secs) {
              const bar = choicesEl.querySelector('.st-timer i');
              const t0 = performance.now();
              const tick = (now) => {
                if (picked) return;
                if (root.querySelector('.st-modal')) {
                  raf = requestAnimationFrame(tick);
                  return;
                }
                const k = 1 - (now - t0 - pausedT) / (secs * 1000);
                bar.style.transform = `scaleX(${Math.max(0, k)})`;
                bar.parentElement.classList.toggle('low', k < 0.3);
                if (k <= 0) {
                  const tid = run.timeoutOption(ev);
                  pick(opts.findIndex((o) => o.id === tid), 'timeout');
                } else raf = requestAnimationFrame(tick);
              };
              raf = requestAnimationFrame(tick);
            }
          });
        }

        // ----- History cards -----
        function showFact(ev) {
          return new Promise((resolve) => {
            sub.hidden = true;
            const f = ev.fact || {};
            const id = ev.id;
            const el = document.createElement('div');
            el.className = 'st-fact';
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-labelledby', 'st-fact-h');
            el.dataset.escape = '1';
            let host = '';
            try {
              host = f.source ? new URL(f.source).hostname.replace(/^www\./, '') : '';
            } catch (e) {}
            el.innerHTML = `<div class="st-fact-card">
              <p class="st-fact-k">${esc(u('fact', 'What really happened'))}</p>
              <h2 id="st-fact-h">${esc(SE.text(id + '.title', f.title || ''))}</h2>
              <p>${esc(SE.text(id + '.text', f.text || ''))}</p>
              ${f.source ? `<p class="st-fact-src"><a href="${esc(f.source)}" target="_blank" rel="noopener">${esc(u('source', 'Source: {host}', { host }))}</a></p>` : ''}
              <button type="button" class="btn primary" data-act="ok">${esc(u('continue', 'Continue'))}</button>
            </div>`;
            layer.appendChild(el);
            requestAnimationFrame(() => el.classList.add('in'));
            srEl.textContent = '';
            const ok = el.querySelector('[data-act="ok"]');
            ok.focus({ preventScroll: true });
            const done = () => {
              window.removeEventListener('keydown', key, true);
              el.classList.remove('in');
              setTimeout(() => el.remove(), fast() ? 0 : 350);
              resolve();
            };
            const key = (e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                done();
              }
            };
            window.addEventListener('keydown', key, true);
            ok.addEventListener('click', done);
            handle.closeCard = done;
            if (fast()) setTimeout(done, 0);
          });
        }

        // ----- Exploring -----
        let exploreWait = null; // resolve(itemId) while the player walks
        let fallbackList = null;
        async function explore(ev) {
          sub.hidden = true;
          bars(false);
          S((st) => st.quiet());
          const first = !exploring || exploring.id !== ev.id;
          holdShots = 0; // a talk while exploring always cuts to the speaker
          if (first) {
            if (exploring) endExplore();
            exploring = { id: ev.id, t0: performance.now(), hinted: false };
            let ok = false;
            const Ctl = stage ? await controllerModule() : null;
            if (!live()) return null;
            if (stage && Ctl && Ctl.createController) {
              try {
                stage.beginExplore({ controller: Ctl, dom: stageEl.querySelector('canvas') || stageEl, overlay: stageEl, spawn: ev.spawn, items: [], onInteract: (it) => exploreWait && exploreWait(it.id) });
                const c = stage.controller;
                c.on('menu', () => pause());
                ok = true;
              } catch (e) {
                console.warn('exploring without the controller', e);
              }
            }
            exploring.ctl = ok;
            const obj = SE.text(ev.id + '.objective', ev.objective || '');
            objEl.querySelector('[data-obj]').textContent = obj;
            objEl.hidden = !obj;
            objEl.classList.remove('in');
            requestAnimationFrame(() => objEl.classList.add('in'));
            srEl.textContent = u('obj', 'Objective') + ': ' + obj;
          } else S((st) => st.cinematic(false));
          // Items, labels, the clue counter.
          const items = ev.items.map((it) => Object.assign({}, it, { label: SE.text(ev.id + '.' + it.id + '.label', it.label || it.id) + (it.locked ? ' 🔒︎' : '') }));
          if (exploring.ctl) S((st) => st.setItems(items, (it) => exploreWait && exploreWait(it.id)));
          const cl = ev.clues || [];
          const cEl = objEl.querySelector('[data-clues]');
          cEl.hidden = !cl.length;
          cEl.textContent = u('clues', 'Clues {n}/{total}', { n: cl.filter((c) => c.found).length, total: cl.length });
          // Without the controller (or for anyone who prefers it): a list of what is here.
          renderList(items, !exploring.ctl);
          const hintEl = objEl.querySelector('[data-hint]');
          const hint = ev.hint ? SE.text(ev.id + '.hint', ev.hint) : '';
          const hintTimer = setInterval(() => {
            if (!hint || exploring.hinted || !live()) return;
            if (performance.now() - exploring.t0 > (fast() ? 0 : 60000)) {
              exploring.hinted = true;
              hintEl.textContent = u('hint', 'Hint: {text}', { text: hint });
              hintEl.hidden = false;
            }
          }, 1000);
          handle.items = items;
          const id = await new Promise((resolve) => (exploreWait = resolve));
          exploreWait = null;
          clearInterval(hintTimer);
          return id;
        }
        function renderList(items, open) {
          if (fallbackList) fallbackList.remove();
          const el = document.createElement('details');
          el.className = 'st-here';
          if (open) el.open = true;
          el.innerHTML = `<summary>${esc(u('here', 'Things here'))}</summary><ul>${items.map((it) => `<li><button type="button" class="st-here-b${it.used ? ' used' : ''}${it.exit ? ' exit' : ''}" data-id="${esc(it.id)}"${it.locked ? ' aria-disabled="true"' : ''}>${esc(it.label)}</button></li>`).join('')}</ul>`;
          el.addEventListener('click', (e) => {
            const b = e.target.closest('[data-id]');
            if (b && exploreWait) exploreWait(b.dataset.id);
          });
          objEl.after(el);
          fallbackList = el;
        }
        function endExplore() {
          S((st) => st.endExplore());
          exploring = null;
          objEl.hidden = true;
          objEl.querySelector('[data-hint]').hidden = true;
          if (fallbackList) fallbackList.remove();
          fallbackList = null;
        }

        // ----- Survival -----
        async function survival(ev) {
          sub.hidden = true;
          if (exploring) endExplore();
          stopAlarm();
          ambient.stop();
          await fade(true, 380);
          const host = document.createElement('div');
          host.className = 'st-survival';
          layer.appendChild(host);
          let result = null;
          let st2 = null;
          const SS = SMD.storySurvival;
          if (SS && typeof SS.run === 'function' && !fast()) {
            try {
              if (E) E.stop();
              stage = null;
              stageStale = true;
              await fade(false, 200);
              const r = await SS.run(host, ev.id, s);
              result = r && r.result;
              st2 = r && r.state;
            } catch (e) {
              console.error('survival segment failed', e);
            }
          } else if (SS && typeof SS.quick === 'function' && fast()) {
            try {
              const r = SS.quick(ev.id, s, handle.survivalPick === 'lose' ? 'bad' : 'good');
              result = r && r.result;
              st2 = r && r.state;
            } catch (e) {}
          }
          if (result !== 'win' && result !== 'lose') {
            // Development fallback: never block the story on a missing segment.
            await fade(false, 200);
            result = await new Promise((resolve) => {
              host.innerHTML = `<div class="st-fact-card st-surv-fb"><p class="st-fact-k">${esc(u('surv.k', 'Survival segment'))}</p><h2>${esc(ev.id)}</h2><p>${esc(u('surv.fb', 'This hands-on segment is not available here. How did it go?'))}</p><div class="st-modal-acts"><button type="button" class="btn primary" data-r="win">${esc(u('surv.win', 'It worked'))}</button><button type="button" class="btn ghost" data-r="lose">${esc(u('surv.lose', 'It failed'))}</button></div></div>`;
              host.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => resolve(b.dataset.r)));
              handle.survivalPickNow = (r) => resolve(r);
              if (fast()) resolve(handle.survivalPick || 'win');
            });
          }
          await fade(true, 300);
          host.remove();
          if (E && E.debug && stage && E.debug.current !== stage) stageStale = true;
          run.survivalDone(result, st2);
          hud(null);
          return result;
        }

        // ----- Pause -----
        let pausing = false;
        function pause() {
          if (pausing || !live()) return;
          pausing = true;
          const t0 = performance.now();
          if (stage && stage.controller) stage.controller.setEnabled(false);
          const d = document.createElement('div');
          d.className = 'st-modal';
          d.setAttribute('role', 'dialog');
          d.setAttribute('aria-modal', 'true');
          d.innerHTML = `<div class="st-modal-card st-pause">
            <p class="st-kicker">${esc(u('episode', 'Episode {n}', { n: ep.n }))} · ${esc(epTitle(ep))}</p>
            <h2>${esc(u('paused', 'Paused'))}</h2>
            <div class="st-pause-acts">
              <button type="button" class="btn primary" data-act="resume">${esc(u('resume.btn', 'Resume'))}</button>
              <button type="button" class="btn ghost" data-act="flow">${esc(u('menu.flow', 'Flowchart'))}</button>
              <button type="button" class="btn ghost" data-act="prefs">${esc(u('menu.settings', 'Story settings'))}</button>
              <button type="button" class="btn ghost" data-act="menu">${esc(u('toMenu', 'Episode select'))}</button>
              <button type="button" class="btn ghost" data-act="title">${esc(u('menu.back', 'Back to title'))}</button>
            </div>
            <p class="st-pref-note">${esc(u('saved', 'Your story is saved at the start of every scene.'))}</p>
          </div>`;
          root.appendChild(d);
          const close = () => {
            d.remove();
            document.removeEventListener('keydown', key, true);
            pausing = false;
            pausedT += performance.now() - t0;
            if (stage && stage.controller && exploring && !exploreCine()) stage.controller.setEnabled(true);
          };
          const key = (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          };
          document.addEventListener('keydown', key, true);
          d.querySelector('[data-act="resume"]').addEventListener('click', close);
          d.querySelector('[data-act="flow"]').addEventListener('click', () => {
            close();
            showEnd(ep.id, { from: 'pause', tab: 'flow', state: s });
          });
          d.querySelector('[data-act="prefs"]').addEventListener('click', () => {
            d.hidden = true;
            openPrefs(() => (d.hidden = false));
          });
          d.querySelector('[data-act="menu"]').addEventListener('click', () => {
            close();
            showMenu();
          });
          d.querySelector('[data-act="title"]').addEventListener('click', () => SMD.go('start'));
          d.querySelector('[data-act="resume"]').focus();
        }
        const exploreCine = () => !!waiter || !choicesEl.hidden;

        // ----- The loop -----
        async function loop() {
          for (;;) {
            if (!live()) return;
            let ev;
            try {
              ev = run.next();
            } catch (e) {
              console.error('story runner failed', e);
              ev = null;
            }
            handle.event = ev;
            if (!ev) return;
            if (stageStale && ev.type !== 'scene' && scene) await buildStage(scene, true);
            if (exploring && ev.type !== 'explore' && ev.type !== 'scene') S((st) => st.cinematic(true));
            if (ev.camera && ev.type !== 'camera') S((st) => st.shot(ev.camera));
            if (ev.sfx && ev.type !== 'sfx') sfx(ev.sfx);
            if (ev.anim && ev.type !== 'anim') {
              const [w, n] = String(ev.anim).split(':');
              S((st) => st.anim(w, n));
            }
            if (ev.changes) {
              if (ev.changes.res && Object.keys(ev.changes.res).length) hud(ev.changes.res);
            }
            switch (ev.type) {
              case 'scene':
                await enterScene(ev);
                break;
              case 'narrate':
              case 'say':
                await showLine(ev);
                break;
              case 'choice': {
                const r = await showChoice(ev);
                if (!live()) return;
                const out = run.choose(r.id, r.how === 'timeout' ? 'timeout' : 'pick');
                out.remember.forEach((id, i) => setTimeout(() => live() && remember(id), 250 + i * 500));
                if (Object.keys(out.changes.res).length) hud(out.changes.res);
                break;
              }
              case 'explore': {
                const id = await explore(ev);
                if (!live() || id == null) return;
                const r = run.interact(id);
                if (r.locked) {
                  toast(`<span>${esc(u('notYet', 'Not yet. {obj}', { obj: SE.text(ev.id + '.objective', ev.objective || '') }))}</span>`, 'is-info');
                  break;
                }
                if (r.clue) {
                  toast(`<span class="st-clue-i" aria-hidden="true">◆</span><span>${esc(u('clue', 'Clue found: {label}', { label: SE.text(ev.id + '.' + id + '.label', r.item.def.label || id) }))}</span>`, 'is-clue');
                  if (SMD.audio) SMD.audio.chime(true);
                }
                if (Object.keys(r.changes.res).length) hud(r.changes.res);
                if (r.exit) endExplore();
                break;
              }
              case 'fact':
                await showFact(ev);
                break;
              case 'camera':
                S((st) => st.shot(ev.value));
                holdShots = 1;
                break;
              case 'anim':
                S((st) => st.anim(ev.who, ev.name));
                break;
              case 'sfx':
                sfx(ev.value);
                break;
              case 'wait':
                sub.hidden = true;
                if (!fast()) await sleep(ev.seconds * 1000);
                break;
              case 'effect':
                if (ev.changes && Object.keys(ev.changes.res).length) hud(ev.changes.res);
                break;
              case 'survival':
                await survival(ev);
                break;
              case 'end':
                await finish(ev);
                return;
            }
          }
        }

        async function finish(ev) {
          sub.hidden = true;
          if (exploring) endExplore();
          stopAlarm();
          SE.save(s);
          SE.flushSeen();
          SE.flushFound();
          await sleep(fast() ? 0 : 900);
          await fade(true, 900);
          ambient.stop();
          const end = endingText(ep, ev.ending);
          await titleCard(u('endOf', 'End of Episode {n}', { n: ep.n }), end && end.title ? end.title : epTitle(ep), end && end.text ? end.text : '', 5200);
          if (!live()) return;
          showEnd(ep.id, { from: 'end', next: ev.next, state: s, tab: 'flow' });
        }

        // Script handle (tools/shot.mjs scripts and the soak).
        Object.defineProperties(handle, {
          state: { get: () => s, configurable: true },
          stage: { get: () => stage, configurable: true },
        });
        Object.assign(handle, {
          advance,
          choose: (id) => handle.pick && handle.pick(id),
          interact: (id) => exploreWait && exploreWait(id),
          survival: (r) => handle.survivalPickNow && handle.survivalPickNow(r),
          pause,
        });

        hud();
        loop().catch((e) => console.error('story loop failed', e));
        return () => {
          token.alive = false;
          window.removeEventListener('keydown', onKey);
          root.removeEventListener('click', onClick);
          stopAlarm();
          ambient.stop();
          if (exploring) endExplore();
          if (waiter) {
            const w = waiter;
            waiter = null;
            w.resolve();
          }
          if (exploreWait) exploreWait(null);
          SE.flushSeen();
          SE.flushFound();
        };
      }

      // ================= End of episode: flowchart and your choices =================
      function showEnd(epId, o = {}) {
        const st = o.state || SE.load();
        const ep = SE.episode(epId);
        if (!st || !ep) return showMenu();
        warmPortraits();
        setView('end', () => {
          const fc = SE.flowchart(st, epId);
          const rc = SE.recap(st, epId);
          const end = endingText(ep, rc.ending);
          const nextEp = o.next ? SE.episode(o.next) : null;
          const pct = Math.round(fc.completion * 100);
          root.innerHTML = `<div class="st-end">
            <header class="st-end-head">
              <p class="st-kicker">${esc(u('episode', 'Episode {n}', { n: ep.n }))}${o.from === 'end' ? ' · ' + esc(u('complete', 'complete')) : ''}</p>
              <h1>${esc(epTitle(ep))}</h1>
              ${end && o.from === 'end' ? `<p class="st-end-ending"><b>${esc(end.title)}</b> ${esc(end.text)}</p>` : ''}
              <div class="st-pct" role="img" aria-label="${esc(u('found', '{p}% of this chapter found', { p: pct }))}"><span style="--p:${pct}"></span><b>${pct}%</b><small>${esc(u('foundShort', 'found'))}</small></div>
            </header>
            <div class="st-tabs" role="tablist">
              <button type="button" role="tab" data-tab="flow" aria-selected="${o.tab !== 'choices'}">${esc(u('menu.flow', 'Flowchart'))}</button>
              <button type="button" role="tab" data-tab="choices" aria-selected="${o.tab === 'choices'}">${esc(u('yourChoices', 'Your choices'))}</button>
              <button type="button" role="tab" data-tab="history" aria-selected="false">${esc(u('history', 'What really happened'))}</button>
            </div>
            <section class="st-panel" data-panel="flow"${o.tab === 'choices' ? ' hidden' : ''}>${flowHTML(fc, st)}</section>
            <section class="st-panel" data-panel="choices"${o.tab === 'choices' ? '' : ' hidden'}>${choicesHTML(rc, st, ep)}</section>
            <section class="st-panel" data-panel="history" hidden>${historyHTML(rc)}</section>
            <div class="st-end-acts">
              ${nextEp ? `<button type="button" class="btn primary" data-act="next">${esc(u('nextEp', 'Next: Episode {n}, {title}', { n: nextEp.n, title: epTitle(nextEp) }))}</button>` : ''}
              ${o.from === 'pause' ? `<button type="button" class="btn primary" data-act="back">${esc(u('resume.btn', 'Resume'))}</button>` : ''}
              <button type="button" class="btn ghost" data-act="replay">${esc(u('replayEp', 'Replay this episode'))}</button>
              <button type="button" class="btn ghost" data-act="menu">${esc(u('toMenu', 'Episode select'))}</button>
            </div>
          </div>`;
          fillFaces(root);
          const tabs = root.querySelectorAll('[data-tab]');
          tabs.forEach((b) =>
            b.addEventListener('click', () => {
              tabs.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
              root.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
              if (b.dataset.tab === 'flow') drawEdges();
            })
          );
          const on = (a, fn) => {
            const b = root.querySelector(`[data-act="${a}"]`);
            if (b) b.addEventListener('click', fn);
          };
          on('next', () => {
            const cur = SE.load() || st;
            startPlay(SE.startEpisode(cur, nextEp.id), {});
          });
          on('back', () => {
            const cur = SE.load();
            if (cur) startPlay(cur, { resume: true });
            else showMenu();
          });
          on('replay', () => {
            if (!confirm(u('replay.confirm', 'Replay this episode from its start? Choices made in it and after it are replaced.'))) return;
            startPlay(SE.replayEpisode(st, epId), {});
          });
          on('menu', showMenu);
          root.querySelectorAll('[data-replay]').forEach((b) =>
            b.addEventListener('click', () => {
              if (!confirm(u('replayFrom.confirm', 'Play again from this scene? What you did after it is replaced.'))) return;
              startPlay(SE.replayFrom(st, epId, Number(b.dataset.replay)), {});
            })
          );
          // Edges between scene nodes, drawn once the layout settles.
          const box = root.querySelector('.st-flow');
          function drawEdges() {
            if (!box || box.offsetParent === null) return;
            const svg = box.querySelector('svg.st-edges');
            const R = box.getBoundingClientRect();
            svg.setAttribute('width', box.scrollWidth);
            svg.setAttribute('height', box.scrollHeight);
            const pos = {};
            box.querySelectorAll('[data-node]').forEach((n) => {
              const r = n.getBoundingClientRect();
              pos[n.dataset.node] = { x: r.left - R.left + box.scrollLeft + r.width / 2, top: r.top - R.top + box.scrollTop, bottom: r.bottom - R.top + box.scrollTop };
            });
            const path = fc.path;
            let d = '';
            let lit = '';
            fc.nodes.forEach((n) => {
              n.edges.forEach((to) => {
                const a = pos[n.id];
                const b = pos[to];
                if (!a || !b) return;
                const down = b.top > a.bottom;
                const y1 = down ? a.bottom : a.top;
                const y2 = down ? b.top : b.bottom;
                const my = (y1 + y2) / 2;
                const seg = `M${a.x},${y1} C${a.x},${my} ${b.x},${my} ${b.x},${y2} `;
                const i = path.indexOf(n.id);
                if (i >= 0 && path[i + 1] === to) lit += seg;
                else d += seg;
              });
            });
            svg.innerHTML = `<path d="${d}" class="e"/><path d="${lit}" class="e lit"/>`;
          }
          requestAnimationFrame(() => requestAnimationFrame(drawEdges));
          const onResize = () => drawEdges();
          window.addEventListener('resize', onResize);
          SMD.flushStoryFound = SE.flushFound;
          return () => window.removeEventListener('resize', onResize);
        });
      }

      function flowHTML(fc, st) {
        const rows = [];
        fc.nodes.forEach((n) => (rows[n.depth] = rows[n.depth] || []).push(n));
        const trail = (st.trail && st.trail[fc.episode.id]) || [];
        const LOCK = '<span class="st-q" aria-hidden="true">?</span>';
        const node = (n) => {
          const known = n.ever;
          const idx = trail.findIndex((x) => x.scene === n.id);
          const choices = n.choices
            .map(
              (c) => `<div class="st-dia">${c.options
                .map((o) => {
                  const show = o.taken || o.found;
                  const txt = show ? SE.text(c.id + '.' + o.id, o.text) : '';
                  return `<span class="st-dopt${o.taken ? ' taken' : show ? ' seen' : ' unknown'}" title="${esc(show ? txt : u('flow.unknown', 'Not found yet'))}"><i aria-hidden="true">◆</i>${show ? esc(txt) : LOCK}</span>`;
                })
                .join('')}</div>`
            )
            .join('');
          const clues = n.clues.length
            ? `<ul class="st-fclues">${n.clues.map((c) => `<li class="${c.found ? 'found' : c.ever ? 'seen' : 'missed'}">${c.found || c.ever ? esc(SE.text(c.explore + '.' + c.item + '.label', c.label)) : esc(u('flow.missed', 'Clue missed'))}</li>`).join('')}</ul>`
            : '';
          return `<div class="st-node${n.reached ? ' reached' : known ? ' seen' : ' locked'}" data-node="${esc(n.id)}">
            <b>${known ? esc(n.title) : LOCK}</b>
            ${known ? choices + clues : ''}
            ${n.reached && idx >= 0 ? `<button type="button" class="st-replay" data-replay="${idx}">${esc(u('flow.replay', 'Replay from here'))}</button>` : ''}
          </div>`;
        };
        return `<div class="st-flow"><svg class="st-edges" aria-hidden="true"></svg>${rows
          .filter(Boolean)
          .map((r) => `<div class="st-frow">${r.map(node).join('')}</div>`)
          .join('')}</div>
          <p class="st-legend"><span class="lg reached"></span>${esc(u('flow.lit', 'Your path'))}<span class="lg seen"></span>${esc(u('flow.seen', 'Found in another playthrough'))}<span class="lg locked"></span>${esc(u('flow.locked', 'Not found yet'))}</p>`;
      }

      function fxChips(fx, rem) {
        const out = [];
        const L = RES_LABEL();
        Object.keys((fx && fx.trust) || {}).forEach((k) => out.push(`<span class="st-chip ${fx.trust[k] > 0 ? 'up' : 'down'}">${esc(u('trustChip', '{name} {d}', { name: SE.castName(k), d: signed(fx.trust[k]) }))}</span>`));
        Object.keys((fx && fx.res) || {}).forEach((k) => out.push(`<span class="st-chip ${(k === 'co2' ? fx.res[k] < 0 : fx.res[k] > 0) ? 'up' : 'down'}">${esc(`${L[k] || k} ${signed(fx.res[k])}`)}</span>`));
        (rem || []).forEach((id) => out.push(`<span class="st-chip rem">${esc(u('remembers', '{name} remembers', { name: SE.castName(id) }))}</span>`));
        return out.join('');
      }
      function choicesHTML(rc, st, ep) {
        if (!rc.choices.length) return `<p class="st-empty">${esc(u('noChoices', 'No choices made in this episode yet.'))}</p>`;
        const list = rc.choices
          .map((c) => {
            const picked = SE.text(c.id + '.' + c.opt, c.text);
            const others = (c.options || []).filter((o) => o.id !== c.opt).map((o) => SE.text(c.id + '.' + o.id, o.text));
            return `<li class="st-rc">
              <p class="st-rc-pick">${c.timedOut ? `<span class="st-badge">${esc(u('timedOut', 'Time ran out'))}</span>` : ''}${esc(picked)}</p>
              ${others.length ? `<p class="st-rc-other">${esc(u('instead', 'Instead of: {list}', { list: others.join(' · ') }))}</p>` : ''}
              <p class="st-chips">${fxChips(c.fx, c.remember)}</p>
            </li>`;
          })
          .join('');
        const people = ['yusuf', 'lena', 'grace', 'nadia', 'kwame', 'mariam', 'tarek', 'omar', 'aiko'];
        const trust = people
          .map((id) => {
            const v = st.trust[id] || 0;
            return `<li>${faceHTML(id, 'sm')}<span>${esc(SE.castName(id))}</span><span class="st-trust" role="img" aria-label="${esc(u('trustOf', 'Trust {v} of 3', { v }))}">${[-3, -2, -1, 1, 2, 3].map((k) => `<i class="${(k < 0 && v <= k) || (k > 0 && v >= k) ? (k < 0 ? 'neg' : 'pos') : ''}"></i>`).join('')}</span></li>`;
          })
          .join('');
        const L = RES_LABEL();
        const res = st.hud ? `<ul class="st-res">${['o2', 'power', 'co2', 'water'].map((k) => `<li><span>${esc(L[k])}</span><b>${Math.round(st.res[k])}${k === 'co2' ? '' : '%'}</b></li>`).join('')}</ul>` : '';
        const health = ['you', 'yusuf', 'lena', 'grace'].some((k) => st.health[k] < 100) ? `<ul class="st-res">${['you', 'yusuf', 'lena', 'grace'].map((k) => `<li><span>${esc(SE.castName(k))}</span><b>${Math.round(st.health[k])}</b></li>`).join('')}</ul>` : '';
        return `<div class="st-rc-grid"><ol class="st-rcs">${list}</ol>
          <aside class="st-rel"><h3>${esc(u('relations', 'Where you stand'))}</h3><ul class="st-people">${trust}</ul>${res ? `<h3>${esc(u('res.title', 'Life support'))}</h3>${res}` : ''}${health ? `<h3>${esc(u('health', 'Crew health'))}</h3>${health}` : ''}</aside></div>`;
      }
      function historyHTML(rc) {
        if (!rc.facts.length) return `<p class="st-empty">${esc(u('noFacts', 'No history cards in this episode yet.'))}</p>`;
        return `<ul class="st-hist">${rc.facts
          .map((f) => {
            let host = '';
            try {
              host = f.source ? new URL(f.source).hostname.replace(/^www\./, '') : '';
            } catch (e) {}
            return `<li class="st-fact-card"><p class="st-fact-k">${esc(u('fact', 'What really happened'))}</p><h3>${esc(SE.text(f.id + '.title', f.title))}</h3><p>${esc(SE.text(f.id + '.text', f.text))}</p>${f.source ? `<p class="st-fact-src"><a href="${esc(f.source)}" target="_blank" rel="noopener">${esc(u('source', 'Source: {host}', { host }))}</a></p>` : ''}</li>`;
          })
          .join('')}</ul>`;
      }

      // ---------- Open the requested view ----------
      const v = params.view;
      if (v === 'intro') showIntro();
      else if (v === 'play') {
        const sv = (params.episode && SE.newState(params.episode)) || SE.load() || SE.newState();
        startPlay(sv, { resume: !params.episode });
      } else if ((v === 'flow' || v === 'recap') && params.episode) showEnd(params.episode, { from: 'menu', tab: v === 'recap' ? 'choices' : 'flow' });
      else showMenu();

      const offLang = SMD.bus ? SMD.bus.on('lang', () => alive && SMD.storyGo({ view: view === 'play' ? 'play' : 'menu' })) : null;
      return () => {
        alive = false;
        if (viewClean) {
          try {
            viewClean();
          } catch (e) {}
        }
        if (offLang) offLang();
        cleanups.forEach((f) => f());
        if (ui.screens.story.current === handle) ui.screens.story.current = null;
        if (E) E.stop();
      };
    },
  };
})();
