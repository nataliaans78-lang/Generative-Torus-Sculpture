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
    (viewportWidth > 0 && viewportWidth <= 900);

  const desktopPresets = {
    [QUALITY_LEVELS.LOW]: {
      level: QUALITY_LEVELS.LOW,
      tubularSegments: 105,
      radialSegments: 64, // podbite, żeby krawędzie były łagodniejsze
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
      tubularSegments: 78,
      radialSegments: 48, // trochę więcej segmentów dla gładszych krawędzi
      pixelRatioCap: 1.0,
      shadowsEnabled: false,
      shadowMapSize: 0,
    },
    [QUALITY_LEVELS.MEDIUM]: {
      level: QUALITY_LEVELS.MEDIUM,
      tubularSegments: 120,
      radialSegments: 60,
      pixelRatioCap: 1.35,
      shadowsEnabled: false,
      shadowMapSize: 512,
    },
    [QUALITY_LEVELS.HIGH]: {
      level: QUALITY_LEVELS.HIGH,
      tubularSegments: 160,
      radialSegments: 80,
      pixelRatioCap: 2.0,
      shadowsEnabled: true,
      shadowMapSize: 1024,
    },
  };

  const preset = (isMobile ? mobilePresets : desktopPresets)[resolved] ?? desktopPresets.LOW;

  renderer.setPixelRatio(Math.min(dpr, preset.pixelRatioCap));
  renderer.shadowMap.enabled = preset.shadowsEnabled;
  if (typeof callback === 'function') {
    callback(preset, resolved);
  }
  return preset;
}
