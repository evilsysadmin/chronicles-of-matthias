import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior, settlementHouseBlocks, settlementHouseFacing } from './chroniclesCampaignExterior3D.js';
import swordhavenFirstBook from './maps/swordhaven-first-book.json';
import rookwood from './maps/rookwood-first-book.json';

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
    expect(scene.getObjectByName('chronicles-first-person-ceiling')).toBeUndefined();
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
    const paved = scene.getObjectByName('chronicles-campaign-road');
    expect(paved).toBeInstanceOf(THREE.InstancedMesh);
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
    expect(frames.count).toBeGreaterThan(20);
    expect(panes.count).toBe(frames.count);
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
    expect(panePos.z - (16 - center.y) * 4 + 0.007).toBeLessThan(2);
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
    const directions = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] };
    for (const [index, lamp] of lamps.entries()) {
      const [dx, dy] = directions[lamp.side];
      expect(grid[lamp.y][lamp.x]).toBe('#');
      expect(grid[lamp.y + dy][lamp.x + dx]).toBe('.');
      glass.getMatrixAt(index, facadeMatrix);
      const lit = new THREE.Vector3().setFromMatrixPosition(facadeMatrix);
      expect(lit.x).toBeCloseTo((lamp.x - center.x) * 4 + dx * 1.90);
      expect(lit.z).toBeCloseTo((lamp.y - center.y) * 4 + dy * 1.90);
      expect(lit.y).toBeCloseTo(1.88);
    }
    // Lantern depth stays within the 4m solid cell, not the walkable street.
    expect(1.90 + glass.geometry.parameters.depth / 2).toBeLessThan(2);
    expect(1.88 + caps.geometry.parameters.depth / 2).toBeLessThan(2);
    for (const style of ['forge', 'armor', 'tavern', 'temple', 'store', 'watch']) {
      expect(names.some(name => name.startsWith('swordhaven-building-first-book-' + style + '-'))).toBe(true);
    }
    // Named facades are readable objects, never generic pavement monoliths.
    const labels = { forge: 'ARMERIA', armor: 'ARMADURAS', tavern: 'TABERNA',
      temple: 'TEMPLO', store: 'TIENDA', watch: 'GUARDIA' };
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
    const blockers = scene.getObjectByName('chronicles-campaign-visible-blockers').count;
    expect(blockers).toBeGreaterThan(wall);
    expect(blockers).toBe(126);
    expect(town.getObjectByName('swordhaven-fountain')).toBeTruthy();
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
