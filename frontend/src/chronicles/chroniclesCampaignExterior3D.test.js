import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior, settlementHouseBlocks, settlementHouseFacing } from './chroniclesCampaignExterior3D.js';
import swordhavenFirstBook from './maps/swordhaven-first-book.json';
import rookwood from './maps/rookwood-first-book.json';
import terraB2 from './maps/terra-b2.json';
import { swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture } from './chroniclesSwordhaven3D.js';
import { swordhavenRoofRise } from './chroniclesSwordhavenRoofTrim.js';

const demo = {
  mapId: 'banner-road', regionKind: 'wilderness', width: 5, height: 5,
  center: { x: 2, y: 2 },
  grid: ['#####', '#...#', '#.#.#', '#...#', '#####'],
  content: [
    { id: 'exit-1', kind: 'exit', position: { x: 2, y: 1 }, visible: true },
    { id: 'milestone-1', kind: 'lore', position: { x: 3, y: 2 }, visible: true },
  ],
};

describe('Chronicles file-authored exterior renderer', () => {

  it.each([true, false])('gives the guardhouse its own cold ashlar walls and gable at coarse=%s', (coarsePointer) => {
    const grid = swordhavenFirstBook.grid;
    const content = [...swordhavenFirstBook.interactables, ...swordhavenFirstBook.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y } }));
    const scene = new THREE.Scene();
    buildChroniclesCampaignExterior(scene, {
      coarsePointer,
      scenePlan: {
        mapId: swordhavenFirstBook.id, regionKind: 'settlement',
        width: grid[0].length, height: grid.length, center: { x: 9, y: 7 },
        grid, content, landscape: swordhavenFirstBook.landscape,
      },
    });
    expect(scene.getObjectByName('chronicles-town-gate-outside-vista')).toBeTruthy();
    expect(scene.getObjectByName('chronicles-town-gate-outer-meadow')).toBeTruthy();
    const buildings = scene.getObjectByName('chronicles-campaign-town').children;
    const watch = buildings.find(building => building.getObjectByName('watchhouse-front-iron-bars'));
    const forge = buildings.find(building => building.getObjectByName('forge-window-tool-displays'));
    expect(watch).toBeTruthy();
    const walls = watch.getObjectByName('timber-and-stone-walls');
    const gable = watch.getObjectByName('roof-gable-1');
    expect(walls.material.color.getHex()).toBe(0x93a3aa);
    expect(walls.material.map?.name).toBe('chronicles-town-masonry');
    expect(walls.material.normalMap?.name).toBe('chronicles-town-normal-masonry');
    expect(gable.material).toBe(walls.material);
    expect(forge.getObjectByName('timber-and-stone-walls').material.color.getHex())
      .not.toBe(walls.material.color.getHex());
    expect(watch.getObjectByName('shop-door')).toBeTruthy();
    expect(watch.getObjectByName('watchhouse-front-iron-bars')?.count).toBe(6);
  });

  it.each([true, false])('keeps botanical facade exclusive to the botica at coarse=%s', (coarsePointer) => {
    const grid = swordhavenFirstBook.grid;
    const scene = new THREE.Scene();
    const content = [...swordhavenFirstBook.interactables, ...swordhavenFirstBook.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y } }));
    buildChroniclesCampaignExterior(scene, {
      coarsePointer,
      scenePlan: {
        mapId: swordhavenFirstBook.id, regionKind: 'settlement',
        width: grid[0].length, height: grid.length, center: { x: 9, y: 7 },
        grid, content, landscape: swordhavenFirstBook.landscape,
      },
    });
    const town = scene.getObjectByName('chronicles-campaign-town');
    const buildings = town.children.filter(child => child.name.startsWith('swordhaven-building-'));
    const botica = buildings.find(child => child.name.includes('-apothecary-'));
    const glazing = botica?.getObjectByName('apothecary-botanical-window-bays');
    expect(glazing?.children).toHaveLength(2);
    expect(glazing?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(glazing?.children.every(bay =>
      bay.getObjectByName('apothecary-window-sage-glass')
      && bay.getObjectByName('apothecary-window-rounded-stone-arch')
    )).toBe(true);
    expect(botica.getObjectByName('shop-door')).toBeTruthy();
    expect(botica.getObjectByName('window-box-leaf-clusters')).toBeInstanceOf(THREE.InstancedMesh);
    for (const other of buildings.filter(child => child !== botica)) {
      expect(other.getObjectByName('apothecary-botanical-window-bays')).toBeFalsy();
    }
  });

  it('renders F1 as a tall single-cell lighthouse with light driven by activatedRoot', () => {
    const scene = new THREE.Scene();
    const content = [{ id: 'f1-beacon-rescue', kind: 'lore',
      visualType: 'frozen-beacon', position: { x: 3, y: 2 }, visible: true }];
    const result = buildChroniclesCampaignExterior(scene, {
      scenePlan: { ...demo, grid: ['#####', '#...#', '#...#', '#...#', '#####'], content },
      coarsePointer: true,
    });
    const tower = scene.getObjectByName('chronicles-campaign-content-f1-beacon-rescue');
    // Measure structural mesh bounds only. The optional, non-colliding
    // light sprite intentionally extends beyond the one-cell tower.
    const bbox = new THREE.Box3();
    tower.updateWorldMatrix(true, true);
    tower.children
      .filter((child) => child !== result.contentProps[0].activatedRoot)
      .forEach((child) => bbox.expandByObject(child));
    expect(bbox.max.y).toBeGreaterThan(10);
    expect(bbox.max.x - bbox.min.x).toBeLessThan(4);
    expect(bbox.max.z - bbox.min.z).toBeLessThan(4);
    expect(result.contentProps).toHaveLength(1);
    expect(result.contentProps[0].activatedRoot.name).toBe('chronicles-f1-beacon-lit');
    expect(result.contentProps[0].activatedRoot.visible).toBe(false);
    result.contentProps[0].activatedRoot.visible = true;
    const lit = result.contentProps[0].activatedRoot;
    const flare = lit.children.find((child) => child.name === 'chronicles-f1-beacon-distance-bloom');
    expect(flare).toBeInstanceOf(THREE.Sprite);
    expect(flare.material.map.image.width).toBe(48);
    expect(lit.children.find((child) => child.name === 'chronicles-f1-beacon-stone-wash')).toBeInstanceOf(THREE.PointLight);
    expect(lit.children.length).toBeGreaterThanOrEqual(4);
    expect(scene.getObjectByName('chronicles-campaign-visible-blockers').count).toBe(16);
  });
  it('only decorates the real B2 heath, without altering the exterior grid or walkable roads', () => {
    const scene = new THREE.Scene();
    const center = { x: 10, y: 7 };
    const built = buildChroniclesCampaignExterior(scene, {
      scenePlan: {
        mapId: terraB2.id, biome: terraB2.biome, regionKind: terraB2.regionKind,
        width: terraB2.grid[0].length, height: terraB2.grid.length,
        center, grid: terraB2.grid, content: [], scenery: terraB2.scenery,
      },
      coarsePointer: true,
    });
    const heather = scene.getObjectByName('chronicles-terra-heather');
    expect(heather).toBeInstanceOf(THREE.InstancedMesh);
    expect(heather.count).toBeGreaterThan(0);
    expect(built.sceneCenter).toEqual(center);
    // Wild biomes render obstacles as scenery, not the urban wall mesh.
    // The authored B2 collision grid remains the only gameplay blocker.
    expect(scene.getObjectByName('chronicles-campaign-visible-blockers')).toBeUndefined();
    expect(scene.getObjectByName('chronicles-terra-boulder')).toBeInstanceOf(THREE.InstancedMesh);
  });

  it('applies a heath-only peat and lichen ground texture without adding terrain meshes', () => {
    const plan = {
      mapId: terraB2.id, biome: terraB2.biome, regionKind: terraB2.regionKind,
      width: terraB2.grid[0].length, height: terraB2.grid.length,
      center: { x: 10, y: 7 }, grid: terraB2.grid, scenery: terraB2.scenery,
      content: [],
    };
    const detailed = new THREE.Scene();
    const mobile = new THREE.Scene();
    const other = new THREE.Scene();
    buildChroniclesCampaignExterior(detailed, { scenePlan: plan });
    buildChroniclesCampaignExterior(mobile, { scenePlan: plan, coarsePointer: true });
    buildChroniclesCampaignExterior(other, { scenePlan: { ...plan, mapId: 'terra-e2' } });
    const getFloor = (scene) => scene.getObjectByName('chronicles-campaign-terrain');
    expect(getFloor(detailed)).toBeInstanceOf(THREE.Mesh);
    expect(getFloor(detailed).material.map.name).toBe('chronicles-pixel-heath');
    expect(getFloor(detailed).material.map).toBe(getFloor(mobile).material.map);
    expect(getFloor(detailed).material.color.getHex()).toBe(0xffffff);
    expect(getFloor(other).material.map.name).not.toBe('chronicles-pixel-heath');
    expect(getFloor(other).material.color.getHex()).toBe(0xd8d0a0);
    expect(detailed.children.filter(obj => obj.name === 'chronicles-campaign-terrain')).toHaveLength(1);
    const texture = getFloor(detailed).material.map;
    expect(texture.image.width).toBe(64);
    expect(texture.image.height).toBe(64);
    expect(texture.image.data.length).toBe(64 * 64 * 4);
    const unique = new Set();
    for (let i = 0; i < texture.image.data.length; i += 4) {
      expect(texture.image.data[i + 3]).toBe(255);
      unique.add(Array.from(texture.image.data.slice(i, i + 3)).join(','));
    }
    expect(unique.size).toBeGreaterThan(7);
    expect(texture.userData.chroniclesPixelArt.kind).toBe('heath');
  });

  it('uses a quiet compacted-earth path exclusively on B2 with identical road cells', () => {
    const plan = {
      mapId: terraB2.id, biome: terraB2.biome, regionKind: terraB2.regionKind,
      width: terraB2.grid[0].length, height: terraB2.grid.length,
      center: { x: 10, y: 7 }, grid: terraB2.grid, scenery: terraB2.scenery,
      content: [],
    };
    const first = new THREE.Scene();
    const mobile = new THREE.Scene();
    const other = new THREE.Scene();
    buildChroniclesCampaignExterior(first, { scenePlan: plan });
    buildChroniclesCampaignExterior(mobile, { scenePlan: plan, coarsePointer: true });
    buildChroniclesCampaignExterior(other, { scenePlan: { ...plan, mapId: 'terra-e2' } });
    const road = first.getObjectByName('chronicles-campaign-road');
    const cheap = mobile.getObjectByName('chronicles-campaign-road');
    const unchanged = other.getObjectByName('chronicles-campaign-road');
    expect(road).toBeInstanceOf(THREE.InstancedMesh);
    expect(road.count).toBeGreaterThan(0);
    expect(road.count).toBe(cheap.count);
    expect(road.count).toBe(unchanged.count);
    expect(road.geometry.parameters).toEqual({
      ...unchanged.geometry.parameters, width: 4, depth: 4,
    });
    expect(cheap.geometry.parameters).toEqual(road.geometry.parameters);
    expect(unchanged.geometry.parameters.width).toBeCloseTo(4 * 0.98);
    expect(unchanged.geometry.parameters.depth).toBeCloseTo(4 * 0.98);
    // Earth segments meet exactly. No overlap (z-fighting) or dark seams.
    expect(road.geometry.parameters.width).toBe(4);
    expect(road.geometry.parameters.depth).toBe(4);
    expect(road.material.map.name).toBe('chronicles-pixel-heathpath');
    expect(road.material.map).toBe(cheap.material.map);
    expect(road.material.normalMap).toBeNull();
    expect(road.material.color.getHex()).toBe(0xffffff);
    expect(unchanged.material.map).toBe(swordhavenSurfaceTexture('cobble'));
    const instance = new THREE.Matrix4();
    const peer = new THREE.Matrix4();
    for (let i = 0; i < road.count; i++) {
      road.getMatrixAt(i, instance);
      unchanged.getMatrixAt(i, peer);
      expect(instance.elements).toEqual(peer.elements);
      const x = Math.round(instance.elements[12] / 4) + plan.center.x;
      const y = Math.round(instance.elements[14] / 4) + plan.center.y;
      expect(terraB2.grid[y]?.[x]).toBe('.');
    }
    // Two adjacent road cells must share a boundary without any tile-sized
    // gap. Verify the fixture really contains a neighboring pair.
    let neighboring = false;
    const cellCenters = new Set();
    for (let i = 0; i < road.count; i++) {
      road.getMatrixAt(i, instance);
      cellCenters.add(`${Math.round(instance.elements[12])},${Math.round(instance.elements[14])}`);
    }
    for (const center of cellCenters) {
      const [x, z] = center.split(',').map(Number);
      if (cellCenters.has(`${x + 4},${z}`) || cellCenters.has(`${x},${z + 4}`)) {
        neighboring = true; break;
      }
    }
    expect(neighboring).toBe(true);
    expect(road.material.transparent).toBe(false);
    const pathTex = road.material.map;
    expect(pathTex.userData.chroniclesPixelArt).toMatchObject({ kind: 'heathpath', size: 64 });
    expect(pathTex.image.data.length).toBe(64 * 64 * 4);
    const shades = new Set();
    for (let i = 0; i < pathTex.image.data.length; i += 4) {
      expect(pathTex.image.data[i + 3]).toBe(255);
      shades.add(Array.from(pathTex.image.data.slice(i, i + 3)).join(','));
    }
    expect(shades.size).toBeGreaterThan(5);
    expect(first.children.filter(o => o.name === 'chronicles-campaign-road')).toHaveLength(1);
  });

  it('shades B2 paths near rock banks while preserving every original tile and transform', () => {
    const plan = {
      mapId: terraB2.id, biome: terraB2.biome, regionKind: terraB2.regionKind,
      width: terraB2.grid[0].length, height: terraB2.grid.length,
      center: { x: 10, y: 7 }, grid: terraB2.grid, scenery: terraB2.scenery, content: [],
    };
    const make = (overrides = {}, coarsePointer = false) => {
      const scene = new THREE.Scene();
      buildChroniclesCampaignExterior(scene, {
        scenePlan: { ...plan, ...overrides }, coarsePointer,
      });
      return scene.getObjectByName('chronicles-campaign-road');
    };
    const heath = make();
    const again = make({}, true);
    const elsewhere = make({ mapId: 'terra-e2' });
    expect(heath).toBeInstanceOf(THREE.InstancedMesh);
    expect(heath.count).toBe(elsewhere.count);
    expect(heath.count).toBe(again.count);
    expect(heath.instanceColor).toBeTruthy();
    expect(elsewhere.instanceColor).toBeNull();
    expect(heath.material.map).toBe(again.material.map);
    expect(heath.geometry.parameters).toEqual({
      ...elsewhere.geometry.parameters, width: 4, depth: 4,
    });
    expect(again.geometry.parameters).toEqual(heath.geometry.parameters);
    const matrix = new THREE.Matrix4();
    const previous = new THREE.Matrix4();
    const tint = new THREE.Color();
    const duplicateTint = new THREE.Color();
    const edgeTints = new Set();
    const openTints = new Set();
    for (let i = 0; i < heath.count; i += 1) {
      heath.getMatrixAt(i, matrix);
      elsewhere.getMatrixAt(i, previous);
      expect(matrix.elements).toEqual(previous.elements);
      heath.getColorAt(i, tint);
      again.getColorAt(i, duplicateTint);
      expect(tint.getHex()).toBe(duplicateTint.getHex());
      const x = Math.round(matrix.elements[12] / 4) + plan.center.x;
      const y = Math.round(matrix.elements[14] / 4) + plan.center.y;
      expect(plan.grid[y]?.[x]).toBe('.');
      const stoneEdge = plan.grid[y - 1]?.[x] === '#' || plan.grid[y + 1]?.[x] === '#'
        || plan.grid[y]?.[x - 1] === '#' || plan.grid[y]?.[x + 1] === '#';
      (stoneEdge ? edgeTints : openTints).add(tint.getHex());
    }
    expect(edgeTints.size).toBeGreaterThan(1);
    expect(openTints.size).toBeGreaterThan(1);
    expect([...edgeTints].every(hex => !openTints.has(hex))).toBe(true);
    expect(heath.instanceColor.count).toBe(heath.count);
  });

  it('builds the road without a dungeon ceiling, maps visible blockers only to wall cells', () => {
    const scene = new THREE.Scene();
    const built = buildChroniclesCampaignExterior(scene, { scenePlan: demo, coarsePointer: true });
    expect(scene.getObjectByName('chronicles-campaign-terrain')).toBeTruthy();
    const road = scene.getObjectByName('chronicles-campaign-road');
    expect(road).toBeInstanceOf(THREE.InstancedMesh);
    // Wilderness still paves the cardinal axes, not the whole walkable field.
    expect(road.count).toBe(4);
    const walls = scene.getObjectByName('chronicles-campaign-visible-blockers');
    expect(walls).toBeInstanceOf(THREE.InstancedMesh);
    expect(walls.count).toBe(demo.grid.join('').split('#').length - 1);
    expect(walls.geometry.parameters.height).toBe(1.6); // Wilderness walls stay low.
    expect(scene.getObjectByName('chronicles-first-person-ceiling')).toBeUndefined();
    expect(scene.getObjectByName('chronicles-town-street-limewash-fronts')).toBeUndefined();
    expect(built.sceneCenter).toEqual(demo.center);
    expect(built.contentProps.map(x => x.id)).toEqual(['exit-1', 'milestone-1']);
    expect(built.enemies).toEqual({});
  });
  it('does not invent solid obstacles on a completely open authored field', () => {
    const scene = new THREE.Scene();
    buildChroniclesCampaignExterior(scene, {
      scenePlan: { ...demo, grid: ['.....', '.....', '.....', '.....', '.....'], content: [] },
      coarsePointer: true,
    });
    expect(scene.getObjectByName('chronicles-campaign-visible-blockers')).toBeUndefined();
  });

  it('dresses First Book Swordhaven as a town: shops styled by the NPC at their door, facades on the street', () => {
    const grid = swordhavenFirstBook.grid;
    const width = grid[0].length;
    const height = grid.length;
    const center = { x: 9, y: 7 };
    const blocks = settlementHouseBlocks(grid, width, height);
    expect(blocks).toHaveLength(10);
    const content = [...swordhavenFirstBook.interactables, ...swordhavenFirstBook.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y } }));
    // Every authored shop NPC stands on a walkable door cell of a real block.
    const doors = blocks.map(block => settlementHouseFacing(block, grid, center).door);
    for (const shop of content.filter(entry => String(entry.visualType || '').startsWith('building-'))) {
      expect(grid[shop.y][shop.x]).toBe('.');
      expect(doors).toContainEqual({ x: shop.x, y: shop.y });
    }
    const scene = new THREE.Scene();
    buildChroniclesCampaignExterior(scene, {
      coarsePointer: true,
      scenePlan: { mapId: 'swordhaven-first-book', regionKind: 'settlement', width, height, center, grid, content, landscape: swordhavenFirstBook.landscape },
    });
    const town = scene.getObjectByName('chronicles-campaign-town');
    const names = town.children.map(child => child.name).filter(name => name.startsWith('swordhaven-building-'));
    expect(names).toHaveLength(10);
    // The campaign town uses the same facades as the classic square, not a
    // static mock. Decorative masonry cannot become a new collision mask.
    const buildingMeshes = town.children.filter(child => child.name.startsWith('swordhaven-building-'));
    for (const building of buildingMeshes) {
      const masonry = building.getObjectByName('swordhaven-facade-dressed-stones');
      expect(masonry).toBeInstanceOf(THREE.InstancedMesh);
      expect(masonry.userData.chroniclesDecorativeOnly).toBe(true);
      expect(masonry.count).toBeGreaterThan(30);
      const foliage = building.getObjectByName('window-box-leaf-clusters');
      const vines = building.getObjectByName('window-box-trailing-stems');
      // The temple uses pointed stained glass instead of merchant planters
      // in both the classic square and the real First Book campaign town.
      const armorBays = building.getObjectByName('armor-forged-display-bays');
      if (armorBays) {
        expect(armorBays.userData.chroniclesDecorativeOnly).toBe(true);
        expect(armorBays.children).toHaveLength(2);
        expect(foliage).toBeFalsy();
        expect(vines).toBeFalsy();
        continue;
      }
      const lancets = building.getObjectByName('temple-stained-glass-lancets');
      if (lancets) {
        expect(lancets.userData.chroniclesDecorativeOnly).toBe(true);
        expect(lancets.children).toHaveLength(2);
        expect(foliage).toBeFalsy();
        expect(vines).toBeFalsy();
        continue;
      }
      const guildGlazing = building.getObjectByName('magic-guild-violet-glazing');
      if (guildGlazing) {
        expect(guildGlazing.userData.chroniclesDecorativeOnly).toBe(true);
        expect(guildGlazing.children).toHaveLength(2);
        expect(foliage).toBeFalsy();
        expect(vines).toBeFalsy();
        continue;
      }
      // Guard barracks have iron embrasures, not civilian window boxes.
      const watchBars = building.getObjectByName('watchhouse-front-iron-bars');
      if (watchBars) {
        expect(watchBars).toBeInstanceOf(THREE.InstancedMesh);
        expect(watchBars.count).toBe(6);
        expect(foliage).toBeFalsy();
        expect(vines).toBeFalsy();
        continue;
      }
      // The provisions store uses braced oak stock crates in its raised
      // window troughs; the inn and homes retain their planted window boxes.
      const storeCrates = building.getObjectByName('store-window-provisions-crates');
      if (storeCrates) {
        expect(storeCrates).toBeInstanceOf(THREE.InstancedMesh);
        expect(storeCrates.count).toBe(4);
        expect(building.getObjectByName('store-window-crate-crossbraces')?.count).toBe(8);
        expect(storeCrates.userData.chroniclesDecorativeOnly).toBe(true);
        expect(foliage).toBeFalsy();
        expect(vines).toBeFalsy();
        continue;
      }
      // The smithy now exhibits iron tools rather than civilian flowers.
      const forgeTools = building.getObjectByName('forge-window-tool-displays');
      if (forgeTools) {
        expect(forgeTools.userData.chroniclesDecorativeOnly).toBe(true);
        expect(forgeTools.getObjectByName('forge-window-hammer-heads')?.count).toBe(4);
        expect(forgeTools.getObjectByName('forge-window-hammer-handles')?.count).toBe(4);
        expect(foliage).toBeFalsy();
        expect(vines).toBeFalsy();
        continue;
      }
      expect(foliage).toBeInstanceOf(THREE.InstancedMesh);
      expect(vines).toBeInstanceOf(THREE.InstancedMesh);
      expect(foliage.userData.chroniclesDecorativeOnly).toBe(true);
      expect(foliage.count).toBe(36); // Mobile/coarse campaign budget.
    }
    const paved = scene.getObjectByName('chronicles-campaign-road');
    expect(paved).toBeInstanceOf(THREE.InstancedMesh);
    expect(paved.material.map).toBe(swordhavenSurfaceTexture('cobble'));
    expect(paved.material.normalMap).toBe(swordhavenSurfaceNormalTexture('cobble'));
    expect(paved.material.normalScale.x).toBeGreaterThan(0);
    expect(paved.count).toBe([...grid.join('')].filter(cell => cell === '.').length);
    // Row-major instances really reach the off-axis alleys in the south.
    const alley = { x: 3, y: 17 };
    const alleyIndex = grid.slice(0, alley.y).reduce((sum, row) =>
      sum + [...row].filter(tile => tile === '.').length, 0)
      + [...grid[alley.y].slice(0, alley.x)].filter(tile => tile === '.').length;
    const alleyMatrix = new THREE.Matrix4();
    paved.getMatrixAt(alleyIndex, alleyMatrix);
    const alleyPosition = new THREE.Vector3().setFromMatrixPosition(alleyMatrix);
    expect(alleyPosition.x).toBeCloseTo((alley.x - center.x) * 4);
    expect(alleyPosition.z).toBeCloseTo((alley.y - center.y) * 4);
    const alleyTint = new THREE.Color();
    const squareTint = new THREE.Color();
    paved.getColorAt(alleyIndex, alleyTint);
    const square = { x: 9, y: 7 };
    const squareIndex = grid.slice(0, square.y).reduce((sum, row) =>
      sum + [...row].filter(tile => tile === '.').length, 0)
      + [...grid[square.y].slice(0, square.x)].filter(tile => tile === '.').length;
    paved.getColorAt(squareIndex, squareTint);
    const expectedDistrictTint = new THREE.Color('#c7b19c');
    expect(alleyTint.r).toBeCloseTo(expectedDistrictTint.r);
    expect(alleyTint.g).toBeCloseTo(expectedDistrictTint.g);
    expect(alleyTint.b).toBeCloseTo(expectedDistrictTint.b);
    expect(squareTint.r).toBeCloseTo(1);
    expect(squareTint.g).toBeCloseTo(1);
    expect(squareTint.b).toBeCloseTo(1);
    expect(paved.instanceColor).toBeTruthy();
    // The south-ward walls now have visible window fronts rather than bare
    // embankments. Both faces are batched: two instanced meshes total.
    const frames = town.getObjectByName('chronicles-town-street-window-frames');
    const panes = town.getObjectByName('chronicles-town-street-window-panes');
    expect(frames).toBeInstanceOf(THREE.InstancedMesh);
    expect(panes).toBeInstanceOf(THREE.InstancedMesh);
    expect(frames.count).toBeGreaterThan(80); // Two storeys, still two draw calls.
    expect(panes.count).toBe(frames.count);
    // Sill, leadwork and two three-plank shutters with diagonal braces share
    // ONE instanced frame batch: twelve boxes, no extra per-window draw calls.
    expect(frames.geometry.index.count).toBe(36 * 12);
    // Different residential shutters/frames and leaded window tones use the
    // SAME two instances. Most glazing stays blue-grey; a sparse amber
    // reflection makes the terraces feel inhabited without emissive lamps.
    expect(frames.instanceColor).toBeTruthy();
    expect(panes.instanceColor).toBeTruthy();
    expect(panes.material.color.getHex()).toBe(0xffffff);
    expect(panes.material.emissive?.getHex() || 0).toBe(0);
    const frameShades = new Set();
    const paneShades = new Set();
    let warmPanes = 0;
    const paneTint = new THREE.Color();
    for (let index = 0; index < frames.count; index += 1) {
      frames.getColorAt(index, paneTint);
      frameShades.add(paneTint.getHexString());
      panes.getColorAt(index, paneTint);
      const shade = paneTint.getHexString();
      paneShades.add(shade);
      if (shade === '947553') warmPanes += 1;
    }
    expect(frameShades.size).toBe(3);
    expect(paneShades.size).toBe(4);
    expect(warmPanes).toBeGreaterThan(0);
    expect(warmPanes).toBeLessThan(frames.count / 3);
    const frameBounds = new THREE.Box3()
      .setFromBufferAttribute(frames.geometry.getAttribute('position'));
    expect(frameBounds.min.y).toBeCloseTo(-0.51);
    expect(frameBounds.min.x).toBeCloseTo(-0.995);
    expect(frameBounds.max.x).toBeCloseTo(0.995);
    expect(frameBounds.max.z).toBeCloseTo(0.026);
    expect(frameBounds.max.z + 1.972).toBeLessThan(2);
    expect(town.getObjectByName('chronicles-town-street-window-sills')).toBeUndefined();
    // The first window faces a real alley from an existing solid cell.
    // Its cladding must be in front of the 3.92m wall, but still inside the
    // 4m impassable cell (never a new invisible street collision).
    const facadeMatrix = new THREE.Matrix4();
    const paneMatrix = new THREE.Matrix4();
    frames.getMatrixAt(0, facadeMatrix);
    panes.getMatrixAt(0, paneMatrix);
    const facadePos = new THREE.Vector3().setFromMatrixPosition(facadeMatrix);
    const panePos = new THREE.Vector3().setFromMatrixPosition(paneMatrix);
    expect(grid[16][2]).toBe('#');
    expect(grid[17][2]).toBe('.');
    expect(facadePos.x).toBeCloseTo((2 - center.x) * 4);
    expect(facadePos.z).toBeCloseTo((16 - center.y) * 4 + 1.972);
    expect(panePos.z).toBeCloseTo((16 - center.y) * 4 + 1.988);
    expect(facadePos.y).toBeCloseTo(2.15);
    expect(panePos.y).toBeCloseTo(2.17);
    frames.getMatrixAt(1, facadeMatrix);
    const upperWindow = new THREE.Vector3().setFromMatrixPosition(facadeMatrix);
    expect(upperWindow.y).toBeCloseTo(4.45);
    expect(upperWindow.x).toBeCloseTo(facadePos.x);
    expect(upperWindow.z).toBeCloseTo(facadePos.z);
    expect(panePos.z - (16 - center.y) * 4 + 0.007).toBeLessThan(2);
    // Every south-ward wall facing a walkable street gets timber framing,
    // while the windows remain sparse. Two instanced meshes, not a batch
    // per individual house or wall cell.
    const beams = town.getObjectByName('chronicles-town-timber-storey-beams');
    const uprights = town.getObjectByName('chronicles-town-timber-uprights');
    expect(beams).toBeInstanceOf(THREE.InstancedMesh);
    expect(uprights).toBeInstanceOf(THREE.InstancedMesh);
    expect(beams.count).toBe(188);
    // Blind walls get paired diagonal braces in the same upright batch,
    // preserving the original two timber draw calls and all corner joints.
    expect(uprights.count).toBeGreaterThan(beams.count + 38);
    expect(uprights.count).toBeLessThan(beams.count * 2 + 38);
    // Reinforced external corners reuse the existing timber batch; no extra
    // geometry draw calls and no timbers protrude into walkable tiles.
    const cornerMatrix = new THREE.Matrix4();
    uprights.getMatrixAt(beams.count, cornerMatrix);
    const firstCorner = new THREE.Vector3().setFromMatrixPosition(cornerMatrix);
    const cornerScale = new THREE.Vector3().setFromMatrixScale(cornerMatrix);
    expect(firstCorner.x).toBeCloseTo((2 - center.x) * 4 - 1.93);
    expect(firstCorner.y).toBeCloseTo(swordhavenFirstBook.landscape.streetWallHeight / 2 - 0.04);
    expect(firstCorner.z).toBeCloseTo((16 - center.y) * 4 + 1.93);
    expect(cornerScale.z).toBeCloseTo(3.25);
    expect(1.93 + 0.13 / 2).toBeLessThan(2);
    const braceMatrix = new THREE.Matrix4();
    uprights.getMatrixAt(beams.count + 38, braceMatrix);
    const bracePosition = new THREE.Vector3().setFromMatrixPosition(braceMatrix);
    const braceScale = new THREE.Vector3().setFromMatrixScale(braceMatrix);
    expect(bracePosition.y).toBeCloseTo(1.84);
    expect(braceScale.y).toBeCloseTo(0.55);
    expect(braceScale.z).toBeCloseTo(1);
    expect(Math.abs(braceMatrix.elements[1])).toBeGreaterThan(0.1); // Actually diagonal.
    // 4cm depth plus its inset is strictly within the blocked 4m cell.
    expect(1.973 + 0.04 / 2).toBeLessThan(2);
    // A few blind street bays are now genuine-looking CLOSED residential
    // entrances. No diagonal brace cuts across a door, no window is hidden,
    // and every front stays within a solid authored cell.
    const domesticPanels = town.getObjectByName('chronicles-town-residential-door-panels');
    const doorFrames = town.getObjectByName('chronicles-town-residential-door-frames');
    const knockers = town.getObjectByName('chronicles-town-residential-door-knockers');
    for (const batch of [domesticPanels, doorFrames, knockers]) {
      expect(batch).toBeInstanceOf(THREE.InstancedMesh);
      expect(batch.userData.chroniclesDecorativeOnly).toBe(true);
      expect(batch.castShadow).toBe(false);
      expect(batch.count).toBe(domesticPanels.count);
    }
    expect(domesticPanels.count).toBeGreaterThan(4);
    expect(domesticPanels.count).toBeLessThan(frames.count / 2);
    // Every domestic opening still replaces TWO lower braces. The upper
    // storey gains two trusses per blind bay, all in the SAME upright batch.
    const upperTrussCount = beams.count - frames.count;
    expect(upperTrussCount).toBeGreaterThan(0);
    expect(upperTrussCount % 2).toBe(0);
    expect(uprights.count + domesticPanels.count * 2)
      .toBe(318 + upperTrussCount);
    // Real raised oak planks and two forged straps share the original
    // THREE door batches. No per-door meshes, new material or draw calls.
    expect(domesticPanels.geometry.index.count).toBe(5 * 36); // Leaf + 4 boards.
    expect(doorFrames.geometry.index.count).toBe(7 * 36); // Jambs, lintel, sill, twin rafters, keystone.
    expect(knockers.geometry.index.count).toBe(12 * 6 + 2 * 36); // Ring + 2 bands.
    const leafBounds = new THREE.Box3()
      .setFromBufferAttribute(domesticPanels.geometry.getAttribute('position'));
    const ironBounds = new THREE.Box3()
      .setFromBufferAttribute(knockers.geometry.getAttribute('position'));
    expect(leafBounds.max.x).toBeCloseTo(0.58);
    expect(leafBounds.max.z).toBeCloseTo(0.013);
    expect(ironBounds.min.y).toBeLessThan(-0.70);
    expect(ironBounds.max.y).toBeGreaterThan(0.70);
    expect(1.983 + leafBounds.max.z).toBeLessThan(2);
    expect(1.998 + ironBounds.max.z).toBeLessThan(2);
    expect(doorFrames.material.color.getHex()).not.toBe(domesticPanels.material.color.getHex());
    const doorFrameBounds = new THREE.Box3()
      .setFromBufferAttribute(doorFrames.geometry.getAttribute('position'));
    expect(1.988 + doorFrameBounds.max.z).toBeLessThan(2);
    // The raised double-pitch entry cap is visible above the flat lintel but
    // never reaches the timber storey beam or the walkable street boundary.
    expect(doorFrameBounds.max.y + 1.46).toBeGreaterThan(3.08);
    expect(doorFrameBounds.max.y + 1.46).toBeLessThan(3.25 - 0.075);
    // Verify the new two rafters are actually diagonal, not just extra flat
    // triangles or a large floating slab.
    const frameVertices = doorFrames.geometry.getAttribute('position');
    const rafterFirst = 4 * 24; // Four original box geometries, 24 verts each.
    const leftY = new Set();
    const rightY = new Set();
    for (let i = rafterFirst; i < rafterFirst + 24; i++) leftY.add(frameVertices.getY(i).toFixed(3));
    for (let i = rafterFirst + 24; i < rafterFirst + 48; i++) rightY.add(frameVertices.getY(i).toFixed(3));
    expect(leftY.size).toBeGreaterThan(2);
    expect(rightY.size).toBeGreaterThan(2);
    const doorMatrix = new THREE.Matrix4();
    const doorPosition = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    const doorScale = new THREE.Vector3();
    const windowCells = new Set();
    for (let i = 0; i < frames.count; i += 2) {
      frames.getMatrixAt(i, facadeMatrix);
      const pos = new THREE.Vector3();
      facadeMatrix.decompose(pos, orientation, doorScale);
      const outward = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation);
      windowCells.add([Math.round(pos.x / 4 + center.x),
        Math.round(pos.z / 4 + center.y),
        Math.round(outward.x), Math.round(outward.z)].join(':'));
    }
    // One pair per genuinely windowless upper facade. Both A and V patterns
    // appear, follow the real street normal, and never float into a walkable
    // tile or overlap the window-bearing facades.
    const upperStart = uprights.count - upperTrussCount;
    const patterns = new Set();
    for (let index = upperStart; index < uprights.count; index += 2) {
      const pair = [];
      for (const offset of [0, 1]) {
        uprights.getMatrixAt(index + offset, braceMatrix);
        const at = new THREE.Vector3();
        const rotate = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        braceMatrix.decompose(at, rotate, scale);
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotate);
        const gx = Math.round(at.x / 4 + center.x);
        const gy = Math.round(at.z / 4 + center.y);
        const dx = Math.round(normal.x);
        const dy = Math.round(normal.z);
        expect(grid[gy]?.[gx]).toBe('#');
        expect(grid[gy + dy]?.[gx + dx]).toBe('.');
        expect(windowCells.has([gx, gy, dx, dy].join(':'))).toBe(false);
        expect(at.y).toBeCloseTo((3.25 + swordhavenFirstBook.landscape.streetWallHeight - 0.21) / 2);
        expect(scale.y).toBeCloseTo(0.55);
        expect(scale.z).toBeCloseTo(1);
        const slope = Math.sign(new THREE.Vector3(1, 0, 0).applyQuaternion(rotate).y);
        pair.push({ at, slope });
        // First (left) truss reflects the author's deterministic A/V choice.
        if (offset === 0) {
          const pattern = (gx * 3 + gy) % 4 === 1 ? 1 : -1;
          expect(slope).toBe(-pattern);
          patterns.add(pattern);
        }
      }
      expect(pair[0].slope).toBe(-pair[1].slope);
      expect(pair[0].at.x === pair[1].at.x && pair[0].at.z === pair[1].at.z)
        .toBe(false);
    }
    expect(patterns).toEqual(new Set([-1, 1]));
    const sconceCells = new Set(swordhavenFirstBook.landscape.wallLanterns
      .map(({ x, y }) => x + ':' + y));
    for (let i = 0; i < domesticPanels.count; i += 1) {
      domesticPanels.getMatrixAt(i, doorMatrix);
      doorMatrix.decompose(doorPosition, orientation, doorScale);
      const dx = Math.round(new THREE.Vector3(0, 0, 1).applyQuaternion(orientation).x);
      const dy = Math.round(new THREE.Vector3(0, 0, 1).applyQuaternion(orientation).z);
      const gx = Math.round(doorPosition.x / 4 + center.x);
      const gy = Math.round(doorPosition.z / 4 + center.y);
      expect(grid[gy]?.[gx]).toBe('#');
      expect(grid[gy + dy]?.[gx + dx]).toBe('.');
      expect(windowCells.has([gx, gy, dx, dy].join(':'))).toBe(false);
      expect(sconceCells.has(gx + ':' + gy)).toBe(false);
      expect(doorPosition.y).toBeCloseTo(1.46);
      doorFrames.getMatrixAt(i, doorMatrix);
      const doorFramePos = new THREE.Vector3().setFromMatrixPosition(doorMatrix);
      expect(doorFramePos.y).toBeCloseTo(doorPosition.y);
      knockers.getMatrixAt(i, doorMatrix);
      const knockerPos = new THREE.Vector3().setFromMatrixPosition(doorMatrix);
      expect(knockerPos.y).toBeCloseTo(doorPosition.y);
      expect(knockerPos.distanceTo(doorPosition)).toBeLessThan(0.40);
    }
    expect(beams.count).toBe(188);
    // Ground and first-floor plaster tones separate the long facades into
    // actual houses, still within ONE shared stucco draw call.
    const plaster = town.getObjectByName('chronicles-town-street-limewash-fronts');
    expect(plaster).toBeInstanceOf(THREE.InstancedMesh);
    expect(plaster.count).toBe(188); // 94 real facades × 2 floors, same draw call.
    expect(plaster.instanceColor).toBeTruthy();
    expect(plaster.material.map).toBe(swordhavenSurfaceTexture('stucco'));
    expect(plaster.material.normalMap).toBe(swordhavenSurfaceNormalTexture('stucco'));
    expect(plaster.material.normalScale.toArray()).toEqual([0.50, 0.50]);
    expect(plaster.material.map.repeat.toArray()).toEqual(plaster.material.normalMap.repeat.toArray());
    expect(plaster.material.map).toBeInstanceOf(THREE.DataTexture);
    expect(plaster.material.map.wrapS).toBe(THREE.RepeatWrapping);
    expect(plaster.castShadow).toBe(false);
    expect(plaster.geometry.parameters.height).toBeCloseTo(1); // Instanced y-scale per storey.
    expect(plaster.userData.chroniclesDecorativeOnly).toBe(true);
    expect(plaster.geometry.parameters.width).toBeCloseTo(4 * 0.935);
    const plasterMatrix = new THREE.Matrix4();
    plaster.getMatrixAt(0, plasterMatrix);
    const firstPlaster = new THREE.Vector3().setFromMatrixPosition(plasterMatrix);
    expect(firstPlaster.x).toBeCloseTo((2 - center.x) * 4);
    expect(firstPlaster.z).toBeCloseTo((16 - center.y) * 4 + 1.974);
    expect(firstPlaster.y).toBeCloseTo((0.29 + 3.18) / 2);
    const lowerScale = new THREE.Vector3();
    plasterMatrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), lowerScale);
    expect(lowerScale.y).toBeCloseTo(3.18 - 0.29);
    plaster.getMatrixAt(1, plasterMatrix);
    const upperPlaster = new THREE.Vector3().setFromMatrixPosition(plasterMatrix);
    expect(upperPlaster.x).toBeCloseTo(firstPlaster.x);
    expect(upperPlaster.z).toBeCloseTo(firstPlaster.z);
    expect(upperPlaster.y).toBeCloseTo((3.33 + 6.15) / 2);
    const upperScale = new THREE.Vector3();
    plasterMatrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), upperScale);
    expect(upperScale.y).toBeCloseTo(6.15 - 3.33);
    // The physical gap is behind the preexisting 3.25m storey beam.
    expect(firstPlaster.y + lowerScale.y / 2).toBeCloseTo(3.18);
    expect(upperPlaster.y - upperScale.y / 2).toBeCloseTo(3.33);
    // Keep the limewash in front of the masonry, behind the dark window
    // frames and timber beams, but never over the neighbouring road tile.
    const wallSurface = 4 * 0.98 / 2;
    const plasterSurface = 1.974 + plaster.geometry.parameters.depth / 2;
    const windowSurface = 1.972 + frameBounds.max.z; // Merged sill/mullions, not a BoxGeometry.
    const timberSurface = 1.973 + beams.geometry.parameters.depth / 2;
    expect(plasterSurface).toBeGreaterThan(wallSurface);
    expect(windowSurface).toBeGreaterThan(plasterSurface);
    expect(timberSurface).toBeGreaterThan(plasterSurface);
    expect(plasterSurface).toBeLessThan(2);
    // Three deterministic house palettes × two consistent floor treatments.
    // A darker ground floor and lighter upper floor give depth without a
    // patchwork of materials, new meshes or random values on reload.
    const groundShades = new Set();
    const upperShades = new Set();
    for (let i = 0; i < plaster.count; i += 1) {
      plaster.getMatrixAt(i, plasterMatrix);
      const panel = new THREE.Vector3().setFromMatrixPosition(plasterMatrix);
      const gx = Math.round(panel.x / 4 + center.x);
      const gy = Math.round(panel.z / 4 + center.y);
      expect(grid[gy]?.[gx]).toBe('#');
      const shade = new THREE.Color();
      plaster.getColorAt(i, shade);
      (i % 2 === 0 ? groundShades : upperShades).add(shade.getHexString());
      if (i % 2 === 1) {
        const lowerTint = new THREE.Color();
        plaster.getColorAt(i - 1, lowerTint);
        expect(shade.getHSL({ h: 0, s: 0, l: 0 }).l)
          .toBeGreaterThan(lowerTint.getHSL({ h: 0, s: 0, l: 0 }).l);
      }
    }
    expect(groundShades.size).toBe(3);
    expect(upperShades.size).toBe(3);
    expect([...groundShades].some(color => upperShades.has(color))).toBe(false);
    expect(beams.castShadow).toBe(false);
    expect(uprights.castShadow).toBe(false);
    expect(beams.geometry.parameters.depth).toBe(0.04);
    const timberMatrix = new THREE.Matrix4();
    beams.getMatrixAt(0, timberMatrix);
    const lowerBeam = new THREE.Vector3().setFromMatrixPosition(timberMatrix);
    beams.getMatrixAt(1, timberMatrix);
    const upperBeam = new THREE.Vector3().setFromMatrixPosition(timberMatrix);
    expect(lowerBeam.y).toBeCloseTo(3.25);
    expect(upperBeam.y).toBeCloseTo(swordhavenFirstBook.landscape.streetWallHeight - 0.21);
    for (let i = 0; i < beams.count; i += 2) {
      beams.getMatrixAt(i, timberMatrix);
      const beamPosition = new THREE.Vector3().setFromMatrixPosition(timberMatrix);
      const gx = Math.round(beamPosition.x / 4 + center.x);
      const gy = Math.round(beamPosition.z / 4 + center.y);
      expect(grid[gy]?.[gx]).toBe('#');
      expect(gy).toBeGreaterThanOrEqual(16);
      expect(gy).toBeLessThanOrEqual(20);
    }

    // Three recognisable landmarks mark the southern approaches and the
    // inner crossing without placing props on traversable tiles.
    const lamps = swordhavenFirstBook.landscape.wallLanterns;
    expect(lamps).toEqual([
      { x: 4, y: 14, side: 'east' },
      { x: 14, y: 14, side: 'west' },
      { x: 9, y: 20, side: 'west' },
    ]);
    const mounts = town.getObjectByName('chronicles-town-wall-lantern-mounts');
    const glass = town.getObjectByName('chronicles-town-wall-lantern-glass');
    const caps = town.getObjectByName('chronicles-town-wall-lantern-caps');
    for (const mesh of [mounts, glass, caps]) {
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBe(3);
      expect(mesh.castShadow).toBe(false);
    }
    expect(glass.material.emissive.getHex()).toBe(0x98521b);
    // More detailed ironwork uses the SAME three batches, anchored to the
    // original authored solid cells, with no new lights or collider volumes.
    expect(mounts.geometry.index.count).toBe(8 * 36);
    expect(caps.geometry.index.count).toBe(3 * 36);
    expect(glass.geometry.index.count).toBe(36);
    expect(glass.geometry.parameters.depth).toBeCloseTo(0.035);
    for (const mesh of [mounts, glass, caps]) {
      expect(mesh.userData.chroniclesDecorativeOnly).toBe(true);
      expect(mesh.frustumCulled).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
    }
    expect(mounts.material).toBe(caps.material);
    const cageBounds = new THREE.Box3()
      .setFromBufferAttribute(mounts.geometry.getAttribute('position'));
    const capBounds = new THREE.Box3()
      .setFromBufferAttribute(caps.geometry.getAttribute('position'));
    expect(cageBounds.min.x).toBeLessThan(-0.23);
    expect(cageBounds.max.x).toBeGreaterThan(0.23);
    expect(cageBounds.max.y + 1.68).toBeGreaterThan(2.16);
    expect(cageBounds.min.y + 1.68).toBeGreaterThan(1.4);
    expect(capBounds.max.y + 2.14).toBeGreaterThan(2.34);
    expect(capBounds.min.y + 2.14).toBeGreaterThan(2.08);
    expect(1.974 + cageBounds.max.z).toBeLessThan(2);
    expect(1.974 + capBounds.max.z).toBeLessThan(2);
    const directions = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] };
    for (const [index, lamp] of lamps.entries()) {
      const [dx, dy] = directions[lamp.side];
      expect(grid[lamp.y][lamp.x]).toBe('#');
      expect(grid[lamp.y + dy][lamp.x + dx]).toBe('.');
      glass.getMatrixAt(index, facadeMatrix);
      const lit = new THREE.Vector3().setFromMatrixPosition(facadeMatrix);
      expect(lit.x).toBeCloseTo((lamp.x - center.x) * 4 + dx * 1.974);
      expect(lit.z).toBeCloseTo((lamp.y - center.y) * 4 + dy * 1.974);
      expect(lit.y).toBeCloseTo(1.88);
    }
    // Lantern depth stays within the 4m solid cell, not the walkable street.
    expect(1.974 + glass.geometry.parameters.depth / 2).toBeLessThan(2);
    expect(1.974 + glass.geometry.parameters.depth / 2).toBeGreaterThan(1.974 + 0.012 / 2); // Outside limewash surface.
    expect(1.974 + capBounds.max.z).toBeLessThan(2);
    // Street-wall runs of varying sizes now read as several houses instead of
    // one flat-topped fortification. Roofs share a six-triangle base mesh.
    const roofRuns = swordhavenFirstBook.landscape.roofRuns;
    expect(roofRuns).toEqual([
      { x: 2, y: 16, width: 4 },
      { x: 13, y: 16, width: 4 },
      { x: 2, y: 20, width: 4 },
      { x: 13, y: 20, width: 4 },
      { x: 7, y: 16, width: 5 },
      { x: 4, y: 18, width: 2 },
      { x: 13, y: 18, width: 2 },
    ]);
    const roofs = town.getObjectByName('chronicles-town-south-pitched-roofs');
    expect(roofs).toBeInstanceOf(THREE.InstancedMesh);
    expect(roofs.count).toBe(7);
    // A single instanced roof batch carries three stable clay shades.
    // Colour variation must not add per-house materials or draw calls.
    expect(roofs.instanceColor).toBeTruthy();
    const expectedRoofTints = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#eee1d5'),
      new THREE.Color('#e0d4cb'),
    ];
    const roofShades = new Set();
    const roofHeights = new Set();
    const ridgeTimbers = town.getObjectByName('chronicles-town-south-roof-oak-ridges');
    const vergeTimbers = town.getObjectByName('chronicles-town-south-roof-oak-verges');
    expect(ridgeTimbers.count).toBe(roofs.count);
    expect(vergeTimbers.count).toBe(roofs.count * 4);
    expect(ridgeTimbers.material).toBe(vergeTimbers.material);
    expect(roofs.castShadow).toBe(false);
    expect(roofs.geometry.getAttribute('position').count).toBe(6);
    expect(roofs.geometry.index.count).toBe(18);
    expect(roofs.material.map).toBe(swordhavenSurfaceTexture('roof'));
    expect(roofs.material.normalMap).toBe(swordhavenSurfaceNormalTexture('roof'));
    expect(roofs.material.normalScale.x).toBeCloseTo(0.35);
    expect(roofs.material.map.repeat.toArray()).toEqual(roofs.material.normalMap.repeat.toArray());
    expect(roofs.material.map.wrapT).toBe(THREE.RepeatWrapping);
    const uv = roofs.geometry.getAttribute('uv');
    expect(uv.count).toBe(6);
    expect(uv.getX(0)).toBe(0);
    expect(uv.getX(1)).toBe(1);
    expect(uv.getY(4)).toBe(0.5);
    expect(roofs.geometry.getAttribute('position').count).toBe(6);
    roofs.geometry.computeBoundingBox();
    // 22cm eaves beyond the 4m cell make the roofline visible from street
    // level. The original six vertices / 18 indices remain unchanged.
    expect(roofs.geometry.boundingBox.max.x).toBeCloseTo(8.22);
    expect(roofs.geometry.boundingBox.max.z).toBeCloseTo(2.22);
    for (const [index, run] of roofRuns.entries()) {
      expect(grid[run.y].slice(run.x, run.x + run.width)).toBe('#'.repeat(run.width));
      expect(grid[run.y - 1].slice(run.x, run.x + run.width)).toContain('.');
      roofs.getMatrixAt(index, facadeMatrix);
      const roof = new THREE.Vector3().setFromMatrixPosition(facadeMatrix);
      expect(roof.x).toBeCloseTo((run.x + (run.width - 1) / 2 - center.x) * 4);
      const scale = new THREE.Vector3().setFromMatrixScale(facadeMatrix);
      const actualRoofLength = (4 * 4 + 0.44) * scale.x;
      expect(actualRoofLength).toBeCloseTo(run.width * 4 + 0.44);
      expect(actualRoofLength - run.width * 4).toBeCloseTo(0.44);
      const rise = swordhavenRoofRise(run);
      roofHeights.add(rise);
      // One roof mesh, four distinct roofline profiles. The actual tip of
      // the shell matches the shared rise used by oak trim and dormers.
      expect(scale.y).toBeCloseTo(rise / 0.92);
      expect(scale.z).toBeCloseTo(1);
      const ridgeMatrix = new THREE.Matrix4();
      ridgeTimbers.getMatrixAt(index, ridgeMatrix);
      const ridge = new THREE.Vector3().setFromMatrixPosition(ridgeMatrix);
      expect(ridge.y).toBeCloseTo(swordhavenFirstBook.landscape.streetWallHeight - 0.04 + rise + 0.035);
      const vergeMatrix = new THREE.Matrix4();
      vergeTimbers.getMatrixAt(index * 4, vergeMatrix);
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const vergeScale = new THREE.Vector3();
      vergeMatrix.decompose(pos, quat, vergeScale);
      expect(pos.y).toBeCloseTo(swordhavenFirstBook.landscape.streetWallHeight - 0.04 + rise / 2 + 0.035);
      expect(vergeScale.z).toBeCloseTo(Math.hypot(2.22, rise) / Math.hypot(2.22, 0.92));
      expect(Math.abs(new THREE.Euler().setFromQuaternion(quat).x))
        .toBeCloseTo(Math.atan2(rise, 2.22));
      expect(roof.y).toBeCloseTo(swordhavenFirstBook.landscape.streetWallHeight - 0.04);
      expect(roof.z).toBeCloseTo((run.y - center.y) * 4);
      const actualTint = new THREE.Color();
      roofs.getColorAt(index, actualTint);
      const expectedTint = expectedRoofTints[(run.x * 5 + run.y * 7 + run.width) % 3];
      expect(actualTint.r).toBeCloseTo(expectedTint.r, 5);
      expect(actualTint.g).toBeCloseTo(expectedTint.g, 5);
      expect(actualTint.b).toBeCloseTo(expectedTint.b, 5);
      roofShades.add(actualTint.getHexString());
    }
    expect(roofShades.size).toBe(3);
    expect([...roofHeights].sort((a, b) => a - b)).toEqual([0.78, 0.92, 1.25, 1.46]);
    for (const style of ['forge', 'armor', 'tavern', 'temple', 'store', 'watch']) {
      expect(names.some(name => name.startsWith('swordhaven-building-first-book-' + style + '-'))).toBe(true);
    }
    // Named facades are readable objects, never generic pavement monoliths.
    const labels = { forge: 'ARMERIA', armor: 'ARMADURAS', tavern: 'TABERNA',
      temple: 'TEMPLO', store: 'PROVISIONES', watch: 'GUARDIA' };
    for (const [style, expected] of Object.entries(labels)) {
      const building = town.children.find(child =>
        child.name.startsWith('swordhaven-building-first-book-' + style + '-'));
      const nameplate = building.getObjectByName('swordhaven-shop-nameplate');
      expect(nameplate.userData.shopLabel).toBe(expected);
      const lettering = nameplate.getObjectByName('shop-nameplate-lettering');
      expect(lettering.material.map).toBeInstanceOf(THREE.DataTexture);
      expect(lettering.material.map.magFilter).toBe(THREE.NearestFilter);
      expect(lettering.material.map.image.width).toBe(256);
      expect(lettering.material.map.image.height).toBe(64);
      expect(nameplate.position.z).toBeLessThan(5); // Within the blocking building footprint.
    }
    // The first destination is a real, readable civic landmark, not a HUD
    // waypoint: a red roof, a stone cupola, and its own engraved nameplate.
    const hall = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-hall-'));
    const temple = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-temple-'));
    expect(hall).toBeTruthy();
    expect(hall.getObjectByName('civic-cupola-tower')).toBeTruthy();
    expect(hall.getObjectByName('civic-cupola-roof')).toBeTruthy();
    expect(hall.getObjectByName('civic-seal-tower')).toBeTruthy();
    expect(hall.getObjectByName('temple-bell-tower')).toBeFalsy();
    expect(hall.getObjectByName('swordhaven-shop-nameplate')?.userData.shopLabel)
      .toBe('AYUNTAMIENTO');
    expect(temple.getObjectByName('temple-bell-tower')).toBeTruthy();
    expect(temple.getObjectByName('civic-cupola-tower')).toBeFalsy();

    // Two crystal-sign shops must not look like the same wizard's tower.
    // The apothecary has its own green rooftop herbarium and hanging herbs,
    // while the guild retains the original turret. Pure dressing: no grid edit.
    const apothecary = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-apothecary-'));
    const guild = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-guild-'));
    expect(apothecary).toBeTruthy();
    expect(guild).toBeTruthy();
    const herbarium = apothecary.getObjectByName('apothecary-roof-herbarium');
    expect(herbarium).toBeInstanceOf(THREE.Group);
    expect(herbarium.getObjectByName('herbarium-green-glazing')).toBeInstanceOf(THREE.Mesh);
    expect(herbarium.getObjectByName('herbarium-glazed-roof')).toBeInstanceOf(THREE.Mesh);
    const herbs = apothecary.getObjectByName('apothecary-hanging-herbs');
    expect(herbs).toBeInstanceOf(THREE.InstancedMesh);
    expect(herbs.count).toBe(4);
    expect(herbs.userData.chroniclesDecorativeOnly).toBe(true);
    expect(new THREE.Box3().setFromObject(herbarium).min.y).toBeGreaterThan(5);
    expect(apothecary.getObjectByName('magic-shop-turret')).toBeFalsy();
    expect(guild.getObjectByName('magic-shop-turret')).toBeTruthy();
    expect(guild.getObjectByName('apothecary-roof-herbarium')).toBeFalsy();
    // Keep the glass herbarium legible: the botica no longer shares domestic
    // roof dormers or a chimney with ordinary shops.
    expect(apothecary.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
    expect(apothecary.getObjectByName('pitched-roof-dormer-1')).toBeFalsy();
    expect(apothecary.getObjectByName('stone-chimney')).toBeFalsy();

    // The botica's four side panes now read as sage-green herb-house
    // windows with paired timber shutters, not generic amber shop glazing.
    const sidePanes = apothecary.children.filter(child =>
      child.name === 'side-window-apothecary-sage-glass');
    expect(sidePanes).toHaveLength(4);
    expect(sidePanes[0].material.color.getHex()).toBe(0x617b54);
    const shutters = apothecary.getObjectByName('apothecary-side-sage-shutters');
    expect(shutters).toBeInstanceOf(THREE.InstancedMesh);
    expect(shutters.count).toBe(8);
    expect(shutters.userData.chroniclesDecorativeOnly).toBe(true);
    expect(shutters.material.color.getHex()).toBe(0x526c49);
    expect(apothecary.getObjectByName('side-window-amber-glass')).toBeFalsy();
    expect(guild.getObjectByName('apothecary-side-sage-shutters')).toBeFalsy();
    expect(apothecary.getObjectByName('shop-door')).toBeTruthy();
    const botanicalBays = apothecary.getObjectByName('apothecary-botanical-window-bays');
    expect(botanicalBays).toBeInstanceOf(THREE.Group);
    expect(botanicalBays.userData.chroniclesDecorativeOnly).toBe(true);
    expect(botanicalBays.children).toHaveLength(2);
    expect(botanicalBays.children.every(bay =>
      bay.getObjectByName('apothecary-window-rounded-stone-arch')
      && bay.getObjectByName('apothecary-window-oak-mullion')
      && bay.getObjectByName('apothecary-window-sage-glass')?.material.color.getHex() === 0x79aa8e
    )).toBe(true);
    expect(apothecary.getObjectByName('warm-glass-window')).toBeFalsy();
    expect(apothecary.getObjectByName('apothecary-herb-window-box')).toBeTruthy();
    expect(apothecary.getObjectByName('window-box-leaf-clusters')).toBeInstanceOf(THREE.InstancedMesh);
    expect(guild.getObjectByName('apothecary-botanical-window-bays')).toBeFalsy();
    expect(apothecary.getObjectByName('swordhaven-shop-nameplate')?.userData.shopLabel)
      .toBe('BOTICA');

    // Two metalwork merchants must be recognisable by their roofline, not
    // just their signs: a tall forge flue versus an armorer's gable shield.
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    const armorer = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-armor-'));
    const watch = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-watch-'));
    expect(forge).toBeTruthy();
    expect(armorer).toBeTruthy();
    const stack = forge.getObjectByName('forge-roof-smokestack');
    const crest = armorer.getObjectByName('armor-roof-crest');
    expect(stack).toBeInstanceOf(THREE.Group);
    expect(stack.userData.chroniclesDecorativeOnly).toBe(true);
    expect(stack.getObjectByName('forge-smokestack-masonry')).toBeInstanceOf(THREE.Mesh);
    expect(stack.getObjectByName('forge-smokestack-iron-crown')).toBeInstanceOf(THREE.Mesh);
    expect(new THREE.Box3().setFromObject(stack).min.y).toBeGreaterThan(5);
    expect(new THREE.Box3().setFromObject(stack).max.y).toBeGreaterThan(9);
    expect(crest).toBeInstanceOf(THREE.Group);
    expect(crest.userData.chroniclesDecorativeOnly).toBe(true);
    expect(crest.getObjectByName('armor-crest-shield')).toBeInstanceOf(THREE.Mesh);
    expect(crest.getObjectByName('armor-crest-crossbar')).toBeInstanceOf(THREE.Mesh);
    expect(crest.getObjectByName('armor-crest-roof-mast')).toBeInstanceOf(THREE.Mesh);
    expect(crest.position.y).toBeGreaterThan(8); // Shield clears the gable ridge.
    expect(new THREE.Box3().setFromObject(crest).min.y).toBeGreaterThan(5);
    expect(forge.getObjectByName('armor-roof-crest')).toBeFalsy();
    expect(armorer.getObjectByName('forge-roof-smokestack')).toBeFalsy();
    expect(watch?.getObjectByName('armor-roof-crest')).toBeFalsy();

    // The guardhouse is a military lookout, not another shield merchant.
    // Crenellations are overhead dressing and cannot change walkable cells.
    expect(watch).toBeTruthy();
    const watchTower = watch.getObjectByName('watchhouse-battlement-tower');
    expect(watchTower).toBeInstanceOf(THREE.Group);
    expect(watchTower.userData.chroniclesDecorativeOnly).toBe(true);
    expect(watchTower.getObjectByName('watchhouse-tower-masonry')).toBeInstanceOf(THREE.Mesh);
    expect(watchTower.getObjectByName('watchhouse-parapet-rim')).toBeInstanceOf(THREE.Mesh);
    expect(watchTower.getObjectByName('watchhouse-arrow-slit')).toBeInstanceOf(THREE.Mesh);
    expect(watchTower.children.filter(child => child.name === 'watchhouse-front-merlon')).toHaveLength(3);
    expect(watchTower.children.filter(child => child.name === 'watchhouse-side-merlon')).toHaveLength(2);
    expect(new THREE.Box3().setFromObject(watchTower).min.y).toBeGreaterThan(5);
    expect(new THREE.Box3().setFromObject(watchTower).max.y).toBeGreaterThan(11);
    expect(new THREE.Box3().setFromObject(watchTower.getObjectByName('watchhouse-tower-masonry')).max.y).toBeGreaterThan(10.5);
    expect(watchTower.position.z).toBeGreaterThan(0); // Street-facing, not hidden behind ridge.
    expect(armorer.getObjectByName('watchhouse-battlement-tower')).toBeFalsy();
    expect(forge.getObjectByName('watchhouse-battlement-tower')).toBeFalsy();

    // The quartermaster's general store must read as a market storefront,
    // not another forge or guardhouse. Canopy is overhead-only decoration.
    const store = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-store-'));
    expect(store).toBeTruthy();
    const awning = store.getObjectByName('store-market-awning');
    expect(awning).toBeInstanceOf(THREE.Group);
    expect(awning.userData.chroniclesDecorativeOnly).toBe(true);
    expect(awning.getObjectByName('store-awning-cloth')).toBeInstanceOf(THREE.Mesh);
    expect(awning.getObjectByName('store-awning-front-rail')).toBeInstanceOf(THREE.Mesh);
    const stripes = awning.getObjectByName('store-awning-stripe');
    expect(stripes).toBeInstanceOf(THREE.InstancedMesh);
    expect(stripes.count).toBe(6);
    expect(new THREE.Box3().setFromObject(awning).min.y).toBeGreaterThan(2.5);
    expect(forge.getObjectByName('store-market-awning')).toBeFalsy();
    expect(watch?.getObjectByName('store-market-awning')).toBeFalsy();
    // Warehouse hatches replace the general store's four domestic side
    // windows. The three timber battens per hatch are batched for mobile.
    const cargoHatches = store.children.filter(child =>
      child.name === 'side-window-store-oak-loading-hatch');
    expect(cargoHatches).toHaveLength(4);
    expect(cargoHatches[0].material.color.getHex()).toBe(0x614932);
    const battens = store.getObjectByName('store-side-loading-hatch-battens');
    expect(battens).toBeInstanceOf(THREE.InstancedMesh);
    expect(battens.count).toBe(12);
    expect(battens.material.color.getHex()).toBe(0x997451);
    expect(battens.userData.chroniclesDecorativeOnly).toBe(true);
    expect(store.getObjectByName('side-window-amber-glass')).toBeFalsy();
    expect(store.getObjectByName('shop-door')).toBeTruthy();
    expect(apothecary.getObjectByName('store-side-loading-hatch-battens')).toBeFalsy();
    expect(forge.getObjectByName('store-side-loading-hatch-battens')).toBeFalsy();

    // From the authored spawn on the plaza, players can walk to the mayor:
    // do not let architectural dressing imply a door behind solid collision.
    const visited = new Set();
    const pending = [[swordhavenFirstBook.partyStart.x, swordhavenFirstBook.partyStart.y]];
    while (pending.length) {
      const [x, y] = pending.shift();
      const id = `${x},${y}`;
      if (visited.has(id) || grid[y]?.[x] !== '.') continue;
      visited.add(id);
      pending.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    expect(visited.has('11,10')).toBe(true);

    for (const house of town.children.filter(child => child.name.includes('-home-'))) {
      expect(house.getObjectByName('swordhaven-shop-nameplate')).toBeFalsy();
      expect(house.getObjectByName('armor-display')).toBeFalsy();
    }
    // The expanded wards also contain freestanding alley walls: unlike the original plaza,
    // not every blocker belongs to the outer town perimeter.
    const wall = grid.reduce((sum, row, y) => sum + [...row].filter((tile, x) => (
      tile === '#' && (x === 0 || y === 0 || x === width - 1 || y === height - 1))).length, 0);
    const perimeter = scene.getObjectByName('chronicles-campaign-town-perimeter');
    const battlements = scene.getObjectByName('chronicles-campaign-town-battlements');
    const urbanWalls = scene.getObjectByName('chronicles-campaign-visible-blockers');
    expect(perimeter).toBeInstanceOf(THREE.InstancedMesh);
    expect(battlements).toBeInstanceOf(THREE.InstancedMesh);
    expect(perimeter.frustumCulled).toBe(false);
    expect(battlements.frustumCulled).toBe(false);
    // Swordhaven has one real passage north at (9,0). The perimeter batch
    // excludes precisely that solid tile; two jambs and a lintel replace it.
    expect(perimeter.count).toBe(wall - 1);
    const opening = scene.getObjectByName('chronicles-town-gate-passage-to-first-book-banner-road');
    const gate = scene.getObjectByName('chronicles-campaign-content-to-first-book-banner-road');
    expect(opening).toBeInstanceOf(THREE.Group);
    expect(opening.children.filter(part => part.name === 'chronicles-town-gate-wall-jamb')).toHaveLength(2);
    expect(opening.getObjectByName('chronicles-town-gate-wall-lintel')).toBeTruthy();
    expect(gate.getObjectByName('chronicles-town-gate-threshold')).toBeTruthy();
    expect(gate.getObjectByName('chronicles-town-gate-outbound-road')).toBeTruthy();
    expect(gate.userData.chroniclesContentId).toBe('to-first-book-banner-road');
    expect(gate.userData.chroniclesExitGatewayStyle).toBe('settlement');
    expect(battlements.count).toBeGreaterThan(0);
    expect(perimeter.geometry.parameters.height).toBe(6.4);
    expect(urbanWalls.count + perimeter.count).toBe(125); // One gate tile is no longer a solid block.
    expect(urbanWalls.count).toBeLessThan(perimeter.count); // No doubled border masonry.
    // An eye-level north ray must now pass through the real carved opening.
    // Every other compass direction must still encounter the city wall.
    scene.updateMatrixWorld(true);
    const rayTo = (direction) => new THREE.Raycaster(
      new THREE.Vector3(0, 1.62, 0),
      new THREE.Vector3(...direction), 0.1, 90,
    );
    const north = rayTo([0, 0, -1]);
    expect(north.intersectObject(perimeter)).toHaveLength(0);
    expect(north.intersectObject(opening, true)).toHaveLength(0);
    for (const direction of [[0, 0, 1], [-1, 0, 0], [1, 0, 0]]) {
      expect(rayTo(direction).intersectObject(perimeter).length).toBeGreaterThan(0);
    }
    // The matrix of every perimeter instance corresponds to a real blocked
    // edge tile. No extra obstacle may appear over a shop approach or street.
    const perimeterMatrix = new THREE.Matrix4();
    const perimeterPosition = new THREE.Vector3();
    const visitedPerimeter = new Set();
    for (let index = 0; index < perimeter.count; index += 1) {
      perimeter.getMatrixAt(index, perimeterMatrix);
      perimeterPosition.setFromMatrixPosition(perimeterMatrix);
      const x = Math.round(perimeterPosition.x / 4 + center.x);
      const y = Math.round(perimeterPosition.z / 4 + center.y);
      expect(grid[y][x]).toBe('#');
      expect(x === 0 || x === width - 1 || y === 0 || y === height - 1).toBe(true);
      visitedPerimeter.add(x + ',' + y);
    }
    expect(visitedPerimeter.size).toBe(wall - 1);
    expect(visitedPerimeter.has('9,0')).toBe(false);
    expect(grid[0][9]).toBe('#'); // Visual opening is NOT a collision change.
    expect(swordhavenFirstBook.landscape.streetWallHeight).toBe(6.4);
    expect(urbanWalls).toBeInstanceOf(THREE.InstancedMesh);
    expect(urbanWalls.geometry.parameters.height).toBe(6.4);
    urbanWalls.getMatrixAt(0, facadeMatrix);
    const firstWallCenter = new THREE.Vector3().setFromMatrixPosition(facadeMatrix);
    expect(firstWallCenter.y).toBeCloseTo(3.16);
    // A 1.62m first-person camera must see full-height buildings,
    // not the old 1.6m parapet with the sky filling half the view.
    expect(urbanWalls.geometry.parameters.height).toBeGreaterThan(1.62 * 3);
    expect(town.getObjectByName('swordhaven-fountain')).toBeTruthy();
  });

  it('keeps specialty merchant roofs distinct in both detail modes', () => {
    const grid = swordhavenFirstBook.grid;
    const content = [...swordhavenFirstBook.interactables, ...swordhavenFirstBook.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y } }));
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildChroniclesCampaignExterior(scene, {
        coarsePointer,
        scenePlan: {
          mapId: 'swordhaven-first-book', regionKind: 'settlement',
          width: grid[0].length, height: grid.length,
          center: { x: 9, y: 7 }, grid, content,
          landscape: swordhavenFirstBook.landscape,
        },
      });
      const town = scene.getObjectByName('chronicles-campaign-town');
      const botica = town.children.find(child =>
        child.name.startsWith('swordhaven-building-first-book-apothecary-'));
      const store = town.children.find(child =>
        child.name.startsWith('swordhaven-building-first-book-store-'));
      expect(botica.getObjectByName('apothecary-roof-herbarium')).toBeTruthy();
      expect(botica.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
      expect(botica.getObjectByName('pitched-roof-dormer-1')).toBeFalsy();
      expect(botica.getObjectByName('stone-chimney')).toBeFalsy();
      expect(botica.getObjectByName('shop-door')).toBeTruthy();
      // Provisions has a warehouse loading boom, not a domestic chimney.
      // Its hoist is present in both detail modes without blocking the door.
      expect(store.getObjectByName('stone-chimney')).toBeFalsy();
      const hoist = store.getObjectByName('store-loft-loading-hoist');
      expect(hoist).toBeInstanceOf(THREE.Group);
      expect(hoist.userData.chroniclesDecorativeOnly).toBe(true);
      expect(hoist.getObjectByName('store-hoist-oak-boom')).toBeInstanceOf(THREE.Mesh);
      expect(hoist.children.filter(child => child.name === 'store-hoist-gantry-upright')).toHaveLength(2);
      expect(hoist.getObjectByName('store-hoist-gantry-crosshead')).toBeInstanceOf(THREE.Mesh);
      expect(hoist.getObjectByName('store-hoist-diagonal-brace')).toBeInstanceOf(THREE.Mesh);
      expect(hoist.getObjectByName('store-hoist-chain')).toBeInstanceOf(THREE.Mesh);
      expect(hoist.getObjectByName('store-hoist-iron-ring')).toBeInstanceOf(THREE.Mesh);
      expect(botica.getObjectByName('store-loft-loading-hoist')).toBeFalsy();
      expect(store.getObjectByName('shop-door')).toBeTruthy();
    }
  });

  it('rejects overlapping or non-solid roof runs rather than creating floating houses', () => {
    const grid = [
      '########',
      '#......#',
      '#.####.#',
      '#......#',
      '########',
    ];
    const scene = new THREE.Scene();
    buildChroniclesCampaignExterior(scene, {
      coarsePointer: true,
      scenePlan: {
        mapId: 'test-settlement', regionKind: 'settlement',
        grid, width: 8, height: 5, center: { x: 3.5, y: 2 }, content: [],
        landscape: {
          streetWallHeight: 6.4,
          roofRuns: [
            { x: 2, y: 2, width: 4 },
            { x: 2, y: 2, width: 4 }, // duplicate
            { x: 3, y: 2, width: 3 }, // overlaps the accepted roof
            { x: 0, y: 2, width: 2 }, // would cover walkable floor
            { x: 2, y: 2, width: 7 }, // unsupported span
          ],
        },
      },
    });
    const roofs = scene.getObjectByName('chronicles-town-south-pitched-roofs');
    expect(roofs).toBeInstanceOf(THREE.InstancedMesh);
    expect(roofs.count).toBe(1);
    expect(scene.getObjectByName('chronicles-campaign-visible-blockers').geometry.parameters.height).toBe(6.4);
  });

  it('builds the Rookwood forest with pixel-art bark and foliage', () => {
    const grid = rookwood.grid;
    const scene = new THREE.Scene();
    buildChroniclesCampaignExterior(scene, {
      coarsePointer: true,
      scenePlan: {
        mapId: 'rookwood-first-book', regionKind: 'wilderness', width: grid[0].length, height: grid.length,
        center: { x: Math.floor(grid[0].length / 2), y: Math.floor(grid.length / 2) }, grid, content: [],
      },
    });
    const forest = scene.getObjectByName('chronicles-campaign-forest');
    expect(forest.children).toHaveLength(3);
    for (const mesh of forest.children) {
      expect(mesh.material.map?.magFilter).toBe(THREE.NearestFilter);
    }
  });
});
