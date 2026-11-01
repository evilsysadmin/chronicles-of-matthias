import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_PARTY,
  chroniclesPartyAttackStats,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import {
  applyChroniclesProgressionToTacticsState,
  createChroniclesProgression,
  reconcileChroniclesProgressionInTacticsState,
} from '../chroniclesOfMatthiasProgression.js';
import { createCanonicalChroniclesCharacterBuild } from './chroniclesCharacterBuilds.js';

const IDS = CHRONICLES_PARTY.map(({ id }) => id);
const STATS = {
  might: 15, intellect: 15, personality: 15, endurance: 15,
  speed: 15, accuracy: 15, luck: 15,
};

function fourKnights() {
  const canonical = createCanonicalChroniclesCharacterBuild(CHRONICLES_PARTY);
  return {
    ...canonical,
    mode: 'custom',
    characters: canonical.characters.map((character) => ({
      ...character, classId: 'knight', raceId: 'human', stats: { ...STATS },
    })),
  };
}

function attackDamage(state) {
  return IDS.map((id) => chroniclesPartyAttackStats(state, id, 'melee').damage);
}

describe('MM3 physical damage ignores the old chess-piece slot', () => {
  it('gives identical sheets equal unarmed and equipped damage, without changing Tactics', () => {
    const build = fourKnights();
    const mm3 = createChroniclesState('banner-road-first-book', build, { rules: 'mm3' });
    expect(mm3.party.map((hero) => hero.damage)).toEqual([3, 3, 3, 3]);
    expect(attackDamage(mm3)).toEqual([3, 3, 3, 3]);

    const equipped = {
      ...mm3,
      equipment: Object.fromEntries(IDS.map((id) => [id, { weapon: 'bronze-sword' }])),
    };
    expect(attackDamage(equipped)).toEqual([4, 4, 4, 4]);

    const tactics = createChroniclesState('banner-road-first-book', build);
    expect(tactics.party.map((hero) => hero.damage)).toEqual([1, 2, 1, 1]);
    expect(attackDamage(tactics)).toEqual([1, 2, 1, 1]);
  });

  it('normalizes old MM3 rook damage once across JSON restore and progression reconciliation', () => {
    const build = fourKnights();
    const legacy = JSON.parse(JSON.stringify(
      createChroniclesState('banner-road-first-book', build, { rules: 'mm3' }),
    ));
    // Older saved runtimes used the chess rook's base 2, not the MM3 base 1.
    legacy.party.forEach((hero, index) => {
      delete hero.mm3.damageProfileVersion;
      hero.damage = [3, 4, 3, 3][index];
    });
    expect(attackDamage(legacy)).toEqual([3, 3, 3, 3]);

    const progression = { ...createChroniclesProgression(), characterBuild: build };
    const restored = applyChroniclesProgressionToTacticsState(legacy, progression);
    expect(restored.party.map((hero) => hero.damage)).toEqual([3, 3, 3, 3]);
    expect(restored.party.every((hero) => hero.mm3.damageProfileVersion === 2)).toBe(true);
    expect(attackDamage(restored)).toEqual([3, 3, 3, 3]);

    const reconciled = reconcileChroniclesProgressionInTacticsState(
      JSON.parse(JSON.stringify(restored)), progression,
    );
    expect(reconciled.party.map((hero) => hero.damage)).toEqual([3, 3, 3, 3]);
    expect(attackDamage(reconciled)).toEqual([3, 3, 3, 3]);
  });

  it('does not subtract phantom damage from an old weak hero clamped to 1', () => {
    const legacy = createChroniclesState('banner-road-first-book', fourKnights(), { rules: 'mm3' });
    const rook = legacy.party.find((hero) => hero.id === 'rook');
    const oldRook = {
      ...rook,
      damage: 1,
      mm3: { ...rook.mm3, damageProfileVersion: undefined, bonuses: { ...rook.mm3.bonuses, might: -4 } },
    };
    const oldState = { ...legacy, party: legacy.party.map((hero) => hero.id === 'rook' ? oldRook : hero) };
    expect(chroniclesPartyAttackStats(oldState, 'rook', 'melee').damage).toBe(1);
  });
});
