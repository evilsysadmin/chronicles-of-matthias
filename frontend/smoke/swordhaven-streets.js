// CI-only visual evidence. Uses the exact authored Swordhaven map and
// production Three.js scene builder, never a hand-drawn approximation.
// Staging authentication is deliberately not required for these captures.
import * as THREE from 'three';
import swordhaven from '../src/chronicles/maps/swordhaven-first-book.json';
import { buildChroniclesCampaignExterior } from '../src/chronicles/chroniclesCampaignExterior3D.js';

const VIEWS = Object.freeze({
  oldtown: { x: 3, y: 4, heading: 'north' },
  alley: { x: 9, y: 17, heading: 'east' },
  ward: { x: 4, y: 19, heading: 'east' },
  // Fixed elevated QA camera over a genuinely walkable cell: the player's
  // eye-level view hides the shingles behind 6.4m facades.
  roofline: { x: 9, y: 14, heading: 'south', cameraHeight: 10, lookUp: -1.5 },
});
const direction = {
  north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0],
};
const name = new URLSearchParams(location.search).get('view') || 'ward';
const chosen = VIEWS[name];
const canvas = document.getElementById('stage');
try {
  if (!chosen || swordhaven.grid[chosen.y]?.[chosen.x] !== '.') {
    throw new Error('Camera must occupy a genuine traversable Swordhaven cell: ' + name);
  }
  const width = swordhaven.grid[0].length;
  const height = swordhaven.grid.length;
  const center = { x: (width - 1) / 2, y: (height - 1) / 2 };
  const content = [
    ...swordhaven.interactables,
    ...swordhaven.treasures,
    ...swordhaven.exits,
  ].map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
  const scene = new THREE.Scene();
  buildChroniclesCampaignExterior(scene, {
    coarsePointer: true,
    scenePlan: {
      mapId: swordhaven.id, regionKind: swordhaven.regionKind,
      width, height, center, grid: swordhaven.grid,
      content, enemies: [], landscape: swordhaven.landscape,
    },
  });
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1); // Comparable output regardless of CI screen density.
  renderer.setSize(innerWidth, innerHeight, false);
  const camera = new THREE.PerspectiveCamera(67, innerWidth / innerHeight, 0.1, 180);
  const worldX = (chosen.x - center.x) * 4;
  const worldZ = (chosen.y - center.y) * 4;
  const [dx, dy] = direction[chosen.heading];
  const eye = chosen.cameraHeight || 1.62;
  camera.position.set(worldX, eye, worldZ);
  camera.lookAt(worldX + dx * 4, eye + (chosen.lookUp || 0), worldZ + dy * 4);
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);

  const wall = scene.getObjectByName('chronicles-campaign-visible-blockers');
  const road = scene.getObjectByName('chronicles-campaign-road');
  const town = scene.getObjectByName('chronicles-campaign-town');
  const plaster = town?.getObjectByName('chronicles-town-street-limewash-fronts');
  const roofs = town?.getObjectByName('chronicles-town-south-pitched-roofs');
  const posts = town?.getObjectByName('chronicles-town-timber-uprights');
  const windowFrames = town?.getObjectByName('chronicles-town-street-window-frames');
  const windowPanes = town?.getObjectByName('chronicles-town-street-window-panes');
  if (!wall || !road || !plaster || !roofs || !posts || !windowFrames || !windowPanes) {
    throw new Error('Real Swordhaven architecture batches are missing');
  }

  // Confirm an actual WebGL framebuffer was drawn, not a blank canvas
  // surrounded by the HTML fixture. Screenshots remain the visual oracle.
  const gl = renderer.getContext();
  const sample = new Uint8Array(4);
  const distinct = new Set();
  for (let row = 1; row <= 7; row += 1) {
    for (let col = 1; col <= 9; col += 1) {
      const x = Math.floor(gl.drawingBufferWidth * col / 10);
      const y = Math.floor(gl.drawingBufferHeight * row / 8);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
      distinct.add(Array.from(sample.slice(0, 3)).join(','));
    }
  }
  Object.assign(document.body.dataset, {
    sceneReady: 'true',
    mapId: swordhaven.id,
    streetView: name,
    cameraCell: chosen.x + ',' + chosen.y,
    wallHeight: String(wall.geometry.parameters.height),
    wallCount: String(wall.count),
    roadCount: String(road.count),
    plasterCount: String(plaster.count),
    windowDetail: String(windowFrames.count === windowPanes.count
      && windowFrames.geometry.index.count === 36 * 8
      && new THREE.Box3().setFromBufferAttribute(windowFrames.geometry.getAttribute('position')).max.x >= 0.99
      && new THREE.Box3().setFromBufferAttribute(windowFrames.geometry.getAttribute('position')).max.z + 1.972 < 2),
    plasterRelief: String(plaster.material.normalMap?.name === 'chronicles-town-normal-stucco'
      && plaster.material.normalMap.repeat.equals(plaster.material.map.repeat)),
    roofCount: String(roofs.count),
    roofRelief: String(roofs.material.normalMap?.name === 'chronicles-town-normal-roof'
      && roofs.material.normalMap.repeat.equals(roofs.material.map.repeat)),
    cornerUprights: String(posts.count),
    pixelVariants: String(distinct.size),
  });
} catch (error) {
  document.body.dataset.sceneError = error.message;
  const message = document.createElement('pre');
  message.textContent = error.stack || String(error);
  message.style.cssText = 'color:#ffb3a5;padding:2rem;white-space:pre-wrap';
  document.body.append(message);
  console.error(error);
}
