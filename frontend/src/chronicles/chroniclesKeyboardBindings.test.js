import { describe, expect, it } from 'vitest';
import { CHRONICLES_DIRECTION_KEYS, chroniclesCombatKeyMode } from './chroniclesKeyboardBindings.js';

describe('Chronicles MM3 · keyboard movement and attack contract', () => {
  it('only four direction arrows move/turn the party', () => {
    expect(CHRONICLES_DIRECTION_KEYS).toEqual({
      ArrowUp: 'forward',
      ArrowDown: 'backward',
      ArrowLeft: 'turn-left',
      ArrowRight: 'turn-right',
    });
    expect(Object.keys(CHRONICLES_DIRECTION_KEYS)).toHaveLength(4);
    expect(CHRONICLES_DIRECTION_KEYS.a).toBeUndefined();
    expect(CHRONICLES_DIRECTION_KEYS.s).toBeUndefined();
  });
  it('A attacks in melee, S shoots, and Space retains optional auto attack', () => {
    for (const key of ['a', 'A']) expect(chroniclesCombatKeyMode(key)).toBe('melee');
    for (const key of ['s', 'S']) expect(chroniclesCombatKeyMode(key)).toBe('missile');
    expect(chroniclesCombatKeyMode(' ')).toBe('auto');
    for (const key of ['w', 'W', 'd', 'D', 'q', 'Q', 'e', 'E', ...Object.keys(CHRONICLES_DIRECTION_KEYS)]) {
      expect(chroniclesCombatKeyMode(key)).toBeNull();
    }
  });
});
