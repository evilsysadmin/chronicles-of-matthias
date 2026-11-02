import { describe, expect, it } from 'vitest';
import { chroniclesTownSurfacePixels } from './chroniclesTownSurfacePixels.js';

describe('Swordhaven paving contrast', () => {
  it('softens cobble grout while retaining moss, texture detail and opaque pixels', () => {
    const { size, pixels, normals } = chroniclesTownSurfacePixels('cobble');
    expect(size).toBe(256);
    expect(pixels).toHaveLength(size * size * 4);
    expect(normals).toHaveLength(pixels.length);
    const mortar = new Set(['132,124,112', '112,120,91']);
    let quietJoints = 0;
    let mossJoints = 0;
    let oldDarkJoints = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const color = Array.from(pixels.subarray(offset, offset + 3)).join(',');
      if (mortar.has(color)) quietJoints += 1;
      if (color === '112,120,91') mossJoints += 1;
      if (color === '95,89,80' || color === '76,98,55') oldDarkJoints += 1;
      expect(pixels[offset + 3]).toBe(255);
    }
    expect(quietJoints).toBeGreaterThan(1000);
    expect(mossJoints).toBeGreaterThan(0);
    expect(oldDarkJoints).toBe(0);
    expect(chroniclesTownSurfacePixels('cobble').pixels).toBe(pixels);
  });

  it('does not change the mortar palette for building masonry and brick', () => {
    const masonry = chroniclesTownSurfacePixels('masonry');
    const brick = chroniclesTownSurfacePixels('brick');
    expect(Array.from(masonry.pixels.subarray(0, 3))).toEqual([95, 89, 80]);
    expect(Array.from(brick.pixels.subarray(0, 3))).toEqual([163, 150, 137]);
  });
});
