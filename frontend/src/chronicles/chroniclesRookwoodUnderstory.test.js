import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildTerraScenery } from './chroniclesTerraScenery.js';
import rookwood from './maps/rookwood-first-book.json';

describe('Rookwood fern verges', () => {
  it.each([false, true])('adds bounded low colonies beside real forest roots (coarse=%s)', coarsePointer => {
    const grid = rookwood.grid;
    const center = { x: 10, y: 7 };
    const keepClear = [{ x: 1, y: 7 }, { x: 2, y: 1 }, { x: 3, y: 1 }];
    const plan = { grid, center, biome: 'forest', mapId: rookwood.id, keepClear, coarsePointer };
    const group = buildTerraScenery(plan);
    const repeated = buildTerraScenery(plan);
    const generic = buildTerraScenery({ ...plan, mapId: 'generic-forest-fixture' });
    const name = 'chronicles-terra-forestHerb';
    const mesh = group.getObjectByName(name), twin = repeated.getObjectByName(name);
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(10);
    expect(mesh.count).toBe(twin.count);
    expect(generic.getObjectByName(name)).toBeUndefined();
    expect(group.children.filter(child => child.name === name)).toHaveLength(1);
    expect(mesh.material.vertexColors).toBe(true);
    expect(mesh.material.transparent).toBe(false);
    const m = new THREE.Matrix4(), n = new THREE.Matrix4();
    mesh.geometry.computeBoundingBox();
    const roots = new Set();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      twin.getMatrixAt(i, n);
      expect(m.elements).toEqual(n.elements);
      const x = Math.round(m.elements[12] / 4) + center.x;
      const y = Math.round(m.elements[14] / 4) + center.y;
      expect(grid[y]?.[x]).toBe('.');
      expect(keepClear.some(cell => cell.x === x && cell.y === y)).toBe(false);
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dx, dy]) => grid[y + dy]?.[x + dx] === '#')).toBe(true);
      const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(m);
      expect(bounds.max.y).toBeLessThan(0.52);
      const wx = (x - center.x) * 4, wz = (y - center.y) * 4;
      expect(bounds.min.x).toBeGreaterThan(wx - 2);
      expect(bounds.max.x).toBeLessThan(wx + 2);
      expect(bounds.min.z).toBeGreaterThan(wz - 2);
      expect(bounds.max.z).toBeLessThan(wz + 2);
      expect(Math.hypot(m.elements[12] - wx, m.elements[14] - wz)).toBeGreaterThan(1);
      roots.add(x + ',' + y);
    }
    expect(roots.size).toBe(mesh.count);
    const grass = group.getObjectByName('chronicles-terra-tuft');
    const oldGrass = generic.getObjectByName('chronicles-terra-tuft');
    expect(grass?.count).toBe(oldGrass?.count);
  });

  it('keeps the mobile fern population a subset of desktop colonies', () => {
    const plan = { grid: rookwood.grid, center: { x: 10, y: 7 }, biome: 'forest', mapId: rookwood.id };
    const desktop = buildTerraScenery(plan).getObjectByName('chronicles-terra-forestHerb');
    const mobile = buildTerraScenery({ ...plan, coarsePointer: true }).getObjectByName('chronicles-terra-forestHerb');
    const m = new THREE.Matrix4(), positions = new Set();
    for (let i = 0; i < desktop.count; i++) {
      desktop.getMatrixAt(i, m);
      positions.add(m.elements.join(','));
    }
    expect(mobile.count).toBeLessThan(desktop.count);
    for (let i = 0; i < mobile.count; i++) {
      mobile.getMatrixAt(i, m);
      expect(positions.has(m.elements.join(','))).toBe(true);
    }
  });
});
