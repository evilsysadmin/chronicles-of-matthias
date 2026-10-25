import { describe, expect, it } from 'vitest';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesAdvanceInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesEnemyInitiativeAgility,
  chroniclesEngagedEnemies,
  chroniclesPartyInitiativeAgility,
  chroniclesRollInitiative,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';

function sequence(values) {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe('Chronicles initiative', () => {
  it('rolls AGI + 1d8 for every living combatant and sorts highest first', () => {
    const state = {
      party: [
        { id: 'fast', name: 'Fast', hp: 4, agility: 5 },
        { id: 'slow', name: 'Slow', hp: 4, agility: 2 },
        { id: 'down', name: 'Down', hp: 0, agility: 99 },
      ],
      enemyHp: 5,
      rpgModifiers: {},
    };
    const enemies = [{
      id: 'enemy',
      name: 'Enemy',
      hpKey: 'enemyHp',
      maxHp: 5,
      retaliation: 1,
      ai: { movement: 'hold' },
    }];

    const initiative = chroniclesRollInitiative(state, enemies, {
      random: sequence([0, 0.999, 0.5]),
    });

    expect(initiative.die).toBe('1d8');
    expect(initiative.order.map((actor) => [actor.id, actor.agility, actor.roll, actor.initiative])).toEqual([
      ['slow', 2, 8, 10],
      ['fast', 5, 1, 6],
      ['enemy', 1, 5, 6],
    ]);
  });

  it('keeps low-level order chaotic enough for a slower actor to beat a faster one', () => {
    const state = {
      party: [
        { id: 'agi-4', hp: 1, agility: 4 },
        { id: 'agi-6', hp: 1, agility: 6 },
      ],
      rpgModifiers: {},
    };
    const initiative = chroniclesRollInitiative(state, [], {
      random: sequence([0.999, 0]),
    });
    expect(initiative.order.map((actor) => actor.id)).toEqual(['agi-4', 'agi-6']);
    expect(initiative.order[0].initiative).toBe(12);
    expect(initiative.order[1].initiative).toBe(7);
  });

  it('ignores corrupt MM3 speed while preserving valid slow penalties and initiative order', () => {
    const party = [
      { id: 'matthias', hp: 7, agility: 4, mm3: { bonuses: { speed: 'broken' } } },
      { id: 'rook', hp: 7, agility: 5, mm3: { bonuses: { speed: Infinity } } },
      { id: 'bishop', hp: 7, agility: 6, mm3: { bonuses: { speed: -4 } } },
    ];
    const state = { party, rpgModifiers: { matthias: { initiativeBonus: 3 } } };

    expect(chroniclesPartyInitiativeAgility(state, party[0])).toBe(7);
    expect(chroniclesPartyInitiativeAgility(state, party[1])).toBe(5);
    expect(chroniclesPartyInitiativeAgility(state, party[2])).toBe(2);

    const rolled = chroniclesRollInitiative(state, [], { random: () => 0 });
    expect(rolled.order.map(({ id, agility, initiative }) => [id, agility, initiative])).toEqual([
      ['matthias', 7, 8],
      ['rook', 5, 6],
      ['bishop', 2, 3],
    ]);
  });

  it('adds progression AGI exactly once to the resolved party stat and advances by rounds', () => {
    const state = {
      party: [{ id: 'matthias', hp: 7, agility: 4 }],
      rpgModifiers: { matthias: { initiativeBonus: 3 } },
    };
    expect(chroniclesPartyInitiativeAgility(state, state.party[0])).toBe(7);
    // A stray caller-provided bonus must not stack the same AGI again.
    expect(chroniclesPartyInitiativeAgility(state, state.party[0], 3)).toBe(7);

    const initiative = chroniclesRollInitiative(state, [], {
      random: () => 0,
      partyAgilityBonuses: { matthias: 3 },
    });
    expect(chroniclesCurrentInitiativeActor(initiative)?.id).toBe('matthias');
    expect(initiative.order[0].agility).toBe(7);
    const next = chroniclesAdvanceInitiative(initiative);
    expect(next.cursor).toBe(0);
    expect(next.round).toBe(2);
  });

  it('enters combat only for engaged or explicitly attacked enemies and keeps the rolled order', () => {
    const state = {
      phase: 'explore',
      x: 2,
      y: 2,
      party: [{ id: 'matthias', name: 'Matthias', hp: 7, agility: 4 }],
      rpgModifiers: {},
      nearHp: 3,
      farHp: 3,
    };
    const enemies = [
      {
        id: 'near',
        name: 'Near',
        hpKey: 'nearHp',
        x: 2,
        y: 3,
        maxHp: 3,
        retaliation: 1,
        ai: { movement: 'hold', engageRange: 1 },
      },
      {
        id: 'far',
        name: 'Far',
        hpKey: 'farHp',
        x: 2,
        y: 6,
        maxHp: 3,
        retaliation: 1,
        ai: { movement: 'hold', engageRange: 1 },
      },
    ];

    const engaged = chroniclesStartInitiativeCombat(state, enemies, {
      random: sequence([0, 0]),
    });
    expect(engaged.phase).toBe('combat');
    expect(engaged.initiative.order.map((actor) => actor.id).sort()).toEqual(['matthias', 'near']);

    const forced = chroniclesStartInitiativeCombat(
      { ...state, y: 1 },
      enemies,
      { forceEnemyIds: ['far'], random: sequence([0, 0]) },
    );
    expect(forced.phase).toBe('combat');
    expect(forced.initiative.order.map((actor) => actor.id).sort()).toEqual(['far', 'matthias']);
  });

  it.each(['invalid-hp', NaN])('does not start party-only combat for an enemy with invalid HP (%s)', (enemyHp) => {
    const state = {
      phase: 'explore',
      x: 2, y: 2,
      party: [{ id: 'matthias', name: 'Matthias', hp: 7, agility: 4 }],
      enemyHp,
    };
    const enemy = {
      id: 'broken', name: 'Broken', hpKey: 'enemyHp',
      x: 2, y: 3, ai: { engageRange: 1, movement: 'hold' },
    };

    // Previously engagement treated NaN as alive (NaN <= 0 is false),
    // while the initiative roller discarded it (NaN > 0 is false).
    expect(chroniclesEngagedEnemies(state, [enemy])).toEqual([]);
    expect(chroniclesStartInitiativeCombat(state, [enemy], { random: () => 0 })).toBe(state);
  });

  it('never starts enemy-only initiative after the entire company has fallen', () => {
    const state = {
      phase: 'explore',
      x: 2, y: 2,
      party: [{ id: 'matthias', name: 'Matthias', hp: 0, agility: 4 }],
      enemyHp: 3,
    };
    const enemy = {
      id: 'enemy', name: 'Enemy', hpKey: 'enemyHp',
      x: 2, y: 3, ai: { engageRange: 1, movement: 'hold' },
    };

    // Both ordinary proximity and an explicitly forced encounter must leave
    // defeat handling to the reducer instead of trapping the player in combat.
    for (const options of [{ random: () => 0 }, { forceEnemyIds: ['enemy'], random: () => 0 }]) {
      expect(chroniclesStartInitiativeCombat(state, [enemy], options)).toBe(state);
    }
  });

  it.each(['defeated', 'escaped'])('never reopens a %s expedition via a forced encounter', (phase) => {
    const state = {
      phase,
      x: 2, y: 2,
      party: [{ id: 'matthias', name: 'Matthias', hp: 7, agility: 4 }],
      enemyHp: 3,
    };
    const enemy = {
      id: 'enemy', name: 'Enemy', hpKey: 'enemyHp',
      x: 2, y: 3, ai: { engageRange: 1, movement: 'hold' },
    };

    // Even a saved terminal state with living heroes must stay terminal.
    // Test both proximity and the explicit forceEnemyIds override.
    expect(chroniclesStartInitiativeCombat(state, [enemy], { random: () => 0 })).toBe(state);
    expect(chroniclesStartInitiativeCombat(state, [enemy], {
      forceEnemyIds: ['enemy'], random: () => 0,
    })).toBe(state);
  });

  it('continues after a fallen current actor instead of restarting the round', () => {
    const state = {
      phase: 'combat',
      party: [
        { id: 'a', hp: 4, agility: 4 },
        { id: 'b', hp: 0, agility: 3 },
      ],
      enemyHp: 4,
      initiative: {
        version: 1,
        die: '1d8',
        round: 3,
        cursor: 1,
        order: [
          { id: 'a', kind: 'party', name: 'A', agility: 4, roll: 4, initiative: 8 },
          { id: 'b', kind: 'party', name: 'B', agility: 3, roll: 4, initiative: 7 },
          { id: 'enemy', kind: 'enemy', name: 'Enemy', agility: 2, roll: 4, initiative: 6 },
        ],
      },
    };
    const next = chroniclesAdvanceCombatInitiative(state, [{ id: 'enemy', hpKey: 'enemyHp' }]);
    expect(next.initiative.order.map((actor) => actor.id)).toEqual(['a', 'enemy']);
    expect(chroniclesCurrentInitiativeActor(next.initiative)?.id).toBe('enemy');
    expect(next.initiative.round).toBe(3);
  });

  it.each([['enemy survives', 4], ['last enemy also falls', 0]])(
    'ends a wiped company in defeat when %s', (_scenario, enemyHp) => {
      const state = {
        phase: 'combat',
        party: [{ id: 'matthias', hp: 0, agility: 4 }],
        partyPositions: { matthias: { x: 2, y: 3 } },
        combatWard: { turns: 1 },
        enemyStatus: { enemy: { stunned: 1 } },
        enemyHp,
        initiative: {
          version: 1, die: '1d8', round: 2, cursor: 0,
          order: [
            { id: 'matthias', kind: 'party', initiative: 8 },
            { id: 'enemy', kind: 'enemy', initiative: 5 },
          ],
        },
      };
      const next = chroniclesAdvanceCombatInitiative(state, [{ id: 'enemy', hpKey: 'enemyHp' }]);
      expect(next.phase).toBe('defeated');
      expect(next.initiative).toBeNull();
      expect(next.partyPositions).toEqual({});
      expect(next.combatWard).toBeUndefined();
      expect(next.enemyStatus).toBeUndefined();
    },
  );

  it('drops defeated actors and returns to exploration when combat has no enemies left', () => {
    const state = {
      phase: 'combat',
      party: [{ id: 'matthias', hp: 7, agility: 4 }],
      enemyHp: 0,
      initiative: {
        version: 1,
        die: '1d8',
        round: 1,
        cursor: 0,
        order: [
          { id: 'matthias', kind: 'party', name: 'Matthias', agility: 4, roll: 4, initiative: 8 },
          { id: 'enemy', kind: 'enemy', name: 'Enemy', agility: 2, roll: 3, initiative: 5 },
        ],
      },
    };
    const next = chroniclesAdvanceCombatInitiative(state, [{ id: 'enemy', hpKey: 'enemyHp' }]);
    expect(next.phase).toBe('explore');
    expect(next.turnPhase).toBe('party');
    expect(next.initiative).toBeNull();
  });

  it('finishes combat without teleporting the exploration anchor to a hero tactical tile', () => {
    const state = {
      phase: 'combat',
      x: 1,
      y: 5,
      party: [{ id: 'matthias', hp: 4, agility: 4 }],
      partyPositions: { matthias: { x: 2, y: 4 } },
      enemyHp: 0,
      initiative: {
        version: 1,
        die: '1d8',
        round: 2,
        cursor: 0,
        order: [
          { id: 'matthias', kind: 'party', initiative: 8 },
          { id: 'enemy', kind: 'enemy', initiative: 5 },
        ],
      },
    };
    const next = chroniclesAdvanceCombatInitiative(state, [{ id: 'enemy', hpKey: 'enemyHp' }]);
    expect(next).toMatchObject({ x: 1, y: 5, phase: 'explore', partyPositions: {} });
    expect(next.initiative).toBeNull();
  });

  it('preserves enemy turns after a living party member and rolls into the next round', () => {
    const state = {
      phase: 'combat',
      party: [{ id: 'matthias', hp: 5 }],
      enemyHp: 4,
      initiative: {
        version: 1,
        die: '1d8',
        round: 2,
        cursor: 0,
        order: [
          { id: 'matthias', kind: 'party', initiative: 9 },
          { id: 'enemy', kind: 'enemy', initiative: 7 },
        ],
      },
    };
    const enemies = [{ id: 'enemy', hpKey: 'enemyHp' }];
    const enemyTurn = chroniclesAdvanceCombatInitiative(state, enemies);
    expect(chroniclesCurrentInitiativeActor(enemyTurn.initiative)?.id).toBe('enemy');
    expect(enemyTurn.initiative.round).toBe(2);
    const partyTurn = chroniclesAdvanceCombatInitiative(enemyTurn, enemies);
    expect(chroniclesCurrentInitiativeActor(partyTurn.initiative)?.id).toBe('matthias');
    expect(partyTurn.initiative.round).toBe(3);
  });

  it('skips a defeated enemy without forfeiting the next living enemy turn', () => {
    const state = {
      phase: 'combat',
      party: [{ id: 'matthias', hp: 5 }],
      defeatedHp: 0,
      survivingHp: 3,
      initiative: {
        version: 1,
        die: '1d8',
        round: 4,
        cursor: 0,
        order: [
          { id: 'matthias', kind: 'party', initiative: 9 },
          { id: 'defeated', kind: 'enemy', initiative: 8 },
          { id: 'surviving', kind: 'enemy', initiative: 7 },
        ],
      },
    };
    const next = chroniclesAdvanceCombatInitiative(state, [
      { id: 'defeated', hpKey: 'defeatedHp' },
      { id: 'surviving', hpKey: 'survivingHp' },
    ]);
    expect(next.phase).toBe('combat');
    expect(next.initiative.order.map((actor) => actor.id)).toEqual(['matthias', 'surviving']);
    expect(chroniclesCurrentInitiativeActor(next.initiative)?.id).toBe('surviving');
    expect(next.initiative.round).toBe(4);
  });

  it('keeps the current round when a leading enemy loses the party and leaves initiative', () => {
    // The lost enemy was the first actor. The next hero is still acting in
    // this round, even though the shortened order now wraps internally.
    const lost = {
      id: 'lost', name: 'Lost', hpKey: 'lostHp', x: 9, y: 17,
      ai: { engageRange: 2, attackReach: 1 },
    };
    const nearby = {
      id: 'nearby', name: 'Nearby', hpKey: 'nearbyHp', x: 1, y: 16,
      ai: { engageRange: 2, attackReach: 1 },
    };
    const state = {
      mapId: 'swordhaven-sewers',
      phase: 'combat',
      x: 1, y: 15,
      party: [{ id: 'matthias', hp: 5 }],
      lostHp: 5,
      nearbyHp: 5,
      initiative: {
        version: 1, die: '1d8', round: 3, cursor: 0,
        order: [
          { id: 'lost', kind: 'enemy', name: 'Lost', initiative: 10 },
          { id: 'matthias', kind: 'party', name: 'Matthias', initiative: 9 },
          { id: 'nearby', kind: 'enemy', name: 'Nearby', initiative: 8 },
        ],
      },
    };

    const next = chroniclesAdvanceCombatInitiative(state, [lost, nearby]);
    expect(next.phase).toBe('combat');
    expect(next.initiative.order.map((actor) => actor.id)).toEqual(['matthias', 'nearby']);
    expect(chroniclesCurrentInitiativeActor(next.initiative)?.id).toBe('matthias');
    expect(next.initiative.round).toBe(3);
  });

  it('treats nullable legacy agility as missing rather than overriding the enemy build with zero', () => {
    const enemy = {
      id: 'horse-thing',
      maxHp: 3,
      retaliation: 1,
      ai: { movement: 'knight-chase' },
    };
    expect(chroniclesEnemyInitiativeAgility({ ...enemy, agility: null })).toBe(4);
    expect(chroniclesEnemyInitiativeAgility({ ...enemy, agility: '' })).toBe(4);
    expect(chroniclesEnemyInitiativeAgility({ ...enemy, agility: '   ' })).toBe(4);
    expect(chroniclesEnemyInitiativeAgility({ ...enemy, agility: '\t\n' })).toBe(4);
    expect(chroniclesEnemyInitiativeAgility({ ...enemy, agility: 0 })).toBe(0);
    expect(chroniclesEnemyInitiativeAgility({ ...enemy, agility: ' 0 ' })).toBe(0);

    const rolled = chroniclesRollInitiative({
      party: [{ id: 'matthias', hp: 7, agility: 2 }],
      horseHp: 3,
    }, [{ ...enemy, hpKey: 'horseHp', agility: '   ' }], { random: () => 0 });
    expect(rolled.order.map(({ id, agility }) => [id, agility])).toEqual([
      ['horse-thing', 4],
      ['matthias', 2],
    ]);
  });

  it('derives legacy enemy AGI from movement when no authored AGI exists', () => {
    expect(chroniclesEnemyInitiativeAgility({
      id: 'horse-thing',
      maxHp: 3,
      retaliation: 1,
      ai: { movement: 'knight-chase' },
    })).toBe(4);
  });
});

describe('Chronicles combat engagement and leash', () => {
  // Real sewers map: row 17 is split by a wall at x=8.
  const tobias = { id: 'tobias', name: 'Tobías', hpKey: 'tobiasHp', x: 9, y: 17, ai: { engageRange: 2, attackReach: 1 } };
  const party = [{ id: 'matthias', name: 'Matthias', hp: 8, agility: 3 }];
  const base = { mapId: 'swordhaven-sewers', party, tobiasHp: 5, rpgModifiers: {}, phase: 'explore' };

  it('bounds invalid legacy attack reach while preserving valid engage distance', () => {
    // Sewer corridor has clear sightline between x=9 and x=11 on row 17.
    const state = { ...base, x: 11, y: 17 };
    const invalidReach = { ...tobias, ai: { engageRange: 2, attackReach: 'invalid' } };
    expect(chroniclesEngagedEnemies(state, [invalidReach]).map((enemy) => enemy.id)).toEqual(['tobias']);

    // Infinity in an old save must not turn a melee creature into a map-wide trigger.
    const unlimited = { ...tobias, ai: { attackReach: Infinity } };
    expect(chroniclesEngagedEnemies(state, [unlimited])).toEqual([]);
    expect(chroniclesEngagedEnemies({ ...state, x: 10 }, [unlimited]).map((enemy) => enemy.id)).toEqual(['tobias']);
  });

  it('does not start a fight through a wall', () => {
    const state = { ...base, x: 7, y: 17 };
    expect(chroniclesStartInitiativeCombat(state, [tobias], { random: () => 0 }).initiative).toBeFalsy();
  });

  it('starts a fight when the creature can see the party', () => {
    const state = { ...base, x: 11, y: 17 };
    const started = chroniclesStartInitiativeCombat(state, [tobias], { random: () => 0 });
    expect(started.initiative.order.map((actor) => actor.id)).toContain('tobias');
  });

  it('ends the fight when the creature has lost the party out of sight', () => {
    const order = [
      { kind: 'party', id: 'matthias', name: 'Matthias', initiative: 9 },
      { kind: 'enemy', id: 'tobias', name: 'Tobías', initiative: 4 },
    ];
    const state = { ...base, phase: 'combat', x: 1, y: 15, initiative: { order, cursor: 0, round: 3 } };
    const next = chroniclesAdvanceCombatInitiative(state, [tobias]);
    expect(next.initiative).toBeNull();
    expect(next.phase).toBe('explore');
  });

  it('does not prematurely end combat for a legacy enemy without a positive leash range', () => {
    const order = [
      { kind: 'party', id: 'matthias', name: 'Matthias', initiative: 9 },
      { kind: 'enemy', id: 'tobias', name: 'Tobías', initiative: 4 },
    ];
    const state = {
      ...base, phase: 'combat', x: 1, y: 15,
      initiative: { order, cursor: 0, round: 3 },
    };
    // The party is behind solid masonry and beyond a zero-range leash.
    // Missing, nullable and blank legacy fields must all preserve combat.
    for (const rawRange of [undefined, null, '', ' ', 0]) {
      const enemy = {
        ...tobias,
        ai: { attackReach: 1, ...(rawRange === undefined ? {} : { engageRange: rawRange }) },
      };
      const next = chroniclesAdvanceCombatInitiative(state, [enemy]);
      expect(next.phase).toBe('combat');
      expect(next.initiative.order.map((actor) => actor.id)).toEqual(['matthias', 'tobias']);
      expect(next.initiative.round).toBe(3);
    }
  });

  it('keeps fighting a creature that is still close', () => {
    const order = [
      { kind: 'party', id: 'matthias', name: 'Matthias', initiative: 9 },
      { kind: 'enemy', id: 'tobias', name: 'Tobías', initiative: 4 },
    ];
    const state = { ...base, phase: 'combat', x: 7, y: 17, initiative: { order, cursor: 0, round: 3 } };
    expect(chroniclesAdvanceCombatInitiative(state, [tobias]).initiative.order).toHaveLength(2);
  });
});
