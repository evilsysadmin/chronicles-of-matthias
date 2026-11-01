import * as THREE from 'three';

// Only the First Book plaza gets this second, ceremonial fountain tier.
// The original 4m-blocked tile remains the only collision source. This is
// static visual art: no timers, lights, extra water simulation or raycasts.
export function dressSwordhavenTieredFountain(fountain, mats, { coarsePointer = false } = {}) {
  if (!fountain?.isGroup) return null;
  const existing = fountain.getObjectByName('swordhaven-fountain-upper-tier');
  if (existing) return existing;
  const water = fountain.getObjectByName('fountain-water');
  if (!water?.material || !mats?.stone || !mats?.gold) return null;

  const tier = new THREE.Group();
  tier.name = 'swordhaven-fountain-upper-tier';
  tier.userData.chroniclesDecorativeOnly = true;

  function detail(name, geometry, material, position, { flat = false } = {}) {
    const part = new THREE.Mesh(geometry, material);
    part.name = name;
    part.position.set(...position);
    if (flat) part.rotation.x = Math.PI / 2;
    part.castShadow = false;
    part.receiveShadow = true;
    part.userData.chroniclesDecorativeOnly = true;
    tier.add(part);
    return part;
  }

  // The wide lower basin and its original stone pedestal stay unchanged.
  detail('fountain-upper-stone-bowl',
    new THREE.CylinderGeometry(0.72, 0.43, 0.28, coarsePointer ? 12 : 20),
    mats.stone, [0, 2.18, 0]);
  detail('fountain-upper-water',
    new THREE.CylinderGeometry(0.58, 0.58, 0.022, coarsePointer ? 12 : 20),
    water.material, [0, 2.333, 0]);
  detail('fountain-upper-carved-lip',
    new THREE.TorusGeometry(0.68, 0.074, 6, coarsePointer ? 16 : 24),
    mats.stone, [0, 2.35, 0], { flat: true });
  detail('fountain-crowned-stem',
    new THREE.CylinderGeometry(0.15, 0.25, 0.40, 10),
    mats.stone, [0, 2.57, 0]);
  detail('fountain-gilded-finial',
    new THREE.SphereGeometry(0.24, coarsePointer ? 8 : 12, 8),
    mats.gold, [0, 2.88, 0]);

  // On actual 390px screenshots, the old 10cm-wide water tubes looked like
  // rigid cyan pipes. Keep the same four arcs but make them fine water threads.
  // All impacts stay inside the original 1.47m water disk, not on the road.
  const stream = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0.69, 2.32, 0),
    new THREE.Vector3(1.12, 2.42, 0),
    new THREE.Vector3(1.30, 0.79, 0),
  );
  const jets = new THREE.InstancedMesh(
    new THREE.TubeGeometry(stream, coarsePointer ? 12 : 20, 0.026, 6, false),
    water.material, 4);
  jets.name = 'fountain-four-water-jets';
  jets.userData.chroniclesDecorativeOnly = true;
  jets.castShadow = false;
  jets.receiveShadow = false;
  const dummy = new THREE.Object3D();
  for (let index = 0; index < 4; index += 1) {
    dummy.rotation.set(0, index * Math.PI / 2, 0);
    dummy.updateMatrix();
    jets.setMatrixAt(index, dummy.matrix);
  }
  jets.instanceMatrix.needsUpdate = true;
  tier.add(jets);

  // Four quiet, low-profile ripple crowns give the otherwise perfectly flat
  // lower water a visible point of impact. Batch all four into one draw call;
  // the ring is fully contained within the same basin (1.30 + 0.112 < 1.47).
  // This material is local to one decorative fountain, not the shared water
  // surface, so the original basin tint and all other settlements are intact.
  const rippleMaterial = new THREE.MeshStandardMaterial({
    color: 0xc0e7e5, metalness: 0.05, roughness: 0.38,
    transparent: true, opacity: 0.70, depthWrite: false,
  });
  const ripples = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.10, 0.012, 4, coarsePointer ? 12 : 16),
    rippleMaterial, 4);
  ripples.name = 'fountain-water-impact-ripples';
  ripples.userData.chroniclesDecorativeOnly = true;
  ripples.castShadow = false;
  ripples.receiveShadow = false;
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI / 2;
    dummy.position.set(Math.cos(angle) * 1.30, 0.748, -Math.sin(angle) * 1.30);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    ripples.setMatrixAt(index, dummy.matrix);
  }
  ripples.instanceMatrix.needsUpdate = true;
  tier.add(ripples);
  fountain.add(tier);
  return tier;
}
