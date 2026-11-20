// CI visual evidence from the genuine first-book Banner Road scenery.
// Fixed eye at the user's (10,13) trail approach; no mock models or art.
import * as THREE from 'three';
import bannerRoad from '../src/chronicles/maps/banner-road-first-book.json';
import { buildChroniclesCampaignExterior } from '../src/chronicles/chroniclesCampaignExterior3D.js';
import { chroniclesFirstPersonFov } from '../src/chroniclesOfMatthiasThree.js';
import { createChroniclesExteriorDaylight } from '../src/chronicles/chroniclesExteriorDaylight.js';

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
  camera.lookAt(0, 1.90, camera.position.z - 8);
  const dome = scene.getObjectByName('swordhaven-sky-dome');
  if (dome) dome.position.copy(camera.position);
  // Deterministic daytime lighting and real regional weather, no fake tint.
  const cycle = createChroniclesExteriorDaylight(scene, renderer, {
    mapId: bannerRoad.id, regionKind: bannerRoad.regionKind,
  });
  cycle.sync(84 * 1440 + 12 * 60 + 45);
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);

  const foliage = scene.getObjectByName('chronicles-terra-scenery');
  const crowns = foliage?.getObjectByName('chronicles-terra-crown');
  const bushes = foliage?.getObjectByName('chronicles-terra-bush');
  const turf = foliage?.getObjectByName('chronicles-terra-tuft');
  const sedges = foliage?.getObjectByName('chronicles-terra-meadowSedge');
  const woodlandHerbs = foliage?.getObjectByName('chronicles-terra-forestHerb');
  const trunks = foliage?.getObjectByName('chronicles-terra-broadleafTrunk');
  const road = scene.getObjectByName('chronicles-campaign-road');
  const terrain = scene.getObjectByName('chronicles-campaign-terrain');
  const triangles = geometry => geometry.index
    ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3;
  const shade = new THREE.Color();
  const crownTints = new Set();
  const treeTransform = new THREE.Matrix4();
  const treeScale = new THREE.Vector3();
  let juvenileTrees = 0;
  let paleTrunks = 0;
  const barkTint = new THREE.Color();
  for (let i = 0; i < (trunks?.count || 0); i += 1) {
    trunks.getMatrixAt(i, treeTransform);
    treeTransform.decompose(new THREE.Vector3(), new THREE.Quaternion(), treeScale);
    if (treeScale.y < 2.0) juvenileTrees += 1;
    trunks.getColorAt(i, barkTint);
    if (barkTint.getHex() === 0xf2f2ea) paleTrunks += 1;
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
  const gl = renderer.getContext();
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
    grassCount: String(turf?.count || 0),
    sedgeCount: String(sedges?.count || 0),
    sedgeTriangles: String(sedges ? triangles(sedges.geometry) : -1),
    herbCount: String(woodlandHerbs?.count || 0),
    herbTriangles: String(woodlandHerbs ? triangles(woodlandHerbs.geometry) : -1),
    juvenileTrees: String(juvenileTrees),
    paleTrunks: String(paleTrunks),
    canopyTriangles: String(crowns ? triangles(crowns.geometry) : -1),
    canopyTints: String(crownTints.size),
    canopyVertexColors: String(vertexColours?.count || 0),
    canopyShadeRange: String(vertexColours ? lightestCrown - darkestCrown : 0),
    canopyTopShade: String(topSamples ? topShade / topSamples : 0),
    canopyBottomShade: String(bottomSamples ? bottomShade / bottomSamples : 0),
    fogNear: String(scene.fog?.near ?? -1),
    fogFar: String(scene.fog?.far ?? -1),
    roadCount: String(road?.count || 0),
    roadRelief: String(Boolean(road?.material?.normalMap)),
    groundKind: terrain?.material?.map?.userData?.chroniclesPixelArt?.kind || 'none',
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
