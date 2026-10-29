import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven watchhouse military frontage', () => {
  it.each([false, true])('uses iron-barred windows instead of merchant flowers on coarsePointer=%s', (coarsePointer) => {
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
    const watch = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-watch-'));
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    expect(watch).toBeTruthy();
    expect(watch.getObjectByName('watchhouse-battlement-tower')).toBeTruthy();
    const bars = watch.getObjectByName('watchhouse-front-iron-bars');
    expect(bars).toBeInstanceOf(THREE.InstancedMesh);
    expect(bars.count).toBe(6);
    expect(bars.userData.chroniclesDecorativeOnly).toBe(true);
    expect(bars.castShadow).toBe(!coarsePointer);
    expect(watch.children.filter(child => child.name === 'watchhouse-front-dark-recess')).toHaveLength(2);
    expect(watch.children.filter(child => child.name === 'watchhouse-front-stone-jamb')).toHaveLength(4);
    expect(watch.children.filter(child => child.name === 'watchhouse-front-stone-rail')).toHaveLength(6);
    expect(watch.getObjectByName('warm-glass-window')).toBeFalsy();
    expect(watch.getObjectByName('flower-window-box')).toBeFalsy();
    expect(watch.getObjectByName('armor-display')).toBeFalsy();
    expect(watch.getObjectByName('window-diamond-leadwork')).toBeFalsy();
    expect(watch.getObjectByName('shop-door')).toBeTruthy();
    expect(watch.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    expect(forge.getObjectByName('warm-glass-window')).toBeTruthy();
    expect(forge.getObjectByName('forge-window-hammer-heads')?.count).toBe(4);
    expect(forge.getObjectByName('flower-window-box')).toBeFalsy();
    expect(forge.getObjectByName('watchhouse-front-iron-bars')).toBeFalsy();
    // All ironwork remains inside the existing facade, never a new blocker.
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < bars.count; index += 1) {
      bars.getMatrixAt(index, matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(Math.abs(position.x)).toBeLessThan(3.5);
      expect(position.z).toBeLessThan(4);
      expect(position.y).toBeCloseTo(2.75);
    }
    expect(swordhaven.grid[6][4]).toBe('.');
  });
});
