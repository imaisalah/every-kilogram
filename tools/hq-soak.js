// HQ soak test: plays a whole career through the HQ screen by clicking
// "Skip to next event" (or the due review/decision button) until the end.
// Placeholder screens are auto-answered: reviews pick the first option, films
// and results go straight back to HQ, event cards pick the first choice.
// Launch day plays its quick path ("Decide for me"); when the HQ still sends a
// launch straight to the film, the soak routes it through launch day itself.
// The crew ride is skipped (its skip, else the launch film).
// Projects are started through the agency API whenever a team is free.
// Usage:
//   node tools/shot.mjs http://127.0.0.1:<port>/ out.png 300 tools/hq-soak.js 1440 900
// Prints a JSON summary; "stuck" must be false and "end" true.
const A = SMD.agency;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
localStorage.setItem('ek-hq-coach', '1');
SMD.cards = SMD.cards || {};
const realCard = SMD.cards.event;
SMD.cards.event = async (projectId, eventId) => {
  const ag = SMD.game.agency;
  const p = ag.projects.find((x) => x.id === projectId);
  const r = A.resolveEvent(ag, p, eventId, null);
  SMD.game.save();
  return { choiceId: r && r.choice.id, notes: r && r.notes };
};
SMD.game.newGame('Soak Space Agency');
SMD.go('hq');
await sleep(1500);

const PLAN = {
  nile: { instruments: ['hires', 'irspec'], arrays: 8, dish: 1, amp: 25, recorder: 256, launcher: 'light' },
  weather: { instruments: ['irspec', 'context'], arrays: 5, dish: 1, amp: 25, recorder: 64, launcher: 'light' },
  moon: { instruments: ['neutron', 'context'], arrays: 6, dish: 1, amp: 25, recorder: 64, launcher: 'light' },
  mars: { instruments: ['sounder', 'hires', 'neutron'], arrays: 6, dish: 3, amp: 100, recorder: 256, launcher: 'medium', capture: 'aerobrake', margin: 20 },
  venus: { instruments: ['sar', 'context'], arrays: 14, dish: 3, amp: 100, recorder: 1024, launcher: 'medium', capture: 'aerobrake', margin: 20 },
  jupiter: { instruments: ['iceRadar', 'mag', 'context'], arrays: 60, dish: 3, amp: 100, recorder: 256, launcher: 'heavy', shield: 75, ground: 12, margin: 10, route: 'direct' },
};
const TECH_ORDER = ['dish3', 'amp100', 'aero', 'sar', 'rec1t', 'heavy', 'vault', 'iceRadar', 'cells', 'testlab'];
const stats = { iterations: 0, screens: {}, approved: [], reviews: 0, events: 0, launchdays: 0, ldRouted: 0, rides: 0, errors: [] };
window.addEventListener('error', (e) => stats.errors.push(`${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno} on ${SMD.ui.state.screen}`));

function manage() {
  const ag = SMD.game.agency;
  TECH_ORDER.forEach((id) => A.buyTech(ag, id));
  for (const key of Object.keys(PLAN)) {
    if (A.busyTeams(ag) >= ag.teams) break;
    if (A.contractState(ag, key) !== 'open') continue;
    const d = Object.assign(A.newDesign(ag, key), PLAN[key]);
    A.applyTech(ag, d);
    const r = A.approve(ag, d, 'standard', 'standard');
    if (r.ok) stats.approved.push(`${key}@${A.fmtMonth(ag.now)}`);
  }
  SMD.game.save();
}

let lastKey = '';
let same = 0;
let stuck = false;
let end = false;
for (let i = 0; i < 1500; i++) {
  stats.iterations = i;
  const scr = SMD.ui.state.screen;
  const prm = SMD.ui.state.params || {};
  stats.screens[scr] = (stats.screens[scr] || 0) + 1;
  const ag = SMD.game.agency;
  if (scr === 'end') {
    end = true;
    break;
  }
  if (scr === 'review') {
    const p = ag.projects.find((x) => x.id === prm.projectId);
    if (p && !p.reviews[prm.review]) {
      const qs = A.reviewQuestions(ag, p, prm.review);
      A.resolveReview(ag, p, prm.review, Object.fromEntries(qs.map((q) => [q.id, q.options[0].id])));
      SMD.game.save();
      stats.reviews++;
    }
    SMD.go('hq', { resume: true });
    await sleep(150);
    continue;
  }
  if (scr === 'launchday') {
    const L = SMD.ui.screens.launchday.current;
    if (L && L.quick) {
      L.quick({ instant: true });
      stats.launchdays++;
    } else SMD.go('film', { projectId: prm.projectId, kind: 'launch' });
    await sleep(150);
    continue;
  }
  if (scr === 'ride') {
    const R = SMD.ui.screens.ride.current;
    const btn = document.querySelector('#app [data-act="skip"]');
    if (R && typeof R.skip === 'function') R.skip();
    else if (btn) btn.click();
    else SMD.go('film', { projectId: prm.projectId, kind: 'launch' });
    stats.rides++;
    await sleep(150);
    if (SMD.ui.state.screen === 'ride') SMD.go('film', { projectId: prm.projectId, kind: 'launch' });
    continue;
  }
  // The HQ may not route launches through launch day yet: do it here.
  if (scr === 'film' && prm.kind === 'launch' && SMD.ui.screens.launchday && A.launchDayOpen) {
    const p = ag.projects.find((x) => x.id === prm.projectId);
    if (p && A.launchDayOpen(ag, p)) {
      stats.ldRouted++;
      SMD.go('launchday', { projectId: p.id, next: 'film' });
      await sleep(150);
      continue;
    }
  }
  if (scr !== 'hq') {
    SMD.go('hq', { resume: true });
    await sleep(150);
    continue;
  }
  if (!document.querySelector('[data-act="skip"]:not([disabled]), [data-act="due"], [data-act="month"]:not([disabled])')) {
    await sleep(120);
  } else {
    manage();
    const btn = document.querySelector('.hq-clock [data-act="due"]') || document.querySelector('[data-act="skip"]:not([disabled])');
    if (btn) btn.click();
    if (btn && btn.dataset.act === 'due') stats.events++;
    await sleep(200);
  }
  // Stuck detection: same month, same screen, nothing pending, for too long.
  const key = `${SMD.ui.state.screen}|${SMD.game.agency.now}|${SMD.game.pending.length}`;
  if (key === lastKey) same++;
  else {
    same = 0;
    lastKey = key;
  }
  if (same > 60) {
    stuck = true;
    break;
  }
  if (A.isOver(SMD.game.agency) && SMD.ui.state.screen === 'hq' && document.querySelector('[data-act="end"]')) {
    document.querySelector('[data-act="end"]').click();
    await sleep(100);
  }
}
const ag = SMD.game.agency;
if (realCard) SMD.cards.event = realCard;
return JSON.stringify({
  stuck,
  end,
  date: A.fmtMonth(ag.now),
  money: Math.round(ag.money),
  rep: ag.rep,
  headlines: ag.headlines,
  projects: ag.projects.map((p) => `${p.design.name}:${p.missionKey}:${p.status}:${p.result ? Math.round(p.result.score.total) : '-'}${p.launchDay ? ':ld' + p.launchDay.scrubDays : ''}`),
  ...stats,
});
