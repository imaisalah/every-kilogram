// Episode 3 script: "Far Side" (see docs/STORY.md and docs/STORY-BIBLE.md).
// Survival segment: ep3.storm (the radiation shelter).
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.story = SMD.story || {};
  SMD.story.episodes = SMD.story.episodes || [];

  const n = (id, narrate) => ({ narrate, id });
  const s = (say, id, line, mood) => (mood ? { say, mood, line, id } : { say, line, id });
  const CREW = ['you', 'yusuf', 'lena', 'grace'];

  SMD.story.episodes.push({
    id: 'ep3',
    n: 3,
    title: 'Far Side',
    subtitle: 'Behind the Moon, with no radio, the Sun turns against you.',
    start: 'far_side',
    endings: {
      cliff: { id: 'ep3.end.cliff', title: 'The heat shield', text: 'The only thing between four people and a fire hotter than the Sun’s surface is cracked. To be continued in Episode 4: Home.' },
    },
    scenes: {
      // ---------- Alone behind the Moon ----------
      far_side: {
        title: 'The far side',
        set: 'capsule',
        cast: CREW,
        beats: [
          { camera: 'window' },
          { sfx: 'silence' },
          n('ep3.far.n1', '250 kilometres above the far side of the Moon. No radio. No Earth. For twenty-five minutes, nobody in the universe can hear you.'),
          {
            explore: {
              id: 'ep3.far.explore',
              objective: 'Twenty-five minutes without radio. Use them.',
              spawn: 'start',
              hint: 'Mariam’s last message is still on the centre panel.',
              exitWhen: 'true',
              items: [
                {
                  id: 'window',
                  at: 'window',
                  label: 'Look at the far side',
                  once: true,
                  set: { lookedOut: true },
                  beats: [
                    n('ep3.far.n2', 'Craters on craters on craters, lit from the side, sharp as a knife. No seas, no faces. A side of the Moon no one on Earth ever sees.'),
                    { trust: { yusuf: 1 } },
                    s('yusuf', 'ep3.far.y1', 'Whatever happens now, we saw this. Salma’s Baba saw this.', 'calm'),
                  ],
                },
                {
                  id: 'photos',
                  at: 'camera',
                  label: 'Take the far-side pictures with Mariam’s camera',
                  requires: 'flags.hiresCamera',
                  once: true,
                  set: { farPhotos: true },
                  beats: [{ res: { power: -3 } }, n('ep3.far.n3', 'The camera clicks through its sequence. Every frame sharper than any map. Mariam is going to cry when she sees these.')],
                },
                {
                  id: 'phone',
                  at: 'camera',
                  label: 'Take a few pictures with a handheld camera',
                  requires: '!flags.hiresCamera',
                  once: true,
                  set: { farPhotos: true },
                  beats: [n('ep3.far.n4', 'Through frosted glass, with cold fingers. Blurry. They are still the best photos you will ever take.')],
                },
                {
                  id: 'lena',
                  at: 'seat_lena',
                  label: 'Talk to Lena',
                  once: true,
                  beats: [
                    {
                      if: 'flags.brokePact',
                      then: [s('lena', 'ep3.far.l1', 'It’s beautiful. I wish I could trust what you’ll tell me about it.', 'sad')],
                      else: [s('lena', 'ep3.far.l2', 'Pulse 92, breathing fine. Mine, I mean. I measure myself when I’m afraid. It helps.', 'calm')],
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
                      if: 'trust.grace >= 1',
                      then: [s('grace', 'ep3.far.g1', 'Two hundred and eleven craters so far. I’m counting the happy way now. Thank you for keeping me on the team.', 'happy')],
                      else: [s('grace', 'ep3.far.g2', 'I’m fine. I’m counting. Don’t worry about me.', 'sad')],
                    },
                  ],
                },
                {
                  id: 'counter',
                  at: 'panel_left',
                  label: 'Check the radiation counter',
                  once: true,
                  clue: true,
                  set: { sawCounter: true },
                  beats: [n('ep3.far.n5', 'The radiation counter clicks twice as fast as yesterday. Something is already arriving.')],
                },
                {
                  id: 'packet',
                  at: 'panel_center',
                  label: 'Read Mariam’s last data packet',
                  once: true,
                  clue: true,
                  set: { readFlareData: true },
                  beats: [
                    n('ep3.far.n6', 'The rest of Mariam’s message arrived before the signal died. A giant flare. Particle storm expected about forty minutes after you come out from behind the Moon.'),
                    n('ep3.far.n7', 'At the bottom, a sketch: three people in the middle of the lower bay, the food lockers moved to cover the fourth seat. “Start early,” it says.'),
                  ],
                },
                { id: 'strap', at: 'seat_you', label: 'Strap in for signal', exit: true },
              ],
            },
          },
          { sfx: 'radio' },
          s('nadia', 'ep3.far.na1', 'Lantern, Control. Good to hear you. Mariam has news. Listen carefully.', 'calm'),
          { goto: 'storm' },
        ],
      },

      // ---------- The storm warning ----------
      storm: {
        title: 'Proton storm',
        set: 'capsule',
        cast: CREW,
        beats: [
          s('mariam', 'ep3.storm.m1', 'A huge flare. Fast protons, coming straight at you. The first ones in forty minutes, the worst a few hours later. Like August 1972.', 'scared'),
          s('mariam', 'ep3.storm.m2', 'Ibis has thin walls. Go into Lantern’s lower bay, behind the heat shield, and build a wall of water bags and stowage around yourselves.', 'determined'),
          s('grace', 'ep3.storm.g1', 'There’s only room for three in the middle. The fourth seat is by the hatch. Thinner wall.', 'worried'),
          s('lena', 'ep3.storm.l1', 'I’ll take it. I’m the doctor. I’ll know what is happening to me before anyone else does.', 'determined'),
          s('yusuf', 'ep3.storm.y1', 'No. I’m the biggest. Put me at the edge and I block more for you.', 'determined'),
          { if: 'flags.sawCounter', then: [n('ep3.storm.n1', 'You saw the counter climbing. The first water bags are already moving.'), { set: { headStart: true } }], else: [] },
          { camera: 'close:you' },
          {
            choice: {
              id: 'ep3.storm.c1',
              key: true,
              timer: 12,
              timeout: 'none',
              options: [
                {
                  id: 'shared',
                  text: 'Nobody takes the edge. Move the food lockers there, like Mariam drew.',
                  requires: 'flags.readFlareData',
                  lockedHint: 'You never read Mariam’s last data packet. There is no plan for the fourth seat.',
                  set: { doseShared: true },
                  trust: { lena: 1, yusuf: 1, mariam: 1 },
                  beats: [s('grace', 'ep3.storm.g2', 'Lockers to the edge, water bags round the middle. We all squeeze. Nobody takes it all.', 'determined')],
                },
                {
                  id: 'lena',
                  text: 'Lena takes the edge.',
                  set: { doseLena: true },
                  trust: { lena: 1, yusuf: -1 },
                  beats: [s('lena', 'ep3.storm.l2', 'Good. I’ll keep a log of my own symptoms. Somebody will learn from it.', 'calm')],
                },
                {
                  id: 'yusuf',
                  text: 'Yusuf takes the edge.',
                  set: { doseYusuf: true },
                  trust: { yusuf: 1 },
                  beats: [
                    { if: 'flags.metSalma', then: [s('lena', 'ep3.storm.l3', 'He has a daughter, {you}.', 'worried')], else: [] },
                    s('yusuf', 'ep3.storm.y2', 'That’s why I’m doing it. So I can tell her I did.', 'determined'),
                  ],
                },
                {
                  id: 'none',
                  text: '[Say nothing]',
                  set: { doseGrace: true },
                  beats: [n('ep3.storm.n2', 'Nobody moves. Grace, closest to the hatch, quietly sits down at the edge. She doesn’t ask anyone.')],
                },
              ],
            },
          },
          { survival: 'ep3.storm', win: 'shelter_ok', lose: 'shelter_bad' },
        ],
      },

      shelter_ok: {
        title: 'The wall holds',
        set: 'capsule',
        cast: CREW,
        beats: [
          { set: { shelterGood: true } },
          n('ep3.sok.n1', 'Six hours, four people, one wall of water. The counter screams outside it and murmurs inside.'),
          { if: 'flags.doseShared', then: [s('lena', 'ep3.sok.l1', 'Everyone took a little. Nobody took too much. That is the best result possible.', 'happy')], else: [s('lena', 'ep3.sok.l2', 'The edge seat took more than the rest of us. More than I like. Not more than a body can heal.', 'calm')] },
          { goto: 'meds' },
        ],
      },

      shelter_bad: {
        title: 'Not enough wall',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep3.sbad.n1', 'The wall had gaps. The counter inside it climbs all night.'),
          {
            if: 'flags.doseShared',
            then: [s('lena', 'ep3.sbad.l1', 'Too much for all of us, but shared four ways. Tired, sick, but we will heal.', 'worried')],
            else: [
              { set: { crewHurt: true, hurtRadiation: true } },
              { if: 'flags.doseLena', then: [s('lena', 'ep3.sbad.l2', 'Nausea, two hours after exposure. I know what that means. I’m writing it down. Don’t look at me like that.', 'calm')], else: [] },
              { if: 'flags.doseYusuf', then: [s('yusuf', 'ep3.sbad.y1', 'I’m fine. Just... tired. I’ll close my eyes for a minute.', 'sad'), n('ep3.sbad.n2', 'Lena checks his pulse every ten minutes after that.')], else: [] },
              { if: 'flags.doseGrace', then: [n('ep3.sbad.n4', 'Grace is sick, quietly, into a bag. She apologises for the smell. Nobody can answer her.')], else: [] },
            ],
          },
          {
            fact: {
              id: 'ep3.fact.storm1',
              title: 'Shelters against the Sun',
              text: 'Water and stowage are good shields: their light atoms slow fast particles. Orion has no heavy storm vault. If the Sun erupts, the crew builds a shelter from the bags and supplies on board, inside the most shielded part of the capsule, within about an hour.',
              source: 'https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/',
            },
          },
          { goto: 'meds' },
        ],
      },

      // ---------- The last dose ----------
      meds: {
        title: 'The last dose',
        set: 'capsule',
        cast: CREW,
        beats: [
          {
            fact: {
              id: 'ep3.fact.storm',
              title: 'August 1972: the storm between missions',
              text: 'In early August 1972, between Apollo 16 (April) and Apollo 17 (December), the Sun produced one of the strongest particle storms of the space age. Nobody was beyond Earth orbit. Studies later found that astronauts on the Moon’s surface could have received a dangerous dose; inside the thick-walled command module, far less. The near miss still shapes how NASA plans for space weather today.',
              source: 'https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/',
            },
          },
          { if: 'flags.strictRation', then: [s('lena', 'ep3.meds.l1', 'Yusuf has a fever. Not enough water. His kidneys are complaining, like Fred Haise’s did on Apollo 13.', 'worried')], else: [] },
          s('lena', 'ep3.meds.l2', 'Ibis’s first-aid box has one strong dose left. Anti-sickness, fever, pain. One. Who gets it?', 'calm'),
          {
            choice: {
              id: 'ep3.meds.c1',
              key: true,
              options: [
                {
                  id: 'kit',
                  text: 'We have Lantern’s medical kit. Everyone who needs it gets it.',
                  requires: 'flags.tookMedkit',
                  lockedHint: 'You left Lantern’s medical kit behind.',
                  set: { hurtEased: true, feverTreated: true, medsKept: true },
                  trust: { lena: 1 },
                  beats: [s('lena', 'ep3.meds.l3', 'A whole hospital. I could kiss you. I won’t. But I could.', 'happy')],
                },
                {
                  id: 'edge',
                  text: 'Whoever sat at the edge.',
                  set: { hurtEased: true },
                  beats: [s('lena', 'ep3.meds.l4', 'Agreed. The dose is where the damage is.', 'calm')],
                },
                {
                  id: 'fever',
                  text: 'Yusuf, for his fever.',
                  requires: 'flags.strictRation',
                  lockedHint: 'Nobody has a fever.',
                  set: { feverTreated: true },
                  trust: { yusuf: 1 },
                  beats: [s('yusuf', 'ep3.meds.y1', 'For me? I’ll be the best patient you ever had. That’s a lie. But thank you.', 'calm')],
                },
                {
                  id: 'keep',
                  text: 'Nobody. We keep it for entry.',
                  set: { medsKept: true },
                  beats: [s('lena', 'ep3.meds.l5', 'Cold, but not wrong. Entry is the hardest hour. I’ll keep it close.', 'calm')],
                },
              ],
            },
          },
          { goto: 'clash' },
        ],
      },

      // ---------- Burn now, or wait for Earth ----------
      clash: {
        title: 'Burn now or wait',
        set: 'capsule',
        cast: CREW,
        beats: [
          { sfx: 'radio' },
          s('nadia', 'ep3.clash.na1', 'Lantern, the guidance team wants six more hours of tracking before the burn home. Then the numbers will be good.', 'calm'),
          s('yusuf', 'ep3.clash.y1', 'Six hours of oxygen and water we don’t have. Burn now, by hand. The Sun, a star, a clock. I can do it.', 'determined'),
          s('lena', 'ep3.clash.l1', 'You are not flying for us. You are flying for your pride.', 'angry'),
          s('yusuf', 'ep3.clash.y2', 'Say that again.', 'angry'),
          s('lena', 'ep3.clash.l2', 'Your pride. And a seven-year-old who wants a hero. I can hear it in your voice.', 'angry'),
          { camera: 'two:yusuf,lena' },
          { wait: 1 },
          s('grace', 'ep3.clash.g1', 'Please. Commander. Decide. Please.', 'scared'),
          {
            choice: {
              id: 'ep3.clash.c1',
              key: true,
              timer: 15,
              timeout: 'wait',
              options: [
                {
                  id: 'pc2',
                  text: 'Nadia, give us rough numbers in two hours. We burn then.',
                  requires: 'trust.nadia >= 0',
                  lockedHint: 'Nadia doesn’t trust your judgement enough to rush the numbers for you.',
                  set: { burnEarly: true, burnPC2: true },
                  res: { o2: 4, power: -6 },
                  trust: { nadia: 1 },
                  beats: [
                    s('nadia', 'ep3.clash.na2', 'Two hours. We’ll have it. The computer flies the burn, Yusuf. I’m sorry.', 'determined'),
                    s('yusuf', 'ep3.clash.y3', 'The computer. Of course.', 'sad'),
                  ],
                },
                {
                  id: 'now',
                  text: 'Yusuf’s right. We burn now, by hand.',
                  set: { burnEarly: true, roughAim: true },
                  res: { o2: 8, water: 5 },
                  trust: { yusuf: 2, lena: -1, nadia: -1 },
                  remember: 'nadia',
                  beats: [
                    s('nadia', 'ep3.clash.na3', 'Lantern, I don’t concur. But it’s your ship. Good luck, Yusuf.', 'worried'),
                    n('ep3.clash.n1', 'Yusuf flies it with the Sun in one window and a star in the other. It’s close. Not perfect. Close.'),
                  ],
                },
                {
                  id: 'wait',
                  text: 'We wait for Control’s numbers.',
                  set: { waitedForGround: true },
                  res: { o2: -8, power: -5, co2: 10 },
                  trust: { yusuf: -2, lena: 1, nadia: 1 },
                  remember: 'yusuf',
                  beats: [s('yusuf', 'ep3.clash.y4', 'Six hours. Fine. I’ll just sit here. Being proud.', 'angry')],
                },
              ],
            },
          },
          {
            fact: {
              id: 'ep3.fact.pc2',
              title: 'PC+2: the burn after the far side',
              text: 'Two hours after its closest pass behind the Moon, Apollo 13 fired the lunar module’s descent engine for about five minutes. The burn cut the trip home from about 151 hours to about 142 and aimed the crew at the Pacific, where the recovery ships were waiting.',
              source: 'https://www.nasa.gov/missions/apollo/apollo-13-mission-details/',
            },
          },
          { goto: 'after' },
        ],
      },

      // ---------- The silence between them ----------
      after: {
        title: 'Silence between them',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep3.after.n1', 'The Moon shrinks behind you. Yusuf and Lena have not spoken in three hours.'),
          {
            explore: {
              id: 'ep3.after.explore',
              objective: 'The crew is falling apart. Talk to them. And Grace wants a look at the heat shield.',
              spawn: 'start',
              hint: 'Ibis’s docking camera can look back at Lantern.',
              exitWhen: 'flags.shieldSeen',
              items: [
                {
                  id: 'yusuf',
                  at: 'seat_yusuf',
                  label: 'Talk to Yusuf',
                  once: true,
                  set: { talkedYusuf3: true },
                  beats: [s('yusuf', 'ep3.after.y1', 'She’s not wrong. That’s what makes me angry. I want Salma to see me bring everyone home. Is that so bad?', 'sad')],
                },
                {
                  id: 'lena',
                  at: 'seat_lena',
                  label: 'Talk to Lena',
                  once: true,
                  set: { talkedLena3: true },
                  beats: [s('lena', 'ep3.after.l1', 'I said it to hurt him. Doctors aren’t supposed to do that. I am more frightened than I look, {you}.', 'sad')],
                },
                {
                  id: 'mend',
                  at: 'panel_center',
                  label: 'Get Yusuf and Lena to plan the last day together',
                  requires: 'flags.talkedYusuf3 && flags.talkedLena3',
                  once: true,
                  clue: true,
                  set: { crewMended: true },
                  beats: [
                    s('lena', 'ep3.after.l2', 'I was cruel. I’m sorry.', 'calm'),
                    s('yusuf', 'ep3.after.y2', 'You were right. I’m sorry too. Now: who flies, who counts, who holds the bag?', 'determined'),
                    { trust: { yusuf: 1, lena: 1 } },
                  ],
                },
                {
                  id: 'students',
                  at: 'panel_left',
                  label: 'Listen to the students’ messages',
                  once: true,
                  beats: [
                    s('omar', 'ep3.after.o1', 'Thousands of messages. Here’s one from Lagos: “Dear Grace, my mum says you are the clever one. Please fix the spaceship.”', 'happy'),
                    { anim: 'grace:look' },
                    { if: 'flags.farPhotos', then: [s('mariam', 'ep3.after.m1', 'And your far-side photos are on every screen in the world. Some teachers are using them right now.', 'happy')], else: [] },
                  ],
                },
                {
                  id: 'grace',
                  at: 'seat_grace',
                  label: 'Talk to Grace',
                  once: true,
                  beats: [
                    {
                      if: 'trust.grace >= 0',
                      then: [s('grace', 'ep3.after.g1', 'The explosion threw pieces everywhere. Some could have hit the heat shield. Ibis’s docking camera can see Lantern’s base. We should look.', 'worried')],
                      else: [s('grace', 'ep3.after.g2', 'Someone should look at the heat shield. With the camera. I mean, if you want.', 'sad')],
                    },
                  ],
                },
                {
                  id: 'shield',
                  at: 'camera',
                  label: 'Point the docking camera at Lantern’s heat shield',
                  once: true,
                  clue: true,
                  set: { shieldSeen: true },
                  beats: [
                    { res: { power: -2 } },
                    {
                      if: 'flags.hiresCamera',
                      then: [{ set: { shieldMapped: true } }, n('ep3.after.n2', 'Mariam’s camera turns. Every detail is sharp: a crack across the edge of the shield, and a patch the size of a hand where the surface is missing.')],
                      else: [n('ep3.after.n3', 'The docking camera is grainy. Something dark at the edge of the shield. A shadow? A hole? You can’t tell.')],
                    },
                  ],
                },
                { id: 'rest', at: 'seat_you', label: 'Call Kwame about the picture', exit: true },
              ],
            },
          },
          { goto: 'shield' },
        ],
      },

      // ---------- Cliffhanger: the heat shield ----------
      shield: {
        title: 'The heat shield',
        set: 'capsule',
        cast: CREW,
        beats: [
          { sfx: 'radio' },
          s('kwame', 'ep3.shield.k1', 'We’re looking at your picture. {you}... switch to the private loop.', 'worried'),
          {
            if: 'flags.shieldMapped',
            then: [s('kwame', 'ep3.shield.k2', 'A crack, and missing material on one edge. With this picture, I know exactly where. Maybe we can keep that edge out of the hottest air.', 'determined')],
            else: [s('kwame', 'ep3.shield.k3', 'Something is wrong at the edge. I can’t see how bad. I won’t guess. I won’t lie to you either.', 'worried')],
          },
          s('kwame', 'ep3.shield.k4', 'What do you tell your crew?', 'calm'),
          {
            choice: {
              id: 'ep3.shield.c1',
              key: true,
              timer: 12,
              timeout: 'nobody',
              options: [
                {
                  id: 'plan',
                  text: 'Everyone. With Kwame’s plan for the damaged edge.',
                  requires: 'flags.shieldMapped',
                  lockedHint: 'The picture is too blurry to make a plan.',
                  set: { crewKnowsShield: true, shieldPlan: true },
                  trust: { lena: 1, grace: 1, kwame: 1 },
                  beats: [s('grace', 'ep3.shield.g1', 'A damaged edge we can point away from the heat. That is a problem. Problems I can do.', 'determined')],
                },
                {
                  id: 'all',
                  text: 'Everyone. All of it.',
                  set: { crewKnowsShield: true },
                  trust: { lena: 1 },
                  beats: [s('yusuf', 'ep3.shield.y1', 'Okay. Okay. So we come home in a frying pan. My mother always said I’d end up in one.', 'worried')],
                },
                {
                  id: 'grace',
                  text: 'Only Grace. She can help plan.',
                  set: { graceKnowsShield: true },
                  trust: { grace: 1 },
                  beats: [s('grace', 'ep3.shield.g2', 'You trust me with this? After everything? Then I won’t let you down.', 'determined')],
                },
                {
                  id: 'nobody',
                  text: 'Nobody. Not yet.',
                  set: { hidShield: true },
                  beats: [{ if: 'flags.lenaPact', then: [{ set: { brokePact: true } }], else: [] }, n('ep3.shield.n1', 'You close the loop. Behind you, Lena watches your face. She saw something on it.')],
                },
              ],
            },
          },
          { camera: 'window' },
          n('ep3.shield.n2', 'Earth grows in the window, blue and close. In two days you will hit its air at 11 kilometres a second.'),
          s('kwame', 'ep3.shield.k5', 'One more thing. If it fails... no. Let’s talk about the entry tomorrow.', 'sad'),
          { sfx: 'silence' },
          { wait: 1.5 },
          { end: 'cliff', next: 'ep4' },
        ],
      },
    },
  });
})();
