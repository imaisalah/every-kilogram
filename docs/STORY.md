# Story mode: "Last Light" (shared spec)

A Telltale-style story campaign with survival segments, separate from the career. The player is the commander (their own astronaut avatar) of a crewed lunar flyby that goes wrong, inspired by real events: the Challenger cold-launch decision (1986), Apollo 13 (1970), the August 1972 solar storm between Apollo 16 and 17, Artemis I heat-shield char loss (2022). Every episode ends with real-history cards ("what NASA really did"). Audience 13-18: tense and emotional, never gory. Nobody dies on screen; a loss is told through silence, an empty seat, a radio call.

It must still serve the challenge: managing limited resources (oxygen, power, water, CO2, time, trust), engineering decisions, and evaluating how each choice shaped the outcome (the recap screen).

## Cast (ids are fixed)

Crew (in the capsule):
- `you`: the commander, the player's avatar from `SMD.avatar.get()` (name, look).
- `yusuf`: Yusuf Adel, pilot, Egyptian, ex-air force, jokes under stress, proud.
- `lena`: Lena Hoffmann, mission specialist, ESA (German), physician, calm, blunt.
- `grace`: Grace Okafor, flight engineer, Nigerian, systems genius, quiet, carries guilt easily.

Ground (mission control, the HQ staff from `content/staff.js`):
- `nadia` flight director, `kwame` chief engineer, `mariam` mission scientist, `tarek` budget officer, `omar` student intern, `aiko` public outreach.

Relationships: `trust[id]` from -3 to +3, start 0. "{Name} will remember that." appears when a choice sets `remember`.

## Episodes (about 10-15 min each)

1. **Cold Morning** (ground, then launch). Night before launch, record cold at the pad. Kwame finds the hatch-seal / booster joint data worrying in the cold (Challenger). Tarek: a delay costs money and the Congress hearing. Aiko: two million students watching live. Nadia asks for your Go. A small design choice before flight (extra oxygen tank vs the high-res camera vs spare CO2 cartridges) sets starting resources. Your choices set `flags.launchedCold`, `flags.extraO2`, etc. Cliffhanger: day 3, a bang, the master alarm.
2. **Lifeboat** (aboard). Service-module oxygen tank ruptures (Apollo 13). Power and oxygen bleed away. Survival segments `ep2.power` (power down to stretch battery amp-hours) and `ep2.co2` (build the square-cartridge-in-round-hole adapter by hand, real Apollo 13 story). Hard calls: tell the crew the real numbers or not; Grace blames herself; who sleeps. Cliffhanger: loss of signal behind the Moon.
3. **Far Side**. Alone behind the Moon. A solar particle storm warning (August 1972). Survival `ep3.storm`: build a shelter from water bags and stowage in minutes; not enough room for perfect protection, someone takes more dose (a choice). Yusuf and Lena clash. Decision: the manual burn now or wait for Earth's guidance (`flags.burnEarly`). Cliffhanger: the heat shield camera shows damage.
4. **Home**. Survival `ep4.burn` (manual course correction lining the Earth's terminator in the window, the real Apollo 13 trick) and `ep4.entry` (pick and hold the entry corridor with a damaged shield; blackout runs long). Endings from resources, trust and flags: everyone home / home but someone badly hurt / a hard loss. Epilogue: a recap of your choices beside what the real teams did, and how each one shaped the ending.

## Script format (content/story/ep1.js ... ep4.js)

```js
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.story = SMD.story || {};
  SMD.story.episodes = SMD.story.episodes || [];
  SMD.story.episodes.push({
    id: 'ep1', n: 1, title: 'Cold Morning', subtitle: '...', start: 'pad_night',
    resources: { o2: 100, power: 100, water: 100, co2: 0, food: 100 }, // only in ep1 (later episodes inherit)
    scenes: {
      pad_night: {
        set: 'pad',            // pad | control | briefing | capsule | space | black
        cast: ['you', 'kwame'],// who stands in the scene
        beats: [
          { narrate: 'The coldest morning ever recorded at the pad: -4 °C.', id: 'ep1.pad.n1' },
          { say: 'kwame', mood: 'worried', line: 'The seals were never tested this cold.', id: 'ep1.pad.k1' },
          { choice: {
              id: 'ep1.pad.c1', timer: 8, timeout: 'quiet',
              options: [
                { id: 'ask', text: 'How sure are you?', trust: { kwame: 1 } },
                { id: 'push', text: 'We fly tomorrow. Make it work.', trust: { kwame: -1 }, remember: 'kwame', set: { pushedKwame: true } },
                { id: 'quiet', text: '[Say nothing]' },
              ] } },
          { if: 'flags.pushedKwame', then: [ { say: 'kwame', line: '...', id: 'ep1.pad.k2' } ], else: [ ] },
          { survival: 'ep2.co2', win: 'scrubber_ok', lose: 'scrubber_bad' },
          { fact: { id: 'ep1.fact.challenger', title: 'Challenger, 28 Jan 1986', text: '...', source: 'https://...' } },
          { goto: 'briefing' },
        ],
      },
    },
  });
})();
```

Beats (an array, run in order):
- `{ narrate, id }` caption text. `{ say: castId, line, mood?, id }` dialogue (mood: calm | worried | angry | sad | happy | scared | determined).
- `{ choice: { id, timer?, timeout?, options: [{ id, text, set?, trust?, res?, remember?, goto?, beats? }] } }`. `timer` seconds shows the Telltale bar; `timeout` is the option id taken when it runs out (often a "[Say nothing]" option). `beats` run inline after the pick; `goto` jumps to a scene. `res` changes resources (e.g. `{ o2: -5 }`).
- `{ if: expr, then: [...], else: [...] }`. Expressions: `flags.x`, `!flags.x`, `trust.nadia >= 2`, `res.o2 < 30`, `choice['ep1.pad.c1'] == 'push'`, joined with `&&` / `||`.
- `{ set: { flag: value } }`, `{ trust: { id: delta } }`, `{ res: { key: delta } }`.
- `{ survival: segmentId, win: sceneId, lose: sceneId }` runs a survival segment (below).
- `{ fact: { id, title, text, source } }` a real-history card.
- `{ camera: 'wide' | 'close:castId' | 'two:a,b' | 'window' }`, `{ anim: 'castId:wave|celebrate|sad|cheer|look' }`, `{ sfx: 'alarm|bang|radio|silence' }`, `{ wait: seconds }`.
- `{ goto: sceneId }`, `{ end: endingId }` (episode end; `endingId` picks the epilogue text), `{ next: 'ep2' }` to chain.

Text: every narrate/say/option/fact has a unique `id`; the engine shows `SMD.t('story.' + id, englishText)` (option text: `story.<choiceId>.<optionId>`; fact: `story.<id>.title` / `.text`). Arabic goes in `js/i18n/ar-story.js` under the same keys. `{you}` in text is replaced with the player's astronaut name.

## Story state (saved under `ek-story` with `SMD.store`)

`{ episode, scene, beat, flags:{}, trust:{yusuf,lena,grace,nadia,kwame,mariam,tarek,omar,aiko}, res:{o2,power,water,co2,food}, health:{you,yusuf,lena,grace} (0-100, dose/injury), choices:{choiceId: optionId}, log:[{id,text}] , done:[episodeIds] }`.

## Survival API (owned by the survival engineer)

`SMD.storySurvival.run(host, segmentId, state) -> Promise<{ result: 'win'|'lose', state }>`: mounts inside `host` (a DOM element the story screen gives it), plays the hands-on segment with the player's astronaut, mutates `state.res`, `state.health`, `state.flags`, then resolves. Must support `SMD.storySurvival.quick(segmentId, state, 'good'|'bad')` for tests and a visible "skip (auto)" for accessibility.

Segment ids and what they decide (writers use exactly these):
- `ep2.power`: power-down. Switch systems off to stretch battery amp-hours to reach home; keeping heaters/comms/scrubber fans on matters later. Sets `flags.heatersOff`, `res.power`.
- `ep2.co2`: build the CO2 adapter from what is aboard (cartridge, hose, bag, tape, flight-plan cover). Win: CO2 drops. Lose: CO2 headaches, crew health falls. Sets `flags.adapterBuilt`.
- `ep3.storm`: build a radiation shelter with water bags and stowage against the clock; place crew. Sets `health.*` dose and `flags.shelterGood`.
- `ep4.burn`: manual burn: hold the Earth's terminator on the window mark while firing for the right seconds. Sets `flags.corridorOk`.
- `ep4.entry`: hold the entry angle in the corridor (5.5-7.5 degrees) with a damaged shield; blackout. Sets `flags.landed`, `health.*`.

## 3D sets

- `capsule` interior: `js/3d/capsule.js` exports `createCapsuleInterior(opts) -> { group, seats: { you, yusuf, lena, grace } (Object3D anchors), window, panels, update(dt), setAlarm(on), setPower(0..1), setFrost(0..1), dispose() }` (survival engineer).
- `pad`, `control`, `briefing`, `space`, `black`: `js/3d/storystage.js` (story engineer), which also uses `createCapsuleInterior` for `capsule`. Characters: `createAstronaut` (js/3d/astronaut.js) for the crew; `createStaff` / npc look (js/3d/npc.js) for ground staff.

## Update: Detroit-style structure (binding, replaces the dialogue-heavy pacing)

The user wants it like *Detroit: Become Human*: you **move your character freely and do things**, and **choices only come at key moments**, and every chapter ends with a **flowchart** of what you did and what you could have done. Not too many choices.

- **Most of each scene is exploration**, not dialogue. The player walks (shared controller, docs/CONTROLS.md) around the set, inspects things, talks to people when they choose to, and finds clues. Dialogue is short and happens when the player walks up to someone (or at scripted moments).
- **Few, heavy choices:** 4-6 key choices per episode (timed at tense moments). Each one visibly branches the story.
- **Clues unlock options:** what you find while exploring changes which options you get later. Options can `requires` a flag; a locked option is shown greyed with a lock and a hint ("You didn't check the seal data") like Detroit.
- **Flowchart:** at the end of every episode (and from the pause menu) the engine draws the chapter's flowchart: scenes as nodes, the path taken lit, other branches shown as locked "?" nodes, key choices as diamond nodes with the option taken, clues found / missed. Completion % per chapter. Replay a chapter from any node you've reached.

New beat types (the engine supports them; writers use them):

```js
{ explore: {
    id: 'ep1.pad.explore',
    objective: 'Walk the pad and look at the cold-weather data before the meeting.', // shown top-left
    spawn: 'start',                  // anchor where the player appears
    items: [                         // interactables (controller prompt "E <label>")
      { id: 'icicles', at: 'tower', label: 'Look at the ice', beats: [ /* short beats: narrate/say/set/fact */ ], set: { sawIce: true } },
      { id: 'kwame', at: 'kwame', label: 'Talk to Kwame', beats: [ ... ] , once: true },
      { id: 'sealdata', at: 'console', label: 'Read the seal data', beats: [ ... ], set: { readSealData: true }, clue: true },
      { id: 'leave', at: 'door', label: 'Go to the meeting', exit: true },   // exit item: ends the explore when allowed
    ],
    exitWhen: 'true',               // expression; the exit item stays locked until it is true (e.g. 'flags.readSealData || flags.sawIce')
    hint: 'The control console has the overnight data.', // shown after 60 s of wandering
  } }
```

- Item fields: `id`, `at` (anchor), `label` (prompt verb), `beats`, `set`, `clue: true` (counts on the flowchart's clue list), `once`, `requires` (expression, item hidden until true), `exit: true`.
- Text ids for items: `story.<exploreId>.<itemId>.label`, objective `story.<exploreId>.objective`, hint `story.<exploreId>.hint`.
- Choice option extras: `requires: 'flags.readSealData'` and `lockedHint: 'You never read the seal data.'` (id `story.<choiceId>.<optionId>.locked`); `key: true` on a choice marks it as a flowchart diamond (every timed/heavy choice should be key).
- Scene field `title` (short, for the flowchart node): `story.<episode>.<sceneId>.title`.

**Anchors per set** (the 3D sets must provide exactly these named anchors; writers use only these):
- `pad`: start, tower, arm (crew access arm), valve, umbilical, console (pad-side weather/data console), kwame, nadia, door (to the meeting), van.
- `control`: start, console (your console), bigscreen, kwame, nadia, tarek, mariam, omar, aiko, coffee, window, door.
- `briefing`: start, table, screen, model (spacecraft model on the table), kwame, nadia, tarek, aiko, door.
- `capsule`: start, seat_you, seat_yusuf, seat_lena, seat_grace, window, panel_left, panel_center, panel_right, locker_1 .. locker_6, hatch, medkit, toilet, camera.
- `space` / `black`: start only (no exploration).
