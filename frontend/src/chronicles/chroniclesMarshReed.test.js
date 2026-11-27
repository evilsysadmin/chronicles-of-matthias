import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesMarshReedGeometry, chroniclesCoastalGrassGeometry } from './chroniclesTerraScenery.js';

describe('Terra marsh reed silhouettes', () => {
  it('tapers tips and shades damp roots without adding topology or opening seams', () => {
    const base = new THREE.CylinderGeometry(0.035, 0.05, 1, 4);
    const reed = chroniclesMarshReedGeometry();
    const again = chroniclesMarshReedGeometry();
    const source = base.getAttribute('position');
    const positions = reed.getAttribute('position');
    const colors = reed.getAttribute('color');
    const root = new THREE.Color('#9da895');
    const tip = new THREE.Color('#fff3d4');
    expect([...reed.index.array]).toEqual([...base.index.array]);
    expect([...reed.getAttribute('uv').array]).toEqual([...base.getAttribute('uv').array]);
    expect(positions.count).toBe(source.count);
    expect(colors.count).toBe(source.count);
    expect([...positions.array]).toEqual([...again.getAttribute('position').array]);
    expect([...colors.array]).toEqual([...again.getAttribute('color').array]);
    const duplicates = new Map();
    for (let i = 0; i < source.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(source, i);
      const q = new THREE.Vector3().fromBufferAttribute(positions, i);
      const rgb = new THREE.Color().fromBufferAttribute(colors, i);
      const key = [p.x, p.y, p.z].map(v => Math.round(v * 1e6)).join(',');
      if (duplicates.has(key)) expect(q.distanceTo(duplicates.get(key))).toBeLessThan(1e-6);
      duplicates.set(key, q);
      expect(q.y).toBe(p.y);
      if (p.y < 0) {
        expect(q.distanceTo(p)).toBeLessThan(1e-6);
        expect(rgb.r).toBeCloseTo(root.r, 5);
      } else {
        expect(Math.hypot(q.x - 0.09, q.z + 0.04)).toBeLessThan(0.024);
        expect(rgb.r).toBeCloseTo(tip.r, 5);
      }
    }
    expect([...reed.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    [base, reed, again].forEach(g => g.dispose());
  });

  it.each([true, false])('uses one deterministic reed batch on real D5 (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-d5');
    const args = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const repeat = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-reed');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(0);
    expect(mesh.material.vertexColors).toBe(true);
    expect(mesh.castShadow).toBe(false);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    expect([...mesh.instanceMatrix.array])
      .toEqual([...repeat.getObjectByName(mesh.name).instanceMatrix.array]);
    const expected = chroniclesMarshReedGeometry();
    expect([...mesh.geometry.getAttribute('position').array])
      .toEqual([...expected.getAttribute('position').array]);
    expected.dispose();
  });

  it('uses a distinct flattened coast blade while preserving the shared cylinder budget and seams', () => {
    const original = new THREE.CylinderGeometry(0.035, 0.05, 1, 4);
    const grass = chroniclesCoastalGrassGeometry();
    const p = original.getAttribute('position'), q = grass.getAttribute('position');
    expect([...grass.index.array]).toEqual([...original.index.array]);
    expect([...grass.getAttribute('uv').array]).toEqual([...original.getAttribute('uv').array]);
    const duplicates = new Map();
    const colors = grass.getAttribute('color');
    for (let i = 0; i < p.count; i++) {
      const before = new THREE.Vector3().fromBufferAttribute(p, i);
      const after = new THREE.Vector3().fromBufferAttribute(q, i);
      const key = before.toArray().map(v => Math.round(v * 1e6)).join(',');
      if (duplicates.has(key)) expect(after.distanceTo(duplicates.get(key))).toBeLessThan(1e-6);
      duplicates.set(key, after);
      expect(after.y).toBe(before.y);
      if (before.y > 0) expect(Math.abs(after.x - 0.20)).toBeLessThan(0.015);
      else expect(Math.abs(after.z)).toBeLessThanOrEqual(0.028);
    }
    expect(colors.count).toBe(q.count);
    expect([...grass.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    original.dispose();
    grass.dispose();
  });

  it.each([true, false])('uses grounded shorter dune grasses in one real A2 batch (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-a2');
    const args = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-reed');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(0);
    expect(mesh.count % 4).toBe(0);
    expect(mesh.material.vertexColors).toBe(true);
    expect(mesh.castShadow).toBe(false);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    expect([...mesh.instanceMatrix.array]).toEqual([
      ...buildTerraScenery(args).getObjectByName(mesh.name).instanceMatrix.array,
    ]);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const e = matrix.elements;
      const h = Math.hypot(e[4], e[5], e[6]);
      expect(h).toBeGreaterThanOrEqual(0.54999);
      expect(h).toBeLessThanOrEqual(1.40001);
      expect(e[13]).toBeCloseTo(h / 2, 5);
    }
  });
});
