import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesHollinArchGeometry } from './chroniclesTerraScenery.js';

describe('Hollín coastal stone arch', () => {
  it.each([true, false])('sculpts an open and bounded landmark (coarse=%s)', coarsePointer => {
    const geometry = chroniclesHollinArchGeometry({ coarsePointer });
    const spans = coarsePointer ? 12 : 20, sides = coarsePointer ? 6 : 8;
    const pos = geometry.getAttribute('position');
    const rgb = geometry.getAttribute('color');
    expect(geometry.index.count / 3).toBe(spans * sides * 2);
    expect(pos.count).toBe((spans + 1) * (sides + 1));
    expect(rgb.count).toBe(pos.count);
    expect(geometry.boundingBox.max.y).toBeGreaterThan(8);
    expect(geometry.boundingBox.max.y).toBeLessThan(10);
    expect(geometry.boundingBox.min.y).toBeLessThan(0);
    expect(geometry.boundingBox.min.z).toBeGreaterThan(-2);
    expect(geometry.boundingBox.max.z).toBeLessThan(2);
    for (let i = 0; i <= spans; i++) {
      const j = i * (sides + 1);
      expect([...pos.array.slice(j * 3, j * 3 + 3)])
        .toEqual([...pos.array.slice((j + sides) * 3, (j + sides) * 3 + 3)]);
    }
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld();
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 3, 10), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(mesh)).toHaveLength(0);
    ray.ray.origin.y = 7;
    expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
    expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    geometry.dispose();
    material.dispose();
  });

  it.each([true, false])('places exactly one landmark entirely beyond the A2 grid (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-a2');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id,
      scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const arch = scene.getObjectByName('chronicles-terra-coastalArch');
    expect(arch).toBeInstanceOf(THREE.InstancedMesh);
    expect(arch.count).toBe(1);
    expect(arch.material.vertexColors).toBe(true);
    const matrix = new THREE.Matrix4();
    arch.getMatrixAt(0, matrix);
    const bounds = arch.geometry.boundingBox.clone().applyMatrix4(matrix);
    expect(bounds.max.z).toBeLessThan((-center.y - 0.5) * 4);
    expect(bounds.min.z).toBeGreaterThanOrEqual((-center.y - 3.5) * 4);
    expect(buildTerraScenery({ ...args, mapId: 'legacy-coast' })
      .getObjectByName(arch.name)).toBeUndefined();
    expect([...buildTerraScenery(args).getObjectByName(arch.name).instanceMatrix.array])
      .toEqual([...arch.instanceMatrix.array]);
  });
});
