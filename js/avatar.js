// The player's astronaut: the agency director who also flies. Appearance data,
// save and load, and the ranks and badges earned from the career itself.
// The 3D character lives in js/3d/astronaut.js; the creator in js/screen-avatar.js.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const t = (k, e, p) => (SMD.t ? SMD.t(k, e, p) : e);
  const KEY = 'ek-avatar';

  // ---------- Appearance options ----------
  // Suits: body fabric, accent (stripes, cuffs, pads), and a darker trim.
  const SUITS = [
    { id: 'classic', name: () => t('avatar.suit.classic', 'Classic white'), body: '#eceee9', accent: '#e3662a', trim: '#5a636b' },
    { id: 'gold', name: () => t('avatar.suit.gold', 'Gold'), body: '#d8b25a', accent: '#2e3338', trim: '#6b5320' },
    { id: 'teal', name: () => t('avatar.suit.teal', 'Nile teal'), body: '#1f8a83', accent: '#f1e2b3', trim: '#0f4f4b' },
    { id: 'navy', name: () => t('avatar.suit.navy', 'Navy'), body: '#26385c', accent: '#d9a21b', trim: '#141f33' },
    { id: 'orange', name: () => t('avatar.suit.orange', 'Launch orange'), body: '#e2622b', accent: '#2c4a80', trim: '#7a2f12' },
    { id: 'lavender', name: () => t('avatar.suit.lavender', 'Lavender'), body: '#b9a8d9', accent: '#4f3f86', trim: '#5b4f74' },
  ];
  const SKINS = [
    { id: 's1', color: '#f5d6c0', name: () => t('avatar.skin.1', 'Skin tone 1, lightest') },
    { id: 's2', color: '#e8bd98', name: () => t('avatar.skin.2', 'Skin tone 2') },
    { id: 's3', color: '#cf9a6c', name: () => t('avatar.skin.3', 'Skin tone 3') },
    { id: 's4', color: '#a96f45', name: () => t('avatar.skin.4', 'Skin tone 4') },
    { id: 's5', color: '#7d4f2f', name: () => t('avatar.skin.5', 'Skin tone 5') },
    { id: 's6', color: '#53341f', name: () => t('avatar.skin.6', 'Skin tone 6, darkest') },
  ];
  // 'covered' is a headscarf (and a full comms cap under the helmet);
  // 'helmet' keeps the helmet on, visor down.
  const HAIR = [
    { id: 'short', name: () => t('avatar.hair.short', 'Short') },
    { id: 'curly', name: () => t('avatar.hair.curly', 'Curly') },
    { id: 'bun', name: () => t('avatar.hair.bun', 'Bun') },
    { id: 'covered', name: () => t('avatar.hair.covered', 'Headscarf') },
    { id: 'helmet', name: () => t('avatar.hair.helmet', 'Helmet on') },
  ];
  const HAIR_COLORS = [
    { id: 'black', color: '#1f1b19', name: () => t('avatar.hc.black', 'Black') },
    { id: 'brown', color: '#4b2f22', name: () => t('avatar.hc.brown', 'Dark brown') },
    { id: 'auburn', color: '#8c4124', name: () => t('avatar.hc.auburn', 'Auburn') },
    { id: 'blond', color: '#d3ac67', name: () => t('avatar.hc.blond', 'Blond') },
    { id: 'grey', color: '#a8a5a1', name: () => t('avatar.hc.grey', 'Grey') },
  ];
  const VISORS = [
    { id: 'clear', name: () => t('avatar.visor.clear', 'Clear') },
    { id: 'gold', name: () => t('avatar.visor.gold', 'Gold sun visor') },
  ];
  // The same colours as the agency patch on the New agency screen.
  const PATCH_COLORS = [
    { id: '#17807a', name: () => t('avatar.pc.teal', 'Nile teal') },
    { id: '#24539a', name: () => t('avatar.pc.lapis', 'Lapis blue') },
    { id: '#b4302c', name: () => t('avatar.pc.red', 'Red pen') },
    { id: '#5b4a8a', name: () => t('avatar.pc.violet', 'Dusk violet') },
    { id: '#4f7a32', name: () => t('avatar.pc.green', 'Palm green') },
    { id: '#23282e', name: () => t('avatar.pc.graphite', 'Graphite') },
  ];
  const PATCHES = [
    { id: 'agency', name: () => t('avatar.patch.agency', 'Agency patch') },
    { id: 'mission', name: () => t('avatar.patch.mission', 'Latest mission') },
  ];

  const ids = (list) => list.map((x) => x.id);
  const pick = (list, v, fallback) => (ids(list).includes(v) ? v : fallback);
  const cleanName = (s) =>
    String(s == null ? '' : s)
      .replace(/[\u0000-\u001f\u007f<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24);

  function agencyNow() {
    return (SMD.game && SMD.game.agency) || null;
  }

  function defaults() {
    const ag = agencyNow();
    const pc = ag && ag.patch && ids(PATCH_COLORS).includes(ag.patch.color) ? ag.patch.color : PATCH_COLORS[0].id;
    return { name: t('avatar.defaultName', 'Director'), suit: 'classic', skin: 's3', hair: 'short', hairColor: 'black', visor: 'clear', patch: 'agency', patchColor: pc };
  }

  // Any object in, a complete and valid appearance out (old saves, bad input).
  function normalize(a) {
    const d = defaults();
    a = a && typeof a === 'object' ? a : {};
    const name = cleanName(a.name);
    return {
      name: name || d.name,
      suit: pick(SUITS, a.suit, d.suit),
      skin: pick(SKINS, a.skin, d.skin),
      hair: pick(HAIR, a.hair, d.hair),
      hairColor: pick(HAIR_COLORS, a.hairColor, d.hairColor),
      visor: pick(VISORS, a.visor, d.visor),
      patch: pick(PATCHES, a.patch, d.patch),
      patchColor: pick(PATCH_COLORS, a.patchColor, d.patchColor),
    };
  }

  function readLocal() {
    try {
      const raw = SMD.store ? SMD.store.get(KEY) : localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function writeLocal(a) {
    const text = JSON.stringify(a);
    try {
      if (SMD.store) SMD.store.set(KEY, text);
      else localStorage.setItem(KEY, text);
    } catch (e) {}
  }

  // The career's astronaut first, then the last one made on this browser.
  function get() {
    const ag = agencyNow();
    if (ag && ag.avatar) return normalize(ag.avatar);
    return normalize(readLocal());
  }

  function set(a) {
    const n = normalize(a);
    const ag = agencyNow();
    if (ag) {
      ag.avatar = n;
      if (SMD.game.save) SMD.game.save();
    }
    writeLocal(n);
    if (SMD.bus) SMD.bus.emit('avatar', n);
    return n;
  }

  function random() {
    const r = (list) => list[Math.floor(Math.random() * list.length)].id;
    const cur = get();
    return normalize({ name: cur.name, suit: r(SUITS), skin: r(SKINS), hair: r(HAIR), hairColor: r(HAIR_COLORS), visor: r(VISORS), patch: cur.patch, patchColor: r(PATCH_COLORS) });
  }

  // Colours the 3D model and the portraits need.
  function colors(a) {
    a = normalize(a);
    const suit = SUITS.find((s) => s.id === a.suit);
    return {
      body: suit.body,
      accent: suit.accent,
      trim: suit.trim,
      skin: SKINS.find((s) => s.id === a.skin).color,
      hair: HAIR_COLORS.find((h) => h.id === a.hairColor).color,
      patch: a.patchColor,
    };
  }

  // The design whose patch goes on the shoulder: the last mission flown,
  // else the last one approved. null before the first project.
  function patchDesign(ag) {
    ag = ag || agencyNow();
    if (!ag || !Array.isArray(ag.projects) || !ag.projects.length) return null;
    const flown = ag.projects.filter((p) => p.status === 'done' || p.status === 'flying');
    const list = flown.length ? flown : ag.projects;
    const p = list.reduce((a, b) => ((b.launchMs || b.startMs || 0) >= (a.launchMs || a.startMs || 0) ? b : a));
    return p && p.design ? p.design : null;
  }

  // ---------- Career: ranks and badges ----------
  const projectsOf = (ag) => (ag && Array.isArray(ag.projects) ? ag.projects : []);
  const lost = (p) => !!((p.result && p.result.lost) || (SMD.agency && SMD.agency.flightLost && SMD.agency.flightLost(p)));
  const launched = (p) => p.status === 'flying' || p.status === 'done';
  const flownOK = (ag, key) => projectsOf(ag).some((p) => p.missionKey === key && p.status === 'done' && !lost(p));
  const headlines = (ag) => (ag && Array.isArray(ag.headlines) ? ag.headlines : []);
  const PLANET_HEADLINES = ['mars', 'venus', 'jupiter'];

  // Each rank needs the one before it. Tests read only saved career state.
  const RANKS = [
    { id: 'candidate', name: () => t('avatar.rank.candidate', 'Astronaut candidate'), need: () => t('avatar.rank.candidate.need', 'Where every director starts.'), test: () => true },
    { id: 'engineer', name: () => t('avatar.rank.engineer', 'Flight engineer'), need: () => t('avatar.rank.engineer.need', 'Get a mission approved.'), test: (ag) => projectsOf(ag).length > 0 },
    { id: 'specialist', name: () => t('avatar.rank.specialist', 'Mission specialist'), need: () => t('avatar.rank.specialist.need', 'Fly a mission all the way to its results.'), test: (ag) => projectsOf(ag).some((p) => p.status === 'done' && !lost(p)) },
    { id: 'commander', name: () => t('avatar.rank.commander', 'Commander'), need: () => t('avatar.rank.commander.need', 'Earn your first headline.'), test: (ag) => headlines(ag).length > 0 },
    { id: 'director', name: () => t('avatar.rank.director', 'Flight director'), need: () => t('avatar.rank.director.need', 'Earn a headline at a planet.'), test: (ag) => headlines(ag).some((k) => PLANET_HEADLINES.includes(k)) },
    { id: 'legend', name: () => t('avatar.rank.legend', 'Agency legend'), need: () => t('avatar.rank.legend.need', 'Earn all three planet headlines: Mars, Venus and Europa.'), test: (ag) => PLANET_HEADLINES.every((k) => headlines(ag).includes(k)) },
  ];

  // icon: the art key used by badgeSVG().
  const BADGES = [
    { id: 'firstLaunch', icon: 'rocket', name: () => t('avatar.badge.firstLaunch', 'First launch'), desc: () => t('avatar.badge.firstLaunch.d', 'A spacecraft you designed left the pad.'), test: (ag) => projectsOf(ag).some(launched) },
    { id: 'firstHeadline', icon: 'star', name: () => t('avatar.badge.firstHeadline', 'First headline'), desc: () => t('avatar.badge.firstHeadline.d', 'A mission answered its headline question.'), test: (ag) => headlines(ag).length > 0 },
    { id: 'homePlanet', icon: 'earth', name: () => t('avatar.badge.homePlanet', 'Home planet'), desc: () => t('avatar.badge.homePlanet.d', 'Flew both Earth missions: the Nile and the storms.'), test: (ag) => flownOK(ag, 'nile') && flownOK(ag, 'weather') },
    { id: 'moon', icon: 'moon', name: () => t('avatar.badge.moon', 'Moon'), desc: () => t('avatar.badge.moon.d', 'Finished a mission at the Moon.'), test: (ag) => flownOK(ag, 'moon') },
    { id: 'mars', icon: 'mars', name: () => t('avatar.badge.mars', 'Mars'), desc: () => t('avatar.badge.mars.d', 'Finished a mission at Mars.'), test: (ag) => flownOK(ag, 'mars') },
    { id: 'venus', icon: 'venus', name: () => t('avatar.badge.venus', 'Venus'), desc: () => t('avatar.badge.venus.d', 'Finished a mission at Venus.'), test: (ag) => flownOK(ag, 'venus') },
    { id: 'europa', icon: 'europa', name: () => t('avatar.badge.europa', 'Europa'), desc: () => t('avatar.badge.europa.d', 'Finished a mission at Jupiter’s moon Europa.'), test: (ag) => flownOK(ag, 'jupiter') },
    { id: 'moonCrew', icon: 'capsule', name: () => t('avatar.badge.moonCrew', 'Around the Moon'), desc: () => t('avatar.badge.moonCrew.d', 'Rode your own crew capsule around the Moon and came home.'), test: (ag) => flownOK(ag, 'crew') },
    { id: 'onBudget', icon: 'coin', name: () => t('avatar.badge.onBudget', 'On budget'), desc: () => t('avatar.badge.onBudget.d', 'Finished a mission without spending a dollar over its budget.'), test: (ag) => projectsOf(ag).some((p) => p.status === 'done' && !lost(p) && !(p.overrun > 0) && !p.breach) },
    { id: 'thorough', icon: 'shield', name: () => t('avatar.badge.thorough', 'Thorough tester'), desc: () => t('avatar.badge.thorough.d', 'Launched a spacecraft after the full test campaign.'), test: (ag) => projectsOf(ag).some((p) => launched(p) && p.testPlan === 'thorough') },
    {
      id: 'comeback',
      icon: 'arrow',
      name: () => t('avatar.badge.comeback', 'Comeback'),
      desc: () => t('avatar.badge.comeback.d', 'Lost a spacecraft, then flew a mission that earned its headline.'),
      test: (ag) => {
        const done = projectsOf(ag).filter((p) => p.status === 'done');
        const firstLoss = done.filter(lost).reduce((m, p) => Math.min(m, p.endMs || p.launchMs || Infinity), Infinity);
        return firstLoss < Infinity && done.some((p) => !lost(p) && p.result && p.result.success && (p.endMs || 0) > firstLoss);
      },
    },
    {
      id: 'allDiscoveries',
      icon: 'eye',
      name: () => t('avatar.badge.allDiscoveries', 'Nothing missed'),
      desc: () => t('avatar.badge.allDiscoveries.d', 'Unlocked every discovery a mission can make.'),
      test: (ag) =>
        projectsOf(ag).some((p) => {
          const all = SMD.content && SMD.content.discoveries && SMD.content.discoveries[p.missionKey];
          return !!(all && all.length && p.result && Array.isArray(p.result.discoveries) && all.every((d) => p.result.discoveries.includes(d.id)));
        }),
    },
  ];

  const safeTest = (fn, ag) => {
    try {
      return !!fn(ag);
    } catch (e) {
      return false;
    }
  };

  // { rank, rankIndex, nextRank, rankUp, badges (earned), all (every badge with
  //   .earned), newlyEarned (earned since the last acknowledge()) }.
  // Pure: it never changes the agency. Call acknowledge(ag) once the player saw them.
  function evaluate(ag) {
    ag = ag === undefined ? agencyNow() : ag;
    let rankIndex = 0;
    if (ag) for (let i = 1; i < RANKS.length && safeTest(RANKS[i].test, ag); i++) rankIndex = i;
    const view = (x) => ({ id: x.id, icon: x.icon, name: x.name(), desc: x.desc() });
    const rv = (r) => (r ? { id: r.id, name: r.name(), need: r.need() } : null);
    const all = BADGES.map((b) => Object.assign(view(b), { earned: !!ag && safeTest(b.test, ag) }));
    const seen = ag && ag.avatarSeen && Array.isArray(ag.avatarSeen.badges) ? ag.avatarSeen.badges : [];
    const seenRank = ag && ag.avatarSeen && typeof ag.avatarSeen.rank === 'number' ? ag.avatarSeen.rank : 0;
    const badges = all.filter((b) => b.earned);
    return {
      rank: rv(RANKS[rankIndex]),
      rankIndex,
      nextRank: rv(RANKS[rankIndex + 1]),
      rankUp: rankIndex > seenRank,
      badges,
      all,
      newlyEarned: badges.filter((b) => !seen.includes(b.id)),
    };
  }

  // Marks the current rank and badges as shown (results screen, HQ toast).
  function acknowledge(ag) {
    ag = ag || agencyNow();
    if (!ag) return;
    const ev = evaluate(ag);
    ag.avatarSeen = { rank: ev.rankIndex, badges: ev.badges.map((b) => b.id) };
    if (SMD.game && SMD.game.agency === ag && SMD.game.save) SMD.game.save();
  }

  // ---------- Badge art (inline SVG, for any screen) ----------
  const ICON = {
    rocket: '<path d="M24 9c5 4 7 10 6 18h-12c-1-8 1-14 6-18z" fill="#eceee9"/><circle cx="24" cy="19" r="2.6" fill="#24539a"/><path d="M18 24l-4 6h5zM30 24l4 6h-5z" fill="#b4302c"/><path d="M21 28h6l-3 6z" fill="#f0a52b"/>',
    star: '<path d="M24 11l3.6 8 8.4.8-6.4 5.6 2 8.4-7.6-4.6-7.6 4.6 2-8.4-6.4-5.6 8.4-.8z" fill="#f4e4b5"/>',
    earth: '<circle cx="24" cy="23" r="11" fill="#2a6bb0"/><path d="M22 13c3 3 1 6 0 9s2 6 3 11" stroke="#6f8a3c" stroke-width="4" fill="none" stroke-linecap="round"/>',
    capsule: '<path d="M17 31 L20 15 L28 15 L31 31 Z" fill="#e8e6df"/><rect x="16" y="31" width="16" height="3" rx="1" fill="#7a4a2a"/><rect x="21" y="18" width="6" height="4" rx="1" fill="#2b4a6b"/><path d="M24 15 L24 9" stroke="#e05a2b" stroke-width="2"/>',
    moon: '<circle cx="24" cy="23" r="11" fill="#b9b9b4"/><circle cx="20" cy="20" r="3" fill="#8e8e89"/><circle cx="28" cy="27" r="2" fill="#8e8e89"/>',
    mars: '<circle cx="24" cy="23" r="11" fill="#b8481f"/><path d="M15 21q5-3 11-1t8 2" stroke="#8e3214" stroke-width="2" fill="none"/><path d="M19 13a11 11 0 0 1 10 0" stroke="#f3e9de" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    venus: '<circle cx="24" cy="23" r="11" fill="#e2b867"/><path d="M14 21q10-4 20 0M15 27q9-3 18 0" stroke="#f4dda0" stroke-width="2" fill="none"/>',
    europa: '<circle cx="24" cy="23" r="11" fill="#e3dccb"/><path d="M15 18l8 5 5-6M17 29l7-4 9 2M27 13l2 7" stroke="#a5583a" stroke-width="1.3" fill="none"/>',
    coin: '<circle cx="24" cy="23" r="10" fill="#d9a21b"/><circle cx="24" cy="23" r="7.5" fill="none" stroke="#7a5a0c" stroke-width="1.2"/><text x="24" y="27.5" text-anchor="middle" font-size="12" font-weight="800" fill="#7a5a0c" font-family="Archivo, sans-serif">$</text>',
    shield: '<path d="M24 11l10 4v7c0 6-4 10-10 13-6-3-10-7-10-13v-7z" fill="#17807a"/><path d="M19 23l4 4 7-8" stroke="#f4e4b5" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    arrow: '<path d="M14 30l7-8 5 4 8-11" stroke="#3fc1b4" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 14h6v6" stroke="#3fc1b4" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    eye: '<path d="M11 23q13-13 26 0q-13 13-26 0z" fill="#e9eef2"/><circle cx="24" cy="23" r="5" fill="#24539a"/><circle cx="24" cy="23" r="2.2" fill="#101922"/>',
  };
  // A small stitched roundel; locked badges are drawn as an empty outline.
  function badgeSVG(id, earned, label) {
    const b = BADGES.find((x) => x.id === id);
    const art = (b && ICON[b.icon]) || ICON.star;
    const name = label || (b ? b.name() : id);
    const esc = SMD.ui && SMD.ui.esc ? SMD.ui.esc : (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
    if (!earned)
      return `<svg viewBox="0 0 48 48" class="av-badge-art is-locked" role="img" aria-label="${esc(name)}"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.55"/><g opacity="0.25">${art}</g></svg>`;
    return `<svg viewBox="0 0 48 48" class="av-badge-art" role="img" aria-label="${esc(name)}"><circle cx="24" cy="24" r="22" fill="#d9a21b"/><circle cx="24" cy="24" r="19" fill="#14273c"/><circle cx="24" cy="24" r="20.5" fill="none" stroke="#7a5a0c" stroke-width="0.8" stroke-dasharray="1.6 1.2"/>${art}</svg>`;
  }

  // Head-and-shoulders portrait as a data URL (loads the 3D module on demand).
  function portrait(a, size) {
    return import(new URL('js/3d/astronaut.js', document.baseURI).href).then((m) => m.createPortrait(normalize(a || get()), size || 256));
  }

  SMD.avatar = {
    KEY,
    SUITS,
    SKINS,
    HAIR,
    HAIR_COLORS,
    VISORS,
    PATCHES,
    PATCH_COLORS,
    RANKS,
    BADGES,
    default: defaults,
    normalize,
    get,
    set,
    random,
    colors,
    patchDesign,
    evaluate,
    acknowledge,
    badgeSVG,
    portrait,
  };
  if (typeof module === 'object' && module.exports) module.exports = SMD.avatar;
})();
