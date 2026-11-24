import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import {
  TERRA_SCENERY_MARGIN, buildTerraScenery, chroniclesBrezalOuterRelief,
  chroniclesBrezalVergeRelief, chroniclesBrezalStoneGeometry,
  chroniclesOrganicRockGeometry, chroniclesBrezalShrubGeometry,
  chroniclesOrganicCanopyGeometry,
} from './chroniclesTerraScenery.js';

const center = { x: 10, y: 7 };
const b2 = chroniclesMapById('terra-b2');
const width = b2.grid[0].length;
const height = b2.grid.length;
const relief = (x, y, ringDepth, grid = b2.grid) =>
  chroniclesBrezalOuterRelief({ grid, x, y, ringDepth });
const vergeRelief = (x, y, grid = b2.grid) =>
  chroniclesBrezalVergeRelief({ grid, x, y });
const scene = (mapId, coarsePointer = false) => buildTerraScenery({
  grid: b2.grid, center, biome: b2.biome, scenery: b2.scenery,
  mapId, coarsePointer,
});
const scaleOf = matrix => new THREE.Vector3().setFromMatrixScale(matrix);
const locationOf = matrix => ({
  x: Math.round(matrix.elements[12] / 4) + center.x,
  y: Math.round(matrix.elements[14] / 4) + center.y,
});

describe('Terra v64 Brezal B2 layered non-colliding rocky backdrop', () => {
  it('makes continuous low saddles on all three outside rows, without touching real cells', () => {
    expect(TERRA_SCENERY_MARGIN).toBe(3);
    const eastProfile = Array.from({ length: height }, (_, y) => relief(width, y, 1));
    const westProfile = Array.from({ length: height }, (_, y) => relief(-1, y, 1));
    const northProfile = Array.from({ length: width }, (_, x) => relief(x, -1, 1));
    const southProfile = Array.from({ length: width }, (_, x) => relief(x, height, 1));
    // V68: one continuous perimeter avoids identical mirror-image hillsides.
    // There are now genuine low passes through the layered rock horizon.
    expect(eastProfile).not.toEqual(westProfile);
    expect(northProfile).not.toEqual(southProfile);
    expect(Math.min(...eastProfile)).toBeGreaterThanOrEqual(0.20);
    expect(Math.min(...eastProfile)).toBeLessThan(0.42);
    expect(Math.max(...eastProfile)).toBeGreaterThan(0.85);
    expect(Math.max(...eastProfile)).toBeLessThanOrEqual(0.98);
    expect(Math.max(...eastProfile) - Math.min(...eastProfile)).toBeGreaterThan(0.48);
    expect(Math.min(...westProfile, ...northProfile, ...southProfile)).toBeLessThan(0.35);
    for (let y = 0; y < height; y += 1) {
      expect(relief(-1, y, 1)).toBe(westProfile[y]);
      expect(relief(-2, y, 2)).toBeLessThan(relief(-1, y, 1));
      expect(relief(-3, y, 3)).toBeLessThan(relief(-2, y, 2));
      expect(relief(width, y, 1)).toBe(eastProfile[y]);
      expect(relief(width + 1, y, 2)).toBeLessThan(relief(width, y, 1));
      expect(relief(width + 2, y, 3)).toBeLessThan(relief(width + 1, y, 2));
      expect(relief(-3, y, 3) / relief(-1, y, 1)).toBeCloseTo(0.55 / 0.98, 10);
      if (y) expect(Math.abs(eastProfile[y] - eastProfile[y - 1])).toBeLessThan(0.22);
    }
    for (let x = 0; x < width; x += 1) {
      expect(relief(x, -1, 1)).toBe(northProfile[x]);
      expect(relief(x, height, 1)).toBe(southProfile[x]);
      expect(relief(x, -2, 2)).toBeLessThan(relief(x, -1, 1));
      expect(relief(x, height + 2, 3)).toBeLessThan(relief(x, height + 1, 2));
    }
    // Each corner has the same crest height when approached from either
    // adjacent side at each depth: no visual seam at the diagonal joins.
    for (let depth = 1; depth <= TERRA_SCENERY_MARGIN; depth += 1) {
      expect(relief(-depth, -depth, depth)).toBeCloseTo(relief(0, -depth, depth), 10);
      expect(relief(width - 1 + depth, -depth, depth))
        .toBeCloseTo(relief(width - 1, -depth, depth), 10);
      expect(relief(width - 1 + depth, height - 1 + depth, depth))
        .toBeCloseTo(relief(width - 1, height - 1 + depth, depth), 10);
      expect(relief(-depth, height - 1 + depth, depth))
        .toBeCloseTo(relief(0, height - 1 + depth, depth), 10);
    }
    for (const [x, y, depth] of [
      [0, 0, 0], [0, 0, 1], [3, 8, 1], [20, 7, 2],
      [12, 7, 1], [-1, 5, 2], [-2, 5, 1],
      [width, 5, 0], [width + 3, 5, 4], [-4, 5, 4],
      [NaN, 5, 1], [0.5, -1, 1], [2, Infinity, 1],
    ]) expect(relief(x, y, depth)).toBe(1);
    expect(relief(-1, 5, 1, [])).toBe(1);
    expect(relief(-1, 5, 1, ['###', '##'])).toBe(1);
    // Corner mountains remain bounded and deterministic too.
    expect(relief(-2, -2, 2)).toBe(relief(-2, -2, 2));
    expect(relief(-2, -2, 2)).toBeGreaterThanOrEqual(0.46);
    expect(relief(-2, -2, 2)).toBeLessThanOrEqual(0.98);
  });

  it.each([false, true])('uses a deterministic low, stratified rock silhouette at coarse=%s', coarsePointer => {
    const stone = chroniclesBrezalStoneGeometry({ coarsePointer });
    const copy = chroniclesBrezalStoneGeometry({ coarsePointer });
    const geom = stone.getAttribute('position');
    const baseline = scene('generic-hills', coarsePointer)
      .getObjectByName('chronicles-terra-boulder').geometry;
    // Preserve the original mobile/desktop vertex budget and UV topology,
    // while replacing the tall rounded boulder with a clearly flatter cap.
    expect(geom.count).toBe(baseline.getAttribute('position').count);
    expect(stone.getAttribute('uv').count).toBe(baseline.getAttribute('uv').count);
    expect(stone.index?.count ?? 0).toBe(baseline.index?.count ?? 0);
    expect(geom.array).toEqual(copy.getAttribute('position').array);
    expect(stone.boundingBox).toBeTruthy();
    expect(stone.boundingSphere).toBeTruthy();
    expect(stone.boundingBox.max.y).toBeLessThanOrEqual(0.70 * 0.89 + 0.0001);
    expect(stone.boundingBox.min.y).toBeGreaterThanOrEqual(-0.73 * 0.89 - 0.0001);
    expect(stone.boundingBox.max.x - stone.boundingBox.min.x)
      .toBeGreaterThan(stone.boundingBox.max.y - stone.boundingBox.min.y);
    // V71's tilted, weathered cap must genuinely vary across the rock,
    // not just reapply the old flat y=0.61 clamp to a different material.
    // Check it against the exact raw source positions at both LODs.
    const raw = chroniclesOrganicRockGeometry({
      coarsePointer, weatheredHighland: true,
    });
    const source = raw.getAttribute('position');
    const clippedCaps = new Set();
    let changedFromFlatCap = 0;
    for (let i = 0; i < geom.count; i += 1) {
      const x = source.getX(i), y = source.getY(i), z = source.getZ(i);
      const cap = 0.48 + 0.14 * Math.sin(x * 1.85 + z * 0.95)
        + 0.08 * Math.cos(z * 2.25 - x * 1.40);
      const expectedY = Math.max(-0.73, Math.min(y, cap)) * 0.89;
      expect(geom.getX(i)).toBeCloseTo(x * 1.08, 5);
      expect(geom.getY(i)).toBeCloseTo(expectedY, 5);
      expect(geom.getZ(i)).toBeCloseTo(z * 1.06, 5);
      if (y > cap) clippedCaps.add(expectedY.toFixed(4));
      const flatY = THREE.MathUtils.clamp(y, -0.73, 0.61) * 0.88;
      if (Math.abs(expectedY - flatY) > 0.001) changedFromFlatCap += 1;
    }
    expect(clippedCaps.size).toBeGreaterThan(1);
    expect(changedFromFlatCap).toBeGreaterThan(1);
    for (const value of geom.array) expect(Number.isFinite(value)).toBe(true);
    raw.dispose();
    stone.dispose();
    copy.dispose();
  });

  it.each([false, true])('builds B2 low asymmetric shrub silhouettes without new polygons (coarse=%s)', coarsePointer => {
    const bush = chroniclesBrezalShrubGeometry({ coarsePointer });
    const repeat = chroniclesBrezalShrubGeometry({ coarsePointer });
    const original = chroniclesOrganicCanopyGeometry({ coarsePointer, shrub: true });
    const pos = bush.getAttribute('position');
    const source = original.getAttribute('position');
    expect(pos.count).toBe(source.count);
    expect(bush.getAttribute('uv').count).toBe(original.getAttribute('uv').count);
    expect(bush.index?.count ?? 0).toBe(original.index?.count ?? 0);
    expect(pos.array).toEqual(repeat.getAttribute('position').array);
    expect(pos.array).not.toEqual(source.array);
    const bounds = bush.boundingBox;
    expect(bounds).toBeTruthy();
    expect(bush.boundingSphere).toBeTruthy();
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    expect(width).toBeGreaterThan(height * 1.5);
    expect(bounds.max.y).toBeLessThan(0.60);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.53 * 0.92 - 0.0001);
    // Vertex displacement is analytic: duplicate UV seam vertices must
    // remain together and shape is stable across F5 and device quality.
    for (let i = 0; i < pos.count; i += 1) {
      const x = source.getX(i), y = source.getY(i), z = source.getZ(i);
      const angle = Math.atan2(z, x);
      const lobes = 1 + 0.17 * Math.sin(3 * angle + 0.35)
        + 0.085 * Math.cos(5 * angle - 0.60);
      const skirt = 1.06 - 0.12 * y;
      const crest = 0.43 + 0.10 * Math.sin(2 * angle + 0.70)
        + 0.08 * Math.cos(3 * angle - 0.55);
      expect(pos.getX(i)).toBeCloseTo(x * lobes * skirt * 1.15 + 0.09 * (y + 0.7), 5);
      expect(pos.getY(i)).toBeCloseTo(Math.max(-0.53, Math.min(y, crest)) * 0.92, 5);
      expect(pos.getZ(i)).toBeCloseTo(z * lobes * skirt * 1.04, 5);
      expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true);
    }
    bush.dispose();
    repeat.dispose();
    original.dispose();
  });

  it.each([false, true])('keeps B2 shrub instances but uses muted heath hues at coarse=%s', coarsePointer => {
    const b2Scene = scene('terra-b2', coarsePointer);
    const repeated = scene('terra-b2', coarsePointer);
    const original = scene('generic-hills', coarsePointer);
    const otherHighlands = scene('terra-e2', coarsePointer);
    const name = 'chronicles-terra-bush';
    const bush = b2Scene.getObjectByName(name);
    const repeat = repeated.getObjectByName(name);
    const baseline = original.getObjectByName(name);
    expect(bush).toBeInstanceOf(THREE.InstancedMesh);
    expect(bush.count).toBeGreaterThan(4);
    expect(bush.count).toBe(baseline.count);
    expect(bush.count).toBe(repeat.count);
    expect(bush.instanceColor).toBeTruthy();
    expect(baseline.instanceColor).toBeNull();
    expect(otherHighlands.getObjectByName(name).instanceColor).toBeNull();
    // V73 reshapes only the shared B2 shrub vertices; keep the
    // exact 20/80-triangle budget and original leaves material.
    expect(bush.geometry.getAttribute('position').array)
      .not.toEqual(baseline.geometry.getAttribute('position').array);
    expect(bush.geometry.getAttribute('position').count)
      .toBe(baseline.geometry.getAttribute('position').count);
    expect(bush.geometry.getAttribute('uv').count)
      .toBe(baseline.geometry.getAttribute('uv').count);
    expect(bush.geometry.index?.count ?? 0)
      .toBe(baseline.geometry.index?.count ?? 0);
    expect(bush.geometry.getAttribute('position').array)
      .toEqual(repeat.geometry.getAttribute('position').array);
    const allowed = new Set(['b9bda1', 'adb79b', 'c5b9a0', 'a4b39a', 'c5c2ab']);
    const variants = new Set();
    const m = new THREE.Matrix4(), ref = new THREE.Matrix4();
    const color = new THREE.Color(), again = new THREE.Color();
    for (let i = 0; i < bush.count; i += 1) {
      bush.getMatrixAt(i, m);
      baseline.getMatrixAt(i, ref);
      expect(m.elements).toEqual(ref.elements);
      repeat.getMatrixAt(i, ref);
      expect(m.elements).toEqual(ref.elements);
      bush.getColorAt(i, color);
      repeat.getColorAt(i, again);
      expect(color.getHexString()).toBe(again.getHexString());
      expect(allowed.has(color.getHexString())).toBe(true);
      variants.add(color.getHexString());
    }
    expect(variants.size).toBeGreaterThan(1);
    expect(bush.material.map?.userData?.chroniclesPixelArt?.kind)
      .toBe(baseline.material.map?.userData?.chroniclesPixelArt?.kind);
  });

  it('lowers only real B2 perimeter verges, following the exterior saddles', () => {
    const north = Array.from({ length: width - 2 }, (_, n) => vergeRelief(n + 1, 0));
    const south = Array.from({ length: width - 2 }, (_, n) =>
      vergeRelief(n + 1, height - 1));
    expect(north.some(v => v < 0.70)).toBe(true);
    expect(north.some(v => v > 0.77)).toBe(true);
    expect(north).not.toEqual(south);
    for (const [x, y] of [[0, 3], [width - 1, 7], [7, 0], [9, height - 1]]) {
      expect(vergeRelief(x, y)).toBeCloseTo(
        0.56 + 0.29 * (relief(
          x === 0 ? -1 : x === width - 1 ? width : x,
          x === 0 || x === width - 1 ? y : y === 0 ? -1 : height,
          1,
        ) / 0.98), 10);
      expect(vergeRelief(x, y)).toBeGreaterThan(0.60);
      expect(vergeRelief(x, y)).toBeLessThan(0.86);
    }
    for (const [x, y] of [
      [3, 8], [12, 6], [0, 0], [width - 1, 0],
      [width, 4], [-1, 4], [0, -1], [3.2, 0], [0, NaN],
    ]) expect(vergeRelief(x, y)).toBe(1);
    expect(vergeRelief(0, 3, [])).toBe(1);
    expect(vergeRelief(0, 3, ['####', '#..#'])).toBe(1);
    expect(b2.grid).toEqual(chroniclesMapById('terra-b2').grid);
  });

  it('tapers only exterior boulder/crag matrices, with the exact existing batch population', () => {
    for (const coarsePointer of [false, true]) {
      const B2 = scene('terra-b2', coarsePointer);
      const repeat = scene('terra-b2', coarsePointer);
      const generic = scene('generic-hills', coarsePointer);
      // B2 includes its original blocked heather and, since v66, one
      // dedicated low-rosette batch only for walkable foothills.
      expect(B2.children.map(x => x.name)
        .filter(x => x !== 'chronicles-terra-heather'
          && x !== 'chronicles-terra-heatherGroundcover'))
        .toEqual(generic.children.map(x => x.name));
      expect(B2.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
      for (const part of ['boulder', 'crag']) {
        const name = 'chronicles-terra-' + part;
        const got = B2.getObjectByName(name);
        const old = generic.getObjectByName(name);
        const same = repeat.getObjectByName(name);
        expect(got.count).toBe(old.count);
        expect(got.count).toBe(same.count);
        expect(B2.children.filter(mesh => mesh.name === name)).toHaveLength(1);
        expect(got.geometry.getAttribute('position').count)
          .toBe(old.geometry.getAttribute('position').count);
        if (part === 'boulder') {
          // V70 changes B2's ONE shared boulder geometry, not instance
          // population, matrices, colour palette or texture selection.
          expect(got.geometry.getAttribute('position').array)
            .not.toEqual(old.geometry.getAttribute('position').array);
          expect(got.geometry.getAttribute('position').array)
            .toEqual(same.geometry.getAttribute('position').array);
          expect(got.material.flatShading).toBe(true);
        } else {
          expect(got.geometry.getAttribute('position').array)
            .toEqual(old.geometry.getAttribute('position').array);
        }
        expect(got.material.map).toBe(old.material.map);
        const currentM = new THREE.Matrix4(), oldM = new THREE.Matrix4();
        const repeatM = new THREE.Matrix4();
        let changedExterior = 0;
        let preservedInterior = 0;
        let authoredRuin = 0;
        for (let i = 0; i < got.count; i += 1) {
          got.getMatrixAt(i, currentM);
          old.getMatrixAt(i, oldM);
          same.getMatrixAt(i, repeatM);
          expect(currentM.elements).toEqual(repeatM.elements);
          const { x, y } = locationOf(currentM);
          expect(locationOf(currentM)).toEqual(locationOf(oldM));
          const outside = x < 0 || x >= width || y < 0 || y >= height;
          if (outside) {
            const depth = Math.max(-x, x - width + 1, -y, y - height + 1);
            const expected = relief(x, y, depth);
            const was = scaleOf(oldM), now = scaleOf(currentM);
            // Boulders shrink in xyz, including their centre height;
            // crags retain their footprint and only shorten in y.
            const horizontal = part === 'boulder' ? expected : 1;
            expect(now.x / was.x).toBeCloseTo(horizontal, 5);
            expect(now.y / was.y).toBeCloseTo(expected, 5);
            expect(now.z / was.z).toBeCloseTo(horizontal, 5);
            expect(currentM.elements[12]).toBeCloseTo(oldM.elements[12], 5);
            expect(currentM.elements[14]).toBeCloseTo(oldM.elements[14], 5);
            changedExterior += 1;
          } else if (part === 'boulder' && x === 3 && y === 8) {
            const now = scaleOf(currentM);
            expect(now.y).toBeLessThan(1.65); // v63 authored low ruin
            authoredRuin += 1;
          } else if (part === 'boulder' && vergeRelief(x, y) !== 1) {
            // V69 changes the *existing* boulders on impassable perimeter
            // cells. The root count and horizontal world positions stay put.
            const expected = vergeRelief(x, y);
            const was = scaleOf(oldM), now = scaleOf(currentM);
            expect(now.x / was.x).toBeCloseTo(expected, 5);
            expect(now.y / was.y).toBeCloseTo(expected, 5);
            expect(now.z / was.z).toBeCloseTo(expected, 5);
            expect(currentM.elements[12]).toBeCloseTo(oldM.elements[12], 5);
            expect(currentM.elements[14]).toBeCloseTo(oldM.elements[14], 5);
            expect(b2.grid[y]?.[x]).toBe('#');
          } else {
            expect(currentM.elements).toEqual(oldM.elements);
            expect(b2.grid[y]?.[x]).toBe('#');
            preservedInterior += 1;
          }
        }
        expect(changedExterior).toBeGreaterThan(20);
        expect(preservedInterior).toBeGreaterThan(0);
        if (part === 'boulder') expect(authoredRuin).toBe(3);
      }
      expect(b2.grid).toEqual(chroniclesMapById('terra-b2').grid);
    }
  });

  it('does not alter native E2 or C4 procedural maps or their actual grid', () => {
    for (const id of ['terra-e2', 'terra-c4']) {
      const map = chroniclesMapById(id);
      const a = buildTerraScenery({
        grid: map.grid, center, biome: map.biome,
        mapId: id, scenery: map.scenery,
      });
      const b = buildTerraScenery({
        grid: map.grid, center, biome: map.biome,
        mapId: id, scenery: map.scenery,
      });
      for (const part of ['boulder', 'crag', 'crown', 'broadleafTrunk']) {
        const mesh = a.getObjectByName('chronicles-terra-' + part);
        const repeat = b.getObjectByName('chronicles-terra-' + part);
        if (!mesh) continue;
        expect(mesh.count).toBe(repeat.count);
        const m = new THREE.Matrix4(), n = new THREE.Matrix4();
        for (let i = 0; i < mesh.count; i += 1) {
          mesh.getMatrixAt(i, m);
          repeat.getMatrixAt(i, n);
          expect(m.elements).toEqual(n.elements);
        }
      }
    }
  });
});
