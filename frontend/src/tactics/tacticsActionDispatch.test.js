import { describe, expect, it, vi } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesPartyMemberPosition } from '../chroniclesPartyFootprint.js';
import {
  chroniclesTacticsAttack,
  chroniclesTacticsLegalMoves,
  chroniclesTacticsMove,
  chroniclesTacticsTargets,
} from '../chroniclesOfMatthiasTactics.js';
import {
  chroniclesTacticsCurrentActor,
  chroniclesTacticsPartyCanAct,
  chroniclesTacticsResolvePlayerAction,
} from '../chroniclesTacticsTurnMode.js';
import { tacticsExecuteAttack, tacticsExecuteMove } from './tacticsActionDispatch.js';

const livePorts = {
  partyCanAct: chroniclesTacticsPartyCanAct,
  currentActor: chroniclesTacticsCurrentActor,
  memberPosition: chroniclesPartyMemberPosition,
  legalMoves: chroniclesTacticsLegalMoves,
  move: chroniclesTacticsMove,
  targets: chroniclesTacticsTargets,
  attack: chroniclesTacticsAttack,
  resolveAction: chroniclesTacticsResolvePlayerAction,
};

describe('portable action dispatch with real Chronicles tactical ports', () => {
  it('walks using actual legal moves without advancing a free exploration turn', () => {
    const initial = createChroniclesState();
    const result = tacticsExecuteMove(initial, 0, -1, livePorts);
    expect(result).toMatchObject({ actionKind: 'move', actorMemberId: null });
    expect(result.next).toMatchObject({ x: 1, y: 4, turns: initial.turns });
    expect(initial).toMatchObject({ x: 1, y: 5 });
    expect(tacticsExecuteMove(initial, -1, 0, livePorts)).toBeNull();
  });

  it('only accepts real legal targets and starts ranged combat before damage', () => {
    const initial = createChroniclesState();
    const legal = chroniclesTacticsTargets(initial, 'rook');
    expect(legal.some((target) => target.enemyId === 'corrupted-pawn')).toBe(true);
    expect(tacticsExecuteAttack(initial, 'missing', 'rook', livePorts)).toBeNull();
    const result = tacticsExecuteAttack(initial, 'corrupted-pawn', 'rook', livePorts);
    expect(result).toMatchObject({ actionKind: 'attack', actorMemberId: 'rook' });
    expect(result.next.phase).toBe('combat');
    expect(result.next.enemyHp).toBe(initial.enemyHp);
    expect(result.next.turns).toBe(initial.turns);
  });

  it('the initiative cursor owns both attack and movement, not the selected portrait', () => {
    const state = {
      ...createChroniclesState(),
      phase: 'combat',
      initiative: {
        version: 1, round: 1, die: '1d8', cursor: 0,
        order: [{ kind: 'party', id: 'rook', name: 'Rook', agility: 2, roll: 8, initiative: 10 }],
      },
      partyPositions: {
        matthias: { x: 1, y: 4 },
        rook: { x: 1, y: 5 },
        bishop: { x: 2, y: 4 },
        knight: { x: 4, y: 5 },
      },
    };
    const result = tacticsExecuteMove(state, 0, -1, livePorts);
    expect(result).toBeNull(); // Already occupied by Matthias; cannot cheat.
    const fake = {
      ...livePorts,
      targets: vi.fn(() => [{ enemyId: 'corrupted-pawn' }]),
      attack: vi.fn((s) => ({ ...s, turns: s.turns + 1 })),
      resolveAction: vi.fn((_previous, next) => next),
    };
    const attack = tacticsExecuteAttack(state, 'corrupted-pawn', 'matthias', fake);
    expect(attack.actorMemberId).toBe('rook');
    expect(fake.attack).toHaveBeenCalledWith(state, 'rook', 'corrupted-pawn');
  });

  it('cannot act in an enemy initiative slot, or on defeat', () => {
    const base = createChroniclesState();
    const enemy = {
      ...base,
      phase: 'combat',
      initiative: {
        version: 1, cursor: 0,
        order: [{ kind: 'enemy', id: 'corrupted-pawn' }],
      },
    };
    expect(tacticsExecuteMove(enemy, 0, -1, livePorts)).toBeNull();
    expect(tacticsExecuteAttack(enemy, null, 'rook', livePorts)).toBeNull();
    const defeated = { ...base, phase: 'defeated' };
    expect(tacticsExecuteMove(defeated, 0, -1, livePorts)).toBeNull();
    expect(tacticsExecuteAttack(defeated, null, 'rook', livePorts)).toBeNull();
  });
});
