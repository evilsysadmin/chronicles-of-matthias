import * as THREE from 'three';

const CELL = 4;
const DIRECTIONS = Object.freeze([
  { dx: 0, dy: 1, yaw: 0 },
  { dx: 1, dy: 0, yaw: Math.PI / 2 },
  { dx: 0, dy: -1, yaw: Math.PI },
  { dx: -1, dy: 0, yaw: -Math.PI / 2 },
]);

function hash(x, y, salt = 0) {
  let n = Math.imul(x + 374761393 + salt * 668265263, 0x27d4eb2d)
    ^ Math.imul(y + 668265263, 0x165667b1);
  n ^= n >>> 15;
  n = Math.imul(n, 0x85ebca6b);
  return ((n ^ (n >>> 13)) >>> 0) / 0xffffffff;
}

/**
 * One opaque, instanced meadow-to-earth transition for the exposed edges of
 * Banner Road's 2.64m-wide visual cart track. Low groundcover, loam, blades,
 * and irregular flat moss tongues break its ruler-straight edge without
 * changing the underlying 4m walkable grid or adding draw calls.
 *
 * Local +Z faces outwards into grass; negative Z faces across the dirt.
 * The top-surface fringe now overlaps at most 0.12m of the track:
 * thinner, dusty soil-and-moss edges instead of sharp bright-green teeth.
 * Nothing here is a
 * collider, movement rule, animated object or separate material.
 */
export function chroniclesRoadsideShoulderGeometry({ coarsePointer = false } = {}) {
  const positions = [];
  const colors = [];
  const grass = ['#637e44', '#78884e', '#50693b', '#829461'];
  const soil = ['#857754', '#706747'];
  const palette = [...grass, ...soil].map(hex => new THREE.Color(hex));
  const aprons = ['#858168', '#7b805c', '#837b5e', '#7c8060']
    .map(hex => new THREE.Color(hex));
  const tread = ['#8b7753', '#806d49', '#8a7859', '#867451']
    .map(hex => new THREE.Color(hex));
  const add = (a, b, c, shade, shadeB = shade, shadeC = shade) => {
    positions.push(...a, ...b, ...c);
    for (const tint of [shade, shadeB, shadeC]) {
      colors.push(tint.r, tint.g, tint.b);
    }
  };

  // Eight distinct irregular edges fit within the original desktop 100
  // vertex budget; touch retains four. Cover most of the 4m-long tile
  // while leaving tiny natural gaps and avoiding overlapping seams.
  const patches = coarsePointer ? 4 : 8;
  const span = 3.68;
  for (let i = 0; i < patches; i += 1) {
    const x = ((i + 0.5) / patches - 0.5) * span;
    const width = (span / patches) * (0.38 + hash(i, 11, 601) * 0.06);
    // Longer groundcover tongues bridge the newly exposed verge back to
    // the grass; still low, static, deterministic and non-colliding.
    const depth = 0.30 + hash(i, 13, 603) * 0.36;
    const lean = (hash(i, 17, 605) - 0.5) * width * 0.9;
    const a = [x - width, 0, 0.012];
    const b = [x + width, 0, 0.012];
    const c = [x + width * 0.55 + lean, 0, depth];
    const d = [x - width * 0.70 + lean, 0, depth * 0.76];
    const shade = palette[(i * 3) % palette.length];
    // Wind both triangles upward for reliable overhead lighting.
    // Blend the existing quad from dusty, compacted soil at the track
    // to muted grass at the outer edge. Shared vertices keep identical
    // colours, so the two triangles no longer read as separate patches.
    const loam = palette[grass.length + (i % soil.length)];
    const inner = shade.clone().lerp(loam, 0.68);
    const outer = shade.clone().lerp(loam, 0.12);
    add(a, c, b, inner, outer, inner);
    add(a, d, c, inner, outer, outer);

    // The old groundcover stopped below the raised road top, leaving an
    // almost perfectly straight dirt outline. Lay short, narrow tongues
    // just over the raised road top (~8mm clearance), in weathered earthy
    // shades rather than vivid grass-green triangular wedges. The entire
    // dirt tread remains clear and polygons/draw calls do not change.
    const intrusion = 0.045 + hash(i, 23, 611) * 0.075;
    const tipX = x + (hash(i, 29, 613) - 0.5) * width * 0.50;
    const fringe = aprons[(i * 5 + 1) % aprons.length];
    add([x - width * 0.64, 0.085, 0.08],
      [x + width * 0.58, 0.085, 0.055],
      [tipX, 0.085, -intrusion], fringe, fringe, tread[i % tread.length]);

    if (i % 2 === 0) {
      // A second much smaller sliver breaks up each earthy margin.
      const moss = aprons[(i + 1) % aprons.length];
      add([x - width * 0.40, 0.087, -0.038],
        [x + width * 0.26, 0.087, 0.004],
        [x - width * 0.13, 0.087, -0.006], moss);
    }
    if (i % 2 === 1) {
      // Low upright leaf tips interrupt the ruler-straight grass silhouette.
      const leaf = palette[(i + 2) % grass.length];
      add([x - 0.065, 0.005, depth * 0.62],
        [x + 0.065, 0.005, depth * 0.62],
        [x + lean, 0.16 + hash(i, 19, 607) * 0.075, depth * 0.82], leaf);
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
 * One InstancedMesh for every genuine outer road edge, never along a seam
 * between two paving cells or outside the authored map. Decor is visual only:
 * no new blocked cells, ray targets, physics, movement rules or frame work.
 */
export function createBannerRoadShoulders({
  grid = [], roadCells = [], center = { x: 0, y: 0 }, coarsePointer = false,
} = {}) {
  const roads = new Set(roadCells
    .filter(({ x, y }) => grid[y]?.[x] === '.')
    .map(({ x, y }) => x + ',' + y));
  const edges = [];
  for (const key of roads) {
    const [x, y] = key.split(',').map(Number);
    for (const direction of DIRECTIONS) {
      const nx = x + direction.dx;
      const ny = y + direction.dy;
      if (grid[ny]?.[nx] === undefined || roads.has(nx + ',' + ny)) continue;
      edges.push({ x, y, ...direction });
    }
  }
  if (!edges.length) return null;

  const geometry = chroniclesRoadsideShoulderGeometry({ coarsePointer });
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, side: THREE.DoubleSide,
    roughness: 1, metalness: 0,
  });
  const mesh = new THREE.InstancedMesh(geometry, mat, edges.length);
  mesh.name = 'chronicles-banner-road-shoulders';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const tints = ['#ffffff', '#e7e8d7', '#dbe3d0', '#eee4d0']
    .map(hex => new THREE.Color(hex));
  edges.forEach(({ x, y, dx, dy, yaw }, i) => {
    // The dirt track ends 1.32m from its centreline. The verge starts
    // 2cm beyond it; flat moss tongues alone cross the visual edge.
    // The 4m navigation grid stays intact.
    const edge = CELL * 0.335;
    dummy.position.set((x - center.x) * CELL + dx * edge, -0.052,
      (y - center.y) * CELL + dy * edge);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(0.92 + hash(x, y, 619) * 0.12, 1,
      0.80 + hash(x + dx, y + dy, 623) * 0.34);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, tints[Math.floor(hash(x, y, 627 + (dx + 2) * 5 + dy) * tints.length)]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  return mesh;
}
