import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';

function stockedSewers() {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  return chroniclesApplyContentEffects({ ...base, x: 1, y: 5, direction: 1 }, [
    { type: 'grant-item', itemId: 'brass-sword', name: 'Espada de latón', quantity: 2 },
    { type: 'grant-item', itemId: 'brass-shield', name: 'Escudo de latón', quantity: 1 },
  ]);
}

function equippedSword(state) {
  const equipped = chroniclesReduce(state, {
    type: 'equip-item', memberId: 'matthias', itemId: 'brass-sword',
  });
  expect(equipped).not.toBe(state);
  return equipped;
}

function legacySingleBag(state) {
  return {
    ...state,
    bagOwners: { matthias: { 'brass-sword': 2, 'brass-shield': 1 } },
  };
}

const INVENTORY_ACTIONS = [
  ['equip', (state) => state, { type: 'equip-item', memberId: 'matthias', itemId: 'brass-sword' }],
  ['unequip', equippedSword, { type: 'unequip-item', memberId: 'matthias', slot: 'weapon' }],
  ['transfer loose', (state) => state, {
    type: 'transfer-item', memberId: 'matthias', toMemberId: 'rook', itemId: 'brass-sword',
  }],
  ['transfer worn', equippedSword, {
    type: 'transfer-equipped-item', memberId: 'matthias', toMemberId: 'rook', slot: 'weapon',
  }],
  ['discard', (state) => state, { type: 'drop-item', memberId: 'matthias', itemId: 'brass-sword' }],
  ['redistribute', legacySingleBag, { type: 'share-party-loot' }],
];

function realSewerFight(state) {
  const goblin = chroniclesActiveEnemies(state).find((enemy) => enemy.id === 'sewers-goblin-west');
  expect(goblin).toBeTruthy();
  const combat = chroniclesStartInitiativeCombat(state, [goblin], {
    forceEnemyIds: [goblin.id], random: () => 0,
  });
  expect(combat.phase).toBe('combat');
  return combat;
}

describe('MM3 inventory mutations stay outside real combat initiative', () => {
  it.each(INVENTORY_ACTIONS)('%s remains available during exploration', (_label, prepare, action) => {
    const state = prepare(stockedSewers());
    expect(state.phase).toBe('explore');
    expect(state.initiative).toBeFalsy();
    expect(chroniclesReduce(state, action)).not.toBe(state);
  });

  it.each(INVENTORY_ACTIONS)('%s is inert on both hero and enemy initiative slots', (_label, prepare, action) => {
    const combat = realSewerFight(prepare(stockedSewers()));
    for (const kind of ['party', 'enemy']) {
      const cursor = combat.initiative.order.findIndex((actor) => actor.kind === kind);
      expect(cursor).toBeGreaterThanOrEqual(0);
      const state = { ...combat, initiative: { ...combat.initiative, cursor } };
      // Direct/stale dispatch must preserve equipment, bags, stock and turn cursor.
      expect(chroniclesReduce(state, action)).toBe(state);
    }
  });
});
