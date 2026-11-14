// Shared UI helpers, toasts and the Settings dialog.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : p ? String(e).replace(/\{(\w+)\}/g, (m, x) => (p[x] !== undefined ? p[x] : m)) : e);

  const PHASES = [
    { id: 'goal', label: 'Goal' },
    { id: 'build', label: 'Build' },
    { id: 'test', label: 'Test' },
    { id: 'window', label: 'Launch window' },
    { id: 'launch', label: 'Launch' },
    { id: 'flight', label: 'Flight' },
    { id: 'science', label: 'Science' },
    { id: 'legacy', label: 'Legacy' },
  ];

  const esc = (s) => SMD.patch.escapeXml(s);
  const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '–');
  // In right-to-left text "$12M" would reorder to "12M$": isolate it.
  const ltr = (s) => (SMD.dir && SMD.dir() === 'rtl' ? `\u2066${s}\u2069` : s);
  const money = (x) => ltr(`$${fmt(x)}M`);
  const signed = (x, d = 0) => (x > 0 ? '+' : x < 0 ? '−' : '±') + fmt(Math.abs(x), d);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Dates are built from templates so each language orders day, month and
  // year its own way ("1 Mar 2028", "1 مارس 2028").
  const monthName = (i) => t('ui.month.' + i, MONTHS[i]);
  const date = (ms) => {
    const d = new Date(ms);
    return t('ui.date.dmy', '{d} {m} {y}', { d: d.getUTCDate(), m: monthName(d.getUTCMonth()), y: d.getUTCFullYear() });
  };
  const monthYear = (ms) => {
    const d = new Date(ms);
    return t('ui.date.my', '{m} {y}', { m: monthName(d.getUTCMonth()), y: d.getUTCFullYear() });
  };

  function track(current, night) {
    const idx = PHASES.findIndex((p) => p.id === current);
    return `<nav class="track" aria-label="${esc(t('ui.track', 'Mission phases'))}">
      <span class="brand">${esc(t('title.name', 'Every Kilogram'))}</span>
      <ol>${PHASES.map((p, i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}"${i === idx ? ' aria-current="step"' : ''}>${i + 1}. ${esc(t('ui.phase.' + p.id, p.label))}</li>`).join('')}</ol>
      <span class="spacer"></span>
      ${night ? '' : ''}
    </nav>`;
  }

  function seg(name, options, value) {
    return `<div class="seg" role="group" data-seg="${name}">${options
      .map((o) => `<button type="button" data-value="${esc(String(o.value))}" aria-pressed="${String(o.value) === String(value)}">${esc(o.label)}</button>`)
      .join('')}</div>`;
  }

  function tone(k, label) {
    const words = { ok: t('ui.tone.ok', 'Good'), warn: t('ui.tone.warn', 'Watch'), bad: t('ui.tone.bad', 'Problem') };
    return `<span class="tone ${k}">${esc(label || words[k])}</span>`;
  }

  // Canvas sized for the device pixel ratio (capped lower on the low tier).
  function fitCanvas(canvas, cssW, cssH) {
    const cap = SMD.settings && SMD.settings.tier() === 'low' ? 1.5 : 2;
    const dpr = Math.min(cap, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  // Sequential blue ramp (dataviz reference palette), dark to light.
  const RAMP = ['#0d366b', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4', '#b7d3f6', '#cde2fb'];
  function rampColor(x) {
    const k = Math.max(0, Math.min(1, x)) * (RAMP.length - 1);
    return RAMP[Math.round(k)];
  }

  const state = {
    screen: 'start',
    seed: (Math.random() * 1e9) | 0,
  };

  // ---------- Toasts (system notices: saving, 3D off, errors) ----------
  let toastBox = null;
  function toast(text, opts = {}) {
    if (typeof document === 'undefined' || !document.body) return;
    if (!toastBox || !toastBox.isConnected) {
      toastBox = document.createElement('div');
      toastBox.className = 'ek-toasts';
      toastBox.setAttribute('role', 'status');
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
    // The same notice twice in a row is noise.
    const last = toastBox.lastElementChild;
    if (last && last.dataset.text === text) return last;
    const el = document.createElement('div');
    el.className = `ek-toast ${opts.kind || ''}`;
    el.dataset.text = text;
    el.innerHTML = `<p>${esc(text)}</p><button type="button" class="ek-toast-x" aria-label="${esc(t('ui.close', 'Close'))}">×</button>`;
    const close = () => el.remove();
    el.querySelector('button').addEventListener('click', close);
    toastBox.appendChild(el);
    while (toastBox.children.length > 3) toastBox.firstElementChild.remove();
    if (opts.ms !== 0) setTimeout(close, opts.ms || 6000);
    return el;
  }

  // ---------- Files (save to / load from a file) ----------
  function downloadText(name, text, type = 'application/json') {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function saveFileName() {
    const ag = SMD.game && SMD.game.agency;
    const name = ((ag && ag.name) || 'agency').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'agency';
    const when = ag && ag.now ? new Date(ag.now).toISOString().slice(0, 7) : '';
    return `every-kilogram-${name}${when ? '-' + when : ''}.json`;
  }

  // ---------- Settings dialog ----------
  // SMD.ui.openSettings(): graphics quality, sound, motion, and saving to a file
  // (moving an agency between school computers, or keeping it in private mode).
  function openSettings(opts = {}) {
    const S = SMD.settings;
    if (!S || typeof document === 'undefined') return null;
    const old = document.querySelector('.ek-settings');
    if (old) old.remove();
    const dlg = document.createElement('dialog');
    dlg.className = 'ek-settings';
    dlg.setAttribute('aria-labelledby', 'ek-settings-title');
    const opener = document.activeElement;

    const reasons = {
      software: t('settings.why.software', 'this computer draws 3D without a graphics chip'),
      gpu: t('settings.why.gpu', 'the graphics chip is small'),
      memory: t('settings.why.memory', 'this device has little memory'),
      cpu: t('settings.why.cpu', 'this computer has few processor cores'),
      phone: t('settings.why.phone', 'this is a phone or tablet'),
      data: t('settings.why.data', 'data saver is on'),
    };
    function graphicsNote() {
      const tier = S.tier();
      if (S.quality !== 'auto') return tier === 'low' ? t('settings.low.note', 'Smaller textures and shadows, fewer particles, fewer pixels. Smoother on older laptops and phones.') : t('settings.high.note', 'Full-size NASA maps, sharp shadows and every particle.');
      const why = S.autoReason();
      if (tier === 'low') return t('settings.auto.low', 'Automatic chose Low because {why}. The game also lowers the resolution if frames get slow.', { why: reasons[why] || t('settings.why.other', 'this device looks modest') });
      return t('settings.auto.high', 'Automatic chose High for this device. The game lowers the resolution by itself if frames get slow.');
    }
    function saveNote() {
      if (!SMD.store.persistent()) return { k: 'warn', text: t('settings.save.memory', 'This browser is not keeping saved games (private browsing or storage turned off). Save to a file before you close the tab.') };
      if (SMD.game && SMD.game.agency) return { k: 'ok', text: t('settings.save.ok', 'Your agency saves itself in this browser after every month.') };
      return { k: 'ok', text: t('settings.save.none', 'No agency running yet. You can load one from a file.') };
    }

    function render() {
      const note = saveNote();
      const hasAgency = !!(SMD.game && SMD.game.agency);
      const broken = SMD.game && SMD.game.brokenSave && SMD.game.brokenSave();
      const brokenRow = `<p class="ek-set-note">${esc(t('settings.broken', 'An older saved agency could not be read (it may come from an earlier version of the game). A copy is kept here.'))}</p>
          <div class="ek-set-actions">
            <button type="button" class="btn small ghost" data-act="broken-get">${esc(t('settings.broken.get', 'Download the old save'))}</button>
            <button type="button" class="btn small ghost" data-act="broken-drop">${esc(t('settings.broken.drop', 'Forget it'))}</button>
          </div>`;
      dlg.innerHTML = `<form method="dialog" class="ek-settings-in">
        <header class="ek-settings-head">
          <h2 id="ek-settings-title">${esc(t('settings.title', 'Settings'))}</h2>
          <button type="submit" class="ek-settings-x" aria-label="${esc(t('ui.close', 'Close'))}">×</button>
        </header>
        <section class="ek-set-row">
          <h3>${esc(t('settings.graphics', 'Graphics'))}</h3>
          ${seg('quality', [
            { value: 'auto', label: t('settings.q.auto', 'Automatic') },
            { value: 'high', label: t('settings.q.high', 'High') },
            { value: 'low', label: t('settings.q.low', 'Low') },
          ], S.quality)}
          <p class="ek-set-note">${esc(graphicsNote())}</p>
        </section>
        <section class="ek-set-row">
          <h3>${esc(t('settings.sound', 'Sound'))}</h3>
          ${seg('sound', [
            { value: 'on', label: t('settings.on', 'On') },
            { value: 'off', label: t('settings.off', 'Off') },
          ], S.sound ? 'on' : 'off')}
        </section>
        <section class="ek-set-row">
          <h3>${esc(t('settings.motion', 'Motion'))}</h3>
          ${seg('motion', [
            { value: 'auto', label: t('settings.motion.auto', 'Like my device') },
            { value: 'on', label: t('settings.motion.on', 'Reduce motion') },
            { value: 'off', label: t('settings.motion.off', 'Full motion') },
          ], S.motionSetting)}
          <p class="ek-set-note">${esc(t('settings.motion.note', 'Reduce motion keeps cameras still and skips flashing and sliding effects. Screens you open next follow it.'))}</p>
        </section>
        <section class="ek-set-row">
          <h3>${esc(t('settings.camera', 'Camera'))}</h3>
          <p class="ek-set-label">${esc(t('settings.camera.follow', 'Camera follows automatically'))}</p>
          ${seg('autocam', [
            { value: 'on', label: t('settings.on', 'On') },
            { value: 'off', label: t('settings.off', 'Off') },
          ], S.autoCamera === false ? 'off' : 'on')}
          <p class="ek-set-label">${esc(t('settings.camera.speed', 'Look speed'))}</p>
          ${seg('look', [
            { value: '0.6', label: t('settings.camera.slow', 'Slow') },
            { value: '1', label: t('settings.camera.normal', 'Normal') },
            { value: '1.5', label: t('settings.camera.fast', 'Fast') },
            { value: '2.2', label: t('settings.camera.faster', 'Very fast') },
          ], String([0.6, 1, 1.5, 2.2].reduce((a, b) => (Math.abs(b - (S.lookSpeed || 1)) < Math.abs(a - (S.lookSpeed || 1)) ? b : a), 1)))}
          <p class="ek-set-label">${esc(t('settings.camera.invert', 'Invert up and down'))}</p>
          ${seg('invert', [
            { value: 'off', label: t('settings.off', 'Off') },
            { value: 'on', label: t('settings.on', 'On') },
          ], S.invertY ? 'on' : 'off')}
          <p class="ek-set-note">${esc(t('settings.camera.note', 'While you walk, the camera swings round behind you. Turn it yourself with the mouse or the right stick at any time.'))}</p>
        </section>
        <section class="ek-set-row">
          <h3>${esc(t('settings.saves', 'Saved game'))}</h3>
          <p class="ek-set-note"><span class="tone ${note.k}">${esc(note.text)}</span></p>
          <div class="ek-set-actions">
            <button type="button" class="btn small" data-act="export"${hasAgency ? '' : ' disabled'}>${esc(t('settings.export', 'Save to file'))}</button>
            <label class="btn small ghost ek-file">${esc(t('settings.import', 'Load from file'))}<input type="file" accept=".json,application/json" data-act="import" /></label>
          </div>
          ${broken ? brokenRow : ''}
          <p class="ek-set-msg" data-msg role="alert"></p>
        </section>
      </form>`;
      dlg.querySelectorAll('[data-seg] button').forEach((b) =>
        b.addEventListener('click', () => {
          const which = b.closest('[data-seg]').dataset.seg;
          const v = b.dataset.value;
          if (which === 'quality') S.quality = v;
          if (which === 'sound') S.sound = v === 'on';
          if (which === 'motion') S.reducedMotion = v === 'auto' ? 'auto' : v === 'on';
          if (which === 'autocam') S.autoCamera = v === 'on';
          if (which === 'look') S.lookSpeed = Number(v);
          if (which === 'invert') S.invertY = v === 'on';
          render();
          const again = dlg.querySelector(`[data-seg="${which}"] [data-value="${v}"]`);
          if (again) again.focus();
        })
      );
      const bg = dlg.querySelector('[data-act="broken-get"]');
      if (bg) bg.addEventListener('click', () => downloadText('every-kilogram-old-save.json', SMD.game.brokenSave() || ''));
      const bd = dlg.querySelector('[data-act="broken-drop"]');
      if (bd)
        bd.addEventListener('click', () => {
          SMD.game.dropBrokenSave();
          render();
        });
      const exp = dlg.querySelector('[data-act="export"]');
      exp.addEventListener('click', () => {
        const text = SMD.game.serialize();
        if (text) downloadText(saveFileName(), text);
      });
      dlg.querySelector('[data-act="import"]').addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const msg = dlg.querySelector('[data-msg]');
        f.text()
          .then((text) => {
            SMD.game.adopt(text);
            SMD.game.save();
            dlg.close();
            toast(t('settings.import.ok', 'Agency loaded: {name}.', { name: SMD.game.agency.name }), { kind: 'ok' });
            if (SMD.go) SMD.go('hq');
          })
          .catch((err) => {
            msg.textContent = t('settings.import.bad', 'That file is not an Every Kilogram save ({why}).', { why: err && err.message ? err.message : 'unreadable' });
          });
      });
    }
    render();
    dlg.addEventListener('close', () => {
      dlg.remove();
      if (opts.onClose) opts.onClose();
      if (opener && opener.isConnected && opener.focus) opener.focus();
    });
    // Click on the backdrop closes.
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
    document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute('open', '');
    return dlg;
  }

  SMD.ui = Object.assign(SMD.ui || {}, { PHASES, esc, fmt, money, signed, date, monthYear, monthName, track, seg, tone, fitCanvas, RAMP, rampColor, state, toast, downloadText, saveFileName, openSettings });
  SMD.ui.screens = SMD.ui.screens || {};
})();
