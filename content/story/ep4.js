// Episode 4 script: "Home" (see docs/STORY.md and docs/STORY-BIBLE.md).
// Survival segments: ep4.burn (the terminator burn) and ep4.entry (the corridor).
// Endings: home_all, home_hurt, home_apart, lost. The epilogue is a walk
// through mission control, then a recap: "You chose X; the real team did Y".
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.story = SMD.story || {};
  SMD.story.episodes = SMD.story.episodes || [];

  const n = (id, narrate) => ({ narrate, id });
  const s = (say, id, line, mood) => (mood ? { say, mood, line, id } : { say, line, id });
  const CREW = ['you', 'yusuf', 'lena', 'grace'];
  const ALL = ['you', 'yusuf', 'lena', 'grace', 'nadia', 'kwame', 'mariam', 'tarek', 'omar', 'aiko'];

  SMD.story.episodes.push({
    id: 'ep4',
    n: 4,
    title: 'Home',
    subtitle: 'A frozen capsule, a cracked shield, and one narrow way into the air.',
    start: 'cold_lantern',
    endings: {
      home_all: { id: 'ep4.end.home_all', title: 'Everyone home', text: 'Four people climbed out of Lantern on their own feet. Everything they chose, and everyone who chose with them, brought them here.' },
      home_hurt: { id: 'ep4.end.home_hurt', title: 'Home, but not whole', text: 'The whole crew came home, but not everyone came home well. Some choices leave marks that heal slowly.' },
      home_apart: { id: 'ep4.end.home_apart', title: 'Home, apart', text: 'Everyone came home safe. Not everyone came home a crew. Trust is a resource too, and it ran out.' },
      lost: { id: 'ep4.end.lost', title: 'Last light', text: 'Lantern never answered. Every rule the agency wrote afterwards carries four names.' },
    },
    scenes: {
      // ---------- Waking the frozen capsule ----------
      cold_lantern: {
        title: 'Waking Lantern',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep4.cold.n1', 'Day 6. Back in Lantern, dead and frozen for three days. Earth fills half the window.'),
          { if: 'flags.heatersOff', then: [n('ep4.cold.n2', 'Frost on the seats. Drops of water on every panel, every wire, every switch. Power it up wet, and something could short.')], else: [n('ep4.cold.n3', 'The last heater kept the worst away, but water still beads on the panels. Power it up wet, and something could short.')] },
          {
            explore: {
              id: 'ep4.cold.explore',
              objective: 'Get Lantern ready to wake up. Dry the panels before the power-up.',
              spawn: 'start',
              hint: 'The left panel is dripping.',
              exitWhen: 'flags.driedPanels',
              items: [
                {
                  id: 'dry',
                  at: 'panel_left',
                  label: 'Dry the wet panels',
                  once: true,
                  set: { driedPanels: true },
                  beats: [n('ep4.cold.n4', 'Towels, socks, a spare shirt. Twenty minutes of wiping in the cold until the switches are dry.')],
                },
                {
                  id: 'grace',
                  at: 'seat_grace',
                  label: 'Talk to Grace',
                  once: true,
                  beats: [
                    {
                      if: 'trust.grace >= 1 || flags.graceFocused || flags.graceForgiven',
                      then: [
                        { set: { graceTrick: true } },
                        s('grace', 'ep4.cold.g1', 'I have an idea. If we wake guidance before the heaters, the heaters warm the computer instead of fighting the cold. It saves about twelve amp-hours. I checked it four times.', 'determined'),
                      ],
                      else: [n('ep4.cold.n5', 'Grace opens her mouth, then closes it again. Whatever she was going to say, she keeps.')],
                    },
                  ],
                },
                {
                  id: 'yusuf',
                  at: 'seat_yusuf',
                  label: 'Talk to Yusuf',
                  once: true,
                  beats: [
                    {
                      if: 'flags.strictRation && !flags.feverTreated',
                      then: [{ set: { yusufFever: true } }, { health: { yusuf: -15 } }, s('yusuf', 'ep4.cold.y1', 'Thirty-nine degrees, Lena says. I feel great. That’s the fever talking.', 'worried')],
                      else: [s('yusuf', 'ep4.cold.y2', 'Last day. I can smell home. It smells like Lantern’s wet socks, but still.', 'happy')],
                    },
                  ],
                },
                {
                  id: 'lena',
                  at: 'seat_lena',
                  label: 'Talk to Lena',
                  once: true,
                  beats: [
                    {
                      if: 'flags.hidShield',
                      then: [{ set: { lenaSuspects: true } }, s('lena', 'ep4.cold.l1', 'You saw something on that camera. I know you did. I’m asking once. Is it the heat shield?', 'angry'), n('ep4.cold.n6', 'You tell her. She doesn’t say anything for a long time.'), { trust: { lena: -1 } }],
                      else: [s('lena', 'ep4.cold.l2', 'Everyone is weak, cold and thirsty. Entry will feel like four people sitting on your chest. Short and hard is better than long and soft for bodies like ours.', 'calm')],
                    },
                  ],
                },
                {
                  id: 'window',
                  at: 'window',
                  label: 'Look at Earth',
                  once: true,
                  beats: [n('ep4.cold.n7', 'Clouds over Africa. The Nile, a thin dark line. Somewhere down there, Salma is pressing her face to a screen.')],
                },
                { id: 'start', at: 'panel_center', label: 'Start the power-up', exit: true },
              ],
            },
          },
          { sfx: 'radio' },
          s('kwame', 'ep4.cold.k1', 'Lantern, here is the power-up list. It normally takes three months to write one. We wrote it in three days.', 'calm'),
          { if: 'flags.powerShort', then: [s('kwame', 'ep4.cold.k2', 'Your batteries are low. The list fits, but with almost nothing to spare.', 'worried')], else: [] },
          {
            choice: {
              id: 'ep4.power.c1',
              key: true,
              timer: 15,
              timeout: 'list',
              options: [
                {
                  id: 'grace',
                  text: 'Grace’s order: guidance first, heaters second.',
                  requires: 'flags.graceTrick',
                  lockedHint: 'Grace had an idea, but she didn’t feel she could tell you.',
                  set: { graceSaved: true },
                  res: { power: 10 },
                  trust: { grace: 1, kwame: 1 },
                  beats: [s('kwame', 'ep4.cold.k3', 'Twelve amp-hours. Grace, I’m putting your name on this procedure.', 'happy')],
                },
                {
                  id: 'list',
                  text: 'Kwame’s list, exactly as written.',
                  beats: [n('ep4.cold.n8', 'Switch by switch, Lantern wakes. The panels glow. Nothing sparks.')],
                },
                {
                  id: 'cold',
                  text: 'Kwame’s list, but leave the cabin heaters off for entry.',
                  set: { coldEntry: true },
                  res: { power: 6 },
                  trust: { lena: -1 },
                  beats: [s('lena', 'ep4.cold.l3', 'Cold bodies at high g. I don’t love it. I understand it.', 'worried')],
                },
              ],
            },
          },
          { if: '!flags.driedPanels', then: [{ res: { power: -5 } }], else: [] },
          {
            fact: {
              id: 'ep4.fact.powerup',
              title: 'Waking a frozen ship, 1970',
              text: 'Apollo 13’s command module had been shut down for days in the cold. Water covered its walls, panels and wires, and nobody knew if it would short when switched on. Flight controllers wrote the power-up procedure in about three days, a job that normally took months. It worked. Jim Lovell said later that it “rained inside” the capsule as it slowed down in the air.',
              source: 'https://www.nasa.gov/missions/apollo/apollo-13-mission-details/',
            },
          },
          { goto: 'burn_prep' },
        ],
      },

      // ---------- The terminator burn ----------
      burn_prep: {
        title: 'The terminator',
        set: 'capsule',
        cast: CREW,
        beats: [
          { sfx: 'radio' },
          s('nadia', 'ep4.burn.na1', 'Lantern, you’re drifting. At this angle you’ll skim the air too shallow and skip back out. You need one short burn.', 'determined'),
          { if: 'flags.roughAim', then: [s('nadia', 'ep4.burn.na2', 'The hand burn behind the Moon left you further off than we’d like. This one matters more now.', 'worried')], else: [] },
          s('grace', 'ep4.burn.g1', 'No computer for this. It costs too much power. We point the ship by hand: keep the line between Earth’s day and night on the mark in the window.', 'calm'),
          s('yusuf', 'ep4.burn.y1', 'The terminator. Lovell did this. With a wristwatch. Let me fly it, boss.', 'determined'),
          {
            choice: {
              id: 'ep4.burn.c1',
              key: true,
              timer: 12,
              timeout: 'you',
              options: [
                {
                  id: 'together',
                  text: 'We fly it together. Yusuf holds the line, I watch the drift, Grace counts.',
                  requires: 'flags.crewMended || trust.yusuf >= 2',
                  lockedHint: 'You and Yusuf aren’t in a place to share the controls.',
                  set: { flewTogether: true },
                  trust: { yusuf: 1, grace: 1 },
                  beats: [s('yusuf', 'ep4.burn.y2', 'Like Lovell and Haise. And Grace is our Swigert. Yalla.', 'happy')],
                },
                {
                  id: 'yusuf',
                  text: 'Yusuf flies it.',
                  set: { yusufFlew: true },
                  trust: { yusuf: 2 },
                  beats: [{ if: 'flags.yusufFever', then: [n('ep4.burn.n1', 'His hands are hot and not quite steady. He grips the controller harder.')], else: [] }],
                },
                {
                  id: 'you',
                  text: 'I fly it.',
                  set: { youFlew: true },
                  trust: { yusuf: -1 },
                  remember: 'yusuf',
                  beats: [{ if: 'flags.youTired', then: [n('ep4.burn.n2', 'You haven’t slept properly in two days. The mark in the window swims a little.')], else: [] }],
                },
              ],
            },
          },
          { if: 'trust.grace >= 0', then: [s('grace', 'ep4.burn.g2', 'I’ll count. Out loud. Fourteen seconds.', 'determined')], else: [s('lena', 'ep4.burn.l1', 'Grace? Grace, will you count? ... No. I’ll count.', 'worried')] },
          { survival: 'ep4.burn', win: 'burn_ok', lose: 'burn_bad' },
        ],
      },

      burn_ok: {
        title: 'On the line',
        set: 'capsule',
        cast: CREW,
        beats: [
          { set: { corridorOk: true } },
          s('nadia', 'ep4.bok.na1', 'Lantern, we have you in the corridor. Right in the middle. That was beautiful flying.', 'happy'),
          { anim: 'yusuf:celebrate' },
          {
            fact: {
              id: 'ep4.fact.terminator',
              title: 'Fourteen seconds by hand',
              text: 'With the lunar module computer switched off to save power and cooling water, Apollo 13 had to correct its course by hand. Jim Lovell held the line between Earth’s day and night steady in the window, Fred Haise watched that the ship didn’t slide sideways, and Jack Swigert timed the 14-second burn on his wristwatch.',
              source: 'https://www.nasa.gov/history/afj/ap13fj/19day5-themanualcoursecorrection.html',
            },
          },
          { goto: 'goodbye' },
        ],
      },

      burn_bad: {
        title: 'Off the line',
        set: 'capsule',
        cast: CREW,
        beats: [
          s('nadia', 'ep4.bbad.na1', 'Lantern, you’re still shallow. Not by much. You can burn again, but it costs power you need for entry.', 'worried'),
          {
            choice: {
              id: 'ep4.bbad.c1',
              key: true,
              timer: 10,
              timeout: 'save',
              options: [
                {
                  id: 'again',
                  text: 'Burn again. Get us in the corridor.',
                  set: { corridorOk: true, reburn: true },
                  res: { power: -15 },
                  beats: [n('ep4.bbad.n1', 'Four more seconds. The number on the screen slides into the middle of the corridor.')],
                },
                {
                  id: 'save',
                  text: 'Save the power. We’ll fly the entry angle by hand.',
                  set: { shallowEntry: true },
                  beats: [s('grace', 'ep4.bbad.g1', 'Then the entry will be harder to hold. I’ll call the angles.', 'worried')],
                },
              ],
            },
          },
          {
            fact: {
              id: 'ep4.fact.terminator2',
              title: 'Fourteen seconds by hand',
              text: 'Apollo 13’s crew corrected their course by hand with the computer off: Jim Lovell held Earth’s day-night line steady in the window, Fred Haise watched for sideways drift, and Jack Swigert timed the 14-second burn on his wristwatch.',
              source: 'https://www.nasa.gov/history/afj/ap13fj/19day5-themanualcoursecorrection.html',
            },
          },
          { goto: 'goodbye' },
        ],
      },

      // ---------- Letting go of the service module and Ibis ----------
      goodbye: {
        title: 'Letting go',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep4.bye.n1', 'Four hours to entry. Time to let go of everything that kept you alive.'),
          {
            explore: {
              id: 'ep4.bye.explore',
              objective: 'Release the service module and Ibis. Then hear Kwame’s entry plan.',
              spawn: 'start',
              hint: 'Kwame is waiting on the centre panel.',
              exitWhen: 'flags.heardEntryPlan',
              items: [
                {
                  id: 'module',
                  at: 'window',
                  label: 'Watch the service module drift away',
                  once: true,
                  beats: [
                    n('ep4.bye.n2', 'It tumbles slowly past the window. One whole side is missing. Wires and torn insulation hang out like hair.'),
                    s('yusuf', 'ep4.bye.y1', 'We flew four days on that?', 'scared'),
                  ],
                },
                {
                  id: 'ibis',
                  at: 'hatch',
                  label: 'Close Ibis’s hatch for the last time',
                  once: true,
                  beats: [
                    n('ep4.bye.n3', 'Built for two people for two days. It carried four for four. The hatch closes with a soft thud.'),
                    s('omar', 'ep4.bye.o1', 'Farewell, Ibis. And we thank you. That’s what they said to Aquarius in 1970. I looked it up.', 'sad'),
                    { anim: 'grace:wave' },
                  ],
                },
                {
                  id: 'kwame',
                  at: 'panel_center',
                  label: 'Talk to Kwame about the entry',
                  once: true,
                  set: { heardEntryPlan: true },
                  beats: [
                    s('kwame', 'ep4.bye.k1', 'Two ways in. A skip: dip into the air, bounce up, come down again. Gentler on your bodies, but the shield heats twice and longer.', 'calm'),
                    s('kwame', 'ep4.bye.k2', 'Or direct: one dive. Harder on you, much shorter for the shield.', 'calm'),
                    {
                      if: 'flags.shieldMapped',
                      then: [s('kwame', 'ep4.bye.k3', 'And with Mariam’s picture, I know where the damage is. If you roll so that edge stays out of the hottest air, I think it holds.', 'determined')],
                      else: [s('kwame', 'ep4.bye.k4', 'I don’t know where the damage is, so I can’t tell you which side to protect. I’m sorry.', 'worried')],
                    },
                  ],
                },
                {
                  id: 'grace',
                  at: 'seat_grace',
                  label: 'Talk to Grace',
                  once: true,
                  beats: [
                    {
                      if: 'flags.graceKnowsShield || flags.shieldPlan',
                      then: [s('grace', 'ep4.bye.g1', 'I’ve run the roll angles. Whatever you pick, I’ll call them. Thank you for letting me help.', 'determined')],
                      else: [s('grace', 'ep4.bye.g2', 'Forty-two bolts on that wall at the pad. I still remember. Funny what you remember.', 'calm')],
                    },
                  ],
                },
                { id: 'strap', at: 'seat_you', label: 'Strap in for entry', exit: true },
              ],
            },
          },
          {
            fact: {
              id: 'ep4.fact.artemis',
              title: 'Artemis I’s heat shield, 2022',
              text: 'Orion comes home at about 11 km/s behind the largest heat shield of its kind. After the uncrewed Artemis I flight, engineers found the Avcoat shield had lost charred material in many places: during the skip entry, gases inside it could not escape, and it cracked. NASA flew Artemis II’s crew with the same kind of shield but a shorter, more direct entry.',
              source: 'https://www.nasa.gov/missions/artemis/nasa-identifies-cause-of-artemis-i-orion-heat-shield-char-loss/',
            },
          },
          {
            choice: {
              id: 'ep4.entry.c1',
              key: true,
              timer: 15,
              timeout: 'direct',
              options: [
                {
                  id: 'roll',
                  text: 'Direct entry, rolled to keep the damaged edge out of the heat.',
                  requires: 'flags.shieldMapped',
                  lockedHint: 'Without a clear picture of the damage, nobody knows which side to protect.',
                  set: { directEntry: true, protectEdge: true },
                  trust: { kwame: 1, mariam: 1 },
                  beats: [s('kwame', 'ep4.bye.k5', 'That’s the one. Mariam’s camera just earned its forty kilograms.', 'determined')],
                },
                {
                  id: 'direct',
                  text: 'Direct entry. Short and hard.',
                  set: { directEntry: true },
                  beats: [s('lena', 'ep4.bye.l1', 'Short and hard. Everybody, empty your lungs on the way down. Grunt. It helps.', 'calm')],
                },
                {
                  id: 'skip',
                  text: 'Skip entry. Gentler on the crew.',
                  set: { skipEntry: true },
                  beats: [s('kwame', 'ep4.bye.k6', 'Gentler on you, harder on the shield. I hope it’s strong enough.', 'worried')],
                },
              ],
            },
          },
          { goto: 'last_words' },
        ],
      },

      // ---------- Voices before the blackout ----------
      last_words: {
        title: 'Before the blackout',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep4.last.n1', 'Fifteen minutes to the air. The radio fills with voices.'),
          { sfx: 'radio' },
          {
            if: 'flags.salmaCall',
            then: [n('ep4.last.n2', 'A small voice on the loop: “Baba, Mama says you can’t talk. That’s okay. I’ll talk. Come home.” Yusuf closes his eyes.')],
            else: [{ if: 'flags.metSalma', then: [n('ep4.last.n3', 'A message from Salma, recorded hours ago: “Commander, you promised.” Yusuf looks at you.')], else: [] }],
          },
          {
            if: 'flags.launchedCold',
            then: [s('kwame', 'ep4.last.k1', 'I have to tell you something. I watched the launch tape. Smoke from a booster joint at ignition. The seal held by luck. Only luck.', 'sad')],
            else: [s('kwame', 'ep4.last.k2', 'We pulled the old booster seals after your launch. Cold-damaged, all of them. We waited, and we were right to. Thank you.', 'calm')],
          },
          {
            if: 'trust.tarek >= 0',
            then: [s('tarek', 'ep4.last.t1', 'I moved the second recovery ship closer. It wasn’t in the budget. I’ll find it somewhere. For you.', 'calm')],
            else: [s('tarek', 'ep4.last.t2', 'I moved the second recovery ship closer. Not for you, Commander. For them.', 'determined')],
          },
          { set: { recoveryClose: true } },
          s('aiko', 'ep4.last.a1', 'Two hundred million people are watching now. The schools are open all night. Nobody is calling it boring.', 'calm'),
          {
            if: '!flags.crewKnowsShield && !flags.graceKnowsShield && !flags.lenaSuspects',
            then: [s('lena', 'ep4.last.l1', 'Why is Kwame talking about the shield? ... You knew. You knew, and you didn’t tell us.', 'angry'), { trust: { lena: -1, yusuf: -1 } }],
            else: [],
          },
          s('nadia', 'ep4.last.na1', 'Lantern, Control. You’re go for entry. We’ll see you in the water.', 'calm'),
          { survival: 'ep4.entry', win: 'blackout', lose: 'blackout_bad' },
        ],
      },

      // ---------- Blackout ----------
      blackout: {
        title: 'Blackout',
        set: 'black',
        cast: [],
        beats: [
          { set: { landed: true } },
          { sfx: 'silence' },
          n('ep4.black.n1', 'The air outside turns to fire. The radio goes dead. Four minutes of blackout is normal.'),
          { wait: 2 },
          { sfx: 'radio' },
          s('nadia', 'ep4.black.na1', 'Lantern, Control. Standing by.', 'calm'),
          { wait: 2 },
          { if: 'flags.skipEntry && !flags.protectEdge', then: [n('ep4.black.n2', 'Second dip. The cabin is hot. Something smells of scorched metal.'), { set: { roughEntry: true } }], else: [] },
          { if: 'flags.shallowEntry', then: [n('ep4.black.n3', 'The angle drifts shallow. Grace calls numbers, you fight the stick. Six minutes now. Longer than it should be.')], else: [] },
          s('nadia', 'ep4.black.na2', 'Lantern, Control. Standing by.', 'worried'),
          { wait: 2 },
          { sfx: 'radio' },
          s('yusuf', 'ep4.black.y1', 'Control, Lantern. Hello, Earth.', 'happy'),
          { goto: 'verdict' },
        ],
      },

      blackout_bad: {
        title: 'The long blackout',
        set: 'black',
        cast: [],
        beats: [
          { sfx: 'silence' },
          n('ep4.bbo.n1', 'The angle slips. Fire outside the window, much too long. The radio stays dead past four minutes. Past five.'),
          { wait: 2 },
          { sfx: 'radio' },
          s('nadia', 'ep4.bbo.na1', 'Lantern, Control. Lantern, Control.', 'worried'),
          { wait: 3 },
          s('nadia', 'ep4.bbo.na2', 'Lantern, Control. Do you read?', 'scared'),
          { wait: 3 },
          {
            if: 'flags.landed || flags.protectEdge',
            then: [
              { set: { landed: true, roughEntry: true } },
              { sfx: 'radio' },
              s('grace', 'ep4.bbo.g1', 'Control... Lantern. We’re here. We’re here. Someone’s hurt. But we’re here.', 'scared'),
              { goto: 'verdict' },
            ],
            else: [{ goto: 'end_lost' }],
          },
        ],
      },

      // ---------- Splashdown: which ending ----------
      verdict: {
        title: 'Splashdown',
        set: 'black',
        cast: [],
        beats: [
          n('ep4.verdict.n1', 'Three parachutes. Then the ocean, hard as a wall, and the capsule rolls upright.'),
          { if: 'res.water < 10', then: [{ set: { crewHurt: true, hurtWater: true } }, n('ep4.verdict.n2', 'Too little water, for too long. Someone faints under the last of the g-forces and doesn’t wake up when the hatch opens.')], else: [] },
          { if: 'res.o2 < 5', then: [{ set: { crewHurt: true, hurtAir: true } }, n('ep4.verdict.n3', 'The last of the oxygen was gone before the parachutes opened. Everyone’s lips are blue.')], else: [] },
          {
            if: 'flags.roughEntry',
            then: [
              {
                if: 'flags.medsKept',
                then: [n('ep4.verdict.n4', 'The hard entry knocks someone out cold. Lena has kept her last dose for exactly this. It is enough.')],
                else: [{ set: { crewHurt: true, hurtEntry: true } }, n('ep4.verdict.n5', 'The hard entry knocks someone out cold, and Lena has nothing left to give them.')],
              },
            ],
            else: [],
          },
          {
            if: 'health.you < 35 || health.yusuf < 35 || health.lena < 35 || health.grace < 35',
            then: [{ set: { crewHurt: true, hurtHealth: true } }, n('ep4.verdict.n6', 'Days of cold, bad air and radiation have added up. One of the crew cannot stand when the hatch opens.')],
            else: [],
          },
          { if: 'flags.crewHurt', then: [{ goto: 'end_hurt' }], else: [] },
          { if: 'trust.grace <= -2 || trust.yusuf <= -2 || trust.lena <= -2', then: [{ goto: 'end_apart' }], else: [] },
          { goto: 'end_all' },
        ],
      },

      end_all: {
        title: 'Everyone home',
        set: 'control',
        cast: ['nadia', 'kwame', 'mariam', 'tarek', 'omar', 'aiko'],
        beats: [
          { set: { endAll: true } },
          { sfx: 'radio' },
          n('ep4.all.n1', 'In mission control, a picture comes up on the big screen: four people on the deck of a ship, wrapped in blankets, waving.'),
          { anim: 'omar:cheer' },
          s('nadia', 'ep4.all.na1', 'Lantern crew is aboard the recovery ship. All four. Walking.', 'happy'),
          n('ep4.all.n2', 'The room erupts. Nadia takes off her headset, sits down, and puts her face in her hands.'),
          { goto: 'epilogue' },
        ],
      },

      end_hurt: {
        title: 'Home, but not whole',
        set: 'control',
        cast: ['nadia', 'kwame', 'mariam', 'tarek', 'omar', 'aiko'],
        beats: [
          { set: { endHurt: true } },
          n('ep4.hurt.n1', 'The ship’s doctors carry one of the crew out of the capsule on a stretcher. The cheering in mission control stops halfway.'),
          { if: 'flags.hurtRadiation', then: [n('ep4.hurt.n2', 'The one who sat at the edge of the storm shelter took more than a body can easily repair.')], else: [] },
          {
            if: 'flags.hurtEased',
            then: [s('nadia', 'ep4.hurt.na1', 'The doctors say weeks, not months. The medicine on board made the difference.', 'calm')],
            else: [s('nadia', 'ep4.hurt.na2', 'The doctors say months. Maybe longer. They won’t say “fly again” yet.', 'sad')],
          },
          s('tarek', 'ep4.hurt.t1', 'The second ship got them to a hospital in under three hours. Best money I ever spent.', 'sad'),
          { goto: 'epilogue' },
        ],
      },

      end_apart: {
        title: 'Home, apart',
        set: 'control',
        cast: ['nadia', 'kwame', 'mariam', 'tarek', 'omar', 'aiko'],
        beats: [
          { set: { endApart: true } },
          n('ep4.apart.n1', 'Four people on the deck of the recovery ship. Safe. But they stand apart, and nobody hugs.'),
          { if: 'trust.grace <= -2', then: [n('ep4.apart.n2', 'Grace resigns a month later. Her letter is two lines long. It doesn’t mention you.')], else: [] },
          { if: 'trust.yusuf <= -2', then: [n('ep4.apart.n3', 'Yusuf asks to be moved to another crew. He tells reporters the commander “made the hard calls”. He doesn’t smile when he says it.')], else: [] },
          { if: 'trust.lena <= -2', then: [n('ep4.apart.n4', 'Lena goes back to ESA. In her report she writes one sentence in capital letters: CREWS MUST BE TOLD THE TRUTH.')], else: [] },
          { goto: 'epilogue' },
        ],
      },

      end_lost: {
        title: 'Last light',
        set: 'control',
        cast: ['nadia', 'kwame', 'mariam', 'tarek', 'omar', 'aiko'],
        beats: [
          { set: { endLost: true } },
          { sfx: 'radio' },
          s('nadia', 'ep4.lost.na1', 'Lantern, Control.', 'calm'),
          { wait: 3 },
          s('nadia', 'ep4.lost.na2', 'Lantern, Control. Do you read?', 'worried'),
          { wait: 4 },
          { sfx: 'silence' },
          n('ep4.lost.n1', 'Ten minutes. Twenty. Nobody in the room moves. Omar is still holding the roll of tape from the adapter.'),
          n('ep4.lost.n2', 'Aiko turns off her camera without being asked.'),
          { wait: 2 },
          n('ep4.lost.n3', 'A year later, four empty chairs stand at the front of the hall for the next launch. Every rule the agency wrote afterwards carries four names.'),
          { if: 'flags.launchedCold', then: [n('ep4.lost.n4', 'Kwame testifies for six hours. He never says “I told you so.” He doesn’t have to.')], else: [] },
          { goto: 'recap' },
        ],
      },

      // ---------- Epilogue: walk through mission control ----------
      epilogue: {
        title: 'Afterwards',
        set: 'control',
        cast: ALL,
        place: { yusuf: 'window', lena: 'coffee', grace: 'bigscreen' },
        beats: [
          n('ep4.epi.n1', 'One week later. Mission control, after hours. The screens are dark. The coffee is still terrible.'),
          {
            explore: {
              id: 'ep4.epi.explore',
              objective: 'Walk through mission control one last time. Then go to the hearing.',
              spawn: 'start',
              hint: 'The hearing starts soon. The door is at the back.',
              exitWhen: 'true',
              items: [
                {
                  id: 'kwame',
                  at: 'kwame',
                  label: 'Talk to Kwame',
                  once: true,
                  beats: [
                    {
                      if: 'flags.launchedCold',
                      then: [s('kwame', 'ep4.epi.k1', 'They’re changing the rules. No launch outside tested temperatures, ever. An engineer can stop a launch now, and nobody can tell them to change hats.', 'calm')],
                      else: [s('kwame', 'ep4.epi.k2', 'You stood up for my data when it was expensive. I’ll remember that for the rest of my career.', 'happy')],
                    },
                  ],
                },
                {
                  id: 'grace',
                  at: 'bigscreen',
                  label: 'Talk to Grace',
                  once: true,
                  beats: [
                    {
                      if: 'trust.grace >= 1',
                      then: [s('grace', 'ep4.epi.g1', 'I’m writing the new tank test rules. Gauges that can read past their limits. And a box on every form: “Did anyone feel uneasy?”', 'happy')],
                      else: [s('grace', 'ep4.epi.g2', 'I came to clear my desk. Maybe I’ll come back. Maybe.', 'sad')],
                    },
                  ],
                },
                {
                  id: 'yusuf',
                  at: 'window',
                  label: 'Talk to Yusuf',
                  once: true,
                  beats: [
                    {
                      if: 'trust.yusuf >= 1',
                      then: [s('yusuf', 'ep4.epi.y1', 'Salma has told her whole school that I flew the spaceship. I’ve stopped correcting her. You’re invited to her birthday, by the way. Mandatory.', 'happy')],
                      else: [s('yusuf', 'ep4.epi.y2', 'We got home. That’s what matters. I keep telling myself that.', 'calm')],
                    },
                  ],
                },
                {
                  id: 'lena',
                  at: 'coffee',
                  label: 'Talk to Lena',
                  once: true,
                  beats: [
                    {
                      if: 'flags.brokePact',
                      then: [s('lena', 'ep4.epi.l1', 'You got us home. I’m grateful. I’m also never flying with someone who hides numbers again. Both things are true.', 'calm')],
                      else: [s('lena', 'ep4.epi.l2', 'You told me the truth when it was ugly. That is rarer than courage. Thank you.', 'happy')],
                    },
                  ],
                },
                {
                  id: 'mariam',
                  at: 'mariam',
                  label: 'Talk to Mariam',
                  once: true,
                  beats: [
                    {
                      if: 'flags.farPhotos && flags.hiresCamera',
                      then: [s('mariam', 'ep4.epi.m1', 'Your far-side photos are in every textbook printed next year. Children will grow up with your pictures.', 'happy')],
                      else: [s('mariam', 'ep4.epi.m2', 'The Sun hasn’t calmed down. We’re building a better storm warning. Forty minutes was not enough.', 'determined')],
                    },
                  ],
                },
                {
                  id: 'omar',
                  at: 'omar',
                  label: 'Talk to Omar',
                  once: true,
                  beats: [s('omar', 'ep4.epi.o1', 'I’ve changed my mind. I don’t want to see the planets. I want to be the person on the radio who brings people home.', 'happy')],
                },
                {
                  id: 'aiko',
                  at: 'aiko',
                  label: 'Talk to Aiko',
                  once: true,
                  beats: [
                    {
                      if: 'flags.publicHonest || flags.dataWon',
                      then: [s('aiko', 'ep4.epi.a1', 'Applications to engineering schools went up this week. Because we told the truth, the whole way. People trusted us.', 'happy')],
                      else: [s('aiko', 'ep4.epi.a2', 'Reporters are still asking what we didn’t tell them. Trust takes years to earn back.', 'worried')],
                    },
                  ],
                },
                { id: 'hearing', at: 'door', label: 'Go to the hearing', exit: true },
              ],
            },
          },
          s('tarek', 'ep4.epi.t1', 'They’ll ask you three questions, {you}. The first one is always: “Was it worth the money?”', 'calm'),
          {
            choice: {
              id: 'ep4.hearing.c1',
              key: true,
              timer: 20,
              timeout: 'team',
              options: [
                {
                  id: 'truth',
                  text: 'Tell them everything, including my own mistakes.',
                  set: { hearingTruth: true },
                  trust: { kwame: 1, lena: 1, aiko: 1 },
                  beats: [n('ep4.epi.n2', 'You talk for two hours. You don’t make yourself look good. The room is very quiet. Afterwards the senators shake your hand.')],
                },
                {
                  id: 'team',
                  text: 'Give the credit to the team on the ground and the crew.',
                  set: { hearingTeam: true },
                  trust: { nadia: 1, omar: 1 },
                  beats: [n('ep4.epi.n3', 'You name every person in mission control, one by one. Omar goes red when you get to him.')],
                },
                {
                  id: 'program',
                  text: 'Defend the program. One bad tank must not cancel everything.',
                  set: { hearingProgram: true },
                  trust: { tarek: 1 },
                  beats: [n('ep4.epi.n4', 'You fight for the budget, and you win it. Next year’s launch is safe. Some people in the room wonder what you left out.')],
                },
              ],
            },
          },
          { goto: 'recap' },
        ],
      },

      // ---------- Recap: you chose X; the real team did Y ----------
      recap: {
        title: 'What really happened',
        set: 'briefing',
        cast: ['you'],
        beats: [
          { camera: 'wide' },
          n('ep4.recap.n0', 'Your choices, beside the real ones.'),
          {
            if: 'flags.launchedCold',
            then: [n('ep4.recap.cold1', 'You launched in the cold, against your engineer’s advice. A booster seal leaked at ignition and held by luck.')],
            else: [n('ep4.recap.cold2', 'You waited for warm air. It cost money, a hard hearing and half the audience.')],
          },
          n('ep4.recap.cold3', 'In 1986, NASA launched Challenger at 2 °C after engineers warned against it. A cold seal failed, and seven people were lost. The investigation blamed a decision process that let money and schedule outweigh the data.'),
          {
            if: 'flags.tankFlagged',
            then: [n('ep4.recap.tank1', 'You read tank two’s log, saw the stuck gauge, and flagged it. Nobody upstairs read it in time.')],
            else: [n('ep4.recap.tank2', 'Tank two’s test was signed off as normal.')],
          },
          n('ep4.recap.tank3', 'Apollo 13’s tank was damaged in a ground test whose gauge could not read high enough to show the problem. The fixes afterwards: new heater switches, no more stirring fans inside the tanks, and a third oxygen tank kept apart from the other two.'),
          {
            if: 'flags.adapterBuilt',
            then: [n('ep4.recap.co2a', 'Your crew built the CO2 adapter by hand, and it worked.')],
            else: [n('ep4.recap.co2b', 'Your CO2 adapter leaked, and the crew breathed bad air for hours.')],
          },
          n('ep4.recap.co2c', 'Apollo 13’s crew built theirs from bags, cardboard, a hose and tape, following steps from the ground. It worked.'),
          {
            if: 'flags.strictRation',
            then: [n('ep4.recap.water1', 'You rationed water hard, and someone got a fever.')],
            else: [n('ep4.recap.water2', 'You let the crew drink, and the tanks ran low before the end.')],
          },
          n('ep4.recap.water3', 'Apollo 13’s crew drank about a fifth of their normal water. They came home 14 kg lighter, and Fred Haise with a fever.'),
          {
            if: 'flags.doseShared',
            then: [n('ep4.recap.storm1', 'In the storm, you used Mariam’s plan so that nobody took the worst of it.')],
            else: [n('ep4.recap.storm2', 'In the storm, one person sat at the thin edge of the shelter for everyone else.')],
          },
          n('ep4.recap.storm3', 'No crew was in deep space for the August 1972 storm. Luck. Orion crews today are trained to build a shelter from what they carry.'),
          {
            if: 'flags.burnPC2',
            then: [n('ep4.recap.burn1', 'You burned two hours after the far side, with rough numbers from the ground.')],
            else: [
              {
                if: 'flags.roughAim',
                then: [n('ep4.recap.burn2', 'You burned at once, by hand, on Yusuf’s word.')],
                else: [n('ep4.recap.burn3', 'You waited six hours for perfect numbers, and paid in air and water.')],
              },
            ],
          },
          n('ep4.recap.burn4', 'Apollo 13 made exactly that kind of burn, two hours after the far side. It cut about nine hours off the trip home.'),
          {
            if: 'flags.flewTogether',
            then: [n('ep4.recap.hand1', 'You flew the terminator burn as a team: one held the line, one watched the drift, one counted.')],
            else: [n('ep4.recap.hand2', 'One person flew the terminator burn.')],
          },
          n('ep4.recap.hand3', 'On Apollo 13, Lovell held the line, Haise watched the drift and Swigert timed 14 seconds on his watch. Three people, one burn.'),
          {
            if: 'flags.skipEntry',
            then: [n('ep4.recap.entry1', 'You chose the gentler skip entry with a damaged shield.')],
            else: [n('ep4.recap.entry2', 'You chose the short, direct entry.')],
          },
          n('ep4.recap.entry3', 'After Artemis I’s shield cracked during a skip entry, NASA brought Artemis II’s crew home on a shorter, more direct path.'),
          {
            fact: {
              id: 'ep4.fact.record',
              title: 'Apollo 13 came home',
              text: 'On 17 April 1970, after almost six days, Apollo 13 splashed down in the Pacific. Its blackout lasted about six minutes, longer than anyone expected, because it came in shallower than planned. On the way, its crew had travelled 400,171 km from Earth, a human distance record that stood until Artemis II in 2026. NASA calls it a “successful failure”.',
              source: 'https://www.nasa.gov/missions/apollo/apollo-13-mission-details/',
            },
          },
          { goto: 'final' },
        ],
      },

      final: {
        title: 'The end',
        set: 'black',
        cast: [],
        beats: [
          n('ep4.final.n1', 'Every kilogram was a choice. So was every word.'),
          { wait: 1.5 },
          {
            if: 'flags.endLost',
            then: [{ end: 'lost' }],
            else: [
              {
                if: 'flags.endHurt',
                then: [{ end: 'home_hurt' }],
                else: [{ if: 'flags.endApart', then: [{ end: 'home_apart' }], else: [{ end: 'home_all' }] }],
              },
            ],
          },
        ],
      },
    },
  });
})();
