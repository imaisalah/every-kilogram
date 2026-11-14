# Pitch: a 7-slide deck and a 60-second talk

The demo can be a slide deck instead of the video: **at most seven slides, title slide included, in English**. The slides must show the team name, the members' names and the challenge. Host the deck outside the Space Apps site (Google Slides or a PDF link) so it opens with no login. Submit the 30-second video if you can; the deck is the alternative.

Screenshots: record `#demo` (see `demo-video.md`) and take stills from it, or use `tools/shot.mjs` at 1920×1080. Every image below is real gameplay. Add no NASA logos.

---

## Slide 1: Title

- **Every Kilogram**
- *Design a spacecraft, fly it, and bring back the science. Every kilogram counts.*
- NASA Space Apps Challenge 2026 · Space Mission Design Game
- Team `[name]` · `[members]` (leave out the names of members under 18) · `[local event]`
- Image: the title screen, or KILO beside the Mars ice mapper briefing card.

## Slide 2: The problem

- Headline: **A space mission is a chain of trade-offs, and students rarely get to make them.**
- A heavier camera needs more fuel, a bigger rocket and more money. A smaller dish leaves science on the recorder. In a classroom these links stay abstract.
- The challenge asks for a game where players define an objective, design the spacecraft, pick instruments, rocket and orbit, manage six budgets, simulate, evaluate and fly again, alone or as a team of up to four.

## Slide 3: Build it one part at a time

- Image: the Power step, three cards with ✓/✗ lines, the 3D spacecraft and the resource bar beside them.
- Ten parts, one per step, at most three choices each: orbit, power, batteries, instruments, antenna and radio, recorder, computer, mission length, landing kit, and the rocket last, once the mass is known.
- Every pick changes the ship you see and its mass, power, budget, data, comms and time.
- Real numbers: the rocket equation, sunlight falling with distance squared, the DSN link equation, instruments sized like MRO's, LRO's, Magellan's and Europa Clipper's.

## Slide 4: A crew of four, and KILO

- Images: the crew picker; the capsule conversation.
- Four astronauts, four jobs: planner, engineer, scientist, communications. Each job owns part of the build; the others suggest with one tap.
- In flight the alarm lands on one screen and the fix on another, so the crew has to talk.
- KILO, an original deadpan robot guide, explains each step in one or two lines.
- Solo with bot crewmates, everyone on their own device over WebRTC, phones in the same room, or one screen.

## Slide 5: Fly it, land, bring it home

- Images: the flight with its three graphs; the crew scanning on Mars; "Too heavy to lift off".
- The mission is simulated: sunlight and shadow, battery, recorder, radio passes, problems to fix in seconds.
- On the Moon, Mars, Venus and Europa the crew lands, scans sites with the instruments they packed and sends data home when the orbiter passes.
- The fuel you brought decides what lifts off. Too heavy? Throw science overboard.

## Slide 6: See why, fly again

- Image: the falling dominoes ("Why it happened") and the results board.
- Each domino is one link from a decision to its result, computed by re-flying the mission with that decision reverted.
- A score out of 1000, KILO's verdict, the one change that helps most, and "Fly again with this change", with your last flight as a ghost on the graphs.
- If it dies, a tombstone names the real NASA mission that died the same way. Challenge links let another team try to beat your score.

## Slide 7: Impact and what's next

- Free, in the browser, no account, runs on a school laptop, English and Arabic. Six missions, including two about Egypt's own Nile and dust storms.
- Next: classroom trials with teachers, more destinations, live data where it adds the most.
- Link: `[playable URL]` · Code: `[repository URL]` (Apache-2.0)
- Credit line: "Imagery courtesy of NASA, NASA/JPL-Caltech and USGS. Use does not imply NASA endorsement."

---

## The 60-second spoken pitch

About 150 words at a calm pace. The words in *italics* are cues for what to show.

> *[Title screen]* We're `[team]`, and this is **Every Kilogram**.
>
> A space mission is a chain of trade-offs. A heavier camera needs more fuel, a bigger rocket, more money. Students hear that. In our game they live it.
>
> *[Crew and destination]* You pick an astronaut, a world and a real science question. *[Build]* Then you build the spacecraft one part at a time, and every part moves your mass, power, budget, data and time, using real NASA numbers.
>
> *[Flight]* The mission is simulated. Batteries drain in shadow, data waits for a radio pass, and problems need fixing fast, often by a teammate.
>
> *[Mars surface]* On Mars, your crew scans the sites, then decides which samples the fuel can lift home.
>
> *[Dominoes]* Finally, falling dominoes show why it worked, and you fly again with one change.
>
> Free, in English and Arabic, for one to four players. Every kilogram counts.
