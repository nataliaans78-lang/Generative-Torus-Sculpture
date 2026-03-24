export const QUALITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
};

export const DEFAULT_QUALITY = QUALITY_LEVELS.HIGH;

export function applyQuality(renderer, level, callback, pixelRatio) {
  const resolved = level || DEFAULT_QUALITY;
  const dpr = pixelRatio || window.devicePixelRatio;
  let preset = {
    level: QUALITY_LEVELS.LOW,
    tubularSegments: 110,
    radialSegments: 55,
    pixelRatioCap: 1,
    shadowsEnabled: false,
    shadowMapSize: 0,
  };
  if (resolved === QUALITY_LEVELS.MEDIUM) {
    preset = {
      level: QUALITY_LEVELS.MEDIUM,
      tubularSegments: 160,
      radialSegments: 80,
      pixelRatioCap: 1.4,
      shadowsEnabled: false,
      shadowMapSize: 512,
    };
  } else if (resolved === QUALITY_LEVELS.HIGH) {
    preset = {
      level: QUALITY_LEVELS.HIGH,
      tubularSegments: 220,
      radialSegments: 110,
      pixelRatioCap: 2.2,
      shadowsEnabled: true,
      shadowMapSize: 1024,
    };
  }
  renderer.setPixelRatio(Math.min(dpr, preset.pixelRatioCap));
  renderer.shadowMap.enabled = preset.shadowsEnabled;
  if (typeof callback === 'function') {
    callback(preset, resolved);
  }
  return preset;
}
