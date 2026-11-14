// Review board: PDR, CDR and FRR. Four board members question the design,
// the player answers with choice cards, the board passes it (with actions).
// params: { projectId, review: 'PDR'|'CDR'|'FRR' }
(function () {
  const SMD = globalThis.SMD;
  const t = (k, e, p) => SMD.t(k, e, p);
  const esc = (s) => SMD.ui.esc(s == null ? '' : s);

  // One line each, from NASA's life cycle (NPR 7120.5 / Systems Engineering Handbook).
  const REVIEWS = {
    PDR: {
      name: () => t('review.PDR.name', 'Preliminary Design Review'),
      gate: () => t('review.PDR.gate', 'End of Phase B · preliminary design'),
      what: () => t('review.PDR.what', 'Is the design complete enough to commit to it? New technology should already be proven.'),
      next: () => t('review.PDR.next', 'Next: Phase C. The team finishes the detailed design and starts building flight hardware. The Critical Design Review comes later.'),
    },
    CDR: {
      name: () => t('review.CDR.name', 'Critical Design Review'),
      gate: () => t('review.CDR.gate', 'End of Phase C · final design'),
      what: () => t('review.CDR.what', 'Is the design mature enough to build and test the real spacecraft?'),
      next: () => t('review.CDR.next', 'Next: Phase D. Assembly, the test campaign and the trip to the launch site. Then the Flight Readiness Review.'),
    },
    FRR: {
      name: () => t('review.FRR.name', 'Flight Readiness Review'),
      gate: () => t('review.FRR.gate', 'End of Phase D · before launch'),
      what: () => t('review.FRR.what', 'Are the spacecraft and the team ready to fly? Every lead votes Go or No-Go.'),
      next: () => t('review.FRR.next', 'Next: the launch pad.'),
    },
  };

  // How each member reacts to an answer.
  const REACT = {
    science: {
      pleased: () => t('review.react.science.ok', 'Good. The science stays strong.'),
      concerned: () => t('review.react.science.risk', 'Understood. I hope the data forgives us.'),
    },
    systems: {
      pleased: () => t('review.react.systems.ok', 'That buys us margin. Thank you.'),
      concerned: () => t('review.react.systems.risk', 'Noted. We will watch it closely in flight.'),
    },
    budget: {
      pleased: () => t('review.react.budget.ok', 'That protects the budget.'),
      concerned: () => t('review.react.budget.risk', 'Then the reserve has to carry it.'),
    },
    safety: {
      pleased: () => t('review.react.safety.ok', 'Tested beats trusted. Good call.'),
      concerned: () => t('review.react.safety.risk', 'Risk accepted. It goes in the record.'),
    },
  };

  // Which member owns the risk a question is about.
  const OWNER = { power: 'systems', tests: 'safety', reserve: 'budget' };

  const hasEffect = (o) => !!(o && ((o.effects && Object.keys(o.effects).length) || o.runTests || o.mod));

  SMD.ui.screens.review = {
    render(app, params) {
      const C = SMD.cards;
      const A = SMD.agency;
      const ag = SMD.game.agency;
      const reviewId = REVIEWS[params.review] ? params.review : 'PDR';
      const R = REVIEWS[reviewId];
      const p = ag && ag.projects.find((x) => x.id === params.projectId);
      const timers = [];
      const later = (fn, ms) => timers.push(setTimeout(fn, ms));
      const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const pace = (ms) => (reduced ? Math.min(ms, 250) : ms);
      const back = () => SMD.go('hq', { resume: true });

      const top = `<header class="review-top">
          <span class="review-brand">${esc(t('review.brand', 'Every Kilogram'))}</span>
          <span class="review-crumb">${esc(t('review.crumb', 'Review board'))}</span>
          <span class="review-spacer"></span>
          ${ag ? `<span class="review-meta num">${esc(SMD.ui.monthYear(ag.now))}<span aria-hidden="true"> · </span><span class="card-sr">, </span>${esc(t('review.bank', 'Bank {m}', { m: SMD.ui.money(Math.round(ag.money)) }))}</span>` : ''}
        </header>`;

      // Nothing to review: say so and go back.
      if (!p || (p.reviews && p.reviews[reviewId])) {
        const msg = !p ? t('review.missing', 'This project could not be found.') : t('review.done', '{name} already passed its {review}.', { name: p.design.name, review: R.name() });
        app.innerHTML = `<main class="screen day review">${top}<div class="review-wrap review-empty">
            <h1 class="display review-name">${esc(R.name())}</h1><p class="review-what">${esc(msg)}</p>
            <div><button type="button" class="btn primary" data-back>${esc(t('review.back', 'Back to HQ'))}</button></div></div></main>`;
        app.querySelector('[data-back]').addEventListener('click', back);
        return () => timers.forEach(clearTimeout);
      }

      const m = SMD.data.MISSIONS[p.missionKey];
      const qs = A.reviewQuestions(ag, p, reviewId);
      const answers = {};
      const chosen = {};
      const accepted = {}; // who -> true when the player kept a risk in that member's area

      // Each member opens with the state of their area, from the design checks.
      const status = { science: null, systems: null, budget: null, safety: null };
      try {
        const pl = A.plan({ ...ag, now: p.startMs, projects: [] }, p.design, p.testPlan, p.confidence);
        const ck = Object.fromEntries(A.checks(ag, pl).map((c) => [c.id, c]));
        if (ck.data) status.science = { tone: ck.data.ok, text: ck.data.detail };
        if (ck.power) status.systems = { tone: ck.power.ok, text: ck.power.detail };
        if (ck.risk) status.safety = { tone: ck.risk.ok, text: ck.risk.detail };
      } catch (e) {}
      const resFrac = p.reserve > 0 ? p.reserveLeft / p.reserve : 1;
      status.budget = {
        tone: resFrac >= 0.5 ? 'ok' : resFrac >= 0.3 ? 'warn' : 'bad',
        text: t('review.status.reserve', '${left}M of ${all}M reserve left', { left: Math.round(p.reserveLeft), all: Math.round(p.reserve) }),
      };

      const moodFor = (who) => (status[who] && status[who].tone !== 'ok' ? 'concerned' : 'neutral');

      const members = C.ORDER.map((who, i) => {
        const M = C.MEMBERS[who];
        const st = status[who];
        return `<li class="review-member" data-who="${who}" style="--i:${i}">
            <div class="review-face">${C.portrait(who, moodFor(who))}<span class="review-vote" hidden></span></div>
            <div class="review-plate"><b>${esc(M.role())}</b><span>${esc(M.name())}</span></div>
            ${st ? `<p class="review-status"><span class="tone ${esc(st.tone)}"><span class="card-sr">${esc({ ok: t('review.tone.ok', 'Good'), warn: t('review.tone.warn', 'Watch'), bad: t('review.tone.bad', 'Problem') }[st.tone] || '')}: </span></span><span>${esc(st.text)}</span></p>` : ''}
          </li>`;
      }).join('');

      const reserveBar = (left, all) => {
        const f = all > 0 ? Math.max(0, Math.min(1, left / all)) : 0;
        return `<span class="review-bar" aria-hidden="true"><i style="inline-size:${(f * 100).toFixed(1)}%" class="${f < 0.3 ? 'is-low' : ''}"></i></span>`;
      };

      app.innerHTML = `<main class="screen day review" data-review="${reviewId}">
        ${top}
        <div class="review-wrap">
          <section class="review-hero">
            <div class="review-titles">
              <p class="review-gate">${esc(R.gate())}</p>
              <h1 class="display review-name">${esc(R.name())}</h1>
              <p class="review-what">${esc(R.what())}</p>
            </div>
            <aside class="review-project" aria-label="${esc(t('review.project', 'Project under review'))}">
              <div class="review-patch">${SMD.patch.patchSVG(p.design, { year: new Date(p.launchMs).getUTCFullYear() })}</div>
              <div class="review-project-info">
                <p class="review-project-name"><b>${esc(p.design.name)}</b><span>${esc(m ? t('mission.' + p.missionKey + '.title', m.title) : '')}</span></p>
                <p class="review-line"><span>${esc(t('review.reserve', 'Reserve'))}</span><b class="num">${esc(SMD.ui.money(Math.round(p.reserveLeft)))}</b>${reserveBar(p.reserveLeft, p.reserve)}</p>
                <p class="review-line"><span>${esc(t('review.launch', 'Launch'))}</span><b class="num">${esc(A.fmtMonth(p.launchMs))}</b></p>
              </div>
            </aside>
          </section>
          <section class="review-stage" aria-label="${esc(t('review.board', 'The review board'))}">
            <ol class="review-board">${members}</ol>
            <div class="review-table" aria-hidden="true"></div>
            <div class="review-bubble" style="--review-at:0">
              <div class="review-bubble-in" aria-live="polite"><p class="review-who">${esc(t('review.session', 'Standing review board'))}</p><p class="review-say">${esc(t('review.open', 'The board is in session.'))}</p></div>
            </div>
            <div class="review-choices" role="group"></div>
          </section>
          <section class="review-outcome" hidden aria-live="polite"></section>
        </div>
      </main>`;

      const stage = app.querySelector('.review-stage');
      const bubble = app.querySelector('.review-bubble');
      const bubbleIn = app.querySelector('.review-bubble-in');
      const choicesEl = app.querySelector('.review-choices');
      // After the screen unmounts a late callback may still ask; hand it a detached node.
      const memberEl = (who) => app.querySelector(`.review-member[data-who="${who}"]`) || document.createElement('div');
      const faceOf = (who) => memberEl(who).querySelector('.card-face') || document.createElement('div');

      function speaker(who) {
        const i = Math.max(0, C.ORDER.indexOf(who));
        bubble.style.setProperty('--review-at', i);
        app.querySelectorAll('.review-member').forEach((el) => el.classList.toggle('is-speaking', el.dataset.who === who));
        stage.classList.add('has-speaker');
      }

      function say(who, html, opts) {
        speaker(who);
        const M = C.MEMBERS[who] || C.MEMBERS.systems;
        bubble.classList.remove('is-in');
        void bubble.offsetWidth;
        bubble.classList.add('is-in');
        bubbleIn.innerHTML = `<p class="review-who"><b>${esc(M.name())}</b> · ${esc(M.role())}</p>${html}${opts && opts.progress ? progress(opts.progress) : ''}`;
      }

      function progress(i) {
        const n = qs.length;
        if (n < 2) return '';
        return `<p class="review-progress"><span>${esc(t('review.progress', 'Question {i} of {n}', { i: i, n }))}</span>
          <span class="review-dots" aria-hidden="true">${qs.map((_, k) => `<i class="${k < i - 1 ? 'is-done' : k === i - 1 ? 'is-now' : ''}"></i>`).join('')}</span></p>`;
      }

      function showChoices(q, idx) {
        choicesEl.setAttribute('aria-label', t('review.answer', 'Your answer'));
        choicesEl.innerHTML = q.options
          .map((o, i) => {
            const risky = !hasEffect(o) && q.options.length > 1 && q.id !== 'go';
            const fx =
              q.id === 'pass'
                ? [{ tone: 'ok', icon: 'launch', text: t('review.passOn', 'Straight on to the next phase') }]
                : q.id === 'go' && !hasEffect(o)
                ? [{ tone: 'ok', icon: 'launch', text: t('review.goOn', 'Launch in {month} as planned', { month: A.fmtMonth(p.launchMs) }) }]
                : C.effects(o.effects, p, { runTests: o.runTests, mod: o.mod });
            if (risky) fx.unshift({ tone: 'warn', icon: 'risk', text: t('review.riskStays', 'The risk stays') });
            return `<button type="button" class="card-choice review-choice" data-opt="${esc(o.id)}" style="--i:${i}">
              <span class="card-choice-key" aria-hidden="true">${i + 1}</span>
              <span class="card-choice-label">${esc(o.label)}</span>
              ${C.chipsHTML(fx)}
            </button>`;
          })
          .join('');
        choicesEl.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => answer(q, idx, b)));
        later(() => choicesEl.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }), 80);
      }

      function answer(q, idx, btn) {
        if (choicesEl.classList.contains('is-locked')) return;
        const o = q.options.find((x) => x.id === btn.dataset.opt);
        answers[q.id] = o.id;
        chosen[q.id] = o;
        choicesEl.classList.add('is-locked');
        choicesEl.querySelectorAll('[data-opt]').forEach((b) => {
          b.disabled = true;
          b.classList.toggle('is-chosen', b === btn);
          if (b === btn) b.setAttribute('aria-pressed', 'true');
        });
        if (SMD.audio) SMD.audio.beep(700, 0.08, 'triangle', 0.14);
        const kept = !hasEffect(o) && q.options.length > 1 && q.id !== 'go';
        const owner = OWNER[q.id] || q.who;
        if (kept) accepted[owner] = true;
        const mood = kept ? 'concerned' : 'pleased';
        const who = C.MEMBERS[q.who] ? q.who : 'systems';
        C.setMood(faceOf(who), mood);
        if (q.id === 'go' || q.id === 'pass') return later(finish, pace(500));
        say(who, `<p class="review-say review-react">${esc(REACT[who][mood]())}</p>`);
        later(() => ask(idx + 1), pace(1500));
      }

      function ask(idx) {
        const q = qs[idx];
        choicesEl.classList.remove('is-locked');
        if (!q) {
          // The FRR poll still happens when the Go question did not make the list.
          if (reviewId === 'FRR') return poll(null);
          return finish();
        }
        const who = C.MEMBERS[q.who] ? q.who : 'systems';
        C.ORDER.forEach((w) => w !== who && !accepted[w] && C.setMood(faceOf(w), moodFor(w)));
        if (q.id !== 'go' && q.id !== 'pass') C.setMood(faceOf(who), 'concerned');
        else C.setMood(faceOf(who), 'neutral');
        choicesEl.innerHTML = '';
        if (q.id === 'go') return poll(q, idx);
        say(who, `<p class="review-say">${esc(q.text)}</p>`, { progress: idx + 1 });
        later(() => showChoices(q, idx), pace(350));
      }

      // FRR: every lead votes, one after another, before the final call.
      function poll(q, idx) {
        const step = pace(720);
        const asker = q && C.MEMBERS[q.who] ? q.who : 'science';
        const head = q ? q.text : t('review.poll.ask', 'Final poll: every lead votes Go or No-Go.');
        say(asker, `<p class="review-say">${esc(head)}</p><ul class="review-poll" aria-label="${esc(t('review.poll.label', 'Votes'))}"></ul><p class="review-say review-final" hidden></p>`, q ? { progress: idx + 1 } : null);
        stage.classList.add('is-polling');
        const list = bubbleIn.querySelector('.review-poll');
        const final = bubbleIn.querySelector('.review-final');
        C.ORDER.forEach((who, k) => {
          later(() => {
            const M = C.MEMBERS[who];
            const caveat = accepted[who];
            const v = memberEl(who).querySelector('.review-vote');
            v.textContent = t('review.vote.go', 'Go');
            v.hidden = false;
            v.classList.toggle('is-caveat', !!caveat);
            C.setMood(faceOf(who), caveat ? 'concerned' : 'pleased');
            const li = document.createElement('li');
            li.innerHTML = `<b>${esc(M.role())}</b><span class="tone ${caveat ? 'warn' : 'ok'}">${esc(caveat ? t('review.vote.goRisk', 'Go, risk on the record') : t('review.vote.go', 'Go'))}</span>`;
            list.appendChild(li);
            if (SMD.audio) SMD.audio.beep(520 + k * 90, 0.1, 'sine', 0.14);
          }, step * (k + 1));
        });
        later(() => {
          final.textContent = t('review.poll.done', 'The board is Go. The final call is yours, director.');
          final.hidden = false;
          if (q) showChoices(q, idx);
          else finish();
        }, step * (C.ORDER.length + 1));
      }

      function finish() {
        const before = { money: ag.money, reserveLeft: p.reserveLeft, launchMs: p.launchMs, missed: !!p.missedWindow };
        const res = A.resolveReview(ag, p, reviewId, answers) || { notes: [] };
        SMD.game.save();
        if (SMD.bus) SMD.bus.emit('agency', ag);
        if (SMD.audio) SMD.audio.chime(true);
        showOutcome(before, res.notes || []);
      }

      function showOutcome(before, notes) {
        const actions = [];
        const risks = [];
        qs.forEach((q) => {
          const o = chosen[q.id];
          if (!o) return;
          if (hasEffect(o)) actions.push({ q, o });
          else if (q.options.length > 1 && q.id !== 'go') risks.push({ q, o });
        });
        const held = chosen.go && chosen.go.id !== 'go';
        const withActions = actions.length > 0 || notes.length > 0;
        const go = reviewId === 'FRR';
        const stamp = go ? (held ? t('review.stamp.hold', 'Hold, then Go') : t('review.stamp.go', 'Go for launch')) : withActions ? t('review.stamp.actions', 'Pass with actions') : t('review.stamp.pass', 'Pass');
        const title = go
          ? t('review.out.go', '{name} is cleared for launch', { name: p.design.name })
          : t('review.out.pass', '{name} passes its {review}', { name: p.design.name, review: R.name() });
        const nextLine = go ? `${R.next()} ${t('review.launchOn', 'Launch: {month}.', { month: A.fmtMonth(p.launchMs) })}` : R.next();

        C.ORDER.forEach((w) => C.setMood(faceOf(w), accepted[w] ? 'concerned' : 'pleased'));
        app.querySelectorAll('.review-member').forEach((el) => el.classList.remove('is-speaking'));
        stage.classList.remove('has-speaker', 'is-polling');
        stage.classList.add('is-done');
        bubble.hidden = true;
        choicesEl.hidden = true;

        const item = ({ q, o }) => `<li><p>${esc(o.label)}</p>${C.chipsHTML(C.effects(o.effects, null, { runTests: o.runTests, mod: o.mod }).filter((c) => c.icon !== 'none'))}</li>`;
        const filteredNotes = notes.filter((n) => !A.isSlipNote(n));
        const ledger = [];
        const dMoney = ag.money - before.money;
        ledger.push({ k: t('review.ledger.bank', 'Agency bank'), a: SMD.ui.money(Math.round(before.money)), b: SMD.ui.money(Math.round(ag.money)), tone: dMoney < -0.5 ? 'warn' : 'ok' });
        ledger.push({ k: t('review.ledger.reserve', 'Project reserve'), a: SMD.ui.money(Math.round(before.reserveLeft)), b: SMD.ui.money(Math.round(p.reserveLeft)), tone: p.reserveLeft < p.reserve * 0.3 ? 'bad' : p.reserveLeft < before.reserveLeft - 0.5 ? 'warn' : 'ok' });
        ledger.push({
          k: t('review.ledger.launch', 'Launch'),
          a: A.fmtMonth(before.launchMs),
          b: A.fmtMonth(p.launchMs),
          tone: p.missedWindow && !before.missed ? 'bad' : p.launchMs !== before.launchMs ? 'warn' : 'ok',
        });

        const out = app.querySelector('.review-outcome');
        out.hidden = false;
        out.innerHTML = `<div class="review-stamp ${withActions || held ? 'is-actions' : 'is-pass'}" aria-hidden="true"><span>${esc(stamp)}</span><small>${esc(reviewId)} · ${esc(A.fmtMonth(ag.now))}</small></div>
          <div class="review-outcome-body">
            <p class="review-gate">${esc(t('review.out.kicker', '{review} · board decision', { review: reviewId }))}</p>
            <h2 class="review-out-title">${esc(title)}</h2>
            <p class="review-next">${esc(nextLine)}</p>
            ${
              actions.length || risks.length
                ? `<div class="review-cols">
              ${actions.length ? `<div><h3>${esc(t('review.out.actions', 'Actions you signed'))}</h3><ul class="review-list">${actions.map(item).join('')}</ul></div>` : ''}
              ${risks.length ? `<div><h3>${esc(t('review.out.risks', 'Risks on the record'))}</h3><ul class="review-list is-risk">${risks.map(({ o }) => `<li><p>${esc(o.label)}</p></li>`).join('')}</ul></div>` : ''}
            </div>`
                : `<p class="review-clean">${esc(t('review.out.clean', 'No actions. The board found nothing to fix.'))}</p>`
            }
            ${filteredNotes.length ? `<ul class="card-notes">${filteredNotes.map((n) => `<li class="tone bad">${esc(n)}</li>`).join('')}</ul>` : ''}
            <dl class="review-ledger">${ledger
              .map(
                (l) => `<div class="is-${l.tone}"><dt>${esc(l.k)}</dt><dd class="num">${l.a === l.b ? `<b>${esc(l.b)}</b>` : `<s>${esc(l.a)}</s><span aria-hidden="true" class="review-arrow">→</span><span class="card-sr"> ${esc(t('review.to', 'to'))} </span><b>${esc(l.b)}</b>`}</dd></div>`
              )
              .join('')}</dl>
            <div class="review-actions"><button type="button" class="btn primary" data-back>${esc(t('review.back', 'Back to HQ'))}</button></div>
          </div>`;
        const btn = out.querySelector('[data-back]');
        btn.addEventListener('click', back);
        later(() => {
          btn.focus({ preventScroll: true });
          out.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
        }, 60);
      }

      // Number keys answer, like the event cards.
      function onKey(e) {
        if (e.altKey || e.ctrlKey || e.metaKey || document.body.classList.contains('card-open')) return;
        const n = Number(e.key);
        if (!(n >= 1)) return;
        const b = choicesEl.querySelectorAll('[data-opt]:not(:disabled)')[n - 1];
        if (b) {
          e.preventDefault();
          b.click();
        }
      }
      document.addEventListener('keydown', onKey);

      later(() => ask(0), pace(700));

      return () => {
        timers.forEach(clearTimeout);
        document.removeEventListener('keydown', onKey);
      };
    },
  };
})();
