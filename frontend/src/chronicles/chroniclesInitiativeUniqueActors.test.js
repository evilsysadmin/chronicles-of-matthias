import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesRollInitiative, chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';

describe('Chronicles fresh initiative roster integrity', () => {
  it('rolls only once for each living hero and enemy even if input rosters repeat an id', () => {
    const state = {
      party: [
        { id: 'hero', name: 'Original', hp: 5, agility: 3 },
        { id: 'hero', name: 'Duplicate', hp: 5, agility: 99 },
        { id: 'fallen', hp: 0, agility: 99 },
        { id: '', hp: 5, agility: 99 },
        { id: '   ', hp: 5, agility: 99 },
      ],
      goblinHp: 4,
    };
    const enemies = [
      { id: 'goblin', name: 'Original goblin', hpKey: 'goblinHp', agility: 2 },
      { id: 'goblin', name: 'Duplicate goblin', hpKey: 'goblinHp', agility: 99 },
      { id: '', hpKey: 'goblinHp', agility: 99 },
      { id: '   ', hpKey: 'goblinHp', agility: 99 },
    ];
    let rolls = 0;
    const initiative = chroniclesRollInitiative(state, enemies, {
      random: () => { rolls += 1; return 0; },
    });

    expect(rolls).toBe(2);
    expect(initiative.order.map(({ kind, id, name, agility }) => [kind, id, name, agility])).toEqual([
      ['party', 'hero', 'Original', 3],
      ['enemy', 'goblin', 'Original goblin', 2],
    ]);
    expect(initiative.order.map(({ roll }) => roll)).toEqual([1, 1]);
  });

  it('keeps separate party and enemy namespaces even when ids coincide', () => {
    const state = {
      party: [{ id: 'shared', hp: 4, agility: 3 }],
      enemyHp: 4,
    };
    const enemies = [{ id: 'shared', hpKey: 'enemyHp', agility: 2 }];
    const initiative = chroniclesRollInitiative(state, enemies, { random: () => 0 });

    expect(initiative.order.map(({ kind, id }) => [kind, id])).toEqual([
      ['party', 'shared'],
      ['enemy', 'shared'],
    ]);
  });
  it.each(['', '   ', null])('does not start enemy-only combat with invalid living hero id %s', (invalidId) => {
    const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const goblin = chroniclesActiveEnemies(base).find((enemy) => enemy.id === 'sewers-goblin-west');
    const state = {
      ...base,
      party: base.party.map((member) => ({ ...member, id: invalidId })),
    };
    expect(state.party.some((member) => member.hp > 0)).toBe(true);
    let rolls = 0;
    const next = chroniclesStartInitiativeCombat(state, [goblin], {
      forceEnemyIds: [goblin.id],
      random: () => { rolls += 1; return 0; },
    });
    expect(next).toBe(state);
    expect(rolls).toBe(0);
  });

  it.each(['', '   ', null])('refuses forced combat with invalid enemy id %s', (invalidId) => {
    const state = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const goblin = chroniclesActiveEnemies(state).find((enemy) => enemy.id === 'sewers-goblin-west');
    expect(goblin).toBeTruthy();
    let rolls = 0;
    const next = chroniclesStartInitiativeCombat(state, [{ ...goblin, id: invalidId }], {
      forceEnemyIds: [invalidId],
      random: () => { rolls += 1; return 0; },
    });
    expect(next).toBe(state);
    expect(rolls).toBe(0);
  });

});
