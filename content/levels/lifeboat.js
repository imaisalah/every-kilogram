// Last Light, Chapter 1: "Lifeboat" (docs/LASTLIGHT.md, beat sheet in
// docs/LASTLIGHT-SCRIPT.md). Set: the connected zero-g interior (capsule
// Lantern, the docking tunnel, the habitat Ibis).
//
// The prologue's cargo (flags.cargo: 'o2' | 'co2' | 'cam') pays off here:
//   o2  -> the extra tank: +30 % oxygen and a slower drain all chapter.
//   co2 -> spare cartridges: lower, slower CO2 and a shorter adapter recipe.
//   cam -> the photo of the damage (collectible) and a +220 Ah battery
//          budget from the ground, so the cabin lights can stay on.
// Text: English with an explicit key -> 'll.<key>' in js/i18n/ar-ll.js.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.llLevels = SMD.llLevels || [];
  // The kit is defined in content/levels/prologue.js; read it at run time.
  const K = () => SMD.llKit;

  // ---------- Numbers (real ratios: see docs/LASTLIGHT-SCRIPT.md) ----------
  // Breakers: the same names and amps the panels and displays show
  // (js/ll/sets/interior-screens.js). Listed in the order the waypoint goes:
  // Ibis's panel first, so you end in Lantern, next to your cargo.
  const POWER = {
    capacityAh: 1000, // usable lifeboat battery
    photoBonusAh: 220, // what the ground can trust once it has seen the damage
    hoursHome: 77,
    coreAmps: 8, // life support + radio: can't be switched off
    seconds: 70, // real seconds to get the draw down
    breakers: [
      { at: 'breaker_5', id: 'lights', name: 'Ibis lights', amps: 4.6 },
      { at: 'breaker_6', id: 'habheat', name: 'Ibis heaters', amps: 12.5 },
      { at: 'breaker_7', id: 'cryo', name: 'Cryo fans', amps: 5.3 },
      { at: 'breaker_8', id: 'probe', name: 'Probe heaters', amps: 7.9 },
      { at: 'breaker_1', id: 'heaters', name: 'Cabin heaters', amps: 9.2 },
      { at: 'breaker_2', id: 'displays', name: 'Displays', amps: 6.4 },
      { at: 'breaker_3', id: 'fans', name: 'Air fan', amps: 3.1, essential: true },
      { at: 'breaker_4', id: 'guidance', name: 'Guidance computer', amps: 11.8 },
    ],
  };
  // Per second toward bad (js/ll/logic.js): o2 falls, co2 rises.
  const RATES = {
    vent: 1.2, // o2 while the valve is open
    o2: 0.04, // o2 after the valve, four people breathing
    o2Tank: 0.025, // ... with the extra tank plumbed in
    co2: 0.08, // mmHg/s in Ibis before the adapter
    co2Spare: 0.045, // ... with the spare cartridges in Ibis's socket
    truth: 0.85, // the crew that knows the numbers moves slow and breathes slow
    scrub: -0.35, // the adapter working
  };
  const VALVE_SECONDS = 45;

  const COLLECTIBLES = [
    {
      id: 'problem',
      titleKey: 'll.c.problem.title',
      textKey: 'll.c.problem.text',
      at: 'panel_center',
      section: 'jolt',
      title: '“We’ve had a problem”',
      text: 'At 55 hours, 55 minutes and 20 seconds into Apollo 13’s flight, Jack Swigert called the ground: “Okay, Houston… we’ve had a problem here.” Asked to say it again, Jim Lovell answered: “Ah, Houston, we’ve had a problem.” Nobody yet knew that an oxygen tank had exploded.',
      source: { title: 'Apollo Flight Journal: Day 3, part 2, “Houston, we’ve had a problem”', url: 'https://apollojournals.org/afj/ap13fj/08day3-problem.html' },
    },
    {
      id: 'venting',
      titleKey: 'll.c.venting.title',
      textKey: 'll.c.venting.text',
      at: 'window',
      section: 'jolt',
      title: 'Something outside the window',
      text: 'Fourteen minutes after the bang, Lovell looked out of a window and saw a cloud of gas around the ship. “We are venting something out into the… into space,” he told Houston. It was their oxygen.',
      source: { title: 'Apollo Flight Journal: Day 3, part 2', url: 'https://apollojournals.org/afj/ap13fj/08day3-problem.html' },
    },
    {
      id: 'damage',
      titleKey: 'll.c.damage.title',
      textKey: 'll.c.damage.text',
      at: 'window',
      section: 'valve',
      cargo: 'cam',
      title: 'A whole panel, gone',
      text: 'Apollo 13’s crew only saw the damage at the very end, when they let the service module go before entry. Their photos showed a whole outer panel blown away and wreckage trailing from the bay where oxygen tank 2 had been.',
      source: { title: 'NASA: Damaged Apollo 13 service module, 17 April 1970', url: 'https://www.nasa.gov/image-article/damaged-apollo-13-service-module-april-17-1970' },
    },
    {
      id: 'powerdown',
      titleKey: 'll.c.powerdown.title',
      textKey: 'll.c.powerdown.text',
      at: 'panel_left',
      section: 'powerdown',
      title: 'Every amp',
      text: 'To make the lunar module’s batteries last until Earth, the ground cut its power item by item: biomedical telemetry, a radio amplifier that drew 2.57 amps, the steerable antenna. The flight director’s minimum power-down was about 17 amps.',
      source: { title: 'Apollo Flight Journal: Day 3, part 5, Minimising Power', url: 'https://apollojournals.org/afj/ap13fj/11day3-minimise-power.html' },
    },
    {
      id: 'aquarius',
      titleKey: 'll.c.aquarius.title',
      textKey: 'll.c.aquarius.text',
      at: 'tunnel_a',
      section: 'abandon',
      title: 'A lifeboat for two',
      text: 'Apollo 13’s lunar module, Aquarius, was built to keep two men alive for less than two days on the Moon. After the explosion it kept three men alive for about four days on the way home, while the command module slept to save its batteries for entry.',
      source: { title: 'Apollo Flight Journal: Day 3, part 3, Aquarius becomes a lifeboat', url: 'https://apollojournals.org/afj/ap13fj/09day3-lifeboat.html' },
    },
    {
      id: 'mailbox',
      titleKey: 'll.c.mailbox.title',
      textKey: 'll.c.mailbox.text',
      at: 'hab_bench',
      section: 'craft',
      title: 'The mailbox',
      text: 'The lunar module’s carbon dioxide filters were sized for two men. The command module had plenty, but they were square and the socket was round. Engineers on the ground built an adapter from what the crew had: plastic bags, suit hoses, a cardboard cue card and grey tape, then read it up step by step. It became known as the “mailbox”.',
      source: { title: 'Apollo Flight Journal: Day 4, part 4, Building the CO2 adapter', url: 'https://apollojournals.org/afj/ap13fj/15day4-mailbox.html' },
    },
    {
      id: 'cold',
      titleKey: 'll.c.cold.title',
      textKey: 'll.c.cold.text',
      at: 'hab_window',
      section: 'cold',
      title: 'Three degrees',
      text: 'With the heaters off, Apollo 13’s cabin fell to about 38 °F (3 °C) and water ran down the walls. The crew cut their water to 6 ounces (about 180 ml) each per day, a fifth of normal, and lost 31.5 pounds (14 kg) between them.',
      source: { title: 'NASA: Apollo 13 mission details', url: 'https://www.nasa.gov/missions/apollo/apollo-13-mission-details/' },
    },
    {
      id: 'record',
      titleKey: 'll.c.record.title',
      textKey: 'll.c.record.text',
      at: null,
      section: 'los',
      title: 'Farther than anyone',
      text: 'Swinging around the far side, Apollo 13 reached 400,171 km (248,655 miles) from Earth on 15 April 1970: the farthest humans had ever been. The record stood until Artemis II’s crew flew around the Moon in April 2026.',
      source: { title: 'Scientific American: Artemis II astronauts break Apollo’s distance record', url: 'https://www.scientificamerican.com/article/nasas-artemis-ii-astronauts-break-apollos-distance-record' },
    },
  ];

  // The adapter: the director's recipe co2adapter (js/ll/logic.js) is
  // cartridge, hose, bag, tape, cover, sock. Lena's spare cartridges come
  // with a fitted collar: no cover, no sock.
  const ADAPTER = { recipe: 'co2adapter', skipWithSpares: ['cover', 'sock'] };
  // Where the parts are, in the order the waypoint leads you.
  const PARTS = [
    { at: 'hab_lockers', items: ['bag', 'tape'], extra: ['food'] },
    { at: 'locker_8', items: ['sock'], extra: ['water'], joke: true },
    { at: 'locker_4', items: ['cartridge'], stuck: true },
    { at: 'locker_5', items: ['hose'] },
    { at: 'locker_6', items: ['cover'] },
  ];
  const EXTRA_LOCKERS = [
    { at: 'locker_7', items: ['water'] },
    { at: 'locker_9', items: ['food'] },
    { at: 'locker_10', items: ['flashlight'] },
  ];

  const hours = (amps, ah) => Math.round((ah / amps) * 10) / 10;
  // The CO2 gauge and displays follow the meter while it matters.
  let gaugeRun = null;
  const followCO2 = (L, k) => {
    if (!L.scene || typeof L.scene.setCO2 !== 'function') return;
    const me = (gaugeRun = {});
    const step = () => {
      if (me !== gaugeRun) return;
      k.set(L, 'setCO2', Math.min(1, (L.res.co2 || 0) / 30));
      L.wait(1).then(step, () => {});
    };
    step();
  };
  const co2Rate = (L) => {
    const base = L.flags.cargo === 'co2' ? RATES.co2Spare : RATES.co2;
    return Math.round(base * (L.flags.toldTruth ? RATES.truth : 1) * 1000) / 1000;
  };
  const o2Rate = (L) => (L.flags.cargo === 'o2' ? RATES.o2Tank : RATES.o2);

  SMD.llLevels.push({
    id: 'lifeboat',
    n: 1,
    title: 'Lifeboat',
    titleKey: 'll.lb.title',
    set: 'capsule',
    minutes: 9,
    collectibles: COLLECTIBLES,
    numbers: { POWER, RATES, VALVE_SECONDS, ADAPTER },
    sections: [
      // ---------- 1. The jolt ----------
      {
        id: 'jolt',
        purpose: 'The bang: grab the handhold (QTE), the master alarm, look out at the venting oxygen.',
        run: async (L) => {
          const k = K();
          // Started from the chapter list without the prologue: Kwame's pick.
          if (!['o2', 'co2', 'cam'].includes(L.flags.cargo)) {
            L.flags.cargo = 'o2';
            L.flags.extraO2 = true;
          }
          L.gravity('zeroG');
          L.alarm(true);
          L.power(0.45);
          L.music('action');
          k.cast(L, 'yusuf', 'seat_yusuf');
          k.cast(L, 'lena', 'seat_lena');
          k.cast(L, 'grace', 'panel_right');
          L.sfx('bang');
          L.shake(0.9, 2.5);
          await L.fadeIn(0.4);
          const grabbed = await k.qte(L, 'press', 'lb.jolt.q', 'Grab the handhold!', { time: 2.5 });
          if (!grabbed) {
            L.shake(1, 1.2);
            L.sfx('thud');
            L.res.health = Math.max(0, (L.res.health || 100) - 15);
            await k.say(L, 'lena', 'lb.jolt.l1', 'Got you. Hold on to something!', 'scared');
          } else {
            await k.say(L, 'yusuf', 'lb.jolt.y1', 'Nice grab, boss.', 'scared');
          }
          k.title(L, 'lb.title', 'Lifeboat', 'lb.sub', 'Day 3. 55 hours, 55 minutes.');
          await k.radio(L, 'yusuf', 'lb.jolt.y2', 'Control, Lantern. We’ve had a problem.', 'scared');
          await k.say(L, 'grace', 'lb.jolt.g1', 'Tank two reads zero. Tank one is falling!', 'scared');
          k.find(L, 'panel_center', 'lb.jolt.i.log', 'Read the flight log', 'problem');
          k.obj(L, 'lb.jolt.obj', 'Look out the window', 'window');
          await L.reach('window', 1.6);
          L.sfx('vent');
          await k.windowShot(L, 'vent_cloud', 'window', 3.5, 0.15);
          L.collectible('venting');
          await k.say(L, 'yusuf', 'lb.jolt.y3', 'We’re venting something. Into space.', 'scared');
          await k.say(L, 'lena', 'lb.jolt.l2', 'That’s our oxygen.', 'calm');
        },
      },

      // ---------- 2. The valve (Grace's freeze: timed choice 1) ----------
      {
        id: 'valve',
        purpose: 'Oxygen venting on a clock: choose how to handle Grace, then turn the frozen valve wheel. Camera: photograph the damage.',
        run: async (L) => {
          const k = K();
          L.meters(['o2']);
          k.drain(L, { o2: RATES.vent });
          const clock = k.timer(L, VALVE_SECONDS, 'lb.valve.timer', 'Oxygen venting', 'o2');
          k.obj(L, 'lb.valve.obj', 'Close the valve', 'valve');
          await k.radio(L, 'nadia', 'lb.valve.n1', 'Lantern, close the reactant valve. Now.', 'determined');
          L.anim('grace', 'freeze');
          if (L.flags.stirBy === 'grace') await k.say(L, 'grace', 'lb.valve.g1', 'I flipped the switch. My tank. I flipped it.', 'scared');
          else if (L.flags.stirBy === 'hold') await k.say(L, 'grace', 'lb.valve.g2', 'Nobody touched it. It just went.', 'scared');
          else await k.say(L, 'grace', 'lb.valve.g3', 'It’s tank two. I signed it off.', 'scared');
          const g = await k.choose(
            L,
            'grace',
            [k.opt('need', 'lb.valve.c.need', 'Grace. I need you. Read me tank one.'), k.opt('take', 'lb.valve.c.take', 'Yusuf, take her panel.')],
            8,
            'need',
          );
          if (g === 'need') {
            L.flags.graceSteady = true;
            k.line(L, 'grace', 'lb.valve.g4', 'Tank one, three hundred psi. Falling. I’m here.', 'determined');
          } else {
            L.flags.graceBenched = true;
            k.walk(L, 'grace', 'seat_grace');
            k.walk(L, 'yusuf', 'panel_right');
            k.line(L, 'yusuf', 'lb.valve.y1', 'Got it. Move over, Grace.', 'determined');
          }
          await L.reach('valve', 1.4);
          let turned = false;
          for (let tries = 0; !turned; tries++) {
            turned = await k.qte(L, 'turn', 'lb.valve.q', 'Turn the wheel!', { turns: 2, time: 7 });
            if (!turned) {
              L.sfx('creak');
              if (tries === 0) await k.say(L, 'yusuf', 'lb.valve.y2', 'It’s frozen stiff! Again!', 'scared');
              else await k.say(L, 'lena', 'lb.valve.l1', 'Both hands. Brace your feet. Turn!', 'determined');
            }
          }
          k.stop(clock);
          k.set(L, 'setValve', 1);
          L.sfx('valve');
          k.drain(L, { o2: o2Rate(L) });
          L.music('tension');
          await k.say(L, 'grace', 'lb.valve.g5', 'Venting’s slowing… It’s holding.', 'calm');

          if (L.flags.cargo === 'cam') {
            await k.radio(L, 'kwame', 'lb.valve.k1', 'If only we could see the damage.', 'worried');
            await k.radio(L, 'mariam', 'lb.valve.m1', 'You can! The camera! Point it out the window!', 'determined');
            k.obj(L, 'lb.valve.obj2', 'Get the camera from its locker', 'locker_3');
            await L.loot('locker_3', ['camera']);
            k.obj(L, 'lb.valve.obj3', 'Photograph the damage', 'window');
            await k.act(L, 'window', 'lb.valve.i.photo', 'Take the photo');
            L.sfx('click');
            await k.windowShot(L, 'damage_photo', 'window', 3, 0.15);
            L.collectible('damage');
            L.flags.photoSent = true;
            await k.radio(L, 'kwame', 'lb.valve.k2', 'Got it. A whole panel is gone. Now we know.', 'calm');
            await k.radio(L, 'kwame', 'lb.valve.k3', 'And now I can trust your batteries. That helps.', 'calm');
          } else {
            await k.radio(L, 'kwame', 'lb.valve.k4', 'We can’t see the damage. We plan for the worst.', 'worried');
          }
        },
      },

      // ---------- 3. Power-down: flip breakers against the clock ----------
      {
        id: 'powerdown',
        purpose: 'Float from breaker to breaker cutting amps until the wrist projection reaches 77 hours; one breaker is a trap.',
        run: async (L) => {
          const k = K();
          const ah = POWER.capacityAh + (L.flags.photoSent ? POWER.photoBonusAh : 0);
          let amps = Math.round((POWER.coreAmps + POWER.breakers.reduce((s, b) => s + b.amps, 0)) * 10) / 10;
          const need = POWER.hoursHome;
          const show = () => {
            const h = hours(amps, ah);
            L.res.power = Math.max(1, Math.min(100, Math.round((100 * h) / need)));
            k.hint(L, 'lb.power.wrist', 'Wrist: {a} A. Battery lasts {h} h. Home: {need} h.', { a: amps, h, need }, true);
            return h;
          };
          L.meters(['o2', 'power']);
          k.obj(L, 'lb.power.obj', 'Flip breakers off until the battery lasts home', POWER.breakers[0].at);
          k.find(L, 'panel_left', 'lb.power.i.card', 'Read the power checklist', 'powerdown');
          const clock = k.timer(L, POWER.seconds, 'lb.power.timer', 'Battery', 'power');
          let h = show();
          const left = POWER.breakers.slice();
          L.flags.breakers = [];
          const flips = k.events(
            L,
            POWER.breakers.map((b) => [b.at, 'lb.power.i.' + b.id, b.name + ': {a} A', b, { a: b.amps }]),
          );
          // Talk while floating: the switches are live from the first word.
          k.radio(L, 'nadia', 'lb.power.n1', 'Lantern is dying. Cut power or you won’t get home.', 'determined');
          if (L.flags.photoSent) k.radio(L, 'kwame', 'lb.power.k1', 'Thanks to your photo: get under sixteen amps.', 'calm');
          else k.radio(L, 'kwame', 'lb.power.k2', 'Every amp counts. Get the draw under thirteen.', 'calm');
          k.line(L, 'yusuf', 'lb.power.y0', 'Ibis panel first. Then we shut Lantern behind us.', 'determined');
          while (h < need && left.length) {
            // The photo's extra margin lets the lights stay on: don't point at them.
            const next = left.find((b) => !b.essential && !(L.flags.photoSent && b.id === 'lights'));
            L.waypoint(next ? next.at : null);
            const pick = await flips.next();
            left.splice(left.indexOf(pick), 1);
            if (pick.essential) {
              L.sfx('wrong');
              await k.say(L, 'lena', 'lb.power.l1', 'Not the fans! No fans, no air.', 'angry');
              continue;
            }
            L.sfx('breaker');
            k.set(L, 'setBreaker', Number(pick.at.replace('breaker_', '')), false);
            amps = Math.round((amps - pick.amps) * 10) / 10;
            L.flags.breakers.push(pick.id);
            L.power(Math.max(0.3, 0.45 - 0.02 * L.flags.breakers.length));
            if (pick.id === 'habheat') k.line(L, 'lena', 'lb.power.l2', 'It’ll get cold. Cold we can survive.', 'calm');
            if (pick.id === 'guidance') k.line(L, 'yusuf', 'lb.power.y1', 'Bye, computer. I’ll steer by the stars.', 'worried');
            h = show();
          }
          flips.cancel();
          k.stop(clock);
          L.flags.lightsOn = !L.flags.breakers.includes('lights');
          if (!L.flags.lightsOn) L.power(0.18);
          L.alarm(false);
          L.music('quiet');
          await k.radio(L, 'nadia', 'lb.power.n2', 'We copy your numbers. You just bought a way home.', 'calm');
          k.shot(L, 'quiet_cabin', 'yusuf', 3.5);
          await k.say(L, 'yusuf', 'lb.power.y2', 'Quiet. I don’t like quiet.', 'worried');
          await k.say(L, 'lena', 'lb.power.l3', 'Get used to it.', 'calm');
        },
      },

      // ---------- 4. Abandon Lantern: medkit, your cargo, the tunnel ----------
      {
        id: 'abandon',
        purpose: 'Move into Ibis: take the medkit and the cargo you chose, float through the dark tunnel.',
        run: async (L) => {
          const k = K();
          L.meters(['o2']);
          if (L.flags.cargo === 'cam') k.obj(L, 'lb.ab.obj2', 'Float through the tunnel to Ibis', 'tunnel_b');
          k.radio(L, 'nadia', 'lb.ab.n1', 'Move into Ibis. Take what you need.', 'calm');
          if (L.flags.cargo === 'o2') {
            k.obj(L, 'lb.ab.obj.o2', 'Unstrap your oxygen tank', 'locker_1');
            await L.loot('locker_1', ['o2tank']);
            await k.radio(L, 'kwame', 'lb.ab.k1', 'The tank you chose. Hours nobody has to invent.', 'calm');
          } else if (L.flags.cargo === 'co2') {
            k.obj(L, 'lb.ab.obj.co2', 'Take the spare cartridges', 'locker_2');
            await L.loot('locker_2', ['spare_cartridges']);
            await k.say(L, 'lena', 'lb.ab.l2', 'My cartridges. They fit Ibis. A whole day.', 'calm');
          } else {
            await k.radio(L, 'mariam', 'lb.ab.m1', 'Keep that camera safe. The far side needs it.', 'calm');
          }
          k.walk(L, 'yusuf', 'hab_window', 1.6);
          k.walk(L, 'lena', 'hab_bench', 1.6);
          k.walk(L, 'grace', 'breaker_7', 1.6);
          k.find(L, 'tunnel_a', 'lb.ab.i.plate', 'Read Ibis’s data plate', 'aquarius');
          k.obj(L, 'lb.ab.obj2', 'Float through the tunnel to Ibis', 'tunnel_b');
          await k.say(L, 'yusuf', 'lb.ab.y1', 'Ibis was built for two people. Two days.', 'worried');
          await k.say(L, 'lena', 'lb.ab.l3', 'We are four.', 'calm');
          await k.say(L, 'yusuf', 'lb.ab.y2', 'And home is four days away. I can count.', 'worried');
          await L.reach('tunnel_b', 1.8);
          if (L.flags.cargo === 'co2') L.take('spare_cartridges', 1); // into Ibis's socket
          if (L.flags.cargo === 'o2') {
            L.sfx('hiss');
            L.res.o2 = Math.min(100, (L.res.o2 || 0) + 30);
            L.take('o2tank', 1);
            k.drain(L, { o2: RATES.o2Tank });
            await k.say(L, 'grace', 'lb.ab.g1', 'Tank’s on the line. Oxygen climbing.', 'calm');
          }
          k.obj(L, 'lb.ab.obj1', 'Take the medkit', 'medkit');
          k.line(L, 'lena', 'lb.ab.l1', 'Medkit’s on the wall behind you. Bring it.', 'calm');
          await k.act(L, 'medkit', 'lb.ab.i.medkit', 'Take the medkit');
          L.sfx('pickup');
          L.give('medkit', 1);
        },
      },

      // ---------- 5. The real numbers (timed choice 2, the big one) ----------
      {
        id: 'numbers',
        purpose: 'Put on the headset: Kwame gives you the real numbers on a private loop; tell the crew everything, soften it, or say nothing.',
        run: async (L) => {
          const k = K();
          k.cast(L, 'yusuf', 'hab_window');
          k.cast(L, 'lena', 'hab_bench');
          k.cast(L, 'grace', 'breaker_7');
          k.obj(L, 'lb.num.obj', 'Put on the headset', 'hab_lockers');
          await k.radio(L, 'kwame', 'lb.num.k1', '{you}, private loop. Just you.', 'calm');
          await k.act(L, 'hab_lockers', 'lb.num.i.headset', 'Put on the headset');
          L.sfx('radio');
          if (L.flags.held) await k.radio(L, 'kwame', 'lb.num.k2', 'You backed me at the pad. So, straight:', 'calm');
          else if (L.flags.launchedCold) await k.radio(L, 'kwame', 'lb.num.k3', 'I keep asking if it was the cold. Later. Straight:', 'worried');
          await k.radio(L, 'kwame', 'lb.num.k4', 'Water runs out five hours before entry.', 'worried');
          // The crew pretends not to listen.
          await k.shot(L, 'ibis_faces', 'lena', 2.5);
          await k.radio(L, 'kwame', 'lb.num.k5', 'Ibis scrubs air for two. You are four.', 'worried');
          if (L.flags.cargo === 'co2') await k.radio(L, 'kwame', 'lb.num.k6', 'Lena’s spares buy a day. Not four.', 'calm');
          const pick = await k.choose(
            L,
            'numbers',
            [
              k.opt('all', 'lb.num.c.all', 'Tell them everything. Every number.'),
              k.opt('soft', 'lb.num.c.soft', 'Tell them it’s tight.'),
              k.opt('later', 'lb.num.c.later', 'Not now. Let them work.'),
            ],
            12,
            'later',
            true,
          );
          if (pick === 'all') {
            L.flags.toldTruth = true;
            await k.say(L, 'lena', 'lb.num.l1', 'Thank you. Now we can plan.', 'calm');
            await k.say(L, 'yusuf', 'lb.num.y1', 'Five hours short. So we drive faster.', 'worried');
            await k.say(L, 'lena', 'lb.num.l2', 'Move slow. Breathe slow. Every breath is CO2.', 'calm');
          } else if (pick === 'soft') {
            L.flags.softened = true;
            await k.say(L, 'yusuf', 'lb.num.y2', 'Tight. I can do tight.', 'happy');
            await k.say(L, 'lena', 'lb.num.l3', 'Tight is a word, not a number.', 'calm');
          } else {
            L.flags.hidNumbers = true;
            L.anim('grace', 'count');
            await k.say(L, 'grace', 'lb.num.g1', 'Water… battery… CO2… Oh.', 'worried');
            L.look('lena', 'player');
          }
        },
      },

      // ---------- 6. Scavenge: the adapter parts in both modules ----------
      {
        id: 'scavenge',
        purpose: 'CO2 rising: search lockers in Ibis and cold, dark Lantern for the adapter parts; mash to free a frozen locker.',
        run: async (L) => {
          const k = K();
          L.meters(['o2', 'co2']);
          if (L.flags.cargo === 'co2') L.res.co2 = Math.max(0, (L.res.co2 || 2) - 1);
          else L.res.co2 = Math.max(L.res.co2 || 0, 6);
          k.drain(L, { o2: o2Rate(L), co2: co2Rate(L) });
          followCO2(L, k);
          L.onLow('co2', 15, () => {
            if (L.flags.hidNumbers) k.line(L, 'lena', 'lb.sc.l1', 'Headaches. You knew this was coming.', 'angry');
            else k.line(L, 'lena', 'lb.sc.l2', 'Headaches. That’s the CO2. Move slower.', 'worried');
          });
          L.onLow('o2', 25, () => k.line(L, 'lena', 'lb.sc.l3', 'Oxygen’s low. Small breaths, everyone.', 'worried'));
          const spare = L.flags.cargo === 'co2';
          const parts = PARTS.filter((p) => !(spare && p.items.every((i) => ADAPTER.skipWithSpares.includes(i))));
          k.obj(L, 'lb.sc.obj', 'Find the adapter parts ({n}/{m})', parts[0].at, { n: 0, m: parts.length });
          EXTRA_LOCKERS.forEach((x) => k.extraLoot(L, x.at, x.items));
          // Talk while the player floats to the first locker (queued lines).
          k.radio(L, 'kwame', 'lb.sc.k1', 'Ibis takes round cartridges. Lantern’s are square.', 'calm');
          k.radio(L, 'kwame', 'lb.sc.k2', 'So we build an adapter. From what you have.', 'determined');
          if (spare) k.line(L, 'lena', 'lb.sc.l4', 'My spares came with a collar. Fewer parts.', 'calm');
          else if (L.flags.graceSteady) k.line(L, 'grace', 'lb.sc.g1', 'Bag, hose, tape, cover, sock, cartridge. I’ll build it.', 'determined');
          else k.line(L, 'yusuf', 'lb.sc.y1', 'A sock? Sounds like my first car.', 'happy');
          for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (i) k.obj(L, 'lb.sc.obj', 'Find the adapter parts ({n}/{m})', p.at, { n: i, m: parts.length });
            if (p.stuck) {
              await k.act(L, p.at, 'lb.sc.i.stuck', 'Open the locker');
              L.sfx('clank');
              await k.say(L, 'yusuf', 'lb.sc.y2', 'Frozen shut. Give it everything.', 'determined');
              let ok = false;
              while (!ok) ok = await k.qte(L, 'mash', 'lb.sc.q', 'Pull!', { count: 10, time: 5 });
              L.sfx('locker');
              k.set(L, 'openLocker', p.at, 1);
              p.items.forEach((id) => L.give(id, 1));
              await k.say(L, 'grace', 'lb.sc.g2', 'Square cartridge. Ugly. Perfect.', 'happy');
            } else {
              await L.loot(p.at, p.items.concat(p.extra || []));
              if (p.joke) await k.say(L, 'yusuf', 'lb.sc.y3', 'That’s my sock. It’s clean. Mostly.', 'happy');
            }
          }
          k.obj(L, 'lb.sc.obj', 'Find the adapter parts ({n}/{m})', null, { n: parts.length, m: parts.length });
        },
      },

      // ---------- 7. Build the mailbox ----------
      {
        id: 'craft',
        purpose: 'At the bench, put the adapter together in the right order while the CO2 gauge climbs past 15 mmHg.',
        run: async (L) => {
          const k = K();
          L.meters(['o2', 'co2']);
          k.drain(L, { o2: o2Rate(L), co2: co2Rate(L) });
          followCO2(L, k);
          k.obj(L, 'lb.cr.obj', 'Build the adapter at the bench', 'hab_bench');
          await L.reach('hab_bench', 1.6);
          if (L.flags.graceSteady) await k.say(L, 'grace', 'lb.cr.g1', 'I’ve got the steps. Hand me the parts.', 'determined');
          else {
            await k.say(L, 'grace', 'lb.cr.g2', 'Can I… help? Please.', 'sad');
            L.flags.graceBenched = false;
            L.flags.graceBack = true;
          }
          await k.radio(L, 'kwame', 'lb.cr.k1', 'Cartridge first. Then the hose. Slowly.', 'calm');
          const skip = L.flags.cargo === 'co2' ? ADAPTER.skipWithSpares : [];
          // Stepping away from the bench is allowed; the CO2 keeps climbing.
          while (!(await L.craft(ADAPTER.recipe, { skip }))) {
            k.obj(L, 'lb.cr.obj2', 'Back to the bench. Finish the adapter', 'hab_bench');
            await L.reach('hab_bench', 1.6);
          }
          L.flags.adapterBuilt = true;
          L.sfx('success');
          k.drain(L, { o2: o2Rate(L), co2: RATES.scrub });
          L.collectible('mailbox');
          await k.radio(L, 'yusuf', 'lb.cr.y1', 'Control, the ugliest box in the solar system works.', 'happy');
          if (L.flags.graceBack) await k.say(L, 'grace', 'lb.cr.g3', 'You let me back in. Thank you.', 'calm');
          else await k.say(L, 'grace', 'lb.cr.g4', 'Something I touched today works.', 'happy');
          await k.radio(L, 'kwame', 'lb.cr.k2', 'CO2 falling. They’re cheering in here.', 'happy');
        },
      },

      // ---------- 8. The cold (timed choice 3: Salma) ----------
      {
        id: 'cold',
        purpose: 'Relief and heart: the cabin at 4 °C, wipe the frost off the window, Yusuf asks to call his daughter.',
        run: async (L) => {
          const k = K();
          L.meters(['o2', 'co2', 'power']);
          L.music('sad');
          k.set(L, 'setFrost', 0.85);
          k.obj(L, 'lb.cold.obj', 'Wipe the frost off the window', 'hab_window');
          await k.say(L, 'lena', 'lb.cold.l1', 'Four degrees. Water on every wall.', 'calm');
          if (L.flags.lightsOn) k.line(L, 'yusuf', 'lb.cold.y0', 'At least your photo kept the lights on.', 'happy');
          await k.act(L, 'hab_window', 'lb.cold.i.wipe', 'Wipe the window');
          L.sfx('creak');
          k.set(L, 'setFrost', 0.2);
          await k.windowShot(L, 'earth_far', 'hab_window', 3.5);
          L.collectible('cold');
          k.walk(L, 'yusuf', 'hab_window');
          await k.say(L, 'yusuf', 'lb.cold.y1', 'Boss. Salma will have seen the news.', 'worried');
          await k.say(L, 'yusuf', 'lb.cold.y2', 'One minute. I know it costs power.', 'worried');
          const pick = await k.choose(
            L,
            'salma',
            [k.opt('call', 'lb.cold.c.call', 'Sixty seconds. Call her.'), k.opt('no', 'lb.cold.c.no', 'We can’t spare the power.')],
            10,
            'no',
          );
          if (pick === 'call') {
            L.flags.salmaCall = true;
            L.res.power = Math.max(1, (L.res.power || 100) - 3);
            L.music('hope');
            await k.say(L, 'yusuf', 'lb.cold.y3', 'Habibti. Yes, it’s Baba. A little scared. You?', 'calm');
            await k.say(L, 'yusuf', 'lb.cold.y4', 'Be brave for Mama. I’ll bring the Moon rock.', 'calm');
            k.shot(L, 'yusuf_window', 'yusuf', 3);
            await L.wait(2);
          } else {
            L.flags.salmaNo = true;
            await k.say(L, 'yusuf', 'lb.cold.y5', 'Okay. You’re right. Okay.', 'sad');
            L.look('yusuf', 'hab_window');
            await L.wait(1.5);
          }
          await k.say(L, 'grace', 'lb.cold.g1', 'I count stars when I can’t sleep. Lots tonight.', 'calm');
        },
      },

      // ---------- 9. Loss of signal ----------
      {
        id: 'los',
        purpose: 'The Moon fills the window; the radio goes silent mid-warning about the Sun. Cliffhanger.',
        run: async (L) => {
          const k = K();
          L.music('wonder');
          k.obj(L, 'lb.los.obj', 'Watch the Moon come up', 'hab_window');
          await L.reach('hab_window', 1.8);
          k.set(L, 'windowView', 'approach');
          await k.windowShot(L, 'moon_fill', 'hab_window', 4);
          await k.radio(L, 'nadia', 'lb.los.n1', 'Two minutes to loss of signal. We’ll keep a light on.', 'calm');
          await k.radio(L, 'mariam', 'lb.los.m1', 'Lantern, Mariam! A spot on the Sun just doubled!', 'scared');
          await k.radio(L, 'mariam', 'lb.los.m2', 'If it flares, you have to—', 'scared');
          L.sfx('static');
          L.music('dread');
          k.set(L, 'windowView', 'farside');
          await k.windowShot(L, 'earth_sets', 'hab_window', 3);
          await k.say(L, 'lena', 'lb.los.l1', 'Have to what?', 'scared');
          if (L.flags.salmaCall) await k.say(L, 'yusuf', 'lb.los.y1', 'Salma would say: Baba, don’t panic.', 'worried');
          else await k.say(L, 'yusuf', 'lb.los.y2', 'Then we figure it out ourselves. Yalla.', 'worried');
          L.collectible('record');
          await L.wait(1);
          await L.fadeOut();
          await k.title(L, 'lb.end', 'Loss of signal', 'lb.end.sub', 'To be continued in Chapter 2: Far Side.');
          L.end(null);
        },
      },
    ],
  });
})();
