// The Controls help card (H or ?, the gamepad's View button, or the HQ menu):
// the bindings of the character controller (js/3d/controller.js) for the
// device you are using now: keyboard and mouse, gamepad or touch. It follows
// the last device you touched and has tabs to look at the others.
// SMD.controls.help: { open(device?), close(), toggle(), isOpen }.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const C = (SMD.controls = SMD.controls || {});
  C.active = C.active || 0;
  C.device = C.device || 'keyboard';
  const t = (k, en, p) => (SMD.t ? SMD.t(k, en, p) : en);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const kbd = (...k) => k.map((x) => `<kbd>${esc(x)}</kbd>`).join('');
  const pad = (b, cls) => `<span class="ctl-pad ${cls || ''}">${esc(b)}</span>`;
  const ICON = {
    mouse: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v6"/></svg>',
    stickL: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2"/></svg>',
    thumb: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="14" cy="10" r="3.5"/></svg>',
    swipe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M15 7l5 5-5 5M9 7l-5 5 5 5"/></svg>',
    tap: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="3"/><path d="M12 12v9M7 4.5a7 7 0 0 1 10 0"/></svg>',
    pinch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l5 5M19 19l-5-5M5 5v4M5 5h4M19 19v-4M19 19h-4"/></svg>',
  };

  function rows(dev) {
    if (dev === 'gamepad')
      return [
        [`${ICON.stickL}<span>${esc(t('ctl.pad.ls', 'Left stick'))}</span>`, t('ctl.do.move', 'Move (push far to run)')],
        [`${ICON.stickL}<span>${esc(t('ctl.pad.rs', 'Right stick'))}</span>`, t('ctl.do.look', 'Turn the camera')],
        [pad('RT') + pad('L3'), t('ctl.do.run', 'Run')],
        [pad('A', 'ctl-pad-a'), t('ctl.do.use', 'Use, talk, open (and press buttons in cards)')],
        [pad('B', 'ctl-pad-b'), t('ctl.do.back', 'Back, close a card, put down')],
        [pad('Y', 'ctl-pad-y'), t('ctl.do.hop', 'Hop')],
        [pad('LB') + pad('RB'), t('ctl.do.cycle', 'Next or previous thing to use')],
        [pad('View'), t('ctl.do.help', 'This card')],
      ];
    if (dev === 'touch')
      return [
        [`${ICON.thumb}<span>${esc(t('ctl.touch.left', 'Left thumb'))}</span>`, t('ctl.do.moveTouch', 'Touch and drag anywhere on the left: a joystick appears. Push it far to run.')],
        [`${ICON.swipe}<span>${esc(t('ctl.touch.right', 'Drag on the right'))}</span>`, t('ctl.do.look', 'Turn the camera')],
        [`${ICON.tap}<span>${esc(t('ctl.touch.tap', 'Tap'))}</span>`, t('ctl.do.tap', 'Walk there, or go to what you tapped')],
        [`<span class="ctl-help-big">${esc(t('ctl.touch.prompt', 'Big button'))}</span>`, t('ctl.do.useTouch', 'Use, talk, open: the button appears when something is in front of you')],
        [`${ICON.pinch}<span>${esc(t('ctl.touch.pinch', 'Pinch'))}</span>`, t('ctl.do.zoom', 'Zoom in and out')],
      ];
    return [
      [kbd('W', 'A', 'S', 'D') + `<span class="ctl-help-or">${esc(t('ctl.or', 'or'))}</span>` + kbd('↑', '←', '↓', '→'), t('ctl.do.moveKeys', 'Move (relative to the camera)')],
      [kbd('Shift'), t('ctl.do.run', 'Run')],
      [`${ICON.mouse}<span>${esc(t('ctl.kb.mouse', 'Mouse'))}</span>`, t('ctl.do.lookMouse', 'Turn the camera: drag, hold the right button, or click once to capture the mouse (Esc frees it)')],
      [kbd('Z', 'X'), t('ctl.do.lookKeys', 'Turn the camera with the keys')],
      [kbd('R'), t('ctl.do.recenter', 'Camera behind you')],
      [`${ICON.mouse}<span>${esc(t('ctl.kb.wheel', 'Wheel'))}</span>`, t('ctl.do.zoom', 'Zoom in and out')],
      [kbd('E') + kbd('Enter'), t('ctl.do.use', 'Use, talk, open')],
      [kbd('Q') + kbd('Esc'), t('ctl.do.back', 'Back, close a card, put down')],
      [kbd('Space'), t('ctl.do.hop', 'Hop')],
      [kbd('H') + kbd('?'), t('ctl.do.help', 'This card')],
    ];
  }

  let dlg = null;
  let shown = null;
  function render(dev) {
    shown = dev;
    const tabs = [
      ['keyboard', t('ctl.dev.keyboard', 'Keyboard and mouse')],
      ['gamepad', t('ctl.dev.gamepad', 'Gamepad')],
      ['touch', t('ctl.dev.touch', 'Touch')],
    ];
    dlg.innerHTML = `<form method="dialog" class="ctl-help-in">
      <header class="ctl-help-head">
        <h2 id="ctl-help-title">${esc(t('ctl.help.title', 'Controls'))}</h2>
        <button type="submit" class="ctl-help-x" aria-label="${esc(t('ui.close', 'Close'))}">×</button>
      </header>
      <div class="seg ctl-help-tabs" role="group" aria-label="${esc(t('ctl.help.device', 'Device'))}">${tabs.map(([id, label]) => `<button type="button" data-dev="${id}" aria-pressed="${id === dev}">${esc(label)}</button>`).join('')}</div>
      <p class="ctl-help-now">${esc(dev === C.device ? t('ctl.help.now', 'You are using this now. The card switches by itself.') : t('ctl.help.other', 'Shown for another device.'))}</p>
      <dl class="ctl-help-list">${rows(dev).map(([k, v]) => `<div class="ctl-help-row"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <p class="ctl-help-note">${esc(t('ctl.help.note', 'The camera follows behind you while you walk. Settings: look speed, invert up and down, and the automatic camera.'))}</p>
    </form>`;
    dlg.querySelectorAll('[data-dev]').forEach((b) =>
      b.addEventListener('click', () => {
        render(b.dataset.dev);
        const again = dlg.querySelector(`[data-dev="${b.dataset.dev}"]`);
        if (again) again.focus();
      })
    );
  }
  function open(dev) {
    if (typeof document === 'undefined') return null;
    if (dlg) close();
    const opener = document.activeElement;
    dlg = document.createElement('dialog');
    dlg.className = 'ctl-help';
    dlg.setAttribute('aria-labelledby', 'ctl-help-title');
    if (SMD.dir) dlg.setAttribute('dir', SMD.dir());
    render(dev || C.device || 'keyboard');
    dlg.addEventListener('close', () => {
      const d = dlg;
      dlg = null;
      if (d) d.remove();
      if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
    document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute('open', '');
    return dlg;
  }
  function close() {
    if (dlg && dlg.open !== false && dlg.close) dlg.close();
    else if (dlg) {
      dlg.remove();
      dlg = null;
    }
  }
  C.help = {
    open,
    close,
    toggle() {
      if (dlg) close();
      else open();
    },
    get isOpen() {
      return !!dlg;
    },
  };

  // Switch with the device while it is open.
  if (SMD.bus)
    SMD.bus.on('controls-device', (dev) => {
      if (dlg && shown !== dev) render(dev);
    });

  // H or ? opens it on any screen with the astronaut (a controller is running).
  if (typeof window !== 'undefined')
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const a = document.activeElement;
      if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
      const isH = e.code === 'KeyH' || e.key === '?';
      if (!isH) return;
      if (dlg) {
        e.preventDefault();
        close();
        return;
      }
      if (!C.active) return;
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      open();
    });
})();
