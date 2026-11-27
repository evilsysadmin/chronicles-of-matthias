import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesCoastalDuneGeometry, chroniclesCoastalDuneRise } from './chroniclesTerraScenery.js';

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

describe('Terra coastal dune ridge composition', () => {
  const map = chroniclesMapById('terra-a2');
  const grid = map.grid;
  const rise = (x, y, ringDepth) => chroniclesCoastalDuneRise({ grid, x, y, ringDepth });

  it('raises coherent outer crests while retaining low saddles and near dunes', () => {
    expect(rise(10, 7, 0)).toBe(1);
    expect(rise(10, -1, 1)).toBe(1);
    expect(rise(10, 7, 3)).toBe(1);
    expect(rise(10, -4, 4)).toBe(1);
    const outer = [];
    for (let x = 0; x < grid[0].length; x++) {
      const inner = rise(x, -2, 2);
      const far = rise(x, -3, 3);
      expect(far).toBeGreaterThanOrEqual(inner);
      expect(far).toBeLessThanOrEqual(2.5);
      expect(rise(x, grid.length + 2, 3)).toBe(far);
      outer.push(far);
    }
    expect(Math.min(...outer)).toBe(1);
    expect(Math.max(...outer)).toBeGreaterThan(2);
  });

  it.each([true, false])('raises only actual A2 distant dune matrices (coarse=%s)', coarsePointer => {
    const center = { x: 10, y: 7 };
    const scene = buildTerraScenery({ grid, center, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer });
    const mesh = scene.getObjectByName('chronicles-terra-dune');
    const matrix = new THREE.Matrix4();
    let tall = 0, near = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const e = matrix.elements;
      const x = Math.round(e[12] / 4) + center.x;
      const y = Math.round(e[14] / 4) + center.y;
      const ring = Math.max(0, -x, x - grid[0].length + 1, -y, y - grid.length + 1);
      const seed = Math.sin(x * 127.1 + y * 311.7 + 4 * 74.7) * 43758.5453;
      const base = 1 + (seed - Math.floor(seed)) * 0.6;
      expect(Math.hypot(e[4], e[5], e[6])).toBeCloseTo(base * rise(x, y, ring), 5);
      expect(Math.hypot(e[0], e[1], e[2])).toBeCloseTo(2.2, 5);
      expect(Math.hypot(e[8], e[9], e[10])).toBeCloseTo(1.7, 5);
      expect(e[13]).toBeCloseTo(0.2, 5);
      if (ring <= 1) near++;
      if (ring >= 2 && rise(x, y, ring) > 1.5) tall++;
    }
    expect(near).toBeGreaterThan(0);
    expect(tall).toBeGreaterThan(0);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
  });
});
