// Mission Sprint: the debrief (docs/TEAM.md, calmed by docs/TEAM-V2.md). Falling
// dominoes that explain the whole trip, the score, a tombstone you can share when
// it died, KILO's one-line verdict and the one obvious next thing: fly again with
// one change. (The Failure Museum, leaderboard and hangar code stays here, unlinked.)
//
// Every number and chain line comes from the sim; this file is presentation.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};
  const team = SMD.team;
  const views = (team.views = team.views || {});
  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : e);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '–');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const reduced = () => {
    try {
      return !!(SMD.settings && SMD.settings.reducedMotion) || (globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  };
  const beep = (...a) => {
    try {
      SMD.audio && SMD.audio.beep(...a);
    } catch (e) {}
  };
  const seq = (notes, step, type, v) => notes.forEach((f, i) => setTimeout(() => beep(f, 0.18, type, v), i * step));
  const roleName = (r) => (team.kit && team.kit.roleName ? team.kit.roleName(r) : r);
  const ROLE_COLOR = { planner: 'var(--role-planner)', engineer: 'var(--role-engineer)', scientist: 'var(--role-scientist)', comms: 'var(--role-comms)' };
  const store = () =>
    SMD.store || {
      get: (k) => {
        try {
          return localStorage.getItem(k);
        } catch (e) {
          return null;
        }
      },
      set: (k, v) => {
        try {
          localStorage.setItem(k, v);
        } catch (e) {}
      },
    };
  const readJSON = (k, fb) => {
    try {
      const raw = store().get(k);
      return raw ? JSON.parse(raw) : fb;
    } catch (e) {
      return fb;
    }
  };
  const writeJSON = (k, v) => {
    try {
      store().set(k, JSON.stringify(v));
    } catch (e) {}
  };
  const uid = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const ltr = (s) => (SMD.dir && SMD.dir() === 'rtl' ? `⁦${s}⁩` : s);

  // ---------- Reading the sim's results ----------
  // v3 (docs/TEAM-V3.md item 12): requirements met, science returned, efficiency, teamwork,
  // each with the items its points came from; the old four-axis score still reads.
  const AXIS_MAX = { requirements: 300, science: 300, efficiency: 200, teamwork: 200, survival: 200 };
  const AXES = [
    { id: 'requirements', label: () => t('team.score.requirements', 'Requirements met'), color: 'var(--role-planner)' },
    { id: 'science', label: () => t('team.score.science', 'Science'), color: 'var(--role-scientist)' },
    { id: 'efficiency', label: () => t('team.score.efficiency', 'Efficiency'), color: 'var(--role-engineer)' },
    { id: 'survival', label: () => t('team.score.survival', 'Survival'), color: 'var(--role-engineer)' },
    { id: 'teamwork', label: () => t('team.score.teamwork', 'Teamwork'), color: 'var(--role-comms)' },
  ];
  function axesOf(score) {
    const s = score || {};
    const src = s.axes || s.parts || s.breakdown || s;
    const v3 = !!(s.axes && typeof s.axes === 'object');
    return AXES.filter((a) => (v3 ? src[a.id] != null : a.id !== 'requirements')).filter((a) => !(v3 && a.id === 'survival' && src.survival == null)).map((a) => {
      const raw = src[a.id] && typeof src[a.id] === 'object' ? src[a.id] : { value: src[a.id] };
      const value = Number(raw.value != null ? raw.value : raw.score != null ? raw.score : raw.points) || 0;
      const items = Array.isArray(raw.items) ? raw.items.filter((x) => x && typeof x === 'object') : [];
      return { id: a.id, label: a.label(), color: a.color, value, max: Number(raw.max) || AXIS_MAX[a.id] || 250, note: raw.why || raw.note || '', items };
    });
  }
  // The outcome rule: a lost or failed mission can never outscore a successful one.
  function outcomeOf(score) {
    const o = score && score.outcome;
    if (!o || typeof o !== 'object') return null;
    return { id: o.id || '', title: o.title || '', adjust: Number(o.adjust) || 0, why: o.why || '', band: Array.isArray(o.band) ? o.band : null, earned: Number(o.earned) };
  }
  const signed = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `\u2212${fmt(Math.abs(n))}` : '0');
  // Every point, where it came from: one block per axis, one line per item, then the outcome rule.
  function pointsHtml(score) {
    const axes = axesOf(score);
    const oc = outcomeOf(score);
    const blocks = axes
      .map((a) => {
        const items = a.items.length
          ? `<ul class="tf-pts-items">${a.items
              .map((it) => {
                const pts = Number(it.points) || 0;
                const mx = Number(it.max);
                const state = it.met === true ? 'ok' : it.met === false ? 'no' : '';
                return `<li data-st="${state}"><span class="tf-pts-mark" aria-hidden="true">${state === 'ok' ? '\u2713' : state === 'no' ? '\u2715' : '\u00b7'}</span><span class="tf-pts-label"><b>${esc(it.label || it.id || '')}</b>${it.why ? `<small>${esc(it.why)}</small>` : ''}</span><span class="tf-pts-num" dir="ltr">${esc(fmt(pts))}${Number.isFinite(mx) ? ` / ${esc(fmt(mx))}` : ''}</span></li>`;
              })
              .join('')}</ul>`
          : a.note
            ? `<p class="tf-pts-note">${esc(a.note)}</p>`
            : '';
        return `<section class="tf-pts-axis" style="--c:${a.color}"><header><h3>${esc(a.label)}</h3><b dir="ltr">${esc(fmt(Math.round(a.value)))} / ${esc(fmt(a.max))}</b></header>${a.items.length && a.note ? `<p class="tf-pts-note">${esc(a.note)}</p>` : ''}${items}</section>`;
      })
      .join('');
    const rule = oc
      ? `<section class="tf-pts-axis tf-pts-rule" data-adj="${oc.adjust < 0 ? 'down' : oc.adjust > 0 ? 'up' : '0'}"><header><h3>${esc(t('team.deb.rule', 'Outcome rule'))}${oc.title ? `: ${esc(oc.title)}` : ''}</h3><b dir="ltr">${esc(signed(Math.round(oc.adjust)))}</b></header>${oc.why ? `<p class="tf-pts-note">${esc(oc.why)}</p>` : ''}${oc.band ? `<p class="tf-pts-note">${esc(t('team.deb.band', 'This outcome scores between {a} and {b}.', { a: fmt(oc.band[0]), b: fmt(oc.band[1]) }))}</p>` : ''}</section>`
      : '';
    return `<div class="tf-pts">${blocks}${rule}<p class="tf-pts-total"><span>${esc(t('team.deb.total', 'Total'))}</span><b dir="ltr">${esc(fmt(Math.round(totalOf(score))))} / 1,000</b></p></div>`;
  }

  // ---------- The crew on the surface (docs/TEAM-V3.md items 5 and 6) ----------
  // Each astronaut as the character picked in setup, and what their job did down there.
  function crewFace(p, size) {
    const C = team.crew;
    if (!C) return '';
    try {
      const m = p.crewId ? C.byId(p.crewId, C.isCustom && C.isCustom(p.crewId) && p.playerName ? { name: p.playerName } : undefined) : C.byJob && C.byJob(p.job || p.role);
      return m ? C.portrait(m, { size }) : '';
    } catch (e) {
      return '';
    }
  }
  function jobDid(p, surface) {
    const n = (k) => Number(p[k]) || 0;
    const job = p.job || p.role;
    const parts = [];
    if (job === 'scientist') parts.push(n('scans') ? t('team.deb.did.scans', 'scanned {n} sites', { n: n('scans') }) : t('team.deb.did.noscans', 'scanned no sites'));
    if (job === 'comms') {
      parts.push(n('plants') ? t('team.deb.did.plant', 'planted the dish') : t('team.deb.did.noplant', 'never planted the dish'));
      if (n('heldS')) parts.push(t('team.deb.did.held', 'ran the uplink for {s} s', { s: n('heldS') }));
    }
    if (job === 'engineer') {
      const f = (surface && surface.faults) || {};
      if (n('repairs') || f.seen) parts.push(t('team.deb.did.repairs', 'fixed {n} of {of} lander faults', { n: n('repairs'), of: Math.max(n('repairs'), Number(f.seen) || 0) }));
      if (n('patches')) parts.push(t('team.deb.did.patches', 'patched {n} suits', { n: n('patches') }));
      if (!parts.length) parts.push(t('team.deb.did.calm', 'kept the lander running'));
    }
    if (job === 'planner') {
      if (n('routes')) parts.push(t('team.deb.did.routes', 'marked {n} sites for the scientist', { n: n('routes') }));
      if (n('calls')) parts.push(t('team.deb.did.call', 'called everyone home'));
      else if (surface && surface.result === 'stranded') parts.push(t('team.deb.did.nocall', 'did not call everyone home in time'));
      if (!parts.length) parts.push(t('team.deb.did.watch', 'watched the clock'));
    }
    if (n('carried')) parts.push(t('team.deb.did.carried', 'samples carried: {n}', { n: n('carried') }));
    if (n('returns')) parts.push(t('team.deb.did.returns', 'walks home on autopilot: {n}', { n: n('returns') }));
    const line = parts.join(t('team.deb.did.sep', ', '));
    return line ? line.charAt(0).toUpperCase() + line.slice(1) + t('team.deb.did.end', '.') : '';
  }
  function crewHtml(surface) {
    const per = surface && Array.isArray(surface.perPlayer) ? surface.perPlayer : [];
    if (!per.length) return '';
    const order = ['planner', 'engineer', 'scientist', 'comms'];
    const rows = per.slice().sort((a, b) => order.indexOf(a.job || a.role) - order.indexOf(b.job || b.role));
    return `<section class="tf-crewdid"><h2>${esc(t('team.deb.crew', 'Your crew on the surface'))}</h2><ul>${rows
      .map((p) => {
        const job = p.job || p.role;
        const who = p.playerName && !p.isBot ? `${p.name} \u00b7 ${p.playerName}` : p.name;
        return `<li style="--c:${ROLE_COLOR[job] || '#fff'}">${crewFace(p, 52)}<div><p class="tf-crewdid-who"><b>${esc(who || roleName(job))}</b><span>${esc(roleName(job))}</span></p><p class="tf-crewdid-did">${esc(jobDid(p, surface))}</p></div></li>`;
      })
      .join('')}</ul></section>`;
  }
  const totalOf = (score) => {
    if (!score) return 0;
    if (Number.isFinite(score.total)) return score.total;
    return axesOf(score).reduce((a, b) => a + b.value, 0);
  };
  const medalsOf = (score) => {
    if (!score) return [];
    if (score.medals) return Array.isArray(score.medals) ? score.medals : [score.medals];
    if (score.medal && score.medal !== 'none') return [{ name: score.medalTitle || score.medal, id: score.medal }];
    return [];
  };

  // Surface summary reader: tolerant of the field names the surface sim settles on.
  const num = (o, ...keys) => {
    for (const k of keys) if (o && Number.isFinite(o[k])) return o[k];
    return 0;
  };
  // Per-astronaut stats are read when the surface sim provides them (summary.perPlayer);
  // otherwise the crew totals tell the story.
  function highlights(surface) {
    if (!surface) return [];
    const out = [];
    const per = surface.perPlayer || surface.players || null;
    const nameOf = (a) => a.name || roleName(a.role) || '';
    const push = (id, icon, label, who, role, value) => out.push({ id, icon, label, who, role, value });
    if (Array.isArray(per) && per.length) {
      const best = (fn) => {
        let top = null;
        let val = 0;
        per.forEach((a) => {
          const v = fn(a);
          if (v > val) {
            val = v;
            top = a;
          }
        });
        return top ? { a: top, val } : null;
      };
      const kills = best((a) => num(a, 'kills', 'bursts', 'burst'));
      if (kills) push('kills', 'splat', t('team.hl.kills', 'Most aliens burst'), nameOf(kills.a), kills.a.role, fmt(kills.val));
      const revives = best((a) => num(a, 'revives'));
      if (revives) push('revives', 'heart', t('team.hl.revives', 'Most revives'), nameOf(revives.a), revives.a.role, fmt(revives.val));
      const drop = best((a) => num(a, 'dropped', 'samplesDropped', 'jettisoned'));
      if (drop) push('dropped', 'drop', t('team.hl.dropped', 'Dropped the samples'), nameOf(drop.a), drop.a.role, fmt(drop.val));
      const downs = best((a) => num(a, 'downs', 'deaths'));
      if (downs) push('downs', 'skull', t('team.hl.downs', 'Face-planted the most'), nameOf(downs.a), downs.a.role, fmt(downs.val));
      const carried = best((a) => num(a, 'carried', 'samplesCarried', 'delivered'));
      if (carried) push('carried', 'crate', t('team.hl.carried', 'Hauled the most samples'), nameOf(carried.a), carried.a.role, fmt(carried.val));
    }
    if (!out.length) {
      // Crew-wide story from the summary.
      const items = surface.items || {};
      const weaponKills = items.weapons ? Object.values(items.weapons).reduce((n, w) => n + num(w, 'kills'), 0) : 0;
      const totalKills = weaponKills + (items.turretKills || 0) + (items.droneKills || 0) + (items.shieldKills || 0);
      if (totalKills) push('kills', 'splat', t('team.hl.t.kills', 'Aliens burst by the crew'), '', null, fmt(totalKills));
      const crew = surface.crew || {};
      if (crew.revives) push('revives', 'heart', t('team.hl.t.revives', 'Crewmates pulled back up'), '', null, fmt(crew.revives));
      if (crew.downs) push('downs', 'skull', t('team.hl.t.downs', 'Times someone face-planted'), '', null, fmt(crew.downs));
      const smp = surface.samples || {};
      if (smp.jettisoned) push('dropped', 'drop', t('team.hl.t.dropped', 'Samples thrown overboard'), '', null, fmt(smp.jettisoned));
      else if (smp.returned) push('carried', 'crate', t('team.hl.t.returned', 'Samples brought home'), '', null, fmt(smp.returned));
      const up = surface.uplink || {};
      if (up.dishDowns) push('dish', 'star', t('team.hl.t.dish', 'Dish knocked over'), '', null, fmt(up.dishDowns));
    }
    return out.slice(0, 6);
  }

  const HL_ICON = {
    splat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.3 3 1.8 5.2 4 5.6 2.4.4 4.7-1 6-.3-1.9 2.4-4 3.2-4.6 5.3-.5 2.2 1.1 4.6.5 6-2.7-1.7-4-3.8-6-3.8s-3.3 2.2-6 3.8c-.6-1.4 1-3.8.5-6C5.8 11.5 3.8 10.7 2 8.3c1.3-.7 3.6.7 6 .3C10.2 8.2 10.7 6 12 3z" fill="currentColor"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C6 16.4 2 12.9 2 8.4A5 5 0 0 1 12 6a5 5 0 0 1 10 2.4c0 4.5-4 8-10 12.6z" fill="currentColor"/></svg>',
    crate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.4 12 3l9 4.4v9.2L12 21l-9-4.4zM12 11.6 5.8 8.6 12 5.6l6.2 3zM13 13.3l6-3v5l-6 3z" fill="currentColor"/></svg>',
    drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5C8.2 7.8 5 11.6 5 15a7 7 0 0 0 14 0c0-3.4-3.2-7.2-7-12.5z" fill="currentColor"/></svg>',
    skull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C7 3 3.5 6.5 3.5 11.2c0 2.6 1.3 4.5 3 5.8v3.3h3v-2.3h1.5v2.3h2v-2.3h1.5v2.3h3v-3.3c1.7-1.3 3-3.2 3-5.8C20.5 6.5 17 3 12 3zM8.6 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm6.8 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.6 1.5 6.7L12 17.4 5.9 20.8l1.5-6.7L2.2 9.5l6.9-.7z" fill="currentColor"/></svg>',
  };

  // ---------- A design as a small silhouette ----------
  // Works from the sim's toCraftDesign (the same thing 3D builds from).
  function silhouette(craft, opts = {}) {
    const c = craft || {};
    const color = opts.color || 'currentColor';
    const arrays = Number(c.arrays) || 0;
    const dish = Number(c.dish) || 1;
    const inst = Array.isArray(c.instruments) ? c.instruments.length : 0;
    const wing = clamp(16 + arrays * 1.5, arrays > 0 ? 14 : 0, 58);
    const panel = clamp(12 + arrays * 0.34, 10, 34);
    const d = clamp(dish * 10, 8, 26);
    const parts = [];
    if (arrays > 0) {
      parts.push(`<rect x="${50 - 9 - wing}" y="${48 - panel / 2}" width="${wing}" height="${panel}" rx="2"/>`);
      parts.push(`<rect x="${50 + 9}" y="${48 - panel / 2}" width="${wing}" height="${panel}" rx="2"/>`);
      for (let k = 1; k < 3; k++) parts.push(`<path d="M${50 - 9 - (wing * k) / 3} ${48 - panel / 2}v${panel}M${50 + 9 + (wing * k) / 3} ${48 - panel / 2}v${panel}" stroke="#0b1033" stroke-width="1"/>`);
    }
    parts.push('<rect x="41" y="38" width="18" height="22" rx="2"/>');
    parts.push(`<path d="M${50 - d} ${36}a${d} ${d * 0.72} 0 0 1 ${d * 2} 0z"/>`);
    parts.push('<rect x="48.8" y="36" width="2.4" height="4"/>');
    for (let k = 0; k < inst; k++) parts.push(`<circle cx="${44 + k * 4.2}" cy="65" r="1.9"/>`);
    if (Number(c.rtg)) parts.push('<rect x="58" y="60" width="9" height="4" rx="1"/>');
    return `<svg class="tf-sil" viewBox="0 0 100 80" aria-hidden="true" fill="${color}">${parts.join('')}</svg>`;
  }

  const designSil = (sim, design, opts) => {
    let craft = null;
    try {
      craft = sim && sim.toCraftDesign ? sim.toCraftDesign(design) : null;
    } catch (e) {}
    return silhouette(craft || design, opts);
  };

  // ---------- Dominoes ----------
  const KIND_STYLE = { decision: '#24d8ff', launcher: '#ffb04a', crisis: '#ff9a1f', failure: '#ff3355', science: '#ff4fb2', revert: '#46f58a', radiation: '#ffe14a', mass: '#ff9a1f', fuel: '#ffb04a', budget: '#ffe14a', power: '#46f58a', data: '#ff4fb2', comms: '#24d8ff', loss: '#ff3355', surface: '#c084fc', time: '#a7b0de', orbit: '#7fb2ff', crew: '#ff6ba7' };
  const dominoColor = (k) => KIND_STYLE[k] || '#a7b0de';

  function deltaText(d) {
    if (typeof d === 'number') return d > 0 ? `+${fmt(d)}` : fmt(d);
    return d == null ? '' : String(d);
  }
  const isSurfaceLink = (c) => !!c && (c.kind === 'surface' || c.kind === 'crew' || c.leg === 'surface' || c.phase === 'surface');

  function buildDominoRow(row, chain) {
    row.innerHTML = '';
    let onSurface = false;
    chain.forEach((c, i) => {
      const leg = isSurfaceLink(c) ? 'surface' : 'orbit';
      // One gate only: the chain crosses from orbit to the ground once.
      if (leg === 'surface' && !onSurface) {
        onSurface = true;
        const gate = document.createElement('div');
        gate.className = 'tf-leg';
        gate.innerHTML = `<span>${esc(t('team.dom.surface', 'on the surface'))}</span>`;
        row.appendChild(gate);
      }
      const d = document.createElement('div');
      d.className = `tf-domino tf-domino-${leg}`;
      d.style.setProperty('--dc', dominoColor(c.kind));
      d.style.setProperty('--i', String(i));
      d.innerHTML = `<div class="tf-domino-face"><span class="tf-domino-delta" dir="ltr">${esc(deltaText(c.delta))}</span><span class="tf-domino-kind">${esc(c.short || kindWord(c.kind))}</span><span class="tf-domino-pips" aria-hidden="true">${'•'.repeat(1 + (i % 3))}</span></div>`;
      row.appendChild(d);
    });
    // Line the gaps up: each domino's push reaches the next one in the row.
  }

  function kindWord(k) {
    return (
      {
        mass: t('team.dom.k.mass', 'mass'),
        fuel: t('team.dom.k.fuel', 'fuel'),
        budget: t('team.dom.k.budget', 'money'),
        power: t('team.dom.k.power', 'power'),
        data: t('team.dom.k.data', 'data'),
        comms: t('team.dom.k.comms', 'radio'),
        loss: t('team.dom.k.loss', 'lost'),
        surface: t('team.dom.k.surface', 'surface'),
        decision: t('team.dom.k.decision', 'your choice'),
        launcher: t('team.dom.k.launcher', 'rocket'),
        crisis: t('team.dom.k.crisis', 'crisis'),
        failure: t('team.dom.k.failure', 'the end'),
        science: t('team.dom.k.science', 'science'),
        revert: t('team.dom.k.revert', 'if instead'),
        radiation: t('team.dom.k.radiation', 'radiation'),
        time: t('team.dom.k.time', 'time'),
        orbit: t('team.dom.k.orbit', 'orbit'),
        crew: t('team.dom.k.crew', 'crew'),
      }[k] || t('team.dom.k.other', 'why')
    );
  }

  // ---------- Failure Museum store ----------
  const MUSEUM_KEY = 'ek-team-museum';
  const museumLoad = () => readJSON(MUSEUM_KEY, []);
  // An exhibit is one way of dying: the real mission it matches plus your own attempt.
  function museumAdd(ob, scenarioId) {
    if (!ob || !ob.analog) return null;
    const list = museumLoad();
    const key = String(ob.analog.key || ob.analog.mission).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let row = list.find((x) => x.key === key);
    const isNew = !row;
    if (!row) {
      row = { key, mission: ob.analog.mission, year: ob.analog.year, story: ob.analog.story, source: ob.analog.source, first: Date.now(), count: 0, deaths: [] };
      list.unshift(row);
    }
    row.count++;
    row.last = Date.now();
    row.scenario = scenarioId;
    row.deaths.unshift({ title: ob.title, cause: ob.cause, epitaph: ob.epitaph, crew: !!ob.crew, at: Date.now() });
    row.deaths = row.deaths.slice(0, 8);
    writeJSON(MUSEUM_KEY, list);
    return { row, isNew, total: list.length };
  }
  function museumExhibits() {
    const data = team.data || {};
    const pool = Object.assign({}, data.ANALOGS || {}, data.SURFACE_ANALOGS || {});
    const seen = new Set();
    const all = [];
    Object.keys(pool).forEach((key) => {
      const a = pool[key];
      const k = String(a.mission).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (seen.has(k)) return;
      seen.add(k);
      all.push({ id: k, mission: a.mission, year: a.year, story: a.story, source: a.source, cause: key });
    });
    return all;
  }

  // ---------- Leaderboard and saved designs ----------
  const LB_KEY = 'ek-team-leaderboard';
  const lbAll = () => readJSON(LB_KEY, {});
  function lbAdd(scenarioId, row) {
    const all = lbAll();
    const list = all[scenarioId] || [];
    list.push(row);
    list.sort((a, b) => b.total - a.total);
    all[scenarioId] = list.slice(0, 12);
    writeJSON(LB_KEY, all);
    return all[scenarioId];
  }
  const HANGAR_KEY = 'ek-team-hangar';
  const hangar = () => readJSON(HANGAR_KEY, []);
  function hangarSave(entry) {
    const list = hangar();
    list.unshift(entry);
    writeJSON(HANGAR_KEY, list.slice(0, 16));
  }

  function scenarioName(sim, id) {
    try {
      const list = sim && sim.scenarios ? sim.scenarios() : [];
      const s = list.find((x) => x.id === id);
      if (s) return (SMD.t && SMD.t(`team.scn.${id}.title`, s.title || s.name)) || s.title || s.name;
    } catch (e) {}
    return id;
  }

  // The sim labels crew deaths by id; this is what goes on the stone.
  const CREW_CAUSE = {
    crew_lost: () => t('team.obit.c.crew_lost', 'The whole crew was lost'),
    oxygen: () => t('team.obit.c.oxygen', 'The air ran out'),
    stranded: () => t('team.obit.c.stranded', 'Nobody reached the lander'),
    base_dark: () => t('team.obit.c.base_dark', 'The base went dark'),
    data_left: () => t('team.obit.c.data_left', 'The science never got home'),
  };
  function obitText(ob) {
    if (!ob) return ob;
    const fix = CREW_CAUSE[ob.causeId || ob.cause];
    return ob.crew && fix ? Object.assign({}, ob, { cause: fix() }) : ob;
  }

  // ---------- Tombstone: drawn on a canvas so the same picture can be shared ----------
  function wrapText(c, text, maxW) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const test = line ? `${line} ${w}` : w;
      if (c.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }
  function drawTombstone(canvas, ob, opts = {}) {
    const W = 1200;
    const H = 1500;
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    const ar = SMD.dir && SMD.dir() === 'rtl';
    const FONT = "'Archivo','Noto Kufi Arabic','Arial Narrow',sans-serif";
    c.direction = ar ? 'rtl' : 'ltr';
    // Night sky.
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#090c30');
    sky.addColorStop(0.7, '#1a1450');
    sky.addColorStop(1, '#2a1c55');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    // Stars.
    for (let i = 0; i < 180; i++) {
      c.fillStyle = `rgba(255,255,255,${0.2 + ((i * 7) % 10) / 14})`;
      const sx = (i * 139.5) % W;
      const sy = (i * 77.3) % (H * 0.74);
      const r = 1 + ((i * 3) % 3);
      c.fillRect(sx, sy, r, r);
    }
    // The planet it never got to see again.
    c.fillStyle = '#e9dcb8';
    c.beginPath();
    c.arc(950, 240, 110, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#c9b990';
    [[915, 215, 24], [980, 275, 17], [940, 290, 12]].forEach(([x, y, r]) => {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    });
    // Ground.
    const gnd = c.createLinearGradient(0, H * 0.74, 0, H);
    gnd.addColorStop(0, '#3a2e22');
    gnd.addColorStop(1, '#17120e');
    c.fillStyle = gnd;
    c.beginPath();
    c.moveTo(0, H * 0.8);
    c.quadraticCurveTo(W * 0.5, H * 0.72, W, H * 0.79);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    // The stone.
    const sx = 200;
    const sw = W - 400;
    const st = 310;
    const sb = H * 0.79;
    c.fillStyle = '#7c8088';
    c.beginPath();
    c.moveTo(sx, sb);
    c.lineTo(sx, st + 200);
    c.arc(W / 2, st + 200, sw / 2, Math.PI, 0);
    c.lineTo(sx + sw, sb);
    c.closePath();
    c.fill();
    c.fillStyle = '#6a6e77';
    c.fillRect(sx - 40, sb - 16, sw + 80, 34);
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#23232b';
    c.font = `700 40px ${FONT}`;
    if (ob.crew) c.fillText(t('team.obit.rip_mem', 'In memory of'), W / 2, st + 110);
    c.font = `900 64px ${FONT}`;
    let y = st + 196;
    wrapText(c, ob.title, sw - 160).slice(0, 2).forEach((line) => {
      c.fillText(line, W / 2, y);
      y += 74;
    });
    c.font = `700 40px ${FONT}`;
    c.fillStyle = '#3b1d26';
    y += 10;
    wrapText(c, ob.cause, sw - 150).slice(0, 2).forEach((line) => {
      c.fillText(line, W / 2, y);
      y += 52;
    });
    c.fillStyle = '#23232b';
    c.font = `italic 500 38px ${FONT}`;
    y += 28;
    wrapText(c, `“${ob.epitaph}”`, sw - 140).slice(0, 4).forEach((line) => {
      c.fillText(line, W / 2, y);
      y += 50;
    });
    if (opts.when) {
      c.font = `500 28px ${FONT}`;
      c.fillStyle = '#3a3a44';
      c.fillText(opts.when, W / 2, sb - 44);
    }
    // Footer: the real one.
    c.fillStyle = 'rgba(11,16,51,0.9)';
    c.fillRect(0, H - 250, W, 250);
    c.fillStyle = '#ffe14a';
    c.font = `800 34px ${FONT}`;
    if (ob.analog) {
      c.fillText(t('team.obit.sameway', 'Died the same way as {m} ({y})', { m: ob.analog.mission, y: ob.analog.year }), W / 2, H - 196);
      c.fillStyle = '#e9edff';
      c.font = `500 29px ${FONT}`;
      let fy = H - 150;
      wrapText(c, ob.analog.story, W - 170).slice(0, 3).forEach((line) => {
        c.fillText(line, W / 2, fy);
        fy += 38;
      });
    }
    c.fillStyle = '#a7b0de';
    c.font = `500 22px ${FONT}`;
    c.fillText(t('team.obit.credit', 'Every Kilogram. NASA Space Apps Challenge 2026.'), W / 2, H - 30);
  }

  function canvasBlob(canvas) {
    return new Promise((res) => canvas.toBlob(res, 'image/png'));
  }
  async function shareTomb(canvas, ob) {
    const blob = await canvasBlob(canvas);
    const name = `obituary-${String(ob.title || 'mission').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    try {
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: ob.title, text: ob.epitaph });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Mission report: one printable page ----------
  function reportHtml(ctx, d, name) {
    const sim = ctx.sim;
    let res = null;
    try {
      res = sim.resources(ctx.state.design);
    } catch (e) {}
    const axes = axesOf(d.score);
    const rows = res
      ? Object.keys(res)
          .filter((k) => res[k] && res[k].value !== undefined)
          .map((k) => {
            // sim.resources gives power as value = supply, limit = load, the other way round from the rest.
            const used = k === 'power' ? res[k].limit : res[k].value;
            const cap = k === 'power' ? res[k].value : res[k].limit;
            return `<tr><th>${esc(k)}</th><td>${esc(fmt(used))} ${esc(res[k].unit || '')}</td><td>${esc(fmt(cap))} ${esc(res[k].unit || '')}</td><td>${esc(res[k].status || '')}</td></tr>`;
          })
          .join('')
      : '';
    const chain = (d.chain || []).map((c) => `<li><b>${esc(c.text)}</b>${c.delta != null ? ` (${esc(deltaText(c.delta))})` : ''}<br><span>${esc(c.why || '')}</span></li>`).join('');
    const agendas = (d.agendas || []).map((a) => `<tr><th>${esc(roleName(a.role))}${a.player ? `, ${esc(a.player)}` : ''}</th><td>${esc((a.agenda && (a.agenda.text || a.agenda.title)) || '')}</td><td>${a.met ? esc(t('team.report.kept', 'kept')) : esc(t('team.report.broken', 'broken'))}</td></tr>`).join('');
    const ob = d.obituary;
    return `<div class="tf-report">
      <header>
        <div><h1>${esc(t('team.report.title', 'Mission report'))}</h1><p>${esc(name)} &middot; ${esc(new Date().toLocaleDateString())}</p></div>
        <div class="tf-report-sil">${designSil(sim, ctx.state.design, { color: '#222' })}</div>
      </header>
      <section class="tf-report-score"><div class="tf-report-total">${esc(fmt(totalOf(d.score)))}<small>/1000</small></div>
        <ul>${axes.map((a) => `<li><b>${esc(a.label)}</b> ${esc(fmt(a.value))} / ${esc(fmt(a.max))}${a.items.length ? `<br><small>${a.items.map((it) => `${esc(it.label || it.id || '')} ${esc(fmt(Number(it.points) || 0))}`).join(' \u00b7 ')}</small>` : ''}</li>`).join('')}${outcomeOf(d.score) ? `<li><b>${esc(t('team.deb.rule', 'Outcome rule'))}</b> ${esc(signed(Math.round(outcomeOf(d.score).adjust)))} ${esc(outcomeOf(d.score).why || '')}</li>` : ''}</ul>
      </section>
      ${ob ? `<section><h2>${esc(t('team.report.outcome', 'What happened'))}</h2><p><b>${esc(ob.title)}.</b> ${esc(ob.cause)} ${ob.analog ? esc(t('team.report.same', 'Same way as {m} ({y}).', { m: ob.analog.mission, y: ob.analog.year })) : ''}</p></section>` : ''}
      <section><h2>${esc(t('team.report.chain', 'Cause and effect'))}</h2><ol>${chain}</ol></section>
      ${d.best ? `<section><h2>${esc(t('team.report.best', 'Best single change'))}</h2><p>${esc(d.best.text || d.best.label || '')} ${d.best.gain ? `(${esc(d.best.gain)})` : ''}</p></section>` : ''}
      ${rows ? `<section><h2>${esc(t('team.report.budget', 'The budget'))}</h2><table><tr><th></th><th>${esc(t('team.report.used', 'Used'))}</th><th>${esc(t('team.report.limit', 'Limit'))}</th><th></th></tr>${rows}</table></section>` : ''}
      ${agendas ? `<section><h2>${esc(t('team.report.agendas', 'Secret goals'))}</h2><table>${agendas}</table></section>` : ''}
      <footer>${esc(t('team.report.foot', 'Every Kilogram, NASA Space Apps Challenge 2026. Numbers are simplified from real NASA missions.'))}</footer>
    </div>`;
  }
  function printReport(ctx, d, name) {
    const host = document.createElement('div');
    host.className = 'tf-print-host';
    host.innerHTML = reportHtml(ctx, d, name);
    document.body.appendChild(host);
    document.body.classList.add('tf-printing');
    const done = () => {
      document.body.classList.remove('tf-printing');
      host.remove();
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(() => {
      window.print();
      setTimeout(done, 1500);
    }, 50);
  }

  // ---------- Museum and hangar screen ----------
  const EXHIBIT_DESIGN = {
    'mars-climate-orbiter': { arrays: 8, dish: 1.3, instruments: ['a', 'b'] },
    'mars-observer': { arrays: 12, dish: 1.5, instruments: ['a', 'b', 'c'] },
    genesis: { arrays: 6, dish: 0.6, instruments: ['a'] },
    galileo: { arrays: 0, dish: 4.8, instruments: ['a', 'b', 'c', 'd'], rtg: 2 },
    hubble: { arrays: 16, dish: 1, instruments: ['a', 'b'] },
    contour: { arrays: 2, dish: 0.8, instruments: ['a', 'b'] },
    'beagle-2-esa': { arrays: 4, dish: 0.4, instruments: ['a'] },
    'mars-polar-lander': { arrays: 3, dish: 0.6, instruments: ['a', 'b'] },
    'mars-global-surveyor': { arrays: 10, dish: 1.5, instruments: ['a', 'b', 'c'] },
    skylab: { arrays: 20, dish: 1, instruments: ['a', 'b', 'c'] },
    'telstar-1': { arrays: 4, dish: 0.4, instruments: ['a'] },
    'spirit-rover': { arrays: 3, dish: 0.3, instruments: ['a', 'b'] },
    kepler: { arrays: 8, dish: 0.8, instruments: ['a'] },
    'pioneer-10': { arrays: 0, dish: 2.7, instruments: ['a', 'b'], rtg: 2 },
    opportunity: { arrays: 3, dish: 0.3, instruments: ['a', 'b'] },
    'apollo-13': { arrays: 0, dish: 1, instruments: [] },
    'apollo-13-the-near-miss': { arrays: 0, dish: 1, instruments: [] },
  };

  function teaser(ex) {
    return t(`team.museum.tease.${ex.cause}`, t('team.museum.tease', 'Fail in a new way to unlock this one.'));
  }

  function museumHtml(unlocked) {
    const all = museumExhibits();
    const byKey = {};
    unlocked.forEach((x) => (byKey[x.key] = x));
    const items = all.concat(unlocked.filter((x) => !all.some((a) => a.id === x.key)).map((x) => ({ id: x.key, mission: x.mission, year: x.year, story: x.story, source: x.source, cause: 'custom' })));
    const panels = items
      .map((ex, i) => {
        const mine = byKey[ex.id];
        const des = EXHIBIT_DESIGN[ex.id] || { arrays: 4, dish: 1, instruments: ['a'] };
        if (!mine) {
          return `<article class="tf-ex tf-ex-locked" style="--i:${i}">
            <div class="tf-ex-spot" aria-hidden="true"></div>
            <div class="tf-ex-plinths"><div class="tf-plinth"><div class="tf-sheet" aria-hidden="true">?</div></div><div class="tf-plinth"><div class="tf-sheet" aria-hidden="true">?</div></div></div>
            <div class="tf-ex-rope" aria-hidden="true"></div>
            <h3 class="tf-ex-name">${esc(t('team.museum.locked', 'Not yet destroyed'))}</h3>
            <p class="tf-ex-tease">${esc(teaser(ex))}</p>
          </article>`;
        }
        const d0 = mine.deaths[0] || {};
        return `<article class="tf-ex tf-ex-open" style="--i:${i}" data-ex="${esc(ex.id)}" tabindex="0" role="button" aria-label="${esc(ex.mission)}">
          <div class="tf-ex-spot" aria-hidden="true"></div>
          <div class="tf-ex-plinths">
            <div class="tf-plinth" title="${esc(t('team.museum.yours', 'Yours'))}"><div class="tf-mini-stone"><span>${esc(t('team.museum.rip', 'RIP'))}</span><small>${esc(d0.title || '')}</small></div><p class="tf-plinth-tag">${esc(t('team.museum.yours', 'Yours'))}${mine.count > 1 ? ` &times;${mine.count}` : ''}</p></div>
            <div class="tf-plinth"><div class="tf-plinth-sil">${silhouette(des)}</div><p class="tf-plinth-tag">${esc(ex.mission)}<br>${esc(ex.year)}</p></div>
          </div>
          <h3 class="tf-ex-name">${esc(ex.mission)}</h3>
          <p class="tf-ex-tease tf-mono">${esc(d0.cause || '')}</p>
        </article>`;
      })
      .join('');
    return { panels, total: items.length, done: items.filter((x) => byKey[x.id]).length };
  }

  function bindCardKeys(root, sel, fn) {
    root.querySelectorAll(sel).forEach((el) => {
      el.addEventListener('click', () => fn(el));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fn(el);
        }
      });
    });
  }

  function museumCard(root, ex, mine) {
    const old = root.querySelector('.tf-card-layer');
    if (old) old.remove();
    const layer = document.createElement('div');
    layer.className = 'tf-card-layer';
    const deaths = (mine.deaths || []).slice(0, 3);
    layer.innerHTML = `<div class="tf-excard" role="dialog" aria-modal="true" aria-label="${esc(ex.mission)}">
      <button class="tf-excard-x" type="button" aria-label="${esc(t('team.close', 'Close'))}">&times;</button>
      <div class="tf-excard-grid">
        <div class="tf-excard-sil">${silhouette(EXHIBIT_DESIGN[ex.id] || { arrays: 4, dish: 1, instruments: ['a'] })}</div>
        <div>
          <p class="tf-excard-year">${esc(ex.year)}</p>
          <h2>${esc(ex.mission)}</h2>
          <p>${esc(ex.story)}</p>
          ${ex.source ? `<p class="tf-excard-src"><a href="${esc(ex.source)}" target="_blank" rel="noopener noreferrer">${esc(t('team.museum.source', 'Read the real report'))}</a></p>` : ''}
        </div>
      </div>
      <h3>${esc(t('team.museum.yourwreck', 'Your team, the same way'))}</h3>
      ${deaths.map((d) => `<blockquote class="tf-excard-d"><strong>${esc(d.title || '')}</strong>${d.cause ? ` ${esc(d.cause)}` : ''}<br><em>“${esc(d.epitaph || '')}”</em></blockquote>`).join('')}
    </div>`;
    root.appendChild(layer);
    const close = () => layer.remove();
    layer.querySelector('.tf-excard-x').addEventListener('click', close);
    layer.addEventListener('click', (e) => {
      if (e.target === layer) close();
    });
    layer.querySelector('.tf-excard-x').focus();
  }

  function renderMuseumHub(app, params) {
    const sim = team.sim;
    let tab = params.tab || 'museum';
    const ar = SMD.dir && SMD.dir() === 'rtl';
    app.innerHTML = `<main class="screen tf-hub" data-tab="${esc(tab)}">
      <header class="tf-hub-top">
        <button class="tf-btn tf-ghost" data-act="back" type="button">${esc(t('team.back', 'Back'))}</button>
        <h1>${esc(t('team.museum.title', 'Failure Museum'))}</h1>
        <nav class="tf-tabs" aria-label="${esc(t('team.museum.tabs', 'Sections'))}">
          <button data-tab="museum" type="button">${esc(t('team.museum.tab.museum', 'Exhibits'))}</button>
          <button data-tab="lb" type="button">${esc(t('team.museum.tab.lb', 'Leaderboard'))}</button>
          <button data-tab="hangar" type="button">${esc(t('team.museum.tab.hangar', 'Saved designs'))}</button>
        </nav>
      </header>
      <div class="tf-hub-body" data-body></div>
    </main>`;
    const root = app.querySelector('.tf-hub');
    const body = root.querySelector('[data-body]');
    root.querySelector('[data-act="back"]').addEventListener('click', () => (params.onBack ? params.onBack() : SMD.go(params.back || 'start', params.backParams)));
    const showTab = (id) => {
      tab = id;
      root.dataset.tab = id;
      root.querySelectorAll('.tf-tabs button').forEach((b) => b.classList.toggle('tf-on', b.dataset.tab === id));
      if (id === 'museum') {
        const unlocked = museumLoad();
        const m = museumHtml(unlocked);
        body.innerHTML = `<section class="tf-hall" data-hall tabindex="0" aria-label="${esc(t('team.museum.hall', 'The hall of exhibits. Scroll sideways.'))}">
          <div class="tf-hall-count"><strong>${m.done}</strong> / ${m.total}<span>${esc(t('team.museum.count', 'ways to wreck a spacecraft, collected'))}</span></div>
          <div class="tf-hall-track">${m.panels}<div class="tf-hall-end" aria-hidden="true"></div></div>
        </section>`;
        const hall = body.querySelector('[data-hall]');
        hall.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const dir = (e.key === 'ArrowRight') === !ar ? 1 : -1;
            hall.querySelector('.tf-hall-track').scrollBy({ left: dir * 420, behavior: reduced() ? 'auto' : 'smooth' });
          }
        });
        bindCardKeys(body, '[data-ex]', (el) => {
          const id = el.dataset.ex;
          const ex = museumExhibits().find((x) => x.id === id) || unlocked.find((x) => x.key === id);
          const mine = unlocked.find((x) => x.key === id);
          if (ex && mine) museumCard(root, Object.assign({ id }, ex), mine);
        });
      } else if (id === 'lb') {
        const all = lbAll();
        const scn = (sim && sim.scenarios ? sim.scenarios() : []).map((s) => s.id);
        const ids = scn.length ? scn : Object.keys(all);
        body.innerHTML = `<section class="tf-lb">${ids
          .map((sid) => {
            const list = all[sid] || [];
            return `<div class="tf-lb-card"><h2>${esc(scenarioName(sim, sid))}</h2>${
              list.length
                ? `<ol>${list
                    .slice(0, 8)
                    .map((r, i) => `<li><span class="tf-lb-rank">${i + 1}</span><span class="tf-lb-name">${esc(r.team || '')}</span><span class="tf-lb-total">${esc(fmt(r.total))}</span></li>`)
                    .join('')}</ol>`
                : `<p class="tf-lb-empty">${esc(t('team.lb.empty', 'Nobody has flown this yet.'))}</p>`
            }</div>`;
          })
          .join('')}</section>`;
      } else {
        renderHangar(body);
      }
    };
    root.querySelectorAll('.tf-tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
    showTab(tab);
  }

  function renderHangar(body) {
    const sim = team.sim;
    const list = hangar();
    if (!list.length) {
      body.innerHTML = `<section class="tf-hangar-empty"><h2>${esc(t('team.hangar.empty', 'No saved designs yet.'))}</h2><p>${esc(t('team.hangar.emptyhint', 'Save one from the debrief after a flight.'))}</p></section>`;
      return;
    }
    const sel = new Set();
    const draw = () => {
      body.innerHTML = `<section class="tf-hangar">
        <div class="tf-hangar-list">${list
          .map(
            (d) => `<button type="button" class="tf-hcard ${sel.has(d.id) ? 'tf-on' : ''}" data-id="${esc(d.id)}">
            ${designSil(sim, d.design)}
            <span class="tf-hcard-name">${esc(d.name)}</span>
            <span class="tf-hcard-score">${esc(fmt(d.total))}</span>
            <span class="tf-hcard-sc">${esc(scenarioName(sim, d.scenario))}</span>
          </button>`
          )
          .join('')}</div>
        ${sel.size === 2 ? compareHtml(list.filter((d) => sel.has(d.id))) : `<p class="tf-hangar-hint">${esc(t('team.hangar.pick', 'Pick two designs to compare them.'))}</p>`}
      </section>`;
      body.querySelectorAll('[data-id]').forEach((b) =>
        b.addEventListener('click', () => {
          const id = b.dataset.id;
          if (sel.has(id)) sel.delete(id);
          else {
            if (sel.size >= 2) sel.delete(sel.values().next().value);
            sel.add(id);
          }
          beep(520, 0.06, 'square', 0.1);
          draw();
        })
      );
    };
    draw();
  }

  function compareHtml(pair) {
    const sim = team.sim;
    const [a, b] = pair;
    const ra = safeRes(sim, a.design);
    const rb = safeRes(sim, b.design);
    const keys = Object.keys(ra).filter((k) => ra[k] && rb[k] && ra[k].value !== undefined);
    const nameOf = (k) => {
      const r = team.kit && team.kit.RES ? team.kit.RES.find((x) => x.id === k) : null;
      return r ? r.name() : k;
    };
    const cell = (v, other, unit, low) => {
      const win = v === other ? '' : (low ? v < other : v > other) ? ' tf-win' : '';
      return `<td class="${win.trim()}"><strong>${esc(fmt(v))}</strong> ${esc(unit || '')}</td>`;
    };
    const lower = { mass: true, budget: true, power: true };
    return `<table class="tf-compare">
      <thead><tr><th></th>
        <th><div class="tf-compare-sil">${designSil(sim, a.design)}</div>${esc(a.name)}</th>
        <th><div class="tf-compare-sil">${designSil(sim, b.design)}</div>${esc(b.name)}</th></tr></thead>
      <tbody>
        <tr><th>${esc(t('team.compare.score', 'Score'))}</th>${cell(a.total, b.total, '', false)}${cell(b.total, a.total, '', false)}</tr>
        ${keys.map((k) => `<tr><th>${esc(nameOf(k))}</th>${cell(ra[k].value, rb[k].value, ra[k].unit, lower[k])}${cell(rb[k].value, ra[k].value, rb[k].unit, lower[k])}</tr>`).join('')}
      </tbody>
    </table>`;
  }
  function safeRes(sim, d) {
    try {
      return sim.resources(d) || {};
    } catch (e) {
      return {};
    }
  }

  SMD.ui = SMD.ui || {};
  SMD.ui.screens = SMD.ui.screens || {};
  SMD.ui.screens.team_museum = {
    render(app, params = {}) {
      renderMuseumHub(app, params);
      return () => {};
    },
  };

  // ---------- Challenge links (opened from the title as #c=...) ----------
  function challengeEncode(ctx, d, teamName) {
    const code = ctx.sim.encode({ v: 1, sc: ctx.state.scenarioId, df: ctx.state.difficulty, seed: ctx.state.seed, de: ctx.state.design, score: totalOf(d.score), axes: d.score && (d.score.axes || null), name: teamName, alive: !!(d.result && d.result.alive) });
    return `${location.origin}${location.pathname}#c=${code}`;
  }
  // team.challenge: what the lobby or a challenge screen can show before a round.
  team.challenge = {
    parse(code) {
      try {
        return team.sim.decode(String(code).replace(/^#?c=/, ''));
      } catch (e) {
        return null;
      }
    },
    cardHtml(ch, sim) {
      if (!ch) return '';
      return `<div class="tf-chal-card"><div class="tf-chal-sil">${designSil(sim, ch.de, {})}</div><div><p class="tf-chal-kick">${esc(t('team.chal.kick', 'A rival team challenges you'))}</p><div class="tf-chal-score">${esc(fmt(ch.score))}</div><p class="tf-chal-line">${esc(t('team.chal.line', '{n} scored this on {m}. Beat it.', { n: ch.name || t('team.chal.rivals', 'Rivals'), m: scenarioName(sim, ch.sc) }))}</p></div></div>`;
    },
  };

  team.debriefLogic = { highlights, totalOf, axesOf, medalsOf };

  // Opening a challenge link: a full-screen dare before the lobby. Runs once the
  // team screen exists (it loads after this file).
  function challengeIntro(app, code) {
    const ch = team.challenge.parse(code);
    if (!ch || !team.sim) return;
    const layer = document.createElement('div');
    layer.className = 'tf-chal-layer';
    layer.innerHTML = `<div class="tf-chal-box">
      <h1>${esc(t('team.chal.title', 'You have been challenged'))}</h1>
      ${team.challenge.cardHtml(ch, team.sim)}
      <p class="tf-chal-hint">${esc(t('team.chal.hint', 'Same mission. Design your own ship. Fly it. Beat the score.'))}</p>
      <button class="tf-bigbtn" type="button" data-go>${esc(t('team.chal.accept', 'Accept the challenge'))}</button>
    </div>`;
    app.appendChild(layer);
    layer.querySelector('[data-go]').addEventListener('click', () => {
      const s = team._lastSession;
      if (s && s.ctx) {
        const patch = { type: 'setup' };
        if (ch.sc) patch.scenarioId = ch.sc;
        if (ch.df) patch.difficulty = ch.df;
        s.ctx.send(patch);
      }
      layer.remove();
    });
  }
  setTimeout(() => {
    const kit = team.kit;
    if (kit && kit.createSession && !kit.createSession.tfWrapped) {
      const orig = kit.createSession;
      kit.createSession = function (p) {
        const session = orig(p);
        team._lastSession = session;
        return session;
      };
      kit.createSession.tfWrapped = true;
    }
    const scr = SMD.ui && SMD.ui.screens && SMD.ui.screens.team;
    if (scr && !scr.tfWrapped) {
      const orig = scr.render;
      scr.render = function (app, params = {}) {
        const out = orig.call(this, app, params);
        if (params.challenge) setTimeout(() => challengeIntro(app, params.challenge), 150);
        return out;
      };
      scr.tfWrapped = true;
    }
  }, 0);

  // ---------- Debrief view ----------
  views.debrief = {
    mount(el, ctx) {
      const RM = reduced();
      const d = (ctx.view && ctx.view.debrief) || (ctx.state && ctx.state.debrief) || {};
      const s = ctx.state || {};
      const sim = ctx.sim;
      const scenarioId = s.scenarioId || (ctx.view && ctx.view.scenarioId);
      const name = scenarioName(sim, scenarioId);
      const result = d.result || {};
      const died = result.alive === false || (d.surface && (d.surface.crewAlive === false || d.surface.extracted === false));
      const chain = Array.isArray(d.chain) ? d.chain.slice(0, 9) : [];
      const crewNames = ((ctx.view && ctx.view.players) || []).filter((p) => p && !p.bot).map((p) => p.name).filter(Boolean);
      const teamName = crewNames.join(', ') || t('team.crew.default', 'The crew');

      // Keep the record once for this debrief.
      const runKey = `${s.seed}:${s.round || 0}`;
      const recorded = readJSON('ek-team-last-debrief', '');
      let museumResult = null;
      if (recorded !== runKey) {
        writeJSON('ek-team-last-debrief', runKey);
        lbAdd(scenarioId, { team: teamName, total: Math.round(totalOf(d.score)), at: Date.now() });
        if (d.obituary) museumResult = museumAdd(d.obituary, scenarioId);
      } else if (d.obituary) {
        const row = museumLoad().find((x) => x.mission === (d.obituary.analog && d.obituary.analog.mission));
        if (row) museumResult = { row, isNew: false, total: museumLoad().length };
      }

      let raf = 0;
      let dead = false;
      const timers = [];
      const later = (fn, ms) => {
        const id = setTimeout(() => {
          if (!dead) fn();
        }, ms);
        timers.push(id);
        return id;
      };

      el.innerHTML = `<div class="tf-deb" data-act="dominoes">
        <header class="tf-deb-top">
          <div class="tf-deb-name">${esc(name)}</div>
          <button class="tf-deb-skip tf-btn tf-ghost" data-skip type="button">${esc(t('team.deb.skip', 'Skip'))}</button>
        </header>
        <div class="tf-deb-stage" data-stage></div>
        <div class="tf-deb-actions" data-actions hidden></div>
      </div>`;
      const root = el.querySelector('.tf-deb');
      const stage = root.querySelector('[data-stage]');
      const actions = root.querySelector('[data-actions]');
      const skipBtn = root.querySelector('[data-skip]');

      // ---------- Acts, in order. Each returns when it is done, or is skipped. ----------
      let skip = () => {};
      let actFast = false;
      skipBtn.addEventListener('click', () => {
        actFast = true;
        skip();
      });
      stage.addEventListener('click', (e) => {
        if (e.target.closest('button,a')) return;
        skip();
      });
      const wait = (ms) =>
        new Promise((res) => {
          const ok = () => {
            skip = () => {};
            res();
          };
          const tm = later(ok, ms);
          skip = () => {
            clearTimeout(tm);
            ok();
          };
        });

      const stack = (html) => {
        stage.innerHTML = '';
        const act = document.createElement('section');
        act.className = 'tf-act';
        act.innerHTML = html;
        stage.appendChild(act);
        return act;
      };

      // Act 1: dominoes.
      async function actDominoes() {
        if (!chain.length) return;
        root.dataset.act = 'dominoes';
        const act = stack(`<h1 class="tf-act-title">${esc(t('team.deb.chain', 'Why it happened'))}</h1>
          <div class="tf-dom-row" data-row></div>
          <div class="tf-dom-line" data-line aria-live="polite"></div>`);
        const row = act.querySelector('[data-row]');
        const lineEl = act.querySelector('[data-line]');
        buildDominoRow(row, chain);
        const dominoes = [...row.querySelectorAll('.tf-domino')];
        await wait(450);
        for (let i = 0; i < chain.length; i++) {
          if (dead) return;
          const c = chain[i];
          // Falls toward the next domino in reading order.
          dominoes[i].classList.add('tf-fall');
          if (dominoes[i].parentNode) dominoes[i].scrollIntoView({ inline: 'center', block: 'nearest', behavior: RM ? 'auto' : 'smooth' });
          const isLast = i === chain.length - 1;
          lineEl.innerHTML = `<div class="tf-dom-text">${esc(c.text)}</div>${c.why ? `<div class="tf-dom-why">${esc(c.why)}</div>` : ''}`;
          lineEl.classList.remove('tf-pop');
          void lineEl.offsetWidth;
          lineEl.classList.add('tf-pop');
          const pitch = isSurfaceLink(c) ? 180 : 240;
          beep(pitch + i * 26, 0.06, 'triangle', 0.05);
          if (isLast) later(() => dominoes[i].classList.add('tf-last'), 380);
          await wait(actFast ? 120 : isLast ? 2000 : RM ? 1500 : 1650);
        }
      }

      // Act 2: score count-up and medals.
      async function actScore() {
        root.dataset.act = 'score';
        const axes = axesOf(d.score);
        const total = Math.round(totalOf(d.score));
        const ghost = ctx.view && ctx.view.ghost && ctx.view.ghost.score ? Math.round(totalOf(ctx.view.ghost.score)) : null;
        const act = stack(`<h1 class="tf-act-title">${esc(t('team.deb.score', 'The score'))}</h1>
          <div class="tf-score-total"><span data-total>0</span><small>/1000</small></div>
          ${ghost !== null ? `<div class="tf-score-ghost" data-ghostline></div>` : ''}
          <div class="tf-axes">${axes.map((a, i) => `<div class="tf-axis" style="--c:${a.color}"><div class="tf-axis-head"><span>${esc(a.label)}</span><span><span data-a="${i}">0</span><small class="tf-axis-max"> / ${esc(fmt(a.max))}</small></span></div><div class="tf-axis-bar"><i data-b="${i}"></i></div></div>`).join('')}</div>
          ${outcomeOf(d.score) && outcomeOf(d.score).adjust ? `<p class="tf-score-rule">${esc(t('team.deb.rule', 'Outcome rule'))}${outcomeOf(d.score).title ? ` (${esc(outcomeOf(d.score).title)})` : ''}: <b dir="ltr">${esc(signed(Math.round(outcomeOf(d.score).adjust)))}</b>${outcomeOf(d.score).why ? `<span>${esc(outcomeOf(d.score).why)}</span>` : ''}</p>` : ''}
          <div class="tf-medals" data-medals></div>`);
        const dur = actFast || RM ? 50 : 1300;
        await new Promise((res) => {
          const t0 = performance.now();
          const step = (now) => {
            if (dead) return res();
            const k = clamp((now - t0) / dur, 0, 1);
            const e = 1 - Math.pow(1 - k, 3);
            act.querySelector('[data-total]').textContent = fmt(Math.round(total * e));
            axes.forEach((a, i) => {
              act.querySelector(`[data-a="${i}"]`).textContent = fmt(Math.round(a.value * e));
              act.querySelector(`[data-b="${i}"]`).style.inlineSize = `${clamp((a.value / a.max) * e, 0, 1) * 100}%`;
            });
            if (k < 1) {
              raf = requestAnimationFrame(step);
            } else res();
          };
          raf = requestAnimationFrame(step);
        });
        if (ghost !== null) {
          const delta = total - ghost;
          const line = act.querySelector('[data-ghostline]');
          line.textContent = delta >= 0 ? t('team.deb.ghostup', '+{d} on your last flight', { d: fmt(delta) }) : t('team.deb.ghostdown', '{d} on your last flight', { d: fmt(delta) });
        }
        // Medals stamp on.
        const medals = medalsOf(d.score);
        const box = act.querySelector('[data-medals]');
        for (const m of medals) {
          const el2 = document.createElement('div');
          el2.className = 'tf-medal';
          el2.textContent = (m && (m.name || m.label || m.title)) || String(m || '');
          if (m && m.text) el2.title = m.text;
          box.appendChild(el2);
          beep(1046, 0.1, 'triangle', 0.06);
          await wait(actFast ? 40 : 260);
        }
        await wait(actFast ? 200 : 1100);
      }

      // Act 3: agendas and surface highlights.
      async function actAgendas() {
        const rows = Array.isArray(d.agendas) ? d.agendas : [];
        const hl = highlights(d.surface);
        if (!rows.length && !hl.length) return;
        root.dataset.act = 'agendas';
        const act = stack(`<h1 class="tf-act-title">${esc(t('team.deb.secrets', 'Secret goals, revealed'))}</h1>
          <div class="tf-envs">${rows.map((a, i) => `<div class="tf-env" style="--c:${ROLE_COLOR[a.role] || '#fff'};--i:${i}" data-env="${i}">
            <div class="tf-env-face tf-env-back"><span>${esc(roleName(a.role))}</span></div>
            <div class="tf-env-face tf-env-front">
              <p class="tf-env-who">${esc(a.player || roleName(a.role))}</p>
              <p class="tf-env-text">${esc((a.agenda && (a.agenda.text || a.agenda.title)) || '')}</p>
              <p class="tf-env-res ${a.met ? 'tf-kept' : 'tf-broke'}">${esc(a.met ? t('team.deb.kept', 'KEPT IT') : t('team.deb.broke', 'BROKE IT'))}</p>
            </div></div>`).join('')}</div>
          ${hl.length ? `<div class="tf-hl">${hl.map((h, i) => `<div class="tf-hl-card" style="--i:${i};--c:${ROLE_COLOR[h.role] || '#a7b0de'}" data-hl="${i}"><div class="tf-hl-icon">${HL_ICON[h.icon] || HL_ICON.star}</div><div><p class="tf-hl-label">${esc(h.label)}</p><p class="tf-hl-who">${esc(h.who)} <span>${esc(h.value)}</span></p></div></div>`).join('')}</div>` : ''}`);
        for (let i = 0; i < rows.length; i++) {
          act.querySelector(`[data-env="${i}"]`).classList.add('tf-flip');
          beep(rows[i].met ? 880 : 200, 0.12, rows[i].met ? 'triangle' : 'sawtooth', 0.18);
          await wait(actFast ? 70 : 520);
        }
        for (let i = 0; i < hl.length; i++) {
          act.querySelector(`[data-hl="${i}"]`).classList.add('tf-on');
          beep(640, 0.07, 'square', 0.1);
          await wait(actFast ? 40 : 300);
        }
        await wait(actFast ? 200 : 1500);
      }

      // ---------- Mission review (js/team/mission-review.js) ----------
      // NASA's systems-engineering view of the flight: the four segments, the concept
      // CML-inspired learning progress, a ConOps timeline, your ship against the real mission, and a short
      // learning check. All numbers come from the sim; nothing here changes the score.
      const R = team.review;
      const LEARN_KEY = 'ek-learning-log';
      const SEG_ICON = {
        launch: '<path d="M12 2l4 9-4 3-4-3z"/><path d="M9 16l3 5 3-5"/>',
        space: '<rect x="9" y="8" width="6" height="8" rx="1"/><path d="M2 10h6v4H2zM16 10h6v4h-6z"/>',
        ground: '<path d="M4 18c0-6 4-10 10-10l-3 5z"/><path d="M12 14l5 6M5 21h9"/>',
        user: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
      };
      const segIcon = (id) => `<svg class="tf-seg-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SEG_ICON[id] || ''}</svg>`;
      let reviewCache;
      function reviewData() {
        if (reviewCache !== undefined) return reviewCache;
        reviewCache = null;
        try {
          const design = s.design;
          if (!R || !sim || !design || !design.picks) return null;
          let events = [];
          try {
            events = sim.fly(design, s.seed).events || [];
          } catch (e) {}
          reviewCache = {
            segs: R.segments(sim, design, d.result, d.surface),
            cml: R.cml(sim, design, d.result, s.round || 0),
            mdl: R.mdl(design.difficulty),
            real: R.realCompare(sim, design),
            conops: R.conops(events, d.result, d.surface, d.ascent),
            design,
          };
        } catch (e) {
          console.warn('mission review unavailable', e);
        }
        return reviewCache;
      }
      const segCardsHtml = (rv) => `<div class="tf-seg-row">${rv.segs.map((g, i) => `<section class="tf-seg" data-st="${esc(g.status)}" style="--i:${i}">
          <div class="tf-seg-head">${segIcon(g.id)}<h2>${esc(g.title)}</h2></div>
          <p class="tf-seg-blurb">${esc(g.blurb)}</p>
          <dl class="tf-seg-lines">${g.lines.map((l) => `<div><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`).join('')}</dl>
        </section>`).join('')}</div>`;
      const cmlHtml = (rv) => `<div class="tf-cml">
          <p class="tf-cml-kick">${esc(t('team.rev.cml.kick', 'Game progress inspired by JPL CML'))}: <strong>${esc(t('team.rev.cml.progress', 'Step {n} of 4', { n: rv.cml.level }))}</strong> <span>${esc(rv.cml.levels[rv.cml.level - 1].name)}</span></p>
          <ol class="tf-cml-steps">${rv.cml.levels.map((l) => `<li class="${l.reached ? 'tf-on' : ''}" title="${esc(l.what)}"><b>${l.id}</b><span>${esc(l.name)}</span></li>`).join('')}</ol>
          ${rv.cml.next ? `<p class="tf-cml-next">${esc(t('team.rev.cml.next', 'Next: {n}', { n: rv.cml.next.name }))}. ${esc(rv.cml.next.hint)}</p>` : `<p class="tf-cml-next">${esc(t('team.rev.cml.done', 'All four game progress steps are complete.'))}</p>`}
          <p class="tf-mdl">${esc(t('team.rev.mdl.kick', 'Study type inspired by NASA MDL (analogy)'))}: <strong>${esc(rv.mdl.name)}</strong>. ${esc(rv.mdl.what)}</p>
        </div>`;

      async function actReview() {
        const rv = reviewData();
        if (!rv) return;
        root.dataset.act = 'review';
        stack(`<h1 class="tf-act-title">${esc(t('team.rev.title', 'Mission review'))}</h1>${segCardsHtml(rv)}${cmlHtml(rv)}`);
        beep(392, 0.08, 'triangle', 0.05);
        await wait(actFast ? 200 : RM ? 4200 : 5200);
      }

      // Learning log: one row per flight, kept in this browser only.
      function learnLog() {
        const v = readJSON(LEARN_KEY, []);
        return Array.isArray(v) ? v : [];
      }
      function learnUpsert(patch) {
        const all = learnLog();
        const i = all.findIndex((e) => e.run === runKey);
        if (i >= 0) all[i] = { ...all[i], ...patch };
        else all.push({ run: runKey, ...patch });
        writeJSON(LEARN_KEY, all.slice(-300));
      }
      function learnRecordFlight() {
        const rv = reviewData();
        learnUpsert({
          when: new Date().toISOString(),
          mission: scenarioId,
          difficulty: (s.design && s.design.difficulty) || '',
          attempt: (s.round || 0) + 1,
          score: Math.round(totalOf(d.score)),
          cml: rv ? rv.cml.level : '',
        });
      }
      function downloadCsv() {
        try {
          const blob = new Blob([R.csvOf(learnLog())], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'every-kilogram-learning-log.csv';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (e) {
          toast(t('team.rev.csvfail', 'Could not save the file here.'));
        }
      }

      // Where every point came from (docs/TEAM-V3.md item 12).
      let ptsLayer = null;
      function openPoints() {
        if (ptsLayer || !d.score) return;
        ptsLayer = document.createElement('div');
        ptsLayer.className = 'tf-rev-layer tf-pts-layer';
        ptsLayer.setAttribute('role', 'dialog');
        ptsLayer.setAttribute('aria-modal', 'true');
        ptsLayer.setAttribute('aria-label', t('team.deb.points', 'Where every point came from'));
        ptsLayer.innerHTML = `<div class="tf-rev">
          <header class="tf-rev-top"><h1>${esc(t('team.deb.points', 'Where every point came from'))}</h1><button class="tf-btn tf-ghost" data-close type="button">${esc(t('team.close', 'Close'))}</button></header>
          ${pointsHtml(d.score)}
          ${crewHtml(d.surface)}
        </div>`;
        root.appendChild(ptsLayer);
        const close = () => {
          if (!ptsLayer) return;
          ptsLayer.remove();
          ptsLayer = null;
          document.removeEventListener('keydown', onKey, true);
        };
        const onKey = (e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
          }
        };
        document.addEventListener('keydown', onKey, true);
        ptsLayer.querySelector('[data-close]').addEventListener('click', close);
        ptsLayer.querySelector('[data-close]').focus({ preventScroll: true });
      }

      let revLayer = null;
      function openReview(focusQuiz) {
        const rv = reviewData();
        if (!rv || revLayer) return;
        const RD = team.realData;
        const real = rv.real;
        const qs = R.pickQuestions(sim, rv.design, d.result, d.surface);
        const picked = [];
        revLayer = document.createElement('div');
        revLayer.className = 'tf-rev-layer';
        revLayer.setAttribute('role', 'dialog');
        revLayer.setAttribute('aria-modal', 'true');
        revLayer.setAttribute('aria-label', t('team.rev.title', 'Mission review'));
        const link = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
        revLayer.innerHTML = `<div class="tf-rev">
          <header class="tf-rev-top"><h1>${esc(t('team.rev.title', 'Mission review'))}</h1><button class="tf-btn tf-ghost" data-close type="button">${esc(t('team.close', 'Close'))}</button></header>
          <h2 class="tf-rev-h">${esc(t('team.rev.h.seg', 'The four mission segments'))}</h2>
          ${segCardsHtml(rv)}
          ${cmlHtml(rv)}
          <h2 class="tf-rev-h">${esc(t('team.rev.h.conops', 'Your mission timeline (ConOps)'))}</h2>
          <ol class="tf-conops">${rv.conops.map((c, i) => `<li style="--i:${i}"><b>${esc(c.label)}</b>${c.note ? `<span>${esc(c.note)}</span>` : ''}</li>`).join('')}</ol>
          ${real ? `<h2 class="tf-rev-h">${esc(t('team.rev.h.real', 'Your ship vs the real mission'))}: ${esc(real.name)}</h2>
            <table class="tf-cmp"><thead><tr><th></th><th>${esc(t('team.rev.you', 'Yours'))}</th><th>${esc(real.name)}</th><th></th></tr></thead><tbody>
            ${real.rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.you)}</td><td>${esc(r.real)}</td><td>${esc(r.diff || '')}</td></tr>`).join('')}</tbody></table>
            <p class="tf-rev-note">${esc(real.scaleNote)}</p>
            ${real.fact ? `<p class="tf-rev-fact">${esc(real.fact)}</p>` : ''}
            <p class="tf-rev-links">${link(real.source, t('team.rev.src', 'NASA source'))} \u00b7 ${link(real.eyes, t('team.rev.eyes', 'Explore it in NASA Eyes'))}</p>` : ''}
          <h2 class="tf-rev-h" data-quiz>${esc(t('team.rev.h.quiz', 'Check what you learned'))}</h2>
          <div class="tf-quiz" data-quizbox>${qs.map((q, qi) => `<fieldset class="tf-q" data-q="${qi}"><legend>${qi + 1}. ${esc(q.q)}</legend>
              ${q.options.map((o, oi) => `<button type="button" class="tf-opt" data-q="${qi}" data-o="${oi}">${esc(o)}</button>`).join('')}
              <p class="tf-q-why" data-why="${qi}" hidden></p></fieldset>`).join('')}
            <p class="tf-quiz-total" data-total aria-live="polite" hidden></p></div>
          <h2 class="tf-rev-h">${esc(t('team.rev.h.teach', 'For teachers'))}</h2>
          <p class="tf-rev-note">${esc(t('team.rev.teach', 'Every flight is kept in this browser with its mission, score, concept level and quiz result. No names, no account.'))}</p>
          <div class="tf-rev-btns"><button class="tf-btn" data-csv type="button">${esc(t('team.rev.csv', 'Download learning log (CSV)'))}</button></div>
          <h2 class="tf-rev-h">${esc(t('team.rev.h.read', 'Real NASA data behind this game'))}</h2>
          <p class="tf-rev-links">${link(RD ? RD.DONKI_TOOL : 'https://ccmc.gsfc.nasa.gov/tools/DONKI/', t('team.rev.donki', 'DONKI space-weather database'))} \u00b7 ${link('https://eyes.nasa.gov/', t('team.rev.eyes2', 'NASA Eyes on the Solar System'))} \u00b7 ${link('https://github.com/nasa/GMAT', t('team.rev.gmat', 'GMAT mission-analysis tool'))}</p>
        </div>`;
        root.appendChild(revLayer);
        const close = () => {
          if (!revLayer) return;
          revLayer.remove();
          revLayer = null;
          document.removeEventListener('keydown', onKey, true);
        };
        const onKey = (e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
          }
        };
        document.addEventListener('keydown', onKey, true);
        revLayer.querySelector('[data-close]').addEventListener('click', close);
        revLayer.querySelector('[data-csv]').addEventListener('click', downloadCsv);
        revLayer.querySelectorAll('.tf-opt').forEach((b) =>
          b.addEventListener('click', () => {
            const qi = +b.dataset.q;
            if (picked[qi] !== undefined) return;
            const oi = +b.dataset.o;
            picked[qi] = oi;
            const q = qs[qi];
            revLayer.querySelectorAll(`.tf-opt[data-q="${qi}"]`).forEach((x) => {
              x.disabled = true;
              if (+x.dataset.o === q.answer) x.classList.add('tf-right');
              else if (x === b) x.classList.add('tf-wrong');
            });
            const why = revLayer.querySelector(`[data-why="${qi}"]`);
            why.textContent = `${oi === q.answer ? t('team.rev.right', 'Right.') : t('team.rev.notquite', 'Not quite.')} ${q.why}`;
            why.hidden = false;
            beep(oi === q.answer ? 784 : 220, 0.1, oi === q.answer ? 'triangle' : 'sawtooth', 0.08);
            if (picked.filter((x) => x !== undefined).length === qs.length) {
              const g = R.grade(qs, picked);
              const tot = revLayer.querySelector('[data-total]');
              tot.textContent = t('team.rev.score', 'You got {a} of {b}.', { a: g.correct, b: g.total });
              tot.hidden = false;
              learnUpsert({ quiz_correct: g.correct, quiz_total: g.total, questions: qs.map((x) => x.id) });
            }
          })
        );
        const first = focusQuiz ? revLayer.querySelector('[data-quiz]') : null;
        if (first) first.scrollIntoView({ block: 'start' });
        revLayer.querySelector('[data-close]').focus({ preventScroll: true });
      }

      // Act 4: obituary.
      let tombCanvas = null;
      async function actObituary() {
        if (!d.obituary) return;
        root.dataset.act = 'obit';
        const ob = obitText(d.obituary);
        if (document.fonts && document.fonts.load) {
          try {
            await document.fonts.load("900 40px 'Archivo'");
          } catch (e) {}
        }
        const when = new Date().toLocaleDateString();
        const act = stack(`<div class="tf-obit"><canvas class="tf-tomb" data-tomb role="img" aria-label="${esc(ob.title + '. ' + ob.cause + '. ' + ob.epitaph)}"></canvas>
          <div class="tf-obit-side">
            <h1 class="tf-obit-title">${esc(ob.crew ? t('team.obit.head_crew', 'In memory of the crew') : t('team.obit.head', 'Obituary'))}</h1>
            <p class="tf-obit-cause">${esc(ob.cause)}</p>
            ${ob.analog ? `<div class="tf-obit-real"><p class="tf-obit-sameway">${esc(t('team.obit.sameas', 'The same way as'))}</p><h2>${esc(ob.analog.mission)} <span>${esc(ob.analog.year)}</span></h2><p class="tf-obit-story">${esc(ob.analog.story)}</p>${ob.analog.source ? `<a class="tf-obit-src" href="${esc(ob.analog.source)}" target="_blank" rel="noopener noreferrer">${esc(t('team.obit.src', 'The real report'))}</a>` : ''}</div>` : ''}
            <div class="tf-obit-btns"><button class="tf-btn" data-share type="button">${esc(t('team.obit.share', 'Save the tombstone'))}</button></div>
          </div></div>`);
        const cv = act.querySelector('[data-tomb]');
        drawTombstone(cv, ob, { when });
        tombCanvas = cv;
        act.querySelector('[data-share]').addEventListener('click', () => shareTomb(cv, ob));
        beep(196, 0.5, 'triangle', 0.08);
        later(() => beep(147, 0.8, 'triangle', 0.08), 400);
        await wait(actFast ? 400 : 3600);
      }

      // The Museum opens over the debrief, so the team's session stays alive underneath.
      let hubLayer = null;
      function openHub(tab) {
        if (hubLayer) return;
        hubLayer = document.createElement('div');
        hubLayer.className = 'tf-hub-layer';
        root.appendChild(hubLayer);
        renderMuseumHub(hubLayer, {
          tab,
          onBack: () => {
            hubLayer.remove();
            hubLayer = null;
          },
        });
      }
      function openMuseum() {
        openHub('museum');
      }

      // Final state: the board and the one obvious next thing.
      function showBoard() {
        root.dataset.act = 'board';
        skipBtn.hidden = true;
        const total = Math.round(totalOf(d.score));
        const axes = axesOf(d.score);
        const chCode = (ctx.params && ctx.params.challenge) || (ctx.state && ctx.state.challenge);
        const rival = chCode ? team.challenge.parse(chCode) : null;
        const best = d.best;
        const bestText = best && (best.text || best.label || '');
        const gain = best && (best.gain || best.delta);
        stage.innerHTML = '';
        const act = document.createElement('section');
        act.className = 'tf-act tf-board';
        const G = team.guide;
        const v = G && G.verdict ? G.verdict(scenarioId, d) : null;
        const kiloCard = v && v.text ? `<div class="tf-verdict" data-kind="${esc(v.kind)}"><div class="tf-verdict-face">${G.portrait(v.mood, { size: 76 })}</div><p class="tf-verdict-text"><span class="tf-verdict-who">${esc(t('guide.name', 'KILO'))}</span>${esc(v.text)}</p></div>` : '';
        act.innerHTML = `${kiloCard}<div class="tf-board-grid">
          <div class="tf-board-score"><div class="tf-score-total tf-small"><span>${esc(fmt(total))}</span><small>/1000</small></div>
            <div class="tf-axes tf-axes-mini">${axes.map((a) => `<div class="tf-axis" style="--c:${a.color}"><div class="tf-axis-head"><span>${esc(a.label)}</span><span>${esc(fmt(Math.round(a.value)))}<small class="tf-axis-max"> / ${esc(fmt(a.max))}</small></span></div><div class="tf-axis-bar"><i style="inline-size:${clamp(a.value / a.max, 0, 1) * 100}%"></i></div></div>`).join('')}</div>
            ${outcomeOf(d.score) && outcomeOf(d.score).adjust ? `<p class="tf-score-rule tf-small">${esc(t('team.deb.rule', 'Outcome rule'))}: <b dir="ltr">${esc(signed(Math.round(outcomeOf(d.score).adjust)))}</b></p>` : ''}
            <button class="tf-btn tf-ghost tf-pts-open" data-points type="button">${esc(t('team.deb.points', 'Where every point came from'))}</button></div>
          <div class="tf-board-main">
            ${rival ? `<div class="tf-vs"><div class="tf-vs-col"><span class="tf-vs-name">${esc(rival.name || t('team.chal.rivals', 'Rivals'))}</span><span class="tf-vs-score">${esc(fmt(rival.score))}</span>${designSil(sim, rival.de, {})}</div><div class="tf-vs-mid">${total >= rival.score ? esc(t('team.chal.won', 'BEATEN!')) : esc(t('team.chal.lost', 'NOT YET'))}</div><div class="tf-vs-col"><span class="tf-vs-name">${esc(t('team.chal.you', 'Your team'))}</span><span class="tf-vs-score">${esc(fmt(total))}</span>${designSil(sim, s.design, {})}</div></div>` : ''}
            ${best ? `<div class="tf-best"><p class="tf-best-kick">${esc(t('team.deb.onechange', 'The one change that helps most'))}</p><h2 class="tf-best-text">${esc(bestText)}</h2>${gain ? `<p class="tf-best-gain" dir="ltr">${esc(deltaText(gain))}</p>` : ''}</div>` : ''}
            <button class="tf-bigbtn" data-refly-best type="button">${esc(best ? t('team.deb.flyagain.best', 'Fly again with this change') : t('team.deb.flyagain', 'Fly again'))}</button>
            <div class="tf-board-more">
              <button class="tf-btn tf-ghost" data-refly-any type="button">${esc(t('team.deb.changeany', 'Change anything'))}</button>
              <button class="tf-btn tf-ghost" data-nextm type="button">${esc(t('team.deb.next', 'Next mission'))}</button>
            </div>
          </div>
        </div>${crewHtml(d.surface)}`;
        stage.appendChild(act);
        act.querySelector('[data-points]').addEventListener('click', () => openPoints());
        act.querySelector('[data-refly-best]').addEventListener('click', () => ctx.send(best && best.change ? { type: 'refly', change: best.change } : best && best.key ? { type: 'refly', change: { role: best.role, key: best.key, value: best.value } } : { type: 'refly' }));
        act.querySelector('[data-refly-any]').addEventListener('click', () => ctx.send({ type: 'refly' }));
        act.querySelector('[data-nextm]').addEventListener('click', () => ctx.send({ type: 'next' }));

        actions.hidden = false;
        actions.innerHTML = `
          ${R && reviewData() ? `<button class="tf-chip" data-a="review" type="button">${esc(t('team.rev.title', 'Mission review'))}</button><button class="tf-chip" data-a="quiz" type="button">${esc(t('team.rev.h.quiz', 'Check what you learned'))}</button>` : ''}
          <button class="tf-chip" data-a="points" type="button">${esc(t('team.deb.points', 'Where every point came from'))}</button>
          <button class="tf-chip" data-a="report" type="button">${esc(t('team.deb.report', 'Mission report'))}</button>
          ${d.obituary ? `<button class="tf-chip" data-a="tomb" type="button">${esc(t('team.obit.share', 'Save the tombstone'))}</button>` : ''}
          <button class="tf-chip" data-a="chal" type="button">${esc(t('team.deb.challenge', 'Challenge friends'))}</button>
          <button class="tf-chip" data-a="save" type="button">${esc(t('team.deb.save', 'Save this design'))}</button>`;
        const on = (a, fn) => {
          const b = actions.querySelector(`[data-a="${a}"]`);
          if (b) b.addEventListener('click', fn);
        };
        on('review', () => openReview(false));
        on('quiz', () => openReview(true));
        on('report', () => printReport(ctx, d, name));
        on('points', () => openPoints());
        on('tomb', () => tombCanvas && shareTomb(tombCanvas, obitText(d.obituary)));
        on('chal', async () => {
          const url = challengeEncode(ctx, d, teamName);
          let copied = false;
          try {
            await navigator.clipboard.writeText(url);
            copied = true;
          } catch (e) {}
          toast(copied ? t('team.deb.linkcopied', 'Challenge link copied. Send it to a rival team.') : url, 7000);
        });
        on('save', () => {
          hangarSave({ id: uid(), name: `${name} ${new Date().toLocaleTimeString()}`, scenario: scenarioId, design: s.design, total, at: Date.now() });
          toast(t('team.deb.saved', 'Design saved to the hangar.'));
        });
        // Focus the obvious next thing for keyboard players.
        act.querySelector('[data-refly-best]').focus({ preventScroll: true });
        seq([523, 659, 784], 110, 'triangle', 0.06);
      }

      function toast(text, ms = 3500) {
        if (SMD.ui && SMD.ui.toast) SMD.ui.toast(text, { ms });
      }

      (async () => {
        await actDominoes();
        if (dead) return;
        await actScore();
        if (dead) return;
        if (R) learnRecordFlight();
        await actReview();
        if (dead) return;
        // The secret-goals act (actAgendas) is left out: fewer panels (docs/TEAM-V2.md).
        await actObituary();
        if (dead) return;
        showBoard();
      })().catch((e) => console.error('debrief failed', e));
      const kitOff = team.flightLogic && team.flightLogic.attachKit ? team.flightLogic.attachKit(root, 'debrief', ctx) : () => {};

      return () => {
        dead = true;
        if (revLayer) revLayer.remove();
        if (ptsLayer) ptsLayer.remove();
        kitOff();
        cancelAnimationFrame(raf);
        timers.forEach(clearTimeout);
      };
    },
  };
})();
