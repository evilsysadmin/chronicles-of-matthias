import { describe, expect, it } from 'vitest';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointFingerprint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesEquipItem, chroniclesUnequipItem, chroniclesEquippedItem } from './chroniclesEquipment.js';
import { chroniclesBagInventoryEntries, chroniclesBagOwnership, chroniclesBagQuantity, chroniclesTransferBagItem } from './chroniclesPersonalBags.js';
import { createChroniclesState, chroniclesReduce } from '../chroniclesOfMatthias.js';

function stocked() {
  return chroniclesApplyContentEffects(createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }), [
    { type: 'grant-item', itemId: 'brass-sword', name: 'Espada de latón', quantity: 2 },
    { type: 'grant-item', itemId: 'brass-shield', name: 'Escudo de latón', quantity: 1 },
    { type: 'grant-gold', amount: 30 },
  ]);
}

describe('MM3 personal backpacks', () => {
  it('projects legacy loot onto Matthias without multiplying stock or gold', () => {
    const state = stocked();
    expect(chroniclesBagQuantity(state, 'matthias', 'brass-sword')).toBe(2);
    expect(chroniclesBagInventoryEntries(state, 'rook')).toEqual([]);
    expect(chroniclesBagInventoryEntries(state, 'matthias').map((i) => i.id))
      .toEqual(['brass-shield', 'brass-sword']);
    expect(state.inventory['crown-gold'].quantity).toBe(30);
    expect(chroniclesBagInventoryEntries(state, 'matthias').some((i) => i.id === 'crown-gold')).toBe(false);
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
    expect(chroniclesBagQuantity(earned, 'matthias', 'brass-sword')).toBe(2);
    expect(chroniclesBagQuantity(earned, 'rook', 'brass-sword')).toBe(1);
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
  });
});
