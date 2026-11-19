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
 * A single opaque shoulder surface for all exposed sides of Banner Road.
 * Low mossy triangles, loam and a handful of blades soften the hard, straight
 * paving edge without altering the underlying 4m movement/collision grid.
 * Geometry is shared by every edge; touch uses fewer leaf/patina triangles.
 *
 * Local +Z points away from the road. Most vertices lie ~0.02-0.55m into
 * the grass. Straight stone sections narrow to 3.28m, placing the shoulder
 * at the actual pavement edge rather than the unchanged 4m navigation cell.
 * A few tiny patina tongues overlap < 0.09m of the paving surface,
 * leaving the usable, legible road completely unobstructed.
 */
export function chroniclesRoadsideShoulderGeometry({ coarsePointer = false } = {}) {
  const positions = [];
  const colors = [];
  const grass = ['#637e44', '#78884e', '#50693b', '#829461'];
  const soil = ['#857754', '#706747'];
  const palette = [...grass, ...soil].map(hex => new THREE.Color(hex));
  const add = (a, b, c, shade) => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i += 1) {
      colors.push(shade.r, shade.g, shade.b);
    }
  };

  const patches = coarsePointer ? 4 : 9;
  for (let i = 0; i < patches; i += 1) {
    const x = ((i + 0.5) / patches - 0.5) * 3.45;
    const width = (3.45 / patches) * (0.38 + hash(i, 11, 601) * 0.06);
    const depth = 0.17 + hash(i, 13, 603) * 0.32;
    const lean = (hash(i, 17, 605) - 0.5) * width * 0.9;
    const a = [x - width, 0, 0.012];
    const b = [x + width, 0, 0.012];
    const c = [x + width * 0.55 + lean, 0, depth];
    const d = [x - width * 0.70 + lean, 0, depth * 0.76];
    const shade = palette[(i * 3) % palette.length];
    // Wind both triangles upward for reliable overhead lighting.
    add(a, c, b, shade);
    add(a, d, c, shade);

    if (i % 2 === 0) {
      // Only a few centimeters of moss creep across the cobble edge.
      const moss = palette[(i + 1) % grass.length];
      add([x - width * 0.52, 0.087, -0.075],
        [x + width * 0.32, 0.087, -0.008],
        [x - width * 0.16, 0.087, -0.011], moss);
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
    // Centre of the low moss strip follows the narrowed 3.28m cobble edge.
    // The paved road keeps its original length, and the 4m grid stays intact.
    const edge = CELL * 0.415;
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
