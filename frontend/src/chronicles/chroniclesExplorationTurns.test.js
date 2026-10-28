import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import {
  chroniclesEnemyHasSightline,
  chroniclesRememberEnemySight,
  chroniclesRuntimeEnemyPosition,
} from '../chroniclesOfMatthiasTurns.js';
import { chroniclesAdvanceExplorationEnemies, chroniclesGridExplorationStep } from './chroniclesGridExplorationStep.js';

function loneGoblin() {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const goblin = chroniclesActiveEnemies(base).find((enemy) => enemy.id === 'sewers-goblin-west');
  const otherHp = Object.fromEntries(chroniclesActiveEnemies(base)
    .filter((enemy) => enemy.id !== goblin.id).map((enemy) => [enemy.hpKey, 0]));
  return { goblin, state: { ...base, ...otherHp,
    x: 1, y: 1, direction: 2,
    enemyPositions: { [goblin.id]: { x: 1, y: 3 } },
    equipment: { ...base.equipment, matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' } },
  } };
}

describe('MM3 exploration: non-moving actions also progress alerted foes', () => {
  it('makes a goblin behind a corner investigate its remembered sighting when S fires', () => {
    const { goblin, state } = loneGoblin();
    expect(chroniclesEnemyHasSightline(state, { x: 1, y: 3 }, { x: 1, y: 1 })).toBe(true);
    const noticed = chroniclesRememberEnemySight(state, goblin);
    const hidden = { ...noticed, x: 3, y: 3, direction: 1 };
    expect(chroniclesEnemyHasSightline(hidden, { x: 1, y: 3 }, { x: 3, y: 3 })).toBe(false);
    const fired = chroniclesReduce(hidden, 'volley');
    expect(fired.turns).toBe(hidden.turns + 1);
    const advanced = chroniclesAdvanceExplorationEnemies(hidden, fired);
    expect(chroniclesRuntimeEnemyPosition(advanced, goblin)).toEqual({ x: 1, y: 2 });
    expect(advanced.explorationEnemySteps).toBe(1);
    expect(advanced.party).toEqual(hidden.party);
    expect(advanced[goblin.hpKey]).toBe(hidden[goblin.hpKey]);
  });

  it('never advances a real pursuer after repeated rejected volleys through the exploration entry point', () => {
    const { goblin, state } = loneGoblin();
    const unarmed = { ...state, equipment: {} };
    let refused = unarmed;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const next = chroniclesGridExplorationStep(refused, 'volley');
      expect(next.turns).toBe(unarmed.turns);
      expect(next.explorationEnemySteps).toBe(unarmed.explorationEnemySteps);
      expect(chroniclesRuntimeEnemyPosition(next, goblin))
        .toEqual(chroniclesRuntimeEnemyPosition(unarmed, goblin));
      expect(next.party).toEqual(unarmed.party);
      refused = next;
    }
    // The next legal action must tick pursuit once, not replay three
    // rejected shots as hidden exploration turns.
    const turned = chroniclesGridExplorationStep(refused, 'turn-right');
    expect(turned.turns).toBe(unarmed.turns + 1);
    expect(turned.explorationEnemySteps).toBe((unarmed.explorationEnemySteps || 0) + 1);
  });

  it('moves once per spent action but never for a rejected shot or map transition', () => {
    const { goblin, state } = loneGoblin();
    const unarmed = { ...state, equipment: {} };
    const refused = chroniclesReduce(unarmed, 'volley');
    expect(refused.turns).toBe(unarmed.turns);
    expect(chroniclesAdvanceExplorationEnemies(unarmed, refused)).toBe(refused);
    const turned = chroniclesGridExplorationStep(state, 'turn-right');
    expect(turned.explorationEnemySteps).toBe(1);
    expect(chroniclesRuntimeEnemyPosition(turned, goblin)).not.toEqual({ x: 1, y: 3 });
    expect(chroniclesAdvanceExplorationEnemies(state, state)).toBe(state);
    expect(chroniclesAdvanceExplorationEnemies(state, { ...state, mapId: 'swordhaven-square', turns: state.turns + 1 }).explorationEnemySteps).toBeUndefined();
  });
});
