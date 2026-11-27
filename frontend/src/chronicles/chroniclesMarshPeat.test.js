import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';
import marsh from './maps/terra-d5.json';
import coast from './maps/terra-a2.json';

function terrainFor(map, coarsePointer, mapId = map.id) {
  const scene = new THREE.Scene();
  buildChroniclesCampaignExterior(scene, {
    coarsePointer,
    scenePlan: { mapId, regionKind: map.regionKind, biome: map.biome,
      grid: map.grid, width: map.grid[0].length, height: map.grid.length,
      center: { x: 10, y: 7 }, landscape: map.landscape, scenery: map.scenery,
      enemies: [], content: [] },
  });
  return scene.getObjectByName('chronicles-campaign-terrain');
}

describe('Terra wet peat floor', () => {
  it('uses a small, muted, opaque and repeating cached atlas', () => {
    const texture = chroniclesPixelTexture('marshpeat');
    expect(chroniclesPixelTexture('marshpeat')).toBe(texture);
    expect(texture.image.width).toBe(64);
    expect(texture.image.height).toBe(64);
    expect(texture.image.data.length).toBe(64 * 64 * 4);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.generateMipmaps).toBe(true);
    const tones = new Set();
    let moss = 0, sediment = 0;
    const data = texture.image.data;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, alpha] = data.subarray(i, i + 4);
      expect(alpha).toBe(255);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(40);
      const rgb = r * 65536 + g * 256 + b;
      tones.add(rgb);
      if (rgb === 0x777f60) moss++;
      if (rgb === 0x9b9274) sediment++;
    }
    expect(tones.size).toBeGreaterThanOrEqual(6);
    expect(moss).toBeGreaterThan(200);
    expect(moss).toBeLessThan(1200);
    expect(sediment).toBeGreaterThan(0);
    expect(sediment).toBeLessThan(100);
  });

  it.each([true, false])('uses real D5 peat without altering the terrain mesh budget (coarse=%s)', coarsePointer => {
    const terrain = terrainFor(marsh, coarsePointer);
    const legacy = terrainFor(marsh, coarsePointer, 'legacy-marsh');
    expect(terrain).toBeInstanceOf(THREE.Mesh);
    expect(terrain.material.map).toBe(chroniclesPixelTexture('marshpeat'));
    expect(terrain.material.color.getHex()).toBe(0xffffff);
    expect(terrain.material.map.repeat.toArray()).toEqual([9, 9]);
    expect(terrain.geometry.getAttribute('position').count)
      .toBe(legacy.geometry.getAttribute('position').count);
    expect(terrain.geometry.index?.count).toBe(legacy.geometry.index?.count);
    expect(legacy.material.map).not.toBe(terrain.material.map);
    expect(terrainFor(coast, coarsePointer).material.map)
      .toBe(chroniclesPixelTexture('sand'));
  });
});
