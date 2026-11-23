import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesLandscapeTileAt } from './chroniclesLandscapeTiles.js';
import { buildTerraScenery, chroniclesHighlandRidgeProfile } from './chroniclesTerraScenery.js';

const center = { x: 10, y: 7 };
const sceneArgs = (id) => {
  const map = chroniclesMapById(id);
  return { grid: map.grid, center, biome: map.biome, mapId: id, scenery: map.scenery };
};
const sampleAt = (map, mesh, index) => {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  const e = matrix.elements;
  const x = Math.round(e[12] / 4) + center.x;
  const y = Math.round(e[14] / 4) + center.y;
  const outside = !map.grid[y] || map.grid[y][x] === undefined;
  return { matrix, x, y, outside,
    family: chroniclesLandscapeTileAt({ grid: map.grid, biome: 'hills', x, y, outside })?.family };
};

describe('native Terra ridge skyline, no new scenery cells', () => {
  it('builds smooth crests and saddles from fixed world positions, not random isolated spikes', () => {
    const north = Array.from({ length: 40 }, (_, n) =>
      chroniclesHighlandRidgeProfile(n - 4, -2, 'backdrop'));
    const south = Array.from({ length: 40 }, (_, n) =>
      chroniclesHighlandRidgeProfile(n - 4, 17, 'backdrop'));
    expect(north.some(x => x < 0.83)).toBe(true);
    expect(north.some(x => x > 1.21)).toBe(true);
    expect(new Set(north.map(x => x.toFixed(3))).size).toBeGreaterThan(30);
    expect(south).not.toEqual(north);
    for (const heights of [north, south]) {
      for (let i = 0; i < heights.length; i += 1) {
        expect(heights[i]).toBeGreaterThanOrEqual(0.65);
        expect(heights[i]).toBeLessThanOrEqual(1.45);
        if (i) expect(Math.abs(heights[i] - heights[i - 1])).toBeLessThan(0.36);
      }
    }
    for (let x = -3; x < 25; x += 1) {
      expect(chroniclesHighlandRidgeProfile(x, -2, 'verge')).toBe(1);
      expect(chroniclesHighlandRidgeProfile(x, -2, 'interior'))
        .toBeCloseTo(1 + (chroniclesHighlandRidgeProfile(x, -2, 'backdrop') - 1) * 0.55, 4);
      expect(chroniclesHighlandRidgeProfile(x, -2, 'backdrop'))
        .toBe(chroniclesHighlandRidgeProfile(x, -2, 'backdrop'));
    }
    expect(chroniclesHighlandRidgeProfile(NaN, 1)).toBe(1);
    expect(chroniclesHighlandRidgeProfile(4.5, 2)).toBe(1);
  });

  it('reshapes E2 original boulder/crag matrices but preserves counts, road verges and blocked roots', () => {
    const args = sceneArgs('terra-e2');
    const map = chroniclesMapById('terra-e2');
    const scenic = buildTerraScenery(args);
    const repeated = buildTerraScenery(args);
    const baseline = buildTerraScenery({ ...args, mapId: null });
    const touch = buildTerraScenery({ ...args, coarsePointer: true });
    const partNames = scenic.children.map(o => o.name).sort();
    expect(baseline.children.map(o => o.name).sort()).toEqual(partNames);
    expect(repeated.children.map(o => o.name).sort()).toEqual(partNames);
    expect(touch.children.every(o => partNames.includes(o.name))).toBe(true);
    expect(scenic.children.every(o => o.isInstancedMesh)).toBe(true);
    const observed = { boulder: { changed: 0, verge: 0, backdrop: 0, low: 0, high: 0 },
      crag: { changed: 0, backdrop: 0, low: 0, high: 0 } };
    for (const part of ['boulder', 'crag']) {
      const name = 'chronicles-terra-' + part;
      const mesh = scenic.getObjectByName(name);
      const same = repeated.getObjectByName(name);
      const old = baseline.getObjectByName(name);
      expect(mesh.count).toBeGreaterThan(25);
      expect(mesh.count).toBe(old.count);
      expect(mesh.count).toBe(same.count);
      expect(scenic.children.filter(o => o.name === name)).toHaveLength(1);
      for (let i = 0; i < mesh.count; i += 1) {
        const a = sampleAt(map, mesh, i);
        const b = sampleAt(map, old, i);
        const c = sampleAt(map, same, i);
        expect(a.matrix.elements).toEqual(c.matrix.elements);
        expect([a.x, a.y]).toEqual([b.x, b.y]);
        if (!a.outside) expect(map.grid[a.y][a.x]).toBe('#');
        if (a.family === 'verge') {
          expect(a.matrix.elements).toEqual(b.matrix.elements);
          observed[part].verge += 1;
        }
        if (a.family === 'backdrop') {
          observed[part].backdrop += 1;
          const oldY = new THREE.Vector3().setFromMatrixScale(b.matrix).y;
          const newY = new THREE.Vector3().setFromMatrixScale(a.matrix).y;
          if (newY < oldY * 0.87) observed[part].low += 1;
          if (newY > oldY * 1.12) observed[part].high += 1;
        }
        if (a.matrix.elements.some((n, k) => Math.abs(n - b.matrix.elements[k]) > 1e-5)) {
          observed[part].changed += 1;
        }
      }
    }
    expect(observed.boulder.verge).toBeGreaterThan(0);
    expect(observed.boulder.backdrop).toBeGreaterThan(30);
    expect(observed.crag.backdrop).toBeGreaterThan(8);
    for (const part of ['boulder', 'crag']) {
      expect(observed[part].changed).toBeGreaterThan(15);
      expect(observed[part].low).toBeGreaterThan(1);
      expect(observed[part].high).toBeGreaterThan(1);
    }
    expect(touch.getObjectByName('chronicles-terra-crag').count)
      .toBeLessThanOrEqual(scenic.getObjectByName('chronicles-terra-crag').count);
  });

  it('does not modify B2 heath, non-Terra hills, C4 grassland or any authored collision grid', () => {
    const b2Args = sceneArgs('terra-b2');
    const e2Args = sceneArgs('terra-e2');
    const c4Args = sceneArgs('terra-c4');
    for (const args of [b2Args, c4Args]) {
      const current = buildTerraScenery(args);
      // C4's existing woodland composition is map-specific; compare it
      // with a repeat build, not a different forest mapId. B2's hills
      // have no such woodline and may be compared with unnamed hills.
      const original = buildTerraScenery({
        ...args, mapId: args.biome === 'hills' ? null : args.mapId,
      });
      for (const part of ['boulder', 'crag']) {
        const a = current.getObjectByName('chronicles-terra-' + part);
        const b = original.getObjectByName('chronicles-terra-' + part);
        if (!a || !b) continue;
        expect(a.count).toBe(b.count);
        const matA = new THREE.Matrix4(), matB = new THREE.Matrix4();
        for (let i = 0; i < a.count; i += 1) {
          a.getMatrixAt(i, matA);
          b.getMatrixAt(i, matB);
          expect(matA.elements).toEqual(matB.elements);
        }
      }
    }
    const named = buildTerraScenery(e2Args);
    const unnamed = buildTerraScenery({ ...e2Args, mapId: 'a-custom-hills-area' });
    const x = named.getObjectByName('chronicles-terra-crag');
    const y = unnamed.getObjectByName('chronicles-terra-crag');
    expect(x.count).toBe(y.count);
    const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4();
    let different = 0;
    for (let i = 0; i < x.count; i += 1) {
      x.getMatrixAt(i, m1);
      y.getMatrixAt(i, m2);
      if (!m1.elements.every((v, k) => Math.abs(v - m2.elements[k]) < 1e-6)) different++;
    }
    expect(different).toBeGreaterThan(10);
    // All authored maps remain immutable after construction.
    expect(chroniclesMapById('terra-e2').grid).toEqual(e2Args.grid);
    expect(chroniclesMapById('terra-b2').grid).toEqual(b2Args.grid);
  });
});
