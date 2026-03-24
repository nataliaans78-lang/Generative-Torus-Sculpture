import * as THREE from 'three';

export function createLights(scene, settings) {
  const ambientBase = 0.22;
  const ambientLight = new THREE.AmbientLight(0x293d9b, ambientBase);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(settings.key.color, settings.key.intensity);
  keyLight.position.set(...settings.key.position);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(settings.rim.color, settings.rim.intensity);
  rimLight.position.set(...settings.rim.position);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(settings.fill.color, settings.fill.intensity, 14, 2);
  fillLight.position.set(...settings.fill.position);
  scene.add(fillLight);

  const deepBlueAccentBlue = new THREE.PointLight(0x60a5fa, 0, 18, 2);
  deepBlueAccentBlue.position.set(4.4, 2.2, 3.2);
  scene.add(deepBlueAccentBlue);

  const deepBlueAccentViolet = new THREE.PointLight(0xa78bfa, 0, 18, 2);
  deepBlueAccentViolet.position.set(-4.2, 1.8, -3.1);
  scene.add(deepBlueAccentViolet);

  // subtle wall accents for Deep Blue
  const deepWallLeft = new THREE.SpotLight(0x4fa3ff, 0, 18, Math.PI / 3, 0.6, 2);
  const deepWallRight = new THREE.SpotLight(0x4fa3ff, 0, 18, Math.PI / 3, 0.6, 2);
  deepWallLeft.position.set(-6.5, 1.1, 0.8);
  deepWallRight.position.set(6.5, 1.1, -0.6);
  const deepWallLeftTarget = new THREE.Object3D();
  const deepWallRightTarget = new THREE.Object3D();
  deepWallLeftTarget.position.set(-9.2, 1.0, -1.4);
  deepWallRightTarget.position.set(9.2, 1.0, 1.2);
  deepWallLeft.target = deepWallLeftTarget;
  deepWallRight.target = deepWallRightTarget;
  deepWallLeft.angle = Math.PI / 2.4;
  deepWallRight.angle = Math.PI / 2.4;
  scene.add(deepWallLeft, deepWallRight, deepWallLeftTarget, deepWallRightTarget);

  const centerDistance = settings.center?.distance ?? 9;
  const centerDecay = settings.center?.decay ?? 2;
  const centerAngle = settings.center?.angle ?? Math.PI / 8;
  const centerPenumbra = settings.center?.penumbra ?? 0.48;
  const centerLight = new THREE.SpotLight(
    settings.center?.color ?? 0x8fb6ff,
    settings.center?.intensity ?? 0,
    centerDistance,
    centerAngle,
    centerPenumbra,
    centerDecay,
  );
  centerLight.position.set(...(settings.center?.position ?? [0, 0, 0]));
  const centerTarget = new THREE.Object3D();
  centerTarget.position.set(...(settings.center?.target ?? [0.55, -0.1, 0.25]));
  scene.add(centerTarget);
  centerLight.target = centerTarget;
  scene.add(centerLight);

  const edgeDistance = settings.edge?.distance ?? 24;
  const edgeDecay = settings.edge?.decay ?? 2;
  const edgeBaseIntensity = settings.edge?.intensity ?? 0.95;
  const edgeColor = settings.edge?.color ?? 0x7fb4ff;
  const edgeAngle = settings.edge?.angle ?? Math.PI / 6;
  const edgePenumbra = settings.edge?.penumbra ?? 0.5;
  const topEdgeLight = new THREE.SpotLight(
    edgeColor,
    edgeBaseIntensity,
    edgeDistance,
    edgeAngle,
    edgePenumbra,
    edgeDecay,
  );
  const lowEdgeLight = new THREE.SpotLight(
    edgeColor,
    edgeBaseIntensity * 0.9,
    edgeDistance,
    edgeAngle,
    edgePenumbra,
    edgeDecay,
  );
  const topEdgeTarget = new THREE.Object3D();
  const lowEdgeTarget = new THREE.Object3D();
  topEdgeLight.target = topEdgeTarget;
  lowEdgeLight.target = lowEdgeTarget;
  scene.add(topEdgeLight, lowEdgeLight, topEdgeTarget, lowEdgeTarget);

  const setLayoutBounds = ({ halfX = 3, halfY = 2, halfZ = 3 } = {}) => {
    const xOffset = halfX + 1.35;
    const zOffset = Math.max(0.7, halfZ * 0.46);
    const topY = halfY + 3.4;
    const lowY = -halfY * 0.55 - 0.65;
    topEdgeLight.position.set(-halfX * 0.38, topY, halfZ * 0.74);
    lowEdgeLight.position.set(xOffset, lowY, -zOffset);
    topEdgeTarget.position.set(halfX * 0.2, halfY * 0.82, -halfZ * 0.12);
    lowEdgeTarget.position.set(-halfX * 0.28, halfY * 0.55, halfZ * 0.18);
    const spreadScale = THREE.MathUtils.clamp(halfX / 2.6, 1, 2.2);
    const edgeIntensity = edgeBaseIntensity * spreadScale;
    const topAngle = THREE.MathUtils.clamp(
      edgeAngle * (1 + halfX * 0.06),
      Math.PI / 7,
      Math.PI / 4,
    );
    topEdgeLight.angle = topAngle;
    lowEdgeLight.angle = edgeAngle;
    topEdgeLight.intensity = edgeIntensity * 1.25;
    lowEdgeLight.intensity = edgeIntensity * 0.9;
  };

  setLayoutBounds();

  const setFlowAccents = (presetKey, introPhase = 0) => {
    const scale = 1 + introPhase * 0.2;
    if (presetKey === 'DEEP_BLUE') {
      deepBlueAccentBlue.intensity = 1.25 * scale;
      deepBlueAccentViolet.intensity = 0.1 * scale;
      ambientLight.intensity = ambientBase * (1 + introPhase * 0.12);
      deepWallLeft.intensity = 1.2 * scale;
      deepWallRight.intensity = 1.2 * scale;
      return;
    }
    if (presetKey === 'FLOW_SOFT') {
      deepBlueAccentBlue.intensity = 1.18 * scale;
      deepBlueAccentViolet.intensity = 0.56 * scale;
      ambientLight.intensity = ambientBase * (1 + introPhase * 0.15);
      deepWallLeft.intensity = 0;
      deepWallRight.intensity = 0;
      return;
    }
    if (presetKey === 'FLOW_STRONG') {
      deepBlueAccentBlue.intensity = 0.72 * scale;
      deepBlueAccentViolet.intensity = 1.15 * scale;
      ambientLight.intensity = ambientBase * (1 + introPhase * 0.15);
      deepWallLeft.intensity = 0;
      deepWallRight.intensity = 0;
      return;
    }
    // fallback: disable for other presets (Deep Blue handled separately)
    deepBlueAccentBlue.intensity = 0;
    deepBlueAccentViolet.intensity = 0;
    ambientLight.intensity = ambientBase;
    deepWallLeft.intensity = 0;
    deepWallRight.intensity = 0;
  };

  return {
    ambientLight,
    keyLight,
    rimLight,
    fillLight,
    deepBlueAccentBlue,
    deepBlueAccentViolet,
    setFlowAccents,
    centerLight,
    topEdgeLight,
    lowEdgeLight,
    setLayoutBounds,
  };
}
