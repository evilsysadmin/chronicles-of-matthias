import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery } from './chroniclesTerraScenery.js';

const map = chroniclesMapById('terra-d5');
const center = { x: 10, y: 7 };
const args = { grid: map.grid, center, biome: map.biome, mapId: map.id, scenery: map.scenery };
const matrix = new THREE.Matrix4();
function cells(mesh) {
  const result = new Map();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    const e = matrix.elements;
    const x = Math.round(e[12] / 4) + center.x;
    const y = Math.round(e[14] / 4) + center.y;
    const key = x + ',' + y;
    const root = [e[12] - (x - center.x) * 4, e[14] - (y - center.y) * 4];
    const list = result.get(key) ?? [];
    list.push(root);
    result.set(key, list);
  }
  return result;
}

describe('Terra marsh verge colonies', () => {
  it.each([true, false])('keeps damp colonies on real D5 margins, away from reserved cells (coarse=%s)', coarsePointer => {
    const initial = buildTerraScenery({ ...args, coarsePointer });
    const mesh = initial.getObjectByName('chronicles-terra-tuft');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(0);
    expect(mesh.castShadow).toBe(false);
    expect(initial.children.filter(node => node.name === mesh.name)).toHaveLength(1);
    const original = cells(mesh);
    const [first] = original.keys();
    const [rx, ry] = first.split(',').map(Number);
    const kept = buildTerraScenery({ ...args, coarsePointer, keepClear: [{ x: rx, y: ry }] });
    const remaining = cells(kept.getObjectByName(mesh.name));
    expect(remaining.has(first)).toBe(false);
    for (const [key, roots] of original) {
      const [x, y] = key.split(',').map(Number);
      expect(map.grid[y][x]).toBe('.');
      expect(x).not.toBe(center.x);
      expect(y).not.toBe(center.y);
      expect(roots).toHaveLength(coarsePointer ? 1 : 2);
      for (const [dx, dz] of roots) {
        expect(Math.max(Math.abs(dx), Math.abs(dz))).toBeCloseTo(1.1, 4);
        const nx = Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : 0;
        const ny = nx ? 0 : Math.sign(dz);
        expect(map.grid[y + ny]?.[x + nx]).toBe('#');
      }
      if (key !== first) expect(remaining.get(key)).toEqual(roots);
    }
    const twin = buildTerraScenery({ ...args, coarsePointer });
    expect([...twin.getObjectByName(mesh.name).instanceMatrix.array]).toEqual([...mesh.instanceMatrix.array]);
  });

  it('bounds mobile density using a subset of desktop colonies', () => {
    const mobile = buildTerraScenery({ ...args, coarsePointer: true }).getObjectByName('chronicles-terra-tuft');
    const desktop = buildTerraScenery({ ...args, coarsePointer: false }).getObjectByName('chronicles-terra-tuft');
    expect(mobile.count).toBeLessThan(desktop.count);
    const full = cells(desktop);
    for (const key of cells(mobile).keys()) expect(full.has(key)).toBe(true);
    expect(mobile.geometry.getAttribute('position').count / 3).toBe(15);
    expect(desktop.geometry.getAttribute('position').count / 3).toBe(33);
  });
});
