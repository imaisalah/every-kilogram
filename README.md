# Every Kilogram

**Design a spacecraft, fly it, and bring back the science. Every kilogram counts.**

A free 3D browser game for ages 13 and up, alone or as a crew of up to four, made for the NASA Space Apps Challenge 2026, *Space Mission Design Game*. It runs in English and Arabic, needs no install and no account, and runs on a school laptop.

> Imagery courtesy of NASA, NASA/JPL-Caltech, NASA Earth Observatory, NASA SVS and USGS Astrogeology. Use does not imply NASA endorsement. Every Kilogram is not a NASA product and uses no NASA insignia.

## One round

Every step has a Back button, and Pause (or Esc) works everywhere. A slim bar at the top shows where you are in the mission and how much of it is done. KILO, an original robot guide, says one or two lines at each step.

1. **Pick how hard it is:** Cadet (fewer parts, more money), Engineer (the real trade-offs) or Flight director (tight money, hidden flaws, a soft clock).
2. **Pick your crew:** four original astronauts, each with a job: mission planner, engineer, scientist, communications. Your job is the part of the ship you build.
3. **Pick a destination:** six missions, each with a real science question. Nile from orbit and Storm watcher are training flights in Earth orbit; on the Moon, Mars, Venus (a floating cloud-top platform) and Europa the crew lands.
4. **KILO's briefing:** what this mission is for, in three or four lines.
5. **Choose the success criterion:** before building, choose the science result that counts as success. The chosen criterion guides the spacecraft design.
6. **Build one part at a time:** orbit, power, batteries, instruments, antenna and radio, data recorder, computer and pointing, mission length, landing kit, and last the rocket, once the mass is known (Cadet shows six of these steps). Each step has at most three cards with plain pros and cons and their mass, power and cost. Your pick changes the 3D spacecraft at once, and the six resources (mass, power, budget, data, comms, time) move with it.
7. **Review and launch:** one summary card. Anything that will not work gets a one-line reason and a "Fix it" button that jumps back to that step. A rocket that cannot lift the ship to its orbit is never allowed to launch.
8. **Meet the crew:** a short conversation in the capsule, where each crewmate introduces themselves. Skippable.
9. **Fly:** the launch, then the mission plays out in about a minute: the real orbit in 3D, sunlight and shadow, battery, recorder, radio passes and science coming home. Problems and chances come up, and they must be fixed in time.
10. **Land and explore** (Moon, Mars, Venus, Europa): walk to the science sites, scan them with the instruments you packed, carry samples to the lander, plant the dish and send data home when the orbiter passes overhead. Watch air, suit battery and daylight. Real dangers only: dust storms, quakes, cold nights, radiation spikes. Nobody dies; a suit that runs low walks its wearer home.
11. **Bring the science home:** the fuel you packed decides how much mass the lander can lift. Too heavy? Choose which samples to throw overboard.
12. **See why it worked:** a chain of falling dominoes, each line from the simulation ("this choice, so this, so that"), the score out of 1000, KILO's verdict, and the one change that would have helped most.
13. **Fly again with one change**, or change anything and fly the same mission with your last flight drawn as a ghost on the graphs.

## New in the hackathon build

- **Mission review** after the score (and from the **Mission review** button): the four NASA mission segments (launch, space, ground, user), game progress inspired by JPL's CML concepts, a study-type analogy inspired by NASA's Mission Design Lab, a ConOps timeline, and your ship against the real NASA mission. These progress labels are educational analogies, not NASA maturity or study assessments.
- **Real space weather:** the solar-storm problem names a real event from NASA pages and, online, the strongest flare in NASA's DONKI service over the last 30 days (`js/team/real-data.js`).
- **Learning check and teacher log:** three questions from what happened in the flight; a CSV of every flight kept in the browser. See `docs/CLASSROOM.md`.
- **Validation:** `node tools/validate-orbits.mjs` checks the game's orbit maths against an independent calculation and real missions (`docs/VALIDATION.md`); `docs/gmat/` documents a focused GMAT orbit-period cross-check (report actual run status there).

## Ways to play

| Mode | How |
|---|---|
| **Solo** | *Play* on the title screen. The other three astronauts are bot crewmates. |
| **Everyone on their own device** (2-4 players, from anywhere) | *Play with friends › Everyone on their own device*. The host sends a link; each player's browser connects straight to the host's over WebRTC (PeerJS with its free public broker and Google's public STUN servers, no game server). Some mobile networks cannot connect directly; the game says so and suggests the other modes. |
| **Same room with phones** | One big screen plus phones as controllers. Start the game with `play-team.bat` so phones on the same Wi-Fi can join by QR code or address (a WebSocket relay built into `tools/serve.mjs`). Without that relay, for example on a static website, phones join over WebRTC instead. |
| **One screen** | Everyone around one computer: P1 on WASD, P2 on the arrow keys, P3 and P4 on gamepads. |

## Play it

The game is plain HTML and JavaScript with no build step. Browsers only load its 3D modules over HTTP, so it needs a small local server:

- **Windows:** unzip the folder, then double-click `play.bat`. It opens `http://localhost:8765/` using Node.js, Python or, failing both, the PowerShell built into Windows. If Windows says "Windows protected your PC", choose *More info › Run anyway*. Keep the black window open while playing.
- **Phones in the same room:** double-click `play-team.bat` (needs Node.js). It serves on port 8766 on your local network and prints the address phones should open. Allow it through the firewall if Windows asks.
- **Any system with Node.js:** `node tools/serve.mjs 8080`, then open `http://localhost:8080/`. Add `0.0.0.0` (`node tools/serve.mjs 8080 0.0.0.0`) to let phones on the same network join.
- **Python only:** `python -m http.server 8080` works for Solo, One screen and own devices (not the phone relay).

Everything ships in this folder: three.js, the NASA maps, the characters and the fonts. On slow laptops pick *Low* graphics in Settings, or add `?quality=low` to the address.

### Useful addresses

| Address | Opens |
|---|---|
| `/` | The title screen |
| `/#team-solo`, `/#team-one`, `/#team-phones`, `/#team-devices` | A mode directly |
| `/#c=...` | A challenge link: another team's design and score for the same mission and seed. Beat it. |
| `/#demo` | The automatic showcase for screen recording, about two minutes |
| `/#demo-30` | The 30-second cut for the Space Apps video, with English subtitles (see `docs/submission/demo-video.md`) |
| `/#demo-raw` | The showcase without subtitles or cards |

## Controls

- **Setup, success criterion, build, review, results:** mouse or touch; every button is also reachable with Tab and Enter. Space moves KILO to its next line. Esc or the Pause button opens Pause: Resume, Back one step, Restart mission (host), Quit to title.
- **Capsule:** Skip, or click, Space or Enter to go faster.
- **Flight:** when a problem comes up, press the right fix before the ring runs out. With friends, the alarm and the fix are usually on different players' screens, so someone has to shout.
- **Surface, your own screen (Solo, own devices):** third person over the shoulder by default. Click to capture the mouse and look around; WASD moves relative to the camera; Shift sprints; hold E (or Space) in a glowing ring to scan, plant the dish or align it; tap E to pick up or set down a sample; Q uses your job's ability (the planner holds it to call everyone home); V switches to first person; H shows help. At the lander, number keys or X throw a sample overboard. Gamepad: left stick moves, right stick looks, A uses, X ability, Y view, left-stick click sprints, Start pauses.
- **Surface, one screen:** P1 WASD, E or Space, Q, X; P2 arrow keys, Enter or right Shift, right Ctrl, full stop; P3 and P4 gamepads. Phones show a stick and buttons.
- **Language:** العربية / English on the title screen. **Sound:** in Settings.

## The real data behind it

| In the game | Where it comes from |
|---|---|
| Instrument masses, power and data rates | Generic instruments sized like real ones: MRO's camera, radar sounder and spectrometer, LRO's neutron detector and laser altimeter, Magellan's radar, Europa Clipper's ice radar and magnetometer (MRO launch press kit, NSSDC, JPL Europa Clipper quick facts, Landsat via NASA SVS). Sources are in `js/team/data.js` and `content/sources.js`. |
| Rockets and what they can lift | Generic launcher classes with costs from NASA launch-service contract awards; capacity falls with the orbit and the departure energy (C3). |
| Propellant and the mass snowball | The rocket equation (NASA Glenn, Beginner's Guide to Aeronautics) with Isp 320 s and real capture burns into each orbit, from planet masses and radii (NSSDC planetary fact sheets). |
| Orbits | Real altitudes and shapes; period, time in shadow and passes over the ground station are worked out from orbital mechanics. The orbit decides where the crew can land. |
| Solar power | 1,361 W/m² at Earth, falling with distance squared; RTG option from the NASA MMRTG fact sheet. |
| Data home | Transmitter power × dish diameter² ÷ distance² with the DSN link handbook and DSN ground stations; strong error correction from the Galileo antenna lesson (NASA LLIS). |
| Radiation near Jupiter | Europa Clipper's radiation vault. |
| Surface kit | Spare-oxygen mass scaled from Artemis crew needs; the ascent fuel lifts samples by the rocket equation; Venus's cloud-top platform follows NASA's HAVOC concept. |
| Failure stories | When a mission dies, it is compared with a real one that died the same way: Mars Climate Orbiter, Mars Observer, Galileo's antenna, Hubble's mirror, CONTOUR, Genesis, Mars Polar Lander, Kepler, Skylab, Spirit, Pioneer 10, Beagle 2, Apollo 13, Opportunity, each with its source. |
| Planets in 3D | NASA Blue Marble (Earth), LRO colour Moon (NASA SVS), Viking Mars mosaic, Cassini Jupiter and the Voyager/Galileo Europa mosaic (USGS Astrogeology). |

Numbers are simplified for play: generic launcher classes, game-scale costs, a flight squeezed into about a minute, and a lander and suits provided by a sponsor. Treat them as ballpark figures. The simplifications are listed in `docs/TEAM-BALANCE.md`; every map and model is listed in `docs/CREDITS.md`.

## Tests

```
node --test "tests/*.test.js"              # sim, room, network, surface, guide, flight and UI tests
node tools/surface-balance.cjs --seeds 30  # bots play the surface on every world
```

`tools/shot.mjs <url> <png> [waitMs] [script.js] [w] [h]` takes a headless screenshot and prints console errors.

## Project structure

```
index.html, join.html   the game page and the phone page
css/team.css            the calm team-game interface (team-phone.css for phones)
js/
  screen-team.js        the title screen and the team screen (one session per round)
  team/
    data.js, sim.js     scenarios, parts, build steps, the flight simulation, score,
                        consequence chain, best change, obituaries, challenge codes
    room.js             the authoritative room: phases, roles, Back, Pause
    net.js, net-webrtc.js  local, LAN relay and WebRTC transports
    crew.js, guide*.js  the four astronauts and KILO
    view-setup.js       setup, briefing, success criterion, build, review, tracker, pause menu
    view-flight.js, flight3d.js     the cabin and the flight
    surface-sim.js, view-surface.js, surface3d*.js   landing, surface, ascent
    view-debrief.js     dominoes, score, mission review, quiz, verdict, report, challenge links
    mission-review.js   segments, concept maturity, real-mission comparison, ConOps, quiz, CSV
    real-data.js        real space-weather events and the optional DONKI lookup
    phone.js            the player screen on phones and own devices
    ar-*.js             Arabic
  demo.js               the showcase for screen recording (#demo, #demo-30)
  physics.js, data.js   shared physics and NASA-sourced numbers
assets/                 NASA textures, characters (CC0), fonts
vendor/                 three.js r160, PeerJS 1.5.4, qrcode-generator, Draco
tools/serve.mjs         dev server and the phone relay (no npm dependencies)
tests/                  node:test suites
docs/                   TEAM-V2.md (the design as built), TEAM.md, TEAM-SURFACE.md,
                        TEAM-BALANCE.md, CREDITS.md, submission/
```

**Older code kept, not linked.** The first version of the game, a ten-year space-agency career (HQ, review boards, films, solar system map), and the *Last Light* story mode are still in the code (`js/agency.js`, `js/screen-*.js`, `js/ll/`, `js/screen-ll.js`) but are no longer reachable from the title screen. The Failure Museum, leaderboard and saved-designs list from the team game's first version are also kept but unlinked. Their docs (`docs/GDD.md`, `docs/LASTLIGHT.md`, `docs/teacher.md`) describe that older game.

## Licence and credits

- **Our code and text:** Apache-2.0 (`LICENSE`).
- **NASA data and media:** see `docs/CREDITS.md` for every map and model, with its source. `docs/submission/project.md` says which mechanic each source drives.
- **Code by others:** three.js r160 and its loaders (MIT), the Draco decoder (Apache 2.0), the meshoptimizer decoder (MIT), PeerJS 1.5.4 (MIT), qrcode-generator 1.4.4 (MIT).
- **Characters:** Quaternius Universal Base Characters and Universal Animation Library (CC0).
- **Fonts:** Archivo and Noto Kufi Arabic (SIL Open Font License 1.1).
- **Sound:** synthesized in the browser with the Web Audio API. No recorded audio.
- **Built with:** Claude Code (Anthropic) as an AI coding assistant. See "Use of Super Intelligence" in `docs/submission/project.md`.
