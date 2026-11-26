import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery } from './chroniclesTerraScenery.js';

describe('Terra wet marsh scrub pigments', () => {
  it.each([true, false])('grades real D5 scrub by moisture and distance (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-d5');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id,
      scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const repeat = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-bush');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(0);
    expect(mesh.instanceColor.count).toBe(mesh.count);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    const twin = repeat.getObjectByName(mesh.name);
    expect([...mesh.instanceMatrix.array]).toEqual([...twin.instanceMatrix.array]);
    expect([...mesh.instanceColor.array]).toEqual([...twin.instanceColor.array]);
    const wet = new THREE.Color('#94b1a0'), dry = new THREE.Color('#e2dfb9');
    const haze = new THREE.Color('#b9c5c0');
    const matrix = new THREE.Matrix4(), actual = new THREE.Color();
    const seen = new Set(), pigments = new Set();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const e = matrix.elements;
      const x = Math.round(e[12] / 4) + center.x;
      const y = Math.round(e[14] / 4) + center.y;
      const ring = Math.max(0, -x, x - map.grid[0].length + 1, -y, y - map.grid.length + 1);
      const moisture = (1 + Math.sin(x * 0.35 + y * 0.28) * Math.cos(y * 0.43 - x * 0.19)) / 2;
      const expected = dry.clone().lerp(wet, moisture).lerp(haze, ring >= 3 ? 0.55 : ring === 2 ? 0.30 : 0);
      mesh.getColorAt(i, actual);
      for (const channel of ['r', 'g', 'b']) expect(actual[channel]).toBeCloseTo(expected[channel], 5);
      seen.add(ring);
      pigments.add(actual.getHex());
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(pigments.size).toBeGreaterThan(4);
  });
});
