import { BASE_CONFIG } from './baseConfig.js';
import { PRESET_CONFIG } from './presetsConfig.js';
import { QUALITY_PROFILES } from './qualityProfiles.js';
import { mergeDeep } from './mergeDeep.js';

const DEVICE_PROFILES = {
  mobile: QUALITY_PROFILES.mobile,
  desktop: QUALITY_PROFILES.desktop,
};

export function getDeviceProfile() {
  if (typeof window === 'undefined') return 'desktop';
  const isMobile =
    window.matchMedia?.('(max-width: 900px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.innerWidth <= 900;
  return isMobile ? 'mobile' : 'desktop';
}

export function buildRuntimeConfig(presetKey = 'DEEP_BLUE', deviceProfile = getDeviceProfile()) {
  const preset = PRESET_CONFIG[presetKey] || {};
  const device = DEVICE_PROFILES[deviceProfile] || {};
  return mergeDeep(BASE_CONFIG, device, preset);
}
