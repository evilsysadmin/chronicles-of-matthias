import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesBannerWatchtowerGeometry } from './chroniclesTerraScenery.js';

describe('Banner Road distant Swordhaven watchtower', () => {
  it('merges the complete stone silhouette into a bounded deterministic mesh', () => {
    const geometry = chroniclesBannerWatchtowerGeometry();
    const copy = chroniclesBannerWatchtowerGeometry();
    const pos = geometry.getAttribute('position');
    expect(geometry.index.count / 3).toBe(248);
    expect(geometry.getAttribute('color').count).toBe(pos.count);
    expect(geometry.getAttribute('uv').count).toBe(pos.count);
    expect(geometry.boundingBox.min.y).toBeLessThan(0);
    expect(geometry.boundingBox.max.y).toBeCloseTo(14.55, 4);
    expect(geometry.boundingBox.max.x).toBeLessThanOrEqual(2.21);
    expect(geometry.boundingBox.max.z).toBeLessThanOrEqual(2.21);
    expect([...pos.array]).toEqual([...copy.getAttribute('position').array]);
    expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    geometry.dispose();
    copy.dispose();
  });

  it.each([true, false])('places one skyline landmark beyond the real north exit (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = map.partyStart;
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id,
      scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const tower = scene.getObjectByName('chronicles-terra-bannerWatchtower');
    expect(tower).toBeInstanceOf(THREE.InstancedMesh);
    expect(tower.count).toBe(1);
    expect(tower.castShadow).toBe(false);
    expect(tower.material.vertexColors).toBe(true);
    expect(map.exits.some(exit => exit.x === 10 && exit.y === 1
      && exit.id === 'to-first-book-swordhaven')).toBe(true);
    const matrix = new THREE.Matrix4();
    tower.getMatrixAt(0, matrix);
    const bounds = tower.geometry.boundingBox.clone().applyMatrix4(matrix);
    expect(bounds.max.z).toBeLessThan((-center.y - 0.5) * 4);
    expect(bounds.min.z).toBeGreaterThan((-center.y - 3.5) * 4);
    const peer = buildTerraScenery({ ...args, coarsePointer: !coarsePointer })
      .getObjectByName(tower.name);
    expect([...peer.instanceMatrix.array]).toEqual([...tower.instanceMatrix.array]);
    expect(buildTerraScenery({ ...args, mapId: 'terra-c4' })
      .getObjectByName(tower.name)).toBeUndefined();
  });
});
