import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
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

  it('adds dressed stone corners, dormers and side windows to the five houses', () => {
    for (const coarsePointer of [true, false]) {
      const scene = new THREE.Scene();
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
      const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
      expect(forge.getObjectByName('corner-dressed-stone-courses')).toBeInstanceOf(THREE.InstancedMesh);
      expect(forge.getObjectByName('corner-dressed-stone-courses').count).toBeGreaterThan(20);
      expect(forge.getObjectByName('side-window-amber-glass')).toBeTruthy();
      expect(forge.getObjectByName('swordhaven-facade-dressed-stones'))
        .toBeInstanceOf(THREE.InstancedMesh);
      expect(forge.getObjectByName('pitched-roof-dormer--1')).toBeTruthy();
      expect(Boolean(forge.getObjectByName('pitched-roof-dormer-1'))).toBe(!coarsePointer);
      const tower = scene.getObjectByName('swordhaven-building-swordhaven-temple')
        .getObjectByName('temple-bell-tower');
      expect(tower.geometry.parameters.radialSegments).toBeGreaterThanOrEqual(12);
      const magic = scene.getObjectByName('swordhaven-building-swordhaven-magic');
      expect(magic.getObjectByName('magic-shop-turret').geometry.parameters.radialSegments).toBeGreaterThanOrEqual(12);
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


  it('adds periodic, linear normal maps only to town stone and cobbles', () => {
    for (const kind of ['masonry', 'cobble']) {
      const albedo = swordhavenSurfaceTexture(kind);
      const normal = swordhavenSurfaceNormalTexture(kind);
      expect(normal).toBe(swordhavenSurfaceNormalTexture(kind));
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
    expect(() => swordhavenSurfaceNormalTexture('roof')).toThrow(/Unsupported/);
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer: true });
    const temple = scene.getObjectByName('swordhaven-building-swordhaven-temple');
    expect(temple.getObjectByName('timber-and-stone-walls').material.normalMap)
      .toBe(swordhavenSurfaceNormalTexture('masonry'));
    expect(scene.getObjectByName('swordhaven-street-cobblestones').material.normalMap)
      .toBe(swordhavenSurfaceNormalTexture('cobble'));
  });

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
