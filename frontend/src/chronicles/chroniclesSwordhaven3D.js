import * as THREE from 'three';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';
import { chroniclesTownSurfacePixels } from './chroniclesTownSurfacePixels.js';
import { dressSwordhavenWindowBoxes } from './chroniclesSwordhavenFoliage.js';

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

const SURFACE_REPEAT = Object.freeze({ stucco: 2, masonry: 3, roof: 3, timber: 3, cobble: 1 });
const surfaceCache = new Map();
const surfaceNormalCache = new Map();

// Cached tangent-space relief for masonry, cobbles, roof and limewash.
// Axes/repeat match the albedo; detail needs no extra geometry.
export function swordhavenSurfaceNormalTexture(kind) {
  if (kind !== 'masonry' && kind !== 'cobble' && kind !== 'roof' && kind !== 'stucco') {
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
function swordhavenShopLabelTexture(label) {
  if (SHOP_SIGN_TEXTURES.has(label)) return SHOP_SIGN_TEXTURES.get(label);
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
    paint(x, y, edge ? [165, 116, 55] : [43, 30, 20]);
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
            startY + (6 - row) * scale + dy, [247, 219, 164]);
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
  SHOP_SIGN_TEXTURES.set(label, texture);
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
    mesh(group, new THREE.ShapeGeometry(shape), gold, 'shield-emblem', [0, 0, 0.1]);
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
  const width = isTemple ? 9.0 : 8.1;
  const depth = isTavern ? 8.2 : 7.1;
  const height = isTemple ? 6.3 : isTavern ? 5.7 : 5.25;
  const facadeZ = depth / 2 + 0.10;
  const roof = material(spec.roof, {
    map: swordhavenSurfaceTexture('roof'),
    normalMap: swordhavenSurfaceNormalTexture('roof'),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.95,
  });
  const roofRidgeY = height + 1.8;
  // The guild's slate-violet masonry is a real architectural finish, not a
  // recoloured sign. Reuse the town's cached stone maps on both wall and gable.
  const guildStone = isMagic ? material(0x9d8aa9, {
    map: swordhavenSurfaceTexture('masonry'),
    normalMap: swordhavenSurfaceNormalTexture('masonry'),
    normalScale: new THREE.Vector2(0.42, 0.42), roughness: 0.94,
  }) : null;
  // The inn is a warm, brick-built public house rather than another limewashed
  // merchant shop. Its timber frame, door and windows remain in place; the
  // masonry relief also continues across both roof gables without new assets.
  const tavernBrick = isTavern ? material(0xb98b70, {
    map: swordhavenSurfaceTexture('masonry'),
    normalMap: swordhavenSurfaceNormalTexture('masonry'),
    normalScale: new THREE.Vector2(0.42, 0.42), roughness: 0.97,
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
  const wallMaterial = guildStone || tavernBrick || apothecaryStone || storeOchre
    || (isTemple || isArmor ? mats.stone : mats.plaster);
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
  // Stone-fronted armorer, guild and botica have no merchant timber lattice.
  // Doors, shop signs, windows and their collision cells remain untouched.
  if (!isArmor && !isMagic && !isApothecary) {
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
  for (const x of [-width * 0.33, width * 0.33]) {
    const front = facadeZ + 0.16;
    mesh(root, new THREE.BoxGeometry(1.37, 1.23, 0.11), mats.window,
      'warm-glass-window', [x, 2.75, front]);
    for (const dx of [-0.70, 0.70]) mesh(root, new THREE.BoxGeometry(0.10, 1.38, 0.18),
      mats.timber, 'window-side-frame', [x + dx, 2.75, front + 0.05]);
    for (const dy of [-0.62, 0, 0.62]) mesh(root, new THREE.BoxGeometry(1.5, 0.10, 0.18),
      mats.timber, 'window-rail', [x, 2.75 + dy, front + 0.05]);
    mesh(root, new THREE.BoxGeometry(1.62, 0.15, 0.43), mats.stone,
      'stone-window-sill', [x, 2.04, front + 0.11]);
    mesh(root, new THREE.BoxGeometry(1.7, 0.36, 0.65), mats.stone,
      'flower-window-box', [x, 1.83, front + 0.34]);
  }
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

  // Real shaped leaves, petals and hanging stems, four instanced draw calls
  // per storefront. Far fewer instances on coarse/touch surfaces.
  dressSwordhavenWindowBoxes(root, {
    windowXs: [-width * 0.33, width * 0.33], facadeZ, coarse, mats,
  });
  // The former blank side walls now have inset windows and deep stone sills.
  // All facade details remain within the foundation's authored footprint.
  for (const side of [-1, 1]) {
    for (const z of [-depth * 0.22, depth * 0.22]) {
      const edge = side * (width / 2 + 0.105);
      mesh(root, new THREE.BoxGeometry(0.13, 1.63, 1.77), mats.stone,
        'side-window-stone-reveal', [edge, 2.79, z]);
      mesh(root, new THREE.BoxGeometry(0.16, 1.27, 1.39), mats.window,
        'side-window-amber-glass', [edge + side * 0.09, 2.84, z]);
      mesh(root, new THREE.BoxGeometry(0.26, 0.16, 1.88), mats.stone,
        'side-window-carved-sill', [edge + side * 0.11, 1.95, z]);
      mesh(root, new THREE.BoxGeometry(0.15, 0.10, 1.4), mats.timber,
        'side-window-crossbar', [edge + side * 0.17, 2.85, z]);
    }
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
    root.add(loft);
  } else if (isForge) {
    // The smithy has a raised, louvered smoke lantern instead of domestic
    // dormers. Its asymmetric oak-and-iron roofline is visible above the
    // front gable and stays entirely inside the authored solid footprint.
    const vent = new THREE.Group();
    vent.name = 'forge-roof-smoke-lantern';
    vent.userData.chroniclesDecorativeOnly = true;
    vent.position.set(-width * 0.20, roofRidgeY + 0.06, facadeZ + 0.32);
    mesh(vent, new THREE.BoxGeometry(3.00, 1.30, 0.74),
      material(0x29251e, { roughness: 1 }),
      'forge-lantern-dark-opening', [0, 0.05, 0], !coarse);
    for (const side of [-1, 1]) {
      mesh(vent, new THREE.BoxGeometry(0.19, 1.53, 0.90), mats.timber,
        'forge-lantern-oak-post', [side * 1.54, 0.06, 0], !coarse);
    }
    for (const y of [-0.34, 0.04, 0.42]) {
      const slat = mesh(vent, new THREE.BoxGeometry(2.94, 0.13, 0.16), mats.steel,
        'forge-lantern-iron-louver', [0, y, 0.48]);
      slat.rotation.x = -0.18;
    }
    const cap = mesh(vent, new THREE.BoxGeometry(3.45, 0.19, 1.18), roof,
      'forge-lantern-pitched-cap', [0, 0.87, 0], !coarse);
    cap.rotation.x = -0.17;
    root.add(vent);
  } else {
    // Other houses retain their ordinary dormers, one on touch and two on desktop.
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
  // The forge gets its own industrial stack below; other houses keep
  // the small domestic chimney. Neither alters the authored collision grid.
  if (!isForge && !isTavern) {
    mesh(root, new THREE.BoxGeometry(1.05, 2.3, 0.95), mats.stone,
      'stone-chimney', [width * 0.31, height + 1.04, -depth * 0.25], !coarse);
    mesh(root, new THREE.BoxGeometry(1.38, 0.22, 1.32), mats.stone,
      'chimney-cap', [width * 0.31, height + 2.24, -depth * 0.25]);
  }

  // Each hero building has a distinctive readable silhouette.
  if (isTemple) {
    mesh(root, new THREE.CylinderGeometry(1.19, 1.38, 3.2, coarse ? 12 : 20), mats.stone,
      'temple-bell-tower', [0, height + 2.5, -depth * 0.11], !coarse);
    mesh(root, new THREE.ConeGeometry(1.48, 2.8, coarse ? 12 : 20), roof,
      'temple-spire', [0, height + 5.5, -depth * 0.11], !coarse);
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
    const herbalGlass = material(0x79b39b, {
      emissive: 0x12372a, emissiveIntensity: 0.18, metalness: 0.12, roughness: 0.34,
    });
    const herbarium = new THREE.Group();
    herbarium.name = 'apothecary-roof-herbarium';
    herbarium.position.set(0, height + 1.72, -depth * 0.12);
    mesh(herbarium, new THREE.BoxGeometry(2.95, 1.35, 2.22), mats.timber,
      'herbarium-timber-frame', [0, 0.68, 0]);
    mesh(herbarium, new THREE.BoxGeometry(2.65, 1.20, 2.29), herbalGlass,
      'herbarium-green-glazing', [0, 0.68, 0.025]);
    for (const side of [-1, 1]) {
      const pane = mesh(herbarium, new THREE.BoxGeometry(1.72, 0.14, 2.55),
        herbalGlass, 'herbarium-glazed-roof', [side * 0.72, 1.62, 0]);
      pane.rotation.z = -side * 0.50;
    }
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
    mesh(root, new THREE.CylinderGeometry(1.11, 1.20, 3.35, coarse ? 12 : 20), mats.plaster,
      'magic-shop-turret', [-width * 0.40, height + 1.62, -depth * 0.28], !coarse);
    mesh(root, new THREE.ConeGeometry(1.52, 3.5, coarse ? 12 : 20), roof,
      'magic-turret-roof', [-width * 0.40, height + 5.02, -depth * 0.28], !coarse);
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
    mesh(root, new THREE.BoxGeometry(5.1, 0.21, 2.05), roof,
      'tavern-porch-awning', [0, 3.35, facadeZ + 1.07], !coarse);
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
      map: swordhavenSurfaceTexture('masonry'),
      normalMap: swordhavenSurfaceNormalTexture('masonry'),
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
    const canvas = material(0xd3b06e, { roughness: 1, metalness: 0 });
    const stripe = material(0x855b3e, { roughness: 1, metalness: 0 });
    const cloth = mesh(awning, new THREE.BoxGeometry(6.20, 0.10, 1.48), canvas,
      'store-awning-cloth', [0, 0, 0]);
    cloth.rotation.x = 0.16;
    for (const x of [-2.45, -1.47, -0.49, 0.49, 1.47, 2.45]) {
      const band = mesh(awning, new THREE.BoxGeometry(0.48, 0.018, 1.46), stripe,
        'store-awning-stripe', [x, 0.062, 0]);
      band.rotation.x = 0.16;
    }
    mesh(awning, new THREE.BoxGeometry(6.42, 0.14, 0.16), mats.timber,
      'store-awning-front-rail', [0, -0.14, 0.77]);
    for (const x of [-2.85, 2.85]) {
      const rib = mesh(awning, new THREE.BoxGeometry(0.13, 0.13, 1.46), mats.timber,
        'store-awning-side-rib', [x, 0, 0]);
      rib.rotation.x = 0.16;
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
    mesh(stack, new THREE.BoxGeometry(0.80, 0.05, 0.70), mats.timber,
      'forge-smokestack-vent', [0, 2.48, 0]);
    root.add(stack);
  } else if (spec.emblem === 'shield') {
    for (const x of [-width * 0.35, width * 0.35]) mesh(root,
      new THREE.BoxGeometry(0.67, 1.48, 0.22), mats.steel,
      'armor-display', [x, 1.12, facadeZ + 0.24]);
  }
  if (isArmor) {
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
  // Homes carry no shop sign.
  if (spec.emblem === 'home') return { root, sign: null, interactive: false };
  const sign = new THREE.Group();
  sign.name = 'swordhaven-interaction-' + spec.id;
  sign.userData.chroniclesContentId = spec.id;
  sign.position.set(0, height - 0.33, facadeZ + 0.44);
  mesh(sign, new THREE.BoxGeometry(1.8, 1.4, 0.16), mats.timber, 'hanging-sign', [0, 0, 0]);
  mesh(sign, new THREE.BoxGeometry(1.66, 1.26, 0.08), mats.stone, 'sign-inset', [0, 0, 0.1]);
  emblem(sign, spec.emblem, mats);
  root.add(sign);
  // The emblem is heraldry; the shorter engraved plaque below it names the
  // service at real street distance. Both are attached to the same facade.
  // Residential buildings must never display a fictitious shop sign.
  if (spec.label || SHOP_EMBLEM_LABELS[spec.emblem]) {
    const name = swordhavenShopName(spec);
    const nameplate = new THREE.Group();
    nameplate.name = 'swordhaven-shop-nameplate';
    nameplate.userData.shopLabel = name;
    nameplate.position.set(0, 3.82, facadeZ + 0.52);
    mesh(nameplate, new THREE.BoxGeometry(3.36, 0.62, 0.14), mats.timber,
      'shop-nameplate-wood', [0, 0, 0]);
    mesh(nameplate, new THREE.BoxGeometry(3.14, 0.47, 0.08), mats.gold,
      'shop-nameplate-brass', [0, 0, 0.085]);
    mesh(nameplate, new THREE.PlaneGeometry(3.02, 0.40),
      new THREE.MeshBasicMaterial({ map: swordhavenShopLabelTexture(name), toneMapped: false }),
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
