import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import {
  swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture,
} from './chroniclesSwordhaven3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven general store frontage', () => {
  it.each([true, false])('keeps oak market bays decorative on coarsePointer=%s', (coarsePointer) => {
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
    expect(store).toBeTruthy();
    expect(forge).toBeTruthy();
    const tavern = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-tavern-'));
    // The warehouse stocks provisions, not the inn's decorative flowers.
    // All sacks remain on the original raised facade displays on touch/desktop.
    const sacks = store.getObjectByName('store-window-burlap-sacks');
    const ties = store.getObjectByName('store-window-sack-ties');
    expect(sacks?.count).toBe(8);
    expect(ties?.count).toBe(8);
    expect(sacks.userData.chroniclesDecorativeOnly).toBe(true);
    expect(ties.userData.chroniclesDecorativeOnly).toBe(true);
    expect(store.children.filter(child => child.name === 'store-stock-display-trough'))
      .toHaveLength(2);
    expect(store.getObjectByName('flower-window-box')).toBeFalsy();
    expect(store.getObjectByName('window-box-blooms')).toBeFalsy();
    expect(tavern.getObjectByName('window-box-blooms')).toBeTruthy();
    expect(forge.getObjectByName('store-window-burlap-sacks')).toBeFalsy();
    expect(store.getObjectByName('shop-door')).toBeTruthy();
    const walls = store.getObjectByName('timber-and-stone-walls');
    expect(walls.material.color.getHex()).toBe(0xd9b98a);
    expect(walls.material.map).toBe(swordhavenSurfaceTexture('stucco'));
    expect(walls.material.normalMap).toBe(swordhavenSurfaceNormalTexture('stucco'));
    expect(store.getObjectByName('roof-gable-1').material).toBe(walls.material);
    expect(store.getObjectByName('roof-gable--1').material).toBe(walls.material);
    expect(forge.getObjectByName('timber-and-stone-walls').material.color.getHex())
      .not.toBe(walls.material.color.getHex());
    const frontage = store.getObjectByName('store-oak-frontage');
    expect(frontage?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(frontage.children.filter(child => child.name === 'store-oak-panel')).toHaveLength(2);
    expect(frontage.children.filter(child => child.name === 'store-oak-batten')).toHaveLength(6);
    expect(frontage.children.filter(child => child.name === 'store-oak-rail')).toHaveLength(2);
    expect(forge.getObjectByName('store-oak-frontage')).toBeFalsy();
    const loft = store.getObjectByName('store-merchant-loft');
    expect(loft?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(loft.getObjectByName('store-loft-oak-gable')).toBeTruthy();
    expect(loft.getObjectByName('store-loft-window')).toBeTruthy();
    // The loft window must project in front of the main gable to be visible
    // from the street-facing camera, not merely exist in the scene graph.
    expect(loft.position.z + 0.77).toBeGreaterThan(store.getObjectByName('roof-gable-1').position.z);
    expect(loft.children.filter(child => child.name === 'store-loft-roof-slope')).toHaveLength(2);
    const balcony = loft.getObjectByName('store-loft-loading-balcony');
    expect(balcony?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(balcony.children.filter(child => child.name === 'store-balcony-loading-deck'))
      .toHaveLength(1);
    expect(balcony.children.filter(child => child.name === 'store-balcony-side-rail'))
      .toHaveLength(2);
    expect(balcony.children.filter(child => child.name === 'store-balcony-front-rail'))
      .toHaveLength(2);
    expect(balcony.children.filter(child => child.name === 'store-balcony-diagonal-brace'))
      .toHaveLength(2);
    // The cargo deck projects beyond the attic window and stays high above
    // the street; it must never introduce a ground-level obstruction.
    const deck = balcony.getObjectByName('store-balcony-loading-deck');
    expect(deck.position.z).toBeGreaterThan(loft.getObjectByName('store-loft-window').position.z);
    expect(loft.position.y + deck.position.y - 0.09).toBeGreaterThan(4.5);
    expect(forge.getObjectByName('store-loft-loading-balcony')).toBeFalsy();
    expect(store.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
    expect(store.getObjectByName('pitched-roof-dormer-1')).toBeFalsy();
    expect(forge.getObjectByName('store-merchant-loft')).toBeFalsy();
    expect(forge.getObjectByName('forge-roof-smoke-lantern')).toBeTruthy();
    expect(forge.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
    expect(store.getObjectByName('store-market-awning')).toBeTruthy();
    expect(store.getObjectByName('shop-door')).toBeTruthy();
    expect(store.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    // No authored map tiles or interaction contracts are changed.
    expect(swordhaven.grid[4][5]).toBe('.');
  });
});
