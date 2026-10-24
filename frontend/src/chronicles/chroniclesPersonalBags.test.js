import { describe, expect, it } from 'vitest';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointFingerprint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesEquipItem, chroniclesUnequipItem, chroniclesEquippedItem } from './chroniclesEquipment.js';
import {
  chroniclesBagInventoryEntries, chroniclesBagOwnership, chroniclesBagQuantity,
  chroniclesCanSharePartyLoot, chroniclesSharePartyLoot, chroniclesTransferBagItem,
} from './chroniclesPersonalBags.js';
import { createChroniclesState, chroniclesReduce } from '../chroniclesOfMatthias.js';

function stocked() {
  return chroniclesApplyContentEffects(createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }), [
    { type: 'grant-item', itemId: 'brass-sword', name: 'Espada de latón', quantity: 2 },
    { type: 'grant-item', itemId: 'brass-shield', name: 'Escudo de latón', quantity: 1 },
    { type: 'grant-gold', amount: 30 },
  ]);
}

describe('MM3 personal backpacks', () => {
  it('shares ownerless loot between personal bags without multiplying stock or gold', () => {
    const state = stocked();
    expect(chroniclesBagQuantity(state, 'matthias', 'brass-sword')).toBe(2);
    expect(chroniclesBagInventoryEntries(state, 'rook').map((i) => i.id)).toEqual(['brass-shield']);
    expect(chroniclesBagInventoryEntries(state, 'matthias').map((i) => i.id))
      .toEqual(['brass-sword']);
    expect(chroniclesBagQuantity(state, 'rook', 'brass-shield')).toBe(1);
    expect(state.inventory['crown-gold'].quantity).toBe(30);
    expect(chroniclesBagInventoryEntries(state, 'matthias').some((i) => i.id === 'crown-gold')).toBe(false);
  });

  it('places new unclaimed item types across all four bags while respecting explicit owners', () => {
    let state = stocked();
    state = chroniclesApplyContentEffects(state, [
      { type: 'grant-item', itemId: 'healing-potion', name: 'Poción', quantity: 3 },
      { type: 'grant-item', itemId: 'wooden-bow', name: 'Arco', quantity: 1 },
      { type: 'grant-item', itemId: 'quest-leaf', name: 'Hoja', quantity: 1 },
    ]);
    const bags = chroniclesBagOwnership(state);
    expect(Object.values(bags).filter((bag) => Object.keys(bag).length).length).toBe(4);
    for (const [itemId, item] of Object.entries(state.inventory)) {
      if (itemId === 'crown-gold') continue;
      expect(Object.values(bags).reduce((sum, bag) => sum + (bag[itemId] || 0), 0))
        .toBe(item.quantity);
    }
    const transferred = chroniclesTransferBagItem(state, 'matthias', 'rook', 'brass-sword');
    expect(chroniclesBagQuantity(transferred, 'rook', 'brass-sword')).toBe(1);
    expect(chroniclesBagQuantity(transferred, 'matthias', 'brass-sword')).toBe(1);
    // New gifts do not rewrite that already-persisted transfer.
    const earned = chroniclesApplyContentEffects(transferred,
      [{ type: 'grant-item', itemId: 'new-banner', name: 'Estandarte', quantity: 1 }]);
    expect(chroniclesBagQuantity(earned, 'rook', 'brass-sword')).toBe(1);
  });

  it('offers an explicit one-click redistribution for legacy Matthias-only bags', () => {
    const existing = {
      ...stocked(),
      bagOwners: { matthias: { 'brass-sword': 2, 'brass-shield': 1 } },
    };
    expect(chroniclesBagQuantity(existing, 'rook', 'brass-shield')).toBe(0);
    expect(chroniclesCanSharePartyLoot(existing)).toBe(true);
    const redistributed = chroniclesReduce(existing, { type: 'share-party-loot' });
    expect(redistributed).not.toBe(existing);
    expect(redistributed.inventory).toBe(existing.inventory);
    expect(redistributed.equipment).toBe(existing.equipment);
    expect(chroniclesBagQuantity(redistributed, 'matthias', 'brass-sword')).toBe(1);
    expect(chroniclesBagQuantity(redistributed, 'rook', 'brass-sword')).toBe(1);
    expect(chroniclesBagQuantity(redistributed, 'bishop', 'brass-shield')).toBe(1);
    expect(chroniclesCanSharePartyLoot(redistributed)).toBe(false);
    expect(redistributed.inventory['crown-gold'].quantity).toBe(30);
    const payload = chroniclesRunCheckpointPayload(redistributed, 7);
    const recovered = chroniclesApplyRunCheckpoint(
      createChroniclesState(existing.mapId, null, { rules: 'mm3' }), payload,
    );
    expect(chroniclesBagOwnership(recovered)).toEqual(chroniclesBagOwnership(redistributed));
    expect(chroniclesRunCheckpointFingerprint(recovered))
      .toBe(chroniclesRunCheckpointFingerprint(redistributed));
    expect(chroniclesSharePartyLoot({ ...existing, phase: 'combat' }))
      .toEqual({ ...existing, phase: 'combat' });
    expect(chroniclesSharePartyLoot({ ...existing, initiative: { order: [] } }))
      .toEqual({ ...existing, initiative: { order: [] } });
    expect(chroniclesReduce({ ...existing, combatRules: undefined }, { type: 'share-party-loot' }))
      .toEqual({ ...existing, combatRules: undefined });
  });

  it('transfers one actual copy, then equips and unequips it on the recipient only', () => {
    const initial = stocked();
    const changed = chroniclesReduce(initial, {
      type: 'transfer-item', memberId: 'matthias', toMemberId: 'rook', itemId: 'brass-sword',
    });
    expect(changed.inventory).toBe(initial.inventory);
    expect(chroniclesBagQuantity(changed, 'matthias', 'brass-sword')).toBe(1);
    expect(chroniclesBagQuantity(changed, 'rook', 'brass-sword')).toBe(1);
    const cannotTake = chroniclesEquipItem(changed, 'bishop', 'brass-sword');
    expect(cannotTake.equipment).toBe(changed.equipment);
    const worn = chroniclesEquipItem(changed, 'rook', 'brass-sword');
    expect(chroniclesEquippedItem(worn, 'rook', 'weapon')?.id).toBe('brass-sword');
    expect(worn.inventory['brass-sword'].quantity).toBe(1);
    expect(chroniclesBagQuantity(worn, 'rook', 'brass-sword')).toBe(0);
    expect(chroniclesBagQuantity(worn, 'matthias', 'brass-sword')).toBe(1);
    const returned = chroniclesUnequipItem(worn, 'rook', 'weapon');
    expect(chroniclesBagQuantity(returned, 'rook', 'brass-sword')).toBe(1);
    expect(returned.inventory['brass-sword'].quantity).toBe(2);
  });

  it('rejects invalid transfers, overdrawn bags and fighting-time trades', () => {
    const base = stocked();
    for (const action of [
      { toMemberId: 'rook', itemId: 'crown-gold' },
      { toMemberId: 'rook', itemId: 'brass-sword', quantity: 3 },
      { toMemberId: 'matthias', itemId: 'brass-sword' },
      { toMemberId: 'missing', itemId: 'brass-sword' },
    ]) {
      expect(chroniclesTransferBagItem(base, 'matthias', action.toMemberId, action.itemId, action.quantity)).toBe(base);
    }
    expect(chroniclesTransferBagItem({ ...base, initiative: { order: [] } }, 'matthias', 'rook', 'brass-sword'))
      .toEqual({ ...base, initiative: { order: [] } });
  });

  it('reconciles consumed or newly granted aggregate quantities without ghosts', () => {
    const given = chroniclesTransferBagItem(stocked(), 'matthias', 'rook', 'brass-sword');
    const consumed = chroniclesApplyContentEffects(given, [{ type: 'consume-item', itemId: 'brass-sword' }]);
    const owners = chroniclesBagOwnership(consumed);
    const total = Object.values(owners).reduce((sum, bag) => sum + (bag['brass-sword'] || 0), 0);
    expect(total).toBe(consumed.inventory['brass-sword'].quantity);
    const earned = chroniclesApplyContentEffects(given, [{ type: 'grant-item', itemId: 'brass-sword', name: 'Espada', quantity: 1 }]);
    // Existing transfers stay put. The new unowned copy goes to a less
    // stocked companion, never back into Matthias's already populated bag.
    expect(chroniclesBagQuantity(earned, 'matthias', 'brass-sword')).toBe(1);
    expect(chroniclesBagQuantity(earned, 'rook', 'brass-sword')).toBe(1);
    expect(chroniclesBagQuantity(earned, 'bishop', 'brass-sword')).toBe(1);
  });

  it('round-trips personal ownership in server flags, legacy saves default safely', () => {
    const taken = chroniclesTransferBagItem(stocked(), 'matthias', 'rook', 'brass-sword');
    const payload = chroniclesRunCheckpointPayload(taken, 2);
    expect(payload.worldFlags['__chrRuntime.bag.rook.brass-sword']).toBe(1);
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState(taken.mapId, null, { rules: 'mm3' }), payload,
    );
    expect(chroniclesBagQuantity(restored, 'rook', 'brass-sword')).toBe(1);
    expect(chroniclesBagQuantity(restored, 'matthias', 'brass-sword')).toBe(1);
    expect(chroniclesRunCheckpointFingerprint(restored)).toBe(chroniclesRunCheckpointFingerprint(taken));
    const legacy = chroniclesApplyRunCheckpoint(createChroniclesState(taken.mapId, null, { rules: 'mm3' }),
      { ...payload, worldFlags: Object.fromEntries(Object.entries(payload.worldFlags).filter(([key]) => !key.includes('.bag.'))) });
    expect(chroniclesBagQuantity(legacy, 'matthias', 'brass-sword')).toBe(2);
    expect(chroniclesBagQuantity(legacy, 'rook', 'brass-shield')).toBe(1);
  });
});
