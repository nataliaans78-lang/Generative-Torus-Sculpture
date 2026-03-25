import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSceneControls, createControlState } from '../ui/index.js';
import {
  createScene,
  createCamera,
  createRenderer,
  createPostprocessing,
  createLights,
  createTorusCluster,
  createTorusResources,
  createFlowMode,
} from '../scene/index.js';
import { createFileAudio } from '../audio/index.js';
import {
  PRESETS,
  applyQuality,
  QUALITY_LEVELS,
  AUDIO_SETTINGS,
  CAMERA_SETTINGS,
  LIGHT_SETTINGS,
  MATERIAL_SETTINGS,
  MESH_SETTINGS,
  SCENE_SETTINGS,
  AUDIO_RESUME_STORAGE_KEY,
  UI_STATE_STORAGE_KEY,
  STORAGE_KEYS,
} from '../config/index.js';
import { buildRuntimeConfig, getDeviceProfile } from '../config/runtimeConfig.js';

const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  window.matchMedia('(max-width: 768px)').matches;

const getMobilePresetQuality = (presetKey = 'DEEP_BLUE') => {
  if (presetKey === 'DEEP_BLUE') return QUALITY_LEVELS.HIGH;
  if (presetKey === 'FLOW_SOFT' || presetKey === 'FLOW_STRONG') return QUALITY_LEVELS.MEDIUM;
  return QUALITY_LEVELS.LOW;
};

const getPresetQuality = (presetKey = 'DEEP_BLUE') => {
  if (isMobileDevice()) return getMobilePresetQuality(presetKey);
  const HIGH_DEFAULT_PRESETS = new Set(['DEEP_BLUE', 'FLOW_SOFT', 'FLOW_STRONG']);
  return HIGH_DEFAULT_PRESETS.has(presetKey) ? QUALITY_LEVELS.HIGH : QUALITY_LEVELS.MEDIUM;
};
const GLOBAL_ROTATION_SCALE = 0.7;
const MOBILE_LAYOUT_PROFILE = Object.freeze({
  gridMin: 1,
  gridDefault: 1,
  gridMax: 3,
  torusScale: 0.95,
});
const MOBILE_FLOW_LAYOUT_PROFILE = Object.freeze({
  gridMin: 1,
  gridDefault: 1,
  gridMax: 1,
  torusScale: 0.9,
});
const DESKTOP_LAYOUT_PROFILE = Object.freeze({
  gridMin: 2,
  gridDefault: 3,
  gridMax: 5,
  torusScale: 1,
});

const isFlowPreset = (presetKey) => presetKey === 'FLOW_SOFT' || presetKey === 'FLOW_STRONG';

const getLayoutProfile = (presetKey = 'DEEP_BLUE') => {
  if (!isMobileDevice()) return DESKTOP_LAYOUT_PROFILE;
  if (isFlowPreset(presetKey)) return MOBILE_FLOW_LAYOUT_PROFILE;
  return MOBILE_LAYOUT_PROFILE;
};

const clampGridCount = (gridCount, layoutProfile = getLayoutProfile()) => {
  const fallback =
    typeof gridCount === 'number' && Number.isFinite(gridCount)
      ? gridCount
      : layoutProfile.gridDefault;
  return Math.max(
    layoutProfile.gridMin,
    Math.min(layoutProfile.gridMax, Math.floor(fallback)),
  );
};

function resolvedGridDimensions(gridCount, layoutProfile = getLayoutProfile()) {
  const count = clampGridCount(gridCount, layoutProfile);
  if (isMobileDevice()) {
    if (count <= 1) {
      return {
        gridCount: count,
        nx: 2,
        ny: 2,
        nz: 1,
      };
    }
    if (count === 2) {
      return {
        gridCount: count,
        nx: 3,
        ny: 2,
        nz: 2,
      };
    }
    return {
      gridCount: count,
      nx: 3,
      ny: 3,
      nz: 3,
    };
  }
  return {
    gridCount: count,
    nx: count + 1,
    ny: count,
    nz: Math.max(2, count),
  };
}

export function createApp() {
  const createGradientBackgroundTexture = (gradient = SCENE_SETTINGS.backgroundGradient) => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const fill = ctx.createLinearGradient(0, 0, 0, canvas.height);
    fill.addColorStop(0, gradient.topColor);
    fill.addColorStop(0.5, gradient.middleColor);
    fill.addColorStop(1, gradient.bottomColor);
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  };

  const getDefaultQuality = (presetKey = 'DEEP_BLUE') => getPresetQuality(presetKey);
  const sizes = { width: window.innerWidth, height: window.innerHeight };
  let torusCluster = null;
  const scene = createScene();
  const cachedBgColor = new THREE.Color();
  let lastBgColorValue = null;
  const defaultGradientBackgroundTexture = createGradientBackgroundTexture();
  const camera = createCamera({
    fov: CAMERA_SETTINGS.fov,
    aspect: sizes.width / sizes.height,
    near: CAMERA_SETTINGS.near,
    far: CAMERA_SETTINGS.far,
    position: new THREE.Vector3(...CAMERA_SETTINGS.position),
  });
  camera.lookAt(new THREE.Vector3(...CAMERA_SETTINGS.target));

  const renderer = createRenderer({
    width: sizes.width,
    height: sizes.height,
    pixelRatio: window.devicePixelRatio,
    parent: document.body,
  });
  const postprocessing = createPostprocessing({
    renderer,
    scene,
    camera,
    width: sizes.width,
    height: sizes.height,
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(...CAMERA_SETTINGS.target);
  controls.update();
  const raycaster = new THREE.Raycaster();
  const hoverPointer = new THREE.Vector2(0, 0);
  let isHoverPointerActive = false;
  let activeTouchPointerId = null;
  let lastTouchClientX = 0;
  let touchSpinVelocity = 0;
  const clampPointer = (value) => THREE.MathUtils.clamp(value, -1, 1);
  const clampTouchSpinVelocity = (value) => THREE.MathUtils.clamp(value, -0.06, 0.06);
  const isPointerInsideControls = (event) =>
    event.target instanceof Element && event.target.closest('.portfolio-controls');
  const handlePointerMove = (event) => {
    if (isPointerInsideControls(event)) {
      isHoverPointerActive = false;
      torusCluster?.setHoverIndex(-1);
      return;
    }
    if (event.pointerType === 'touch' && activeTouchPointerId === event.pointerId) {
      const deltaX = event.clientX - lastTouchClientX;
      lastTouchClientX = event.clientX;
      touchSpinVelocity = clampTouchSpinVelocity(touchSpinVelocity + deltaX * 0.00025);
    }
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    hoverPointer.set(clampPointer(x), clampPointer(y));
    isHoverPointerActive = true;
  };
  const handlePointerDown = (event) => {
    if (event.pointerType !== 'touch') return;
    if (isPointerInsideControls(event)) return;
    activeTouchPointerId = event.pointerId;
    lastTouchClientX = event.clientX;
  };
  const handlePointerUp = (event) => {
    if (event.pointerType !== 'touch') return;
    if (activeTouchPointerId !== event.pointerId) return;
    activeTouchPointerId = null;
  };
  const handlePointerLeave = () => {
    isHoverPointerActive = false;
    torusCluster?.setHoverIndex(-1);
  };
  window.addEventListener('pointerdown', handlePointerDown, { passive: true });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerup', handlePointerUp, { passive: true });
  window.addEventListener('pointercancel', handlePointerUp, { passive: true });
  window.addEventListener('pointerleave', handlePointerLeave, { passive: true });

  const lights = createLights(scene, LIGHT_SETTINGS);
  // expose for quick inspection in DevTools (window.__deepWalls / window.__scene)
  if (typeof window !== 'undefined') {
    window.__scene = scene;
    window.__deepWalls = {
      left: lights.deepWallLeft,
      right: lights.deepWallRight,
      leftTarget: lights.deepWallLeftTarget,
      rightTarget: lights.deepWallRightTarget,
    };
  }
  const audio = createFileAudio({
    listener: new THREE.AudioListener(),
    url: AUDIO_SETTINGS.url,
    volume: AUDIO_SETTINGS.volume,
  });
  const readAudioPlaybackState = () => {
    try {
      const raw = window.localStorage.getItem(AUDIO_RESUME_STORAGE_KEY);
      if (!raw) return { shouldResume: false, positionSeconds: 0 };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { shouldResume: false, positionSeconds: 0 };
      return {
        shouldResume: parsed.shouldResume === true,
        positionSeconds:
          typeof parsed.positionSeconds === 'number' && parsed.positionSeconds >= 0
            ? parsed.positionSeconds
            : 0,
      };
    } catch {
      return { shouldResume: false, positionSeconds: 0 };
    }
  };
  const writeAudioPlaybackState = (shouldResume, positionSeconds = 0) => {
    try {
      window.localStorage.setItem(
        AUDIO_RESUME_STORAGE_KEY,
        JSON.stringify({
          shouldResume: Boolean(shouldResume),
          positionSeconds:
            Number.isFinite(positionSeconds) && positionSeconds >= 0 ? positionSeconds : 0,
        }),
      );
    } catch {
      // ignore storage errors
    }
  };
  const initialAudioPlaybackState = readAudioPlaybackState();

  if (audio && audio.listener) {
    camera.add(audio.listener);
    audio.setFile(AUDIO_SETTINGS.url, false, false, initialAudioPlaybackState.positionSeconds);
  }

  const flow = createFlowMode({
    scene,
    lights,
    audioAnalyser: audio?.analyser,
    isPlaying: () => audio?.isPlaying(),
  });
  flow.setEnabled(false);

  let hasInteracted = false;
  const markInteracted = () => {
    if (hasInteracted) return;
    hasInteracted = true;
    flow.setHasInteracted?.(true);
  };

  const controlsState = createControlState();
  const defaultPresetKey = 'DEEP_BLUE';
  const availablePresetKeys = Object.keys(PRESETS);
  const availablePresetKeySet = new Set(availablePresetKeys);
  const presetOptions = availablePresetKeys.map((key) => ({
    key,
    label: PRESETS[key].label,
  }));
  const createInitialStoredState = () => ({
    preset: defaultPresetKey,
    quality: getDefaultQuality(defaultPresetKey),
    overrides: {},
  });
  const readStoredState = () => {
    try {
      const raw = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        preset: typeof parsed.preset === 'string' ? parsed.preset : defaultPresetKey,
        quality: typeof parsed.quality === 'string' ? parsed.quality : null,
        overrides:
          parsed.overrides &&
          typeof parsed.overrides === 'object' &&
          !Array.isArray(parsed.overrides)
            ? parsed.overrides
            : {},
      };
    } catch {
      return null;
    }
  };
  const isPresetKey = (value) => typeof value === 'string' && availablePresetKeySet.has(value);
  const isQualityLevel = (value) => Object.values(QUALITY_LEVELS).includes(value);
  const storedState = readStoredState() ?? createInitialStoredState();
  if (isMobileDevice()) {
    storedState.preset = defaultPresetKey;
    const mobileQuality = getMobilePresetQuality(storedState?.preset ?? defaultPresetKey);
    storedState.quality = mobileQuality;
    controlsState.setQuality(mobileQuality);
  }
  if (!storedState?.quality || !isQualityLevel(storedState.quality)) {
    const fallbackPreset = storedState?.preset ?? defaultPresetKey;
    controlsState.setQuality(getDefaultQuality(fallbackPreset));
    storedState.quality = controlsState.state.quality;
  } else {
    controlsState.setQuality(storedState.quality);
  }

  const qualityGeometry = {
    tubularSegments: MESH_SETTINGS.geometry.tubularSegments,
    radialSegments: MESH_SETTINGS.geometry.radialSegments,
  };
  const stripeAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const torusResourcesCache = new Map();
  const getTorusResourcesForQuality = (level) => {
    const quality = isQualityLevel(level) ? level : QUALITY_LEVELS.HIGH;
    const cached = torusResourcesCache.get(quality);
    if (cached) return cached;
    const stripeTextureSize =
      quality === QUALITY_LEVELS.LOW
        ? 256
        : quality === QUALITY_LEVELS.MEDIUM
          ? 512
          : (MATERIAL_SETTINGS.stripeTextureSize ?? 1024);
    const stripeGenerateMipmaps = quality !== QUALITY_LEVELS.LOW;
    const resources = createTorusResources({
      ...MATERIAL_SETTINGS,
      stripeTextureSize,
      stripeGenerateMipmaps,
      stripeAnisotropy,
    });
    torusResourcesCache.set(quality, resources);
    return resources;
  };
  let torusResources = getTorusResourcesForQuality(controlsState.state.quality);
  let currentQualityProfile = null;
  const qualityDownstepPixelCap = {
    [QUALITY_LEVELS.HIGH]: 1.25,
    [QUALITY_LEVELS.MEDIUM]: 1,
    [QUALITY_LEVELS.LOW]: 1,
  };
  const qualityDefaultPixelCap = {
    [QUALITY_LEVELS.HIGH]: 2,
    [QUALITY_LEVELS.MEDIUM]: 1.25,
    [QUALITY_LEVELS.LOW]: 1,
  };
  const getFlowProfileFromPreset = (presetKey) => (presetKey === 'FLOW_STRONG' ? 'STRONG' : 'SOFT');
  const getAdaptivePixelRatioCap = () => {
    const selectedQuality = controlsState.state.quality || QUALITY_LEVELS.HIGH;
    const baseCap = currentQualityProfile?.pixelRatioCap ?? qualityDefaultPixelCap[selectedQuality];
    const isFlowPreset = controlsState.state.flowEnabled;
    const isLargeGrid = (controlsState.state.scene?.gridCount ?? 2) >= 4;
    if (!isFlowPreset || !isLargeGrid) return baseCap;
    const downstepCap = qualityDownstepPixelCap[selectedQuality] ?? 1;
    return Math.min(baseCap, downstepCap);
  };
  const applyAdaptivePixelRatio = () => {
    const desktopPixelRatioCap = 1.5;
    const qualityCap = getAdaptivePixelRatioCap();
    const runtimeCap = isMobileDevice() ? qualityCap : Math.min(qualityCap, desktopPixelRatioCap);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, runtimeCap));
  };

  const applyQualityLevel = (level) => {
    applyQuality(renderer, level, (preset) => {
      qualityGeometry.tubularSegments = preset.tubularSegments;
      qualityGeometry.radialSegments = preset.radialSegments;
      currentQualityProfile = preset;
      flow.setQuality(preset.level);
      postprocessing.setQuality(preset.level);
      const nextResources = getTorusResourcesForQuality(preset.level);
      if (nextResources !== torusResources) {
        torusResources = nextResources;
        if (torusCluster?.mesh) {
          torusCluster.mesh.material = torusResources.material;
        }
      }
      const shadowMapSize = preset.shadowMapSize || 0;
      [lights.keyLight, lights.rimLight, lights.fillLight].forEach((light) => {
        if (!light || !light.shadow) return;
        light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      });
    });
    applyAdaptivePixelRatio();
    if (torusCluster) {
      torusCluster.setGeometryDetail({
        tubularSegments: qualityGeometry.tubularSegments,
        radialSegments: qualityGeometry.radialSegments,
      });
    }
  };

  const writeStoredState = () => {
    try {
      window.localStorage.setItem(
        UI_STATE_STORAGE_KEY,
        JSON.stringify({
          preset: isPresetKey(storedState.preset) ? storedState.preset : defaultPresetKey,
          quality: storedState.quality ?? controlsState.state.quality,
          overrides: storedState.overrides,
        }),
      );
    } catch {
      // ignore storage errors
    }
  };

  const allowedLightingKeys = [
    'keyIntensity',
    'rimIntensity',
    'fillIntensity',
    'centerIntensity',
    'spotIntensity',
    'flowPulseIntensity',
    'spotFocus',
    'flowAngle',
    'lightMotionSpeed',
    'audioReactiveScale',
  ];
  const sanitizeLightingOverride = (lighting = {}) => {
    const next = {};
    allowedLightingKeys.forEach((key) => {
      if (typeof lighting[key] === 'number') {
        next[key] = lighting[key];
      }
    });
    return next;
  };
  const sanitizeGridOverride = (grid = {}, layoutProfile = getLayoutProfile()) => {
    const next = {};
    if (typeof grid.gridCount === 'number') {
      next.gridCount = clampGridCount(grid.gridCount, layoutProfile);
    }
    if (typeof grid.gridSpacing === 'number') next.gridSpacing = grid.gridSpacing;
    return next;
  };
  const sanitizeMotionOverride = (motion = {}) => {
    const next = {};
    if (typeof motion.globalRotationSpeed === 'number')
      next.globalRotationSpeed = motion.globalRotationSpeed;
    if (typeof motion.driftAmp === 'number') next.driftAmp = motion.driftAmp;
    return next;
  };
  const getPresetOverride = (presetKey) => {
    if (!isPresetKey(presetKey)) return {};
    const raw = storedState.overrides?.[presetKey];
    if (!raw || typeof raw !== 'object') return {};
    const layoutProfile = getLayoutProfile(presetKey);
    return {
      lighting: sanitizeLightingOverride(raw.lighting ?? {}),
      grid: sanitizeGridOverride(raw.grid ?? {}, layoutProfile),
      motion: sanitizeMotionOverride(raw.motion ?? {}),
    };
  };
  const loadUserSettings = (presetKey, presetState) => {
    const override = getPresetOverride(presetKey);
    const lockFlowMobileGridDefault = isMobileDevice() && isFlowPreset(presetKey);
    return {
      ...presetState,
      lighting: {
        ...presetState.lighting,
        ...override.lighting,
      },
      scene: {
        ...presetState.scene,
        ...(!lockFlowMobileGridDefault && typeof override.grid?.gridCount === 'number'
          ? { gridCount: override.grid.gridCount }
          : {}),
        ...(typeof override.grid?.gridSpacing === 'number'
          ? { gridSpacing: override.grid.gridSpacing }
          : {}),
        ...(typeof override.motion?.globalRotationSpeed === 'number'
          ? { globalRotationSpeed: override.motion.globalRotationSpeed }
          : {}),
        ...(typeof override.motion?.driftAmp === 'number'
          ? { driftAmp: override.motion.driftAmp }
          : {}),
      },
    };
  };
  const storeCurrentPresetOverride = () => {
    const presetKey = controlsState.state.presetKey;
    if (!isPresetKey(presetKey)) return;
    const sceneState = controlsState.state.scene ?? {};
    storedState.overrides[presetKey] = {
      lighting: sanitizeLightingOverride(controlsState.state.lighting ?? {}),
      grid: sanitizeGridOverride({
        gridCount: sceneState.gridCount,
        gridSpacing: sceneState.gridSpacing,
      }),
      motion: sanitizeMotionOverride({
        globalRotationSpeed: sceneState.globalRotationSpeed,
        driftAmp: sceneState.driftAmp,
      }),
    };
  };

  const applyLightingPresetToLights = (lighting = {}) => {
    if (lights?.keyLight && typeof lighting.keyIntensity === 'number') {
      lights.keyLight.intensity = lighting.keyIntensity;
    }
    if (lights?.rimLight && typeof lighting.rimIntensity === 'number') {
      lights.rimLight.intensity = lighting.rimIntensity;
    }
    if (lights?.fillLight && typeof lighting.fillIntensity === 'number') {
      lights.fillLight.intensity = lighting.fillIntensity;
    }
    if (lights?.centerLight && typeof lighting.centerIntensity === 'number') {
      lights.centerLight.intensity = lighting.centerIntensity;
    }
  };

  const applyLightingState = () => {
    const effectiveLighting = {
      ...controlsState.state.lighting,
      fillIntensity: controlsState.state.lighting.fillIntensity,
      centerIntensity: controlsState.state.lighting.centerIntensity,
    };
    applyLightingPresetToLights(effectiveLighting);
    flow.setBaseLightIntensities({
      keyIntensity: effectiveLighting.keyIntensity,
      rimIntensity: effectiveLighting.rimIntensity,
      fillIntensity: effectiveLighting.fillIntensity,
      centerIntensity: effectiveLighting.centerIntensity,
    });
    flow.setOptions({
      dotIntensity: effectiveLighting.spotIntensity,
      pulseIntensity: effectiveLighting.flowPulseIntensity,
      dotSize: effectiveLighting.spotFocus,
      flowAngle: effectiveLighting.flowAngle,
      flowSpeed: effectiveLighting.lightMotionSpeed,
      audioReactiveScale: effectiveLighting.audioReactiveScale,
    });
  };

  const layoutState = (() => {
    const dims = resolvedGridDimensions(
      controlsState.state.scene.gridCount,
      getLayoutProfile(controlsState.state.presetKey),
    );
    return {
      ...dims,
      spacing: controlsState.state.scene.gridSpacing,
      rotationSpeed: controlsState.state.scene.globalRotationSpeed,
      driftAmp: controlsState.state.scene.driftAmp,
    };
  })();

  const rebuildMeshes = () => {
    if (torusCluster) {
      torusCluster.dispose();
    }
    torusCluster = createTorusCluster(scene, {
      layout: {
        nx: layoutState.nx,
        ny: layoutState.ny,
        nz: layoutState.nz,
        spacing: layoutState.spacing,
      },
      geometryConfig: {
        ...MESH_SETTINGS.geometry,
        tubularSegments: qualityGeometry.tubularSegments,
        radialSegments: qualityGeometry.radialSegments,
      },
      motion: {
        driftAmp: layoutState.driftAmp,
      },
      scaleMultiplier: getLayoutProfile(controlsState.state.presetKey).torusScale,
      heroScaleMultiplier: isMobileDevice() ? 1.35 : 1,
      sharedMaterial: torusResources.material,
      sharedStripeTexture: torusResources.stripeTexture,
    });
    if (audio?.isPlaying()) {
      torusCluster.skipIntro?.();
    }
  };

  const applyConfigToScene = (config) => {
    // fog
    if (controlsState.state.fogEnabled) {
      scene.fog = new THREE.FogExp2(config.visual.fogColor, config.visual.fogDensity);
    }
    // lights
    if (lights?.ambientLight) lights.ambientLight.intensity = config.lights.ambient;
    if (lights?.keyLight) lights.keyLight.intensity = config.lights.key;
    if (lights?.rimLight) lights.rimLight.intensity = config.lights.rim;
    if (lights?.fillLight) lights.fillLight.intensity = config.lights.fill;
    if (lights?.centerLight) lights.centerLight.intensity = config.lights.center;
  };

  const autoReduceGridCount = () => {
    const layoutProfile = getLayoutProfile(controlsState.state.presetKey);
    const current = controlsState.state.scene.gridCount ?? layoutProfile.gridDefault;
    const min = layoutProfile.gridMin;
    if (current <= min) return false;
    const next = current - 1;
    controlsState.setScene({ gridCount: next });
    layoutState.gridCount = next;
    const dims = resolvedGridDimensions(next, layoutProfile);
    layoutState.nx = dims.nx;
    layoutState.ny = dims.ny;
    layoutState.nz = dims.nz;
    const previousCount = torusCluster ? torusCluster.mesh.count : 0;
    const nextCount = layoutState.nx * layoutState.ny * layoutState.nz;
    const countChanged = previousCount !== nextCount;
    if (!torusCluster || countChanged) {
      rebuildMeshes();
    } else {
      torusCluster.setLayout({
        nx: layoutState.nx,
        ny: layoutState.ny,
        nz: layoutState.nz,
        spacing: layoutState.spacing,
      });
    }
    updateFlowBounds();
    storeCurrentPresetOverride();
    ui?.setSceneValues(controlsState.state.scene);
    writeStoredState();
    return true;
  };

  // Force gridCount to 2 (or layout min) for low-FPS fallback on any preset
  const forceGridCountToTwo = () => {
    const layoutProfile = getLayoutProfile(controlsState.state.presetKey);
    const target = Math.max(layoutProfile.gridMin, 2);
    const current = controlsState.state.scene.gridCount ?? layoutProfile.gridDefault;
    if (current === target) return false;
    controlsState.setScene({ gridCount: target });
    layoutState.gridCount = target;
    const dims = resolvedGridDimensions(target, layoutProfile);
    layoutState.nx = dims.nx;
    layoutState.ny = dims.ny;
    layoutState.nz = dims.nz;
    const previousCount = torusCluster ? torusCluster.mesh.count : 0;
    const nextCount = layoutState.nx * layoutState.ny * layoutState.nz;
    const countChanged = previousCount !== nextCount;
    if (!torusCluster || countChanged) {
      rebuildMeshes();
    } else {
      torusCluster.setLayout({
        nx: layoutState.nx,
        ny: layoutState.ny,
        nz: layoutState.nz,
        spacing: layoutState.spacing,
      });
    }
    updateFlowBounds();
    storeCurrentPresetOverride();
    ui?.setSceneValues(controlsState.state.scene);
    writeStoredState();
    return true;
  };
  applyQualityLevel(controlsState.state.quality);

  const updateFlowBounds = () => {
    const halfX = layoutState.nx * layoutState.spacing * 0.5;
    const halfY = layoutState.ny * layoutState.spacing * 0.5;
    const halfZ = layoutState.nz * layoutState.spacing * 0.5;
    lights.setLayoutBounds?.({ halfX, halfY, halfZ });
    flow.setGridLayout({ halfX, halfY, halfZ, gridCount: layoutState.gridCount });
  };
  updateFlowBounds();

  const applyPreset = (key, { overwriteUser = false, applyPresetQuality = true } = {}) => {
    const isDeepBlue = key === 'DEEP_BLUE';
    const preset = PRESETS[key] ?? PRESETS.DEEP_BLUE;
    const layoutProfile = getLayoutProfile(key);
    const presetGridCount = isMobileDevice()
      ? layoutProfile.gridDefault
      : preset.grid.gridCount ?? layoutProfile.gridDefault;
    const presetState = {
      presetKey: key,
      flowEnabled: preset.flowEnabled,
      roomEnabled: preset.roomEnabled,
      fogEnabled: preset.fogEnabled,
      lighting: {
        keyIntensity: preset.lighting.keyIntensity,
        rimIntensity: preset.lighting.rimIntensity,
        fillIntensity: preset.lighting.fillIntensity ?? 0,
        centerIntensity: preset.lighting.centerIntensity ?? (key === 'DEEP_BLUE' ? 10 : 0),
        spotIntensity: preset.lighting.flowSpotIntensity,
      flowPulseIntensity: preset.lighting.flowPulseIntensity,
      spotFocus: preset.lighting.spotFocus,
      flowAngle: preset.lighting.flowAngle,
      lightMotionSpeed: preset.lighting.flowSpeed,
      audioReactiveScale: controlsState.state.lighting.audioReactiveScale ?? 1,
      },
      scene: {
        gridCount: clampGridCount(presetGridCount, layoutProfile),
        gridSpacing: preset.grid.gridSpacing,
        globalRotationSpeed: preset.motion.groupRot,
        driftAmp: preset.motion.driftAmp,
      },
      room: preset.room,
      fog: preset.fog,
    };
    controlsState.replaceAll(overwriteUser ? presetState : loadUserSettings(key, presetState));
    const previousCount = layoutState.nx * layoutState.ny * layoutState.nz;
    layoutState.gridCount = controlsState.state.scene.gridCount;
    const dims = resolvedGridDimensions(layoutState.gridCount, layoutProfile);
    layoutState.nx = dims.nx;
    layoutState.ny = dims.ny;
    layoutState.nz = dims.nz;
    layoutState.spacing = controlsState.state.scene.gridSpacing;
    layoutState.rotationSpeed = controlsState.state.scene.globalRotationSpeed;
    layoutState.driftAmp = controlsState.state.scene.driftAmp;
    const nextCount = layoutState.nx * layoutState.ny * layoutState.nz;
    const countChanged = previousCount !== nextCount;
    if (!torusCluster || countChanged) {
      rebuildMeshes();
    } else {
      torusCluster.setLayout({
        nx: layoutState.nx,
        ny: layoutState.ny,
        nz: layoutState.nz,
        spacing: layoutState.spacing,
      });
    }
    updateFlowBounds();
    flow.setEnvironment({
      room: controlsState.state.room,
      fog: controlsState.state.fog,
      roomEnabled: controlsState.state.roomEnabled,
      fogEnabled: controlsState.state.fogEnabled,
    });
    const bg = controlsState.state.room?.backgroundColor;
    if (bg === null) {
      scene.background = defaultGradientBackgroundTexture;
      lastBgColorValue = null;
    } else if (typeof bg === 'number') {
      if (bg !== lastBgColorValue) {
        cachedBgColor.set(bg);
        lastBgColorValue = bg;
      }
      scene.background = cachedBgColor;
    }
    flow.setProfile(getFlowProfileFromPreset(key));
    // Deep Blue: bez flow / wall spotów z systemu flow
    if (isDeepBlue) {
      flow.setEnabled(false);
      flow.setOptions({ wallSpotCount: null });
    } else {
      flow.setEnabled(controlsState.state.flowEnabled);
      flow.setOptions({
        wallSpotCount: null,
        audioReactiveScale: controlsState.state.lighting.audioReactiveScale,
      });
    }
    lights.setFlowAccents?.(key);
    applyLightingState();
    // apply runtime config (fog/lights/motion) live
    const runtimeConfig = buildRuntimeConfig(key, getDeviceProfile());
    applyConfigToScene(runtimeConfig);
    applyAdaptivePixelRatio();

    if (applyPresetQuality) {
      const desiredQuality = getPresetQuality(key);
      if (controlsState.state.quality !== desiredQuality) {
        applyQualityLevel(desiredQuality);
        controlsState.setQuality(desiredQuality);
        storedState.quality = desiredQuality;
        ui?.setQuality(desiredQuality);
        writeStoredState();
      }
    }
  };

  const layoutUpdate = (partial = {}) => {
    const layoutProfile = getLayoutProfile(controlsState.state.presetKey);
    const dims = resolvedGridDimensions(partial.gridCount ?? layoutState.gridCount, layoutProfile);
    const nextSpacing =
      typeof partial.gridSpacing === 'number' ? partial.gridSpacing : layoutState.spacing;
    const currentCount = layoutState.nx * layoutState.ny * layoutState.nz;
    const nextCount = dims.nx * dims.ny * dims.nz;
    const countChanged = currentCount !== nextCount;
    layoutState.nx = dims.nx;
    layoutState.ny = dims.ny;
    layoutState.nz = dims.nz;
    layoutState.gridCount = dims.gridCount;
    layoutState.spacing = nextSpacing;
    if (typeof partial.globalRotationSpeed === 'number')
      layoutState.rotationSpeed = partial.globalRotationSpeed;
    if (typeof partial.driftAmp === 'number') layoutState.driftAmp = partial.driftAmp;
    controlsState.setScene({
      gridCount: layoutState.gridCount,
      gridSpacing: layoutState.spacing,
      globalRotationSpeed: layoutState.rotationSpeed,
      driftAmp: layoutState.driftAmp,
    });
    if (!torusCluster || countChanged) {
      rebuildMeshes();
    } else {
      torusCluster.setLayout({
        nx: layoutState.nx,
        ny: layoutState.ny,
        nz: layoutState.nz,
        spacing: layoutState.spacing,
      });
    }
    updateFlowBounds();
    applyAdaptivePixelRatio();
  };

  let ui = null;
  const handlePresetChange = (key) => {
    storedState.preset = key;
    applyPreset(key);
    ui?.setPreset(key);
    ui?.setGridCountLimits(getLayoutProfile(key));
    ui?.setLightingValues(controlsState.state.lighting);
    ui?.setSceneValues(controlsState.state.scene);
    ui?.setQuality(controlsState.state.quality);
    writeStoredState();
  };

  ui = createSceneControls({
    initialPreset: controlsState.state.presetKey,
    presetOptions,
    initialLighting: controlsState.state.lighting,
    initialScene: controlsState.state.scene,
    gridCountLimits: {
      min: getLayoutProfile(controlsState.state.presetKey).gridMin,
      max: getLayoutProfile(controlsState.state.presetKey).gridMax,
      defaultValue: getLayoutProfile(controlsState.state.presetKey).gridDefault,
    },
    initialQuality: controlsState.state.quality,
    onPresetChange: (key) => handlePresetChange(key),
    onLightingChange: (partial) => {
      markInteracted();
      controlsState.setLighting(partial);
      applyLightingState();
      ui.setLightingValues(controlsState.state.lighting);
      storeCurrentPresetOverride();
      writeStoredState();
    },
    onSceneChange: (partial) => {
      markInteracted();
      layoutUpdate(partial);
      ui.setSceneValues(controlsState.state.scene);
      storeCurrentPresetOverride();
      writeStoredState();
    },
    onQualityChange: (level) => {
      markInteracted();
      applyQualityLevel(level);
      controlsState.setQuality(level);
      storedState.quality = level;
      ui.setQuality(level);
      writeStoredState();
    },
    onPlayToggle: () => {
      markInteracted();
      if (!audio) return false;
      if (audio.audio.isPlaying || audio.hasPendingPlay()) {
        audio.pause();
        writeAudioPlaybackState(false, audio.getCurrentTime?.() ?? 0);
        ui.setPlayState(false);
        return false;
      }
      const started = audio.play();
      writeAudioPlaybackState(started, audio.getCurrentTime?.() ?? 0);
      ui.setPlayState(started);
      return started;
    },
    onUploadAudio: async (file) => {
      markInteracted();
      if (!audio || !file) return;
      const objectUrl = URL.createObjectURL(file);
      ui.setPlayState(false);
      await audio.setFile(objectUrl, true, true);
      const isAudioActive = audio.isPlaying() || audio.hasPendingPlay();
      writeAudioPlaybackState(false, 0);
      ui.setPlayState(isAudioActive);
    },
    onResetAll: async () => {
      STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
      markInteracted();
      if (audio) {
        audio.pause();
        await audio.setFile(AUDIO_SETTINGS.url, false, false);
      }
      ui.setPlayState(false);
      const defaultQuality = getDefaultQuality(defaultPresetKey);
      storedState.preset = defaultPresetKey;
      storedState.quality = defaultQuality;
      storedState.overrides = {};
      applyQualityLevel(defaultQuality);
      controlsState.setQuality(defaultQuality);
      applyPreset(defaultPresetKey, { overwriteUser: true, applyPresetQuality: false });
      ui.setPreset(defaultPresetKey);
      ui.setGridCountLimits(getLayoutProfile(defaultPresetKey));
      ui.setLightingValues(controlsState.state.lighting);
      ui.setSceneValues(controlsState.state.scene);
      ui.setQuality(defaultQuality);
      ui.resetPanel(defaultPresetKey);
      writeStoredState();
    },
  });

  if (isMobileDevice()) {
    const mobilePresetTitle = document.createElement('div');
    mobilePresetTitle.className = 'portfolio-mobile-preset-title';
    mobilePresetTitle.textContent = 'Deep Blue';
    document.body.append(mobilePresetTitle);
  }

  const initialPreset = isPresetKey(storedState.preset) ? storedState.preset : defaultPresetKey;
  storedState.preset = initialPreset;
  applyPreset(initialPreset, { applyPresetQuality: false });
  ui?.setPreset(initialPreset);
  ui?.setGridCountLimits(getLayoutProfile(initialPreset));
  ui?.setLightingValues(controlsState.state.lighting);
  ui?.setSceneValues(controlsState.state.scene);
  ui.setQuality(controlsState.state.quality);
  flow.setHasInteracted(false);

  const clock = new THREE.Clock();
  let lastAudioStatePersistAt = 0;
  let lastDeviceModeMobile = isMobileDevice();
  const endIntroMode = () => {
    if (hasInteracted) return;
    hasInteracted = true;
    flow.setHasInteracted(true);
  };
  const introExitHandler = () => {
    endIntroMode();
    window.removeEventListener('pointerdown', introExitHandler);
    window.removeEventListener('keydown', introExitHandler);
  };
  window.addEventListener('pointerdown', introExitHandler, { passive: true });
  window.addEventListener('keydown', introExitHandler, { passive: true });
  setTimeout(endIntroMode, 6000);
  const applyModeDefaults = (isMobile) => {
    const targetPreset = defaultPresetKey;
    const desiredQuality = isMobile
      ? getMobilePresetQuality(targetPreset)
      : getPresetQuality(targetPreset);
    storedState.preset = targetPreset;
    storedState.quality = desiredQuality;
    controlsState.setQuality(desiredQuality);
    applyQualityLevel(desiredQuality);
    applyPreset(targetPreset, { overwriteUser: true, applyPresetQuality: false });
    ui?.setPreset(targetPreset);
    ui?.setGridCountLimits(getLayoutProfile(targetPreset));
    ui?.setLightingValues(controlsState.state.lighting);
    ui?.setSceneValues(controlsState.state.scene);
    ui?.setQuality(desiredQuality);
    writeStoredState();
  };
  const cameraDrift = new THREE.Vector3();
  const previousCameraDrift = new THREE.Vector3();
  const mouseOffset = new THREE.Vector3();
  const targetMouseOffset = new THREE.Vector3();
  let startupBlend = 0;
  // FPS watchdog (auto quality adjust with hysteresis)
  let fpsSum = 0;
  let fpsCount = 0;
  let lastFpsCheck = 0;
  let autoDropped = false;
  const qualityOrder = [QUALITY_LEVELS.HIGH, QUALITY_LEVELS.MEDIUM, QUALITY_LEVELS.LOW];
  const FPS_DROP = 40;
  const FPS_RECOVER = 58;

  const setQualityAndPersist = (level) => {
    applyQualityLevel(level);
    controlsState.setQuality(level);
    storedState.quality = level;
    ui.setQuality(level);
    writeStoredState();
  };

  const maybeAutoAdjustQuality = (avgFps) => {
    const current = controlsState.state.quality || QUALITY_LEVELS.HIGH;
    const idx = qualityOrder.indexOf(current);
    // drop quality if low FPS
    if (avgFps < FPS_DROP && idx < qualityOrder.length - 1) {
      const next = qualityOrder[idx + 1];
      setQualityAndPersist(next);
      autoDropped = true;
      return;
    }
    // if already at lowest quality and nadal wolno, próbuj zmniejszyć grid
    if (avgFps < FPS_DROP && idx === qualityOrder.length - 1) {
      const reduced = forceGridCountToTwo() || autoReduceGridCount();
      if (reduced) {
        autoDropped = true;
      }
    }
    // recover one level if FPS healthy and previously dropped
    if (autoDropped && avgFps > FPS_RECOVER && idx > 0) {
      const prev = qualityOrder[idx - 1];
      setQualityAndPersist(prev);
      if (prev === QUALITY_LEVELS.HIGH) {
        autoDropped = false;
      }
    }
  };

  const animate = () => {
    const deltaTime = Math.min(clock.getDelta(), 0.05); // clamp to avoid huge jumps after tab idle
    const elapsed = clock.getElapsedTime();
    startupBlend = Math.min(startupBlend + deltaTime / 0.9, 1);
    // FPS sampling
    if (deltaTime > 0) {
      fpsSum += 1 / deltaTime;
      fpsCount += 1;
    }
    if (elapsed - lastFpsCheck > 3 && fpsCount > 0) {
      const avgFps = fpsSum / fpsCount;
      maybeAutoAdjustQuality(avgFps);
      fpsSum = 0;
      fpsCount = 0;
      lastFpsCheck = elapsed;
    }
    const reactive = flow.update(deltaTime);
    const introPhase = reactive?.introPhase ?? (hasInteracted ? 0 : 1);
    if (controlsState.state.flowEnabled) {
      lights.setFlowAccents?.(controlsState.state.presetKey, introPhase);
    }
    // Intro boosts for fill/center per frame
    const fillBoost = 1 + introPhase * 0.2;
    const centerBoost = 1 + introPhase * 0.35;
    if (lights?.fillLight) {
      lights.fillLight.intensity =
        (controlsState.state.lighting.fillIntensity ?? lights.fillLight.intensity) * fillBoost;
    }
    if (lights?.centerLight) {
      lights.centerLight.intensity =
        (controlsState.state.lighting.centerIntensity ?? lights.centerLight.intensity) *
        centerBoost;
    }
    if (isHoverPointerActive && torusCluster?.mesh) {
      raycaster.setFromCamera(hoverPointer, camera);
      const intersections = raycaster.intersectObject(torusCluster.mesh, false);
      const hoveredInstanceId =
        intersections.length > 0 && Number.isInteger(intersections[0].instanceId)
          ? intersections[0].instanceId
          : -1;
      torusCluster.setHoverIndex(hoveredInstanceId);
    }
    torusCluster.update(deltaTime, reactive);
    torusCluster.mesh.rotation.y +=
      layoutState.rotationSpeed * GLOBAL_ROTATION_SCALE * deltaTime + touchSpinVelocity;
    const isDeep = controlsState.state.presetKey === 'DEEP_BLUE';
    if (isDeep) {
      lights.tickDeepWallSpots?.(elapsed);
    }
    const targetMouseX = isDeep ? 0 : hoverPointer.x * 0.24;
    const targetMouseY = isDeep ? 0 : hoverPointer.y * 0.18;
    targetMouseOffset.set(targetMouseX, targetMouseY, 0);
    mouseOffset.lerp(targetMouseOffset, 0.02);
    // subtle camera drift + tiny parallax (disabled for Deep)
    cameraDrift.set(
      Math.sin(elapsed * 0.045) * 0.06 + mouseOffset.x,
      Math.cos(elapsed * 0.035) * 0.045 + mouseOffset.y,
      Math.sin(elapsed * 0.025) * 0.03,
    );
    cameraDrift.sub(previousCameraDrift);
    camera.position.add(cameraDrift);
    controls.target.add(cameraDrift);
    // micro parallax on torus cluster (not for Deep)
    if (torusCluster?.mesh) {
      if (isDeep) {
        torusCluster.mesh.position.x = 0;
        torusCluster.mesh.position.y = 0;
      } else {
        torusCluster.mesh.position.x = mouseOffset.x * 0.0012;
        torusCluster.mesh.position.y = mouseOffset.y * 0.0009;
      }
    }
    previousCameraDrift.add(cameraDrift);
    const touchDecay = Math.pow(0.9, deltaTime * 60);
    touchSpinVelocity *= touchDecay;
    if (Math.abs(touchSpinVelocity) < 0.00005) {
      touchSpinVelocity = 0;
    }
    const audioActive = Boolean(reactive?.audioActive);
    const exposureBase = controlsState.state.flowEnabled
      ? audioActive
        ? 0.97
        : 1.0
      : 1.08;
    const exposureScale = controlsState.state.flowEnabled
      ? audioActive
        ? 0.35
        : 0.6
      : 0;
    const exposure = controlsState.state.flowEnabled
      ? THREE.MathUtils.clamp(
          exposureBase + (reactive?.mid ?? 0) * exposureScale,
          audioActive ? 0.92 : 0.95,
          audioActive ? 1.08 : 1.25,
        )
      : exposureBase;
    const deepBoost =
      controlsState.state.presetKey === 'DEEP_BLUE' ? 1.05 : 1;
    renderer.toneMappingExposure = THREE.MathUtils.lerp(0.92, exposure * deepBoost, startupBlend);
    postprocessing.update(elapsed, reactive);
    controls.update();
    postprocessing.render();
    if (audio?.isPlaying() && elapsed - lastAudioStatePersistAt > 0.75) {
      writeAudioPlaybackState(true, audio.getCurrentTime?.() ?? 0);
      lastAudioStatePersistAt = elapsed;
    }
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);

  window.addEventListener('beforeunload', () => {
    window.removeEventListener('pointerdown', handlePointerDown);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    window.removeEventListener('pointerleave', handlePointerLeave);
    if (!audio) return;
    writeAudioPlaybackState(audio.isPlaying(), audio.getCurrentTime?.() ?? 0);
  });

  window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    const nextDeviceModeMobile = isMobileDevice();
    if (nextDeviceModeMobile !== lastDeviceModeMobile) {
      lastDeviceModeMobile = nextDeviceModeMobile;
      applyModeDefaults(nextDeviceModeMobile);
    }
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    applyAdaptivePixelRatio();
    renderer.setSize(sizes.width, sizes.height);
    postprocessing.setSize(sizes.width, sizes.height);
  });

  return { scene, camera, renderer, controls };
}
