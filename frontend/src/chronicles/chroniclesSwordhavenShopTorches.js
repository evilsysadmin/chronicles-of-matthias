import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One decorative assembly per shop plaque, not a light per torch. Both
// shelters project beyond their flame and drain rain toward the street.
// Geometry is merged by material to keep mobile draw calls low.
const TORCH_X = [-1.92, 1.92];

const box = (width, height, depth, x, y, z, pitch = 0) => {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  if (pitch) geometry.rotateX(pitch);
  geometry.translate(x, y, z);
  return geometry;
};

const cylinder = (top, bottom, height, x, y, z, sides = 8) => {
  const geometry = new THREE.CylinderGeometry(top, bottom, height, sides);
  geometry.translate(x, y, z);
  return geometry;
};

function merged(parts) {
  const geometry = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error('Unable to merge Swordhaven shop torch geometry');
  return geometry;
}

function decorativeMesh(geometry, material, name) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.userData.chroniclesDecorativeOnly = true;
  object.castShadow = false;
  object.receiveShadow = false;
  return object;
}

// Hand-shaped tongues with unequal shoulders and a wind-bent tip. The
// secondary cream-coloured silhouette exposes an irregular orange edge.
// Unlike ConeGeometry, they read as flames when seen head-on in MM3.
function flameShape(inner, side) {
  const lean = side < 0 ? -0.035 : 0.045;
  const shape = new THREE.Shape();
  if (inner) {
    shape.moveTo(-0.057, 0);
    shape.bezierCurveTo(-0.10, 0.09, -0.035, 0.14, -0.032, 0.22);
    shape.quadraticCurveTo(0.02 + lean, 0.20, lean + 0.014, 0.30);
    shape.bezierCurveTo(0.095, 0.19, 0.09, 0.09, 0.053, 0);
  } else {
    shape.moveTo(-0.115, 0);
    shape.bezierCurveTo(-0.205, 0.14, -0.135, 0.23, -0.10, 0.34);
    shape.quadraticCurveTo(-0.078, 0.22, -0.022, 0.19);
    shape.bezierCurveTo(-0.085, 0.33, lean - 0.048, 0.40, lean, 0.47);
    shape.bezierCurveTo(lean + 0.09, 0.35, 0.105, 0.24, 0.105, 0.17);
    shape.quadraticCurveTo(0.18, 0.23, 0.195, 0.30);
    shape.bezierCurveTo(0.205, 0.13, 0.16, 0.06, 0.11, 0);
  }
  shape.closePath();
  return shape;
}

function fireGeometry(inner) {
  return merged(TORCH_X.map((x, index) => {
    const geometry = new THREE.ShapeGeometry(flameShape(inner, index === 0 ? -1 : 1), 6);
    geometry.translate(x, 0.205, inner ? 0.565 : 0.535);
    return geometry;
  }));
}

function makeWarmWashTexture() {
  const size = 48;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5 - size / 2) / (size / 2);
      const ny = (y + 0.5 - size / 2) / (size / 2);
      const radius = Math.sqrt(nx * nx + ny * ny);
      const edge = Math.max(0, 1 - radius);
      const offset = (y * size + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 198;
      pixels[offset + 2] = 114;
      pixels[offset + 3] = Math.round(190 * edge * edge);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = 'shop-sign-torch-warm-stone-wash';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function dressSwordhavenShopTorches(nameplate) {
  const hoods = new THREE.Group();
  hoods.name = 'shop-sign-torch-hoods';
  hoods.userData.chroniclesDecorativeOnly = true;
  const sconces = new THREE.Group();
  sconces.name = 'shop-sign-torch-sconces';
  sconces.userData.chroniclesDecorativeOnly = true;
  const flames = new THREE.Group();
  flames.name = 'shop-sign-torch-flames';
  flames.userData.chroniclesDecorativeOnly = true;
  flames.visible = false;

  const roofParts = [];
  const ironParts = [];
  for (const x of TORCH_X) {
    // Three roof planks form a short sloped awning, with a back batten and
    // two diagonal supports. The forward eave shelters the entire fire.
    for (const offset of [-0.31, 0, 0.31]) {
      roofParts.push(box(0.30, 0.075, 0.91, x + offset, 0.795, 0.48, 0.24));
    }
    roofParts.push(box(1.02, 0.12, 0.13, x, 0.82, 0.08));
    for (const offset of [-0.40, 0.40]) {
      roofParts.push(box(0.085, 0.09, 0.61, x + offset, 0.60, 0.34, 0.46));
      ironParts.push(box(0.042, 0.026, 0.90, x + offset, 0.842, 0.48, 0.24));
    }
    // Riveted wrought-iron backplate, projecting arm and soot-dark brazier.
    ironParts.push(box(0.19, 0.31, 0.07, x, -0.015, 0.055));
    ironParts.push(box(0.105, 0.095, 0.53, x, -0.035, 0.30));
    ironParts.push(box(0.055, 0.24, 0.055, x, 0.075, 0.48));
    ironParts.push(cylinder(0.155, 0.105, 0.105, x, 0.175, 0.49));
    for (const offset of [-0.105, 0, 0.105]) {
      ironParts.push(box(0.025, 0.14, 0.03, x + offset, 0.245, 0.592));
    }
    for (const offset of [-0.055, 0.055]) {
      ironParts.push(cylinder(0.033, 0.033, 0.017, x + offset, -0.04, 0.097, 6));
    }
  }

  const wood = new THREE.MeshStandardMaterial({
    color: 0x59412e, roughness: 0.96, metalness: 0.01,
  });
  const iron = new THREE.MeshStandardMaterial({
    color: 0x322f2d, roughness: 0.77, metalness: 0.42,
  });
  hoods.add(decorativeMesh(merged(roofParts), wood, 'shop-sign-torch-shelter-wood'));
  sconces.add(decorativeMesh(merged(ironParts), iron, 'shop-sign-torch-wrought-iron'));

  const outerFire = new THREE.MeshBasicMaterial({
    color: 0xff8b32, side: THREE.DoubleSide,
    transparent: true, opacity: 0, depthWrite: false,
  });
  const innerFire = new THREE.MeshBasicMaterial({
    color: 0xffe4a1, side: THREE.DoubleSide,
    transparent: true, opacity: 0, depthWrite: false,
  });
  flames.add(decorativeMesh(fireGeometry(false), outerFire, 'shop-sign-torch-outer-flame'));
  flames.add(decorativeMesh(fireGeometry(true), innerFire, 'shop-sign-torch-inner-flame'));
  flames.userData.outerFire = outerFire;
  flames.userData.innerFire = innerFire;

  // A faint textured pool on the stone, not a realtime PointLight. Each
  // texture has transparent edges; no square billboard or neon halo.
  const washGeometry = merged(TORCH_X.map((x) => {
    const plane = new THREE.PlaneGeometry(1.45, 1.20);
    plane.translate(x, 0.13, -0.29);
    return plane;
  }));
  const wash = decorativeMesh(washGeometry, new THREE.MeshBasicMaterial({
    map: makeWarmWashTexture(), transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }), 'shop-sign-torch-wallwash');
  wash.visible = false;
  // The light pool belongs to the masonry, not to the wooden plaque.
  // Its broad transparent quad must not expand the sign's geometric
  // clearance envelope (notably the apothecary stone arch beneath it).
  nameplate.add(hoods, sconces, flames);
  return { hoods, sconces, flames, wash };
}
