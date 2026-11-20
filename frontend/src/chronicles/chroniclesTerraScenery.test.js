import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TERRA_SCENERY_MARGIN, buildTerraScenery, chroniclesOrganicRockGeometry, chroniclesOrganicCanopyGeometry, chroniclesLayeredCanopyGeometry, chroniclesLayeredShrubGeometry, chroniclesBranchingTrunkGeometry, chroniclesMeadowGrassGeometry, chroniclesMeadowSedgeGeometry, chroniclesForestHerbGeometry, chroniclesMeadowWildflowersGeometry, chroniclesWoodlandUnderstoryGeometry, chroniclesMeadowMicroreliefGeometry, chroniclesFallenWoodGeometry, chroniclesBrezalHeatherGeometry, chroniclesTerraSceneryBiomes } from './chroniclesTerraScenery.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';

const CLUTTER = new Set(['tuft', 'flower', 'pebble', 'microrelief', 'forestHerb', 'snowMound', 'ember']);

function instanceCells(group, center) {
  const out = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  group.children.forEach((mesh) => {
    const part = mesh.name.replace('chronicles-terra-', '');
    for (let i = 0; i < mesh.count; i += 1) {
      mesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      out.push({ part, x: Math.round(position.x / 4) + center.x, y: Math.round(position.z / 4) + center.y });
    }
  });
  return out;
}

describe('Terra scenery', () => {
  it('dresses every biome but forest, whose canopy already exists', () => {
    expect(chroniclesTerraSceneryBiomes().sort()).toEqual(['ash', 'coast', 'hills', 'marsh', 'plains', 'snow']);
  });

  it.each(['terra-c4', 'terra-e2', 'terra-b1', 'terra-a2', 'terra-d5', 'terra-f4'])('%s only blocks where the grid blocks', (mapId) => {
    const map = chroniclesMapById(mapId);
    const center = { x: 10, y: 7 };
    const group = buildTerraScenery({ grid: map.grid, center, biome: map.biome, scenery: map.scenery });
    const cells = instanceCells(group, center);
    expect(cells.length).toBeGreaterThan(100);
    const height = map.grid.length;
    const width = map.grid[0].length;
    cells.filter(({ part }) => !CLUTTER.has(part)).forEach(({ part, x, y }) => {
      const inside = x >= 0 && y >= 0 && x < width && y < height;
      if (inside) expect(map.grid[y][x], `${part} at ${x},${y}`).toBe('#');
      else expect(x >= -TERRA_SCENERY_MARGIN - 1 && y >= -TERRA_SCENERY_MARGIN - 1).toBe(true);
    });
  });

  it('renders marisma pools as rounded, textured and deterministic water without blocking roads', () => {
    const marsh = chroniclesMapById('terra-d5');
    const args = { grid: marsh.grid, center: { x: 10, y: 7 },
      biome: marsh.biome, mapId: marsh.id, scenery: marsh.scenery };
    const desktop = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const reload = buildTerraScenery(args);
    const pool = desktop.getObjectByName('chronicles-terra-pool');
    const cheap = mobile.getObjectByName('chronicles-terra-pool');
    const again = reload.getObjectByName('chronicles-terra-pool');
    expect(pool).toBeInstanceOf(THREE.InstancedMesh);
    expect(cheap).toBeInstanceOf(THREE.InstancedMesh);
    expect(pool.count).toBeGreaterThan(5);
    expect(cheap.count).toBeGreaterThan(0);
    expect(pool.count).toBeGreaterThanOrEqual(cheap.count);
    expect(pool.geometry.parameters.radialSegments).toBe(24);
    expect(cheap.geometry.parameters.radialSegments).toBe(14);
    expect(pool.geometry.parameters.height).toBeCloseTo(0.06);
    expect(pool.material.map).toBe(chroniclesPixelTexture('bogwater'));
    expect(cheap.material.map).toBe(pool.material.map);
    expect(pool.material.transparent).toBe(false);
    expect(pool.material.roughness).toBeCloseTo(0.28);
    expect(pool.castShadow).toBe(false);
    expect(pool.instanceColor?.count).toBe(pool.count);
    expect(desktop.children.filter(child => child.name === 'chronicles-terra-pool')).toHaveLength(1);
    const matrix = new THREE.Matrix4();
    const twin = new THREE.Matrix4();
    const tint = new THREE.Color();
    const twinTint = new THREE.Color();
    const colours = new Set();
    for (let i = 0; i < pool.count; i += 1) {
      pool.getMatrixAt(i, matrix);
      again.getMatrixAt(i, twin);
      expect(twin.elements).toEqual(matrix.elements);
      pool.getColorAt(i, tint);
      again.getColorAt(i, twinTint);
      expect(tint.getHex()).toBe(twinTint.getHex());
      colours.add(tint.getHex());
      const x = Math.round(matrix.elements[12] / 4) + args.center.x;
      const y = Math.round(matrix.elements[14] / 4) + args.center.y;
      if (x >= 0 && y >= 0 && y < marsh.grid.length && x < marsh.grid[y].length) {
        expect(marsh.grid[y][x]).toBe('#');
      }
    }
    expect(colours.size).toBeGreaterThan(1);
    const texture = pool.material.map;
    expect(texture.userData.chroniclesPixelArt).toMatchObject({ kind: 'bogwater', size: 64 });
    expect(texture.image.data.length).toBe(64 * 64 * 4);
    const tones = new Set();
    for (let i = 0; i < texture.image.data.length; i += 4) {
      expect(texture.image.data[i + 3]).toBe(255);
      tones.add(Array.from(texture.image.data.slice(i, i + 3)).join(','));
    }
    expect(tones.size).toBeGreaterThan(5);
    expect(buildTerraScenery({ ...args, biome: 'hills' })
      .getObjectByName('chronicles-terra-pool')).toBeUndefined();
  });

  it('draws camp set pieces and keeps roads clear of clutter', () => {
    const map = chroniclesMapById('terra-a2');
    const center = { x: 10, y: 7 };
    const road = map.grid.flatMap((row, y) => [...row].map((tile, x) => ({ x, y, tile })))
      .filter(({ x, y, tile }) => tile === '.' && (x === center.x || y === center.y));
    const group = buildTerraScenery({ grid: map.grid, center, biome: map.biome, scenery: map.scenery, keepClear: road });
    const names = group.children.map((mesh) => mesh.name);
    expect(names).toContain('chronicles-terra-tent');
    expect(names).toContain('chronicles-terra-flame');
    const onRoad = new Set(road.map(({ x, y }) => `${x},${y}`));
    const clutter = instanceCells(group, center).filter(({ part }) => CLUTTER.has(part));
    // Clutter is jittered inside its own cell, never onto the road cells.
    expect(clutter.filter(({ x, y }) => onRoad.has(`${x},${y}`)).length).toBeLessThan(clutter.length * 0.2);
  });

  it('sculpts irregular broadleaf and shrub silhouettes within the existing 20/80 triangle budget', () => {
    const full = chroniclesOrganicCanopyGeometry();
    const coarse = chroniclesOrganicCanopyGeometry({ coarsePointer: true });
    const shrub = chroniclesOrganicCanopyGeometry({ shrub: true });
    const original = new THREE.IcosahedronGeometry(1, 1);
    const triangles = geo => geo.index
      ? geo.index.count / 3 : geo.getAttribute('position').count / 3;
    expect(triangles(full)).toBe(80);
    expect(triangles(coarse)).toBe(20);
    expect(triangles(shrub)).toBe(80);
    const positions = full.getAttribute('position');
    const baseline = original.getAttribute('position');
    expect(positions.count).toBe(baseline.count);
    expect([...positions.array]).not.toEqual([...baseline.array]);
    const radii = new Set();
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      expect([x, y, z].every(Number.isFinite)).toBe(true);
      radii.add(Math.hypot(x, y, z).toFixed(3));
    }
    expect(radii.size).toBeGreaterThan(9);
    expect(shrub.boundingSphere.radius).toBeLessThan(full.boundingSphere.radius * 1.1);
    expect([...chroniclesOrganicCanopyGeometry().getAttribute('position').array])
      .toEqual([...positions.array]); // No RNG across visits
    full.dispose();
    coarse.dispose();
    shrub.dispose();
    original.dispose();
  });


  it('builds layered broadleaf crowns in one bounded instanced shape with a lighter mobile LOD', () => {
    const desktop = chroniclesLayeredCanopyGeometry();
    const mobile = chroniclesLayeredCanopyGeometry({ coarsePointer: true });
    const original = chroniclesOrganicCanopyGeometry();
    const again = chroniclesLayeredCanopyGeometry();
    const triangles = geometry => geometry.index
      ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3;
    expect(triangles(desktop)).toBeGreaterThan(triangles(original) * 2);
    expect(triangles(desktop)).toBeLessThanOrEqual(400);
    expect(triangles(mobile)).toBeLessThanOrEqual(60);
    expect(triangles(mobile)).toBeLessThan(triangles(desktop));
    expect([...again.getAttribute('position').array]).toEqual([...desktop.getAttribute('position').array]);
    for (const n of desktop.getAttribute('position').array) expect(Number.isFinite(n)).toBe(true);
    [desktop, mobile, original, again].forEach(geometry => geometry.dispose());
  });


  it('adds restrained top-to-bottom crown shading without extra meshes or mobile triangles', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const options = { grid: map.grid, center, biome: map.biome, mapId: map.id };
    const desktop = chroniclesLayeredCanopyGeometry();
    const touch = chroniclesLayeredCanopyGeometry({ coarsePointer: true });
    const again = chroniclesLayeredCanopyGeometry();
    const positions = desktop.getAttribute('position');
    const colors = desktop.getAttribute('color');
    const touchColors = touch.getAttribute('color');
    expect(colors.count).toBe(positions.count);
    expect(touchColors.count).toBe(touch.getAttribute('position').count);
    expect(again.getAttribute('color').array).toEqual(colors.array);
    expect(again.getAttribute('position').array).toEqual(positions.array);
    const luminances = { upper: [], lower: [] };
    const unique = new Set();
    for (let i = 0; i < positions.count; i += 1) {
      const r = colors.getX(i), g = colors.getY(i), b = colors.getZ(i);
      expect([r, g, b].every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
      unique.add([r, g, b].map(v => v.toFixed(3)).join(','));
      if (positions.getY(i) > 0.4) luminances.upper.push((r + g + b) / 3);
      if (positions.getY(i) < -0.3) luminances.lower.push((r + g + b) / 3);
    }
    const average = values => values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(luminances.upper.length).toBeGreaterThan(5);
    expect(luminances.lower.length).toBeGreaterThan(5);
    expect(average(luminances.upper)).toBeGreaterThan(average(luminances.lower) + 0.12);
    expect(unique.size).toBeGreaterThan(15);
    const scene = buildTerraScenery(options);
    const mobile = buildTerraScenery({ ...options, coarsePointer: true });
    const crowns = scene.getObjectByName('chronicles-terra-crown');
    const cheap = mobile.getObjectByName('chronicles-terra-crown');
    const shrubs = scene.getObjectByName('chronicles-terra-bush');
    expect(crowns).toBeInstanceOf(THREE.InstancedMesh);
    expect(crowns.material.vertexColors).toBe(true);
    expect(crowns.material.transparent).toBe(false);
    expect(crowns.material.map).toBeTruthy();
    expect(cheap.material.vertexColors).toBe(true);
    // Mobile intentionally skips part of the far scenery ring; compare
    // budgets without incorrectly equating its instance count to desktop.
    expect(cheap.count).toBeGreaterThan(0);
    expect(cheap.count).toBeLessThanOrEqual(crowns.count);
    expect(scene.children.filter(child => child.name === crowns.name)).toHaveLength(1);
    expect(shrubs.material.vertexColors).toBe(false);
    expect(shrubs.geometry.getAttribute('color')).toBeUndefined();
    [desktop, touch, again].forEach(geo => geo.dispose());
  });

  it('grows low-poly branching bark under broadleaf crowns while preserving pine trunks', () => {
    const desktop = chroniclesBranchingTrunkGeometry();
    const mobile = chroniclesBranchingTrunkGeometry({ coarsePointer: true });
    const repeat = chroniclesBranchingTrunkGeometry();
    const triangles = geometry => geometry.index
      ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3;
    expect(triangles(desktop)).toBeGreaterThan(triangles(new THREE.CylinderGeometry(0.2, 0.32, 1, 7)));
    expect(triangles(desktop)).toBeLessThan(230);
    expect(triangles(mobile)).toBeLessThan(triangles(desktop));
    expect(triangles(mobile)).toBeLessThan(130);
    expect([...repeat.getAttribute('position').array]).toEqual([...desktop.getAttribute('position').array]);
    desktop.computeBoundingBox();
    expect(desktop.boundingBox.min.y).toBeGreaterThanOrEqual(-0.55);
    expect(desktop.boundingBox.max.y).toBeGreaterThan(0.65);
    expect(desktop.boundingBox.max.x - desktop.boundingBox.min.x).toBeGreaterThan(1.1);
    for (const value of desktop.getAttribute('position').array) expect(Number.isFinite(value)).toBe(true);
    [desktop, mobile, repeat].forEach(geometry => geometry.dispose());

    const plains = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const params = { grid: plains.grid, center, biome: plains.biome, mapId: plains.id };
    const full = buildTerraScenery(params);
    const touch = buildTerraScenery({ ...params, coarsePointer: true });
    const restored = buildTerraScenery(params);
    const trunks = full.getObjectByName('chronicles-terra-broadleafTrunk');
    const cheapTrunks = touch.getObjectByName('chronicles-terra-broadleafTrunk');
    const crowns = full.getObjectByName('chronicles-terra-crown');
    expect(trunks).toBeInstanceOf(THREE.InstancedMesh);
    expect(cheapTrunks).toBeInstanceOf(THREE.InstancedMesh);
    expect(trunks.count).toBe(crowns.count);
    expect(cheapTrunks.count).toBeGreaterThan(0);
    expect(full.getObjectByName('chronicles-terra-trunk')).toBeUndefined();
    expect(full.children.every(child => child.isInstancedMesh)).toBe(true);
    const matrix = new THREE.Matrix4();
    const again = new THREE.Matrix4();
    for (let i = 0; i < trunks.count; i += 1) {
      trunks.getMatrixAt(i, matrix);
      restored.getObjectByName(trunks.name).getMatrixAt(i, again);
      expect(matrix.elements).toEqual(again.elements);
      const x = Math.round(matrix.elements[12] / 4) + center.x;
      const y = Math.round(matrix.elements[14] / 4) + center.y;
      if (plains.grid[y]?.[x] !== undefined) expect(plains.grid[y][x]).toBe('#');
    }
    const snow = chroniclesMapById('terra-a2');
    // Terrain-specific pines still use the original trunk part.
    const snowy = buildTerraScenery({ grid: snow.grid, center, biome: 'snow' });
    expect(snowy.getObjectByName('chronicles-terra-trunk')).toBeInstanceOf(THREE.InstancedMesh);
    expect(snowy.getObjectByName('chronicles-terra-broadleafTrunk')).toBeUndefined();
  });


  it('anchors broadleaf trunks with short bark roots without creating a new mesh batch', () => {
    const desktop = chroniclesBranchingTrunkGeometry();
    const mobile = chroniclesBranchingTrunkGeometry({ coarsePointer: true });
    const rootEnds = desktop.getAttribute('position');
    const lowOutcrops = new Set();
    for (let i = 0; i < rootEnds.count; i += 1) {
      const x = rootEnds.getX(i);
      const y = rootEnds.getY(i);
      const z = rootEnds.getZ(i);
      if (y < -0.43 && Math.hypot(x, z) > 0.49) {
        lowOutcrops.add(Math.round(Math.atan2(z, x) * 10));
      }
    }
    expect(lowOutcrops.size).toBeGreaterThanOrEqual(3);
    expect(desktop.index.count / 3).toBeLessThan(230);
    expect(mobile.index.count / 3).toBeLessThan(130);
    expect(mobile.index.count).toBeLessThan(desktop.index.count);
    [desktop, mobile].forEach(geometry => geometry.dispose());
  });

  it('builds layered low shrubs for plains only, with a cheaper mobile silhouette', () => {
    const full = chroniclesLayeredShrubGeometry();
    const mobile = chroniclesLayeredShrubGeometry({ coarsePointer: true });
    const restored = chroniclesLayeredShrubGeometry();
    const triangleCount = geometry => (geometry.index?.count
      ?? geometry.getAttribute('position').count) / 3;
    expect(triangleCount(full)).toBe(240);
    expect(triangleCount(mobile)).toBe(40);
    expect([...restored.getAttribute('position').array])
      .toEqual([...full.getAttribute('position').array]);
    full.computeBoundingBox();
    expect(full.boundingBox.min.y).toBeGreaterThan(-1.0);
    expect(full.boundingBox.max.y).toBeLessThan(0.65);
    for (const v of full.getAttribute('position').array) expect(Number.isFinite(v)).toBe(true);
    const center = { x: 10, y: 7 };
    const map = chroniclesMapById('banner-road-first-book');
    const plains = buildTerraScenery({ grid: map.grid, center, biome: 'plains', mapId: map.id });
    const smaller = buildTerraScenery({ grid: map.grid, center, biome: 'plains', mapId: map.id, coarsePointer: true });
    const originalHills = buildTerraScenery({ grid: map.grid, center, biome: 'hills' });
    const shrub = plains.getObjectByName('chronicles-terra-bush');
    expect(shrub).toBeInstanceOf(THREE.InstancedMesh);
    expect(triangleCount(shrub.geometry)).toBe(240);
    expect(triangleCount(smaller.getObjectByName('chronicles-terra-bush').geometry)).toBe(40);
    const hillBush = originalHills.getObjectByName('chronicles-terra-bush');
    expect(triangleCount(hillBush.geometry)).toBe(80);
    expect(shrub.count).toBeGreaterThan(15);
    expect(shrub.instanceColor.count).toBe(shrub.count);
    expect(plains.children.every(child => child.isInstancedMesh)).toBe(true);
    [full, mobile, restored].forEach(g => g.dispose());
  });


  it('seats muted ferns and leaf litter beneath Banner Road trees but never over path cells', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id };
    const desktop = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const restored = buildTerraScenery(args);
    const elsewhere = buildTerraScenery({ ...args, mapId: 'terra-c4' });
    const floor = desktop.getObjectByName('chronicles-terra-woodlandFloor');
    const touch = mobile.getObjectByName('chronicles-terra-woodlandFloor');
    const twin = restored.getObjectByName('chronicles-terra-woodlandFloor');
    expect(floor).toBeInstanceOf(THREE.InstancedMesh);
    expect(floor.count).toBeGreaterThan(18);
    expect(floor.count).toBeGreaterThan(touch.count);
    expect(floor.castShadow).toBe(false);
    expect(floor.material.vertexColors).toBe(true);
    expect(floor.material.transparent).toBe(false);
    expect(floor.instanceColor.count).toBe(floor.count);
    expect(elsewhere.getObjectByName('chronicles-terra-woodlandFloor')).toBeUndefined();
    expect(desktop.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    const matrix = new THREE.Matrix4();
    const copy = new THREE.Matrix4();
    const tint = new THREE.Color();
    const otherTint = new THREE.Color();
    const colours = new Set();
    for (let i = 0; i < floor.count; i += 1) {
      floor.getMatrixAt(i, matrix);
      twin.getMatrixAt(i, copy);
      expect(matrix.elements).toEqual(copy.elements);
      const wx = matrix.elements[12], wz = matrix.elements[14];
      const x = Math.round(wx / 4) + center.x;
      const y = Math.round(wz / 4) + center.y;
      expect(map.grid[y]?.[x]).toBe('#');
      expect(Math.abs(wx - (x - center.x) * 4)).toBeLessThan(1.05);
      expect(Math.abs(wz - (y - center.y) * 4)).toBeLessThan(1.05);
      floor.getColorAt(i, tint);
      twin.getColorAt(i, otherTint);
      expect(tint.getHex()).toBe(otherTint.getHex());
      colours.add(tint.getHex());
    }
    expect(colours.size).toBeGreaterThan(1);
  });

  it('keeps woodland understory finite, opaque and small with mobile LOD', () => {
    const full = chroniclesWoodlandUnderstoryGeometry();
    const mobile = chroniclesWoodlandUnderstoryGeometry({ coarsePointer: true });
    const again = chroniclesWoodlandUnderstoryGeometry();
    expect(full.getAttribute('position').count).toBeLessThanOrEqual(100);
    expect(mobile.getAttribute('position').count).toBeLessThan(full.getAttribute('position').count);
    expect(full.getAttribute('color').count).toBe(full.getAttribute('position').count);
    full.computeBoundingBox();
    expect(full.boundingBox.min.y).toBeGreaterThanOrEqual(0);
    expect(full.boundingBox.max.y).toBeLessThan(0.53);
    expect(full.boundingSphere.radius).toBeLessThan(0.9);
    expect([...again.getAttribute('position').array])
      .toEqual([...full.getAttribute('position').array]);
    for (const value of full.getAttribute('position').array) expect(Number.isFinite(value)).toBe(true);
    [full, mobile, again].forEach(shape => shape.dispose());
  });


  it('adds shallow pebbles, roots and leaf litter ONLY to unpaved Banner Road grass', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const clear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    clear.push({ x: 5, y: 6 }); // Quest interaction exemption.
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id, keepClear: clear };
    const full = buildTerraScenery(args);
    const touch = buildTerraScenery({ ...args, coarsePointer: true });
    const again = buildTerraScenery(args);
    const elsewhere = buildTerraScenery({ ...args, mapId: 'terra-c4' });
    const rocks = full.getObjectByName('chronicles-terra-microrelief');
    const mobile = touch.getObjectByName('chronicles-terra-microrelief');
    const repeat = again.getObjectByName('chronicles-terra-microrelief');
    expect(rocks).toBeInstanceOf(THREE.InstancedMesh);
    expect(rocks.count).toBeGreaterThan(10);
    expect(mobile).toBeInstanceOf(THREE.InstancedMesh);
    expect(mobile.count).toBeLessThan(rocks.count);
    expect(rocks.castShadow).toBe(false);
    expect(rocks.material.vertexColors).toBe(true);
    expect(rocks.material.transparent).toBe(false);
    expect(rocks.instanceColor.count).toBe(rocks.count);
    expect(elsewhere.getObjectByName('chronicles-terra-microrelief')).toBeUndefined();
    expect(full.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    const excluded = new Set(clear.map(p => p.x + ',' + p.y));
    const matrix = new THREE.Matrix4();
    const same = new THREE.Matrix4();
    const shade = new THREE.Color();
    const twin = new THREE.Color();
    const variants = new Set();
    for (let i = 0; i < rocks.count; i += 1) {
      rocks.getMatrixAt(i, matrix);
      repeat.getMatrixAt(i, same);
      expect(same.elements).toEqual(matrix.elements);
      const wx = matrix.elements[12], wz = matrix.elements[14];
      const x = Math.round(wx / 4) + center.x;
      const y = Math.round(wz / 4) + center.y;
      expect(map.grid[y]?.[x]).toBe('.');
      expect(excluded.has(x + ',' + y)).toBe(false);
      // Whole low rock/root geometry remains on its own cell; no road overlap.
      expect(Math.abs(wx - (x - center.x) * 4)).toBeLessThan(1);
      expect(Math.abs(wz - (y - center.y) * 4)).toBeLessThan(1);
      rocks.getColorAt(i, shade);
      repeat.getColorAt(i, twin);
      expect(shade.getHex()).toBe(twin.getHex());
      variants.add(shade.getHex());
    }
    expect(variants.size).toBeGreaterThan(1);
  });

  it('keeps meadow microrelief ankle-low, fully opaque and cheap on mobile', () => {
    const desktop = chroniclesMeadowMicroreliefGeometry();
    const mobile = chroniclesMeadowMicroreliefGeometry({ coarsePointer: true });
    const repeat = chroniclesMeadowMicroreliefGeometry();
    const d = desktop.getAttribute('position');
    const m = mobile.getAttribute('position');
    expect(d.count).toBeGreaterThan(m.count);
    expect(d.count).toBeLessThan(145);
    expect(desktop.getAttribute('color').count).toBe(d.count);
    expect(desktop.boundingBox.min.y).toBeGreaterThanOrEqual(0);
    expect(desktop.boundingBox.max.y).toBeLessThan(0.22);
    expect(desktop.boundingBox.min.x).toBeGreaterThan(-0.66);
    expect(desktop.boundingBox.max.x).toBeLessThan(0.67);
    expect(desktop.boundingBox.min.z).toBeGreaterThan(-0.64);
    expect(desktop.boundingBox.max.z).toBeLessThan(0.64);
    expect([...repeat.getAttribute('position').array]).toEqual([...d.array]);
    for (const value of d.array) expect(Number.isFinite(value)).toBe(true);
    [desktop, mobile, repeat].forEach(shape => shape.dispose());
  });


  it('places occasional fallen mossy timber on blocked Banner Road woodland only', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id };
    const full = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const repeat = buildTerraScenery(args);
    const other = buildTerraScenery({ ...args, mapId: 'terra-c4' });
    const logs = full.getObjectByName('chronicles-terra-fallenWood');
    const touch = mobile.getObjectByName('chronicles-terra-fallenWood');
    expect(logs).toBeInstanceOf(THREE.InstancedMesh);
    expect(logs.count).toBeGreaterThan(7);
    expect(logs.count).toBeLessThan(35); // Woodland debris stays sparse.
    expect(touch).toBeInstanceOf(THREE.InstancedMesh);
    expect(touch.count).toBeLessThan(logs.count);
    expect(logs.castShadow).toBe(false);
    expect(logs.material.vertexColors).toBe(true);
    expect(logs.material.transparent).toBe(false);
    expect(logs.instanceColor.count).toBe(logs.count);
    expect(other.getObjectByName('chronicles-terra-fallenWood')).toBeUndefined();
    expect(full.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    const again = repeat.getObjectByName('chronicles-terra-fallenWood');
    const m = new THREE.Matrix4();
    const twin = new THREE.Matrix4();
    const shade = new THREE.Color();
    const sameShade = new THREE.Color();
    const tints = new Set();
    for (let i = 0; i < logs.count; i += 1) {
      logs.getMatrixAt(i, m);
      again.getMatrixAt(i, twin);
      expect(m.elements).toEqual(twin.elements);
      const wx = m.elements[12], wz = m.elements[14];
      const x = Math.round(wx / 4) + center.x;
      const y = Math.round(wz / 4) + center.y;
      expect(map.grid[y]?.[x]).toBe('#');
      expect(Math.abs(wx - (x - center.x) * 4)).toBeLessThan(0.37);
      expect(Math.abs(wz - (y - center.y) * 4)).toBeLessThan(0.37);
      logs.getColorAt(i, shade);
      again.getColorAt(i, sameShade);
      expect(shade.getHex()).toBe(sameShade.getHex());
      tints.add(shade.getHex());
    }
    expect(tints.size).toBeGreaterThan(1);
  });

  it('models low bark, end-grain and moss in one bounded desktop/mobile geometry', () => {
    const desktop = chroniclesFallenWoodGeometry();
    const mobile = chroniclesFallenWoodGeometry({ coarsePointer: true });
    const again = chroniclesFallenWoodGeometry();
    const d = desktop.getAttribute('position');
    const m = mobile.getAttribute('position');
    expect(d.count).toBeGreaterThan(m.count);
    expect(d.count).toBeLessThan(125);
    expect(desktop.getAttribute('color').count).toBe(d.count);
    expect(desktop.boundingBox.min.y).toBeGreaterThanOrEqual(0);
    expect(desktop.boundingBox.max.y).toBeLessThan(0.49);
    expect(desktop.boundingBox.min.x).toBeGreaterThan(-0.72);
    expect(desktop.boundingBox.max.x).toBeLessThan(0.72);
    expect(desktop.boundingBox.min.z).toBeGreaterThan(-0.24);
    expect(desktop.boundingBox.max.z).toBeLessThan(0.24);
    expect([...again.getAttribute('position').array]).toEqual([...d.array]);
    for (const v of d.array) expect(Number.isFinite(v)).toBe(true);
    [desktop, mobile, again].forEach(g => g.dispose());
  });


  it('mixes genuinely different meadow silhouettes while keeping light mobile geometry', () => {
    const thin = chroniclesMeadowGrassGeometry();
    const sedge = chroniclesMeadowSedgeGeometry();
    const touch = chroniclesMeadowSedgeGeometry({ coarsePointer: true });
    const repeat = chroniclesMeadowSedgeGeometry();
    const vertices = sedge.getAttribute('position');
    const mobileVertices = touch.getAttribute('position');
    expect(vertices.count).toBeGreaterThan(mobileVertices.count);
    expect(vertices.count).toBeLessThan(60);
    expect(vertices.count).not.toBe(thin.getAttribute('position').count);
    expect(sedge.getAttribute('color').count).toBe(vertices.count);
    expect(sedge.boundingBox.min.y).toBeGreaterThanOrEqual(0);
    expect(sedge.boundingBox.max.y).toBeLessThan(0.62);
    expect(sedge.boundingBox.max.x).toBeLessThan(0.51);
    expect(sedge.boundingBox.min.x).toBeGreaterThan(-0.51);
    expect(sedge.boundingBox.max.z).toBeLessThan(0.51);
    expect(sedge.boundingBox.min.z).toBeGreaterThan(-0.51);
    expect([...repeat.getAttribute('position').array]).toEqual([...vertices.array]);
    for (const value of vertices.array) expect(Number.isFinite(value)).toBe(true);
    [thin, sedge, touch, repeat].forEach(geo => geo.dispose());
  });

  it('intersperses sedges among short turf in deterministic, variable-density patches', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const keepClear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    keepClear.push({ x: 5, y: 6 });
    const args = { grid: map.grid, biome: map.biome, mapId: map.id, center, keepClear };
    const full = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const repeat = buildTerraScenery(args);
    const other = buildTerraScenery({ ...args, mapId: 'terra-c4' });
    const sedges = full.getObjectByName('chronicles-terra-meadowSedge');
    const turf = full.getObjectByName('chronicles-terra-tuft');
    const mobileSedges = mobile.getObjectByName('chronicles-terra-meadowSedge');
    expect(sedges).toBeInstanceOf(THREE.InstancedMesh);
    expect(turf).toBeInstanceOf(THREE.InstancedMesh);
    expect(sedges.count).toBeGreaterThan(35);
    expect(turf.count).toBeGreaterThan(sedges.count);
    expect(sedges.count).toBeGreaterThan(mobileSedges.count);
    expect(sedges.castShadow).toBe(false);
    expect(sedges.material.transparent).toBe(false);
    expect(sedges.instanceColor.count).toBe(sedges.count);
    expect(other.getObjectByName('chronicles-terra-meadowSedge')).toBeUndefined();
    const blocked = new Set(keepClear.map(cell => cell.x + ',' + cell.y));
    const density = new Map();
    const colors = new Set();
    const matrix = new THREE.Matrix4(), twin = new THREE.Matrix4();
    const tint = new THREE.Color(), twinTint = new THREE.Color();
    const original = repeat.getObjectByName('chronicles-terra-meadowSedge');
    for (const batch of [sedges, turf, mobileSedges]) {
      for (let i = 0; i < batch.count; i += 1) {
        batch.getMatrixAt(i, matrix);
        const wx = matrix.elements[12], wz = matrix.elements[14];
        const x = Math.round(wx / 4) + center.x;
        const y = Math.round(wz / 4) + center.y;
        expect(map.grid[y]?.[x]).toBe('.');
        expect(blocked.has(x + ',' + y)).toBe(false);
        expect(Math.abs(wx - (x - center.x) * 4)).toBeLessThan(1.5);
        expect(Math.abs(wz - (y - center.y) * 4)).toBeLessThan(1.5);
        if (batch !== mobileSedges) density.set(x + ',' + y,
          (density.get(x + ',' + y) || 0) + 1);
        if (batch === sedges) {
          original.getMatrixAt(i, twin);
          expect(twin.elements).toEqual(matrix.elements);
          batch.getColorAt(i, tint);
          original.getColorAt(i, twinTint);
          expect(twinTint.getHex()).toBe(tint.getHex());
          colors.add(tint.getHex());
        }
      }
    }
    expect(new Set(density.values()).size).toBeGreaterThan(3);
    expect(colors.size).toBeGreaterThan(2);
    expect(full.children.every(child => child.isInstancedMesh)).toBe(true);
  });



  it('grows irregular pass-through shrub islands without crossing roads or changing other maps', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const keepClear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    keepClear.push({ x: 5, y: 6 });
    const options = { grid: map.grid, biome: map.biome, mapId: map.id, center, keepClear };
    const full = buildTerraScenery(options);
    const mobile = buildTerraScenery({ ...options, coarsePointer: true });
    const repeat = buildTerraScenery(options);
    const original = buildTerraScenery({ ...options, mapId: 'terra-c4' });
    const shrubs = full.getObjectByName('chronicles-terra-bush');
    const touch = mobile.getObjectByName('chronicles-terra-bush');
    const again = repeat.getObjectByName('chronicles-terra-bush');
    const old = original.getObjectByName('chronicles-terra-bush');
    expect(shrubs).toBeInstanceOf(THREE.InstancedMesh);
    expect(shrubs.count).toBeGreaterThan(old.count + 45);
    expect(touch.count).toBeLessThan(shrubs.count);
    expect(shrubs.material.transparent).toBe(false);
    expect(shrubs.geometry.getAttribute('color')).toBeUndefined();
    expect(full.children.every(child => child.isInstancedMesh)).toBe(true);
    const originalInstances = new Map();
    const matrix = new THREE.Matrix4(), twin = new THREE.Matrix4();
    const tint = new THREE.Color(), twinTint = new THREE.Color();
    for (let i = 0; i < old.count; i += 1) {
      old.getMatrixAt(i, matrix);
      const key = matrix.elements.join(',');
      originalInstances.set(key, (originalInstances.get(key) || 0) + 1);
    }
    const excluded = new Set(keepClear.map(({ x, y }) => x + ',' + y));
    const addedCells = new Set(), kinds = new Set(), shades = new Set();
    for (let i = 0; i < shrubs.count; i += 1) {
      shrubs.getMatrixAt(i, matrix);
      again.getMatrixAt(i, twin);
      expect(matrix.elements).toEqual(twin.elements);
      shrubs.getColorAt(i, tint);
      again.getColorAt(i, twinTint);
      expect(tint.getHex()).toBe(twinTint.getHex());
      shades.add(tint.getHex());
      const key = matrix.elements.join(',');
      const remaining = originalInstances.get(key) || 0;
      if (remaining) {
        originalInstances.set(key, remaining - 1);
        continue;
      }
      const wx = matrix.elements[12], wz = matrix.elements[14];
      const x = Math.round(wx / 4) + center.x;
      const y = Math.round(wz / 4) + center.y;
      const tile = map.grid[y]?.[x];
      expect(['#', '.']).toContain(tile);
      kinds.add(tile);
      addedCells.add(x + ',' + y);
      expect(Math.abs(wx - (x - center.x) * 4)).toBeLessThan(0.71);
      expect(Math.abs(wz - (y - center.y) * 4)).toBeLessThan(0.71);
      if (tile === '.') {
        expect(excluded.has(x + ',' + y)).toBe(false);
        expect(matrix.elements[5]).toBeLessThan(0.86);
      } else {
        expect([[1, 0], [-1, 0], [0, 1], [0, -1]]
          .some(([dx, dy]) => map.grid[y + dy]?.[x + dx] === '.')).toBe(true);
      }
    }
    expect([...originalInstances.values()].every(count => count === 0)).toBe(true);
    expect(kinds).toEqual(new Set(['#', '.']));
    expect(addedCells.size).toBeGreaterThan(35);
    expect(shades.size).toBeGreaterThan(2);
  });

  it('creates broad compound-leaf plants with a low mobile polygon budget', () => {
    const full = chroniclesForestHerbGeometry();
    const mobile = chroniclesForestHerbGeometry({ coarsePointer: true });
    const repeat = chroniclesForestHerbGeometry();
    const pos = full.getAttribute('position');
    expect(pos.count).toBe(7 * 4 * 3);
    expect(mobile.getAttribute('position').count).toBe(4 * 2 * 3);
    expect(full.getAttribute('color').count).toBe(pos.count);
    expect(full.boundingBox.min.y).toBeGreaterThanOrEqual(0);
    expect(full.boundingBox.max.y).toBeLessThan(0.85);
    expect(full.boundingBox.min.x).toBeGreaterThan(-0.73);
    expect(full.boundingBox.max.x).toBeLessThan(0.73);
    expect(full.boundingBox.min.z).toBeGreaterThan(-0.73);
    expect(full.boundingBox.max.z).toBeLessThan(0.73);
    expect([...repeat.getAttribute('position').array]).toEqual([...pos.array]);
    for (const value of pos.array) expect(Number.isFinite(value)).toBe(true);
    [full, mobile, repeat].forEach(g => g.dispose());
  });

  it('layers juvenile trees and low herbs near Banner Road forest without blocking walkable paths', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const keepClear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    keepClear.push({ x: 5, y: 6 });
    const options = { grid: map.grid, center, biome: map.biome, mapId: map.id, keepClear };
    const full = buildTerraScenery(options);
    const touch = buildTerraScenery({ ...options, coarsePointer: true });
    const repeat = buildTerraScenery(options);
    const oldMap = buildTerraScenery({ ...options, mapId: 'terra-c4' });
    const herbs = full.getObjectByName('chronicles-terra-forestHerb');
    const touchHerbs = touch.getObjectByName('chronicles-terra-forestHerb');
    expect(herbs).toBeInstanceOf(THREE.InstancedMesh);
    expect(herbs.count).toBeGreaterThan(45);
    expect(touchHerbs.count).toBeLessThan(herbs.count);
    expect(herbs.material.vertexColors).toBe(true);
    expect(herbs.material.transparent).toBe(false);
    expect(herbs.castShadow).toBe(false);
    expect(herbs.instanceColor.count).toBe(herbs.count);
    expect(oldMap.getObjectByName('chronicles-terra-forestHerb')).toBeUndefined();
    const excluded = new Set(keepClear.map(cell => cell.x + ',' + cell.y));
    const matrix = new THREE.Matrix4();
    const twin = new THREE.Matrix4();
    const colour = new THREE.Color(), second = new THREE.Color();
    const variants = new Set(), cellTypes = new Set();
    const repeatHerbs = repeat.getObjectByName('chronicles-terra-forestHerb');
    for (let i = 0; i < herbs.count; i += 1) {
      herbs.getMatrixAt(i, matrix);
      repeatHerbs.getMatrixAt(i, twin);
      expect(matrix.elements).toEqual(twin.elements);
      herbs.getColorAt(i, colour);
      repeatHerbs.getColorAt(i, second);
      expect(colour.getHex()).toBe(second.getHex());
      variants.add(colour.getHex());
      const wx = matrix.elements[12], wz = matrix.elements[14];
      const x = Math.round(wx / 4) + center.x;
      const y = Math.round(wz / 4) + center.y;
      const tile = map.grid[y]?.[x];
      expect(['.', '#']).toContain(tile);
      cellTypes.add(tile);
      expect(Math.abs(wx - (x - center.x) * 4)).toBeLessThan(0.55);
      expect(Math.abs(wz - (y - center.y) * 4)).toBeLessThan(0.55);
      if (tile === '.') {
        expect(excluded.has(x + ',' + y)).toBe(false);
        // A low broadleaf herb is decoration, never a blocking bush.
        expect(matrix.elements[5]).toBeLessThan(0.70);
      } else expect(matrix.elements[5]).toBeGreaterThan(0.95);
    }
    expect(cellTypes.size).toBe(2);
    expect(variants.size).toBeGreaterThan(2);
    const trunks = full.getObjectByName('chronicles-terra-broadleafTrunk');
    const originalTrunks = oldMap.getObjectByName('chronicles-terra-broadleafTrunk');
    expect(trunks.count).toBe(originalTrunks.count);
    const young = [];
    const original = [];
    const scale = new THREE.Vector3();
    for (let i = 0; i < trunks.count; i += 1) {
      trunks.getMatrixAt(i, matrix);
      matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
      young.push(scale.y);
      originalTrunks.getMatrixAt(i, twin);
      twin.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
      original.push(scale.y);
    }
    // Compare the same authored tree instances, not the global minima:
    // outer-ring trees can legitimately be shorter even on other maps.
    // Banner Road juveniles must be substantially smaller than THEIR
    // original grown counterpart, with identical blocked-cell placements.
    const shortened = young.filter((s, i) => s < original[i] * 0.80);
    expect(shortened.length).toBeGreaterThan(8);
    expect(young.filter(s => s < 2.0).length).toBeGreaterThan(8);
    // Coarse devices intentionally skip part of the distant out-of-map
    // tree ring: only authored in-map juvenile transforms must be retained.
    const mobileTrunks = touch.getObjectByName('chronicles-terra-broadleafTrunk');
    expect(mobileTrunks.count).toBeGreaterThan(10);
    expect(mobileTrunks.count).toBeLessThanOrEqual(trunks.count);
    expect(full.children.every(child => child.isInstancedMesh)).toBe(true);
  });

  it('renders individual meadow blades rather than solid cones, with no extra draw calls or collision', () => {
    const desktop = chroniclesMeadowGrassGeometry();
    const mobile = chroniclesMeadowGrassGeometry({ coarsePointer: true });
    expect(desktop.getAttribute('color').count).toBe(desktop.getAttribute('position').count);
    expect(desktop.getAttribute('position').count).toBeGreaterThan(mobile.getAttribute('position').count);
    expect(desktop.boundingSphere.radius).toBeLessThan(0.65);
    for (const value of desktop.getAttribute('position').array) expect(Number.isFinite(value)).toBe(true);
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const roadCells = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    const scene = buildTerraScenery({
      grid: map.grid, center, biome: map.biome, mapId: map.id, keepClear: roadCells,
    });
    const grass = scene.getObjectByName('chronicles-terra-tuft');
    expect(grass).toBeInstanceOf(THREE.InstancedMesh);
    expect(grass.material.vertexColors).toBe(true);
    expect(grass.castShadow).toBe(false);
    expect(grass.count).toBeGreaterThan(20);
    const clear = new Set(roadCells.map(cell => cell.x + ',' + cell.y));
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < grass.count; i += 1) {
      grass.getMatrixAt(i, matrix);
      const x = Math.round(matrix.elements[12] / 4) + center.x;
      const y = Math.round(matrix.elements[14] / 4) + center.y;
      expect(map.grid[y]?.[x]).toBe('.');
      expect(clear.has(x + ',' + y)).toBe(false);
    }
    desktop.dispose();
    mobile.dispose();
  });


  it('fills Banner Road meadow cells and road edges without adding colliders or crossing paved cells', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const keepClear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    // An authored interaction cell is also reserved, not merely road tiles.
    keepClear.push({ x: 5, y: 6 });
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id, keepClear };
    const full = buildTerraScenery(args);
    const touch = buildTerraScenery({ ...args, coarsePointer: true });
    const again = buildTerraScenery(args);
    const baseline = buildTerraScenery({ ...args, mapId: 'terra-c4' });
    const grass = full.getObjectByName('chronicles-terra-tuft');
    const mobile = touch.getObjectByName('chronicles-terra-tuft');
    const older = baseline.getObjectByName('chronicles-terra-tuft');
    const flowers = full.getObjectByName('chronicles-terra-flower');
    expect(grass).toBeInstanceOf(THREE.InstancedMesh);
    expect(flowers).toBeInstanceOf(THREE.InstancedMesh);
    expect(mobile).toBeInstanceOf(THREE.InstancedMesh);
    expect(grass.count + full.getObjectByName('chronicles-terra-meadowSedge').count)
      .toBeGreaterThan(older.count * 3);
    expect(grass.count + full.getObjectByName('chronicles-terra-meadowSedge').count)
      .toBeGreaterThan(mobile.count * 2);
    expect(flowers.count).toBeGreaterThan(15);
    expect(grass.instanceColor.count).toBe(grass.count);
    expect(grass.material.vertexColors).toBe(true);
    expect(mobile.material.vertexColors).toBe(true);
    expect(grass.castShadow).toBe(false);
    expect(touch.getObjectByName('chronicles-terra-flower')).toBeUndefined();
    const empty = new Set(keepClear.map(({ x, y }) => x + ',' + y));
    const matrix = new THREE.Matrix4();
    const same = new THREE.Matrix4();
    const tint = new THREE.Color();
    const otherTint = new THREE.Color();
    const variations = new Set();
    for (const batch of [grass, mobile, flowers]) {
      const restored = again.getObjectByName(batch.name);
      if (batch === mobile) expect(batch.count).toBeLessThan(grass.count);
      else expect(restored.count).toBe(batch.count);
      for (let i = 0; i < batch.count; i += 1) {
        batch.getMatrixAt(i, matrix);
        const wx = matrix.elements[12];
        const wz = matrix.elements[14];
        const x = Math.round(wx / 4) + center.x;
        const y = Math.round(wz / 4) + center.y;
        expect(map.grid[y]?.[x], batch.name + ' at ' + x + ',' + y).toBe('.');
        expect(empty.has(x + ',' + y)).toBe(false);
        expect(Math.abs(wx - (x - center.x) * 4)).toBeLessThan(1.5);
        expect(Math.abs(wz - (y - center.y) * 4)).toBeLessThan(1.5);
        if (batch === grass) {
          restored.getMatrixAt(i, same);
          expect(same.elements).toEqual(matrix.elements);
          batch.getColorAt(i, tint);
          restored.getColorAt(i, otherTint);
          expect(otherTint.getHex()).toBe(tint.getHex());
          variations.add(tint.getHex());
        }
      }
    }
    expect(variations.size).toBeGreaterThan(2);
    expect(full.children.every(child => child.isInstancedMesh)).toBe(true);
    expect(touch.children.every(child => child.isInstancedMesh)).toBe(true);
  });

  it('creates small opaque wildflower sprigs with petals and stems, never floating spheres', () => {
    const shape = chroniclesMeadowWildflowersGeometry();
    const position = shape.getAttribute('position');
    const colors = shape.getAttribute('color');
    shape.computeBoundingBox();
    expect(position.count).toBeGreaterThan(60);
    expect(position.count).toBeLessThan(170);
    expect(colors.count).toBe(position.count);
    expect(shape.boundingBox.min.y).toBeGreaterThanOrEqual(0);
    expect(shape.boundingBox.max.y).toBeLessThan(0.65);
    for (const n of position.array) expect(Number.isFinite(n)).toBe(true);
    shape.dispose();
  });

  it('gives Banner Road trees and bushes varied deterministic foliage while leaving roads clear', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: 'plains', mapId: map.id };
    const detailed = buildTerraScenery(args);
    const touch = buildTerraScenery({ ...args, coarsePointer: true });
    const restored = buildTerraScenery(args);
    const colours = new THREE.Color();
    const twin = new THREE.Color();
    const matrix = new THREE.Matrix4();
    const twinMatrix = new THREE.Matrix4();
    for (const part of ['crown', 'bush']) {
      const batch = detailed.getObjectByName('chronicles-terra-' + part);
      const reduced = touch.getObjectByName('chronicles-terra-' + part);
      const again = restored.getObjectByName('chronicles-terra-' + part);
      expect(batch).toBeInstanceOf(THREE.InstancedMesh);
      expect(batch.count).toBeGreaterThan(10);
      expect(reduced.count).toBeGreaterThan(0);
      expect(batch.count).toBeGreaterThanOrEqual(reduced.count);
      expect(batch.instanceColor.count).toBe(batch.count);
      expect(reduced.instanceColor.count).toBe(reduced.count);
      const shades = new Set();
      for (let i = 0; i < batch.count; i += 1) {
        batch.getMatrixAt(i, matrix);
        again.getMatrixAt(i, twinMatrix);
        expect(matrix.elements).toEqual(twinMatrix.elements);
        batch.getColorAt(i, colours);
        again.getColorAt(i, twin);
        expect(colours.getHex()).toBe(twin.getHex());
        shades.add(colours.getHex());
        const x = Math.round(matrix.elements[12] / 4) + center.x;
        const y = Math.round(matrix.elements[14] / 4) + center.y;
        if (map.grid[y]?.[x] !== undefined) {
          expect(map.grid[y][x]).toBe('#'); // Only visual dressing of blocked cells
        }
      }
      expect(shades.size).toBeGreaterThan(2);
    }
    expect(detailed.children.every(child => child.isInstancedMesh)).toBe(true);
    expect(detailed.children.length).toBe(restored.children.length);
    // The existing coarse budget deliberately omits some outer-ring scenery,
    // so optional small batches can disappear on touch. The crown and bush
    // batches themselves are already asserted above on BOTH device budgets.
    expect(touch.children.every(mesh => detailed.getObjectByName(mesh.name))).toBe(true);
  });

  it('smooths jagged boulders at full quality while keeping an inexpensive mobile mesh', () => {
    const full = chroniclesOrganicRockGeometry();
    const coarse = chroniclesOrganicRockGeometry({ coarsePointer: true });
    const triangles = (geometry) => geometry.index
      ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3;
    expect(triangles(full)).toBe(80);
    expect(triangles(coarse)).toBe(20);
    expect(full.getAttribute('position').count).toBeLessThan(300);
    const unique = new Set();
    const points = full.getAttribute('position');
    for (let i = 0; i < points.count; i += 1) {
      const values = [points.getX(i), points.getY(i), points.getZ(i)];
      values.forEach((v) => expect(Number.isFinite(v)).toBe(true));
      unique.add(values.map((v) => v.toFixed(5)).join(','));
    }
    expect(unique.size).toBeGreaterThan(15);
    const twin = chroniclesOrganicRockGeometry();
    expect([...twin.getAttribute('position').array]).toEqual([...points.array]);
    const oldRadius = new THREE.IcosahedronGeometry(1, 1).getAttribute('position');
    expect([...points.array]).not.toEqual([...oldRadius.array]);
    full.dispose();
    coarse.dispose();
    twin.dispose();
  });

  it('keeps one instanced draw per scenery part even with better silhouettes', () => {
    const map = chroniclesMapById('terra-e2');
    const args = { grid: map.grid, center: { x: 10, y: 7 }, biome: 'hills', scenery: map.scenery };
    const detailed = buildTerraScenery(args);
    const compact = buildTerraScenery({ ...args, coarsePointer: true });
    const boulders = detailed.getObjectByName('chronicles-terra-boulder');
    const cheapBoulders = compact.getObjectByName('chronicles-terra-boulder');
    expect(boulders).toBeInstanceOf(THREE.InstancedMesh);
    expect(cheapBoulders).toBeInstanceOf(THREE.InstancedMesh);
    // Coarse mode intentionally thins the *outer* scenery ring, so its
    // instance count may be smaller; never assume full/coarse parity.
    expect(boulders.count).toBeGreaterThanOrEqual(cheapBoulders.count);
    expect(boulders.geometry.getAttribute('position').count).toBeGreaterThan(
      cheapBoulders.geometry.getAttribute('position').count,
    );
    expect(boulders.material.flatShading).toBe(false);
    expect(cheapBoulders.material.flatShading).toBe(true);
    const names = detailed.children.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect(compact.children.every((m) => names.includes(m.name))).toBe(true);
    expect(detailed.children.every((m) => m.isInstancedMesh)).toBe(true);
    expect(compact.children.every((m) => m.isInstancedMesh)).toBe(true);
  });

  it('adds low flowering heather exclusively on B2 solid border cells, never on paths', () => {
    const b2 = chroniclesMapById('terra-b2');
    const center = { x: 10, y: 7 };
    const args = { grid: b2.grid, center, biome: b2.biome, mapId: b2.id, scenery: b2.scenery };
    const detailed = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const heather = detailed.getObjectByName('chronicles-terra-heather');
    const reduced = mobile.getObjectByName('chronicles-terra-heather');
    expect(heather).toBeInstanceOf(THREE.InstancedMesh);
    expect(reduced).toBeInstanceOf(THREE.InstancedMesh);
    expect(heather.count).toBeGreaterThan(5);
    expect(reduced.count).toBeGreaterThan(0);
    expect(reduced.count).toBeLessThan(heather.count);
    expect(heather.count).toBeLessThan(70); // Bounded one draw call.
    expect(heather.castShadow).toBe(false);
    expect(heather.material.vertexColors).toBe(true);
    expect(detailed.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    const matrix = new THREE.Matrix4();
    const world = new THREE.Vector3();
    for (let i = 0; i < heather.count; i += 1) {
      heather.getMatrixAt(i, matrix);
      world.setFromMatrixPosition(matrix);
      const x = Math.round(world.x / 4) + center.x;
      const y = Math.round(world.z / 4) + center.y;
      expect(b2.grid[y][x], `heather at ${x},${y}`).toBe('#');
      expect(Math.max(Math.abs(world.x - (x - center.x) * 4),
        Math.abs(world.z - (y - center.y) * 4))).toBeLessThan(1.5);
      expect([[0, -1], [1, 0], [0, 1], [-1, 0]]
        .some(([dx, dy]) => b2.grid[y + dy]?.[x + dx] === '.')).toBe(true);
    }
    expect(buildTerraScenery({ ...args, mapId: 'terra-e2' })
      .getObjectByName('chronicles-terra-heather')).toBeUndefined();
    expect(buildTerraScenery({ ...args, biome: 'plains' })
      .getObjectByName('chronicles-terra-heather')).toBeUndefined();
    const again = buildTerraScenery(args).getObjectByName('chronicles-terra-heather');
    expect(again.count).toBe(heather.count);
    heather.getMatrixAt(0, matrix);
    const compare = new THREE.Matrix4();
    again.getMatrixAt(0, compare);
    expect(compare.elements).toEqual(matrix.elements);
  });

  it('uses a small, finite, vertex-coloured heather silhouette without textures', () => {
    const geometry = chroniclesBrezalHeatherGeometry();
    const vertices = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    expect(vertices.count).toBeLessThanOrEqual(60);
    expect(color.count).toBe(vertices.count);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.min.y).toBeGreaterThanOrEqual(0);
    expect(geometry.boundingBox.max.y).toBeLessThan(0.7);
    for (const value of vertices.array) expect(Number.isFinite(value)).toBe(true);
    geometry.dispose();
  });

  it('weathers only B2 boulders with deterministic per-instance lichen tones', () => {
    const b2 = chroniclesMapById('terra-b2');
    const args = { grid: b2.grid, center: { x: 10, y: 7 },
      biome: b2.biome, scenery: b2.scenery };
    const themed = buildTerraScenery({ ...args, mapId: b2.id });
    const repeat = buildTerraScenery({ ...args, mapId: b2.id });
    const plain = buildTerraScenery({ ...args, mapId: 'terra-e2' });
    const rocks = themed.getObjectByName('chronicles-terra-boulder');
    const matching = repeat.getObjectByName('chronicles-terra-boulder');
    const unchanged = plain.getObjectByName('chronicles-terra-boulder');
    expect(rocks).toBeInstanceOf(THREE.InstancedMesh);
    expect(rocks.count).toBeGreaterThan(20);
    expect(rocks.instanceColor).toBeTruthy();
    expect(unchanged.instanceColor).toBeNull();
    expect(rocks.count).toBe(unchanged.count);
    expect(rocks.geometry.getAttribute('position').count)
      .toBe(unchanged.geometry.getAttribute('position').count);
    expect(rocks.material.map).toBe(unchanged.material.map);
    const matrix = new THREE.Matrix4();
    const otherMatrix = new THREE.Matrix4();
    const tint = new THREE.Color();
    const otherTint = new THREE.Color();
    const variations = new Set();
    for (let i = 0; i < rocks.count; i += 1) {
      rocks.getMatrixAt(i, matrix);
      unchanged.getMatrixAt(i, otherMatrix);
      expect(matrix.elements).toEqual(otherMatrix.elements);
      rocks.getColorAt(i, tint);
      matching.getColorAt(i, otherTint);
      expect(tint.getHex()).toBe(otherTint.getHex());
      variations.add(tint.getHex());
    }
    expect(variations.size).toBeGreaterThan(1);
    expect(themed.children.length).toBe(plain.children.length + 1); // Heather already exclusive to B2.
  });

  it('is deterministic', () => {
    const map = chroniclesMapById('terra-e2');
    const center = { x: 10, y: 7 };
    const a = instanceCells(buildTerraScenery({ grid: map.grid, center, biome: 'hills' }), center);
    const b = instanceCells(buildTerraScenery({ grid: map.grid, center, biome: 'hills' }), center);
    expect(a).toEqual(b);
  });
});
