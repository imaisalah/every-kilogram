// Mission Sprint: one player's own screen. A phone in the room, or a laptop
// anywhere: same client, sized by CSS. The setup phases are the shared calm
// views (view-setup.js); flight, landing, surface and ascent are the phone's
// own (look at the big screen, crisis buttons, the controller).
//
// team.client(root, session, opts) -> { destroy }
// Boots itself on join.html (see the bottom of this file).
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};
  const team = SMD.team;

  const t = (k, e, p) => SMD.t(k, e, p);
  const kit = () => team.kit;
  const esc = (s) => kit().esc(s);
  const buzz = (ms) => {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
  };

  const ROLE_COL = (r) => `var(--role-${r})`;

  // ---------- Connection trouble: always says what happened and what to try ----------
  const statusLine = (st, code, text) => kit().netMessage(st, code, text);

  // ---------- Flight: the alarm is here, the fix is on someone else's phone ----------
  // Crisis words in this screen's language (the host may speak another one).
  function cr(c, part, en) {
    if (!c || !c.type || !en) return en;
    const D = (SMD.team && SMD.team.data) || {};
    const tpl = (D.CRISES || []).concat(D.OPPORTUNITIES || []).find((x) => x.id === c.type);
    let base = en;
    if (tpl && part === 'title') base = tpl.title || en;
    else if (tpl && part === 'alarm') base = tpl.alarm || en;
    else if (tpl && part.startsWith('action.')) base = ((tpl.actions || []).find((a) => `action.${a.id}` === part) || {}).label || en;
    return t(`team.crisis.${c.type}.${part}`, base);
  }
  function mountFlight(root, ctx) {
    const K = kit();
    root.innerHTML = `<div class="tp tp-flight" data-flight></div>`;
    const box = root.querySelector('[data-flight]');
    let sig = '';
    let lastAlarms = 0;
    function draw() {
      const v = ctx.view;
      const crises = v.crises || [];
      const alarms = crises.filter((c) => c.alarm);
      const fixes = crises.filter((c) => c.fix);
      const next = JSON.stringify(crises.map((c) => [c.id, c.leftS, c.fix && c.fix.wrong]));
      if (alarms.length + fixes.length > lastAlarms) {
        try {
          SMD.audio.alarm();
        } catch (e) {}
        buzz([120, 60, 120]);
      }
      lastAlarms = alarms.length + fixes.length;
      if (next === sig) return;
      sig = next;
      if (fixes.length) {
        const c = fixes[0];
        box.className = 'tp tp-flight fix';
        box.innerHTML = `<p class="tp-kicker">${esc(t('team.flight.fixnow', 'Fix it now. Someone is yelling.'))}</p><b class="tp-count">${c.leftS}</b><div class="tp-fix-list">${c.fix.options.map((o) => `<button type="button" data-fix="${esc(o.id)}" data-crisis="${esc(c.id)}">${esc(cr(c, `action.${o.id}`, o.label))}</button>`).join('')}</div>`;
      } else if (alarms.length) {
        const c = alarms[0];
        const chance = c.kind === 'opportunity';
        box.className = `tp tp-flight alarm${chance ? ' chance' : ''}`;
        box.innerHTML = `<p class="tp-kicker">${esc(chance ? t('team.flight.chance', 'Quick, a chance!') : t('team.flight.alarm', 'Alarm!'))}</p><b class="tp-count">${c.leftS}</b><h1>${esc(cr(c, 'title', c.alarm.title))}</h1><p class="tp-alarm-text">${esc(c.alarm.text ? cr(c, 'alarm', c.alarm.text) : '')}</p><p class="tp-yell">${esc(t('team.flight.yell', 'Yell it out. The fix is on someone else’s screen.'))}</p>`;
      } else {
        box.className = 'tp tp-flight calm';
        const f = v.flight && v.flight.frame;
        box.innerHTML = `<svg viewBox="0 0 24 24" class="tp-eye" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></svg><h1>${esc(t('team.phone.look', 'Look at the big screen'))}</h1>${f ? `<div class="tp-gauges">${gauge(t('team.flight.battery', 'Battery'), f.battery)}${gauge(t('team.flight.buffer', 'Recorder'), f.buffer)}${gauge(t('team.flight.science', 'Science'), Math.min(1, (f.science || 0) / 100))}</div>` : ''}`;
      }
    }
    const gauge = (name, x) => `<div class="tp-gauge"><span>${esc(name)}</span><i style="inline-size:${Math.round(Math.max(0, Math.min(1, x || 0)) * 100)}%"></i></div>`;
    function onClick(e) {
      const b = e.target.closest('[data-fix]');
      if (!b) return;
      buzz(20);
      K.sfx.tap();
      ctx.send({ type: 'crisisAct', crisisId: b.dataset.crisis, optionId: b.dataset.fix });
    }
    root.addEventListener('click', onClick);
    draw();
    return { update: draw, destroy: () => root.removeEventListener('click', onClick) };
  }

  // ---------- The surface: a controller in your hands ----------
  const BTN = { fire: 1, use: 2, ability: 4, drop: 16, swap: 64 };

  function bindStick(zone, onMove) {
    const knob = zone.querySelector('.tc-knob');
    let id = null;
    let ox = 0;
    let oy = 0;
    const R = () => Math.max(40, zone.clientWidth * 0.34);
    const apply = (x, y) => {
      const r = R();
      const dx = x - ox;
      const dy = y - oy;
      const m = Math.hypot(dx, dy);
      const k = m > r ? r / m : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      onMove((dx * k) / r, (dy * k) / r, Math.min(1, m / r));
    };
    const down = (e) => {
      if (id !== null) return;
      id = e.pointerId;
      zone.setPointerCapture(id);
      const rect = zone.getBoundingClientRect();
      // Centre under the thumb, so you never have to hunt for the stick.
      ox = e.clientX;
      oy = e.clientY;
      knob.style.left = `${e.clientX - rect.left}px`;
      knob.style.top = `${e.clientY - rect.top}px`;
      zone.classList.add('held');
      apply(e.clientX, e.clientY);
      e.preventDefault();
    };
    const move = (e) => {
      if (e.pointerId !== id) return;
      apply(e.clientX, e.clientY);
      e.preventDefault();
    };
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      zone.classList.remove('held');
      knob.style.left = '50%';
      knob.style.top = '50%';
      knob.style.transform = 'translate(0, 0)';
      onMove(0, 0, 0);
    };
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    return () => {
      zone.removeEventListener('pointerdown', down);
      zone.removeEventListener('pointermove', move);
      zone.removeEventListener('pointerup', up);
      zone.removeEventListener('pointercancel', up);
    };
  }

  const PROMPTS = {
    revive: () => t('team.prompt.revive', 'Hold to revive'),
    scan: () => t('team.prompt.scan', 'Hold to scan'),
    plant: () => t('team.prompt.plant', 'Plant the dish'),
    align: () => t('team.prompt.align', 'Align the dish'),
    repair: () => t('team.prompt.repair', 'Repair'),
    pickup: () => t('team.prompt.pickup', 'Pick up'),
    drop: () => t('team.prompt.drop', 'Drop it'),
    needs_instrument: () => t('team.prompt.needs', 'You did not bring the right instrument'),
  };

  const WEAPON_NAME = {
    cutter: () => t('team.weapon.cutter', 'Plasma cutter'),
    laser: () => t('team.weapon.laser', 'Sampling laser'),
    drill: () => t('team.weapon.drill', 'Drill'),
    flare: () => t('team.weapon.flare', 'Flare gun'),
    punch: () => t('team.weapon.punch', 'Fists'),
  };

  function mountController(root, ctx) {
    const K = kit();
    const v0 = ctx.view;
    const role = (v0.surface && v0.surface.me && v0.surface.me.role) || (v0.me && v0.me.roles && v0.me.roles[0]) || 'planner';
    const abilityName = {
      planner: t('team.ability.planner', 'Ping'),
      engineer: t('team.ability.engineer2', 'Repair'),
      scientist: t('team.ability.scientist', 'Overclock'),
      comms: t('team.ability.comms2', 'Relay'),
    }[role];
    root.innerHTML = `<div class="tc" data-role="${role}">
      <header class="tc-hud">
        <div class="tc-bars">
          <div class="tc-bar hp"><span>${esc(t('team.hud.hp', 'Health'))}</span><i data-hp></i></div>
          <div class="tc-bar o2"><span>${esc(t('team.hud.o2', 'Oxygen'))}</span><i data-o2></i></div>
        </div>
        <div class="tc-gear"><b data-weapon></b><small data-ammo class="tc-ammo"></small><small data-time></small></div>
      </header>
      <p class="tc-prompt" data-prompt role="status"></p>
      <div class="tc-pad">
        <div class="tc-stick tc-move" data-move><span class="tc-knob"></span><small>${esc(t('team.hud.move', 'Move'))}</small></div>
        <div class="tc-right">
          <div class="tc-buttons">
            <button type="button" class="tc-btn tc-ability" data-btn="ability">${esc(abilityName)}</button>
            <button type="button" class="tc-btn tc-use" data-btn="use" data-use-label>${esc(t('team.hud.use', 'Use'))}</button>
            <button type="button" class="tc-btn tc-swap" data-btn="swap">${esc(t('team.hud.swap', 'Swap'))}</button>
            <button type="button" class="tc-btn tc-fire" data-btn="fire">${esc(t('team.hud.fire', 'Fire'))}</button>
          </div>
          <div class="tc-stick tc-aim" data-aim><span class="tc-knob"></span><small>${esc(t('team.hud.aim', 'Aim'))}</small></div>
        </div>
      </div>
      <div class="tc-down" data-down hidden></div>
      <section class="tc-rack" data-rack hidden></section>
    </div>`;
    const q = (s) => root.querySelector(s);
    const pad = { mx: 0, my: 0, ax: 0, ay: 0, buttons: 0 };
    let aimHeld = false;
    const offs = [
      bindStick(q('[data-move]'), (x, y) => {
        pad.mx = x;
        pad.my = y;
      }),
      bindStick(q('[data-aim]'), (x, y, m) => {
        pad.ax = x;
        pad.ay = y;
        aimHeld = m > 0.2;
      }),
    ];
    root.querySelectorAll('[data-btn]').forEach((b) => {
      const bit = BTN[b.dataset.btn];
      const on = (e) => {
        pad.buttons |= bit;
        b.classList.add('held');
        buzz(8);
        try {
          if (e.pointerId != null) b.setPointerCapture(e.pointerId);
        } catch (err) {}
        e.preventDefault();
      };
      const off = () => {
        pad.buttons &= ~bit;
        b.classList.remove('held');
      };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    const send = () => {
      // Pushing the aim stick fires too: twin-stick habits work.
      const buttons = pad.buttons | (aimHeld ? BTN.fire : 0);
      ctx.session.sendInput({ mx: pad.mx, my: pad.my, ax: pad.ax, ay: pad.ay, buttons });
    };
    const timer = setInterval(send, 50);
    let lastHp = null;
    let lastPrompt = null;
    const useBtn = q('[data-use-label]');
    function applyHud(h) {
      if (!h) return;
      q('[data-hp]').style.inlineSize = `${Math.max(0, Math.min(100, h.hp))}%`;
      q('[data-o2]').style.inlineSize = `${Math.max(0, Math.min(100, h.o2))}%`;
      q('[data-weapon]').textContent = h.weapon ? (WEAPON_NAME[h.weapon] ? WEAPON_NAME[h.weapon]() : String(h.weapon)) : '';
      const ammo = [];
      if (h.flares != null) ammo.push(t('team.hud.flares', '{n} flares', { n: h.flares }));
      q('[data-ammo]').textContent = ammo.join('   ');
      q('[data-time]').textContent = h.left != null ? `${Math.floor(h.left / 60)}:${String(Math.max(0, h.left) % 60).padStart(2, '0')}` : '';
      if (lastHp != null && h.hp < lastHp) {
        buzz(h.hp < lastHp - 15 ? 160 : 60);
      }
      lastHp = h.hp;
      const fn = PROMPTS[h.prompt];
      const promptText = h.prompt ? (fn ? fn() : String(h.prompt)) : '';
      if (promptText !== lastPrompt) {
        lastPrompt = promptText;
        q('[data-prompt]').textContent = promptText;
        useBtn.textContent = promptText && PROMPTS[h.prompt] ? promptText : t('team.hud.use', 'Use');
        if (promptText) K.bump(q('[data-prompt]'));
      }
      const down = q('[data-down]');
      if (h.dead || h.downed) {
        down.hidden = false;
        down.textContent = h.dead ? t('team.hud.dead', 'You did not make it. Watch the big screen.') : t('team.hud.downed', 'You are down! Shout for someone to revive you.');
      } else if (h.aboard) {
        down.hidden = false;
        down.textContent = t('team.hud.aboard', 'You are on the lander. Hold on.');
      } else down.hidden = true;
    }
    // The rack: while the lander is too heavy, this is the game. The same calm chooser as
    // the big screen: one row per kind, the plan preselected, one confirm.
    const rackBox = q('[data-rack]');
    const chooser = K.ascentChooser(rackBox, {
      send: (ids) => {
        K.sfx.tap();
        buzz(40);
        ctx.send({ type: 'ascentDrop', ids, drop: true });
      },
    });
    function applyRack(h) {
      const R = h && h.rack;
      const over = !!R && R.loadedKg > R.liftKg;
      const show = !!R && R.items.length > 0 && (over || h.decision > 0);
      rackBox.hidden = !show;
      rackBox.classList.toggle('deciding', !!(h && h.decision > 0));
      if (!show) return;
      chooser.update({ items: R.items, liftKg: R.liftKg, objective: R.objective || null }, h.decision || 0);
    }
    const offHud = ctx.session.on('hud', (h) => {
      applyHud(h);
      applyRack(h);
    });
    return {
      update() {},
      destroy() {
        clearInterval(timer);
        offs.forEach((f) => f());
        offHud && offHud();
        chooser.destroy();
      },
    };
  }

  // ---------- Landing and ascent ----------
  function mountLanding(root, ctx) {
    const K = kit();
    root.innerHTML = `<div class="tp tp-landing"><p class="tp-kicker">${esc(t('team.landing.k', 'Going down'))}</p><h1>${esc(t('team.landing.t', 'Hold on. Look at the big screen.'))}</h1><p class="tp-note">${esc(t('team.landing.next', 'Your thumbs are about to be busy: left stick moves, right stick aims and fires.'))}</p></div>`;
    void K;
    return { update() {}, destroy() {} };
  }

  function mountAscent(root, ctx) {
    const K = kit();
    // The choice was made at the door; this is what it cost.
    root.innerHTML = `<div class="tp tp-ascent"><p class="tp-kicker">${esc(t('team.ascent.k2', 'Liftoff!'))}</p><p class="tp-over" data-over></p><div class="tp-samples" data-samples></div></div>`;
    const list = root.querySelector('[data-samples]');
    let sig = '';
    const kindName = (s) => (s.siteKind ? t('team.surface.sample.' + s.siteKind, s.siteKind) : s.name || s.label || s.id);
    const row = (s, kept) => `<div class="tp-sample ${kept ? '' : 'dropped'}"><b>${esc(kindName(s))}</b><small>${K.ltr(`${K.fmt(Math.round(s.massKg || s.mass || 0))} kg`)}</small><span>${esc(kept ? t('team.ascent.kept', 'Came home') : t('team.ascent.stayed', 'Left on the surface'))}</span></div>`;
    function draw() {
      const a = ctx.view.ascent;
      if (!a) return;
      const kept = a.samples || [];
      const left = a.jettisoned || [];
      const next = JSON.stringify([kept.map((s) => s.id), left.map((s) => s.id)]);
      if (next === sig) return;
      sig = next;
      const kg = kept.reduce((sum, s) => sum + (s.massKg || s.mass || 0), 0);
      root.querySelector('[data-over]').textContent = kept.length ? t('team.ascent.left2', '{n} kg of samples came home', { n: K.ltr(Math.round(kg)) }) : t('team.ascent.none', 'No samples came back.');
      list.innerHTML = kept.map((s) => row(s, true)).concat(left.map((s) => row(s, false))).join('');
    }
    draw();
    return { update: draw, destroy() {} };
  }

  function mountLook(root, ctx) {
    root.innerHTML = `<div class="tp tp-flight calm"><svg viewBox="0 0 24 24" class="tp-eye" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></svg><h1>${esc(t('team.phone.look', 'Look at the big screen'))}</h1></div>`;
    return { update() {}, destroy() {} };
  }

  function mountDebrief(root, ctx) {
    const K = kit();
    root.innerHTML = '<div class="tp tp-flight calm" data-box></div>';
    const box = root.querySelector('[data-box]');
    let sig = '';
    function draw() {
      const v = ctx.view;
      const d = v.debrief || {};
      const score = d.score && d.score.total != null ? d.score.total : null;
      const mine = (v.me && v.me.roles) || [];
      const agendas = (d.agendas || []).filter((a) => mine.indexOf(a.role) >= 0);
      const next = JSON.stringify([score, agendas]);
      if (next === sig) return;
      sig = next;
      box.innerHTML = `${score != null ? `<b class="tp-count">${esc(K.fmt(score))}</b><p class="tp-kicker">${esc(t('team.debrief.score', 'out of 1000'))}</p>` : ''}${d.score && d.score.outcome && d.score.outcome.title ? `<p class="tp-kicker">${esc(d.score.outcome.title)}</p>` : ''}
        <h1>${esc(t('team.phone.look', 'Look at the big screen'))}</h1>
        ${agendas.map((a) => `<div class="tp-agenda-res ${a.met ? 'ok' : 'no'}"><b>${esc(t('team.phone.secret', 'Your secret goal'))}</b><span>${esc((a.agenda && a.agenda.title) || '')}</span><strong>${esc(a.met ? t('team.debrief.met', 'Done') : t('team.debrief.missed', 'Missed'))}</strong></div>`).join('')}`;
    }
    draw();
    return { update: draw, destroy() {} };
  }

  // The setup phases use the same calm views as every other screen (view-setup.js),
  // sized for a phone by CSS.
  function shared(phase) {
    return (root, ctx) => {
      const view = team.views && team.views[phase];
      if (!view) return mountLook(root, ctx);
      const out = view.mount(root, ctx) || {};
      const cleanup = typeof out === 'function' ? out : out.cleanup || out.destroy || (() => {});
      return { update: () => out.update && out.update(ctx), destroy: cleanup };
    };
  }
  const PHASES = { debrief: mountDebrief, lobby: shared('lobby'), brief: shared('brief'), design: shared('design'), questions: shared('questions'), define: shared('define'), lock: shared('lock'), cabin: shared('cabin'), flight: mountFlight, landing: mountLanding, surface: mountController, ascent: mountAscent };

  // One phase of the player screen, for the team screen on a laptop.
  team.clientPhase = function clientPhase(phase, el, ctx) {
    return (PHASES[phase] || mountLook)(el, ctx);
  };

  // The client itself: mounts by phase, keeps the connection state in view.
  team.client = function client(root, session, opts = {}) {
    const ctx = { session, view: session.view, send: (a) => session.send(a), sim: team.sim, device: opts.device || 'phone', mode: 'join', params: {}, subscribe: () => () => {} };
    root.innerHTML = `<div class="tp-app"><div class="tp-status" data-status hidden role="status"></div><div class="tp-stage" data-stage></div></div>`;
    // The mission tracker and the pause menu, as on every screen.
    const chrome = kit().chrome(root.querySelector('.tp-app'), ctx);
    const stage = root.querySelector('[data-stage]');
    const statusEl = root.querySelector('[data-status]');
    let phase = null;
    let cur = null;
    const offs = [];
    function mountPhase() {
      const p = ctx.view && ctx.view.phase;
      if (!p || p === phase) return;
      phase = p;
      if (cur && cur.destroy) cur.destroy();
      stage.innerHTML = '';
      const inner = document.createElement('div');
      inner.className = 'tp-inner';
      stage.appendChild(inner);
      cur = (PHASES[p] || mountLook)(inner, ctx);
    }
    offs.push(
      session.on('view', (v) => {
        ctx.view = v;
        if (!v || !v.phase) return;
        mountPhase();
        if (cur && cur.update) cur.update();
        chrome.update();
      })
    );
    offs.push(
      session.on('status', (s) => {
        const st = s.status;
        const text = statusLine(st, s.code, s.text);
        const showBad = st && st !== 'open';
        statusEl.hidden = !showBad || !text;
        statusEl.textContent = text;
        statusEl.dataset.status = st || '';
      })
    );
    if (session.view && session.view.phase) {
      ctx.view = session.view;
      mountPhase();
    }
    return {
      destroy() {
        offs.forEach((f) => f && f());
        if (cur && cur.destroy) cur.destroy();
        chrome.destroy();
      },
    };
  };

  // ---------- Forms: joining a room, and naming yourself ----------
  const savedName = () => {
    try {
      return localStorage.getItem('ek.team.name') || '';
    } catch (e) {
      return '';
    }
  };
  const saveName = (name) => {
    try {
      localStorage.setItem('ek.team.name', name);
    } catch (e) {}
  };
  const unlockAudio = () => {
    try {
      SMD.audio.unlock();
    } catch (e) {}
  };

  // Connects to a room and says exactly what is happening until a view arrives.
  team.joinForm = function joinForm(root, { code, transport, onSession }) {
    root.innerHTML = `<form class="tp-join" data-form>
      <h1 class="tp-logo">${esc(t('team.title.line1', 'Every'))}<br/>${esc(t('team.title.line2', 'Kilogram'))}</h1>
      <label><span>${esc(t('team.join.code', 'Room code'))}</span><input name="code" autocomplete="off" autocapitalize="characters" maxlength="8" required value="${esc(code || '')}" dir="ltr" /></label>
      <label><span>${esc(t('team.join.name', 'Your name'))}</span><input name="name" autocomplete="nickname" maxlength="16" required value="${esc(savedName())}" /></label>
      <button type="submit" class="ts-go">${esc(t('team.join.go', 'Join'))}</button>
      <p class="tp-note" data-msg role="status"></p>
      <button type="button" class="tp-lang" data-lang lang="${SMD.lang() === 'ar' ? 'en' : 'ar'}">${SMD.lang() === 'ar' ? 'English' : 'العربية'}</button>
    </form>`;
    const form = root.querySelector('[data-form]');
    root.querySelector('[data-lang]').addEventListener('click', () => {
      SMD.setLang(SMD.lang() === 'ar' ? 'en' : 'ar');
      joinForm(root, { code: form.elements.code.value || code, transport, onSession });
    });
    const msg = root.querySelector('[data-msg]');
    const button = form.querySelector('button[type=submit]');
    let session = null;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (session) return;
      const data = new FormData(form);
      const roomCode = String(data.get('code') || '').trim().toUpperCase();
      const name = String(data.get('name') || '').trim().slice(0, 16);
      if (!roomCode || !name) return;
      saveName(name);
      unlockAudio();
      button.disabled = true;
      msg.className = 'tp-note';
      msg.textContent = t('team.net.connecting', 'Connecting…');
      session = team.net.join(roomCode, name, undefined, { transport });
      const again = () => {
        button.disabled = false;
        session = null;
      };
      let started = false;
      const off = session.on('status', (st) => {
        if (started) return;
        if (st.status === 'closed' || st.status === 'error') {
          msg.className = 'tp-note bad';
          msg.textContent = statusLine(st.status, st.code, st.text);
          again();
        } else msg.textContent = statusLine(st.status, st.code, st.text) || t('team.net.connecting', 'Connecting…');
      });
      const offView = session.on('view', (v) => {
        if (started || !v || !v.phase) return;
        started = true;
        off && off();
        offView && offView();
        onSession(session);
      });
    });
  };

  // The host's name, once. With a saved name there is nothing to ask.
  team.nameForm = function nameForm(root, { onName }) {
    const known = savedName();
    if (known) return onName(known);
    root.innerHTML = `<form class="tp-join" data-form>
      <h1 class="tp-logo">${esc(t('team.join.who', 'Who are you?'))}</h1>
      <label><span>${esc(t('team.join.name', 'Your name'))}</span><input name="name" autocomplete="nickname" maxlength="16" required autofocus /></label>
      <button type="submit" class="ts-go">${esc(t('team.join.create', 'Create a room'))}</button>
    </form>`;
    root.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = String(new FormData(e.target).get('name') || '').trim().slice(0, 16);
      if (!name) return;
      saveName(name);
      unlockAudio();
      onName(name);
    });
  };

  // ---------- join.html ----------
  function bootJoin() {
    const root = document.getElementById('join-root');
    if (!root) return;
    if (SMD.applyLang) SMD.applyLang();
    const params = new URLSearchParams(location.search);
    const transport = params.get('t') === 'webrtc' ? 'webrtc' : 'relay';
    team.joinForm(root, { code: (params.get('room') || '').toUpperCase(), transport, onSession: (session) => team.client(root, session, { device: 'phone' }) });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootJoin);
    else bootJoin();
  }
})();
