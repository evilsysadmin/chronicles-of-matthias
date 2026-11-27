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
  it.each([true, false])('builds one seamless bounded background ribbon (coarse=%s)', coarsePointer => {
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
    expect(mesh.geometry.index.count / 3).toBe(coarsePointer ? 256 : 384);
    const pos = mesh.geometry.getAttribute('position');
    const color = mesh.geometry.getAttribute('color');
    const peaks = [];
    for (let i = 0; i < pos.count; i += 3) {
      expect(Math.hypot(pos.getX(i), pos.getZ(i))).toBeCloseTo(55, 4);
      expect(pos.getY(i)).toBe(-7);
      expect(pos.getY(i + 2) - pos.getY(i + 1)).toBeCloseTo(0.75, 5);
      expect(color.getW(i + 2)).toBe(0);
      peaks.push(pos.getY(i + 2));
    }
    expect(Math.max(...peaks)).toBeGreaterThan(18);
    expect(Math.max(...peaks)).toBeLessThan(23);
    expect(Math.min(...peaks)).toBeLessThan(10);
    expect([...pos.array.slice(0, 9)]).toEqual([...pos.array.slice(-9)]);
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
