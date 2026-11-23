import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery } from './chroniclesTerraScenery.js';

const map = chroniclesMapById('terra-b2');
const center = { x: 10, y: 7 };
const allWalkables = map.grid.flatMap((row, y) => [...row]
  .flatMap((tile, x) => tile === '.' ? [{ x, y }] : []));
const render = (opts = {}) => buildTerraScenery({
  grid: map.grid, biome: map.biome, center,
  mapId: map.id, scenery: map.scenery, ...opts,
});
const entries = group => {
  const mesh = group.getObjectByName('chronicles-terra-heather');
  const matrix = new THREE.Matrix4();
  const out = [];
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, matrix);
    const x = Math.round(matrix.elements[12] / 4) + center.x;
    const y = Math.round(matrix.elements[14] / 4) + center.y;
    const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    out.push({ x, y, tile: map.grid[y]?.[x], pos, scale,
      elements: [...matrix.elements] });
  }
  return out;
};
const only = (data, tile) => data.filter(item => item.tile === tile);

describe('Terra v65 B2 heather on real walkable foothills', () => {
  it('keeps ALL original blocked verge plants exactly while adding low lilac patches', () => {
    for (const coarsePointer of [true, false]) {
      const baseline = render({ coarsePointer, keepClear: allWalkables });
      const withLow = render({ coarsePointer });
      const old = only(entries(baseline), '#');
      const all = entries(withLow);
      const verge = only(all, '#');
      const plants = only(all, '.');
      expect(verge.map(item => item.elements)).toEqual(old.map(item => item.elements));
      expect(plants.length).toBeGreaterThan(coarsePointer ? 10 : 35);
      expect(plants.length).toBeLessThan(allWalkables.length * (coarsePointer ? 1 : 2));
      // The keepClear-all baseline intentionally excludes the original
      // walkable tufts and pebbles too; comparing every part count would
      // mistake those original batches for new heather draw calls.
      const sceneryParts = group => group.children.map(m => m.name)
        .filter(name => name !== 'chronicles-terra-tuft'
          && name !== 'chronicles-terra-pebble');
      expect(sceneryParts(withLow)).toEqual(sceneryParts(baseline));
      expect(withLow.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
      expect(withLow.children.filter(m => m.name === 'chronicles-terra-heather')).toHaveLength(1);
      for (const plant of plants) {
        expect(plant.pos.y).toBeCloseTo(0.012, 5);
        expect(plant.scale.y).toBeLessThan(0.48);
        expect(plant.scale.y).toBeGreaterThan(0.34);
        expect(Math.abs(plant.pos.x - (plant.x - center.x) * 4)).toBeLessThan(1.1);
        expect(Math.abs(plant.pos.z - (plant.y - center.y) * 4)).toBeLessThan(1.1);
        expect(plant.scale.x).toBeLessThanOrEqual(0.95);
      }
      const repeated = render({ coarsePointer });
      expect(entries(repeated).map(item => item.elements))
        .toEqual(all.map(item => item.elements));
    }
  });

  it('makes the mobile heather a strict spatial subset of desktop and keeps protected paths clear', () => {
    const desktop = only(entries(render()), '.');
    const mobile = only(entries(render({ coarsePointer: true })), '.');
    expect(mobile.length).toBeLessThan(desktop.length);
    const positions = new Set(desktop.map(item => item.pos.x.toFixed(5)
      + ':' + item.pos.z.toFixed(5)));
    for (const item of mobile) {
      expect(positions.has(item.pos.x.toFixed(5) + ':' + item.pos.z.toFixed(5))).toBe(true);
    }
    const protectedCells = allWalkables.filter((_, i) => i % 4 === 0);
    const guarded = entries(render({ keepClear: protectedCells }));
    const blocked = new Set(protectedCells.map(({ x, y }) => x + ',' + y));
    expect(only(guarded, '.').some(({ x, y }) => blocked.has(x + ',' + y))).toBe(false);
    expect(only(guarded, '#').map(item => item.elements))
      .toEqual(only(entries(render()), '#').map(item => item.elements));
  });

  it('does not affect E2 or C4, their instance batches, or collision grids', () => {
    for (const id of ['terra-e2', 'terra-c4']) {
      const other = chroniclesMapById(id);
      const args = { grid: other.grid, center, biome: other.biome, scenery: other.scenery };
      const original = buildTerraScenery({ ...args, mapId: id });
      const repeated = buildTerraScenery({ ...args, mapId: id });
      expect(original.children.map(mesh => mesh.name))
        .toEqual(repeated.children.map(mesh => mesh.name));
      for (const current of original.children) {
        const again = repeated.getObjectByName(current.name);
        expect(current.count).toBe(again.count);
        const a = new THREE.Matrix4(), b = new THREE.Matrix4();
        for (let i = 0; i < current.count; i += 1) {
          current.getMatrixAt(i, a);
          again.getMatrixAt(i, b);
          expect(a.elements).toEqual(b.elements);
        }
      }
      expect(chroniclesMapById(id).grid).toEqual(other.grid);
    }
    expect(chroniclesMapById('terra-b2').grid).toEqual(map.grid);
  });
});
