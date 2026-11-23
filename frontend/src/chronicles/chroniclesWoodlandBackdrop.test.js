import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import {
  CHRONICLES_WOODLAND_BACKDROP_TILES,
  chroniclesWoodlandBackdropTileAt,
} from './chroniclesLandscapeTiles.js';
import { buildTerraScenery, TERRA_SCENERY_MARGIN } from './chroniclesTerraScenery.js';

const center = { x: 10, y: 7 };
const outsideInstances = (group, part, map) => {
  const mesh = group.getObjectByName('chronicles-terra-' + part);
  if (!mesh) return [];
  const matrix = new THREE.Matrix4();
  const instances = [];
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, matrix);
    const x = Math.round(matrix.elements[12] / 4) + center.x;
    const y = Math.round(matrix.elements[14] / 4) + center.y;
    if (x >= 0 && x < map.grid[0].length && y >= 0 && y < map.grid.length) continue;
    instances.push({ x, y, matrix: matrix.clone() });
  }
  return instances;
};

describe('Terra v57 reusable woodland backdrop tile compositions', () => {
  it('returns immutable, correlated forest patches exclusively for the exterior ring', () => {
    expect(Object.isFrozen(CHRONICLES_WOODLAND_BACKDROP_TILES)).toBe(true);
    expect(CHRONICLES_WOODLAND_BACKDROP_TILES).toHaveLength(3);
    for (const recipe of CHRONICLES_WOODLAND_BACKDROP_TILES) {
      expect(Object.isFrozen(recipe)).toBe(true);
      expect(recipe.rockChance).toBeGreaterThan(0);
      expect(recipe.rockChance).toBeLessThan(0.30);
      expect(recipe.rockScale).toBeGreaterThan(0.5);
      expect(recipe.rockScale).toBeLessThan(0.8);
      expect(recipe.shrubScale).toBeGreaterThan(0.8);
      expect(recipe.shrubScale).toBeLessThan(1.4);
    }
    const get = (x, y, ringDepth = 2, biome = 'plains') =>
      chroniclesWoodlandBackdropTileAt({ biome, x, y, ringDepth });
    expect(get(-1, -1).family).toBe('backdrop');
    expect(Object.isFrozen(get(-1, -1))).toBe(true);
    expect(get(8, 4, 0)).toBeNull();
    expect(get(8, 4, 4)).toBeNull();
    expect(get(8, 4, 1.5)).toBeNull();
    expect(get(8, 4, 2, 'hills')).toBeNull();
    expect(get(8.5, 4)).toBeNull();
    expect(get(NaN, 4)).toBeNull();
    expect(get(8, Infinity)).toBeNull();
    // Long-range patches are continuous and deterministic, not one stamp
    // per neighbouring grid square or randomized on each F5.
    const ids = Array.from({ length: 100 }, (_, x) => get(x, -2).id);
    expect(new Set(ids).size).toBeGreaterThan(1);
    expect(ids[4]).toBe(ids[5]);
    expect(ids[4]).toBe(ids[7]);
    expect(ids).toEqual(Array.from({ length: 100 }, (_, x) => get(x, -2).id));
  });

  it('breaks up C4 outer stone fence while retaining the existing mesh batches', () => {
    const map = chroniclesMapById('terra-c4');
    const before = [...map.grid];
    const args = { grid: map.grid, center, biome: map.biome, scenery: map.scenery };
    const current = buildTerraScenery({ ...args, mapId: map.id });
    const duplicate = buildTerraScenery({ ...args, mapId: map.id });
    const original = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, mapId: map.id, coarsePointer: true });
    const previousRocks = outsideInstances(original, 'boulder', map);
    const sparseRocks = outsideInstances(current, 'boulder', map);
    expect(previousRocks.length).toBeGreaterThan(80);
    expect(sparseRocks.length).toBeGreaterThan(8);
    expect(sparseRocks.length).toBeLessThan(previousRocks.length * 0.45);
    expect(outsideInstances(mobile, 'boulder', map).length)
      .toBeLessThanOrEqual(sparseRocks.length);
    for (const instance of sparseRocks) {
      const ring = Math.max(-instance.x, instance.x - map.grid[0].length + 1,
        -instance.y, instance.y - map.grid.length + 1);
      expect(ring).toBeGreaterThanOrEqual(1);
      expect(ring).toBeLessThanOrEqual(TERRA_SCENERY_MARGIN);
    }
    const oldParts = new Set(original.children.map(mesh => mesh.name));
    for (const group of [current, mobile]) {
      expect(group.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
      expect(group.children.every(mesh => oldParts.has(mesh.name))).toBe(true);
      expect(group.children.filter(mesh => mesh.name === 'chronicles-terra-boulder'))
        .toHaveLength(1);
    }
    expect(outsideInstances(current, 'bush', map).length)
      .toBe(outsideInstances(original, 'bush', map).length);
    // Same tree/shrub roots and stable placement matrices per render.
    for (const mesh of current.children) {
      const twin = duplicate.getObjectByName(mesh.name);
      expect(twin.count).toBe(mesh.count);
      const a = new THREE.Matrix4(), b = new THREE.Matrix4();
      for (let i = 0; i < Math.min(mesh.count, 40); i += 1) {
        mesh.getMatrixAt(i, a);
        twin.getMatrixAt(i, b);
        expect(a.elements).toEqual(b.elements);
      }
    }
    expect(map.grid).toEqual(before);
  });

  it('does not affect existing highland E2, special B2 or actual navigation cells', () => {
    for (const id of ['terra-e2', 'terra-b2']) {
      const map = chroniclesMapById(id);
      const args = { grid: map.grid, center, mapId: id,
        biome: map.biome, scenery: map.scenery };
      const a = buildTerraScenery(args), b = buildTerraScenery(args);
      expect(a.children.map(x => x.name)).toEqual(b.children.map(x => x.name));
      for (const mesh of a.children) {
        const twin = b.getObjectByName(mesh.name);
        expect(mesh.count).toBe(twin.count);
      }
    }
  });
});
