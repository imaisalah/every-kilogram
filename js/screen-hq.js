// HQ: the hub of the career. A 3D campus at golden hour with the agency's
// dashboard over it: money, reputation, teams, every project on the NASA life
// cycle, launch windows, and the clock. Time only moves when the player says so,
// and it stops for anything that needs a decision (reviews, history events,
// launches, arrivals, results).
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const t = (k, e, p) => SMD.t(k, e, p);
  const esc = (s) => ui.esc(s);
  const A = () => SMD.agency;
  const D = () => SMD.data;
  SMD.game.pending = SMD.game.pending || [];

  const COACH_KEY = 'ek-hq-coach';
  // The end screen opens by itself once per career; after that HQ stays browsable.
  let endShown = null;
  const HEADLINE_KEYS = ['mars', 'venus', 'jupiter'];
  const WINDOW_KEYS = ['mars', 'venus', 'jupiter'];
  // Things the player has to see or decide; time stops for them.
  const STOP = new Set(['review', 'event', 'launch', 'arrival', 'complete', 'unlock']);

  // Line icons for the action dock (stroke = currentColor).
  const svgI = (d) => `<svg class="hq-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    board: svgI('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 12h7M8.5 16h5"/>'),
    map: svgI('<circle cx="12" cy="12" r="2.6"/><ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-20 12 12)"/><circle cx="19.6" cy="9.1" r="1.3" fill="currentColor"/>'),
    research: svgI('<path d="M9.5 3h5M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4A1.5 1.5 0 0 0 19 19l-5.5-10V3"/><path d="M7.5 15h9"/>'),
    archive: svgI('<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M3.5 16l5-5 4 4 3-3 5 5"/><circle cx="15.5" cy="9" r="1.4"/>'),
    hire: svgI('<circle cx="10" cy="8" r="3.4"/><path d="M3.5 20c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6M18.5 7v6M15.5 10h6"/>'),
    walk: svgI('<circle cx="13" cy="4.5" r="2"/><path d="M10.5 21l2-6 2.5 2.5V21M8 12l2.5-4.5 4 1.5 2 3.5M12.5 9.5L10.5 15"/>'),
    campus: svgI('<path d="M3 20h18M5 20V11l4-3 4 3v9M13 20v-6h6v6M8 14h2"/><circle cx="17" cy="6" r="2"/>'),
  };

  // The director's portrait for the top bar chip, made once per look.
  let meURL = null;
  let meKey = '';
  let meJob = null;
  function loadMePortrait(onReady) {
    if (!SMD.avatar) return;
    const a = SMD.avatar.get();
    const key = JSON.stringify(a);
    if (key !== meKey || !meJob) {
      meKey = key;
      meURL = null;
      meJob = import(new URL('js/3d/astronaut.js', document.baseURI).href)
        .then((m) => m.createPortrait(a, 96))
        .then((url) => {
          if (meKey === key) meURL = url;
          return url;
        });
      meJob.catch((err) => {
        meJob = null;
        console.warn('HQ portrait unavailable', err);
      });
    }
    meJob.then(() => meKey === key && onReady && onReady()).catch(() => {});
  }
  function meChip() {
    if (!SMD.avatar) return '';
    const a = SMD.avatar.get();
    let rank = '';
    try {
      rank = SMD.avatar.evaluate().rank.name;
    } catch (e) {
      rank = '';
    }
    return `<button type="button" class="hq-me" data-act="avatar" title="${esc(t('hq.me.title', 'Your astronaut'))}" aria-label="${esc(t('hq.me.aria', 'Your astronaut, {name}, {rank}. Change your look.', { name: a.name, rank }))}">
      <span class="hq-me-face" data-me-face>${meURL ? `<img src="${esc(meURL)}" alt="" width="36" height="36" />` : ''}</span>
      <span class="hq-me-text"><b>${esc(a.name)}</b><small>${esc(rank)}</small></span>
    </button>`;
  }

  // ---------- Small formatters ----------
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = (i) => t(`hq.month.${i}`, MONTHS[i]);
  const my = (ms) => {
    const d = new Date(ms);
    return `${monthName(d.getUTCMonth())} ${d.getUTCFullYear()}`;
  };
  const money = (x) => (x < 0 ? '−' : '') + ui.money(Math.abs(Math.round(x)));
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const PHASE = {
    B: () => t('hq.phase.B', 'Preliminary design'),
    C: () => t('hq.phase.C', 'Final design & build'),
    D: () => t('hq.phase.D', 'Assembly & test'),
    E: () => t('hq.phase.E', 'Operations'),
    F: () => t('hq.phase.F', 'Done'),
  };
  const REVIEW_NAME = {
    PDR: () => t('hq.rev.PDR', 'Preliminary Design Review'),
    CDR: () => t('hq.rev.CDR', 'Critical Design Review'),
    FRR: () => t('hq.rev.FRR', 'Flight Readiness Review'),
  };
  const missionTitle = (key) => t(`hq.m.${key}`, D().MISSIONS[key].title);
  const destName = (key) => ({ mars: t('hq.dest.mars', 'Mars'), venus: t('hq.dest.venus', 'Venus'), jupiter: t('hq.dest.jupiter', 'Jupiter'), europa: t('hq.dest.europa', 'Europa') })[key] || key;

  function inMonths(ag, ms) {
    const n = A().monthsBetween(ag.now, ms);
    if (n <= 0) return t('hq.when.now', 'this month');
    if (n === 1) return t('hq.when.next', 'next month');
    return t('hq.when.n', 'in {n} months', { n });
  }

  // ---------- Project helpers ----------
  const devTotal = (p) => Math.max(1, A().monthsBetween(p.startMs, p.readyMs));
  const reviewMs = (p, frac) => A().addMonths(p.startMs, Math.ceil(devTotal(p) * frac));

  function milestones(ag, p) {
    const kind = D().MISSIONS[p.missionKey].kind;
    const lost = A().flightLost(p);
    const out = [
      { id: 'PDR', ms: p.reviews.PDR ? p.reviews.PDR.at : reviewMs(p, 0.35), done: !!p.reviews.PDR, label: t('hq.ms.PDR', 'PDR') },
      { id: 'CDR', ms: p.reviews.CDR ? p.reviews.CDR.at : reviewMs(p, 0.75), done: !!p.reviews.CDR, label: t('hq.ms.CDR', 'CDR') },
      { id: 'FRR', ms: p.reviews.FRR ? p.reviews.FRR.at : p.readyMs, done: !!p.reviews.FRR, label: t('hq.ms.FRR', 'FRR') },
      { id: 'launch', ms: p.launchMs, done: p.status === 'flying' || p.status === 'done', label: t('hq.ms.launch', 'Launch') },
    ];
    if (kind !== 'earth' && !(lost && p.status === 'done')) out.push({ id: 'arrival', ms: p.arriveMs, done: !!p.arrived, label: t('hq.ms.arrival', 'Arrival') });
    if (p.endMs && !lost) out.push({ id: 'end', ms: p.endMs, done: p.status === 'done', label: t('hq.ms.end', 'Science ends') });
    return out;
  }

  // Reviews and events that are due now. Time cannot move until they are handled.
  function owed(ag) {
    for (const p of ag.projects) {
      if (p.status !== 'dev' && p.status !== 'ready') continue;
      const ready = p.status === 'ready';
      if ((ready || p.phase === 'C' || p.phase === 'D') && !p.reviews.PDR) return { kind: 'review', p, review: 'PDR' };
      if ((ready || p.phase === 'D') && !p.reviews.CDR) return { kind: 'review', p, review: 'CDR' };
      if (ready && !p.reviews.FRR) return { kind: 'review', p, review: 'FRR' };
      const ev = p.status === 'dev' && p.events.find((s) => !s.resolved && s.atMs && ag.now >= s.atMs);
      if (ev) return { kind: 'event', p, eventId: ev.id };
    }
    return null;
  }

  function nextUp(ag, p) {
    if (p.status === 'done') return null;
    const ms = milestones(ag, p).find((m) => !m.done);
    return ms || null;
  }

  function progress(ag, p) {
    const mb = A().monthsBetween;
    if (p.status === 'dev') return { k: Math.min(1, mb(p.startMs, ag.now) / devTotal(p)), label: t('hq.prog.dev', 'Development') };
    if (p.status === 'ready') return { k: 1, label: t('hq.prog.ready', 'Ready, waiting for launch') };
    if (p.status === 'flying') {
      const kind = D().MISSIONS[p.missionKey].kind;
      if (!p.arrived && kind !== 'earth') return { k: Math.max(0, Math.min(1, (ag.now - p.launchMs) / Math.max(1, p.arriveMs - p.launchMs))), label: t('hq.prog.cruise', 'Cruise') };
      const from = kind === 'earth' ? p.launchMs : p.arriveMs;
      return { k: Math.max(0, Math.min(1, (ag.now - from) / Math.max(1, (p.endMs || from) - from))), label: t('hq.prog.science', 'Science') };
    }
    const sc = p.result ? Math.round(p.result.score.total) : 0;
    return { k: sc / 100, label: t('hq.prog.score', 'Science returned') };
  }

  const eventDef = (id) => ((SMD.content && SMD.content.events) || []).find((e) => e.id === id);
  const findProject = (ag, id) => ag.projects.find((p) => p.id === id);
  const reserveLow = (p) => (p.status === 'dev' || p.status === 'ready') && ((p.reserve > 0 && p.reserveLeft < p.reserve * 0.3) || p.overrun > 0);

  // ---------- Pieces of HTML ----------
  function stars(rep) {
    const shown = 5;
    let s = '';
    for (let i = 0; i < shown; i++) s += `<i class="${i < rep ? 'on' : ''}" aria-hidden="true">★</i>`;
    return `<span class="hq-stars">${s}${rep > shown ? `<em>+${rep - shown}</em>` : ''}</span>`;
  }

  function emblem(ag, size) {
    const P = ag.patch || {};
    const col = /^#[0-9a-f]{6}$/i.test(P.color || '') ? P.color : '#17807a';
    return `<svg class="hq-emblem" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#d9a21b"/><circle cx="32" cy="32" r="26" fill="${col}"/>
      <path d="M14 44 L32 18 L50 44 Z" fill="#f4e4b5" opacity=".95"/><path d="M32 18 L50 44 L38 44 Z" fill="#000" opacity=".16"/>
      <ellipse cx="32" cy="34" rx="25" ry="8" transform="rotate(-18 32 34)" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 2.4"/>
      <circle cx="53" cy="27" r="3" fill="#fff"/></svg>`;
  }

  function topBar(ag) {
    const busy = A().busyTeams(ag);
    const low = ag.projects.filter(reserveLow);
    const year = new Date(ag.now).getUTCFullYear() - 2026;
    const heads = HEADLINE_KEYS.map((k) => `<i class="${ag.headlines.includes(k) ? 'on' : ''}" title="${esc(destName(k))}">${esc(destName(k).slice(0, 1))}</i>`).join('');
    return `<header class="hq-top">
      <div class="hq-id">
        ${emblem(ag, 40)}
        <div><h1 class="hq-name" dir="auto">${esc(ag.name)}</h1><p class="hq-motto">${esc(ag.patch && ag.patch.motto ? ag.patch.motto : t('hq.yearOf', 'Year {n} of 10', { n: Math.min(10, year) }))}</p></div>
      </div>
      <dl class="hq-stats">
        <div class="hq-stat hq-date"><dt>${t('hq.stat.date', 'Date')}</dt><dd class="num" data-date>${esc(my(ag.now))}</dd></div>
        <div class="hq-stat ${ag.money < 0 ? 'is-bad' : ''}"><dt>${t('hq.stat.money', 'Money')}</dt><dd class="num">${esc(money(ag.money))}</dd></div>
        <div class="hq-stat"><dt>${t('hq.stat.rep', 'Reputation')}</dt><dd aria-label="${esc(t('hq.stat.repA', 'Reputation {n}', { n: ag.rep }))}">${stars(ag.rep)}</dd></div>
        <div class="hq-stat"><dt>${t('hq.stat.sci', 'Science')}</dt><dd class="num">${esc(ui.fmt(ag.science))} <small>${t('hq.stat.pts', 'pts')}</small></dd></div>
        <div class="hq-stat"><dt>${t('hq.stat.teams', 'Teams busy')}</dt><dd class="num">${busy}/${ag.teams}</dd></div>
        <div class="hq-stat"><dt>${t('hq.stat.heads', 'Headlines')}</dt><dd class="hq-heads" aria-label="${esc(t('hq.stat.headsA', '{n} of 3 headline missions', { n: ag.headlines.length }))}">${heads}</dd></div>
      </dl>
      ${low.length ? `<button type="button" class="hq-chip warn" data-act="open" data-id="${low[0].id}">${esc(t('hq.reserveLow', 'Reserve low: {name}', { name: low[0].design.name }))}</button>` : ''}
      <div class="hq-topacts">
        ${meChip()}
        <button type="button" class="hq-iconbtn" data-act="lang" lang="${SMD.lang() === 'ar' ? 'en' : 'ar'}">${SMD.lang() === 'ar' ? 'English' : 'العربية'}</button>
        <div class="hq-menu">
          <button type="button" class="hq-iconbtn" data-act="menu" aria-haspopup="true" aria-expanded="false">${t('hq.menu', 'Menu')}</button>
          <div class="hq-menu-pop" role="menu" hidden>
            <button type="button" role="menuitem" data-act="tour">${t('hq.menu.tour', 'Show the HQ tour')}</button>
            <button type="button" role="menuitem" data-act="controls">${t('hq.menu.controls', 'Controls')}</button>
            <button type="button" role="menuitem" data-act="settings">${t('hq.menu.settings', 'Settings')}</button>
            <button type="button" role="menuitem" data-act="mute">${SMD.audio && SMD.audio.isMuted && SMD.audio.isMuted() ? t('hq.menu.unmute', 'Sound on') : t('hq.menu.mute', 'Sound off')}</button>
            <button type="button" role="menuitem" data-act="quit">${t('hq.menu.quit', 'Save and quit to title')}</button>
          </div>
        </div>
      </div>
    </header>`;
  }

  // The career calendar, 2027 to 2036: every project as a bar, planet windows below.
  function calendar(ag) {
    const C = D().CAREER;
    const x0 = C.start;
    const x1 = C.end;
    const W = 340;
    const G = 30; // gutter for the planet labels
    const X = (ms) => G + Math.max(0, Math.min(W - G, ((ms - x0) / (x1 - x0)) * (W - G)));
    const rows = ag.projects.slice(-6);
    const rowH = 13;
    const top = 16;
    const winTop = top + rows.length * rowH + 6;
    const H = winTop + WINDOW_KEYS.length * 8 + 2;
    let s = '';
    for (let y = 2027; y <= 2036; y++) {
      const x = X(Date.UTC(y, 0, 1));
      s += `<line x1="${x}" x2="${x}" y1="12" y2="${H}" class="grid"/><text x="${x + 3}" y="9" class="yr">${y === 2027 ? y : `’${String(y).slice(2)}`}</text>`;
    }
    rows.forEach((p, i) => {
      const y = top + i * rowH;
      const end = p.endMs || (p.arriveMs ? A().addMonths(p.arriveMs, 12) : A().addMonths(p.launchMs, 12));
      s += `<rect x="${X(p.startMs)}" y="${y}" width="${Math.max(2, X(p.launchMs) - X(p.startMs))}" height="9" rx="2" class="dev"/>`;
      if (!(p.status === 'done' && A().flightLost(p))) s += `<rect x="${X(p.launchMs)}" y="${y}" width="${Math.max(2, X(end) - X(p.launchMs))}" height="9" rx="2" class="${p.status === 'done' ? 'done' : 'fly'}"/>`;
      s += `<path d="M${X(p.launchMs)} ${y - 1} l3.5 5.5 h-7z" class="mk"/>`;
      s += `<text x="${Math.min(W - 4, X(p.startMs) + 3)}" y="${y + 7}" class="lbl">${esc(p.design.name)}</text>`;
    });
    WINDOW_KEYS.forEach((k, i) => {
      const y = winTop + i * 8;
      const wins = A().nextWindows({ now: x0 }, k) || [];
      s += `<text x="${G - 3}" y="${y + 5.5}" class="wl" text-anchor="end">${esc(destName(k))}</text>`;
      wins.forEach((w) => (s += `<rect x="${X(w.startMs)}" y="${y}" width="${Math.max(4, X(w.endMs) - X(w.startMs))}" height="6" rx="3" class="win ${k}"/>`));
    });
    s += `<line x1="${X(ag.now)}" x2="${X(ag.now)}" y1="12" y2="${H}" class="now"/>`;
    return `<figure class="hq-cal"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('hq.cal.aria', 'Career calendar from 2027 to 2036 with your projects and planet launch windows'))}">${s}</svg>
      <figcaption class="small"><span class="k dev"></span>${t('hq.cal.dev', 'Build')} <span class="k fly"></span>${t('hq.cal.fly', 'Flight')} <span class="k win"></span>${t('hq.cal.win', 'Launch window')} <span class="k now"></span>${t('hq.cal.now', 'Today')}</figcaption></figure>`;
  }

  function projectCard(ag, p, due) {
    const pr = progress(ag, p);
    const nx = nextUp(ag, p);
    const year = new Date(p.launchMs).getUTCFullYear();
    const isDue = due && due.p === p;
    let next = '';
    if (isDue) next = `<span class="tone warn">${esc(due.kind === 'review' ? t('hq.due.review', '{rev} due now', { rev: due.review }) : t('hq.due.event', 'Decision needed'))}</span>`;
    else if (p.status === 'done') {
      const r = p.result || {};
      const pts = `<span class="muted"> · ${esc(t('hq.pts', '{n} points', { n: Math.round(r.score ? r.score.total : 0) }))}</span>`;
      next = (r.lost ? `<span class="tone bad">${t('hq.lost', 'Spacecraft lost')}</span>` : r.success ? `<span class="tone ok">${t('hq.success', 'Headline science')}</span>` : `<span class="tone warn">${t('hq.partial', 'Partial science')}</span>`) + pts;
    } else if (nx) next = `${t('hq.next', 'Next')}: <b>${esc(nx.label)}</b> · ${esc(my(nx.ms))} <span class="muted">(${esc(inMonths(ag, nx.ms))})</span>`;
    const resK = p.reserve > 0 ? Math.max(0, p.reserveLeft / p.reserve) : 0;
    const reserve =
      p.status === 'dev' || p.status === 'ready'
        ? `<div class="hq-res ${reserveLow(p) ? 'is-low' : ''}"><span>${t('hq.reserve', 'Reserve')}</span><span class="hq-bar small" aria-hidden="true"><i style="inline-size:${(resK * 100).toFixed(0)}%"></i></span><span class="num">${esc(money(p.reserveLeft))}${p.overrun > 0 ? ` <b class="over">${esc(t('hq.overrun', '+{m} over', { m: money(p.overrun) }))}</b>` : ''}</span></div>`
        : '';
    return `<li class="hq-proj phase-${p.phase} ${isDue ? 'is-due' : ''}">
      <button type="button" class="hq-proj-btn" data-act="open" data-id="${p.id}" aria-label="${esc(t('hq.proj.open', 'Details for {name}', { name: p.design.name }))}">
        <span class="hq-patch">${SMD.patch.patchSVG(p.design, { year })}</span>
        <span class="hq-proj-body">
          <span class="hq-proj-head"><b class="hq-proj-name">${esc(p.design.name)}</b><span class="hq-phase"><abbr>${esc(p.phase)}</abbr> ${esc(PHASE[p.phase] ? PHASE[p.phase]() : '')}</span></span>
          <span class="hq-proj-mission">${esc(missionTitle(p.missionKey))}</span>
          <span class="hq-prog"><span class="hq-bar" aria-hidden="true"><i style="inline-size:${(pr.k * 100).toFixed(0)}%"></i></span><span class="small">${esc(pr.label)} ${Math.round(pr.k * 100)}${p.status === 'done' ? '' : '%'}</span></span>
          <span class="hq-proj-next small">${next}</span>
          ${reserve}
        </span>
      </button>
      ${isDue ? `<button type="button" class="btn small primary hq-due-btn" data-act="due">${esc(due.kind === 'review' ? t('hq.holdRev', 'Hold the {rev}', { rev: due.review }) : t('hq.decide', 'Decide now'))}</button>` : ''}
      ${p.status === 'done' ? `<button type="button" class="btn small ghost hq-due-btn" data-act="results" data-id="${p.id}">${t('hq.results', 'Mission results')}</button>` : ''}
    </li>`;
  }

  function projectsPanel(ag, due) {
    const active = ag.projects.filter((p) => p.status !== 'done');
    const done = ag.projects.filter((p) => p.status === 'done');
    const free = ag.teams - A().busyTeams(ag);
    return `<section class="hq-panel hq-projects" aria-labelledby="hq-proj-h">
      <header class="hq-panel-head"><h2 id="hq-proj-h">${t('hq.projects', 'Projects')}</h2><span class="small muted">${esc(t('hq.teamsFree', '{n} of {m} teams free', { n: Math.max(0, free), m: ag.teams }))}</span></header>
      ${calendar(ag)}
      ${
        active.length
          ? `<ol class="hq-proj-list">${active.map((p) => projectCard(ag, p, due)).join('')}</ol>`
          : `<div class="hq-empty"><p>${t('hq.empty', 'No spacecraft in the works. Answer an Announcement of Opportunity on the mission board to start your next project.')}</p><button type="button" class="btn small" data-act="board">${t('hq.openBoard', 'Open the mission board')}</button></div>`
      }
      ${done.length ? `<h3 class="hq-sub">${t('hq.flown', 'Flown')}</h3><ol class="hq-proj-list is-done">${done.slice().reverse().map((p) => projectCard(ag, p, due)).join('')}</ol>` : ''}
    </section>`;
  }

  function windowsStrip(ag) {
    const items = WINDOW_KEYS.map((k) => {
      const w = (A().nextWindows(ag, k) || [])[0];
      const st = A().contractState(ag, k);
      let when = t('hq.win.none', 'No window before 2037');
      let open = false;
      if (w) {
        open = w.startMs <= ag.now;
        when = open ? t('hq.win.open', 'Open now, closes {d}', { d: my(w.endMs) }) : t('hq.win.opens', 'Opens {d} ({rel})', { d: my(w.startMs), rel: inMonths(ag, w.startMs) });
      }
      const lock = st === 'locked' ? t('hq.win.locked', 'Needs reputation {n}', { n: D().CONTRACTS[k].unlockRep }) : st === 'needsTech' ? t('hq.win.tech', 'Needs research') : st === 'done' ? t('hq.win.done', 'Headline earned') : st === 'busy' ? t('hq.win.busy', 'Project under way') : t('hq.win.ok', 'Open for proposals');
      return `<li class="hq-win ${k} ${open ? 'is-open' : ''} st-${st}"><span class="hq-planet ${k}" aria-hidden="true"></span><span><b>${esc(destName(k))}</b> <span class="hq-win-when">${esc(when)}</span><span class="hq-win-st">${esc(lock)}</span></span></li>`;
    });
    return `<section class="hq-windows" aria-labelledby="hq-win-h"><h2 id="hq-win-h" class="hq-win-h">${t('hq.windows', 'Next launch windows')}</h2><ul>${items.join('')}</ul></section>`;
  }

  function nextEventLabel(ag, n) {
    const target = A().addMonths(ag.now, n);
    const sameMonth = (ms) => A().monthsBetween(target, ms) === 0;
    for (const p of ag.projects) {
      const m = milestones(ag, p).find((x) => !x.done && sameMonth(x.ms));
      if (m) return `${m.label} · ${p.design.name}`;
      if (p.status === 'dev' && p.events.some((s) => !s.resolved && s.atMs && sameMonth(s.atMs))) return t('hq.skip.event', 'Event · {name}', { name: p.design.name });
    }
    if (new Date(target).getUTCMonth() === 0) return t('hq.skip.budget', 'New budget year');
    return '';
  }

  // The one thing the player should do next. HQ always shows it in gold, in the
  // clock and on the matching dock button and campus pin, so nobody is left
  // wondering what to press.
  function nextStep(ag, due) {
    if (A().isOver(ag)) return { act: 'end', text: t('hq.over', 'Your ten years are up. The agency’s story is written.') };
    if (due) {
      return {
        act: 'due',
        text:
          due.kind === 'review'
            ? t('hq.blockRev', '{name} needs its {rev} before time can move on.', { name: due.p.design.name, rev: REVIEW_NAME[due.review]() })
            : t('hq.blockEv', '{name} needs a decision before time can move on.', { name: due.p.design.name }),
      };
    }
    const keys = Object.keys(D().CONTRACTS);
    const free = ag.teams - A().busyTeams(ag);
    const open = keys.filter((k) => A().contractState(ag, k) === 'open');
    const building = ag.projects.some((p) => p.status === 'dev' || p.status === 'ready');
    if (free > 0 && open.length && !building && ag.money > 0) {
      return ag.projects.length
        ? { act: 'board', text: t('hq.next.board', 'A team is free. Pick the next question on the mission board.') }
        : { act: 'board', text: t('hq.next.first2', 'Your {n} teams are waiting. Pick your first mission on the board.', { n: ag.teams }) };
    }
    // Research that opens a contract, and that the agency can already afford.
    for (const k of keys) {
      if (A().contractState(ag, k) !== 'needsTech') continue;
      const missing = (D().CONTRACTS[k].needsTech || []).filter((id) => !ag.tech.includes(id)).map((id) => D().TECH.find((x) => x.id === id)).filter(Boolean);
      const cost = missing.reduce((s, x) => s + x.cost, 0);
      if (missing.length && ag.science >= cost)
        return { act: 'research', text: t('hq.next.research', 'Buy {tech} in the research lab to open “{m}”.', { tech: missing.map((x) => t('tech.' + x.id, x.name)).join(', '), m: missionTitle(k) }) };
    }
    const n = A().monthsToNextEvent(ag);
    const lbl = nextEventLabel(ag, n);
    const when = n === 1 ? t('hq.skip.1', '1 month') : t('hq.skip.n', '{n} months', { n });
    if (free > 0 && open.length && ag.money > 0) return { act: 'skip', alt: 'board', text: lbl ? t('hq.next.skipBoard', 'Next up: {what}, in {when}. A team is free if you want a second mission.', { what: lbl, when }) : t('hq.next.skipBoard0', 'Skip ahead, or put your free team on a second mission.') };
    return { act: 'skip', text: lbl ? t('hq.next.skip', 'Next up: {what}, in {when}.', { what: lbl, when }) : t('hq.next.skip0', 'Skip ahead. Time stops by itself when something needs you.') };
  }

  function dock(ag, due, busy, nx) {
    const C = D().CAREER;
    const canHire = ag.teams < C.maxTeams && ag.money >= C.hireTeamCost;
    const hireWhy = ag.teams >= C.maxTeams ? t('hq.hire.max', 'All {n} teams hired', { n: C.maxTeams }) : t('hq.hire.cost', '{m} once', { m: money(C.hireTeamCost) });
    const free = ag.teams - A().busyTeams(ag);
    const n = A().monthsToNextEvent(ag);
    const lbl = nextEventLabel(ag, n);
    const cheapTech = (D().TECH || []).filter((x) => !ag.tech.includes(x.id)).reduce((m, x) => Math.min(m, x.cost), Infinity);
    const resBadge = ag.science >= cheapTech;
    const disc = (ag.discoveries || []).length;
    const isNext = (act) => (nx.act === act ? ' is-next' : '');
    const skipBtn = (primary) =>
      `<button type="button" class="btn ${primary ? 'primary' : 'ghost'}${primary ? ' is-next' : ''}" data-act="skip" ${busy ? 'disabled' : ''}><span>${primary ? t('hq.skip', 'Skip to next event') : t('hq.skipShort', 'Skip ahead')}</span><small class="hq-skip-n">${esc(n === 1 ? t('hq.skip.1', '1 month') : t('hq.skip.n', '{n} months', { n }))}${lbl ? ` · ${esc(lbl)}` : ''}</small></button>`;
    let btns = '';
    if (nx.act === 'end') btns = `<button type="button" class="btn primary is-next" data-act="end">${t('hq.legacy', 'See your agency’s legacy')}</button>`;
    else if (nx.act === 'due') btns = `<button type="button" class="btn primary is-next" data-act="due">${esc(due.kind === 'review' ? t('hq.holdRev', 'Hold the {rev}', { rev: due.review }) : t('hq.decide', 'Decide now'))}</button>`;
    else if (nx.act === 'board' || nx.act === 'research')
      btns = `<button type="button" class="btn primary is-next hq-go" data-act="${nx.act}" ${busy ? 'disabled' : ''}>${nx.act === 'board' ? t('hq.go.board', 'Pick a mission') : t('hq.go.research', 'Research lab')}</button>${skipBtn(false)}`;
    else btns = `<button type="button" class="btn ghost" data-act="month" ${busy ? 'disabled' : ''}>${t('hq.month', 'Next month')}</button>${skipBtn(true)}`;
    return `<section class="hq-dock" aria-label="${esc(t('hq.dock', 'Agency actions'))}">
      <nav class="hq-actions" aria-label="${esc(t('hq.places', 'Places'))}">
        <button type="button" class="hq-act ${free > 0 ? 'is-hot' : ''}${isNext('board')}" data-act="board">${ICON.board}<span><b>${t('hq.act.board', 'Mission board')}</b><small>${free > 0 ? t('hq.act.board.s', 'Pick a new mission') : t('hq.act.board.full', 'All teams busy')}</small></span></button>
        <button type="button" class="hq-act" data-act="map">${ICON.map}<span><b>${t('hq.act.map', 'Solar system map')}</b><small>${t('hq.act.map.s', 'Planets and windows')}</small></span></button>
        <button type="button" class="hq-act ${resBadge ? 'has-badge' : ''}${isNext('research')}" data-act="research">${ICON.research}<span><b>${t('hq.act.research', 'Research lab')}</b><small>${resBadge ? t('hq.act.research.ready', 'Research ready to buy') : t('hq.act.research.s', 'Spend science points')}</small></span></button>
        <button type="button" class="hq-act" data-act="archive">${ICON.archive}<span><b>${t('hq.act.archive', 'Discovery archive')}</b><small>${esc(t('hq.act.archive.s', '{n} discoveries', { n: disc }))}</small></span></button>
        <button type="button" class="hq-act" data-act="hire" ${canHire && !busy ? '' : 'disabled'}>${ICON.hire}<span><b>${t('hq.act.hire', 'Hire a team')}</b><small>${esc(hireWhy)}</small></span></button>
      </nav>
      <div class="hq-clock is-${esc(nx.act)}" aria-live="off">
        <div class="hq-clock-date"><span class="small muted">${t('hq.today', 'Today')}</span><b class="num" data-date>${esc(my(ag.now))}</b></div>
        <div class="hq-clock-main">
          <p class="hq-next" aria-live="polite"><span class="hq-next-k">${t('hq.next.k', 'Next step')}</span><span class="hq-next-t">${esc(nx.text)}</span></p>
          <div class="hq-clock-btns">${btns}</div>
        </div>
      </div>
    </section>`;
  }

  function ticker(ag) {
    const items = (ag.log || []).slice(0, 10);
    if (!items.length) items.push({ ms: ag.now, text: t('hq.tick.welcome', 'Welcome to your new agency. The first Announcements of Opportunity are on the mission board.') });
    const row = items.map((l) => `<span class="hq-tick-item"><b>${esc(my(l.ms))}</b> ${esc(A().logText ? A().logText(l) : l.text)}</span>`).join('');
    return `<div class="hq-ticker" role="log" aria-label="${esc(t('hq.news', 'Agency news'))}"><span class="hq-tick-tag">${t('hq.newsTag', 'News')}</span><div class="hq-tick-track"><div class="hq-tick-row">${row}</div><div class="hq-tick-row" aria-hidden="true">${row}</div></div></div>`;
  }

  // ---------- Details drawer ----------
  function drawerHTML(ag, p) {
    const I = D().INSTRUMENTS;
    const O = D().OPTIONS;
    const opt = (list, id) => (list.find((o) => o.id === id) || {}).name || String(id);
    const d = p.design;
    const ms = milestones(ag, p);
    const tp = t(`tests.${p.testPlan}`, (D().TEST_PLANS.find((x) => x.id === p.testPlan) || {}).name || p.testPlan);
    const conf = t(`conf.${p.confidence}`, (A().CONFIDENCE[p.confidence] || {}).name || p.confidence);
    const spent = p.buildCost - p.devLeft;
    const evs = p.events
      .filter((s) => s.resolved)
      .map((s) => {
        const e = eventDef(s.id);
        if (!e) return '';
        const c = e.choices.find((x) => x.id === s.choice);
        return `<li><b>${esc(e.title)}</b><span>${esc(c ? c.label : '')}</span>${e.realStory ? `<span class="small muted">${esc(t('hq.d.story', 'Real story: {m}, {y}', { m: e.realStory.mission, y: e.realStory.year }))}</span>` : ''}</li>`;
      })
      .join('');
    const revs = ['PDR', 'CDR', 'FRR']
      .map((r) => `<li class="${p.reviews[r] ? 'is-done' : ''}"><b>${r}</b> ${esc(REVIEW_NAME[r]())}<span class="small muted">${p.reviews[r] ? esc(t('hq.d.passed', 'Passed {d}', { d: my(p.reviews[r].at) })) : esc(t('hq.d.planned', 'Planned {d}', { d: my(ms.find((m) => m.id === r).ms) }))}</span></li>`)
      .join('');
    const timeline = p.flight && p.flight.timeline ? p.flight.timeline.filter((x) => x.ms <= ag.now).slice(-6) : [];
    const sc = p.result && p.result.score;
    return `<header class="hq-drawer-head">
        <span class="hq-patch big">${SMD.patch.patchSVG(d, { year: new Date(p.launchMs).getUTCFullYear() })}</span>
        <div><p class="small muted">${esc(missionTitle(p.missionKey))}</p><h2 id="hq-drawer-h">${esc(d.name)}</h2>
        <p class="hq-phase big"><abbr>${esc(p.phase)}</abbr> ${esc(PHASE[p.phase] ? PHASE[p.phase]() : '')}</p></div>
        <button type="button" class="hq-close" data-act="close" aria-label="${esc(t('hq.close', 'Close'))}">×</button>
      </header>
      <div class="hq-drawer-body">
        ${sc ? `<div class="hq-score"><b class="num">${Math.round(sc.total)}</b><span>${t('hq.d.score', 'science points of 100')}</span></div>` : ''}
        <h3>${t('hq.d.milestones', 'Milestones')}</h3>
        <ol class="hq-ms">${ms.map((m) => `<li class="${m.done ? 'is-done' : ''}"><span class="dot" aria-hidden="true"></span><b>${esc(m.label)}</b><span class="num">${esc(my(m.ms))}</span><span class="small muted">${m.done ? t('hq.d.done', 'done') : esc(inMonths(ag, m.ms))}</span></li>`).join('')}</ol>
        <h3>${t('hq.d.reviews', 'Review boards')}</h3>
        <ul class="hq-revs">${revs}</ul>
        <h3>${t('hq.d.design', 'Design')}</h3>
        <dl class="hq-spec">
          <dt>${t('hq.d.instr', 'Instruments')}</dt><dd>${d.instruments.length ? d.instruments.map((id) => esc(t(`hq.inst.${id}`, I[id] ? I[id].name : id))).join(', ') : '–'}</dd>
          <dt>${t('hq.d.power', 'Power')}</dt><dd>${esc(t('hq.d.powerV', '{a} m² of solar panels', { a: d.arrays }))}${d.rtg ? esc(t('hq.d.rtg', ', {n} RTG', { n: d.rtg })) : ''}</dd>
          <dt>${t('hq.d.comms', 'Radio')}</dt><dd>${esc(opt(O.dish, d.dish))}, ${esc(opt(O.amp, d.amp))}, ${esc(opt(O.recorder, d.recorder))}</dd>
          <dt>${t('hq.d.computer', 'Computer')}</dt><dd>${esc(opt(O.avionics, d.avionics))}</dd>
          <dt>${t('hq.d.launcher', 'Launcher')}</dt><dd>${esc(opt(O.launcher, d.launcher))}${d.capture === 'aerobrake' ? esc(t('hq.d.aero', ', aerobraking')) : ''}</dd>
          <dt>${t('hq.d.tests', 'Tests')}</dt><dd>${esc(tp)}</dd>
          <dt>${t('hq.d.conf', 'Cost confidence')}</dt><dd>${esc(conf)}</dd>
        </dl>
        <h3>${t('hq.d.money', 'Money')}</h3>
        <dl class="hq-spec">
          <dt>${t('hq.d.build', 'Build cost')}</dt><dd class="num">${esc(money(p.buildCost))} <span class="muted">(${esc(t('hq.d.spent', '{m} spent', { m: money(spent) }))})</span></dd>
          <dt>${t('hq.d.reserve', 'Reserve')}</dt><dd class="num">${esc(t('hq.d.reserveV', '{l} of {r} left', { l: money(p.reserveLeft), r: money(p.reserve) }))}</dd>
          ${p.overrun > 0 ? `<dt>${t('hq.d.overrun', 'Overrun')}</dt><dd class="num over">${esc(money(p.overrun))}${p.breach ? ` · ${esc(t('hq.d.breach', 'Congress notified'))}` : ''}</dd>` : ''}
          <dt>${t('hq.d.launchCost', 'Launch')}</dt><dd class="num">${esc(money(p.launcherCost))}</dd>
        </dl>
        ${evs ? `<h3>${t('hq.d.events', 'What happened')}</h3><ul class="hq-evs">${evs}</ul>` : ''}
        ${timeline.length ? `<h3>${t('hq.d.flight', 'Flight log')}</h3><ul class="hq-evs">${timeline.map((x) => `<li class="tone-${esc(x.tone || '')}"><b>${esc(my(x.ms))} · ${esc(x.title)}</b>${x.text ? `<span>${esc(x.text)}</span>` : ''}</li>`).join('')}</ul>` : ''}
        ${p.status === 'done' ? `<button type="button" class="btn primary" data-act="results" data-id="${p.id}">${t('hq.results', 'Mission results')}</button>` : ''}
        ${testlabOn() && p.status === 'dev' && (p.phase === 'C' || p.phase === 'D') ? `<button type="button" class="btn primary" data-act="tests" data-id="${p.id}">${t('hq.w.runTests', 'Run tests')}</button>` : ''}
      </div>`;
  }

  // ---------- The staff on the campus: who says what ----------
  // Every line comes from the real career state; every button is a real game
  // action (the same ones the dock and the gold button do).
  const STAFF = () => (SMD.content && SMD.content.staff) || [];
  const staffDef = (id) => STAFF().find((s) => s.id === id) || null;
  const staffName = (s) => t(`staff.${s.id}.name`, s.name);
  const staffRole = (s) => t(`staff.${s.id}.role`, s.role);
  const testlabOn = () => !!ui.screens.testlab;
  // Spacecraft the test hall can take: in development, Phase C or D.
  const testable = (ag) => ag.projects.filter((p) => p.status === 'dev' && (p.phase === 'C' || p.phase === 'D'));
  const cheapTechs = (ag) => (D().TECH || []).filter((x) => !ag.tech.includes(x.id) && x.cost <= ag.science);
  const met = new Set(); // people you have talked to this session (they say hello once)
  const tipAt = {};
  function staffTip(s, step) {
    const all = (SMD.content && SMD.content.tips) || [];
    const mine = all.filter((x) => (s.topics || []).includes(x.topic));
    const list = mine.length ? mine : all;
    if (!list.length) return null;
    if (tipAt[s.id] === undefined) tipAt[s.id] = Math.floor(Math.random() * list.length);
    tipAt[s.id] = (tipAt[s.id] + (step || 0)) % list.length;
    const x = list[tipAt[s.id]];
    return { text: t(`content.tips.${x.id}`, x.text), url: x.url };
  }
  // Who has news for you (the "!" marker).
  function staffAlerts(ag, due, nx) {
    return {
      director: !!due || nx.act === 'end',
      budget: ag.money < 0 || ag.projects.some(reserveLow),
      scientist: cheapTechs(ag).length > 0,
      engineer: testlabOn() && ag.projects.some((p) => p.status === 'dev' && p.phase === 'D'),
    };
  }
  const go2 = (id) => `go:${id}`;

  // What a person says now: { lines[], acts[{act, label, primary}], tip }.
  function staffSay(ag, s, due, nx) {
    const lines = [];
    const acts = [];
    const latest = (ag.log || [])[0];
    const news = latest ? (A().logText ? A().logText(latest) : latest.text) : '';
    const projOf = (p) => ({ name: p.design.name });
    if (s.id === 'director') {
      lines.push(nx.text);
      if (nx.act === 'due') acts.push({ act: 'due', label: due && due.kind === 'review' ? t('hq.holdRev', 'Hold the {rev}', { rev: due.review }) : t('hq.decide', 'Decide now'), primary: true });
      else if (nx.act === 'board') acts.push({ act: go2('board'), label: t('hq.openBoard', 'Open the mission board'), primary: true });
      else if (nx.act === 'research') acts.push({ act: go2('research'), label: t('hq.w.goResearch', 'Go to the research lab'), primary: true });
      else if (nx.act === 'end') acts.push({ act: 'end', label: t('hq.legacy', 'See your agency’s legacy'), primary: true });
      else {
        acts.push({ act: 'skip', label: t('hq.skip', 'Skip to next event'), primary: true });
        if (nx.alt === 'board') acts.push({ act: go2('board'), label: t('hq.openBoard', 'Open the mission board') });
      }
      if (news) lines.push(t('hq.w.news', 'Latest news: {text}', { text: news }));
    } else if (s.id === 'engineer') {
      const dev = ag.projects.filter((p) => p.status === 'dev' || p.status === 'ready');
      const tests = testable(ag);
      if (!dev.length) {
        lines.push(t('hq.w.eng.empty', 'The clean room is empty. Pick a mission on the board, and my team starts building.'));
        acts.push({ act: go2('board'), label: t('hq.openBoard', 'Open the mission board'), primary: true });
      } else {
        const p = tests[0] || dev[0];
        const nxm = nextUp(ag, p);
        lines.push(
          nxm
            ? t('hq.w.eng.proj', '{name} is in Phase {ph}, {phase}. Next: {what}, {when}.', { ...projOf(p), ph: p.phase, phase: PHASE[p.phase] ? PHASE[p.phase]() : '', what: nxm.label, when: inMonths(ag, nxm.ms) })
            : t('hq.w.eng.proj0', '{name} is in Phase {ph}, {phase}.', { ...projOf(p), ph: p.phase, phase: PHASE[p.phase] ? PHASE[p.phase]() : '' })
        );
        if (testlabOn() && tests.length) {
          lines.push(t('hq.w.eng.test', 'It is ready for the test hall. We shake it, bake it and freeze it here, so space can’t surprise us.'));
          acts.push({ act: go2('testlab'), label: t('hq.w.visitTests', 'Visit the test hall'), primary: true });
        } else if (testlabOn() && p.phase === 'B') lines.push(t('hq.w.eng.testLater', 'After its PDR it moves to Phase C. Then we can test it in the test hall.'));
        acts.push({ act: `open:${p.id}`, label: t('hq.w.show', 'Show me {name}', projOf(p)), primary: !acts.length });
      }
    } else if (s.id === 'scientist') {
      const can = cheapTechs(ag);
      if (nx.act === 'research') lines.push(nx.text);
      else if (can.length) lines.push(t('hq.w.sci.can', 'We have {n} science points. That is enough for {tech}.', { n: ui.fmt(ag.science), tech: t('tech.' + can[0].id, can[0].name) }));
      else lines.push(t('hq.w.sci.save', 'We have {n} science points. Every mission that returns data earns more.', { n: ui.fmt(ag.science) }));
      if (can.length) acts.push({ act: go2('research'), label: t('hq.w.goResearch', 'Go to the research lab'), primary: true });
      const n = (ag.discoveries || []).length;
      lines.push(n ? t('hq.w.sci.disc', 'Our spacecraft have unlocked {n} real NASA discoveries so far.', { n }) : t('hq.w.sci.disc0', 'No discoveries yet. Our first good results will unlock real NASA images.'));
      if (n) acts.push({ act: go2('archive'), label: t('hq.w.goArchive', 'Visit the discovery archive'), primary: !acts.length });
    } else if (s.id === 'budget') {
      const C = D().CAREER;
      const low = ag.projects.find(reserveLow);
      lines.push(ag.money < 0 ? t('hq.w.bud.broke', 'We are out of money. Building stops until the new budget arrives in January.') : t('hq.w.bud.bank', 'We have {m} in the bank.', { m: money(ag.money) }));
      if (low) {
        lines.push(t('hq.w.bud.low', '{name} has only {m} of reserve left. An overrun comes out of our own budget.', { ...projOf(low), m: money(low.reserveLeft) }));
        acts.push({ act: `open:${low.id}`, label: t('hq.w.show', 'Show me {name}', projOf(low)), primary: true });
      } else lines.push(t('hq.w.bud.ok', 'Every project still has its reserve. That is the money we keep for surprises.'));
      if (ag.teams < C.maxTeams && ag.money >= C.hireTeamCost) acts.push({ act: 'hire', label: t('hq.w.hire', 'Hire a team ({m})', { m: money(C.hireTeamCost) }), primary: !acts.length });
      const busyP = ag.projects.find((p) => p.status === 'dev' || p.status === 'ready');
      if (!acts.length && busyP) acts.push({ act: `open:${busyP.id}`, label: t('hq.w.books', 'Show me the books for {name}', projOf(busyP)), primary: true });
      if (!acts.length) acts.push({ act: go2('board'), label: t('hq.openBoard', 'Open the mission board'), primary: true });
    } else if (s.id === 'intern') {
      let best = null;
      WINDOW_KEYS.forEach((k) => {
        const w = (A().nextWindows(ag, k) || [])[0];
        if (w && (!best || w.startMs < best.w.startMs)) best = { k, w };
      });
      if (best && best.w.startMs <= ag.now) lines.push(t('hq.w.int.open', 'The launch window to {planet} is open right now, until {date}! Planets only line up like this every so often.', { planet: destName(best.k), date: my(best.w.endMs) }));
      else if (best) lines.push(t('hq.w.int.next', 'The next launch window is to {planet}: it opens {date}, {when}. Miss it and you wait for the next one.', { planet: destName(best.k), date: my(best.w.startMs), when: inMonths(ag, best.w.startMs) }));
      else lines.push(t('hq.w.int.none', 'No more planet windows before 2037. Earth and Moon missions can still fly.'));
      acts.push({ act: go2('map'), label: t('hq.w.goMap', 'Show me on the solar system map'), primary: true });
    } else if (s.id === 'outreach') {
      lines.push(t('hq.w.out.rep', 'Our reputation is {n} stars, with {h} of 3 headline missions.', { n: ag.rep, h: ag.headlines.length }));
      const next = Object.keys(D().CONTRACTS)
        .filter((k) => A().contractState(ag, k) === 'locked')
        .sort((a, b) => D().CONTRACTS[a].unlockRep - D().CONTRACTS[b].unlockRep)[0];
      if (next) lines.push(t('hq.w.out.unlock', 'At reputation {n}, “{m}” opens up.', { n: D().CONTRACTS[next].unlockRep, m: missionTitle(next) }));
      else if (news) lines.push(t('hq.w.out.news', 'Everyone is talking about this: {text}', { text: news }));
      const done = ag.projects.filter((p) => p.status === 'done').slice(-1)[0];
      if (done) acts.push({ act: `results:${done.id}`, label: t('hq.w.results', 'See the results of {name}', projOf(done)), primary: true });
      else acts.push({ act: go2('archive'), label: t('hq.w.goArchive', 'Visit the discovery archive'), primary: true });
    }
    return { lines, acts };
  }

  // ---------- Coach marks ----------
  // Short cards, no walls of text: the goal, the one button to follow, and how to walk.
  const touchUI = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const COACH = [
    { sel: null, goal: true, title: () => t('hq.coach1.t', 'Welcome, director'), body: (ag) => t('hq.coach1.b2', 'You have ten years and {m}. Make the news three times:', { m: money(ag.money) }) },
    { sel: '.hq-clock', title: () => t('hq.coach2.t', 'Follow the gold button'), body: () => t('hq.coach2.b', 'It is always your next step. Time only moves when you press it, and stops by itself when something needs you.') },
    {
      sel: '.hq-view',
      title: () => t('hq.coachW.t', 'Walk around your agency'),
      body: () => (touchUI() ? t('hq.coachW.bTouch2', 'Drag your left thumb to walk (a joystick appears), drag on the right to look. Walk up to a door or a person and tap the big button: they know what to do next.') : t('hq.coachW.b2', 'Walk with W A S D (Shift runs); the camera follows behind you. Walk up to a door or a person and press E: they know what to do next. H shows all the controls.')),
    },
  ];

  // The astronaut says hello the first time the campus opens this session.
  let firstVisit = true;
  // The screen the HQ handed over to, so you come back out of that building's
  // door, and the view you were using (walking or the campus map).
  let leftTo = null;
  let viewPref = 'walk';
  const DOOR_OF = { board: 'board', review: 'board', results: 'board', end: 'board', classroom: 'board', design: 'design', research: 'research', archive: 'archive', map: 'map', testlab: 'testlab', launchday: 'pad', film: 'pad', ride: 'pad' };

  // ---------- The screen ----------
  ui.screens.hq = {
    render(app, params) {
      let ag = SMD.game.agency || SMD.game.load();
      if (!ag) {
        SMD.go('newgame');
        return;
      }
      let alive = true;
      let busy = false;
      let drawerId = null;
      let wasBroke = ag.money < 0;
      let hq3d = null;
      let nx = { act: 'skip', text: '' };
      let lastDueKey = null;
      const cleanups = [];

      app.innerHTML = `<main class="screen hq">
        <div class="hq-ui" data-ui></div>
        <div class="hq-stage" data-stage><div class="hq-pins" data-pins></div><div class="hq-view" data-view></div></div>
        <aside class="hq-drawer" data-drawer role="dialog" aria-modal="false" aria-labelledby="hq-drawer-h" hidden></aside>
        <div class="hq-toasts" data-toasts aria-live="polite"></div>
        <div class="hq-coach" data-coach role="dialog" aria-live="polite" hidden></div>
        <section class="hq-talk" data-talk role="dialog" aria-modal="false" aria-labelledby="hq-talk-h" hidden></section>
      </main>`;
      const root = app.querySelector('.hq');
      const uiEl = root.querySelector('[data-ui]');
      const stage = root.querySelector('[data-stage]');
      const drawer = root.querySelector('[data-drawer]');
      const toastsEl = root.querySelector('[data-toasts]');
      const coachEl = root.querySelector('[data-coach]');
      const viewEl = root.querySelector('[data-view]');
      const talkEl = root.querySelector('[data-talk]');
      let talkWith = null; // { id } of the person whose card is open, or { chooser: true }
      const spawn = DOOR_OF[leftTo] || null;
      leftTo = null;

      function toast(text, tone) {
        const el = document.createElement('div');
        el.className = `hq-toast ${tone || ''}`;
        el.textContent = text;
        toastsEl.appendChild(el);
        while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
        setTimeout(() => el.classList.add('is-out'), 4200);
        setTimeout(() => el.remove(), 4800);
      }

      const labels = () => ({
        board: { title: t('hq.b.control', 'Mission control'), sub: t('hq.b.control.s', 'Mission board'), badge: nx.act === 'board' ? 'next' : null },
        design: { title: t('hq.b.clean', 'Clean room'), sub: t('hq.b.clean.s', 'Spacecraft in build') },
        research: { title: t('hq.b.lab', 'Research lab'), sub: t('hq.b.lab.s', 'Buy new technology'), badge: nx.act === 'research' ? 'next' : null },
        archive: { title: t('hq.b.archive', 'Discovery archive'), sub: t('hq.b.archive.s', 'Real NASA discoveries') },
        map: { title: t('hq.b.dsn', 'Deep space dish'), sub: t('hq.b.dsn.s', 'Solar system map') },
        pad: padLabel(),
        ...(testlabOn() ? { testlab: { title: t('hq.b.tests', 'Test hall'), sub: testable(ag).length ? t('hq.b.tests.s', 'Shake, bake and test') : t('hq.b.tests.none', 'Nothing to test yet'), badge: testable(ag).some((p) => p.phase === 'D') ? 'next' : null } } : {}),
      });
      // The pad shows the next spacecraft to fly, and lights up when one is ready.
      function padLabel() {
        const next = ag.projects.filter((x) => x.status === 'dev' || x.status === 'ready').sort((a, b) => a.launchMs - b.launchMs)[0];
        if (!next) return { title: t('hq.b.pad', 'Launch pad'), sub: t('hq.b.pad.s', 'Next launch') };
        const sub = next.status === 'ready' ? t('hq.b.pad.ready', '{name} is ready to fly', { name: next.design.name }) : t('hq.b.pad.next', '{name}, {date}', { name: next.design.name, date: my(next.launchMs) });
        return { title: t('hq.b.pad', 'Launch pad'), sub, badge: next.status === 'ready' ? 'next' : null };
      }
      const staffLabels = () => {
        const out = {};
        STAFF().forEach((s) => {
          out[s.id] = { name: staffName(s), role: staffRole(s), talk: t('hq.w.talkKey', 'Talk'), aria: t('hq.w.talkTo', 'Talk to {name}, {role}', { name: staffName(s), role: staffRole(s) }) };
        });
        return out;
      };

      function scene3dState() {
        const ready = ag.projects.find((p) => p.status === 'ready') || ag.projects.find((p) => p.status === 'dev' && A().monthsBetween(ag.now, p.launchMs) <= 1 && p.reviews.FRR);
        return {
          rocket: ready ? ready.design.launcher : null,
          building: ag.projects.some((p) => p.status === 'dev'),
          flying: ag.projects.filter((p) => p.status === 'flying').length,
        };
      }

      // Tell the 3D camera which part of the screen is free of panels.
      function updateInsets() {
        if (!hq3d || !alive) return;
        const r = stage.getBoundingClientRect();
        if (r.width < 760) {
          hq3d.setInsets({ left: 0, right: 0, top: 0, bottom: 0 });
          return;
        }
        const rtl = SMD.dir() === 'rtl';
        const dock0 = uiEl.querySelector('.hq-dock');
        if (dock0) root.style.setProperty('--hq-dock-h', `${Math.round(dock0.getBoundingClientRect().height)}px`);
        const proj = uiEl.querySelector('.hq-projects');
        const top = uiEl.querySelector('.hq-top');
        const dk = uiEl.querySelector('.hq-dock');
        const pr = proj ? proj.getBoundingClientRect() : null;
        const side = pr ? (rtl ? r.right - pr.left : pr.right - r.left) : 0;
        const other = 0;
        hq3d.setInsets({
          left: rtl ? other : side,
          right: rtl ? side : other,
          top: top ? top.getBoundingClientRect().bottom - r.top : 0,
          bottom: dk ? r.bottom - dk.getBoundingClientRect().top : 0,
        });
      }

      function paint() {
        if (!alive) return;
        ag = SMD.game.agency;
        const focusAct = document.activeElement && uiEl.contains(document.activeElement) ? document.activeElement.dataset.act : null;
        const scrollEl = uiEl.querySelector('.hq-projects');
        const scroll = scrollEl ? scrollEl.scrollTop : 0;
        const due = owed(ag);
        nx = nextStep(ag, due);
        uiEl.innerHTML = `${topBar(ag)}
          ${ag.money < 0 ? `<div class="hq-banner" role="alert"><b>${t('hq.broke.t', 'Out of money.')}</b> ${t('hq.broke.b', 'Development is paused until the new budget year in January. Spacecraft in flight still cost money to operate.')}</div>` : ''}
          ${projectsPanel(ag, due)}
          ${windowsStrip(ag)}
          ${dock(ag, due, busy, nx)}
          ${ticker(ag)}`;
        const sc2 = uiEl.querySelector('.hq-projects');
        if (sc2) sc2.scrollTop = scroll;
        if (focusAct) {
          const f = uiEl.querySelector(`[data-act="${focusAct}"]:not([disabled])`);
          if (f) f.focus({ preventScroll: true });
        }
        if (hq3d) {
          hq3d.setState(scene3dState());
          hq3d.setLabels(labels());
          if (hq3d.setStaffState) {
            hq3d.setStaffState(staffAlerts(ag, due, nx));
            hq3d.setStaffLabels(staffLabels());
          }
        }
        if (drawerId != null) openDrawer(drawerId, true);
        if (talkWith) renderTalk(true);
        paintView();
        // Something new needs the director: the astronaut waves at you.
        const dueKey = due ? `${due.kind}:${due.p.id}:${due.review || due.eventId}` : '';
        if (dueKey && dueKey !== lastDueKey && hq3d && hq3d.react) hq3d.react('wave');
        lastDueKey = dueKey;
        requestAnimationFrame(updateInsets);
      }

      // Walking (the default) or the campus map, with a one-line reminder of the controls.
      function paintView() {
        if (!viewEl) return;
        const walking = !!(hq3d && hq3d.follow);
        const hint = touchUI()
          ? t('hq.w.hintTouch2', 'Left thumb: walk · right side: look · tap to go · pinch to zoom')
          : t('hq.w.hint2', 'Walk: W A S D (Shift runs) · Look: mouse · Use: E · Controls: H');
        const mapHint = touchUI() ? t('hq.w.mapHintTouch', 'Tap a building to walk there and go in.') : t('hq.w.mapHint', 'Click a building to walk there and go in.');
        viewEl.innerHTML = hq3d
          ? `<button type="button" class="hq-view-btn" data-view-act="toggle">${walking ? ICON.campus : ICON.walk}<span>${esc(walking ? t('hq.w.map', 'Campus map') : t('hq.w.walk', 'Back to walking'))}</span>${touchUI() ? '' : '<kbd>M</kbd>'}</button>
            <p class="hq-view-hint">${esc(walking ? hint : mapHint)}</p>`
          : '';
        root.classList.toggle('is-walking', walking);
      }
      viewEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-view-act]');
        if (!b || !hq3d) return;
        hq3d.setFollow(!hq3d.follow);
        if (!hq3d.follow) closeTalk();
        paintView();
        const nb = viewEl.querySelector('[data-view-act]');
        if (nb) nb.focus({ preventScroll: true });
      });

      // ---------- Talking to the staff ----------
      // The card shows what they say and real actions; walking away closes it.
      function renderTalk(keep) {
        if (!talkWith) return;
        const due = owed(ag);
        let head;
        let body;
        if (talkWith.chooser) {
          const list = testable(ag);
          head = `<span class="hq-talk-face is-icon" aria-hidden="true">${ICON.research}</span><div><h2 id="hq-talk-h">${esc(t('hq.b.tests', 'Test hall'))}</h2><p class="small">${esc(t('hq.w.choose', 'Which spacecraft goes in for tests?'))}</p></div>`;
          body = `<div class="hq-talk-acts">${list.map((p, i) => `<button type="button" class="btn ${i ? '' : 'primary'}" data-talk-act="tests:${p.id}">${esc(p.design.name)} <small>· ${esc(t('hq.w.phase', 'Phase {ph}', { ph: p.phase }))}</small></button>`).join('')}</div>`;
        } else {
          const s = staffDef(talkWith.id);
          if (!s) return closeTalk();
          const say = staffSay(ag, s, due, nx);
          const hello = talkWith.hello ? `<p class="hq-talk-hello">${esc(t(`staff.${s.id}.hello`, s.hello || ''))}</p>` : '';
          if (!keep) talkWith.tip = staffTip(s, talkWith.tipStep || 0);
          const tip = talkWith.tip;
          const face = hq3d && hq3d.staffPortrait ? hq3d.staffPortrait(s.id) : null;
          head = `<span class="hq-talk-face" aria-hidden="true">${face ? `<img src="${esc(face)}" alt="" width="56" height="56" />` : ''}</span>
            <div><h2 id="hq-talk-h">${esc(staffName(s))}</h2><p class="small">${esc(staffRole(s))} · ${esc(t(`staff.${s.id}.from`, s.from || ''))}</p></div>`;
          body = `<div class="hq-talk-body">${hello}${say.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
            ${tip ? `<aside class="hq-talk-tip"><b>${esc(t('hq.w.tip', 'Did you know?'))}</b> ${esc(tip.text)}${tip.url ? ` <a href="${esc(tip.url)}" target="_blank" rel="noopener">${esc(t('hq.w.source', 'Source'))}</a>` : ''}</aside>` : ''}
            <div class="hq-talk-acts">${say.acts.map((a) => `<button type="button" class="btn ${a.primary ? 'primary' : ''}" data-talk-act="${esc(a.act)}" ${busy ? 'disabled' : ''}>${esc(a.label)}</button>`).join('')}
              <button type="button" class="btn ghost small" data-talk-act="tip">${esc(t('hq.w.another', 'Another fact'))}</button></div>`;
        }
        talkEl.innerHTML = `<header class="hq-talk-head">${head}<button type="button" class="hq-close" data-talk-act="close" aria-label="${esc(t('hq.close', 'Close'))}">×</button></header>${body}`;
        talkEl.hidden = false;
        root.classList.add('has-talk');
        if (!keep) {
          const f = talkEl.querySelector('.hq-talk-acts .btn:not([disabled])');
          if (f) f.focus({ preventScroll: true });
        }
      }
      function openTalk(id) {
        if (!alive) return;
        talkWith = { id, tipStep: 0, hello: !met.has(id) };
        renderTalk(false);
        met.add(id);
      }
      // quiet: the 3D side already let them go.
      function closeTalk(quiet) {
        if (!talkWith) return;
        talkWith = null;
        talkEl.hidden = true;
        talkEl.innerHTML = '';
        root.classList.remove('has-talk');
        if (!quiet && hq3d && hq3d.endTalk) hq3d.endTalk();
        // Give the keys back to walking.
        if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
      }
      // Buildings are walked to (the astronaut goes in); without 3D, straight there.
      const visit = (id) => {
        if (hq3d && hq3d.enter) hq3d.enter(id);
        else pick(id);
      };
      talkEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-talk-act]');
        if (!b || b.disabled) return;
        const act = b.dataset.talkAct;
        const [kind, arg] = act.split(':');
        if (act === 'close') return closeTalk();
        if (act === 'tip') {
          talkWith.tipStep = 1;
          renderTalk(false);
          talkWith.tipStep = 0;
          const nb = talkEl.querySelector('[data-talk-act="tip"]');
          if (nb) nb.focus({ preventScroll: true });
          return;
        }
        closeTalk();
        if (kind === 'go') visit(arg);
        else if (kind === 'open') openDrawer(arg);
        else if (kind === 'results') go('results', { projectId: Number(arg) });
        else if (kind === 'tests') go('testlab', { projectId: Number(arg), back: 'hq' });
        else if (act === 'due') handleDue();
        else if (act === 'skip') advance(A().monthsToNextEvent(ag));
        else if (act === 'end') go('end');
        else if (act === 'hire' && A().hireTeam(ag)) {
          SMD.game.save();
          toast(t('hq.hired', 'A new engineering team joined the agency.'), 'ok');
          paint();
        }
      });

      function openDrawer(id, keep) {
        const p = findProject(ag, Number(id));
        if (!p) return closeDrawer();
        drawerId = p.id;
        const sc = drawer.querySelector('.hq-drawer-body');
        const top = keep && sc ? sc.scrollTop : 0;
        drawer.innerHTML = drawerHTML(ag, p);
        drawer.hidden = false;
        root.classList.add('has-drawer');
        const b = drawer.querySelector('.hq-drawer-body');
        if (b) b.scrollTop = top;
        if (!keep) {
          const c = drawer.querySelector('[data-act="close"]');
          if (c) c.focus({ preventScroll: true });
        }
      }
      function closeDrawer() {
        const id = drawerId;
        drawerId = null;
        drawer.hidden = true;
        drawer.innerHTML = '';
        root.classList.remove('has-drawer');
        const back = id != null && uiEl.querySelector(`[data-act="open"][data-id="${id}"]`);
        if (back) back.focus({ preventScroll: true });
      }

      // ---------- Time ----------
      const toItem = (e) => ({ type: e.type, projectId: e.project ? e.project.id : null, review: e.review, eventId: e.eventId, missionKey: e.missionKey, amount: e.amount, phase: e.phase });

      async function showEvent(p, eventId) {
        if (SMD.cards && typeof SMD.cards.event === 'function') {
          try {
            await SMD.cards.event(p.id, eventId);
          } catch (err) {
            console.warn('event card failed', err);
          }
        }
        // Fallback (and safety net): resolve with the first choice.
        const slot = p.events.find((s) => s.id === eventId);
        if (slot && !slot.resolved) {
          const r = A().resolveEvent(ag, p, eventId, null);
          if (r) toast(t('hq.autoEvent', '{name}: {title}. {choice}.', { name: p.design.name, title: r.event.title, choice: r.choice.label }), 'warn');
        }
        SMD.game.save();
      }

      const go = (screen, prm) => {
        SMD.game.save();
        if (SMD.ui.screens[screen]) {
          SMD.go(screen, prm);
          return true;
        }
        return false;
      };

      // Work through events the player has not seen yet. Returns 'left' when
      // it navigated to another screen.
      async function processPending() {
        const Q = SMD.game.pending;
        while (Q.length) {
          if (!alive) return 'left';
          const e = Q.shift();
          const p = e.projectId != null ? findProject(ag, e.projectId) : null;
          switch (e.type) {
            case 'review':
              if (!p || p.reviews[e.review]) break;
              if (go('review', { projectId: p.id, review: e.review })) return 'left';
              break;
            case 'event': {
              const slot = p && p.events.find((s) => s.id === e.eventId);
              if (!slot || slot.resolved) break;
              await showEvent(p, e.eventId);
              paint();
              break;
            }
            case 'launch':
              if (!p) break;
              if (SMD.audio && SMD.audio.chime) SMD.audio.chime(true);
              // Launch day (walk out to the pad) when that screen exists, else the launch film.
              if (ui.screens.launchday ? go('launchday', { projectId: p.id, next: 'film' }) : go('film', { projectId: p.id, kind: 'launch' })) return 'left';
              break;
            case 'arrival':
              if (!p) break;
              if (go('film', { projectId: p.id, kind: 'arrival' })) return 'left';
              break;
            case 'complete':
              if (!p) break;
              if (go('results', { projectId: p.id })) return 'left';
              break;
            case 'unlock':
              toast(t('hq.unlock', 'New mission available: {m}', { m: missionTitle(e.missionKey) }), 'ok');
              break;
            case 'income':
              toast(t('hq.income', 'New budget year: +{m} from the government', { m: money(e.amount) }), 'ok');
              break;
            case 'ready':
              if (p) toast(t('hq.ready', '{name} is built. Flight Readiness Review next.', { name: p.design.name }));
              break;
            case 'phase':
              if (p && PHASE[e.phase]) toast(t('hq.phaseTo', '{name} enters Phase {ph}: {nm}', { name: p.design.name, ph: e.phase, nm: PHASE[e.phase]() }));
              break;
            case 'broke':
              break;
            default:
              break;
          }
        }
        if (A().isOver(ag) && endShown !== ag.seed) {
          endShown = ag.seed;
          if (go('end')) return 'left';
        }
        return null;
      }

      async function advance(maxMonths) {
        if (busy || !alive) return;
        busy = true;
        paint();
        let left = null;
        try {
          for (let i = 0; i < maxMonths && alive; i++) {
            if (owed(ag)) break;
            const evs = A().advance(ag);
            SMD.game.save();
            const items = evs.map(toItem);
            const broke = ag.money < 0;
            const newlyBroke = broke && !wasBroke;
            wasBroke = broke;
            SMD.game.pending.push(...items);
            paint();
            const stop = newlyBroke || items.some((it) => STOP.has(it.type));
            left = await processPending();
            if (left || !alive) return;
            if (stop || owed(ag)) break;
            if (i < maxMonths - 1) await sleep(reduced() ? 0 : 160);
          }
        } finally {
          if (!left && alive) {
            busy = false;
            paint();
          }
        }
      }

      async function handleDue() {
        const due = owed(ag);
        if (!due) return paint();
        if (due.kind === 'review') {
          go('review', { projectId: due.p.id, review: due.review });
          return;
        }
        busy = true;
        paint();
        await showEvent(due.p, due.eventId);
        busy = false;
        paint();
      }

      function pick(id) {
        if (busy) return;
        if (id === 'board' || id === 'map' || id === 'research' || id === 'archive') return go(id);
        if (id === 'design') {
          const p = ag.projects.find((x) => x.status === 'dev' || x.status === 'ready');
          if (p) return openDrawer(p.id);
          toast(t('hq.noBuild', 'The clean room is empty. Pick a mission on the board to start a spacecraft.'));
          return;
        }
        if (id === 'testlab') {
          const list = testable(ag);
          if (list.length === 1) return go('testlab', { projectId: list[0].id, back: 'hq' });
          if (list.length > 1) {
            talkWith = { chooser: true };
            renderTalk(false);
            return;
          }
          toast(t('hq.w.noTests', 'Nothing to test yet. A spacecraft comes to the test hall in Phase C, after its PDR.'));
          return;
        }
        if (id === 'pad') {
          const p = ag.projects.filter((x) => x.status === 'dev' || x.status === 'ready').sort((a, b) => a.launchMs - b.launchMs)[0];
          if (p) {
            openDrawer(p.id);
            return;
          }
          toast(t('hq.noLaunch', 'No launch planned yet.'));
        }
      }

      // ---------- Coach marks ----------
      let coachStep = -1;
      function coach(step) {
        coachEl.querySelectorAll('button').forEach((b) => b.blur());
        root.querySelectorAll('.hq-coach-target').forEach((el) => el.classList.remove('hq-coach-target'));
        if (step >= COACH.length || step < 0) {
          coachEl.hidden = true;
          coachStep = -1;
          try {
            localStorage.setItem(COACH_KEY, '1');
          } catch (e) {}
          return;
        }
        coachStep = step;
        const c = COACH[step];
        coachEl.innerHTML = `<p class="hq-coach-n small">${esc(t('hq.coach.n', '{i} of {n}', { i: step + 1, n: COACH.length }))}</p>
          <h2 class="hq-coach-t">${esc(c.title())}</h2><p>${esc(c.body(ag))}</p>
          ${
            c.goal
              ? `<ul class="hq-coach-goal">${HEADLINE_KEYS.map((k) => `<li><span class="hq-planet ${k}" aria-hidden="true"></span><span><b>${esc(destName(k === 'jupiter' ? 'europa' : k))}</b> ${esc({ mars: t('hq.coach.g.mars', 'buried ice'), venus: t('hq.coach.g.venus', 'live volcanoes'), jupiter: t('hq.coach.g.europa', 'how thick the ice is') }[k])}</span></li>`).join('')}</ul>
                 <p class="small muted">${t('hq.coach1.s', 'Earth missions first: they earn the reputation that opens the planets.')}</p>`
              : ''
          }
          <div class="hq-coach-btns"><button type="button" class="btn ghost small" data-coach="skip">${t('hq.coach.skip', 'Skip tour')}</button>
          <button type="button" class="btn primary small" data-coach="next">${step === COACH.length - 1 ? t('hq.coach.done', 'Got it') : t('hq.coach.next', 'Next')}</button></div>`;
        coachEl.hidden = false;
        coachEl.className = 'hq-coach';
        coachEl.style.cssText = '';
        const target = c.sel && root.querySelector(c.sel);
        const wide = window.innerWidth >= 760;
        if (target) {
          target.classList.add('hq-coach-target');
          if (!wide) target.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
          if (wide) {
            const r = target.getBoundingClientRect();
            const cw = Math.min(340, window.innerWidth - 32);
            const left = Math.max(16, Math.min(window.innerWidth - cw - 16, r.left + r.width / 2 - cw / 2));
            const above = r.top > 260;
            coachEl.classList.add(above ? 'is-above' : 'is-below');
            coachEl.style.insetInlineStart = 'auto';
            coachEl.style.left = `${left}px`;
            coachEl.style.width = `${cw}px`;
            if (above) coachEl.style.bottom = `${window.innerHeight - r.top + 14}px`;
            else coachEl.style.top = `${r.bottom + 14}px`;
            coachEl.style.setProperty('--arrow', `${Math.max(18, Math.min(cw - 18, r.left + r.width / 2 - left))}px`);
          }
        } else coachEl.classList.add('is-center');
        const nb = coachEl.querySelector('[data-coach="next"]');
        if (nb) nb.focus({ preventScroll: true });
      }
      coachEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-coach]');
        if (!b) return;
        if (b.dataset.coach === 'skip') coach(COACH.length);
        else coach(coachStep + 1);
      });

      // ---------- Events ----------
      const menuClose = () => {
        const pop = uiEl.querySelector('.hq-menu-pop');
        const btn = uiEl.querySelector('[data-act="menu"]');
        if (pop) pop.hidden = true;
        if (btn) btn.setAttribute('aria-expanded', 'false');
      };
      uiEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        const act = b.dataset.act;
        if (act !== 'menu') menuClose();
        switch (act) {
          case 'month':
            advance(1);
            break;
          case 'skip':
            advance(A().monthsToNextEvent(ag));
            break;
          case 'due':
            handleDue();
            break;
          case 'board':
          case 'map':
          case 'research':
          case 'archive':
            if (!busy) go(act);
            break;
          case 'end':
            go('end');
            break;
          case 'hire':
            if (A().hireTeam(ag)) {
              SMD.game.save();
              toast(t('hq.hired', 'A new engineering team joined the agency.'), 'ok');
              paint();
            }
            break;
          case 'open':
            openDrawer(b.dataset.id);
            break;
          case 'results':
            go('results', { projectId: Number(b.dataset.id) });
            break;
          case 'lang':
            SMD.setLang(SMD.lang() === 'ar' ? 'en' : 'ar');
            break;
          case 'avatar':
            if (!busy) go('avatar', { next: 'hq', back: 'hq' });
            break;
          case 'menu': {
            const pop = uiEl.querySelector('.hq-menu-pop');
            const open = pop.hidden;
            pop.hidden = !open;
            b.setAttribute('aria-expanded', String(open));
            if (open) pop.querySelector('button').focus();
            break;
          }
          case 'tour':
            coach(0);
            break;
          case 'controls':
            menuClose();
            if (SMD.controls && SMD.controls.help) SMD.controls.help.open();
            break;
          case 'settings':
            menuClose();
            if (ui.openSettings) ui.openSettings();
            break;
          case 'mute':
            if (SMD.audio && SMD.audio.setMuted) SMD.audio.setMuted(!SMD.audio.isMuted());
            paint();
            break;
          case 'quit':
            SMD.game.save();
            SMD.go('start');
            break;
          default:
            break;
        }
      });
      drawer.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'close') closeDrawer();
        if (b.dataset.act === 'results') go('results', { projectId: Number(b.dataset.id) });
        if (b.dataset.act === 'tests' && !busy) go('testlab', { projectId: Number(b.dataset.id), back: 'hq' });
      });
      const onKey = (e) => {
        if (e.key !== 'Escape') return;
        back();
      };
      function back() {
        if (!coachEl.hidden) coach(COACH.length);
        else if (talkWith) closeTalk();
        else if (drawerId != null) closeDrawer();
        else if (document.querySelector('.hq-menu-pop:not([hidden])')) menuClose();
        else if (hq3d && !hq3d.follow) {
          // Esc leaves the campus map and walks again.
          hq3d.setFollow(true);
          paintView();
        }
      }
      const onDocClick = (e) => {
        if (!e.target.closest('.hq-menu')) menuClose();
      };
      document.addEventListener('keydown', onKey);
      document.addEventListener('click', onDocClick);
      cleanups.push(() => document.removeEventListener('keydown', onKey), () => document.removeEventListener('click', onDocClick));
      cleanups.push(
        SMD.bus.on('lang', () => {
          paint();
          if (!coachEl.hidden) coach(coachStep);
        })
      );
      if (SMD.bus)
        cleanups.push(
          SMD.bus.on('avatar', (a) => {
            if (hq3d && hq3d.setAvatar) hq3d.setAvatar(a);
            loadMePortrait(() => alive && paint());
            paint();
          })
        );
      loadMePortrait(() => {
        if (!alive) return;
        const face = uiEl.querySelector('[data-me-face]');
        if (face && meURL) face.innerHTML = `<img src="${esc(meURL)}" alt="" width="36" height="36" />`;
      });
      const ro = new ResizeObserver(() => updateInsets());
      ro.observe(root);
      cleanups.push(() => ro.disconnect());

      // ---------- 3D campus ----------
      const E = SMD.three && SMD.three.engine;
      const mount3d = (createHQ) => {
        if (!alive || !E) return;
        try {
          hq3d = createHQ({
            el: stage,
            labelLayer: root.querySelector('[data-pins]'),
            labels: labels(),
            onPick: pick,
            // Keys walk only when no card or drawer is asking for attention.
            canWalk: () => coachEl.hidden && drawerId == null,
            onFollow: (walking) => {
              if (!walking) closeTalk(true);
              paintView();
            },
            testHall: testlabOn(),
            spawn,
            view: viewPref,
            staff: STAFF(),
            staffLabels: staffLabels(),
            onTalk: (id) => {
              if (busy) {
                hq3d.endTalk();
                return;
              }
              closeDrawer();
              openTalk(id);
            },
            onTalkEnd: () => closeTalk(true),
            onBack: () => back(),
          });
          const d0 = owed(ag);
          hq3d.setStaffState(staffAlerts(ag, d0, nextStep(ag, d0)));
          hq3d.setState(scene3dState());
          E.mount(stage, hq3d);
          ui.screens.hq.current = hq3d; // for tools/shot.mjs scripts
          updateInsets();
          paintView();
          // How the director greets you: the mood you come back with, a wave
          // when something is due, and hello on the first visit.
          const mood = params && params.mood;
          const greet = mood || (params && params.approvedProjectId != null ? 'celebrate' : owed(ag) ? 'wave' : firstVisit ? 'wave' : null);
          firstVisit = false;
          lastDueKey = (() => {
            const d = owed(ag);
            return d ? `${d.kind}:${d.p.id}:${d.review || d.eventId}` : '';
          })();
          if (greet) setTimeout(() => alive && hq3d && hq3d.react(greet), 600);
        } catch (err) {
          // No WebGL: the dashboard still works over a painted sky.
          console.warn('HQ campus unavailable', err);
          hq3d = null;
          root.classList.add('no-3d');
        }
      };
      if (E) {
        import(new URL('js/3d/hq.js', document.baseURI).href)
          .then((m) => mount3d(m.createHQ))
          .catch((err) => {
            console.warn('HQ campus failed to load', err);
            root.classList.add('no-3d');
          });
      } else root.classList.add('no-3d');

      paint();

      // Fresh from the designer: celebrate the new project and point at its card.
      if (params && params.approvedProjectId != null) {
        const np = findProject(ag, Number(params.approvedProjectId));
        if (np) {
          toast(t('hq.approved', '{name} approved. Phase B, preliminary design, begins now.', { name: np.design.name }), 'ok');
          const card = uiEl.querySelector(`[data-act="open"][data-id="${np.id}"]`);
          if (card) {
            card.closest('.hq-proj').classList.add('is-new');
            card.scrollIntoView({ block: 'nearest' });
          }
        }
      }

      // Resume the queue (after a review, film or results screen), then the tour.
      (async () => {
        if (SMD.game.pending.length) {
          busy = true;
          paint();
          const left = await processPending();
          if (left || !alive) return;
          busy = false;
          paint();
        } else if (A().isOver(ag) && endShown !== ag.seed) {
          endShown = ag.seed;
          go('end');
          return;
        }
        let seen = false;
        try {
          seen = localStorage.getItem(COACH_KEY) === '1';
        } catch (e) {}
        if (!seen && alive) setTimeout(() => alive && coach(0), 900);
      })();

      return () => {
        alive = false;
        if (hq3d) viewPref = hq3d.view || 'walk';
        // Which building did we go into? (go() renders the next screen right after this.)
        Promise.resolve().then(() => {
          leftTo = SMD.ui.state.screen;
        });
        cleanups.forEach((f) => f());
        if (E) E.stop();
        ui.screens.hq.current = null;
      };
    },
  };
})();
