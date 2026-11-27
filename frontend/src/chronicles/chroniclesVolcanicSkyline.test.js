import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesVolcanicSkylineRise } from './chroniclesTerraScenery.js';

const map = chroniclesMapById('terra-f4');
const grid = map.grid;
const rise = (x, y, ringDepth) => chroniclesVolcanicSkylineRise({ grid, x, y, ringDepth });

describe('Terra volcanic skyline relief', () => {
  it('preserves playable terrain and shapes coherent outer crests', () => {
    expect(map.biome).toBe('ash');
    expect(rise(10, 7, 0)).toBe(1);
    expect(rise(10, -1, 1)).toBe(1);
    expect(rise(10, 7, 3)).toBe(1);
    expect(rise(10, -4, 4)).toBe(1);
    const inner = [], outer = [];
    for (let x = 0; x < grid[0].length; x++) {
      inner.push(rise(x, -2, 2));
      outer.push(rise(x, -3, 3));
      expect(outer[x]).toBeGreaterThanOrEqual(inner[x]);
      expect(outer[x]).toBeLessThanOrEqual(2.25);
    }
    expect(Math.max(...outer)).toBeGreaterThan(1.8);
    expect(Math.min(...outer)).toBeLessThan(1.2);
    expect(outer).toEqual(outer.map((_, x) => rise(x, -3, 3)));
  });

  it.each([true, false])('keeps the existing F4 basalt batch and grounds taller columns (coarse=%s)', coarsePointer => {
    const center = { x: 10, y: 7 };
    const args = { grid, center, biome: map.biome, mapId: map.id,
      scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args), repeat = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-basalt');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    expect([...mesh.instanceMatrix.array])
      .toEqual([...repeat.getObjectByName(mesh.name).instanceMatrix.array]);
    const matrix = new THREE.Matrix4();
    const rings = new Set();
    let tall = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const e = matrix.elements;
      const x = Math.round(e[12] / 4) + center.x;
      const y = Math.round(e[14] / 4) + center.y;
      const ring = Math.max(0, -x, x - grid[0].length + 1, -y, y - grid.length + 1);
      const h = Math.hypot(e[4], e[5], e[6]);
      expect(h / rise(x, y, ring)).toBeGreaterThanOrEqual(1.19999);
      expect(h / rise(x, y, ring)).toBeLessThanOrEqual(4.40001);
      expect(e[13]).toBeCloseTo(h / 2, 5);
      expect(Math.hypot(e[0], e[1], e[2])).toBeCloseTo(1.2, 5);
      expect(Math.hypot(e[8], e[9], e[10])).toBeCloseTo(1.2, 5);
      if (ring <= 1) expect(h).toBeLessThanOrEqual(4.40001);
      if (ring >= 2 && h > 4.4) tall++;
      rings.add(ring);
    }
    expect(tall).toBeGreaterThan(0);
    expect([...rings].sort()).toEqual([0, 1, 2, 3]);
  });
});
