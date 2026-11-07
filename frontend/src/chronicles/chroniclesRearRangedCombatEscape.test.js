import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies, chroniclesCombatMeleeTarget,
  chroniclesCombatPartyStepBlocked, chroniclesMM3MeleeAvailable,
  chroniclesReduce, createChroniclesState, chroniclesTileAt,
} from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackTarget } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';

const ARCHER_ID = 'banner-road-east-scout';

function rearArcherFight() {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(base);
  const archer = enemies.find((enemy) => enemy.id === ARCHER_ID);
  expect(archer?.ai).toMatchObject({ attackReach: 3, requiresLineOfSight: true });
  const inactive = Object.fromEntries(enemies.filter((enemy) => enemy.id !== ARCHER_ID)
    .map((enemy) => [enemy.hpKey, 0]));
  const placed = {
    ...base, ...inactive,
    x: 10, y: 3, direction: 0, // looking north, archer two cells south
    enemyPositions: { [ARCHER_ID]: { x: 10, y: 5 } },
  };
  expect(chroniclesTileAt(10, 4, placed)).toBe('.');
  const fight = chroniclesStartInitiativeCombat(placed, enemies, { random: () => 0 });
  expect(fight.phase).toBe('combat');
  const index = fight.initiative.order.findIndex((actor) => actor.kind === 'party');
  expect(index).toBeGreaterThanOrEqual(0);
  return { archer, fight: {
    ...fight, initiative: { ...fight.initiative, cursor: index },
  } };
}

describe('MM3 P0 rear ranged enemy no longer traps an unarmed party', () => {
  it('lets a hero close real distance at the cost of an action, then reach melee', () => {
    const { archer, fight } = rearArcherFight();
    const currentHero = fight.initiative.order[fight.initiative.cursor].id;
    expect(chroniclesEnemyAttackTarget(fight, archer)).toBeTruthy();
    expect(chroniclesCombatMeleeTarget(fight)).toBeNull();
    expect(chroniclesCombatPartyStepBlocked(fight, 'backward')).toBe(false);

    const approached = chroniclesReduce(fight, 'backward');
    expect([approached.x, approached.y]).toEqual([10, 4]);
    expect(approached.direction).toBe(0);
    expect(approached.turns).toBe(fight.turns + 1);
    expect(approached.combatActionSpent?.[currentHero]).toBe(true);
    expect(chroniclesReduce(approached, 'backward')).toBe(approached);
    expect(chroniclesReduce(approached, { type: 'attack', memberId: currentHero })).toBe(approached);

    const nextIndex = approached.initiative.order.findIndex((actor) => actor.kind === 'party' && actor.id !== currentHero);
    expect(nextIndex).toBeGreaterThanOrEqual(0);
    const nextHero = {
      ...approached,
      initiative: { ...approached.initiative, cursor: nextIndex },
    };
    const otherHero = nextHero.initiative.order[nextIndex].id;
    expect(chroniclesCombatMeleeTarget(nextHero)?.enemy.id).toBe(ARCHER_ID);
    expect(chroniclesMM3MeleeAvailable(nextHero, otherHero)).toBe(true);
  });

  it('refuses masonry and occupied enemy cells without turn cost or phantom movement', () => {
    const { fight } = rearArcherFight();
    // The crossbowman occupies (10, 5): even an adjacent approach cannot
    // walk through the actual living enemy.
    const next = chroniclesReduce(fight, 'backward');
    expect(chroniclesReduce({
      ...next, combatActionSpent: undefined,
    }, 'backward').y).toBe(4);

    // (9,4) is an authored wall; do not cross it even while being attacked.
    const blocked = { ...fight, x: 9, y: 3 };
    expect(chroniclesTileAt(9, 4, blocked)).toBe('#');
    expect(chroniclesReduce(blocked, 'backward')).toBe(blocked);
  });

  it('keeps enemy turns and spent party actions inert for all direction keys', () => {
    const { fight } = rearArcherFight();
    const enemyIndex = fight.initiative.order.findIndex((actor) => actor.kind === 'enemy');
    const enemyTurn = { ...fight, initiative: { ...fight.initiative, cursor: enemyIndex } };
    for (const action of ['forward', 'backward', 'strafe-left', 'strafe-right', 'turn-left', 'turn-right']) {
      expect(chroniclesCombatPartyStepBlocked(enemyTurn, action)).toBe(true);
      expect(chroniclesReduce(enemyTurn, action)).toBe(enemyTurn);
    }
    const moved = chroniclesReduce(fight, 'turn-right');
    expect(moved.direction).toBe(1);
    expect(moved.combatActionSpent?.[fight.initiative.order[fight.initiative.cursor].id]).toBe(true);
    expect(chroniclesReduce(moved, 'turn-right')).toBe(moved);
  });
});
