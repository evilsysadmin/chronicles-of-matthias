import * as THREE from 'three';

// Close-up foliage is geometry, not billboard art. Each planter uses only four
// InstancedMeshes regardless of how many leaves, blossoms or hanging stems it
// contains; geometry ownership stays per building for safe Three.js disposal.
function leafGeometry() {
  // Pointed, gently folded leaf silhouette. The raised midrib catches warm
  // sunlight; the edges are not spheres or obvious rectangular cards.
  const ring = [
    [0, -0.16, 0], [-0.10, -0.08, 0.02], [-0.145, 0.03, 0.03],
    [-0.115, 0.13, 0.02], [0, 0.24, 0], [0.115, 0.13, 0.02],
    [0.145, 0.03, 0.03], [0.10, -0.08, 0.02],
  ];
  const vertices = [];
  for (let i = 0; i < ring.length; i += 1) {
    vertices.push(...ring[i], ...ring[(i + 1) % ring.length], 0, 0.035, 0.075);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function flowerGeometry() {
  // Five subtly cupped petals per flower, batched as one mesh instance.
  const vertices = [];
  for (let petal = 0; petal < 5; petal += 1) {
    const angle = petal * Math.PI * 2 / 5;
    const point = (distance, offset, depth) => [
      Math.cos(angle + offset) * distance,
      Math.sin(angle + offset) * distance,
      depth,
    ];
    const base = point(0.025, 0, 0.03);
    const left = point(0.115, -0.43, 0.055);
    const tip = point(0.174, 0, 0.025);
    const right = point(0.115, 0.43, 0.055);
    vertices.push(...base, ...left, ...tip, ...base, ...tip, ...right);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const leafTones = [0x658e4c, 0x83a85d, 0x486d3b, 0x9ab870, 0x557c43, 0x769b50];
const petalTones = [0xf6eee0, 0xd96775, 0xf6cb83, 0xf4dce5, 0xe87969];

// Purely decorative, deterministic positions inside the authored facade.
// Never used by the walk grid, raycast interactions or saves.
export function dressSwordhavenWindowBoxes(root, { windowXs, facadeZ, coarse, mats }) {
  const crownPerWindow = coarse ? 12 : 24;
  const vinePerWindow = coarse ? 3 : 5;
  const flowersPerWindow = coarse ? 5 : 8;
  const leavesPerWindow = crownPerWindow + vinePerWindow * 2;
  const leaves = new THREE.InstancedMesh(
    leafGeometry(), mats.planterLeaves, windowXs.length * leavesPerWindow,
  );
  const flowers = new THREE.InstancedMesh(
    flowerGeometry(), mats.planterPetals, windowXs.length * flowersPerWindow,
  );
  const centers = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.036, coarse ? 5 : 7, coarse ? 4 : 6),
    mats.planterCenters, flowers.count,
  );
  const trailing = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.007, 0.013, 1, coarse ? 4 : 5),
    mats.planterStems, windowXs.length * vinePerWindow,
  );
  leaves.name = 'window-box-leaf-clusters';
  flowers.name = 'window-box-blooms';
  centers.name = 'window-box-flower-centers';
  trailing.name = 'window-box-trailing-stems';
  const instances = [leaves, flowers, centers, trailing];
  for (const instance of instances) {
    instance.userData.chroniclesDecorativeOnly = true;
    instance.castShadow = false; // No dozens of tiny caster surfaces.
    instance.receiveShadow = false;
    root.add(instance);
  }
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  windowXs.forEach((centerX, windowIndex) => {
    const baseLeaf = windowIndex * leavesPerWindow;
    // A staggered crown behind the flowers, varied without runtime RNG.
    for (let i = 0; i < crownPerWindow; i += 1) {
      const row = Math.floor(i / (coarse ? 6 : 8));
      const columns = coarse ? 6 : 8;
      const column = i % columns;
      const drift = Math.sin(i * 2.37 + windowIndex * 1.9) * 0.055;
      dummy.position.set(
        centerX + (column - (columns - 1) / 2) * (coarse ? 0.218 : 0.167) + drift,
        2.13 + row * 0.105 + (i % 3) * 0.018,
        facadeZ + 0.80 + (i % 3) * 0.014,
      );
      dummy.rotation.set(0.09 * (i % 3 - 1), 0, (i % 5 - 2) * 0.29);
      dummy.scale.setScalar(0.67 + (i % 4) * 0.12);
      dummy.updateMatrix();
      leaves.setMatrixAt(baseLeaf + i, dummy.matrix);
      leaves.setColorAt(baseLeaf + i, tint.setHex(leafTones[(i + windowIndex * 2) % leafTones.length]));
    }
    // Trailing vines spill over the FRONT of the stone flower box, rather
    // than following the regular crown rows or becoming a new floor blocker.
    for (let vine = 0; vine < vinePerWindow; vine += 1) {
      const lateral = (vine - (vinePerWindow - 1) / 2) * (coarse ? 0.42 : 0.29);
      const stemLength = 0.34 + (vine % 3) * 0.08;
      const z = facadeZ + 0.842;
      const x = centerX + lateral;
      dummy.rotation.set(0, 0, (vine % 2 ? 1 : -1) * 0.07);
      dummy.scale.set(1, stemLength, 1);
      dummy.position.set(x, 1.96 - stemLength * 0.5, z);
      dummy.updateMatrix();
      trailing.setMatrixAt(windowIndex * vinePerWindow + vine, dummy.matrix);
      for (let blade = 0; blade < 2; blade += 1) {
        const index = baseLeaf + crownPerWindow + vine * 2 + blade;
        dummy.position.set(x + (blade ? 0.075 : -0.075),
          1.86 - blade * 0.16 - (vine % 3) * 0.045, z + 0.02);
        dummy.rotation.set(0, 0, (blade ? 1 : -1) * (0.74 + vine * 0.06));
        dummy.scale.setScalar(0.60 + (vine % 3) * 0.09);
        dummy.updateMatrix();
        leaves.setMatrixAt(index, dummy.matrix);
        leaves.setColorAt(index, tint.setHex(leafTones[(vine + blade + windowIndex + 2) % leafTones.length]));
      }
    }
    // Sparse, uneven flowers with real pointed petals and distinct gold
    // stamens; never a regular row of opaque spheres.
    for (let flower = 0; flower < flowersPerWindow; flower += 1) {
      const index = windowIndex * flowersPerWindow + flower;
      const x = centerX + (flower - (flowersPerWindow - 1) / 2) * (coarse ? 0.23 : 0.165)
        + Math.sin(flower * 2.17 + windowIndex) * 0.035;
      const y = 2.35 + (flower % 3) * 0.065;
      const z = facadeZ + 0.87 + (flower % 2) * 0.035;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, (flower % 5) * 0.33);
      dummy.scale.setScalar(0.67 + (flower % 3) * 0.13);
      dummy.updateMatrix();
      flowers.setMatrixAt(index, dummy.matrix);
      flowers.setColorAt(index, tint.setHex(petalTones[(flower + windowIndex * 2) % petalTones.length]));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(x, y, z + 0.059);
      dummy.updateMatrix();
      centers.setMatrixAt(index, dummy.matrix);
    }
  });
  for (const instance of instances) {
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
  }
  return { leaves, flowers, centers, trailing };
}
