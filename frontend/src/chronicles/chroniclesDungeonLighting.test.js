import { describe, expect, it } from 'vitest';
import { chroniclesBrazierPlacements, chroniclesNearestLightSources, chroniclesSpreadTorchPlacements, chroniclesStableTorchLightAssignments, chroniclesTorchLightGain } from './chroniclesDungeonLighting.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesIsometricScenePlan } from './chroniclesIsometricScenePlan.js';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';

function planFor(mapId) {
  return chroniclesIsometricScenePlan(chroniclesApplyContentEffects(createChroniclesState(), [{ type: 'transition-map', mapId }]));
}

describe('Dungeon lighting', () => {
  it('spreads torches over the whole maze, never two side by side', () => {
    const plan = planFor('minas-de-escoria');
    const torches = chroniclesSpreadTorchPlacements(plan.wallFaces, { spacing: 3, max: 40 });
    expect(torches.length).toBeGreaterThan(12);
    const xs = torches.map((torch) => torch.x);
    const ys = torches.map((torch) => torch.y);
    // Both ends of the map get light, not only the entrance.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(14);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(7);
    const { grid } = chroniclesMapById('minas-de-escoria');
    const step = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
    torches.forEach((torch) => {
      // Hung on the wall of a floor cell, never inside the stone.
      expect(grid[torch.y][torch.x]).toBe('.');
      const [dx, dy] = step[torch.side];
      expect(grid[torch.y + dy][torch.x + dx]).toBe('#');
    });
  });

  it('is deterministic and capped', () => {
    const plan = planFor('torre-de-los-nombres');
    expect(chroniclesSpreadTorchPlacements(plan.wallFaces, { max: 5 })).toHaveLength(5);
    expect(chroniclesSpreadTorchPlacements(plan.wallFaces)).toEqual(chroniclesSpreadTorchPlacements(plan.wallFaces));
  });

  it('sets braziers by the elite and the boss', () => {
    const map = chroniclesMapById('salinas-hundidas');
    const braziers = chroniclesBrazierPlacements(map.grid, map.enemies);
    expect(braziers.map((brazier) => brazier.boss).sort()).toEqual([false, true]);
    braziers.forEach(({ x, y, dx, dy }) => expect(map.grid[y + dy][x + dx]).toBe('#'));
  });

  it('keeps pooled torch slots anchored when two sources swap nearest rank', () => {
    const before = chroniclesStableTorchLightAssignments([], [2, 0, 4], 3);
    expect(before).toEqual([2, 0, 4]);
    expect(chroniclesStableTorchLightAssignments(before, [4, 2, 0], 3)).toEqual(before);
    expect(chroniclesStableTorchLightAssignments(before, [4, 3, 2], 3)).toEqual([2, 3, 4]);
    expect(chroniclesStableTorchLightAssignments([2, 2, 0], [2, 0, 3], 3)).toEqual([2, 3, 0]);
    expect(chroniclesStableTorchLightAssignments(before, [], 3)).toEqual([null, null, null]);
  });

  it('fades a relocated light in instead of teleporting at full intensity', () => {
    expect(chroniclesTorchLightGain(1, 1 / 60, true)).toBeLessThan(0.1);
    expect(chroniclesTorchLightGain(1, 1 / 60, false)).toBe(1);
    expect(chroniclesTorchLightGain(0.7, 500, true)).toBe(0.5);
    expect(chroniclesTorchLightGain(0, 0, true)).toBe(0);
  });

  it('lends lights to the nearest sources', () => {
    const sources = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 2, z: 1 }, { x: -30, z: 4 }];
    expect(chroniclesNearestLightSources(sources, 1, 0, 2)).toEqual([0, 2]);
  });
});
