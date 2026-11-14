// Background music player. Mars missions use a dedicated field recording;
// other screens and missions keep assets/Music/Background_music.mp3.
// Follows SMD.settings.sound and browser autoplay policies.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});

  const DEFAULT_TRACK_PATH = 'assets/Music/Background_music.mp3';
  const MARS_TRACK_PATH = 'assets/Music/Mars_Mission.mp3';
  let trackPath = DEFAULT_TRACK_PATH;
  let marsLanded = false;
  let audioEl = null;
  let playing = false;
  let defaultVolume = 0.55;

  function isMuted() {
    if (SMD.audio && typeof SMD.audio.isMuted === 'function') {
      return SMD.audio.isMuted();
    }
    if (SMD.settings && typeof SMD.settings.sound === 'boolean') {
      return !SMD.settings.sound;
    }
    try {
      return localStorage.getItem('ek-muted') === '1';
    } catch (e) {
      return false;
    }
  }

  // Settings › Music (js/ui-common.js): on/off and a volume slider (0..1).
  const musicOn = () => !(SMD.settings && SMD.settings.music === false);
  const level = () => {
    const v = SMD.settings && Number(SMD.settings.musicVolume);
    return isMuted() || !musicOn() ? 0 : Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : defaultVolume;
  };

  function getAudioElement() {
    if (!audioEl) {
      audioEl = new Audio(trackPath);
      audioEl.loop = true;
      audioEl.preload = 'auto';
      audioEl.volume = level();
    }
    return audioEl;
  }

  function play() {
    if (!musicOn()) return;
    const el = getAudioElement();
    el.volume = level();

    const promise = el.play();
    if (promise && promise.then) {
      promise
        .then(() => {
          playing = true;
        })
        .catch(() => {
          // Playback blocked until user interacts with the page
          playing = false;
        });
    } else {
      playing = true;
    }
  }

  function pause() {
    if (audioEl) {
      audioEl.pause();
    }
    playing = false;
  }

  function stop() {
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
    playing = false;
  }

  function setVolume(vol) {
    defaultVolume = Math.max(0, Math.min(1, vol));
    if (audioEl) audioEl.volume = level();
  }

  function setMission(scenarioId, phase) {
    if (scenarioId === 'mars' && phase === 'surface') marsLanded = true;
    else if (scenarioId !== 'mars') marsLanded = false;
    const nextTrack = marsLanded && scenarioId === 'mars' ? MARS_TRACK_PATH : DEFAULT_TRACK_PATH;
    if (nextTrack === trackPath) return;
    trackPath = nextTrack;
    if (!audioEl) return;
    const resume = !audioEl.paused && !audioEl.ended;
    audioEl.pause();
    playing = false;
    audioEl.src = trackPath;
    audioEl.load();
    if (resume && !isMuted()) play();
  }

  // Sync with game settings / mute toggle
  if (SMD.bus) {
    SMD.bus.on('settings', (e) => {
      if (e && (e.key === 'sound' || e.key === 'music' || e.key === 'musicVolume')) {
        if (isMuted() || !musicOn()) {
          if (audioEl) audioEl.volume = 0;
        } else {
          if (!playing) {
            play();
          } else if (audioEl) {
            audioEl.volume = level();
          }
        }
      }
    });
  }

  // Autoplay on first user interaction (click, key, touch)
  const unlockAndPlay = () => {
    if (!isMuted() && musicOn() && !playing) {
      play();
    }
  };

  if (typeof window !== 'undefined') {
    ['pointerdown', 'keydown', 'touchstart', 'click'].forEach((evt) => {
      window.addEventListener(evt, unlockAndPlay, { capture: true, once: false });
    });
  }

  SMD.music = {
    play,
    start: play,
    pause,
    stop,
    setVolume,
    setMission,
    isPlaying: () => playing,
    getElement: () => audioEl,
  };
})();
