// Last Light sound: synthesised effects, a soft generative score, alarms, the
// heartbeat and room tone, all on top of SMD.audio's Web Audio context (no
// files). Follows the game's sound setting; silent where Web Audio is missing.
const SMD = (globalThis.SMD = globalThis.SMD || {});

export function createSound() {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let disposed = false;
  const muted = () => !!(SMD.audio && SMD.audio.isMuted && SMD.audio.isMuted());

  function ac() {
    if (disposed || muted()) return null;
    // Before the first click or key the browser keeps audio locked; asking
    // anyway only fills the console with warnings.
    try {
      if (!ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
    } catch (e) {}
    if (!ctx) {
      try {
        ctx = SMD.audio && SMD.audio.unlock ? SMD.audio.unlock() : null;
      } catch (e) {
        ctx = null;
      }
      if (!ctx) return null;
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.32;
      musicBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
    }
    return ctx;
  }
  const offSettings = SMD.bus
    ? SMD.bus.on('settings', (e) => {
        if (e && e.key === 'sound' && master) master.gain.value = muted() ? 0 : 0.8;
      })
    : null;

  // ---------- Building blocks ----------
  const buffers = {};
  function noise(kind = 'white', seconds = 2) {
    const key = kind + seconds;
    if (buffers[key]) return buffers[key];
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return (buffers[key] = b);
  }
  // A shaped noise burst through a filter.
  function burst({ kind = 'white', dur = 0.3, vol = 0.4, type = 'bandpass', f0 = 1000, f1 = null, q = 1, attack = 0.005, at = 0, bus = sfxBus, loop = false }) {
    const c = ac();
    if (!c) return null;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noise(kind, Math.max(1, Math.ceil(dur + 0.2)));
    src.loop = loop;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.05);
    return { src, gain: g, filter: f };
  }
  function tone({ f = 440, f1 = null, dur = 0.2, vol = 0.2, type = 'sine', attack = 0.005, at = 0, bus = sfxBus }) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---------- Effects ----------
  const FX = {
    bang() {
      burst({ kind: 'brown', dur: 2.6, vol: 1.0, type: 'lowpass', f0: 2400, f1: 60, attack: 0.002 });
      tone({ f: 70, f1: 28, dur: 1.6, vol: 0.7 });
      burst({ kind: 'white', dur: 0.35, vol: 0.5, type: 'highpass', f0: 2500, attack: 0.001 });
      burst({ kind: 'white', dur: 2.2, vol: 0.12, type: 'bandpass', f0: 3200, f1: 1800, q: 0.7, at: 0.25 });
    },
    hiss() {
      burst({ kind: 'white', dur: 1.8, vol: 0.28, type: 'highpass', f0: 3000, attack: 0.05 });
    },
    vent() {
      burst({ kind: 'white', dur: 3.5, vol: 0.32, type: 'bandpass', f0: 1800, f1: 600, q: 0.6, attack: 0.08 });
    },
    clank() {
      burst({ kind: 'white', dur: 0.25, vol: 0.45, type: 'bandpass', f0: 2200, q: 6 });
      tone({ f: 340, f1: 300, dur: 0.5, vol: 0.12, type: 'triangle' });
      tone({ f: 127, dur: 0.3, vol: 0.2 });
    },
    thud() {
      tone({ f: 95, f1: 45, dur: 0.35, vol: 0.5 });
      burst({ kind: 'brown', dur: 0.3, vol: 0.4, type: 'lowpass', f0: 500 });
    },
    click() {
      burst({ kind: 'white', dur: 0.04, vol: 0.35, type: 'highpass', f0: 2500 });
    },
    breaker() {
      burst({ kind: 'white', dur: 0.05, vol: 0.5, type: 'highpass', f0: 1800 });
      tone({ f: 110, f1: 70, dur: 0.18, vol: 0.35 });
      tone({ f: 1400, dur: 0.06, vol: 0.06, type: 'square', at: 0.04 });
    },
    locker() {
      burst({ kind: 'white', dur: 0.05, vol: 0.4, type: 'highpass', f0: 2200 });
      burst({ kind: 'white', dur: 0.4, vol: 0.18, type: 'bandpass', f0: 900, f1: 1600, q: 2, at: 0.05 });
      tone({ f: 160, dur: 0.2, vol: 0.18, at: 0.38 });
    },
    door() {
      burst({ kind: 'white', dur: 0.9, vol: 0.25, type: 'highpass', f0: 2600, attack: 0.03 });
      tone({ f: 80, f1: 55, dur: 0.5, vol: 0.4, at: 0.7 });
    },
    valve() {
      for (let i = 0; i < 5; i++) burst({ kind: 'white', dur: 0.05, vol: 0.3, type: 'bandpass', f0: 2600 + i * 120, q: 5, at: i * 0.09 });
    },
    pickup() {
      tone({ f: 660, dur: 0.18, vol: 0.13, type: 'triangle' });
      tone({ f: 990, dur: 0.3, vol: 0.11, type: 'triangle', at: 0.08 });
    },
    place() {
      tone({ f: 180, f1: 120, dur: 0.18, vol: 0.3 });
      burst({ kind: 'white', dur: 0.08, vol: 0.25, type: 'bandpass', f0: 1500, q: 3 });
    },
    wrong() {
      tone({ f: 200, dur: 0.16, vol: 0.12, type: 'square' });
      tone({ f: 150, dur: 0.2, vol: 0.12, type: 'square', at: 0.12 });
    },
    success() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.5, vol: 0.12, type: 'triangle', at: i * 0.09 }));
    },
    fail() {
      tone({ f: 220, f1: 110, dur: 1.2, vol: 0.18, type: 'sawtooth' });
      burst({ kind: 'brown', dur: 1.4, vol: 0.4, type: 'lowpass', f0: 300 });
    },
    whoosh() {
      burst({ kind: 'white', dur: 0.7, vol: 0.22, type: 'bandpass', f0: 400, f1: 2400, q: 1.2, attack: 0.25 });
    },
    radio() {
      burst({ kind: 'white', dur: 0.22, vol: 0.14, type: 'bandpass', f0: 2400, q: 1.5 });
      tone({ f: 1250, dur: 0.07, vol: 0.06, type: 'square', at: 0.18 });
    },
    radioOut() {
      tone({ f: 1050, dur: 0.07, vol: 0.06, type: 'square' });
      burst({ kind: 'white', dur: 0.18, vol: 0.12, type: 'bandpass', f0: 2600, q: 1.5, at: 0.06 });
    },
    objective() {
      tone({ f: 587, dur: 0.22, vol: 0.08, type: 'sine' });
      tone({ f: 880, dur: 0.35, vol: 0.07, type: 'sine', at: 0.11 });
    },
    journal() {
      tone({ f: 784, dur: 0.4, vol: 0.09, type: 'triangle' });
      tone({ f: 1175, dur: 0.6, vol: 0.07, type: 'triangle', at: 0.12 });
    },
    tick() {
      tone({ f: 1500, dur: 0.03, vol: 0.05, type: 'square' });
    },
    qte() {
      tone({ f: 740, dur: 0.12, vol: 0.12, type: 'triangle' });
    },
    heartbeat() {
      tone({ f: 58, f1: 40, dur: 0.16, vol: 0.55 });
      tone({ f: 52, f1: 38, dur: 0.14, vol: 0.4, at: 0.22 });
    },
    beep() {
      tone({ f: 880, dur: 0.12, vol: 0.12 });
    },
    alarm() {
      tone({ f: 660, dur: 0.2, vol: 0.12, type: 'square' });
      tone({ f: 520, dur: 0.2, vol: 0.12, type: 'square', at: 0.22 });
    },
    rumble() {
      burst({ kind: 'brown', dur: 5, vol: 0.9, type: 'lowpass', f0: 200, f1: 90, attack: 1.2 });
    },
    creak() {
      tone({ f: 70, f1: 95, dur: 1.2, vol: 0.12, type: 'sawtooth', attack: 0.3 });
    },
    breath() {
      burst({ kind: 'white', dur: 1.1, vol: 0.08, type: 'bandpass', f0: 700, q: 0.8, attack: 0.45 });
    },
  };
  FX.flip = FX.breaker;
  FX.open = FX.locker;
  FX.explosion = FX.bang;
  FX.boom = FX.bang;
  FX.craft = FX.place;
  FX.static = FX.radio;

  function sfx(name) {
    const fn = FX[name];
    if (!fn) return false;
    if (!ac()) return true;
    try {
      fn();
    } catch (e) {}
    return true;
  }

  // ---------- Loops: alarm, heartbeat, room tone ----------
  let alarmTimer = 0;
  function alarm(on) {
    clearInterval(alarmTimer);
    alarmTimer = 0;
    if (on) {
      FX.alarm && sfx('alarm');
      alarmTimer = setInterval(() => sfx('alarm'), 1300);
    }
  }
  let heartK = 0;
  let heartNext = 0;
  function heartbeat(k, dt) {
    heartK = k;
    if (k <= 0.02) return;
    heartNext -= dt;
    if (heartNext <= 0) {
      heartNext = 1.15 - 0.55 * k;
      if (ac()) {
        tone({ f: 58, f1: 40, dur: 0.16, vol: 0.25 + 0.4 * k });
        tone({ f: 52, f1: 38, dur: 0.14, vol: 0.18 + 0.3 * k, at: 0.22 });
      }
    }
  }
  let room = null; // { src, gain, filter, kind }
  function ambience(kind, level = 1) {
    const c = ac();
    if (!c) return;
    if (room && room.kind === kind) {
      room.gain.gain.setTargetAtTime(roomVol(kind) * level, c.currentTime, 0.6);
      return;
    }
    if (room) {
      const old = room;
      old.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.5);
      setTimeout(() => {
        try {
          old.src.stop();
        } catch (e) {}
      }, 2500);
      room = null;
    }
    if (!kind || kind === 'none') return;
    const src = c.createBufferSource();
    src.buffer = noise(kind === 'wind' ? 'brown' : 'white', 4);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = kind === 'wind' ? 'lowpass' : 'bandpass';
    f.frequency.value = kind === 'wind' ? 420 : 240;
    f.Q.value = kind === 'wind' ? 0.5 : 0.9;
    const g = c.createGain();
    g.gain.value = 0.0001;
    src.connect(f).connect(g).connect(sfxBus);
    src.start();
    g.gain.setTargetAtTime(roomVol(kind) * level, c.currentTime, 0.8);
    room = { src, gain: g, filter: f, kind };
  }
  const roomVol = (kind) => (kind === 'wind' ? 0.16 : kind === 'fans' ? 0.05 : 0.04);

  // ---------- Score ----------
  const MOODS = {
    calm: { notes: [110, 164.8, 220, 277.2], type: 'sine', cutoff: 900, vol: 0.5 },
    tension: { notes: [55, 58.3, 82.4, 116.5], type: 'sawtooth', cutoff: 420, vol: 0.55, pulse: 0.5 },
    action: { notes: [55, 82.4, 110, 123.5], type: 'sawtooth', cutoff: 650, vol: 0.6, pulse: 1.66, drum: true },
    sad: { notes: [73.4, 146.8, 174.6, 220], type: 'triangle', cutoff: 700, vol: 0.5 },
    wonder: { notes: [130.8, 196, 329.6, 493.9], type: 'triangle', cutoff: 1800, vol: 0.42 },
    dread: { notes: [41.2, 43.7, 61.7], type: 'sawtooth', cutoff: 300, vol: 0.6, pulse: 0.25 },
  };
  MOODS.hope = MOODS.wonder;
  MOODS.quiet = MOODS.calm;
  let music = null; // { mood, nodes[], gain, drumT }
  function stopMusic(fade = 2.5) {
    if (!music || !ctx) return;
    const m = music;
    music = null;
    clearInterval(m.drumT);
    m.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, fade / 3);
    setTimeout(() => m.nodes.forEach((n) => {
      try {
        n.stop();
      } catch (e) {}
    }), fade * 1000 + 600);
  }
  function setMusic(mood) {
    const key = mood && MOODS[mood] ? mood : null;
    if (music && music.mood === key) return;
    stopMusic();
    if (!key) return;
    const c = ac();
    if (!c) return;
    const spec = MOODS[key];
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = spec.cutoff;
    filter.Q.value = 0.7;
    filter.connect(gain).connect(musicBus);
    const nodes = [];
    spec.notes.forEach((f, i) => {
      [-4, 4].forEach((det) => {
        const o = c.createOscillator();
        o.type = spec.type;
        o.frequency.value = f;
        o.detune.value = det + i;
        const g = c.createGain();
        g.gain.value = (spec.vol / spec.notes.length) * (i === 0 ? 1.2 : 0.8) * 0.5;
        o.connect(g).connect(filter);
        o.start();
        nodes.push(o);
      });
    });
    // Slow breathing on the filter (or a pulse for tension and action).
    const lfo = c.createOscillator();
    lfo.frequency.value = spec.pulse || 0.07;
    const lg = c.createGain();
    lg.gain.value = spec.cutoff * (spec.pulse ? 0.45 : 0.3);
    lfo.connect(lg).connect(filter.frequency);
    lfo.start();
    nodes.push(lfo);
    gain.gain.setTargetAtTime(1, c.currentTime, 1.2);
    let drumT = 0;
    if (spec.drum)
      drumT = setInterval(() => {
        if (ac()) {
          tone({ f: 70, f1: 40, dur: 0.25, vol: 0.32, bus: musicBus });
          tone({ f: 70, f1: 40, dur: 0.2, vol: 0.2, bus: musicBus, at: 0.3 });
        }
      }, 1200);
    music = { mood: key, nodes, gain, drumT };
  }

  return {
    sfx,
    has: (name) => !!FX[name],
    alarm,
    heartbeat,
    ambience,
    music: setMusic,
    get mood() {
      return music ? music.mood : null;
    },
    stopAll() {
      alarm(false);
      stopMusic(0.6);
      ambience(null);
    },
    dispose() {
      if (disposed) return;
      alarm(false);
      stopMusic(0.5);
      ambience(null);
      disposed = true;
      if (offSettings) offSettings();
      const m = master;
      setTimeout(() => {
        try {
          if (m) m.disconnect();
        } catch (e) {}
      }, 3500);
    },
  };
}
