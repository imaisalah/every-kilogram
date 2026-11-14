// Background music player – plays your custom track: assets/Music/Background_music.mp3
// Follows SMD.settings.sound and browser autoplay policies.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});

  const TRACK_PATH = 'assets/Music/Background_music.mp3';
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

  function getAudioElement() {
    if (!audioEl) {
      audioEl = new Audio(TRACK_PATH);
      audioEl.loop = true;
      audioEl.preload = 'auto';
      audioEl.volume = isMuted() ? 0 : defaultVolume;
    }
    return audioEl;
  }

  function play() {
    const el = getAudioElement();
    if (isMuted()) {
      el.volume = 0;
    } else {
      el.volume = defaultVolume;
    }

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
    if (audioEl && !isMuted()) {
      audioEl.volume = defaultVolume;
    }
  }

  // Sync with game settings / mute toggle
  if (SMD.bus) {
    SMD.bus.on('settings', (e) => {
      if (e && e.key === 'sound') {
        if (isMuted()) {
          if (audioEl) audioEl.volume = 0;
        } else {
          if (!playing) {
            play();
          } else if (audioEl) {
            audioEl.volume = defaultVolume;
          }
        }
      }
    });
  }

  // Autoplay on first user interaction (click, key, touch)
  const unlockAndPlay = () => {
    if (!isMuted() && !playing) {
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
    isPlaying: () => playing,
    getElement: () => audioEl,
  };
})();
