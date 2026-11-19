import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import {
  chroniclesRoadsideShoulderGeometry, createBannerRoadShoulders,
} from './chroniclesRoadsideShoulders.js';

const map = chroniclesMapById('banner-road-first-book');
const center = { x: 10, y: 7 };
const roadCells = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
  tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
const exposed = roadCells.flatMap(({ x, y }) =>
  [[0, 1], [1, 0], [0, -1], [-1, 0]].flatMap(([dx, dy]) =>
    map.grid[y + dy]?.[x + dx] !== undefined
      && !roadCells.some(cell => cell.x === x + dx && cell.y === y + dy)
      ? [{ x, y, dx, dy }] : []));

describe('Banner Road organic grass/cobble shoulders', () => {
  it('dresses only outer paved edges and never creates a wall or collider', () => {
    const args = { grid: map.grid, roadCells, center };
    const full = createBannerRoadShoulders(args);
    const mobile = createBannerRoadShoulders({ ...args, coarsePointer: true });
    const again = createBannerRoadShoulders(args);
    expect(full).toBeInstanceOf(THREE.InstancedMesh);
    expect(full.count).toBe(exposed.length);
    expect(mobile.count).toBe(exposed.length);
    expect(full.count).toBeGreaterThan(25);
    expect(full.name).toBe('chronicles-banner-road-shoulders');
    expect(full.material.vertexColors).toBe(true);
    expect(full.material.transparent).toBe(false);
    expect(full.castShadow).toBe(false);
    expect(full.instanceColor.count).toBe(full.count);

    const m = new THREE.Matrix4();
    const twin = new THREE.Matrix4();
    const tint = new THREE.Color();
    const sameTint = new THREE.Color();
    const mapped = new Set();
    for (let i = 0; i < full.count; i += 1) {
      full.getMatrixAt(i, m);
      again.getMatrixAt(i, twin);
      expect(m.elements).toEqual(twin.elements);
      full.getColorAt(i, tint);
      again.getColorAt(i, sameTint);
      expect(tint.getHex()).toBe(sameTint.getHex());
      const matching = exposed.filter(({ x, y, dx, dy }) =>
        Math.abs(m.elements[12] - ((x - center.x) * 4 + dx * 1.66)) < 0.001
          && Math.abs(m.elements[14] - ((y - center.y) * 4 + dy * 1.66)) < 0.001);
      expect(matching).toHaveLength(1);
      const e = matching[0];
      mapped.add(e.x + ',' + e.y + ':' + e.dx + ',' + e.dy);
      expect(map.grid[e.y][e.x]).toBe('.');
      expect(roadCells.some(r => r.x === e.x + e.dx && r.y === e.y + e.dy)).toBe(false);
    }
    expect(mapped.size).toBe(exposed.length);
    // Paving is only 1.64m from the straight centreline; 1.66m shoulder
    // offsets let moss begin at the edge while keeping the walkable lane.
    expect(full.geometry.boundingBox.min.z).toBeGreaterThan(-0.1);
    expect(mobile.geometry.boundingBox.max.y).toBeLessThan(0.25);
  });

  it('has low bounded terrain patches, faint moss intrusion and a lighter touch model', () => {
    const desktop = chroniclesRoadsideShoulderGeometry();
    const touch = chroniclesRoadsideShoulderGeometry({ coarsePointer: true });
    const restored = chroniclesRoadsideShoulderGeometry();
    const p = desktop.getAttribute('position');
    expect(p.count).toBeGreaterThan(touch.getAttribute('position').count);
    expect(p.count).toBeLessThanOrEqual(100);
    expect(desktop.getAttribute('color').count).toBe(p.count);
    expect(desktop.boundingBox.min.x).toBeGreaterThan(-1.85);
    expect(desktop.boundingBox.max.x).toBeLessThan(1.85);
    expect(desktop.boundingBox.min.z).toBeGreaterThan(-0.09);
    expect(desktop.boundingBox.max.z).toBeLessThan(0.55);
    expect(desktop.boundingBox.min.y).toBeGreaterThanOrEqual(0);
    expect(desktop.boundingBox.max.y).toBeLessThan(0.25);
    expect([...restored.getAttribute('position').array]).toEqual([...p.array]);
    for (const coord of p.array) expect(Number.isFinite(coord)).toBe(true);
    [desktop, touch, restored].forEach(g => g.dispose());
  });

  it('adds one visual-only batch to Banner Road, not settlements or other biomes', () => {
    const plan = { id: map.id, mapId: map.id, regionKind: 'wilderness', biome: map.biome,
      width: map.grid[0].length, height: map.grid.length,
      grid: map.grid, center, content: [], scenery: [] };
    const build = scenePlan => {
      const scene = new THREE.Scene();
      buildChroniclesCampaignExterior(scene, { scenePlan });
      return scene;
    };
    const main = build(plan);
    const edge = main.getObjectByName('chronicles-banner-road-shoulders');
    const road = main.getObjectByName('chronicles-campaign-road');
    expect(edge).toBeInstanceOf(THREE.InstancedMesh);
    expect(road).toBeInstanceOf(THREE.InstancedMesh);
    expect(road.count).toBe(roadCells.length);
    expect(main.children.filter(m => m.name === 'chronicles-banner-road-shoulders')).toHaveLength(1);
    expect(build({ ...plan, mapId: 'terra-c4' })
      .getObjectByName('chronicles-banner-road-shoulders')).toBeUndefined();
    expect(build({ ...plan, regionKind: 'settlement' })
      .getObjectByName('chronicles-banner-road-shoulders')).toBeUndefined();
  });
});
