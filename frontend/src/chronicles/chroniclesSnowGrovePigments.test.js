import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery } from './chroniclesTerraScenery.js';

describe('Terra snowy grove pigments', () => {
  it.each([true, false])('grades both real A1 foliage tiers without changing instancing (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-a1');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const again = buildTerraScenery(args);
    const matrix = new THREE.Matrix4(), actual = new THREE.Color();
    for (const part of ['pine', 'pineSnow']) {
      const mesh = scene.getObjectByName('chronicles-terra-' + part);
      const twin = again.getObjectByName(mesh.name);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.instanceColor.count).toBe(mesh.count);
      expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
      expect([...mesh.instanceColor.array]).toEqual([...twin.instanceColor.array]);
      expect([...mesh.instanceMatrix.array]).toEqual([...twin.instanceMatrix.array]);
      const snow = part === 'pineSnow';
      const pale = new THREE.Color(snow ? '#ffffff' : '#e3ebe4');
      const dark = new THREE.Color(snow ? '#dce7ef' : '#b5c7c0');
      const haze = new THREE.Color(snow ? '#e5edf4' : '#ccd9dc');
      const seen = new Set(), colors = new Set();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        const e = matrix.elements;
        const x = Math.round(e[12] / 4) + center.x;
        const y = Math.round(e[14] / 4) + center.y;
        const ring = Math.max(0, -x, x - map.grid[0].length + 1, -y, y - map.grid.length + 1);
        const frost = (1 + Math.sin(x * 0.41 + y * 0.29) * Math.cos(y * 0.37 - x * 0.23)) / 2;
        const expected = dark.clone().lerp(pale, frost)
          .lerp(haze, ring >= 3 ? 0.55 : ring === 2 ? 0.30 : 0);
        mesh.getColorAt(i, actual);
        for (const channel of ['r', 'g', 'b']) {
          expect(actual[channel]).toBeCloseTo(expected[channel], 5);
        }
        seen.add(ring);
        colors.add(actual.getHex());
      }
      expect([...seen].sort()).toEqual([0, 1, 2, 3]);
      expect(colors.size).toBeGreaterThan(4);
    }
  });

  it('does not tint non-snow conifers', () => {
    const scene = buildTerraScenery({ grid: ['###', '#.#', '###'],
      center: { x: 1, y: 1 }, biome: 'forest', coarsePointer: false });
    const pine = scene.getObjectByName('chronicles-terra-pine');
    if (pine) expect(pine.instanceColor).toBeNull();
  });
});
