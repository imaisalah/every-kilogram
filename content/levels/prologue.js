// Last Light, Prologue: "Cold Morning" (docs/LASTLIGHT.md, beat sheet in
// docs/LASTLIGHT-SCRIPT.md). Set: pad, then the capsule for launch and day 3.
//
// Every visible string is passed in English with an explicit key:
// { id: '<key>' } -> 'll.<key>' in js/i18n/ar-ll.js (the director's textKey),
// and { params: { you, ... } } so {you} is the player's name in any language.
//
// SMD.llKit (defined here, used by content/levels/lifeboat.js at run time)
// keeps every director call the levels make in one place.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.llLevels = SMD.llLevels || [];

  // ---------------------------------------------------------------------
  // The writers' kit (js/ll/director.js signatures)
  // ---------------------------------------------------------------------
  const kit = (SMD.llKit = SMD.llKit || {});

  kit.you = function you() {
    try {
      const a = SMD.avatar && SMD.avatar.get && SMD.avatar.get();
      // The career's default name ("Director") is not a name: say Commander.
      const def = typeof SMD.t === 'function' ? SMD.t('avatar.defaultName', 'Director') : 'Director';
      if (a && a.name && a.name !== def && a.name !== 'Director') return String(a.name);
    } catch (e) {}
    return typeof SMD.t === 'function' ? SMD.t('ll.cast.you', 'Commander') : 'Commander';
  };
  const done = (x) => Promise.resolve(x);
  // Text options for the director: explicit key, {you} and other params.
  const O = (key, params, extra) => Object.assign({ id: key, params: Object.assign({ you: kit.you() }, params || {}) }, extra || {});
  kit.O = O;

  // People. say() holds the script (not the player: talk while walking);
  // line() does not even hold the script. The director queues subtitles.
  kit.say = (L, who, key, en, mood) => done(L.say(who, en, O(key, null, { mood: mood || 'calm' })));
  kit.line = (L, who, key, en, mood) => done(L.sayAsync(who, en, O(key, null, { mood: mood || 'calm' })));
  kit.radio = (L, who, key, en, mood) => done(L.radio(who, en, O(key, null, { mood: mood || 'calm' })));

  // Guidance.
  kit.obj = (L, key, en, anchor, params) => L.objective(en, anchor == null ? null : anchor, O(key, params));
  kit.hint = (L, key, en, params, now) => L.hint(en, O(key, params, now ? { now: true } : null));
  kit.title = (L, key, en, subKey, subEn) => done(L.title(en, subEn == null ? null : subEn, O(key, null, { subId: subKey })));
  kit.act = (L, anchor, key, en, params) => done(L.interact(anchor, en, O(key, params)));

  // A choice option (English; the director looks up 'll.<key>' and
  // 'll.<key>.locked'). extra: { requires, locked }.
  kit.opt = (id, key, en, extra) => {
    const o = { id, text: en, key: 'll.' + key };
    if (extra && extra.requires) o.requires = extra.requires;
    if (extra && extra.locked) o.locked = extra.locked;
    return o;
  };
  kit.choose = (L, id, options, timer, timeout, key) => done(L.choice(options, { timer, timeout, id, key: !!key }));

  // Several interactions at once, each fires once: next() gives the value of
  // the next one pressed. list: [[anchor, key, en, value, params?], ...].
  kit.events = (L, list) => {
    const queue = [];
    let wake = null;
    const ps = list.map(([anchor, key, en, value, params]) => {
      const p = L.interact(anchor, en, O(key, params));
      done(p)
        .then((r) => {
          if (r === false) return; // cancelled, or the section ended
          queue.push(value);
          if (wake) wake();
        })
        .catch(() => {});
      return p;
    });
    return {
      next: async () => {
        while (!queue.length) await new Promise((r) => (wake = r));
        return queue.shift();
      },
      // Removes the prompts that are left (interact() promises have cancel()).
      cancel: () => ps.forEach((p) => p && typeof p.cancel === 'function' && p.cancel()),
    };
  };
  kit.anyOf = async (L, list) => {
    const ev = kit.events(L, list);
    const v = await ev.next();
    ev.cancel();
    return v;
  };

  // An optional journal pickup at an anchor (a world object that stays).
  kit.find = (L, anchor, key, en, cid) => L.collectible(cid, anchor, O(key, null, { label: en }));
  // The same, but only while this section lasts (the pad: you can't go back,
  // and a pickup left behind would dangle when the set changes).
  kit.findHere = (L, anchor, key, en, cid) => kit.talk(L, anchor, key, en, () => L.collectible(cid));
  // An optional conversation at an anchor: then() runs if the player goes.
  kit.talk = (L, anchor, key, en, then) => {
    done(L.interact(anchor, en, O(key, null, { optional: true })))
      .then((r) => r !== false && then && then())
      .catch(() => {});
  };
  // A locker off the path: opened or not, the story goes on.
  kit.extraLoot = (L, anchor, items) => {
    done(L.loot(anchor, items)).catch(() => {});
  };

  // Survival. Rates are per second toward bad (o2/power/health fall, co2
  // rises); a negative rate is recovery (js/ll/logic.js).
  kit.drain = (L, rates) => L.drain(rates);
  // A visible countdown; running out fails the section with `fail` text.
  kit.timer = (L, seconds, key, en, fail) => {
    const h = L.timer(seconds, en, O(key, null, { fail: fail || 'time' }));
    if (h && typeof h.catch === 'function') h.catch(() => {});
    return h;
  };
  kit.stop = (h) => h && typeof h.stop === 'function' && h.stop();
  kit.qte = (L, kind, key, en, opts) => done(L.qte(kind, Object.assign(O(key, null, { label: en }), opts || {})));
  // Brace that does not fail the section when the grip goes (it costs health).
  kit.brace = (L, seconds, key, en) => done(L.brace(seconds, O(key, null, { label: en, fail: false })));

  // Camera: the set's named shot if it has one, else frame `fallback` (an
  // anchor or cast id) from where the player stands.
  kit.shot = (L, name, fallback, duration) => {
    const named = L.scene && L.scene.shots && L.scene.shots[name];
    return done(named ? L.shot(name) : L.shot(fallback, { duration: duration || 3 }));
  };
  kit.cast = (L, who, anchor) => L.cast(who, anchor);
  kit.walk = (L, who, anchor, speed) => {
    done(L.walk(who, anchor, speed ? { speed } : {})).catch(() => {});
  };
  // Call a set's own hook if it has one (setBreaker, setValve, windowView...).
  kit.set = (L, method, ...args) => {
    const s = L.scene;
    return s && typeof s[method] === 'function' ? s[method](...args) : undefined;
  };
  // A point next to an anchor (people must not stand on top of each other);
  // without a loaded set, the anchor itself.
  kit.near = (L, anchor, dx, dz, dy) => {
    const a = L.scene && L.scene.anchors && L.scene.anchors[anchor];
    return a ? { x: a.position.x + (dx || 0), y: a.position.y + (dy || 0), z: a.position.z + (dz || 0) } : anchor;
  };
  // Look out through a window from just behind its anchor.
  kit.windowShot = (L, name, anchor, duration, back) => {
    const a = L.scene && L.scene.anchors && L.scene.anchors[anchor];
    if (!a) return kit.shot(L, name, anchor, duration);
    const fx = Math.sin(a.rotation.y);
    const fz = Math.cos(a.rotation.y);
    const y = a.position.y + 1.05;
    const pt = (d) => ({ x: a.position.x + fx * d, y, z: a.position.z + fz * d });
    const d0 = back == null ? -0.3 : back;
    return done(L.shot({ from: pt(d0), to: pt(d0 + 0.25), at: pt(1.6), duration: duration || 3, fov: 62 }));
  };
  // Put the Earth in a window that does not face the default view.
  kit.earthOut = (L, anchor) => {
    const a = L.scene && L.scene.anchors && L.scene.anchors[anchor];
    if (!a) return;
    const fx = Math.sin(a.rotation.y);
    const fz = Math.cos(a.rotation.y);
    // The Sun behind you: a full, bright Earth.
    kit.set(L, 'windowView', { moon: null, earth: { dir: [fx, 0.04, fz], deg: 14, spin: 2 }, sun: [-fx + 0.35 * fz, 0.3, -fz - 0.35 * fx] });
  };

  // ---------------------------------------------------------------------
  // The prologue
  // ---------------------------------------------------------------------
  const k = kit;

  // English names for items js/ll/logic.js does not list (the HUD looks up
  // 'll.item.<id>' and would otherwise show the raw id).
  SMD.i18nDicts = SMD.i18nDicts || {};
  SMD.i18nDicts.en = Object.assign(SMD.i18nDicts.en || {}, { 'll.item.patch13': 'Apollo 13 patch' });

  const COLLECTIBLES = [
    {
      id: 'tank2',
      titleKey: 'll.c.tank2.title',
      textKey: 'll.c.tank2.text',
      at: 'van',
      section: 'arrive',
      title: 'Tank two’s test log',
      text: 'During pre-flight testing, Apollo 13’s oxygen tank 2 would not empty, so its oxygen was boiled off with the tank’s heater: eight hours on 65-volt ground power. Its thermostat switches were designed for only 28 volts. They probably welded shut, and parts of the tank may have gone above 540 °C (1000 °F). The gauges only read up to 27 °C (80 °F), so nobody saw it.',
      source: { title: 'NASA NSSDC: The Apollo 13 accident', url: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/ap13acc.html' },
    },
    {
      id: 'seals',
      titleKey: 'll.c.seals.title',
      textKey: 'll.c.seals.text',
      at: 'kwame',
      section: 'tower',
      title: 'The chart that hid the cold',
      text: 'Before Challenger’s launch, engineers looked only at flights whose booster seals had been damaged. Those looked random against temperature. With every flight on one chart, the pattern was clear: all four launches with seals at 63 °F (17 °C) or colder had damage; only three of twenty warmer ones did. The Rogers Commission called the risk almost a certainty below 65 °F (18 °C).',
      source: { title: 'Report of the Presidential Commission on the Space Shuttle Challenger Accident, chapter 6', url: 'https://www.nasa.gov/history/rogersrep/v1ch6.htm' },
    },
    {
      id: 'patch13',
      titleKey: 'll.c.patch13.title',
      textKey: 'll.c.patch13.text',
      at: 'kwame',
      section: 'tower',
      title: 'Ex luna, scientia',
      text: 'Apollo 13’s emblem shows Apollo, the Greek sun god, standing for how the flights carried the light of knowledge to everyone. Its Latin motto, “Ex luna, scientia”, means “From the Moon, knowledge.” The crew wore it to the Moon and never landed.',
      source: { title: 'NASA: Apollo 13 emblem', url: 'https://www.nasa.gov/image-article/apollo-13-emblem/' },
    },
    {
      id: 'challenger',
      titleKey: 'll.c.challenger.title',
      textKey: 'll.c.challenger.text',
      at: 'tower_base',
      section: 'tower',
      title: 'Challenger, 28 January 1986',
      text: 'The air at launch was 2 °C (36 °F), 15 degrees colder than any shuttle launch before. The night before, engineers at the booster maker said not to fly below 53 °F (12 °C), the coldest they had data for. One was asked to “take off his engineering hat and put on his management hat.” A cold seal leaked, and 73 seconds after liftoff Challenger broke apart. All seven crew were lost, including teacher Christa McAuliffe.',
      source: { title: 'Rogers Commission report, chapter 5: The contributing cause of the accident', url: 'https://www.nasa.gov/history/rogersrep/v1ch5.htm' },
    },
    {
      id: 'ice',
      titleKey: 'll.c.ice.title',
      textKey: 'll.c.ice.text',
      at: 'arm_start',
      section: 'arm',
      title: 'Ice on the tower',
      text: 'Between 1:30 and 3:00 in the morning of Challenger’s launch, the ice crew found a large quantity of ice on the tower, the launch platform and the pad. Later an infrared reading showed about 25 °F (−4 °C) on the left booster and 8 °F (−13 °C) low on the right one. No launch rule covered surface temperatures, so the reading was not reported.',
      source: { title: 'Rogers Commission report, chapter 5 (chronology)', url: 'https://www.nasa.gov/history/rogersrep/v1ch5.htm' },
    },
    {
      id: 'whiteroom',
      titleKey: 'll.c.whiteroom.title',
      textKey: 'll.c.whiteroom.text',
      at: 'whiteroom',
      section: 'whiteroom',
      title: 'The last room on Earth',
      text: 'The white room is a small, clean room at the end of the crew access arm. A closeout crew helps astronauts with helmets and gloves there, then they climb through the hatch. The Artemis II crew rehearsed this exact walk at Launch Pad 39B in September 2023, and walked it for real on 1 April 2026.',
      source: { title: 'NASA: Artemis II astronauts conduct launch day demonstration', url: 'https://www.nasa.gov/blogs/missions/2023/09/20/artemis-ii-astronauts-successfully-conduct-launch-day-demonstration/' },
    },
    {
      id: 'maxq',
      titleKey: 'll.c.maxq.title',
      textKey: 'll.c.maxq.text',
      at: null,
      section: 'launch',
      title: 'Max-Q',
      text: 'About a minute after liftoff, a rocket meets max-Q: the moment the air pushes hardest on it. Engines throttle down to ride through it, then back up. On Challenger’s flight, max-Q came at 59 seconds, after the engines had been throttled to 65 percent and back to full power.',
      source: { title: 'Rogers Commission report, chapter 3: The accident', url: 'https://www.nasa.gov/history/rogersrep/v1ch3.htm' },
    },
    {
      id: 'earth',
      titleKey: 'll.c.earth.title',
      textKey: 'll.c.earth.text',
      at: 'window',
      section: 'day3',
      title: 'Behind your thumb',
      text: 'On 7 December 1972 the Apollo 17 crew photographed the whole Earth, lit by the Sun behind them. The picture, AS17-148-22727, became “The Blue Marble”, one of the most shared photographs ever made. It was the first time an Apollo path let a crew see the South Pole’s ice cap.',
      source: { title: 'NASA Earth Observatory: History of the Blue Marble', url: 'https://science.nasa.gov/earth/earth-observatory/history-of-the-blue-marble/' },
    },
  ];

  const CARGO = {
    o2: { item: 'o2tank', name: 'Extra oxygen tank', kg: 39 },
    co2: { item: 'spare_cartridges', name: 'Spare CO2 cartridges', kg: 37 },
    cam: { item: 'camera', name: 'High-res camera', kg: 34 },
  };

  SMD.llLevels.push({
    id: 'prologue',
    n: 0,
    title: 'Cold Morning',
    titleKey: 'll.p.title',
    set: 'pad',
    minutes: 6,
    collectibles: COLLECTIBLES,
    cargo: CARGO,
    sections: [
      // ---------- 1. The walk from the van (movement tutorial) ----------
      {
        id: 'arrive',
        purpose: 'Learn to walk and look; meet the crew in the cold; optional: Grace and tank two.',
        run: async (L) => {
          L.gravity('ground');
          L.power(1);
          L.music('tension');
          k.cast(L, 'yusuf', k.near(L, 'start', -2.0, -1.4));
          k.cast(L, 'lena', k.near(L, 'start', -2.8, -3.0));
          k.cast(L, 'grace', 'van');
          k.cast(L, 'kwame', 'kwame');
          k.cast(L, 'nadia', 'nadia');
          await L.fadeIn();
          k.title(L, 'p.title', 'Cold Morning', 'p.sub', 'Launch day. 04:10. Minus four degrees.');
          k.shot(L, 'pad_wide', L.scene && L.scene.elevator ? { from: { x: 14, y: 1.7, z: 72 }, to: { x: 15, y: 2.2, z: 67 }, at: { x: 0, y: 48, z: 0 } } : 'tower_base', 4);
          k.obj(L, 'p.arrive.obj', 'Walk to Kwame at the tower', 'kwame');
          k.hint(L, 'p.arrive.h1', 'W A S D to walk. Move the mouse to look.');
          // Optional: Grace at the van, still reading tank two's paperwork.
          k.line(L, 'grace', 'p.arrive.g0', 'Boss? Got a second? Before we go up?', 'worried');
          k.talk(L, 'van', 'p.arrive.i.grace', 'Talk to Grace', async () => {
            L.flags.talkedGrace = true;
            L.collectible('tank2');
            await k.say(L, 'grace', 'p.arrive.g1', 'Tank two again. In the ground test, it wouldn’t drain.', 'worried');
            await k.say(L, 'grace', 'p.arrive.g2', 'So they boiled it dry with its heaters. Eight hours.', 'calm');
            await k.say(L, 'grace', 'p.arrive.g3', 'Every reading normal. I signed it. I just… keep thinking.', 'worried');
          });

          // Banter while the player walks (say() holds the script, not the player).
          k.walk(L, 'yusuf', k.near(L, 'tower_base', 1.6, 2.2), 2.6);
          k.walk(L, 'lena', k.near(L, 'tower_base', 2.8, 1.0), 2.6);
          await L.wait(2);
          // Banter gives way if the player goes over to Grace.
          if (!L.flags.talkedGrace) await k.say(L, 'yusuf', 'p.arrive.y1', 'Minus four. My eyebrows just froze.', 'happy');
          if (!L.flags.talkedGrace) await k.say(L, 'lena', 'p.arrive.l1', 'Breathe through your nose. It warms the air.', 'calm');
          if (!L.flags.talkedGrace) await k.say(L, 'yusuf', 'p.arrive.y2', 'My nose is also frozen, doctor.', 'happy');

          await L.reach('kwame', 3);
        },
      },

      // ---------- 2. Kwame at the tower: cold seals, the chart, the patch ----------
      {
        id: 'tower',
        purpose: 'Kwame’s worry about the cold seals; read his chart; get the Apollo 13 patch; optional: Challenger plaque.',
        run: async (L) => {
          if (!L.flags.talkedGrace) L.flags.graceUnheard = true;
          k.walk(L, 'grace', k.near(L, 'tower_base', 3.2, 3.0), 3);
          k.obj(L, 'p.tower.obj', 'Read Kwame’s chart', 'kwame');
          await k.say(L, 'kwame', 'p.tower.k1', 'Minus four. These seals never flew this cold.', 'worried');
          await k.say(L, 'kwame', 'p.tower.k2', 'Cold rubber is slow. It may not seal in time.', 'worried');
          await k.act(L, 'kwame', 'p.tower.i.chart', 'Read the chart');
          k.shot(L, 'chart_close', 'kwame', 2.5);
          L.collectible('seals');
          await k.say(L, 'kwame', 'p.tower.k3', 'Warm flights, clean. Cold flights, scorched. Every one.', 'determined');
          await k.say(L, 'kwame', 'p.tower.k4', 'I’ll say it on the loop. Back me up?', 'worried');
          await k.say(L, 'kwame', 'p.tower.k5', 'Here. Apollo 13’s patch. They came home. So do you.', 'calm');
          L.give('patch13', 1);
          L.collectible('patch13');

          // Optional: the memorial plaque at the foot of the tower.
          k.findHere(L, 'tower_base', 'p.tower.i.plaque', 'Read the plaque', 'challenger');

          k.walk(L, 'yusuf', k.near(L, 'elevator', 1.4, 0.8));
          k.walk(L, 'lena', k.near(L, 'elevator', 2.2, 1.8));
          k.walk(L, 'grace', k.near(L, 'elevator', 3.2, 1.0));
          k.obj(L, 'p.tower.obj2', 'Take the elevator up the tower', 'elevator');
          k.line(L, 'nadia', 'p.tower.n1', '{you}. Bring all four of them home.', 'calm');
          await k.act(L, 'elevator', 'p.tower.i.lift', 'Ride up');
        },
      },

      // ---------- 3. Ninety metres up: the crew access arm ----------
      {
        id: 'arm',
        purpose: 'Height and wind: walk the access arm to the white room; optional: ice on the rail.',
        run: async (L) => {
          L.sfx('creak');
          await L.fadeOut(0.5);
          await L.setScene('pad', 'arm_start');
          k.cast(L, 'yusuf', k.near(L, 'arm_start', 2.2, 0.3));
          k.cast(L, 'lena', k.near(L, 'arm_start', 3.4, -0.7));
          k.cast(L, 'grace', k.near(L, 'arm_start', 4.4, 0.5));
          // From outside: the cab climbs the tower with you in it.
          const lift = L.scene && L.scene.elevator;
          if (lift) {
            lift.ride('arm', 7);
            L.sfx('rumble');
            const ride = L.shot({ from: { x: -16, y: 3, z: 27 }, to: { x: -16, y: 84, z: 27 }, at: { x: -20.6, y: 4, z: 4.2 }, at2: { x: -20.6, y: 93, z: 4.2 }, duration: 7 });
            await L.fadeIn(0.5);
            await ride;
          } else await L.fadeIn();
          L.sfx('hiss');
          k.shot(L, 'arm_drop', lift ? { from: k.near(L, 'arm_start', 2, 1, 1.7), at: k.near(L, 'arm_start', 18, 26, -72) } : 'tower_base', 2.5);
          k.obj(L, 'p.arm.obj', 'Cross the arm to the white room', 'whiteroom');
          k.walk(L, 'yusuf', k.near(L, 'whiteroom', -0.9, 0.6));
          k.walk(L, 'lena', k.near(L, 'whiteroom', 0.4, 1.2));
          k.walk(L, 'grace', k.near(L, 'whiteroom', 1.6, 1.0));
          k.findHere(L, 'arm_start', 'p.arm.i.ice', 'Knock the ice off the rail', 'ice');
          await k.line(L, 'yusuf', 'p.arm.y1', 'Don’t look down.', 'happy');
          await L.wait(1);
          await k.line(L, 'lena', 'p.arm.l1', 'He always looks down.', 'calm');
          await L.wait(1);
          await k.line(L, 'yusuf', 'p.arm.y2', 'Ninety metres. Yes. I looked.', 'worried');
          await L.reach('whiteroom', 2.5);
        },
      },

      // ---------- 4. The last 40 kilograms (the challenge's design choice) ----------
      {
        id: 'whiteroom',
        purpose: 'THE design choice: carry one of three crates (O2 / CO2 cartridges / camera) into the capsule.',
        run: async (L) => {
          k.obj(L, 'p.white.obj', 'Pick up ONE crate', null);
          await k.say(L, 'grace', 'p.white.g1', 'Loading list says forty kilos left. One crate fits.', 'calm');
          k.hint(L, 'p.white.h1', 'Only one fits. The others stay on Earth.');
          k.findHere(L, 'whiteroom', 'p.white.i.sign', 'Read the sign by the door', 'whiteroom');
          // The crates are live at once; the three pitches play (queued) while
          // the player looks them over.
          const picking = k.anyOf(L, [
            ['crate_o2', 'p.white.i.o2', 'Pick up: extra oxygen tank ({kg} kg)', 'o2', { kg: CARGO.o2.kg }],
            ['crate_co2', 'p.white.i.co2', 'Pick up: spare CO2 cartridges ({kg} kg)', 'co2', { kg: CARGO.co2.kg }],
            ['crate_cam', 'p.white.i.cam', 'Pick up: high-res camera ({kg} kg)', 'cam', { kg: CARGO.cam.kg }],
          ]);
          k.radio(L, 'kwame', 'p.white.k1', 'Take the oxygen. A tank inside can’t blow away.', 'determined');
          k.line(L, 'lena', 'p.white.l1', 'The CO2 cartridges. Four people breathe out a lot.', 'calm');
          k.radio(L, 'mariam', 'p.white.m1', 'The camera! The far side, like nobody’s seen it.', 'happy');
          const pick = await picking;
          L.flags.cargo = pick;
          L.flags.extraO2 = pick === 'o2';
          L.flags.spareCartridges = pick === 'co2';
          L.flags.hiresCamera = pick === 'cam';
          const carried = L.t('ll.item.' + CARGO[pick].item, CARGO[pick].name);
          L.flags.carried = carried;
          if (Array.isArray(L.choices)) L.choices.push({ level: 'prologue', section: 'whiteroom', key: false, id: 'cargo', pick, text: carried, timed: false });
          L.sfx('pickup');
          L.give(CARGO[pick].item, 1);
          L.anim('you', 'carry', { prop: 'crate_' + pick });

          k.obj(L, 'p.white.obj2', 'Carry it to the hatch', 'hatch');
          if (pick === 'o2') k.radio(L, 'mariam', 'p.white.m2', 'The far side waits, then. I understand.', 'sad');
          else if (pick === 'co2') k.radio(L, 'kwame', 'p.white.k2', 'Small and boring. Boring keeps people alive.', 'calm');
          else k.radio(L, 'kwame', 'p.white.k3', 'Science over air. I hope we never regret it.', 'worried');
          await k.act(L, 'hatch', 'p.white.i.load', 'Load the crate');
          L.sfx('clank');
          L.take(CARGO[pick].item, 1);
          L.anim('you', 'put');
          const crate = L.scene && L.scene.props && L.scene.props['crate_' + pick];
          if (crate) crate.visible = false;
          await k.say(L, 'lena', 'p.white.l2', 'Every kilogram is a decision, {you}.', 'calm');
        },
      },

      // ---------- 5. Strapped in: the final poll (timed choice 1) ----------
      {
        id: 'poll',
        purpose: 'Strap in; Kwame asks for a hold on the loop; timed Go / Hold / silence.',
        run: async (L) => {
          k.walk(L, 'yusuf', 'hatch');
          k.walk(L, 'lena', 'hatch');
          k.walk(L, 'grace', 'hatch');
          k.obj(L, 'p.poll.obj', 'Climb in and strap into your seat', 'seat_you');
          await k.act(L, 'seat_you', 'p.poll.i.seat', 'Strap in');
          await L.setScene('pad', 'seat_you'); // spawning on a seat straps you in
          ['yusuf', 'lena', 'grace'].forEach((c) => k.cast(L, c, null));
          L.sfx('click');
          k.shot(L, 'seat_up', 'hatch', 2);
          await k.radio(L, 'nadia', 'p.poll.n1', 'All stations, final poll for launch.', 'calm');
          await k.radio(L, 'kwame', 'p.poll.k1', 'Flight, Kwame. Minus four. I’m asking for a hold.', 'worried');
          await k.radio(L, 'nadia', 'p.poll.n2', 'Noted. {you}, it’s your crew. Your call.', 'determined');
          const pick = await k.choose(
            L,
            'poll',
            [
              k.opt('hold', 'p.poll.c.hold', 'Hold until the sun warms the pad.'),
              k.opt('go', 'p.poll.c.go', 'Lantern is Go. We fly.'),
              k.opt('silent', 'p.poll.c.silent', '[Say nothing]'),
            ],
            10,
            'silent',
            true,
          );
          if (pick === 'hold') {
            L.flags.held = true;
            await k.radio(L, 'nadia', 'p.poll.n3', 'Copy. We hold for the sun.', 'calm');
            await k.radio(L, 'kwame', 'p.poll.k2', 'Thank you, {you}. Thank you.', 'calm');
            await L.fadeOut();
            await k.title(L, 'p.poll.t', 'Two hours later', 'p.poll.ts', 'Plus three degrees. The ice is dripping.');
            await L.fadeIn();
          } else if (pick === 'go') {
            L.flags.launchedCold = true;
            await k.radio(L, 'nadia', 'p.poll.n4', 'Copy, Go. Kwame, your concern is in the log.', 'calm');
            await k.radio(L, 'kwame', 'p.poll.k3', 'I hope I’m wrong.', 'sad');
          } else {
            L.flags.launchedCold = true;
            L.flags.saidNothing = true;
            await k.radio(L, 'nadia', 'p.poll.n5', 'Silence on my loop is a Go.', 'determined');
            await k.radio(L, 'kwame', 'p.poll.k3', 'I hope I’m wrong.', 'sad');
          }
        },
      },

      // ---------- 6. Liftoff: brace through max-Q, staging QTE ----------
      {
        id: 'launch',
        purpose: 'Playable launch: countdown, hold to brace through max-Q, press at staging, then silence and floating.',
        run: async (L) => {
          await L.fadeOut();
          await L.setScene('capsule', 'seat_you');
          L.gravity('ground');
          k.cast(L, 'yusuf', 'seat_yusuf');
          k.cast(L, 'lena', 'seat_lena');
          k.cast(L, 'grace', 'seat_grace');
          await L.fadeIn();
          k.obj(L, 'p.launch.obj', 'Ride it out', null);
          L.music('action');
          await k.radio(L, 'nadia', 'p.launch.n1', 'Lantern, Control. Ten. Nine. Eight…', 'calm');
          L.sfx('rumble');
          L.shake(0.35, 3);
          await k.radio(L, 'nadia', 'p.launch.n2', 'Three. Two. One. Liftoff!', 'determined');
          L.sfx('rumble');
          L.shake(0.6, 8);
          k.shot(L, 'cabin_shake', 'yusuf', 2.5);
          if (L.flags.launchedCold) {
            await k.radio(L, 'kwame', 'p.launch.k1', 'Nadia. Camera six. Smoke at the left booster.', 'scared');
            await k.radio(L, 'nadia', 'p.launch.n3', 'Pressures are good. Stay on your console.', 'calm');
          } else {
            k.radio(L, 'kwame', 'p.launch.k2', 'Boosters clean. Clean! Go, Lantern!', 'happy');
          }
          await k.say(L, 'yusuf', 'p.launch.y1', 'Max-Q coming! Hold on!', 'determined');
          const braced = await k.brace(L, 6, 'p.launch.h1', 'Hold to brace.');
          L.collectible('maxq');
          if (!braced) {
            L.res.health = Math.max(0, (L.res.health || 100) - 10);
            await k.say(L, 'lena', 'p.launch.l1', 'Head back against the seat! Breathe!', 'worried');
          } else {
            k.line(L, 'yusuf', 'p.launch.y2', 'She’s shaking, but she’s happy!', 'happy');
          }
          await k.say(L, 'yusuf', 'p.launch.y3', 'Staging in three… two…', 'determined');
          const staged = await k.qte(L, 'press', 'p.launch.q', 'Staging!', { time: 2.5 });
          L.sfx('thud');
          L.shake(staged ? 0.5 : 1, 1.2);
          if (staged) await k.say(L, 'yusuf', 'p.launch.y4', 'Clean separation. Like a taxi.', 'happy');
          else await k.say(L, 'yusuf', 'p.launch.y5', 'That one I felt in my teeth.', 'worried');
          await L.wait(1.5);
          L.music('wonder');
          L.gravity('zeroG');
          k.shot(L, 'float_pencil', 'grace', 3);
          await k.say(L, 'grace', 'p.launch.g1', 'Forty-two bolts on that panel. I counted.', 'calm');
          await k.say(L, 'yusuf', 'p.launch.y6', 'Welcome to space, everybody.', 'happy');
          await L.fadeOut();
        },
      },

      // ---------- 7. Day 3: Earth, Salma, the stir (timed choice 2), the bang ----------
      {
        id: 'day3',
        purpose: 'Quiet before the storm: float to the window, photograph Earth, the routine tank stir, then the bang.',
        run: async (L) => {
          await L.setScene('capsule', 'start');
          L.gravity('zeroG');
          L.power(0.8);
          L.music('calm');
          k.earthOut(L, 'window');
          k.cast(L, 'yusuf', 'seat_yusuf');
          k.cast(L, 'lena', 'seat_lena');
          k.cast(L, 'grace', 'panel_right');
          await L.fadeIn();
          k.title(L, 'p.day3.t', 'Day 3', 'p.day3.ts', '321,000 kilometres from home.');
          k.obj(L, 'p.day3.obj', 'Float to the window', 'window');
          k.hint(L, 'p.day3.h1', 'W A S D to float. Space goes up, C goes down.');
          await L.reach('window', 1.6);
          k.windowShot(L, 'earth_window', 'window', 3.5, 0.15);
          await k.say(L, 'yusuf', 'p.day3.y1', 'Salma says hi. She wants a Moon rock.', 'happy');
          await k.say(L, 'lena', 'p.day3.l1', 'We don’t land.', 'calm');
          await k.say(L, 'yusuf', 'p.day3.y2', 'She doesn’t care.', 'happy');

          k.obj(L, 'p.day3.obj2', 'Take a photo of Earth', 'window');
          await k.act(L, 'window', 'p.day3.i.photo', 'Take a photo');
          L.sfx('click');
          L.collectible('earth');
          if (L.flags.cargo === 'cam') await k.radio(L, 'mariam', 'p.day3.m1', 'Lantern, that photo! I can see my street!', 'happy');
          else await k.radio(L, 'mariam', 'p.day3.m2', 'A bit blurry. Still beautiful.', 'happy');

          await k.radio(L, 'nadia', 'p.day3.n1', 'Lantern, one chore before bed. Stir the oxygen tanks.', 'calm');
          await k.say(L, 'grace', 'p.day3.g1', 'Tank two jumped again. Probably the gauge. Probably.', 'worried');
          const who = await k.choose(
            L,
            'stir',
            [
              k.opt('you', 'p.day3.c.you', 'I’ll flip it myself.'),
              k.opt('grace', 'p.day3.c.grace', 'Grace, it’s your system.'),
              k.opt('hold', 'p.day3.c.hold', 'Wait. Tank two looks wrong.', { requires: 'flag:talkedGrace', locked: 'Talk to Grace at the pad to know' }),
            ],
            8,
            'grace',
          );
          L.flags.stirBy = who;
          if (who === 'you') {
            k.obj(L, 'p.day3.obj3', 'Flip the stir switch', 'panel_right');
            await k.act(L, 'panel_right', 'p.day3.i.stir', 'Flip the switch');
            L.sfx('click');
          } else if (who === 'grace') {
            L.anim('grace', 'flip');
            L.sfx('click');
            await k.say(L, 'grace', 'p.day3.g2', 'Fans on. Tank one, fine. Tank two…', 'calm');
          } else {
            await k.radio(L, 'nadia', 'p.day3.n2', 'Copy. We’ll look at it in the morning.', 'calm');
            await L.wait(2);
            await k.say(L, 'grace', 'p.day3.g3', 'The heaters just clicked on. By themselves.', 'worried');
          }
          k.obj(L, 'p.day3.obj4', 'Get some sleep', null);
          await L.wait(1.4);
          k.line(L, 'yusuf', 'p.day3.y3', 'Goodnight, Lant—', 'calm');
          await L.wait(0.8);
          L.sfx('bang');
          L.shake(1, 2.5);
          L.alarm(true);
          L.power(0.45);
          await L.wait(1.2);
          await L.fadeOut();
          L.end('lifeboat');
        },
      },
    ],
  });
})();
