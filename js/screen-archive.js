// Discovery archive: the real NASA results your missions have unlocked, and
// the patch wall with every mission the agency has started.
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const { esc } = ui;
  const t = (k, e, p) => SMD.t(k, e, p);
  const ORDER = ['nile', 'weather', 'moon', 'mars', 'venus', 'jupiter'];
  const COLOR = { nile: '#4f9be8', weather: '#9ec5f4', moon: '#c9c9c4', mars: '#f07a5a', venus: '#f4e08a', jupiter: '#d39a68' };
  const lockIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  const missionTitle = (k) => t('archive.mission.' + k, SMD.data.MISSIONS[k].title);
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');

  function allDiscoveries() {
    const d = (SMD.content && SMD.content.discoveries) || {};
    const keys = ORDER.filter((k) => d[k]).concat(Object.keys(d).filter((k) => !ORDER.includes(k)));
    // Title and caption in the player's language (content.discoveries.<id>.*).
    const tr = (x) => ({ ...x, title: t(`content.discoveries.${x.id}.title`, x.title), caption: x.caption ? t(`content.discoveries.${x.id}.caption`, x.caption) : '' });
    return keys.map((k) => ({ key: k, list: (d[k] || []).slice().sort((a, b) => (a.minScore || 0) - (b.minScore || 0)).map(tr) }));
  }

  ui.screens.archive = {
    render(app, params) {
      const ag = SMD.game.agency;
      if (!ag) {
        SMD.go('start');
        return;
      }
      let tab = params && params.tab === 'patches' ? 'patches' : 'discoveries';
      const groups = allDiscoveries();
      const total = groups.reduce((s, g) => s + g.list.length, 0);
      const have = new Set(ag.discoveries || []);
      const found = groups.reduce((s, g) => s + g.list.filter((x) => have.has(x.id)).length, 0);
      const earnedBy = (id) => ag.projects.find((p) => p.result && (p.result.discoveries || []).includes(id));

      function hint(key, x) {
        const need = x.minScore || 0;
        const best = ag.completed[key];
        const c = SMD.data.CONTRACTS[key];
        if (best !== undefined) return t('archive.hint.more', 'Your best {mission} mission returned <b>{best}</b> science points. This one needs <b>{need}</b>.', { mission: esc(missionTitle(key)), best: Math.round(best), need });
        const base = need > 0 ? t('archive.hint.fly', 'Fly <b>{mission}</b> and bring back {need} science points or more.', { mission: esc(missionTitle(key)), need }) : t('archive.hint.any', 'Fly <b>{mission}</b> to unlock it.', { mission: esc(missionTitle(key)) });
        return c && ag.rep < c.unlockRep ? `${base} ${esc(t('archive.hint.rep', 'That mission opens at reputation {r}.', { r: c.unlockRep }))}` : base;
      }

      function card(key, x, i) {
        const open = have.has(x.id);
        const img = x.image ? `<img src="${esc(x.image)}" alt="${open ? esc(x.title) : ''}" loading="lazy" decoding="async" onerror="this.remove()" />` : '';
        const meta = [x.mission, x.instrument, x.year].filter(Boolean).map(String).join(' · ');
        if (!open)
          return `<li class="archive-card is-locked" style="--c:${COLOR[key] || '#9ec5f4'}">
            <div class="archive-img">${img}<span class="archive-lock">${lockIcon}</span></div>
            <div class="archive-body">
              <h3>${esc(t('archive.locked', 'Locked discovery'))}</h3>
              ${meta ? `<p class="archive-meta">${esc(t('archive.lockedBy', 'A real result from {who}', { who: meta }))}</p>` : ''}
              <p class="archive-hint">${hint(key, x)}</p>
            </div>
          </li>`;
        const p = earnedBy(x.id);
        return `<li class="archive-card is-open" style="--c:${COLOR[key] || '#9ec5f4'}">
          <div class="archive-img">${img}${x.year ? `<span class="archive-badge">${esc(String(x.year))}</span>` : ''}</div>
          <div class="archive-body">
            <h3><button type="button" class="archive-open-btn" data-open="${esc(key)}:${i}">${esc(x.title)}</button></h3>
            <p class="archive-caption">${esc(x.caption || '')}</p>
            ${meta ? `<p class="archive-meta">${esc(meta)}</p>` : ''}
            ${p ? `<span class="archive-earned">${esc(t('archive.earned', 'Unlocked by {name}', { name: p.design.name }))}</span>` : ''}
          </div>
        </li>`;
      }

      function discoveriesHTML() {
        if (!total)
          return `<div class="archive-empty"><p>${esc(t('archive.none', 'The archive is empty for now. Real NASA results appear here as your missions bring data home.'))}</p></div>`;
        return groups
          .map((g) => {
            const n = g.list.filter((x) => have.has(x.id)).length;
            return `<section class="archive-group" aria-labelledby="ag-${esc(g.key)}">
              <header class="archive-group-head" style="--c:${COLOR[g.key] || '#9ec5f4'}">
                <span class="archive-planet" aria-hidden="true"></span>
                <div>
                  <h2 id="ag-${esc(g.key)}">${esc(SMD.data.MISSIONS[g.key] ? missionTitle(g.key) : g.key)}</h2>
                  ${SMD.data.MISSIONS[g.key] ? `<p>${esc(t('archive.question.' + g.key, SMD.data.MISSIONS[g.key].question))}</p>` : ''}
                </div>
                <span class="archive-group-count">${esc(t('archive.groupCount', '{n} of {m} unlocked', { n, m: g.list.length }))}</span>
              </header>
              <ul class="archive-grid">${g.list.map((x, i) => card(g.key, x, i)).join('')}</ul>
            </section>`;
          })
          .join('');
      }

      function patchesHTML() {
        const list = ag.projects.slice().sort((a, b) => (a.launchMs || 0) - (b.launchMs || 0));
        if (!list.length)
          return `<div class="archive-empty">${SMD.patch.patchSVG({ mission: 'mars', name: '?', instruments: [], arrays: 0, dish: 1 })}<p>${esc(t('archive.noPatches', 'No patches yet. Every mission you approve gets its own patch, stitched from its design.'))}</p></div>`;
        return `<ul class="archive-wall">${list
          .map((p, i) => {
            const year = new Date(p.launchMs || ag.now).getUTCFullYear();
            let line;
            let cls = '';
            if (p.status === 'done' && p.result) {
              const sc = Math.round(p.result.score.total);
              if (p.result.lost) {
                line = `<span class="tone bad">${esc(t('archive.p.lost', 'Lost'))}</span>`;
                cls = 'is-lost';
              } else if (p.result.success) line = `<span class="tone ok">${esc(t('archive.p.headline', 'Headline earned, {s} points', { s: sc }))}</span>`;
              else line = `<span class="tone warn">${esc(t('archive.p.partial', 'Partial answer, {s} points', { s: sc }))}</span>`;
            } else if (p.status === 'flying') {
              line = `<span class="tone ok">${esc(t('archive.p.flying', 'Flying now'))}</span>`;
            } else {
              cls = 'is-pending';
              line = `<span class="muted">${esc(t('archive.p.building', 'Being built. Launch {date}', { date: ui.monthYear(p.launchMs) }))}</span>`;
            }
            return `<li class="archive-patch ${cls}" style="--i:${i}">
              <div class="patch-holder">${SMD.patch.patchSVG(p.design, { year })}</div>
              <h3>${esc(p.design.name)}</h3>
              <p>${esc(missionTitle(p.missionKey))} · ${year}</p>
              <p>${line}</p>
              <button type="button" class="btn ghost small" data-dl="${p.id}">${esc(t('archive.download', 'Save patch'))}</button>
            </li>`;
          })
          .join('')}</ul>`;
      }

      const pct = total ? Math.round((found / total) * 100) : 0;
      app.innerHTML = `<main class="screen night archive">
        <header class="archive-top">
          <button type="button" class="btn ghost small" data-act="hq"><span aria-hidden="true" class="archive-arrow">←</span> ${esc(t('archive.back', 'Back to HQ'))}</button>
          <div class="archive-title">
            <h1>${esc(t('archive.title', 'Discovery archive'))}</h1>
            <p class="muted">${esc(t('archive.lede', 'Each one is a real result from a NASA mission. Bring back enough science and your agency earns the same discovery.'))}</p>
          </div>
          <div class="archive-count">
            <b>${found}<small class="muted"> / ${total}</small></b>
            <span>${esc(t('archive.count', 'real discoveries unlocked'))}</span>
            <span class="archive-meter" role="img" aria-label="${esc(t('archive.pct', '{p}% unlocked', { p: pct }))}"><i style="width:${pct}%"></i></span>
          </div>
        </header>
        <div class="archive-tabs" role="tablist" aria-label="${esc(t('archive.tabs', 'Archive sections'))}">
          <button type="button" role="tab" class="archive-tab" id="at-discoveries" aria-controls="ap" data-tab="discoveries">${esc(t('archive.tab.discoveries', 'Discoveries'))}<small>${found}</small></button>
          <button type="button" role="tab" class="archive-tab" id="at-patches" aria-controls="ap" data-tab="patches">${esc(t('archive.tab.patches', 'Patch wall'))}<small>${ag.projects.length}</small></button>
        </div>
        <section class="archive-panel" id="ap" role="tabpanel" tabindex="0" data-panel></section>
        <dialog class="archive-dialog" data-dialog aria-labelledby="ad-title"></dialog>
      </main>`;

      const $ = (s) => app.querySelector(s);
      const panel = $('[data-panel]');
      const dialog = $('[data-dialog]');

      function showTab(name, focus) {
        tab = name;
        app.querySelectorAll('[role="tab"]').forEach((b) => {
          const on = b.dataset.tab === name;
          b.setAttribute('aria-selected', String(on));
          b.tabIndex = on ? 0 : -1;
          if (on && focus) b.focus();
        });
        panel.setAttribute('aria-labelledby', 'at-' + name);
        panel.innerHTML = name === 'patches' ? patchesHTML() : discoveriesHTML();
      }

      function openDiscovery(key, i) {
        const g = groups.find((x) => x.key === key);
        const x = g && g.list[Number(i)];
        if (!x) return;
        const p = earnedBy(x.id);
        const src = safeUrl(x.sourceUrl);
        const meta = [x.mission, x.instrument, x.year].filter(Boolean).map(String).join(' · ');
        dialog.innerHTML = `<button type="button" class="archive-close" data-act="close" aria-label="${esc(t('archive.close', 'Close'))}">×</button>
          <figure>
            ${x.image ? `<img src="${esc(x.image)}" alt="${esc(x.title)}" onerror="this.remove()" />` : ''}
            <figcaption>
              <h2 id="ad-title">${esc(x.title)}</h2>
              ${meta ? `<p class="archive-meta">${esc(meta)}</p>` : ''}
              <p>${esc(x.caption || '')}</p>
              ${p ? `<span class="archive-earned">${esc(t('archive.earnedLong', 'Your {name} earned this with {score} science points for {mission}.', { name: p.design.name, score: Math.round(p.result.score.total), mission: missionTitle(p.missionKey) }))}</span>` : ''}
              ${x.credit ? `<p class="archive-credit">${esc(t('archive.credit', 'Credit: {c}', { c: '⁨' + x.credit + '⁩' }))}</p>` : ''}
              ${src ? `<p class="small"><a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${esc(t('archive.source', 'Read the original release'))}</a></p>` : ''}
            </figcaption>
          </figure>`;
        if (dialog.showModal) dialog.showModal();
        else dialog.setAttribute('open', '');
        SMD.audio.beep(880, 0.08, 'sine', 0.06);
      }

      const onClick = (e) => {
        if (e.target === dialog) return dialog.close();
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.act === 'hq') return SMD.go('hq');
        if (b.dataset.act === 'close') return dialog.close();
        if (b.dataset.tab) return showTab(b.dataset.tab);
        if (b.dataset.open) {
          const [k, i] = b.dataset.open.split(':');
          return openDiscovery(k, i);
        }
        if (b.dataset.dl) {
          const p = ag.projects.find((x) => x.id === Number(b.dataset.dl));
          if (p) SMD.patch.downloadPatch(p.design, { year: new Date(p.launchMs || ag.now).getUTCFullYear() });
        }
      };
      // Arrow keys move between tabs (WAI-ARIA tabs pattern).
      const onKey = (e) => {
        if (!e.target.matches || !e.target.matches('[role="tab"]')) return;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        showTab(tab === 'patches' ? 'discoveries' : 'patches', true);
      };
      app.addEventListener('click', onClick);
      app.addEventListener('keydown', onKey);
      showTab(tab);

      return () => {
        app.removeEventListener('click', onClick);
        app.removeEventListener('keydown', onKey);
        if (dialog.open) dialog.close();
      };
    },
  };
})();
