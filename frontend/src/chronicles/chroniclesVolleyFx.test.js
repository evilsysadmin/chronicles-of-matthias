import { describe, expect, it } from 'vitest';
import { chroniclesVolleyFlightPositions } from '../chroniclesOfMatthiasThree.js';

describe('Chronicles · physical MM3 volley feedback', () => {
  it('emits exactly one projectile per shooter and keeps the formation centered', () => {
    expect(chroniclesVolleyFlightPositions(0, 0)).toEqual([]);
    const start = chroniclesVolleyFlightPositions(4, 0);
    expect(start).toHaveLength(4);
    expect(start.map((shot) => shot.x + start[3 - start.indexOf(shot)].x).every((sum) => Math.abs(sum) < 1e-9)).toBe(true);
    expect(start.every((shot) => shot.z === -0.72)).toBe(true);
  });

  it('moves projectiles forward and converges them without side effects', () => {
    const start = chroniclesVolleyFlightPositions(3, 0);
    const end = chroniclesVolleyFlightPositions(3, 1);
    expect(end).toHaveLength(start.length);
    expect(end.every((shot, index) => shot.z < start[index].z)).toBe(true);
    expect(Math.abs(end[0].x)).toBeLessThan(Math.abs(start[0].x));
    expect(chroniclesVolleyFlightPositions(3, -1)).toEqual(start);
    expect(chroniclesVolleyFlightPositions(3, 2)).toEqual(end);
    expect(chroniclesVolleyFlightPositions(999, 0)).toHaveLength(6);
  });
});
