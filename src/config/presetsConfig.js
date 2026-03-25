export const PRESET_CONFIG = Object.freeze({
  DEEP_BLUE: {
    visual: {
      fogDensity: 0.022,
      bloomStrength: 1.4,
    },
    lights: {
      key: 2.0,
      rim: 1.4,
      fill: 0.9,
      center: 0.9,
    },
    motion: {
      pulseStrength: 0.12,
    },
  },
  FLOW_SOFT: {
    particles: {
      speed: 0.22,
      count: 1800,
    },
    motion: {
      autoRotateSpeed: 0.08,
      pulseStrength: 0.1,
    },
  },
  FLOW_STRONG: {
    particles: {
      speed: 0.55,
      count: 3200,
    },
    motion: {
      autoRotateSpeed: 0.22,
      pulseStrength: 0.32,
    },
  },
});
