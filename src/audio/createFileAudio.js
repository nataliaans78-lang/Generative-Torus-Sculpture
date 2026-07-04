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

  const mediaElement = document.createElement('audio');
  mediaElement.preload = 'none';
  mediaElement.crossOrigin = 'anonymous';
  mediaElement.loop = Boolean(loop);
  mediaElement.volume = THREE.MathUtils.clamp(volume, 0, 1);

  const audio = new THREE.Audio(listener);
  audio.setVolume(1);
  audio.setLoop(loop);
  if (typeof audio.setMediaElementSource === 'function') {
    audio.setMediaElementSource(mediaElement);
  } else {
    audio.setNodeSource(audio.context.createMediaElementSource(mediaElement));
  }

  const analyser = new THREE.AudioAnalyser(audio, 256);
  analyser.analyser.fftSize = 256;

  const state = {
    bufferUrl: null,
    isLoaded: false,
    isLoading: false,
    pendingPlay: false,
    loadToken: 0,
    playToken: 0,
    offsetSeconds: 0,
  };
  let activeObjectUrl = null;
  let disposed = false;

  const revokeObjectUrl = (objectUrl) => {
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
  };

  const applyOffset = () => {
    if (mediaElement.readyState < HTMLMediaElement.HAVE_METADATA) return;
    let offset = state.offsetSeconds;
    const duration = mediaElement.duration;
    if (Number.isFinite(duration) && duration > 0) {
      offset = mediaElement.loop ? offset % duration : Math.min(offset, duration);
    }
    try {
      mediaElement.currentTime = offset;
      state.offsetSeconds = offset;
    } catch {
      // The browser will retry after metadata becomes seekable.
    }
  };

  const assignSource = (nextUrl, startOffsetSeconds = 0, ownsObjectUrl = false) => {
    state.loadToken += 1;
    state.playToken += 1;
    state.bufferUrl = nextUrl || null;
    state.isLoaded = false;
    state.isLoading = false;
    state.pendingPlay = false;
    state.offsetSeconds = Math.max(0, startOffsetSeconds);
    mediaElement.pause();
    audio.isPlaying = false;

    const previousObjectUrl = activeObjectUrl;
    activeObjectUrl = ownsObjectUrl ? nextUrl : null;
    if (nextUrl) {
      mediaElement.src = nextUrl;
    } else {
      mediaElement.removeAttribute('src');
    }
    if (previousObjectUrl && previousObjectUrl !== activeObjectUrl) {
      revokeObjectUrl(previousObjectUrl);
    }
  };

  const onLoadedMetadata = () => {
    if (disposed) return;
    state.isLoaded = true;
    applyOffset();
  };
  const onCanPlay = () => {
    if (disposed) return;
    state.isLoaded = true;
    state.isLoading = false;
  };
  const onPlaying = () => {
    if (disposed) return;
    state.isLoaded = true;
    state.isLoading = false;
    state.pendingPlay = false;
    audio.isPlaying = true;
  };
  const onPause = () => {
    audio.isPlaying = false;
  };
  const onEnded = () => {
    audio.isPlaying = false;
    state.pendingPlay = false;
  };
  const onError = () => {
    if (disposed) return;
    state.isLoaded = false;
    state.isLoading = false;
    state.pendingPlay = false;
    audio.isPlaying = false;
    if (activeObjectUrl) {
      const failedObjectUrl = activeObjectUrl;
      activeObjectUrl = null;
      state.bufferUrl = null;
      mediaElement.removeAttribute('src');
      revokeObjectUrl(failedObjectUrl);
    }
  };

  mediaElement.addEventListener('loadedmetadata', onLoadedMetadata);
  mediaElement.addEventListener('canplay', onCanPlay);
  mediaElement.addEventListener('playing', onPlaying);
  mediaElement.addEventListener('pause', onPause);
  mediaElement.addEventListener('ended', onEnded);
  mediaElement.addEventListener('error', onError);

  const prepareFile = (nextUrl, startOffsetSeconds = 0) => {
    assignSource(nextUrl, startOffsetSeconds, false);
  };

  const play = () => {
    if (disposed || !state.bufferUrl) return false;

    const playToken = ++state.playToken;
    state.pendingPlay = true;
    state.isLoading = mediaElement.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
    applyOffset();

    if (audio.context?.state === 'suspended') {
      try {
        const resumeResult = audio.context.resume();
        resumeResult?.catch?.(() => {});
      } catch {
        // mediaElement.play() below reports whether playback can start.
      }
    }

    let playResult;
    try {
      playResult = mediaElement.play();
    } catch {
      if (playToken === state.playToken) {
        state.pendingPlay = false;
        state.isLoading = false;
        audio.isPlaying = false;
      }
      return Promise.resolve(false);
    }

    if (!playResult || typeof playResult.then !== 'function') {
      state.pendingPlay = false;
      state.isLoading = false;
      audio.isPlaying = !mediaElement.paused;
      return Promise.resolve(audio.isPlaying);
    }

    return playResult
      .then(() => {
        if (playToken !== state.playToken || disposed) return false;
        state.pendingPlay = false;
        state.isLoading = false;
        state.isLoaded = true;
        audio.isPlaying = !mediaElement.paused;
        return audio.isPlaying;
      })
      .catch(() => {
        if (playToken === state.playToken && !disposed) {
          state.pendingPlay = false;
          state.isLoading = false;
          audio.isPlaying = false;
        }
        return false;
      });
  };

  const setFile = (
    nextUrl,
    playWhenReady = false,
    revokeOnLoad = false,
    startOffsetSeconds = 0,
  ) => {
    if (!nextUrl || disposed) {
      return Promise.resolve({ loaded: false, playing: false });
    }
    assignSource(nextUrl, startOffsetSeconds, revokeOnLoad);
    const loadToken = state.loadToken;
    if (!playWhenReady) {
      return Promise.resolve({ loaded: state.isLoaded, playing: false });
    }
    const playResult = play();
    if (playResult === false) {
      return Promise.resolve({ loaded: false, playing: false });
    }
    return Promise.resolve(playResult).then((playing) => ({
      loaded: loadToken === state.loadToken && state.isLoaded,
      playing: loadToken === state.loadToken && playing,
    }));
  };

  const pause = () => {
    state.playToken += 1;
    state.pendingPlay = false;
    state.isLoading = false;
    if (Number.isFinite(mediaElement.currentTime)) {
      state.offsetSeconds = mediaElement.currentTime;
    }
    mediaElement.pause();
    audio.isPlaying = false;
  };

  const getCurrentTime = () =>
    Number.isFinite(mediaElement.currentTime) && mediaElement.readyState > 0
      ? mediaElement.currentTime
      : state.offsetSeconds;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    pause();
    mediaElement.removeEventListener('loadedmetadata', onLoadedMetadata);
    mediaElement.removeEventListener('canplay', onCanPlay);
    mediaElement.removeEventListener('playing', onPlaying);
    mediaElement.removeEventListener('pause', onPause);
    mediaElement.removeEventListener('ended', onEnded);
    mediaElement.removeEventListener('error', onError);
    mediaElement.removeAttribute('src');
    mediaElement.load();
    revokeObjectUrl(activeObjectUrl);
    activeObjectUrl = null;
    audio.disconnect();
  };

  if (url) {
    prepareFile(url, 0);
  }

  return {
    audio,
    analyser,
    listener,
    prepareFile,
    setFile,
    play,
    pause,
    dispose,
    getCurrentTime,
    hasPendingPlay: () => state.pendingPlay,
    isLoading: () => state.isLoading,
    isLoaded: () => state.isLoaded,
    isPlaying: () => !mediaElement.paused && !mediaElement.ended,
  };
}
