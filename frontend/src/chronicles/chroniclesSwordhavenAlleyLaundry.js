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
  const shading = new Float32Array(positions.count * 3);
  // Not banner rectangles: narrow sides towards the bottom, an uneven
  // hemline and two deep longitudinal folds. Per-vertex tonal variation
  // catches the existing daylight without textures or another draw call.
  const pleats = [0.94, 0.99, 0.89, 1, 0.93];
  const hem = [0.065, -0.035, 0.025, -0.075, 0.045];
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const column = i % 5;
    const drop = (0.49 - y) / 0.98;
    const edge = column === 0 ? 0.085 * drop
      : column === 4 ? -0.085 * drop : 0;
    const hemLift = y < -0.48 ? hem[column] : 0;
    positions.setXYZ(i,
      x + edge + 0.025 * Math.sin((y + 0.49) * Math.PI * 1.4),
      y + hemLift,
      0.12 * Math.sin((x + 0.45) / 0.9 * Math.PI * 2) * (0.6 + drop * 0.4)
        + 0.025 * Math.cos((y + 0.49) / 0.98 * Math.PI));
    const light = pleats[column] * (0.96 + (1 - drop) * 0.04);
    shading.set([light, light, light], i * 3);
  }
  fabric.setAttribute('color', new THREE.Float32BufferAttribute(shading, 3));
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
      color: 0xffffff, roughness: 0.97, side: THREE.DoubleSide, vertexColors: true,
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
      dummy.scale.set([0.88, 1.04, 0.94][piece], scale, 1);
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
