import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesChooseEnemyStep } from '../chroniclesOfMatthiasTurns.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const MAP_ID = 'terra-b3';
const PATROL_ID = 'terra-b3-foe-8';
const ROUTE = [
  { x: 15, y: 9 },
  { x: 15, y: 10 },
  { x: 14, y: 10 },
  { x: 14, y: 9 },
];

describe('MM3 · West Road real goblin circuit', () => {
  it('walks a predictable safe loop using the existing AI, without creating an enemy or a reward', () => {
    const map = chroniclesMapById(MAP_ID);
    const goblin = map.enemies.find((enemy) => enemy.id === PATROL_ID);
    expect(map.enemies).toHaveLength(13);
    expect(new Set(map.enemies.map((enemy) => enemy.id)).size).toBe(13);
    expect(goblin).toMatchObject({
      id: PATROL_ID, hpKey: 'terra_b3Foe8Hp',
      x: 15, y: 9, visualType: 'ash-goblin',
      maxHp: 13, retaliation: 2,
    });
    expect(goblin.ai).toMatchObject({
      movement: 'patrol-route', engagedMovement: 'cardinal-chase',
      engageRange: 2, attackReach: 1, patrolRoute: ROUTE,
    });
    expect(goblin.onDefeat.effects).toEqual([{ type: 'grant-gold', amount: 1 }]);
    const content = [
      ...map.exits, ...map.interactables, ...map.treasures,
      ...map.traps, ...map.triggers,
    ];
    for (let i = 0; i < ROUTE.length; i += 1) {
      const point = ROUTE[i];
      const next = ROUTE[(i + 1) % ROUTE.length];
      expect(map.grid[point.y][point.x]).toBe('.');
      expect(Math.abs(next.x - point.x) + Math.abs(next.y - point.y)).toBe(1);
      expect(content.some((entry) => entry.x === point.x && entry.y === point.y)).toBe(false);
      expect(map.enemies.filter((enemy) => enemy.x === point.x && enemy.y === point.y)
        .map((enemy) => enemy.id)).toEqual(i === 0 ? [PATROL_ID] : []);
    }

    let state = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    expect(chroniclesActiveEnemies(state)).toHaveLength(map.enemies.length);
    for (let i = 0; i < ROUTE.length; i += 1) {
      const next = ROUTE[(i + 1) % ROUTE.length];
      expect(chroniclesChooseEnemyStep(state, goblin)).toEqual(next);
      state = {
        ...state,
        explorationEnemySteps: state.explorationEnemySteps + 1,
        enemyPositions: { ...state.enemyPositions, [PATROL_ID]: next },
      };
      if (i === 1) {
        const checkpoint = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(state, 5)));
        const restored = chroniclesApplyRunCheckpoint(
          createChroniclesState(MAP_ID, null, { rules: 'mm3' }), checkpoint,
        );
        expect(restored.enemyPositions[PATROL_ID]).toEqual(next);
        expect(chroniclesChooseEnemyStep(restored, goblin)).toEqual(ROUTE[3]);
        state = restored;
      }
    }
    expect(state.enemyPositions[PATROL_ID]).toEqual(ROUTE[0]);
  });

  it('does not resurrect a slain patrol in a restored checkpoint', () => {
    const initial = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    const slain = { ...initial, terra_b3Foe8Hp: 0 };
    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(slain, 6)));
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState(MAP_ID, null, { rules: 'mm3' }), payload,
    );
    expect(restored.terra_b3Foe8Hp).toBe(0);
    expect(chroniclesActiveEnemies(restored).some((enemy) => enemy.id === PATROL_ID)).toBe(false);
  });
});
