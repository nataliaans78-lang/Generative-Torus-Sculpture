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
    revokeUrl: null,
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
    state.revokeUrl = revokeOnLoad ? nextUrl : null;
    state.offsetSeconds = Math.max(0, startOffsetSeconds);
    state.offsetAtPlay = state.offsetSeconds;
    state.playStartContextTime = 0;
    if (audio.isPlaying) {
      audio.stop();
    }
    if (typeof audio.offset === 'number') {
      audio.offset = 0;
    }
    return new Promise((resolve) => {
      loader.load(
        nextUrl,
        (buffer) => {
          if (token !== state.loadToken) {
            if (state.revokeUrl) {
              URL.revokeObjectURL(state.revokeUrl);
              state.revokeUrl = null;
            }
            resolve({ loaded: false, playing: audio.isPlaying });
            return;
          }
          audio.setBuffer(buffer);
          if (typeof audio.offset === 'number') {
            audio.offset = resolveOffset(state.offsetSeconds);
          }
          state.offsetSeconds = resolveOffset(state.offsetSeconds);
          state.isLoaded = true;
          state.isLoading = false;
          if (state.revokeUrl) {
            URL.revokeObjectURL(state.revokeUrl);
            state.revokeUrl = null;
          }
          if (state.pendingPlay) {
            if (audio.context?.state === 'suspended') {
              audio.context.resume();
            }
            state.offsetAtPlay = state.offsetSeconds;
            state.playStartContextTime = audio.context?.currentTime ?? 0;
            audio.play();
            state.pendingPlay = false;
          }
          resolve({ loaded: true, playing: audio.isPlaying });
        },
        undefined,
        () => {
          if (token !== state.loadToken) {
            resolve({ loaded: false, playing: audio.isPlaying });
            return;
          }
          state.isLoading = false;
          state.isLoaded = false;
          state.pendingPlay = false;
          if (state.revokeUrl) {
            URL.revokeObjectURL(state.revokeUrl);
            state.revokeUrl = null;
          }
          resolve({ loaded: false, playing: false });
        },
      );
      state.bufferUrl = nextUrl;
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
    if (state.bufferUrl) {
      state.pendingPlay = true;
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
    setFile,
    play,
    pause,
    getCurrentTime,
    hasPendingPlay: () => state.pendingPlay || state.isLoading,
    isLoaded: () => state.isLoaded,
    isPlaying: () => audio.isPlaying,
  };
}
