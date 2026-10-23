import { describe, expect, it } from 'vitest';
import { chroniclesPartyArmorClass, chroniclesPartyAttackStats, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import {
  CHRONICLES_EQUIPMENT,
  CHRONICLES_EQUIPMENT_SLOTS,
  CHRONICLES_SHIELD_PROFILES,
  chroniclesEquipItem,
  chroniclesEquippedItem,
} from './chroniclesEquipment.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

function mm3Company(...itemIds) {
  const initial = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  return chroniclesApplyContentEffects(initial, itemIds.map((itemId) => ({
    type: 'grant-item', itemId, name: CHRONICLES_EQUIPMENT[itemId].name,
  })));
}

describe('Chronicles · MM3 equipment catalog', () => {
  it('forges every base item in its materials, with four slots: melee, missile, armour and shield', () => {
    expect(CHRONICLES_EQUIPMENT_SLOTS).toEqual(['weapon', 'missile', 'armor', 'shield']);
    for (const id of ['bronze-dagger', 'ivory-dagger', 'iron-sword', 'steel-axe', 'silver-mace', 'ivory-staff',
      'leather-padded', 'leather-leather', 'iron-chain', 'steel-plate', 'bronze-shield', 'ivory-shield']) {
      expect(CHRONICLES_EQUIPMENT[id], id).toBeTruthy();
    }
    // Leather never makes a blade; ivory is carved, never forged into plate.
    expect(CHRONICLES_EQUIPMENT['leather-sword']).toBeUndefined();
    expect(CHRONICLES_EQUIPMENT['ivory-plate']).toBeUndefined();
    expect(CHRONICLES_EQUIPMENT['steel-sword'].name).toBe('Espada de acero');
    // The authored First Book gear keeps its ids for saves and shops.
    expect(CHRONICLES_EQUIPMENT['roadwatch-sabre'].attackDamageBonus).toBe(3);
  });

  it('orders materials as in MM3: bronze < iron < steel in damage, armour and price', () => {
    const tiers = ['bronze', 'iron', 'steel'];
    const swords = tiers.map((m) => CHRONICLES_EQUIPMENT[`${m}-sword`]);
    const chains = tiers.map((m) => CHRONICLES_EQUIPMENT[`${m}-chain`]);
    for (let i = 1; i < tiers.length; i += 1) {
      expect(swords[i].attackDamageBonus).toBeGreaterThan(swords[i - 1].attackDamageBonus);
      expect(swords[i].price).toBeGreaterThan(swords[i - 1].price);
      expect(chains[i].armorClassBonus).toBeGreaterThan(chains[i - 1].armorClassBonus);
    }
    // MM3 quirk kept: light bronze hits easier than iron, but steel beats both.
    expect(swords[0].toHitBonus).toBeGreaterThan(swords[1].toHitBonus);
    expect(swords[2].toHitBonus).toBeGreaterThan(swords[0].toHitBonus);
    // Heavier armour protects more within one material.
    expect(CHRONICLES_EQUIPMENT['iron-plate'].armorClassBonus)
      .toBeGreaterThan(CHRONICLES_EQUIPMENT['iron-chain'].armorClassBonus);
    // No catalog weapon is worse than bare hands, and iron matches the guard's sabre.
    for (const item of Object.values(CHRONICLES_EQUIPMENT).filter((entry) => entry.slot === 'weapon')) {
      expect(item.attackDamageBonus, item.id).toBeGreaterThanOrEqual(0);
    }
    expect(CHRONICLES_EQUIPMENT['iron-sword'].attackDamageBonus)
      .toBe(CHRONICLES_EQUIPMENT['roadwatch-sabre'].attackDamageBonus);
    // A fresh company can afford bronze from one side quest; steel plate is an aspiration.
    expect(CHRONICLES_EQUIPMENT['bronze-sword'].price).toBeLessThanOrEqual(8);
    expect(CHRONICLES_EQUIPMENT['steel-plate'].price).toBeGreaterThan(300);
  });

  it('balances real starter shields against first-book enemy attacks without overbuffing them', () => {
    const expected = {
      wooden: [1, 0, 2], brass: [2, -1, 4], bronze: [2, 0, 6],
      iron: [3, -1, 16], ivory: [2, 1, 24], silver: [3, 1, 40],
      steel: [4, -1, 80],
    };
    for (const [material, [armorClass, toHit, price]] of Object.entries(expected)) {
      const shield = CHRONICLES_EQUIPMENT[`${material}-shield`];
      expect(CHRONICLES_SHIELD_PROFILES[material]).toEqual({ armorClass, toHit });
      expect([shield.armorClassBonus, shield.toHitBonus, shield.price]).toEqual([armorClass, toHit, price]);
      expect(shield.description).toContain(`armadura +${armorClass}`);
      if (toHit) expect(shield.description).toContain(`acierto ${toHit > 0 ? '+' : ''}${toHit}`);
    }
    expect(CHRONICLES_EQUIPMENT['leather-padded'].price).toBe(2);
    expect(CHRONICLES_EQUIPMENT['leather-leather'].price).toBe(3);
    expect(CHRONICLES_EQUIPMENT['roadwatch-vest'].armorClassBonus).toBe(3);
    expect(CHRONICLES_EQUIPMENT['roadwatch-vest'].price).toBe(9);
  });

  it('keeps cheap arms distinct against actual Swordhaven bandits instead of price-only clones', async () => {
    const { chroniclesMM3EnemyArmorClass, chroniclesMM3AttackHits } = await import('./chroniclesMM3Rules.js');
    const { chroniclesMapById } = await import('./chroniclesMapCatalog.js');
    const bandit = chroniclesMapById('swordhaven-first-book').enemies.find((e) => e.id === 'swordhaven-south-cutpurse');
    // The authored map starts at 4 HP, but the resolved enemy build adds +1 vigor.
    expect(bandit.maxHp).toBe(5);
    const ac = chroniclesMM3EnemyArmorClass(bandit);
    const attacks = (id) => {
      const equipped = chroniclesEquipItem(mm3Company(id), 'matthias', id);
      const stats = chroniclesPartyAttackStats(equipped, 'matthias');
      const hits = Array.from({ length: 20 }, (_, i) =>
        chroniclesMM3AttackHits(i + 1, stats.toHit, ac)).filter(Boolean).length;
      return { stats, hitPercent: hits * 5, turnsOnHit: Math.ceil(bandit.maxHp / Math.max(1, stats.damage)) };
    };
    const dagger = attacks('brass-dagger');
    const mace = attacks('brass-mace');
    const sword = attacks('brass-sword');
    const axe = attacks('brass-axe');
    expect(dagger.stats.toHit).toBeGreaterThan(sword.stats.toHit);
    expect(sword.stats.toHit).toBeGreaterThan(mace.stats.toHit);
    expect(axe.stats.damage).toBeGreaterThan(sword.stats.damage);
    expect(axe.stats.toHit).toBeLessThan(mace.stats.toHit);
    expect(dagger.hitPercent).toBeGreaterThan(axe.hitPercent);
    expect(axe.turnsOnHit).toBeLessThanOrEqual(dagger.turnsOnHit);
    // The sword should not be a strictly better mace for the SAME price.
    expect(CHRONICLES_EQUIPMENT['brass-dagger'].price).toBeLessThan(CHRONICLES_EQUIPMENT['brass-mace'].price);
    expect(CHRONICLES_EQUIPMENT['brass-mace'].price).toBeLessThan(CHRONICLES_EQUIPMENT['brass-sword'].price);
    // A spear gives actual two-tile melee reach at the cost of its shield hand.
    const spear = attacks('wooden-spear');
    const staff = attacks('wooden-staff');
    expect(spear.stats.reach).toBe(2);
    expect(staff.stats.reach).toBe(2);
    expect(CHRONICLES_EQUIPMENT['wooden-spear'].twoHanded).toBe(true);
  });

  it('trades ranged weapon range/damage/accuracy rather than cloning bows', () => {
    const bow = CHRONICLES_EQUIPMENT['wooden-bow'];
    const longbow = CHRONICLES_EQUIPMENT['wooden-longbow'];
    const crossbow = CHRONICLES_EQUIPMENT['brass-crossbow'];
    const sling = CHRONICLES_EQUIPMENT['wooden-sling'];
    expect(longbow.reach).toBeGreaterThan(bow.reach);
    expect(bow.attackDamageBonus).toBeGreaterThan(longbow.attackDamageBonus);
    expect(crossbow.toHitBonus).toBeGreaterThan(bow.toHitBonus);
    expect(crossbow.attackDamageBonus).toBeGreaterThan(longbow.attackDamageBonus);
    expect(sling.toHitBonus).toBeGreaterThan(bow.toHitBonus);
    expect(sling.reach).toBeLessThan(bow.reach);
    expect(sling.price).toBeLessThan(crossbow.price);
  });

  it('gates armour by class tier and shields by class and a free hand', () => {
    // Canonical company: matthias Caballero, rook Paladín, bishop Clérigo, knight Arquero.
    let state = mm3Company('steel-plate', 'iron-shield', 'iron-shield', 'iron-staff');
    state = chroniclesEquipItem(state, 'matthias', 'steel-plate');
    expect(chroniclesEquippedItem(state, 'matthias', 'armor')?.id).toBe('steel-plate');
    expect(chroniclesPartyArmorClass(state, 'matthias'))
      .toBe(chroniclesPartyArmorClass(mm3Company(), 'matthias') + CHRONICLES_EQUIPMENT['steel-plate'].armorClassBonus);
    // The archer may not carry a shield.
    const archer = chroniclesEquipItem(state, 'knight', 'iron-shield');
    expect(chroniclesEquippedItem(archer, 'knight', 'shield')).toBeNull();
    expect(archer.message).toMatch(/Arquero/);
    // The knight raises a shield, then takes up a two-handed staff: the shield goes back to the pack.
    state = chroniclesEquipItem(state, 'matthias', 'iron-shield');
    expect(chroniclesEquippedItem(state, 'matthias', 'shield')?.id).toBe('iron-shield');
    const shieldCount = state.inventory['iron-shield'].quantity;
    state = chroniclesEquipItem(state, 'matthias', 'iron-staff');
    expect(chroniclesEquippedItem(state, 'matthias', 'shield')).toBeNull();
    expect(state.inventory['iron-shield'].quantity).toBe(shieldCount + 1);
    expect(state.message).toMatch(/vuelve a la mochila/);
    // …and with a two-handed weapon in hand, the shield is refused.
    const refused = chroniclesEquipItem(state, 'matthias', 'iron-shield');
    expect(chroniclesEquippedItem(refused, 'matthias', 'shield')).toBeNull();
    expect(refused.message).toMatch(/mano libre/);
  });

  it('makes shield defensive/offensive tradeoffs effective against real early enemies', async () => {
    const { chroniclesMapById } = await import('./chroniclesMapCatalog.js');
    const { chroniclesMM3EnemyToHit, chroniclesMM3AttackHits } = await import('./chroniclesMM3Rules.js');
    const enemy = chroniclesMapById('swordhaven-first-book').enemies.find((e) => e.id === 'swordhaven-south-cutpurse');
    const toHit = chroniclesMM3EnemyToHit(enemy);
    // Equip a weapon first so the one-point accuracy penalty is observable
    // above the engine's minimum to-hit floor at character level 1.
    const initial = chroniclesEquipItem(
      mm3Company('wooden-shield', 'brass-shield', 'bronze-shield', 'bronze-sword'),
      'matthias', 'bronze-sword',
    );
    const wooden = chroniclesEquipItem(initial, 'matthias', 'wooden-shield');
    const brass = chroniclesEquipItem(initial, 'matthias', 'brass-shield');
    const bronze = chroniclesEquipItem(initial, 'matthias', 'bronze-shield');
    const baseAC = chroniclesPartyArmorClass(initial, 'matthias');
    for (const [state, ac, accuracy] of [[wooden, 1, 0], [brass, 2, -1], [bronze, 2, 0]]) {
      expect(chroniclesPartyArmorClass(state, 'matthias')).toBe(baseAC + ac);
      expect(chroniclesPartyAttackStats(state, 'matthias').toHit).toBe(
        chroniclesPartyAttackStats(initial, 'matthias').toHit + accuracy);
    }
    const hitRate = (armorClass) => Array.from({ length: 20 }, (_, roll) =>
      chroniclesMM3AttackHits(roll + 1, toHit, armorClass)).filter(Boolean).length;
    expect(hitRate(baseAC) - hitRate(baseAC + 1)).toBe(1);
    expect(hitRate(baseAC + 1) - hitRate(baseAC + 2)).toBe(1);
    // No extra damage reduction is granted under MM3; price buys dodge/aim.
  });

  it('turns material into real to-hit and damage, and survives a checkpoint with class rules', () => {
    let state = mm3Company('steel-sword', 'bronze-shield');
    const before = chroniclesPartyAttackStats(state, 'rook');
    state = chroniclesEquipItem(state, 'rook', 'steel-sword');
    state = chroniclesEquipItem(state, 'rook', 'bronze-shield');
    const after = chroniclesPartyAttackStats(state, 'rook');
    expect(after.toHit).toBe(before.toHit + CHRONICLES_EQUIPMENT['steel-sword'].toHitBonus);
    expect(after.damage).toBe(before.damage + CHRONICLES_EQUIPMENT['steel-sword'].attackDamageBonus);

    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
      chroniclesRunCheckpointPayload(state, 4),
    );
    expect(chroniclesEquippedItem(restored, 'rook', 'weapon')?.id).toBe('steel-sword');
    expect(chroniclesEquippedItem(restored, 'rook', 'shield')?.id).toBe('bronze-shield');
  });
});
