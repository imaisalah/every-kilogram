# Story bible: "Last Light"

Companion to `docs/STORY.md` (the binding format). This file is the writers' map: who the people are, what each episode does, every key choice and clue, which flags/trust/resources matter where, and how the four endings are decided. Scripts: `content/story/ep1.js` … `ep4.js`. Arabic: `js/i18n/ar-story.js`. Checks: `tests/story-content.test.js`.

**Structure (Detroit-style).** Most of every scene is an `explore` beat: the player walks the set, talks to people when they choose to, and finds clues. Dialogue is short. Each episode has 4–6 **key choices** (`key: true`, flowchart diamonds), most timed at tense moments. **Clues unlock options**: an option with `requires` shows greyed with its `lockedHint` until the clue is found. Some decisions are *actions* in exploration (whom to sit with, whether to open the video link, who keeps watch) rather than menu choices.

**Mission.** Lantern (the crew capsule, radio call sign "Lantern") on its service module, with Ibis (a small habitat built for two people for two days near the Moon) docked to its nose. A crewed lunar flyby on a free-return loop. Ground: "Control".

---

## 1. Characters

| id | Who | Voice | Arc |
|---|---|---|---|
| `you` | Commander (player's avatar, `{you}`) | Chooses, rarely speaks; the player's words are the options | Learns what leadership costs: data over schedule, truth over comfort, sharing the controls |
| `yusuf` | Yusuf Adel, pilot, Egyptian, ex-air force | Quick jokes when scared ("Somewhere. My favourite plan."), "Yalla", "boss"; proud | Daughter **Salma** (7). Pride vs service: wants to fly by hand. Payoff: the terminator burn, Salma on the radio before blackout |
| `lena` | Lena Hoffmann, ESA physician | Blunt, short, numbers ("Tight. That is a word, not a number.") | Field-hospital past; asks for a **promise of the real numbers** (`lenaPact`). Clashes with Yusuf in ep3; volunteers for the storm edge |
| `grace` | Grace Okafor, flight engineer, Nigerian | Quiet, counts things when scared (bolts, breaths, craters) | Signed off **tank two**. Guilt → redemption (builds the adapter, finds the power-up trick) or → withdrawal (benched, blamed: she stops speaking up and resigns in "Home, apart") |
| `nadia` | Flight director | Calm, short commands; "Silence on my loop is a Go." | Wants the commander to own decisions; her trust gates the PC+2 compromise |
| `kwame` | Chief engineer | Careful, data, conscience ("I can’t prove it’s unsafe. I can’t prove it’s safe either.") | The Challenger engineer. Pushed aside → guilt ("Was it the cold?") → confession before blackout → writes the new rules |
| `mariam` | Mission scientist | Wonder, then urgency | Wants the camera; sees the flare; her data packet saves the crew from the worst dose |
| `tarek` | Budget officer | Pragmatic, not a villain ("I’m the one who counts.") | "Take off your engineer’s hat." Later moves the second recovery ship without budget, for you or "for them" (trust) |
| `omar` | Student intern, Khartoum | Excited teen; the audience's eyes on the ground | Holds the tape for the adapter; quotes "Farewell, Aquarius"; decides to become the voice that brings people home |
| `aiko` | Public outreach | Honest storyteller | Truth with the public builds trust that pays back in ep2 and the epilogue |

Trust runs −3…+3. "X will remember that" (`remember`) is used only on options that also change that person's trust.

---

## 2. Episode flowcharts

Notation: **[explore]** items (anchor) · **(clue)** sets a flag counted on the flowchart · ◆ key choice (timer s, timeout option) · 🔒 option needs a clue.

### Episode 1 — Cold Morning (9 scenes, 5 key choices)

```
cold_open (black, flash-forward to the bang)
 └ trade [briefing] explore: model (clue sawTankLayout) · kwame · mariam(screen) · lena(table) · exit door
    ◆ ep1.trade.c1  extra O2 tank (+10 o2, extraO2) | high-res camera (hiresCamera) | spare CO2 cartridges (spareCartridges)
 └ pad_night [pad] explore: ice(tower) · grace(umbilical) → heardTankTwo · tank log(van) (clue readTankLog, needs heardTankTwo)
                    · seal data(console) (clue readSealData) · kwame · "flights without damage"(kwame) (clue sawAllData, needs readSealData)
                    exit door when readSealData
    if heardTankTwo: ◆ ep1.pad.c1  🔒flag it [readTankLog] → tankFlagged | recheck → tankRechecked, graceTired | fine (timeout 12 s)
    else graceUnheard
 └ meeting [control] explore: tarek · aiko · omar · forecast(bigscreen) · coffee · exit console
    ◆ ep1.meet.c2 (15 s, timeout silent)
        🔒 data [sawAllData] → delayed, dataWon ─┐
        nogo → delayed ──────────────────────────┴→ scrub_day [control] explore: tarek · kwame (sealsReplaced) · omar · aiko (publicHonest)
        go → launchedCold ───────────────────────┐
        [silent] → launchedCold, saidNothing ────┴→ go_morning [pad] explore: kwame · lena(arm) · ice
 └ crew_room [briefing] explore: yusuf(table) → metSalma · lena(screen) → lenaPact · grace(model) → graceConfided
 └ launch [capsule] (launchedCold → smoke at ignition, smokeAtIgnition) · FACT Challenger
 └ day_three [capsule] explore: window · students(camera) · yusuf · grace · tank-two trace(panel_right) (clue sawPressureJump)
    ◆ ep1.stir.c1 (8 s, timeout grace) you | grace | yusuf | 🔒hold [sawPressureJump] → stirHeld (the tank fails anyway; nobody's hand on the switch)
    BANG · ◆ ep1.end.c1 (6 s) calm → calmFirst | hatch → hatchFirst | [quiet]
    FACT Apollo 13's tank · end cliff → ep2
```

### Episode 2 — Lifeboat (12 scenes, 5 key choices, survival ep2.power + ep2.co2)

```
bang  (hatchFirst −3 o2; explosion −35 o2, −40 power)
   ◆ ep2.bang.c1 (10 s, timeout wait)  🔒sure [tankFlagged || readTankLog || sawPressureJump] +3 o2 | close | wait −8 o2
   Grace freezes (line depends on ep1.stir.c1 / stirHeld)
   ◆ ep2.bang.c2 (8 s, timeout need)  need → graceSteady | comfort −2 o2 | bench → graceBenched (grace −2, remembers)
 └ lifeboat explore: cabin O2 tank(locker_2, needs extraO2) · medkit (clue tookMedkit) · square cartridges(locker_4) (clue tookCartridges)
                     · power gauges(panel_left) · lena · exit hatch
    SURVIVAL ep2.power → power_ok | power_bad (powerShort)
 └ numbers (Kwame, private loop)
   ◆ ep2.num.c1 (15 s, timeout later)  all → toldTruth | soft → softened | later → hidNumbers   (with lenaPact: soft/later → brokePact)
   FACT Aquarius lifeboat
 └ families explore: aiko(panel_center) · yusuf → yusufAsked · video link(camera, needs yusufAsked, −4 power, salmaCall)
                     · grace · lena (clue noticedCO2) · exit window          (asked but no call → yusuf −1)
 └ co2_rising (noticedCO2 → −10 co2) explore: fetch cartridges from cold Lantern (only if not taken, −2 o2) · grace leads (graceBuilt; unbenches her) · yusuf reads
                     exit when builderPicked && tookCartridges
    SURVIVAL ep2.co2 → co2_ok (adapterBuilt) | co2_bad (co2Sick, health −10 each)   FACT the "mailbox"
 └ blame (what broke: the heater switches; gauge stuck at 27 °C)
   ◆ ep2.blame.c1 (12 s, timeout silent)  🔒flagged [tankFlagged] → graceForgiven | fix → graceFocused | harsh → blamedGrace | [silent]
 └ cold_night
   ◆ ep2.cold.c1 (12 s, timeout normal)  strict → strictRation (+15 water) | normal (−25 water) | me → youThirsty (−10 water)
   explore: frost · watch: yusuf | grace (graceTired) | me (youTired) · exit seat_you when watchPicked
   FACT cold and thirsty (Haise's fever)
 └ los: Mariam's cut-off warning about the Sun · end cliff → ep3
```

### Episode 3 — Far Side (8 scenes, 4 key choices, survival ep3.storm)

```
far_side explore: window (lookedOut) · far-side photos (camera; hiresCamera → farPhotos, −3 power; else handheld)
                  · lena · grace · radiation counter(panel_left) (clue sawCounter) · Mariam's packet(panel_center) (clue readFlareData) · exit seat_you
 └ storm (sawCounter → headStart)
   ◆ ep3.storm.c1 (12 s, timeout none)  🔒shared [readFlareData] → doseShared | lena → doseLena | yusuf → doseYusuf | [none] → doseGrace
   SURVIVAL ep3.storm → shelter_ok (shelterGood) | shelter_bad (not shared → crewHurt, hurtRadiation)   FACT shelters
 └ meds   FACT August 1972
   ◆ ep3.meds.c1  🔒kit [tookMedkit] → hurtEased, feverTreated, medsKept | edge → hurtEased | 🔒fever [strictRation] → feverTreated | keep → medsKept
 └ clash (Yusuf vs Lena)
   ◆ ep3.clash.c1 (15 s, timeout wait)  🔒pc2 [trust.nadia >= 0] → burnEarly, burnPC2 | now → burnEarly, roughAim | wait → waitedForGround
   FACT PC+2
 └ after explore: yusuf (talkedYusuf3) · lena (talkedLena3) · bring them together (clue crewMended, needs both) · students
                  · grace · docking camera on the heat shield (clue shieldSeen; with hiresCamera → shieldMapped) · exit when shieldSeen
 └ shield
   ◆ ep3.shield.c1 (12 s, timeout nobody)  🔒plan [shieldMapped] → crewKnowsShield, shieldPlan | all → crewKnowsShield | grace → graceKnowsShield | nobody → hidShield (+brokePact)
   end cliff → ep4
```

### Episode 4 — Home (16 scenes, 5 key choices, survival ep4.burn + ep4.entry)

```
cold_lantern explore: dry the panels (driedPanels, exit gate) · grace (graceTrick if trust.grace ≥ 1 || graceFocused || graceForgiven)
                      · yusuf (yusufFever if strictRation && !feverTreated, health −15) · lena (hidShield → lenaSuspects, lena −1) · window
   ◆ ep4.power.c1 (15 s, timeout list)  🔒grace [graceTrick] +10 power | list | cold → coldEntry +6 power      FACT power-up
 └ burn_prep
   ◆ ep4.burn.c1 (12 s, timeout you)  🔒together [crewMended || trust.yusuf >= 2] → flewTogether | yusuf | you (yusuf remembers)
   counter: Grace if trust.grace ≥ 0, else Lena
   SURVIVAL ep4.burn → burn_ok (corridorOk) | burn_bad ◆ ep4.bbad.c1 (10 s) again (−15 power, corridorOk) | save → shallowEntry   FACT terminator burn
 └ goodbye explore: service module drifts (window) · close Ibis's hatch · kwame (heardEntryPlan, exit gate) · grace     FACT Artemis I shield
   ◆ ep4.entry.c1 (15 s, timeout direct)  🔒roll [shieldMapped] → directEntry, protectEdge | direct | skip → skipEntry
 └ last_words (Salma if salmaCall/metSalma · Kwame's confession if launchedCold · Tarek's ship · Lena's anger if the shield was hidden from everyone)
   SURVIVAL ep4.entry → blackout (landed; skip without protectEdge → roughEntry)
                      | blackout_bad → landed || protectEdge ? rough landing (roughEntry) : end_lost
 └ verdict  → end_hurt | end_apart | end_all          (end_lost comes from blackout_bad)
 └ epilogue explore (control after hours): kwame · grace · yusuf · lena · mariam · omar · aiko · exit door
   ◆ ep4.hearing.c1 (20 s, timeout team)  truth | team | program
 └ recap ("You chose X; the real team did Y")  FACT Apollo 13 came home
 └ final → end home_all | home_hurt | home_apart | lost
```

---

## 3. Endings (ep4 `verdict`)

Checked in this order:

| Ending (`end`) | Condition | Told as |
|---|---|---|
| `lost` "Last light" | entry segment lost **and** `!flags.landed` **and** not `protectEdge` | Ground only: unanswered radio calls, Aiko switches off her camera, four empty chairs a year later. Nobody dies on screen. |
| `home_hurt` "Home, but not whole" | `crewHurt`, set by any of: storm shelter failed without `doseShared` (`hurtRadiation`); `res.water < 10`; `res.o2 < 5`; `roughEntry` without `medsKept`; any `health.* < 35` (survival damage, CO2 sickness, fever) | One crew member carried out on a stretcher; `hurtEased` (medicine) decides "weeks" vs "months" |
| `home_apart` "Home, apart" | `trust.grace <= -2 \|\| trust.yusuf <= -2 \|\| trust.lena <= -2` | Safe, but Grace resigns / Yusuf changes crews / Lena writes "CREWS MUST BE TOLD THE TRUTH" |
| `home_all` "Everyone home" | otherwise | Four people waving on the ship's deck; Nadia sits down and covers her face |

Epilogue lines (all endings except `lost`) depend on: `launchedCold` (Kwame's rule change vs gratitude), `trust.grace ≥ 1` (she writes the new tank rules vs clears her desk), `trust.yusuf ≥ 1` (Salma's birthday), `brokePact` (Lena), `farPhotos && hiresCamera` (textbooks), `publicHonest || dataWon` (Aiko).

---

## 4. Where things pay off

| Flag / value | Set in | Pays off in |
|---|---|---|
| `extraO2` (+10 o2) | ep1 trade | ep2 lifeboat item; more o2 all the way (o2 < 5 at splashdown → hurt) |
| `hiresCamera` | ep1 trade | ep3 far-side photos; **`shieldMapped`** → 🔒 ep3 "plan", 🔒 ep4 "roll" (best entry, and it saves a failed entry from `lost`); epilogue |
| `spareCartridges` | ep1 trade | ep2 numbers/co2 lines (a day of breathing) |
| `readSealData` → `sawAllData` | ep1 pad clues | 🔒 ep1 "put every flight on the screen" (No-go with Tarek on side: `dataWon`) |
| `heardTankTwo` → `readTankLog` | ep1 pad | ep1 Grace choice appears; 🔒 "flag it" (`tankFlagged`); 🔒 ep2 "sure" valves |
| `tankFlagged` | ep1 | ep2 🔒 "you flagged it" (`graceForgiven`) → ep4 `graceTrick` |
| `graceUnheard` | ep1 (never talked to Grace) | ep2 blame line |
| `launchedCold` / `delayed` | ep1 Go/No-go | launch smoke; ep2 Kwame's fear; ep4 confession; lost-ending testimony; epilogue; recap |
| `metSalma`, `salmaCall` | ep1 crew room, ep2 families | ep3 storm line; ep4 last words |
| `lenaPact` → `brokePact` | ep1 crew room; ep2 numbers, ep3 shield | Lena trust swings ±2; ep3/ep4 epilogue lines |
| `sawPressureJump` | ep1 day 3 | 🔒 hold the stir; 🔒 ep2 "sure" |
| `stirredBy*`, `stirHeld` | ep1 stir | ep2 Grace's freeze line |
| `calmFirst`, `hatchFirst` | ep1 last choice | ep2 opening (hatchFirst −3 o2) |
| `graceBenched` | ep2 | ep2 families/co2 (asking her to lead unbenches her, +2) |
| `tookMedkit` | ep2 lifeboat | 🔒 ep3 "kit" (treats everyone, keeps a dose for entry) |
| `tookCartridges` | ep2 lifeboat | ep2 co2: otherwise a cold trip back (−2 o2) |
| `noticedCO2` | ep2 families | ep2 co2 −10 |
| `strictRation` | ep2 water | ep3 fever line, 🔒 ep3 "fever"; ep4 `yusufFever` (−15 health) unless treated |
| `youTired`, `graceTired` | ep1/ep2 | ep4 burn lines |
| `readFlareData` | ep3 far side | 🔒 ep3 "shared" (nobody takes the worst dose; prevents radiation hurt) |
| `sawCounter` | ep3 far side | `headStart` (for the storm segment) |
| `crewMended` | ep3 after | 🔒 ep4 "fly it together" |
| `burnPC2` / `roughAim` / `waitedForGround` | ep3 clash | resources; ep4 burn line; recap |
| `crewKnowsShield` / `graceKnowsShield` / `hidShield` | ep3 shield | ep4 Lena (`lenaSuspects`), last-words anger, Grace's roll angles |
| `graceTrick` | ep4 (trust/forgiveness) | 🔒 ep4 power-up, +10 power |
| `protectEdge`, `skipEntry`, `shallowEntry`, `medsKept` | ep4 | blackout, `roughEntry`, endings |
| `recoveryClose` | ep4 last words (always) | hurt ending (hospital in 3 h) |
| survival: `heatersOff`, `adapterBuilt`, `shelterGood`, `corridorOk`, `landed` | segments (and set on the win scenes too, as a fallback) | ep2 cold lines; recap; blackout/endings |

**Trust gates:** `trust.nadia >= 0` (ep3 PC+2), `trust.yusuf >= 2` (ep4 together), `trust.grace >= 1` (ep4 trick), `trust.grace >= 0` (who counts, Grace's camera suggestion), `trust.tarek >= 0` (why he moved the ship), ≤ −2 (home_apart).

**Resources:** start `o2 90, power 100, water 100, co2 0, food 100`. Big hits: explosion (−35 o2, −40 power). Choice costs are small (2–15) so the survival segments stay the main driver.

---

## 5. Real history used (fact cards)

| Card | Where | Source |
|---|---|---|
| Challenger, 28 Jan 1986 (2 °C, 53 °F advice, "management hat", 73 s, charts without the no-damage flights) | ep1 launch | Rogers Commission, nasa.gov/history/rogersrep/v1ch5.htm (temperature: v1ch3) |
| Apollo 13's oxygen tank (28 V switches at 65 V, ~540 °C, gauge to 27 °C, cryo stir) | ep1 end | nssdc.gsfc.nasa.gov/planetary/lunar/ap13acc.html |
| Aquarius, the lifeboat (2 people/45 h → 3 people/90 h) | ep2 | Apollo 13 Flight Journal, day 3 "lifeboat" |
| The "mailbox" CO2 adapter | ep2 | Apollo 13 Flight Journal, day 4 "mailbox" |
| Cold and thirsty (3 °C, 180 ml/day, 14 kg, Haise's fever) | ep2 | nasa.gov Apollo 13 mission details |
| Shelters against the Sun (Orion's stowage shelter) | ep3 (bad shelter path) | nasa.gov Orion radiation protection plan |
| August 1972 storm between Apollo 16 and 17 | ep3 | science.nasa.gov "How NASA will protect astronauts from space radiation at the Moon" |
| PC+2 burn (~5 min; ~151 h → ~142 h) | ep3 | nasa.gov Apollo 13 mission details |
| Waking a frozen ship (procedure in ~3 days, "rained inside") | ep4 | nasa.gov Apollo 13 mission details |
| Fourteen seconds by hand (terminator, Lovell/Haise/Swigert) | ep4 | Apollo 13 Flight Journal, day 5 manual course correction |
| Artemis I heat shield char loss; Artemis II shorter entry | ep4 | nasa.gov "NASA identifies cause of Artemis I Orion heat shield char loss" |
| Apollo 13 came home (17 Apr 1970, ~6 min blackout, 400,171 km) | ep4 recap | nasa.gov Apollo 13 mission details |

The recap narrates, for each of: cold launch, tank two, CO2 adapter, water, storm, the burn after the far side, the hand burn, the entry — what *you* chose, then what the real teams did.

---

## 6. Writing rules (house style)

- One idea per line; most lines under 25 words. Nobody explains what the player can see.
- Never gory. Loss = silence, an empty seat, a radio call nobody answers.
- Every option costs something. Locked options are the "better" answers you had to earn by exploring, never the only humane one.
- Ids never change once translated: add new ids instead of renaming. Run `node --test tests/story-content.test.js` after any edit; it also fails on missing Arabic.
