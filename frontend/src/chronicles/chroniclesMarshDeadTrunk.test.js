import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesMarshDeadTrunkGeometry } from './chroniclesTerraScenery.js';

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
