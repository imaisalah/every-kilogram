# Last Light: the script (Prologue + Chapter 1)

Last Light is a side mode next to the main team game. This is the beat sheet for `content/levels/prologue.js` and `content/levels/lifeboat.js`, written against `js/ll/director.js` and the real sets in `js/ll/sets/`. The Arabic is in `js/i18n/ar-ll.js`, and `tests/ll-content.test.js` checks all of it.

**House rules** (the test enforces them):
- Every section starts with one objective and a waypoint.
- No line is over 12 words; the test fails above 14.
- No more than 3 lines of dialogue in a row without the player doing something (moving to a goal, pressing E, a QTE, a choice, a camera shot).
- Talk happens while the player walks or floats: `say()` holds the script, not the player.
- Each level has 2-3 timed choices and 6-8 collectibles, each with a source.
- Only the doc's anchors are used, and the power-down uses the names and amps the panels show.
- Every key has Arabic with the same `{placeholders}`.
- Real history lives in collectibles (the Journal), never in dialogue lectures.

**How text works.** Every string is written in English with an explicit key. The director looks it up as `ll.<key>`, and `{you}` is filled with the player's name ("Commander" if they kept the default name). `SMD.llKit` in prologue.js wraps every director call the levels use.

**Cast.** You (the commander, never speaks: your choices are your words).
- **Yusuf:** pilot. Jokes when scared; "boss", "Yalla". His daughter Salma is 7.
- **Lena:** doctor. Blunt, numbers.
- **Grace:** engineer. Counts things when scared; signed off tank two.
- **Ground team:** Kwame (chief engineer, the cold seals), Nadia (flight director) and Mariam (scientist, wants the camera).

**Timings** are the script time measured on the real sets by an autoplay run, plus an estimate for travel and decisions. Optional finds add up to a minute per level.

---

## Prologue: "Cold Morning" (about 6 min, set `pad`, then `capsule`)

| # | Section | Min | The player... | Beats |
|---|---|---|---|---|
| 1 | `arrive` | 1:00 | **walks** 85 m from the van (tutorial hint once), **looks**, optionally **talks** to Grace | Wide shot up at the venting rocket, title card. Objective: *Walk to Kwame at the tower*. Grace calls out: "Boss? Got a second?" (optional: tank two's eight-hour boil-off, 3 lines → *tank2*, sets `talkedGrace`; the banter gives way if you go to her). Banter while walking: frozen eyebrows, "breathe through your nose", "My nose is also frozen, doctor." |
| 2 | `tower` | 0:45 | **reads** Kwame's chart (E), **receives** the patch, optionally **reads** the plaque, **enters** the elevator | Kwame: cold rubber is slow. Close-up → *seals*. "I'll say it on the loop. Back me up?" Apollo 13's patch → item + *patch13*. Optional: the plaque at `tower_base` → *challenger*. Nadia: "Bring all four of them home." |
| 3 | `arm` | 0:30 | **watches** the cab climb, **crosses** the access arm at 92 m, optionally **knocks ice** off the rail | A 7 s outside shot of the cab rising up the tower. A look down from the arm. "Don't look down." / "He always looks down." / "Ninety metres. Yes. I looked." Optional → *ice*. |
| 4 | `whiteroom` | 1:00 | **picks up ONE crate**, **carries** it in their arms to the hatch | **The design choice of the challenge.** Grace: "Forty kilos left. One crate fits." The crates are live at once while Kwame argues for oxygen, Lena for CO2 cartridges and Mariam for the camera. Labels show mass: O2 39 kg, CO2 37 kg, camera 34 kg. Picking one up sets `flags.cargo` (`o2`, `co2` or `cam`); whoever lost reacts in one line. Lena: "Every kilogram is a decision, {you}." Optional: the sign → *whiteroom*. |
| 5 | `poll` | 0:35 | **straps in**, then the **timed choice** | Final poll. Kwame on the loop: "Minus four. I'm asking for a hold." **Choice 1 (10 s, timeout = silence):** *Hold until the sun warms the pad* / *Lantern is Go* / *[Say nothing]*. A hold cuts to "Two hours later, plus three". Go or silence sets `launchedCold`; silence also sets `saidNothing` ("Silence on my loop is a Go."). |
| 6 | `launch` | 0:45 | **holds to brace** through max-Q (6 s), **presses** at staging | Countdown inside the cabin, a shot of the shaking cabin. Launched cold: "Camera six. Smoke at the left booster." Held: "Boosters clean!" `brace(6)` → *maxq*; losing grip costs 10 health, never the section. Staging QTE: clean or rough. Then zero g. Grace: "Forty-two bolts on that panel. I counted." |
| 7 | `day3` | 1:00 | **floats** to the window, **takes a photo** of Earth, the **timed choice**, maybe **flips** the switch | "Day 3. 321,000 km." Earth in the window (relief). Salma wants a Moon rock / "We don't land." / "She doesn't care." Photo → *earth* (camera: "I can see my street!"). Nadia asks for the tank stir. **Choice 2 (8 s, timeout = Grace):** *I'll flip it myself* (float to `panel_right`) / *Grace, it's your system* / *Wait. Tank two looks wrong* (locked unless you talked to Grace). "Goodnight, Lant—" **BANG.** |

## Chapter 1: "Lifeboat" (about 9 min, the connected Lantern + tunnel + Ibis interior, zero g)

Layout that matters: valve, breakers 1-4, lockers 1-6 and the small window are in Lantern. Breakers 5-8, lockers 7-10, `hab_lockers`, the medkit, the bench and the big window are in Ibis.

| # | Section | Min | The player... | Beats |
|---|---|---|---|---|
| 1 | `jolt` | 0:45 | **grabs the handhold** (press QTE), **floats** to the window, optionally **reads** the flight log | Opens on the bang. Miss the QTE: −15 health, Lena catches you. "Control, Lantern. We've had a problem." "Tank two reads zero." At the window → *venting*. "We're venting something. Into space." / "That's our oxygen." Optional: `panel_center` → *problem*. |
| 2 | `valve` | 0:50 (+0:30 camera) | the **timed choice**, then **floats** to the valve and **turns the wheel** (retries) against a **45 s timer**, O2 falling 1.2 %/s | Grace freezes; her line depends on who flipped the stir. **Choice 1 (8 s, timeout = need):** *Grace. I need you* (`graceSteady`) / *Yusuf, take her panel* (`graceBenched`). The timer running out fails the section ("The oxygen ran out."). **Camera payoff:** Mariam: "Point it out the window!" Locker 3, the photo → *damage*; Kwame: "A whole panel is gone. Now we know." (`photoSent`). |
| 3 | `powerdown` | 1:15 | **floats from breaker to breaker** (E), reading amps and the wrist projection, against a **70 s timer** | Draw starts at 68.8 A (8 A core + the 8 breakers). The battery is 1,000 Ah (1,220 with the photo); home is 77 h. The waypoint goes Ibis first, then Lantern. The panels and displays really change. **Trap:** the air fan: "Not the fans! No fans, no air." Without the photo all 7 others must go (11.1 A, Kwame: "under thirteen"). With it the Ibis lights can stay on (15.7 A, "under sixteen"). Done: the alarm stops, the lights drop. "Quiet. I don't like quiet." / "Get used to it." Optional: `panel_left` → *powerdown*. |
| 4 | `abandon` | 1:00 | **takes your cargo**, **floats through the tunnel**, **takes the medkit** in Ibis | **Cargo payoff:** O2: locker 1, plumbed in at the tunnel: +30 % O2 and the drain falls from 0.04 to 0.025 %/s for the rest of the chapter. CO2: locker 2: "They fit Ibis. A whole day." Camera: "Keep that camera safe." In the tunnel: "Built for two people. Two days." / "We are four." / "Home is four days away. I can count." Optional: `tunnel_a` → *aquarius*. |
| 5 | `numbers` | 0:50 | **puts on the headset**, the **big timed choice** | Kwame, private loop; the opener depends on the poll. "Water runs out five hours before entry." Shot of faces pretending not to listen. "Ibis scrubs air for two. You are four." **Choice 2 (12 s, timeout = later):** *Tell them everything* (`toldTruth`: CO2 rise ×0.85, the crew moves and breathes slow) / *Tell them it's tight* (`softened`: "Tight is a word, not a number.") / *Not now* (`hidNumbers`: Grace does the maths alone). |
| 6 | `scavenge` | 1:45 (1:15 spares) | **searches lockers** one waypoint at a time (n/m), **mashes** to free a frozen locker, optionally **opens** extras (water, food, flashlight) | CO2 rises 0.08 mmHg/s (0.045 with spares). Ibis: `hab_lockers` (bag, tape, food), `locker_8` (sock: "It's clean. Mostly."). Cold Lantern: `locker_4` (frozen: square cartridge, "Ugly. Perfect."), `locker_5` (hose), `locker_6` (cover). Spares skip the cover and sock: "My spares came with a collar." At 15 mmHg Lena: "Headaches. That's the CO2." If you hid the numbers: "You knew this was coming." |
| 7 | `craft` | 0:50 | **builds the adapter** at `hab_bench`, parts in order, past 15 mmHg (blur, slower) | Grace leads if steady; if benched: "Can I… help? Please." (`graceBack`). Stepping away is allowed; at 30 mmHg the director fails the section. Built: CO2 falls → *mailbox*. "Control, the ugliest box in the solar system works." |
| 8 | `cold` | 1:00 | **wipes the frost** off the window, the **timed choice** | "Four degrees. Water on every wall." Frost clears: Moon and tiny Earth → *cold*. Yusuf: "Salma will have seen the news." **Choice 3 (10 s, timeout = no):** *Sixty seconds. Call her* (`salmaCall`, −3 power: "Habibti. Yes, it's Baba.") / *We can't spare the power* ("Okay. You're right. Okay."). |
| 9 | `los` | 0:40 | **floats** to the window to **watch** | The Moon fills the window. "We'll keep a light on." Mariam: "A spot on the Sun just doubled! If it flares, you have to—" Static; the window goes black. "Have to what?" *record*. Card: "Loss of signal." |

---

## Choices and where they pay off

| Choice | Set in | Options (timer, timeout) | Pays off |
|---|---|---|---|
| **Cargo (the design decision)** | Prologue `whiteroom`, physical | O2 tank 39 kg / CO2 cartridges 37 kg / camera 34 kg (40 kg margin) | **O2:** +30 % O2, drain 0.025 instead of 0.04 %/s. **CO2:** CO2 starts lower, rises 0.045 instead of 0.08 mmHg/s, the adapter skips 2 of 6 steps, usually no headache. **Camera:** the Earth photo line; the *damage* photo; +220 Ah, so the Ibis lights can stay on (Yusuf remarks on it in `cold`). Later chapters: far-side photos and the heat-shield inspection (story bible §4). |
| Final poll | Prologue `poll` | Hold / Go / [Say nothing] (10 s, silence) | Clean boosters or smoke on camera six; Kwame's opener in `numbers`. |
| Who stirs the tanks | Prologue `day3` | Me / Grace / 🔒 Wait (8 s, Grace) | Grace's freeze line in `valve`. |
| Grace frozen | Ch1 `valve` | Need you / Yusuf takes over (8 s, need) | Who leads the parts list and the build (`graceBack`). |
| The real numbers | Ch1 `numbers` | Everything / "It's tight" / Not now (12 s, later) | CO2 rate ×0.85 if told; Lena's headache line becomes an accusation if hidden. |
| Salma | Ch1 `cold` | Call (−3 power) / No (10 s, no) | Yusuf's last line in `los`. |

Starting Chapter 1 from the chapter list with no prologue save uses the O2 tank.

## Resources and numbers (Chapter 1)

| Thing | Game value | Real basis |
|---|---|---|
| O2 vent while the valve is open | 1.2 %/s, 45 s timer | Apollo 13's tanks emptied over hours; compressed to a playable clock |
| O2 breathing drain | 0.04 %/s (0.025 with the tank) | Shows the cost of four people; only a threat if you dawdle |
| Power-down | 68.8 A → 11.1 A (15.7 A with the photo); 1,000 Ah (+220); 77 h home | Aquarius's minimum power-down was about 17 A (Apollo Flight Journal day 3, part 5); the amps are the set's panel values |
| CO2 | 6 mmHg, +0.08/s (0.045 spares, ×0.85 if told); headache past 15; fail at 30 | Apollo 13's crew reported about 15 mmHg before switching to the adapter |
| Cabin | 4 °C | Apollo 13: about 3 °C (38 °F) |

## Collectibles (Journal)

**Prologue (8):**

| id | Where | What it is | Source |
|---|---|---|---|
| `tank2` | `van` (optional: talk to Grace) | Apollo 13's tank 2: 8 hours on 65 V, 28 V switches, over 540 °C, gauges to 27 °C | https://nssdc.gsfc.nasa.gov/planetary/lunar/ap13acc.html |
| `seals` | `kwame` (on the path) | The seal chart: at or below 63 °F 4 of 4 damaged, 66 °F and above 3 of 20 | https://www.nasa.gov/history/rogersrep/v1ch6.htm |
| `patch13` | `kwame` (given) | "Ex luna, scientia" | https://www.nasa.gov/image-article/apollo-13-emblem/ |
| `challenger` | `tower_base` (optional plaque) | 36 °F, the 53 °F advice, the "management hat", 73 s, seven crew | https://www.nasa.gov/history/rogersrep/v1ch5.htm |
| `ice` | `arm_start` (optional) | The ice crew's inspection and the unreported 8 °F reading | https://www.nasa.gov/history/rogersrep/v1ch5.htm |
| `whiteroom` | `whiteroom` (optional sign) | The white room; Artemis II's 2023 rehearsal and 1 April 2026 walk | https://www.nasa.gov/blogs/missions/2023/09/20/artemis-ii-astronauts-successfully-conduct-launch-day-demonstration/ |
| `maxq` | launch (automatic) | Max-Q at 59 s on Challenger's flight, engines throttled to 65 % and back | https://www.nasa.gov/history/rogersrep/v1ch3.htm |
| `earth` | `window`, day 3 (on the path) | The Blue Marble, AS17-148-22727 | https://science.nasa.gov/earth/earth-observatory/history-of-the-blue-marble/ |

**Chapter 1 (8; `damage` needs the camera, so other runs find 7 of 8):**

| id | Where | What it is | Source |
|---|---|---|---|
| `problem` | `panel_center` (optional) | 055:55:20, "we've had a problem here" | https://apollojournals.org/afj/ap13fj/08day3-problem.html |
| `venting` | `window` (on the path) | Lovell: "We are venting something out into the… into space." | https://apollojournals.org/afj/ap13fj/08day3-problem.html |
| `damage` | `window`, camera only | The service module with a whole panel blown away | https://www.nasa.gov/image-article/damaged-apollo-13-service-module-april-17-1970 |
| `powerdown` | `panel_left` (optional) | The power-down item by item, about 17 A | https://apollojournals.org/afj/ap13fj/11day3-minimise-power.html |
| `aquarius` | `tunnel_a` (optional) | Two men, under two days → three men, four days | https://apollojournals.org/afj/ap13fj/09day3-lifeboat.html |
| `mailbox` | `hab_bench` (on building it) | The CO2 "mailbox" | https://apollojournals.org/afj/ap13fj/15day4-mailbox.html |
| `cold` | `hab_window` (on the path) | 38 °F, 6 oz of water a day, 31.5 lb lost | https://www.nasa.gov/missions/apollo/apollo-13-mission-details/ |
| `record` | end (automatic) | 400,171 km, passed by Artemis II's crew in April 2026 | https://www.scientificamerican.com/article/nasas-artemis-ii-astronauts-break-apollos-distance-record |

The old Apollo Flight Journal links under nasa.gov/history/afj/ now land on a general page; the journal lives at apollojournals.org.

## Open requests

1. `anim('you', 'carry', { prop })` keeps the prop on a throwaway object, so `anim('you', 'put')` cannot find it. The level hides the crate itself through `L.scene.props`.
2. The wrist display is a `hint()` with numbers. A small wrist widget would match the design doc.
3. The window has no venting cloud or damage view: `vent_cloud` and `damage_photo` show the plain star view. A `windowView('venting')` would finish both beats.
