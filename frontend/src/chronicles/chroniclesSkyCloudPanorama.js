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
    // Low horizon mist, broken mid-altitude shelves, and sparse high wisps
    // are painted into the SAME 360° atlas. Latitude alone must never create
    // a single flat grey stripe across every compass heading.
    const horizonMist = smooth(0.465, 0.52, v) * (1 - smooth(0.585, 0.65, v));
    const highEnvelope = smooth(0.635, 0.73, v) * (1 - smooth(0.89, 0.975, v));
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const broad = longitudeNoise(u, v, 7, 4);
      const middle = longitudeNoise(u, v, 19, 10);
      const fine = longitudeNoise(u, v, 43, 19);
      // Longitude-dependent height makes cloud silhouettes rise and break
      // instead of painting a uniform shelf above the Swordhaven rooftops.
      const lift = (broad - 0.5) * 0.14 + (middle - 0.5) * 0.055;
      const silhouette = smooth(0.48 + lift * 0.45, 0.61 + lift, v)
        * (1 - smooth(0.765 + lift * 0.65, 0.92 + lift * 0.8, v));
      const density = smooth(0.31, 0.79,
        0.18 + broad * 0.52 + middle * 0.29 + fine * 0.15);
      const wisp = smooth(0.24, 0.71, middle * 0.72 + fine * 0.28);
      const highPatches = smooth(0.42, 0.72,
        broad * 0.56 + middle * 0.33 + fine * 0.11);
      const coverage = Math.min(0.83,
        silhouette * (0.18 + 0.64 * density) * (0.62 + 0.38 * wisp)
        + highEnvelope * (0.035 + 0.43 * highPatches) * (0.55 + 0.45 * wisp)
        + horizonMist * (0.07 + 0.13 * broad));
      // Sculpt lighting INSIDE the existing RGBA atlas rather than adding
      // geometry or a shader: the same periodic billows get darker bases and
      // lifted, broken crowns. No extra noise samples or runtime updates.
      const underside = 1 - smooth(0.55 + lift * 0.45, 0.78 + lift * 0.55, v);
      const crown = smooth(0.62 + lift * 0.65, 0.78 + lift * 0.75, v)
        * (1 - smooth(0.85 + lift * 0.55, 0.96 + lift * 0.65, v));
      const billow = smooth(0.35, 0.76,
        broad * 0.36 + middle * 0.49 + fine * 0.15);
      const shadow = (1 - billow) * 22 + underside * (11 + 12 * middle);
      const ridgeLight = crown * (14 + 23 * billow);
      const shade = Math.round(151 + broad * 24 + middle * 29 + fine * 8
        - shadow + ridgeLight + Math.max(0, v - 0.7) * 8);
      const index = (y * width + x) * 4;
      rgba[index] = Math.max(105, Math.min(220, shade - 11));
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
  // The scene disposer releases materials; release this generated GPU
  // texture with its owning material rather than retaining it across maps.
  material.addEventListener('dispose', () => texture.dispose());
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
