import { describe, expect, it } from 'vitest';
import { chroniclesPartyArmorClass, chroniclesPartyAttackStats, createChroniclesState } from '../chroniclesOfMatthias.js';
import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';
import { chroniclesShopEquipmentComparisons } from './chroniclesShopComparison.js';

const item = (id) => CHRONICLES_EQUIPMENT[id];
const memberPreview = (state, id, next) =>
  chroniclesShopEquipmentComparisons(state, item(next)).find((entry) => entry.memberId === id);
const metric = (entry, key) => entry.stats.find((stat) => stat.key === key);

describe('Chronicles shop · preview equipment against party', () => {
  const initial = () => createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });

  it('compares a weapon against each hero’s equipped gear using actual combat statistics', () => {
    const base = initial();
    const state = {
      ...base,
      equipment: {
        matthias: { weapon: 'bronze-sword' },
        rook: { weapon: 'wooden-mace' },
        bishop: { weapon: 'wooden-staff' },
        knight: { weapon: 'wooden-bow' },
      },
    };
    const next = memberPreview(state, 'matthias', 'brass-mace');
    expect(next.eligible).toBe(true);
    expect(next.current?.name).toBe(item('bronze-sword').name);
    expect(metric(next, 'toHit').before).toBe(chroniclesPartyAttackStats(state, 'matthias').toHit);
    expect(metric(next, 'damage').after).toBe(chroniclesPartyAttackStats({
      ...state, equipment: { ...state.equipment, matthias: { weapon: 'brass-mace' } },
    }, 'matthias').damage);
    expect(metric(next, 'damage').delta).toBe(metric(next, 'damage').after - metric(next, 'damage').before);
    expect(memberPreview(state, 'bishop', 'brass-sword')).toMatchObject({
      eligible: false,
      reason: 'Su clase no puede equiparlo',
      stats: [],
    });
    // The preview must not buy/equip, modify gold, or change the original state.
    expect(state.equipment.matthias.weapon).toBe('bronze-sword');
    expect(state.inventory).toEqual(base.inventory);
  });

  it('compares missile-slot bonuses and reach, not melee stats', () => {
    const state = {
      ...initial(),
      equipment: {
        matthias: { weapon: 'brass-sword', missile: 'wooden-bow' },
      },
    };
    const before = { ...state.equipment.matthias };
    const preview = memberPreview(state, 'matthias', 'wooden-longbow');
    expect(preview.eligible).toBe(true);
    expect(preview.current?.id).toBe('wooden-bow');
    expect(preview.stats.map((stat) => stat.key)).toEqual(['toHit', 'damage', 'reach']);
    expect(metric(preview, 'toHit').label).toBe('Acierto (bono)');
    expect(metric(preview, 'damage').label).toBe('Daño (bono)');
    expect(metric(preview, 'toHit').delta)
      .toBe(item('wooden-longbow').toHitBonus - item('wooden-bow').toHitBonus);
    expect(metric(preview, 'damage').delta)
      .toBe(item('wooden-longbow').attackDamageBonus - item('wooden-bow').attackDamageBonus);
    expect(metric(preview, 'reach').delta)
      .toBe(item('wooden-longbow').reach - item('wooden-bow').reach);
    expect(state.equipment.matthias).toEqual(before);
  });

  it('reflects the actual dagger precision vs axe damage and polearm reach', () => {
    const current = { ...initial(), equipment: { matthias: { weapon: 'brass-dagger' } } };
    const axe = memberPreview(current, 'matthias', 'brass-axe');
    const spear = memberPreview(current, 'matthias', 'wooden-spear');
    expect(metric(axe, 'toHit').delta).toBeLessThan(0);
    expect(metric(axe, 'damage').delta).toBeGreaterThan(0);
    expect(metric(spear, 'reach').delta).toBe(1);
    expect(current.equipment.matthias.weapon).toBe('brass-dagger');
  });

  it('warns about shields displaced by two-handed weapons and includes defensive losses', () => {
    const state = {
      ...initial(),
      equipment: { matthias: { weapon: 'bronze-sword', shield: 'iron-shield' } },
    };
    const next = memberPreview(state, 'matthias', 'wooden-staff');
    expect(next.eligible).toBe(true);
    expect(next.displacedShield?.id).toBe('iron-shield');
    expect(metric(next, 'armorClass').before).toBe(chroniclesPartyArmorClass(state, 'matthias'));
    expect(metric(next, 'armorClass').delta).toBeLessThan(0);
    expect(metric(next, 'damageReduction')).toBeUndefined();
    expect(state.equipment.matthias.shield).toBe('iron-shield');
  });

  it('shows both CA and actual accuracy tradeoffs for starter shields', () => {
    const state = {
      ...initial(),
      equipment: { matthias: { weapon: 'brass-sword', shield: 'wooden-shield' } },
    };
    const brass = memberPreview(state, 'matthias', 'brass-shield');
    expect(brass.stats.map((stat) => stat.key)).toEqual(['armorClass', 'toHit']);
    expect(metric(brass, 'armorClass').delta).toBe(1);
    expect(metric(brass, 'toHit').delta).toBe(-1);
    expect(metric(brass, 'toHit').label).toBe('Acierto');
    const bronze = memberPreview(state, 'matthias', 'bronze-shield');
    expect(bronze.stats.map((stat) => stat.key)).toEqual(['armorClass']);
    expect(metric(bronze, 'armorClass').delta).toBe(1);
    expect(state.equipment.matthias.shield).toBe('wooden-shield');
  });

  it('blocks the shield comparison while wielding two hands, as the equip action does', () => {
    const state = {
      ...initial(), equipment: { matthias: { weapon: 'wooden-staff' } },
    };
    const next = memberPreview(state, 'matthias', 'brass-shield');
    expect(next.eligible).toBe(false);
    expect(next.reason).toMatch(/dos manos/);
    expect(next.stats).toEqual([]);
  });

  it('shows only hit avoidance (CA) in MM3: damage reduction does not mitigate a landed blow', () => {
    const state = initial();
    const next = memberPreview(state, 'matthias', 'leather-padded');
    expect(next.current).toBeNull();
    expect(next.eligible).toBe(true);
    expect(next.stats.map((stat) => stat.key)).toEqual(['armorClass', 'toHit']);
    expect(metric(next, 'toHit').label).toBe('Acierto');
    expect(metric(next, 'toHit').delta).toBe(1);
    expect(metric(next, 'armorClass').label).toBe('Armadura (CA)');
    expect(metric(next, 'armorClass').delta).toBe(item('leather-padded').armorClassBonus);
    expect(metric(next, 'damageReduction')).toBeUndefined();
  });

  it('gives Odo a real CA-versus-precision choice without changing gold or gear', () => {
    const state = {
      ...initial(),
      equipment: { matthias: { weapon: 'brass-sword', armor: 'brass-scale' } },
    };
    const vest = memberPreview(state, 'matthias', 'roadwatch-vest');
    expect(vest.eligible).toBe(true);
    expect(vest.stats.map((stat) => stat.key)).toEqual(['armorClass', 'toHit']);
    expect(metric(vest, 'armorClass').delta).toBe(0);
    expect(metric(vest, 'toHit').delta).toBe(1);
    const ring = memberPreview(state, 'matthias', 'brass-ring');
    expect(metric(ring, 'armorClass').delta).toBe(1);
    expect(metric(ring, 'toHit')).toBeUndefined();
    expect(state.equipment.matthias.armor).toBe('brass-scale');
  });

  it('retains damage mitigation comparisons only in the legacy combat rules', () => {
    const state = { ...initial(), combatRules: 'legacy' };
    const armor = memberPreview(state, 'matthias', 'leather-padded');
    expect(armor.stats.map((stat) => stat.key)).toEqual(['armorClass', 'damageReduction']);
    expect(metric(armor, 'damageReduction').label).toBe('Reducción de daño');
    expect(metric(armor, 'damageReduction').delta).toBe(item('leather-padded').damageReduction);

    const shieldState = {
      ...state,
      equipment: { matthias: { weapon: 'bronze-sword', shield: 'iron-shield' } },
    };
    const twoHanded = memberPreview(shieldState, 'matthias', 'wooden-staff');
    expect(metric(twoHanded, 'damageReduction').delta).toBeLessThan(0);
  });

  it('handles already equipped, fallen and malformed previews without side effects', () => {
    const base = initial();
    const state = { ...base, equipment: { matthias: { weapon: 'brass-mace' } } };
    expect(memberPreview(state, 'matthias', 'brass-mace')).toMatchObject({
      alreadyEquipped: true, eligible: true, stats: [],
    });
    const fallen = { ...state, party: state.party.map((hero) => hero.id === 'matthias' ? { ...hero, hp: 0 } : hero) };
    expect(memberPreview(fallen, 'matthias', 'brass-mace').eligible).toBe(false);
    expect(chroniclesShopEquipmentComparisons(null, item('brass-mace'))).toEqual([]);
    expect(chroniclesShopEquipmentComparisons(state, null)).toEqual([]);
  });
});
