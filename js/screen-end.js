// Agency legacy: shown when the career ends (January 2037) or when all
// three headline missions are earned. Rating, headlines, patches, the best
// decisions, real discoveries and the credits.
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const { esc, fmt } = ui;
  const t = (k, e, p) => SMD.t(k, e, p);
  const HEADLINES = ['mars', 'venus', 'jupiter'];

  const missionTitle = (k) => t('end.mission.' + k, SMD.data.MISSIONS[k].title);
  const headlineText = (k) => t('end.headline.' + k, SMD.data.MISSIONS[k].headline);

  // Agency score: science returned, headlines, discoveries and reputation.
  function rate(ag) {
    const done = ag.projects.filter((p) => p.status === 'done' && p.result);
    const science = done.reduce((s, p) => s + (p.result.lost ? 0 : p.result.score.total || 0), 0);
    const lost = done.filter((p) => p.result.lost).length;
    const score = Math.round(science + ag.headlines.length * 150 + (ag.discoveries || []).length * 12 + ag.rep * 15 - lost * 40);
    const ranks = [
      { min: 0, id: 'ground', stars: 1, name: t('end.rank.ground', 'Ground crew'), line: t('end.rank.ground.l', 'Every agency’s first missions teach the most. Yours taught plenty.') },
      { min: 160, id: 'orbital', stars: 2, name: t('end.rank.orbital', 'Orbital agency'), line: t('end.rank.orbital.l', 'Your satellites watched over Earth and brought real data home.') },
      { min: 380, id: 'planetary', stars: 3, name: t('end.rank.planetary', 'Interplanetary agency'), line: t('end.rank.planetary.l', 'You crossed the gap between worlds and made it count.') },
      { min: 650, id: 'deep', stars: 4, name: t('end.rank.deep', 'Deep-space agency'), line: t('end.rank.deep.l', 'Few agencies on Earth have flown what you flew.') },
      { min: 950, id: 'legend', stars: 5, name: t('end.rank.legend', 'Legendary explorers'), line: t('end.rank.legend.l', 'Mars, Venus and Europa answered your questions. Textbooks will cite your data.') },
    ];
    let rank = ranks[0];
    ranks.forEach((r) => score >= r.min && (rank = r));
    if (HEADLINES.every((k) => ag.headlines.includes(k))) rank = ranks[4];
    return { score, science, lost, flown: done.filter((p) => p.launchMs).length, done, rank };
  }

  // The choices that paid off, picked from what really happened.
  function bestDecisions(ag, done) {
    const out = [];
    const events = (SMD.content && SMD.content.events) || [];
    const planet = (k) => t('end.planet.' + SMD.data.MISSIONS[k].dest, SMD.physics.PLANETS[SMD.data.MISSIONS[k].dest].name);
    done.forEach((p) => {
      if (p.result.lost) return;
      const name = p.design.name;
      const sc = p.result.score.total || 0;
      const fixed = (p.flaws || []).filter((f) => f.fixed).length;
      const planDef = SMD.data.TEST_PLANS.find((x) => x.id === p.testPlan);
      const plan = planDef && t('tests.' + planDef.id, planDef.name);
      if (fixed)
        out.push({
          w: 10 + fixed * 8 + sc / 10,
          title: t('end.d.tests.t', 'Testing paid off on {name}', { name }),
          text: fixed === 1 ? t('end.d.tests1', '{plan} found and fixed a hidden flaw before launch. In space, nobody can fix a cracked bracket.', { plan: plan || t('end.d.tests.plan', 'The test campaign') }) : t('end.d.tests', '{plan} found and fixed {n} hidden flaws before launch. In space, nobody can fix a cracked bracket.', { plan: plan || t('end.d.tests.plan', 'The test campaign'), n: fixed }),
        });
      (p.events || [])
        .filter((s) => s.resolved && s.choice)
        .forEach((s) => {
          const e = events.find((x) => x.id === s.id);
          const c = e && e.choices.find((x) => x.id === s.choice);
          if (!c || !c.effects || c.effects.hiddenFlaw) return;
          const careful = (c.effects.money || 0) < 0 || (c.effects.months || 0) > 0;
          if (!careful || !p.result.success) return;
          out.push({
            w: 18 + sc / 10,
            title: t('end.d.event.t', '{name}: {event}', { name, event: t(`content.events.${e.id}.title`, e.title) }),
            text: t('end.d.event', 'You chose: {choice}. {lesson}', { choice: t(`content.events.${e.id}.choice.${c.id}`, c.label), lesson: e.realStory && e.realStory.lesson ? t(`content.events.${e.id}.lesson`, e.realStory.lesson) : '' }),
          });
        });
      if (p.design.capture === 'aerobrake' && p.result.success)
        out.push({ w: 14, title: t('end.d.aero.t', '{name} braked in the air', { name }), text: t('end.d.aero', 'Aerobraking at {planet} saved propellant the launcher never had to lift.', { planet: planet(p.missionKey) }) });
      if (p.reserve > 0 && p.reserveLeft >= p.reserve * 0.5)
        out.push({ w: 9, title: t('end.d.reserve.t', '{name} stayed on budget', { name }), text: t('end.d.reserve', '${m}M of its reserve was never needed. Reviewers remember that.', { m: Math.round(p.reserveLeft) }) });
      if (p.confidence === 'lean' && p.result.success && !p.breach)
        out.push({ w: 12, title: t('end.d.lean.t', 'A lean bid that held', { name }), text: t('end.d.lean', '{name} asked for little money and still delivered without an overrun.', { name }) });
      if (p.result.success && SMD.data.CONTRACTS[p.missionKey].headline)
        out.push({ w: 8 + sc / 8, title: t('end.d.design.t', '{name}’s design answered the question', { name }), text: t('end.d.design', 'It carried what {mission} needed and returned {s} science points.', { mission: missionTitle(p.missionKey), s: Math.round(sc) }) });
    });
    const seen = new Set();
    return out
      .sort((a, b) => b.w - a.w)
      .filter((d) => !seen.has(d.title) && seen.add(d.title))
      .slice(0, 4);
  }

  function star(on) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z" fill="${on ? '#d9a21b' : 'none'}" stroke="#d9a21b" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  }

  // The agency seal: a gold medallion with the rank, stars and years.
  function sealSVG(ag, r, years) {
    const id = 'seal' + Math.random().toString(36).slice(2, 7);
    const name = SMD.patch.escapeXml(String(ag.name).toUpperCase());
    const rank = SMD.patch.escapeXml(r.rank.name.toUpperCase());
    let stars = '';
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.2 + (0.6 * i) / 4);
      const x = 120 + Math.cos(a) * 52;
      const y = 128 + Math.sin(a) * 52;
      stars += `<path transform="translate(${x - 9} ${y - 9}) scale(0.75)" d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z" fill="${i < r.rank.stars ? '#F4E4B5' : 'none'}" stroke="#F4E4B5" stroke-width="1.4"/>`;
    }
    let rays = '';
    for (let i = 0; i < 36; i++) rays += `<path d="M120 4 L124 18 L116 18 Z" fill="#D9A21B" transform="rotate(${i * 10} 120 120)"/>`;
    return `<svg class="end-seal" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(t('end.sealAria', '{rank} seal for {name}', { rank: r.rank.name, name: ag.name }))}">
      <defs>
        <path id="${id}t" d="M 120 120 m -86 0 a 86 86 0 1 1 172 0"/>
        <path id="${id}b" d="M 120 120 m -92 0 a 92 92 0 0 0 184 0"/>
        <radialGradient id="${id}g" cx="40%" cy="35%"><stop offset="0" stop-color="#F6D27A"/><stop offset="1" stop-color="#B8860F"/></radialGradient>
      </defs>
      ${rays}
      <circle cx="120" cy="120" r="104" fill="url(#${id}g)"/>
      <circle cx="120" cy="120" r="98" fill="none" stroke="#7A5A0C" stroke-width="1.4" stroke-dasharray="2.4 1.8"/>
      <circle cx="120" cy="120" r="76" fill="#14273C" stroke="#7A5A0C" stroke-width="2"/>
      <circle cx="120" cy="120" r="70" fill="none" stroke="#F4E4B5" stroke-width="0.8" stroke-dasharray="1.6 1.6" opacity="0.6"/>
      ${stars}
      <text x="120" y="132" text-anchor="middle" font-family="Archivo, 'Arial Narrow', sans-serif" font-weight="900" font-size="34" fill="#F4E4B5">${r.score}</text>
      <text x="120" y="150" text-anchor="middle" font-family="Archivo, 'Arial Narrow', sans-serif" font-weight="700" font-size="11" letter-spacing="0.5" fill="#A9B6C2">${esc(t('end.sealScore', 'Agency score'))}</text>
      <text x="120" y="172" text-anchor="middle" font-family="Archivo, 'Arial Narrow', sans-serif" font-weight="700" font-size="11" letter-spacing="1.5" fill="#F4E4B5">${esc(years)}</text>
      <text font-family="Archivo, 'Arial Narrow', sans-serif" font-weight="850" font-size="15" letter-spacing="2" fill="#14273C"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${name}</textPath></text>
      <text font-family="Archivo, 'Arial Narrow', sans-serif" font-weight="800" font-size="12" letter-spacing="2.5" fill="#14273C" dy="10"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${rank}</textPath></text>
    </svg>`;
  }

  function creditLines() {
    const lines = [];
    const credits = (SMD.assets && SMD.assets.credits) || [];
    const seen = new Set();
    credits.forEach((c) => {
      const text = typeof c === 'string' ? c : [c.title, c.credit].filter(Boolean).join(': ');
      if (text && !seen.has(text)) {
        seen.add(text);
        lines.push(text);
      }
    });
    const disc = (SMD.content && SMD.content.discoveries) || {};
    const dc = new Set();
    Object.values(disc).forEach((list) => (list || []).forEach((x) => x.credit && dc.add(x.credit)));
    if (dc.size) lines.push(t('end.credits.disc', 'Discovery images: {list}', { list: [...dc].slice(0, 12).join('; ') }));
    return lines;
  }

  ui.screens.end = {
    render(app) {
      const ag = SMD.game.agency;
      if (!ag) {
        SMD.go('start');
        return;
      }
      const A = SMD.agency;
      const over = A.isOver(ag);
      const r = rate(ag);
      const startY = new Date(SMD.data.CAREER.start).getUTCFullYear();
      const endY = Math.min(new Date(ag.now).getUTCFullYear(), new Date(SMD.data.CAREER.end).getUTCFullYear() - 1);
      const years = `${startY}–${endY}`;
      const disc = (SMD.content && SMD.content.discoveries) || {};
      const discTotal = Object.values(disc).reduce((s, l) => s + (l || []).length, 0);
      const discN = (ag.discoveries || []).length;
      const decisions = bestDecisions(ag, r.done);
      const patches = ag.projects.filter((p) => p.launchMs).sort((a, b) => a.launchMs - b.launchMs);
      const succeeded = r.done.filter((p) => p.result.success).length;

      const stat = (label, value, small) => `<div><dt>${esc(label)}</dt><dd>${value}${small ? `<small>${esc(small)}</small>` : ''}</dd></div>`;
      const papers = HEADLINES.map((k, i) => {
        const won = ag.headlines.includes(k);
        const p = ag.projects.filter((x) => x.missionKey === k && x.result && x.result.success).sort((a, b) => b.result.score.total - a.result.score.total)[0];
        if (won)
          return `<li class="end-paper" style="--i:${i}">
            <div class="end-masthead"><span>${esc(t('end.paper', 'The Daily Orbit'))}</span><span>${p ? esc(String(new Date(p.endMs || p.arriveMs || ag.now).getUTCFullYear())) : ''}</span></div>
            <h3>${esc(headlineText(k))}</h3>
            <p>${esc(p ? t('end.paper.by', '{name}, built by {agency}, answered “{q}”', { name: p.design.name, agency: ag.name, q: t('end.question.' + k, SMD.data.MISSIONS[k].question) }) : t('end.paper.byAgency', '{agency} answered “{q}”', { agency: ag.name, q: t('end.question.' + k, SMD.data.MISSIONS[k].question) }))}</p>
          </li>`;
        return `<li class="end-paper is-missing" style="--i:${i}">
          <div class="end-masthead"><span>${esc(t('end.paper', 'The Daily Orbit'))}</span><span>${esc(missionTitle(k))}</span></div>
          <h3>${esc(t('end.paper.missing', 'A story still waiting to be written'))}</h3>
          <p>${esc(t('end.question.' + k, SMD.data.MISSIONS[k].question))}</p>
        </li>`;
      }).join('');

      const credits = creditLines();
      app.innerHTML = `<main class="screen night end">
        <div class="end-inner">
          <div class="end-topbar">
            ${over ? '<span></span>' : `<button type="button" class="btn ghost small" data-act="hq"><span aria-hidden="true" class="end-arrow">←</span> ${esc(t('end.back', 'Back to HQ'))}</button>`}
            ${over ? '' : `<span class="small muted">${esc(t('end.preview', 'A preview: your career runs until the end of {y}.', { y: new Date(SMD.data.CAREER.end).getUTCFullYear() - 1 }))}</span>`}
          </div>
          <section class="end-hero">
            ${sealSVG(ag, r, years)}
            <div>
              <p class="end-kicker">${esc(t('end.kicker', 'Agency legacy, {years}', { years }))}</p>
              <h1 class="display">${esc(ag.name)}</h1>
              <p class="end-rank">${esc(r.rank.name)}<span class="end-stars" role="img" aria-label="${esc(t('end.starsAria', '{n} of 5 stars', { n: r.rank.stars }))}">${[0, 1, 2, 3, 4].map((i) => star(i < r.rank.stars)).join('')}</span></p>
              <p class="end-lede">${esc(r.rank.line)} ${esc(t('end.summary', '{flown} missions flown, {head} of 3 headline discoveries, {disc} real NASA discoveries unlocked.', { flown: r.flown, head: ag.headlines.length, disc: discN }))}</p>
            </div>
          </section>
          <dl class="end-stats">
            ${stat(t('end.s.flown', 'Missions flown'), String(r.flown), r.lost ? t('end.s.lost', '{n} lost', { n: r.lost }) : '')}
            ${stat(t('end.s.success', 'Answered their question'), String(succeeded), t('end.s.of', 'of {n}', { n: r.done.length }))}
            ${stat(t('end.s.science', 'Science returned'), fmt(r.science), t('end.s.points', 'points'))}
            ${stat(t('end.s.disc', 'Discoveries'), String(discN), discTotal ? t('end.s.of', 'of {n}', { n: discTotal }) : '')}
            ${stat(t('end.s.rep', 'Reputation'), String(ag.rep))}
            ${stat(t('end.s.money', 'Money left'), esc(ui.money(Math.round(ag.money))))}
          </dl>

          <section class="end-section">
            <h2>${esc(t('end.h.headlines', 'Headlines'))}</h2>
            <p>${esc(t('end.h.headlinesLede', 'Three questions only a planetary mission can answer.'))}</p>
            <ul class="end-papers">${papers}</ul>
          </section>

          <section class="end-section">
            <h2>${esc(t('end.h.patches', 'Patch wall'))}</h2>
            <p>${esc(t('end.h.patchesLede', 'Every spacecraft your agency launched.'))}</p>
            ${
              patches.length
                ? `<ul class="end-patches">${patches
                    .map((p, i) => {
                      const y = new Date(p.launchMs).getUTCFullYear();
                      const res = p.result ? (p.result.lost ? t('end.p.lost', 'Lost') : t('end.p.score', '{s} points', { s: Math.round(p.result.score.total) })) : p.status === 'flying' ? t('end.p.flying', 'Still flying') : t('end.p.building', 'Not launched');
                      return `<li class="${p.result && p.result.lost ? 'is-lost' : ''}" style="--i:${i}"><div class="patch-holder">${SMD.patch.patchSVG(p.design, { year: y })}</div><b>${esc(p.design.name)}</b>${esc(res)}</li>`;
                    })
                    .join('')}</ul>`
                : `<p class="muted">${esc(t('end.p.none', 'No spacecraft left the ground this time.'))}</p>`
            }
          </section>

          <section class="end-section">
            <h2>${esc(t('end.h.decisions', 'Your best decisions'))}</h2>
            <p>${esc(t('end.h.decisionsLede', 'The calls that made the difference, from what really happened in your missions.'))}</p>
            ${
              decisions.length
                ? `<ol class="end-decisions">${decisions.map((d, i) => `<li><span class="end-num">${i + 1}</span><div><b>${esc(d.title)}</b><p>${esc(d.text)}</p></div></li>`).join('')}</ol>`
                : `<p class="muted">${esc(t('end.d.none', 'Fly a mission all the way to its results and your best calls will show up here.'))}</p>`
            }
          </section>

          <section class="end-section">
            <h2>${esc(t('end.h.credits', 'Credits'))}</h2>
            <div class="end-credits">
              <p>${esc(t('end.credits.made', 'Every Kilogram was made for the NASA Space Apps Challenge 2026: Space Mission Design Game.'))}</p>
              <p>${esc((SMD.assets && SMD.assets.endorsement) || t('end.credits.nasa', 'Imagery and models courtesy of NASA, NASA/JPL-Caltech, NASA Earth Observatory, NASA SVS, NASA Trek, USGS Astrogeology. Use does not imply NASA endorsement.'))}</p>
              <p>${esc(t('end.credits.data', 'Planet positions from JPL approximate orbital elements. Mission numbers from NASA fact sheets and the NASA Lessons Learned Information System.'))}</p>
              ${credits.length ? `<details><summary>${esc(t('end.credits.all', 'All asset credits ({n})', { n: credits.length }))}</summary><ul>${credits.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}
            </div>
          </section>

          <div class="end-actions">
            <button type="button" class="btn primary" data-act="new">${esc(t('end.new', 'Found a new agency'))}</button>
            <button type="button" class="btn ghost" data-act="card">${esc(t('end.card', 'Save legacy card'))}</button>
            <button type="button" class="btn ghost" data-act="title">${esc(t('end.title', 'Back to title'))}</button>
          </div>
        </div>
      </main>`;

      const timers = [];
      if (over && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
        timers.push(setTimeout(() => SMD.audio.chime(true), 400));
        timers.push(setTimeout(() => SMD.audio.beep(1047, 0.8, 'sine', 0.06), 900));
      }

      // A shareable PNG: seal, name, rank and up to eight patches.
      function saveCard() {
        const W = 1200;
        const H = 630;
        const seal = sealSVG(ag, r, years).replace('<svg class="end-seal"', '<svg x="70" y="150" width="330" height="330"');
        const list = patches.slice(0, 8);
        const pat = list
          .map((p, i) => SMD.patch.patchSVG(p.design, { year: new Date(p.launchMs).getUTCFullYear() }).replace('<svg class="patch"', `<svg x="${470 + (i % 4) * 172}" y="${300 + Math.floor(i / 4) * 160}" width="150" height="150"`))
          .join('');
        const x = (s) => SMD.patch.escapeXml(String(s));
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
          <rect width="${W}" height="${H}" fill="#101922"/>
          <circle cx="235" cy="315" r="300" fill="#D9A21B" opacity="0.08"/>
          ${seal}
          <text x="470" y="120" font-family="Arial Narrow, Arial, sans-serif" font-size="22" font-weight="700" fill="#D9A21B">${x(t('end.kicker', 'Agency legacy, {years}', { years }))}</text>
          <text x="470" y="185" font-family="Arial Narrow, Arial, sans-serif" font-size="58" font-weight="800" fill="#E9EEF2">${x(ag.name)}</text>
          <text x="470" y="235" font-family="Arial Narrow, Arial, sans-serif" font-size="30" font-weight="700" fill="#F6D27A">${x(r.rank.name)} · ${x(t('end.cardScore', 'score {s}', { s: r.score }))}</text>
          <text x="470" y="275" font-family="Arial, sans-serif" font-size="19" fill="#A9B6C2">${x(t('end.summary', '{flown} missions flown, {head} of 3 headline discoveries, {disc} real NASA discoveries unlocked.', { flown: r.flown, head: ag.headlines.length, disc: discN }))}</text>
          ${pat}
          <text x="${W - 40}" y="${H - 28}" text-anchor="end" font-family="Arial, sans-serif" font-size="16" fill="#6F8090">Every Kilogram · NASA Space Apps Challenge 2026</text>
        </svg>`;
        const img = new Image();
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = W;
          c.height = H;
          c.getContext('2d').drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          const a = document.createElement('a');
          a.href = c.toDataURL('image/png');
          a.download = `${String(ag.name).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'agency'}-legacy.png`;
          a.click();
        };
        img.src = url;
      }

      const onClick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'hq') SMD.go('hq');
        else if (act === 'title') SMD.go('start');
        else if (act === 'card') saveCard();
        else if (act === 'new') {
          if (!over && !window.confirm(t('end.confirmNew', 'Start over? Your current agency will be replaced.'))) return;
          SMD.go('newgame');
        }
      };
      app.addEventListener('click', onClick);
      return () => {
        app.removeEventListener('click', onClick);
        timers.forEach(clearTimeout);
      };
    },
  };
})();
