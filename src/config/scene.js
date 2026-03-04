export const CAMERA_SETTINGS = {
  fov: 48,
  near: 0.1,
  far: 450,
  position: [4.2, 1.4, 5.2],
  target: [0, 0.1, 0],
};

export const SCENE_SETTINGS = {
  backgroundGradient: {
    topColor: '#050914',
    middleColor: '#030612',
    bottomColor: '#0a1c3a',
  },
};

export const LIGHT_SETTINGS = {
  key: {
    color: 0x7fa8ff,
    intensity: 3.4,
    position: [4.4, 5.2, 3.6],
  },
  rim: {
    color: 0x6a5cff,
    intensity: 2.2,
    position: [-4.8, 2.8, -5.6],
  },
  fill: {
    color: 0x5f7fc6,
    intensity: 1.2,
    position: [0.8, 1.4, 2.6],
  },
  center: {
    color: 0xa8c4ff,
    intensity: 10,
    position: [1.8, 3.2, 1.4],
    target: [0.95, -0.2, 0.05],
    angle: Math.PI / 6,
    penumbra: 0.52,
    distance: 12,
    decay: 2,
  },
  edge: {
    color: 0x7fb4ff,
    intensity: 0.95,
    distance: 24,
    decay: 2,
    angle: Math.PI / 6,
    penumbra: 0.5,
  },
};

export const MESH_SETTINGS = {
  geometry: {
    radius: 0.2,
    tube: 0.2,
    tubularSegments: 200,
    radialSegments: 100,
    p: 9,
    q: 3,
  },
};

export const MATERIAL_SETTINGS = {
  opacity: 0.95,
  metalness: 0.1,
  roughness: 0.55,
  transparent: false,
  depthWrite: true,
  color: 0xffffff,
  emissive: 0x0a2a66,
  emissiveIntensity: 0.1,
  stripeTextureSize: 1024,
  stripeRepeatX: 1,
  stripeRepeatY: 6,
};

export const AUDIO_SETTINGS = {
  url: `${import.meta.env.BASE_URL ?? '/'}assets/sounds/usefulpix-synthwave.mp3`,
  volume: 0.25,
};
