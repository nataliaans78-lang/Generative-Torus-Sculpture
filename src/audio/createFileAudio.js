import * as THREE from 'three';

const DEFAULT_AUDIO_SETTINGS = {
  volume: 0.5,
  loop: true,
};

export function createFileAudio({
  listener,
  url,
  volume = DEFAULT_AUDIO_SETTINGS.volume,
  loop = DEFAULT_AUDIO_SETTINGS.loop,
} = {}) {
  if (!listener) {
    return null;
  }

  const audio = new THREE.Audio(listener);
  audio.setVolume(volume);
  audio.setLoop(loop);
  const loader = new THREE.AudioLoader();
  const analyser = new THREE.AudioAnalyser(audio, 256);
  analyser.analyser.fftSize = 256;

  const state = {
    bufferUrl: url,
    isLoaded: false,
    isLoading: false,
    pendingPlay: false,
    loadToken: 0,
    offsetSeconds: 0,
    offsetAtPlay: 0,
    playStartContextTime: 0,
  };

  const resolveOffset = (seconds = 0) => {
    const duration = audio.buffer?.duration ?? 0;
    if (!Number.isFinite(seconds) || seconds < 0) return 0;
    if (!duration || duration <= 0) return seconds;
    if (audio.getLoop()) {
      return seconds % duration;
    }
    return Math.min(seconds, duration);
  };

  const getCurrentTime = () => {
    if (!state.isLoaded) {
      return state.offsetSeconds;
    }
    if (!audio.isPlaying) {
      return state.offsetSeconds;
    }
    const elapsed = Math.max(0, (audio.context?.currentTime ?? 0) - state.playStartContextTime);
    return resolveOffset(state.offsetAtPlay + elapsed);
  };

  const prepareFile = (nextUrl, startOffsetSeconds = 0) => {
    state.loadToken += 1;
    state.bufferUrl = nextUrl || null;
    state.isLoaded = false;
    state.isLoading = false;
    state.pendingPlay = false;
    state.offsetSeconds = Math.max(0, startOffsetSeconds);
    state.offsetAtPlay = state.offsetSeconds;
    state.playStartContextTime = 0;
  };

  const setFile = (
    nextUrl,
    playWhenReady = false,
    revokeOnLoad = false,
    startOffsetSeconds = 0,
  ) => {
    if (!nextUrl) {
      return Promise.resolve({ loaded: false, playing: false });
    }
    state.loadToken += 1;
    const token = state.loadToken;
    state.isLoading = true;
    state.isLoaded = false;
    state.pendingPlay = playWhenReady;
    state.offsetSeconds = Math.max(0, startOffsetSeconds);
    state.offsetAtPlay = state.offsetSeconds;
    state.playStartContextTime = 0;
    if (audio.isPlaying) {
      audio.stop();
    }
    if (typeof audio.offset === 'number') {
      audio.offset = 0;
    }
    let urlReleased = false;
    const releaseUrl = () => {
      if (!revokeOnLoad || urlReleased) return;
      URL.revokeObjectURL(nextUrl);
      urlReleased = true;
    };
    return new Promise((resolve) => {
      const handleError = () => {
        releaseUrl();
        if (token !== state.loadToken) {
          resolve({ loaded: false, playing: audio.isPlaying });
          return;
        }
        state.isLoading = false;
        state.isLoaded = false;
        state.pendingPlay = false;
        state.bufferUrl = null;
        resolve({ loaded: false, playing: false });
      };
      const handleLoad = (buffer) => {
        if (token !== state.loadToken) {
          releaseUrl();
          resolve({ loaded: false, playing: audio.isPlaying });
          return;
        }
        try {
          audio.setBuffer(buffer);
          if (typeof audio.offset === 'number') {
            audio.offset = resolveOffset(state.offsetSeconds);
          }
          state.offsetSeconds = resolveOffset(state.offsetSeconds);
          state.isLoaded = true;
          state.isLoading = false;
          if (state.pendingPlay) {
            if (audio.context?.state === 'suspended') {
              audio.context.resume();
            }
            state.offsetAtPlay = state.offsetSeconds;
            state.playStartContextTime = audio.context?.currentTime ?? 0;
            audio.play();
            state.pendingPlay = false;
          }
          releaseUrl();
          resolve({ loaded: true, playing: audio.isPlaying });
        } catch {
          handleError();
        }
      };
      state.bufferUrl = nextUrl;
      try {
        loader.load(nextUrl, handleLoad, undefined, handleError);
      } catch {
        handleError();
      }
    });
  };

  const play = () => {
    if (state.isLoaded) {
      if (!audio.isPlaying) {
        if (audio.context?.state === 'suspended') {
          audio.context.resume();
        }
        state.offsetSeconds = resolveOffset(state.offsetSeconds);
        if (typeof audio.offset === 'number') {
          audio.offset = state.offsetSeconds;
        }
        state.offsetAtPlay = state.offsetSeconds;
        state.playStartContextTime = audio.context?.currentTime ?? 0;
        audio.play();
      }
      state.pendingPlay = false;
      return true;
    }
    if (state.isLoading) {
      state.pendingPlay = true;
      return true;
    }
    if (state.bufferUrl) {
      const nextUrl = state.bufferUrl;
      const startOffsetSeconds = state.offsetSeconds;
      state.pendingPlay = true;
      if (audio.context?.state === 'suspended') {
        audio.context.resume();
      }
      void setFile(nextUrl, true, false, startOffsetSeconds).catch(() => {});
      return true;
    }
    return false;
  };

  const pause = () => {
    state.pendingPlay = false;
    if (audio.isPlaying) {
      state.offsetSeconds = getCurrentTime();
      audio.pause();
    }
  };

  return {
    audio,
    analyser,
    listener,
    prepareFile,
    setFile,
    play,
    pause,
    getCurrentTime,
    hasPendingPlay: () => state.pendingPlay,
    isLoading: () => state.isLoading,
    isLoaded: () => state.isLoaded,
    isPlaying: () => audio.isPlaying,
  };
}
