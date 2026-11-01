import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesPartyArmorClass,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';

const ARCHER_ID = 'banner-road-east-scout';

function crossbowEncounter() {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  const archer = chroniclesActiveEnemies(base).find((enemy) => enemy.id === ARCHER_ID);
  expect(archer?.ai).toMatchObject({ attackReach: 3, requiresLineOfSight: true });
  const [guard, ally] = base.party.filter((member) => member.hp > 0);
  expect(guard?.id).toBeTruthy();
  expect(ally?.id).toBeTruthy();
  return {
    archer, guard, ally,
    state: {
      ...base,
      x: 10, y: 3, direction: 2,
      [archer.hpKey]: 100,
      enemyPositions: { [ARCHER_ID]: { x: 10, y: 5 } },
    },
  };
}

describe('MM3 B3 · BLOCK lifetime across a real ranged enemy turn', () => {
  it('keeps a real +4 CA BLOCK through the crossbowman and an ally, then expires on the guard next turn', () => {
    const { state, archer, guard, ally } = crossbowEncounter();
    const order = [
      { kind: 'party', id: guard.id, name: guard.name, initiative: 12 },
      { kind: 'enemy', id: ARCHER_ID, name: archer.name, initiative: 10 },
      { kind: 'party', id: ally.id, name: ally.name, initiative: 8 },
    ];
    const combat = {
      ...state,
      phase: 'combat',
      initiative: { version: 1, die: '1d8', round: 2, cursor: 0, order },
    };
    const enemies = [archer];
    const baselineAc = chroniclesPartyArmorClass(combat, guard.id);

    // Execute B through the real reducer. A synthetic { armorBonus: 4 }
    // object is not a valid guard: the runtime recognizes only true.
    const blocked = chroniclesReduce(combat, { type: 'block', memberId: guard.id });
    expect(blocked.turns).toBe(combat.turns + 1);
    expect(blocked.combatBlock?.[guard.id]).toBe(true);
    expect(blocked.combatActionSpent?.[guard.id]).toBe(true);
    expect(chroniclesPartyArmorClass(blocked, guard.id)).toBe(baselineAc + 4);
    expect(chroniclesReduce(blocked, { type: 'block', memberId: guard.id })).toBe(blocked);

    const enemyTurn = chroniclesAdvanceCombatInitiative(blocked, enemies);
    expect(chroniclesCurrentInitiativeActor(enemyTurn.initiative)?.id).toBe(ARCHER_ID);
    expect(chroniclesPartyArmorClass(enemyTurn, guard.id)).toBe(baselineAc + 4);
    expect(enemyTurn.initiative.round).toBe(2);

    const resolved = chroniclesRunPendingEnemyTurn(enemyTurn, ARCHER_ID);
    expect(resolved.error).toBeNull();
    expect(resolved.acted.enemyTurnEvents.map(({ type }) => type)).toEqual(['attack']);
    const allyTurn = resolved.committed;
    expect(chroniclesCurrentInitiativeActor(allyTurn.initiative)?.id).toBe(ally.id);
    expect(allyTurn.combatBlock?.[guard.id]).toBe(true);
    expect(allyTurn.combatActionSpent?.[guard.id]).toBe(true);
    expect(chroniclesPartyArmorClass(allyTurn, guard.id)).toBe(baselineAc + 4);
    expect(allyTurn.initiative.round).toBe(2);

    const guardNextTurn = chroniclesAdvanceCombatInitiative(allyTurn, enemies);
    expect(chroniclesCurrentInitiativeActor(guardNextTurn.initiative)?.id).toBe(guard.id);
    expect(guardNextTurn.combatBlock?.[guard.id]).toBeUndefined();
    expect(guardNextTurn.combatActionSpent?.[guard.id]).toBeUndefined();
    expect(chroniclesPartyArmorClass(guardNextTurn, guard.id)).toBe(baselineAc);
    expect(guardNextTurn.initiative.round).toBe(3);
    expect(guardNextTurn.turns).toBe(blocked.turns);
    // Initiative transitions do not spend exploration turns or mutate the source.
    expect(combat.turns).toBe(state.turns);
    expect(combat.combatBlock).toBeUndefined();
    expect(blocked.combatBlock?.[guard.id]).toBe(true);
  });

  it('does not carry a previous encounter guard or spent action into a new forced engagement', () => {
    const { state, archer, guard } = crossbowEncounter();
    const previousEncounter = {
      ...state,
      phase: 'explore',
      combatBlock: { [guard.id]: true },
      combatActionSpent: { [guard.id]: true },
    };
    const started = chroniclesStartInitiativeCombat(previousEncounter, [archer], {
      forceEnemyIds: [ARCHER_ID],
      random: () => 0,
    });
    expect(started.phase).toBe('combat');
    expect(started.initiative.order.some((actor) => actor.id === ARCHER_ID)).toBe(true);
    expect(started.combatBlock).toBeUndefined();
    expect(started.combatActionSpent).toBeUndefined();
    expect(started.turns).toBe(state.turns);
  });
});
