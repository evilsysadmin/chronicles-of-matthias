import * as THREE from 'three';

// The provisions dock is a working cedar lean-to, not a featureless roof slab.
// All details follow the existing pitched canopy, stay decorative and reuse
// the town's oak material. No walk-grid, interaction or collision changes.
export function dressSwordhavenStoreLoadingRoof(dock, { mats, coarse = false } = {}) {
  if (!dock?.isGroup || !mats?.timber) return null;
  const existing = dock.getObjectByName('store-loading-dock-cedar-planks');
  if (existing) return existing;
  const canopy = dock.getObjectByName('store-loading-dock-cedar-roof');
  if (!canopy?.isMesh || canopy.geometry?.type !== 'BoxGeometry') return null;
  const { width, depth } = canopy.geometry.parameters;
  const pitch = canopy.rotation.z;
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const batten = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.43, 0.045, depth - 0.18),
    canopy.material, 4,
  );
  batten.name = 'store-loading-dock-cedar-planks';
  batten.position.copy(canopy.position);
  batten.castShadow = false;
  batten.receiveShadow = true;
  batten.userData.chroniclesDecorativeOnly = true;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let index = 0; index < 4; index += 1) {
    const x = (index - 1.5) * 0.45;
    // Local normal of the sloped roof: raised just above its top face.
    dummy.position.set(x * c - 0.115 * s, x * s + 0.115 * c, 0);
    dummy.rotation.set(0, 0, pitch);
    dummy.updateMatrix();
    batten.setMatrixAt(index, dummy.matrix);
    batten.setColorAt(index, tint.setHex(index % 2 ? 0xe4d9ca : 0xffffff));
  }
  batten.instanceMatrix.needsUpdate = true;
  if (batten.instanceColor) batten.instanceColor.needsUpdate = true;

  // Four broad cedar boards create restrained seams rather than dark roof ribs.
  // Two visible cut ends complete the canopy's timber thickness in oblique
  // street views, without projecting beyond the existing blocked house cells.
  const fascia = new THREE.InstancedMesh(
    new THREE.BoxGeometry(width + 0.02, 0.15, 0.11),
    mats.timber, 2,
  );
  fascia.name = 'store-loading-dock-cedar-fascia';
  fascia.position.copy(canopy.position);
  fascia.castShadow = !coarse;
  fascia.receiveShadow = true;
  fascia.userData.chroniclesDecorativeOnly = true;
  for (const [index, side] of [-1, 1].entries()) {
    dummy.position.set(0, 0, side * (depth / 2 - 0.06));
    dummy.rotation.set(0, 0, pitch);
    dummy.updateMatrix();
    fascia.setMatrixAt(index, dummy.matrix);
  }
  fascia.instanceMatrix.needsUpdate = true;

  // Three exposed oak rafters support the cedar canopy from below. Their
  // sloped undersides add a warehouse-like shadow line at street height
  // without another material, light, collider or draw call per beam.
  // They remain inside the original solid 3x3 building footprint.
  const rafters = new THREE.InstancedMesh(
    new THREE.BoxGeometry(width - 0.18, 0.15, 0.17),
    mats.timber, 3,
  );
  rafters.name = 'store-loading-dock-oak-underside-rafters';
  rafters.position.copy(canopy.position);
  rafters.castShadow = !coarse;
  rafters.receiveShadow = true;
  rafters.userData.chroniclesDecorativeOnly = true;
  for (const [index, z] of [-depth * 0.32, 0, depth * 0.32].entries()) {
    // Rotate the local roof normal, so each beam touches the pitched soffit.
    dummy.position.set(0.16 * s, -0.16 * c, z);
    dummy.rotation.set(0, 0, pitch);
    dummy.updateMatrix();
    rafters.setMatrixAt(index, dummy.matrix);
  }
  rafters.instanceMatrix.needsUpdate = true;

  // The outer eave now has a continuous oak lip, visibly separating the
  // pitched cedar roof from its shaded loading platform in oblique views.
  // One short decorative mesh follows the existing roof pitch; its edge
  // remains inside the same blocked building footprint.
  const eave = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.24, depth - 0.10), mats.timber,
  );
  eave.name = 'store-loading-dock-oak-outer-eave';
  const edgeX = width / 2 - 0.12;
  const belowRoof = -0.14;
  eave.position.set(
    canopy.position.x + edgeX * c - belowRoof * s,
    canopy.position.y + edgeX * s + belowRoof * c,
    canopy.position.z,
  );
  eave.rotation.z = pitch;
  eave.castShadow = !coarse;
  eave.receiveShadow = true;
  eave.userData.chroniclesDecorativeOnly = true;
  dock.add(batten, fascia, rafters, eave);
  return batten;
}
