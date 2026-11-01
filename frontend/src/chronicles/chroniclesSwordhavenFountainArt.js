import * as THREE from 'three';

// Only the First Book plaza gets this second, ceremonial fountain tier.
// The original 4m-blocked tile remains the only collision source. This is
// decorative visual art: no lights, physics, raycasts or per-frame allocation.
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

  // Two soft wave crests on the lower pool. All pieces are instanced and
  // use local materials: no moving water shader or shared palette mutation.
  const waveMaterial = new THREE.MeshBasicMaterial({
    color: 0xc1f0eb, transparent: true, opacity: 0.19,
    depthWrite: false, toneMapped: false,
  });
  const poolWaves = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.62, 0.009, 4, coarsePointer ? 12 : 20),
    waveMaterial, 2);
  poolWaves.name = 'fountain-pool-soft-waves';
  poolWaves.userData.chroniclesDecorativeOnly = true;
  poolWaves.castShadow = false;
  poolWaves.receiveShadow = false;
  tier.add(poolWaves);

  // A few very small highlights travel down the existing curved jets.
  // The original four tubes remain stationary, inside the blocked tile.
  const glintMaterial = new THREE.MeshBasicMaterial({
    color: 0xe0fbf6, transparent: true, opacity: 0.52,
    depthWrite: false, toneMapped: false,
  });
  const glints = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.031, 6, 4), glintMaterial, 12);
  glints.name = 'fountain-jet-moving-glints';
  glints.userData.chroniclesDecorativeOnly = true;
  glints.castShadow = false;
  glints.receiveShadow = false;
  tier.add(glints);

  const point = new THREE.Vector3();
  function updateChroniclesFountainWater(seconds) {
    if (!Number.isFinite(seconds)) return;
    rippleMaterial.opacity = 0.62 + 0.08 * Math.sin(seconds * 2.1);
    waveMaterial.opacity = 0.17 + 0.04 * Math.sin(seconds * 1.3);
    for (let index = 0; index < 4; index += 1) {
      const phase = (seconds * 0.36 + index * 0.25) % 1;
      const angle = index * Math.PI / 2;
      dummy.position.set(Math.cos(angle) * 1.30, 0.748, -Math.sin(angle) * 1.30);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(0.76 + phase * 0.43);
      dummy.updateMatrix();
      ripples.setMatrixAt(index, dummy.matrix);
    }
    ripples.instanceMatrix.needsUpdate = true;
    for (let index = 0; index < 2; index += 1) {
      const phase = (seconds * 0.19 + index * 0.5) % 1;
      dummy.position.set(0, 0.748 + index * 0.001, 0);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(0.90 + phase * 0.40);
      dummy.updateMatrix();
      poolWaves.setMatrixAt(index, dummy.matrix);
    }
    poolWaves.instanceMatrix.needsUpdate = true;
    for (let jet = 0; jet < 4; jet += 1) {
      const angle = jet * Math.PI / 2;
      for (let bead = 0; bead < 3; bead += 1) {
        const phase = (seconds * 0.30 + bead / 3 + jet * 0.06) % 1;
        stream.getPoint(phase, point);
        dummy.position.set(point.x * Math.cos(angle), point.y, -point.x * Math.sin(angle));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.65 + 0.17 * Math.sin(phase * Math.PI));
        dummy.updateMatrix();
        glints.setMatrixAt(jet * 3 + bead, dummy.matrix);
      }
    }
    glints.instanceMatrix.needsUpdate = true;
  }
  tier.userData.updateChroniclesFountainWater = updateChroniclesFountainWater;
  updateChroniclesFountainWater(0);
  fountain.add(tier);
  return tier;
}

/** Only animate while the camera is near the First Book plaza; no idle GPU loop elsewhere. */
export function chroniclesFountainMotionEnabled({
  visible = true, reducedMotion = false, partyPosition, fountainPosition,
} = {}) {
  if (!visible || reducedMotion || !partyPosition || !fountainPosition) return false;
  const dx = partyPosition.x - fountainPosition.x;
  const dz = partyPosition.z - fountainPosition.z;
  return Number.isFinite(dx) && Number.isFinite(dz) && dx * dx + dz * dz <= 26 * 26;
}
