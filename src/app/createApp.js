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
  gridDefault: 2,
  gridMax: 3,
  torusScale: 0.8,
});
const DESKTOP_LAYOUT_PROFILE = Object.freeze({
  gridMin: 2,
  gridDefault: 3,
  gridMax: 5,
  torusScale: 1,
});

const getLayoutProfile = () => (isMobileDevice() ? MOBILE_LAYOUT_PROFILE : DESKTOP_LAYOUT_PROFILE);

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

function resolvedGridDimensions(gridCount) {
  const count = clampGridCount(gridCount);
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

  const controlsState = createControlState();
  const presetOptions = Object.entries(PRESETS).map(([key, preset]) => ({
    key,
    label: preset.label,
  }));
  const defaultPresetKey = 'DEEP_BLUE';
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
  const isPresetKey = (value) => typeof value === 'string' && Object.hasOwn(PRESETS, value);
  const isQualityLevel = (value) => Object.values(QUALITY_LEVELS).includes(value);
  const storedState = readStoredState() ?? createInitialStoredState();
  if (isMobileDevice()) {
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
  const sanitizeGridOverride = (grid = {}) => {
    const next = {};
    if (typeof grid.gridCount === 'number') {
      next.gridCount = clampGridCount(grid.gridCount);
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
    return {
      lighting: sanitizeLightingOverride(raw.lighting ?? {}),
      grid: sanitizeGridOverride(raw.grid ?? {}),
      motion: sanitizeMotionOverride(raw.motion ?? {}),
    };
  };
  const loadUserSettings = (presetKey, presetState) => {
    const override = getPresetOverride(presetKey);
    return {
      ...presetState,
      lighting: {
        ...presetState.lighting,
        ...override.lighting,
      },
      scene: {
        ...presetState.scene,
        ...(typeof override.grid?.gridCount === 'number'
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
    applyLightingPresetToLights(controlsState.state.lighting);
    flow.setBaseLightIntensities({
      keyIntensity: controlsState.state.lighting.keyIntensity,
      rimIntensity: controlsState.state.lighting.rimIntensity,
      fillIntensity: controlsState.state.lighting.fillIntensity,
      centerIntensity: controlsState.state.lighting.centerIntensity,
    });
    flow.setOptions({
      dotIntensity: controlsState.state.lighting.spotIntensity,
      pulseIntensity: controlsState.state.lighting.flowPulseIntensity,
      dotSize: controlsState.state.lighting.spotFocus,
      flowAngle: controlsState.state.lighting.flowAngle,
      flowSpeed: controlsState.state.lighting.lightMotionSpeed,
    });
  };

  const layoutState = (() => {
    const dims = resolvedGridDimensions(controlsState.state.scene.gridCount);
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
      scaleMultiplier: getLayoutProfile().torusScale,
      heroScaleMultiplier: isMobileDevice() ? 1.35 : 1,
      sharedMaterial: torusResources.material,
      sharedStripeTexture: torusResources.stripeTexture,
    });
  };
  applyQualityLevel(controlsState.state.quality);
  rebuildMeshes();

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
    const layoutProfile = getLayoutProfile();
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
    const dims = resolvedGridDimensions(layoutState.gridCount);
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
    flow.setEnabled(controlsState.state.flowEnabled);
    lights.setDeepBlueAccentsEnabled?.(isDeepBlue);
    applyLightingState();
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
    const dims = resolvedGridDimensions(partial.gridCount ?? layoutState.gridCount);
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
      min: getLayoutProfile().gridMin,
      max: getLayoutProfile().gridMax,
      defaultValue: getLayoutProfile().gridDefault,
    },
    initialQuality: controlsState.state.quality,
    onPresetChange: (key) => handlePresetChange(key),
    onLightingChange: (partial) => {
      controlsState.setLighting(partial);
      applyLightingState();
      ui.setLightingValues(controlsState.state.lighting);
      storeCurrentPresetOverride();
      writeStoredState();
    },
    onSceneChange: (partial) => {
      layoutUpdate(partial);
      ui.setSceneValues(controlsState.state.scene);
      storeCurrentPresetOverride();
      writeStoredState();
    },
    onQualityChange: (level) => {
      applyQualityLevel(level);
      controlsState.setQuality(level);
      storedState.quality = level;
      ui.setQuality(level);
      writeStoredState();
    },
    onPlayToggle: () => {
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
      ui.setLightingValues(controlsState.state.lighting);
      ui.setSceneValues(controlsState.state.scene);
      ui.setQuality(defaultQuality);
      ui.resetPanel(defaultPresetKey);
      writeStoredState();
    },
  });

  const initialPreset = isPresetKey(storedState.preset) ? storedState.preset : defaultPresetKey;
  storedState.preset = initialPreset;
  applyPreset(initialPreset, { applyPresetQuality: false });
  ui?.setPreset(initialPreset);
  ui?.setLightingValues(controlsState.state.lighting);
  ui?.setSceneValues(controlsState.state.scene);
  ui.setQuality(controlsState.state.quality);

  const clock = new THREE.Clock();
  let lastAudioStatePersistAt = 0;
  const cameraDrift = new THREE.Vector3();
  const previousCameraDrift = new THREE.Vector3();
  const animate = () => {
    const deltaTime = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    const reactive = flow.update(deltaTime);
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
    cameraDrift.set(Math.sin(elapsed * 0.08) * 0.2, Math.cos(elapsed * 0.06) * 0.15, 0);
    cameraDrift.sub(previousCameraDrift);
    camera.position.add(cameraDrift);
    controls.target.add(cameraDrift);
    previousCameraDrift.add(cameraDrift);
    const touchDecay = Math.pow(0.9, deltaTime * 60);
    touchSpinVelocity *= touchDecay;
    if (Math.abs(touchSpinVelocity) < 0.00005) {
      touchSpinVelocity = 0;
    }
    const exposure = controlsState.state.flowEnabled
      ? THREE.MathUtils.clamp(1.0 + (reactive?.mid ?? 0) * 0.6, 0.95, 1.25)
      : 1.08;
    renderer.toneMappingExposure = exposure;
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
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    applyAdaptivePixelRatio();
    renderer.setSize(sizes.width, sizes.height);
    postprocessing.setSize(sizes.width, sizes.height);
  });

  window.__debugDumpSettings = () => {
    const storage = {};
    STORAGE_KEYS.forEach((key) => {
      storage[key] = window.localStorage.getItem(key);
    });
    return {
      storage,
      runtime: {
        preset: controlsState.state.presetKey,
        quality: controlsState.state.quality,
        lighting: { ...controlsState.state.lighting },
        scene: { ...controlsState.state.scene },
      },
      persisted: {
        preset: storedState.preset,
        quality: storedState.quality,
        overrides: JSON.parse(JSON.stringify(storedState.overrides ?? {})),
      },
    };
  };
  window.__debugClearSettings = () => {
    STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  };

  return { scene, camera, renderer, controls };
}
