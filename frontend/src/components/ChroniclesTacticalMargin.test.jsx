import { describe, expect, it } from 'vitest';

import { chroniclesRetaliationLabel, chroniclesTargetReachLabel } from './ChroniclesTacticalMargin.jsx';

describe('ChroniclesTacticalMargin', () => {
  it('explains a visible bandit too far away to hit with A, without inventing a hit', () => {
    expect(chroniclesTargetReachLabel({ distance: 2 }, { meleeReach: 1, missileReach: 0 }))
      .toBe('FUERA DE ALCANCE · ACÉRCATE PARA ATACAR');
    expect(chroniclesTargetReachLabel({ distance: 2 }, { meleeReach: 1, missileReach: 4 }))
      .toBe('A: FUERA DE ALCANCE · S: A TIRO');
    expect(chroniclesTargetReachLabel({ distance: 1 }, { meleeReach: 1, missileReach: 0 })).toBeNull();
  });

  it('shows the real retaliation damage when the target can answer', () => {
    expect(chroniclesRetaliationLabel({ willRetaliate: true, retaliation: 2 })).toBe('REPRESALIA · 2 PV');
    expect(chroniclesRetaliationLabel({ willRetaliate: true, retaliation: 1 })).toBe('REPRESALIA · 1 PV');
  });

  it('keeps a compact safe label outside retaliation range', () => {
    expect(chroniclesRetaliationLabel({ willRetaliate: false, retaliation: 2 })).toBe('SIN REPRESALIA');
  });

  it('shows how hard the target hits during turn-based combat, never zero', () => {
    expect(chroniclesRetaliationLabel({ willRetaliate: true, retaliation: 0 }, { combat: true })).toBe('GOLPEA · 1 PV');
    expect(chroniclesRetaliationLabel({ willRetaliate: false, retaliation: 5 }, { combat: true })).toBe('GOLPEA · 5 PV');
  });
});
