import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { settlementHouseBlocks, settlementHouseFacing } from './chroniclesSettlementLayout.js';
import {
  addSwordhavenClouds, buildSwordhavenFountain, buildSwordhavenHouse, buildSwordhavenTree, createSwordhavenMaterials,
  createSwordhavenSkyDome, swordhavenGrassTexture, swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture,
} from './chroniclesSwordhaven3D.js';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';
import { buildChroniclesEnemyVisual } from '../chroniclesEnemyVisualRegistry.js';
import { buildChroniclesSpriteBillboard, chroniclesHasSpriteBillboard } from './chroniclesSpriteBillboards.js';
import { buildChroniclesTownNoticeBoard } from './chroniclesTownNoticeBoard3D.js';
import { dressSwordhavenStreetWindows } from './chroniclesSwordhavenStreetDressing.js';
import { dressSwordhavenRoofRuns } from './chroniclesSwordhavenRoofTrim.js';
import { dressSwordhavenDormers } from './chroniclesSwordhavenDormers.js';
import { TERRA_SCENERY_MARGIN, buildTerraScenery, chroniclesTerraSceneryBiomes } from './chroniclesTerraScenery.js';

// File-authored exterior topology: no independent collision map or invisible
// decorative blockers. Impassable cells alone own boulders/low walls; every
// roadway slab lies flush on an already-walkable authored tile.
const CELL = 4;
const material = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.94, metalness: 0.02, ...opts,
});
function gridToWorld(x, y, center) {
  return [(x - center.x) * CELL, (y - center.y) * CELL];
}

function visibleRoadCells(scenePlan, center) {
  const saved = scenePlan?.landscape?.roadCells;
  if (Array.isArray(saved)) return saved.filter(p => p && Number.isInteger(p.x) && Number.isInteger(p.y));
  // Swordhaven's new wards are winding streets, not two straight axes.
  // Cobble every authored walkable cell with the SAME instanced road mesh:
  // no independent obstacle mask and no extra draw calls per alley.
  // Explicit landscape.roadCells above still takes precedence.
  // Other maps keep their existing main-axis fallback.
  const swordhavenStreets = scenePlan.mapId === 'swordhaven-first-book'
    && scenePlan.regionKind === 'settlement';
  const out = [];
  (scenePlan.grid || []).forEach((row, y) => {
    [...row].forEach((tile, x) => {
      if (tile !== '#'
        && (swordhavenStreets || x === center.x || y === center.y)
      ) out.push({ x, y });
    });
  });
  return out;
}

// Draw a handful of windowed timber fronts on existing blocked street walls.
// The wall grid remains the ONLY collision source; these shallow details sit
// entirely inside its solid cells. All frames and panes share two instanced
// meshes, not dozens of per-house objects or lights.
// Street-front decoration shares one deterministic face list so windows and
// timber framing cannot drift onto solid interiors or invent colliders.
function settlementStreetFacingFaces({ grid, blocked, zones }) {
  const validZones = (Array.isArray(zones) ? zones : []).filter(zone =>
    zone?.style === 'timber-windows'
    && [zone.minX, zone.maxX, zone.minY, zone.maxY].every(Number.isInteger)
    && zone.minX <= zone.maxX && zone.minY <= zone.maxY);
  if (!validZones.length) return [];
  const directions = [
    { dx: 0, dy: 1, yaw: 0 },
    { dx: 1, dy: 0, yaw: Math.PI / 2 },
    { dx: 0, dy: -1, yaw: Math.PI },
    { dx: -1, dy: 0, yaw: -Math.PI / 2 },
  ];
  const faces = [];
  for (const { x, y } of blocked) {
    if (!validZones.some(zone =>
      x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY)) continue;
    for (const direction of directions) {
      if (grid[y + direction.dy]?.[x + direction.dx] === '.') {
        faces.push({ x, y, ...direction });
      }
    }
  }
  return faces;
}

// One instanced frame owns the complete window silhouette: a projecting sill,
// leaded-glass dividers and open timber shutters with diagonal braces.
// Merge once rather than adding per-window meshes/draw calls. Every detail
// stays inside the impassable 4m cell (never over the walking lane).
function settlementWindowFrameGeometry() {
  const frame = new THREE.BoxGeometry(1.32, 0.84, 0.022);
  const sill = new THREE.BoxGeometry(1.46, 0.10, 0.030);
  sill.translate(0, -0.46, 0.010);
  const mullion = new THREE.BoxGeometry(0.048, 0.52, 0.008);
  mullion.translate(0, 0.02, 0.022);
  const transom = new THREE.BoxGeometry(0.77, 0.045, 0.008);
  transom.translate(0, 0.02, 0.022);
  const parts = [frame, sill, mullion, transom];
  // Three separated planks read as real open shutters even on a phone.
  // Their diagonal braces sit just proud of the wood, still inside the wall
  // cell. All eight additions reuse the existing frame draw call.
  for (const side of [-1, 1]) {
    for (const y of [-0.235, 0, 0.235]) {
      const plank = new THREE.BoxGeometry(0.25, 0.22, 0.020);
      plank.translate(side * 0.87, y, 0.010);
      parts.push(plank);
    }
    const brace = new THREE.BoxGeometry(0.060, 0.67, 0.008);
    brace.rotateZ(side * 0.22);
    brace.translate(side * 0.87, 0, 0.021);
    parts.push(brace);
  }
  const geometry = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error('Swordhaven window frame geometry could not be merged');
  return geometry;
}

function addSettlementStreetFacades(town, { grid, blocked, center, zones, wallHeight = 1.6 }) {
  // Windows alternate along the block; timber beams cover every street edge.
  const facades = settlementStreetFacingFaces({ grid, blocked, zones })
    .filter(({ x, y }) => (x + y) % 2 === 0);
  if (!facades.length) return;
  // Two levels on tall authored houses, with the original single window
  // preserved for older settlements. Still just two instanced draw calls.
  const storeys = wallHeight >= 4 ? [2.15, 4.45] : [0.96];
  const count = facades.length * storeys.length;
  const frames = new THREE.InstancedMesh(
    settlementWindowFrameGeometry(),
    material(0x78533b),
    count,
  );
  const panes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.77, 0.52, 0.014),
    material(0x34444b, { metalness: 0.07, roughness: 0.8 }),
    count,
  );
  const dummy = new THREE.Object3D();
  facades.forEach(({ x, y, dx, dy, yaw }, faceIndex) => {
    const [wx, wz] = gridToWorld(x, y, center);
    dummy.rotation.y = yaw;
    storeys.forEach((windowY, storeyIndex) => {
      const index = faceIndex * storeys.length + storeyIndex;
      dummy.position.set(wx + dx * 1.972, windowY, wz + dy * 1.972);
      dummy.updateMatrix();
      frames.setMatrixAt(index, dummy.matrix);
      dummy.position.set(wx + dx * 1.988, windowY + 0.02, wz + dy * 1.988);
      dummy.updateMatrix();
      panes.setMatrixAt(index, dummy.matrix);
    });
  });
  frames.instanceMatrix.needsUpdate = true;
  panes.instanceMatrix.needsUpdate = true;
  frames.name = 'chronicles-town-street-window-frames';
  panes.name = 'chronicles-town-street-window-panes';
  frames.castShadow = false;
  panes.castShadow = false;
  town.add(frames, panes);
}

// Make long medieval facades read as TWO inhabited storeys instead of a
// single monotonous wall. The existing oak band at 3.25m separates muted,
// weathered ground-floor limewash from paler upper-floor plaster. Both floors
// share ONE instanced mesh, the original stucco atlas, and the same world
// face depth: no extra draw call, light, collision or walkable obstruction.
function addSettlementPlasterFrontages(town, { grid, blocked, center, zones, wallHeight }) {
  if (wallHeight < 4) return;
  const faces = settlementStreetFacingFaces({ grid, blocked, zones });
  if (!faces.length) return;
  // Keep the real masonry plinth below 0.29m and parapet above wallHeight
  // - 0.25m visible. The oak storey beam covers the 3.18–3.33m seam.
  const seam = 3.25;
  const layers = [
    { bottom: 0.29, top: seam - 0.07 },
    { bottom: seam + 0.08, top: wallHeight - 0.25 },
  ];
  const panels = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL * 0.935, 1, 0.012),
    material(0xffffff, {
      map: swordhavenSurfaceTexture('stucco'),
      normalMap: swordhavenSurfaceNormalTexture('stucco'),
      normalScale: new THREE.Vector2(0.50, 0.50), roughness: 0.97,
    }),
    faces.length * layers.length,
  );
  const dummy = new THREE.Object3D();
  const groundLime = [
    new THREE.Color('#c6b398'),
    new THREE.Color('#b9a68e'),
    new THREE.Color('#d1bda4'),
  ];
  const upperLime = [
    new THREE.Color('#e5d4b9'),
    new THREE.Color('#d8c6af'),
    new THREE.Color('#ecdbc3'),
  ];
  faces.forEach(({ x, y, dx, dy, yaw }, i) => {
    const [wx, wz] = gridToWorld(x, y, center);
    const houseShade = (Math.floor(x / 3) + Math.floor(y / 2)) % groundLime.length;
    for (const [floor, { bottom, top }] of layers.entries()) {
      const index = i * layers.length + floor;
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, top - bottom, 1);
      dummy.position.set(wx + dx * 1.974, (bottom + top) / 2, wz + dy * 1.974);
      dummy.updateMatrix();
      panels.setMatrixAt(index, dummy.matrix);
      panels.setColorAt(index, (floor === 0 ? groundLime : upperLime)[houseShade]);
    }
  });
  panels.instanceMatrix.needsUpdate = true;
  panels.instanceColor.needsUpdate = true;
  panels.name = 'chronicles-town-street-limewash-fronts';
  panels.castShadow = false;
  panels.receiveShadow = true;
  panels.userData.chroniclesDecorativeOnly = true;
  town.add(panels);
}

// Low-cost half-timbered framing turns high masonry street blockers into
// recognizable house fronts. Continuous storey beams and upright timbers sit
// on the solid side of every authored street-facing wall. Two shared batches,
// never a mesh per facade, and no geometry touches the walkable floor.
function addSettlementTimberFrontages(town, { grid, blocked, center, zones, wallHeight }) {
  if (wallHeight < 4) return;
  const faces = settlementStreetFacingFaces({ grid, blocked, zones });
  if (!faces.length) return;
  // Wherever two street-facing walls meet, reinforce their common corner.
  // Reuse the upright InstancedMesh rather than creating a draw call per turn.
  const byCell = new Map();
  for (const face of faces) {
    const key = face.x + ',' + face.y;
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(face);
  }
  const cornerJoints = [];
  for (const cellFaces of byCell.values()) {
    for (let i = 0; i < cellFaces.length; i += 1) {
      for (let j = i + 1; j < cellFaces.length; j += 1) {
        const a = cellFaces[i];
        const b = cellFaces[j];
        if (a.dx * b.dx + a.dy * b.dy !== 0) continue;
        cornerJoints.push({
          x: a.x, y: a.y, dx: a.dx + b.dx, dy: a.dy + b.dy,
        });
      }
    }
  }
  // Not every blind bay is a blind wall: a handful are closed domestic
  // entrances. Reserve these BEFORE placing diagonals so no timber brace
  // crosses a door. Stable face ordering avoids per-load randomness.
  const blankFaces = faces.filter(({ x, y }) => (x + y) % 2 !== 0);
  const doorFaces = blankFaces.filter((_, index) => index % 5 === 3);
  const bracedFaces = blankFaces.filter((_, index) => index % 5 !== 3);
  const wood = material(0x66503a, { roughness: 0.93 });
  const beams = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL * 0.92, 0.15, 0.04), wood, faces.length * 2,
  );
  const posts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.13, wallHeight - 0.48, 0.04), wood,
    faces.length * 2 + cornerJoints.length + bracedFaces.length * 2,
  );
  const dummy = new THREE.Object3D();
  faces.forEach(({ x, y, dx, dy, yaw }, faceIndex) => {
    const [wx, wz] = gridToWorld(x, y, center);
    dummy.rotation.y = yaw;
    for (const [band, elevation] of [3.25, wallHeight - 0.21].entries()) {
      dummy.position.set(wx + dx * 1.973, elevation, wz + dy * 1.973);
      dummy.updateMatrix();
      beams.setMatrixAt(faceIndex * 2 + band, dummy.matrix);
    }
    for (const [index, side] of [-1, 1].entries()) {
      const sideways = 1.70 * side;
      dummy.position.set(
        wx + dx * 1.973 + Math.cos(yaw) * sideways,
        wallHeight / 2 - 0.04,
        wz + dy * 1.973 - Math.sin(yaw) * sideways,
      );
      dummy.updateMatrix();
      posts.setMatrixAt(faceIndex * 2 + index, dummy.matrix);
    }
  });
  // Corner joints have a square cross-section and sit on the blocking
  // cell side: their furthest edge remains at 1.995m of the 2m half-cell.
  cornerJoints.forEach(({ x, y, dx, dy }, i) => {
    const [wx, wz] = gridToWorld(x, y, center);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 3.25); // 0.13m square corner timber.
    dummy.position.set(wx + dx * 1.93, wallHeight / 2 - 0.04, wz + dy * 1.93);
    dummy.updateMatrix();
    posts.setMatrixAt(faces.length * 2 + i, dummy.matrix);
  });
  // Mirror a pair of short diagonal braces on each blind frontage. Reuse the
  // existing upright geometry, material and draw call via scaled instances.
  // The 4cm-deep timber stays entirely on the blocked side of the tile.
  bracedFaces.forEach(({ x, y, dx, dy, yaw }, faceIndex) => {
    const [wx, wz] = gridToWorld(x, y, center);
    for (const [sideIndex, side] of [-1, 1].entries()) {
      // Structural A-braces: meet the storey beam at the centre and
      // finish by the lower upright/plinth, never floating mid-wall.
      const sideways = side * 0.85;
      dummy.rotation.set(0, yaw, 0);
      dummy.rotateZ(side * 0.52);
      dummy.scale.set(1, 0.55, 1);
      dummy.position.set(
        wx + dx * 1.973 + Math.cos(yaw) * sideways,
        1.84,
        wz + dy * 1.973 - Math.sin(yaw) * sideways,
      );
      dummy.updateMatrix();
      posts.setMatrixAt(faces.length * 2 + cornerJoints.length + faceIndex * 2 + sideIndex, dummy.matrix);
    }
  });
  beams.instanceMatrix.needsUpdate = true;
  posts.instanceMatrix.needsUpdate = true;
  beams.name = 'chronicles-town-timber-storey-beams';
  posts.name = 'chronicles-town-timber-uprights';
  beams.castShadow = false;
  posts.castShadow = false;
  town.add(beams, posts);
  addSettlementResidentialDoors(town, { doorFaces, center });
}

// Closed oak doors make intermittent blank bays read as inhabited homes,
// without introducing false interaction targets or touching the authored grid.
// All doors share THREE instanced batches rather than one mesh per house.
function addSettlementResidentialDoors(town, { doorFaces, center }) {
  if (!doorFaces.length) return;
  const doorHeight = 1.46;
  const panel = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.16, 2.22, 0.014),
    material(0x453122, { roughness: 0.96 }), doorFaces.length);
  panel.name = 'chronicles-town-residential-door-panels';
  const frameParts = [];
  for (const side of [-1, 1]) {
    const jamb = new THREE.BoxGeometry(0.15, 2.38, 0.016);
    jamb.translate(side * 0.66, 0, 0);
    frameParts.push(jamb);
  }
  const lintel = new THREE.BoxGeometry(1.47, 0.15, 0.018);
  lintel.translate(0, 1.24, 0);
  frameParts.push(lintel);
  const threshold = new THREE.BoxGeometry(1.47, 0.10, 0.018);
  threshold.translate(0, -1.19, 0);
  frameParts.push(threshold);
  const frameGeometry = mergeGeometries(frameParts, false);
  frameParts.forEach(part => part.dispose());
  if (!frameGeometry) throw new Error('Swordhaven residential door frame could not be merged');
  const frames = new THREE.InstancedMesh(
    frameGeometry, material(0x896747, { roughness: 0.94 }), doorFaces.length);
  frames.name = 'chronicles-town-residential-door-frames';
  const knockers = new THREE.InstancedMesh(
    new THREE.RingGeometry(0.066, 0.093, 12),
    material(0xb9a17c, { metalness: 0.48, roughness: 0.58, side: THREE.DoubleSide }),
    doorFaces.length);
  knockers.name = 'chronicles-town-residential-door-knockers';
  const dummy = new THREE.Object3D();
  doorFaces.forEach(({ x, y, dx, dy, yaw }, index) => {
    const [wx, wz] = gridToWorld(x, y, center);
    dummy.rotation.set(0, yaw, 0);
    dummy.position.set(wx + dx * 1.983, doorHeight, wz + dy * 1.983);
    dummy.updateMatrix();
    panel.setMatrixAt(index, dummy.matrix);
    dummy.position.set(wx + dx * 1.988, doorHeight, wz + dy * 1.988);
    dummy.updateMatrix();
    frames.setMatrixAt(index, dummy.matrix);
    // The ring lies just beyond the oak front but still within the 2m
    // blocked half-cell. It cannot create an invisible street obstruction.
    dummy.position.set(wx + dx * 1.998 + Math.cos(yaw) * 0.34,
      doorHeight, wz + dy * 1.998 - Math.sin(yaw) * 0.34);
    dummy.updateMatrix();
    knockers.setMatrixAt(index, dummy.matrix);
  });
  for (const batch of [panel, frames, knockers]) {
    batch.instanceMatrix.needsUpdate = true;
    batch.castShadow = false;
    batch.receiveShadow = true;
    batch.userData.chroniclesDecorativeOnly = true;
    town.add(batch);
  }
}

// Sparse district landmarks on EXISTING wall cells. Shallow fixtures sit
// wholly inside blocked 4m cells and cannot alter the walkable grid. Three
// instanced meshes cover all sconces; emissive amber glass adds no point lights.
function addSettlementWallLanterns(town, { grid, blocked, center, placements }) {
  if (!Array.isArray(placements) || !placements.length) return;
  const directions = {
    north: { dx: 0, dy: -1, yaw: Math.PI },
    east: { dx: 1, dy: 0, yaw: Math.PI / 2 },
    south: { dx: 0, dy: 1, yaw: 0 },
    west: { dx: -1, dy: 0, yaw: -Math.PI / 2 },
  };
  const blockedCells = new Set(blocked.map(({ x, y }) => x + ',' + y));
  const seen = new Set();
  const valid = [];
  for (const placement of placements.slice(0, 12)) {
    const { x, y, side } = placement || {};
    const facing = directions[side];
    const id = x + ',' + y + ',' + side;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !facing
      || !blockedCells.has(x + ',' + y) || seen.has(id)
      || grid[y + facing.dy]?.[x + facing.dx] !== '.') continue;
    seen.add(id);
    valid.push({ x, y, ...facing });
  }
  if (!valid.length) return;
  const iron = material(0x514032, { metalness: 0.43, roughness: 0.53 });
  const amber = material(0xf2b967, {
    emissive: 0x98521b, emissiveIntensity: 0.7, roughness: 0.36,
  });
  const mounts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.22, 0.95, 0.035), iron, valid.length,
  );
  const glass = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.38, 0.46, 0.035), amber, valid.length,
  );
  const caps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.54, 0.1, 0.035), iron, valid.length,
  );
  const dummy = new THREE.Object3D();
  valid.forEach(({ x, y, dx, dy, yaw }, i) => {
    const [wx, wz] = gridToWorld(x, y, center);
    dummy.rotation.y = yaw;
    for (const [mesh, outward, height] of [
      [mounts, 1.974, 1.68],
      [glass, 1.974, 1.88],
      [caps, 1.974, 2.14],
    ]) {
      dummy.position.set(wx + dx * outward, height, wz + dy * outward);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
  });
  for (const [mesh, name] of [
    [mounts, 'chronicles-town-wall-lantern-mounts'],
    [glass, 'chronicles-town-wall-lantern-glass'],
    [caps, 'chronicles-town-wall-lantern-caps'],
  ]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    town.add(mesh);
  }
}

// Pitched roof silhouettes on authored 2–6-cell solid wall runs. The six
// triangles are shared by ONE instanced mesh regardless of span width. High
// eaves may overhang the road visually but never alter collision geometry. Saved party cells never change.
function addSettlementRoofRuns(town, { grid, blocked, center, runs, wallHeight = 1.6, trimTimber = null, trimStucco = null }) {
  if (!Array.isArray(runs) || !runs.length) return;
  const solid = new Set(blocked.map(({ x, y }) => x + ',' + y));
  const claimedCells = new Set();
  const valid = [];
  for (const run of runs.slice(0, 12)) {
    const { x, y, width } = run || {};
    if (!Number.isInteger(x) || !Number.isInteger(y)
      || !Number.isInteger(width) || width < 2 || width > 6) continue;
    const cells = Array.from({ length: width }, (_, dx) => (x + dx) + ',' + y);
    if (cells.some(key => !solid.has(key) || claimedCells.has(key))
      || !cells.some((_, dx) =>
        grid[y - 1]?.[x + dx] === '.' || grid[y + 1]?.[x + dx] === '.')) continue;
    cells.forEach(key => claimedCells.add(key));
    valid.push(run);
  }
  if (!valid.length) return;
  // Small 22cm eaves reveal the pitched roof from street level. Their
  // underside is >6m above the walkable grid; collisions stay unchanged.
  // No extra triangles, instances or draw calls on mobile.
  const eave = 0.22;
  const length = CELL * 4 + eave * 2;
  const depth = CELL + eave * 2;
  const vertices = new Float32Array([
    -length / 2, 0, -depth / 2,
    length / 2, 0, -depth / 2,
    -length / 2, 0, depth / 2,
    length / 2, 0, depth / 2,
    -length / 2, 0.92, 0,
    length / 2, 0.92, 0,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  // UVs follow the roof slope instead of projecting a flat roof-colour
  // triangle. Preserve all six vertices and 18 indices for old mobile budgets.
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 0, 1, 1, 1, 0, 0.5, 1, 0.5,
  ], 2));
  geometry.setIndex([0, 1, 5, 0, 5, 4, 4, 5, 3, 4, 3, 2, 0, 4, 2, 1, 3, 5]);
  geometry.computeVertexNormals();
  const roofs = new THREE.InstancedMesh(
    geometry, material(0xb88d75, {
      map: swordhavenSurfaceTexture('roof'),
      normalMap: swordhavenSurfaceNormalTexture('roof'),
      normalScale: new THREE.Vector2(0.35, 0.35),
      side: THREE.DoubleSide, roughness: 0.95,
    }), valid.length,
  );
  const dummy = new THREE.Object3D();
  // Three restrained clay shades break up identical roof runs without
  // extra meshes, materials, or random flicker between visits.
  const roofTints = [
    new THREE.Color('#ffffff'),
    new THREE.Color('#eee1d5'),
    new THREE.Color('#e0d4cb'),
  ];
  valid.forEach(({ x, y, width }, index) => {
    const [wx, wz] = gridToWorld(x + (width - 1) / 2, y, center);
    // X-scale alters only span length, not roof pitch/height: a pair of
    // cottages and a five-cell terrace share the same triangle budget.
    dummy.scale.set((CELL * width + eave * 2) / length, 1, 1);
    dummy.position.set(wx, wallHeight - 0.04, wz);
    dummy.updateMatrix();
    roofs.setMatrixAt(index, dummy.matrix);
    roofs.setColorAt(index, roofTints[(x * 5 + y * 7 + width) % roofTints.length]);
  });
  roofs.instanceMatrix.needsUpdate = true;
  roofs.instanceColor.needsUpdate = true;
  roofs.name = 'chronicles-town-south-pitched-roofs';
  roofs.castShadow = false;
  roofs.receiveShadow = true;
  town.add(roofs);
  // The 7 authored Swordhaven terrace roofs gain one coherent oak edge
  // treatment; other settlements retain their old roofing silhouette.
  if (trimTimber) {
    dressSwordhavenRoofRuns(town, {
      runs: valid, center, wallHeight, eave, timber: trimTimber,
    });
    // Decorative roof windows face only existing traversable streets.
    // They share the same verified runs; the collision/route grid is intact.
    dressSwordhavenDormers(town, {
      runs: valid, grid, center, wallHeight, eave,
      timber: trimTimber, plaster: trimStucco, roofMaterial: roofs.material,
    });
  }
}

export function buildChroniclesCampaignExterior(scene, { scenePlan = {}, coarsePointer = false } = {}) {
  const grid = scenePlan.grid || [];
  const width = Math.max(1, Number(scenePlan.width) || grid[0]?.length || 19);
  const height = Math.max(1, Number(scenePlan.height) || grid.length || 15);
  const sceneCenter = scenePlan.center || { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const roadMap = scenePlan.mapId === 'banner-road';
  const forest = scenePlan.mapId === 'rookwood-first-book' || scenePlan.biome === 'forest';
  // Terra biomes tint ground, rock and sky; collision is always the grid.
  const biome = TERRA_BIOMES[scenePlan.biome] || null;
  // Authored towns (First Book Swordhaven) dress their interior blocks as the
  // same half-timbered houses as the legacy square; collision stays the grid.
  const settlement = scenePlan.regionKind === 'settlement';
  const authoredWallHeight = scenePlan.landscape?.streetWallHeight;
  const streetWallHeight = settlement && Number.isFinite(authoredWallHeight)
    && authoredWallHeight >= 3.2 && authoredWallHeight <= 9.6 ? authoredWallHeight : 1.6;
  const village = settlement ? createSwordhavenMaterials() : null;
  // The B2 heath uses its own peat/lichen surface; neighboring hills keep
  // their existing grass. One tiled texture and the same single terrain mesh.
  const heathB2 = scenePlan.mapId === 'terra-b2' && scenePlan.biome === 'hills' && !settlement;
  const earth = material(heathB2 ? 0xffffff : (biome?.ground ?? (forest ? 0xaebc9e : 0xffffff)), {
    map: heathB2 ? terraGroundTexture('heath')
      : biome?.texture ? terraGroundTexture(biome.texture) : swordhavenGrassTexture(),
  });
  const stone = village ? village.stone
    : material(biome?.rock ?? (roadMap ? 0x8f8a7e : 0xb9b09f), { map: swordhavenSurfaceTexture('masonry') });
  // The shared town-only relief adds directional light to weathered paving.
  // Wild roads retain their cheaper albedo-only rendering.
  const paver = material(heathB2 ? 0xffffff : (roadMap ? 0xcabfa6 : 0xddd3bf), {
    // B2 still uses the exact same authored road cells and one InstancedMesh.
    // Replacing only its albedo visually joins the peat terrain and stones.
    map: heathB2 ? chroniclesPixelTexture('heathpath') : swordhavenSurfaceTexture('cobble'),
    ...(settlement ? {
      normalMap: swordhavenSurfaceNormalTexture('cobble'),
      normalScale: new THREE.Vector2(0.72, 0.72),
    } : {}),
  });
  const timber = material(0x4d3424);
  const linen = material(0x963f32, { side: THREE.DoubleSide });
  const plaque = material(0xc4aa70, { metalness: 0.47, roughness: 0.45 });

  const skyTint = biome?.sky ?? (forest ? 0x9fb8a4 : 0xb4d4df);
  scene.background = new THREE.Color(skyTint);
  scene.fog = forest
    ? new THREE.Fog(skyTint, 14, Math.max(width, height) * CELL * 0.95)
    : new THREE.Fog(skyTint, 55, Math.max(width, height) * CELL * 1.65);
  const sunDirection = new THREE.Vector3(-25, 30, -65).normalize();
  scene.add(createSwordhavenSkyDome(sunDirection));
  scene.add(new THREE.HemisphereLight(0xd4e9ff, 0x60734b, 1.4));
  const sunlight = new THREE.DirectionalLight(0xffe6ba, coarsePointer ? 1.18 : 1.55);
  sunlight.name = 'chronicles-campaign-sun';
  sunlight.position.copy(sunDirection).multiplyScalar(75);
  sunlight.castShadow = !coarsePointer;
  if (!coarsePointer) {
    sunlight.shadow.mapSize.set(512, 512);
    sunlight.shadow.camera.left = -42;
    sunlight.shadow.camera.right = 42;
    sunlight.shadow.camera.top = 42;
    sunlight.shadow.camera.bottom = -42;
  }
  scene.add(sunlight);
  // Terra's wilds are dressed per biome (boulders, pines, reeds, basalt...)
  // instead of stone blocks, and continue past the edge of the map.
  const wilds = !settlement && chroniclesTerraSceneryBiomes().includes(scenePlan.biome) && !forest;
  // A forest continues past the playable grid so its gaps never show the void.
  const margin = forest ? FOREST_MARGIN_CELLS * 2 : wilds ? TERRA_SCENERY_MARGIN * 2 : 0;
  const terrain = new THREE.Mesh(new THREE.BoxGeometry((width + margin) * CELL, 0.25, (height + margin) * CELL), earth);
  terrain.name = 'chronicles-campaign-terrain';
  terrain.position.y = -0.19;
  terrain.receiveShadow = true;
  scene.add(terrain);

  // A forest has no paved axes: its paths are the gaps between trees.
  const roadCells = forest ? [] : visibleRoadCells(scenePlan, sceneCenter).filter(({ x, y }) => grid[y]?.[x] === '.');
  if (roadCells.length) {
    // Stone paving deliberately keeps a narrow mortar joint. B2's
    // compacted-earth track is continuous: close that 8cm dark gap between
    // neighboring road tiles without overlapping coplanar faces (z-fighting).
    // This is only an albedo carrier; movement still follows the saved grid.
    const roadSpan = heathB2 ? CELL : CELL * 0.98;
    const roads = new THREE.InstancedMesh(
      new THREE.BoxGeometry(roadSpan, 0.045, roadSpan), paver, roadCells.length,
    );
    const dummy = new THREE.Object3D();
    // Per-instance colour distinguishes districts without new geometry,
    // materials, draw calls or independent floor/collision masks.
    const roadTintZones = (Array.isArray(scenePlan.landscape?.roadTintZones)
      ? scenePlan.landscape.roadTintZones : [])
      .filter(zone => /^#[0-9a-f]{6}$/i.test(zone?.color || '')
        && [zone.minX, zone.maxX, zone.minY, zone.maxY].every(Number.isInteger)
        && zone.minX <= zone.maxX && zone.minY <= zone.maxY)
      .map(zone => ({ ...zone, tint: new THREE.Color(zone.color) }));
    const neutralTint = new THREE.Color(0xffffff);
    // Contextual pigment variation on B2's dirt track: moss grows next to
    // rocky banks, while open stretches stay a touch warmer. The road mesh,
    // matrices, walkable cells, and draw-call count are unchanged.
    const heathTrackTints = heathB2 ? {
      edge: ['#e5ebdf', '#e2e9dc', '#edf0e4'].map(hex => new THREE.Color(hex)),
      open: ['#ffffff', '#faf5e9', '#f3ede2', '#f7f1e7'].map(hex => new THREE.Color(hex)),
    } : null;
    roadCells.forEach(({ x, y }, index) => {
      const [wx, wz] = gridToWorld(x, y, sceneCenter);
      dummy.position.set(wx, 0.002, wz);
      dummy.updateMatrix();
      roads.setMatrixAt(index, dummy.matrix);
      if (roadTintZones.length || heathTrackTints) {
        const district = roadTintZones.find(zone =>
          x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY);
        const nearStone = heathTrackTints && (
          grid[y - 1]?.[x] === '#' || grid[y + 1]?.[x] === '#'
          || grid[y]?.[x - 1] === '#' || grid[y]?.[x + 1] === '#'
        );
        const shades = heathTrackTints && (nearStone ? heathTrackTints.edge : heathTrackTints.open);
        const mix = (Math.imul(x + 29, 73856093) ^ Math.imul(y + 17, 19349663)) >>> 0;
        const naturalTint = shades?.[mix % shades.length];
        // Initialise every slot once instance colours are enabled, including
        // those without district zones. Never leave uncoloured black roads.
        roads.setColorAt(index, district?.tint || naturalTint || neutralTint);
      }
    });
    roads.instanceMatrix.needsUpdate = true;
    if (roads.instanceColor) roads.instanceColor.needsUpdate = true;
    roads.name = 'chronicles-campaign-road';
    roads.receiveShadow = true;
    scene.add(roads);
  }

  // Existing '#'-cell collision is visualized as stone embankment (one draw
  // call), not as unmarked floor. Do not scatter blockers on '.' terrain.
  let blocked = [];
  grid.forEach((row, y) => [...row].forEach((tile, x) => {
    if (tile === '#') blocked.push({ x, y });
  }));
  if (village) {
    // The city wall is an enclosing structure, not another loose street
    // blocker. Keep it in its own fixed batch: a combined street/perimeter
    // InstancedMesh can disappear as a whole under visibility culling, leaving
    // Swordhaven looking out onto empty sky. Use only solid edge tiles from
    // the authored collision map; no invisible or new barriers.
    const perimeter = blocked.filter(({ x, y }) =>
      x === 0 || y === 0 || x === width - 1 || y === height - 1);
    if (perimeter.length) {
      const wall = new THREE.InstancedMesh(
        new THREE.BoxGeometry(CELL * 0.99, streetWallHeight, CELL * 0.99),
        stone, perimeter.length,
      );
      wall.name = 'chronicles-campaign-town-perimeter';
      wall.frustumCulled = false; // The enclosure must not vanish while turning.
      wall.castShadow = !coarsePointer;
      wall.receiveShadow = true;
      const merlonCells = perimeter.filter(({ x, y }) => (x + y) % 2 === 0);
      const merlons = new THREE.InstancedMesh(
        new THREE.BoxGeometry(CELL * 0.72, 0.76, CELL * 0.72),
        stone, merlonCells.length,
      );
      merlons.name = 'chronicles-campaign-town-battlements';
      merlons.frustumCulled = false;
      merlons.castShadow = !coarsePointer;
      merlons.receiveShadow = true;
      const dummy = new THREE.Object3D();
      for (const [index, { x, y }] of perimeter.entries()) {
        const [wx, wz] = gridToWorld(x, y, sceneCenter);
        dummy.position.set(wx, streetWallHeight / 2 - 0.04, wz);
        dummy.updateMatrix();
        wall.setMatrixAt(index, dummy.matrix);
      }
      merlonCells.forEach(({ x, y }, index) => {
        const [wx, wz] = gridToWorld(x, y, sceneCenter);
        dummy.position.set(wx, streetWallHeight + 0.34, wz);
        dummy.updateMatrix();
        merlons.setMatrixAt(index, dummy.matrix);
      });
      wall.instanceMatrix.needsUpdate = true;
      merlons.instanceMatrix.needsUpdate = true;
      scene.add(wall, merlons);
      // Never draw the same masonry twice (depth flicker/z-fighting).
      const edge = new Set(perimeter.map(({ x, y }) => x + ',' + y));
      blocked = blocked.filter(({ x, y }) => !edge.has(x + ',' + y));
    }
  }
  if (village) {
    const town = new THREE.Group();
    town.name = 'chronicles-campaign-town';
    const houses = settlementHouseBlocks(grid, width, height);
    const houseCells = new Set();
    const contentAt = new Map((scenePlan.content || [])
      .filter(entry => entry.position && String(entry.visualType || '').startsWith('building-'))
      .map(entry => [entry.position.x + ',' + entry.position.y, entry.visualType.slice('building-'.length)]));
    let homeIndex = 0;
    houses.forEach((block, index) => {
      block.cells.forEach(({ x, y }) => houseCells.add(x + ',' + y));
      const facing = settlementHouseFacing(block, grid, sceneCenter);
      const door = facing.door;
      const styleId = contentAt.get(door.x + ',' + door.y);
      const style = TOWN_BUILDING_STYLES[styleId] || TOWN_HOME_STYLES[homeIndex++ % TOWN_HOME_STYLES.length];
      const { root } = buildSwordhavenHouse(
        { id: 'first-book-' + (styleId || 'home') + '-' + index, x: block.cx, y: block.cy,
          roof: style.roof, emblem: style.emblem, label: style.label, serviceStyle: styleId },
        village, coarsePointer, new Set(), sceneCenter,
      );
      root.rotation.y = facing.yaw;
      town.add(root);
    });
    // A lone interior blocker is the town fountain, which fits one 4×4 m cell.
    blocked.forEach(({ x, y }) => {
      if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1 || houseCells.has(x + ',' + y)) return;
      const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => grid[y + dy]?.[x + dx] === '#');
      if (neighbours.length) return;
      const fountain = buildSwordhavenFountain(village);
      const [wx, wz] = gridToWorld(x, y, sceneCenter);
      fountain.position.set(wx, 0, wz);
      town.add(fountain);
      houseCells.add(x + ',' + y);
    });
    blocked = blocked.filter(({ x, y }) => !houseCells.has(x + ',' + y));
    addSettlementPlasterFrontages(town, {
      grid, blocked, center: sceneCenter, wallHeight: streetWallHeight,
      zones: scenePlan.landscape?.facadeZones,
    });
    addSettlementStreetFacades(town, {
      grid, blocked, center: sceneCenter, wallHeight: streetWallHeight,
      zones: scenePlan.landscape?.facadeZones,
    });
    // Only Swordhaven gets the mock-inspired hooded windows and planted
    // residential sills; use the same grid-derived faces as the real windows.
    // Geometry is instanced and elevated, with no collision or new lights.
    if (scenePlan.mapId === 'swordhaven-first-book') {
      dressSwordhavenStreetWindows(town, {
        faces: settlementStreetFacingFaces({
          grid, blocked, zones: scenePlan.landscape?.facadeZones,
        }),
        center: sceneCenter, wallHeight: streetWallHeight, coarsePointer,
      });
    }
    addSettlementTimberFrontages(town, {
      grid, blocked, center: sceneCenter, wallHeight: streetWallHeight,
      zones: scenePlan.landscape?.facadeZones,
    });
    addSettlementWallLanterns(town, {
      grid, blocked, center: sceneCenter,
      placements: scenePlan.landscape?.wallLanterns,
    });
    addSettlementRoofRuns(town, {
      grid, blocked, center: sceneCenter, wallHeight: streetWallHeight,
      runs: scenePlan.landscape?.roofRuns,
      trimTimber: scenePlan.mapId === 'swordhaven-first-book' ? village.timber : null,
      trimStucco: scenePlan.mapId === 'swordhaven-first-book' ? village.plaster : null,
    });
    // Trees stand outside the town wall so no walkable cell gains a blocker.
    TOWN_TREE_CELLS(width, height).forEach(([x, y], index) => {
      const [wx, wz] = gridToWorld(x, y, sceneCenter);
      buildSwordhavenTree(town, wx, wz, village, coarsePointer, index);
    });
    addSwordhavenClouds(town, coarsePointer);
    scene.add(town);
  }
  if (blocked.length && forest) {
    const outskirts = [];
    for (let y = -FOREST_MARGIN_CELLS; y < height + FOREST_MARGIN_CELLS; y += 1) {
      for (let x = -FOREST_MARGIN_CELLS; x < width + FOREST_MARGIN_CELLS; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) outskirts.push({ x, y });
      }
    }
    scene.add(buildForestCanopy([...blocked, ...outskirts], sceneCenter, { coarsePointer }));
  } else if (wilds) {
    // Blocked cells become scenery; collision is still the grid alone.
  } else if (blocked.length) {
    // Urban solids become full-height house walls, not knee-high embankments.
    // One instanced batch still draws all non-house blockers.
    const barrier = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.98, streetWallHeight, CELL * 0.98), stone, blocked.length);
    const dummy = new THREE.Object3D();
    blocked.forEach(({ x, y }, i) => {
      const [wx, wz] = gridToWorld(x, y, sceneCenter);
      dummy.position.set(wx, streetWallHeight / 2 - 0.04, wz);
      dummy.updateMatrix();
      barrier.setMatrixAt(i, dummy.matrix);
    });
    barrier.instanceMatrix.needsUpdate = true;
    barrier.name = 'chronicles-campaign-visible-blockers';
    barrier.castShadow = !coarsePointer;
    barrier.receiveShadow = true;
    scene.add(barrier);
  }

  if (!settlement && (wilds || forest)) {
    scene.add(buildTerraScenery({
      grid, center: sceneCenter, biome: forest ? 'forest' : scenePlan.biome, mapId: scenePlan.mapId, scenery: scenePlan.scenery,
      coarsePointer, keepClear: [...roadCells, ...(scenePlan.content || []).map((entry) => entry.position).filter(Boolean)],
    }));
  }

  const contentProps = [];
  for (const entry of scenePlan.content || []) {
    if (!entry.position || !['exit', 'lore', 'pickup'].includes(entry.kind)) continue;
    // A second dialogue beat on an existing NPC has no body of its own.
    if (entry.visualType === 'rookwood-mourner-voice') continue;
    const [wx, wz] = gridToWorld(entry.position.x, entry.position.y, sceneCenter);
    const root = new THREE.Group();
    root.name = 'chronicles-campaign-content-' + entry.id;
    root.userData.chroniclesContentId = entry.id;
    root.position.set(wx, 0, wz);
    let activatedRoot = null;
    // Optional authored facing (0 N, 1 E, 2 S, 3 W) for characters and signs.
    const facing = [[0, -1], [1, 0], [0, 1], [-1, 0]][Number(entry.visualFacing)];
    if (facing) root.rotation.y = Math.atan2(facing[0], facing[1]);
    if (entry.visualType === 'name-oak') {
      activatedRoot = buildNameOak(root, { timber, plaque, coarsePointer });
    } else if (entry.visualType === 'name-plaque') {
      buildNamePlaque(root, { timber, plaque });
    } else if (entry.visualType === 'notice-board') {
      // The authored contract sits beside the south-facing house wall, not in
      // the middle of Odo's shop approach. Collision still uses the map grid.
      root.position.z += 1.72;
      buildChroniclesTownNoticeBoard(root);
    } else if (entry.visualType === 'rookwood-mourner') {
      // 2.5D painted billboard; the procedural figure stays as fallback.
      const billboard = buildChroniclesSpriteBillboard('rookwood-mourner');
      if (billboard) {
        root.add(billboard);
        root.userData.updateChroniclesSprite = billboard.userData.updateChroniclesSprite;
      } else {
        buildMourner(root);
      }
    } else if (entry.kind === 'lore' && chroniclesHasSpriteBillboard(entry.visualType)) {
      // Any other painted character (a troll's friend, a ghost) by its sheet.
      const billboard = buildChroniclesSpriteBillboard(entry.visualType);
      root.add(billboard);
      root.userData.updateChroniclesSprite = billboard.userData.updateChroniclesSprite;
    } else if (entry.visualType === 'sewer-grate') {
      // A town's dungeon mouth: iron grate in a stone ring, flush with the road.
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.12, 12), stone);
      ring.position.y = 0.06;
      root.add(ring);
      const iron = material(0x2b2b30, { metalness: 0.6, roughness: 0.55 });
      for (let bar = -3; bar <= 3; bar += 1) {
        const rod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.5), iron);
        rod.position.set(bar * 0.22, 0.14, 0);
        root.add(rod);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.1), iron);
      cross.position.y = 0.16;
      root.add(cross);
    } else if (entry.visualType === 'dungeon-arch') {
      // A dungeon mouth in the open: two pillars, a lintel and the dark inside.
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.1, 0.55), stone);
        pillar.position.set(side * 1.15, 1.55, 0);
        root.add(pillar);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 0.65), stone);
      lintel.position.y = 3.3;
      const dark = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.0), material(0x050403, { side: THREE.DoubleSide }));
      dark.position.set(0, 1.5, 0);
      root.add(lintel, dark);
    } else if (entry.visualType === 'chest') {
      const chest = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.7), timber);
      chest.position.y = 0.3;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.22, 0.74), timber);
      lid.position.y = 0.71;
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.1, 0.76), plaque);
      band.position.y = 0.6;
      root.add(chest, lid, band);
    } else if (entry.visualType === 'signpost') {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 6), timber);
      post.position.y = 1.1;
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 0.08), timber);
      board.position.set(0.35, 1.85, 0);
      board.rotation.z = -0.06;
      root.add(post, board);
    } else if (entry.visualType === 'frozen-beacon') {
      // One recognisable, authored lighthouse in F1, not a roadside lamp.
      // The whole silhouette fits a single authored walkable cell: the
      // collision grid stays untouched and all light comes from world flags.
      const frostStone = material(0xb5c5c9, {
        map: swordhavenSurfaceTexture('masonry'), roughness: 0.93,
      });
      const coldSlate = material(0x344657, { roughness: 0.87 });
      const darkMetal = material(0x23303d, { metalness: 0.57, roughness: 0.46 });
      const weatheredBronze = material(0xb79b65, { metalness: 0.47, roughness: 0.43 });
      const addCylinder = (top, bottom, height, y, finish, segments = 12) => {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), finish);
        mesh.position.y = y;
        root.add(mesh);
        return mesh;
      };
      // Battered foundation, tapered stone tower and its three weather-beaten
      // bands provide a tall silhouette and clear scale even at six tiles.
      addCylinder(1.31, 1.45, 0.8, 0.4, coldSlate);
      addCylinder(0.91, 1.2, 6.8, 3.79, frostStone);
      addCylinder(1.19, 1.24, 0.27, 1.18, coldSlate);
      addCylinder(1.07, 1.12, 0.22, 3.63, coldSlate);
      addCylinder(0.98, 1.03, 0.23, 6.68, coldSlate);
      // A door towards the approaching company and two narrow arrow-slit
      // windows: they make this a building rather than a stack of cylinders.
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.58, 0.74), darkMetal);
      door.position.set(-1.24, 0.87, 0);
      root.add(door);
      for (const y of [3.04, 5.35]) {
        const window = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.28), darkMetal);
        window.position.set(-1.05 + (y > 4 ? 0.09 : 0), y, 0);
        root.add(window);
      }
      // Lantern gallery: bronze deck, upright cage, coloured glass and a
      // broad slate roof. The top is high enough to read on both mobile/PC.
      addCylinder(1.45, 1.25, 0.3, 7.34, weatheredBronze);
      addCylinder(1.55, 1.55, 0.12, 7.57, coldSlate);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.45, 12),
        material(0x6e96a9, { transparent: true, opacity: 0.72,
          emissive: 0x101f2a, emissiveIntensity: 0.2 }));
      glass.position.y = 8.38;
      root.add(glass);
      for (let index = 0; index < 8; index += 1) {
        const angle = (index * Math.PI) / 4;
        const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.55, 6), darkMetal);
        upright.position.set(Math.cos(angle) * 1.09, 8.37, Math.sin(angle) * 1.09);
        root.add(upright);
      }
      addCylinder(1.38, 1.13, 0.19, 9.2, weatheredBronze);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.63, 0.95, 12), coldSlate);
      roof.position.y = 9.72;
      root.add(roof);
      addCylinder(0.12, 0.15, 0.43, 10.39, weatheredBronze, 8);
      // The visible light is a child of the existing activatedRoot contract,
      // so it automatically follows the saved choice without introducing a
      // second light state or animation clock.
      activatedRoot = new THREE.Group();
      activatedRoot.name = 'chronicles-f1-beacon-lit';
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 10),
        material(0xffefb0, { emissive: 0xffbc52, emissiveIntensity: 1.6 }));
      lamp.position.y = 8.4;
      const halo = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10),
        material(0xfedc80, { transparent: true, opacity: 0.28,
          emissive: 0xffc867, emissiveIntensity: 0.5, depthWrite: false }));
      halo.position.y = 8.4;
      // Procedural soft bloom: a small alpha texture keeps the distant
      // lantern readable on mobile without an opaque square or fake collider.
      const flareSize = 48;
      const flarePixels = new Uint8Array(flareSize * flareSize * 4);
      for (let py = 0; py < flareSize; py += 1) {
        for (let px = 0; px < flareSize; px += 1) {
          const dx = (px + 0.5 - flareSize / 2) / (flareSize / 2);
          const dy = (py + 0.5 - flareSize / 2) / (flareSize / 2);
          const radius = Math.sqrt(dx * dx + dy * dy);
          const alpha = Math.pow(Math.max(0, 1 - radius), 1.45);
          const i = (py * flareSize + px) * 4;
          flarePixels[i] = 255;
          flarePixels[i + 1] = 214;
          flarePixels[i + 2] = 140;
          flarePixels[i + 3] = Math.round(alpha * 237);
        }
      }
      const texture = new THREE.DataTexture(flarePixels, flareSize, flareSize, THREE.RGBAFormat);
      texture.needsUpdate = true;
      const flare = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false,
      }));
      flare.name = 'chronicles-f1-beacon-distance-bloom';
      flare.position.y = 8.4;
      flare.scale.set(9, 9, 1);
      const lanternLight = new THREE.PointLight(0xffc76d, coarsePointer ? 70 : 52, 28, 2);
      lanternLight.name = 'chronicles-f1-beacon-stone-wash';
      lanternLight.position.y = 8.4;
      activatedRoot.add(lamp, halo, flare, lanternLight);
      activatedRoot.visible = false;
      root.add(activatedRoot);
    } else if (entry.visualType === 'shrine') {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.7, 10), stone);
      basin.position.y = 0.35;
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 10),
        material(0x6fb4e0, { emissive: 0x1d5f8a, emissiveIntensity: 0.6 }));
      water.position.y = 0.72;
      root.add(basin, water);
    } else if (entry.kind === 'exit') {
      // Gate posts flank the road, so a gate on the west/east edge turns 90°
      // instead of planting one post straight in front of the arriving camera.
      if (entry.position.x <= 1 || entry.position.x >= width - 2) root.rotation.y = Math.PI / 2;
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 4.4, 8), timber);
        pole.position.set(side * 1.25, 2.2, 0);
        root.add(pole);
        const banner = new THREE.Mesh(new THREE.BoxGeometry(0.67, 1.65, 0.06), linen);
        banner.name = 'banner-road-heraldic-pennant';
        banner.position.set(side * 1.25 + 0.34 * side, 3.18, 0);
        root.add(banner);
      }
    } else if ((!village || !String(entry.visualType || '').startsWith('building-'))
      && !(scenePlan.mapId === 'swordhaven-first-book' && entry.id === 'sealed-order')) {
      // Swordhaven's sealed order is a quest interaction anchor outside the
      // armeria, not a freestanding monument. Keep its root registered below
      // without planting a blank stone pedestal in the shop approach.
      // Town services already have authored shopfronts, doorways and emblems
      // on their buildings. Do not plant the generic stone debug-like marker
      // directly in front of an otherwise recognizable establishment.
      // Keep the content root and ID registered for interaction by cell.
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.64, 1.05, 8), stone);
      marker.position.y = 0.53;
      const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.12), plaque);
      emblem.position.set(0, 0.76, 0.57);
      root.add(marker, emblem);
    }
    root.visible = entry.visible !== false;
    scene.add(root);
    contentProps.push({ id: entry.id, kind: entry.kind, root, activatedRoot, phase: 0 });
  }

  // Overworld enemies are real, visible bodies on their authored cells, with
  // the same model registry and runtime animation contract as dungeons.
  const enemyDefinitions = scenePlan.enemies || [];
  const enemies = {};
  enemyDefinitions.forEach((definition) => {
    const enemy = buildChroniclesEnemyVisual(definition.visualType || definition.id, { coarsePointer, sprites: true })?.model;
    if (!enemy) return;
    const [ex, ez] = gridToWorld(definition.x, definition.y, sceneCenter);
    enemy.position.set(ex, 0, ez);
    const authoredScale = Number(definition.visualScale);
    enemy.scale.setScalar(Number.isFinite(authoredScale) ? authoredScale : 1.08);
    enemy.rotation.y = Math.PI;
    enemy.userData.chroniclesBaseYaw = enemy.rotation.y;
    enemy.userData.chroniclesBaseScale = enemy.scale.x;
    enemy.userData.chroniclesTargetPosition = new THREE.Vector3(ex, 0, ez);
    enemies[definition.id] = enemy;
    scene.add(enemy);
  });

  return {
    enemies, enemyDefinitions,
    spectralChapel: new THREE.Group(),
    sigilMaterial: material(0x99866b),
    gateMaterial: material(0x74614b),
    gateRunes: [], torches: [], contentProps, sceneCenter, materialArt: null,
  };
}

const FOREST_MARGIN_CELLS = 3;

// Ground (multiplies the grass texture), rock and sky per Terra biome.
const TERRA_BIOMES = Object.freeze({
  plains: Object.freeze({ ground: 0xffffff, rock: 0xb9b09f, sky: 0xb4d4df }),
  hills: Object.freeze({ ground: 0xd8d0a0, rock: 0x9a8e78, sky: 0xbcd2dc }),
  marsh: Object.freeze({ ground: 0x8ea07c, rock: 0x5e6a52, sky: 0xa9b8ac }),
  coast: Object.freeze({ ground: 0xffffff, rock: 0x8a8478, sky: 0xa6d0ea, texture: 'sand' }),
  snow: Object.freeze({ ground: 0xffffff, rock: 0xd4dce4, sky: 0xdce6ee, texture: 'snow' }),
  ash: Object.freeze({ ground: 0xffffff, rock: 0x3e3634, sky: 0xc0a894, texture: 'ashland' }),
});

function terraGroundTexture(kind) {
  const texture = chroniclesPixelTexture(kind);
  texture.repeat.set(20, 20);
  return texture;
}

// A shop's style comes from the authored NPC standing at its door
// (`visualType: building-<style>`); unclaimed blocks are homes.
const TOWN_BUILDING_STYLES = Object.freeze({
  forge: Object.freeze({ roof: 0x8a4632, emblem: 'swords', label: 'ARMERÍA' }),
  armor: Object.freeze({ roof: 0x4a657e, emblem: 'shield', label: 'ARMADURAS' }),
  tavern: Object.freeze({ roof: 0x995e37, emblem: 'mug', label: 'TABERNA' }),
  temple: Object.freeze({ roof: 0x65758a, emblem: 'sun', label: 'TEMPLO' }),
  store: Object.freeze({ roof: 0x7a6a3c, emblem: 'sack', label: 'PROVISIONES' }),
  // Sage-glazed tiles distinguish the herbalist from the violet-roofed arcane guild.
  apothecary: Object.freeze({ roof: 0x5d8570, emblem: 'crystal', label: 'BOTICA' }),
  guild: Object.freeze({ roof: 0x3f4f8a, emblem: 'crystal', label: 'GREMIO' }),
  watch: Object.freeze({ roof: 0x5c3b38, emblem: 'shield', label: 'GUARDIA' }),
  // Civic silhouette and seal are distinct from the temple's sun and spire.
  hall: Object.freeze({ roof: 0x6e2e2a, emblem: 'civic', label: 'AYUNTAMIENTO' }),
});
const TOWN_HOME_STYLES = Object.freeze([
  Object.freeze({ roof: 0x7d4a36, emblem: 'home' }),
  Object.freeze({ roof: 0x5d6b52, emblem: 'home' }),
  Object.freeze({ roof: 0x6e5a74, emblem: 'home' }),
  Object.freeze({ roof: 0x8b5b3a, emblem: 'home' }),
]);

function TOWN_TREE_CELLS(width, height) {
  return [[-1, -1], [width, -1], [-1, height], [width, height],
    [-1, Math.floor(height / 2)], [width, Math.floor(height / 2)],
    [Math.floor(width / 4), -1], [Math.floor(width * 3 / 4), -1]];
}

// Deterministic per-cell jitter: the same map always grows the same forest.
function cellNoise(x, y, salt = 0) {
  const n = Math.sin((x * 127.1 + y * 311.7 + salt * 74.7)) * 43758.5453;
  return n - Math.floor(n);
}

// Impassable cells of a forest map are tree clumps, not stone blocks: the
// collision grid stays the single source of truth, only its dressing changes.
function buildForestCanopy(blocked, center, { coarsePointer = false } = {}) {
  const group = new THREE.Group();
  group.name = 'chronicles-campaign-forest';
  const perCell = coarsePointer ? 1 : 2;
  const count = blocked.length * perCell;
  const bark = chroniclesPixelTexture('bark');
  bark.repeat.set(2, 3); // ≈16 texels per metre around a trunk
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.34, 3.2, 7),
    material(0xffffff, { map: bark }),
    count,
  );
  const foliage = chroniclesPixelTexture('leaves');
  foliage.repeat.set(6, 2);
  const lower = new THREE.InstancedMesh(new THREE.ConeGeometry(1.75, 3.4, 8), material(0xc8d6c0, { map: foliage }), count);
  const upper = new THREE.InstancedMesh(new THREE.ConeGeometry(1.2, 2.7, 8), material(0xffffff, { map: foliage }), count);
  const dummy = new THREE.Object3D();
  let index = 0;
  blocked.forEach(({ x, y }) => {
    const [wx, wz] = gridToWorld(x, y, center);
    for (let k = 0; k < perCell; k += 1) {
      const ox = (cellNoise(x, y, k) - 0.5) * (perCell > 1 ? 2.2 : 0.8);
      const oz = (cellNoise(y, x, k + 3) - 0.5) * (perCell > 1 ? 2.2 : 0.8);
      const scale = 0.85 + cellNoise(x, y, k + 7) * 0.5;
      const yaw = cellNoise(x, y, k + 11) * Math.PI * 2;
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(scale);
      dummy.position.set(wx + ox, 1.6 * scale, wz + oz);
      dummy.updateMatrix();
      trunks.setMatrixAt(index, dummy.matrix);
      dummy.position.set(wx + ox, 4.1 * scale, wz + oz);
      dummy.updateMatrix();
      lower.setMatrixAt(index, dummy.matrix);
      dummy.position.set(wx + ox, 5.7 * scale, wz + oz);
      dummy.updateMatrix();
      upper.setMatrixAt(index, dummy.matrix);
      index += 1;
    }
  });
  [trunks, lower, upper].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = !coarsePointer;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}

// The Oak of Names: a broad old tree whose empty cords fill with the
// recovered plaques once the side quest is resolved. Sized so that, seen
// from the adjacent cell, both the cords at eye level and the crown read.
function buildNameOak(root, { timber, plaque, coarsePointer = false }) {
  const bark = material(0x46311f);
  const leaves = material(0x56743a);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.62, 3.3, 10), bark);
  trunk.position.y = 1.65;
  trunk.castShadow = !coarsePointer;
  root.add(trunk);
  const crowns = [[0, 3.9, 0, 1.75], [-1.25, 3.45, 0.45, 1.2], [1.2, 3.55, -0.3, 1.25], [0.15, 3.3, 1.15, 1.05], [-0.2, 3.4, -1.15, 1.05]];
  crowns.forEach(([x, y, z, r]) => {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaves);
    crown.position.set(x, y, z);
    crown.castShadow = !coarsePointer;
    root.add(crown);
  });
  const rootFlare = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, 0.3, 10), timber);
  rootFlare.position.y = 0.15;
  root.add(rootFlare);

  // Three cords ring the trunk so they face the party from any approach.
  const cord = material(0xc9b88c);
  const hung = new THREE.Group();
  hung.name = 'chronicles-name-oak-plaques';
  const glowPlaque = plaque.clone();
  glowPlaque.emissive = new THREE.Color(0x8a5a12);
  glowPlaque.emissiveIntensity = 0.85;
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const radius = 0.7;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.9, 4), cord);
    string.position.set(x, 2.15, z);
    root.add(string);
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.05), glowPlaque);
    tablet.position.set(x, 1.62, z);
    tablet.rotation.y = angle;
    hung.add(tablet);
  }
  const shine = new THREE.PointLight(0xffd27a, 0.9, 5, 2);
  shine.position.set(0, 1.8, 0);
  hung.add(shine);
  hung.visible = false;
  root.add(hung);
  return hung;
}

function buildNamePlaque(root, { timber, plaque }) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6), timber);
  post.position.y = 0.55;
  post.rotation.z = 0.12;
  const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.06), plaque);
  tablet.position.set(0.04, 1.02, 0.08);
  tablet.rotation.z = 0.12;
  const gleam = new THREE.PointLight(0xffd58a, 0.55, 3.2, 2);
  gleam.position.set(0, 1.2, 0.4);
  root.add(post, tablet, gleam);
}

// Edda: a hooded villager holding a lantern, simple and readable at
// distance; the lantern makes her findable in the forest's green dusk.
function buildMourner(root) {
  const cloak = material(0x5b4a35);
  const shawl = material(0x7a2f26);
  const skin = material(0xd8b48f);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.48, 1.35, 12), cloak);
  body.position.y = 0.68;
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), shawl);
  shoulders.scale.set(1.15, 0.55, 0.85);
  shoulders.position.y = 1.36;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), skin);
  head.position.set(0, 1.62, 0.03);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), shawl);
  hood.position.set(0, 1.66, -0.02);
  hood.rotation.x = -0.35;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 8), cloak);
  arm.position.set(0.3, 1.12, 0.12);
  arm.rotation.z = 0.5;
  const frame = material(0x2c2118, { metalness: 0.4, roughness: 0.6 });
  const lantern = new THREE.Group();
  const flame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), material(0xffc970, { emissive: 0xff9a2e, emissiveIntensity: 0.75 }));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.08, 4), frame);
  cap.position.y = 0.11;
  cap.rotation.y = Math.PI / 4;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.15), frame);
  base.position.y = -0.085;
  lantern.add(flame, cap, base);
  lantern.position.set(0.45, 0.82, 0.18);
  const glow = new THREE.PointLight(0xffb45a, 0.9, 4.5, 2);
  glow.position.set(0.45, 0.9, 0.3);
  root.add(body, shoulders, head, hood, arm, lantern, glow);
}

export { settlementHouseBlocks, settlementHouseFacing };