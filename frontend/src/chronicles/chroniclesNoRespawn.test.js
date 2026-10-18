import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const SEWERS = 'swordhaven-sewers';
const TOWN = 'swordhaven-first-book';

describe('Chronicles · monsters do not respawn', () => {
  const sewers = chroniclesMapById(SEWERS);
  const goblin = sewers.enemies[0];
  const spider = sewers.enemies.find((enemy) => enemy.id === 'sewers-spider');

  it('keeps the ones the company killed dead after leaving and coming back', () => {
    let state = chroniclesMapTransitionState(createChroniclesState(TOWN, null, { rules: 'mm3' }), SEWERS);
    expect(state[goblin.hpKey]).toBe(goblin.maxHp);
    state = { ...state, [goblin.hpKey]: 0 };
    state = chroniclesMapTransitionState(state, TOWN);
    state = chroniclesMapTransitionState(state, SEWERS);
    expect(state[goblin.hpKey]).toBe(0);
    expect(state[spider.hpKey]).toBe(spider.maxHp);
  });

  it('remembers them across a save and a reload', () => {
    let state = chroniclesMapTransitionState(createChroniclesState(TOWN, null, { rules: 'mm3' }), SEWERS);
    state = chroniclesMapTransitionState({ ...state, [goblin.hpKey]: 0 }, TOWN);
    const payload = chroniclesRunCheckpointPayload(state, 1);
    const reloaded = chroniclesApplyRunCheckpoint(createChroniclesState(TOWN, null, { rules: 'mm3' }), { ...payload, worldVersion: 1 });
    expect(reloaded.slainEnemies?.[SEWERS]).toEqual([0]);
    const back = chroniclesMapTransitionState(reloaded, SEWERS);
    expect(back[goblin.hpKey]).toBe(0);
  });
});
