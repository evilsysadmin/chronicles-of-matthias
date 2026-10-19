import { describe, expect, it } from 'vitest';
import { CHRONICLES_VOLLEY_MAX_DURATION, chroniclesVolleyFlightSample } from './chroniclesVolleyMotion.js';

describe('Chronicles · polished projectile flight', () => {
  it('staggers shots without inventing extra projectiles or depending on frames', () => {
    expect(chroniclesVolleyFlightSample(3, 0, 0, 'bow')).not.toBeNull();
    expect(chroniclesVolleyFlightSample(3, 1, 0, 'bow')).toBeNull();
    expect(chroniclesVolleyFlightSample(3, 1, 0.034, 'bow')).not.toBeNull();
    expect(chroniclesVolleyFlightSample(0, 0, 0)).toBeNull();
    expect(chroniclesVolleyFlightSample(1, 1, 0)).toBeNull();
    expect(chroniclesVolleyFlightSample(1, -1, 0)).toBeNull();
    expect(chroniclesVolleyFlightSample(6, 5, CHRONICLES_VOLLEY_MAX_DURATION)).toBeNull();
  });
  it('converges toward the target, with a gentler stone arc and distinct timings', () => {
    const bowStart = chroniclesVolleyFlightSample(3, 0, 0, 'bow');
    const bowMid = chroniclesVolleyFlightSample(3, 0, 0.21, 'bow');
    const bowEnd = chroniclesVolleyFlightSample(3, 0, 0.49, 'bow');
    expect(bowStart.z).toBe(-0.72);
    expect(bowMid.z).toBeLessThan(bowStart.z);
    expect(bowEnd.z).toBeLessThan(bowMid.z);
    expect(Math.abs(bowEnd.x)).toBeLessThan(Math.abs(bowStart.x));
    expect(bowEnd.scale).toBeLessThan(bowStart.scale);
    const stoneMid = chroniclesVolleyFlightSample(3, 0, 0.21, 'sling');
    expect(stoneMid.y).toBeGreaterThan(bowMid.y);
    expect(chroniclesVolleyFlightSample(1, 0, 0.50, 'crossbow')).toBeNull();
    expect(chroniclesVolleyFlightSample(1, 0, 0.50, 'sling')).not.toBeNull();
  });
  it('keeps mirror symmetry on left/right start positions and resets on replay', () => {
    const left = chroniclesVolleyFlightSample(4, 0, 0, 'bow');
    const right = chroniclesVolleyFlightSample(4, 3, 3 * 0.034, 'bow');
    expect(left.x + right.x).toBeCloseTo(0);
    expect(chroniclesVolleyFlightSample(3, 0, 0.16, 'bow'))
      .toEqual(chroniclesVolleyFlightSample(3, 0, 0.16, 'bow'));
    expect(chroniclesVolleyFlightSample(1, 0, Number.NaN)).toBeNull();
  });
});
