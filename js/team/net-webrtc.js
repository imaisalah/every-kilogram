// Mission Sprint: the WebRTC transport (docs/TEAM.md, "Every player on their own device").
// Loaded on demand by SMD.team.net. Everyone connects through the free public
// PeerJS broker (only to find each other) and Google's public STUN. No account
// and no server of ours.
//
// Two data channels per player, on one connection:
//   reliable, ordered   room actions and views   (PeerJS 'raw', our own chunking)
//   unreliable          controller input up, HUD and surface snapshots down
//
// Plain http:// pages: data channels do not need a secure context, unlike the
// camera or microphone. Checked in Chromium from http://192.168.x.x with
// isSecureContext false: broker, data channels, input and snapshots all worked.
//
// TURN: pass iceServers (or a getIceServers() that fetches short-lived
// credentials from a server of yours) to net.configure or to a session. Never
// put a TURN key in this file: anything in here ships to every player.
(function () {
  const SMD = globalThis.SMD;
  const team = SMD.team;

  const PEER_PREFIX = 'every-kilogram-v1-';
  const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTWXYZ';
  const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

  const BROKER_TIMEOUT_MS = 10000;
  const CONNECT_TIMEOUT_MS = 15000;
  const REDIAL_MS = 3000;
  const HOST_RETURN_MS = 120000; // host-left pause
  const ID_RETRIES = 20; // a returning host waits for the broker to free its old id
  const FAST_CHANNEL_ID = 64;
  const MAX_PEERS = 8;
  const CHUNK_CHARS = 14000; // plain ASCII after escaping, so characters are bytes
  const MAX_PEER_TEXT = 64 * 1024; // what a player may send the host in one message
  const MAX_BUFFERED_FAST = 64 * 1024; // drop rather than queue stale snapshots
  const REL_RATE = 40;
  const INPUT_RATE = 30;
  const FLOOD_STRIKES = 200;

  function randomCode() {
    const bytes = new Uint8Array(4);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
  }

  const asciiJson = (obj) => JSON.stringify(obj).replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

  // Whole messages start with 'M'; pieces are P<id>/<index>/<count>:<text>.
  function makeFramer() {
    let nextId = 1;
    const partial = new Map();
    return {
      frames(text) {
        if (text.length <= CHUNK_CHARS) return [`M${text}`];
        const id = nextId++;
        const count = Math.ceil(text.length / CHUNK_CHARS);
        const out = [];
        for (let i = 0; i < count; i++) out.push(`P${id}/${i}/${count}:${text.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS)}`);
        return out;
      },
      // Returns the complete text, or null while pieces are outstanding.
      receive(frame, maxChars) {
        if (typeof frame !== 'string' || !frame) return null;
        if (frame[0] === 'M') return frame.length - 1 <= maxChars ? frame.slice(1) : null;
        const m = /^P(\d+)\/(\d+)\/(\d+):/.exec(frame.slice(0, 40));
        if (!m) return null;
        const [head, id, index, count] = m;
        const total = Number(count);
        if (total < 1 || (total - 1) * CHUNK_CHARS > maxChars || Number(index) >= total) return null;
        let entry = partial.get(id);
        if (!entry) {
          if (partial.size >= 4) partial.clear(); // only an abusive sender gets here
          entry = { parts: new Array(total), got: 0 };
          partial.set(id, entry);
        }
        if (entry.parts[index] === undefined) entry.got++;
        entry.parts[index] = frame.slice(head.length);
        if (entry.got < total) return null;
        partial.delete(id);
        return entry.parts.join('');
      },
    };
  }

  function bucket(rate) {
    return { rate, capacity: rate * 2, tokens: rate * 2, last: Date.now() };
  }
  function allow(b) {
    const now = Date.now();
    b.tokens = Math.min(b.capacity, b.tokens + ((now - b.last) / 1000) * b.rate);
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  // Both ends create the same pre-agreed channel on the connection PeerJS built,
  // so no extra signalling is needed.
  function openFastChannel(conn, onData) {
    const pc = conn.peerConnection;
    if (!pc || !pc.createDataChannel) return null;
    try {
      const channel = pc.createDataChannel('ek-fast', { negotiated: true, id: FAST_CHANNEL_ID, ordered: false, maxRetransmits: 0 });
      channel.binaryType = 'arraybuffer';
      channel.onmessage = (ev) => onData(ev.data);
      return channel;
    } catch (e) {
      return null;
    }
  }

  function sendFast(channel, data) {
    if (!channel || channel.readyState !== 'open' || channel.bufferedAmount > MAX_BUFFERED_FAST) return false;
    try {
      channel.send(data);
      return true;
    } catch (e) {
      return false;
    }
  }

  function makePeer(id, iceServers) {
    const options = { debug: 0, config: { iceServers } };
    return id ? new globalThis.Peer(id, options) : new globalThis.Peer(options);
  }

  async function iceFor(opts) {
    const given = (opts && opts.iceServers) || team.net.iceServers();
    if (given) return given;
    const fetcher = (opts && opts.getIceServers) || team.net.iceServersProvider();
    if (fetcher) {
      try {
        const fetched = await fetcher();
        if (Array.isArray(fetched) && fetched.length) return fetched;
      } catch (e) {
        console.warn('[team.net] could not fetch ICE servers, using STUN only');
      }
    }
    return DEFAULT_ICE;
  }

  const brokerError = (type) => ['network', 'server-error', 'socket-error', 'socket-closed'].includes(type);

  // ---------- Host side ----------
  function hostLink(opts, ev) {
    let stopped = false;
    let peer = null;
    let opened = false;
    let idTries = 0;
    let brokerTimer = null;
    let retryTimer = null;
    let reconnectTimer = null;
    let code = opts.code || randomCode();
    const resuming = !!opts.code;
    let ice = null;
    const players = new Map();
    let nextCid = 1;

    function finish(reason) {
      if (stopped) return;
      stopped = true;
      teardown();
      ev.onFinal(reason);
    }

    function teardown() {
      clearTimeout(brokerTimer);
      clearTimeout(retryTimer);
      clearTimeout(reconnectTimer);
      for (const rec of players.values()) closeRecord(rec);
      players.clear();
      if (peer) {
        try {
          peer.destroy();
        } catch (e) {
          // Already gone.
        }
      }
    }

    function closeRecord(rec) {
      clearTimeout(rec.timer);
      try {
        if (rec.fast) rec.fast.close();
        rec.conn.close();
      } catch (e) {
        // Already closed.
      }
    }

    function open() {
      if (stopped) return;
      opened = false;
      if (peer) {
        try {
          peer.destroy();
        } catch (e) {
          // Replaced below.
        }
      }
      const current = makePeer(PEER_PREFIX + code, ice);
      peer = current;
      clearTimeout(brokerTimer);
      brokerTimer = setTimeout(() => {
        if (!opened) finish('broker-unreachable');
      }, BROKER_TIMEOUT_MS);
      current.on('open', () => {
        if (peer !== current) return;
        clearTimeout(brokerTimer);
        opened = true;
        idTries = 0;
        ev.onReady({ code });
      });
      current.on('connection', accept);
      // Losing the broker does not hurt players already connected; only new joins wait.
      current.on('disconnected', () => {
        if (stopped || peer !== current || current.destroyed) return;
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (!stopped && peer === current && !current.destroyed && current.disconnected) {
            try {
              current.reconnect();
            } catch (e) {
              // The next 'disconnected' or 'error' tries again.
            }
          }
        }, 2000);
      });
      current.on('error', (err) => {
        if (peer !== current || stopped) return;
        const type = err && err.type;
        if (type === 'unavailable-id') {
          if (resuming && ++idTries <= ID_RETRIES) {
            clearTimeout(brokerTimer);
            retryTimer = setTimeout(open, REDIAL_MS);
          } else if (resuming) finish('room-taken');
          else {
            code = randomCode();
            open();
          }
          return;
        }
        if (type === 'browser-incompatible') return finish('no-webrtc');
        if (brokerError(type)) {
          if (!opened) finish('broker-unreachable');
          else ev.onIssue({ code: 'broker-lost' });
          return;
        }
        if (type === 'webrtc') ev.onIssue({ code: 'ice-failed' });
      });
    }

    function accept(conn) {
      if (players.size >= MAX_PEERS) {
        conn.on('open', () => conn.close());
        return;
      }
      const cid = `r${nextCid++}`;
      const rec = { conn, fast: null, open: false, framer: makeFramer(), rel: bucket(REL_RATE), input: bucket(INPUT_RATE), strikes: 0, timer: null };
      players.set(cid, rec);
      rec.timer = setTimeout(() => {
        if (!rec.open) failPlayer(cid, rec, 'ice-timeout');
      }, CONNECT_TIMEOUT_MS);
      conn.on('open', () => {
        clearTimeout(rec.timer);
        rec.open = true;
        rec.fast = openFastChannel(conn, (data) => {
          if (typeof data !== 'string' || data.length > 128 || !data.startsWith('{"i":')) return;
          if (!allow(rec.input)) return strike(cid, rec);
          try {
            ev.onInput(cid, JSON.parse(data).i);
          } catch (e) {
            // Not JSON: dropped.
          }
        });
        ev.onPeerOpen(cid);
      });
      conn.on('data', (frame) => {
        const text = rec.framer.receive(frame, MAX_PEER_TEXT);
        if (text === null) return;
        if (!allow(rec.rel)) return strike(cid, rec);
        try {
          ev.onMessage(cid, JSON.parse(text));
        } catch (e) {
          // Not JSON: dropped.
        }
      });
      conn.on('iceStateChanged', (state) => {
        if (state === 'failed') failPlayer(cid, rec, 'ice-failed');
      });
      conn.on('close', () => playerGone(cid, rec));
      conn.on('error', () => {});
    }

    function strike(cid, rec) {
      if (++rec.strikes >= FLOOD_STRIKES) failPlayer(cid, rec, 'flooding');
    }

    function failPlayer(cid, rec, code2) {
      ev.onIssue({ cid, code: code2 });
      closeRecord(rec);
      playerGone(cid, rec);
    }

    function playerGone(cid, rec) {
      if (players.get(cid) !== rec) return;
      players.delete(cid);
      clearTimeout(rec.timer);
      if (rec.open) ev.onPeerClose(cid);
    }

    iceFor(opts).then((list) => {
      ice = list;
      if (!stopped) open();
    });

    return {
      sendTo(cid, obj) {
        const rec = players.get(cid);
        if (!rec || !rec.open) return false;
        for (const frame of rec.framer.frames(asciiJson(obj))) rec.conn.send(frame);
        return true;
      },
      sendFast(cid, obj) {
        const rec = players.get(cid);
        return !!rec && (sendFast(rec.fast, JSON.stringify(obj)) || this.sendTo(cid, obj));
      },
      sendBytes(cid, bytes) {
        const rec = players.get(cid);
        return !!rec && sendFast(rec.fast, bytes);
      },
      kick(cid) {
        const rec = players.get(cid);
        if (rec) {
          closeRecord(rec);
          playerGone(cid, rec);
        }
      },
      closeRoom() {
        for (const [cid] of players) this.sendTo(cid, { k: 'bye', code: 'host-closed' });
      },
      stop() {
        if (stopped) return;
        stopped = true;
        teardown();
      },
      get code() {
        return code;
      },
    };
  }

  // ---------- Player side ----------
  function clientLink(codeRaw, opts, ev) {
    const hostId = PEER_PREFIX + codeRaw;
    let stopped = false;
    let peer = null;
    let conn = null;
    let fast = null;
    let linked = false; // the reliable channel is up right now
    let everLinked = false;
    let framer = makeFramer();
    let brokerTimer = null;
    let dialTimer = null;
    let connectTimer = null;
    let awaySince = 0;

    function finish(reason) {
      if (stopped) return;
      stopped = true;
      clearTimers();
      closeConn();
      if (peer) {
        try {
          peer.destroy();
        } catch (e) {
          // Already gone.
        }
      }
      ev.onFinal(reason);
    }

    function clearTimers() {
      clearTimeout(brokerTimer);
      clearTimeout(dialTimer);
      clearTimeout(connectTimer);
    }

    function closeConn() {
      const c = conn;
      conn = null;
      fast = null;
      linked = false;
      if (!c) return;
      try {
        c.close();
      } catch (e) {
        // Already closed.
      }
    }

    // Keep dialling while the host has time left to come back.
    function redial() {
      if (stopped) return;
      if (awaySince && Date.now() - awaySince > HOST_RETURN_MS) return finish('host-timeout');
      clearTimeout(dialTimer);
      dialTimer = setTimeout(dial, REDIAL_MS);
    }

    function hostAway() {
      if (!awaySince) awaySince = Date.now();
      if (linked) linked = false;
      ev.onHost(false);
      redial();
    }

    function dial() {
      if (stopped) return;
      closeConn();
      if (peer.destroyed || peer.disconnected) {
        if (peer.disconnected && !peer.destroyed) {
          try {
            peer.reconnect();
          } catch (e) {
            // Falls through to the redial below.
          }
        }
        if (peer.disconnected || peer.destroyed) return redial();
      }
      framer = makeFramer();
      const next = peer.connect(hostId, { reliable: true, serialization: 'raw', label: 'ek' });
      conn = next;
      clearTimeout(connectTimer);
      connectTimer = setTimeout(() => {
        if (conn !== next || linked) return;
        giveUpDial(next, 'ice-timeout');
      }, CONNECT_TIMEOUT_MS);
      next.on('open', () => {
        if (conn !== next) return;
        clearTimeout(connectTimer);
        linked = true;
        everLinked = true;
        awaySince = 0;
        fast = openFastChannel(next, (data) => {
          if (typeof data === 'string') {
            try {
              ev.onMessage(JSON.parse(data));
            } catch (e) {
              // Not JSON: dropped.
            }
          } else ev.onBytes(new Uint8Array(data));
        });
        ev.onHost(true);
      });
      next.on('data', (frame) => {
        if (conn !== next) return;
        const text = framer.receive(frame, 4 * 1024 * 1024);
        if (text === null) return;
        try {
          ev.onMessage(JSON.parse(text));
        } catch (e) {
          // Not JSON: dropped.
        }
      });
      next.on('iceStateChanged', (state) => {
        if (conn === next && state === 'failed') giveUpDial(next, 'ice-failed');
      });
      next.on('close', () => {
        if (conn !== next) return;
        closeConn();
        hostAway();
      });
      next.on('error', () => {});
    }

    function giveUpDial(which, reason) {
      if (conn !== which) return;
      closeConn();
      // Never connected at all: a network that cannot reach the host. Say so.
      if (!everLinked) return finish(reason);
      hostAway();
    }

    iceFor(opts).then((ice) => {
      if (stopped) return;
      peer = makePeer(null, ice);
      brokerTimer = setTimeout(() => finish('broker-unreachable'), BROKER_TIMEOUT_MS);
      peer.on('open', () => {
        clearTimeout(brokerTimer);
        if (!linked) dial();
      });
      peer.on('disconnected', () => {
        if (!stopped && peer && !peer.destroyed) setTimeout(() => {
          if (!stopped && peer && !peer.destroyed && peer.disconnected) {
            try {
              peer.reconnect();
            } catch (e) {
              // Tried again on the next dial.
            }
          }
        }, 2000);
      });
      peer.on('error', (err) => {
        if (stopped) return;
        const type = err && err.type;
        if (type === 'peer-unavailable') {
          if (everLinked) hostAway();
          else finish('no-room');
          return;
        }
        if (type === 'browser-incompatible') return finish('no-webrtc');
        if (brokerError(type) && !everLinked && !linked) return finish('broker-unreachable');
      });
    });

    return {
      send(obj) {
        if (!linked || !conn) return false;
        for (const frame of framer.frames(asciiJson(obj))) conn.send(frame);
        return true;
      },
      sendInput(text) {
        return sendFast(fast, text);
      },
      forceDrop() {
        if (conn) {
          const c = conn;
          closeConn();
          try {
            c.close();
          } catch (e) {
            // Already closed.
          }
          hostAway();
        }
      },
      stop() {
        if (stopped) return;
        stopped = true;
        clearTimers();
        closeConn();
        if (peer) {
          try {
            peer.destroy();
          } catch (e) {
            // Already gone.
          }
        }
      },
    };
  }

  team.net.registerTransport('webrtc', { hostLink, clientLink, DEFAULT_ICE, HOST_RETURN_MS });
})();
