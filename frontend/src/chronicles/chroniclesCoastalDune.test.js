import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesCoastalDuneGeometry } from './chroniclesTerraScenery.js';

describe('Terra coastal wind-shaped dunes', () => {
  it('preserves the sphere budget and seams while sculpting a sunlit crest', () => {
    const base = new THREE.SphereGeometry(1, 10, 6);
    const dune = chroniclesCoastalDuneGeometry();
    const again = chroniclesCoastalDuneGeometry();
    const source = base.getAttribute('position');
    const positions = dune.getAttribute('position');
    const colors = dune.getAttribute('color');
    expect([...dune.index.array]).toEqual([...base.index.array]);
    expect([...dune.getAttribute('uv').array]).toEqual([...base.getAttribute('uv').array]);
    expect(positions.count).toBe(source.count);
    expect(colors.count).toBe(source.count);
    expect([...positions.array]).toEqual([...again.getAttribute('position').array]);
    expect([...colors.array]).toEqual([...again.getAttribute('color').array]);
    const duplicates = new Map();
    const damp = new THREE.Color('#c3b49b');
    const white = new THREE.Color('#ffffff');
    let peaks = 0;
    for (let i = 0; i < positions.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(source, i);
      const q = new THREE.Vector3().fromBufferAttribute(positions, i);
      const actual = new THREE.Color().fromBufferAttribute(colors, i);
      const expected = damp.clone().lerp(white, THREE.MathUtils.smoothstep(p.y, -0.1, 0.85));
      const key = [p.x, p.y, p.z].map(v => Math.round(v * 1e6)).join(',');
      if (duplicates.has(key)) expect(q.distanceTo(duplicates.get(key))).toBeLessThan(1e-6);
      duplicates.set(key, q);
      expect(q.y).toBe(p.y);
      expect(Math.abs(q.x)).toBeLessThanOrEqual(1.000001);
      expect(Math.abs(q.z)).toBeLessThanOrEqual(1.000001);
      for (const channel of ['r', 'g', 'b']) expect(actual[channel]).toBeCloseTo(expected[channel], 5);
      if (p.y > 0.99) {
        expect(q.x).toBeCloseTo(0.16);
        peaks++;
      }
    }
    expect(peaks).toBeGreaterThan(0);
    expect([...dune.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    [base, dune, again].forEach(g => g.dispose());
  });

  it.each([true, false])('uses one deterministic dune batch on real A2 (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-a2');
    expect(map.biome).toBe('coast');
    const args = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const repeat = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-dune');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(0);
    expect(mesh.material.vertexColors).toBe(true);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    const expected = chroniclesCoastalDuneGeometry();
    expect([...mesh.geometry.getAttribute('position').array])
      .toEqual([...expected.getAttribute('position').array]);
    expect([...mesh.geometry.getAttribute('color').array])
      .toEqual([...expected.getAttribute('color').array]);
    expect([...mesh.instanceMatrix.array])
      .toEqual([...repeat.getObjectByName(mesh.name).instanceMatrix.array]);
    expected.dispose();
  });
});
