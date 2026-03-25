export const BASE_CONFIG = Object.freeze({
  visual: {
    background: 0x050816,
    fogColor: 0x0b1020,
    fogDensity: 0.018,
    bloomStrength: 1.2,
  },
  torus: {
    radius: 1.4,
    tube: 0.28,
    radialSegments: 180,
    tubularSegments: 48,
    rotationX: Math.PI * 0.12,
  },
  particles: {
    count: 2600,
    size: 0.018,
    speed: 0.35,
  },
  lights: {
    ambient: 0.35,
    key: 1.8,
    rim: 1.1,
    fill: 1.0,
    center: 1.0,
  },
  motion: {
    autoRotateSpeed: 0.12,
    pulseStrength: 0.2,
  },
});
