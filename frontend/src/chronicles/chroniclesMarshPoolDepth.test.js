import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesMarshPoolGeometry } from './chroniclesTerraScenery.js';

describe('Terra marsh pool depth and shoreline', () => {
  it.each([true, false])('keeps original topology and radius while grading water to silt (coarse=%s)', coarsePointer => {
    const base = new THREE.CylinderGeometry(1, 1, 0.06, coarsePointer ? 14 : 24);
    const pool = chroniclesMarshPoolGeometry({ coarsePointer });
    const again = chroniclesMarshPoolGeometry({ coarsePointer });
    const source = base.getAttribute('position');
    const positions = pool.getAttribute('position');
    const colors = pool.getAttribute('color');
    const deep = new THREE.Color('#829a9b');
    const silt = new THREE.Color('#ded9b6');
    expect([...pool.index.array]).toEqual([...base.index.array]);
    expect([...pool.getAttribute('uv').array]).toEqual([...base.getAttribute('uv').array]);
    expect(positions.count).toBe(source.count);
    expect(colors.count).toBe(source.count);
    expect([...positions.array]).toEqual([...again.getAttribute('position').array]);
    expect([...colors.array]).toEqual([...again.getAttribute('color').array]);
    const rim = [], duplicates = new Map();
    let centers = 0;
    for (let i = 0; i < positions.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(source, i);
      const q = new THREE.Vector3().fromBufferAttribute(positions, i);
      const actual = new THREE.Color().fromBufferAttribute(colors, i);
      const radius = Math.hypot(q.x, q.z);
      const key = [p.x, p.y, p.z].map(v => Math.round(v * 1e6)).join(',');
      if (duplicates.has(key)) expect(q.distanceTo(duplicates.get(key))).toBeLessThan(1e-6);
      duplicates.set(key, q);
      expect(q.y).toBe(p.y);
      expect(radius).toBeLessThanOrEqual(1.000001);
      const expected = Math.hypot(p.x, p.z) < 1e-6 ? deep : silt;
      for (const channel of ['r', 'g', 'b']) {
        expect(actual[channel]).toBeCloseTo(expected[channel], 5);
      }
      if (radius < 1e-6) centers++;
      else rim.push(radius);
    }
    expect(centers).toBeGreaterThan(0);
    expect(Math.max(...rim) - Math.min(...rim)).toBeGreaterThan(0.06);
    expect([...pool.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    [base, pool, again].forEach(g => g.dispose());
  });

  it.each([true, false])('uses the shaded shoreline in the existing D5 batch (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-d5');
    const args = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const repeat = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-pool');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(0);
    expect(mesh.material.vertexColors).toBe(true);
    expect(mesh.material.transparent).toBe(false);
    expect(mesh.castShadow).toBe(false);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    const expected = chroniclesMarshPoolGeometry({ coarsePointer });
    expect([...mesh.geometry.getAttribute('position').array])
      .toEqual([...expected.getAttribute('position').array]);
    expect([...mesh.geometry.getAttribute('color').array])
      .toEqual([...expected.getAttribute('color').array]);
    expect([...mesh.instanceMatrix.array])
      .toEqual([...repeat.getObjectByName(mesh.name).instanceMatrix.array]);
    expected.dispose();
  });
});
