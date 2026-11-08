import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesOpeningVolleyShots,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesAdvanceExplorationEnemies, chroniclesGridExplorationStep } from './chroniclesGridExplorationStep.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesAdvanceOpeningVolley } from './chroniclesPrecontactVolley.js';

const GOBLIN_ID = 'sewers-goblin-west';

function armedCorridor() {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const goblin = chroniclesActiveEnemies(base).find((enemy) => enemy.id === GOBLIN_ID);
  expect(goblin).toBeTruthy();
  return {
    goblin,
    state: {
      ...base,
      ...Object.fromEntries(chroniclesActiveEnemies(base)
        .filter((enemy) => enemy.id !== GOBLIN_ID)
        .map((enemy) => [enemy.hpKey, 0])),
      [goblin.hpKey]: 100, // Keep the target alive through the opening volley.
      x: 1, y: 1, direction: 2,
      enemyPositions: { [GOBLIN_ID]: { x: 1, y: 4 } },
      equipment: { matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' } },
    },
  };
}

describe('MM3 opening volley spends exactly one exploration action before combat', () => {
  it('does not start phantom initiative when the reducer did not spend a turn', () => {
    const { goblin, state } = armedCorridor();
    expect(chroniclesOpeningVolleyShots(state).target?.id).toBe(goblin.id);
    expect(chroniclesAdvanceOpeningVolley(state, state)).toBe(state);
    const refused = { ...state, message: 'Acción rechazada' };
    expect(chroniclesAdvanceOpeningVolley(state, refused)).toBe(refused);
    expect(refused.initiative).toBeFalsy();
    expect(refused[goblin.hpKey]).toBe(100);
  });

  it('spends one volley and lets melee approach during exploration without free attacks', () => {
    const { goblin, state } = armedCorridor();
    const opening = chroniclesOpeningVolleyShots(state);
    expect(opening.target?.id).toBe(goblin.id);
    expect(opening.shots).toHaveLength(1);

    const fired = chroniclesReduce(state, 'volley');
    expect(fired.turns).toBe(state.turns + 1);
    expect(fired[goblin.hpKey]).toBe(opening.remainingHp);
    const volley = chroniclesAdvanceOpeningVolley(state, fired);
    expect(volley.initiative).toBeFalsy();
    expect(volley.turns).toBe(fired.turns);
    expect(volley.party.map((hero) => hero.hp)).toEqual(state.party.map((hero) => hero.hp));
    expect(chroniclesRuntimeEnemyPosition(volley, goblin)).toEqual({ x: 1, y: 4 });

    const first = chroniclesAdvanceExplorationEnemies(state, volley);
    expect(chroniclesRuntimeEnemyPosition(first, goblin)).toEqual({ x: 1, y: 3 });
    expect(first.enemyTurnEvents).toEqual([]);
    expect(chroniclesStartInitiativeCombat(first, [goblin], { random: () => 0 })).toBe(first);
    const second = chroniclesGridExplorationStep(first, 'turn-right');
    expect(chroniclesRuntimeEnemyPosition(second, goblin)).toEqual({ x: 1, y: 2 });
    expect(second.party.map((hero) => hero.hp)).toEqual(state.party.map((hero) => hero.hp));
    const contact = chroniclesStartInitiativeCombat(second, [goblin], { random: () => 0 });
    expect(contact.phase).toBe('combat');
    expect(contact.initiative?.order.some(({ id }) => id === goblin.id)).toBe(true);
  });
});
