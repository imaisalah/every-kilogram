// Mission Sprint v3 (docs/TEAM-V3.md item 24): the in-game connection check,
// "Can your friends reach you?". SMD.team.netcheck
//
//   netcheck.run(opts)        Promise<report>. Three checks, each with plain words
//                             and a next step:
//                             origin   where this page was opened from (file:, localhost,
//                                      a Wi-Fi address, or a hosted site)
//                             broker   is the PeerJS broker answering (opens a Peer, or
//                                      fetches an id when PeerJS cannot load)
//                             webrtc   a loopback RTCPeerConnection with STUN: does a data
//                                      channel open, does a STUN server answer (srflx),
//                                      did ICE fail or time out
//                             report = { ok, verdict:'good'|'limited'|'bad', summary, items:[...],
//                                        origin, broker, webrtc, ms, at }
//                             item   = { id, status:'ok'|'warn'|'bad'|'skip', title, text, next }
//   netcheck.mount(el, opts)  a small panel: a button, the three rows, the verdict, and an
//                             Advanced box for a custom broker (net.setBroker). Returns
//                             { run, destroy, report }. opts.auto runs it at once.
//   netcheck.classifyOrigin(location?)  pure; netcheck.verdict(items) pure (tests).
//
// Classic script: loads after js/team/net.js on index.html and join.html. Works
// without SMD.t (English) and without a document (node tests use the pure parts).
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};
  const team = SMD.team;

  const fill = (s, p) => String(s).replace(/\{(\w+)\}/g, (m, k) => (p && p[k] != null ? p[k] : m));
  const t = (key, english, params) => (typeof SMD.t === 'function' ? SMD.t(key, english, params) : fill(english, params));

  const PEERJS_SRC = 'vendor/peerjs-1.5.4.min.js';
  const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  const BROKER_MS = 10000;
  const ICE_MS = 10000;
  const GATHER_EXTRA_MS = 2500; // after the channel opens, a little longer for a STUN answer

  const PUBLIC_BROKER = { host: '0.peerjs.com', port: 443, path: '/', secure: true, key: 'peerjs' };

  // ---------- Where was this page opened from? (pure) ----------
  function classifyOrigin(loc) {
    const l = loc || (typeof location !== 'undefined' ? location : null);
    if (!l) return { kind: 'unknown', host: '', protocol: '' };
    const protocol = String(l.protocol || '');
    const host = String(l.hostname || '')
      .replace(/^\[|\]$/g, '')
      .toLowerCase();
    if (protocol === 'file:') return { kind: 'file', host: '', protocol };
    if (!host || host === 'localhost' || host.endsWith('.localhost') || /^127\./.test(host) || host === '::1' || host === '0.0.0.0') return { kind: 'local', host, protocol };
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host) || /\.(local|lan|home|internal)$/.test(host) || /^fe80:/.test(host) || /^f[cd][0-9a-f]{2}:/.test(host)) return { kind: 'lan', host, protocol };
    return { kind: 'hosted', host, protocol };
  }

  function originItem(o) {
    const base = { id: 'origin', kind: o.kind, host: o.host, title: t('team.netcheck.origin', 'Where the game was opened') };
    if (o.kind === 'file')
      return {
        ...base,
        status: 'bad',
        text: t('team.netcheck.origin.file', 'You opened the game as a file on this computer. Nobody else can open your invite link.'),
        next: t('team.netcheck.origin.file.next', 'Open the game from its online address (the GitHub Pages link) and send that link. On the same Wi-Fi, start play-team.bat and send the 192.168… address it prints.'),
      };
    if (o.kind === 'local')
      return {
        ...base,
        status: 'bad',
        text: t('team.netcheck.origin.local', 'You opened the game from this computer ({host}). The invite link only works on this machine.', { host: o.host || 'localhost' }),
        next: t('team.netcheck.origin.local.next', 'To play from anywhere, open the game from its online address (the GitHub Pages link) and send that link. On the same Wi-Fi, start play-team.bat and send the 192.168… address it prints.'),
      };
    if (o.kind === 'lan')
      return {
        ...base,
        status: 'warn',
        text: t('team.netcheck.origin.lan', 'You opened the game from a Wi-Fi address ({host}). Friends on the same Wi-Fi can use your link; friends elsewhere cannot.', { host: o.host }),
        next: t('team.netcheck.origin.lan.next', 'To play from anywhere, open the game from its online address and send that link instead.'),
      };
    if (o.kind === 'hosted')
      return {
        ...base,
        status: 'ok',
        text: t('team.netcheck.origin.hosted', 'Opened from {host}: your invite link opens on any device.', { host: o.host }),
        next: '',
      };
    return { ...base, status: 'skip', text: t('team.netcheck.origin.unknown', 'Could not tell where the page was opened from.'), next: '' };
  }

  // ---------- The broker ----------
  const scriptPromises = {};
  function loadScript(src) {
    if (typeof document === 'undefined') return Promise.reject(new Error('no document'));
    if (scriptPromises[src]) return scriptPromises[src];
    scriptPromises[src] = new Promise((done, fail) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => done();
      s.onerror = () => fail(new Error(`could not load ${src}`));
      document.head.appendChild(s);
    });
    return scriptPromises[src];
  }

  function brokerInUse(opts) {
    const net = team.net;
    if (opts && opts.broker && net && net.parseBroker) return net.parseBroker(opts.broker) || PUBLIC_BROKER;
    return (net && net.broker && net.broker()) || PUBLIC_BROKER;
  }
  const brokerLabel = (b) => `${b.host}${(b.secure && b.port === 443) || (!b.secure && b.port === 80) ? '' : `:${b.port}`}`;

  function withTimeout(promise, ms, reason) {
    let timer;
    const late = new Promise((_, fail) => {
      timer = setTimeout(() => fail(new Error(reason)), ms);
    });
    return Promise.race([promise, late]).finally(() => clearTimeout(timer));
  }

  // Opens a throw-away Peer on the broker; the honest test, over the same
  // WebSocket the game uses. Falls back to the broker's HTTP id endpoint when
  // PeerJS itself cannot load (file: pages, blocked script).
  function checkBroker(opts) {
    const b = brokerInUse(opts);
    const t0 = Date.now();
    const viaPeer = () =>
      new Promise((done, fail) => {
        let peer;
        try {
          peer = new globalThis.Peer({ host: b.host, port: b.port, path: b.path, secure: b.secure, key: b.key, debug: 0, config: { iceServers: STUN } });
        } catch (e) {
          return fail(e);
        }
        const finish = (fn, v) => {
          try {
            peer.destroy();
          } catch (e) {
            // Already gone.
          }
          fn(v);
        };
        peer.on('open', () => finish(done, 'peer'));
        peer.on('error', (err) => finish(fail, new Error((err && err.type) || 'error')));
      });
    const viaFetch = () => {
      const url = `${b.secure ? 'https' : 'http'}://${b.host}:${b.port}${b.path}${b.key}/id?ts=${Date.now()}`;
      return fetch(url, { cache: 'no-store' }).then((r) => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        return 'http';
      });
    };
    const attempt = () => {
      if (typeof globalThis.RTCPeerConnection === 'undefined') return viaFetch();
      const ready = globalThis.Peer ? Promise.resolve() : loadScript(PEERJS_SRC).catch(() => null);
      return ready.then(() => (globalThis.Peer ? viaPeer() : viaFetch()));
    };
    return withTimeout(attempt(), BROKER_MS, 'timeout').then(
      (how) => ({ ok: true, ms: Date.now() - t0, how, broker: brokerLabel(b), custom: b.host !== PUBLIC_BROKER.host }),
      (e) => ({ ok: false, ms: Date.now() - t0, reason: e && e.message ? e.message : 'error', broker: brokerLabel(b), custom: b.host !== PUBLIC_BROKER.host })
    );
  }

  function brokerItem(r) {
    const base = { id: 'broker', ...r, title: t('team.netcheck.broker', 'The connecting service') };
    if (r.ok)
      return {
        ...base,
        status: 'ok',
        text: t('team.netcheck.broker.ok', '{broker} answered in {ms} ms. Rooms can be found.', { broker: r.broker, ms: r.ms }),
        next: '',
      };
    const custom = r.custom ? t('team.netcheck.broker.custom', ' This is a custom server set under Advanced; clear it to use the free public one.') : '';
    return {
      ...base,
      status: 'bad',
      text: t('team.netcheck.broker.bad', '{broker} did not answer ({reason}). Nobody can find a room until it does.', { broker: r.broker, reason: r.reason }),
      next: t('team.netcheck.broker.next', 'Check that this device is online, then try again in a minute. On the same Wi-Fi, play-team.bat does not need this service. Or play on One screen.') + custom,
    };
  }

  // ---------- WebRTC: a loopback data channel, and a STUN probe ----------
  // Two separate connections on purpose. Chromium stops gathering the moment a
  // loopback connects over host candidates (measured: "gathering complete"
  // 20 ms after the host candidate, no srflx), so the loopback alone can never
  // say whether STUN answered. The probe is a lone connection that only gathers.
  const closeQuietly = (pc) => {
    try {
      pc && pc.close();
    } catch (e) {
      // Already closed.
    }
  };
  const candidateType = (c) => {
    const m = /typ (host|srflx|relay)/.exec((c && c.candidate) || '');
    return m ? m[1] : null;
  };

  function probeStun(RTC, ice) {
    return new Promise((done) => {
      const t0 = Date.now();
      const types = { host: 0, srflx: 0, relay: 0 };
      let pc;
      let timer = null;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        closeQuietly(pc);
        done({ ...types, ms: Date.now() - t0 });
      };
      try {
        pc = new RTC({ iceServers: ice });
        pc.createDataChannel('ek-stun');
        pc.onicecandidate = (ev) => {
          const kind = ev.candidate && candidateType(ev.candidate);
          if (kind) types[kind]++;
          if (kind === 'srflx' || kind === 'relay' || !ev.candidate) finish();
        };
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') finish();
        };
        timer = setTimeout(finish, GATHER_EXTRA_MS);
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .catch(finish);
      } catch (e) {
        finish();
      }
    });
  }

  function loopback(RTC, ice) {
    return new Promise((done) => {
      const t0 = Date.now();
      let a;
      let b;
      let finished = false;
      let timer = null;
      const finish = (result) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        closeQuietly(a);
        closeQuietly(b);
        done({ ...result, ms: Date.now() - t0 });
      };
      try {
        a = new RTC({ iceServers: ice });
        b = new RTC({ iceServers: ice });
      } catch (e) {
        return finish({ ok: false, code: 'no-webrtc' });
      }
      const forward = (to) => (ev) => {
        if (ev.candidate) to.addIceCandidate(ev.candidate).catch(() => {});
      };
      a.onicecandidate = forward(b);
      b.onicecandidate = forward(a);
      a.oniceconnectionstatechange = () => {
        if (a.iceConnectionState === 'failed') finish({ ok: false, code: 'ice-failed' });
      };
      const dc = a.createDataChannel('ek-check');
      dc.onopen = () => finish({ ok: true, code: null });
      timer = setTimeout(() => finish({ ok: false, code: 'ice-timeout' }), ICE_MS);
      a.createOffer()
        .then((offer) => a.setLocalDescription(offer))
        .then(() => b.setRemoteDescription(a.localDescription))
        .then(() => b.createAnswer())
        .then((answer) => b.setLocalDescription(answer))
        .then(() => a.setRemoteDescription(b.localDescription))
        .catch(() => finish({ ok: false, code: 'ice-failed' }));
    });
  }

  function checkWebRTC(opts) {
    const RTC = globalThis.RTCPeerConnection;
    if (typeof RTC === 'undefined') return Promise.resolve({ ok: false, code: 'no-webrtc', ms: 0 });
    const ice = (opts && opts.iceServers) || (team.net && team.net.iceServers && team.net.iceServers()) || STUN;
    return Promise.all([loopback(RTC, ice), probeStun(RTC, ice)]).then(([loop, stun]) => ({
      ...loop,
      srflx: stun.srflx > 0,
      relay: stun.relay > 0,
      host: stun.host > 0,
      stunMs: stun.ms,
      candidates: { host: stun.host, srflx: stun.srflx, relay: stun.relay },
    }));
  }

  function webrtcItem(r) {
    const base = { id: 'webrtc', ...r, title: t('team.netcheck.webrtc', 'Direct connections (WebRTC)') };
    if (r.code === 'no-webrtc')
      return {
        ...base,
        status: 'bad',
        text: t('team.netcheck.webrtc.none', 'This browser cannot make direct connections.'),
        next: t('team.netcheck.webrtc.none.next', 'Use a current Chrome, Edge, Firefox or Safari, or play on One screen.'),
      };
    if (!r.ok)
      return {
        ...base,
        status: 'bad',
        text:
          r.code === 'ice-timeout'
            ? t('team.netcheck.webrtc.timeout', 'A test connection to this same browser did not open in 10 seconds.')
            : t('team.netcheck.webrtc.failed', 'A test connection to this same browser failed (ICE failed).'),
        next: t('team.netcheck.webrtc.failed.next', 'A firewall, VPN or school/company network is blocking WebRTC. Try a different network (a phone hotspot works), turn the VPN off, or play on One screen.'),
      };
    if (!r.srflx)
      return {
        ...base,
        status: 'warn',
        text: t('team.netcheck.webrtc.nostun', 'Direct connections work here, but no STUN server answered, so your network hides your public address.'),
        next: t('team.netcheck.webrtc.nostun.next', 'Friends on the same Wi-Fi can connect. Friends elsewhere probably cannot: try a different network or a phone hotspot, or play on One screen.'),
      };
    return {
      ...base,
      status: 'ok',
      text: t('team.netcheck.webrtc.ok', 'Opened in {ms} ms, and a STUN server answered: friends elsewhere can usually connect straight to you.', { ms: r.ms }),
      next: t('team.netcheck.webrtc.ok.next', 'Some mobile networks still block direct connections; a friend that cannot connect should try Wi-Fi.'),
    };
  }

  // ---------- Verdict (pure) ----------
  function verdict(items) {
    const bad = items.filter((i) => i.status === 'bad');
    const warn = items.filter((i) => i.status === 'warn');
    if (bad.length) {
      const origin = bad.find((i) => i.id === 'origin');
      const broker = bad.find((i) => i.id === 'broker');
      const rtc = bad.find((i) => i.id === 'webrtc');
      let summary;
      if (origin && !broker && !rtc) summary = t('team.netcheck.sum.origin', 'Your connection is fine, but friends cannot open this link: open the game from its online address first.');
      else if (broker) summary = t('team.netcheck.sum.broker', 'Friends cannot find your room right now: the connecting service is not answering.');
      else summary = t('team.netcheck.sum.rtc', 'Friends cannot connect to you from here: this network blocks direct connections.');
      return { verdict: 'bad', ok: false, summary };
    }
    if (warn.length) return { verdict: 'limited', ok: true, summary: t('team.netcheck.sum.limited', 'Friends on the same Wi-Fi can reach you. From elsewhere it may not work; see below.') };
    return { verdict: 'good', ok: true, summary: t('team.netcheck.sum.good', 'Friends can reach you. Send the link.') };
  }

  function run(opts) {
    const o = opts || {};
    const t0 = Date.now();
    const origin = originItem(classifyOrigin(o.location));
    return Promise.all([checkBroker(o), checkWebRTC(o)]).then(([br, rtc]) => {
      const broker = brokerItem(br);
      const webrtc = webrtcItem(rtc);
      const items = [origin, broker, webrtc];
      const v = verdict(items);
      const report = { ...v, items, origin, broker, webrtc, ms: Date.now() - t0, at: Date.now() };
      team.netcheck.last = report;
      return report;
    });
  }

  // ---------- A small panel the lobby (or the join form) can show ----------
  const CSS = `
.ts-netcheck{margin:.8rem 0 0;max-inline-size:40rem;font-size:.95rem;line-height:1.5}
.ts-netcheck-head{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem}
.ts-netcheck-head b{font-weight:700}
.ts-netcheck-list{list-style:none;margin:.6rem 0 0;padding:0;display:grid;gap:.5rem}
.ts-netcheck-list li{display:grid;grid-template-columns:1rem 1fr;gap:.55rem;align-items:start;padding:.55rem .7rem;border-radius:.7rem;background:rgba(255,255,255,.05)}
.ts-netcheck-list li i{inline-size:.7rem;block-size:.7rem;margin-block-start:.42rem;border-radius:50%;background:var(--calm-dim,#8a93a8)}
.ts-netcheck-list li[data-status=ok] i{background:var(--calm-good,#4cc38a)}
.ts-netcheck-list li[data-status=warn] i{background:var(--calm-warn,#f4b942)}
.ts-netcheck-list li[data-status=bad] i{background:var(--calm-bad,#ef5d5d)}
.ts-netcheck-list li[data-status=busy] i{animation:ek-netcheck-pulse 1s infinite alternate}
.ts-netcheck-list li b{display:block}
.ts-netcheck-list li p{margin:.1rem 0 0}
.ts-netcheck-list li p.next{opacity:.85}
.ts-netcheck-sum{margin:.6rem 0 0;font-weight:700}
.ts-netcheck-sum[data-verdict=bad]{color:var(--calm-bad,#ef5d5d)}
.ts-netcheck-sum[data-verdict=limited]{color:var(--calm-warn,#f4b942)}
.ts-netcheck-adv{margin-block-start:.6rem;font-size:.88rem;opacity:.9}
.ts-netcheck-adv summary{cursor:pointer}
.ts-netcheck-adv label{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin:.4rem 0}
.ts-netcheck-adv input{flex:1 1 14rem;min-inline-size:0;padding:.35rem .5rem;border-radius:.4rem;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:inherit;font:inherit}
.ts-netcheck-adv small{display:block;opacity:.8}
@keyframes ek-netcheck-pulse{from{opacity:.35}to{opacity:1}}`;
  function ensureCss() {
    if (typeof document === 'undefined' || document.getElementById('ek-netcheck-css')) return;
    const s = document.createElement('style');
    s.id = 'ek-netcheck-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function mount(el, opts) {
    const o = opts || {};
    ensureCss();
    el.classList.add('ts-netcheck');
    const net = team.net;
    const canSetBroker = !!(net && net.setBroker);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    el.innerHTML = `<div class="ts-netcheck-head"><b>${esc(t('team.netcheck.q', 'Can your friends reach you?'))}</b><button type="button" class="ts-btn small" data-run>${esc(t('team.netcheck.run', 'Check'))}</button></div>
      <ul class="ts-netcheck-list" data-list hidden></ul>
      <p class="ts-netcheck-sum" data-sum role="status"></p>
      ${
        canSetBroker
          ? `<details class="ts-netcheck-adv"><summary>${esc(t('team.netcheck.adv', 'Advanced: your own connecting server'))}</summary>
        <label><span>${esc(t('team.netcheck.adv.server', 'Server'))}</span><input data-broker dir="ltr" placeholder="0.peerjs.com" value="${esc(net.broker() ? net.brokerText(net.broker()) : '')}" /><button type="button" class="ts-btn small" data-broker-save>${esc(t('team.netcheck.adv.save', 'Save'))}</button></label>
        <small>${esc(t('team.netcheck.adv.help', 'Only if the free public server is down and you run your own PeerServer (npx peer --port 9000). Every player must enter the same address; leave it empty for the public server.'))}</small></details>`
          : ''
      }`;
    const list = el.querySelector('[data-list]');
    const sum = el.querySelector('[data-sum]');
    const button = el.querySelector('[data-run]');
    let destroyed = false;
    const api = { report: null };

    const row = (id, title) => `<li data-id="${id}" data-status="busy"><i></i><div><b>${esc(title)}</b><p>${esc(t('team.netcheck.checking', 'Checking…'))}</p></div></li>`;
    function draw(report) {
      if (destroyed) return;
      list.innerHTML = report.items.map((i) => `<li data-id="${i.id}" data-status="${i.status}"><i></i><div><b>${esc(i.title)}</b><p>${esc(i.text)}</p>${i.next ? `<p class="next">${esc(i.next)}</p>` : ''}</div></li>`).join('');
      sum.dataset.verdict = report.verdict;
      sum.textContent = report.summary;
    }
    function go() {
      if (destroyed) return Promise.resolve(null);
      button.disabled = true;
      list.hidden = false;
      list.innerHTML = row('origin', t('team.netcheck.origin', 'Where the game was opened')) + row('broker', t('team.netcheck.broker', 'The connecting service')) + row('webrtc', t('team.netcheck.webrtc', 'Direct connections (WebRTC)'));
      sum.textContent = '';
      delete sum.dataset.verdict;
      return run(o).then(
        (report) => {
          api.report = report;
          draw(report);
          button.disabled = false;
          button.textContent = t('team.netcheck.again', 'Check again');
          if (o.onReport) o.onReport(report);
          return report;
        },
        (e) => {
          button.disabled = false;
          sum.dataset.verdict = 'bad';
          sum.textContent = t('team.netcheck.err', 'The check itself failed: {msg}', { msg: (e && e.message) || e });
          return null;
        }
      );
    }
    button.addEventListener('click', go);
    const save = el.querySelector('[data-broker-save]');
    if (save)
      save.addEventListener('click', () => {
        const input = el.querySelector('[data-broker]');
        const parsed = net.setBroker(input.value);
        input.value = parsed ? net.brokerText(parsed) : '';
        sum.dataset.verdict = parsed ? 'limited' : 'good';
        sum.textContent = parsed ? t('team.netcheck.adv.saved', 'Saved. New rooms use {host}. Everyone joining must set the same server.', { host: parsed.host }) : t('team.netcheck.adv.cleared', 'Back to the free public server.');
      });
    if (o.auto) go();
    api.run = go;
    api.destroy = () => {
      destroyed = true;
    };
    return api;
  }

  team.netcheck = { run, mount, classifyOrigin, verdict, checkBroker, checkWebRTC, PUBLIC_BROKER, last: null };
  if (typeof module !== 'undefined' && module.exports) module.exports = team.netcheck;
})();
