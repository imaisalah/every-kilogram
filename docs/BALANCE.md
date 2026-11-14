# Every Kilogram — balance and progression

How the career is tuned, why, and how to check it again. The numbers live in
`js/data.js` (`CAREER`, `CONTRACTS`, `MISSIONS`, `TESTS`, `CONST`); a few rules
live in `js/agency.js`. The simulator is `tools/career-sim.cjs`; the guard-rail
tests are `tests/balance.test.js`.

## Targets

| Target | Result (30 careers per style) |
|---|---|
| A career lasts 45–60 minutes | careful ≈ 41 min, expert ≈ 48, greedy ≈ 49, clueless ≈ 50 (estimated, see "Time model") |
| First launch within 12–15 months of game time | careful/expert: month 11 (Dec 2027); greedy: month 7 |
| Early wins | first review and first history event in month 1–3; first launch ≈ 8 stops; first results ≈ 13 stops (Jun 2028) |
| Careful player: 2–3 headlines, Europa possible but hard | careful (Mars + Venus first): mean 1.77 (23 of 30 get 2). Expert (plans Europa early): mean 2.53 (20 of 30 get all 3) |
| Greedy player: 0–2 headlines, with visible failures | mean 0.23 (7 of 30 get 1); 21 of 164 flights score under 40 |
| Clueless player loses missions and learns | mean 0.03; average score rises from 47 (before 2032) to 67 (after), failures fall from 45 to 19 |
| Money tight in years 1–4, comfortable later, never meaningless | careful/expert lowest point ≈ $20M; January balances $200–450M until 2032. Europa costs ≈ $620M plus operations and keeps the expert near $300M until 2035 |
| Research choices matter | about 185 science points by mid-2030 against 230 for the Mars, Venus and Europa kits: Venus first or Europa first is a real fork |
| A missed launch window hurts but can be recovered | storage ($3.5M a month), reputation −1, and 19–26 months of waiting. The mission still flies |

## Run it

```
node tools/career-sim.cjs 30                      # all four styles, 30 careers each
node tools/career-sim.cjs 3 expert --verbose      # one style, with timelines
SIM_DEBUG=1 node tools/career-sim.cjs 1 careful   # why the bot skipped a mission
node tools/career-sim.cjs 30 careful --patch my.cjs   # try numbers: module.exports = (D, A) => { D.CAREER.startMoney = 600; }
node --test tests/balance.test.js                 # guard rails (about 8 s)
```

The bots play through the same `SMD.agency` API the screens use. They press
"Skip to next event", stop where the HQ stops (review, event, launch, arrival,
result, unlock, out of money) and answer the same review questions and event
cards.

| Style | Designs | Tests and reserve | Event cards and reviews | Research |
|---|---|---|---|---|
| careful | searches the design space from the proven design (like a player reading the requirements panel); values a margin on the headline goal | standard, or thorough when it still makes the window; standard 25% | pays to fix problems; fixes power at reviews | Mars kit, then Venus, then Europa |
| expert | same as careful | same | same | Mars kit, then the Europa kit (vault, ice radar, heavy launcher), then Venus |
| greedy | the same search, but weighted toward cost; no fuel margin | basic tests, lean 10% | picks the cheapest answer ("fly it") | what the next mission needs |
| clueless | random parts; after a failure, often presses "Load a proven design" | random | random | random |

All bots respect a red budget and approve close to a launch window. Careful
bots also skip missions whose science would end after 2036.

### Time model

Real time is estimated per stop: skip 4 s (+0.25 s per animated month), review
30 s, event card 25 s, launch film 25 s, arrival film 20 s, results 45 s,
design screen 90–170 s (+120 s for the first one), research 15 s. It is a rough
model; use it to compare tunings, not as a promise.

## Before and after

Baseline: the numbers as they were, 4 careers per style, with the old code.

| | Before | After |
|---|---|---|
| careful headlines | 1.0 (Mars only, in 2035) | 1.77 (Mars and Venus, 2033) |
| expert headlines | (style did not exist; Europa could not finish in time) | 2.53, Europa in Dec 2035 |
| greedy / clueless headlines | 0 / 0 | 0.23 / 0.03 |
| first launch (careful) | Jun 2028 (month 17) | Dec 2027 (month 11) |
| first result (careful) | Jun 2029 (month 29), 13 stops | Jun 2028 (month 17), 13 stops |
| Mars / Venus / Europa unlock | Jul 2029 / Jan 2032 / Mar 2035 | Apr 2029 / Apr 2029 / Aug–Oct 2029 |
| money at the end (careful / greedy) | $1,154M / $1,994M | $1,578M / $357M (expert $705M) |
| HQ soak bot | 1 headline | 1 headline (its fixed designs are weak at Venus and its Europa uses the slow route) |

The baseline also had a bug: a plan measured "waiting for the window" from Nov 2026, not from
the day the spacecraft would be ready. Every plan carried phantom storage costs
(about $90M on a 2029 Mars plan), and from 2029 on every planetary window check
was red, so no sensible player could start Mars, Venus or Europa on time.
`agency.plan` and `agency.approve` now settle the wait from the real ready date.

## The tuning

| Number | Before | After | Why |
|---|---|---|---|
| `CAREER.startMoney` | 400 | 550 | Two first missions fit in year one, a third does not |
| `CAREER.startScience` (new) | 0 | 25 | One research choice on day one (amp, recorder, backup computer, or save) |
| `CAREER.yearlyPerRep` | 15 | 5 | Late money came too easily |
| Nile / Storm watcher `turns` | 12 | 6 (data needs halved) | First results inside 18 months instead of 29 |
| Nile / Storm watcher `devFactor` | 0.35 | 0.25 | First launch in month 10–12 |
| Nile / Storm watcher reward | $260M / $220M, 30 sci | $220M / $180M, 40 sci | They still pay for themselves, and fund the first research |
| Moon `unlockRep` | 1 | 0 | Three choices at the start; the Moon is the harder, slower, more valuable one |
| Moon `devFactor`, science | 0.5, 60 | 0.4, 80 | Moon results by spring 2029 unlock Venus and, with the vault, Europa |
| Mars `devFactor`, money | 0.7, $100M | 0.65, $60M | Makes the 2031 window with slack |
| Venus `devFactor`, money | 0.7, $100M | 0.6, $60M | A Venus that waits for Europa can still make the 2034 window |
| Venus `arrayFactor` | 0.75 | 0.3 | Panels tilted away from the Sun (Magellan: about 1 kW from 12.6 m²). The 320 W radar now decides the panel size |
| Europa `unlockRep` | 5 | 4 (+ vault) | Reachable in 2029–2030 by a player who plans |
| Europa `devFactor`, money | 0.8, $150M | 0.65, $100M | Lets the 2032 or 2033 direct-route windows finish before 2037 |
| Europa `turnDays` | 45 | 28 (data needs scaled, then raised) | A flyby about every 4 weeks; science must end inside the career. Shell needs 400 Gbit, so both the 3 m dish and the 100 W radio matter |
| `CONST.storagePerMonth` | 2.5 | 3.5 | InSight's 26-month slip cost about $150M |
| Test months (shake, thermal-vacuum, software, hot-fire, radiation) | 1, 1.5, 1, 0.5, 1 | 0.5, 1, 0.5, 0.25, 0.5 | Standard plan 2 months (was 3.5), thorough 4.75 (was 8): thorough tests now fit the wait before a window |
| History events per Earth project | 3 | 2 | Fewer stops before the first launch |
| TECH costs | | unchanged | 410 points in all; a careful career earns about 350 |

### Rules changed in `js/agency.js`

- **Storage from the real ready date** (`settleWait`, used by `plan` and `approve`).
- **Budget check counts what you already owe.** It compares what is due by
  launch (build, reserve, launcher) with the money that will be free by then:
  bank, minus what other projects still owe, plus budget years until launch.
  Red text: "$279M due by launch, only about $133M free by then"
  (`check.money.short`). Before this change you could approve three projects in
  year one, see three green checks, and run out of money.
- **Window check flags science that ends after 2036**
  (`check.window.late`: "Launches Apr 2032, science ends Dec 2037: after the end of 2036").
  Without it, a Europa probe on the slow gravity-assist route looked fine and never reported.
- **A missed planetary window costs reputation −1** (GDD 4.4), once, and no
  second hit from the 15% cost-growth rule for the same slip.
- `EVENTS_MAX = 3`, `EVENTS_EARTH = 2`.

## How a career plays now

Careful player (Mars and Venus first), typical seed:

```
2027-01  approve Moon + Nile (seed grant buys the 100 W radio)
2027-10  ... reviews, 1–2 history events each
2028-02  LAUNCH Nile → its team is free: approve Storm watcher
2028-04  LAUNCH Moon
2028-08  Nile results (rep 1)
2029-04  Moon results (rep 3) → Mars and Venus unlock; approve Mars (window Feb 2031)
2029-06  approve Venus (window May 2031); money down to about $260M
2031-02  LAUNCH Mars          2031-05 LAUNCH Venus
2033-05  Mars headline        2033-07 Venus headline   → nothing left that can finish
```

Expert (Europa early), typical seed:

```
2029-04  approve Mars; research goes to vault, ice radar, heavy launcher
2029-11  approve Europa (direct route, heavy launcher, context camera, 75 kg vault)
2032-04  LAUNCH Europa (last good window; Feb 2031 also works)
2032-12  Mars headline → +100 science buys the imaging radar
2032-12  approve Venus for the Aug 2034 window
2035-12  Europa headline      2036-08 Venus headline
```

The fork: Venus has a window every 19 months, Europa effectively two (2032 and
2033, direct route). Research is too scarce in 2029–2031 for both kits. A player
who takes Venus first gets two headlines, and one who commits to Europa early can get three.

## Design space checks

- **Venus.** With the radar, 3 m² of panels is red, 4 m² amber, 5 m² green. Without
  the radar, 3 m² is plenty. Without aerobraking, Venus misses the headline
  (about 87 points: the radar map falls short). Venus needs the radar and aerobraking; the 1 Tbit recorder is optional.
- **Mars** still earns its headline without aerobraking (81 points, still on the light
  launcher, against 95 with it), so aerobraking is a nice-to-have there and a must at Venus.
- **Europa.** The direct route on the heavy launcher is the only way to finish by
  2036. The proven Clipper-like design (telescopic camera, 70 m², 75 kg vault)
  is 1,195 kg against 1,139 kg of lift on the direct route, so the player must slim it:
  context camera, about 60 m² of panels, or the research for lightweight panels and better cells. A
  150 kg vault lowers the risk but uses almost all the lift. Standard tests leave a
  70% chance of a hidden flaw (red); thorough tests 23%. The 3 m dish and the 100 W radio
  are both needed (a 2 m dish gives 64 points and a 50 W radio 68, both short of the headline).
- **Proven designs** (the "Load a proven design" button) pass the science, lift,
  power and data checks once their research is done (`tests/balance.test.js`),
  except the current Europa one, which uses the slow route (see requests below).

## Known issues

- A careful player who takes Venus first has nothing left to start after mid-2031,
  and sits on $1–1.5B by 2036. The HQ skip button crosses those years in 4–5
  stops. The fix needs content, not numbers. One option, simulated: one follow-on
  flight per near-Earth mission after 2031. It brings the careful career to about 60
  minutes, cuts its longest idle stretch from 68 to 28 months and cuts its end money to $1.2B.
  Better still would be an "extend the mission" decision (GDD 4.6) that spends money for
  more science.
- No flight is ever *lost* in a career, because the auto-flight always patches the
  software rather than rebooting. Failures show as low scores, flyby captures and
  dead instruments.
- The time model is an estimate. Playtests should check the first 15 minutes.


## Update: the crew mission (late career)

The crewed lunar flyby (Artemis II-like, unlocks at reputation 5 plus the heavy-launcher research) gives careful players a big late-career goal. In the sim, careful bots approve it around Jan 2034 and fly it in 2036; careful careers now end with about $640M instead of $1.58B, which closes the 'idle money late in the career' issue above.
