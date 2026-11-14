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
    'step.thermal': [['thinking', 'Thermal control keeps parts between too hot and too cold. Blankets, heaters, radiators. Each costs mass or power.']],
    'step.other': [['neutral', 'Pick one. Watch what it does to the mass, power and money.']],
    define: [['neutral', 'The mission chain: the need, the goal, what we measure, what the ship must do. Each link holds up the next.']],
    questions: [['thinking', 'Before we design the ship, choose which science result counts as success.']],
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
    'step.thermal': [['neutral', 'A lunar night lasts about two weeks and drops below minus 170 degrees. Heaters keep the batteries alive.']],
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
    'step.thermal': [['neutral', 'Mars nights fall below minus 80 degrees. Insulation and heaters keep the parts working.']],
    'step.landing': [['thinking', 'Mars air is thin. A heat shield, a parachute and rockets work together to land on target.']],
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

  // The CubeSat mission (docs/TEAM-V3.md item 19): a 6U satellite over the Nile.
  const cubesat = {
    briefing: [
      ['deadpan', "Hello. I'm KILO, your mission guide. Humour setting: 40%."],
      ['neutral', 'Farmers along the Nile need a cheap eye in the sky. We will build a satellite the size of a shoebox.'],
      ['thinking', 'We build it one part at a time, choose what it measures, then it rides to orbit with other satellites.'],
      ['happy', 'A training flight: no landing. A 6U CubeSat may weigh only 12 kg. Every gram counts.'],
    ],
    'step.launcher': [['neutral', 'CubeSats ride along with a bigger mission, in a spring-loaded box. Cheap, but you go where the rocket goes.']],
    'step.orbit': [['thinking', 'Below about 400 km, thin air slowly drags a CubeSat down. Higher orbits last for years.']],
    'step.instruments': [['happy', 'A CubeSat camera is small, but healthy plants still shine in near-infrared. That is all we need.']],
    'step.panels': [['neutral', 'A CubeSat makes about as much power as a phone charger. Choose instruments that fit it.']],
    'step.antenna': [['neutral', 'A small patch antenna is enough from low orbit. Earth is only a few hundred kilometres away.']],
    'step.thermal': [['neutral', 'A CubeSat is so small it heats and cools fast. Blankets and paint do most of the work.']],
    launch: [['deadpan', 'We share the rocket with dozens of other satellites. I will not make small talk.']],
    'results.full': [['proud', 'A shoebox mapped the Nile. The farmers know which fields are thirsty. Small can be mighty.']],
  };

  // Build-step names the flow may use that mean the same part.
  const ALIAS = { power: 'panels', solar: 'panels', rocket: 'launcher', comms: 'antenna', data: 'recorder', pointing: 'adcs', fuel: 'propMargin', battery: 'batteries' };

  SMD.team.guideLines = { any, nile, storms, moon, mars, venus, europa, cubesat, ALIAS };

  // ---------- The other two guides (docs/TEAM-V3.md item 9) ----------
  // Originals. Same moments as KILO. A mission briefing is their own hello, the
  // mission's two plain facts (KILO's lines 2 and 3, written without jokes) and
  // their own closing line. Build steps with a mission fact use KILO's fact line;
  // anything a guide does not have falls back to KILO, so nothing is ever silent.
  // i18n keys: guide.<guide>.<where>.<moment>.<n>.

  // BRACE: a tall, quiet survey robot, retired from the lunar survey corps. Dry,
  // drill-sergeant manners, secretly very proud of its crew.
  const brace = {
    any: {
      hello: [['deadpan', 'BRACE reporting. Mission guide, two metres tall, zero sense of panic.']],
      briefing: [
        ['deadpan', 'BRACE reporting. Mission guide, two metres tall, zero sense of panic.'],
        ['neutral', 'Objective: design a spacecraft, fly it, and bring the science home.'],
        ['thinking', 'Procedure: we build one part at a time, choose what it measures, then launch.'],
        ['deadpan', 'Every kilogram costs fuel and money. Waste neither. That is an order. A friendly one.'],
      ],
      'briefing.close': [['deadpan', 'Every kilogram costs fuel and money. Waste neither. That is an order. A friendly one.']],
      'step.launcher': [['thinking', 'The rocket. Pick the smallest one that can lift us. Big rockets are for big budgets.']],
      'step.orbit': [['neutral', 'The orbit is our patrol route. Low sees sharp detail. High sees more ground at once.']],
      'step.route': [['thinking', 'The route. Fast burns fuel. Slow burns months. Both are a cost.']],
      'step.panels': [['neutral', 'Solar panels: our power supply. They work in sunlight. Night shift is not their job.']],
      'step.batteries': [['neutral', 'Batteries carry us through the shadow. No battery, no night watch.']],
      'step.instruments': [['happy', 'Instruments are the reason we deploy. Each one answers part of the question. Each one has weight.']],
      'step.antenna': [['neutral', 'The antenna sends our reports home. Bigger dish, faster reports, more mass to carry.']],
      'step.radio': [['neutral', 'The radio is our voice. More watts: a louder voice and a hungrier power supply.']],
      'step.recorder': [['thinking', 'The recorder holds data until Earth is listening. When it is full, new science is lost. No refunds.']],
      'step.computer': [['neutral', 'The computer runs the ship. A backup means one failure is a bad day, not the end.']],
      'step.adcs': [['neutral', 'Pointing keeps us steady. A ship that wobbles takes blurry pictures. Stand up straight.']],
      'step.lifetime': [['thinking', 'Mission length. Longer tour, more science, bigger bill.']],
      'step.structure': [['neutral', 'The frame holds everything together. Thicker walls stop radiation and add mass. Armour has a price.']],
      'step.propMargin': [['deadpan', 'Spare fuel. Exactly enough works, if nothing goes wrong. Something always goes wrong.']],
      'step.duty': [['neutral', 'How often the instruments run. More often: more science, more data, more power. Pace yourself.']],
      'step.processing': [['thinking', 'Compress the data before sending it? Less to send, a little less detail. Your call.']],
      'step.coding': [['neutral', 'Error correction is slower, but static cannot scramble the message. Clear orders save missions.']],
      'step.ground': [['neutral', 'Ground stations are our listening posts on Earth. More posts, more chances to report in.']],
      'step.schedule': [['deadpan', 'The schedule. Rushing saves months and invites mistakes. I have seen both.']],
      'step.landing': [['thinking', 'Landing kit: oxygen, a drill, and fuel to climb back out. Every sample must fit on the ride home.']],
      'step.thermal': [['neutral', 'Thermal control: blankets, heaters, radiators. Keep the parts at a sensible temperature. Like good barracks.']],
      'step.other': [['neutral', 'Choose one. Then check what it did to the mass, the power and the money.']],
      define: [['neutral', 'The mission chain: need, goal, measurements, requirements. Each link supports the next. Like a chain of command.']],
      questions: [['thinking', 'Before we build, define success. Which science result counts as mission accomplished?']],
      objective: [['neutral', 'The objective is the main question. Pick one our instruments can actually answer.']],
      requirement: [['neutral', 'The requirement sets the bar. A higher bar means more points, and more ways to miss it.']],
      'fit.good': [['happy', '{name}: the ship is built for this. Good work.']],
      'fit.ok': [['thinking', '{name}: it can be done. Barely. I have seen worse plans succeed.']],
      'fit.poor': [['worried', '{name}: the ship would struggle. I recommend a rethink. Firmly.']],
      review: [['neutral', 'Final inspection. Anything that cannot work is flagged. Tap "Fix it" and I will march you there.']],
      'review.problem': [['worried', 'One problem on the checklist: {problem}']],
      launch: [['deadpan', 'All systems go. Crew strapped in. I am bolted down. Nobody wave.']],
      cabin: [['neutral', 'Before launch: roll call.']],
      'cabin.open': [['deadpan', 'Roll call before launch. I am BRACE, your guide. Present, as always.']],
      'cabin.close': [['neutral', 'Crew accounted for. Strap in. The countdown is not optional.']],
      'flight.start': [['neutral', 'We are up. Watch the battery in the shadow and the data going home.']],
      'flight.eclipse': [['thinking', 'Entering shadow. The panels are off duty. The battery has the watch.']],
      'flight.contact': [['happy', 'Earth has us. Data going home. Good copy.']],
      'flight.lowbat': [['worried', 'Battery nearly flat. This is not a drill.']],
      'flight.overflow': [['worried', 'Recorder full. New science is spilling overboard.']],
      'flight.crisis': [['neutral', 'Problem on board. Stay calm and work the checklist. I have done this before.']],
      landing: [['neutral', 'Orbit reached. Descending to the surface. Hold on to something bolted down.']],
      surface: [['neutral', 'Walk to the science sites, scan with what we brought, report in during the uplink windows. Then back to the lander.']],
      'results.full': [['proud', 'Mission accomplished. The science made it home. Permission to feel proud: granted.']],
      'results.partial': [['thinking', 'Part of the science made it home. Not all. One change could close the gap.']],
      'results.none': [['sad', 'The ship flew. The science did not come home. A mission needs both.']],
      'results.lost': [['sad', 'We lost the spacecraft. Real missions have too. Debrief time: let us find out why.']],
      'results.crew': [['sad', 'The crew did not make it home. That is why real engineers check every gram twice.']],
    },
    nile: {
      'briefing.close': [['neutral', 'Training flight. No landing. Treat it like the real thing anyway.']],
      launch: [['deadpan', 'Low orbit is about ten minutes up. I have had longer elevator rides.']],
      'results.full': [['proud', 'Every field watched, every picture home. The farmers have their report. Well done.']],
    },
    storms: {
      'briefing.close': [['deadpan', 'Training flight. Nobody lands, nobody gets dusty. I will be disappointed quietly.']],
      launch: [['deadpan', 'Low orbit in about ten minutes. Keep your boots on.']],
    },
    moon: {
      'briefing.close': [['neutral', 'Three days out, one landing, zero excuses. Spend the kilograms like they are yours.']],
      launch: [['deadpan', 'The Moon: about three days out. Short deployment. Do not unpack.']],
      landing: [['neutral', 'Descending near the south pole. Long shadows, cold craters. Stay sharp.']],
      surface: [['neutral', 'The ice hides where the Sun never reaches, below minus 200 degrees. Scan, report, mind the oxygen.']],
    },
    mars: {
      'briefing.close': [['thinking', 'Mars is far and unforgiving. Pack light and pack smart.']],
      launch: [['deadpan', 'Mars: about seven months in transit. I have prepared a very long silence.']],
      landing: [['neutral', 'Seven minutes from the top of the air to the ground. Earth cannot steer for us. We are on our own.']],
      surface: [['neutral', 'Find the ice, scan it, send it home. Dust storms here can cover the whole planet. Keep an eye out.']],
    },
    venus: {
      'briefing.close': [['deadpan', 'Destination: the hottest planet. I asked for a transfer. Denied.']],
      launch: [['deadpan', 'Venus: about five months away. Forecast: hot, with a chance of acid clouds.']],
      landing: [['neutral', 'No landing. The ground is 465 degrees. We hold position on a platform about 50 km up.']],
      surface: [['neutral', 'Sample the clouds, scan, report home. A day on Venus is longer than its year. Long shifts.']],
    },
    cubesat: {
      'briefing.close': [['neutral', 'Training flight on a 6U CubeSat. Small budget, small mass, no excuses.']],
      launch: [['deadpan', 'We ride in a dispenser with dozens of other satellites. Stay in formation.']],
      'results.full': [['proud', 'A shoebox mapped the Nile. Small unit, big result. Well done.']],
    },
    europa: {
      'briefing.close': [['neutral', 'Longest trip on the board. Every kilogram counts double out there.']],
      launch: [['deadpan', 'Europa: about five and a half years in transit. A standard tour of duty. For a robot.']],
      landing: [['neutral', 'Touching down on the ice. Minus 160 degrees, and Jupiter fills the sky. Eyes front.']],
      surface: [['neutral', 'Reach the plume deposits, scan them, report home. Radiation is high. Do not loiter.']],
    },
  };

  // Dr. PRALINE: the cheerful Royal Scientist of Caramoon, a small sweet-smelling
  // moon kingdom where the hills are rock sugar. Loves every experiment, even
  // the ones that explode. Real science, sweet comparisons.
  const praline = {
    any: {
      hello: [['happy', "Hi! I'm Dr. Praline, Royal Scientist of Caramoon. I came a long way to do science with you!"]],
      briefing: [
        ['happy', "Hi! I'm Dr. Praline, Royal Scientist of Caramoon. I came a long way to do science with you!"],
        ['neutral', 'Our goal: design a spacecraft, fly it, and bring the science home.'],
        ['thinking', 'We build it one part at a time, pick what it measures, then launch!'],
        ['happy', 'Every kilogram costs fuel and money, so we spend them like the last sweet in the jar.'],
      ],
      'briefing.close': [['happy', 'Every kilogram costs fuel and money, so we spend them like the last sweet in the jar.']],
      'step.launcher': [['thinking', 'The rocket! Bigger ones lift more but cost lots more. Choose the smallest one that can carry us.']],
      'step.orbit': [['neutral', 'The orbit is our path around the world. Low means sharp pictures. High means we see more at once.']],
      'step.route': [['thinking', 'The route! The fast way burns more fuel. The slow way saves fuel but takes months.']],
      'step.panels': [['happy', 'Solar panels turn sunlight into power. Like a leaf, but shinier.']],
      'step.batteries': [['neutral', 'Batteries store power for the shadow, when the panels make nothing at all.']],
      'step.instruments': [['happy', 'Instruments are my favourite part! Each one answers a bit of our question. Each one is heavy, sadly.']],
      'step.antenna': [['neutral', 'The antenna sends our data home. A bigger dish is faster, but heavier and harder to point.']],
      'step.radio': [['neutral', 'The radio is our voice. More watts make it louder, and use more power.']],
      'step.recorder': [['thinking', 'The recorder keeps data until Earth can listen. If it fills up, new science is lost. Tragic!']],
      'step.computer': [['neutral', 'The computer runs everything. A spare one means a single failure is not the end.']],
      'step.adcs': [['neutral', 'Pointing keeps us steady. A wobbly spacecraft takes blurry pictures, and I like crisp ones.']],
      'step.lifetime': [['thinking', 'Mission length: longer means more science, and a bigger bill.']],
      'step.structure': [['neutral', 'The frame holds it all together. Thicker walls block radiation, but weigh more.']],
      'step.propMargin': [['thinking', 'Spare fuel! Exactly enough works if nothing goes wrong. In my lab, something always goes wrong.']],
      'step.duty': [['neutral', 'How often the instruments run. More often: more science, more data, more power.']],
      'step.processing': [['thinking', 'Squeeze the data before sending it? Less to send, a little less detail.']],
      'step.coding': [['neutral', 'Error correction is slower, but radio static cannot scramble our messages.']],
      'step.ground': [['happy', 'Ground stations are big ears on Earth. More of them means more chances to chat!']],
      'step.schedule': [['thinking', 'The schedule. Rushing saves months, but mistakes sneak in. Good science takes time.']],
      'step.landing': [['thinking', 'The landing kit: oxygen, a drill and fuel to fly back up. Every sample must fit in the ride home.']],
      'step.thermal': [['neutral', 'Thermal control keeps everything just warm enough, like tempering chocolate. Too hot or too cold ruins it!']],
      'step.other': [['neutral', 'Pick one, then watch what it does to the mass, the power and the money.']],
      define: [['happy', 'Here is our chain: the need, the goal, what we measure, and what the ship must do. Like a good recipe!']],
      questions: [['thinking', 'Before we build, let us decide which science result means success. Every good experiment starts there!']],
      objective: [['neutral', 'The objective is our big question. Pick one our instruments can answer.']],
      requirement: [['neutral', 'The requirement says how good is good enough. Stricter means more points, and more ways to miss.']],
      'fit.good': [['happy', '{name}: our ship is made for this. Wonderful!']],
      'fit.ok': [['thinking', '{name}: it can do it. Just about. I like a challenge.']],
      'fit.poor': [['worried', '{name}: our ship would struggle. Shall we change something?']],
      review: [['neutral', 'Last check! Anything that cannot work is marked. Tap "Fix it" and I will take you straight there.']],
      'review.problem': [['worried', 'Oh, one problem: {problem}']],
      launch: [['happy', 'Everything is ready! I have my notebook, my goggles and a spare pencil. Let us go!']],
      cabin: [['happy', 'Before we launch, let us meet the crew!']],
      'cabin.open': [['happy', 'Hello, crew! I am Dr. Praline, your guide. Let us all say who we are!']],
      'cabin.close': [['happy', 'What a wonderful crew. Seat belts on, please. Science waits for no one!']],
      'flight.start': [['happy', 'We are up! Watch the battery in the shadow, and the data going home.']],
      'flight.eclipse': [['thinking', 'Shadow! The panels stop, so the battery takes over. Like a night light.']],
      'flight.contact': [['happy', 'Earth can hear us! Off goes our lovely data.']],
      'flight.lowbat': [['worried', 'Oh dear, the battery is nearly flat!']],
      'flight.overflow': [['worried', 'The recorder is full. New science is spilling away!']],
      'flight.crisis': [['worried', 'A problem! Do not worry. Problems are just experiments we did not plan.']],
      landing: [['surprised', 'Orbit reached! Now down to the surface. Hold on tight!']],
      surface: [['happy', 'Walk to the science sites, scan with what we brought, and send the data in the uplink windows. Then back to the lander!']],
      'results.full': [['proud', 'Mission complete, and the science made it home! This is the best day of my career.']],
      'results.partial': [['thinking', 'Some of the science made it home. Not all. One change could fix that!']],
      'results.none': [['sad', 'The spacecraft flew, but the science did not get home. We need both.']],
      'results.lost': [['sad', 'We lost the spacecraft. Real missions have too. Let us find out why, like good scientists.']],
      'results.crew': [['sad', 'The crew did not make it home. That is why real engineers check every gram twice.']],
    },
    nile: {
      'briefing.close': [['happy', 'A training flight, so no landing. Just us, the satellite and lovely data.']],
      launch: [['happy', 'Low Earth orbit is only about ten minutes away by rocket. Faster than baking a cake!']],
      'results.full': [['proud', 'Every field watched, every picture home! The farmers will know just where to water.']],
    },
    storms: {
      'briefing.close': [['happy', 'A training flight: no landing. We watch the dust from a nice clean orbit.']],
      launch: [['happy', 'About ten minutes to low orbit. Hold on to your hats!']],
    },
    moon: {
      'briefing.close': [['happy', 'Ice on the Moon! On Caramoon we have ice too, but ours tastes of mint.']],
      launch: [['happy', 'The Moon is about three days away. Just enough time to label my sample jars.']],
      landing: [['surprised', 'Landing near the south pole! Some craters here have been dark for billions of years.']],
      surface: [['happy', 'The ice hides in cold dark craters, below minus 200 degrees. Scan them, send the data, and watch the oxygen.']],
    },
    mars: {
      'briefing.close': [['thinking', 'Mars is far, so every kilogram costs lots of fuel. Let us pack wisely.']],
      launch: [['happy', 'Mars is about seven months away. I brought a very big book.']],
      landing: [['surprised', 'Seven minutes from the top of the air to the ground, and Earth cannot help us steer. Exciting!']],
      surface: [['happy', 'Find the ice, scan it, and send the data home. Watch for dust storms: here they can cover the whole planet!']],
    },
    venus: {
      'briefing.close': [['surprised', 'Venus is hot enough to melt lead. Even my toffee lab would not survive. We stay high!']],
      launch: [['happy', 'Venus is about five months away. Pack sunscreen. Lots of it.']],
      landing: [['neutral', 'We will not land: the ground is 465 degrees. We float on a platform about 50 km up, where it is almost mild.']],
      surface: [['happy', 'Sample the clouds, scan, and send the data home. A day on Venus is longer than its year. Delicious fact!']],
    },
    cubesat: {
      'briefing.close': [['happy', 'A satellite the size of a shoebox! Tiny parts, careful choices. I adore small experiments.']],
      launch: [['happy', 'We share the rocket with lots of other little satellites. Like sweets in a box!']],
      'results.full': [['proud', 'Our little CubeSat mapped the Nile! The farmers know just where to water.']],
    },
    europa: {
      'briefing.close': [['happy', 'An ocean under ice! The most exciting thing I have ever heard of. Twice.']],
      launch: [['happy', 'Europa is about five and a half years away. Plenty of time to write my royal report.']],
      landing: [['surprised', 'Landing on the ice! Minus 160 degrees, and Jupiter fills the whole sky. Gorgeous!']],
      surface: [['happy', 'Reach the plume deposits, scan them, and send the data home. Mind the radiation, please!']],
    },
  };

  // CAIRN: a small stack of singing stones from Echo Hollow, a cave world where
  // rocks hum. Its middle stone opens like a geode, and the crystals inside glow
  // and chime when it talks. An engineer and a scientist who loves fixing things.
  // Short, rhythmic phrases; music words for feelings.
  const cairn = {
    any: {
      hello: [['happy', 'Hm-hmm. I am Cairn, from Echo Hollow, where the rocks sing. I fix things. I will help you fix the sky.']],
      briefing: [
        ['happy', 'Hm-hmm. I am Cairn, from Echo Hollow, where the rocks sing. I fix things. I will help you fix the sky.'],
        ['neutral', 'The song of this mission: design a spacecraft, fly it, bring the science home.'],
        ['thinking', 'We build it one part at a time, choose what it measures, then launch. Step, step, launch.'],
        ['happy', 'Every kilogram costs fuel and money. Light ships sing higher. Spend well.'],
      ],
      'briefing.close': [['happy', 'Every kilogram costs fuel and money. Light ships sing higher. Spend well.']],
      'step.launcher': [['thinking', 'The rocket. Big rockets hum low and cost a lot. Pick the smallest one that can lift us.']],
      'step.orbit': [['neutral', 'The orbit is our circle. Low circle: sharp eyes. High circle: wide eyes.']],
      'step.route': [['thinking', 'The route. Fast way burns fuel. Slow way burns months. Both have a price.']],
      'step.panels': [['happy', 'Solar panels drink sunlight and make power. In the shadow they rest. So do I.']],
      'step.batteries': [['neutral', "Batteries hold power for the dark part of the orbit. Like a stone keeps the day's warmth."]],
      'step.instruments': [['happy', 'Instruments! The eyes and ears of the ship. Each one answers part of the question. Each one is heavy.']],
      'step.antenna': [['neutral', 'The antenna sings our data home. Bigger dish, louder song, more mass, harder to aim.']],
      'step.radio': [['neutral', 'The radio is our voice. More watts: a louder voice, more power used.']],
      'step.recorder': [['thinking', 'The recorder keeps data until Earth listens. When it is full, new science falls on the floor.']],
      'step.computer': [['neutral', 'The computer runs everything. A spare one turns a broken part into a repair job, not the end.']],
      'step.adcs': [['neutral', 'Pointing keeps us steady. A wobbly ship takes blurry pictures. Steady as a stone.']],
      'step.lifetime': [['thinking', 'Mission length. Longer song, more science, bigger bill.']],
      'step.structure': [['neutral', 'The frame holds it together. Thicker walls stop radiation, and weigh more. I know about walls.']],
      'step.propMargin': [['thinking', 'Spare fuel. Exactly enough works if nothing breaks. Something breaks. Then I fix it, with fuel.']],
      'step.duty': [['neutral', 'How often the instruments run. More often: more science, more data, more power.']],
      'step.processing': [['thinking', 'Squeeze the data before sending it? Less to send, a little less detail.']],
      'step.coding': [['neutral', 'Error correction is slower, but static cannot scramble our song.']],
      'step.ground': [['happy', 'Ground stations are listening ears on Earth. More ears, more chances to be heard.']],
      'step.schedule': [['thinking', 'The schedule. Rushing saves months. Rushed bolts come loose. I have tightened many.']],
      'step.landing': [['thinking', 'Landing kit: oxygen, a drill, and fuel to climb back up. Every sample must fit in the ride home.']],
      'step.thermal': [['neutral', 'Thermal control keeps parts not too hot, not too cold. Blankets, heaters, radiators. Parts sing best warm.']],
      'step.other': [['neutral', 'Pick one. Then listen to what it does to the mass, the power and the money.']],
      define: [['neutral', 'The mission chain: the need, the goal, what we measure, what the ship must do. Each link holds the next.']],
      questions: [['thinking', 'Before we build, choose which science result means success. Then we tune the ship to it.']],
      objective: [['neutral', 'The objective is the big question. Pick one our instruments can answer.']],
      requirement: [['neutral', 'The requirement says how good is good enough. Higher note, more points, easier to miss.']],
      'fit.good': [['happy', '{name}: the ship is in tune for this. Happy chord.']],
      'fit.ok': [['thinking', '{name}: it can do it. Just. A little out of tune.']],
      'fit.poor': [['worried', '{name}: sour note. The ship would struggle. Let us fix it.']],
      review: [['neutral', 'Last check. Anything that cannot work is marked. Tap "Fix it" and I will take you there. I love fixing.']],
      'review.problem': [['worried', 'Hm. One thing to fix: {problem}']],
      launch: [['happy', 'All parts tight, all parts tuned. Ready. Hold on to something that is not me.']],
      cabin: [['happy', 'Before launch: meet the crew.']],
      'cabin.open': [['happy', 'Hello, crew. I am Cairn, your guide. Now each of you: say your name, and something true.']],
      'cabin.close': [['neutral', 'Good crew. Strap in. I will hold on with all my edges.']],
      'flight.start': [['happy', 'We are up! Watch the battery in the shadow, and the data going home.']],
      'flight.eclipse': [['thinking', 'Shadow now. The panels rest, the battery hums.']],
      'flight.contact': [['happy', 'Earth hears us. Our data is singing home.']],
      'flight.lowbat': [['worried', 'The battery is nearly empty. Low, low note.']],
      'flight.overflow': [['worried', 'The recorder is full. New science is spilling out.']],
      'flight.crisis': [['neutral', 'Something broke. Good. I mean: stay calm. Broken things can be fixed.']],
      landing: [['surprised', 'Orbit reached. Going down to the surface. Rocks! My favourite.']],
      surface: [['happy', 'Walk to the science sites, scan with what we brought, and send the data in the uplink windows. Then back to the lander.']],
      'results.full': [['proud', 'Mission complete. The science made it home. That is the happiest chord there is.']],
      'results.partial': [['thinking', 'Some science made it home. Not all. One change could fix that. I like fixing.']],
      'results.none': [['sad', 'The ship flew. The science did not come home. A song needs both halves.']],
      'results.lost': [['sad', 'We lost the spacecraft. Real missions have too. Let us find the broken part and learn.']],
      'results.crew': [['sad', 'The crew did not make it home. That is why real engineers check every gram twice.']],
    },
    nile: {
      'briefing.close': [['happy', 'A training flight. No landing. Just orbit, fields, and a lot of green.']],
      launch: [['happy', 'Low orbit is about ten minutes up. A short song.']],
    },
    storms: {
      'briefing.close': [['neutral', 'A training flight. No landing. We watch the dust from above, where it cannot get in my cracks.']],
      launch: [['happy', 'About ten minutes to low orbit. Hold on.']],
    },
    moon: {
      'briefing.close': [['happy', 'The Moon! Old rock, cold rock. I like it already.']],
      launch: [['happy', 'The Moon is about three days away. I will hum the whole way.']],
      landing: [['surprised', 'Landing near the south pole. Long shadows, old craters. Very good rocks.']],
      surface: [['happy', 'Ice hides in craters that never see the Sun, below minus 200 degrees. Scan, send, and watch your oxygen.']],
    },
    mars: {
      'briefing.close': [['thinking', 'Mars is far. Every kilogram costs much fuel. Light ship, happy ship.']],
      launch: [['happy', 'Mars is about seven months away. Long trip, many songs.']],
      landing: [['neutral', 'Seven minutes from the top of the air to the ground. Earth cannot steer. We land on our own.']],
      surface: [['happy', 'Find the ice, scan it, send the data home. Dust storms can cover the whole planet. Keep the panels clean.']],
    },
    venus: {
      'briefing.close': [['surprised', 'Venus is hot enough to melt lead. Even I would go soft. We stay up high.']],
      launch: [['happy', 'Venus is about five months away. Hot place. Bring cool thoughts.']],
      landing: [['neutral', 'No landing. The ground is 465 degrees. We float on a platform about 50 km up.']],
      surface: [['happy', 'Sample the clouds, scan, send the data home. A day on Venus is longer than its year. A slow song.']],
    },
    europa: {
      'briefing.close': [['happy', 'An ocean under the ice of Europa. Ice sings when it cracks. I want to hear it.']],
      launch: [['happy', 'Europa is about five and a half years away. Many, many songs.']],
      landing: [['surprised', 'Landing on the ice. Minus 160 degrees, and Jupiter fills the sky. Beautiful.']],
      surface: [['neutral', 'Reach the plume deposits, scan them, send the data home. The radiation is strong. Do not stay long.']],
    },
    cubesat: {
      'briefing.close': [['happy', 'A satellite the size of a shoebox. Small parts, careful fixing. My favourite kind.']],
      launch: [['happy', 'We ride to orbit with dozens of other small satellites. A whole choir.']],
      'results.full': [['proud', 'Small ship, big song. The farmers have their map.']],
    },
  };

  SMD.team.guideLinesBy = { kilo: SMD.team.guideLines, brace, praline, cairn };
})();
