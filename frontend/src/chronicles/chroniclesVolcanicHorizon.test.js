import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery } from './chroniclesTerraScenery.js';

describe('Terra volcanic horizon pigments', () => {
  it.each([true, false])('grades real F4 formations by ring while preserving the near terrain (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-f4');
    expect(map.biome).toBe('ash');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const repeat = buildTerraScenery(args);
    const matrix = new THREE.Matrix4(), actual = new THREE.Color();
    const near = new THREE.Color('#ffffff');
    const rings = new Set();
    for (const part of ['basalt', 'boulderDark', 'emberRock']) {
      const mesh = scene.getObjectByName('chronicles-terra-' + part);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.instanceColor.count).toBe(mesh.count);
      expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
      const twin = repeat.getObjectByName(mesh.name);
      expect([...mesh.instanceMatrix.array]).toEqual([...twin.instanceMatrix.array]);
      expect([...mesh.instanceColor.array]).toEqual([...twin.instanceColor.array]);
      const haze = new THREE.Color(part === 'emberRock' ? '#c7b7b3' : '#c7ced5');
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        const e = matrix.elements;
        const x = Math.round(e[12] / 4) + center.x;
        const y = Math.round(e[14] / 4) + center.y;
        const ring = Math.max(0, -x, x - map.grid[0].length + 1, -y, y - map.grid.length + 1);
        const expected = near.clone().lerp(haze, ring >= 3 ? 0.60 : ring === 2 ? 0.32 : 0);
        mesh.getColorAt(i, actual);
        for (const channel of ['r', 'g', 'b']) expect(actual[channel]).toBeCloseTo(expected[channel], 5);
        rings.add(ring);
      }
      if (part === 'emberRock') expect(mesh.material.emissiveIntensity).toBeCloseTo(0.35);
    }
    expect([...rings].sort()).toEqual([0, 1, 2, 3]);
  });

  it('does not apply ash haze to coastal boulders', () => {
    const map = chroniclesMapById('terra-a2');
    const scene = buildTerraScenery({ grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer: false });
    const mesh = scene.getObjectByName('chronicles-terra-boulderDark');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.instanceColor).toBeNull();
  });
});
