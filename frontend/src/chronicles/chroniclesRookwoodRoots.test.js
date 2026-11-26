import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildTerraScenery } from './chroniclesTerraScenery.js';
import rookwood from './maps/rookwood-first-book.json';

describe('Rookwood exposed roots and litter', () => {
  const name = 'chronicles-terra-microrelief';
  const center = { x: 10, y: 7 };
  const plan = { grid: rookwood.grid, center, biome: 'forest', mapId: rookwood.id,
    keepClear: [{ x: 1, y: 7 }, { x: 2, y: 1 }, { x: 3, y: 1 }] };
  const meshFor = args => buildTerraScenery(args).getObjectByName(name);

  it.each([false, true])('keeps root dressing low and directed toward real forest margins (coarse=%s)', coarsePointer => {
    const args = { ...plan, coarsePointer };
    const mesh = meshFor(args), twin = meshFor(args);
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(5);
    expect(mesh.count).toBe(twin.count);
    expect(meshFor({ ...args, mapId: 'generic-forest-fixture' })).toBeUndefined();
    expect(mesh.material.vertexColors).toBe(true);
    expect(mesh.material.transparent).toBe(false);
    mesh.geometry.computeBoundingBox();
    const pose = new THREE.Matrix4(), again = new THREE.Matrix4();
    const thickEnd = new THREE.Vector3();
    const roots = new Set();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, pose);
      twin.getMatrixAt(i, again);
      expect(pose.elements).toEqual(again.elements);
      const x = Math.round(pose.elements[12] / 4) + center.x;
      const y = Math.round(pose.elements[14] / 4) + center.y;
      expect(plan.grid[y]?.[x]).toBe('.');
      expect(plan.keepClear.some(c => c.x === x && c.y === y)).toBe(false);
      const wx = (x - center.x) * 4, wz = (y - center.y) * 4;
      const dx = pose.elements[12] - wx, dz = pose.elements[14] - wz;
      const edgeX = Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : 0;
      const edgeY = edgeX ? 0 : Math.sign(dz);
      expect(plan.grid[y + edgeY]?.[x + edgeX]).toBe('#');
      thickEnd.set(-1, 0, 0).transformDirection(pose);
      expect(thickEnd.x * edgeX + thickEnd.z * edgeY).toBeGreaterThan(0.97);
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(pose);
      expect(box.max.y).toBeLessThan(0.20);
      expect(box.min.x).toBeGreaterThan(wx - 2);
      expect(box.max.x).toBeLessThan(wx + 2);
      expect(box.min.z).toBeGreaterThan(wz - 2);
      expect(box.max.z).toBeLessThan(wz + 2);
      roots.add(x + ',' + y);
    }
    expect(roots.size).toBe(mesh.count);
  });

  it('retains the same mobile placements with fewer instances and triangles', () => {
    const desktop = meshFor(plan), mobile = meshFor({ ...plan, coarsePointer: true });
    const pose = new THREE.Matrix4(), positions = new Set();
    for (let i = 0; i < desktop.count; i++) {
      desktop.getMatrixAt(i, pose);
      positions.add(pose.elements.join(','));
    }
    expect(mobile.count).toBeLessThan(desktop.count);
    expect(mobile.geometry.getAttribute('position').count).toBeLessThan(desktop.geometry.getAttribute('position').count);
    for (let i = 0; i < mobile.count; i++) {
      mobile.getMatrixAt(i, pose);
      expect(positions.has(pose.elements.join(','))).toBe(true);
    }
  });
});
