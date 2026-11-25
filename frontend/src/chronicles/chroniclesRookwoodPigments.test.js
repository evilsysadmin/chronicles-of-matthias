import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import rookwood from './maps/rookwood-first-book.json';

describe('Rookwood grove pigments', () => {
  it.each([false, true])('uses deterministic coherent tree colors without changing batches (coarse=%s)', coarsePointer => {
    const grid = rookwood.grid;
    const center = { x: Math.floor(grid[0].length / 2), y: Math.floor(grid.length / 2) };
    const build = mapId => {
      const scene = new THREE.Scene();
      buildChroniclesCampaignExterior(scene, { coarsePointer, scenePlan: {
        mapId, regionKind: 'wilderness', biome: 'forest', center, grid,
        width: grid[0].length, height: grid.length, content: [],
      } });
      return scene.getObjectByName('chronicles-campaign-forest');
    };
    const group = build(rookwood.id), replay = build(rookwood.id), generic = build('generic-forest-fixture');
    expect(group.children).toHaveLength(3);
    const [trunks, lower, upper] = group.children;
    const matrix = new THREE.Matrix4(), twin = new THREE.Matrix4();
    const crown = new THREE.Color(), other = new THREE.Color(), bark = new THREE.Color();
    const cool = new THREE.Color('#b9d0be'), warm = new THREE.Color('#e7e1b6');
    const dark = new THREE.Color('#b9b1a3'), pale = new THREE.Color('#e3d4ba');
    let cooler = 0, warmer = 0;
    for (let part = 0; part < 3; part++) {
      const mesh = group.children[part];
      expect(mesh.isInstancedMesh).toBe(true);
      expect(mesh.count).toBe(generic.children[part].count);
      expect(mesh.instanceColor.count).toBe(mesh.count);
      expect(generic.children[part].instanceColor).toBeNull();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        replay.children[part].getMatrixAt(i, twin);
        expect(matrix.elements).toEqual(twin.elements);
        mesh.getColorAt(i, crown);
        replay.children[part].getColorAt(i, other);
        expect(crown.toArray()).toEqual(other.toArray());
      }
    }
    for (let i = 0; i < trunks.count; i++) {
      trunks.getMatrixAt(i, matrix);
      const x = matrix.elements[12] / 4 + center.x, y = matrix.elements[14] / 4 + center.y;
      const grove = 0.5 + 0.5 * Math.sin(x * 0.42 + y * 0.19) * Math.cos(y * 0.33 - x * 0.21);
      lower.getColorAt(i, crown);
      upper.getColorAt(i, other);
      trunks.getColorAt(i, bark);
      expect(crown.toArray()).toEqual(other.toArray());
      const blend = (crown.r - cool.r) / (warm.r - cool.r);
      expect(blend).toBeGreaterThanOrEqual(grove * 0.82 - 1e-6);
      expect(blend).toBeLessThanOrEqual(grove * 0.82 + 0.18 + 1e-6);
      expect(bark.r).toBeCloseTo(dark.r + (pale.r - dark.r) * blend, 5);
      if (blend < 0.30) cooler++;
      if (blend > 0.70) warmer++;
    }
    expect(cooler).toBeGreaterThan(0);
    expect(warmer).toBeGreaterThan(0);
  });
});
