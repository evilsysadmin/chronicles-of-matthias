// Visual acceptance uses the REAL MM3 exterior renderer and authored Terra
// maps. No mocked meshes, hand-built screenshots, account or API dependency.
import * as THREE from 'three';
import escoria from '../src/chronicles/maps/terra-e2.json';
import ahorcado from '../src/chronicles/maps/terra-c4.json';
import temple from '../src/chronicles/maps/terra-a1.json';
import heath from '../src/chronicles/maps/terra-b2.json';
import coast from '../src/chronicles/maps/terra-a2.json';
import marsh from '../src/chronicles/maps/terra-d5.json';
import volcanic from '../src/chronicles/maps/terra-f4.json';
import bannerRoad from '../src/chronicles/maps/banner-road-first-book.json';
import { buildChroniclesCampaignExterior } from '../src/chronicles/chroniclesCampaignExterior3D.js';
import { chroniclesFirstPersonFov } from '../src/chroniclesOfMatthiasThree.js';
import { createChroniclesExteriorDaylight, chroniclesExteriorDaylightProfile } from '../src/chronicles/chroniclesExteriorDaylight.js';
import { chroniclesSeasonalSunTimes } from '../src/chronicles/chroniclesWorldTime.js';
import {
  chroniclesRegionalWeather, chroniclesRegionalWeatherTransition,
} from '../src/chronicles/chroniclesRegionalWeather.js';

const params = new URLSearchParams(location.search);
const maps = Object.freeze({
  'terra-e2': escoria, 'terra-c4': ahorcado,
  'terra-a1': temple, 'terra-b2': heath,
  'terra-a2': coast, 'terra-d5': marsh, 'terra-f4': volcanic,
  'banner-road-first-book': bannerRoad,
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
  'terra-a2': Object.freeze({ dune: 4, boulderDark: 2, reed: 1 }),
  'terra-d5': Object.freeze({ pool: 4, deadTrunk: 3, reed: 1, bush: 1 }),
  'terra-f4': Object.freeze({ basalt: 4, boulderDark: 2, emberRock: 2 }),
  'banner-road-first-book': Object.freeze({ bush: 4, crown: 2, forestHerb: 1 }),
});

try {
  const map = maps[mapId];
  if (!map) throw new Error('Unsupported terrain capture: ' + mapId);
  if (!['canonical', 'flank', 'ruin', 'heath'].includes(view)) throw new Error('Unsupported terrain view: ' + view);
  if (view === 'heath' && mapId !== 'terra-b2') {
    throw new Error('Heath second-eye view is only valid on authored B2');
  }
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
    : view === 'heath'
      ? { x: 9, y: 10 } // Four walkable steps from spawn, off the protected cobblestone road.
      : view === 'flank'
      ? (mapId === 'terra-c4' ? { x: 5, y: 5 } : { x: 12, y: 7 })
      : mapId === 'terra-c4'
        ? { x: map.partyStart.x - 3, y: map.partyStart.y - 2 }
        : mapId === 'banner-road-first-book'
          ? { x: 10, y: 13 } // User's actual C3 north-facing forest approach screenshot.
          : { x: map.partyStart.x, y: map.partyStart.y };
  if (!cameraCell) throw new Error('No authored observation camera on ' + mapId);
  if (view === 'heath') {
    // A REAL cardinal walk route from B2 spawn, never a camera teleported
    // into a blocked tile or into a patch of fabricated scenery.
    const path = [[10, 7], [10, 8], [10, 9], [10, 10], [9, 10]];
    if (map.partyStart.x !== path[0][0] || map.partyStart.y !== path[0][1]
      || path.some(([x, y]) => map.grid[y]?.[x] !== '.')) {
      throw new Error('B2 heath eye must remain reachable by four walkable steps');
    }
  }
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
  // Three reports failed GLSL compilation via its debug callback, not
  // necessarily as a JavaScript exception. Record real driver diagnostics.
  const shaderErrors = [];
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    shaderErrors.push([gl.getProgramInfoLog(program),
      gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)]
      .filter(Boolean).join('\n') || 'WebGL shader link failed');
  };
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
    : view === 'heath'
      ? Math.PI // Face SOUTH from an off-road B2 foothill cell, into the vegetation.
      : view === 'flank'
      ? (mapId === 'terra-c4' ? Math.PI / 2 : -Math.PI / 2)
      : (mapId === 'terra-c4' || mapId === 'banner-road-first-book')
        ? 0 : candidates.reduce((best, candidate) =>
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
  // Independently prove that the actual C3 dirt road contributes visible
  // pixels, rather than only verifying that vegetation and shoulders draw.
  let roadVisiblePixels = 0;
  if (mapId === 'banner-road-first-book' && view === 'canonical') {
    const road = scene.getObjectByName('chronicles-campaign-road');
    if (!road?.isInstancedMesh || !road.visible) throw new Error('C3 road batch missing');
    road.visible = false;
    try {
      renderer.render(scene, camera);
      const withoutRoad = pixelBuffer();
      for (let i = 0; i < withTiles.length; i += 4) {
        const d = Math.abs(withTiles[i] - withoutRoad[i])
          + Math.abs(withTiles[i + 1] - withoutRoad[i + 1])
          + Math.abs(withTiles[i + 2] - withoutRoad[i + 2]);
        if (d > 12) roadVisiblePixels++;
      }
    } finally {
      road.visible = true;
      renderer.render(scene, camera);
    }
  }
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

  // B2 low-heath QA: inspect the dedicated rosette part both from the
  // authored ruin sightline and from an accessible off-road cell facing SOUTH. Toggle
  // ONLY that batch off during genuine framebuffer comparison, then restore
  // it. All blocked-border heather, mountains, ruins and collision stay intact.
  let lowHeatherInstances = 0;
  let lowHeatherVisiblePixels = 0;
  let lowHeatherVertices = 0;
  if (mapId === 'terra-b2' && (view === 'ruin' || view === 'heath')) {
    const mesh = scenery.getObjectByName('chronicles-terra-heatherGroundcover');
    if (!mesh?.isInstancedMesh) throw new Error('Missing real B2 low heather rosette batch');
    const old = scenery.getObjectByName('chronicles-terra-heather');
    if (!old?.isInstancedMesh || !old.visible) {
      throw new Error('Original blocked heather batch must remain visible');
    }
    lowHeatherInstances = mesh.count;
    lowHeatherVertices = mesh.geometry.getAttribute('position')?.count || 0;
    if (lowHeatherInstances < 10 || lowHeatherVertices > 180) {
      throw new Error('B2 groundcover must be a populated, bounded rosette batch');
    }
    mesh.visible = false;
    renderer.render(scene, camera);
    const withoutLowHeather = pixelBuffer();
    mesh.visible = true;
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
  // Audit the complete solar cycle on the SAME live scene and camera.
  // No additional browser/page startup, fabricated weather or production hook.
  if (mapId === 'banner-road-first-book' && view === 'canonical') {
    const noon = clearMinute ?? 765;
    const day = Math.floor(noon / 1440) * 1440;
    const solar = chroniclesSeasonalSunTimes(noon);
    const phases = {
      dawn: day + Math.round(solar.sunrise * 60 + 15),
      noon,
      dusk: day + Math.round(solar.sunset * 60 - 15),
      night: day + 23 * 60 + 45,
    };
    // Isolate each cloud layer in the same real camera and weather.
    // Diagnostic frames never change production sky settings.
    const panorama = dome.getObjectByName('chronicles-sky-cloud-panorama');
    const banks = dome.children.filter(child => child.name.startsWith('swordhaven-cloud-'));
    if (!panorama || !banks.length) throw new Error('Missing C3 cloud audit layers');
    const originalVisibility = [panorama, ...banks].map(object => object.visible);
    window.chroniclesSmokeCloudLayer = mode => {
      if (!['all', 'no-panorama', 'no-banks', 'no-clouds'].includes(mode)) {
        throw new Error('Unknown cloud audit mode');
      }
      cycle.sync(noon);
      panorama.visible = originalVisibility[0] && mode !== 'no-panorama' && mode !== 'no-clouds';
      banks.forEach((bank, index) => {
        bank.visible = originalVisibility[index + 1] && mode !== 'no-banks' && mode !== 'no-clouds';
      });
      renderer.render(scene, camera);
      const pixels = pixelBuffer();
      let count = 0, changed = 0, delta = 0;
      // Upper third: measure clouds rather than ground or most trees.
      for (let y = Math.floor(height * 0.67); y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const d = Math.abs(pixels[i] - withTiles[i])
            + Math.abs(pixels[i + 1] - withTiles[i + 1])
            + Math.abs(pixels[i + 2] - withTiles[i + 2]);
          if (d > 12) changed++;
          delta += d;
          count++;
        }
      }
      return { mode, changedPixels: changed, changedFraction: changed / count,
        meanRgbDifference: delta / (count * 3), shaderErrors: [...shaderErrors],
        panoramaVisible: panorama.visible, visibleBanks: banks.filter(bank => bank.visible).length };
    };
    window.chroniclesSmokeSolarFrame = phase => {
      if (!Object.hasOwn(phases, phase)) throw new Error('Unknown solar audit phase');
      const minute = phases[phase];
      cycle.sync(minute);
      renderer.render(scene, camera);
      const pixels = pixelBuffer();
      let light = 0, groundLight = 0, groundCount = 0, changed = 0, count = 0;
      const palette = new Set();
      for (let y = 4; y < height - 4; y += 4) {
        for (let x = 4; x < width - 4; x += 4) {
          const i = (y * width + x) * 4;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          light += luma;
          count++;
          if (y < height * 0.42) { groundLight += luma; groundCount++; }
          if (Math.abs(r - withTiles[i]) + Math.abs(g - withTiles[i + 1])
            + Math.abs(b - withTiles[i + 2]) > 12) changed++;
          palette.add((r << 16) | (g << 8) | b);
        }
      }
      const profile = chroniclesExteriorDaylightProfile(minute);
      const weather = chroniclesRegionalWeatherTransition({ ...region, worldMinutes: minute });
      return { phase, minute, daylight: profile.daylight, sun: profile.sun,
        weather: chroniclesRegionalWeather({ ...region, worldMinutes: minute })?.kind,
        clouds: weather.clouds, fog: weather.fog, meanLuma: light / count,
        groundLuma: groundLight / groundCount, changedFraction: changed / count,
        palette: palette.size, shaderErrors: [...shaderErrors],
        drawCalls: renderer.info.render.calls, cameraCell: cameraCell.x + ',' + cameraCell.y,
        yaw: camera.rotation.y, pitch: camera.rotation.x };
    };
  }
  Object.assign(document.body.dataset, {
    sceneReady: 'true',
    shaderErrors: JSON.stringify(shaderErrors),
    roadVisiblePixels: String(roadVisiblePixels),
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
    targetCounts: JSON.stringify(Object.fromEntries(Object.entries(meshes)
      .map(([part, mesh]) => [part, mesh.count]))),
    cragCount: String(meshes.crag?.count || 0),
    bushCount: String(meshes.bush?.count || 0),
    crownCount: String(meshes.crown?.count || 0),
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
    lowHeatherVertices: String(lowHeatherVertices),
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
