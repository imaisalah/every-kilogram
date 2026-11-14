// The crew (docs/TEAM-V2.md "Crew" and "As built (guide & crew)"): four original
// astronauts, one per job. Each has a face (a 2D SVG portrait here, and an
// appearance that js/3d/astronaut.js createAstronaut builds in 3D), a name, a
// job, one line of personality, a short bio and a human detail they tell the
// others in the cabin before launch.
//
// Classic script, no DOM needed: node tests require it directly.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};
  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : fill(e, p));
  function fill(s, p) {
    return p ? String(s).replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? p[k] : m)) : s;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const JOBS = ['planner', 'engineer', 'scientist', 'comms'];
  const JOB_NAMES = { planner: 'Mission planner', engineer: 'Engineer', scientist: 'Scientist', comms: 'Communications' };
  // Same colours as the role dots everywhere else (css/team.css --role-*).
  const JOB_COLORS = { planner: '#24d8ff', engineer: '#46f58a', scientist: '#ff4fb2', comms: '#ff9a1f' };

  // Skin tones and hair colours match js/3d/character.js so 2D and 3D agree.
  const SKIN = { s1: '#efc9ad', s2: '#dcab86', s3: '#be8862', s4: '#996444', s5: '#71472b', s6: '#4b2d1a' };
  const HAIRC = { black: '#16120f', brown: '#3b2416', auburn: '#7b3519', blond: '#c7a165', grey: '#a29e99' };
  // Shirt-sleeve flight polo colour per suit (character.js POLO).
  const POLO = { classic: '#3d5f92', gold: '#2c3f60', teal: '#1d5f5b', navy: '#22314f', orange: '#2c4a80', lavender: '#4a4478' };

  const roster = [
    {
      id: 'salma',
      name: 'Salma Fawzy',
      short: 'Salma',
      job: 'planner',
      from: 'Alexandria, Egypt',
      personality: 'Calm in a crisis. Has a plan B for her plan B.',
      bio: 'Flew cargo planes over the Sahara before she joined the astronaut corps.',
      detail: 'She once made a timetable for a family picnic. Her family still talks about it.',
      intro: 'Salma Fawzy, mission planner. I picked our rocket and our path. I also wrote a timetable for this chat.',
      appearance: { name: 'Salma', body: 'f', height: 1.66, suit: 'teal', skin: 's3', hair: 'covered', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#17807a' },
      scarf: '#2f6f8f',
    },
    {
      id: 'mateo',
      name: 'Mateo Silva',
      short: 'Mateo',
      job: 'engineer',
      from: 'Recife, Brazil',
      personality: 'Fixes anything. Listens to machines first.',
      bio: 'Kept a research ship running for a year in the Southern Ocean with one toolbox.',
      detail: 'At nine he took apart his grandmother’s sewing machine. It went back together with two spare screws, and it still works.',
      intro: "Mateo Silva, engineer. If it hums, it's mine. I talk to the batteries. They never answer. Good sign.",
      appearance: { name: 'Mateo', body: 'm', height: 1.8, suit: 'orange', skin: 's5', hair: 'curly', hairColor: 'black', beard: 'stubble', visor: 'clear', patch: 'agency', patchColor: '#4f7a32' },
    },
    {
      id: 'priya',
      name: 'Priya Raman',
      short: 'Priya',
      job: 'scientist',
      from: 'Chennai, India',
      personality: 'Gets excited about rocks. Very excited.',
      bio: 'A geologist who has studied volcanoes in Iceland and meteorites in Antarctica.',
      detail: 'Geologists really do lick rocks: a wet rock shows its crystals better.',
      intro: "Priya Raman, scientist. Geologists lick rocks to see the crystals. I won't lick anything out there. Probably.",
      appearance: { name: 'Priya', body: 'f', height: 1.62, suit: 'lavender', skin: 's4', hair: 'bun', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: '#5b4a8a' },
    },
    {
      id: 'jonas',
      name: 'Jonas Berg',
      short: 'Jonas',
      job: 'comms',
      from: 'Tromsø, Norway',
      personality: 'Says little. Every word gets through.',
      bio: 'Built his first radio at twelve and has talked to people on every continent with it.',
      detail: 'He grew up north of the Arctic Circle, where the Sun does not rise for about two months in winter.',
      intro: "Jonas Berg, communications. I keep us talking to Earth. I grew up where winter has no sunrise, so the dark doesn't scare me.",
      appearance: { name: 'Jonas', body: 'm', height: 1.84, suit: 'navy', skin: 's1', hair: 'short', hairColor: 'grey', beard: 'full', visor: 'clear', patch: 'agency', patchColor: '#24539a' },
    },
  ];
  roster.forEach((m) => (m.color = JOB_COLORS[m.job]));

  const byId = (id) => roster.find((m) => m.id === id) || null;
  const byJob = (job) => roster.find((m) => m.job === job) || null;
  const jobName = (job) => t(`crew.job.${job}`, JOB_NAMES[job] || job);
  // A member's text, translated: field is name | personality | bio | detail | intro | from.
  function text(member, field) {
    const m = typeof member === 'string' ? byId(member) : member;
    if (!m) return '';
    if (field === 'job') return jobName(m.job);
    return t(`crew.${m.id}.${field}`, m[field] || '');
  }

  // Who is on board, in seat order (planner, engineer, scientist, comms).
  // chosen: the solo player's crew id, or { job: playerName } / { crewId: playerName }
  // for a team, or an array of players [{ name, role, crewId }].
  function lineup(chosen) {
    const players = {};
    let youId = null;
    if (typeof chosen === 'string') youId = byId(chosen) ? chosen : (byJob(chosen) || {}).id || null;
    else if (Array.isArray(chosen)) {
      chosen.forEach((p) => {
        if (!p) return;
        const m = (p.crewId && byId(p.crewId)) || (p.role && byJob(p.role)) || null;
        if (m && !players[m.id]) players[m.id] = p.name || '';
        if (m && p.you) youId = m.id;
      });
    } else if (chosen && typeof chosen === 'object') {
      Object.keys(chosen).forEach((k) => {
        const m = byId(k) || byJob(k);
        if (m) players[m.id] = chosen[k];
      });
    }
    return roster.map((m) => ({ member: m, player: players[m.id] || '', you: m.id === youId }));
  }

  // The cabin conversation: KILO opens, each crewmate introduces themselves, KILO closes.
  function cabinScript(lineupArr) {
    const lu = Array.isArray(lineupArr) && lineupArr.length ? lineupArr : lineup(null);
    const lines = [{ who: 'kilo', mood: 'neutral', text: t('crew.cabin.open', 'Before launch: introductions. I am KILO. That was mine.') }];
    lu.forEach((row) => lines.push({ who: row.member.id, mood: 'happy', text: text(row.member, 'intro'), player: row.player, you: !!row.you }));
    lines.push({ who: 'kilo', mood: 'deadpan', text: t('crew.cabin.close', 'Lovely. Strap in. I would count down, but the rocket insists.') });
    return lines;
  }

  // ---------- 2D portrait (SVG) ----------
  // A calm head-and-shoulders drawing: soft round backdrop, polo, face, hair.
  let uidN = 0;
  function portrait(who, opts = {}) {
    const m = typeof who === 'string' ? byId(who) : who;
    if (!m) return '';
    const size = opts.size || 96;
    const a = m.appearance;
    const skin = SKIN[a.skin] || SKIN.s3;
    const hairC = HAIRC[a.hairColor] || HAIRC.black;
    const polo = POLO[a.suit] || '#2c4a80';
    const id = `cp${++uidN}`;
    const shade = 'rgba(0,0,0,0.14)';
    const parts = [];
    // Backdrop: deep navy disc with a small job-colour dot on it.
    parts.push(`<defs><clipPath id="${id}c"><circle cx="50" cy="50" r="48"/></clipPath><radialGradient id="${id}g" cx="0.5" cy="0.35" r="0.75"><stop offset="0" stop-color="#26306b"/><stop offset="1" stop-color="#121842"/></radialGradient></defs>`);
    parts.push(`<circle cx="50" cy="50" r="48" fill="url(#${id}g)"/>`);
    parts.push(`<g clip-path="url(#${id}c)">`);
    // Behind the head: the bun or a long scarf back.
    if (a.hair === 'covered') parts.push(`<path d="M27 44 Q26 20 50 18 Q74 20 73 44 L76 78 Q50 86 24 78 Z" fill="${m.scarf || '#2f6f8f'}"/>`);
    if (a.hair === 'bun') parts.push(`<circle cx="50" cy="17" r="8.5" fill="${hairC}"/>`);
    // Shoulders and polo.
    parts.push(`<path d="M14 100 Q16 76 36 72 L64 72 Q84 76 86 100 Z" fill="${polo}"/>`);
    parts.push(`<path d="M42 72 L50 82 L58 72 Z" fill="${shade}"/>`);
    // Mission patch on the chest and the job dot.
    parts.push(`<circle cx="67" cy="85" r="4.2" fill="${esc(a.patchColor || '#17807a')}" stroke="rgba(255,255,255,0.55)" stroke-width="1"/>`);
    // Neck.
    parts.push(`<rect x="43" y="58" width="14" height="16" rx="5" fill="${skin}"/>`);
    parts.push(`<rect x="43" y="64" width="14" height="5" fill="${shade}"/>`);
    // Head.
    parts.push(`<ellipse cx="50" cy="43" rx="15.5" ry="18" fill="${skin}"/>`);
    // Ears (hidden under a scarf).
    if (a.hair !== 'covered') parts.push(`<ellipse cx="34.6" cy="45" rx="2.6" ry="4" fill="${skin}"/><ellipse cx="65.4" cy="45" rx="2.6" ry="4" fill="${skin}"/>`);
    // Hair on top.
    if (a.hair === 'short') parts.push(`<path d="M34.5 41 Q33 24 50 23.5 Q67 24 65.5 41 Q63 31 55 30 Q47 33 38 31 Q35 34 34.5 41 Z" fill="${hairC}"/>`);
    if (a.hair === 'curly') {
      parts.push(`<path d="M34 42 Q31 22 50 22 Q69 22 66 42 Q64 33 58 31 Q50 34 42 31 Q36 33 34 42 Z" fill="${hairC}"/>`);
      [[38, 27], [45, 23.5], [52, 23], [59, 25], [64, 31], [35.5, 33]].forEach(([x, y]) => parts.push(`<circle cx="${x}" cy="${y}" r="4.6" fill="${hairC}"/>`));
    }
    if (a.hair === 'bun') parts.push(`<path d="M34.5 42 Q33 24 50 24 Q67 24 65.5 42 Q62 30 50 29.5 Q38 30 34.5 42 Z" fill="${hairC}"/>`);
    if (a.hair === 'covered') parts.push(`<path d="M33 46 Q32 23 50 22 Q68 23 67 46 Q66 36 60 32 Q50 29 40 32 Q34 36 33 46 Z" fill="${m.scarf || '#2f6f8f'}"/><path d="M33 46 Q34 60 42 64 L36 70 Q30 60 33 46 Z M67 46 Q66 60 58 64 L64 70 Q70 60 67 46 Z" fill="${m.scarf || '#2f6f8f'}"/>`);
    // Beard.
    if (a.beard === 'full') parts.push(`<path d="M35.5 46 Q36 62 50 62.5 Q64 62 64.5 46 Q62 55 56 55.5 Q50 53.5 44 55.5 Q38 55 35.5 46 Z" fill="${hairC}" opacity="0.92"/>`);
    if (a.beard === 'stubble') parts.push(`<path d="M37 49 Q38 61 50 61.5 Q62 61 63 49 Q60 56 50 56.5 Q40 56 37 49 Z" fill="${hairC}" opacity="0.3"/>`);
    // Eyebrows, eyes, a small smile.
    const browC = a.hairColor === 'grey' ? '#7d7974' : hairC;
    parts.push(`<path d="M40 37.5 Q43.5 35.6 47 37.2 M53 37.2 Q56.5 35.6 60 37.5" stroke="${browC}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`);
    parts.push(`<ellipse cx="43.6" cy="42.3" rx="1.9" ry="2.2" fill="#1b1714"/><ellipse cx="56.4" cy="42.3" rx="1.9" ry="2.2" fill="#1b1714"/>`);
    parts.push(`<circle cx="44.2" cy="41.6" r="0.6" fill="#fff"/><circle cx="57" cy="41.6" r="0.6" fill="#fff"/>`);
    parts.push(`<path d="M50 44 Q48.6 48.5 50.6 49" stroke="${shade}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`);
    parts.push(`<path d="M45 52.2 Q50 55.6 55 52.2" stroke="#7a3b2e" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
    parts.push('</g>');
    // The job ring: thin, in the job colour.
    parts.push(`<circle cx="50" cy="50" r="48" fill="none" stroke="${m.color}" stroke-opacity="0.75" stroke-width="2"/>`);
    const label = `${text(m, 'name')}, ${jobName(m.job)}`;
    return `<svg class="tf-crew-face" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(label)}">${parts.join('')}</svg>`;
  }

  SMD.team.crew = { roster, JOBS, JOB_COLORS, byId, byJob, jobName, text, lineup, cabinScript, portrait };
})();
