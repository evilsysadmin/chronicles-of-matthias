import * as THREE from 'three';

// The six existing Terra restoration shrines share one quiet, procedural
// stone fountain. The basin remains when depleted; only its water hides.
export function buildChroniclesRestorativeFountain3D({ coarsePointer = false } = {}) {
  const group = new THREE.Group();
  group.name = 'chronicles-restorative-fountain';
  const stone = new THREE.MeshStandardMaterial({
    color: 0x817f73, roughness: 0.94, metalness: 0.04,
  });
  const rimStone = new THREE.MeshStandardMaterial({
    color: 0xb3ac91, roughness: 0.85, metalness: 0.03,
  });
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b9da6, emissive: 0x126776, emissiveIntensity: 0.52,
    roughness: 0.2, metalness: 0.12, transparent: true, opacity: 0.85,
  });
  const segments = coarsePointer ? 10 : 20;

  const footing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.73, 0.82, 0.18, segments), stone,
  );
  footing.position.y = 0.09;
  footing.receiveShadow = true;
  group.add(footing);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.50, 0.46, segments), stone,
  );
  pedestal.position.y = 0.40;
  pedestal.castShadow = !coarsePointer;
  group.add(pedestal);

  // Sculpt the basin with a low-profile concave lathe so the water is
  // visible from the player's first-person camera.
  const profile = [[0, 0.65], [0.42, 0.65], [0.64, 0.72],
    [0.72, 0.87], [0.68, 0.91], [0.59, 0.85],
    [0.49, 0.78], [0, 0.78]].map(([r, y]) => new THREE.Vector2(r, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, segments), stone);
  bowl.name = 'restorative-fountain-basin';
  bowl.receiveShadow = true;
  group.add(bowl);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.052, 7, segments), rimStone,
  );
  rim.position.y = 0.88;
  rim.rotation.x = -Math.PI / 2;
  group.add(rim);

  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.16, 0.39, 8), rimStone,
  );
  spout.position.y = 0.95;
  group.add(spout);

  const water = new THREE.Group();
  water.name = 'restorative-fountain-water';
  const pool = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.016, segments), waterMaterial,
  );
  pool.name = 'restorative-fountain-pool';
  pool.position.y = 0.795;
  water.add(pool);

  // Four tiny static jets imply a magical spring without continuous
  // updates or a GPU-waking animation loop.
  for (const [x, z] of [[0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]]) {
    const jet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.04, 0.14, 5), waterMaterial,
    );
    jet.position.set(x, 0.88, z);
    water.add(jet);
  }
  if (!coarsePointer) {
    const glow = new THREE.PointLight(0x55b7ce, 0.35, 2.4, 2);
    glow.position.y = 0.95;
    water.add(glow);
  }
  group.add(water);
  return { group, water };
}
