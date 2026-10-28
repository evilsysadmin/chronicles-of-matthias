import { describe, expect, it, vi } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesCurrentInitiativeActor } from './chroniclesInitiative.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';

const WEST = 'sewers-goblin-west';
const OVERFLOW = 'sewers-goblin-overflow';

function enemyFirstEncounter(twoEnemies = false) {
  const initial = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const targets = twoEnemies ? [WEST, OVERFLOW] : [WEST];
  const active = chroniclesActiveEnemies(initial);
  const eliminated = Object.fromEntries(active
    .filter((enemy) => !targets.includes(enemy.id))
    .map((enemy) => [enemy.hpKey, 0]));
  return {
    ...initial,
    ...eliminated,
    x: 1, y: 1,
    phase: 'combat',
    enemyPositions: {
      [WEST]: { x: 1, y: 3 },
      ...(twoEnemies ? { [OVERFLOW]: { x: 1, y: 4 } } : {}),
    },
    initiative: {
      round: 1, cursor: 0,
      order: [
        { kind: 'enemy', id: WEST },
        ...(twoEnemies ? [{ kind: 'enemy', id: OVERFLOW }] : []),
        { kind: 'party', id: 'matthias' },
      ],
    },
  };
}

describe('MM3 automatic enemy turn cannot deadlock the controls', () => {
  it('resolves a real enemy move before passing initiative back to a living hero', () => {
    const state = enemyFirstEncounter();
    const result = chroniclesRunPendingEnemyTurn(state, WEST);
    expect(result.error).toBeNull();
    expect(result.acted.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(result.committed.enemyPositions[WEST]).toEqual({ x: 1, y: 2 });
    expect(chroniclesCurrentInitiativeActor(result.committed.initiative)).toMatchObject({
      kind: 'party', id: 'matthias',
    });
    expect(result.committed.party).toEqual(state.party);
  });

  it('skips only the broken enemy action, without losing combat or changing hit points', () => {
    const state = enemyFirstEncounter(true);
    const failure = new Error('bad map cell / invalid restored enemy action');
    const fail = vi.fn(() => { throw failure; });
    const first = chroniclesRunPendingEnemyTurn(state, WEST, fail);
    expect(first.error).toBe(failure);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(first.acted).toBe(state);
    expect(first.committed.party).toEqual(state.party);
    expect(first.committed.enemyPositions).toEqual(state.enemyPositions);
    expect(first.committed.phase).toBe('combat');
    expect(chroniclesCurrentInitiativeActor(first.committed.initiative)).toMatchObject({
      kind: 'enemy', id: OVERFLOW,
    });

    // The next enemy can still act; only then does the player get control.
    const second = chroniclesRunPendingEnemyTurn(first.committed, OVERFLOW);
    expect(second.error).toBeNull();
    expect(chroniclesCurrentInitiativeActor(second.committed.initiative)).toMatchObject({
      kind: 'party', id: 'matthias',
    });
  });

  it('refuses a stale timer after the actor has changed, without replaying a turn', () => {
    const state = enemyFirstEncounter();
    const wrong = vi.fn();
    expect(chroniclesRunPendingEnemyTurn(state, OVERFLOW, wrong)).toBeNull();
    expect(wrong).not.toHaveBeenCalled();
    expect(state.initiative.cursor).toBe(0);
  });
});
