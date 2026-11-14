// Episode 1 script: "Cold Morning" (see docs/STORY.md for the format and
// docs/STORY-BIBLE.md for the flowchart, flags and where each choice pays off).
// Detroit-style: most of each scene is an `explore` beat; key choices are few.
// Every text has a unique id; the Arabic lives in js/i18n/ar-story.js.
// `place` (scene field) says which anchor a cast member without an anchor of
// their own stands at; engines that place cast another way can ignore it.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.story = SMD.story || {};
  SMD.story.episodes = SMD.story.episodes || [];

  // Small builders: they return exactly the beat objects the spec describes.
  const n = (id, narrate) => ({ narrate, id });
  const s = (say, id, line, mood) => (mood ? { say, mood, line, id } : { say, line, id });
  const CREW = ['you', 'yusuf', 'lena', 'grace'];

  SMD.story.episodes.push({
    id: 'ep1',
    n: 1,
    title: 'Cold Morning',
    subtitle: 'The night before launch, the coldest the pad has ever seen.',
    start: 'cold_open',
    resources: { o2: 90, power: 100, water: 100, co2: 0, food: 100 },
    endings: {
      cliff: { id: 'ep1.end.cliff', title: 'A bang, and the master alarm', text: 'Day 3, 321,000 km from home. Something in the service module has just exploded. To be continued in Episode 2: Lifeboat.' },
    },
    scenes: {
      // ---------- Cold open: a flash-forward to the cliffhanger ----------
      cold_open: {
        title: 'Day 3',
        set: 'black',
        cast: [],
        beats: [
          { sfx: 'radio' },
          n('ep1.open.n1', 'Day 3. 321,000 kilometres from home.'),
          s('yusuf', 'ep1.open.y1', 'Control, Lantern. We have a—', 'scared'),
          { sfx: 'bang' },
          { sfx: 'alarm' },
          { wait: 1.5 },
          { sfx: 'silence' },
          { wait: 1 },
          n('ep1.open.n2', 'Three days earlier.'),
          { goto: 'trade' },
        ],
      },

      // ---------- The design trade: one item fits, not two ----------
      trade: {
        title: 'The last 40 kilograms',
        set: 'briefing',
        cast: ['you', 'kwame', 'mariam', 'lena'],
        place: { mariam: 'screen', lena: 'table' },
        beats: [
          { camera: 'wide' },
          n('ep1.trade.n1', '18:00, the evening before launch. The last loading list for Lantern, your capsule.'),
          {
            explore: {
              id: 'ep1.trade.explore',
              objective: 'Find out what could fill the last 40 kilograms, then sign the loading list.',
              spawn: 'start',
              hint: 'Kwame is by the model. Mariam is at the screen, Lena at the table.',
              exitWhen: 'true',
              items: [
                {
                  id: 'model',
                  at: 'model',
                  label: 'Look at the spacecraft model',
                  once: true,
                  clue: true,
                  set: { sawTankLayout: true },
                  beats: [
                    n('ep1.trade.n2', 'Lantern sits on its service module. Ibis, a small habitat built for two people near the Moon, is docked to its nose.'),
                    n('ep1.trade.n3', 'All the big oxygen tanks are in the service module, outside the cabin. If one of them fails, it takes its neighbours with it.'),
                  ],
                },
                {
                  id: 'kwame',
                  at: 'kwame',
                  label: 'Talk to Kwame',
                  once: true,
                  beats: [
                    s('kwame', 'ep1.trade.k1', 'Forty kilograms of margin left. One item fits. Not two. You choose.', 'calm'),
                    s('kwame', 'ep1.trade.k2', 'My vote: an extra oxygen tank inside the cabin. A tank outside can fail. One inside can’t be blown away.', 'determined'),
                  ],
                },
                {
                  id: 'mariam',
                  at: 'screen',
                  label: 'Talk to Mariam',
                  once: true,
                  beats: [s('mariam', 'ep1.trade.m1', 'The high-resolution camera. The far side in detail no human eye has seen. And it can turn round and look at our own ship.', 'happy')],
                },
                {
                  id: 'lena',
                  at: 'table',
                  label: 'Talk to Lena',
                  once: true,
                  beats: [s('lena', 'ep1.trade.l1', 'Spare CO2 cartridges. A closed room fills with your own breath faster than people think. I have seen it.', 'calm')],
                },
                { id: 'leave', at: 'door', label: 'Sign the loading list', exit: true },
              ],
            },
          },
          {
            choice: {
              id: 'ep1.trade.c1',
              key: true,
              options: [
                {
                  id: 'o2',
                  text: 'The extra oxygen tank.',
                  set: { extraO2: true },
                  res: { o2: 10 },
                  trust: { kwame: 1 },
                  beats: [s('mariam', 'ep1.trade.m2', 'Then the far side waits for the next crew. I don’t like it. I understand it.', 'sad')],
                },
                {
                  id: 'camera',
                  text: 'The high-resolution camera.',
                  set: { hiresCamera: true },
                  trust: { mariam: 1 },
                  beats: [s('kwame', 'ep1.trade.k3', 'Science over air. I hope we never wish it the other way round.', 'worried')],
                },
                {
                  id: 'co2',
                  text: 'The spare CO2 cartridges.',
                  set: { spareCartridges: true },
                  trust: { lena: 1 },
                  beats: [s('kwame', 'ep1.trade.k4', 'Small, cheap, boring. Boring is good. Lena wins.', 'calm')],
                },
              ],
            },
          },
          s('lena', 'ep1.trade.l2', 'Every kilogram is a decision, Commander. You will make many more.', 'calm'),
          { goto: 'pad_night' },
        ],
      },

      // ---------- The pad at midnight: Grace's tank, Kwame's seals ----------
      pad_night: {
        title: 'Midnight at the pad',
        set: 'pad',
        cast: ['you', 'kwame', 'grace'],
        place: { grace: 'umbilical' },
        beats: [
          { camera: 'wide' },
          n('ep1.pad.n1', '23:40. The forecast for dawn is -2 °C. No rocket from this pad has ever flown colder than 11 °C.'),
          {
            explore: {
              id: 'ep1.pad.explore',
              objective: 'Walk the pad before the one o’clock meeting. Kwame is worried. So is Grace.',
              spawn: 'start',
              hint: 'The pad console has the seal data. Grace is at the oxygen umbilical.',
              exitWhen: 'flags.readSealData',
              items: [
                {
                  id: 'ice',
                  at: 'tower',
                  label: 'Look at the ice',
                  once: true,
                  set: { sawIce: true },
                  beats: [n('ep1.pad.n2', 'Icicles as long as your arm hang from the tower. The crews left water running so the pipes wouldn’t freeze. They froze anyway.')],
                },
                {
                  id: 'grace',
                  at: 'umbilical',
                  label: 'Talk to Grace',
                  once: true,
                  set: { heardTankTwo: true },
                  beats: [
                    s('grace', 'ep1.pad.g1', 'Commander. Sorry, it’s late. It’s tank two again.', 'worried'),
                    s('grace', 'ep1.pad.g2', 'In the ground test it wouldn’t drain, so the team boiled the oxygen out with the tank’s own heaters. Eight hours.', 'calm'),
                    s('grace', 'ep1.pad.g3', 'Every reading came back normal. I signed it off. I just... keep thinking about it.', 'worried'),
                  ],
                },
                {
                  id: 'tanklog',
                  at: 'van',
                  label: 'Read tank two’s test log',
                  requires: 'flags.heardTankTwo',
                  once: true,
                  clue: true,
                  set: { readTankLog: true },
                  beats: [
                    n('ep1.pad.n3', 'Eight hours of heaters. The tank temperature sits flat at 27 °C, the very top of the gauge, the whole time.'),
                    n('ep1.pad.n4', 'A flat line at the top of a scale doesn’t mean 27 degrees. It means 27 degrees or more. Nobody can tell how much more.'),
                  ],
                },
                {
                  id: 'seals',
                  at: 'console',
                  label: 'Read the seal data',
                  once: true,
                  clue: true,
                  set: { readSealData: true },
                  beats: [n('ep1.pad.n5', 'A chart of every booster joint that came back damaged, against the air temperature at launch. Damage at warm launches, damage at cool ones. It looks random.')],
                },
                {
                  id: 'kwame',
                  at: 'kwame',
                  label: 'Talk to Kwame',
                  once: true,
                  beats: [
                    s('kwame', 'ep1.pad.k1', 'The booster joints have rubber seals as thick as a pencil. When the motor lights, they must spring into the gap in a fraction of a second.', 'calm'),
                    s('kwame', 'ep1.pad.k2', 'Cold rubber is slow. At -2 I don’t know if it springs at all. We have never tested it this cold.', 'worried'),
                    { if: 'flags.readSealData', then: [s('kwame', 'ep1.pad.k3', 'You saw the chart. It looks random. I don’t like that it looks random.', 'worried')], else: [] },
                  ],
                },
                {
                  id: 'folder',
                  at: 'kwame',
                  label: 'Ask for the flights without damage',
                  requires: 'flags.readSealData',
                  once: true,
                  clue: true,
                  set: { sawAllData: true },
                  beats: [
                    s('kwame', 'ep1.pad.k4', 'That is exactly the right question. Here. Every flight with clean seals was warm. Every cold one came back scorched.', 'determined'),
                    n('ep1.pad.n6', 'With every flight on one chart, the pattern is impossible to miss.'),
                  ],
                },
                { id: 'leave', at: 'door', label: 'Go to the meeting', exit: true },
              ],
            },
          },
          {
            if: 'flags.heardTankTwo',
            then: [
              { camera: 'close:grace' },
              s('grace', 'ep1.pad.g4', 'Commander, wait. Tank two. What do I do?', 'worried'),
              {
                choice: {
                  id: 'ep1.pad.c1',
                  key: true,
                  timer: 12,
                  timeout: 'fine',
                  options: [
                    {
                      id: 'flag',
                      text: 'The gauge was stuck at its top for eight hours. Flag it to Nadia.',
                      requires: 'flags.readTankLog',
                      lockedHint: 'You never read tank two’s test log.',
                      set: { tankFlagged: true },
                      trust: { grace: 2 },
                      remember: 'grace',
                      beats: [
                        s('grace', 'ep1.pad.g5', 'You saw it too. A flat line at the top. I’ll write it up and send it to Nadia tonight.', 'determined'),
                        n('ep1.pad.n7', 'By morning the tank passes a pressure check, and the flag goes into the record. Nobody upstairs reads it in time.'),
                      ],
                    },
                    {
                      id: 'recheck',
                      text: 'Pull the data again. All of it. Tonight.',
                      set: { tankRechecked: true, graceTired: true },
                      trust: { grace: 1 },
                      beats: [s('grace', 'ep1.pad.g6', 'Thank you. I’ll wake the team. Sleep is overrated.', 'happy'), n('ep1.pad.n8', 'Grace will not sleep tonight. She will fly tired.')],
                    },
                    {
                      id: 'fine',
                      text: 'If the readings were normal, it’s fine. Get some sleep.',
                      beats: [s('grace', 'ep1.pad.g7', 'Okay. Okay. You’re right.', 'calm'), n('ep1.pad.n9', 'She doesn’t move for a long time.')],
                    },
                  ],
                },
              },
            ],
            else: [n('ep1.pad.n10', 'Over by the umbilical, Grace watches you walk to the meeting. She had wanted to ask you something.'), { set: { graceUnheard: true } }],
          },
          { goto: 'meeting' },
        ],
      },

      // ---------- 01:10, mission control: Go or No-Go ----------
      meeting: {
        title: 'Go or No-Go',
        set: 'control',
        cast: ['you', 'nadia', 'kwame', 'tarek', 'aiko', 'omar'],
        beats: [
          { camera: 'wide' },
          n('ep1.meet.n1', '01:10. Mission control. The coffee is cold. So is everything else.'),
          {
            explore: {
              id: 'ep1.meet.explore',
              objective: 'Talk to the team before the vote. Take your seat when you are ready.',
              spawn: 'start',
              hint: 'Your console is waiting.',
              exitWhen: 'true',
              items: [
                {
                  id: 'tarek',
                  at: 'tarek',
                  label: 'Talk to Tarek',
                  once: true,
                  beats: [
                    s('tarek', 'ep1.meet.t1', 'Above 11 degrees is two days away. Every day on the pad costs two million, and the budget hearing is Thursday.', 'worried'),
                    s('tarek', 'ep1.meet.t2', 'Programs die in hearings, {you}. Four thousand jobs die with them. I’m not the villain here. I’m the one who counts.', 'determined'),
                  ],
                },
                {
                  id: 'aiko',
                  at: 'aiko',
                  label: 'Talk to Aiko',
                  once: true,
                  beats: [s('aiko', 'ep1.meet.a1', 'Two million students are logged in. Schools opened their gyms at dawn. If we scrub, I have to tell them why, in a way they believe.', 'worried')],
                },
                {
                  id: 'omar',
                  at: 'omar',
                  label: 'Talk to Omar',
                  once: true,
                  beats: [s('omar', 'ep1.meet.o1', 'The weather balloon says -2 at the pad at dawn. I checked it three times. Is that bad? Kwame’s face says it’s bad.', 'worried')],
                },
                {
                  id: 'weather',
                  at: 'bigscreen',
                  label: 'Look at the forecast',
                  once: true,
                  beats: [n('ep1.meet.n2', 'Dawn: -2 °C. Saturday: 12 °C. Two days of waiting, in one line on a screen.')],
                },
                { id: 'coffee', at: 'coffee', label: 'Pour a coffee', once: true, beats: [n('ep1.meet.n3', 'Cold. Of course it is.')] },
                { id: 'sit', at: 'console', label: 'Take your seat', exit: true },
              ],
            },
          },
          s('nadia', 'ep1.meet.na1', 'Kwame has a concern. Kwame.', 'calm'),
          s('kwame', 'ep1.meet.k1', 'Our coldest launch was 11 degrees, and its seals came back scorched. Tomorrow will be -2. I recommend we wait until the air is above 11.', 'worried'),
          { if: 'flags.sawAllData', then: [s('kwame', 'ep1.meet.k2', 'The commander has seen the full chart. Every cold flight was damaged. Every one.', 'determined')], else: [] },
          s('tarek', 'ep1.meet.t3', 'Kwame. Take off your engineer’s hat for one minute. Put on your manager’s hat.', 'calm'),
          s('kwame', 'ep1.meet.k3', 'My hat stays on, Tarek.', 'determined'),
          s('nadia', 'ep1.meet.na2', 'Enough. {you}, it is your crew. I want your call. Go, or no-go?', 'determined'),
          { camera: 'close:you' },
          {
            choice: {
              id: 'ep1.meet.c2',
              key: true,
              timer: 15,
              timeout: 'silent',
              options: [
                {
                  id: 'data',
                  text: 'Put every flight on the big screen. Then decide.',
                  requires: 'flags.sawAllData',
                  lockedHint: 'You never asked Kwame for the flights without damage.',
                  set: { delayed: true, dataWon: true },
                  trust: { kwame: 2, nadia: 1 },
                  beats: [
                    n('ep1.meet.n4', 'Kwame puts the full chart on the big screen. Warm flights: clean. Cold flights: scorched. Nobody needs it explained.'),
                    s('tarek', 'ep1.meet.t4', 'All right. I’ll tell the hearing we read our own data. That is a sentence I can defend.', 'calm'),
                    s('nadia', 'ep1.meet.na3', 'No-go. We scrub. Good work, both of you.', 'calm'),
                  ],
                  goto: 'scrub_day',
                },
                {
                  id: 'nogo',
                  text: 'No-go. We wait for warm air.',
                  set: { delayed: true },
                  trust: { kwame: 2, tarek: -1, nadia: 1 },
                  remember: 'tarek',
                  beats: [s('nadia', 'ep1.meet.na4', 'Copy, no-go. We scrub. Tarek, I’m sorry. Write the hearing speech with me.', 'calm')],
                  goto: 'scrub_day',
                },
                {
                  id: 'go',
                  text: 'Go. We fly at dawn.',
                  set: { launchedCold: true },
                  trust: { kwame: -2, tarek: 1 },
                  remember: 'kwame',
                  beats: [s('nadia', 'ep1.meet.na5', 'Copy, Go. Kwame, your concern is in the log. Thank you for raising it.', 'calm')],
                  goto: 'go_morning',
                },
                {
                  id: 'silent',
                  text: '[Say nothing]',
                  set: { launchedCold: true, saidNothing: true },
                  trust: { nadia: -1, kwame: -1 },
                  remember: 'nadia',
                  beats: [
                    { wait: 1.5 },
                    s('nadia', 'ep1.meet.na6', 'Silence on my loop is a Go. We fly at dawn.', 'determined'),
                    n('ep1.meet.n5', 'Nobody says anything else. The decision was made by nobody, which means it was made by you.'),
                  ],
                  goto: 'go_morning',
                },
              ],
            },
          },
        ],
      },

      // ---------- Branch: the scrub ----------
      scrub_day: {
        title: 'Two days late',
        set: 'control',
        cast: ['you', 'kwame', 'tarek', 'aiko', 'omar'],
        beats: [
          n('ep1.scrub.n1', 'The launch slips two days. On Saturday morning the air at the pad is 12 °C.'),
          {
            explore: {
              id: 'ep1.scrub.explore',
              objective: 'Launch day, at last. See the team before suit-up.',
              spawn: 'start',
              hint: 'The door to suit-up is open.',
              exitWhen: 'true',
              items: [
                {
                  id: 'tarek',
                  at: 'tarek',
                  label: 'Talk to Tarek',
                  once: true,
                  beats: [
                    {
                      if: 'flags.dataWon',
                      then: [s('tarek', 'ep1.scrub.t1', 'I showed the hearing Kwame’s chart. Half of them nodded. The other half asked about the money. That counts as a win.', 'calm')],
                      else: [s('tarek', 'ep1.scrub.t2', 'The hearing was brutal. “Another delay, another four million.” Not one of them asked about the seals.', 'angry')],
                    },
                  ],
                },
                {
                  id: 'kwame',
                  at: 'kwame',
                  label: 'Talk to Kwame',
                  once: true,
                  set: { sealsReplaced: true },
                  beats: [s('kwame', 'ep1.scrub.k1', 'We used the time. New seals on both boosters, kept warm overnight. Thank you, {you}.', 'calm')],
                },
                {
                  id: 'omar',
                  at: 'omar',
                  label: 'Talk to Omar',
                  once: true,
                  beats: [s('omar', 'ep1.scrub.o1', 'A girl in Aswan sent a drawing. It’s you, the rocket and a giant thermometer. She gave the thermometer a sad face.', 'happy')],
                },
                {
                  id: 'aiko',
                  at: 'aiko',
                  label: 'Talk to Aiko',
                  once: true,
                  set: { publicHonest: true },
                  beats: [s('aiko', 'ep1.scrub.a1', 'I told the schools the truth: the seals were never tested that cold, so we waited. They liked that better than any countdown.', 'happy')],
                },
                { id: 'leave', at: 'door', label: 'Go to suit-up', exit: true },
              ],
            },
          },
          { goto: 'crew_room' },
        ],
      },

      // ---------- Branch: the cold dawn ----------
      go_morning: {
        title: 'Ice on the tower',
        set: 'pad',
        cast: ['you', 'kwame', 'lena'],
        place: { lena: 'arm' },
        beats: [
          { camera: 'wide' },
          n('ep1.go.n1', 'Dawn. -2 °C. One last walk on the pad before suit-up. The ice team is knocking icicles off the tower.'),
          {
            explore: {
              id: 'ep1.go.explore',
              objective: 'One last look at the pad. The van to suit-up leaves soon.',
              spawn: 'start',
              hint: 'The van is waiting.',
              exitWhen: 'true',
              items: [
                {
                  id: 'kwame',
                  at: 'kwame',
                  label: 'Talk to Kwame',
                  once: true,
                  beats: [s('kwame', 'ep1.go.k1', 'I hope I’m wrong. I have never wanted to be wrong so much.', 'sad'), { anim: 'kwame:sad' }],
                },
                {
                  id: 'lena',
                  at: 'arm',
                  label: 'Talk to Lena',
                  once: true,
                  beats: [s('lena', 'ep1.go.l1', 'If this were a patient, I would wait for the fever to break. But it is not my patient. It is yours.', 'calm')],
                },
                {
                  id: 'ice',
                  at: 'tower',
                  label: 'Look at the ice',
                  once: true,
                  beats: [n('ep1.go.n2', 'Ice on the steps, ice on the rails, ice on the booster’s skin. The sun is up, and none of it is melting.')],
                },
                { id: 'leave', at: 'van', label: 'Ride to suit-up', exit: true },
              ],
            },
          },
          { goto: 'crew_room' },
        ],
      },

      // ---------- Suit-up: who do you sit with? ----------
      crew_room: {
        title: 'Suit-up',
        set: 'briefing',
        cast: CREW,
        place: { yusuf: 'table', lena: 'screen', grace: 'model' },
        beats: [
          { camera: 'wide' },
          n('ep1.crew.n1', 'The suit-up room. Ninety minutes to hatch close. Everyone deals with it differently.'),
          {
            explore: {
              id: 'ep1.crew.explore',
              objective: 'Ninety minutes to hatch close. Spend them with your crew.',
              spawn: 'start',
              hint: 'When you are ready, the door leads to the rocket.',
              exitWhen: 'true',
              items: [
                {
                  id: 'yusuf',
                  at: 'table',
                  label: 'Sit with Yusuf',
                  once: true,
                  set: { metSalma: true },
                  beats: [
                    s('yusuf', 'ep1.crew.y1', 'Salma says if I don’t bring her a Moon rock, I can’t come home. I told her we don’t land. She doesn’t care.', 'happy'),
                    s('yusuf', 'ep1.crew.y2', 'Salma, habibti, say hello to the Commander.', 'happy'),
                    n('ep1.crew.n2', 'A seven-year-old’s face fills the tablet. “You’re the boss? Then bring him back, okay? Promise.”'),
                    s('yusuf', 'ep1.crew.y3', 'She thinks I’m brave. Don’t tell her I hate the countdown.', 'calm'),
                  ],
                },
                {
                  id: 'lena',
                  at: 'screen',
                  label: 'Sit with Lena',
                  once: true,
                  set: { lenaPact: true },
                  beats: [
                    s('lena', 'ep1.crew.l1', 'I worked in a field hospital once. The worst thing was never the bad news. It was people hiding it.', 'calm'),
                    s('lena', 'ep1.crew.l2', 'So promise me. Whatever happens up there, I get the real numbers.', 'determined'),
                    n('ep1.crew.n3', 'She holds your eyes until you nod.'),
                  ],
                },
                {
                  id: 'grace',
                  at: 'model',
                  label: 'Sit with Grace',
                  once: true,
                  set: { graceConfided: true },
                  beats: [
                    s('grace', 'ep1.crew.g1', 'I count things when I’m scared. Bolts. Breaths. Switches. Forty-two bolts on that wall.', 'calm'),
                    {
                      if: 'flags.tankFlagged || flags.tankRechecked',
                      then: [s('grace', 'ep1.crew.g2', 'You listened to me about tank two. Whatever happens, thank you for that.', 'calm')],
                      else: [s('grace', 'ep1.crew.g3', 'I keep seeing those readings from tank two. Normal, normal, normal. Why does normal scare me?', 'worried')],
                    },
                  ],
                },
                { id: 'leave', at: 'door', label: 'Walk to the rocket', exit: true },
              ],
            },
          },
          s('yusuf', 'ep1.crew.y4', 'Yalla. Let’s go and light a very large candle.', 'determined'),
          { goto: 'launch' },
        ],
      },

      // ---------- Launch ----------
      launch: {
        title: 'Liftoff',
        set: 'capsule',
        cast: CREW,
        beats: [
          { camera: 'wide' },
          n('ep1.launch.n1', 'Hatch closed. Four people on their backs, 98 metres above the ground.'),
          { sfx: 'radio' },
          s('nadia', 'ep1.launch.na1', 'Lantern, Control. All stations report Go. It’s your day.', 'calm'),
          n('ep1.launch.n2', 'Ten. Nine. Eight. Main engines start. Three. Two. One.'),
          { sfx: 'bang' },
          n('ep1.launch.n3', 'Booster ignition. Liftoff.'),
          {
            if: 'flags.launchedCold',
            then: [
              n('ep1.launch.n4', 'At the base of the left booster, a puff of grey smoke. Then another, darker one. Nobody in the cabin can see it.'),
              { wait: 1 },
              s('kwame', 'ep1.launch.k1', 'Nadia. Camera six. Did you see that?', 'scared'),
              s('nadia', 'ep1.launch.na2', 'I saw it. Pressures are good. Stay on your console, Kwame.', 'calm'),
              n('ep1.launch.n5', 'Something in the joint plugs the gap. The pressures stay normal. Only much later will anyone understand how lucky that was.'),
              { set: { smokeAtIgnition: true } },
            ],
            else: [n('ep1.launch.n6', 'The boosters burn clean. In the control room, Kwame breathes out for the first time in two days.')],
          },
          s('yusuf', 'ep1.launch.y1', 'Max-Q! She’s shaking, but she’s happy! Come on, old lady!', 'happy'),
          n('ep1.launch.n7', 'Two minutes: the boosters fall away. Eight minutes: silence, and everything not strapped down begins to float.'),
          { anim: 'yusuf:celebrate' },
          {
            fact: {
              id: 'ep1.fact.challenger',
              title: 'Challenger, 28 January 1986',
              text: 'The air at launch was 2 °C (36 °F), 15 degrees colder than any shuttle launch before. The night before, engineers at the booster maker said not to launch below 12 °C (53 °F), the coldest launch they had data for. Managers asked them to reconsider, and one was told to “take off his engineering hat and put on his management hat.” They reversed. A cold seal in the right booster leaked, and 73 seconds after liftoff Challenger broke apart. All seven crew were lost, including teacher Christa McAuliffe, while students watched live. The investigation found the decision process was flawed: the charts looked only at flights with damage, which hid how clearly cold was the problem.',
              source: 'https://www.nasa.gov/history/rogersrep/v1ch5.htm',
            },
          },
          n('ep1.launch.n8', 'Three hours later the upper stage fires again, and Lantern leaves Earth behind.'),
          { camera: 'window' },
          { goto: 'day_three' },
        ],
      },

      // ---------- Day 3: the stir ----------
      day_three: {
        title: 'Day 3',
        set: 'capsule',
        cast: CREW,
        beats: [
          n('ep1.day3.n1', 'Day 3. 55 hours and 54 minutes into the flight. 321,000 kilometres from Earth.'),
          {
            explore: {
              id: 'ep1.day3.explore',
              objective: 'Float through the cabin and finish the evening checks.',
              spawn: 'start',
              hint: 'The evening checklist is on the centre panel.',
              exitWhen: 'true',
              items: [
                {
                  id: 'window',
                  at: 'window',
                  label: 'Look at Earth',
                  once: true,
                  beats: [n('ep1.day3.n2', 'Earth is a blue marble you can cover with your thumb. Everyone you have ever met is behind your thumb.')],
                },
                {
                  id: 'camera',
                  at: 'camera',
                  label: 'Answer the students',
                  once: true,
                  beats: [
                    s('omar', 'ep1.day3.o1', 'Lantern, Omar here, from Control. A class in Khartoum asks: what is the hardest thing about space?', 'happy'),
                    n('ep1.day3.n3', 'You tell them: every kilogram. Everything on board, somebody chose to bring, and somebody chose to leave behind.'),
                    s('omar', 'ep1.day3.o2', 'Every kilogram! I’m putting that on a poster.', 'happy'),
                    s('aiko', 'ep1.day3.a1', 'Lovely. Two of the big networks cut away halfway. Apparently flying to the Moon is boring now.', 'happy'),
                  ],
                },
                {
                  id: 'yusuf',
                  at: 'seat_yusuf',
                  label: 'Talk to Yusuf',
                  once: true,
                  beats: [
                    s('yusuf', 'ep1.day3.y1', 'On the far side I’m flying her by hand for a bit. Just for the photos.', 'happy'),
                    s('lena', 'ep1.day3.l1', 'The computer flies better than you.', 'calm'),
                    s('yusuf', 'ep1.day3.y2', 'The computer doesn’t have a daughter watching.', 'determined'),
                    s('lena', 'ep1.day3.l2', 'Neither does the Moon.', 'calm'),
                  ],
                },
                {
                  id: 'grace',
                  at: 'seat_grace',
                  label: 'Talk to Grace',
                  once: true,
                  beats: [s('grace', 'ep1.day3.g1', 'Tank two’s pressure is jumping again. Up, down, up. Probably the gauge. Probably.', 'worried')],
                },
                {
                  id: 'trace',
                  at: 'panel_right',
                  label: 'Read tank two’s pressure trace',
                  once: true,
                  clue: true,
                  set: { sawPressureJump: true },
                  beats: [n('ep1.day3.n4', 'The pressure in tank two jumps in sharp spikes. Too sharp for a lazy gauge. As if something inside is changing fast.')],
                },
                { id: 'checks', at: 'panel_center', label: 'Start the evening checklist', exit: true },
              ],
            },
          },
          { sfx: 'radio' },
          s('nadia', 'ep1.day3.na1', 'Lantern, Control. One more job before you sleep: please stir the oxygen tanks.', 'calm'),
          n('ep1.day3.n5', 'A routine job. Small fans inside the tanks mix the super-cold oxygen so the gauges read true. You have done it a dozen times.'),
          {
            choice: {
              id: 'ep1.stir.c1',
              key: true,
              timer: 8,
              timeout: 'grace',
              options: [
                { id: 'you', text: 'I’ll flip it myself.', set: { stirredByYou: true } },
                { id: 'grace', text: 'Grace, it’s your system.', set: { stirredByGrace: true } },
                { id: 'yusuf', text: 'Yusuf, you’re closest.', set: { stirredByYusuf: true } },
                {
                  id: 'hold',
                  text: 'Hold the stir. Tank two’s trace looks wrong.',
                  requires: 'flags.sawPressureJump',
                  lockedHint: 'You never looked at tank two’s pressure trace.',
                  set: { stirHeld: true },
                  trust: { grace: 1 },
                  beats: [
                    s('nadia', 'ep1.day3.na2', 'Copy, Lantern. We’ll skip it and look at the trace in the morning.', 'calm'),
                    n('ep1.day3.n6', 'Two hours later, tank two’s heaters switch themselves on, the way they were built to. Nobody’s hand is on the switch.'),
                  ],
                },
              ],
            },
          },
          { if: '!flags.stirHeld', then: [n('ep1.day3.n7', 'A click. The fans spin up inside tank two.')], else: [] },
          { wait: 2 },
          { sfx: 'bang' },
          { anim: 'yusuf:look' },
          { sfx: 'alarm' },
          n('ep1.day3.n8', 'A bang. The whole capsule shudders. The master alarm screams.'),
          { camera: 'window' },
          n('ep1.day3.n9', 'Outside the window, a cloud of glittering crystals drifts away from the ship. It is oxygen. Your oxygen.'),
          { camera: 'close:grace' },
          s('grace', 'ep1.day3.g2', 'Main bus B undervolt. Tank two reads zero. Zero.', 'scared'),
          s('yusuf', 'ep1.day3.y3', 'Control, Lantern. We have had a problem.', 'scared'),
          {
            choice: {
              id: 'ep1.end.c1',
              key: true,
              timer: 6,
              timeout: 'quiet',
              options: [
                { id: 'calm', text: 'Hands off the switches. Everyone talk to me.', set: { calmFirst: true }, trust: { grace: 1 } },
                { id: 'hatch', text: 'Close the hatch to Ibis! Now!', set: { hatchFirst: true }, trust: { yusuf: 1 } },
                { id: 'quiet', text: '[Say nothing]' },
              ],
            },
          },
          { sfx: 'silence' },
          { wait: 1 },
          {
            fact: {
              id: 'ep1.fact.tank',
              title: 'Apollo 13’s oxygen tank, 1970',
              text: 'Before launch, Apollo 13’s oxygen tank 2 would not drain, so it was emptied by running its heaters for hours. Their thermostat switches were built for 28 volts but met 65 volts of ground power, welded shut and let the inside reach about 540 °C. The gauge only read up to 27 °C (80 °F), so nobody saw it. 56 hours into the flight, a routine “cryo stir” sparked the damaged wires, and the tank exploded.',
              source: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/ap13acc.html',
            },
          },
          { end: 'cliff', next: 'ep2' },
        ],
      },
    },
  });
})();
