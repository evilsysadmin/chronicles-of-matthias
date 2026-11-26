import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_LANDSCAPE_TILES,
  chroniclesLandscapeTileAt,
} from './chroniclesLandscapeTiles.js';
import {
  buildTerraScenery,
  chroniclesMountainCragGeometry,
} from './chroniclesTerraScenery.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const grid = ['#####', '#...#', '#####'];
const choose = (x, y, extra = {}) => chroniclesLandscapeTileAt({
  grid, biome: 'hills', x, y, ...extra,
});

describe('reusable highland landscape tiles', () => {
  it('exposes immutable, meaningful tile variants instead of a repeating texture square', () => {
    const families = CHRONICLES_LANDSCAPE_TILES.hills;
    expect(Object.keys(families).sort()).toEqual(['backdrop', 'interior', 'verge']);
    expect(families.verge.length).toBeGreaterThan(1);
    expect(families.interior.length).toBeGreaterThan(2);
    expect(families.backdrop.length).toBeGreaterThan(1);
    for (const recipes of Object.values(families)) {
      expect(Object.isFrozen(recipes)).toBe(true);
      for (const recipe of recipes) {
        expect(Object.isFrozen(recipe)).toBe(true);
        expect(recipe.boulderCount).toBeGreaterThan(0);
        expect(recipe.boulderCount).toBeLessThanOrEqual(3);
        expect(recipe.boulderSize).toBeGreaterThan(0);
        expect(recipe.cragChance).toBeGreaterThanOrEqual(0);
        expect(recipe.cragChance).toBeLessThanOrEqual(1);
        expect(recipe.bushChance).toBeGreaterThanOrEqual(0);
        expect(recipe.bushChance).toBeLessThanOrEqual(1);
      }
    }
  });

  it('selects low verges next to walkable ground, higher ridges away from it', () => {
    expect(choose(2, 0).family).toBe('verge');
    expect(choose(0, 0).family).toBe('interior');
    expect(choose(-1, -1, { outside: true }).family).toBe('backdrop');
    expect(choose(2, 1)).toBeNull(); // Existing walkable ground is sacred.
    expect(choose(9, 9)).toBeNull();
    expect(choose(0, 0, { biome: 'plains' })).toBeNull();
    expect(choose(0.5, 0)).toBeNull();
    expect(choose(2, 0).cragChance).toBe(0);
  });

  it('is stable across reloads, traversal orders and mobile/desktop mode', () => {
    const cells = Array.from({ length: 80 }, (_, i) => ({
      x: i % 10 - 2, y: Math.floor(i / 10) - 2,
    }));
    const a = cells.map(({ x, y }) => choose(x, y, { outside: true })?.id);
    const b = [...cells].reverse().map(({ x, y }) => choose(x, y, { outside: true })?.id).reverse();
    expect(a).toEqual(b);
    expect(new Set(a).size).toBeGreaterThan(1);
    expect(Object.isFrozen(choose(0, 0))).toBe(true);
  });

  it('builds an irregular mountain ridge geometry within the same single instanced part', () => {
    const desktop = chroniclesMountainCragGeometry();
    const mobile = chroniclesMountainCragGeometry({ coarsePointer: true });
    const triangles = geo => geo.index.count / 3;
    expect(triangles(desktop)).toBeGreaterThan(triangles(mobile));
    expect(triangles(desktop)).toBeLessThanOrEqual(100);
    expect(triangles(mobile)).toBeLessThanOrEqual(40);
    for (const geo of [desktop, mobile]) {
      geo.computeBoundingBox();
      expect(geo.getAttribute('uv')).toBeTruthy();
      expect(geo.boundingBox.min.y).toBeGreaterThanOrEqual(0);
      expect(geo.boundingBox.max.y).toBeLessThan(1.5);
      const positions = geo.getAttribute('position').array;
      expect([...positions].every(Number.isFinite)).toBe(true);
    }
    desktop.dispose();
    mobile.dispose();
  });

  it.each([true, false])('closes weathered summits with upward faces and valid planar UVs (coarse=%s)', coarsePointer => {
    const geo = chroniclesMountainCragGeometry({ coarsePointer });
    const sides = coarsePointer ? 5 : 7;
    const peaks = coarsePointer ? 1 : 2;
    const position = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    const index = geo.index.array;
    const facesPerPeak = sides * 6 + sides - 2;
    expect(index.length / 3).toBe(peaks * facesPerPeak);
    expect(position.count).toBe(peaks * sides * 5);
    const v = i => new THREE.Vector3().fromBufferAttribute(position, i);
    for (let peak = 0; peak < peaks; peak++) {
      const base = peak * sides * 5;
      const rim = base + 3 * sides, cap = base + 4 * sides;
      for (let i = 0; i < sides; i++) {
        expect(v(rim + i).distanceTo(v(cap + i))).toBe(0);
      }
      expect(v(cap).distanceTo(v(cap + 2))).toBeGreaterThan(0.12);
      const firstFace = (peak * facesPerPeak + sides * 6) * 3;
      for (let i = 0; i < sides - 2; i++) {
        const [a, b, c] = index.slice(firstFace + i * 3, firstFace + i * 3 + 3);
        expect([a, b, c].every(n => n >= cap && n < cap + sides)).toBe(true);
        expect(v(b).sub(v(a)).cross(v(c).sub(v(a))).y).toBeGreaterThan(0);
        const area = (uv.getX(b) - uv.getX(a)) * (uv.getY(c) - uv.getY(a))
          - (uv.getY(b) - uv.getY(a)) * (uv.getX(c) - uv.getX(a));
        expect(Math.abs(area)).toBeGreaterThan(0.001);
      }
    }
    geo.dispose();
  });

  it('renders only solid cells with batched mountain, rock and vegetation parts', () => {
    const map = chroniclesMapById('terra-e2');
    const center = { x: 10, y: 7 };
    const plan = { grid: map.grid, biome: 'hills', center, scenery: map.scenery };
    const desktop = buildTerraScenery(plan);
    const mobile = buildTerraScenery({ ...plan, coarsePointer: true });
    const restored = buildTerraScenery(plan);
    const crag = desktop.getObjectByName('chronicles-terra-crag');
    expect(crag).toBeInstanceOf(THREE.InstancedMesh);
    expect(crag.count).toBeGreaterThan(0);
    expect(mobile.getObjectByName('chronicles-terra-crag')).toBeInstanceOf(THREE.InstancedMesh);
    expect(desktop.children.filter(mesh => mesh.name === 'chronicles-terra-crag')).toHaveLength(1);
    expect(desktop.children.every(mesh => mesh.isInstancedMesh)).toBe(true);

    const matrix = new THREE.Matrix4();
    const twin = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const again = restored.getObjectByName('chronicles-terra-crag');
    for (let i = 0; i < crag.count; i += 1) {
      crag.getMatrixAt(i, matrix);
      again.getMatrixAt(i, twin);
      expect(twin.elements).toEqual(matrix.elements);
      position.setFromMatrixPosition(matrix);
      const x = Math.round(position.x / 4) + center.x;
      const y = Math.round(position.z / 4) + center.y;
      if (map.grid[y]?.[x] !== undefined) {
        expect(map.grid[y][x]).toBe('#');
        // Tall ridges must not turn the playable road into a blind tunnel.
        expect(chroniclesLandscapeTileAt({ grid: map.grid, biome: 'hills', x, y })?.family)
          .toBe('interior');
      }
    }
  });
});
