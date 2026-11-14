// The astronaut creator: you are the agency director, and you fly too.
// A 3D turntable of your astronaut, every appearance option, your rank and
// badges, then on to params.next (default the HQ).
//   SMD.go('avatar', { next: 'hq', nextParams: {...}, back: 'hq' })
//
// Crew mode (docs/TEAM-V3.md item 8): render(el, { mode: 'crew', crew: { name,
// job, look }, onSave(d), onCancel() }) draws the same creator inside any element
// (crew.openCreator puts it in an overlay above the team screen) for your own
// astronaut in a mission: name, job, build, beard and the look, no career.
// onSave gets { name, job, look }.
(function () {
  const SMD = globalThis.SMD;
  const t = (k, e, p) => SMD.t(k, e, p);
  const esc = (s) => SMD.ui.esc(s);

  // Small hair icons for the style buttons.
  const HAIR_ICON = {
    short: '<circle cx="12" cy="13" r="7" fill="var(--skin)"/><path d="M5 12a7 7 0 0 1 14 0c-2-3-5-2-7-3-2 1-5 0-7 3z" fill="currentColor"/>',
    curly: '<circle cx="12" cy="13" r="7" fill="var(--skin)"/><g fill="currentColor"><circle cx="7" cy="9" r="2.6"/><circle cx="10.5" cy="6.5" r="2.6"/><circle cx="14.5" cy="6.6" r="2.6"/><circle cx="17.5" cy="9.5" r="2.6"/><circle cx="5.8" cy="12.5" r="2"/><circle cx="18.4" cy="13" r="2"/></g>',
    bun: '<circle cx="12" cy="13" r="7" fill="var(--skin)"/><circle cx="12" cy="4.6" r="3" fill="currentColor"/><path d="M5 12a7 7 0 0 1 14 0c-3-2-11-2-14 0z" fill="currentColor"/>',
    covered: '<path d="M3.5 22c0-6 1.5-16 8.5-16s8.5 10 8.5 16z" fill="currentColor"/><ellipse cx="12" cy="13.5" rx="5" ry="6" fill="var(--skin)"/>',
    helmet: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.5 11a6.5 5 0 0 1 13 0v2a6.5 5 0 0 1-13 0z" fill="currentColor" opacity=".55"/>',
  };

  SMD.ui.screens.avatar = {
    render(app, params) {
      const A = SMD.avatar;
      const crewMode = params.mode === 'crew';
      const ag = crewMode ? null : SMD.game && SMD.game.agency;
      const editing = !!(ag && ag.avatar);
      const next = params.next || 'hq';
      const C = SMD.team && SMD.team.crew;
      const JOBS = ['planner', 'engineer', 'scientist', 'comms'];
      // Crew mode keeps the job, build and beard next to the appearance.
      const startCrew = crewMode ? params.crew || {} : null;
      const st = crewMode ? Object.assign(A.normalize(Object.assign({}, startCrew.look || {}, { name: startCrew.name || '' })), crewExtras(startCrew)) : A.get();
      if (crewMode && !startCrew.name) st.name = '';
      function crewExtras(c) {
        const look = c.look || {};
        return {
          job: JOBS.includes(c.job) ? c.job : 'planner',
          body: look.body === 'f' || look.body === 'm' ? look.body : look.hair === 'bun' || look.hair === 'covered' ? 'f' : 'm',
          beard: ['none', 'stubble', 'full'].includes(look.beard) ? look.beard : 'none',
        };
      }
      // What the 3D model and the 2D fallback draw.
      const look3d = () => (crewMode ? Object.assign({}, st, { name: st.name || ' ', beard: st.beard === 'none' ? null : st.beard, height: st.body === 'f' ? 1.67 : 1.78 }) : st);
      const jobName = (j) => (C && C.jobName ? C.jobName(j) : j);
      const cleanups = [];
      let alive = true;
      let stage3d = null;
      let fallback = null;
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // ---------- Markup ----------
      const swatches = (name, list, value, colorOf, label) =>
        `<div class="av-swatches" role="group" aria-label="${esc(label)}">${list
          .map((o) => {
            const c = colorOf(o);
            return `<button type="button" class="av-swatch${c.c2 ? ' is-two' : ''}" data-opt="${name}" data-value="${esc(o.id)}" style="--c:${esc(c.c)};--c2:${esc(c.c2 || c.c)}" aria-pressed="${o.id === value}" aria-label="${esc(o.name())}" title="${esc(o.name())}"></button>`;
          })
          .join('')}</div>`;
      const seg = (name, list, value, label, icon) =>
        `<div class="seg av-seg" role="group" aria-label="${esc(label)}">${list
          .map((o) => `<button type="button" data-opt="${name}" data-value="${esc(o.id)}" aria-pressed="${o.id === value}">${icon ? `<svg viewBox="0 0 24 24" aria-hidden="true">${icon(o)}</svg>` : ''}<span>${esc(o.name())}</span></button>`)
          .join('')}</div>`;

      function controlsHTML() {
        const skin = A.colors(st).skin;
        const hasMission = !!A.patchDesign(ag);
        const hairHidden = st.hair === 'covered' || st.hair === 'helmet';
        return `
          <div class="av-field">
            <label for="av-name">${esc(crewMode ? t('avatar.crew.name', 'Your astronaut’s name') : t('avatar.name', 'Name on your suit'))}</label>
            <input id="av-name" class="av-input" type="text" maxlength="24" autocomplete="off" spellcheck="false" value="${esc(st.name)}"${crewMode ? ` placeholder="${esc(t('avatar.crew.namehint', 'Type a name'))}"` : ''} />
          </div>
          ${crewMode ? crewFieldsHTML() : ''}
          <fieldset class="av-field" data-focus="body">
            <legend>${esc(t('avatar.suit', 'Suit'))}</legend>
            ${swatches('suit', A.SUITS, st.suit, (o) => ({ c: o.body, c2: o.accent }), t('avatar.suit', 'Suit'))}
          </fieldset>
          <fieldset class="av-field" data-focus="face">
            <legend>${esc(t('avatar.skin', 'Skin tone'))}</legend>
            ${swatches('skin', A.SKINS, st.skin, (o) => ({ c: o.color }), t('avatar.skin', 'Skin tone'))}
          </fieldset>
          <fieldset class="av-field" data-focus="face">
            <legend>${esc(t('avatar.hair', 'Hair and headwear'))}</legend>
            <div style="--skin:${esc(skin)}">${seg('hair', A.HAIR, st.hair, t('avatar.hair', 'Hair and headwear'), (o) => HAIR_ICON[o.id] || '')}</div>
          </fieldset>
          <fieldset class="av-field" data-focus="face">
            <legend>${esc(t('avatar.hairColor', 'Hair colour'))}</legend>
            ${swatches('hairColor', A.HAIR_COLORS, st.hairColor, (o) => ({ c: o.color }), t('avatar.hairColor', 'Hair colour'))}
            ${hairHidden ? `<span class="hint">${esc(st.hair === 'covered' ? t('avatar.hairColor.covered', 'Your brows show it; the scarf covers the rest.') : t('avatar.hairColor.helmet', 'Under the helmet only your brows show it.'))}</span>` : ''}
          </fieldset>
          <fieldset class="av-field" data-focus="face">
            <legend>${esc(t('avatar.visor', 'Helmet visor'))}</legend>
            ${seg('visor', A.VISORS, st.visor, t('avatar.visor', 'Helmet visor'))}
            <span class="hint">${esc(t('avatar.visor.hint', 'The gold coating keeps the Sun’s glare off your eyes on a spacewalk.'))}</span>
          </fieldset>
          <fieldset class="av-field" data-focus="patch">
            <legend>${esc(t('avatar.patch', 'Shoulder patch'))}</legend>
            ${crewMode ? '' : seg('patch', A.PATCHES, st.patch, t('avatar.patch', 'Shoulder patch'))}
            ${hasMission || crewMode ? '' : `<span class="hint">${esc(t('avatar.patch.none', 'Your latest mission patch appears once a mission is approved.'))}</span>`}
            ${swatches('patchColor', A.PATCH_COLORS, st.patchColor, (o) => ({ c: o.id }), t('avatar.patchColor', 'Patch colour'))}
            ${st.hair === 'covered' ? `<span class="hint">${esc(t('avatar.patchColor.scarf', 'Your headscarf takes this colour too.'))}</span>` : ''}
          </fieldset>`;
      }

      // Crew mode: the job (the part of the ship you build), the build and a beard.
      function crewFieldsHTML() {
        const jobs = JOBS.map(
          (j) => `<button type="button" data-opt="job" data-value="${j}" aria-pressed="${st.job === j}"><i class="av-jobdot" style="background:var(--role-${j}, #93b4ff)" aria-hidden="true"></i><span>${esc(jobName(j))}</span></button>`
        ).join('');
        const BODIES = [{ id: 'm', name: () => t('avatar.crew.body.m', 'Broad') }, { id: 'f', name: () => t('avatar.crew.body.f', 'Slim') }];
        const BEARDS = [{ id: 'none', name: () => t('avatar.crew.beard.none', 'None') }, { id: 'stubble', name: () => t('avatar.crew.beard.stubble', 'Stubble') }, { id: 'full', name: () => t('avatar.crew.beard.full', 'Full') }];
        return `<fieldset class="av-field av-jobs" data-focus="body">
            <legend>${esc(t('avatar.crew.job', 'Your job'))}</legend>
            <div class="seg av-seg av-jobseg" role="group" aria-label="${esc(t('avatar.crew.job', 'Your job'))}">${jobs}</div>
            <span class="hint">${esc(t('avatar.crew.jobhint', 'Your job is the part of the ship you build. The crewmate who usually does it stays on Earth this time.'))}</span>
          </fieldset>
          <fieldset class="av-field" data-focus="body">
            <legend>${esc(t('avatar.crew.body', 'Build'))}</legend>
            ${seg('body', BODIES, st.body, t('avatar.crew.body', 'Build'))}
          </fieldset>
          <fieldset class="av-field" data-focus="face">
            <legend>${esc(t('avatar.crew.beard', 'Beard'))}</legend>
            ${seg('beard', BEARDS, st.beard, t('avatar.crew.beard', 'Beard'))}
          </fieldset>`;
      }

      function careerHTML() {
        const ev = A.evaluate(ag);
        const ranks = A.RANKS.map((r, i) => {
          const cls = i < ev.rankIndex ? 'is-done' : i === ev.rankIndex ? 'is-now' : '';
          return `<li class="${cls}"${i === ev.rankIndex ? ' aria-current="step"' : ''}><span class="av-rank-dot" aria-hidden="true"></span>${esc(r.name())}</li>`;
        }).join('');
        const badges = ev.all
          .map(
            (b) => `<li class="av-badge${b.earned ? ' is-earned' : ''}">
              ${A.badgeSVG(b.id, b.earned, b.earned ? b.name : t('avatar.badge.locked', 'Not earned yet: {name}', { name: b.name }))}
              <span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></span>
            </li>`
          )
          .join('');
        return `
          <p class="av-kicker">${esc(t('avatar.rank.kicker', 'Your rank'))}</p>
          <h2 id="av-rank-h" class="av-rank">${esc(ev.rank.name)}</h2>
          <ol class="av-ranks" aria-label="${esc(t('avatar.rank.ladder', 'Ranks, from candidate to legend'))}">${ranks}</ol>
          <p class="av-next">${ev.nextRank ? esc(t('avatar.rank.next', 'Next: {rank}. {need}', { rank: ev.nextRank.name, need: ev.nextRank.need })) : esc(t('avatar.rank.top', 'The highest rank there is. The agency will be remembered.'))}</p>
          <h3 class="av-badges-h">${esc(t('avatar.badges', 'Badges'))} <span class="num">${ev.badges.length}/${ev.all.length}</span></h3>
          <ul class="av-badges">${badges}</ul>`;
      }

      app.innerHTML = `<main class="screen day av${crewMode ? ' av-crew' : ''}">
        <div class="av-wrap">
          <header class="av-head">
            <p class="av-kicker">${esc(crewMode ? t('avatar.crew.kicker', 'Your astronaut') : t('avatar.kicker', 'Agency director, and astronaut'))}</p>
            <h1 class="display av-title">${esc(crewMode ? t('avatar.crew.title', 'Create your astronaut') : editing ? t('avatar.title.edit', 'Your astronaut') : t('avatar.title', 'Suit up'))}</h1>
            <p class="av-lede">${esc(crewMode ? t('avatar.crew.lede', 'Choose a name, a job and a look. You fly this mission with the other three.') : t('avatar.lede', 'You run the agency and you fly with it. This is you: walking the campus, standing beside every spacecraft you build, and watching every launch.'))}</p>
          </header>
          <section class="av-stage-wrap" aria-label="${esc(t('avatar.stage', 'Preview'))}">
            <div class="av-stage" data-stage tabindex="0" role="img" aria-label="${esc(t('avatar.stage.a', 'Your astronaut in 3D. Drag, or use the arrow keys, to turn it.'))}"></div>
            <canvas class="av-fallback" data-fallback width="480" height="480" hidden aria-hidden="true"></canvas>
            <p class="av-plate"><b data-pname></b><span data-prank></span></p>
            <div class="av-poses" role="group" aria-label="${esc(t('avatar.poses', 'Try a move'))}">
              <button type="button" class="btn small ghost" data-act="wave">${esc(t('avatar.pose.wave', 'Wave'))}</button>
              <button type="button" class="btn small ghost" data-act="celebrate">${esc(t('avatar.pose.celebrate', 'Jump for joy'))}</button>
              <button type="button" class="btn small ghost" data-act="walk" aria-pressed="false">${esc(t('avatar.pose.walk', 'Walk'))}</button>
            </div>
          </section>
          <form class="av-controls" novalidate data-controls></form>
          ${crewMode ? '' : '<section class="av-career" aria-labelledby="av-rank-h" data-career></section>'}
          <div class="av-actions">
            <button type="button" class="btn ghost" data-act="random">${esc(t('avatar.random', 'Random'))}</button>
            <span class="av-actions-gap"></span>
            ${editing || params.back || crewMode ? `<button type="button" class="btn ghost" data-act="cancel">${esc(t('avatar.cancel', 'Cancel'))}</button>` : ''}
            <button type="button" class="btn primary" data-act="confirm">${esc(crewMode ? t('avatar.crew.save', 'Save and fly as this astronaut') : next === 'hq' ? t('avatar.confirm.hq', 'Suit up and go to HQ') : t('avatar.confirm', 'Suit up'))}</button>
          </div>
        </div>
      </main>`;

      const $ = (s) => app.querySelector(s);
      const stage = $('[data-stage]');
      const controls = $('[data-controls]');
      const career = $('[data-career]');

      function paintControls() {
        const active = document.activeElement;
        const restore = active && controls.contains(active) ? { opt: active.dataset.opt, value: active.dataset.value, id: active.id } : null;
        controls.innerHTML = controlsHTML();
        if (restore) {
          const el = restore.id ? controls.querySelector('#' + restore.id) : controls.querySelector(`[data-opt="${restore.opt}"][data-value="${CSS.escape(restore.value || '')}"]`);
          if (el) el.focus({ preventScroll: true });
        }
      }
      function paintCareer() {
        if (career) career.innerHTML = careerHTML();
      }
      function paintPlate() {
        $('[data-pname]').textContent = st.name || (crewMode ? t('avatar.crew.noname', 'Your astronaut') : '');
        $('[data-prank]').textContent = crewMode ? jobName(st.job) : A.evaluate(ag).rank.name;
      }
      function paintFallback() {
        if (!fallback) return;
        // Crew mode draws the same calm portrait as the crew cards.
        if (crewMode && C && C.makeCustom) {
          fallback.hidden = true;
          let box = app.querySelector('[data-face2d]');
          if (!box) {
            box = document.createElement('div');
            box.className = 'av-face2d';
            box.dataset.face2d = '1';
            fallback.after(box);
          }
          box.innerHTML = C.portrait(C.makeCustom(st.name, st.job, st), { size: 260 });
          return;
        }
        import(new URL('js/3d/astronaut.js', document.baseURI).href)
          .then((m) => m.drawPortrait2D(fallback, st))
          .catch(() => {});
      }

      // ---------- Changes ----------
      let helmetTimer = 0;
      function changed(opt) {
        Object.assign(st, A.normalize(st));
        // normalize() fills an empty name with the default: crew mode keeps what was typed.
        if (crewMode) st.name = (($('#av-name') || {}).value || '').trim();
        if (stage3d) {
          stage3d.setAppearance(look3d());
          // Visor changes show the helmet for a moment even with the hair out.
          if (opt === 'visor' && st.hair !== 'helmet') {
            stage3d.astro.setHelmet(true);
            clearTimeout(helmetTimer);
            helmetTimer = setTimeout(() => alive && stage3d && stage3d.astro.setHelmet(null), 3200);
          } else if (opt === 'hair') {
            clearTimeout(helmetTimer);
            stage3d.astro.setHelmet(null);
          }
        }
        paintFallback();
        paintPlate();
      }
      cleanups.push(() => clearTimeout(helmetTimer));

      controls.addEventListener('click', (e) => {
        const b = e.target.closest('[data-opt]');
        if (!b) return;
        const opt = b.dataset.opt;
        st[opt] = b.dataset.value;
        const focus = b.closest('[data-focus]');
        if (stage3d && focus) stage3d.focus(focus.dataset.focus);
        changed(opt);
        paintControls();
      });
      let nameTimer = 0;
      controls.addEventListener('input', (e) => {
        if (e.target.id !== 'av-name') return;
        st.name = e.target.value;
        $('[data-pname]').textContent = e.target.value.trim() || (crewMode ? t('avatar.crew.noname', 'Your astronaut') : A.default().name);
        e.target.removeAttribute('aria-invalid');
        clearTimeout(nameTimer);
        nameTimer = setTimeout(() => {
          if (!alive) return;
          if (stage3d) stage3d.setAppearance(Object.assign({}, look3d()));
          if (crewMode) paintFallback();
        }, 250);
      });
      controls.addEventListener('focusin', (e) => {
        if (!stage3d) return;
        if (e.target.id === 'av-name') stage3d.focus('body');
      });
      controls.addEventListener('submit', (e) => e.preventDefault());
      cleanups.push(() => clearTimeout(nameTimer));

      app.querySelector('.av-poses').addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || !stage3d) return;
        stage3d.focus('body');
        const walking = stage3d.act(b.dataset.act);
        app.querySelector('.av-poses [data-act="walk"]').setAttribute('aria-pressed', String(!!walking));
      });

      stage.addEventListener('keydown', (e) => {
        if (!stage3d) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          stage3d.turn((e.key === 'ArrowLeft' ? -1 : 1) * (SMD.dir() === 'rtl' ? -1 : 1) * 0.35);
        }
      });

      $('.av-actions').addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'random') {
          Object.assign(st, A.random(), { name: st.name });
          if (crewMode) {
            st.body = Math.random() < 0.5 ? 'f' : 'm';
            st.beard = st.body === 'm' && Math.random() < 0.4 ? (Math.random() < 0.5 ? 'stubble' : 'full') : 'none';
          }
          if (stage3d) {
            stage3d.focus('body');
            stage3d.astro.setHelmet(null);
            if (!reduced) stage3d.act('celebrate');
          }
          changed('random');
          paintControls();
        } else if (act === 'confirm' && crewMode) {
          const nameNow = String(($('#av-name') || {}).value || st.name || '').trim();
          if (!nameNow) {
            const inp = $('#av-name');
            if (inp) {
              inp.focus();
              inp.setAttribute('aria-invalid', 'true');
            }
            return;
          }
          if (SMD.audio && SMD.audio.chime) SMD.audio.chime(true);
          const look = { suit: st.suit, skin: st.skin, hair: st.hair, hairColor: st.hairColor, visor: st.visor, patchColor: st.patchColor, body: st.body, beard: st.beard };
          if (typeof params.onSave === 'function') params.onSave({ name: nameNow, job: st.job, look });
        } else if (act === 'cancel' && crewMode) {
          if (typeof params.onCancel === 'function') params.onCancel();
        } else if (act === 'confirm') {
          A.set(st);
          if (SMD.audio && SMD.audio.chime) SMD.audio.chime(true);
          SMD.go(next, params.nextParams || {});
        } else if (act === 'cancel') {
          SMD.go(params.back || next, params.backParams || {});
        }
      });

      const offLang = SMD.bus && !crewMode ? SMD.bus.on('lang', () => SMD.go('avatar', params)) : null;
      if (offLang) cleanups.push(offLang);

      paintControls();
      paintCareer();
      paintPlate();

      // ---------- 3D turntable ----------
      // Crew mode opens over another screen: if a 3D scene is already running
      // there, keep it and show the 2D portrait instead.
      const E0 = SMD.three && SMD.three.engine;
      const busy = crewMode && E0 && E0.debug && E0.debug.current;
      const E = busy ? null : E0;
      const noGL = () => {
        fallback = $('[data-fallback]');
        fallback.hidden = false;
        app.querySelector('.av-poses').hidden = true;
        stage.setAttribute('aria-hidden', 'true');
        stage.removeAttribute('tabindex');
        paintFallback();
      };
      if (E && E.supported && E.supported()) {
        import(new URL('js/3d/astronaut.js', document.baseURI).href)
          .then((m) => {
            if (!alive) return;
            stage3d = m.createAvatarStage(look3d(), { el: stage });
            E.mount(stage, stage3d);
            // Say hello once it is on screen.
            if (!reduced) setTimeout(() => alive && stage3d && stage3d.act('wave'), 700);
          })
          .catch((err) => {
            console.warn('Astronaut preview unavailable', err);
            noGL();
          });
      } else noGL();

      return () => {
        alive = false;
        cleanups.forEach((fn) => fn());
        if (E && stage3d) E.stop();
        stage3d = null;
      };
    },
  };
})();
