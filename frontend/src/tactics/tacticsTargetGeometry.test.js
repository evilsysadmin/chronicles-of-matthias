import { describe, expect, it } from 'vitest';
import { tacticsAttackDistance, tacticsLineIsClear } from './tacticsTargetGeometry.js';

const origin = { x: 3, y: 3 };
const distance = (x, y, pattern) => tacticsAttackDistance(origin, { x, y }, { attackPattern: pattern });

describe('portable Tactics targeting geometry', () => {
  it('keeps exact class pattern geometries and distances', () => {
    expect(distance(4, 3, 'adjacent')).toBe(1);
    expect(distance(4, 4, 'adjacent')).toBeNull();
    expect(distance(5, 3, 'adjacent')).toBeNull();
    expect(distance(3, 5, 'orthogonal')).toBe(2);
    expect(distance(4, 4, 'orthogonal')).toBeNull();
    expect(distance(3, 3, 'orthogonal')).toBe(0);
    expect(distance(5, 5, 'diagonal')).toBe(2);
    expect(distance(3, 3, 'diagonal')).toBeNull();
    expect(distance(6, 5, 'diagonal')).toBeNull();
    expect(distance(3, 6, 'line')).toBe(3);
    expect(distance(5, 5, 'line')).toBe(2);
    expect(distance(6, 5, 'line')).toBeNull();
    expect(distance(4, 3, 'unknown')).toBeNull();
  });

  it('rejects blockers on intermediate cells, not the target cell', () => {
    const target = { x: 3, y: 6 };
    const clear = { tileAt: () => '.', positionedEnemies: [] };
    expect(tacticsLineIsClear(origin, target, clear)).toBe(true);
    const wall = { ...clear, tileAt: (x, y) => (x === 3 && y === 5 ? '#' : '.') };
    expect(tacticsLineIsClear(origin, target, wall)).toBe(false);
    expect(tacticsLineIsClear(origin, target, {
      ...clear, positionedEnemies: [{ enemy: { id: 'blocker' }, position: { x: 3, y: 4 } }],
    })).toBe(false);
    expect(tacticsLineIsClear(origin, target, {
      ...clear, positionedEnemies: [{ enemy: { id: 'target' }, position: target }],
    })).toBe(true);
  });

  it('retains the ignored-enemy contract and diagonal/invalid line of sight', () => {
    const target = { x: 5, y: 5 };
    const blocker = { enemy: { id: 'ghost' }, position: { x: 4, y: 4 } };
    const args = { tileAt: () => '.', positionedEnemies: [blocker] };
    expect(tacticsLineIsClear(origin, target, args)).toBe(false);
    expect(tacticsLineIsClear(origin, target, { ...args, ignoredEnemyId: 'ghost' })).toBe(true);
    expect(tacticsLineIsClear(origin, { x: 5, y: 4 }, args)).toBe(false);
  });
});
