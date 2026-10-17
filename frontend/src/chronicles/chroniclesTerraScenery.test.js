import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TERRA_SCENERY_MARGIN, buildTerraScenery, chroniclesTerraSceneryBiomes } from './chroniclesTerraScenery.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

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

  it('is deterministic', () => {
    const map = chroniclesMapById('terra-e2');
    const center = { x: 10, y: 7 };
    const a = instanceCells(buildTerraScenery({ grid: map.grid, center, biome: 'hills' }), center);
    const b = instanceCells(buildTerraScenery({ grid: map.grid, center, biome: 'hills' }), center);
    expect(a).toEqual(b);
  });
});
