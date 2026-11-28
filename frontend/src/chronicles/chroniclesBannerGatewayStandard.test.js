import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesBannerGatewayStandardGeometry } from './chroniclesTerraScenery.js';

describe('Banner Road civic gateway standards', () => {
  it.each([true, false])('merges pole, finial, stone footing and folded cloth (coarse=%s)', coarsePointer => {
    const geometry = chroniclesBannerGatewayStandardGeometry({ coarsePointer });
    const copy = chroniclesBannerGatewayStandardGeometry({ coarsePointer });
    const pos = geometry.getAttribute('position');
    const colors = geometry.getAttribute('color');
    expect(colors.count).toBe(pos.count);
    expect(geometry.getAttribute('uv').count).toBe(pos.count);
    expect(geometry.index.count / 3).toBeLessThan(200);
    expect(geometry.boundingBox.min.y).toBeCloseTo(0);
    expect(geometry.boundingBox.max.y).toBeCloseTo(3.66);
    expect(geometry.boundingBox.max.x).toBeLessThan(0.5);
    expect(geometry.boundingBox.min.x).toBeGreaterThan(-0.5);
    expect([...pos.array]).toEqual([...copy.getAttribute('position').array]);
    expect([...colors.array]).toEqual([...copy.getAttribute('color').array]);
    expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    geometry.dispose();
    copy.dispose();
  });

  it.each([true, false])('frames the actual gateway wholly inside its two blocked cells (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id, coarsePointer };
    const scene = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-bannerGatewayStandard');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBe(2);
    expect(mesh.castShadow).toBe(false);
    expect(mesh.material.vertexColors).toBe(true);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 2; i++) {
      mesh.getMatrixAt(i, matrix);
      const x = i === 0 ? 9 : 11;
      expect(map.grid[4][x]).toBe('#');
      const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
      const wx = (x - center.x) * 4, wz = (4 - center.y) * 4;
      expect(bounds.min.x).toBeGreaterThan(wx - 2);
      expect(bounds.max.x).toBeLessThan(wx + 2);
      expect(bounds.min.z).toBeGreaterThan(wz - 2);
      expect(bounds.max.z).toBeLessThan(wz + 2);
    }
    const other = buildTerraScenery({ ...args, mapId: 'terra-c4' });
    expect(other.getObjectByName(mesh.name)).toBeUndefined();
    const peer = buildTerraScenery({ ...args, coarsePointer: !coarsePointer }).getObjectByName(mesh.name);
    expect([...peer.instanceMatrix.array]).toEqual([...mesh.instanceMatrix.array]);
  });
});
