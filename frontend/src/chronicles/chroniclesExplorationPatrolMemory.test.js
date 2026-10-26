import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesChooseEnemyStep,
  chroniclesRememberEnemySight,
} from '../chroniclesOfMatthiasTurns.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

describe('MM3 overworld patrols after several exploration steps', () => {
  const map = chroniclesMapById('banner-road-first-book');
  const deserter = map.enemies.find((enemy) => enemy.id === 'banner-road-deserter');
  const marauder = map.enemies.find((enemy) => enemy.id === 'banner-road-north-marauder');

  it('varies the heading of an unalerted roaming enemy every four actual exploration steps', () => {
    const state = createChroniclesState(map.id);
    // The marauder is away from the party on an open four-way tile.
    const start = chroniclesChooseEnemyStep({ ...state, explorationEnemySteps: 0 }, marauder);
    expect(start).toBeTruthy();
    expect(chroniclesChooseEnemyStep({ ...state, explorationEnemySteps: 3 }, marauder)).toEqual(start);
    const afterFourSteps = chroniclesChooseEnemyStep({ ...state, explorationEnemySteps: 4 }, marauder);
    expect(afterFourSteps).toBeTruthy();
    expect(afterFourSteps).not.toEqual(start);
  });

  it('retains a genuine local sighting briefly, then forgets it instead of tracking through the map', () => {
    const state = {
      ...createChroniclesState(map.id),
      x: 11,
      y: 7,
      explorationEnemySteps: 3,
    };
    // The road deserter starts two tiles north with unobstructed view.
    const spotted = chroniclesRememberEnemySight(state, deserter);
    expect(spotted.enemyAwareness?.[deserter.id]).toMatchObject({
      x: 11, y: 7, tick: 1, phase: 'explore', mapId: map.id,
    });

    // After losing line of sight, the enemy investigates the last REAL tile,
    // not the expedition's distant present coordinates.
    const hidden = { ...spotted, x: 1, y: 1, explorationEnemySteps: 6 };
    expect(chroniclesRememberEnemySight(hidden, deserter).enemyAwareness?.[deserter.id])
      .toMatchObject({ x: 11, y: 7 });
    expect(chroniclesChooseEnemyStep(hidden, deserter)).toEqual({ x: 11, y: 6 });

    // Two short memory ticks later the old position is no longer actionable.
    const expired = chroniclesRememberEnemySight({ ...hidden, explorationEnemySteps: 12 }, deserter);
    expect(expired.enemyAwareness?.[deserter.id]).toBeUndefined();
  });

  it('discards corrupt saved sightings rather than chasing impossible coordinates', () => {
    const hidden = {
      ...createChroniclesState(map.id),
      x: 1,
      y: 1,
      explorationEnemySteps: 6,
    };
    const normalPatrolStep = chroniclesChooseEnemyStep(hidden, deserter);
    for (const position of [
      { x: 11.5, y: 7 },
      { x: NaN, y: 7 },
      { x: Infinity, y: 7 },
      { x: 11, y: undefined },
      { x: Number.MAX_SAFE_INTEGER + 1, y: 7 },
    ]) {
      const restored = {
        ...hidden,
        enemyAwareness: {
          [deserter.id]: {
            ...position, tick: 2, phase: 'explore', mapId: map.id,
          },
        },
      };
      expect(chroniclesChooseEnemyStep(restored, deserter)).toEqual(normalPatrolStep);
      expect(chroniclesRememberEnemySight(restored, deserter).enemyAwareness?.[deserter.id])
        .toBeUndefined();
    }
  });

});
