import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesChooseEnemyStep, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesGridExplorationStep } from './chroniclesGridExplorationStep.js';
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


// Unlike a pure AI direction test, this scenario calls the same exploration
// entry point used for spent player actions. The enemy's position is NEVER
// advanced by hand. Other mobs are defeated only to isolate this patrol's
// response from 12 unrelated combat/archer events.
function loneRoadGoblin() {
  const initial = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
  const map = chroniclesMapById(MAP_ID);
  const others = Object.fromEntries(map.enemies.filter((enemy) => enemy.id !== PATROL_ID)
    .map((enemy) => [enemy.hpKey, 0]));
  return { ...initial, ...others };
}

describe('MM3 · West Road real goblin circuit', () => {
  it('actually circles during four spent exploration actions, survives a checkpoint mid-route and never farms rewards', () => {
    const goblin = chroniclesMapById(MAP_ID).enemies.find((enemy) => enemy.id === PATROL_ID);
    let state = loneRoadGoblin();
    expect(chroniclesActiveEnemies(state).map((enemy) => enemy.id)).toEqual([PATROL_ID]);

    const party = state.party;
    const coins = state.gold;
    const journal = state.journal;
    const startTurns = state.turns;
    // Turning in place spends exploration time, but never changes the
    // camera cell; it must still animate an unalerted real patrol.
    for (let index = 0; index < ROUTE.length; index += 1) {
      const before = state;
      state = chroniclesGridExplorationStep(before, 'turn-right');
      expect(state.turns, `action ${index + 1} spent`).toBe(before.turns + 1);
      expect(chroniclesRuntimeEnemyPosition(state, goblin))
        .toEqual(ROUTE[(index + 1) % ROUTE.length]);
      expect({ x: state.x, y: state.y }).toEqual({ x: 10, y: 7 });
      expect(state.party).toEqual(party);
      expect(state.gold).toBe(coins);
      expect(state.journal).toEqual(journal);
      expect(state.phase).toBe('explore');
      expect(state.initiative).toBeFalsy();
      if (index === 1) {
        const checkpoint = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(state, 9)));
        const restored = chroniclesApplyRunCheckpoint(
          createChroniclesState(MAP_ID, null, { rules: 'mm3' }), checkpoint,
        );
        expect(chroniclesRuntimeEnemyPosition(restored, goblin)).toEqual(ROUTE[2]);
        state = restored;
      }
    }
    expect(state.turns).toBe(startTurns + 4);
    expect(chroniclesRuntimeEnemyPosition(state, goblin)).toEqual(ROUTE[0]);
    expect(chroniclesActiveEnemies(state).map((enemy) => enemy.id)).toEqual([PATROL_ID]);
  });

  it('breaks the circuit for real sighting/chase, then rejoins after the party leaves perception', () => {
    const goblin = chroniclesMapById(MAP_ID).enemies.find((enemy) => enemy.id === PATROL_ID);
    // Place the party in a real, unobstructed tile three cells north.
    // The alert and every goblin step are handled by the production game loop.
    const initial = { ...loneRoadGoblin(), x: 15, y: 6 };
    const alerted = chroniclesGridExplorationStep(initial, 'turn-right');
    expect(alerted.phase).toBe('explore');
    expect(chroniclesRuntimeEnemyPosition(alerted, goblin)).toEqual({ x: 15, y: 8 });
    expect(alerted.enemyAwareness?.[PATROL_ID]).toMatchObject({
      x: 15, y: 6, mapId: MAP_ID, phase: 'explore',
    });
    // The party escapes outside line of sight; enemy memory expires and the
    // actual pathfinder must find a traversable route back without teleporting.
    let fleeing = { ...alerted, x: 1, y: 1 };
    let rejoined = false;
    for (let step = 0; step < 18; step += 1) {
      const before = chroniclesRuntimeEnemyPosition(fleeing, goblin);
      const after = chroniclesGridExplorationStep(fleeing, 'turn-right');
      const position = chroniclesRuntimeEnemyPosition(after, goblin);
      expect(Math.abs(position.x - before.x) + Math.abs(position.y - before.y))
        .toBeLessThanOrEqual(1);
      if (ROUTE.some((point) => point.x === position.x && point.y === position.y)) {
        rejoined = true;
      }
      fleeing = after;
    }
    expect(rejoined).toBe(true);
    expect(fleeing.phase).toBe('explore');
    expect(fleeing.initiative).toBeFalsy();
    expect(chroniclesActiveEnemies(fleeing).map((enemy) => enemy.id)).toEqual([PATROL_ID]);
  });


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
