import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesCoastalOutcropHeight } from './chroniclesTerraScenery.js';

const map = chroniclesMapById('terra-a2');
const center = { x: 10, y: 7 };
const noise = (x, y, salt) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

describe('Terra coastal shingle and rocky outcrops', () => {
  it('forms gradual low banks and taller rock groups deterministically', () => {
    const values = Array.from({ length: 21 }, (_, x) => chroniclesCoastalOutcropHeight(x, 7));
    expect(Math.min(...values)).toBeLessThan(0.7);
    expect(Math.max(...values)).toBeGreaterThan(1.4);
    for (let x = 1; x < values.length; x++) {
      expect(Math.abs(values[x] - values[x - 1])).toBeLessThan(0.4);
      expect(values[x]).toBe(chroniclesCoastalOutcropHeight(x, 7));
    }
  });

  it.each([true, false])('varies the height of existing A2 rocks without moving or adding roots (coarse=%s)', coarsePointer => {
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id,
      scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-boulderDark');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    const matrix = new THREE.Matrix4();
    const groups = new Map();
    let low = 0, tall = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const e = matrix.elements;
      const x = Math.round(e[12] / 4) + center.x;
      const y = Math.round(e[14] / 4) + center.y;
      const key = x + ',' + y;
      const k = groups.get(key) ?? 0;
      groups.set(key, k + 1);
      const s = 1.25 * (0.7 + noise(x, y, k + 1) * 0.7);
      const height = chroniclesCoastalOutcropHeight(x, y);
      expect(e[12]).toBeCloseTo((x - center.x) * 4 + (noise(x, y, k + 3) - 0.5) * 2.4, 4);
      expect(e[14]).toBeCloseTo((y - center.y) * 4 + (noise(y, x, k + 5) - 0.5) * 2.4, 4);
      expect(Math.hypot(e[0], e[1], e[2])).toBeCloseTo(s * (0.9 + noise(x, y, k + 11) * 0.5), 5);
      expect(Math.hypot(e[8], e[9], e[10])).toBeCloseTo(s, 5);
      expect(Math.hypot(e[4], e[5], e[6])).toBeCloseTo(s * height * (0.7 + noise(x, y, k + 13) * 0.6), 5);
      expect(e[13]).toBeCloseTo(s * 0.55 * height, 5);
      if (height < 0.75) low++;
      if (height > 1.4) tall++;
    }
    for (const [key, count] of groups) {
      const [x, y] = key.split(',').map(Number);
      const inside = x >= 0 && x < map.grid[0].length && y >= 0 && y < map.grid.length;
      expect(count).toBe(inside ? 2 : 3);
      if (inside) expect(map.grid[y][x]).toBe('#');
    }
    expect(low).toBeGreaterThan(0);
    expect(tall).toBeGreaterThan(0);
  });
});
