import { describe, expect, it } from 'vitest';
import { chroniclesMinimapRadiusX } from './ChroniclesMinimap.jsx';

describe('Chronicles minimap width', () => {
  it('fills a wide frame with more columns and keeps square frames square', () => {
    expect(chroniclesMinimapRadiusX(3, 1)).toBe(3);
    expect(chroniclesMinimapRadiusX(3, 0.8)).toBe(3);
    // 7 rows in a 2.4:1 frame → 17 columns (radius 8).
    expect(chroniclesMinimapRadiusX(3, 2.4)).toBe(8);
    expect(chroniclesMinimapRadiusX(3, Number.NaN)).toBe(3);
  });
});
