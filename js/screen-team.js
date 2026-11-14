// Mission Sprint v2 (docs/TEAM-V2.md): the title screen and the 'team' screen.
//
// Title: Play, Play with friends (own devices first; same room and one screen
// as quieter choices), Settings, Language, and the point of the game in one
// sentence. Last Light, the Failure Museum and Sandbox stay in the code but
// are no longer linked from here.
//
// The team screen owns one session: it creates the authoritative room, wires
// the transport, keeps the mission tracker and the pause menu on top (kit.chrome),
// and mounts SMD.team.views[phase] as the phase changes.
// A view is { mount(el, ctx) -> cleanup }. ctx is live: ctx.state and ctx.view
// always hold the latest, and ctx.subscribe(fn) calls fn after every change.
(function () {
  // Served from this computer (play.bat, file://): an invite link only works on this machine.
  const localOnly = () => {
    if (typeof location === 'undefined') return false;
    if (location.protocol === 'file:') return true;
    return /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?)$/i.test(location.hostname);
  };
  const SMD = globalThis.SMD;
  const ui = SMD.ui;
  const t = (k, e, p) => SMD.t(k, e, p);
  const esc = (s) => ui.esc(s == null ? '' : String(s));

  // Keep Last Light's title reachable from code (no longer from the title).
  if (ui.screens.start && !ui.screens.ll_title) ui.screens.ll_title = ui.screens.start;

  const K = () => SMD.team.kit;
  const unlock = () => {
    try {
      SMD.audio.unlock();
    } catch (e) {}
  };

  // A quiet backdrop: the limb of a planet and a small spacecraft. Nothing moves.
  function heroSVG() {
    return `<svg class="ts-hero-art" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="ts-planet" cx="50%" cy="0%" r="75%"><stop offset="0%" stop-color="#2a4a8f"/><stop offset="55%" stop-color="#16244f"/><stop offset="100%" stop-color="#0d1430"/></radialGradient>
      </defs>
      <circle cx="1180" cy="1120" r="660" fill="url(#ts-planet)"/>
      <circle cx="1180" cy="1120" r="660" fill="none" stroke="#7d98d6" stroke-width="2" opacity=".35"/>
      <ellipse cx="1180" cy="1120" rx="760" ry="250" transform="rotate(-12 1180 1120)" fill="none" stroke="#8fb3ff" stroke-width="1.5" opacity=".18"/>
      <g transform="translate(1010 410) rotate(-12)" opacity=".9">
        <rect x="-46" y="-6" width="34" height="12" rx="2" fill="#5d7fc4"/><rect x="12" y="-6" width="34" height="12" rx="2" fill="#5d7fc4"/>
        <rect x="-12" y="-14" width="24" height="28" rx="4" fill="#e9edf8"/><circle cx="0" cy="-22" r="6" fill="none" stroke="#e9edf8" stroke-width="2.5"/>
      </g>
      ${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 337) % 1440}" cy="${(i * 211) % 620}" r="${i % 5 ? 1 : 1.6}" fill="#dfe6ff" opacity="${0.15 + (i % 4) * 0.08}"/>`).join('')}
    </svg>`;
  }

  function relayCheck() {
    if (location.protocol === 'file:') return Promise.resolve(false);
    return fetch('api/info', { cache: 'no-store' })
      .then((r) => r.ok)
      .catch(() => false);
  }

  // The per-role client (phone.js) loads when a room needs it.
  function loadClient() {
    if (SMD.team.client) return Promise.resolve();
    if (!document.querySelector('link[data-team-phone]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'css/team-phone.css';
      l.dataset.teamPhone = '1';
      document.head.appendChild(l);
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/team/phone.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('could not load the player screen'));
      document.head.appendChild(s);
    });
  }

  ui.screens.start = {
    render(app) {
      // Fetch it now, so a dropped connection later still shows a useful screen.
      loadClient().catch(() => {});
      // Links: #team-solo, #team-one, #team-phones, #team-devices, and challenge links #c=...
      const hash = location.hash || '';
      const invite = /^#j=([\w-]+)$/.exec(hash);
      if (invite) {
        history.replaceState(null, '', location.pathname + location.search);
        SMD.go('team', { mode: 'join', code: invite[1].toUpperCase(), transport: 'webrtc' });
        return;
      }
      const direct = /^#team-(solo|one|phones|devices)$/.exec(hash);
      if (direct) {
        history.replaceState(null, '', location.pathname + location.search);
        SMD.go('team', { mode: direct[1] });
        return;
      }
      const ch = /^#c=([\w-]+)$/.exec(hash);
      if (ch) {
        history.replaceState(null, '', location.pathname + location.search);
        SMD.go('team', { mode: 'one', challenge: ch[1] });
        return;
      }
      const ar = SMD.lang() === 'ar';
      const resumable = SMD.team.net && SMD.team.net.resumable && SMD.team.net.resumable('webrtc');
      app.innerHTML = `<main class="screen ts-screen ts-title2">
        ${heroSVG()}
        <div class="ts-title2-wrap">
          <h1 class="ts-logo2"><span>${esc(t('team.title.line1', 'Every'))}</span> <span>${esc(t('team.title.line2', 'Kilogram'))}</span></h1>
          <p class="ts-point">${esc(t('team.v2.point', 'Design a spacecraft, fly it, and bring back the science. Every kilogram counts.'))}</p>
          <div class="ts-title2-main" data-main>
            <button type="button" class="ts-btn primary big" data-act="play">${esc(t('team.v2.play', 'Play'))}</button>
            <button type="button" class="ts-btn big" data-act="friends">${esc(t('team.v2.friends', 'Play with friends'))}</button>
          </div>
          <div class="ts-title2-friends" data-friends hidden>
            <button type="button" class="ts-way" data-mode="devices"><b>${esc(t('team.title.devices', 'Everyone on their own device'))}</b><span>${esc(t('team.title.devices.sub', 'Send a link. Play from anywhere, 2 to 4 players.'))}</span></button>
            <div class="ts-way-more">
              <button type="button" class="ts-way small" data-mode="phones"><b>${esc(t('team.title.phones', 'Same room with phones'))}</b><span>${esc(t('team.title.phones.sub', 'One big screen, phones in hands'))}</span></button>
              <button type="button" class="ts-way small" data-mode="one"><b>${esc(t('team.title.one', 'One screen'))}</b><span>${esc(t('team.title.one.sub', 'Everyone around one device'))}</span></button>
            </div>
            ${localOnly() ? `<p class="ts-local-note" role="note" style="max-width:34rem;margin:.9rem 0 .4rem;font-size:.92rem;line-height:1.55;opacity:.85">${esc(t('team.title.localonly', 'You opened the game from this computer, so friends on other devices cannot use your invite link. Open the game from its online link to play from anywhere, or start play-team.bat to play with phones on the same Wi-Fi.'))}</p>` : ''}
            <button type="button" class="ts-link" data-act="close-friends">${esc(t('team.back', 'Back'))}</button>
          </div>
          ${resumable ? `<p class="ts-resume">${esc(t('team.title.resume', 'Your room {code} is still open.', { code: resumable.code }))} <button type="button" class="ts-link" data-act="resume">${esc(t('team.title.resume.go', 'Go back'))}</button></p>` : ''}
          <nav class="ts-title2-small" aria-label="${esc(t('team.title.more', 'More'))}">
            ${ui.openSettings ? `<button type="button" class="ts-link" data-act="settings">${esc(t('settings.title', 'Settings'))}</button>` : ''}
            <button type="button" class="ts-link" data-act="lang" lang="${ar ? 'en' : 'ar'}">${ar ? 'English' : 'العربية'}</button>
          </nav>
          <p class="ts-credit">${esc(t('team.title.credit', 'NASA Space Apps Challenge 2026. Real numbers from NASA missions, simplified. Not endorsed by NASA.'))}</p>
        </div>
      </main>`;
      const go = (params) => {
        unlock();
        try {
          SMD.audio.beep(523, 0.08, 'sine', 0.06);
        } catch (e) {}
        SMD.go('team', params);
      };
      const on = (act, fn) => {
        const b = app.querySelector(`[data-act="${act}"]`);
        if (b) b.addEventListener('click', fn);
      };
      const friends = app.querySelector('[data-friends]');
      const main = app.querySelector('[data-main]');
      on('play', () => go({ mode: 'solo' }));
      on('friends', () => {
        unlock();
        main.hidden = true;
        friends.hidden = false;
        const first = friends.querySelector('[data-mode]');
        if (first) first.focus();
      });
      on('close-friends', () => {
        friends.hidden = true;
        main.hidden = false;
      });
      app.querySelectorAll('[data-mode]').forEach((b) =>
        b.addEventListener('click', () => {
          const m = b.dataset.mode;
          if (m !== 'phones') return go({ mode: m });
          unlock();
          // No LAN relay here (a static site): phones connect over WebRTC instead.
          relayCheck().then((ok) => go({ mode: 'phones', transport: ok ? 'relay' : 'webrtc' }));
        })
      );
      on('resume', () => go({ mode: 'devices' }));
      on('lang', () => {
        SMD.setLang(SMD.lang() === 'ar' ? 'en' : 'ar');
        SMD.go('start');
      });
      on('settings', () => ui.openSettings && ui.openSettings());
    },
  };

  // ---------- The team screen: one session, mounted by phase ----------
  ui.screens.team = {
    render(app, params = {}) {
      const root = document.createElement('main');
      root.className = 'screen ts-screen ts-stage';
      app.innerHTML = '';
      app.appendChild(root);
      let session = null;
      let offChange = null;
      let cleanup = null;
      let mounted = null;
      let phaseShown = null;
      let chrome = null;
      let gone = false;
      const isOwnDevice = params.mode === 'devices' || params.mode === 'join';

      const message = (host, title, text) => {
        host.innerHTML = '<div class="ts-missing"><h1></h1><p></p><button type="button" class="ts-btn"></button></div>';
        host.querySelector('h1').textContent = title;
        host.querySelector('p').textContent = text;
        const back = host.querySelector('button');
        back.textContent = t('team.back', 'Back');
        back.addEventListener('click', () => SMD.go('start'));
      };
      const unmount = () => {
        const c = cleanup;
        cleanup = null;
        mounted = null;
        if (c)
          try {
            c();
          } catch (e) {
            console.error('view cleanup failed', e);
          }
      };
      function show(ctx) {
        if (SMD.music && typeof SMD.music.setMission === 'function') {
          SMD.music.setMission(ctx.view && ctx.view.scenarioId, ctx.view && ctx.view.phase);
        }
        const phase = ctx.view && ctx.view.phase;
        if (!phase || phase === phaseShown) return;
        phaseShown = phase;
        unmount();
        root.querySelectorAll('.ts-phase, .ts-missing, form').forEach((n) => n.remove());
        root.dataset.phase = phase;
        const holder = document.createElement('div');
        holder.className = 'ts-phase';
        root.insertBefore(holder, root.firstChild);
        // Every device shows the same calm screens; a phase with no shared view
        // falls back to the player screen (phone.js) on a player's own device.
        const shared = (SMD.team.views || {})[phase];
        const view = shared || (isOwnDevice && SMD.team.clientPhase ? { mount: (el, c) => SMD.team.clientPhase(phase, el, c) } : null);
        if (!view) return message(holder, phase, t('team.missing', 'This part of the game is not built yet.'));
        try {
          const out = view.mount(holder, ctx);
          mounted = out;
          cleanup = typeof out === 'function' ? out : (out && (out.cleanup || out.destroy)) || null;
        } catch (e) {
          console.error('view mount failed', phase, e);
          message(holder, phase, e.message);
        }
      }
      function drawNet(ctx) {
        const net = ctx.session;
        const bar = root.querySelector('.ts-netbar');
        if (!bar) return;
        const inLobby = ctx.view && ctx.view.phase === 'lobby' && params.mode !== 'join';
        const trouble = net.status && net.status !== 'open' && net.status !== 'connecting' && net.status !== 'idle' && !inLobby;
        bar.hidden = !trouble;
        if (!trouble) return;
        bar.dataset.status = net.status;
        bar.querySelector('span').textContent = K().netMessage(net.status, net.statusCode, net.statusText);
        bar.querySelector('button').hidden = net.status !== 'closed';
      }
      function begin(sessionParams) {
        if (gone) return;
        session = K().createSession(sessionParams);
        const ctx = session.ctx;
        chrome = K().chrome(root, ctx);
        offChange = session.subscribe(() => {
          show(ctx);
          if (mounted && typeof mounted.update === 'function') mounted.update(ctx);
          if (chrome) chrome.update();
          drawNet(ctx);
        });
        show(ctx);
        if (ctx.session.status !== undefined && (sessionParams.mode === 'devices' || sessionParams.mode === 'join' || sessionParams.mode === 'phones')) {
          const bar = document.createElement('div');
          bar.className = 'ts-netbar';
          bar.hidden = true;
          bar.setAttribute('role', 'status');
          bar.innerHTML = '<span></span><button type="button" class="ts-btn small"></button>';
          const back = bar.querySelector('button');
          back.textContent = t('team.back', 'Back');
          back.addEventListener('click', () => SMD.go('start'));
          root.appendChild(bar);
          drawNet(ctx);
        }
      }
      if (isOwnDevice) {
        loadClient()
          .then(() => {
            if (gone) return;
            if (params.mode === 'join') SMD.team.joinForm(root, { code: params.code, transport: params.transport || 'webrtc', onSession: (s) => begin({ mode: 'join', session: s }) });
            else SMD.team.nameForm(root, { onName: (name) => begin({ ...params, name, transport: 'webrtc' }) });
          })
          .catch((e) => message(root, t('team.err.title', 'Something went wrong'), e.message));
      } else begin(params);
      return () => {
        gone = true;
        if (SMD.music && typeof SMD.music.setMission === 'function') SMD.music.setMission(null);
        if (offChange) offChange();
        unmount();
        if (chrome) chrome.destroy();
        if (session) session.close();
      };
    },
  };
})();
