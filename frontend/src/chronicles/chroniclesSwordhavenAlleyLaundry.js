import * as THREE from 'three';

// Laundry belongs only to the four narrow, authored residential passages.
// Validate both masonry anchors and both walkable approaches against the
// canonical map so a future map edit cannot leave washing suspended in air.
const SWORDHAVEN_ALLEY_LINES = Object.freeze([3, 6, 12, 15].map(x => ({ x, y: 18 })));

export function planSwordhavenAlleyLaundry(grid) {
  return SWORDHAVEN_ALLEY_LINES.filter(({ x, y }) =>
    grid?.[y]?.[x] === '.'
    && grid[y]?.[x - 1] === '#' && grid[y]?.[x + 1] === '#'
    && grid[y - 1]?.[x] === '.' && grid[y + 1]?.[x] === '.');
}

function hangingLinenGeometry() {
  // An irregularly folded sheet rather than a flat rectangular billboard.
  // Each small vertex bend is static: no animation or per-frame CPU work.
  const fabric = new THREE.PlaneGeometry(0.9, 0.98, 4, 5);
  const positions = fabric.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    positions.setXYZ(i,
      x + 0.035 * Math.sin((y + 0.49) * Math.PI * 1.4),
      y,
      0.045 * Math.sin((x + 0.45) / 0.9 * Math.PI * 2)
        + 0.025 * Math.cos((y + 0.49) / 0.98 * Math.PI));
  }
  positions.needsUpdate = true;
  fabric.computeVertexNormals();
  fabric.computeBoundingBox();
  fabric.computeBoundingSphere();
  return fabric;
}

export function dressSwordhavenAlleyLaundry(town, { grid, center }) {
  const passages = planSwordhavenAlleyLaundry(grid);
  if (!passages.length) return null;
  const ropeHeight = 3.90;
  const ropes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.90, 0.027, 0.027),
    new THREE.MeshStandardMaterial({ color: 0x77634f, roughness: 1 }),
    passages.length);
  ropes.name = 'chronicles-town-alley-laundry-ropes';
  const cloths = new THREE.InstancedMesh(
    hangingLinenGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.97, side: THREE.DoubleSide,
    }),
    passages.length * 3);
  cloths.name = 'chronicles-town-alley-hanging-linen';
  const palette = [0xd3c4a6, 0xa7b6aa, 0xc19b89, 0x819cab, 0xc7b5a0];
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (const [index, { x, y }] of passages.entries()) {
    const wx = (x - center.x) * 4;
    const wz = (y - center.y) * 4;
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(wx, ropeHeight, wz);
    dummy.updateMatrix();
    ropes.setMatrixAt(index, dummy.matrix);
    for (const [piece, offset] of [-1.12, 0, 1.12].entries()) {
      const scale = [0.89, 1.04, 0.95][(index + piece) % 3];
      dummy.scale.set(1, scale, 1);
      dummy.position.set(wx + offset,
        ropeHeight - 0.49 * scale, wz + (piece % 2 === 0 ? 0.02 : -0.02));
      dummy.updateMatrix();
      const slot = index * 3 + piece;
      cloths.setMatrixAt(slot, dummy.matrix);
      cloths.setColorAt(slot, tint.setHex(palette[(index * 2 + piece) % palette.length]));
    }
  }
  for (const part of [ropes, cloths]) {
    part.userData.chroniclesDecorativeOnly = true;
    part.castShadow = false;
    part.receiveShadow = true;
    part.frustumCulled = false;
    part.instanceMatrix.needsUpdate = true;
    if (part.instanceColor) part.instanceColor.needsUpdate = true;
    town.add(part);
  }
  return { ropeCount: ropes.count, clothCount: cloths.count };
}
