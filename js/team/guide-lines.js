// KILO's lines (docs/TEAM-V2.md "KILO, the guide"). Plain English a 13-year-old
// understands, dry deadpan humour, real facts. One or two short sentences each.
//
// Shape: SMD.team.guideLines[mission][moment] = [[mood, text], ...]. A mission's
// moment falls back to `any`. The i18n key of a line is guide.<where>.<moment>.<n>
// (where = the mission id it came from, or 'any'); ar-guide.js holds the Arabic.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};

  const any = {
    briefing: [
      ['deadpan', "Hello. I'm KILO, your mission guide. Humour setting: 40%."],
      ['neutral', 'The point: design a spacecraft, fly it, and bring back the science.'],
      ['thinking', 'We build the ship one part at a time, choose what it measures, then launch.'],
      ['happy', 'Every kilogram costs fuel and money. Spend them well.'],
    ],
    'step.launcher': [['thinking', 'The rocket. Bigger ones lift more but cost far more. Pick the smallest one that can carry us.']],
    'step.orbit': [['neutral', 'The orbit is the path we circle on. Low is close and sharp. High sees more at once.']],
    'step.route': [['thinking', 'The route. The fast way burns more fuel. The slow way saves fuel and costs months.']],
    'step.panels': [['neutral', 'Solar panels make our power. Only in sunlight. I checked.']],
    'step.batteries': [['neutral', 'Batteries keep us alive in the shadow, when the panels make nothing.']],
    'step.instruments': [['happy', 'Instruments are why we are going. Each one answers part of the question, and each one is heavy.']],
    'step.antenna': [['neutral', 'The antenna sends our data home. A bigger dish is faster, but heavier and harder to aim.']],
    'step.radio': [['neutral', 'The radio is our voice. More watts: a louder signal, and more power used.']],
    'step.recorder': [['thinking', 'The recorder holds data until Earth can hear us. When it is full, new science is lost.']],
    'step.computer': [['neutral', 'The computer runs everything. A backup means one failure is not the end.']],
    'step.adcs': [['neutral', 'Pointing keeps us steady. A wobbly spacecraft takes blurry pictures.']],
    'step.lifetime': [['thinking', 'Lifetime: how long we work out there. Longer means more science and more cost.']],
    'step.structure': [['neutral', 'The frame holds it all together. Thicker walls block radiation, and weigh more.']],
    'step.propMargin': [['deadpan', 'Spare fuel. Exactly enough is fine, if nothing goes wrong. Things go wrong.']],
    'step.duty': [['neutral', 'How often the instruments run. More often: more science, more data, more power.']],
    'step.processing': [['thinking', 'Shrink the data before sending it? Less to send, a little less detail.']],
    'step.coding': [['neutral', 'Error correction is slower, but radio static cannot scramble our messages.']],
    'step.ground': [['neutral', 'Ground stations are our ears on Earth. More stations, more chances to talk.']],
    'step.schedule': [['deadpan', 'The schedule. Rushing saves months. It also lets mistakes slip through.']],
    'step.landing': [['thinking', 'The landing kit: oxygen, a drill, and fuel to get back up. Every sample must fit in the ride home.']],
    'step.other': [['neutral', 'Pick one. Watch what it does to the mass, power and money.']],
    questions: [['thinking', 'Now you know your ship. Choose what it will do: the goal it is good at, not the one that sounds best.']],
    objective: [['neutral', 'The objective is the main question. Pick one your instruments can answer.']],
    requirement: [['neutral', 'The requirement is how good is good enough. Stricter means more points, and more ways to miss.']],
    'fit.good': [['happy', '{name}: your ship is built for this.']],
    'fit.ok': [['thinking', '{name}: it can do it. Just about.']],
    'fit.poor': [['worried', '{name}: your ship would struggle. I am saying this calmly.']],
    review: [['neutral', 'Last look. Anything that cannot work is marked. Tap "Fix it" and I will take you there.']],
    'review.problem': [['worried', 'One problem: {problem}']],
    launch: [['deadpan', 'All systems ready. I have never been more ready. I am always this ready.']],
    cabin: [['neutral', 'Before we launch: meet the crew.']],
    'flight.start': [['neutral', 'We are up. Watch the battery in the shadow, and the data going home.']],
    'flight.eclipse': [['thinking', 'Shadow. The panels stop, so the battery takes over.']],
    'flight.contact': [['happy', 'Earth can hear us. The data is going home.']],
    'flight.lowbat': [['worried', 'The battery is nearly flat.']],
    'flight.overflow': [['worried', 'The recorder is full. New science is spilling away.']],
    'flight.crisis': [['neutral', 'A problem. Stay calm. I am always calm. It is a setting.']],
    landing: [['neutral', 'Orbit reached. Going down to the surface. Hold on to something.']],
    surface: [['neutral', 'Walk to the science sites, scan with what we brought, and send the data in the uplink windows. Then back to the lander.']],
    'results.full': [['proud', 'Mission complete. The science made it home. I would smile, but this is my smiling face.']],
    'results.partial': [['thinking', 'Some of the science made it home. Not all. One change could fix that.']],
    'results.none': [['sad', 'The spacecraft flew. The science did not get home. Both matter.']],
    'results.lost': [['sad', 'We lost the spacecraft. Real missions have too. Let us see why.']],
    'results.crew': [['sad', 'The crew did not make it home. That is why real engineers check every gram twice.']],
  };

  const nile = {
    briefing: [
      ['deadpan', "Hello. I'm KILO, your mission guide. Humour setting: 40%."],
      ['neutral', 'Farmers along the Nile need to know which fields are thirsty. We will watch them from space.'],
      ['thinking', 'We build the satellite one part at a time, choose what it measures, then launch.'],
      ['happy', 'A training flight: no landing. Just you, the ship and the data.'],
    ],
    'step.orbit': [['thinking', 'A sun-synchronous orbit passes over the Nile at the same time every day, so the shadows always match.']],
    'step.instruments': [['happy', 'Healthy plants reflect lots of near-infrared light. A camera that sees it can spot thirsty fields.']],
    'step.batteries': [['neutral', 'In low orbit we go round Earth every 90 minutes, and spend about 35 of them in shadow.']],
    launch: [['deadpan', 'Low Earth orbit is about ten minutes of rocket ride away. Shorter than most bus trips.']],
    'results.full': [['proud', 'Every field watched, every picture home. The farmers thank you. I thank you. Efficiently.']],
  };

  const storms = {
    briefing: [
      ['deadpan', "Hello. I'm KILO, your mission guide. Humour setting: 40%."],
      ['neutral', 'Every spring, dust storms sweep across Egypt. We want to see them coming.'],
      ['thinking', 'We build the satellite one part at a time, choose what it measures, then launch.'],
      ['happy', 'A training flight: no landing. Short, useful, and nobody gets dusty.'],
    ],
    'step.orbit': [['thinking', 'Low orbits see sharp detail but pass by quickly. Very high orbits can stare at one place all day.']],
    'step.instruments': [['neutral', 'A wide camera catches the whole storm. A sharp one sees only part of it. Choose.']],
    launch: [['deadpan', 'Low Earth orbit is about ten minutes of rocket ride away. Shorter than most bus trips.']],
  };

  const moon = {
    briefing: [
      ['deadpan', "Hello. I'm KILO, your mission guide. Humour setting: 40%."],
      ['neutral', 'Future Moon bases need water. Is there ice in the craters that never see sunlight?'],
      ['thinking', 'We build the ship one part at a time, choose what it measures, launch, and land near the south pole.'],
      ['happy', 'Every kilogram we carry costs fuel. Spend them well.'],
    ],
    'step.panels': [['neutral', 'Near the south pole the Sun skims the horizon. Panels still work, but the shadows are very long.']],
    'step.instruments': [['happy', 'A neutron detector can sense hydrogen from orbit: a clue that ice is hiding below.']],
    'step.batteries': [['thinking', 'Some craters here have not seen sunlight in billions of years. Batteries matter.']],
    launch: [['deadpan', 'The Moon is about three days away. Short trip. Do not unpack.']],
    landing: [['neutral', 'Landing near the south pole. The shadows can hide ice. And rocks. Mostly rocks.']],
    surface: [['neutral', 'The ice hides in the cold, dark places, colder than minus 200 degrees. Scan them, send the data, and watch the oxygen.']],
    'results.full': [['proud', 'Ice found, data home. A future Moon base just got a little easier. You are welcome, future.']],
  };

  const mars = {
    briefing: [
      ['deadpan', "Hello. I'm KILO, your mission guide. Humour setting: 40%."],
      ['neutral', 'Astronauts will need water on Mars. We are looking for ice hiding under the dust.'],
      ['thinking', 'We build the ship one part at a time, choose what it measures, launch, and land.'],
      ['happy', 'Mars is far. Every kilogram costs a lot of fuel. Spend them well.'],
    ],
    'step.panels': [['neutral', 'Mars gets less than half the sunlight Earth does, and dust settles on the panels.']],
    'step.instruments': [['happy', 'Radar can see ice under the dust. A real orbiter around Mars does exactly that.']],
    'step.antenna': [['thinking', 'Mars can be 400 million kilometres away. Only a big dish gets much data home.']],
    launch: [['deadpan', 'Next stop: Mars. About seven months away. Bring a book.']],
    landing: [['neutral', 'About seven minutes from the top of the air to the ground. We cannot steer from Earth: the signal is too slow.']],
    surface: [['neutral', 'Find the ice, scan it, send the data home. Watch for dust storms: on Mars they can cover the whole planet.']],
    'results.lost': [['sad', 'Lost at Mars. Famous company: about half of all missions sent to Mars have failed.']],
  };

  const venus = {
    briefing: [
      ['deadpan', "Hello. I'm KILO, your mission guide. Humour setting: 40%."],
      ['neutral', 'Is Venus still erupting today? We are going to find out.'],
      ['thinking', 'We build the ship one part at a time, choose what it measures, launch, and float in the clouds.'],
      ['happy', 'Every kilogram costs fuel and money. Spend them well.'],
    ],
    'step.panels': [['happy', 'Venus is closer to the Sun than we are. Above the clouds there is plenty of sunlight.']],
    'step.landing': [['neutral', 'Our cloud platform needs oxygen, and fuel to climb back to orbit. Samples must fit on the way up.']],
    'step.instruments': [['neutral', 'Thick clouds hide the ground, so radar looks through them. Magellan mapped Venus that way.']],
    launch: [['deadpan', 'Venus is about five months away. It is hot there. Very hot.']],
    landing: [['neutral', 'We will not land: the ground is 465 degrees. We float on a platform about 50 km up, where it is almost Earth-like.']],
    surface: [['neutral', 'Sample the clouds, scan, and send the data home. Fun fact: a day on Venus is longer than its year.']],
  };

  const europa = {
    briefing: [
      ['deadpan', "Hello. I'm KILO, your mission guide. Humour setting: 40%."],
      ['neutral', 'An ocean hides under the ice of Europa, a moon of Jupiter. Is the ice thin enough to reach it one day?'],
      ['thinking', 'We build the ship one part at a time, choose what it measures, launch, and land on the ice.'],
      ['happy', 'It is a very long way. Every kilogram counts even more.'],
    ],
    'step.panels': [['neutral', 'At Jupiter, sunlight is about 25 times weaker than at Earth. Panels must be huge.']],
    'step.structure': [['worried', "Jupiter's radiation fries electronics. Europa Clipper hides its computer in a thick metal vault."]],
    'step.instruments': [['happy', 'Ice-penetrating radar can measure how thick the shell is. Europa Clipper carries one.']],
    'step.antenna': [['thinking', 'From Jupiter, a radio signal takes 35 to 52 minutes to reach Earth. Big dish, please.']],
    launch: [['deadpan', 'Next stop: Europa. About five and a half years away. I packed snacks. I do not eat.']],
    landing: [['neutral', 'Landing on the ice. It is about minus 160 degrees out there, and Jupiter fills the sky.']],
    surface: [['neutral', 'Reach the plume deposits, scan them, and send the data home. Mind the radiation.']],
    'results.full': [['proud', 'Ice measured, data home. Somewhere under there, an ocean is still keeping its secrets. Fewer now.']],
  };

  // Build-step names the flow may use that mean the same part.
  const ALIAS = { power: 'panels', solar: 'panels', rocket: 'launcher', comms: 'antenna', data: 'recorder', pointing: 'adcs', fuel: 'propMargin', battery: 'batteries' };

  SMD.team.guideLines = { any, nile, storms, moon, mars, venus, europa, ALIAS };
})();
