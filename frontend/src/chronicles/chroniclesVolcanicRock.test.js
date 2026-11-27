import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesOrganicRockGeometry, chroniclesVolcanicRockGeometry } from './chroniclesTerraScenery.js';

describe('Terra volcanic mineral strata', () => {
  it.each([true, false])('keeps both rock families at the original geometry budget (coarse=%s)', coarsePointer => {
    const base = chroniclesOrganicRockGeometry({ coarsePointer });
    const cold = chroniclesVolcanicRockGeometry({ coarsePointer });
    const warm = chroniclesVolcanicRockGeometry({ coarsePointer, ember: true });
    const repeat = chroniclesVolcanicRockGeometry({ coarsePointer });
    for (const rock of [cold, warm]) {
      for (const name of ['position', 'normal', 'uv']) {
        expect([...rock.getAttribute(name).array]).toEqual([...base.getAttribute(name).array]);
      }
      expect(rock.index?.count).toBe(base.index?.count);
      const p = rock.getAttribute('position'), color = rock.getAttribute('color');
      expect(color.count).toBe(p.count);
      const seen = new Map(), tones = new Set();
      for (let i = 0; i < p.count; i++) {
        const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
        const rgb = new THREE.Color().fromBufferAttribute(color, i);
        if (seen.has(key)) {
          const other = seen.get(key);
          for (const channel of ['r', 'g', 'b']) expect(rgb[channel]).toBeCloseTo(other[channel], 5);
        }
        seen.set(key, rgb);
        tones.add(rgb.getHex());
        for (const channel of ['r', 'g', 'b']) {
          expect(rgb[channel]).toBeGreaterThanOrEqual(0);
          expect(rgb[channel]).toBeLessThanOrEqual(1);
        }
      }
      expect(tones.size).toBeGreaterThan(4);
    }
    expect([...cold.getAttribute('color').array]).toEqual([...repeat.getAttribute('color').array]);
    expect([...warm.getAttribute('color').array]).not.toEqual([...cold.getAttribute('color').array]);
    [base, cold, warm, repeat].forEach(g => g.dispose());
  });

  it.each([true, false])('uses existing F4 cold and ember rock batches (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-f4');
    expect(map.biome).toBe('ash');
    const args = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer };
    const scene = buildTerraScenery(args);
    const repeat = buildTerraScenery(args);
    for (const part of ['boulderDark', 'emberRock']) {
      const mesh = scene.getObjectByName('chronicles-terra-' + part);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBeGreaterThan(0);
      expect(mesh.material.vertexColors).toBe(true);
      expect(scene.children.filter(m => m.name === mesh.name)).toHaveLength(1);
      const expected = chroniclesVolcanicRockGeometry({ coarsePointer, ember: part === 'emberRock' });
      expect([...mesh.geometry.getAttribute('color').array]).toEqual([...expected.getAttribute('color').array]);
      expect([...mesh.instanceMatrix.array]).toEqual([...repeat.getObjectByName(mesh.name).instanceMatrix.array]);
      if (part === 'emberRock') expect(mesh.material.emissiveIntensity).toBeCloseTo(0.35);
      expected.dispose();
    }
  });

  it('leaves the coastal rock material unchanged', () => {
    const map = chroniclesMapById('terra-a2');
    expect(map.biome).toBe('coast');
    const scene = buildTerraScenery({ grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome,
      mapId: map.id, scenery: map.scenery, coarsePointer: false });
    const mesh = scene.getObjectByName('chronicles-terra-boulderDark');
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.material.vertexColors).toBe(false);
    expect(mesh.geometry.getAttribute('color')).toBeUndefined();
  });
});
