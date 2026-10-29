// CI-only visual evidence. Uses the exact authored Swordhaven map and
// production Three.js scene builder, never a hand-drawn approximation.
// Staging authentication is deliberately not required for these captures.
import * as THREE from 'three';
import swordhaven from '../src/chronicles/maps/swordhaven-first-book.json';
import { buildChroniclesCampaignExterior } from '../src/chronicles/chroniclesCampaignExterior3D.js';

const VIEWS = Object.freeze({
  oldtown: { x: 3, y: 4, heading: 'north' },
  // Both facades from matching walkable oblique positions, far enough away
  // to show the roof silhouette instead of only the door at eye level.
  apothecary: { x: 5, y: 8, heading: 'north', target: { x: 3, y: 3 }, cameraHeight: 2.4, lookUp: 2.5 },
  guild: { x: 13, y: 8, heading: 'north', target: { x: 15, y: 3 }, cameraHeight: 2.4, lookUp: 3.2 },
  // Aim closer to the side buttress: portrait viewports otherwise crop it out.
  'guild-oblique': { x: 12, y: 4, heading: 'north', target: { x: 13.5, y: 3 }, cameraHeight: 2.4, lookUp: 3.2 },
  forge: { x: 7, y: 8, heading: 'north', target: { x: 7, y: 3 }, cameraHeight: 2.4, lookUp: 2.5 },
  'forge-oblique': { x: 5, y: 8, heading: 'north', target: { x: 7, y: 3 }, cameraHeight: 2.4, lookUp: 2.5 },
  armor: { x: 11, y: 8, heading: 'north', target: { x: 11, y: 3 }, cameraHeight: 2.4, lookUp: 2.5 },
  // Walkable oblique viewpoint exposes the armory's iron-barred side elevation.
  'armor-oblique': { x: 13, y: 8, heading: 'north', target: { x: 11, y: 3 }, cameraHeight: 2.4, lookUp: 2.5 },
  temple: { x: 10, y: 6, heading: 'east', target: { x: 15, y: 6 }, cameraHeight: 2.4, lookUp: 2.5 },
  store: { x: 15, y: 8, heading: 'south', target: { x: 15, y: 12 }, cameraHeight: 2.4, lookUp: 2.5 },
  // Bias the portrait QA camera toward the cargo loft, not the empty side lane.
  'store-oblique': { x: 13, y: 8, heading: 'south', target: { x: 15.8, y: 12 }, cameraHeight: 2.4, lookUp: 2.5 },
  tavern: { x: 7, y: 8, heading: 'south', target: { x: 7, y: 12 }, cameraHeight: 2.4, lookUp: 3.0 },
  // East-side street view reveals the inn's overhanging guest-room oriel.
  'tavern-oblique': { x: 11, y: 9, heading: 'south', target: { x: 7, y: 12 }, cameraHeight: 2.4, lookUp: 3.2 },
  watch: { x: 7, y: 6, heading: 'west', target: { x: 3, y: 6 }, cameraHeight: 2.4, lookUp: 3.8 },
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
  camera.lookAt(
    chosen.target ? (chosen.target.x - center.x) * 4 : worldX + dx * 4,
    eye + (chosen.lookUp || 0),
    chosen.target ? (chosen.target.y - center.y) * 4 : worldZ + dy * 4,
  );
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);

  const wall = scene.getObjectByName('chronicles-campaign-visible-blockers');
  const perimeter = scene.getObjectByName('chronicles-campaign-town-perimeter');
  const battlements = scene.getObjectByName('chronicles-campaign-town-battlements');
  const road = scene.getObjectByName('chronicles-campaign-road');
  const town = scene.getObjectByName('chronicles-campaign-town');
  const plaster = town?.getObjectByName('chronicles-town-street-limewash-fronts');
  const roofs = town?.getObjectByName('chronicles-town-south-pitched-roofs');
  const posts = town?.getObjectByName('chronicles-town-timber-uprights');
  const windowFrames = town?.getObjectByName('chronicles-town-street-window-frames');
  const windowPanes = town?.getObjectByName('chronicles-town-street-window-panes');
  const apothecary = town?.children.find(child =>
    child.name.startsWith('swordhaven-building-first-book-apothecary-'));
  const guild = town?.children.find(child =>
    child.name.startsWith('swordhaven-building-first-book-guild-'));
  const forge = town?.children.find(child =>
    child.name.startsWith('swordhaven-building-first-book-forge-'));
  const armorer = town?.children.find(child =>
    child.name.startsWith('swordhaven-building-first-book-armor-'));
  const temple = town?.children.find(child =>
    child.name.startsWith('swordhaven-building-first-book-temple-'));
  const store = town?.children.find(child =>
    child.name.startsWith('swordhaven-building-first-book-store-'));
  const tavern = town?.children.find(child =>
    child.name.startsWith('swordhaven-building-first-book-tavern-'));
  const watch = town?.children.find(child =>
    child.name.startsWith('swordhaven-building-first-book-watch-'));
  if (!wall || !perimeter || !battlements || !road || !plaster || !roofs || !posts || !windowFrames || !windowPanes) {
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
    // Original total still covers every authored solid non-house tile;
    // the city enclosure now lives in its own reliably rendered batch.
    wallCount: String(wall.count + perimeter.count),
    perimeterCount: String(perimeter.count),
    perimeterUnculled: String(!perimeter.frustumCulled && !battlements.frustumCulled),
    roadCount: String(road.count),
    plasterCount: String(plaster.count),
    windowDetail: String(windowFrames.count === windowPanes.count
      && windowFrames.geometry.index.count === 36 * 12
      && new THREE.Box3().setFromBufferAttribute(windowFrames.geometry.getAttribute('position')).max.x >= 0.99
      && new THREE.Box3().setFromBufferAttribute(windowFrames.geometry.getAttribute('position')).max.z + 1.972 < 2),
    plasterRelief: String(plaster.material.normalMap?.name === 'chronicles-town-normal-stucco'
      && plaster.material.normalMap.repeat.equals(plaster.material.map.repeat)),
    roofCount: String(roofs.count),
    roofRelief: String(roofs.material.normalMap?.name === 'chronicles-town-normal-roof'
      && roofs.material.normalMap.repeat.equals(roofs.material.map.repeat)),
    cornerUprights: String(posts.count),
    pixelVariants: String(distinct.size),
    distinctTempleRose: String(Boolean(
      temple?.getObjectByName('temple-gable-rose-window')?.userData.chroniclesDecorativeOnly
      && temple?.getObjectByName('temple-rose-blue-glass')
      && temple?.getObjectByName('temple-rose-limestone-ring')
      && temple?.getObjectByName('temple-rose-lead-tracery')?.count === 4
      && !temple?.getObjectByName('pitched-roof-dormer--1')
      && !temple?.getObjectByName('stone-chimney')
      && !guild?.getObjectByName('temple-gable-rose-window')
    )),
    distinctTemplePortico: String(Boolean(
      temple?.getObjectByName('temple-limestone-portico')
      && temple?.getObjectByName('temple-portico-column')
      && temple?.getObjectByName('temple-portico-triangular-pediment')
      && !armorer?.getObjectByName('temple-limestone-portico')
      && !guild?.getObjectByName('temple-limestone-portico')
    )),
    distinctMetalworkFacades: String(Boolean(
      forge?.getObjectByName('forge-stone-workshop-bay')
      && forge?.getObjectByName('forge-workshop-stone-lintel')
      && forge?.getObjectByName('forge-workshop-cross-brace')
      && forge?.getObjectByName('forge-workshop-soot-recess')
      && forge?.getObjectByName('forge-workshop-embers')
      && !armorer?.getObjectByName('forge-stone-workshop-bay')
      && forge?.getObjectByName('forge-roof-smokestack')
      && forge?.getObjectByName('forge-brazier')
      && armorer?.getObjectByName('armor-roof-crest')
      && armorer?.getObjectByName('timber-and-stone-walls')?.material
        === temple?.getObjectByName('timber-and-stone-walls')?.material
      && armorer?.getObjectByName('timber-and-stone-walls')?.material
        !== forge?.getObjectByName('timber-and-stone-walls')?.material
      && !armorer?.getObjectByName('diagonal-timber-brace')
      && forge?.getObjectByName('diagonal-timber-brace')
      && !armorer?.getObjectByName('forge-roof-smokestack')
      && !forge?.getObjectByName('armor-roof-crest')
    )),
    distinctArmorParapet: String(Boolean(
      armorer?.getObjectByName('armor-ashlar-parapet')?.userData.chroniclesDecorativeOnly
      && armorer?.getObjectByName('armor-parapet-stone-course')
      && armorer?.getObjectByName('armor-parapet-merlons')?.count === 6
      && armorer?.getObjectByName('armor-roof-shoulders')
      && armorer?.getObjectByName('armor-roof-crest')
      && !armorer?.getObjectByName('pitched-roof-dormer--1')
      && !armorer?.getObjectByName('pitched-roof-dormer-1')
      && !armorer?.getObjectByName('stone-chimney')
      && !forge?.getObjectByName('armor-ashlar-parapet')
      && !guild?.getObjectByName('armor-ashlar-parapet')
    )),
    distinctForgeToolDisplays: String(Boolean(
      forge?.getObjectByName('forge-window-tool-displays')?.userData.chroniclesDecorativeOnly
      && forge?.getObjectByName('forge-window-hammer-handles')?.count === 4
      && forge?.getObjectByName('forge-window-hammer-heads')?.count === 4
      && forge?.children.filter(child => child.name === 'forge-window-tool-trough').length === 2
      && !forge?.getObjectByName('window-box-blooms')
      && tavern?.getObjectByName('window-box-blooms')
      && forge?.getObjectByName('shop-door')
    )),
    distinctForgeSideVents: String(Boolean(
      forge?.children.filter(child => child.name === 'side-window-forge-soot-vent').length === 4
      && forge?.children.filter(child => child.name === 'side-window-forge-iron-louver').length === 4
      && !forge?.getObjectByName('side-window-amber-glass')
      && tavern?.getObjectByName('side-window-amber-glass')
      && !armorer?.getObjectByName('side-window-forge-soot-vent')
    )),
    distinctArmorSideGrilles: String(Boolean(
      armorer?.children.filter(child => child.name === 'side-window-armory-dark-recess').length === 4
      && armorer?.children.filter(child => child.name === 'side-window-armory-iron-bar').length === 4
      && !armorer?.getObjectByName('side-window-amber-glass')
      && tavern?.getObjectByName('side-window-amber-glass')
      && !forge?.getObjectByName('side-window-armory-iron-bar')
    )),
    distinctWatchhouse: String(Boolean(
      watch?.getObjectByName('watchhouse-battlement-tower')
      && watch?.getObjectByName('watchhouse-tower-masonry')
      && watch?.getObjectByName('watchhouse-front-merlon')
      && !armorer?.getObjectByName('watchhouse-battlement-tower')
    )),
    distinctWatchhouseFrontage: String(Boolean(
      watch?.getObjectByName('watchhouse-front-iron-bars')?.count === 6
      && watch?.getObjectByName('watchhouse-front-iron-bars')?.userData.chroniclesDecorativeOnly
      && watch?.children.filter(child => child.name === 'watchhouse-front-dark-recess').length === 2
      && watch?.children.filter(child => child.name === 'watchhouse-front-stone-jamb').length === 4
      && !watch?.getObjectByName('flower-window-box')
      && !watch?.getObjectByName('armor-display')
      && !watch?.getObjectByName('window-diamond-leadwork')
      && watch?.getObjectByName('shop-door')
      && forge?.getObjectByName('forge-window-tool-displays')
      && !forge?.getObjectByName('watchhouse-front-iron-bars')
    )),
    distinctTavernBrick: String(Boolean(
      tavern?.getObjectByName('timber-and-stone-walls')?.material?.color?.getHex() === 0xb98b70
      && tavern?.getObjectByName('timber-and-stone-walls')?.material?.map?.name === 'chronicles-town-masonry'
      && tavern?.getObjectByName('timber-and-stone-walls')?.material?.normalMap?.name === 'chronicles-town-normal-masonry'
      && tavern?.getObjectByName('roof-gable-1')?.material
        === tavern?.getObjectByName('timber-and-stone-walls')?.material
      && tavern?.getObjectByName('vertical-facade-post')
      && tavern?.getObjectByName('shop-door')
      && forge?.getObjectByName('timber-and-stone-walls')?.material?.map?.name === 'chronicles-town-masonry'
      && forge?.getObjectByName('timber-and-stone-walls')?.material?.color?.getHex() === 0x958171
    )),
    distinctTavernPorch: String(Boolean(
      tavern?.getObjectByName('tavern-porch-awning')?.userData.chroniclesDecorativeOnly
      && tavern?.getObjectByName('tavern-porch-awning')?.children
        .filter(child => child.name === 'tavern-porch-pitched-slope').length === 2
      && tavern?.getObjectByName('tavern-porch-pitched-slope')?.rotation.z !== 0
      && tavern?.getObjectByName('tavern-porch-ridge')
      && tavern?.getObjectByName('shop-door')
      && !store?.getObjectByName('tavern-porch-awning')
    )),
    distinctTavernOriel: String(Boolean(
      tavern?.getObjectByName('tavern-east-guest-oriel')?.userData.chroniclesDecorativeOnly
      && tavern?.getObjectByName('tavern-oriel-timber-body')
      && tavern?.getObjectByName('tavern-oriel-sloped-roof')?.rotation.z !== 0
      && tavern?.getObjectByName('tavern-east-guest-oriel')?.children
        .filter(child => child.name === 'tavern-oriel-guest-window').length === 2
      && !forge?.getObjectByName('tavern-east-guest-oriel')
      && tavern?.getObjectByName('shop-door')
    )),
    distinctTavernRoof: String(Boolean(
      tavern?.getObjectByName('tavern-double-hearth')
      && tavern?.getObjectByName('tavern-hearth-flue-0')
      && tavern?.getObjectByName('tavern-hearth-flue-1')
      && tavern?.getObjectByName('tavern-brick-stepped-gable')?.userData.chroniclesDecorativeOnly
      && tavern?.getObjectByName('tavern-gable-brick-steps')?.count === 8
      && tavern?.getObjectByName('tavern-gable-stone-coping')?.count === 8
      && tavern?.getObjectByName('tavern-brick-stepped-rear-gable')?.userData.chroniclesDecorativeOnly
      && !tavern?.getObjectByName('pitched-roof-dormer--1')
      && !store?.getObjectByName('tavern-brick-stepped-gable')
      && !forge?.getObjectByName('tavern-double-hearth')
    )),
    distinctStoreLoft: String(Boolean(
      store?.getObjectByName('store-merchant-loft')?.userData.chroniclesDecorativeOnly
      && store?.getObjectByName('store-loft-oak-gable')
      && store?.getObjectByName('store-loft-window')
      && !store?.getObjectByName('pitched-roof-dormer--1')
      && !forge?.getObjectByName('store-merchant-loft')
      && forge?.getObjectByName('forge-roof-smoke-lantern')
      && !forge?.getObjectByName('pitched-roof-dormer--1')
    )),
    distinctStoreHoist: String(Boolean(
      store?.getObjectByName('store-loft-loading-hoist')?.userData.chroniclesDecorativeOnly
      && store?.getObjectByName('store-hoist-oak-boom')
      && store?.getObjectByName('store-hoist-gantry-crosshead')
      && store?.getObjectByName('store-loft-loading-hoist')?.children
        .filter(child => child.name === 'store-hoist-gantry-upright').length === 2
      && store?.getObjectByName('store-hoist-diagonal-brace')
      && store?.getObjectByName('store-hoist-chain')
      && store?.getObjectByName('store-hoist-iron-ring')
      && !store?.getObjectByName('stone-chimney')
      && store?.getObjectByName('shop-door')
      && !apothecary?.getObjectByName('store-loft-loading-hoist')
    )),
    distinctForgeLantern: String(Boolean(
      forge?.getObjectByName('forge-roof-smoke-lantern')?.userData.chroniclesDecorativeOnly
      && forge?.getObjectByName('forge-lantern-iron-louver')
      && forge?.getObjectByName('forge-lantern-pitched-cap')
      && !store?.getObjectByName('forge-roof-smoke-lantern')
      && !armorer?.getObjectByName('forge-roof-smoke-lantern')
    )),
    distinctStoreSideHatches: String(Boolean(
      store?.children.filter(child => child.name === 'side-window-store-oak-loading-hatch').length === 4
      && store?.getObjectByName('store-side-loading-hatch-battens')?.count === 12
      && store?.getObjectByName('store-side-loading-hatch-battens')?.userData.chroniclesDecorativeOnly
      && !store?.getObjectByName('side-window-amber-glass')
      && tavern?.getObjectByName('side-window-amber-glass')
      && !forge?.getObjectByName('store-side-loading-hatch-battens')
    )),
    distinctMarketStore: String(Boolean(
      store?.getObjectByName('store-market-awning')
      && store?.getObjectByName('store-awning-cloth')
      && store?.getObjectByName('store-awning-stripe')
      && !forge?.getObjectByName('store-market-awning')
    )),
    distinctGuildButtresses: String(Boolean(
      guild?.getObjectByName('magic-guild-side-buttresses')?.userData.chroniclesDecorativeOnly
      && guild?.getObjectByName('magic-guild-side-buttresses')?.children
        .filter(child => child.name === 'magic-buttress-shaft').length === 2
      && guild?.getObjectByName('magic-guild-side-buttresses')?.children
        .filter(child => child.name === 'magic-buttress-pointed-cap').length === 2
      && !forge?.getObjectByName('magic-guild-side-buttresses')
    )),
    distinctGuildObservatory: String(Boolean(
      guild?.getObjectByName('magic-guild-roof-observatory')?.userData.chroniclesDecorativeOnly
      && guild?.getObjectByName('magic-observatory-stone-drum')
      && guild?.getObjectByName('magic-observatory-steep-roof')
      && guild?.getObjectByName('magic-observatory-violet-window')
      && !guild?.getObjectByName('pitched-roof-dormer--1')
      && !guild?.getObjectByName('pitched-roof-dormer-1')
      && !guild?.getObjectByName('stone-chimney')
      && !temple?.getObjectByName('magic-guild-roof-observatory')
      && !apothecary?.getObjectByName('magic-guild-roof-observatory')
    )),
    distinctGuildMasonry: String(Boolean(
      guild?.getObjectByName('timber-and-stone-walls')?.material?.color?.getHex() === 0x9d8aa9
      && guild?.getObjectByName('timber-and-stone-walls')?.material?.map?.name === 'chronicles-town-masonry'
      && guild?.getObjectByName('timber-and-stone-walls')?.material?.normalMap?.name === 'chronicles-town-normal-masonry'
      && !guild?.getObjectByName('vertical-facade-post')
      && !guild?.getObjectByName('diagonal-timber-brace')
      && guild?.getObjectByName('shop-door')
      && guild?.getObjectByName('swordhaven-shop-nameplate')
      && forge?.getObjectByName('vertical-facade-post')
    )),
    distinctApothecaryMasonry: String(Boolean(
      apothecary?.getObjectByName('timber-and-stone-walls')?.material?.color?.getHex() === 0xa8b9a0
      && apothecary?.getObjectByName('timber-and-stone-walls')?.material?.map?.name === 'chronicles-town-masonry'
      && apothecary?.getObjectByName('timber-and-stone-walls')?.material?.normalMap?.name === 'chronicles-town-normal-masonry'
      && apothecary?.getObjectByName('roof-gable-1')?.material
        === apothecary?.getObjectByName('timber-and-stone-walls')?.material
      && !apothecary?.getObjectByName('vertical-facade-post')
      && !apothecary?.getObjectByName('diagonal-timber-brace')
      && apothecary?.getObjectByName('shop-door')
      && store?.getObjectByName('vertical-facade-post')
      && store?.getObjectByName('timber-and-stone-walls')?.material?.map?.name === 'chronicles-town-stucco'
    )),
    distinctApothecaryRoofline: String(Boolean(
      apothecary?.getObjectByName('apothecary-roof-herbarium')
      && !apothecary?.getObjectByName('pitched-roof-dormer--1')
      && !apothecary?.getObjectByName('pitched-roof-dormer-1')
      && !apothecary?.getObjectByName('stone-chimney')
    )),
    distinctShopFacades: String(Boolean(
      apothecary?.getObjectByName('apothecary-roof-herbarium')
      && apothecary?.getObjectByName('apothecary-hanging-herbs')
      && !apothecary?.getObjectByName('magic-shop-turret')
      && guild?.getObjectByName('magic-guild-pointed-entry')
      && guild?.getObjectByName('magic-guild-gable-oculus')
      && !apothecary?.getObjectByName('magic-guild-pointed-entry')
      && guild?.getObjectByName('magic-shop-turret')
      && !guild?.getObjectByName('apothecary-roof-herbarium')
    )),
  });
} catch (error) {
  document.body.dataset.sceneError = error.message;
  const message = document.createElement('pre');
  message.textContent = error.stack || String(error);
  message.style.cssText = 'color:#ffb3a5;padding:2rem;white-space:pre-wrap';
  document.body.append(message);
  console.error(error);
}
