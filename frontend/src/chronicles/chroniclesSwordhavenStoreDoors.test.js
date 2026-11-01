import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven Provisiones cedar loading doors', () => {
  it.each([true, false])('keeps the warehouse entry decorative on coarsePointer=%s', (coarsePointer) => {
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
    const store = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-store-'));
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    const doors = store.getObjectByName('store-cedar-loading-doors');
    expect(doors?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(forge.getObjectByName('store-cedar-loading-doors')).toBeFalsy();
    expect(store.getObjectByName('shop-door')).toBeTruthy();
    expect(doors.children.filter(child => child.name === 'store-door-cedar-leaf')).toHaveLength(2);
    const seams = doors.getObjectByName('store-door-cedar-plank-seams');
    const braces = doors.getObjectByName('store-door-cross-braces');
    const pulls = doors.getObjectByName('store-door-iron-ring-pulls');
    expect(seams.count).toBe(6);
    expect(braces.count).toBe(2);
    expect(pulls.count).toBe(2);
    expect(doors.getObjectByName('store-door-oak-loading-lintel')).toBeTruthy();
    // The hoist must serve an open, framed warehouse hatch rather than a
    // generic flat window, on both coarse/mobile and desktop render paths.
    const hatch = store.getObjectByName('store-loft-loading-hatch');
    expect(hatch?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(forge.getObjectByName('store-loft-loading-hatch')).toBeFalsy();
    expect(hatch.getObjectByName('store-loft-hatch-dark-recess')).toBeTruthy();
    expect(hatch.getObjectByName('store-loft-hatch-warm-interior')).toBeTruthy();
    expect(hatch.getObjectByName('store-loft-hatch-oak-lintel')).toBeTruthy();
    expect(hatch.getObjectByName('store-loft-hatch-oak-sill')).toBeTruthy();
    const shutters = hatch.children.filter(part =>
      part.name === 'store-loft-hatch-open-oak-shutter');
    expect(shutters).toHaveLength(2);
    expect(shutters.map(part => Math.sign(part.rotation.y))).toEqual([-1, 1]);
    expect(shutters.every(part =>
      part.getObjectByName('store-loft-hatch-iron-shutter-strap')?.userData.chroniclesDecorativeOnly === true)).toBe(true);
    expect(hatch.children.every(part =>
      part.userData.chroniclesDecorativeOnly === true)).toBe(true);
    for (const shutter of shutters) {
      expect(shutter.castShadow).toBe(!coarsePointer);
      expect(shutter.position.y).toBeGreaterThan(-0.5);
    }
    for (const part of doors.children) {
      expect(part.userData.chroniclesDecorativeOnly).toBe(true);
      expect(part.position.z).toBeLessThan(4.5);
      expect(part.position.y).toBeLessThan(3.5);
      if (part.name === 'store-door-cedar-leaf') {
        expect(part.castShadow).toBe(!coarsePointer);
        expect(Math.abs(part.position.x)).toBeLessThan(0.85);
      }
    }
    // Existing authored street and loading dock remain untouched.
    expect(swordhaven.grid[4][5]).toBe('.');
    expect(store.getObjectByName('store-side-loading-dock')).toBeTruthy();
  });
});
