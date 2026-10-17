import * as THREE from 'three';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';
import { chroniclesMaterialEnvironmentForMapId } from './chroniclesMaterialAtlas.js';

// Small props along dungeon walls: barrels and crates in the mines, bones
// and urns in crypts, rubble and glowing mushrooms in caves, book stacks and
// candles in the Tower of Names. Every prop leans against a wall inside a
// walkable cell and stays below waist height, so it never reads as a
// blocker; the grid is still the only collision. Instanced, deterministic.

const CELL = 4;
const box = new THREE.Object3D();

function noise(x, y, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

const lit = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.03, ...opts });
const tex = (kind) => chroniclesPixelTexture(kind);

const PARTS = {
  barrel: () => [new THREE.CylinderGeometry(0.34, 0.3, 0.9, 10), lit(0xc89a6a, { map: tex('timber') })],
  hoop: () => [new THREE.TorusGeometry(0.34, 0.025, 4, 12), lit(0x3a3632, { metalness: 0.5 })],
  crate: () => [new THREE.BoxGeometry(0.7, 0.6, 0.7), lit(0xd8b88a, { map: tex('timber') })],
  urn: () => [new THREE.CylinderGeometry(0.18, 0.26, 0.6, 9), lit(0xa8664a, { flatShading: true })],
  bone: () => [new THREE.CylinderGeometry(0.035, 0.035, 0.5, 5), lit(0xe6dcc0)],
  skull: () => [new THREE.IcosahedronGeometry(0.13, 1), lit(0xeee6d0, { flatShading: true })],
  rubble: () => [new THREE.IcosahedronGeometry(0.22, 0), lit(0xb0a898, { map: tex('rock'), flatShading: true })],
  mushroom: () => [new THREE.SphereGeometry(0.14, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), lit(0x8ad0c0, { emissive: 0x1a8a7a, emissiveIntensity: 0.9 })],
  stem: () => [new THREE.CylinderGeometry(0.03, 0.04, 0.22, 5), lit(0xd8d4c4)],
  puddle: () => [new THREE.CircleGeometry(0.6, 12), lit(0x10181a, { roughness: 0.1, metalness: 0.2 })],
  book: () => [new THREE.BoxGeometry(0.34, 0.08, 0.26), lit(0x8a3a2e)],
  bookBlue: () => [new THREE.BoxGeometry(0.32, 0.07, 0.24), lit(0x34507a)],
  candle: () => [new THREE.CylinderGeometry(0.04, 0.04, 0.24, 6), lit(0xf0e8d0)],
  flame: () => [new THREE.ConeGeometry(0.035, 0.1, 5), lit(0xffc060, { emissive: 0xff9a30, emissiveIntensity: 1.8 })],
  ember: () => [new THREE.BoxGeometry(0.1, 0.05, 0.1), lit(0xff7a2a, { emissive: 0xff5a10, emissiveIntensity: 1.2 })],
  ore: () => [new THREE.IcosahedronGeometry(0.18, 0), lit(0x6a5a4a, { emissive: 0x3a1a04, emissiveIntensity: 0.5, flatShading: true })],
};

function createPlacer() {
  const parts = new Map();
  const add = (part, [x, y, z], { yaw = 0, tilt = 0, roll = 0, scale = 1 } = {}) => {
    box.position.set(x, y, z);
    box.rotation.set(tilt, yaw, roll);
    if (Array.isArray(scale)) box.scale.set(scale[0], scale[1], scale[2]);
    else box.scale.setScalar(scale);
    box.updateMatrix();
    if (!parts.has(part)) parts.set(part, []);
    parts.get(part).push(box.matrix.clone());
  };
  return { add, parts };
}

// Each prop is drawn at (px, pz) with `yaw` facing away from its wall.
const PROPS = {
  barrel(p, px, pz, yaw) {
    p.add('barrel', [px, 0.45, pz], { yaw });
    p.add('hoop', [px, 0.2, pz], { tilt: Math.PI / 2 });
    p.add('hoop', [px, 0.72, pz], { tilt: Math.PI / 2, scale: 0.94 });
  },
  crates(p, px, pz, yaw, s) {
    p.add('crate', [px, 0.3, pz], { yaw: yaw + s * 0.4 });
    if (s > 0.5) p.add('crate', [px + 0.1, 0.84, pz], { yaw: yaw - 0.3, scale: 0.75 });
  },
  urns(p, px, pz, yaw, s) {
    p.add('urn', [px - 0.25, 0.3, pz], { yaw });
    p.add('urn', [px + 0.25, 0.25, pz + 0.1], { yaw, scale: 0.8 });
    if (s > 0.6) p.add('urn', [px, 0.13, pz + 0.35], { roll: Math.PI / 2, scale: 0.8 });
  },
  bones(p, px, pz, yaw, s) {
    for (let k = 0; k < 4; k += 1) {
      p.add('bone', [px + (noise(k, s * 9) - 0.5) * 0.7, 0.04, pz + (noise(s * 7, k) - 0.5) * 0.6],
        { yaw: noise(k, k, s) * 6.28, roll: Math.PI / 2 });
    }
    p.add('skull', [px, 0.12, pz], { yaw });
  },
  rubble(p, px, pz, yaw, s) {
    for (let k = 0; k < 4; k += 1) {
      p.add('rubble', [px + (noise(k, s * 5) - 0.5) * 0.9, 0.12, pz + (noise(s * 3, k) - 0.5) * 0.7],
        { yaw: k + s, scale: 0.7 + noise(k, s) * 0.9 });
    }
  },
  mushrooms(p, px, pz, yaw, s) {
    for (let k = 0; k < 3; k += 1) {
      const ox = (noise(k, s * 4) - 0.5) * 0.6;
      const oz = (noise(s * 2, k) - 0.5) * 0.4;
      const h = 0.7 + noise(k, s) * 0.8;
      p.add('stem', [px + ox, 0.11 * h, pz + oz], { scale: [1, h, 1] });
      p.add('mushroom', [px + ox, 0.22 * h, pz + oz], { scale: h });
    }
  },
  puddle(p, px, pz) {
    p.add('puddle', [px, 0.015, pz], { tilt: -Math.PI / 2, scale: [1.2, 0.8, 1] });
  },
  books(p, px, pz, yaw, s) {
    const count = 3 + Math.floor(s * 4);
    for (let k = 0; k < count; k += 1) {
      p.add(k % 2 ? 'bookBlue' : 'book', [px, 0.04 + k * 0.075, pz], { yaw: yaw + (noise(k, s) - 0.5) * 0.6 });
    }
    p.add('candle', [px + 0.3, 0.12, pz + 0.15]);
    p.add('flame', [px + 0.3, 0.29, pz + 0.15]);
  },
  candles(p, px, pz, yaw, s) {
    for (let k = 0; k < 3; k += 1) {
      const ox = (k - 1) * 0.18;
      const h = 0.7 + noise(k, s) * 0.8;
      p.add('candle', [px + ox, 0.12 * h, pz], { scale: [1, h, 1] });
      p.add('flame', [px + ox, 0.24 * h + 0.05, pz]);
    }
  },
  embers(p, px, pz, yaw, s) {
    for (let k = 0; k < 5; k += 1) p.add('ember', [px + (noise(k, s) - 0.5), 0.03, pz + (noise(s, k) - 0.5) * 0.6], { yaw: k });
  },
  ore(p, px, pz, yaw, s) {
    for (let k = 0; k < 3; k += 1) p.add('ore', [px + (k - 1) * 0.25, 0.14, pz + (noise(k, s) - 0.5) * 0.3], { yaw: k + s });
  },
};

const THEMES = {
  dungeon: ['bones', 'urns', 'rubble', 'candles'],
  cave: ['rubble', 'mushrooms', 'bones', 'rubble'],
  'cave-water': ['puddle', 'mushrooms', 'rubble', 'puddle'],
  'castle-interior': ['books', 'candles', 'crates', 'books'],
  'iron-foundry': ['crates', 'barrel', 'ore', 'rubble'],
  'ash-ruin': ['rubble', 'embers', 'bones', 'urns'],
  'sewer-masonry': ['barrel', 'rubble', 'puddle', 'crates'],
  'black-glass': ['rubble', 'candles'],
};

const SIDES = [
  { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
];

/**
 * @param {object} options { grid, center, mapId, keepClear: [{x,y}], density, coarsePointer }
 */
export function buildChroniclesDungeonClutter({ grid = [], center = { x: 0, y: 0 }, mapId = '', keepClear = [], density = 0.4, coarsePointer = false } = {}) {
  const group = new THREE.Group();
  group.name = 'chronicles-dungeon-clutter';
  const theme = THEMES[chroniclesMaterialEnvironmentForMapId(mapId)] || THEMES.dungeon;
  const clear = new Set(keepClear.map(({ x, y }) => x + ',' + y));
  const p = createPlacer();
  const chance = coarsePointer ? density * 0.6 : density;
  grid.forEach((row, y) => [...row].forEach((tile, x) => {
    if (tile === '#' || clear.has(x + ',' + y) || noise(x, y, 3) >= chance) return;
    const walls = SIDES.filter(({ dx, dy }) => grid[y + dy]?.[x + dx] === '#');
    if (!walls.length) return;
    const wall = walls[Math.floor(noise(x, y, 5) * walls.length)];
    // 1.4 m from the centre toward the wall, slid sideways a little.
    const side = (noise(x, y, 7) - 0.5) * 1.6;
    const wx = (x - center.x) * CELL + wall.dx * 1.4 + (wall.dy !== 0 ? side : 0);
    const wz = (y - center.y) * CELL + wall.dy * 1.4 + (wall.dx !== 0 ? side : 0);
    const yaw = Math.atan2(-wall.dx, -wall.dy);
    const kind = theme[Math.floor(noise(x, y, 11) * theme.length)];
    PROPS[kind](p, wx, wz, yaw, noise(x, y, 13));
  }));
  for (const [part, matrices] of p.parts) {
    const [geometry, mat] = PARTS[part]();
    const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = 'chronicles-dungeon-' + part;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
