import * as THREE from 'three';
import { chroniclesBrezalVergeRelief, chroniclesBannerRoadGroveOffset, chroniclesBannerTreeCrownProfile, chroniclesBannerMeadowEdge } from './chroniclesTerraScenery.js';
import { describe, expect, it } from 'vitest';
import { chroniclesBannerRoadFlowerCells, TERRA_SCENERY_MARGIN, chroniclesBannerRoadBackdropScale, chroniclesBannerRoadCanopyRhythm, chroniclesBannerRoadGatewayGrove, chroniclesBannerRoadWoodlineRoot, chroniclesBannerRoadBrackenCell, buildTerraScenery, chroniclesOrganicRockGeometry, chroniclesOrganicCanopyGeometry, chroniclesLayeredCanopyGeometry, chroniclesWoodlandLeafMassGeometry, chroniclesLayeredShrubGeometry, chroniclesBranchingTrunkGeometry, chroniclesMeadowGrassGeometry, chroniclesMeadowSedgeGeometry, chroniclesForestHerbGeometry, chroniclesMeadowWildflowersGeometry, chroniclesWoodlandUnderstoryGeometry, chroniclesMeadowMicroreliefGeometry, chroniclesFallenWoodGeometry, chroniclesBrezalHeatherGeometry, chroniclesTerraSceneryBiomes } from './chroniclesTerraScenery.js';
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

  it.each([false, true])('uses a brighter directional bark atlas only on C3 broadleaf trunks (coarse=%s)', coarsePointer => {
    const bark = chroniclesPixelTexture('woodlandbark');
    const original = chroniclesPixelTexture('bark');
    expect(bark).toBe(chroniclesPixelTexture('woodlandbark'));
    expect(bark).not.toBe(original);
    expect(bark.userData.chroniclesPixelArt).toEqual({ kind: 'woodlandbark', size: 64, palette: 6 });
    expect(bark.image.data.length).toBe(64 * 64 * 4);
    expect(bark.wrapS).toBe(THREE.RepeatWrapping);
    expect(bark.wrapT).toBe(THREE.RepeatWrapping);
    const average = texture => {
      const p = texture.image.data;
      let sum = 0;
      for (let i = 0; i < p.length; i += 4) sum += (p[i] + p[i + 1] + p[i + 2]) / 3;
      return sum / (p.length / 4);
    };
    expect(average(bark)).toBeGreaterThan(average(original) + 15);
    const p = bark.image.data, colors = new Set();
    let dx = 0, dy = 0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = 4 * (y * 64 + x);
        expect(p[i + 3]).toBe(255);
        colors.add(p.slice(i, i + 3).join(','));
        dx += Math.abs(p[i] - p[4 * (y * 64 + (x + 1) % 64)]);
        dy += Math.abs(p[i] - p[4 * (((y + 1) % 64) * 64 + x)]);
      }
    }
    expect(colors.size).toBeGreaterThanOrEqual(4);
    expect(dx).toBeGreaterThan(dy * 1.3);
    const map = chroniclesMapById('banner-road-first-book');
    const options = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome, coarsePointer };
    const woodland = buildTerraScenery({ ...options, mapId: map.id });
    const generic = buildTerraScenery({ ...options, mapId: 'terra-c4' });
    const trunk = woodland.getObjectByName('chronicles-terra-broadleafTrunk');
    const other = generic.getObjectByName('chronicles-terra-broadleafTrunk');
    expect(trunk.material.map.userData.chroniclesPixelArt.kind).toBe('woodlandbark');
    expect(other.material.map.userData.chroniclesPixelArt.kind).toBe('bark');
    expect(trunk.material.map.repeat.toArray()).toEqual([2, 3]);
    expect(trunk.material.emissive.getHex()).toBe(0);
  });

  it('uses muted, varied Banner Road meadow soil without changing its texture budget', () => {
    const meadow = chroniclesPixelTexture('meadow');
    const again = chroniclesPixelTexture('meadow');
    const townGrass = chroniclesPixelTexture('grass');
    expect(meadow).toBe(again);
    expect(meadow).not.toBe(townGrass);
    expect(meadow.image.width).toBe(128);
    expect(meadow.image.height).toBe(128);
    const pixels = meadow.image.data;
    const unique = new Set();
    let earthy = 0;
    let green = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b, alpha] = pixels.slice(i, i + 4);
      expect(alpha).toBe(255);
      unique.add([r, g, b].join(','));
      if (r > g && g > b) earthy += 1;
      if (g > r && g > b) green += 1;
    }
    expect(unique.size).toBeGreaterThan(9);
    expect(earthy / (pixels.length / 4)).toBeGreaterThan(0.04);
    expect(earthy / (pixels.length / 4)).toBeLessThan(0.07);
    expect(green / (pixels.length / 4)).toBeGreaterThan(0.90);
    // Cool umber rather than the previous sandy beige in the same patches.
    expect(unique.has('128,126,98')).toBe(true);
    expect(unique.has('140,135,107')).toBe(false);
  });

  it('keeps Banner Road dirt packed and varied instead of painted with green moss islands', () => {
    const road = chroniclesPixelTexture('woodlandpath');
    expect(road).toBe(chroniclesPixelTexture('woodlandpath'));
    expect(road).not.toBe(chroniclesPixelTexture('heathpath'));
    expect(road.userData.chroniclesPixelArt).toMatchObject({
      kind: 'woodlandpath', size: 128,
    });
    expect(road.image.data.length).toBe(128 * 128 * 4);
    const colors = new Set();
    let dustyMoss = 0;
    let paintedGreen = 0;
    const pixels = road.image.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const key = Array.from(pixels.slice(i, i + 3)).join(',');
      colors.add(key);
      if (key === '119,118,94') dustyMoss += 1;
      if (key === '102,116,81') paintedGreen += 1;
      expect(pixels[i + 3]).toBe(255);
    }
    // The shared pixel-art ramp emits seven distinct tones on this seed;
    // do not require colors the deterministic dither never generates.
    expect(colors.size).toBeGreaterThanOrEqual(7);
    // Subtle granular lichen covers only ~5% of the atlas, not the old
    // ~9% broad opaque green pools visible from the eye-level camera.
    expect(dustyMoss / (128 * 128)).toBeGreaterThan(0.025);
    expect(dustyMoss / (128 * 128)).toBeLessThan(0.06);
    expect(paintedGreen).toBe(0);
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


  it.each([true, false])('sculpts irregular leaf envelopes with bounded mobile refinement (coarse=%s)', coarsePointer => {
    const leaf = chroniclesWoodlandLeafMassGeometry({ coarsePointer });
    const again = chroniclesWoodlandLeafMassGeometry({ coarsePointer });
    const old = chroniclesOrganicCanopyGeometry({ coarsePointer });
    const triangles = shape => (shape.index?.count
      ?? shape.getAttribute('position').count) / 3;
    expect(triangles(leaf)).toBe(coarsePointer ? 36 : 80);
    expect(triangles(old)).toBe(coarsePointer ? 20 : 80);
    expect(leaf.index).not.toBeNull();
    expect(leaf.getAttribute('normal').count).toBe(leaf.getAttribute('position').count);
    expect(leaf.getAttribute('uv').count).toBe(leaf.getAttribute('position').count);
    expect(leaf.getAttribute('position').array)
      .toEqual(again.getAttribute('position').array);
    expect(leaf.getAttribute('position').array)
      .not.toEqual(old.getAttribute('position').array);
    const positions = leaf.getAttribute('position');
    const radii = new Set();
    let upper = 0, lower = 0;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      expect([x, y, z].every(Number.isFinite)).toBe(true);
      if (y > 0.3) upper += 1;
      if (y < -0.3) lower += 1;
      if (Math.abs(y) < 0.7) radii.add(Math.hypot(x, z).toFixed(3));
    }
    expect(upper).toBeGreaterThan(3);
    expect(lower).toBeGreaterThan(3);
    expect(radii.size).toBeGreaterThan(coarsePointer ? 3 : 8);
    expect(leaf.boundingBox.min.y).toBeGreaterThan(-0.81);
    expect(leaf.boundingBox.max.y).toBeGreaterThan(0.90);
    if (coarsePointer) {
      // The low-poly top must have broad shoulders, not a pointed
      // cone/pyramid like the first Chromium 390px screenshot.
      const shoulderHeights = [];
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        if (Math.hypot(x, z) > 0.65 && y > 0.60) shoulderHeights.push(y);
      }
      expect(shoulderHeights.length).toBeGreaterThanOrEqual(5);
      expect(Math.max(...shoulderHeights)).toBeGreaterThan(leaf.boundingBox.max.y - 0.30);
      // A complete extra equatorial ring breaks up the old tall facets.
      const equatorial = [];
      for (let i = 0; i < positions.count; i++) {
        if (Math.abs(positions.getY(i)) < 0.03) {
          equatorial.push(Math.hypot(positions.getX(i), positions.getZ(i)));
        }
      }
      expect(equatorial).toHaveLength(7);
      expect(Math.max(...equatorial)).toBeLessThan(0.96);
      expect(Math.min(...equatorial)).toBeGreaterThan(0.60);
      expect(leaf.parameters.widthSegments).toBe(6);
      expect(leaf.parameters.heightSegments).toBe(4);
    }
    [leaf, old, again].forEach(geometry => geometry.dispose());
  });

  it.each([false, true])('fills the real blocked gate shoulders with tiered grove trees (touch=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const expected = [6, 8, 12, 13];
    const roots = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      chroniclesBannerRoadGatewayGrove(map.grid, center, x, y) ? [{ x, y, tile }] : []));
    expect(roots).toEqual(expected.map(x => ({ x, y: 4, tile: '#' })));
    expect(chroniclesBannerRoadGatewayGrove(map.grid, center, 10, 4)).toBe(false);
    expect(chroniclesBannerRoadGatewayGrove(map.grid, center, 9, 4)).toBe(false);
    expect(chroniclesBannerRoadGatewayGrove(map.grid, center, 8, 5)).toBe(false);
    expect(chroniclesBannerRoadGatewayGrove(map.grid, center, 8, 14)).toBe(false);

    const args = { grid: map.grid, center, biome: map.biome, coarsePointer };
    const full = buildTerraScenery({ ...args, mapId: map.id });
    const again = buildTerraScenery({ ...args, mapId: map.id });
    const other = buildTerraScenery({ ...args, mapId: 'terra-c4' });
    const trunk = full.getObjectByName('chronicles-terra-broadleafTrunk');
    const twin = again.getObjectByName('chronicles-terra-broadleafTrunk');
    const baseline = other.getObjectByName('chronicles-terra-broadleafTrunk');
    expect(trunk).toBeInstanceOf(THREE.InstancedMesh);
    expect(full.children.every(child => child.isInstancedMesh)).toBe(true);
    // Banner Road already has its own groundcover batches; the new grove
    // must add only instances within existing broadleaf trunk/crown batches.
    expect(full.children.map(m => m.name).sort())
      .toEqual(again.children.map(m => m.name).sort());
    expect(full.children.filter(m => m.name === 'chronicles-terra-crown')).toHaveLength(1);
    expect(full.children.filter(m => m.name === 'chronicles-terra-broadleafTrunk')).toHaveLength(1);
    expect(trunk.count).toBeGreaterThan(baseline.count);
    const matrix = new THREE.Matrix4(), duplicate = new THREE.Matrix4();
    const pos = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    const found = new Set();
    for (let i = 0; i < trunk.count; i += 1) {
      trunk.getMatrixAt(i, matrix);
      twin.getMatrixAt(i, duplicate);
      expect(matrix.elements).toEqual(duplicate.elements);
      matrix.decompose(pos, rotation, scale);
      const x = Math.round(pos.x / 4) + center.x;
      const y = Math.round(pos.z / 4) + center.y;
      if (y !== 4 || !expected.includes(x)) continue;
      expect(map.grid[y][x]).toBe('#');
      expect(Math.abs(pos.x - (x - center.x) * 4)).toBeLessThan(1.01);
      expect(Math.abs(pos.z - (y - center.y) * 4)).toBeLessThan(1.01);
      expect(scale.y).toBeGreaterThan(2.65);
      expect(scale.y).toBeLessThan(6.5);
      found.add(x);
    }
    expect([...found].sort((a, b) => a - b)).toEqual(expected);
    const originalRoots = new Set();
    const orig = new THREE.Matrix4();
    for (let i = 0; i < baseline.count; i += 1) {
      baseline.getMatrixAt(i, orig);
      if (Math.round(orig.elements[14] / 4) + center.y === 4) {
        originalRoots.add(Math.round(orig.elements[12] / 4) + center.x);
      }
    }
    expect(originalRoots.has(6)).toBe(false); // A real forest gap gets its first tree.
  });

  it.each([true, false])('softens only Banner Road canopy silhouettes with one extra leaf mass (touch=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const base = { grid: map.grid, center, biome: map.biome, coarsePointer };
    const forest = buildTerraScenery({ ...base, mapId: map.id });
    const other = buildTerraScenery({ ...base, mapId: 'terra-c4' });
    const again = buildTerraScenery({ ...base, mapId: map.id });
    const crowns = forest.getObjectByName('chronicles-terra-crown');
    const reference = other.getObjectByName('chronicles-terra-crown');
    const repeat = again.getObjectByName('chronicles-terra-crown');
    const triangles = shape => (shape.index?.count ?? shape.getAttribute('position').count) / 3;
    expect(crowns).toBeInstanceOf(THREE.InstancedMesh);
    expect(crowns.count).toBe(repeat.count);
    expect(forest.children.filter(child => child.name === crowns.name)).toHaveLength(1);
    expect(crowns.material).not.toBe(reference.material);
    expect(crowns.material.map).toBeTruthy();
    expect(crowns.material.vertexColors).toBe(true);
    expect(crowns.material.flatShading).toBe(false);
    expect(reference.material.flatShading).toBe(coarsePointer);
    expect(triangles(crowns.geometry)).toBe(coarsePointer ? 144 : 480);
    expect(triangles(reference.geometry)).toBe(coarsePointer ? 60 : 400);
    const woodland = chroniclesLayeredCanopyGeometry({ coarsePointer, woodland: true });
    const baseline = chroniclesLayeredCanopyGeometry({ coarsePointer });
    // A late forward foliage mass must remain visually joined to the main
    // crown, not float alongside the entrance tree in first-person captures.
    // All masses have the same vertex count and are merged in lobe order.
    const vertices = woodland.getAttribute('position');
    const massCount = coarsePointer ? 4 : 6;
    const verticesPerMass = vertices.count / massCount;
    expect(Number.isInteger(verticesPerMass)).toBe(true);
    const centroid = index => {
      const result = { x: 0, z: 0 };
      for (let j = index * verticesPerMass; j < (index + 1) * verticesPerMass; j += 1) {
        result.x += vertices.getX(j);
        result.z += vertices.getZ(j);
      }
      return { x: result.x / verticesPerMass, z: result.z / verticesPerMass };
    };
    const rootMass = centroid(0);
    const forwardMass = centroid(massCount - 1);
    expect(Math.hypot(forwardMass.x - rootMass.x, forwardMass.z - rootMass.z))
      .toBeLessThan(0.85);
    expect([...crowns.geometry.getAttribute('position').array])
      .toEqual([...woodland.getAttribute('position').array]);
    expect([...repeat.geometry.getAttribute('position').array])
      .toEqual([...woodland.getAttribute('position').array]);
    expect([...reference.geometry.getAttribute('position').array])
      .toEqual([...baseline.getAttribute('position').array]);
    expect(woodland.boundingSphere.radius).toBeGreaterThan(0);
    woodland.computeBoundingBox();
    baseline.computeBoundingBox();
    // The added front-right cluster must change the actual crown outline,
    // not hide useless extra triangles in the pre-existing core.
    expect(woodland.boundingBox.max.z - baseline.boundingBox.max.z)
      .toBeGreaterThan(0.15);
    expect(woodland.boundingBox.min.y).toBeGreaterThanOrEqual(baseline.boundingBox.min.y - 0.02);
    const leafColors = woodland.getAttribute('color');
    expect(leafColors.count).toBe(woodland.getAttribute('position').count);
    const unique = new Set();
    for (let i = 0; i < leafColors.count; i += 1) {
      const values = [leafColors.getX(i), leafColors.getY(i), leafColors.getZ(i)];
      expect(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1))
        .toBe(true);
      unique.add(values.map(n => n.toFixed(3)).join(','));
    }
    expect(unique.size).toBeGreaterThan(15);
    [woodland, baseline].forEach(shape => shape.dispose());
  });

  it.each([false, true])('unifies woodland lobe lighting while preserving outward normals and the shared mesh budget (coarse=%s)', coarsePointer => {
    const crown = chroniclesLayeredCanopyGeometry({ coarsePointer, woodland: true });
    const leaf = chroniclesWoodlandLeafMassGeometry({ coarsePointer });
    const p = crown.getAttribute('position'), n = crown.getAttribute('normal');
    const c = crown.getAttribute('color');
    const localN = leaf.getAttribute('normal');
    const count = leaf.getAttribute('position').count;
    // The unchanged source lobe transforms allow direct comparison with
    // its original normal field before the shared crown lighting pass.
    const scales = [[0.72, 0.90, 0.72], [0.48, 0.60, 0.47], [0.48, 0.58, 0.49],
      ...(!coarsePointer ? [[0.46, 0.48, 0.48], [0.43, 0.54, 0.46]] : []),
      [0.55, 0.46, 0.68]];
    const old = new THREE.Vector3(), actual = new THREE.Vector3(), radial = new THREE.Vector3();
    let improved = 0, total = 0, upper = 0, lower = 0, nu = 0, nl = 0;
    expect(p.count).toBe(count * scales.length);
    expect(crown.index.count / 3).toBe(coarsePointer ? 144 : 480);
    for (let i = 0; i < p.count; i++) {
      const scale = scales[Math.floor(i / count)];
      old.fromBufferAttribute(localN, i % count);
      old.set(old.x / scale[0], old.y / scale[1], old.z / scale[2]).normalize();
      actual.fromBufferAttribute(n, i);
      expect(actual.length()).toBeCloseTo(1, 5);
      expect(actual.dot(old)).toBeGreaterThan(0.80);
      radial.set(p.getX(i), (p.getY(i) - 0.10) * 0.80, (p.getZ(i) - 0.12) * 0.78).normalize();
      expect(actual.dot(radial)).toBeGreaterThanOrEqual(old.dot(radial) - 0.00001);
      if (actual.dot(radial) > old.dot(radial) + 0.01) improved++;
      total++;
      const luminance = (c.getX(i) + c.getY(i) + c.getZ(i)) / 3;
      if (p.getY(i) > 0.65) { upper += luminance; nu++; }
      if (p.getY(i) < -0.25) { lower += luminance; nl++; }
    }
    expect(improved / total).toBeGreaterThan(0.25);
    expect(nu).toBeGreaterThan(0);
    expect(nl).toBeGreaterThan(0);
    expect(upper / nu - lower / nl).toBeGreaterThan(0.10);
    crown.dispose();
    leaf.dispose();
  });

  it.each([false, true])('builds taller asymmetric woodland crowns without altering original foliage (coarse=%s)', coarsePointer => {
    const shaped = chroniclesLayeredCanopyGeometry({ coarsePointer, woodland: true });
    const base = chroniclesLayeredCanopyGeometry({ coarsePointer });
    const restored = chroniclesLayeredCanopyGeometry({ coarsePointer, woodland: true });
    const triangles = g => (g.index?.count ?? g.getAttribute('position').count) / 3;
    expect(triangles(shaped)).toBe(coarsePointer ? 144 : 480);
    expect(triangles(base)).toBe(coarsePointer ? 60 : 400);
    expect(shaped.getAttribute('position').array).toEqual(restored.getAttribute('position').array);
    expect(shaped.getAttribute('color').array).toEqual(restored.getAttribute('color').array);
    shaped.computeBoundingBox();
    base.computeBoundingBox();
    const span = (shape, axis) => shape.boundingBox.max[axis] - shape.boundingBox.min[axis];
    // Verticality matters more than another polygon: a forest crown with
    // branches stacked above one another must not resemble a flat umbrella.
    expect(span(shaped, 'y') / span(shaped, 'x')).toBeGreaterThan(0.67);
    expect(span(shaped, 'x')).toBeLessThan(span(base, 'x') - 0.08);
    expect(shaped.boundingBox.max.y).toBeGreaterThan(base.boundingBox.max.y + 0.09);
    expect(shaped.boundingBox.min.y).toBeGreaterThanOrEqual(base.boundingBox.min.y - 0.02);
    expect(shaped.boundingBox.max.z).toBeGreaterThan(base.boundingBox.max.z + 0.15);
    // A single rounded canopy surface remains opaque and uses existing
    // textured, colour-graded foliage. No separate low branch collider.
    expect(shaped.getAttribute('color').count).toBe(shaped.getAttribute('position').count);
    for (const v of shaped.getAttribute('position').array) expect(Number.isFinite(v)).toBe(true);
    [shaped, base, restored].forEach(g => g.dispose());
  });

  it('adds restrained top-to-bottom crown shading without extra meshes', () => {
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


  it.each([true, false])('lifts only C3 broadleaf albedo without extra batches or emissive light (coarse=%s)', (coarsePointer) => {
    const map = chroniclesMapById('banner-road-first-book');
    const options = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome, coarsePointer };
    const woodland = buildTerraScenery({ ...options, mapId: map.id });
    const generic = buildTerraScenery({ ...options, mapId: 'terra-c4' });
    for (const [part, repeat] of [['crown', 3], ['bush', 2]]) {
      const c3 = woodland.getObjectByName('chronicles-terra-' + part);
      const original = generic.getObjectByName('chronicles-terra-' + part);
      expect(c3).toBeInstanceOf(THREE.InstancedMesh);
      expect(original).toBeInstanceOf(THREE.InstancedMesh);
      const texture = c3.material.map, baseline = original.material.map;
      expect(texture.userData.chroniclesPixelArt.kind).toBe('woodlandleaves');
      expect(baseline.userData.chroniclesPixelArt.kind).toBe('leaves');
      expect(texture.image.width).toBe(32);
      expect(texture.image.height).toBe(32);
      expect(texture.repeat.toArray()).toEqual([repeat, repeat]);
      expect(texture.magFilter).toBe(baseline.magFilter);
      expect(texture.minFilter).toBe(baseline.minFilter);
      expect(c3.material.emissive.getHex()).toBe(0);
      // Avoid applying a second dark green filter to the already coloured
      // leaf atlas, while preserving the generic biome's original material.
      expect(c3.material.color.getHex()).toBe(0xffffff);
      expect(original.material.color.getHex()).toBe(part === 'crown' ? 0xe6efdc : 0xcbdcbd);
      expect(woodland.children.filter(mesh => mesh.name === c3.name)).toHaveLength(1);
      const pixels = texture.image.data, before = baseline.image.data;
      const currentRamp = [0x405b32, 0x547044, 0x698751, 0x809b60, 0x98ac72];
      const formerRamp = [0x344b28, 0x456038, 0x587542, 0x708b50, 0x8ca363];
      const linearLuminance = hex => {
        const col = new THREE.Color(hex);
        return col.r * 0.2126 + col.g * 0.7152 + col.b * 0.0722;
      };
      const used = new Set();
      for (let i = 0; i < pixels.length; i += 4) {
        const hex = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
        const rank = currentRamp.indexOf(hex);
        expect(rank).toBeGreaterThanOrEqual(0);
        used.add(rank);
        const gain = linearLuminance(hex) / linearLuminance(formerRamp[rank]);
        expect(gain).toBeGreaterThan(1.10);
        expect(gain).toBeLessThan(1.65);
      }
      expect(used.size).toBeGreaterThan(2);
      for (let i = 0; i < pixels.length; i += 4) {
        expect(pixels[i]).toBeGreaterThan(before[i]);
        expect(pixels[i + 1]).toBeGreaterThan(before[i + 1]);
        expect(pixels[i + 2]).toBeGreaterThan(before[i + 2]);
        expect(pixels[i + 3]).toBe(255);
      }
    }
  });

  it('varies only C3 crown proportions in a deterministic, bounded skyline rhythm', () => {
    const values = [];
    for (let y = -3; y <= 14; y += 1) {
      for (let x = -3; x <= 23; x += 1) {
        const shape = chroniclesBannerRoadCanopyRhythm(x, y);
        expect(Object.isFrozen(shape)).toBe(true);
        expect(shape).toEqual(chroniclesBannerRoadCanopyRhythm(x, y));
        expect(shape.span).toBeGreaterThan(0.89);
        expect(shape.span).toBeLessThan(1.11);
        expect(shape.height).toBeGreaterThan(0.78);
        expect(shape.height).toBeLessThan(1.23);
        expect(shape.depth).toBeGreaterThan(0.87);
        expect(shape.depth).toBeLessThan(1.13);
        values.push(shape);
      }
    }
    expect(Math.max(...values.map(v => v.height))
      - Math.min(...values.map(v => v.height))).toBeGreaterThan(0.32);
    expect(values.some(v => v.height > 1.12 && v.span < 0.95)).toBe(true);
    expect(values.some(v => v.height < 0.90 && v.span > 1.04)).toBe(true);
    // Pure, local lookups: no new root, object count, collision, material
    // or path state is involved in varying an existing crown.
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    for (const coarsePointer of [false, true]) {
      const params = { grid: map.grid, center, biome: map.biome, mapId: map.id, coarsePointer };
      const first = buildTerraScenery(params);
      const repeat = buildTerraScenery(params);
      const crowns = first.getObjectByName('chronicles-terra-crown');
      const trunks = first.getObjectByName('chronicles-terra-broadleafTrunk');
      const twins = repeat.getObjectByName('chronicles-terra-crown');
      expect(crowns.count).toBe(trunks.count);
      expect(crowns.count).toBe(twins.count);
      expect(first.children.filter(mesh => mesh.name === crowns.name)).toHaveLength(1);
      const m = new THREE.Matrix4(), again = new THREE.Matrix4();
      const size = new THREE.Vector3(), ratios = [];
      for (let i = 0; i < crowns.count; i += 1) {
        crowns.getMatrixAt(i, m);
        twins.getMatrixAt(i, again);
        expect(m.elements).toEqual(again.elements);
        const x = Math.round(m.elements[12] / 4) + center.x;
        const y = Math.round(m.elements[14] / 4) + center.y;
        if (map.grid[y]?.[x] !== '#') continue;
        m.decompose(new THREE.Vector3(), new THREE.Quaternion(), size);
        if (y !== 4 || (x !== 9 && x !== 11)) ratios.push(size.y / size.x);
      }
      expect(ratios.length).toBeGreaterThan(10);
      expect(Math.max(...ratios) - Math.min(...ratios)).toBeGreaterThan(0.20);
      expect(map.grid[13][10]).toBe('.');
      expect(map.grid[12][10]).toBe('.');
    }
  });

  it.each([false, true])('clusters only the existing C3 exterior roots into staggered groves (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const options = { grid: map.grid, center, biome: map.biome, mapId: map.id, coarsePointer };
    const scene = buildTerraScenery(options);
    const repeat = buildTerraScenery(options);
    const trunk = scene.getObjectByName('chronicles-terra-broadleafTrunk');
    const crown = scene.getObjectByName('chronicles-terra-crown');
    const twin = repeat.getObjectByName(trunk.name);
    expect(trunk.count).toBe(crown.count);
    expect(trunk.count).toBe(twin.count);
    const noise = (x, y, salt) => {
      const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const old = [], current = [], occupied = new Map();
    const matrix = new THREE.Matrix4(), again = new THREE.Matrix4();
    const width = map.grid[0].length, height = map.grid.length;
    for (let i = 0; i < trunk.count; i += 1) {
      trunk.getMatrixAt(i, matrix);
      twin.getMatrixAt(i, again);
      expect(matrix.elements).toEqual(again.elements);
      const wx = matrix.elements[12], wz = matrix.elements[14];
      const x = Math.round(wx / 4) + center.x, y = Math.round(wz / 4) + center.y;
      const key = x + ',' + y;
      const k = occupied.has(key) ? 9 : 0;
      occupied.set(key, k);
      const dx = (noise(x, y, k + 23) - 0.5) * 2;
      const dz = (noise(y, x, k + 25) - 0.5) * 2;
      const cx = (x - center.x) * 4, cz = (y - center.y) * 4;
      const inside = x >= 0 && x < width && y >= 0 && y < height;
      // The pre-existing secondary tree (salt 9) keeps its original pose.
      // Only principal exterior trees take the grove offset.
      if (inside || k === 9) {
        if (inside) expect(map.grid[y][x]).toBe('#');
        expect(wx).toBeCloseTo(cx + dx, 4);
        expect(wz).toBeCloseTo(cz + dz, 4);
        if (inside) continue;
      } else {
        const [ox, oz] = chroniclesBannerRoadGroveOffset(x, y, dx, dz);
        expect(Math.abs(ox)).toBeLessThanOrEqual(1.45);
        expect(Math.abs(oz)).toBeLessThanOrEqual(1.45);
        expect(wx).toBeCloseTo(cx + ox, 4);
        expect(wz).toBeCloseTo(cz + oz, 4);
      }
      old.push({ x: cx + dx, z: cz + dz, key, k });
      current.push({ x: wx, z: wz, key, k });
    }
    expect(current).toHaveLength(coarsePointer ? 137 : 247);
    const nearest = points => points.map(p => Math.min(...points.map(
      q => p.key === q.key ? Infinity : Math.hypot(q.x - p.x, q.z - p.z))));
    // Measure spacing across cells, not pre-existing same-cell twin trunks.
    const before = nearest(old), after = nearest(current);
    expect(after.filter(d => d < 3).length).toBeGreaterThan(
      before.filter(d => d < 3).length * 1.4);
    expect(Math.min(...after)).toBeGreaterThan(1.8);
    expect(current.filter(p => p.k === 0)).toHaveLength(coarsePointer ? 102 : 186);
  });

  it('gives the distant Banner Road tree line a coherent, bounded height rhythm', () => {
    // Each horizon ring should have an undulating silhouette rather than
    // virtually equal crowns with only tiny per-tree jitter.
    const samples = [];
    for (let depth = 1; depth <= TERRA_SCENERY_MARGIN; depth += 1) {
      const row = Array.from({ length: 27 }, (_, i) =>
        chroniclesBannerRoadBackdropScale(i - 3, -depth, depth));
      const repeat = Array.from({ length: 27 }, (_, i) =>
        chroniclesBannerRoadBackdropScale(i - 3, -depth, depth));
      expect(row).toEqual(repeat);
      expect(Math.min(...row)).toBeGreaterThan(0.85);
      expect(Math.max(...row)).toBeLessThan(1.55);
      expect(Math.max(...row) - Math.min(...row)).toBeGreaterThan(0.30);
      samples.push(...row);
    }
    expect(new Set(samples.map(n => n.toFixed(3))).size).toBeGreaterThan(35);
  });

  it('gives Banner Road two coordinated tree silhouettes without another draw batch', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const options = { grid: map.grid, center, biome: map.biome, mapId: map.id };
    const forest = buildTerraScenery(options);
    const mobile = buildTerraScenery({ ...options, coarsePointer: true });
    const repeated = buildTerraScenery(options);
    const elsewhere = buildTerraScenery({ ...options, mapId: 'terra-c4' });
    const trunks = forest.getObjectByName('chronicles-terra-broadleafTrunk');
    const crowns = forest.getObjectByName('chronicles-terra-crown');
    const twinTrunks = repeated.getObjectByName('chronicles-terra-broadleafTrunk');
    const twinCrowns = repeated.getObjectByName('chronicles-terra-crown');
    expect(trunks.count).toBe(crowns.count);
    // The authored forest has an intentionally fuller outer backdrop, but
    // its actual walkable/blocked map remains identical.
    expect(trunks.count).toBeGreaterThan(elsewhere.getObjectByName(trunks.name).count + 30);
    expect(trunks.instanceColor.count).toBe(trunks.count);
    expect(elsewhere.getObjectByName(trunks.name).instanceColor).toBeNull();
    expect(mobile.getObjectByName(trunks.name).instanceColor.count)
      .toBe(mobile.getObjectByName(trunks.name).count);
    expect(forest.children.length).toBe(repeated.children.length);
    const matrix = new THREE.Matrix4(), twin = new THREE.Matrix4();
    const bark = new THREE.Color(), sameBark = new THREE.Color();
    const leaves = new THREE.Color(), sameLeaves = new THREE.Color();
    const trunkSize = new THREE.Vector3(), crownSize = new THREE.Vector3();
    let pale = 0, broad = 0;
    for (let i = 0; i < trunks.count; i += 1) {
      trunks.getMatrixAt(i, matrix);
      twinTrunks.getMatrixAt(i, twin);
      expect(matrix.elements).toEqual(twin.elements);
      matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), trunkSize);
      trunks.getColorAt(i, bark);
      twinTrunks.getColorAt(i, sameBark);
      expect(bark.getHex()).toBe(sameBark.getHex());
      crowns.getMatrixAt(i, matrix);
      twinCrowns.getMatrixAt(i, twin);
      expect(matrix.elements).toEqual(twin.elements);
      matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), crownSize);
      crowns.getColorAt(i, leaves);
      twinCrowns.getColorAt(i, sameLeaves);
      expect(leaves.getHex()).toBe(sameLeaves.getHex());
      const x = Math.round(matrix.elements[12] / 4) + center.x;
      const y = Math.round(matrix.elements[14] / 4) + center.y;
      if (map.grid[y]?.[x] !== '#') continue;
      if (bark.getHex() === 0xf2f2ea) {
        pale += 1;
        expect(trunkSize.y / trunkSize.x).toBeGreaterThan(4.1);
        expect([0xcbdcbd, 0xb8d2bc, 0xdde3c1, 0xc4d8b5]).toContain(leaves.getHex());
      } else {
        broad += 1;
        expect(bark.getHex()).toBe(0xbba58b);
        expect(trunkSize.y / trunkSize.x).toBeCloseTo(3, 4);
      }
      expect(crownSize.x).toBeGreaterThan(0);
      expect(crownSize.y).toBeGreaterThan(0);
    }
    expect(pale).toBeGreaterThan(12);
    expect(broad).toBeGreaterThan(pale);
    expect(forest.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
  });

  it.each([false, true])('forms a high woodland gateway from existing blocked tiles (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const options = { grid: map.grid, center, biome: map.biome, mapId: map.id, coarsePointer };
    const scene = buildTerraScenery(options);
    const repeat = buildTerraScenery(options);
    const other = buildTerraScenery({ ...options, mapId: 'terra-c4' });
    const trunks = scene.getObjectByName('chronicles-terra-broadleafTrunk');
    const crowns = scene.getObjectByName('chronicles-terra-crown');
    const twin = repeat.getObjectByName('chronicles-terra-broadleafTrunk');
    const old = other.getObjectByName('chronicles-terra-broadleafTrunk');
    expect(trunks).toBeInstanceOf(THREE.InstancedMesh);
    expect(crowns).toBeInstanceOf(THREE.InstancedMesh);
    expect(crowns.count).toBe(trunks.count);
    expect(scene.children.filter(child => child.name === trunks.name)).toHaveLength(1);
    expect(scene.children.filter(child => child.name === crowns.name)).toHaveLength(1);
    expect(scene.children.length).toBe(repeat.children.length);
    const matrix = new THREE.Matrix4(), twinMatrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(), position = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const gateway = new Map();
    const leafScale = new THREE.Vector3();
    for (let i = 0; i < trunks.count; i += 1) {
      trunks.getMatrixAt(i, matrix);
      twin.getMatrixAt(i, twinMatrix);
      expect(twinMatrix.elements).toEqual(matrix.elements);
      const x = Math.round(matrix.elements[12] / 4) + center.x;
      const y = Math.round(matrix.elements[14] / 4) + center.y;
      if (map.grid[y]?.[x] !== undefined) expect(map.grid[y][x]).toBe('#');
      if (y === 4 && (x === 9 || x === 11)) {
        matrix.decompose(position, quat, scale);
        expect(scale.y).toBeGreaterThan(4.5);
        expect(scale.y).toBeLessThan(8.5);
        expect(Math.abs(position.x - (x - center.x) * 4)).toBeLessThan(1.1);
        expect(Math.abs(position.z - (y - center.y) * 4)).toBeLessThan(1.1);
        // Crown of the same instance must clear player head height even
        // where it projects across the dirt lane, not create a low leaf wall.
        crowns.getMatrixAt(i, twinMatrix);
        twinMatrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), leafScale);
        // Balance the two visual gateway trees rather than leaving a skinny
        // pale conifer on one side and a flattened umbrella on the other.
        const canopyRatio = leafScale.y / leafScale.x;
        expect(canopyRatio).toBeGreaterThan(0.82);
        expect(canopyRatio).toBeLessThan(1.16);
        const canopyBox = crowns.geometry.boundingBox
          || (crowns.geometry.computeBoundingBox(), crowns.geometry.boundingBox);
        const worldBox = canopyBox.clone().applyMatrix4(twinMatrix);
        expect(worldBox.min.y).toBeGreaterThan(2.35);
        gateway.set(x, {
          trunkHeight: scale.y, canopyHeight: worldBox.max.y, canopyRatio,
        });
      }
    }
    expect([...gateway.keys()].sort((a, b) => a - b)).toEqual([9, 11]);
    expect(gateway.get(9).canopyRatio).toBeGreaterThan(gateway.get(11).canopyRatio);
    expect(gateway.get(9).canopyRatio - gateway.get(11).canopyRatio).toBeLessThan(0.20);
    const originalGateway = [];
    for (let i = 0; i < old.count; i += 1) {
      old.getMatrixAt(i, matrix);
      const x = Math.round(matrix.elements[12] / 4) + center.x;
      const y = Math.round(matrix.elements[14] / 4) + center.y;
      if (y === 4 && (x === 9 || x === 11)) originalGateway.push(x);
    }
    expect(originalGateway).toEqual([11]);
    const crownTriangles = (crowns.geometry.index?.count
      ?? crowns.geometry.getAttribute('position').count) / 3;
    expect(crownTriangles).toBe(coarsePointer ? 144 : 480);
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


  it.each([true, false])('curves only C3 broadleaf trunks and limbs without changing their roots or topology (coarse=%s)', coarsePointer => {
    const original = chroniclesBranchingTrunkGeometry({ coarsePointer });
    const curved = chroniclesBranchingTrunkGeometry({ coarsePointer, woodland: true });
    const restored = chroniclesBranchingTrunkGeometry({ coarsePointer, woodland: true });
    const before = original.getAttribute('position'), after = curved.getAttribute('position');
    const normal = curved.getAttribute('normal');
    expect(curved.index.array).toEqual(original.index.array);
    expect(curved.getAttribute('uv').array).toEqual(original.getAttribute('uv').array);
    expect(after.count).toBe(before.count);
    expect(after.array).toEqual(restored.getAttribute('position').array);
    expect(normal.array).toEqual(restored.getAttribute('normal').array);
    let maxShift = 0, rootCount = 0;
    for (let i = 0; i < before.count; i += 1) {
      const y = before.getY(i);
      const dx = after.getX(i) - before.getX(i), dz = after.getZ(i) - before.getZ(i);
      expect(after.getY(i)).toBe(y);
      if (y <= -0.30) {
        rootCount++;
        expect(dx).toBe(0);
        expect(dz).toBe(0);
        expect(normal.getX(i)).toBe(original.getAttribute('normal').getX(i));
        expect(normal.getY(i)).toBe(original.getAttribute('normal').getY(i));
        expect(normal.getZ(i)).toBe(original.getAttribute('normal').getZ(i));
      } else {
        expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 5);
      }
      maxShift = Math.max(maxShift, Math.hypot(dx, dz));
    }
    expect(rootCount).toBeGreaterThan(10);
    expect(maxShift).toBeGreaterThan(0.10);
    expect(maxShift).toBeLessThan(0.22);
    const map = chroniclesMapById('banner-road-first-book');
    const opts = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome, coarsePointer };
    const tree = id => buildTerraScenery({ ...opts, mapId: id })
      .getObjectByName('chronicles-terra-broadleafTrunk');
    const c3 = tree(map.id), c4 = tree('terra-c4');
    expect(c3.geometry.getAttribute('position').array).toEqual(after.array);
    expect(c4.geometry.getAttribute('position').array).toEqual(before.array);
    [original, curved, restored].forEach(geometry => geometry.dispose());
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
    // C3 / Camino de los Estandartes: only its forest uses a lower,
    // asymmetrical hedgerow; the generic meadow remains pixel-for-pixel
    // unchanged in its underlying mesh, with identical 240/40 triangle cost.
    for (const coarsePointer of [false, true]) {
      const ordinary = chroniclesLayeredShrubGeometry({ coarsePointer });
      const windswept = chroniclesLayeredShrubGeometry({ coarsePointer, woodland: true });
      const copy = chroniclesLayeredShrubGeometry({ coarsePointer, woodland: true });
      const triangles = triangleCount(ordinary);
      expect(triangles).toBe(coarsePointer ? 40 : 240);
      expect(triangleCount(windswept)).toBe(triangles);
      expect(windswept.getAttribute('uv').count)
        .toBe(ordinary.getAttribute('uv').count);
      expect(windswept.getAttribute('position').array)
        .not.toEqual(ordinary.getAttribute('position').array);
      expect(windswept.getAttribute('position').array)
        .toEqual(copy.getAttribute('position').array);
      ordinary.computeBoundingBox();
      windswept.computeBoundingBox();
      const height = geometry => geometry.boundingBox.max.y - geometry.boundingBox.min.y;
      expect(height(windswept)).toBeLessThan(height(ordinary) * 0.85);
      expect(windswept.boundingBox.min.y).toBeGreaterThan(-0.90);
      for (const v of windswept.getAttribute('position').array)
        expect(Number.isFinite(v)).toBe(true);
      ordinary.dispose();
      windswept.dispose();
      copy.dispose();
    }
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
    const otherPlains = buildTerraScenery({
      grid: map.grid, center, biome: 'plains', mapId: 'terra-c4',
    });
    const untouched = otherPlains.getObjectByName('chronicles-terra-bush');
    expect(untouched.geometry.getAttribute('position').array)
      .toEqual(full.getAttribute('position').array);
    expect(shrub.geometry.getAttribute('position').array)
      .not.toEqual(untouched.geometry.getAttribute('position').array);
    const again = buildTerraScenery({
      grid: map.grid, center, biome: 'plains', mapId: map.id,
    }).getObjectByName('chronicles-terra-bush');
    expect(again.count).toBe(shrub.count);
    expect(again.geometry.getAttribute('position').array)
      .toEqual(shrub.geometry.getAttribute('position').array);
    const matrix = new THREE.Matrix4(), same = new THREE.Matrix4();
    for (let i = 0; i < shrub.count; i += 1) {
      shrub.getMatrixAt(i, matrix);
      again.getMatrixAt(i, same);
      expect(matrix.elements).toEqual(same.elements);
    }
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

  it.each([false, true])('folds forest litter into low two-sided leaves within the original budget (coarse=%s)', coarsePointer => {
    const g = chroniclesWoodlandUnderstoryGeometry({ coarsePointer });
    const p = g.getAttribute('position'), c = g.getAttribute('color');
    const sprigs = coarsePointer ? 5 : 20;
    const leaves = coarsePointer ? 1 : 3;
    expect(p.count).toBe((sprigs + leaves * 2 + 1) * 3);
    const v = (attr, i) => new THREE.Vector3().fromBufferAttribute(attr, i);
    for (let i = 0; i < leaves; i++) {
      const n = sprigs * 3 + i * 6;
      expect(v(p, n)).toEqual(v(p, n + 3));
      expect(v(p, n + 2)).toEqual(v(p, n + 4));
      expect(p.getY(n + 2)).toBeGreaterThan(p.getY(n + 1));
      expect(p.getY(n + 2)).toBeGreaterThan(p.getY(n + 5));
      expect(v(c, n)).not.toEqual(v(c, n + 3));
      const left = v(p, n + 1), right = v(p, n + 5);
      expect(left.distanceTo(right)).toBeGreaterThan(0.09);
    }
    for (let i = sprigs * 3; i < p.count; i++) {
      expect(p.getY(i)).toBeGreaterThan(0.01);
      expect(p.getY(i)).toBeLessThan(0.04);
    }
    expect(g.boundingSphere.radius).toBeLessThan(0.9);
    g.dispose();
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


  it.each([false, true])('grades C3 road-to-forest floor light without adding foliage or touching paths (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const keepClear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    const args = { grid: map.grid, center, biome: map.biome,
      mapId: map.id, coarsePointer, keepClear };
    const scene = buildTerraScenery(args);
    const repeat = buildTerraScenery(args);
    const other = buildTerraScenery({ ...args, mapId: 'terra-c4' });
    const tones = {
      forest: new Set(['b5c4a6', 'a9b99a', 'c9c1a4', 'a6ba9a']),
      fringe: new Set(['e8daba', 'dddab9', 'd0d8b4', 'dec9a5']),
      meadow: new Set(['e1eaca', 'c5d8ad', 'f1e9c7', 'dae7c7']),
      shade: new Set(['b4c6aa', 'a9b79b', 'bebc9e', 'a7b9a2']),
      clearing: new Set(['e2d9b9', 'cdd6b0', 'd7c6a0', 'e0dec3']),
    };
    expect(other.getObjectByName('chronicles-terra-forestHerb').instanceColor).toBeNull();
    expect(other.getObjectByName('chronicles-terra-woodlandFloor')).toBeUndefined();
    const m = new THREE.Matrix4(), same = new THREE.Matrix4();
    const color = new THREE.Color(), identical = new THREE.Color();
    const seen = { forest: 0, fringe: 0, meadow: 0, shade: 0, clearing: 0 };
    for (const part of ['forestHerb', 'woodlandFloor']) {
      const mesh = scene.getObjectByName('chronicles-terra-' + part);
      const twin = repeat.getObjectByName(mesh.name);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBe(twin.count);
      expect(mesh.instanceColor?.count).toBe(mesh.count);
      expect(mesh.geometry.getAttribute('position').array)
        .toEqual(twin.geometry.getAttribute('position').array);
      expect(scene.children.filter(child => child.name === mesh.name)).toHaveLength(1);
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, m);
        twin.getMatrixAt(i, same);
        expect(m.elements).toEqual(same.elements);
        const x = Math.round(m.elements[12] / 4) + center.x;
        const y = Math.round(m.elements[14] / 4) + center.y;
        mesh.getColorAt(i, color);
        twin.getColorAt(i, identical);
        const shade = color.getHexString();
        expect(shade).toBe(identical.getHexString());
        let zone;
        if (part === 'woodlandFloor') {
          expect(map.grid[y]?.[x]).toBe('#');
          zone = [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .some(([dx, dy]) => map.grid[y + dy]?.[x + dx] === '.')
            ? 'clearing' : 'shade';
        } else if (map.grid[y]?.[x] === '#') {
          zone = 'forest';
        } else {
          expect(map.grid[y]?.[x]).toBe('.');
          expect(x).not.toBe(center.x);
          expect(y).not.toBe(center.y);
          zone = Math.abs(x - center.x) === 1
            || Math.abs(y - center.y) === 1 ? 'fringe' : 'meadow';
        }
        expect(tones[zone].has(shade)).toBe(true);
        seen[zone] += 1;
      }
    }
    expect(seen.forest).toBeGreaterThan(0);
    expect(seen.fringe).toBeGreaterThan(0);
    expect(seen.meadow).toBeGreaterThan(0);
    expect(seen.clearing).toBeGreaterThan(0);
    // The road remains original navigable '.' cells: no newly placed
    // ground layer or collision, and both existing part batches stay shared.
    expect(map.grid[13][10]).toBe('.');
    expect(map.grid[12][10]).toBe('.');
  });

  it('keeps authored Banner Road microrelief richer than sparse reusable Terra meadow relief', () => {
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
    const meadowRelief = elsewhere.getObjectByName('chronicles-terra-microrelief');
    expect(meadowRelief).toBeInstanceOf(THREE.InstancedMesh);
    expect(meadowRelief.count).toBeGreaterThan(0);
    expect(meadowRelief.count).toBeLessThan(rocks.count);
    // Native meadows inherit the microrelief SHAPE, not the individually
    // tinted, authored Banner Road coverage or its composition contracts.
    expect(meadowRelief.geometry.getAttribute('position').count)
      .toBe(rocks.geometry.getAttribute('position').count);
    expect(meadowRelief.instanceColor).toBeNull();
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

  it.each([false, true])('folds C3 exposed roots and orients them towards the adjacent forest (coarse=%s)', coarsePointer => {
    const old = chroniclesMeadowMicroreliefGeometry({ coarsePointer });
    const shaped = chroniclesMeadowMicroreliefGeometry({ coarsePointer, woodland: true });
    const p = shaped.getAttribute('position'), c = shaped.getAttribute('color');
    const base = old.getAttribute('position');
    expect(p.count).toBe(base.count);
    const start = (coarsePointer ? 6 : 18) * 3;
    expect(p.array.slice(0, start * 3)).toEqual(base.array.slice(0, start * 3));
    const vec = (attr, i) => new THREE.Vector3().fromBufferAttribute(attr, i);
    for (let j = 0; j < (coarsePointer ? 1 : 2); j++) {
      const i = start + j * 6;
      expect(vec(p, i)).toEqual(vec(p, i + 3));
      expect(vec(p, i + 1)).toEqual(vec(p, i + 5));
      expect(p.getY(i)).toBeCloseTo(0.085);
      expect(p.getY(i + 1)).toBeCloseTo(0.017);
      expect(p.getY(i + 2)).toBeCloseTo(0.013);
      expect(vec(c, i)).not.toEqual(vec(c, i + 3));
    }
    const end = start + (coarsePointer ? 6 : 12);
    expect(p.array.slice(end * 3)).toEqual(base.array.slice(end * 3));
    const oldColors = old.getAttribute('color');
    const luma = v => v.x * 0.2126 + v.y * 0.7152 + v.z * 0.0722;
    for (let i = start; i < end; i += 6) {
      expect(vec(c, i + 1)).toEqual(vec(c, i + 5));
      expect(vec(c, i + 2)).toEqual(vec(c, i + 4));
      expect(luma(vec(c, i + 2))).toBeLessThan(luma(vec(c, i)));
    }
    for (let i = end; i < p.count; i += 3) {
      expect(vec(oldColors, i)).toEqual(vec(oldColors, i + 1));
      expect(vec(oldColors, i)).toEqual(vec(oldColors, i + 2));
      expect(vec(c, i)).not.toEqual(vec(c, i + 1));
      expect(vec(c, i + 1)).not.toEqual(vec(c, i + 2));
    }
    for (const value of c.array) {
      expect(Number.isFinite(value) && value >= 0 && value <= 1).toBe(true);
    }
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const options = { grid: map.grid, center, biome: map.biome, coarsePointer };
    const mesh = buildTerraScenery({ ...options, mapId: map.id })
      .getObjectByName('chronicles-terra-microrelief');
    const generic = buildTerraScenery({ ...options, mapId: 'terra-c4' })
      .getObjectByName('chronicles-terra-microrelief');
    expect(mesh.geometry.getAttribute('position').array).toEqual(p.array);
    expect(generic.geometry.getAttribute('position').array).toEqual(base.array);
    const matrix = new THREE.Matrix4();
    let edgeCount = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const x = Math.round(matrix.elements[12] / 4) + center.x;
      const y = Math.round(matrix.elements[14] / 4) + center.y;
      const borders = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .filter(([dx, dy]) => map.grid[y + dy]?.[x + dx] === '#');
      if (!borders.length) continue;
      edgeCount++;
      const root = new THREE.Vector3(-1, 0, 0).transformDirection(matrix);
      expect(Math.max(...borders.map(([dx, dy]) => root.x * dx + root.z * dy)))
        .toBeGreaterThan(0.97);
    }
    expect(edgeCount).toBeGreaterThan(5);
    old.dispose();
    shaped.dispose();
  });

  it.each([false, true])('blends C3 stone caps into mossy soil contact without new geometry (coarse=%s)', coarsePointer => {
    const generic = chroniclesMeadowMicroreliefGeometry({ coarsePointer });
    const woodland = chroniclesMeadowMicroreliefGeometry({ coarsePointer, woodland: true });
    const p = woodland.getAttribute('position'), c = woodland.getAttribute('color');
    const original = generic.getAttribute('position'), originalColor = generic.getAttribute('color');
    const count = coarsePointer ? 1 : 3;
    const vec = (a, i) => new THREE.Vector3().fromBufferAttribute(a, i);
    const luma = v => v.x * 0.2126 + v.y * 0.7152 + v.z * 0.0722;
    expect(p.count).toBe(original.count);
    expect(p.array.slice(0, count * 54)).toEqual(original.array.slice(0, count * 54));
    for (let k = 0; k < count; k++) {
      const start = k * 18;
      for (let face = 0; face < 6; face++) {
        const i = start + face * 3;
        const next = start + ((face + 1) % 6) * 3;
        expect(vec(c, i + 1)).toEqual(vec(c, start + 1));
        expect(vec(c, i + 2)).toEqual(vec(c, next));
        expect(luma(vec(c, i))).toBeLessThan(luma(vec(c, i + 1)));
        expect(vec(originalColor, i)).toEqual(vec(originalColor, i + 1));
      }
      expect(vec(c, start)).not.toEqual(vec(c, start + 9));
    }
    generic.dispose();
    woodland.dispose();
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

  it.each([false, true])('seats moss on actual bark facets and shades exposed end grain (coarse=%s)', coarsePointer => {
    const g = chroniclesFallenWoodGeometry({ coarsePointer });
    const p = g.getAttribute('position'), c = g.getAttribute('color');
    const sides = coarsePointer ? 5 : 8;
    const patches = coarsePointer ? 2 : 4;
    const v = (attr, i) => new THREE.Vector3().fromBufferAttribute(attr, i);
    expect(p.count).toBe((sides * 4 + (coarsePointer ? 1 : 2) + patches) * 3);
    const facets = [];
    for (let i = 0; i < sides; i++) {
      const n = i * 12;
      for (const j of [n, n + 3]) facets.push(new THREE.Triangle(v(p, j), v(p, j + 1), v(p, j + 2)));
      for (const j of [n + 6, n + 9]) {
        const center = v(c, j), rim = v(c, j + 1);
        expect(center.length()).toBeLessThan(rim.length());
      }
    }
    const first = p.count - patches * 3;
    for (let i = first; i < p.count; i++) {
      const point = v(p, i);
      const distance = Math.min(...facets.map(f =>
        f.closestPointToPoint(point, new THREE.Vector3()).distanceTo(point)));
      expect(distance).toBeGreaterThan(0.0001);
      expect(distance).toBeLessThan(0.0021);
    }
    for (let i = first; i < p.count; i += 3) {
      expect(v(c, i)).not.toEqual(v(c, i + 1));
    }
    g.dispose();
  });

  it.each([false, true])('adds tiny coherent fungi colonies to existing fallen wood without another mesh (coarse=%s)', coarsePointer => {
    const old = chroniclesFallenWoodGeometry({ coarsePointer });
    const fungi = chroniclesFallenWoodGeometry({ coarsePointer, fungi: true });
    const repeat = chroniclesFallenWoodGeometry({ coarsePointer, fungi: true });
    const p = fungi.getAttribute('position'), original = old.getAttribute('position');
    const c = fungi.getAttribute('color');
    const extra = coarsePointer ? 12 : 42;
    expect((p.count - original.count) / 3).toBe(extra);
    expect(p.array.slice(0, original.array.length)).toEqual(original.array);
    expect(p.array).toEqual(repeat.getAttribute('position').array);
    expect(c.array).toEqual(repeat.getAttribute('color').array);
    const shades = new Set();
    for (let i = original.count; i < p.count; i++) {
      expect(p.getY(i)).toBeGreaterThan(0);
      expect(p.getY(i)).toBeLessThan(0.21);
      expect(p.getX(i)).toBeGreaterThan(-0.57);
      expect(p.getX(i)).toBeLessThan(-0.07);
      expect(p.getZ(i)).toBeGreaterThan(0.14);
      expect(p.getZ(i)).toBeLessThan(0.35);
      shades.add([c.getX(i), c.getY(i), c.getZ(i)].join(','));
    }
    expect(shades.size).toBe(3);
    const map = chroniclesMapById('banner-road-first-book');
    const group = buildTerraScenery({ grid: map.grid, center: { x: 10, y: 7 },
      biome: map.biome, mapId: map.id, coarsePointer });
    const log = group.getObjectByName('chronicles-terra-fallenWood');
    expect(log.geometry.getAttribute('position').array).toEqual(p.array);
    expect(log.isInstancedMesh).toBe(true);
    expect(group.children.filter(m => /fungi|mushroom/.test(m.name))).toHaveLength(0);
    expect(log.castShadow).toBe(false);
    [old, fungi, repeat].forEach(g => g.dispose());
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

  it.each([false, true])('pulls existing C3 meadow plants toward nearby forest roots without changing plant counts (coarse=%s)', coarsePointer => {
    const edge = chroniclesBannerMeadowEdge;
    expect(edge(['.....', '.....', '.....'], 2, 1)).toEqual({ x: 0, z: 0, influence: 0 });
    expect(edge(['.....', '..#..', '.....'], 1, 1)).toEqual({ x: 1, z: 0, influence: 1 });
    expect(edge(['.....', '.#.#.', '.....'], 2, 1)).toEqual({ x: 0, z: 0, influence: 1 });
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const keepClear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    const clear = new Set(keepClear.map(({x, y}) => x + ',' + y));
    const scene = buildTerraScenery({ grid: map.grid, biome: map.biome,
      mapId: map.id, center, keepClear, coarsePointer });
    const noise = (x, y, salt) => {
      const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const expected = { tuft: [], meadowSedge: [] };
    let influenced = 0, unaffected = 0;
    map.grid.forEach((row, y) => [...row].forEach((tile, x) => {
      if (tile !== '.' || clear.has(x + ',' + y)) return;
      const nearPath = [[1,0],[-1,0],[0,1],[0,-1]]
        .some(([dx,dy]) => clear.has((x+dx) + ',' + (y+dy)));
      const cover = THREE.MathUtils.clamp(0.50 + 0.34 * Math.sin(x * 0.59 + y * 0.33)
        * Math.cos(y * 0.46 - x * 0.25) + (noise(x,y,727)-0.5)*0.24, 0, 1);
      const count = coarsePointer ? (cover < 0.27 ? 1 : 2)
        : nearPath ? 4 + Math.floor(cover*5) : 2 + Math.floor(cover*5);
      const habitat = edge(map.grid, x, y);
      const start = Math.floor(noise(x,y,401)*9);
      for (let i = 0; i < count; i++) {
        const slot = (start+i*4)%9;
        const rawX = (slot%3-1)*1.12+(noise(x+i,y,407)-0.5)*0.46;
        const rawZ = (Math.floor(slot/3)-1)*1.12+(noise(y+i,x,409)-0.5)*0.46;
        const sedge = noise(x+i*3,y-i*5,733) < (nearPath ? 0.40 : 0.31);
        const pull = habitat.influence*0.18;
        const height = (sedge ? 0.80+noise(x,y+i,421)*0.22 : 0.56+noise(x,y+i,421)*0.65)
          *(1+habitat.influence*0.12);
        const ox = THREE.MathUtils.lerp(rawX,habitat.x*0.95,pull);
        const oz = THREE.MathUtils.lerp(rawZ,habitat.z*0.95,pull);
        if (pull > 0) influenced++; else unaffected++;
        expected[sedge?'meadowSedge':'tuft'].push([(x-center.x)*4+ox,(y-center.y)*4+oz,height]);
      }
    }));
    const matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
    const aspects = new Set();
    for (const [part, points] of Object.entries(expected)) {
      const mesh = scene.getObjectByName('chronicles-terra-' + part);
      expect(mesh.count).toBe(points.length);
      for (let i=0; i<points.length; i++) {
        mesh.getMatrixAt(i,matrix);
        scale.setFromMatrixScale(matrix);
        expect(matrix.elements[12]).toBeCloseTo(points[i][0],4);
        expect(matrix.elements[14]).toBeCloseTo(points[i][1],4);
        expect(scale.y).toBeCloseTo(points[i][2],4);
        const aspect = scale.z / scale.x;
        expect(aspect).toBeGreaterThanOrEqual(0.7599);
        expect(aspect).toBeLessThanOrEqual(1.0001);
        aspects.add(Math.round(aspect * 100));
      }
    }
    expect(influenced).toBeGreaterThan(10);
    expect(unaffected).toBeGreaterThan(10);
    expect(aspects.size).toBeGreaterThan(8);
    expect(Math.min(...aspects)).toBeLessThan(87);
    expect(Math.max(...aspects)).toBeGreaterThan(92);
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
    expect(shrubs.count).toBeGreaterThan(old.count + 70);
    expect(touch.count).toBeLessThan(shrubs.count);
    expect(shrubs.material.transparent).toBe(false);
    expect(shrubs.geometry.getAttribute('color')).toBeUndefined();
    expect(full.children.every(child => child.isInstancedMesh)).toBe(true);
    const excluded = new Set(keepClear.map(({ x, y }) => x + ',' + y));
    const addedCells = new Set(), kinds = new Set(), shades = new Set();
    const matrix = new THREE.Matrix4(), twin = new THREE.Matrix4();
    const tint = new THREE.Color(), twinTint = new THREE.Color();
    let added = 0;
    for (let i = 0; i < shrubs.count; i += 1) {
      shrubs.getMatrixAt(i, matrix);
      again.getMatrixAt(i, twin);
      expect(matrix.elements).toEqual(twin.elements);
      shrubs.getColorAt(i, tint);
      again.getColorAt(i, twinTint);
      expect(tint.getHex()).toBe(twinTint.getHex());
      shades.add(tint.getHex());
      const wx = matrix.elements[12], wz = matrix.elements[14];
      const x = Math.round(wx / 4) + center.x;
      const y = Math.round(wz / 4) + center.y;
      const tile = map.grid[y]?.[x];
      // Existing broadleaf bushes have variable trunk-derived heights; the
      // new forest-edge and soft-meadow bushes sit at fixed soil elevations.
      // Identify only the new visual layer, not pre-existing juvenile shrubs.
      if (Math.abs(matrix.elements[13] - (tile === '#' ? 0.42 : 0.34)) > 1e-6) continue;
      // The actual shared mesh must meet the soil after its instance scale.
      shrubs.geometry.computeBoundingBox();
      const bottom = matrix.elements[13] + shrubs.geometry.boundingBox.min.y * matrix.elements[5];
      expect(bottom).toBeLessThan(0.06);
      expect(bottom).toBeGreaterThan(-0.40);
      added += 1;
      expect(['#', '.']).toContain(tile);
      kinds.add(tile);
      addedCells.add(x + ',' + y);
      expect(Math.abs(wx - (x - center.x) * 4)).toBeLessThan(0.71);
      expect(Math.abs(wz - (y - center.y) * 4)).toBeLessThan(0.71);
      if (tile === '.') {
        expect(excluded.has(x + ',' + y)).toBe(false);
        expect(matrix.elements[5]).toBeLessThan(0.94);
      } else {
        expect([[1, 0], [-1, 0], [0, 1], [0, -1]]
          .some(([dx, dy]) => map.grid[y + dy]?.[x + dx] === '.')).toBe(true);
      }
    }
    expect(added).toBeGreaterThan(70);
    expect(added).toBeLessThan(155);
    expect(kinds).toEqual(new Set(['#', '.']));
    expect(addedCells.size).toBeGreaterThan(35);
    expect(shades.size).toBeGreaterThan(2);
  });

  it('grows a bounded first-row roadside understory without planting in a paved or quest cell', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const keepClear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    keepClear.push({ x: 5, y: 6 });
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id, keepClear };
    const full = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const repeated = buildTerraScenery(args);
    const other = buildTerraScenery({ ...args, mapId: 'terra-c4' });
    const denied = new Set(keepClear.map(({ x, y }) => x + ',' + y));
    const testBatch = (name, minDesktop, maxMobile) => {
      const mesh = full.getObjectByName('chronicles-terra-' + name);
      const cheap = mobile.getObjectByName(mesh.name);
      const twin = repeated.getObjectByName(mesh.name);
      const old = other.getObjectByName(mesh.name);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(cheap).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBeGreaterThan(cheap.count);
      expect(mesh.geometry).toBeTruthy();
      expect(full.children.filter(child => child.name === mesh.name)).toHaveLength(1);
      expect(old?.count || 0).toBeLessThan(mesh.count);
      const matrix = new THREE.Matrix4();
      const copy = new THREE.Matrix4();
      let visible = 0;
      let mobileVisible = 0;
      for (const [batch, isMobile] of [[mesh, false], [cheap, true]]) {
        for (let i = 0; i < batch.count; i += 1) {
          batch.getMatrixAt(i, matrix);
          if (!isMobile) {
            twin.getMatrixAt(i, copy);
            expect(copy.elements).toEqual(matrix.elements);
          }
          const wx = matrix.elements[12], wz = matrix.elements[14];
          const x = Math.round(wx / 4) + center.x;
          const y = Math.round(wz / 4) + center.y;
          if (map.grid[y]?.[x] === '.') {
            expect(denied.has(x + ',' + y)).toBe(false);
            expect(Math.abs(wx - (x - center.x) * 4)).toBeLessThan(0.66);
            expect(Math.abs(wz - (y - center.y) * 4)).toBeLessThan(0.66);
          }
          const inFirstVerge = x === 9 || x === 11;
          if (inFirstVerge && y >= 8 && y <= 13 && map.grid[y]?.[x] === '.') {
            if (isMobile) mobileVisible += 1;
            else visible += 1;
          }
        }
      }
      expect(visible).toBeGreaterThan(minDesktop);
      expect(mobileVisible).toBeGreaterThan(maxMobile);
      expect(visible).toBeGreaterThan(mobileVisible);
    };
    testBatch('bush', 4, 1);
    testBatch('forestHerb', 3, 0);
    // Real trunks and crowns remain on blocked tiles; none were added to
    // walkable grass just to make the player's path look like thick forest.
    const trunks = full.getObjectByName('chronicles-terra-broadleafTrunk');
    const treeMatrix = new THREE.Matrix4();
    for (let i = 0; i < trunks.count; i += 1) {
      trunks.getMatrixAt(i, treeMatrix);
      const x = Math.round(treeMatrix.elements[12] / 4) + center.x;
      const y = Math.round(treeMatrix.elements[14] / 4) + center.y;
      if (map.grid[y]?.[x] !== undefined) expect(map.grid[y][x]).toBe('#');
    }
    expect(full.children.every(child => child.isInstancedMesh)).toBe(true);
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

  it.each([true, false])('uses lower arched C3 leaves with continuous vertex gradients (coarse=%s)', (coarsePointer) => {
    const ordinary = chroniclesForestHerbGeometry({ coarsePointer });
    const shaped = chroniclesForestHerbGeometry({ coarsePointer, woodland: true });
    const restored = chroniclesForestHerbGeometry({ coarsePointer, woodland: true });
    const pos = shaped.getAttribute('position'), color = shaped.getAttribute('color');
    expect(pos.count).toBe(coarsePointer ? 24 : 84);
    expect(color.count).toBe(pos.count);
    expect(pos.array).toEqual(restored.getAttribute('position').array);
    expect(color.array).toEqual(restored.getAttribute('color').array);
    expect(shaped.boundingBox.max.y).toBeLessThan(ordinary.boundingBox.max.y * 0.85);
    expect(shaped.boundingBox.min.y).toBeCloseTo(ordinary.boundingBox.min.y);
    const at = i => [color.getX(i), color.getY(i), color.getZ(i)];
    const stride = coarsePointer ? 6 : 12;
    const normals = shaped.getAttribute('normal');
    const faceNormals = shaped.clone();
    faceNormals.computeVertexNormals();
    const original = faceNormals.getAttribute('normal');
    const n = (attr, i) => new THREE.Vector3().fromBufferAttribute(attr, i);
    let smoothed = 0;
    for (let i = 0; i < pos.count; i += stride) {
      const joint = n(original, i).add(n(original, i + 4)).normalize();
      for (const j of [1, 2, 3, 5]) {
        expect(n(normals, i + j).distanceTo(joint)).toBeLessThan(1e-6);
        expect(n(normals, i + j).length()).toBeCloseTo(1, 5);
        if (n(normals, i + j).distanceTo(n(original, i + j)) > 0.01) smoothed++;
      }
      expect(n(normals, i)).toEqual(n(original, i));
      expect(n(normals, i + 4)).toEqual(n(original, i + 4));
      if (!coarsePointer) {
        for (let j = 6; j < 12; j++) expect(n(normals, i + j)).toEqual(n(original, i + j));
      }
      const palette = ['#48683b', '#587746', '#718554', '#536d3e'];
      const root = new THREE.Color(palette[(i / stride) % palette.length]);
      expect(color.getX(i)).toBeGreaterThan(root.r);
      expect(at(i + 1)).toEqual(at(i + 3));
      expect(at(i + 2)).toEqual(at(i + 5));
      expect(at(i)).not.toEqual(at(i + 1));
      expect(at(i + 3)).not.toEqual(at(i + 4));
      expect(pos.getY(i + 4)).toBeGreaterThan(pos.getY(i + 1));
    }
    expect(smoothed).toBeGreaterThan(8);
    expect(normals.array).toEqual(restored.getAttribute('normal').array);
    [ordinary, shaped, restored, faceNormals].forEach(geometry => geometry.dispose());
  });

  it.each([false, true])('distinguishes young, upright and spreading crowns on existing tree instances (coarse=%s)', coarsePointer => {
    const profile = chroniclesBannerTreeCrownProfile;
    expect(profile(4, 8, 0.6, false)).toMatchObject({ family: 'young' });
    expect(profile(4, 8, 1, true)).toMatchObject({ family: 'upright' });
    expect(profile(4, 8, 1, false)).toMatchObject({ family: 'spreading' });
    for (const [x, y] of [[9, 4], [11, 4], [6, 4], [20, 7]]) {
      expect(profile(x, y, 0.6, true)).toEqual({ family: 'landmark', span: 1, height: 1, depth: 1 });
    }
    expect(profile(5, 8, 1, false, true).family).toBe('landmark');
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const group = buildTerraScenery({ grid: map.grid, center, biome: map.biome, mapId: map.id, coarsePointer });
    const trunks = group.getObjectByName('chronicles-terra-broadleafTrunk');
    const crowns = group.getObjectByName('chronicles-terra-crown');
    expect(trunks.count).toBe(crowns.count);
    expect(crowns.geometry.index.count / 3).toBe(coarsePointer ? 144 : 480);
    const trunk = new THREE.Matrix4(), crown = new THREE.Matrix4();
    const ts = new THREE.Vector3(), cs = new THREE.Vector3();
    const noise = (x, y, salt) => {
      const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const seen = new Set(), duplicates = new Set(), keys = [];
    for (let i = 0; i < trunks.count; i++) {
      trunks.getMatrixAt(i, trunk);
      const x = Math.round(trunk.elements[12] / 4) + center.x;
      const y = Math.round(trunk.elements[14] / 4) + center.y;
      const key = x + ',' + y;
      if (seen.has(key)) duplicates.add(key);
      seen.add(key);
      keys.push([x, y, key]);
    }
    const families = new Map();
    for (let i = 0; i < trunks.count; i++) {
      const [x, y, key] = keys[i];
      // Only single primary roots in the authored map: exclude secondary
      // trees and the protected gateway/landmarks from the scale comparison.
      if (duplicates.has(key) || map.grid[y]?.[x] !== '#'
        || (y === 4 && x >= 6 && x <= 13) || (x === 20 && y === 7)) continue;
      trunks.getMatrixAt(i, trunk);
      crowns.getMatrixAt(i, crown);
      ts.setFromMatrixScale(trunk);
      cs.setFromMatrixScale(crown);
      const pale = noise(x, y, 881) > 0.56;
      const size = ts.y / (3 * (pale ? 1.12 : 1));
      const originalScale = size / (0.79 + noise(x, y, 21) * 0.65);
      const family = profile(x, y, originalScale, pale);
      const rhythm = chroniclesBannerRoadCanopyRhythm(x, y);
      const expectedX = 1.9 * size * (0.74 + noise(x, y, 27) * 0.55)
        * (pale ? 0.74 : 1) * rhythm.span * family.span;
      const expectedY = 1.6 * size * (0.79 + noise(x, y, 33) * 0.43)
        * (pale ? 1.18 : 1) * rhythm.height * family.height;
      expect(cs.x).toBeCloseTo(expectedX, 4);
      expect(cs.y).toBeCloseTo(expectedY, 4);
      expect(Math.abs(crown.elements[12] - trunk.elements[12])).toBeLessThan(0.4);
      families.set(family.family, (families.get(family.family) || 0) + 1);
    }
    expect(families.get('young')).toBeGreaterThan(2);
    expect(families.get('upright')).toBeGreaterThan(2);
    expect(families.get('spreading')).toBeGreaterThan(2);
  });

  it.each([false, true])('makes the existing eastern road-end oak a landmark without moving its root (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const args = { grid: map.grid, center, biome: map.biome, coarsePointer };
    const scene = buildTerraScenery({ ...args, mapId: map.id });
    const repeat = buildTerraScenery({ ...args, mapId: map.id });
    const generic = buildTerraScenery(args);
    const atRoot = (group, part) => {
      const mesh = group.getObjectByName('chronicles-terra-' + part);
      const matrix = new THREE.Matrix4(), result = [];
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        if (Math.round(matrix.elements[12] / 4) + center.x === 20
          && Math.round(matrix.elements[14] / 4) + center.y === 7) result.push(matrix.clone());
      }
      expect(result).toHaveLength(1);
      return result[0];
    };
    const trunk = atRoot(scene, 'broadleafTrunk');
    const base = atRoot(generic, 'broadleafTrunk');
    const crown = atRoot(scene, 'crown');
    expect(trunk.elements).toEqual(atRoot(repeat, 'broadleafTrunk').elements);
    expect(crown.elements).toEqual(atRoot(repeat, 'crown').elements);
    expect(trunk.elements[12]).toBe(base.elements[12]);
    expect(trunk.elements[14]).toBe(base.elements[14]);
    const scale = m => new THREE.Vector3().setFromMatrixScale(m);
    expect(scale(trunk).y / scale(base).y).toBeCloseTo(1.32, 5);
    expect(scale(trunk).x / scale(base).x).toBeCloseTo(1.32, 5);
    expect(crown.elements[13]).toBeGreaterThan(trunk.elements[13] * 2);
    expect(scene.children.every(child => child.isInstancedMesh)).toBe(true);
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
    // Generic plains now deliberately reuse the low herb species as meadow
    // habitat tiles. Banner Road remains the only dense, individually authored
    // woodland gradient with per-instance tint and blocked-root undergrowth.
    const genericHerbs = oldMap.getObjectByName('chronicles-terra-forestHerb');
    expect(genericHerbs).toBeInstanceOf(THREE.InstancedMesh);
    expect(genericHerbs.count).toBeGreaterThan(0);
    expect(genericHerbs.count).toBeLessThan(herbs.count);
    expect(genericHerbs.instanceColor).toBeNull();
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
    expect(trunks.count).toBeGreaterThan(originalTrunks.count + 30);
    const matrixToMapCell = (mesh) => {
      const trees = new Map();
      const pose = new THREE.Matrix4(), size = new THREE.Vector3();
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, pose);
        const x = Math.round(pose.elements[12] / 4) + center.x;
        const y = Math.round(pose.elements[14] / 4) + center.y;
        if (map.grid[y]?.[x] !== '#') continue;
        pose.decompose(new THREE.Vector3(), new THREE.Quaternion(), size);
        const key = x + ',' + y;
        if (!trees.has(key)) trees.set(key, []);
        trees.get(key).push(size.y);
      }
      return trees;
    };
    const actualTrees = matrixToMapCell(trunks);
    const referenceTrees = matrixToMapCell(originalTrunks);
    // Background density now differs, so match by AUTHORED forest cell,
    // not the global instance index (which includes off-map trees).
    // The original gateway adds a trunk on 9,4. The new intermediate grove
    // explicitly changes four further already-blocked roots; every OTHER
    // historic forest transform must continue to match the old baseline.
    expect(actualTrees.get('9,4')).toHaveLength(1);
    expect(referenceTrees.has('9,4')).toBe(false);
    const gatewayChanges = ['9,4', '6,4', '8,4', '12,4', '13,4'];
    const historicTrees = new Map(actualTrees);
    const unchangedReference = new Map(referenceTrees);
    gatewayChanges.forEach(key => {
      historicTrees.delete(key);
      unchangedReference.delete(key);
    });
    expect([...historicTrees.keys()].sort()).toEqual([...unchangedReference.keys()].sort());
    const young = [], original = [];
    for (const [key, heights] of historicTrees) {
      const baseline = unchangedReference.get(key);
      expect(heights).toHaveLength(baseline.length);
      young.push(...heights);
      original.push(...baseline);
    }
    const shortened = young.filter((height, i) => height < original[i] * 0.80);
    expect(shortened.length).toBeGreaterThan(8);
    // Three previously juvenile gate-shoulder trees become midsize in v39.
    // Keep the eight short juveniles elsewhere; the new grove has its own
    // strict four-root/height test above.
    expect(young.filter(height => height < 2.0).length).toBeGreaterThanOrEqual(8);
    // Coarse devices intentionally skip part of the distant out-of-map
    // tree ring: only authored in-map juvenile transforms must be retained.
    const mobileTrunks = touch.getObjectByName('chronicles-terra-broadleafTrunk');
    expect(mobileTrunks.count).toBeGreaterThan(10);
    expect(mobileTrunks.count).toBeLessThanOrEqual(trunks.count);
    expect(full.children.every(child => child.isInstancedMesh)).toBe(true);
  });

  it.each([false, true])('makes C3 meadow blades slender without increasing geometry (coarse=%s)', coarsePointer => {
    const generic = chroniclesMeadowGrassGeometry({ coarsePointer });
    const slender = chroniclesMeadowGrassGeometry({ coarsePointer, woodland: true });
    const repeat = chroniclesMeadowGrassGeometry({ coarsePointer, woodland: true });
    const a = generic.getAttribute('position'), b = slender.getAttribute('position');
    const ca = generic.getAttribute('color'), cb = slender.getAttribute('color');
    expect(b.count).toBe((coarsePointer ? 5 : 11) * 9);
    expect(b.count).toBe(a.count);
    expect(b.array).toEqual(repeat.getAttribute('position').array);
    expect(cb.array).toEqual(repeat.getAttribute('color').array);
    const v = (attr, i) => new THREE.Vector3().fromBufferAttribute(attr, i);
    for (let i = 0; i < b.count; i += 9) {
      const originalWidth = v(a, i).distanceTo(v(a, i + 1));
      expect(v(b, i).distanceTo(v(b, i + 1))).toBeCloseTo(originalWidth * 0.64, 6);
      expect(v(b, i).add(v(b, i + 1)).multiplyScalar(0.5)
        .distanceTo(v(a, i).add(v(a, i + 1)).multiplyScalar(0.5))).toBeLessThan(1e-6);
      expect(b.getY(i + 8)).toBe(a.getY(i + 8));
      expect(v(b, i + 6).distanceTo(v(b, i + 7)))
        .toBeLessThan(v(a, i + 6).distanceTo(v(a, i + 7)) * 0.50);
      expect(v(cb, i + 8).distanceTo(v(cb, i)))
        .toBeLessThan(v(ca, i + 8).distanceTo(v(ca, i)));
    }
    expect(slender.boundingSphere.radius).toBeLessThan(0.65);
    const map = chroniclesMapById('banner-road-first-book');
    const opts = { grid: map.grid, center: { x: 10, y: 7 }, biome: map.biome, coarsePointer };
    const tuft = mapId => buildTerraScenery({ ...opts, mapId }).getObjectByName('chronicles-terra-tuft');
    expect(tuft(map.id).geometry.getAttribute('position').array).toEqual(b.array);
    expect(tuft('terra-c4').geometry.getAttribute('position').array).toEqual(a.array);
    [generic, slender, repeat].forEach(g => g.dispose());
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
    // The generic meadow now has scattered low clumps and therefore no
    // longer needs to be practically empty. The authored forest must STILL
    // be substantially denser, with its own sedge species and instance tints.
    expect(grass.count + full.getObjectByName('chronicles-terra-meadowSedge').count)
      .toBeGreaterThan(older.count * 2);
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

  it('groups C3 flowers into connected colonies without increasing the population', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const keepClear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    keepClear.push({ x: 5, y: 6 });
    const clear = new Set(keepClear.map(({ x, y }) => x + ',' + y));
    const selected = chroniclesBannerRoadFlowerCells(map.grid, clear);
    expect(selected).toEqual(chroniclesBannerRoadFlowerCells(map.grid, clear));
    expect(selected.size).toBe(56);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let near = 0, isolated = 0;
    for (const key of selected) {
      const [x, y] = key.split(',').map(Number);
      expect(map.grid[y][x]).toBe('.');
      expect(clear.has(key)).toBe(false);
      const neighbors = dirs.map(([dx, dy]) => (x + dx) + ',' + (y + dy));
      if (neighbors.some(k => clear.has(k))) near++;
      if (!neighbors.some(k => selected.has(k))) isolated++;
    }
    expect(near).toBe(24);
    expect(isolated).toBeLessThanOrEqual(2);
    const opts = { grid: map.grid, center, biome: map.biome, mapId: map.id, keepClear };
    const flowers = buildTerraScenery(opts).getObjectByName('chronicles-terra-flower');
    expect(flowers.count).toBe(selected.size);
    const matrix = new THREE.Matrix4();
    const actual = new Set();
    for (let i = 0; i < flowers.count; i++) {
      flowers.getMatrixAt(i, matrix);
      actual.add((Math.round(matrix.elements[12] / 4) + center.x) + ','
        + (Math.round(matrix.elements[14] / 4) + center.y));
    }
    expect(actual).toEqual(selected);
    expect(buildTerraScenery({ ...opts, coarsePointer: true })
      .getObjectByName('chronicles-terra-flower')).toBeUndefined();
    // Degenerate or entirely reserved meadows remain empty.
    expect(chroniclesBannerRoadFlowerCells(['##', '##']).size).toBe(0);
    expect(chroniclesBannerRoadFlowerCells(['.'], new Set(['0,0'])).size).toBe(0);
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

  it.each([true, false])('layers irregular wooded thickets only on real blocked gateway-edge roots (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const expected = [2, 3, 8, 12, 13, 16, 17, 18];
    const roots = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      chroniclesBannerRoadWoodlineRoot(map.grid, center, x, y) ? [{ x, y, tile }] : []));
    expect(roots).toEqual(expected.map(x => ({ x, y: 4, tile: '#' })));
    expect(chroniclesBannerRoadWoodlineRoot(map.grid, center, 9, 4)).toBe(false);
    expect(chroniclesBannerRoadWoodlineRoot(map.grid, center, 11, 4)).toBe(false);
    expect(chroniclesBannerRoadWoodlineRoot(map.grid, center, 10, 5)).toBe(false);

    const props = { grid: map.grid, center, biome: map.biome, mapId: map.id, coarsePointer };
    const current = buildTerraScenery(props);
    const restored = buildTerraScenery(props);
    const neutral = buildTerraScenery({ ...props, mapId: 'terra-c4' });
    const bushes = current.getObjectByName('chronicles-terra-bush');
    const twin = restored.getObjectByName('chronicles-terra-bush');
    expect(bushes).toBeInstanceOf(THREE.InstancedMesh);
    expect(current.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    expect(current.children.map(mesh => mesh.name)).toEqual(restored.children.map(mesh => mesh.name));
    expect(neutral.getObjectByName('chronicles-terra-bush')).toBeInstanceOf(THREE.InstancedMesh);
    const matrix = new THREE.Matrix4(), repeat = new THREE.Matrix4();
    const pos = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    const found = new Map(), variants = new Set();
    for (let i = 0; i < bushes.count; i += 1) {
      bushes.getMatrixAt(i, matrix);
      twin.getMatrixAt(i, repeat);
      expect(repeat.elements).toEqual(matrix.elements);
      matrix.decompose(pos, rotation, scale);
      if (scale.y < 1.45) continue;
      const x = Math.round(pos.x / 4) + center.x;
      const y = Math.round(pos.z / 4) + center.y;
      expect(chroniclesBannerRoadWoodlineRoot(map.grid, center, x, y)).toBe(true);
      expect(Math.abs(pos.x - (x - center.x) * 4)).toBeLessThan(0.35);
      expect(Math.abs(pos.z - (y - center.y) * 4)).toBeLessThan(0.50);
      expect(scale.x).toBeGreaterThan(1.07);
      expect(scale.x).toBeLessThan(1.26);
      expect(scale.z).toBeGreaterThan(1.03);
      expect(scale.z).toBeLessThan(1.22);
      expect(scale.y).toBeLessThan(2.08);
      found.set(x, (found.get(x) || 0) + 1);
      variants.add(scale.y.toFixed(2));
    }
    expect([...found.entries()].sort((left, right) => left[0] - right[0]))
      .toEqual(expected.map(x => [x, 2]));
    expect(variants.size).toBeGreaterThan(6);
    const other = neutral.getObjectByName('chronicles-terra-bush');
    for (let i = 0; i < other.count; i += 1) {
      other.getMatrixAt(i, matrix);
      matrix.decompose(pos, rotation, scale);
      expect(scale.y).toBeLessThan(1.45);
    }
  });

  it.each([true, false])('makes a knee-low bracken gradient across real unpaved forest approach cells (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const expected = [
      [8, 6], [9, 6], [11, 6], [12, 6],
      [8, 8],
      [8, 9], [9, 9], [11, 9],
      [8, 10], [11, 10], [12, 10],
      [8, 11], [9, 11],
    ];
    const candidates = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      chroniclesBannerRoadBrackenCell(map.grid, center, x, y) ? [[x, y]] : []));
    expect(candidates).toEqual(expected);
    expect(chroniclesBannerRoadBrackenCell(map.grid, center, 10, 9)).toBe(false);
    expect(chroniclesBannerRoadBrackenCell(map.grid, center, 9, 7)).toBe(false);
    expect(chroniclesBannerRoadBrackenCell(map.grid, center, 8, 4)).toBe(false);
    const keepClear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    const args = { grid: map.grid, center, biome: map.biome, mapId: map.id, coarsePointer, keepClear };
    const actual = buildTerraScenery(args);
    const again = buildTerraScenery(args);
    const herbs = actual.getObjectByName('chronicles-terra-forestHerb');
    const repeat = again.getObjectByName('chronicles-terra-forestHerb');
    expect(herbs).toBeInstanceOf(THREE.InstancedMesh);
    expect(actual.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    expect(actual.children.map(mesh => mesh.name)).toEqual(again.children.map(mesh => mesh.name));
    const mat = new THREE.Matrix4(), twin = new THREE.Matrix4();
    const pos = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
    const found = new Map();
    for (let i = 0; i < herbs.count; i += 1) {
      herbs.getMatrixAt(i, mat);
      repeat.getMatrixAt(i, twin);
      expect(mat.elements).toEqual(twin.elements);
      mat.decompose(pos, q, scale);
      if (scale.x <= 1.20) continue; // Normal low forest herbs remain unchanged.
      const x = Math.round(pos.x / 4) + center.x;
      const y = Math.round(pos.z / 4) + center.y;
      expect(chroniclesBannerRoadBrackenCell(map.grid, center, x, y)).toBe(true);
      expect(keepClear.some(cell => cell.x === x && cell.y === y)).toBe(false);
      expect(Math.abs(pos.x - (x - center.x) * 4)).toBeLessThan(0.48);
      expect(Math.abs(pos.z - (y - center.y) * 4)).toBeLessThan(0.48);
      expect(scale.x).toBeLessThan(1.35);
      expect(scale.z).toBeLessThan(1.35);
      expect(scale.y).toBeGreaterThan(0.60);
      expect(scale.y).toBeLessThan(0.70);
      found.set(x + ',' + y, (found.get(x + ',' + y) || 0) + 1);
    }
    expect([...found.entries()].sort()).toEqual(
      expected.map(([x, y]) => [x + ',' + y, coarsePointer ? 3 : 4]).sort());
  });

  it.each([true, false])('keeps Banner Road shrub drifts low and in adjacent meadow tiles (coarse=%s)', (coarsePointer) => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    // Use the actual straight road and crossing as the protected clear set,
    // as does buildChroniclesCampaignExterior; do not fake walkable roots.
    const keepClear = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
      tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
    const props = { grid: map.grid, center, biome: 'plains', mapId: map.id, keepClear, coarsePointer };
    const scenery = buildTerraScenery(props);
    const again = buildTerraScenery(props);
    const bushes = scenery.getObjectByName('chronicles-terra-bush');
    const repeat = again.getObjectByName('chronicles-terra-bush');
    expect(bushes).toBeInstanceOf(THREE.InstancedMesh);
    expect(scenery.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    expect(scenery.children.map(mesh => mesh.name))
      .toEqual(again.children.map(mesh => mesh.name));
    const matrix = new THREE.Matrix4(), twin = new THREE.Matrix4();
    const pos = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
    const protectedCells = new Set(keepClear.map(({ x, y }) => x + ',' + y));
    const found = new Set();
    let foregroundDrifts = 0;
    for (let i = 0; i < bushes.count; i += 1) {
      bushes.getMatrixAt(i, matrix);
      repeat.getMatrixAt(i, twin);
      expect(matrix.elements).toEqual(twin.elements);
      matrix.decompose(pos, q, scale);
      const x = Math.round(pos.x / 4) + center.x;
      const y = Math.round(pos.z / 4) + center.y;
      if (map.grid[y]?.[x] !== '.') continue;
      expect(protectedCells.has(x + ',' + y)).toBe(false);
      expect(x).not.toBe(center.x);
      expect(y).not.toBe(center.y);
      // The camera looks north from (10,13): these are its visible two
      // narrow margins, not the distant outer horizon or arbitrary foliage.
      if (![9, 11].includes(x) || y < 8 || y > 13) continue;
      foregroundDrifts += 1;
      found.add(x + ',' + y);
      expect(Math.abs(pos.x - (x - center.x) * 4)).toBeLessThan(0.66);
      expect(Math.abs(pos.z - (y - center.y) * 4)).toBeLessThan(0.66);
      expect(scale.x).toBeGreaterThan(0.71);
      expect(scale.x).toBeLessThan(0.96);
      expect(scale.z).toBeGreaterThan(0.70);
      expect(scale.z).toBeLessThan(0.96);
      expect(scale.y).toBeGreaterThan(0.60);
      expect(scale.y).toBeLessThan(0.81);
    }
    // Formerly only 4 touch / 5 desktop shrubs along 12 visible cells:
    // keep several genuine gaps, but join the meadow into broken low drifts.
    expect(found.size).toBeGreaterThanOrEqual(coarsePointer ? 6 : 7);
    expect(foregroundDrifts).toBeGreaterThanOrEqual(found.size);
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
          if (part === 'crown' || map.grid[y][x] === '#') {
            expect(map.grid[y][x]).toBe('#'); // Trunks/crowns remain on blocked cells.
          } else {
            // New soft shrub islands may dress walkable meadow, NEVER its
            // central paved roads (even if keepClear was not supplied).
            expect(map.grid[y][x]).toBe('.');
            expect(x).not.toBe(center.x);
            expect(y).not.toBe(center.y);
          }
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

  it.each([false, true])('thins only C3 exterior rocks while keeping authored stones (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const opts = { grid: map.grid, center, biome: map.biome, coarsePointer };
    const build = mapId => buildTerraScenery({ ...opts, mapId })
      .getObjectByName('chronicles-terra-boulder');
    const rocks = build(map.id), repeat = build(map.id), baseline = build(null);
    const read = mesh => {
      const inside = new Map(), outside = new Map(), matrix = new THREE.Matrix4();
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, matrix);
        const x = Math.round(matrix.elements[12] / 4) + center.x;
        const y = Math.round(matrix.elements[14] / 4) + center.y;
        const key = x + ',' + y;
        const target = map.grid[y]?.[x] === undefined ? outside : inside;
        expect(target.has(key)).toBe(false);
        target.set(key, matrix.toArray());
      }
      return { inside, outside };
    };
    const actual = read(rocks), original = read(baseline);
    expect(actual).toEqual(read(repeat));
    expect(actual.inside).toEqual(original.inside);
    expect(original.outside.size).toBe(coarsePointer ? 138 : 252);
    expect(actual.outside.size).toBe(coarsePointer ? 50 : 89);
    for (const [key, pose] of actual.outside) {
      const old = original.outside.get(key);
      expect(old).toBeDefined();
      expect(pose[12]).toBeCloseTo(old[12], 5);
      expect(pose[14]).toBeCloseTo(old[14], 5);
      expect(pose[13]).toBeLessThan(old[13]);
      const scale = new THREE.Vector3().setFromMatrixScale(new THREE.Matrix4().fromArray(pose));
      const oldScale = new THREE.Vector3().setFromMatrixScale(new THREE.Matrix4().fromArray(old));
      expect(scale.y).toBeLessThan(oldScale.y * 0.8);
    }
    expect(rocks.geometry.getAttribute('position').count)
      .toBe(baseline.geometry.getAttribute('position').count);
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


  it('builds a layered Banner Road forest horizon outside the playable grid', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const center = { x: 10, y: 7 };
    const base = { grid: map.grid, biome: map.biome, center, mapId: map.id };
    const desktop = buildTerraScenery(base);
    const mobile = buildTerraScenery({ ...base, coarsePointer: true });
    const again = buildTerraScenery(base);
    const other = buildTerraScenery({ ...base, mapId: 'terra-c4' });
    const anotherOther = buildTerraScenery({ ...base, mapId: 'terra-e2' });
    const crowns = desktop.getObjectByName('chronicles-terra-crown');
    const trunks = desktop.getObjectByName('chronicles-terra-broadleafTrunk');
    const cheap = mobile.getObjectByName('chronicles-terra-crown');
    const previous = other.getObjectByName('chronicles-terra-crown');
    expect(crowns.count).toBe(trunks.count);
    expect(crowns.count).toBeGreaterThan(previous.count + 30);
    expect(crowns.count).toBeLessThan(previous.count + 100);
    expect(cheap.count).toBeGreaterThan(0);
    expect(cheap.count).toBeLessThan(crowns.count);
    // Other locations keep the identical original ring-generation policy.
    expect(previous.count)
      .toBe(anotherOther.getObjectByName('chronicles-terra-crown').count);
    // Banner Road already has additional meadow/fern batches; compare its
    // own batch inventory after a deterministic rebuild, not a different map.
    expect(desktop.children.map(mesh => mesh.name))
      .toEqual(again.children.map(mesh => mesh.name));
    expect(new Set(desktop.children.map(mesh => mesh.name)).size)
      .toBe(desktop.children.length);
    expect(other.children.every(mesh => desktop.getObjectByName(mesh.name))).toBe(true);
    const triangles = geometry => (geometry.index?.count
      ?? geometry.getAttribute('position').count) / 3;
    expect(triangles(crowns.geometry)).toBe(480);
    expect(triangles(previous.geometry)).toBe(400);
    expect(triangles(cheap.geometry)).toBeLessThan(triangles(crowns.geometry));
    expect(desktop.children.every(child => child.isInstancedMesh)).toBe(true);

    const collect = mesh => {
      const rings = [0, 0, 0, 0];
      const authored = new Map();
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, matrix);
        const x = Math.round(matrix.elements[12] / 4) + center.x;
        const y = Math.round(matrix.elements[14] / 4) + center.y;
        const depth = Math.max(0, -x, x - map.grid[0].length + 1,
          -y, y - map.grid.length + 1);
        expect(depth).toBeLessThanOrEqual(TERRA_SCENERY_MARGIN);
        if (depth) {
          rings[depth] += 1;
        } else {
          expect(map.grid[y][x]).toBe('#');
          const key = x + ',' + y;
          authored.set(key, (authored.get(key) || 0) + 1);
        }
      }
      return { rings, authored };
    };
    const forest = collect(crowns);
    const baseline = collect(previous);
    const reduced = collect(cheap);
    const repeated = collect(again.getObjectByName('chronicles-terra-crown'));
    // The gate adds the existing mature sentinel at 9,4, and v39 adds one
    // tree to the previously empty blocked root 6,4. The other three grove
    // roots already had juvenile trees, so their instance counts stay at 1.
    // Every other in-grid tree count and all out-of-grid rings stay intact.
    expect(forest.authored.get('9,4')).toBe(1);
    expect(baseline.authored.has('9,4')).toBe(false);
    expect(forest.authored.get('6,4')).toBe(1);
    expect(baseline.authored.has('6,4')).toBe(false);
    const originalForest = new Map(forest.authored);
    originalForest.delete('9,4');
    originalForest.delete('6,4');
    expect([...originalForest]).toEqual([...baseline.authored]);
    expect([...forest.authored]).toEqual([...repeated.authored]);
    expect(forest.rings).toEqual(repeated.rings);
    for (let ring = 1; ring <= TERRA_SCENERY_MARGIN; ring += 1) {
      expect(forest.rings[ring]).toBeGreaterThan(baseline.rings[ring]);
      expect(reduced.rings[ring]).toBeGreaterThan(0);
      expect(reduced.rings[ring]).toBeLessThanOrEqual(forest.rings[ring]);
    }
    // Total deeper canopy mass is up, but kept within a bounded instance budget.
    expect(forest.rings.slice(1).reduce((total, n) => total + n, 0)).toBeLessThan(280);
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

  it('keeps original B2 heather exclusively on blocked verges, with separate flat groundcover on walkable foothills', () => {
    const b2 = chroniclesMapById('terra-b2');
    const center = { x: 10, y: 7 };
    const args = { grid: b2.grid, center, biome: b2.biome, mapId: b2.id, scenery: b2.scenery };
    const detailed = buildTerraScenery(args);
    const mobile = buildTerraScenery({ ...args, coarsePointer: true });
    const heather = detailed.getObjectByName('chronicles-terra-heather');
    const reduced = mobile.getObjectByName('chronicles-terra-heather');
    const low = detailed.getObjectByName('chronicles-terra-heatherGroundcover');
    const lowMobile = mobile.getObjectByName('chronicles-terra-heatherGroundcover');
    expect(heather).toBeInstanceOf(THREE.InstancedMesh);
    expect(low).toBeInstanceOf(THREE.InstancedMesh);
    expect(heather.count).toBeGreaterThan(5);
    expect(heather.count).toBeLessThan(70); // v64 border plants untouched
    expect(reduced.count).toBeGreaterThan(0);
    expect(reduced.count).toBeLessThan(heather.count);
    expect(low.count).toBeGreaterThan(30);
    expect(low.count).toBeLessThan(220);
    expect(lowMobile.count).toBeGreaterThan(10);
    expect(lowMobile.count).toBeLessThan(low.count);
    expect(heather.castShadow).toBe(false);
    expect(low.castShadow).toBe(false);
    expect(heather.material.vertexColors).toBe(true);
    expect(low.material.vertexColors).toBe(true);
    expect(detailed.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    const matrix = new THREE.Matrix4();
    const world = new THREE.Vector3();
    const scale = new THREE.Vector3();
    for (const [mesh, type] of [[heather, 'border'], [low, 'groundcover']]) {
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, matrix);
        world.setFromMatrixPosition(matrix);
        scale.setFromMatrixScale(matrix);
        const x = Math.round(world.x / 4) + center.x;
        const y = Math.round(world.z / 4) + center.y;
        expect(Math.max(Math.abs(world.x - (x - center.x) * 4),
          Math.abs(world.z - (y - center.y) * 4))).toBeLessThan(1.5);
        if (type === 'border') {
          expect(b2.grid[y]?.[x]).toBe('#');
          expect([[0, -1], [1, 0], [0, 1], [-1, 0]]
            .some(([dx, dy]) => b2.grid[y + dy]?.[x + dx] === '.')).toBe(true);
        } else {
          expect(b2.grid[y]?.[x]).toBe('.');
          expect(world.y).toBeCloseTo(0.012, 5);
          expect(scale.y).toBeLessThan(1.24);
          expect(scale.x).toBeLessThan(1.11);
        }
      }
    }
    expect(buildTerraScenery({ ...args, mapId: 'terra-e2' })
      .getObjectByName('chronicles-terra-heatherGroundcover')).toBeUndefined();
    expect(buildTerraScenery({ ...args, biome: 'plains' })
      .getObjectByName('chronicles-terra-heatherGroundcover')).toBeUndefined();
    const again = buildTerraScenery(args);
    expect(again.getObjectByName('chronicles-terra-heather').count).toBe(heather.count);
    expect(again.getObjectByName('chronicles-terra-heatherGroundcover').count).toBe(low.count);
    heather.getMatrixAt(0, matrix);
    const compare = new THREE.Matrix4();
    again.getObjectByName('chronicles-terra-heather').getMatrixAt(0, compare);
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
    // Untinted baseline retains B2's original instances and unsculpted transforms; native E2 now
    // intentionally varies ridge heights, so it is no longer a valid
    // transform baseline for B2.
    const plain = buildTerraScenery(args);
    const nativeE2 = buildTerraScenery({ ...args, mapId: 'terra-e2' });
    const rocks = themed.getObjectByName('chronicles-terra-boulder');
    const matching = repeat.getObjectByName('chronicles-terra-boulder');
    const unchanged = plain.getObjectByName('chronicles-terra-boulder');
    expect(rocks).toBeInstanceOf(THREE.InstancedMesh);
    expect(rocks.count).toBeGreaterThan(20);
    expect(rocks.instanceColor).toBeTruthy();
    // The unnamed native hills are the unchanged transform baseline and
    // deliberately have no B2/E2-special instance colours. B2's authored
    // lichen tint must remain stable across deterministic re-renders.
    expect(unchanged.instanceColor).toBeNull();
    expect(nativeE2.getObjectByName('chronicles-terra-boulder').instanceColor)
      .toBeTruthy();
    expect(rocks.count).toBe(unchanged.count);
    expect(rocks.geometry.getAttribute('position').count)
      .toBe(unchanged.geometry.getAttribute('position').count);
    // Terra E2 now deliberately uses a quiet weathered-upland albedo;
    // authored B2 heath keeps its original rock texture and lichen colour.
    expect(rocks.material.map).toBe(chroniclesPixelTexture('rock'));
    expect(unchanged.material.map).toBe(chroniclesPixelTexture('rock'));
    expect(nativeE2.getObjectByName('chronicles-terra-boulder').material.map)
      .toBe(chroniclesPixelTexture('uplandrock'));
    const matrix = new THREE.Matrix4();
    const otherMatrix = new THREE.Matrix4();
    const tint = new THREE.Color();
    const otherTint = new THREE.Color();
    const variations = new Set();
    let lowAuthoredRuinStones = 0;
    for (let i = 0; i < rocks.count; i += 1) {
      rocks.getMatrixAt(i, matrix);
      unchanged.getMatrixAt(i, otherMatrix);
      const x = Math.round(matrix.elements[12] / 4) + 10;
      const y = Math.round(matrix.elements[14] / 4) + 7;
      const outside = x < 0 || y < 0 || x >= b2.grid[0].length || y >= b2.grid.length;
      if (outside) {
        // V64 changes ONLY the original non-colliding rocky horizon,
        // never B2's stored collision grid or actual blocking boulders.
        expect(new THREE.Vector3().setFromMatrixScale(matrix).y)
          .toBeLessThan(new THREE.Vector3().setFromMatrixScale(otherMatrix).y);
        expect(matrix.elements[12]).toBe(otherMatrix.elements[12]);
        expect(matrix.elements[14]).toBe(otherMatrix.elements[14]);
      } else if (x === 3 && y === 8) {
        // All 3 v63 authored stones remain low; lichen is unchanged.
        lowAuthoredRuinStones += 1;
        expect(new THREE.Vector3().setFromMatrixScale(matrix).y).toBeLessThan(1.65);
      } else if (chroniclesBrezalVergeRelief({ grid: b2.grid, x, y }) !== 1) {
        // V69: existing near-eye blocked perimeter rocks are lower, but
        // the authored root, world x/z, geometry and lichen stay unchanged.
        const relief = chroniclesBrezalVergeRelief({ grid: b2.grid, x, y });
        const now = new THREE.Vector3().setFromMatrixScale(matrix).y;
        const before = new THREE.Vector3().setFromMatrixScale(otherMatrix).y;
        expect(now / before).toBeCloseTo(relief, 5);
        expect(matrix.elements[12]).toBe(otherMatrix.elements[12]);
        expect(matrix.elements[14]).toBe(otherMatrix.elements[14]);
      } else {
        expect(matrix.elements).toEqual(otherMatrix.elements);
      }
      rocks.getColorAt(i, tint);
      matching.getColorAt(i, otherTint);
      expect(tint.getHex()).toBe(otherTint.getHex());
      variations.add(tint.getHex());
    }
    expect(lowAuthoredRuinStones).toBe(3);
    expect(variations.size).toBeGreaterThan(1);
    // B2 retains its original blocked-verge heather AND one bounded
    // walkable rosette batch. Every generic rock/lichen batch remains exact.
    expect(themed.children.length).toBe(plain.children.length + 2);
    expect(themed.children.filter(mesh => mesh.name === 'chronicles-terra-heather'))
      .toHaveLength(1);
    expect(themed.children.filter(mesh => mesh.name === 'chronicles-terra-heatherGroundcover'))
      .toHaveLength(1);
    expect(plain.getObjectByName('chronicles-terra-heatherGroundcover')).toBeUndefined();
  });

  it('is deterministic', () => {
    const map = chroniclesMapById('terra-e2');
    const center = { x: 10, y: 7 };
    const a = instanceCells(buildTerraScenery({ grid: map.grid, center, biome: 'hills' }), center);
    const b = instanceCells(buildTerraScenery({ grid: map.grid, center, biome: 'hills' }), center);
    expect(a).toEqual(b);
  });
});
