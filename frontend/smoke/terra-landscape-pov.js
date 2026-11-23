// Visual acceptance uses the REAL MM3 exterior renderer and authored Terra
// maps. No mocked meshes, hand-built screenshots, account or API dependency.
import * as THREE from 'three';
import escoria from '../src/chronicles/maps/terra-e2.json';
import ahorcado from '../src/chronicles/maps/terra-c4.json';
import temple from '../src/chronicles/maps/terra-a1.json';
import heath from '../src/chronicles/maps/terra-b2.json';
import { buildChroniclesCampaignExterior } from '../src/chronicles/chroniclesCampaignExterior3D.js';
import { chroniclesFirstPersonFov } from '../src/chroniclesOfMatthiasThree.js';
import { createChroniclesExteriorDaylight } from '../src/chronicles/chroniclesExteriorDaylight.js';
import {
  chroniclesRegionalWeather, chroniclesRegionalWeatherTransition,
} from '../src/chronicles/chroniclesRegionalWeather.js';

const params = new URLSearchParams(location.search);
const maps = Object.freeze({
  'terra-e2': escoria, 'terra-c4': ahorcado,
  'terra-a1': temple, 'terra-b2': heath,
});
const mapId = params.get('map') || 'terra-e2';
const coarsePointer = params.get('coarse') !== '0';
// Supplemental QA: a different, traversable observation point and an exact
// cardinal 90-degree turn. Canonical screenshots and live scene stay unchanged.
const view = params.get('view') || 'canonical';
const canvas = document.getElementById('stage');
const CELL = 4;
const EYE_HEIGHT = 1.62;
const targets = Object.freeze({
  'terra-e2': Object.freeze({ crag: 3, pebble: 1, tuft: 1 }),
  'terra-c4': Object.freeze({ tuft: 1, flower: 3, forestHerb: 2, microrelief: 2 }),
  // v63: direct real-player inspection of the authored rubble, not a
  // flattering render fabricated around the object.
  'terra-a1': Object.freeze({ boulder: 3, boulderSnow: 2 }),
  'terra-b2': Object.freeze({ boulder: 3, crag: 2 }),
});

try {
  const map = maps[mapId];
  if (!map) throw new Error('Unsupported terrain capture: ' + mapId);
  if (!['canonical', 'flank', 'ruin'].includes(view)) throw new Error('Unsupported terrain view: ' + view);
  const center = { x: 10, y: 7 };
  // The generic plains spawn faces the generated cobblestone crossroads,
  // hiding almost every low herb in a narrow portrait viewport. A real,
  // traversable meadow cell five cardinal steps away photographs habitat
  // rather than paving; unlike a test mock, every scenery piece is unchanged.
  const ruinEyes = Object.freeze({
    'terra-c4': Object.freeze({ x: 10, y: 9 }),
    'terra-a1': Object.freeze({ x: 10, y: 5 }),
    'terra-b2': Object.freeze({ x: 7, y: 8 }),
  });
  const cameraCell = view === 'ruin'
    ? ruinEyes[mapId]
    : view === 'flank'
      ? (mapId === 'terra-c4' ? { x: 5, y: 5 } : { x: 12, y: 7 })
      : mapId === 'terra-c4'
        ? { x: map.partyStart.x - 3, y: map.partyStart.y - 2 }
        : { x: map.partyStart.x, y: map.partyStart.y };
  if (!cameraCell) throw new Error('No authored ruin inspection camera on ' + mapId);
  if (map.grid[cameraCell.y]?.[cameraCell.x] !== '.') {
    throw new Error('Real party start must remain traversable on ' + mapId);
  }
  const scene = new THREE.Scene();
  buildChroniclesCampaignExterior(scene, {
    coarsePointer,
    scenePlan: {
      mapId: map.id, regionKind: map.regionKind,
      biome: map.biome, center,
      width: map.grid[0].length, height: map.grid.length,
      grid: map.grid, landscape: map.landscape,
      scenery: map.scenery, enemies: [], content: [],
    },
  });
  const scenery = scene.getObjectByName('chronicles-terra-scenery');
  const ground = scene.getObjectByName('chronicles-campaign-terrain');
  if (!scenery || !ground) throw new Error('Real exterior scene missing terrain or scenery');

  const meshes = Object.fromEntries(
    Object.keys(targets[mapId]).map(name => [
      name, scenery.getObjectByName('chronicles-terra-' + name),
    ]),
  );
  if (Object.values(meshes).some(mesh => !mesh?.isInstancedMesh || mesh.count <= 0)) {
    throw new Error('Missing real reusable Terra landscape instance batch on ' + mapId);
  }

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMappingExposure = coarsePointer ? 1.14 : 1.08;
  renderer.shadowMap.enabled = !coarsePointer;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(innerWidth, innerHeight, false);
  const aspect = innerWidth / innerHeight;
  const fov = chroniclesFirstPersonFov(aspect, { settlement: false });
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 180);
  camera.position.set(
    (cameraCell.x - center.x) * CELL, EYE_HEIGHT,
    (cameraCell.y - center.y) * CELL,
  );

  // Cardinal facing only, just like genuine first-person play. Choose the
  // most revealing facing from this REAL walkable spawn based on instance
  // positions, not the camera position or any rearranged scenery.
  const halfHfov = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect);
  const pose = new THREE.Matrix4();
  const candidates = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
  const facingScore = yaw => {
    let score = 0;
    for (const [part, weight] of Object.entries(targets[mapId])) {
      const mesh = meshes[part];
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, pose);
        const dx = pose.elements[12] - camera.position.x;
        const dz = pose.elements[14] - camera.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 2.1 || distance > 32) continue;
        const bearing = Math.atan2(dx, -dz);
        const diff = Math.atan2(Math.sin(bearing + yaw), Math.cos(bearing + yaw));
        if (Math.abs(diff) < halfHfov * 0.76) score += weight / (1 + distance * 0.08);
      }
    }
    return score;
  };
  // From the meadow observation point, face north into the grass and
  // woodland: turning towards the cobbled crossroad would defeat this QA.
  const yaw = view === 'ruin'
    ? (mapId === 'terra-b2' ? Math.PI / 2 : -Math.PI / 2)
    : view === 'flank'
      ? (mapId === 'terra-c4' ? Math.PI / 2 : -Math.PI / 2)
      : mapId === 'terra-c4' ? 0 : candidates.reduce((best, candidate) =>
        facingScore(candidate) > facingScore(best) ? candidate : best, candidates[0]);
  camera.rotation.set(0, yaw, 0);

  const dome = scene.getObjectByName('swordhaven-sky-dome');
  if (dome) dome.position.copy(camera.position);
  const region = { mapId: map.id, regionKind: map.regionKind };
  const cycle = createChroniclesExteriorDaylight(scene, renderer, region);
  if (!cycle) throw new Error('Missing real exterior lighting cycle');
  const clearMinute = Array.from({ length: 180 }, (_, day) =>
    day * 1440 + 12 * 60 + 45).find(minute =>
    chroniclesRegionalWeather({ ...region, worldMinutes: minute })?.kind === 'clear'
      && chroniclesRegionalWeatherTransition({ ...region, worldMinutes: minute }).clouds < 0.08);
  // Actual regional weather remains the source of truth; a cloudy fallback
  // is preferable to manufacturing a clear sky if no date qualifies.
  cycle.sync(clearMinute ?? 12 * 60 + 45);
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);

  // Prove the photographed framebuffer genuinely includes the new parts.
  // A mesh being in Three's scene graph is NOT proof it is on screen.
  const gl = renderer.getContext();
  const pixelBuffer = () => {
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight,
      gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  };
  const withTiles = pixelBuffer();
  const previous = Object.values(meshes).map(mesh => mesh.visible);
  Object.values(meshes).forEach(mesh => { mesh.visible = false; });
  renderer.render(scene, camera);
  const withoutTiles = pixelBuffer();
  Object.values(meshes).forEach((mesh, index) => { mesh.visible = previous[index]; });
  renderer.render(scene, camera);

  // Ruin POV must actually SEE the authored stones. Temporarily move only
  // their three existing boulder instances below terrain, capture a second
  // real framebuffer and restore the exact original matrices. This detects
  // occlusion/camera mistakes that a simple scene-graph assertion misses.
  let ruinVisiblePixels = 0;
  let ruinInstances = 0;
  if (view === 'ruin') {
    const ruin = (map.scenery || []).find(piece => piece.type === 'ruin');
    if (!ruin || map.grid[ruin.y]?.[ruin.x] !== '#') {
      throw new Error('Ruin camera must target an authored blocked root');
    }
    const mesh = scenery.getObjectByName('chronicles-terra-boulder');
    if (!mesh?.isInstancedMesh) throw new Error('Missing real ruin boulder batch');
    const original = [];
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i += 1) {
      mesh.getMatrixAt(i, matrix);
      const x = Math.round(matrix.elements[12] / CELL) + center.x;
      const y = Math.round(matrix.elements[14] / CELL) + center.y;
      if (x === ruin.x && y === ruin.y) {
        original.push({ index: i, matrix: matrix.clone() });
      }
    }
    ruinInstances = original.length;
    if (ruinInstances !== 3) throw new Error('Authored ruin must contain three real stones');
    for (const item of original) {
      const buried = item.matrix.clone();
      buried.setPosition(0, -1000, 0);
      mesh.setMatrixAt(item.index, buried);
    }
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    const withoutRuin = pixelBuffer();
    original.forEach(({ index, matrix }) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    for (let i = 0; i < withTiles.length; i += 4) {
      const d = Math.abs(withTiles[i] - withoutRuin[i])
        + Math.abs(withTiles[i + 1] - withoutRuin[i + 1])
        + Math.abs(withTiles[i + 2] - withoutRuin[i + 2]);
      if (d > 12) ruinVisiblePixels += 1;
    }
  }

  // B2 v65 foreground QA: compare the same real player-eye framebuffer
  // against an otherwise identical scene with ONLY low, walkable-cell
  // heather moved below the terrain. Existing blocked-border heather stays
  // completely untouched. Restore all matrices before screenshot/metadata.
  let lowHeatherInstances = 0;
  let lowHeatherVisiblePixels = 0;
  if (mapId === 'terra-b2' && view === 'ruin') {
    const mesh = scenery.getObjectByName('chronicles-terra-heather');
    if (!mesh?.isInstancedMesh) throw new Error('Missing real B2 heather batch');
    const originals = [];
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i += 1) {
      mesh.getMatrixAt(i, matrix);
      const x = Math.round(matrix.elements[12] / CELL) + center.x;
      const y = Math.round(matrix.elements[14] / CELL) + center.y;
      if (map.grid[y]?.[x] === '.') {
        originals.push({ index: i, matrix: matrix.clone() });
      }
    }
    lowHeatherInstances = originals.length;
    if (lowHeatherInstances < 10) {
      throw new Error('B2 walkable heather must be present in the real rendered scene');
    }
    for (const item of originals) {
      const buried = item.matrix.clone();
      buried.setPosition(0, -1000, 0);
      mesh.setMatrixAt(item.index, buried);
    }
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    const withoutLowHeather = pixelBuffer();
    originals.forEach(({ index, matrix }) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    for (let i = 0; i < withTiles.length; i += 4) {
      const d = Math.abs(withTiles[i] - withoutLowHeather[i])
        + Math.abs(withTiles[i + 1] - withoutLowHeather[i + 1])
        + Math.abs(withTiles[i + 2] - withoutLowHeather[i + 2]);
      if (d > 12) lowHeatherVisiblePixels += 1;
    }
  }

  // Count *actual changed pixels*, not a one-in-81 sample. Short plants
  // often occupy just 1-3 pixels of a row on a phone; the old 9px stride
  // could miss their entire silhouette and fail on a healthy grass patch.
  // Ignore <=12/765 RGB differences (minor GPU variation), and separately
  // sample the broad image palette without a million Set allocations.
  let diff = 0, changed = 0;
  const colors = new Set();
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  for (let y = 5; y < height - 5; y += 1) {
    for (let x = 5; x < width - 5; x += 1) {
      const index = (y * width + x) * 4;
      const d = Math.abs(withTiles[index] - withoutTiles[index])
        + Math.abs(withTiles[index + 1] - withoutTiles[index + 1])
        + Math.abs(withTiles[index + 2] - withoutTiles[index + 2]);
      if (d > 12) {
        diff += d;
        changed += 1;
      }
      if (x % 9 === 5 && y % 9 === 5) {
        colors.add(withTiles[index] + ',' + withTiles[index + 1]
          + ',' + withTiles[index + 2]);
      }
    }
  }
  Object.assign(document.body.dataset, {
    sceneReady: 'true',
    view,
    mapId, biome: map.biome,
    cameraCell: cameraCell.x + ',' + cameraCell.y,
    cameraYaw: String(yaw),
    cameraPitch: String(camera.rotation.x),
    coarsePointer: String(coarsePointer),
    realGround: String(Boolean(ground.isMesh || ground.isInstancedMesh)),
    realScenery: String(scenery.children.every(child => child.isInstancedMesh)),
    batchCount: String(scenery.children.length),
    drawCalls: String(renderer.info.render.calls),
    cragCount: String(meshes.crag?.count || 0),
    pebbleCount: String(meshes.pebble?.count || 0),
    tuftCount: String(meshes.tuft?.count || 0),
    flowerCount: String(meshes.flower?.count || 0),
    herbCount: String(meshes.forestHerb?.count || 0),
    microreliefCount: String(meshes.microrelief?.count || 0),
    // Verify the *actual* authored target is present on a blocked cell.
    // This is a camera QA aid, never a new gameplay collider.
    authoredRuinCell: view === 'ruin'
      ? (map.scenery || []).find(piece => piece.type === 'ruin')?.x + ','
        + (map.scenery || []).find(piece => piece.type === 'ruin')?.y
      : '',
    ruinInstances: String(ruinInstances),
    ruinVisiblePixels: String(ruinVisiblePixels),
    lowHeatherInstances: String(lowHeatherInstances),
    lowHeatherVisiblePixels: String(lowHeatherVisiblePixels),
    targetPixelDifference: String(changed ? diff / (changed * 3) : 0),
    targetChangedSamples: String(changed),
    pixelVariants: String(colors.size),
    skyPresent: String(Boolean(dome)),
    clearMinute: String(clearMinute ?? -1),
  });
} catch (error) {
  document.body.dataset.sceneError = String(error?.stack || error);
  console.error(error);
}
