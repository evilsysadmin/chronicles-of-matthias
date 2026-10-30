import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesTileAt, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackReach, chroniclesEnemyAttackTarget, chroniclesEnemyThreatCells } from '../chroniclesOfMatthiasTurns.js';

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

  it.each([
    ['numeric array', [3]],
    ['string array', ['3']],
    ['object', { reach: 3 }],
    ['boolean', true],
  ])('rejects malformed %s attack reach without fabricating distant attacks', (_kind, attackReach) => {
    const { state, enemy } = corridorEnemy(attackReach);
    expect(chroniclesEnemyAttackReach(enemy)).toBe(1);
    expect(chroniclesEnemyAttackTarget(state, enemy)).toBeNull();
    const threatened = chroniclesEnemyThreatCells(state, enemy);
    expect(threatened.length).toBeLessThanOrEqual(4);
    expect(threatened.every(({ x, y }) => Math.abs(x - 1) + Math.abs(y - 4) === 1)).toBe(true);
  });

  it('rejects a structured legacy retaliationReach while preserving numeric-string reach', () => {
    const { state, enemy } = corridorEnemy(null);
    const { attackReach: _unused, ...ai } = enemy.ai;
    const malformed = { ...enemy, ai, retaliationReach: [3] };
    expect(chroniclesEnemyAttackReach(malformed)).toBe(1);
    expect(chroniclesEnemyAttackTarget(state, malformed)).toBeNull();

    const valid = { ...malformed, retaliationReach: '3' };
    expect(chroniclesEnemyAttackReach(valid)).toBe(3);
    expect(chroniclesEnemyAttackTarget(state, valid)).toBeTruthy();
  });

  it('preserves authored two-cell ranged reach for both attacks and previews', () => {
    const { state, enemy } = corridorEnemy(2);
    const close = { ...state, enemyPositions: { [GOBLIN]: { x: 1, y: 3 } } };
    expect(chroniclesEnemyAttackTarget(close, enemy)).toBeTruthy();
    expect(chroniclesEnemyThreatCells(close, enemy)).toContainEqual({ x: 1, y: 1 });
  });
});

describe('MM3 first-book ranged pressure on the rear row', () => {
  function archerFight(rules = 'mm3') {
    const base = createChroniclesState('banner-road-first-book', null, { rules });
    const archer = chroniclesActiveEnemies(base).find((enemy) => enemy.id === 'banner-road-east-scout');
    expect(archer).toBeTruthy();
    expect(archer.ai.requiresLineOfSight).toBe(true);
    const adjacent = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => ({ x: archer.x + dx, y: archer.y + dy }))
      .find(({ x, y }) => chroniclesTileAt(x, y, base) === '.');
    expect(adjacent).toBeTruthy();
    return { state: { ...base, ...adjacent }, archer };
  }

  it('lets authored archers threaten living backliners without bypassing line of sight', () => {
    const { state, archer } = archerFight();
    const target = chroniclesEnemyAttackTarget(state, archer);
    expect(target?.row).toBe('back');
    expect(['bishop', 'knight']).toContain(target?.id);
  });

  it('falls back to the living front row after the rear is down', () => {
    const { state, archer } = archerFight();
    const wounded = {
      ...state,
      party: state.party.map((hero) => hero.row === 'back' ? { ...hero, hp: 0 } : hero),
    };
    expect(chroniclesEnemyAttackTarget(wounded, archer)?.row).toBe('front');
  });

  it('keeps melee attackers focused on the front row', () => {
    const { state, archer } = archerFight();
    const melee = { ...archer, ai: { ...archer.ai, attackReach: 1, requiresLineOfSight: false } };
    expect(chroniclesEnemyAttackTarget(state, melee)?.row).toBe('front');
  });

  it('rotates melee targets on real MM3 initiative rounds, not the frozen exploration round', () => {
    const { state, archer } = archerFight();
    const melee = { ...archer, ai: { ...archer.ai, attackReach: 1, requiresLineOfSight: false } };
    const frontOnly = {
      ...state,
      phase: 'combat',
      round: 0,
      party: state.party.map((hero) => hero.row === 'back' ? { ...hero, hp: 0 } : hero),
    };
    const frontIds = frontOnly.party.filter((hero) => hero.hp > 0).map((hero) => hero.id);
    expect(frontIds).toHaveLength(2);
    const first = chroniclesEnemyAttackTarget({ ...frontOnly, initiative: { round: 1 } }, melee);
    const second = chroniclesEnemyAttackTarget({ ...frontOnly, initiative: { round: 2 } }, melee);
    expect([first?.id, second?.id].sort()).toEqual([...frontIds].sort());
    // The exploration turn is unchanged during individual initiative actions.
    expect(frontOnly.round).toBe(0);
  });

  it('preserves Tactics targeting rather than applying the MM3 rear-row preference', () => {
    const { state, archer } = archerFight(null);
    expect(chroniclesEnemyAttackTarget(state, archer)?.row).toBe('front');
  });
});
