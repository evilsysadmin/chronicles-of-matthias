import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior, settlementHouseBlocks, settlementHouseFacing } from './chroniclesCampaignExterior3D.js';
import swordhavenFirstBook from './maps/swordhaven-first-book.json';
import rookwood from './maps/rookwood-first-book.json';
import { swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture } from './chroniclesSwordhaven3D.js';

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
    expect(beams.count).toBe(188);
    // Warm plaster between the timbers makes the blocked cells read as
    // actual houses. Every open street-facing side shares ONE extra batch.
    const plaster = town.getObjectByName('chronicles-town-street-limewash-fronts');
    expect(plaster).toBeInstanceOf(THREE.InstancedMesh);
    expect(plaster.count).toBe(94);
    expect(plaster.instanceColor).toBeTruthy();
    expect(plaster.material.map).toBe(swordhavenSurfaceTexture('stucco'));
    expect(plaster.material.normalMap).toBe(swordhavenSurfaceNormalTexture('stucco'));
    expect(plaster.material.normalScale.toArray()).toEqual([0.50, 0.50]);
    expect(plaster.material.map.repeat.toArray()).toEqual(plaster.material.normalMap.repeat.toArray());
    expect(plaster.material.map).toBeInstanceOf(THREE.DataTexture);
    expect(plaster.material.map.wrapS).toBe(THREE.RepeatWrapping);
    expect(plaster.castShadow).toBe(false);
    expect(plaster.geometry.parameters.height).toBeCloseTo(6.4 - 0.52);
    expect(plaster.geometry.parameters.width).toBeCloseTo(4 * 0.935);
    const plasterMatrix = new THREE.Matrix4();
    plaster.getMatrixAt(0, plasterMatrix);
    const firstPlaster = new THREE.Vector3().setFromMatrixPosition(plasterMatrix);
    expect(firstPlaster.x).toBeCloseTo((2 - center.x) * 4);
    expect(firstPlaster.z).toBeCloseTo((16 - center.y) * 4 + 1.974);
    expect(firstPlaster.y).toBeCloseTo(6.4 / 2 + 0.03);
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
    // Three gentle limewash variants group a few walls per house; no
    // additional materials/draw calls for each colour.
    const shades = new Set();
    for (let i = 0; i < plaster.count; i += 1) {
      plaster.getMatrixAt(i, plasterMatrix);
      const panel = new THREE.Vector3().setFromMatrixPosition(plasterMatrix);
      const gx = Math.round(panel.x / 4 + center.x);
      const gy = Math.round(panel.z / 4 + center.y);
      expect(grid[gy]?.[gx]).toBe('#');
      const shade = new THREE.Color();
      plaster.getColorAt(i, shade);
      shades.add(shade.getHexString());
    }
    expect(shades.size).toBe(3);
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
    expect(1.974 + caps.geometry.parameters.depth / 2).toBeLessThan(2);
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
      expect(scale.y).toBeCloseTo(1);
      expect(scale.z).toBeCloseTo(1);
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
    expect(awning.children.filter(child => child.name === 'store-awning-stripe')).toHaveLength(6);
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
    expect(perimeter.count).toBe(wall); // Every solid border tile, including corners.
    expect(battlements.count).toBeGreaterThan(0);
    expect(perimeter.geometry.parameters.height).toBe(6.4);
    expect(urbanWalls.count + perimeter.count).toBe(126);
    expect(urbanWalls.count).toBeLessThan(perimeter.count); // No doubled border masonry.
    // Actual 1.62m first-person eye rays from the plaza must hit solid
    // stone on all four sides, not empty sky; this tests live mesh placement
    // rather than simply counting instances in the authored map.
    scene.updateMatrixWorld(true);
    for (const direction of [
      [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0],
    ]) {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(0, 1.62, 0),
        new THREE.Vector3(...direction), 0.1, 90,
      );
      expect(ray.intersectObject(perimeter).length).toBeGreaterThan(0);
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
    expect(visitedPerimeter.size).toBe(wall);
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
