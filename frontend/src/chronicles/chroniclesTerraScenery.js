import * as THREE from 'three';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';

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

// Parts: one geometry + one material each, instanced across the map.
function partCatalog() {
  const rock = (color) => lit(color, { map: texture('rock'), flatShading: true });
  return {
    boulder: () => [new THREE.IcosahedronGeometry(1, 0), rock(0xd8d2c4)],
    boulderDark: () => [new THREE.IcosahedronGeometry(1, 0), rock(0x8a857c)],
    boulderSnow: () => [new THREE.IcosahedronGeometry(1, 0), lit(0xf2f6fa, { map: texture('snow'), flatShading: true })],
    crag: () => [new THREE.ConeGeometry(0.9, 3, 5), rock(0xc8c0b0)],
    basalt: () => [new THREE.CylinderGeometry(0.42, 0.48, 1, 6), lit(0x8a7c74, { map: texture('rock'), flatShading: true })],
    emberRock: () => [new THREE.IcosahedronGeometry(1, 0), lit(0x5a4a44, { map: texture('rock'), flatShading: true, emissive: 0x5a1c04, emissiveIntensity: 0.35 })],
    trunk: () => [new THREE.CylinderGeometry(0.2, 0.32, 1, 7), lit(0xffffff, { map: texture('bark', 2, 3) })],
    crown: () => [new THREE.IcosahedronGeometry(1, 1), lit(0xd8e6c8, { map: texture('leaves', 3, 3), flatShading: true })],
    bush: () => [new THREE.IcosahedronGeometry(1, 0), lit(0xb8cca8, { map: texture('leaves', 2, 2), flatShading: true })],
    pine: () => [new THREE.ConeGeometry(1, 1, 8), lit(0x9cb09c, { map: texture('leaves', 5, 2) })],
    pineSnow: () => [new THREE.ConeGeometry(1, 1, 8), lit(0xf4f8fc, { map: texture('snow', 3, 1) })],
    deadTrunk: () => [new THREE.CylinderGeometry(0.14, 0.26, 1, 6), lit(0xcab8a0, { map: texture('bark', 1, 3) })],
    reed: () => [new THREE.CylinderGeometry(0.035, 0.05, 1, 4), lit(0xb2a65e)],
    pool: () => [new THREE.CylinderGeometry(1, 1, 0.06, 14), lit(0x1c2a26, { roughness: 0.18, metalness: 0.1 })],
    dune: () => [new THREE.SphereGeometry(1, 10, 6), lit(0xffffff, { map: texture('sand', 2, 2) })],
    drift: () => [new THREE.CylinderGeometry(0.16, 0.2, 1, 6), lit(0xa89a86, { map: texture('bark', 1, 2) })],
    // Walkable clutter.
    tuft: () => [new THREE.ConeGeometry(0.16, 0.42, 4), lit(0x6e9a3e)],
    flower: () => [new THREE.IcosahedronGeometry(0.09, 0), lit(0xe8c84a, { emissive: 0x2a2208 })],
    pebble: () => [new THREE.IcosahedronGeometry(0.22, 0), rock(0xbab2a2)],
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

function broadleaf(p, wx, wz, x, y, k, scale = 1) {
  const s = scale * (0.85 + noise(x, y, k + 21) * 0.45);
  const ox = (noise(x, y, k + 23) - 0.5) * 2;
  const oz = (noise(y, x, k + 25) - 0.5) * 2;
  p.add('trunk', [wx + ox, 1.5 * s, wz + oz], { scale: [s, 3 * s, s] });
  p.add('crown', [wx + ox, 3.9 * s, wz + oz], { yaw: noise(x, y, k) * 6.28, scale: [1.9 * s, 1.6 * s, 1.9 * s] });
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

const DRESS = {
  plains(p, wx, wz, x, y, big) {
    const roll = noise(x, y, 1);
    if (roll < 0.5) broadleaf(p, wx, wz, x, y, 0, big ? 1.15 : 1);
    if (roll >= 0.35) {
      p.add('bush', [wx + (noise(x, y, 2) - 0.5) * 2.4, 0.55, wz + (noise(y, x, 2) - 0.5) * 2.4],
        { yaw: noise(x, y, 3) * 6.28, scale: [1.3, 0.8, 1.1] });
    }
    if (roll >= 0.7 || big) boulders(p, wx, wz, x, y, { count: 1, size: 1.0 });
    if (roll < 0.2) broadleaf(p, wx, wz, x, y, 9, big ? 1.1 : 0.9);
  },
  hills(p, wx, wz, x, y, big) {
    boulders(p, wx, wz, x, y, { count: 2, size: big ? 1.6 : 1.35, height: 1.1 });
    if (noise(x, y, 4) > 0.55) p.add('crag', [wx + (noise(x, y, 5) - 0.5) * 1.6, 1.4, wz + (noise(y, x, 5) - 0.5) * 1.6], { yaw: noise(x, y, 6) * 6.28, scale: [1, 0.9 + noise(x, y, 8), 1] });
    if (noise(x, y, 7) > 0.7) p.add('bush', [wx, 0.45, wz + 1.2], { scale: [0.9, 0.6, 0.9] });
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

const CLUTTER = {
  plains: (p, wx, wz, x, y) => {
    p.add('tuft', [wx, 0.2, wz], { yaw: noise(x, y, 70) * 6.28 });
    if (noise(x, y, 71) > 0.6) p.add('flower', [wx + 0.3, 0.1, wz + 0.2]);
  },
  forest: (p, wx, wz, x, y) => p.add('tuft', [wx, 0.2, wz], { yaw: noise(x, y, 70) * 6.28, scale: [1.2, 1.3, 1.2] }),
  hills: (p, wx, wz, x, y) => p.add('pebble', [wx, 0.1, wz], { yaw: noise(x, y, 70) * 6.28, scale: [1, 0.6, 1] }),
  snow: (p, wx, wz, x, y) => p.add('snowMound', [wx, 0, wz], { scale: [0.9 + noise(x, y, 70), 0.35, 0.8] }),
  coast: (p, wx, wz, x, y) => p.add('pebble', [wx, 0.08, wz], { yaw: noise(x, y, 70) * 6.28, scale: [0.8, 0.5, 0.8] }),
  marsh: (p, wx, wz, x, y) => p.add('tuft', [wx, 0.2, wz], { yaw: noise(x, y, 70) * 6.28, scale: [1, 1.4, 1] }),
  ash: (p, wx, wz, x, y) => p.add('ember', [wx, 0.03, wz], { yaw: noise(x, y, 70) * 6.28 }),
};

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
export function buildTerraScenery({ grid = [], center, biome, scenery = [], coarsePointer = false, dressBlocked = true, keepClear = [] }) {
  const group = new THREE.Group();
  group.name = 'chronicles-terra-scenery';
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const dress = DRESS[biome];
  const clutter = CLUTTER[biome];
  const p = createPlacer();
  const toWorld = (x, y) => [(x - center.x) * CELL, (y - center.y) * CELL];
  const clear = new Set(keepClear.map(({ x, y }) => x + ',' + y));

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
        dress(p, wx, wz, x, y, !inside);
      } else if (clutter && !coarsePointer && !clear.has(x + ',' + y) && noise(x, y, 77) < 0.28) {
        // Off-centre, so roads and the cell where the camera stands stay clear.
        clutter(p, wx + (noise(x, y, 78) - 0.5) * 3, wz + (noise(y, x, 79) - 0.5) * 3, x, y);
      }
    }
  }

  const catalog = partCatalog();
  for (const [part, matrices] of p.parts) {
    const [geometry, mat] = catalog[part]();
    const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = 'chronicles-terra-' + part;
    const small = ['tuft', 'flower', 'pebble', 'snowMound', 'ember', 'flame', 'reed'].includes(part);
    mesh.castShadow = !coarsePointer && !small;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function chroniclesTerraSceneryBiomes() {
  return Object.keys(DRESS);
}
