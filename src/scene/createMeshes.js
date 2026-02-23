import * as THREE from 'three';
import { createStripeTexture } from './helpers/createStripeTexture.js';

const TEMP_MATRIX = new THREE.Matrix4();
const TEMP_QUATERNION = new THREE.Quaternion();
const TEMP_VECTOR = new THREE.Vector3();
const TEMP_EULER = new THREE.Euler();
const TEMP_SCALE = new THREE.Vector3();
const ROW_COLOR_BOTTOM = new THREE.Color(0x2b6cff);
const ROW_COLOR_MIDDLE = new THREE.Color(0x7a3cff);
const ROW_COLOR_TOP = new THREE.Color(0x5fe6ff);
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

  for (let i = 0; i < count; i += 1) {
    const scaleBase = 0.92 + hash(i) * 0.14;
    scaleFactors[i] = i === heroIndex ? 1.3 : scaleBase;
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
  const driftXAmp = 0.02 * driftScale;
  const driftYAmp = 0.04 * driftScale;
  const driftZAmp = 0.02 * driftScale;
  let elapsed = 0;
  const update = (deltaTime, reactive = null) => {
    elapsed += deltaTime;
    const smoothBass = reactive?.bass ?? 0;
    const smoothMid = reactive?.mid ?? 0;
    const smoothHigh = reactive?.high ?? 0;
    const rotSpeedX = 0.05 + smoothHigh * 0.25;
    const rotSpeedY = 0.03 + smoothMid * 0.18;
    const liftAmp = 0.02 + smoothBass * 0.08;
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const baseX = basePositions[i3] + baseOffsets[i3];
      const baseY = basePositions[i3 + 1] + baseOffsets[i3 + 1];
      const baseZ = basePositions[i3 + 2] + baseOffsets[i3 + 2];
      const phase = phases[i];
      const driftX = Math.sin(elapsed * 0.22 + phase) * driftXAmp;
      const driftY =
        Math.sin(elapsed * 0.5 + phase * 0.7) * driftYAmp +
        Math.sin(elapsed * 1.2 + phase) * liftAmp;
      const driftZ = Math.cos(elapsed * 0.26 + phase * 1.1) * driftZAmp;
      TEMP_VECTOR.set(baseX + driftX, baseY + driftY, baseZ + driftZ);
      const rotationX = elapsed * rotSpeedX * rotationVariance[i] + phase * 0.02;
      const rotationY = elapsed * rotSpeedY * rotationVariance[i] + phase * 0.015;
      TEMP_EULER.set(
        rotationX,
        rotationY * 1.2 * axisVariance[i3 + 1],
        rotationX * 0.9 * axisVariance[i3 + 2],
      );
      TEMP_QUATERNION.setFromEuler(TEMP_EULER);
      TEMP_SCALE.setScalar(scaleFactors[i]);
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
    setGeometryDetail,
    setLayout,
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
