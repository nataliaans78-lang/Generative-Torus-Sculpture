import { PRESETS } from '../config/presets.js';

const presetToState = (presetKey = 'DEEP_BLUE') => {
  const preset = PRESETS[presetKey] ?? PRESETS.DEEP_BLUE;
  return {
    presetKey,
    flowEnabled: preset.flowEnabled,
    roomEnabled: preset.roomEnabled,
    fogEnabled: preset.fogEnabled,
    lighting: {
      keyIntensity: preset.lighting.keyIntensity,
      rimIntensity: preset.lighting.rimIntensity,
      fillIntensity: preset.lighting.fillIntensity ?? 0,
      centerIntensity: preset.lighting.centerIntensity ?? 0,
      spotIntensity: preset.lighting.flowSpotIntensity ?? 0,
      flowPulseIntensity: preset.lighting.flowPulseIntensity ?? 0,
      spotFocus: preset.lighting.spotFocus ?? 1,
      flowAngle: preset.lighting.flowAngle ?? Math.PI / 12,
      lightMotionSpeed: preset.lighting.flowSpeed ?? 1,
      audioReactiveScale: 1.0,
    },
    scene: {
      gridCount: preset.grid.gridCount,
      gridSpacing: preset.grid.gridSpacing,
      globalRotationSpeed: preset.motion.groupRot,
      driftAmp: preset.motion.driftAmp,
    },
    room: {
      color: preset.room.color,
      emissiveIntensity: preset.room.emissiveIntensity,
    },
    fog: {
      enabled: preset.fog.enabled,
      color: preset.fog.color,
      near: preset.fog.near ?? 10,
      far: preset.fog.far ?? 45,
    },
    quality: 'HIGH',
  };
};

const DEFAULT_UI_STATE = Object.freeze(presetToState('DEEP_BLUE'));

function cloneDefaultState() {
  return {
    presetKey: DEFAULT_UI_STATE.presetKey,
    flowEnabled: DEFAULT_UI_STATE.flowEnabled,
    roomEnabled: DEFAULT_UI_STATE.roomEnabled,
    fogEnabled: DEFAULT_UI_STATE.fogEnabled,
    lighting: { ...DEFAULT_UI_STATE.lighting },
    scene: { ...DEFAULT_UI_STATE.scene },
    room: { ...DEFAULT_UI_STATE.room },
    fog: { ...DEFAULT_UI_STATE.fog },
    quality: DEFAULT_UI_STATE.quality,
  };
}

export function createControlState() {
  const state = cloneDefaultState();
  const setPresetKey = (value) => {
    state.presetKey = value;
    return state.presetKey;
  };
  const setFlowEnabled = (value) => {
    state.flowEnabled = Boolean(value);
    return state.flowEnabled;
  };
  const setRoomEnabled = (value) => {
    state.roomEnabled = Boolean(value);
    return state.roomEnabled;
  };
  const setFogEnabled = (value) => {
    state.fogEnabled = Boolean(value);
    return state.fogEnabled;
  };
  const setLighting = (partial = {}) => {
    Object.assign(state.lighting, partial);
    return state.lighting;
  };
  const setScene = (partial = {}) => {
    Object.assign(state.scene, partial);
    return state.scene;
  };
  const setRoom = (partial = {}) => {
    Object.assign(state.room, partial);
    return state.room;
  };
  const setFog = (partial = {}) => {
    Object.assign(state.fog, partial);
    return state.fog;
  };
  const setQuality = (value) => {
    state.quality = value;
    return state.quality;
  };
  const replaceAll = (next = {}) => {
    state.presetKey = next.presetKey ?? DEFAULT_UI_STATE.presetKey;
    state.flowEnabled = Boolean(next.flowEnabled ?? DEFAULT_UI_STATE.flowEnabled);
    state.roomEnabled = Boolean(next.roomEnabled ?? DEFAULT_UI_STATE.roomEnabled);
    state.fogEnabled = Boolean(next.fogEnabled ?? DEFAULT_UI_STATE.fogEnabled);
    state.lighting = { ...DEFAULT_UI_STATE.lighting, ...(next.lighting ?? {}) };
    state.scene = { ...DEFAULT_UI_STATE.scene, ...(next.scene ?? {}) };
    state.room = { ...DEFAULT_UI_STATE.room, ...(next.room ?? {}) };
    state.fog = { ...DEFAULT_UI_STATE.fog, ...(next.fog ?? {}) };
    state.quality = next.quality ?? state.quality ?? DEFAULT_UI_STATE.quality;
    return state;
  };
  return {
    state,
    defaultState: DEFAULT_UI_STATE,
    setPresetKey,
    setFlowEnabled,
    setRoomEnabled,
    setFogEnabled,
    setLighting,
    setScene,
    setRoom,
    setFog,
    setQuality,
    replaceAll,
  };
}
