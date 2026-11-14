# Team tasks (next hour)

Pull `main` first. Edit only the files listed under your task; everything else is being changed right now and will be pushed within ~1.5 h.

## Code

### 1. Music
`js/team/music.js` exists (procedural Web Audio soundtrack: `SMD.music.play(phase)`, `stop()`, `auto()`; phases menu / build / flight / surface / results).
- Add `<script src="js/team/music.js"></script>` to `index.html` (after `js/team/ar-lead.js`) and to `join.html`.
- Call `SMD.music.auto()` once after the first user click (browsers block audio before a click).
- Add a volume slider and a mute to Settings (`js/ui-common.js` → `openSettings`; save in `SMD.settings`).
- Listen and tune it; keep it calm.

### 2. Mission Viz
Spec: `docs/TEAM-V3.md`, item 20. Nothing exists yet.
- New files only: `js/team/missionviz.js` (ES module), `js/team/view-missionviz.js`, `css/missionviz.css`, `js/team/ar-missionviz.js`.
- One "Mission Viz" button in `js/team/view-flight.js` and one in `js/team/view-debrief.js`: **add these two only after the next push lands.**
- Data: `SMD.team.sim.fly()` returns frames and events. Planet code to reuse: `js/3d/solarmap.js`. Textures: `SMD.assets`. OrbitControls: `vendor/`.
- Inspiration only, no code copying: https://nasa.github.io/mission-viz/

Rules for both: no copyrighted names or assets; `node --test "tests/*.test.js"` must pass before pushing; test in a browser.

## Non-code

### 3. GitHub Pages (repo owner, 5 min)
Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
Link: `https://imaisalah.github.io/every-kilogram/`. Post it in the group when it is live.

### 4. Two-home multiplayer test (2 people, 15 min, after Pages is live)
Play with friends → Everyone on their own device. One creates the room; the other opens the invite link from a different home or on mobile data. Write down exactly what fails and at which step, with screenshots.

### 5. Submission form (1 person, 30 min)
All fields are written in `docs/submission/project.md`. Fill in: local event, team members, playable link, video link. Re-check the Resources tab and the exact name of the AI-disclosure field in the 2026 form.

### 6. Video (1 person, 30 min)
Record `#demo-30` from the hosted link with OBS after one warm-up run. Follow `docs/submission/demo-video.md`. Upload to YouTube (unlisted) with `demo-30.srt` as captions.

### 7. Playtest on real hardware (anyone)
A school-type laptop and a phone: one solo round each, in English and in Arabic. Note anything confusing, slow or broken.

### 8. Guide names
The three new helpers are originals (TARS and Rocky are copyrighted). Choose a name and a one-line personality for each.
