import * as THREE from 'three';

export function colorFromHsl(hue, saturation, lightness) {
  return new THREE.Color().setHSL(hue, saturation, lightness);
}
