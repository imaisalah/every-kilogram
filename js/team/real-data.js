// Real space-weather events for the solar-storm problem (docs/research, NASA Data field).
//
// What this is: a small SNAPSHOT of real, documented solar events with the NASA page each
// one comes from, so the "Solar storm!" alarm in flight names something that really
// happened. The game's physics does not change; this is context and learning.
// Optional: when the browser is online it can also ask NASA's DONKI service for the
// most recent real solar flare (see liveRecentFlare). Offline, or if the request fails,
// it quietly uses the snapshot. No account, no key beyond NASA's public demo key.
//
// Facts here are limited to what the cited NASA pages say.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.team = SMD.team || {};

  const DONKI_TOOL = 'https://ccmc.gsfc.nasa.gov/tools/DONKI/';

  // Each event: when, what, why it matters to a spacecraft, and where to read more.
  const SPACE_WEATHER = [
    {
      id: 'may2024',
      date: '2024-05-10',
      title: 'The May 2024 solar storm',
      text: 'Flares and coronal mass ejections from one sunspot region produced a G5 geomagnetic storm, the highest level on the scale and the first since 2003. The strongest flare that week was an X5.8.',
      lesson: 'Spacecraft in Earth orbit ride out events like this in safe mode, with sensitive electronics off.',
      source: 'https://science.nasa.gov/science-research/heliophysics/how-nasa-tracked-the-most-intense-solar-storm-in-decades/',
      sourceName: 'NASA Science: How NASA tracked the most intense solar storm in decades',
    },
    {
      id: 'jul2012',
      date: '2012-07-23',
      title: 'The July 2012 near miss',
      text: 'A huge, very fast coronal mass ejection crossed Earth\u2019s orbit. Earth was not in the way, but NASA\u2019s STEREO-A spacecraft was, and it measured the whole event.',
      lesson: 'A storm like this is rare, but whatever is in its path has to survive it. That is why spacecraft carry a safe mode.',
      source: 'https://science.nasa.gov/science-news/science-at-nasa/2014/23jul_superstorm/',
      sourceName: 'Science@NASA: Near Miss, the Solar Superstorm of July 2012',
    },
    {
      id: 'oct2003',
      date: '2003-10-28',
      title: 'The Halloween storms of 2003',
      text: 'Until May 2024, the Halloween storms of October 2003 were the last time a G5 geomagnetic storm had been seen.',
      lesson: 'Big storms come in waves, so the first alarm is not always the last one.',
      source: 'https://science.nasa.gov/science-research/heliophysics/how-nasa-tracked-the-most-intense-solar-storm-in-decades/',
      sourceName: 'NASA Science: How NASA tracked the most intense solar storm in decades',
    },
  ];

  function hash(str) {
    let h = 2166136261;
    const s = String(str == null ? '' : str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Deterministic: the same round always meets the same real event.
  function spaceWeatherFor(key) {
    return SPACE_WEATHER[hash(key) % SPACE_WEATHER.length];
  }

  // ---------- Optional live lookup (browser only, never blocks the game) ----------
  const CACHE_KEY = 'ek-donki-flare';
  const CACHE_MS = 6 * 3600 * 1000;
  const DAY = 24 * 3600 * 1000;

  function ymd(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }
  function readCache() {
    try {
      const raw = globalThis.localStorage && globalThis.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      return c && Date.now() - c.at < CACHE_MS ? c : null;
    } catch (e) {
      return null;
    }
  }
  function writeCache(value) {
    try {
      globalThis.localStorage && globalThis.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), value }));
    } catch (e) {}
  }

  // The strongest flare NASA DONKI lists in the last 30 days, or null.
  // DONKI returns a list of flares with beginTime, peakTime and classType (for example "M1.2").
  const CLASS_RANK = { A: 0, B: 1, C: 2, M: 3, X: 4 };
  function flareRank(c) {
    const m = /^([ABCMX])(\d+(?:\.\d+)?)/.exec(String(c || '').trim());
    return m ? CLASS_RANK[m[1]] * 1000 + parseFloat(m[2]) : -1;
  }
  function pickStrongest(list) {
    let best = null;
    for (const f of Array.isArray(list) ? list : []) {
      if (flareRank(f && f.classType) < 0) continue;
      if (!best || flareRank(f.classType) > flareRank(best.classType)) best = f;
    }
    return best;
  }
  // NASA's DONKI flare list. The api.nasa.gov route answered 404 in November 2026,
  // so the CCMC web service it proxies is tried first. Every failure is cached
  // like a success, so a broken service is asked at most once every 6 hours.
  function donkiUrls(start, end, key) {
    return [
      `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR?startDate=${start}&endDate=${end}`,
      `https://api.nasa.gov/DONKI/FLR?startDate=${start}&endDate=${end}&api_key=${encodeURIComponent(key || 'DEMO_KEY')}`,
    ];
  }
  async function liveRecentFlare(opts) {
    const o = opts || {};
    const cached = readCache();
    if (cached) return cached.value;
    if (typeof fetch !== 'function') return null;
    const now = Date.now();
    for (const url of donkiUrls(ymd(now - 30 * DAY), ymd(now), o.apiKey)) {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), o.timeoutMs || 4000) : null;
      try {
        const res = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
        if (!res.ok) continue;
        const best = pickStrongest(await res.json());
        const value = best ? { classType: best.classType, peakTime: best.peakTime || best.beginTime, flrID: best.flrID, link: best.link || DONKI_TOOL } : null;
        writeCache(value);
        return value;
      } catch (e) {
        // try the next route
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    writeCache(null); // no live data now: the saved real events are used, and we don't ask again for 6 h
    return null;
  }

  SMD.team.realData = { SPACE_WEATHER, DONKI_TOOL, spaceWeatherFor, liveRecentFlare, pickStrongest, flareRank, donkiUrls };
  if (typeof module !== 'undefined' && module.exports) module.exports = SMD.team.realData;
})();
