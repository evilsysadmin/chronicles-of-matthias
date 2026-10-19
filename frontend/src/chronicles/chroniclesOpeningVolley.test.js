import { describe, expect, it } from 'vitest';
import {
  chroniclesEnemyTargetAhead,
  chroniclesOpeningVolleyShooters,
  chroniclesOpeningVolleyShots,
  chroniclesPartyAttackStats,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesEquippedItem } from './chroniclesEquipment.js';

function volleyCompany() {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  return {
    ...base, x: 10, y: 5, direction: 1,
    equipment: {
      matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' },
      rook: { weapon: 'bronze-mace', missile: 'wooden-bow' },
      bishop: { weapon: 'bronze-mace', missile: 'wooden-bow' },
      knight: { weapon: 'bronze-dagger', missile: 'wooden-bow' },
    },
  };
}

describe('Chronicles · MM3 opening company volley', () => {
  it('fires one independent projectile from each living class-legal armed member, without melee bonuses or individual retaliation', () => {
    const state = volleyCompany();
    const { target, shots, remainingHp } = chroniclesOpeningVolleyShots(state);
    expect(target).toBeTruthy();
    expect(chroniclesEnemyTargetAhead(state, 3)?.enemy.id).toBe(target.id);
    // Clerics cannot wield bows, despite a forged legacy slot.
    expect(chroniclesEquippedItem(state, 'bishop', 'missile')).toBeNull();
    expect(shots.map((shot) => shot.memberId)).toEqual(['matthias', 'rook', 'knight']);
    expect(shots.every((shot) => Number.isInteger(shot.roll) && shot.roll >= 1 && shot.roll <= 20)).toBe(true);
    expect(chroniclesOpeningVolleyShots(state)).toEqual(chroniclesOpeningVolleyShots(state));
    expect(chroniclesPartyAttackStats(state, 'matthias', 'melee').reach).toBe(1);
    expect(chroniclesPartyAttackStats(state, 'matthias', 'missile').reach).toBe(3);

    const next = chroniclesReduce(state, { type: 'volley' });
    expect(next[target.hpKey]).toBe(remainingHp);
    expect(next.turns).toBe(state.turns + 1);
    expect(next.party).toEqual(state.party);
    expect(next.initiative).toBeFalsy();
    expect(next.message).toContain('Salva de 3 proyectiles');
    expect(next.message).toContain('Faust');
    expect(next.message).not.toContain('Aziz:');
  });

  it('ignores incapacitated and unequipped characters, without borrowing their melee weapons', () => {
    const base = volleyCompany();
    const state = {
      ...base,
      equipment: { ...base.equipment, rook: { weapon: 'bronze-mace' } },
      party: base.party.map((member) => member.id === 'knight' ? { ...member, hp: 0 } : member),
    };
    expect(chroniclesOpeningVolleyShooters(state).map((m) => m.id)).toEqual(['matthias']);
    const result = chroniclesReduce(state, 'volley');
    expect(result.message).toMatch(/Salva de 1 proyectil/);
    expect(result.turns).toBe(state.turns + 1);
  });

  it('does not conjure arrows without equipped legal ranged weapons, and refuses group fire inside initiative', () => {
    const base = volleyCompany();
    const state = { ...base, equipment: { bishop: { missile: 'wooden-bow' } } };
    const result = chroniclesReduce(state, { type: 'volley' });
    expect(result.message).toMatch(/nadie lleva un arma de proyectiles/i);
    expect(result.party).toEqual(state.party);
    expect(chroniclesOpeningVolleyShooters({ ...base, initiative: { order: [] } })).toEqual([]);
    const inCombat = { ...base, initiative: { order: [] } };
    expect(chroniclesReduce(inCombat, { type: 'volley' })).toBe(inCombat);
  });
});
