// Mission board: Announcements of Opportunity. One card per contract, each with
// the real science question, a real NASA image, the reward and the next launch
// window. Picking an open card opens the proposal (cost confidence), then the
// designer.
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const { esc, money } = ui;
  const t = (k, e, p) => SMD.t(k, e, p);

  const ORDER = ['nile', 'weather', 'moon', 'mars', 'venus', 'jupiter', 'crew'];
  const DEST = { nile: 'Earth orbit · over the Nile', weather: 'Earth orbit · over the Sahara', moon: 'The Moon · polar orbit', mars: 'Mars orbit', venus: 'Venus orbit', jupiter: 'Jupiter · Europa flybys', crew: 'Around the Moon · with a crew' };
  const DIFFICULTY = { nile: 1, weather: 1, moon: 2, mars: 3, venus: 4, jupiter: 5, crew: 5 };

  // Planet renders for cards without a discovery image: real NASA maps wrapped
  // on a CSS sphere. lon = longitude to centre (the Nile sits at 31° E).
  const PLANET = {
    nile: { tex: 'assets/textures/earth_bmng_july_4k.jpg', lon: 31, glow: '#7fb6ff' },
    weather: { tex: 'assets/textures/earth_bmng_july_4k.jpg', clouds: 'assets/textures/earth_clouds_2k.jpg', lon: 20, glow: '#7fb6ff' },
    moon: { tex: 'assets/textures/moon_lroc_color_2k.jpg', lon: 0, glow: 'transparent' },
    mars: { tex: 'assets/textures/mars_viking_2k.jpg', lon: -60, glow: '#e9a27a' },
    venus: { tex: 'assets/textures/venus_magellan_radar_nasa3d_1440.jpg', lon: 0, glow: '#f1c27a' },
    jupiter: { tex: 'assets/textures/europa_voyager_galileo_2k.jpg', lon: 0, glow: 'transparent', behind: 'assets/textures/jupiter_cassini_pia07782_3601.jpg' },
    // The far side, the view the crew flies over.
    crew: { tex: 'assets/textures/moon_lroc_color_2k.jpg', lon: 180, glow: 'transparent' },
  };

  function sponsor(key) {
    const c = SMD.data.CONTRACTS[key];
    if (c.sponsor) return t('board.sponsor.' + key, c.sponsor);
    const kind = SMD.data.MISSIONS[key].kind;
    return kind === 'moon' ? t('board.sponsor.lunar', 'Lunar exploration program') : t('board.sponsor.planetary', 'Planetary science division');
  }

  // Background position (in %) that puts longitude `lon` in the middle of a disc
  // showing half of an equirectangular map (background-size 200% 100%).
  // CSS url() in a custom property resolves against the stylesheet, so make it absolute.
  const abs = (path) => new URL(path, document.baseURI).href;
  const lonPos = (lon) => (2 * ((lon + 180) / 360 - 0.25) * 100).toFixed(1);

  function planetArt(key) {
    const p = PLANET[key];
    const pos = lonPos(p.lon);
    const name = SMD.data.MISSIONS[key].dest;
    if (!p) return '';
    return `<div class="board-art board-art-planet" role="img" aria-label="${esc(t('board.art.planet', 'Real NASA map of {body}', { body: t('board.body.' + (key === 'jupiter' ? 'europa' : name), key === 'jupiter' ? 'Europa' : name.charAt(0).toUpperCase() + name.slice(1)) }))}">
      ${p.behind ? `<span class="board-planet board-planet-behind" style="--tex:url('${abs(p.behind)}');--pos:${lonPos(0)}%"></span>` : ''}
      <span class="board-planet" style="--tex:url('${abs(p.tex)}');--pos:${pos}%;--glow:${p.glow}">
        ${p.clouds ? `<span class="board-clouds" style="--tex:url('${abs(p.clouds)}');--pos:${pos}%"></span>` : ''}
      </span>
    </div>`;
  }

  function art(key) {
    const disc = SMD.content && SMD.content.discoveries && SMD.content.discoveries[key];
    const d = disc && disc.find((x) => x.image);
    if (!d) return planetArt(key);
    return `<figure class="board-art board-art-photo">
      <img src="${esc(d.image)}" alt="${esc(d.id ? t('content.discoveries.' + d.id + '.title', d.title || '') : d.title || '')}" loading="lazy" decoding="async" />
      <figcaption>${esc(d.credit || '')}</figcaption>
    </figure>`;
  }

  function stars(n) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += `<i class="${i <= n ? 'on' : ''}"></i>`;
    return `<span class="board-diff" role="img" aria-label="${esc(t('board.diff.aria', 'Difficulty {n} of 5', { n }))}">${s}</span>`;
  }

  function windowLine(ag, key) {
    const m = SMD.data.MISSIONS[key];
    if (m.kind === 'crew') return `<span>${t('board.window.crew', 'Any month · about 9 days around the Moon and home. You fly on it.')}</span>`;
    if (m.kind !== 'planet') return `<span>${t('board.window.any', 'Launches any month: it stays near Earth')}</span>`;
    const w = SMD.agency.nextWindows(ag, key);
    if (!w.length) return `<span>${t('board.window.none', 'No launch window left before 2037')}</span>`;
    const A = SMD.agency;
    const first = w[0];
    const open = first.startMs <= ag.now;
    const range = A.fmtMonth(first.startMs) === A.fmtMonth(first.endMs) ? A.fmtMonth(first.startMs) : `${A.fmtMonth(first.startMs)} – ${A.fmtMonth(first.endMs)}`;
    let gap = '';
    if (w[1]) gap = t('board.window.every', 'then every {n} months', { n: Math.round(A.monthsBetween(first.bestMs, w[1].bestMs)) });
    return `<span>${open ? t('board.window.open', 'Window open now, until {end}', { end: A.fmtMonth(first.endMs) }) : t('board.window.next', 'Next window {range}', { range })}${gap ? ` <span class="muted">· ${gap}</span>` : ''}</span>`;
  }

  function stateBlock(ag, key) {
    const A = SMD.agency;
    const s = A.contractState(ag, key);
    const c = SMD.data.CONTRACTS[key];
    if (s === 'open') return { cls: 'open', html: `<button class="btn primary board-go" data-pick="${key}">${t('board.propose', 'Write a proposal')}</button>` };
    if (s === 'busy') {
      const p = ag.projects.find((x) => x.missionKey === key && x.status !== 'done');
      return { cls: 'busy', html: `<p class="board-state"><span class="tone ok">${t('board.state.busy', 'Your team is on it')}</span> ${p ? esc(p.design.name) : ''}</p>` };
    }
    if (s === 'done') return { cls: 'done', html: `<p class="board-state"><span class="tone ok">${t('board.state.done', 'Mission accomplished')}</span> <span class="muted">${t('board.state.score', '{n} science points', { n: Math.round(ag.completed[key]) })}</span></p>` };
    if (s === 'locked')
      return {
        cls: 'locked',
        html: `<p class="board-state board-need"><span class="board-lock" aria-hidden="true"></span>${t('board.state.rep', 'Needs reputation {need}. You have {have}.', { need: c.unlockRep, have: ag.rep })}</p>`,
      };
    const missing = (c.needsTech || []).filter((id) => !A.has(ag, id)).map((id) => SMD.data.TECH.find((x) => x.id === id));
    return {
      cls: 'locked',
      html: `<p class="board-state board-need"><span class="board-lock" aria-hidden="true"></span>${t('board.state.tech', 'Needs research: {list}', {
        list: missing.map((x) => `${esc(t('tech.' + x.id, x.name))} (${x.cost} ${t('board.pts', 'science points')})`).join(', '),
      })}</p><button class="btn small ghost" data-go="research">${t('board.toResearch', 'Open the research lab')}</button>`,
    };
  }

  // The easiest open mission, flagged for a first-time player.
  function starter(ag) {
    if (ag.projects.length) return null;
    return ORDER.find((k) => SMD.agency.contractState(ag, k) === 'open') || null;
  }

  function card(ag, key, i) {
    const m = SMD.data.MISSIONS[key];
    const c = SMD.data.CONTRACTS[key];
    const st = stateBlock(ag, key);
    const planetName = SMD.physics && SMD.physics.PLANETS[m.dest] ? SMD.physics.PLANETS[m.dest].name : m.dest;
    const first = starter(ag) === key;
    return `<article class="board-card is-${st.cls}${first ? ' is-start' : ''}" style="--i:${i}" aria-labelledby="board-t-${key}">
      ${first ? `<p class="board-start"><b>${t('board.start', 'Start here')}</b><span>${t('board.start.s', 'The easiest first flight: close to home, any month')}</span></p>` : ''}
      ${art(key)}
      <div class="board-body">
        <div class="board-meta">
          <span class="board-dest">${esc(t('board.dest.' + key, DEST[key] || planetName))}</span>
          ${stars(DIFFICULTY[key])}
        </div>
        <h2 class="board-title" id="board-t-${key}">${esc(t('mission.' + key + '.title', m.title))}</h2>
        <p class="board-question">${esc(t('mission.' + key + '.question', m.question))}</p>
        <p class="board-headline"><span>${t('board.headline', 'If you succeed, the news says')}</span> “${esc(t('mission.' + key + '.headline', m.headline))}”</p>
        <dl class="board-facts">
          <div><dt>${t('board.sponsor', 'Sponsor')}</dt><dd>${esc(sponsor(key))}</dd></div>
          <div><dt>${t('board.reward', 'Reward for full science')}</dt><dd class="board-reward">
            <span title="${esc(t('board.reward.money', 'Money'))}">${money(c.reward.money)}</span>
            <span title="${esc(t('board.reward.rep', 'Reputation'))}">+${c.reward.rep} ${t('board.rep', 'rep')}</span>
            <span title="${esc(t('board.reward.sci', 'Science points'))}">+${c.reward.science} ${t('board.sci', 'science')}</span>
          </dd></div>
          <div><dt>${t('board.window', 'Launch')}</dt><dd>${windowLine(ag, key)}</dd></div>
        </dl>
        <div class="board-action">${st.html}</div>
      </div>
    </article>`;
  }

  // ---------- Proposal: choose a cost confidence ----------
  function proposal(app, ag, key, onClose) {
    const A = SMD.agency;
    const m = SMD.data.MISSIONS[key];
    // A real estimate from a starting design, so the reserve is in dollars.
    let build = 0;
    try {
      build = A.plan(ag, A.newDesign(ag, key), 'standard', 'standard').cost.build;
    } catch (e) {}
    const busy = A.busyTeams(ag) >= ag.teams;
    const wrap = document.createElement('div');
    wrap.className = 'board-modal';
    wrap.innerHTML = `<div class="board-dialog" role="dialog" aria-modal="true" aria-labelledby="board-prop-h">
      <p class="board-kicker">${t('board.prop.kicker', 'Proposal · {mission}', { mission: esc(t('mission.' + key + '.title', m.title)) })}</p>
      <h2 id="board-prop-h">${t('board.prop.h', 'How much reserve will you ask for?')}</h2>
      <p class="muted">${t('board.prop.lede', 'NASA budgets every project with money held back for surprises. Too little and every problem becomes an overrun; too much and your proposal looks expensive.')}</p>
      <div class="board-conf" role="radiogroup" aria-label="${esc(t('board.prop.h', 'How much reserve will you ask for?'))}">
        ${Object.values(A.CONFIDENCE)
          .map(
            (c) => `<button type="button" class="board-conf-opt" role="radio" aria-checked="${c.id === 'standard'}" data-conf="${c.id}">
            <span class="board-conf-name">${esc(t('conf.' + c.id, c.name))}</span>
            <span class="board-conf-pct num">${Math.round(c.reserve * 100)}%</span>
            <span class="board-conf-sub">${t('board.prop.reserve', 'reserve')}</span>
            <span class="board-conf-blurb">${esc(t('conf.' + c.id + '.blurb', c.blurb))}</span>
            <span class="board-conf-eg">${
              build
                ? t('board.prop.eg', 'On a {build} build: {res} held back', { build: money(build), res: money(build * c.reserve) })
                : ''
            }</span>
            ${c.repBonus ? `<span class="board-conf-bonus">${t('board.prop.bonus', '+{n} reputation if it works', { n: c.repBonus })}</span>` : c.id === 'standard' ? `<span class="board-conf-bonus is-rule">${ag.projects.length ? t('board.prop.rule', 'NASA Discovery rule') : t('board.prop.ruleFirst', 'NASA Discovery rule · a safe first choice')}</span>` : ''}
          </button>`
          )
          .join('')}
      </div>
      ${busy ? `<p class="board-warn"><span class="tone warn">${t('board.prop.busy', 'All teams are busy')}</span> ${t('board.prop.busy2', 'You can design now, but you will need a free team before you approve.')}</p>` : ''}
      <div class="board-dialog-actions">
        <button class="btn ghost" data-cancel>${t('board.prop.cancel', 'Back to the board')}</button>
        <button class="btn primary" data-start>${t('board.prop.start', 'Start designing')}</button>
      </div>
    </div>`;
    app.appendChild(wrap);
    let conf = 'standard';
    const opts = wrap.querySelectorAll('[data-conf]');
    const pick = (id) => {
      conf = id;
      opts.forEach((o) => o.setAttribute('aria-checked', String(o.dataset.conf === id)));
      SMD.audio.beep(id === 'lean' ? 520 : id === 'standard' ? 660 : 800, 0.07, 'triangle', 0.12);
    };
    opts.forEach((o) =>
      o.addEventListener('click', () => {
        pick(o.dataset.conf);
        o.focus();
      })
    );
    const close = () => {
      document.removeEventListener('keydown', onKey);
      wrap.remove();
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!e.target.closest || !e.target.closest('.board-conf')) return;
        const ids = Object.keys(A.CONFIDENCE);
        let step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        if (SMD.dir() === 'rtl' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) step = -step;
        const i = (ids.indexOf(conf) + step + ids.length) % ids.length;
        pick(ids[i]);
        wrap.querySelector(`[data-conf="${ids[i]}"]`).focus();
        e.preventDefault();
      }
      if (e.key === 'Tab') {
        const f = [...wrap.querySelectorAll('button')];
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => e.target === wrap && close());
    wrap.querySelector('[data-cancel]').addEventListener('click', close);
    wrap.querySelector('[data-start]').addEventListener('click', () => {
      document.removeEventListener('keydown', onKey);
      SMD.audio.chime(true);
      SMD.go('design', { missionKey: key, confidence: conf });
    });
    wrap.querySelector(`[data-conf="standard"]`).focus();
    return close;
  }

  ui.screens.board = {
    render(app, params) {
      const ag = SMD.game.agency;
      if (!ag) {
        SMD.go('start');
        return;
      }
      const A = SMD.agency;
      const free = Math.max(0, ag.teams - A.busyTeams(ag));
      const openCount = ORDER.filter((k) => A.contractState(ag, k) === 'open').length;
      app.innerHTML = `<main class="screen day board">
        <header class="board-top">
          <button class="btn ghost small board-back" data-back>${t('board.back', 'Back to HQ')}</button>
          <div class="board-heading">
            <p class="board-kicker">${t('board.kicker', 'Announcements of Opportunity · {date}', { date: A.fmtMonth(ag.now) })}</p>
            <h1 class="display">${t('board.h', 'Which question will your agency answer?')}</h1>
          </div>
          <dl class="board-stats">
            <div><dt>${t('board.money', 'Money')}</dt><dd class="num">${money(ag.money)}</dd></div>
            <div><dt>${t('board.repL', 'Reputation')}</dt><dd class="num">${ag.rep}</dd></div>
            <div><dt>${t('board.teams', 'Free teams')}</dt><dd class="num">${free} / ${ag.teams}</dd></div>
          </dl>
        </header>
        <p class="board-lede">${
          openCount
            ? t('board.lede', 'Sponsors want answers. Pick a question, ask for a budget, then build the spacecraft that can answer it. Harder questions unlock as your reputation grows.')
            : t('board.lede.none', 'No contract is open right now. Fly your current missions to earn reputation, or buy research to unlock the next one.')
        }</p>
        <section class="board-grid" aria-label="${esc(t('board.grid', 'Missions'))}">
          ${ORDER.map((k, i) => card(ag, k, i)).join('')}
        </section>
        <p class="board-credit">${t('board.credit', 'Images and planet maps: NASA and partners, credited on each picture. Use does not imply NASA endorsement.')}</p>
      </main>`;
      let closeModal = null;
      app.querySelector('[data-back]').addEventListener('click', () => SMD.go('hq'));
      app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => SMD.go(b.dataset.go)));
      app.querySelectorAll('[data-pick]').forEach((b) =>
        b.addEventListener('click', () => {
          SMD.audio.unlock();
          SMD.audio.beep(660, 0.08, 'triangle', 0.14);
          closeModal = proposal(app, ag, b.dataset.pick, () => {
            closeModal = null;
            b.focus();
          });
        })
      );
      if (params && params.missionKey && A.contractState(ag, params.missionKey) === 'open') closeModal = proposal(app, ag, params.missionKey, () => (closeModal = null));
      return () => {
        if (closeModal) closeModal();
      };
    },
  };
})();
