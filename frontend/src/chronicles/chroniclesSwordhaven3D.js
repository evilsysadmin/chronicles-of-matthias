import * as THREE from 'three';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';
import { chroniclesTownSurfacePixels } from './chroniclesTownSurfacePixels.js';
import { dressSwordhavenWindowBoxes } from './chroniclesSwordhavenFoliage.js';
import { dressSwordhavenPremiumHouse } from './chroniclesSwordhavenPremiumHouses.js';

// Authored in grid coordinates: future map collision must reserve these footprints.
export const SWORDHAVEN_BUILDINGS = Object.freeze([
  Object.freeze({ id: 'swordhaven-forge', label: 'Armería', x: 4, y: 5, roof: 0x8a4632, emblem: 'swords' }),
  Object.freeze({ id: 'swordhaven-armor', label: 'Armaduras', x: 14, y: 5, roof: 0x4a657e, emblem: 'shield' }),
  Object.freeze({ id: 'swordhaven-tavern', label: 'Taberna', x: 4, y: 13, roof: 0x995e37, emblem: 'mug' }),
  Object.freeze({ id: 'swordhaven-magic', label: 'Magia', x: 14, y: 13, roof: 0x554481, emblem: 'crystal' }),
  Object.freeze({ id: 'swordhaven-temple', label: 'Templo', x: 9, y: 3, roof: 0x65758a, emblem: 'sun' }),
]);

const CELL = 4;

export const SWORDHAVEN_INTERACTION_CELLS = Object.freeze([
  Object.freeze({ id: 'swordhaven-forge', x: 4, y: 7 }),
  Object.freeze({ id: 'swordhaven-armor', x: 14, y: 7 }),
  Object.freeze({ id: 'swordhaven-tavern', x: 4, y: 15 }),
  Object.freeze({ id: 'swordhaven-magic', x: 14, y: 15 }),
  Object.freeze({ id: 'swordhaven-temple', x: 9, y: 5 }),
]);

export const SWORDHAVEN_SPAWN = Object.freeze({ x: 9, y: 16, direction: 0 });
export const SWORDHAVEN_GATE_CELL = Object.freeze({ x: 9, y: 17 });

// Grid is the collision contract for the eventually-authored manifest:
// no visual houses/trees/fountain may occupy a walkable tile.
export function createSwordhavenWalkGrid() {
  const size = 19;
  const grid = Array.from({ length: size }, (_, y) => (
    Array.from({ length: size }, (_, x) => (
      x === 0 || y === 0 || x === size - 1 || y === size - 1 ? '#' : '.'
    ))
  ));
  SWORDHAVEN_BUILDINGS.forEach(({ x, y }) => {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) grid[y + dy][x + dx] = '#';
    }
  });
  // The fountain and tree-trunks are real obstacles, not hidden hitboxes.
  grid[9][9] = '#';
  for (const [x, y] of [[1,1],[17,1],[1,17],[17,17],[3,9],[15,9],[7,16],[12,16]]) {
    grid[y][x] = '#';
  }
  return Object.freeze(grid.map(row => row.join('')));
}

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.86, metalness: 0.03, ...extra,
});


// The meadow and wilderness retain their deliberately pixelated texture.
export function swordhavenGrassTexture() {
  const texture = chroniclesPixelTexture('grass');
  texture.repeat.set(20, 20);
  return texture;
}

const SURFACE_REPEAT = Object.freeze({ stucco: 2, masonry: 3, brick: 3, roof: 3, timber: 3, cobble: 1 });
const surfaceCache = new Map();
const surfaceNormalCache = new Map();

// Cached tangent-space relief for masonry, cobbles, roof and limewash.
// Axes/repeat match the albedo; detail needs no extra geometry.
export function swordhavenSurfaceNormalTexture(kind) {
  if (kind !== 'masonry' && kind !== 'brick' && kind !== 'cobble' && kind !== 'roof' && kind !== 'stucco') {
    throw new Error('Unsupported Swordhaven relief: ' + kind);
  }
  if (surfaceNormalCache.has(kind)) return surfaceNormalCache.get(kind);
  const { size, normals } = chroniclesTownSurfacePixels(kind);
  const texture = new THREE.DataTexture(normals, size, size, THREE.RGBAFormat);
  texture.name = 'chronicles-town-normal-' + kind;
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(SURFACE_REPEAT[kind], SURFACE_REPEAT[kind]);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  surfaceNormalCache.set(kind, texture);
  return texture;
}

// Town-only fine albedo: reusable deterministic ashlar, planks and paving.
// Linear mipmaps tame crawling mortar lines in the first-person camera.
export function swordhavenSurfaceTexture(kind) {
  if (!SURFACE_REPEAT[kind]) throw new Error('Unsupported Swordhaven material: ' + kind);
  if (surfaceCache.has(kind)) return surfaceCache.get(kind);
  const { size, pixels } = chroniclesTownSurfacePixels(kind);
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = 'chronicles-town-' + kind;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(SURFACE_REPEAT[kind], SURFACE_REPEAT[kind]);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.userData.chroniclesTownSurface = { kind, size };
  surfaceCache.set(kind, texture);
  return texture;
}

// The dome moves with the camera but never rotates with it: the sun stays in
// the same compass direction and the horizon remains stable while walking.
export function createSwordhavenSkyDome(sunDirection) {
  const geometry = new THREE.SphereGeometry(62, 64, 32);
  const coords = geometry.getAttribute('position');
  const colors = [];
  const direction = new THREE.Vector3();
  const zenith = new THREE.Color(0x65a6d0);
  const horizon = new THREE.Color(0xb8dce9);
  const warm = new THREE.Color(0xffe4b0);
  const color = new THREE.Color();
  for (let i = 0; i < coords.count; i += 1) {
    direction.fromBufferAttribute(coords, i).normalize();
    const altitude = THREE.MathUtils.smoothstep(direction.y, -0.08, 0.75);
    const sunlight = Math.pow(Math.max(direction.dot(sunDirection), 0), 30) * 0.54;
    color.copy(horizon).lerp(zenith, altitude).lerp(warm, sunlight);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0xffffff, side: THREE.BackSide, vertexColors: true,
    fog: false, toneMapped: false, depthWrite: false,
  }));
  sky.name = 'swordhaven-sky-dome';
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  const solarFacing = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), sunDirection,
  );
  for (const [name, radius, opacity, order] of [
    ['swordhaven-sun-halo', 5.6, 0.22, -99],
    ['swordhaven-sun-disc', 1.45, 1, -98],
  ]) {
    const glow = new THREE.Mesh(new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({
        color: name === 'swordhaven-sun-disc' ? 0xfff8db : 0xffdfb2,
        transparent: opacity < 1, opacity, depthWrite: false,
        depthTest: true, fog: false, toneMapped: false, side: THREE.DoubleSide,
      }));
    glow.name = name;
    glow.renderOrder = order;
    glow.position.copy(sunDirection).multiplyScalar(name === 'swordhaven-sun-disc' ? 57.5 : 59);
    glow.quaternion.copy(solarFacing);
    sky.add(glow);
  }
  sky.onBeforeRender = (_renderer, _scene, camera) => {
    sky.position.copy(camera.position);
    sky.updateMatrixWorld();
  };
  return sky;
}

function mesh(group, geometry, mat, name, position, shadow = false) {
  const piece = new THREE.Mesh(geometry, mat);
  piece.name = name;
  piece.position.set(...position);
  piece.castShadow = shadow;
  piece.receiveShadow = true;
  group.add(piece);
  return piece;
}

function worldPoint(x, y, center) {
  return [(x - center.x) * CELL, (y - center.y) * CELL];
}


const SHOP_LETTERS = Object.freeze({
  A: [14,17,17,31,17,17,17], B: [30,17,17,30,17,17,30],
  C: [15,16,16,16,16,16,15], D: [30,17,17,17,17,17,30],
  E: [31,16,16,30,16,16,31], F: [31,16,16,30,16,16,16],
  G: [15,16,16,23,17,17,15], H: [17,17,17,31,17,17,17],
  I: [31,4,4,4,4,4,31], J: [7,2,2,2,18,18,12],
  K: [17,18,20,24,20,18,17], L: [16,16,16,16,16,16,31],
  M: [17,27,21,21,17,17,17], N: [17,25,21,19,17,17,17],
  O: [14,17,17,17,17,17,14], P: [30,17,17,30,16,16,16],
  Q: [14,17,17,17,21,18,13], R: [30,17,17,30,20,18,17],
  S: [15,16,16,14,1,1,30], T: [31,4,4,4,4,4,4],
  U: [17,17,17,17,17,17,14], V: [17,17,17,17,17,10,4],
  W: [17,17,17,21,21,21,10], X: [17,17,10,4,10,17,17],
  Y: [17,17,10,4,4,4,4], Z: [31,1,2,4,8,16,31],
});
const SHOP_SIGN_TEXTURES = new Map();
// Service-specific paint makes the otherwise shared wooden nameplates legible
// as distinct trades from street level. Three high-contrast colours per sign;
// the same cached 256x64 atlas, geometry and interaction contract are retained.
const SHOP_SIGN_THEMES = Object.freeze({
  default: { border: [165, 116, 55], background: [43, 30, 20], letters: [247, 219, 164] },
  swords: { border: [159, 113, 80], background: [42, 36, 32], letters: [250, 218, 161] },
  shield: { border: [147, 172, 184], background: [34, 50, 64], letters: [238, 243, 239] },
  mug: { border: [181, 126, 74], background: [75, 40, 30], letters: [255, 225, 162] },
  crystal: { border: [159, 130, 197], background: [45, 32, 76], letters: [237, 220, 255] },
  sun: { border: [203, 177, 114], background: [55, 52, 55], letters: [255, 239, 179] },
  apothecary: { border: [141, 175, 127], background: [36, 65, 49], letters: [238, 245, 208] },
  store: { border: [179, 137, 80], background: [72, 52, 35], letters: [250, 228, 178] },
  watch: { border: [146, 164, 171], background: [40, 52, 61], letters: [238, 240, 229] },
  civic: { border: [182, 158, 116], background: [58, 55, 47], letters: [250, 229, 184] },
});
const SHOP_EMBLEM_LABELS = Object.freeze({
  swords: 'ARMERIA', shield: 'ARMADURAS', mug: 'TABERNA',
  crystal: 'MAGIA', sun: 'TEMPLO', sack: 'TIENDA',
});

function swordhavenShopName(spec) {
  return String(spec.label || SHOP_EMBLEM_LABELS[spec.emblem] || 'COMERCIO')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z ]/g, ' ').trim().slice(0, 18);
}

// A tiny deterministic pixel-font atlas: no web fonts, canvas or per-frame
// texture generation. Shared by houses with the same service label.
function swordhavenShopLabelTexture(label, theme = 'default') {
  const key = theme + ':' + label;
  if (SHOP_SIGN_TEXTURES.has(key)) return SHOP_SIGN_TEXTURES.get(key);
  const palette = SHOP_SIGN_THEMES[theme] || SHOP_SIGN_THEMES.default;
  const width = 256;
  const height = 64;
  const pixels = new Uint8Array(width * height * 4);
  function paint(x, y, color) {
    const offset = (y * width + x) * 4;
    pixels[offset] = color[0]; pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2]; pixels[offset + 3] = 255;
  }
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const edge = x < 4 || y < 4 || x >= width - 4 || y >= height - 4;
    paint(x, y, edge ? palette.border : palette.background);
  }
  const scale = Math.max(2, Math.min(4, Math.floor(236 / (Math.max(1, label.length) * 6))));
  const startX = Math.floor((width - (label.length * 6 - 1) * scale) / 2);
  const startY = Math.floor((height - 7 * scale) / 2);
  for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
    const rows = SHOP_LETTERS[label[charIndex]] || [];
    rows.forEach((bits, row) => {
      for (let col = 0; col < 5; col += 1) {
        if (!(bits & (1 << (4 - col)))) continue;
        for (let dy = 0; dy < scale; dy += 1) for (let dx = 0; dx < scale; dx += 1) {
          paint(startX + (charIndex * 6 + col) * scale + dx,
            startY + (6 - row) * scale + dy, palette.letters);
        }
      }
    });
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'swordhaven-shop-sign-' + theme + '-' + label;
  SHOP_SIGN_TEXTURES.set(key, texture);
  return texture;
}

function emblem(group, kind, mats) {
  const gold = mats.gold;
  if (kind === 'swords') {
    for (const tilt of [-0.65, 0.65]) {
      const sword = mesh(group, new THREE.BoxGeometry(0.11, 0.9, 0.1), gold, 'crossed-sword', [0, 0, 0.1]);
      sword.rotation.z = tilt;
    }
  } else if (kind === 'shield') {
    const shape = new THREE.Shape();
    shape.moveTo(-0.4, 0.35); shape.lineTo(0.4, 0.35); shape.lineTo(0.32, -0.2);
    shape.lineTo(0, -0.52); shape.lineTo(-0.32, -0.2); shape.closePath();
    mesh(group, new THREE.ShapeGeometry(shape), gold, 'shield-emblem', [0, 0, 0.20]);
  } else if (kind === 'watch') {
    // Crossed steel watch-halberds distinguish the guard barracks from the
    // armorer's shield. Lift the relief clear of the inset's front surface.
    for (const tilt of [-0.48, 0.48]) {
      const shaft = mesh(group, new THREE.BoxGeometry(0.10, 0.94, 0.10),
        mats.steel, 'watch-crossed-halberd', [0, -0.03, 0.22]);
      shaft.rotation.z = tilt;
      const tip = mesh(group, new THREE.ConeGeometry(0.14, 0.28, 4),
        gold, 'watch-halberd-tip',
        [-Math.sin(tilt) * 0.46, Math.cos(tilt) * 0.46, 0.23]);
      tip.rotation.z = tilt;
    }
  } else if (kind === 'mug') {
    mesh(group, new THREE.BoxGeometry(0.57, 0.57, 0.12), gold, 'tankard', [-0.1, 0, 0.1]);
    mesh(group, new THREE.TorusGeometry(0.2, 0.06, 5, 12), gold, 'tankard-handle', [0.31, 0, 0.1]);
  } else if (kind === 'crystal') {
    mesh(group, new THREE.OctahedronGeometry(0.45, 0),
      material(0xa78aff, { emissive: 0x423377, emissiveIntensity: 0.6 }), 'arcane-crystal', [0, 0, 0.12]);
  } else if (kind === 'sack') {
    mesh(group, new THREE.SphereGeometry(0.34, 10, 8), gold, 'grain-sack', [0, -0.08, 0.12]).scale.set(1, 1.15, 0.5);
    mesh(group, new THREE.CylinderGeometry(0.09, 0.14, 0.2, 8), gold, 'grain-sack-neck', [0, 0.32, 0.12]);
  } else if (kind === 'sun') {
    mesh(group, new THREE.SphereGeometry(0.27, 10, 8), gold, 'temple-sun', [0, 0, 0.13]);
    mesh(group, new THREE.TorusGeometry(0.42, 0.045, 5, 16), gold, 'temple-halo', [0, 0, 0.13]);
  } else if (kind === 'civic') {
    // A small castellated civic seal: instantly distinct from the temple sun.
    mesh(group, new THREE.BoxGeometry(0.70, 0.49, 0.12), gold, 'civic-seal-tower', [0, -0.11, 0.12]);
    for (const x of [-0.27, 0, 0.27]) {
      mesh(group, new THREE.BoxGeometry(0.17, 0.21, 0.12), gold,
        'civic-seal-battlement', [x, 0.25, 0.12]);
    }
  }
}

// Distinct stone courses give nearby entrances real silhouette depth instead
// of three perfectly smooth cuboids. One instanced batch per building covers
// the recessed portal, window lintels and the exposed foundation frontage.
// All placements are local to the same original wall and do not add colliders.
function dressSwordhavenFacadeMasonry(root, { mats, width, depth, facadeZ, coarse }) {
  const blocks = [];
  const place = (x, y, z, w, h, d, tone) => {
    blocks.push({ x, y, z, w, h, d, tone });
  };
  // Six stone courses per jamb. Their narrow mortar gaps are visible at eye
  // height, and the alternating widths imply hand-dressed blocks.
  for (const side of [-1, 1]) {
    for (let course = 0; course < 6; course += 1) {
      place(side * (0.985 + (course % 2) * 0.012), 0.265 + course * 0.495,
        facadeZ + 0.28, 0.32 + (course % 3) * 0.014, 0.472, 0.35,
        (course + (side > 0 ? 1 : 0)) % 4);
    }
  }
  // Three crown stones and a restrained central keystone, beneath the sign.
  for (const [i, x] of [-0.75, 0, 0.75].entries()) {
    place(x, 3.215, facadeZ + 0.27, 0.73, 0.235, 0.43, (i + 1) % 4);
  }
  place(0, 3.395, facadeZ + 0.25, 0.30, 0.23, 0.36, 2);

  // Window heads throw a short, genuine depth shadow on the leaded glass.
  // The existing sills and timber rails are left alone.
  for (const side of [-1, 1]) {
    const x = side * width * 0.33;
    place(x, 3.455, facadeZ + 0.245, 1.72, 0.18, 0.32, 1);
    for (const dx of [-0.70, 0.70]) {
      place(x + dx, 3.345, facadeZ + 0.225, 0.18, 0.27, 0.28, 3);
    }
  }

  // Raised, staggered ashlar frontage over the otherwise featureless 70 cm
  // foundation. Leave the actual door aperture clear at all elevations.
  // Depth follows the original foundation even on the deeper tavern.
  const face = depth / 2 + 0.354;
  for (const side of [-1, 1]) {
    const left = side < 0 ? -width / 2 - 0.11 : 1.23;
    const right = side < 0 ? -1.23 : width / 2 + 0.11;
    for (let row = 0; row < 2; row += 1) {
      const courseHeight = 0.275;
      const step = coarse ? 0.76 : 0.68;
      const offset = row === 0 ? 0 : step * 0.4;
      let cursor = left;
      let stone = 0;
      while (cursor < right - 0.08) {
        const span = Math.min(step - 0.025, right - cursor - 0.02);
        if (span > 0.12) {
          place(cursor + span / 2 + 0.01, 0.175 + row * 0.30,
            face, span, courseHeight, 0.11,
            (stone + row * 2 + (side > 0 ? 1 : 0)) % 4);
        }
        cursor += step;
        stone += 1;
        if (stone === 1 && offset) cursor += offset;
      }
    }
  }

  const stones = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
    mats.stone, blocks.length);
  stones.name = 'swordhaven-facade-dressed-stones';
  stones.userData.chroniclesDecorativeOnly = true;
  stones.castShadow = !coarse;
  stones.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const shades = [0xf6f0e7, 0xe1d7c9, 0xfaf3e9, 0xd8cec0];
  const color = new THREE.Color();
  blocks.forEach(({ x, y, z, w, h, d, tone }, index) => {
    dummy.position.set(x, y, z);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    stones.setMatrixAt(index, dummy.matrix);
    stones.setColorAt(index, color.setHex(shades[tone]));
  });
  stones.instanceMatrix.needsUpdate = true;
  if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
  root.add(stones);
}

export function buildSwordhavenHouse(spec, mats, coarse, contentIds, center) {
  const root = new THREE.Group();
  root.name = 'swordhaven-building-' + spec.id;
  const [wx, wz] = worldPoint(spec.x, spec.y, center);
  root.position.set(wx, 0, wz);

  const isTemple = spec.emblem === 'sun';
  const isTownHall = spec.emblem === 'civic';
  const isTavern = spec.emblem === 'mug';
  const isApothecary = spec.serviceStyle === 'apothecary';
  const isMagic = spec.emblem === 'crystal' && !isApothecary;
  const isForge = spec.emblem === 'swords';
  const isArmor = spec.serviceStyle === 'armor' || spec.id === 'swordhaven-armor';
  const isStore = spec.serviceStyle === 'store';
  const isWatch = spec.serviceStyle === 'watch';
  const width = isTemple ? 9.0 : 8.1;
  const depth = isTavern ? 8.2 : 7.1;
  const height = isTemple ? 6.3 : isTavern ? 5.7 : 5.25;
  const facadeZ = depth / 2 + 0.10;
  // The provisions warehouse uses weathered cedar boards, not the red
  // ceramic tiles of its neighbours. Reuse the cached timber atlas for both
  // main slopes and the loading loft: no extra geometry, assets or colliders.
  const roof = material(isStore ? 0x8c7357 : spec.roof, {
    map: swordhavenSurfaceTexture(isStore ? 'timber' : 'roof'),
    normalMap: isStore ? null : swordhavenSurfaceNormalTexture('roof'),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: isStore ? 0.98 : 0.95,
  });
  const roofRidgeY = height + 1.8;
  // The guild's slate-violet masonry is a real architectural finish, not a
  // recoloured sign. Reuse the town's cached stone maps on both wall and gable.
  const guildStone = isMagic ? material(0x9d8aa9, {
    map: swordhavenSurfaceTexture('masonry'),
    normalMap: swordhavenSurfaceNormalTexture('masonry'),
    normalScale: new THREE.Vector2(0.42, 0.42), roughness: 0.94,
  }) : null;
  // Fired-clay running-bond courses give the inn real brick proportions rather
  // than the large ashlar blocks shared by the other town buildings. Both
  // gables reuse this cached atlas and relief; no meshes or assets are added.
  const tavernBrick = isTavern ? material(0xc69b84, {
    map: swordhavenSurfaceTexture('brick'),
    normalMap: swordhavenSurfaceNormalTexture('brick'),
    normalScale: new THREE.Vector2(0.42, 0.42), roughness: 0.97,
  }) : null;
  // The smithy has smoke-darkened dressed stone instead of the guardhouse's
  // pale limewash. Reuse cached town masonry maps; no extra textures or lights.
  const forgeMasonry = isForge ? material(0x958171, {
    map: swordhavenSurfaceTexture('masonry'),
    normalMap: swordhavenSurfaceNormalTexture('masonry'),
    normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.98,
  }) : null;
  // The botica is a sage-coloured stone herb house, not another half-timbered
  // merchant frontage. Its roof herbarium, hanging herbs and doorway survive.
  const apothecaryStone = isApothecary ? material(0xa8b9a0, {
    map: swordhavenSurfaceTexture('masonry'),
    normalMap: swordhavenSurfaceNormalTexture('masonry'),
    normalScale: new THREE.Vector2(0.42, 0.42), roughness: 0.96,
  }) : null;
  // The market store keeps limewash, but in a warm ochre distinct from the
  // smith's pale plaster. Reuse the existing stucco albedo and relief.
  const storeOchre = isStore ? material(0xd9b98a, {
    map: swordhavenSurfaceTexture('stucco'),
    normalMap: swordhavenSurfaceNormalTexture('stucco'),
    normalScale: new THREE.Vector2(0.38, 0.38), roughness: 0.96,
  }) : null;
  // Cold, weathered blue-grey ashlar gives the guard barracks a military
  // facade rather than the same limewash as nearby domestic houses. Reuse
  // the town's masonry relief; this changes neither meshes nor collisions.
  const watchAshlar = isWatch ? material(0x93a3aa, {
    map: swordhavenSurfaceTexture('masonry'),
    normalMap: swordhavenSurfaceNormalTexture('masonry'),
    normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.98,
  }) : null;
  // The armourer's blue-grey dressed stone should read as a fortified
  // arsenal at street distance, rather than sharing the temple's neutral
  // ashlar. Cached masonry albedo and relief add no textures or geometry.
  const armorAshlar = isArmor ? material(0x8da5b5, {
    map: swordhavenSurfaceTexture('masonry'),
    normalMap: swordhavenSurfaceNormalTexture('masonry'),
    normalScale: new THREE.Vector2(0.48, 0.48), roughness: 0.95,
  }) : null;
  const wallMaterial = guildStone || tavernBrick || forgeMasonry || apothecaryStone || storeOchre
    || watchAshlar || armorAshlar || (isTemple ? mats.stone : mats.plaster);
  const walls = mesh(root, new THREE.BoxGeometry(width, height, depth), wallMaterial,
    'timber-and-stone-walls', [0, height / 2, 0], !coarse);
  walls.userData.chroniclesArchitecture = true;
  mesh(root, new THREE.BoxGeometry(width + 0.55, 0.7, depth + 0.6), mats.stone,
    'stone-foundations', [0, 0.35, 0]);
  // One instanced corner-course mesh per house: masonry reads as dressed
  // stone instead of four perfectly smooth box corners.
  const courses = Math.floor((height - 0.75) / 0.70);
  const quoinGeometry = new THREE.BoxGeometry(0.50, 0.31, 0.51);
  const quoins = new THREE.InstancedMesh(quoinGeometry, mats.stone, courses * 4);
  quoins.name = 'corner-dressed-stone-courses';
  const quoin = new THREE.Object3D();
  const quoinColor = new THREE.Color();
  let courseIndex = 0;
  for (let level = 0; level < courses; level += 1) {
    for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) {
      quoin.position.set(sideX * (width / 2 - 0.08), 0.92 + level * 0.70, sideZ * (depth / 2 - 0.08));
      quoin.scale.set(0.92 + (level % 3) * 0.055, 1, 1);
      quoin.updateMatrix();
      quoins.setMatrixAt(courseIndex, quoin.matrix);
      quoinColor.setHex([0xb5ab9a, 0xa59d8c, 0xc5bba9][level % 3]);
      quoins.setColorAt(courseIndex, quoinColor);
      courseIndex += 1;
    }
  }
  quoins.instanceMatrix.needsUpdate = true;
  if (quoins.instanceColor) quoins.instanceColor.needsUpdate = true;
  root.add(quoins);
  // A low ashlar roof makes the armorer a fortified hall rather than a
  // merchant house with a tiled gable. The existing battlements and corner
  // shoulders now form its silhouette; all geometry remains above the same
  // solid building cells and never changes doors or collision.
  if (isArmor) {
    const flatRoof = new THREE.Group();
    flatRoof.name = 'armor-flat-ashlar-roof';
    flatRoof.userData.chroniclesDecorativeOnly = true;
    mesh(flatRoof, new THREE.BoxGeometry(width + 0.36, 0.24, depth + 0.82), armorAshlar,
      'armor-flat-roof-deck', [0, height + 0.08, 0], !coarse);
    mesh(flatRoof, new THREE.BoxGeometry(width + 0.55, 0.20, depth + 1.00), mats.stone,
      'armor-flat-roof-coping', [0, height + 0.22, 0], !coarse);
    root.add(flatRoof);
    // Complete the fortified silhouette along both side elevations. The
    // street-facing battlements already exist; low lateral parapets keep the
    // flat roof legible when the player approaches from an oblique angle.
    // These sit above the existing solid house cells, without colliders.
    const sideParapets = new THREE.Group();
    sideParapets.name = 'armor-roof-side-parapets';
    sideParapets.userData.chroniclesDecorativeOnly = true;
    const merlons = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.45, 0.58, 0.76), mats.stone, 10);
    merlons.name = 'armor-side-parapet-merlons';
    merlons.castShadow = !coarse;
    merlons.receiveShadow = true;
    const merlon = new THREE.Object3D();
    let merlonIndex = 0;
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - 0.05);
      mesh(sideParapets, new THREE.BoxGeometry(0.42, 0.48, depth + 0.50),
        mats.stone, 'armor-side-parapet-course', [x, height + 0.47, 0], !coarse);
      for (const z of [-0.38, -0.19, 0, 0.19, 0.38]) {
        merlon.position.set(x, height + 0.98, z * depth);
        merlon.updateMatrix();
        merlons.setMatrixAt(merlonIndex++, merlon.matrix);
      }
    }
    merlons.instanceMatrix.needsUpdate = true;
    sideParapets.add(merlons);
    root.add(sideParapets);
    // A shallow lead-clad barrel vault rises behind the armorer's battlements.
    // Unlike the forge's tiled gable or the guardhouse's lookout, this single
    // curved roof volume gives the armory a recognisable arsenal silhouette.
    // It stays wholly within the existing solid building cells: no collider.
    const vault = new THREE.Group();
    vault.name = 'armor-lead-barrel-vault';
    vault.userData.chroniclesDecorativeOnly = true;
    vault.position.y = height + 0.31;
    vault.scale.y = 0.78;
    const vaultRadius = 3.06;
    const vaultLength = depth - 1.30;
    const lead = material(0x687b82, {
      roughness: 0.82, metalness: 0.23, side: THREE.DoubleSide,
    });
    const iron = material(0x35464d, { roughness: 0.78, metalness: 0.27 });
    const shell = mesh(vault,
      new THREE.CylinderGeometry(vaultRadius, vaultRadius, vaultLength,
        18, 1, true, Math.PI / 2, Math.PI),
      lead, 'armor-vault-curved-lead-shell', [0, 0, 0], !coarse);
    shell.rotation.x = Math.PI / 2;
    // Lead-clad semicircular ends keep the roof from looking like a hollow pipe
    // when seen from the street or the rear alley.
    const tympanum = new THREE.Shape();
    tympanum.moveTo(-vaultRadius, 0);
    tympanum.lineTo(vaultRadius, 0);
    tympanum.absarc(0, 0, vaultRadius, 0, Math.PI, false);
    tympanum.closePath();
    for (const end of [-1, 1]) {
      const cap = mesh(vault, new THREE.ShapeGeometry(tympanum), lead,
        'armor-vault-lead-tympanum', [0, 0, end * vaultLength / 2], !coarse);
      if (end < 0) cap.rotation.y = Math.PI;
    }
    // One instanced batch for the transverse wrought-iron roof ribs.
    const ribs = new THREE.InstancedMesh(
      new THREE.TorusGeometry(vaultRadius + 0.035, 0.085, 6, 24, Math.PI),
      iron, coarse ? 3 : 5);
    ribs.name = 'armor-vault-iron-ribs';
    ribs.castShadow = !coarse;
    ribs.receiveShadow = true;
    const rib = new THREE.Object3D();
    for (let i = 0; i < ribs.count; i += 1) {
      rib.position.z = -vaultLength / 2 + i * vaultLength / (ribs.count - 1);
      rib.updateMatrix();
      ribs.setMatrixAt(i, rib.matrix);
    }
    ribs.instanceMatrix.needsUpdate = true;
    vault.add(ribs);
    root.add(vault);
    // Four shallow ashlar buttresses break up the armorer's long, flat side
    // elevations. They stand between the existing barred window bays, wholly
    // within the authored solid building cells; no collider or light is added.
    const buttresses = new THREE.Group();
    buttresses.name = 'armor-side-ashlar-buttresses';
    buttresses.userData.chroniclesDecorativeOnly = true;
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const x = side * (width / 2 + 0.12);
        const z = end * depth * 0.41;
        mesh(buttresses, new THREE.BoxGeometry(0.52, 3.92, 0.70), mats.stone,
          'armor-side-buttress-pier', [x, 2.13, z], !coarse);
        mesh(buttresses, new THREE.BoxGeometry(0.68, 0.24, 0.90), mats.stone,
          'armor-side-buttress-coping', [x, 4.22, z], !coarse);
      }
    }
    root.add(buttresses);
  } else {
    // A proper triangular gable under each pitched roof, not a flat cube roof.
    const gable = new THREE.Shape();
    gable.moveTo(-width / 2, 0);
    gable.lineTo(width / 2, 0);
    gable.lineTo(0, 1.85);
    gable.closePath();
    for (const face of [-1, 1]) {
      const g = mesh(root, new THREE.ShapeGeometry(gable), wallMaterial,
        'roof-gable-' + face, [0, height - 0.06, face * facadeZ]);
      if (face === -1) g.rotation.y = Math.PI;
    }
    for (const side of [-1, 1]) {
      const slope = mesh(root, new THREE.BoxGeometry(width * 0.59, 0.26, depth + 0.9),
        roof, 'pitched-roof-' + side, [side * width * 0.245, height + 0.79, 0], !coarse);
      slope.rotation.z = -side * 0.48;
      // One instanced draw-call per roof slope instead of individual roof tiles.
      // Thin cross-seams add depth without a dense triangle mesh on phones.
      const bands = new THREE.InstancedMesh(
        new THREE.BoxGeometry(width * 0.55, 0.045, 0.07),
        mats.roofSeams,
        coarse ? 7 : 12,
      );
      bands.name = 'pitched-roof-shingle-seams';
      const band = new THREE.Object3D();
      for (let i = 0; i < bands.count; i += 1) {
        band.position.set(0, 0.16, -(depth + 0.6) / 2 + (i + 0.5) * (depth + 0.6) / bands.count);
        band.updateMatrix();
        bands.setMatrixAt(i, band.matrix);
      }
      bands.instanceMatrix.needsUpdate = true;
      slope.add(bands);
    }
    mesh(root, new THREE.CylinderGeometry(0.14, 0.14, depth + 0.98, 7), mats.timber,
      'ridge-timber', [0, roofRidgeY - 0.13, 0]).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const fascia = mesh(root, new THREE.BoxGeometry(0.25, 0.28, depth + 1.1),
        mats.timber, 'roof-edge-fascia', [side * width * 0.49, height + 0.02, 0]);
      fascia.rotation.z = side * 0.16;
    }
  }
  // Stone-fronted armorer, guild and botica have no merchant timber lattice.
  // Doors, shop signs, windows and their collision cells remain untouched.
  if (!isArmor && !isMagic && !isApothecary && !isTemple && !isWatch) {
    // Repeated timber posts and braces form recognisable half-timbered facades.
    const beamY = [1.02, height - 0.67];
    for (const y of beamY) mesh(root, new THREE.BoxGeometry(width, 0.22, 0.23),
      mats.timber, 'horizontal-facade-beam', [0, y, facadeZ]);
    for (const x of [-width * 0.48, 0, width * 0.48]) {
      mesh(root, new THREE.BoxGeometry(0.22, height, 0.27), mats.timber,
        'vertical-facade-post', [x, height / 2, facadeZ], !coarse);
    }
    for (const side of [-1, 1]) {
      const brace = mesh(root, new THREE.BoxGeometry(0.17, 2.15, 0.23), mats.timber,
        'diagonal-timber-brace', [side * width * 0.34, height - 1.77, facadeZ + 0.06]);
      brace.rotation.z = side * 0.55;
    }
  }
  mesh(root, new THREE.BoxGeometry(1.75, 3.12, 0.16), mats.timber,
    'shop-door', [0, 1.56, facadeZ + 0.16]);
  // A shallow limestone arch gives the herb house a distinct, recessed-looking
  // entrance instead of the shared square merchant doorway. The nine dressed
  // voussoirs and two piers remain on the existing solid facade, below the
  // nameplate and clear of the authored walk grid. Decorative only.
  if (isApothecary) {
    const portal = new THREE.Group();
    portal.name = 'apothecary-stone-arch-portal';
    portal.userData.chroniclesDecorativeOnly = true;
    for (const side of [-1, 1]) {
      mesh(portal, new THREE.BoxGeometry(0.34, 2.76, 0.38), mats.stone,
        'apothecary-entry-stone-jamb', [side * 1.08, 1.43, facadeZ + 0.38], !coarse);
      mesh(portal, new THREE.BoxGeometry(0.53, 0.25, 0.46), mats.stone,
        'apothecary-entry-stone-footing', [side * 1.08, 0.14, facadeZ + 0.39]);
    }
    const arch = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.35, 0.22, 0.42), mats.stone, 9);
    arch.name = 'apothecary-entry-arch-voussoirs';
    arch.userData.chroniclesDecorativeOnly = true;
    arch.castShadow = !coarse;
    arch.receiveShadow = true;
    const stone = new THREE.Object3D();
    for (let index = 0; index < arch.count; index += 1) {
      const angle = Math.PI * index / (arch.count - 1);
      stone.position.set(0.84 * Math.cos(angle), 2.52 + 0.84 * Math.sin(angle),
        facadeZ + 0.38);
      stone.rotation.z = angle + Math.PI / 2;
      stone.updateMatrix();
      arch.setMatrixAt(index, stone.matrix);
    }
    arch.instanceMatrix.needsUpdate = true;
    portal.add(arch);
    root.add(portal);
  }
  // A substantial oak entrance makes the inn legible at street level, not
  // just by its roof silhouette. It frames the existing door beneath the
  // porch without adding blockers, changing interactions or hiding the sign.
  if (isTavern) {
    const entrance = new THREE.Group();
    entrance.name = 'tavern-oak-entrance';
    entrance.userData.chroniclesDecorativeOnly = true;
    const oak = material(0x5d3d29, { roughness: 0.96 });
    for (const side of [-1, 1]) {
      mesh(entrance, new THREE.BoxGeometry(0.30, 3.08, 0.34), oak,
        'tavern-entry-oak-jamb', [side * 1.14, 1.58, facadeZ + 0.32], !coarse);
      mesh(entrance, new THREE.BoxGeometry(0.43, 0.36, 0.46), mats.stone,
        'tavern-entry-stone-plinth', [side * 1.14, 0.18, facadeZ + 0.32]);
      const brace = mesh(entrance, new THREE.BoxGeometry(0.17, 0.76, 0.22),
        mats.timber, 'tavern-entry-oak-brace',
        [side * 0.90, 3.00, facadeZ + 0.39], !coarse);
      brace.rotation.z = side * 0.55;
    }
    mesh(entrance, new THREE.BoxGeometry(2.70, 0.26, 0.38), oak,
      'tavern-entry-oak-lintel', [0, 3.25, facadeZ + 0.32], !coarse);
    root.add(entrance);
  }
  // The watchhouse is dressed military ashlar, not a half-timbered
  // merchant shop. Its shallow stone portal frames the unchanged oak door;
  // all relief is decorative and never enters the authored collision grid.
  if (isWatch) {
    const entry = new THREE.Group();
    entry.name = 'watchhouse-ashlar-entry';
    entry.userData.chroniclesDecorativeOnly = true;
    for (const side of [-1, 1]) {
      mesh(entry, new THREE.BoxGeometry(0.42, 3.06, 0.40), mats.stone,
        'watchhouse-entry-stone-jamb', [side * 1.22, 1.57, facadeZ + 0.32], !coarse);
      mesh(entry, new THREE.BoxGeometry(0.62, 0.27, 0.51), mats.stone,
        'watchhouse-entry-stone-footing', [side * 1.22, 0.17, facadeZ + 0.32]);
    }
    mesh(entry, new THREE.BoxGeometry(2.90, 0.32, 0.46), mats.stone,
      'watchhouse-entry-stone-lintel', [0, 3.27, facadeZ + 0.32], !coarse);
    mesh(entry, new THREE.BoxGeometry(2.44, 0.11, 0.07), mats.steel,
      'watchhouse-entry-iron-band', [0, 3.27, facadeZ + 0.59]);
    root.add(entry);
  }
  // Two batched wrought-iron straps give the previously flat door depth.
  const doorIronwork = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.61, 0.072, 0.055), mats.steel, 2,
  );
  doorIronwork.name = 'shop-door-iron-straps';
  const doorIron = new THREE.Object3D();
  for (const [index, y] of [0.90, 2.43].entries()) {
    doorIron.position.set(0, y, facadeZ + 0.28);
    doorIron.updateMatrix();
    doorIronwork.setMatrixAt(index, doorIron.matrix);
  }
  doorIronwork.instanceMatrix.needsUpdate = true;
  root.add(doorIronwork);

  // A single batch of dressed stone replaces featureless door posts,
  // with uneven masonry courses and projecting window heads / low plinth.
  // Geometry stays decorative; the authored map owns all collision.
  dressSwordhavenFacadeMasonry(root, { mats, width, depth, facadeZ, coarse });
  // Lanterns and pennants are attached to the blocking building footprint,
  // never freestanding on traversable tiles.
  for (const x of [-width * 0.41, width * 0.41]) {
    mesh(root, new THREE.BoxGeometry(0.14, 0.24, 0.4), mats.steel,
      'shop-lantern-bracket', [x, height - 0.36, facadeZ + 0.19]);
    mesh(root, new THREE.BoxGeometry(0.30, 0.43, 0.28), mats.window,
      'shop-amber-lantern', [x, height - 0.69, facadeZ + 0.26]);
  }
  for (const side of [-1, 1]) {
    const banner = new THREE.Group();
    banner.name = 'shop-pennant-' + (side < 0 ? 'left' : 'right');
    banner.position.set(side * width * 0.38, height - 1.03, facadeZ + 0.19);
    mesh(banner, new THREE.BoxGeometry(0.68, 1.45, 0.045), roof,
      'vertical-heraldic-banner', [0, -0.48, 0]);
    mesh(banner, new THREE.BoxGeometry(0.88, 0.10, 0.10), mats.gold,
      'banner-gold-rail', [0, 0.31, 0.07]);
    root.add(banner);
  }
  mesh(root, new THREE.SphereGeometry(0.08, 8, 6), mats.gold,
    'door-handle', [0.58, 1.45, facadeZ + 0.29]);
  // The temple is dressed stone, not another flower-box merchant frontage.
  // Two pointed blue-glass lancets replace the shared amber shop windows.
  // Their raised tracery is decorative only: doors, map cells and collision
  // geometry are still owned by the unchanged authored town footprint.
  if (isTemple) {
    const lancets = new THREE.Group();
    lancets.name = 'temple-stained-glass-lancets';
    lancets.userData.chroniclesDecorativeOnly = true;
    lancets.position.z = facadeZ + 0.44;
    const stainedGlass = material(0x477f96, {
      emissive: 0x183344, emissiveIntensity: 0.32,
      roughness: 0.35, metalness: 0.03, side: THREE.DoubleSide,
    });
    const stoneArch = new THREE.Shape();
    stoneArch.moveTo(-0.82, -1.08);
    stoneArch.lineTo(0.82, -1.08);
    stoneArch.lineTo(0.82, 0.55);
    stoneArch.lineTo(0, 1.40);
    stoneArch.lineTo(-0.82, 0.55);
    stoneArch.closePath();
    const pane = new THREE.Shape();
    pane.moveTo(-0.60, -0.85);
    pane.lineTo(0.60, -0.85);
    pane.lineTo(0.60, 0.44);
    pane.lineTo(0, 1.08);
    pane.lineTo(-0.60, 0.44);
    pane.closePath();
    for (const x of [-width * 0.33, width * 0.33]) {
      const bay = new THREE.Group();
      bay.name = 'temple-lancet-bay';
      bay.position.set(x, 2.75, 0);
      mesh(bay, new THREE.ShapeGeometry(stoneArch), mats.stone,
        'temple-lancet-stone-arch', [0, 0, 0], !coarse);
      mesh(bay, new THREE.ShapeGeometry(pane), stainedGlass,
        'temple-lancet-stained-glass', [0, 0, 0.055], !coarse);
      mesh(bay, new THREE.BoxGeometry(0.055, 1.75, 0.07), mats.gold,
        'temple-lancet-lead-mullion', [0, -0.13, 0.11]);
      mesh(bay, new THREE.BoxGeometry(1.18, 0.06, 0.07), mats.gold,
        'temple-lancet-lead-transom', [0, -0.24, 0.11]);
      mesh(bay, new THREE.BoxGeometry(1.74, 0.18, 0.40), mats.stone,
        'temple-lancet-stone-sill', [0, -1.14, 0.05]);
      lancets.add(bay);
    }
    root.add(lancets);
  } else if (isArmor) {
    // Forged display grilles and dark armour alcoves replace domestic
    // amber windows and flower boxes. These are shallow facade ornaments,
    // never blockers or new interaction targets on the authored town grid.
    const displays = new THREE.Group();
    displays.name = 'armor-forged-display-bays';
    displays.userData.chroniclesDecorativeOnly = true;
    displays.position.z = facadeZ + 0.46;
    const alcove = material(0x28323a, { roughness: 0.97, metalness: 0.08 });
    const shieldFace = material(0x899da9, { roughness: 0.45, metalness: 0.38 });
    const shield = new THREE.Shape();
    shield.moveTo(-0.43, 0.55);
    shield.lineTo(0.43, 0.55);
    shield.lineTo(0.36, -0.23);
    shield.lineTo(0, -0.67);
    shield.lineTo(-0.36, -0.23);
    shield.closePath();
    for (const x of [-width * 0.33, width * 0.33]) {
      const bay = new THREE.Group();
      bay.name = 'armor-forged-display-bay';
      bay.position.set(x, 2.75, 0);
      mesh(bay, new THREE.BoxGeometry(1.54, 1.73, 0.10), alcove,
        'armor-display-dark-recess', [0, 0, 0], !coarse);
      mesh(bay, new THREE.ShapeGeometry(shield), shieldFace,
        'armor-display-shield', [0, 0, 0.09], !coarse);
      mesh(bay, new THREE.BoxGeometry(0.11, 1.12, 0.05), mats.gold,
        'armor-display-shield-spine', [0, -0.04, 0.14]);
      for (const side of [-1, 1]) {
        mesh(bay, new THREE.BoxGeometry(0.23, 2.03, 0.30), mats.stone,
          'armor-display-stone-jamb', [side * 0.86, 0, 0.04], !coarse);
        mesh(bay, new THREE.BoxGeometry(0.09, 1.77, 0.11), mats.steel,
          'armor-display-iron-bar', [side * 0.49, 0, 0.22]);
      }
      for (const y of [-0.94, 0.94]) {
        mesh(bay, new THREE.BoxGeometry(1.94, 0.22, 0.32), mats.stone,
          'armor-display-stone-rail', [0, y, 0.04], !coarse);
      }
      displays.add(bay);
    }
    root.add(displays);
  } else if (isMagic) {
    // Tall violet leaded panes make the guild legible as an arcane school
    // instead of another amber-window merchant shop. Decorative facade only.
    const glazing = new THREE.Group();
    glazing.name = 'magic-guild-violet-glazing';
    glazing.userData.chroniclesDecorativeOnly = true;
    glazing.position.z = facadeZ + 0.46;
    const violetGlass = material(0x7658a9, {
      emissive: 0x302052, emissiveIntensity: 0.42,
      roughness: 0.36, metalness: 0.04, side: THREE.DoubleSide,
    });
    const pointedFrame = new THREE.Shape();
    pointedFrame.moveTo(-0.83, -1.04);
    pointedFrame.lineTo(0.83, -1.04);
    pointedFrame.lineTo(0.83, 0.49);
    pointedFrame.lineTo(0, 1.33);
    pointedFrame.lineTo(-0.83, 0.49);
    pointedFrame.closePath();
    const pointedPane = new THREE.Shape();
    pointedPane.moveTo(-0.63, -0.83);
    pointedPane.lineTo(0.63, -0.83);
    pointedPane.lineTo(0.63, 0.38);
    pointedPane.lineTo(0, 1.03);
    pointedPane.lineTo(-0.63, 0.38);
    pointedPane.closePath();
    for (const x of [-width * 0.33, width * 0.33]) {
      const bay = new THREE.Group();
      bay.name = 'magic-guild-glass-bay';
      bay.position.set(x, 2.75, 0);
      mesh(bay, new THREE.ShapeGeometry(pointedFrame), mats.stone,
        'magic-window-stone-frame', [0, 0, 0], !coarse);
      mesh(bay, new THREE.ShapeGeometry(pointedPane), violetGlass,
        'magic-window-violet-pane', [0, 0, 0.075], !coarse);
      mesh(bay, new THREE.BoxGeometry(0.065, 1.67, 0.07), mats.gold,
        'magic-window-brass-mullion', [0, -0.11, 0.13]);
      for (const side of [-1, 1]) {
        const lead = mesh(bay, new THREE.BoxGeometry(0.055, 0.70, 0.07), mats.gold,
          'magic-window-pointed-lead', [side * 0.23, 0.46, 0.13]);
        lead.rotation.z = side * 0.61;
      }
      mesh(bay, new THREE.BoxGeometry(1.82, 0.18, 0.35), mats.stone,
        'magic-window-carved-sill', [0, -1.10, 0.04]);
      glazing.add(bay);
    }
    root.add(glazing);
  } else if (isApothecary) {
    // The herb house has rounded conservatory glazing at street level,
    // not the ordinary merchant's amber rectangular windows. Stone arches,
    // sage glass and slender oak muntins sit over the original solid facade;
    // the door, planters and collision footprint are untouched.
    const bays = new THREE.Group();
    bays.name = 'apothecary-botanical-window-bays';
    bays.userData.chroniclesDecorativeOnly = true;
    bays.position.z = facadeZ + 0.72;
    const sageGlass = material(0x79aa8e, {
      emissive: 0x183728, emissiveIntensity: 0.20,
      roughness: 0.40, metalness: 0.02, side: THREE.DoubleSide,
    });
    const arch = new THREE.Shape();
    arch.moveTo(-0.85, -0.77);
    arch.lineTo(0.85, -0.77);
    arch.lineTo(0.85, 0.31);
    arch.quadraticCurveTo(0.85, 0.98, 0, 1.02);
    arch.quadraticCurveTo(-0.85, 0.98, -0.85, 0.31);
    arch.closePath();
    const pane = new THREE.Shape();
    pane.moveTo(-0.67, -0.60);
    pane.lineTo(0.67, -0.60);
    pane.lineTo(0.67, 0.29);
    pane.quadraticCurveTo(0.67, 0.78, 0, 0.83);
    pane.quadraticCurveTo(-0.67, 0.78, -0.67, 0.29);
    pane.closePath();
    // The botica's two glazed bays project from the stone frontage. Their
    // deep side returns and verdigris hoods create a genuine window volume
    // rather than another pair of flat panes painted on the wall. Both bays
    // remain decorative, above the original solid house footprint.
    const patinatedCopper = material(0x2c5c4c, { roughness: 0.88, metalness: 0.12 });
    for (const x of [-width * 0.33, width * 0.33]) {
      const bay = new THREE.Group();
      bay.name = 'apothecary-botanical-window-bay';
      bay.position.set(x, 2.75, 0);
      bay.userData.chroniclesDecorativeOnly = true;
      for (const side of [-1, 1]) {
        mesh(bay, new THREE.BoxGeometry(0.12, 1.57, 0.60), mats.stone,
          'apothecary-bay-stone-return', [side * 0.86, -0.04, -0.23], !coarse);
        mesh(bay, new THREE.BoxGeometry(0.055, 1.24, 0.45), sageGlass,
          'apothecary-bay-side-glass', [side * 0.77, -0.06, -0.25], !coarse);
      }
      // A full pitched copper canopy projects above each glazed bay. The
      // green eave is legible from street level without hiding the arch or sign.
      const hood = mesh(bay, new THREE.BoxGeometry(2.20, 0.12, 1.15), patinatedCopper,
        'apothecary-bay-verdigris-hood', [0, 1.35, 0.02], !coarse);
      hood.rotation.x = 0.40;
      // Oak knee braces physically tie each canopy back into the stone
      // reveals; without these, the shallow copper eave reads as a floating shelf.
      for (const side of [-1, 1]) {
        const brace = mesh(bay, new THREE.BoxGeometry(0.13, 0.13, 1.10),
          mats.timber, 'apothecary-bay-oak-knee-brace',
          [side * 0.96, 0.77, -0.20], !coarse);
        brace.rotation.x = -0.58;
      }
      mesh(bay, new THREE.ShapeGeometry(arch), mats.stone,
        'apothecary-window-rounded-stone-arch', [0, 0, 0], !coarse);
      mesh(bay, new THREE.ShapeGeometry(pane), sageGlass,
        'apothecary-window-sage-glass', [0, 0, 0.07], !coarse);
      mesh(bay, new THREE.BoxGeometry(0.075, 1.33, 0.09), mats.timber,
        'apothecary-window-oak-mullion', [0, -0.08, 0.14]);
      mesh(bay, new THREE.BoxGeometry(1.36, 0.07, 0.09), mats.timber,
        'apothecary-window-oak-transom', [0, -0.18, 0.14]);
      mesh(bay, new THREE.BoxGeometry(1.90, 0.16, 0.78), mats.stone,
        'apothecary-window-stone-sill', [0, -0.88, -0.18]);
      bays.add(bay);
      mesh(root, new THREE.BoxGeometry(1.70, 0.36, 0.65), mats.stone,
        'apothecary-herb-window-box', [x, 1.83, facadeZ + 0.79]);
    }
    root.add(bays);
    dressSwordhavenWindowBoxes(root, {
      windowXs: [-width * 0.33, width * 0.33], facadeZ, coarse, mats,
    });
  } else {
    // The watchhouse is a barracks, not another flower-box merchant home.
    // Replace its domestic glazing with recessed iron-barred embrasures,
    // while retaining the original door, solid footprint and interactions.
    const watchRecess = isWatch
      ? material(0x293039, { roughness: 0.98, metalness: 0.06 }) : null;
    for (const x of [-width * 0.33, width * 0.33]) {
      const front = facadeZ + 0.16;
      mesh(root, new THREE.BoxGeometry(1.37, 1.23, 0.11),
        isWatch ? watchRecess : mats.window,
        isWatch ? 'watchhouse-front-dark-recess' : 'warm-glass-window',
        [x, 2.75, front]);
      for (const dx of [-0.70, 0.70]) mesh(root, new THREE.BoxGeometry(0.10, 1.38, 0.18),
        isWatch ? mats.stone : mats.timber,
        isWatch ? 'watchhouse-front-stone-jamb' : 'window-side-frame',
        [x + dx, 2.75, front + 0.05]);
      for (const dy of [-0.62, 0, 0.62]) mesh(root, new THREE.BoxGeometry(1.5, 0.10, 0.18),
        isWatch ? mats.stone : mats.timber,
        isWatch ? 'watchhouse-front-stone-rail' : 'window-rail',
        [x, 2.75 + dy, front + 0.05]);
      mesh(root, new THREE.BoxGeometry(1.62, 0.15, 0.43), mats.stone,
        'stone-window-sill', [x, 2.04, front + 0.11]);
      if (!isWatch) mesh(root, new THREE.BoxGeometry(1.7, 0.36, 0.65), mats.stone,
        isStore ? 'store-stock-display-trough' : isForge ? 'forge-window-tool-trough' : 'flower-window-box',
        [x, 1.83, front + 0.34]);
    }
    if (isWatch) {
      // One instanced grille for both windows: six iron bars, no extra
      // lights, textures or colliders. Keep them inside the solid facade.
      const bars = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.12, 1.13, 0.10), mats.steel, 6);
      bars.name = 'watchhouse-front-iron-bars';
      bars.userData.chroniclesDecorativeOnly = true;
      bars.castShadow = !coarse;
      const bar = new THREE.Object3D();
      let index = 0;
      for (const x of [-width * 0.33, width * 0.33]) {
        for (const offset of [-0.42, 0, 0.42]) {
          bar.position.set(x + offset, 2.75, facadeZ + 0.29);
          bar.updateMatrix();
          bars.setMatrixAt(index++, bar.matrix);
        }
      }
      bars.instanceMatrix.needsUpdate = true;
      root.add(bars);
    } else {
      // Leaded diamond glazing reads at eye level without eight draw calls
      // per window. All lattice strips share a single per-building batch.
      const diamondLead = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.035, 0.93, 0.043), mats.steel, 8,
      );
      diamondLead.name = 'window-diamond-leadwork';
      const detail = new THREE.Object3D();
      let leadIndex = 0;
      for (const x of [-width * 0.33, width * 0.33]) {
        for (const slope of [-1, 1]) {
          for (const shift of [-0.24, 0.24]) {
            detail.position.set(x + shift, 2.75, facadeZ + 0.39);
            detail.rotation.set(0, 0, slope * 0.71);
            detail.scale.set(1, 1, 1);
            detail.updateMatrix();
            diamondLead.setMatrixAt(leadIndex++, detail.matrix);
          }
        }
      }
      diamondLead.instanceMatrix.needsUpdate = true;
      root.add(diamondLead);

      if (isTavern) {
        // Four substantial hinged oak shutters give the inn a recognisable
        // street-level window silhouette instead of generic amber rectangles.
        // They sit beside (never over) the existing panes, above the flower
        // boxes and wholly on the solid facade. Three shared batches, no
        // colliders, textures, lighting or interaction changes.
        const shutters = new THREE.Group();
        shutters.name = 'tavern-inn-oak-shutters';
        shutters.userData.chroniclesDecorativeOnly = true;
        const panels = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.43, 1.28, 0.10),
          material(0x946c45, { roughness: 0.98 }), 4);
        panels.name = 'tavern-oak-shutter-panel';
        const hinges = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.36, 0.07, 0.05), mats.steel, 8);
        hinges.name = 'tavern-shutter-iron-hinges';
        const braces = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.09, 1.12, 0.045), mats.timber, 4);
        braces.name = 'tavern-shutter-oak-brace';
        const shutter = new THREE.Object3D();
        let panelIndex = 0;
        for (const x of [-width * 0.33, width * 0.33]) {
          for (const side of [-1, 1]) {
            const sx = x + side * 0.99;
            shutter.position.set(sx, 2.75, facadeZ + 0.40);
            shutter.rotation.set(0, side * 0.22, 0);
            shutter.updateMatrix();
            panels.setMatrixAt(panelIndex, shutter.matrix);
            shutter.position.z = facadeZ + 0.48;
            shutter.rotation.z = side * 0.23;
            shutter.updateMatrix();
            braces.setMatrixAt(panelIndex, shutter.matrix);
            shutter.rotation.z = 0;
            for (const [strapIndex, dy] of [-0.43, 0.43].entries()) {
              shutter.position.y = 2.75 + dy;
              shutter.updateMatrix();
              hinges.setMatrixAt(panelIndex * 2 + strapIndex, shutter.matrix);
            }
            panelIndex += 1;
          }
        }
        for (const batch of [panels, hinges, braces]) {
          batch.userData.chroniclesDecorativeOnly = true;
          batch.castShadow = !coarse;
          batch.receiveShadow = true;
          batch.instanceMatrix.needsUpdate = true;
          shutters.add(batch);
        }
        root.add(shutters);
      }

      if (isStore) {
        // The warehouse displays braced oak supply crates rather than the
        // inn's flowers. Two instanced batches on the existing raised sills;
        // no new textures, lights, interaction targets or walk-grid changes.
        const crates = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.70, 0.50, 0.50),
          material(0xb58c58, { roughness: 0.98 }), 4);
        crates.name = 'store-window-provisions-crates';
        const braces = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.075, 0.82, 0.08),
          mats.timber, 8);
        braces.name = 'store-window-crate-crossbraces';
        const parcel = new THREE.Object3D();
        let crateIndex = 0;
        let braceIndex = 0;
        for (const x of [-width * 0.33, width * 0.33]) {
          for (const offset of [-0.42, 0.42]) {
            const crateX = x + offset;
            parcel.position.set(crateX, 2.26, facadeZ + 0.76);
            parcel.rotation.set(0, 0, 0);
            parcel.scale.set(1, 1, 1);
            parcel.updateMatrix();
            crates.setMatrixAt(crateIndex++, parcel.matrix);
            for (const angle of [-0.92, 0.92]) {
              parcel.position.set(crateX, 2.26, facadeZ + 1.055);
              parcel.rotation.z = angle;
              parcel.updateMatrix();
              braces.setMatrixAt(braceIndex++, parcel.matrix);
            }
          }
        }
        for (const batch of [crates, braces]) {
          batch.userData.chroniclesDecorativeOnly = true;
          batch.castShadow = !coarse;
          batch.instanceMatrix.needsUpdate = true;
          root.add(batch);
        }
      } else if (isForge) {
        // Smithing hammers on the two raised stone window troughs replace
        // domestic flowers. Batched oak handles and iron heads are decorative
        // only, above the existing solid building footprint.
        const tools = new THREE.Group();
        tools.name = 'forge-window-tool-displays';
        tools.userData.chroniclesDecorativeOnly = true;
        const handles = new THREE.InstancedMesh(
          new THREE.CylinderGeometry(0.055, 0.065, 0.68, 6), mats.timber, 4);
        handles.name = 'forge-window-hammer-handles';
        const heads = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.43, 0.19, 0.22),
          material(0x9da5a1, { roughness: 0.42, metalness: 0.58 }), 4);
        heads.name = 'forge-window-hammer-heads';
        const tool = new THREE.Object3D();
        let index = 0;
        for (const x of [-width * 0.33, width * 0.33]) {
          for (const offset of [-0.42, 0.42]) {
            const lean = offset < 0 ? -0.13 : 0.13;
            tool.rotation.set(0, 0, lean);
            tool.position.set(x + offset, 2.30, facadeZ + 0.82);
            tool.updateMatrix();
            handles.setMatrixAt(index, tool.matrix);
            tool.position.set(x + offset, 2.64, facadeZ + 0.84);
            tool.updateMatrix();
            heads.setMatrixAt(index++, tool.matrix);
          }
        }
        for (const batch of [handles, heads]) {
          batch.userData.chroniclesDecorativeOnly = true;
          batch.castShadow = false;
          batch.instanceMatrix.needsUpdate = true;
          tools.add(batch);
        }
        root.add(tools);
      } else {
        // Real shaped leaves, petals and hanging stems remain on the inn and
        // other domestic facades; never add them to the barracks or warehouse.
        dressSwordhavenWindowBoxes(root, {
          windowXs: [-width * 0.33, width * 0.33], facadeZ, coarse, mats,
        });
      }
    }
  }
  // The guild's lateral stone buttresses break up its long, flat side walls.
  // Their pointed caps rise above the eaves, unlike the merchant timberwork
  // or the armorer's battlements. Entirely within existing solid town cells.
  if (isMagic) {
    const buttresses = new THREE.Group();
    buttresses.name = 'magic-guild-side-buttresses';
    buttresses.userData.chroniclesDecorativeOnly = true;
    for (const side of [-1, 1]) {
      const x = side * (width / 2 + 0.22);
      mesh(buttresses, new THREE.BoxGeometry(0.88, 0.84, 1.22), mats.stone,
        'magic-buttress-foot', [x, 0.75, 0], !coarse);
      mesh(buttresses, new THREE.BoxGeometry(0.64, 3.78, 0.88), mats.stone,
        'magic-buttress-shaft', [x, 2.80, 0], !coarse);
      mesh(buttresses, new THREE.BoxGeometry(0.98, 0.22, 1.18), mats.stone,
        'magic-buttress-coping', [x, 4.81, 0], !coarse);
      mesh(buttresses, new THREE.ConeGeometry(0.65, 1.04, 4), roof,
        'magic-buttress-pointed-cap', [x, 5.43, 0], !coarse);
    }
    root.add(buttresses);
  }
  // Each trade keeps its own side elevation: violet leaded glass for
  // the guild, iron-barred embrasures for the armory, soot-darkened
  // ventilation for the forge, and warm glazing for other merchants.
  // Decorative only: no footprint or collision changes.
  const sideGlass = isMagic
    ? material(0x7658a9, { emissive: 0x302052, emissiveIntensity: 0.42, roughness: 0.36 })
    : isArmor ? material(0x28323a, { roughness: 0.97, metalness: 0.08 })
      : isForge ? material(0x302820, { roughness: 0.99, metalness: 0.02 })
        : isApothecary ? material(0x617b54, { roughness: 0.57, emissive: 0x16251a, emissiveIntensity: 0.16 })
          : isStore ? material(0x614932, { roughness: 0.96 })
            : mats.window;
  for (const side of [-1, 1]) {
    for (const z of [-depth * 0.22, depth * 0.22]) {
      const edge = side * (width / 2 + 0.105);
      mesh(root, new THREE.BoxGeometry(0.13, 1.63, 1.77), mats.stone,
        'side-window-stone-reveal', [edge, 2.79, z]);
      mesh(root, new THREE.BoxGeometry(0.16, 1.27, 1.39), sideGlass,
        isMagic ? 'side-window-violet-glass'
          : isArmor ? 'side-window-armory-dark-recess'
            : isForge ? 'side-window-forge-soot-vent'
              : isApothecary ? 'side-window-apothecary-sage-glass'
                : isStore ? 'side-window-store-oak-loading-hatch' : 'side-window-amber-glass',
        [edge + side * 0.09, 2.84, z]);
      mesh(root, new THREE.BoxGeometry(0.26, 0.16, 1.88), mats.stone,
        'side-window-carved-sill', [edge + side * 0.11, 1.95, z]);
      mesh(root, isArmor
        ? new THREE.BoxGeometry(0.15, 1.19, 0.18)
        : new THREE.BoxGeometry(0.15, isForge ? 0.16 : 0.10, isForge ? 1.36 : 1.4),
      isMagic ? mats.gold : isArmor || isForge ? mats.steel : mats.timber,
      isMagic ? 'side-window-brass-mullion'
        : isArmor ? 'side-window-armory-iron-bar'
          : isForge ? 'side-window-forge-iron-louver' : 'side-window-crossbar',
      [edge + side * 0.17, 2.85, z]);
    }
  }
  // The inn's side windows also receive oak leaves: the large east-facing
  // elevation is the one players actually see from the market plaza. Keep
  // the guest oriel above, and leave the side panes and walk grid untouched.
  if (isTavern) {
    const sideShutters = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.20, 1.42, 0.47),
      material(0x946c45, { roughness: 0.98 }), 8);
    sideShutters.name = 'tavern-side-oak-shutters';
    sideShutters.userData.chroniclesDecorativeOnly = true;
    sideShutters.castShadow = !coarse;
    sideShutters.receiveShadow = true;
    const leaf = new THREE.Object3D();
    let index = 0;
    for (const side of [-1, 1]) {
      for (const z of [-depth * 0.22, depth * 0.22]) {
        for (const edge of [-1, 1]) {
          leaf.position.set(side * (width / 2 + 0.32), 2.84, z + edge * 0.99);
          leaf.rotation.set(0, side * edge * 0.14, 0);
          leaf.updateMatrix();
          sideShutters.setMatrixAt(index++, leaf.matrix);
        }
      }
    }
    sideShutters.instanceMatrix.needsUpdate = true;
    root.add(sideShutters);
  }
  // The guild's side elevations should read as a school of magic from the
  // alley too, not as ordinary rectangular merchant windows tinted purple.
  // Pointed slate surrounds and violet lancets cover the existing side panes
  // without moving the original wall, sill, collision grid or entrance.
  // Three instanced batches serve all four bays on both pointer classes.
  if (isMagic) {
    const lancets = new THREE.Group();
    lancets.name = 'magic-guild-side-lancets';
    lancets.userData.chroniclesDecorativeOnly = true;
    const surround = new THREE.Shape();
    surround.moveTo(-0.83, -0.94);
    surround.lineTo(0.83, -0.94);
    surround.lineTo(0.83, 0.38);
    surround.lineTo(0, 1.22);
    surround.lineTo(-0.83, 0.38);
    surround.closePath();
    const glass = new THREE.Shape();
    glass.moveTo(-0.64, -0.76);
    glass.lineTo(0.64, -0.76);
    glass.lineTo(0.64, 0.29);
    glass.lineTo(0, 0.98);
    glass.lineTo(-0.64, 0.29);
    glass.closePath();
    const frames = new THREE.InstancedMesh(
      new THREE.ShapeGeometry(surround), mats.stone, 4);
    frames.name = 'magic-side-lancet-stone-frames';
    frames.userData.chroniclesDecorativeOnly = true;
    frames.castShadow = !coarse;
    const panes = new THREE.InstancedMesh(
      new THREE.ShapeGeometry(glass), sideGlass, 4);
    panes.name = 'magic-side-lancet-violet-panes';
    panes.userData.chroniclesDecorativeOnly = true;
    const lead = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.065, 1.45, 0.065), mats.gold, 4);
    lead.name = 'magic-side-lancet-brass-mullions';
    lead.userData.chroniclesDecorativeOnly = true;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (const side of [-1, 1]) {
      for (const z of [-depth * 0.22, depth * 0.22]) {
        dummy.rotation.set(0, side * Math.PI / 2, 0);
        dummy.position.set(side * (width / 2 + 0.30), 2.82, z);
        dummy.updateMatrix();
        frames.setMatrixAt(index, dummy.matrix);
        dummy.position.x = side * (width / 2 + 0.33);
        dummy.updateMatrix();
        panes.setMatrixAt(index, dummy.matrix);
        dummy.position.x = side * (width / 2 + 0.36);
        dummy.position.y = 2.62;
        dummy.updateMatrix();
        lead.setMatrixAt(index++, dummy.matrix);
      }
    }
    for (const batch of [frames, panes, lead]) {
      batch.instanceMatrix.needsUpdate = true;
      lancets.add(batch);
    }
    root.add(lancets);
  }
  // A shallow, single-sided smithy lean-to gives the forge a working
  // silhouette from the side street. It sits entirely over the existing
  // three-by-three blocked house cells, above the side vents and away from
  // the front door; no new collision geometry or interaction targets.
  if (isForge) {
    const leanTo = new THREE.Group();
    leanTo.name = 'forge-west-side-lean-to';
    leanTo.userData.chroniclesDecorativeOnly = true;
    const outerX = -width / 2 - 0.88;
    const canopy = mesh(leanTo,
      new THREE.BoxGeometry(1.32, 0.18, depth * 0.82),
      roof, 'forge-lean-to-pitched-canopy',
      [-width / 2 - 0.45, height - 0.55, 0], !coarse);
    canopy.rotation.z = 0.25;
    mesh(leanTo, new THREE.BoxGeometry(0.19, 0.22, depth * 0.78),
      mats.timber, 'forge-lean-to-oak-eave',
      [outerX, height - 0.85, 0], !coarse);
    for (const z of [-depth * 0.32, depth * 0.32]) {
      mesh(leanTo, new THREE.BoxGeometry(0.27, 3.82, 0.27),
        mats.timber, 'forge-lean-to-oak-post',
        [outerX, 2.40, z], !coarse);
      mesh(leanTo, new THREE.BoxGeometry(0.47, 0.50, 0.47),
        mats.stone, 'forge-lean-to-stone-footing',
        [outerX, 0.25, z]);
      const brace = mesh(leanTo,
        new THREE.BoxGeometry(0.16, 1.00, 0.18),
        mats.timber, 'forge-lean-to-diagonal-brace',
        [outerX + 0.30, height - 1.25, z], !coarse);
      brace.rotation.z = -0.62;
    }
    root.add(leanTo);
  }
  // The inn has an overhanging upper-floor guest oriel on its east side:
  // a complete timber-and-glass volume, not another merchant window decal.
  // Book One's north-facing house rotates by PI: local -X faces the east
  // plaza street, where the gallery is actually visible to players.
  // It projects only over the already-blocked house cells, clears the lower
  // side windows and leaves the door, interaction and collision map untouched.
  if (isTavern) {
    const oriel = new THREE.Group();
    oriel.name = 'tavern-east-guest-oriel';
    oriel.userData.chroniclesDecorativeOnly = true;
    oriel.position.set(-width / 2 - 0.15, height - 1.02, -depth * 0.04);
    const oak = material(0x69462f, { roughness: 0.96 });
    mesh(oriel, new THREE.BoxGeometry(0.96, 1.35, 3.56), oak,
      'tavern-oriel-timber-body', [-0.10, 0, 0], !coarse);
    // Two warm guest-room windows face the east street, framed in oak.
    for (const z of [-0.91, 0.91]) {
      mesh(oriel, new THREE.BoxGeometry(0.08, 0.79, 1.12), mats.window,
        'tavern-oriel-guest-window', [-0.63, 0.12, z], !coarse);
      mesh(oriel, new THREE.BoxGeometry(0.13, 0.09, 1.24), mats.timber,
        'tavern-oriel-window-sill', [-0.70, -0.34, z]);
      mesh(oriel, new THREE.BoxGeometry(0.14, 0.78, 0.09), mats.timber,
        'tavern-oriel-window-mullion', [-0.70, 0.12, z]);
    }
    for (const z of [-1.78, 1.78]) {
      mesh(oriel, new THREE.BoxGeometry(0.16, 1.45, 0.18), mats.timber,
        'tavern-oriel-corner-post', [-0.62, 0, z], !coarse);
      const bracket = mesh(oriel, new THREE.BoxGeometry(0.16, 0.84, 0.19),
        mats.timber, 'tavern-oriel-diagonal-support', [-0.18, -0.98, z], !coarse);
      bracket.rotation.z = 0.54;
    }
    // A steeper cross-gable makes the guest wing read as a second storey
    // from the east plaza, rather than a low box attached to the inn.
    // The entire roof stays over the existing elevated decorative oriel.
    for (const side of [-1, 1]) {
      const slope = mesh(oriel, new THREE.BoxGeometry(1.52, 0.16, 2.22), roof,
        'tavern-oriel-pitched-roof-slope', [-0.17, 0.95, side * 1.02], !coarse);
      slope.rotation.x = side * 0.44;
    }
    mesh(oriel, new THREE.BoxGeometry(1.60, 0.16, 0.16), mats.timber,
      'tavern-oriel-roof-ridge', [-0.17, 1.43, 0], !coarse);
    // Close the plaza-facing gable with actual brick infill and oak rakes.
    // The little amber roundel belongs to the guest rooms, not a UI decal.
    const guestGable = new THREE.Shape();
    guestGable.moveTo(-1.69, 0.66);
    guestGable.lineTo(1.69, 0.66);
    guestGable.lineTo(0, 1.41);
    guestGable.closePath();
    const gableFace = mesh(oriel, new THREE.ShapeGeometry(guestGable), tavernBrick,
      'tavern-oriel-east-brick-gable', [-1.01, 0, 0], !coarse);
    gableFace.rotation.y = -Math.PI / 2;
    for (const side of [-1, 1]) {
      const rake = mesh(oriel, new THREE.BoxGeometry(0.13, 0.12, 2.16), mats.timber,
        'tavern-oriel-east-oak-rake', [-1.04, 0.96, side * 0.99], !coarse);
      rake.rotation.x = side * 0.44;
    }
    const roundel = mesh(oriel, new THREE.CircleGeometry(0.21, 16), mats.window,
      'tavern-oriel-east-amber-roundel', [-1.05, 0.96, 0], !coarse);
    roundel.rotation.y = -Math.PI / 2;
    const roundelFrame = mesh(oriel, new THREE.TorusGeometry(0.25, 0.055, 6, 16), mats.timber,
      'tavern-oriel-east-oak-roundel-frame', [-1.07, 0.96, 0], !coarse);
    roundelFrame.rotation.y = -Math.PI / 2;
    mesh(oriel, new THREE.BoxGeometry(1.04, 0.17, 3.76), mats.timber,
      'tavern-oriel-floor-beam', [-0.10, -0.72, 0], !coarse);
    // A narrow Juliet gallery follows the existing guest-room oriel. The
    // open rail is below the amber glazing, rather than hiding the windows
    // behind another opaque upper-storey box. It does not create walkable
    // space: every child is decorative and mounted well above the street.
    // Keep the projected eastmost point within the house's ornamental
    // frontage and preserve the real plaza-side street/collision grid.
    const gallery = new THREE.Group();
    gallery.name = 'tavern-east-guest-gallery';
    gallery.userData.chroniclesDecorativeOnly = true;
    mesh(gallery, new THREE.BoxGeometry(0.86, 0.14, 3.74), oak,
      'tavern-gallery-oak-deck', [-0.96, -0.85, 0], !coarse);
    mesh(gallery, new THREE.BoxGeometry(0.12, 0.13, 3.56), mats.timber,
      'tavern-gallery-oak-toprail', [-1.33, -0.43, 0], !coarse);
    mesh(gallery, new THREE.BoxGeometry(0.10, 0.09, 3.56), mats.timber,
      'tavern-gallery-lowerrail', [-1.33, -0.76, 0]);
    const balusters = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.11, 0.30, 0.11), mats.timber, 7);
    balusters.name = 'tavern-gallery-carved-balusters';
    balusters.userData.chroniclesDecorativeOnly = true;
    balusters.castShadow = !coarse;
    balusters.receiveShadow = true;
    const rail = new THREE.Object3D();
    for (let i = 0; i < balusters.count; i += 1) {
      rail.position.set(-1.33, -0.60, -1.53 + i * 0.51);
      rail.updateMatrix();
      balusters.setMatrixAt(i, rail.matrix);
    }
    balusters.instanceMatrix.needsUpdate = true;
    gallery.add(balusters);
    // Return rails visibly terminate the balcony at both ends; diagonal
    // knee braces physically connect the deck to the original oak oriel.
    const supports = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.17, 0.98, 0.17), mats.timber, 2);
    supports.name = 'tavern-gallery-knee-supports';
    supports.userData.chroniclesDecorativeOnly = true;
    supports.castShadow = !coarse;
    supports.receiveShadow = true;
    for (const [i, z] of [-1.36, 1.36].entries()) {
      rail.position.set(-0.76, -1.17, z);
      rail.rotation.z = 0.95;
      rail.updateMatrix();
      supports.setMatrixAt(i, rail.matrix);
      mesh(gallery, new THREE.BoxGeometry(0.67, 0.12, 0.11), mats.timber,
        'tavern-gallery-end-rail', [-1.02, -0.43, Math.sign(z) * 1.80], !coarse);
    }
    supports.instanceMatrix.needsUpdate = true;
    gallery.add(supports);
    // Two modest brass ridge finials complete the guest wing roofline.
    // No glow, animation or shadow-heavy extra light source is needed.
    const finials = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.13, 0.30, coarse ? 5 : 8), mats.gold, 2);
    finials.name = 'tavern-oriel-brass-roof-finials';
    finials.userData.chroniclesDecorativeOnly = true;
    for (const [i, z] of [-1.65, 1.65].entries()) {
      rail.rotation.set(0, 0, 0);
      rail.position.set(-0.17, 1.65, z);
      rail.updateMatrix();
      finials.setMatrixAt(i, rail.matrix);
    }
    finials.instanceMatrix.needsUpdate = true;
    gallery.add(finials);
    oriel.add(gallery);
    root.add(oriel);
  }
  // Sage-painted timber shutters give the herb house a botanical side
  // elevation. One instanced draw call, with all leaves attached to the
  // existing solid building; no street tiles, doors or collision change.
  if (isApothecary) {
    const shutters = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.18, 1.40, 0.48),
      material(0x526c49, { roughness: 0.96 }), 8,
    );
    shutters.name = 'apothecary-side-sage-shutters';
    shutters.userData.chroniclesDecorativeOnly = true;
    shutters.castShadow = !coarse;
    const leaf = new THREE.Object3D();
    let index = 0;
    for (const side of [-1, 1]) {
      for (const z of [-depth * 0.22, depth * 0.22]) {
        for (const edge of [-1, 1]) {
          leaf.position.set(side * (width / 2 + 0.30), 2.84, z + edge * 0.99);
          leaf.updateMatrix();
          shutters.setMatrixAt(index++, leaf.matrix);
        }
      }
    }
    shutters.instanceMatrix.needsUpdate = true;
    root.add(shutters);
  }
  // Boarded cargo hatches give the provisions store a warehouse-like side
  // elevation instead of the same glowing domestic windows as other shops.
  // Three oak battens per hatch share one instanced draw call; the authored
  // building footprint, shop entrance and walkable tiles remain unchanged.
  if (isStore) {
    const battens = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.17, 0.13, 1.33),
      material(0x997451, { roughness: 0.98 }), 12,
    );
    battens.name = 'store-side-loading-hatch-battens';
    battens.userData.chroniclesDecorativeOnly = true;
    battens.castShadow = !coarse;
    const batten = new THREE.Object3D();
    let index = 0;
    for (const side of [-1, 1]) {
      for (const z of [-depth * 0.22, depth * 0.22]) {
        for (const y of [2.43, 2.84, 3.25]) {
          batten.position.set(side * (width / 2 + 0.34), y, z);
          batten.updateMatrix();
          battens.setMatrixAt(index++, batten.matrix);
        }
      }
    }
    battens.instanceMatrix.needsUpdate = true;
    root.add(battens);

    // Exposed cedar framing breaks up the otherwise flat ochre warehouse
    // elevations. The uprights sit between the existing cargo hatches and
    // both horizontal rails clear their stone reveals. Two instanced batches,
    // decorative only: no new map geometry, colliders or interaction targets.
    const frame = new THREE.Group();
    frame.name = 'store-warehouse-side-frame';
    frame.userData.chroniclesDecorativeOnly = true;
    const posts = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.24, 4.70, 0.28), mats.timber, 6,
    );
    posts.name = 'store-side-cedar-uprights';
    posts.userData.chroniclesDecorativeOnly = true;
    posts.castShadow = !coarse;
    const rails = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.25, 0.22, depth + 0.15), mats.timber, 4,
    );
    rails.name = 'store-side-cedar-rails';
    rails.userData.chroniclesDecorativeOnly = true;
    rails.castShadow = !coarse;
    const timber = new THREE.Object3D();
    let postIndex = 0;
    let railIndex = 0;
    for (const side of [-1, 1]) {
      const x = side * (width / 2 + 0.15);
      for (const z of [-depth * 0.44, 0, depth * 0.44]) {
        timber.position.set(x, 2.35, z);
        timber.updateMatrix();
        posts.setMatrixAt(postIndex++, timber.matrix);
      }
      for (const y of [1.45, 4.60]) {
        timber.position.set(x, y, 0);
        timber.updateMatrix();
        rails.setMatrixAt(railIndex++, timber.matrix);
      }
    }
    posts.instanceMatrix.needsUpdate = true;
    rails.instanceMatrix.needsUpdate = true;
    frame.add(posts, rails);
    root.add(frame);

    // A sheltered side loading dock makes Provisiones read as a working
    // warehouse from the market's oblique approach. The raised timber platform,
    // two oak posts and pitched cedar roof occupy only the existing blocked
    // 3x3 building footprint (local x < 6); the cargo hatches remain visible.
    // Decorative geometry only: no map, collision or interaction changes.
    const dock = new THREE.Group();
    dock.name = 'store-side-loading-dock';
    dock.userData.chroniclesDecorativeOnly = true;
    const deck = mesh(dock, new THREE.BoxGeometry(1.68, 0.24, 5.18), mats.timber,
      'store-loading-dock-oak-deck', [4.96, 0.24, 0], !coarse);
    deck.userData.chroniclesDecorativeOnly = true;
    const canopy = mesh(dock, new THREE.BoxGeometry(1.88, 0.17, 5.42), roof,
      'store-loading-dock-cedar-roof', [4.96, 3.79, 0], !coarse);
    canopy.rotation.z = -0.32;
    canopy.userData.chroniclesDecorativeOnly = true;
    for (const z of [-2.38, 2.38]) {
      const post = mesh(dock, new THREE.BoxGeometry(0.25, 3.24, 0.25), mats.timber,
        'store-loading-dock-oak-post', [5.48, 1.81, z], !coarse);
      post.userData.chroniclesDecorativeOnly = true;
      const brace = mesh(dock, new THREE.BoxGeometry(0.16, 0.94, 0.18), mats.timber,
        'store-loading-dock-knee-brace', [5.24, 3.16, z], !coarse);
      brace.rotation.z = -0.56;
      brace.userData.chroniclesDecorativeOnly = true;
    }
    root.add(dock);
  }
  // A single broad merchant's attic loft replaces the ordinary domestic
  // dormers on the general store. The oak gable and glazed loading bay break
  // its roof silhouette without touching the solid map footprint or doors.
  if (isStore) {
    const loft = new THREE.Group();
    loft.name = 'store-merchant-loft';
    loft.userData.chroniclesDecorativeOnly = true;
    // Project the loading-bay window beyond the front gable so it actually
    // reads from the street, not just from a top-down geometry inspection.
    loft.position.set(0, height + 1.38, depth * 0.45);
    const oak = material(0x79553c, { roughness: 0.96 });
    mesh(loft, new THREE.BoxGeometry(2.54, 1.45, 1.42), oak,
      'store-loft-oak-gable', [0, 0, 0], !coarse);
    mesh(loft, new THREE.BoxGeometry(1.32, 0.83, 0.10), mats.window,
      'store-loft-window', [0, 0.12, 0.77]);
    for (const side of [-1, 1]) {
      const slope = mesh(loft, new THREE.BoxGeometry(1.66, 0.15, 1.85), roof,
        'store-loft-roof-slope', [side * 0.53, 0.94, 0], !coarse);
      slope.rotation.z = -side * 0.50;
      mesh(loft, new THREE.BoxGeometry(0.14, 1.36, 0.14), mats.timber,
        'store-loft-window-post', [side * 0.73, 0, 0.81]);
    }
    mesh(loft, new THREE.BoxGeometry(2.60, 0.18, 0.24), mats.timber,
      'store-loft-front-beam', [0, -0.75, 0.78]);
    // A projecting cargo balcony makes the attic read as a warehouse rather
    // than another domestic dormer. Its open middle receives the hoist; all
    // pieces stay above the existing street and are decorative only.
    const balcony = new THREE.Group();
    balcony.name = 'store-loft-loading-balcony';
    balcony.userData.chroniclesDecorativeOnly = true;
    mesh(balcony, new THREE.BoxGeometry(2.94, 0.18, 1.10), oak,
      'store-balcony-loading-deck', [0, -1.02, 1.27], !coarse);
    for (const side of [-1, 1]) {
      mesh(balcony, new THREE.BoxGeometry(0.14, 0.70, 1.05), mats.timber,
        'store-balcony-side-rail', [side * 1.39, -0.59, 1.27], !coarse);
      mesh(balcony, new THREE.BoxGeometry(0.78, 0.13, 0.14), mats.timber,
        'store-balcony-front-rail', [side * 1.04, -0.55, 1.83], !coarse);
      const brace = mesh(balcony, new THREE.BoxGeometry(0.15, 1.30, 0.16),
        mats.timber, 'store-balcony-diagonal-brace',
        [side * 1.10, -1.64, 0.94], !coarse);
      brace.rotation.x = -0.47;
    }
    loft.add(balcony);
    // A timber loading hoist crowns the merchant loft, giving the
    // provisions warehouse a recognisable silhouette from the street.
    // The boom overhangs high above the street but never changes the
    // authored building footprint, shop access or collision grid.
    const hoist = new THREE.Group();
    hoist.name = 'store-loft-loading-hoist';
    hoist.userData.chroniclesDecorativeOnly = true;
    mesh(hoist, new THREE.BoxGeometry(0.20, 0.19, 2.70), mats.timber,
      'store-hoist-oak-boom', [0, 1.83, 1.10], !coarse);
    // Extend the existing two loft-window posts into a proper timber gantry.
    // Without this support the overhanging beam reads as floating in WebGL.
    for (const side of [-1, 1]) {
      mesh(hoist, new THREE.BoxGeometry(0.16, 1.20, 0.16), mats.timber,
        'store-hoist-gantry-upright', [side * 0.73, 1.22, 0.81], !coarse);
    }
    mesh(hoist, new THREE.BoxGeometry(1.68, 0.18, 0.20), mats.timber,
      'store-hoist-gantry-crosshead', [0, 1.82, 0.81], !coarse);
    const brace = mesh(hoist, new THREE.BoxGeometry(0.15, 1.55, 0.16), mats.timber,
      'store-hoist-diagonal-brace', [0, 1.00, 1.15], !coarse);
    brace.rotation.x = 0.52;
    mesh(hoist, new THREE.BoxGeometry(0.075, 1.36, 0.075), mats.steel,
      'store-hoist-chain', [0, 1.02, 2.22]);
    mesh(hoist, new THREE.TorusGeometry(0.19, 0.06, 6, coarse ? 8 : 12), mats.steel,
      'store-hoist-iron-ring', [0, 0.26, 2.22]);
    loft.add(hoist);
    root.add(loft);
  } else if (isForge) {
    // The smithy has a raised, louvered smoke lantern instead of domestic
    // dormers. Its asymmetric oak-and-iron roofline is visible above the
    // front gable and stays entirely inside the authored solid footprint.
    const vent = new THREE.Group();
    vent.name = 'forge-roof-smoke-lantern';
    vent.userData.chroniclesDecorativeOnly = true;
    vent.position.set(-width * 0.20, roofRidgeY + 0.06, facadeZ + 0.24);
    mesh(vent, new THREE.BoxGeometry(3.00, 1.30, 0.74),
      material(0x392b21, { roughness: 1 }),
      'forge-lantern-dark-opening', [0, -0.15, 0], !coarse);
    // The posts continue into the roof: a freestanding dark box would read
    // like modern HVAC rather than an old timber-framed smithy lantern.
    for (const side of [-1, 1]) {
      mesh(vent, new THREE.BoxGeometry(0.22, 2.45, 0.90), mats.timber,
        'forge-lantern-oak-post', [side * 1.54, -0.40, 0], !coarse);
    }
    const smokeLouver = material(0x645040, { roughness: 0.97, metalness: 0.06 });
    for (const y of [-0.51, -0.13, 0.25]) {
      const slat = mesh(vent, new THREE.BoxGeometry(2.94, 0.13, 0.16), smokeLouver,
        'forge-lantern-iron-louver', [0, y, 0.48]);
      slat.rotation.x = -0.18;
    }
    const lanternGable = new THREE.Shape();
    lanternGable.moveTo(-1.73, 0.76);
    lanternGable.lineTo(1.73, 0.76);
    lanternGable.lineTo(0, 1.56);
    lanternGable.closePath();
    mesh(vent, new THREE.ShapeGeometry(lanternGable), mats.timber,
      'forge-lantern-timber-gable', [0, 0, 0.48]);
    for (const side of [-1, 1]) {
      const cap = mesh(vent, new THREE.BoxGeometry(1.92, 0.19, 1.18), roof,
        'forge-lantern-pitched-cap', [side * 0.83, 1.13, 0], !coarse);
      cap.rotation.z = -side * 0.44;
    }
    root.add(vent);
    // The weaponsmith's street gable now has a full-size oak roof truss and
    // a dark iron smoke louver. These make the workshop legible by its
    // architecture rather than the shared merchant plaque alone. Both sit
    // over the existing solid building cells, without lights or colliders.
    const gableTruss = new THREE.Group();
    gableTruss.name = 'forge-front-oak-gable-truss';
    gableTruss.userData.chroniclesDecorativeOnly = true;
    for (const side of [-1, 1]) {
      const rafter = mesh(gableTruss, new THREE.BoxGeometry(0.23, 4.46, 0.23),
        mats.timber, 'forge-gable-raking-oak-rafter',
        [side * 2.03, height + 0.87, facadeZ + 0.35], !coarse);
      rafter.rotation.z = side * 1.16;
    }
    root.add(gableTruss);
    const gableLouver = new THREE.Group();
    gableLouver.name = 'forge-front-gable-smoke-louver';
    gableLouver.userData.chroniclesDecorativeOnly = true;
    gableLouver.position.set(0, height + 0.80, facadeZ + 0.43);
    mesh(gableLouver, new THREE.BoxGeometry(1.72, 0.60, 0.08),
      material(0x241c18, { roughness: 1 }), 'forge-gable-dark-vent', [0, 0, 0]);
    for (const y of [-0.21, 0, 0.21]) {
      const slat = mesh(gableLouver, new THREE.BoxGeometry(1.60, 0.10, 0.12),
        mats.steel, 'forge-gable-iron-louver-slat', [0, y, 0.12], !coarse);
      slat.rotation.x = -0.20;
    }
    for (const side of [-1, 1]) {
      mesh(gableLouver, new THREE.BoxGeometry(0.13, 0.78, 0.20),
        mats.steel, 'forge-gable-iron-jamb', [side * 0.91, 0, 0.08], !coarse);
    }
    for (const y of [-0.36, 0.36]) {
      mesh(gableLouver, new THREE.BoxGeometry(1.94, 0.12, 0.20),
        mats.steel, 'forge-gable-iron-lintel', [0, y, 0.08], !coarse);
    }
    root.add(gableLouver);
  } else if (!isTemple && !isTavern && !isMagic && !isArmor && !isApothecary) {
    // Merchant houses retain dormers; the botica's glazed herbarium needs a clear silhouette,
    // just like the temple, tavern, guild and armorer have distinct rooflines.
    for (const side of (coarse ? [-1] : [-1, 1])) {
      const x = side * width * 0.245;
      const z = depth * 0.17;
      const bay = new THREE.Group();
      bay.name = 'pitched-roof-dormer-' + side;
      bay.position.set(x, height + 1.38, z);
      mesh(bay, new THREE.BoxGeometry(1.22, 1.16, 1.10), wallMaterial,
        'dormer-walls', [0, 0, 0]);
      mesh(bay, new THREE.BoxGeometry(0.73, 0.69, 0.11), mats.window,
        'dormer-glass', [0, 0.09, 0.61]);
      for (const rx of [-1, 1]) {
        const canopy = mesh(bay, new THREE.BoxGeometry(0.87, 0.14, 1.47), roof,
          'dormer-roof-slope', [rx * 0.30, 0.76, 0]);
        canopy.rotation.z = -rx * 0.48;
      }
      root.add(bay);
    }
  }
  // The forge has an industrial stack; the provisions warehouse a loading
  // hoist. Only ordinary merchant houses keep a domestic chimney. The
  // botica, guild and armorer retain their own rooflines. No grid changes.
  if (!isForge && !isTavern && !isTemple && !isMagic && !isArmor && !isApothecary && !isStore) {
    mesh(root, new THREE.BoxGeometry(1.05, 2.3, 0.95), mats.stone,
      'stone-chimney', [width * 0.31, height + 1.04, -depth * 0.25], !coarse);
    mesh(root, new THREE.BoxGeometry(1.38, 0.22, 1.32), mats.stone,
      'chimney-cap', [width * 0.31, height + 2.24, -depth * 0.25]);
  }

  // A stepped brick gable gives the inn a broad, unmistakable street-facing
  // roofline. Unlike the merchant dormers, it is one continuous masonry
  // silhouette beneath the tavern's two-flue hearth. The original solid
  // footprint, entrance and collision grid remain unchanged.
  if (isTavern) {
    const stepped = new THREE.Group();
    stepped.name = 'tavern-brick-stepped-gable';
    stepped.userData.chroniclesDecorativeOnly = true;
    stepped.position.z = facadeZ + 0.28;
    const bricks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.78, 0.44, 0.50), tavernBrick, 8);
    bricks.name = 'tavern-gable-brick-steps';
    const coping = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.90, 0.13, 0.60), mats.stone, 8);
    coping.name = 'tavern-gable-stone-coping';
    const step = new THREE.Object3D();
    const levels = [[3.35, 0.35], [2.50, 0.72], [1.65, 1.10], [0.80, 1.47]];
    levels.forEach(([x, rise], level) => {
      for (const [sideIndex, side] of [-1, 1].entries()) {
        const index = level * 2 + sideIndex;
        step.position.set(side * x, height + rise, 0);
        step.updateMatrix();
        bricks.setMatrixAt(index, step.matrix);
        step.position.set(side * x, height + rise + 0.285, 0.04);
        step.updateMatrix();
        coping.setMatrixAt(index, step.matrix);
      }
    });
    bricks.instanceMatrix.needsUpdate = true;
    coping.instanceMatrix.needsUpdate = true;
    bricks.castShadow = !coarse;
    coping.castShadow = !coarse;
    bricks.receiveShadow = true;
    coping.receiveShadow = true;
    stepped.add(bricks, coping);
    mesh(stepped, new THREE.BoxGeometry(1.04, 0.50, 0.58), tavernBrick,
      'tavern-gable-central-crown', [0, height + 1.83, 0], !coarse);
    mesh(stepped, new THREE.BoxGeometry(1.16, 0.14, 0.66), mats.stone,
      'tavern-gable-crown-coping', [0, height + 2.15, 0.04], !coarse);
    // The same brick silhouette closes the rear gable, visible when
    // approaching the tavern from the northern street. Both remain decorative.
    const rear = stepped.clone(true);
    rear.name = 'tavern-brick-stepped-rear-gable';
    rear.position.z = -(facadeZ + 0.28);
    rear.rotation.y = Math.PI;
    root.add(stepped, rear);
  }
  // Each hero building has a distinctive readable silhouette.
  if (isTemple) {
    mesh(root, new THREE.CylinderGeometry(1.19, 1.38, 3.2, coarse ? 12 : 20), mats.stone,
      'temple-bell-tower', [0, height + 3.15, -depth * 0.11], !coarse);
    // Four open-looking belfry arches interrupt the formerly featureless
    // limestone drum. Dark recesses and small bronze bells are visual only;
    // they sit above the existing solid roof, without new lights or colliders.
    const belfry = new THREE.Group();
    belfry.name = 'temple-belfry-openings';
    belfry.userData.chroniclesDecorativeOnly = true;
    const recess = material(0x202c31, { roughness: 1, side: THREE.DoubleSide });
    const bellBronze = material(0xb7954e, { roughness: 0.52, metalness: 0.48 });
    const opening = new THREE.Shape();
    opening.moveTo(-0.38, -0.60);
    opening.lineTo(0.38, -0.60);
    opening.lineTo(0.38, 0.24);
    opening.quadraticCurveTo(0.38, 0.57, 0, 0.67);
    opening.quadraticCurveTo(-0.38, 0.57, -0.38, 0.24);
    opening.closePath();
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const bay = new THREE.Group();
      bay.name = 'temple-belfry-arched-bay';
      bay.position.set(Math.sin(angle) * 1.27, height + 3.70,
        -depth * 0.11 + Math.cos(angle) * 1.27);
      bay.rotation.y = angle;
      mesh(bay, new THREE.ShapeGeometry(opening), recess,
        'temple-belfry-dark-arch', [0, 0, 0], !coarse);
      for (const side of [-1, 1]) {
        mesh(bay, new THREE.BoxGeometry(0.12, 0.93, 0.15), mats.stone,
          'temple-belfry-limestone-jamb', [side * 0.44, -0.17, 0.055], !coarse);
      }
      mesh(bay, new THREE.TorusGeometry(0.44, 0.075, 6, coarse ? 12 : 20, Math.PI),
        mats.stone, 'temple-belfry-limestone-arch', [0, 0.28, 0.06], !coarse);
      mesh(bay, new THREE.CylinderGeometry(0.13, 0.25, 0.40, 8), bellBronze,
        'temple-belfry-bronze-bell', [0, -0.13, 0.14], !coarse);
      mesh(bay, new THREE.SphereGeometry(0.08, 8, 6), bellBronze,
        'temple-belfry-bell-clapper', [0, -0.38, 0.15]);
      belfry.add(bay);
    }
    root.add(belfry);
    mesh(root, new THREE.ConeGeometry(1.48, 2.8, coarse ? 12 : 20), roof,
      'temple-spire', [0, height + 6.15, -depth * 0.11], !coarse);
    // Two slender limestone pinnacles lift the temple's gable shoulders
    // above the roofline. Unlike the armorer's square iron-capped towers,
    // these are narrow octagonal stone spires with small gilded finials.
    // They never alter the authored solid footprint or entrance.
    const pinnacles = new THREE.Group();
    pinnacles.name = 'temple-gable-pinnacles';
    pinnacles.userData.chroniclesDecorativeOnly = true;
    pinnacles.position.z = facadeZ + 0.25;
    for (const side of [-1, 1]) {
      const x = side * width * 0.40;
      mesh(pinnacles, new THREE.BoxGeometry(0.76, 0.24, 0.76), mats.stone,
        'temple-pinnacle-plinth', [x, height + 0.32, 0], !coarse);
      mesh(pinnacles, new THREE.CylinderGeometry(0.24, 0.30, 1.05, coarse ? 8 : 12),
        mats.stone, 'temple-pinnacle-shaft', [x, height + 0.86, 0], !coarse);
      mesh(pinnacles, new THREE.ConeGeometry(0.39, 0.94, coarse ? 8 : 12),
        roof, 'temple-pinnacle-spire', [x, height + 1.81, 0], !coarse);
      mesh(pinnacles, new THREE.SphereGeometry(0.14, 8, 6), mats.gold,
        'temple-pinnacle-finial', [x, height + 2.33, 0]);
    }
    root.add(pinnacles);

    // A true rose window belongs to the temple's front stone gable, not to
    // a merchant dormer. Reuse the town stone/gold materials and keep all
    // tracery on the building's authored solid footprint.
    const rose = new THREE.Group();
    rose.name = 'temple-gable-rose-window';
    rose.userData.chroniclesDecorativeOnly = true;
    rose.position.set(0, height + 0.72, facadeZ + 0.24);
    mesh(rose, new THREE.CircleGeometry(0.66, coarse ? 16 : 32),
      material(0x467f9d, { emissive: 0x193a51, emissiveIntensity: 0.32,
        roughness: 0.35, metalness: 0.04, side: THREE.DoubleSide }),
      'temple-rose-blue-glass', [0, 0, 0], !coarse);
    mesh(rose, new THREE.TorusGeometry(0.75, 0.12, 6, coarse ? 16 : 32),
      mats.stone, 'temple-rose-limestone-ring', [0, 0, 0.09]);
    const tracery = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.055, 1.28, 0.065), mats.gold, 4);
    tracery.name = 'temple-rose-lead-tracery';
    const ray = new THREE.Object3D();
    for (let i = 0; i < tracery.count; i += 1) {
      ray.position.set(0, 0, 0.16);
      ray.rotation.z = i * Math.PI / 4;
      ray.updateMatrix();
      tracery.setMatrixAt(i, ray.matrix);
    }
    tracery.instanceMatrix.needsUpdate = true;
    rose.add(tracery);
    root.add(rose);
    // The temple has a stone colonnaded entrance, not a merchant doorway.
    // Keep columns outside the nameplate and door; the raised pediment stays
    // between the nameplate and heraldic sign. Entirely decorative geometry.
    const portico = new THREE.Group();
    portico.name = 'temple-limestone-portico';
    portico.userData.chroniclesDecorativeOnly = true;
    portico.position.z = facadeZ + 0.60;
    for (const side of [-1, 1]) {
      mesh(portico, new THREE.CylinderGeometry(0.27, 0.31, 3.15, coarse ? 10 : 16),
        mats.stone, 'temple-portico-column', [side * 1.99, 2.19, 0.03], !coarse);
      mesh(portico, new THREE.BoxGeometry(0.74, 0.26, 0.68), mats.stone,
        'temple-portico-plinth', [side * 1.99, 0.65, 0.03]);
      mesh(portico, new THREE.BoxGeometry(0.74, 0.23, 0.68), mats.stone,
        'temple-portico-capital', [side * 1.99, 3.83, 0.03]);
    }
    mesh(portico, new THREE.BoxGeometry(4.70, 0.20, 0.53), mats.stone,
      'temple-portico-entablature', [0, 4.28, 0.03]);
    const pediment = new THREE.Shape();
    pediment.moveTo(-2.25, 4.42);
    pediment.lineTo(2.25, 4.42);
    pediment.lineTo(0, 5.07);
    pediment.closePath();
    mesh(portico, new THREE.ShapeGeometry(pediment), mats.stone,
      'temple-portico-triangular-pediment', [0, 0, 0.34]);
    root.add(portico);
  } else if (isTownHall) {
    // The mayor's red roof has a modest stone cupola rather than another
    // temple spire. All decorative meshes remain over the solid house cells.
    mesh(root, new THREE.CylinderGeometry(0.86, 0.96, 1.85, 8), mats.stone,
      'civic-cupola-tower', [0, height + 2.25, -depth * 0.11], !coarse);
    mesh(root, new THREE.ConeGeometry(1.15, 1.30, 8), roof,
      'civic-cupola-roof', [0, height + 3.82, -depth * 0.11], !coarse);
    mesh(root, new THREE.CylinderGeometry(1.02, 1.02, 0.13, 8), mats.gold,
      'civic-cupola-crest', [0, height + 1.40, -depth * 0.11]);
  } else if (isApothecary) {
    // The apothecary is a glazed rooftop herbarium, not a second wizard's
    // turret. All pieces sit above the authored solid building footprint.
    // Real glazing needs an open frame: the previous solid timber box
    // obscured the panes and read as an opaque green roof cube from the street.
    // Clearer, paler glazing lets the actual terracotta and foliage read
    // through the roof instead of flattening the conservatory into a green box.
    // Keep depth writes disabled so the interior remains visible on mobile.
    const herbalGlass = material(0xc1e2d2, {
      emissive: 0x0d2b24, emissiveIntensity: 0.06, metalness: 0.04,
      roughness: 0.19, transparent: true, opacity: 0.42,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const herbarium = new THREE.Group();
    herbarium.name = 'apothecary-roof-herbarium';
    herbarium.userData.chroniclesDecorativeOnly = true;
    // The greenhouse spans most of the roof as a distinct botanical crown,
    // rather than a small green box lost between neighbouring shop gables.
    // Its stone terrace intersects the existing solid roof, never a walk tile.
    const terrace = mesh(root, new THREE.BoxGeometry(5.65, 0.60, 3.75),
      apothecaryStone, 'apothecary-herbarium-stone-terrace',
      [0, height + 1.44, -depth * 0.12], !coarse);
    terrace.userData.chroniclesDecorativeOnly = true;
    herbarium.position.set(0, height + 1.74, -depth * 0.12);
    herbarium.scale.set(1.75, 1.30, 1.35);
    // Slender posts and continuous sills/eaves frame actual glass panels.
    // The building's authored solid footprint and entrance are unchanged.
    for (const x of [-1.38, 1.38]) {
      for (const z of [-1.07, 1.07]) {
        mesh(herbarium, new THREE.BoxGeometry(0.17, 1.46, 0.17), mats.timber,
          'herbarium-corner-post', [x, 0.74, z], !coarse);
      }
      for (const y of [0.10, 1.43]) {
        mesh(herbarium, new THREE.BoxGeometry(0.17, 0.14, 2.28), mats.timber,
          'herbarium-side-rail', [x, y, 0], !coarse);
      }
      mesh(herbarium, new THREE.BoxGeometry(0.055, 1.17, 2.04), herbalGlass,
        'herbarium-side-glazing', [x, 0.75, 0], !coarse);
    }
    for (const z of [-1.07, 1.07]) {
      for (const y of [0.10, 1.43]) {
        mesh(herbarium, new THREE.BoxGeometry(2.92, 0.14, 0.17), mats.timber,
          'herbarium-front-rail', [0, y, z], !coarse);
      }
      mesh(herbarium, new THREE.BoxGeometry(2.66, 1.17, 0.055), herbalGlass,
        'herbarium-green-glazing', [0, 0.75, z], !coarse);
    }
    for (const side of [-1, 1]) {
      const pane = mesh(herbarium, new THREE.BoxGeometry(1.72, 0.095, 2.46),
        herbalGlass, 'herbarium-glazed-roof', [side * 0.72, 1.94, 0], !coarse);
      pane.rotation.z = -side * 0.67;
      // A steeper glass pitch gives the botica a readable conservatory crown
      // at street level; eaves still meet the existing frame, without new blockers.
      // Exposed rafters make the pitched greenhouse silhouette legible even
      // when the translucent panes blend into the sky on a small screen.
      const rafter = mesh(herbarium, new THREE.BoxGeometry(1.77, 0.14, 0.15),
        mats.timber, 'herbarium-roof-rafter', [side * 0.72, 2.00, 1.15], !coarse);
      rafter.rotation.z = -side * 0.67;
      // Two slender cross-purlins divide each glass slope into believable
      // conservatory bays. They follow the existing pitch, sit above the
      // panes and remain wholly above the original roof/solid footprint.
      for (const offset of [0.38, 1.06]) {
        const crossbar = mesh(herbarium, new THREE.BoxGeometry(0.12, 0.12, 2.34),
          mats.timber, 'herbarium-roof-glazing-mullion',
          [side * offset, 2.02 + (0.72 - offset) * Math.tan(0.67), 0], !coarse);
        crossbar.rotation.z = -side * 0.67;
        crossbar.userData.chroniclesDecorativeOnly = true;
      }
    }
    mesh(herbarium, new THREE.BoxGeometry(0.17, 0.19, 2.54), mats.timber,
      'herbarium-roof-ridge', [0, 2.55, 0], !coarse);
    // The conservatory contains real botanical silhouettes, not an empty
    // tinted glass box. Two rows of terracotta pots and leafy crowns remain
    // behind the glazing, within the original solid roof footprint. Three
    // instanced batches keep the detail inexpensive even on mobile.
    const nursery = new THREE.Group();
    nursery.name = 'apothecary-herbarium-botanical-beds';
    nursery.userData.chroniclesDecorativeOnly = true;
    const pots = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.20, 0.16, 0.32, 8),
      material(0xa76847, { roughness: 0.94 }), 6);
    pots.name = 'herbarium-terracotta-pots';
    const stems = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.035, 0.05, 0.65, 6),
      material(0x416c43, { roughness: 0.96 }), 6);
    stems.name = 'herbarium-botanical-stems';
    const crowns = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.23, 8, 6),
      material(0x78a66a, { roughness: 0.95 }), 18);
    crowns.name = 'herbarium-botanical-leaf-clusters';
    const plant = new THREE.Object3D();
    let potIndex = 0;
    let leafIndex = 0;
    for (const z of [-0.55, 0.55]) {
      for (const x of [-0.80, 0, 0.80]) {
        plant.position.set(x, 0.24, z);
        plant.scale.set(1, 1, 1);
        plant.updateMatrix();
        pots.setMatrixAt(potIndex, plant.matrix);
        plant.position.y = 0.70;
        plant.updateMatrix();
        stems.setMatrixAt(potIndex++, plant.matrix);
        for (const [dx, y, dz, size] of [
          [-0.16, 0.96, 0, 0.94],
          [0.16, 1.06, 0.05, 1.06],
          [0, 1.19, -0.08, 0.87],
        ]) {
          plant.position.set(x + dx, y, z + dz);
          plant.scale.set(size, size * 0.90, size);
          plant.updateMatrix();
          crowns.setMatrixAt(leafIndex++, plant.matrix);
        }
      }
    }
    for (const batch of [pots, stems, crowns]) {
      batch.userData.chroniclesDecorativeOnly = true;
      batch.castShadow = false;
      batch.instanceMatrix.needsUpdate = true;
      nursery.add(batch);
    }
    herbarium.add(nursery);
    root.add(herbarium);
    // Drying herbs distinguish the street-level frontage even on a phone.
    // Batch all four bunches; never add an obstacle or a light source.
    const herbs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.19, 0.60, 7),
      material(0x62865a), 4);
    herbs.name = 'apothecary-hanging-herbs';
    herbs.userData.chroniclesDecorativeOnly = true;
    const bundle = new THREE.Object3D();
    for (let i = 0; i < herbs.count; i += 1) {
      const side = i < 2 ? -1 : 1;
      bundle.position.set(side * (1.20 + (i % 2) * 0.39),
        2.25 + (i % 2) * 0.26, facadeZ + 0.45);
      bundle.rotation.z = Math.PI + side * 0.12;
      bundle.updateMatrix();
      herbs.setMatrixAt(i, bundle.matrix);
    }
    herbs.instanceMatrix.needsUpdate = true;
    root.add(herbs);
  } else if (isMagic) {
    // An octagonal observatory breaks the guild's otherwise generic pitched
    // roofline. It sits above the existing roof, clear of the gable oculus and
    // entrance, and reuses the town's stone, slate, brass and arcane materials.
    // Decorative only: no collision, light source, texture or animation.
    const observatory = new THREE.Group();
    observatory.name = 'magic-guild-roof-observatory';
    observatory.userData.chroniclesDecorativeOnly = true;
    observatory.position.set(width * 0.08, height + 1.87, -depth * 0.04);
    mesh(observatory, new THREE.CylinderGeometry(1.54, 1.72, 2.02, 8),
      guildStone, 'magic-observatory-stone-drum', [0, 0.23, 0], !coarse);
    mesh(observatory, new THREE.CylinderGeometry(1.81, 1.81, 0.18, 8),
      mats.gold, 'magic-observatory-brass-collar', [0, 1.33, 0]);
    mesh(observatory, new THREE.ConeGeometry(2.04, 2.45, 8),
      roof, 'magic-observatory-steep-roof', [0, 2.63, 0], !coarse);
    for (const x of [-0.65, 0.65]) {
      mesh(observatory, new THREE.BoxGeometry(0.54, 0.96, 0.08),
        mats.gold, 'magic-observatory-window-frame', [x, 0.24, 1.65], !coarse);
      mesh(observatory, new THREE.BoxGeometry(0.38, 0.79, 0.10),
        mats.arcane, 'magic-observatory-violet-window', [x, 0.24, 1.71], !coarse);
    }
    root.add(observatory);
    // The guild's formerly bare, beige turret now shares the violet-slate
    // ashlar of its observatory and carries four narrow glazed lancets. These
    // sit on the existing elevated cylinder: no collision, light or interaction.
    const turretX = -width * 0.40;
    const turretZ = -depth * 0.28;
    const turret = mesh(root,
      new THREE.CylinderGeometry(1.11, 1.20, 3.35, coarse ? 12 : 20), guildStone,
      'magic-shop-turret', [turretX, height + 1.62, turretZ], !coarse);
    turret.userData.chroniclesDecorativeOnly = true;
    const turretLancets = new THREE.Group();
    turretLancets.name = 'magic-turret-slate-lancets';
    turretLancets.userData.chroniclesDecorativeOnly = true;
    const glass = material(0x695398, {
      emissive: 0x241739, emissiveIntensity: 0.25, roughness: 0.40,
    });
    // Pointed limestone tracery matches the guild's existing Gothic windows.
    // Share both shapes across the four bays; no rectangular gold frames.
    const outer = new THREE.Shape();
    outer.moveTo(-0.31, -0.57);
    outer.lineTo(0.31, -0.57);
    outer.lineTo(0.31, 0.24);
    outer.lineTo(0, 0.66);
    outer.lineTo(-0.31, 0.24);
    outer.closePath();
    const inner = new THREE.Shape();
    inner.moveTo(-0.23, -0.46);
    inner.lineTo(0.23, -0.46);
    inner.lineTo(0.23, 0.20);
    inner.lineTo(0, 0.51);
    inner.lineTo(-0.23, 0.20);
    inner.closePath();
    const outerGeometry = new THREE.ShapeGeometry(outer);
    const innerGeometry = new THREE.ShapeGeometry(inner);
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const bay = new THREE.Group();
      bay.name = 'magic-turret-lancet-bay';
      bay.userData.chroniclesDecorativeOnly = true;
      bay.position.set(turretX + Math.sin(angle) * 1.18,
        height + 1.90, turretZ + Math.cos(angle) * 1.18);
      bay.rotation.y = angle;
      for (const [geometry, mat, name, position] of [
        [outerGeometry, mats.stone, 'magic-turret-lancet-pointed-frame', [0, 0, 0]],
        [innerGeometry, glass, 'magic-turret-lancet-violet-pane', [0, 0, 0.06]],
        [new THREE.BoxGeometry(0.045, 0.78, 0.07), mats.gold,
          'magic-turret-lancet-brass-mullion', [0, -0.16, 0.12]],
        [new THREE.BoxGeometry(0.68, 0.10, 0.18), mats.stone,
          'magic-turret-lancet-stone-sill', [0, -0.61, 0.06]],
      ]) {
        const part = mesh(bay, geometry, mat, name, position, !coarse);
        part.userData.chroniclesDecorativeOnly = true;
      }
      turretLancets.add(bay);
    }
    root.add(turretLancets);
    mesh(root, new THREE.ConeGeometry(1.52, 3.5, coarse ? 12 : 20), roof,
      'magic-turret-roof', [turretX, height + 5.02, turretZ], !coarse);
    // A pointed slate portal and luminous gable oculus give the mage guild
    // its own street-level architecture, not just another merchant sign.
    // The piers flank (never cover) the existing door; all parts stay inside
    // the solid building footprint and are decorative only.
    const portal = new THREE.Group();
    portal.name = 'magic-guild-pointed-entry';
    portal.userData.chroniclesDecorativeOnly = true;
    portal.position.z = facadeZ + 0.38;
    const slate = material(0x736781, {
      map: swordhavenSurfaceTexture('masonry'),
      normalMap: swordhavenSurfaceNormalTexture('masonry'),
      normalScale: new THREE.Vector2(0.42, 0.42), roughness: 0.94,
    });
    for (const side of [-1, 1]) {
      mesh(portal, new THREE.BoxGeometry(0.32, 2.70, 0.34), slate,
        'magic-entry-pier', [side * 1.18, 2.0, 0], !coarse);
      const arch = mesh(portal, new THREE.BoxGeometry(0.32, 1.65, 0.34), slate,
        'magic-entry-pointed-arch', [side * 0.57, 3.65, 0.01], !coarse);
      arch.rotation.z = side * 0.68;
    }
    root.add(portal);
    // The small stained-glass roundel sits in the existing solid gable.
    // No transparent sorting, new texture, light or animation is required.
    const oculus = new THREE.Group();
    oculus.name = 'magic-guild-gable-oculus';
    oculus.userData.chroniclesDecorativeOnly = true;
    oculus.position.set(0, height + 0.75, facadeZ + 0.27);
    mesh(oculus, new THREE.CircleGeometry(0.49, 24), mats.arcane,
      'magic-oculus-violet-glass', [0, 0, 0]);
    mesh(oculus, new THREE.TorusGeometry(0.53, 0.075, 8, 24), mats.gold,
      'magic-oculus-brass-ring', [0, 0, 0.035]);
    root.add(oculus);
    mesh(root, new THREE.OctahedronGeometry(0.42, 0), mats.arcane,
      'arcane-window-lantern', [width * 0.33, height - 0.3, facadeZ + 0.28]);
  } else if (isTavern) {
    // A shallow two-pitch oak porch replaces the flat floating roof slab.
    // The ridge stays below the shop plaque and the eaves meet the existing
    // timber posts; this is decoration over the same authored solid cells.
    const porch = new THREE.Group();
    porch.name = 'tavern-porch-awning';
    porch.userData.chroniclesDecorativeOnly = true;
    porch.position.z = facadeZ + 1.07;
    for (const side of [-1, 1]) {
      const slope = mesh(porch, new THREE.BoxGeometry(2.68, 0.15, 2.14), roof,
        'tavern-porch-pitched-slope', [side * 1.27, 3.18, 0], !coarse);
      slope.rotation.z = -side * 0.14;
    }
    mesh(porch, new THREE.BoxGeometry(0.16, 0.18, 2.22), mats.timber,
      'tavern-porch-ridge', [0, 3.41, 0], !coarse);
    root.add(porch);
    for (const x of [-2.35, 2.35]) mesh(root, new THREE.CylinderGeometry(0.11, 0.14, 3.15, 8),
      mats.timber, 'porch-timber-support', [x, 1.63, facadeZ + 1.60], !coarse);
    // A broad twin-flue kitchen hearth, not the small domestic chimney or
    // forge's iron smokestack. The brickwork intersects the existing roof,
    // remains decorative and never changes the authored street collision.
    const hearth = new THREE.Group();
    hearth.name = 'tavern-double-hearth';
    hearth.userData.chroniclesDecorativeOnly = true;
    hearth.position.set(-width * 0.28, height + 2.12, -depth * 0.21);
    const hearthBrick = material(0x866251, {
      map: swordhavenSurfaceTexture('brick'),
      normalMap: swordhavenSurfaceNormalTexture('brick'),
      normalScale: new THREE.Vector2(0.48, 0.48), roughness: 0.98,
    });
    mesh(hearth, new THREE.BoxGeometry(2.45, 2.15, 1.62), hearthBrick,
      'tavern-hearth-brick-breast', [0, -0.70, 0], !coarse);
    for (const [index, x] of [-0.68, 0.68].entries()) {
      const flueHeight = index === 0 ? 3.35 : 2.60;
      mesh(hearth, new THREE.BoxGeometry(0.98, flueHeight, 1.02), hearthBrick,
        'tavern-hearth-flue-' + index, [x, flueHeight / 2 + 0.15, 0], !coarse);
      mesh(hearth, new THREE.BoxGeometry(1.20, 0.24, 1.26), mats.stone,
        'tavern-hearth-cap-' + index, [x, flueHeight + 0.28, 0]);
    }
    root.add(hearth);
  } else if (isStore) {
    // A striped merchant canopy gives the general store a recognisable
    // street-level silhouette. All geometry is decorative and elevated:
    // the authored collision footprint and shop interaction stay unchanged.
    const awning = new THREE.Group();
    awning.name = 'store-market-awning';
    awning.userData.chroniclesDecorativeOnly = true;
    awning.position.set(0, 3.25, facadeZ + 0.65);
    const canvas = material(0xe0c38a, { roughness: 1, metalness: 0, side: THREE.DoubleSide });
    const stripe = material(0x855b3e, { roughness: 1, metalness: 0, side: THREE.DoubleSide });
    // A tensioned, gently sagging cloth canopy, not a rigid timber shelf.
    // The six stripes follow the same curve as the base canvas, sharing one
    // instanced draw call. No canvas textures, physics or new collision cells.
    const drapedCanvas = (width, thickness, depth, segments) => {
      // Keep a thin visible fabric edge: a zero-thickness plane disappears
      // edge-on in the street-facing/mobile camera.
      const geometry = new THREE.BoxGeometry(width, thickness, depth, segments, 1, 6);
      const vertices = geometry.getAttribute('position');
      for (let i = 0; i < vertices.count; i += 1) {
        const t = (vertices.getZ(i) + 0.74) / 1.48;
        vertices.setY(i, vertices.getY(i) - 0.10 * Math.sin(Math.PI * t));
      }
      vertices.needsUpdate = true;
      geometry.computeVertexNormals();
      return geometry;
    };
    const cloth = mesh(awning, drapedCanvas(6.20, 0.10, 1.48, 12), canvas,
      'store-awning-cloth', [0, 0, 0]);
    // Keep the old outward pitch so the striped upper surface remains
    // legible from the street, while the center now sags like fabric.
    cloth.rotation.x = 0.16;
    cloth.userData.chroniclesDecorativeOnly = true;
    const bands = new THREE.InstancedMesh(drapedCanvas(0.48, 0.018, 1.46, 2), stripe, 6);
    bands.name = 'store-awning-stripe';
    bands.userData.chroniclesDecorativeOnly = true;
    bands.receiveShadow = true;
    const band = new THREE.Object3D();
    for (const [index, x] of [-2.45, -1.47, -0.49, 0.49, 1.47, 2.45].entries()) {
      band.position.set(x, 0.065, 0);
      band.updateMatrix();
      bands.setMatrixAt(index, band.matrix);
    }
    bands.instanceMatrix.needsUpdate = true;
    bands.rotation.x = 0.16;
    awning.add(bands);
    // The street camera looks up at the canopy: mirror the woven stripes
    // onto its underside, otherwise the cloth reads as a blank beige shelf.
    // Both faces share the same draped geometry and stripe material.
    const underside = new THREE.InstancedMesh(bands.geometry, stripe, 6);
    underside.name = 'store-awning-underside-stripe';
    underside.userData.chroniclesDecorativeOnly = true;
    for (const [index, x] of [-2.45, -1.47, -0.49, 0.49, 1.47, 2.45].entries()) {
      band.position.set(x, -0.065, 0.025);
      band.updateMatrix();
      underside.setMatrixAt(index, band.matrix);
    }
    underside.instanceMatrix.needsUpdate = true;
    underside.rotation.x = 0.16;
    awning.add(underside);
    mesh(awning, new THREE.BoxGeometry(6.42, 0.14, 0.16), mats.timber,
      'store-awning-front-rail', [0, -0.14, 0.77]);
    for (const x of [-2.85, 2.85]) {
      const rib = mesh(awning, new THREE.BoxGeometry(0.13, 0.13, 1.46), mats.timber,
        'store-awning-side-rib', [x, 0, 0]);
      rib.rotation.x = 0.16;
      // Real diagonal oak struts support the projecting canopy. Their lower
      // ends join the solid facade, well to either side of the shop entrance.
      const brace = mesh(awning, new THREE.BoxGeometry(0.16, 0.16, 1.35), mats.timber,
        'store-awning-diagonal-support', [x, -0.30, 0.08], !coarse);
      brace.rotation.x = -0.48;
    }
    // The flat striped slab previously read as a wooden shelf from the street.
    // Six alternating scalloped canvas hems make the merchant canopy legible
    // at eye level and on mobile. Two small batches share one geometry and
    // the existing fabric materials; no textures, lights or colliders.
    const valanceOutline = new THREE.Shape();
    valanceOutline.moveTo(-0.50, 0.04);
    valanceOutline.lineTo(0.50, 0.04);
    valanceOutline.lineTo(0.50, -0.16);
    valanceOutline.quadraticCurveTo(0, -0.48, -0.50, -0.16);
    valanceOutline.closePath();
    const valanceGeometry = new THREE.ShapeGeometry(valanceOutline, coarse ? 4 : 8);
    const panel = new THREE.Object3D();
    for (const [offset, fabric] of [[0, canvas], [1, stripe]]) {
      const hem = new THREE.InstancedMesh(valanceGeometry, fabric, 3);
      hem.name = 'store-awning-scalloped-hem';
      hem.userData.chroniclesDecorativeOnly = true;
      hem.castShadow = false;
      for (let i = 0; i < 3; i += 1) {
        panel.position.set(-2.5 + i * 2 + offset, -0.17, 0.86);
        panel.updateMatrix();
        hem.setMatrixAt(i, panel.matrix);
      }
      hem.instanceMatrix.needsUpdate = true;
      awning.add(hem);
    }
    root.add(awning);
    // An oak-clad merchant frontage beneath the canopy distinguishes the
    // quartermaster at eye level. Both bays flank the existing door and sit
    // entirely on the authored solid building footprint; no collision change.
    const storefront = new THREE.Group();
    storefront.name = 'store-oak-frontage';
    storefront.userData.chroniclesDecorativeOnly = true;
    const oak = material(0x765339, { roughness: 0.94 });
    for (const side of [-1, 1]) {
      const x = side * 2.47;
      mesh(storefront, new THREE.BoxGeometry(2.38, 1.24, 0.13), oak,
        'store-oak-panel', [x, 0.99, facadeZ + 0.33]);
      for (const offset of [-0.91, 0, 0.91]) {
        mesh(storefront, new THREE.BoxGeometry(0.12, 1.18, 0.07), mats.timber,
          'store-oak-batten', [x + offset, 0.99, facadeZ + 0.44]);
      }
      mesh(storefront, new THREE.BoxGeometry(2.50, 0.14, 0.22), mats.timber,
        'store-oak-rail', [x, 1.66, facadeZ + 0.42]);
    }
    root.add(storefront);
    // A few bundled flour/grain sacks give the provisions merchant a
    // recognisable ground-floor stock display, distinct from the forge and
    // tavern. Four low-poly instances stay in front of the oak bays, clear
    // of the real door and wholly inside the existing blocked house cells.
    // A rounded, pinched neck and twine make these read as grain sacks,
    // rather than traffic cones or miniature barrels at normal camera zoom.
    const sackProfile = [
      [0.22, 0], [0.34, 0.04], [0.43, 0.19], [0.48, 0.43],
      [0.44, 0.62], [0.29, 0.77], [0.16, 0.83], [0.15, 0.87],
      // The gathered cloth flares above the cord instead of a pottery lid.
      [0.23, 0.93], [0.16, 0.97], [0.06, 1.03], [0, 1.04],
    ].map(([radius, y]) => new THREE.Vector2(radius, y));
    // Break the lathe's pottery-like rotational symmetry into soft fabric
    // folds. Vertex tints make the creases readable even without cast shadows
    // on touch devices; one shared geometry/material still serves all sacks.
    const sackGeometry = new THREE.LatheGeometry(sackProfile, coarse ? 9 : 12);
    const sackPositions = sackGeometry.getAttribute('position');
    const sackCanvas = new THREE.Color(0xc2a780);
    const sackColors = [];
    for (let index = 0; index < sackPositions.count; index += 1) {
      const x = sackPositions.getX(index);
      const y = sackPositions.getY(index);
      const z = sackPositions.getZ(index);
      const angle = Math.atan2(z, x);
      const fullness = 0.2 + 0.8 * Math.sin(Math.PI * y / 1.04);
      const crease = Math.sin(3 * angle + y * 1.4);
      const ripple = Math.sin(6 * angle - y * 2.2);
      const radius = 1 + fullness * (0.10 * crease + 0.035 * ripple);
      sackPositions.setXYZ(index, x * radius, y, z * radius * 0.9);
      const shade = 0.94 + fullness * (0.10 * crease + 0.025 * ripple);
      sackColors.push(sackCanvas.r * shade, sackCanvas.g * shade, sackCanvas.b * shade);
    }
    sackGeometry.setAttribute('color', new THREE.Float32BufferAttribute(sackColors, 3));
    sackGeometry.computeVertexNormals();
    const sacks = new THREE.InstancedMesh(
      sackGeometry,
      material(0xffffff, { roughness: 1, metalness: 0, vertexColors: true }), 4,
    );
    sacks.name = 'store-front-provisions-sacks';
    sacks.userData.chroniclesDecorativeOnly = true;
    sacks.castShadow = !coarse;
    sacks.receiveShadow = true;
    const ties = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.175, 0.029, 4, coarse ? 9 : 12),
      material(0x765a38, { roughness: 1 }), 4,
    );
    ties.name = 'store-front-sack-twine';
    ties.userData.chroniclesDecorativeOnly = true;
    // A stitched fold follows the front of the canvas; unlike a painted
    // stripe it curves with the belly and dies away at the gathered neck.
    const fold = new THREE.InstancedMesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.16, 0.11, 0.36),
        new THREE.Vector3(-0.18, 0.32, 0.44),
        new THREE.Vector3(-0.14, 0.52, 0.46),
        new THREE.Vector3(-0.12, 0.70, 0.34),
        new THREE.Vector3(-0.09, 0.80, 0.21),
      ]), 8, 0.017, 4, false),
      material(0x8b7355, { roughness: 1 }), 4,
    );
    fold.name = 'store-front-sack-cloth-creases';
    fold.userData.chroniclesDecorativeOnly = true;
    const sack = new THREE.Object3D();
    for (const [index, x] of [-2.92, -2.05, 2.05, 2.92].entries()) {
      const scaleY = index % 2 ? 0.91 : 1.05;
      sack.position.set(x, 0.05, facadeZ + 0.77);
      sack.rotation.set(0, 0, index % 2 ? 0.035 : -0.025);
      sack.scale.set(1, scaleY, 1);
      sack.updateMatrix();
      sacks.setMatrixAt(index, sack.matrix);
      fold.setMatrixAt(index, sack.matrix);
      sack.position.y = 0.05 + 0.83 * scaleY;
      sack.rotation.set(Math.PI / 2, 0, 0);
      sack.scale.set(1, 1, 1);
      sack.updateMatrix();
      ties.setMatrixAt(index, sack.matrix);
    }
    sacks.instanceMatrix.needsUpdate = true;
    ties.instanceMatrix.needsUpdate = true;
    fold.instanceMatrix.needsUpdate = true;
    root.add(sacks, ties, fold);
  } else if (isForge) {
    mesh(root, new THREE.CylinderGeometry(0.52, 0.59, 1.3, 10), mats.stone,
      'forge-brazier', [-width * 0.40, 0.65, facadeZ + 0.23]);
    mesh(root, new THREE.SphereGeometry(0.32, 9, 8), mats.embers,
      'forge-brazier-embers', [-width * 0.40, 1.42, facadeZ + 0.23]);
    // The smith's street-facing workshop bay is framed in heavy dressed stone,
    // with a wrought-iron grille over the existing right window. Unlike the
    // armorer's doorway, this belongs to the workroom and leaves the entrance,
    // engraved shop name and authored collision footprint entirely untouched.
    const bay = new THREE.Group();
    bay.name = 'forge-stone-workshop-bay';
    bay.userData.chroniclesDecorativeOnly = true;
    bay.position.set(width * 0.33, 0, facadeZ + 0.43);
    // The firebox reads as a soot-dark opening instead of another amber
    // merchant window. The ember glow is baked into materials, not a light.
    mesh(bay, new THREE.BoxGeometry(1.44, 1.20, 0.10),
      material(0x261c17, { roughness: 1 }),
      'forge-workshop-soot-recess', [0, 2.75, 0.10]);
    const coals = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.15, 8, 6), mats.embers, 3,
    );
    coals.name = 'forge-workshop-embers';
    coals.userData.chroniclesDecorativeOnly = true;
    const coal = new THREE.Object3D();
    for (const [index, x] of [-0.42, 0, 0.42].entries()) {
      coal.position.set(x, 2.40 + (index % 2) * 0.14, 0.21);
      coal.updateMatrix();
      coals.setMatrixAt(index, coal.matrix);
    }
    coals.instanceMatrix.needsUpdate = true;
    bay.add(coals);
    for (const side of [-1, 1]) {
      mesh(bay, new THREE.BoxGeometry(0.22, 1.52, 0.30), mats.stone,
        'forge-workshop-stone-pier', [side * 0.87, 2.75, 0], !coarse);
      const brace = mesh(bay, new THREE.BoxGeometry(0.085, 1.20, 0.10), mats.steel,
        'forge-workshop-cross-brace', [side * 0.25, 2.75, 0.22]);
      brace.rotation.z = side * 0.45;
    }
    mesh(bay, new THREE.BoxGeometry(1.92, 0.23, 0.36), mats.stone,
      'forge-workshop-stone-lintel', [0, 3.59, 0], !coarse);
    mesh(bay, new THREE.BoxGeometry(0.18, 0.30, 0.11), mats.steel,
      'forge-workshop-iron-keystone', [0, 3.60, 0.23]);
    root.add(bay);
    // A projecting, soot-patinated iron hood makes the active smithing bay
    // recognisable from street level, unlike the armorer's stone display bays.
    // Its narrow span stays to the right of the engraved shop name; the high
    // overhang and supports are decorative and inside existing blocked cells.
    const hood = new THREE.Group();
    hood.name = 'forge-workshop-iron-hood';
    hood.userData.chroniclesDecorativeOnly = true;
    hood.position.set(width * 0.33 + 0.13, 4.08, facadeZ + 0.90);
    const hoodIron = material(0x514940, { roughness: 0.88, metalness: 0.24 });
    const hoodRoof = mesh(hood, new THREE.BoxGeometry(2.10, 0.16, 1.55),
      hoodIron, 'forge-workshop-hood-patinated-roof', [0, 0, 0], !coarse);
    hoodRoof.rotation.x = 0.22;
    mesh(hood, new THREE.BoxGeometry(2.12, 0.12, 0.13), mats.steel,
      'forge-workshop-hood-iron-drip-edge', [0, -0.19, 0.76], !coarse);
    for (const side of [-1, 1]) {
      const bracket = mesh(hood, new THREE.BoxGeometry(0.13, 0.13, 1.08),
        mats.steel, 'forge-workshop-hood-iron-bracket',
        [side * 0.87, -0.39, -0.28], !coarse);
      bracket.rotation.x = -0.50;
    }
    root.add(hood);
    // A tall, iron-capped masonry flue identifies the weaponsmith from the
    // street. Its base intersects the solid roof; no smoke particles/lights.
    const stack = new THREE.Group();
    stack.name = 'forge-roof-smokestack';
    stack.userData.chroniclesDecorativeOnly = true;
    stack.position.set(width * 0.31, height + 2.45, -depth * 0.25);
    mesh(stack, new THREE.BoxGeometry(1.36, 4.5, 1.24), mats.stone,
      'forge-smokestack-masonry', [0, 0, 0], !coarse);
    mesh(stack, new THREE.BoxGeometry(1.66, 0.30, 1.56), mats.steel,
      'forge-smokestack-iron-crown', [0, 2.30, 0]);
    // Two raised iron exhausts replace the former flat wooden vent. Their
    // paired silhouette identifies the working smithy above the roofline,
    // without smoke particles, extra lights or any change to the walk grid.
    // Instancing keeps the twin flues and caps to two draw calls.
    const flues = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.33, 0.36, 1.44, 8), mats.steel, 2);
    flues.name = 'forge-smokestack-twin-iron-flues';
    flues.userData.chroniclesDecorativeOnly = true;
    flues.castShadow = !coarse;
    const caps = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.45, 0.42, 0.18, 8), mats.steel, 2);
    caps.name = 'forge-smokestack-twin-rain-caps';
    caps.userData.chroniclesDecorativeOnly = true;
    caps.castShadow = !coarse;
    const outlet = new THREE.Object3D();
    for (const [index, x] of [-0.46, 0.46].entries()) {
      outlet.position.set(x, 3.13, 0);
      outlet.updateMatrix();
      flues.setMatrixAt(index, outlet.matrix);
      outlet.position.set(x, 3.92, 0);
      outlet.updateMatrix();
      caps.setMatrixAt(index, outlet.matrix);
    }
    flues.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    stack.add(flues, caps);
    root.add(stack);
  } else if (spec.emblem === 'shield' && !isWatch) {
    // The watchhouse is not an armorer: don't leave oversized steel display
    // plaques beneath its new iron-barred windows.
    for (const x of [-width * 0.35, width * 0.35]) mesh(root,
      new THREE.BoxGeometry(0.67, 1.48, 0.22), mats.steel,
      'armor-display', [x, 1.12, facadeZ + 0.24]);
  }
  if (isArmor) {
    // A continuous stone parapet with six spaced merlons connects the two
    // armorer towers. This fortified street silhouette replaces domestic
    // dormers/chimney without introducing new colliders or draw calls per tooth.
    const parapet = new THREE.Group();
    parapet.name = 'armor-ashlar-parapet';
    parapet.userData.chroniclesDecorativeOnly = true;
    parapet.position.z = facadeZ + 0.36;
    mesh(parapet, new THREE.BoxGeometry(width * 0.78, 0.32, 0.66), mats.stone,
      'armor-parapet-stone-course', [0, height + 0.43, 0], !coarse);
    const merlons = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.72, 0.68, 0.70), mats.stone, 6);
    merlons.name = 'armor-parapet-merlons';
    merlons.castShadow = !coarse;
    merlons.receiveShadow = true;
    const merlon = new THREE.Object3D();
    for (const [index, x] of [-2.65, -1.70, -0.75, 0.75, 1.70, 2.65].entries()) {
      merlon.position.set(x, height + 0.91, 0);
      merlon.updateMatrix();
      merlons.setMatrixAt(index, merlon.matrix);
    }
    merlons.instanceMatrix.needsUpdate = true;
    parapet.add(merlons);
    root.add(parapet);
    // Paired ashlar roof shoulders give the armorer a fortified silhouette,
    // distinct from the watchhouse's single battlement tower. They sit in
    // front of the roof gable, above the solid building footprint, and never
    // change doors, authored collisions or the existing heraldic crest.
    const shoulders = new THREE.Group();
    shoulders.name = 'armor-roof-shoulders';
    shoulders.userData.chroniclesDecorativeOnly = true;
    for (const side of [-1, 1]) {
      const x = side * width * 0.42;
      mesh(shoulders, new THREE.BoxGeometry(0.86, 2.10, 0.92), mats.stone,
        'armor-roof-shoulder-pier', [x, height + 1.55, facadeZ + 0.16], !coarse);
      mesh(shoulders, new THREE.BoxGeometry(1.10, 0.22, 1.12), mats.steel,
        'armor-roof-shoulder-cap', [x, height + 2.69, facadeZ + 0.16]);
      // A four-sided iron hip reads as a small fortified roof, not an
      // open chimney, from both the street and the narrow mobile camera.
      const hip = mesh(shoulders, new THREE.ConeGeometry(0.78, 0.88, 4), mats.steel,
        'armor-roof-shoulder-hip', [x, height + 3.18, facadeZ + 0.16], !coarse);
      hip.rotation.y = Math.PI / 4;
      mesh(shoulders, new THREE.BoxGeometry(0.12, 0.68, 0.08), mats.steel,
        'armor-roof-shoulder-slit', [x, height + 1.75, facadeZ + 0.66]);
    }
    root.add(shoulders);
    // A heavy, squared ashlar gateway distinguishes the armorer at eye level
    // from the guild's pointed arch and the forge's open brazier. All masonry
    // stays beside/above the existing door and never changes collision.
    const gate = new THREE.Group();
    gate.name = 'armor-stone-gateway';
    gate.userData.chroniclesDecorativeOnly = true;
    gate.position.z = facadeZ + 0.38;
    for (const side of [-1, 1]) {
      mesh(gate, new THREE.BoxGeometry(0.43, 3.34, 0.42), mats.stone,
        'armor-gateway-pier', [side * 1.24, 1.68, 0], !coarse);
      mesh(gate, new THREE.SphereGeometry(0.085, 8, 6), mats.steel,
        'armor-gateway-rivet', [side * 0.95, 3.32, 0.28]);
    }
    mesh(gate, new THREE.BoxGeometry(2.95, 0.36, 0.42), mats.stone,
      'armor-gateway-lintel', [0, 3.32, 0], !coarse);
    mesh(gate, new THREE.BoxGeometry(0.34, 0.27, 0.48), mats.steel,
      'armor-gateway-keystone', [0, 3.32, 0.24]);
    root.add(gate);
    // Armorer's raised heraldic shield breaks the gable silhouette.
    // The watchhouse shares a shield sign but NOT this merchant roof crest.
    const crest = new THREE.Group();
    crest.name = 'armor-roof-crest';
    crest.userData.chroniclesDecorativeOnly = true;
    // Mount the full shield above the ridge, not half-hidden by roof shingles.
    // A timber mast anchors it to the existing solid gable, including on touch.
    crest.position.set(0, height + 3.15, facadeZ + 0.20);
    mesh(crest, new THREE.BoxGeometry(0.24, 3.20, 0.22), mats.timber,
      'armor-crest-roof-mast', [0, -1.60, -0.15]);
    const shield = new THREE.Shape();
    shield.moveTo(-1.02, 0.78);
    shield.lineTo(1.02, 0.78);
    shield.lineTo(0.85, -0.40);
    shield.lineTo(0, -1.25);
    shield.lineTo(-0.85, -0.40);
    shield.closePath();
    mesh(crest, new THREE.ShapeGeometry(shield),
      material(0x9fb2bd, { metalness: 0.30, roughness: 0.42 }),
      'armor-crest-shield', [0, 0, 0]);
    mesh(crest, new THREE.BoxGeometry(0.16, 1.57, 0.10), mats.gold,
      'armor-crest-spine', [0, 0.05, 0.06]);
    mesh(crest, new THREE.BoxGeometry(1.47, 0.14, 0.10), mats.gold,
      'armor-crest-crossbar', [0, 0.28, 0.06]);
    root.add(crest);
  }
  if (spec.serviceStyle === 'watch') {
    // A crenellated stone lookout makes the guardhouse legible as military
    // architecture rather than a third shield merchant. All pieces rise from
    // the existing solid roof; authored collisions and entry cells are intact.
    // Place the lookout on the street-facing roof slope, not behind the ridge:
    // the stone shaft and arrow slit must be visible, not only its merlons.
    const tower = new THREE.Group();
    tower.name = 'watchhouse-battlement-tower';
    tower.userData.chroniclesDecorativeOnly = true;
    tower.position.set(-width * 0.26, height + 3.0, depth * 0.28);
    mesh(tower, new THREE.BoxGeometry(2.45, 5.20, 2.35), mats.stone,
      'watchhouse-tower-masonry', [0, 0, 0], !coarse);
    mesh(tower, new THREE.BoxGeometry(2.72, 0.22, 2.62), mats.steel,
      'watchhouse-parapet-rim', [0, 2.68, 0]);
    for (const x of [-0.97, 0, 0.97]) {
      mesh(tower, new THREE.BoxGeometry(0.53, 0.75, 0.46), mats.stone,
        'watchhouse-front-merlon', [x, 3.10, 1.16]);
    }
    for (const x of [-1.16, 1.16]) {
      mesh(tower, new THREE.BoxGeometry(0.45, 0.75, 0.53), mats.stone,
        'watchhouse-side-merlon', [x, 3.10, -0.86]);
    }
    mesh(tower, new THREE.BoxGeometry(0.15, 0.84, 0.08), mats.steel,
      'watchhouse-arrow-slit', [0, 1.60, 1.22]);
    root.add(tower);
  }
  // The approved Swordhaven town-square treatment: richer oak, shutters,
  // wrought-iron lantern cages and a distinct municipal stone entrance.
  // Decorative children have no colliders and do not affect NPC interactions.
  if (isTownHall || spec.emblem === 'home') {
    dressSwordhavenPremiumHouse(root, {
      civic: isTownHall, width, height, facadeZ, mats, coarse,
    });
  }
  // Homes carry no shop sign.
  if (spec.emblem === 'home') return { root, sign: null, interactive: false };
  const sign = new THREE.Group();
  sign.name = 'swordhaven-interaction-' + spec.id;
  sign.userData.chroniclesContentId = spec.id;
  sign.position.set(0, height - 0.33, facadeZ + 0.44);
  mesh(sign, new THREE.BoxGeometry(1.8, 1.4, 0.16), mats.timber, 'hanging-sign', [0, 0, 0]);
  mesh(sign, new THREE.BoxGeometry(1.66, 1.26, 0.08), mats.stone, 'sign-inset', [0, 0, 0.1]);
  emblem(sign, isWatch ? 'watch' : spec.emblem, mats);
  root.add(sign);
  // The emblem is heraldry; the shorter engraved plaque below it names the
  // service at real street distance. Both are attached to the same facade.
  // Residential buildings must never display a fictitious shop sign.
  if (spec.label || SHOP_EMBLEM_LABELS[spec.emblem]) {
    const name = swordhavenShopName(spec);
    const signTheme = isApothecary ? 'apothecary'
      : isStore ? 'store' : isWatch ? 'watch' : spec.emblem;
    const nameplate = new THREE.Group();
    nameplate.name = 'swordhaven-shop-nameplate';
    nameplate.userData.shopLabel = name;
    nameplate.position.set(0, 3.82, facadeZ + 0.52);
    mesh(nameplate, new THREE.BoxGeometry(3.36, 0.62, 0.14), mats.timber,
      'shop-nameplate-wood', [0, 0, 0]);
    mesh(nameplate, new THREE.BoxGeometry(3.14, 0.47, 0.08), mats.gold,
      'shop-nameplate-brass', [0, 0, 0.085]);
    mesh(nameplate, new THREE.PlaneGeometry(3.02, 0.40),
      new THREE.MeshBasicMaterial({ map: swordhavenShopLabelTexture(name, signTheme), toneMapped: false }),
      'shop-nameplate-lettering', [0, 0, 0.132]);
    root.add(nameplate);
  }
  return { root, sign, interactive: contentIds.has(spec.id) };
}

export function buildSwordhavenTree(root, x, z, mats, coarse, index) {
  const treeRoot = new THREE.Group();
  treeRoot.name = 'swordhaven-tree-' + index;
  treeRoot.position.set(x, 0, z);
  mesh(treeRoot, new THREE.CylinderGeometry(0.20, 0.32, 2.8, 8), mats.timber,
    'tree-trunk', [0, 1.4, 0], !coarse);
  const canopy = material(index % 3 === 0 ? 0x648a48 : index % 3 === 1 ? 0x477849 : 0x7a9c52);
  const geometry = new THREE.IcosahedronGeometry(1.12, coarse ? 0 : 1);
  const foliage = new THREE.InstancedMesh(geometry, canopy, coarse ? 4 : 6);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < foliage.count; i += 1) {
    const angle = i * Math.PI * 2 / foliage.count + index * 0.27;
    dummy.position.set(Math.cos(angle) * 0.85, 3.48 + (i % 3) * 0.25, Math.sin(angle) * 0.8);
    dummy.scale.set(1.14 + (i % 2) * 0.15, 1.12, 1.03 + (i % 3) * 0.08);
    dummy.updateMatrix();
    foliage.setMatrixAt(i, dummy.matrix);
  }
  foliage.name = 'leaf-canopy-cluster';
  foliage.castShadow = !coarse;
  treeRoot.add(foliage);
  root.add(treeRoot);
}

function laySwordhavenCobblestones(root, mats, coarse, width, height) {
  // Deterministic paving: one instanced draw call rather than hundreds of meshes.
  // Thin pavers are visual only; the manifest grid remains collision authority.
  const positions = [];
  const span = Math.min(height * CELL * 0.38, 30);
  const cross = Math.min(width * CELL * 0.35, 26);
  for (let z = -span; z <= span; z += coarse ? 1.16 : 0.87) {
    for (let x = -3.03; x <= 3.03; x += coarse ? 1.22 : 0.82) {
      positions.push([x + (Math.round(z) % 2 ? 0.18 : 0), z]);
    }
  }
  for (let x = -cross; x <= cross; x += coarse ? 1.16 : 0.88) {
    for (let z = -2.85; z <= 2.85; z += coarse ? 1.22 : 0.84) {
      if (Math.abs(x) > 3.65 || Math.abs(z) > 3.65) positions.push([x, z]);
    }
  }
  const paver = new THREE.InstancedMesh(
    new THREE.BoxGeometry(coarse ? 1.05 : 0.76, 0.065, coarse ? 1.0 : 0.75),
    mats.paving, positions.length,
  );
  paver.name = 'swordhaven-street-cobblestones';
  paver.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const tone = new THREE.Color();
  positions.forEach(([x, z], i) => {
    const seed = ((i * 19 + Math.round(x * 7) + Math.round(z * 13)) >>> 0) % 9;
    dummy.position.set(x, 0.055 + (seed % 3) * 0.002, z);
    dummy.rotation.y = (seed % 3 - 1) * 0.025;
    dummy.updateMatrix();
    paver.setMatrixAt(i, dummy.matrix);
    tone.setHex([0xaaa293, 0x9b9284, 0xb1a99a, 0x8e887d, 0xbab09a][seed % 5]);
    paver.setColorAt(i, tone);
  });
  paver.instanceMatrix.needsUpdate = true;
  if (paver.instanceColor) paver.instanceColor.needsUpdate = true;
  root.add(paver);
}


function dressSwordhavenRoadsides(root, mats, coarse, width, height, center) {
  // Road shoulders are visual trim, not new blockers. A single instanced
  // cobble mesh is substantially cheaper than individual edge stones.
  const shoulders = [];
  const mainSpan = Math.min(height * CELL * 0.38, 30);
  const crossSpan = Math.min(width * CELL * 0.35, 26);
  const step = coarse ? 0.96 : 0.82;
  for (let z = -mainSpan; z <= mainSpan; z += step) {
    if (Math.abs(z) < 10.8) continue; // The circular plaza owns this area.
    for (const side of [-1, 1]) shoulders.push([side * 3.45, z]);
  }
  for (let x = -crossSpan; x <= crossSpan; x += step) {
    if (Math.abs(x) < 11.2) continue;
    for (const side of [-1, 1]) shoulders.push([x, side * 3.43]);
  }
  const edges = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.25, 0.065, 0.72), mats.paving, shoulders.length,
  );
  edges.name = 'swordhaven-roadside-stone-edging';
  edges.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  shoulders.forEach(([x, z], i) => {
    dummy.position.set(x, 0.067, z);
    dummy.rotation.y = ((i % 7) - 3) * 0.018;
    dummy.scale.set(0.94 + (i % 5) * 0.02, 1, 0.92 + (i % 3) * 0.025);
    dummy.updateMatrix();
    edges.setMatrixAt(i, dummy.matrix);
    color.setHex([0x8b867c, 0xa29b8b, 0xc0b7a1, 0x9c947e][i % 4]);
    edges.setColorAt(i, color);
  });
  edges.instanceMatrix.needsUpdate = true;
  if (edges.instanceColor) edges.instanceColor.needsUpdate = true;
  root.add(edges);

  // Six slim, wind-bent leaves per tuft. Narrow silhouettes avoid the large
  // triangular spikes of the initial pass, while staying one draw call.
  const bladeVertices = [];
  for (let blade = 0; blade < 6; blade += 1) {
    const angle = blade * Math.PI / 3;
    const ux = Math.cos(angle);
    const uz = Math.sin(angle);
    const offset = blade % 2 === 0 ? 0.015 : 0.044;
    const height = 0.12 + (blade % 3) * 0.016;
    const spread = 0.024;
    bladeVertices.push(
      ux * offset - uz * spread, 0, uz * offset + ux * spread,
      ux * (offset + 0.08), height, uz * (offset + 0.08),
      ux * offset + uz * spread, 0, uz * offset - ux * spread,
    );
  }
  const tuftGeometry = new THREE.BufferGeometry();
  tuftGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bladeVertices, 3));
  tuftGeometry.computeVertexNormals();
  const candidateCount = coarse ? 560 : 860;
  const positions = [];
  let seed = 0x51a7b3d;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Loose clusters instead of solitary evenly scattered triangles. Each patch
  // is repeatable and the original street/building exclusion is still applied.
  let patchX = 0;
  let patchZ = 0;
  for (let i = 0; i < candidateCount; i += 1) {
    if (i % 5 === 0) {
      patchX = (random() - 0.5) * (width * CELL - 7);
      patchZ = (random() - 0.5) * (height * CELL - 7);
    }
    const x = patchX + (random() - 0.5) * 3.1;
    const z = patchZ + (random() - 0.5) * 3.1;
    if (Math.abs(x) >= width * CELL / 2 - 1.5 || Math.abs(z) >= height * CELL / 2 - 1.5) continue;
    if (Math.abs(x) < 5 || Math.abs(z) < 5 || Math.hypot(x, z) < 11.6) continue;
    // Keep plants away from walls, shop foundations and obstructing trunks.
    if (SWORDHAVEN_BUILDINGS.some(spec => {
      const [bx, bz] = worldPoint(spec.x, spec.y, center);
      return Math.abs(x - bx) < 5.2 && Math.abs(z - bz) < 5.2;
    })) continue;
    positions.push([x, z, random(), random()]);
  }
  const meadow = new THREE.InstancedMesh(
    tuftGeometry, material(0xffffff, { side: THREE.DoubleSide, roughness: 1 }),
    positions.length,
  );
  meadow.name = 'swordhaven-low-meadow-tufts';
  meadow.receiveShadow = false;
  positions.forEach(([x, z, rotation, growth], i) => {
    dummy.position.set(x, -0.048, z);
    dummy.rotation.set(0, rotation * Math.PI * 2, 0);
    dummy.scale.setScalar(0.66 + growth * 0.34);
    dummy.updateMatrix();
    meadow.setMatrixAt(i, dummy.matrix);
    color.setHex([0x799153, 0x869a65, 0x96a273, 0x708957][i % 4]);
    meadow.setColorAt(i, color);
  });
  meadow.instanceMatrix.needsUpdate = true;
  if (meadow.instanceColor) meadow.instanceColor.needsUpdate = true;
  root.add(meadow);
}

export function buildSwordhavenFountain(mats) {
  const fountain = new THREE.Group();
  fountain.name = 'swordhaven-fountain';
  // The full basin must fit the single blocked 4×4 m fountain cell.
  mesh(fountain, new THREE.CylinderGeometry(1.72, 1.88, 0.7, 16),
    mats.stone, 'fountain-basin', [0, 0.34, 0]);
  mesh(fountain, new THREE.CylinderGeometry(1.47, 1.47, 0.03, 16),
    material(0x64bfd0, { metalness: 0.12, roughness: 0.22 }), 'fountain-water', [0, 0.71, 0]);
  const rim = mesh(fountain, new THREE.TorusGeometry(1.74, 0.10, 6, 24),
    mats.stone, 'fountain-carved-rim', [0, 0.75, 0]);
  rim.rotation.x = Math.PI / 2;
  mesh(fountain, new THREE.CylinderGeometry(0.31, 0.44, 1.9, 10),
    mats.stone, 'fountain-pedestal', [0, 1.25, 0]);
  return fountain;
}

// Shared village palette: the legacy square and the First Book town use the
// same dressed stone, stucco, timber and roof textures.
export function createSwordhavenMaterials() {
  return {
    grass: material(0xffffff, { map: swordhavenGrassTexture(), roughness: 0.98 }), cobble: material(0x9d9588),
    stone: material(0xafa597, {
      map: swordhavenSurfaceTexture('masonry'),
      normalMap: swordhavenSurfaceNormalTexture('masonry'),
      normalScale: new THREE.Vector2(0.56, 0.56), roughness: 0.95,
    }),
    plaster: material(0xe0caac, {
      map: swordhavenSurfaceTexture('stucco'),
      normalMap: swordhavenSurfaceNormalTexture('stucco'),
      normalScale: new THREE.Vector2(0.50, 0.50), roughness: 0.97,
    }),
    timber: material(0x694b34, { map: swordhavenSurfaceTexture('timber'), roughness: 0.85 }),
    gold: material(0xd6ae67, { metalness: 0.48 }),
    window: material(0xf8b96e, { emissive: 0x925124, emissiveIntensity: 0.45 }),
    leaves: material(0x64864c), flowers: material(0xc7756c),
    // White bases accept per-instance foliage/petal variation without
    // multiplying tones by an already green/red material tint.
    planterLeaves: material(0xffffff, { side: THREE.DoubleSide, roughness: 0.96 }),
    planterPetals: material(0xffffff, { side: THREE.DoubleSide, roughness: 0.92 }),
    planterCenters: material(0xeab75e, { roughness: 0.88 }),
    planterStems: material(0x426b3c, { roughness: 0.98 }),
    arcane: material(0x9576db, { emissive: 0x403b99, emissiveIntensity: 1.1 }),
    embers: material(0xffa754, { emissive: 0xeb6a20, emissiveIntensity: 1.2 }),
    steel: material(0x80909a, { metalness: 0.6, roughness: 0.32 }),
    paving: material(0xffffff, {
      map: swordhavenSurfaceTexture('cobble'),
      normalMap: swordhavenSurfaceNormalTexture('cobble'),
      normalScale: new THREE.Vector2(0.48, 0.48), roughness: 0.96,
    }),
    roofSeams: material(0x413a36, { roughness: 0.92 }),
  };
}

export function addSwordhavenClouds(root, coarsePointer = false) {
  // Cloud banks are genuine low-detail 3D volume silhouettes, not a flat sky texture.
  // Basic materials keep the clouds bright without costly per-cloud lighting.
  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: 0xf6f8f4, transparent: true, opacity: 0.87, depthWrite: false,
  });
  for (let cluster = 0; cluster < (coarsePointer ? 3 : 5); cluster += 1) {
    const cloud = new THREE.Group();
    cloud.name = 'swordhaven-cloud-' + cluster;
    const direction = cluster % 2 === 0 ? -1 : 1;
    cloud.position.set(direction * (16 + cluster * 2.7), 16 + (cluster % 3) * 2, -38 + cluster * 3);
    for (let puff = 0; puff < 3; puff += 1) {
      mesh(cloud, new THREE.SphereGeometry(2.35 - puff * 0.26, 9, 6),
        cloudMaterial, 'cloud-puff', [(puff - 1) * 2.0, puff % 2 ? 0.65 : 0, 0]);
    }
    root.add(cloud);
  }
}

export function buildSwordhavenScene(scene, { scenePlan = {}, coarsePointer = false } = {}) {
  const center = scenePlan.center || { x: 9, y: 9 };
  const width = Math.max(19, Number(scenePlan.width) || 19);
  const height = Math.max(19, Number(scenePlan.height) || 19);
  scene.background = new THREE.Color(0xb8dce9); // Fallback if WebGL cannot render the dome.
  scene.fog = new THREE.Fog(0xb8dce9, 48, Math.max(width, height) * CELL * 0.98);
  const sunDirection = new THREE.Vector3(-28, 26, -90).normalize();
  scene.add(createSwordhavenSkyDome(sunDirection));
  const skylight = new THREE.HemisphereLight(0xd7ebff, 0x688258, 1.45);
  scene.add(skylight);
  const sun = new THREE.DirectionalLight(0xffedd1, coarsePointer ? 1.2 : 1.65);
  sun.name = 'swordhaven-sun';
  sun.position.copy(sunDirection).multiplyScalar(98);
  sun.castShadow = !coarsePointer;
  if (!coarsePointer) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
    sun.shadow.bias = -0.001;
  }
  scene.add(sun);

  const root = new THREE.Group();
  root.name = 'chronicles-swordhaven-town';
  scene.add(root);
  const mats = createSwordhavenMaterials();
  mesh(root, new THREE.BoxGeometry(width * CELL, 0.3, height * CELL),
    mats.grass, 'grass-terrain', [0, -0.2, 0]);
  mesh(root, new THREE.BoxGeometry(7.1, 0.08, height * CELL * 0.8),
    mats.cobble, 'main-street', [0, -0.03, 0]);
  mesh(root, new THREE.BoxGeometry(width * CELL * 0.75, 0.08, 6.9),
    mats.cobble, 'market-cross-street', [0, -0.028, 0]);
  mesh(root, new THREE.CylinderGeometry(10.2, 10.2, 0.11, 24),
    mats.cobble, 'circular-town-square', [0, -0.015, 0]);
  laySwordhavenCobblestones(root, mats, coarsePointer, width, height);
  dressSwordhavenRoadsides(root, mats, coarsePointer, width, height, center);
  root.add(buildSwordhavenFountain(mats));

  addSwordhavenClouds(root, coarsePointer);

  // Low walls define the silhouette but never replace grid-authoritative collision.
  for (const sign of [-1, 1]) {
    mesh(root, new THREE.BoxGeometry(0.6, 1.55, 24), mats.stone,
      'perimeter-stone-wall-' + sign, [sign * (width * CELL / 2 - 1.4), 0.78, 0]);
    mesh(root, new THREE.BoxGeometry(19, 1.0, 0.6), mats.stone,
      'garden-boundary-' + sign, [sign * 24, 0.5, -height * CELL / 2 + 5.0]);
  }
  // Flowers live in each shop's authored footprint, never in walkable streets.

  const authoredContent = new Set((scenePlan.content || []).filter(e => e.visible !== false).map(e => e.id));
  const contentProps = [];
  SWORDHAVEN_BUILDINGS.forEach(spec => {
    const result = buildSwordhavenHouse(spec, mats, coarsePointer, authoredContent, center);
    root.add(result.root);
    if (result.interactive) contentProps.push({
      id: spec.id, kind: 'lore', root: result.sign, phase: 0,
    });
  });
  const locations = [[1,1],[17,1],[1,17],[17,17],[3,9],[15,9],[7,16],[12,16]];
  locations.forEach(([x, y], i) => {
    const [wx, wz] = worldPoint(x, y, center);
    buildSwordhavenTree(root, wx, wz, mats, coarsePointer, i);
  });
  // An authored gate exit participates in the same raycast and content rules as dungeon exits.
  (scenePlan.content || []).filter(entry => entry.kind === 'exit' && entry.position).forEach(entry => {
    const [x, z] = worldPoint(entry.position.x, entry.position.y, center);
    const gate = new THREE.Group();
    gate.name = 'swordhaven-exit-' + entry.id;
    gate.userData.chroniclesContentId = entry.id;
    gate.position.set(x, 0, z);
    mesh(gate, new THREE.BoxGeometry(0.5, 5.1, 0.8), mats.stone, 'gate-left-post', [-1.8, 2.55, 0]);
    mesh(gate, new THREE.BoxGeometry(0.5, 5.1, 0.8), mats.stone, 'gate-right-post', [1.8, 2.55, 0]);
    mesh(gate, new THREE.BoxGeometry(4.2, 0.65, 1), mats.timber, 'gate-lintel', [0, 5.15, 0]);
    root.add(gate);
    contentProps.push({ id: entry.id, kind: 'exit', root: gate, phase: 0 });
  });

  return {
    enemies: {}, enemyDefinitions: [],
    spectralChapel: new THREE.Group(),
    sigilMaterial: material(0x8c785a, { emissive: 0x241300 }),
    gateMaterial: material(0x766350, { emissive: 0x120700 }),
    gateRunes: [], torches: [], contentProps, sceneCenter: center, materialArt: null,
  };
}
