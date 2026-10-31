import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Restrained, batched ornament for Swordhaven's long authored street walls.
// Does not participate in raycasting, collision, doors or game interactions.
// The houses' real street faces are supplied by the existing grid-derived
// facade selector, never inferred from render geometry.
export function dressSwordhavenStreetWindows(town, { faces, center, wallHeight, coarsePointer = false }) {
  if (wallHeight < 4 || !faces?.length) return null;
  const windows = faces.filter(({ x, y }) => (x + y) % 2 === 0);
  if (!windows.length) return null;

  const storeys = [2.15, 4.45];
  const wood = new THREE.MeshStandardMaterial({ color: 0x715037, roughness: 0.95 });
  const terracotta = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.97 });
  const greenery = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 });
  const blooms = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const count = windows.length * storeys.length;
  const hoods = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.83, 0.13, 0.19), wood, count);
  hoods.name = 'chronicles-town-street-oak-window-hoods';
  const braces = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.11, 0.46, 0.11), wood, count * 2);
  braces.name = 'chronicles-town-street-hood-knee-braces';

  // A few lower windows carry flowers; not a green blob on every wall.
  // Selection is deterministic per authored tile, not per render/reload.
  const planted = windows.filter(({ x, y }) => (x * 3 + y * 5) % 4 === 0);
  const pots = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.25, 0.21, 0.20), terracotta, planted.length);
  pots.name = 'chronicles-town-street-terracotta-window-boxes';
  const leaves = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.105, 0), greenery, planted.length * (coarsePointer ? 3 : 5));
  leaves.name = 'chronicles-town-street-window-box-foliage';
  const petals = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.060, 0), blooms, planted.length * (coarsePointer ? 1 : 3));
  petals.name = 'chronicles-town-street-window-box-blooms';

  const plantColors = [0x587943, 0x729555, 0x436b43, 0x8aa263, 0x507e4e];
  const flowerColors = [0xe9c98d, 0xd98f88, 0xf3d5b5];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const toWorld = ({ x, y }) => [(x - center.x) * 4, (y - center.y) * 4];
  const sideOffset = (yaw, side, lateral) => [
    Math.cos(yaw) * side * lateral, -Math.sin(yaw) * side * lateral,
  ];
  windows.forEach((face, faceIndex) => {
    const [wx, wz] = toWorld(face);
    const { dx, dy, yaw } = face;
    storeys.forEach((windowY, level) => {
      const index = faceIndex * storeys.length + level;
      // Above the existing wooden frame (y + 0.42), so never over the pane.
      // The hood's small upper-storey overhang cannot obstruct movement.
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(wx + dx * 2.01, windowY + 0.57, wz + dy * 2.01);
      dummy.updateMatrix();
      hoods.setMatrixAt(index, dummy.matrix);
      for (const [braceIndex, side] of [-1, 1].entries()) {
        const [ox, oz] = sideOffset(yaw, side, 0.68);
        dummy.position.set(wx + dx * 1.99 + ox, windowY + 0.39, wz + dy * 1.99 + oz);
        dummy.rotation.set(0, yaw, 0);
        dummy.rotateZ(side * 0.46);
        dummy.updateMatrix();
        braces.setMatrixAt(index * 2 + braceIndex, dummy.matrix);
      }
    });
  });

  planted.forEach((face, index) => {
    const [wx, wz] = toWorld(face);
    const { dx, dy, yaw } = face;
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(wx + dx * 2.025, 1.51, wz + dy * 2.025);
    dummy.updateMatrix();
    pots.setMatrixAt(index, dummy.matrix);
    pots.setColorAt(index, color.setHex([0xb47757, 0xc08d63, 0x9f6b53][(face.x + face.y) % 3]));
    const leafCount = coarsePointer ? 3 : 5;
    for (let leaf = 0; leaf < leafCount; leaf += 1) {
      const lateral = (leaf - (leafCount - 1) / 2) * 0.23;
      const [ox, oz] = sideOffset(yaw, 1, lateral);
      dummy.position.set(wx + dx * 2.02 + ox,
        1.73 + (leaf % 2) * 0.07, wz + dy * 2.02 + oz);
      dummy.scale.set(1.20, 0.85 + (leaf % 2) * 0.35, 0.9);
      dummy.updateMatrix();
      leaves.setMatrixAt(index * leafCount + leaf, dummy.matrix);
      leaves.setColorAt(index * leafCount + leaf, color.setHex(plantColors[(index + leaf) % plantColors.length]));
    }
    const flowerCount = coarsePointer ? 1 : 3;
    for (let flower = 0; flower < flowerCount; flower += 1) {
      const lateral = (flower - (flowerCount - 1) / 2) * 0.36;
      const [ox, oz] = sideOffset(yaw, 1, lateral);
      dummy.position.set(wx + dx * 2.10 + ox, 1.85 + (flower % 2) * 0.08,
        wz + dy * 2.10 + oz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      petals.setMatrixAt(index * flowerCount + flower, dummy.matrix);
      petals.setColorAt(index * flowerCount + flower, color.setHex(flowerColors[(index + flower) % flowerColors.length]));
    }
  });

  // A few upper-storey, south-facing casements have real wrought-iron Juliet
  // guards. The street is still fully walkable below: a guard has no platform,
  // climbing target, light or collider. Sparse deterministic authored tiles,
  // not the same rail pasted across every second-floor window.
  const guarded = windows.filter(({ x, y, dy }) =>
    dy === 1 && (x * 3 + y * 5) % 8 < 3);
  const ironParts = [];
  for (const y of [-0.17, 0.19]) {
    const rail = new THREE.BoxGeometry(1.55, 0.065, 0.075);
    rail.translate(0, y, 0.12);
    ironParts.push(rail);
  }
  for (const x of [-0.63, -0.42, -0.21, 0, 0.21, 0.42, 0.63]) {
    const baluster = new THREE.BoxGeometry(0.044, 0.36, 0.044);
    baluster.translate(x, 0.01, 0.12);
    ironParts.push(baluster);
  }
  for (const side of [-1, 1]) {
    const returnPost = new THREE.BoxGeometry(0.065, 0.39, 0.26);
    returnPost.translate(side * 0.75, 0, -0.01);
    ironParts.push(returnPost);
  }
  const ironGeometry = mergeGeometries(ironParts, false);
  ironParts.forEach(part => part.dispose());
  if (!ironGeometry) throw new Error('Swordhaven Juliet guard could not be merged');
  const julietGuards = new THREE.InstancedMesh(ironGeometry,
    new THREE.MeshStandardMaterial({ color: 0x41342d, metalness: 0.48, roughness: 0.76 }),
    guarded.length);
  julietGuards.name = 'chronicles-town-street-upper-juliet-guards';
  guarded.forEach(({ x, y, dx, dy, yaw }, index) => {
    const [wx, wz] = toWorld({ x, y });
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, yaw, 0);
    // Guard handrail ends below the real upper pane at y≈4.19m.
    // Return posts key into the blocked wall; all visible iron is >3.7m
    // above the cobbled walkable surface.
    dummy.position.set(wx + dx * 2.07, 3.96, wz + dy * 2.07);
    dummy.updateMatrix();
    julietGuards.setMatrixAt(index, dummy.matrix);
  });

  const pieces = [hoods, braces, pots, leaves, petals, julietGuards];
  for (const object of pieces) {
    object.userData.chroniclesDecorativeOnly = true;
    object.castShadow = false;
    object.receiveShadow = true;
    object.frustumCulled = false; // Instanced offsets span many authored streets.
    object.instanceMatrix.needsUpdate = true;
    if (object.instanceColor) object.instanceColor.needsUpdate = true;
    if (object.count > 0) town.add(object);
    else { object.geometry.dispose(); object.material.dispose(); }
  }
  return { hoodCount: hoods.count, planterCount: pots.count, julietGuardCount: julietGuards.count };
}
