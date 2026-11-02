import * as THREE from 'three';

// The provisions dock is a working cedar lean-to, not a featureless roof slab.
// All details follow the existing pitched canopy, stay decorative and reuse
// the town's oak material. No walk-grid, interaction or collision changes.
export function dressSwordhavenStoreLoadingRoof(dock, { mats, coarse = false } = {}) {
  if (!dock?.isGroup || !mats?.timber) return null;
  const existing = dock.getObjectByName('store-loading-dock-cedar-battens');
  if (existing) return existing;
  const canopy = dock.getObjectByName('store-loading-dock-cedar-roof');
  if (!canopy?.isMesh || canopy.geometry?.type !== 'BoxGeometry') return null;
  const { width, depth } = canopy.geometry.parameters;
  const pitch = canopy.rotation.z;
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const batten = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.075, 0.055, depth - 0.12),
    mats.timber, 6,
  );
  batten.name = 'store-loading-dock-cedar-battens';
  batten.position.copy(canopy.position);
  batten.castShadow = !coarse;
  batten.receiveShadow = true;
  batten.userData.chroniclesDecorativeOnly = true;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let index = 0; index < 6; index += 1) {
    const x = (index - 2.5) * 0.30;
    // Local normal of the sloped roof: raised just above its top face.
    dummy.position.set(x * c - 0.12 * s, x * s + 0.12 * c, 0);
    dummy.rotation.set(0, 0, pitch);
    dummy.updateMatrix();
    batten.setMatrixAt(index, dummy.matrix);
    batten.setColorAt(index, tint.setHex(index % 2 ? 0xd4b694 : 0xf0d4ac));
  }
  batten.instanceMatrix.needsUpdate = true;
  if (batten.instanceColor) batten.instanceColor.needsUpdate = true;

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
  dock.add(batten, fascia);
  return batten;
}
