# Every Kilogram: making the management game authentic (NASA practice, real numbers, lessons learned, NGSS)

Research date: 2026-10-26. Numbers are tagged **[V]** when a source in this session confirmed them and **[~]** when they come from memory or secondary reporting and need checking before they go on screen.

---

## 0. Status of the source documents
- **NPR 7120.5 is the governing document.** I did not confirm which revision (E or F) is current. Check NODIS before quoting a section number. The best public explainer of the phases is the NASA Systems Engineering Handbook, Ch. 3: https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/ and https://www.nasa.gov/seh/3-project-life-cycle
- **Latest GAO report:** GAO-26-108556, *NASA: Assessments of Major Projects*, dated **July 23, 2026**: https://files.gao.gov/reports/GAO-26-108556/index.html
  - 36 major projects, about $70B or more in total. Cumulative overruns are about $4.7B and cumulative delays are 14 years **[V]**.
  - IMAP launched 3 months early and returned $22.2M of unused reserves **[V]**. This is a good "good management" reward event.
- **Budget context:** the FY2027 President's Budget Request (April 3, 2026) proposes cutting NASA science by about 46% and ending more than 40 missions, including Mars Sample Return. Congress has not settled it, and the House bill proposes $2.5B for planetary science **[V]**: https://www.planetary.org/articles/analyzing-the-fy-2027-nasa-budget-request and https://spacepolicyonline.com/news/house-appropriators-reject-deep-cuts-to-nasa-in-fy2027/
  - Game use: a "budget storm" event with real stakes.

---

## 1. NASA project life cycle (NPR 7120.5): phases, KDPs, reviews

The life cycle has two stages, Formulation (Pre-A, A, B) and Implementation (C, D, E, F). Each **Key Decision Point (KDP)** is "the event at which the decision authority determines the readiness of a program/project" to advance **[V, SEH]**.

- **Two-step AO missions (Discovery, New Frontiers):** the competitive down-selection *serves as* KDP B (NPR 7120.5E §2.2.7.1, cited in the SMD JCL memo) **[V]**.
- **KDP C (Confirmation):** sets the Agency Baseline Commitment (ABC). Projects are budgeted at a **70% Joint Cost & Schedule Confidence Level (JCL)** and funded at no less than 50%. The gap is held as **UFE (Unallocated Future Expenses)** above the project. For PI-led missions, any UFE drawn beyond the Management Baseline counts as an **overrun of the PI's cost commitment** **[V]**: https://explorers.larc.nasa.gov/APMIDEX2016/MO/pdf_files/5_SPD-19_PI-ledmissions_70JCL.pdf
- **KDP letters:** the SEH page does not spell out the KDP letter for each phase. The A/B/C/D/E/F placement below follows the standard NPR 7120.5E figure **[~]**. The Europa Clipper KDP E case is confirmed **[V]**.

Durations are typical for a Discovery mission, based on the 2019 AO, InSight, Psyche and Lucy.

| Phase / gate | What really happens | Reviews | Typical Discovery duration | Student-friendly game event |
|---|---|---|---|---|
| **Pre-Phase A: Concept Studies** | Many ideas and options. Stakeholder goals, a rough Concept of Operations, rough cost/schedule/risk, and the proposal. | **MCR** (Mission Concept Review): is the mission worth doing, and is it feasible? | Years of informal study. The proposal itself takes about 3–4 months after the AO is released [~]. | "Announcement of Opportunity!" The player writes a 1-page proposal (science goal, instruments, cost estimate). Reviewers score science merit and feasibility. |
| **KDP A** | Approval to enter Phase A. | – | – | The player's proposal is picked for a concept study. |
| **Phase A: Concept & Technology Development** | Top-level requirements, trade studies, technology needs, a baselined SE Management Plan. | **SRR** (System Requirements Review): are the requirements complete and testable? **MDR/SDR** (Mission/System Definition Review): does the architecture meet them? | **9 months, $3M per team** (2019 Discovery AO; also the 2025 SMEX AO) **[V]** | "Concept Study Report + site visit." Only 1–2 of about 4 teams survive. Picking a design that is too ambitious loses on feasibility risk. |
| **KDP B** | For AO missions this is the down-select. | – | – | Win the competition → full funding. |
| **Phase B: Preliminary Design & Technology Completion** | Preliminary design, requirements put under configuration control, technology matured. | **PDR** (Preliminary Design Review): is the design complete enough to commit? New technology should be at **TRL 6** [~ GAO best-practice metric]. | 12–18 months [~] | Tech gamble: any part below TRL 6 at PDR triggers a "Fix or Descope" card. |
| **KDP C: Confirmation** | The ABC is set (cost and launch date promised to Congress). 70% JCL. | – | – | "Signing the contract with Congress." The game locks your budget and launch date, and every later overrun is tracked publicly. |
| **Phase C: Final Design & Fabrication** | Detailed design (product baseline), build flight hardware, write software. | **CDR** (Critical Design Review): is the design mature enough to build? GAO's metric is about 90% of drawings released [~]. **PRR** if units are produced in series. **SIR** (System Integration Review): are parts and facilities ready to integrate? | 18–24 months [~] | Parts shortages and vendor slips. Late instrument delivery eats schedule margin. |
| **KDP D** | Approval to start Assembly, Integration & Test (AIT). | – | – | – |
| **Phase D: Assembly, Integration, Test, Launch & checkout** | AIT: thermal-vacuum, vibration, acoustic, EMI tests. Ship to launch site. Launch. | **TRRs**; **SAR**/pre-ship review; **ORR** (Operational Readiness Review: are the ground system and team ready to fly it?); **MRR/FRR** (Flight Readiness Review: are vehicle and payload ready?); **LRR** (Launch Readiness Review, held by the launch-services side about L-1 or L-2 days; not on the SEH page) [~]. | 12–18 months; launch-site campaign about 2–3 months [~] | "Test campaign": choosing *full test* or *skip test* (see MPL and Genesis). FRR "Go/No-Go" poll of all station leads. |
| **KDP E** | Approval to launch and operate. Example: Europa Clipper KDP E on **Sept 9, 2024**, held while the transistor radiation question was still being analyzed. It passed, and launch followed on Oct 14 **[V]**. | **PLAR** (Post-Launch Assessment Review), about 30–90 days after launch [~] | – | A last-minute part problem (see §3). The player can launch now with a known risk or slip the launch window. |
| **Phase E: Operations & Sustainment** | Cruise, science, anomaly response, extension requests. | **CERR** (Critical Events Readiness Review) before orbit insertion, EDL or flybys. **DR** (Decommissioning Review). Senior Review for extended missions. | Prime mission 2–4 years, plus extensions | Orbit-insertion night. Anomalies (Juno valves, Lucy array). The player asks for an extended mission. |
| **KDP F** | Approval to decommission. | – | – | – |
| **Phase F: Closeout** | Disposal, archive the data (Planetary Data System), lessons learned, final report. | **DRR** (Disposal Readiness Review) | About 6–12 months [~] | "Grand finale" choice (deorbit, impact or graveyard orbit). Bonus points for archiving data and publishing lessons learned. |

**Real Discovery timeline anchors for calibrating the game clock:**
- InSight: selected Aug 2012, planned launch Mar 2016 (about 3.5 years), actually launched May 5, 2018.
- Psyche: selected Jan 2017, planned Aug 2022, launched Oct 13, 2023.
- Lucy: selected Jan 2017, launched Oct 16, 2021.
- Discovery 2019 AO: released April 1, 2019. At most 2 missions down-selected after Phase A **[V]**. DAVINCI and VERITAS were picked in June 2021 **[~]**. This is your Venus mission.

---

## 2. Real costs and schedules

### 2a. Cost caps (latest available)
| Class | Cap | Scope | Status |
|---|---|---|---|
| **Discovery** | **$500M (FY2019 $)** **[V]** | Phases A–D, PI-managed. Excludes the standard launch vehicle, Phases E–F and contributions. A **minimum 25% reserve must fit inside the cap** (2017 planning notice) **[V]** | Most recent final AO is 2019. I found no newer Discovery AO. |
| **New Frontiers 5** | **$900M (FY2022 $)** for A–D, plus a **$300M** cap for Phase E. Excludes launch. **[V, draft AO]** | The outer-planets community (OPAG) says this is 12.5% lower than NF4 ($1,029M in FY22 dollars) **[V]** | AO slipped to "no earlier than 2026". Whether it has been released is unconfirmed. https://newfrontiers.larc.nasa.gov/NF5 |
| **SMEX (Explorers, for scale)** | **$170M (FY2025 $)** for A–F, excluding launch **[V]** | Phase A is 9 months at $3M | AO postponed to no earlier than April 2026 |
| **Flagship** | No cap. Directed missions. | Europa Clipper **$5.2B** over the full life, 2015–2034 **[V]**. Its estimate was about $2B in 2013 **[V]** | – |

### 2b. Real mission data card

"All-in" launch cost is NASA's contract value, which includes processing and integration on top of the rocket price.

| Mission | Class | Cost | Schedule | Launch vehicle (NASA all-in) | Launch mass | Power at destination | Data rate |
|---|---|---|---|---|---|---|---|
| **Magellan** (Venus radar) | Planetary | **$551M**: spacecraft $287M + radar $120M + project $49M + ops $95M **[V]** | Launched May 4, 1989 | Shuttle STS-30 + IUS | **3,449 kg** (NASA guide 3,453) **[V]** | n/a | **268.8 kbps** X-band, 115.2 kbps backup **[V]** |
| **MRO** | Mars Program | about **$720–750M** [~] | Launched Aug 12, 2005; Mars orbit Mar 2006 | **Atlas V 401** (its first interplanetary flight) | **2,180 kg**, of which 1,149 kg propellant **[V]** | about **2,000 W at Mars** (6,000 W at Earth) per JPL; NSSDC says 1,000 W **[V]** | **up to 6 Mbps** at closest range, 0.6 Mbps at farthest; 3 m HGA, 100 W transmitter **[V]** |
| **LRO** | Exploration (directed) | **$504M** LRO, $583M with LCROSS **[V]** | Launched June 18, 2009 | Atlas V 401, **$136.2M** all-in (2006 award) **[V]** | 1,916 kg [~] | 1,850 W peak / 823 W orbit average **[V]** | **100 Mbps Ka-band** **[V]** |
| **Juno** | New Frontiers 2 | **about $1.1B** ($1.13B), including launch and 74 months of operations **[V]** | Selected 2005, launched Aug 5, 2011 | **Atlas V 551** | **3,625 kg** **[V]** | **about 400–435 W at Jupiter** **[V]** (not 500) | n/a |
| **Landsat 9** | Earth science (with USGS) | about **$900M** (2017 estimate) [~]; spacecraft contract $129.9M | Launched Sep 27, 2021 | Atlas V 401, **$153.8M** all-in **[V]** | **2,711 kg** **[V]** | n/a | about **740 scenes/day** **[V]**; X-band 384 Mbps on Landsat 8, and Landsat 9 is a clone [~] |
| **InSight** | Discovery 12 | **$675M** + **$153.8M** delay ≈ **$829M** NASA share **[V]** | Selected 2012; missed Mar 2016; launched May 5, 2018 | Atlas V 401 (Vandenberg) | about 694 kg [~] | n/a | Relayed through MRO and Odyssey |
| **Psyche** | Discovery 14 | – | Planned 2022, launched Oct 13, 2023 | **Falcon Heavy, $117M** (2020) **[V]** | – | – | – |
| **Europa Clipper** | Flagship | **$5.2B** **[V]** | Launched Oct 14, 2024; Jupiter April 2030 | **Falcon Heavy, $178M** (2021) **[V]** | about 6,000 kg (JPL quick facts: 5,800 kg incl. 2,750 kg propellant; Wikipedia 6,065) **[V]** | 2 arrays of 14.2 × 4.1 m; Jupiter gets only 3–4% of Earth's sunlight **[V]** | n/a |
| **Dragonfly** | New Frontiers 4 | about $3.35B [~] | Launch July 2028 | **Falcon Heavy, $256.6M** (RTG handling adds cost) **[V]** | – | RTG | – |

### 2c. Commercial launch prices
| Vehicle | Price | LEO capacity | To Mars | Notes |
|---|---|---|---|---|
| **Falcon 9** | **$74M** standard price through 2026 (was $70M in 2025, $67M in 2022) **[V, via reporting of SpaceX's Capabilities page]** | about 22.8 t expendable [~] | **4,020 kg** (SpaceX sheet; probably F9) **[V]** | 5.5 t to GTO at list price |
| **Falcon Heavy** | **$97M** list (2022) **[V]**; NASA all-in $117M–$257M | about 63.8 t [~] | **16,800 kg** **[V]** | – |
| **Atlas V** | No longer sold for new missions [~]. NASA all-in for the 401 was $136M–$154M **[V]** | 401: about 9.8 t; 551: about 18.8 t [~] | – | Its heritage is the flagship rides listed above |
| **Vulcan Centaur** | about **$110M** starting price (ranges $100M–$200M) [~]; Space Force FY26 average about $214M per mission (derived) | **27,200 kg** VC6 / 24,600 kg VC4 **[V]** | – | – |

**Game rule from the data:** price the launch at about **1.3–2.6× list price** to match NASA's all-in contract values. Add a surcharge for nuclear power (Dragonfly).

---

## 3. Lessons learned turned into game events
NASA's lessons-learned database: https://llis.nasa.gov/

| Event | What went wrong | One-line lesson | Game decision it maps to |
|---|---|---|---|
| **Mars Climate Orbiter (1999)** | Ground software (SM_FORCES) wrote thruster data in **pound-force·s** instead of the **newton·s** the interface spec required. Navigation was off by a factor of 4.45 and the orbiter dipped to about 57 km, below the ~80 km survivable minimum [~ altitude]. Contributing causes: no complete end-to-end testing of the navigation software, poor communication within the team **[V]** | Write interface specs down and test them end to end. | **Interface verification budget.** Skipping a units/ICD check saves time but hides a defect that shows up at orbit insertion. A mini-game: spot the mismatched units. |
| **Mars Polar Lander (1999)** | Leg deployment sent false "touchdown" signals. The software logic meant to ignore them was implemented wrong, so the engines cut at about **40 m**. The test was run with mis-wired sensors and never repeated **[V]** | Test as you fly, and re-test after any fix. | **Test fidelity choice.** "Retest after rewiring" costs time; skipping it raises the EDL failure chance. |
| **Mars Observer (1993)** | Lost while pressurizing the propellant tanks just before orbit insertion. Most likely cause: oxidizer got past a check valve and reacted in the pressurization lines, rupturing them **[V]** | Propulsion that sits idle through a long cruise needs isolation and checks before use. | **Propulsion design choice** (isolation valves cost mass) plus a CERR checklist. |
| **Galileo HGA (1991)** | 3 of 18 ribs stuck. Dry lubricant was lost (blamed on cross-country truck trips and storage after the post-Challenger delays). Data rate fell from **134 kbps to 8–16 bps**, recovered to about **1,000 bps** effective through compression and antenna arraying **[V]** | Deployables are single points of failure, and storage and transport count as environments too. | **Antenna choice** (deployable vs fixed vs backup LGA) plus a **software rescue** minigame (compression, ground arrays). |
| **Genesis (2004)** | The G-switches meant to fire the parachute were **installed upside down** because of a wrong drawing. Design reviews, verification and a Red Team all missed it; "unfounded confidence in heritage design" was cited; a pre-test was skipped **[V]** | Heritage hardware is not free; verify it again in the new context. | **Heritage discount trap.** Reused parts are cheaper but carry a hidden "unverified in this context" flag. |
| **Hubble mirror (1990)** | The null corrector was spaced **1.3 mm** wrong (paint flaked off a metering-rod cap). The mirror was ground about 2.3 µm too flat at the edge. Other tests showed the error and were ignored. Fixed by COSTAR in 1993 **[V]** | Never trust a single test instrument; cross-check it independently. | **Independent verification** option. Ignoring warning signs from secondary tests causes a delayed failure; a costly servicing fix follows. |
| **Beresheet (2019)** | One IMU failed at about 15 km. In about 30 seconds the team sent a reset that set off a cascade and shut the main engine. On its single flight computer, patches lived only in RAM and were lost on reboot **[V]** | Under time pressure, don't send untested commands; a single-string design is fragile. | **Redundancy (single vs dual string)** plus **ops procedures**. A timed decision during EDL where "Reset" is a trap. |
| **InSight (2015)** | A vacuum leak in the SEIS seismometer was found in Dec 2015. The 2016 Mars window was too short to fix it, so the launch moved to the **next window 26 months later**. Cost **+$153.8M**, money taken from future missions **[V]** | Planetary windows are hard deadlines; partner-built hardware is on your critical path. | **Launch window wall.** Missing it means a 26-month wait plus a cost hit. Partner contributions save money but add risk. |
| **Psyche (2022)** | Flight software was late. The board's root cause was a **workforce/workload imbalance at JPL** plus poor communication; the Standing Review Board's timing missed it. **VERITAS was delayed at least 3 years** to free up staff **[V]** | People are a resource with limits; a slip on one project hurts the others. | **Shared team pool.** Overloading one team creates cascading delays on your Venus mission. |
| **Juno (2016)** | Two helium check valves took minutes, not seconds, to open. NASA chose to **stay in the 53-day orbit** instead of risking the burn down to 14 days, "a risk to completion of science objectives" **[V]** | Accepting less can save the mission. | **Live descope decision:** safe orbit (less science per year) vs risky burn. |
| **Lucy (2021–23)** | One solar array snagged its lanyard. Running both motors together got it to 353–357° of 360°, not latched. NASA accepted the risk **[V]** | Backup motors and calibrated ground models save missions. | **Redundant deployment motor** purchase pays off. |
| **Europa Clipper (2024)** | Radiation-hardened transistors were found to fail at lower radiation doses than their rating. Months of testing, then KDP E passed and the mission launched **[V]** | Industry-wide part problems can hit at the last minute; analysis can buy back confidence. | **Last-minute parts alert:** pay for testing, swap parts (slip), or fly with a reduced plan. |

---

## 4. Educational standards (NGSS)
Topic pages: https://www.nextgenscience.org/topic-arrangement/msengineering-design and https://www.nextgenscience.org/topic-arrangement/hsengineering-design

**Engineering Design (the core fit):**
- **MS-ETS1-1:** Define criteria and constraints of a design problem with sufficient precision **[V]**. In the game: mission requirements plus the cost cap.
- **MS-ETS1-2:** Evaluate competing design solutions with a systematic process **[V]**. In the game: proposal competition, trade studies.
- **MS-ETS1-3:** Analyze data from tests to compare solutions and combine their best features **[V]**. In the game: test campaigns.
- **MS-ETS1-4:** Develop a model to generate data for iterative testing **[V]**. In the game: the simulate, revise, re-simulate loop.
- **HS-ETS1-1:** Analyze a major global challenge to specify criteria and constraints **[V]**. In the game: the Nile Earth-observation mission (water and food security).
- **HS-ETS1-2:** Break a complex problem into smaller ones **[V]**. In the game: subsystems and the phase structure.
- **HS-ETS1-3:** Evaluate solutions by prioritized criteria and trade-offs, including cost, safety and reliability **[V]**. In the game: mass/power/cost/risk trades.
- **HS-ETS1-4:** **Use a computer simulation** to model the impact of proposed solutions **[V]**. In the game: the 3D mission simulation itself.

**Science content:**
- **HS-ESS1-4:** Use mathematical or computational models to predict the motion of orbiting objects. It explicitly covers human-made satellites **[V]**: https://www.nextgenscience.org/pe/hs-ess1-4-earths-place-universe
- **HS-PS2-4:** Newton's Law of Gravitation **[V]**: https://www.nextgenscience.org/pe/hs-ps2-4-motion-and-stability-forces-and-interactions
- **MS-ESS1-3** (scale of solar-system objects), **MS-PS2-4** (gravity depends on mass), **HS-PS3-3** (an energy-conversion device under constraints: solar arrays vs RTG), **MS-ESS3-3** (monitoring human impact: Nile), **HS-ESS1-6** (planetary surfaces: Moon, Venus). These five codes are from memory **[~]** and need checking at https://www.nextgenscience.org/
- **Science & Engineering Practices:** 2 Models, 4 Data, 5 Math/Computational thinking, 6 Designing solutions, 7 Argument from evidence (review boards).
- **Crosscutting Concepts:** Systems & system models; Scale, proportion & quantity; Energy & matter; Influence of engineering on society.

**Teacher-facing learning objectives.** Students will:
1. Turn a science goal into measurable requirements and constraints (mass, power, data, cost, time).
2. Run trade studies and justify a design with evidence, not preference.
3. Explain why sunlight drops with distance (inverse square, 1/r²) and why Juno and Clipper need huge solar arrays.
4. Use orbital mechanics ideas (launch windows, Δv, gravity) to predict mission timelines.
5. Manage a fixed budget with reserves, and explain why about 25% of the budget is held back.
6. Find, rank and reduce risks (likelihood × consequence).
7. Analyze a real NASA failure and connect it to a process fix.
8. Defend a design at a review board (argument from evidence).
9. Connect Earth observation data (Landsat) to a real problem facing society (the Nile).

---

## 5. Ten authentic management mechanics
1. **Gate reviews as boss fights (MCR to DRR).** A Standing Review Board scores entrance and success criteria. Outcomes: Pass / Pass with action items (RFAs) / Fail and replan. Psyche's lesson: reviews can be badly timed, so the player can pay for an extra peer review.
2. **Cost reserve (UFE) bar.** At least 25% of A–D must be held inside the cap (Discovery rule). Realized risks spend it down. Going past the PI's Management Baseline counts as an "overrun of PI commitment" and triggers a **termination review**.
3. **Congressional breach meters.** Under NASA's authorization law, 15% cost growth or a 6-month slip means notifying Congress, and 30% means re-authorization [~ confirm in 51 U.S.C. §30104]. Combine with GAO's annual public scorecard (GAO-26-108556) as a "press" meter.
4. **KDP C commitment and the 70% JCL.** The player picks a confidence level. Higher confidence means a bigger budget ask and lower odds of selection; lower confidence means a cheap bid and likely overruns.
5. **Schedule margin and hard launch windows.** Mars windows come every 26 months, so InSight's slip cost +$153.8M. Use the real NASA Trajectory Browser ephemerides (https://trajbrowser.arc.nasa.gov/) to generate 2027–2036 windows [~ URL].
6. **Mass and power margins by maturity.** Planned mass grows from Pre-A to CDR (AIAA S-120A mass-growth allowances) [~]. Exceeding launch capacity forces a bigger launcher (F9 $74M to FH $97M list) or a descope. This fits the game title, "Every Kilogram".
7. **Baseline vs Threshold mission (descopes).** AO proposals define a baseline mission and a smaller **threshold** mission [~]. Pre-defined descope cards (drop an instrument, shorten operations, accept the Juno 53-day orbit) save money or schedule for less science.
8. **Technology readiness gate.** New technology must reach TRL 6 by PDR (GAO metric). Paying for maturation or using heritage parts is cheaper but carries a Genesis-style hidden "heritage" risk.
9. **Shared workforce pool.** Teams are assigned across missions. Overload produces Psyche-style slips and delays the next mission (VERITAS was pushed back at least 3 years).
10. **Verification depth: test as you fly.** For each subsystem the player buys test fidelity: inspection, analysis, test, or end-to-end test. Each untested item carries a hidden defect chance revealed during the simulation (MCO, MPL, Genesis, Hubble).

**Extras:**
- Partner contributions sit outside the cap but add risk (CNES SEIS on InSight; ISRO NISAR's 3-month slip after an unrelated launch failure).
- 5×5 risk matrix (NPR 8000.4).
- Deep Space Network time / data budget.
- Launch-vehicle all-in costing.
- "Return unused reserves" score bonus (IMAP returned $22.2M).

---

## Sources
- NASA SE Handbook life cycle: https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/ · https://www.nasa.gov/seh/3-project-life-cycle
- SMD JCL and UFE policy: https://explorers.larc.nasa.gov/APMIDEX2016/MO/pdf_files/5_SPD-19_PI-ledmissions_70JCL.pdf · https://appel.nasa.gov/wp-content/uploads/2020/10/OIG-LBFD-Recommendation-4-Response-JCL-Lessons-Learned-Final.pdf
- Discovery: https://discovery.larc.nasa.gov/PDF_FILES/03a_Brown_Overview.pdf · https://astrobiology.nasa.gov/nai/articles/2017/12/15/nasa-discovery-program-announcement-of-opportunity-long-range-planning-information · https://discovery.larc.nasa.gov/announcements.html
- New Frontiers: https://newfrontiers.larc.nasa.gov/NF5 · https://astrobiology.nasa.gov/news/second-community-announcement-advance-notice-regarding-new-frontiers-5-nf5-announcement-of-opportunity/ · https://science.nasa.gov/wp-content/uploads/2023/04/11_AGs.pdf
- SMEX 2025: https://pcos.gsfc.nasa.gov/news/2024/91_2025_Astrophysics_Small_Explorer_AO.php · https://pcos.gsfc.nasa.gov/news/2025/57_SMEX_AO.php
- GAO: https://files.gao.gov/reports/GAO-26-108556/index.html · https://www.gao.gov/products/gao-19-262sp
- Europa Clipper: https://jpl.nasa.gov/press-kits/europa-clipper/quick-facts · https://www.jpl.nasa.gov/news/nasa-awards-launch-services-contract-for-the-europa-clipper-mission/ · https://spacepolicyonline.com/news/nasa-reveals-europa-clipper-cost-growth-mars-sample-return-replan/ · https://science.nasa.gov/blogs/europa-clipper/2024/07/11/nasa-continues-assessing-electrical-switches-on-europa-clipper/ · https://science.nasa.gov/blogs/europa-clipper/2024/08/28/nasas-europa-clipper-mission-moving-toward-october-launch-date/
- MRO: https://www.jpl.nasa.gov/news/press_kits/mro-launch-Aug05.pdf · https://www.jpl.nasa.gov/news/press_kits/mro-arrival.pdf · https://www.jpl.nasa.gov/news/mars-reconnaissance-orbiter-mission-status/ · https://spectrum.ieee.org/mars-gets-broadband-connection · https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2005-029A · https://www.planetary.org/mission-spending/mro-spending
- LRO: https://ntrs.nasa.gov/api/citations/20180000056/downloads/20180000056.pdf · https://www.csmonitor.com/USA/2009/0618/p02s17-usgn.html · https://en.wikipedia.org/wiki/Lunar_Reconnaissance_Orbiter
- Juno: https://www.jpl.nasa.gov/news/press_kits/JunoLaunch.pdf · https://www.jpl.nasa.gov/news/press_kits/juno/facts · https://www.nasa.gov/news-release/nasas-juno-mission-to-remain-in-current-orbit-at-jupiter/ · https://www.jpl.nasa.gov/news/nasa-re-plans-junos-jupiter-mission/
- Magellan: https://solarsystem.nasa.gov/magellan/guide2.html · https://solarsystem.nasa.gov/magellan/guide4.html · https://science.nasa.gov/mission/magellan · https://pds-engineering.jpl.nasa.gov/wp-content/uploads/documents/catalog_search/CatalogTemplateInstrumentHost-Magellan.cat
- Landsat 9: https://www.nasa.gov/press-release/nasa-awards-launch-services-contract-for-landsat-9-mission · https://www.nasa.gov/wp-content/uploads/2015/04/landsat_9_fast_facts.pdf · https://science.nasa.gov/mission/landsat-9/mission-details/ · https://www.usgs.gov/landsat-missions/landsat-9 · https://www.usgs.gov/landsat-missions/landsat-8 · https://spaceflightnow.com/2017/10/23/spacex-ula-win-nasa-contracts-to-launch-earth-observation-satellites/
- InSight: https://spacepolicyonline.com/news/vacuum-leaks-delay-launch-of-nasas-insight-mars-mission/ · https://spaceflightnow.com/2016/09/07/nasa-official-says-new-mission-selections-on-track-despite-insight-woes/ · https://www.space.com/31448-nasa-mars-lander-insight-launch-delay.html
- Psyche: https://www.jpl.nasa.gov/news/as-psyche-mission-moves-forward-nasa-responds-to-independent-review · https://www.nasa.gov/missions/psyche-mission/review-board-nasa-jpl-psyche-progress-outstanding-launch-on-track/ · https://aip.org/fyi/2022/psyche-delay-compels-jpl-reckon-overstretched-staff · https://spaceflightnow.com/2020/03/04/nasa-taps-spacexs-falcon-heavy-rocket-to-launch-mission-to-metal-asteroid/
- Dragonfly launch: https://www.nasa.gov/news-release/nasa-awards-launch-services-contract-for-dragonfly-mission/
- Launch prices: https://spaceflightnow.com/2026/02/24/live-coverage-spacex-to-launch-29-starlink-satellites-on-falcon-9-rocket-from-cape-canaveral-8/ · https://en.wikipedia.org/wiki/Falcon_Heavy · https://en.wikipedia.org/wiki/Vulcan_Centaur · https://www.airandspaceforces.com/weapons/vulcan-centaur/ · https://www.nextspaceflight.com/rockets/70/ · https://www.satellitetoday.com/government-military/2025/10/03/spacex-to-launch-five-ussf-nro-missions-in-fy-2026-ula-two/ · https://www.ulalaunch.com/rockets/vulcan-centaur
- MCO: https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf · https://nssdc.gsfc.nasa.gov/planetary/text/mco_pr_19991110.txt · https://discovery.larc.nasa.gov/PDF_FILES/MCO_report_2.pdf
- MPL: https://ntrs.nasa.gov/api/citations/20000061966/downloads/20000061966.pdf · https://nssdc.gsfc.nasa.gov/planetary/text/nasa_pr_20000328.txt · https://sma.nasa.gov/docs/default-source/safety-messages/safetymessage-2012-09-10-failureofthemarspolarlander-vits.pdf
- Mars Observer: https://www.jpl.nasa.gov/news/potential-causes-of-the-loss-of-mars-observer-identified/ · https://nssdc.gsfc.nasa.gov/planetary/text/marsob.txt · https://appel.nasa.gov/2011/09/27/ata_4-7_mars_observer_lost-html/
- Galileo: https://llis.nasa.gov/lesson/492 · https://www2.jpl.nasa.gov/galileo/hga_fact.html · https://descanso.jpl.nasa.gov/DPSummary/Descanso5--Galileo_new.pdf
- Genesis: https://appel.nasa.gov/2011/08/29/ata_4-6_genesis_launches-html/ · https://www.sciencenews.org/article/tracing-origin-genesis-crash · https://www.nbcnews.com/id/wbna6255641
- Hubble: https://science.nasa.gov/mission/hubble/observatory/design/optics/hubbles-mirror-flaw/ · https://ntrs.nasa.gov/api/citations/19910003124/downloads/19910003124.pdf
- Beresheet: https://planetary.org/articles/software-command-doomed-beresheet · https://www.planetary.org/articles/beresheet-comes-close-crashes · https://davidson.org.il/read-experience/en/science-panorama-en/what-happened-beresheet/
- Lucy: https://science.nasa.gov/blogs/lucy/2023/01/19/nasas-lucy-mission-suspending-further-solar-array-deployment-activities/ · https://science.nasa.gov/blogs/lucy/2022/06/08/nasas-lucy-mission-continues-solar-array-deployment-process/
- NGSS: https://www.nextgenscience.org/topic-arrangement/msengineering-design · https://www.nextgenscience.org/topic-arrangement/hsengineering-design · https://www.nextgenscience.org/pe/hs-ess1-4-earths-place-universe · https://www.nextgenscience.org/pe/hs-ps2-4-motion-and-stability-forces-and-interactions
- Space Apps judging criteria (Influence/Impact, Creativity, Validity, Relevance, Presentation; the 2026 wording is unconfirmed; judging starts Nov 16, 2026): https://spaceappschallenge.org/resources/judging-awards-guide
- Budget: https://www.planetary.org/articles/analyzing-the-fy-2027-nasa-budget-request · https://spacepolicyonline.com/news/house-appropriators-reject-deep-cuts-to-nasa-in-fy2027/