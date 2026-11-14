// Solar system map: where the planets really are on the agency's calendar,
// where your spacecraft are, and when the launch windows open.
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const { esc, fmt } = ui;
  const t = (k, e, p) => SMD.t(k, e, p);
  const DAY_MS = 864e5;
  const WINDOW_KEYS = ['mars', 'venus', 'jupiter'];
  const SPEEDS = { slow: 30, fast: 120, faster: 365 }; // days per second

  const planetName = (k) =>
    ({
      sun: t('map.sun', 'Sun'),
      venus: t('map.venus', 'Venus'),
      earth: t('map.earth', 'Earth'),
      moon: t('map.moon', 'Moon'),
      mars: t('map.mars', 'Mars'),
      jupiter: t('map.jupiter', 'Jupiter'),
    })[k] || k;

  const missionTitle = (k) => t('map.mission.' + k, SMD.data.MISSIONS[k].title);

  // Best launch inside a window, as a launch object probePosition understands.
  function windowLaunch(key, w, route) {
    const M = SMD.model;
    const g = M.baseGrid(key);
    const i = g.deps.indexOf(w.bestMs);
    if (i < 0) return null;
    let best = null;
    for (let j = 0; j < g.rows; j++) {
      const L = M.cellLaunch(key, route, i, j);
      if (L && (!best || L.c3 < best.c3)) best = L;
    }
    return best;
  }

  function lightDelay(au) {
    const min = SMD.physics.lightMinutes(au);
    if (min < 1) return t('map.delay.sec', '{n} light-seconds', { n: fmt(min * 60, 1) });
    return t('map.delay.min', '{n} light-minutes', { n: fmt(min, min < 10 ? 1 : 0) });
  }

  function auText(au) {
    const km = au * SMD.physics.AU;
    return t('map.au', '{au} AU ({km} million km)', { au: fmt(au, 2), km: fmt(km / 1e6, 0) });
  }

  ui.screens.map = {
    render(app) {
      const ag = SMD.game.agency;
      if (!ag) {
        SMD.go('start');
        return;
      }
      const A = SMD.agency;
      const t0 = ag.now;
      const t1 = A.addMonths(ag.now, 120);
      const spanDays = Math.round((t1 - t0) / DAY_MS);
      let now = t0;
      let playing = false;
      let speed = 'fast';
      let selected = null;
      let map = null;
      let gone = false;
      let raf = 0;
      let trueScale = false;

      const windows = {};
      WINDOW_KEYS.forEach((k) => (windows[k] = A.nextWindows(ag, k).filter((w) => w.startMs <= t1)));
      const routeOf = (k) => (k === 'jupiter' ? 'ega' : 'direct');
      const projects = ag.projects.filter((p) => p.status !== 'done' && p.launch);
      const careerEnd = SMD.data.CAREER.end;
      const pct = (ms) => Math.max(0, Math.min(100, ((ms - t0) / (t1 - t0)) * 100));

      const years = [];
      for (let y = new Date(t0).getUTCFullYear() + 1; Date.UTC(y, 0, 1) <= t1; y++) years.push(y);

      const winLabel = (k, w) => t('map.window', '{planet} window: {from} – {to}', { planet: planetName(k), from: ui.monthYear(w.startMs), to: ui.monthYear(w.endMs) });

      const rows = WINDOW_KEYS.map(
        (k) => `<div class="map-tl-row" style="--c:${esc(cssColor(k))}">
          <span class="map-tl-name">${esc(planetName(k))}</span>
          <div class="map-tl-lane">${windows[k]
            .map(
              (w, i) =>
                `<button type="button" class="map-tl-win" data-win="${k}:${i}" style="left:${pct(w.startMs).toFixed(2)}%;width:${Math.max(0.9, pct(w.endMs + 15 * DAY_MS) - pct(w.startMs)).toFixed(2)}%" aria-label="${esc(winLabel(k, w))}" title="${esc(winLabel(k, w))}"><i style="left:${(((w.bestMs - w.startMs) / Math.max(1, w.endMs + 15 * DAY_MS - w.startMs)) * 100).toFixed(1)}%"></i></button>`
            )
            .join('')}</div>
        </div>`
      ).join('');
      const projRow = projects.length
        ? `<div class="map-tl-row map-tl-row--craft">
            <span class="map-tl-name"><span class="map-wide">${esc(t('map.tl.yours', 'Your spacecraft'))}</span><span class="map-narrow">${esc(t('map.tl.yoursShort', 'Yours'))}</span></span>
            <div class="map-tl-lane">${projects
              .map((p) => {
                const L = p.launch;
                const label = t('map.tl.flight', '{name}: launch {launch}, arrival {arrive}', { name: p.design.name, launch: ui.monthYear(L.departMs), arrive: ui.monthYear(L.arriveMs) });
                return `<button type="button" class="map-tl-flight" data-craft="${p.id}" style="left:${pct(L.departMs).toFixed(2)}%;width:${Math.max(0.6, pct(L.arriveMs) - pct(L.departMs)).toFixed(2)}%" aria-label="${esc(label)}" title="${esc(label)}"><i></i></button>`;
              })
              .join('')}</div>
          </div>`
        : '';

      const nextList = WINDOW_KEYS.map((k) => {
        const w = windows[k][0];
        return `<li style="--c:${esc(cssColor(k))}"><i aria-hidden="true"></i>${
          w ? `<button type="button" class="map-link" data-win="${k}:0">${esc(winLabel(k, w))}</button>` : esc(t('map.window.none', '{planet}: no window before {year}', { planet: planetName(k), year: new Date(t1).getUTCFullYear() }))
        }</li>`;
      }).join('');

      app.innerHTML = `<main class="screen night map-screen">
        <header class="map-top">
          <button type="button" class="btn ghost small map-back" data-act="hq"><span aria-hidden="true" class="map-arrow">←</span> ${esc(t('map.back', 'Back to HQ'))}</button>
          <div class="map-heading">
            <h1>${esc(t('map.title', 'Solar system'))}</h1>
            <p class="muted small">${esc(t('map.subtitle', 'Real planet positions from JPL orbital elements. Today is {date}.', { date: ui.monthYear(t0) }))}</p>
          </div>
          <div class="map-clock" aria-live="polite">
            <span class="muted small">${esc(t('map.showing', 'Showing'))}</span>
            <b data-date dir="auto">${esc(ui.date(now))}</b>
            <button type="button" class="btn small ghost" data-act="today" hidden>${esc(t('map.today', 'Back to today'))}</button>
          </div>
        </header>
        <section class="map-stage">
          <div class="map-canvas" data-3d></div>
          <div class="map-labels" data-labels></div>
          <div class="map-loading" data-loading>${esc(t('map.loading', 'Plotting the planets…'))}</div>
          <div class="map-pill" data-pill hidden></div>
          <ul class="map-legend" aria-label="${esc(t('map.legend', 'Legend'))}">
            <li><i class="lg-craft"></i>${esc(t('map.legend.craft', 'Your spacecraft'))}</li>
            <li><i class="lg-planned"></i>${esc(t('map.legend.planned', 'Planned path'))}</li>
            <li><i class="lg-flown"></i>${esc(t('map.legend.flown', 'Path flown'))}</li>
            <li><i class="lg-window"></i>${esc(t('map.legend.window', 'Best transfer in an open window'))}</li>
          </ul>
          <aside class="map-info" data-info hidden tabindex="-1" aria-live="polite"></aside>
          <div class="map-tools">
            <button type="button" class="btn small" data-view="inner">${esc(t('map.view.inner', 'Inner planets'))}</button>
            <button type="button" class="btn small" data-view="all">${esc(t('map.view.all', 'Out to Jupiter'))}</button>
            ${ui.seg('scale', [
              { value: 'c', label: t('map.scale.compressed', 'Compressed') },
              { value: 't', label: t('map.scale.true', 'True distances') },
            ], 'c')}
          </div>
          <p class="map-hint small">${esc(t('map.hint', 'Drag to turn. Scroll or pinch to zoom. Tap a planet.'))}</p>
        </section>
        <section class="map-timeline" aria-label="${esc(t('map.tl', 'Time and launch windows'))}">
          <div class="map-tl-controls">
            <button type="button" class="btn primary small map-play" data-act="play" aria-pressed="false">
              <span data-play-icon aria-hidden="true">▶</span> <span data-play-text>${esc(t('map.play', 'Play'))}</span>
            </button>
            ${ui.seg('speed', [
              { value: 'slow', label: t('map.speed.slow', '1 month/s') },
              { value: 'fast', label: t('map.speed.fast', '4 months/s') },
              { value: 'faster', label: t('map.speed.faster', '1 year/s') },
            ], speed)}
            <p class="small muted map-tl-note">${esc(t('map.tl.note', 'Planets line up for a cheap trip only during launch windows. Miss one and you wait: Mars every 26 months.'))}</p>
          </div>
          <div class="map-tl" dir="ltr">
            <div class="map-tl-years">${years.map((y) => `<span style="left:${pct(Date.UTC(y, 0, 1)).toFixed(2)}%">${y}</span>`).join('')}</div>
            <div class="map-tl-body" data-track>
              ${years.map((y) => `<i class="map-tl-tick" style="left:${pct(Date.UTC(y, 0, 1)).toFixed(2)}%"></i>`).join('')}
              ${rows}
              ${projRow}
              ${careerEnd < t1 ? `<div class="map-tl-after" style="left:${pct(careerEnd).toFixed(2)}%"><span>${esc(t('map.tl.after', 'After your career'))}</span></div>` : ''}
              <div class="map-tl-head" data-head><b></b></div>
            </div>
            <input type="range" class="map-range" min="0" max="${spanDays}" step="1" value="0" data-range aria-label="${esc(t('map.range', 'Date shown on the map'))}" />
          </div>
          <div class="map-next">
            <h2 class="map-next-title">${esc(t('map.next', 'Next launch windows'))}</h2>
            <ul>${nextList}</ul>
          </div>
        </section>
      </main>`;

      const $ = (s) => app.querySelector(s);
      const dateEl = $('[data-date]');
      const todayBtn = $('[data-act="today"]');
      const range = $('[data-range]');
      const head = $('[data-head]');
      const info = $('[data-info]');
      const pill = $('[data-pill]');
      const playBtn = $('[data-act="play"]');

      // ---------- Arc for the open window ----------
      let arcKey = null;
      function openWindowAt(ms) {
        // The selected planet's window wins when two are open at once.
        const order = selected && selected.type === 'planet' && WINDOW_KEYS.includes(selected.key) ? [selected.key].concat(WINDOW_KEYS.filter((k) => k !== selected.key)) : WINDOW_KEYS;
        for (const k of order) {
          const i = windows[k].findIndex((w) => ms >= w.startMs && ms <= w.endMs + 15 * DAY_MS);
          if (i >= 0) return { key: k, i, w: windows[k][i] };
        }
        return null;
      }
      function updateArc() {
        const open = openWindowAt(now);
        const id = open ? open.key + open.i : null;
        pill.hidden = !open;
        if (open) pill.innerHTML = `<i style="--c:${esc(cssColor(open.key))}"></i>${esc(t('map.pill', '{planet} launch window is open', { planet: planetName(open.key) }))}`;
        if (id === arcKey || !map) return;
        arcKey = id;
        if (!open) return map.setArc(null);
        const L = windowLaunch(open.key, open.w, routeOf(open.key));
        if (!L) return map.setArc(null);
        map.setArc({ key: open.key, launch: L, label: t('map.arrival', '{planet} on arrival, {date}', { planet: planetName(open.key), date: ui.monthYear(L.arriveMs) }) });
      }

      // ---------- Time ----------
      function setTime(ms, fromRange) {
        now = Math.max(t0, Math.min(t1, ms));
        const days = Math.round((now - t0) / DAY_MS);
        if (!fromRange) range.value = String(days);
        range.setAttribute('aria-valuetext', ui.date(now));
        dateEl.textContent = ui.date(now);
        todayBtn.hidden = days === 0;
        head.style.left = pct(now).toFixed(3) + '%';
        if (map) map.setTime(now);
        updateArc();
        if (selected) renderInfo();
      }

      function setPlaying(on) {
        playing = on;
        playBtn.setAttribute('aria-pressed', String(on));
        $('[data-play-icon]').textContent = on ? '❚❚' : '▶';
        $('[data-play-text]').textContent = on ? t('map.pause', 'Pause') : t('map.play', 'Play');
        cancelAnimationFrame(raf);
        if (!on) return;
        if (now >= t1) setTime(t0);
        let last = performance.now();
        const tick = (ts) => {
          const dt = Math.min(0.1, (ts - last) / 1000);
          last = ts;
          const next = now + dt * SPEEDS[speed] * DAY_MS;
          setTime(next);
          if (next >= t1) return setPlaying(false);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }

      // ---------- Info panel ----------
      function contractLine(k) {
        const st = A.contractState(ag, k);
        const c = SMD.data.CONTRACTS[k];
        const title = esc(missionTitle(k));
        const busy = ag.projects.find((p) => p.missionKey === k && p.status !== 'done');
        let state;
        let act = '';
        if (st === 'open') {
          state = `<span class="tone ok">${esc(t('map.m.open', 'Open on the mission board'))}</span>`;
          act = `<button type="button" class="btn small primary" data-go="board">${esc(t('map.m.board', 'Mission board'))}</button>`;
        } else if (st === 'busy') state = `<span class="tone ok">${esc(t('map.m.busy', '{name} is on it', { name: busy ? busy.design.name : '' }))}</span>`;
        else if (st === 'done') state = `<span class="tone ok">${esc(t('map.m.done', 'Done: {score} science points', { score: Math.round(ag.completed[k] || 0) }))}</span>`;
        else if (st === 'locked') state = `<span class="tone warn">${esc(t('map.m.locked', 'Needs reputation {need} (you have {have})', { need: c.unlockRep, have: ag.rep }))}</span>`;
        else {
          const names = (c.needsTech || []).filter((id) => !ag.tech.includes(id)).map((id) => t('research.tech.' + id + '.name', SMD.data.TECH.find((x) => x.id === id).name));
          state = `<span class="tone warn">${esc(t('map.m.tech', 'Needs research: {list}', { list: names.join(', ') }))}</span>`;
          act = `<button type="button" class="btn small" data-go="research">${esc(t('map.m.lab', 'Research lab'))}</button>`;
        }
        return `<li><b>${title}</b>${state}${act}</li>`;
      }

      function row(label, value, note) {
        return `<div><dt>${esc(label)}</dt><dd>${value}${note ? `<small>${esc(note)}</small>` : ''}</dd></div>`;
      }

      function planetInfo(key) {
        const P = SMD.physics;
        const out = [];
        const sunAU = P.PLANETS[key].a;
        if (key === 'earth') out.push(row(t('map.i.home', 'Home'), esc(t('map.i.homeText', 'Your mission control and the Deep Space Network dishes'))));
        else if (key === 'moon') {
          out.push(row(t('map.i.dist', 'Distance from Earth'), esc(t('map.i.moonDist', '384,400 km')), t('map.i.notScale', 'Drawn far out so you can see it')));
          out.push(row(t('map.i.delay', 'Radio delay'), esc(t('map.i.delayEach', '{d} each way', { d: lightDelay(384400 / P.AU) }))));
        } else {
          const au = P.earthDistanceAU(key, now);
          out.push(row(t('map.i.dist', 'Distance from Earth'), esc(auText(au))));
          out.push(row(t('map.i.delay', 'Radio delay'), esc(t('map.i.delayEach', '{d} each way', { d: lightDelay(au) })), t('map.i.delayNote', 'A command and its answer take {n} minutes', { n: fmt(P.lightMinutes(au) * 2, 0) })));
        }
        const sun = Math.round(100 / (sunAU * sunAU));
        out.push(row(t('map.i.sun', 'Sunlight'), `<span class="map-sunbar" style="--p:${Math.min(100, sun)}%"><i></i></span>${esc(t('map.i.sunPct', '{p}% of Earth’s', { p: sun > 10 ? sun : fmt(100 / (sunAU * sunAU), 1) }))}`, key === 'earth' || key === 'moon' ? null : t('map.i.sunNote', 'Solar panels here make {p}% of the power they make at Earth', { p: sun > 10 ? sun : fmt(100 / (sunAU * sunAU), 1) })));
        if (key !== 'moon') out.push(row(t('map.i.fromSun', 'From the Sun'), esc(t('map.i.auOnly', '{au} AU', { au: fmt(sunAU, 2) })), t('map.i.year', 'One orbit takes {d} days', { d: fmt(P.PLANETS[key].T, 0) })));
        const contracts = Object.keys(SMD.data.CONTRACTS).filter((k) => SMD.data.MISSIONS[k].dest === key);
        let win = '';
        if (WINDOW_KEYS.includes(key)) {
          const w = windows[key].find((x) => x.endMs + 15 * DAY_MS >= now);
          win = w
            ? `<p class="map-i-win"><span>${esc(winLabel(key, w))}</span><button type="button" class="btn small" data-win="${key}:${windows[key].indexOf(w)}">${esc(t('map.i.showWin', 'Show it'))}</button></p>`
            : `<p class="map-i-win muted small">${esc(t('map.i.noWin', 'No more windows before {year}', { year: new Date(t1).getUTCFullYear() }))}</p>`;
        }
        return `<header style="--c:${esc(cssColor(key))}"><i aria-hidden="true"></i><h2>${esc(planetName(key))}</h2><button type="button" class="map-close" data-act="close" aria-label="${esc(t('map.close', 'Close'))}">×</button></header>
          <dl class="map-facts">${out.join('')}</dl>
          ${win}
          <h3>${esc(t('map.i.missions', 'Missions here'))}</h3>
          ${contracts.length ? `<ul class="map-missions">${contracts.map(contractLine).join('')}</ul>` : `<p class="muted small">${esc(t('map.i.noMissions', 'No mission is planned here yet.'))}</p>`}`;
      }

      function sunInfo() {
        return `<header style="--c:#f6d27a"><i aria-hidden="true"></i><h2>${esc(planetName('sun'))}</h2><button type="button" class="map-close" data-act="close" aria-label="${esc(t('map.close', 'Close'))}">×</button></header>
          <p class="small">${esc(t('map.i.sunText', 'At 1 AU, every square metre facing the Sun gets about 1,361 watts. That drops with the square of the distance: half as far out means a quarter of the power for your solar panels.'))}</p>`;
      }

      function craftInfo(id) {
        const p = ag.projects.find((x) => x.id === id);
        if (!p) return '';
        const L = p.launch;
        const m = SMD.data.MISSIONS[p.missionKey];
        const dest = m.dest;
        const P = SMD.physics;
        let status;
        if (now < L.departMs) status = t('map.c.planned', 'Launch planned for {date}', { date: ui.monthYear(L.departMs) });
        else if (now < L.arriveMs && m.kind !== 'earth') status = t('map.c.cruise', 'Cruising to {planet}: {pct}% of the way, arrives {date}', { planet: planetName(dest), pct: Math.round(((now - L.departMs) / (L.arriveMs - L.departMs)) * 100), date: ui.monthYear(L.arriveMs) });
        else status = m.kind === 'earth' ? t('map.c.earthOrbit', 'In orbit around Earth') : t('map.c.arrived', 'In orbit at {planet}', { planet: planetName(dest) });
        const out = [];
        const pos = map ? map.craftPosition(id, now) : null;
        if (pos) {
          const e = P.planetState('earth', now).r;
          const au = m.kind === 'planet' ? Math.hypot(pos[0] - e[0], pos[1] - e[1]) / P.AU : m.kind === 'moon' ? 384400 / P.AU : 0;
          if (au > 0) {
            out.push(row(t('map.i.dist', 'Distance from Earth'), esc(au < 0.01 ? t('map.km', '{km} km', { km: fmt(au * P.AU, 0) }) : auText(au))));
            out.push(row(t('map.i.delay', 'Radio delay'), esc(t('map.i.delayEach', '{d} each way', { d: lightDelay(au) }))));
          }
          const sunAU = Math.hypot(pos[0], pos[1]) / P.AU;
          const sun = 100 / (sunAU * sunAU);
          out.push(row(t('map.i.sun', 'Sunlight'), `<span class="map-sunbar" style="--p:${Math.min(100, sun).toFixed(0)}%"><i></i></span>${esc(t('map.i.sunPct', '{p}% of Earth’s', { p: sun > 10 ? Math.round(sun) : fmt(sun, 1) }))}`));
        }
        out.push(row(t('map.c.launch', 'Launch'), esc(ui.date(L.departMs))));
        if (m.kind !== 'earth') out.push(row(t('map.c.arrive', 'Arrival'), esc(ui.date(L.arriveMs)), L.route === 'ega' ? t('map.c.ega', 'Swings past Earth first for a gravity assist, like Juno') : null));
        return `<header style="--c:#f6d27a"><i aria-hidden="true" class="is-craft"></i><h2>${esc(p.design.name)}</h2><button type="button" class="map-close" data-act="close" aria-label="${esc(t('map.close', 'Close'))}">×</button></header>
          <p class="map-c-mission">${esc(missionTitle(p.missionKey))}</p>
          <p class="map-c-status">${esc(status)}</p>
          <dl class="map-facts">${out.join('')}</dl>
          ${p.status === 'dev' || p.status === 'ready' ? `<p class="muted small">${esc(t('map.c.slip', 'Still being built. A slip in the schedule can push it to a later window.'))}</p>` : ''}`;
      }

      function renderInfo() {
        if (!selected) {
          info.hidden = true;
          sheetInset();
          return;
        }
        info.hidden = false;
        info.innerHTML = selected.type === 'planet' ? planetInfo(selected.key) : selected.type === 'craft' ? craftInfo(selected.id) : sunInfo();
        sheetInset();
      }

      // On a phone the panel is a bottom sheet: keep the picked body above it.
      const phone = window.matchMedia('(max-width: 640px)');
      function sheetInset() {
        if (map) map.setInset(phone.matches && selected && !info.hidden ? info.offsetHeight * 0.8 : 0);
      }

      function pick(sel, focusPanel) {
        selected = sel;
        if (map) map.select(sel, !!sel);
        renderInfo();
        updateArc();
        if (sel && focusPanel) info.focus({ preventScroll: true });
        SMD.audio.beep(sel ? 990 : 660, 0.06, 'sine', 0.08);
      }

      // ---------- Events ----------
      const onClick = (e) => {
        const b = e.target.closest('button');
        if (!b || !app.contains(b)) return;
        if (b.dataset.act === 'hq') return SMD.go('hq');
        if (b.dataset.act === 'today') {
          setPlaying(false);
          return setTime(t0);
        }
        if (b.dataset.act === 'play') return setPlaying(!playing);
        if (b.dataset.act === 'close') return pick(null);
        if (b.dataset.go) return SMD.go(b.dataset.go);
        if (b.dataset.view && map) {
          selected = null;
          map.select(null, false);
          renderInfo();
          return map.view(b.dataset.view);
        }
        if (b.dataset.win) {
          const [k, i] = b.dataset.win.split(':');
          const w = windows[k][Number(i)];
          setPlaying(false);
          setTime(w.bestMs);
          // Show the whole transfer: select the planet but frame the map, not the planet.
          selected = { type: 'planet', key: k };
          if (map) {
            map.select(selected, false);
            map.view(k === 'jupiter' ? 'all' : 'inner');
          }
          renderInfo();
          arcKey = null;
          updateArc();
          return;
        }
        if (b.dataset.craft) {
          const p = ag.projects.find((x) => x.id === Number(b.dataset.craft));
          setPlaying(false);
          if (p && now < p.launch.departMs) setTime(p.launch.departMs + 20 * DAY_MS);
          return pick({ type: 'craft', id: p.id });
        }
        const seg = b.closest('[data-seg]');
        if (seg) {
          seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          if (seg.dataset.seg === 'speed') speed = b.dataset.value;
          if (seg.dataset.seg === 'scale' && map) {
            trueScale = b.dataset.value === 't';
            map.setTrueScale(trueScale);
            arcKey = null;
            updateArc();
          }
        }
      };
      app.addEventListener('click', onClick);
      range.addEventListener('input', () => setTime(t0 + Number(range.value) * DAY_MS, true));
      range.addEventListener('pointerdown', () => setPlaying(false));

      // Drag on the timeline body to scrub.
      const track = $('[data-track]');
      let scrubbing = false;
      const scrubTo = (e) => {
        const r = track.getBoundingClientRect();
        const k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        setTime(t0 + k * (t1 - t0));
      };
      const onTrackDown = (e) => {
        if (e.target.closest('button')) return;
        scrubbing = true;
        setPlaying(false);
        track.setPointerCapture(e.pointerId);
        scrubTo(e);
      };
      const onTrackMove = (e) => scrubbing && scrubTo(e);
      const onTrackUp = () => (scrubbing = false);
      track.addEventListener('pointerdown', onTrackDown);
      track.addEventListener('pointermove', onTrackMove);
      track.addEventListener('pointerup', onTrackUp);
      track.addEventListener('pointercancel', onTrackUp);

      const onKey = (e) => {
        if (e.key === 'Escape' && selected) pick(null);
      };
      window.addEventListener('keydown', onKey);

      setTime(t0);

      // ---------- 3D ----------
      const E = SMD.three.engine;
      import(new URL('js/3d/solarmap.js', document.baseURI).href)
        .then((mod) => {
          if (gone) return;
          map = mod.createSolarMap({
            nowMs: now,
            labelLayer: $('[data-labels]'),
            names: { sun: planetName('sun'), venus: planetName('venus'), earth: planetName('earth'), moon: planetName('moon'), mars: planetName('mars'), jupiter: planetName('jupiter') },
            onPick: (sel) => pick(sel, false),
          });
          map.setTracks(projects.map((p) => ({ id: p.id, name: p.design.name, missionKey: p.missionKey, status: p.status, launch: p.launch })));
          E.mount($('[data-3d]'), map);
          map.setTime(now);
          arcKey = null;
          updateArc();
          $('[data-loading]').hidden = true;
        })
        .catch((err) => {
          console.warn(err);
          $('[data-loading]').textContent = t('map.error', 'The 3D map could not start on this device. The timeline below still works.');
        });

      return () => {
        gone = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        app.removeEventListener('click', onClick);
        if (map) E.stop();
      };
    },
  };

  function cssColor(k) {
    return { venus: '#f4e08a', earth: '#6fb6ff', moon: '#c9c9c4', mars: '#f07a5a', jupiter: '#d39a68' }[k] || '#e9eef2';
  }
})();
