import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildChroniclesDungeonClutter } from './chroniclesDungeonClutter.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

function cells(group, center) {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  return group.children.flatMap((mesh) => Array.from({ length: mesh.count }, (_, i) => {
    mesh.getMatrixAt(i, matrix);
    position.setFromMatrixPosition(matrix);
    return { part: mesh.name, x: Math.round(position.x / 4) + center.x, y: Math.round(position.z / 4) + center.y, height: position.y };
  }));
}

describe('Dungeon clutter', () => {
  it.each(['minas-de-escoria', 'cueva-contrabandistas', 'torre-de-los-nombres', 'cripta-del-obispo', 'salinas-hundidas'])(
    '%s dresses walkable cells against walls, low and away from content',
    (mapId) => {
      const map = chroniclesMapById(mapId);
      const center = { x: 0, y: 0 };
      const keepClear = [map.partyStart, ...map.enemies.map(({ x, y }) => ({ x, y }))];
      const group = buildChroniclesDungeonClutter({ grid: map.grid, center, mapId, keepClear });
      const placed = cells(group, center);
      expect(placed.length).toBeGreaterThan(10);
      const clear = new Set(keepClear.map(({ x, y }) => `${x},${y}`));
      placed.forEach(({ part, x, y, height }) => {
        expect(map.grid[y]?.[x], `${part} at ${x},${y}`).toBe('.');
        expect(clear.has(`${x},${y}`)).toBe(false);
        expect(height).toBeLessThan(1.3);
      });
    },
  );

  it('picks props from the map environment', () => {
    const names = (mapId) => {
      const map = chroniclesMapById(mapId);
      return buildChroniclesDungeonClutter({ grid: map.grid, mapId, density: 0.9 }).children.map((mesh) => mesh.name);
    };
    expect(names('torre-de-los-nombres')).toContain('chronicles-dungeon-book');
    expect(names('minas-de-escoria')).toContain('chronicles-dungeon-barrel');
  });
});
