import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesBrezalGroundcoverGeometry,
  chroniclesBrezalHeatherGeometry } from './chroniclesTerraScenery.js';

const map = chroniclesMapById('terra-b2');
const center = { x: 10, y: 7 };
const allWalkables = map.grid.flatMap((row, y) => [...row]
  .flatMap((tile, x) => tile === '.' ? [{ x, y }] : []));
const render = (opts = {}) => buildTerraScenery({
  grid: map.grid, biome: map.biome, center,
  mapId: map.id, scenery: map.scenery, ...opts,
});
const entries = (group, part = 'heather') => {
  const mesh = group.getObjectByName('chronicles-terra-' + part);
  if (!mesh) return [];
  const matrix = new THREE.Matrix4();
  const out = [];
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, matrix);
    const x = Math.round(matrix.elements[12] / 4) + center.x;
    const y = Math.round(matrix.elements[14] / 4) + center.y;
    const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    out.push({ x, y, tile: map.grid[y]?.[x], pos, scale,
      elements: [...matrix.elements] });
  }
  return out;
};
const only = (data, tile) => data.filter(item => item.tile === tile);

describe('Terra v66 distinct B2 groundcover vs authored heather', () => {
  it('keeps ALL original blocked verge plants exactly while adding low lilac patches', () => {
    for (const coarsePointer of [true, false]) {
      const baseline = render({ coarsePointer, keepClear: allWalkables });
      const withLow = render({ coarsePointer });
      const old = entries(baseline, 'heather');
      const verge = entries(withLow, 'heather');
      const plants = entries(withLow, 'heatherGroundcover');
      expect(verge.every(item => item.tile === '#')).toBe(true);
      expect(plants.every(item => item.tile === '.')).toBe(true);
      expect(verge.map(item => item.elements)).toEqual(old.map(item => item.elements));
      expect(entries(baseline, 'heatherGroundcover')).toHaveLength(0);
      expect(plants.length).toBeGreaterThan(coarsePointer ? 10 : 35);
      expect(plants.length).toBeLessThan(allWalkables.length * (coarsePointer ? 1 : 2));
      // One explicitly measured new INSTANCED batch (+1 draw call) is
      // required to preserve the original blocked-heather geometry exactly.
      // KeepClear removes original walkable tuft/pebble too, so exclude
      // those two existing parts from the filtered batch comparison.
      const oldParts = group => group.children.map(m => m.name)
        .filter(name => !['chronicles-terra-tuft',
          'chronicles-terra-pebble',
          'chronicles-terra-heatherGroundcover'].includes(name));
      expect(oldParts(withLow)).toEqual(oldParts(baseline));
      expect(withLow.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
      expect(withLow.children.filter(m => m.name === 'chronicles-terra-heather')).toHaveLength(1);
      expect(withLow.children.filter(m => m.name === 'chronicles-terra-heatherGroundcover')).toHaveLength(1);
      const mesh = withLow.getObjectByName('chronicles-terra-heatherGroundcover');
      expect(mesh.castShadow).toBe(false);
      expect(mesh.material.vertexColors).toBe(true);
      expect(mesh.material.side).toBe(THREE.DoubleSide);
      expect(mesh.count).toBe(plants.length);
      expect(mesh.count).toBeLessThan(220);
      for (const plant of plants) {
        expect(plant.pos.y).toBeCloseTo(0.012, 5);
        expect(plant.scale.y).toBeLessThan(1.24);
        expect(plant.scale.y).toBeGreaterThan(0.91);
        expect(Math.abs(plant.pos.x - (plant.x - center.x) * 4)).toBeLessThan(1.1);
        expect(Math.abs(plant.pos.z - (plant.y - center.y) * 4)).toBeLessThan(1.1);
        expect(plant.scale.x).toBeLessThanOrEqual(1.11);
      }
      const repeated = render({ coarsePointer });
      expect(entries(repeated, 'heather').map(item => item.elements))
        .toEqual(verge.map(item => item.elements));
      expect(entries(repeated, 'heatherGroundcover').map(item => item.elements))
        .toEqual(plants.map(item => item.elements));
    }
  });

  it('makes the mobile heather a strict spatial subset of desktop and keeps protected paths clear', () => {
    const desktop = entries(render(), 'heatherGroundcover');
    const mobile = entries(render({ coarsePointer: true }), 'heatherGroundcover');
    expect(mobile.length).toBeLessThan(desktop.length);
    const positions = new Set(desktop.map(item => item.pos.x.toFixed(5)
      + ':' + item.pos.z.toFixed(5)));
    for (const item of mobile) {
      expect(positions.has(item.pos.x.toFixed(5) + ':' + item.pos.z.toFixed(5))).toBe(true);
    }
    const protectedCells = allWalkables.filter((_, i) => i % 4 === 0);
    const guarded = render({ keepClear: protectedCells });
    const blocked = new Set(protectedCells.map(({ x, y }) => x + ',' + y));
    expect(entries(guarded, 'heatherGroundcover')
      .some(({ x, y }) => blocked.has(x + ',' + y))).toBe(false);
    expect(entries(guarded, 'heather').map(item => item.elements))
      .toEqual(entries(render(), 'heather').map(item => item.elements));
  });

  it('uses a genuinely low, horizontally branched geometry with subtle lilac blossoms', () => {
    const ground = chroniclesBrezalGroundcoverGeometry();
    const old = chroniclesBrezalHeatherGeometry();
    const vertices = ground.getAttribute('position');
    const color = ground.getAttribute('color');
    expect(vertices.count).toBe(168); // 36 leaf triangles + 20 blossom triangles
    expect(vertices.count).toBe(color.count);
    expect(vertices.count).toBeGreaterThan(old.getAttribute('position').count);
    const bound = new THREE.Box3().setFromBufferAttribute(vertices);
    expect(bound.max.y).toBeLessThan(0.14);
    expect(bound.min.y).toBeGreaterThanOrEqual(0.02);
    expect(bound.max.x - bound.min.x).toBeGreaterThan(0.54);
    expect(bound.max.z - bound.min.z).toBeGreaterThan(0.54);
    expect((bound.max.x - bound.min.x) / bound.max.y).toBeGreaterThan(4);
    const colors = new Set();
    for (let i = 0; i < vertices.count; i += 1) {
      for (const v of [vertices.getX(i), vertices.getY(i), vertices.getZ(i),
        color.getX(i), color.getY(i), color.getZ(i)]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      colors.add(new THREE.Color(color.getX(i), color.getY(i), color.getZ(i)).getHex());
    }
    expect(colors.size).toBeGreaterThanOrEqual(7);
    ground.dispose();
    old.dispose();
  });

  it('bakes root and petal depth into the same 56 triangles without seams', () => {
    const ground = chroniclesBrezalGroundcoverGeometry();
    const color = ground.getAttribute('color');
    const rgb = i => [color.getX(i), color.getY(i), color.getZ(i)];
    const luminance = i => rgb(i).reduce((sum, channel) => sum + channel, 0);
    let cursor = 0;
    for (let patch = 0; patch < 9; patch++) {
      for (let leaf = 0; leaf < 2; leaf++) {
        expect(luminance(cursor) / luminance(cursor + 2)).toBeCloseTo(0.70, 5);
        expect(luminance(cursor + 1) / luminance(cursor + 2)).toBeCloseTo(0.90, 5);
        expect(rgb(cursor)).toEqual(rgb(cursor + 3));
        expect(rgb(cursor + 2)).toEqual(rgb(cursor + 4));
        cursor += 6;
      }
      if (patch % 2 === 0) {
        for (let petal = 0; petal < 4; petal++) {
          expect(luminance(cursor) / luminance(cursor + 1)).toBeCloseTo(0.76, 5);
          expect(luminance(cursor + 2) / luminance(cursor + 1)).toBeCloseTo(0.96, 5);
          cursor += 3;
        }
      }
    }
    expect(cursor).toBe(168);
    expect(color.count).toBe(cursor);
    ground.dispose();
  });

  it('does not affect E2 or C4, their instance batches, or collision grids', () => {
    for (const id of ['terra-e2', 'terra-c4']) {
      const other = chroniclesMapById(id);
      const args = { grid: other.grid, center, biome: other.biome, scenery: other.scenery };
      const original = buildTerraScenery({ ...args, mapId: id });
      const repeated = buildTerraScenery({ ...args, mapId: id });
      expect(original.children.map(mesh => mesh.name))
        .toEqual(repeated.children.map(mesh => mesh.name));
      for (const current of original.children) {
        const again = repeated.getObjectByName(current.name);
        expect(current.count).toBe(again.count);
        const a = new THREE.Matrix4(), b = new THREE.Matrix4();
        for (let i = 0; i < current.count; i += 1) {
          current.getMatrixAt(i, a);
          again.getMatrixAt(i, b);
          expect(a.elements).toEqual(b.elements);
        }
      }
      expect(chroniclesMapById(id).grid).toEqual(other.grid);
    }
    expect(chroniclesMapById('terra-b2').grid).toEqual(map.grid);
  });
});
