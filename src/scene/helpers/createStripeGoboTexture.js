import * as THREE from 'three';

export function createStripeGoboTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);

  const stripeCount = 18;
  const stripeHeight = size / stripeCount;
  for (let i = 0; i < stripeCount; i += 1) {
    const y = i * stripeHeight;
    const bright = i % 2 === 0;
    ctx.fillStyle = bright ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,1)';
    ctx.fillRect(0, y, size, stripeHeight);
    if (bright) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, y + stripeHeight * 0.15, size, stripeHeight * 0.2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.center.set(0.5, 0.5);
  texture.repeat.set(1.2, 1.8);
  texture.needsUpdate = true;
  return texture;
}
