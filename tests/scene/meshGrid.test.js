import { describe, expect, it } from 'vitest';
import { createGridPositions } from '../../src/scene/helpers/meshGrid.js';

describe('createGridPositions', () => {
  it('creates the expected 8 corner positions', () => {
    const spacing = 0.8;
    const positions = createGridPositions(spacing);

    expect(positions).toHaveLength(8);
    expect(positions).toContainEqual([spacing, spacing, spacing]);
    expect(positions).toContainEqual([-spacing, -spacing, -spacing]);
  });
});
