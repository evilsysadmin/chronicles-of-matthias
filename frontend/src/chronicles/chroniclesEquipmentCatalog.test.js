import { describe, expect, it } from 'vitest';
import { chroniclesPartyArmorClass, chroniclesPartyAttackStats, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import {
  CHRONICLES_EQUIPMENT,
  CHRONICLES_EQUIPMENT_SLOTS,
  CHRONICLES_ARMOR_MATERIAL_AC,
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
    expect(CHRONICLES_EQUIPMENT['roadwatch-vest'].toHitBonus).toBe(1);
    expect(CHRONICLES_EQUIPMENT['leather-padded'].toHitBonus).toBe(1);
    expect(CHRONICLES_EQUIPMENT['leather-leather'].toHitBonus).toBe(0);
    expect(CHRONICLES_EQUIPMENT['brass-ring'].toHitBonus).toBe(0);
  });

  it('checks cloth versus leather/metal accuracy against an actual late opponent', async () => {
    const { chroniclesMapById } = await import('./chroniclesMapCatalog.js');
    const { chroniclesMM3AttackHits, chroniclesMM3EnemyArmorClass } = await import('./chroniclesMM3Rules.js');
    const enemy = chroniclesMapById('templo-corona-cripta').enemies
      .find((entry) => entry.id === 'templo-corona-cripta-jailer');
    const equipped = chroniclesEquipItem(mm3Company('brass-sword', 'leather-padded', 'leather-leather', 'brass-scale', 'roadwatch-vest'),
      'matthias', 'brass-sword');
    const cloth = chroniclesEquipItem(equipped, 'matthias', 'leather-padded');
    const leather = chroniclesEquipItem(equipped, 'matthias', 'leather-leather');
    const scale = chroniclesEquipItem(equipped, 'matthias', 'brass-scale');
    const vest = chroniclesEquipItem(equipped, 'matthias', 'roadwatch-vest');
    const chance = (state) => {
      const aim = chroniclesPartyAttackStats(state, 'matthias').toHit;
      const armorClass = chroniclesMM3EnemyArmorClass(enemy);
      return Array.from({ length: 20 }, (_, i) =>
        chroniclesMM3AttackHits(i + 1, aim, armorClass)).filter(Boolean).length;
    };
    expect(chance(cloth) - chance(leather)).toBe(1);
    expect(chance(vest) - chance(scale)).toBe(1);
    expect(chroniclesPartyArmorClass(leather, 'matthias'))
      .toBe(chroniclesPartyArmorClass(cloth, 'matthias') + 1);
    expect(chroniclesPartyArmorClass(vest, 'matthias'))
      .toBe(chroniclesPartyArmorClass(scale, 'matthias'));
    expect(CHRONICLES_EQUIPMENT['roadwatch-vest'].price)
      .toBeGreaterThan(CHRONICLES_EQUIPMENT['brass-scale'].price);
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


  it('no longer sells bronze armor that is strictly worse than cheaper brass armor', () => {
    const family = ['padded', 'leather', 'scale', 'ring', 'chain', 'splint', 'plate'];
    const metals = ['brass', 'bronze', 'iron', 'silver', 'steel'];
    expect(metals.map((m) => CHRONICLES_ARMOR_MATERIAL_AC[m])).toEqual([0, 1, 2, 3, 5]);
    for (const type of family) {
      for (let i = 1; i < metals.length; i += 1) {
        const cheaper = CHRONICLES_EQUIPMENT[`${metals[i - 1]}-${type}`];
        const upgraded = CHRONICLES_EQUIPMENT[`${metals[i]}-${type}`];
        if (!cheaper || !upgraded) continue;
        expect(upgraded.price, upgraded.id).toBeGreaterThan(cheaper.price);
        expect(upgraded.armorClassBonus, upgraded.id).toBeGreaterThan(cheaper.armorClassBonus);
        expect(upgraded.description, upgraded.id).toContain(`armadura +${upgraded.armorClassBonus}`);
      }
    }
    // Protect source MM3 material metadata: this is a world-specific armor
    // catalog fix, not a global change to bronze weapon damage or shield AC.
    expect(CHRONICLES_EQUIPMENT['bronze-scale'].armorClassBonus).toBe(4);
    expect(CHRONICLES_EQUIPMENT['brass-scale'].armorClassBonus).toBe(3);
    expect(CHRONICLES_EQUIPMENT['iron-scale'].armorClassBonus).toBe(5);
    expect(CHRONICLES_EQUIPMENT['steel-scale'].armorClassBonus).toBe(8);
  });

  it('checks armor choices against actual first-book and late enemy d20 attacks', async () => {
    const { chroniclesMM3AttackHits, chroniclesMM3EnemyToHit } = await import('./chroniclesMM3Rules.js');
    const { chroniclesMapById } = await import('./chroniclesMapCatalog.js');
    const scenarios = [
      ['swordhaven-first-book', 'swordhaven-south-cutpurse'],
      ['banner-road-first-book', 'banner-road-bandit-captain'],
      ['swordhaven-sewers', 'sewers-hound'],
      ['templo-corona-cripta', 'templo-corona-cripta-jailer'],
      ['guarida-del-dragon', 'guarida-del-dragon-foe-0'],
    ];
    const foes = scenarios.map(([mapId, enemyId]) => {
      const enemy = chroniclesMapById(mapId).enemies.find((entry) => entry.id === enemyId);
      expect(enemy, enemyId).toBeTruthy();
      return enemy;
    });
    const rate = (enemy, ac) => Array.from({ length: 20 }, (_, roll) =>
      chroniclesMM3AttackHits(roll + 1, chroniclesMM3EnemyToHit(enemy), ac))
      .filter(Boolean).length;

    const inventory = mm3Company('brass-scale', 'bronze-scale', 'iron-scale', 'steel-plate', 'steel-shield');
    const brass = chroniclesEquipItem(inventory, 'matthias', 'brass-scale');
    const bronze = chroniclesEquipItem(inventory, 'matthias', 'bronze-scale');
    const iron = chroniclesEquipItem(inventory, 'matthias', 'iron-scale');
    const plated = chroniclesEquipItem(
      chroniclesEquipItem(inventory, 'matthias', 'steel-plate'), 'matthias', 'steel-shield');
    const ac = (state) => chroniclesPartyArmorClass(state, 'matthias');
    expect([ac(brass), ac(bronze), ac(iron)]).toEqual([
      ac(inventory) + 3, ac(inventory) + 4, ac(inventory) + 5,
    ]);
    expect(ac(plated)).toBeGreaterThan(ac(iron));
    for (const enemy of foes) {
      // Better expensive armor really reduces hits; d20 natural-20 still
      // connects so an armored veteran cannot be literally untouchable.
      const rates = [inventory, brass, bronze, iron, plated].map((state) => rate(enemy, ac(state)));
      expect(rates.every((hits) => hits >= 1 && hits <= 19), enemy.id).toBe(true);
      expect(rates.slice(1).every((hits, index) => hits <= rates[index]), enemy.id).toBe(true);
    }
    // Endgame enemies must still be able to land more than natural 20
    // against a hypothetical fully armored *level-one* frontliner.
    for (const enemy of foes.slice(-2)) {
      expect(rate(enemy, ac(plated)), enemy.id).toBeGreaterThan(1);
    }
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
