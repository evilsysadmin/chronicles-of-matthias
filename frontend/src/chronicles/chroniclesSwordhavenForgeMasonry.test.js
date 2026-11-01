import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import {
  swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture,
} from './chroniclesSwordhaven3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven forge masonry', () => {
  it.each([false, true])('uses soot-darkened stone without changing access on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    const content = [...swordhaven.interactables, ...swordhaven.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
    buildChroniclesCampaignExterior(scene, {
      coarsePointer,
      scenePlan: {
        mapId: swordhaven.id, regionKind: swordhaven.regionKind,
        width: swordhaven.grid[0].length, height: swordhaven.grid.length,
        center: { x: 9, y: 11 }, grid: swordhaven.grid,
        content, landscape: swordhaven.landscape,
      },
    });
    const town = scene.getObjectByName('chronicles-campaign-town');
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    const tavern = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-tavern-'));
    expect(forge).toBeTruthy();
    expect(tavern).toBeTruthy();
    const walls = forge.getObjectByName('timber-and-stone-walls');
    expect(walls.material.color.getHex()).toBe(0x958171);
    expect(walls.material.map).toBe(swordhavenSurfaceTexture('masonry'));
    expect(walls.material.normalMap).toBe(swordhavenSurfaceNormalTexture('masonry'));
    expect(walls.material.roughness).toBeCloseTo(0.98);
    expect(forge.getObjectByName('roof-gable-1').material).toBe(walls.material);
    expect(forge.getObjectByName('roof-gable--1').material).toBe(walls.material);
    expect(tavern.getObjectByName('timber-and-stone-walls').material.color.getHex())
      .not.toBe(walls.material.color.getHex());
    // The entire smithy base and exposed corner courses are smoke-darkened,
    // while neighbouring merchant buildings retain pale ashlar. Geometry,
    // authored access and collision cells must remain unchanged.
    expect(forge.getObjectByName('stone-foundations').material).toBe(walls.material);
    expect(tavern.getObjectByName('stone-foundations').material).not.toBe(walls.material);
    const forgeCourses = forge.getObjectByName('corner-dressed-stone-courses');
    const tavernCourses = tavern.getObjectByName('corner-dressed-stone-courses');
    expect(forgeCourses).toBeInstanceOf(THREE.InstancedMesh);
    expect(forgeCourses.count).toBeGreaterThan(0);
    const tint = new THREE.Color();
    for (const [level, expected] of [0x776a60, 0x64584f, 0x8a7868].entries()) {
      forgeCourses.getColorAt(level * 4, tint);
      expect(tint.getHex()).toBe(expected);
    }
    tavernCourses.getColorAt(0, tint);
    expect(tint.getHex()).toBe(0xb5ab9a);
    expect(forge.getObjectByName('shop-door')).toBeTruthy();
    expect(forge.getObjectByName('forge-roof-smokestack')).toBeTruthy();
    expect(swordhaven.grid[4][5]).toBe('.');
  });

  it.each([false, true])('shows iron smithing tools rather than domestic flowers on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    const content = [...swordhaven.interactables, ...swordhaven.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
    buildChroniclesCampaignExterior(scene, {
      coarsePointer,
      scenePlan: {
        mapId: swordhaven.id, regionKind: swordhaven.regionKind,
        width: swordhaven.grid[0].length, height: swordhaven.grid.length,
        center: { x: 9, y: 11 }, grid: swordhaven.grid,
        content, landscape: swordhaven.landscape,
      },
    });
    const town = scene.getObjectByName('chronicles-campaign-town');
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    const tavern = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-tavern-'));
    const display = forge.getObjectByName('forge-window-tool-displays');
    expect(display?.userData.chroniclesDecorativeOnly).toBe(true);
    for (const name of ['forge-window-hammer-handles', 'forge-window-hammer-heads']) {
      const batch = display.getObjectByName(name);
      expect(batch).toBeInstanceOf(THREE.InstancedMesh);
      expect(batch.count).toBe(4);
      expect(batch.userData.chroniclesDecorativeOnly).toBe(true);
      expect(batch.castShadow).toBe(false);
      const matrix = new THREE.Matrix4();
      const point = new THREE.Vector3();
      for (let i = 0; i < batch.count; i += 1) {
        batch.getMatrixAt(i, matrix);
        point.setFromMatrixPosition(matrix);
        expect(point.y).toBeGreaterThan(2);
        expect(point.z).toBeGreaterThan(3);
      }
    }
    expect(forge.children.filter(child => child.name === 'forge-window-tool-trough'))
      .toHaveLength(2);
    expect(forge.getObjectByName('window-box-blooms')).toBeFalsy();
    expect(forge.getObjectByName('flower-window-box')).toBeFalsy();
    expect(tavern.getObjectByName('window-box-blooms')).toBeTruthy();
    expect(forge.getObjectByName('shop-door')).toBeTruthy();
    expect(swordhaven.grid[4][5]).toBe('.');
  });
});
