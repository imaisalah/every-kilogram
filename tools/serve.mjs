// No-cache static server for development, plus the team-game relay.
// Usage: node tools/serve.mjs [port] [bindAddress]   (serves the game folder)
//
// On the same port:
//   GET /api/info   what this server is and the LAN addresses phones can use
//   GET /ws?...     a WebSocket relay (RFC 6455, written by hand: no npm deps)
//
// The relay moves messages between one host and the phones in a room and
// never reads the game inside them. Room rules live in the host's browser.
//   /ws?as=host                     open a new room, answers with code and key
//   /ws?as=host&room=CODE&key=KEY   the host coming back after a refresh
//   /ws?room=CODE                   a phone joining
// Text frames only, JSON only:
//   host -> relay   {to: cid | [cid...] | '*', d}   {t:'kick', cid, code}   {t:'ping'}   {t:'close'}
//   phone -> relay  {d}   {t:'ping'}   {"i":[...]} (controller input, see below)
//   relay -> host   {t:'welcome', room, key, peers}  {t:'join', cid}  {t:'left', cid}  {t:'msg', from, d}  {t:'i', from, i}  {t:'pong'}
//   relay -> phone  {t:'welcome', room, cid, host}   {t:'host', up}   {t:'msg', d}     {t:'pong'}
// Controller input is its own channel: a text frame that begins exactly {"i":
// and is at most 128 bytes, up to 20 a second per phone. It has its own rate
// budget, so a phone steering hard never starves its other actions and a flood
// of either kind is still cut off.
// Close codes the page can read: 4400 bad request, 4401 wrong key, 4403 bad
// origin, 4404 no such room, 4408 room expired, 4409 room full, 4410 room
// closed by host, 4429 flooding, 4503 server full. 4000 is "replaced by a newer connection".
import http from 'node:http';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const rootPrefix = root.endsWith(sep) ? root : root + sep;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

// 4 letters, none that a phone keyboard or a far-away screen can confuse
// (no I/L/O, which look like 1/1/0; no U/V, which look alike).
export const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTWXYZ';

export const DEFAULT_LIMITS = {
  maxRooms: 64,
  maxPeersPerRoom: 10, // 4 players, plus sockets a sleeping phone left behind
  maxConnections: 256,
  maxHostMessage: 512 * 1024, // a full per-player view
  maxPeerMessage: 16 * 1024, // a phone only ever sends short actions
  hostRate: 400, // messages per second, sustained
  peerRate: 40,
  inputRate: 30, // controller frames per second per phone (phones send at most 20)
  maxInputMessage: 128,
  burstSeconds: 2, // how much of the rate may arrive at once
  floodStrikes: 100, // messages over the limit before the socket is closed
  roomIdleMs: 45 * 60 * 1000, // nothing at all happened in the room
  hostGoneMs: 10 * 60 * 1000, // host left and did not come back
  pingEveryMs: 15000,
  deadAfterMs: 40000,
  sweepEveryMs: 5000,
  maxBufferedBytes: 4 * 1024 * 1024, // a socket that stops reading is dropped
};

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const utf8 = new TextDecoder('utf-8', { fatal: true });
const OP = { CONT: 0, TEXT: 1, BINARY: 2, CLOSE: 8, PING: 9, PONG: 10 };
const MAX_FRAGMENTS = 256;

function encodeFrame(opcode, payload) {
  const len = payload.length;
  let head;
  if (len < 126) {
    head = Buffer.alloc(2);
    head[1] = len;
  } else if (len < 65536) {
    head = Buffer.alloc(4);
    head[1] = 126;
    head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10);
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(len), 2);
  }
  head[0] = 0x80 | opcode;
  return Buffer.concat([head, payload]);
}

function validCloseCode(code) {
  return (code >= 1000 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999);
}

function newBucket(rate, burstSeconds) {
  const capacity = Math.max(1, rate * burstSeconds);
  return { rate, capacity, tokens: capacity, last: Date.now() };
}

// One WebSocket: parses client frames, writes server frames. Any protocol
// violation closes this socket and touches nothing else.
class Connection {
  constructor(socket, limits, { maxMessage, rate, onMessage, onClose }) {
    this.socket = socket;
    this.limits = limits;
    this.maxMessage = maxMessage;
    this.rate = rate;
    this.bucket = newBucket(rate, limits.burstSeconds);
    this.inputBucket = newBucket(limits.inputRate, limits.burstSeconds);
    this.strikes = 0;
    this.onMessage = onMessage;
    this.onClose = onClose;
    this.buffer = null;
    this.fragments = null;
    this.fragmentBytes = 0;
    this.closing = false;
    this.ended = false;
    this.lastSeen = Date.now();

    socket.setNoDelay(true);
    socket.on('data', (chunk) => this.receive(chunk));
    socket.on('error', () => this.destroy());
    socket.on('close', () => this.destroy());
    socket.on('end', () => this.destroy());
  }

  receive(chunk) {
    if (this.ended) return;
    this.lastSeen = Date.now();
    this.buffer = this.buffer && this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    try {
      while (!this.ended && this.parseFrame());
    } catch (e) {
      this.close(1011, 'server error');
    }
  }

  // Returns true when a whole frame was consumed and another may follow.
  parseFrame() {
    const buf = this.buffer;
    if (!buf || buf.length < 2) return false;
    const fin = (buf[0] & 0x80) !== 0;
    const rsv = buf[0] & 0x70;
    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let offset = 2;

    if (rsv) return this.close(1002, 'reserved bits set'), false;
    if (!masked) return this.close(1002, 'client frames must be masked'), false;
    const control = opcode >= 8;
    if (![OP.CONT, OP.TEXT, OP.BINARY, OP.CLOSE, OP.PING, OP.PONG].includes(opcode)) {
      return this.close(1002, 'unknown opcode'), false;
    }
    if (control && (!fin || len > 125)) return this.close(1002, 'bad control frame'), false;

    if (len === 126) {
      if (buf.length < 4) return false;
      len = buf.readUInt16BE(2);
      offset = 4;
      if (len < 126) return this.close(1002, 'length not minimal'), false;
    } else if (len === 127) {
      if (buf.length < 10) return false;
      const big = buf.readBigUInt64BE(2);
      if (big >> 63n) return this.close(1002, 'length out of range'), false;
      if (big > BigInt(this.maxMessage)) return this.close(1009, 'message too big'), false;
      len = Number(big);
      offset = 10;
      if (len < 65536) return this.close(1002, 'length not minimal'), false;
    }
    if (!control && len + this.fragmentBytes > this.maxMessage) return this.close(1009, 'message too big'), false;

    if (buf.length < offset + 4 + len) return false;
    const mask = buf.subarray(offset, offset + 4);
    const payload = Buffer.from(buf.subarray(offset + 4, offset + 4 + len));
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    this.buffer = buf.subarray(offset + 4 + len);

    if (control) this.control(opcode, payload);
    else this.data(opcode, fin, payload);
    return true;
  }

  control(opcode, payload) {
    if (opcode === OP.PING) {
      if (!this.closing) this.write(encodeFrame(OP.PONG, payload));
      return;
    }
    if (opcode === OP.PONG) return;
    // A close frame carries nothing, or a 2-byte code and an optional UTF-8 reason.
    let code = 1000;
    if (payload.length === 1) code = 1002;
    else if (payload.length >= 2) {
      code = payload.readUInt16BE(0);
      if (!validCloseCode(code)) code = 1002;
      else {
        try {
          utf8.decode(payload.subarray(2));
        } catch (e) {
          code = 1007;
        }
      }
    }
    this.close(code, '');
  }

  data(opcode, fin, payload) {
    if (opcode === OP.BINARY) return this.close(1003, 'text only');
    if (opcode === OP.CONT) {
      if (!this.fragments) return this.close(1002, 'continuation with nothing to continue');
    } else if (this.fragments) {
      return this.close(1002, 'new message inside a fragmented one');
    }
    if (!fin || this.fragments) {
      this.fragments = this.fragments || [];
      this.fragments.push(payload);
      this.fragmentBytes += payload.length;
      if (this.fragments.length > MAX_FRAGMENTS) return this.close(1009, 'too many fragments');
      if (!fin) return;
      payload = Buffer.concat(this.fragments);
      this.fragments = null;
      this.fragmentBytes = 0;
    }
    let text;
    try {
      text = utf8.decode(payload);
    } catch (e) {
      return this.close(1007, 'not UTF-8');
    }
    // Input frames are recognised by their first bytes, before any JSON parsing.
    const isInput = text.startsWith('{"i":');
    if (isInput && payload.length > this.limits.maxInputMessage) return this.strike();
    if (!this.takeToken(isInput ? this.inputBucket : this.bucket)) return;
    let message;
    try {
      message = JSON.parse(text);
    } catch (e) {
      return this.close(1007, 'not JSON');
    }
    if (!message || typeof message !== 'object' || Array.isArray(message)) return this.close(1007, 'not an object');
    this.onMessage(message);
  }

  takeToken(bucket) {
    const now = Date.now();
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + ((now - bucket.last) / 1000) * bucket.rate);
    bucket.last = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    this.strike();
    return false;
  }

  strike() {
    if (++this.strikes >= this.limits.floodStrikes) this.close(4429, 'flooding');
  }

  write(frame) {
    if (this.ended || this.socket.destroyed) return;
    if (this.socket.writableLength > this.limits.maxBufferedBytes) return this.destroy();
    this.socket.write(frame);
  }

  send(obj) {
    if (this.closing) return;
    this.write(encodeFrame(OP.TEXT, Buffer.from(JSON.stringify(obj), 'utf8')));
  }

  ping() {
    if (!this.closing) this.write(encodeFrame(OP.PING, Buffer.alloc(0)));
  }

  close(code, reason) {
    if (this.closing || this.ended) return;
    this.closing = true;
    const text = Buffer.from(String(reason || '').slice(0, 100), 'utf8');
    const body = Buffer.alloc(2 + text.length);
    body.writeUInt16BE(code, 0);
    text.copy(body, 2);
    this.write(encodeFrame(OP.CLOSE, body));
    if (!this.socket.destroyed) this.socket.end();
    this.closeTimer = setTimeout(() => this.destroy(), 1000);
    this.closeTimer.unref?.();
  }

  destroy() {
    if (this.ended) return;
    this.ended = true;
    this.closing = true;
    clearTimeout(this.closeTimer);
    this.buffer = null;
    this.fragments = null;
    if (!this.socket.destroyed) this.socket.destroy();
    this.onClose();
  }
}

function lanAddresses() {
  const out = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const a of nets[name] || []) {
      if (a.internal || a.family !== 'IPv4' || a.address.startsWith('169.254.')) continue;
      out.push({ address: a.address, name });
    }
  }
  // Real Wi-Fi/Ethernet first; virtual adapters (WSL, Hyper-V, VPN) last.
  const virtual = (n) => (/vethernet|virtual|vmware|vbox|docker|wsl|hyper-v|loopback|tailscale|vpn/i.test(n) ? 1 : 0);
  const privateFirst = (ip) => (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ? 0 : 1);
  return out.sort((a, b) => virtual(a.name) - virtual(b.name) || privateFirst(a.address) - privateFirst(b.address));
}

// True when the path tries to climb out, in any spelling a client might use.
// URL parsing would silently flatten these, so look at the raw request first.
function climbsOut(rawUrl) {
  const raw = rawUrl.split(/[?#]/, 1)[0];
  const decoded = decodeURIComponent(raw);
  return decoded.split(/[\\/]/).includes('..') || decoded.includes('\0');
}

export async function startServer(options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const bind = options.host || '127.0.0.1';
  const rooms = new Map();
  const connections = new Set();
  let boundPort = options.port ?? 8770;

  function newCode() {
    for (let tries = 0; tries < 200; tries++) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_LETTERS[randomInt(CODE_LETTERS.length)];
      if (!rooms.has(code)) return code;
    }
    return null;
  }

  // ---- WebSocket upgrade ----------------------------------------------------
  function refuseHttp(socket, status, text) {
    socket.on('error', () => {});
    socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }

  function acceptUpgrade(req, socket, head) {
    socket.on('error', () => {});
    const headers = req.headers;
    const key = headers['sec-websocket-key'];
    const upgrade = String(headers.upgrade || '').toLowerCase();
    if (req.method !== 'GET' || upgrade !== 'websocket' || !key || headers['sec-websocket-version'] !== '13') {
      return refuseHttp(socket, 400, 'Bad Request');
    }
    if (Buffer.from(key, 'base64').length !== 16) return refuseHttp(socket, 400, 'Bad Request');

    let url;
    try {
      url = new URL(req.url, 'http://x');
    } catch (e) {
      return refuseHttp(socket, 400, 'Bad Request');
    }
    if (url.pathname !== '/ws') return refuseHttp(socket, 404, 'Not Found');

    const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    const isHost = url.searchParams.get('as') === 'host';
    const conn = new Connection(socket, limits, {
      maxMessage: isHost ? limits.maxHostMessage : limits.maxPeerMessage,
      rate: isHost ? limits.hostRate : limits.peerRate,
      onMessage: () => {},
      onClose: () => connections.delete(conn),
    });
    connections.add(conn);

    // A browser cannot read the status of a failed upgrade, so every refusal
    // from here on is an open socket closed with a code the page can read.
    if (!originAllowed(headers)) return conn.close(4403, 'bad-origin');
    if (connections.size > limits.maxConnections) return conn.close(4503, 'server-full');
    if (isHost) attachHost(conn, url.searchParams);
    else attachPeer(conn, url.searchParams);
    if (head && head.length) conn.receive(head);
  }

  // Stops another website the phone is visiting from opening sockets here.
  function originAllowed(headers) {
    if (!headers.origin) return true;
    try {
      return new URL(headers.origin).host.toLowerCase() === String(headers.host || '').toLowerCase();
    } catch (e) {
      return false;
    }
  }

  function normalizeCode(value) {
    return String(value || '').trim().toUpperCase();
  }

  function attachHost(conn, params) {
    const wanted = normalizeCode(params.get('room'));
    let room;
    if (wanted) {
      room = rooms.get(wanted);
      if (!room) return conn.close(4404, 'no-room');
      if (params.get('key') !== room.key) return conn.close(4401, 'bad-key');
      if (room.host) room.host.close(4000, 'replaced');
    } else {
      if (rooms.size >= limits.maxRooms) return conn.close(4503, 'server-full');
      const code = newCode();
      if (!code) return conn.close(4503, 'server-full');
      room = { code, key: randomBytes(16).toString('hex'), host: null, peers: new Map(), hostGoneAt: 0, lastActive: Date.now(), nextCid: 1 };
      rooms.set(code, room);
    }
    room.host = conn;
    room.hostGoneAt = 0;
    room.lastActive = Date.now();
    conn.onMessage = (m) => fromHost(room, conn, m);
    conn.onClose = () => {
      connections.delete(conn);
      if (room.host !== conn) return;
      room.host = null;
      room.hostGoneAt = Date.now();
      for (const peer of room.peers.values()) peer.send({ t: 'host', up: false });
    };
    conn.send({ t: 'welcome', room: room.code, key: room.key, peers: [...room.peers.keys()] });
    for (const peer of room.peers.values()) peer.send({ t: 'host', up: true });
  }

  function attachPeer(conn, params) {
    const room = rooms.get(normalizeCode(params.get('room')));
    if (!room) return conn.close(4404, 'no-room');
    if (room.peers.size >= limits.maxPeersPerRoom) return conn.close(4409, 'room-full');
    const cid = `c${room.nextCid++}`;
    room.peers.set(cid, conn);
    room.lastActive = Date.now();
    conn.onMessage = (m) => fromPeer(room, cid, conn, m);
    conn.onClose = () => {
      connections.delete(conn);
      if (room.peers.get(cid) !== conn) return;
      room.peers.delete(cid);
      room.host?.send({ t: 'left', cid });
    };
    conn.send({ t: 'welcome', room: room.code, cid, host: !!room.host });
    room.host?.send({ t: 'join', cid });
  }

  function fromHost(room, conn, m) {
    room.lastActive = Date.now();
    if (m.t === 'ping') return conn.send({ t: 'pong' });
    if (m.t === 'kick') {
      const peer = room.peers.get(String(m.cid));
      if (peer) peer.close(Number.isInteger(m.code) && m.code >= 4000 && m.code <= 4999 ? m.code : 4000, 'kicked');
      return;
    }
    if (m.t === 'close') return closeRoom(room, 4410, 'host-closed');
    if (m.to === undefined) return;
    const payload = { t: 'msg', d: m.d };
    if (m.to === '*') {
      for (const peer of room.peers.values()) peer.send(payload);
      return;
    }
    for (const cid of Array.isArray(m.to) ? m.to : [m.to]) room.peers.get(String(cid))?.send(payload);
  }

  function fromPeer(room, cid, conn, m) {
    room.lastActive = Date.now();
    if (m.i !== undefined) return room.host?.send({ t: 'i', from: cid, i: m.i });
    if (m.t === 'ping') return conn.send({ t: 'pong' });
    if (m.d === undefined) return;
    room.host?.send({ t: 'msg', from: cid, d: m.d });
  }

  function closeRoom(room, code, reason) {
    if (rooms.get(room.code) !== room) return;
    rooms.delete(room.code);
    for (const peer of room.peers.values()) peer.close(code, reason);
    room.peers.clear();
    if (room.host) room.host.close(code, reason);
    room.host = null;
  }

  // ---- Static files and /api/info ---------------------------------------------
  function sendInfo(res) {
    const lan = lanAddresses();
    const open = bind !== '127.0.0.1' && bind !== 'localhost' && bind !== '::1';
    const body = JSON.stringify({
      app: 'every-kilogram',
      relay: true,
      port: boundPort,
      bound: bind,
      joinable: open && lan.length > 0,
      lan,
      urls: open ? lan.map((a) => `http://${a.address}:${boundPort}/`) : [],
      rooms: rooms.size,
      maxPlayers: 4,
    });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(body);
  }

  async function serveStatic(req, res) {
    try {
      if (climbsOut(req.url)) {
        res.writeHead(403, { 'Cache-Control': 'no-store' });
        res.end('forbidden');
        return;
      }
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = normalize(join(root, path));
      if (file !== root && !file.startsWith(rootPrefix)) throw new Error('outside');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (e) {
      res.writeHead(404, { 'Cache-Control': 'no-store' });
      res.end('not found');
    }
  }

  const server = http.createServer((req, res) => {
    let pathname = '';
    try {
      pathname = new URL(req.url, 'http://x').pathname;
    } catch (e) {
      // serveStatic answers 404 for anything that does not parse.
    }
    if (pathname === '/api/info') return sendInfo(res);
    if (pathname === '/ws') {
      res.writeHead(426, { 'Cache-Control': 'no-store', Upgrade: 'websocket' });
      return res.end('websocket only');
    }
    serveStatic(req, res);
  });

  server.on('upgrade', (req, socket, head) => {
    try {
      acceptUpgrade(req, socket, head);
    } catch (e) {
      socket.destroy();
    }
  });

  // ---- Housekeeping -----------------------------------------------------------
  const pinger = setInterval(() => {
    const now = Date.now();
    for (const conn of connections) {
      if (now - conn.lastSeen > limits.deadAfterMs) conn.destroy();
      else conn.ping();
    }
  }, limits.pingEveryMs);
  pinger.unref?.();

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const room of [...rooms.values()]) {
      const hostGone = !room.host && room.hostGoneAt && now - room.hostGoneAt > limits.hostGoneMs;
      if (hostGone || now - room.lastActive > limits.roomIdleMs) closeRoom(room, 4408, 'expired');
    }
  }, limits.sweepEveryMs);
  sweeper.unref?.();

  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(boundPort, bind, () => {
      server.removeListener('error', fail);
      boundPort = server.address().port;
      done();
    });
  });

  return {
    server,
    port: boundPort,
    host: bind,
    limits,
    roomCount: () => rooms.size,
    connectionCount: () => connections.size,
    close() {
      clearInterval(pinger);
      clearInterval(sweeper);
      for (const room of [...rooms.values()]) closeRoom(room, 1001, 'server-stopping');
      for (const conn of [...connections]) conn.destroy();
      return new Promise((done) => server.close(() => done()));
    },
  };
}

// Run directly: the same command line as before.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 8770);
  const host = process.argv[3] || '127.0.0.1';
  // A second argument (e.g. 0.0.0.0) opens it to other devices on the same network.
  startServer({ port, host }).then(
    (s) => {
      console.log(`serving ${rootPrefix} on http://${host}:${s.port}/`);
      if (host !== '127.0.0.1' && host !== 'localhost') {
        const lan = lanAddresses();
        if (lan.length) console.log(`phones on the same Wi-Fi: http://${lan[0].address}:${s.port}/join.html`);
        for (const a of lan.slice(1)) console.log(`  also try (${a.name}): http://${a.address}:${s.port}/join.html`);
      }
    },
    (e) => {
      console.error(e.code === 'EADDRINUSE' ? `port ${port} is already in use: close the other copy of the game and try again.` : e.message);
      process.exit(1);
    }
  );
}
