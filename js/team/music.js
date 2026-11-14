// Calm procedural space music (docs/TEAM-V3.md item 10, "As built (v3: look & feel)").
//
// Original, generated live with Web Audio: no files, no licensing. Five moods,
// one per part of the mission, each with its own key, mode, tempo and voices:
//   menu     D lydian, hopeful and open
//   build    F major, a little more motion while you work
//   flight   A aeolian, wide and slow, a faint solar wind
//   surface  E dorian, low and mysterious, wind over the ground
//   results  C lydian, warm and resolved
// Voices: a soft detuned pad (chord every two bars), a low sine drone, sparse
// bell notes from the chord or scale through a gentle echo and a long reverb,
// and for flight/surface a breath of filtered noise. Changing phase crossfades
// over about three seconds.
//
//   SMD.music.play(phase) / stop() / auto() / phase()
//   SMD.music.setVolume(0..1) / volume() / setMuted(bool) / muted()
//   SMD.music.plan(phase, fromBar, bars, seed) -> [{ t, kind, notes, dur, vel }]  (pure)
//   SMD.music.createEngine(audioContext, opts) -> { play, stop, tick(now), setLevel, buses }
//
// It follows the screen by itself (see detect()), starts on the first click or
// key (browser autoplay rules), and honours Settings (Music, Music volume, and
// the main Sound switch). Classic script, no dependencies; node tests require it.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});

  const PHASES = ['menu', 'build', 'flight', 'surface', 'results'];
  // root: MIDI note; scale: semitones in the mode; chords: semitone offsets from
  // the root (pad voiced an octave up); density: chance of a bell per grid step.
  const PRESETS = {
    menu: { root: 50, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 58, beats: 4, chordBars: 2, chords: [[0, 4, 7, 11, 14], [2, 6, 9, 14], [-3, 0, 4, 7, 11], [4, 7, 11, 14]], density: 0.16, grid: 2, bellOct: 2, bellDur: 3.2, cutoff: 900, wind: 0, padLevel: 1, bellLevel: 1 },
    build: { root: 53, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 72, beats: 4, chordBars: 2, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14, 17]], density: 0.24, grid: 2, bellOct: 2, bellDur: 1.9, cutoff: 1250, wind: 0, padLevel: 0.85, bellLevel: 0.9 },
    flight: { root: 45, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 54, beats: 4, chordBars: 2, chords: [[0, 3, 7, 14], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 7]], density: 0.1, grid: 2, bellOct: 3, bellDur: 4, cutoff: 700, wind: 0.5, padLevel: 1.1, bellLevel: 0.8 },
    surface: { root: 40, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 48, beats: 4, chordBars: 2, chords: [[0, 3, 7, 10, 14], [0, 5, 9, 12], [3, 7, 10, 14], [-2, 2, 5, 10]], density: 0.08, grid: 2, bellOct: 3, bellDur: 4.5, cutoff: 520, wind: 0.9, padLevel: 1.15, bellLevel: 0.75 },
    results: { root: 48, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 66, beats: 4, chordBars: 2, chords: [[0, 4, 7, 11, 14], [0, 2, 6, 9], [-3, 0, 4, 7], [-5, 0, 2, 7]], density: 0.22, grid: 2, bellOct: 2, bellDur: 2.6, cutoff: 1100, wind: 0, padLevel: 0.95, bellLevel: 1 },
  };
  const FADE = 3; // seconds of crossfade between phases
  const LOOKAHEAD = 1.4; // seconds of notes planned ahead
  const TICK_MS = 300;

  // ---------- Pure planning ----------
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (seed, phase, bar) => {
    let h = (seed | 0) ^ 0x9e3779b9;
    const s = `${phase}:${bar}`;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return h >>> 0;
  };
  const barSeconds = (P) => (P.beats * 60) / P.bpm;
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // The notes of bars [fromBar, fromBar + bars) in beats from fromBar's start.
  // The same seed and bar always give the same notes.
  function plan(phase, fromBar, bars, seed) {
    const P = PRESETS[phase];
    if (!P) return [];
    const out = [];
    const n = Math.max(0, bars | 0);
    for (let b = fromBar; b < fromBar + n; b++) {
      const r = rng(hash(seed == null ? 7 : seed, phase, b));
      const chord = P.chords[Math.floor(b / P.chordBars) % P.chords.length];
      const t0 = (b - fromBar) * P.beats;
      if (b % P.chordBars === 0) {
        out.push({ t: t0, kind: 'pad', notes: chord.map((x) => P.root + 12 + x), dur: P.chordBars * P.beats, vel: 0.8 });
        out.push({ t: t0, kind: 'bass', notes: [P.root - 12 + chord[0]], dur: P.chordBars * P.beats, vel: 0.9 });
      }
      const steps = P.beats * P.grid;
      let last = -9;
      for (let s = 0; s < steps; s++) {
        // Downbeats a little more likely; never two bells on neighbouring steps.
        const p = P.density * (s % P.grid === 0 ? 1.4 : 0.6);
        if (r() >= p || s - last < 2) continue;
        last = s;
        const pool = r() < 0.65 ? chord.map((x) => ((x % 12) + 12) % 12) : P.scale;
        const deg = pool[Math.floor(r() * pool.length)];
        const oct = P.bellOct + (r() < 0.22 ? 1 : 0);
        out.push({ t: t0 + s / P.grid, kind: 'bell', notes: [P.root + 12 * oct + deg], dur: P.bellDur * (0.7 + r() * 0.6), vel: 0.35 + r() * 0.45 });
      }
    }
    return out.sort((a, b) => a.t - b.t);
  }

  // ---------- The engine (any AudioContext, also an OfflineAudioContext) ----------
  function createEngine(ctx, opts = {}) {
    const out = ctx.createGain();
    out.gain.value = opts.level == null ? 0.5 : opts.level;
    out.connect(opts.destination || ctx.destination);
    // Shared space: a long soft reverb and a dotted echo.
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    wet.connect(out);
    let verb = null;
    try {
      verb = ctx.createConvolver();
      verb.buffer = impulse(ctx, 3.2);
      verb.connect(wet);
    } catch (e) {
      verb = null;
    }
    const echo = ctx.createDelay(2);
    const echoFb = ctx.createGain();
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2400;
    echoFb.gain.value = 0.32;
    echo.connect(echoTone);
    echoTone.connect(echoFb);
    echoFb.connect(echo);
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.35;
    echoTone.connect(echoOut);
    echoOut.connect(out);
    if (verb) echoOut.connect(verb);
    let noise = null;

    const buses = [];
    const seed = opts.seed == null ? (Math.random() * 1e9) | 0 : opts.seed;

    function bus(phase, now) {
      const P = PRESETS[phase];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(1, now + FADE);
      g.connect(out);
      const send = ctx.createGain();
      send.gain.value = 0.55;
      g.connect(send);
      if (verb) send.connect(verb);
      const echoSend = ctx.createGain();
      echoSend.gain.value = 0.5;
      echoSend.connect(echo);
      echo.delayTime.setValueAtTime((60 / P.bpm) * 0.75, now);
      const b = { phase, P, gain: g, send, echoSend, start: now + 0.05, nextBar: 0, endAt: null, wind: null, notes: 0 };
      if (P.wind > 0) b.wind = startWind(b, now);
      return b;
    }

    function startWind(b, now) {
      try {
        noise = noise || noiseBuffer(ctx, 4);
        const src = ctx.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 420;
        bp.Q.value = 0.7;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.045;
        const lfoAmt = ctx.createGain();
        lfoAmt.gain.value = 260;
        lfo.connect(lfoAmt);
        lfoAmt.connect(bp.frequency);
        const g = ctx.createGain();
        g.gain.value = 0.022 * b.P.wind;
        src.connect(bp);
        bp.connect(g);
        g.connect(b.gain);
        src.start(now);
        lfo.start(now);
        return { src, lfo };
      } catch (e) {
        return null;
      }
    }

    function voice(b, ev, at) {
      const P = b.P;
      const spb = 60 / P.bpm;
      const dur = ev.dur * spb;
      b.notes++;
      if (ev.kind === 'pad') {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(P.cutoff * 0.6, at);
        f.frequency.linearRampToValueAtTime(P.cutoff, at + dur * 0.5);
        f.frequency.linearRampToValueAtTime(P.cutoff * 0.7, at + dur + 2.5);
        f.Q.value = 0.4;
        const g = ctx.createGain();
        const peak = (0.05 / Math.sqrt(ev.notes.length)) * ev.vel * P.padLevel;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(peak, at + 2.2);
        g.gain.setValueAtTime(peak, at + dur - 0.2);
        g.gain.linearRampToValueAtTime(0.0001, at + dur + 2.8);
        f.connect(g);
        g.connect(b.gain);
        ev.notes.forEach((m, i) => {
          [-7, 7].forEach((cents) => {
            const o = ctx.createOscillator();
            o.type = i === 0 ? 'triangle' : 'sawtooth';
            o.frequency.value = midiHz(m);
            o.detune.value = cents + (i % 2 ? 3 : -3);
            o.connect(f);
            o.start(at);
            o.stop(at + dur + 3);
          });
        });
      } else if (ev.kind === 'bass') {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = midiHz(ev.notes[0]);
        const g = ctx.createGain();
        const peak = 0.07 * ev.vel;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(peak, at + 1.8);
        g.gain.setValueAtTime(peak, at + dur - 0.3);
        g.gain.linearRampToValueAtTime(0.0001, at + dur + 2);
        o.connect(g);
        g.connect(b.gain);
        o.start(at);
        o.stop(at + dur + 2.2);
      } else {
        // A soft bell: a sine, a quiet inharmonic partial and a little attack.
        const f0 = midiHz(ev.notes[0]);
        const g = ctx.createGain();
        const peak = 0.05 * ev.vel * P.bellLevel;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        g.connect(b.gain);
        g.connect(b.echoSend);
        const o1 = ctx.createOscillator();
        o1.type = 'sine';
        o1.frequency.value = f0;
        o1.connect(g);
        const g2 = ctx.createGain();
        g2.gain.value = 0.18;
        const o2 = ctx.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = f0 * 2.76;
        o2.connect(g2);
        g2.connect(g);
        [o1, o2].forEach((o) => {
          o.start(at);
          o.stop(at + dur + 0.05);
        });
      }
    }

    // Plan and schedule every bar that starts before now + LOOKAHEAD.
    function tick(now) {
      for (let i = buses.length - 1; i >= 0; i--) {
        const b = buses[i];
        const bs = barSeconds(b.P);
        while (b.start + b.nextBar * bs < now + LOOKAHEAD && (b.endAt == null || b.start + b.nextBar * bs < b.endAt)) {
          const t0 = b.start + b.nextBar * bs;
          plan(b.phase, b.nextBar, 1, seed).forEach((ev) => voice(b, ev, Math.max(now, t0 + ev.t * (60 / b.P.bpm))));
          b.nextBar++;
        }
        // A faded bus is let go once its last notes have rung out.
        if (b.endAt != null && now > b.endAt + 6) {
          try {
            if (b.wind) {
              b.wind.src.stop();
              b.wind.lfo.stop();
            }
            b.gain.disconnect();
            b.send.disconnect();
            b.echoSend.disconnect();
          } catch (e) {}
          buses.splice(i, 1);
        }
      }
    }
    function fadeOut(b, now) {
      if (b.endAt != null) return;
      b.endAt = now + FADE;
      try {
        b.gain.gain.cancelScheduledValues(now);
        b.gain.gain.setValueAtTime(Math.max(0.0001, b.gain.gain.value || 0.0001), now);
        b.gain.gain.linearRampToValueAtTime(0.0001, now + FADE);
      } catch (e) {}
    }
    return {
      buses,
      seed,
      out,
      play(phase, now) {
        const t = now == null ? ctx.currentTime : now;
        if (!PRESETS[phase]) return this.stop(t);
        const live = buses.find((b) => b.endAt == null);
        if (live && live.phase === phase) return live;
        buses.forEach((b) => fadeOut(b, t));
        const b = bus(phase, t);
        buses.push(b);
        tick(t);
        return b;
      },
      stop(now) {
        const t = now == null ? ctx.currentTime : now;
        buses.forEach((b) => fadeOut(b, t));
      },
      // After a pause (muted, hidden tab): carry on from now, not from the past.
      resync(now) {
        buses.forEach((b) => {
          const bs = barSeconds(b.P);
          if (b.start + b.nextBar * bs < now) b.start = now + 0.1 - b.nextBar * bs;
        });
      },
      tick,
      setLevel(v, now) {
        const t = now == null ? ctx.currentTime : now;
        try {
          out.gain.cancelScheduledValues(t);
          out.gain.setTargetAtTime(Math.max(0, v), t, 0.25);
        } catch (e) {
          out.gain.value = v;
        }
      },
      current() {
        const live = buses.find((b) => b.endAt == null);
        return live ? live.phase : null;
      },
    };
  }

  function impulse(ctx, seconds) {
    const rate = ctx.sampleRate || 44100;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }
  function noiseBuffer(ctx, seconds) {
    const rate = ctx.sampleRate || 44100;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
      d[i] = last * 3;
    }
    return buf;
  }

  // ---------- Settings ----------
  // SMD.settings.music / musicVolume when game.js is loaded (index.html);
  // otherwise (join.html) a small local store of its own.
  const OWN_KEY = 'ek-music';
  function own() {
    try {
      const d = JSON.parse((globalThis.localStorage && localStorage.getItem(OWN_KEY)) || '{}');
      return { on: d.on !== false, volume: Number.isFinite(d.volume) ? Math.max(0, Math.min(1, d.volume)) : 0.5 };
    } catch (e) {
      return { on: true, volume: 0.5 };
    }
  }
  function saveOwn(d) {
    try {
      localStorage.setItem(OWN_KEY, JSON.stringify(d));
    } catch (e) {}
  }
  const S = () => (SMD.settings && 'musicVolume' in SMD.settings ? SMD.settings : null);
  function volume() {
    const s = S();
    return s ? s.musicVolume : own().volume;
  }
  function musicOn() {
    const s = S();
    return s ? s.music !== false : own().on;
  }
  function soundOn() {
    try {
      if (SMD.settings && 'sound' in SMD.settings) return !!SMD.settings.sound;
      return !(globalThis.localStorage && localStorage.getItem('ek-muted') === '1');
    } catch (e) {
      return true;
    }
  }

  // ---------- The live player ----------
  const hasAudio = () => typeof globalThis.AudioContext === 'function' || typeof globalThis.webkitAudioContext === 'function';
  let ctx = null;
  let engine = null;
  let timer = 0;
  let override = null; // a phase, 'off', or null (follow the screen)
  let unlocked = false;
  let wasSilent = true;

  function audioCtx() {
    if (ctx) return ctx;
    try {
      // Share the game's context (js/audio.js) when it is there.
      const shared = SMD.audio && SMD.audio.unlock ? SMD.audio.unlock() : null;
      if (shared && shared.createGain) ctx = shared;
      else {
        const C = globalThis.AudioContext || globalThis.webkitAudioContext;
        ctx = C ? new C() : null;
      }
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }
  const silent = () => !musicOn() || !soundOn() || volume() <= 0.001 || (typeof document !== 'undefined' && document.hidden);

  // What should be playing for the screen on show.
  const PHASE_OF = { lobby: 'menu', brief: 'build', questions: 'build', design: 'build', lock: 'build', cabin: 'flight', flight: 'flight', landing: 'surface', surface: 'surface', ascent: 'surface', debrief: 'results' };
  function detect() {
    if (typeof document === 'undefined') return null;
    const stage = document.querySelector('.ts-stage[data-phase]');
    if (stage) return PHASE_OF[stage.dataset.phase] || 'build';
    if (document.querySelector('.ts-title2, .tp-app, .tp-page #join-root > *')) return 'menu';
    return null;
  }
  function wanted() {
    if (override === 'off') return null;
    return override || detect();
  }

  function loop() {
    if (!unlocked || !hasAudio()) return;
    const want = wanted();
    if (silent()) {
      if (engine && !wasSilent) {
        engine.setLevel(0);
        engine.stop();
      }
      wasSilent = true;
      return;
    }
    const c = audioCtx();
    if (!c) return;
    if (c.state === 'suspended') {
      try {
        const p = c.resume();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    }
    if (!engine) engine = createEngine(c, { level: 0 });
    const now = c.currentTime;
    if (wasSilent) {
      engine.resync(now);
      wasSilent = false;
    }
    engine.setLevel(volume() * 1.5, now);
    if (want !== engine.current()) {
      if (want) engine.play(want, now);
      else engine.stop(now);
    }
    engine.tick(now);
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    loop();
  }
  function startLoop() {
    if (timer || typeof document === 'undefined') return;
    timer = setInterval(loop, TICK_MS);
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', loop);
    if (SMD.bus && SMD.bus.on) SMD.bus.on('settings', () => loop());
  }

  SMD.music = {
    PHASES,
    PRESETS,
    FADE,
    plan,
    barSeconds,
    midiHz,
    createEngine,
    detect,
    play(phase) {
      override = PRESETS[phase] ? phase : null;
      loop();
    },
    stop() {
      override = 'off';
      loop();
    },
    auto() {
      override = null;
      loop();
    },
    phase() {
      return engine ? engine.current() : null;
    },
    volume,
    setVolume(v) {
      const n = Math.max(0, Math.min(1, Number(v) || 0));
      const s = S();
      if (s) s.musicVolume = n;
      else saveOwn(Object.assign(own(), { volume: n }));
      loop();
    },
    muted: () => !musicOn(),
    setMuted(on) {
      const s = S();
      if (s) s.music = !on;
      else saveOwn(Object.assign(own(), { on: !on }));
      loop();
    },
    get playing() {
      return !!(engine && engine.current() && !wasSilent);
    },
  };
  if (typeof document !== 'undefined' && hasAudio()) startLoop();
})();
