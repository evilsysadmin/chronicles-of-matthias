import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';
import { chroniclesLandscapeTileAt, chroniclesMeadowTileAt, chroniclesFoothillTileAt, chroniclesWoodlandVergeTileAt, chroniclesWoodlandBackdropTileAt } from './chroniclesLandscapeTiles.js';

// Terra's scenery: what an impassable cell of the overworld looks like in
// each biome (boulders on the hills, snowy pines, reeds and dead trees in
// the marsh, basalt in the ash lands...), a ring of the same landscape past
// the edge of the map so the horizon is never a wall, small non-blocking
// clutter on walkable ground, and authored set pieces such as camp tents.
//
// The collision grid stays the only source of truth: blocking dressing only
// ever stands on '#' cells, and walkable clutter is kept below knee height.
// Everything is instanced (one draw call per part) and deterministic.

// Shallow silt-colored margins surrounding darker bog water. Retain
// the original cylinder topology and its maximum radius, but break the
// perfectly circular outline with a smooth, deterministic shoreline.
export function chroniclesMarshPoolGeometry({ coarsePointer = false } = {}) {
  const geometry = new THREE.CylinderGeometry(1, 1, 0.06, coarsePointer ? 14 : 24);
  const position = geometry.getAttribute('position');
  const deep = new THREE.Color('#829a9b');
  const silt = new THREE.Color('#ded9b6');
  const tint = new THREE.Color();
  const colors = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const radius = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    const shore = 0.92 + 0.05 * Math.cos(3 * angle + 0.6)
      + 0.03 * Math.sin(5 * angle - 0.2);
    position.setXYZ(i, x * shore, y, z * shore);
    tint.copy(deep).lerp(silt, Math.min(1, radius));
    colors.push(tint.r, tint.g, tint.b);
  }
  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Coastal dunes have an asymmetric windward slope and a displaced crest.
// Reuse the original sphere topology and UVs; keep the footprint inside
// its original axis-aligned envelope. Pigments distinguish sheltered
// damp sand at the base from exposed pale sand on the ridge.
export function chroniclesCoastalDuneGeometry() {
  const geometry = new THREE.SphereGeometry(1, 10, 6);
  const position = geometry.getAttribute('position');
  const damp = new THREE.Color('#c3b49b');
  const sunlit = new THREE.Color('#ffffff');
  const tint = new THREE.Color();
  const colors = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const crest = Math.max(0, y);
    position.setXYZ(i, x * (0.87 + 0.06 * Math.cos(z * 3.2)) + 0.16 * crest * crest,
      y, z * (0.91 + 0.06 * Math.sin(x * 3.8 + 0.4)));
    tint.copy(damp).lerp(sunlit, THREE.MathUtils.smoothstep(y, -0.1, 0.85));
    colors.push(tint.r, tint.g, tint.b);
  }
  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const CELL = 4;
export const TERRA_SCENERY_MARGIN = 3;

const box = new THREE.Object3D();

function noise(x, y, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * A correlated, world-coordinate height profile for natural Terra highlands.
 * Smooth hills + shorter staggered spurs create real crests and saddles
 * rather than a flat row of equally sized boulders or random vertical spikes.
 * Blocked road verges always retain their original lower silhouette.
 * No physics, time, persistent state or generated map changes.
 */
export function chroniclesHighlandRidgeProfile(x, y, family = 'backdrop') {
  if (family !== 'backdrop' && family !== 'interior') return 1;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return 1;
  const swell = 0.29 * Math.sin(x * 0.37 + y * 0.16)
    + 0.17 * Math.sin(x * 0.71 - y * 0.24 + 1.40)
    + 0.07 * (noise(Math.floor(x / 2), Math.floor(y / 2), 1401) - 0.5);
  const amplitude = family === 'backdrop' ? 1 : 0.55;
  return Math.max(0.65, Math.min(1.45, 1 + swell * amplitude));
}

/**
 * A gently undulating *shared* shoulder profile along an E2-style
 * non-colliding mountain horizon. All three outer rings on the same map side
 * share the very same along-ridge coordinate, so a saddle stays a saddle
 * rather than being filled by identical stones in the next row.
 *
 * This returns identity for map interiors, side/corner ambiguity, incomplete
 * maps and malformed input. It only changes the visual matrices of existing
 * backdrop boulder/crag instances; the blocked/walkable grid is untouched.
 */
export function chroniclesHighlandBackdropSaddle({
  grid = [], x, y, ringDepth,
} = {}) {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)
      || !Number.isInteger(ringDepth) || ringDepth < 1
      || ringDepth > TERRA_SCENERY_MARGIN) return 1;
  const width = grid[0]?.length || 0, height = grid.length;
  if (!width || !height) return 1;
  let axis;
  if ((x === -ringDepth || x === width - 1 + ringDepth)
      && y >= 0 && y < height) axis = y;
  else if ((y === -ringDepth || y === height - 1 + ringDepth)
      && x >= 0 && x < width) axis = x;
  else return 1;
  // Overlapping long and short wavelengths: ridges, rounded shoulders,
  // saddles. Avoid per-cell white noise and a sawtooth skyline.
  return THREE.MathUtils.clamp(
    0.83 + 0.26 * Math.sin(axis * 0.46 + 0.30)
      + 0.17 * Math.cos(axis * 0.21 - 0.70)
      + 0.08 * Math.sin(axis * 0.89 + 1.50),
    0.52, 1.30,
  );
}

/**
 * B2's heath backdrop is three stacked non-colliding rings of large boulders
 * and crags. Seen from a real player eye, their equally high rows merge into
 * a single dark rock wall. Keep EXACTLY the same instances and tile recipes,
 * but taper the farther rows while cutting soft, shared along-edge saddles.
 *
 * An authored '#' cell always returns 1. No camera position, gameplay state,
 * map-ID-dependent hash or mutable random seed enters the calculation.
 */
export function chroniclesBrezalOuterRelief({
  grid = [], x, y, ringDepth,
} = {}) {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)
      || !Number.isInteger(ringDepth) || ringDepth < 1
      || ringDepth > TERRA_SCENERY_MARGIN) return 1;
  const width = grid[0]?.length || 0;
  const height = grid.length;
  if (!width || !height || grid.some(row => typeof row !== 'string' || row.length !== width)) return 1;
  if (x >= 0 && y >= 0 && x < width && y < height) return 1;
  const onXEdge = x < 0 || x >= width;
  const onYEdge = y < 0 || y >= height;
  if (!onXEdge && !onYEdge || width < 2 || height < 2) return 1;
  const actualRing = Math.max(-x, x - width + 1, -y, y - height + 1);
  if (ringDepth !== actualRing) return 1;
  // Walk clockwise around the SAME map perimeter at all three depths.
  // Opposite sides no longer repeat the same waveform, and the shared
  // corner coordinates join without a hard height seam.
  const perimeter = 2 * (width + height - 2);
  const along = x < 0
    ? perimeter - THREE.MathUtils.clamp(y, 0, height - 1)
    : x >= width
      ? width - 1 + THREE.MathUtils.clamp(y, 0, height - 1)
      : y >= height
        ? width + height - 2 + (width - 1 - THREE.MathUtils.clamp(x, 0, width - 1))
        : THREE.MathUtils.clamp(x, 0, width - 1);
  const angle = Math.PI * 2 * along / perimeter;
  // Broad rocky crests are separated by genuinely low, smoothly curved
  // passes. Far rows taper more decisively so they cannot fill the near
  // row's openings into an unbroken eye-level cliff.
  const shoulder = THREE.MathUtils.clamp(
    0.58 + 0.34 * Math.sin(3 * angle + 0.45)
      + 0.10 * Math.cos(5 * angle - 0.60),
    0.22, 0.975,
  );
  const depth = [1, 0.98, 0.74, 0.55][ringDepth];
  return shoulder * depth;
}

/**
 * B2-only: soften the actual impassable perimeter's shoulder rocks.
 * The first-person heath cameras look across these authored '#' roots, so
 * sculpting the OUTSIDE rings alone cannot open the near skyline. Keep the
 * same two boulders on each verge cell, but lower them into a coherent
 * chain of rocky shoulders and distinct gaps at the same saddles as v68.
 *
 * Only perimeter '#' cells directly adjoining a traversable cell qualify.
 * The real collision grid, mid-map rocks, the ruin and all other Terra
 * regions remain untouched. No new geometry, materials or instances.
 */
export function chroniclesBrezalVergeRelief({ grid = [], x, y } = {}) {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return 1;
  const width = grid[0]?.length || 0, height = grid.length;
  if (width < 2 || height < 2
      || grid.some(row => typeof row !== 'string' || row.length !== width)
      || x < 0 || y < 0 || x >= width || y >= height
      || grid[y][x] !== '#'
      || (x !== 0 && x !== width - 1 && y !== 0 && y !== height - 1)) return 1;
  const bordersWalkable = grid[y - 1]?.[x] === '.' || grid[y + 1]?.[x] === '.'
    || grid[y]?.[x - 1] === '.' || grid[y]?.[x + 1] === '.';
  if (!bordersWalkable) return 1;
  // Read the SAME continuous v68 perimeter contour from the first exterior
  // cell. Opposite map sides have distinct profiles; four corners stay joined.
  const outerX = x === 0 ? -1 : x === width - 1 ? width : x;
  const outerY = x === 0 || x === width - 1 ? y : y === 0 ? -1 : height;
  const shoulder = chroniclesBrezalOuterRelief({
    grid, x: outerX, y: outerY, ringDepth: 1,
  }) / 0.98;
  return 0.56 + 0.29 * shoulder;
}

function texture(kind, repeatX = 1, repeatY = 1) {
  // Pixel textures are cached and shared: clone to repeat independently.
  const base = chroniclesPixelTexture(kind);
  if (repeatX === 1 && repeatY === 1) return base;
  const copy = base.clone();
  copy.repeat.set(repeatX, repeatY);
  copy.needsUpdate = true;
  return copy;
}

const lit = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.02, ...opts });

// Keep the world-grid and every instance transform untouched. A small, shared
// vertex displacement breaks the 20-face icosahedron silhouette without adding
// draw calls or forcing a dense terrain mesh. The analytic displacement is
// position-derived, so duplicated UV-seam vertices move together.
export function chroniclesOrganicRockGeometry({ coarsePointer = false, weatheredHighland = false } = {}) {
  const geometry = new THREE.IcosahedronGeometry(1, coarsePointer ? 0 : 1);
  if (coarsePointer && !weatheredHighland) return geometry;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  if (weatheredHighland) {
    // Deform the existing low-poly icosahedron into a squat, asymmetric
    // glacial stone. Analytic position-only displacements keep duplicate UV
    // seam vertices coincident. The existing 20/80-triangle mobile/desktop
    // budgets and one InstancedMesh per part remain exactly unchanged.
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const scar = 0.11 * Math.sin(x * 4.6 + z * 3.4)
        + 0.075 * Math.cos(y * 5.1 - z * 2.8)
        + 0.045 * Math.sin(x * 7.0 - y * 2.1);
      const uneven = 1 + scar;
      const dx = (x * 1.14 + y * 0.12 + z * 0.035) * uneven;
      const dy = y * (0.79 + 0.055 * Math.sin(x * 3.2 + z * 2.3)) * uneven;
      const dz = (z * 1.08 - y * 0.095) * uneven;
      positions.setXYZ(i, dx, dy, dz);
      normals.setXYZ(i, dx * 0.88, dy * 1.25, dz * 0.92);
    }
    positions.needsUpdate = true;
    normals.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const waviness = 0.085 * Math.sin(x * 5.3 + z * 2.1)
      + 0.055 * Math.cos(z * 6.1 - y * 3.7)
      + 0.035 * Math.sin(y * 8.0 + x * 4.2);
    const radius = 1 + waviness;
    positions.setXYZ(i, x * radius, y * radius * 0.93, z * radius);
    // Smooth broadly rounded rock faces; pixel-textured albedo still supplies
    // the tiny cracks and weathering without showing triangular facets.
    normals.setXYZ(i, x, y * 0.93, z);
  }
  positions.needsUpdate = true;
  normals.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * B2's low, stratified heath stones replace only the silhouette of the
 * original boulder mesh. The v69 camera still read the shared near rocks
 * as large round potatoes forming a fence; eroded tabular faces are a
 * better foothill transition. Reuse the existing 20/80-triangle rock
 * topology and the SAME B2 instance matrices, colours and rock material.
 *
 * This geometry is built once per scenery batch; no new objects, colliders,
 * runtime randomness, textures, transparent materials or draw calls.
 */
export function chroniclesBrezalStoneGeometry({ coarsePointer = false } = {}) {
  const geometry = chroniclesOrganicRockGeometry({
    coarsePointer, weatheredHighland: true,
  });
  const position = geometry.getAttribute('position');
  // V71: keep the wide, low-profile B2 stone but avoid the identical,
  // ruler-flat upper face that reads as a repeated pancake on the horizon.
  // A tilted, weathered cap has different shoulders on each side; the
  // already-deterministic instance yaws reveal different crests without
  // changing any matrix, rock count or mobile/desktop polygon budget.
  // Position-only displacement keeps duplicated UV seam vertices aligned.
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const cap = 0.48 + 0.14 * Math.sin(x * 1.85 + z * 0.95)
      + 0.08 * Math.cos(z * 2.25 - x * 1.40);
    const weathered = Math.max(-0.73, Math.min(y, cap));
    position.setXYZ(i, x * 1.08, weathered * 0.89, z * 1.06);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// A ridge tile is made of irregular, stepped rock peaks, not tall perfect
// cones. Merge both desktop peaks once into the SAME 'crag' instancing batch.
// Every vertex/UV is authored locally and the footprint stays inside its
// blocked 4m cell even when rotated. Mobile uses one cheaper peak.
export function chroniclesMountainCragGeometry({ coarsePointer = false } = {}) {
  const sides = coarsePointer ? 5 : 7;
  const peaks = coarsePointer
    ? [{ x: 0, z: 0, width: 0.88, height: 1.15 }]
    : [
      { x: -0.20, z: -0.12, width: 0.83, height: 1.17 },
      { x: 0.38, z: 0.24, width: 0.55, height: 0.83 },
    ];
  const geometries = peaks.map((peak, peakIndex) => {
    const vertices = [];
    const uvs = [];
    const indices = [];
    // Broad, weathered summits rather than needle-like truncated cones.
    const rings = [[1, 0], [0.78, 0.34], [0.43, 0.73], [0.18, 1]];
    rings.forEach(([radius, rise], ringIndex) => {
      for (let i = 0; i < sides; i += 1) {
        const angle = i * Math.PI * 2 / sides + 0.31 * peakIndex;
        const rough = 1 + 0.115 * Math.sin(i * 2.9 + ringIndex * 1.8 + peakIndex);
        const shift = rise * (peakIndex === 0 ? -0.10 : 0.13);
        const summitTilt = ringIndex === rings.length - 1
          ? 0.045 * Math.sin(angle + peakIndex * 1.7) : 0;
        vertices.push(
          peak.x + (Math.cos(angle) * radius * rough + shift) * peak.width,
          peak.height * (rise + summitTilt + (ringIndex > 0 && ringIndex < 3
            ? 0.065 * Math.sin(i * 2.2 + peakIndex) : 0)),
          peak.z + Math.sin(angle) * radius * rough * peak.width,
        );
        uvs.push(i / (sides - 1), rise);
        if (ringIndex) {
          const prev = (ringIndex - 1) * sides;
          const next = ringIndex * sides;
          const j = (i + 1) % sides;
          // Outward-facing winding: the outside of each ridge stays visible
          // with the rock material's normal front-face culling.
          indices.push(prev + i, next + i, prev + j,
            prev + j, next + i, next + j);
        }
      }
    });
    // Close the exposed summit with an upward-wound fan. Duplicate only
    // the summit ring for a proper planar UV island and a rocky edge normal.
    // 94 desktop / 33 mobile triangles stay under 100 / 40.
    const summit = rings.length * sides;
    for (let i = 0; i < sides; i++) {
      const source = ((rings.length - 1) * sides + i) * 3;
      const x = vertices[source], y = vertices[source + 1], z = vertices[source + 2];
      vertices.push(x, y, z);
      uvs.push(0.5 + (x - peak.x) / peak.width, 0.5 + (z - peak.z) / peak.width);
    }
    for (let i = 1; i < sides - 1; i++) {
      indices.push(summit, summit + i + 1, summit + i);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  });
  if (geometries.length === 1) return geometries[0];
  const merged = mergeGeometries(geometries, false);
  geometries.forEach(geo => geo.dispose());
  if (!merged) throw new Error('Highland ridge peaks could not be merged');
  return merged;
}

// Hand-built heather leaves and dusty lilac flowers share ONE instanced
// vertex-colour material. No external texture, animation, or transparency sort.
// Compact crossing triangles suggest branching stems without giant poly cones.
export function chroniclesBrezalHeatherGeometry() {
  const positions = [];
  const colors = [];
  const foliage = [new THREE.Color('#52664a'), new THREE.Color('#78855d')];
  const blooms = [new THREE.Color('#937693'), new THREE.Color('#b49aaa')];
  const add = (a, b, c, tint) => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i += 1) colors.push(tint.r, tint.g, tint.b);
  };
  for (let stem = 0; stem < 7; stem += 1) {
    const angle = stem * Math.PI * 2 / 7;
    const r = stem % 2 ? 0.16 : 0.32;
    const cx = Math.cos(angle) * r;
    const cz = Math.sin(angle) * r;
    const sidewaysX = -Math.sin(angle) * 0.12;
    const sidewaysZ = Math.cos(angle) * 0.12;
    const height = 0.35 + (stem % 3) * 0.07;
    const tip = [cx + Math.cos(angle) * 0.08, height, cz + Math.sin(angle) * 0.08];
    const left = [cx - sidewaysX, 0.015, cz - sidewaysZ];
    const right = [cx + sidewaysX, 0.015, cz + sidewaysZ];
    add(left, right, tip, foliage[stem % foliage.length]);
    const flowerHeight = height + 0.11;
    add([tip[0] - sidewaysX * 0.78, height - 0.06, tip[2] - sidewaysZ * 0.78],
      [tip[0] + sidewaysX * 0.78, height - 0.06, tip[2] + sidewaysZ * 0.78],
      [tip[0], flowerHeight, tip[2]], blooms[stem % blooms.length]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * V66: A separate low heath ROSETTE for B2's walkable groundcover.
 * V65 reused the blocked-verge heather's seven upright pyramidal flower
 * stems; in the real player POV those became conspicuous tiny fir trees.
 * Spread each leaf and the tiny lilac blossoms over a horizontal footprint
 * instead. The original blocked-verge plant geometry is deliberately
 * unchanged. All coordinates are deterministic, local and knee-low.
 * This is one reusable instanced family, not one mesh per flower.
 */
export function chroniclesBrezalGroundcoverGeometry() {
  const positions = [];
  const colors = [];
  const foliage = [new THREE.Color('#697958'), new THREE.Color('#83906b'),
    new THREE.Color('#667452'), new THREE.Color('#a09b76')];
  const blooms = [new THREE.Color('#a88fa9'),
    new THREE.Color('#c2a8bc'), new THREE.Color('#8c7899')];
  // Bake contact shade into the existing vertices: darker leaf roots,
  // sunlit tips and recessed flower centres, without new geometry or lights.
  const triangle = (a, b, c, color, shades) => {
    positions.push(...a, ...b, ...c);
    for (const shade of shades) colors.push(color.r * shade, color.g * shade, color.b * shade);
  };
  for (let patch = 0; patch < 9; patch += 1) {
    const angle = patch * Math.PI * 2 / 9 + 0.28;
    const radius = 0.12 + (patch % 3) * 0.085;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    // Pair of broad, low, splayed leaves per clump. Their tips are only
    // slightly elevated; they do not share a tall central conical apex.
    for (let leaf = 0; leaf < 2; leaf += 1) {
      const turn = angle + (leaf ? 0.72 : -0.61);
      const fx = Math.cos(turn), fz = Math.sin(turn);
      const sx = -fz, sz = fx;
      const reach = 0.15 + (patch % 3) * 0.024;
      const spread = 0.068 + (patch % 2) * 0.018;
      const root = [cx, 0.023, cz];
      const tip = [cx + fx * reach, 0.060 + (patch % 3) * 0.018,
        cz + fz * reach];
      const left = [cx + fx * reach * 0.45 - sx * spread, 0.046,
        cz + fz * reach * 0.45 - sz * spread];
      const right = [cx + fx * reach * 0.45 + sx * spread, 0.046,
        cz + fz * reach * 0.45 + sz * spread];
      const color = foliage[(patch + leaf) % foliage.length];
      triangle(root, left, tip, color, [0.70, 0.90, 1]);
      triangle(root, tip, right, color, [0.70, 1, 0.90]);
    }
    // Five flattened flowers distributed between leaves, not one large
    // purple point above each green cone. Petals face mostly upward and
    // create small fragmented mauve highlights from the player's eye.
    if (patch % 2 === 0) {
      const bx = cx + Math.cos(angle + 0.5) * 0.055;
      const bz = cz + Math.sin(angle + 0.5) * 0.055;
      const h = 0.086 + (patch % 3) * 0.016;
      for (let petal = 0; petal < 4; petal += 1) {
        const a = petal * Math.PI / 2 + 0.23;
        const dx = Math.cos(a), dz = Math.sin(a);
        const sideX = -dz, sideZ = dx;
        const color = blooms[(patch + petal) % blooms.length];
        triangle([bx, h, bz],
          [bx + dx * 0.052 + sideX * 0.036, h + 0.008,
            bz + dz * 0.052 + sideZ * 0.036],
          [bx + dx * 0.052 - sideX * 0.036, h + 0.008,
            bz + dz * 0.052 - sideZ * 0.036], color, [0.76, 1, 0.96]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// Uneven clustered silhouettes replace the old perfect green spheres on
// broadleaf trees and bushes. Reuse the same 20/80 triangle budget and one
// shared geometry per part; displacement is deterministic and baked once.
// Identical source positions move identically, including UV seam duplicates.
export function chroniclesOrganicCanopyGeometry({ coarsePointer = false, shrub = false } = {}) {
  const geometry = new THREE.IcosahedronGeometry(1, coarsePointer ? 0 : 1);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const angle = Math.atan2(z, x);
    const radial = 1 + 0.15 * Math.sin(3 * angle + 0.45)
      + 0.075 * Math.cos(5 * angle - 0.35)
      + 0.045 * Math.sin(y * 4.8 + angle * 2);
    const vertical = (shrub ? 0.76 : 0.93)
      * (1 + 0.09 * Math.cos(2 * angle + 0.25));
    positions.setXYZ(i, x * radial, y * vertical,
      z * radial * (1 + 0.05 * Math.sin(angle * 2 - 0.5)));
  }
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}


/**
 * B2 heath only: irregular, broad scrub instead of another floating green
 * sphere. Reuse the SAME icosahedral 20/80-triangle bush mesh, material,
 * instance matrices and palette; a low asymmetrical crown, splayed sides
 * and clipped underside make a scrubby hedgerow shape at walking eye-level.
 *
 * Each vertex is displaced solely from its own source position, preserving
 * UV-seam duplicates and stable mobile/desktop geometry after every reload.
 * Per-instance deterministic yaw already varies the silhouette across B2.
 */
export function chroniclesBrezalShrubGeometry({ coarsePointer = false } = {}) {
  const geometry = chroniclesOrganicCanopyGeometry({ coarsePointer, shrub: true });
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const angle = Math.atan2(z, x);
    const lobes = 1 + 0.17 * Math.sin(3 * angle + 0.35)
      + 0.085 * Math.cos(5 * angle - 0.60);
    const skirt = 1.06 - 0.12 * y;
    const crest = 0.43 + 0.10 * Math.sin(2 * angle + 0.70)
      + 0.08 * Math.cos(3 * angle - 0.55);
    positions.setXYZ(i,
      x * lobes * skirt * 1.15 + 0.09 * (y + 0.7),
      Math.max(-0.53, Math.min(y, crest)) * 0.92,
      z * lobes * skirt * 1.04);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}


/**
 * Banner Road leaf mass: a low-poly, latitude-based foliage envelope rather
 * than a stack of visibly triangular icosahedrons. The contour uses subtle,
 * deterministic scallops and a fuller sunlit crown with a tucked underside.
 * Five meridians × three latitude bands give exactly 20 mobile triangles;
 * ten meridians × five bands give exactly 80 desktop triangles. The six/four
 * existing masses, draw calls, vegetation placement and collision are intact.
 * Other biomes and maps continue to use chroniclesOrganicCanopyGeometry.
 */
export function chroniclesWoodlandLeafMassGeometry({ coarsePointer = false } = {}) {
  // One more latitude and meridian round the old angular mobile cap.
  // Desktop geometry and all non-woodland foliage remain unchanged.
  const geometry = new THREE.SphereGeometry(1, coarsePointer ? 6 : 10,
    coarsePointer ? 4 : 5);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const a = Math.atan2(z, x);
    // Three non-harmonic contours avoid evenly spaced spikes. Latitude
    // modifies the skirt independently so the silhouette is not spherical.
    const scallop = 1 + 0.115 * Math.sin(3 * a + 0.37)
      + 0.065 * Math.cos(5 * a - 0.24)
      + 0.033 * Math.sin(7 * a + y * 1.4);
    const skirt = y < 0 ? 1 + 0.10 * y : 1;
    // The middle ring eliminates the old uninterrupted vertical wall.
    // Compress its radial envelope and lift the upper shoulder slightly
    // so the new ring does not create a giant overhanging mushroom cap.
    const touchShoulderLift = coarsePointer && y > 0.65 && y < 0.8 ? 0.035 : 0;
    const equator = coarsePointer && Math.abs(y) < 0.1 ? 0.82 : 1;
    const vertical = y * (y < 0 ? 0.77 : 0.93) + touchShoulderLift
      + 0.024 * Math.sin(4 * a + 0.67) * (1 - Math.abs(y));
    positions.setXYZ(i, x * scallop * skirt * equator, vertical,
      z * (scallop + 0.024 * Math.sin(2 * a + y * 2.0)) * skirt * equator);
  }
  positions.needsUpdate = true;
  // Sphere normals already interpolate continuously over the lobes and
  // are deliberately retained; no flat shading/extra material is required.
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * A broadleaf tree reads as layered, overlapping leaf masses rather than one
 * exposed icosahedron. All lobes are merged once into ONE shared geometry:
 * existing per-cell InstancedMesh counts, materials and draw calls stay put.
 * The original reduced mobile shape has three 20-face lobes. Banner Road
 * retains its four-lobe touch / six-lobe desktop budget, but has its own
 * taller, asymmetrically stepped canopy silhouette instead of a wide,
 * nearly horizontal mushroom cap. Other locations retain original art.
 */
export function chroniclesLayeredCanopyGeometry({ coarsePointer = false, woodland = false } = {}) {
  const originalLobes = [
    [[0, 0.04, 0], [0.83, 0.78, 0.83]],
    [[-0.55, -0.15, 0.06], [0.63, 0.62, 0.64]],
    [[0.53, -0.16, -0.10], [0.61, 0.62, 0.65]],
    ...(!coarsePointer ? [
      [[-0.06, -0.08, 0.53], [0.66, 0.58, 0.62]],
      [[0.08, 0.24, -0.43], [0.65, 0.61, 0.64]],
    ] : []),
  ];
  // Keep v28's exact 4/6-lobe budgets, but make the forest masses read
  // as a taller central crown and staggered secondary branches instead of
  // left-to-right horizontal green ovals. A small lower forward lobe retains
  // visual depth near the gateway without descending into player headspace.
  // All offsets are local to the same shared instanced geometry and material.
  const woodlandLobes = [
    [[0.02, 0.18, -0.02], [0.72, 0.90, 0.72]],
    [[-0.46, -0.04, 0.10], [0.48, 0.60, 0.47]],
    [[0.48, 0.06, -0.11], [0.48, 0.58, 0.49]],
    ...(!coarsePointer ? [
      [[-0.24, 0.40, 0.31], [0.46, 0.48, 0.48]],
      [[0.24, 0.33, -0.39], [0.43, 0.54, 0.46]],
    ] : []),
    // Keep the forward branch overlapping the main crown in both camera
    // projections: the old far-forward small mass looked like a floating
    // foliage ball beside the left gateway tree at 390px and 1280px.
    [[0.05, -0.13, 0.74], [0.55, 0.46, 0.68]],
  ];
  const lobes = woodland ? woodlandLobes : originalLobes;
  // Shade the underside a little cooler and brighter at the crown tops.
  // Bake gentle lobe-to-lobe tonal changes into the existing shared geometry:
  // no new foliage meshes, materials, textures, lights or frame updates.
  // Vertices are coloured in lobe-local space, before translating each mass.
  const tones = [
    ['#d1e2ce', '#f9f9ee'],
    ['#c5dac6', '#f1f8e5'],
    ['#d8e3c6', '#fff9e8'],
    ['#c8d9c5', '#f0f6e7'],
    ['#d2dcc8', '#f6f5e8'],
    ['#c6d9bb', '#f2f4df'],
  ];
  const pieces = lobes.map(([offset, scale], index) => {
    const shape = woodland
      ? chroniclesWoodlandLeafMassGeometry({ coarsePointer })
      : chroniclesOrganicCanopyGeometry({ coarsePointer });
    const positions = shape.getAttribute('position');
    const lower = new THREE.Color(tones[index][0]);
    const upper = new THREE.Color(tones[index][1]);
    const colors = new Float32Array(positions.count * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < positions.count; i += 1) {
      // Smooth gradient: slightly deeper shade below, brighter exposed tops.
      // Local height avoids treating a lower lobe as permanently shaded.
      const height = THREE.MathUtils.clamp((positions.getY(i) + 0.86) / 1.72, 0, 1);
      tint.copy(lower).lerp(upper, height);
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    shape.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    shape.scale(...scale);
    shape.translate(...offset);
    return shape;
  });
  const merged = mergeGeometries(pieces, false);
  pieces.forEach(piece => piece.dispose());
  if (!merged) throw new Error('Unable to merge Chronicles broadleaf canopy');
  if (woodland) {
    // Light the visible masses as parts of a single crown. Blend the
    // lobe normals towards a broad ellipsoid only where they agree with
    // its outward direction; retain local normals in deep concavities.
    // This preserves silhouette, leaf texture and original topology.
    const p = merged.getAttribute('position');
    const normals = merged.getAttribute('normal');
    const colors = merged.getAttribute('color');
    const local = new THREE.Vector3(), envelope = new THREE.Vector3();
    const tint = new THREE.Color(), shared = new THREE.Color();
    const lower = new THREE.Color('#c6d9c0'), upper = new THREE.Color('#f7f8e9');
    for (let i = 0; i < p.count; i++) {
      local.fromBufferAttribute(normals, i).normalize();
      envelope.set(p.getX(i), (p.getY(i) - 0.10) * 0.80, (p.getZ(i) - 0.12) * 0.78);
      if (envelope.lengthSq() > 0.0001) {
        envelope.normalize();
        const blend = 0.56 * THREE.MathUtils.smoothstep(local.dot(envelope), 0.05, 0.65);
        local.lerp(envelope, blend).normalize();
        normals.setXYZ(i, local.x, local.y, local.z);
      }
      // Shared height-based light response replaces the conspicuous
      // per-ball reset while preserving 30% of local foliage pigment.
      shared.copy(lower).lerp(upper, THREE.MathUtils.smoothstep(p.getY(i), -0.55, 0.95));
      tint.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)).lerp(shared, 0.70);
      colors.setXYZ(i, tint.r, tint.g, tint.b);
    }
    normals.needsUpdate = true;
    colors.needsUpdate = true;
  }
  merged.computeBoundingSphere();
  return merged;
}


/**
 * Three overlapping uneven leaf masses make a low hedge-like shrub rather
 * than a single oversized sphere. Only the plains use this silhouette:
 * marsh, hills and other biome brushes retain their original geometry.
 * Each shrub remains ONE instanced mesh; mobile has only two cheap lobes.
 *
 * Banner Road's eye-level woodland gets a separate low, wind-swept contour:
 * different lobe heights/offsets make a leafy broken hedge rather than a
 * row of rounded green balloons. The generic meadow shrub stays unchanged
 * and both versions retain the same 40/240-triangle budget.
 */
export function chroniclesLayeredShrubGeometry({ coarsePointer = false, woodland = false } = {}) {
  const lobes = woodland ? [
    [[0.04, -0.24, -0.02], [0.83, 0.49, 0.72]],
    [[-0.46, -0.31, 0.16], [0.58, 0.43, 0.56]],
    ...(!coarsePointer ? [
      [[0.41, -0.29, -0.28], [0.57, 0.41, 0.54]],
    ] : []),
  ] : [
    [[0, -0.12, 0], [0.76, 0.66, 0.75]],
    [[-0.39, -0.21, 0.12], [0.52, 0.49, 0.59]],
    ...(!coarsePointer ? [
      [[0.35, -0.20, -0.25], [0.57, 0.53, 0.56]],
    ] : []),
  ];
  const pieces = lobes.map(([offset, scale]) => {
    const shape = chroniclesOrganicCanopyGeometry({ coarsePointer, shrub: true });
    shape.scale(...scale);
    shape.translate(...offset);
    return shape;
  });
  const merged = mergeGeometries(pieces, false);
  pieces.forEach(shape => shape.dispose());
  if (!merged) throw new Error('Unable to merge Chronicles meadow shrub');
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Short, softly curling grass leaves, not arrowhead-shaped dark triangles.
 * Each stem starts wide and olive, rises through a narrower shoulder and
 * bends into a slim sunlit tip. All three triangles share the existing
 * opaque, double-sided vertex-colour material and single InstancedMesh.
 * Coarse uses 5 leaves (15 triangles), full detail 11 (33 triangles).
 * No billboards, alpha sorting, added draw calls or animation.
 */
export function chroniclesMeadowGrassGeometry({ coarsePointer = false, woodland = false } = {}) {
  const positions = [];
  const colors = [];
  const roots = ['#68854a', '#789358', '#819861', '#6e8a50']
    .map(hex => new THREE.Color(hex));
  const shoulders = ['#92ac6b', '#a1b779', '#aaba7b', '#98b374']
    .map(hex => new THREE.Color(hex));
  const tips = ['#b6c885', '#c0ca8e', '#aeca83', '#b9c58d']
    .map(hex => new THREE.Color(hex));
  const triangle = (a, b, c, ca, cb, cc) => {
    positions.push(...a, ...b, ...c);
    for (const tint of [ca, cb, cc]) colors.push(tint.r, tint.g, tint.b);
  };
  const blades = coarsePointer ? 5 : 11;
  for (let i = 0; i < blades; i += 1) {
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const directionX = Math.cos(angle);
    const directionZ = Math.sin(angle);
    const tangentX = -directionZ;
    const tangentZ = directionX;
    const radius = 0.045 + (i % 4) * 0.043;
    const x = directionX * radius, z = directionZ * radius;
    const height = (0.23 + (i % 5) * 0.034) * (coarsePointer ? 0.96 : 1);
    // C3's mature meadow has narrow, tapered blades rather than broad
    // pennants. Retain the same three triangles per blade.
    const baseWidth = (0.048 + (i % 3) * 0.010) * (woodland ? 0.64 : 1);
    const shoulderWidth = baseWidth * (woodland ? 0.46 : 0.60);
    const shoulderReach = (0.040 + (i % 3) * 0.024) * (woodland ? 1.18 : 1);
    const tipReach = woodland ? shoulderReach + (0.080 + (i % 4) * 0.016) * 1.18
      : shoulderReach + 0.080 + (i % 4) * 0.016;
    // A slight sideways curl gives the blade a continuous asymmetric arc.
    const curl = (i % 2 ? -1 : 1) * (0.028 + (i % 3) * 0.009) * (woodland ? 1.25 : 1);
    const rootLeft = [x - tangentX * baseWidth, 0.012, z - tangentZ * baseWidth];
    const rootRight = [x + tangentX * baseWidth, 0.012, z + tangentZ * baseWidth];
    const midX = x + directionX * shoulderReach + tangentX * curl * 0.30;
    const midZ = z + directionZ * shoulderReach + tangentZ * curl * 0.30;
    const shoulderLeft = [
      midX - tangentX * shoulderWidth, height * (woodland ? 0.69 : 0.64),
      midZ - tangentZ * shoulderWidth,
    ];
    const shoulderRight = [
      midX + tangentX * shoulderWidth, height * (woodland ? 0.69 : 0.64),
      midZ + tangentZ * shoulderWidth,
    ];
    const tip = [
      x + directionX * tipReach + tangentX * curl,
      height * (0.89 + (i % 3) * 0.035),
      z + directionZ * tipReach + tangentZ * curl,
    ];
    const rootShade = roots[i % roots.length];
    const midShade = woodland
      ? shoulders[i % shoulders.length].clone().lerp(rootShade, 0.25)
      : shoulders[i % shoulders.length];
    const tipShade = woodland
      ? tips[i % tips.length].clone().lerp(midShade, 0.38)
      : tips[i % tips.length];
    triangle(rootLeft, rootRight, shoulderRight,
      rootShade, rootShade, midShade);
    triangle(rootLeft, shoulderRight, shoulderLeft,
      rootShade, midShade, midShade);
    triangle(shoulderLeft, shoulderRight, tip,
      midShade, midShade, tipShade);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}


/**
 * Meadow sedge: broad, curling olive leaves with occasional dry seed tips.
 * Unlike the thin, dark upright turf, this has wide folded blades and a
 * softer meadow silhouette. Only Banner Road requests this second family.
 * The entire species is a single opaque instanced batch; mobile uses 4
 * blades instead of 7 and skips the seedheads.
 */
export function chroniclesMeadowSedgeGeometry({ coarsePointer = false } = {}) {
  const positions = [];
  const colors = [];
  const roots = ['#506e3a', '#687d47', '#657b44'].map(hex => new THREE.Color(hex));
  const tips = ['#9fb16e', '#b3bb77', '#819f62'].map(hex => new THREE.Color(hex));
  const seeds = new THREE.Color('#b5a574');
  const triangle = (a, b, c, color) => {
    positions.push(...a, ...b, ...c);
    for (let j = 0; j < 3; j += 1) colors.push(color.r, color.g, color.b);
  };
  for (let i = 0; i < (coarsePointer ? 4 : 7); i += 1) {
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const radius = 0.08 + (i % 3) * 0.075;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const sidewaysX = -Math.sin(angle);
    const sidewaysZ = Math.cos(angle);
    const reach = 0.15 + (i % 3) * 0.045;
    const height = (0.38 + (i % 4) * 0.055) * (coarsePointer ? 0.88 : 1);
    const width = 0.09 + (i % 3) * 0.025;
    const baseLeft = [x - sidewaysX * width, 0.012, z - sidewaysZ * width];
    const baseRight = [x + sidewaysX * width, 0.012, z + sidewaysZ * width];
    const mx = x + Math.cos(angle) * reach * 0.40;
    const mz = z + Math.sin(angle) * reach * 0.40;
    const mid = [mx, height * 0.65, mz];
    // A broad base and narrower, bent upper leaf read differently from
    // upright turf even at the fixed eye-level forest screenshot distance.
    triangle(baseLeft, baseRight, mid, roots[i % roots.length]);
    triangle([mx - sidewaysX * width * 0.43, height * 0.60,
      mz - sidewaysZ * width * 0.43],
    [mx + sidewaysX * width * 0.43, height * 0.60,
      mz + sidewaysZ * width * 0.43],
    [x + Math.cos(angle) * reach, height,
      z + Math.sin(angle) * reach], tips[i % tips.length]);
    if (!coarsePointer && i % 3 === 1) {
      // Tiny low straw-coloured tips: never large flowers or opaque cones.
      const sx = x + Math.cos(angle) * reach;
      const sz = z + Math.sin(angle) * reach;
      triangle([sx - 0.024, height - 0.045, sz],
        [sx + 0.024, height - 0.045, sz],
        [sx + Math.cos(angle) * 0.025, height + 0.035, sz + 0.01], seeds);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}


/**
 * Broad compound-leaf forest herbs add an intermediate layer between meadow
 * grass and the high tree canopy. Each stem fans out into separate leaflets:
 * unlike narrow sedges these read as low ferns and broadleaf woodland plants.
 * All instances share one opaque vertex-colour batch, with a compact mobile
 * mesh. The same shape can stay below the knee in walkable grass and grow
 * fuller on already-blocked forest tiles without acquiring a collider.
 */
export function chroniclesForestHerbGeometry({ coarsePointer = false, woodland = false } = {}) {
  const positions = [];
  const colors = [];
  const lower = ['#48683b', '#587746', '#718554', '#536d3e']
    .map(hex => new THREE.Color(hex));
  const upper = ['#829967', '#94a977', '#a2aa74', '#7f945e']
    .map(hex => new THREE.Color(hex));
  const triangle = (a, b, c, color, colorB = color, colorC = color) => {
    positions.push(...a, ...b, ...c);
    for (const tint of [color, colorB, colorC]) colors.push(tint.r, tint.g, tint.b);
  };
  for (let i = 0; i < (coarsePointer ? 4 : 7); i += 1) {
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const r = 0.06 + (i % 3) * 0.045;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    const outwardX = Math.cos(angle), outwardZ = Math.sin(angle);
    const tangentX = -outwardZ, tangentZ = outwardX;
    const reach = 0.38 + (i % 3) * 0.085;
    const h = 0.64 + (i % 4) * 0.062;
    const span = (0.13 + (i % 2) * 0.045) * (woodland ? 0.84 : 1);
    const mx = x + outwardX * reach * 0.47;
    const mz = z + outwardZ * reach * 0.47;
    const shoulder = h * (woodland ? 0.61 : 0.49);
    const left = [mx - tangentX * span, shoulder, mz - tangentZ * span];
    const right = [mx + tangentX * span, shoulder, mz + tangentZ * span];
    // C3 uses a lower arch instead of identical upright spear tips.
    // The original horizontal reach, vertex count and mesh batch survive.
    const tip = [x + outwardX * reach, h * (woodland ? 0.74 + (i % 3) * 0.035 : 1), z + outwardZ * reach];
    const root = lower[i % lower.length], leaf = upper[i % upper.length];
    if (woodland) {
      const basal = root.clone().lerp(leaf, 0.20);
      const mid = root.clone().lerp(leaf, 0.62);
      const rim = mid.clone().lerp(leaf, 0.22);
      triangle([x, 0.012, z], left, right, basal, mid, rim);
      triangle(left, tip, right, mid, leaf, rim);
    } else {
      triangle([x, 0.012, z], left, right, root);
      triangle(left, tip, right, leaf);
    }
    if (!coarsePointer) {
      // Small asymmetric side leaflets give a genuine fern-like profile,
      // not another wider cone or identical blade of ordinary meadow grass.
      triangle([mx - tangentX * span * 0.18, h * 0.43,
        mz - tangentZ * span * 0.18],
      [mx - tangentX * span * 1.36, h * 0.63,
        mz - tangentZ * span * 1.36],
      [mx + outwardX * 0.14, h * 0.67, mz + outwardZ * 0.14],
      upper[(i + 1) % upper.length]);
      triangle([mx + tangentX * span * 0.19, h * 0.42,
        mz + tangentZ * span * 0.19],
      [mx + tangentX * span * 1.24, h * 0.56,
        mz + tangentZ * span * 1.24],
      [mx + outwardX * 0.10, h * 0.70, mz + outwardZ * 0.10],
      upper[(i + 2) % upper.length]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  if (woodland) {
    // The central blade is two triangles sharing both shoulder vertices.
    // Give their duplicate vertices one averaged unit normal, retaining
    // the face normals at the root and tip. Avoid an origami-like crease
    // without merging geometry, adding triangles or smoothing across leaves.
    const normal = geometry.getAttribute('normal');
    const lowerNormal = new THREE.Vector3(), upperNormal = new THREE.Vector3();
    const joint = new THREE.Vector3();
    const stride = coarsePointer ? 6 : 12;
    for (let i = 0; i < normal.count; i += stride) {
      lowerNormal.fromBufferAttribute(normal, i);
      upperNormal.fromBufferAttribute(normal, i + 4);
      joint.copy(lowerNormal).add(upperNormal).normalize();
      for (const j of [1, 2, 3, 5]) {
        normal.setXYZ(i + j, joint.x, joint.y, joint.z);
      }
    }
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Tiny flowers are visible from a first-person viewpoint thanks to low
 * stems, upright petals and leaves. One opaque, vertex-coloured instanced
 * flower cluster replaces a floating bright sphere per placement.
 */
export function chroniclesMeadowWildflowersGeometry() {
  const positions = [];
  const colors = [];
  const leaf = new THREE.Color('#62844c');
  const stems = new THREE.Color('#78935b');
  const petals = ['#e8e2c7', '#d4b9c8', '#e7cb73', '#d5d8ef']
    .map(color => new THREE.Color(color));
  const add = (a, b, c, shade) => {
    positions.push(...a, ...b, ...c);
    for (let n = 0; n < 3; n += 1) colors.push(shade.r, shade.g, shade.b);
  };
  for (let i = 0; i < 6; i += 1) {
    const a = i * Math.PI * (3 - Math.sqrt(5));
    const r = 0.055 + (i % 3) * 0.07;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 0.32 + (i % 4) * 0.055;
    const dx = Math.cos(a) * 0.08;
    const dz = Math.sin(a) * 0.08;
    add([x - 0.014, 0.01, z], [x + 0.014, 0.01, z],
      [x + dx, h, z + dz], stems);
    add([x, 0.07, z], [x - 0.11, 0.12, z + 0.045],
      [x + dx * 0.3, 0.22, z + dz * 0.3], leaf);
    for (let petal = 0; petal < 4; petal += 1) {
      const angle = a + petal * Math.PI / 2;
      const sideX = Math.cos(angle);
      const sideZ = Math.sin(angle);
      const shade = petals[(i + petal) % petals.length];
      add([x + dx, h - 0.015, z + dz],
        [x + dx + sideX * 0.085, h + 0.038, z + dz + sideZ * 0.085],
        [x + dx - sideZ * 0.036, h + 0.10, z + dz + sideX * 0.036], shade);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}


/**
 * Branching broadleaf bole, replacing the perfectly straight trunk in plains
 * only. Gnarled bark, flared roots and upward limbs share a single merged
 * geometry and therefore ONE existing instanced draw call for the whole wood.
 *
 * All pieces use the same indexed CylinderGeometry attributes, so one
 * textured material handles the entire silhouette. It is built once when
 * the scene mounts; weather, movement and saves never rebuild it.
 */
export function chroniclesBranchingTrunkGeometry({ coarsePointer = false, woodland = false } = {}) {
  const radial = coarsePointer ? 5 : 7;
  const trunk = new THREE.CylinderGeometry(0.17, 0.29, 1, radial, coarsePointer ? 2 : 4);
  const points = trunk.getAttribute('position');
  for (let i = 0; i < points.count; i += 1) {
    const x = points.getX(i);
    const y = points.getY(i);
    const z = points.getZ(i);
    const bend = 0.055 * Math.sin((y + 0.5) * Math.PI * 1.15);
    const knot = 1 + 0.07 * Math.cos(y * 9 + Math.atan2(z, x) * 3);
    points.setXYZ(i, x * knot + bend, y, z * knot - bend * 0.55);
  }
  points.needsUpdate = true;
  trunk.computeVertexNormals();
  const flare = new THREE.CylinderGeometry(0.30, 0.43, 0.22, radial);
  flare.translate(0, -0.39, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const branches = coarsePointer
    ? [
      [[0.06, 0.18, 0.01], [-0.55, 0.64, 0.16]],
      [[0.00, 0.27, 0.03], [0.51, 0.65, -0.33]],
    ]
    : [
      [[0.06, 0.18, 0.01], [-0.68, 0.72, 0.20]],
      [[0.00, 0.27, 0.03], [0.67, 0.78, -0.38]],
      [[0.01, 0.34, -0.02], [-0.12, 0.73, -0.68]],
    ];
  const pieces = [trunk, flare];
  // Buttress roots join the existing bark geometry at ground height. These
  // short tapered fingers visually seat the tree in grass without creating
  // physics objects or a separate root draw call. The tree's world matrix
  // maps local y=-0.5 to the terrain surface.
  const rootTips = coarsePointer
    ? [[0.67, -0.49, 0.08], [-0.47, -0.49, -0.48]]
    : [[0.70, -0.49, 0.12], [-0.57, -0.49, 0.43], [-0.14, -0.49, -0.72]];
  rootTips.forEach(([tx, ty, tz]) => {
    const tip = new THREE.Vector3(tx, ty, tz);
    const base = new THREE.Vector3(tx * 0.28, -0.37, tz * 0.28);
    const direction = tip.clone().sub(base);
    const root = new THREE.CylinderGeometry(0.025, 0.125, direction.length(),
      5, 1, true);
    root.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
      up, direction.normalize()));
    root.translate(...base.add(tip).multiplyScalar(0.5).toArray());
    pieces.push(root);
  });
  branches.forEach(([from, to]) => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const branch = new THREE.CylinderGeometry(0.052, 0.125, direction.length(), radial);
    branch.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
    branch.translate(...start.clone().add(end).multiplyScalar(0.5).toArray());
    pieces.push(branch);
  });
  const merged = mergeGeometries(pieces, false);
  pieces.forEach(geometry => geometry.dispose());
  if (!merged) throw new Error('Unable to merge Chronicles broadleaf branches');
  if (woodland) {
    // C3's bole and all attached limbs share one continuous height-based
    // shear. Identical positions at seams receive identical displacements.
    // Keep the lower bole, flare and buttress roots precisely in place.
    const position = merged.getAttribute('position');
    const normal = merged.getAttribute('normal');
    const direction = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i);
      if (y <= -0.30) continue;
      const t = THREE.MathUtils.clamp((y + 0.30) / 1.08, 0, 1);
      const envelope = t * t * (3 - 2 * t);
      const a = 2.8 * t + 0.2, b = 2.1 * t;
      const dx = 0.17 * envelope * Math.sin(a);
      const dz = -0.13 * envelope * Math.sin(b);
      position.setXYZ(i, position.getX(i) + dx, y, position.getZ(i) + dz);
      // Inverse-transpose Jacobian of (x+dx(y), y, z+dz(y)).
      // Preserve the original UV seam normals instead of recalculating
      // them independently on the separate indexed branch cylinders.
      const rate = t < 1 ? 1 / 1.08 : 0;
      const slope = 6 * t * (1 - t);
      const ddx = 0.17 * rate * (slope * Math.sin(a) + envelope * 2.8 * Math.cos(a));
      const ddz = -0.13 * rate * (slope * Math.sin(b) + envelope * 2.1 * Math.cos(b));
      const nx = normal.getX(i), nz = normal.getZ(i);
      direction.set(nx, normal.getY(i) - ddx * nx - ddz * nz, nz).normalize();
      normal.setXYZ(i, direction.x, direction.y, direction.z);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
  }
  merged.computeBoundingSphere();
  return merged;
}


/**
 * Forest-floor fernlets and scattered fallen leaves. Built once, rendered as
 * a single opaque instanced batch across Banner Road's wooded cells.
 * Opaque vertex colours avoid alpha sorting and any animated update loop.
 */
export function chroniclesWoodlandUnderstoryGeometry({ coarsePointer = false } = {}) {
  const positions = [];
  const colours = [];
  const leaves = ['#425d32', '#65824c', '#7c9354', '#9a9c60']
    .map(hex => new THREE.Color(hex));
  const litter = ['#8c6940', '#a18352', '#797a48', '#70513a']
    .map(hex => new THREE.Color(hex));
  const triangle = (a, b, c, color) => {
    positions.push(...a, ...b, ...c);
    for (let j = 0; j < 3; j += 1) colours.push(color.r, color.g, color.b);
  };
  const sprigs = coarsePointer ? 5 : 10;
  for (let i = 0; i < sprigs; i += 1) {
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const d = 0.12 + (i % 4) * 0.10;
    const cx = Math.cos(angle) * d;
    const cz = Math.sin(angle) * d;
    const vx = Math.cos(angle) * (0.15 + (i % 3) * 0.04);
    const vz = Math.sin(angle) * (0.15 + (i % 3) * 0.04);
    const h = 0.21 + (i % 4) * 0.065;
    const sx = -Math.sin(angle) * 0.085;
    const sz = Math.cos(angle) * 0.085;
    triangle([cx - sx, 0.012, cz - sz], [cx + sx, 0.012, cz + sz],
      [cx + vx, h, cz + vz], leaves[i % leaves.length]);
    if (!coarsePointer) {
      triangle([cx - sx * 0.75, h * 0.46, cz - sz * 0.75],
        [cx + sx * 0.75, h * 0.46, cz + sz * 0.75],
        [cx + vx * 1.13, h * 0.88, cz + vz * 1.13],
        leaves[(i + 2) % leaves.length]);
    }
  }
  // Spend the same 7/3 triangles on three/one folded leaves and one
  // small fragment. Each complete leaf has a raised central vein, two
  // uneven sides and subtly different weathered pigments. No added
  // geometry budget, textures or separate transparent decals.
  const fallen = coarsePointer ? 1 : 3;
  for (let i = 0; i < fallen; i += 1) {
    const angle = i * 2.39996 + 0.4;
    const d = 0.20 + i * 0.10;
    const x = Math.cos(angle) * d, z = Math.sin(angle) * d;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const half = 0.10 + (i % 3) * 0.018;
    const root = [x - dx * half, 0.016, z - dz * half];
    const tip = [x + dx * half, 0.035, z + dz * half];
    const left = [x - dz * 0.055, 0.013, z + dx * 0.055];
    const right = [x + dz * 0.043 + dx * 0.025, 0.012,
      z - dx * 0.043 + dz * 0.025];
    const shade = litter[i % litter.length];
    triangle(root, left, tip, shade);
    triangle(root, tip, right, shade.clone().lerp(litter[3], 0.28));
  }
  // A broken leaf at the outer edge uses the last existing triangle.
  const a = fallen * 2.39996 + 0.4;
  const x = Math.cos(a) * 0.42, z = Math.sin(a) * 0.42;
  triangle([x - 0.04, 0.014, z - 0.025],
    [x + 0.02, 0.014, z + 0.045],
    [x + 0.065, 0.022, z - 0.018], litter[2]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}


/**
 * Irregular half-buried stones, shallow exposed roots and fallen leaf litter
 * interrupt the featureless meadow foreground. One shared opaque geometry
 * is instanced across selected, walkable unpaved grass cells in Terra
 * meadows and the authored Banner Road forest. Both reuse the same shape.
 * Deliberately lower than the player's ankle: only a visual microrelief,
 * never a collider, a raised terrain tile or an interactive object.
 */
export function chroniclesMeadowMicroreliefGeometry({ coarsePointer = false, woodland = false } = {}) {
  const positions = [];
  const colors = [];
  const stone = ['#8c8d7a', '#6d7766', '#9b9880', '#737263']
    .map(value => new THREE.Color(value));
  const bark = ['#615443', '#817059'].map(value => new THREE.Color(value));
  const litter = ['#887750', '#a09265', '#707b4c']
    .map(value => new THREE.Color(value));
  const add = (a, b, c, tint, tintB = tint, tintC = tint) => {
    positions.push(...a, ...b, ...c);
    for (const shade of [tint, tintB, tintC]) colors.push(shade.r, shade.g, shade.b);
  };
  const rock = (cx, cz, radius, height, seed) => {
    const rim = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = i * Math.PI / 3;
      const r = radius * (0.83 + (i % 3) * 0.11);
      rim.push([cx + Math.cos(angle) * r, 0.012,
        cz + Math.sin(angle) * r * 0.78]);
    }
    const top = [cx + radius * 0.11, height, cz - radius * 0.08];
    // C3 stones share a continuous mineral cap and damp, mossy rim.
    // Preserve their exact geometry and the generic meadow face palette.
    const cap = stone[seed % stone.length];
    const moss = new THREE.Color('#536443');
    const rimTints = rim.map((_, i) => cap.clone().lerp(moss,
      0.35 + 0.20 * (0.5 + 0.5 * Math.cos(i * Math.PI / 3 + seed))).multiplyScalar(0.78));
    for (let i = 0; i < rim.length; i += 1) {
      const next = (i + 1) % rim.length;
      if (woodland) add(rim[i], top, rim[next], rimTints[i], cap, rimTints[next]);
      else add(rim[i], top, rim[next], stone[(seed + i) % stone.length]);
    }
  };
  rock(0.12, -0.11, 0.30, 0.17, 0);
  if (!coarsePointer) {
    rock(-0.28, 0.25, 0.20, 0.115, 1);
    rock(0.29, 0.31, 0.16, 0.10, 2);
  }
  // Two bark-coloured ribbons snake around the stones, rather than adding
  // tall fallen logs. Mobile keeps only one; neither casts a shadow.
  const roots = coarsePointer ? 1 : 2;
  for (let i = 0; i < roots; i += 1) {
    const z = i ? 0.36 : -0.33;
    const x = i ? -0.46 : -0.55;
    const shade = bark[i % bark.length];
    if (woodland) {
      // Fold the same two faces along a raised, tapering bark ridge.
      // The thick end points towards the adjacent woodland root.
      const base = [x, 0.085, z];
      const tip = [x + 0.76, 0.017, z + 0.045];
      const left = [x + 0.19, 0.013, z - 0.065];
      const right = [x + 0.30, 0.013, z + 0.13];
      // Weathered bark darkens toward the soil contact. Keep the ridge
      // readable without adding a single face or a separate texture.
      const tipTint = shade.clone().lerp(litter[0], 0.35).multiplyScalar(0.88);
      const contact = shade.clone().multiplyScalar(0.68);
      const shaded = shade.clone().lerp(bark[1], 0.35).multiplyScalar(0.84);
      add(base, tip, left, shade, tipTint, contact);
      add(base, right, tip, shaded, contact, tipTint);
    } else {
      add([x, 0.022, z], [x + 0.47, 0.045, z + 0.15],
        [x + 0.10, 0.025, z + 0.075], shade);
      add([x + 0.10, 0.025, z + 0.075],
        [x + 0.47, 0.045, z + 0.15],
        [x + 0.76, 0.017, z + 0.045], shade);
    }
  }
  for (let i = 0; i < (coarsePointer ? 2 : 5); i += 1) {
    const x = (i % 3 - 1) * 0.25 + 0.035;
    const z = (Math.floor(i / 3) - 0.5) * 0.54 + 0.15;
    const shade = litter[i % litter.length];
    // C3 leaf fragments fade from damp earthy bases to dry raised tips.
    // Generic Terra keeps its original flat pigment.
    const baseTint = woodland ? shade.clone().lerp(bark[0], 0.30) : shade;
    const tipTint = woodland ? shade.clone().lerp(litter[1], 0.24) : shade;
    add([x - 0.06, 0.015, z], [x + 0.035, 0.015, z + 0.07],
      [x + 0.075, 0.020, z - 0.04], shade, baseTint, tipTint);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}


/**
 * Fallen, moss-dusted timber for the woodland edge. A horizontal trunk,
 * exposed end grain and broken branch stubs share ONE opaque vertex-colour
 * geometry and one instanced draw batch across the authored Banner Road.
 * Low to the ground, static and decoration-only; never a new collider.
 */
export function chroniclesFallenWoodGeometry({ coarsePointer = false, fungi = false } = {}) {
  const positions = [];
  const colors = [];
  const bark = ['#63513d', '#755e44', '#897455', '#4e4438']
    .map(hex => new THREE.Color(hex));
  const heartwood = new THREE.Color('#806448');
  const grain = ['#b49b73', '#a88c65', '#b9a27b']
    .map(hex => new THREE.Color(hex));
  const moss = ['#708654', '#506b40', '#84925d']
    .map(hex => new THREE.Color(hex));
  const triangle = (a, b, c, tint, second = tint, third = tint) => {
    positions.push(...a, ...b, ...c);
    for (const color of [tint, second, third]) colors.push(color.r, color.g, color.b);
  };
  const sides = coarsePointer ? 5 : 8;
  const rings = [-0.67, 0.64].map((x, end) =>
    Array.from({ length: sides }, (_, i) => {
      const a = i * Math.PI * 2 / sides;
      const radius = (end ? 0.16 : 0.20) * (0.94 + (i % 3) * 0.035);
      return [x, 0.205 + Math.cos(a) * radius, Math.sin(a) * radius];
    }));
  for (let i = 0; i < sides; i += 1) {
    const next = (i + 1) % sides;
    triangle(rings[0][i], rings[1][i], rings[0][next], bark[i % bark.length]);
    triangle(rings[0][next], rings[1][i], rings[1][next],
      bark[(i + 1) % bark.length]);
    // A darker weathered heart and lighter sapwood at the rim, with
    // irregular radial grain. Shared rim vertices retain consistent tint.
    triangle([-0.67, 0.205, 0], rings[0][next], rings[0][i],
      heartwood, grain[next % grain.length], grain[i % grain.length]);
    triangle([0.64, 0.205, 0], rings[1][i], rings[1][next],
      heartwood, grain[i % grain.length], grain[next % grain.length]);
  }
  // A couple of short broken branch remnants interrupt the cylinder outline
  // without protruding beyond the source forest tile.
  triangle([-0.17, 0.34, -0.03], [0.04, 0.43, -0.16],
    [0.16, 0.33, -0.05], bark[0]);
  if (!coarsePointer) {
    triangle([0.27, 0.32, 0.035], [0.43, 0.46, 0.11],
      [0.51, 0.29, 0.08], bark[2]);
  }
  // Interpolate the ACTUAL upper bark facets, whose end rings are
  // homothetic. A 2mm upward bias avoids z-fighting without floating
  // moss, even on the five-sided mobile trunk. All three vertices of
  // each patch lie on the same planar facet.
  const surface = (side, u, v) => {
    const next = (side + 1) % sides;
    const mix = THREE.MathUtils.lerp;
    const p = rings[0][side].map((value, axis) => mix(value, rings[1][side][axis], u));
    const q = rings[0][next].map((value, axis) => mix(value, rings[1][next][axis], u));
    return p.map((value, axis) => mix(value, q[axis], v) + (axis === 1 ? 0.002 : 0));
  };
  for (let i = 0; i < (coarsePointer ? 2 : 4); i += 1) {
    const side = i % 2 ? sides - 1 : 0;
    const u = 0.14 + i * (coarsePointer ? 0.48 : 0.22);
    const v = side === 0 ? 0.12 : 0.88;
    const shade = moss[i % moss.length];
    triangle(surface(side, u, v), surface(side, u + 0.16, v),
      surface(side, u + 0.07, side === 0 ? 0.66 : 0.34),
      shade, shade.clone().multiplyScalar(0.85), moss[(i + 1) % moss.length]);
  }
  if (fungi) {
    // A tiny cluster of woodland fungi at the rotten log's lower flank.
    // Stems and caps share the log's opaque, double-sided material.
    const stem = new THREE.Color('#c3b798');
    const cap = new THREE.Color('#b48a52');
    const shade = new THREE.Color('#8a603c');
    const clusters = coarsePointer
      ? [[-0.35, 0.24, 0.16, 0.095]]
      : [[-0.35, 0.24, 0.16, 0.095], [-0.15, 0.26, 0.115, 0.072],
        [-0.48, 0.27, 0.09, 0.058]];
    for (const [x, z, h, r] of clusters) {
      const base = [x, 0.012, z];
      const top = [x, h, z];
      // Two crossed, tapering triangles keep the stem visible from any yaw.
      triangle([x - 0.018, base[1], z], [x + 0.018, base[1], z], top, stem);
      triangle([x, base[1], z - 0.018], [x, base[1], z + 0.018], top, stem);
      const sides = coarsePointer ? 5 : 6;
      const rim = Array.from({ length: sides }, (_, i) => {
        const angle = i * Math.PI * 2 / sides;
        return [x + r * Math.cos(angle), h - r * 0.12, z + r * Math.sin(angle)];
      });
      const apex = [x + 0.008, h + r * 0.48, z];
      for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        triangle(rim[i], apex, rim[next], shade, cap, shade);
        triangle(rim[next], top, rim[i], shade, stem, shade);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Wind-shaped snow conifers: retain the existing cone topology and batch,
// but break its ruler-straight skirt and perfectly vertical summit. Apply
// identical position-based displacement to the side and cap seam vertices.
export function chroniclesSnowPineGeometry({ coarsePointer = false } = {}) {
  const geometry = new THREE.ConeGeometry(1, 1, coarsePointer ? 8 : 12);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    if (y > 0.49) {
      positions.setXYZ(i, 0.12, y, -0.045);
    } else if (x * x + z * z > 0.5) {
      const angle = Math.atan2(z, x);
      const scallop = 0.90 + 0.07 * Math.cos(3 * angle + 0.35)
        + 0.03 * Math.sin(5 * angle - 0.20);
      const lift = 0.035 * (1 + Math.cos(3 * angle + 0.65));
      positions.setXYZ(i, x * scallop, y + lift, z * scallop);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Wind-packed snowdrifts: deform the existing low sphere into an asymmetric
// crest with a gently sloping windward flank. The visible footprint and
// height stay bounded; no new geometry topology, texture or render batch.
export function chroniclesSnowdriftGeometry() {
  const geometry = new THREE.SphereGeometry(0.5, 8, 4);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const crest = Math.max(0, y * 2);
    const taper = 0.90 + 0.08 * Math.cos(z * 5.0 + x * 2.0);
    positions.setXYZ(i, x * taper + 0.14 * crest * crest,
      y > 0 ? y * (0.88 + 0.12 * crest) : y,
      z * (0.86 + 0.10 * Math.sin(x * 5.0 + 0.8)));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Exposed stone beneath a wind-scoured snow cap. The existing snow
// texture is modulated by baked vertex pigments, not another material,
// overlay or shader. The continuous height field is seam-safe and leaves
// the original rock geometry and instance transforms untouched.
export function chroniclesSnowRockGeometry({ coarsePointer = false } = {}) {
  const geometry = chroniclesOrganicRockGeometry({ coarsePointer });
  const position = geometry.getAttribute('position');
  const exposed = new THREE.Color('#85949e');
  const powder = new THREE.Color('#ffffff');
  const tint = new THREE.Color();
  const colors = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const snowline = 0.08 + 0.20 * x + 0.11 * Math.sin(z * 3.2);
    const cover = THREE.MathUtils.smoothstep(y - snowline, -0.25, 0.38);
    tint.copy(exposed).lerp(powder, cover);
    colors.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

// Gnarled marsh wood: preserve the six-sided, single-segment cylinder
// topology and its branch attachment envelope. A slight asymmetric taper
// and off-centre crown break the perfectly straight cut-pole silhouette.
// Displacement is position-based, including duplicated cap and UV vertices.
export function chroniclesMarshDeadTrunkGeometry() {
  const geometry = new THREE.CylinderGeometry(0.14, 0.26, 1, 6);
  const position = geometry.getAttribute('position');
  // Damp, moss-stained roots grade into exposed weathered wood.
  // All duplicate seam vertices share the same position-based pigment.
  const wet = new THREE.Color('#758477');
  const dry = new THREE.Color('#e7dfd0');
  const tint = new THREE.Color();
  const colors = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const t = y + 0.5;
    const angle = Math.atan2(z, x);
    tint.copy(wet).lerp(dry, THREE.MathUtils.smoothstep(t, 0, 1));
    colors.push(tint.r, tint.g, tint.b);
    const radial = 1 + 0.09 * Math.cos(angle * 2 + t * 0.8)
      + 0.06 * Math.sin(angle * 3 - t * 1.1);
    position.setXYZ(i, x * radial + 0.075 * t, y,
      z * radial - 0.045 * t);
  }
  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Marsh reeds taper into narrow, wind-bent blades instead of uniform rods.
// Keep the original four-sided topology, stem roots and UV seam. Coast
// reeds retain their original geometry and material.
// Coastal marram grass has flattened wind-swept blades rather than the
// cylindrical marsh reed silhouette. Keep the same four-sided mesh budget,
// UVs and watertight seams; tint dry tips and sheltered olive roots.
export function chroniclesCoastalGrassGeometry() {
  const geometry = new THREE.CylinderGeometry(0.035, 0.05, 1, 4);
  const position = geometry.getAttribute('position');
  const root = new THREE.Color('#a3a778');
  const tip = new THREE.Color('#f0e4ba');
  const tint = new THREE.Color();
  const colors = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const t = y + 0.5;
    position.setXYZ(i, x * (1.65 - 1.25 * t) + 0.20 * t,
      y, z * (0.55 - 0.25 * t));
    tint.copy(root).lerp(tip, t);
    colors.push(tint.r, tint.g, tint.b);
  }
  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function chroniclesMarshReedGeometry() {
  const geometry = new THREE.CylinderGeometry(0.035, 0.05, 1, 4);
  const position = geometry.getAttribute('position');
  const colors = [];
  const root = new THREE.Color('#9da895');
  const tip = new THREE.Color('#fff3d4');
  const tint = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const t = y + 0.5;
    position.setXYZ(i, x * (1 - 0.70 * t) + 0.09 * t,
      y, z * (1 - 0.35 * t) - 0.04 * t);
    tint.copy(root).lerp(tip, t);
    colors.push(tint.r, tint.g, tint.b);
  }
  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Weathered columnar basalt: irregular hexagonal crowns and subtly
// oxidized upper faces, retaining the original six-sided prism budget.
// The same deformation is applied to duplicated side/cap vertices.
export function chroniclesVolcanicBasaltGeometry() {
  const geometry = new THREE.CylinderGeometry(0.42, 0.48, 1, 6);
  const position = geometry.getAttribute('position');
  const colors = [];
  const base = new THREE.Color('#989393');
  const crown = new THREE.Color('#e2d4c6');
  const tint = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const t = y + 0.5;
    const radius = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    const radial = 0.94 + 0.055 * Math.sin(angle * 2 + 0.4)
      + 0.025 * Math.cos(angle * 3 - 0.3);
    const erosion = 0.075 + 0.09 * (x / 0.48) + 0.04 * (z / 0.48)
      + 0.035 * radius * Math.cos(angle * 3 + 0.4);
    position.setXYZ(i, x * radial, y - t * Math.max(0, erosion), z * radial);
    tint.copy(base).lerp(crown, t);
    colors.push(tint.r, tint.g, tint.b);
  }
  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Mineral bands follow the local rock surface, rather than adding another
// texture or glowing geometry. Cold ash rock and ember rock share their
// existing topology; only the baked albedo multiplier differs.
export function chroniclesVolcanicRockGeometry({ coarsePointer = false, ember = false } = {}) {
  const geometry = chroniclesOrganicRockGeometry({ coarsePointer });
  const position = geometry.getAttribute('position');
  const shadow = new THREE.Color(ember ? '#9e7868' : '#999ba0');
  const mineral = new THREE.Color(ember ? '#ffe0bd' : '#e6dbce');
  const tint = new THREE.Color();
  const colors = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const layer = 0.5 + 0.5 * Math.sin(y * 7.8 + x * 2.1 + Math.sin(z * 3.4) * 0.7);
    const weather = THREE.MathUtils.smoothstep(y, -0.85, 0.85);
    tint.copy(shadow).lerp(mineral, 0.18 + layer * 0.55 + weather * 0.27);
    colors.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

// Parts: one geometry + one material each, instanced across the map.
// A single eroded sea arch marks the cliffs of Hollín. Its irregular
// stone cross-sections follow an open arch, not a solid wall or a torus.
// Both ends sink below the decorative terrain, outside the playable grid.
export function chroniclesHollinArchGeometry({ coarsePointer = false } = {}) {
  const spans = coarsePointer ? 12 : 20;
  const sides = coarsePointer ? 6 : 8;
  const positions = [], colors = [], uvs = [], indices = [];
  const damp = new THREE.Color('#848078');
  const pale = new THREE.Color('#e0d5bf');
  const pigment = new THREE.Color();
  for (let i = 0; i <= spans; i++) {
    const t = i / spans;
    const a = Math.PI * (1 - t);
    const cx = 5.2 * Math.cos(a) + 0.36 * Math.sin(3 * a);
    const cy = -0.45 + 7.4 * Math.sin(a);
    const cz = 0.32 * Math.sin(2 * a);
    const n = Math.hypot(7.4 * Math.cos(a), 5.2 * Math.sin(a));
    const nx = 7.4 * Math.cos(a) / n, ny = 5.2 * Math.sin(a) / n;
    const width = 1.30 + 0.55 * Math.abs(Math.cos(a)) + 0.15 * Math.sin(5 * a + 0.3);
    for (let j = 0; j <= sides; j++) {
      const b = j === sides ? 0 : j * Math.PI * 2 / sides;
      const erosion = 1 + 0.10 * Math.cos(3 * b + 2 * a) + 0.05 * Math.sin(2 * b - 7 * a);
      const r = width * erosion * Math.cos(b);
      const y = cy + ny * r;
      positions.push(cx + nx * r, y, cz + 1.15 * erosion * Math.sin(b));
      const strata = 0.5 + 0.5 * Math.sin(y * 1.9 + cx * 0.25);
      pigment.copy(damp).lerp(pale, 0.26 + 0.46 * THREE.MathUtils.smoothstep(y, 0, 7) + 0.18 * strata);
      colors.push(pigment.r, pigment.g, pigment.b);
      uvs.push(j / sides * 2, t * 5);
      if (i < spans && j < sides) {
        const k = i * (sides + 1) + j;
        indices.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function partCatalog(coarsePointer, biome, woodland = false, naturalHighlands = false, brezalBackdrop = false) {
  // The highland-specific stone stays inside the existing boulder, crag
  // and pebble batches. B2 heath, snow, forest and marsh rock stay intact.
  const rockMap = texture(naturalHighlands ? 'uplandrock' : 'rock');
  const rock = (color) => lit(color, { map: rockMap, flatShading: true });
  const roundedRock = (color, opts = {}) => lit(color, {
    map: rockMap, flatShading: coarsePointer, ...opts,
  });
  return {
    coastalArch: () => [chroniclesHollinArchGeometry({ coarsePointer }),
      roundedRock(0xa69b88, { vertexColors: true, flatShading: true })],
    boulder: () => [brezalBackdrop
      ? chroniclesBrezalStoneGeometry({ coarsePointer })
      : chroniclesOrganicRockGeometry({ coarsePointer,
        weatheredHighland: naturalHighlands }), roundedRock(0xd8d2c4, {
        flatShading: coarsePointer || brezalBackdrop,
      })],
    boulderDark: () => biome === 'ash'
      ? [chroniclesVolcanicRockGeometry({ coarsePointer }), roundedRock(0x8a857c, { vertexColors: true })]
      : [chroniclesOrganicRockGeometry({ coarsePointer }), roundedRock(0x8a857c)],
    boulderSnow: () => [chroniclesSnowRockGeometry({ coarsePointer }), lit(0xf2f6fa, { map: texture('snow'), flatShading: coarsePointer, vertexColors: true })],
    crag: () => [chroniclesMountainCragGeometry({ coarsePointer }), rock(0xc8c0b0)],
    basalt: () => [chroniclesVolcanicBasaltGeometry(), lit(0x8a7c74, { map: texture('rock'), flatShading: true, vertexColors: true })],
    emberRock: () => [chroniclesVolcanicRockGeometry({ coarsePointer, ember: true }), roundedRock(0x5a4a44, { emissive: 0x5a1c04, emissiveIntensity: 0.35, vertexColors: true })],
    trunk: () => [new THREE.CylinderGeometry(0.2, 0.32, 1, 7), lit(0xffffff, { map: texture('bark', 2, 3) })],
    broadleafTrunk: () => [chroniclesBranchingTrunkGeometry({ coarsePointer, woodland }), lit(0xffffff, { map: texture(woodland ? 'woodlandbark' : 'bark', 2, 3) })],
    crown: () => [chroniclesLayeredCanopyGeometry({ coarsePointer, woodland }),
      lit(woodland ? 0xffffff : 0xe6efdc, {
        map: texture(woodland ? 'woodlandleaves' : 'leaves', 3, 3),
        // Smooth leaf normals on touch only for the new multi-lobed woodland
        // silhouette; other locations retain their exact original mobile art.
        flatShading: coarsePointer && !woodland,
        vertexColors: true,
      })],
    bush: () => [brezalBackdrop
      ? chroniclesBrezalShrubGeometry({ coarsePointer })
      : biome === 'plains'
        ? chroniclesLayeredShrubGeometry({ coarsePointer, woodland })
        : chroniclesOrganicCanopyGeometry({ coarsePointer, shrub: true }),
      lit(woodland ? 0xffffff : 0xcbdcbd, { map: texture(woodland ? 'woodlandleaves' : 'leaves', 2, 2), flatShading: coarsePointer })],
    pine: () => [biome === 'snow' ? chroniclesSnowPineGeometry({ coarsePointer }) : new THREE.ConeGeometry(1, 1, coarsePointer ? 8 : 12), lit(0x9cb09c, { map: texture('leaves', 5, 2) })],
    pineSnow: () => [biome === 'snow' ? chroniclesSnowPineGeometry({ coarsePointer }) : new THREE.ConeGeometry(1, 1, coarsePointer ? 8 : 12), lit(0xf4f8fc, { map: texture('snow', 3, 1) })],
    deadTrunk: () => [chroniclesMarshDeadTrunkGeometry(), lit(0xcab8a0, { map: texture('bark', 1, 3), vertexColors: true })],
    reed: () => biome === 'marsh'
      ? [chroniclesMarshReedGeometry(), lit(0xb2a65e, { vertexColors: true })]
      : biome === 'coast'
        ? [chroniclesCoastalGrassGeometry(), lit(0xd2c489, { vertexColors: true })]
        : [new THREE.CylinderGeometry(0.035, 0.05, 1, 4), lit(0xb2a65e)],
    // One batched, opaque water surface per marsh. More rounded on desktop,
    // original 14-gon on touch devices; never casts an implausible shadow.
    pool: () => [chroniclesMarshPoolGeometry({ coarsePointer }),
      lit(0xffffff, { map: texture('bogwater'), roughness: 0.28, metalness: 0.06, vertexColors: true })],
    dune: () => [chroniclesCoastalDuneGeometry(), lit(0xffffff, { map: texture('sand', 2, 2), vertexColors: true })],
    drift: () => [new THREE.CylinderGeometry(0.16, 0.2, 1, 6), lit(0xa89a86, { map: texture('bark', 1, 2) })],
    // Walkable clutter.
    tuft: () => [chroniclesMeadowGrassGeometry({ coarsePointer, woodland }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    meadowSedge: () => [chroniclesMeadowSedgeGeometry({ coarsePointer }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    forestHerb: () => [chroniclesForestHerbGeometry({ coarsePointer, woodland }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    flower: () => [chroniclesMeadowWildflowersGeometry(), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    woodlandFloor: () => [chroniclesWoodlandUnderstoryGeometry({ coarsePointer }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    microrelief: () => [chroniclesMeadowMicroreliefGeometry({ coarsePointer, woodland }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    fallenWood: () => [chroniclesFallenWoodGeometry({ coarsePointer, fungi: woodland }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    pebble: () => [new THREE.IcosahedronGeometry(0.22, 0), rock(0xbab2a2)],
    heather: () => [chroniclesBrezalHeatherGeometry(), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    // A different low rosette only for B2 walkable foothills. Retains the
    // original authored blocked-verge heather *geometry and matrices*.
    heatherGroundcover: () => [chroniclesBrezalGroundcoverGeometry(), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    snowMound: () => [chroniclesSnowdriftGeometry(), lit(0xf4f8fc, { map: texture('snow') })],
    ember: () => [new THREE.BoxGeometry(0.12, 0.06, 0.12), lit(0xff7a2a, { emissive: 0xff5a10, emissiveIntensity: 1.2 })],
    // Camps.
    tent: () => [new THREE.ConeGeometry(1.7, 2.6, 4, 1, true), lit(0xc9b894, { side: THREE.DoubleSide, flatShading: true })],
    pole: () => [new THREE.CylinderGeometry(0.06, 0.07, 1, 5), lit(0x4d3424)],
    log: () => [new THREE.CylinderGeometry(0.13, 0.13, 1, 6), lit(0x6b4a30, { map: texture('bark', 1, 2) })],
    flame: () => [new THREE.ConeGeometry(0.42, 1.1, 6), lit(0xffb040, { emissive: 0xff7a18, emissiveIntensity: 1.6, transparent: true, opacity: 0.92 })],
    banner: () => [new THREE.PlaneGeometry(1, 1), lit(0x8a2e2a, { side: THREE.DoubleSide })],
  };
}

// A placer collects one matrix per instance and part.
function createPlacer() {
  const parts = new Map();
  const add = (part, position, { yaw = 0, tilt = 0, roll = 0, scale = [1, 1, 1] } = {}) => {
    box.position.set(position[0], position[1], position[2]);
    box.rotation.set(tilt, yaw, roll);
    box.scale.set(scale[0], scale[1], scale[2]);
    box.updateMatrix();
    if (!parts.has(part)) parts.set(part, []);
    parts.get(part).push(box.matrix.clone());
  };
  return { add, parts };
}

// ─── what stands on one impassable cell, per biome ────────────────────────
// (wx, wz) is the cell centre; `big` grows the outskirts a little.

// The coastal stone fields alternate low wave-worn shingle and taller
// coherent outcrops, without moving any root or increasing the footprint.
export function chroniclesCoastalOutcropHeight(x, y) {
  const swell = 0.48 * Math.sin(x * 0.48 + y * 0.29)
    + 0.20 * Math.cos(x * 0.24 - y * 0.51 + 0.8);
  return THREE.MathUtils.clamp(1 + swell, 0.55, 1.60);
}

function boulders(p, wx, wz, x, y, { part = 'boulder', count = 2, size = 1.2, height = 1 } = {}) {
  for (let k = 0; k < count; k += 1) {
    const s = size * (0.7 + noise(x, y, k + 1) * 0.7);
    const ox = (noise(x, y, k + 3) - 0.5) * 2.4;
    const oz = (noise(y, x, k + 5) - 0.5) * 2.4;
    p.add(part, [wx + ox, s * 0.55 * height, wz + oz], {
      yaw: noise(x, y, k + 7) * 6.28, tilt: (noise(x, y, k + 9) - 0.5) * 0.5,
      scale: [s * (0.9 + noise(x, y, k + 11) * 0.5), s * height * (0.7 + noise(x, y, k + 13) * 0.6), s],
    });
  }
}

// Shared per-blocked-cell species key: trunk and crown always agree.
function bannerRoadPaleTree(x, y) {
  return noise(x, y, 881) > 0.56;
}

/**
 * C3-only: a different, continuous crest rhythm for each existing woodland
 * crown. Keep trunk roots, tree count, lobe count and the landmark gateway
 * untouched. A broad wave with small seeded variation produces tall,
 * narrower crowns between lower, wider masses rather than an even forest
 * of nearly identical green balls. The already-authored yaw reveals each
 * asymmetric leaf mesh from a different side. No randomness on reload.
 */
export function chroniclesBannerRoadCanopyRhythm(x, y) {
  const wave = 0.19 * Math.sin(x * 0.67 + y * 0.29)
    + 0.11 * Math.cos(x * 0.23 - y * 0.51)
    + (noise(x, y, 1139) - 0.5) * 0.09;
  const crest = THREE.MathUtils.clamp(wave, -0.29, 0.29);
  return Object.freeze({
    span: 1 - crest * 0.34,
    height: 1 + crest * 0.75,
    depth: 1 + 0.095 * Math.sin(x * 0.37 - y * 0.63)
      + (noise(x, y, 1141) - 0.5) * 0.06,
  });
}

// Shift only existing exterior trees toward staggered three-cell groves.
 // Different grove strengths and retained individual jitter break the grid.
 // The maximum 1.45m offset keeps each trunk in its own 4m scenery cell.
export function chroniclesBannerRoadGroveOffset(x, y, ox, oz) {
  const band = Math.floor(y / 3);
  const stagger = ((band % 2) + 2) % 2;
  const anchorX = Math.floor((x + stagger) / 3) * 3 + 1 - stagger;
  const anchorY = band * 3 + 1;
  const weight = 0.45 + 0.35 * noise(anchorX, anchorY, 1561);
  return [ox * 0.65 + (anchorX - x) * weight,
    oz * 0.65 + (anchorY - y) * weight];
}

// Age/species silhouettes use the existing shared crown mesh. Preserve
// authored landmarks and the approach grove rather than exaggerating them.
export function chroniclesBannerTreeCrownProfile(x, y, scale, pale, gateway = false) {
  if (gateway || (y === 4 && x >= 6 && x <= 13) || (x === 20 && y === 7)) {
    return { family: 'landmark', span: 1, height: 1, depth: 1 };
  }
  if (scale < 0.75) {
    return { family: 'young', span: 0.88, height: 1.13, depth: 0.90 };
  }
  if (pale) {
    return { family: 'upright', span: 0.91, height: 1.10, depth: 0.92 };
  }
  return { family: 'spreading', span: 1.09, height: 0.94, depth: 1.06 };
}

function broadleaf(p, wx, wz, x, y, k, scale = 1, bannerRoad = false, woodlandGateway = false, backdrop = false) {
  const s = scale * (0.79 + noise(x, y, k + 21) * 0.65);
  const baseX = (noise(x, y, k + 23) - 0.5) * 2;
  const baseZ = (noise(y, x, k + 25) - 0.5) * 2;
  const [ox, oz] = bannerRoad && backdrop
    ? chroniclesBannerRoadGroveOffset(x, y, baseX, baseZ) : [baseX, baseZ];
  const yaw = noise(x, y, k + 46) * Math.PI * 2;
  // Upright pale woodland tree: same geometry/batches, different proportions.
  const pale = bannerRoad && bannerRoadPaleTree(x, y);
  const trunkWidth = pale ? 0.79 : 1;
  const trunkHeight = pale ? 1.12 : 1;
  p.add('broadleafTrunk', [wx + ox, 1.5 * s * trunkHeight, wz + oz], {
    yaw, roll: (noise(x, y, k + 47) - 0.5) * 0.04,
    scale: [s * trunkWidth, 3 * s * trunkHeight, s * trunkWidth],
  });
  // Vary crown silhouette independently of the trunk, preserving one
  // InstancedMesh for all foliage. The two mature gateway trees are a
  // special composition: the pale trunk's original .74 crown width makes
  // the left canopy a sharp conifer, while the dark right tree's 1.0 width
  // and .88 height produce a flattened mushroom. Balance ONLY their
  // canopy proportions; trunk, pose, species tint and all other trees stay
  // untouched, with exactly the same 4/6-lobe shared canopy geometry.
  const spreadX = 0.74 + noise(x, y, k + 27) * 0.55;
  const spreadZ = 0.73 + noise(x, y, k + 29) * 0.57;
  const crownHeight = 0.79 + noise(x, y, k + 33) * 0.43;
  // The two gateway crowns are an authored pair and must keep their
  // balanced silhouette and clear player headroom exactly as before.
  const crownRhythm = bannerRoad && !woodlandGateway
    ? chroniclesBannerRoadCanopyRhythm(x, y) : null;
  const crownProfile = bannerRoad
    ? chroniclesBannerTreeCrownProfile(x, y, scale, pale, woodlandGateway) : null;
  p.add('crown', [wx + ox + (noise(x, y, k + 50) - 0.5) * 0.22 * s,
    3.9 * s * trunkHeight, wz + oz + (noise(y, x, k + 51) - 0.5) * 0.22 * s], {
    yaw,
    roll: (noise(x, y, k + 35) - 0.5) * 0.13,
    scale: [1.9 * s * spreadX * (woodlandGateway ? (pale ? 1.00 : 0.86) : pale ? 0.74 : 1)
        * (crownRhythm?.span ?? 1) * (crownProfile?.span ?? 1),
      1.6 * s * crownHeight * (woodlandGateway ? (pale ? 1.08 : 1.24) : pale ? 1.18 : 1)
        * (crownRhythm?.height ?? 1) * (crownProfile?.height ?? 1),
      1.9 * s * spreadZ * (woodlandGateway ? (pale ? 0.95 : 0.92) : pale ? 0.76 : 1)
        * (crownRhythm?.depth ?? 1) * (crownProfile?.depth ?? 1)],
  });
  // Low foliage is planted on the SAME blocked cell as the trunk, never
  // on the walkable road. It enriches the woodland edge without colliders.
  if (noise(x, y, k + 38) > 0.30) {
    p.add('bush', [wx + ox * 0.5 + (noise(x, y, k + 39) - 0.5) * 1.1,
      0.35 * s, wz + oz * 0.5 + (noise(y, x, k + 40) - 0.5) * 1.1], {
      yaw: noise(x, y, k + 41) * 6.28,
      scale: [0.62 * s, 0.44 * s, 0.57 * s],
    });
  }
}

function pine(p, wx, wz, x, y, k, { snowy = false, scale = 1 } = {}) {
  const s = scale * (0.85 + noise(x, y, k + 31) * 0.5);
  const ox = (noise(x, y, k + 33) - 0.5) * 2.2;
  const oz = (noise(y, x, k + 35) - 0.5) * 2.2;
  p.add('trunk', [wx + ox, 1 * s, wz + oz], { scale: [0.8 * s, 2 * s, 0.8 * s] });
  p.add('pine', [wx + ox, 3.2 * s, wz + oz], { scale: [1.8 * s, 3.4 * s, 1.8 * s] });
  p.add(snowy ? 'pineSnow' : 'pine', [wx + ox, 5.2 * s, wz + oz], { scale: [1.2 * s, 2.6 * s, 1.2 * s] });
}

// Keep one trunk and two existing branch instances, but actually attach
// their roots to the deformed trunk axis. Seeded asymmetric forks replace
// the identical detached-looking arms without extra geometry or batches.
export function chroniclesMarshDeadTreeLayout(wx, wz, x, y, k = 0) {
  const s = 0.9 + noise(x, y, k + 41) * 0.5;
  const ox = (noise(x, y, k + 43) - 0.5) * 2;
  const oz = (noise(y, x, k + 45) - 0.5) * 2;
  const yaw = noise(x, y, k + 47) * 6.28;
  const trunk = { position: [wx + ox, 2 * s, wz + oz],
    transform: { yaw, tilt: 0.06, scale: [s, 4 * s, s] } };
  const trunkRotation = new THREE.Euler(0.06, yaw, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const branches = [0, 1].map(index => {
    const t = index === 0 ? 0.61 + noise(x, y, k + 71) * 0.09
      : 0.79 + noise(x, y, k + 72) * 0.08;
    const root = new THREE.Vector3(0.075 * t * s, (t - 0.5) * 4 * s, -0.045 * t * s)
      .applyEuler(trunkRotation).add(new THREE.Vector3(...trunk.position));
    const azimuth = yaw + index * Math.PI + (noise(x, y, k + 73 + index) - 0.5) * 0.90;
    const lift = 0.32 + noise(x, y, k + 75 + index) * 0.43;
    const direction = new THREE.Vector3(Math.cos(azimuth), lift, Math.sin(azimuth)).normalize();
    const length = (index === 0 ? 1.35 : 0.95) * s
      + noise(x, y, k + 77 + index) * 0.30 * s;
    const girth = (index === 0 ? 0.48 : 0.36) * s;
    const rotation = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(up, direction));
    return {
      position: root.clone().addScaledVector(direction, length / 2).toArray(),
      transform: { tilt: rotation.x, yaw: rotation.y, roll: rotation.z,
        scale: [girth, length, girth] },
      root: root.toArray(),
    };
  });
  return [trunk, ...branches];
}

function deadTree(p, wx, wz, x, y, k) {
  for (const { position, transform } of chroniclesMarshDeadTreeLayout(wx, wz, x, y, k)) {
    p.add('deadTrunk', position, transform);
  }
}

function reeds(p, wx, wz, x, y, k, count = 7, coastal = false) {
  // Clump centre stays well inside the cell so no reed leans onto a path.
  const cx = wx + (noise(x, y, k + 51) - 0.5) * 1.6;
  const cz = wz + (noise(y, x, k + 53) - 0.5) * 1.6;
  for (let r = 0; r < count; r += 1) {
    const h = coastal ? 0.55 + noise(x + r, y, k + 55) * 0.85
      : 1.1 + noise(x + r, y, k + 55) * 0.9;
    p.add('reed', [cx + (noise(x, y + r, k) - 0.5) * 0.8, h / 2, cz + (noise(y, x + r, k) - 0.5) * 0.8], {
      tilt: (noise(x, r, k + 57) - 0.5) * 0.3,
      roll: (noise(r, y, k + 59) - 0.5) * 0.3,
      yaw: coastal ? 0.65 + (noise(x + r, y, k + 81) - 0.5) * 0.75 : 0,
      scale: coastal ? [1.35 + noise(x, y + r, k + 83) * 0.65, h, 1] : [1, h, 1],
    });
  }
}

// Outer volcanic formations form coherent raised shoulders and valleys.
// Adjacent rings use the same side axis so they don't fill every saddle.
// No change to authored cells, the first decorative ring or footprint.
export function chroniclesVolcanicSkylineRise({ grid = [], x, y, ringDepth } = {}) {
  if (!Number.isInteger(ringDepth) || ringDepth < 2 || ringDepth > TERRA_SCENERY_MARGIN
    || !Number.isInteger(x) || !Number.isInteger(y)) return 1;
  const width = grid[0]?.length || 0, height = grid.length;
  if (!width || !height) return 1;
  const ring = Math.max(0, -x, x - width + 1, -y, y - height + 1);
  if (ring !== ringDepth) return 1;
  const edge = chroniclesHighlandBackdropSaddle({ grid, x, y, ringDepth });
  return THREE.MathUtils.clamp((ringDepth === 3 ? 1.83 : 1.55) * edge, 1, 2.25);
}

// Distant coastal dune fields form broad wind-shaped crests. Only the
// outer decorative rings change; all authored dunes and the near ring
// retain their original transforms. The original shared sand mesh remains.
export function chroniclesCoastalDuneRise({ grid = [], x, y, ringDepth } = {}) {
  if (!Number.isInteger(ringDepth) || ringDepth < 2 || ringDepth > TERRA_SCENERY_MARGIN
      || !Number.isInteger(x) || !Number.isInteger(y)) return 1;
  const width = grid[0]?.length || 0, height = grid.length;
  if (!width || !height) return 1;
  if (Math.max(0, -x, x - width + 1, -y, y - height + 1) !== ringDepth) return 1;
  const shoulder = chroniclesHighlandBackdropSaddle({ grid, x, y, ringDepth });
  return 1 + (ringDepth === 3 ? 1.50 : 1.05)
    * THREE.MathUtils.smoothstep(shoulder, 0.60, 1.25);
}

function basalt(p, wx, wz, x, y, k, rise = 1) {
  const columns = 3 + Math.floor(noise(x, y, k + 61) * 3);
  for (let c = 0; c < columns; c += 1) {
    const h = (1.2 + noise(x + c, y, k + 63) * 3.2) * rise;
    const a = (c / columns) * 6.28 + noise(x, y, k) * 3;
    const r = c === 0 ? 0 : 0.85;
    p.add('basalt', [wx + Math.cos(a) * r, h / 2, wz + Math.sin(a) * r], { yaw: noise(x, y, c) * 1.0, tilt: (noise(x, c, 65) - 0.5) * 0.25, scale: [1.2, h, 1.2] });
  }
}

/**
 * Banner Road only: a broad, overlapping height rhythm for distant treetops.
 * Vary size across neighboring cells as well as ring depth, replacing a
 * nearly level line of crowns without spawning more trees or moving roots.
 * Every instance still uses the existing shared trunk/crown meshes.
 */
// Native Terra's un-authored forest edge used the exact same tree size
// on almost every blocked cell. Modulate *existing* trunks/crowns with a
// broad spatial rhythm, rather than introducing new trees or sky geometry.
// The same function applies at mobile/desktop and is stable after reload.
export function chroniclesTerraWoodlineScale(x, y, ringDepth = 0) {
  const depth = Math.max(0, Math.min(3, ringDepth));
  const canopyWave = 0.24 * Math.sin(x * 0.43 + y * 0.16)
    + 0.16 * Math.cos(x * 0.19 - y * 0.31);
  const individual = (noise(x, y, 767) - 0.5) * 0.11;
  return THREE.MathUtils.clamp(1.05 + depth * 0.055 + canopyWave + individual,
    0.70, 1.65);
}

export function chroniclesBannerRoadBackdropScale(x, y, ringDepth) {
  const ridge = Math.sin(x * 0.39 + y * 0.17)
    * Math.cos(y * 0.30 - x * 0.13);
  return 1.07 + 0.063 * ringDepth + 0.19 * ridge
    + (noise(x, y, 765) - 0.5) * 0.115;
}

/**
 * The authored narrow gateway has four nearby, already-blocked forest roots
 * which used to be saplings or empty gaps. Raise only those real '#' roots
 * into staggered midsize woodland trees, keeping the existing entrance pair
 * as the tallest landmark. No trees or collision changes on walkable cells.
 * Derive the row from the two blocking flanks, never from a hardcoded y.
 */
export function chroniclesBannerRoadGatewayGrove(grid, center, x, y) {
  const dx = Math.abs(x - center.x);
  return dx >= 2 && dx <= 4 && grid[y]?.[x] === '#'
    && grid[y]?.[center.x] === '.'
    && grid[y]?.[center.x - 1] === '#'
    && grid[y]?.[center.x + 1] === '#'
    && grid[y - 1]?.[center.x] === '.'
    && grid[y + 1]?.[center.x] === '.';
}

/**
 * V60: close occasional empty woodland silhouettes from mobile eye-level
 * without filling every gap with a rock or planting on authored walkable
 * cells. Look inward from the SECOND, non-colliding scenery ring and require
 * two consecutive missing mature canopies: the authored blocked forest root
 * and its first exterior neighbour. A chance from the immutable 4x4 habitat
 * recipe permits only scattered repairs, rather than a uniform crown fence.
 *
 * A gap in a forest is not a rendering error by itself: retain plenty of
 * natural openings. Desktop, map interiors, corners and other biomes keep
 * their previous instance population.
 */
export function chroniclesTerraWoodlandCanopyGapAt({
  grid = [], x, y, ringDepth, coarsePointer = false, tile = null,
} = {}) {
  if (!coarsePointer || ringDepth !== 2 || tile?.family !== 'backdrop'
      || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return false;
  const width = grid[0]?.length || 0;
  const height = grid.length;
  if (!width || !height) return false;
  let edgeX, edgeY, nearX, nearY;
  if (x === -2 && y >= 0 && y < height) {
    edgeX = 0; edgeY = y; nearX = -1; nearY = y;
  } else if (x === width + 1 && y >= 0 && y < height) {
    edgeX = width - 1; edgeY = y; nearX = width; nearY = y;
  } else if (y === -2 && x >= 0 && x < width) {
    edgeX = x; edgeY = 0; nearX = x; nearY = -1;
  } else if (y === height + 1 && x >= 0 && x < width) {
    edgeX = x; edgeY = height - 1; nearX = x; nearY = height;
  } else return false;
  if (grid[edgeY]?.[edgeX] !== '#') return false;
  // An authored mature tree, or an unculled mature first-ring tree, already
  // covers the horizon. Do not add overlapping crowns just for density.
  const firstRingHasTree = noise(nearX, nearY, 99) >= 0.45
    && noise(nearX, nearY, 1) < 0.5;
  return noise(edgeX, edgeY, 1) >= 0.5 && !firstRingHasTree
    && noise(x, y, 1) >= 0.5
    && noise(x, y, 1175) > 1 - tile.canopyGapChance;
}

const DRESS = {
  plains(p, wx, wz, x, y, big, bannerRoad = false, ringDepth = 0,
    woodlandGateway = false, gatewayGrove = false, tile = null, naturalWoodline = false,
    _naturalHighlands = false, coarsePointer = false, grid = []) {
    const roll = noise(x, y, 1);
    // A deepening forest horizon outside the authored map: the first row
    // still has gaps, but more distant rows interlock their crowns. Only the
    // Banner Road outer ring changes, not playable cells or other maps.
    const backdrop = bannerRoad && big && ringDepth > 0;
    const canopyThreshold = backdrop ? 0.58 + 0.075 * ringDepth : 0.5;
    // Genuine juvenile trees break the one-height canopy silhouette using
    // the EXISTING broadleaf trunk + crown batches. They still only occupy
    // blocked forest cells; no newly impassable path or invisible obstacle.
    const juvenile = bannerRoad && !big && !woodlandGateway && noise(x, y, 751) > 0.52;
    // Two already-blocked forest cells flank the real north/south cart
    // track at its first woodland opening. Give them mature, elevated
    // crowns instead of a missing tree and a tiny sapling. Roots remain
    // on the original '#' tiles: only their high leaf canopy overhangs
    // the walkable road, with no new collider or change to map topology.
    // The existing mature tree on the eastern end of C3's cart track
    // becomes a recognizable landmark. Do not introduce a new tree or
    // change the authored gateway. Require the real blocked end and its
    // adjacent walkable approach; an altered map falls back to normal.
    const easternOak = bannerRoad && !big && x === 20 && y === 7
      && grid[y]?.[x] === '#' && grid[y]?.[x - 1] === '.'
      && grid[y]?.length === 21 && grid.length === 15;
    const size = easternOak ? 1.32
      : woodlandGateway ? 1.6 + noise(x, y, 845) * 0.12
      : gatewayGrove ? 1.10 + noise(x, y, 855) * 0.16
        : juvenile ? 0.48 + noise(x, y, 753) * 0.16
          : backdrop ? chroniclesBannerRoadBackdropScale(x, y, ringDepth)
            : naturalWoodline ? chroniclesTerraWoodlineScale(x, y, ringDepth)
              : (big ? 1.15 : 1);
    // The mid-height approach grove is anchored exclusively in four real
    // blocked cells, never inside the walkable meadow or on the cart track.
    if (woodlandGateway || gatewayGrove || roll < canopyThreshold) {
      broadleaf(p, wx, wz, x, y, 0, size, bannerRoad, woodlandGateway, backdrop);
    }
    // Only native Terra's NON-COLLIDING outer ring receives an alternate
    // undergrowth scale. Reuse the existing bush instances and materials:
    // forest trunks, authored blocked roots and walkable routes are unchanged.
    const woodlandBackdrop = naturalWoodline && tile?.family === 'backdrop' ? tile : null;
    const canopyBridge = woodlandBackdrop && chroniclesTerraWoodlandCanopyGapAt({
      grid, x, y, ringDepth, coarsePointer, tile: woodlandBackdrop,
    });
    if (canopyBridge) {
      // The second-ring root stands two cells farther from the camera than
      // the authored border. A modest scale lift lets its leafy crown bridge
      // the skyline at eye-level without creating a level forest wall.
      // Still only the SAME shared trunk/crown instance batches.
      broadleaf(p, wx, wz, x, y, 0, size * 1.19);
    }
    // The v57 stone reduction revealed empty sightlines under the distant
    // canopy on mobile. Add a few existing broadleaf trunk/crown instances as
    // low coppice ONLY at coarse quality. Desktop retains its v57 canopy
    // counts and poses; don't accidentally change Banner Road comparisons.
    // Only the first two NON-COLLIDING exterior rings qualify: routes,
    // authored forest roots and the far third ring remain unchanged.
    if (coarsePointer && woodlandBackdrop && !canopyBridge
        && ringDepth <= 2 && roll >= canopyThreshold
        && noise(x, y, 961) < woodlandBackdrop.saplingChance) {
      const coppiceScale = woodlandBackdrop.saplingScale
        * (0.84 + noise(x, y, 963) * 0.24);
      broadleaf(p, wx, wz, x, y, 17, coppiceScale);
    }
    if (roll >= 0.35) {
      const shrubScale = woodlandBackdrop?.shrubScale ?? 1;
      p.add('bush', [wx + (noise(x, y, 2) - 0.5) * 2.4, 0.55, wz + (noise(y, x, 2) - 0.5) * 2.4],
        { yaw: noise(x, y, 3) * 6.28,
          scale: [(1.14 + noise(x, y, 5) * 0.34) * shrubScale,
            (0.65 + noise(x, y, 6) * 0.28) * shrubScale,
            (0.94 + noise(x, y, 7) * 0.36) * shrubScale] });
    }
    // Reusable native-Terra forest/verge recipe: retain a strict subset of
    // the old rubble on actual blocked meadow borders, and fill some gaps
    // with low, batched undergrowth. Never affect authored Banner Road,
    // non-Terra plains, the walkable grid, or the far forest ring.
    const woodlandVerge = naturalWoodline && tile?.family === 'verge' ? tile : null;
    if (woodlandVerge) {
      if (noise(x, y, 881) < woodlandVerge.shrubChance) {
        p.add('bush', [
          wx + (noise(x, y, 883) - 0.5) * 1.12, 0.43,
          wz + (noise(y, x, 887) - 0.5) * 1.12,
        ], {
          yaw: noise(x, y, 889) * Math.PI * 2,
          scale: [0.78 + noise(x, y, 891) * 0.15,
            0.60 + noise(x, y, 893) * 0.17,
            0.78 + noise(y, x, 895) * 0.15],
        });
      }
    }
    // Deep rock rows are caused by the outer ring's old ~70% probability,
    // not by actual rocks beside walkable paths. Native woodland backdrop
    // tiles now leave connected visual gaps and smaller, scattered stones.
    // C3 previously placed a rock in EVERY surviving exterior cell.
    // Leave the authored interior untouched; thin only its decorative
    // outer ring with a correlated density field and lower the remaining
    // stones into the existing ground. No new geometry or draw batches.
    const bannerRock = backdrop;
    const rockVisible = bannerRock
      ? noise(x, y, 1571) < 0.38 + 0.10 * Math.sin(x * 0.41 + y * 0.27)
        * Math.cos(y * 0.35 - x * 0.14)
      : woodlandBackdrop
        ? noise(x, y, 927) < woodlandBackdrop.rockChance
        : woodlandVerge
          ? roll >= 0.7 && noise(x, y, 905) < woodlandVerge.rockRetention
          : roll >= 0.7 || (big && (!naturalWoodline || noise(x, y, 847) > 0.30));
    if (rockVisible) {
      boulders(p, wx, wz, x, y, {
        count: 1,
        size: bannerRock ? 0.72 + 0.20 * noise(x, y, 1573) : (woodlandBackdrop?.rockScale ?? 1),
        height: bannerRock ? 0.66 + 0.18 * noise(x, y, 1575) : 1,
      });
    }
    if (roll < 0.2) {
      broadleaf(p, wx, wz, x, y, 9,
        naturalWoodline ? size * 0.86 : (big ? 1.1 : 0.9), bannerRoad);
    }
  },
  hills(p, wx, wz, x, y, big, _banner, ringDepth, _gateway, _grove,
    tileRecipe, _naturalWoodline, naturalHighlands = false,
    _coarsePointer = false, grid = [], brezalBackdrop = false) {
    // Reuse EXACTLY the same topology-aware per-blocked-cell recipes.
    // Natural Terra E2-style interiors and NON-COLLIDING outer rings now
    // form coherent crests and saddles, rather than a ruler-flat stone row.
    // Verges beside actual walkable ground, B2 heath and other biomes are
    // deliberately unchanged. No new meshes, instances or grid blockers.
    if (!tileRecipe) return;
    const ridge = naturalHighlands
      ? chroniclesHighlandRidgeProfile(x, y, tileRecipe.family) : 1;
    // V61: the old independent cell-height profile made different outer
    // rings fill one another's saddles, creating a long uniform rock wall
    // from the new lateral E2 camera. One smooth contour follows the same
    // coastline-like axis through all three *non-colliding* scenery rings.
    // All real blocked border/verge roots retain their earlier transforms.
    const saddle = naturalHighlands && tileRecipe.family === 'backdrop'
      ? chroniclesHighlandBackdropSaddle({ grid, x, y, ringDepth }) : 1;
    // Preserve the shared saddle and footprint, but let the farther rings
    // recede vertically instead of filling every opening in the near ridge.
    // The first ring and all authored cells retain their original heights.
    const horizonDepth = naturalHighlands && tileRecipe.family === 'backdrop'
      ? (ringDepth === 3 ? 0.78 : ringDepth === 2 ? 0.90 : 1) : 1;
    // Selectively raise distant crag crests, not the continuous boulder
    // bank. Valleys remain at their existing low profile and the first
    // ring stays unchanged, avoiding a solid wall at the player's eye.
    const distantSummit = naturalHighlands && tileRecipe.family === 'backdrop' && ringDepth >= 2
      ? 1 + (ringDepth === 3 ? 1.25 : 0.80) * THREE.MathUtils.smoothstep(saddle, 0.72, 1.22)
      : 1;
    const ridgeFoot = 1 + (ridge - 1) * (tileRecipe.family === 'backdrop' ? 0.68 : 0.50);
    const ridgeRise = 1 + (ridge - 1) * (tileRecipe.family === 'backdrop' ? 0.58 : 0.36);
    // V64: B2's only overgrown layer was the three rings OUTSIDE the
    // collision grid. Preserve every real map-border/verge rock unchanged.
    const heathRelief = brezalBackdrop && tileRecipe.family === 'backdrop'
      ? chroniclesBrezalOuterRelief({ grid, x, y, ringDepth }) : 1;
    const heathVerge = brezalBackdrop && tileRecipe.family === 'verge'
      ? chroniclesBrezalVergeRelief({ grid, x, y }) : 1;
    boulders(p, wx, wz, x, y, {
      count: tileRecipe.boulderCount,
      size: tileRecipe.boulderSize * ridgeFoot * saddle * heathRelief * heathVerge,
      height: 1.05 * ridgeRise * horizonDepth,
    });
    if (noise(x, y, 4) < tileRecipe.cragChance) {
      // Depth shifts stay well within the originally blocked 4m cell.
      // Slight lean reads as erosion, not a row of identical pyramids.
      const stagger = naturalHighlands && tileRecipe.family === 'backdrop' ? 1 : 0;
      p.add('crag', [
        wx + (noise(x, y, 5) - 0.5) * (0.48 + stagger * 0.68), 0,
        wz + (noise(y, x, 5) - 0.5) * (0.48 + stagger * 0.94),
      ], {
        yaw: noise(x, y, 6) * 6.28,
        tilt: stagger * (noise(x, y, 902) - 0.5) * 0.13,
        roll: stagger * (noise(x, y, 903) - 0.5) * 0.12,
        scale: [(0.90 + noise(x, y, 9) * 0.20) * (1 + (ridge - 1) * 0.14),
          ((big ? 2.50 : 1.90) + noise(x, y, 8) * 0.52) * ridge * saddle * heathRelief * horizonDepth * distantSummit,
          (0.87 + noise(x, y, 10) * 0.25) * (1 + (ridge - 1) * 0.11)],
      });
    }
    if (noise(x, y, 7) < tileRecipe.bushChance) {
      p.add('bush', [
        wx + (noise(x, y, 11) - 0.5) * 1.2, 0.42,
        wz + (noise(y, x, 12) - 0.5) * 1.2,
      ], { yaw: noise(x, y, 13) * 6.28, scale: [0.92, 0.65, 0.90] });
    }
  },
  snow(p, wx, wz, x, y, big) {
    if (noise(x, y, 1) < 0.62) {
      pine(p, wx, wz, x, y, 0, { snowy: true, scale: big ? 1.15 : 1 });
      if (noise(x, y, 2) < 0.35) pine(p, wx, wz, x, y, 5, { snowy: true, scale: 0.8 });
    } else {
      boulders(p, wx, wz, x, y, { part: 'boulderSnow', count: 2, size: 1.3 });
    }
  },
  coast(p, wx, wz, x, y, big, _denseMeadow, ringDepth,
    _gateway, _grove, _tileRecipe, _woodline, _highlands, _coarsePointer, grid) {
    const roll = noise(x, y, 1);
    if (roll < 0.45) {
      const rise = chroniclesCoastalDuneRise({ grid, x, y, ringDepth });
      p.add('dune', [wx + (noise(x, y, 2) - 0.5), 0.2, wz + (noise(y, x, 2) - 0.5)], {
        yaw: noise(x, y, 3) * 6.28,
        scale: [2.2, (1.0 + noise(x, y, 4) * 0.6) * rise, 1.7],
      });
      reeds(p, wx, wz, x, y, 0, 4, true);
    }
    if (roll >= 0.3) boulders(p, wx, wz, x, y, {
      part: 'boulderDark', count: big ? 3 : 2, size: 1.25,
      height: chroniclesCoastalOutcropHeight(x, y),
    });
    if (roll > 0.85) p.add('drift', [wx, 0.2, wz], { yaw: noise(x, y, 5) * 6.28, roll: Math.PI / 2, scale: [1, 2.6, 1] });
  },
  marsh(p, wx, wz, x, y, big) {
    const roll = noise(x, y, 1);
    if (roll < 0.4) {
      p.add('pool', [wx, 0.02, wz], { scale: [1.75, 1, 1.75] });
      reeds(p, wx, wz, x, y, 0, 6);
      reeds(p, wx, wz, x, y, 3, 5);
    } else if (roll < 0.7) {
      deadTree(p, wx, wz, x, y, 0);
      reeds(p, wx, wz, x, y, 2, 6);
    } else {
      p.add('bush', [wx, 0.6, wz], { yaw: noise(x, y, 3) * 6.28, scale: [1.6, 0.9, 1.4] });
      reeds(p, wx, wz, x, y, 4, 8);
      if (big) deadTree(p, wx, wz, x, y, 6);
    }
  },
  ash(p, wx, wz, x, y, big, _denseMeadow, ringDepth,
    _gateway, _grove, _tileRecipe, _woodline, _highlands, _coarsePointer, grid) {
    if (noise(x, y, 1) < 0.55) basalt(p, wx, wz, x, y, 0,
      chroniclesVolcanicSkylineRise({ grid, x, y, ringDepth }));
    else boulders(p, wx, wz, x, y, { part: noise(x, y, 2) < 0.4 ? 'emberRock' : 'boulderDark', count: 2, size: big ? 1.5 : 1.3 });
  },
};

// B2 only: heather follows the boundary from the SOLID side of a rock tile.
// Even its outermost flower stays within the 4m blocking cell. This creates
// recognizable purple heath along natural passages without covering foes or
// silently changing the collision/road grid. No per-frame random placement.
function addBrezalHeather(p, grid, x, y, wx, wz, coarsePointer) {
  const openSide = [
    { dx: 0, dy: -1 }, { dx: 1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
  ].find(({ dx, dy }) => grid[y + dy]?.[x + dx] === '.');
  if (!openSide || noise(x, y, 133) < (coarsePointer ? 0.67 : 0.31)) return;
  const size = 0.83 + noise(x, y, 137) * 0.29;
  p.add('heather', [wx + openSide.dx * 1.27, 0, wz + openSide.dy * 1.27], {
    yaw: noise(x, y, 139) * Math.PI * 2,
    scale: [size, size, size],
  });
}

// B2 v65: the original lilac heather lives ONLY on blocked rock verges,
// leaving an empty green/brown floor from the real (7,8) first-person eye.
// Add scattered knee-low patches on eligible walkable foothill cells,
// reusing the existing vertex-coloured, single-batch heather geometry.
// Never touch protected road/content cells (filtered by the caller), grids,
// physics, rocks or the old border heather positions. Mobile is a strict
// deterministic subset of desktop, with one small cluster per chosen cell.
function addBrezalLowHeather(p, wx, wz, x, y, recipe, coarsePointer) {
  if (!recipe) return;
  const coverage = recipe.family === 'rockline' ? 0.61 : 0.40;
  if (noise(x, y, 1491) >= coverage * (coarsePointer ? 0.66 : 1)) return;
  const ox = (noise(x, y, 1493) - 0.5) * 1.72;
  const oz = (noise(y, x, 1495) - 0.5) * 1.72;
  // Keep the v65 distribution exactly, but flatten the actual silhouette:
  // this dedicated rosette geometry grows sideways, not into seven cones.
  const height = 1.05 + noise(x, y, 1497) * 0.18;
  const spread = 0.94 + noise(x, y, 1499) * 0.16;
  p.add('heatherGroundcover', [wx + ox, 0.012, wz + oz], {
    yaw: noise(x, y, 1501) * Math.PI * 2,
    scale: [spread, height, spread * 0.96],
  });
  // Desktop sometimes receives a small satellite at a separated sub-cell
  // location; no second mesh or draw call, no tall plant over a pathway.
  if (!coarsePointer && noise(x, y, 1503) < 0.28) {
    const angle = noise(x, y, 1505) * Math.PI * 2;
    p.add('heatherGroundcover', [
      wx + Math.cos(angle) * 1.06, 0.012,
      wz + Math.sin(angle) * 1.06,
    ], {
      yaw: angle + 0.42,
      scale: [0.72, 0.92, 0.70],
    });
  }
}


// Allocate the original flower budget separately for path-adjacent and
// open meadow cells. Correlated habitat scores form connected colonies
// rather than isolated random stamps, while retaining the old population.
export function chroniclesBannerRoadFlowerCells(grid, clear = new Set()) {
  const groups = [[], []];
  const budget = [0, 0];
  grid.forEach((row, y) => [...row].forEach((tile, x) => {
    const key = x + ',' + y;
    if (tile !== '.' || clear.has(key)) return;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([dx, dy]) => clear.has((x + dx) + ',' + (y + dy)));
    const group = near ? 1 : 0;
    if (noise(x, y, 423) > (near ? 0.48 : 0.72)) budget[group]++;
    const score = 0.48 * Math.sin(x * 0.71 + y * 0.37)
      + 0.35 * Math.cos(y * 0.81 - x * 0.27)
      + 0.17 * (noise(x, y, 1581) - 0.5);
    groups[group].push({ key, score, x, y });
  }));
  return new Set(groups.flatMap((cells, i) => cells
    .sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x)
    .slice(0, budget[i]).map(cell => cell.key)));
}

/**
 * Fill the 4m meadow cells with several staggered leaf clusters. Planting
 * everything at the tile centre looked like isolated green spikes; an
 * irregular 3x3 layout reads as contiguous grass in perspective.
 *
 * Every blade and flower stays within 1.7m of its own cell centre (4m cell),
 * including those beside the road. The authored grid, paving and interaction
 * clearances are unchanged. Mobile draws fewer patches with fewer blades.
 */
export function chroniclesBannerMeadowEdge(grid, x, y) {
  // Nearby authored tree roots pull the existing low grass toward the
  // woodline. Opposing forest edges cancel rather than favoring one axis.
  let vx = 0, vz = 0, total = 0, nearest = Infinity;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const d = Math.hypot(dx, dy);
      if (d === 0 || d > 2.25 || grid?.[y + dy]?.[x + dx] !== '#') continue;
      const weight = (1 - d / 2.5) ** 2;
      vx += dx / d * weight;
      vz += dy / d * weight;
      total += weight;
      nearest = Math.min(nearest, d);
    }
  }
  const influence = 1 - THREE.MathUtils.smoothstep(nearest, 1, 2.25);
  return {
    x: total ? vx / total * influence : 0,
    z: total ? vz / total * influence : 0,
    influence,
  };
}

function addBannerRoadMeadow(p, wx, wz, x, y, { coarsePointer = false, nearPath = false, flower = false, edge = null } = {}) {
  // Soft, several-cell patches leave short turf in open areas and fuller,
  // mixed sedges near the woodland. Never a uniform 7-tuft-per-tile stamp.
  // The total number of grass instances is not increased; each slot becomes
  // EITHER the original narrow grass OR the broader, lighter sedge.
  const meadowCover = THREE.MathUtils.clamp(
    0.50 + 0.34 * Math.sin(x * 0.59 + y * 0.33)
      * Math.cos(y * 0.46 - x * 0.25)
      + (noise(x, y, 727) - 0.5) * 0.24, 0, 1);
  const count = coarsePointer
    ? (meadowCover < 0.27 ? 1 : 2)
    : nearPath ? 4 + Math.floor(meadowCover * 5)
      : 2 + Math.floor(meadowCover * 5);
  const start = Math.floor(noise(x, y, 401) * 9);
  for (let i = 0; i < count; i += 1) {
    const slot = (start + i * 4) % 9;
    const col = slot % 3 - 1;
    const row = Math.floor(slot / 3) - 1;
    const rawX = col * 1.12 + (noise(x + i, y, 407) - 0.5) * 0.46;
    const rawZ = row * 1.12 + (noise(y + i, x, 409) - 0.5) * 0.46;
    const pull = (edge?.influence ?? 0) * 0.18;
    const ox = THREE.MathUtils.lerp(rawX, (edge?.x ?? 0) * 0.95, pull);
    const oz = THREE.MathUtils.lerp(rawZ, (edge?.z ?? 0) * 0.95, pull);
    const variety = noise(x + i * 3, y - i * 5, 733);
    const sedge = variety < (nearPath ? 0.40 : 0.31);
    const width = sedge
      ? 0.77 + noise(x, y + i, 413) * 0.38
      : 0.69 + noise(x, y + i, 413) * 0.58;
    // Broad, coherent patches of slightly elongated and nearly round
    // clumps break the repeated radial silhouette. Compress only one axis:
    // the original maximum footprint, root pull and height stay intact.
    const aspect = 0.76 + 0.24 * (0.65 * meadowCover
      + 0.35 * noise(x + i, y - i, 1631));
    p.add(sedge ? 'meadowSedge' : 'tuft', [wx + ox, 0.012, wz + oz], {
      yaw: noise(x + i, y, 419) * Math.PI * 2,
      scale: [width,
        (sedge ? 0.80 + noise(x, y + i, 421) * 0.22
          : 0.56 + noise(x, y + i, 421) * 0.65) * (1 + (edge?.influence ?? 0) * 0.12),
        width * aspect],
    });
  }
  if (!coarsePointer && flower) {
    // Wildflowers favor woodland margins and footpath-adjacent meadow,
    // but never grow in a tile reserved for paving or a quest interaction.
    const ox = (noise(x, y, 427) - 0.5) * 2.5;
    const oz = (noise(y, x, 429) - 0.5) * 2.5;
    p.add('flower', [wx + ox, 0.012, wz + oz], {
      yaw: noise(x, y, 431) * Math.PI * 2,
      scale: [0.8, 0.82 + noise(x, y, 433) * 0.3, 0.8],
    });
  }
}


/**
 * Understory belongs to blocked forest cells, not the paved path. Fronds
 * lean toward adjacent clearings but remain well within their 4m home cell.
 * The same deterministic seed produces the same scene after reloading.
 */

/**
 * Plant two heights of compound-leaf undergrowth near Banner Road's woodline.
 * A <0.55m herb can dress a walkable grass cell; taller ferns stay on the
 * already-blocked # forest cells. No new collision or path obstruction.
 * Deterministic patches create groups and clearings, not a uniform hedge.
 */
function addBannerRoadForestHerb(p, grid, x, y, wx, wz, coarsePointer, blocked, nearTrail = false) {
  const nearForest = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .some(([dx, dy]) => grid[y + dy]?.[x + dx] === '#');
  const patch = 0.5 + 0.5 * Math.sin(x * 0.47 + y * 0.27)
    * Math.cos(y * 0.43 - x * 0.22);
  // At the first unpaved roadside row, broad leaves fill the visual gap
  // between the dirt edge and distant tree line. On walkable grass they are
  // always knee-low and pass-through; forest/tree cells remain unchanged.
  const chance = blocked
    ? (coarsePointer ? 0.37 : 0.69)
    : nearTrail
      ? (coarsePointer ? 0.36 : 0.76) * (0.80 + patch * 0.20)
      : (nearForest ? (coarsePointer ? 0.35 : 0.68)
        : (coarsePointer ? 0.14 : 0.28)) * (0.72 + patch * 0.50);
  if (noise(x, y, 781) > chance) return;
  const trailOffsetX = nearTrail?.dx ? nearTrail.dx * 0.15 : 0;
  const trailOffsetZ = nearTrail?.dy ? nearTrail.dy * 0.15 : 0;
  const wxOffset = (noise(x, y, 783) - 0.5) * (nearTrail ? 0.72 : 1.08) + trailOffsetX;
  const wzOffset = (noise(y, x, 787) - 0.5) * (nearTrail ? 0.72 : 1.08) + trailOffsetZ;
  const spread = nearTrail ? 0.98 + noise(x, y, 789) * 0.22
    : 0.82 + noise(x, y, 789) * 0.32;
  p.add('forestHerb', [wx + wxOffset, 0.012, wz + wzOffset], {
    yaw: noise(x, y, 791) * Math.PI * 2,
    scale: [spread,
      blocked ? 0.99 + noise(x, y, 793) * 0.19
        : 0.56 + noise(x, y, 797) * 0.11,
      spread],
  });
}


/**
 * Soft woodland shrubs add a waist-high visual layer missing from Banner
 * Road's very open meadow. Isolated bushes occupy only unpaved, unreserved
 * walkable grass; denser thickets grow from the blocked forest side.
 *
 * Reuse the existing layered shrub InstancedMesh and material, so this adds
 * no draw calls, colliders, texture downloads, or animated objects. The
 * patch field creates broad gaps between natural groups rather than a
 * regular bush per tile. On walkable cells these are pass-through plants.
 */
function addBannerRoadShrubIslands(p, grid, x, y, wx, wz, coarsePointer, blocked, nearTrail = null) {
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const openings = directions.filter(([dx, dy]) => grid[y + dy]?.[x + dx] === '.');
  if (blocked && !openings.length) return;
  const nearForest = !blocked && directions
    .some(([dx, dy]) => grid[y + dy]?.[x + dx] === '#');
  const patch = 0.5 + 0.5 * Math.sin(x * 0.49 + y * 0.24)
    * Math.cos(y * 0.41 - x * 0.17);
  const chance = blocked
    ? (coarsePointer ? 0.17 + patch * 0.28 : 0.35 + patch * 0.43)
    : nearTrail
      // Reconnect the woodland margin with *broken*, knee-high leaf
      // drifts on the actual adjacent meadow cells. Before, the touch
      // view lost nearly all the undergrowth at ground level while the
      // desktop kept isolated round shrubs. Keep irregular seeded gaps.
      ? (coarsePointer ? 0.62 + patch * 0.30 : 0.65 + patch * 0.30)
      : (coarsePointer ? 0.06 + patch * 0.13 : 0.13 + patch * 0.29)
        * (nearForest ? 1.17 : 1);
  if (noise(x, y, 811) > chance) return;

  // Only an occasional extra leaf mass on desktop; no new mesh/material.
  const count = !coarsePointer && (nearTrail
    ? noise(x, y, 831) > 0.70
    : patch > 0.63 && noise(x, y, 831) > 0.38) ? 2 : 1;
  for (let i = 0; i < count; i += 1) {
    const [dx, dy] = blocked
      ? openings[(Math.floor(noise(x, y, 813) * openings.length) + i) % openings.length]
      : [0, 0];
    // Keep the whole leafy crown inside the originating 4m tile; no foliage
    // crossing onto the trail or neighboring authored interactions.
    const offsetX = dx * 0.48 + (nearTrail?.dx || 0) * 0.37
      + (noise(x + i * 3, y, 817) - 0.5) * 0.42;
    const offsetZ = dy * 0.48 + (nearTrail?.dy || 0) * 0.37
      + (noise(y + i * 3, x, 819) - 0.5) * 0.42;
    // Spread only the walkable roadside shrubs into low leafy thickets,
    // not spherical shrubs of identical height. The original compact
    // branch and all blocked-cell forest plants remain unchanged.
    // Offset stays within ~0.6m of the 4m cell centre; even with the
    // wider crown no mesh enters the neighbouring 2.64m dirt tread.
    const width = (0.61 + noise(x + i, y, 823) * 0.17)
      * (nearTrail ? 1.20 : 1);
    const depth = (0.60 + noise(y + i, x, 827) * 0.18)
      * (nearTrail ? 1.20 : 1);
    const height = ((blocked ? 0.77 : nearTrail ? 0.72 : 0.62)
      + noise(x + i * 2, y, 829) * (blocked ? 0.30 : nearTrail ? 0.20 : 0.23))
      * (nearTrail ? 0.86 : 1);
    // The low v74 leaf masses no longer reach the old spherical shrub
    // elevation. Sink their roots into the meadow instead of floating above it.
    p.add('bush', [wx + offsetX, blocked ? 0.42 : 0.34, wz + offsetZ], {
      yaw: noise(x + i, y, 833) * Math.PI * 2,
      scale: [width, height, depth],
    });
  }
}
/**
 * A second, lower woodland silhouette beneath Banner Road's mature trees.
 * Only authored blocked woodland cells separating two walkable rows qualify.
 * The actual gateway road and its two framing trunks remain unobstructed.
 * The sparse, correlated choices form short thickets, not a continuous wall.
 * No world-map/collision, shader or material changes.
 */
export function chroniclesBannerRoadWoodlineRoot(grid, center, x, y) {
  return grid[y]?.[x] === '#'
    && Math.abs(x - center.x) > 1
    && grid[y]?.[center.x] === '.'
    && grid[y]?.[center.x - 1] === '#'
    && grid[y]?.[center.x + 1] === '#'
    && grid[y - 1]?.[x] === '.'
    && grid[y + 1]?.[x] === '.'
    && noise(x, y, 911) > 0.25;
}

function addBannerRoadWoodlineThicket(p, grid, center, x, y, wx, wz) {
  if (!chroniclesBannerRoadWoodlineRoot(grid, center, x, y)) return;
  // Two overlapping but different-height silhouettes per real blocking root.
  // Reuse the existing shared bush InstancedMesh; ~16 low-poly instances,
  // including on touch. Both roots and both crowns stay wholly inside the
  // four-metre blocked cell with a visibly clear woodland entrance.
  for (let i = 0; i < 2; i += 1) {
    const offsetX = (noise(x + i * 3, y, 917) - 0.5) * 0.64;
    const offsetZ = (noise(y + i * 5, x, 919) - 0.5) * 0.52
      + (i ? 0.22 : -0.15);
    const width = 1.08 + noise(x + i, y, 921) * 0.17;
    const depth = 1.04 + noise(y + i, x, 923) * 0.17;
    const height = (i ? 1.50 : 1.83) + noise(x, y + i, 925) * 0.23;
    p.add('bush', [wx + offsetX, 0.80, wz + offsetZ], {
      yaw: noise(x + i, y, 927) * Math.PI * 2,
      scale: [width, height, depth],
    });
  }
}

/**
 * Banner Road's forest edge continues a few walkable cells into the meadow
 * as low, pass-through bracken, rather than ending at a wall of tree trunks.
 * Find the AUTHORED north/south entrance from the map, never a synthetic
 * collision row; keep both paved axes and all content clear.
 */
export function chroniclesBannerRoadBrackenCell(grid, center, x, y) {
  if (grid[y]?.[x] !== '.' || x === center.x || y === center.y
    || Math.abs(x - center.x) > 2) return false;
  const gatewayRow = grid.findIndex((row, rowY) =>
    row?.[center.x] === '.'
      && row?.[center.x - 1] === '#'
      && row?.[center.x + 1] === '#'
      && grid[rowY - 1]?.[center.x] === '.'
      && grid[rowY + 1]?.[center.x] === '.');
  const distance = y - gatewayRow;
  if (gatewayRow < 0 || distance < 2 || distance > 7) return false;
  const patch = 0.5 + 0.5 * Math.sin(x * 0.65 + y * 0.43)
    * Math.cos(y * 0.36 - x * 0.19);
  return noise(x, y, 941) < 0.48 + 0.26 * patch;
}

function addBannerRoadBrackenDrift(p, grid, center, x, y, wx, wz, coarsePointer) {
  if (!chroniclesBannerRoadBrackenCell(grid, center, x, y)) return;
  // Broad compound leaves read as a continuous low fern bed, not a line of
  // spherical bushes. All foliage stays below knee level and within its
  // original traversable grass cell. No new geometry/material/draw batch.
  for (let i = 0; i < (coarsePointer ? 3 : 4); i += 1) {
    const offsetX = (noise(x + i * 7, y, 943) - 0.5) * 0.92;
    const offsetZ = (noise(y + i * 3, x, 947) - 0.5) * 0.92;
    const width = 1.23 + noise(x + i, y, 949) * 0.11;
    const depth = 1.22 + noise(y + i, x, 951) * 0.12;
    p.add('forestHerb', [wx + offsetX, 0.012, wz + offsetZ], {
      yaw: noise(x + i, y, 953) * Math.PI * 2,
      scale: [width, 0.61 + noise(x, y + i, 955) * 0.07, depth],
    });
  }
}

function addBannerRoadUnderstory(p, grid, x, y, wx, wz, coarsePointer) {
  const openings = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .filter(([dx, dy]) => grid[y + dy]?.[x + dx] === '.');
  if (!openings.length && noise(x, y, 511) < 0.64) return;
  const count = coarsePointer ? 1 : openings.length ? 2 : 1;
  for (let i = 0; i < count; i += 1) {
    const [dx, dy] = openings.length
      ? openings[(Math.floor(noise(x, y, 517) * openings.length) + i) % openings.length]
      : [0, 0];
    const shiftX = (noise(x + i, y, 523) - 0.5) * 0.46;
    const shiftZ = (noise(y + i, x, 527) - 0.5) * 0.46;
    const s = 0.70 + noise(x, y + i, 529) * 0.31;
    p.add('woodlandFloor', [wx + dx * 0.75 + shiftX, 0.012,
      wz + dy * 0.75 + shiftZ], {
      yaw: noise(x + i, y, 531) * Math.PI * 2,
      scale: [s, 0.87 + noise(x, y + i, 533) * 0.27, s],
    });
  }
}


/**
 * Shallow stones/roots are biased towards forest margins and occasional
 * meadow clearings. Never plant over authored paving or reserved content.
 * Keep the entire <0.7m decoration footprint within its own 4m grass cell.
 */
function addBannerRoadMicrorelief(p, grid, x, y, wx, wz, coarsePointer) {
  const borders = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .filter(([dx, dy]) => grid[y + dy]?.[x + dx] === '#');
  const sample = noise(x, y, 559);
  if (sample < (borders.length
    ? (coarsePointer ? 0.50 : 0.24)
    : (coarsePointer ? 0.96 : 0.88))) return;
  const [dx, dy] = borders.length
    ? borders[Math.floor(noise(x, y, 563) * borders.length)] : [0, 0];
  const ox = dx * 0.60 + (noise(x, y, 567) - 0.5) * 0.65;
  const oz = dy * 0.60 + (noise(y, x, 569) - 0.5) * 0.65;
  const scale = 0.82 + noise(x, y, 571) * 0.27;
  p.add('microrelief', [wx + ox, 0.012, wz + oz], {
    // Local -X points to the thick end of the root. Aim it back towards
    // the selected adjacent blocked tree cell, with restrained variation.
    yaw: borders.length
      ? Math.atan2(dy, -dx) + (noise(x, y, 573) - 0.5) * 0.48
      : noise(x, y, 573) * Math.PI * 2,
    scale: [scale, 0.88 + noise(x, y, 577) * 0.2, scale],
  });
}


/**
 * Occasional fallen timber at forest margins; only blocked, authored woodland
 * cells receive it. The whole piece fits inside its 4m cell even after yaw
 * and scale. The road and the interaction grid remain completely untouched.
 */
function addBannerRoadFallenWood(p, grid, x, y, wx, wz, coarsePointer) {
  const pathEdge = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .some(([dx, dy]) => grid[y + dy]?.[x + dx] === '.');
  // Fallen timber must be rare, not another repeating forest tile stamp.
  // Prefer a few visible woodland margins and thin the mobile population.
  const threshold = coarsePointer
    ? (pathEdge ? 0.87 : 0.98)
    : (pathEdge ? 0.80 : 0.94);
  if (noise(x, y, 641) < threshold) return;
  const size = 0.90 + noise(x, y, 643) * 0.24;
  p.add('fallenWood', [
    wx + (noise(x, y, 647) - 0.5) * 0.72,
    0.012,
    wz + (noise(y, x, 649) - 0.5) * 0.72,
  ], {
    yaw: noise(x, y, 651) * Math.PI * 2,
    scale: [size, 0.90 + noise(x, y, 653) * 0.18, size],
  });
}

// Rookwood has a dedicated canopy renderer, so dress its actual blocked
// margins independently of the generic biome tree recipes.
function addRookwoodFallenWood(p, grid, x, y, wx, wz, coarsePointer) {
  const edges = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .filter(([dx, dy]) => grid[y + dy]?.[x + dx] === '.');
  if (!edges.length || noise(x, y, 1663) >= (coarsePointer ? 0.13 : 0.24)) return;
  const [dx, dy] = edges[Math.floor(noise(x, y, 1665) * edges.length)];
  const size = 1.12 + 0.28 * noise(x, y, 1667);
  const drift = (noise(x, y, 1669) - 0.5) * 0.32;
  // A log along the woodland edge leaves the adjacent walking lane clear.
  p.add('fallenWood', [wx + dx * 0.86 - dy * drift, 0.012,
    wz + dy * 0.86 + dx * drift], {
    yaw: (dx ? Math.PI / 2 : 0) + (noise(x, y, 1671) - 0.5) * 0.48,
    scale: [size, 0.87 + 0.18 * noise(x, y, 1673), size],
  });
}

const CLUTTER = {
  plains: (p, wx, wz, x, y) => {
    // Two short grass clusters in the same walkable cell give the field
    // actual depth. They stay under knee height and don't alter the grid.
    p.add('tuft', [wx, 0.012, wz], {
      yaw: noise(x, y, 70) * 6.28,
      scale: [1.15, 0.85 + noise(x, y, 73) * 0.50, 1.15],
    });
    if (noise(x, y, 72) > 0.22) {
      p.add('tuft', [wx + (noise(x, y, 74) - 0.5) * 0.35, 0.012,
        wz + (noise(y, x, 75) - 0.5) * 0.35], {
        yaw: noise(x, y, 76) * 6.28,
        scale: [0.82, 0.85 + noise(x, y, 77) * 0.50, 0.82],
      });
    }
    if (noise(x, y, 71) > 0.68) p.add('flower', [wx + 0.23, 0.1, wz + 0.16]);
  },
  forest: (p, wx, wz, x, y) => p.add('tuft', [wx, 0.012, wz], { yaw: noise(x, y, 70) * 6.28, scale: [1.2, 1.3, 1.2] }),
  hills: (p, wx, wz, x, y) => p.add('pebble', [wx, 0.1, wz], { yaw: noise(x, y, 70) * 6.28, scale: [1, 0.6, 1] }),
  snow: (p, wx, wz, x, y) => p.add('snowMound', [wx, 0, wz], { scale: [0.9 + noise(x, y, 70), 0.35, 0.8] }),
  coast: (p, wx, wz, x, y) => p.add('pebble', [wx, 0.08, wz], { yaw: noise(x, y, 70) * 6.28, scale: [0.8, 0.5, 0.8] }),
  marsh: (p, wx, wz, x, y) => p.add('tuft', [wx, 0.012, wz], { yaw: noise(x, y, 70) * 6.28, scale: [1, 1.4, 1] }),
  ash: (p, wx, wz, x, y) => p.add('ember', [wx, 0.03, wz], { yaw: noise(x, y, 70) * 6.28 }),
};


// Marsh groundcover follows damp blocked-cell margins, not uniformly
// scattered lawn. A bounded colony of low tufts leaves the central lane,
// reserved content, and authored collision grid untouched.
function addMarshVergeColony(p, grid, x, y, wx, wz, coarsePointer) {
  const edges = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .filter(([dx, dy]) => grid[y + dy]?.[x + dx] === '#');
  if (!edges.length) return;
  const wetness = 0.5 + 0.5 * Math.sin(x * 0.47 + y * 0.31)
    * Math.cos(y * 0.39 - x * 0.23);
  if (noise(x, y, 1711) >= (coarsePointer ? 0.55 : 0.85) * (0.55 + 0.45 * wetness)) return;
  const [dx, dy] = edges[Math.floor(noise(x, y, 1713) * edges.length)];
  const count = coarsePointer ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const drift = count === 1 ? 0 : (i ? 0.49 : -0.49);
    const spread = 0.94 + noise(x, y, 1715 + i) * 0.34;
    p.add('tuft', [wx + dx * 1.10 - dy * drift, 0.012,
      wz + dy * 1.10 + dx * drift], {
      yaw: noise(x, y, 1719 + i) * Math.PI * 2,
      scale: [spread, 0.90 + noise(x, y, 1721 + i) * 0.55, spread],
    });
  }
}

// Native Terra meadow communities share the existing grass, wildflower and
// woodland-herb geometry batches. Coverage follows coherent 3x3-cell habitat
// recipes while deterministic sub-cell offsets avoid a painted checkerboard.
// All plant tips stay below knee height; plants never become collision tiles.
function addReusableMeadowPatch(p, wx, wz, x, y, recipe, coarsePointer, woodlandVerge = null) {
  // The old density sampler could reject THREE consecutive meadow cells
  // in front of a real first-person camera (C4 x=7,y=2..4), leaving a vast,
  // bare plane despite hundreds of grass clumps elsewhere in the map.
  // Sparse fallback grass fills most accidental gaps; 8-16% of rejected
  // cells remain genuine clearings. It is never a collider or a new batch.
  if (!recipe) return;
  if (noise(x, y, 619) > recipe.coverage * (coarsePointer ? 0.93 : 1)) {
    if (noise(x, y, 697) >= (coarsePointer ? 0.84 : 0.92)) return;
    const angle = noise(x, y, 699) * Math.PI * 2;
    const reach = 0.84 + noise(y, x, 701) * 0.31;
    p.add('tuft', [
      wx + Math.cos(angle) * reach,
      0.012,
      wz + Math.sin(angle) * reach,
    ], {
      yaw: noise(x, y, 703) * Math.PI * 2,
      scale: coarsePointer ? [1.30, 1.22, 1.30] : [1.08, 1.08, 1.08],
    });
    return;
  }
  const ox = (noise(x, y, 623) - 0.5) * 1.32;
  const oz = (noise(y, x, 625) - 0.5) * 1.32;
  const grassScale = coarsePointer
    ? 1.25 + noise(x, y, 627) * 0.17
    : 0.87 + noise(x, y, 627) * 0.25;
  p.add('tuft', [wx + ox, 0.012, wz + oz], {
    yaw: noise(x, y, 629) * Math.PI * 2,
    scale: [grassScale, coarsePointer
      ? 1.15 + noise(x, y, 631) * 0.20
      : 0.73 + noise(x, y, 631) * 0.24,
      // Slightly elliptical primary clumps vary with the habitat recipe.
      // Satellite and fallback coverage, height and maximum radius stay.
      grassScale * (0.84 + 0.16 * (0.6 * recipe.coverage + 0.4 * noise(x, y, 1637)))],
  });
  // A second, slightly separated tuft improves ground cover without a
  // second draw call. Mobile takes a strict subset of desktop's tuft cells
  // and each clump stays inside its own original 4m walkable square.
  if (recipe.tufts > 1 && noise(x, y, 633) < (coarsePointer ? 0.62 : 0.72)) {
    const angle = noise(x, y, 635) * Math.PI * 2;
    const distance = 0.65 + noise(y, x, 637) * 0.20;
    p.add('tuft', [
      wx + ox * 0.25 + Math.cos(angle) * distance,
      0.012,
      wz + oz * 0.25 + Math.sin(angle) * distance,
    ], {
      yaw: noise(x, y, 639) * Math.PI * 2,
      scale: coarsePointer ? [1.02, 1.05, 1.02] : [0.72, 0.72, 0.72],
    });
  }
  // A meadow is a collection of small drifting colonies, not one clump
  // planted at the exact same cell centre. One additional satellite clump
  // reaches into the empty grassy foreground without introducing another
  // material/mesh. Keep its footprint entirely in this 4m walkable cell.
  const driftChance = recipe.tufts > 1
    ? (coarsePointer ? 0.75 : 0.87)
    : (coarsePointer ? 0.30 : 0.43);
  if (noise(x, y, 673) < driftChance) {
    const angle = noise(x, y, 675) * Math.PI * 2;
    const distance = 0.91 + noise(y, x, 677) * 0.29;
    p.add('tuft', [
      wx + Math.cos(angle) * distance,
      0.012,
      wz + Math.sin(angle) * distance,
    ], {
      yaw: noise(x, y, 679) * Math.PI * 2,
      scale: coarsePointer ? [1.18, 1.15, 1.18] : [0.96, 0.95, 0.96],
    });
  }
  // Reuse the authored microrelief geometry (half-buried stones, roots and
  // leaf litter) sparingly across native meadow patches. This adds one
  // shared opaque InstancedMesh batch at most, not per-cell meshes or actual
  // terrain elevation. All gameplay/navigation grids stay unchanged.
  if (noise(x, y, 681) < (recipe.family === 'edge' ? 0.47 : 0.32)) {
    p.add('microrelief', [
      wx + (noise(x, y, 683) - 0.5) * 1.48,
      0,
      wz + (noise(y, x, 685) - 0.5) * 1.48,
    ], {
      yaw: noise(x, y, 687) * Math.PI * 2,
      scale: [0.84 + noise(x, y, 689) * 0.21, 0.88, 0.84 + noise(x, y, 691) * 0.21],
    });
  }
  if (noise(x, y, 641) < recipe.flowerChance) {
    p.add('flower', [
      wx + (noise(x, y, 643) - 0.5) * 1.24,
      0.012,
      wz + (noise(y, x, 645) - 0.5) * 1.24,
    ], {
      yaw: noise(x, y, 647) * Math.PI * 2,
      scale: coarsePointer ? [1.10, 1.05, 1.10] : [0.82, 0.72, 0.82],
    });
  }
  if (noise(x, y, 649) < recipe.herbChance) {
    p.add('forestHerb', [
      wx + (noise(x, y, 651) - 0.5) * 1.05,
      0.012,
      wz + (noise(y, x, 653) - 0.5) * 1.05,
    ], {
      yaw: noise(x, y, 655) * Math.PI * 2,
      scale: coarsePointer ? [0.90, 0.65, 0.90] : [0.67, 0.48, 0.67],
    });
  }
  // Forest-understory ferns grow on the safe, traversable meadow side
  // of the boundary. The longstanding meadow geometry contract requires
  // every forestHerb root to be on '.' (and below knee height), not '#'.
  // Reuse the very same instanced forestHerb geometry, never a new mesh.
  if (woodlandVerge && recipe.family === 'edge'
      && noise(x, y, 907) < woodlandVerge.herbChance * (coarsePointer ? 0.65 : 1)) {
    p.add('forestHerb', [
      wx + (noise(x, y, 909) - 0.5) * 1.28, 0.012,
      wz + (noise(y, x, 911) - 0.5) * 1.28,
    ], {
      yaw: noise(x, y, 913) * Math.PI * 2,
      scale: coarsePointer ? [0.90, 0.65, 0.90] : [0.76, 0.48, 0.76],
    });
  }
}

// Piedmont transition: preserve the exact walkable grid but bring the
// foothill's gravel and short grass down to eye level. Shared existing
// pebble/tuft batches only; no rock wall/vegetation over a protected road.
function addReusableFoothillPatch(p, wx, wz, x, y, recipe, coarsePointer) {
  if (!recipe || noise(x, y, 821) > recipe.coverage * (coarsePointer ? 0.78 : 1)) return;
  if (noise(x, y, 823) < recipe.grassChance) {
    const offX = (noise(x, y, 825) - 0.5) * 1.24;
    const offZ = (noise(y, x, 827) - 0.5) * 1.24;
    p.add('tuft', [wx + offX, 0.012, wz + offZ], {
      yaw: noise(x, y, 829) * Math.PI * 2,
      scale: [0.85, 0.65 + noise(x, y, 831) * 0.19, 0.85],
    });
  }
  // One to three pebble fragments per chosen cell on desktop. Mobile keeps
  // only one fragment, reusing the same instanced mesh and material.
  const count = coarsePointer ? Math.min(recipe.pebbles, 1) : recipe.pebbles;
  for (let i = 0; i < count; i += 1) {
    const px = (noise(x + i * 7, y, 833) - 0.5) * 1.28;
    const pz = (noise(y + i * 5, x, 837) - 0.5) * 1.28;
    const size = 0.42 + noise(x, y + i, 839) * 0.28;
    p.add('pebble', [wx + px, 0.075, wz + pz], {
      yaw: noise(x, y + i, 841) * Math.PI * 2,
      scale: [size, 0.33 + noise(x, y + i, 843) * 0.19, size],
    });
  }
}

// ─── authored set pieces (terragen `scenery`) ─────────────────────────────

const SET_PIECES = {
  tent(p, wx, wz, x, y) {
    const yaw = noise(x, y, 81) * 6.28;
    p.add('tent', [wx, 1.3, wz], { yaw: yaw + Math.PI / 4, scale: [1, 1, 1] });
    p.add('pole', [wx, 1.45, wz], { scale: [1, 2.9, 1] });
  },
  campfire(p, wx, wz) {
    for (let k = 0; k < 7; k += 1) {
      const a = (k / 7) * 6.28;
      p.add('pebble', [wx + Math.cos(a) * 0.75, 0.12, wz + Math.sin(a) * 0.75], { yaw: a, scale: [1.1, 0.8, 1.1] });
    }
    p.add('log', [wx, 0.15, wz], { yaw: 0.4, roll: Math.PI / 2, scale: [1, 1.2, 1] });
    p.add('log', [wx, 0.2, wz], { yaw: 1.9, roll: Math.PI / 2, scale: [1, 1.2, 1] });
    p.add('flame', [wx, 0.6, wz]);
    p.add('flame', [wx + 0.2, 0.45, wz - 0.1], { yaw: 1, scale: [0.6, 0.7, 0.6] });
  },
  banner(p, wx, wz, x, y) {
    p.add('pole', [wx, 1.6, wz], { scale: [1, 3.2, 1] });
    p.add('banner', [wx + 0.45, 2.6, wz], { yaw: noise(x, y, 83) * 0.6, scale: [0.9, 1.2, 1] });
  },
  ruin(p, wx, wz, x, y, { weatheredTerraRuin = false } = {}) {
    for (let k = 0; k < 3; k += 1) {
      if (weatheredTerraRuin) {
        // Terra's four authored ruins share the same old 3.5m-high,
        // 0.55m-wide obelisk recipe. Keep all three stones on each existing
        // blocked root, but make the silhouette low collapsed masonry.
        // Reuse the previous v62 E2 geometry and existing boulder batch,
        // also for C4 meadow, A1 plain and B2 heath landmarks.
        const h = 0.90 + noise(x, y, 90 + k) * 0.65;
        const width = 0.67 + noise(x, y, 101 + k) * 0.15;
        p.add('boulder', [
          wx + (k - 1) * 0.90, h * 0.38,
          wz + (noise(x, y, 93 + k) - 0.5) * 0.65,
        ], {
          yaw: k * 0.4,
          tilt: (noise(x, y, 105 + k) - 0.5) * 0.12,
          scale: [width, h, width * (0.89 + noise(x, y, 109 + k) * 0.10)],
        });
      } else {
        // Non-Terra authored ruins stay unchanged.
        const h = 1 + noise(x, y, 90 + k) * 2.5;
        p.add('boulder', [wx + (k - 1) * 1.2, h / 2, wz + (noise(x, y, 93 + k) - 0.5)], { yaw: k * 0.4, scale: [0.55, h, 0.55] });
      }
    }
  },
};

/**
 * @param {object} plan  { grid, center, biome, scenery, coarsePointer }
 * @returns {THREE.Group} the dressing, or an empty group for unknown biomes
 */
export function buildTerraScenery({ grid = [], center, biome, mapId = null, scenery = [], coarsePointer = false, dressBlocked = true, keepClear = [], groundOffset = null, meadowHabitat = null }) {
  const group = new THREE.Group();
  group.name = 'chronicles-terra-scenery';
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const dress = DRESS[biome];
  const clutter = CLUTTER[biome];
  const p = createPlacer();
  const toWorld = (x, y) => [(x - center.x) * CELL, (y - center.y) * CELL];
  const clear = new Set(keepClear.map(({ x, y }) => x + ',' + y));
  const denseMeadow = mapId === 'banner-road-first-book' && biome === 'plains';
  const flowerCells = denseMeadow && !coarsePointer
    ? chroniclesBannerRoadFlowerCells(grid, clear) : null;
  const naturalWoodline = biome === 'plains' && typeof mapId === 'string'
    && mapId.startsWith('terra-');
  // Only native highlands receive skyline shaping. Special B2 heath,
  // non-Terra hills and all other maps retain the previous transforms.
  const naturalHighlands = biome === 'hills' && typeof mapId === 'string'
    && mapId.startsWith('terra-') && mapId !== 'terra-b2';
  const brezalBackdrop = biome === 'hills' && mapId === 'terra-b2';
  // Terra ruins occur in plains, heather hills and the snowy A1 glacier.
  // The v62 E2 exception left identical needle proportions in C4, A1 and
  // B2. Reuse the SAME bounded 3-stone dressing only at authored blocked
  // roots, without changing surrounding snow, rock or woodland recipes.
  const weatheredTerraRuin = typeof mapId === 'string'
    && mapId.startsWith('terra-')
    && (biome === 'hills' || biome === 'plains' || biome === 'snow');

  const authored = new Map((scenery || [])
    .filter((entry) => entry && Number.isInteger(entry.x) && Number.isInteger(entry.y) && SET_PIECES[entry.type])
    .map((entry) => [entry.x + ',' + entry.y, entry]));

  for (let y = -TERRA_SCENERY_MARGIN; y < height + TERRA_SCENERY_MARGIN; y += 1) {
    for (let x = -TERRA_SCENERY_MARGIN; x < width + TERRA_SCENERY_MARGIN; x += 1) {
      const inside = x >= 0 && y >= 0 && x < width && y < height;
      const tile = inside ? grid[y][x] : '#';
      const [wx, wz] = toWorld(x, y);
      const piece = authored.get(x + ',' + y);
      if (piece) {
        SET_PIECES[piece.type](p, wx, wz, x, y, {
          weatheredTerraRuin: weatheredTerraRuin && tile === '#',
        });
        continue;
      }
      if (tile === '#') {
        if (inside && dressBlocked && biome === 'forest'
            && mapId === 'rookwood-first-book' && !clear.has(x + ',' + y)) {
          addRookwoodFallenWood(p, grid, x, y, wx, wz, coarsePointer);
        }
        if (!dress || (!dressBlocked && inside)) continue;
        // Mobile keeps the far ring sparse; the playable edge is always full.
        if (!inside && coarsePointer && noise(x, y, 99) < 0.45) continue;
        // ringDepth = 1..3 beyond the collision grid. This dimension only
        // informs distant forest silhouettes, never passability or spawning.
        const ringDepth = inside ? 0 : Math.max(-x, x - width + 1, -y, y - height + 1);
        // A natural canopy gateway only where an ACTUAL blocked forest pair
        // flanks the authored north/south road and has grass on both sides.
        // Derive it from the saved grid; never hardcode a new collision tile.
        const woodlandGateway = denseMeadow && inside
          && Math.abs(x - center.x) === 1
          && grid[y]?.[center.x] === '.'
          && grid[y - 1]?.[x] === '.'
          && grid[y + 1]?.[x] === '.';
        const gatewayGrove = denseMeadow && inside && !woodlandGateway
          && chroniclesBannerRoadGatewayGrove(grid, center, x, y);
        const landscapeTile = biome === 'hills'
          ? chroniclesLandscapeTileAt({ grid, biome, x, y, outside: !inside })
          : naturalWoodline
            ? inside
              ? chroniclesWoodlandVergeTileAt({ grid, biome, x, y })
              : chroniclesWoodlandBackdropTileAt({ biome, x, y, ringDepth })
            : null;
        dress(p, wx, wz, x, y, !inside, denseMeadow, ringDepth,
          woodlandGateway, gatewayGrove, landscapeTile, naturalWoodline,
          naturalHighlands, coarsePointer, grid, brezalBackdrop);
        if (inside && denseMeadow) {
          addBannerRoadShrubIslands(p, grid, x, y, wx, wz, coarsePointer, true);
          addBannerRoadWoodlineThicket(p, grid, center, x, y, wx, wz);
          addBannerRoadForestHerb(p, grid, x, y, wx, wz, coarsePointer, true);
          addBannerRoadUnderstory(p, grid, x, y, wx, wz, coarsePointer);
          addBannerRoadFallenWood(p, grid, x, y, wx, wz, coarsePointer);
        }
        if (inside && biome === 'hills' && mapId === 'terra-b2') {
          addBrezalHeather(p, grid, x, y, wx, wz, coarsePointer);
        }
      } else if (clutter && !clear.has(x + ',' + y)) {
        // Rookwood's sparse generic grass is retained. Add fern colonies
        // only beside actual blocked forest roots, never on reserved content.
        // Offset toward the nearest root and keep the central lane readable.
        if (mapId === 'rookwood-first-book' && biome === 'forest' && tile === '.') {
          const edges = [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .filter(([dx, dy]) => grid[y + dy]?.[x + dx] === '#');
          // Exposed roots and half-buried stones on a subset of the forest
          // verge, oriented back toward the actual tree cell. Never add
          // these to the unbordered clearings or reserved content tiles.
          if (edges.length && noise(x, y, 1681) < (coarsePointer ? 0.23 : 0.43)) {
            const [dx, dy] = edges[Math.floor(noise(x, y, 1683) * edges.length)];
            const drift = (noise(x, y, 1685) - 0.5) * 0.42;
            const size = 0.83 + 0.19 * noise(x, y, 1687);
            p.add('microrelief', [wx + dx * 0.68 - dy * drift, 0.012,
              wz + dy * 0.68 + dx * drift], {
              yaw: Math.atan2(dy, -dx) + (noise(x, y, 1689) - 0.5) * 0.40,
              scale: [size, 0.86 + 0.16 * noise(x, y, 1691), size],
            });
          }
          const colony = 0.5 + 0.5 * Math.sin(x * 0.52 + y * 0.24)
            * Math.cos(y * 0.39 - x * 0.18);
          if (edges.length && noise(x, y, 1651) < (coarsePointer ? 0.46 : 0.76) * (0.55 + 0.45 * colony)) {
            const [dx, dy] = edges[Math.floor(noise(x, y, 1653) * edges.length)];
            const drift = (noise(x, y, 1655) - 0.5) * 0.48;
            const spread = 0.70 + 0.25 * noise(x, y, 1657);
            p.add('forestHerb', [wx + dx * 1.02 - dy * drift, 0.012,
              wz + dy * 1.02 + dx * drift], {
              yaw: noise(x, y, 1659) * Math.PI * 2,
              scale: [spread, 0.40 + 0.17 * noise(x, y, 1661), spread],
            });
          }
        }
        if (denseMeadow && tile === '.') {
          const nearPath = [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .some(([dx, dy]) => clear.has((x + dx) + ',' + (y + dy)));
          addBannerRoadMeadow(p, wx, wz, x, y, {
            coarsePointer, nearPath, flower: flowerCells?.has(x + ',' + y) ?? false,
            edge: chroniclesBannerMeadowEdge(grid, x, y),
          });
          // The canonical Banner Road paving follows the central axes even
          // when a direct scenery caller omits keepClear. Never put soft
          // shrubs on these authored road cells.
          const besideTrail = x !== center.x && y !== center.y
            ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
              .find(([dx, dy]) => (x + dx === center.x || y + dy === center.y)
                && clear.has((x + dx) + ',' + (y + dy)))
            : null;
          const trailSide = besideTrail ? { dx: besideTrail[0], dy: besideTrail[1] } : null;
          if (x !== center.x && y !== center.y) {
            addBannerRoadShrubIslands(p, grid, x, y, wx, wz, coarsePointer, false, trailSide);
          }
          addBannerRoadForestHerb(p, grid, x, y, wx, wz, coarsePointer, false, trailSide);
          addBannerRoadBrackenDrift(p, grid, center, x, y, wx, wz, coarsePointer);
          addBannerRoadMicrorelief(p, grid, x, y, wx, wz, coarsePointer);
        } else if (biome === 'plains' && tile === '.') {
          // The bespoke Banner Road meadow above is never decorated twice.
          // Other Terra grasslands gain habitat-based low plant clusters,
          // with all reserved road/content cells left fully clear.
          // Choose the adjoining authored forest root's 3x3 composition,
          // but place its extra low bracken on THIS walkable grass tile.
          const woodlandVerge = naturalWoodline
            ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
              .map(([dx, dy]) => chroniclesWoodlandVergeTileAt({
                grid, biome, x: x + dx, y: y + dy,
              })).find(Boolean) || null
            : null;
          addReusableMeadowPatch(p, wx, wz, x, y,
            chroniclesMeadowTileAt({ grid, biome, x, y }), coarsePointer, woodlandVerge);
        } else if (biome === 'hills' && tile === '.') {
          // Continuous low scree and grasses bridge the natural rock edges
          // and upland path cells, without changing traversal/collision.
          const foothill = chroniclesFoothillTileAt({ grid, biome, x, y });
          addReusableFoothillPatch(p, wx, wz, x, y, foothill, coarsePointer);
          if (mapId === 'terra-b2') {
            addBrezalLowHeather(p, wx, wz, x, y, foothill, coarsePointer);
          }
        } else if (biome === 'marsh' && /^terra-/.test(String(mapId || '')) && tile === '.') {
          if (x !== center.x && y !== center.y) {
            addMarshVergeColony(p, grid, x, y, wx, wz, coarsePointer);
          }
        } else if (!coarsePointer && noise(x, y, 77) < 0.28) {
          // Original sparse dressing on all other biomes and plains maps.
          clutter(p, wx + (noise(x, y, 78) - 0.5) * 3,
            wz + (noise(y, x, 79) - 0.5) * 3, x, y);
        }
      }
    }
  }

  if (mapId === 'terra-a2' && biome === 'coast' && width >= 9 && height >= 3) {
    // North cliff, fully in the decorative ring, independent of LOD thinning.
    const [wx, wz] = toWorld(Math.floor(width / 2), -2.5);
    p.add('coastalArch', [wx, 0, wz]);
  }
  const catalog = partCatalog(coarsePointer, biome, denseMeadow, naturalHighlands, brezalBackdrop);
  for (const [part, matrices] of p.parts) {
    const [geometry, mat] = mapId === 'rookwood-first-book' && biome === 'forest'
      && part === 'microrelief'
      ? [chroniclesMeadowMicroreliefGeometry({ coarsePointer, woodland: true }),
        lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })]
      : catalog[part]();
    const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
    matrices.forEach((matrix, index) => {
      if (groundOffset) {
        const e = matrix.elements;
        e[13] += groundOffset(e[12], e[14]);
      }
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Plains foliage no longer repeats a single near-black green ball: subtle
    // sunlit/sage/olive tints vary per persistent cell, using the same batch.
    if (biome === 'plains' && (part === 'crown' || part === 'bush')) {
      const paleLeaves = ['#cbdcbd', '#b8d2bc', '#dde3c1', '#c4d8b5']
        .map(hex => new THREE.Color(hex));
      const shades = (part === 'crown'
        ? ['#f3f4e8', '#e4eddc', '#ffffff', '#e8e9d2', '#dce9d9']
        : ['#f1f0df', '#dce8d4', '#ffffff', '#e8e9d9'])
        .map(hex => new THREE.Color(hex));
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const seed = noise(Math.round(e[12] * 8), Math.round(e[14] * 8),
          part === 'crown' ? 193 : 197);
        const gridX = Math.round(e[12] / CELL) + center.x;
        const gridY = Math.round(e[14] / CELL) + center.y;
        const pale = denseMeadow && part === 'crown'
          && grid[gridY]?.[gridX] === '#' && bannerRoadPaleTree(gridX, gridY);
        const palette = pale ? paleLeaves : shades;
        const tint = palette[Math.min(palette.length - 1, Math.floor(seed * palette.length))];
        // Distant C3 groves share a broad, deterministic pigment field
        // rather than unrelated tree-by-tree colour noise. Keep authored
        // trees (including the gateway and road-end oak) exactly as before.
        const outside = gridX < 0 || gridY < 0
          || gridX >= (grid[0]?.length ?? 0) || gridY >= grid.length;
        if (denseMeadow && part === 'crown' && outside) {
          const grove = 0.5 + 0.5 * Math.sin(gridX * 0.36 + gridY * 0.23)
            * Math.cos(gridY * 0.31 - gridX * 0.17);
          const target = new THREE.Color('#d3e2db').lerp(new THREE.Color('#f4e6c6'), grove);
          mesh.setColorAt(index, tint.clone().lerp(target, 0.48));
        } else {
          mesh.setColorAt(index, tint);
        }
      });
      mesh.instanceColor.needsUpdate = true;
    }
    // B2's original saturated green shrubs read as identical bright balls
    // against its dry olive heath. Weather the existing instances into a
    // restrained sage/ochre range, derived only from immutable world
    // transforms: same positions, silhouette, batching, materials and
    // deterministic palette after F5. No new draw calls or vegetation.
    // Saturated near-water scrub grades into muted distant marsh foliage.
    // A continuous seeded world field keeps adjacent bushes coherent,
    // with no new materials, texture samples or instanced draw batches.
    if (biome === 'marsh' && part === 'bush') {
      const wet = new THREE.Color('#94b1a0');
      const dry = new THREE.Color('#e2dfb9');
      const haze = new THREE.Color('#b9c5c0');
      const tint = new THREE.Color();
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const x = Math.round(e[12] / CELL) + center.x;
        const y = Math.round(e[14] / CELL) + center.y;
        const wetness = 0.5 + 0.5 * Math.sin(x * 0.35 + y * 0.28)
          * Math.cos(y * 0.43 - x * 0.19);
        const ring = Math.max(0, -x, x - width + 1, -y, y - grid.length + 1);
        const depth = ring >= 3 ? 0.55 : ring === 2 ? 0.30 : 0;
        mesh.setColorAt(index, tint.copy(dry).lerp(wet, wetness).lerp(haze, depth));
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (brezalBackdrop && part === 'bush') {
      const shades = ['#b9bda1', '#adb79b', '#c5b9a0', '#a4b39a', '#c5c2ab']
        .map(hex => new THREE.Color(hex));
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const seed = noise(Math.round(e[12] * 7), Math.round(e[14] * 7), 1663);
        mesh.setColorAt(index, shades[Math.min(shades.length - 1,
          Math.floor(seed * shades.length))]);
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (denseMeadow && part === 'broadleafTrunk') {
      // Reuse original bark texture and draw call; colour differentiates bark.
      const paleBark = new THREE.Color('#f2f2ea');
      const warmBark = new THREE.Color('#bba58b');
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const gridX = Math.round(e[12] / CELL) + center.x;
        const gridY = Math.round(e[14] / CELL) + center.y;
        mesh.setColorAt(index, grid[gridY]?.[gridX] === '#'
          && bannerRoadPaleTree(gridX, gridY) ? paleBark : warmBark);
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (denseMeadow && part === 'forestHerb') {
      // C3 woodline illumination, using ONLY existing fern instances and
      // their already-allocated instance colour attribute. A warmer fringe
      // beside the actual cart path fades into subdued green forest shade;
      // open meadow retains its original palette. Neither paths nor the
      // foliage geometry/placements are modified.
      const palettes = {
        forest: ['#b5c4a6', '#a9b99a', '#c9c1a4', '#a6ba9a'],
        fringe: ['#e8daba', '#dddab9', '#d0d8b4', '#dec9a5'],
        meadow: ['#e1eaca', '#c5d8ad', '#f1e9c7', '#dae7c7'],
      };
      const shades = Object.fromEntries(Object.entries(palettes)
        .map(([zone, colors]) => [zone, colors.map(hex => new THREE.Color(hex))]));
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const x = Math.round(e[12] / CELL) + center.x;
        const y = Math.round(e[14] / CELL) + center.y;
        const zone = grid[y]?.[x] === '#'
          ? 'forest'
          : Math.abs(x - center.x) === 1 || Math.abs(y - center.y) === 1
            ? 'fringe' : 'meadow';
        const seed = noise(Math.round(e[12] * 9), Math.round(e[14] * 9), 799);
        const palette = shades[zone];
        mesh.setColorAt(index, palette[Math.min(palette.length - 1,
          Math.floor(seed * palette.length))]);
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (denseMeadow && part === 'woodlandFloor') {
      // The same leaf-litter/fernlet batch now distinguishes sunlit forest
      // margins from shaded interior roots by reading the authored grid.
      // No extra mesh, texture, light, instance or world-transform work.
      const shade = ['#b4c6aa', '#a9b79b', '#bebc9e', '#a7b9a2']
        .map(hex => new THREE.Color(hex));
      const clearing = ['#e2d9b9', '#cdd6b0', '#d7c6a0', '#e0dec3']
        .map(hex => new THREE.Color(hex));
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const x = Math.round(e[12] / CELL) + center.x;
        const y = Math.round(e[14] / CELL) + center.y;
        const touchesClearing = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .some(([dx, dy]) => grid[y + dy]?.[x + dx] === '.');
        const palette = touchesClearing ? clearing : shade;
        const seed = noise(Math.round(e[12] * 7), Math.round(e[14] * 7), 541);
        mesh.setColorAt(index, palette[Math.min(palette.length - 1,
          Math.floor(seed * palette.length))]);
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (denseMeadow && part === 'fallenWood') {
      const shades = ['#f3f0e5', '#dedfd0', '#e8e3d7', '#d9dccf']
        .map(hex => new THREE.Color(hex));
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const seed = noise(Math.round(e[12] * 9), Math.round(e[14] * 9), 659);
        mesh.setColorAt(index, shades[Math.min(shades.length - 1,
          Math.floor(seed * shades.length))]);
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (denseMeadow && part === 'microrelief') {
      // Weathered stone, leaf litter and roots vary subtly per cell, while
      // retaining the same instanced mesh and transparent-free material.
      const shades = ['#f3f2e7', '#e1e3d3', '#f0e8d6', '#dadfcd']
        .map(hex => new THREE.Color(hex));
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const seed = noise(Math.round(e[12] * 7), Math.round(e[14] * 7), 581);
        mesh.setColorAt(index, shades[Math.min(shades.length - 1,
          Math.floor(seed * shades.length))]);
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (denseMeadow && (part === 'tuft' || part === 'meadowSedge')) {
      // Olive/dry grass and light sage sedges share deterministic, subdued
      // tints inside their two existing-style instanced batches.
      const shades = (part === 'tuft'
        ? ['#f5f1d9', '#d6e4cc', '#e7ebd6', '#c7d9b9', '#f2edc5']
        : ['#edf2d6', '#e0efcb', '#f1e5be', '#cfdfba', '#f4efd0'])
        .map(color => new THREE.Color(color));
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const seed = noise(Math.round(e[12] * 5), Math.round(e[14] * 5), 439);
        const shade = shades[Math.min(shades.length - 1, Math.floor(seed * shades.length))];
        if (!meadowHabitat) {
          mesh.setColorAt(index, shade);
        } else {
          const { dry, fresh } = meadowHabitat(e[12] / CELL + center.x, e[14] / CELL + center.y);
          // Multiply the original per-plant variation by the same continuous
          // habitat weights as the ground. Do not tint petals or other parts.
          const tint = shade.clone();
          tint.r *= 1 - 0.13 * fresh;
          tint.g *= 1 - 0.09 * dry - 0.025 * fresh;
          tint.b *= 1 - 0.20 * dry;
          mesh.setColorAt(index, tint);
        }
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (naturalWoodline && part === 'tuft') {
      // Native plains grass follows the existing habitat recipe, including
      // fallback/satellite tufts. Keep the base leaf vertex pigment and
      // add only a subdued, deterministic instance tint.
      const shades = Object.fromEntries(Object.entries({
        'fern-edge': '#d4e5d0',
        'scrub-grass': '#e6e5ca',
        'shade-meadow': '#cadbc8',
        'low-pasture': '#e8edce',
        'flower-meadow': '#e6eedc',
        'dry-tussocks': '#f5e6bc',
        'green-meadow': '#d8edcf',
      }).map(([id, hex]) => [id, new THREE.Color(hex)]));
      const neutral = new THREE.Color(0xffffff);
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const x = Math.round(e[12] / CELL) + center.x;
        const y = Math.round(e[14] / CELL) + center.y;
        const recipe = chroniclesMeadowTileAt({ grid, biome, x, y });
        const tint = shades[recipe?.id] ?? neutral;
        const strength = 0.55 + 0.25 * noise(Math.round(e[12] * 5), Math.round(e[14] * 5), 1641);
        mesh.setColorAt(index, neutral.clone().lerp(tint, strength));
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (naturalHighlands && (part === 'tuft' || part === 'pebble')) {
      // Tie the low grass and scree to the same existing foothill recipe:
      // warm thin scree, cooler rockline vegetation and muted open pasture.
      // No new geometry, material, texture, placement or draw batch.
      const pigments = part === 'tuft' ? {
        'broken-scree': '#e4d9ba',
        'grassy-rockline': '#d2e3c4',
        'wind-scoured-slope': '#e7dbbb',
        'short-upland-grass': '#dbe6c9',
        'stony-pasture': '#e3e2c9',
        'thin-scree': '#eee2c8',
      } : {
        'broken-scree': '#d7d5ce',
        'grassy-rockline': '#d1dace',
        'wind-scoured-slope': '#e4d8c7',
        'short-upland-grass': '#deded3',
        'stony-pasture': '#e0d9ca',
        'thin-scree': '#eee3d2',
      };
      const palette = Object.fromEntries(Object.entries(pigments)
        .map(([id, hex]) => [id, new THREE.Color(hex)]));
      const white = new THREE.Color(0xffffff);
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const x = Math.round(e[12] / CELL) + center.x;
        const y = Math.round(e[14] / CELL) + center.y;
        const recipe = chroniclesFoothillTileAt({ grid, biome, x, y });
        const pigment = palette[recipe?.id] ?? white;
        const strength = 0.48 + 0.28 * noise(Math.round(e[12] * 7),
          Math.round(e[14] * 7), part === 'tuft' ? 1643 : 1645);
        mesh.setColorAt(index, white.clone().lerp(pigment, strength));
      });
      mesh.instanceColor.needsUpdate = true;
    }
    // Snowy groves share a continuous frost field across both foliage tiers.
    // Farther decorative rings converge toward a cool, muted tint while
    // nearby needles keep more variation. No new geometry or draw batches.
    if (biome === 'snow' && (part === 'pine' || part === 'pineSnow')) {
      const snow = part === 'pineSnow';
      const pale = new THREE.Color(snow ? '#ffffff' : '#e3ebe4');
      const dark = new THREE.Color(snow ? '#dce7ef' : '#b5c7c0');
      const distant = new THREE.Color(snow ? '#e5edf4' : '#ccd9dc');
      const tint = new THREE.Color();
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const x = Math.round(e[12] / CELL) + center.x;
        const y = Math.round(e[14] / CELL) + center.y;
        const frost = 0.5 + 0.5 * Math.sin(x * 0.41 + y * 0.29)
          * Math.cos(y * 0.37 - x * 0.23);
        const ring = Math.max(0, -x, x - width + 1, -y, y - grid.length + 1);
        const depth = ring >= 3 ? 0.55 : ring === 2 ? 0.30 : 0;
        mesh.setColorAt(index, tint.copy(dark).lerp(pale, frost).lerp(distant, depth));
      });
      mesh.instanceColor.needsUpdate = true;
    }
    // Ash-veiled outer rings are less warm and less contrasted than the
    // nearby mineral formations. Reuse instance colors; authored map
    // cells and the first decorative ring keep their original albedo.
    if (biome === 'ash' && ['basalt', 'boulderDark', 'emberRock'].includes(part)) {
      const near = new THREE.Color('#ffffff');
      const haze = new THREE.Color(part === 'emberRock' ? '#c7b7b3' : '#c7ced5');
      const tint = new THREE.Color();
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const x = Math.round(e[12] / CELL) + center.x;
        const y = Math.round(e[14] / CELL) + center.y;
        const ring = Math.max(0, -x, x - width + 1, -y, y - grid.length + 1);
        const depth = ring >= 3 ? 0.60 : ring === 2 ? 0.32 : 0;
        mesh.setColorAt(index, tint.copy(near).lerp(haze, depth));
      });
      mesh.instanceColor.needsUpdate = true;
    }
    // Native highlands get quiet stone/lichen tonality per real rock, not
    // identical chess-pawn grey boulders. Same single instanced batch and
    // deterministic transforms; authored heath B2 retains its own palette.
    if (naturalHighlands && (part === 'boulder' || part === 'crag')) {
      const shades = ['#ffffff', '#e5e9e2', '#d9e2d8', '#f0e6da', '#e4e6d7']
        .map(hex => new THREE.Color(hex));
      // Quiet, cooler and less contrasting pigments on distant decorative rings.
      // The near ridge and all authored map cells keep their exact old tint.
      const haze = new THREE.Color('#e1e7ed');
      const tint = new THREE.Color();
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const seed = noise(Math.round(e[12] * 7), Math.round(e[14] * 7),
          part === 'boulder' ? 375 : 377);
        const base = shades[Math.min(shades.length - 1, Math.floor(seed * shades.length))];
        const x = Math.round(e[12] / CELL) + center.x;
        const y = Math.round(e[14] / CELL) + center.y;
        const ring = Math.max(0, -x, x - width + 1, -y, y - grid.length + 1);
        const strength = ring >= 3 ? 0.50 : ring === 2 ? 0.25 : 0;
        mesh.setColorAt(index, tint.copy(base).lerp(haze, strength));
      });
      mesh.instanceColor.needsUpdate = true;
    }
    // Weathered grey/olive stone variation, using instance colours instead
    // of new geometries, materials or draw calls. Other biomes stay identical.
    if (mapId === 'terra-b2' && biome === 'hills' && part === 'boulder') {
      const shades = [
        new THREE.Color('#a4a99b'), new THREE.Color('#b7aa96'),
        new THREE.Color('#93a08a'), new THREE.Color('#b5b6a5'),
      ];
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const seed = noise(Math.round(e[12] * 10), Math.round(e[14] * 10), 159);
        mesh.setColorAt(index, shades[Math.min(shades.length - 1, Math.floor(seed * shades.length))]);
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (biome === 'marsh' && part === 'pool') {
      // Small colour differences break up identical pools. Reuse the same
      // geometry/material/draw call; no random colours between reloads.
      const depths = [
        new THREE.Color('#ffffff'), new THREE.Color('#e4ede9'),
        new THREE.Color('#d4e1da'), new THREE.Color('#f1f0e4'),
      ];
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const seed = noise(Math.round(e[12] / CELL), Math.round(e[14] / CELL), 181);
        mesh.setColorAt(index, depths[Math.min(depths.length - 1, Math.floor(seed * depths.length))]);
      });
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.name = 'chronicles-terra-' + part;
    const small = ['tuft', 'flower', 'pebble', 'snowMound', 'ember', 'flame', 'reed', 'heather', 'heatherGroundcover', 'pool', 'woodlandFloor', 'microrelief', 'fallenWood', 'meadowSedge', 'forestHerb'].includes(part);
    mesh.castShadow = !coarsePointer && !small;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function chroniclesTerraSceneryBiomes() {
  return Object.keys(DRESS);
}
