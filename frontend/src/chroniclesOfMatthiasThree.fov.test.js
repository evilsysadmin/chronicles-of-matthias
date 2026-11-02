import { describe, expect, it } from 'vitest';
import { chroniclesFirstPersonFov } from './chroniclesOfMatthiasThree.js';

const hfov = (vfov, aspect) => 2 * Math.atan(Math.tan((vfov * Math.PI) / 360) * aspect) * (180 / Math.PI);

describe('Chronicles first-person field of view', () => {
  it('keeps the original lens for dungeons, wide town views and desktop', () => {
    for (const aspect of [390 / 844, 1, 4 / 3, 1.6]) {
      expect(chroniclesFirstPersonFov(aspect)).toBe(67);
    }
    for (const aspect of [0.78, 1, 4 / 3, 1.6]) {
      expect(chroniclesFirstPersonFov(aspect, { settlement: true })).toBe(67);
    }
  });

  it('reveals more of shop facades only in portrait settlements, with a smooth lens transition', () => {
    for (const aspect of [360 / 800, 390 / 844, 430 / 932]) {
      const vfov = chroniclesFirstPersonFov(aspect, { settlement: true });
      expect(vfov).toBe(79);
      expect(hfov(vfov, aspect)).toBeGreaterThan(hfov(67, aspect) + 6);
      expect(hfov(vfov, aspect)).toBeLessThan(45);
      expect(chroniclesFirstPersonFov(aspect)).toBe(67);
    }
    const midway = chroniclesFirstPersonFov(0.64, { settlement: true });
    expect(midway).toBeGreaterThan(67);
    expect(midway).toBeLessThan(79);
  });

  it('caps the horizontal FOV on wide desktop canvases instead of a fisheye', () => {
    for (const aspect of [16 / 9, 2.2, 2.5, 3]) {
      const vfov = chroniclesFirstPersonFov(aspect);
      expect(vfov).toBeLessThanOrEqual(67);
      expect(hfov(vfov, aspect)).toBeLessThanOrEqual(96.0001);
    }
    // The reported 1600×640 game canvas: ~117° before, 96° now.
    expect(hfov(67, 2.5)).toBeGreaterThan(115);
    expect(hfov(chroniclesFirstPersonFov(2.5), 2.5)).toBeCloseTo(96, 3);
  });

  it('falls back safely on a degenerate aspect', () => {
    expect(chroniclesFirstPersonFov(0)).toBe(67);
    expect(chroniclesFirstPersonFov(Number.NaN)).toBe(67);
  });
});
