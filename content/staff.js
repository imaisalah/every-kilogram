// HQ staff (people the player can talk to on the campus): SMD.content.staff.
// Each person hangs around one building ("post") and walks a short loop in
// front of its door. route: points as [sideways, outward] metres from that
// door (outward = toward the plaza). look: colours and style for js/3d/npc.js.
// topics: which SMD.content.tips they like to share.
// Translation keys: staff.<id>.name, staff.<id>.role, staff.<id>.from, staff.<id>.hello.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.content = SMD.content || {};

  SMD.content.staff = [
    {
      id: 'director',
      name: 'Nadia Farouk',
      role: 'Flight director',
      from: 'Cairo, Egypt',
      hello: 'I run mission control. When something needs your decision, I will be the first to tell you.',
      post: 'board',
      route: [
        [-6, 5],
        [4, 7],
        [7, 3],
      ],
      topics: ['ops', 'window', 'people'],
      look: { skin: '#a8724f', hair: 'bun', hairColor: '#231a15', shirt: '#2c4a72', pants: '#2b2f36', shoes: '#26211e', headset: true, prop: 'tablet', height: 1.0, build: 1.0 },
    },
    {
      id: 'engineer',
      name: 'Kwame Mensah',
      role: 'Chief engineer',
      from: 'Accra, Ghana',
      hello: 'I build your spacecraft and break it on purpose in the test hall, so space can’t break it later.',
      post: 'design',
      route: [
        [-7, 5],
        [5, 4],
        [8, 8],
      ],
      topics: ['testing', 'mass', 'power'],
      look: { skin: '#5b3a28', hair: 'short', hairColor: '#141110', shirt: '#e3662a', pants: '#3a4654', shoes: '#2a2522', hat: 'hardhat', beard: true, height: 1.05, build: 1.1 },
    },
    {
      id: 'scientist',
      name: 'Dr Mariam Saleh',
      role: 'Mission scientist',
      from: 'Alexandria, Egypt',
      hello: 'I decide what we measure. Every instrument on your spacecraft answers one of my questions.',
      post: 'research',
      route: [
        [-5, 4],
        [4, 6],
      ],
      topics: ['science', 'power', 'comms'],
      look: { skin: '#c48d64', hair: 'covered', scarf: '#17807a', shirt: '#6d4f8a', coat: '#f2f0ea', pants: '#3b3440', shoes: '#2a2522', glasses: true, height: 0.96, build: 0.98 },
    },
    {
      id: 'budget',
      name: 'Tarek Mansour',
      role: 'Budget officer',
      from: 'Luxor, Egypt',
      hello: 'Every kilogram costs money. I keep the books, so we can still pay for the next mission.',
      post: 'board',
      route: [
        [10, 12],
        [16, 8],
        [12, 4],
      ],
      topics: ['money', 'people'],
      look: { skin: '#9b6646', hair: 'short', hairColor: '#3a3a3a', shirt: '#e9e4d8', tie: '#b4302c', pants: '#3d3a36', shoes: '#1f1b19', glasses: true, prop: 'clipboard', height: 0.98, build: 1.12 },
    },
    {
      id: 'intern',
      name: 'Omar Idris',
      role: 'Student intern',
      from: 'Khartoum, Sudan',
      hello: 'I’m here for the summer, and I want to see every launch window. Ask me where the planets are!',
      post: 'archive',
      route: [
        [-9, 6],
        [-3, 9],
        [-11, 12],
      ],
      topics: ['window', 'science', 'mass'],
      look: { skin: '#4a2f22', hair: 'curly', hairColor: '#120f0e', shirt: '#d9a21b', pants: '#33507a', shoes: '#f0ece4', hat: 'cap', capColor: '#17807a', backpack: '#b4302c', height: 0.95, build: 0.92 },
    },
    {
      id: 'outreach',
      name: 'Aiko Tanaka',
      role: 'Public outreach officer',
      from: 'Osaka, Japan',
      hello: 'I tell the world what we do. Good science and honest news build our reputation.',
      post: 'map',
      route: [
        [-4, 4],
        [5, 7],
        [2, 11],
      ],
      topics: ['science', 'people', 'comms'],
      look: { skin: '#e2b48f', hair: 'long', hairColor: '#1b1716', shirt: '#f3ede2', vest: '#17807a', pants: '#2f3a44', shoes: '#26211e', prop: 'camera', height: 0.97, build: 0.95 },
    },
  ];
})();
