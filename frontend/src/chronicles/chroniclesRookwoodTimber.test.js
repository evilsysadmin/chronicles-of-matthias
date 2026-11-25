import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildTerraScenery } from './chroniclesTerraScenery.js';
import rookwood from './maps/rookwood-first-book.json';

describe('Rookwood fallen timber', () => {
  const name = 'chronicles-terra-fallenWood';
  const plan = { grid: rookwood.grid, center: { x: 10, y: 7 },
    biome: 'forest', mapId: rookwood.id, keepClear: [{ x: 0, y: 1 }, { x: 2, y: 2 }] };
  it.each([false, true])('places weathered logs only on real blocked forest margins (coarse=%s)', coarsePointer => {
    const args = { ...plan, coarsePointer };
    const group = buildTerraScenery(args);
    const mesh = group.getObjectByName(name);
    const twin = buildTerraScenery(args).getObjectByName(name);
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(2);
    expect(mesh.count).toBeLessThan(rookwood.grid.join('').split('#').length - 1);
    expect(mesh.count).toBe(twin.count);
    expect(group.children.filter(child => child.name === name)).toHaveLength(1);
    expect(mesh.material.vertexColors).toBe(true);
    expect(mesh.material.transparent).toBe(false);
    expect(buildTerraScenery({ ...args, mapId: 'generic-forest-fixture' }).getObjectByName(name)).toBeUndefined();
    expect(buildTerraScenery({ ...args, dressBlocked: false }).getObjectByName(name)).toBeUndefined();
    const pose = new THREE.Matrix4(), again = new THREE.Matrix4();
    mesh.geometry.computeBoundingBox();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, pose);
      twin.getMatrixAt(i, again);
      expect(pose.elements).toEqual(again.elements);
      const x = Math.round(pose.elements[12] / 4) + plan.center.x;
      const y = Math.round(pose.elements[14] / 4) + plan.center.y;
      expect(plan.grid[y]?.[x]).toBe('#');
      expect(plan.keepClear.some(c => c.x === x && c.y === y)).toBe(false);
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dx, dy]) => plan.grid[y + dy]?.[x + dx] === '.')).toBe(true);
      const wx = (x - plan.center.x) * 4, wz = (y - plan.center.y) * 4;
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(pose);
      expect(box.min.x).toBeGreaterThan(wx - 2);
      expect(box.max.x).toBeLessThan(wx + 2);
      expect(box.min.z).toBeGreaterThan(wz - 2);
      expect(box.max.z).toBeLessThan(wz + 2);
      expect(box.max.y).toBeLessThan(0.6);
    }
  });
  it('preserves the same log locations on mobile, with a smaller population', () => {
    const desktop = buildTerraScenery(plan).getObjectByName(name);
    const mobile = buildTerraScenery({ ...plan, coarsePointer: true }).getObjectByName(name);
    const pose = new THREE.Matrix4(), positions = new Set();
    for (let i = 0; i < desktop.count; i++) {
      desktop.getMatrixAt(i, pose);
      positions.add(pose.elements.join(','));
    }
    expect(mobile.count).toBeLessThan(desktop.count);
    for (let i = 0; i < mobile.count; i++) {
      mobile.getMatrixAt(i, pose);
      expect(positions.has(pose.elements.join(','))).toBe(true);
    }
    expect(mobile.geometry.getAttribute('position').count).toBeLessThan(desktop.geometry.getAttribute('position').count);
  });
});
