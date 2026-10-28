import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TERRA_SCENERY_MARGIN, buildTerraScenery, chroniclesOrganicRockGeometry, chroniclesBrezalHeatherGeometry, chroniclesTerraSceneryBiomes } from './chroniclesTerraScenery.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';

const CLUTTER = new Set(['tuft', 'flower', 'pebble', 'snowMound', 'ember']);

function instanceCells(group, center) {
  const out = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  group.children.forEach((mesh) => {
    const part = mesh.name.replace('chronicles-terra-', '');
    for (let i = 0; i < mesh.count; i += 1) {
      mesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      out.push({ part, x: Math.round(position.x / 4) + center.x, y: Math.round(position.z / 4) + center.y });
    }
  });
  return out;
}

describe('Terra scenery', () => {
  it('dresses every biome but forest, whose canopy already exists', () => {
    expect(chroniclesTerraSceneryBiomes().sort()).toEqual(['ash', 'coast', 'hills', 'marsh', 'plains', 'snow']);
  });

  it.each(['terra-c4', 'terra-e2', 'terra-b1', 'terra-a2', 'terra-d5', 'terra-f4'])('%s only blocks where the grid blocks', (mapId) => {
    const map = chroniclesMapById(mapId);
    const center = { x: 10, y: 7 };
    const group = buildTerraScenery({ grid: map.grid, center, biome: map.biome, scenery: map.scenery });
    const cells = instanceCells(group, center);
    expect(cells.length).toBeGreaterThan(100);
    const height = map.grid.length;
    const width = map.grid[0].length;
    cells.filter(({ part }) => !CLUTTER.has(part)).forEach(({ part, x, y }) => {
      const inside = x >= 0 && y >= 0 && x < width && y < height;
      if (inside) expect(map.grid[y][x], `${part} at ${x},${y}`).toBe('#');
      else expect(x >= -TERRA_SCENERY_MARGIN - 1 && y >= -TERRA_SCENERY_MARGIN - 1).toBe(true);
    });
  });

  it('renders marisma pools as rounded, textured and deterministic water without blocking roads', () => {
    const marsh = chroniclesMapById('terra-d5');
    const args = { grid: marsh.grid, center: { x: 10, y: 7 },
      biome: marsh.biome, mapId: marsh.id, scenery: marsh.scenery };
    const desktop = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const reload = buildTerraScenery(args);
    const pool = desktop.getObjectByName('chronicles-terra-pool');
    const cheap = mobile.getObjectByName('chronicles-terra-pool');
    const again = reload.getObjectByName('chronicles-terra-pool');
    expect(pool).toBeInstanceOf(THREE.InstancedMesh);
    expect(cheap).toBeInstanceOf(THREE.InstancedMesh);
    expect(pool.count).toBeGreaterThan(5);
    expect(cheap.count).toBeGreaterThan(0);
    expect(pool.count).toBeGreaterThanOrEqual(cheap.count);
    expect(pool.geometry.parameters.radialSegments).toBe(24);
    expect(cheap.geometry.parameters.radialSegments).toBe(14);
    expect(pool.geometry.parameters.height).toBeCloseTo(0.06);
    expect(pool.material.map).toBe(chroniclesPixelTexture('bogwater'));
    expect(cheap.material.map).toBe(pool.material.map);
    expect(pool.material.transparent).toBe(false);
    expect(pool.material.roughness).toBeCloseTo(0.28);
    expect(pool.castShadow).toBe(false);
    expect(pool.instanceColor?.count).toBe(pool.count);
    expect(desktop.children.filter(child => child.name === 'chronicles-terra-pool')).toHaveLength(1);
    const matrix = new THREE.Matrix4();
    const twin = new THREE.Matrix4();
    const tint = new THREE.Color();
    const twinTint = new THREE.Color();
    const colours = new Set();
    for (let i = 0; i < pool.count; i += 1) {
      pool.getMatrixAt(i, matrix);
      again.getMatrixAt(i, twin);
      expect(twin.elements).toEqual(matrix.elements);
      pool.getColorAt(i, tint);
      again.getColorAt(i, twinTint);
      expect(tint.getHex()).toBe(twinTint.getHex());
      colours.add(tint.getHex());
      const x = Math.round(matrix.elements[12] / 4) + args.center.x;
      const y = Math.round(matrix.elements[14] / 4) + args.center.y;
      if (x >= 0 && y >= 0 && y < marsh.grid.length && x < marsh.grid[y].length) {
        expect(marsh.grid[y][x]).toBe('#');
      }
    }
    expect(colours.size).toBeGreaterThan(1);
    const texture = pool.material.map;
    expect(texture.userData.chroniclesPixelArt).toMatchObject({ kind: 'bogwater', size: 64 });
    expect(texture.image.data.length).toBe(64 * 64 * 4);
    const tones = new Set();
    for (let i = 0; i < texture.image.data.length; i += 4) {
      expect(texture.image.data[i + 3]).toBe(255);
      tones.add(Array.from(texture.image.data.slice(i, i + 3)).join(','));
    }
    expect(tones.size).toBeGreaterThan(5);
    expect(buildTerraScenery({ ...args, biome: 'hills' })
      .getObjectByName('chronicles-terra-pool')).toBeUndefined();
  });

  it('draws camp set pieces and keeps roads clear of clutter', () => {
    const map = chroniclesMapById('terra-a2');
    const center = { x: 10, y: 7 };
    const road = map.grid.flatMap((row, y) => [...row].map((tile, x) => ({ x, y, tile })))
      .filter(({ x, y, tile }) => tile === '.' && (x === center.x || y === center.y));
    const group = buildTerraScenery({ grid: map.grid, center, biome: map.biome, scenery: map.scenery, keepClear: road });
    const names = group.children.map((mesh) => mesh.name);
    expect(names).toContain('chronicles-terra-tent');
    expect(names).toContain('chronicles-terra-flame');
    const onRoad = new Set(road.map(({ x, y }) => `${x},${y}`));
    const clutter = instanceCells(group, center).filter(({ part }) => CLUTTER.has(part));
    // Clutter is jittered inside its own cell, never onto the road cells.
    expect(clutter.filter(({ x, y }) => onRoad.has(`${x},${y}`)).length).toBeLessThan(clutter.length * 0.2);
  });

  it('smooths jagged boulders at full quality while keeping an inexpensive mobile mesh', () => {
    const full = chroniclesOrganicRockGeometry();
    const coarse = chroniclesOrganicRockGeometry({ coarsePointer: true });
    const triangles = (geometry) => geometry.index
      ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3;
    expect(triangles(full)).toBe(80);
    expect(triangles(coarse)).toBe(20);
    expect(full.getAttribute('position').count).toBeLessThan(300);
    const unique = new Set();
    const points = full.getAttribute('position');
    for (let i = 0; i < points.count; i += 1) {
      const values = [points.getX(i), points.getY(i), points.getZ(i)];
      values.forEach((v) => expect(Number.isFinite(v)).toBe(true));
      unique.add(values.map((v) => v.toFixed(5)).join(','));
    }
    expect(unique.size).toBeGreaterThan(15);
    const twin = chroniclesOrganicRockGeometry();
    expect([...twin.getAttribute('position').array]).toEqual([...points.array]);
    const oldRadius = new THREE.IcosahedronGeometry(1, 1).getAttribute('position');
    expect([...points.array]).not.toEqual([...oldRadius.array]);
    full.dispose();
    coarse.dispose();
    twin.dispose();
  });

  it('keeps one instanced draw per scenery part even with better silhouettes', () => {
    const map = chroniclesMapById('terra-e2');
    const args = { grid: map.grid, center: { x: 10, y: 7 }, biome: 'hills', scenery: map.scenery };
    const detailed = buildTerraScenery(args);
    const compact = buildTerraScenery({ ...args, coarsePointer: true });
    const boulders = detailed.getObjectByName('chronicles-terra-boulder');
    const cheapBoulders = compact.getObjectByName('chronicles-terra-boulder');
    expect(boulders).toBeInstanceOf(THREE.InstancedMesh);
    expect(cheapBoulders).toBeInstanceOf(THREE.InstancedMesh);
    // Coarse mode intentionally thins the *outer* scenery ring, so its
    // instance count may be smaller; never assume full/coarse parity.
    expect(boulders.count).toBeGreaterThanOrEqual(cheapBoulders.count);
    expect(boulders.geometry.getAttribute('position').count).toBeGreaterThan(
      cheapBoulders.geometry.getAttribute('position').count,
    );
    expect(boulders.material.flatShading).toBe(false);
    expect(cheapBoulders.material.flatShading).toBe(true);
    const names = detailed.children.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect(compact.children.every((m) => names.includes(m.name))).toBe(true);
    expect(detailed.children.every((m) => m.isInstancedMesh)).toBe(true);
    expect(compact.children.every((m) => m.isInstancedMesh)).toBe(true);
  });

  it('adds low flowering heather exclusively on B2 solid border cells, never on paths', () => {
    const b2 = chroniclesMapById('terra-b2');
    const center = { x: 10, y: 7 };
    const args = { grid: b2.grid, center, biome: b2.biome, mapId: b2.id, scenery: b2.scenery };
    const detailed = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const heather = detailed.getObjectByName('chronicles-terra-heather');
    const reduced = mobile.getObjectByName('chronicles-terra-heather');
    expect(heather).toBeInstanceOf(THREE.InstancedMesh);
    expect(reduced).toBeInstanceOf(THREE.InstancedMesh);
    expect(heather.count).toBeGreaterThan(5);
    expect(reduced.count).toBeGreaterThan(0);
    expect(reduced.count).toBeLessThan(heather.count);
    expect(heather.count).toBeLessThan(70); // Bounded one draw call.
    expect(heather.castShadow).toBe(false);
    expect(heather.material.vertexColors).toBe(true);
    expect(detailed.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    const matrix = new THREE.Matrix4();
    const world = new THREE.Vector3();
    for (let i = 0; i < heather.count; i += 1) {
      heather.getMatrixAt(i, matrix);
      world.setFromMatrixPosition(matrix);
      const x = Math.round(world.x / 4) + center.x;
      const y = Math.round(world.z / 4) + center.y;
      expect(b2.grid[y][x], `heather at ${x},${y}`).toBe('#');
      expect(Math.max(Math.abs(world.x - (x - center.x) * 4),
        Math.abs(world.z - (y - center.y) * 4))).toBeLessThan(1.5);
      expect([[0, -1], [1, 0], [0, 1], [-1, 0]]
        .some(([dx, dy]) => b2.grid[y + dy]?.[x + dx] === '.')).toBe(true);
    }
    expect(buildTerraScenery({ ...args, mapId: 'terra-e2' })
      .getObjectByName('chronicles-terra-heather')).toBeUndefined();
    expect(buildTerraScenery({ ...args, biome: 'plains' })
      .getObjectByName('chronicles-terra-heather')).toBeUndefined();
    const again = buildTerraScenery(args).getObjectByName('chronicles-terra-heather');
    expect(again.count).toBe(heather.count);
    heather.getMatrixAt(0, matrix);
    const compare = new THREE.Matrix4();
    again.getMatrixAt(0, compare);
    expect(compare.elements).toEqual(matrix.elements);
  });

  it('uses a small, finite, vertex-coloured heather silhouette without textures', () => {
    const geometry = chroniclesBrezalHeatherGeometry();
    const vertices = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    expect(vertices.count).toBeLessThanOrEqual(60);
    expect(color.count).toBe(vertices.count);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.min.y).toBeGreaterThanOrEqual(0);
    expect(geometry.boundingBox.max.y).toBeLessThan(0.7);
    for (const value of vertices.array) expect(Number.isFinite(value)).toBe(true);
    geometry.dispose();
  });

  it('weathers only B2 boulders with deterministic per-instance lichen tones', () => {
    const b2 = chroniclesMapById('terra-b2');
    const args = { grid: b2.grid, center: { x: 10, y: 7 },
      biome: b2.biome, scenery: b2.scenery };
    const themed = buildTerraScenery({ ...args, mapId: b2.id });
    const repeat = buildTerraScenery({ ...args, mapId: b2.id });
    const plain = buildTerraScenery({ ...args, mapId: 'terra-e2' });
    const rocks = themed.getObjectByName('chronicles-terra-boulder');
    const matching = repeat.getObjectByName('chronicles-terra-boulder');
    const unchanged = plain.getObjectByName('chronicles-terra-boulder');
    expect(rocks).toBeInstanceOf(THREE.InstancedMesh);
    expect(rocks.count).toBeGreaterThan(20);
    expect(rocks.instanceColor).toBeTruthy();
    expect(unchanged.instanceColor).toBeNull();
    expect(rocks.count).toBe(unchanged.count);
    expect(rocks.geometry.getAttribute('position').count)
      .toBe(unchanged.geometry.getAttribute('position').count);
    expect(rocks.material.map).toBe(unchanged.material.map);
    const matrix = new THREE.Matrix4();
    const otherMatrix = new THREE.Matrix4();
    const tint = new THREE.Color();
    const otherTint = new THREE.Color();
    const variations = new Set();
    for (let i = 0; i < rocks.count; i += 1) {
      rocks.getMatrixAt(i, matrix);
      unchanged.getMatrixAt(i, otherMatrix);
      expect(matrix.elements).toEqual(otherMatrix.elements);
      rocks.getColorAt(i, tint);
      matching.getColorAt(i, otherTint);
      expect(tint.getHex()).toBe(otherTint.getHex());
      variations.add(tint.getHex());
    }
    expect(variations.size).toBeGreaterThan(1);
    expect(themed.children.length).toBe(plain.children.length + 1); // Heather already exclusive to B2.
  });

  it('is deterministic', () => {
    const map = chroniclesMapById('terra-e2');
    const center = { x: 10, y: 7 };
    const a = instanceCells(buildTerraScenery({ grid: map.grid, center, biome: 'hills' }), center);
    const b = instanceCells(buildTerraScenery({ grid: map.grid, center, biome: 'hills' }), center);
    expect(a).toEqual(b);
  });
});
