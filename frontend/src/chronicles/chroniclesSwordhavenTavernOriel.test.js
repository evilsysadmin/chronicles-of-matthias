import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven tavern east guest oriel', () => {
  it.each([true, false])('keeps its projecting upper-floor bay decorative on coarsePointer=%s', (coarsePointer) => {
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
    const tavern = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-tavern-'));
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    const oriel = tavern?.getObjectByName('tavern-east-guest-oriel');
    expect(oriel?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(oriel.children.filter(child => child.name === 'tavern-oriel-guest-window'))
      .toHaveLength(2);
    expect(oriel.children.filter(child => child.name === 'tavern-oriel-corner-post'))
      .toHaveLength(2);
    expect(oriel.children.filter(child => child.name === 'tavern-oriel-diagonal-support'))
      .toHaveLength(2);
    const roof = oriel.getObjectByName('tavern-oriel-sloped-roof');
    expect(roof.rotation.z).not.toBe(0);
    expect(roof.castShadow).toBe(!coarsePointer);
    // The upper bay projects from the east wall, but remains inside the
    // pre-existing three-cell-wide solid footprint, above ground-level windows.
    const bounds = new THREE.Box3().setFromObject(oriel);
    const localBounds = bounds.clone().applyMatrix4(tavern.matrixWorld.clone().invert());
    expect(localBounds.max.x).toBeGreaterThan(4.05);
    expect(localBounds.max.x).toBeLessThan(6);
    expect(localBounds.min.y).toBeGreaterThan(3);
    expect(tavern.getObjectByName('side-window-amber-glass')).toBeTruthy();
    expect(tavern.getObjectByName('shop-door')).toBeTruthy();
    expect(tavern.getObjectByName('tavern-double-hearth')).toBeTruthy();
    expect(forge?.getObjectByName('tavern-east-guest-oriel')).toBeFalsy();
    expect(swordhaven.grid[10][7]).toBe('.');
    expect(swordhaven.grid[12][7]).toBe('#');
  });
});
