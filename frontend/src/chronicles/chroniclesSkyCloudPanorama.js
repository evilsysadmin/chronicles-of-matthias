import * as THREE from 'three';

// A camera-centred, seamless 360-degree cloud layer. All variation is
// deterministic at construction time; there is no per-frame CPU/GPU noise,
// wind timer, new light, external asset or collision geometry.
const smooth = (low, high, value) => {
  const x = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return x * x * (3 - 2 * x);
};

function hash(x, y) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

// The longitude lattice wraps exactly, so sampling u=0 and u=1 returns
// identical pixels. Avoid discontinuous sprite edges at north/south turns.
function longitudeNoise(u, v, frequency, verticalFrequency) {
  const x = u * frequency;
  const y = v * verticalFrequency;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const sx = smooth(0, 1, x - ix);
  const sy = smooth(0, 1, y - iy);
  const wrap = (column) => ((column % frequency) + frequency) % frequency;
  const a = THREE.MathUtils.lerp(hash(wrap(ix), iy), hash(wrap(ix + 1), iy), sx);
  const b = THREE.MathUtils.lerp(hash(wrap(ix), iy + 1), hash(wrap(ix + 1), iy + 1), sx);
  return THREE.MathUtils.lerp(a, b, sy);
}

export function createChroniclesSkyCloudPanorama(coarsePointer = false) {
  const width = coarsePointer ? 256 : 512;
  const height = coarsePointer ? 96 : 192;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    // The lower horizon is translucent mist; over it sit uneven, higher
    // storm shelves, leaving room for blue sky on genuinely clear days.
    const silhouette = smooth(0.50, 0.62, v) * (1 - smooth(0.79, 0.91, v));
    const horizonMist = smooth(0.465, 0.515, v) * (1 - smooth(0.565, 0.64, v));
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const broad = longitudeNoise(u, v, 7, 4);
      const middle = longitudeNoise(u, v, 19, 10);
      const fine = longitudeNoise(u, v, 43, 19);
      const density = smooth(0.31, 0.79,
        0.18 + broad * 0.52 + middle * 0.29 + fine * 0.15);
      const wisp = smooth(0.24, 0.71, middle * 0.72 + fine * 0.28);
      const coverage = Math.min(0.79,
        silhouette * (0.18 + 0.59 * density) * (0.69 + 0.31 * wisp)
        + horizonMist * (0.10 + 0.12 * broad));
      const shade = Math.round(145 + broad * 38 + middle * 27 + fine * 9);
      const index = (y * width + x) * 4;
      rgba[index] = shade - 11;
      rgba[index + 1] = shade;
      rgba[index + 2] = Math.min(255, shade + 13);
      rgba[index + 3] = Math.round(coverage * 255);
    }
  }

  const texture = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  // Same camera-relative coordinate system as the existing solar dome:
  // it never floats toward the player, and a 360-degree yaw stays continuous.
  const material = new THREE.MeshBasicMaterial({
    map: texture, color: 0xc4cdd4, transparent: true,
    opacity: 0.11, depthWrite: false, depthTest: true, fog: false,
    toneMapped: false, side: THREE.BackSide,
  });
  const layer = new THREE.Mesh(
    new THREE.SphereGeometry(60.5, coarsePointer ? 48 : 64, coarsePointer ? 16 : 24),
    material,
  );
  layer.name = 'chronicles-sky-cloud-panorama';
  layer.renderOrder = -97;
  layer.frustumCulled = false;
  layer.castShadow = false;
  layer.receiveShadow = false;
  layer.userData.chroniclesDecorativeOnly = true;
  return layer;
}
