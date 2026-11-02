import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesPrecontactMeleeContact } from './chroniclesPrecontactVolley.js';

function adjacentSewerGoblin() {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(base);
  const goblin = enemies.find(({ id }) => id === 'sewers-goblin-west');
  expect(goblin).toBeTruthy();
  return {
    ...base,
    ...Object.fromEntries(enemies.filter(({ id }) => id !== goblin.id)
      .map(({ hpKey }) => [hpKey, 0])),
    [goblin.hpKey]: 10,
    x: 1, y: 2,
    enemyPositions: { [goblin.id]: { x: 1, y: 1 } },
  };
}

describe('MM3 pre-contact melee · malformed party coordinates', () => {
  it('recognizes genuine adjacency and legacy numeric-string coordinates', () => {
    const state = adjacentSewerGoblin();
    expect(chroniclesPrecontactMeleeContact(state)).toBe(true);
    expect(chroniclesPrecontactMeleeContact({ ...state, x: '1', y: '2' })).toBe(true);
    expect(chroniclesPrecontactMeleeContact({ ...state, x: 1, y: 3 })).toBe(false);
  });

  it('does not invent a contact tile from null, blank, boolean or structured save data', () => {
    const state = adjacentSewerGoblin();
    for (const invalid of [null, '', '   ', false, [], {}, -1, Infinity, NaN]) {
      expect(chroniclesPrecontactMeleeContact({ ...state, x: invalid }),
        `x=${String(invalid)}`).toBe(false);
      expect(chroniclesPrecontactMeleeContact({ ...state, y: invalid }),
        `y=${String(invalid)}`).toBe(false);
    }
  });
});
