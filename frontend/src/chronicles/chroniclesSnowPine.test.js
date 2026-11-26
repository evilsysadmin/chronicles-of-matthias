import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesSnowPineGeometry, chroniclesSnowdriftGeometry } from './chroniclesTerraScenery.js';

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

describe('Terra wind-packed snowdrifts', () => {
  it('sculpts a displaced crest without enlarging the original sphere envelope or topology', () => {
    const base = new THREE.SphereGeometry(0.5, 8, 4);
    const drift = chroniclesSnowdriftGeometry();
    const again = chroniclesSnowdriftGeometry();
    const source = base.getAttribute('position');
    const positions = drift.getAttribute('position');
    expect([...drift.index.array]).toEqual([...base.index.array]);
    expect([...drift.getAttribute('uv').array]).toEqual([...base.getAttribute('uv').array]);
    expect(positions.count).toBe(source.count);
    expect([...positions.array]).toEqual([...again.getAttribute('position').array]);
    const duplicates = new Map();
    for (let i = 0; i < source.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(source, i);
      const q = new THREE.Vector3().fromBufferAttribute(positions, i);
      const key = [p.x, p.y, p.z].map(v => Math.round(v * 1e6)).join(',');
      if (duplicates.has(key)) expect(q.distanceTo(duplicates.get(key))).toBeLessThan(1e-6);
      duplicates.set(key, q);
      if (p.y > 0.49) expect(q.x).toBeCloseTo(0.14);
      expect(Math.abs(q.x)).toBeLessThanOrEqual(0.500001);
      expect(Math.abs(q.z)).toBeLessThanOrEqual(0.500001);
      expect(Math.abs(q.y)).toBeLessThanOrEqual(0.500001);
    }
    expect(drift.boundingBox.max.y).toBeCloseTo(0.5);
    expect(drift.boundingBox.min.y).toBeCloseTo(-0.5);
    expect([...drift.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    [base, drift, again].forEach(g => g.dispose());
  });

  it('keeps real A1 snowdrifts in one low non-shadowing desktop batch', () => {
    const coarsePointer = false;
    const map = chroniclesMapById('terra-a1');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id,
      scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const repeated = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-snowMound');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    const twin = repeated.getObjectByName(mesh.name);
    const expected = chroniclesSnowdriftGeometry();
    expect(mesh.castShadow).toBe(false);
    expect(mesh.count).toBeGreaterThan(0);
    expect(mesh.count).toBe(twin.count);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    expect([...mesh.geometry.getAttribute('position').array])
      .toEqual([...expected.getAttribute('position').array]);
    const matrix = new THREE.Matrix4(), again = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      twin.getMatrixAt(i, again);
      expect(matrix.elements).toEqual(again.elements);
      expect(new THREE.Vector3().setFromMatrixScale(matrix).y * expected.boundingBox.max.y)
        .toBeLessThan(0.18);
    }
    expected.dispose();
  });
  it('preserves the deliberate mobile omission of optional snowdrift clutter', () => {
    const map = chroniclesMapById('terra-a1');
    const scene = buildTerraScenery({ grid: map.grid, center: { x: 10, y: 7 },
      biome: map.biome, mapId: map.id, scenery: map.scenery, coarsePointer: true });
    expect(scene.getObjectByName('chronicles-terra-snowMound')).toBeUndefined();
    expect(scene.getObjectByName('chronicles-terra-pineSnow')).toBeInstanceOf(THREE.InstancedMesh);
  });

});
