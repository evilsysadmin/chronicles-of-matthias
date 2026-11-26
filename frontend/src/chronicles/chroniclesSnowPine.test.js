import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesSnowPineGeometry } from './chroniclesTerraScenery.js';

describe('Terra snow conifer silhouettes', () => {
  it.each([true, false])('keeps topology and closes seams with a wind-shaped skirt (coarse=%s)', coarsePointer => {
    const base = new THREE.ConeGeometry(1, 1, coarsePointer ? 8 : 12);
    const shaped = chroniclesSnowPineGeometry({ coarsePointer });
    const again = chroniclesSnowPineGeometry({ coarsePointer });
    const before = base.getAttribute('position');
    const after = shaped.getAttribute('position');
    expect([...shaped.index.array]).toEqual([...base.index.array]);
    expect(after.count).toBe(before.count);
    expect([...shaped.getAttribute('uv').array]).toEqual([...base.getAttribute('uv').array]);
    expect([...after.array]).toEqual([...again.getAttribute('position').array]);
    const rim = [], duplicates = new Map();
    for (let i = 0; i < before.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(before, i);
      const q = new THREE.Vector3().fromBufferAttribute(after, i);
      const key = [p.x, p.y, p.z].map(v => Math.round(v * 1e6)).join(',');
      if (duplicates.has(key)) expect(q.distanceTo(duplicates.get(key))).toBeLessThan(1e-6);
      duplicates.set(key, q);
      if (p.y > 0.49) {
        expect(q.x).toBeCloseTo(0.12);
        expect(q.z).toBeCloseTo(-0.045);
      } else if (p.x * p.x + p.z * p.z > 0.5) {
        rim.push(q.y);
        expect(Math.hypot(q.x, q.z)).toBeLessThanOrEqual(1.000001);
      }
    }
    expect(Math.max(...rim) - Math.min(...rim)).toBeGreaterThan(0.04);
    expect(shaped.boundingBox.min.y).toBeCloseTo(-0.5);
    expect(shaped.boundingBox.max.y).toBeCloseTo(0.5);
    expect([...shaped.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    base.dispose();
    shaped.dispose();
    again.dispose();
  });

  it.each([true, false])('uses the same snow pine batches in the real A1 map (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-a1');
    const scene = buildTerraScenery({ grid: map.grid, center: { x: 10, y: 7 },
      biome: map.biome, mapId: map.id, scenery: map.scenery, coarsePointer });
    const expected = chroniclesSnowPineGeometry({ coarsePointer });
    for (const part of ['pine', 'pineSnow']) {
      const mesh = scene.getObjectByName('chronicles-terra-' + part);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBeGreaterThan(0);
      expect([...mesh.geometry.getAttribute('position').array])
        .toEqual([...expected.getAttribute('position').array]);
      expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    }
    expected.dispose();
  });
});
