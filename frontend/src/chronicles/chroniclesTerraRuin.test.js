import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import {
  buildTerraScenery, chroniclesMountainCragGeometry,
} from './chroniclesTerraScenery.js';

const center = { x: 10, y: 7 };
const getBoulders = (group, cellX, cellY) => {
  const mesh = group.getObjectByName('chronicles-terra-boulder');
  const matrix = new THREE.Matrix4();
  const stones = [];
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, matrix);
    if (Math.round(matrix.elements[12] / 4) + center.x === cellX
      && Math.round(matrix.elements[14] / 4) + center.y === cellY) {
      stones.push(matrix.clone());
    }
  }
  return stones;
};
const yScale = matrix => {
  const scale = new THREE.Vector3();
  matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  return scale.y;
};

describe('Terra v62 authored ruin no longer masquerades as a giant rock needle', () => {
  it('renders three low weathered stones within the SAME impassable E2 ruin tile', () => {
    const map = chroniclesMapById('terra-e2');
    expect(map.grid[6][18]).toBe('#');
    expect(map.scenery).toContainEqual({ type: 'ruin', x: 18, y: 6 });
    const args = {
      grid: map.grid, center, biome: map.biome, scenery: map.scenery,
    };
    const natural = buildTerraScenery({ ...args, mapId: map.id });
    const again = buildTerraScenery({ ...args, mapId: map.id });
    const generic = buildTerraScenery({ ...args, mapId: 'generic-hills' });
    const rubble = getBoulders(natural, 18, 6);
    const repeat = getBoulders(again, 18, 6);
    const legacy = getBoulders(generic, 18, 6);
    expect(rubble).toHaveLength(3);
    expect(repeat.map(m => m.elements)).toEqual(rubble.map(m => m.elements));
    expect(legacy).toHaveLength(3);
    expect(Math.max(...legacy.map(yScale))).toBeGreaterThan(3.3);
    expect(Math.min(...rubble.map(yScale))).toBeGreaterThan(0.85);
    expect(Math.max(...rubble.map(yScale))).toBeLessThan(1.65);
    for (const matrix of rubble) {
      const position = new THREE.Vector3();
      matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
      // Two-metre half-cell: fragments are wider, but never protrude into
      // the playable next cell or pretend to be an added obstacle.
      expect(Math.abs(position.x - (18 - center.x) * 4)).toBeLessThan(1);
      expect(Math.abs(position.z - (6 - center.y) * 4)).toBeLessThan(0.4);
      expect(position.y).toBeGreaterThan(0.3);
      expect(position.y).toBeLessThan(0.65);
    }
    const rock = natural.getObjectByName('chronicles-terra-boulder');
    expect(rock.count).toBe(generic.getObjectByName('chronicles-terra-boulder').count);
    expect(natural.children.map(mesh => mesh.name))
      .toEqual(generic.children.map(mesh => mesh.name));
    expect(natural.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    expect(natural.children.filter(mesh => mesh.name === 'chronicles-terra-boulder'))
      .toHaveLength(1);
  });

  it('preserves original crag geometry, original B2 ruin and mobile budgets', () => {
    const map = chroniclesMapById('terra-e2');
    for (const coarsePointer of [true, false]) {
      const original = chroniclesMountainCragGeometry({ coarsePointer });
      const natural = buildTerraScenery({
        grid: map.grid, center, biome: map.biome,
        scenery: map.scenery, mapId: map.id, coarsePointer,
      });
      const crag = natural.getObjectByName('chronicles-terra-crag');
      expect([...crag.geometry.getAttribute('position').array])
        .toEqual([...original.getAttribute('position').array]);
      expect(crag.geometry.index.count / 3).toBe(coarsePointer ? 30 : 84);
      original.dispose();

      const special = chroniclesMapById('terra-b2');
      const scenery = [{ type: 'ruin', x: 0, y: 0 }];
      expect(special.grid[0][0]).toBe('#');
      const args = {
        grid: special.grid, center, biome: special.biome,
        scenery, coarsePointer,
      };
      const b2 = buildTerraScenery({ ...args, mapId: special.id });
      const generic = buildTerraScenery({ ...args, mapId: 'generic-hills' });
      expect(getBoulders(b2, 0, 0).map(x => x.elements))
        .toEqual(getBoulders(generic, 0, 0).map(x => x.elements));
    }
  });
});
