import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackTarget, chroniclesEnemyThreatCells } from '../chroniclesOfMatthiasTurns.js';

const GOBLIN = 'sewers-goblin-west';

function corridorEnemy(attackReach) {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const enemy = chroniclesActiveEnemies(base).find((entry) => entry.id === GOBLIN);
  expect(enemy).toBeTruthy();
  return {
    state: {
      ...base,
      x: 1, y: 1,
      enemyPositions: { [GOBLIN]: { x: 1, y: 4 } },
    },
    enemy: { ...enemy, ai: { ...enemy.ai, attackReach } },
  };
}

describe('MM3 enemy attack reach and threat previews', () => {
  it.each([Infinity, -Infinity, NaN, 1_000_000, 2.5])(
    'treats invalid reach %s as adjacent-only, without an unbounded threat scan',
    (reach) => {
      const { state, enemy } = corridorEnemy(reach);
      expect(chroniclesEnemyAttackTarget(state, enemy)).toBeNull();
      const threatened = chroniclesEnemyThreatCells(state, enemy);
      expect(threatened.length).toBeLessThanOrEqual(4);
      expect(threatened.every(({ x, y }) => Math.abs(x - 1) + Math.abs(y - 4) === 1)).toBe(true);
    },
  );

  it('preserves authored two-cell ranged reach for both attacks and previews', () => {
    const { state, enemy } = corridorEnemy(2);
    const close = { ...state, enemyPositions: { [GOBLIN]: { x: 1, y: 3 } } };
    expect(chroniclesEnemyAttackTarget(close, enemy)).toBeTruthy();
    expect(chroniclesEnemyThreatCells(close, enemy)).toContainEqual({ x: 1, y: 1 });
  });
});
