// Episode 2 script: "Lifeboat" (see docs/STORY.md and docs/STORY-BIBLE.md).
// Survival segments: ep2.power (power-down) and ep2.co2 (the adapter).
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.story = SMD.story || {};
  SMD.story.episodes = SMD.story.episodes || [];

  const n = (id, narrate) => ({ narrate, id });
  const s = (say, id, line, mood) => (mood ? { say, mood, line, id } : { say, line, id });
  const CREW = ['you', 'yusuf', 'lena', 'grace'];

  SMD.story.episodes.push({
    id: 'ep2',
    n: 2,
    title: 'Lifeboat',
    subtitle: 'A ship built for two people for two days. You are four, and home is four days away.',
    start: 'bang',
    endings: {
      cliff: { id: 'ep2.end.cliff', title: 'Loss of signal', text: 'Lantern slides behind the Moon. The radio goes silent, and Mariam’s last words were about the Sun. To be continued in Episode 3: Far Side.' },
    },
    scenes: {
      // ---------- Seconds after the bang ----------
      bang: {
        title: 'Fifteen seconds',
        set: 'capsule',
        cast: CREW,
        beats: [
          { sfx: 'alarm' },
          { camera: 'wide' },
          n('ep2.bang.n1', 'Fifteen seconds after the bang. Every light on the panel is amber or red.'),
          {
            if: 'flags.hatchFirst',
            then: [
              s('yusuf', 'ep2.bang.y1', 'The hatch won’t seat! Wait. Ibis is fine. The bang came from behind us!', 'scared'),
              n('ep2.bang.n2', 'A minute lost wrestling with the hatch. Out the window, the cloud keeps growing.'),
              { res: { o2: -3 } },
            ],
            else: [],
          },
          { if: 'flags.calmFirst', then: [n('ep2.bang.n3', 'Your voice is steady. Hands come off switches. Nobody makes it worse by guessing.')], else: [] },
          { res: { o2: -35, power: -40 } },
          s('grace', 'ep2.bang.g1', 'Tank two is gone. Tank one is falling. Fuel cells one and three are dying. We are venting oxygen into space.', 'scared'),
          { sfx: 'radio' },
          s('nadia', 'ep2.bang.na1', 'Lantern, Control. Close the reactant valves on fuel cells one and three. Close them now.', 'determined'),
          s('grace', 'ep2.bang.g2', 'If we close them, they never open again. No main power for the rest of the flight. If this is only a bad sensor, we kill a healthy ship.', 'worried'),
          {
            choice: {
              id: 'ep2.bang.c1',
              key: true,
              timer: 10,
              timeout: 'wait',
              options: [
                {
                  id: 'sure',
                  text: 'It’s tank two. I know it is. Close them, now.',
                  requires: 'flags.tankFlagged || flags.readTankLog || flags.sawPressureJump',
                  lockedHint: 'You had no reason to suspect tank two.',
                  set: { valvesClosed: true, knewTank: true },
                  res: { o2: 3 },
                  trust: { nadia: 1, grace: 1 },
                  beats: [s('grace', 'ep2.bang.g3', 'Closed. You saw it coming. So did I.', 'determined')],
                },
                {
                  id: 'close',
                  text: 'Close them. Save what oxygen we have.',
                  set: { valvesClosed: true },
                  trust: { nadia: 1 },
                  beats: [s('grace', 'ep2.bang.g4', 'Closed. There goes our main power. For good.', 'sad')],
                },
                {
                  id: 'wait',
                  text: 'Wait. Give me one minute to think.',
                  set: { valvesLate: true, valvesClosed: true },
                  res: { o2: -8 },
                  trust: { nadia: -1 },
                  beats: [
                    s('nadia', 'ep2.bang.na2', '{you}, every second you think is oxygen we don’t get back.', 'angry'),
                    n('ep2.bang.n4', 'The gauge keeps falling while you think. In the end you close them anyway.'),
                  ],
                },
              ],
            },
          },
          { camera: 'close:grace' },
          { anim: 'grace:sad' },
          n('ep2.bang.n5', 'Grace stops moving. Her hands hang in the air above the panel.'),
          {
            if: "choice['ep1.stir.c1'] == 'grace'",
            then: [s('grace', 'ep2.bang.g5', 'I flipped the switch. It was my tank, and I flipped the switch.', 'scared')],
            else: [
              {
                if: 'flags.stirHeld',
                then: [s('grace', 'ep2.bang.g6', 'Nobody touched it. It just went. My tank just went.', 'scared')],
                else: [s('grace', 'ep2.bang.g7', 'It’s tank two. It’s my tank. I signed it off.', 'scared')],
              },
            ],
          },
          {
            choice: {
              id: 'ep2.bang.c2',
              key: true,
              timer: 8,
              timeout: 'need',
              options: [
                {
                  id: 'need',
                  text: 'Grace. I need you here. Right now.',
                  set: { graceSteady: true },
                  trust: { grace: 1 },
                  beats: [s('grace', 'ep2.bang.g8', 'Yes. Okay. Tank one: 300 psi and falling. I’m here.', 'determined')],
                },
                {
                  id: 'comfort',
                  text: 'This is not your fault.',
                  res: { o2: -2 },
                  trust: { grace: 1 },
                  beats: [s('grace', 'ep2.bang.g9', 'You don’t know that. Nobody knows that yet. But... thank you.', 'sad')],
                },
                {
                  id: 'bench',
                  text: 'Yusuf, take her station.',
                  set: { graceBenched: true },
                  trust: { grace: -2 },
                  remember: 'grace',
                  beats: [
                    s('yusuf', 'ep2.bang.y2', 'Got it. Grace, I’ve got it. Move over.', 'determined'),
                    n('ep2.bang.n6', 'Grace floats back from her own panel and watches somebody else read her numbers.'),
                  ],
                },
              ],
            },
          },
          { goto: 'lifeboat' },
        ],
      },

      // ---------- Into Ibis ----------
      lifeboat: {
        title: 'Abandon Lantern',
        set: 'capsule',
        cast: CREW,
        beats: [
          { sfx: 'radio' },
          s('nadia', 'ep2.life.na1', 'Lantern, Control. Lantern is dying. Get into Ibis and power it up before Lantern’s batteries go. You have about fifteen minutes.', 'determined'),
          n('ep2.life.n1', 'Ibis was built to keep two people alive for two days near the Moon. You are four, and home is four days away.'),
          {
            explore: {
              id: 'ep2.life.explore',
              objective: 'Lantern is dying. Take what you need and get the crew into Ibis.',
              spawn: 'start',
              hint: 'The hatch to Ibis is open. Lantern’s lockers will be cold and dark soon.',
              exitWhen: 'true',
              items: [
                {
                  id: 'tank',
                  at: 'locker_2',
                  label: 'Check the cabin oxygen tank',
                  requires: 'flags.extraO2',
                  once: true,
                  beats: [s('grace', 'ep2.life.g1', 'The extra tank Kwame wanted, inside our cabin, is untouched. Ten hours of breathing nobody has to invent.', 'determined')],
                },
                {
                  id: 'medkit',
                  at: 'medkit',
                  label: 'Take Lantern’s medical kit',
                  once: true,
                  clue: true,
                  set: { tookMedkit: true },
                  beats: [s('lena', 'ep2.life.l1', 'Good. Ibis has a first-aid box. This is a hospital.', 'calm')],
                },
                {
                  id: 'cartridges',
                  at: 'locker_4',
                  label: 'Take Lantern’s CO2 cartridges',
                  once: true,
                  clue: true,
                  set: { tookCartridges: true },
                  beats: [n('ep2.life.n2', 'Square cartridges, the size of a shoebox. Ibis uses round ones. You take them anyway.')],
                },
                {
                  id: 'gauges',
                  at: 'panel_left',
                  label: 'Read the power gauges',
                  once: true,
                  beats: [n('ep2.life.n3', 'Lantern’s entry batteries: the only power that can bring you through the atmosphere. Every switch left on now steals from the last hour of the trip.')],
                },
                {
                  id: 'lena',
                  at: 'seat_lena',
                  label: 'Talk to Lena',
                  once: true,
                  beats: [s('lena', 'ep2.life.l2', 'We stop wasting anything. Light, heat, words. Tell us what to switch off.', 'calm')],
                },
                { id: 'go', at: 'hatch', label: 'Float into Ibis', exit: true },
              ],
            },
          },
          n('ep2.life.n4', 'Every switch you leave on eats battery you will need in four days, when you power Lantern back up to come home.'),
          { survival: 'ep2.power', win: 'power_ok', lose: 'power_bad' },
        ],
      },

      power_ok: {
        title: 'Lights out',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep2.pok.n1', 'The panels go dark one by one. The fans stop. For the first time since the bang, it is quiet.'),
          s('nadia', 'ep2.pok.na1', 'Lantern, Control. We copy your power numbers. Clean work. You just bought yourselves a way home.', 'calm'),
          { if: 'flags.heatersOff', then: [s('lena', 'ep2.pok.l1', 'The heaters too. It will get very cold in here. Cold we can survive.', 'calm')], else: [] },
          { goto: 'numbers' },
        ],
      },

      power_bad: {
        title: 'Too slow',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep2.pbad.n1', 'Too slow. Lantern’s batteries took a deeper hit than anyone wanted before the last switch went off.'),
          s('nadia', 'ep2.pbad.na1', 'Lantern, we see it. Not what we hoped. We’ll find the amps somewhere. We always do.', 'worried'),
          s('yusuf', 'ep2.pbad.y1', 'Somewhere. My favourite plan.', 'worried'),
          { set: { powerShort: true } },
          { goto: 'numbers' },
        ],
      },

      // ---------- The real numbers ----------
      numbers: {
        title: 'The real numbers',
        set: 'capsule',
        cast: CREW,
        beats: [
          { sfx: 'radio' },
          s('kwame', 'ep2.num.k1', 'Commander, private loop. Just you.', 'calm'),
          { if: 'flags.launchedCold', then: [s('kwame', 'ep2.num.k2', 'First I have to ask. Was it the cold? Did the cold launch do this? I can’t sleep until I know.', 'worried')], else: [] },
          s('kwame', 'ep2.num.k3', 'Oxygen is fine, just. Water runs out about five hours before entry. And Ibis has CO2 cartridges for two people for thirty hours. You are four.', 'worried'),
          { if: 'flags.spareCartridges', then: [s('kwame', 'ep2.num.k4', 'Lena’s spares fit Ibis. They buy you most of a day before you need anything clever.', 'calm')], else: [] },
          n('ep2.num.n1', 'Behind you, three people are pretending not to listen.'),
          {
            choice: {
              id: 'ep2.num.c1',
              key: true,
              timer: 15,
              timeout: 'later',
              options: [
                {
                  id: 'all',
                  text: 'Tell them everything. The real numbers.',
                  set: { toldTruth: true },
                  trust: { yusuf: -1 },
                  beats: [
                    {
                      if: 'flags.lenaPact',
                      then: [{ trust: { lena: 2 } }, s('lena', 'ep2.num.l1', 'You kept your promise. Thank you. Now we can actually plan.', 'calm')],
                      else: [{ trust: { lena: 1 } }, s('lena', 'ep2.num.l2', 'Good. Fear is easier to manage than surprises.', 'calm')],
                    },
                    s('yusuf', 'ep2.num.y1', 'Five hours short. So we drive faster. You could have let us sleep first, boss.', 'worried'),
                  ],
                },
                {
                  id: 'soft',
                  text: 'Tell them it’s tight, but we’ll make it.',
                  set: { softened: true },
                  trust: { yusuf: 1 },
                  beats: [
                    s('yusuf', 'ep2.num.y2', 'Tight. I can do tight. I flew jets for twelve years.', 'happy'),
                    {
                      if: 'flags.lenaPact',
                      then: [{ trust: { lena: -2 } }, s('lena', 'ep2.num.l3', 'I can read a gauge, {you}. You promised me the real numbers.', 'angry'), { set: { brokePact: true } }],
                      else: [{ trust: { lena: -1 } }, s('lena', 'ep2.num.l4', 'Tight. That is a word, not a number.', 'calm')],
                    },
                  ],
                },
                {
                  id: 'later',
                  text: 'Not yet. Not until we have a plan.',
                  set: { hidNumbers: true },
                  trust: { lena: -1 },
                  beats: [
                    n('ep2.num.n2', 'You say nothing. Grace watches the gauges, and you can see her doing the maths on her own.'),
                    { if: 'flags.lenaPact', then: [{ trust: { lena: -1 } }, { set: { brokePact: true } }], else: [] },
                  ],
                },
              ],
            },
          },
          {
            fact: {
              id: 'ep2.fact.lifeboat',
              title: 'Aquarius, the lifeboat',
              text: 'After the explosion, Apollo 13’s crew lived in the lunar module Aquarius. It was designed to keep two astronauts alive for about 45 hours; it kept three alive for about 90. The command module was shut down to save its batteries for the last hours before re-entry.',
              source: 'https://www.nasa.gov/history/afj/ap13fj/09day3-lifeboat.html',
            },
          },
          { goto: 'families' },
        ],
      },

      // ---------- The long first day: families, Salma, headaches ----------
      families: {
        title: 'The long first day',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep2.fam.n1', 'Hours pass. Ibis hums quietly. Earth is still listening.'),
          {
            explore: {
              id: 'ep2.fam.explore',
              objective: 'Check on your crew before the long night.',
              spawn: 'start',
              hint: 'Everyone is at their seat. Aiko is waiting on the radio.',
              exitWhen: 'true',
              items: [
                {
                  id: 'aiko',
                  at: 'panel_center',
                  label: 'Answer Aiko',
                  once: true,
                  beats: [
                    s('aiko', 'ep2.fam.a1', 'The families are here in the building. Every channel on Earth is live. I’m telling the families everything, and the press what we know for sure.', 'worried'),
                    {
                      if: 'flags.publicHonest || flags.dataWon',
                      then: [s('aiko', 'ep2.fam.a2', 'People believe us, because we told them the truth before. That matters now.', 'calm')],
                      else: [s('aiko', 'ep2.fam.a3', 'Some reporters are asking what else we haven’t told them. That’s the price of “it was the weather”.', 'worried')],
                    },
                  ],
                },
                {
                  id: 'yusuf',
                  at: 'seat_yusuf',
                  label: 'Talk to Yusuf',
                  once: true,
                  set: { yusufAsked: true },
                  beats: [s('yusuf', 'ep2.fam.y1', 'Boss. Salma is in that building. She’ll have seen the news. Could I talk to her? A minute. I know it costs power.', 'worried')],
                },
                {
                  id: 'call',
                  at: 'camera',
                  label: 'Open a one-minute video link for Yusuf',
                  requires: 'flags.yusufAsked',
                  once: true,
                  set: { salmaCall: true },
                  beats: [
                    { res: { power: -4 } },
                    { trust: { yusuf: 2 } },
                    { anim: 'yusuf:wave' },
                    s('yusuf', 'ep2.fam.y2', 'Habibti. Yes, it’s Baba. No, I’m not scared. Well, a little. Are you being brave for Mama? Good. Me too.', 'calm'),
                    n('ep2.fam.n2', 'He hangs up after exactly sixty seconds. Then he looks out of the window for a long time.'),
                  ],
                },
                {
                  id: 'grace',
                  at: 'seat_grace',
                  label: 'Talk to Grace',
                  once: true,
                  beats: [
                    {
                      if: 'flags.graceBenched',
                      then: [s('grace', 'ep2.fam.g1', 'Yusuf has my station. I’m fine. I’m just watching. I’m good at watching.', 'sad')],
                      else: [s('grace', 'ep2.fam.g2', 'Battery B at 61 percent. I’ve redone the power plan four times. It still works. I keep checking anyway.', 'calm')],
                    },
                  ],
                },
                {
                  id: 'lena',
                  at: 'seat_lena',
                  label: 'Talk to Lena',
                  once: true,
                  clue: true,
                  set: { noticedCO2: true },
                  beats: [s('lena', 'ep2.fam.l1', 'Two of us have headaches, and Yusuf is breathing fast. Early CO2. The alarm won’t trip for hours. Tell Kwame now, not later.', 'worried')],
                },
                { id: 'sleep', at: 'window', label: 'Try to sleep', exit: true },
              ],
            },
          },
          {
            if: 'flags.yusufAsked && !flags.salmaCall',
            then: [{ trust: { yusuf: -1 } }, n('ep2.fam.n3', 'Yusuf doesn’t ask again. He doesn’t mention Salma for the rest of the day.')],
            else: [],
          },
          { goto: 'co2_rising' },
        ],
      },

      // ---------- The square peg ----------
      co2_rising: {
        title: 'Square peg, round hole',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep2.co2.n1', 'A day and a half after the bang.'),
          { sfx: 'alarm' },
          n('ep2.co2.n2', 'A yellow light: CO2 high. Everyone has a headache.'),
          {
            if: 'flags.noticedCO2',
            then: [{ res: { co2: -10 } }, n('ep2.co2.n3', 'Because Lena spotted the headaches early, Kwame’s team started hours sooner. They are ready.')],
            else: [],
          },
          { if: 'flags.spareCartridges', then: [s('lena', 'ep2.co2.l1', 'That was my last spare cartridge. They bought us a day. Now we need the clever thing.', 'calm')], else: [] },
          { sfx: 'radio' },
          s('kwame', 'ep2.co2.k1', 'Lantern, we built it. A box that fits Lantern’s square cartridges onto Ibis’s round hole, out of things you have on board.', 'determined'),
          s('omar', 'ep2.co2.o1', 'A storage bag, a suit hose, the cover of the flight plan and a lot of tape. Kwame let me hold the tape!', 'happy'),
          {
            explore: {
              id: 'ep2.co2.explore',
              objective: 'Get ready to build the adapter. Choose who leads it.',
              spawn: 'start',
              hint: 'You need square cartridges and someone to read the steps.',
              exitWhen: 'flags.builderPicked && flags.tookCartridges',
              items: [
                {
                  id: 'fetch',
                  at: 'hatch',
                  label: 'Fetch the cartridges from cold, dark Lantern',
                  requires: '!flags.tookCartridges',
                  once: true,
                  set: { tookCartridges: true, fetchedLate: true },
                  beats: [{ res: { o2: -2 } }, n('ep2.co2.n4', 'Lantern is frozen and black. You find the locker by touch. Ten minutes you didn’t have to spend.')],
                },
                {
                  id: 'grace',
                  at: 'seat_grace',
                  label: 'Ask Grace to lead the build',
                  requires: '!flags.builderPicked',
                  set: { graceBuilt: true, builderPicked: true },
                  beats: [
                    {
                      if: 'flags.graceBenched',
                      then: [{ trust: { grace: 2 } }, { set: { graceBenched: false } }, s('grace', 'ep2.co2.g1', 'Me? After... Okay. Thank you. I need to fix something. Read me step one, Kwame.', 'determined')],
                      else: [{ trust: { grace: 1 } }, s('grace', 'ep2.co2.g2', 'Step one: cut the hose. I’m reading slowly. Breathe slowly.', 'calm')],
                    },
                  ],
                },
                {
                  id: 'yusuf',
                  at: 'seat_yusuf',
                  label: 'Ask Yusuf to read the steps',
                  requires: '!flags.builderPicked',
                  set: { builderPicked: true },
                  beats: [{ trust: { yusuf: 1 } }, s('yusuf', 'ep2.co2.y1', 'Step one: find the tape. Step two: more tape. I think I understand this procedure.', 'happy')],
                },
                { id: 'build', at: 'panel_center', label: 'Start building', exit: true },
              ],
            },
          },
          { survival: 'ep2.co2', win: 'co2_ok', lose: 'co2_bad' },
        ],
      },

      co2_ok: {
        title: 'The ugliest box',
        set: 'capsule',
        cast: CREW,
        beats: [
          { set: { adapterBuilt: true } },
          n('ep2.cok.n1', 'The fan hums. The bag on the side of the box puffs in and out as if it is breathing. Then the CO2 number starts to fall.'),
          { anim: 'yusuf:cheer' },
          s('yusuf', 'ep2.cok.y1', 'Control, Lantern. The ugliest box in the solar system is working.', 'happy'),
          { if: 'flags.graceBuilt', then: [s('grace', 'ep2.cok.g1', 'It works. Something I touched today works.', 'happy')], else: [] },
          { sfx: 'radio' },
          s('omar', 'ep2.cok.o1', 'They’re cheering in here. Nadia isn’t cheering. She’s smiling. Nadia never smiles!', 'happy'),
          {
            fact: {
              id: 'ep2.fact.mailbox',
              title: 'The “mailbox”, Apollo 13',
              text: 'The lunar module’s CO2 filters were sized for two people for about 30 hours, and the command module’s spare canisters were square while the lunar module’s openings were round. Engineers on the ground built an adapter from plastic bags, cardboard, a suit hose and grey tape, then read the steps up to the crew. CO2 fell from a dangerous level to almost nothing.',
              source: 'https://www.nasa.gov/history/afj/ap13fj/15day4-mailbox.html',
            },
          },
          { goto: 'blame' },
        ],
      },

      co2_bad: {
        title: 'A leak at the corner',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep2.cbad.n1', 'The box leaks at one corner. The CO2 number stops climbing, but it doesn’t fall. Not enough.'),
          s('lena', 'ep2.cbad.l1', 'Breathe slowly. Talk less. Move less. We patch it again in an hour.', 'calm'),
          { set: { co2Sick: true } },
          { health: { you: -10, yusuf: -10, lena: -10, grace: -10 } },
          s('yusuf', 'ep2.cbad.y1', 'Talk less. Lena finally found a way to shut me up.', 'worried'),
          n('ep2.cbad.n2', 'Nobody laughs. Everyone’s head is pounding.'),
          {
            fact: {
              id: 'ep2.fact.mailbox2',
              title: 'The “mailbox”, Apollo 13',
              text: 'The real crew built their adapter from plastic bags, cardboard, a suit hose and grey tape, following steps read up from the ground. Tape did not stick well to the canisters’ coating, so strips were wrapped around them first to give the tape something to grip. It worked: CO2 fell from a dangerous level to almost nothing.',
              source: 'https://www.nasa.gov/history/afj/ap13fj/15day4-mailbox.html',
            },
          },
          { goto: 'blame' },
        ],
      },

      // ---------- What really broke ----------
      blame: {
        title: 'What broke',
        set: 'capsule',
        cast: CREW,
        beats: [
          { sfx: 'radio' },
          s('kwame', 'ep2.blame.k1', 'Lantern, we know what happened to tank two. The ground test, when it wouldn’t drain: its heater switches were built for the old low voltage. The pad used a higher one. They welded shut.', 'calm'),
          s('kwame', 'ep2.blame.k2', 'Inside, it went past 500 degrees for hours. The gauge only went up to 27. Nobody could see it.', 'sad'),
          { if: 'flags.launchedCold', then: [s('kwame', 'ep2.blame.k3', 'So it wasn’t the cold. It wasn’t my seals. I don’t know why that doesn’t make me feel better.', 'sad')], else: [] },
          { camera: 'close:grace' },
          s('grace', 'ep2.blame.g1', 'I signed that test. I looked at that gauge and I wrote “normal”.', 'sad'),
          { if: 'flags.tankRechecked', then: [s('grace', 'ep2.blame.g2', 'We even checked it again the night before. The gauge couldn’t see it. I know that. I just don’t believe it yet.', 'sad')], else: [] },
          { if: 'flags.graceUnheard', then: [s('grace', 'ep2.blame.g3', 'I wanted to tell you about it that night at the pad. You were busy. I should have tried harder.', 'sad')], else: [] },
          {
            choice: {
              id: 'ep2.blame.c1',
              key: true,
              timer: 12,
              timeout: 'silent',
              options: [
                {
                  id: 'flagged',
                  text: 'You flagged it, Grace. You were right, and we flew anyway.',
                  requires: 'flags.tankFlagged',
                  lockedHint: 'Nobody flagged tank two before launch.',
                  set: { graceForgiven: true },
                  trust: { grace: 2 },
                  beats: [s('grace', 'ep2.blame.g4', 'I was right. I was right, and it didn’t matter. No... it matters. It’s in the record. Next time someone will read it.', 'sad')],
                },
                {
                  id: 'fix',
                  text: 'We all signed it. Now help me get us home. That’s how we fix it.',
                  set: { graceFocused: true },
                  trust: { grace: 1 },
                  beats: [s('grace', 'ep2.blame.g6', 'Home. Yes. Give me a problem, Commander. Any problem.', 'determined')],
                },
                {
                  id: 'harsh',
                  text: 'You should have caught it.',
                  set: { blamedGrace: true },
                  trust: { grace: -2, lena: -1 },
                  remember: 'grace',
                  beats: [{ anim: 'grace:sad' }, n('ep2.blame.n1', 'Grace turns to the wall. Lena stares at you as if she has never seen you before.')],
                },
                {
                  id: 'silent',
                  text: '[Say nothing]',
                  trust: { grace: -1 },
                  beats: [n('ep2.blame.n2', 'The silence says something. Grace hears it.')],
                },
              ],
            },
          },
          { goto: 'cold_night' },
        ],
      },

      // ---------- Cold, thirst, and who stays awake ----------
      cold_night: {
        title: 'The cold night',
        set: 'capsule',
        cast: CREW,
        beats: [
          {
            if: 'flags.heatersOff',
            then: [n('ep2.cold.n1', 'Ibis drops to 3 °C. Water beads on every wall and every panel. Your breath hangs in the air.')],
            else: [n('ep2.cold.n2', 'Ibis drops to 9 °C with its last heater on, and keeps dropping. Your breath hangs in the air.')],
          },
          s('lena', 'ep2.cold.l1', 'Water. Ibis makes none. If we drink normally, we run dry before entry. If we drink a fifth of normal, we get there, but we get sick.', 'calm'),
          {
            choice: {
              id: 'ep2.cold.c1',
              key: true,
              timer: 12,
              timeout: 'normal',
              options: [
                {
                  id: 'strict',
                  text: 'Strict ration. A small cup each, per day.',
                  set: { strictRation: true },
                  res: { water: 15 },
                  trust: { lena: 1 },
                  beats: [s('yusuf', 'ep2.cold.y1', 'A small cup. In the desert we had more. Fine. Fine.', 'worried')],
                },
                {
                  id: 'normal',
                  text: 'Drink what you need. We’ll find water later.',
                  res: { water: -25 },
                  trust: { yusuf: 1 },
                  beats: [s('lena', 'ep2.cold.l2', 'Later is a place we may not reach. Your call.', 'worried')],
                },
                {
                  id: 'me',
                  text: 'Strict for me. Normal for everyone else.',
                  set: { youThirsty: true },
                  res: { water: -10 },
                  trust: { yusuf: 1, grace: 1 },
                  beats: [s('lena', 'ep2.cold.l3', 'Heroic, and medically stupid. I’ll be watching you.', 'calm')],
                },
              ],
            },
          },
          s('lena', 'ep2.cold.l4', 'And you all need sleep. Two at a time. One stays on watch for the next burn.', 'calm'),
          {
            explore: {
              id: 'ep2.cold.explore',
              objective: 'Decide who keeps watch tonight, then get some rest.',
              spawn: 'start',
              hint: 'Talk to whoever should take the watch.',
              exitWhen: 'flags.watchPicked',
              items: [
                {
                  id: 'frost',
                  at: 'window',
                  label: 'Wipe the frost off the window',
                  once: true,
                  beats: [n('ep2.cold.n3', 'Through the clear patch: the Moon, close enough now that you can see the shadows inside its craters.')],
                },
                {
                  id: 'yusuf',
                  at: 'seat_yusuf',
                  label: 'Give Yusuf the watch',
                  requires: '!flags.watchPicked',
                  set: { watchPicked: true, watchYusuf: true },
                  beats: [{ trust: { yusuf: 1 } }, s('yusuf', 'ep2.cold.y2', 'I’ve flown night patrols colder than this. Sleep, boss. I’ve got the ship.', 'calm')],
                },
                {
                  id: 'grace',
                  at: 'seat_grace',
                  label: 'Give Grace the watch',
                  requires: '!flags.watchPicked',
                  set: { watchPicked: true, graceTired: true },
                  beats: [{ trust: { grace: 1 } }, s('grace', 'ep2.cold.g1', 'I can’t sleep anyway. I’ll count the stars. There are a lot of them.', 'calm')],
                },
                {
                  id: 'me',
                  at: 'panel_center',
                  label: 'Take the watch yourself',
                  requires: '!flags.watchPicked',
                  set: { watchPicked: true, youTired: true },
                  beats: [{ trust: { lena: -1 } }, s('lena', 'ep2.cold.l5', 'A tired commander makes tired decisions. You will pay for this on the last day.', 'angry')],
                },
                { id: 'rest', at: 'seat_you', label: 'Rest', exit: true },
              ],
            },
          },
          {
            fact: {
              id: 'ep2.fact.cold',
              title: 'Cold and thirsty, 1970',
              text: 'With the command module powered down, Apollo 13’s cabin fell to about 3 °C (38 °F) and water covered every wall. The crew cut their drinking water to about 180 ml a day, a fifth of normal. Together they lost 14 kg, and Fred Haise came home with a fever from an infection.',
              source: 'https://www.nasa.gov/missions/apollo/apollo-13-mission-details/',
            },
          },
          { goto: 'los' },
        ],
      },

      // ---------- Behind the Moon ----------
      los: {
        title: 'Loss of signal',
        set: 'capsule',
        cast: CREW,
        beats: [
          { camera: 'window' },
          n('ep2.los.n1', 'The Moon grows until it fills the window. Grey, close, enormous.'),
          { sfx: 'radio' },
          s('nadia', 'ep2.los.na1', 'Lantern, Control. Two minutes to loss of signal. You’re go for the far side. We’ll keep a light on for you.', 'calm'),
          { sfx: 'radio' },
          s('mariam', 'ep2.los.m1', 'Lantern, Mariam. Before you go. The Sun— a spot on the Sun just doubled in size. If it flares, you need to—', 'scared'),
          { sfx: 'silence' },
          n('ep2.los.n2', 'The Moon swallows the Earth. The radio hisses. Then nothing.'),
          { wait: 2 },
          { camera: 'close:lena' },
          s('lena', 'ep2.los.l1', 'Need to what?', 'scared'),
          { wait: 1.5 },
          { end: 'cliff', next: 'ep3' },
        ],
      },
    },
  });
})();
