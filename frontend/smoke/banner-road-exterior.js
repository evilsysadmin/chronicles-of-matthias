// CI visual evidence from the genuine first-book Banner Road scenery.
// Fixed eye at the user's (10,13) trail approach; no mock models or art.
import * as THREE from 'three';
import bannerRoad from '../src/chronicles/maps/banner-road-first-book.json';
import { chroniclesBannerRoadWoodlineRoot } from '../src/chronicles/chroniclesTerraScenery.js';
import { buildChroniclesCampaignExterior } from '../src/chronicles/chroniclesCampaignExterior3D.js';
import { chroniclesFirstPersonFov } from '../src/chroniclesOfMatthiasThree.js';
import { createChroniclesExteriorDaylight } from '../src/chronicles/chroniclesExteriorDaylight.js';
import { chroniclesRegionalWeather, chroniclesRegionalWeatherTransition } from '../src/chronicles/chroniclesRegionalWeather.js';

const params = new URLSearchParams(location.search);
const coarsePointer = params.get('coarse') !== '0';
const canvas = document.getElementById('stage');

try {
  const center = { x: 10, y: 7 };
  const cameraCell = { x: 10, y: 13 };
  if (bannerRoad.grid[cameraCell.y][cameraCell.x] !== '.') {
    throw new Error('Banner Road camera must occupy real traversable tile (10,13)');
  }
  const scene = new THREE.Scene();
  buildChroniclesCampaignExterior(scene, {
    coarsePointer,
    scenePlan: {
      mapId: bannerRoad.id, regionKind: bannerRoad.regionKind,
      biome: bannerRoad.biome, center,
      width: bannerRoad.grid[0].length, height: bannerRoad.grid.length,
      grid: bannerRoad.grid, landscape: bannerRoad.landscape,
      scenery: bannerRoad.scenery, enemies: [], content: [],
    },
  });
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
  const camera = new THREE.PerspectiveCamera(
    chroniclesFirstPersonFov(innerWidth / innerHeight, { settlement: false }),
    innerWidth / innerHeight, 0.1, 180,
  );
  camera.position.set(0, 1.72, (cameraCell.y - center.y) * 4);
  // Match the real game's camera.rotation.set(0, yaw, 0), rather than
  // pitching this screenshot upward and artificially enlarging the sky.
  camera.lookAt(0, 1.72, camera.position.z - 8);
  const dome = scene.getObjectByName('swordhaven-sky-dome');
  if (dome) dome.position.copy(camera.position);
  // Deterministic daytime lighting and real regional weather, no fake tint.
  const cycle = createChroniclesExteriorDaylight(scene, renderer, {
    mapId: bannerRoad.id, regionKind: bannerRoad.regionKind,
  });
  // Pick a deterministic stable clear day, not a hard-coded day that might
  // actually be rainy/overcast. The v21 boost intentionally vanishes when
  // regional cloudiness rises, so only a clear-day render can verify it.
  const weatherRegion = { mapId: bannerRoad.id, regionKind: bannerRoad.regionKind };
  const clearMinute = Array.from({ length: 180 }, (_, day) =>
    day * 1440 + 12 * 60 + 45).find(minute =>
    chroniclesRegionalWeather({ ...weatherRegion, worldMinutes: minute })?.kind === 'clear'
      && chroniclesRegionalWeatherTransition({
        ...weatherRegion, worldMinutes: minute,
      }).clouds < 0.08);
  if (!Number.isFinite(clearMinute)) throw new Error('Banner Road fixture needs a stable clear day');
  cycle.sync(clearMinute);
  const skyClouds = dome?.getObjectByName('chronicles-sky-cloud-panorama');
  const skyCloudOpacity = skyClouds?.material?.opacity ?? -1;
  const skyCloudAtlasWidth = skyClouds?.material?.map?.image?.width ?? -1;
  const cloudBanks = dome?.children.filter(child =>
    child.name.startsWith('swordhaven-cloud-')) || [];
  const cloudBankOpacity = cloudBanks[0]?.getObjectByName('cloud-soft-bank')?.material?.opacity ?? -1;
  if (!skyClouds || !cloudBanks.length) throw new Error('Missing Banner Road sky clouds');
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);

  // Measure the ACTUAL framebuffer, not just material.opacity. Earlier
  // assertions passed while the screenshot remained byte-for-byte identical.
  // Render the same frame with the distant cloud layer temporarily hidden,
  // compare pixels in the upper sky, restore it, then capture the real scene.
  const gl = renderer.getContext();
  const sampleUpperSky = () => {
    const pixels = [];
    const pixel = new Uint8Array(4);
    for (let row = 0; row < 4; row += 1) {
      const y = Math.floor(gl.drawingBufferHeight * (0.68 + row * 0.07));
      for (let col = 1; col <= 11; col += 1) {
        const x = Math.floor(gl.drawingBufferWidth * col / 12);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        pixels.push(...pixel.slice(0, 3));
      }
    }
    return pixels;
  };
  const skyWithClouds = sampleUpperSky();
  skyClouds.visible = false;
  renderer.render(scene, camera);
  const skyWithoutClouds = sampleUpperSky();
  skyClouds.visible = true;
  renderer.render(scene, camera);
  const skyPixelDifference = skyWithClouds.reduce((sum, value, i) =>
    sum + Math.abs(value - skyWithoutClouds[i]), 0) / skyWithClouds.length;
  // Check the near cloud silhouettes separately so a healthy panorama
  // cannot hide missing or invisible foreground banks from the tests.
  const cloudBankPixels = sampleUpperSky();
  for (const bank of cloudBanks) bank.visible = false;
  renderer.render(scene, camera);
  const withoutCloudBanks = sampleUpperSky();
  for (const bank of cloudBanks) bank.visible = true;
  renderer.render(scene, camera);
  const cloudBankPixelDifference = cloudBankPixels.reduce((sum, value, i) =>
    sum + Math.abs(value - withoutCloudBanks[i]), 0) / cloudBankPixels.length;

  const foliage = scene.getObjectByName('chronicles-terra-scenery');
  const crowns = foliage?.getObjectByName('chronicles-terra-crown');
  const bushes = foliage?.getObjectByName('chronicles-terra-bush');
  const turf = foliage?.getObjectByName('chronicles-terra-tuft');
  const sedges = foliage?.getObjectByName('chronicles-terra-meadowSedge');
  const woodlandHerbs = foliage?.getObjectByName('chronicles-terra-forestHerb');
  const trunks = foliage?.getObjectByName('chronicles-terra-broadleafTrunk');
  const countNearRoadside = mesh => {
    const matrix = new THREE.Matrix4();
    let count = 0;
    for (let i = 0; i < (mesh?.count || 0); i += 1) {
      mesh.getMatrixAt(i, matrix);
      const x = Math.round(matrix.elements[12] / 4) + center.x;
      const y = Math.round(matrix.elements[14] / 4) + center.y;
      if ((x === 9 || x === 11) && y >= 8 && y <= 13
        && bannerRoad.grid[y]?.[x] === '.') count += 1;
    }
    return count;
  };
  const nearRoadsideBushes = countNearRoadside(bushes);
  const nearRoadsideHerbs = countNearRoadside(woodlandHerbs);
  // Inspect real WebGL instance matrices, not merely the root-selection
  // function. The new tier must be present at BOTH pointer resolutions.
  const woodlineRoots = new Set();
  const woodlineMatrix = new THREE.Matrix4(), woodlineScale = new THREE.Vector3();
  let woodlineThickets = 0;
  let woodlineInvalid = 0;
  for (let i = 0; i < (bushes?.count || 0); i += 1) {
    bushes.getMatrixAt(i, woodlineMatrix);
    woodlineScale.setFromMatrixScale(woodlineMatrix);
    if (woodlineScale.y < 1.45) continue;
    woodlineThickets += 1;
    const x = Math.round(woodlineMatrix.elements[12] / 4) + center.x;
    const y = Math.round(woodlineMatrix.elements[14] / 4) + center.y;
    woodlineRoots.add(x + ',' + y);
    if (!chroniclesBannerRoadWoodlineRoot(bannerRoad.grid, center, x, y)
      || Math.abs(woodlineMatrix.elements[12] - (x - center.x) * 4) >= 0.35
      || Math.abs(woodlineMatrix.elements[14] - (y - center.y) * 4) >= 0.50) {
      woodlineInvalid += 1;
    }
  }
  const road = scene.getObjectByName('chronicles-campaign-road');
  // Find the authored straight cell from the road mesh itself. Avoid
  // assuming a road-cell ordering or measuring a harmless crossing flare.
  const roadMatrix = new THREE.Matrix4();
  let approachRoadWidth = 0;
  for (let i = 0; i < (road?.count || 0); i += 1) {
    road.getMatrixAt(i, roadMatrix);
    const x = Math.round(roadMatrix.elements[12] / 4) + center.x;
    const y = Math.round(roadMatrix.elements[14] / 4) + center.y;
    if (x === cameraCell.x && y === cameraCell.y) {
      approachRoadWidth = (road.geometry.parameters.width || 0) * roadMatrix.elements[0];
      break;
    }
  }
  const shoulder = scene.getObjectByName('chronicles-banner-road-shoulders');
  const edgePositions = shoulder?.geometry.getAttribute('position');
  let edgeFringeCount = 0;
  let edgeFringeMaxIntrusion = 0;
  for (let i = 0; i < (edgePositions?.count || 0); i += 3) {
    if (![0, 1, 2].every(k => Math.abs(edgePositions.getY(i + k) - 0.085) < 1e-5)) continue;
    edgeFringeCount += 1;
    edgeFringeMaxIntrusion = Math.max(edgeFringeMaxIntrusion,
      -Math.min(edgePositions.getZ(i), edgePositions.getZ(i + 1), edgePositions.getZ(i + 2)));
  }
  // Verify the actual first-person road mesh consumes the packed-dirt
  // texture without the old solid-green paint patches. A previous visual
  // change to unused scenery had passed tests with zero changed mobile pixels.
  const roadPixels = road?.material?.map?.image?.data;
  let dustyMossPixels = 0;
  let oldGreenStainPixels = 0;
  for (let i = 0; i < (roadPixels?.length || 0); i += 4) {
    if (roadPixels[i] === 119 && roadPixels[i + 1] === 118
      && roadPixels[i + 2] === 94) dustyMossPixels += 1;
    if (roadPixels[i] === 102 && roadPixels[i + 1] === 116
      && roadPixels[i + 2] === 81) oldGreenStainPixels += 1;
  }
  const dustyMossFraction = roadPixels?.length
    ? dustyMossPixels / (roadPixels.length / 4) : -1;
  const terrain = scene.getObjectByName('chronicles-campaign-terrain');
  const groundPixels = terrain?.material?.map?.image?.data;
  let soilTexels = 0;
  for (let i = 0; i < (groundPixels?.length || 0); i += 4) {
    if (groundPixels[i] > groundPixels[i + 1]
      && groundPixels[i + 1] > groundPixels[i + 2]) soilTexels += 1;
  }
  const meadowSoilFraction = groundPixels?.length
    ? soilTexels / (groundPixels.length / 4) : -1;
  const triangles = geometry => geometry.index
    ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3;
  const shade = new THREE.Color();
  const crownTints = new Set();
  const treeTransform = new THREE.Matrix4();
  const treeScale = new THREE.Vector3();
  let juvenileTrees = 0;
  let paleTrunks = 0;
  let woodlandGatewayTrees = 0;
  let woodlandGatewayLowestLeaf = Infinity;
  let woodlandGatewayMinTrunkHeight = Infinity;
  let woodlandGatewayMinCanopyRatio = Infinity;
  let woodlandGatewayMaxCanopyRatio = -Infinity;
  const gatewayCrownBounds = crowns?.geometry.boundingBox
    || (crowns?.geometry.computeBoundingBox(), crowns?.geometry.boundingBox);
  const forestRingTrees = [0, 0, 0, 0];
  const barkTint = new THREE.Color();
  for (let i = 0; i < (trunks?.count || 0); i += 1) {
    trunks.getMatrixAt(i, treeTransform);
    treeTransform.decompose(new THREE.Vector3(), new THREE.Quaternion(), treeScale);
    if (treeScale.y < 2.0) juvenileTrees += 1;
    trunks.getColorAt(i, barkTint);
    if (barkTint.getHex() === 0xf2f2ea) paleTrunks += 1;
    const gx = Math.round(treeTransform.elements[12] / 4) + center.x;
    const gy = Math.round(treeTransform.elements[14] / 4) + center.y;
    if (gy === 4 && (gx === 9 || gx === 11)) {
      woodlandGatewayTrees += 1;
      woodlandGatewayMinTrunkHeight = Math.min(woodlandGatewayMinTrunkHeight, treeScale.y);
      const crownPose = new THREE.Matrix4();
      crowns.getMatrixAt(i, crownPose);
      const crownScale = new THREE.Vector3();
      crownPose.decompose(new THREE.Vector3(), new THREE.Quaternion(), crownScale);
      const ratio = crownScale.y / crownScale.x;
      woodlandGatewayMinCanopyRatio = Math.min(woodlandGatewayMinCanopyRatio, ratio);
      woodlandGatewayMaxCanopyRatio = Math.max(woodlandGatewayMaxCanopyRatio, ratio);
      woodlandGatewayLowestLeaf = Math.min(woodlandGatewayLowestLeaf,
        gatewayCrownBounds.clone().applyMatrix4(crownPose).min.y);
    }
    const ringDepth = Math.max(0, -gx, gx - bannerRoad.grid[0].length + 1,
      -gy, gy - bannerRoad.grid.length + 1);
    if (ringDepth > 0 && ringDepth < forestRingTrees.length) {
      forestRingTrees[ringDepth] += 1;
    }
  }
  for (let i = 0; i < (crowns?.count || 0); i += 1) {
    crowns.getColorAt(i, shade);
    crownTints.add(shade.getHex());
  }
  const vertexColours = crowns?.geometry.getAttribute('color');
  const crownPositions = crowns?.geometry.getAttribute('position');
  let darkestCrown = Infinity;
  let lightestCrown = -Infinity;
  let topShade = 0;
  let bottomShade = 0;
  let topSamples = 0;
  let bottomSamples = 0;
  for (let i = 0; i < (vertexColours?.count || 0); i += 1) {
    const brightness = (vertexColours.getX(i) + vertexColours.getY(i)
      + vertexColours.getZ(i)) / 3;
    darkestCrown = Math.min(darkestCrown, brightness);
    lightestCrown = Math.max(lightestCrown, brightness);
    if (crownPositions.getY(i) > 0.4) {
      topShade += brightness;
      topSamples += 1;
    }
    if (crownPositions.getY(i) < -0.3) {
      bottomShade += brightness;
      bottomSamples += 1;
    }
  }
  const pixel = new Uint8Array(4);
  const variants = new Set();
  for (let row = 1; row < 8; row += 1) {
    for (let col = 1; col < 10; col += 1) {
      gl.readPixels(Math.floor(gl.drawingBufferWidth * col / 10),
        Math.floor(gl.drawingBufferHeight * row / 8),
        1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      variants.add(Array.from(pixel.slice(0, 3)).join(','));
    }
  }
  Object.assign(document.body.dataset, {
    sceneReady: 'true',
    mapId: bannerRoad.id,
    cameraCell: cameraCell.x + ',' + cameraCell.y,
    coarsePointer: String(coarsePointer),
    crownCount: String(crowns?.count || 0),
    bushCount: String(bushes?.count || 0),
    nearRoadsideBushes: String(nearRoadsideBushes),
    nearRoadsideHerbs: String(nearRoadsideHerbs),
    woodlineThickets: String(woodlineThickets),
    woodlineRoots: String(woodlineRoots.size),
    woodlineInvalid: String(woodlineInvalid),
    grassCount: String(turf?.count || 0),
    sedgeCount: String(sedges?.count || 0),
    sedgeTriangles: String(sedges ? triangles(sedges.geometry) : -1),
    herbCount: String(woodlandHerbs?.count || 0),
    herbTriangles: String(woodlandHerbs ? triangles(woodlandHerbs.geometry) : -1),
    juvenileTrees: String(juvenileTrees),
    paleTrunks: String(paleTrunks),
    woodlandGatewayTrees: String(woodlandGatewayTrees),
    woodlandGatewayMinTrunkHeight: String(woodlandGatewayMinTrunkHeight),
    woodlandGatewayMinCanopyRatio: String(woodlandGatewayMinCanopyRatio),
    woodlandGatewayMaxCanopyRatio: String(woodlandGatewayMaxCanopyRatio),
    woodlandGatewayLowestLeaf: String(woodlandGatewayLowestLeaf),
    forestRingTrees: String(forestRingTrees.slice(1).reduce((total, n) => total + n, 0)),
    forestDeepRingTrees: String(forestRingTrees[3]),
    canopyTriangles: String(crowns ? triangles(crowns.geometry) : -1),
    canopyFrontReach: String(gatewayCrownBounds?.max.z ?? -1),
    canopyAspect: String(gatewayCrownBounds
      ? (gatewayCrownBounds.max.y - gatewayCrownBounds.min.y)
        / (gatewayCrownBounds.max.x - gatewayCrownBounds.min.x) : -1),
    canopyFlatShading: String(crowns?.material?.flatShading ?? true),
    canopyIndexed: String(Boolean(crowns?.geometry?.index)),
    canopyTexcoordCount: String(crowns?.geometry?.getAttribute('uv')?.count || 0),
    canopyTints: String(crownTints.size),
    canopyVertexColors: String(vertexColours?.count || 0),
    canopyShadeRange: String(vertexColours ? lightestCrown - darkestCrown : 0),
    canopyTopShade: String(topSamples ? topShade / topSamples : 0),
    canopyBottomShade: String(bottomSamples ? bottomShade / bottomSamples : 0),
    fogNear: String(scene.fog?.near ?? -1),
    fogFar: String(scene.fog?.far ?? -1),
    roadCount: String(road?.count || 0),
    roadApproachWidth: String(approachRoadWidth),
    roadRelief: String(Boolean(road?.material?.normalMap)),
    roadSurfaceKind: road?.material?.map?.userData?.chroniclesPixelArt?.kind || 'none',
    roadSurfaceAtlasSize: String(road?.material?.map?.image?.width || 0),
    roadDustyMossFraction: String(dustyMossFraction),
    roadOldGreenStains: String(oldGreenStainPixels),
    edgeFringeCount: String(edgeFringeCount),
    edgeFringeMaxIntrusion: String(edgeFringeMaxIntrusion),
    edgeFringeInstances: String(shoulder?.count || 0),
    groundKind: terrain?.material?.map?.userData?.chroniclesPixelArt?.kind || 'none',
    meadowSoilFraction: String(meadowSoilFraction),
    cameraPitch: String(camera.rotation.x),
    skyCloudOpacity: String(skyCloudOpacity),
    cloudBankCount: String(cloudBanks.length),
    cloudBankOpacity: String(cloudBankOpacity),
    cloudBankPixelDifference: String(cloudBankPixelDifference),
    skyCloudPixelDifference: String(skyPixelDifference),
    skyCloudSampleMinute: String(clearMinute),
    skyCloudAtlasWidth: String(skyCloudAtlasWidth),
    groundAtlasSize: String(terrain?.material?.map?.image?.width || 0),
    groundRepeat: String(terrain?.material?.map?.repeat?.x ?? -1),
    groundCount: String(scene.children.filter(child =>
      child.name === 'chronicles-campaign-terrain').length),
    pixelVariants: String(variants.size),
  });
} catch (error) {
  document.body.dataset.sceneError = String(error?.stack || error);
  console.error(error);
}
