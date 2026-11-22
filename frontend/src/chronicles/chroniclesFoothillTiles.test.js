import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_FOOTHILL_TILES, chroniclesFoothillTileAt,
} from './chroniclesLandscapeTiles.js';
import { buildTerraScenery } from './chroniclesTerraScenery.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const foothill = (grid, x, y, biome = 'hills') =>
  chroniclesFoothillTileAt({ grid, x, y, biome });
const get = (group, name) => group.getObjectByName('chronicles-terra-' + name);

describe('Terra reusable foothill transitions', () => {
  it('has immutable, bounded rockline and upland compositions', () => {
    expect(Object.keys(CHRONICLES_FOOTHILL_TILES).sort()).toEqual(['rockline', 'upland']);
    for (const recipes of Object.values(CHRONICLES_FOOTHILL_TILES)) {
      expect(recipes.length).toBeGreaterThan(1);
      expect(Object.isFrozen(recipes)).toBe(true);
      for (const tile of recipes) {
        expect(Object.isFrozen(tile)).toBe(true);
        expect(tile.coverage).toBeGreaterThan(0);
        expect(tile.coverage).toBeLessThanOrEqual(1);
        expect(tile.pebbles).toBeGreaterThanOrEqual(0);
        expect(tile.pebbles).toBeLessThanOrEqual(3);
        expect(tile.grassChance).toBeGreaterThanOrEqual(0);
        expect(tile.grassChance).toBeLessThanOrEqual(1);
      }
    }
  });

  it('selects the actual rocky margin and spares blocked/other-biome cells', () => {
    const grid = ['#######', '#.....#', '#.....#', '#.....#', '#######'];
    expect(foothill(grid, 1, 1).family).toBe('rockline');
    expect(foothill(grid, 3, 2).family).toBe('upland');
    expect(foothill(grid, 0, 0)).toBeNull();
    expect(foothill(grid, 3, 2, 'plains')).toBeNull();
    expect(foothill(grid, 3, 8)).toBeNull();
    expect(foothill(grid, 3.2, 2)).toBeNull();
    expect(foothill(grid, 1, 1).id).toBe(foothill(grid, 1, 1).id);
  });

  it('dresses genuine walkable highland cells without touching rock roots or reserved paths', () => {
    const map = chroniclesMapById('terra-e2');
    const center = { x: 10, y: 7 };
    const keepClear = [{ x: 10, y: 7 }, { x: 10, y: 6 }, { x: 10, y: 5 }];
    const plan = { grid: map.grid, center, biome: map.biome, mapId: map.id,
      scenery: map.scenery, keepClear };
    const desktop = buildTerraScenery(plan);
    const mobile = buildTerraScenery({ ...plan, coarsePointer: true });
    const restored = buildTerraScenery(plan);
    const forbidden = new Set(keepClear.map(({ x, y }) => x + ',' + y));
    const poses = new THREE.Matrix4(), repeatPose = new THREE.Matrix4();
    for (const name of ['tuft', 'pebble']) {
      const mesh = get(desktop, name);
      const touch = get(mobile, name);
      const again = get(restored, name);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(touch).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBeGreaterThan(10);
      expect(touch.count).toBeGreaterThan(0);
      expect(touch.count).toBeLessThanOrEqual(mesh.count);
      expect(desktop.children.filter(child => child.name === mesh.name)).toHaveLength(1);
      mesh.geometry.computeBoundingBox();
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getMatrixAt(index, poses);
        again.getMatrixAt(index, repeatPose);
        expect(poses.elements).toEqual(repeatPose.elements);
        const x = Math.round(poses.elements[12] / 4) + center.x;
        const y = Math.round(poses.elements[14] / 4) + center.y;
        expect(map.grid[y]?.[x], name + ' at ' + x + ',' + y).toBe('.');
        expect(forbidden.has(x + ',' + y)).toBe(false);
        expect(foothill(map.grid, x, y)).not.toBeNull();
        const box = mesh.geometry.boundingBox.clone().applyMatrix4(poses);
        expect(box.max.y).toBeLessThan(0.65);
        const cellX = (x - center.x) * 4, cellZ = (y - center.y) * 4;
        expect(box.min.x).toBeGreaterThan(cellX - 1.7);
        expect(box.max.x).toBeLessThan(cellX + 1.7);
        expect(box.min.z).toBeGreaterThan(cellZ - 1.7);
        expect(box.max.z).toBeLessThan(cellZ + 1.7);
      }
    }
    // The original blocking mountains stay on the very same authored roots.
    const ridge = get(desktop, 'crag');
    expect(ridge).toBeInstanceOf(THREE.InstancedMesh);
    for (let index = 0; index < ridge.count; index += 1) {
      ridge.getMatrixAt(index, poses);
      const x = Math.round(poses.elements[12] / 4) + center.x;
      const y = Math.round(poses.elements[14] / 4) + center.y;
      if (map.grid[y]?.[x] !== undefined) expect(map.grid[y][x]).toBe('#');
    }
    expect(desktop.children.every(child => child.isInstancedMesh)).toBe(true);
  });

  it('keeps native Brezal heather on its original blocked roots', () => {
    const map = chroniclesMapById('terra-b2');
    const a = buildTerraScenery({ grid: map.grid, center: { x: 10, y: 7 },
      biome: map.biome, mapId: map.id, scenery: map.scenery });
    expect(get(a, 'heather')).toBeInstanceOf(THREE.InstancedMesh);
    expect(get(a, 'tuft')).toBeInstanceOf(THREE.InstancedMesh);
  });
});
