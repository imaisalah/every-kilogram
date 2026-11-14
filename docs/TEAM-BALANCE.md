# Mission Sprint: balance notes (model)

How the numbers in `js/team/data.js` and `js/team/sim.js` were tuned, and how to check them. Everything here was measured by flying designs through `SMD.team.sim.fly`, not estimated.

**Verify:** `node --test tests/team-sim.test.js` (22 tests, about 20 s). The test file carries 113 stored winning designs. To re-run the wider search, sample designs with `newDesign`/`set`, score each with `fly`, and climb one key at a time; fixing the orbit and instrument set for each archetype keeps it distinct.

## What "winning" means
A design is a winner if it passes the hard launcher check, is under budget, and returns `success: 'full'` on 3 seeds (11, 222, 3333) with every crisis fixed. `full` = science at least 90% of the goal, life at least 70%, still alive. `partial` = science at least 50% (or at least 30% with life at least 70%).

The search fixes the orbit and instrument set for each archetype, fixes a typical surface kit on landing missions (150 kg ascent fuel, laser, hand drill, 2 turrets, 2 medkits, 1 spare oxygen day), then climbs every other key on the same seed.

## Winning archetypes (orbit | instruments)

Counts are winning orbit+instrument combinations out of those searched (1 to 3 instruments per set).

| Scenario | Requirement | Cadet | Engineer | Flight director |
|---|---|---|---|---|
| Nile | Sharper images | 22 of 28 | 17 of 56 | 7 of 56 |
| Nile | Wider coverage | 24 of 28 | 19 of 56 | 6 of 56 |
| Storms | Early warning | 13 of 28 | 13 of 42 | 7 of 42 |
| Storms | Track the whole storm | 12 of 28 | 12 of 42 | 2 of 42 |
| Moon | Map the ice | 4 of 28 | 60 of 123 | 11 of 123 |
| Moon | See the craters | 6 of 28 | 37 of 123 | 2 of 123 |
| Mars | Find the ice | 4 of 28 | 5 of 75 | 3 of 75 |
| Mars | Choose the landing site | 8 of 28 | 8 of 75 | 1 of 75 |
| Venus | Map for eruptions | 4 of 14 | 6 of 28 | 4 of 28 |
| Venus | Read the rocks | 4 of 14 | 3 of 28 | 2 of 28 |
| Europa | Measure the ice | 13 of 41 | 31 of 82 | 4 of 82 |
| Europa | Find the ocean | 4 of 41 | 12 of 82 | 2 of 82 |

Distinct winning archetypes per scenario, all difficulties together:

| Scenario | Distinct | Examples of different strategies that all win |
|---|---|---|
| Nile | 35 | Sun-synchronous with a telescopic camera; sun-synchronous with a wide imager and spectrometer; low 400 km orbit with the camera |
| Storms | 20 | Geostationary with spectrometer and wide imager (always watching, expensive climb); polar 800 km with spectrometer and context camera (cheap, gaps between passes) |
| Moon | 76 | Polar neutron + radar; frozen orbit with radar and laser altimeter; equatorial cheap route with radar and camera |
| Mars | 18 | Low polar orbit radar + camera (hard to reach); long ellipse with ice radar + neutron (cheap capture, weaker science) |
| Venus | 8 | Low circular SAR + spectrometer; Magellan-style ellipse with SAR + radio science |
| Europa | 32 | Flyby tour with sounder + magnetometer; low Europa orbit (the radiation gamble, needs a heavy vault and a short life) |

Director is deliberately thin: a few designs win, and Mars's landing-site requirement has only one. That is the most exposed spot if anyone tunes it tighter.

## No dominant strategy
Tested in `no dominant strategy: several winning archetypes, and maxing everything does not fit`:
- Every scenario and difficulty has at least two different winning orbit+instrument sets.
- Picking the heaviest, most expensive option in every group never fits: it breaks the budget or the launcher on all six scenarios.
- The rocket equation makes mass feed itself: on Mars a low polar orbit needs about 2.1 km/s of capture burn, so every kg of payload costs roughly 1 kg more in propellant and tankage.

## Beginners
A simulated beginner team picks the two instruments most relevant to the requirement, then fixes whatever the dashboard shows red or yellow, one option at a time, with no knowledge of the flight. It answers half of the crises.

| Scenario | Difficulty | Partial or better (first try, of 8) | Full | Score first try | Score after the suggested change |
|---|---|---|---|---|---|
| Nile | Cadet | 8 | 8 | 829 | 872 |
| Nile | Engineer | 6 | 5 | 650 | 818 |
| Storms | Cadet | 8 | 8 | 915 | 915 |
| Storms | Engineer | 8 | 7 | 836 | 853 |
| Moon | Cadet | 8 | 5 | 894 | 917 |
| Moon | Engineer | 8 | 2 | 813 | 849 |
| Mars | Cadet | 8 | 0 | 687 | 814 |
| Mars | Engineer | 8 | 0 | 654 | 768 |
| Venus | Cadet | 8 | 7 | 889 | 909 |
| Venus | Engineer | 8 | 5 | 804 | 829 |
| Europa | Cadet | 8 | 0 | 827 | 867 |
| Europa | Engineer | 8 | 2 | 796 | 836 |

These scores include the neutral team score. Storms Cadet does not improve because it is already a success at 118% science (`bestChange` returned no gain). The test requires at least 75% partial on Cadet and at least 90% same-or-better on the second try.

## Round length
From the starter design to a winning design takes a median of 5 decisions on Cadet (mean 6.6) and 10 to 11 on Engineer or Flight director. Shared across 4 players in 180 to 240 s that is one change per player roughly every 40 seconds, which fits the clock.

## Decisions per role
Mars, groups each role can change (the multi-select instrument and weapon groups count for several picks):

| Difficulty | Planner | Engineer | Scientist | Comms |
|---|---|---|---|---|
| Cadet | 5 | 6 | 5 | 6 |
| Engineer / Director | 7 | 8 | 5 | 7 |

On Earth training flights the surface groups are gone and the counts are 3-4 on Cadet and 5-6 on Engineer.

## Every resource binds somewhere
Mean tightness (used ÷ limit) of the stored winners. Tested: every resource reaches at least 0.8 in at least one scenario and difficulty.

| Resource | Tightest in | Why |
|---|---|---|
| Budget | Moon, Nile | Small budgets; every extra instrument competes with the ground stations |
| Mass | Moon (0.84), Storms geostationary | Launcher step costs, and the climb to GEO burns most of the stack |
| Power | Venus (above 1 on some winners) | SAR draws 320 W, and panels are tilted to survive the heat |
| Data (recorder) | Europa (0.86) | All the science of a two-week flyby lands in one burst |
| Comms | Mars, Europa (above 1) | Rate falls with distance squared, so a design sends less than it could record |
| Time | Mars (0.98) | A 26-month launch window; slipping costs $12M a month |

Values above 1 mean winners make more data than they can send and accept the loss. On Venus, some winners also run a small average power deficit and lean on the battery.

## Secret agendas
Agendas conflict by construction (instruments against power margin, more stations against budget). Among stored winners, the four-way set (3+ instruments, 20% power margin, 2 stations, under budget) was met together by far fewer than 20% of designs.

A greedy check that nudges winners toward each agenda found it met in partial or full success everywhere except:
- `no_spill` on Mars at Engineer and Flight director
- `power_margin` and `battery_safe` on Europa at Engineer

The greedy search may simply have missed a solution there, so those cells are "not found", not "proven impossible". `under_budget` is scaled by difficulty (Cadet 80%, Engineer 85%, Director 90%) because 80% was out of reach on the tight budgets.

## Simplifications the game should state
- Launchers are the generic classes from `js/data.js`. Capacity: low orbit × an orbit factor near Earth, `c0 × exp(−C3/scale)` beyond.
- Bus mass (`busKg`) is a per-scenario baseline for what the game does not itemise.
- Each screen orbit is a real orbit (real eclipse and pass timing) standing in for part of the mission; returned data is scaled up to the full lifetime.
- `rateMult` scales instrument data rates per scenario so that Earth and Europa recorders matter; needs are scaled equally so science value is unchanged.
- Deep-space link is `K·P·D²/d²` with the existing `linkK`; near-Earth links use a smaller ground-station constant and a per-radio rate cap.
- Radiation is a single dose counter against shield × computer hardness. Battery wear and panel loss are small fixed rates per year.
- A budget overrun is taken out of operations, so the mission ends early.
- The crew's lander, suits and their own ascent vehicle are provided by the sponsor. `ascent` is extra fuel that lifts samples: `liftKg = extra fuel ÷ (mass ratio − 1)` with Isp 320 s.

## Sources
Real missions and numbers are cited in `js/team/data.js` (`SRC`, `ANALOGS`, `SURFACE_ANALOGS`) and `content/sources.js`. Obituary analogs: Mars Global Surveyor, Skylab, Telstar 1, Spirit, Galileo, Mars Observer, Mars Climate Orbiter, Kepler, Mars Polar Lander, Hubble, CONTOUR, Pioneer 10, Genesis, Beagle 2 (ESA), Apollo 13, Opportunity.
