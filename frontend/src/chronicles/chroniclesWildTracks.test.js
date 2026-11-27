import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';
import { swordhavenSurfaceTexture } from './chroniclesSwordhaven3D.js';
import coast from './maps/terra-a2.json';
import marsh from './maps/terra-d5.json';
import ash from './maps/terra-f4.json';

function roadFor(map, coarsePointer, mapId = map.id) {
  const scene = new THREE.Scene();
  buildChroniclesCampaignExterior(scene, {
    coarsePointer,
    scenePlan: { mapId, regionKind: map.regionKind, biome: map.biome,
      grid: map.grid, width: map.grid[0].length, height: map.grid.length,
      center: { x: 10, y: 7 }, landscape: map.landscape, scenery: map.scenery,
      enemies: [], content: [] },
  });
  return { scene, road: scene.getObjectByName('chronicles-campaign-road') };
}

describe('Terra biome-matched wilderness tracks', () => {
  it.each([
    [coast, 'woodlandpath', 0xffedd2],
    [marsh, 'heathpath', 0xc3c6ae],
    [ash, 'ashpath', 0xffffff],
  ])('replaces urban paving on $0.id without changing road cells', (map, texture, tint) => {
    const { scene, road } = roadFor(map, false);
    const { road: mobile } = roadFor(map, true);
    // Same map under a non-Terra ID uses the pre-existing paved road path.
    const { road: legacy } = roadFor(map, false, 'legacy-biome-road');
    expect(road).toBeInstanceOf(THREE.InstancedMesh);
    expect(road.count).toBeGreaterThan(0);
    expect(road.count).toBe(mobile.count);
    expect(scene.children.filter(m => m.name === road.name)).toHaveLength(1);
    expect(road.material.map).toBe(chroniclesPixelTexture(texture));
    expect(mobile.material.map).toBe(road.material.map);
    expect(road.material.color.getHex()).toBe(tint);
    expect(road.material.normalMap).toBeNull();
    expect(road.geometry.parameters.width).toBe(4);
    expect(road.geometry.parameters.depth).toBe(4);
    expect(legacy.material.map).toBe(swordhavenSurfaceTexture('cobble'));
    const matrix = new THREE.Matrix4();
    let narrowed = 0;
    for (let i = 0; i < road.count; i++) {
      road.getMatrixAt(i, matrix);
      const e = matrix.elements;
      const x = Math.round(e[12] / 4) + 10, y = Math.round(e[14] / 4) + 7;
      expect(map.grid[y][x]).toBe('.');
      if (x === 10 && y !== 7) {
        expect(e[0]).toBeCloseTo(0.66);
        expect(e[10]).toBeCloseTo(1);
        narrowed++;
      } else if (y === 7 && x !== 10) {
        expect(e[0]).toBeCloseTo(1);
        expect(e[10]).toBeCloseTo(0.66);
        narrowed++;
      }
    }
    expect(narrowed).toBeGreaterThan(0);
    expect([...road.instanceMatrix.array]).toEqual([...mobile.instanceMatrix.array]);
  });
});

describe('Terra volcanic track atlas', () => {
  it('contains only restrained mineral pigments, never green moss or ember pixels', () => {
    const texture = chroniclesPixelTexture('ashpath');
    expect(texture).toBe(chroniclesPixelTexture('ashpath'));
    expect(texture).not.toBe(chroniclesPixelTexture('ashland'));
    expect(texture).not.toBe(chroniclesPixelTexture('heathpath'));
    expect(texture.image.width).toBe(64);
    expect(texture.image.height).toBe(64);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.generateMipmaps).toBe(true);
    const tones = new Set();
    const data = texture.image.data;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = data.subarray(i, i + 4);
      expect(a).toBe(255);
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(b);
      expect(r - b).toBeLessThan(30);
      tones.add(r * 65536 + g * 256 + b);
    }
    expect(tones.size).toBeGreaterThanOrEqual(4);
  });
});
