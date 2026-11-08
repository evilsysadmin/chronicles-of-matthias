import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesReduce } from '../chroniclesOfMatthias.js';
import {
  applyChroniclesTacticsProgression,
  chroniclesHeroProgress,
  createChroniclesProgression,
} from '../chroniclesOfMatthiasProgression.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const HERO_IDS = ['matthias', 'rook', 'bishop', 'knight'];
const RUN_ID = 'sewers-no-combat-xp-regression';

// Real First Book content and return gates, not fabricated empty maps.
function receiveSewerKey() {
  const town = chroniclesMapById('swordhaven-first-book');
  const mayor = town.interactables.find((entry) => entry.id === 'swordhaven-mayor');
  expect(mayor?.action?.effects).toBeTruthy();
  const met = chroniclesApplyContentEffects(
    createChroniclesState(town.id, null, { rules: 'mm3' }), mayor.action.effects,
  );
  expect(met.inventory?.['sewer-key']?.quantity).toBe(1);
  return { ...met, x: 13, y: 13 };
}

function applyXp(progression, before, next) {
  return applyChroniclesTacticsProgression(progression, before, next, {
    actorMemberId: 'matthias',
    actionKind: 'cross-area-threshold',
    runId: RUN_ID,
  });
}

describe('MM3 P0: transitioning maps is not killing their remaining enemies', () => {
  it('awards ZERO combat XP for the real key -> sewers -> immediate exit (or repetitions)', () => {
    let town = receiveSewerKey();
    let progress = createChroniclesProgression();

    for (let trip = 0; trip < 3; trip += 1) {
      const underground = chroniclesReduce(town, {
        type: 'cross-area-threshold', exitId: 'swordhaven-to-sewers',
      });
      expect(underground.mapId).toBe('swordhaven-sewers');
      const entered = applyXp(progress, town, underground);
      expect(entered.awards).toEqual([]);
      expect(entered.levelUps).toEqual([]);
      progress = entered.progression;

      // The authored return ladder is directly at the sewer entrance.
      const ladder = { ...underground, x: 1, y: 1 };
      const back = chroniclesReduce(ladder, {
        type: 'cross-area-threshold', exitId: 'sewers-to-swordhaven',
      });
      expect(back.mapId).toBe('swordhaven-first-book');
      const exited = applyXp(progress, ladder, back);
      expect(exited.awards).toEqual([]);
      expect(exited.levelUps).toEqual([]);
      progress = exited.progression;
      town = back;
    }

    for (const id of HERO_IDS) {
      expect(chroniclesHeroProgress(progress, id)).toMatchObject({ level: 1, xp: 0 });
    }
    expect(progress.claimedAwards).toEqual([]);
  });

  it('preserves real authored quest XP (40 per living hero) when a reward is earned', () => {
    const town = receiveSewerKey();
    const mayorReport = chroniclesMapById(town.mapId).interactables
      .find((entry) => entry.id === 'swordhaven-mayor-sewers');
    const reward = mayorReport?.action?.effects?.find((effect) => effect.type === 'claim-reward');
    const xpEffect = reward?.effects?.find((effect) => effect.type === 'award-xp');
    expect(xpEffect).toMatchObject({ amount: 40, awardId: 'swordhaven:sewers:v1' });
    const after = chroniclesApplyContentEffects(town, [xpEffect]);
    const paid = applyXp(createChroniclesProgression(), town, after);
    expect(paid.awards.filter((entry) => entry.reason === 'misión')).toHaveLength(4);
    for (const id of HERO_IDS) {
      expect(chroniclesHeroProgress(paid.progression, id)).toMatchObject({ level: 2, xp: 40 });
    }
  });
});
