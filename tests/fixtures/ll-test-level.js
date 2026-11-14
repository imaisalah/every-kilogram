// Last Light: the director's test level (#dev-ll-test). Touches every
// director method once, on the stand-in sets (add ?art to the address to run
// it on the art sets). Not listed in the chapters (dev: true).
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.llLevels = SMD.llLevels || [];
  if (SMD.llLevels.some((l) => l.id === 'lltest')) return;
  try {
    if (!/[?&]art\b/.test(location.search)) SMD.llStandin = true;
  } catch (e) {}
  let failedOnce = false;
  SMD.llTest = { log: [] };
  const log = (x) => SMD.llTest.log.push(x);

  SMD.llLevels.push({
    id: 'lltest',
    n: 9,
    dev: true,
    title: 'Director test',
    set: 'pad',
    collectibles: [
      { id: 'lltest_photo', title: 'A test photo', text: 'Found by the test level.', source: { title: 'Nobody', url: 'https://example.org' } },
      { id: 'lltest_log', title: 'A test log', text: 'Found at once.' },
    ],
    sections: [
      {
        id: 'walk',
        run: async (L) => {
          L.gravity('ground');
          L.music('calm');
          L.cast('kwame', 'kwame');
          L.cast('nadia', 'nadia');
          await L.fadeIn(0.6);
          await L.title('Director test', 'Every method, once', { seconds: 1.5 });
          L.objective('Walk to Kwame', 'kwame');
          L.hint('W A S D to walk. Click to look around.');
          L.sayAsync('nadia', 'Walk while we talk. Nobody waits for you.');
          L.collectible('lltest_photo', 'van');
          L.loot('van', ['tape', 'sock']);
          L.look('kwame', 'you');
          await L.reach('kwame', 3);
          log('reach');
          L.anim('kwame', 'wave');
          await L.shot('kwame', { duration: 1.2 });
          await L.say('kwame', 'Cold seals. Ask me why.', { mood: 'worried' });
          L.objective('Talk to Kwame', 'kwame');
          await L.interact('kwame', 'Ask why');
          L.collectible('lltest_log');
          const pick = await L.choice(
            [
              { id: 'hold', text: 'We hold the launch.' },
              { id: 'go', text: 'We fly at dawn.' },
              { id: 'data', text: 'Show me all the data.', requires: 'flag:sawData', locked: 'Read the chart first' },
            ],
            { timer: 8, timeout: 'go', key: true }
          );
          L.flags.pick = pick;
          log('choice:' + pick);
          const t = L.timer(30, 'Reach the tower');
          L.walk('kwame', 'tower_base');
          L.objective('Follow Kwame', 'kwame');
          await L.follow('kwame');
          t.stop();
          log('follow');
        },
      },
      {
        id: 'action',
        run: async (L) => {
          L.objective(null);
          L.music('action');
          L.sfx('rumble');
          L.shake(0.5, 1);
          const a = await L.qte('press', { label: 'Grab the rail', at: 'tower_base' });
          const b = await L.qte('hold', { label: 'Pull the lever', hold: 1 });
          const c = await L.qte('mash', { label: 'Kick the latch', count: 5 });
          const d = await L.qte('turn', { label: 'Turn the valve', turns: 1 });
          const e = await L.brace(3);
          log('qte:' + [a, b, c, d, e].join(','));
          L.radio('nadia', 'Good. Now the hard part.');
          await L.wait(0.5);
        },
      },
      {
        id: 'cabin',
        run: async (L) => {
          await L.fadeOut(0.5);
          await L.setScene('capsule', 'start');
          L.gravity('zeroG');
          L.cast('grace', 'seat_grace');
          L.cast('yusuf', 'window');
          L.power(0.7);
          L.alarm(true);
          await L.fadeIn(0.6);
          L.meters(['o2', 'co2', 'power']);
          L.drain({ o2: 0.05, co2: 0.08, power: 0.02 });
          L.onLow('co2', 12, () => L.say('grace', 'CO2 is climbing. Build the adapter.'));
          if (!failedOnce) {
            failedOnce = true;
            log('fail');
            await L.fail('o2');
          }
          log('retried');
          L.alarm(false);
          ['locker_1', 'locker_2', 'locker_3', 'locker_7', 'locker_8'].forEach((n, i) => L.loot(n, [['cartridge', 'hose', 'bag', 'cover', 'tape'][i]]));
          L.state('breaker_1', false);
          L.objective('Search the lockers, then use the bench', 'hab_bench');
          await L.interact('hab_bench', 'Use the bench');
          let built = await L.craft('co2adapter');
          while (!built) {
            L.objective('Find what is missing, then use the bench', 'hab_bench');
            await L.interact('hab_bench', 'Use the bench');
            built = await L.craft('co2adapter');
          }
          L.drain({ co2: -0.5 });
          L.checkpoint();
          log('built');
          await L.say('grace', 'It holds. It actually holds.', { mood: 'happy' });
          L.give('food', 2);
          log('has:' + L.has('co2adapter') + ',' + L.has('food', 2));
          await L.wait(0.6);
          L.end(null);
        },
      },
    ],
  });
})();
