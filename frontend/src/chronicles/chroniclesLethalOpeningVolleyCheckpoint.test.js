import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesOpeningVolleyShots,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesAdvanceExplorationEnemies } from './chroniclesGridExplorationStep.js';
import { chroniclesAdvanceOpeningVolley } from './chroniclesPrecontactVolley.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const GOBLIN_ID = 'sewers-goblin-west';

describe('MM3 B1 · lethal opening volley never creates a ghost encounter', () => {
  it('settles the last real enemy with one paid action and keeps it dead after a checkpoint', () => {
    const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const enemies = chroniclesActiveEnemies(base);
    const goblin = enemies.find(({ id }) => id === GOBLIN_ID);
    expect(goblin).toBeTruthy();

    // The deterministic run seed gives Matthias a natural 20. This exercises
    // the real reducer's lethal shot rather than forging an enemy HP result.
    const state = {
      ...base,
      ...Object.fromEntries(enemies
        .filter(({ id }) => id !== GOBLIN_ID)
        .map(({ hpKey }) => [hpKey, 0])),
      [goblin.hpKey]: 1,
      runSeed: 'b1-lethal-25',
      x: 1, y: 1, direction: 2,
      enemyPositions: { [GOBLIN_ID]: { x: 1, y: 4 } },
      equipment: {
        ...base.equipment,
        matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' },
      },
    };
    const preview = chroniclesOpeningVolleyShots(state);
    expect(preview.target?.id).toBe(GOBLIN_ID);
    expect(preview.shots).toMatchObject([{ memberId: 'matthias', roll: 20, hit: true, damage: 1 }]);
    expect(preview.remainingHp).toBe(0);

    const fired = chroniclesReduce(state, 'volley');
    expect(fired.turns).toBe(state.turns + 1);
    expect(fired[goblin.hpKey]).toBe(0);
    const settled = chroniclesAdvanceOpeningVolley(state, fired);
    expect(settled.phase).toBe('explore');
    expect(settled.initiative).toBeFalsy();
    expect(chroniclesActiveEnemies(settled)).toHaveLength(0);
    expect(settled.party.map(({ hp }) => hp)).toEqual(state.party.map(({ hp }) => hp));

    // No exploration chase or delayed initiative callback may retaliate
    // against the company after the last enemy fell to the volley.
    const afterAi = chroniclesAdvanceExplorationEnemies(state, settled);
    expect(afterAi.turns).toBe(fired.turns);
    expect(afterAi.party.map(({ hp }) => hp)).toEqual(state.party.map(({ hp }) => hp));
    expect(chroniclesActiveEnemies(afterAi)).toHaveLength(0);

    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(afterAi, 1)));
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' }), payload,
    );
    expect(restored[goblin.hpKey]).toBe(0);
    expect(chroniclesActiveEnemies(restored)).toHaveLength(0);
    expect(restored.initiative).toBeFalsy();
    expect(restored.turns).toBe(fired.turns);
  });
});
