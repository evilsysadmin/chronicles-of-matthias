import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

// Pure scene geometry: the dock must be present in both pointer modes and
// must never expand the authored solid footprint into a walkable street tile.
describe('Swordhaven provisions side loading dock', () => {
  it.each([true, false])('has a pitched cedar roof and clear entry on coarsePointer=%s', (coarsePointer) => {
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
    const store = town.children.find(child => child.name.startsWith('swordhaven-building-first-book-store-'));
    const forge = town.children.find(child => child.name.startsWith('swordhaven-building-first-book-forge-'));
    const dock = store.getObjectByName('store-side-loading-dock');
    expect(dock).toBeTruthy();
    expect(dock.userData.chroniclesDecorativeOnly).toBe(true);
    expect(forge.getObjectByName('store-side-loading-dock')).toBeFalsy();
    const deck = dock.getObjectByName('store-loading-dock-oak-deck');
    const roof = dock.getObjectByName('store-loading-dock-cedar-roof');
    expect(deck.userData.chroniclesDecorativeOnly).toBe(true);
    expect(roof.userData.chroniclesDecorativeOnly).toBe(true);
    expect(roof.rotation.z).toBeLessThan(-0.2);
    expect(roof.geometry.parameters.depth).toBeGreaterThan(5);
    // Cedar joinery follows the pitched side canopy, rather than floating
    // horizontally above it. Both batches are store-only and decorative.
    const roofBattens = dock.getObjectByName('store-loading-dock-cedar-roofBattens');
    const fascia = dock.getObjectByName('store-loading-dock-cedar-fascia');
    expect(roofBattens).toBeInstanceOf(THREE.InstancedMesh);
    expect(fascia).toBeInstanceOf(THREE.InstancedMesh);
    expect(roofBattens.count).toBe(6);
    expect(fascia.count).toBe(2);
    expect(roofBattens.material).toBe(deck.material);
    expect(fascia.material).toBe(deck.material);
    expect(roofBattens.geometry.parameters.depth).toBeCloseTo(roof.geometry.parameters.depth - 0.12);
    expect(roofBattens.userData.chroniclesDecorativeOnly).toBe(true);
    expect(fascia.userData.chroniclesDecorativeOnly).toBe(true);
    expect(forge.getObjectByName('store-loading-dock-cedar-roofBattens')).toBeFalsy();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (let index = 0; index < roofBattens.count; index += 1) {
      roofBattens.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      const x = (index - 2.5) * 0.30;
      expect(position.y).toBeCloseTo(
        x * Math.sin(roof.rotation.z) + 0.12 * Math.cos(roof.rotation.z), 4);
    }
    expect(dock.children.filter(child => child.name === 'store-loading-dock-oak-post')).toHaveLength(2);
    expect(dock.children.filter(child => child.name === 'store-loading-dock-knee-brace')).toHaveLength(2);
    for (const part of dock.children) {
      expect(part.userData.chroniclesDecorativeOnly).toBe(true);
      const x = part.position.x;
      const halfWidth = part.geometry.parameters.width / 2;
      expect(x + halfWidth).toBeLessThan(6);
      expect(x - halfWidth).toBeGreaterThan(4);
      expect(Math.abs(part.position.z) + part.geometry.parameters.depth / 2).toBeLessThan(3.5);
    }
    // Full-height cedar cladding is a store-only, decorative upper storey,
    // not another ground-level blocker or a copy of the tavern facade.
    const cladding = store.getObjectByName('store-upper-cedar-cladding');
    expect(cladding?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(forge.getObjectByName('store-upper-cedar-cladding')).toBeFalsy();
    const panels = cladding.getObjectByName('store-upper-cedar-wall-panels');
    const battens = cladding.getObjectByName('store-upper-cedar-vertical-battens');
    const rails = cladding.getObjectByName('store-upper-cedar-cornice-rails');
    expect(panels.count).toBe(2);
    expect(battens.count).toBe(14);
    expect(rails.count).toBe(4);
    expect(panels.material.color.getHex()).toBe(0x785a40);
    expect(panels.material.map?.name).toBe('chronicles-town-timber');
    for (const batch of [panels, battens, rails]) {
      expect(batch.userData.chroniclesDecorativeOnly).toBe(true);
      expect(batch.count).toBeGreaterThan(0);
      const transform = new THREE.Matrix4();
      for (let index = 0; index < batch.count; index += 1) {
        batch.getMatrixAt(index, transform);
        const pos = new THREE.Vector3().setFromMatrixPosition(transform);
        expect(pos.y).toBeGreaterThan(3.8);
        expect(Math.abs(pos.x)).toBeLessThan(6);
        expect(Math.abs(pos.z)).toBeLessThan(3.1);
      }
    }
    expect(store.getObjectByName('shop-door')).toBeTruthy();
    expect(store.getObjectByName('store-side-loading-hatch-battens')).toBeTruthy();
    expect(swordhaven.grid[4][5]).toBe('.');
  });
});
