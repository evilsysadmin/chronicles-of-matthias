import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  applyChroniclesProgressionToTacticsState,
  createChroniclesProgression,
  grantChroniclesMM3WorldStat,
  reconcileChroniclesProgressionInTacticsState,
} from '../chroniclesOfMatthiasProgression.js';

describe('MM3 world discoveries · clamped low-Might attack damage', () => {
  it('does not manufacture damage when a negative Might bonus improves below the damage floor', () => {
    const base = createChroniclesProgression();
    const build = {
      ...base.characterBuild,
      mode: 'custom',
      characters: base.characterBuild.characters.map((character) => (
        character.slotId === 'matthias'
          ? { ...character, classId: 'cleric', stats: { ...character.stats, might: 6, personality: 15 } }
          : character
      )),
    };
    const initial = applyChroniclesProgressionToTacticsState(
      createChroniclesState('swordhaven-first-book', build, { rules: 'mm3' }), base,
    );
    const before = initial.party.find(({ id }) => id === 'matthias');
    expect(before.mm3.stats.might).toBe(6);
    expect(before.mm3.bonuses.might).toBe(-3);
    expect(before.damage).toBe(1);

    const awarded = grantChroniclesMM3WorldStat(base, 'matthias', 'might', 'low-might-crystal');
    expect(awarded.granted).toBe(true);
    const after = reconcileChroniclesProgressionInTacticsState(initial, awarded.progression);
    const hero = after.party.find(({ id }) => id === 'matthias');
    expect(hero.mm3.stats.might).toBe(7);
    expect(hero.mm3.bonuses.might).toBe(-2);
    // Template damage 1 + Might modifier -2 is still clamped to 1.
    expect(hero.damage).toBe(1);
    expect(reconcileChroniclesProgressionInTacticsState(after, awarded.progression)
      .party.find(({ id }) => id === 'matthias').damage).toBe(1);
  });
});
