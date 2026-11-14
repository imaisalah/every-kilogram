# Playing together on different devices (as built, v3)

"Everyone on their own device" needs no game server. One player's browser is the
host; the others connect straight to it with WebRTC. Two outside services are
used, both free and both only to *find* each other: the public PeerJS broker
(`0.peerjs.com`, signalling) and Google's public STUN servers (to learn each
device's public address). Game traffic never goes through either.

## 1. Host the game online once (GitHub Pages): "play from anywhere"

The whole game is static files. There is no build step and no server code to run.

1. Push the repo to GitHub (the `main` branch, root folder).
2. Repository **Settings → Pages → Build and deployment**: Source *Deploy from a
   branch*, branch `main`, folder `/ (root)`. Save.
3. After a minute the game is at `https://<user>.github.io/<repo>/`. Open it
   there, press **Play with friends → Everyone on their own device**.

Why this is the fix for "playing together isn't available": the invite link is
built from the page's own address (`location.origin + location.pathname`, see
`js/team/view-setup.js`, `drawRoom`). Opened from `play.bat` the page lives at
`http://localhost:8770/`, so the link says `localhost:8770/index.html#j=ABCD`,
which on a friend's phone means *their own* phone. Opened from GitHub Pages the
link is `https://<user>.github.io/<repo>/index.html#j=ABCD`, which opens
anywhere. Nothing else changes: the broker and STUN are reached from any origin,
`http://` or `https://` (data channels do not need a secure context).

Any static host works the same way (Netlify, Cloudflare Pages, an S3 bucket, a
school web server): copy the folder, open `index.html` from its public address.

## 2. How the room code and the invite link work

- The host's browser registers with the broker under the peer id
  `every-kilogram-v1-<CODE>`, where CODE is 4 letters from an alphabet without
  look-alikes (`ABCDEFGHJKMNPQRSTWXYZ`). If the id is taken, a new code is drawn.
- The invite link is `<page address>/index.html#j=<CODE>`. `js/screen-team.js`
  reads `#j=` on load, removes it from the address bar and opens the join form
  with the code filled in. A friend can also type the code by hand.
- A joining browser asks the broker for an anonymous id, then dials
  `every-kilogram-v1-<CODE>`. The broker passes the WebRTC offer/answer and ICE
  candidates between the two; from then on they talk directly. Two data
  channels per player: reliable/ordered for room actions and views, unreliable
  for controller input and surface snapshots.
- Each joining browser keeps a random token per room in `localStorage`
  (`ek.team.token.<CODE>`). Reloading the page and opening the same link puts
  the player back in the same seat (`reconnect` in `js/team/room.js`),
  measured at about 1 s in the 3-browser run below.
- The host checkpoints the room once a second in `localStorage`
  (`ek.team.host.rtc`). If the host reloads or closes the tab and comes back
  within 2 minutes, the title screen offers "Your room ABCD is still open. Go
  back"; the room re-registers under the same code and the clients, who were
  showing "The host left. Waiting up to 2 minutes", carry on from the same
  state. Measured: clients back in 4 s after the host's reload.

## 3. Same Wi-Fi mode (no internet needed for the game itself)

`play-team.bat` (or `node tools/serve.mjs 8770 0.0.0.0`) serves the game on
every network interface and prints the LAN address, e.g.
`http://192.168.1.10:8770/`. Open the game from **that** address on the host
computer (not from `localhost`) so the invite link and QR code carry it; phones
on the same Wi-Fi open it directly. "Same room with phones" then uses the
built-in WebSocket relay in `tools/serve.mjs` and needs neither the broker nor
STUN. "Everyone on their own device" still uses the broker to find each other,
even on one Wi-Fi.

## 4. The connection check: "Can your friends reach you?"

`js/team/netcheck.js` (`SMD.team.netcheck`) runs three checks and says, in
plain words, what works and what to do:

| Check | What it does | Result and next step |
| --- | --- | --- |
| Where the game was opened | Classifies `location`: `file:`, localhost/127.x/::1, a private Wi-Fi address (10.x, 192.168.x, 172.16-31.x, `.local`), or a hosted site | file/localhost: **friends cannot open your link; open the online address, or play-team.bat on the same Wi-Fi**. LAN: same-Wi-Fi only. Hosted: fine |
| The connecting service | Opens a throw-away PeerJS peer on the broker in use (falls back to the broker's HTTP `/peerjs/id` when PeerJS cannot load) with a 10 s limit | Down: **nobody can find a room; check the internet, retry in a minute, or play-team.bat / One screen** |
| Direct connections (WebRTC) | A loopback `RTCPeerConnection` pair must open a data channel in 10 s (**ICE failed** / **timed out** otherwise); a separate lone connection gathers candidates to see whether a STUN server answered (`srflx`) | No WebRTC: use a current browser. Failed/timeout: **a firewall, VPN or school network blocks WebRTC; try another network or a phone hotspot**. No STUN answer: **same Wi-Fi works, elsewhere probably not** |

The two WebRTC connections are separate on purpose: Chromium stops gathering
as soon as a loopback connects over host candidates (measured: "gathering
complete" 20 ms after the first host candidate, no srflx), so a loopback alone
cannot tell whether STUN answered.

API: `SMD.team.netcheck.run() → Promise<report>` with
`report = { ok, verdict: 'good'|'limited'|'bad', summary, items[3], origin, broker, webrtc, ms }`,
each item `{ id, status: 'ok'|'warn'|'bad', title, text, next }`.
`SMD.team.netcheck.mount(el, { auto, onReport })` draws a button, the three
rows and the verdict, plus an **Advanced** box for a custom broker.
Arabic for every string is in `js/team/ar-net.js`.

Script tags (classic scripts, after `js/team/net.js`): `index.html` and
`join.html` both need

```html
<script src="js/team/ar-net.js"></script>      <!-- next to the other ar-*.js -->
<script src="js/team/netcheck.js"></script>    <!-- right after js/team/net.js -->
```

Where the lobby shows it (`js/team/view-setup.js`, room step): add
`<div data-netcheck></div>` under `[data-conn]` and, once per mount,
`const nc = SMD.team.netcheck.mount(el.querySelector('[data-netcheck]'), {})`,
calling `nc.destroy()` from the view's cleanup. The join form (`phone.js`) can
mount the same panel under the form when a join ends in `closed`.

## 5. What fails, why, and what the player sees

Every failure is a status code in `SMD.team.net.MESSAGES` (English) with
Arabic as `team.net.msg.<code>`; the lobby, the join form and the in-game net
bar show the text, and nothing hangs silently.

| Code | When | What to do (as shown) |
| --- | --- | --- |
| `broker-slow` | the broker did not answer within 10 s; the game retries twice more (backoff 1 s, 3 s; 8 s each) | "The connecting service is slow today. Still trying…" |
| `broker-unreachable` | all three tries failed (about 30 s), or the socket errored before it opened | check the internet, retry in a minute, play-team.bat on the same Wi-Fi, or One screen |
| `no-room` | the broker has no peer under that code: wrong letters, the host closed the room, or the host's room is registered on a different broker | check the code and that the host's room is still open; if the host opened the game from localhost, ask them to open the online link |
| `ice-failed` | ICE reported `failed`: no path between the two networks (symmetric/carrier NAT, firewall) and we have no TURN | join the same Wi-Fi as the host, try a different network, or Same room / One screen |
| `ice-timeout` | no data channel in 15 s | same as above |
| `host-away` | the host's connection dropped (reload, closed tab, sleep) | "Waiting up to 2 minutes for them to come back." The client keeps redialling every 3 s |
| `host-timeout` | 2 minutes passed without the host | "This round is over." Start a new room |
| `host-closed` | the host pressed Back / ended the game | "The host ended the game." |
| `room-taken` | a returning host's code is still held by someone else after 20 retries | start a new room |
| `no-webrtc` | no `RTCPeerConnection` in this browser | use a current Chrome, Edge, Firefox or Safari |
| `old-version` | host and client run different protocol versions | reload the page |

Known limits, by design (see docs/TEAM.md "Every player on their own device"):

- **No TURN relay.** Roughly 15-25% of pairs (mostly mobile carrier NAT, some
  campus networks) cannot connect directly. The game says so per player
  (`ice-failed`) instead of hanging. The hook for TURN is
  `SMD.team.net.configure({ iceServers })` or `{ getIceServers }` (short-lived
  credentials minted server-side; never a key in the client).
- **No host migration.** If the host never comes back, the round ends.
- **The broker is a free public service** and has slow days. There is no
  second public PeerJS host (checked 2026-11-14: the PeerJS docs and the
  peerjs-server README name only `0.peerjs.com`), so the game retries with
  backoff and lets a host run their own PeerServer instead:
  `npx peer --port 9000` on any machine with a public address (or the same
  Wi-Fi), then enter `ws://<that address>:9000/` (or `wss://…` behind TLS) in
  the connection check's **Advanced** box on **every** device, host and
  players alike: the room code lives on the broker, so everyone must use the
  same one. Programmatic: `SMD.team.net.configure({ broker: 'wss://host:port/path?key=…' })`
  or per session `createHost({ broker })` / `join(code, name, token, { broker })`.
  The setting is per device (`localStorage` `ek.team.broker`); it is **not**
  carried in the invite link.
- A hash-only navigation does not restart the game: if a tab already shows the
  title and the player edits the address bar to add `#j=CODE`, nothing happens
  until they reload. Opening the link in a new tab, or pressing Enter on a
  changed query string, works.

## 6. Verified (headless Chromium, 2026-11-14, public broker, this repo served by `node tools/serve.mjs 8941`)

Three browsers (host 1440×900, a phone-sized client 390×844 with touch, a
laptop client 1280×800), moon, Cadet:

- room opened on the broker in 0.3-0.6 s; clients joined in 1.7-3.6 s;
- lobby → brief → questions → define → build (6 steps, owners and host moving on)
  → review → cabin → flight (two crises seen and fixed on the right devices)
  → landing → surface → ascent → debrief/results, 7.5 minutes end to end;
- a client reloaded mid-build and was back in the same seat in 1.1 s with the
  same token;
- the host reloaded mid-build: clients showed "The host left. Waiting up to 2
  minutes", the title offered the room back, and everyone was playing again
  4 s later;
- zero page errors; the only console errors were NASA DONKI space-weather
  requests answering 404/429 (`js/team/real-data.js`, optional data, not
  networking).

Failure paths exercised in the real UI: broker unreachable for a host and for a
client (custom broker on a closed port: slow → unreachable with the retries),
wrong room code (`no-room`), host closing the room (`host-closed`). Connection
check screenshots exist for: hosted + good, localhost, broker down, no WebRTC,
ICE timeout, Arabic.

Still needs a real two-home test: two devices on different ISPs (one on
mobile data) joining a GitHub Pages host, to see the `ice-failed` rate and the
STUN probe's verdict on a carrier network. Everything here ran on one machine,
so ICE always had a host-candidate path.
