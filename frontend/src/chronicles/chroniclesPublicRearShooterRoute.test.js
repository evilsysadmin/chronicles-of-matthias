import { describe, expect, it } from 'vitest';
import swordhaven from './maps/swordhaven-first-book.json';
import {
  chroniclesActiveEnemies, chroniclesReduce, createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackTarget } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import {
  REAR_SHOOTER_MAP_ID, REAR_SHOOTER_ENEMY_ID, REAR_SHOOTER_START,
  REAR_SHOOTER_VANTAGE, REAR_SHOOTER_ROUTE,
} from '../../smoke/public-rear-shooter-route.mjs';

const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

describe('public Swordhaven rear ranged threat route', () => {
  it('walks only actual open tiles from the canonical party spawn', () => {
    expect(swordhaven.id).toBe(REAR_SHOOTER_MAP_ID);
    expect(swordhaven.partyStart).toEqual(REAR_SHOOTER_START);
    let { x, y, direction } = REAR_SHOOTER_START;
    for (const step of REAR_SHOOTER_ROUTE) {
      if (step.action === 'ArrowLeft') direction = (direction + 3) % 4;
      else if (step.action === 'ArrowRight') direction = (direction + 1) % 4;
      else if (step.action === 'ArrowUp') {
        x += DIRECTIONS[direction][0];
        y += DIRECTIONS[direction][1];
      } else if (step.action === 'e') {
        x += DIRECTIONS[(direction + 1) % 4][0];
        y += DIRECTIONS[(direction + 1) % 4][1];
      } else throw new Error('Unknown public movement command: ' + step.action);
      expect([x, y, direction], step.action).toEqual([step.x, step.y, step.direction]);
      expect(swordhaven.grid[y]?.[x], step.action + ' at ' + x + ',' + y).toBe('.');
    }
    expect({ x, y, direction }).toEqual(REAR_SHOOTER_VANTAGE);
    expect(swordhaven.grid[y + 1]?.[x]).toBe('.'); // real backward tile
  });

  it('faces away from the real stationary ranged attacker, not an invented enemy', () => {
    const initial = createChroniclesState(REAR_SHOOTER_MAP_ID, null, { rules: 'mm3' });
    const enemy = chroniclesActiveEnemies(initial).find(e => e.id === REAR_SHOOTER_ENEMY_ID);
    expect(enemy?.ai).toMatchObject({ movement: 'hold', attackReach: 3, requiresLineOfSight: true });
    expect([enemy.x, enemy.y]).toEqual([15, 15]);
    const positioned = { ...initial, ...REAR_SHOOTER_VANTAGE };
    expect(positioned.direction).toBe(0);
    expect(enemy.y - positioned.y).toBe(2); // genuinely behind
    expect(chroniclesEnemyAttackTarget(positioned, enemy)).toBeTruthy();
    // Normal ranged shots do NOT open initiative; turning outside combat is legal.
    expect(chroniclesStartInitiativeCombat(positioned, [enemy], { random: () => 0 }))
      .toBe(positioned);
    const approached = chroniclesReduce(positioned, 'backward');
    expect([approached.x, approached.y, approached.direction])
      .toEqual([15, 14, 0]);
    expect(approached.turns).toBe(positioned.turns + 1);
    expect(approached.initiative).toBeFalsy();
  });
});
