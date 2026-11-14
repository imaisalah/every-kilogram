// Synthesised game audio (no files needed): engine rumble, beeps, alarms, bangs.
// Follows SMD.settings.sound. Safe where Web Audio is missing or refuses to start.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  let ctx = null;
  let master = null;
  let muted = false;
  let broken = false; // no Web Audio here, or it refused to start
  try {
    muted = SMD.settings ? !SMD.settings.sound : localStorage.getItem('ek-muted') === '1';
  } catch (e) {}

  function ac() {
    if (broken) return null;
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) {
        broken = true;
        return null;
      }
      try {
        ctx = new C();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.7;
        master.connect(ctx.destination);
      } catch (e) {
        broken = true;
        ctx = null;
        return null;
      }
    }
    if (ctx.state === 'suspended') {
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
    return ctx;
  }
  // Muted: skip building sounds at all (saves CPU on slow laptops).
  const live = () => (muted ? null : ac());

  // Brown noise is the same every time, so build each length once.
  const noiseCache = {};
  function noiseBuffer(seconds) {
    if (noiseCache[seconds]) return noiseCache[seconds];
    const c = ac();
    const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      // Brown noise: deep rumble.
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return (noiseCache[seconds] = b);
  }

  // A looping engine rumble whose loudness and pitch follow the throttle.
  function engine() {
    const c = live();
    if (!c) return { set() {}, stop() {} };
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(3);
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(lp).connect(g).connect(master);
    src.start();
    let stopped = false;
    return {
      set(level, brightness) {
        if (stopped) return;
        const t = c.currentTime;
        g.gain.setTargetAtTime(level, t, 0.08);
        lp.frequency.setTargetAtTime(150 + brightness * 900, t, 0.1);
      },
      stop() {
        if (stopped) return;
        stopped = true;
        const t = c.currentTime;
        g.gain.setTargetAtTime(0, t, 0.2);
        setTimeout(() => {
          try {
            src.stop();
          } catch (e) {}
        }, 900);
      },
    };
  }

  function beep(freq = 880, dur = 0.12, type = 'sine', vol = 0.25) {
    const c = live();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(master);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  function bang(vol = 0.9, dur = 0.8) {
    const c = live();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(1);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, c.currentTime);
    lp.frequency.exponentialRampToValueAtTime(80, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(lp).connect(g).connect(master);
    src.start();
    src.stop(c.currentTime + dur);
  }

  let alarmT = 0;
  function alarm() {
    const now = performance.now();
    if (now - alarmT < 700) return;
    alarmT = now;
    beep(660, 0.18, 'square', 0.12);
    setTimeout(() => beep(520, 0.18, 'square', 0.12), 200);
  }

  function chime(good = true) {
    if (muted) return;
    const notes = good ? [523, 659, 784, 1047] : [440, 349, 262];
    notes.forEach((f, i) => setTimeout(() => beep(f, 0.25, 'triangle', 0.2), i * 110));
  }

  function setMuted(m) {
    muted = !!m;
    if (SMD.store) SMD.store.set('ek-muted', muted ? '1' : '0');
    else
      try {
        localStorage.setItem('ek-muted', muted ? '1' : '0');
      } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 0.7;
    if (SMD.bus) SMD.bus.emit('settings', { key: 'sound', settings: SMD.settings });
  }

  // Settings panel or another tab of code flipped the sound setting.
  if (SMD.bus)
    SMD.bus.on('settings', (e) => {
      if (e && e.key === 'sound' && SMD.settings && SMD.settings.sound === muted) {
        muted = !SMD.settings.sound;
        if (master) master.gain.value = muted ? 0 : 0.7;
      }
    });

  // Browsers keep audio locked until the first tap or key press.
  if (typeof window !== 'undefined') {
    const first = () => {
      if (!muted) ac();
      window.removeEventListener('pointerdown', first, true);
      window.removeEventListener('keydown', first, true);
    };
    window.addEventListener('pointerdown', first, true);
    window.addEventListener('keydown', first, true);
  }

  SMD.audio = { unlock: ac, engine, beep, bang, alarm, chime, setMuted, isMuted: () => muted, available: () => !broken };
})();
