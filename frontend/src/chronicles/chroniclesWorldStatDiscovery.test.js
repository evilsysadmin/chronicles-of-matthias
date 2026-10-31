import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesContextualContentAction } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression, applyChroniclesProgressionToTacticsState } from '../chroniclesOfMatthiasProgression.js';
import { chroniclesRunCheckpointPayload, chroniclesCheckpointRunProgression, chroniclesApplyRunCheckpoint } from './chroniclesRunCheckpoint.js';
import { chroniclesMM3WorldStatOffer, chroniclesClaimMM3WorldStat } from './chroniclesWorldStatDiscovery.js';
import { chroniclesContentInteractions } from './chroniclesContentRuntime.js';
import { chroniclesMapForState } from './chroniclesMapCatalog.js';

const SOURCE = 'swordhaven-endurance-crystal';
function atCrystal(progression = createChroniclesProgression()) {
  const initial = applyChroniclesProgressionToTacticsState(
    createChroniclesState('swordhaven-first-book', progression.characterBuild, { rules: 'mm3' }),
    progression,
  );
  return { ...initial, x: 9, y: 14, direction: 0, runProgression: progression };
}

describe('MM3 first real Swordhaven world-stat crystal', () => {
  it('exists on a walkable cell and offers a choice without silently spending the discovery', () => {
    const progression = createChroniclesProgression();
    const state = atCrystal(progression);
    expect(chroniclesContextualContentAction(state)?.id).toBe(SOURCE);
    expect(chroniclesMM3WorldStatOffer(state)).toEqual(expect.objectContaining({
      id: SOURCE, stat: 'endurance',
    }));
    expect(state.runProgression.claimedWorldStatSources).toEqual([]);
    expect(state.swordhavenEnduranceCrystalClaimed).not.toBe(true);
    expect(chroniclesMM3WorldStatOffer({ ...state, x: 9, y: 15 })).toBeNull();
    expect(chroniclesMM3WorldStatOffer({ ...state, initiative: { cursor: 0 } })).toBeNull();
    expect(chroniclesMM3WorldStatOffer({ ...state, combatRules: null })).toBeNull();
    const tactics = { ...state, combatRules: null };
    const map = chroniclesMapForState(tactics);
    expect(chroniclesContentInteractions(tactics, map, (cx, cy) => map.grid[cy]?.[cx])
      .some((entry) => entry.id === SOURCE)).toBe(false);
  });

  it('awards the explicitly selected living hero exactly once, without healing, XP or Tactics points', () => {
    const progression = createChroniclesProgression();
    const state = atCrystal(progression);
    const original = state.party.find(({ id }) => id === 'rook');
    const rejected = chroniclesClaimMM3WorldStat(state, progression, SOURCE, 'invalid');
    expect(rejected.granted).toBe(false);
    expect(rejected.state).toBe(state);
    expect(chroniclesClaimMM3WorldStat(state, progression, SOURCE, 'matthias',).granted).toBe(true);
    expect(chroniclesClaimMM3WorldStat({ ...state, party: state.party.map((hero) =>
      hero.id === 'rook' ? { ...hero, hp: 0 } : hero,
    ) }, progression, SOURCE, 'rook').granted).toBe(false);
    const awarded = chroniclesClaimMM3WorldStat(state, progression, SOURCE, 'rook');
    expect(awarded.granted).toBe(true);
    const rook = awarded.state.party.find(({ id }) => id === 'rook');
    expect(rook.mm3.stats.endurance).toBe(original.mm3.stats.endurance + 1);
    expect(rook.mm3.worldBonuses.endurance).toBe(1);
    expect(rook.characterBuild.stats.endurance).toBe(original.characterBuild.stats.endurance);
    expect(rook.hp).toBe(original.hp);
    expect(awarded.progression.heroes.rook.xp).toBe(0);
    expect(awarded.progression.heroes.rook.attributes).toEqual(progression.heroes.rook.attributes);
    expect(awarded.progression.claimedWorldStatSources).toEqual([SOURCE]);
    expect(awarded.state.swordhavenEnduranceCrystalClaimed).toBe(true);
    expect(chroniclesMM3WorldStatOffer(awarded.state)).toBeNull();
    expect(chroniclesClaimMM3WorldStat(awarded.state, awarded.progression, SOURCE, 'bishop').granted).toBe(false);
    // The ledger blocks a second claim even if a corrupted runtime flag is absent.
    const missingFlag = { ...state, runProgression: awarded.progression };
    expect(chroniclesClaimMM3WorldStat(missingFlag, awarded.progression, SOURCE, 'matthias').granted).toBe(false);
  });

  it('survives a server checkpoint and never respawns for another hero after F5', () => {
    const progression = createChroniclesProgression();
    const result = chroniclesClaimMM3WorldStat(atCrystal(progression), progression, SOURCE, 'rook');
    expect(result.granted).toBe(true);
    const payload = chroniclesRunCheckpointPayload(result.state, 0);
    expect(payload.worldFlags.swordhavenEnduranceCrystalClaimed).toBe(true);
    const runProgression = chroniclesCheckpointRunProgression(payload);
    expect(runProgression.claimedWorldStatSources).toContain(SOURCE);
    const initial = atCrystal(runProgression);
    const rehydrated = chroniclesApplyRunCheckpoint(initial, payload);
    expect(rehydrated.swordhavenEnduranceCrystalClaimed).toBe(true);
    expect(chroniclesMM3WorldStatOffer(rehydrated)).toBeNull();
    expect(chroniclesClaimMM3WorldStat(rehydrated, runProgression, SOURCE, 'matthias').granted).toBe(false);
    expect(runProgression.heroes.rook.mm3WorldBonuses.endurance).toBe(1);
  });
});
