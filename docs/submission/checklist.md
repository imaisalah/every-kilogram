# Submission checklist

Work through this list before the deadline (11:59 p.m. local time, 15 Nov 2026; once you submit, it is final). Background: `docs/research/winners-and-judging.md`.

## 1. Team and form

- [ ] Every member is registered at the **same** Local Event (1-6 members).
- [ ] Read the 2026 Project Submission and Judging guides. Check the name of the AI field ("Use of Super Intelligence" or "Use of Artificial Intelligence") and paste the section from `project.md` into it.
- [ ] Fill in every `[bracket]` in `project.md`, `pitch.md` and `demo-30.srt` (team name, event, links, who reviewed what).
- [ ] Copy each section of `project.md` into the matching field: Project Name, High-Level Project Summary, Link to Project Demo, Link to Final Project, Detailed Project Description, NASA Data, Space Agency Partner & Other Data, and the SI/AI field.
- [ ] Check "Confirm All Work is Original" only after every external resource (code, text, images, models, fonts) is listed under NASA Data or Space Agency Partner & Other Data. `project.md` lists them; `docs/CREDITS.md` has every file.

## 2. Challenge resources

- [ ] Open the challenge's **Resources** tab and re-read the official challenge statement. Match the wording of the summary to it.
- [ ] For each NASA or partner dataset listed there: if the game uses it, add it to the NASA Data or partner table in `project.md`, with the URL and the mechanic it drives. Do not list a dataset the game does not use.

## 3. Public repository

- [ ] Create a public repository (GitHub or similar) with the whole game folder, including `LICENSE` (Apache-2.0), `README.md` and `docs/CREDITS.md`.
- [ ] Leave out anything private: `tools/node_modules/`, local test output, screenshots you do not want public.
- [ ] Put the repository URL in "Link to Final Project".

## 4. Hosting link

- [ ] Host the game as a static site (GitHub Pages, Netlify or Vercel). No build step is needed: publish the folder as it is.
- [ ] Open the link in a private window with no login. Check: the title screen, a Solo round on Mars through the results, *Play with friends › Everyone on their own device* from two devices on different networks, and Arabic.
- [ ] On a static host there is no phone relay: check that *Same room with phones* falls back to WebRTC and that phones can join.
- [ ] Put the playable URL in "Link to Final Project" and in the demo's `link=` parameter.

## 5. The 30-second video (OBS, from `#demo-30`)

- [ ] Follow `demo-video.md`: start the game, open `/?team=...&link=...#demo-30` (add `members=` only if no member is under 18), play it once to warm the cache, reload, start OBS at 1920×1080, press a key, stop after the closing card.
- [ ] Trim to exactly 30.0 s or less, starting on the "Who we are" card. The burned-in subtitles stay.
- [ ] Watch it on a phone: subtitles readable, no stutter in the capsule, flight or surface shots. If a 3D shot stalls, record again on a faster computer.
- [ ] Upload to YouTube as Public or Unlisted, add `demo-30.srt` as English captions, check it plays in a private window, and paste the link into "Link to Project Demo".
- [ ] Optional: a deck of up to 7 English slides instead (`pitch.md`), with the team name, members and challenge.
- [ ] Project page images: stills from `#demo` (JPG, PNG or GIF, 10 MB or smaller each).

## 6. Rules on content

- [ ] No NASA logos, insignia or mission identifiers anywhere: game, video, slides or page images.
- [ ] No names, voices or likenesses of anyone under 18.
- [ ] No promotion of commercial products.
- [ ] No SI-generated images or video. If any are added, they need a visible watermark.

## 7. Final check of the game

- [ ] `node --test "tests/*.test.js"` passes.
- [ ] `#demo-30` and `#demo` play to the end with no console errors in the browser you will record with.
- [ ] Load the hosted game on a school-type laptop and on a phone.

## 8. Added in the hackathon build

- [ ] Play one round to the end in English and in Arabic: the **Mission review** appears after the score, the quiz answers, and **Download learning log (CSV)** saves a file.
- [ ] Fly a mission until the "Solar storm!" problem appears and read the real-event line. Confirm the two NASA links in `docs/submission/project.md` still open.
- [ ] `node tools/validate-orbits.mjs` exits 0. If you run `docs/gmat/orbit_check.script`, add the GMAT numbers to `docs/VALIDATION.md` before claiming a GMAT check.
- [ ] The live flare line needs internet and NASA's public demo key, which is rate limited. If it does not show, the game is working as designed: it falls back to the saved events.
- [ ] Look at each NASA 3D model in the game once (Landsat 8, Juno, Magellan, MRO, LRO, Europa Clipper, DSN, SSL-1300, Saturn V) for any NASA logo or mission identifier on the mesh itself. The embedded textures of the textured models showed none at thumbnail size, but models with no textures were not inspected.
