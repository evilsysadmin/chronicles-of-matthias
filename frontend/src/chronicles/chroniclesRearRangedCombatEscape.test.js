import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies, chroniclesAttackMode, chroniclesCombatMeleeTarget,
  chroniclesCombatMissileTarget, chroniclesCombatPartyStepBlocked,
  chroniclesEnemyTargetAhead, chroniclesMM3MeleeAvailable,
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
  // Legacy explicitly forced initiative fixture: target/movement guards are
  // tested independently of the normal MM3 rule (ranged shots stay in explore).
  const fight = chroniclesStartInitiativeCombat(placed, enemies, {
    forceEnemyIds: [ARCHER_ID], random: () => 0,
  });
  expect(fight.phase).toBe('combat');
  const index = fight.initiative.order.findIndex((actor) => actor.kind === 'party');
  expect(index).toBeGreaterThanOrEqual(0);
  return { archer, fight: {
    ...fight, initiative: { ...fight.initiative, cursor: index },
  } };
}



// Three real, authored enemies: the scout fires from behind, the captain
// attacks from the flank and a different living deserter stands directly
// ahead but is NOT in this initiative (e.g. a resumed/forced encounter).
// The latter must not steal A/S from either member of the current fight.
function contestedTargetFight({ engageFlank = true } = {}) {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  const all = chroniclesActiveEnemies(base);
  const find = id => {
    const enemy = all.find(candidate => candidate.id === id);
    expect(enemy, id).toBeTruthy();
    return enemy;
  };
  const archer = find(ARCHER_ID);
  const flank = find('banner-road-bandit-captain');
  const bystander = find('banner-road-deserter');
  const positions = {
    [archer.id]: { x: 10, y: 5 },
    [flank.id]: { x: 11, y: 3 },
    [bystander.id]: { x: 10, y: 2 },
  };
  const activeIds = new Set([archer.id, flank.id, bystander.id]);
  const placed = {
    ...base,
    ...Object.fromEntries(all.filter(enemy => !activeIds.has(enemy.id))
      .map(enemy => [enemy.hpKey, 0])),
    x: 10, y: 3, direction: 0, enemyPositions: positions,
  };
  for (const position of Object.values(positions)) {
    expect(chroniclesTileAt(position.x, position.y, placed)).toBe('.');
  }
  const engaged = engageFlank ? [archer, flank] : [archer];
  const launched = chroniclesStartInitiativeCombat(placed, engaged, {
    forceEnemyIds: engaged.map(enemy => enemy.id), random: () => 0,
  });
  expect(launched.phase).toBe('combat');
  const cursor = launched.initiative.order.findIndex(actor => actor.kind === 'party');
  expect(cursor).toBeGreaterThanOrEqual(0);
  const fight = { ...launched, initiative: { ...launched.initiative, cursor } };
  const engagedIds = fight.initiative.order.filter(actor => actor.kind === 'enemy')
    .map(actor => actor.id).sort();
  expect(engagedIds).toEqual(engaged.map(enemy => enemy.id).sort());
  return { fight, archer, flank, bystander };
}

describe('MM3 ranged exploration does not begin initiative automatically', () => {
  it('keeps a legal two-tile rear shooter in exploration, so the party can move', () => {
    const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    const enemies = chroniclesActiveEnemies(base);
    const archer = enemies.find((enemy) => enemy.id === ARCHER_ID);
    const placed = {
      ...base,
      ...Object.fromEntries(enemies.filter((enemy) => enemy.id !== ARCHER_ID)
        .map((enemy) => [enemy.hpKey, 0])),
      x: 10, y: 3, direction: 2,
      enemyPositions: { [ARCHER_ID]: { x: 10, y: 5 } },
    };
    expect(chroniclesEnemyAttackTarget(placed, archer)).toBeTruthy();
    expect(chroniclesStartInitiativeCombat(placed, enemies, { random: () => 0 })).toBe(placed);
    const moved = chroniclesReduce(placed, 'forward');
    expect([moved.x, moved.y, moved.direction]).toEqual([10, 4, 2]);
    expect(moved.initiative).toBeFalsy();
  });
});

describe('MM3 P0 rear ranged enemy no longer traps an unarmed party', () => {

  it('in a multi-enemy fight attacks the adjacent engaged flank, not a visible bystander', () => {
    const { fight, archer, flank, bystander } = contestedTargetFight();
    const hero = fight.initiative.order[fight.initiative.cursor];
    expect(chroniclesEnemyAttackTarget(fight, archer)).toBeTruthy();
    expect(chroniclesEnemyAttackTarget(fight, flank)).toBeTruthy();
    // The ordinary world ray sees the bystander, but the combat ray must
    // never use a target not present in the current initiative order.
    expect(chroniclesEnemyTargetAhead(fight, 1)?.enemy.id).toBe(bystander.id);
    expect(chroniclesCombatMeleeTarget(fight)?.enemy.id).toBe(flank.id);
    expect(chroniclesCombatMissileTarget(fight, 3)?.enemy.id).toBe(flank.id);
    expect(chroniclesMM3MeleeAvailable(fight, hero.id)).toBe(true);
    expect(chroniclesAttackMode(fight, hero.id)).toBe('melee');
    const attacked = chroniclesReduce(fight, {
      type: 'attack', memberId: hero.id, mode: 'melee',
    });
    expect(attacked.turns).toBe(fight.turns + 1);
    expect(attacked.direction).toBe(fight.direction);
    expect(attacked[bystander.hpKey]).toBe(fight[bystander.hpKey]);
    expect(attacked.combatActionSpent?.[hero.id]).toBe(true);
    expect(chroniclesReduce(attacked, 'turn-right')).toBe(attacked);
    expect(chroniclesReduce(attacked, { type: 'attack', memberId: hero.id, mode: 'melee' }))
      .toBe(attacked);
  });

  it('does not swing or fire at a non-engaged enemy in front, yet can approach the rear scout', () => {
    const { fight, archer, bystander } = contestedTargetFight({ engageFlank: false });
    const actor = fight.initiative.order[fight.initiative.cursor];
    expect(chroniclesEnemyTargetAhead(fight, 3)?.enemy.id).toBe(bystander.id);
    expect(chroniclesCombatMeleeTarget(fight)).toBeNull();
    expect(chroniclesCombatMissileTarget(fight, 3)).toBeNull();
    expect(chroniclesMM3MeleeAvailable(fight, actor.id)).toBe(false);
    expect(chroniclesAttackMode(fight, actor.id)).toBe('melee');
    expect(chroniclesReduce(fight, { type: 'attack', memberId: actor.id, mode: 'melee' }))
      .toBe(fight);
    // This restriction applies only while initiative owns target selection;
    // normal exploration and Tactics keep the pre-existing forward ray.
    expect(chroniclesCombatMissileTarget({
      ...fight, phase: 'explore', initiative: null,
    }, 3)?.enemy.id).toBe(bystander.id);
    expect(chroniclesCombatMissileTarget({
      ...fight, combatRules: null,
    }, 3)?.enemy.id).toBe(bystander.id);
    const approached = chroniclesReduce(fight, 'backward');
    expect([approached.x, approached.y, approached.direction]).toEqual([10, 4, 0]);
    expect(approached.turns).toBe(fight.turns + 1);
    expect(approached.combatActionSpent?.[actor.id]).toBe(true);
    const nextActor = approached.initiative.order.findIndex(entry =>
      entry.kind === 'party' && entry.id !== actor.id);
    expect(nextActor).toBeGreaterThanOrEqual(0);
    const next = { ...approached, initiative: { ...approached.initiative, cursor: nextActor } };
    expect(chroniclesCombatMeleeTarget(next)?.enemy.id).toBe(archer.id);
    expect(chroniclesMM3MeleeAvailable(next, next.initiative.order[nextActor].id)).toBe(true);
    expect(next[bystander.hpKey]).toBe(fight[bystander.hpKey]);
  });


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
    expect(chroniclesCombatPartyStepBlocked(fight, 'turn-right')).toBe(true);
    expect(chroniclesReduce(fight, 'turn-right')).toBe(fight);
    // Backstep remains useful and costs one action; no spin is allowed.
    const moved = chroniclesReduce(fight, 'backward');
    expect([moved.x, moved.y, moved.direction]).toEqual([10, 4, 0]);
    expect(moved.combatActionSpent?.[fight.initiative.order[fight.initiative.cursor].id]).toBe(true);
    expect(chroniclesReduce(moved, 'turn-right')).toBe(moved);
  });
});
