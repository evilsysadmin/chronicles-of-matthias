import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildChroniclesCampaignExterior, chroniclesBannerMeadowRootDistance } from './chroniclesCampaignExterior3D.js';
import rookwood from './maps/rookwood-first-book.json';

describe('Rookwood forest floor pigments', () => {
  it.each([false, true])('shades actual roots and preserves clearings and flat ground (coarse=%s)', coarsePointer => {
    const grid = rookwood.grid, width = grid[0].length, height = grid.length;
    const center = { x: 10, y: 7 };
    const build = mapId => {
      const scene = new THREE.Scene();
      buildChroniclesCampaignExterior(scene, { coarsePointer, scenePlan: {
        mapId, biome: 'forest', regionKind: 'wilderness', width, height, grid, center, content: [],
      } });
      return scene.getObjectByName('chronicles-campaign-terrain');
    };
    const ground = build(rookwood.id), replay = build(rookwood.id), legacy = build('generic-forest-fixture');
    const geometry = ground.geometry, p = geometry.getAttribute('position'), c = geometry.getAttribute('color');
    expect(ground.material.vertexColors).toBe(true);
    expect(legacy.material.vertexColors).toBe(false);
    expect(legacy.geometry.getAttribute('color')).toBeUndefined();
    expect(ground.material.map).toBe(legacy.material.map);
    expect(ground.position.y).toBe(legacy.position.y);
    expect(c.count).toBe(p.count);
    expect([...c.array]).toEqual([...replay.geometry.getAttribute('color').array]);
    expect(geometry.parameters.widthSegments).toBe(width + 6);
    expect(geometry.parameters.depthSegments).toBe(height + 6);
    expect(geometry.index.count / 3).toBeLessThan(1400);
    geometry.computeBoundingBox();
    legacy.geometry.computeBoundingBox();
    expect(geometry.boundingBox.min.toArray()).toEqual(legacy.geometry.boundingBox.min.toArray());
    expect(geometry.boundingBox.max.toArray()).toEqual(legacy.geometry.boundingBox.max.toArray());
    let dark = 0, light = 0;
    for (let i = 0; i < p.count; i++) {
      expect(Math.abs(p.getY(i))).toBeCloseTo(0.125, 6);
      const x = p.getX(i) / 4 + center.x, y = p.getZ(i) / 4 + center.y;
      const outside = x < -0.5 || x > width - 0.5 || y < -0.5 || y > height - 0.5;
      const d = outside ? 0 : chroniclesBannerMeadowRootDistance(grid, x, y);
      const shade = 1 - THREE.MathUtils.smoothstep(d, 0.35, 2.4);
      expect(c.getX(i)).toBeCloseTo(1 - 0.17 * shade, 6);
      expect(c.getY(i)).toBeCloseTo(1 - 0.32 * shade, 6);
      expect(c.getZ(i)).toBeCloseTo(1 - 0.23 * shade, 6);
      if (!outside && shade > 0.8) dark++;
      if (!outside && shade < 0.2) light++;
    }
    expect(dark).toBeGreaterThan(0);
    expect(light).toBeGreaterThan(0);
  });
});
