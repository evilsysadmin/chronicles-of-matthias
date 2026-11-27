import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import { createChroniclesExteriorDaylight } from './chroniclesExteriorDaylight.js';

function exterior(id, coarsePointer, mapId = id) {
  const map = chroniclesMapById(id);
  const scene = new THREE.Scene();
  const plan = { mapId, regionKind: map.regionKind, biome: map.biome,
    center: { x: 10, y: 7 }, width: map.grid[0].length, height: map.grid.length,
    grid: map.grid, landscape: map.landscape, scenery: map.scenery, content: [], enemies: [] };
  buildChroniclesCampaignExterior(scene, { scenePlan: plan, coarsePointer });
  return { scene, plan, hemi: scene.children.find(node => node.isHemisphereLight),
    sun: scene.getObjectByName('chronicles-campaign-sun') };
}

describe('Terra regional ambient bounce', () => {
  it.each([
    ['terra-a2', 0xd9ebf5, 0x8a795e],
    ['terra-d5', 0xcbdcd8, 0x66644c],
    ['terra-b1', 0xdce9ff, 0x8b9cab],
    ['terra-f4', 0xe2d8d4, 0x79635b],
  ])('uses biome pigments in %s without new lights or intensity changes', (id, sky, ground) => {
    for (const coarsePointer of [true, false]) {
      const { scene, plan, hemi, sun } = exterior(id, coarsePointer);
      const legacy = exterior(id, coarsePointer, 'legacy-wilderness');
      expect(hemi.color.getHex()).toBe(sky);
      expect(hemi.groundColor.getHex()).toBe(ground);
      expect(hemi.intensity).toBe(legacy.hemi.intensity);
      expect(sun.intensity).toBe(legacy.sun.intensity);
      expect(sun.castShadow).toBe(legacy.sun.castShadow);
      expect(scene.children.filter(node => node.isLight)).toHaveLength(2);
      const cycle = createChroniclesExteriorDaylight(scene, { toneMappingExposure: 1 }, plan);
      for (const minute of [720, 1320, 480]) {
        cycle.sync(minute);
        expect(hemi.color.getHex()).toBe(sky);
        expect(hemi.groundColor.getHex()).toBe(ground);
        expect(Number.isFinite(hemi.intensity)).toBe(true);
      }
    }
  });

  it('retains the original ambient colors on Banner Road, heath and ordinary highlands', () => {
    for (const id of ['banner-road-first-book', 'terra-b2', 'terra-e2']) {
      const { hemi } = exterior(id, true);
      expect(hemi.color.getHex()).toBe(0xd4e9ff);
      expect(hemi.groundColor.getHex()).toBe(0x60734b);
    }
  });
});
