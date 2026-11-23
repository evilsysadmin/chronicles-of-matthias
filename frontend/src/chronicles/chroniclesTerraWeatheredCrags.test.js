import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import {
  buildTerraScenery, chroniclesMountainCragGeometry,
} from './chroniclesTerraScenery.js';

const center = { x: 10, y: 7 };
const geometryData = geo => ({
  indices: [...geo.index.array],
  positions: [...geo.getAttribute('position').array],
  uvs: [...geo.getAttribute('uv').array],
});
const cragOf = (mapId, coarsePointer = false) => {
  const map = chroniclesMapById(mapId);
  return buildTerraScenery({
    grid: map.grid, center, biome: map.biome, scenery: map.scenery,
    mapId, coarsePointer,
  }).getObjectByName('chronicles-terra-crag');
};

describe('Terra v62 weather-eroded natural highland crags', () => {
  it('gains broad ledges and a closed summit within the SAME low-poly crag budget', () => {
    for (const coarsePointer of [true, false]) {
      const original = chroniclesMountainCragGeometry({ coarsePointer });
      const weathered = chroniclesMountainCragGeometry({
        coarsePointer, weatheredHighland: true,
      });
      const sides = coarsePointer ? 5 : 7;
      const peaks = coarsePointer ? 1 : 2;
      expect(original.index.count / 3).toBe(coarsePointer ? 30 : 84);
      expect(weathered.index.count / 3).toBe(coarsePointer ? 35 : 98);
      expect(weathered.getAttribute('position').count).toBe(peaks * (sides * 4 + 1));
      expect(weathered.getAttribute('position').count
        - original.getAttribute('position').count).toBe(peaks);
      const oldPos = original.getAttribute('position');
      const newPos = weathered.getAttribute('position');
      // A rock ring near the summit is now a visible terrace, not a needle.
      const upper = 3 * sides;
      expect(Math.abs(newPos.getX(upper) - (-0.20))).toBeGreaterThan(
        Math.abs(oldPos.getX(upper) - (-0.20)) + 0.06,
      );
      const summit = 4 * sides; // each peak's new closed top cap
      const oldTipHeight = coarsePointer ? 1.15 : 1.17;
      expect(oldPos.getY(upper)).toBeCloseTo(oldTipHeight, 5);
      expect(newPos.getY(summit)).toBeCloseTo(oldTipHeight * 0.89 * 0.96, 5);
      expect(newPos.getY(summit)).toBeLessThan(oldTipHeight * 0.87);
      expect(newPos.getY(summit)).toBeGreaterThan(newPos.getY(upper));
      for (const geo of [original, weathered]) {
        geo.computeBoundingBox();
        expect(geo.boundingBox.min.y).toBeGreaterThanOrEqual(0);
        expect(geo.boundingBox.max.y).toBeLessThan(1.5);
        expect(geo.getAttribute('uv').count)
          .toBe(geo.getAttribute('position').count);
        expect(geo.getAttribute('normal').count)
          .toBe(geo.getAttribute('position').count);
        expect([...geo.getAttribute('position').array].every(Number.isFinite)).toBe(true);
        expect([...geo.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
      }
      const repeat = chroniclesMountainCragGeometry({
        coarsePointer, weatheredHighland: true,
      });
      expect(geometryData(weathered)).toEqual(geometryData(repeat));
      original.dispose();
      weathered.dispose();
      repeat.dispose();
    }
  });

  it('uses the new mesh only for real Terra mountain regions, not B2 or generic hills', () => {
    const e2 = chroniclesMapById('terra-e2');
    for (const coarsePointer of [true, false]) {
      const args = {
        grid: e2.grid, center, biome: e2.biome, scenery: e2.scenery, coarsePointer,
      };
      const natural = buildTerraScenery({ ...args, mapId: 'terra-e2' });
      const generic = buildTerraScenery({ ...args, mapId: 'generic-hills' });
      const a = natural.getObjectByName('chronicles-terra-crag');
      const b = generic.getObjectByName('chronicles-terra-crag');
      expect(a).toBeInstanceOf(THREE.InstancedMesh);
      expect(b).toBeInstanceOf(THREE.InstancedMesh);
      expect(a.count).toBe(b.count);
      expect(natural.children.map(mesh => mesh.name))
        .toEqual(generic.children.map(mesh => mesh.name));
      expect(a.geometry.index.count).toBe(coarsePointer ? 105 : 294);
      expect(b.geometry.index.count).toBe(coarsePointer ? 90 : 252);
      expect([...a.geometry.getAttribute('position').array])
        .not.toEqual([...b.geometry.getAttribute('position').array]);
      expect(natural.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    }

    const b2 = chroniclesMapById('terra-b2');
    const plan = {
      grid: b2.grid, center, biome: b2.biome, scenery: b2.scenery,
    };
    for (const coarsePointer of [true, false]) {
      const special = buildTerraScenery({ ...plan, mapId: b2.id, coarsePointer });
      const generic = buildTerraScenery({ ...plan, mapId: 'generic-hills', coarsePointer });
      const a = special.getObjectByName('chronicles-terra-crag');
      const b = generic.getObjectByName('chronicles-terra-crag');
      expect(a.count).toBe(b.count);
      expect(geometryData(a.geometry)).toEqual(geometryData(b.geometry));
    }
  });
});
