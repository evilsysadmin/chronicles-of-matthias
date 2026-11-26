import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import rookwood from './maps/rookwood-first-book.json';

describe('Rookwood veteran pines', () => {
  const grid = rookwood.grid, center = { x: 10, y: 7 };
  const build = (coarsePointer, mapId = rookwood.id) => {
    const scene = new THREE.Scene();
    buildChroniclesCampaignExterior(scene, { coarsePointer, scenePlan: {
      mapId, biome: 'forest', regionKind: 'wilderness', center, grid,
      width: grid[0].length, height: grid.length, content: [],
    } });
    return scene.getObjectByName('chronicles-campaign-forest');
  };
  const landmarks = group => {
    const [trunks, lower, upper] = group.children;
    const pose = new THREE.Matrix4(), crown = new THREE.Matrix4();
    const scale = new THREE.Vector3(), position = new THREE.Vector3(), q = new THREE.Quaternion();
    const roots = [];
    for (let i = 0; i < trunks.count; i++) {
      trunks.getMatrixAt(i, pose);
      pose.decompose(position, q, scale);
      if (scale.x / scale.y < 1.10) continue;
      const x = Math.round(position.x / 4) + center.x;
      const y = Math.round(position.z / 4) + center.y;
      expect(scale.x / scale.y).toBeCloseTo(1.40 / 1.25, 5);
      expect(scale.y).toBeGreaterThanOrEqual(1.40 - 1e-6);
      expect(scale.y).toBeLessThan(1.69);
      expect(x).toBeGreaterThan(0);
      expect(y).toBeGreaterThan(0);
      expect(x).toBeLessThan(grid[0].length - 1);
      expect(y).toBeLessThan(grid.length - 1);
      expect(grid[y][x]).toBe('#');
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dx, dy]) => grid[y + dy]?.[x + dx] === '.')).toBe(true);
      for (const other of roots) expect(Math.hypot(x - other.x, y - other.y)).toBeGreaterThanOrEqual(4);
      for (const [mesh, height] of [[lower, 4.1], [upper, 5.7]]) {
        mesh.getMatrixAt(i, crown);
        expect(crown.elements[12]).toBe(pose.elements[12]);
        expect(crown.elements[14]).toBe(pose.elements[14]);
        expect(crown.elements[13]).toBeCloseTo(height * scale.y, 5);
      }
      roots.push({ x, y, height: scale.y });
    }
    return roots;
  };
  it('retains four separated veteran pines in both render qualities with no extra batches', () => {
    const desktop = build(false), mobile = build(true);
    expect(desktop.children).toHaveLength(3);
    expect(mobile.children).toHaveLength(3);
    expect(desktop.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    const roots = landmarks(desktop);
    expect(roots).toHaveLength(4);
    expect(landmarks(mobile)).toEqual(roots);
    expect(landmarks(build(false))).toEqual(roots);
    const generic = build(false, 'generic-forest-fixture');
    expect(landmarks(generic)).toEqual([]);
    expect(desktop.children[0].count).toBe(generic.children[0].count);
  });
});
