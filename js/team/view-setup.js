// Mission Sprint v2 (docs/TEAM-V2.md): the setup views (lobby: room, difficulty,
// crew, destination; brief: KILO's briefing; design: the build, one part per step;
// questions (success criterion before design); lock: review and launch), the mission tracker and the pause menu
// every phase shares, and the kit of visual parts. Loads on the phone too, so it
// must not need three.js, SMD.ui or any screen-only code.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};
  const team = SMD.team;
  const views = (team.views = team.views || {});
  const kit = (team.kit = team.kit || {});

  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : e);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduced = () => {
    try {
      return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  };
  // Numbers and units stay left-to-right inside Arabic text.
  const ltr = (s) => (SMD.dir && SMD.dir() === 'rtl' ? `⁦${s}⁩` : s);

  // ---------- Roles and resources ----------
  const ROLES = ['planner', 'engineer', 'scientist', 'comms'];
  const ICON = {
    planner: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="19" r="3" fill="currentColor"/><path d="M6 15C9 7 15 4 22 3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="1 5"/><path d="m15 8 7-5-2 8z" fill="currentColor"/></svg>',
    engineer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 7a5.5 5.5 0 0 1-7.4 5.2L6 20a2.4 2.4 0 0 1-3.4-3.4l7.7-7.7A5.5 5.5 0 0 1 17 2.2l-3 3.2 1 3.3 3.3 1 3.1-3z" fill="currentColor"/></svg>',
    scientist: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2.5h6v2h-1v5.2l5.6 9.4A2 2 0 0 1 17.9 22H6.1a2 2 0 0 1-1.7-2.9L10 9.7V4.5H9z" fill="currentColor"/></svg>',
    comms: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 0 8 8L4 12zm0 0L20 4l-8 16" fill="currentColor"/><circle cx="19" cy="5" r="2.4" fill="currentColor"/><path d="M9 21h6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  };
  const RES_ICON = {
    mass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6a3 3 0 1 1 6 0c0 .7-.2 1.3-.6 1.8H18l3 13.2H3L6 7.8h3.6A3 3 0 0 1 9 6z" fill="currentColor"/></svg>',
    power: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2 4 14h6l-1 8 10-12h-6z" fill="currentColor"/></svg>',
    budget: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M17 6.5C15.8 5 14 4.4 12 4.4c-3 0-5 1.6-5 3.9 0 5.7 10.4 2.7 10.4 8.2 0 2.3-2.2 3.9-5.4 3.9-2.2 0-4.1-.8-5.5-2.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    data: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5.5" rx="8.5" ry="3" fill="currentColor"/><path d="M3.5 9.5c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3v4c0 1.7-3.8 3-8.5 3s-8.5-1.3-8.5-3zM3.5 16.5c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3V19c0 1.7-3.8 3-8.5 3s-8.5-1.3-8.5-3z" fill="currentColor"/></svg>',
    comms: ICON.comms,
    time: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 8.5V13l3 2M9 2h6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  };
  const RES = [
    { id: 'mass', name: () => t('team.res.mass', 'Mass'), unit: 'kg' },
    { id: 'power', name: () => t('team.res.power', 'Power'), unit: 'W' },
    { id: 'budget', name: () => t('team.res.budget', 'Budget'), unit: '$M' },
    { id: 'data', name: () => t('team.res.data', 'Data'), unit: 'Gb' },
    { id: 'comms', name: () => t('team.res.comms', 'Comms'), unit: 'Gb' },
    { id: 'time', name: () => t('team.res.time', 'Time'), unit: 'd' },
  ];
  const roleName = (r) =>
    ({ planner: t('team.role.planner', 'Planner'), engineer: t('team.role.engineer', 'Engineer'), scientist: t('team.role.scientist', 'Scientist'), comms: t('team.role.comms', 'Comms') })[r] || r;

  kit.ROLES = ROLES;
  kit.ICON = ICON;
  kit.RES = RES;
  kit.RES_ICON = RES_ICON;
  kit.roleName = roleName;
  kit.esc = esc;
  kit.ltr = ltr;
  kit.reduced = reduced;

  // ---------- Sound: short and physical. Everything goes through SMD.audio ----------
  const beep = (f, d, type, v) => {
    try {
      SMD.audio && SMD.audio.beep(f, d, type, v);
    } catch (e) {}
  };
  const seq = (notes, step, type, v) => notes.forEach((f, i) => setTimeout(() => beep(f, 0.11, type, v), i * step));
  // Calm (TEAM-V2): soft sine tones, quiet.
  kit.sfx = {
    tap: () => beep(520, 0.04, 'sine', 0.05),
    pick: () => seq([440, 587], 60, 'sine', 0.06),
    bad: () => seq([330, 262], 110, 'sine', 0.07),
    ping: () => seq([784, 988], 90, 'sine', 0.07),
    answer: () => seq([587, 784], 70, 'sine', 0.06),
    vote: () => seq([392, 523, 659], 80, 'sine', 0.07),
    tick: () => {},
    urgent: () => {},
    snowball: () => {},
    go: () => seq([523, 659, 784], 110, 'sine', 0.08),
  };

  // ---------- Numbers that roll ----------
  // A number rolls from what it showed to what it should show, then pops.
  kit.fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '–');
  kit.roll = function roll(el, to, format, ms = 460) {
    if (!el) return;
    const f = format || ((x) => kit.fmt(x));
    const from = typeof el._v === 'number' ? el._v : to;
    el._v = to;
    if (el._raf) cancelAnimationFrame(el._raf);
    if (from === to || reduced() || !Number.isFinite(from) || !Number.isFinite(to)) {
      el.textContent = f(to);
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = f(from + (to - from) * e);
      if (k < 1) el._raf = requestAnimationFrame(step);
      else el._raf = 0;
    };
    el._raf = requestAnimationFrame(step);
    kit.bump(el);
  };
  // Restarts a one-shot CSS animation.
  kit.bump = function bump(el, cls = 'ts-bump') {
    if (!el || reduced()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };

  // ---------- Options: what you have, what a change would do ----------
  const pickOf = (design, key) => (design && design.picks ? design.picks[key] : undefined);
  const isPicked = (design, key, id) => {
    const v = pickOf(design, key);
    return Array.isArray(v) ? v.indexOf(id) >= 0 : v === id;
  };
  const optById = (slot, id) => slot.options.find((o) => o.id === id);
  const pickNames = (slot, design) => {
    const v = pickOf(design, slot.key);
    const ids = Array.isArray(v) ? v : v == null ? [] : [v];
    return ids
      .map((id) => optById(slot, id))
      .filter(Boolean)
      .map((o) => o.name);
  };
  kit.pickOf = pickOf;
  kit.isPicked = isPicked;
  kit.optById = optById;
  kit.pickNames = pickNames;

  // Which way is better for each resource (+1 = more is good).
  const GOOD = { mass: -1, budget: -1, power: 1, data: -1, comms: 1, time: -1 };
  const fmtDelta = (id, d) => {
    const abs = kit.fmt(Math.abs(d), Math.abs(d) < 10 && d % 1 ? 1 : 0);
    const sign = d > 0 ? '+' : '−';
    if (id === 'budget') return ltr(`${sign}$${abs}M`);
    const units = { mass: 'kg', power: 'W', data: 'Gb', comms: 'Gb/d', time: 'mo' };
    return ltr(`${sign}${abs} ${units[id] || ''}`);
  };
  kit.fmtDelta = fmtDelta;
  // "+22 kg  −35 W  +$40M": what this choice would change, or that it changes nothing.
  kit.previewChips = function previewChips(p) {
    if (!p || p.error) return '';
    const chips = RES.map((r) => {
      const e = p[r.id];
      if (!e || !e.delta || Math.abs(e.delta) < (r.id === 'mass' || r.id === 'power' || r.id === 'budget' ? 0.5 : 0.05)) return '';
      const good = GOOD[r.id] * e.delta > 0;
      return `<span class="ts-delta ${good ? 'good' : 'bad'}"><i>${RES_ICON[r.id]}</i>${esc(fmtDelta(r.id, e.delta))}</span>`;
    }).join('');
    return chips || `<span class="ts-delta none">${esc(t('team.preview.none', 'No change'))}</span>`;
  };

  // ---------- Pictures: orbits and rockets ----------
  // Real orbit numbers, drawn to teach: height, what it sees, how long it is dark.
  const orbitNums = (o) => {
    const name = String(o.id + ' ' + o.name).toLowerCase();
    const inc = /polar|sso|sun-sync|dawn/.test(name) ? 90 : /equator|geo/.test(name) ? 0 : 45;
    return {
      alt: o.altKm,
      apo: o.apoKm,
      inc,
      cover: inc === 90 ? 100 : inc === 0 ? 35 : 65,
      dark: o.eclipsePct,
      period: o.periodMin,
      passes: o.passes && o.passes.hours != null ? o.passes.hours : null,
      zone: o.landing && o.landing.zone,
    };
  };
  kit.orbitNums = orbitNums;
  kit.orbitArt = function orbitArt(o, opts = {}) {
    const n = orbitNums(o);
    const size = 200;
    const c = size / 2;
    const pr = 34;
    const alt = Math.max(100, n.alt || 500);
    const apo = Math.max(alt, n.apo || alt);
    const r = pr + 14 + Math.min(1, Math.log10(alt / 100) / Math.log10(400)) * 34 + Math.min(1, Math.log10(apo / alt) / 2.2) * 18;
    const tilt = -Math.min(80, n.inc) * 0.9;
    const ry = apo > alt * 3 ? r * 0.42 : r * (0.34 + 0.66 * Math.min(1, n.inc / 90));
    const passes = Math.max(0, Math.min(12, Math.round((n.passes || 0) / 1.5)));
    const ticks = Array.from({ length: passes }, (_, i) => {
      const a = (i / Math.max(1, passes)) * Math.PI * 2;
      return `<circle cx="${(Math.cos(a) * r).toFixed(1)}" cy="${(Math.sin(a) * ry).toFixed(1)}" r="2.4" fill="#f2f5ff"/>`;
    }).join('');
    const darkFrac = Math.max(0, Math.min(0.6, (n.dark || 0) / 100));
    let shadowArc = '';
    if (darkFrac > 0.01) {
      // The shadow lies away from the Sun (left), so on the +x side of the ring.
      const mid = (-tilt * Math.PI) / 180;
      const half = darkFrac * Math.PI;
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const a = mid - half + (i / 24) * half * 2;
        pts.push(`${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * ry).toFixed(1)}`);
      }
      shadowArc = `<polyline points="${pts.join(' ')}" fill="none" stroke="#0b1033" stroke-width="5"/>`;
    }
    const cov = Math.max(6, Math.min(100, n.cover));
    const band = (pr * cov) / 100;
    return `<svg viewBox="0 0 ${size} ${size}" class="ts-orbit" aria-hidden="true">
      <defs><clipPath id="ts-pl-${o.id}"><circle cx="${c}" cy="${c}" r="${pr}"/></clipPath></defs>
      <path d="M${c} ${c - pr - 1} L${size} ${c - pr * 1.7} L${size} ${c + pr * 1.7} L${c} ${c + pr + 1}Z" fill="#000" opacity=".45"/>
      <circle cx="${c}" cy="${c}" r="${pr}" fill="#2a58d8"/>
      <rect x="${c - pr}" y="${c - band}" width="${pr * 2}" height="${band * 2}" fill="var(--role-planner)" opacity=".7" clip-path="url(#ts-pl-${o.id})"/>
      <circle cx="${c}" cy="${c}" r="${pr}" fill="none" stroke="#9fc2ff" stroke-width="2"/>
      <g transform="translate(${c} ${c}) rotate(${tilt})">
        <ellipse rx="${r}" ry="${ry}" fill="none" stroke="var(--role-planner)" stroke-width="3" ${opts.dim ? 'opacity=".45"' : ''}/>
        ${shadowArc}
        ${ticks}
        <circle class="ts-orbit-sat" r="6" fill="#fff" style="--o:path('M ${r} 0 A ${r} ${ry} 0 1 1 ${-r} 0 A ${r} ${ry} 0 1 1 ${r} 0')"/>
      </g>
    </svg>`;
  };
  kit.orbitFacts = function orbitFacts(o) {
    const n = orbitNums(o);
    const rows = [
      n.alt != null ? [t('team.orbit.height', 'Height'), ltr(n.apo && n.apo > n.alt * 1.5 ? `${kit.fmt(n.alt)}-${kit.fmt(n.apo)} km` : `${kit.fmt(n.alt)} km`)] : null,
      n.period != null ? [t('team.orbit.lap', 'One lap'), ltr(n.period >= 120 ? `${kit.fmt(n.period / 60, 1)} h` : `${kit.fmt(n.period)} min`)] : null,
      n.dark != null ? [t('team.orbit.dark', 'In the dark'), ltr(`${kit.fmt(n.dark)}%`)] : null,
      n.passes != null ? [t('team.orbit.passes', 'Talks home'), ltr(`${kit.fmt(n.passes, 1)} h/day`)] : null,
      n.zone ? [t('team.orbit.lands', 'Lands at'), n.zone] : null,
    ].filter(Boolean);
    return rows.map(([k, v]) => `<span><small>${esc(k)}</small><b>${esc(v)}</b></span>`).join('');
  };
  // Rockets to scale, side by side. mass = the ship they would have to lift.
  // Heights of a representative real rocket in each class.
  const ROCKET_H = { light: 30, medium: 58, heavy: 70, superheavy: 98 };
  const rocketNums = (o, design) => {
    const byOrbit = o.capacityByOrbit;
    const orbit = pickOf(design, 'orbit');
    return { h: ROCKET_H[o.id] || 50, cap: byOrbit ? byOrbit[orbit] : o.leo, stages: 2 };
  };
  kit.rocketNums = rocketNums;
  kit.rocketArt = function rocketArt(o, tallest, design) {
    const n = rocketNums(o, design);
    const H = 150;
    const h = Math.max(36, ((n.h || 40) / (tallest || 100)) * H);
    const w = Math.max(14, Math.min(34, 12 + (n.cap || 1000) / 900));
    const x = 30 - w / 2;
    const y = 158 - h;
    const nose = Math.min(30, h * 0.26);
    const bands = Math.max(1, n.stages);
    return `<svg viewBox="0 0 60 168" class="ts-rocket" aria-hidden="true">
      <path d="M${x} ${y + nose} Q 30 ${y - 2} ${x + w} ${y + nose} L${x + w} 158 L${x} 158Z" fill="#f2f5ff"/>
      ${Array.from({ length: bands }, (_, i) => `<rect x="${x}" y="${y + nose + ((h - nose) * (i + 0.6)) / (bands + 0.4)}" width="${w}" height="3" fill="#0b1033"/>`).join('')}
      <path d="M${x} 136 L${x - 8} 160 L${x} 154ZM${x + w} 136 L${x + w + 8} 160 L${x + w} 154Z" fill="var(--role-planner)"/>
    </svg>`;
  };

  // ---------- The six resources, always on show ----------
  // Tiles keep their last status so going bad can flash and buzz exactly once.
  kit.resTiles = function resTiles(el, compact) {
    el.classList.add('ts-dash');
    if (compact) el.classList.add('compact');
    el.innerHTML = RES.map(
      (r) => `<div class="ts-res" data-res="${r.id}" data-status="ok">
        <div class="ts-res-top"><i>${RES_ICON[r.id]}</i><span>${esc(r.name())}</span><small data-limit></small></div>
        <div class="ts-res-num"><b data-num>0</b></div>
        <div class="ts-res-bar"><i data-bar></i></div>
        ${compact ? '' : '<div class="ts-res-why" data-why></div>'}
      </div>`
    ).join('');
    const last = {};
    const fmtVal = (v) => kit.fmt(v, Math.abs(v) < 20 && v % 1 ? 1 : 0);
    return function update(res) {
      if (!res) return;
      RES.forEach((r) => {
        const x = res[r.id];
        if (!x) return;
        const tile = el.querySelector(`[data-res="${r.id}"]`);
        const num = tile.querySelector('[data-num]');
        kit.roll(num, x.value, fmtVal);
        const lim = tile.querySelector('[data-limit]');
        const unit = x.unit || '';
        lim.textContent = x.limit == null ? ltr(unit) : r.id === 'power' ? `${ltr(unit)}, ${t('team.res.uses', 'uses {n}', { n: ltr(kit.fmt(x.limit)) })}` : r.id === 'comms' ? `${ltr(unit)}, ${t('team.res.made', 'makes {n}', { n: ltr(kit.fmt(x.limit, 1)) })}` : ltr(`/ ${kit.fmt(x.limit)} ${unit}`);
        const bar = tile.querySelector('[data-bar]');
        const moreIsBetter = r.id === 'power' || r.id === 'comms';
        const frac = moreIsBetter ? (x.value > 0 ? Math.min(1, Math.max(0, x.limit || 0) / x.value) : 1) : x.limit ? Math.min(1.1, Math.abs(x.value) / Math.abs(x.limit)) : 0.5;
        bar.style.inlineSize = `${Math.min(100, frac * 100)}%`;
        const why = tile.querySelector('[data-why]');
        if (why) why.textContent = x.why || '';
        tile.dataset.status = x.status || 'ok';
        const was = last[r.id];
        if (was && was.status !== x.status) {
          kit.bump(tile, 'ts-flash');
          if (x.status === 'bad') kit.sfx.bad();
          else if (was.status === 'bad') kit.sfx.answer();
        } else if (was && Math.abs(was.value - x.value) >= 0.5) {
          kit.bump(tile, 'ts-move');
        }
        last[r.id] = { status: x.status, value: x.value };
      });
    };
  };

  // ---------- The snowball: one kilogram rolling into more of everything ----------
  // Compares two resource snapshots; returns the chain to show, or null.
  const dryOf = (m) => (m.dryKg != null ? m.dryKg : m.dry);
  const propOf = (m) => (m.propKg != null ? m.propKg : m.prop != null ? m.prop : m.propellantKg != null ? m.propellantKg : m.propellant);
  kit.snowballSteps = function snowballSteps(prev, cur) {
    if (!prev || !cur || !prev.mass || !cur.mass) return null;
    const steps = [];
    const dDry = dryOf(cur.mass) != null ? dryOf(cur.mass) - dryOf(prev.mass) : cur.mass.value - prev.mass.value;
    const dProp = propOf(cur.mass) != null ? propOf(cur.mass) - propOf(prev.mass) : 0;
    if (Math.abs(dDry) >= 0.5) steps.push({ label: fmtDelta('mass', dDry), sub: t('team.snow.part', 'on the ship') });
    if (Math.abs(dProp) >= 0.5) steps.push({ label: fmtDelta('mass', dProp), sub: t('team.snow.fuel', 'more fuel'), kind: 'fuel' });
    const dCost = cur.budget && prev.budget ? cur.budget.value - prev.budget.value : 0;
    if (Math.abs(dCost) >= 0.5) steps.push({ label: fmtDelta('budget', dCost), sub: t('team.snow.money', 'of budget'), kind: 'money' });
    // A snowball needs the mass to have grown (or shrunk) into something else.
    if (steps.length < 2 || Math.abs(dDry) < 0.5) return null;
    return steps;
  };
  // Throws the chain across `host`. The next change replaces it.
  kit.snowball = function snowball(host, steps) {
    if (!host || !steps) return;
    const old = host.querySelector('.ts-snow');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'ts-snow';
    el.setAttribute('role', 'status');
    el.innerHTML = steps
      .map(
        (s, i) => `${i ? '<i class="ts-snow-arrow" aria-hidden="true"></i>' : ''}<span class="ts-snow-step ${s.kind || ''}" style="animation-delay:${i * 130}ms;--grow:${1 + i * 0.16}"><b>${esc(s.label)}</b><small>${esc(s.sub)}</small></span>`
      )
      .join('');
    host.appendChild(el);
    kit.sfx.snowball(steps.length);
    setTimeout(() => el.remove(), 2600);
  };

  // ---------- The spacecraft on the table ----------
  // 3D from js/3d/craft.js where WebGL works; otherwise a 2D schematic.
  kit.craft2D = function craft2D(cd) {
    const arrays = Math.max(2, Math.min(22, (cd && cd.arrays) || 8));
    const dish = Math.max(1, Math.min(4, (cd && cd.dish) || 2));
    const inst = Math.max(1, Math.min(6, (cd && cd.instruments && cd.instruments.length) || 1));
    const panel = 16 + arrays * 7;
    const r = 18 + dish * 11;
    const insts = Array.from({ length: inst }, (_, i) => `<rect x="${150 + i * 18 - (inst - 1) * 9}" y="178" width="13" height="18" rx="2" fill="var(--role-scientist)"/>`).join('');
    return `<svg viewBox="0 0 300 220" class="ts-craft2d" aria-hidden="true">
      <rect x="${118 - panel}" y="96" width="${panel}" height="44" fill="var(--role-engineer)" opacity=".85"/>
      <rect x="182" y="96" width="${panel}" height="44" fill="var(--role-engineer)" opacity=".85"/>
      <path d="M${112 - panel / 2} 96v44M${188 + panel / 2} 96v44" stroke="#0b1033" stroke-width="3"/>
      <rect x="118" y="78" width="64" height="100" rx="6" fill="#f5c542"/>
      <path d="M${150 - r} 44a${r} ${r * 0.5} 0 0 0 ${r * 2} 0z" fill="var(--role-comms)"/>
      <path d="M150 44v34" stroke="var(--role-comms)" stroke-width="5"/>
      ${insts}
    </svg>`;
  };
  const WORLD_HEX = { earth: 0x2f6fe0, moon: 0x8a8f9c, mars: 0xc2562a, venus: 0xd9a64a, jupiter: 0x9fc4dc };
  kit.mountCraft = function mountCraft(el, dest) {
    let design = null;
    let scene = null;
    let gone = false;
    const useFallback = () => {
      el.classList.add('flat');
      el.innerHTML = kit.craft2D(design);
    };
    const E = SMD.three && SMD.three.engine;
    if (!E || !E.supported || !E.supported()) {
      useFallback();
      return { set(d) { design = d; if (!gone) useFallback(); }, destroy() { gone = true; } };
    }
    Promise.all([import(new URL('js/3d/craft.js', document.baseURI).href)])
      .then(([C]) => {
        if (gone) return;
        const T = E.THREE;
        const s = new T.Scene();
        s.background = new T.Color(0x10163f);
        const world = new T.Mesh(new T.SphereGeometry(40, 64, 32), new T.MeshStandardMaterial({ color: new T.Color(WORLD_HEX[dest] || WORLD_HEX.earth).multiplyScalar(0.28), roughness: 1, metalness: 0 }));
        world.position.set(0, -47, -14);
        s.add(world);
        const cam = new T.PerspectiveCamera(30, 1.4, 0.1, 500);
        cam.position.set(9, 4.5, 14);
        cam.lookAt(0, 0, 0);
        const key = new T.DirectionalLight(0xffffff, 3);
        key.position.set(6, 9, 8);
        const fill = new T.DirectionalLight(0x7fa2ff, 1.3);
        fill.position.set(-8, -2, 4);
        s.add(key, fill, new T.AmbientLight(0x8090c0, 0.55));
        const holder = new T.Group();
        s.add(holder);
        if (E.studioEnv) E.studioEnv().then((env) => { if (!gone) { s.environment = env; s.environmentIntensity = 0.6; } }).catch(() => {});
        let craft = null;
        let pop = 0;
        let spin = 0;
        const motion = !reduced();
        const build = () => {
          if (!design) return;
          if (craft) {
            holder.remove(craft);
            E.disposeTree(craft);
          }
          craft = C.buildCraft(design, (design && design.info) || {});
          C.setDeploy(craft, 1);
          holder.add(craft);
          // Frame by size so a small craft fills the table too.
          const box = new T.Box3().setFromObject(craft);
          const sz = box.getSize(new T.Vector3());
          const c = box.getCenter(new T.Vector3());
          craft.position.sub(c);
          const span = Math.max(sz.x, sz.y, sz.z, 1);
          holder.scale.setScalar(7 / span);
          pop = 1;
        };
        scene = {
          scene: s,
          camera: cam,
          exposure: 1.1,
          onResize(w, h) {
            cam.aspect = w / Math.max(1, h);
            cam.updateProjectionMatrix();
          },
          update(dt) {
            if (motion) spin += dt * 0.35;
            holder.rotation.y = spin;
            if (pop > 0) {
              pop = Math.max(0, pop - dt * 3.5);
              const k = motion ? 1 + Math.sin(pop * Math.PI) * 0.09 : 1;
              const base = holder.userData.base || holder.scale.x;
              holder.userData.base = base;
              holder.scale.setScalar(base * k);
            }
          },
          setDesign(d) {
            design = d;
            holder.userData.base = 0;
            holder.scale.setScalar(1);
            build();
            holder.userData.base = holder.scale.x;
          },
        };
        E.mount(el, scene);
        scene.setDesign(design);
      })
      .catch((e) => {
        console.warn('craft view is flat', e);
        if (!gone) useFallback();
      });
    return {
      set(d) {
        design = d;
        if (gone) return;
        if (scene) scene.setDesign(d);
        else if (el.classList.contains('flat')) el.innerHTML = kit.craft2D(d);
      },
      destroy() {
        gone = true;
        try {
          if (E && scene) E.stop();
        } catch (e) {}
      },
    };
  };
  // What you carry down to the surface reads as packing, not as ship.
  const PACK_KEYS = ['ascent', 'oxygen', 'drill'];
  const isPack = (slot) => PACK_KEYS.indexOf(slot.key) >= 0;
  kit.isPack = isPack;

  // ---------- Too heavy to lift off: what stays behind ----------
  // items: [{ id, kind, kg, value }]. Without `keep`: the launch computer's plan (worst value
  // per kilogram first, keeping the last objective sample if it fits), exactly what happens
  // if nobody chooses. With `keep` ({ kind: n }): the n best of each kind stay.
  // The surface sim's ascentPlan is the reference; this copy serves the phone page, which
  // does not load the sim.
  kit.ascentPlan = function ascentPlan(items, liftKg, objective, keep) {
    const rack = (items || []).map((x) => ({ id: x.id, siteKind: x.kind, massKg: x.kg, value: x.value }));
    const S = team.surface;
    if (S && typeof S.ascentPlan === 'function') return S.ascentPlan(rack, liftKg, objective, keep);
    const ratio = (r) => (r.value || 0) / Math.max(0.001, r.massKg || 0);
    const drop = [];
    if (keep) {
      const byKind = {};
      for (const r of rack) (byKind[r.siteKind] = byKind[r.siteKind] || []).push(r);
      for (const k in byKind) {
        byKind[k].sort((a, b) => ratio(b) - ratio(a));
        const n = Math.max(0, Math.min(byKind[k].length, keep[k] === undefined ? byKind[k].length : keep[k] | 0));
        byKind[k].slice(n).forEach((r) => drop.push(r.id));
      }
    } else {
      let rest = rack.slice();
      let kg = rest.reduce((n, r) => n + r.massKg, 0);
      while (kg > liftKg + 1e-6 && rest.length) {
        rest.sort((a, b) => ratio(a) - ratio(b));
        const objLeft = rest.filter((r) => r.siteKind === objective);
        let idx = 0;
        if (objLeft.length === 1 && rest.length > 1 && objLeft[0].massKg <= liftKg) idx = rest[0].siteKind === objective ? 1 : 0;
        const r = rest[idx];
        rest = rest.filter((x) => x !== r);
        kg -= r.massKg;
        drop.push(r.id);
      }
    }
    const kept = rack.filter((r) => !drop.includes(r.id));
    const keptKg = kept.reduce((n, r) => n + r.massKg, 0);
    const counts = {};
    for (const r of rack) counts[r.siteKind] = counts[r.siteKind] || 0;
    for (const r of kept) counts[r.siteKind]++;
    return { drop, keep: counts, keptKg, overKg: Math.max(0, keptKg - liftKg) };
  };

  // The calm chooser: one row per kind of sample (count, kg, value) with a "keep" stepper,
  // the plan preselected, one confirm. Used by the surface HUD and the phone controller.
  // opts: { send(ids), kindName(kind) }. update(rack, decisionLeftS): rack = { items, liftKg, objective }.
  kit.ascentChooser = function ascentChooser(el, opts) {
    const kname = opts.kindName || ((k) => t('team.surface.sample.' + k, k));
    el.classList.add('ka');
    el.innerHTML = `<div class="ka-head"><b class="ka-title"></b><span class="ka-count"></span></div>
      <p class="ka-line"></p>
      <ul class="ka-rows"></ul>
      <div class="ka-bar"><i class="ka-fill"></i><i class="ka-limit"></i></div>
      <p class="ka-kg"></p>
      <button type="button" class="ka-go"></button>`;
    const $ = (s) => el.querySelector(s);
    let sig = '';
    let keep = null;
    let sent = false;
    let last = null;
    let rowsSig = '';
    function plan() {
      const R = last.rack;
      return kit.ascentPlan(R.items, R.liftKg, R.objective, keep);
    }
    function draw() {
      if (!last) return;
      const R = last.rack;
      const deciding = last.decision > 0;
      const p = plan();
      const total = R.items.reduce((n, x) => n + x.kg, 0);
      el.classList.toggle('ka-deciding', deciding);
      el.classList.toggle('ka-over', deciding ? p.overKg > 0.5 : total > R.liftKg + 0.5);
      $('.ka-title').textContent = deciding ? t('team.surface.ascent.too', 'Too heavy to lift off') : total > R.liftKg + 0.5 ? t('team.surface.ascent.heavy', 'Too heavy to lift') : t('team.surface.ascent.ok', 'The samples fit');
      $('.ka-count').textContent = deciding ? t('team.surface.ascent.secs', '{n} s', { n: ltr(Math.ceil(last.decision)) }) : '';
      $('.ka-line').textContent = deciding
        ? t('team.surface.ascent.plan', 'KILO kept the best science per kilogram. Change it with − and +, then lift off.')
        : total > R.liftKg + 0.5
          ? t('team.surface.ascent.later', '{n} kg too heavy. You choose what stays when you reach the lander.', { n: ltr(Math.ceil(total - R.liftKg)) })
          : '';
      const keptKg = deciding ? p.keptKg : total;
      $('.ka-kg').textContent = t('team.surface.ascent.kg', '{a} of {b} kg', { a: ltr(Math.round(keptKg)), b: ltr(Math.round(R.liftKg)) });
      const scale = Math.max(R.liftKg / 0.8, keptKg, 1);
      $('.ka-fill').style.inlineSize = `${Math.min(100, (keptKg / scale) * 100)}%`;
      $('.ka-limit').style.insetInlineStart = `${Math.min(100, (R.liftKg / scale) * 100)}%`;
      // One row per kind, only while choosing.
      const rows = $('.ka-rows');
      rows.hidden = !deciding;
      const go = $('.ka-go');
      go.hidden = !deciding;
      if (!deciding) return;
      const groups = {};
      for (const x of R.items) {
        const g = (groups[x.kind] = groups[x.kind] || { kind: x.kind, n: 0, items: [] });
        g.n++;
        g.items.push(x);
      }
      const list = Object.values(groups).sort((a, b) => (b.kind === R.objective) - (a.kind === R.objective) || b.items.reduce((n, x) => n + x.value, 0) - a.items.reduce((n, x) => n + x.value, 0));
      const rsig = JSON.stringify([sig, p.keep]);
      if (rsig !== rowsSig) {
        rowsSig = rsig;
        rows.innerHTML = list
          .map((g) => {
            const k = p.keep[g.kind] || 0;
            // The kind as a whole: how many, how heavy, how much science (the bar shows what is kept).
            const kg = g.items.reduce((n, x) => n + x.kg, 0);
            const val = g.items.reduce((n, x) => n + x.value, 0);
            return `<li class="${k ? '' : 'ka-none'}"><span class="ka-kind"><b>${esc(kname(g.kind))}</b>${g.kind === R.objective ? `<small>${esc(t('team.surface.ascent.goal', 'your goal'))}</small>` : ''}</span>
              <span class="ka-step"><button type="button" data-k="${esc(g.kind)}" data-d="-1" aria-label="−" ${k <= 0 ? 'disabled' : ''}>−</button><span class="ka-keep">${esc(t('team.surface.ascent.keepN', 'keep {k} of {n}', { k: ltr(k), n: ltr(g.n) }))}</span><button type="button" data-k="${esc(g.kind)}" data-d="1" aria-label="+" ${k >= g.n ? 'disabled' : ''}>+</button></span>
              <span class="ka-sum">${esc(t('team.surface.ascent.kgN', '{n} kg', { n: ltr(Math.round(kg)) }))}<small>${esc(t('team.surface.rack.value', 'worth {v}', { v: ltr(Math.round(val)) }))}</small></span></li>`;
          })
          .join('');
      }
      const n = p.drop.length;
      go.disabled = sent || p.overKg > 0.5;
      go.textContent = sent
        ? t('team.surface.ascent.going', 'Lifting off…')
        : p.overKg > 0.5
          ? t('team.surface.ascent.still', 'Still {n} kg too heavy', { n: ltr(Math.ceil(p.overKg)) })
          : n
            ? t('team.surface.ascent.go', 'Leave {n} behind and lift off', { n: ltr(n) })
            : t('team.surface.ascent.goAll', 'Lift off with everything');
    }
    function onClick(e) {
      const b = e.target.closest('button');
      if (!b || b.disabled || !last) return;
      e.stopPropagation();
      if (b.classList.contains('ka-go')) return confirm();
      const k = b.dataset.k;
      if (!k) return;
      const p = plan();
      keep = Object.assign({}, p.keep);
      const n = last.rack.items.filter((x) => x.kind === k).length;
      keep[k] = Math.max(0, Math.min(n, (keep[k] || 0) + Number(b.dataset.d)));
      try {
        kit.sfx.tap();
      } catch (err) {}
      draw();
    }
    function confirm() {
      if (!last || sent || !(last.decision > 0)) return false;
      const p = plan();
      if (p.overKg > 0.5) return false;
      sent = true;
      opts.send(p.drop.slice());
      draw();
      return true;
    }
    el.addEventListener('click', onClick);
    return {
      update(rack, decision) {
        if (!rack || !rack.items || !rack.items.length) {
          last = null;
          return;
        }
        const s = rack.items.map((x) => x.id).join(',');
        if (s !== sig) {
          sig = s;
          keep = null;
          sent = false;
        }
        last = { rack, decision: decision || 0 };
        draw();
      },
      confirm,
      destroy() {
        el.removeEventListener('click', onClick);
      },
    };
  };

  // ---------- Session: the host side of a game ----------
  const prefs = {
    get(k, d) {
      try {
        const v = localStorage.getItem('ek.team.' + k);
        return v == null ? d : v;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('ek.team.' + k, String(v));
      } catch (e) {}
    },
  };
  kit.prefs = prefs;

  const NET_DEFAULT = {
    connecting: () => t('team.net.connecting', 'Connecting…'),
    reconnecting: () => t('team.net.reconnecting', 'Lost the connection. Trying again…'),
    'waiting-host': () => t('team.net.waiting', 'Waiting for the host to come back. Stay here.'),
    closed: () => t('team.net.closed', 'The room closed.'),
    error: () => t('team.net.error', 'Could not reach that room.'),
  };
  // net.js gives a code and English text; codes have Arabic as team.net.msg.<code>.
  kit.netMessage = function netMessage(status, code, text) {
    const base = text || (NET_DEFAULT[status] ? NET_DEFAULT[status]() : '');
    return code ? t('team.net.msg.' + code, base) : base;
  };

  kit.createSession = function createSession(params) {
    const net = team.net;
    const mode = params.mode === 'phones' || params.mode === 'devices' || params.mode === 'join' ? params.mode : params.mode === 'solo' ? 'solo' : 'one';
    const opts = {
      mode,
      sandbox: !!params.sandbox,
      difficulty: params.sandbox ? 'sandbox' : prefs.get('difficulty', 'engineer'),
      hazards: prefs.get('hazards', 'anomalies'),
      scenarioId: prefs.get('scenario', '') || undefined,
      fresh: true,
      // The crew meets in the cabin before launch (views.cabin, view-flight.js).
      timing: { cabinMs: 28000 },
    };
    if (params.name) opts.name = params.name;
    // A host coming back within two minutes picks up the room it left.
    if (mode === 'devices' && net.resumable && net.resumable('webrtc')) delete opts.fresh;
    // A challenge link flies the rival's scenario, difficulty and seed.
    if (params.challenge && team.sim && team.sim.decode) {
      const ch = team.sim.decode(params.challenge);
      if (ch) {
        if (ch.sc) opts.scenarioId = ch.sc;
        if (ch.df) opts.difficulty = ch.df;
        if (Number.isFinite(ch.seed)) opts.seed = ch.seed;
        opts.challenge = params.challenge;
      }
    }
    if (params.transport) opts.transport = params.transport;
    const s = params.session || (mode === 'phones' || mode === 'devices' ? net.createHost(mode === 'devices' ? { ...opts, mode: 'devices', transport: 'webrtc' } : opts) : net.createLocal(opts));
    const subs = new Set();
    const ctx = {
      state: s.state,
      view: s.view,
      send: (a) => s.send(a),
      sim: team.sim,
      device: mode === 'join' ? 'client' : mode === 'phones' || mode === 'devices' ? 'host' : 'one',
      session: s,
      mode,
      params,
      subscribe(fn) {
        subs.add(fn);
        return () => subs.delete(fn);
      },
    };
    const notify = () =>
      subs.forEach((fn) => {
        try {
          fn(ctx);
        } catch (e) {
          console.error(e);
        }
      });
    let runKey = '';
    let localRun = null;
    const clientState = (v) => {
      if (v && v.phase === 'flight' && v.design && !(v.flight && v.flight.frames)) {
        const key = JSON.stringify([v.design, v.seed]);
        if (key !== runKey) {
          runKey = key;
          try {
            localRun = team.sim.fly(v.design, v.seed || 1, {});
          } catch (e) {
            localRun = null;
          }
        }
      }
      return v ? { ...v, run: localRun } : v;
    };
    if (mode === 'join') ctx.state = clientState(s.view);
    const offs = [
      s.on('state', (st) => {
        ctx.state = st;
      }),
      s.on('view', (v) => {
        ctx.view = v;
        if (mode === 'join') ctx.state = clientState(v);
        notify();
      }),
      s.on('status', () => notify()),
      s.on('issue', (i) => {
        ctx.issues = (ctx.issues || []).concat([i]).slice(-4);
        notify();
      }),
    ];
    if (s.view) ctx.view = s.view;
    if (s.state) ctx.state = s.state;
    return {
      ctx,
      subscribe: ctx.subscribe,
      close() {
        offs.forEach((o) => o && o());
        s.close();
      },
    };
  };

  const sc = (ctx, id) => ctx.sim.scenarios().find((x) => x.id === (id || ctx.view.scenarioId)) || ctx.sim.scenarios()[0];
  kit.scenarioOf = sc;
  const clockText = (c) => {
    if (!c) return '∞';
    const s = Math.max(0, c.leftS);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  kit.clockText = clockText;


  const worldClass = (s) => `ts-w-${s && s.dest === 'jupiter' ? 'europa' : String((s && s.dest) || 'earth').toLowerCase()}`;
  const hasLanding = (s) => !!(s && !s.training);


  // =====================================================================
  // v2 flow (docs/TEAM-V2.md): calm, one thing at a time, Back everywhere.
  // =====================================================================

  const go = (screen, params) => {
    if (SMD.go && SMD.ui && SMD.ui.screens && SMD.ui.screens[screen]) SMD.go(screen, params);
    else if (typeof location !== 'undefined') location.href = 'index.html';
  };
  kit.quit = () => go('start');

  // ---------- The crew (js/team/crew.js) and KILO (js/team/guide.js) ----------
  // Stand-ins with the same shape keep the screens working if those files are missing.
  const STAND_IN_CREW = [
    { id: 'salma', name: 'Salma Fawzy', short: 'Salma', job: 'planner', personality: 'Calm in a crisis.' },
    { id: 'mateo', name: 'Mateo Silva', short: 'Mateo', job: 'engineer', personality: 'Fixes anything.' },
    { id: 'priya', name: 'Priya Raman', short: 'Priya', job: 'scientist', personality: 'Gets excited about rocks.' },
    { id: 'jonas', name: 'Jonas Berg', short: 'Jonas', job: 'comms', personality: 'Says little. Every word gets through.' },
  ];
  const crewApi = () => (team.crew && Array.isArray(team.crew.roster) ? team.crew : null);
  const crewList = () => (crewApi() ? crewApi().roster : STAND_IN_CREW);
  const crewById = (id) => crewList().find((m) => m.id === id) || null;
  const crewText = (m, field) => {
    const c = crewApi();
    if (c && c.text) return c.text(m, field);
    return m[field] || '';
  };
  const jobName = (job) => {
    const c = crewApi();
    return c && c.jobName ? c.jobName(job) : roleName(job);
  };
  const crewFace = (m, size) => {
    const c = crewApi();
    if (c && c.portrait) {
      try {
        return c.portrait(m, { size });
      } catch (e) {}
    }
    return `<svg viewBox="0 0 96 96" width="${size}" height="${size}" aria-hidden="true"><circle cx="48" cy="48" r="46" fill="var(--team-ink-3)"/><text x="48" y="60" text-anchor="middle" font-size="36" fill="var(--team-text)">${esc((m.name || '?')[0])}</text></svg>`;
  };
  kit.crewList = crewList;
  kit.crewById = crewById;

  const guide = () => (team.guide && typeof team.guide.say === 'function' ? team.guide : null);
  function kiloLines(mission, moment, params) {
    const g = guide();
    if (!g || !g.scriptFor) return [];
    try {
      return g.scriptFor(mission, moment, params) || [];
    } catch (e) {
      return [];
    }
  }
  function kiloSay(target, lines, opts) {
    const g = guide();
    if (!g || !lines || !lines.length) return null;
    try {
      return g.say(target, lines, opts || {});
    } catch (e) {
      console.warn('KILO', e);
      return null;
    }
  }
  function kiloClear() {
    const g = guide();
    if (g && g.clear) {
      try {
        g.clear();
      } catch (e) {}
    }
  }
  kit.kiloSay = kiloSay;
  kit.kiloLines = kiloLines;
  // The build step -> the moment KILO has a line for.
  const STEP_MOMENT = { power: 'panels', radio: 'antenna', rocket: 'launcher' };

  // ---------- Who may move the crew along ----------
  const isLocalView = (v) => v && (v.mode === 'one' || v.mode === 'solo');
  const myRoles = (v) => (v && v.me && v.me.roles) || [];
  const stepsCache = {};
  function stepsOf(v) {
    if (!v || !v.scenarioId || !team.sim || !team.sim.buildSteps) return [];
    const key = `${v.scenarioId}|${v.difficulty}|${SMD.lang ? SMD.lang() : ''}`;
    if (!stepsCache[key]) stepsCache[key] = team.sim.buildSteps(v.scenarioId, v.difficulty) || [];
    return stepsCache[key];
  }
  kit.stepsOf = stepsOf;
  function canSteer(v) {
    if (!v) return false;
    if (isLocalView(v) || v.isHost) return true;
    if (v.phase === 'design') {
      const st = stepsOf(v)[v.buildStep];
      return !!st && myRoles(v).indexOf(st.role) >= 0;
    }
    return (v.phase === 'questions' || v.phase === 'lock') && !!v.me;
  }
  kit.canSteer = canSteer;

  // ---------- The mission tracker ----------
  const STAGES = ['crew', 'destination', 'questions', 'build', 'launch', 'flight', 'surface', 'home'];
  const STAGE_W = { crew: 6, destination: 6, questions: 6, build: 30, launch: 6, flight: 18, surface: 22, home: 6 };
  const stageName = (id) =>
    ({
      crew: t('team.track.crew', 'Crew'),
      destination: t('team.track.destination', 'Destination'),
      build: t('team.track.build', 'Build'),
      questions: t('team.track.questions', 'Success criterion'),
      launch: t('team.track.launch', 'Launch'),
      flight: t('team.track.flight', 'Flight'),
      surface: t('team.track.surface', 'Surface'),
      home: t('team.track.home', 'Home'),
    })[id] || id;
  function landsOn(v) {
    try {
      const s = team.sim.scenarios().find((x) => x.id === v.scenarioId);
      return s ? !!s.landing : true;
    } catch (e) {
      return true;
    }
  }
  // Where the mission is: { stage, sub (0..1 inside that stage) }.
  function stageOf(v, sub) {
    const p = v && v.phase;
    const step = v && v.setupStep;
    const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));
    switch (p) {
      case 'lobby':
        if (step === 'destination') return { stage: 'destination', sub: 0.2 };
        return { stage: 'crew', sub: step === 'crew' ? 0.6 : step === 'difficulty' ? 0.3 : 0 };
      case 'brief':
        return { stage: 'questions', sub: 0 };
      case 'design': {
        const n = Math.max(1, stepsOf(v).length);
        return { stage: 'build', sub: clamp01(((v.buildStep || 0) + 0.5) / n) };
      }
      case 'questions':
        return { stage: 'questions', sub: 0.5 };
      case 'lock':
        return { stage: 'launch', sub: 0.3 };
      case 'cabin':
        return { stage: 'launch', sub: 0.7 };
      case 'flight':
        return { stage: 'flight', sub: clamp01(sub != null ? sub : v.flight && v.flight.progress) };
      case 'landing':
        return { stage: 'surface', sub: 0 };
      case 'surface':
        return { stage: 'surface', sub: clamp01(sub != null ? sub : 0.05) };
      case 'ascent':
        return { stage: 'surface', sub: 0.95 };
      case 'debrief':
        return { stage: 'home', sub: 1 };
      default:
        return { stage: 'crew', sub: 0 };
    }
  }
  // { stages, stage, pct }: the share of the whole mission done (0-100).
  kit.progressOf = function progressOf(v, sub) {
    const stages = STAGES.filter((s) => s !== 'surface' || landsOn(v));
    const total = stages.reduce((a, s) => a + STAGE_W[s], 0);
    const at = stageOf(v, sub);
    let done = 0;
    for (const s of stages) {
      if (s === at.stage) break;
      done += STAGE_W[s];
    }
    const here = stages.indexOf(at.stage) >= 0 ? STAGE_W[at.stage] * at.sub : 0;
    return { stages, stage: at.stage, sub: at.sub, pct: Math.round(((done + here) / total) * 100) };
  };

  const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>';
  function trackerHTML(withPause) {
    return `<div class="ts-track" role="navigation" aria-label="${esc(t('team.track.aria', 'Mission progress'))}">
      <ol class="ts-track-stages" data-stages></ol>
      <p class="ts-track-now" data-now></p>
      <p class="ts-track-pct"><b data-pct>0%</b><small>${esc(t('team.track.done', 'of the mission'))}</small></p>
      ${withPause ? `<button type="button" class="ts-pause-btn" data-pause>${PAUSE_ICON}<span>${esc(t('team.pause.btn', 'Pause'))}</span></button>` : ''}
      <div class="ts-track-line" aria-hidden="true"><i data-line></i></div>
    </div>`;
  }
  function drawTracker(box, v, sub) {
    if (!box || !v) return;
    const pr = kit.progressOf(v, sub);
    const sig = `${pr.stages.join()}|${pr.stage}|${SMD.lang ? SMD.lang() : ''}`;
    const list = box.querySelector('[data-stages]');
    if (list.dataset.sig !== sig) {
      list.dataset.sig = sig;
      const at = pr.stages.indexOf(pr.stage);
      list.innerHTML = pr.stages.map((s, i) => `<li data-state="${i < at ? 'done' : i === at ? 'now' : 'next'}"><i></i><span>${esc(stageName(s))}</span></li>`).join('');
    }
    box.querySelector('[data-now]').textContent = stageName(pr.stage);
    box.querySelector('[data-pct]').textContent = ltr(`${pr.pct}%`);
    box.querySelector('[data-line]').style.inlineSize = `${pr.pct}%`;
  }

  // ---------- Pause: Resume, Back one step, Restart mission, Quit to title ----------
  const BACK_PHASES = { lobby: 1, brief: 1, design: 1, questions: 1, lock: 1 };
  function pauseHTML() {
    return `<div class="ts-pause" role="dialog" aria-modal="true" aria-labelledby="ts-pause-h" data-pausebox hidden>
      <div class="ts-pause-card">
        <h2 id="ts-pause-h">${esc(t('team.pause.title', 'Paused'))}</h2>
        <p class="ts-pause-who" data-who></p>
        <button type="button" class="ts-btn primary" data-p="resume">${esc(t('team.pause.resume', 'Resume'))}</button>
        <button type="button" class="ts-btn" data-p="back">${esc(t('team.pause.back', 'Back one step'))}</button>
        <button type="button" class="ts-btn" data-p="restart">${esc(t('team.pause.restart', 'Restart mission'))}</button>
        <button type="button" class="ts-btn quiet" data-p="quit">${esc(t('team.pause.quit', 'Quit to title'))}</button>
        <p class="ts-pause-note" data-note></p>
      </div>
    </div>`;
  }

  // The chrome every phase shares: the tracker on top, the pause button and menu,
  // and Esc. One per screen; views reach it through kit.tracker / kit.pauseMenu.
  let chromeNow = null;
  kit.chrome = function chrome(root, ctx) {
    const bar = document.createElement('div');
    bar.className = 'ts-chrome';
    bar.innerHTML = trackerHTML(true) + pauseHTML();
    root.appendChild(bar);
    const track = bar.querySelector('.ts-track');
    const box = bar.querySelector('[data-pausebox]');
    let sub = null;
    let open = false;
    let confirmRestart = false;
    let gone = false;
    let wasPaused = false;
    const v = () => ctx.view || {};
    function draw() {
      if (gone) return;
      const view = v();
      // Someone else resumed: close this menu too.
      if (wasPaused && !view.paused) open = false;
      wasPaused = !!view.paused;
      bar.hidden = !view.phase;
      drawTracker(track, view, sub);
      const show = open || !!view.paused;
      box.hidden = !show;
      root.classList.toggle('ts-is-paused', show);
      if (!show) return;
      const p = view.paused;
      const meId = view.me && view.me.id;
      box.querySelector('[data-who]').textContent = p && p.name && p.by !== meId ? t('team.pause.by', '{name} paused the game.', { name: p.name }) : isLocalView(view) ? '' : t('team.pause.all', 'The game is paused for everyone.');
      const back = box.querySelector('[data-p="back"]');
      back.hidden = !(BACK_PHASES[view.phase] && view.canBack && canSteer(view));
      const restart = box.querySelector('[data-p="restart"]');
      restart.hidden = view.phase === 'lobby';
      restart.disabled = !(isLocalView(view) || view.isHost);
      restart.textContent = confirmRestart ? t('team.pause.sure', 'Tap again to restart') : t('team.pause.restart', 'Restart mission');
      box.querySelector('[data-note]').textContent = restart.disabled && !restart.hidden ? t('team.pause.hostonly', 'Only the host can restart the mission.') : '';
    }
    function openMenu() {
      if (open) return;
      open = true;
      confirmRestart = false;
      kit.sfx.tap();
      const view = v();
      if (view.phase && view.phase !== 'lobby' && !view.paused) ctx.send({ type: 'pause' });
      draw();
      const first = box.querySelector('[data-p="resume"]');
      if (first) first.focus();
    }
    function closeMenu() {
      open = false;
      confirmRestart = false;
      if (v().paused) ctx.send({ type: 'resume' });
      draw();
    }
    track.querySelector('[data-pause]').addEventListener('click', () => (open || v().paused ? closeMenu() : openMenu()));
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-p]');
      if (!b || b.disabled) return;
      const what = b.dataset.p;
      kit.sfx.tap();
      if (what === 'resume') closeMenu();
      else if (what === 'back') {
        closeMenu();
        ctx.send({ type: 'back' });
      } else if (what === 'restart') {
        if (!confirmRestart) {
          confirmRestart = true;
          return draw();
        }
        open = false;
        confirmRestart = false;
        ctx.send({ type: 'restart' });
        draw();
      } else if (what === 'quit') {
        open = false;
        kit.quit();
      }
    });
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.pointerLockElement) return; // Esc frees the mouse first
      e.preventDefault();
      if (open || v().paused) closeMenu();
      else openMenu();
    };
    document.addEventListener('keydown', onKey);
    const handle = {
      el: bar,
      update: draw,
      setSub(x) {
        sub = x == null ? null : Number(x);
        drawTracker(track, v(), sub);
      },
      openPause: openMenu,
      closePause: closeMenu,
      destroy() {
        gone = true;
        document.removeEventListener('keydown', onKey);
        bar.remove();
        root.classList.remove('ts-is-paused');
        if (chromeNow === handle) chromeNow = null;
      },
    };
    chromeNow = handle;
    draw();
    return handle;
  };

  // kit.tracker(el, view) or (el, { stage, ctx }): with the shared chrome on screen,
  // a handle to it (no second bar); otherwise a standalone bar in el.
  kit.tracker = function tracker(el, arg) {
    const ctx = arg && arg.ctx ? arg.ctx : null;
    if (chromeNow) {
      const c = chromeNow;
      return {
        update(view, opts) {
          if (opts && opts.sub != null) c.setSub(opts.sub);
          else c.update();
        },
        setSub: (x) => c.setSub(x),
        destroy() {
          c.setSub(null);
        },
        cleanup() {
          c.setSub(null);
        },
      };
    }
    if (!el || typeof document === 'undefined') return { update() {}, setSub() {}, destroy() {}, cleanup() {} };
    const holder = document.createElement('div');
    holder.className = 'ts-chrome ts-chrome-solo';
    holder.innerHTML = trackerHTML(false);
    el.appendChild(holder);
    let sub = null;
    let last = ctx ? ctx.view : arg;
    const draw = (view) => drawTracker(holder.querySelector('.ts-track'), (last = view || (ctx && ctx.view) || last), sub);
    draw(last);
    const off = () => holder.remove();
    return {
      update(view, opts) {
        if (opts && opts.sub != null) sub = opts.sub;
        draw(view);
      },
      setSub(x) {
        sub = x;
        draw();
      },
      destroy: off,
      cleanup: off,
    };
  };
  // kit.pauseMenu(el, { ctx }): with the shared chrome, nothing to mount (Esc and
  // the button are already there); otherwise a pause button in el.
  kit.pauseMenu = function pauseMenu(el, arg) {
    if (chromeNow) {
      const c = chromeNow;
      return { open: () => c.openPause(), close: () => c.closePause(), destroy() {}, cleanup() {} };
    }
    const ctx = arg && arg.ctx;
    if (!el || !ctx || typeof document === 'undefined') return { open() {}, close() {}, destroy() {}, cleanup() {} };
    const c = kit.chrome(el, ctx);
    c.el.querySelector('.ts-track').classList.add('ts-track-min');
    return { open: c.openPause, close: c.closePause, destroy: c.destroy, cleanup: c.destroy };
  };
  kit.openPause = () => chromeNow && chromeNow.openPause();
  kit.setProgress = (x) => chromeNow && chromeNow.setSub(x);

  // ---------- Shared page parts ----------
  const CHEV = '<svg class="ts-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHEV_BACK = '<svg class="ts-chev back" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function pageHTML(cls, inner) {
    return `<div class="ts-v2 ${cls}">
      <div class="ts-v2-body">${inner}</div>
      <footer class="ts-foot">
        <button type="button" class="ts-btn" data-nav="back">${CHEV_BACK}<span data-backlabel>${esc(t('team.back', 'Back'))}</span></button>
        <p class="ts-foot-msg" data-msg role="status"></p>
        <button type="button" class="ts-btn primary" data-nav="next"><span data-nextlabel>${esc(t('team.v2.next', 'Next'))}</span>${CHEV}</button>
      </footer>
    </div>`;
  }
  function setFoot(el, { back, next, backLabel, nextLabel, msg, hideBack, hideNext }) {
    const b = el.querySelector('[data-nav="back"]');
    const n = el.querySelector('[data-nav="next"]');
    if (b) {
      b.disabled = back === false;
      b.hidden = !!hideBack;
      if (backLabel) b.querySelector('[data-backlabel]').textContent = backLabel;
    }
    if (n) {
      n.disabled = next === false;
      n.hidden = !!hideNext;
      if (nextLabel) n.querySelector('[data-nextlabel]').textContent = nextLabel;
    }
    const m = el.querySelector('[data-msg]');
    if (m) m.textContent = msg || '';
  }
  // A rejected action, said once, calmly, in the footer.
  function errorWatcher(el) {
    let last = '';
    return (v) => {
      const key = v && v.error ? JSON.stringify(v.error) : '';
      if (key && key !== last && v.error.text) {
        const m = el.querySelector('[data-msg]');
        if (m) {
          m.textContent = v.error.text;
          m.classList.add('bad');
          setTimeout(() => m.classList.remove('bad'), 2600);
        }
      }
      last = key;
    };
  }
  const waitMsg = (v) => (v.phase === 'design' ? '' : t('team.v2.waithost', 'The host moves the crew on.'));

  // ---------- Lobby: room, difficulty, crew, destination ----------
  views.lobby = {
    mount(el, ctx) {
      const sim = ctx.sim || team.sim;
      const v0 = ctx.view;
      const mode = ctx.mode || v0.mode;
      const isNet = !isLocalView(v0);
      if (!v0.scenarioId || !sim.scenarios().some((s) => s.id === v0.scenarioId)) {
        if (v0.isHost) ctx.send({ type: 'setup', scenarioId: (sim.scenarios().find((s) => s.id === 'moon') || sim.scenarios()[0]).id });
      }
      let shown = null;
      let qrFor = null;
      const showError = errorWatcher(el);
      function render(step) {
        const v = ctx.view;
        const steps = v.setupSteps || ['difficulty', 'crew', 'destination'];
        const n = steps.indexOf(step) + 1;
        const eyebrow = `<p class="ts-eyebrow">${esc(t('team.v2.stepof', 'Step {n} of {m}', { n, m: steps.length }))}</p>`;
        let body = '';
        if (step === 'room') {
          body = `${eyebrow}<h1>${esc(t('team.v2.room.h', 'Invite your crew'))}</h1>
            <p class="ts-lede">${esc(mode === 'devices' ? t('team.lobby.share', 'Send this link to your crew') : t('team.lobby.joinat', 'Scan, or go to'))}</p>
            <div class="ts-roomcard"><div class="ts-qr-box" data-qr></div><div class="ts-room-txt"><span class="ts-join-url" data-url dir="ltr"></span><button type="button" class="ts-btn small" data-copy hidden>${esc(t('team.lobby.copy', 'Copy link'))}</button><small>${esc(t('team.lobby.code', 'Room code'))}</small><b class="ts-code" dir="ltr" data-code>····</b></div></div>
            <ul class="ts-people" data-people></ul><div class="ts-conn" data-conn role="status"></div>`;
        } else if (step === 'difficulty') {
          const diffs = sim.difficulties().filter((d) => d.id !== 'sandbox');
          body = `${eyebrow}<h1>${esc(t('team.v2.diff.h', 'How hard should it be?'))}</h1>
            <div class="ts-choices three">${diffs.map((d) => `<button type="button" class="ts-choice" data-diff="${esc(d.id)}"><b>${esc(d.title)}</b><span>${esc(t('team.v2.diff.' + d.id, ({ cadet: 'Fewer parts, more money. A good first flight.', engineer: 'The real trade-offs.', director: 'Tight money, hidden flaws, and a soft clock.' })[d.id] || d.note))}</span></button>`).join('')}</div>`;
        } else if (step === 'crew') {
          body = `${eyebrow}<h1>${esc(isNet ? t('team.v2.crew.hnet', 'Who will you be?') : t('team.v2.crew.h', 'Pick your astronaut'))}</h1>
            <p class="ts-lede">${esc(isNet ? t('team.v2.crew.subnet', 'Each player picks one. Their job is the part of the ship they build.') : t('team.v2.crew.sub', 'The other three fly with you. Your job is the part of the ship you know best.'))}</p>
            <div class="ts-crewpick">${crewList()
              .map(
                (m) => `<button type="button" class="ts-person" data-crew="${esc(m.id)}" data-job="${esc(m.job)}">
                  <span class="ts-person-face">${crewFace(m, 112)}</span>
                  <b>${esc(crewText(m, 'name') || m.name)}</b>
                  <span class="ts-person-job"><i class="ts-dot" style="background:var(--role-${esc(m.job)})"></i>${esc(jobName(m.job))}</span>
                  <small>${esc(crewText(m, 'personality'))}</small>
                  <em class="ts-person-who" data-who></em>
                </button>`
              )
              .join('')}</div>`;
        } else {
          body = `${eyebrow}<h1>${esc(t('team.v2.dest.h', 'Where are we going?'))}</h1>
            <div class="ts-worlds2">${sim
              .scenarios()
              .map(
                (s) => `<button type="button" class="ts-world2 ${worldClass(s)}" data-scn="${esc(s.id)}">
                  <span class="ts-world-disc" aria-hidden="true"></span>
                  <span class="ts-world2-txt"><b>${esc(s.title)}</b><small>${esc(s.question || '')}</small><em>${esc(hasLanding(s) ? t('team.lobby.land', 'You land') : t('team.v2.train', 'Training flight, orbit only'))}</em></span>
                </button>`
              )
              .join('')}</div>`;
        }
        el.innerHTML = pageHTML(`ts-lobby2 ts-step-${step}`, body);
        el.querySelector('.ts-v2-body').classList.toggle('wide', step === 'destination' || step === 'crew');
        qrFor = null;
      }
      function drawRoom(v) {
        const session = ctx.session || {};
        const code = session.code || v.code || null;
        const codeEl = el.querySelector('[data-code]');
        if (codeEl) codeEl.textContent = code || '····';
        if (code && qrFor !== code && team.net) {
          qrFor = code;
          // Same room over the LAN relay: a phone needs this computer's LAN address, not localhost.
          const local = /^(localhost|127\.)/.test(location.hostname);
          const ready = mode === 'phones' && local && session.transport !== 'webrtc' && team.net.info ? team.net.info() : Promise.resolve(null);
          ready.then((info) => drawLink(code, info && info.urls && info.urls[0] ? info.urls[0] : location.origin + location.pathname.replace(/\/[^/]*$/, '/')));
        }
        function drawLink(code, base) {
          const url = mode === 'devices' ? `${base.replace(/\/$/, '')}/index.html#j=${encodeURIComponent(code)}` : `${team.net.joinUrl(code, base)}${session.transport === 'webrtc' ? '&t=webrtc' : ''}`;
          el.querySelector('[data-url]').textContent = url.replace(/^https?:\/\//, '');
          const copy = el.querySelector('[data-copy]');
          copy.hidden = false;
          copy.onclick = () => {
            kit.sfx.tap();
            if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => (copy.textContent = t('team.lobby.copied', 'Copied')), () => {});
          };
          if (team.net.qr)
            team.net
              .qr(url, 5)
              .then((svg) => {
                const q = el.querySelector('[data-qr]');
                if (q) q.innerHTML = svg;
              })
              .catch(() => {});
        }
        const people = (v.players || []).filter((p) => !p.bot);
        el.querySelector('[data-people]').innerHTML = people.map((p) => `<li class="${p.connected ? '' : 'off'}"><i class="ts-dot"></i>${esc(p.name)}${v.me && p.id === v.me.id ? ` <small>(${esc(t('team.lobby.you', 'You'))})</small>` : ''}</li>`).join('') || (code ? '' : `<li class="off">${esc(t('team.lobby.opening', 'Opening the room…'))}</li>`);
        const conn = el.querySelector('[data-conn]');
        const failed = session.status === 'closed' || session.status === 'error';
        conn.innerHTML = failed
          ? `<p class="bad">${esc(kit.netMessage(session.status, session.statusCode, session.statusText))}</p><button type="button" class="ts-btn small" data-fallback="one">${esc(t('team.title.one', 'One screen'))}</button>`
          : (ctx.issues || []).map((i) => `<p class="bad">${esc(t('team.lobby.issue', 'A player could not connect.'))} ${esc(i.code ? t('team.net.msg.' + i.code, i.text || '') : i.text || '')}</p>`).join('');
        return people.filter((p) => p.connected).length;
      }
      function draw() {
        const v = ctx.view;
        if (!v || v.phase !== 'lobby') return;
        const step = v.setupStep || 'difficulty';
        if (step !== shown) {
          shown = step;
          render(step);
        }
        const steer = canSteer(v);
        const steps = v.setupSteps || [];
        const first = steps.indexOf(step) === 0;
        let ok = true;
        let msg = '';
        if (step === 'room') {
          const n = drawRoom(v);
          ok = n >= 2;
          msg = ok ? t('team.lobby.ready', '{n} players in. Ready when you are.', { n }) : t('team.lobby.waitcrew', 'Waiting for your crew to open the link.');
        } else if (step === 'difficulty') {
          el.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('on', b.dataset.diff === v.difficulty));
        } else if (step === 'crew') {
          const meId = v.me && v.me.id;
          const picks = v.crewPick || {};
          const names = {};
          (v.players || []).forEach((p) => (names[p.id] = p.name));
          el.querySelectorAll('[data-crew]').forEach((b) => {
            const id = b.dataset.crew;
            const by = Object.keys(picks).find((pid) => picks[pid] === id);
            const mine = !!by && (by === meId || isLocalView(v));
            const taken = !!by && !mine;
            b.classList.toggle('on', mine);
            b.classList.toggle('taken', taken);
            b.disabled = taken || (!v.me && !isLocalView(v));
            b.querySelector('[data-who]').textContent = mine ? t('team.v2.crew.you', 'You') : taken ? names[by] || '' : '';
          });
          if (isLocalView(v) && !picks.local) msg = t('team.v2.crew.pickone', 'Pick one to continue.');
          ok = !isLocalView(v) || !!picks.local;
        } else {
          el.querySelectorAll('[data-scn]').forEach((b) => b.classList.toggle('on', b.dataset.scn === v.scenarioId));
        }
        if (!steer) msg = t('team.v2.waithost', 'The host moves the crew on.');
        setFoot(el, {
          back: steer || first,
          next: steer && ok,
          hideBack: !steer && !first,
          hideNext: !steer,
          backLabel: first ? t('team.v2.totitle', 'Title') : t('team.back', 'Back'),
          nextLabel: step === 'destination' ? t('team.v2.tobrief', 'Meet KILO') : t('team.v2.next', 'Next'),
          msg,
        });
        showError(v);
      }
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        const v = ctx.view;
        if (b.dataset.diff) {
          if (!canSteer(v)) return;
          kit.sfx.pick();
          prefs.set('difficulty', b.dataset.diff);
          ctx.send({ type: 'setup', difficulty: b.dataset.diff });
        } else if (b.dataset.crew) {
          kit.sfx.pick();
          ctx.send({ type: 'setRole', role: b.dataset.job, crew: b.dataset.crew });
          try {
            prefs.set('crew', b.dataset.crew);
          } catch (err) {}
        } else if (b.dataset.scn) {
          if (!canSteer(v)) return;
          kit.sfx.pick();
          prefs.set('scenario', b.dataset.scn);
          ctx.send({ type: 'setup', scenarioId: b.dataset.scn });
        } else if (b.dataset.fallback === 'one') go('team', { mode: 'one' });
        else if (b.dataset.nav === 'back') {
          kit.sfx.tap();
          const steps = v.setupSteps || [];
          if (steps.indexOf(v.setupStep) <= 0) go('start');
          else ctx.send({ type: 'back' });
        } else if (b.dataset.nav === 'next') {
          kit.sfx.go();
          ctx.send({ type: 'forward' });
        }
      });
      draw();
      return { update: draw, cleanup() {} };
    },
  };

  // ---------- Briefing: KILO says what this mission is for ----------
  views.brief = {
    mount(el, ctx) {
      const s = sc(ctx);
      el.innerHTML = pageHTML(
        'ts-brief2',
        `<div class="ts-brief-card ${worldClass(s)}">
          <span class="ts-world-disc big" aria-hidden="true"></span>
          <div class="ts-brief-txt">
            <p class="ts-eyebrow">${esc(t('team.v2.brief.k', 'Your mission'))}</p>
            <h1>${esc(s.title)}</h1>
            <p class="ts-lede">${esc(s.question || '')}</p>
            <p class="ts-goal"><b>${esc(t('team.v2.brief.goal', 'Goal'))}</b> ${esc(s.objective || '')}</p>
          </div>
        </div>
        <div class="ts-brief-kilo" data-kilo></div>`
      );
      const lines = kiloLines(s.id, 'briefing');
      const kiloHost = el.querySelector('[data-kilo]');
      if (lines.length) kiloSay(kiloHost, lines, { inline: true, keep: true });
      else kiloHost.innerHTML = `<p class="ts-lede">${esc(t('team.v2.point', 'Design a spacecraft, fly it, and bring back the science. Every kilogram counts.'))}</p>`;
      const showError = errorWatcher(el);
      function draw() {
        const v = ctx.view;
        const steer = canSteer(v);
        setFoot(el, { back: steer, next: steer, hideNext: !steer, hideBack: !steer, nextLabel: t('team.v2.startbuild', 'Set success criterion'), msg: steer ? '' : waitMsg(v) });
        showError(v);
      }
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-nav]');
        if (!b || b.disabled) return;
        kit.sfx.tap();
        ctx.send({ type: b.dataset.nav === 'next' ? 'forward' : 'back' });
      });
      draw();
      return {
        update: draw,
        cleanup() {
          kiloClear();
        },
      };
    },
  };

  // ---------- The build: one component per step ----------
  const NUM_ORDER = ['powerOutW', 'liftKg', 'fuelKg', 'years', 'massKg', 'powerW', 'dataGb', 'costM'];
  function numsHTML(nums, stepId) {
    const label = {
      massKg: t('team.num.mass', 'Mass'),
      powerW: t('team.num.uses', 'Uses'),
      powerOutW: t('team.num.makes', 'Makes'),
      costM: t('team.num.cost', 'Cost'),
      fuelKg: t('team.num.fuel', 'Fuel'),
      liftKg: stepId === 'landing' ? t('team.num.home', 'Brings home') : t('team.num.lifts', 'Lifts'),
      years: t('team.num.length', 'Length'),
      dataGb: t('team.num.data', 'Data'),
    };
    const val = (k, x) => {
      if (k === 'costM') return ltr(`$${kit.fmt(x, x < 10 && x % 1 ? 1 : 0)}M`);
      if (k === 'powerW' || k === 'powerOutW') return ltr(`${kit.fmt(x)} W`);
      if (k === 'years') return x === 1 ? t('team.num.year1', '1 year') : t('team.num.years', '{n} years', { n: x });
      if (k === 'dataGb') return ltr(`${kit.fmt(x, x < 10 && x % 1 ? 1 : 0)} Gb/d`);
      return ltr(`${kit.fmt(x, x < 10 && x % 1 ? 1 : 0)} kg`);
    };
    return NUM_ORDER.filter((k) => nums[k] != null && !(k === 'powerW' && !nums[k]))
      .slice(0, 3)
      .map((k) => `<span><small>${esc(label[k])}</small><b>${esc(val(k, nums[k]))}</b></span>`)
      .join('');
  }
  const RES_EPS = { mass: 0.5, power: 0.5, budget: 0.5, data: 0.05, comms: 0.05, time: 0.05 };
  function resLine(id, x) {
    const f = (n, d) => kit.fmt(n, d);
    switch (id) {
      case 'mass':
        return x.limit ? t('team.res2.mass', '{v} of {l} kg the rocket lifts', { v: ltr(f(x.value)), l: ltr(f(x.limit)) }) : ltr(`${f(x.value)} kg`);
      case 'power':
        return t('team.res2.power', 'Makes {v} W, uses {l} W', { v: ltr(f(x.value)), l: ltr(f(x.limit)) });
      case 'budget':
        return x.limit ? t('team.res2.budget', '${v}M of ${l}M', { v: ltr(f(x.value)), l: ltr(f(x.limit)) }) : ltr(`$${f(x.value)}M`);
      case 'data':
        return t('team.res2.data', 'Needs {v} of {l} Gb', { v: ltr(f(x.value, x.value < 10 ? 1 : 0)), l: ltr(f(x.limit)) });
      case 'comms':
        return t('team.res2.comms', 'Sends {v} Gb a day home; the instruments make {l}', { v: ltr(f(x.value, x.value < 10 ? 1 : 0)), l: ltr(f(x.limit, x.limit < 10 ? 1 : 0)) });
      case 'time':
        return x.limit ? t('team.res2.time', 'Ready in {v} of {l} months', { v: ltr(f(x.value, 1)), l: ltr(f(x.limit)) }) : ltr(`${f(x.value, 1)}`);
      default:
        return '';
    }
  }
  function resFrac(id, x) {
    if (!x) return 0;
    if (id === 'power' || id === 'comms') return x.value > 0 ? Math.min(1, (x.limit || 0) / x.value) : 1;
    return x.limit ? Math.min(1, Math.abs(x.value) / Math.abs(x.limit)) : 0.5;
  }
  function meterHTML(ids, res) {
    return ids
      .map((id) => {
        const r = RES.find((q) => q.id === id);
        const x = res && res[id];
        if (!r || !x) return '';
        return `<div class="ts-meter" data-status="${esc(x.status || 'ok')}"><span class="ts-meter-name"><i>${RES_ICON[id]}</i>${esc(r.name())}</span><span class="ts-meter-val">${esc(resLine(id, x))}</span><span class="ts-meter-bar"><i style="inline-size:${(resFrac(id, x) * 100).toFixed(1)}%"></i></span></div>`;
      })
      .join('');
  }
  kit.meterHTML = meterHTML;

  function cardArt(stepId, cardId, v, catalog) {
    if (stepId !== 'orbit' && stepId !== 'rocket') return '';
    const key = stepId === 'orbit' ? 'orbit' : 'launcher';
    const group = Object.values((catalog && catalog.roles) || {})
      .flat()
      .find((g) => g.key === key);
    const o = group && group.options.find((x) => x.id === cardId);
    if (!o) return '';
    if (stepId === 'orbit') return `<span class="ts-card-art">${kit.orbitArt(o)}</span>`;
    const tallest = Math.max(...group.options.map((x) => kit.rocketNums(x, v.design).h || 40));
    return `<span class="ts-card-art rocket">${kit.rocketArt(o, tallest, v.design)}</span>`;
  }

  views.design = {
    mount(el, ctx) {
      const v0 = ctx.view;
      const s = sc(ctx);
      const local = isLocalView(v0);
      el.innerHTML = pageHTML(
        'ts-build',
        `<nav class="ts-stepbar" data-stepbar aria-label="${esc(t('team.v2.steps', 'Build steps'))}"></nav>
        <p class="ts-eyebrow" data-count></p>
        <h1 data-ask></h1>
        <p class="ts-owner" data-owner hidden></p>
        <div class="ts-build-grid">
          <section class="ts-build-main">
            <div class="ts-cards" data-cards></div>
            <div class="ts-kilo-slot ts-kilo-under" data-kilo></div>
          </section>
          <aside class="ts-build-side">
            <div class="ts-craftbox" data-craft></div>
            <div class="ts-meters" data-meters></div>
          </aside>
        </div>`
      );
      const q = (x) => el.querySelector(x);
      const craft = kit.mountCraft(q('[data-craft]'), s.dest);
      let catalog = null;
      try {
        catalog = ctx.sim.catalog(v0.scenarioId, v0.difficulty);
      } catch (e) {}
      let shownStep = -1;
      let cardsSig = '';
      let lastPicks = '';
      const showError = errorWatcher(el);

      function drawStepbar(v, steps) {
        const steer = canSteer(v) || local;
        q('[data-stepbar]').innerHTML = steps
          .map((st, i) => `<button type="button" class="${i < v.buildStep ? 'done' : i === v.buildStep ? 'now' : ''}" data-goto="${i}" ${steer ? '' : 'disabled'}><i class="ts-dot" style="background:var(--role-${esc(st.role)})"></i><span>${esc(st.title)}</span></button>`)
          .join('');
      }
      function drawCards(v, st) {
        const cards = ctx.sim.stepCards(v.design, st.id);
        const sug = (v.suggestions || {})[st.id];
        const sig = JSON.stringify([st.id, cards.map((c) => [c.id, c.on, c.pros, c.cons, c.nums, c.flies]), sug, SMD.lang ? SMD.lang() : '']);
        if (sig === cardsSig) return cards;
        cardsSig = sig;
        const owner = local || myRoles(v).indexOf(st.role) >= 0;
        q('[data-cards]').className = `ts-cards n${cards.length}`;
        q('[data-cards]').innerHTML = cards
          .map(
            (c) => `<button type="button" class="ts-card ${c.on ? 'on' : ''} ${c.flies ? '' : 'nofly'}" data-opt="${esc(c.id)}" aria-pressed="${c.on}">
              ${cardArt(st.id, c.id, v, catalog)}
              <span class="ts-card-top"><b class="ts-card-name" dir="auto">${esc(c.name)}</b>${c.on ? `<span class="ts-card-tag">${esc(st.multi ? t('team.v2.card.added', 'Added') : t('team.v2.card.fitted', 'Fitted'))}</span>` : ''}</span>
              ${c.note ? `<span class="ts-card-note">${esc(c.note)}</span>` : ''}
              <ul class="ts-card-lines">${c.pros.map((x) => `<li class="pro"><i aria-hidden="true">✓</i>${esc(x)}</li>`).join('')}${c.cons.map((x) => `<li class="con"><i aria-hidden="true">✗</i>${esc(x)}</li>`).join('')}</ul>
              <span class="ts-card-nums">${numsHTML(c.nums, st.id)}</span>
              ${sug && sug.option === c.id ? `<span class="ts-card-sug">${esc(t('team.v2.suggests', '{name} suggests this', { name: sug.name || '' }))}</span>` : ''}
              ${!owner ? `<span class="ts-card-act">${esc(t('team.v2.suggest', 'Suggest'))}</span>` : st.multi && !c.on ? `<span class="ts-card-act">${esc(t('team.v2.card.add', 'Add'))}</span>` : st.multi ? `<span class="ts-card-act">${esc(t('team.v2.card.remove', 'Remove'))}</span>` : ''}
            </button>`
          )
          .join('');
        return cards;
      }
      function affected(cards, st) {
        const out = [];
        RES.forEach((r) => {
          const vals = cards.map((c) => c.resources && c.resources[r.id] && c.resources[r.id].value).filter((x) => Number.isFinite(x));
          if (vals.length > 1 && Math.max(...vals) - Math.min(...vals) > RES_EPS[r.id]) out.push(r.id);
        });
        const order = st.res.concat(RES.map((r) => r.id));
        const list = order.filter((id, i) => order.indexOf(id) === i && out.indexOf(id) >= 0).slice(0, 3);
        return list.length ? list : st.res.slice(0, 2);
      }
      function draw() {
        const v = ctx.view;
        if (!v || !v.design) return;
        const steps = stepsOf(v);
        const i = Math.max(0, Math.min(steps.length - 1, v.buildStep || 0));
        const st = steps[i];
        if (!st) return;
        const fresh = i !== shownStep;
        if (fresh) {
          shownStep = i;
          cardsSig = '';
          drawStepbar(v, steps);
          q('[data-count]').textContent = t('team.v2.buildof', 'Part {n} of {m} · {name}', { n: i + 1, m: steps.length, name: st.title });
          let ask = st.ask;
          if (st.multi) ask += ` ${t('team.v2.upto', '(up to {n})', { n: st.max })}`;
          q('[data-ask]').textContent = ask;
          const moment = 'step.' + (STEP_MOMENT[st.id] || st.id);
          kiloSay(q('[data-kilo]'), kiloLines(s.id, moment), { inline: true, keep: true, auto: true, size: 64 });
        }
        const cards = drawCards(v, st);
        const owner = local || myRoles(v).indexOf(st.role) >= 0;
        const ownerBox = q('[data-owner]');
        ownerBox.hidden = local;
        if (!local) {
          const who = v.roles && v.roles[st.role];
          ownerBox.innerHTML = owner
            ? `<i class="ts-dot" style="background:var(--role-${esc(st.role)})"></i>${esc(t('team.v2.yourstep', 'Your step, as {job}. The crew can suggest.', { job: jobName(st.role) }))}`
            : `<i class="ts-dot" style="background:var(--role-${esc(st.role)})"></i>${esc(t('team.v2.theirstep', '{name} picks this one ({job}). Tap a card to suggest it.', { name: who ? who.name : jobName(st.role), job: jobName(st.role) }))}`;
        }
        const picks = JSON.stringify(v.design.picks);
        if (picks !== lastPicks) {
          if (lastPicks) kit.sfx.pick();
          lastPicks = picks;
          try {
            craft.set(ctx.sim.toCraftDesign(v.design));
          } catch (e) {}
          drawStepbar(v, steps);
        }
        q('[data-meters]').innerHTML = meterHTML(affected(cards, st), v.resources);
        const steer = canSteer(v);
        const last = i === steps.length - 1;
        let msg = '';
        if (st.multi) {
          const n = (v.design.picks.instruments || []).length;
          msg = t('team.v2.fitted', '{n} of {m} fitted', { n, m: st.max });
        }
        if (!steer) {
          const who = v.roles && v.roles[st.role];
          msg = t('team.v2.waitfor', 'Waiting for {name}', { name: who ? who.name : jobName(st.role) });
        }
        if (v.clock && v.clock.soft) msg = `${msg ? msg + ' · ' : ''}${v.clock.overtime ? t('team.v2.overtime', 'Over time') : t('team.v2.timeleft', '{t} left', { t: kit.clockText(v.clock) })}`;
        setFoot(el, {
          back: steer,
          next: steer,
          hideBack: !steer,
          hideNext: !steer,
          backLabel: i === 0 ? t('team.v2.tobriefing', 'Briefing') : t('team.back', 'Back'),
          nextLabel: last ? t('team.v2.toreview', 'Next: review and launch') : t('team.v2.nextstep', 'Next: {name}', { name: steps[i + 1].title }),
          msg,
        });
        showError(v);
      }
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        const v = ctx.view;
        const steps = stepsOf(v);
        const st = steps[v.buildStep];
        if (b.dataset.opt && st) {
          const owner = local || myRoles(v).indexOf(st.role) >= 0;
          if (owner) {
            kit.sfx.tap();
            ctx.send({ type: 'build', step: st.id, option: b.dataset.opt });
          } else {
            kit.sfx.ping();
            ctx.send({ type: 'suggest', step: st.id, option: b.dataset.opt });
          }
        } else if (b.dataset.goto) {
          kit.sfx.tap();
          ctx.send({ type: 'stepTo', index: Number(b.dataset.goto) });
        } else if (b.dataset.nav) {
          kit.sfx.tap();
          ctx.send({ type: b.dataset.nav === 'next' ? 'forward' : 'back' });
        }
      });
      draw();
      return {
        update: draw,
        cleanup() {
          craft.destroy();
          kiloClear();
        },
      };
    },
  };

  // ---------- Choose the measurable success criterion before spacecraft design ----------
  views.questions = {
    mount(el, ctx) {
      const s = sc(ctx);
      el.innerHTML = pageHTML(
        'ts-questions',
        `<p class="ts-eyebrow">${esc(t('team.v2.q.k', 'The question'))}</p>
        <h1>${esc(t('team.v2.q.h', 'What will count as mission success?'))}</h1>
        <p class="ts-lede">${esc(s.question || '')}</p>
        <p class="ts-question-note">${esc(t('team.v2.q.note', 'Choose the science result to prioritize. Your spacecraft design will be built around this requirement.'))}</p>
        <div class="ts-choices two" data-reqs></div>
        <div class="ts-kilo-slot wide" data-kilo></div>`
      );
      let lastSel = null;
      let said = false;
      const showError = errorWatcher(el);
      function draw() {
        const v = ctx.view;
        if (!v) return;
        const choices = s.requirements || [];
        const sel = v.requirementId;
        el.querySelector('[data-reqs]').innerHTML = choices
          .map((f) => `<button type="button" class="ts-choice ${f.id === sel ? 'on' : ''}" data-req="${esc(f.id)}" aria-pressed="${f.id === sel ? 'true' : 'false'}"><b>${esc(f.title)}</b><span>${esc(f.text)}</span></button>`)
          .join('');
        if (sel !== lastSel || !said) {
          const f = choices.find((x) => x.id === sel);
          if (f) {
            const lines = (said ? [] : kiloLines(s.id, 'questions')).concat(kiloLines(s.id, 'requirement', { name: f.title }));
            kiloSay(el.querySelector('[data-kilo]'), lines, { inline: true, keep: true, auto: true, size: 64 });
            said = true;
          }
          lastSel = sel;
        }
        const steer = canSteer(v);
        setFoot(el, { back: steer, next: steer, hideBack: !steer, hideNext: !steer, backLabel: t('team.v2.tobriefing', 'Back to briefing'), nextLabel: t('team.v2.tobuild', 'Start spacecraft design'), msg: steer ? '' : waitMsg(v) });
        showError(v);
      }
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        if (b.dataset.req) {
          kit.sfx.pick();
          ctx.send({ type: 'pick', requirement: b.dataset.req });
        } else if (b.dataset.nav) {
          kit.sfx.tap();
          ctx.send({ type: b.dataset.nav === 'next' ? 'forward' : 'back' });
        }
      });
      draw();
      return {
        update: draw,
        cleanup() {
          kiloClear();
        },
      };
    },
  };

  // ---------- Review and launch: one card, and a Fix it for anything that will not work ----------
  // Which build step fixes each check (sim.checks ids).
  const FIX_STEP = { launcher: ['rocket'], power: ['power', 'batteries'], battery: ['batteries', 'power'], comms: ['radio'], recorder: ['recorder', 'radio'], instruments: ['instruments'], time: ['lifetime', 'instruments'], life: ['computer', 'lifetime', 'orbit'], budget: ['instruments', 'rocket'] };
  views.lock = {
    mount(el, ctx) {
      const s = sc(ctx);
      el.innerHTML = pageHTML(
        'ts-review',
        `<p class="ts-eyebrow">${esc(t('team.v2.review.k', 'Review'))}</p>
        <h1>${esc(t('team.v2.review.h', 'Ready to launch?'))}</h1>
        <div class="ts-review-card">
          <div class="ts-review-side"><div class="ts-craftbox small" data-craft></div><div class="ts-kilo-slot" data-kilo></div></div>
          <div class="ts-review-main">
            <ul class="ts-parts" data-parts></ul>
            <div class="ts-problems" data-problems></div>
          </div>
        </div>
        <div class="ts-meters row" data-meters></div>
        <div class="ts-votes" data-votes></div>`
      );
      const q = (x) => el.querySelector(x);
      const craft = kit.mountCraft(q('[data-craft]'), s.dest);
      let lastPicks = '';
      let saidProblem = null;
      let lastArmed = false;
      const showError = errorWatcher(el);
      function stepIndexFor(checkId) {
        const steps = stepsOf(ctx.view);
        for (const id of FIX_STEP[checkId] || []) {
          const i = steps.findIndex((x) => x.id === id);
          if (i >= 0) return i;
        }
        return -1;
      }
      function draw() {
        const v = ctx.view;
        if (!v || !v.design) return;
        const steps = stepsOf(v);
        const picks = JSON.stringify(v.design.picks);
        if (picks !== lastPicks) {
          lastPicks = picks;
          try {
            craft.set(ctx.sim.toCraftDesign(v.design));
          } catch (e) {}
        }
        const steer = canSteer(v);
        q('[data-parts]').innerHTML = steps
          .map((st, i) => {
            const now = ctx.sim.stepChoice(v.design, st);
            const names = (Array.isArray(now) ? now : now ? [now] : []).map((id) => (st.options.find((o) => o.id === id) || {}).name).filter(Boolean);
            const custom = !names.length ? t('team.v2.custom', 'Custom') : names.join(', ');
            return `<li><span>${esc(st.title)}</span><b dir="auto">${esc(custom)}</b>${steer ? `<button type="button" class="ts-link" data-goto="${i}">${esc(t('team.v2.change', 'Change'))}</button>` : ''}</li>`;
          })
          .join('');
        const bad = (v.checks || []).filter((c) => !c.ok);
        const hard = bad.filter((c) => c.hard);
        q('[data-problems]').innerHTML = bad.length
          ? bad
              .slice(0, 3)
              .map((c) => {
                const i = stepIndexFor(c.id);
                return `<p class="${c.hard ? 'hard' : ''}"><i aria-hidden="true">✗</i><span>${esc(c.text)}</span>${i >= 0 && steer ? `<button type="button" class="ts-btn small" data-goto="${i}">${esc(t('team.v2.fixit', 'Fix it'))}</button>` : ''}</p>`;
              })
              .join('') + (hard.length ? '' : `<p class="note">${esc(t('team.v2.mayfly', 'It can still fly. It might not go well.'))}</p>`)
          : `<p class="ok"><i aria-hidden="true">✓</i><span>${esc(t('team.v2.allgood', 'Everything checks out.'))}</span></p>`;
        q('[data-meters]').innerHTML = meterHTML(['mass', 'power', 'budget', 'data', 'comms', 'time'], v.resources);
        const humans = (v.players || []).filter((p) => !p.bot);
        const votes = v.votes || {};
        const voted = (p) => (p.roles || []).length > 0 && p.roles.every((r) => votes[r]);
        q('[data-votes]').innerHTML = isLocalView(v) ? '' : humans.map((p) => `<span class="${voted(p) ? 'on' : ''}"><i class="ts-dot"></i>${esc(p.name)} <small>${esc(voted(p) ? t('team.vote.ready', 'Ready') : t('team.vote.wait', 'Waiting'))}</small></span>`).join('');
        const mine = myRoles(v);
        const meReady = mine.length > 0 && mine.every((r) => votes[r]);
        const problem = hard[0] ? hard[0].text : null;
        if (problem !== saidProblem) {
          saidProblem = problem;
          kiloSay(q('[data-kilo]'), problem ? kiloLines(s.id, 'review.problem', { problem }) : kiloLines(s.id, 'review'), { inline: true, keep: true, auto: true, size: 64 });
        }
        if (v.armed && !lastArmed) kit.sfx.go();
        lastArmed = !!v.armed;
        setFoot(el, {
          back: steer,
          hideBack: !steer,
          next: !hard.length && !v.armed && !!v.me,
          nextLabel: v.armed ? t('team.lock.armed', 'Launching') : meReady && !isLocalView(v) ? t('team.v2.unready', 'Not ready yet') : t('team.v2.launch', 'Launch'),
          backLabel: t('team.v2.toq', 'Questions'),
          msg: hard.length ? hard[0].text : !isLocalView(v) && meReady ? t('team.v2.waitall', 'Waiting for the whole crew to press Launch.') : '',
        });
        showError(v);
      }
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        const v = ctx.view;
        if (b.dataset.goto) {
          kit.sfx.tap();
          ctx.send({ type: 'stepTo', index: Number(b.dataset.goto) });
        } else if (b.dataset.nav === 'back') {
          kit.sfx.tap();
          ctx.send({ type: 'back' });
        } else if (b.dataset.nav === 'next') {
          const mine = myRoles(v);
          const votes = v.votes || {};
          const meReady = mine.length > 0 && mine.every((r) => votes[r]);
          kit.sfx.vote();
          ctx.send({ type: 'vote', yes: isLocalView(v) ? true : !meReady });
        }
      });
      draw();
      return {
        update: draw,
        cleanup() {
          craft.destroy();
          kiloClear();
        },
      };
    },
  };
})();
