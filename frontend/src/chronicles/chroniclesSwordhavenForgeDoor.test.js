import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven forge ironbound oak entry', () => {
  it.each([true, false])('keeps the forge entrance visual-only on coarsePointer=%s', (coarsePointer) => {
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
    const store = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-store-'));
    const guild = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-guild-'));
    const entry = forge.getObjectByName('forge-ironbound-oak-entry');
    expect(entry?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(forge.getObjectByName('shop-door')).toBeTruthy();
    expect(store.getObjectByName('forge-ironbound-oak-entry')).toBeFalsy();
    expect(guild.getObjectByName('forge-ironbound-oak-entry')).toBeFalsy();
    expect(store.getObjectByName('store-cedar-loading-doors')).toBeTruthy();
    const oak = entry.getObjectByName('forge-door-charred-oak-leaf');
    expect(oak.material.map.name).toBe('chronicles-town-timber');
    expect(oak.castShadow).toBe(!coarsePointer);
    expect(oak.position.z).toBeLessThan(4.5);
    expect(oak.position.x).toBe(0);
    expect(entry.getObjectByName('forge-door-oak-board-seams').count).toBe(5);
    expect(entry.getObjectByName('forge-door-iron-straps').count).toBe(3);
    expect(entry.getObjectByName('forge-door-iron-rivets').count).toBe(12);
    expect(entry.getObjectByName('forge-door-iron-ring')).toBeTruthy();
    for (const part of entry.children) {
      expect(part.userData.chroniclesDecorativeOnly).toBe(true);
      expect(part.position.z).toBeLessThan(4.5);
    }
    // The authored town grid, real shop entrance and adjacent walkable street
    // are not modified by this decorative overlay.
    expect(swordhaven.grid[8][7]).toBe('.');
  });
});
