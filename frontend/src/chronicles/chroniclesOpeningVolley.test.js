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
import { applyChroniclesTacticsProgression, createChroniclesProgression, chroniclesKillXp } from '../chroniclesOfMatthiasProgression.js';

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
    expect(chroniclesPartyAttackStats(state, 'matthias', 'missile').reach).toBeGreaterThan(7);

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

  it('credits useful damage XP to the actual projectile owners and shares the kill only once', () => {
    const state = volleyCompany();
    const target = chroniclesOpeningVolleyShots(state).target;
    expect(target).toBeTruthy();
    const previous = { ...state, [target.hpKey]: 4 };
    const next = { ...previous, [target.hpKey]: 0, turns: previous.turns + 1 };
    const args = {
      actorMemberId: 'knight',
      actionKind: 'volley',
      volleyContributions: {
        enemyId: target.id,
        shots: [
          { memberId: 'matthias', damage: 2 },
          { memberId: 'knight', damage: 2 },
        ],
      },
      runId: 'mm3-volley-xp-regression',
    };
    const first = applyChroniclesTacticsProgression(createChroniclesProgression(), previous, next, args);
    const killShare = Math.ceil(chroniclesKillXp(target) / 4);
    expect(first.progression.heroes.matthias.xp).toBe(killShare + 1);
    expect(first.progression.heroes.knight.xp).toBe(killShare + 1);
    expect(first.progression.heroes.rook.xp).toBe(killShare);
    expect(first.progression.heroes.bishop.xp).toBe(killShare);
    // Replaying/checkpoint retry must not pay the same volley twice.
    const duplicate = applyChroniclesTacticsProgression(first.progression, previous, next, args);
    expect(duplicate.awards).toEqual([]);
  });

  it('does not conjure arrows without equipped legal ranged weapons, and refuses group fire inside initiative', () => {
    const base = volleyCompany();
    const state = { ...base, equipment: { bishop: { missile: 'wooden-bow' } } };
    const result = chroniclesReduce(state, { type: 'volley' });
    expect(result.message).toBe('Sin arma a distancia');
    expect(result.turns).toBe(state.turns);
    expect(result.party).toEqual(state.party);
    expect(chroniclesOpeningVolleyShooters({ ...base, initiative: { order: [] } })).toEqual([]);
    const inCombat = { ...base, initiative: { order: [] } };
    expect(chroniclesReduce(inCombat, { type: 'volley' })).toBe(inCombat);
  });
});
