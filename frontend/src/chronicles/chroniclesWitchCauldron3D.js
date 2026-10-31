import * as THREE from 'three';

// A recognisable witch's iron cauldron, not a recoloured crystal pickup.
// Static geometry keeps the idle first-person renderer asleep; no extra
// textures, network requests or animation loops. The brew can be emptied
// independently after an authenticated world-stat claim.
export function buildChroniclesWitchCauldron3D({ coarsePointer = false } = {}) {
  const group = new THREE.Group();
  group.name = 'chronicles-witch-cauldron';
  const iron = new THREE.MeshStandardMaterial({
    color: 0x272c2a, metalness: 0.72, roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const lip = new THREE.MeshStandardMaterial({
    color: 0x565349, metalness: 0.65, roughness: 0.38,
  });
  const brewMaterial = new THREE.MeshStandardMaterial({
    color: 0x397b4e, emissive: 0x205c31, emissiveIntensity: 1.05,
    roughness: 0.24, metalness: 0.1,
  });

  // Lathed, concave profile: the surface of the potion is visible from above.
  const profile = [
    [0, 0.20], [0.23, 0.22], [0.39, 0.36],
    [0.48, 0.61], [0.47, 0.78], [0.41, 0.85],
    [0.35, 0.80], [0.32, 0.69], [0.18, 0.64], [0, 0.64],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, coarsePointer ? 12 : 20), iron);
  body.name = 'witch-cauldron-bowl';
  body.castShadow = !coarsePointer;
  body.receiveShadow = true;
  group.add(body);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.435, 0.048, 7, coarsePointer ? 14 : 22), lip);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.83;
  group.add(rim);

  for (let i = 0; i < 3; i += 1) {
    const angle = i * Math.PI * 2 / 3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 0.23, 7), iron);
    leg.position.set(Math.cos(angle) * 0.30, 0.12, Math.sin(angle) * 0.30);
    leg.castShadow = !coarsePointer;
    group.add(leg);
  }
  for (const sign of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 12), lip);
    handle.position.set(sign * 0.52, 0.67, 0);
    handle.rotation.y = Math.PI / 2;
    group.add(handle);
  }

  const contents = new THREE.Group();
  contents.name = 'witch-cauldron-brew';
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.345, 0.345, 0.02, coarsePointer ? 12 : 20),
    brewMaterial,
  );
  liquid.name = 'witch-cauldron-liquid';
  liquid.position.y = 0.73;
  contents.add(liquid);
  for (const [x, z, scale] of [[-0.13, 0.08, 0.065], [0.15, -0.1, 0.045], [0.035, 0.16, 0.04]]) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(scale, 8, 6), brewMaterial);
    bubble.position.set(x, 0.77, z);
    contents.add(bubble);
  }
  // One local light only; avoid extra lights on coarse/mobile pointers.
  if (!coarsePointer) {
    const glow = new THREE.PointLight(0x65c784, 0.42, 2.7, 2);
    glow.position.y = 0.81;
    contents.add(glow);
  }
  group.add(contents);
  return { group, contents };
}
