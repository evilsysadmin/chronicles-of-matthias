import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMeadowGrassGeometry, buildTerraScenery } from './chroniclesTerraScenery.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const xyz = (position, index) => [
  position.getX(index), position.getY(index), position.getZ(index),
];
const distanceXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

describe('natural curved meadow blades', () => {
  it.each([[true, 5], [false, 11]])(
    'constructs three soft colour-graded panels per leaf (coarse=%s)',
    (coarsePointer, leafCount) => {
      const grass = chroniclesMeadowGrassGeometry({ coarsePointer });
      const repeat = chroniclesMeadowGrassGeometry({ coarsePointer });
      const p = grass.getAttribute('position');
      const c = grass.getAttribute('color');
      const normals = grass.getAttribute('normal');
      expect(p.count).toBe(leafCount * 9);
      expect(c.count).toBe(p.count);
      expect(normals.count).toBe(p.count);
      expect(grass.index).toBeNull();
      expect(grass.boundingBox.min.y).toBeGreaterThanOrEqual(0);
      expect(grass.boundingBox.max.y).toBeLessThan(0.43);
      expect(grass.boundingSphere.radius).toBeLessThan(0.65);
      expect([...p.array]).toEqual([...repeat.getAttribute('position').array]);
      expect([...c.array]).toEqual([...repeat.getAttribute('color').array]);
      for (let blade = 0; blade < leafCount; blade += 1) {
        const first = blade * 9;
        const left = xyz(p, first);
        const right = xyz(p, first + 1);
        const shoulderRight = xyz(p, first + 2);
        const shoulderLeft = xyz(p, first + 5);
        const tip = xyz(p, first + 8);
        const root = [
          (left[0] + right[0]) / 2, left[1],
          (left[2] + right[2]) / 2,
        ];
        const shoulder = [
          (shoulderLeft[0] + shoulderRight[0]) / 2,
          shoulderLeft[1],
          (shoulderLeft[2] + shoulderRight[2]) / 2,
        ];
        expect(shoulder[1]).toBeGreaterThan(root[1] + 0.10);
        expect(tip[1]).toBeGreaterThan(shoulder[1] + 0.03);
        // A leaf bends OUTWARD after the shoulder instead of ending in a
        // single straight 3-vertex spear. Each tip still stays knee-low.
        expect(distanceXZ(tip, root)).toBeGreaterThan(distanceXZ(shoulder, root) + 0.055);
        expect(c.getX(first + 8)).toBeGreaterThan(c.getX(first) * 1.4);
        expect(c.getY(first + 8)).toBeGreaterThan(c.getY(first) * 1.1);
        for (let tri = 0; tri < 3; tri += 1) {
          const at = first + tri * 3;
          const a = new THREE.Vector3(...xyz(p, at));
          const b = new THREE.Vector3(...xyz(p, at + 1));
          const d = new THREE.Vector3(...xyz(p, at + 2));
          const area = b.sub(a).cross(d.sub(a)).length();
          expect(area).toBeGreaterThan(0.0005);
        }
      }
      for (const value of [...p.array, ...c.array, ...normals.array]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      grass.dispose();
      repeat.dispose();
    },
  );

  it('reuses the same single transparent-free grass batch on native Terra and Banner Road', () => {
    for (const mapId of ['terra-c4', 'banner-road-first-book']) {
      const map = chroniclesMapById(mapId);
      const args = { grid: map.grid, mapId, biome: map.biome, scenery: map.scenery,
        center: { x: 10, y: 7 }, coarsePointer: true };
      const before = buildTerraScenery(args);
      const again = buildTerraScenery(args);
      const grass = before.getObjectByName('chronicles-terra-tuft');
      expect(grass).toBeInstanceOf(THREE.InstancedMesh);
      expect(grass.geometry.getAttribute('position').count).toBe(45);
      expect(grass.material.vertexColors).toBe(true);
      expect(grass.material.side).toBe(THREE.DoubleSide);
      expect(grass.material.transparent).toBe(false);
      expect(grass.castShadow).toBe(false);
      expect(before.children.filter(child => child.name === grass.name)).toHaveLength(1);
      expect(before.children.every(child => child.isInstancedMesh)).toBe(true);
      expect(grass.count).toBeGreaterThan(30);
      const other = again.getObjectByName('chronicles-terra-tuft');
      expect(other.count).toBe(grass.count);
      const m = new THREE.Matrix4(), n = new THREE.Matrix4();
      for (let i = 0; i < grass.count; i += 1) {
        grass.getMatrixAt(i, m);
        other.getMatrixAt(i, n);
        expect(m.elements).toEqual(n.elements);
      }
    }
  });
});
