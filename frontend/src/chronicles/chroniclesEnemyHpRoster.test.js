import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesCampRestStatus } from './chroniclesCampRest.js';
import { chroniclesEngagedEnemies } from './chroniclesInitiative.js';

function campBesideGoblin(hp) {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(base);
  const goblin = enemies.find((enemy) => enemy.id === 'sewers-goblin-west');
  expect(goblin).toBeTruthy();
  const state = {
    ...base,
    ...Object.fromEntries(enemies.map((enemy) => [enemy.hpKey, 0])),
    [goblin.hpKey]: hp,
    x: goblin.x,
    y: goblin.y,
    party: base.party.map((member, index) => (
      index === 0 ? { ...member, hp: member.maxHp - 1 } : member
    )),
    inventory: {
      'road-rations': { id: 'road-rations', name: 'Raciones de viaje', quantity: 4 },
    },
  };
  return { state, goblin };
}

describe('MM3 living enemy roster matches initiative and camp safety', () => {
  it.each([
    { label: 'boolean', hp: true },
    { label: 'array', hp: [3] },
    { label: 'object', hp: { hp: 3 } },
    { label: 'infinite number', hp: Infinity },
    { label: 'infinite legacy text', hp: 'Infinity' },
  ])('does not resurrect a phantom enemy from $label HP', ({ hp }) => {
    const { state, goblin } = campBesideGoblin(hp);
    expect(chroniclesActiveEnemies(state).some((enemy) => enemy.id === goblin.id)).toBe(false);
    expect(chroniclesEngagedEnemies(state, [goblin])).toEqual([]);
    expect(chroniclesCampRestStatus(state, chroniclesActiveEnemies(state)).canRest).toBe(true);
    const rested = chroniclesReduce(state, { type: 'camp-rest' });
    expect(rested.turns).toBe(state.turns + 1);
    expect(rested.inventory['road-rations']).toBeUndefined();
  });

  it('preserves finite numeric-string HP from old checkpoints as a real threat', () => {
    const { state, goblin } = campBesideGoblin('3');
    expect(chroniclesActiveEnemies(state).some((enemy) => enemy.id === goblin.id)).toBe(true);
    expect(chroniclesCampRestStatus(state, chroniclesActiveEnemies(state)).reason)
      .toBe('Hay enemigos demasiado cerca para descansar.');
    expect(chroniclesReduce(state, { type: 'camp-rest' })).toBe(state);
  });
});
