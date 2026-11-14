// KILO, the mission guide (docs/TEAM-V2.md "KILO, the guide" and "As built
// (guide & crew)"). An original little floating robot: a white rounded box
// with one dark screen for a face (pixel eyes), two slim folding side panels
// and a soft glow underneath. It appears in a corner with a short speech
// bubble, types its line, and waits for a click or Space. Can be muted.
//
//   SMD.team.guide.say(target, lines, opts) -> { next, close, done, el }
//   SMD.team.guide.scriptFor(missionId, momentId, params) -> [{ id, text, mood }]
//   SMD.team.guide.portrait(mood, opts) -> SVG string; drawFace(ctx2d, mood, w, h, talking)
//
// Pure parts (scriptFor, verdict, faces) work in node; say() needs a DOM.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};
  const fill = (s, p) => (p ? String(s).replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? p[k] : m)) : String(s));
  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : fill(e, p));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const reduced = () => {
    try {
      return !!(SMD.settings && SMD.settings.reducedMotion) || (globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  };

  // ---------- The face: pixel art on a 16 x 8 grid (eyes 5 rows, mouth 3) ----------
  const EYES = {
    neutral: ['................', '...##......##...', '...##......##...', '...##......##...', '................'],
    deadpan: ['................', '................', '..####....####..', '...##......##...', '................'],
    happy: ['................', '..##........##..', '.#..#......#..#.', '................', '................'],
    proud: ['..............#.', '..##........###.', '.#..#......#..#.', '................', '................'],
    thinking: ['...........##...', '...##......##...', '...##...........', '...##...........', '................'],
    worried: ['....#......#....', '...##......##...', '...##......##...', '................', '................'],
    sad: ['................', '................', '...###....###...', '..#..........#..', '................'],
    surprised: ['..###......###..', '..#.#......#.#..', '..###......###..', '................', '................'],
    wink: ['................', '...##...........', '...##.....####..', '...##...........', '................'],
  };
  const MOUTHS = {
    neutral: ['................', '......####......', '................'],
    deadpan: ['................', '.....######.....', '................'],
    happy: ['.....#....#.....', '......####......', '................'],
    proud: ['....#......#....', '.....######.....', '................'],
    thinking: ['................', '.........###....', '................'],
    worried: ['................', '......####......', '.....#....#.....'],
    sad: ['................', '......####......', '.....#....#.....'],
    surprised: ['................', '.......##.......', '.......##.......'],
    wink: ['.....#....#.....', '......####......', '................'],
  };
  const TALK = ['.....######.....', '.....#....#.....', '......####......'];
  const MOODS = Object.keys(EYES);
  const moodOf = (m) => (EYES[m] ? m : 'neutral');
  // The face as rows of '#' and '.', 16 wide and 8 tall.
  function faceRows(mood, talking) {
    const m = moodOf(mood);
    return EYES[m].concat(talking ? TALK : MOUTHS[m]);
  }
  const GLOW = '#9ff3dc';

  // ---------- 2D portrait (SVG) ----------
  // Panel angles per mood: [inner strut, outer panel] in degrees (positive = droop).
  const ARMS = {
    neutral: [0, 0],
    deadpan: [6, 4],
    happy: [-12, -14],
    proud: [-18, -20],
    thinking: [0, 0, -16, -22],
    worried: [10, 14],
    sad: [16, 18],
    surprised: [-24, -10],
    wink: [-8, -10, 0, 0],
  };
  let uid = 0;
  function arm(id, a1, a2) {
    // Hinge at the body side (30,52); a short strut, a joint, then the panel.
    return `<g transform="rotate(${a1} 30 53)"><rect x="21" y="51.3" width="10" height="3.4" rx="1.4" fill="#aab4c6"/><g transform="rotate(${a2} 21 53)"><circle cx="21" cy="53" r="2.7" fill="#d9dfe9" stroke="#8d98ad" stroke-width="0.8"/><rect x="5" y="37" width="14" height="32" rx="2.6" fill="url(#${id}p)" stroke="#d6dde8" stroke-width="1.3"/><path d="M5.6 45h12.8M5.6 53h12.8M5.6 61h12.8M12 37.6v30.8" stroke="#6f9bd6" stroke-opacity="0.55" stroke-width="0.7"/></g></g>`;
  }
  function portrait(mood, opts = {}) {
    const m = moodOf(mood);
    const size = opts.size || 96;
    const id = `kf${++uid}`;
    const rows = faceRows(m, !!opts.talking);
    const cell = 3.4;
    const ox = 70 - 8 * cell;
    const oy = 51 - 4 * cell;
    let px = '';
    rows.forEach((r, y) => {
      for (let x = 0; x < 16; x++) if (r[x] === '#') px += `<rect x="${(ox + x * cell + 0.25).toFixed(2)}" y="${(oy + y * cell + 0.25).toFixed(2)}" width="2.9" height="2.9" rx="0.6"/>`;
    });
    const A = ARMS[m];
    const left = arm(id, A[0], A[1]);
    const right = arm(id, A.length > 2 ? A[2] : A[0], A.length > 2 ? A[3] : A[1]);
    return `<svg class="tf-kilo-svg" viewBox="0 0 140 112" width="${size}" height="${Math.round(size * 0.8)}" role="img" aria-label="KILO" data-mood="${m}">
      <defs>
        <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f9fd"/><stop offset="0.7" stop-color="#dfe5ef"/><stop offset="1" stop-color="#bcc6d6"/></linearGradient>
        <linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d4f8e"/><stop offset="1" stop-color="#172c58"/></linearGradient>
        <radialGradient id="${id}g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${GLOW}" stop-opacity="0.55"/><stop offset="1" stop-color="${GLOW}" stop-opacity="0"/></radialGradient>
        <radialGradient id="${id}s" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="#14274a"/><stop offset="1" stop-color="#0a1428"/></radialGradient>
      </defs>
      <ellipse class="tf-kilo-glow" cx="70" cy="101" rx="34" ry="7" fill="url(#${id}g)"/>
      ${left}
      <g transform="translate(140 0) scale(-1 1)">${right}</g>
      <rect x="30" y="20" width="80" height="66" rx="19" fill="url(#${id}b)"/>
      <path d="M36 80 Q70 90 104 80" stroke="#aeb8c9" stroke-width="1.2" fill="none" opacity="0.7"/>
      <rect x="64" y="14" width="12" height="5" rx="2.5" fill="#d0d7e3"/>
      <circle cx="70" cy="16.5" r="1.6" fill="${GLOW}"/>
      <rect x="37.5" y="28" width="65" height="47" rx="11" fill="url(#${id}s)" stroke="#8792a8" stroke-width="1.4"/>
      <path d="M42 33 Q48 30 58 30.5" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <g fill="${GLOW}">${px}</g>
    </svg>`;
  }

  // The same face on a canvas (the 3D model's screen uses this).
  function drawFace(c, mood, w, h, talking) {
    c.fillStyle = '#0a1428';
    c.fillRect(0, 0, w, h);
    const rows = faceRows(mood, talking);
    const cell = Math.min(w / 18, h / 10);
    const ox = (w - 16 * cell) / 2;
    const oy = (h - 8 * cell) / 2;
    c.fillStyle = GLOW;
    c.shadowColor = GLOW;
    c.shadowBlur = cell * 0.6;
    rows.forEach((r, y) => {
      for (let x = 0; x < 16; x++) if (r[x] === '#') c.fillRect(ox + x * cell + cell * 0.08, oy + y * cell + cell * 0.08, cell * 0.84, cell * 0.84);
    });
    c.shadowBlur = 0;
  }

  // ---------- Scripts ----------
  const lines = () => SMD.team.guideLines || { any: {} };
  function resolveMoment(moment) {
    const m = String(moment || '');
    const L = lines();
    if (m.startsWith('step.')) {
      const k = m.slice(5);
      const key = (L.ALIAS && L.ALIAS[k]) || k;
      return 'step.' + key;
    }
    return m;
  }
  function scriptFor(missionId, momentId, params) {
    const L = lines();
    const moment = resolveMoment(momentId);
    const mission = L[missionId] && missionId !== 'ALIAS' ? missionId : null;
    let where = mission && L[mission][moment] ? mission : L.any && L.any[moment] ? 'any' : null;
    let src = where ? L[where][moment] : null;
    if (!src && moment.startsWith('step.')) {
      where = 'any';
      src = L.any['step.other'];
      return (src || []).map(([mood, text], i) => ({ id: `guide.any.step.other.${i}`, mood, text: t(`guide.any.step.other.${i}`, text, params) }));
    }
    if (!src) return [];
    return src.map(([mood, text], i) => ({ id: `guide.${where}.${moment}.${i}`, mood, text: t(`guide.${where}.${moment}.${i}`, text, params) }));
  }

  // The results in one line.
  function verdictKind(debrief) {
    const d = debrief || {};
    const r = d.result || {};
    const s = d.surface || null;
    if (s && (s.crewAlive === false || ['stranded', 'wiped', 'hull_lost'].includes(s.outcome))) return 'crew';
    if (r.alive === false) return 'lost';
    if (s && s.outcome === 'extracted') return s.won ? 'full' : 'partial';
    if (r.success === 'full') return 'full';
    if (r.success === 'partial') return 'partial';
    return 'none';
  }
  function verdict(missionId, debrief) {
    const kind = verdictKind(debrief);
    const line = scriptFor(missionId, `results.${kind}`)[0] || { text: '', mood: 'neutral' };
    return { kind, text: line.text, mood: line.mood, id: line.id };
  }

  // ---------- Mute ----------
  const MUTE_KEY = 'ek-kilo-muted';
  function muted() {
    try {
      return (globalThis.localStorage && localStorage.getItem(MUTE_KEY)) === '1';
    } catch (e) {
      return false;
    }
  }
  function setMuted(on) {
    try {
      localStorage.setItem(MUTE_KEY, on ? '1' : '0');
    } catch (e) {}
    if (current) current.refreshMute();
  }

  // ---------- say() ----------
  let current = null;
  function normalize(input, opts) {
    if (!input) return [];
    if (typeof input === 'string') return [{ text: input, mood: opts.mood || 'neutral' }];
    if (!Array.isArray(input) && input.moment) return scriptFor(input.mission, input.moment, input.params);
    if (!Array.isArray(input)) return [];
    return input.filter(Boolean).map((l) => (typeof l === 'string' ? { text: l, mood: opts.mood || 'neutral' } : { text: String(l.text || ''), mood: l.mood || opts.mood || 'neutral', id: l.id }));
  }
  const isField = (el) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

  function say(target, input, opts = {}) {
    if (typeof document === 'undefined') return { next() {}, close() {}, done: Promise.resolve(), el: null };
    const list = normalize(input, opts);
    if (current) current.destroy();
    const host = target && target.nodeType === 1 ? target : document.body;
    const corner = /start/.test(opts.corner || '') ? 'start' : 'end';
    const top = /top/.test(opts.corner || '');
    const el = document.createElement('div');
    el.className = `tf-kilo tf-kilo-${corner}${top ? ' tf-kilo-top' : ''}${opts.inline ? ' tf-kilo-inline' : ''}`;
    el.innerHTML = `<button type="button" class="tf-kilo-bot" data-bot></button>
      <div class="tf-kilo-bubble" data-bubble role="status" aria-live="polite">
        <p class="tf-kilo-text" data-text></p>
        <div class="tf-kilo-foot"><span class="tf-kilo-count" data-count></span><button type="button" class="tf-kilo-mute" data-mute>${esc(t('guide.mute', 'Mute KILO'))}</button><span class="tf-kilo-next" data-next></span></div>
      </div>`;
    host.appendChild(el);
    const bot = el.querySelector('[data-bot]');
    const bubble = el.querySelector('[data-bubble]');
    const textEl = el.querySelector('[data-text]');
    const countEl = el.querySelector('[data-count]');
    const nextEl = el.querySelector('[data-next]');
    const muteBtn = el.querySelector('[data-mute]');
    const RM = reduced();
    const auto = !!opts.auto;
    const keep = opts.keep !== false;

    let i = -1;
    let typed = 0;
    let typing = 0;
    let talkTick = 0;
    let readTimer = 0;
    let dead = false;
    let resolveDone;
    const done = new Promise((r) => (resolveDone = r));
    let state = 'talk';
    let mood = 'neutral';
    let talkOpen = false;

    function drawBot() {
      bot.innerHTML = portrait(mood, { size: opts.size || (globalThis.innerWidth < 600 ? 84 : 124), talking: talkOpen });
      bot.setAttribute('aria-label', state === 'talk' ? 'KILO' : muted() ? t('guide.unmute', 'KILO is muted. Click to hear KILO again.') : t('guide.replay', 'KILO: click to hear that again'));
    }
    function stopTyping() {
      clearInterval(typing);
      typing = 0;
      if (talkOpen) {
        talkOpen = false;
        drawBot();
      }
    }
    function blip(n) {
      if (n % 4 !== 0 || RM) return;
      try {
        if (SMD.audio && SMD.audio.beep) SMD.audio.beep(1180 + (n % 3) * 90, 0.02, 'sine', 0.02);
      } catch (e) {}
    }
    function show(n) {
      i = n;
      const line = list[i];
      mood = line.mood || 'neutral';
      el.dataset.mood = mood;
      textEl.textContent = '';
      typed = 0;
      countEl.textContent = list.length > 1 ? `${i + 1}/${list.length}` : '';
      nextEl.textContent = auto ? '' : i < list.length - 1 ? t('guide.next', 'Next') : t('guide.gotit', 'Got it');
      clearTimeout(readTimer);
      stopTyping();
      if (typeof opts.onLine === 'function') {
        try {
          opts.onLine(i, line);
        } catch (e) {}
      }
      const full = line.text;
      if (RM) {
        textEl.textContent = full;
        typed = full.length;
        afterTyped();
        drawBot();
        return;
      }
      talkOpen = true;
      drawBot();
      typing = setInterval(() => {
        if (dead) return stopTyping();
        typed = Math.min(full.length, typed + 1);
        textEl.textContent = full.slice(0, typed);
        blip(typed);
        if (++talkTick % 4 === 0) {
          talkOpen = !talkOpen;
          drawBot();
        }
        if (typed >= full.length) {
          stopTyping();
          afterTyped();
        }
      }, 26);
    }
    function afterTyped() {
      if (!auto) return;
      const len = (list[i] && list[i].text.length) || 0;
      readTimer = setTimeout(next, clamp(1600 + len * 45, 2600, 7000));
    }
    function next() {
      if (dead || state !== 'talk') return;
      const line = list[i];
      if (typing && line) {
        // First press finishes the line.
        stopTyping();
        textEl.textContent = line.text;
        typed = line.text.length;
        afterTyped();
        return;
      }
      if (i < list.length - 1) return show(i + 1);
      finish();
    }
    function finish() {
      if (state !== 'talk') return;
      clearTimeout(readTimer);
      stopTyping();
      resolveDone();
      if (typeof opts.onDone === 'function') {
        try {
          opts.onDone();
        } catch (e) {}
      }
      if (keep && list.length) fold();
      else destroy();
    }
    function fold() {
      state = 'fold';
      el.classList.add('tf-kilo-folded');
      el.classList.toggle('tf-kilo-muted', muted());
      bubble.hidden = true;
      drawBot();
    }
    function open() {
      state = 'talk';
      el.classList.remove('tf-kilo-folded', 'tf-kilo-muted');
      bubble.hidden = false;
      show(0);
    }
    function destroy() {
      if (dead) return;
      dead = true;
      clearTimeout(readTimer);
      stopTyping();
      document.removeEventListener('keydown', onKey, true);
      el.remove();
      resolveDone();
      if (current === handle) current = null;
    }
    function onKey(e) {
      if (!el.isConnected) return destroy();
      if (state !== 'talk' || auto || opts.space === false) return;
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (isField(document.activeElement)) return;
      e.preventDefault();
      e.stopPropagation();
      next();
    }
    bubble.addEventListener('click', (e) => {
      if (e.target.closest('[data-mute]')) return;
      next();
    });
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMuted(true); // refreshMute() folds this KILO
    });
    bot.addEventListener('click', () => {
      if (state === 'talk') return next();
      if (muted()) setMuted(false);
      if (list.length) open();
    });
    document.addEventListener('keydown', onKey, true);

    const handle = {
      el,
      done,
      next,
      close: destroy,
      destroy,
      refreshMute() {
        if (dead) return;
        if (muted() && state === 'talk') finish();
        else el.classList.toggle('tf-kilo-muted', muted() && state !== 'talk');
        drawBot();
      },
    };
    current = handle;
    if (!list.length) {
      destroy();
      return handle;
    }
    if (muted()) {
      // Muted: only the small dim face stays, so KILO can be switched back on.
      mood = list[0].mood || 'neutral';
      fold();
      resolveDone();
    } else {
      bubble.hidden = false;
      show(0);
    }
    return handle;
  }

  function sayMoment(target, missionId, momentId, opts = {}) {
    return say(target, scriptFor(missionId, momentId, opts.params), opts);
  }
  function clear() {
    if (current) current.destroy();
  }

  SMD.team.guide = { say, sayMoment, scriptFor, verdict, verdictKind, muted, setMuted, clear, portrait, drawFace, faceRows, MOODS, GLOW };
})();
