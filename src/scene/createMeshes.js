import * as THREE from 'three';
import { createStripeTexture } from './helpers/createStripeTexture.js';

const TEMP_MATRIX = new THREE.Matrix4();
const TEMP_QUATERNION = new THREE.Quaternion();
const TEMP_VECTOR = new THREE.Vector3();
const TEMP_EULER = new THREE.Euler();
const TEMP_SCALE = new THREE.Vector3();
const ROW_COLOR_BOTTOM = new THREE.Color(0x3b79ff);
const ROW_COLOR_MIDDLE = new THREE.Color(0x9652ff);
const ROW_COLOR_TOP = new THREE.Color(0x72dbff);
const GLOBAL_OBJECT_BRIGHTNESS = 1.5;

function hash(seed) {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

function buildPositions(nx, ny, nz, spacing) {
  const total = nx * ny * nz;
  const positions = new Float32Array(total * 3);
  const xCenter = (nx - 1) * 0.5;
  const yCenter = (ny - 1) * 0.5;
  const zCenter = (nz - 1) * 0.5;
  let offset = 0;
  for (let iy = 0; iy < ny; iy += 1) {
    for (let iz = 0; iz < nz; iz += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        positions[offset] = (ix - xCenter) * spacing;
        positions[offset + 1] = (iy - yCenter) * spacing;
        positions[offset + 2] = (iz - zCenter) * spacing;
        offset += 3;
      }
    }
  }
  return positions;
}

function buildStripeTexture(materialConfig) {
  const stripeTexture = createStripeTexture(materialConfig.stripeTextureSize ?? 1024, {
    generateMipmaps: materialConfig.stripeGenerateMipmaps !== false,
  });
  if (typeof materialConfig.stripeAnisotropy === 'number') {
    stripeTexture.anisotropy = materialConfig.stripeAnisotropy;
  }
  if (materialConfig.stripeRepeatX || materialConfig.stripeRepeatY) {
    stripeTexture.repeat.set(materialConfig.stripeRepeatX ?? 1, materialConfig.stripeRepeatY ?? 10);
    stripeTexture.needsUpdate = true;
  }
  return stripeTexture;
}

function buildMaterial(materialConfig, stripeTexture) {
  const material = new THREE.MeshStandardMaterial({
    color: materialConfig.color ?? 0xf2f4ff,
    transparent: false,
    depthWrite: true,
    opacity: 0.95,
    vertexColors: true,
    flatShading: false,
    metalness: materialConfig.metalness ?? 0.65,
    roughness: materialConfig.roughness ?? 0.22,
    map: stripeTexture,
    emissive: materialConfig.emissive ?? 0x102a6b,
    emissiveMap: materialConfig.useEmissiveMap === false ? null : stripeTexture,
    emissiveIntensity: (materialConfig.emissiveIntensity ?? 0.18) * GLOBAL_OBJECT_BRIGHTNESS,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `
        #include <common>
        attribute vec3 instanceMatVar;
        varying vec3 vInstanceMatVar;
        `,
      )
      .replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vInstanceMatVar = instanceMatVar;
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vInstanceMatVar;
        `,
      )
      .replace(
        'float roughnessFactor = roughness;',
        'float roughnessFactor = clamp(roughness + vInstanceMatVar.x, 0.04, 1.0);',
      )
      .replace(
        'float metalnessFactor = metalness;',
        'float metalnessFactor = clamp(metalness + vInstanceMatVar.y, 0.0, 1.0);',
      )
      .replace(
        '#include <map_fragment>',
        `
        #include <map_fragment>
        diffuseColor.rgb *= vInstanceMatVar.z;
        `,
      );
  };
  return material;
}

export function createTorusResources(materialConfig = {}) {
  const stripeTexture = buildStripeTexture(materialConfig);
  const material = buildMaterial(materialConfig, stripeTexture);
  return { stripeTexture, material };
}

export function createTorusCluster(
  scene,
  {
    layout = { nx: 3, ny: 2, nz: 2, spacing: 1.75 },
    geometryConfig = {},
    materialConfig = {},
    motion = {},
    scaleMultiplier = 1,
    heroScaleMultiplier = 1,
    sharedMaterial = null,
    sharedStripeTexture = null,
  } = {},
) {
  let nx = layout.nx;
  let ny = layout.ny;
  let nz = layout.nz;
  let spacing = layout.spacing;
  const count = nx * ny * nz;

  const buildGeometry = (overrides = {}) => {
    const nextGeometry = new THREE.TorusKnotGeometry(
      geometryConfig.radius ?? 0.2,
      geometryConfig.tube ?? 0.2,
      overrides.tubularSegments ?? geometryConfig.tubularSegments ?? 200,
      overrides.radialSegments ?? geometryConfig.radialSegments ?? 100,
      geometryConfig.p ?? 9,
      geometryConfig.q ?? 3,
    );
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  };

  let geometry = buildGeometry();

  const ownsMaterial = sharedMaterial === null;
  const stripeTexture = ownsMaterial
    ? (sharedStripeTexture ?? buildStripeTexture(materialConfig))
    : null;
  const ownsStripeTexture = ownsMaterial && sharedStripeTexture === null;
  const material = ownsMaterial ? buildMaterial(materialConfig, stripeTexture) : sharedMaterial;

  const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
  let mesh = instancedMesh;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  let basePositions = buildPositions(nx, ny, nz, spacing);
  const baseOffsets = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const scaleFactors = new Float32Array(count);
  const rotationVariance = new Float32Array(count);
  const axisVariance = new Float32Array(count * 3);
  const materialVariance = new Float32Array(count * 3);
  const colors = [];
  const heroIndex = Math.floor(count * 0.6);
  const rowDenominator = Math.max(1, ny - 1);
  const colorA = new THREE.Color();
  const colorB = new THREE.Color();
  const resolvedScaleMultiplier =
    typeof scaleMultiplier === 'number' && scaleMultiplier > 0 ? scaleMultiplier : 1;
  const resolvedHeroScaleMultiplier =
    typeof heroScaleMultiplier === 'number' && heroScaleMultiplier > 0 ? heroScaleMultiplier : 1;

  for (let i = 0; i < count; i += 1) {
    const scaleBase = 0.92 + hash(i) * 0.14;
    const baseScale = i === heroIndex ? scaleBase * resolvedHeroScaleMultiplier : scaleBase;
    scaleFactors[i] = baseScale * resolvedScaleMultiplier;
    rotationVariance[i] = 0.87 + hash(i * 13 + 7) * 0.26;
    phases[i] = hash(i * 2) * Math.PI * 2;
    const iy = Math.floor(i / (nx * nz));
    const tRow = iy / rowDenominator;
    if (tRow <= 0.5) {
      colorA.copy(ROW_COLOR_BOTTOM);
      colorB.copy(ROW_COLOR_MIDDLE);
      colorA.lerp(colorB, tRow * 2);
    } else {
      colorA.copy(ROW_COLOR_MIDDLE);
      colorB.copy(ROW_COLOR_TOP);
      colorA.lerp(colorB, (tRow - 0.5) * 2);
    }
    const brightnessJitter = 0.95 + hash(i * 7 + 13) * 0.13;
    colorA.multiplyScalar(brightnessJitter);
    colors.push(colorA.getHex());
    const i3 = i * 3;
    baseOffsets[i3] = (hash(i + 11) - 0.5) * 0.18;
    baseOffsets[i3 + 1] = (hash(i + 23) - 0.5) * 0.14;
    baseOffsets[i3 + 2] = (hash(i + 31) - 0.5) * 0.2;
    axisVariance[i3] = 0.96 + hash(i * 17 + 3) * 0.1;
    axisVariance[i3 + 1] = 0.96 + hash(i * 19 + 5) * 0.1;
    axisVariance[i3 + 2] = 0.96 + hash(i * 23 + 9) * 0.1;
    materialVariance[i3] = (hash(i * 29 + 7) - 0.5) * 0.16;
    materialVariance[i3 + 1] = (hash(i * 31 + 11) - 0.5) * 0.2;
    materialVariance[i3 + 2] = 0.9 + hash(i * 37 + 17) * 0.1;
  }

  const applyMaterialVariance = (targetGeometry) => {
    targetGeometry.setAttribute(
      'instanceMatVar',
      new THREE.InstancedBufferAttribute(materialVariance, 3),
    );
  };
  applyMaterialVariance(geometry);

  const applyInstanceColors = () => {
    const color = new THREE.Color();
    for (let idx = 0; idx < count; idx += 1) {
      color.setHex(colors[idx]);
      mesh.setColorAt(idx, color);
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  };
  applyInstanceColors();

  const driftScale = (typeof motion.driftAmp === 'number' ? motion.driftAmp : 0.03) / 0.03;
  const driftXAmp = 0.003 * driftScale;
  const driftYAmp = 0.0055 * driftScale;
  const driftZAmp = 0.003 * driftScale;
  const hoverWeights = new Float32Array(count);
  let hoveredIndex = -1;

  const setHoverIndex = (index) => {
    hoveredIndex = Number.isInteger(index) && index >= 0 && index < count ? index : -1;
  };
  let elapsed = 0;
  let introTime = 0;
  const INTRO_DURATION = 2.6;
  let audioBlend = 0;
  let deepAudioBlend = 0;
  let deepBass = 0;
  let deepMid = 0;
  let deepHigh = 0;
  let deepAvg = 0;
  const update = (deltaTime, reactive = null) => {
    elapsed += deltaTime;
    introTime += deltaTime;

    const smoothBass = reactive?.bass ?? 0;
    const smoothMid = reactive?.mid ?? 0;
    const smoothHigh = reactive?.high ?? 0;
    const smoothAvg = reactive?.avg ?? 0;
    const flowProfile = reactive?.flowProfile ?? 'SOFT';
    const audioActive = Boolean(reactive?.audioActive);
    // smooth audio activation to avoid jumps when music starts
    audioBlend = THREE.MathUtils.lerp(audioBlend, audioActive ? 1 : 0, deltaTime * 2.5);
    const deepAudioTarget = flowProfile === 'DEEP_BLUE' && audioActive ? 1 : 0;
    deepAudioBlend = THREE.MathUtils.lerp(
      deepAudioBlend,
      deepAudioTarget,
      THREE.MathUtils.clamp(deltaTime * 2.2, 0, 1),
    );
    deepBass = THREE.MathUtils.lerp(deepBass, smoothBass, deepAudioBlend);
    deepMid = THREE.MathUtils.lerp(deepMid, smoothMid, deepAudioBlend);
    deepHigh = THREE.MathUtils.lerp(deepHigh, smoothHigh, deepAudioBlend);
    deepAvg = THREE.MathUtils.lerp(deepAvg, deepBass * 0.6 + deepMid * 0.3 + deepHigh * 0.1, deepAudioBlend);

    const profileScale = flowProfile === 'STRONG' ? 1.12 : 1.0;

    const introT = THREE.MathUtils.clamp(introTime / INTRO_DURATION, 0, 1);
    const hoverLerp = THREE.MathUtils.clamp(deltaTime * 0.2, 0, 1);

    const bass = flowProfile === 'DEEP_BLUE' ? deepBass : smoothBass;
    const mid = flowProfile === 'DEEP_BLUE' ? deepMid : smoothMid;
    const high = flowProfile === 'DEEP_BLUE' ? deepHigh : smoothHigh;
    const avg = flowProfile === 'DEEP_BLUE' ? deepAvg : smoothAvg;

    // shared motion params
    const rotSpeedBaseX = 0.005 + high * 0.028 * profileScale;
    const rotSpeedBaseY = 0.0038 + mid * 0.022 * profileScale;
    const liftBase = 0.0025 + bass * 0.018 * profileScale;
    const pulseScaleAmp = 0.012 + bass * 0.05 * profileScale;
    const twistAmp = 0.025 + mid * 0.06 * profileScale;
    const shimmerAmp = high * 0.035;
    const depthSwayAmp = 0.004 + avg * 0.012;

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;

      const hoverTarget = i === hoveredIndex ? 1 : 0;
      hoverWeights[i] = THREE.MathUtils.lerp(hoverWeights[i], hoverTarget, hoverLerp);
      const hover = hoverWeights[i];
      const hoverRotDamp = 1 - hover * 0.45;

      const baseX = basePositions[i3] + baseOffsets[i3];
      const baseY = basePositions[i3 + 1] + baseOffsets[i3 + 1];
      const baseZ = basePositions[i3 + 2] + baseOffsets[i3 + 2];
      const phase = phases[i];

      // intro motion (clean, shared)
      const introOffset = Math.sin(elapsed * 0.8 + phase * 0.35) * 0.006;
      const introLift = Math.sin(elapsed * 0.9) * 0.012;
      const introTwist = Math.sin(elapsed * 0.55) * 0.08;
      const introScale = 1 + Math.sin(elapsed * 1.1) * 0.018;

      const randomPulse =
        Math.sin(elapsed * (0.9 + phase * 0.12) + phase * 3.1) * (0.004 + smoothAvg * 0.01);
      const randomLift =
        Math.cos(elapsed * (0.7 + phase * 0.08) + phase * 2.4) * (0.006 + smoothBass * 0.012);
      const basePulse =
        Math.sin(elapsed * (0.85 + phase * 0.05) + phase * 2.1) * (0.008 + smoothAvg * 0.01);

    const bassPulseBlend = flowProfile === 'DEEP_BLUE' ? deepAudioBlend : audioBlend;
    const bassPulse = Math.sin(elapsed * 2.2 + phase * 1.3) * pulseScaleAmp * bassPulseBlend;

      // base drift
      let driftX =
        Math.sin(elapsed * 0.22 + phase) * driftXAmp +
        Math.sin(elapsed * 0.95 + phase * 1.1) * smoothMid * 0.01;
      let driftY =
        Math.sin(elapsed * 0.5 + phase * 0.7) * driftYAmp +
        Math.sin(elapsed * 1.2 + phase) * liftBase +
        hover * 0.003;
      let driftZ =
        Math.cos(elapsed * 0.26 + phase * 1.1) * driftZAmp +
        Math.cos(elapsed * 0.82 + phase * 0.9) * depthSwayAmp;
      driftZ += Math.sin(elapsed * 0.3 + phase) * 0.02;

      // idle / audio extra drift
      const idleDriftBlend = introT * (audioActive ? 0 : 1);
      driftX += Math.sin(elapsed * 0.3 + phase) * 0.01 * idleDriftBlend;
      driftZ += Math.cos(elapsed * 0.35 + phase) * 0.01 * idleDriftBlend;
      if (audioBlend > 0 && flowProfile !== 'DEEP_BLUE') {
        driftX +=
          Math.sin(elapsed * 0.9 + phase * 1.3) * (0.01 + bass * 0.01) * audioBlend;
        driftZ +=
          Math.cos(elapsed * 1.0 + phase) * (0.01 + mid * 0.015) * audioBlend;
        driftY += bass * 0.02 * audioBlend;
      }
      if (flowProfile !== 'DEEP_BLUE') {
        const liftBlend = 0.7 + 0.3 * audioBlend;
        driftY += randomLift * liftBlend;
      }
      if (flowProfile !== 'DEEP_BLUE') {
        const idleBaseScale = flowProfile === 'STRONG' ? 1.15 : 1.0;
        driftX += Math.sin(elapsed * 0.16 + phase * 0.7) * 0.0025 * idleBaseScale;
        driftZ += Math.cos(elapsed * 0.14 + phase * 0.5) * 0.0022 * idleBaseScale;
      }
      if (flowProfile === 'DEEP_BLUE') {
        driftX += Math.sin(elapsed * 0.12 + phase) * 0.0025;
        driftY += Math.cos(elapsed * 0.16 + phase * 0.6) * 0.003;
        driftZ += Math.sin(elapsed * 0.14 + phase * 0.8) * 0.0022;
        driftY += Math.sin(elapsed * 0.55 + phase * 0.7) * 0.004 * deepAudioBlend;
        driftX += bass * 0.004 * deepAudioBlend;
        driftZ += mid * 0.003 * deepAudioBlend;
      }

      // positions blended intro -> normal (fade additive)
      const introFade = 1 - introT;
      const finalX = baseX + driftX + introOffset * introFade;
      const finalY =
        baseY +
        driftY +
        bassPulse * 0.6 +
        (introLift + introOffset + basePulse * 0.4) * introFade;
      const finalZ = baseZ + driftZ + introOffset * introFade;
      TEMP_VECTOR.set(finalX, finalY, finalZ);

      // rotation components
      const introRotationX = introTwist + phase * 0.01;
      const introRotationY = introTwist * 0.65 + phase * 0.008;

      let normalRotationX =
        elapsed * rotSpeedBaseX * hoverRotDamp + phase * 0.02 + hover * (Math.PI * 2);
      let normalRotationY = elapsed * rotSpeedBaseY * hoverRotDamp + phase * 0.015;
      let normalRotationZ =
        normalRotationX * 0.9 * axisVariance[i3 + 2] +
        Math.sin(elapsed * 0.9 + phase * 1.4) * (0.015 + high * 0.025);

      normalRotationY += Math.sin(elapsed * 0.42 + phase * 0.25) * (0.03 + bass * 0.03);
      normalRotationY += mid * 0.08;
      normalRotationX += high * 0.05;
      normalRotationZ += Math.sin(elapsed * 1.5 + phase) * (0.01 + high * 0.03);

      const idleRotY = Math.sin(elapsed * 0.4 + phase) * 0.04;
      const audioRotY = Math.sin(elapsed * 1.2 + phase) * (0.05 + mid * 0.08);
      normalRotationY += THREE.MathUtils.lerp(idleRotY, audioRotY, audioBlend);

      let rotationX = THREE.MathUtils.lerp(introRotationX, normalRotationX, introT);
      let rotationY = THREE.MathUtils.lerp(introRotationY, normalRotationY, introT);
      let rotationZ = normalRotationZ;

      if (flowProfile === 'DEEP_BLUE') {
        rotationY += Math.sin(elapsed * 0.75 + phase) * 0.02 * deepAudioBlend;
        rotationX += Math.cos(elapsed * 0.6 + phase * 0.4) * 0.012 * deepAudioBlend;
        rotationZ += Math.sin(elapsed * 1.1 + phase * 0.9) * 0.008 * deepAudioBlend;
      }

      const pulseAmount = THREE.MathUtils.lerp(0.08, 1, audioBlend);
      const pulseBlend = introT;
      if (flowProfile !== 'DEEP_BLUE') {
        rotationY += randomPulse * 2.2 * pulseAmount * pulseBlend + basePulse * 0.12 * (1 - introT);
        rotationX += randomPulse * 1.6 * pulseAmount * pulseBlend + basePulse * 0.08 * (1 - introT);
      } else {
        rotationY += Math.sin(elapsed * 0.22 + phase) * 0.012;
        rotationX += Math.cos(elapsed * 0.18 + phase * 0.5) * 0.008;
        rotationY += Math.sin(elapsed * 0.7 + phase * 0.8) * 0.014 * deepAudioBlend;
        rotationX += Math.cos(elapsed * 0.5 + phase * 0.6) * 0.009 * deepAudioBlend;
      }

      TEMP_EULER.set(rotationX, rotationY * 1.2 * axisVariance[i3 + 1], rotationZ);
      TEMP_QUATERNION.setFromEuler(TEMP_EULER);

      // scale: blend intro -> normal
      const introScaleMul = 1 + Math.sin(elapsed * 1.2 + phase * 0.2) * 0.018;
      let normalScaleMul = 1;
      if (flowProfile === 'DEEP_BLUE') {
        normalScaleMul += Math.sin(elapsed * 0.55 + phase * 0.3) * 0.004;
        normalScaleMul += bass * 0.003 * deepAudioBlend;
      } else if (audioActive) {
        normalScaleMul += randomPulse * 0.35 + smoothBass * 0.006;
      }
      const finalScale = scaleFactors[i] * THREE.MathUtils.lerp(introScaleMul, normalScaleMul, introT);

      TEMP_SCALE.setScalar(finalScale);

      TEMP_MATRIX.compose(TEMP_VECTOR, TEMP_QUATERNION, TEMP_SCALE);
      mesh.setMatrixAt(i, TEMP_MATRIX);
    }

    mesh.instanceMatrix.needsUpdate = true;
  };

  const setGeometryDetail = ({ tubularSegments, radialSegments } = {}) => {
    const nextGeometry = buildGeometry({ tubularSegments, radialSegments });
    applyMaterialVariance(nextGeometry);
    const previousGeometry = geometry;
    mesh.geometry = nextGeometry;
    geometry = nextGeometry;
    previousGeometry.dispose();
  };

  const recomputeRowColors = () => {
    colors.length = 0;
    const nextRowDenominator = Math.max(1, ny - 1);
    for (let i = 0; i < count; i += 1) {
      const iy = Math.floor(i / (nx * nz));
      const tRow = iy / nextRowDenominator;
      if (tRow <= 0.5) {
        colorA.copy(ROW_COLOR_BOTTOM);
        colorB.copy(ROW_COLOR_MIDDLE);
        colorA.lerp(colorB, tRow * 2);
      } else {
        colorA.copy(ROW_COLOR_MIDDLE);
        colorB.copy(ROW_COLOR_TOP);
        colorA.lerp(colorB, (tRow - 0.5) * 2);
      }
      const brightnessJitter = 0.95 + hash(i * 7 + 13) * 0.13;
      colorA.multiplyScalar(brightnessJitter);
      colors.push(colorA.getHex());
    }
  };

  const setLayout = ({ nx: nextNx, ny: nextNy, nz: nextNz, spacing: nextSpacing } = {}) => {
    if (
      typeof nextNx !== 'number' ||
      typeof nextNy !== 'number' ||
      typeof nextNz !== 'number' ||
      typeof nextSpacing !== 'number' ||
      nextNx <= 0 ||
      nextNy <= 0 ||
      nextNz <= 0 ||
      nextSpacing <= 0
    ) {
      return false;
    }
    if (nextNx * nextNy * nextNz !== count) {
      return false;
    }
    const layoutChanged = nextNx !== nx || nextNy !== ny || nextNz !== nz;
    const spacingChanged = nextSpacing !== spacing;
    if (!layoutChanged && !spacingChanged) {
      return true;
    }
    nx = nextNx;
    ny = nextNy;
    nz = nextNz;
    spacing = nextSpacing;
    basePositions = buildPositions(nx, ny, nz, spacing);
    if (layoutChanged) {
      recomputeRowColors();
      applyInstanceColors();
    }
    return true;
  };

  return {
    get mesh() {
      return mesh;
    },
    setHoverIndex,
    setGeometryDetail,
    setLayout,
    skipIntro() {
      introTime = INTRO_DURATION;
    },
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      if (ownsMaterial) {
        material.dispose();
      }
      if (ownsStripeTexture && stripeTexture) {
        stripeTexture.dispose();
      }
    },
    update,
  };
}
