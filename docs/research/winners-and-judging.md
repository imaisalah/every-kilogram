# Every Kilogram: what it takes to win Space Apps 2026 (Space Mission Design Game)

## 0. Read this first: the rule on working before the hackathon

- **The official 2026 Participant FAQ says:** *"A summary of each challenge will be released on September 17, followed by challenge statements on October 28, which include the full details, resources, and requirements. **Teams are not allowed to begin working on the challenges prior to the hackathon.**"* Source: https://www.spaceappschallenge.org/resources/participant-faqs/ (I pulled the text from the site's GraphQL API at https://api.spaceappschallenge.org/graphql, `pageByPath("/resources/participant-faqs/")`).
- **Submission checkbox (2025 form):** teams must check "Confirm All Work is Original". The 2025 eligibility text reads: *"I confirm that the submitted project represents my team's original work and that all external resources, including code, text, and images used in the project, are listed in the NASA Data and the Space Agency Partner & Other Data fields…"*
- **Terms & Conditions** (https://www.spaceappschallenge.org/legal/): *"original content (that is, content that you have created for the NASA Space Apps Challenge)"* must be open source (OSI). If no license is given, NASA uses Apache 2.0. *"You must cite every source… NASA also reserves the right to remove nominations, awards, or winner status from teams that do not cite resources."*
- **What this means for us:** a full game built before 14 Nov 2026 and submitted as hackathon work could cost us eligibility or a win. Judges can see repo history. Ways to reduce the risk:
  - Treat everything done now as research, design docs, data pipelines and art direction.
  - Start a fresh public repo at the hackathon start (14 Nov, 09:00 local time) and build the submitted game there.
  - Any general-purpose code that already exists (engine helpers, loaders) should be published openly before the event under MIT or Apache, then cited in References as third-party material, like three.js. This is a grey area.
  - Ask the Local Lead and the GO Team for a written ruling: info@spaceappschallenge.org.

---

## 1. The 2026 challenge page and its resources

URL: https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/

The page is rendered with JavaScript. I took its embedded data and then queried the GraphQL API directly.

- **Title:** Space Mission Design Game.
- **Levels:** Intermediate, Beginner/Youth. **Skills tag:** Games.
- **First published** 2026-09-17. **Last published** 2026-10-20.
- **Details tab (the whole text so far):** *"Designing a space mission requires careful consideration of competing demands, including mission objectives, spacecraft design, scientific instruments, launch vehicles, budgets, power, mass, communications, and orbital constraints. For students who rarely get to experiment with an entire mission from concept to operation, these trade-offs often remain abstract. Your challenge is to create an interactive game that allows participants to design, manage, and simulate a complete space mission while making engineering decisions, managing limited resources, and evaluating how each choice shapes the success of their mission."*
- **Resources tab today:** *"Resources coming soon."* The challenge provides **no** resource links yet. Full statements and the NASA and partner datasets come out on **28 Oct 2026**.
- **How to re-check on 28 Oct** (the `resourcesTabContent` field is the Resources tab):
  ```
  curl -s https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/ | grep -o 'resourcesTabContent[^}]*'
  ```

**Related 2026 challenges** (14 in total, listed at https://www.spaceappschallenge.org/2026/challenges/). The closest competitor for the same judges' attention is **"Build a Junior Astronaut Mission Trainer"** (Games). It asks for a game where students *"run a lunar or Martian outpost, balancing… life support, radiation shielding, power, and food production."* We should set ourselves apart on the *mission design and spacecraft trade-offs* side, not outpost survival.

Others close to our space:
- Lunar Landing Site Navigator (Sun and Earth visibility, power and direct-to-Earth comms windows).
- Interplanetary Survival Guide: Martian Map.
- Abandoned but not Forgotten (storytelling about NASA hardware).

**2026 Space Agency Partners (17)** from https://www.spaceappschallenge.org/2026/space-agency-partners/: Angola (GGPEN), Argentina (CONAE), Bahrain (BSA), Brazil (AEB), Canada (CSA), ESA, India (ISRO), Italy (ASI), Japan (JAXA), Korea (KASA), Nigeria (NASRDA), Paraguay (AEP), Senegal, Spain (AEE), Türkiye (TUA), UAE (MBRSC), UK Space Agency. Egypt is not on the list. Using partner data is "highly encouraged" (2025 wording).

**Likely resources until the official list exists.** I checked that all of these URLs load (HTTP 200). None of them is official for this challenge yet.
- NASA 3D Resources (free models): https://science.nasa.gov/3d-resources/ and https://github.com/nasa/NASA-3D-Resources
- NASA Systems Engineering Handbook (mission phases, KDPs, TRL): https://www.nasa.gov/reference/systems-engineering-handbook/
- NASA Cost Estimating Handbook: https://www.nasa.gov/ocfo/ppc-corner/nasa-cost-estimating-handbook-ceh/
- SmallSat State-of-the-Art report (real component specs): https://www.nasa.gov/smallsat-institute/sst-soa/
- JPL Horizons (ephemerides, launch windows) and its API: https://ssd.jpl.nasa.gov/horizons/ and https://ssd-api.jpl.nasa.gov/doc/horizons.html
- GMAT (NASA trajectory tool): https://github.com/nasa/GMAT
- NAIF SPICE: https://naif.jpl.nasa.gov/naif/
- NASA Eyes: https://eyes.nasa.gov/
- Planetary fact sheets: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- DONKI space weather: https://ccmc.gsfc.nasa.gov/tools/DONKI/
- Solar System Treks (Moon and Mars maps): https://trek.nasa.gov/
- PDS: https://pds.nasa.gov/
- Earth data: https://www.earthdata.nasa.gov/ and https://worldview.earthdata.nasa.gov/
- APIs: https://api.nasa.gov/
- Mission pages: https://science.nasa.gov/mission/europa-clipper/, https://science.nasa.gov/mission/veritas/, https://science.nasa.gov/mission/viper/
- Images: https://images.nasa.gov/ (usage rules: https://www.nasa.gov/nasa-brand-center/images-and-media/)
- Space Apps GitHub Q&A: https://github.com/nasa/spaceapps

---

## 2. Judging criteria and awards

The 2026 Judging & Awards Guide is not out yet; it comes on **13 Nov** (https://www.spaceappschallenge.org/resources/judging-awards-guide/ currently shows an interstitial page). The text below is from the **2025 guide**, archived at https://web.archive.org/web/20251010000000/https://www.spaceappschallenge.org/resources/judging-awards-guide/.

**Scale:** *"At every level of judging, your project will be evaluated on a scale from 1-to-5, in each of the following criteria."* There are five criteria. No weights are published, so treat them as equal.

| Criterion | What scores 5 (2025 rubric, verbatim key phrases) |
|---|---|
| **Impact** | "addressing a significant problem with innovative methods. Its reach is extensive, inspiring and benefiting a large audience or changing the world." |
| **Creativity** | "a groundbreaking approach that has never been attempted before… challenges conventional methods." |
| **Validity** | "scientifically sound and technically feasible… fully developed and ready for real-world implementation… highly usable and user-friendly." |
| **Relevance** | "fully and directly addresses the challenge… **meaningfully integrates NASA data, utilizing it as a core component… rather than a superficial addition**." A 5 means "NASA data is integral to the project's success." |
| **Presentation** | "well-structured and compelling presentation, clearly articulating the challenge, methods, and importance… **Judges evaluate the demo and full project to compute this score.**" |

The 2025 guide also says: *"remember to pay equal attention to the final criterion: Presentation."*

**Process (2025):**
1. **Local Judges** pick the Global Nominees. Universal Event projects are judged by SMEs, and only against other Universal Event projects.
2. **Global Judges** (NASA and partner experts) pick the Global Finalists and Honorable Mentions.
3. An **executive committee** of NASA and partner leaders picks the 10 Global Winners.

The 2019 guide adds that the challenge author leads judging of that challenge's projects, and three experts judge each project blind.

**2025 scale:** 18,860 teams, 11,500+ projects, about 1,294 nominees, 45 finalists, 10 winners. Source: https://www.spaceappschallenge.org/2025/meet-the-2025-global-winners/. The nominee and finalist counts come from secondary coverage.

**The 10 Global Awards** (https://www.spaceappschallenge.org/awards/):
- **Best Use of Science:** best and most valid use of science or the scientific method.
- **Best Use of Data:** makes space data accessible or uses it in a unique application.
- **Best Use of Technology:** most innovative use of technology.
- **Galactic Impact:** most potential to improve life on Earth or in the universe.
- **Best Mission Concept:** *"most plausible concept and design"*. This is our natural target.
- **Most Inspirational:** "captures our hearts".
- **Best Use of Storytelling:** communicates the potential of open data through storytelling.
- **Global Connection:** connects people worldwide through technology.
- **Art & Technology:** combines technical and creative skills.
- **Local Impact:** greatest potential for local impact.

**2026 timeline** (FAQ):
- 28 Oct: challenge statements.
- 3 Nov: Space Apps Connect opens.
- 13 Nov: Submission and Judging guides.
- 14–15 Nov: the event.
- Dec 2026: Nominees, Finalists and Honorable Mentions announced.
- Jan 2027: Global Winners.

---

## 3. Submission requirements

The 2026 Project Submission Guide also comes on **13 Nov**. The quotes below are from the 2025 guide, archived at https://web.archive.org/web/20251005000000/https://www.spaceappschallenge.org/resources/project-submission-guide/. The 2022 PDF says the same: https://spaceapps-prod.s3.amazonaws.com/media/documents/Space_Apps_2022_Project_Submission_Guide.pdf

**Project page fields:**
- Project Name
- High-Level Project Summary
- Link to Project Demo
- Link to Final Project
- Detailed Project Description
- NASA Data
- Space Agency Partner & Other Data
- Use of Artificial Intelligence
- Project Submission Verification

**Demo:**
- *"Format: Video (up to 30 seconds) or slide deck (up to seven slides, including the title slide)."*
- *"Projects that exceed these limits will not be eligible for Global Judging."*
- *"Video demos must include English subtitles; slide decks must be in English."*
- Slides must show the team name, the members' names, and the challenge.
- Host it outside the site. The link must open with *"no logins, permissions, or registrations."*
- *"the majority of judges' evaluation will be based on your project submission… a strong project demo can increase the potential for a high score in the Presentation category."*

**Official 30-second structure** ("30 Seconds of Glory"):
- 0:00 who you are
- 0:02 which challenge and why
- 0:05 title and tagline
- 0:10 how it works: show the prototype, the user's experience, and how NASA and partner data made it possible
- 0:20–0:30 the future

**NASA data:** *"to be eligible for a Global Award, you must use data or resources from NASA."* The 2019 guide adds: *"Projects that fail to describe clearly their tie to NASA… are not eligible to advance in global judging."*

**AI, now called "Super Intelligence".** The 2026 FAQ says: *"In accordance with the September 29, 2026 U.S. Executive Order, 'the executive branch shall use the terms "Super Intelligence" and "SI" in place of "Artificial Intelligence" and "AI."'… Participants may use SI tools… **Each team's project submission must include a description of how SI tools were used during the development of their project.**"*

The 2025 detail, which probably still applies:
- *"generated content may not use, contain, or modify any NASA branding or design elements (such as the NASA logos, flags, or mission identifiers)"*
- *"Images and videos: Must be amended to include a visible watermark indicating they are AI-generated. Audio… Code and data: Must acknowledge AI generation in descriptive text and metadata. Our judges will consider originality, intent, and execution in the context of AI-assisted work."*

**Other rules:**
- Teams have 1 to 6 members. The Universal Event needs at least 2. All members must be confirmed at the **same** Local Event.
- Everything must be in English.
- Deadline: 11:59 p.m. local time on 15 Nov. *"Submission is final."*
- Images on the project page: JPG, PNG or GIF up to 10 MB. Videos and documents cannot be uploaded and must be linked.
- No names, voices or likenesses of anyone under 18.
- No material that promotes commercial products.
- Review for any affiliation with China.
- The repo must be public. Code must be OSI-licensed; Apache-2.0 is the default.

---

## 4. Past Global Winners that were games or educational tools

Sources:
- 2025: https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/
- 2024: https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/
- 2023: https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners
- 2022: https://www.earthdata.nasa.gov/news/nasa-announces-winners-2022-global-space-apps-challenge
- 2021: https://earthdata.nasa.gov/news/nasa-announces-2021-international-space-apps-challenge-global-award-winners
- 2020: https://www.earthdata.nasa.gov/news/2020-space-apps-challenge-winners
- 2019: https://2019.spaceappschallenge.org/awards/

| Year | Award | Team (place) | What they built | Why it worked |
|---|---|---|---|---|
| 2025 | **Best Mission Concept** | PureFlow (Brazil) | A platform to design habitats in 3D and model their systems (power, life support, comms, waste), then test them against solar storms. | Pulls live NASA **DONKI** space-weather data, so designs are tested against real threats: "practical resilience". The team was in its third year. |
| 2025 | Art & Technology | Zumorroda-X (**Egypt**) | "Henry's Farm Adventure", a pixel-art game built on NASA satellite images and data. | Turns real data into game mechanics, with a clear learning goal. |
| 2025 | Best Use of Storytelling | HerCode Space (Universal) | "A Solar Tale", an illustrated children's story about space weather. | Clear audience (children) and emotional pull. |
| 2025 | Galactic Impact | Astro Sweepers | A "credit score" for satellites built on NASA orbital-debris data. | Simple metaphor, real data. |
| 2024 | Most Inspirational | Innovisionaries (UAE) | Eco-Metropolis, a city-building game whose resource decisions use real environmental data. | A game for classrooms, decisions driven by data. |
| 2024 | Best Storytelling | TerraTales (**Cairo**) | Climate stories plus an AI forecast and an eco-choices game. | Local, multi-country framing. |
| 2024 | Best Use of Science | WMPGang (Canada) | An orrery web app using live near-Earth-object data. | Live NASA data shown visually. |
| 2023 | Best Use of Science | LunarTech Ensemble (**Egypt**) | A website and **immersive game** built on Apollo seismic data. | Real archive data made playable. |
| 2023 | Best Storytelling | TeamVoyagers (Bangladesh) | A web game on the water cycle. | Game as explainer. |
| 2023 | Most Inspirational | Space Quest Maidens (Brazil) | "ECLIPSE: Celestial Shadows", an interactive tool teaching children how eclipses work. | Audience is children. |
| 2023 | Best Mission Concept | ASTROGENESIS (Peru) | Interactive planner for trips to planets and moons. | A plausible-looking planning UI. |
| 2022 | Best Mission Concept | Mars 3D Home (Argentina) | A 3D Mars habitat (challenge "mars-habitat"). | 3D design meets a plausible concept. |
| 2021 | Best Storytelling | Space Travelers (Ecuador) | An educational video game for ages 10–14 on the dangers astronauts face on long trips such as to Mars ([primicias.ec](https://www.primicias.ec/noticias/tecnologia/estudiantes-ecuatorianos-ganan-concurso-nasa)). | Narrow age group, game format. Its 30-second video is the first example the 2022 guide gives. |
| 2021 | Best Mission Concept | Mohakash (Bangladesh) | Virtual planetary exploration. | Concept plus visual experience. |

- **2020:** 7 winners, none of them games.
- **2019:** the Best Mission Concept winner was c.a.w.s.t.o.n. I did not find what they built.

**Patterns:**
1. **Real NASA data drives the gameplay.** In every game winner the data is part of the mechanic (DONKI, Apollo seismic data, satellite imagery), not a fact card on the side. This is exactly the Relevance 5 wording.
2. **Validity through "test against reality".** PureFlow ran player designs against real solar storms.
3. **A narrow, named audience** (ages 10–14, children, classrooms) plus an emotional "why" (the Ladakh child in Photonics Odyssey, a story for children).
4. **Egypt has a strong record:** a win in each of 2023, 2024 and 2025. Local and regional framing works (Local Impact, Global Connection).
5. **Best Mission Concept regularly goes to design-in-3D tools:** 2022 Mars 3D Home, 2023 ASTROGENESIS, 2025 PureFlow.
6. **The winners have a public, working link and a tight 30-second demo.**

---

## 5. Recommendations for Every Kilogram

**Positioning:**
- Primary target: **Best Mission Concept**.
- Secondary: Best Use of Data, Most Inspirational, Art & Technology.
- Pitch line: "every kilogram has a cost: mass, dollars, delta-v, watts".
- Set us apart from the Junior Astronaut Trainer by covering the whole mission: design, launch, cruise, operations.

**Data as the core mechanic (Relevance and Validity):**
- **Launch windows and transfer times:** query **JPL Horizons** live, or use cached results.
- **Component specs and TRL:** use the **SST-SOA** report.
- **Mission phases, KDPs and reviews:** follow the **NASA SE Handbook**. Give each phase its gates.
- **Cost growth:** base it on the **NASA Cost Estimating Handbook**.
- **Space weather events during operations:** use real **DONKI** events.
- **Destinations:**
  - Nile: Landsat or MODIS through Worldview or Earthdata.
  - Moon water: Moon Trek and LRO.
  - Mars ice: Mars Trek and MRO.
  - Venus: Magellan and VERITAS.
  - Europa: Europa Clipper.
- **3D models:** NASA 3D Resources.
- **Show where each number comes from:** every value in the game gets a "source" tooltip with a URL and the date it was fetched. Judges see the provenance in seconds.
- **End-of-mission screen:** "Your design vs. the real mission" (mass, power, cost, timeline against Europa Clipper or VERITAS). This shows Validity and teaches at the same time.
- **Partner data for points:** add at least one partner dataset (ESA, JAXA or ISRO). For example, JAXA's Akatsuki fits the Venus mission. I have not verified which datasets exist, so check the 28 Oct resource list first.

**Impact:**
- Name the audience, for example ages 13–18.
- Add a 45-minute classroom mode with a teacher sheet.
- Run in the browser with no install and stay light enough for low-end laptops.
- Ship English plus Arabic. Arabic supports the Local Impact and Global Connection angle and fits the Nile mission.

**Demo video (30 s hard cap, English subtitles):**
- Follow the official beats: team → challenge → title and tagline → real gameplay showing the data drive a decision (for example, a heavier instrument breaks the launcher margin) → a future vision.
- Use only real gameplay footage, no AI-generated video.
- Show no faces of anyone under 18.
- No NASA logo or insignia anywhere.
- Upload to YouTube as unlisted or public, and test the link in a private window.

**Project page:**
- Fill every field in English and make it skimmable: headings, images up to 10 MB, GIFs of gameplay.
- In the **NASA Data** field, list each dataset with its URL and exactly which mechanic it drives.
- In **References**, list every library, asset, font and sound with its license (three.js is MIT). Choose an OSI license for our code, such as Apache-2.0.
- Write a specific **SI disclosure**: which tools were used for which files. Watermark any AI images.

**Logistics:**
- Register every member at the same Egyptian Local Event, not the Universal Event (the FAQ recommends a Local Event).
- Read the 28 Oct statement and change the scope to match its exact wording.
- Re-read the 13 Nov guides for any 2026 rule changes.