import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesLandscapeTileAt } from './chroniclesLandscapeTiles.js';
import {
  buildTerraScenery, chroniclesHighlandRidgeProfile,
  chroniclesBrezalVergeRelief,
} from './chroniclesTerraScenery.js';

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
      const interior = chroniclesHighlandRidgeProfile(x, -2, 'interior');
      const backdrop = chroniclesHighlandRidgeProfile(x, -2, 'backdrop');
      // The exposed backdrop is intentionally CLAMPED to safe limits:
      // near a saturated crest the inner range must keep its sign and
      // smaller excursion, not be a fixed multiple of a clipped value.
      expect(interior).toBeGreaterThan(0.70);
      expect(interior).toBeLessThan(1.30);
      expect((interior - 1) * (backdrop - 1)).toBeGreaterThanOrEqual(0);
      expect(Math.abs(interior - 1)).toBeLessThanOrEqual(Math.abs(backdrop - 1));
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
    let weatheredAuthoredRuin = 0;
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
          // V62 exception: the map's explicitly-authored E2 ruin at (18,6)
          // was a 3.5x-tall, 0.55x-wide obelisk. Only these three existing
          // stones are now low rubble; every OTHER walkable-facing blocked
          // root retains its exact previous matrix and collision topology.
          const isAuthoredRuin = part === 'boulder' && a.x === 18 && a.y === 6;
          if (isAuthoredRuin) {
            weatheredAuthoredRuin += 1;
            const oldY = new THREE.Vector3().setFromMatrixScale(b.matrix).y;
            const newY = new THREE.Vector3().setFromMatrixScale(a.matrix).y;
            expect(newY).toBeLessThan(1.65);
            expect(newY).toBeLessThan(oldY);
          } else {
            expect(a.matrix.elements).toEqual(b.matrix.elements);
          }
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
    expect(weatheredAuthoredRuin).toBe(3);
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

  it('preserves B2 authored mountains and C4 habitat, excluding only B2 decorative outer rings', () => {
    const b2Args = sceneArgs('terra-b2');
    const e2Args = sceneArgs('terra-e2');
    const c4Args = sceneArgs('terra-c4');
    for (const args of [b2Args, c4Args]) {
      const current = buildTerraScenery(args);
      // C4's existing woodland composition is map-specific; compare it
      // with a repeat build, not a different forest mapId. B2's heather
      // hillside stays identical on real blocked cells except for its three
      // v63 ruin stones; only non-colliding outer rows get v64 relief.
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
          const px = Math.round(matA.elements[12] / 4) + center.x;
          const py = Math.round(matA.elements[14] / 4) + center.y;
          const outside = px < 0 || py < 0
            || px >= args.grid[0].length || py >= args.grid.length;
          if (args.mapId === 'terra-b2' && outside) {
            // The v64 exterior bands, not real blocked terrain, now have
            // soft lowered shoulders. The same world cell remains rooted.
            expect(new THREE.Vector3().setFromMatrixScale(matA).y)
              .toBeLessThan(new THREE.Vector3().setFromMatrixScale(matB).y);
            expect(matA.elements[12]).toBe(matB.elements[12]);
            expect(matA.elements[14]).toBe(matB.elements[14]);
          } else if (args.mapId === 'terra-b2' && part === 'boulder'
              && px === 3 && py === 8) {
            // The three authored ruin stones retain their low silhouette.
            expect(new THREE.Vector3().setFromMatrixScale(matA).y)
              .toBeLessThan(1.65);
          } else if (args.mapId === 'terra-b2' && part === 'boulder'
              && chroniclesBrezalVergeRelief({ grid: args.grid, x: px, y: py }) !== 1) {
            // V69 lowers only the existing blocked-perimeter boulders.
            const factor = chroniclesBrezalVergeRelief({ grid: args.grid, x: px, y: py });
            const was = new THREE.Vector3().setFromMatrixScale(matB).y;
            const now = new THREE.Vector3().setFromMatrixScale(matA).y;
            expect(now / was).toBeCloseTo(factor, 5);
            expect(matA.elements[12]).toBe(matB.elements[12]);
            expect(matA.elements[14]).toBe(matB.elements[14]);
          } else {
            expect(matA.elements).toEqual(matB.elements);
          }
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
