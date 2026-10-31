import * as THREE from 'three';

// Shared dark backing for attic vents: no added texture, decal or light.
const HOME_ATTIC_RECESS = new THREE.MeshStandardMaterial({
  color: 0x252521, roughness: 1, side: THREE.DoubleSide,
});

// Procedural, shared-material dressing for the residential and civic facades.
// All meshes stay decorative, above the existing house footprint. The authored
// grid still owns collision, doors, NPC interactions and walkable streets.
export function dressSwordhavenPremiumHouse(root, {
  civic = false, width, height, facadeZ, mats, coarse, homeStyle = 0,
}) {
  const dressing = new THREE.Group();
  dressing.name = civic ? 'swordhaven-civic-premium-frontage' : 'swordhaven-home-premium-frontage';
  dressing.userData.chroniclesDecorativeOnly = true;

  function piece(name, geometry, material, x, y, z) {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.position.set(x, y, z);
    object.castShadow = !coarse;
    object.receiveShadow = true;
    object.userData.chroniclesDecorativeOnly = true;
    dressing.add(object);
    return object;
  }

  // Proper oak rake boards and carved gable tie: the first silhouette
  // visible above the facade when the party approaches the town hall.
  for (const side of [-1, 1]) {
    const rake = piece('premium-oak-gable-rake',
      new THREE.BoxGeometry(0.23, Math.hypot(width / 2, 1.85), 0.25),
      mats.timber, side * width / 4, height + 0.89, facadeZ + 0.23);
    rake.rotation.z = side * Math.atan2(width / 2, 1.85);
    piece('premium-oak-eave-knee-bracket',
      new THREE.BoxGeometry(0.21, 0.96, 0.27),
      mats.timber, side * width * 0.43, height - 0.35, facadeZ + 0.24
    ).rotation.z = side * 0.55;
  }
  piece('premium-oak-gable-tie', new THREE.BoxGeometry(width * 0.73, 0.17, 0.24),
    mats.timber, 0, height + 0.13, facadeZ + 0.26);

  // Four fully open shutters, outside the two existing amber windows.
  // Instancing keeps the detail affordable for all residential houses.
  const shutters = new THREE.InstancedMesh(new THREE.BoxGeometry(0.43, 1.23, 0.09),
    mats.timber, 4);
  shutters.name = 'premium-oak-window-shutters';
  const iron = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.065, 0.05),
    mats.steel, 8);
  iron.name = 'premium-shutter-iron-straps';
  const diagonal = new THREE.InstancedMesh(new THREE.BoxGeometry(0.085, 1.02, 0.05),
    mats.timber, 4);
  diagonal.name = 'premium-shutter-cross-braces';
  const dummy = new THREE.Object3D();
  let index = 0;
  for (const x of [-width * 0.33, width * 0.33]) {
    for (const side of [-1, 1]) {
      const shutterX = x + side * 0.99;
      dummy.position.set(shutterX, 2.75, facadeZ + 0.40);
      dummy.rotation.set(0, side * 0.16, 0);
      dummy.updateMatrix();
      shutters.setMatrixAt(index, dummy.matrix);
      dummy.position.z = facadeZ + 0.47;
      dummy.rotation.set(0, side * 0.16, side * 0.20);
      dummy.updateMatrix();
      diagonal.setMatrixAt(index, dummy.matrix);
      for (const [strap, dy] of [-0.42, 0.42].entries()) {
        dummy.position.y = 2.75 + dy;
        dummy.rotation.z = 0;
        dummy.updateMatrix();
        iron.setMatrixAt(index * 2 + strap, dummy.matrix);
      }
      index += 1;
    }
  }
  for (const batch of [shutters, iron, diagonal]) {
    batch.instanceMatrix.needsUpdate = true;
    batch.castShadow = !coarse;
    batch.receiveShadow = true;
    batch.userData.chroniclesDecorativeOnly = true;
    dressing.add(batch);
  }

  // Both windows get substantial oak eyebrow hoods and short carved braces
  // immediately over their existing stone lintels. No glass is covered.
  const windowHoods = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.88, 0.13, 0.42), mats.timber, 2);
  windowHoods.name = 'premium-window-hood-rails';
  const hood = new THREE.Object3D();
  for (const [i, x] of [-width * 0.33, width * 0.33].entries()) {
    hood.position.set(x, 3.53, facadeZ + 0.34);
    hood.updateMatrix();
    windowHoods.setMatrixAt(i, hood.matrix);
  }
  windowHoods.instanceMatrix.needsUpdate = true;
  windowHoods.userData.chroniclesDecorativeOnly = true;
  dressing.add(windowHoods);

  // The original emissive lamps remain the only light source; inexpensive
  // iron cages give them physical depth instead of glowing square decals.
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.43, 0.10, 0.40), mats.steel, 4);
  caps.name = 'premium-forged-lantern-caps';
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.47, 0.045), mats.steel, 8);
  bars.name = 'premium-forged-lantern-bars';
  for (const [lantern, x] of [-width * 0.41, width * 0.41].entries()) {
    for (const [index, dy] of [-0.27, 0.27].entries()) {
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, height - 0.69 + dy, facadeZ + 0.26);
      dummy.updateMatrix();
      caps.setMatrixAt(lantern * 2 + index, dummy.matrix);
    }
    for (const [index, dx] of [-0.17, 0.17].entries()) {
      for (const [zIndex, dz] of [-0.14, 0.14].entries()) {
        dummy.position.set(x + dx, height - 0.69, facadeZ + 0.26 + dz);
        dummy.updateMatrix();
        bars.setMatrixAt(lantern * 4 + index * 2 + zIndex, dummy.matrix);
      }
    }
  }
  for (const batch of [caps, bars]) {
    batch.instanceMatrix.needsUpdate = true;
    batch.userData.chroniclesDecorativeOnly = true;
    dressing.add(batch);
  }

  if (civic) {
    // Raised limestone doorway with a proper lintel, iron ring knocker and
    // gilded municipal coat of arms on the EXISTING pair of pennants.
    for (const side of [-1, 1]) {
      piece('civic-portal-ashlar-pier', new THREE.BoxGeometry(0.34, 3.14, 0.37),
        mats.stone, side * 1.16, 1.65, facadeZ + 0.34);
      piece('civic-pennant-gold-tower', new THREE.BoxGeometry(0.31, 0.49, 0.075),
        mats.gold, side * width * 0.38, height - 1.42, facadeZ + 0.29);
      for (const battlement of [-1, 0, 1]) {
        piece('civic-pennant-battlement', new THREE.BoxGeometry(0.105, 0.12, 0.075),
          mats.gold, side * width * 0.38 + battlement * 0.12,
          height - 1.12, facadeZ + 0.29);
      }
    }
    piece('civic-portal-carved-lintel', new THREE.BoxGeometry(2.84, 0.30, 0.43),
      mats.stone, 0, 3.29, facadeZ + 0.35);
    piece('civic-portal-keystone', new THREE.BoxGeometry(0.37, 0.36, 0.46),
      mats.stone, 0, 3.39, facadeZ + 0.39);
    piece('civic-door-ring-knocker', new THREE.TorusGeometry(0.16, 0.038, 6, 12),
      mats.gold, 0.49, 1.47, facadeZ + 0.35);
  } else {
    // Attic vents are recessed into the existing front gable triangle. A
    // round oculus and a diamond-shaped louvred vent alternate by authored
    // house position, so all four roof colours no longer share one blank
    // upper wall. Both sit above the door/sign area and below the ridge.
    const attic = new THREE.Group();
    attic.name = 'home-authored-attic-vent';
    attic.userData.chroniclesDecorativeOnly = true;
    attic.position.set(0, height + 0.86, facadeZ + 0.34);
    const round = homeStyle % 2 === 0;
    const aperture = new THREE.Mesh(
      new THREE.CircleGeometry(round ? 0.32 : 0.30, round ? (coarse ? 12 : 20) : 4),
      HOME_ATTIC_RECESS);
    aperture.name = round ? 'home-attic-round-recess' : 'home-attic-diamond-recess';
    // Four segments already form the diamond: do not rotate into a square.
    aperture.rotation.z = 0;
    aperture.userData.chroniclesDecorativeOnly = true;
    attic.add(aperture);
    if (round) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.065, 5, coarse ? 12 : 20),
        mats.timber);
      rim.name = 'home-attic-oak-oculus-rim';
      rim.position.z = 0.055;
      rim.userData.chroniclesDecorativeOnly = true;
      attic.add(rim);
    } else {
      const diamond = new THREE.Mesh(
        new THREE.RingGeometry(0.30, 0.39, 4), mats.timber);
      diamond.name = 'home-attic-diamond-oak-trim';
      diamond.rotation.z = 0;
      diamond.position.z = 0.055;
      diamond.userData.chroniclesDecorativeOnly = true;
      attic.add(diamond);
    }
    // Two dark wooden louvers keep both openings recognisable as vents
    // rather than another lit living-room window.
    for (const index of [-1, 1]) {
      const louver = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.055, 0.065),
        mats.timber);
      louver.name = 'home-attic-vent-louver';
      louver.position.set(0, index * 0.12, 0.08);
      louver.userData.chroniclesDecorativeOnly = true;
      attic.add(louver);
    }
    dressing.add(attic);
    // Every other house gets one modest roof-end finial. It intersects the
    // EXISTING ridge, stays in the blocked building footprint and does not
    // become a new elevated silhouette taller than the commercial roofs.
    if (homeStyle % 2 === 1) {
      const finial = piece('home-oak-ridge-finial',
        new THREE.ConeGeometry(0.19, 0.37, coarse ? 5 : 8),
        mats.timber, 0, height + 1.91, facadeZ - 0.10);
      finial.castShadow = false;
    }
    // Small domestic threshold and layered lintel. These houses have no
    // government coat of arms, extra storefront signs or artificial lighting.
    piece('home-carved-door-hood', new THREE.BoxGeometry(2.43, 0.20, 0.40),
      mats.timber, 0, 3.29, facadeZ + 0.33);
    for (const side of [-1, 1]) {
      piece('home-door-oak-bracket', new THREE.BoxGeometry(0.17, 0.48, 0.25),
        mats.timber, side * 1.06, 3.04, facadeZ + 0.30
      ).rotation.z = side * 0.45;
    }
  }
  root.add(dressing);
  return dressing;
}
