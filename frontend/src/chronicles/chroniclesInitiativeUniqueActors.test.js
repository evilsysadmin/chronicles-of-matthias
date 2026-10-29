import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesAdvanceCombatInitiative, chroniclesCurrentInitiativeActor, chroniclesRollInitiative, chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';

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
  it.each([
    ['dead duplicate follows the live entry', ['liveHp', 'deadHp']],
    ['dead duplicate precedes the live entry', ['deadHp', 'liveHp']],
    ['both duplicate entries are alive', ['liveHp', 'otherLiveHp']],
  ])('keeps the living goblin turn when %s', (_scenario, hpKeys) => {
    const state = {
      phase: 'combat',
      party: [{ id: 'matthias', hp: 7, agility: 5 }],
      liveHp: 4,
      deadHp: 0,
      otherLiveHp: 3,
    };
    const enemies = hpKeys.map((hpKey) => ({ id: 'goblin', hpKey, agility: 2 }));
    const initiative = chroniclesRollInitiative(state, enemies, { random: () => 0 });
    expect(initiative.order.map(({ kind, id }) => [kind, id])).toEqual([
      ['party', 'matthias'],
      ['enemy', 'goblin'],
    ]);

    // The next turn must use the same first living enemy as the roller,
    // even when a later duplicate points at zero HP in a legacy save.
    const next = chroniclesAdvanceCombatInitiative({ ...state, initiative }, enemies);
    expect(next.phase).toBe('combat');
    expect(next.initiative.order).toHaveLength(2);
    expect(chroniclesCurrentInitiativeActor(next.initiative)?.id).toBe('goblin');
    expect(next.initiative.round).toBe(1);

    const following = chroniclesAdvanceCombatInitiative(next, enemies);
    expect(chroniclesCurrentInitiativeActor(following.initiative)?.id).toBe('matthias');
    expect(following.initiative.round).toBe(2);
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

  it.each(['', '   ', null])('ends restored enemy-only initiative when every living hero has invalid id %s', (invalidId) => {
    const state = {
      phase: 'combat',
      party: [{ id: invalidId, hp: 7, agility: 5 }],
      goblinHp: 3,
      initiative: {
        version: 1, die: '1d8', round: 2, cursor: 0,
        order: [
          { id: invalidId, kind: 'party', initiative: 9 },
          { id: 'goblin', kind: 'enemy', initiative: 4 },
        ],
      },
    };
    const next = chroniclesAdvanceCombatInitiative(state, [{ id: 'goblin', hpKey: 'goblinHp' }]);
    expect(next.phase).toBe('defeated');
    expect(next.initiative).toBeNull();
    expect(next.turnPhase).toBe('party');
  });

  it('skips an invalid saved hero slot without stealing a valid enemy turn', () => {
    const state = {
      phase: 'combat',
      party: [
        { id: 'matthias', hp: 7, agility: 5 },
        { id: '  ', hp: 8, agility: 99 },
      ],
      goblinHp: 3,
      initiative: {
        version: 1, die: '1d8', round: 3, cursor: 0,
        order: [
          { id: 'matthias', kind: 'party', initiative: 10 },
          { id: '  ', kind: 'party', initiative: 9 },
          { id: 'goblin', kind: 'enemy', initiative: 4 },
        ],
      },
    };
    const enemies = [{ id: 'goblin', hpKey: 'goblinHp' }];
    const next = chroniclesAdvanceCombatInitiative(state, enemies);
    expect(next.phase).toBe('combat');
    expect(next.initiative.order.map(({ id }) => id)).toEqual(['matthias', 'goblin']);
    expect(chroniclesCurrentInitiativeActor(next.initiative)?.id).toBe('goblin');
    expect(next.initiative.round).toBe(3);
  });

  it('does not repeat a saved enemy turn forever when its initiative slot was duplicated', () => {
    const state = {
      phase: 'combat',
      party: [{ id: 'matthias', hp: 7 }],
      goblinHp: 3,
      initiative: {
        version: 1, die: '1d8', round: 4, cursor: 1,
        order: [
          { kind: 'party', id: 'matthias', initiative: 9 },
          { kind: 'enemy', id: 'goblin', initiative: 7 },
          { kind: 'enemy', id: 'goblin', initiative: 7 },
        ],
      },
    };
    const enemies = [{ id: 'goblin', hpKey: 'goblinHp' }];
    const next = chroniclesAdvanceCombatInitiative(state, enemies);
    expect(next.initiative.order.map(({ kind, id }) => [kind, id])).toEqual([
      ['party', 'matthias'], ['enemy', 'goblin'],
    ]);
    expect(next.initiative).toMatchObject({ round: 5, cursor: 0 });
    expect(chroniclesCurrentInitiativeActor(next.initiative)).toMatchObject({
      kind: 'party', id: 'matthias',
    });
    const following = chroniclesAdvanceCombatInitiative(next, enemies);
    expect(following.initiative).toMatchObject({ round: 5, cursor: 1 });
    expect(chroniclesCurrentInitiativeActor(following.initiative)).toMatchObject({
      kind: 'enemy', id: 'goblin',
    });
  });

  it('keeps hero and enemy IDs distinct when a restored duplicate is the current slot', () => {
    const state = {
      phase: 'combat',
      party: [{ id: 'shared', hp: 5 }],
      enemyHp: 4,
      initiative: {
        version: 1, die: '1d8', round: 2, cursor: 2,
        order: [
          { kind: 'enemy', id: 'shared', initiative: 9 },
          { kind: 'party', id: 'shared', initiative: 8 },
          { kind: 'enemy', id: 'shared', initiative: 9 },
        ],
      },
    };
    const next = chroniclesAdvanceCombatInitiative(state, [{ id: 'shared', hpKey: 'enemyHp' }]);
    expect(next.initiative.order.map(({ kind, id }) => [kind, id])).toEqual([
      ['enemy', 'shared'], ['party', 'shared'],
    ]);
    expect(next.initiative).toMatchObject({ round: 2, cursor: 1 });
    expect(chroniclesCurrentInitiativeActor(next.initiative)).toMatchObject({
      kind: 'party', id: 'shared',
    });
  });

});
