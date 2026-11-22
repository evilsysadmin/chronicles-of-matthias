import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_MEADOW_TILES, chroniclesMeadowTileAt,
} from './chroniclesLandscapeTiles.js';
import { buildTerraScenery } from './chroniclesTerraScenery.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const filledField = Array.from({ length: 12 }, () => '.'.repeat(12));
const meadow = (x, y, extra = {}) => chroniclesMeadowTileAt({
  grid: filledField, biome: 'plains', x, y, ...extra,
});
const part = (group, name) => group.getObjectByName('chronicles-terra-' + name);
const matrix = new THREE.Matrix4();

describe('reusable Terra meadow tiles', () => {
  it('defines immutable low-herb and flower communities for field and forest edges', () => {
    expect(Object.keys(CHRONICLES_MEADOW_TILES).sort()).toEqual(['edge', 'field']);
    for (const [family, recipes] of Object.entries(CHRONICLES_MEADOW_TILES)) {
      expect(recipes.length).toBeGreaterThan(2);
      expect(Object.isFrozen(recipes)).toBe(true);
      for (const recipe of recipes) {
        expect(Object.isFrozen(recipe)).toBe(true);
        expect(recipe.id).toMatch(/^[a-z-]+$/);
        expect(recipe.coverage).toBeGreaterThan(0);
        expect(recipe.coverage).toBeLessThanOrEqual(1);
        expect(recipe.tufts).toBeGreaterThanOrEqual(1);
        expect(recipe.tufts).toBeLessThanOrEqual(2);
        expect(recipe.flowerChance).toBeGreaterThanOrEqual(0);
        expect(recipe.flowerChance).toBeLessThanOrEqual(1);
        expect(recipe.herbChance).toBeGreaterThanOrEqual(0);
        expect(recipe.herbChance).toBeLessThanOrEqual(1);
        expect(meadow(4, 4).family).toBe('field');
      }
      if (family === 'edge') expect(recipes.some(r => r.herbChance > 0.3)).toBe(true);
    }
  });

  it('chooses families from real topology, never blocking or other-biome cells', () => {
    const grid = ['#####', '#...#', '#...#', '#...#', '#####'];
    expect(chroniclesMeadowTileAt({ grid, biome: 'plains', x: 1, y: 1 }).family)
      .toBe('edge');
    expect(chroniclesMeadowTileAt({ grid, biome: 'plains', x: 2, y: 2 }).family)
      .toBe('field');
    expect(chroniclesMeadowTileAt({ grid, biome: 'plains', x: 0, y: 0 })).toBeNull();
    expect(chroniclesMeadowTileAt({ grid, biome: 'hills', x: 2, y: 2 })).toBeNull();
    expect(chroniclesMeadowTileAt({ grid, biome: 'plains', x: 7, y: 2 })).toBeNull();
    expect(chroniclesMeadowTileAt({ grid, biome: 'plains', x: 1.2, y: 2 })).toBeNull();
  });

  it('groups neighbouring cells into coherent 3x3 habitat patches, still varying by patch', () => {
    const names = [];
    for (let y = 0; y < 12; y += 3) {
      for (let x = 0; x < 12; x += 3) {
        const chosen = meadow(x, y);
        names.push(chosen.id);
        expect(meadow(x + 1, y + 1).id).toBe(chosen.id);
        expect(meadow(x + 2, y + 2).id).toBe(chosen.id);
        expect(Object.isFrozen(chosen)).toBe(true);
      }
    }
    expect(new Set(names).size).toBeGreaterThan(1);
  });

  it('instantiates real grass, wildflowers and ferns on unreserved plains only', () => {
    const map = chroniclesMapById('terra-c4');
    const center = { x: 10, y: 7 };
    const keepClear = [{ x: 10, y: 7 }, { x: 10, y: 8 }];
    const args = { grid: map.grid, mapId: map.id, biome: map.biome,
      center, scenery: map.scenery, keepClear };
    const desktop = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const restored = buildTerraScenery(args);
    for (const name of ['tuft', 'flower', 'forestHerb', 'microrelief']) {
      const mesh = part(desktop, name);
      const cheap = part(mobile, name);
      const repeat = part(restored, name);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(cheap).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBeGreaterThan(0);
      expect(mesh.count).toBeGreaterThanOrEqual(cheap.count);
      expect(desktop.children.filter(child => child.name === mesh.name)).toHaveLength(1);
      mesh.geometry.computeBoundingBox();
      expect(mesh.geometry.boundingBox.min.y).toBeGreaterThanOrEqual(0);
      expect(mesh.geometry.boundingBox.max.y).toBeLessThan(0.95);
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getMatrixAt(index, matrix);
        const x = Math.round(matrix.elements[12] / 4) + center.x;
        const y = Math.round(matrix.elements[14] / 4) + center.y;
        expect(map.grid[y]?.[x], name + ' at ' + x + ',' + y).toBe('.');
        expect(keepClear.some(c => c.x === x && c.y === y)).toBe(false);
        const twin = new THREE.Matrix4();
        repeat.getMatrixAt(index, twin);
        expect(twin.elements).toEqual(matrix.elements);
        // All plants stay below knee height in their own traversable cell.
        const worldBox = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
        expect(worldBox.max.y).toBeLessThan(0.70);
        const cellWorldX = (x - center.x) * 4;
        const cellWorldZ = (y - center.y) * 4;
        expect(worldBox.min.x).toBeGreaterThan(cellWorldX - 1.8);
        expect(worldBox.max.x).toBeLessThan(cellWorldX + 1.8);
        expect(worldBox.min.z).toBeGreaterThan(cellWorldZ - 1.8);
        expect(worldBox.max.z).toBeLessThan(cellWorldZ + 1.8);
      }
    }
    // New reusable stones and low leaf litter share one batch. The surface
    // is visual only: opaque, ankle-high and never a collision or road tile.
    const stones = part(mobile, 'microrelief');
    const coarseTriangles = stones.geometry.getAttribute('position').count / 3;
    const desktopTriangles = part(desktop, 'microrelief').geometry.getAttribute('position').count / 3;
    expect(coarseTriangles).toBeLessThan(desktopTriangles);
    expect(stones.material.transparent).toBe(false);
    expect(stones.castShadow).toBe(false);
    expect(stones.instanceColor).toBeNull();
    expect(stones.count).toBeGreaterThan(5);
    expect(desktop.children.every(child => child.isInstancedMesh)).toBe(true);
  });

  it('makes mobile meadow plants legible without crossing a protected cell or growing above the knee', () => {
    const map = chroniclesMapById('terra-c4');
    const center = { x: 10, y: 7 };
    const keepClear = map.grid.flatMap((row, y) =>
      [...row].flatMap((tile, x) =>
        tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    const args = { grid: map.grid, mapId: map.id, biome: map.biome,
      center, scenery: map.scenery, keepClear };
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const desktop = buildTerraScenery(args);
    const repeat = buildTerraScenery({ ...args, coarsePointer: true });
    const protectedCells = new Set(keepClear.map(({ x, y }) => x + ',' + y));
    const pose = new THREE.Matrix4(), copy = new THREE.Matrix4();
    const height = new THREE.Vector3();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    for (const name of ['tuft', 'flower', 'forestHerb', 'microrelief']) {
      const mesh = part(mobile, name), full = part(desktop, name);
      const twin = part(repeat, name);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBeGreaterThan(0);
      expect(mesh.count).toBeLessThanOrEqual(full.count);
      expect(mobile.children.filter(child => child.name === mesh.name)).toHaveLength(1);
      mesh.geometry.computeBoundingBox();
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getMatrixAt(index, pose);
        twin.getMatrixAt(index, copy);
        expect(pose.elements).toEqual(copy.elements);
        pose.decompose(position, rotation, height);
        const x = Math.round(position.x / 4) + center.x;
        const y = Math.round(position.z / 4) + center.y;
        expect(map.grid[y]?.[x], name + ' at ' + x + ',' + y).toBe('.');
        expect(protectedCells.has(x + ',' + y)).toBe(false);
        const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(pose);
        expect(bounds.max.y).toBeLessThan(0.70);
        const worldX = (x - center.x) * 4;
        const worldZ = (y - center.y) * 4;
        expect(bounds.min.x).toBeGreaterThan(worldX - 1.8);
        expect(bounds.max.x).toBeLessThan(worldX + 1.8);
        expect(bounds.min.z).toBeGreaterThan(worldZ - 1.8);
        expect(bounds.max.z).toBeLessThan(worldZ + 1.8);
        if (name === 'flower') expect(height.y).toBeGreaterThan(1);
        if (name === 'forestHerb') expect(height.y).toBeCloseTo(0.65, 5);
      }
    }
    // Mobile keeps a small triangle budget, but the enlarged first-person
    // silhouette is real geometry rather than a UI sprite or generated art.
    const blades = part(mobile, 'tuft').geometry;
    expect(blades.getAttribute('position').count / 3).toBe(5);
    expect(part(mobile, 'tuft').count).toBeGreaterThan(240);
    expect(part(mobile, 'microrelief').count).toBeLessThan(90);
  });

  it('retains the authored Banner Road foliage instead of applying meadow recipes twice', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const args = { grid: map.grid, biome: map.biome, mapId: map.id,
      center: { x: 10, y: 7 }, scenery: map.scenery };
    const desktop = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const forest = part(desktop, 'forestHerb');
    expect(forest.count).toBeGreaterThan(40);
    expect(part(mobile, 'forestHerb').count).toBeGreaterThan(20);
    // The bespoke meadow-specific sedge geometry stays in Banner Road and
    // generic plains do not introduce that extra batch.
    expect(part(desktop, 'meadowSedge')).toBeInstanceOf(THREE.InstancedMesh);
    expect(part(buildTerraScenery({
      grid: chroniclesMapById('terra-c4').grid, biome: 'plains',
      center: { x: 10, y: 7 },
    }), 'meadowSedge')).toBeUndefined();
  });
});
