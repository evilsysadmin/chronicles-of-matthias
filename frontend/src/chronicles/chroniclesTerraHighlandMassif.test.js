import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildChroniclesCampaignExterior, createTerraHighlandMassif } from './chroniclesCampaignExterior3D.js';
import { createChroniclesExteriorDaylight } from './chroniclesExteriorDaylight.js';

function exterior(mapId, coarsePointer) {
  const map = chroniclesMapById(mapId);
  const scene = new THREE.Scene();
  const plan = { mapId, regionKind: map.regionKind, biome: map.biome,
    center: { x: 10, y: 7 }, width: map.grid[0].length, height: map.grid.length,
    grid: map.grid, landscape: map.landscape, scenery: map.scenery, content: [], enemies: [] };
  buildChroniclesCampaignExterior(scene, { scenePlan: plan, coarsePointer });
  return { scene, plan };
}

describe('Terra atmospheric mountain massif', () => {
  it.each([true, false])('builds two seamless bounded ranges in one background mesh (coarse=%s)', coarsePointer => {
    const { scene, plan } = exterior('terra-e2', coarsePointer);
    const dome = scene.getObjectByName('swordhaven-sky-dome');
    const mesh = dome.getObjectByName('chronicles-terra-highland-massif');
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.parent).toBe(dome);
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.material.fog).toBe(false);
    expect(mesh.material.forceSinglePass).toBe(true);
    expect(mesh.renderOrder).toBeGreaterThan(dome.getObjectByName('chronicles-sky-cloud-panorama').renderOrder);
    expect(mesh.renderOrder).toBeLessThan(0);
    const segments = coarsePointer ? 64 : 96;
    const layerVertices = (segments + 1) * 3;
    expect(mesh.geometry.index.count / 3).toBe(coarsePointer ? 512 : 768);
    const pos = mesh.geometry.getAttribute('position');
    const color = mesh.geometry.getAttribute('color');
    expect(pos.count).toBe(layerVertices * 2);
    const peaks = [];
    for (let layer = 0; layer < 2; layer++) {
      const offset = layer * layerVertices;
      const radius = layer ? 52 : 55;
      for (let i = offset; i < offset + layerVertices; i += 3) {
        expect(Math.hypot(pos.getX(i), pos.getZ(i))).toBeCloseTo(radius, 4);
        expect(pos.getY(i)).toBe(-7);
        expect(pos.getY(i + 2) - pos.getY(i + 1)).toBeCloseTo(0.75, 5);
        expect(color.getW(i + 2)).toBe(0);
        if (!layer) peaks.push(pos.getY(i + 2));
        else {
          const far = i - layerVertices;
          expect(pos.getY(i + 2) / radius).toBeLessThan(pos.getY(far + 2) / 55);
          expect(color.getX(i + 1)).toBeLessThan(color.getX(far + 1));
        }
      }
      expect([...pos.array.slice(offset * 3, offset * 3 + 9)])
        .toEqual([...pos.array.slice((offset + layerVertices) * 3 - 9, (offset + layerVertices) * 3)]);
    }
    expect(Math.max(...peaks)).toBeGreaterThan(18);
    expect(Math.max(...peaks)).toBeLessThan(23);
    expect(Math.min(...peaks)).toBeLessThan(10);
    const indices = mesh.geometry.index.array;
    const half = indices.length / 2;
    expect([...indices.slice(0, half)].every(i => i < layerVertices)).toBe(true);
    expect([...indices.slice(half)].every(i => i >= layerVertices)).toBe(true);
    const copy = createTerraHighlandMassif(coarsePointer);
    expect([...copy.geometry.getAttribute('position').array]).toEqual([...pos.array]);
    copy.geometry.dispose();
    copy.material.dispose();
    const cycle = createChroniclesExteriorDaylight(scene, { toneMappingExposure: 1 }, plan);
    cycle.sync(765);
    const day = mesh.material.color.clone();
    cycle.sync(1380);
    const night = mesh.material.color.clone();
    expect(day.r + day.g + day.b).toBeGreaterThan(night.r + night.g + night.b);
    cycle.sync(765);
    expect(mesh.material.color).toEqual(day);
    expect(cycle.sync(765)).toBe(false);
  });

  it('leaves heath, coastal and Banner Road horizons unchanged', () => {
    for (const id of ['terra-b2', 'terra-a2', 'banner-road-first-book']) {
      const { scene } = exterior(id, true);
      expect(scene.getObjectByName('chronicles-terra-highland-massif')).toBeUndefined();
      if (id === 'banner-road-first-book')
        expect(scene.getObjectByName('chronicles-banner-distant-ridge')).toBeDefined();
    }
  });
});
