import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesPartyAttackStats } from '../chroniclesOfMatthias.js';
import { chroniclesGearAttackModes, chroniclesGearSwapPreview } from './chroniclesGearCompare.js';

function company() {
  const base = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  return {
    ...base,
    equipment: {
      ...base.equipment,
      matthias: { weapon: 'bronze-sword', missile: 'wooden-bow', shield: 'iron-shield' },
    },
  };
}

describe('Chronicles MM3 · ficha de doble arma (#134)', () => {
  it('distinguishes A/melee from S/projectiles using the real combat stats', () => {
    const state = company();
    const modes = chroniclesGearAttackModes(state, 'matthias');
    expect(modes.weapon).toEqual(chroniclesPartyAttackStats(state, 'matthias', 'melee'));
    expect(modes.missile).toEqual(chroniclesPartyAttackStats(state, 'matthias', 'missile'));
    expect(modes.weapon.reach).toBe(1);
    expect(modes.missile.reach).toBe(3);
    expect(modes.weapon.damage).not.toBe(0);
  });

  it('previews a missile weapon swap only for S and does not mutate the equipped weapon or inventory', () => {
    const state = company();
    const original = JSON.stringify(state);
    const melee = chroniclesGearAttackModes(state, 'matthias').weapon;
    const preview = chroniclesGearSwapPreview(state, 'matthias', 'bronze-sling');
    expect(preview.slot).toBe('missile');
    expect(preview.after).toEqual(chroniclesPartyAttackStats({
      ...state, equipment: { ...state.equipment,
        matthias: { ...state.equipment.matthias, missile: 'bronze-sling' } },
    }, 'matthias', 'missile'));
    expect(preview.delta.damage).toBe(preview.after.damage - preview.before.damage);
    expect(chroniclesGearAttackModes(state, 'matthias').weapon).toEqual(melee);
    expect(JSON.stringify(state)).toBe(original);
  });

  it('shows shield displacement for two-handed melee upgrades, not for missile weapons', () => {
    const state = company();
    const melee = chroniclesGearSwapPreview(state, 'matthias', 'iron-staff');
    expect(melee.slot).toBe('weapon');
    expect(melee.displacedShieldName).toBe('Escudo de hierro');
    expect(melee.armorClassDelta).toBeLessThan(0);
    const missile = chroniclesGearSwapPreview(state, 'matthias', 'wooden-bow');
    expect(missile.displacedShieldName).toBeNull();
    expect(missile.armorClassDelta).toBe(0);
  });

  it('refuses forbidden weapons and unavailable slots without inventing stats', () => {
    const state = company();
    expect(chroniclesGearSwapPreview(state, 'bishop', 'steel-sword')).toBeNull();
    expect(chroniclesGearSwapPreview(state, 'bishop', 'iron-crossbow')).toBeNull();
    expect(chroniclesGearSwapPreview(state, 'matthias', 'bronze-shield')).toBeNull();
    expect(chroniclesGearSwapPreview(state, 'nonexistent', 'bronze-sword')).toBeNull();
    expect(chroniclesGearSwapPreview({ ...state, combatRules: 'tactics' }, 'matthias', 'bronze-sword')).toBeNull();
  });

  it('does not conjure a usable ranged attack for a hero without missiles equipped', () => {
    const state = { ...company(), equipment: { ...company().equipment, matthias: { weapon: 'bronze-sword' } } };
    expect(chroniclesGearAttackModes(state, 'matthias').missile.reach).toBe(0);
    const preview = chroniclesGearSwapPreview(state, 'matthias', 'wooden-bow');
    expect(preview.before).toMatchObject({ damage: 0, reach: 0 });
    expect(preview.after.reach).toBeGreaterThan(0);
  });
});
