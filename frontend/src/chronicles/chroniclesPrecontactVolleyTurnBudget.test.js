import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesOpeningVolleyShots,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesResolveEnemyActor, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
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

  it('connects a real salvo to distant pursuit, melee contact and the first enemy attack without free actions', () => {
    const { goblin, state } = armedCorridor();
    const opening = chroniclesOpeningVolleyShots(state);
    expect(opening.target?.id).toBe(goblin.id);
    expect(opening.shots).toHaveLength(1);

    const fired = chroniclesReduce(state, 'volley');
    expect(fired.turns).toBe(state.turns + 1);
    expect(fired[goblin.hpKey]).toBe(opening.remainingHp);
    const engaged = chroniclesAdvanceOpeningVolley(state, fired);
    expect(engaged.initiative?.order.filter((actor) => actor.id === goblin.id)).toHaveLength(1);
    expect(engaged.turns).toBe(fired.turns);
    expect(engaged.enemyTurnEvents || []).toEqual([]);
    expect(engaged.party.map((hero) => hero.hp)).toEqual(state.party.map((hero) => hero.hp));
    expect(chroniclesRuntimeEnemyPosition(engaged, goblin)).toEqual({ x: 1, y: 4 });

    let current = engaged;
    for (const y of [3, 2]) {
      const beforeHp = current.party.map((hero) => hero.hp);
      const next = chroniclesResolveEnemyActor(current, goblin.id);
      expect(next.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
      expect(chroniclesRuntimeEnemyPosition(next, goblin)).toEqual({ x: 1, y });
      expect(next.party.map((hero) => hero.hp)).toEqual(beforeHp);
      current = next;
    }
    const contact = chroniclesResolveEnemyActor(current, goblin.id);
    expect(contact.enemyTurnEvents.map((event) => event.type)).toEqual(['attack']);
    expect(chroniclesRuntimeEnemyPosition(contact, goblin)).toEqual({ x: 1, y: 2 });
  });
});
