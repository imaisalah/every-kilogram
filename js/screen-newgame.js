// New agency: name it, pick the patch colour and a motto, read the goal and
// the life cycle in one glance, then open HQ.
(function () {
  const SMD = globalThis.SMD;
  const { ui } = SMD;
  const t = (k, e, p) => SMD.t(k, e, p);
  const esc = (s) => ui.esc(s);

  const COLORS = [
    { id: '#17807a', name: () => t('ng.c.nile', 'Nile teal') },
    { id: '#24539a', name: () => t('ng.c.lapis', 'Lapis blue') },
    { id: '#b4302c', name: () => t('ng.c.red', 'Red pen') },
    { id: '#5b4a8a', name: () => t('ng.c.dusk', 'Dusk violet') },
    { id: '#4f7a32', name: () => t('ng.c.palm', 'Palm green') },
    { id: '#23282e', name: () => t('ng.c.graphite', 'Graphite') },
  ];
  const MOTTOS = [
    () => t('ng.m.1', 'Every kilogram counts.'),
    () => t('ng.m.2', 'From the Nile to the planets.'),
    () => t('ng.m.3', 'Measure twice, launch once.'),
  ];

  // The agency patch: a pyramid under an orbit, the agency name stitched around it.
  function agencyPatch(name, color, motto) {
    const id = 'ng' + Math.random().toString(36).slice(2, 7);
    const nm = String(name || '').toUpperCase().slice(0, 32);
    return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(t('ng.patchA', 'Agency patch'))}">
      <defs><path id="${id}t" d="M 100 100 m -78 0 a 78 78 0 1 1 156 0"/><path id="${id}b" d="M 100 100 m -84 0 a 84 84 0 0 0 168 0"/>
      <clipPath id="${id}c"><circle cx="100" cy="100" r="62"/></clipPath></defs>
      <circle cx="100" cy="100" r="98" fill="#d9a21b"/>
      <circle cx="100" cy="100" r="93" fill="none" stroke="#7a5a0c" stroke-width="1.2" stroke-dasharray="2.2 1.6"/>
      <circle cx="100" cy="100" r="64" fill="${esc(color)}" stroke="#7a5a0c" stroke-width="1.5"/>
      <g clip-path="url(#${id}c)">
        <rect x="30" y="118" width="140" height="50" fill="#e9c58c"/>
        <path d="M30 128 q35 -8 70 0 t70 0 v40 h-140z" fill="#3f7fa8" opacity=".9"/>
        <path d="M60 122 L100 62 L140 122 Z" fill="#f4e4b5"/><path d="M100 62 L140 122 L114 122 Z" fill="#000" opacity=".18"/>
        <circle cx="100" cy="100" r="62" fill="none" stroke="#000" stroke-opacity=".15" stroke-width="6"/>
      </g>
      <ellipse cx="100" cy="98" rx="74" ry="22" transform="rotate(-16 100 98)" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 4"/>
      <circle cx="164" cy="78" r="6" fill="#fff"/><circle cx="164" cy="78" r="2.6" fill="#d9a21b"/>
      <text font-family="Archivo, 'Arial Narrow', sans-serif" font-weight="800" font-size="14" letter-spacing="1.6" fill="#14273c"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${esc(nm)}</textPath></text>
      <text font-family="Archivo, 'Arial Narrow', sans-serif" font-weight="700" font-size="10.5" letter-spacing="2.4" fill="#14273c" dy="8"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${esc(t('ng.est', 'EST. 2027'))}</textPath></text>
    </svg>`;
  }

  ui.screens.newgame = {
    render(app) {
      const st = { name: t('ng.default', 'Nile Space Agency'), color: COLORS[0].id, motto: 0, custom: '' };
      const mottoText = () => (st.motto === 'custom' ? st.custom.trim() : MOTTOS[st.motto]());

      function html() {
        return `<main class="screen ng">
        <div class="ng-wrap">
          <header class="ng-head">
            <div><p class="ng-kicker">${t('ng.kicker', 'January 2027 · a new space agency')}</p>
            <h1 class="display ng-title">${t('ng.title', 'Found your agency')}</h1></div>
            <button type="button" class="btn ghost small" data-act="lang" lang="${SMD.lang() === 'ar' ? 'en' : 'ar'}">${SMD.lang() === 'ar' ? 'English' : 'العربية'}</button>
          </header>
          <form class="ng-form" novalidate>
            <div class="ng-field">
              <label for="ng-name">${t('ng.name', 'Agency name')}</label>
              <input id="ng-name" class="ng-input" type="text" maxlength="32" autocomplete="off" spellcheck="false" value="${esc(st.name)}" />
              <span class="hint">${t('ng.name.hint', 'It goes on every mission patch you fly.')}</span>
            </div>
            <fieldset class="ng-field">
              <legend>${t('ng.color', 'Patch colour')}</legend>
              <div class="ng-swatches">${COLORS.map((c) => `<button type="button" class="ng-swatch" style="--c:${c.id}" data-color="${c.id}" aria-pressed="${c.id === st.color}" aria-label="${esc(c.name())}" title="${esc(c.name())}"></button>`).join('')}</div>
            </fieldset>
            <fieldset class="ng-field">
              <legend>${t('ng.motto', 'Motto')}</legend>
              <div class="ng-mottos">
                ${MOTTOS.map((m, i) => `<button type="button" class="ng-motto" data-motto="${i}" aria-pressed="${st.motto === i}">${esc(m())}</button>`).join('')}
                <input class="ng-input ng-custom" type="text" maxlength="40" placeholder="${esc(t('ng.motto.own', 'Or write your own'))}" value="${esc(st.custom)}" aria-label="${esc(t('ng.motto.ownA', 'Your own motto'))}" />
              </div>
            </fieldset>
            <div class="ng-actions">
              <button type="submit" class="btn primary">${t('ng.start', 'Open the agency')}</button>
              <button type="button" class="btn ghost" data-act="back">${t('ng.back', 'Back')}</button>
            </div>
          </form>
          <div class="ng-side">
            <div class="ng-preview" aria-live="polite">
              <div data-patch>${agencyPatch(st.name, st.color)}</div>
              <p class="ng-pname" data-pname>${esc(st.name)}</p>
              <p class="ng-pmotto" data-pmotto>${esc(mottoText())}</p>
            </div>
            <section class="ng-brief" aria-labelledby="ng-goal-h">
              <h2 id="ng-goal-h">${t('ng.goal.h', 'Your goal: three headlines by 2036')}</h2>
              <p>${t('ng.goal.b', 'The world will remember your agency for three answers. Earn the headline science on each before the end of 2036.')}</p>
              <ul class="ng-goal">
                <li><span class="hq-planet mars" aria-hidden="true"></span>${t('ng.goal.mars', 'Mars: buried ice')}</li>
                <li><span class="hq-planet venus" aria-hidden="true"></span>${t('ng.goal.venus', 'Venus: still erupting?')}</li>
                <li><span class="hq-planet jupiter" aria-hidden="true"></span>${t('ng.goal.europa', 'Europa: how thick is the ice?')}</li>
              </ul>
              <p class="small muted">${esc(t('ng.start.b2', 'You start with {m}, {n} engineering teams and ten years. Earth missions earn the reputation and money that open the planets.', { m: ui.money(SMD.data.CAREER.startMoney), n: SMD.data.CAREER.startTeams }))}</p>
            </section>
            <section class="ng-brief" aria-labelledby="ng-cycle-h">
              <h2 id="ng-cycle-h">${t('ng.cycle.h', 'Every mission follows NASA’s life cycle')}</h2>
              <ol class="ng-steps">
                <li style="--c:var(--gold)"><abbr>${t('ng.s1.ph', 'Pre-A')}</abbr><b>${t('ng.s1', 'Propose')}</b>${t('ng.s1.b', 'Answer an Announcement of Opportunity.')}</li>
                <li style="--c:var(--graphite-2)"><abbr>${t('ng.s2.ph', 'Phase A')}</abbr><b>${t('ng.s2', 'Design')}</b>${t('ng.s2.b', 'Every kilogram costs fuel, money and risk.')}</li>
                <li style="--c:var(--graphite)"><abbr>${t('ng.s3.ph', 'Phases B–D')}</abbr><b>${t('ng.s3', 'Build and review')}</b>${t('ng.s3.b', 'Pass PDR, CDR and the Flight Readiness Review.')}</li>
                <li style="--c:var(--teal)"><abbr>${t('ng.s4.ph', 'Phases E–F')}</abbr><b>${t('ng.s4', 'Fly and learn')}</b>${t('ng.s4.b', 'Launch on time, do the science, see what each choice did.')}</li>
              </ol>
            </section>
          </div>
        </div>
      </main>`;
      }

      function paint() {
        app.innerHTML = html();
        bind();
      }

      function refreshPreview() {
        app.querySelector('[data-patch]').innerHTML = agencyPatch(st.name || t('ng.default', 'Nile Space Agency'), st.color);
        app.querySelector('[data-pname]').textContent = st.name || t('ng.default', 'Nile Space Agency');
        app.querySelector('[data-pmotto]').textContent = mottoText();
      }

      function start() {
        const name = (st.name || '').trim() || t('ng.default', 'Nile Space Agency');
        const ag = SMD.game.newGame(name);
        ag.patch = { color: st.color, motto: mottoText() };
        SMD.game.pending = [];
        try {
          localStorage.removeItem('ek-hq-coach');
        } catch (e) {}
        SMD.game.save();
        if (SMD.audio && SMD.audio.chime) SMD.audio.chime(true);
        // Suit up first: the director is also the agency's astronaut. The
        // creator saves the look and goes on to the HQ (and its tour).
        if (SMD.ui.screens.avatar && SMD.avatar) SMD.go('avatar', { next: 'hq' });
        else SMD.go('hq');
      }

      function bind() {
        const input = app.querySelector('#ng-name');
        input.addEventListener('input', () => {
          st.name = input.value;
          refreshPreview();
        });
        app.querySelectorAll('[data-color]').forEach((b) =>
          b.addEventListener('click', () => {
            st.color = b.dataset.color;
            app.querySelectorAll('[data-color]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            refreshPreview();
          })
        );
        const custom = app.querySelector('.ng-custom');
        const setMotto = (m) => {
          st.motto = m;
          app.querySelectorAll('[data-motto]').forEach((x) => x.setAttribute('aria-pressed', String(String(m) === x.dataset.motto)));
          refreshPreview();
        };
        app.querySelectorAll('[data-motto]').forEach((b) => b.addEventListener('click', () => setMotto(Number(b.dataset.motto))));
        custom.addEventListener('input', () => {
          st.custom = custom.value;
          setMotto(custom.value.trim() ? 'custom' : 0);
        });
        app.querySelector('form').addEventListener('submit', (e) => {
          e.preventDefault();
          start();
        });
        app.querySelector('[data-act="back"]').addEventListener('click', () => SMD.go('start'));
        app.querySelector('[data-act="lang"]').addEventListener('click', () => {
          SMD.setLang(SMD.lang() === 'ar' ? 'en' : 'ar');
          paint();
        });
      }

      paint();
    },
  };
})();
