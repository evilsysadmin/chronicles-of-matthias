import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  applyChroniclesProgressionToTacticsState,
  createChroniclesProgression,
  reconcileChroniclesProgressionInTacticsState,
} from '../chroniclesOfMatthiasProgression.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesCheckpointRunProgression,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';
import { chroniclesClaimMM3WorldStat, chroniclesMM3WorldStatOffer } from './chroniclesWorldStatDiscovery.js';

const SOURCE = 'swordhaven-endurance-crystal';
const rook = (state) => state.party.find(({ id }) => id === 'rook');

// Seed a valid level-one creator sheet and prior, distinct permanent discoveries.
// The last point must come from the actual Swordhaven crystal interaction.
function atCrystal(priorDiscoveries) {
  const base = createChroniclesProgression();
  const characterBuild = {
    ...base.characterBuild,
    mode: 'custom',
    characters: base.characterBuild.characters.map((character) => (
      character.slotId === 'rook'
        ? { ...character, stats: { ...character.stats, endurance: 18 } }
        : character
    )),
  };
  const progression = {
    ...base,
    characterBuild,
    heroes: {
      ...base.heroes,
      rook: {
        ...base.heroes.rook,
        mm3WorldBonuses: { ...base.heroes.rook.mm3WorldBonuses, endurance: priorDiscoveries },
      },
    },
    claimedWorldStatSources: Array.from(
      { length: priorDiscoveries }, (_, index) => `prior-endurance-${index}`,
    ),
  };
  const initial = applyChroniclesProgressionToTacticsState(
    createChroniclesState('swordhaven-first-book', characterBuild, { rules: 'mm3' }),
    progression,
  );
  return { ...initial, x: 9, y: 14, direction: 0, runProgression: progression };
}

describe('MM3 B6 · real world crystal crossing high attribute bands', () => {
  for (const [prior, beforeStat, afterStat, beforeBonus, afterBonus] of [
    [6, 24, 25, 5, 6],
    [11, 29, 30, 6, 7],
  ]) {
    it(`crosses Endurance ${beforeStat} → ${afterStat} once and survives a checkpoint`, () => {
      const state = atCrystal(prior);
      expect(chroniclesMM3WorldStatOffer(state)).toMatchObject({
        id: SOURCE, stat: 'endurance',
      });
      expect(rook(state).mm3.stats.endurance).toBe(beforeStat);
      expect(rook(state).mm3.bonuses.endurance).toBe(beforeBonus);

      const awarded = chroniclesClaimMM3WorldStat(
        state, state.runProgression, SOURCE, 'rook',
      );
      expect(awarded.granted).toBe(true);
      expect(rook(awarded.state).mm3.stats.endurance).toBe(afterStat);
      expect(rook(awarded.state).mm3.bonuses.endurance).toBe(afterBonus);
      expect(rook(awarded.state).maxHp).toBe(rook(state).maxHp + 1);
      expect(awarded.progression.claimedWorldStatSources).toContain(SOURCE);

      // The actual Go/Mongo-shaped checkpoint contains the run progression;
      // bootstrap the creator sheet before restoring the saved expedition.
      const payload = JSON.parse(JSON.stringify(
        chroniclesRunCheckpointPayload(awarded.state, 1),
      ));
      const saved = chroniclesCheckpointRunProgression(payload);
      expect(saved.claimedWorldStatSources).toContain(SOURCE);
      const bootstrapped = applyChroniclesProgressionToTacticsState(
        createChroniclesState(null, saved.characterBuild, { rules: 'mm3' }),
        saved,
      );
      const resumed = chroniclesApplyRunCheckpoint(bootstrapped, payload);
      expect(rook(resumed).mm3.stats.endurance).toBe(afterStat);
      expect(rook(resumed).mm3.bonuses.endurance).toBe(afterBonus);
      expect(rook(resumed).maxHp).toBe(rook(awarded.state).maxHp);
      expect(reconcileChroniclesProgressionInTacticsState(resumed, saved)
        .party.find(({ id }) => id === 'rook').maxHp).toBe(rook(resumed).maxHp);
      expect(chroniclesMM3WorldStatOffer({ ...resumed, x: 9, y: 14, direction: 0 }))
        .toBeNull();
      expect(chroniclesClaimMM3WorldStat(
        { ...resumed, x: 9, y: 14, direction: 0 }, saved, SOURCE, 'rook',
      ).granted).toBe(false);
    });
  }
});
