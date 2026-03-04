import * as THREE from 'three';

export function createCamera({ fov, aspect, near, far, position }) {
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.copy(position);
  return camera;
}
