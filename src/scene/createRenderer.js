import * as THREE from 'three';

export function createRenderer({
  width,
  height,
  pixelRatio = window.devicePixelRatio,
  parent,
  alpha = true,
} = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  renderer.useLegacyLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  if (parent) {
    parent.appendChild(renderer.domElement);
  }
  return renderer;
}
