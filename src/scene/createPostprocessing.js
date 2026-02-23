import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const VignetteGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignetteStrength: { value: 0.18 },
    grainAmount: { value: 0.012 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float vignetteStrength;
    uniform float grainAmount;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    void main() {
      vec4 baseColor = texture2D(tDiffuse, vUv);
      vec2 centered = vUv - vec2(0.5);
      float dist = dot(centered, centered);
      float vignette = 1.0 - dist * vignetteStrength * 2.0;
      float grain = (hash(vUv * vec2(1280.0, 720.0) + time * 0.37) - 0.5) * grainAmount;
      vec3 finalColor = max(baseColor.rgb * max(vignette, 0.0) + grain, vec3(0.0));
      gl_FragColor = vec4(finalColor, baseColor.a);
    }
  `,
};

export function createPostprocessing({ renderer, scene, camera, width, height } = {}) {
  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.22, 0.35, 0.85);
  composer.addPass(bloomPass);

  const vignetteGrainPass = new ShaderPass(VignetteGrainShader);
  composer.addPass(vignetteGrainPass);

  let bloomQualityScale = 1;
  const setQuality = (level) => {
    if (level === 'LOW') {
      bloomQualityScale = 0.65;
    } else if (level === 'MEDIUM') {
      bloomQualityScale = 0.8;
    } else {
      bloomQualityScale = 1;
    }
  };

  return {
    setSize(nextWidth, nextHeight) {
      composer.setSize(nextWidth, nextHeight);
    },
    setQuality,
    update(time, reactive = null) {
      vignetteGrainPass.uniforms.time.value = time;
      const flowActive = Boolean(reactive?.flowEnabled);
      const flowProfile = reactive?.flowProfile;
      const strongBloomScale = flowProfile === 'STRONG' ? 0.85 : 1;
      const bloomThreshold = flowProfile === 'STRONG' ? 0.38 : 0.28;
      const bass = flowActive ? (reactive.bass ?? 0) : 0;
      const high = flowActive ? (reactive.high ?? 0) : 0;
      const baseStrength = 0.22 * bloomQualityScale * strongBloomScale;
      const maxStrength = 1.8 * bloomQualityScale * strongBloomScale;
      const baseRadius = 0.2 * bloomQualityScale;
      const maxRadius = 0.55 * bloomQualityScale;
      bloomPass.strength = THREE.MathUtils.clamp(
        baseStrength + bass * 1.2 * bloomQualityScale * strongBloomScale,
        baseStrength,
        maxStrength,
      );
      bloomPass.radius = THREE.MathUtils.clamp(
        baseRadius + high * 0.3 * bloomQualityScale,
        baseRadius,
        maxRadius,
      );
      bloomPass.threshold = bloomThreshold;
    },
    render() {
      composer.render();
    },
  };
}
