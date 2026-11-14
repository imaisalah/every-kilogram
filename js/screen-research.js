// Research lab: spend science points on technology. Each node says what it
// changes, which new parts it adds and which missions it opens or helps.
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const { esc } = ui;
  const t = (k, e, p) => SMD.t(k, e, p);

  const GROUPS = [
    { id: 'power', techs: ['cells', 'lightPanels', 'rtg'], color: '#b57d00' },
    { id: 'comms', techs: ['amp100', 'dish3', 'rec1t'], color: '#1c5cab' },
    { id: 'instruments', techs: ['sar', 'iceRadar'], color: '#17807a' },
    { id: 'launch', techs: ['aero', 'heavy'], color: '#b4302c' },
    { id: 'reliability', techs: ['dual', 'testlab', 'vault'], color: '#545d66' },
  ];
  const groupName = (id) =>
    ({
      power: t('research.g.power', 'Power'),
      comms: t('research.g.comms', 'Communication'),
      instruments: t('research.g.instruments', 'Instruments'),
      launch: t('research.g.launch', 'Launch and arrival'),
      reliability: t('research.g.reliability', 'Reliability'),
    })[id];
  const groupBlurb = (id) =>
    ({
      power: t('research.gb.power', 'Sunlight fades with distance. At Jupiter it is 4% of what Earth gets.'),
      comms: t('research.gb.comms', 'Data you cannot send home is science you never get.'),
      instruments: t('research.gb.instruments', 'New ways to see through clouds and ice.'),
      launch: t('research.gb.launch', 'Every kilogram you do not have to lift or brake is fuel saved.'),
      reliability: t('research.gb.reliability', 'Hidden flaws end missions. Catch them on the ground.'),
    })[id];

  // New parts each technology adds to the designer.
  function partsFor(id) {
    const D = SMD.data;
    const o = (list, v) => {
      const x = D.OPTIONS[list].find((y) => y.id === v);
      return x && t('data.opt.' + list + '.' + v, x.name);
    };
    return (
      {
        dish3: [t('research.part.dish3', '{name} antenna', { name: o('dish', 3) })],
        amp100: [o('amp', 100)],
        rec1t: [t('research.part.rec1t', '{name} recorder', { name: o('recorder', 1024) })],
        dual: [o('avionics', 'dual')],
        heavy: [o('launcher', 'heavy')],
        aero: [t('research.part.aero', 'Aerobraking capture')],
        sar: [t('inst.sar', D.INSTRUMENTS.sar.name)],
        iceRadar: [t('inst.iceRadar', D.INSTRUMENTS.iceRadar.name)],
        vault: [t('research.part.vault', 'Radiation vault: 25, 75 or 150 kg')],
        rtg: [t('research.part.rtg', 'Up to 3 RTGs, {w} W each', { w: D.CONST.rtg.watts })],
      }[id] || []
    ).filter(Boolean);
  }

  // Missions a technology opens (needsTech) or clearly helps.
  function missionsFor(id) {
    const D = SMD.data;
    const opens = Object.keys(D.CONTRACTS).filter((k) => (D.CONTRACTS[k].needsTech || []).includes(id));
    let helps = [];
    if (D.INSTRUMENTS[id]) helps = Object.keys(D.MISSIONS).filter((k) => D.MISSIONS[k].objectives.some((ob) => ob.instruments[id]));
    else
      helps =
        {
          cells: ['mars', 'jupiter'],
          lightPanels: ['jupiter', 'mars'],
          rtg: ['jupiter'],
          dish3: ['mars', 'venus', 'jupiter'],
          amp100: ['mars', 'venus', 'jupiter'],
          rec1t: ['venus', 'nile'],
          aero: Object.keys(D.MISSIONS).filter((k) => D.MISSIONS[k].aerobrake),
          heavy: ['jupiter', 'venus'],
          dual: ['jupiter', 'venus', 'mars'],
          testlab: [],
        }[id] || [];
    return { opens, helps: helps.filter((k) => !opens.includes(k)) };
  }

  const missionTitle = (k) => t('research.mission.' + k, SMD.data.MISSIONS[k].title);
  const techName = (x) => t('research.tech.' + x.id + '.name', x.name);
  const techEffect = (x) => t('research.tech.' + x.id + '.effect', x.effect);

  // Small line icons, one per technology.
  const ICONS = {
    cells: '<rect x="4" y="9" width="16" height="10" rx="1"/><path d="M4 14h16M9.3 9v10M14.6 9v10M12 2v3M5.5 4.5l1.6 1.6M18.5 4.5l-1.6 1.6"/>',
    lightPanels: '<path d="M5 19c8 0 13-6 14-15C10 5 5 10 5 19z"/><path d="M5 19l9-9"/>',
    rtg: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)"/>',
    amp100: '<path d="M12 13v8M8 21h8"/><circle cx="12" cy="11" r="2"/><path d="M8.5 7.5a5 5 0 0 0 0 7M15.5 7.5a5 5 0 0 1 0 7M5.6 4.6a9 9 0 0 0 0 12.8M18.4 4.6a9 9 0 0 1 0 12.8"/>',
    dish3: '<path d="M4 7a11 11 0 0 0 13 13z"/><path d="M10.5 13.5L18 6M18 6l-1 4M18 6l-4 1M8 20h7"/>',
    rec1t: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h2M7 14h2M12 10h5M12 14h5"/>',
    sar: '<path d="M3 20h18"/><path d="M6 20c1-4 3-6 6-6s5 2 6 6"/><path d="M12 3v5M9 5l3 3 3-3"/><path d="M4 9c2-1.5 4-2 8-2s6 .5 8 2" stroke-dasharray="2 2"/>',
    iceRadar: '<path d="M3 9h18M3 14h18M3 19h18"/><path d="M12 2v15" stroke-dasharray="2 2"/><path d="M9 4l3-2 3 2"/>',
    aero: '<circle cx="15" cy="15" r="6"/><path d="M3 4c4 1 7 3 9 6M2 9c3 0 6 1 8 3"/>',
    heavy: '<path d="M12 2c3 3 4 7 4 11v5H8v-5c0-4 1-8 4-11z"/><path d="M8 15l-3 3v3h3M16 15l3 3v3h-3M10 21h4"/><circle cx="12" cy="9" r="1.5"/>',
    dual: '<rect x="3" y="5" width="8" height="8" rx="1"/><rect x="13" y="11" width="8" height="8" rx="1"/><path d="M5 2v3M9 2v3M15 19v3M19 19v3M11 9h2M11 15h2"/>',
    testlab: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
    vault: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>',
  };
  const icon = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[id] || '<circle cx="12" cy="12" r="8"/>'}</svg>`;
  const flask = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><circle cx="10" cy="16" r="1" fill="currentColor"/><circle cx="14" cy="14" r="1.4" fill="currentColor"/></svg>';

  ui.screens.research = {
    render(app, params) {
      const ag = SMD.game.agency;
      if (!ag) {
        SMD.go('start');
        return;
      }
      const A = SMD.agency;
      const TECH = SMD.data.TECH;
      const byId = Object.fromEntries(TECH.map((x) => [x.id, x]));
      let just = null;
      let shown = ag.science;
      let countRaf = 0;
      const timers = [];
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Technologies missing from the groups still show, in their own lane.
      const grouped = new Set(GROUPS.flatMap((g) => g.techs));
      const lanes = GROUPS.map((g) => ({ ...g, techs: g.techs.filter((id) => byId[id]) }));
      const extra = TECH.filter((x) => !grouped.has(x.id)).map((x) => x.id);
      if (extra.length) lanes.push({ id: 'other', techs: extra, color: '#545d66' });

      function nodeHTML(x, lane) {
        const owned = ag.tech.includes(x.id);
        const can = !owned && ag.science >= x.cost;
        const state = owned ? 'is-owned' : can ? 'is-ready' : 'is-locked';
        const parts = partsFor(x.id);
        const { opens, helps } = missionsFor(x.id);
        const chips = [];
        parts.forEach((p) => chips.push(`<li class="research-chip research-chip--part">${esc(p)}</li>`));
        opens.forEach((k) => chips.push(`<li class="research-chip research-chip--opens">${esc(t('research.opens', 'Opens: {m}', { m: missionTitle(k) }))}</li>`));
        const helpText = helps.length ? t('research.helps', 'Good for {list}', { list: helps.map(missionTitle).join(', ') }) : x.id === 'testlab' ? t('research.helps.all', 'Good for every mission') : '';
        let act;
        if (owned) act = `<span class="research-done">${esc(t('research.owned', 'Researched'))}</span>`;
        else if (can) act = `<button type="button" class="btn primary small" data-buy="${esc(x.id)}">${esc(t('research.buy', 'Research'))}</button>`;
        else act = `<span class="research-need">${esc(t('research.need', '{n} more points', { n: x.cost - ag.science }))}</span>`;
        return `<li class="research-node ${state}${just === x.id ? ' is-just' : ''}" data-node="${esc(x.id)}" style="--lane:${lane.color}">
          <div class="research-node-head">
            <span class="research-icon">${icon(x.id)}</span>
            <h3>${esc(techName(x))}</h3>
          </div>
          <p class="research-effect">${esc(techEffect(x))}</p>
          ${chips.length ? `<ul class="research-chips" aria-label="${esc(t('research.unlocks', 'Unlocks'))}">${chips.join('')}</ul>` : ''}
          ${helpText ? `<p class="research-helps">${esc(helpText)}</p>` : ''}
          <footer>
            <span class="research-cost" title="${esc(t('research.costTip', 'Cost in science points'))}">${flask}<b>${x.cost}</b></span>
            ${act}
          </footer>
          <span class="research-stamp" aria-hidden="true">${esc(t('research.stamp', 'Unlocked'))}</span>
          <span class="research-burst" aria-hidden="true">${'<i></i>'.repeat(12)}</span>
        </li>`;
      }

      function lanesHTML() {
        return lanes
          .map((lane) => {
            const done = lane.techs.filter((id) => ag.tech.includes(id)).length;
            return `<section class="research-lane" style="--lane:${lane.color}" aria-labelledby="rl-${lane.id}">
              <header class="research-lane-head">
                <h2 id="rl-${lane.id}">${esc(lane.id === 'other' ? t('research.g.other', 'Other') : groupName(lane.id))}</h2>
                <span class="research-progress" aria-label="${esc(t('research.progressAria', '{n} of {m} researched', { n: done, m: lane.techs.length }))}">${lane.techs.map((id) => `<i class="${ag.tech.includes(id) ? 'on' : ''}"></i>`).join('')}</span>
                ${lane.id !== 'other' ? `<p>${esc(groupBlurb(lane.id))}</p>` : ''}
              </header>
              <ol class="research-nodes">${lane.techs
                .map((id) => byId[id])
                .sort((a, b) => a.cost - b.cost)
                .map((x) => nodeHTML(x, lane))
                .join('')}</ol>
            </section>`;
          })
          .join('');
      }

      // What research stands between the agency and a mission it could fly.
      function goalHTML() {
        const C = SMD.data.CONTRACTS;
        const blocked = Object.keys(C).filter((k) => A.contractState(ag, k) === 'needsTech');
        const soon = Object.keys(C).filter((k) => (C[k].needsTech || []).some((id) => !ag.tech.includes(id)) && A.contractState(ag, k) === 'locked');
        const k = blocked[0] || soon[0];
        if (!k) return '';
        const need = C[k].needsTech.filter((id) => !ag.tech.includes(id)).map((id) => techName(byId[id]));
        return `<p class="research-goal"><b>${esc(t('research.goal', 'Next goal'))}</b> ${esc(
          t('research.goalText', '{mission} needs {tech}.', { mission: missionTitle(k), tech: need.join(', ') })
        )}${blocked.length ? '' : ` <span class="muted">${esc(t('research.goalRep', 'It also needs reputation {r}.', { r: C[k].unlockRep }))}</span>`}</p>`;
      }

      const total = TECH.length;
      app.innerHTML = `<main class="screen day research">
        <header class="research-top">
          <button type="button" class="btn ghost small" data-act="hq"><span aria-hidden="true" class="research-arrow">←</span> ${esc(t('research.back', 'Back to HQ'))}</button>
          <div class="research-title">
            <h1>${esc(t('research.title', 'Research lab'))}</h1>
            <p class="muted">${esc(t('research.lede', 'Science points come back with every mission’s data. Spend them here on technology your next spacecraft can use.'))}</p>
            <div data-goal>${goalHTML()}</div>
          </div>
          <div class="research-balance" aria-live="polite">
            <span class="research-balance-icon">${flask}</span>
            <div>
              <span class="research-balance-label">${esc(t('research.balance', 'Science points'))}</span>
              <b data-balance>${ag.science}</b>
              <span class="research-balance-sub" data-owned>${esc(t('research.ownedCount', '{n} of {m} technologies researched', { n: ag.tech.length, m: total }))}</span>
            </div>
          </div>
        </header>
        <div class="research-lanes" data-lanes>${lanesHTML()}</div>
      </main>`;

      const $ = (s) => app.querySelector(s);
      const balanceEl = $('[data-balance]');

      function countTo(target) {
        cancelAnimationFrame(countRaf);
        if (reduced) {
          shown = target;
          balanceEl.textContent = String(target);
          return;
        }
        const from = shown;
        const t0 = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - t0) / 700);
          shown = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
          balanceEl.textContent = String(shown);
          if (k < 1) countRaf = requestAnimationFrame(step);
        };
        countRaf = requestAnimationFrame(step);
      }

      function unlockSound() {
        const au = SMD.audio;
        au.beep(196, 0.09, 'square', 0.08); // the stamp
        timers.push(setTimeout(() => au.chime(true), 120));
        timers.push(setTimeout(() => au.beep(1568, 0.5, 'sine', 0.07), 600));
      }

      function buy(id) {
        if (!A.buyTech(ag, id)) {
          SMD.audio.beep(220, 0.15, 'triangle', 0.12);
          return;
        }
        SMD.game.save();
        SMD.bus.emit('agency', ag);
        just = id;
        unlockSound();
        $('[data-lanes]').innerHTML = lanesHTML();
        $('[data-goal]').innerHTML = goalHTML();
        $('[data-owned]').textContent = t('research.ownedCount', '{n} of {m} technologies researched', { n: ag.tech.length, m: total });
        balanceEl.parentElement.parentElement.classList.remove('is-spent');
        void balanceEl.offsetWidth;
        balanceEl.parentElement.parentElement.classList.add('is-spent');
        countTo(ag.science);
        const node = app.querySelector(`[data-node="${id}"]`);
        if (node) {
          node.setAttribute('tabindex', '-1');
          node.focus({ preventScroll: true });
          if (!reduced) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }

      const onClick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.act === 'hq') return SMD.go('hq');
        if (b.dataset.buy) buy(b.dataset.buy);
      };
      app.addEventListener('click', onClick);
      if (params && params.focus) {
        const n = app.querySelector(`[data-node="${params.focus}"]`);
        if (n) n.classList.add('is-focus');
      }

      return () => {
        app.removeEventListener('click', onClick);
        cancelAnimationFrame(countRaf);
        timers.forEach(clearTimeout);
      };
    },
  };
})();
