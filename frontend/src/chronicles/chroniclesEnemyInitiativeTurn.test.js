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

  it('keeps the visible final opponent direction if a restored fight ends during an enemy turn', () => {
    const initial = enemyFirstEncounter();
    const enemy = chroniclesActiveEnemies(initial).find(({ id }) => id === WEST);
    const fight = {
      ...initial, direction: 0,
      enemyPositions: { [WEST]: { x: 1, y: 2 } },
    };
    const resolved = chroniclesRunPendingEnemyTurn(fight, WEST, (state) => ({
      ...state, [enemy.hpKey]: 0, turns: state.turns + 1,
    }));
    expect(resolved.error).toBeNull();
    expect(resolved.committed).toMatchObject({
      phase: 'explore', initiative: null, direction: 2,
    });
    expect(resolved.committed.turns).toBe(fight.turns + 1);
  });

  it('does not replay an old timer in a new encounter with the same enemy ID and turn slot', () => {
    const previous = enemyFirstEncounter();
    // New combat, but the first actor, round and cursor all happen to match.
    const restarted = {
      ...previous,
      initiative: { ...previous.initiative, order: [...previous.initiative.order] },
    };
    const resolve = vi.fn((state) => state);
    expect(chroniclesRunPendingEnemyTurn(restarted, WEST, resolve, previous.initiative)).toBeNull();
    expect(resolve).not.toHaveBeenCalled();
    expect(restarted.initiative.cursor).toBe(0);

    // Its own newly scheduled callback must still advance the encounter.
    const fresh = chroniclesRunPendingEnemyTurn(restarted, WEST, resolve, restarted.initiative);
    expect(fresh).not.toBeNull();
    expect(fresh.error).toBeNull();
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(chroniclesCurrentInitiativeActor(fresh.committed.initiative)).toMatchObject({
      kind: 'party', id: 'matthias',
    });
  });

  it.each(['explore', 'escaped', 'defeated'])(
    'preserves %s when an enemy action itself ends combat',
    (phase) => {
      const state = enemyFirstEncounter();
      const terminal = { ...state, phase, message: 'Encounter finished' };
      const resolve = vi.fn(() => terminal);
      const result = chroniclesRunPendingEnemyTurn(state, WEST, resolve);

      expect(resolve).toHaveBeenCalledTimes(1);
      expect(result.error).toBeNull();
      expect(result.acted).toBe(terminal);
      expect(result.committed).toBe(terminal);
      expect(result.committed.phase).toBe(phase);
      expect(result.committed.initiative).toBe(state.initiative);
      expect(result.committed.initiative.cursor).toBe(0);
    },
  );

  it('settles a party wipe during an enemy callback without granting another turn', () => {
    const state = {
      ...enemyFirstEncounter(),
      combatBlock: { matthias: true },
    };
    // A restored encounter may still report combat until the initiative
    // advance processes the last hero falling. The pending enemy callback
    // must settle defeat, not leave a ghost turn or a surviving BLOCK bonus.
    const resolve = vi.fn((current) => ({
      ...current,
      party: current.party.map((member) => ({ ...member, hp: 0 })),
    }));
    const result = chroniclesRunPendingEnemyTurn(state, WEST, resolve, state.initiative);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(result.error).toBeNull();
    expect(result.committed.phase).toBe('defeated');
    expect(result.committed.initiative).toBeNull();
    expect(result.committed.turnPhase).toBe('party');
    expect(result.committed.combatBlock).toBeUndefined();
    expect(result.committed.party.every(({ hp }) => hp === 0)).toBe(true);
    expect(chroniclesRunPendingEnemyTurn(result.committed, WEST, resolve, state.initiative)).toBeNull();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it.each(['explore', 'defeated', 'escaped'])(
    'ignores a stale enemy timer after the phase changes to %s',
    (phase) => {
      // Restored saves or a delayed browser callback may still carry the
      // old initiative order even though the encounter has ended.
      const state = { ...enemyFirstEncounter(), phase };
      const resolve = vi.fn(() => { throw new Error('stale turn must not run'); });
      expect(chroniclesRunPendingEnemyTurn(state, WEST, resolve)).toBeNull();
      expect(resolve).not.toHaveBeenCalled();
      expect(state.initiative.cursor).toBe(0);
    },
  );

  it('refuses a stale timer after the actor has changed, without replaying a turn', () => {
    const state = enemyFirstEncounter();
    const wrong = vi.fn();
    expect(chroniclesRunPendingEnemyTurn(state, OVERFLOW, wrong)).toBeNull();
    expect(wrong).not.toHaveBeenCalled();
    expect(state.initiative.cursor).toBe(0);
  });
});
