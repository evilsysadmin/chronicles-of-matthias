import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildTerraScenery, chroniclesTerraWoodlineScale,
} from './chroniclesTerraScenery.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const part = (group, name) => group.getObjectByName('chronicles-terra-' + name);

describe('native Terra meadow skyline', () => {
  it('uses a stable low-frequency tree-height rhythm, not arbitrary flat repeats', () => {
    const heights = Array.from({ length: 25 }, (_, x) => chroniclesTerraWoodlineScale(x, 0));
    const repeated = Array.from({ length: 25 }, (_, x) => chroniclesTerraWoodlineScale(x, 0));
    expect(heights).toEqual(repeated);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(0.7);
    expect(Math.max(...heights)).toBeLessThanOrEqual(1.65);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.50);
    const neighbours = heights.slice(1).map((h, i) => Math.abs(h - heights[i]));
    expect(Math.max(...neighbours)).toBeLessThan(0.35);
    for (const x of [2, 9, 17]) {
      expect(chroniclesTerraWoodlineScale(x, -2, 3))
        .toBeGreaterThan(chroniclesTerraWoodlineScale(x, -2, 0));
    }
  });

  it('changes actual trunk/crown scales on existing blocked roots, not the walkable grid', () => {
    const map = chroniclesMapById('terra-c4');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: map.biome, scenery: map.scenery };
    const native = buildTerraScenery({ ...args, mapId: map.id });
    const old = buildTerraScenery({ ...args, mapId: 'generic-plains' });
    const repeated = buildTerraScenery({ ...args, mapId: map.id });
    const coarse = buildTerraScenery({ ...args, mapId: map.id, coarsePointer: true });
    const tree = part(native, 'broadleafTrunk');
    const crown = part(native, 'crown');
    const oldTree = part(old, 'broadleafTrunk');
    const twin = part(repeated, 'broadleafTrunk');
    expect(tree).toBeInstanceOf(THREE.InstancedMesh);
    expect(crown).toBeInstanceOf(THREE.InstancedMesh);
    expect(tree.count).toBe(oldTree.count);
    expect(tree.count).toBe(crown.count);
    expect(part(coarse, 'broadleafTrunk').count).toBeLessThanOrEqual(tree.count);
    const pose = new THREE.Matrix4(), baseline = new THREE.Matrix4(), again = new THREE.Matrix4();
    const spread = [];
    for (let i = 0; i < tree.count; i += 1) {
      tree.getMatrixAt(i, pose);
      oldTree.getMatrixAt(i, baseline);
      twin.getMatrixAt(i, again);
      expect(pose.elements).toEqual(again.elements);
      expect(pose.elements[12]).toBe(baseline.elements[12]);
      expect(pose.elements[14]).toBe(baseline.elements[14]);
      const x = Math.round(pose.elements[12] / 4) + center.x;
      const y = Math.round(pose.elements[14] / 4) + center.y;
      if (map.grid[y]?.[x] !== undefined) expect(map.grid[y][x]).toBe('#');
      spread.push(pose.elements[5] / baseline.elements[5]);
    }
    expect(Math.max(...spread) - Math.min(...spread)).toBeGreaterThan(0.45);
    expect(native.children.filter(obj => obj.name === tree.name)).toHaveLength(1);
    expect(native.children.every(obj => obj.isInstancedMesh)).toBe(true);
    expect(native.children.map(obj => obj.name).sort())
      .toEqual(old.children.map(obj => obj.name).sort());
    // The outer 3-cell scenery margin has no collision, so redundant
    // boulder batches can be thinned without changing any map wall tile.
    expect(part(native, 'boulder').count).toBeLessThan(part(old, 'boulder').count);
    expect(part(native, 'boulder').count).toBeGreaterThan(0);
  });

  it('does not retune the authored Banner Road forest composition', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const args = { grid: map.grid, center: { x: 10, y: 7 },
      biome: map.biome, scenery: map.scenery };
    const authored = buildTerraScenery({ ...args, mapId: map.id });
    const same = buildTerraScenery({ ...args, mapId: map.id });
    for (const name of ['broadleafTrunk', 'crown', 'boulder']) {
      const a = part(authored, name), b = part(same, name);
      expect(a.count).toBe(b.count);
      const pose = new THREE.Matrix4(), other = new THREE.Matrix4();
      for (let i = 0; i < a.count; i += 1) {
        a.getMatrixAt(i, pose);
        b.getMatrixAt(i, other);
        expect(pose.elements).toEqual(other.elements);
      }
    }
  });
});
