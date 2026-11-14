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
// v3 (docs/TEAM-V3.md items 9 and 23): the player chooses the guide. KILO, BRACE
// (a tall survey robot with dry drill-sergeant humour), Dr. Praline (the cheerful
// Royal Scientist of Caramoon) or CAIRN (a stack of singing stones from Echo
// Hollow that loves fixing things). All four are originals. Everything above follows the
// chosen guide: list(), current(), setCurrent(id), name(), picker(el, opts).
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
  function kiloPortrait(mood, opts = {}) {
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

  // ---------- BRACE: a tall graphite survey robot on a hover pad ----------
  // One round amber sensor eye with a lid that shows the mood, a column of five
  // amber light bars that flicker when it talks, two painted rank chevrons and
  // two slim jointed arms (it salutes when proud). Original design.
  const BRACE_ARMS = {
    // [left shoulder, left elbow, right shoulder, right elbow] in degrees; 0 hangs down, + is outward.
    neutral: [7, 0, 7, 0],
    deadpan: [4, 0, 4, 0],
    happy: [26, 16, 26, 16],
    proud: [7, 0, 150, 116],
    thinking: [7, 0, 15, -130],
    worried: [14, -40, 14, -40],
    sad: [2, 0, 2, 0],
    surprised: [62, 40, 62, 40],
    wink: [7, 0, 72, 46],
  };
  // Lid: how far the dark lid comes down over the eye (y of its edge, left and right),
  // and where the iris looks [dx, dy, r].
  const BRACE_EYE = {
    neutral: { lid: [17.5, 17.5], iris: [0, 0.6, 4.6] },
    deadpan: { lid: [23, 23], iris: [0, 1.6, 4.4] },
    happy: { lid: [16, 16], low: true, iris: [0, -0.6, 4.6] },
    proud: { lid: [16, 16], low: true, iris: [0, -1.4, 4.6] },
    thinking: { lid: [21, 17], iris: [2.4, -2, 4.2] },
    worried: { lid: [17, 21.5], iris: [0, 1, 4.4] },
    sad: { lid: [22, 20], iris: [0, 2.2, 4.2] },
    surprised: { lid: [14, 14], iris: [0, 0, 5.6] },
    wink: { lid: [33, 33], iris: [0, 0, 4.6] },
  };
  const BRACE_BARS = { neutral: 0.75, deadpan: 0.45, happy: 1, proud: 1, thinking: 0.6, worried: 0.55, sad: 0.35, surprised: 0.9, wink: 0.85 };
  function braceArm(a1, a2) {
    return `<g transform="rotate(${a1} 47 30)"><rect x="44.8" y="30" width="4.4" height="18" rx="2.2" fill="#3c4350"/><g transform="rotate(${a2} 47 48)"><rect x="45" y="48" width="4" height="16" rx="2" fill="#3c4350"/><circle cx="47" cy="48" r="2.9" fill="#68728a"/><rect x="44.4" y="62.6" width="5.2" height="3.6" rx="1.3" fill="#e2a24a" opacity="0.85"/></g><circle cx="47" cy="30" r="3.2" fill="#68728a"/></g>`;
  }
  function bracePortrait(mood, opts = {}) {
    const m = moodOf(mood);
    const size = opts.size || 96;
    const id = `bf${++uid}`;
    const A = BRACE_ARMS[m];
    const E = BRACE_EYE[m];
    const [dx, dy, ir] = E.iris;
    const lit = BRACE_BARS[m];
    const widths = opts.talking ? [16, 9, 19, 12, 15] : [10, 14, 18, 14, 10];
    let bars = '';
    widths.forEach((w, i) => {
      const y = 40 + i * 4.6;
      bars += `<rect x="${70 - w / 2}" y="${y}" width="${w}" height="3" rx="1.2" fill="#ffb24d" opacity="${(lit * (opts.talking ? 1 : 0.85)).toFixed(2)}"/>`;
    });
    const lidPath = E.lid[0] >= 33 ? `M60 14 H80 V34 H60 Z` : `M60 13 H80 V${E.lid[1]} L60 ${E.lid[0]} Z`;
    const lowLid = E.low ? `<path d="M60 35 V30.5 Q70 25.5 80 30.5 V35 Z" fill="#262c37"/>` : '';
    const wink = E.lid[0] >= 33 ? `<path d="M63.5 25 Q70 28.5 76.5 25" stroke="#ffb24d" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : '';
    return `<svg class="tf-kilo-svg tf-guide-brace" viewBox="14 2 112 110" width="${Math.round(size * 0.94)}" height="${Math.round(size * 0.92)}" role="img" aria-label="BRACE" data-mood="${m}">
      <defs>
        <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4c5465"/><stop offset="0.35" stop-color="#2d333f"/><stop offset="1" stop-color="#1c2029"/></linearGradient>
        <radialGradient id="${id}g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb24d" stop-opacity="0.42"/><stop offset="1" stop-color="#ffb24d" stop-opacity="0"/></radialGradient>
        <radialGradient id="${id}i" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffe2a6"/><stop offset="0.55" stop-color="#ff9e33"/><stop offset="1" stop-color="#a5520e"/></radialGradient>
        <clipPath id="${id}e"><circle cx="70" cy="24" r="8.6"/></clipPath>
      </defs>
      <ellipse class="tf-kilo-glow" cx="70" cy="104" rx="30" ry="6" fill="url(#${id}g)"/>
      <rect x="56" y="92" width="28" height="5" rx="2.5" fill="#1a1e26"/>
      <path d="M53 15 Q53 8 60 8 L80 8 Q87 8 87 15 L91 86 Q91 91 86 91 L54 91 Q49 91 49 86 Z" fill="url(#${id}b)"/>
      <path d="M55.4 12 L52 86" stroke="#8a94a8" stroke-opacity="0.32" stroke-width="1.4"/>
      <path d="M50.3 70.5 H89.7" stroke="#12151c" stroke-width="1"/>
      <circle cx="55" cy="75" r="1" fill="#5e6678"/><circle cx="85" cy="75" r="1" fill="#5e6678"/>
      <path d="M62.5 77 L70 81.5 L77.5 77 M62.5 81.5 L70 86 L77.5 81.5" stroke="#e2a24a" stroke-opacity="0.8" stroke-width="1.8" fill="none" stroke-linejoin="round"/>
      <circle cx="70" cy="24" r="10" fill="#0f1218" stroke="#646d82" stroke-width="1.2"/>
      <g clip-path="url(#${id}e)">
        <circle cx="70" cy="24" r="8.6" fill="#07090d"/>
        <circle cx="${70 + dx}" cy="${24 + dy}" r="${ir}" fill="url(#${id}i)"/>
        <circle cx="${68.4 + dx}" cy="${22.4 + dy}" r="1.1" fill="#fff" opacity="0.85"/>
        <path d="${lidPath}" fill="#262c37"/>${lowLid}
      </g>${wink}
      ${bars}
      ${braceArm(A[0], A[1])}
      <g transform="translate(140 0) scale(-1 1)">${braceArm(A[2], A[3])}</g>
    </svg>`;
  }
  // BRACE's face for the 3D model: the eye and the light column on a canvas.
  function drawBraceFace(c, mood, w, h, talking) {
    const m = moodOf(mood);
    const E = BRACE_EYE[m];
    c.fillStyle = '#20252f';
    c.fillRect(0, 0, w, h);
    const s = Math.min(w / 30, h / 64);
    const cx = w / 2;
    const ey = 14 * s;
    c.fillStyle = '#07090d';
    c.beginPath();
    c.arc(cx, ey, 9 * s, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.beginPath();
    c.arc(cx, ey, 9 * s, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#ff9e33';
    c.shadowColor = '#ffb24d';
    c.shadowBlur = 6 * s;
    c.beginPath();
    c.arc(cx + E.iris[0] * s, ey + E.iris[1] * s, E.iris[2] * s, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#20252f';
    const top = ey - 10 * s;
    c.beginPath();
    c.moveTo(cx - 10 * s, top);
    c.lineTo(cx + 10 * s, top);
    c.lineTo(cx + 10 * s, ey + (E.lid[1] - 24) * s);
    c.lineTo(cx - 10 * s, ey + (E.lid[0] - 24) * s);
    c.closePath();
    c.fill();
    c.restore();
    const widths = talking ? [16, 9, 19, 12, 15] : [10, 14, 18, 14, 10];
    c.fillStyle = '#ffb24d';
    c.globalAlpha = BRACE_BARS[m];
    c.shadowColor = '#ffb24d';
    c.shadowBlur = 4 * s;
    widths.forEach((bw, i) => c.fillRect(cx - (bw / 2) * s, (30 + i * 5) * s, bw * s, 3 * s));
    c.shadowBlur = 0;
    c.globalAlpha = 1;
  }

  // ---------- Dr. Praline: the Royal Scientist of Caramoon ----------
  // A young scientist with a swirled two-tone bun (caramel and cream), round
  // glasses, a mint lab coat with a honeycomb collar and a violet rock-sugar
  // crystal pin. Original design.
  const PR = { skin: '#9b6038', hair: '#b8763c', cream: '#f3dcb0', coat: '#cdeee0', lapel: '#b2e0cf', shirt: '#7a3f78', frame: '#4a2f55', ink: '#2a1a14', lip: '#7a2f2f' };
  const PR_EYES = {
    neutral: `<ellipse cx="63" cy="53.6" rx="1.7" ry="2" fill="${PR.ink}"/><ellipse cx="77" cy="53.6" rx="1.7" ry="2" fill="${PR.ink}"/>`,
    deadpan: `<ellipse cx="63" cy="54.2" rx="1.7" ry="1.3" fill="${PR.ink}"/><ellipse cx="77" cy="54.2" rx="1.7" ry="1.3" fill="${PR.ink}"/><path d="M60.6 52.9 H65.4 M74.6 52.9 H79.4" stroke="${PR.ink}" stroke-width="1"/>`,
    happy: `<path d="M60.6 54.4 Q63 51.4 65.4 54.4 M74.6 54.4 Q77 51.4 79.4 54.4" stroke="${PR.ink}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    proud: `<path d="M60.6 54.4 Q63 51.4 65.4 54.4 M74.6 54.4 Q77 51.4 79.4 54.4" stroke="${PR.ink}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    thinking: `<ellipse cx="64" cy="52.4" rx="1.6" ry="1.9" fill="${PR.ink}"/><ellipse cx="78" cy="52.4" rx="1.6" ry="1.9" fill="${PR.ink}"/>`,
    worried: `<ellipse cx="63" cy="54" rx="1.6" ry="1.9" fill="${PR.ink}"/><ellipse cx="77" cy="54" rx="1.6" ry="1.9" fill="${PR.ink}"/>`,
    sad: `<ellipse cx="63" cy="54.6" rx="1.6" ry="1.7" fill="${PR.ink}"/><ellipse cx="77" cy="54.6" rx="1.6" ry="1.7" fill="${PR.ink}"/>`,
    surprised: `<circle cx="63" cy="53.4" r="2.4" fill="${PR.ink}"/><circle cx="77" cy="53.4" r="2.4" fill="${PR.ink}"/>`,
    wink: `<ellipse cx="63" cy="53.6" rx="1.7" ry="2" fill="${PR.ink}"/><path d="M74.6 54.2 Q77 51.6 79.4 54.2" stroke="${PR.ink}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  };
  const PR_BROWS = {
    neutral: 'M59.5 44.6 Q63 43.2 66.4 44.4 M73.6 44.4 Q77 43.2 80.5 44.6',
    deadpan: 'M59.5 45.6 H66.4 M73.6 45.6 H80.5',
    happy: 'M59.5 44 Q63 42 66.4 43.6 M73.6 43.6 Q77 42 80.5 44',
    proud: 'M59.5 43.6 Q63 41.4 66.4 43 M73.6 43 Q77 41.4 80.5 43.6',
    thinking: 'M59.5 45.4 Q63 44.6 66.4 45 M73.6 43 Q77 41 80.5 42.6',
    worried: 'M59.5 45.4 Q63 43.6 66.4 42.6 M73.6 42.6 Q77 43.6 80.5 45.4',
    sad: 'M59.5 45.6 Q63 44.4 66.4 43.2 M73.6 43.2 Q77 44.4 80.5 45.6',
    surprised: 'M59.5 42.4 Q63 40.4 66.4 42 M73.6 42 Q77 40.4 80.5 42.4',
    wink: 'M59.5 44 Q63 42.4 66.4 43.8 M73.6 44.6 Q77 44 80.5 44.8',
  };
  const PR_MOUTH = {
    neutral: `<path d="M65.5 63 Q70 66.2 74.5 63" stroke="${PR.lip}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    deadpan: `<path d="M66 64 H74" stroke="${PR.lip}" stroke-width="1.6" stroke-linecap="round"/>`,
    happy: `<path d="M64 62.4 Q70 69.4 76 62.4 Z" fill="${PR.lip}"/><path d="M65.6 63.2 Q70 64.6 74.4 63.2" stroke="#fff" stroke-width="1.1" fill="none" opacity="0.85"/>`,
    proud: `<path d="M63.4 62.2 Q70 70 76.6 62.2 Z" fill="${PR.lip}"/><path d="M65.2 63 Q70 64.6 74.8 63" stroke="#fff" stroke-width="1.1" fill="none" opacity="0.85"/>`,
    thinking: `<path d="M66.5 64.4 Q71 63 74.5 63.6" stroke="${PR.lip}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    worried: `<path d="M65.5 65 Q70 62.6 74.5 65" stroke="${PR.lip}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    sad: `<path d="M65 65.6 Q70 62 75 65.6" stroke="${PR.lip}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    surprised: `<ellipse cx="70" cy="64.6" rx="2.4" ry="3" fill="${PR.lip}"/>`,
    wink: `<path d="M65 62.8 Q70 67.4 75 62.8" stroke="${PR.lip}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
  };
  function pralinePortrait(mood, opts = {}) {
    const m = moodOf(mood);
    const size = opts.size || 96;
    const id = `pf${++uid}`;
    const mouth = opts.talking ? `<ellipse cx="70" cy="64.4" rx="3.4" ry="2.5" fill="${PR.lip}"/><ellipse cx="70" cy="65.4" rx="1.8" ry="0.9" fill="#d97a7a"/>` : PR_MOUTH[m];
    const sparkle = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z" fill="${PR.cream}" opacity="0.7"/>`;
    return `<svg class="tf-kilo-svg tf-guide-praline" viewBox="0 0 140 112" width="${size}" height="${Math.round(size * 0.8)}" role="img" aria-label="Dr. Praline" data-mood="${m}">
      <defs>
        <radialGradient id="${id}d" cx="0.5" cy="0.35" r="0.75"><stop offset="0" stop-color="#43356a"/><stop offset="1" stop-color="#1d1a3d"/></radialGradient>
        <clipPath id="${id}c"><circle cx="70" cy="58" r="50"/></clipPath>
        <pattern id="${id}h" width="6" height="5.2" patternUnits="userSpaceOnUse"><path d="M1.5 0 L4.5 0 L6 2.6 L4.5 5.2 L1.5 5.2 L0 2.6 Z" fill="none" stroke="#e8a93a" stroke-width="0.6" opacity="0.75"/></pattern>
      </defs>
      <circle cx="70" cy="58" r="50" fill="url(#${id}d)"/>
      ${sparkle(30, 34, 3)}${sparkle(110, 28, 2.4)}${sparkle(112, 70, 1.8)}
      <g clip-path="url(#${id}c)">
        <path d="M43 60 Q40 30 70 27 Q100 30 97 60 L99 84 Q70 92 41 84 Z" fill="${PR.hair}"/>
        <circle cx="70" cy="21" r="13" fill="${PR.hair}"/>
        <path d="M70 21 m-8.5 0 a8.5 8.5 0 1 1 17 0 a6.3 6.3 0 1 1 -12.6 0 a4 4 0 1 1 8 0" stroke="${PR.cream}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M26 112 Q28 86 50 80 L90 80 Q112 86 114 112 Z" fill="${PR.coat}"/>
        <path d="M58 80 L70 97 L82 80 Z" fill="${PR.shirt}"/>
        <path d="M58 80 L70 97 L63 112 L49 83 Z" fill="${PR.lapel}"/><path d="M58 80 L70 97 L63 112 L49 83 Z" fill="url(#${id}h)"/>
        <path d="M82 80 L70 97 L77 112 L91 83 Z" fill="${PR.lapel}"/><path d="M82 80 L70 97 L77 112 L91 83 Z" fill="url(#${id}h)"/>
        <rect x="88" y="92" width="10" height="2.4" rx="1" fill="#e8a93a"/>
        <rect x="63" y="66" width="14" height="16" rx="5" fill="${PR.skin}"/>
        <rect x="63" y="72" width="14" height="4" fill="rgba(0,0,0,0.14)"/>
        <ellipse cx="70" cy="52" rx="16.5" ry="19" fill="${PR.skin}"/>
        <ellipse cx="53.6" cy="54" rx="2.6" ry="3.8" fill="${PR.skin}"/><ellipse cx="86.4" cy="54" rx="2.6" ry="3.8" fill="${PR.skin}"/>
        <circle cx="53.4" cy="59.4" r="1.3" fill="${PR.cream}"/><circle cx="86.6" cy="59.4" r="1.3" fill="${PR.cream}"/>
        <path d="M53.5 49 Q52 30 70 29 Q88 30 86.5 49 Q84 38.5 75 36.5 Q66 40.5 58 38.5 Q55 42.5 53.5 49 Z" fill="${PR.hair}"/>
        <path d="M63 31.5 Q60 36 58.6 40.4" stroke="${PR.cream}" stroke-width="2" fill="none" stroke-linecap="round"/>
        <circle cx="58" cy="61" r="3.2" fill="#ff8f8f" opacity="0.3"/><circle cx="82" cy="61" r="3.2" fill="#ff8f8f" opacity="0.3"/>
        ${PR_EYES[m]}
        <path d="${PR_BROWS[m]}" stroke="#5a3418" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <circle cx="63" cy="53.4" r="6.2" fill="rgba(255,255,255,0.08)" stroke="${PR.frame}" stroke-width="1.6"/><circle cx="77" cy="53.4" r="6.2" fill="rgba(255,255,255,0.08)" stroke="${PR.frame}" stroke-width="1.6"/>
        <path d="M69.2 52.6 Q70 51.6 70.8 52.6" stroke="${PR.frame}" stroke-width="1.4" fill="none"/>
        <path d="M60 50 Q61.5 48.6 63.6 48.6" stroke="#fff" stroke-opacity="0.4" stroke-width="0.9" fill="none"/>
        <path d="M69 58.5 Q70 59.4 71 58.5" stroke="rgba(0,0,0,0.25)" stroke-width="1.1" fill="none" stroke-linecap="round"/>
        ${mouth}
        <path d="M85.5 26.5 L90.6 30.6 L88.8 36.8 L82.4 36.8 L80.4 30.6 Z" fill="#b48cff" stroke="#efe6ff" stroke-width="0.8"/>
        <path d="M85.5 26.5 L85.5 36.8 M80.4 30.6 L90.6 30.6" stroke="#efe6ff" stroke-width="0.5" opacity="0.7"/>
      </g>
      <circle cx="70" cy="58" r="50" fill="none" stroke="#e8a93a" stroke-opacity="0.55" stroke-width="1.6"/>
    </svg>`;
  }

  // ---------- CAIRN: a small stack of singing stones ----------
  // Three rounded basalt stones. The big middle one is split open like a geode:
  // its crystal eyes and a row of crystal "teeth" glow, in a colour that follows
  // the mood. Two pebble hands float beside it (the right one carries a small
  // spanner). Music notes rise when it talks. Original design.
  const CAIRN_GLOW = { neutral: '#7fe8d8', deadpan: '#7fe8d8', happy: '#ffd27a', proud: '#ffd27a', wink: '#ffd27a', thinking: '#9fb8ff', worried: '#8fa0d8', sad: '#8196c8', surprised: '#b6f3ff' };
  // Hand centres [lx, ly, rx, ry].
  const CAIRN_HANDS = { neutral: [33, 70, 107, 70], deadpan: [35, 74, 105, 74], happy: [28, 52, 112, 52], proud: [33, 70, 110, 36], thinking: [33, 72, 92, 70], worried: [56, 84, 84, 84], sad: [38, 84, 102, 84], surprised: [26, 42, 114, 42], wink: [33, 70, 112, 44] };
  // The geode face in its own coordinates (centre 70, 58). Returns SVG markup.
  function cairnFace(m, talking, glow) {
    const eye = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * 0.75} ${y} L${x} ${y + r} L${x - r * 0.75} ${y} Z" fill="${glow}"/>`;
    const arc = (x, y, up) => `<path d="M${x - 3.4} ${y} Q${x} ${y + (up ? -4 : 4)} ${x + 3.4} ${y}" stroke="${glow}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    const bar = (x, y) => `<path d="M${x - 3.4} ${y} H${x + 3.4}" stroke="${glow}" stroke-width="2" stroke-linecap="round"/>`;
    let eyes = '';
    if (m === 'happy' || m === 'proud') eyes = arc(63, 55, true) + arc(77, 55, true);
    else if (m === 'deadpan') eyes = bar(63, 54) + bar(77, 54);
    else if (m === 'wink') eyes = eye(63, 54, 3.4) + arc(77, 55, true);
    else if (m === 'surprised') eyes = eye(63, 53, 4.6) + eye(77, 53, 4.6);
    else if (m === 'thinking') eyes = eye(64.5, 52, 3) + eye(78.5, 52, 3);
    else if (m === 'sad') eyes = eye(63, 56, 2.6) + eye(77, 56, 2.6);
    else if (m === 'worried') eyes = eye(63, 54, 3) + eye(77, 54, 3) + `<path d="M59.5 48.5 L66 50.5 M80.5 48.5 L74 50.5" stroke="${glow}" stroke-width="1.3" stroke-linecap="round"/>`;
    else eyes = eye(63, 54, 3.4) + eye(77, 54, 3.4);
    // The mouth: a row of little crystal points.
    let mouth;
    if (talking) mouth = `<path d="M64 63 L67 61 L70 67.5 L73 61 L76 63 L73 66 L70 69.5 L67 66 Z" fill="${glow}" opacity="0.9"/>`;
    else if (m === 'happy' || m === 'proud' || m === 'wink') mouth = `<path d="M63.5 62 L66.5 65.5 L70 63.5 L73.5 65.5 L76.5 62 L73.5 67 L70 68 L66.5 67 Z" fill="${glow}"/>`;
    else if (m === 'sad' || m === 'worried') mouth = `<path d="M64.5 66.5 L67.5 63.6 L70 64.6 L72.5 63.6 L75.5 66.5" stroke="${glow}" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`;
    else if (m === 'surprised') mouth = `<path d="M70 61.5 L72.6 65 L70 68.5 L67.4 65 Z" fill="${glow}"/>`;
    else if (m === 'thinking') mouth = `<path d="M67 65 L70 64 L73 65.2 L76 63.6" stroke="${glow}" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`;
    else mouth = `<path d="M65 64 L67.5 65.6 L70 64.4 L72.5 65.6 L75 64" stroke="${glow}" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`;
    return eyes + mouth;
  }
  function cairnPortrait(mood, opts = {}) {
    const m = moodOf(mood);
    const size = opts.size || 96;
    const id = `cf${++uid}`;
    const glow = CAIRN_GLOW[m];
    const H = CAIRN_HANDS[m];
    const notes = opts.talking ? `<g fill="${glow}" font-family="serif" font-size="13" opacity="0.9"><text x="104" y="24">♪</text><text x="116" y="36" font-size="10">♫</text></g>` : '';
    const spanner = `<g transform="translate(${H[2]} ${H[3]}) rotate(-35)"><rect x="-1.4" y="-15" width="2.8" height="11" rx="1" fill="#c9ced8"/><path d="M-4 -19 A4 4 0 1 1 4 -19 L2 -17 L1 -20 L-1 -20 L-2 -17 Z" fill="#c9ced8"/></g>`;
    return `<svg class="tf-kilo-svg tf-guide-cairn" viewBox="0 0 140 112" width="${size}" height="${Math.round(size * 0.8)}" role="img" aria-label="CAIRN" data-mood="${m}">
      <defs>
        <radialGradient id="${id}r" cx="0.38" cy="0.3" r="0.8"><stop offset="0" stop-color="#8e8781"/><stop offset="0.6" stop-color="#5f5853"/><stop offset="1" stop-color="#3d3835"/></radialGradient>
        <radialGradient id="${id}g" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="#2a1f45"/><stop offset="1" stop-color="#120d22"/></radialGradient>
        <radialGradient id="${id}h" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${glow}" stop-opacity="0.45"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse class="tf-kilo-glow" cx="70" cy="104" rx="34" ry="6" fill="url(#${id}h)"/>
      <path d="M40 96 Q38 82 56 80 L86 80 Q103 82 100 96 Q96 104 70 104 Q44 104 40 96 Z" fill="url(#${id}r)"/>
      <path d="M44 34 Q40 58 46 74 Q54 88 72 86 Q94 86 99 70 Q104 52 96 38 Q86 26 70 27 Q52 26 44 34 Z" fill="url(#${id}r)"/>
      <path d="M54 22 Q52 12 62 9 Q72 6 80 10 Q88 14 85 23 Q80 30 69 30 Q57 29 54 22 Z" fill="url(#${id}r)"/>
      <path d="M58 13 Q64 10 70 10.5" stroke="#b5aea8" stroke-opacity="0.5" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M49 40 Q52 34 58 32" stroke="#b5aea8" stroke-opacity="0.4" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M52 58 Q51 45 61 43 L70 41 L80 43 Q90 46 89 58 Q90 70 80 73 L70 75 L59 73 Q51 70 52 58 Z" fill="url(#${id}g)" stroke="#2b2622" stroke-width="1.4"/>
      <path d="M55 47 L58 44 L59 49 Z M83 44.5 L86 48 L82 49 Z M55 69 L58 66 L59.5 71 Z M84 67 L86.5 70 L82.5 71.5 Z" fill="${glow}" opacity="0.45"/>
      ${cairnFace(m, !!opts.talking, glow)}
      <ellipse cx="${H[0]}" cy="${H[1]}" rx="7" ry="6" fill="url(#${id}r)"/>
      ${spanner}
      <ellipse cx="${H[2]}" cy="${H[3]}" rx="7" ry="6" fill="url(#${id}r)"/>
      ${notes}
    </svg>`;
  }
  // CAIRN's geode face on a canvas (the 3D model's face disc).
  function drawCairnFace(c, mood, w, h, talking) {
    const m = moodOf(mood);
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#16102a';
    c.beginPath();
    c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    c.fill();
    const glow = CAIRN_GLOW[m];
    // Draw the SVG face shapes with Path2D, scaled from the 40 x 34 face box.
    const k = Math.min(w / 40, h / 34);
    const svg = cairnFace(m, talking, glow);
    c.save();
    c.translate(w / 2 - 70 * k, h / 2 - 58 * k);
    c.scale(k, k);
    c.shadowColor = glow;
    c.shadowBlur = 3;
    const re = /<path d="([^"]+)"([^>]*)\/>/g;
    let hit;
    while ((hit = re.exec(svg))) {
      const path = new Path2D(hit[1]);
      const attrs = hit[2];
      const sw = /stroke-width="([\d.]+)"/.exec(attrs);
      if (/fill="none"/.test(attrs) || (/stroke=/.test(attrs) && !/fill=/.test(attrs))) {
        c.strokeStyle = glow;
        c.lineWidth = sw ? Number(sw[1]) : 1.6;
        c.lineCap = 'round';
        c.stroke(path);
      } else {
        c.fillStyle = glow;
        c.fill(path);
      }
    }
    c.restore();
  }

  // The chosen guide's portrait (opts.guide picks another one).
  function portrait(mood, opts = {}) {
    const g = isGuide(opts.guide) ? opts.guide : current();
    if (g === 'brace') return bracePortrait(mood, opts);
    if (g === 'praline') return pralinePortrait(mood, opts);
    if (g === 'cairn') return cairnPortrait(mood, opts);
    return kiloPortrait(mood, opts);
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
  function kiloScript(missionId, momentId, params) {
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

  // ---------- The guides ----------
  const GUIDE_IDS = ['kilo', 'brace', 'praline', 'cairn'];
  const GUIDE_INFO = {
    kilo: { name: 'KILO', role: 'Box robot', blurb: 'Small, floating and deadpan. Humour setting: 40%.' },
    brace: { name: 'BRACE', role: 'Survey robot', blurb: 'Tall, steady and dry as dust. Retired from the lunar survey corps.' },
    praline: { name: 'Dr. Praline', role: 'Royal Scientist of Caramoon', blurb: 'Cheerful and curious. Sees an experiment in everything.' },
    cairn: { name: 'CAIRN', role: 'Singing stone from Echo Hollow', blurb: 'An engineer made of rock. Hums when happy. Loves fixing things.' },
  };
  const GUIDE_KEY = 'ek-guide';
  const isGuide = (id) => GUIDE_IDS.includes(id);
  function current() {
    try {
      const v = globalThis.localStorage && localStorage.getItem(GUIDE_KEY);
      return isGuide(v) ? v : 'kilo';
    } catch (e) {
      return 'kilo';
    }
  }
  function setCurrent(id) {
    if (!isGuide(id)) return current();
    try {
      localStorage.setItem(GUIDE_KEY, id);
    } catch (e) {}
    if (SMD.bus && SMD.bus.emit) SMD.bus.emit('guide', { id });
    return id;
  }
  function info(id) {
    const g = isGuide(id) ? id : current();
    const I = GUIDE_INFO[g];
    return { id: g, name: t(`guide.${g}.name`, I.name), role: t(`guide.${g}.role`, I.role), blurb: t(`guide.${g}.blurb`, I.blurb) };
  }
  const list = () => GUIDE_IDS.map(info);
  const nameOf = (id) => info(id).name;

  // Lines for one guide. KILO uses its own tables (above); the others use theirs,
  // then KILO's mission facts, then KILO itself, so no moment is ever empty.
  function scriptFor(missionId, momentId, params, guideId) {
    const gid = isGuide(guideId) ? guideId : current();
    const By = SMD.team.guideLinesBy || {};
    const G = gid === 'kilo' ? null : By[gid];
    if (!G || !G.any) return kiloScript(missionId, momentId, params);
    const K = lines();
    const moment = resolveMoment(momentId);
    const okKey = (L, k) => !!k && k !== 'ALIAS' && k !== 'any' && !!L[k];
    const mission = okKey(G, missionId) || okKey(K, missionId) ? missionId : null;
    const own = (where, mo, src) => src.map(([mood, text], i) => ({ id: `guide.${gid}.${where}.${mo}.${i}`, mood, text: t(`guide.${gid}.${where}.${mo}.${i}`, text, params) }));
    const kilos = (where, mo, src) => src.map(([mood, text], i) => ({ id: `guide.${where}.${mo}.${i}`, mood, text: t(`guide.${where}.${mo}.${i}`, text, params) }));
    if (mission && G[mission] && G[mission][moment]) return own(mission, moment, G[mission][moment]);
    if (moment === 'briefing' && mission && K[mission] && K[mission].briefing && G.any.hello) {
      const facts = K[mission].briefing.slice(1, 3).map(([, text], i) => ({ id: `guide.${mission}.briefing.${i + 1}`, mood: i ? 'thinking' : 'neutral', text: t(`guide.${mission}.briefing.${i + 1}`, text, params) }));
      const closeFrom = G[mission] && G[mission]['briefing.close'] ? mission : 'any';
      return own('any', 'hello', G.any.hello).concat(facts, own(closeFrom, 'briefing.close', G[closeFrom]['briefing.close'] || G.any['briefing.close'] || []));
    }
    if (moment.startsWith('step.') && mission && K[mission] && K[mission][moment]) return kilos(mission, moment, K[mission][moment]);
    if (G.any[moment]) return own('any', moment, G.any[moment]);
    if (moment.startsWith('step.') && G.any['step.other'] && !(K.any && K.any[moment])) return own('any', 'step.other', G.any['step.other']);
    return kiloScript(missionId, momentId, params);
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
    if (current_) current_.refreshMute();
  }

  // ---------- say() ----------
  let current_ = null; // the guide on screen now
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
    if (current_) current_.destroy();
    const gid = isGuide(opts.guide) ? opts.guide : current();
    const gname = nameOf(gid);
    const host = target && target.nodeType === 1 ? target : document.body;
    const corner = /start/.test(opts.corner || '') ? 'start' : 'end';
    const top = /top/.test(opts.corner || '');
    const el = document.createElement('div');
    el.className = `tf-kilo tf-kilo-${corner}${top ? ' tf-kilo-top' : ''}${opts.inline ? ' tf-kilo-inline' : ''}`;
    el.dataset.guide = gid;
    el.innerHTML = `<button type="button" class="tf-kilo-bot" data-bot></button>
      <div class="tf-kilo-bubble" data-bubble role="status" aria-live="polite">
        <p class="tf-kilo-who">${esc(gname)}</p>
        <p class="tf-kilo-text" data-text></p>
        <div class="tf-kilo-foot"><span class="tf-kilo-count" data-count></span><button type="button" class="tf-kilo-mute" data-mute>${esc(gid === 'kilo' ? t('guide.mute', 'Mute KILO') : t('guide.mute.any', 'Mute {name}', { name: gname }))}</button><span class="tf-kilo-next" data-next></span></div>
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
      bot.innerHTML = portrait(mood, { size: opts.size || (globalThis.innerWidth < 600 ? 84 : 124), talking: talkOpen, guide: gid });
      const k = gid === 'kilo';
      bot.setAttribute('aria-label', state === 'talk' ? gname : muted() ? (k ? t('guide.unmute', 'KILO is muted. Click to hear KILO again.') : t('guide.unmute.any', '{name} is muted. Click to hear {name} again.', { name: gname })) : k ? t('guide.replay', 'KILO: click to hear that again') : t('guide.replay.any', '{name}: click to hear that again', { name: gname }));
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
      if (current_ === handle) current_ = null;
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
    current_ = handle;
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
    if (current_) current_.destroy();
  }

  // ---------- The guide picker (setup step and Settings) ----------
  // Three calm cards; picking one saves it and the guide says hello in place.
  function picker(el, opts = {}) {
    if (typeof document === 'undefined' || !el) return { destroy() {} };
    const box = document.createElement('div');
    box.className = `tf-guides${opts.compact ? ' tf-guides-compact' : ''}`;
    const size = opts.compact ? 72 : 112;
    const draw = () => {
      const cur = current();
      const hello = scriptFor(null, 'hello', null, cur)[0] || scriptFor(null, 'briefing', null, cur)[0] || { text: '', mood: 'happy' };
      box.innerHTML = `<div class="tf-guides-row" role="radiogroup" aria-label="${esc(t('guide.pick', 'Choose your guide'))}">${list()
        .map(
          (g) => `<button type="button" class="tf-guide-card${g.id === cur ? ' on' : ''}" role="radio" aria-checked="${g.id === cur}" data-guide="${g.id}">
            <span class="tf-guide-face">${portrait(g.id === cur ? 'happy' : 'neutral', { size, guide: g.id })}</span>
            <b class="tf-guide-name">${esc(g.name)}</b><small class="tf-guide-role">${esc(g.role)}</small>
            ${opts.compact ? '' : `<span class="tf-guide-blurb">${esc(g.blurb)}</span>`}
          </button>`
        )
        .join('')}</div>
        <p class="tf-guide-hello" aria-live="polite"><b>${esc(nameOf(cur))}</b> ${esc(hello.text)}</p>`;
    };
    const onClick = (e) => {
      const b = e.target.closest('[data-guide]');
      if (!b) return;
      setCurrent(b.dataset.guide);
      try {
        if (SMD.audio && SMD.audio.beep) SMD.audio.beep(660, 0.06, 'sine', 0.05);
      } catch (err) {}
      draw();
      const again = box.querySelector(`[data-guide="${b.dataset.guide}"]`);
      if (again) again.focus();
      if (typeof opts.onPick === 'function') opts.onPick(b.dataset.guide);
    };
    const onKey = (e) => {
      if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      const ids = GUIDE_IDS;
      const rtl = SMD.dir && SMD.dir() === 'rtl';
      const step = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (rtl && e.key === 'ArrowLeft' ? 1 : -1) : rtl && e.key === 'ArrowRight' ? -1 : 1;
      const i = (ids.indexOf(current()) + step + ids.length) % ids.length;
      e.preventDefault();
      setCurrent(ids[i]);
      draw();
      const again = box.querySelector(`[data-guide="${ids[i]}"]`);
      if (again) again.focus();
      if (typeof opts.onPick === 'function') opts.onPick(ids[i]);
    };
    box.addEventListener('click', onClick);
    box.addEventListener('keydown', onKey);
    draw();
    el.appendChild(box);
    return {
      el: box,
      refresh: draw,
      destroy() {
        box.removeEventListener('click', onClick);
        box.removeEventListener('keydown', onKey);
        box.remove();
      },
    };
  }

  SMD.team.guide = {
    say,
    sayMoment,
    scriptFor,
    verdict,
    verdictKind,
    muted,
    setMuted,
    clear,
    portrait,
    drawFace,
    drawBraceFace,
    drawCairnFace,
    faceRows,
    MOODS,
    GLOW,
    GUIDES: GUIDE_IDS,
    list,
    info,
    current,
    setCurrent,
    name: nameOf,
    picker,
    kiloPortrait,
    bracePortrait,
    pralinePortrait,
    cairnPortrait,
  };
})();
