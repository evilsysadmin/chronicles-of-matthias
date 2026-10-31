import { describe, expect, it } from 'vitest';
import {
  chroniclesTacticsEffectiveProfile,
  chroniclesTacticsProfile,
} from './tacticsProfiles.js';

describe('Tactics class profiles (standalone boundary)', () => {
  it('preserves the four class attack patterns and powers', () => {
    expect(chroniclesTacticsProfile('matthias')).toMatchObject({ className: 'Espadachín', attackPattern: 'adjacent', damage: 2, abilityDamage: 4 });
    expect(chroniclesTacticsProfile('rook')).toMatchObject({ className: 'Guardiana', attackPattern: 'orthogonal', reach: 2, abilityDamage: 4 });
    expect(chroniclesTacticsProfile('bishop')).toMatchObject({ className: 'Taumaturgo', attackPattern: 'diagonal', abilityKind: 'heal', abilityHeal: 2 });
    expect(chroniclesTacticsProfile('knight')).toMatchObject({ className: 'Hostigador', attackPattern: 'line', reach: 3, abilityMaxTargets: 2 });
  });

  it('retains fallback class identity for unknown members', () => {
    expect(chroniclesTacticsProfile('unknown')).toMatchObject({ className: 'Aventurero', damage: 1, abilityDamage: 2 });
  });

  it('applies per-hero talent overrides without mutating frozen base profiles', () => {
    const base = chroniclesTacticsProfile('matthias');
    const state = { rpgModifiers: { matthias: { profileOverrides: { attackName: 'Estocada veterana', damage: 7 } } } };
    expect(Object.isFrozen(base)).toBe(true);
    expect(chroniclesTacticsEffectiveProfile(state, 'matthias')).toMatchObject({ attackName: 'Estocada veterana', damage: 7, className: 'Espadachín' });
    expect(chroniclesTacticsProfile('matthias')).toBe(base);
    expect(base).toMatchObject({ attackName: 'Estocada teutona', damage: 2 });
    expect(chroniclesTacticsEffectiveProfile({}, 'matthias')).toBe(base);
  });
});
