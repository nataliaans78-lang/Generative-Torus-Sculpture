import * as THREE from 'three';

export function createStripeTexture(size = 1024, { generateMipmaps = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.needsUpdate = true;
    return fallback;
  }
  const palette = ['#173f9d', '#2c66d4', '#54d9ff', '#9c8dff', '#d691ff', '#ffe3ff'];
  const stripeHeight = 22;
  const gapHeight = 8;
  const totalBand = stripeHeight + gapHeight;

  for (let y = 0; y < size; y += 1) {
    const idx = Math.floor(y / totalBand) % palette.length;
    const localY = y % totalBand;

    if (localY < stripeHeight) {
      const start = palette[idx];
      const end = palette[(idx + 1) % palette.length];
      const gradient = ctx.createLinearGradient(0, y, size, y);
      gradient.addColorStop(0, start);
      gradient.addColorStop(0.45, end);
      gradient.addColorStop(1, start);
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = '#153072';
    }
    ctx.fillRect(0, y, size, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.center.set(0.5, 0.5);
  texture.rotation = Math.PI / 2;
  texture.repeat.set(1, 6);
  texture.generateMipmaps = generateMipmaps;
  texture.minFilter = generateMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.encoding = THREE.sRGBEncoding;
  texture.needsUpdate = true;
  return texture;
}
