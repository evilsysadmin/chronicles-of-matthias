// Visual acceptance uses the REAL MM3 exterior renderer and authored Terra
// maps. No mocked meshes, hand-built screenshots, account or API dependency.
import * as THREE from 'three';
import escoria from '../src/chronicles/maps/terra-e2.json';
import ahorcado from '../src/chronicles/maps/terra-c4.json';
import { buildChroniclesCampaignExterior } from '../src/chronicles/chroniclesCampaignExterior3D.js';
import { chroniclesFirstPersonFov } from '../src/chroniclesOfMatthiasThree.js';
import { createChroniclesExteriorDaylight } from '../src/chronicles/chroniclesExteriorDaylight.js';
import {
  chroniclesRegionalWeather, chroniclesRegionalWeatherTransition,
} from '../src/chronicles/chroniclesRegionalWeather.js';

const params = new URLSearchParams(location.search);
const maps = Object.freeze({ 'terra-e2': escoria, 'terra-c4': ahorcado });
const mapId = params.get('map') || 'terra-e2';
const coarsePointer = params.get('coarse') !== '0';
const canvas = document.getElementById('stage');
const CELL = 4;
const EYE_HEIGHT = 1.62;
const targets = Object.freeze({
  'terra-e2': Object.freeze({ crag: 3, pebble: 1, tuft: 1 }),
  'terra-c4': Object.freeze({ tuft: 1, flower: 3, forestHerb: 2 }),
});

try {
  const map = maps[mapId];
  if (!map) throw new Error('Unsupported terrain capture: ' + mapId);
  const center = { x: 10, y: 7 };
  const cameraCell = { x: map.partyStart.x, y: map.partyStart.y };
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
  const yaw = candidates.reduce((best, candidate) =>
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

  let diff = 0, compared = 0, changed = 0;
  const colors = new Set();
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  for (let y = 5; y < height - 5; y += 9) {
    for (let x = 5; x < width - 5; x += 9) {
      const index = (y * width + x) * 4;
      const d = Math.abs(withTiles[index] - withoutTiles[index])
        + Math.abs(withTiles[index + 1] - withoutTiles[index + 1])
        + Math.abs(withTiles[index + 2] - withoutTiles[index + 2]);
      diff += d;
      if (d > 0) changed += 1;
      compared += 1;
      colors.add(withTiles[index] + ',' + withTiles[index + 1]
        + ',' + withTiles[index + 2]);
    }
  }
  Object.assign(document.body.dataset, {
    sceneReady: 'true',
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
    targetPixelDifference: String(compared ? diff / (compared * 3) : 0),
    targetChangedSamples: String(changed),
    pixelVariants: String(colors.size),
    skyPresent: String(Boolean(dome)),
    clearMinute: String(clearMinute ?? -1),
  });
} catch (error) {
  document.body.dataset.sceneError = String(error?.stack || error);
  console.error(error);
}
