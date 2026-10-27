import * as THREE from 'three';
import {
  CHRONICLES_DIRECTIONS,
  chroniclesEnemyIsActive,
  chroniclesEnemyPosition,
} from './chroniclesOfMatthias.js';
import { chroniclesFirstPersonScenePlan } from './chronicles/chroniclesFirstPersonScenePlan.js';
import { chroniclesContentVisualStates } from './chronicles/chroniclesContentVisualState.js';
import { CHRONICLES_MINIMUM_VISIBILITY } from './chronicles/chroniclesLightingPolicy.js';
import { buildChroniclesDungeonDressing } from './chroniclesOfMatthiasDungeonArt.js';
import { buildChroniclesDungeonAtmosphere } from './chroniclesOfMatthiasAtmosphere.js';
import { installChroniclesFirstPersonPremiumMaterials } from './chroniclesOfMatthiasMaterialArt.js';
import { buildChroniclesEnemyVisual } from './chroniclesEnemyVisualRegistry.js';
import { buildSpectralChapel } from './chroniclesOfMatthiasSpectralBishop.js';
import { createExperimentalThreeRenderer } from './experimentalThreeRenderer.js';
import { createChroniclesFirstFrameGate } from './chronicles/chroniclesFirstFrameGate.js';
import { createChroniclesFrameScheduler } from './chronicles/chroniclesFrameScheduler.js';
import { createChroniclesTorchAmbientOverlay } from './chronicles/chroniclesTorchAmbientOverlay.js';
import { buildSwordhavenScene } from './chronicles/chroniclesSwordhaven3D.js';
import { buildChroniclesCampaignExterior } from './chronicles/chroniclesCampaignExterior3D.js';
import { buildChroniclesDungeonClutter } from './chronicles/chroniclesDungeonClutter.js';
import {
  chroniclesBrazierPlacements, chroniclesNearestLightSources, chroniclesSpreadTorchPlacements,
  chroniclesStableTorchLightAssignments, chroniclesTorchLightGain,
} from './chronicles/chroniclesDungeonLighting.js';
import { buildChroniclesSpriteBillboard, chroniclesHasSpriteBillboard } from './chronicles/chroniclesSpriteBillboards.js';
import { buildChroniclesEnemyNameplate } from './chronicles/chroniclesEnemyNameplate.js';
import { CHRONICLES_SWORDHAVEN_RETURN_PORTAL_ID } from './chronicles/chroniclesSwordhavenReturnPortal.js';
import { chroniclesVolleyProjectileKinds, createChroniclesVolleyProjectileArt } from './chronicles/chroniclesVolleyProjectileArt.js';
import { CHRONICLES_VOLLEY_MAX_DURATION, chroniclesVolleyMatchesLaunchPose, chroniclesVolleyObstacleDistance, chroniclesVolleyVisibleFlight } from './chronicles/chroniclesVolleyMotion.js';

const CELL = 4;
const CAMERA_Y = 1.62;
const TORCH_WALL_OFFSET = 1.9;
const EXIT_GATE_WALL_OFFSET = 1.45;
const DEFAULT_SCENE_CENTER = Object.freeze({ x: 3, y: 3 });
const EXIT_GATE_SIDES = Object.freeze([
  Object.freeze({ side: 'north', dx: 0, dy: -1, yaw: 0 }),
  Object.freeze({ side: 'east', dx: 1, dy: 0, yaw: -Math.PI / 2 }),
  Object.freeze({ side: 'south', dx: 0, dy: 1, yaw: Math.PI }),
  Object.freeze({ side: 'west', dx: -1, dy: 0, yaw: Math.PI / 2 }),
]);
const ATTACK_FX = Object.freeze({
  matthias: Object.freeze({ color: 0xd5aa62, angle: -0.18, width: 0.9, ring: 0.78 }),
  rook: Object.freeze({ color: 0xc96a3e, angle: 0.04, width: 1.3, ring: 1.18 }),
  bishop: Object.freeze({ color: 0xf0c66d, angle: 0.72, width: 1.05, ring: 0.92 }),
  knight: Object.freeze({ color: 0x8da8bd, angle: -0.62, width: 1.12, ring: 0.86 }),
});

export const CHRONICLES_TORCH_PLACEMENTS = Object.freeze([
  Object.freeze({ x: 1, y: 5, side: 'west', intensity: 0.74, flameScale: 0.7 }),
  Object.freeze({ x: 2, y: 5, side: 'north', intensity: 0.5, flameScale: 0.68 }),
  Object.freeze({ x: 4, y: 5, side: 'south', intensity: 0.72, flameScale: 0.82 }),
  Object.freeze({ x: 5, y: 5, side: 'east' }),
  Object.freeze({ x: 1, y: 3, side: 'west' }),
  Object.freeze({ x: 5, y: 3, side: 'east' }),
  Object.freeze({ x: 2, y: 1, side: 'north' }),
  Object.freeze({ x: 5, y: 1, side: 'north' }),
]);

function worldForCell(x, y, center = DEFAULT_SCENE_CENTER) {
  return new THREE.Vector3(
    (x - Number(center?.x ?? DEFAULT_SCENE_CENTER.x)) * CELL,
    CAMERA_Y,
    (y - Number(center?.y ?? DEFAULT_SCENE_CENTER.y)) * CELL,
  );
}

// Enemy art is authored facing local +Z. Point that axis at the party instead
// of inheriting the old fixed chess-piece yaw: asymmetric fantasy enemies
// (especially the ash goblin) otherwise become a near-invisible side profile
// while still legitimately blocking their runtime cell.
const CHRONICLES_FIRST_PERSON_VFOV = 67;
const CHRONICLES_FIRST_PERSON_MAX_HFOV = 96;

// Vertical field of view for a viewport aspect. A fixed 67° vertical FOV on a
// wide desktop canvas (≈2.5:1) opens ~117° horizontally: buildings at the
// screen edges stretch and look taller and nearer than the ones ahead. Cap
// the horizontal FOV so wide screens see more world, not a fisheye.
export function chroniclesFirstPersonFov(aspect) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const maxHalfH = THREE.MathUtils.degToRad(CHRONICLES_FIRST_PERSON_MAX_HFOV / 2);
  const cappedV = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(maxHalfH) / safeAspect));
  return Math.min(CHRONICLES_FIRST_PERSON_VFOV, cappedV);
}

export function chroniclesEnemyFacingYaw(enemyCell, partyCell) {
  const dx = Number(partyCell?.x) - Number(enemyCell?.x);
  const dy = Number(partyCell?.y) - Number(enemyCell?.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return 0;
  return Math.atan2(dx, dy);
}

// The entrance seal is mounted only 1.45m from the player's eye. At a
// portrait phone aspect ratio, perspective magnifies even a 72cm plaque.
// Keep a consistent eye-level centre while fitting the narrow camera frustum.
export function chroniclesReturnSealFraming(coarsePointer = false) {
  const scale = coarsePointer ? 0.30 : 0.62;
  return { scale, lift: CAMERA_Y * (1 - scale) };
}

export function chroniclesExitGateTransform(grid, entry, center = DEFAULT_SCENE_CENTER) {
  const x = Number(entry?.position?.x ?? entry?.x);
  const y = Number(entry?.position?.y ?? entry?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const cell = worldForCell(x, y, center);
  // Entries may request a particular wall when more than one borders the
  // tile. The return portal must face the party at the western entrance, not
  // get accidentally mounted to the southern wall by iteration order.
  const preferred = EXIT_GATE_SIDES.find(({ side, dx, dy }) => (
    side === entry?.wallSide && grid?.[y + dy]?.[x + dx] === '#'
  ));
  const wallSide = preferred || EXIT_GATE_SIDES.find(({ dx, dy }) => grid?.[y + dy]?.[x + dx] === '#') || null;
  if (!wallSide) {
    return {
      position: new THREE.Vector3(cell.x, 0, cell.z),
      yaw: 0,
      side: null,
    };
  }

  return {
    position: new THREE.Vector3(
      cell.x + wallSide.dx * EXIT_GATE_WALL_OFFSET,
      0,
      cell.z + wallSide.dy * EXIT_GATE_WALL_OFFSET,
    ),
    yaw: wallSide.yaw,
    side: wallSide.side,
  };
}

export function chroniclesTorchTransform(x, y, side, center = DEFAULT_SCENE_CENTER) {
  const cell = worldForCell(x, y, center);
  const faces = {
    west: { dx: -TORCH_WALL_OFFSET, dz: 0, yaw: 0 },
    east: { dx: TORCH_WALL_OFFSET, dz: 0, yaw: Math.PI },
    north: { dx: 0, dz: -TORCH_WALL_OFFSET, yaw: -Math.PI / 2 },
    south: { dx: 0, dz: TORCH_WALL_OFFSET, yaw: Math.PI / 2 },
  };
  const face = faces[side];
  if (!face) throw new Error(`Unknown Chronicles torch wall side: ${side}`);
  return {
    position: new THREE.Vector3(cell.x + face.dx, 2.12, cell.z + face.dz),
    yaw: face.yaw,
  };
}

function createTorchFlameGeometry(coarsePointer) {
  // Revolve a small hand-authored profile into a teardrop. It keeps the flame
  // lightweight while avoiding the unmistakable triangular silhouette of a cone.
  const profile = [
    new THREE.Vector2(0.012, 0.00),
    new THREE.Vector2(0.066, 0.032),
    new THREE.Vector2(0.094, 0.105),
    new THREE.Vector2(0.082, 0.195),
    new THREE.Vector2(0.052, 0.29),
    new THREE.Vector2(0.021, 0.372),
    new THREE.Vector2(0.004, 0.432),
  ];
  return new THREE.LatheGeometry(profile, coarsePointer ? 10 : 18);
}

function createDungeonScene(scene, { coarsePointer = false, scenePlan = null } = {}) {
  const grid = scenePlan?.grid || [];
  const enemyDefinitions = scenePlan?.enemies || [];
  const sceneCenter = scenePlan?.center || DEFAULT_SCENE_CENTER;
  const width = Math.max(1, Number(scenePlan?.width) || Math.max(0, ...grid.map((row) => row?.length || 0)));
  const height = Math.max(1, Number(scenePlan?.height) || grid.length);
  const stoneMaterials = Array.from({ length: 3 }, () => (
    new THREE.MeshStandardMaterial({ color: 0x3d3a35, roughness: 0.96, metalness: 0.02 })
  ));
  const authoredStoneMaterials = new Map();
  const wallMaterialFor = (x, y) => {
    const token = scenePlan?.materials?.wallGrid?.[y]?.[x];
    const profileId = token ? scenePlan?.materials?.wallLegend?.[token] : null;
    if (!profileId) return stoneMaterials[Math.abs(x * 31 + y * 17) % stoneMaterials.length];
    if (!authoredStoneMaterials.has(profileId)) {
      const material = new THREE.MeshStandardMaterial({ color: 0x3d3a35, roughness: 0.96, metalness: 0.02 });
      material.userData.chroniclesMaterialProfileId = profileId;
      authoredStoneMaterials.set(profileId, material);
    }
    return authoredStoneMaterials.get(profileId);
  };
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 1, metalness: 0 });
  const mortar = new THREE.MeshStandardMaterial({ color: 0x272522, roughness: 1, metalness: 0 });
  const floor = new THREE.MeshStandardMaterial({ color: 0x27241f, roughness: 0.92, metalness: 0.03 });

  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(CELL * width, 0.28, CELL * height), floor);
  floorMesh.position.y = -0.18;
  floorMesh.receiveShadow = true;
  floorMesh.name = 'chronicles-first-person-floor';
  scene.add(floorMesh);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(CELL * width, 0.24, CELL * height), darkStone);
  ceiling.position.y = 3.55;
  ceiling.name = 'chronicles-first-person-ceiling';
  scene.add(ceiling);

  const wallGeometry = new THREE.BoxGeometry(CELL, 3.6, CELL);
  grid.forEach((row, y) => {
    [...row].forEach((tile, x) => {
      if (tile !== '#') return;
      const wallMaterial = wallMaterialFor(x, y);
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      const p = worldForCell(x, y, sceneCenter);
      wall.position.set(p.x, 1.72, p.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      wall.name = `chronicles-first-person-wall-${x}-${y}`;
      scene.add(wall);

      if ((x + y) % 2 === 0) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.94, 0.07, CELL * 1.01), mortar);
        band.position.set(p.x, 1.05 + ((x * 3 + y) % 3) * 0.72, p.z);
        band.receiveShadow = true;
        band.name = `chronicles-first-person-wall-band-${x}-${y}`;
        scene.add(band);
      }
    });
  });

  const sigilMaterial = new THREE.MeshStandardMaterial({ color: 0x715321, roughness: 0.45, metalness: 0.55, emissive: 0x241300, emissiveIntensity: 0.3 });
  const sigil = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 28), sigilMaterial);
  const sigilCell = worldForCell(3, 4, sceneCenter);
  sigil.position.set(sigilCell.x, 0.035, sigilCell.z);
  sigil.rotation.x = -Math.PI / 2;
  sigil.receiveShadow = true;
  sigil.visible = Boolean(scenePlan?.useAuthoredCryptDressing);
  scene.add(sigil);

  const enemyModels = {};
  enemyDefinitions.forEach((enemyDefinition) => {
    const visual = buildChroniclesEnemyVisual(enemyDefinition.visualType || enemyDefinition.id, { coarsePointer, sprites: true });
    const enemy = visual?.model;
    if (!enemy) return;
    enemyModels[enemyDefinition.id] = enemy;
    const enemyCell = worldForCell(enemyDefinition.x, enemyDefinition.y, sceneCenter);
    enemy.position.set(enemyCell.x, 0, enemyCell.z);
    const authoredScale = Number(enemyDefinition.visualScale);
    const legacyScale = enemyDefinition.id === 'gate-jailer' ? 1.16 : 1.08;
    enemy.scale.setScalar(Number.isFinite(authoredScale) ? authoredScale : legacyScale);
    enemy.rotation.y = enemyDefinition.id === 'gate-jailer' ? 0 : Math.PI;
    enemy.userData.chroniclesBaseYaw = enemy.rotation.y;
    enemy.userData.chroniclesBaseScale = enemy.scale.x;
    enemy.userData.chroniclesTargetPosition = new THREE.Vector3(enemyCell.x, 0, enemyCell.z);
    const spriteHeight = enemy.userData.chroniclesBillboard?.sprite?.scale.y || 2.5;
    const nameplate = buildChroniclesEnemyNameplate(enemyDefinition, spriteHeight);
    if (nameplate) {
      enemy.add(nameplate.sprite);
      enemy.userData.chroniclesEnemyNameplate = nameplate;
    }
    scene.add(enemy);
  });

  const spectralChapel = buildSpectralChapel({ coarsePointer });
  const spectralChapelCell = worldForCell(5, 3, sceneCenter);
  spectralChapel.position.set(spectralChapelCell.x, 0, spectralChapelCell.z);
  spectralChapel.visible = Boolean(scenePlan?.useAuthoredCryptDressing);
  scene.add(spectralChapel);

  const gateMaterial = new THREE.MeshStandardMaterial({ color: 0x171513, roughness: 0.66, metalness: 0.72, emissive: 0x120700, emissiveIntensity: 0.15 });
  const gateRunes = [];
  const exitDefinitions = (scenePlan?.content || []).filter((entry) => (
    entry?.kind === 'exit'
    && entry?.visible !== false
    && entry?.position
  ));
  exitDefinitions.forEach((exitDefinition) => {
    const transform = chroniclesExitGateTransform(grid, exitDefinition, sceneCenter);
    if (!transform) return;

    const isSwordhavenReturn = exitDefinition.id === CHRONICLES_SWORDHAVEN_RETURN_PORTAL_ID;
    const gate = new THREE.Group();
    gate.name = `chronicles-first-person-exit-${exitDefinition.id}`;
    gate.userData.chroniclesContentId = exitDefinition.id;

    if (isSwordhavenReturn) {
      // A full-size gate is illegible when the camera stands on the entrance
      // tile: at mobile FOV its 3-metre frame fills the entire screen. Mount
      // a small enchanted return seal at eye height instead. It is a visual
      // marker only, with the same real contextual interaction and no collider.
      const plaqueMaterial = new THREE.MeshStandardMaterial({
        color: 0x283a37, roughness: 0.72, metalness: 0.46,
        emissive: 0x0c2724, emissiveIntensity: 0.38,
      });
      const bronzeMaterial = new THREE.MeshStandardMaterial({
        color: 0x9e9275, roughness: 0.42, metalness: 0.7,
        emissive: 0x285249, emissiveIntensity: 0.42,
      });
      const runeMaterial = new THREE.MeshStandardMaterial({
        color: 0xc9eadb, roughness: 0.34, metalness: 0.3,
        emissive: 0x4c987d, emissiveIntensity: 1.1,
      });
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.96, 0.11), plaqueMaterial);
      plaque.position.set(0, 1.62, 0);
      plaque.castShadow = true;
      plaque.receiveShadow = true;
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 9, 28), bronzeMaterial);
      arch.position.set(0, 1.62, 0.09);
      arch.name = 'chronicles-swordhaven-return-portal-arch';
      const sigil = new THREE.Mesh(new THREE.OctahedronGeometry(0.115, 0), runeMaterial);
      sigil.position.set(0, 1.62, 0.135);
      sigil.name = `chronicles-first-person-exit-rune-${exitDefinition.id}`;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.15), bronzeMaterial);
      lintel.position.set(0, 2.12, 0.04);
      const sill = lintel.clone();
      sill.position.y = 1.12;
      const halo = new THREE.PointLight(0x80ceb4, coarsePointer ? 0.38 : 0.58, 2.3, 2);
      halo.position.set(0, 1.62, 0.4);
      gate.add(plaque, arch, sigil, lintel, sill, halo);
    } else {
      // Keep historical dungeon exits unchanged; their rune illumination
      // continues to track the crypt's sigil puzzle state.
      const gatePanel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.05, 0.28), gateMaterial);
      gatePanel.position.y = 1.48;
      gatePanel.castShadow = true;
      gatePanel.receiveShadow = true;
      const gateRune = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.09, 8, 24), sigilMaterial.clone());
      gateRune.position.set(0, 1.55, 0.17);
      gateRune.name = `chronicles-first-person-exit-rune-${exitDefinition.id}`;
      const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.2, 0.36), sigilMaterial);
      leftPost.position.set(-1.36, 1.52, 0);
      const rightPost = leftPost.clone();
      rightPost.position.x = 1.36;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.88, 0.16, 0.36), sigilMaterial);
      lintel.position.set(0, 3.06, 0);
      gate.add(gatePanel, gateRune, leftPost, rightPost, lintel);
      gateRunes.push(gateRune);
    }
    gate.position.copy(transform.position);
    gate.rotation.y = transform.yaw;
    if (isSwordhavenReturn) {
      const framing = chroniclesReturnSealFraming(coarsePointer);
      gate.scale.setScalar(framing.scale);
      // Scale around camera eye height, not floor level: otherwise a small
      // plaque ends up at the player's feet and behind the touch controls.
      gate.position.y += framing.lift;
    }
    scene.add(gate);

  });


  const contentProps = [];
  const contentMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b6a35,
    roughness: 0.58,
    metalness: 0.52,
  });
  const pickupMaterial = new THREE.MeshStandardMaterial({
    color: 0xd7aa54,
    roughness: 0.28,
    metalness: 0.18,
    emissive: 0x7a3e0d,
    emissiveIntensity: 1.35,
  });

  (scenePlan?.content || []).forEach((entry, index) => {
    if (!entry?.position || ['trigger', 'exit', 'trap'].includes(entry.kind)) return;
    const cell = worldForCell(entry.position.x, entry.position.y, sceneCenter);
    const root = new THREE.Group();
    root.name = `chronicles-first-person-${entry.kind}-${entry.id}`;
    root.userData.chroniclesContentId = entry.id;
    root.position.set(cell.x, 0, cell.z);

    if (entry.kind === 'lever') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.24, 0.48), contentMaterial);
      base.position.set(0, 0.12, 0);
      base.castShadow = !coarsePointer;
      base.receiveShadow = true;
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.28, 0);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.86, 10), contentMaterial);
      stem.position.y = 0.4;
      stem.castShadow = !coarsePointer;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), contentMaterial);
      knob.position.y = 0.84;
      knob.castShadow = !coarsePointer;
      pivot.add(stem, knob);
      root.add(base, pivot);
      contentProps.push({ id: entry.id, kind: entry.kind, root, pivot, phase: index * 1.17 });
    } else if (entry.kind === 'pickup') {
      const cradle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 8, coarsePointer ? 16 : 24), contentMaterial);
      cradle.rotation.x = -Math.PI / 2;
      cradle.position.y = 0.16;
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.27, 0), pickupMaterial);
      core.position.y = 0.58;
      core.castShadow = !coarsePointer;
      const glow = new THREE.PointLight(0xe49b39, coarsePointer ? 0.72 : 1.05, 4.2, 2);
      glow.position.y = 0.58;
      root.add(cradle, core, glow);
      contentProps.push({ id: entry.id, kind: entry.kind, root, core, glow, phase: index * 1.17 });
    } else if (entry.kind === 'lore' && chroniclesHasSpriteBillboard(entry.visualType)) {
      // A character in the dungeon (a ghost, a king of stone) is a painted
      // billboard, like the creatures; a plain lore entry stays a plaque.
      const billboard = buildChroniclesSpriteBillboard(entry.visualType);
      root.add(billboard);
      root.userData.updateChroniclesSprite = billboard.userData.updateChroniclesSprite;
      contentProps.push({ id: entry.id, kind: entry.kind, root, phase: index * 1.17 });
    } else if (entry.kind === 'lore') {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.46), contentMaterial);
      plinth.position.y = 0.08;
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.72, 0.12), contentMaterial);
      plaque.position.set(0, 0.55, 0);
      plaque.rotation.x = -0.18;
      plaque.castShadow = !coarsePointer;
      root.add(plinth, plaque);
      contentProps.push({ id: entry.id, kind: entry.kind, root, phase: index * 1.17 });
    } else if (entry.kind === 'relic-socket') {
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.46, 12), contentMaterial);
      pedestal.position.y = 0.23;
      const socket = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 8, 20), pickupMaterial);
      socket.position.y = 0.5;
      socket.rotation.x = -Math.PI / 2;
      const glow = new THREE.PointLight(0xd99438, coarsePointer ? 0.45 : 0.72, 3.2, 2);
      glow.position.y = 0.55;
      root.add(pedestal, socket, glow);
      contentProps.push({ id: entry.id, kind: entry.kind, root, glow, phase: index * 1.17 });
    } else {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.45, 0.18), contentMaterial);
      frame.position.y = 0.72;
      frame.castShadow = !coarsePointer;
      const sigil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 20), pickupMaterial);
      sigil.position.set(0, 0.78, 0.12);
      root.add(frame, sigil);
      contentProps.push({ id: entry.id, kind: entry.kind, root, phase: index * 1.17 });
    }
    root.visible = Boolean(entry.visible);
    scene.add(root);
  });

  const torchMaterial = new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.7, metalness: 0.45 });
  const flameMaterial = new THREE.MeshStandardMaterial({ color: 0xff9b35, roughness: 0.42, emissive: 0xff5414, emissiveIntensity: 2.8 });
  const flameCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xffc978,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const sootMaterial = new THREE.MeshBasicMaterial({
    color: 0x171411,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const torches = [];
  // Generated dungeons spread their torches over the whole maze; the lights
  // themselves come from a small pool lent to the torches nearest the party.
  const generatedDungeon = scenePlan?.useAuthoredCryptDressing === false;
  const torchPlacements = scenePlan?.useAuthoredCryptDressing
    ? CHRONICLES_TORCH_PLACEMENTS
    : generatedDungeon
      ? chroniclesSpreadTorchPlacements(scenePlan?.wallFaces || [], { spacing: 2, max: coarsePointer ? 36 : 60 })
      : (scenePlan?.wallFaces || [])
      .filter((_, index) => index % 3 === 0)
      .slice(0, coarsePointer ? 5 : 8)
      .map((face, index) => ({
        ...face,
        intensity: 0.56 + (index % 3) * 0.1,
        flameScale: 0.68 + (index % 2) * 0.1,
      }));
  torchPlacements.forEach(({ x, y, side, intensity = 1, flameScale = 1 }, index) => {
    const transform = chroniclesTorchTransform(x, y, side, sceneCenter);
    const root = new THREE.Group();
    root.name = `chronicles-wall-torch-${index}`;

    const wallPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.3), torchMaterial);
    wallPlate.position.x = -0.035;
    wallPlate.castShadow = true;
    let soot = null;
    if (!coarsePointer) {
      soot = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), sootMaterial);
      soot.name = `chronicles-wall-torch-soot-${index}`;
      soot.position.set(-0.092, 0.18, 0);
      soot.rotation.y = Math.PI / 2;
      soot.scale.set(1.38, 1.82, 1);
      soot.castShadow = false;
      soot.receiveShadow = false;
      soot.renderOrder = 1;
    }
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.72, 8), torchMaterial);
    bracket.position.x = 0.2;
    bracket.rotation.z = Math.PI / 2;
    bracket.castShadow = true;
    // A tapered outer flame plus a small hot core reads as fire instead of a
    // glowing sphere, while keeping the same single practical light per torch.
    const emberCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.072, 0.09, coarsePointer ? 8 : 12),
      torchMaterial,
    );
    emberCup.name = `chronicles-wall-torch-cup-${index}`;
    emberCup.position.set(0.51, 0.045, 0);
    emberCup.castShadow = true;
    const emberLip = new THREE.Mesh(
      new THREE.TorusGeometry(0.112, 0.014, 5, coarsePointer ? 10 : 16),
      torchMaterial,
    );
    emberLip.name = `chronicles-wall-torch-lip-${index}`;
    emberLip.position.set(0.51, 0.088, 0);
    emberLip.rotation.x = Math.PI / 2;
    emberLip.castShadow = true;

    const flame = new THREE.Mesh(createTorchFlameGeometry(coarsePointer), flameMaterial);
    flame.scale.set(0.96 * flameScale, 1.0 * flameScale, 0.96 * flameScale);
    flame.position.set(0.51, 0.08, 0);
    const flameCore = new THREE.Mesh(createTorchFlameGeometry(coarsePointer), flameCoreMaterial);
    flameCore.scale.set(0.52 * flameScale, 0.46 * flameScale, 0.52 * flameScale);
    flameCore.position.set(0.51, 0.09, 0);
    flameCore.renderOrder = 2;
    const baseIntensity = (generatedDungeon ? (coarsePointer ? 2.3 : 2.7) : (coarsePointer ? 1.5 : 1.95)) * intensity;
    const light = generatedDungeon ? null : new THREE.PointLight(0xff7a32, baseIntensity, 9.5, 2);
    light?.position.set(0.51, 0.22, 0);
    if (light && !coarsePointer && (index === 2 || index === 3)) {
      light.castShadow = true;
      light.shadow.mapSize.set(256, 256);
      light.shadow.bias = -0.001;
      light.shadow.normalBias = 0.04;
    }
    if (soot) root.add(soot);
    root.add(wallPlate, bracket, emberCup, emberLip, flame, flameCore);
    if (light) root.add(light);
    root.position.copy(transform.position);
    root.rotation.y = transform.yaw;
    scene.add(root);
    root.updateMatrixWorld(true);
    const lightAt = root.localToWorld(new THREE.Vector3(0.51, 0.22, 0));
    torches.push({ root, flame, flameCore, light, baseIntensity, flameScale, phase: index * 1.7, lightAt });
  });

  // Braziers mark where the elite and the boss wait.
  if (generatedDungeon) {
    const ironMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.6, metalness: 0.6 });
    const coalMaterial = new THREE.MeshStandardMaterial({ color: 0x3a1408, emissive: 0xc2400c, emissiveIntensity: 1.4 });
    chroniclesBrazierPlacements(grid, enemyDefinitions).forEach((placement, index) => {
      const cell = worldForCell(placement.x, placement.y, sceneCenter);
      const root = new THREE.Group();
      root.name = `chronicles-brazier-${index}`;
      root.position.set(cell.x + placement.dx * 1.35, 0, cell.z + placement.dy * 1.35);
      for (let leg = 0; leg < 3; leg += 1) {
        const angle = (leg / 3) * Math.PI * 2;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.95, 5), ironMaterial);
        rod.position.set(Math.cos(angle) * 0.22, 0.46, Math.sin(angle) * 0.22);
        rod.rotation.set(Math.sin(angle) * 0.18, 0, -Math.cos(angle) * 0.18);
        root.add(rod);
      }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.26, 10, 1, true), ironMaterial);
      bowl.position.y = 1.0;
      const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 10), coalMaterial);
      coals.position.y = 1.08;
      const scale = placement.boss ? 2.1 : 1.7;
      const flame = new THREE.Mesh(createTorchFlameGeometry(coarsePointer), flameMaterial);
      flame.position.y = 1.1;
      const flameCore = new THREE.Mesh(createTorchFlameGeometry(coarsePointer), flameCoreMaterial);
      flameCore.position.y = 1.12;
      flameCore.renderOrder = 2;
      root.add(bowl, coals, flame, flameCore);
      scene.add(root);
      torches.push({
        root, flame, flameCore, light: null, flameScale: scale, phase: 3.1 + index * 2.3, coreBaseY: 1.16,
        baseIntensity: (coarsePointer ? 3.0 : 3.6) * (placement.boss ? 1.2 : 1),
        lightAt: new THREE.Vector3(root.position.x, 1.45, root.position.z),
      });
    });
  }

  // A fixed pool of practical lights, lent each frame to the nearest flames.
  const lightPool = generatedDungeon
    ? Array.from({ length: coarsePointer ? 4 : 7 }, (_, index) => {
      const pooled = new THREE.PointLight(0xff8a3c, 0, 11.5, 2);
      pooled.name = `chronicles-torch-light-${index}`;
      pooled.castShadow = false;
      scene.add(pooled);
      return pooled;
    })
    : [];

  const materialArt = installChroniclesFirstPersonPremiumMaterials(scene, {
    coarsePointer,
    scenePlan,
    floorRepeatScale: Math.max(width, height),
  });

  return {
    enemies: enemyModels,
    enemyDefinitions,
    spectralChapel,
    sigilMaterial,
    gateMaterial,
    gateRunes,
    torches,
    lightPool,
    contentProps,
    sceneCenter,
    materialArt,
  };
}

function disposeObject(root) {
  root?.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((entry) => entry?.dispose?.());
    else node.material?.dispose?.();
  });
}

function disposeScene(scene) {
  disposeObject(scene);
}

function configureRenderer(renderer, { coarsePointer, alpha = false, lightingProfile = 'default' }) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const exposureFloor = CHRONICLES_MINIMUM_VISIBILITY.firstPerson;
  const profileExposure = lightingProfile === 'crypt-dark' ? 0.88 : 1;
  renderer.toneMappingExposure = alpha
    ? 1.02
    : (coarsePointer
      ? Math.max(1.14, exposureFloor.exposureCoarse)
      : Math.max(1.08, exposureFloor.exposureDesktop)) * profileExposure;
  renderer.setClearColor(0x080706, alpha ? 0 : 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.2 : 1.65));
  renderer.shadowMap.enabled = !coarsePointer;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

export function chroniclesContentIdFromObject(object) {
  let current = object || null;
  while (current) {
    const id = current.userData?.chroniclesContentId;
    if (id) return id;
    current = current.parent || null;
  }
  return null;
}

function createCombatFx(camera) {
  const group = new THREE.Group();
  group.name = 'chronicles-combat-fx';
  group.visible = false;

  const slashMaterial = new THREE.MeshBasicMaterial({ color: 0xd5aa62, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const ringMaterial = slashMaterial.clone();
  const slash = new THREE.Mesh(new THREE.BoxGeometry(1, 0.035, 0.035), slashMaterial);
  slash.position.set(0, -0.12, -1.12);
  slash.renderOrder = 20;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 8, 28), ringMaterial);
  ring.position.set(0, 0.02, -1.18);
  ring.renderOrder = 20;
  group.add(slash, ring);
  camera.add(group);

  return { group, slash, ring, slashMaterial, ringMaterial };
}

// Camera-local trajectories are deterministic and independent of FPS: one
// physical projectile per valid shooter, converging into the forward view.
export function chroniclesVolleyFlightPositions(count, progress) {
  const shots = Math.max(0, Math.min(6, Math.floor(Number(count) || 0)));
  const t = THREE.MathUtils.clamp(Number(progress) || 0, 0, 1);
  return Array.from({ length: shots }, (_, index) => ({
    x: (index - (shots - 1) / 2) * 0.38 * (1 - t * 0.62),
    y: -0.34 + 0.27 * t,
    z: -0.72 - 3.8 * t,
  }));
}

export function createChroniclesOfMatthiasGame(host, {
  onReady,
  onFirstFrame,
  initialState = null,
  onContentClick = null,
} = {}) {
  if (!host) throw new Error('Chronicles of Matthias requires a host element');

  const coarse = Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
  const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const scenePlan = chroniclesFirstPersonScenePlan(initialState);
  const renderer = createExperimentalThreeRenderer({ antialias: !coarse, alpha: false, powerPreference: 'high-performance' });
  configureRenderer(renderer, {
    coarsePointer: coarse,
    lightingProfile: scenePlan?.materials?.lightingProfile,
  });
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const outdoors = scenePlan?.regionKind === 'settlement' || scenePlan?.regionKind === 'wilderness';
  // Torch-lit generated dungeons can afford to show more of the corridor.
  const fogScale = scenePlan?.useAuthoredCryptDressing === false ? 0.72 : 1;
  if (!outdoors) scene.fog = new THREE.FogExp2(0x0a0c0f, (coarse ? 0.038 : 0.034) * fogScale);
  if (!outdoors) scene.add(new THREE.HemisphereLight(0x6f8191, 0x1b130d, coarse ? 0.35 : 0.24));
  const camera = new THREE.PerspectiveCamera(CHRONICLES_FIRST_PERSON_VFOV, 1, 0.08, 70);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const combatFx = createCombatFx(camera);
  const volleyFx = createChroniclesVolleyProjectileArt(THREE, camera, scene);

  // Every authored outdoor region uses the campaign exterior, except the
  // legacy Swordhaven square, which keeps its own historic builder.
  const campaignExterior = outdoors && scenePlan?.mapId !== 'swordhaven-square';
  const dungeon = campaignExterior
    ? buildChroniclesCampaignExterior(scene, { coarsePointer: coarse, scenePlan })
    : scenePlan?.regionKind === 'settlement'
      ? buildSwordhavenScene(scene, { coarsePointer: coarse, scenePlan })
      : createDungeonScene(scene, { coarsePointer: coarse, scenePlan });
  const contentRaycaster = new THREE.Raycaster();
  const contentPointer = new THREE.Vector2();
  const dressing = scenePlan?.useAuthoredCryptDressing
    ? buildChroniclesDungeonDressing({ coarsePointer: coarse })
    : new THREE.Group();
  dressing.name ||= 'chronicles-map-specific-dressing';
  // Generated dungeons get small props against their walls (barrels, bones,
  // books...); the hand-dressed crypt keeps its authored set.
  if (!outdoors && !scenePlan?.useAuthoredCryptDressing && scenePlan?.grid?.length) {
    const start = scenePlan.partyStart || {};
    dressing.add(buildChroniclesDungeonClutter({
      grid: scenePlan.grid,
      center: dungeon.sceneCenter,
      mapId: scenePlan.mapId,
      coarsePointer: coarse,
      keepClear: [
        { x: start.x, y: start.y },
        ...(scenePlan.content || []).map((entry) => entry.position).filter(Boolean),
      ],
    }));
  }
  const atmosphere = outdoors
    ? new THREE.Group()
    : buildChroniclesDungeonAtmosphere({ coarsePointer: coarse, reducedMotion, scenePlan });
  scene.add(dressing, atmosphere);
  // The 3D world may sleep between actions; a tiny CSS-composited halo layer
  // keeps nearby, unoccluded flames alive without re-rendering the WebGL canvas.
  const ambientTorchGlows = createChroniclesTorchAmbientOverlay(host, camera, scene, dungeon.torches || [], { coarse });
  let destroyed = false;
  const firstFrameGate = createChroniclesFirstFrameGate(onFirstFrame);
  let visible = document.visibilityState !== 'hidden';
  let desiredPosition = worldForCell(
    Number(initialState?.x ?? scenePlan?.partyStart?.x ?? 1),
    Number(initialState?.y ?? scenePlan?.partyStart?.y ?? 5),
    dungeon.sceneCenter,
  );
  const initialDirection = CHRONICLES_DIRECTIONS[initialState?.direction] || CHRONICLES_DIRECTIONS[1];
  let desiredYaw = Math.atan2(-initialDirection.dx, -initialDirection.dy);
  let latestState = null;
  let attackFxStartedAt = -1;
  let attackFxConfig = ATTACK_FX.matthias;
  let volleyFxStartedAt = -1;
  let volleyFxCount = 0;
  let volleyObstacleDistance = Infinity;
  let volleyLaunchPose = null;
  const enemyHitStartedAt = new Map();
  const enemyAttackStartedAt = new Map();
  const enemyDeathStartedAt = new Map();
  const enemyMoveStartedAt = new Map();
  const enemyMoveFrom = new Map();
  const clock = new THREE.Clock();

  camera.position.copy(desiredPosition);
  camera.rotation.set(0, desiredYaw, 0);

  function resize() {
    const width = Math.max(1, host.clientWidth || 1);
    const height = Math.max(1, host.clientHeight || 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = chroniclesFirstPersonFov(camera.aspect);
    camera.updateProjectionMatrix();
    scheduler.invalidate(0);
  }

  function syncState(state) {
    const now = clock.getElapsedTime();
    const previousState = latestState;
    let animateState = !reducedMotion && Boolean(previousState && (
      state.x !== previousState.x || state.y !== previousState.y
      || state.direction !== previousState.direction
    ));
    dungeon.enemyDefinitions.forEach((enemyDefinition) => {
      const previousHp = previousState?.[enemyDefinition.hpKey];
      const nextHp = state[enemyDefinition.hpKey];
      if (previousHp != null && nextHp < previousHp) {
        enemyHitStartedAt.set(enemyDefinition.id, now);
        animateState = !reducedMotion;
      }
      const landedBlow = state.enemyTurnEvents !== previousState?.enemyTurnEvents
        && (state.enemyTurnEvents || []).some((event) => event.type === 'attack' && event.enemyId === enemyDefinition.id && !event.missed);
      if (landedBlow) {
        enemyAttackStartedAt.set(enemyDefinition.id, now);
        animateState = !reducedMotion;
      }
      if (!reducedMotion && previousHp > 0 && nextHp === 0) {
        enemyDeathStartedAt.set(enemyDefinition.id, now);
        animateState = true;
      }
    });
    desiredPosition = worldForCell(state.x, state.y, dungeon.sceneCenter);
    const direction = CHRONICLES_DIRECTIONS[state.direction];
    desiredYaw = Math.atan2(-direction.dx, -direction.dy);
    dungeon.enemyDefinitions.forEach((enemyDefinition) => {
      const enemy = dungeon.enemies[enemyDefinition.id];
      if (!enemy) return;
      const active = chroniclesEnemyIsActive(state, enemyDefinition);
      const hp = state[enemyDefinition.hpKey];
      const deathStartedAt = enemyDeathStartedAt.get(enemyDefinition.id);
      const currentCell = chroniclesEnemyPosition(state, enemyDefinition);
      let previousCell = previousState ? chroniclesEnemyPosition(previousState, enemyDefinition) : { x: enemyDefinition.x, y: enemyDefinition.y };
      if (enemyDefinition.id === 'scavenger-knight' && previousState?.jailerHp > 0 && state.jailerHp <= 0) {
        previousCell = { x: enemyDefinition.x, y: enemyDefinition.y };
      }
      if (!reducedMotion && (previousCell.x !== currentCell.x || previousCell.y !== currentCell.y)) {
        const from = worldForCell(previousCell.x, previousCell.y, dungeon.sceneCenter);
        from.y = 0;
        enemyMoveFrom.set(enemyDefinition.id, from);
        enemyMoveStartedAt.set(enemyDefinition.id, now);
        animateState = true;
      }
      const target = worldForCell(currentCell.x, currentCell.y, dungeon.sceneCenter);
      target.y = 0;
      enemy.userData.chroniclesTargetPosition = target;
      enemy.userData.chroniclesBaseYaw = chroniclesEnemyFacingYaw(currentCell, { x: state.x, y: state.y });
      if (reducedMotion) enemy.position.copy(target);
      enemy.visible = active && (hp > 0 || (!reducedMotion && deathStartedAt != null));
      enemy.userData.chroniclesEnemyNameplate?.update(active ? hp : 0, enemyDefinition.maxHp);
      if (reducedMotion && enemy.userData.updateChroniclesSprite) {
        const adjacent = Math.abs(currentCell.x - state.x) + Math.abs(currentCell.y - state.y) <= 1;
        enemy.userData.updateChroniclesSprite(0, { menace: Boolean(adjacent || state.initiative) });
      }
      const enemyGlow = enemy.userData.chroniclesGlowMaterials || [];
      enemyGlow.forEach((glow) => {
        const baseGlow = enemy.userData.chroniclesBaseGlow || 1.7;
        glow.emissiveIntensity = hp === 1 ? baseGlow + 1.1 : baseGlow;
      });
    });
    latestState = state;
    if (volleyFxCount > 0 && !chroniclesVolleyMatchesLaunchPose(volleyLaunchPose, state)) {
      // The projectile mesh is a camera child. Cancel a stale visual instead
      // of swinging its trajectory with a later movement/turn action.
      volleyFxCount = 0;
      volleyFxStartedAt = -1;
      volleyLaunchPose = null;
      volleyFx.group.visible = false;
    }
    (dungeon.spectralChapel.userData.chroniclesGlowMaterials || []).forEach((glow) => {
      glow.emissiveIntensity = state.sigilAwake ? 1.25 : 0.18;
    });
    (dungeon.spectralChapel.userData.chroniclesLights || []).forEach((light) => {
      light.intensity = state.sigilAwake ? (coarse ? 0.62 : 1.05) : 0.08;
    });
    dungeon.sigilMaterial.emissive.setHex(state.sigilAwake ? 0x7e3c0a : 0x241300);
    dungeon.sigilMaterial.emissiveIntensity = state.sigilAwake ? 1.8 : 0.3;
    dungeon.gateMaterial.emissive.setHex(state.sigilAwake ? 0x4e2705 : 0x120700);
    dungeon.gateMaterial.emissiveIntensity = state.sigilAwake ? 0.9 : 0.15;
    dungeon.gateRunes.forEach((gateRune) => {
      gateRune.material.emissive.setHex(state.sigilAwake ? 0xcc6a16 : 0x241300);
      gateRune.material.emissiveIntensity = state.sigilAwake ? 2.2 : 0.25;
    });
    const contentVisualById = new Map(
      chroniclesContentVisualStates(state).map((entry) => [entry.id, entry]),
    );
    dungeon.contentProps.forEach((prop) => {
      const visual = contentVisualById.get(prop.id);
      prop.root.visible = Boolean(visual?.visible);
      if (prop.root.userData.updateChroniclesSprite) {
        const position = visual?.position;
        prop.root.userData.chroniclesSpriteCues = {
          grateful: Boolean(visual?.activated),
          speaking: Boolean(position && Math.abs(position.x - state.x) + Math.abs(position.y - state.y) <= 1),
        };
        // Reduced motion: no idle loop, but the frame still tells the truth.
        if (reducedMotion) prop.root.userData.updateChroniclesSprite(0, prop.root.userData.chroniclesSpriteCues);
      }
      if (prop.activatedRoot) prop.activatedRoot.visible = Boolean(visual?.activated);
      if (prop.kind === 'lever' && prop.pivot) {
        prop.pivot.rotation.z = visual?.activated ? -0.86 : 0.48;
      }
    });
    (dressing.userData.chroniclesRuneMaterials || []).forEach((runeMaterial) => {
      runeMaterial.emissive.setHex(state.sigilAwake ? 0x9d410b : 0x4b1d05);
      runeMaterial.emissiveIntensity = state.sigilAwake ? 1.35 : 0.55;
    });
    firstFrameGate.markStateSynchronized();
    if (reducedMotion) {
      camera.position.copy(desiredPosition);
      camera.rotation.y = desiredYaw;
    }
    // A changed view paints once; movement and impacts get a short animation
    // window. The GPU stays idle while the player is waiting.
    scheduler.invalidate(animateState ? 1050 : 0);
  }

  function playAttack(memberId) {
    if (reducedMotion) return;
    attackFxConfig = ATTACK_FX[memberId] || ATTACK_FX.matthias;
    attackFxStartedAt = clock.getElapsedTime();
    combatFx.slashMaterial.color.setHex(attackFxConfig.color);
    combatFx.ringMaterial.color.setHex(attackFxConfig.color);
    combatFx.slash.rotation.z = attackFxConfig.angle;
    combatFx.slash.scale.set(attackFxConfig.width, 1, 1);
    combatFx.ring.scale.setScalar(attackFxConfig.ring);
    combatFx.group.visible = true;
    scheduler.invalidate(450);
  }

  function playVolley(shooterIds = []) {
    if (reducedMotion || destroyed) return;
    volleyFxCount = volleyFx.setFamilies(chroniclesVolleyProjectileKinds(latestState, shooterIds));
    if (volleyFxCount > 0) volleyFx.anchorLaunchPose(desiredYaw);
    volleyLaunchPose = volleyFxCount > 0 && latestState
      ? { x: latestState.x, y: latestState.y, direction: latestState.direction }
      : null;
    // Snapshot the wall in front of the party at shot time. Generated house
    // facades and shop doors share scenePlan.grid's solid '#' cells.
    volleyObstacleDistance = chroniclesVolleyObstacleDistance(
      scenePlan?.grid,
      latestState && { x: latestState.x, y: latestState.y },
      CHRONICLES_DIRECTIONS[latestState?.direction],
      CELL,
      // The 3D inn/shop doors project as much as ~0.44 m toward the street
      // from the solid tile boundary. Stop before the wood and stone frames.
      scenePlan?.regionKind === 'settlement' ? 0.55 : 0.08,
    );
    volleyFxStartedAt = clock.getElapsedTime();
    volleyFx.group.visible = volleyFxCount > 0;
    if (volleyFxCount > 0) scheduler.invalidate(Math.ceil(CHRONICLES_VOLLEY_MAX_DURATION * 1000) + 100);
  }

  function wrapAngle(value) {
    let angle = value;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  // Preserve a pool light's source identity when distances exchange rank.
  // A new source fades in from darkness at its own location; no full-strength
  // point light can teleport across the camera as the player crosses a tile.
  let pooledAssignments = [];
  let pooledGains = [];
  let pooledLightTime = null;
  function lendTorchLights(time) {
    const pool = dungeon.lightPool || [];
    if (!pool.length) return;
    const lit = dungeon.torches.filter((torch) => torch.lightAt);
    if (!lit.length) return;
    const nearest = chroniclesNearestLightSources(
      lit.map((torch) => torch.lightAt), camera.position.x, camera.position.z, pool.length,
    );
    const assigned = chroniclesStableTorchLightAssignments(pooledAssignments, nearest, pool.length);
    const dt = pooledLightTime === null ? 0.1 : Math.max(0, time - pooledLightTime);
    pooledLightTime = time;
    pool.forEach((light, slot) => {
      const source = assigned[slot];
      const torch = source === null ? null : lit[source];
      if (!torch) {
        light.intensity = 0;
        pooledGains[slot] = 0;
        return;
      }
      const changed = source !== pooledAssignments[slot];
      pooledGains[slot] = chroniclesTorchLightGain(pooledGains[slot], dt, changed);
      if (changed) light.position.copy(torch.lightAt);
      light.intensity = torch.baseIntensity * (torch.pulse ?? 1) * pooledGains[slot];
    });
    pooledAssignments = assigned;
  }

  function render(settled = false) {
    if (destroyed || !visible) return;
    const time = clock.getElapsedTime();
    if (settled) {
      // Even throttled tabs must finish exactly at the target grid pose.
      camera.position.copy(desiredPosition);
      camera.rotation.y = desiredYaw;
    }
    lendTorchLights(time);
    if (!reducedMotion) {
      camera.position.lerp(desiredPosition, 0.16);
      camera.rotation.y += wrapAngle(desiredYaw - camera.rotation.y) * 0.18;
      dungeon.torches.forEach((torch) => {
        const pulse = 0.9 + Math.sin(time * 8.5 + torch.phase) * 0.08 + Math.sin(time * 17 + torch.phase) * 0.04;
        torch.pulse = pulse;
        if (torch.light) torch.light.intensity = torch.baseIntensity * pulse;
        const width = 0.91 + (pulse - 0.9) * 0.42;
        const flameScale = torch.flameScale || 1;
        torch.flame.scale.set(width * flameScale, (1.03 + pulse * 0.13) * flameScale, width * flameScale);
        torch.flame.rotation.z = Math.sin(time * 5.7 + torch.phase) * 0.085;
        const corePulse = 0.88 + (pulse - 0.9) * 0.32;
        torch.flameCore.scale.set(
          corePulse * flameScale,
          (1.22 + (pulse - 0.9) * 0.28) * flameScale,
          corePulse * flameScale,
        );
        torch.flameCore.position.y = (torch.coreBaseY ?? 0.18) + Math.sin(time * 9.4 + torch.phase) * 0.008;
      });

      dungeon.contentProps.forEach((prop) => {
        if (prop.root.visible && prop.root.userData.updateChroniclesSprite) {
          prop.root.userData.updateChroniclesSprite(time + prop.phase, prop.root.userData.chroniclesSpriteCues);
        }
        if (!prop.root.visible || prop.kind !== 'pickup' || !prop.core) return;
        prop.core.rotation.y = time * 0.75 + prop.phase;
        prop.core.position.y = 0.58 + Math.sin(time * 2.2 + prop.phase) * 0.06;
        if (prop.glow) prop.glow.intensity = (coarse ? 0.72 : 1.05) * (0.9 + Math.sin(time * 2.4 + prop.phase) * 0.1);
      });

      dungeon.enemyDefinitions.forEach((enemyDefinition, index) => {
        const enemy = dungeon.enemies[enemyDefinition.id];
        if (!enemy) return;
        const active = latestState ? chroniclesEnemyIsActive(latestState, enemyDefinition) : enemyDefinition.activation === 'always';
        const hp = latestState?.[enemyDefinition.hpKey] ?? enemyDefinition.maxHp;
        const baseYaw = enemy.userData.chroniclesBaseYaw || 0;
        const baseScale = enemy.userData.chroniclesBaseScale || 1;
        const hitStartedAt = enemyHitStartedAt.get(enemyDefinition.id) ?? -1;
        const deathStartedAt = enemyDeathStartedAt.get(enemyDefinition.id);
        const target = enemy.userData.chroniclesTargetPosition || enemy.position;
        const moveStartedAt = enemyMoveStartedAt.get(enemyDefinition.id) ?? -1;
        const moveFrom = enemyMoveFrom.get(enemyDefinition.id);
        const moveElapsed = time - moveStartedAt;
        const moving = Boolean(moveFrom && moveElapsed >= 0 && moveElapsed < 0.46);
        let gaitSway = 0;

        if (moving) {
          const progress = moveElapsed / 0.46;
          // A grounded stride, not a ballistic jump: the creature advances
          // along the grid while keeping its feet on the dungeon floor.
          const eased = progress * progress * (3 - 2 * progress);
          enemy.position.x = THREE.MathUtils.lerp(moveFrom.x, target.x, eased);
          enemy.position.z = THREE.MathUtils.lerp(moveFrom.z, target.z, eased);
          gaitSway = Math.sin(progress * Math.PI * 4) * Math.sin(progress * Math.PI) * 0.035;
        } else {
          enemy.position.x = target.x;
          enemy.position.z = target.z;
        }

        if (active && hp > 0) {
          const hitElapsed = time - hitStartedAt;
          const hitKick = hitElapsed >= 0 && hitElapsed < 0.24 ? Math.sin((hitElapsed / 0.24) * Math.PI) : 0;
          if (enemy.userData.updateChroniclesSprite) {
            // 2.5D billboard: frames carry the motion; menace when engaged
            // next to the party, hurt for a beat after a blow.
            const cell = latestState ? chroniclesEnemyPosition(latestState, enemyDefinition) : null;
            const adjacent = cell && latestState
              && Math.abs(cell.x - latestState.x) + Math.abs(cell.y - latestState.y) <= 1;
            const attackElapsed = time - (enemyAttackStartedAt.get(enemyDefinition.id) ?? -10);
            enemy.userData.updateChroniclesSprite(time + index * 0.37, {
              hurt: hitElapsed >= 0 && hitElapsed < 0.42,
              attacking: attackElapsed >= 0 && attackElapsed < 0.5,
              menace: Boolean(adjacent || latestState?.initiative),
            });
          }
          enemy.visible = true;
          enemy.rotation.y = baseYaw + Math.sin(time * 0.9 + index) * 0.1 + hitKick * 0.16 + gaitSway;
          enemy.rotation.z = hitKick * -0.08;
          enemy.position.y = 0;
          enemy.scale.setScalar(baseScale + hitKick * 0.07);
        } else if (active && deathStartedAt != null) {
          const deathElapsed = time - deathStartedAt;
          if (enemy.userData.updateChroniclesSprite && deathElapsed < 0.9) {
            // Billboards collapse into their own "dead" frame instead of
            // shrinking geometry, then fade out of the cell.
            enemy.visible = true;
            enemy.userData.updateChroniclesSprite(time, { dead: true });
            enemy.userData.setChroniclesSpriteOpacity?.(deathElapsed < 0.55 ? 1 : 1 - (deathElapsed - 0.55) / 0.35);
            enemy.position.y = 0;
            enemy.rotation.z = 0;
            enemy.scale.setScalar(baseScale);
          } else if (deathElapsed < 0.5) {
            enemy.visible = true;
            enemy.position.y = -Math.max(0, deathElapsed) * 1.45;
            enemy.rotation.z = Math.max(0, deathElapsed) * 1.4;
            enemy.scale.setScalar(Math.max(baseScale * 0.48, baseScale - Math.max(0, deathElapsed) * 0.72));
          } else {
            enemy.visible = false;
          }
        } else {
          enemy.visible = false;
        }
      });

      const volleyElapsed = time - volleyFxStartedAt;
      const volleyVisible = volleyFxCount > 0 && volleyElapsed >= 0
        && volleyElapsed < CHRONICLES_VOLLEY_MAX_DURATION;
      volleyFx.group.visible = volleyVisible;
      if (volleyVisible) {
        volleyFx.projectiles.forEach((projectile, index) => {
          const flight = chroniclesVolleyVisibleFlight(
            volleyFxCount, index, volleyElapsed, projectile.userData.volleyKind,
            volleyObstacleDistance,
          );
          projectile.visible = Boolean(flight);
          if (!flight) return;
          projectile.position.set(flight.x, flight.y, flight.z);
          projectile.rotation.set(flight.pitch, flight.yaw, flight.roll);
          projectile.scale.setScalar(flight.scale);
        });
      }

      const fxElapsed = time - attackFxStartedAt;
      if (fxElapsed >= 0 && fxElapsed < 0.24) {
        const progress = fxElapsed / 0.24;
        combatFx.group.visible = true;
        combatFx.slashMaterial.opacity = (1 - progress) * 0.82;
        combatFx.ringMaterial.opacity = (1 - progress) * 0.54;
        const ringScale = attackFxConfig.ring * (0.7 + progress * 0.9);
        combatFx.ring.scale.setScalar(ringScale);
        combatFx.slash.position.x = (progress - 0.5) * 0.24;
      } else {
        combatFx.group.visible = false;
      }
    }
    // Party-carried light is gameplay visibility, not a decorative animation.
    // Keep it synced on every frame, including prefers-reduced-motion.
    atmosphere.userData.updateChroniclesAtmosphere?.(time);
    renderer.render(scene, camera);
    ambientTorchGlows.update();
    firstFrameGate.markFrameRendered();
  }

  const scheduler = createChroniclesFrameScheduler({
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => cancelAnimationFrame(id),
    now: () => performance.now(),
    draw: render,
  });
  scheduler.setVisible(visible);

  const onContentPointerUp = (event) => {
    if (typeof onContentClick !== 'function') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    contentPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    contentPointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    contentRaycaster.setFromCamera(contentPointer, camera);
    const roots = dungeon.contentProps
      .map((entry) => entry.root)
      .filter((root) => root?.visible);
    const hit = contentRaycaster.intersectObjects(roots, true)[0];
    const contentId = chroniclesContentIdFromObject(hit?.object);
    if (contentId) onContentClick(contentId);
  };
  renderer.domElement.addEventListener('pointerup', onContentPointerUp);

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(host);
  const onWindowResize = () => resize();
  if (!observer) window.addEventListener('resize', onWindowResize);
  const onVisibility = () => {
    visible = document.visibilityState !== 'hidden';
    scheduler.setVisible(visible);
    ambientTorchGlows.setVisible(visible);
  };
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  onReady?.('THREE.JS · FIRST PERSON');

  return {
    renderState: syncState,
    playAttack,
    playVolley,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scheduler.dispose();
      ambientTorchGlows.dispose();
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('pointerup', onContentPointerUp);
      dungeon.materialArt?.userData.chroniclesArtCancel?.();
      dungeon.enemyDefinitions.forEach((definition) => {
        dungeon.enemies[definition.id]?.userData.chroniclesEnemyNameplate?.dispose();
      });
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };
}
