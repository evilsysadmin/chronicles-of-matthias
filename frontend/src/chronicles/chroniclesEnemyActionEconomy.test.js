import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import {
  chroniclesResolveEnemyActor,
  chroniclesResolveEnemyTurn,
  chroniclesRuntimeEnemyPosition,
  chroniclesEnemyAttackTarget,
  chroniclesChooseEnemyStep,
} from '../chroniclesOfMatthiasTurns.js';

const GOBLIN = 'sewers-goblin-west';

// A volley can start combat with a goblin three cells down a clear corridor.
// All other creatures and heroes are removed so this tests one enemy action.
function corridorFight(distance = 3) {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const inactive = Object.fromEntries(chroniclesActiveEnemies(base)
    .filter((enemy) => enemy.id !== GOBLIN)
    .map((enemy) => [enemy.hpKey, 0]));
  return {
    ...base,
    ...inactive,
    x: 1, y: 1, direction: 2,
    phase: 'combat',
    turnPhase: 'enemy',
    party: base.party.map((member) => member.id === 'matthias' ? member : { ...member, hp: 0 }),
    partyPositions: { matthias: { x: 1, y: 1 } },
    enemyPositions: { [GOBLIN]: { x: 1, y: 1 + distance } },
    initiative: { round: 1, cursor: 0, order: [{ kind: 'enemy', id: GOBLIN }] },
  };
}

describe('Chronicles MM3 enemy action economy', () => {
  it('spends each initiative action approaching after a distant opening volley, then attacks from melee range', () => {
    const start = corridorFight(3);
    const hp = start.party[0].hp;
    const first = chroniclesResolveEnemyActor(start, GOBLIN);
    expect(chroniclesRuntimeEnemyPosition(first, { id: GOBLIN })).toEqual({ x: 1, y: 3 });
    expect(first.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(first.party[0].hp).toBe(hp);

    const second = chroniclesResolveEnemyActor(first, GOBLIN);
    expect(chroniclesRuntimeEnemyPosition(second, { id: GOBLIN })).toEqual({ x: 1, y: 2 });
    expect(second.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(second.party[0].hp).toBe(hp);

    const third = chroniclesResolveEnemyActor(second, GOBLIN);
    expect(third.enemyTurnEvents.map((event) => event.type)).toEqual(['attack']);
    expect(chroniclesRuntimeEnemyPosition(third, { id: GOBLIN })).toEqual({ x: 1, y: 2 });
  });

  it('uses the same move-or-attack rule in the collective enemy resolver', () => {
    const start = corridorFight(2);
    const hp = start.party[0].hp;
    const approaching = chroniclesResolveEnemyTurn(start);
    expect(approaching.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(approaching.party[0].hp).toBe(hp);
    expect(chroniclesRuntimeEnemyPosition(approaching, { id: GOBLIN })).toEqual({ x: 1, y: 2 });

    const adjacent = chroniclesResolveEnemyTurn(approaching);
    expect(adjacent.enemyTurnEvents.map((event) => event.type)).toEqual(['attack']);
    expect(chroniclesRuntimeEnemyPosition(adjacent, { id: GOBLIN })).toEqual({ x: 1, y: 2 });
  });
});

describe('Chronicles first-person combat reach follows the visible camera anchor', () => {
  function deployedGoblinCombat(distance = 3) {
    const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const inactive = Object.fromEntries(chroniclesActiveEnemies(base)
      .filter((enemy) => enemy.id !== GOBLIN)
      .map((enemy) => [enemy.hpKey, 0]));
    const placed = {
      ...base,
      ...inactive,
      x: 1, y: 1, direction: 2,
      enemyPositions: { [GOBLIN]: { x: 1, y: 1 + distance } },
    };
    const goblin = chroniclesActiveEnemies(placed).find((enemy) => enemy.id === GOBLIN);
    const combat = chroniclesStartInitiativeCombat(placed, [goblin], {
      forceEnemyIds: [GOBLIN], random: () => 0,
    });
    expect(combat.initiative).toBeTruthy();
    expect(Object.keys(combat.partyPositions || {})).toHaveLength(4);
    return { goblin, combat };
  }

  it('does not give a melee goblin free extra reach from forward-deployed heroes', () => {
    const { goblin, combat } = deployedGoblinCombat();
    const exposed = {
      ...combat,
      partyPositions: {
        ...combat.partyPositions,
        matthias: { x: 1, y: 2 }, // internal hero tile forward of camera
      },
      enemyPositions: { ...combat.enemyPositions, [GOBLIN]: { x: 1, y: 3 } },
    };
    // The goblin is next to Matthias' bookkeeping tile, but still two full
    // cells from the party's visible world position at (1, 1).
    expect(chroniclesEnemyAttackTarget(exposed, goblin)).toBeNull();
    const beforeHp = exposed.party.map((hero) => hero.hp);
    const approaching = chroniclesResolveEnemyActor(exposed, GOBLIN);
    expect(approaching.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(chroniclesRuntimeEnemyPosition(approaching, goblin)).toEqual({ x: 1, y: 2 });
    expect(approaching.party.map((hero) => hero.hp)).toEqual(beforeHp);

    const adjacent = chroniclesResolveEnemyActor(approaching, GOBLIN);
    expect(adjacent.enemyTurnEvents.map((event) => event.type)).toEqual(['attack']);
    expect(chroniclesRuntimeEnemyPosition(adjacent, goblin)).toEqual({ x: 1, y: 2 });
  });

  it('approaches from three visible squares after the volley, despite four deployed heroes', () => {
    const { goblin, combat } = deployedGoblinCombat(3);
    const hp = combat.party.map((member) => member.hp);
    const first = chroniclesResolveEnemyActor(combat, GOBLIN);
    expect(first.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(chroniclesRuntimeEnemyPosition(first, goblin)).toEqual({ x: 1, y: 3 });
    expect(first.party.map((member) => member.hp)).toEqual(hp);

    const second = chroniclesResolveEnemyActor(first, GOBLIN);
    expect(second.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(chroniclesRuntimeEnemyPosition(second, goblin)).toEqual({ x: 1, y: 2 });
    expect(second.party.map((member) => member.hp)).toEqual(hp);

    const third = chroniclesResolveEnemyActor(second, GOBLIN);
    expect(third.enemyTurnEvents.map((event) => event.type)).toEqual(['attack']);
  });

  it('preserves extended attack reach and the separate Tactics formation contract', () => {
    const { goblin, combat } = deployedGoblinCombat(3);
    const inFront = {
      ...combat,
      enemyPositions: { ...combat.enemyPositions, [GOBLIN]: { x: 1, y: 3 } },
      partyPositions: { ...combat.partyPositions, matthias: { x: 1, y: 2 } },
    };
    expect(chroniclesEnemyAttackTarget(inFront, goblin)).toBeNull();
    expect(chroniclesEnemyAttackTarget(inFront, {
      ...goblin, ai: { ...goblin.ai, attackReach: 2 },
    })).toBeTruthy();
    const tactics = { ...inFront, combatRules: null };
    const tacticsTarget = chroniclesEnemyAttackTarget(tactics, goblin);
    expect(tacticsTarget).toBeTruthy();
    const tacticalCell = tactics.partyPositions[tacticsTarget.id];
    expect(Math.abs(tacticalCell.x - 1) + Math.abs(tacticalCell.y - 3)).toBe(1);
    expect(chroniclesChooseEnemyStep(inFront, goblin)).toEqual({ x: 1, y: 2 });
  });
});
