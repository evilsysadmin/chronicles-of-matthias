import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
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
  it('keeps guard through the crossbowman and an ally, then expires only on the guarding hero next turn', () => {
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
      combatBlock: { [guard.id]: { armorBonus: 4 } },
      combatActionSpent: { [guard.id]: true },
    };
    const enemies = [archer];

    const enemyTurn = chroniclesAdvanceCombatInitiative(combat, enemies);
    expect(chroniclesCurrentInitiativeActor(enemyTurn.initiative)?.id).toBe(ARCHER_ID);
    expect(enemyTurn.combatBlock?.[guard.id]).toEqual({ armorBonus: 4 });
    expect(enemyTurn.combatActionSpent?.[guard.id]).toBe(true);
    expect(enemyTurn.initiative.round).toBe(2);

    const allyTurn = chroniclesAdvanceCombatInitiative(enemyTurn, enemies);
    expect(chroniclesCurrentInitiativeActor(allyTurn.initiative)?.id).toBe(ally.id);
    expect(allyTurn.combatBlock?.[guard.id]).toEqual({ armorBonus: 4 });
    expect(allyTurn.combatActionSpent?.[guard.id]).toBe(true);
    expect(allyTurn.initiative.round).toBe(2);

    const guardNextTurn = chroniclesAdvanceCombatInitiative(allyTurn, enemies);
    expect(chroniclesCurrentInitiativeActor(guardNextTurn.initiative)?.id).toBe(guard.id);
    expect(guardNextTurn.combatBlock?.[guard.id]).toBeUndefined();
    expect(guardNextTurn.combatActionSpent?.[guard.id]).toBeUndefined();
    expect(guardNextTurn.initiative.round).toBe(3);
    expect(guardNextTurn.turns).toBe(state.turns);
    // Initiative transitions do not consume exploration turns or mutate the source.
    expect(combat.combatBlock?.[guard.id]).toEqual({ armorBonus: 4 });
  });

  it('does not carry a previous encounter guard or spent action into a new forced engagement', () => {
    const { state, archer, guard } = crossbowEncounter();
    const previousEncounter = {
      ...state,
      phase: 'explore',
      combatBlock: { [guard.id]: { armorBonus: 4 } },
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
