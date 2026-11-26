import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesVolcanicBasaltGeometry } from './chroniclesTerraScenery.js';

describe('Terra weathered basalt columns', () => {
  it('keeps hexagonal topology, closed seams and bounded erosion', () => {
    const base = new THREE.CylinderGeometry(0.42, 0.48, 1, 6);
    const rock = chroniclesVolcanicBasaltGeometry();
    const again = chroniclesVolcanicBasaltGeometry();
    const source = base.getAttribute('position');
    const position = rock.getAttribute('position');
    const color = rock.getAttribute('color');
    expect([...rock.index.array]).toEqual([...base.index.array]);
    expect([...rock.getAttribute('uv').array]).toEqual([...base.getAttribute('uv').array]);
    expect(position.count).toBe(source.count);
    expect(color.count).toBe(source.count);
    expect([...position.array]).toEqual([...again.getAttribute('position').array]);
    expect([...color.array]).toEqual([...again.getAttribute('color').array]);
    const seen = new Map(), heights = [];
    const low = new THREE.Color('#989393'), high = new THREE.Color('#e2d4c6');
    for (let i = 0; i < source.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(source, i);
      const q = new THREE.Vector3().fromBufferAttribute(position, i);
      const rgb = new THREE.Color().fromBufferAttribute(color, i);
      const key = [p.x, p.y, p.z].map(v => Math.round(v * 1e6)).join(',');
      if (seen.has(key)) expect(q.distanceTo(seen.get(key))).toBeLessThan(1e-6);
      seen.set(key, q);
      expect(Math.hypot(q.x, q.z)).toBeLessThanOrEqual(0.490001);
      expect(q.y).toBeLessThanOrEqual(p.y + 1e-6);
      const expected = p.y < 0 ? low : high;
      for (const channel of ['r', 'g', 'b']) expect(rgb[channel]).toBeCloseTo(expected[channel], 5);
      if (p.y < 0) expect(q.y).toBeCloseTo(-0.5, 6);
      else {
        expect(q.y).toBeGreaterThan(0.27);
        heights.push(q.y);
      }
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.08);
    expect([...rock.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    [base, rock, again].forEach(g => g.dispose());
  });

  it.each([true, false])('uses one deterministic basalt batch on real F4 (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-f4');
    expect(map.biome).toBe('ash');
    const args = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const repeat = buildTerraScenery(args);
    const mesh = scene.getObjectByName('chronicles-terra-basalt');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBeGreaterThan(0);
    expect(mesh.material.vertexColors).toBe(true);
    expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
    const expected = chroniclesVolcanicBasaltGeometry();
    expect([...mesh.geometry.getAttribute('position').array])
      .toEqual([...expected.getAttribute('position').array]);
    expect([...mesh.geometry.getAttribute('color').array])
      .toEqual([...expected.getAttribute('color').array]);
    expect([...mesh.instanceMatrix.array])
      .toEqual([...repeat.getObjectByName(mesh.name).instanceMatrix.array]);
    expected.dispose();
  });
});
