// The running game: the agency career, save and load (with checks for old or
// damaged saves), safe storage for private browsing, and player settings.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const KEY = 'ek-save';
  const BROKEN_KEY = 'ek-save-broken';
  const SAVE_VERSION = 2; // 1: the bare agency object; 2: { format, v, savedAt, agency }
  const hasWin = typeof window !== 'undefined';

  // ---------- Storage ----------
  // localStorage can be missing, blocked (cookies off), or throw on write
  // (private mode, full disk). Everything falls back to memory, so the game
  // still plays; it just forgets when the tab closes.
  const mem = new Map();
  let persistent = null;
  function ls() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      return null;
    }
  }
  function probe() {
    if (persistent !== null) return persistent;
    const s = ls();
    try {
      s.setItem('ek-probe', '1');
      s.removeItem('ek-probe');
      persistent = true;
    } catch (e) {
      persistent = false;
    }
    return persistent;
  }
  SMD.store = {
    get(k) {
      if (mem.has(k)) return mem.get(k);
      try {
        const s = ls();
        return s ? s.getItem(k) : null;
      } catch (e) {
        return null;
      }
    },
    // Returns true when the value reached real storage.
    set(k, v) {
      v = String(v);
      try {
        const s = ls();
        if (s && probe()) {
          s.setItem(k, v);
          mem.delete(k);
          return true;
        }
      } catch (e) {}
      mem.set(k, v);
      return false;
    },
    remove(k) {
      mem.delete(k);
      try {
        const s = ls();
        if (s) s.removeItem(k);
      } catch (e) {}
    },
    persistent: () => probe(),
  };
  const store = SMD.store;

  // ---------- Save checks and migration ----------
  const STATUSES = ['dev', 'ready', 'flying', 'done'];
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const num = (x) => typeof x === 'number' && Number.isFinite(x);

  // Returns { agency, notes[] } or throws with a reason a person can read.
  function migrate(parsed) {
    let ag = parsed;
    let v = 1;
    if (isObj(parsed) && parsed.format === 'ek-save') {
      v = parsed.v;
      ag = parsed.agency;
    }
    if (!isObj(ag)) throw new Error('the save holds no agency');
    if (!num(ag.now)) throw new Error('the save has no date');
    if (!Array.isArray(ag.projects)) throw new Error('the save has no project list');
    const notes = [];
    if (v > SAVE_VERSION) notes.push('newer');
    // Fill anything an older version did not store yet.
    const A = SMD.agency;
    const fresh = A && A.newAgency ? A.newAgency(typeof ag.name === 'string' ? ag.name : 'Space Agency', ag.seed || 1) : {};
    Object.keys(fresh).forEach((k) => {
      if (ag[k] === undefined || ag[k] === null || typeof ag[k] !== typeof fresh[k] || Array.isArray(ag[k]) !== Array.isArray(fresh[k])) ag[k] = fresh[k];
    });
    ['money', 'rep', 'science', 'teams'].forEach((k) => {
      if (!num(ag[k])) ag[k] = num(fresh[k]) ? fresh[k] : 0;
    });
    const missions = (SMD.data && SMD.data.MISSIONS) || null;
    const before = ag.projects.length;
    ag.projects = ag.projects.filter((p) => isObj(p) && p.id !== undefined && isObj(p.design) && STATUSES.includes(p.status) && (!missions || missions[p.missionKey]));
    ag.projects.forEach((p) => {
      if (!isObj(p.reviews)) p.reviews = {};
      if (!Array.isArray(p.events)) p.events = [];
    });
    if (ag.projects.length < before) notes.push('dropped:' + (before - ag.projects.length));
    // Ids must stay unique for new projects.
    const maxId = ag.projects.reduce((m, p) => (num(p.id) ? Math.max(m, p.id) : m), 0);
    if (num(ag.nextId) && ag.nextId <= maxId) ag.nextId = maxId + 1;
    // A quick dry run: the HQ asks these first, so they must not throw.
    if (A) {
      if (A.monthsToNextEvent) A.monthsToNextEvent(ag);
      if (A.isOver) A.isOver(ag);
    }
    return { agency: ag, notes };
  }

  // Flight results hold functions and big objects; keep only what screens need.
  function slimProject(p) {
    const out = { ...p };
    if (p.flight) {
      out.flight = {
        score: p.flight.score,
        timeline: p.flight.timeline,
        lost: !!(p.flight.fs && p.flight.fs.lost) || !!p.flight.lost,
        manifested: p.flight.fs ? p.flight.fs.manifested.map((m) => ({ sub: m.flaw && m.flaw.sub, inst: m.flaw && m.flaw.inst, text: m.text })) : p.flight.manifested || [],
        insertion: p.flight.fs ? p.flight.fs.insertion : p.flight.insertion || null,
        delivered: p.flight.sci ? p.flight.sci.st.delivered : p.flight.delivered || {},
        lostGbit: p.flight.sci ? p.flight.sci.st.lost : p.flight.lostGbit || {},
        scienceEndMs: p.flight.fs ? p.flight.fs.scienceEndMs : p.flight.scienceEndMs || null,
      };
    }
    delete out.ev;
    return out;
  }

  const checked = { raw: null, ok: false };
  let warnedSave = false;
  function warnOnce(kind) {
    if (warnedSave) return;
    warnedSave = true;
    const say = () => {
      if (!SMD.ui || !SMD.ui.toast) return;
      if (kind === 'memory') SMD.ui.toast(SMD.t('sys.save.memory', 'This browser is not keeping saved games (private browsing or storage turned off). You can play on; use Settings, Save to file, to keep your agency.'), { kind: 'warn', ms: 9000 });
      else SMD.ui.toast(SMD.t('sys.save.failed', 'Could not save your agency just now. Use Settings, Save to file, to keep a copy.'), { kind: 'warn', ms: 8000 });
    };
    if (hasWin) setTimeout(say, 400);
  }

  SMD.game = {
    agency: null,
    pending: [], // advance() events the HQ has not shown yet
    loadError: null, // why the last load failed, for the recovery screen
    loadNotes: [],
    SAVE_VERSION,
    newGame(name) {
      this.pending = [];
      const seed = (Math.random() * 1e9) >>> 0;
      this.agency = SMD.agency.newAgency(name, seed);
      this.loadError = null;
      this.save();
      SMD.bus.emit('agency', this.agency);
      return this.agency;
    },
    // The save as text (also used by "Save to file").
    serialize() {
      if (!this.agency) return null;
      const ag = { ...this.agency, projects: this.agency.projects.map(slimProject) };
      return JSON.stringify({ format: 'ek-save', v: SAVE_VERSION, savedAt: Date.now(), agency: ag });
    },
    save() {
      if (!this.agency) return false;
      let text;
      try {
        text = this.serialize();
      } catch (e) {
        console.warn('save: could not serialise the agency', e);
        warnOnce('failed');
        return false;
      }
      const ok = store.set(KEY, text);
      if (!ok) warnOnce(store.persistent() ? 'failed' : 'memory');
      return ok;
    },
    // Parse and check save text; on success it becomes the running agency.
    adopt(raw) {
      const { agency, notes } = migrate(JSON.parse(raw));
      this.agency = agency;
      this.pending = [];
      this.loadError = null;
      this.loadNotes = notes;
      SMD.bus.emit('agency', this.agency);
      return agency;
    },
    load() {
      const raw = store.get(KEY);
      if (!raw) {
        this.loadError = null;
        return null;
      }
      if (raw === checked.raw && !checked.ok) return null; // already reported by hasSave()
      try {
        return this.adopt(raw);
      } catch (e) {
        // Keep the damaged save aside so a teacher can still send it to us.
        console.warn('save could not be read:', e.message);
        this.loadError = e.message || 'unreadable';
        store.set(BROKEN_KEY, raw);
        return null;
      }
    },
    // True only for a save that can be read, so the title never offers a
    // Continue that cannot work. An unreadable save is set aside (brokenSave).
    hasSave() {
      const raw = store.get(KEY);
      if (!raw) return false;
      if (raw === checked.raw) return checked.ok;
      checked.raw = raw;
      try {
        migrate(JSON.parse(raw));
        checked.ok = true;
      } catch (e) {
        console.warn('save could not be read:', e.message);
        this.loadError = e.message || 'unreadable';
        store.set(BROKEN_KEY, raw);
        checked.ok = false;
      }
      return checked.ok;
    },
    // The text of a save that could not be read, for "Download the old save".
    brokenSave() {
      return store.get(BROKEN_KEY);
    },
    dropBrokenSave() {
      store.remove(BROKEN_KEY);
    },
    clear() {
      store.remove(KEY);
      this.agency = null;
      this.loadError = null;
    },
  };

  // ---------- Settings ----------
  // SMD.settings.quality: 'auto' | 'high' | 'low'; sound: true/false;
  // reducedMotion: true/false (reads back the effective value; set 'auto' to
  // follow the system again); the character controller's camera: lookSpeed
  // (0.5..2.5, 1 = normal), invertY, autoCamera (follows behind you, default on).
  // Changes emit bus 'settings'.
  const SKEY = 'ek-settings';
  const RM_QUERY = '(prefers-reduced-motion: reduce)';
  let prefs = { quality: 'auto', motion: 'auto', lookSpeed: 1, invertY: false, autoCamera: true };
  try {
    const saved = JSON.parse(store.get(SKEY) || '{}');
    if (['auto', 'high', 'low'].includes(saved.quality)) prefs.quality = saved.quality;
    if (['auto', 'on', 'off'].includes(saved.motion)) prefs.motion = saved.motion;
    if (Number(saved.lookSpeed) >= 0.3 && Number(saved.lookSpeed) <= 3) prefs.lookSpeed = Number(saved.lookSpeed);
    if (typeof saved.invertY === 'boolean') prefs.invertY = saved.invertY;
    if (typeof saved.autoCamera === 'boolean') prefs.autoCamera = saved.autoCamera;
  } catch (e) {}
  // ?quality=low|high in the address forces a tier (handy on a class set of laptops).
  try {
    const q = hasWin && new URLSearchParams(location.search).get('quality');
    if (['auto', 'high', 'low'].includes(q)) prefs.quality = q;
  } catch (e) {}

  const realMatchMedia = hasWin && window.matchMedia ? window.matchMedia.bind(window) : null;
  const systemReduced = () => {
    try {
      return !!(realMatchMedia && realMatchMedia(RM_QUERY).matches);
    } catch (e) {
      return false;
    }
  };

  // What the GPU can do, probed once on a throwaway canvas.
  let gpuInfo = null;
  function gpu() {
    if (gpuInfo) return gpuInfo;
    gpuInfo = { webgl: false, webgl2: false, renderer: '', maxTex: 0, software: false };
    if (!hasWin || typeof document === 'undefined') return gpuInfo;
    try {
      if (/(^|[?&])nogl(=|&|$)/.test(location.search)) return gpuInfo; // test the no-WebGL path
      const c = document.createElement('canvas');
      let gl = c.getContext('webgl2');
      gpuInfo.webgl2 = !!gl;
      gl = gl || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) {
        gpuInfo.webgl = true;
        gpuInfo.renderer = String(gl.getParameter(gl.RENDERER) || '');
        gpuInfo.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
        gpuInfo.software = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(gpuInfo.renderer);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) {}
    return gpuInfo;
  }

  const isPhone = () => {
    try {
      return Math.min(screen.width, screen.height) < 600 || (matchMedia('(pointer: coarse)').matches && Math.max(screen.width, screen.height) < 1100);
    } catch (e) {
      return false;
    }
  };

  // Auto picks low for phones, small-memory or few-core machines, software
  // rendering and small GPUs. Automated browsers (screenshots) keep high so
  // they show the intended look.
  let autoWhy = '';
  function autoTier() {
    if (!hasWin) return 'high';
    const n = navigator;
    if (n.webdriver) return ((autoWhy = 'test'), 'high');
    const g = gpu();
    if (g.software) return ((autoWhy = 'software'), 'low');
    if (g.maxTex && g.maxTex < 4096) return ((autoWhy = 'gpu'), 'low');
    if (n.deviceMemory && n.deviceMemory <= 4) return ((autoWhy = 'memory'), 'low');
    if (n.hardwareConcurrency && n.hardwareConcurrency <= 4) return ((autoWhy = 'cpu'), 'low');
    if (isPhone()) return ((autoWhy = 'phone'), 'low');
    if (n.connection && n.connection.saveData) return ((autoWhy = 'data'), 'low');
    autoWhy = '';
    return 'high';
  }
  let tierCache = null;

  function saveSettings() {
    store.set(SKEY, JSON.stringify(prefs));
  }
  function changed(key) {
    tierCache = null;
    applyMotionClass();
    if (SMD.bus) SMD.bus.emit('settings', { key, settings: SMD.settings });
  }

  SMD.settings = {
    get quality() {
      return prefs.quality;
    },
    set quality(v) {
      if (!['auto', 'high', 'low'].includes(v)) return;
      prefs.quality = v;
      saveSettings();
      changed('quality');
    },
    get sound() {
      return store.get('ek-muted') !== '1';
    },
    set sound(on) {
      store.set('ek-muted', on ? '0' : '1');
      changed('sound'); // audio.js listens and follows
    },
    get reducedMotion() {
      return prefs.motion === 'on' ? true : prefs.motion === 'off' ? false : systemReduced();
    },
    set reducedMotion(v) {
      prefs.motion = v === 'auto' || v === null ? 'auto' : v ? 'on' : 'off';
      saveSettings();
      changed('reducedMotion');
    },
    get motionSetting() {
      return prefs.motion;
    },
    // Camera turning speed for the mouse, the right stick and drags.
    get lookSpeed() {
      return prefs.lookSpeed;
    },
    set lookSpeed(v) {
      const n = Number(v);
      if (!(n >= 0.3 && n <= 3)) return;
      prefs.lookSpeed = n;
      saveSettings();
      changed('lookSpeed');
    },
    get invertY() {
      return prefs.invertY;
    },
    set invertY(v) {
      prefs.invertY = !!v;
      saveSettings();
      changed('invertY');
    },
    // The walking camera swings in behind you by itself (off: only when asked).
    get autoCamera() {
      return prefs.autoCamera;
    },
    set autoCamera(v) {
      prefs.autoCamera = !!v;
      saveSettings();
      changed('autoCamera');
    },
    // 'high' | 'low': the tier actually in use.
    tier() {
      if (prefs.quality !== 'auto') return prefs.quality;
      return (tierCache = tierCache || autoTier());
    },
    autoReason() {
      this.tier();
      return autoWhy;
    },
    // Numbers the 3D layer reads.
    profile() {
      const low = this.tier() === 'low';
      const dpr = (hasWin && window.devicePixelRatio) || 1;
      return {
        tier: low ? 'low' : 'high',
        pixelRatio: Math.min(low ? (isPhone() ? 1.5 : 1) : 2, dpr),
        minPixelRatio: Math.min(low ? 0.6 : 0.85, dpr),
        adaptive: prefs.quality === 'auto' && !(hasWin && navigator.webdriver),
        antialias: !low,
        shadowMapMax: low ? 1024 : 2048,
        softShadows: !low,
        textures: low ? '2k' : '4k',
        maxTextureWidth: low ? 2048 : 8192,
        anisotropy: low ? 2 : 8,
        particles: low ? 0.5 : 1,
        stars: low ? 0.6 : 1,
        segments: low ? 96 : 256,
      };
    },
    gpu,
    set(key, value) {
      if (key in this) this[key] = value;
    },
  };

  // Every module asks matchMedia('(prefers-reduced-motion: reduce)') directly.
  // When the player picks On or Off in Settings, answer that instead of the system.
  if (realMatchMedia) {
    try {
      window.matchMedia = function (q) {
        if (prefs.motion !== 'auto' && typeof q === 'string' && q.replace(/\s+/g, '') === RM_QUERY.replace(/\s+/g, '')) {
          const matches = prefs.motion === 'on';
          return { matches, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
        }
        return realMatchMedia(q);
      };
    } catch (e) {}
  }

  function applyMotionClass() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    document.documentElement.classList.toggle('ek-reduce-motion', prefs.motion === 'on');
    document.documentElement.classList.toggle('ek-tier-low', SMD.settings.tier() === 'low');
  }
  if (hasWin) applyMotionClass();
})();
