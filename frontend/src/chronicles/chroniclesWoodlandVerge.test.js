import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import {
  CHRONICLES_WOODLAND_VERGE_TILES,
  chroniclesWoodlandVergeTileAt,
} from './chroniclesLandscapeTiles.js';
import { buildTerraScenery } from './chroniclesTerraScenery.js';

const center = { x: 10, y: 7 };
const cellAt = (mesh, index) => {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(index, m);
  return [Math.round(m.elements[12] / 4) + center.x,
    Math.round(m.elements[14] / 4) + center.y];
};
const countOnRoots = (scene, part, roots) => {
  const mesh = scene.getObjectByName('chronicles-terra-' + part);
  if (!mesh) return 0;
  let count = 0;
  for (let i = 0; i < mesh.count; i += 1) {
    if (roots.has(cellAt(mesh, i).join(','))) count += 1;
  }
  return count;
};

describe('reusable native Terra woodland verge tiles', () => {
  it('selects frozen, distinct plant communities only on blocked forest edges', () => {
    const grid = ['##########', '#........#', '##########'];
    const tile = (x, y, extra = {}) =>
      chroniclesWoodlandVergeTileAt({ grid, biome: 'plains', x, y, ...extra });
    expect(CHRONICLES_WOODLAND_VERGE_TILES).toHaveLength(3);
    expect(Object.isFrozen(CHRONICLES_WOODLAND_VERGE_TILES)).toBe(true);
    for (const recipe of CHRONICLES_WOODLAND_VERGE_TILES) {
      expect(Object.isFrozen(recipe)).toBe(true);
      expect(recipe.rockRetention).toBeGreaterThan(0);
      expect(recipe.rockRetention).toBeLessThan(1);
      expect(recipe.shrubChance).toBeGreaterThan(0);
      expect(recipe.herbChance).toBeGreaterThan(0);
    }
    expect(tile(0, 0)).toBeNull(); // Deep blocked forest, not a verge.
    expect(tile(1, 1)).toBeNull(); // Never decorate walkable ground as blocked.
    expect(tile(1, 0)?.family).toBe('verge');
    expect(Object.isFrozen(tile(1, 0))).toBe(true);
    expect(tile(1, 0, { biome: 'hills' })).toBeNull();
    expect(tile(-1, 0)).toBeNull();
    expect(tile(1.5, 0)).toBeNull();
    expect(tile(1, NaN)).toBeNull();
    expect(tile(1, 0)).toEqual(tile(1, 0));
    const band = [
      '#'.repeat(90),
      '#' + '.'.repeat(88) + '#',
      '#'.repeat(90),
    ];
    const ids = Array.from({ length: 88 }, (_, n) =>
      chroniclesWoodlandVergeTileAt({ grid: band, biome: 'plains', x: n + 1, y: 0 })?.id);
    expect(new Set(ids).size).toBeGreaterThan(1);
    expect(ids).toEqual([...ids].reverse().reverse());
  });

  it('replaces only C4 forest-verge rubble with existing batched shrub/fern instances', () => {
    const map = chroniclesMapById('terra-c4');
    const gridBefore = map.grid.map(row => row);
    const roots = new Set();
    const meadowNeighbours = new Set();
    for (let y = 0; y < map.grid.length; y += 1) {
      for (let x = 0; x < map.grid[y].length; x += 1) {
        if (chroniclesWoodlandVergeTileAt({ grid: map.grid, biome: map.biome, x, y })) {
          roots.add(x + ',' + y);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (map.grid[y + dy]?.[x + dx] === '.') {
              meadowNeighbours.add((x + dx) + ',' + (y + dy));
            }
          }
        }
      }
    }
    expect(meadowNeighbours.size).toBeGreaterThan(10);
    expect(roots.size).toBeGreaterThan(10);
    const args = { grid: map.grid, biome: map.biome, center, scenery: map.scenery };
    const native = buildTerraScenery({ ...args, mapId: map.id });
    const repeat = buildTerraScenery({ ...args, mapId: map.id });
    // Without a Terra ID this is the original shared plains composition,
    // rather than the new forest-verge variant.
    const neutral = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, mapId: map.id, coarsePointer: true });
    const oldRocks = countOnRoots(neutral, 'boulder', roots);
    const newRocks = countOnRoots(native, 'boulder', roots);
    expect(oldRocks).toBeGreaterThan(3);
    expect(newRocks).toBeLessThan(oldRocks);
    // Fern roots remain on passable meadow, so legacy meadow-height and
    // protected-cell checks still hold. The forest tile never plants them
    // on a blocked cell or inside the rock piles.
    expect(countOnRoots(native, 'forestHerb', roots)).toBe(0);
    expect(countOnRoots(native, 'forestHerb', meadowNeighbours))
      .toBeGreaterThan(countOnRoots(neutral, 'forestHerb', meadowNeighbours));
    expect(countOnRoots(native, 'bush', roots))
      .toBeGreaterThanOrEqual(countOnRoots(neutral, 'bush', roots));
    const originalParts = new Set(neutral.children.map(mesh => mesh.name));
    for (const scene of [native, mobile]) {
      expect(scene.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
      expect(scene.children.every(mesh => originalParts.has(mesh.name))).toBe(true);
      expect(scene.children.filter(mesh => mesh.name === 'chronicles-terra-forestHerb'))
        .toHaveLength(1);
    }
    for (const mesh of native.children) {
      const twin = repeat.getObjectByName(mesh.name);
      expect(twin.count).toBe(mesh.count);
      const a = new THREE.Matrix4(), b = new THREE.Matrix4();
      for (let i = 0; i < Math.min(mesh.count, 30); i += 1) {
        mesh.getMatrixAt(i, a);
        twin.getMatrixAt(i, b);
        expect(a.elements).toEqual(b.elements);
      }
    }
    expect(map.grid).toEqual(gridBefore);
  });

  it('never marks a non-Terra map, a road, or a mountainside as a woodland verge', () => {
    const hills = chroniclesMapById('terra-e2');
    const heath = chroniclesMapById('terra-b2');
    for (const map of [hills, heath]) {
      for (let y = 0; y < map.grid.length; y += 1) {
        for (let x = 0; x < map.grid[y].length; x += 1) {
          expect(chroniclesWoodlandVergeTileAt({ grid: map.grid, biome: map.biome, x, y }))
            .toBeNull();
        }
      }
    }
  });
});
