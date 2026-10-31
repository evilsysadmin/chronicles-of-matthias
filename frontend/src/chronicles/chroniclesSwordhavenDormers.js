import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Only raised 4+ cell residential roof runs receive dormers. The short
// two-cell roofs remain plain, preserving variety rather than cloning a
// decorative attic onto every house. No terrain, movement or roof-run data
// is changed.
export function planSwordhavenDormers(runs, grid, center, wallHeight, eave = 0.22) {
  const output = [];
  for (const run of runs || []) {
    const { x, y, width } = run;
    if (width < 4) continue;
    const north = Array.from({ length: width }, (_, i) => grid[y - 1]?.[x + i])
      .filter(tile => tile === '.').length;
    const south = Array.from({ length: width }, (_, i) => grid[y + 1]?.[x + i])
      .filter(tile => tile === '.').length;
    if (!north && !south) continue;
    // Face an actual walkable street. Ties alternate reproducibly to avoid
    // making both rows of Swordhaven roofs look identical.
    const side = north === south
      ? ((x + y) % 2 === 0 ? 1 : -1)
      : (south > north ? 1 : -1);
    const slots = width >= 5 ? [1.15, width - 2.15] : [(width - 1) / 2];
    for (const slot of slots) {
      const z = side * 1.58;
      const baseY = wallHeight - 0.04 + 0.92 * (1 - Math.abs(z) / (2 + eave));
      output.push({
        x: (x + slot - center.x) * 4, y: baseY,
        z: (y - center.y) * 4 + z, side,
        variant: (x * 7 + y * 11 + Math.round(slot * 4)) % 3,
      });
    }
  }
  return output;
}

// Seven fixed, instanced batches, even as the town grows. Readable window
// tracery and a small drip sill are merged into one extra geometry/draw call.
// The existing seven roofs, roof palette, collisions and shaders are intact.
function dormerCasementGeometry() {
  // The old unframed 66cm glass patch disappeared at street viewing distance.
  // Leaded casement and oak sill live in the same instanced mesh, and exactly
  // follow the same local transform as the real glass.
  const mullion = new THREE.BoxGeometry(0.055, 0.50, 0.040);
  const transom = new THREE.BoxGeometry(0.82, 0.052, 0.040);
  transom.translate(0, 0.035, 0);
  const sill = new THREE.BoxGeometry(1.12, 0.105, 0.17);
  sill.translate(0, -0.33, 0.015);
  const pieces = [mullion, transom, sill];
  const merged = mergeGeometries(pieces, false);
  pieces.forEach(part => part.dispose());
  if (!merged) throw new Error('Swordhaven dormer casement could not be merged');
  return merged;
}
export function dressSwordhavenDormers(town, {
  runs, grid, center, wallHeight, eave = 0.22, timber, plaster, roofMaterial,
}) {
  if (!runs?.length || !timber || !plaster || !roofMaterial) return null;
  const placements = planSwordhavenDormers(runs, grid, center, wallHeight, eave);
  if (!placements.length) return null;
  const count = placements.length;
  const glass = new THREE.MeshStandardMaterial({
    // Blue-grey leaded glass contrasts with limewash without becoming
    // another fake glowing room/light source.
    color: 0x48565e, roughness: 0.53, metalness: 0.08,
    emissive: 0x19232a, emissiveIntensity: 0.08,
  });
  const front = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.47, 0.87, 0.12), plaster, count);
  const panes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.82, 0.50, 0.06), glass, count);
  const cheeks = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.10, 0.82, 1.18), timber, count * 2);
  const posts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.10, 0.65, 0.10), timber, count * 2);
  const lintels = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.96, 0.10, 0.13), timber, count * 2);
  const roof = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.85, 0.10, 1.35), roofMaterial, count * 2);
  const casements = new THREE.InstancedMesh(
    dormerCasementGeometry(), timber, count);
  const meshes = [front, panes, cheeks, posts, lintels, roof, casements];
  const names = [
    'chronicles-town-residential-dormer-plaster',
    'chronicles-town-residential-dormer-glass',
    'chronicles-town-residential-dormer-cheeks',
    'chronicles-town-residential-dormer-posts',
    'chronicles-town-residential-dormer-lintels',
    'chronicles-town-residential-dormer-pitched-roofs',
    'chronicles-town-residential-dormer-window-casements',
  ];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const variants = [0xdfcfb8, 0xcbc2b3, 0xceb3a4];
  placements.forEach((entry, index) => {
    const { x, y, z, side, variant } = entry;
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(x, y + 0.50, z);
    dummy.updateMatrix();
    front.setMatrixAt(index, dummy.matrix);
    front.setColorAt(index, color.setHex(variants[variant]));
    // The dark leaded window looks out onto the walkable frontage, not
    // into the roof. It has no light source and cannot be entered.
    dummy.position.set(x, y + 0.54, z + side * 0.092);
    dummy.updateMatrix();
    panes.setMatrixAt(index, dummy.matrix);
    // Sit just in front of the pane and under the original upper lintel.
    // Recessing the glass behind its wooden frame adds actual depth.
    dummy.position.set(x, y + 0.54, z + side * 0.16);
    dummy.updateMatrix();
    casements.setMatrixAt(index, dummy.matrix);
    for (const [i, dx] of [-1, 1].entries()) {
      dummy.position.set(x + dx * 0.66, y + 0.50, z - side * 0.50);
      dummy.updateMatrix();
      cheeks.setMatrixAt(index * 2 + i, dummy.matrix);
      dummy.position.set(x + dx * 0.43, y + 0.54, z + side * 0.14);
      dummy.updateMatrix();
      posts.setMatrixAt(index * 2 + i, dummy.matrix);
      dummy.rotation.z = -dx * Math.atan2(0.29, 0.68);
      dummy.position.set(x + dx * 0.36, y + 1.075,
        z - side * 0.28);
      dummy.updateMatrix();
      roof.setMatrixAt(index * 2 + i, dummy.matrix);
      roof.setColorAt(index * 2 + i, color.setHex(
        [0xffffff, 0xe2d4c5, 0xf3e0d2][variant]));
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, y + (i === 0 ? 0.85 : 0.20),
        z + side * 0.15);
      dummy.updateMatrix();
      lintels.setMatrixAt(index * 2 + i, dummy.matrix);
    }
  });
  meshes.forEach((mesh, index) => {
    mesh.name = names[index];
    mesh.userData.chroniclesDecorativeOnly = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // The six dormers span distant city blocks.
    town.add(mesh);
  });
  return { count, meshes };
}
