import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import { createChroniclesExteriorDaylight } from './chroniclesExteriorDaylight.js';

function exterior(mapId, coarsePointer) {
  const map = chroniclesMapById(mapId);
  const scene = new THREE.Scene();
  const plan = { mapId, biome: map.biome, regionKind: map.regionKind,
    grid: map.grid, center: { x: 10, y: 7 }, width: map.grid[0].length,
    height: map.grid.length, content: [], enemies: [], scenery: map.scenery };
  buildChroniclesCampaignExterior(scene, { scenePlan: plan, coarsePointer });
  return { scene, plan };
}

describe('Banner Road distant woodland mist', () => {
  it.each([true, false])('keeps a single softly feathered batch beyond the playable map (coarse=%s)', coarsePointer => {
    const { scene, plan } = exterior('banner-road-first-book', coarsePointer);
    const mist = scene.getObjectByName('chronicles-banner-woodland-mist');
    expect(mist).toBeInstanceOf(THREE.Mesh);
    expect(mist.castShadow).toBe(false);
    expect(mist.material.depthTest).toBe(true);
    expect(mist.material.depthWrite).toBe(false);
    expect(mist.material.forceSinglePass).toBe(true);
    expect(mist.material.transparent).toBe(true);
    expect(mist.geometry.index.count / 3).toBe(coarsePointer ? 96 : 160);
    expect(mist.geometry.boundingBox.max.z).toBeLessThan((-plan.center.y - 0.5) * 4);
    expect(mist.geometry.boundingBox.min.z).toBeGreaterThan((-plan.center.y - 3.5) * 4);
    const colors = mist.geometry.getAttribute('color');
    let max = 0;
    for (let i = 0; i < colors.count; i += 3) {
      expect(colors.getW(i)).toBe(0);
      expect(colors.getW(i + 2)).toBe(0);
      expect(colors.getW(i + 1)).toBeGreaterThanOrEqual(0);
      max = Math.max(max, colors.getW(i + 1));
    }
    expect(max).toBeGreaterThan(0.12);
    expect(max).toBeLessThanOrEqual(0.25);
    const cycle = createChroniclesExteriorDaylight(scene, { toneMappingExposure: 1 }, plan);
    cycle.sync(720);
    const day = mist.material.color.clone();
    cycle.sync(1380);
    const night = mist.material.color.clone();
    expect(day.r + day.g + day.b).toBeGreaterThan(night.r + night.g + night.b);
    expect(mist.material.opacity).toBeGreaterThanOrEqual(0.55);
    expect(mist.material.opacity).toBeLessThanOrEqual(1);
    cycle.sync(720);
    expect(mist.material.color).toEqual(day);
  });
  it('does not introduce woodland mist in other Terra landscapes', () => {
    for (const id of ['terra-c4', 'terra-a2', 'terra-d5', 'rookwood-first-book']) {
      expect(exterior(id, true).scene.getObjectByName('chronicles-banner-woodland-mist'))
        .toBeUndefined();
    }
  });
});
