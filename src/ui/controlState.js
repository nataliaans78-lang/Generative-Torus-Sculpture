const DEFAULT_UI_STATE = Object.freeze({
  presetKey: 'DEEP_BLUE',
  flowEnabled: false,
  roomEnabled: true,
  fogEnabled: true,
  lighting: Object.freeze({
    keyIntensity: 4.2,
    rimIntensity: 2.8,
    fillIntensity: 0,
    centerIntensity: 1.15,
    spotIntensity: 0,
    flowPulseIntensity: 2.2,
    spotFocus: 1.0,
    flowAngle: Math.PI / 12,
    lightMotionSpeed: 1.0,
  }),
  scene: Object.freeze({
    gridCount: 2,
    gridSpacing: 1.75,
    globalRotationSpeed: 0.03,
    driftAmp: 0.03,
  }),
  room: Object.freeze({
    color: 0x060c18,
    emissiveIntensity: 0.2,
  }),
  fog: Object.freeze({
    enabled: true,
    color: 0x050814,
    near: 10,
    far: 45,
  }),
  quality: 'HIGH',
});

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
