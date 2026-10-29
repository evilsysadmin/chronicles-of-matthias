import { describe, expect, it } from 'vitest';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
} from './chroniclesInitiative.js';

describe('restored MM3 initiative actor kind integrity', () => {
  it.each([undefined, null, 'spectator'])(
    'skips a malformed enemy-kind slot (%s) even when its id belongs to a living goblin',
    (kind) => {
      const state = {
        phase: 'combat',
        party: [{ id: 'matthias', hp: 7 }],
        goblinHp: 3,
        initiative: {
          version: 1, die: '1d8', round: 3, cursor: 0,
          order: [
            { kind: 'party', id: 'matthias', initiative: 9 },
            { kind, id: 'goblin', initiative: 8 },
            { kind: 'enemy', id: 'goblin', initiative: 7 },
          ],
        },
      };
      const restored = JSON.parse(JSON.stringify(state));
      const enemies = [{ id: 'goblin', hpKey: 'goblinHp' }];
      const enemyTurn = chroniclesAdvanceCombatInitiative(restored, enemies);
      expect(enemyTurn.phase).toBe('combat');
      expect(enemyTurn.initiative.order.map(({ kind: actorKind, id }) => [actorKind, id]))
        .toEqual([['party', 'matthias'], ['enemy', 'goblin']]);
      expect(chroniclesCurrentInitiativeActor(enemyTurn.initiative))
        .toMatchObject({ kind: 'enemy', id: 'goblin' });
      expect(enemyTurn.initiative.round).toBe(3);

      const nextRound = chroniclesAdvanceCombatInitiative(enemyTurn, enemies);
      expect(chroniclesCurrentInitiativeActor(nextRound.initiative))
        .toMatchObject({ kind: 'party', id: 'matthias' });
      expect(nextRound.initiative.round).toBe(4);
    },
  );

  it('does not let an unknown hero-kind slot steal the next hero turn', () => {
    const state = {
      phase: 'combat',
      party: [{ id: 'matthias', hp: 7 }],
      goblinHp: 3,
      initiative: {
        version: 1, die: '1d8', round: 5, cursor: 0,
        order: [
          { kind: 'enemy', id: 'goblin', initiative: 9 },
          { kind: 'unknown', id: 'matthias', initiative: 8 },
          { kind: 'party', id: 'matthias', initiative: 7 },
        ],
      },
    };
    const next = chroniclesAdvanceCombatInitiative(
      JSON.parse(JSON.stringify(state)),
      [{ id: 'goblin', hpKey: 'goblinHp' }],
    );
    expect(next.initiative.order.map(({ kind, id }) => [kind, id]))
      .toEqual([['enemy', 'goblin'], ['party', 'matthias']]);
    expect(chroniclesCurrentInitiativeActor(next.initiative))
      .toMatchObject({ kind: 'party', id: 'matthias' });
    expect(next.initiative.round).toBe(5);
  });
});
