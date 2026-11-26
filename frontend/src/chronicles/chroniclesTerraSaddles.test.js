import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import {
  buildTerraScenery, chroniclesHighlandBackdropSaddle,
  chroniclesHighlandRidgeProfile, chroniclesBrezalVergeRelief,
} from './chroniclesTerraScenery.js';

const center = { x: 10, y: 7 };
const cellMatrices = (group, part, x, y) => {
  const mesh = group.getObjectByName('chronicles-terra-' + part);
  if (!mesh) return [];
  const matrix = new THREE.Matrix4();
  const found = [];
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, matrix);
    if (Math.round(matrix.elements[12] / 4) + center.x === x
        && Math.round(matrix.elements[14] / 4) + center.y === y) {
      found.push(matrix.clone());
    }
  }
  return found;
};
const scales = matrix => {
  const v = new THREE.Vector3();
  matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), v);
  return v;
};

describe('Terra v61 coherent exterior mountain saddles', () => {
  it('shares broad, gradual crest and saddle heights across all three exterior rings', () => {
    const grid = chroniclesMapById('terra-e2').grid;
    const width = grid[0].length, height = grid.length;
    const at = (x, y, ringDepth) => chroniclesHighlandBackdropSaddle({
      grid, x, y, ringDepth,
    });
    const ridge = Array.from({ length: height }, (_, y) => at(width, y, 1));
    for (let y = 0; y < height; y += 1) {
      expect(at(width + 1, y, 2)).toBe(ridge[y]);
      expect(at(width + 2, y, 3)).toBe(ridge[y]);
      expect(at(-1, y, 1)).toBe(ridge[y]);
      expect(at(-2, y, 2)).toBe(ridge[y]);
      expect(at(-3, y, 3)).toBe(ridge[y]);
    }
    expect(Math.min(...ridge)).toBeGreaterThanOrEqual(0.52);
    expect(Math.min(...ridge)).toBeLessThan(0.60);
    expect(Math.max(...ridge)).toBeGreaterThan(1.20);
    expect(Math.max(...ridge)).toBeLessThanOrEqual(1.30);
    expect(Math.max(...ridge) - Math.min(...ridge)).toBeGreaterThan(0.60);
    for (let y = 1; y < height; y += 1) {
      expect(Math.abs(ridge[y] - ridge[y - 1])).toBeLessThan(0.25);
    }
    for (let x = 0; x < width; x += 1) {
      expect(at(x, -1, 1)).toBe(at(x, -3, 3));
      expect(at(x, height, 1)).toBe(at(x, height + 2, 3));
    }
  });

  it('never sculpts authored cells, corners, invalid depths or incomplete grids', () => {
    const grid = chroniclesMapById('terra-e2').grid;
    const at = (x, y, ringDepth, options = {}) => chroniclesHighlandBackdropSaddle({
      grid, x, y, ringDepth, ...options,
    });
    for (const call of [
      [20, 7, 0], [20, 7, 1], [-1, -1, 1], [-2, -2, 2],
      [22, 7, 1], [22, 7, 4], [21, 7, 0],
      [2.5, 7, 2], [NaN, 7, 2], [22, Infinity, 2],
    ]) {
      expect(at(...call)).toBe(1);
    }
    expect(at(-1, 5, 1, { grid: [] })).toBe(1);
    expect(at(-1, 5, 1, { grid: [''] })).toBe(1);
  });

  it('changes E2 outer boulder/crag transforms, never population or protected verge roots', () => {
    const map = chroniclesMapById('terra-e2');
    const args = { grid: map.grid, center, biome: map.biome, scenery: map.scenery };
    const current = buildTerraScenery({ ...args, mapId: map.id });
    const repeat = buildTerraScenery({ ...args, mapId: map.id });
    const generic = buildTerraScenery({ ...args, mapId: 'generic-hills' });
    const mobile = buildTerraScenery({ ...args, mapId: map.id, coarsePointer: true });
    const genericMobile = buildTerraScenery({
      ...args, mapId: 'generic-hills', coarsePointer: true,
    });
    for (const part of ['boulder', 'crag']) {
      const a = current.getObjectByName('chronicles-terra-' + part);
      const b = generic.getObjectByName('chronicles-terra-' + part);
      const touch = mobile.getObjectByName('chronicles-terra-' + part);
      const touchBaseline = genericMobile.getObjectByName('chronicles-terra-' + part);
      expect(a.count).toBe(b.count);
      expect(touch.count).toBe(touchBaseline.count);
      const m = new THREE.Matrix4(), twin = new THREE.Matrix4();
      for (let i = 0; i < a.count; i += 1) {
        a.getMatrixAt(i, m);
        repeat.getObjectByName(a.name).getMatrixAt(i, twin);
        expect(m.elements).toEqual(twin.elements);
      }
    }
    const x = map.grid[0].length + 1; // real, non-colliding east ring 2
    for (const y of [2, 5, 8, 11]) {
      const old = cellMatrices(generic, 'boulder', x, y);
      const now = cellMatrices(current, 'boulder', x, y);
      expect(now.length).toBeGreaterThan(0);
      expect(now).toHaveLength(old.length);
      const expectedRatio = (1 + (chroniclesHighlandRidgeProfile(x, y, 'backdrop') - 1) * 0.68)
        * chroniclesHighlandBackdropSaddle({ grid: map.grid, x, y, ringDepth: 2 });
      expect(scales(now[0]).x / scales(old[0]).x).toBeCloseTo(expectedRatio, 4);
    }
    // The visible blocked path-facing edge remains the exact original
    // geometry. Never erode a collision border to fake a photo-friendly view.
    for (const part of ['boulder', 'crag']) {
      const verge = cellMatrices(current, part, 20, 7);
      const baseline = cellMatrices(generic, part, 20, 7);
      expect(verge.map(x => x.elements)).toEqual(baseline.map(x => x.elements));
    }
    expect(current.children.map(mesh => mesh.name))
      .toEqual(generic.children.map(mesh => mesh.name));
    expect(mobile.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    expect(map.grid).toEqual(chroniclesMapById('terra-e2').grid);
  });

  it.each([true, false])('recedes E2 outer ridge heights without changing footprints (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('terra-e2');
    const args = { grid: map.grid, center, biome: map.biome, scenery: map.scenery, coarsePointer };
    const natural = buildTerraScenery({ ...args, mapId: map.id });
    const generic = buildTerraScenery({ ...args, mapId: 'generic-hills' });
    const width = map.grid[0].length, height = map.grid.length;
    for (const part of ['boulder', 'crag']) {
      const a = natural.getObjectByName('chronicles-terra-' + part);
      const b = generic.getObjectByName('chronicles-terra-' + part);
      expect(a.count).toBe(b.count);
      const seen = new Set();
      for (let x = -3; x < width + 3; x++) {
        for (let y = -3; y < height + 3; y++) {
          const ring = Math.max(-x, x - width + 1, -y, y - height + 1);
          if (ring < 1) continue;
          const current = cellMatrices(natural, part, x, y);
          const baseline = cellMatrices(generic, part, x, y);
          expect(current).toHaveLength(baseline.length);
          const ridge = chroniclesHighlandRidgeProfile(x, y, 'backdrop');
          const saddle = chroniclesHighlandBackdropSaddle({ grid: map.grid, x, y, ringDepth: ring });
          const depth = [1, 1, 0.90, 0.78][ring];
          for (let i = 0; i < current.length; i++) {
            const before = scales(baseline[i]), after = scales(current[i]);
            const foot = (1 + (ridge - 1) * 0.68) * saddle;
            const rise = 1 + (ridge - 1) * 0.58;
            const expectedY = part === 'boulder' ? foot * rise * depth : ridge * saddle * depth;
            const expectedX = part === 'boulder' ? foot : 1 + (ridge - 1) * 0.14;
            expect(after.y / before.y).toBeCloseTo(expectedY, 4);
            expect(after.x / before.x).toBeCloseTo(expectedX, 4);
            if (part === 'boulder') {
              expect(current[i].elements[12]).toBe(baseline[i].elements[12]);
              expect(current[i].elements[14]).toBe(baseline[i].elements[14]);
            }
            seen.add(ring);
          }
        }
      }
      expect([...seen].sort()).toEqual([1, 2, 3]);
    }
  });

  it('keeps B2 interior rock exact while lowering only its three non-colliding outer rings', () => {
    const map = chroniclesMapById('terra-b2');
    const args = { grid: map.grid, center, biome: map.biome, scenery: map.scenery };
    const natural = buildTerraScenery({ ...args, mapId: map.id });
    const standard = buildTerraScenery({ ...args, mapId: 'generic-hills' });
    for (const part of ['boulder', 'crag']) {
      const a = natural.getObjectByName('chronicles-terra-' + part);
      const b = standard.getObjectByName('chronicles-terra-' + part);
      expect(a.count).toBe(b.count);
      const m = new THREE.Matrix4(), ref = new THREE.Matrix4();
      for (let i = 0; i < a.count; i += 1) {
        a.getMatrixAt(i, m);
        b.getMatrixAt(i, ref);
        const px = Math.round(m.elements[12] / 4) + center.x;
        const py = Math.round(m.elements[14] / 4) + center.y;
        const outside = px < 0 || py < 0
          || px >= map.grid[0].length || py >= map.grid.length;
        if (outside) {
          // V64: ONLY decorative rings outside the authored collision grid
          // become lower rolling foothills. Their footprint never moves.
          const a = new THREE.Vector3().setFromMatrixScale(m).y;
          const b = new THREE.Vector3().setFromMatrixScale(ref).y;
          expect(a).toBeLessThan(b);
          expect(m.elements[12]).toBe(ref.elements[12]);
          expect(m.elements[14]).toBe(ref.elements[14]);
        } else if (part === 'boulder' && px === 3 && py === 8) {
          // The v63 low authored ruin remains unchanged.
          expect(new THREE.Vector3().setFromMatrixScale(m).y).toBeLessThan(1.65);
        } else if (part === 'boulder'
            && chroniclesBrezalVergeRelief({ grid: map.grid, x: px, y: py }) !== 1) {
          const factor = chroniclesBrezalVergeRelief({ grid: map.grid, x: px, y: py });
          const was = new THREE.Vector3().setFromMatrixScale(ref).y;
          const now = new THREE.Vector3().setFromMatrixScale(m).y;
          expect(now / was).toBeCloseTo(factor, 5);
          expect(m.elements[12]).toBe(ref.elements[12]);
          expect(m.elements[14]).toBe(ref.elements[14]);
        } else {
          expect(m.elements).toEqual(ref.elements);
        }
      }
    }
  });
});
