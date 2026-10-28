import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { chroniclesTownSurfacePixels } from './chroniclesTownSurfacePixels.js';
import {
  buildSwordhavenScene, createSwordhavenWalkGrid, SWORDHAVEN_BUILDINGS,
  SWORDHAVEN_INTERACTION_CELLS, SWORDHAVEN_GATE_CELL, SWORDHAVEN_SPAWN,
  swordhavenGrassTexture, createSwordhavenSkyDome,
  swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven modular real-time 3D', () => {
  it('has exactly the five canonical town services with unique content ids', () => {
    expect(SWORDHAVEN_BUILDINGS.map(b => b.id)).toEqual([
      'swordhaven-forge', 'swordhaven-armor', 'swordhaven-tavern',
      'swordhaven-magic', 'swordhaven-temple',
    ]);
    expect(new Set(SWORDHAVEN_BUILDINGS.map(b => b.id)).size).toBe(5);
  });

  it('keeps all five shop approaches and the southern gate reachable on the real collision grid', () => {
    const grid = createSwordhavenWalkGrid();
    expect(grid).toHaveLength(19);
    expect(grid.every(row => row.length === 19)).toBe(true);
    expect(grid[9][9]).toBe('#'); // Fountain, not an invisible obstruction.
    for (const { x, y } of SWORDHAVEN_BUILDINGS) expect(grid[y][x]).toBe('#');
    const destinations = [...SWORDHAVEN_INTERACTION_CELLS, SWORDHAVEN_GATE_CELL];
    const seen = new Set();
    const queue = [[SWORDHAVEN_SPAWN.x, SWORDHAVEN_SPAWN.y]];
    while (queue.length) {
      const [x, y] = queue.shift();
      const id = x + ':' + y;
      if (seen.has(id) || grid[y]?.[x] !== '.') continue;
      seen.add(id);
      queue.push([x + 1,y],[x - 1,y],[x,y + 1],[x,y - 1]);
    }
    for (const { x, y } of destinations) {
      expect(grid[y][x]).toBe('.');
      expect(seen.has(x + ':' + y)).toBe(true);
    }
  });

  it('builds a sunny outdoor mesh scene and selectable authored storefronts', () => {
    const scene = new THREE.Scene();
    const state = buildSwordhavenScene(scene, {
      scenePlan: {
        width: 19, height: 19, center: { x: 9, y: 9 },
        content: SWORDHAVEN_BUILDINGS.map(b => ({
          id: b.id, kind: 'lore', visible: true, position: { x: b.x, y: b.y },
        })),
      },
      coarsePointer: true,
    });
    expect(scene.background).toBeInstanceOf(THREE.Color);
    expect(scene.getObjectByName('swordhaven-sun')).toBeTruthy();
    expect(scene.getObjectByName('swordhaven-sky-dome')).toBeTruthy();
    expect(scene.getObjectByName('grass-terrain').material.map).toBe(swordhavenGrassTexture());
    expect(scene.getObjectByName('chronicles-swordhaven-town')).toBeTruthy();
    expect(scene.getObjectByName('chronicles-first-person-ceiling')).toBeFalsy();
    expect(scene.getObjectByName('swordhaven-fountain')).toBeTruthy();
    expect(scene.getObjectByName('fountain-carved-rim')).toBeTruthy();
    expect(scene.getObjectByName('swordhaven-building-swordhaven-forge')?.getObjectByName('shop-amber-lantern')).toBeTruthy();
    expect(scene.getObjectByName('swordhaven-building-swordhaven-temple')?.getObjectByName('shop-pennant-left')).toBeTruthy();
    expect(scene.getObjectByName('swordhaven-building-swordhaven-tavern')?.getObjectByName('pitched-roof-shingle-seams')).toBeInstanceOf(THREE.InstancedMesh);
    expect(scene.getObjectByName('swordhaven-cloud-0')).toBeTruthy();
    const pavedStreet = scene.getObjectByName('swordhaven-street-cobblestones');
    expect(pavedStreet).toBeInstanceOf(THREE.InstancedMesh);
    expect(pavedStreet.count).toBeGreaterThan(100);
    expect(scene.getObjectByName('swordhaven-tree-0')?.getObjectByName('leaf-canopy-cluster'))
      .toBeInstanceOf(THREE.InstancedMesh);
    expect(scene.getObjectByName('swordhaven-building-swordhaven-temple')?.getObjectByName('temple-bell-tower')).toBeTruthy();
    expect(scene.getObjectByName('swordhaven-building-swordhaven-magic')?.getObjectByName('magic-shop-turret')).toBeTruthy();
    expect(scene.getObjectByName('swordhaven-building-swordhaven-tavern')?.getObjectByName('tavern-porch-awning')).toBeTruthy();
    expect(scene.getObjectByName('swordhaven-building-swordhaven-forge')?.getObjectByName('forge-brazier')).toBeTruthy();
    expect(scene.getObjectByName('perimeter-stone-wall--1')).toBeTruthy();
    expect(SWORDHAVEN_BUILDINGS.every(b => scene.getObjectByName('swordhaven-building-' + b.id))).toBe(true);
    expect(state.contentProps.map(p => p.id).sort())
      .toEqual(SWORDHAVEN_BUILDINGS.map(b => b.id).sort());
    expect(state.enemyDefinitions).toEqual([]);
    expect(state.spectralChapel.userData).toEqual({});
    expect(state.sceneCenter).toEqual({ x: 9, y: 9 });
  });


  it('tiles a deterministic pixel-art meadow with a short VGA-like palette', () => {
    const texture = swordhavenGrassTexture();
    expect(texture).toBe(swordhavenGrassTexture()); // One bounded allocation across runs.
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.magFilter).toBe(THREE.NearestFilter);
    expect(texture.repeat.x).toBeGreaterThan(1);
    const rgba = texture.image.data;
    expect(rgba).toHaveLength(64 * 64 * 4);
    const grassTones = new Set();
    for (let index = 0; index < rgba.length; index += 4) {
      grassTones.add([rgba[index], rgba[index + 1], rgba[index + 2]].join('/'));
      expect(rgba[index + 3]).toBe(255);
    }
    // Varied, but quantised: a ramp of greens plus a couple of flower accents.
    expect(grassTones.size).toBeGreaterThanOrEqual(5);
    expect(grassTones.size).toBeLessThanOrEqual(8);
  });

  it('keeps the skydome horizon and visible sun fixed when the party turns or walks', () => {
    const sun = new THREE.Vector3(-28, 26, -90).normalize();
    const sky = createSwordhavenSkyDome(sun);
    expect(sky.name).toBe('swordhaven-sky-dome');
    expect(sky.material.side).toBe(THREE.BackSide);
    expect(sky.material.vertexColors).toBe(true);
    expect(sky.getObjectByName('swordhaven-sun-disc')).toBeTruthy();
    expect(sky.getObjectByName('swordhaven-sun-halo')).toBeTruthy();
    const discDirection = sky.getObjectByName('swordhaven-sun-disc').position.clone().normalize();
    expect(discDirection.distanceTo(sun)).toBeLessThan(1e-6);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(12, 1.62, -16);
    sky.onBeforeRender(null, null, camera);
    expect(sky.position.equals(camera.position)).toBe(true);
    camera.position.set(-17, 1.62, 25);
    camera.rotation.y = Math.PI;
    sky.onBeforeRender(null, null, camera);
    expect(sky.position.equals(camera.position)).toBe(true);
    expect(sky.getObjectByName('swordhaven-sun-disc').position.clone().normalize().distanceTo(sun))
      .toBeLessThan(1e-6);
  });


  it('uses reusable masonry, stucco, oak and tile maps on real shop meshes', () => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer: true });
    const house = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    expect(house.getObjectByName('timber-and-stone-walls').material.map)
      .toBe(swordhavenSurfaceTexture('stucco'));
    expect(house.getObjectByName('stone-foundations').material.map)
      .toBe(swordhavenSurfaceTexture('masonry'));
    expect(house.getObjectByName('vertical-facade-post').material.map)
      .toBe(swordhavenSurfaceTexture('timber'));
    expect(house.getObjectByName('pitched-roof-1').material.map)
      .toBe(swordhavenSurfaceTexture('roof'));
    expect(scene.getObjectByName('swordhaven-building-swordhaven-temple')
      .getObjectByName('timber-and-stone-walls').material.map)
      .toBe(swordhavenSurfaceTexture('masonry'));
  });

  it('builds a single masonry-detail batch with true portal depth and intact door aperture', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      for (const spec of SWORDHAVEN_BUILDINGS) {
        const building = scene.getObjectByName('swordhaven-building-' + spec.id);
        const stones = building.getObjectByName('swordhaven-facade-dressed-stones');
        expect(stones).toBeInstanceOf(THREE.InstancedMesh);
        expect(stones.count).toBeGreaterThan(30);
        expect(stones.instanceColor).toBeTruthy();
        expect(stones.userData.chroniclesDecorativeOnly).toBe(true);
        expect(stones.castShadow).toBe(!coarsePointer);
        expect(building.getObjectByName('door-recessed-stone-jamb')).toBeFalsy();
        expect(building.getObjectByName('door-stone-lintel')).toBeFalsy();
        const portal = [];
        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();
        const scale = new THREE.Vector3();
        for (let index = 0; index < stones.count; index += 1) {
          stones.getMatrixAt(index, matrix);
          pos.setFromMatrixPosition(matrix);
          scale.setFromMatrixScale(matrix);
          // No decorative blocks in front of the door below the stone lintel.
          if (pos.y < 0.71 && Math.abs(pos.x) < 0.78) {
            throw new Error('Foundation dressing blocks the door');
          }
          expect(scale.x).toBeGreaterThan(0.12);
          expect(scale.y).toBeGreaterThan(0.15);
          // Instanced transforms round to Float32, so 0.43 can read back
          // as 0.430000007 without any change to the authored depth.
          expect(scale.z).toBeLessThan(0.44);
          portal.push([pos.x, pos.y]);
        }
        expect(portal.some(([x, y]) => x < -0.9 && y > 1 && y < 3)).toBe(true);
        expect(portal.some(([x, y]) => x > 0.9 && y > 1 && y < 3)).toBe(true);
      }
    }
  });

  it('gives only the fortified armory dark side embrasures with iron bars', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const armor = scene.getObjectByName('swordhaven-building-swordhaven-armor');
      const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
      const recesses = armor.children.filter(child => child.name === 'side-window-armory-dark-recess');
      const bars = armor.children.filter(child => child.name === 'side-window-armory-iron-bar');
      expect(recesses).toHaveLength(4);
      expect(bars).toHaveLength(4);
      expect(recesses[0].material.color.getHex()).toBe(0x28323a);
      expect(bars[0].material).toBe(armor.getObjectByName('shop-door-iron-straps').material);
      expect(bars[0].geometry.parameters.height).toBe(1.19);
      expect(armor.getObjectByName('side-window-amber-glass')).toBeFalsy();
      expect(armor.getObjectByName('side-window-crossbar')).toBeFalsy();
      expect(armor.getObjectByName('shop-door')).toBeTruthy();
      expect(forge.children.filter(child => child.name === 'side-window-forge-soot-vent')).toHaveLength(4);
      expect(forge.getObjectByName('side-window-armory-iron-bar')).toBeFalsy();
    }
  });

  it('gives the forge soot-darkened side vents with horizontal iron louvers', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
      const tavern = scene.getObjectByName('swordhaven-building-swordhaven-tavern');
      const armor = scene.getObjectByName('swordhaven-building-swordhaven-armor');
      const vents = forge.children.filter(child => child.name === 'side-window-forge-soot-vent');
      const louvers = forge.children.filter(child => child.name === 'side-window-forge-iron-louver');
      expect(vents).toHaveLength(4);
      expect(louvers).toHaveLength(4);
      expect(vents[0].material.color.getHex()).toBe(0x302820);
      expect(louvers[0].material).toBe(forge.getObjectByName('shop-door-iron-straps').material);
      expect(louvers[0].geometry.parameters.height).toBe(0.16);
      expect(forge.getObjectByName('side-window-amber-glass')).toBeFalsy();
      expect(forge.getObjectByName('side-window-crossbar')).toBeFalsy();
      expect(forge.getObjectByName('shop-door')).toBeTruthy();
      expect(tavern.children.filter(child => child.name === 'side-window-amber-glass')).toHaveLength(4);
      expect(tavern.getObjectByName('side-window-forge-soot-vent')).toBeFalsy();
      expect(armor.getObjectByName('side-window-forge-soot-vent')).toBeFalsy();
    }
  });

  it('gives the guild violet side windows while other merchants keep amber glazing', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const guild = scene.getObjectByName('swordhaven-building-swordhaven-magic');
      const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
      const violet = guild.children.filter(child => child.name === 'side-window-violet-glass');
      const brass = guild.children.filter(child => child.name === 'side-window-brass-mullion');
      expect(violet).toHaveLength(4);
      expect(brass).toHaveLength(4);
      expect(violet[0].material.color.getHex()).toBe(0x7658a9);
      expect(violet[0].material.emissive.getHex()).toBe(0x302052);
      expect(guild.getObjectByName('side-window-amber-glass')).toBeFalsy();
      expect(guild.getObjectByName('side-window-crossbar')).toBeFalsy();
      expect(forge.children.filter(child => child.name === 'side-window-forge-soot-vent')).toHaveLength(4);
      expect(forge.getObjectByName('side-window-violet-glass')).toBeFalsy();
      expect(guild.getObjectByName('shop-door')).toBeTruthy();
    }
  });

  it('keeps dressed stone, side windows and distinctive rooflines on the houses', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
      expect(forge.getObjectByName('corner-dressed-stone-courses')).toBeInstanceOf(THREE.InstancedMesh);
      expect(forge.getObjectByName('corner-dressed-stone-courses').count).toBeGreaterThan(20);
      expect(forge.getObjectByName('side-window-forge-soot-vent')).toBeTruthy();
      expect(forge.getObjectByName('swordhaven-facade-dressed-stones'))
        .toBeInstanceOf(THREE.InstancedMesh);
      expect(forge.getObjectByName('forge-roof-smoke-lantern')).toBeTruthy();
      const temple = scene.getObjectByName('swordhaven-building-swordhaven-temple');
      // Sacred roofline: no generic merchant dormers or domestic chimney.
      expect(temple.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
      expect(temple.getObjectByName('pitched-roof-dormer-1')).toBeFalsy();
      expect(temple.getObjectByName('stone-chimney')).toBeFalsy();
      const rose = temple.getObjectByName('temple-gable-rose-window');
      expect(rose?.userData.chroniclesDecorativeOnly).toBe(true);
      expect(rose.position.z).toBeGreaterThan(temple.getObjectByName('roof-gable-1').position.z);
      expect(rose.getObjectByName('temple-rose-blue-glass')?.geometry).toBeInstanceOf(THREE.CircleGeometry);
      expect(rose.getObjectByName('temple-rose-limestone-ring')?.geometry).toBeInstanceOf(THREE.TorusGeometry);
      expect(rose.getObjectByName('temple-rose-lead-tracery')?.count).toBe(4);
      expect(scene.getObjectByName('swordhaven-building-swordhaven-magic')
        .getObjectByName('temple-gable-rose-window')).toBeFalsy();
      const tower = temple.getObjectByName('temple-bell-tower');
      expect(tower.geometry.parameters.radialSegments).toBeGreaterThanOrEqual(12);
      const magic = scene.getObjectByName('swordhaven-building-swordhaven-magic');
      expect(magic.getObjectByName('magic-shop-turret').geometry.parameters.radialSegments).toBeGreaterThanOrEqual(12);
      // The observatory and turret, not merchant dormers or a domestic flue,
      // define the guild silhouette in both normal and coarse render modes.
      expect(magic.getObjectByName('magic-guild-roof-observatory')?.userData.chroniclesDecorativeOnly).toBe(true);
      expect(magic.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
      expect(magic.getObjectByName('pitched-roof-dormer-1')).toBeFalsy();
      expect(magic.getObjectByName('stone-chimney')).toBeFalsy();
      expect(magic.getObjectByName('shop-door')).toBeTruthy();
    }
  });

  it('gives only the tavern a pitched timber porch with clear shop plaque and entrance', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const tavern = scene.getObjectByName('swordhaven-building-swordhaven-tavern');
      const porch = tavern.getObjectByName('tavern-porch-awning');
      expect(porch?.userData.chroniclesDecorativeOnly).toBe(true);
      const slopes = porch.children.filter(child => child.name === 'tavern-porch-pitched-slope');
      expect(slopes).toHaveLength(2);
      expect(slopes[0].rotation.z).toBeGreaterThan(0);
      expect(slopes[1].rotation.z).toBeLessThan(0);
      expect(slopes[0].material).toBe(tavern.getObjectByName('pitched-roof-1').material);
      expect(slopes[0].castShadow).toBe(!coarsePointer);
      const ridge = porch.getObjectByName('tavern-porch-ridge');
      expect(ridge).toBeTruthy();
      const plaque = tavern.getObjectByName('swordhaven-shop-nameplate');
      expect(ridge.position.y + ridge.geometry.parameters.height / 2)
        .toBeLessThan(plaque.position.y
          - plaque.getObjectByName('shop-nameplate-wood').geometry.parameters.height / 2);
      expect(porch.position.z).toBeGreaterThan(tavern.getObjectByName('shop-door').position.z);
      expect(tavern.children.filter(child => child.name === 'porch-timber-support')).toHaveLength(2);
      for (const spec of SWORDHAVEN_BUILDINGS.filter(spec => spec.id !== 'swordhaven-tavern')) {
        expect(scene.getObjectByName('swordhaven-building-' + spec.id)
          .getObjectByName('tavern-porch-awning')).toBeFalsy();
      }
      expect(createSwordhavenWalkGrid()[15][4]).toBe('.');
    }
  });

  it('gives only the tavern a stepped brick roofline instead of merchant dormers', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const tavern = scene.getObjectByName('swordhaven-building-swordhaven-tavern');
      const gable = tavern.getObjectByName('tavern-brick-stepped-gable');
      expect(gable?.userData.chroniclesDecorativeOnly).toBe(true);
      const bricks = gable.getObjectByName('tavern-gable-brick-steps');
      const coping = gable.getObjectByName('tavern-gable-stone-coping');
      expect(bricks).toBeInstanceOf(THREE.InstancedMesh);
      expect(coping).toBeInstanceOf(THREE.InstancedMesh);
      expect(bricks.count).toBe(8);
      expect(coping.count).toBe(8);
      expect(bricks.material).toBe(tavern.getObjectByName('timber-and-stone-walls').material);
      expect(bricks.castShadow).toBe(!coarsePointer);
      expect(gable.position.z).toBeGreaterThan(tavern.getObjectByName('roof-gable-1').position.z);
      expect(gable.getObjectByName('tavern-gable-central-crown')).toBeTruthy();
      const rear = tavern.getObjectByName('tavern-brick-stepped-rear-gable');
      expect(rear?.userData.chroniclesDecorativeOnly).toBe(true);
      expect(rear.position.z).toBeLessThan(0);
      expect(rear.getObjectByName('tavern-gable-brick-steps')?.count).toBe(8);
      expect(tavern.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
      expect(tavern.getObjectByName('pitched-roof-dormer-1')).toBeFalsy();
      expect(tavern.getObjectByName('shop-door')).toBeTruthy();
      expect(tavern.getObjectByName('tavern-double-hearth')).toBeTruthy();
      for (const spec of SWORDHAVEN_BUILDINGS.filter(spec => spec.id !== 'swordhaven-tavern')) {
        expect(scene.getObjectByName('swordhaven-building-' + spec.id)
          .getObjectByName('tavern-brick-stepped-gable')).toBeFalsy();
      }
      expect(createSwordhavenWalkGrid()[15][4]).toBe('.');
    }
  });

  it('gives the temple a colonnaded stone portico without hiding its door or signs', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const temple = scene.getObjectByName('swordhaven-building-swordhaven-temple');
      const portico = temple.getObjectByName('temple-limestone-portico');
      expect(portico?.userData.chroniclesDecorativeOnly).toBe(true);
      const columns = portico.children.filter(child => child.name === 'temple-portico-column');
      expect(columns).toHaveLength(2);
      expect(columns[0].position.x).toBeLessThan(-1.8);
      expect(columns[1].position.x).toBeGreaterThan(1.8);
      expect(columns[0].geometry.parameters.radialSegments).toBe(coarsePointer ? 10 : 16);
      const door = temple.getObjectByName('shop-door');
      expect(Math.abs(columns[0].position.x) - columns[0].geometry.parameters.radiusBottom)
        .toBeGreaterThan(door.geometry.parameters.width / 2);
      expect(portico.position.z).toBeGreaterThan(door.position.z);
      const nameplate = temple.getObjectByName('swordhaven-shop-nameplate');
      const entablature = portico.getObjectByName('temple-portico-entablature');
      expect(entablature.position.y - entablature.geometry.parameters.height / 2)
        .toBeGreaterThan(nameplate.position.y
          + nameplate.getObjectByName('shop-nameplate-wood').geometry.parameters.height / 2);
      const pediment = portico.getObjectByName('temple-portico-triangular-pediment');
      expect(pediment).toBeTruthy();
      const sign = temple.getObjectByName('swordhaven-interaction-swordhaven-temple');
      expect(5.07).toBeLessThan(sign.position.y
        - sign.getObjectByName('hanging-sign').geometry.parameters.height / 2);
      for (const spec of SWORDHAVEN_BUILDINGS.filter(spec => spec.id !== 'swordhaven-temple')) {
        expect(scene.getObjectByName('swordhaven-building-' + spec.id)
          .getObjectByName('temple-limestone-portico')).toBeFalsy();
      }
      expect(createSwordhavenWalkGrid()[5][9]).toBe('.');
    }
  });

  it('gives only the mage guild a pointed stone entry and gable oculus without blocking its door', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const guild = scene.getObjectByName('swordhaven-building-swordhaven-magic');
      const entry = guild.getObjectByName('magic-guild-pointed-entry');
      const oculus = guild.getObjectByName('magic-guild-gable-oculus');
      expect(entry?.userData.chroniclesDecorativeOnly).toBe(true);
      expect(oculus?.userData.chroniclesDecorativeOnly).toBe(true);
      const piers = entry.children.filter(child => child.name === 'magic-entry-pier');
      const arches = entry.children.filter(child => child.name === 'magic-entry-pointed-arch');
      expect(piers).toHaveLength(2);
      expect(arches).toHaveLength(2);
      expect(piers[0].position.x).toBeLessThan(-1);
      expect(piers[1].position.x).toBeGreaterThan(1);
      expect(arches[0].rotation.z).toBeLessThan(0);
      expect(arches[1].rotation.z).toBeGreaterThan(0);
      expect(entry.position.z).toBeGreaterThan(guild.getObjectByName('shop-door').position.z);
      expect(oculus.getObjectByName('magic-oculus-violet-glass')).toBeTruthy();
      expect(oculus.getObjectByName('magic-oculus-brass-ring')).toBeTruthy();
      expect(guild.getObjectByName('shop-door')).toBeTruthy();
      for (const spec of SWORDHAVEN_BUILDINGS.filter(spec => spec.id !== 'swordhaven-magic')) {
        const other = scene.getObjectByName('swordhaven-building-' + spec.id);
        expect(other.getObjectByName('magic-guild-pointed-entry')).toBeFalsy();
        expect(other.getObjectByName('magic-guild-gable-oculus')).toBeFalsy();
      }
      expect(createSwordhavenWalkGrid()[15][14]).toBe('.');
    }
  });

  it('uses slate-violet masonry only for the guild while keeping its shopfront accessible', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const guild = scene.getObjectByName('swordhaven-building-swordhaven-magic');
      const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
      const armorer = scene.getObjectByName('swordhaven-building-swordhaven-armor');
      const walls = guild.getObjectByName('timber-and-stone-walls');
      expect(walls.material.color.getHex()).toBe(0x9d8aa9);
      expect(walls.material.map).toBe(swordhavenSurfaceTexture('masonry'));
      expect(walls.material.normalMap).toBe(swordhavenSurfaceNormalTexture('masonry'));
      expect(guild.getObjectByName('roof-gable-1').material).toBe(walls.material);
      expect(guild.getObjectByName('vertical-facade-post')).toBeFalsy();
      expect(guild.getObjectByName('diagonal-timber-brace')).toBeFalsy();
      expect(guild.getObjectByName('horizontal-facade-beam')).toBeFalsy();
      expect(forge.getObjectByName('vertical-facade-post')).toBeTruthy();
      expect(forge.getObjectByName('timber-and-stone-walls').material.map)
        .toBe(swordhavenSurfaceTexture('stucco'));
      expect(armorer.getObjectByName('timber-and-stone-walls').material).not.toBe(walls.material);
      expect(guild.getObjectByName('shop-door')).toBeTruthy();
      expect(guild.getObjectByName('swordhaven-shop-nameplate')?.userData.shopLabel)
        .toBe('MAGIA');
      expect(guild.getObjectByName('magic-guild-pointed-entry')).toBeTruthy();
      expect(createSwordhavenWalkGrid()[15][14]).toBe('.');
    }
  });

  it('gives only the forge a framed workshop bay without obscuring the door or shop name', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      const built = buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
      const bay = forge.getObjectByName('forge-stone-workshop-bay');
      const door = forge.getObjectByName('shop-door');
      const nameplate = forge.getObjectByName('swordhaven-shop-nameplate');
      expect(bay?.userData.chroniclesDecorativeOnly).toBe(true);
      expect(bay.children.filter(child => child.name === 'forge-workshop-stone-pier')).toHaveLength(2);
      expect(bay.children.filter(child => child.name === 'forge-workshop-cross-brace')).toHaveLength(2);
      expect(bay.getObjectByName('forge-workshop-iron-keystone')).toBeTruthy();
      const recess = bay.getObjectByName('forge-workshop-soot-recess');
      const coals = bay.getObjectByName('forge-workshop-embers');
      expect(recess.material.color.getHex()).toBe(0x261c17);
      expect(coals).toBeInstanceOf(THREE.InstancedMesh);
      expect(coals.count).toBe(3);
      expect(coals.material).toBe(forge.getObjectByName('forge-brazier-embers').material);
      expect(coals.userData.chroniclesDecorativeOnly).toBe(true);
      expect(coals.castShadow).toBe(false);
      const piers = bay.children.filter(child => child.name === 'forge-workshop-stone-pier');
      const leftEdge = bay.position.x + piers[0].position.x
        - piers[0].geometry.parameters.width / 2;
      expect(leftEdge).toBeGreaterThan(door.geometry.parameters.width / 2);
      const lintel = bay.getObjectByName('forge-workshop-stone-lintel');
      const lintelLeft = bay.position.x - lintel.geometry.parameters.width / 2;
      const plaqueRight = nameplate.position.x
        + nameplate.getObjectByName('shop-nameplate-wood').geometry.parameters.width / 2;
      expect(lintelLeft).toBeGreaterThan(plaqueRight);
      expect(bay.position.z).toBeGreaterThan(door.position.z);
      expect(bay.position.z).toBeLessThan(7.1 / 2 + 0.60);
      expect(bay.getObjectByName('forge-workshop-stone-pier').castShadow).toBe(!coarsePointer);
      for (const spec of SWORDHAVEN_BUILDINGS.filter(spec => spec.id !== 'swordhaven-forge')) {
        expect(scene.getObjectByName('swordhaven-building-' + spec.id)
          .getObjectByName('forge-stone-workshop-bay')).toBeFalsy();
      }
      expect(built.contentProps).toHaveLength(0);
      expect(createSwordhavenWalkGrid()[7][4]).toBe('.');
    }
  });

  it('gives only the canonical armorer a square stone gateway and roof crest', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const armorer = scene.getObjectByName('swordhaven-building-swordhaven-armor');
      const gateway = armorer.getObjectByName('armor-stone-gateway');
      const door = armorer.getObjectByName('shop-door');
      const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
      const temple = scene.getObjectByName('swordhaven-building-swordhaven-temple');
      const armorWall = armorer.getObjectByName('timber-and-stone-walls');
      expect(armorWall.material).toBe(temple.getObjectByName('timber-and-stone-walls').material);
      expect(armorWall.material).not.toBe(forge.getObjectByName('timber-and-stone-walls').material);
      expect(armorer.getObjectByName('roof-gable-1').material).toBe(armorWall.material);
      expect(armorer.getObjectByName('horizontal-facade-beam')).toBeFalsy();
      expect(armorer.getObjectByName('vertical-facade-post')).toBeFalsy();
      expect(armorer.getObjectByName('diagonal-timber-brace')).toBeFalsy();
      expect(forge.getObjectByName('diagonal-timber-brace')).toBeTruthy();
      expect(armorer.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
      expect(gateway?.userData.chroniclesDecorativeOnly).toBe(true);
      expect(armorer.getObjectByName('armor-roof-crest')).toBeTruthy();
      // The armorer must read as a fortified workshop, not a domestic shop.
      const parapet = armorer.getObjectByName('armor-ashlar-parapet');
      expect(parapet?.userData.chroniclesDecorativeOnly).toBe(true);
      expect(parapet.getObjectByName('armor-parapet-stone-course')).toBeTruthy();
      const merlons = parapet.getObjectByName('armor-parapet-merlons');
      expect(merlons).toBeInstanceOf(THREE.InstancedMesh);
      expect(merlons.count).toBe(6);
      expect(merlons.castShadow).toBe(!coarsePointer);
      expect(parapet.position.z).toBeGreaterThan(armorer.getObjectByName('roof-gable-1').position.z);
      expect(armorer.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
      expect(armorer.getObjectByName('pitched-roof-dormer-1')).toBeFalsy();
      expect(armorer.getObjectByName('stone-chimney')).toBeFalsy();
      expect(armorer.getObjectByName('shop-door')).toBe(door);
      expect(gateway.position.z).toBeGreaterThan(door.position.z);
      const piers = gateway.children.filter(child => child.name === 'armor-gateway-pier');
      expect(piers).toHaveLength(2);
      expect(piers[0].position.x).toBeLessThan(-1);
      expect(piers[1].position.x).toBeGreaterThan(1);
      expect(piers[0].position.x + piers[0].geometry.parameters.width / 2)
        .toBeLessThan(-door.geometry.parameters.width / 2);
      expect(piers[1].position.x - piers[1].geometry.parameters.width / 2)
        .toBeGreaterThan(door.geometry.parameters.width / 2);
      expect(gateway.getObjectByName('armor-gateway-lintel').position.y)
        .toBeGreaterThan(door.geometry.parameters.height);
      expect(gateway.children.filter(child => child.name === 'armor-gateway-rivet')).toHaveLength(2);
      const nameplate = armorer.getObjectByName('swordhaven-shop-nameplate');
      const nameplateBottom = nameplate.position.y
        - nameplate.getObjectByName('shop-nameplate-wood').geometry.parameters.height / 2;
      for (const name of ['armor-gateway-lintel', 'armor-gateway-keystone']) {
        const part = gateway.getObjectByName(name);
        expect(part.position.y + part.geometry.parameters.height / 2)
          .toBeLessThan(nameplateBottom);
      }
      for (const spec of SWORDHAVEN_BUILDINGS.filter(spec => spec.id !== 'swordhaven-armor')) {
        const other = scene.getObjectByName('swordhaven-building-' + spec.id);
        expect(other.getObjectByName('armor-stone-gateway')).toBeFalsy();
        expect(other.getObjectByName('armor-roof-crest')).toBeFalsy();
        expect(other.getObjectByName('armor-ashlar-parapet')).toBeFalsy();
      }
      expect(createSwordhavenWalkGrid()[7][14]).toBe('.');
    }
  });

  it('uses deterministic, fine-grained town textures without changing the pixelated meadow', () => {
    for (const kind of ['stucco', 'masonry', 'roof', 'timber', 'cobble']) {
      const texture = swordhavenSurfaceTexture(kind);
      expect(texture).toBe(swordhavenSurfaceTexture(kind)); // No regeneration at remount.
      expect(texture).toBeInstanceOf(THREE.DataTexture);
      expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT).toBe(THREE.RepeatWrapping);
      expect(texture.magFilter).toBe(THREE.LinearFilter);
      expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
      expect(texture.anisotropy).toBeLessThanOrEqual(4);
      expect(texture.userData.chroniclesTownSurface.kind).toBe(kind);
      const { width, height, data } = texture.image;
      expect(width).toBeGreaterThanOrEqual(128);
      expect(height).toBe(width);
      expect(data).toHaveLength(width * height * 4);
      const tones = new Set();
      for (let i = 0; i < data.length; i += 4) {
        tones.add(data[i]);
        expect(data[i + 3]).toBe(255);
      }
      expect(tones.size, kind).toBeGreaterThan(15);
    }
    expect(swordhavenSurfaceTexture('roof')).not.toBe(swordhavenSurfaceTexture('masonry'));
    expect(swordhavenGrassTexture().magFilter).toBe(THREE.NearestFilter);
    expect(() => swordhavenSurfaceTexture('unknown')).toThrow(/Unsupported/);
  });


  it('adds periodic, linear normal maps to stone, cobbles, roof and limewash', () => {
    for (const kind of ['masonry', 'cobble', 'roof', 'stucco']) {
      const albedo = swordhavenSurfaceTexture(kind);
      const normal = swordhavenSurfaceNormalTexture(kind);
      expect(normal).toBe(swordhavenSurfaceNormalTexture(kind));
      expect(chroniclesTownSurfacePixels(kind)).toBe(chroniclesTownSurfacePixels(kind));
      expect(normal).toBeInstanceOf(THREE.DataTexture);
      expect(normal.colorSpace).toBe(THREE.NoColorSpace);
      expect(normal.wrapS).toBe(THREE.RepeatWrapping);
      expect(normal.wrapT).toBe(THREE.RepeatWrapping);
      expect(normal.magFilter).toBe(THREE.LinearFilter);
      expect(normal.minFilter).toBe(THREE.LinearMipmapLinearFilter);
      expect(normal.repeat.toArray()).toEqual(albedo.repeat.toArray());
      expect(normal.image.width).toBe(albedo.image.width);
      expect(normal.image.data).toHaveLength(albedo.image.data.length);
      const slopes = new Set();
      for (let i = 0; i < normal.image.data.length; i += 4) {
        const [r, g, b, a] = normal.image.data.subarray(i, i + 4);
        slopes.add(`${r}:${g}`);
        expect(b).toBeGreaterThanOrEqual(128);
        expect(a).toBe(255);
      }
      expect(slopes.size).toBeGreaterThan(30);
    }
    expect(() => swordhavenSurfaceNormalTexture('timber')).toThrow(/Unsupported/);
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer: true });
    const temple = scene.getObjectByName('swordhaven-building-swordhaven-temple');
    expect(temple.getObjectByName('timber-and-stone-walls').material.normalMap)
      .toBe(swordhavenSurfaceNormalTexture('masonry'));
    const forgeWall = scene.getObjectByName('swordhaven-building-swordhaven-forge')
      .getObjectByName('timber-and-stone-walls').material;
    expect(forgeWall.normalMap).toBe(swordhavenSurfaceNormalTexture('stucco'));
    expect(forgeWall.normalScale.toArray()).toEqual([0.50, 0.50]);
    expect(forgeWall.map.repeat.toArray()).toEqual(forgeWall.normalMap.repeat.toArray());
    expect(scene.getObjectByName('swordhaven-street-cobblestones').material.normalMap)
      .toBe(swordhavenSurfaceNormalTexture('cobble'));
    for (const spec of SWORDHAVEN_BUILDINGS) {
      const roof = scene.getObjectByName('swordhaven-building-' + spec.id)
        .getObjectByName('pitched-roof-1');
      expect(roof.material.normalMap).toBe(swordhavenSurfaceNormalTexture('roof'));
      expect(roof.material.normalScale.x).toBeCloseTo(0.35);
      expect(roof.material.map.repeat.toArray()).toEqual(roof.material.normalMap.repeat.toArray());
    }
  }, 12000); // The shared atlas is first generated during this rendering test.

  it('batches detailed leadwork, foliage and door straps on each shop without new interactions', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      const built = buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      for (const spec of SWORDHAVEN_BUILDINGS) {
        const facade = scene.getObjectByName('swordhaven-building-' + spec.id);
        const lead = facade.getObjectByName('window-diamond-leadwork');
        const leaves = facade.getObjectByName('window-box-leaf-clusters');
        const flowers = facade.getObjectByName('window-box-blooms');
        const straps = facade.getObjectByName('shop-door-iron-straps');
        if (spec.id === 'swordhaven-armor') {
          expect(facade.getObjectByName('armor-forged-display-bays')).toBeTruthy();
          expect(lead).toBeFalsy();
          expect(leaves).toBeFalsy();
          expect(flowers).toBeFalsy();
          expect(straps.count).toBe(2);
          continue;
        }
        if (spec.id === 'swordhaven-temple') {
          // The temple now uses stone lancets, not merchant lead diamonds
          // or flower boxes; the real door straps are unchanged.
          expect(facade.getObjectByName('temple-stained-glass-lancets')).toBeTruthy();
          expect(lead).toBeFalsy();
          expect(leaves).toBeFalsy();
          expect(flowers).toBeFalsy();
          expect(straps.count).toBe(2);
          continue;
        }
        if (spec.id === 'swordhaven-magic') {
          expect(facade.getObjectByName('magic-guild-violet-glazing')).toBeTruthy();
          expect(lead).toBeFalsy();
          expect(leaves).toBeFalsy();
          expect(flowers).toBeFalsy();
          expect(straps.count).toBe(2);
          continue;
        }
        expect(lead).toBeInstanceOf(THREE.InstancedMesh);
        expect(lead.count).toBe(8);
        const centers = facade.getObjectByName('window-box-flower-centers');
        const stems = facade.getObjectByName('window-box-trailing-stems');
        expect(leaves).toBeInstanceOf(THREE.InstancedMesh);
        expect(flowers).toBeInstanceOf(THREE.InstancedMesh);
        expect(centers).toBeInstanceOf(THREE.InstancedMesh);
        expect(stems).toBeInstanceOf(THREE.InstancedMesh);
        expect(leaves.count).toBe(coarsePointer ? 36 : 68);
        expect(flowers.count).toBe(coarsePointer ? 10 : 16);
        expect(centers.count).toBe(flowers.count);
        expect(stems.count).toBe(coarsePointer ? 6 : 10);
        expect(leaves.geometry).toBeInstanceOf(THREE.BufferGeometry);
        expect(leaves.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
        expect(flowers.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
        expect(leaves.material.side).toBe(THREE.DoubleSide);
        expect(flowers.material.side).toBe(THREE.DoubleSide);
        expect(leaves.instanceColor).toBeTruthy();
        expect(flowers.instanceColor).toBeTruthy();
        for (const mesh of [leaves, flowers, centers, stems]) {
          expect(mesh.userData.chroniclesDecorativeOnly).toBe(true);
          expect(mesh.castShadow).toBe(false);
          expect(mesh.count).toBeLessThanOrEqual(68);
        }
        expect(straps.count).toBe(2);
        expect(facade.getObjectByName('window-box-leaves')).toBeFalsy();
      }
      expect(built.contentProps).toHaveLength(0);
    }
  });

  it('keeps each hanging planter above walkable ground and inside the shallow facade envelope', () => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer: false });
    for (const spec of SWORDHAVEN_BUILDINGS) {
      const building = scene.getObjectByName('swordhaven-building-' + spec.id);
      if (spec.id === 'swordhaven-armor') {
        expect(building.getObjectByName('armor-forged-display-bays')).toBeTruthy();
        expect(building.getObjectByName('window-box-flower-centers')).toBeFalsy();
        expect(building.getObjectByName('flower-window-box')).toBeFalsy();
        continue;
      }
      if (spec.id === 'swordhaven-temple') {
        expect(building.getObjectByName('temple-stained-glass-lancets')).toBeTruthy();
        expect(building.getObjectByName('window-box-flower-centers')).toBeFalsy();
        expect(building.getObjectByName('flower-window-box')).toBeFalsy();
        continue;
      }
      if (spec.id === 'swordhaven-magic') {
        expect(building.getObjectByName('magic-guild-violet-glazing')).toBeTruthy();
        expect(building.getObjectByName('window-box-flower-centers')).toBeFalsy();
        expect(building.getObjectByName('flower-window-box')).toBeFalsy();
        continue;
      }
      const center = building.getObjectByName('window-box-flower-centers');
      const leaves = building.getObjectByName('window-box-leaf-clusters');
      const stems = building.getObjectByName('window-box-trailing-stems');
      const facadeZ = (spec.emblem === 'mug' ? 8.2 : 7.1) / 2 + 0.10;
      const matrix = new THREE.Matrix4();
      const at = new THREE.Vector3();
      const colors = new Set();
      for (let i = 0; i < leaves.count; i += 1) {
        leaves.getMatrixAt(i, matrix);
        at.setFromMatrixPosition(matrix);
        expect(at.y).toBeGreaterThan(1.4);
        expect(at.z).toBeGreaterThan(facadeZ + 0.7);
        expect(at.z).toBeLessThan(facadeZ + 0.95);
        const color = new THREE.Color();
        leaves.getColorAt(i, color);
        colors.add(color.getHexString());
      }
      expect(colors.size).toBeGreaterThanOrEqual(4);
      for (const mesh of [center, stems]) {
        for (let i = 0; i < mesh.count; i += 1) {
          mesh.getMatrixAt(i, matrix);
          at.setFromMatrixPosition(matrix);
          expect(at.y).toBeGreaterThan(1.45);
          // The tiny raised flower stamen projects ~0.014 m beyond 0.95.
          // Allow its authored depth, still under one metre from the facade.
          expect(at.z).toBeLessThan(facadeZ + 0.99);
        }
      }
      expect(building.getObjectByName('flower-window-box')).toBeTruthy();
    }
  });

  it('adds instanced road shoulders and grass tufts without introducing collision geometry', () => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, {
      scenePlan: { width: 19, height: 19, center: { x: 9, y: 9 }, content: [] },
      coarsePointer: true,
    });
    const shoulders = scene.getObjectByName('swordhaven-roadside-stone-edging');
    const meadow = scene.getObjectByName('swordhaven-low-meadow-tufts');
    expect(shoulders).toBeInstanceOf(THREE.InstancedMesh);
    expect(shoulders.count).toBeGreaterThan(60);
    expect(meadow).toBeInstanceOf(THREE.InstancedMesh);
    expect(meadow.count).toBeGreaterThan(40);
    expect(meadow.count).toBeLessThanOrEqual(560);
    // Avoid the old traffic-cone triangles and chunky raised kerbstones.
    expect(shoulders.geometry.parameters.height).toBeLessThan(0.09);
    const blades = meadow.geometry.getAttribute('position');
    expect(blades.count).toBe(18); // Six slim blades per tuft.
    let top = 0;
    for (let vertex = 0; vertex < blades.count; vertex += 1) {
      top = Math.max(top, blades.getY(vertex));
    }
    expect(top).toBeGreaterThan(0.10);
    expect(top).toBeLessThan(0.17);
    const matrix = new THREE.Matrix4();
    const point = new THREE.Vector3();
    for (let i = 0; i < meadow.count; i += 1) {
      meadow.getMatrixAt(i, matrix);
      point.setFromMatrixPosition(matrix);
      expect(Math.abs(point.x)).toBeGreaterThanOrEqual(5);
      expect(Math.abs(point.z)).toBeGreaterThanOrEqual(5);
      expect(SWORDHAVEN_BUILDINGS.some(spec => (
        Math.abs(point.x - (spec.x - 9) * 4) < 5.2
        && Math.abs(point.z - (spec.y - 9) * 4) < 5.2
      ))).toBe(false);
    }
    expect(createSwordhavenWalkGrid()[9][9]).toBe('#');
    expect(createSwordhavenWalkGrid()[SWORDHAVEN_SPAWN.y][SWORDHAVEN_SPAWN.x]).toBe('.');
  });

  it('renders storefronts without exposing fake shop interactions before they are authored', () => {
    const scene = new THREE.Scene();
    const state = buildSwordhavenScene(scene, { scenePlan: { content: [] } });
    expect(state.contentProps).toHaveLength(0);
    expect(scene.getObjectByName('swordhaven-building-swordhaven-forge')).toBeTruthy();
  });
});
