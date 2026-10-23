import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesReduce } from '../chroniclesOfMatthias.js';
import { CHRONICLES_DIRECTION_KEYS } from './chroniclesKeyboardBindings.js';

describe('MM3 Q/E strafe bindings use real movement and collision', () => {
  const start = () => ({
    ...createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
    x: 9, y: 7, direction: 0,
  });
  it('moves left/right without rotating and consumes a turn', () => {
    const initial = start();
    for (const [key, x] of [['q', 8], ['Q', 8], ['e', 10], ['E', 10]]) {
      const next = chroniclesReduce(initial, CHRONICLES_DIRECTION_KEYS[key]);
      expect([next.x, next.y, next.direction]).toEqual([x, 7, 0]);
      expect(next.turns).toBe(initial.turns + 1);
    }
  });
  it('moves relative to the camera in all four directions', () => {
    const positions = [
      [0, [8, 7], [10, 7]],
      [1, [9, 6], [9, 8]],
      [2, [10, 7], [8, 7]],
      [3, [9, 8], [9, 6]],
    ];
    for (const [direction, left, right] of positions) {
      const initial = { ...start(), direction };
      for (const [key, expected] of [['q', left], ['e', right]]) {
        const next = chroniclesReduce(initial, CHRONICLES_DIRECTION_KEYS[key]);
        expect([next.x, next.y, next.direction]).toEqual([...expected, direction]);
      }
    }
  });
  it('does not cross a blocked cell or rotate the player', () => {
    const initial = { ...start(), x: 4, y: 7 };
    const next = chroniclesReduce(initial, CHRONICLES_DIRECTION_KEYS.q);
    expect([next.x, next.y, next.direction]).toEqual([4, 7, 0]);
    expect(next.message).not.toBe(initial.message);
  });
});
