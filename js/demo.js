// Demo mode: an automatic showcase of the game for screen recording.
//
//   index.html#demo     the full showcase (about two minutes): the title, the
//                       crew, the destination, KILO's briefing, the build one
//                       part at a time, the questions, the review, the cabin,
//                       the flight with a crisis, the landing, the surface, the
//                       ascent decision and the results with the consequence chain.
//   index.html#demo-30  the 30-second cut for the Space Apps video, with the
//                       official "30 seconds of glory" beats and English
//                       subtitles burned in.
//   index.html#demo-raw the full showcase with no subtitles or cards (B-roll).
//
// Optional query string: ?team=Name&members=A,%20B&link=example.org
// &autostart=1 (start without the click; sound needs the click) &view=tpp
// (the surface over the shoulder instead of the top-down crew view).
// Esc stops the demo. SMD.demo.run({ cut, captions, team, members, link })
// starts it from code and returns a promise that resolves at the end.
//
// It plays the real game: a solo session (SMD.team.net.createLocal) mounted on
// the real team screen, steered with the room's own actions (setup, setRole,
// build, pick, vote, next, crisisAct, ascentDrop), the same actions the
// buttons send. The gold ring only shows where a player would tap. On the
// surface it steers astronaut P1 with controller input and skips ahead by
// stepping the surface simulation (SMD.team.surface.step), so the cut can
// jump from the first scan to the ascent decision.
//
// It never touches the player's saves: while it runs, localStorage and
// sessionStorage writes go to an in-memory layer that is thrown away at the
// end, so preferences, leaderboards and checkpoints the game writes stay out
// of real storage.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : String(e).replace(/\{(\w+)\}/g, (m, x) => (p && p[x] !== undefined ? p[x] : m)));
  const esc = (s) => (SMD.ui && SMD.ui.esc ? SMD.ui.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- The mission it flies ----------
  // Mars on Cadet, seed 42: checked with the simulation (docs/submission/demo-video.md).
  // The flight stays alive even with every crisis missed, and the crew lands,
  // scans, throws samples overboard at the door and gets home.
  const MISSION = {
    seed: 42,
    difficulty: 'cadet',
    startScenario: 'moon', // the destination screen opens on the Moon; the demo picks Mars
    scenario: 'mars',
    crewJob: 'planner', // solo: your astronaut on the surface is the planner (P1)
    requirement: 'ice',
    build: [
      ['orbit', 'polar300'],
      ['power', 'p14'],
      ['instruments', '+sounder'],
      ['instruments', '+hires'],
      ['radio', 'big'],
      ['landing', 'balanced'],
      ['rocket', '*'], // the cheapest rocket that lifts it
    ],
    // The flight's 70 s of simulation squeezed into 26 s (the room's own timing option).
    flightMs: 26000,
    cabinMs: 28000,
  };
  const ORDER = ['lobby', 'brief', 'design', 'questions', 'lock', 'cabin', 'flight', 'landing', 'surface', 'ascent', 'debrief'];

  // ---------- Overlay (subtitles, cards, the tap ring) ----------
  const CSS = `
html.demo-on, html.demo-on * { cursor: none !important; }
html.demo-ready, html.demo-ready * { cursor: auto !important; }
.demo-layer { position: fixed; inset: 0; z-index: 9000; pointer-events: none; font-family: var(--font, system-ui, sans-serif); }
.demo-sub { position: absolute; inset-inline: 16px; inset-block-end: clamp(70px, 10vh, 120px); display: flex; justify-content: center; opacity: 0; transform: translateY(8px); transition: opacity .3s ease, transform .4s cubic-bezier(.2,.8,.2,1); }
.demo-sub.show { opacity: 1; transform: none; }
.demo-sub.top { inset-block-end: auto; inset-block-start: clamp(130px, 17vh, 190px); }
.demo-sub p { margin: 0; inline-size: fit-content; max-inline-size: min(52ch, 100%); padding: .3em .75em .36em; border-radius: 8px; background: rgba(8, 13, 24, .88); color: #fff; font-size: clamp(16px, 1.75vw, 30px); font-weight: 600; line-height: 1.3; text-align: center; letter-spacing: .005em; box-shadow: 0 6px 30px rgba(0,0,0,.35); }
.demo-card { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px 16px; background: radial-gradient(120% 90% at 30% 20%, #1c2a52 0%, #111a38 55%, #080d1f 100%); color: #eef1fa; opacity: 0; transition: opacity .35s ease; }
.demo-card.show { opacity: 1; }
.demo-card-in { inline-size: min(1100px, 100%); display: grid; gap: clamp(10px, 2vh, 22px); text-align: start; }
.demo-card .demo-kick { margin: 0; color: #f2c57c; font-size: clamp(14px, 1.5vw, 24px); font-weight: 700; letter-spacing: .02em; }
.demo-card .demo-big { margin: 0; font-size: clamp(44px, 8.4vw, 150px); font-stretch: 68%; font-weight: 850; line-height: .93; letter-spacing: -.01em; }
.demo-card .demo-mid { margin: 0; font-size: clamp(26px, 4.2vw, 68px); font-stretch: 75%; font-weight: 800; line-height: 1.04; }
.demo-card .demo-small { margin: 0; max-inline-size: 46ch; color: #b4bedb; font-size: clamp(16px, 1.7vw, 28px); line-height: 1.35; }
.demo-card .demo-rule { block-size: 4px; inline-size: clamp(60px, 9vw, 140px); background: #f2c57c; border-radius: 2px; }
.demo-card .demo-row { display: flex; flex-wrap: wrap; gap: 10px 26px; color: #b4bedb; font-size: clamp(14px, 1.4vw, 22px); }
.demo-card .demo-row b { color: #eef1fa; font-weight: 700; }
.demo-card .demo-face { inline-size: clamp(72px, 8vw, 128px); }
.demo-card .demo-face svg { inline-size: 100%; block-size: auto; display: block; }
.demo-tap { position: absolute; inset-block-start: 0; inset-inline-start: 0; inline-size: 34px; block-size: 34px; margin: -17px 0 0 -17px; border-radius: 50%; border: 3px solid #f2c57c; background: rgba(242,197,124,.18); box-shadow: 0 0 0 2px rgba(10,16,34,.55); opacity: 0; transition: transform .45s cubic-bezier(.3,.7,.2,1), opacity .25s ease; }
[dir='rtl'] .demo-tap { inset-inline-start: auto; inset-inline-end: 0; }
.demo-tap.show { opacity: 1; }
.demo-tap.hit::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 3px solid #f2c57c; animation: demo-ring .55s ease-out forwards; }
@keyframes demo-ring { to { transform: scale(2.3); opacity: 0; } }
.demo-ready-card { position: absolute; inset-block-end: 24px; inset-inline: 16px; display: flex; justify-content: center; pointer-events: auto; }
.demo-ready-card div { display: grid; gap: 6px; max-inline-size: 560px; padding: 16px 20px; border-radius: 12px; background: rgba(8,13,24,.94); color: #eef1fa; border: 1px solid #2a3a66; box-shadow: 0 10px 40px rgba(0,0,0,.4); }
.demo-ready-card b { font-size: 20px; }
.demo-ready-card span { color: #b4bedb; font-size: 15px; line-height: 1.4; }
@media (prefers-reduced-motion: reduce) { .demo-sub, .demo-card, .demo-tap { transition: none; } .demo-tap.hit::after { animation: none; } }
`;

  let layer = null;
  function overlay() {
    if (layer && layer.isConnected) return layer;
    if (!document.getElementById('demo-style')) {
      const st = document.createElement('style');
      st.id = 'demo-style';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    layer = document.createElement('div');
    layer.className = 'demo-layer';
    layer.setAttribute('aria-live', 'polite');
    layer.innerHTML = '<div class="demo-card" data-dcard aria-hidden="true"></div><div class="demo-sub" data-dsub><p></p></div><div class="demo-tap" data-dtap aria-hidden="true"></div>';
    document.body.appendChild(layer);
    return layer;
  }

  // ---------- Storage shield: the player's saves are never written ----------
  // Every Storage write goes to an in-memory layer; reads see that layer first.
  let shield = null;
  function shieldStorage(seed) {
    if (shield) return shield;
    const P = typeof Storage !== 'undefined' && Storage.prototype;
    if (!P) return (shield = { release() {}, set() {} });
    const orig = { getItem: P.getItem, setItem: P.setItem, removeItem: P.removeItem, clear: P.clear, key: P.key };
    const layers = new WeakMap();
    const layerOf = (st) => {
      let m = layers.get(st);
      if (!m) layers.set(st, (m = new Map()));
      return m;
    };
    P.getItem = function (k) {
      const m = layerOf(this);
      k = String(k);
      return m.has(k) ? m.get(k) : orig.getItem.call(this, k);
    };
    P.setItem = function (k, v) {
      layerOf(this).set(String(k), String(v));
    };
    P.removeItem = function (k) {
      layerOf(this).set(String(k), null);
    };
    P.clear = function () {
      const m = layerOf(this);
      m.clear();
      for (let i = 0; i < this.length; i++) m.set(orig.key.call(this, i), null);
    };
    shield = {
      set(k, v) {
        try {
          layerOf(localStorage).set(k, v);
        } catch (e) {}
      },
      release() {
        Object.assign(P, orig);
        shield = null;
      },
    };
    Object.entries(seed || {}).forEach(([k, v]) => shield.set(k, v));
    return shield;
  }

  // ---------- Runner ----------
  let run = null; // the live run: clock, tasks, options and what to restore
  let runId = 0;

  // The demo runs on its own clock, driven by animation frames. In the full
  // showcase a long frame (a 3D scene being built) counts as at most 100 ms,
  // so every beat stays on screen for its full time even on a slow machine;
  // the 30-second cut keeps to the wall clock. On a normal machine both keep
  // pace with the wall clock. Steps scheduled inside a beat are
  // dropped once the next beat has started, so beats never bleed together.
  function later(fn, ms, global) {
    const r = run;
    if (!r) return null;
    const task = { at: r.clock + Math.max(0, ms || 0), fn, beat: r.beat, global: !!global, seq: ++r.seq };
    r.tasks.push(task);
    return task;
  }

  function tick(r, now) {
    if (run !== r) return;
    const dt = Math.min(r.maxStep, Math.max(0, now - r.last));
    r.last = now;
    if (r.started) r.clock += dt;
    for (;;) {
      if (run !== r || !r.tasks.length) break;
      r.tasks.sort((a, b) => a.at - b.at || a.seq - b.seq);
      if (r.tasks[0].at > r.clock) break;
      const k = r.tasks.shift();
      if (!k.global && k.beat !== r.beat) continue;
      try {
        k.fn();
      } catch (e) {
        console.warn('demo step failed', e);
      }
    }
    if (run === r) r.raf = requestAnimationFrame((n) => tick(r, n));
  }

  // pos 'top' puts the subtitle under the mission bar, clear of the game's own
  // bottom panels (the flight's graphs, the cabin's lines, the results).
  function sub(text, pos) {
    if (!run || !run.opts.captions) return;
    const el = overlay().querySelector('[data-dsub]');
    const p = el.querySelector('p');
    if (!text) {
      el.classList.remove('show');
      return;
    }
    const swap = () => {
      p.textContent = text;
      el.classList.toggle('top', pos === 'top');
      el.classList.add('show');
    };
    if (el.classList.contains('show') && (p.textContent !== text || el.classList.contains('top') !== (pos === 'top'))) {
      el.classList.remove('show');
      later(swap, 180, true);
    } else swap();
  }

  function card(html) {
    hideTap();
    if (!run || !run.opts.captions) return;
    const el = overlay().querySelector('[data-dcard]');
    if (!html) {
      el.classList.remove('show');
      return;
    }
    el.innerHTML = `<div class="demo-card-in">${html}</div>`;
    void el.offsetWidth;
    el.classList.add('show');
  }

  // Move the gold ring to an element a player would tap, then run `act`
  // (a room action) when it arrives. The ring is only decoration: when the
  // element is missing (the screen changed), the action still happens.
  function tap(sel, act, opts = {}) {
    if (!run) return;
    const travel = opts.travel || 380;
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    const dot = overlay().querySelector('[data-dtap]');
    if (el) {
      try {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      } catch (e) {}
      later(() => {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        const x = SMD.dir && SMD.dir() === 'rtl' ? -(window.innerWidth - (r.left + r.width / 2)) : r.left + r.width / 2;
        dot.style.transform = `translate(${Math.round(x)}px, ${Math.round(r.top + r.height / 2)}px)`;
        dot.classList.add('show');
      }, 60);
    }
    later(() => {
      if (el) {
        dot.classList.remove('hit');
        void dot.offsetWidth;
        dot.classList.add('hit');
      }
      if (act) act();
    }, 60 + travel);
    later(hideTap, 60 + travel + 650);
  }
  const hideTap = () => {
    if (layer) layer.querySelector('[data-dtap]').classList.remove('show');
  };

  // Wait for something to be there (a view, a 3D scene), then run fn.
  function when(test, fn, tries = 80) {
    let v = null;
    try {
      v = test();
    } catch (e) {}
    if (v) return fn(v);
    if (tries > 0) later(() => when(test, fn, tries - 1), 100);
  }

  // Screens: the demo decides where the page goes while it runs.
  function show(screen, params) {
    if (!run) return;
    hideTap();
    run.internal = true;
    try {
      run.realGo(screen, params);
    } catch (e) {
      console.warn('demo: screen failed', screen, e);
    }
    run.internal = false;
  }

  // ---------- The room ----------
  const ses = () => run && run.session;
  const state = () => (ses() && ses().state) || {};
  const phase = () => state().phase || null;
  function act(a) {
    const s = ses();
    if (!s) return false;
    try {
      return s.send(a) !== false;
    } catch (e) {
      console.warn('demo: action failed', a && a.type, e);
      return false;
    }
  }
  const sim = () => SMD.team && SMD.team.sim;
  function buildSteps() {
    const s = state();
    try {
      return sim().buildSteps(s.scenarioId, s.difficulty) || [];
    } catch (e) {
      return [];
    }
  }
  function goStep(id) {
    const i = buildSteps().findIndex((x) => x.id === id);
    if (i >= 0 && state().buildStep !== i) act({ type: 'stepTo', index: i });
    return i >= 0;
  }
  function choiceOf(stepId) {
    const st = buildSteps().find((x) => x.id === stepId);
    if (!st) return null;
    try {
      return sim().stepChoice(state().design, st);
    } catch (e) {
      return null;
    }
  }
  // Resolve a build entry to the option id to send, or null when it is already set.
  function optionFor(stepId, want) {
    if (want === '*') {
      try {
        const cards = sim().stepCards(state().design, stepId) || [];
        const c = cards.find((x) => x.flies !== false) || cards[0];
        return c && !c.on ? c.id : null;
      } catch (e) {
        return null;
      }
    }
    const cur = choiceOf(stepId);
    if (want[0] === '+') {
      const id = want.slice(1);
      return Array.isArray(cur) && cur.includes(id) ? null : id;
    }
    return cur === want ? null : want;
  }
  function build(stepId, want, opts = {}) {
    const go = () => {
      if (phase() !== 'design') return;
      // The room builds any step by id; the beat itself decides which step is on screen.
      const id = optionFor(stepId, want);
      if (id) act({ type: 'build', step: stepId, option: id });
    };
    if (opts.quiet) return go();
    const id = optionFor(stepId, want) || (want === '*' ? null : want.replace(/^\+/, ''));
    tap(id ? `[data-opt="${id}"]` : null, go, opts);
  }
  // Moves the room forward until it reaches `target`, whatever it is doing now.
  // Each beat calls this, so a step that did not happen (a changed screen, a
  // rejected action) cannot strand the demo.
  function advanceTo(target) {
    const want = ORDER.indexOf(target);
    const where = () => {
      const s = state();
      return `${s.phase}|${s.setupStep}|${s.buildStep}`;
    };
    for (let guard = 0; guard < 24; guard++) {
      const s = state();
      const before = where();
      const at = ORDER.indexOf(s.phase);
      if (at < 0 || at >= want) return s.phase === target;
      if (s.phase === 'lobby') act({ type: 'forward' });
      else if (s.phase === 'design') {
        const n = buildSteps().length;
        if (state().buildStep < n - 1) act({ type: 'stepTo', index: n - 1 });
        act({ type: 'forward' });
      } else if (s.phase === 'brief' || s.phase === 'questions') act({ type: 'forward' });
      else if (s.phase === 'lock') {
        act({ type: 'vote', yes: true });
        if (state().phase === 'lock') act({ type: 'next' });
      } else if (s.phase === 'cabin') {
        act({ type: 'skipCabin' });
        if (state().phase === 'cabin') act({ type: 'next' });
      } else if (s.phase === 'surface') {
        const st = surf();
        if (st && !st.over) {
          fastForward((x) => x.over, 30 * 600);
          return false; // the surface view hands over by itself on its next frame
        }
        act({ type: 'next' });
      } else act({ type: 'next' });
      if (where() === before) return false; // refused: the next beat tries again
    }
    return state().phase === target;
  }

  // Crises in flight: fix the ones that land on our seat, after a beat.
  function crisisWatch(delayMs) {
    const seen = new Set();
    const id = setInterval(() => {
      const s = state();
      if (s.phase !== 'flight') return;
      for (const c of s.crises || []) {
        if (c.status !== 'active' || seen.has(c.id)) continue;
        seen.add(c.id);
        if (c.fixTo && c.fixTo !== 'local') continue; // a crewmate has it
        const right = (c.options || []).find((o) => o.correct);
        if (!right) continue;
        setTimeout(() => {
          if (run && state().phase === 'flight') act({ type: 'crisisAct', crisisId: c.id, optionId: right.id });
        }, delayMs);
      }
    }, 100);
    run.restore.push(() => clearInterval(id));
  }

  // ---------- The surface ----------
  const surf = () => {
    const d = SMD.team && SMD.team.surfaceDev;
    const s = d && d.session;
    const st = s && s.state;
    return st && Array.isArray(st.entities) ? st : null;
  };
  // A simple autopilot for P1: walk to the next goal the game itself suggests,
  // hold Use to scan, plant or align, tap Use to pick up and set down.
  function pilot(st, tickN) {
    const S = SMD.team.surface;
    const me = st.entities.find((e) => e.kind === 'astronaut' && e.playerId === 'p1');
    if (!me || !S || !S.nextGoal) return { moveX: 0, moveY: 0, aimX: 0, aimY: 0, use: false, ability: false };
    let g = null;
    try {
      g = S.nextGoal(st, 'p1');
    } catch (e) {}
    let mx = 0;
    let my = 0;
    if (g && g.target) {
      const dx = g.target.x - me.x;
      const dz = g.target.z - me.z;
      const L = Math.hypot(dx, dz);
      if (L > 1.2) {
        mx = dx / L;
        my = dz / L;
      }
    }
    const pr = st.prompts && st.prompts.p1;
    const hold = pr === 'scan' || pr === 'plant' || pr === 'align';
    const pulse = (pr === 'pickup' || pr === 'deliver') && tickN % 12 < 2;
    if (hold) mx = my = 0;
    return { moveX: mx, moveY: my, aimX: mx || 1, aimY: my, use: hold || pulse, ability: false };
  }
  function pilotLoop() {
    let n = 0;
    const id = setInterval(() => {
      const st = surf();
      const s = ses();
      if (!st || !s || !s.sendInput || state().phase !== 'surface') return;
      const p = pilot(st, n++);
      s.sendInput({ mx: p.moveX, my: p.moveY, ax: p.aimX, ay: p.aimY, buttons: (p.use ? 2 : 0) | (p.ability ? 4 : 0) }, 'p1');
    }, 50);
    run.restore.push(() => clearInterval(id));
  }
  // Skip ahead: step the surface simulation (the same state the view draws)
  // until `until(state)` holds. Returns false when there is no surface to step.
  function fastForward(until, maxTicks) {
    const st = surf();
    const S = SMD.team.surface;
    if (!st || !S || typeof S.step !== 'function') return false;
    let n = 0;
    try {
      while (!st.over && !until(st) && n < maxTicks) {
        S.step(st, { p1: pilot(st, st.tick || n) }, 1 / 30);
        n++;
      }
    } catch (e) {
      console.warn('demo: surface skip failed', e);
      return false;
    }
    return true;
  }
  const p1 = (st) => st.entities.find((e) => e.kind === 'astronaut' && e.playerId === 'p1') || {};
  const scanning = (st) => p1(st).useKind === 'scan' || p1(st).state === 'scan';
  const deciding = (st) => !!(st.extraction && st.extraction.decision > 0);
  // At the door: throw the least valuable sample per kilogram overboard,
  // through the room (the same action a phone's button sends).
  function dropOne() {
    const st = surf();
    if (!st || !deciding(st)) return false;
    const rack = ((st.ascent && st.ascent.rack) || []).slice().sort((a, b) => a.value / Math.max(0.1, a.massKg) - b.value / Math.max(0.1, b.massKg));
    if (!rack.length || !(st.ascent.overKg > 0.5)) return false;
    act({ type: 'ascentDrop', id: rack[0].id, drop: true });
    return true;
  }

  // ---------- Cards ----------
  function teamLine(o) {
    return o.team ? t('demo.team', 'Team {team}', { team: o.team }) : t('demo.team.none', 'Every Kilogram team');
  }
  function kiloFace(mood) {
    try {
      return SMD.team.guide.portrait(mood || 'happy', { size: 120 });
    } catch (e) {
      return '';
    }
  }
  function closingCard(o) {
    const face = kiloFace('happy');
    const link = `<span><b>${esc(t('demo.v2.end.play', 'Play free in the browser'))}</b>${o.link ? ` · ${esc(o.link)}` : ''}</span>`;
    return `${face ? `<div class="demo-face" aria-hidden="true">${face}</div>` : ''}
      <p class="demo-big">${esc(t('demo.title', 'Every Kilogram'))}</p>
      <div class="demo-rule"></div>
      <p class="demo-small">${esc(t('demo.v2.tagline', 'Design a spacecraft, fly it, and bring back the science. Every kilogram counts.'))}</p>
      <div class="demo-row">${link}<span>${esc(t('demo.v2.end.modes', 'Solo or up to four players · English and Arabic'))}</span></div>
      <div class="demo-row"><span>${esc(t('demo.v2.end.next', 'Next: classroom trials with teachers.'))}</span><span>${esc(teamLine(o))}</span></div>`;
  }

  // ---------- The full showcase ----------
  // Each beat: at (ms from start), what to do. Durations are the gaps.
  function fullCut(o) {
    const M = MISSION;
    return [
      {
        at: 0,
        run() {
          show('start');
          sub(t('demo.v2.full.title', 'Every Kilogram: design a spacecraft, fly it, and bring back the science.'));
          later(() => tap('[data-act="play"]', null), 3000);
        },
      },
      {
        at: 4500,
        run() {
          show('team', { mode: 'solo', session: run.session });
          sub(t('demo.v2.full.diff', 'Pick how hard it is: Cadet, Engineer or Flight director.'));
          later(() => tap(`[data-diff="${M.difficulty}"]`, () => act({ type: 'setup', difficulty: M.difficulty })), 700);
          later(() => act({ type: 'forward' }), 2100);
        },
      },
      {
        at: 6800,
        run() {
          sub(t('demo.v2.full.crew', 'Pick your astronaut. Each one has a job: planner, engineer, scientist or communications.'));
          later(() => tap(`[data-crew="${run.crewId}"]`, () => act({ type: 'setRole', role: M.crewJob, crew: run.crewId })), 1200);
          later(() => act({ type: 'forward' }), 3600);
        },
      },
      {
        at: 10600,
        run() {
          sub(t('demo.v2.full.dest', 'Six destinations, each with a real science question. Two are training flights in Earth orbit.'));
          later(() => tap(`[data-scn="${M.scenario}"]`, () => act({ type: 'setup', scenarioId: M.scenario })), 1200);
          later(() => advanceTo('brief'), 3400);
        },
      },
      {
        at: 14200,
        run() {
          advanceTo('brief');
          sub(t('demo.v2.full.brief', 'KILO, the mission guide, says what this mission is for.'));
          // KILO's next line, as a player pressing Space would.
          later(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })), 2900);
        },
      },
      {
        at: 19400,
        run() {
          advanceTo('design');
          goStep('orbit');
          sub(t('demo.v2.full.build', 'Build the ship one part at a time: up to three choices, each with plain pros and cons.'));
          later(() => build('orbit', M.build[0][1]), 1000);
        },
      },
      {
        at: 22800,
        run() {
          goStep('power');
          sub(t('demo.v2.full.power', 'Every choice changes the ship you see, and its mass, power and cost.'));
          later(() => build('power', M.build[1][1]), 900);
        },
      },
      {
        at: 25800,
        run() {
          goStep('instruments');
          sub(t('demo.v2.full.inst', 'Part numbers come from real NASA missions, such as the Mars Reconnaissance Orbiter.'));
          later(() => build('instruments', M.build[2][1]), 800);
          later(() => build('instruments', M.build[3][1]), 2200);
        },
      },
      {
        at: 30400,
        run() {
          goStep('radio');
          sub(t('demo.v2.full.radio', 'The antenna and radio decide how much data gets home.'));
          later(() => build('radio', M.build[4][1], { travel: 300 }), 500);
        },
      },
      {
        at: 32600,
        run() {
          goStep('landing');
          sub(t('demo.v2.full.landing', 'The landing kit: fuel to lift samples home, spare air and a drill.'));
          later(() => build('landing', M.build[5][1], { travel: 300 }), 500);
        },
      },
      {
        at: 34800,
        run() {
          goStep('rocket');
          sub(t('demo.v2.full.rocket', 'The rocket comes last. It has to lift everything you packed to that orbit.'));
          later(() => build('rocket', '*'), 1000);
          later(() => advanceTo('questions'), 3000);
        },
      },
      {
        at: 38000,
        run() {
          advanceTo('questions');
          sub(t('demo.v2.full.questions', 'Then the questions: what counts as success? KILO says how well your ship fits.'));
          later(() => tap(`[data-req="${M.requirement}"]`, () => act({ type: 'pick', requirement: M.requirement })), 1400);
          later(() => advanceTo('lock'), 3600);
        },
      },
      {
        at: 41800,
        run() {
          advanceTo('lock');
          sub(t('demo.v2.full.lock', 'A last review. A ship the rocket cannot lift is never allowed to launch.'));
          later(() => tap('[data-nav="next"]', () => act({ type: 'vote', yes: true })), 1400);
          later(() => advanceTo('cabin'), 3000);
        },
      },
      {
        at: 45000,
        run() {
          advanceTo('cabin');
          sub(t('demo.v2.full.cabin', 'In the capsule you meet the crew you are flying with.'), 'top');
        },
      },
      {
        at: 51200,
        run() {
          advanceTo('flight');
          sub(t('demo.v2.full.flight', 'Launch. The mission is simulated: sunlight and shadow, battery, data and radio passes.'), 'top');
          later(() => sub(t('demo.v2.full.crisis', 'Problems and chances come up in flight. Fix them in time.'), 'top'), 9800);
          later(() => advanceTo('landing'), 21800);
        },
      },
      {
        at: 73400,
        run() {
          advanceTo('landing');
          sub(t('demo.v2.full.land', 'On worlds you land on, the crew goes down to the surface.'));
          later(() => advanceTo('surface'), 5600);
        },
      },
      {
        at: 79200,
        run() {
          advanceTo('surface');
          // Past the touchdown pause, then the crew works in real time.
          when(surf, () => fastForward((st) => st.stage !== 'intro', 30 * 8), 40);
          sub(t('demo.v2.full.surface', 'Walk to the science sites. Only the instruments you packed can scan them.'));
          later(() => sub(t('demo.v2.full.uplink', 'Data counts only once it is sent home, when the orbiter passes overhead.')), 5200);
        },
      },
      {
        at: 89200,
        run() {
          // Skip ahead to the end of the stay: the call home and the door.
          fastForward(deciding, 30 * 900);
          sub(t('demo.v2.full.door', 'Time to go home. Too heavy for the fuel you brought? Throw samples overboard.'));
          [900, 1600, 2300, 3000, 3700].forEach((ms) => later(dropOne, ms));
          later(() => {
            if (state().phase === 'surface') fastForward((st) => st.over, 30 * 120);
          }, 4600);
          later(() => advanceTo('debrief'), 7400);
        },
      },
      {
        at: 96800,
        run() {
          advanceTo('debrief');
          sub(t('demo.v2.full.chain', 'Then see why it worked. Every link in the chain comes from the simulation.'), 'top');
          later(() => tap('[data-skip]', () => {
            const b = document.querySelector('[data-skip]');
            if (b) b.click(); // the debrief's own Skip: straight to the board
          }), 7400);
          later(() => sub(t('demo.v2.full.board', 'The score and KILO’s verdict. Then fly again with one change.')), 8200);
          later(() => tap('[data-refly-best]', null, { travel: 500 }), 10000);
        },
      },
      {
        at: 110600,
        run() {
          sub('');
          card(closingCard(o));
          later(() => show('start'), 600); // the game stops under the card
        },
      },
      { at: 116600, end: true },
    ];
  }

  // ---------- The 30-second cut ----------
  // The official structure: who (0:00), the challenge (0:02), title and
  // tagline (0:05), how it works, then the close. Subtitles: demo-30.srt.
  function cut30(o) {
    const M = MISSION;
    return [
      {
        at: 0,
        run() {
          show('start');
          const members = o.members ? `<p class="demo-small">${esc(o.members)}</p>` : '';
          card(`<p class="demo-kick">${esc(t('demo.30.who.k', 'Who we are'))}</p><p class="demo-big">${esc(teamLine(o))}</p>${members}`);
        },
      },
      {
        at: 1600,
        run() {
          card(`<p class="demo-kick">${esc(t('demo.30.ch.k', 'NASA Space Apps Challenge 2026 · Space Mission Design Game'))}</p>
            <p class="demo-mid">${esc(t('demo.v2.30.ch', 'A space mission is a chain of trade-offs. We made a game where you live them.'))}</p>`);
        },
      },
      {
        at: 3600,
        run() {
          card('');
          sub(t('demo.v2.30.title', 'Every Kilogram: design a spacecraft, fly it, bring back the science.'));
          // The first screens are set up now, so the team screen opens on the crew.
          act({ type: 'setup', difficulty: M.difficulty });
          act({ type: 'forward' });
        },
      },
      {
        at: 5400,
        run() {
          show('team', { mode: 'solo', session: run.session });
          sub(t('demo.v2.30.crew', 'Pick your astronaut and a real destination. KILO, your guide, explains the mission.'));
          later(() => tap(`[data-crew="${run.crewId}"]`, () => act({ type: 'setRole', role: M.crewJob, crew: run.crewId }), { travel: 300 }), 150);
          later(() => act({ type: 'forward' }), 1150);
          later(() => tap(`[data-scn="${M.scenario}"]`, () => act({ type: 'setup', scenarioId: M.scenario }), { travel: 260 }), 1300);
          later(() => advanceTo('brief'), 2200);
        },
      },
      {
        at: 9000,
        run() {
          advanceTo('design');
          goStep('orbit');
          sub(t('demo.v2.30.build', 'Build it one part at a time, with numbers from real NASA missions.'));
          later(() => build('orbit', M.build[0][1], { travel: 260 }), 150);
          later(() => goStep('power'), 1150);
          later(() => build('power', M.build[1][1], { travel: 260 }), 1300);
          later(() => goStep('instruments'), 2350);
          later(() => build('instruments', M.build[2][1], { travel: 220 }), 2450);
          later(() => build('instruments', M.build[3][1], { travel: 200 }), 3000);
        },
      },
      {
        at: 12600,
        run() {
          M.build.slice(4).forEach(([id, want]) => build(id, want, { quiet: true }));
          advanceTo('questions');
          sub(t('demo.v2.30.questions', 'Then decide what counts as success.'));
          later(() => tap(`[data-req="${M.requirement}"]`, () => act({ type: 'pick', requirement: M.requirement }), { travel: 260 }), 200);
        },
      },
      {
        at: 13800,
        run() {
          advanceTo('cabin');
          sub(t('demo.v2.30.cabin', 'Meet your crew, then launch.'), 'top');
        },
      },
      {
        at: 15400,
        run() {
          advanceTo('flight');
          sub(t('demo.v2.30.flight', 'The flight is simulated: sunlight, battery, data and radio passes.'), 'top');
        },
      },
      {
        at: 18600,
        run() {
          advanceTo('landing');
          sub(t('demo.v2.30.surface', 'Land, explore, and scan with the instruments you packed.'));
        },
      },
      {
        at: 20200,
        run() {
          advanceTo('surface');
          when(surf, () => fastForward(scanning, 30 * 40), 40);
        },
      },
      {
        at: 21800,
        run() {
          fastForward(deciding, 30 * 900);
          sub(t('demo.v2.30.door', 'Too heavy to get home? Throw science overboard.'));
          [300, 750, 1200].forEach((ms) => later(dropOne, ms));
        },
      },
      {
        at: 23400,
        run() {
          if (state().phase === 'surface') fastForward((st) => st.over, 30 * 120);
          sub(t('demo.v2.30.results', 'Then see why it worked, change one thing, and fly again.'), 'top');
          // The surface view reports the liftoff on its next frame; then straight to the results.
          when(() => ORDER.indexOf(phase()) >= ORDER.indexOf('ascent'), () => advanceTo('debrief'), 20);
        },
      },
      {
        at: 26600,
        run() {
          sub('');
          card(closingCard(o));
          later(() => show('start'), 600);
        },
      },
      { at: 30000, end: true },
    ];
  }

  // ---------- Start and stop ----------
  const MODULES = ['js/3d/engine.js', 'js/3d/craft.js', 'js/team/flight3d.js', 'js/3d/capsule.js', 'js/3d/astronaut.js', 'js/team/surface3d.js', 'js/team/surface3d-shooter.js'];
  const ASSETS = ['earth-day', 'earth-night', 'earth-clouds', 'mars', 'mars-mola'];

  function prepare() {
    const mods = MODULES.map((m) =>
      import(new URL(m, document.baseURI).href)
        .then((mod) => (mod && mod.preloadCharacters ? mod.preloadCharacters().catch(() => null) : null))
        .catch(() => null)
    );
    const assets = SMD.assets && SMD.assets.preload ? Promise.resolve(SMD.assets.preload(ASSETS)).catch(() => null) : Promise.resolve();
    // Cap the wait: a slow network should delay the demo, not stop it.
    return Promise.race([Promise.all(mods.concat([assets])), new Promise((r) => setTimeout(r, 15000))]);
  }

  async function start(opts = {}) {
    if (run) stop(true);
    if (!SMD.go || !SMD.ui || !SMD.team || !SMD.team.net || !SMD.team.net.createLocal) throw new Error('demo: the game has not loaded');
    const o = {
      cut: opts.cut === '30' ? '30' : 'full',
      captions: opts.captions !== false,
      team: opts.team || '',
      members: opts.members || '',
      link: opts.link || '',
      lang: opts.lang === 'ar' ? 'ar' : 'en',
      view: opts.view === 'tpp' || opts.view === 'fpp' ? opts.view : 'group',
    };
    const id = ++runId;
    // The 30-second cut follows the wall clock, so the recording is 30.0 s even
    // if a 3D scene stalls a frame; the full showcase waits for slow frames.
    const maxStep = o.cut === '30' ? 10000 : 100;
    run = { id, tasks: [], seq: 0, clock: 0, beat: -1, started: false, last: performance.now(), raf: 0, maxStep, opts: o, internal: false, realGo: SMD.go, restore: [], session: null };
    const r = run;
    r.raf = requestAnimationFrame((n) => tick(r, n));

    // Nothing the game writes while the demo runs reaches real storage.
    const sh = shieldStorage({
      'ek-surface-view': o.view, // top-down crew view on the surface unless ?view=tpp
      'ek-kilo-muted': '0', // KILO speaks in the demo
      'ek.team.surfaceCoach2': '1', // the first-time key hints stay off the recording
    });
    r.restore.push(() => sh.release());
    const prevLang = SMD.lang ? SMD.lang() : 'en';
    if (SMD.setLang && prevLang !== o.lang) SMD.setLang(o.lang);
    r.restore.push(() => {
      if (SMD.setLang && SMD.lang() !== prevLang) SMD.setLang(prevLang);
    });
    // The title shows a first-time player's view (no "your room is still open").
    const net = SMD.team.net;
    const realResumable = net.resumable;
    if (realResumable) net.resumable = () => null;
    r.restore.push(() => {
      if (realResumable) net.resumable = realResumable;
    });
    // Screens may not navigate on their own while the demo runs.
    SMD.go = function (screen, params) {
      if (run === r && !r.internal) return;
      return r.realGo.call(this, screen, params);
    };
    r.restore.push(() => {
      SMD.go = r.realGo;
    });

    const root = document.documentElement;
    root.classList.add('demo-on');
    if (o.cut === '30') root.classList.add('demo-cut30');
    r.restore.push(() => root.classList.remove('demo-on', 'demo-cut30', 'demo-ready'));

    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      stop(true);
    };
    window.addEventListener('keydown', onKey, true);
    r.restore.push(() => window.removeEventListener('keydown', onKey, true));

    overlay();
    await prepare();
    if (run !== r) return { stopped: true };

    // The solo session the team screen will show. Its own timing options
    // keep the cabin on and fit the whole flight into MISSION.flightMs.
    r.session = net.createLocal({
      mode: 'solo',
      seed: MISSION.seed,
      difficulty: 'engineer',
      scenarioId: MISSION.startScenario,
      hazards: 'anomalies',
      fresh: true,
      timing: { cabinMs: MISSION.cabinMs, fixedFlight: true, flightMs: MISSION.flightMs },
    });
    r.restore.push(() => {
      try {
        r.session.close();
      } catch (e) {}
    });
    const crew = SMD.team.crew && SMD.team.crew.byJob ? SMD.team.crew.byJob(MISSION.crewJob) : null;
    r.crewId = (crew && crew.id) || 'salma';
    crisisWatch(o.cut === '30' ? 300 : 1400);
    pilotLoop();

    const beats = o.cut === '30' ? cut30(o) : fullCut(o);
    return new Promise((resolve) => {
      r.resolve = resolve;
      const t0 = performance.now();
      beats.forEach((b, i) => {
        later(
          () => {
            r.beat = i;
            if (b.end) return stop(false, { ms: Math.round(r.clock), wallMs: Math.round(performance.now() - t0), phase: phase() });
            b.run();
          },
          b.at,
          true
        );
      });
      r.last = performance.now();
      r.started = true;
    });
  }

  // userStop: true when Esc ended it (straight back to the title). At the
  // natural end the closing card stays up until a click or key, so the
  // recording ends on it.
  function stop(userStop, info) {
    const r = run;
    if (!r) return;
    run = null;
    cancelAnimationFrame(r.raf);
    r.tasks.length = 0;
    // Leave the game first (its cleanups may still write), then give storage back.
    const realGo = r.realGo;
    try {
      if (SMD.ui && SMD.ui.state && SMD.ui.state.screen !== 'start') realGo('start');
    } catch (e) {}
    try {
      const d = SMD.team && SMD.team.surfaceDev;
      if (d && d.session && d.session.destroy) d.session.destroy();
    } catch (e) {}
    try {
      if (SMD.team && SMD.team.guide && SMD.team.guide.clear) SMD.team.guide.clear();
    } catch (e) {}
    r.restore.reverse().forEach((fn) => {
      try {
        fn();
      } catch (e) {}
    });
    const toTitle = () => {
      if (layer) {
        layer.remove();
        layer = null;
      }
      SMD.go('start');
    };
    if (userStop || !layer) toTitle();
    else {
      const sb = layer.querySelector('[data-dsub]');
      if (sb) sb.classList.remove('show');
      hideTap();
      layer.style.pointerEvents = 'auto';
      const done = (e) => {
        if (e) e.preventDefault();
        window.removeEventListener('keydown', done, true);
        if (layer) layer.removeEventListener('pointerdown', done);
        toTitle();
      };
      layer.addEventListener('pointerdown', done);
      window.addEventListener('keydown', done, true);
    }
    if (r.resolve) r.resolve(Object.assign({ stopped: !!userStop }, info || {}));
  }

  // ---------- "#demo" links ----------
  function fromUrl() {
    const m = /^#demo(?:-(30|raw))?$/.exec(location.hash || '');
    if (!m) return null;
    let q = null;
    try {
      q = new URLSearchParams(location.search);
    } catch (e) {
      q = new Map();
    }
    return {
      cut: m[1] === '30' ? '30' : 'full',
      captions: m[1] !== 'raw',
      team: (q.get('team') || '').slice(0, 60),
      members: (q.get('members') || '').slice(0, 160),
      link: (q.get('link') || '').slice(0, 80),
      lang: q.get('lang') || 'en',
      view: q.get('view') || '',
      autostart: q.get('autostart') === '1',
    };
  }

  // Browsers only allow sound after a click, so the demo waits for one.
  function armFromUrl(opts) {
    const go = () => start(opts).catch((e) => console.warn('demo failed', e));
    if (opts.autostart) return go();
    const el = overlay();
    document.documentElement.classList.add('demo-ready');
    const box = document.createElement('div');
    box.className = 'demo-ready-card';
    box.innerHTML = `<div role="dialog" aria-label="${esc(t('demo.ready.aria', 'Showcase ready'))}"><b>${esc(t('demo.ready', 'Showcase ready'))}</b><span>${esc(
      opts.cut === '30' ? t('demo.v2.ready.30', 'Start your screen recorder, then click anywhere or press a key. The 30-second cut plays with English subtitles. Esc stops it.') : t('demo.v2.ready.full', 'Start your screen recorder, then click anywhere or press a key. The full showcase runs about two minutes. Esc stops it.')
    )}</span></div>`;
    el.appendChild(box);
    const begin = (e) => {
      if (e && e.type === 'keydown' && (e.key === 'Escape' || e.key === 'Tab')) {
        if (e.key === 'Escape') cancel();
        return;
      }
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      cancel();
      try {
        SMD.audio && SMD.audio.unlock && SMD.audio.unlock();
      } catch (err) {}
      go();
    };
    const cancel = () => {
      window.removeEventListener('pointerdown', begin, true);
      window.removeEventListener('keydown', begin, true);
      box.remove();
      document.documentElement.classList.remove('demo-ready');
    };
    window.addEventListener('pointerdown', begin, true);
    window.addEventListener('keydown', begin, true);
  }

  // The 3D layer (js/3d/index.js) loads last and sets SMD.three; wait for it.
  function boot(tries) {
    const opts = fromUrl();
    if (!opts) return;
    if (SMD.three && SMD.go && SMD.ui && SMD.ui.state && SMD.ui.state.screen && SMD.team && SMD.team.net) return armFromUrl(opts);
    if (tries > 0) setTimeout(() => boot(tries - 1), 100);
    else console.warn('demo: the game did not start');
  }

  SMD.demo = Object.assign(SMD.demo || {}, {
    run: start,
    stop: () => stop(true),
    MISSION,
  });
  // A live getter (Object.assign would copy its value once).
  Object.defineProperty(SMD.demo, 'running', { get: () => !!run, configurable: true });
  // Milliseconds since the first beat (null while preparing or stopped).
  Object.defineProperty(SMD.demo, 'elapsed', { get: () => (run && run.started ? run.clock : null), configurable: true });
  // The room the demo is playing (null when stopped): for tools and tests.
  Object.defineProperty(SMD.demo, 'session', { get: () => (run ? run.session : null), configurable: true });

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const kick = () => boot(150);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kick);
    else kick();
    window.addEventListener('hashchange', () => {
      if (!run && fromUrl()) boot(150);
    });
  }
})();
