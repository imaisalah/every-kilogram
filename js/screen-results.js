// Mission results (evaluate): what came home, what it earned, what shaped
// it, how the design compares with the real NASA mission, and the real
// discoveries it unlocked. Params: { projectId }.
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const { esc, fmt } = ui;
  const t = (k, e, p) => SMD.t(k, e, p);

  const DAY = 864e5;
  const MONTHS = (ms) => Math.max(1, Math.round(ms / (30.44 * DAY)));

  function pickProject(ag, params) {
    if (!ag) return null;
    if (params.projectId !== undefined) return ag.projects.find((p) => p.id === params.projectId) || null;
    const done = ag.projects.filter((p) => p.result);
    return done[done.length - 1] || null;
  }

  // Data that came home (Gbit per instrument), before or after a reload.
  function dataOf(p) {
    const f = p.flight || {};
    const st = f.sci && f.sci.st;
    return { delivered: (st ? st.delivered : f.delivered) || {}, lost: (st ? st.lost : f.lostGbit) || {} };
  }

  // Mission, goal, instrument and launcher names in the player's language.
  const mText = (key, field, english) => t(`mission.${key}.${field}`, english);
  const objLabel = (key, o) => t(`mission.${key}.obj.${o.id}`, o.label);
  const instName = (id) => {
    const I = SMD.data.INSTRUMENTS;
    return t(`inst.${id}`, (I[id] && I[id].name) || id);
  };
  const launcherName = (id) => {
    const l = SMD.model.opt(SMD.data.OPTIONS.launcher, id);
    return t(`design.opt.launcher.${id}`, l ? l.name : id);
  };

  const fmtData = (gbit) => (gbit >= 1000 ? t('results.tbit', '{n} Tbit', { n: fmt(gbit / 1000, 1) }) : t('results.gbit', '{n} Gbit', { n: fmt(gbit, gbit < 10 ? 1 : 0) }));
  const tone = (k, label) => ui.tone(k, label);

  // ---------- Pieces ----------
  function scoreRing(score, headline, crew) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const k = Math.max(0, Math.min(1, score / 100));
    const tick = (a) => {
      const ang = a * Math.PI * 2; // the svg itself is turned so 0 is at the top
      return `<line x1="${60 + Math.cos(ang) * 44}" y1="${60 + Math.sin(ang) * 44}" x2="${60 + Math.cos(ang) * 60}" y2="${60 + Math.sin(ang) * 60}" />`;
    };
    return `<div class="results-ring ${headline ? 'won' : ''}" role="img" aria-label="${esc(t('results.ring.aria', 'Science score {n} of 100. The headline needs 70.', { n: Math.round(score) }))}">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="bg" cx="60" cy="60" r="${r}" />
        <circle class="fg" cx="60" cy="60" r="${r}" style="--len:${c.toFixed(1)};--off:${(c * (1 - k)).toFixed(1)}" />
        <g class="tick">${tick(0.7)}</g>
      </svg>
      <div class="results-ring-n"><b class="num" data-count="${Math.round(score)}">0</b><span>${esc(t('results.ring.of', 'of 100'))}</span></div>
      <p class="results-ring-l">${esc(crew ? t('results.crew.ring', 'Mission score') : t('results.ring.label', 'Science score'))}<small>${esc(t('results.ring.tick', 'mark: headline at 70'))}</small></p>
    </div>`;
  }

  function goalsCard(m, score) {
    const crew = m.kind === 'crew';
    const fr = (score && score.fractions) || {};
    const rows = m.objectives
      .map((o) => {
        const f = Math.max(0, Math.min(1, fr[o.id] || 0));
        const pct = Math.round(f * 100);
        const pts = Math.round(o.weight * f);
        const st = f >= 0.8 ? 'ok' : f >= 0.4 ? 'warn' : 'bad';
        return `<li class="results-goal ${st}">
          <div class="results-goal-h">
            <span class="results-goal-name">${esc(objLabel(m.key, o))}${o.key ? ` <em class="results-badge">${esc(t('results.goal.headline', 'Headline goal'))}</em>` : ''}</span>
            <span class="results-goal-v num">${esc(t('results.goal.pts', '{pts} of {w} pts', { pts, w: o.weight }))}</span>
          </div>
          <div class="results-bar" role="img" aria-label="${esc(t('results.goal.aria', '{pct}% of the data this goal needs', { pct }))}">
            <i style="--w:${pct}%"></i>${o.key ? '<s style="--at:80%"></s>' : ''}
          </div>
          <p class="results-goal-s">${tone(st, st === 'ok' ? t('results.goal.done', 'Done') : st === 'warn' ? t('results.goal.part', 'Partly done') : t('results.goal.missed', 'Missed'))}<span class="num">${esc(crew ? t('results.crew.goal.pct', '{pct}% done', { pct }) : t('results.goal.pct', '{pct}% of the data it needs', { pct }))}</span>${o.key ? `<span class="results-goal-need">${esc(t('results.goal.need', 'The headline needs 80% here'))}</span>` : ''}</p>
        </li>`;
      })
      .join('');
    return `<section class="results-card" aria-labelledby="rg-h">
      <h2 id="rg-h">${esc(crew ? t('results.crew.goals.h', 'Mission goals') : t('results.goals.h', 'Science per goal'))}</h2>
      <p class="results-sub">${esc(crew ? t('results.crew.goals.sub', 'Bringing the crew home safely counts most. A lost crew scores nothing at all.') : t('results.goals.sub', 'Each goal is worth points. It counts as done when 80% of the data it needs came home.'))}</p>
      <ul class="results-goals">${rows}</ul>
    </section>`;
  }

  function dataCard(p, m) {
    const { delivered, lost } = dataOf(p);
    const ids = Object.keys(Object.assign({}, delivered, lost));
    const total = ids.reduce((s, id) => s + (delivered[id] || 0), 0);
    const lostT = ids.reduce((s, id) => s + (lost[id] || 0), 0);
    const max = Math.max(1e-9, ...ids.map((id) => (delivered[id] || 0) + (lost[id] || 0)));
    const rows = ids
      .sort((a, b) => (delivered[b] || 0) - (delivered[a] || 0))
      .map((id) => {
        const d = delivered[id] || 0;
        const l = lost[id] || 0;
        return `<li>
          <span class="results-data-name">${esc(instName(id))}</span>
          <span class="results-data-bar" aria-hidden="true"><i style="--w:${((d / max) * 100).toFixed(1)}%"></i><b style="--w:${((l / max) * 100).toFixed(1)}%"></b></span>
          <span class="results-data-v num">${esc(fmtData(d))}${l > 0.5 ? ` <small>${esc(t('results.data.lostShort', '+{n} lost', { n: fmtData(l) }))}</small>` : ''}</span>
        </li>`;
      })
      .join('');
    const months = Math.round(((m.turns || 12) * (m.turnDays || 30)) / 30);
    return `<section class="results-card" aria-labelledby="rd-h">
      <h2 id="rd-h">${esc(t('results.data.h', 'Data returned'))}</h2>
      <p class="results-big num">${esc(fmtData(total))}</p>
      <p class="results-sub">${esc(
        p.result && p.result.lost && total < 0.05
          ? t('results.data.sub.none', 'No science phase: the spacecraft was lost before it began.')
          : lostT > 0.5
          ? t('results.data.sub.lost', 'Over {m} months of science. Another {n} was overwritten on the recorder before the radio could send it.', { m: months, n: fmtData(lostT) })
          : t('results.data.sub', 'Over {m} months of science. Nothing was lost on the recorder.', { m: months })
      )}</p>
      ${rows ? `<ul class="results-data">${rows}</ul>` : `<p class="muted">${esc(t('results.data.none', 'No science data reached Earth.'))}</p>`}
      ${lostT > 0.5 ? `<p class="results-legend"><span class="sw sent"></span>${esc(t('results.data.sent', 'Sent home'))}<span class="sw lost"></span>${esc(t('results.data.lost', 'Lost: recorder full'))}</p>` : ''}
    </section>`;
  }

  function lessonsCard(lessons) {
    const max = Math.max(10, ...lessons.map((l) => Math.abs(l.delta)));
    const rows = lessons
      .map((l) => {
        const pos = l.delta > 0;
        const w = ((Math.abs(l.delta) / max) * 100).toFixed(1);
        return `<li class="${pos ? 'pos' : 'neg'}">
          <p>${esc(l.text)}</p>
          <div class="results-div" role="img" aria-label="${esc(pos ? t('results.shape.posAria', 'Would have added {n} points', { n: Math.round(l.delta) }) : t('results.shape.negAria', 'Cost {n} points', { n: Math.round(-l.delta) }))}">
            <span class="half neg">${pos ? '' : `<i style="--w:${w}%"></i>`}</span>
            <span class="half pos">${pos ? `<i style="--w:${w}%"></i>` : ''}</span>
            <b class="num">${esc(pos ? t('results.shape.plus', '+{n} pts', { n: Math.round(l.delta) }) : t('results.shape.minus', '−{n} pts', { n: Math.round(-l.delta) }))}</b>
          </div>
        </li>`;
      })
      .join('');
    return `<section class="results-card results-shape" aria-labelledby="rs-h">
      <h2 id="rs-h">${esc(t('results.shape.h', 'What shaped this mission'))}</h2>
      <p class="results-sub">${esc(t('results.shape.sub', 'We flew the same mission again with one change at a time, with the same luck. Solid bars cost you points; striped bars would have added them.'))}</p>
      ${
        rows
          ? `<div class="results-axis" aria-hidden="true"><span>${esc(t('results.shape.hurt', 'What hurt'))}</span><span>${esc(t('results.shape.help', 'What would have helped'))}</span></div><ul class="results-lessons">${rows}</ul>`
          : `<p class="results-calm">${tone('ok', t('results.shape.none.t', 'Well balanced'))} ${esc(t('results.shape.none', 'No single change we tried would have moved the score by 3 points or more.'))}</p>`
      }
    </section>`;
  }

  // ---------- Crewed missions ----------
  // What happened to the crew, system by system (from score.crew).
  function crewCard(p) {
    const c = p.flight && p.flight.score && p.flight.score.crew;
    if (!c) return '';
    const rows = [];
    const row = (st, title, text) =>
      rows.push(`<li class="results-goal ${st}"><div class="results-goal-h"><span class="results-goal-name">${esc(title)}</span>${tone(st, st === 'ok' ? t('film.tone.ok', 'Good') : st === 'warn' ? t('film.tone.warn', 'Watch') : t('film.tone.bad', 'Problem'))}</div><p class="results-goal-s">${esc(text)}</p></li>`);
    if (c.ascent.fails) row(c.las ? 'warn' : 'bad', t('results.crew.ascent', 'Launch'), c.las ? t('results.crew.ascent.abort', 'A booster hit the core stage at separation. The abort tower pulled the crew clear: everyone safe, mission over.') : t('results.crew.ascent.lost', 'A booster hit the core stage at separation. There was no abort tower.'));
    else row(c.las ? 'ok' : 'warn', t('results.crew.ascent', 'Launch'), c.las ? t('results.crew.ascent.ok', 'A clean climb. The abort tower was ready and left at 3 min 18 s.') : t('results.crew.ascent.nolas', 'A clean climb, with no abort tower to fall back on. Lucky.'));
    if (c.outcome !== 'aborted' && !(c.outcome === 'lost' && c.lostAt === 'ascent')) {
      row(
        c.tli.steep ? 'bad' : c.tli.leak ? 'warn' : 'ok',
        t('results.crew.tli', 'Burn to the Moon'),
        c.tli.leak
          ? c.tli.steep
            ? t('results.crew.tli.steep', 'A valve leaked {kg} kg of propellant. Too little was left to trim the way home, so the entry was steeper.', { kg: c.tli.leakKg })
            : t('results.crew.tli.leak', 'A valve leaked {kg} kg of propellant; the fuel margin covered it.', { kg: c.tli.leakKg })
          : t('results.crew.tli.ok', '388 m/s on the number, {kg} kg of propellant to spare.', { kg: c.tli.propLeft || 0 })
      );
      row(
        c.life.emergency ? 'bad' : c.life.fails || c.cold ? 'warn' : 'ok',
        t('results.crew.life', 'Air and water'),
        c.life.fails
          ? c.life.emergency
            ? t('results.crew.life.em', 'The air system failed and only {d} days of clean air were left for a 9-day trip. The crew came home in their suits.', { d: c.life.effDays })
            : t('results.crew.life.fix', 'A valve stuck and the spare days shrank to {d}: still enough.', { d: c.life.effDays })
          : t('results.crew.life.ok', '{d} days of air and water for a 9-day trip. Nothing broke.', { d: c.life.days })
      );
      row(
        c.spe.hits && c.spe.dose === 'high' ? 'bad' : 'ok',
        t('results.crew.spe', 'Solar storm'),
        c.spe.hits
          ? c.spe.dose === 'high'
            ? t('results.crew.spe.bad', 'A solar storm hit and there was no shelter: a heavy radiation dose.')
            : t('results.crew.spe.ok', 'A solar storm hit; the crew waited it out behind {kg} kg of shelter.', { kg: c.spe.shelter })
          : t('results.crew.spe.none', 'The Sun stayed quiet this time.')
      );
      const r = Math.round((c.entry.ratio || 0) * 100);
      row(
        c.entry.burn === 'through' ? 'bad' : c.entry.burn === 'scorched' ? 'warn' : 'ok',
        t('results.crew.entry', 'Heat shield'),
        c.entry.burn === 'through'
          ? t('results.crew.entry.lost', 'The shield could take only {r}% of the heat of this entry and wore through.', { r })
          : t('results.crew.entry.ok', 'The shield could take {r}% of the heat of this entry{char}. Peak {g} g on a {how} entry.', {
              r,
              g: c.entry.peakG,
              how: c.entry.profile === 'skip' ? t('ride.card.skip', 'skip') : t('ride.card.direct', 'direct'),
              char: c.entry.charLoss ? t('results.crew.entry.char', ', even after losing chunks of char') : '',
            })
      );
    }
    const hd = c.outcome === 'lost' ? t('results.crew.h.lost', 'The crew was lost') : c.outcome === 'aborted' ? t('results.crew.h.abort', 'Aborted: the crew is safe') : c.outcome === 'close' ? t('results.crew.h.close', 'Home, but it was close') : t('results.crew.h.safe', 'All four home safe');
    return `<section class="results-card" aria-labelledby="rcr-h">
      <h2 id="rcr-h">${esc(t('results.crew.h', 'Crew report'))}</h2>
      <p class="results-big">${esc(hd)}</p>
      <ul class="results-goals">${rows.join('')}</ul>
    </section>`;
  }

  // Crew what-ifs: the same flight, same luck, one design change at a time.
  function crewLessons(ag, p) {
    const out = [];
    const d = p.design;
    const base = p.result.score.total;
    const lostNow = !!p.result.lost;
    const O = SMD.data.OPTIONS;
    const next = (list, v) => (list.find((o) => o.id > v) || {}).id;
    const tries = [];
    if (!Number(d.abort)) tries.push({ change: { abort: 1 }, text: (v, saved) => (saved ? t('results.crew.l.abort.saved', 'A launch abort system would have brought the crew home ({v} points).', { v }) : t('results.crew.l.abort', 'A launch abort system would have given {v} points.', { v })) });
    const hs = next(O.heatShield, Number(d.heatShield));
    if (hs) tries.push({ change: { heatShield: hs }, text: (v, saved) => (saved ? t('results.crew.l.shield.saved', 'A {kg} kg heat shield would have survived the entry ({v} points).', { kg: hs, v }) : t('results.crew.l.shield', 'A {kg} kg heat shield would have given {v} points.', { kg: hs, v })) });
    if (d.entry === 'skip') tries.push({ change: { entry: 'direct' }, text: (v, saved) => (saved ? t('results.crew.l.direct.saved', 'A direct entry, like Artemis II, would have saved the crew ({v} points).', { v }) : t('results.crew.l.direct', 'A direct entry, like Artemis II, would have given {v} points.', { v })) });
    const ld = next(O.lifeDays, Number(d.lifeDays));
    if (ld) tries.push({ change: { lifeDays: ld }, text: (v) => t('results.crew.l.life', '{d} days of life support would have given {v} points.', { d: ld, v }) });
    if (!Number(d.shelter)) tries.push({ change: { shelter: 150 }, text: (v) => t('results.crew.l.shelter', 'A stowage-bag storm shelter would have given {v} points.', { v }) });
    if (d.margin < 30) tries.push({ change: { margin: d.margin + 10 }, text: (v) => t('lesson.margin', '10% more fuel margin would have given {v} points.', { v }) });
    if (!(d.instruments || []).some((id) => id === 'hires' || id === 'context')) tries.push({ change: { instruments: (d.instruments || []).concat('context') }, text: (v) => t('results.crew.l.camera', 'A camera at the window would have given {v} points.', { v }) });
    tries.forEach((tr) => {
      let r;
      try {
        r = SMD.agency.whatIf(p, tr.change);
      } catch (e) {
        return;
      }
      if (!r || !r.feasible) return;
      const saved = lostNow && !r.lost;
      if (saved || Math.abs(r.score - base) >= 3) out.push({ delta: r.score - base, text: tr.text(Math.round(r.score), saved) });
    });
    // Hidden flaws that flew: fly again with that one flaw fixed (same luck)
    // to see what it really cost, and name the test that catches it.
    const flown = (p.flight.fs ? p.flight.fs.manifested.map((x) => ({ sub: x.flaw && x.flaw.sub, text: x.text })) : p.flight.manifested || []).filter((x) => x.sub);
    flown.forEach((mf) => {
      const flaws = JSON.parse(JSON.stringify(p.flaws || []));
      const f = flaws.find((x) => x.sub === mf.sub && !x.fixed);
      if (!f) return;
      f.fixed = true;
      let score = null;
      try {
        const ev = SMD.model.evaluate(p.design, p.launch, { readyMs: p.readyMs });
        score = SMD.ops.autoFlight(p.design, ev, flaws, p.seed, { instQuality: p.healthMods, scienceBoost: p.scienceBoost }).score.total;
      } catch (e) {
        return;
      }
      const delta = base - score;
      const best = SMD.ops.bestTestFor(mf.sub);
      const hint = best ? ' ' + t('lesson.test', 'A {test} catches about {p}% of flaws like this.', { test: SMD.lang() === 'en' ? t('data.test.' + best.test.id, best.test.name).toLowerCase() : t('data.test.' + best.test.id, best.test.name), p: Math.round(best.p * 100) }) : mf.sub === 'heatShield' ? ' ' + t('results.crew.l.arcjet', 'No standard test sees this; only arc-jet testing of the material does.') : '';
      if (delta <= -2) out.push({ delta, text: mf.text + hint });
    });
    return out
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5);
  }

  // Player's numbers for the comparison card.
  function playerNumbers(p, m) {
    let ev = null;
    try {
      ev = SMD.model.evaluate(p.design, p.launch, { readyMs: p.readyMs });
    } catch (e) {
      ev = null;
    }
    const L = ev && ev.launch;
    const P = SMD.physics;
    let rate = null;
    if (L) {
      let dmin = m.kind === 'planet' ? Infinity : m.kind === 'moon' ? 0.00257 : 0.00001;
      if (m.kind === 'planet') {
        const s0 = L.scienceStartMs;
        const span = (m.turns || 12) * (m.turnDays || 30) * DAY;
        for (let i = 0; i <= 24; i++) dmin = Math.min(dmin, P.earthDistanceAU(m.dest, s0 + (span * i) / 24));
      }
      rate = m.kind === 'crew' ? null : SMD.model.linkRateMbps(p.design, dmin, 1);
    }
    const flownMonths = p.endMs && p.launchMs ? MONTHS(p.endMs - p.launchMs) : 0;
    const cost = (p.buildCost || 0) + (p.overrun || 0) + (p.launcherCost || 0) + (p.opsMonthly || 0) * flownMonths;
    const year = new Date(p.launchMs || (p.launch && p.launch.departMs) || Date.now()).getUTCFullYear();
    const lid = SMD.model.launcherFor ? SMD.model.launcherFor(p.design) : p.design.launcher;
    return { mass: L ? L.wet : null, power: ev ? ev.base.powerAvail : null, rate, cost, launch: `${launcherName(lid)}, ${year}` };
  }

  function compareCard(p, m) {
    const real = SMD.content && SMD.content.realMissions && SMD.content.realMissions[p.missionKey];
    if (!real) return '';
    const me = playerNumbers(p, m);
    const k = (f) => `content.realMissions.${p.missionKey}.${f}`;
    const fmtRate = (mbps) => (mbps >= 1 ? t('results.cmp.mbps', '{n} Mbps', { n: fmt(mbps, mbps < 10 ? 1 : 0) }) : t('results.cmp.kbps', '{n} kbps', { n: fmt(mbps * 1000) }));
    const row = (label, mine, theirs, myV, realV, note, unit) => {
      const max = Math.max(myV || 0, realV || 0);
      const bars =
        max > 0
          ? `<div class="results-cmp-bars" aria-hidden="true"><i class="me" style="--w:${(((myV || 0) / max) * 100).toFixed(1)}%"></i><i class="real" style="--w:${(((realV || 0) / max) * 100).toFixed(1)}%"></i></div>`
          : '';
      return `<tr>
        <th scope="row">${esc(label)}</th>
        <td class="num">${esc(mine)}</td>
        <td class="num">${esc(theirs)}${note ? `<small>${esc(note)}</small>` : ''}</td>
      </tr>${bars ? `<tr class="results-cmp-barrow"><td></td><td colspan="2">${bars}</td></tr>` : ''}`;
    };
    const kg = (x) => (x === null || x === undefined ? '—' : t('results.cmp.kg', '{n} kg', { n: fmt(x) }));
    const w = (x) => (x === null || x === undefined ? '—' : t('results.cmp.w', '{n} W', { n: fmt(x) }));
    const usd = (x) => (x === null || x === undefined ? '—' : ui.money(x));
    const ratio = me.mass && real.launchMassKg ? me.mass / real.launchMassKg : null;
    const insight =
      ratio === null
        ? ''
        : ratio < 0.5
          ? t('results.cmp.lighter', '{name} weighs {n}% of {real}. Real missions carry more instruments, spares and margin, and they last for years, not months.', { name: p.design.name, n: Math.round(ratio * 100), real: real.name })
          : ratio > 1.3
            ? t('results.cmp.heavier', '{name} is {n}% heavier than {real}. Every extra kilogram needed more fuel and a bigger rocket.', { name: p.design.name, n: Math.round((ratio - 1) * 100), real: real.name })
            : t('results.cmp.close', '{name} is close to {real} in mass: you made many of the same trade-offs its engineers made.', { name: p.design.name, real: real.name });
    return `<section class="results-card results-cmp" aria-labelledby="rc-h">
      <h2 id="rc-h">${esc(t('results.cmp.h', 'Your design vs the real mission'))}</h2>
      <p class="results-sub">${esc(t('results.cmp.sub', 'The real NASA mission that did this job: {real}.', { real: real.name }))}</p>
      <table>
        <thead><tr><td></td><th scope="col"><span class="sw me"></span>${esc(p.design.name)}</th><th scope="col"><span class="sw real"></span>${esc(real.name)}</th></tr></thead>
        <tbody>
          ${row(t('results.cmp.mass', 'Launch mass'), kg(me.mass), kg(real.launchMassKg), me.mass, real.launchMassKg, real.massNote ? t(k('massNote'), real.massNote) : '')}
          ${row(t('results.cmp.power', 'Power where it works'), w(me.power), w(real.powerW), me.power, real.powerW, real.powerNote ? t(k('powerNote'), real.powerNote) : '')}
          ${row(t('results.cmp.data', 'Best data rate'), me.rate === null ? '—' : t('results.cmp.upTo', 'Up to {r}', { r: fmtRate(me.rate) }), real.dataRate || '—', null, null, real.dataNote ? t(k('dataNote'), real.dataNote) : '')}
          ${row(t('results.cmp.cost', 'Total cost'), usd(me.cost), usd(real.costM), me.cost, real.costM, real.costNote ? t(k('costNote'), real.costNote) : '')}
          ${row(t('results.cmp.launch', 'Launch'), me.launch, real.launch || '—', null, null, '')}
        </tbody>
      </table>
      ${insight ? `<p class="results-insight">${esc(insight)}</p>` : ''}
      ${real.fact ? `<p class="results-fact"><b>${esc(t('results.cmp.fact', 'Real fact'))}</b> ${esc(t(k('fact'), real.fact))}</p>` : ''}
      ${real.source ? `<p class="results-src"><a href="${esc(real.source)}" target="_blank" rel="noopener noreferrer">${esc(t('results.cmp.source', 'Source for these numbers'))}</a></p>` : ''}
    </section>`;
  }

  function logCard(p) {
    const items = ((p.flight && p.flight.timeline) || []).slice().sort((a, b) => a.ms - b.ms);
    if (!items.length) return '';
    const launchRow = p.launchMs ? `<li class="info"><time>${esc(ui.date(p.launchMs))}</time><div><b>${esc(t('results.log.launch', 'Launch'))}</b></div></li>` : '';
    return `<section class="results-card" aria-labelledby="rl-h">
      <h2 id="rl-h">${esc(t('results.log.h', 'Flight log'))}</h2>
      <ol class="results-log">${launchRow}${items
        .map(
          (e) => `<li class="${['ok', 'warn', 'bad'].includes(e.tone) ? e.tone : 'info'}">
          <time>${esc(ui.date(e.ms))}</time>
          <div><b>${esc(e.title)}</b><p>${esc(e.text || '')}</p></div>
        </li>`
        )
        .join('')}</ol>
    </section>`;
  }

  function discoveriesSection(p) {
    const all = (SMD.content && SMD.content.discoveries && SMD.content.discoveries[p.missionKey]) || [];
    if (!all.length) return '';
    const got = new Set((p.result && p.result.discoveries) || []);
    const score = p.result && p.result.score ? p.result.score.total : 0;
    const cards = all
      .map((d, i) => {
        const k = (f) => `content.discoveries.${d.id}.${f}`;
        if (!got.has(d.id))
          return `<li class="results-disc locked">
            <div class="results-disc-img" aria-hidden="true"><span>?</span></div>
            <div class="results-disc-body">
              <p class="results-disc-meta">${esc(t('results.disc.locked', 'Locked'))}</p>
              <h3>${esc(d.minScore ? t('results.disc.need', 'Needs {n} science points', { n: d.minScore }) : t('results.disc.needAny', 'Needs science to come home'))}</h3>
              <p>${esc(t('results.disc.short', 'This mission scored {s}. Fly it again with a better design to unlock this real NASA discovery.', { s: Math.round(score) }))}</p>
            </div>
          </li>`;
        return `<li class="results-disc" style="--i:${i}">
          <figure class="results-disc-img ${d.fit === 'contain' ? 'contain' : ''}">
            <img src="${esc(d.image)}" alt="${esc(t(k('title'), d.title))}" loading="lazy" decoding="async" />
          </figure>
          <div class="results-disc-body">
            <p class="results-disc-meta">${esc([d.mission, d.instrument, d.year].filter(Boolean).join(' · '))}</p>
            <h3>${esc(t(k('title'), d.title))}</h3>
            <p>${esc(t(k('caption'), d.caption))}</p>
            <p class="results-disc-credit">${esc(t('results.disc.credit', 'Image: {c}', { c: d.credit }))}${d.sourceUrl ? ` · <a href="${esc(d.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('results.disc.source', 'Source'))}</a>` : ''}</p>
          </div>
        </li>`;
      })
      .join('');
    return `<section class="results-discs" aria-labelledby="rx-h">
      <div class="results-discs-head">
        <h2 id="rx-h">${esc(t('results.disc.h', 'Discoveries unlocked'))}</h2>
        <p class="results-sub">${esc(
          got.size
            ? t('results.disc.sub', 'Your data matches real results from NASA missions. {n} of {all} added to your Discovery Archive.', { n: got.size, all: all.length })
            : t('results.disc.none', 'No discoveries this time: not enough science came home.')
        )}</p>
      </div>
      <ul class="results-disc-list">${cards}</ul>
    </section>`;
  }

  // The patch's border, stitched one stitch at a time.
  const STITCHES = 72;
  function stitchSVG() {
    let d = '';
    for (let i = 0; i < STITCHES; i++) {
      const a0 = (i / STITCHES) * Math.PI * 2 - Math.PI / 2;
      const a1 = a0 + (Math.PI * 2) / STITCHES / 1.8;
      d += `<line class="st" x1="${(100 + Math.cos(a0) * 95.5).toFixed(2)}" y1="${(100 + Math.sin(a0) * 95.5).toFixed(2)}" x2="${(100 + Math.cos(a1) * 95.5).toFixed(2)}" y2="${(100 + Math.sin(a1) * 95.5).toFixed(2)}" />`;
    }
    return `<svg class="results-thread" viewBox="0 0 200 200" aria-hidden="true">${d}<circle class="needle" cx="100" cy="4.5" r="3.2" /></svg>`;
  }

  // The one change that mattered most, said in the hero.
  function whyLine(lessons) {
    if (!lessons.length) return '';
    const l = lessons.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    const pos = l.delta > 0;
    const pts = pos ? t('results.shape.plus', '+{n} pts', { n: Math.round(l.delta) }) : t('results.shape.minus', '−{n} pts', { n: Math.round(-l.delta) });
    return `<p class="results-why ${pos ? 'pos' : 'neg'}"><b>${esc(pos ? t('results.why.pos', 'What would have helped most') : t('results.why.neg', 'What cost the most'))}</b> <span>${esc(l.text)}</span> <em class="num">${esc(pts)}</em></p>`;
  }

  // ---------- Screen ----------
  ui.screens.results = {
    render(app, params) {
      const ag = SMD.game.agency;
      const p = pickProject(ag, params || {});
      // The HQ astronaut reacts to how this went once you are back on campus.
      let mood = null;
      const back = () => SMD.go('hq', mood ? { resume: true, mood } : { resume: true });
      if (!p || !p.result) {
        app.innerHTML = `<main class="screen day results"><div class="results-wrap"><h1 class="display">${esc(t('results.none', 'No results yet'))}</h1><p class="muted">${esc(t('results.none.sub', 'This mission is still flying.'))}</p><p><button class="btn primary" data-back>${esc(t('results.back', 'Back to HQ'))}</button></p></div></main>`;
        app.querySelector('[data-back]').addEventListener('click', back);
        return;
      }
      const m = SMD.data.MISSIONS[p.missionKey];
      const crewM = m.kind === 'crew';
      const r = p.result;
      const score = r.score || { total: 0, fractions: {} };
      const lost = !!r.lost;
      const won = !lost && !!r.success;
      const outcome = lost ? 'lost' : won ? 'won' : 'partial';
      mood = won ? 'celebrate' : lost ? 'sad' : 'cheer';
      const me = SMD.avatar ? SMD.avatar.get() : null;
      const year = new Date(p.launchMs || Date.now()).getUTCFullYear();
      const keyObj = m.objectives.find((o) => o.key);
      const { delivered } = dataOf(p);
      const total = Object.values(delivered).reduce((s, x) => s + (x || 0), 0);

      const tag = { won: t('results.tag.won', 'Headline earned'), partial: t('results.tag.partial', 'Partial success'), lost: t('results.tag.lost', 'Mission lost') }[outcome];
      const lossItem = lost ? ((p.flight && p.flight.timeline) || []).filter((e) => e.tone === 'bad').pop() : null;
      const mKey = p.missionKey;
      const title = won
        ? mText(mKey, 'headline', m.headline)
        : lost
          ? crewM
            ? t('results.crew.lost.title', 'The crew of {name} was lost', { name: p.design.name })
            : t('results.lost.title', '{name} went silent', { name: p.design.name })
          : crewM
            ? t('results.crew.partial.title', '{pts} of 100 mission points', { pts: Math.round(score.total) })
            : t('results.partial.title', '{pts} of 100 science points', { pts: Math.round(score.total) });
      const lede = crewM && won
        ? t('results.crew.won.lede', '{name} carried four astronauts around the far side of the Moon and brought them home. {q}', { name: p.design.name, q: mText(mKey, 'question', m.question) })
        : crewM && !lost
          ? t('results.crew.partial.lede', 'The crew is home, but the headline needs 70 points with the crew safe and well.')
          : won
        ? t('results.won.lede', '{name} sent home {data} and answered the question: {q}', { name: p.design.name, data: fmtData(total), q: mText(mKey, 'question', m.question) })
        : lost
          ? lossItem
            ? `${lossItem.title}: ${lossItem.text}`
            : t('results.lost.lede', 'The spacecraft was lost before it could do its science.')
          : t('results.partial.lede', 'Good science came home, but not enough for the headline. It needs 70 points and 80% of “{goal}”.', { goal: keyObj ? objLabel(mKey, keyObj) : '' });
      const rw = r.reward || { rep: 0, science: 0, money: 0 };
      const stat = (label, value, cls) => `<div class="results-stat ${cls || ''}"><dt>${esc(label)}</dt><dd class="num">${esc(value)}</dd></div>`;
      const dates = [p.launchMs ? t('results.k.launched', 'Launched {d}', { d: ui.monthYear(p.launchMs) }) : '', p.endMs && !lost ? (crewM && score.crew && score.crew.outcome !== 'aborted' ? t('results.crew.k.home', 'home {d}', { d: ui.date(score.crew.splashMs) }) : crewM ? '' : t('results.k.ended', 'science ended {d}', { d: ui.monthYear(p.endMs) })) : ''].filter(Boolean).join(' · ');

      let lessons = [];
      try {
        lessons = (crewM ? crewLessons(ag, p) : SMD.agency.lessons(ag, p)) || [];
      } catch (e) {
        lessons = [];
      }
      // Goals with no instrument on board: the plainest lesson of all.
      if (!lost) {
        const have = new Set(p.design.instruments || []);
        m.objectives.forEach((o) => {
          const f = (score.fractions && score.fractions[o.id]) || 0;
          const ids = Object.keys(o.instruments || {});
          if (f >= 0.4 || !ids.length || ids.some((id) => have.has(id))) return;
          const inst = instName(ids[0]);
          const gain = Math.round(o.weight * (1 - f));
          if (gain >= 3) lessons.push({ delta: gain, upTo: true, text: t('results.shape.noInst2', '{goal}: nothing on board could collect this data. Carrying the {inst} would have helped.', { goal: objLabel(mKey, o), inst: SMD.lang() === 'en' ? inst.toLowerCase() : inst }) });
        });
      }

      app.innerHTML = `<main class="screen day results" data-outcome="${outcome}">
        <header class="results-top">
          <span class="results-brand">${esc(t('results.brand', 'Every Kilogram'))}</span>
          <span class="results-crumb">${esc(t('results.crumb', 'Mission report'))}</span>
          <span class="results-spacer"></span>
          <button type="button" class="btn small ghost" data-act="patch">${esc(t('results.patch', 'Download patch'))}</button>
          <button type="button" class="btn small primary" data-act="back">${esc(t('results.back', 'Back to HQ'))}</button>
        </header>
        <div class="results-wrap">
          <section class="results-hero ${outcome}">
            <div class="results-patch-wrap"><div class="results-patch stitch" data-patch>${SMD.patch.patchSVG(p.design, { year })}${stitchSVG()}${me ? `<figure class="results-me ${outcome}" data-me hidden><img alt="${esc(t('results.me.alt', '{name}, your astronaut', { name: me.name }))}" width="96" height="96" /></figure>` : ''}</div><p class="results-stitched" data-stitched>${esc(lost ? (crewM ? t('results.crew.stitched.lost', 'Patch kept, in memory of the four who flew it') : t('results.stitched.lost', 'Patch kept, in memory of the crew who built it')) : t('results.stitched', 'Stitched onto your patch wall'))}</p></div>
            <div class="results-head">
              <p class="results-kicker">${esc(mText(mKey, 'title', m.title))}${dates ? ` · ${esc(dates)}` : ''}</p>
              <p class="results-tag">${tone(won ? 'ok' : lost ? 'bad' : 'warn', tag)}</p>
              <h1 class="display">${esc(title)}</h1>
              <p class="results-lede">${esc(lede)}</p>
              <dl class="results-rewards">
                ${stat(t('results.rw.rep', 'Reputation'), ui.signed(rw.rep), rw.rep < 0 ? 'neg' : '')}
                ${stat(t('results.rw.sci', 'Science points'), ui.signed(rw.science), '')}
                ${stat(t('results.rw.money', 'Money'), `${rw.money < 0 ? '−' : rw.money > 0 ? '+' : ''}${ui.money(Math.abs(rw.money))}`, rw.money < 0 ? 'neg' : '')}
              </dl>
              ${whyLine(lessons)}
            </div>
            ${scoreRing(score.total, won, crewM)}
          </section>
          <div class="results-grid">
            <div class="results-col">
              ${lessonsCard(lessons)}
              ${goalsCard(m, score)}
              ${crewM ? crewCard(p) : dataCard(p, m)}
            </div>
            <div class="results-col">
              ${compareCard(p, m)}
              ${logCard(p)}
            </div>
          </div>
          ${discoveriesSection(p)}
          <footer class="results-foot">
            <p class="small muted">${esc(t('results.credit', 'Imagery courtesy of NASA, NASA/JPL-Caltech, NASA Earth Observatory and USGS. Use does not imply NASA endorsement.'))}</p>
            <div class="results-actions">
              <button type="button" class="btn ghost" data-act="patch">${esc(t('results.patch', 'Download patch'))}</button>
              <button type="button" class="btn primary" data-act="back">${esc(t('results.back', 'Back to HQ'))}</button>
            </div>
          </footer>
        </div>
        <aside class="results-honour" data-honour role="status" aria-live="polite" hidden></aside>
      </main>`;

      app.querySelectorAll('[data-act="back"]').forEach((b) => b.addEventListener('click', back));
      app.querySelectorAll('[data-act="patch"]').forEach((b) => b.addEventListener('click', () => SMD.patch.downloadPatch(p.design, { year })));

      // Stitch the patch piece by piece.
      const reduced = (() => {
        try {
          return matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
          return false;
        }
      })();
      const patchSvg = app.querySelector('[data-patch] svg.patch');
      if (patchSvg) Array.from(patchSvg.children).forEach((el, i) => el.style && el.style.setProperty('--i', i));
      // The needle runs round the border, one stitch at a time, then the
      // finished patch catches the light.
      const patchEl = app.querySelector('[data-patch]');
      const stitches = Array.from(app.querySelectorAll('.results-thread .st'));
      const needle = app.querySelector('.results-thread .needle');
      let sraf = 0;
      const stitched = () => {
        stitches.forEach((el) => el.classList.add('on'));
        if (needle) needle.style.opacity = '0';
        if (patchEl) patchEl.classList.add('stitched');
        const lab = app.querySelector('[data-stitched]');
        if (lab) lab.classList.add('on');
      };
      if (reduced || !stitches.length) stitched();
      else {
        const s0 = performance.now() + 250;
        let shown = 0;
        const stitchFn = (now) => {
          const k = Math.max(0, Math.min(1, (now - s0) / 1900));
          const n = Math.floor(k * stitches.length);
          while (shown < n) {
            stitches[shown].classList.add('on');
            if (shown % 6 === 0) {
              try {
                SMD.audio.beep(1500 + (shown % 12) * 40, 0.025, 'square', 0.025);
              } catch (e) {}
            }
            shown++;
          }
          if (needle) {
            const a = k * Math.PI * 2 - Math.PI / 2;
            needle.setAttribute('cx', (100 + Math.cos(a) * 95.5).toFixed(2));
            needle.setAttribute('cy', (100 + Math.sin(a) * 95.5).toFixed(2));
          }
          if (k < 1) sraf = requestAnimationFrame(stitchFn);
          else stitched();
        };
        sraf = requestAnimationFrame(stitchFn);
      }

      // Count the score up; reveal discoveries one by one when they scroll in.
      const timers = [];
      const countEl = app.querySelector('[data-count]');
      let raf = 0;
      if (countEl) {
        const target = Number(countEl.dataset.count) || 0;
        if (reduced) countEl.textContent = String(target);
        else {
          const t0 = performance.now() + 500;
          const stepFn = (now) => {
            const k = Math.max(0, Math.min(1, (now - t0) / 1400));
            countEl.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
            if (k < 1) raf = requestAnimationFrame(stepFn);
          };
          raf = requestAnimationFrame(stepFn);
        }
      }
      if (won || !lost) timers.push(setTimeout(() => SMD.audio && SMD.audio.chime && SMD.audio.chime(won), reduced ? 300 : 2250));
      const list = app.querySelector('.results-disc-list');
      let io = null;
      if (list) {
        const go = () => list.classList.add('go');
        if (reduced || !('IntersectionObserver' in window)) go();
        else {
          io = new IntersectionObserver(
            (ents) => {
              if (ents.some((e) => e.isIntersecting)) {
                go();
                io.disconnect();
              }
            },
            { threshold: 0.15 }
          );
          io.observe(list);
        }
      }
      // The director's portrait beside the patch, with the face this deserves.
      if (me) {
        import(new URL('js/3d/astronaut.js', document.baseURI).href)
          .then((mod) => mod.createPortrait(me, 192, { expression: won ? 'joy' : lost ? 'sad' : 'happy' }))
          .then((url) => {
            const fig = app.querySelector('[data-me]');
            if (!fig || !fig.isConnected) return;
            fig.querySelector('img').src = url;
            fig.hidden = false;
          })
          .catch((err) => console.warn('results portrait unavailable', err));
      }

      // Rank-ups and new badges: a short reward card once the score has counted
      // up. Skippable (button, Esc), and it leaves by itself.
      const honourEl = app.querySelector('[data-honour]');
      let honourOff = null;
      function hideHonour() {
        if (!honourEl || honourEl.hidden) return;
        honourEl.classList.remove('show');
        timers.push(setTimeout(() => (honourEl.hidden = true), reduced ? 0 : 260));
        if (honourOff) honourOff();
        honourOff = null;
      }
      function showHonour() {
        if (!SMD.avatar || !honourEl) return;
        let ev;
        try {
          ev = SMD.avatar.evaluate(ag);
        } catch (e) {
          return;
        }
        const fresh = ev.newlyEarned || [];
        if (!ev.rankUp && !fresh.length) return;
        const shown = fresh.slice(0, 4);
        const more = fresh.length - shown.length;
        const badges = shown
          .map((b, i) => `<li style="--i:${i}">${SMD.avatar.badgeSVG(b.id, true, b.name)}<span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></span></li>`)
          .join('');
        honourEl.innerHTML = `<div class="results-honour-card">
            ${ev.rankUp ? `<div class="results-honour-rank"><img data-hportrait alt="" width="72" height="72" hidden /><div><p class="results-honour-k">${esc(t('results.honour.promoted', 'Promoted'))}</p><h2>${esc(ev.rank.name)}</h2>${ev.nextRank ? `<p class="results-honour-next">${esc(t('avatar.rank.next', 'Next: {rank}. {need}', { rank: ev.nextRank.name, need: ev.nextRank.need }))}</p>` : ''}</div></div>` : ''}
            ${shown.length ? `<p class="results-honour-k">${esc(fresh.length === 1 ? t('results.honour.badge', 'Badge earned') : t('results.honour.badges', '{n} badges earned', { n: fresh.length }))}</p><ul class="results-honour-badges">${badges}</ul>${more > 0 ? `<p class="results-honour-more small">${esc(t('results.honour.more', 'and {n} more in your astronaut’s record', { n: more }))}</p>` : ''}` : ''}
            <div class="results-honour-btns">
              <button type="button" class="btn small ghost" data-honour-act="see">${esc(t('results.honour.see', 'See all badges'))}</button>
              <button type="button" class="btn small primary" data-honour-act="ok">${esc(t('results.honour.ok', 'Nice'))}</button>
            </div>
          </div>`;
        honourEl.hidden = false;
        void honourEl.offsetWidth;
        honourEl.classList.add('show');
        // Seen now: the next results screen only announces what is new again.
        try {
          SMD.avatar.acknowledge(ag);
        } catch (e) {}
        if (SMD.audio && SMD.audio.chime) {
          try {
            SMD.audio.chime(true);
          } catch (e) {}
        }
        const img = honourEl.querySelector('[data-hportrait]');
        if (img && me)
          import(new URL('js/3d/astronaut.js', document.baseURI).href)
            .then((mod) => mod.createPortrait(me, 144, { expression: 'joy' }))
            .then((url) => {
              if (!img.isConnected) return;
              img.src = url;
              img.hidden = false;
            })
            .catch(() => {});
        const onKey = (e) => {
          if (e.key === 'Escape') hideHonour();
        };
        document.addEventListener('keydown', onKey);
        honourOff = () => document.removeEventListener('keydown', onKey);
        honourEl.addEventListener('click', (e) => {
          const b = e.target.closest('[data-honour-act]');
          if (!b) return;
          if (b.dataset.honourAct === 'see') SMD.go('avatar', { next: 'results', nextParams: { projectId: p.id }, back: 'results', backParams: { projectId: p.id } });
          else hideHonour();
        });
        // It leaves by itself unless the player is reading it (hover or focus).
        const autoHide = () => {
          if (!honourEl.isConnected || honourEl.hidden) return;
          if (honourEl.matches(':hover') || honourEl.contains(document.activeElement)) timers.push(setTimeout(autoHide, 2000));
          else hideHonour();
        };
        timers.push(setTimeout(autoHide, 9000));
      }
      timers.push(setTimeout(showHonour, reduced ? 400 : 2600));

      return () => {
        if (honourOff) honourOff();
        cancelAnimationFrame(raf);
        cancelAnimationFrame(sraf);
        timers.forEach(clearTimeout);
        if (io) io.disconnect();
      };
    },
  };
})();
