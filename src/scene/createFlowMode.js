import * as THREE from 'three';
import { createDotGoboTexture } from './helpers/createDotGoboTexture.js';

const SPOT_COUNT = 35;
const WALL_SPOT_COUNT = 8;
const SMOOTHING_FACTOR = 7.2;
const INTENSITY_SMOOTHING = 9.0;
const BASE_SPOT_ANGLE = Math.PI / 12;
const SPHERE_MIN_RADIUS = 8;
const SPHERE_BASE_RADIUS = 8;
const SPHERE_MAX_RADIUS = 16;
const FOG_COLOR = 0x050814;
const FOG_NEAR = 15;
const FOG_FAR = 120;
const LOW_QUALITY_SPOT_COUNT = 2;
const GLOBAL_ROOM_BRIGHTNESS = 1.5;
const FLOW_PALETTE = Object.freeze([
  new THREE.Color('#5B8CFF'),
  new THREE.Color('#2EE9FF'),
  new THREE.Color('#A855F7'),
  new THREE.Color('#FF4FD8'),
]);

function smooth(current, target, deltaTime, smoothingFactor = SMOOTHING_FACTOR) {
  const alpha = 1 - Math.exp(-deltaTime * smoothingFactor);
  return current + (target - current) * alpha;
}

function sampleBandEnergy(data, start, end) {
  let sum = 0;
  const from = Math.max(0, start);
  const to = Math.min(data.length, end);
  const span = Math.max(1, to - from);
  for (let i = from; i < to; i += 1) {
    sum += data[i];
  }
  return sum / (span * 255);
}

function paletteSample(t, target) {
  const n = FLOW_PALETTE.length;
  const wrapped = ((t % 1) + 1) % 1;
  const x = wrapped * n;
  const i = Math.floor(x);
  const f = x - i;
  target.copy(FLOW_PALETTE[i % n]).lerp(FLOW_PALETTE[(i + 1) % n], f);
  return target;
}

function createRoomGradientTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#081126');
  gradient.addColorStop(0.45, '#040a17');
  gradient.addColorStop(1, '#02060f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.encoding = THREE.sRGBEncoding;
  texture.repeat.set(2, 1);
  texture.needsUpdate = true;
  return texture;
}

function createWallSpotTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const gradient = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  gradient.addColorStop(0, 'rgba(188, 225, 255, 0.85)');
  gradient.addColorStop(0.4, 'rgba(114, 170, 255, 0.45)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.encoding = THREE.sRGBEncoding;
  texture.needsUpdate = true;
  return texture;
}

export function createFlowMode({ scene, lights, audioAnalyser, isPlaying: _isPlaying }) {
  const originalFog = scene.fog ?? null;
  const goboTexture = createDotGoboTexture();
  const roomGradientTexture = createRoomGradientTexture(512);
  const wallSpotTexture = createWallSpotTexture(256);
  const rig = new THREE.Group();
  scene.add(rig);
  const roomMaterial = new THREE.MeshStandardMaterial({
    color: 0x060c18,
    roughness: 1,
    metalness: 0,
    side: THREE.BackSide,
    emissive: 0x0a1430,
    emissiveIntensity: 0.2 * GLOBAL_ROOM_BRIGHTNESS,
    map: roomGradientTexture,
  });
  const roomShell = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), roomMaterial);
  roomShell.position.set(0, 0, 0);
  rig.add(roomShell);
  const wallSpotGeometry = new THREE.PlaneGeometry(1, 1);
  const wallSpotMaterial = new THREE.MeshBasicMaterial({
    map: wallSpotTexture,
    color: 0xa4cfff,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wallSpots = [];
  const wallSpotAngles = new Float32Array(WALL_SPOT_COUNT);
  const wallSpotHeights = new Float32Array(WALL_SPOT_COUNT);
  const wallSpotScales = new Float32Array(WALL_SPOT_COUNT);
  const wallSpotSpeeds = new Float32Array(WALL_SPOT_COUNT);
  for (let i = 0; i < WALL_SPOT_COUNT; i += 1) {
    const mesh = new THREE.Mesh(wallSpotGeometry, wallSpotMaterial.clone());
    mesh.renderOrder = 2;
    rig.add(mesh);
    wallSpots.push(mesh);
    wallSpotAngles[i] = (i / WALL_SPOT_COUNT) * Math.PI * 2;
    wallSpotHeights[i] = -0.35 + (i % 4) * 0.24;
    wallSpotScales[i] = 0.18 + (i % 3) * 0.05;
    wallSpotSpeeds[i] = 0.08 + (i % 5) * 0.012;
  }
  const spotLights = [];
  const spotTargets = [];
  const phases = new Float32Array(SPOT_COUNT);
  const radii = new Float32Array(SPOT_COUNT);
  const speeds = new Float32Array(SPOT_COUNT);
  const spotBaseIntensity = new Float32Array(SPOT_COUNT);
  const spotIntensitySmoothed = new Float32Array(SPOT_COUNT);
  const pulseSpotIndex = 0;
  const baseLights = lights ? Object.values(lights).filter((light) => light.isLight) : [];
  const baseIntensities = new Float32Array(baseLights.length);
  baseLights.forEach((light, index) => {
    baseIntensities[index] = light.intensity;
  });
  for (let i = 0; i < SPOT_COUNT; i += 1) {
    const spot = new THREE.SpotLight(0xbfd8ff, 0, 0, BASE_SPOT_ANGLE, 0.48, 1.2);
    spot.visible = false;
    spot.map = goboTexture;
    spot.map.needsUpdate = true;
    const target = new THREE.Object3D();
    rig.add(spot, target);
    spot.target = target;
    spotLights.push(spot);
    spotTargets.push(target);
    phases[i] = (i / SPOT_COUNT) * Math.PI * 2;
    radii[i] = 0.66 + (i % 7) * 0.08;
    speeds[i] = 0.14 + (i % 9) * 0.015;
    spotBaseIntensity[i] = 0.72 + (i % 6) * 0.07;
    spotIntensitySmoothed[i] = 0;
  }
  const state = {
    flowEnabled: false,
    roomEnabled: true,
    fogEnabled: true,
    fogColor: FOG_COLOR,
    fogMode: 'linear',
    fogDensity: 0,
    fogNear: FOG_NEAR,
    fogFar: FOG_FAR,
    dotSize: 1,
    dotIntensity: 1,
    pulseIntensity: 2.2,
    flowAngle: BASE_SPOT_ANGLE,
    flowSpeed: 1,
    gridCount: 2,
    flowProfile: 'SOFT',
    qualityLevel: 'HIGH',
    activeSpotCount: SPOT_COUNT,
    audioActive: false,
  };
  let roomEmissiveBase = 0.2 * GLOBAL_ROOM_BRIGHTNESS;
  const mouse = new THREE.Vector2(0, 0);
  const mouseConductor = new THREE.Vector3();
  const pointerHandler = (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -((event.clientY / window.innerHeight) * 2 - 1);
  };
  const pointerLeaveHandler = () => {
    mouse.set(0, 0);
  };
  window.addEventListener('pointermove', pointerHandler, { passive: true });
  window.addEventListener('pointerleave', pointerLeaveHandler, { passive: true });
  let elapsed = 0;
  let bassSmoothed = 0;
  let midSmoothed = 0;
  let highSmoothed = 0;
  let avgSmoothed = 0;
  const tempColor = new THREE.Color();
  const whiteColor = new THREE.Color(0xffffff);
  const reactiveState = {
    flowEnabled: false,
    bass: 0,
    mid: 0,
    high: 0,
    avg: 0,
    flowProfile: 'SOFT',
  };
  const frequencyData = audioAnalyser ? new Uint8Array(audioAnalyser.data.length) : null;
  const roomState = {
    radius: SPHERE_BASE_RADIUS,
  };
  const pulseAnchorPosition = new THREE.Vector3();
  const pulseAnchorTarget = new THREE.Vector3();
  const sweepVector = new THREE.Vector3();
  const syncFog = () => {
    if (state.fogEnabled) {
      if (state.fogMode === 'exp2') {
        if (!scene.fog || !scene.fog.isFogExp2) {
          scene.fog = new THREE.FogExp2(state.fogColor, state.fogDensity);
        } else {
          scene.fog.color.setHex(state.fogColor);
          scene.fog.density = state.fogDensity;
        }
        return;
      }
      if (!scene.fog || !scene.fog.isFog) {
        scene.fog = new THREE.Fog(state.fogColor, state.fogNear, state.fogFar);
      } else {
        scene.fog.color.setHex(state.fogColor);
        scene.fog.near = state.fogNear;
        scene.fog.far = state.fogFar;
      }
      return;
    }
    scene.fog = originalFog;
  };
  const updateRoom = (layout) => {
    const gridCount = layout.gridCount ?? 2;
    const gridStep = Math.max(0, gridCount - 2);
    const baseRadius = SPHERE_BASE_RADIUS * Math.pow(1.25, gridStep);
    roomState.radius = Math.max(SPHERE_MIN_RADIUS, Math.min(SPHERE_MAX_RADIUS, baseRadius));
    roomShell.scale.setScalar(roomState.radius);
    for (let i = 0; i < WALL_SPOT_COUNT; i += 1) {
      const y = wallSpotHeights[i] * roomState.radius;
      const a = wallSpotAngles[i];
      const radial = Math.sqrt(Math.max(0, roomState.radius * roomState.radius - y * y)) * 0.985;
      wallSpots[i].position.set(Math.cos(a) * radial, y, Math.sin(a) * radial);
      wallSpots[i].lookAt(0, 0, 0);
      const s = roomState.radius * wallSpotScales[i] * 0.82;
      wallSpots[i].scale.set(s, s, 1);
    }
    for (let i = 0; i < SPOT_COUNT; i += 1) {
      spotLights[i].distance = roomState.radius * 3.2;
    }
    pulseAnchorPosition.set(0, roomState.radius * 0.18, roomState.radius * 0.3);
    pulseAnchorTarget.set(0, 0, 0);
  };
  const resolveSpotBudget = () => {
    const count = state.gridCount;
    const isSoft = state.flowProfile === 'SOFT';
    let budget = SPOT_COUNT;
    if (isSoft) {
      if (count >= 5) budget = 12;
      else if (count >= 4) budget = 16;
      else budget = 24;
    } else {
      if (count >= 5) budget = 16;
      else if (count >= 4) budget = 24;
      else budget = 35;
    }
    if (state.qualityLevel === 'MEDIUM') {
      budget = Math.min(budget, 24);
    } else if (state.qualityLevel === 'LOW') {
      budget = Math.min(budget, LOW_QUALITY_SPOT_COUNT);
    }
    return THREE.MathUtils.clamp(budget, 0, SPOT_COUNT);
  };
  const applySpotBudget = () => {
    state.activeSpotCount = resolveSpotBudget();
    for (let i = 0; i < SPOT_COUNT; i += 1) {
      const active = i < state.activeSpotCount;
      spotLights[i].visible = state.flowEnabled && active;
      if (!active) {
        spotLights[i].intensity = 0;
        spotIntensitySmoothed[i] = 0;
      }
    }
  };
  const applyLightingDim = (factor) => {
    baseLights.forEach((light, index) => {
      light.intensity = baseIntensities[index] * factor;
    });
  };
  const getFlowDimFactor = () => {
    const base = state.flowProfile === 'STRONG' ? 0.65 : 0.75;
    return THREE.MathUtils.clamp(base - state.dotIntensity * 0.01, 0.55, 0.85);
  };
  const updateSpotTargets = (deltaTime) => {
    const baseSpeed = state.flowSpeed;
    const speed = baseSpeed * (1 + avgSmoothed * 1.5);
    const emitterRadius = roomState.radius * 0.34;
    const targetRadius = roomState.radius * 0.98;
    const activeCount = Math.max(1, state.activeSpotCount);
    const energy = Math.max(0.08, avgSmoothed);
    const pulseEnergy = Math.max(0.05, bassSmoothed);
    const pulseTarget = THREE.MathUtils.clamp(0.8 + pulseEnergy * state.pulseIntensity * 5, 0, 10);
    const sweepTarget = 0.6 + energy * state.dotIntensity * 3;
    const baseAngle = THREE.MathUtils.clamp(
      (state.flowAngle || BASE_SPOT_ANGLE) * state.dotSize,
      Math.PI / 14,
      Math.PI / 10,
    );
    const sweepAngle = THREE.MathUtils.clamp(
      baseAngle + avgSmoothed * 0.05,
      Math.PI / 14,
      Math.PI / 9,
    );
    const sweepPenumbra = THREE.MathUtils.clamp(0.4 + bassSmoothed * 0.2, 0.4, 0.6);
    const pulsePenumbra = THREE.MathUtils.clamp(0.45 + bassSmoothed * 0.15, 0.45, 0.7);
    mouseConductor.set(mouse.x * roomState.radius * 0.08, mouse.y * roomState.radius * 0.06, 0);
    for (let i = 0; i < SPOT_COUNT; i += 1) {
      const active = i < state.activeSpotCount;
      if (i === pulseSpotIndex) {
        spotLights[i].position.copy(pulseAnchorPosition);
        spotTargets[i].position.copy(pulseAnchorTarget);
      }
      const phase = phases[i] + elapsed * speeds[i] * speed + i * ((Math.PI * 2) / activeCount);
      const lane = radii[i];
      if (i !== pulseSpotIndex) {
        sweepVector.set(
          Math.sin(phase * 1.12 + i * 0.17) + mouseConductor.x / Math.max(1, roomState.radius),
          Math.cos(phase * 0.73 + i * 0.11) * 0.72 +
            mouseConductor.y / Math.max(1, roomState.radius),
          Math.cos(phase * 1.05 + i * 0.14) + mouseConductor.z / Math.max(1, roomState.radius),
        );
        sweepVector.normalize().multiplyScalar(targetRadius);
        spotTargets[i].position.copy(sweepVector);
        spotLights[i].position.set(
          Math.cos(phase * 0.92 + i * 0.08) * emitterRadius * lane,
          Math.sin(phase * 0.56 + i * 0.15) * emitterRadius * 0.4,
          Math.sin(phase * 1.04 + i * 0.1) * emitterRadius * lane,
        );
      }
      if (!active) {
        spotIntensitySmoothed[i] = 0;
        spotLights[i].intensity = 0;
        continue;
      }
      const t = elapsed * (0.03 + midSmoothed * 0.06) + i * 0.11;
      paletteSample(t, tempColor);
      tempColor.lerp(whiteColor, highSmoothed * 0.18);
      spotLights[i].color.copy(tempColor);
      const targetIntensity =
        i === pulseSpotIndex
          ? pulseTarget
          : Math.max(state.audioActive ? 0.6 : 0, sweepTarget * spotBaseIntensity[i]);
      spotLights[i].angle = i === pulseSpotIndex ? baseAngle : sweepAngle;
      spotLights[i].penumbra = i === pulseSpotIndex ? pulsePenumbra : sweepPenumbra;
      spotIntensitySmoothed[i] = smooth(
        spotIntensitySmoothed[i],
        targetIntensity,
        deltaTime,
        INTENSITY_SMOOTHING,
      );
      spotLights[i].intensity = spotIntensitySmoothed[i];
    }
  };
  const updateWallSpots = () => {
    const subtle = 0.14 + avgSmoothed * (state.flowProfile === 'STRONG' ? 0.14 : 0.08);
    for (let i = 0; i < WALL_SPOT_COUNT; i += 1) {
      const angle =
        wallSpotAngles[i] +
        elapsed * wallSpotSpeeds[i] * Math.max(0.5, state.flowSpeed) * (1 + midSmoothed * 0.5);
      const yBase = wallSpotHeights[i] * roomState.radius;
      const y = yBase + Math.sin(elapsed * 0.32 + i * 0.7) * roomState.radius * 0.02;
      const radial = Math.sqrt(Math.max(0, roomState.radius * roomState.radius - y * y)) * 0.985;
      const spot = wallSpots[i];
      spot.position.set(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
      spot.lookAt(0, 0, 0);
      spot.material.opacity = state.flowEnabled ? subtle : subtle * 0.7;
    }
  };
  const update = (deltaTime) => {
    elapsed += deltaTime;
    const audioReady = Boolean(audioAnalyser && frequencyData);
    const audioActive = audioReady && (typeof _isPlaying === 'function' ? _isPlaying() : true);
    state.audioActive = audioActive;
    if (state.flowEnabled && audioActive) {
      audioAnalyser.getFrequencyData(frequencyData);
      const bass = sampleBandEnergy(frequencyData, 0, 8);
      const mid = sampleBandEnergy(frequencyData, 8, 24);
      const treble = sampleBandEnergy(frequencyData, 24, 64);
      const avgEnergy = bass * 0.6 + mid * 0.3 + treble * 0.1;
      bassSmoothed = smooth(bassSmoothed, bass, deltaTime, 7.0);
      midSmoothed = smooth(midSmoothed, mid, deltaTime, 7.0);
      highSmoothed = smooth(highSmoothed, treble, deltaTime, 7.0);
      avgSmoothed = smooth(avgSmoothed, avgEnergy, deltaTime, 7.0);
    } else {
      bassSmoothed = smooth(bassSmoothed, 0, deltaTime);
      midSmoothed = smooth(midSmoothed, 0, deltaTime);
      highSmoothed = smooth(highSmoothed, 0, deltaTime);
      avgSmoothed = smooth(avgSmoothed, 0, deltaTime);
    }
    reactiveState.flowEnabled = state.flowEnabled;
    reactiveState.bass = bassSmoothed;
    reactiveState.mid = midSmoothed;
    reactiveState.high = highSmoothed;
    reactiveState.avg = avgSmoothed;
    reactiveState.flowProfile = state.flowProfile;
    if (state.flowEnabled) {
      updateWallSpots();
      applyLightingDim(getFlowDimFactor());
      updateSpotTargets(deltaTime);
    }
    if (roomShell) {
      roomShell.rotation.y += deltaTime * 0.008;
    }
    return reactiveState;
  };
  const setEnvironment = ({ room, fog, roomEnabled, fogEnabled } = {}) => {
    if (room && typeof room.color === 'number') {
      roomMaterial.color.setHex(room.color);
    }
    if (room && typeof room.emissiveIntensity === 'number') {
      roomEmissiveBase = room.emissiveIntensity * GLOBAL_ROOM_BRIGHTNESS;
      roomMaterial.emissiveIntensity =
        state.flowProfile === 'STRONG' ? Math.min(roomEmissiveBase, 0.3) : roomEmissiveBase;
    }
    if (room && Object.prototype.hasOwnProperty.call(room, 'backgroundColor')) {
      scene.background =
        room.backgroundColor === null ? null : new THREE.Color(room.backgroundColor);
    }
    if (fog && typeof fog.color === 'number') {
      state.fogColor = fog.color;
    }
    if (fog && typeof fog.mode === 'string') {
      state.fogMode = fog.mode === 'exp2' ? 'exp2' : 'linear';
    }
    if (fog && typeof fog.density === 'number') {
      state.fogDensity = fog.density;
    }
    if (fog && typeof fog.near === 'number') {
      state.fogNear = fog.near;
    }
    if (fog && typeof fog.far === 'number') {
      state.fogFar = fog.far;
    }
    state.roomEnabled = roomEnabled ?? state.roomEnabled;
    state.fogEnabled = fogEnabled ?? state.fogEnabled;
    rig.visible = state.roomEnabled || state.flowEnabled;
    wallSpots.forEach((spot) => {
      spot.visible = state.roomEnabled && state.flowEnabled;
    });
    syncFog();
  };
  const setGridLayout = (layout) => {
    updateRoom(layout);
    if (typeof layout?.gridCount === 'number') {
      state.gridCount = layout.gridCount;
      applySpotBudget();
    }
  };
  const setEnabled = (enabled) => {
    state.flowEnabled = enabled;
    applySpotBudget();
    spotLights.forEach((spot) => {
      if (!enabled) spot.intensity = 0;
    });
    if (!enabled) {
      for (let i = 0; i < SPOT_COUNT; i += 1) {
        spotIntensitySmoothed[i] = 0;
      }
    }
    if (enabled) {
      applyLightingDim(getFlowDimFactor());
    } else {
      applyLightingDim(1);
    }
    syncFog();
  };
  const setQuality = (level) => {
    state.qualityLevel = level || 'HIGH';
    applySpotBudget();
  };
  const setProfile = (profile) => {
    state.flowProfile = profile === 'STRONG' ? 'STRONG' : 'SOFT';
    roomMaterial.emissiveIntensity =
      state.flowProfile === 'STRONG' ? Math.min(roomEmissiveBase, 0.3) : roomEmissiveBase;
    applySpotBudget();
  };
  const setOptions = (options = {}) => {
    if (typeof options.dotIntensity === 'number') {
      state.dotIntensity = options.dotIntensity;
    }
    if (typeof options.flowSpeed === 'number') {
      state.flowSpeed = options.flowSpeed;
    }
    if (typeof options.pulseIntensity === 'number') {
      state.pulseIntensity = options.pulseIntensity;
    }
    if (typeof options.flowAngle === 'number') {
      state.flowAngle = options.flowAngle;
    }
    if (typeof options.dotSize === 'number') {
      state.dotSize = options.dotSize;
    }
    const angle = THREE.MathUtils.clamp(
      (state.flowAngle || BASE_SPOT_ANGLE) * state.dotSize,
      Math.PI / 14,
      Math.PI / 10,
    );
    for (let i = 0; i < SPOT_COUNT; i += 1) {
      spotLights[i].angle = angle;
      spotLights[i].penumbra = THREE.MathUtils.clamp(0.4 + state.dotSize * 0.1, 0.4, 0.6);
    }
  };
  const setBaseLightIntensities = ({
    keyIntensity,
    rimIntensity,
    fillIntensity,
    centerIntensity,
  } = {}) => {
    if (lights?.keyLight && typeof keyIntensity === 'number') {
      lights.keyLight.intensity = keyIntensity;
    }
    if (lights?.rimLight && typeof rimIntensity === 'number') {
      lights.rimLight.intensity = rimIntensity;
    }
    if (lights?.fillLight && typeof fillIntensity === 'number') {
      lights.fillLight.intensity = fillIntensity;
    }
    if (lights?.centerLight && typeof centerIntensity === 'number') {
      lights.centerLight.intensity = centerIntensity;
    }
    baseLights.forEach((light, index) => {
      baseIntensities[index] = light.intensity;
    });
  };

  return {
    setEnabled,
    setOptions,
    setGridLayout,
    setProfile,
    setEnvironment,
    setBaseLightIntensities,
    setQuality,
    update,
    dispose() {
      window.removeEventListener('pointermove', pointerHandler);
      window.removeEventListener('pointerleave', pointerLeaveHandler);
      scene.remove(rig);
      scene.fog = originalFog;
      goboTexture.dispose();
      roomGradientTexture.dispose();
      wallSpotTexture.dispose();
      wallSpotGeometry.dispose();
      wallSpots.forEach((spot) => {
        spot.material.dispose();
      });
      roomMaterial.dispose();
    },
  };
}
