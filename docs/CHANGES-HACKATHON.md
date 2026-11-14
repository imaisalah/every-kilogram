# Changes in the hackathon build

What was added to the prototype, what was tested, and what was not done.

## Added
- `js/team/mission-review.js`: segments (launch, space, ground, user), game progress inspired by JPL CML concepts, MDL study-type analogy by difficulty, comparison with the real mission, ConOps timeline, learning check, teacher CSV.
- `js/team/real-data.js`: real solar events (May 2024, July 2012, October 2003) with NASA sources, and an optional live lookup of the strongest flare in NASA DONKI over 30 days. Offline or on any error it uses the saved events.
- `js/team/view-debrief.js`: a short "Mission review" act after the score, a **Mission review** and **Check what you learned** button on the results board, the learning log.
- `js/team/view-flight.js`: the solar-storm problem shows the real event.
- `js/team/ar-review.js`: Arabic for all of the above. `css/team.css`: styles (right-to-left safe).
- `tests/team-review.test.js`: 13 checks (segments for every mission and difficulty, game progress labels, real-mission comparison, ConOps, quiz, CSV, DONKI parsing and failure handling, Arabic for every new key).
- `tools/validate-orbits.mjs`, `docs/VALIDATION.md`, `docs/gmat/`, `docs/CLASSROOM.md`; updates to `README.md`, `docs/submission/project.md` and `checklist.md`.

## Tested
- `node --test "tests/*.test.js"`: 327 tests pass.
- In headless Chromium, in English and Arabic: the debrief runs through to the board with real sim data, the review overlay opens, the quiz grades and writes the log, no console errors.

## Not done, and why
- **GMAT validation status is recorded in `docs/VALIDATION.md`.** It is a focused two-body Earth-orbit period cross-check, not full-mission verification or game integration.
- **The live DONKI lookup was not tested against NASA's server** (no network access to it from where this was built). It is tested with simulated responses and failures. NASA's `DEMO_KEY` is rate limited; register a free key at https://api.nasa.gov if you want it dependable, and pass it in `liveRecentFlare({ apiKey })`.
- **JPL Horizons** (launch windows) is not used. Real launch windows would change the build screens and balance, which is too risky to do untested.
- **A CubeSat mode, WebXR/VR and Worldview imagery** were not built. The Nile and storm missions still use the images already in `assets/discoveries/`.
- **No classroom trial has happened.** The learning log and `docs/CLASSROOM.md` are there so one can.
- **The submission text still has bracket placeholders** (team name, links, who reviewed what) that only the team can fill.
- The unlinked legacy game code and its scripts are still loaded by `index.html`; removing them was left alone as too risky without a full play-through.
