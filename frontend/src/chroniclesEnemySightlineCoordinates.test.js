import { describe, expect, it } from 'vitest';
import { createChroniclesState } from './chroniclesOfMatthias.js';
import { chroniclesMapById } from './chronicles/chroniclesMapCatalog.js';
import {
  chroniclesEnemyHasSightline,
  chroniclesRuntimeEnemyPosition,
} from './chroniclesOfMatthiasTurns.js';

const mapId = 'menagerie-of-ash';
const hound = chroniclesMapById(mapId).enemies.find((enemy) => enemy.id === 'bone-hound');

describe('Chronicles enemy sightline coordinates', () => {
  it('rejects fractional or non-finite sightline endpoints without tracing an endless ray', () => {
    const state = createChroniclesState(mapId);
    expect(chroniclesEnemyHasSightline(state, { x: 3, y: 3 }, { x: 3, y: 5 })).toBe(true);
    for (const invalid of [3.5, NaN, Infinity, -Infinity, undefined]) {
      expect(chroniclesEnemyHasSightline(state, { x: invalid, y: 3 }, { x: 3, y: 5 })).toBe(false);
      expect(chroniclesEnemyHasSightline(state, { x: 3, y: 3 }, { x: invalid, y: 5 })).toBe(false);
    }
  });

  it('falls back to the authored enemy position when a restored tile is invalid', () => {
    const base = createChroniclesState(mapId);
    const authored = { x: hound.x, y: hound.y };
    for (const invalid of [3.5, NaN, Infinity, -Infinity, undefined]) {
      const restored = {
        ...base,
        enemyPositions: { [hound.id]: { x: invalid, y: 3 } },
      };
      expect(chroniclesRuntimeEnemyPosition(restored, hound)).toEqual(authored);
    }
    const valid = {
      ...base,
      enemyPositions: { [hound.id]: { x: 3, y: 4 } },
    };
    expect(chroniclesRuntimeEnemyPosition(valid, hound)).toEqual({ x: 3, y: 4 });
  });
});
