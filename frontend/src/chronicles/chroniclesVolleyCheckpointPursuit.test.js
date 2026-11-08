import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesOpeningVolleyShots, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesAdvanceExplorationEnemies, chroniclesGridExplorationStep } from './chroniclesGridExplorationStep.js';
import { chroniclesAdvanceOpeningVolley } from './chroniclesPrecontactVolley.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const GOBLIN = 'sewers-goblin-west';
const saveAndRestore = (state) => chroniclesApplyRunCheckpoint(
  createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' }),
  JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(state, 1))),
);

describe('MM3 · ranged volley and exploration pursuit survive save/F5', () => {
  it('restores the same enemy cell without phantom movement or premature initiative', () => {
    const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const enemies = chroniclesActiveEnemies(base);
    const goblin = enemies.find(({ id }) => id === GOBLIN);
    const prepared = {
      ...base,
      ...Object.fromEntries(enemies.filter(({ id }) => id !== GOBLIN).map(({ hpKey }) => [hpKey, 0])),
      [goblin.hpKey]: 100,
      x: 1, y: 1, direction: 2,
      enemyPositions: { [GOBLIN]: { x: 1, y: 4 } },
      equipment: { matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' } },
    };
    expect(chroniclesOpeningVolleyShots(prepared).target?.id).toBe(GOBLIN);
    const fired = chroniclesAdvanceOpeningVolley(prepared, chroniclesReduce(prepared, 'volley'));
    expect(fired.phase).toBe('explore');
    const chased = chroniclesAdvanceExplorationEnemies(prepared, fired);
    expect(chroniclesRuntimeEnemyPosition(chased, goblin)).toEqual({ x: 1, y: 3 });
    expect(chased.initiative).toBeFalsy();
    const restored = saveAndRestore(chased);
    expect(restored.phase).toBe('explore');
    expect(restored.initiative).toBeFalsy();
    expect(restored.turns).toBe(chased.turns);
    expect(chroniclesRuntimeEnemyPosition(restored, goblin)).toEqual({ x: 1, y: 3 });
    expect(chroniclesAdvanceExplorationEnemies(restored, restored)).toBe(restored);

    const advanced = chroniclesGridExplorationStep(restored, 'turn-right');
    expect(chroniclesRuntimeEnemyPosition(advanced, goblin)).toEqual({ x: 1, y: 2 });
    expect(advanced.initiative).toBeFalsy();
    const contact = chroniclesStartInitiativeCombat(advanced, [goblin], { random: () => 0 });
    expect(contact.phase).toBe('combat');
  });
});
