import * as THREE from 'three';

// Swordhaven's authored south-ward roof runs already own the triangle mesh.
// These three instanced batches supply visible oak eaves, ridge beams and
// sloping verge boards without inventing buildings or changing walkable cells.
export function dressSwordhavenRoofRuns(town, {
  runs, center, wallHeight, eave = 0.22, timber,
}) {
  if (!runs?.length || !timber) return null;
  const CELL = 4;
  const roofDepth = CELL + eave * 2;
  const rise = 0.92;
  const pitch = Math.atan2(rise, roofDepth / 2);
  const vergeLength = Math.hypot(roofDepth / 2, rise);
  const eaves = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL, 0.18, 0.20), timber, runs.length * 2);
  const ridges = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL, 0.17, 0.19), timber, runs.length);
  const verges = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.15, 0.17, vergeLength), timber, runs.length * 4);
  eaves.name = 'chronicles-town-south-roof-oak-eaves';
  ridges.name = 'chronicles-town-south-roof-oak-ridges';
  verges.name = 'chronicles-town-south-roof-oak-verges';

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (const [i, { x, y, width }] of runs.entries()) {
    const wx = (x + (width - 1) / 2 - center.x) * CELL;
    const wz = (y - center.y) * CELL;
    const span = width * CELL + eave * 2;
    // Match the existing pitched roof exactly, including its half-tile
    // centre: shifting these pieces even 20cm would cause detached beams.
    dummy.scale.set(span / CELL, 1, 1);
    dummy.rotation.set(0, 0, 0);
    const roofBaseY = wallHeight - 0.04;
    const color = [0xffffff, 0xe9ddc7, 0xd4c7b6][(x + y + width) % 3];
    for (const [sideIndex, side] of [-1, 1].entries()) {
      dummy.position.set(wx, roofBaseY + 0.015, wz + side * roofDepth / 2);
      dummy.updateMatrix();
      eaves.setMatrixAt(i * 2 + sideIndex, dummy.matrix);
      eaves.setColorAt(i * 2 + sideIndex, tint.setHex(color));
    }
    dummy.position.set(wx, roofBaseY + rise + 0.035, wz);
    dummy.updateMatrix();
    ridges.setMatrixAt(i, dummy.matrix);
    ridges.setColorAt(i, tint.setHex(color));
    // Both roof ends, both slope halves. Rotation follows the true pitch,
    // not a manually guessed angle. A shallow wooden bargeboard covers the
    // gable edge without covering windows or the lower storey.
    dummy.scale.set(1, 1, 1);
    for (const [endIndex, end] of [-1, 1].entries()) {
      for (const [sideIndex, side] of [-1, 1].entries()) {
        const index = i * 4 + endIndex * 2 + sideIndex;
        dummy.position.set(wx + end * (span / 2 - 0.05),
          roofBaseY + rise / 2 + 0.035, wz + side * roofDepth / 4);
        dummy.rotation.set(side * pitch, 0, 0);
        dummy.updateMatrix();
        verges.setMatrixAt(index, dummy.matrix);
        verges.setColorAt(index, tint.setHex(color));
      }
    }
  }
  for (const part of [eaves, ridges, verges]) {
    part.instanceMatrix.needsUpdate = true;
    part.instanceColor.needsUpdate = true;
    part.castShadow = false;
    part.receiveShadow = true;
    part.frustumCulled = false; // Instances span separate town blocks.
    part.userData.chroniclesDecorativeOnly = true;
    town.add(part);
  }
  return { eaves, ridges, verges };
}
