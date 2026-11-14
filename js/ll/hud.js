// Last Light HUD: everything drawn over the 3D view while you play. Kept
// small and cinematic (docs/LASTLIGHT.md golden rules): one objective line,
// a waypoint diamond, subtitles at the bottom, meters only when they matter,
// big touch targets for quick-time events and choices. The director owns the
// rules and calls in here; this file owns the DOM and the raw input for the
// HUD's own moments (QTE, choices, the bench).
const SMD = (globalThis.SMD = globalThis.SMD || {});
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : e);
const reducedMotion = () => {
  try {
    if (SMD.settings && SMD.settings.reducedMotion !== undefined) return !!SMD.settings.reducedMotion;
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};
const device = () => (SMD.controls && SMD.controls.device) || 'keyboard';

// ---------- Icons (24 px line art, currentColor) ----------
const P = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" class="ll-ico"${extra}>${d}</svg>`;
const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
export const ICONS = {
  cartridge: P(`<rect x="5" y="5" width="14" height="14" rx="2" ${S}/><path d="M9 9h6v6H9z" ${S}/>`),
  hose: P(`<path d="M4 18c0-6 4-6 8-6s8 0 8-6" ${S}/><circle cx="4" cy="18" r="1.6" ${S}/><circle cx="20" cy="6" r="1.6" ${S}/>`),
  bag: P(`<path d="M6 8h12l-1 12H7z" ${S}/><path d="M9 8a3 3 0 0 1 6 0" ${S}/>`),
  tape: P(`<circle cx="12" cy="12" r="7" ${S}/><circle cx="12" cy="12" r="3" ${S}/><path d="M19 12h3" ${S}/>`),
  cover: P(`<path d="M6 3h9l3 3v15H6z" ${S}/><path d="M9 10h6M9 14h6M9 18h4" ${S}/>`),
  sock: P(`<path d="M9 3h6v9l3 4a3 3 0 0 1-3 5H9a3 3 0 0 1-3-3v-2l3-4z" ${S}/>`),
  food: P(`<rect x="6" y="4" width="12" height="16" rx="2" ${S}/><path d="M9 9h6" ${S}/>`),
  water: P(`<path d="M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z" ${S}/>`),
  tank: P(`<rect x="7" y="5" width="10" height="16" rx="5" ${S}/><path d="M10 5V3h4v2" ${S}/>`),
  camera: P(`<rect x="3" y="7" width="18" height="13" rx="2" ${S}/><circle cx="12" cy="13.5" r="3.5" ${S}/><path d="M8 7l2-3h4l2 3" ${S}/>`),
  medkit: P(`<rect x="4" y="6" width="16" height="14" rx="2" ${S}/><path d="M12 10v6M9 13h6" ${S}/>`),
  light: P(`<path d="M8 3h8l-2 8h-4z" ${S}/><path d="M10 11v9h4v-9" ${S}/>`),
  adapter: P(`<rect x="3" y="9" width="9" height="9" rx="1" ${S}/><path d="M12 13h4a4 4 0 0 0 4-4V5" ${S}/>`),
  patch: P(`<rect x="5" y="5" width="14" height="14" rx="3" ${S} stroke-dasharray="3 2"/><path d="M9 12h6" ${S}/>`),
  shield: P(`<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z" ${S}/>`),
  item: P(`<rect x="5" y="5" width="14" height="14" rx="3" ${S}/>`),
  book: P(`<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" ${S}/><path d="M4 19V5" ${S}/>`),
  lock: P(`<rect x="5" y="11" width="14" height="10" rx="2" ${S}/><path d="M8 11V8a4 4 0 0 1 8 0v3" ${S}/>`),
  o2: P(`<circle cx="12" cy="12" r="8" ${S}/><path d="M9 12a2 2 0 1 0 0.01 0" ${S}/>`),
  co2: P(`<path d="M4 14a4 4 0 0 1 4-4 5 5 0 0 1 9 1 3 3 0 0 1 1 6H8a4 4 0 0 1-4-3z" ${S}/>`),
  power: P(`<path d="M13 2L5 14h6l-1 8 8-12h-6z" ${S}/>`),
  health: P(`<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" ${S}/>`),
  radio: P(`<path d="M5 9a10 10 0 0 1 14 0M8 12a6 6 0 0 1 8 0" ${S}/><circle cx="12" cy="16" r="1.6" fill="currentColor"/>`),
  turn: P(`<path d="M20 12a8 8 0 1 1-3-6.3" ${S}/><path d="M17 2v4h-4" ${S}/>`),
  tap: P(`<path d="M9 11V5a2 2 0 0 1 4 0v6l4 1a2 2 0 0 1 1.5 2.4L17 20H9l-3-5a1.8 1.8 0 0 1 3-2z" ${S}/>`),
  pause: P(`<path d="M9 6v12M15 6v12" ${S} stroke-width="2.6"/>`),
};
export const iconFor = (id, items) => ICONS[(items && items[id] && items[id].icon) || id] || ICONS.item;

// A key / button glyph for the current device.
export function glyph(key = 'E', kind) {
  const d = device();
  if (d === 'gamepad') return `<span class="ll-pad ll-pad-a">A</span>`;
  if (d === 'touch') return `<span class="ll-tapico">${kind === 'turn' ? ICONS.turn : ICONS.tap}</span>`;
  const label = key === 'Space' ? t('ll.ui.key.space', 'Space') : key === 'Mouse' ? t('ll.ui.key.click', 'Click') : key;
  return `<kbd class="ll-kbd${label.length > 2 ? ' wide' : ''}">${esc(label)}</kbd>`;
}
const keyCode = (k) => (!k ? 'KeyE' : k === 'Space' ? 'Space' : k === 'Enter' ? 'Enter' : /^[A-Z]$/i.test(k) ? 'Key' + k.toUpperCase() : /^\d$/.test(k) ? 'Digit' + k : k);

export function createHud(root, opts = {}) {
  const sound = opts.sound || { sfx() {} };
  const items = opts.items || {};
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="ll-fx" aria-hidden="true"><div class="ll-fx-vig"></div><div class="ll-fx-o2"></div><div class="ll-fx-hurt"></div><div class="ll-fx-alarm"></div></div>
    <div class="ll-bars" aria-hidden="true"><i></i><i></i></div>
    <div class="ll-hud">
      <div class="ll-obj" hidden><p class="ll-obj-text"></p><p class="ll-obj-hint" hidden></p></div>
      <div class="ll-meters" hidden></div>
      <div class="ll-timer" hidden><span class="ll-timer-label"></span><b class="ll-timer-time num"></b></div>
      <div class="ll-way" hidden aria-hidden="true"><i class="ll-way-d"></i><span class="ll-way-m num"></span><i class="ll-way-arrow"></i></div>
      <div class="ll-dots" aria-hidden="true"></div>
      <div class="ll-toasts" aria-live="polite"></div>
      <div class="ll-title" hidden><p class="ll-title-sub"></p><h2 class="ll-title-main"></h2></div>
      <div class="ll-sub" aria-live="polite"></div>
      <div class="ll-choice" hidden></div>
      <div class="ll-qte" hidden></div>
      <div class="ll-craft" hidden></div>
      <button type="button" class="ll-pausebtn" aria-label="${esc(t('ll.ui.pause', 'Pause'))}">${ICONS.pause}</button>
    </div>
    <div class="ll-fade is-black" aria-hidden="true"><p class="ll-fade-text"></p><p class="ll-fade-sub"></p></div>
    <div class="ll-menu" hidden></div>`
  );
  const $ = (s) => root.querySelector(s);
  const el = {
    fx: $('.ll-fx'),
    o2: $('.ll-fx-o2'),
    hurt: $('.ll-fx-hurt'),
    alarm: $('.ll-fx-alarm'),
    bars: $('.ll-bars'),
    obj: $('.ll-obj'),
    objText: $('.ll-obj-text'),
    objHint: $('.ll-obj-hint'),
    meters: $('.ll-meters'),
    timer: $('.ll-timer'),
    timerLabel: $('.ll-timer-label'),
    timerTime: $('.ll-timer-time'),
    way: $('.ll-way'),
    wayM: $('.ll-way-m'),
    dots: $('.ll-dots'),
    toasts: $('.ll-toasts'),
    title: $('.ll-title'),
    sub: $('.ll-sub'),
    choice: $('.ll-choice'),
    qte: $('.ll-qte'),
    craft: $('.ll-craft'),
    pauseBtn: $('.ll-pausebtn'),
    fade: $('.ll-fade'),
    fadeText: $('.ll-fade-text'),
    fadeSub: $('.ll-fade-sub'),
    menu: $('.ll-menu'),
  };
  const timers = new Set();
  const later = (ms, fn) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  // ---------- Raw input for the HUD's own moments ----------
  const inp = { held: new Set(), edges: [], mouse: false, mouseEdges: 0, mx: 0, my: 0, touch: false, touchEdges: 0, touchTurn: 0, padPrev: [], padEdges: [], padA: false, stickAng: null, stickTurn: 0, lastAlt: '' };
  const onKey = (e) => {
    if (e.repeat) return;
    inp.edges.push(e.code);
    inp.held.add(e.code);
  };
  const onKeyUp = (e) => inp.held.delete(e.code);
  const onMouseDown = (e) => {
    if (e.button !== 0 || (e.target && e.target.closest && e.target.closest('button, a, .ll-menu, dialog'))) return;
    inp.mouse = true;
    inp.mouseEdges++;
  };
  const onMouseUp = (e) => e.button === 0 && (inp.mouse = false);
  const onMouseMove = (e) => {
    inp.mx += e.movementX || 0;
    inp.my += e.movementY || 0;
  };
  const onBlur = () => {
    inp.held.clear();
    inp.mouse = false;
    inp.touch = false;
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mouseup', onMouseUp, true);
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('blur', onBlur);
  function pollPad() {
    let gp = null;
    try {
      const all = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of all) if (p && p.connected) {
        gp = p;
        break;
      }
    } catch (e) {}
    inp.padEdges = [];
    inp.padA = false;
    inp.stickTurn = 0;
    if (!gp) return;
    const bt = gp.buttons || [];
    const now = bt.map((b) => !!(b && (b.pressed || b.value > 0.5)));
    now.forEach((v, i) => v && !inp.padPrev[i] && inp.padEdges.push(i));
    inp.padPrev = now;
    inp.padA = !!(now[0] || now[7]);
    // Stick rotation (either stick) for 'turn'.
    const ax = gp.axes || [];
    const sx = Math.abs(ax[2] || 0) + Math.abs(ax[3] || 0) > Math.abs(ax[0] || 0) + Math.abs(ax[1] || 0) ? ax[2] || 0 : ax[0] || 0;
    const sy = sx === (ax[2] || 0) && sx !== 0 ? ax[3] || 0 : ax[1] || 0;
    if (Math.hypot(sx, sy) > 0.55) {
      const a = Math.atan2(sy, sx);
      if (inp.stickAng != null) inp.stickTurn = Math.abs(Math.atan2(Math.sin(a - inp.stickAng), Math.cos(a - inp.stickAng)));
      inp.stickAng = a;
    } else inp.stickAng = null;
  }
  // One snapshot per frame; edges are consumed.
  function readInput(actionKey = 'KeyE') {
    pollPad();
    const ed = inp.edges;
    inp.edges = [];
    const has = (c) => ed.includes(c);
    const action = [actionKey, 'Space', 'Enter'];
    let pressed = ed.filter((c) => action.includes(c)).length + inp.mouseEdges + inp.touchEdges + inp.padEdges.filter((i) => i === 0 || i === 7).length;
    const down = action.some((c) => inp.held.has(c)) || inp.mouse || inp.touch || inp.padA;
    // Turning: alternate A/D (or arrows), move the mouse in circles, roll a
    // stick, or circle a finger on the button.
    let turn = inp.stickTurn + inp.touchTurn + (Math.abs(inp.mx) + Math.abs(inp.my)) * 0.0065;
    ed.forEach((c) => {
      const side = c === 'KeyA' || c === 'ArrowLeft' || c === 'KeyQ' ? 'l' : c === 'KeyD' || c === 'ArrowRight' ? 'r' : '';
      if (side && side !== inp.lastAlt) {
        turn += Math.PI / 2;
        inp.lastAlt = side;
      }
    });
    inp.mouseEdges = 0;
    inp.touchEdges = 0;
    inp.touchTurn = 0;
    inp.mx = inp.my = 0;
    const digit = [1, 2, 3].find((n) => has('Digit' + n) || has('Numpad' + n)) || 0;
    const num = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => has('Digit' + n) || has('Numpad' + n)) || 0;
    return {
      pressed,
      down,
      turn,
      digit,
      num,
      left: has('ArrowLeft') || has('KeyA') || inp.padEdges.includes(14),
      right: has('ArrowRight') || has('KeyD') || inp.padEdges.includes(15),
      up: has('ArrowUp') || has('KeyW') || inp.padEdges.includes(12),
      down2: has('ArrowDown') || has('KeyS') || inp.padEdges.includes(13),
      confirm: has('Enter') || has('KeyE') || has('Space') || inp.padEdges.includes(0),
      back: has('KeyQ') || has('Escape') || has('Backspace') || inp.padEdges.includes(1),
      pause: has('Escape') || has('KeyP') || inp.padEdges.includes(9),
      inventory: has('Tab') || has('KeyI'),
    };
  }
  // Touch: a big button acts as the action key (and its circle for 'turn').
  function bindTouchButton(btn) {
    let ang = null;
    const centre = () => {
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      inp.touch = true;
      inp.touchEdges++;
      const c = centre();
      ang = Math.atan2(e.clientY - c.y, e.clientX - c.x);
      try {
        btn.setPointerCapture(e.pointerId);
      } catch (err) {}
    });
    btn.addEventListener('pointermove', (e) => {
      if (ang == null) return;
      const c = centre();
      const a = Math.atan2(e.clientY - c.y, e.clientX - c.x);
      inp.touchTurn += Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang)));
      ang = a;
    });
    const up = () => {
      inp.touch = false;
      ang = null;
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('click', (e) => e.preventDefault());
  }

  // ---------- Fades, titles, letterbox ----------
  let fadeK = 1;
  function fade(to, secs = 0.9) {
    const rm = reducedMotion();
    const d = rm ? Math.min(secs, 0.25) : secs;
    fadeK = to;
    el.fade.style.transitionDuration = `${d}s`;
    el.fade.classList.toggle('is-black', to >= 0.5);
    el.fade.style.opacity = String(to);
    return new Promise((res) => later(d * 1000 + 30, res));
  }
  function fadeMessage(text, sub) {
    el.fadeText.textContent = text || '';
    el.fadeSub.textContent = sub || '';
    el.fade.classList.toggle('has-text', !!(text || sub));
  }
  function title(main, sub, secs = 3.6) {
    el.title.querySelector('.ll-title-main').textContent = main || '';
    el.title.querySelector('.ll-title-sub').textContent = sub || '';
    el.title.hidden = false;
    el.title.classList.remove('out');
    void el.title.offsetWidth;
    el.title.classList.add('in');
    return new Promise((res) =>
      later(secs * 1000, () => {
        el.title.classList.remove('in');
        el.title.classList.add('out');
        later(700, () => {
          el.title.hidden = true;
          res();
        });
      })
    );
  }
  function letterbox(on) {
    el.bars.classList.toggle('on', !!on);
    root.classList.toggle('ll-cine', !!on);
  }

  // ---------- Objective, hint ----------
  let objKey = '';
  function objective(text) {
    if (!text) {
      el.obj.classList.add('out');
      objKey = '';
      later(400, () => objKey === '' && (el.obj.hidden = true));
      hint(null);
      return;
    }
    if (text === objKey) return;
    objKey = text;
    el.objText.textContent = text;
    el.obj.hidden = false;
    el.obj.classList.remove('out', 'new');
    void el.obj.offsetWidth;
    el.obj.classList.add('new');
    hint(null);
  }
  function hint(text) {
    el.objHint.hidden = !text;
    if (text) {
      el.objHint.textContent = text;
      if (el.obj.hidden && objKey === '') {
        el.objText.textContent = '';
        el.obj.hidden = false;
      }
    }
  }

  // ---------- Waypoint and nearby things ----------
  function waypoint(w) {
    if (!w || !w.on) {
      el.way.hidden = true;
      return;
    }
    el.way.hidden = false;
    el.way.classList.toggle('edge', !!w.edge);
    el.way.classList.toggle('near', w.dist < 4);
    el.way.style.transform = `translate(${w.x.toFixed(1)}px, ${w.y.toFixed(1)}px)`;
    el.way.style.setProperty('--ang', `${(w.angle || 0).toFixed(3)}rad`);
    const m = w.dist >= 100 ? Math.round(w.dist / 10) * 10 : Math.round(w.dist);
    const txt = t('ll.ui.metres', '{n} m', { n: m });
    if (el.wayM.textContent !== txt) el.wayM.textContent = txt;
    el.way.classList.toggle('pulse', !!w.pulse);
  }
  const dotEls = [];
  function dots(list) {
    while (dotEls.length < list.length) {
      const d = document.createElement('i');
      el.dots.appendChild(d);
      dotEls.push(d);
    }
    dotEls.forEach((d, i) => {
      const p = list[i];
      if (!p) {
        d.hidden = true;
        return;
      }
      d.hidden = false;
      d.className = 'll-dot ' + (p.kind || '');
      d.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      d.style.opacity = String(p.alpha != null ? p.alpha : 1);
    });
  }

  // ---------- Meters ----------
  const LABELS = {
    o2: () => t('ll.ui.m.o2', 'O2'),
    co2: () => t('ll.ui.m.co2', 'CO2'),
    power: () => t('ll.ui.m.power', 'Power'),
    health: () => t('ll.ui.m.health', 'Suit'),
  };
  let meterKeys = [];
  function setMeters(keys) {
    meterKeys = keys.slice();
    el.meters.hidden = !keys.length;
    el.meters.innerHTML = keys
      .map(
        (k) => `<div class="ll-meter" data-k="${esc(k)}">${ICONS[k] || ''}<span class="ll-meter-l">${esc(LABELS[k] ? LABELS[k]() : k)}</span><span class="ll-meter-bar"><i></i></span><b class="ll-meter-v num"></b></div>`
      )
      .join('');
  }
  function meters(res, info) {
    meterKeys.forEach((k) => {
      const row = el.meters.querySelector(`[data-k="${k}"]`);
      if (!row) return;
      const m = info.meta[k];
      const v = res[k];
      const frac = clamp((v - m.min) / (m.max - m.min), 0, 1);
      row.querySelector('i').style.inlineSize = `${(frac * 100).toFixed(1)}%`;
      const txt = k === 'co2' ? t('ll.ui.mmhg', '{n} mmHg', { n: v.toFixed(v < 10 ? 1 : 0) }) : `${Math.round(v)}%`;
      const vb = row.querySelector('.ll-meter-v');
      if (vb.textContent !== txt) vb.textContent = txt;
      const sev = info.sev[k] || 0;
      row.classList.toggle('warn', sev > 0);
      row.classList.toggle('bad', sev > 0.5);
    });
  }

  // ---------- Effects ----------
  let blurNow = -1;
  function effects(fx, canvas) {
    el.o2.style.opacity = String(clamp(fx.o2 || 0, 0, 1));
    el.o2.classList.toggle('beat', (fx.o2 || 0) > 0.05 && !reducedMotion());
    el.hurt.style.opacity = String(clamp(fx.hurt || 0, 0, 1) * 0.85);
    el.alarm.classList.toggle('on', !!fx.alarm && !reducedMotion());
    el.alarm.classList.toggle('still', !!fx.alarm && reducedMotion());
    const b = Math.round((fx.blur || 0) * 10) / 10;
    if (canvas && b !== blurNow) {
      blurNow = b;
      canvas.style.filter = b > 0.05 ? `blur(${b}px) saturate(${(1 - b * 0.08).toFixed(2)})` : '';
    }
  }

  // ---------- Subtitles ----------
  function sub(line) {
    if (!line) {
      el.sub.classList.remove('on');
      return;
    }
    const name = line.name ? `<b class="ll-sub-name" style="color:${esc(line.color || '#ffd36a')}">${esc(line.name)}</b>` : '';
    el.sub.innerHTML = `<p class="ll-sub-line${line.radio ? ' radio' : ''}">${line.radio ? `<span class="ll-sub-radio">${ICONS.radio}</span>` : ''}${name}<span class="ll-sub-text">${esc(line.text)}</span></p>`;
    el.sub.classList.add('on');
  }

  // ---------- Toasts ----------
  function toast(html, o = {}) {
    const d = document.createElement('div');
    d.className = 'll-toast' + (o.kind ? ' ' + o.kind : '');
    d.innerHTML = html;
    el.toasts.appendChild(d);
    while (el.toasts.children.length > 4) el.toasts.firstElementChild.remove();
    later(o.ms || 2600, () => {
      d.classList.add('out');
      later(450, () => d.remove());
    });
  }

  // ---------- Countdown ----------
  function timer(label, left) {
    if (left == null) {
      el.timer.hidden = true;
      return;
    }
    el.timer.hidden = false;
    el.timerLabel.textContent = label || '';
    const s = Math.max(0, Math.ceil(left));
    const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (el.timerTime.textContent !== txt) el.timerTime.textContent = txt;
    el.timer.classList.toggle('low', left < 10);
  }

  // ---------- Choices (Telltale-style) ----------
  function choiceOpen(options, o = {}) {
    // options: [{ id, text, locked: bool, lockedText }]
    let focus = Math.max(0, options.findIndex((x) => !x.locked));
    const timed = !!o.timed;
    const tok = ++choiceTok;
    el.choice.innerHTML = `${timed ? '<div class="ll-choice-bar"><i></i></div>' : ''}<div class="ll-choice-row">${options
      .map(
        (x, i) => `<button type="button" class="ll-opt${x.locked ? ' locked' : ''}" data-i="${i}" ${x.locked ? 'aria-disabled="true"' : ''}>
          <span class="ll-opt-key">${device() === 'touch' ? '' : device() === 'gamepad' ? '' : `<kbd class="ll-kbd">${i + 1}</kbd>`}</span>
          <span class="ll-opt-text">${esc(x.text)}</span>
          ${x.locked ? `<span class="ll-opt-lock">${ICONS.lock}<small>${esc(x.lockedText || '')}</small></span>` : ''}
        </button>`
      )
      .join('')}</div>`;
    el.choice.hidden = false;
    el.choice.classList.remove('done');
    void el.choice.offsetWidth;
    el.choice.classList.add('in');
    const btns = [...el.choice.querySelectorAll('.ll-opt')];
    const paintFocus = () => btns.forEach((b, i) => b.classList.toggle('focus', i === focus && device() !== 'touch' && device() !== 'keyboard'));
    paintFocus();
    let picked = null;
    btns.forEach((b, i) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        if (!options[i].locked && o.onPick) o.onPick(options[i].id);
        else if (options[i].locked) {
          b.classList.remove('nope');
          void b.offsetWidth;
          b.classList.add('nope');
          sound.sfx('wrong');
        }
      })
    );
    const bar = el.choice.querySelector('.ll-choice-bar i');
    return {
      update(frac, input) {
        if (bar) bar.style.transform = `scaleX(${clamp(frac, 0, 1).toFixed(4)})`;
        if (picked != null || !input) return;
        if (input.digit && options[input.digit - 1]) {
          const x = options[input.digit - 1];
          if (!x.locked) o.onPick && o.onPick(x.id);
          else {
            sound.sfx('wrong');
            btns[input.digit - 1].classList.add('nope');
          }
          return;
        }
        const step = input.left || input.up ? -1 : input.right || input.down2 ? 1 : 0;
        if (step) {
          for (let k = 1; k <= options.length; k++) {
            const j = (focus + step * k + options.length * 3) % options.length;
            if (!options[j].locked) {
              focus = j;
              break;
            }
          }
          btns.forEach((b, i) => b.classList.toggle('focus', i === focus));
          sound.sfx('tick');
        }
        if (input.confirm && btns.some((b) => b.classList.contains('focus')) && !options[focus].locked) o.onPick && o.onPick(options[focus].id);
      },
      close(id) {
        picked = id;
        btns.forEach((b, i) => {
          b.classList.toggle('picked', options[i].id === id);
          b.classList.toggle('faded', options[i].id !== id);
        });
        el.choice.classList.add('done');
        later(reducedMotion() ? 50 : 650, () => {
          if (tok !== choiceTok) return;
          el.choice.hidden = true;
          el.choice.classList.remove('in', 'done');
          el.choice.innerHTML = '';
        });
      },
    };
  }

  // ---------- Quick-time events ----------
  const VERB = {
    press: () => t('ll.ui.qte.press', 'Press'),
    hold: () => t('ll.ui.qte.hold', 'Hold'),
    mash: () => t('ll.ui.qte.mash', 'Tap fast'),
    turn: () => t('ll.ui.qte.turn', 'Turn'),
    brace: () => t('ll.ui.qte.brace', 'Hold on'),
  };
  let qteTok = 0;
  let choiceTok = 0;
  function qteOpen(o) {
    // o: { kind, key, label }
    const kind = o.kind;
    const tok = ++qteTok;
    const C = 2 * Math.PI * 44;
    el.qte.innerHTML = `<button type="button" class="ll-qte-btn k-${esc(kind)}" aria-label="${esc((o.label || '') + ' ' + VERB[kind]())}">
        <svg viewBox="0 0 100 100" class="ll-qte-ring" aria-hidden="true">
          <circle cx="50" cy="50" r="47" class="time"/>
          <circle cx="50" cy="50" r="44" class="track"/>
          <circle cx="50" cy="50" r="44" class="fill" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${C.toFixed(1)}"/>
        </svg>
        <span class="ll-qte-key">${kind === 'turn' && device() === 'keyboard' ? `<span class="ll-qte-ad"><kbd class="ll-kbd">A</kbd><kbd class="ll-kbd">D</kbd></span>` : glyph(o.key || 'E', kind)}</span>
      </button>
      <p class="ll-qte-label">${o.label && o.label.toLowerCase().startsWith(VERB[kind]().toLowerCase()) ? '' : `<b>${esc(VERB[kind]())}</b> `}${esc(o.label || '')}</p>`;
    el.qte.hidden = false;
    el.qte.className = 'll-qte in' + (device() === 'touch' ? ' dock' : '');
    const btn = el.qte.querySelector('.ll-qte-btn');
    bindTouchButton(btn);
    const fill = el.qte.querySelector('.fill');
    const time = el.qte.querySelector('.time');
    const C2 = 2 * Math.PI * 47;
    time.style.strokeDasharray = C2.toFixed(1);
    sound.sfx('qte');
    let lastP = 0;
    return {
      update(state, pos) {
        fill.style.strokeDashoffset = (C * (1 - state.progress)).toFixed(1);
        time.style.strokeDashoffset = (C2 * (1 - (state.timeFraction != null ? state.timeFraction : 1 - (state.fraction || 0)))).toFixed(1);
        btn.classList.toggle('down', !!state.down);
        if (kind === 'turn') btn.style.setProperty('--spin', `${(state.progress * 720).toFixed(0)}deg`);
        if (kind === 'mash' && state.progress > lastP + 0.01) {
          btn.classList.remove('hit');
          void btn.offsetWidth;
          btn.classList.add('hit');
        }
        lastP = state.progress;
        if (pos && device() !== 'touch') {
          el.qte.classList.remove('dock');
          el.qte.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px)`;
        } else if (device() === 'touch') el.qte.classList.add('dock');
        else el.qte.style.transform = '';
      },
      close(ok) {
        if (tok !== qteTok) return;
        el.qte.classList.add(ok ? 'ok' : 'miss');
        later(reducedMotion() ? 60 : 520, () => {
          if (tok !== qteTok) return; // the next one is already up
          el.qte.hidden = true;
          el.qte.className = 'll-qte';
          el.qte.innerHTML = '';
        });
      },
    };
  }

  // ---------- The bench (crafting) ----------
  function craftOpen(o) {
    // o: { name, steps, progress, inventory (Map), itemName(id), onPick(id), onLeave() }
    let focus = 0;
    let invIds = [];
    function paint(flashWrong) {
      const { steps, progress, inventory } = o;
      const next = steps[progress];
      invIds = [...inventory.keys()].filter((id) => inventory.get(id) > 0);
      const nextName = next ? o.itemName(next) : '';
      const have = next && inventory.get(next) > 0;
      el.craft.innerHTML = `<div class="ll-craft-head"><p class="ll-craft-name">${esc(o.name)}</p>
          <ol class="ll-craft-steps">${steps
            .map((id, i) => `<li class="${i < progress ? 'done' : i === progress ? 'next' : ''}" title="${esc(o.itemName(id))}">${iconFor(id, items)}</li>`)
            .join('')}</ol>
          <p class="ll-craft-hint${have ? '' : ' missing'}">${
            next
              ? have
                ? esc(t('ll.ui.craft.next', 'Next: {item}', { item: nextName }))
                : esc(t('ll.ui.craft.missing', 'Missing: {item}. Search the lockers.', { item: nextName }))
              : ''
          }</p></div>
        <div class="ll-craft-inv" role="list">${
          invIds.length
            ? invIds
                .map(
                  (id, i) => `<button type="button" role="listitem" class="ll-inv-item${i === focus ? ' focus' : ''}" data-id="${esc(id)}" aria-label="${esc(o.itemName(id))}">
                ${iconFor(id, items)}<span class="ll-inv-name">${esc(o.itemName(id))}</span>${inventory.get(id) > 1 ? `<b class="ll-inv-n num">${inventory.get(id)}</b>` : ''}${i < 9 && device() === 'keyboard' ? `<kbd class="ll-kbd mini">${i + 1}</kbd>` : ''}
              </button>`
                )
                .join('')
            : `<p class="ll-craft-empty">${esc(t('ll.ui.craft.empty', 'Nothing to use yet.'))}</p>`
        }</div>
        <button type="button" class="ll-craft-leave">${device() === 'gamepad' ? '<span class="ll-pad ll-pad-b">B</span>' : device() === 'keyboard' ? '<kbd class="ll-kbd">Q</kbd>' : ''}<span>${esc(t('ll.ui.craft.leave', 'Step away'))}</span></button>`;
      el.craft.querySelectorAll('.ll-inv-item').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.preventDefault();
          o.onPick(b.dataset.id);
        })
      );
      el.craft.querySelector('.ll-craft-leave').addEventListener('click', (e) => {
        e.preventDefault();
        o.onLeave();
      });
      if (flashWrong) {
        el.craft.classList.remove('wrong');
        void el.craft.offsetWidth;
        el.craft.classList.add('wrong');
      }
    }
    paint();
    el.craft.hidden = false;
    el.craft.classList.add('in');
    return {
      refresh(flashWrong) {
        focus = Math.min(focus, Math.max(0, invIds.length - 1));
        paint(flashWrong);
      },
      placed() {
        const li = el.craft.querySelector('.ll-craft-steps li.done:last-of-type, .ll-craft-steps li.next');
        if (li) li.classList.add('pop');
      },
      update(input) {
        if (!input) return;
        if (input.back) return o.onLeave();
        if (input.left || input.up) {
          focus = (focus - 1 + invIds.length) % Math.max(1, invIds.length);
          paint();
        } else if (input.right || input.down2) {
          focus = (focus + 1) % Math.max(1, invIds.length);
          paint();
        } else if (input.confirm && invIds[focus]) o.onPick(invIds[focus]);
      },
      pickDigit(n) {
        if (invIds[n - 1]) o.onPick(invIds[n - 1]);
      },
      close() {
        el.craft.classList.remove('in');
        el.craft.hidden = true;
        el.craft.innerHTML = '';
      },
    };
  }
  // ---------- Menus: pause and the chapter end card ----------
  function menu(html, onClick) {
    if (!html) {
      el.menu.hidden = true;
      el.menu.innerHTML = '';
      el.menu.removeAttribute('aria-modal');
      el.menu.removeAttribute('role');
      return;
    }
    el.menu.innerHTML = html;
    el.menu.hidden = false;
    el.menu.setAttribute('role', 'dialog');
    el.menu.setAttribute('aria-modal', 'true');
    el.menu.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        onClick(b.dataset.act, b);
      })
    );
    const first = el.menu.querySelector('[data-act]');
    if (first) first.focus({ preventScroll: true });
  }

  return {
    el,
    readInput,
    fade,
    fadeMessage,
    get fadeK() {
      return fadeK;
    },
    title,
    letterbox,
    objective,
    hint,
    waypoint,
    dots,
    setMeters,
    meters,
    effects,
    sub,
    toast,
    timer,
    choiceOpen,
    qteOpen,
    craftOpen,
    menu,
    later,
    dispose() {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mouseup', onMouseUp, true);
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('blur', onBlur);
    },
  };
}
