// Choice cards, confirms and toasts, plus the review board's portraits.
// SMD.cards.event(projectId, eventId) -> Promise<{choiceId, notes}>
// SMD.cards.confirm(title, text, opts) -> Promise<boolean>
// SMD.cards.toast(text, tone)
// SMD.cards.portrait(who, mood) -> SVG string ('science'|'systems'|'budget'|'safety', 'neutral'|'concerned'|'pleased')
// SMD.cards.effects(fx, project, extra) -> [{tone, icon, text}] plain-word consequences
(function () {
  const SMD = globalThis.SMD;
  const t = (k, e, p) => SMD.t(k, e, p);
  const esc = (s) => SMD.ui.esc(s == null ? '' : s);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- Board members ----------
  // Invented people, drawn like embroidered patches: flat shapes, a stitched rim.
  const MEMBERS = {
    science: {
      who: 'science',
      name: () => t('cards.member.science.name', 'Dr. Nadia Rahman'),
      role: () => t('cards.member.science.role', 'Science lead'),
      bg: '#cfe6e1',
      skin: '#b9825a',
      shade: '#99653f',
      brow: '#2a1f1a',
      mouth: '#5a2a22',
      back: `<path d="M38 56 C36 34 46 27 60 27 C74 27 84 34 82 56 C83 66 86 74 90 84 L87 100 C74 106 46 106 33 100 L30 84 C34 74 37 66 38 56 Z" fill="#17807a"/>`,
      body: `<path d="M10 124 C12 96 32 86 60 86 C88 86 108 96 110 124 Z" fill="#f4f6f3"/>
        <path d="M44 88 L54 124 M76 88 L66 124" stroke="#c9d2cc" stroke-width="1.6" fill="none"/>
        <rect x="70" y="102" width="11" height="3" rx="1.5" fill="#d9a21b"/>`,
      neck: '',
      front: `<path d="M37 64 C41 86 79 86 83 64 L86 97 C74 104 46 104 34 97 Z" fill="#17807a"/>
        <path d="M60 78 C66 88 74 94 82 96" stroke="#11635e" stroke-width="1.5" fill="none"/>
        <path d="M42 41 C47 32 73 32 78 41" stroke="#11635e" stroke-width="1.4" fill="none" opacity="0.6"/>`,
      face: { rx: 15.5, ry: 18.5, cy: 53 },
      ears: false,
      hair: '',
      extra: '',
    },
    systems: {
      who: 'systems',
      name: () => t('cards.member.systems.name', 'Wei Chen'),
      role: () => t('cards.member.systems.role', 'Systems engineer'),
      bg: '#d5dfea',
      skin: '#eac6a0',
      shade: '#cfa47c',
      brow: '#1e2328',
      mouth: '#6b3328',
      back: '',
      body: `<path d="M10 124 C12 96 32 86 60 86 C88 86 108 96 110 124 Z" fill="#2e4a6e"/>
        <path d="M48 86 L60 98 L72 86 L68 84 L60 92 L52 84 Z" fill="#e9eef2"/>
        <rect x="74" y="100" width="12" height="9" rx="1" fill="none" stroke="#5a7aa3" stroke-width="1.2"/>
        <rect x="77" y="94" width="2.4" height="12" rx="1" fill="#d9a21b"/><rect x="81" y="96" width="2.4" height="10" rx="1" fill="#e9eef2"/>`,
      neck: true,
      front: '',
      face: { rx: 16.5, ry: 19.5, cy: 52 },
      ears: true,
      hair: `<path d="M42 52 C38 30 54 23 66 26 C80 28 84 40 79 52 C77 43 72 38 63 38 C56 38 50 41 47 37 C45 42 43 46 42 52 Z" fill="#1e2328"/>`,
      extra: `<g fill="rgba(255,255,255,0.22)" stroke="#23282e" stroke-width="1.7">
          <rect x="46.5" y="47" width="13" height="10.5" rx="4"/><rect x="60.5" y="47" width="13" height="10.5" rx="4"/></g>
        <path d="M59.5 51 h1" stroke="#23282e" stroke-width="1.7"/>
        <path d="M46.5 50 L43.5 49 M73.5 50 L76.5 49" stroke="#23282e" stroke-width="1.5"/>`,
    },
    budget: {
      who: 'budget',
      name: () => t('cards.member.budget.name', 'Samuel Owusu'),
      role: () => t('cards.member.budget.role', 'Budget officer'),
      bg: '#efe3c2',
      skin: '#6e4630',
      shade: '#53321f',
      brow: '#d5d7da',
      mouth: '#2a1710',
      back: '',
      body: `<path d="M10 124 C12 96 32 86 60 86 C88 86 108 96 110 124 Z" fill="#c99a2e"/>
        <path d="M48 86 L60 112 L72 86 Z" fill="#f4f6f3"/>
        <path d="M57 92 L63 92 L64.5 112 L60 117 L55.5 112 Z" fill="#b4302c"/>
        <path d="M48 86 L58 108 M72 86 L62 108" stroke="#a37a1d" stroke-width="1.6"/>
        <circle cx="56" cy="114" r="1.2" fill="#7a5a0c"/><circle cx="56" cy="120" r="1.2" fill="#7a5a0c"/>`,
      neck: true,
      front: '',
      face: { rx: 16.5, ry: 19.5, cy: 52 },
      ears: true,
      hair: `<path d="M43.5 47 C43 33 52 29.5 60 29.5 C68 29.5 77 33 76.5 47 C74 39 68 36 60 36 C52 36 46 39 43.5 47 Z" fill="#c9ccd0"/>`,
      extra: `<path d="M44 55 C45 70 52 74.5 60 74.5 C68 74.5 75 70 76 55 C74 63 71 67 66 66.5 C63 64.5 57 64.5 54 66.5 C49 67 46 63 44 55 Z" fill="#c9ccd0"/>
        <path d="M53.5 61.2 C56 59.2 64 59.2 66.5 61.2 C64 62.4 56 62.4 53.5 61.2 Z" fill="#c9ccd0"/>`,
    },
    safety: {
      who: 'safety',
      name: () => t('cards.member.safety.name', 'Maren Holt'),
      role: () => t('cards.member.safety.role', 'Mission assurance'),
      bg: '#f0d6d2',
      skin: '#f2cfb6',
      shade: '#d9ab8a',
      brow: '#8a3a22',
      mouth: '#8b3a2e',
      back: `<circle cx="60" cy="25" r="9" fill="#a4472a"/><path d="M41 56 C38 70 42 78 46 80 L48 58 Z M79 56 C82 70 78 78 74 80 L72 58 Z" fill="#a4472a"/>`,
      body: `<path d="M10 124 C12 96 32 86 60 86 C88 86 108 96 110 124 Z" fill="#b4302c"/>
        <path d="M14 108 C30 104 90 104 106 108 L106 114 C90 110 30 110 14 114 Z" fill="#e9eef2" opacity="0.92"/>
        <path d="M50 86 L60 96 L70 86" stroke="#7f1f1c" stroke-width="2" fill="none"/>
        <path d="M54 92 L58 118 M66 92 L62 118" stroke="#d9a21b" stroke-width="1.4"/>
        <rect x="55" y="116" width="10" height="7" rx="1" fill="#f4f6f3"/>`,
      neck: true,
      front: '',
      face: { rx: 16, ry: 19.5, cy: 52.5 },
      ears: true,
      hair: `<path d="M43 52 C40 30 54 27 60 28 C70 28 81 33 77 52 C75 41 69 36.5 61 37 C55 38 52 42 47 42 C45 45 44 48 43 52 Z" fill="#a4472a"/>
        <path d="M45 36.5 C50 31 70 31 75 36.5" stroke="#d9a21b" stroke-width="2.6" fill="none"/>
        <rect x="47" y="32.5" width="11" height="5.5" rx="2.4" fill="rgba(233,238,242,0.75)" stroke="#d9a21b" stroke-width="1.3"/>
        <rect x="62" y="32.5" width="11" height="5.5" rx="2.4" fill="rgba(233,238,242,0.75)" stroke="#d9a21b" stroke-width="1.3"/>`,
      extra: `<g fill="#c8805e" opacity="0.7"><circle cx="50" cy="58" r="0.9"/><circle cx="52.5" cy="59.5" r="0.9"/><circle cx="49" cy="60.6" r="0.8"/>
        <circle cx="70" cy="58" r="0.9"/><circle cx="67.5" cy="59.5" r="0.9"/><circle cx="71" cy="60.6" r="0.8"/></g>`,
    },
  };
  const ORDER = ['science', 'systems', 'budget', 'safety'];

  // Brows, eyes and mouth for each mood, drawn over the face.
  function moods(m) {
    const cy = m.face.cy;
    const ey = cy + 0.5; // eye line
    const by = ey - 7; // brow line
    const my = cy + 10.5; // mouth line
    const brow = (d) => `<path d="${d}" stroke="${m.brow}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    const dots = `<g class="card-eyes"><ellipse cx="53.5" cy="${ey}" rx="2" ry="2.5" fill="#23282e"/><ellipse cx="66.5" cy="${ey}" rx="2" ry="2.5" fill="#23282e"/>
      <circle cx="54.2" cy="${ey - 0.9}" r="0.6" fill="#fff"/><circle cx="67.2" cy="${ey - 0.9}" r="0.6" fill="#fff"/></g>`;
    const neutral = `<g class="card-mood card-mood-neutral">${brow(`M48.5 ${by + 0.5} Q53 ${by - 1.5} 57.5 ${by}`)}${brow(`M62.5 ${by} Q67 ${by - 1.5} 71.5 ${by + 0.5}`)}${dots}
      <path d="M56 ${my} Q60 ${my + 1.2} 64 ${my}" stroke="${m.mouth}" stroke-width="1.9" stroke-linecap="round" fill="none"/></g>`;
    const concerned = `<g class="card-mood card-mood-concerned">${brow(`M48.5 ${by + 0.5} Q53 ${by} 57.5 ${by - 2.5}`)}${brow(`M62.5 ${by - 2.5} Q67 ${by} 71.5 ${by + 0.5}`)}${dots}
      <path d="M55.5 ${my + 1.5} Q60 ${my - 1.6} 64.5 ${my + 1.5}" stroke="${m.mouth}" stroke-width="1.9" stroke-linecap="round" fill="none"/>
      <path d="M57.5 ${by - 5} q2.5 1 5 0" stroke="${m.shade}" stroke-width="1" fill="none" stroke-linecap="round"/></g>`;
    const pleased = `<g class="card-mood card-mood-pleased">${brow(`M48.5 ${by} Q53 ${by - 3.5} 57.5 ${by - 1}`)}${brow(`M62.5 ${by - 1} Q67 ${by - 3.5} 71.5 ${by}`)}
      <path d="M51 ${ey + 1} Q53.5 ${ey - 2.6} 56 ${ey + 1} M64 ${ey + 1} Q66.5 ${ey - 2.6} 69 ${ey + 1}" stroke="#23282e" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M53.5 ${my - 1.5} Q60 ${my + 6.5} 66.5 ${my - 1.5} Q60 ${my + 1} 53.5 ${my - 1.5} Z" fill="${m.mouth}"/>
      <circle cx="48.5" cy="${my - 3}" r="3" fill="#e0565a" opacity="0.18"/><circle cx="71.5" cy="${my - 3}" r="3" fill="#e0565a" opacity="0.18"/></g>`;
    return neutral + concerned + pleased;
  }

  let faceSeq = 0;
  function portrait(who, mood) {
    const m = MEMBERS[who] || MEMBERS.systems;
    const id = `cardface${++faceSeq}`;
    const f = m.face;
    const label = `${m.name()}, ${m.role()}`;
    return `<svg class="card-face" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}" data-mood="${esc(mood || 'neutral')}" data-who="${esc(m.who)}">
      <defs><clipPath id="${id}"><circle cx="60" cy="60" r="55"/></clipPath></defs>
      <circle cx="60" cy="60" r="59.5" fill="#23282e"/>
      <circle cx="60" cy="60" r="55" fill="${m.bg}"/>
      <g clip-path="url(#${id})">
        <path d="M0 96 H120 M0 72 H120 M24 0 V120 M96 0 V120" stroke="rgba(35,40,46,0.07)" stroke-width="1"/>
        <g transform="translate(60 64) scale(1.14) translate(-60 -64)">
        ${m.back}
        ${m.body}
        ${m.neck ? `<path d="M52 66 L52 84 C55 89 65 89 68 84 L68 66 Z" fill="${m.shade}"/>` : ''}
        ${m.front}
        ${m.ears ? `<ellipse cx="${60 - f.rx}" cy="${f.cy + 1.5}" rx="3" ry="4.6" fill="${m.shade}"/><ellipse cx="${60 + f.rx}" cy="${f.cy + 1.5}" rx="3" ry="4.6" fill="${m.shade}"/>` : ''}
        <ellipse cx="60" cy="${f.cy}" rx="${f.rx}" ry="${f.ry}" fill="${m.skin}"/>
        <path d="M60 ${f.cy + 1.5} q-2.4 4.6 0.4 5.4" stroke="${m.shade}" stroke-width="1.5" stroke-linecap="round" fill="none"/>
        ${m.hair}
        ${m.extra}
        ${moods(m)}
        </g>
      </g>
      <circle cx="60" cy="60" r="57.3" fill="none" stroke="#d9a21b" stroke-width="1.3" stroke-dasharray="2.4 1.8"/>
    </svg>`;
  }

  function setMood(root, mood) {
    if (root) root.setAttribute('data-mood', mood);
  }

  // ---------- Consequences in plain words ----------
  const ICONS = {
    money: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 5.6c-.5-.7-1.3-1-2.1-1-1.1 0-2 .6-2 1.5 0 2.1 4.3 1.1 4.3 3.4 0 .9-1 1.6-2.2 1.6-.9 0-1.8-.4-2.3-1.1M8 3.4v1.2M8 11.1v1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    time: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.4V8l2.6 1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    risk: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6.3v3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="11.9" r="0.95" fill="currentColor"/></svg>',
    science: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1.8h4M6.8 2v4.4L2.7 13a1 1 0 0 0 .9 1.3h8.8a1 1 0 0 0 .9-1.3L9.2 6.4V2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4.6 10.2h6.8" stroke="currentColor" stroke-width="1.4"/></svg>',
    rep: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    test: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.4 10.4 3.8 3.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    part: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="4.5" width="12" height="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 4.5v7M10 4.5v7" stroke="currentColor" stroke-width="1.2"/></svg>',
    none: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    launch: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5c2.2 1.8 3 4.4 2.6 8.3H5.4C5 5.9 5.8 3.3 8 1.5zM5.4 9.8 3.6 12l1.9.2M10.6 9.8l1.8 2.2-1.9.2M7 12.4h2l-1 2.2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  };

  const nameOf = (id) => {
    const D = SMD.data || {};
    if (D.INSTRUMENTS && D.INSTRUMENTS[id]) return t('inst.' + id, D.INSTRUMENTS[id].name);
    if (D.SUBSYSTEMS && D.SUBSYSTEMS[id]) return t('data.sub.' + id, D.SUBSYSTEMS[id].name);
    return String(id).replace(/[-_]/g, ' ');
  };
  const roundM = (x) => Math.round(Math.abs(x) * 10) / 10;

  // Would a slip of `months` push the project past its current launch window?
  function windowMiss(p, months) {
    const A = SMD.agency;
    const ag = SMD.game && SMD.game.agency;
    const D = SMD.data;
    if (!p || !months || !ag || !A || !D || !D.MISSIONS[p.missionKey] || D.MISSIONS[p.missionKey].kind !== 'planet' || p.status === 'flying' || p.status === 'done') return null;
    let wins;
    try {
      wins = A.nextWindows(ag, p.missionKey);
    } catch (e) {
      return null;
    }
    const pad = 32 * 864e5;
    const w = wins.find((x) => p.launchMs >= x.startMs - pad && p.launchMs <= x.endMs + pad);
    if (!w) return null;
    const ready = A.addMonths(Math.max(p.readyMs, ag.now), months);
    if (ready <= w.endMs) return null;
    const next = wins.find((x) => x.startMs > w.endMs);
    return { nextMs: next ? next.startMs : null };
  }

  // fx: effects object (GDD §9). p: the project (for the reserve). extra: {runTests, mod}.
  function effects(fx, p, extra) {
    const out = [];
    fx = fx || {};
    extra = extra || {};
    const reserveLeft = p ? Math.max(0, p.reserveLeft || 0) : 0;
    const spend = (cost) => {
      if (!p) return out.push({ tone: 'cost', icon: 'money', text: t('cards.fx.cost', '${m}M', { m: roundM(cost) }) });
      if (reserveLeft >= cost) return out.push({ tone: 'cost', icon: 'money', text: t('cards.fx.fromReserve', '${m}M from the reserve', { m: roundM(cost) }) });
      if (reserveLeft > 0.5)
        return out.push({ tone: 'bad', icon: 'money', text: t('cards.fx.overReserve', '${m}M: the reserve covers ${r}M, ${o}M is overrun', { m: roundM(cost), r: roundM(reserveLeft), o: roundM(cost - reserveLeft) }) });
      return out.push({ tone: 'bad', icon: 'money', text: t('cards.fx.overrun', '${m}M overrun (the reserve is empty)', { m: roundM(cost) }) });
    };
    if (fx.money < 0) spend(-fx.money);
    if (fx.money > 0) out.push({ tone: 'ok', icon: 'money', text: t('cards.fx.saves', 'Saves ${m}M', { m: roundM(fx.money) }) });
    if (fx.reserve) spend(Math.abs(fx.reserve));
    if (fx.months) {
      const n = Math.round(fx.months);
      out.push({ tone: 'warn', icon: 'time', text: n === 1 ? t('cards.fx.month', '1 month later') : t('cards.fx.months', '{n} months later', { n }) });
      const miss = windowMiss(p, fx.months);
      if (miss)
        out.push({
          tone: 'bad',
          icon: 'launch',
          text: miss.nextMs ? t('cards.fx.window', 'Misses the launch window. Next one: {month}', { month: SMD.agency.fmtMonth(miss.nextMs) }) : t('cards.fx.windowNone', 'Misses the launch window'),
        });
    }
    if (extra.mod && extra.mod.arrays) out.push({ tone: 'ok', icon: 'part', text: t('cards.fx.arrays', '+{n} solar panels', { n: extra.mod.arrays }) });
    if (extra.runTests === 'recheck') out.push({ tone: 'ok', icon: 'test', text: t('cards.fx.recheck', 'Thermal-vacuum and day-in-the-life tests rerun') });
    else if (extra.runTests) out.push({ tone: 'ok', icon: 'test', text: t('cards.fx.tests', 'Tests hunt for hidden flaws') });
    if (extra.runTests) out.push({ tone: 'cost', icon: 'money', text: t('cards.fx.fixes', 'Each flaw found costs a fix') });
    if (fx.rep > 0) out.push({ tone: 'ok', icon: 'rep', text: t('cards.fx.repUp', '+{n} reputation', { n: fx.rep }) });
    if (fx.rep < 0) out.push({ tone: 'bad', icon: 'rep', text: t('cards.fx.repDown', '−{n} reputation', { n: -fx.rep }) });
    if (fx.science > 0) out.push({ tone: 'ok', icon: 'science', text: t('cards.fx.sciUp', '+{n} science points', { n: fx.science }) });
    if (fx.science < 0) out.push({ tone: 'bad', icon: 'science', text: t('cards.fx.sciDown', '−{n} science points', { n: -fx.science }) });
    if (fx.scienceBoost && fx.scienceBoost !== 1) {
      const pct = Math.round((fx.scienceBoost - 1) * 100);
      out.push(pct > 0 ? { tone: 'ok', icon: 'science', text: t('cards.fx.boostUp', '+{n}% science', { n: pct }) } : { tone: 'warn', icon: 'science', text: t('cards.fx.boostDown', '−{n}% science', { n: -pct }) });
    }
    if (fx.hiddenFlaw) out.push({ tone: 'warn', icon: 'risk', text: t('cards.fx.flaw', 'Risk: a hidden flaw in {what}', { what: nameOf(fx.hiddenFlaw).toLowerCase() }) });
    if (fx.instrumentQuality)
      Object.entries(fx.instrumentQuality).forEach(([id, f]) =>
        out.push({ tone: f < 1 ? 'warn' : 'ok', icon: 'science', text: t('cards.fx.quality', '{what} works at {pct}%', { what: nameOf(id), pct: Math.round(f * 100) }) })
      );
    if (fx.dropInstrument) out.push({ tone: 'bad', icon: 'science', text: t('cards.fx.drop', 'Removes the {what}', { what: nameOf(fx.dropInstrument).toLowerCase() }) });
    if (!out.length) out.push({ tone: 'none', icon: 'none', text: t('cards.fx.none', 'No cost now') });
    return out;
  }

  function chipsHTML(list) {
    return `<ul class="card-fx">${list.map((c) => `<li class="card-chip is-${esc(c.tone)}">${ICONS[c.icon] || ''}<span dir="auto">${esc(c.text)}</span></li>`).join('')}</ul>`;
  }

  // ---------- Modal layer ----------
  const stack = [];
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  // Opens a dialog over everything; the rest of the page goes inert until it closes.
  function openModal({ html, label, className, onEscape }) {
    const prevFocus = document.activeElement;
    const layer = document.createElement('div');
    layer.className = 'card-layer';
    layer.innerHTML = `<div class="card-backdrop"></div>
      <div class="card-dialog ${className || ''}" role="dialog" aria-modal="true" aria-labelledby="${label}" tabindex="-1">${html}</div>`;
    const dialog = layer.querySelector('.card-dialog');
    const app = document.getElementById('app');
    const below = stack.length ? stack[stack.length - 1].layer : app;
    const wasInert = below ? below.inert : false;
    if (below) below.inert = true;
    document.body.appendChild(layer);
    document.body.classList.add('card-open');

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (onEscape) onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    layer.addEventListener('keydown', onKey);
    // Keep focus inside if something outside grabs it.
    function onFocusIn(e) {
      if (!layer.contains(e.target) && stack[stack.length - 1] === entry) dialog.focus();
    }
    document.addEventListener('focusin', onFocusIn);

    const entry = {
      layer,
      dialog,
      close() {
        const i = stack.indexOf(entry);
        if (i >= 0) stack.splice(i, 1);
        layer.removeEventListener('keydown', onKey);
        document.removeEventListener('focusin', onFocusIn);
        layer.classList.add('is-leaving');
        const done = () => layer.remove();
        if (reduced()) done();
        else setTimeout(done, 180);
        if (below) below.inert = wasInert;
        if (!stack.length) document.body.classList.remove('card-open');
        if (prevFocus && document.contains(prevFocus) && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      },
    };
    stack.push(entry);
    requestAnimationFrame(() => {
      const h = dialog.querySelector('[data-autofocus]') || dialog.querySelector('h2');
      if (h) {
        if (!h.matches(FOCUSABLE)) h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      } else dialog.focus();
    });
    return entry;
  }

  let uid = 0;

  // Phase names a teenager can follow.
  const PHASE = {
    A: () => t('cards.phase.A', 'Phase A · Concept'),
    B: () => t('cards.phase.B', 'Phase B · Preliminary design'),
    C: () => t('cards.phase.C', 'Phase C · Final design and build'),
    D: () => t('cards.phase.D', 'Phase D · Assembly and tests'),
    E: () => t('cards.phase.E', 'Phase E · Operations'),
  };

  const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

  // ---------- Event choice card ----------
  function event(projectId, eventId) {
    return new Promise((resolve) => {
      const ag = SMD.game && SMD.game.agency;
      const p = ag && ag.projects.find((x) => x.id === projectId);
      const list = (SMD.content && SMD.content.events) || [];
      const e = list.find((x) => x.id === eventId);
      const slot = p && (p.events || []).find((x) => x.id === eventId);
      if (!p || !e || !slot || slot.resolved) {
        // An event that no longer exists in the content would block the calendar forever.
        if (slot && !slot.resolved && !e) {
          slot.resolved = true;
          slot.choice = null;
          SMD.game.save();
        }
        resolve({ choiceId: (slot && slot.choice) || null, notes: [] });
        return;
      }
      const k = `content.events.${e.id}`;
      const id = `card-ev-${++uid}`;
      const story = e.realStory || null;
      const url = story && safeUrl(story.source);
      const phase = PHASE[slot.phase || e.phase] ? PHASE[slot.phase || e.phase]() : '';
      const choices = e.choices || [];
      const html = `
        <header class="card-head">
          <span class="card-kicker">${ICONS.risk}<span>${esc(phase)}</span></span>
          <span class="card-where">${esc(p.design.name)} · ${esc(SMD.ui.monthYear(ag.now))}</span>
        </header>
        <h2 id="${id}" class="card-title">${esc(t(`${k}.title`, e.title))}</h2>
        <p class="card-body">${esc(t(`${k}.body`, e.body || ''))}</p>
        ${story ? `<p class="card-teaser"><span aria-hidden="true">★</span>${esc(t('cards.teaser', 'This really happened to a NASA mission. Choose, then see how it went.'))}</p>` : ''}
        <p class="card-ask">${esc(t('cards.ask', 'Your call'))}</p>
        <div class="card-choices" role="group" aria-labelledby="${id}">
          ${choices
            .map(
              (c, i) => `<button type="button" class="card-choice" data-choice="${esc(c.id)}">
              <span class="card-choice-key" aria-hidden="true">${i + 1}</span>
              <span class="card-choice-label">${esc(t(`${k}.choice.${c.id}`, c.label))}</span>
              ${chipsHTML(effects(c.effects, p))}
            </button>`
            )
            .join('')}
        </div>
        <p class="card-hint" aria-live="assertive"></p>
        <div class="card-result" hidden></div>`;
      const storyHTML = story
        ? `<aside class="card-story" aria-label="${esc(t('cards.story.label', 'This really happened'))}">
            <p class="card-story-tag">${esc(t('cards.story.tag', 'This really happened'))}</p>
            <p class="card-story-mission"><b>${esc(t(`${k}.mission`, story.mission || ''))}</b>${story.year ? `<span>${esc(story.year)}</span>` : ''}</p>
            ${story.lesson ? `<p class="card-story-lesson"><b>${esc(t('cards.story.lesson', 'Lesson'))}</b> ${esc(t(`${k}.lesson`, story.lesson))}</p>` : ''}
            ${url ? `<a class="card-story-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t('cards.story.source', 'Read the source'))}<span class="card-sr"> ${esc(t('cards.newTab', '(opens in a new tab)'))}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3H3v10h10v-3M9 2.5h4.5V7M13.3 2.7 7.5 8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></a>` : ''}
          </aside>`
        : '';

      let decided = null;
      const modal = openModal({
        html,
        label: id,
        className: 'card-event',
        onEscape() {
          if (decided) return finish();
          nudge();
        },
      });
      const dlg = modal.dialog;
      const hint = dlg.querySelector('.card-hint');
      function nudge() {
        hint.textContent = t('cards.mustChoose', 'This needs a decision. Pick one of the options.');
        dlg.classList.remove('is-nudged');
        void dlg.offsetWidth;
        dlg.classList.add('is-nudged');
      }
      modal.layer.querySelector('.card-backdrop').addEventListener('click', () => (decided ? null : nudge()));

      dlg.querySelectorAll('[data-choice]').forEach((btn) =>
        btn.addEventListener('click', () => {
          if (decided) return;
          const c = choices.find((x) => x.id === btn.dataset.choice);
          const before = { launchMs: p.launchMs, missed: !!p.missedWindow, money: ag.money, reserveLeft: p.reserveLeft };
          const preview = effects(c.effects, p);
          const res = SMD.agency.resolveEvent(ag, p, e.id, c.id) || { notes: [] };
          decided = { choiceId: c.id, notes: res.notes || [] };
          SMD.game.save();
          if (SMD.bus) SMD.bus.emit('agency', ag);
          if (SMD.audio) SMD.audio.beep(740, 0.09, 'triangle', 0.16);
          hint.textContent = '';
          dlg.classList.add('is-decided');
          dlg.querySelectorAll('[data-choice]').forEach((b) => {
            b.disabled = true;
            b.classList.toggle('is-chosen', b === btn);
            if (b === btn) b.setAttribute('aria-pressed', 'true');
          });
          // What actually happened, including knock-on effects the agency reported.
          const lines = [];
          const notes = (res.notes || []).filter((n) => !(c.effects && c.effects.months && SMD.agency.isSlipNote(n)));
          notes.forEach((n) => lines.push({ tone: 'bad', text: n }));
          if (Math.abs(p.reserveLeft - before.reserveLeft) > 0.05)
            lines.push({
              tone: p.reserveLeft < p.reserve * 0.3 ? 'bad' : 'warn',
              text: t('cards.reserveNow', 'Project reserve: ${a}M → ${b}M of ${all}M', { a: Math.round(before.reserveLeft), b: Math.round(p.reserveLeft), all: Math.round(p.reserve) }),
            });
          if (p.launchMs !== before.launchMs)
            lines.push({ tone: p.missedWindow && !before.missed ? 'bad' : 'warn', text: t('cards.launchMoves', 'Launch moves to {month}', { month: SMD.agency.fmtMonth(p.launchMs) }) });
          const box = dlg.querySelector('.card-result');
          box.hidden = false;
          const teaser = dlg.querySelector('.card-teaser');
          if (teaser) teaser.remove();
          box.innerHTML = `<h3 class="card-result-title">${esc(t('cards.decided', 'Decision recorded'))}</h3>
            ${lines.length ? `<ul class="card-notes">${lines.map((l) => `<li class="tone ${l.tone}">${esc(l.text)}</li>`).join('')}</ul>` : ''}
            ${storyHTML}
            <div class="card-actions"><button type="button" class="btn primary" data-continue>${esc(t('cards.continue', 'Continue'))}</button></div>`;
          const cont = box.querySelector('[data-continue]');
          cont.addEventListener('click', finish);
          cont.focus({ preventScroll: false });
          box.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
        })
      );

      // Number keys pick an option, like the review board.
      modal.layer.addEventListener('keydown', (ev) => {
        if (decided || ev.altKey || ev.ctrlKey || ev.metaKey) return;
        const n = Number(ev.key);
        const btn = n >= 1 ? dlg.querySelectorAll('[data-choice]')[n - 1] : null;
        if (btn) {
          ev.preventDefault();
          btn.click();
        }
      });

      let finished = false;
      function finish() {
        if (finished || !decided) return;
        finished = true;
        modal.close();
        resolve(decided);
      }
    });
  }

  // ---------- Confirm ----------
  // opts: { ok, cancel, danger }
  function confirm(title, text, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const id = `card-cf-${++uid}`;
      const html = `<h2 id="${id}" class="card-title card-title-s">${esc(title)}</h2>
        ${text ? `<p class="card-body">${esc(text)}</p>` : ''}
        <div class="card-actions">
          <button type="button" class="btn ghost" data-no ${opts.danger ? 'data-autofocus' : ''}>${esc(opts.cancel || t('cards.cancel', 'Cancel'))}</button>
          <button type="button" class="btn ${opts.danger ? 'card-danger' : 'primary'}" data-yes ${opts.danger ? '' : 'data-autofocus'}>${esc(opts.ok || t('cards.ok', 'Confirm'))}</button>
        </div>`;
      let done = false;
      const modal = openModal({ html, label: id, className: 'card-confirm', onEscape: () => end(false) });
      function end(v) {
        if (done) return;
        done = true;
        modal.close();
        resolve(v);
      }
      modal.dialog.querySelector('[data-yes]').addEventListener('click', () => end(true));
      modal.dialog.querySelector('[data-no]').addEventListener('click', () => end(false));
      modal.layer.querySelector('.card-backdrop').addEventListener('click', () => end(false));
    });
  }

  // ---------- Toasts ----------
  let tray = null;
  function toast(text, tone) {
    if (!tray || !document.body.contains(tray)) {
      tray = document.createElement('div');
      tray.className = 'card-toasts';
      tray.setAttribute('role', 'status');
      tray.setAttribute('aria-live', 'polite');
      document.body.appendChild(tray);
    }
    const kind = ['ok', 'warn', 'bad', 'info'].includes(tone) ? tone : 'info';
    const el = document.createElement('div');
    el.className = `card-toast is-${kind}`;
    el.innerHTML = `<span class="card-toast-mark" aria-hidden="true">${{ ok: '✓', warn: '!', bad: '✕', info: 'i' }[kind]}</span><span>${esc(text)}</span>`;
    tray.appendChild(el);
    while (tray.children.length > 3) tray.firstElementChild.remove();
    const gone = () => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), reduced() ? 0 : 220);
    };
    const timer = setTimeout(gone, kind === 'bad' ? 6000 : 3800);
    el.addEventListener('click', () => {
      clearTimeout(timer);
      gone();
    });
    return el;
  }

  SMD.cards = Object.assign(SMD.cards || {}, {
    MEMBERS,
    ORDER,
    portrait,
    setMood,
    effects,
    chipsHTML,
    windowMiss,
    event,
    confirm,
    toast,
    openModal,
  });
})();
