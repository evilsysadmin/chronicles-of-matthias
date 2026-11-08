import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies, chroniclesReduce, createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import {
  chroniclesAdvanceExplorationEnemies, chroniclesGridExplorationStep,
} from './chroniclesGridExplorationStep.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesAdvanceOpeningVolley } from './chroniclesPrecontactVolley.js';

const GOBLIN_ID = 'sewers-goblin-west';

function distantGoblin() {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(base);
  const goblin = enemies.find(({ id }) => id === GOBLIN_ID);
  expect(goblin).toBeTruthy();
  const state = {
    ...base,
    ...Object.fromEntries(enemies.filter(({ id }) => id !== GOBLIN_ID)
      .map(({ hpKey }) => [hpKey, 0])),
    [goblin.hpKey]: 100,
    x: 1, y: 1, direction: 2,
    enemyPositions: { [GOBLIN_ID]: { x: 1, y: 4 } },
    equipment: { matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' } },
  };
  return { state, goblin };
}

describe('MM3 · salvo, persecución en exploración y contacto cuerpo a cuerpo', () => {
  it('a ranged volley consumes one action and grants exactly one pursuit step, not initiative', () => {
    const { state, goblin } = distantGoblin();
    const fired = chroniclesReduce(state, 'volley');
    expect(fired.turns).toBe(state.turns + 1);
    const afterVolley = chroniclesAdvanceOpeningVolley(state, fired);
    expect(afterVolley.phase).toBe('explore');
    expect(afterVolley.initiative).toBeFalsy();
    expect(chroniclesRuntimeEnemyPosition(afterVolley, goblin)).toEqual({ x: 1, y: 4 });

    const chased = chroniclesAdvanceExplorationEnemies(state, afterVolley);
    expect(chroniclesRuntimeEnemyPosition(chased, goblin)).toEqual({ x: 1, y: 3 });
    expect(chased.explorationEnemySteps).toBe((state.explorationEnemySteps || 0) + 1);
    expect(chased.turns).toBe(fired.turns);
    expect(chased.party.map(({ hp }) => hp)).toEqual(state.party.map(({ hp }) => hp));
    expect(chroniclesAdvanceExplorationEnemies(chased, chased)).toBe(chased);
  });

  it('leaves the enemy AI inert on a refused, zero-turn salvo', () => {
    const { state, goblin } = distantGoblin();
    const refused = chroniclesAdvanceOpeningVolley(state, state);
    expect(refused).toBe(state);
    expect(chroniclesAdvanceExplorationEnemies(state, refused)).toBe(state);
    expect(chroniclesRuntimeEnemyPosition(refused, goblin)).toEqual({ x: 1, y: 4 });
  });

  it('walks the goblin through real exploration turns; initiative starts only at adjacent melee contact', () => {
    const { state, goblin } = distantGoblin();
    const fired = chroniclesAdvanceOpeningVolley(state, chroniclesReduce(state, 'volley'));
    const first = chroniclesAdvanceExplorationEnemies(state, fired);
    expect(chroniclesRuntimeEnemyPosition(first, goblin)).toEqual({ x: 1, y: 3 });
    expect(chroniclesStartInitiativeCombat(first, [goblin], { random: () => 0 })).toBe(first);

    const second = chroniclesGridExplorationStep(first, 'turn-right');
    expect(chroniclesRuntimeEnemyPosition(second, goblin)).toEqual({ x: 1, y: 2 });
    expect(second.initiative).toBeFalsy();
    const contact = chroniclesStartInitiativeCombat(second, [goblin], { random: () => 0 });
    expect(contact.phase).toBe('combat');
    expect(contact.initiative?.order.some((actor) => actor.id === GOBLIN_ID)).toBe(true);
    expect(contact.turns).toBe(second.turns);
  });
});
