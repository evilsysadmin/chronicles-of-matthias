import * as THREE from 'three';

// The inn's broad front dormer changes its roof silhouette without touching
// the authored 3x3 blocked footprint, doorway, NPC interactions or lighting.
export function dressSwordhavenTavernRoofDormer(root, {
  width, depth, height, roof, wallMaterial, mats, coarse = false,
}) {
  if (!root?.isGroup) return null;
  const existing = root.getObjectByName('tavern-front-roof-dormer');
  if (existing) return existing;
  const dormer = new THREE.Group();
  dormer.name = 'tavern-front-roof-dormer';
  dormer.position.z = depth / 2 - 0.55;
  dormer.userData.chroniclesDecorativeOnly = true;

  const add = (name, geometry, material, x, y, z) => {
    const part = new THREE.Mesh(geometry, material);
    part.name = name;
    part.position.set(x, y, z);
    part.castShadow = !coarse;
    part.receiveShadow = true;
    part.userData.chroniclesDecorativeOnly = true;
    dormer.add(part);
    return part;
  };

  // Full attic volume emerges through the existing clay-tiled main roof.
  // Its front projects only into the already-blocked house cell.
  add('tavern-dormer-attic-body',
    new THREE.BoxGeometry(2.26, 1.32, 2.02), wallMaterial,
    0, height + 1.74, 0);
  const gable = new THREE.Shape();
  gable.moveTo(-1.16, 0);
  gable.lineTo(1.16, 0);
  gable.lineTo(0, 0.75);
  gable.closePath();
  add('tavern-dormer-front-gable',
    new THREE.ShapeGeometry(gable), wallMaterial,
    0, height + 2.38, 1.045);

  // Two real sloping clay-tile planes, not a flat ornament on the facade.
  for (const side of [-1, 1]) {
    const slope = add('tavern-dormer-roof-slope',
      new THREE.BoxGeometry(1.39, 0.17, 2.35), roof,
      side * 0.59, height + 2.70, 0);
    slope.rotation.z = -side * 0.53;
    add('tavern-dormer-oak-verge',
      new THREE.BoxGeometry(0.13, 0.16, 2.39), mats.timber,
      side * 1.20, height + 2.36, 0).rotation.z = -side * 0.53;
  }
  add('tavern-dormer-ridge',
    new THREE.BoxGeometry(0.18, 0.15, 2.42), mats.timber,
    0, height + 3.07, 0);

  // Readable attic casement on the street-facing gable. Reuse the inn's
  // existing amber glazing, oak and steel: no extra texture or light.
  add('tavern-dormer-amber-window',
    new THREE.BoxGeometry(0.92, 0.80, 0.06), mats.window,
    0, height + 1.84, 1.092);
  for (const side of [-1, 1]) {
    add('tavern-dormer-oak-window-jamb',
      new THREE.BoxGeometry(0.13, 0.98, 0.12), mats.timber,
      side * 0.53, height + 1.84, 1.16);
  }
  for (const y of [height + 1.34, height + 2.34]) {
    add('tavern-dormer-oak-window-rail',
      new THREE.BoxGeometry(1.18, 0.12, 0.12), mats.timber,
      0, y, 1.16);
  }
  add('tavern-dormer-iron-mullion',
    new THREE.BoxGeometry(0.06, 0.76, 0.08), mats.steel,
    0, height + 1.84, 1.20);
  // Recessed silhouette remains narrower than the main gable and well
  // inside the authored 12m collision footprint.
  if (width < 3 || depth < 3) return null;
  root.add(dormer);
  return dormer;
}
