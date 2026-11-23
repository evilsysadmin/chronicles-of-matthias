import * as THREE from 'three';

// An exit is a contextual interaction, not a physical obstruction. Keep the
// opening legible and do not introduce colliders or change any map topology.
export function chroniclesExteriorExitKind(exitDefinition, lookupMap, originMap = null) {
  // Exiting a walled city is a city GATE even if the road outside is wild.
  if (originMap?.regionKind === 'settlement') return 'settlement';
  const destinationId = exitDefinition?.action?.effects?.find(
    (effect) => effect?.type === 'transition-map',
  )?.mapId;
  const destination = destinationId && typeof lookupMap === 'function'
    ? lookupMap(destinationId) : null;
  if (!destination || destination.id !== destinationId) return 'wilderness';
  if (destination.regionKind === 'settlement') return 'settlement';
  if (destination.regionKind === 'dungeon') return 'dungeon';
  return destination.biome === 'forest' ? 'forest' : 'wilderness';
}


// Return the solid perimeter cell directly beyond an exit's walkable tile.
// Purely visual: we never change the authored grid, saved positions or
// transition contracts. Special exits (sewer grates, caves) keep their art.
export function chroniclesTownWallPassage(entry, grid) {
  if (entry?.kind !== 'exit' || (entry.visualType && entry.visualType !== 'exit')) return null;
  const x = Number(entry?.position?.x);
  const y = Number(entry?.position?.y);
  const height = grid?.length || 0;
  const width = grid?.[0]?.length || 0;
  if (!Number.isInteger(x) || !Number.isInteger(y) || grid?.[y]?.[x] === '#') return null;
  const candidates = [
    { valid: y === 1, wallX: x, wallY: 0, yaw: 0 },
    { valid: x === width - 2, wallX: width - 1, wallY: y, yaw: -Math.PI / 2 },
    { valid: y === height - 2, wallX: x, wallY: height - 1, yaw: Math.PI },
    { valid: x === 1, wallX: 0, wallY: y, yaw: Math.PI / 2 },
  ];
  return candidates.find((candidate) =>
    candidate.valid && grid?.[candidate.wallY]?.[candidate.wallX] === '#') || null;
}

// Replaces only the visual wall tile with two massive masonry jambs and a
// supported lintel: the opening stays transparent all the way to the horizon.
export function buildChroniclesTownWallOpening(root, {
  wallHeight, stone, coarsePointer = false, depth = 3.96,
} = {}) {
  const openingTop = Math.min(4.12, wallHeight - 0.25);
  for (const side of [-1, 1]) {
    box(root, 'chronicles-town-gate-wall-jamb',
      [0.72, wallHeight, depth], [side * 1.64, wallHeight / 2 - 0.04, 0],
      stone, !coarsePointer);
  }
  if (wallHeight > openingTop) {
    box(root, 'chronicles-town-gate-wall-lintel',
      [2.56, wallHeight - openingTop, depth],
      [0, (wallHeight + openingTop) / 2 - 0.04, 0], stone, !coarsePointer);
  }
  root.userData.chroniclesTownGateOpeningWidth = 2.56;
  return root;
}


/**
 * Decorative ground and low, distant hills behind a town gate. Without this
 * small continuation the causeway appears to end in a flat blue void.
 * Coordinates are local to the exit: -Z always points outside the wall,
 * regardless of which perimeter edge owns the exit. The authored map remains
 * the sole authority for movement and interaction.
 */
export function buildChroniclesTownGateVista(root, { earth, coarsePointer = false } = {}) {
  if (!root?.isGroup || !earth?.isMaterial) return null;
  const vista = new THREE.Group();
  vista.name = 'chronicles-town-gate-outside-vista';
  vista.userData.chroniclesDecorativeOnly = true;

  // Extend the meadow below the existing stone causeway, not over its surface.
  const meadow = new THREE.Mesh(new THREE.BoxGeometry(26, 0.10, 28), earth);
  meadow.name = 'chronicles-town-gate-outer-meadow';
  meadow.position.set(0, -0.105, -19);
  meadow.receiveShadow = true;
  meadow.userData.chroniclesDecorativeOnly = true;
  vista.add(meadow);

  // Two restrained silhouettes, low enough to keep the sky and open gateway.
  // Shared geometry/material: three meshes total, including the meadow.
  const hillGeometry = new THREE.SphereGeometry(1, coarsePointer ? 10 : 16, 8);
  const hillMaterial = new THREE.MeshStandardMaterial({
    color: 0x839779, roughness: 1, flatShading: true,
  });
  for (const side of [-1, 1]) {
    const hill = new THREE.Mesh(hillGeometry, hillMaterial);
    hill.name = 'chronicles-town-gate-distant-hill';
    hill.position.set(side * 8.5, -0.35, -28);
    hill.scale.set(9.2, 2.7, 5.4);
    hill.receiveShadow = true;
    hill.userData.chroniclesDecorativeOnly = true;
    vista.add(hill);
  }
  root.add(vista);
  return vista;
}

function box(root, name, dimensions, position, surface, shadow = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), surface);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function column(root, name, position, topRadius, bottomRadius, height, surface, coarsePointer) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(topRadius, bottomRadius, height, coarsePointer ? 6 : 9),
    surface,
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = !coarsePointer;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function fortifiedGate(root, { style, stone, timber, plaque, coarsePointer, closedApproach = false }) {
  const dungeon = style === 'dungeon';
  const iron = new THREE.MeshStandardMaterial({
    color: dungeon ? 0x29272b : 0x4a4037, roughness: 0.58, metalness: 0.55,
  });
  const oak = new THREE.MeshStandardMaterial({
    color: dungeon ? 0x30251f : 0x65442d, roughness: 0.9,
  });
  // The city-side threshold stays open. Approaching a city from the wilds
  // instead shows a CLOSED gate: the player transitions by interacting, not by
  // walking through a transparent arch with forest visible behind it.
  for (const side of [-1, 1]) {
    box(root, 'chronicles-exit-gate-pier', [0.5, 3.03, 0.72],
      [side * 1.52, 1.515, 0], stone, !coarsePointer);
    box(root, 'chronicles-exit-gate-footing', [0.68, 0.29, 0.87],
      [side * 1.52, 0.145, 0], stone);
    box(root, 'chronicles-exit-gate-impost', [0.66, 0.2, 0.82],
      [side * 1.52, 2.94, 0], stone);

    if (!closedApproach) {
      // City-side exits remain visibly open, not phantom solid doors.
      const pivot = new THREE.Group();
      pivot.name = 'chronicles-exit-gate-open-hinge';
      pivot.position.set(side * 1.25, 0, 0.29);
      pivot.rotation.y = side * 1.15;
      const door = box(pivot, 'chronicles-exit-gate-open-leaf', [0.76, 2.4, 0.13],
        [-side * 0.38, 1.29, 0], oak, !coarsePointer);
      door.receiveShadow = true;
      for (const y of [0.47, 2.10]) {
        box(pivot, 'chronicles-exit-gate-iron-strap', [0.72, 0.075, 0.04],
          [-side * 0.38, y, 0.09], iron);
      }
      root.add(pivot);
    }
  }

  if (closedApproach) {
    // Seal the entire opening, including the curved space above the timber
    // leaves. Otherwise foliage still shows through the arch from the road.
    box(root, 'chronicles-exit-city-gate-solid-backing',
      [2.48, 3.85, 0.18], [0, 1.925, -0.20], iron);
    for (const side of [-1, 1]) {
      box(root, 'chronicles-exit-city-closed-leaf',
        [1.23, 3.20, 0.20], [side * 0.615, 1.60, 0.04], oak, !coarsePointer);
      for (const y of [0.48, 1.65, 2.86]) {
        box(root, 'chronicles-exit-city-iron-band',
          [1.19, 0.095, 0.055], [side * 0.615, y, 0.17], iron);
      }
      // Restrained hardware gives the player a legible sealed double door.
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.032, 6, 10), iron);
      ring.name = 'chronicles-exit-city-door-ring';
      ring.position.set(side * 0.22, 1.47, 0.20);
      root.add(ring);

      // Continuation of the city curtain wall, rather than a freestanding
      // portal. Mounted on the impassable perimeter, behind the exit tile.
      box(root, 'chronicles-exit-city-curtain-wall',
        [14.5, 4.15, 1.1], [side * 9.05, 2.075, -0.20], stone, !coarsePointer);
      box(root, 'chronicles-exit-city-wall-coping',
        [14.5, 0.20, 1.28], [side * 9.05, 4.20, -0.20], stone);
      for (let index = 0; index < 8; index += 1) {
        box(root, 'chronicles-exit-city-wall-merlon',
          [0.96, 0.55, 1.25], [side * (2.75 + index * 1.7), 4.50, -0.20], stone);
      }
    }
  }

  // Chunky voussoirs read as a true stone arch, not a flat crossbar.
  const segments = coarsePointer ? 5 : 7;
  for (let index = 0; index < segments; index += 1) {
    const angle = ((index + 0.5) / segments) * Math.PI;
    const archStone = box(root, 'chronicles-exit-gate-arch-stone',
      [0.73, 0.37, 0.75],
      [1.26 * Math.cos(angle), 2.93 + 0.91 * Math.sin(angle), 0],
      stone, !coarsePointer);
    archStone.rotation.z = angle + Math.PI / 2;
  }
  const crest = box(root, 'chronicles-exit-gate-keystone',
    [0.34, 0.4, 0.84], [0, 3.92, 0], dungeon ? iron : plaque);
  crest.rotation.z = Math.PI / 4;
  if (dungeon) {
    for (const side of [-1, 1]) {
      box(root, 'chronicles-exit-dungeon-iron-marker',
        [0.15, 0.34, 0.08], [side * 1.52, 2.27, 0.4], iron);
    }
  }
}
function forestTrail(root, { timber, coarsePointer }) {
  const leaves = new THREE.MeshStandardMaterial({
    color: 0x3c5a36, roughness: 1, flatShading: true,
  });
  const leafHighlight = new THREE.MeshStandardMaterial({
    color: 0x687b4a, roughness: 1, flatShading: true,
  });
  for (const side of [-1, 1]) {
    const trunk = column(root, 'chronicles-exit-forest-tree',
      [side * 1.56, 1.32, 0], 0.17, 0.3, 2.65, timber, coarsePointer);
    trunk.rotation.z = side * 0.11;
    const bough = column(root, 'chronicles-exit-forest-bough',
      [side * 1.05, 2.91, 0], 0.08, 0.15, 1.32, timber, coarsePointer);
    bough.rotation.z = side * 0.78;
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.66, 0), leaves,
    );
    crown.name = 'chronicles-exit-forest-canopy';
    crown.position.set(side * 0.87, 3.36, 0);
    root.add(crown);
    if (!coarsePointer) {
      const outer = new THREE.Mesh(new THREE.IcosahedronGeometry(0.54, 0), leafHighlight);
      outer.name = 'chronicles-exit-forest-canopy';
      outer.position.set(side * 1.35, 3.14, -0.12);
      root.add(outer);
    }
  }
  const canopy = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.56, 0), leafHighlight,
  );
  canopy.name = 'chronicles-exit-forest-canopy';
  canopy.position.set(0, 3.65, 0.03);
  root.add(canopy);
}

function wildernessTrail(root, { stone, timber, plaque, coarsePointer }) {
  // Trailhead, not another city arch: paired cairns and a single waymarker.
  for (const side of [-1, 1]) {
    const base = box(root, 'chronicles-exit-wild-cairn', [0.77, 0.48, 0.73],
      [side * 1.47, 0.24, 0], stone);
    base.rotation.y = side * 0.22;
    const upper = box(root, 'chronicles-exit-wild-cairn', [0.54, 0.37, 0.58],
      [side * 1.46, 0.65, -0.05], stone);
    upper.rotation.y = side * -0.31;
  }
  const stake = column(root, 'chronicles-exit-wild-waymarker',
    [1.47, 1.45, 0.02], 0.095, 0.13, 1.58, timber, coarsePointer);
  stake.rotation.z = -0.06;
  const pointer = box(root, 'chronicles-exit-wild-direction-plank', [1.14, 0.3, 0.1],
    [1.04, 1.98, 0.12], timber);
  pointer.rotation.z = -0.09;
  box(root, 'chronicles-exit-wild-waymarker-inlay', [0.3, 0.16, 0.045],
    [0.96, 1.99, 0.19], plaque);
}

export function buildChroniclesExteriorExit(root, {
  style = 'wilderness', stone, timber, plaque, coarsePointer = false,
  closedApproach = false,
} = {}) {
  root.userData.chroniclesExitGatewayStyle = style;
  if (style === 'settlement' && closedApproach) {
    // The exit cell stays walkable. The decorative fortification sits at the
    // adjacent blocked perimeter boundary, not across a traversable street.
    const fortification = new THREE.Group();
    fortification.name = 'chronicles-exit-city-approach-fortification';
    fortification.position.z = -2;
    fortification.userData.chroniclesDecorativeOnly = true;
    fortifiedGate(fortification, {
      style, stone, timber, plaque, coarsePointer, closedApproach: true,
    });
    root.add(fortification);
  } else if (style === 'settlement' || style === 'dungeon') {
    fortifiedGate(root, { style, stone, timber, plaque, coarsePointer });
  } else if (style === 'forest') {
    forestTrail(root, { timber, coarsePointer });
  } else {
    wildernessTrail(root, { stone, timber, plaque, coarsePointer });
  }
  return root;
}
