export const QUALITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
};

export const DEFAULT_QUALITY = QUALITY_LEVELS.HIGH;

export function applyQuality(renderer, level, callback, pixelRatio) {
  const resolved = level || DEFAULT_QUALITY;
  const dpr = pixelRatio || window.devicePixelRatio;
  const viewportWidth =
    (typeof window !== 'undefined' && window.innerWidth) ||
    (typeof document !== 'undefined' && document.documentElement?.clientWidth) ||
    0;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile =
    window.matchMedia?.('(max-width: 900px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    viewportWidth > 0 && viewportWidth <= 900;

  const desktopPresets = {
    [QUALITY_LEVELS.LOW]: {
      level: QUALITY_LEVELS.LOW,
      tubularSegments: 110,
      radialSegments: 55,
      pixelRatioCap: 1,
      shadowsEnabled: false,
      shadowMapSize: 0,
    },
    [QUALITY_LEVELS.MEDIUM]: {
      level: QUALITY_LEVELS.MEDIUM,
      tubularSegments: 160,
      radialSegments: 80,
      pixelRatioCap: 1.4,
      shadowsEnabled: false,
      shadowMapSize: 512,
    },
    [QUALITY_LEVELS.HIGH]: {
      level: QUALITY_LEVELS.HIGH,
      tubularSegments: 220,
      radialSegments: 110,
      pixelRatioCap: 2.2,
      shadowsEnabled: true,
      shadowMapSize: 1024,
    },
  };

  // Pre-boost mobile-safe settings (lżejsze jak wcześniej).
  const mobilePresets = {
    [QUALITY_LEVELS.LOW]: {
      level: QUALITY_LEVELS.LOW,
      tubularSegments: 92,
      radialSegments: 46,
      pixelRatioCap: 1,
      shadowsEnabled: false,
      shadowMapSize: 0,
    },
    [QUALITY_LEVELS.MEDIUM]: {
      level: QUALITY_LEVELS.MEDIUM,
      tubularSegments: 130,
      radialSegments: 65,
      pixelRatioCap: 1.3,
      shadowsEnabled: false,
      shadowMapSize: 512,
    },
    [QUALITY_LEVELS.HIGH]: {
      level: QUALITY_LEVELS.HIGH,
      tubularSegments: 160,
      radialSegments: 80,
      pixelRatioCap: 1.9,
      shadowsEnabled: true,
      shadowMapSize: 1024,
    },
  };

  let preset = (isMobile ? mobilePresets : desktopPresets)[resolved] ?? desktopPresets.LOW;
  // dodatkowy cap na mobile dla płynności
  if (isMobile) {
    preset = {
      ...preset,
      pixelRatioCap: Math.max(0.85, preset.pixelRatioCap * 0.9),
    };
  }

  renderer.setPixelRatio(Math.min(dpr, preset.pixelRatioCap));
  renderer.shadowMap.enabled = preset.shadowsEnabled;
  if (typeof callback === 'function') {
    callback(preset, resolved);
  }
  return preset;
}
