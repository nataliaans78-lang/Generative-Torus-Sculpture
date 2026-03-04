import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { colorFromHsl } from '../../src/utils/colors.js';

describe('colorFromHsl', () => {
  it('creates a THREE.Color with expected HSL values', () => {
    const color = colorFromHsl(0.5, 1, 0.5);
    const hsl = new THREE.Color();
    color.getHSL(hsl);

    expect(hsl.h).toBeCloseTo(0.5, 5);
    expect(hsl.s).toBeCloseTo(1, 5);
    expect(hsl.l).toBeCloseTo(0.5, 5);
  });
});
