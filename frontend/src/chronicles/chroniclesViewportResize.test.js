import { describe, it, expect } from 'vitest';
import {
  chroniclesThreeViewport,
  chroniclesThreeViewportChanged,
} from './chroniclesViewportResize.js';

describe('Chronicles idle WebGL viewport gate', () => {
  it('paints the initial frame but ignores redundant ResizeObserver notifications', () => {
    const viewport = chroniclesThreeViewport(1024, 576, 1.5);
    expect(chroniclesThreeViewportChanged(null, viewport)).toBe(true);
    expect(chroniclesThreeViewportChanged(viewport, chroniclesThreeViewport(1024, 576, 1.5))).toBe(false);
  });

  it('redraws for actual CSS layout size changes', () => {
    const baseline = chroniclesThreeViewport(1024, 576, 1.5);
    expect(chroniclesThreeViewportChanged(baseline, chroniclesThreeViewport(1025, 576, 1.5))).toBe(true);
    expect(chroniclesThreeViewportChanged(baseline, chroniclesThreeViewport(1024, 580, 1.5))).toBe(true);
  });

  it('redraws on an effective device pixel ratio change with unchanged CSS size', () => {
    const baseline = chroniclesThreeViewport(1024, 576, 1);
    const zoomed = chroniclesThreeViewport(1024, 576, 1.5);
    expect(chroniclesThreeViewportChanged(baseline, zoomed)).toBe(true);
    expect(chroniclesThreeViewportChanged(zoomed, chroniclesThreeViewport(1024, 576, 2))).toBe(true);
  });

  it('ignores further physical DPI increases beyond the existing quality cap', () => {
    const capped = chroniclesThreeViewport(1024, 576, 2.5);
    expect(capped.pixelRatio).toBe(1.65);
    expect(chroniclesThreeViewportChanged(capped, chroniclesThreeViewport(1024, 576, 3))).toBe(false);
    const coarse = chroniclesThreeViewport(390, 720, 2.5, true);
    expect(coarse.pixelRatio).toBe(1.2);
    expect(chroniclesThreeViewportChanged(coarse, chroniclesThreeViewport(390, 720, 3, true))).toBe(false);
  });

  it('keeps at least one renderable pixel for hidden or malformed host bounds', () => {
    const viewport = chroniclesThreeViewport(0, -3, Number.NaN);
    expect(viewport).toEqual({ width: 1, height: 1, pixelRatio: 1 });
    expect(chroniclesThreeViewport(390, 720, 0, true).pixelRatio).toBe(1);
  });
});
