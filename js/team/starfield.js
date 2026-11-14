// A calm starfield behind every page (docs/TEAM-V3.md item 7, "As built (v3: look & feel)").
//
// One fixed layer at the back of the page: a base canvas drawn once per resize
// (faint Milky Way band, a soft glow or two, a few thousand still stars) and a
// small twinkle canvas where about 5% of the stars breathe slowly at 12 fps.
// Now and then a faint shooting star crosses. Reduced motion: nothing moves.
// The twinkle stops while the tab is hidden and while a full-screen 3D phase is
// on screen, so it never costs the 3D views a frame.
//
//   SMD.starfield.start() / stop() / pause() / resume()
//   SMD.starfield.layout(w, h, seed) -> [{ x, y, r, a, tint, tw }]   (pure)
//
// Classic script, no dependencies; starts itself once the body exists.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});

  // A small seeded random (mulberry32), so the sky is the same on every visit.
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

  // Star colours: most are white-blue, a few warm (as in a real sky).
  const TINTS = ['#ffffff', '#dfe8ff', '#c9d8ff', '#fff2dc', '#ffe1c2'];

  // The stars for a w x h page. Density scales with the area, capped for huge
  // screens; brightness follows a steep power law (many faint, few bright).
  function layout(w, h, seed, density) {
    const W = Math.max(1, w | 0);
    const H = Math.max(1, h | 0);
    const r = rng(seed == null ? 20261004 : seed);
    const n = Math.round(Math.min(2600, Math.max(120, ((W * H) / 1000) * (density || 1.15))));
    // The band: a gentle diagonal where stars bunch up a little.
    const bandA = -0.38;
    const nx = Math.sin(bandA);
    const ny = Math.cos(bandA);
    const stars = [];
    for (let i = 0; i < n; i++) {
      let x = r() * W;
      let y = r() * H;
      // A third of the stars are pulled towards the band.
      if (r() < 0.33) {
        const d = (x - W / 2) * nx + (y - H / 2) * ny;
        const pull = 0.55 + r() * 0.35;
        const px = x - nx * d * pull;
        const py = y - ny * d * pull;
        if (px >= 0 && px <= W && py >= 0 && py <= H) {
          x = px;
          y = py;
        }
      }
      const m = Math.pow(r(), 5); // 0 faint .. 1 bright
      stars.push({
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        r: 0.35 + m * 1.25,
        a: 0.18 + m * 0.7,
        tint: TINTS[(r() * (m > 0.5 ? TINTS.length : 3)) | 0],
        // Only some of the brighter ones twinkle, each at its own slow pace.
        tw: m > 0.18 && r() < 0.16 ? 0.25 + r() * 0.55 : 0,
        ph: r() * Math.PI * 2,
      });
    }
    return stars;
  }

  const reduced = () => {
    try {
      return !!(SMD.settings && SMD.settings.reducedMotion) || (globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  };
  // Full-screen 3D phases draw their own sky: rest there.
  const BUSY_PHASES = /^(cabin|flight|landing|surface|ascent)$/;
  function covered() {
    try {
      const stage = document.querySelector('.ts-stage[data-phase]');
      if (stage && BUSY_PHASES.test(stage.dataset.phase || '')) return true;
      return !!document.querySelector('.tf-flight, .tv-root, .tf-cabin, .ll-root, .ek-crew-creator .av-stage canvas');
    } catch (e) {
      return false;
    }
  }

  let host = null;
  let base = null;
  let twc = null;
  let stars = [];
  let twinklers = [];
  let timer = 0;
  let paused = false;
  let shooter = null;
  let nextShootAt = 0;
  let dpr = 1;
  let W = 0;
  let H = 0;
  let resizeT = 0;

  function drawBase() {
    if (!base) return;
    W = Math.max(1, globalThis.innerWidth || 1);
    H = Math.max(1, globalThis.innerHeight || 1);
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const low = document.documentElement.classList.contains('ek-tier-low');
    [base, twc].forEach((c) => {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    });
    const x = base.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, H);
    // Deep navy with a slightly lighter middle and two very soft glows.
    const g = x.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, '#070b22');
    g.addColorStop(0.55, '#0b1233');
    g.addColorStop(1, '#080c26');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    const glow = (cx, cy, rad, col) => {
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0, col);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg;
      x.fillRect(0, 0, W, H);
    };
    glow(W * 0.82, H * 0.18, Math.max(W, H) * 0.55, 'rgba(70, 92, 190, 0.13)');
    glow(W * 0.12, H * 0.88, Math.max(W, H) * 0.45, 'rgba(120, 70, 160, 0.08)');
    // The band itself: a wide, very faint haze along the diagonal.
    x.save();
    x.translate(W / 2, H / 2);
    x.rotate(0.38);
    const bh = Math.max(W, H) * 0.22;
    const bg = x.createLinearGradient(0, -bh, 0, bh);
    bg.addColorStop(0, 'rgba(160,180,255,0)');
    bg.addColorStop(0.5, 'rgba(160,180,255,0.045)');
    bg.addColorStop(1, 'rgba(160,180,255,0)');
    x.fillStyle = bg;
    x.fillRect(-Math.max(W, H), -bh, Math.max(W, H) * 2, bh * 2);
    x.restore();
    stars = layout(W, H, 20261004, low ? 0.7 : 1.15);
    twinklers = [];
    for (const s of stars) {
      if (s.tw && !reduced()) {
        twinklers.push(s);
        continue;
      }
      dot(x, s, s.a);
    }
    drawTwinkle(performance.now());
  }

  function dot(x, s, a) {
    x.globalAlpha = a;
    x.fillStyle = s.tint;
    if (s.r < 0.9) {
      x.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    } else {
      x.beginPath();
      x.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      x.fill();
      if (s.r > 1.25) {
        // A faint halo on the brightest few.
        x.globalAlpha = a * 0.16;
        x.beginPath();
        x.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
        x.fill();
      }
    }
    x.globalAlpha = 1;
  }

  function drawTwinkle(now) {
    if (!twc) return;
    const x = twc.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, H);
    const t = now / 1000;
    for (const s of twinklers) {
      // Slow breathing between 55% and 100% of the star's brightness.
      const k = 0.775 + 0.225 * Math.sin(t * s.tw * 2 + s.ph);
      dot(x, s, s.a * k);
    }
    if (shooter) {
      const p = (now - shooter.t0) / shooter.ms;
      if (p >= 1) shooter = null;
      else {
        const e = p * p * (3 - 2 * p);
        const hx = shooter.x + shooter.dx * e;
        const hy = shooter.y + shooter.dy * e;
        const fade = Math.sin(Math.PI * p);
        const tl = 0.16;
        const gr = x.createLinearGradient(hx, hy, hx - shooter.dx * tl, hy - shooter.dy * tl);
        gr.addColorStop(0, `rgba(235,242,255,${0.55 * fade})`);
        gr.addColorStop(1, 'rgba(235,242,255,0)');
        x.strokeStyle = gr;
        x.lineWidth = 1.2;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(hx, hy);
        x.lineTo(hx - shooter.dx * tl, hy - shooter.dy * tl);
        x.stroke();
      }
    }
  }

  function tick() {
    if (!host || paused || document.hidden || covered()) return;
    const now = performance.now();
    if (!reduced()) {
      if (!shooter && now > nextShootAt) {
        // Upper part of the sky, falling gently left or right.
        const dir = Math.random() < 0.5 ? -1 : 1;
        shooter = { t0: now, ms: 1300 + Math.random() * 700, x: W * (0.2 + Math.random() * 0.6), y: H * (0.05 + Math.random() * 0.3), dx: dir * W * (0.18 + Math.random() * 0.12), dy: H * (0.08 + Math.random() * 0.08) };
        nextShootAt = now + 45000 + Math.random() * 45000;
      }
      drawTwinkle(now);
    }
  }

  function onResize() {
    clearTimeout(resizeT);
    resizeT = setTimeout(drawBase, 120);
  }
  function onSettings(e) {
    if (e && (e.key === 'reducedMotion' || e.key === 'quality')) drawBase();
  }
  let offSettings = null;

  function start() {
    if (typeof document === 'undefined') return null;
    if (host && host.isConnected) return host;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', start, { once: true });
      return null;
    }
    host = document.createElement('div');
    host.className = 'ek-stars';
    host.setAttribute('aria-hidden', 'true');
    base = document.createElement('canvas');
    twc = document.createElement('canvas');
    host.append(base, twc);
    document.body.insertBefore(host, document.body.firstChild);
    document.documentElement.classList.add('ek-stars-on');
    nextShootAt = performance.now() + 20000 + Math.random() * 30000;
    drawBase();
    globalThis.addEventListener('resize', onResize);
    if (SMD.bus && SMD.bus.on) offSettings = SMD.bus.on('settings', onSettings);
    timer = setInterval(tick, 1000 / 12);
    return host;
  }
  function stop() {
    clearInterval(timer);
    timer = 0;
    globalThis.removeEventListener && globalThis.removeEventListener('resize', onResize);
    if (typeof offSettings === 'function') offSettings();
    offSettings = null;
    if (host) host.remove();
    host = base = twc = null;
    if (typeof document !== 'undefined') document.documentElement.classList.remove('ek-stars-on');
  }

  SMD.starfield = {
    start,
    stop,
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    layout,
    get running() {
      return !!(host && host.isConnected);
    },
  };
  if (typeof document !== 'undefined' && !/(^|[?&])nostars(=|&|$)/.test((globalThis.location && location.search) || '')) start();
})();
