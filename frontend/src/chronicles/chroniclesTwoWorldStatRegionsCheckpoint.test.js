import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  applyChroniclesProgressionToTacticsState,
  createChroniclesProgression,
} from '../chroniclesOfMatthiasProgression.js';
import { chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import {
  chroniclesClaimMM3WorldStat,
  chroniclesMM3WorldStatOffer,
} from './chroniclesWorldStatDiscovery.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesCheckpointRunProgression,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const SWORDHAVEN = 'swordhaven-endurance-crystal';
const ROOKWOOD = 'rookwood-memory-crystal';
const hero = (state, id) => state.party.find((member) => member.id === id);

describe('MM3 world-stat discoveries across regions and a checkpoint', () => {
  it('keeps both distinct awards and their one-use receipts after returning to each region', () => {
    const progression = createChroniclesProgression();
    const initial = applyChroniclesProgressionToTacticsState(
      createChroniclesState('swordhaven-first-book', progression.characterBuild, { rules: 'mm3' }),
      progression,
    );
    const first = { ...initial, x: 9, y: 14, direction: 0, runProgression: progression };
    expect(chroniclesMM3WorldStatOffer(first)?.id).toBe(SWORDHAVEN);
    const endurance = chroniclesClaimMM3WorldStat(first, progression, SWORDHAVEN, 'rook');
    expect(endurance.granted).toBe(true);

    const rookwood = {
      ...chroniclesMapTransitionState(endurance.state, 'rookwood-first-book'),
      x: 18, y: 11, direction: 0,
    };
    expect(chroniclesMM3WorldStatOffer(rookwood)?.id).toBe(ROOKWOOD);
    const intellect = chroniclesClaimMM3WorldStat(
      rookwood, endurance.progression, ROOKWOOD, 'bishop',
    );
    expect(intellect.granted).toBe(true);
    expect(intellect.progression.claimedWorldStatSources).toEqual([SWORDHAVEN, ROOKWOOD]);
    expect(hero(intellect.state, 'rook').mm3.worldBonuses.endurance).toBe(1);
    expect(hero(intellect.state, 'bishop').mm3.worldBonuses.intellect).toBe(1);

    // Persist the combined ledger and floor-local flags via the Go/Mongo-shaped
    // checkpoint, rather than a JSON clone of the live reducer state.
    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(intellect.state, 1)));
    const savedProgression = chroniclesCheckpointRunProgression(payload);
    expect(savedProgression.claimedWorldStatSources).toEqual([SWORDHAVEN, ROOKWOOD]);
    const resumed = chroniclesApplyRunCheckpoint(
      createChroniclesState('rookwood-first-book', null, { rules: 'mm3' }), payload,
    );
    expect(resumed.runProgression.claimedWorldStatSources).toEqual([SWORDHAVEN, ROOKWOOD]);
    expect(hero(resumed, 'rook').mm3.worldBonuses.endurance).toBe(1);
    expect(hero(resumed, 'bishop').mm3.worldBonuses.intellect).toBe(1);
    expect(chroniclesMM3WorldStatOffer({ ...resumed, x: 18, y: 11, direction: 0 })).toBeNull();

    const back = {
      ...chroniclesMapTransitionState(resumed, 'swordhaven-first-book'),
      x: 9, y: 14, direction: 0,
    };
    expect(back.swordhavenEnduranceCrystalClaimed).toBe(true);
    expect(chroniclesMM3WorldStatOffer(back)).toBeNull();
    expect(chroniclesClaimMM3WorldStat(back, back.runProgression, SWORDHAVEN, 'knight').granted)
      .toBe(false);
    const revisit = {
      ...chroniclesMapTransitionState(back, 'rookwood-first-book'),
      x: 18, y: 11, direction: 0,
    };
    expect(revisit.rookwoodMemoryCrystalClaimed).toBe(true);
    expect(chroniclesMM3WorldStatOffer(revisit)).toBeNull();
    expect(chroniclesClaimMM3WorldStat(revisit, revisit.runProgression, ROOKWOOD, 'knight').granted)
      .toBe(false);
  });
});
