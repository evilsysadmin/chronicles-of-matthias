import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';
import { chroniclesLandscapeTileAt, chroniclesMeadowTileAt, chroniclesFoothillTileAt } from './chroniclesLandscapeTiles.js';

// Terra's scenery: what an impassable cell of the overworld looks like in
// each biome (boulders on the hills, snowy pines, reeds and dead trees in
// the marsh, basalt in the ash lands...), a ring of the same landscape past
// the edge of the map so the horizon is never a wall, small non-blocking
// clutter on walkable ground, and authored set pieces such as camp tents.
//
// The collision grid stays the only source of truth: blocking dressing only
// ever stands on '#' cells, and walkable clutter is kept below knee height.
// Everything is instanced (one draw call per part) and deterministic.

const CELL = 4;
export const TERRA_SCENERY_MARGIN = 3;

const box = new THREE.Object3D();

function noise(x, y, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
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
export function chroniclesOrganicRockGeometry({ coarsePointer = false } = {}) {
  const geometry = new THREE.IcosahedronGeometry(1, coarsePointer ? 0 : 1);
  if (coarsePointer) return geometry;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
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
    const rings = [[1, 0], [0.78, 0.34], [0.43, 0.73], [0.05, 1]];
    rings.forEach(([radius, rise], ringIndex) => {
      for (let i = 0; i < sides; i += 1) {
        const angle = i * Math.PI * 2 / sides + 0.31 * peakIndex;
        const rough = 1 + 0.115 * Math.sin(i * 2.9 + ringIndex * 1.8 + peakIndex);
        const shift = rise * (peakIndex === 0 ? -0.10 : 0.13);
        vertices.push(
          peak.x + (Math.cos(angle) * radius * rough + shift) * peak.width,
          peak.height * (rise + (ringIndex > 0 && ringIndex < 3
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
 * Banner Road leaf mass: a low-poly, latitude-based foliage envelope rather
 * than a stack of visibly triangular icosahedrons. The contour uses subtle,
 * deterministic scallops and a fuller sunlit crown with a tucked underside.
 * Five meridians × three latitude bands give exactly 20 mobile triangles;
 * ten meridians × five bands give exactly 80 desktop triangles. The six/four
 * existing masses, draw calls, vegetation placement and collision are intact.
 * Other biomes and maps continue to use chroniclesOrganicCanopyGeometry.
 */
export function chroniclesWoodlandLeafMassGeometry({ coarsePointer = false } = {}) {
  const geometry = new THREE.SphereGeometry(1, coarsePointer ? 5 : 10,
    coarsePointer ? 3 : 5);
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
    // On touch, the five-meridian cap would otherwise taper to a sharp
    // pyramid tip. Lift its upper shoulder ring without adding triangles.
    const touchShoulderLift = coarsePointer && y > 0.4 && y < 0.7 ? 0.26 : 0;
    const vertical = y * (y < 0 ? 0.77 : 0.93) + touchShoulderLift
      + 0.024 * Math.sin(4 * a + 0.67) * (1 - Math.abs(y));
    positions.setXYZ(i, x * scallop * skirt, vertical,
      z * (scallop + 0.024 * Math.sin(2 * a + y * 2.0)) * skirt);
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
  merged.computeBoundingSphere();
  return merged;
}


/**
 * Three overlapping uneven leaf masses make a low hedge-like shrub rather
 * than a single oversized sphere. Only the plains use this silhouette:
 * marsh, hills and other biome brushes retain their original geometry.
 * Each shrub remains ONE instanced mesh; mobile has only two cheap lobes.
 */
export function chroniclesLayeredShrubGeometry({ coarsePointer = false } = {}) {
  const lobes = [
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
export function chroniclesMeadowGrassGeometry({ coarsePointer = false } = {}) {
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
    const baseWidth = 0.048 + (i % 3) * 0.010;
    const shoulderWidth = baseWidth * 0.60;
    const shoulderReach = 0.040 + (i % 3) * 0.024;
    const tipReach = shoulderReach + 0.080 + (i % 4) * 0.016;
    // A slight sideways curl gives the blade a continuous asymmetric arc.
    const curl = (i % 2 ? -1 : 1) * (0.028 + (i % 3) * 0.009);
    const rootLeft = [x - tangentX * baseWidth, 0.012, z - tangentZ * baseWidth];
    const rootRight = [x + tangentX * baseWidth, 0.012, z + tangentZ * baseWidth];
    const midX = x + directionX * shoulderReach + tangentX * curl * 0.30;
    const midZ = z + directionZ * shoulderReach + tangentZ * curl * 0.30;
    const shoulderLeft = [
      midX - tangentX * shoulderWidth, height * 0.64,
      midZ - tangentZ * shoulderWidth,
    ];
    const shoulderRight = [
      midX + tangentX * shoulderWidth, height * 0.64,
      midZ + tangentZ * shoulderWidth,
    ];
    const tip = [
      x + directionX * tipReach + tangentX * curl,
      height * (0.89 + (i % 3) * 0.035),
      z + directionZ * tipReach + tangentZ * curl,
    ];
    const rootShade = roots[i % roots.length];
    const midShade = shoulders[i % shoulders.length];
    const tipShade = tips[i % tips.length];
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
export function chroniclesForestHerbGeometry({ coarsePointer = false } = {}) {
  const positions = [];
  const colors = [];
  const lower = ['#48683b', '#587746', '#718554', '#536d3e']
    .map(hex => new THREE.Color(hex));
  const upper = ['#829967', '#94a977', '#a2aa74', '#7f945e']
    .map(hex => new THREE.Color(hex));
  const triangle = (a, b, c, color) => {
    positions.push(...a, ...b, ...c);
    for (let j = 0; j < 3; j += 1) colors.push(color.r, color.g, color.b);
  };
  for (let i = 0; i < (coarsePointer ? 4 : 7); i += 1) {
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const r = 0.06 + (i % 3) * 0.045;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    const outwardX = Math.cos(angle), outwardZ = Math.sin(angle);
    const tangentX = -outwardZ, tangentZ = outwardX;
    const reach = 0.38 + (i % 3) * 0.085;
    const h = 0.64 + (i % 4) * 0.062;
    const span = 0.13 + (i % 2) * 0.045;
    const mx = x + outwardX * reach * 0.47;
    const mz = z + outwardZ * reach * 0.47;
    const left = [mx - tangentX * span, h * 0.49, mz - tangentZ * span];
    const right = [mx + tangentX * span, h * 0.49, mz + tangentZ * span];
    const tip = [x + outwardX * reach, h, z + outwardZ * reach];
    triangle([x, 0.012, z], left, right, lower[i % lower.length]);
    triangle(left, tip, right, upper[i % upper.length]);
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
export function chroniclesBranchingTrunkGeometry({ coarsePointer = false } = {}) {
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
  const litter = ['#776b42', '#988153', '#5c663c']
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
  for (let i = 0; i < (coarsePointer ? 3 : 7); i += 1) {
    const angle = i * 2.39996 + 0.4;
    const d = 0.15 + (i % 4) * 0.10;
    const x = Math.cos(angle) * d;
    const z = Math.sin(angle) * d;
    const dx = Math.cos(angle) * 0.10;
    const dz = Math.sin(angle) * 0.10;
    triangle([x - dz, 0.016, z + dx], [x + dz, 0.016, z - dx],
      [x + dx, 0.021, z + dz], litter[i % litter.length]);
  }
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
export function chroniclesMeadowMicroreliefGeometry({ coarsePointer = false } = {}) {
  const positions = [];
  const colors = [];
  const stone = ['#8c8d7a', '#6d7766', '#9b9880', '#737263']
    .map(value => new THREE.Color(value));
  const bark = ['#615443', '#817059'].map(value => new THREE.Color(value));
  const litter = ['#887750', '#a09265', '#707b4c']
    .map(value => new THREE.Color(value));
  const add = (a, b, c, tint) => {
    positions.push(...a, ...b, ...c);
    for (let j = 0; j < 3; j += 1) colors.push(tint.r, tint.g, tint.b);
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
    for (let i = 0; i < rim.length; i += 1) {
      add(rim[i], top, rim[(i + 1) % rim.length], stone[(seed + i) % stone.length]);
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
    add([x, 0.022, z], [x + 0.47, 0.045, z + 0.15],
      [x + 0.10, 0.025, z + 0.075], shade);
    add([x + 0.10, 0.025, z + 0.075],
      [x + 0.47, 0.045, z + 0.15],
      [x + 0.76, 0.017, z + 0.045], shade);
  }
  for (let i = 0; i < (coarsePointer ? 2 : 5); i += 1) {
    const x = (i % 3 - 1) * 0.25 + 0.035;
    const z = (Math.floor(i / 3) - 0.5) * 0.54 + 0.15;
    add([x - 0.06, 0.015, z], [x + 0.035, 0.015, z + 0.07],
      [x + 0.075, 0.020, z - 0.04], litter[i % litter.length]);
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
export function chroniclesFallenWoodGeometry({ coarsePointer = false } = {}) {
  const positions = [];
  const colors = [];
  const bark = ['#63513d', '#755e44', '#897455', '#4e4438']
    .map(hex => new THREE.Color(hex));
  const grain = new THREE.Color('#a58d68');
  const moss = ['#708654', '#506b40', '#84925d']
    .map(hex => new THREE.Color(hex));
  const triangle = (a, b, c, tint) => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i += 1) colors.push(tint.r, tint.g, tint.b);
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
    triangle([-0.67, 0.205, 0], rings[0][next], rings[0][i], grain);
    triangle([0.64, 0.205, 0], rings[1][i], rings[1][next], grain);
  }
  // A couple of short broken branch remnants interrupt the cylinder outline
  // without protruding beyond the source forest tile.
  triangle([-0.17, 0.34, -0.03], [0.04, 0.43, -0.16],
    [0.16, 0.33, -0.05], bark[0]);
  if (!coarsePointer) {
    triangle([0.27, 0.32, 0.035], [0.43, 0.46, 0.11],
      [0.51, 0.29, 0.08], bark[2]);
  }
  // Scattered moss streaks sit flush on the upper bark, not in the air.
  for (let i = 0; i < (coarsePointer ? 2 : 4); i += 1) {
    const x = -0.48 + i * (coarsePointer ? 0.67 : 0.30);
    triangle([x, 0.409 - i * 0.01, -0.04],
      [x + 0.22, 0.402 - i * 0.01, -0.045],
      [x + 0.11, 0.405 - i * 0.01, 0.085], moss[i % moss.length]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Parts: one geometry + one material each, instanced across the map.
function partCatalog(coarsePointer, biome, woodland = false) {
  const rock = (color) => lit(color, { map: texture('rock'), flatShading: true });
  const roundedRock = (color, opts = {}) => lit(color, {
    map: texture('rock'), flatShading: coarsePointer, ...opts,
  });
  return {
    boulder: () => [chroniclesOrganicRockGeometry({ coarsePointer }), roundedRock(0xd8d2c4)],
    boulderDark: () => [chroniclesOrganicRockGeometry({ coarsePointer }), roundedRock(0x8a857c)],
    boulderSnow: () => [chroniclesOrganicRockGeometry({ coarsePointer }), lit(0xf2f6fa, { map: texture('snow'), flatShading: coarsePointer })],
    crag: () => [chroniclesMountainCragGeometry({ coarsePointer }), rock(0xc8c0b0)],
    basalt: () => [new THREE.CylinderGeometry(0.42, 0.48, 1, 6), lit(0x8a7c74, { map: texture('rock'), flatShading: true })],
    emberRock: () => [chroniclesOrganicRockGeometry({ coarsePointer }), roundedRock(0x5a4a44, { emissive: 0x5a1c04, emissiveIntensity: 0.35 })],
    trunk: () => [new THREE.CylinderGeometry(0.2, 0.32, 1, 7), lit(0xffffff, { map: texture('bark', 2, 3) })],
    broadleafTrunk: () => [chroniclesBranchingTrunkGeometry({ coarsePointer }), lit(0xffffff, { map: texture('bark', 2, 3) })],
    crown: () => [chroniclesLayeredCanopyGeometry({ coarsePointer, woodland }),
      lit(0xe6efdc, {
        map: texture('leaves', 3, 3),
        // Smooth leaf normals on touch only for the new multi-lobed woodland
        // silhouette; other locations retain their exact original mobile art.
        flatShading: coarsePointer && !woodland,
        vertexColors: true,
      })],
    bush: () => [biome === 'plains'
      ? chroniclesLayeredShrubGeometry({ coarsePointer })
      : chroniclesOrganicCanopyGeometry({ coarsePointer, shrub: true }),
      lit(0xcbdcbd, { map: texture('leaves', 2, 2), flatShading: coarsePointer })],
    pine: () => [new THREE.ConeGeometry(1, 1, coarsePointer ? 8 : 12), lit(0x9cb09c, { map: texture('leaves', 5, 2) })],
    pineSnow: () => [new THREE.ConeGeometry(1, 1, coarsePointer ? 8 : 12), lit(0xf4f8fc, { map: texture('snow', 3, 1) })],
    deadTrunk: () => [new THREE.CylinderGeometry(0.14, 0.26, 1, 6), lit(0xcab8a0, { map: texture('bark', 1, 3) })],
    reed: () => [new THREE.CylinderGeometry(0.035, 0.05, 1, 4), lit(0xb2a65e)],
    // One batched, opaque water surface per marsh. More rounded on desktop,
    // original 14-gon on touch devices; never casts an implausible shadow.
    pool: () => [new THREE.CylinderGeometry(1, 1, 0.06, coarsePointer ? 14 : 24),
      lit(0xffffff, { map: texture('bogwater'), roughness: 0.28, metalness: 0.06 })],
    dune: () => [new THREE.SphereGeometry(1, 10, 6), lit(0xffffff, { map: texture('sand', 2, 2) })],
    drift: () => [new THREE.CylinderGeometry(0.16, 0.2, 1, 6), lit(0xa89a86, { map: texture('bark', 1, 2) })],
    // Walkable clutter.
    tuft: () => [chroniclesMeadowGrassGeometry({ coarsePointer }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    meadowSedge: () => [chroniclesMeadowSedgeGeometry({ coarsePointer }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    forestHerb: () => [chroniclesForestHerbGeometry({ coarsePointer }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    flower: () => [chroniclesMeadowWildflowersGeometry(), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    woodlandFloor: () => [chroniclesWoodlandUnderstoryGeometry({ coarsePointer }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    microrelief: () => [chroniclesMeadowMicroreliefGeometry({ coarsePointer }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    fallenWood: () => [chroniclesFallenWoodGeometry({ coarsePointer }), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    pebble: () => [new THREE.IcosahedronGeometry(0.22, 0), rock(0xbab2a2)],
    heather: () => [chroniclesBrezalHeatherGeometry(), lit(0xffffff, { vertexColors: true, side: THREE.DoubleSide })],
    snowMound: () => [new THREE.SphereGeometry(0.5, 8, 4), lit(0xf4f8fc, { map: texture('snow') })],
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

function broadleaf(p, wx, wz, x, y, k, scale = 1, bannerRoad = false, woodlandGateway = false) {
  const s = scale * (0.79 + noise(x, y, k + 21) * 0.65);
  const ox = (noise(x, y, k + 23) - 0.5) * 2;
  const oz = (noise(y, x, k + 25) - 0.5) * 2;
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
  p.add('crown', [wx + ox + (noise(x, y, k + 50) - 0.5) * 0.22 * s,
    3.9 * s * trunkHeight, wz + oz + (noise(y, x, k + 51) - 0.5) * 0.22 * s], {
    yaw,
    roll: (noise(x, y, k + 35) - 0.5) * 0.13,
    scale: [1.9 * s * spreadX * (woodlandGateway ? (pale ? 1.00 : 0.86) : pale ? 0.74 : 1),
      1.6 * s * crownHeight * (woodlandGateway ? (pale ? 1.08 : 1.24) : pale ? 1.18 : 1),
      1.9 * s * spreadZ * (woodlandGateway ? (pale ? 0.95 : 0.92) : pale ? 0.76 : 1)],
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

function deadTree(p, wx, wz, x, y, k) {
  const s = 0.9 + noise(x, y, k + 41) * 0.5;
  const ox = (noise(x, y, k + 43) - 0.5) * 2;
  const oz = (noise(y, x, k + 45) - 0.5) * 2;
  const yaw = noise(x, y, k + 47) * 6.28;
  p.add('deadTrunk', [wx + ox, 2 * s, wz + oz], { yaw, tilt: 0.06, scale: [s, 4 * s, s] });
  p.add('deadTrunk', [wx + ox + Math.cos(yaw) * 0.6 * s, 3.1 * s, wz + oz + Math.sin(yaw) * 0.6 * s], { yaw, roll: 0.9, scale: [0.6 * s, 1.6 * s, 0.6 * s] });
  p.add('deadTrunk', [wx + ox - Math.cos(yaw) * 0.5 * s, 3.6 * s, wz + oz - Math.sin(yaw) * 0.5 * s], { yaw, roll: -0.8, scale: [0.5 * s, 1.3 * s, 0.5 * s] });
}

function reeds(p, wx, wz, x, y, k, count = 7) {
  // Clump centre stays well inside the cell so no reed leans onto a path.
  const cx = wx + (noise(x, y, k + 51) - 0.5) * 1.6;
  const cz = wz + (noise(y, x, k + 53) - 0.5) * 1.6;
  for (let r = 0; r < count; r += 1) {
    const h = 1.1 + noise(x + r, y, k + 55) * 0.9;
    p.add('reed', [cx + (noise(x, y + r, k) - 0.5) * 0.8, h / 2, cz + (noise(y, x + r, k) - 0.5) * 0.8], {
      tilt: (noise(x, r, k + 57) - 0.5) * 0.3, roll: (noise(r, y, k + 59) - 0.5) * 0.3, scale: [1, h, 1],
    });
  }
}

function basalt(p, wx, wz, x, y, k) {
  const columns = 3 + Math.floor(noise(x, y, k + 61) * 3);
  for (let c = 0; c < columns; c += 1) {
    const h = 1.2 + noise(x + c, y, k + 63) * 3.2;
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

const DRESS = {
  plains(p, wx, wz, x, y, big, bannerRoad = false, ringDepth = 0,
    woodlandGateway = false, gatewayGrove = false, _tile = null, naturalWoodline = false) {
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
    const size = woodlandGateway ? 1.6 + noise(x, y, 845) * 0.12
      : gatewayGrove ? 1.10 + noise(x, y, 855) * 0.16
        : juvenile ? 0.48 + noise(x, y, 753) * 0.16
          : backdrop ? chroniclesBannerRoadBackdropScale(x, y, ringDepth)
            : naturalWoodline ? chroniclesTerraWoodlineScale(x, y, ringDepth)
              : (big ? 1.15 : 1);
    // The mid-height approach grove is anchored exclusively in four real
    // blocked cells, never inside the walkable meadow or on the cart track.
    if (woodlandGateway || gatewayGrove || roll < canopyThreshold) {
      broadleaf(p, wx, wz, x, y, 0, size, bannerRoad, woodlandGateway);
    }
    if (roll >= 0.35) {
      p.add('bush', [wx + (noise(x, y, 2) - 0.5) * 2.4, 0.55, wz + (noise(y, x, 2) - 0.5) * 2.4],
        { yaw: noise(x, y, 3) * 6.28,
          scale: [1.14 + noise(x, y, 5) * 0.34,
            0.65 + noise(x, y, 6) * 0.28,
            0.94 + noise(x, y, 7) * 0.36] });
    }
    // Thin only the *non-colliding* Terra outer rubble ring. Real blocked
    // inside cells retain their visible stones; Banner Road is unchanged.
    if (roll >= 0.7 || (big && (!naturalWoodline || noise(x, y, 847) > 0.30))) {
      boulders(p, wx, wz, x, y, { count: 1, size: 1.0 });
    }
    if (roll < 0.2) {
      broadleaf(p, wx, wz, x, y, 9,
        naturalWoodline ? size * 0.86 : (big ? 1.1 : 0.9), bannerRoad);
    }
  },
  hills(p, wx, wz, x, y, big, _banner, _ring, _gateway, _grove, tileRecipe) {
    // Each real blocked cell selects one reusable, topology-aware recipe.
    // Rim tiles stay low; inland tiles and the non-colliding outer ring form
    // irregular rocky ridges. All parts still share the old instance batches.
    if (!tileRecipe) return;
    boulders(p, wx, wz, x, y, {
      count: tileRecipe.boulderCount, size: tileRecipe.boulderSize, height: 1.05,
    });
    if (noise(x, y, 4) < tileRecipe.cragChance) {
      p.add('crag', [
        wx + (noise(x, y, 5) - 0.5) * 0.48, 0,
        wz + (noise(y, x, 5) - 0.5) * 0.48,
      ], {
        yaw: noise(x, y, 6) * 6.28,
        scale: [0.90 + noise(x, y, 9) * 0.20,
          (big ? 2.50 : 1.90) + noise(x, y, 8) * 0.52,
          0.87 + noise(x, y, 10) * 0.25],
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
  coast(p, wx, wz, x, y, big) {
    const roll = noise(x, y, 1);
    if (roll < 0.45) {
      p.add('dune', [wx + (noise(x, y, 2) - 0.5), 0.2, wz + (noise(y, x, 2) - 0.5)], { yaw: noise(x, y, 3) * 6.28, scale: [2.2, 1.0 + noise(x, y, 4) * 0.6, 1.7] });
      reeds(p, wx, wz, x, y, 0, 4);
    }
    if (roll >= 0.3) boulders(p, wx, wz, x, y, { part: 'boulderDark', count: big ? 3 : 2, size: 1.25 });
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
  ash(p, wx, wz, x, y, big) {
    if (noise(x, y, 1) < 0.55) basalt(p, wx, wz, x, y, 0);
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


/**
 * Fill the 4m meadow cells with several staggered leaf clusters. Planting
 * everything at the tile centre looked like isolated green spikes; an
 * irregular 3x3 layout reads as contiguous grass in perspective.
 *
 * Every blade and flower stays within 1.7m of its own cell centre (4m cell),
 * including those beside the road. The authored grid, paving and interaction
 * clearances are unchanged. Mobile draws fewer patches with fewer blades.
 */
function addBannerRoadMeadow(p, wx, wz, x, y, { coarsePointer = false, nearPath = false } = {}) {
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
    const ox = col * 1.12 + (noise(x + i, y, 407) - 0.5) * 0.46;
    const oz = row * 1.12 + (noise(y + i, x, 409) - 0.5) * 0.46;
    const variety = noise(x + i * 3, y - i * 5, 733);
    const sedge = variety < (nearPath ? 0.40 : 0.31);
    const width = sedge
      ? 0.77 + noise(x, y + i, 413) * 0.38
      : 0.69 + noise(x, y + i, 413) * 0.58;
    p.add(sedge ? 'meadowSedge' : 'tuft', [wx + ox, 0.012, wz + oz], {
      yaw: noise(x + i, y, 419) * Math.PI * 2,
      scale: [width,
        sedge ? 0.80 + noise(x, y + i, 421) * 0.22
          : 0.56 + noise(x, y + i, 421) * 0.65,
        width],
    });
  }
  if (!coarsePointer && noise(x, y, 423) > (nearPath ? 0.48 : 0.72)) {
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
    p.add('bush', [wx + offsetX, blocked ? 0.57 : 0.51, wz + offsetZ], {
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
    yaw: noise(x, y, 573) * Math.PI * 2,
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


// Native Terra meadow communities share the existing grass, wildflower and
// woodland-herb geometry batches. Coverage follows coherent 3x3-cell habitat
// recipes while deterministic sub-cell offsets avoid a painted checkerboard.
// All plant tips stay below knee height; plants never become collision tiles.
function addReusableMeadowPatch(p, wx, wz, x, y, recipe, coarsePointer) {
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
      : 0.73 + noise(x, y, 631) * 0.24, grassScale],
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
  ruin(p, wx, wz, x, y) {
    for (let k = 0; k < 3; k += 1) {
      const h = 1 + noise(x, y, 90 + k) * 2.5;
      p.add('boulder', [wx + (k - 1) * 1.2, h / 2, wz + (noise(x, y, 93 + k) - 0.5)], { yaw: k * 0.4, scale: [0.55, h, 0.55] });
    }
  },
};

/**
 * @param {object} plan  { grid, center, biome, scenery, coarsePointer }
 * @returns {THREE.Group} the dressing, or an empty group for unknown biomes
 */
export function buildTerraScenery({ grid = [], center, biome, mapId = null, scenery = [], coarsePointer = false, dressBlocked = true, keepClear = [] }) {
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
  const naturalWoodline = biome === 'plains' && typeof mapId === 'string'
    && mapId.startsWith('terra-');

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
        SET_PIECES[piece.type](p, wx, wz, x, y);
        continue;
      }
      if (tile === '#') {
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
          : null;
        dress(p, wx, wz, x, y, !inside, denseMeadow, ringDepth,
          woodlandGateway, gatewayGrove, landscapeTile, naturalWoodline);
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
        if (denseMeadow && tile === '.') {
          const nearPath = [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .some(([dx, dy]) => clear.has((x + dx) + ',' + (y + dy)));
          addBannerRoadMeadow(p, wx, wz, x, y, { coarsePointer, nearPath });
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
          addReusableMeadowPatch(p, wx, wz, x, y,
            chroniclesMeadowTileAt({ grid, biome, x, y }), coarsePointer);
        } else if (biome === 'hills' && tile === '.') {
          // Continuous low scree and grasses bridge the natural rock edges
          // and upland path cells, without changing traversal/collision.
          addReusableFoothillPatch(p, wx, wz, x, y,
            chroniclesFoothillTileAt({ grid, biome, x, y }), coarsePointer);
        } else if (!coarsePointer && noise(x, y, 77) < 0.28) {
          // Original sparse dressing on all other biomes and plains maps.
          clutter(p, wx + (noise(x, y, 78) - 0.5) * 3,
            wz + (noise(y, x, 79) - 0.5) * 3, x, y);
        }
      }
    }
  }

  const catalog = partCatalog(coarsePointer, biome, denseMeadow);
  for (const [part, matrices] of p.parts) {
    const [geometry, mat] = catalog[part]();
    const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
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
        mesh.setColorAt(index, palette[Math.min(palette.length - 1,
          Math.floor(seed * palette.length))]);
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
      const shades = ['#e1eaca', '#c5d8ad', '#f1e9c7', '#dae7c7']
        .map(hex => new THREE.Color(hex));
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const seed = noise(Math.round(e[12] * 9), Math.round(e[14] * 9), 799);
        mesh.setColorAt(index, shades[Math.min(shades.length - 1,
          Math.floor(seed * shades.length))]);
      });
      mesh.instanceColor.needsUpdate = true;
    }
    if (denseMeadow && part === 'woodlandFloor') {
      const shades = ['#d1ddc3', '#eff0d8', '#a5b894', '#e5e2c2']
        .map(hex => new THREE.Color(hex));
      matrices.forEach((matrix, index) => {
        const e = matrix.elements;
        const seed = noise(Math.round(e[12] * 7), Math.round(e[14] * 7), 541);
        mesh.setColorAt(index, shades[Math.min(shades.length - 1,
          Math.floor(seed * shades.length))]);
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
        mesh.setColorAt(index, shades[Math.min(shades.length - 1,
          Math.floor(seed * shades.length))]);
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
    const small = ['tuft', 'flower', 'pebble', 'snowMound', 'ember', 'flame', 'reed', 'heather', 'pool', 'woodlandFloor', 'microrelief', 'fallenWood', 'meadowSedge', 'forestHerb'].includes(part);
    mesh.castShadow = !coarsePointer && !small;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function chroniclesTerraSceneryBiomes() {
  return Object.keys(DRESS);
}
