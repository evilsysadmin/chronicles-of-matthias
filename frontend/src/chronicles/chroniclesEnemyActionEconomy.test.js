import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesResolveEnemyActor,
  chroniclesResolveEnemyTurn,
  chroniclesRuntimeEnemyPosition,
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
