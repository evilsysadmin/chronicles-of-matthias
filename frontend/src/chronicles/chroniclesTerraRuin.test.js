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

  it('uses bounded rubble on all four authored Terra ruins, in both quality modes', () => {
    const locations = [
      ['terra-e2', 18, 6], ['terra-c4', 13, 9],
      ['terra-a1', 14, 5], ['terra-b2', 3, 8],
    ];
    for (const coarsePointer of [true, false]) {
      for (const [id, x, y] of locations) {
        const map = chroniclesMapById(id);
        expect(map.grid[y][x]).toBe('#');
        expect(map.scenery).toContainEqual({ type: 'ruin', x, y });
        const args = {
          grid: map.grid, center, biome: map.biome,
          scenery: map.scenery, coarsePointer,
        };
        const natural = buildTerraScenery({ ...args, mapId: id });
        const repeated = buildTerraScenery({ ...args, mapId: id });
        const generic = buildTerraScenery({ ...args, mapId: 'generic-' + map.biome });
        const rubble = getBoulders(natural, x, y);
        const duplicate = getBoulders(repeated, x, y);
        const oldStones = getBoulders(generic, x, y);
        expect(rubble).toHaveLength(3);
        expect(oldStones).toHaveLength(3);
        expect(duplicate.map(m => m.elements)).toEqual(rubble.map(m => m.elements));
        expect(Math.max(...oldStones.map(yScale))).toBeGreaterThan(2);
        expect(Math.max(...rubble.map(yScale))).toBeLessThan(1.65);
        expect(Math.min(...rubble.map(yScale))).toBeGreaterThan(0.85);
        const boulder = natural.getObjectByName('chronicles-terra-boulder');
        expect(boulder.count).toBe(generic.getObjectByName('chronicles-terra-boulder').count);
        expect(natural.children.map(mesh => mesh.name))
          .toEqual(generic.children.map(mesh => mesh.name));
        expect(natural.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
        for (const stone of rubble) {
          const pos = new THREE.Vector3();
          stone.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
          expect(Math.abs(pos.x - (x - center.x) * 4)).toBeLessThan(1);
          expect(Math.abs(pos.z - (y - center.y) * 4)).toBeLessThan(0.4);
        }
      }
      // v61 mountain crag geometry remains untouched, even in E2/B2.
      for (const id of ['terra-e2', 'terra-b2']) {
        const map = chroniclesMapById(id);
        const original = chroniclesMountainCragGeometry({ coarsePointer });
        const live = buildTerraScenery({
          grid: map.grid, center, biome: map.biome,
          scenery: map.scenery, mapId: id, coarsePointer,
        }).getObjectByName('chronicles-terra-crag');
        expect([...live.geometry.getAttribute('position').array])
          .toEqual([...original.getAttribute('position').array]);
        expect(live.geometry.index.count / 3).toBe(coarsePointer ? 30 : 84);
        original.dispose();
      }
    }
  });

  it('leaves non-Terra ruins and ruins authored on walkable cells unchanged', () => {
    const map = chroniclesMapById('terra-c4');
    const args = { grid: map.grid, center, biome: map.biome, coarsePointer: true };
    const ruin = [{ type: 'ruin', x: 13, y: 9 }];
    const named = buildTerraScenery({ ...args, scenery: ruin, mapId: 'terra-c4' });
    const other = buildTerraScenery({ ...args, scenery: ruin, mapId: 'custom-plains' });
    expect(Math.max(...getBoulders(named, 13, 9).map(yScale))).toBeLessThan(1.65);
    expect(Math.max(...getBoulders(other, 13, 9).map(yScale))).toBeGreaterThan(2);

    const walkable = [{ type: 'ruin', x: 12, y: 9 }];
    expect(map.grid[9][12]).toBe('.');
    const terraWalkable = buildTerraScenery({
      ...args, scenery: walkable, mapId: 'terra-c4',
    });
    const genericWalkable = buildTerraScenery({
      ...args, scenery: walkable, mapId: 'custom-plains',
    });
    expect(getBoulders(terraWalkable, 12, 9).map(m => m.elements))
      .toEqual(getBoulders(genericWalkable, 12, 9).map(m => m.elements));
  });
});
