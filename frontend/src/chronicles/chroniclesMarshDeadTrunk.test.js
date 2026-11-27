import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesMarshDeadTrunkGeometry, chroniclesMarshDeadTreeLayout } from './chroniclesTerraScenery.js';

describe('Terra marsh weathered deadwood', () => {
  it('preserves cylinder topology and joins while displacing the crown', () => {
    const base = new THREE.CylinderGeometry(0.14, 0.26, 1, 6);
    const trunk = chroniclesMarshDeadTrunkGeometry();
    const again = chroniclesMarshDeadTrunkGeometry();
    const source = base.getAttribute('position');
    const positions = trunk.getAttribute('position');
    expect([...trunk.index.array]).toEqual([...base.index.array]);
    expect([...trunk.getAttribute('uv').array]).toEqual([...base.getAttribute('uv').array]);
    expect(positions.count).toBe(source.count);
    expect([...positions.array]).toEqual([...again.getAttribute('position').array]);
    const duplicates = new Map();
    let caps = 0;
    for (let i = 0; i < source.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(source, i);
      const q = new THREE.Vector3().fromBufferAttribute(positions, i);
      const key = [p.x, p.y, p.z].map(v => Math.round(v * 1e6)).join(',');
      if (duplicates.has(key)) expect(q.distanceTo(duplicates.get(key))).toBeLessThan(1e-6);
      duplicates.set(key, q);
      expect(q.y).toBe(p.y);
      expect(q.distanceTo(p)).toBeLessThan(0.12);
      if (p.y > 0.49 && Math.hypot(p.x, p.z) < 1e-6) {
        expect(q.x).toBeCloseTo(0.075);
        expect(q.z).toBeCloseTo(-0.045);
        caps++;
      }
    }
    expect(caps).toBeGreaterThan(0);
    expect([...trunk.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    [base, trunk, again].forEach(g => g.dispose());
  });

  it('grades damp roots into dry exposed wood without color seams', () => {
    const trunk = chroniclesMarshDeadTrunkGeometry();
    const repeat = chroniclesMarshDeadTrunkGeometry();
    const positions = trunk.getAttribute('position');
    const colors = trunk.getAttribute('color');
    const wet = new THREE.Color('#758477');
    const dry = new THREE.Color('#e7dfd0');
    expect(colors.count).toBe(positions.count);
    expect([...colors.array]).toEqual([...repeat.getAttribute('color').array]);
    let roots = 0, tips = 0;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const expected = y < 0 ? wet : dry;
      const actual = new THREE.Color().fromBufferAttribute(colors, i);
      for (const channel of ['r', 'g', 'b']) {
        expect(actual[channel]).toBeCloseTo(expected[channel], 5);
      }
      if (y < 0) roots++; else tips++;
    }
    expect(roots).toBeGreaterThan(0);
    expect(tips).toBeGreaterThan(0);
    expect(wet.r).toBeLessThan(dry.r);
    trunk.dispose();
    repeat.dispose();
  });

  it.each([true, false])('keeps D5 deadwood in a single deterministic batch (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-d5');
    const args = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const repeat = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-deadTrunk');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(0);
    expect(mesh.material.vertexColors).toBe(true);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    const expected = chroniclesMarshDeadTrunkGeometry();
    expect([...mesh.geometry.getAttribute('position').array])
      .toEqual([...expected.getAttribute('position').array]);
    expect([...mesh.geometry.getAttribute('color').array])
      .toEqual([...expected.getAttribute('color').array]);
    expect([...mesh.instanceMatrix.array])
      .toEqual([...repeat.getObjectByName(mesh.name).instanceMatrix.array]);
    expected.dispose();
  });
});

describe('Terra marsh attached forks', () => {
  const matrixFor = ({ position, transform }) => {
    const { tilt = 0, yaw = 0, roll = 0, scale } = transform;
    return new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, roll)),
      new THREE.Vector3(...scale));
  };

  it('attaches both branches to the actual deformed trunk, with asymmetric seeded crowns', () => {
    const silhouettes = new Set();
    for (let x = 0; x < 15; x++) {
      const layout = chroniclesMarshDeadTreeLayout(x * 4, 8, x, 2);
      expect(layout).toEqual(chroniclesMarshDeadTreeLayout(x * 4, 8, x, 2));
      expect(layout).toHaveLength(3);
      const trunk = matrixFor(layout[0]);
      const inverse = trunk.clone().invert();
      const directions = [];
      for (const branch of layout.slice(1)) {
        const matrix = matrixFor(branch);
        const root = new THREE.Vector3(0, -0.5, 0).applyMatrix4(matrix);
        expect(root.distanceTo(new THREE.Vector3(...branch.root))).toBeLessThan(1e-6);
        const local = root.clone().applyMatrix4(inverse);
        const t = local.y + 0.5;
        expect(t).toBeGreaterThanOrEqual(0.60);
        expect(t).toBeLessThan(0.88);
        expect(local.x).toBeCloseTo(0.075 * t, 6);
        expect(local.z).toBeCloseTo(-0.045 * t, 6);
        const tip = new THREE.Vector3(0.075, 0.5, -0.045).applyMatrix4(matrix);
        expect(tip.y).toBeGreaterThan(root.y);
        directions.push(tip.sub(root).normalize());
      }
      expect(directions[0].dot(directions[1])).toBeLessThan(0);
      silhouettes.add(layout[1].transform.scale[1].toFixed(3));
    }
    expect(silhouettes.size).toBeGreaterThan(10);
  });

  it.each([true, false])('keeps real D5 forks in the original three-instance tree batch (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-d5');
    const scene = buildTerraScenery({ grid: map.grid, center: { x: 10, y: 7 },
      biome: map.biome, mapId: map.id, scenery: map.scenery, coarsePointer });
    const mesh = scene.getObjectByName('chronicles-terra-deadTrunk');
    expect(mesh.count % 3).toBe(0);
    const trunk = new THREE.Matrix4(), branch = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i += 3) {
      mesh.getMatrixAt(i, trunk);
      const inverse = trunk.clone().invert();
      for (let j = 1; j <= 2; j++) {
        mesh.getMatrixAt(i + j, branch);
        const root = new THREE.Vector3(0, -0.5, 0).applyMatrix4(branch).applyMatrix4(inverse);
        const t = root.y + 0.5;
        expect(t).toBeGreaterThan(0.60);
        expect(t).toBeLessThan(0.88);
        expect(root.x).toBeCloseTo(0.075 * t, 4);
        expect(root.z).toBeCloseTo(-0.045 * t, 4);
      }
    }
  });
});
