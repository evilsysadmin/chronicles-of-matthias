import { describe, expect, it } from 'vitest';
import {
  chroniclesContextualContentAction,
  chroniclesPartyArmorClass,
  chroniclesPartyAttackStats,
  chroniclesMM3EnemySwing,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from './chroniclesContentRuntime.js';
import {
  chroniclesEquipItem,
  chroniclesEquipmentBonuses,
  chroniclesEquippedItem,
  CHRONICLES_EQUIPMENT,
  CHRONICLES_ITEM_MATERIALS,
  chroniclesUnequipItem,
} from './chroniclesEquipment.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

function withGold(state, amount = 30) {
  return chroniclesApplyContentEffects(state, [{ type: 'grant-gold', amount }]);
}

describe('Chronicles First Book · real purchased gear', () => {
  it('composes base items with material attributes and honest shop prices, including jewelry extension', () => {
    expect(CHRONICLES_ITEM_MATERIALS.iron).toMatchObject({
      toHit: 1, damage: 2, armorClass: 1, valueMultiplier: 2,
    });
    expect(CHRONICLES_ITEM_MATERIALS.steel).toMatchObject({
      toHit: 3, damage: 6, armorClass: 4, valueMultiplier: 10,
    });
    expect(CHRONICLES_ITEM_MATERIALS.pearl.armorClass).toBe(2);
    expect(CHRONICLES_ITEM_MATERIALS.ivory).toMatchObject({
      extension: true, armorClass: 1,
    });
    expect(CHRONICLES_EQUIPMENT['roadwatch-sabre']).toMatchObject({
      materialId: 'iron', slot: 'weapon', toHitBonus: 2,
      attackDamageBonus: 3, price: 12,
    });
    expect(CHRONICLES_EQUIPMENT['roadwatch-vest']).toMatchObject({
      materialId: 'leather', slot: 'armor', armorType: 'leather', armorClassBonus: 3,
      damageReduction: 1, price: 9,
    });
  });

  it('charges gold at authored Swordhaven merchants, but a weapon in the bag grants no power', () => {
    const initial = withGold(createChroniclesState('swordhaven-first-book'), 21);
    const smith = { ...initial, x: 7, y: 4 };
    expect(chroniclesContextualContentAction(smith)?.id).toBe('first-book-weaponsmith');
    const counter = chroniclesReduce(smith, 'interact');
    expect(counter.shop?.id).toBe('first-book-weaponsmith');
    // The guard's iron sabre is not sold in the starting town: it is looted.
    expect(chroniclesReduce(counter, { type: 'shop-buy', itemId: 'roadwatch-sabre' })).toBe(counter);
    const bought = chroniclesApplyContentEffects(counter, [{
      type: 'grant-item', itemId: 'roadwatch-sabre', name: 'Sable de hierro de la guardia',
    }]);
    expect(chroniclesGoldBalance(bought)).toBe(21);
    expect(bought.inventory['roadwatch-sabre'].quantity).toBe(1);
    expect(chroniclesPartyAttackStats(bought, 'matthias').damage).toBe(
      chroniclesPartyAttackStats(initial, 'matthias').damage,
    );
    const equipped = chroniclesReduce(bought, {
      type: 'equip-item', memberId: 'matthias', itemId: 'roadwatch-sabre',
    });
    expect(equipped.inventory).not.toHaveProperty('roadwatch-sabre');
    expect(chroniclesPartyAttackStats(equipped, 'matthias').damage).toBe(
      chroniclesPartyAttackStats(initial, 'matthias').damage + 3,
    );
    expect(chroniclesPartyAttackStats(equipped, 'rook').damage).toBe(
      chroniclesPartyAttackStats(initial, 'rook').damage,
    );
    const recovered = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-first-book'),
      chroniclesRunCheckpointPayload(equipped, 4),
    );
    expect(chroniclesEquippedItem(recovered, 'matthias', 'weapon')?.id).toBe('roadwatch-sabre');
    expect(chroniclesPartyAttackStats(recovered, 'matthias').damage).toBe(
      chroniclesPartyAttackStats(initial, 'matthias').damage + 3,
    );
    expect(recovered.inventory).not.toHaveProperty('roadwatch-sabre');
    const unarmed = chroniclesUnequipItem(recovered, 'matthias', 'weapon');
    expect(unarmed.inventory['roadwatch-sabre'].quantity).toBe(1);
    expect(chroniclesPartyAttackStats(unarmed, 'matthias').damage).toBe(
      chroniclesPartyAttackStats(initial, 'matthias').damage,
    );
    expect(chroniclesUnequipItem(unarmed, 'matthias', 'weapon')).toBe(unarmed);
  });

  it('blocks duplicate ownership, missing stock, invalid item or class, and in-combat hot-swaps', () => {
    const initial = createChroniclesState('swordhaven-first-book');
    expect(chroniclesEquipItem(initial, 'matthias', 'roadwatch-sabre')).toBe(initial);
    const inventory = chroniclesApplyContentEffects(initial, [{
      type: 'grant-item', itemId: 'roadwatch-sabre', name: 'Sable de la guardia',
    }]);
    const refused = chroniclesEquipItem(inventory, 'bishop', 'roadwatch-sabre');
    expect(refused.inventory).toBe(inventory.inventory);
    expect(refused.equipment).toBe(inventory.equipment);
    expect(refused.message).toMatch(/no puede usar/);
    expect(chroniclesEquipItem(inventory, 'unknown', 'roadwatch-sabre')).toBe(inventory);
    expect(chroniclesEquipItem(inventory, 'matthias', 'unknown')).toBe(inventory);
    const equipped = chroniclesEquipItem(inventory, 'matthias', 'roadwatch-sabre');
    expect(chroniclesEquipItem(equipped, 'matthias', 'roadwatch-sabre')).toBe(equipped);
    expect(chroniclesEquipItem(equipped, 'rook', 'roadwatch-sabre')).toBe(equipped);
    expect(chroniclesEquipItem({ ...inventory, phase: 'combat' }, 'matthias', 'roadwatch-sabre'))
      .toEqual({ ...inventory, phase: 'combat' });
    expect(chroniclesEquipItem({ ...inventory, initiative: { order: [] } }, 'matthias', 'roadwatch-sabre'))
      .toEqual({ ...inventory, initiative: { order: [] } });
  });

  it('reduces actual retaliation after equipping armor, including after F5', () => {
    let state = withGold(createChroniclesState('swordhaven-first-book'), 9);
    state = chroniclesReduce({ ...state, x: 11, y: 4 }, 'interact');
    state = chroniclesReduce(state, { type: 'shop-buy', itemId: 'roadwatch-vest' });
    expect(chroniclesGoldBalance(state)).toBe(0);
    expect(state.inventory['roadwatch-vest'].quantity).toBe(1);
    expect(chroniclesEquipmentBonuses(state, 'matthias').damageReduction).toBe(0);
    const worn = chroniclesEquipItem(state, 'matthias', 'roadwatch-vest');
    expect(chroniclesEquipmentBonuses(worn, 'matthias').damageReduction).toBe(1);
    expect(worn.inventory).not.toHaveProperty('roadwatch-vest');
    const from = {
      ...createChroniclesState('banner-road-first-book'),
      inventory: worn.inventory, equipment: worn.equipment,
      x: 10, y: 5, direction: 1,
    };
    const withArmor = chroniclesReduce(from, { type: 'attack', memberId: 'matthias' });
    const withoutArmor = chroniclesReduce({ ...from, equipment: {} }, { type: 'attack', memberId: 'matthias' });
    expect(withArmor.party[0].hp).toBe(withoutArmor.party[0].hp + 1);
    const reloaded = chroniclesApplyRunCheckpoint(
      createChroniclesState('banner-road-first-book'),
      chroniclesRunCheckpointPayload(from, 3),
    );
    expect(chroniclesEquipmentBonuses(reloaded, 'matthias').damageReduction).toBe(1);
    expect(reloaded.inventory).not.toHaveProperty('roadwatch-vest');
    const removed = chroniclesUnequipItem(reloaded, 'matthias', 'armor');
    expect(removed.inventory['roadwatch-vest'].quantity).toBe(1);
    expect(chroniclesEquipmentBonuses(removed, 'matthias').damageReduction).toBe(0);
  });

  it('does not let a two-handed bow borrow a shield to hit or parry during its shot', () => {
    const initial = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const bare = {
      ...initial, equipment: { matthias: { weapon: 'brass-sword', missile: 'wooden-bow' } },
    };
    const shielded = {
      ...bare, equipment: { matthias: { ...bare.equipment.matthias, shield: 'bronze-shield' } },
    };
    const shield = CHRONICLES_EQUIPMENT['bronze-shield'];
    expect(chroniclesPartyAttackStats(shielded, 'matthias', 'melee').toHit)
      .toBe(chroniclesPartyAttackStats(bare, 'matthias', 'melee').toHit + shield.toHitBonus);
    expect(chroniclesPartyArmorClass(shielded, 'matthias'))
      .toBe(chroniclesPartyArmorClass(bare, 'matthias') + shield.armorClassBonus);
    expect(chroniclesPartyAttackStats(shielded, 'matthias', 'missile').toHit)
      .toBe(chroniclesPartyAttackStats(bare, 'matthias', 'missile').toHit);
    expect(chroniclesPartyArmorClass(shielded, 'matthias', { mode: 'missile' }))
      .toBe(chroniclesPartyArmorClass(bare, 'matthias'));
    const foe = { id: 'test-bow-retaliation', toHit: 8, retaliation: 2 };
    const swing = chroniclesMM3EnemySwing(shielded, foe, 'matthias', 'retaliation', 'missile');
    expect(swing.hit).toBe(chroniclesMM3EnemySwing(bare, foe, 'matthias', 'retaliation').hit);
    expect(chroniclesMM3EnemySwing(shielded, foe, 'matthias', 'retaliation').roll).toBe(swing.roll);

    const sling = {
      ...shielded, equipment: { matthias: { ...shielded.equipment.matthias, missile: 'brass-sling' } },
    };
    const slingBare = {
      ...sling, equipment: { matthias: { weapon: 'brass-sword', missile: 'brass-sling' } },
    };
    expect(chroniclesPartyAttackStats(sling, 'matthias', 'missile').toHit)
      .toBe(chroniclesPartyAttackStats(slingBare, 'matthias', 'missile').toHit + shield.toHitBonus);
    expect(chroniclesPartyArmorClass(sling, 'matthias', { mode: 'missile' }))
      .toBe(chroniclesPartyArmorClass(sling, 'matthias'));

    // Legacy mode must preserve its historical shield calculation.
    const legacy = { ...shielded, combatRules: 'legacy' };
    expect(chroniclesEquipmentBonuses(legacy, 'matthias', { mode: 'missile' }).toHitBonus)
      .toBe(chroniclesEquipmentBonuses(shielded, 'matthias', { mode: 'missile' }).toHitBonus + shield.toHitBonus);
  });

  it('lets MM3 classes, not hero names, decide gear and turns armor into real AC', () => {
    const initial = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const grant = chroniclesApplyContentEffects(initial, [
      { type: 'grant-item', itemId: 'roadwatch-sabre', name: 'Sable' },
      { type: 'grant-item', itemId: 'roadwatch-vest', name: 'Jubón' },
    ]);
    // Deliberate test setup: both items belong to Matthias until transferred.
    const stocked = { ...grant, bagOwners: { matthias: {
      'roadwatch-sabre': 1, 'roadwatch-vest': 1,
    } } };
    // Aziz is a Clérigo: blunt weapons only, so the sabre is refused.
    const cleric = chroniclesEquipItem(stocked, 'bishop', 'roadwatch-sabre');
    expect(cleric.equipment).toBe(stocked.equipment);
    expect(cleric.message).toMatch(/Clérigo/);
    // Faust is an Arquero: swords allowed.
    // First Book MM3 uses personal packs: Faust must receive the sword
    // before it can be worn. A sword in Matthias's bag is not his.
    expect(chroniclesEquipItem(stocked, 'knight', 'roadwatch-sabre')).toBe(stocked);
    const handed = chroniclesReduce(stocked, {
      type: 'transfer-item', memberId: 'matthias', toMemberId: 'knight', itemId: 'roadwatch-sabre',
    });
    const archer = chroniclesEquipItem(handed, 'knight', 'roadwatch-sabre');
    expect(chroniclesEquippedItem(archer, 'knight', 'weapon')?.id).toBe('roadwatch-sabre');
    expect(chroniclesPartyAttackStats(archer, 'knight').toHit)
      .toBe(chroniclesPartyAttackStats(stocked, 'knight').toHit + CHRONICLES_EQUIPMENT['roadwatch-sabre'].toHitBonus);
    // Guard-reinforced leather now adds 3 to the wearer's armor class.
    const worn = chroniclesEquipItem(stocked, 'matthias', 'roadwatch-vest');
    expect(chroniclesPartyArmorClass(worn, 'matthias')).toBe(chroniclesPartyArmorClass(stocked, 'matthias') + 3);
  });
});
