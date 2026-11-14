// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Interstellar "Cornfield Chase" – style procedural background music        ║
// ║  Pure Web Audio synthesis. No files. Follows SMD.settings.sound.           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// Cornfield Chase signature:
//   • Fast pulsing organ ostinato (rhythmic 16th-note pattern)
//   • Layered organ voices building through octaves
//   • Key of A minor with simple i–VI–III–VII progression
//   • Swelling dynamics: starts soft, builds to a powerful climax, then recedes
//   • Shimmering high string-like sustain over the top
//   • No drums – all momentum from the rhythmic organ pattern
//
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const audio = SMD.audio;
  if (!audio) return;

  let ctx = null;
  let master = null;
  let playing = false;
  let layers = null;
  let currentMood = 'title';
  let fadeTarget = 0.40;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getCtx() {
    if (ctx) return ctx;
    const c = audio.unlock();
    if (!c) return null;
    ctx = c;
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    return ctx;
  }

  function t() { return ctx ? ctx.currentTime : 0; }
  function ramp(param, val, dur) { param.setTargetAtTime(val, t(), dur); }

  // ── Musical constants ───────────────────────────────────────────────────
  // Cornfield Chase stays mostly in A minor.  The ostinato pulses on the root
  // while the chords shift underneath.
  //   Am → F → C → G   (i → VI → III → VII in A minor)
  const BPM = 140;
  const BEAT = 60 / BPM;
  const SIXTEENTH = BEAT / 4;

  // Chord voicings (low octave) – each chord has 4 notes.
  const CHORDS = [
    // Am
    { root: 110.00, notes: [110.00, 130.81, 164.81, 220.00] },
    // F
    { root: 87.31,  notes: [87.31, 110.00, 130.81, 174.61] },
    // C
    { root: 130.81, notes: [130.81, 164.81, 196.00, 261.63] },
    // G
    { root: 98.00,  notes: [98.00, 123.47, 146.83, 196.00] },
  ];

  // ── LAYER 1: Organ Pulse (the heart of Cornfield Chase) ─────────────────
  // A fast rhythmic ostinato: repeated notes with a slight accent pattern
  // that creates the driving, breathless feel.
  function createOrganPulse() {
    const c = ctx;
    const out = c.createGain();
    out.gain.value = 0;

    // Reverb-like effect: feed-back delay for spaciousness.
    const delay = c.createDelay(0.5);
    delay.delayTime.value = BEAT * 0.75;  // dotted-eighth delay
    const fb = c.createGain();
    fb.gain.value = 0.25;
    const delayFilter = c.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 1200;
    delay.connect(delayFilter).connect(fb).connect(delay);

    const dry = c.createGain();
    dry.gain.value = 0.75;
    const wet = c.createGain();
    wet.gain.value = 0.25;
    delay.connect(wet).connect(out);
    dry.connect(out);

    // Current chord & pulse state.
    let running = true;
    let pulseTimer = null;
    let currentChord = 0;
    let beatCount = 0;
    const BEATS_PER_CHORD = 16;  // 4 bars of 4/4

    // Each pulse: a short organ-like note.
    function pulse() {
      if (!running || !ctx) return;
      const now = ctx.currentTime;
      const chord = CHORDS[currentChord];

      // Accent pattern: strong on 1, medium on 3, soft on 2 & 4.
      const pos = beatCount % 4;
      const accent = pos === 0 ? 1.0 : pos === 2 ? 0.7 : 0.45;

      // Create a short organ note: two oscillators + slight detune.
      for (let v = 0; v < 3; v++) {
        const freq = chord.notes[v < 2 ? 0 : (v === 2 ? 2 : 3)];
        const octave = v === 0 ? 1 : v === 1 ? 2 : 2;

        const o1 = c.createOscillator();
        const o2 = c.createOscillator();
        o1.type = 'sine';
        o2.type = 'triangle';
        o1.frequency.value = freq * octave;
        o2.frequency.value = freq * octave;
        o2.detune.value = 7;

        const env = c.createGain();
        const vol = accent * (v === 0 ? 0.10 : 0.06);
        // Sharp attack, moderate decay – organ key press feel.
        env.gain.setValueAtTime(0.001, now);
        env.gain.linearRampToValueAtTime(vol, now + 0.008);
        env.gain.setTargetAtTime(vol * 0.6, now + 0.008, SIXTEENTH * 0.4);
        env.gain.setTargetAtTime(0.001, now + SIXTEENTH * 0.7, SIXTEENTH * 0.25);

        o1.connect(env);
        o2.connect(env);
        env.connect(dry);
        env.connect(delay);
        o1.start(now);
        o2.start(now);
        const stopT = now + SIXTEENTH * 1.2;
        o1.stop(stopT);
        o2.stop(stopT);
      }

      beatCount++;
      if (beatCount >= BEATS_PER_CHORD) {
        beatCount = 0;
        currentChord = (currentChord + 1) % CHORDS.length;
      }
      pulseTimer = setTimeout(pulse, SIXTEENTH * 1000);
    }

    pulseTimer = setTimeout(pulse, 200);

    return {
      node: out,
      setVolume(val, dur = 3) { ramp(out.gain, val, dur); },
      stop() {
        running = false;
        clearTimeout(pulseTimer);
      },
    };
  }

  // ── LAYER 2: Sustained Organ Chords (the harmonic bed) ──────────────────
  // Long held organ tones that swell under the pulse – the "wall of sound".
  function createOrganSustain() {
    const c = ctx;
    const out = c.createGain();
    out.gain.value = 0;

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.5;
    lp.connect(out);

    // 4 sustained voices, each with 3 detuned oscillators for richness.
    const voices = [];
    for (let v = 0; v < 4; v++) {
      const g = c.createGain();
      g.gain.value = v < 2 ? 0.09 : 0.06;
      g.connect(lp);
      const oscs = [];
      for (let d = -1; d <= 1; d++) {
        const o = c.createOscillator();
        o.type = v < 2 ? 'sine' : 'triangle';
        o.frequency.value = CHORDS[0].notes[v];
        o.detune.value = d * 8 + (Math.random() - 0.5) * 3;
        o.connect(g);
        o.start();
        oscs.push(o);
      }
      voices.push({ oscs, gain: g });
    }

    // Upper octave shimmer.
    const shimmer = [];
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = CHORDS[0].notes[2 + i] * 2;
      o.detune.value = (i - 0.5) * 10;
      const g = c.createGain();
      g.gain.value = 0.025;
      o.connect(g).connect(lp);
      o.start();
      shimmer.push({ osc: o, gain: g });
    }

    let chordIdx = 0;
    let chordTimer = null;
    let running = true;

    function advance() {
      if (!running || !ctx) return;
      chordIdx = (chordIdx + 1) % CHORDS.length;
      const time = ctx.currentTime;
      const chord = CHORDS[chordIdx];
      voices.forEach((v, i) => {
        v.oscs.forEach((o) => {
          o.frequency.setTargetAtTime(chord.notes[i], time, 1.8);
        });
      });
      shimmer.forEach((s, i) => {
        s.osc.frequency.setTargetAtTime(chord.notes[2 + i] * 2, time, 1.8);
      });
      // Sync with pulse: chord changes every BEATS_PER_CHORD 16th notes.
      chordTimer = setTimeout(advance, SIXTEENTH * 16 * 1000);
    }
    chordTimer = setTimeout(advance, SIXTEENTH * 16 * 1000);

    return {
      node: out,
      setVolume(val, dur = 4) { ramp(out.gain, val, dur); },
      setFilter(freq, dur = 3) { ramp(lp.frequency, freq, dur); },
      stop() {
        running = false;
        clearTimeout(chordTimer);
        voices.forEach((v) => v.oscs.forEach((o) => { try { o.stop(); } catch (e) {} }));
        shimmer.forEach((s) => { try { s.osc.stop(); } catch (e) {} });
      },
    };
  }

  // ── LAYER 3: Sub Bass Drone ─────────────────────────────────────────────
  // Deep foundation note following the chord root.
  function createBass() {
    const c = ctx;
    const out = c.createGain();
    out.gain.value = 0;

    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = 'sine';
    o2.type = 'sine';
    o1.frequency.value = 55;  // low A
    o2.frequency.value = 55.2;

    const g = c.createGain();
    g.gain.value = 0.22;
    o1.connect(g);
    o2.connect(g);

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 100;
    g.connect(lp).connect(out);
    o1.start();
    o2.start();

    let chordIdx = 0;
    let timer = null;
    let running = true;

    function advance() {
      if (!running || !ctx) return;
      chordIdx = (chordIdx + 1) % CHORDS.length;
      const time = ctx.currentTime;
      const f = CHORDS[chordIdx].root / 2; // one octave below
      o1.frequency.setTargetAtTime(f, time, 2);
      o2.frequency.setTargetAtTime(f + 0.2, time, 2);
      timer = setTimeout(advance, SIXTEENTH * 16 * 1000);
    }
    timer = setTimeout(advance, SIXTEENTH * 16 * 1000);

    return {
      node: out,
      setVolume(val, dur = 3) { ramp(out.gain, val, dur); },
      stop() {
        running = false;
        clearTimeout(timer);
        try { o1.stop(); } catch (e) {}
        try { o2.stop(); } catch (e) {}
      },
    };
  }

  // ── LAYER 4: High Strings Shimmer ───────────────────────────────────────
  // Ethereal high-frequency sustain – like distant strings soaring above.
  function createStrings() {
    const c = ctx;
    const out = c.createGain();
    out.gain.value = 0;

    // Filtered noise for "air" / breath.
    const noiseLen = c.sampleRate * 4;
    const noiseBuf = c.createBuffer(2, noiseLen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = noiseBuf.getChannelData(ch);
      for (let i = 0; i < noiseLen; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = c.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3000;
    bp.Q.value = 1.5;
    const noiseGain = c.createGain();
    noiseGain.gain.value = 0.12;
    noise.connect(bp).connect(noiseGain).connect(out);
    noise.start();

    // Slow LFO on the filter for movement.
    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06;
    const lfoG = c.createGain();
    lfoG.gain.value = 800;
    lfo.connect(lfoG).connect(bp.frequency);
    lfo.start();

    // Sustained high tones.
    const tones = [];
    [659.26, 783.99, 1047].forEach((freq, i) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = 0.02 - i * 0.004;
      o.connect(g).connect(out);
      o.start();
      tones.push({ osc: o, gain: g });
    });

    return {
      node: out,
      setVolume(val, dur = 4) { ramp(out.gain, val, dur); },
      stop() {
        try { noise.stop(); } catch (e) {}
        try { lfo.stop(); } catch (e) {}
        tones.forEach((t) => { try { t.osc.stop(); } catch (e) {} });
      },
    };
  }

  // ── LAYER 5: Dust Sparkles (twinkling high notes) ───────────────────────
  function createDust() {
    const c = ctx;
    const out = c.createGain();
    out.gain.value = 0;
    let running = true;
    let timer = null;

    // Pentatonic scale notes for the sparkles (always consonant).
    const SPARKLE_NOTES = [880, 1047, 1175, 1319, 1568, 1760, 2093, 2637];

    function sparkle() {
      if (!running || !ctx) return;
      const now = ctx.currentTime;
      const freq = SPARKLE_NOTES[Math.floor(Math.random() * SPARKLE_NOTES.length)];
      const dur = 1.0 + Math.random() * 2.5;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = c.createGain();
      const vol = 0.015 + Math.random() * 0.025;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(vol, now + dur * 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      if (c.createStereoPanner) {
        const pan = c.createStereoPanner();
        pan.pan.value = (Math.random() - 0.5) * 1.6;
        o.connect(g).connect(pan).connect(out);
      } else {
        o.connect(g).connect(out);
      }
      o.start(now);
      o.stop(now + dur + 0.1);
      timer = setTimeout(sparkle, 1500 + Math.random() * 4000);
    }
    timer = setTimeout(sparkle, 800);

    return {
      node: out,
      setVolume(val, dur = 2) { ramp(out.gain, val, dur); },
      stop() { running = false; clearTimeout(timer); },
    };
  }

  // ── Swell engine ────────────────────────────────────────────────────────
  // Cornfield Chase builds over time.  This slowly increases intensity.
  let swellLevel = 0;   // 0 = quiet start, 1 = full climax
  let swellTimer = null;
  let swellDir = 1;

  function updateSwell() {
    if (!layers || !playing) return;
    // Swell up slowly, then hold, then recede – like a wave.
    swellLevel += swellDir * 0.008;
    if (swellLevel >= 1.0) { swellLevel = 1.0; swellDir = -1; }
    if (swellLevel <= 0.15) { swellLevel = 0.15; swellDir = 1; }

    const s = swellLevel;
    // The pulse gets louder and brighter as swell increases.
    if (layers.pulse) layers.pulse.setVolume(0.15 + s * 0.55, 2);
    // Sustain organ swells hugely.
    if (layers.sustain) {
      layers.sustain.setVolume(0.08 + s * 0.45, 2);
      layers.sustain.setFilter(600 + s * 1800, 2);
    }
    // Bass deepens.
    if (layers.bass) layers.bass.setVolume(0.05 + s * 0.20, 2);
    // Strings come in during the upper half.
    if (layers.strings) layers.strings.setVolume(s > 0.4 ? (s - 0.4) * 0.5 : 0, 2);
    // Dust is subtle throughout.
    if (layers.dust) layers.dust.setVolume(0.04 + s * 0.10, 2);

    swellTimer = setTimeout(updateSwell, 2000);
  }

  // ── Mood presets ────────────────────────────────────────────────────────
  const MOODS = {
    title:    { masterVol: 0.40, swellSpeed: 0.006, swellMin: 0.20, swellMax: 0.75 },
    hq:       { masterVol: 0.28, swellSpeed: 0.004, swellMin: 0.10, swellMax: 0.50 },
    design:   { masterVol: 0.22, swellSpeed: 0.003, swellMin: 0.08, swellMax: 0.40 },
    flight:   { masterVol: 0.45, swellSpeed: 0.010, swellMin: 0.30, swellMax: 1.00 },
    review:   { masterVol: 0.25, swellSpeed: 0.004, swellMin: 0.10, swellMax: 0.45 },
    story:    { masterVol: 0.42, swellSpeed: 0.008, swellMin: 0.25, swellMax: 0.90 },
    explore:  { masterVol: 0.35, swellSpeed: 0.005, swellMin: 0.15, swellMax: 0.65 },
    launch:   { masterVol: 0.50, swellSpeed: 0.012, swellMin: 0.40, swellMax: 1.00 },
    end:      { masterVol: 0.42, swellSpeed: 0.005, swellMin: 0.20, swellMax: 0.80 },
    quiet:    { masterVol: 0.16, swellSpeed: 0.003, swellMin: 0.05, swellMax: 0.30 },
    silent:   { masterVol: 0.00, swellSpeed: 0,     swellMin: 0,    swellMax: 0    },
  };

  function screenToMood(screen) {
    if (!screen) return 'title';
    const map = {
      start: 'title', hq: 'hq', board: 'hq', design: 'design',
      review: 'review', film: 'flight', ride: 'flight',
      launchday: 'launch', testlab: 'launch', story: 'story',
      map: 'explore', research: 'explore', archive: 'explore',
      end: 'end', results: 'end',
      newgame: 'quiet', classroom: 'quiet', avatar: 'quiet',
      ll: 'story', ll_title: 'story', ll_chapters: 'story', ll_journal: 'story',
      team: 'flight', team_museum: 'flight',
    };
    return map[screen] || 'hq';
  }

  function applyMood(mood, instant) {
    currentMood = mood;
    const m = MOODS[mood] || MOODS.hq;
    fadeTarget = m.masterVol;
    ramp(master.gain, audio.isMuted() ? 0 : fadeTarget, instant ? 0.1 : 3);
    // Adjust swell parameters – takes effect on next swell tick.
    swellDir = swellLevel < (m.swellMin + m.swellMax) / 2 ? 1 : -1;
  }

  // ── Public API ──────────────────────────────────────────────────────────
  function start() {
    if (playing || audio.isMuted()) return;
    const c = getCtx();
    if (!c) return;
    playing = true;

    layers = {
      pulse:   createOrganPulse(),
      sustain: createOrganSustain(),
      bass:    createBass(),
      strings: createStrings(),
      dust:    createDust(),
    };

    Object.values(layers).forEach((l) => l.node.connect(master));

    // Start the swell engine.
    swellLevel = 0.15;
    swellDir = 1;
    updateSwell();

    applyMood(currentMood, false);
  }

  function stop() {
    if (!playing) return;
    playing = false;
    clearTimeout(swellTimer);
    if (layers) {
      Object.values(layers).forEach((l) => l.stop());
      layers = null;
    }
    if (master) master.gain.value = 0;
  }

  function setScreen(screen) {
    const mood = screenToMood(screen);
    if (mood !== currentMood) applyMood(mood);
  }

  // ── Integration ─────────────────────────────────────────────────────────
  if (SMD.bus) {
    SMD.bus.on('settings', function (e) {
      if (!e || e.key !== 'sound') return;
      if (audio.isMuted()) {
        if (master) ramp(master.gain, 0, 0.5);
      } else {
        if (!playing) start();
        else if (master) ramp(master.gain, fadeTarget, 1);
      }
    });
  }

  // Wrap SMD.go to track screen changes.
  const _origGo = SMD.go;
  if (_origGo) {
    SMD.go = function (screen, params) {
      const result = _origGo.call(this, screen, params);
      if (!playing && !audio.isMuted()) start();
      setScreen(screen);
      return result;
    };
  }

  // Start on first user gesture.
  if (typeof window !== 'undefined') {
    const firstGesture = () => {
      if (!playing && !audio.isMuted()) {
        start();
        if (SMD.ui && SMD.ui.state && SMD.ui.state.screen) setScreen(SMD.ui.state.screen);
      }
      window.removeEventListener('pointerdown', firstGesture, true);
      window.removeEventListener('keydown', firstGesture, true);
    };
    window.addEventListener('pointerdown', firstGesture, true);
    window.addEventListener('keydown', firstGesture, true);
  }

  SMD.music = { start, stop, setScreen, setMood: applyMood, isPlaying: () => playing };
})();
