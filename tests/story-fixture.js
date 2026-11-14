// A small two-episode story that uses every beat type, for the engine tests
// and for looking at the story player before the real episodes exist.
// Node: require('./story-fixture.js'). Browser (tools/shot.mjs scripts):
// load it with a <script> tag, then SMD.go('story').
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.story = SMD.story || {};
  SMD.story.episodes = SMD.story.episodes || [];
  const list = SMD.story.episodes;
  const add = (ep) => {
    const i = list.findIndex((e) => e.id === ep.id);
    if (i >= 0) list.splice(i, 1);
    list.push(ep);
  };

  add({
    id: 'fx1',
    n: 1,
    title: 'Cold Morning',
    subtitle: 'The night before launch, the pad is colder than it has ever been.',
    start: 'pad_night',
    resources: { o2: 90, power: 100, water: 100, co2: 0, food: 100 },
    endings: {
      cliff: { title: 'Day 3', text: 'A bang. The master alarm. Somewhere behind the panels, something has gone very wrong.' },
    },
    scenes: {
      pad_night: {
        set: 'pad',
        cast: ['you', 'kwame'],
        beats: [
          { narrate: 'The coldest morning ever recorded at the pad: minus 4 degrees.', id: 'fx1.pad.n1' },
          { camera: 'two:you,kwame' },
          { say: 'kwame', mood: 'worried', line: 'The seals were never tested this cold, {you}.', id: 'fx1.pad.k1' },
          {
            choice: {
              id: 'fx1.pad.c1',
              timer: 8,
              timeout: 'quiet',
              options: [
                { id: 'ask', text: 'How sure are you?', trust: { kwame: 1 } },
                { id: 'push', text: 'We fly tomorrow. Make it work.', trust: { kwame: -1 }, remember: 'kwame', set: { pushedKwame: true } },
                { id: 'quiet', text: '[Say nothing]' },
              ],
            },
          },
          { if: 'flags.pushedKwame', then: [{ say: 'kwame', mood: 'angry', line: 'Then I want it on the record that I said no.', id: 'fx1.pad.k2' }], else: [{ say: 'kwame', mood: 'calm', line: 'Give me until the sun is up. I will know more.', id: 'fx1.pad.k3' }] },
          { anim: 'you:look' },
          { fact: { id: 'fx1.fact.challenger', title: 'Challenger, 28 January 1986', text: 'Engineers warned that the booster O-rings had never flown that cold. The launch went ahead and the seal failed 73 seconds after liftoff.', source: 'https://www.nasa.gov/challenger-sts-51l/' } },
          { goto: 'control' },
        ],
      },
      control: {
        set: 'control',
        cast: ['you', 'nadia', 'tarek', 'aiko'],
        beats: [
          { say: 'nadia', mood: 'determined', line: 'I need a Go or a No Go from you, Commander.', id: 'fx1.ctl.n1' },
          { say: 'tarek', mood: 'worried', line: 'A delay costs us the hearing in Congress.', id: 'fx1.ctl.t1' },
          { say: 'aiko', mood: 'happy', line: 'Two million students are watching live.', id: 'fx1.ctl.a1' },
          {
            choice: {
              id: 'fx1.ctl.go',
              options: [
                { id: 'go', text: 'We are Go.', set: { launchedCold: true }, trust: { tarek: 1, kwame: -1 } },
                { id: 'wait', text: 'We wait for the sun.', trust: { kwame: 2, tarek: -1 }, remember: ['kwame', 'tarek'], beats: [{ say: 'tarek', mood: 'angry', line: 'Then you explain it to them.', id: 'fx1.ctl.t2' }] },
              ],
            },
          },
          {
            choice: {
              id: 'fx1.ctl.pack',
              timer: 10,
              options: [
                { id: 'o2', text: 'The extra oxygen tank', set: { extraO2: true }, res: { o2: 10 } },
                { id: 'co2', text: 'Spare CO2 cartridges', set: { spareCO2: true } },
                { id: 'cam', text: 'The high-resolution camera', set: { camera: true }, trust: { aiko: 1 } },
              ],
            },
          },
          { goto: 'launch' },
        ],
      },
      launch: {
        set: 'capsule',
        cast: ['you', 'yusuf', 'lena', 'grace'],
        beats: [
          { narrate: 'Day 3. Halfway to the Moon.', id: 'fx1.cap.n1' },
          { say: 'yusuf', mood: 'happy', line: 'Smoothest ride of my life. Tell the air force I said so.', id: 'fx1.cap.y1' },
          { sfx: 'bang' },
          { sfx: 'alarm', camera: 'wide' },
          { res: { o2: -20, power: -15 } },
          { say: 'grace', mood: 'scared', line: 'Main bus B undervolt. Oxygen tank two reads zero.', id: 'fx1.cap.g1' },
          { end: 'cliff' },
          { next: 'fx2' },
        ],
      },
    },
  });

  add({
    id: 'fx2',
    n: 2,
    title: 'Lifeboat',
    subtitle: 'Four people, one small cabin, and the air is running out.',
    start: 'cabin',
    scenes: {
      cabin: {
        set: 'capsule',
        cast: ['you', 'yusuf', 'lena', 'grace'],
        beats: [
          { if: "choice['fx1.ctl.go'] == 'go' && res.o2 < 80", then: [{ say: 'lena', mood: 'sad', line: 'We launched cold. Maybe this is why.', id: 'fx2.cab.l1' }] },
          { say: 'lena', mood: 'calm', line: 'Carbon dioxide is climbing. We have hours, not days.', id: 'fx2.cab.l2' },
          { survival: 'ep2.co2', win: 'fixed', lose: 'headache' },
        ],
      },
      fixed: {
        set: 'capsule',
        cast: ['you', 'grace'],
        beats: [
          { say: 'grace', mood: 'happy', line: 'It is holding. The square peg fits the round hole.', id: 'fx2.fix.g1' },
          { trust: { grace: 1 } },
          { anim: 'grace:celebrate' },
          { goto: 'behind' },
        ],
      },
      headache: {
        set: 'capsule',
        cast: ['you', 'lena'],
        beats: [{ say: 'lena', mood: 'worried', line: 'Headaches first. Then mistakes.', id: 'fx2.hd.l1' }, { res: { co2: 15 } }, { goto: 'behind' }],
      },
      behind: {
        set: 'space',
        cast: [],
        beats: [{ narrate: 'Loss of signal. Behind the Moon, nobody can hear you.', id: 'fx2.los.n1' }, { sfx: 'radio' }, { end: 'los' }],
      },
    },
  });
})();
