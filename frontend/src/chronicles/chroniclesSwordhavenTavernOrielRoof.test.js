import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven tavern guest oriel roof', () => {
  it.each([false, true])('has two raised roof pitches on coarsePointer=%s', (coarsePointer) => {
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
    const store = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-store-'));
    expect(tavern).toBeTruthy();
    expect(store).toBeTruthy();
    const oriel = tavern.getObjectByName('tavern-east-guest-oriel');
    expect(oriel?.userData.chroniclesDecorativeOnly).toBe(true);
    const slopes = oriel.children.filter(child =>
      child.name === 'tavern-oriel-pitched-roof-slope');
    expect(slopes).toHaveLength(2);
    expect(slopes[0].position.z).toBeCloseTo(-slopes[1].position.z);
    expect(slopes[0].rotation.x).toBeCloseTo(-slopes[1].rotation.x);
    expect(Math.abs(slopes[0].rotation.x)).toBeGreaterThan(0.25);
    const ridge = oriel.getObjectByName('tavern-oriel-roof-ridge');
    expect(ridge).toBeTruthy();
    expect(ridge.position.y).toBeGreaterThan(slopes[0].position.y);
    expect(oriel.getObjectByName('tavern-oriel-sloped-roof')).toBeFalsy();
    expect(oriel.children.filter(child => child.name === 'tavern-oriel-guest-window'))
      .toHaveLength(2);
    tavern.updateWorldMatrix(true, true);
    const roofBounds = new THREE.Box3().setFromObject(ridge);
    expect(roofBounds.min.y).toBeGreaterThan(4.5);
    expect(tavern.getObjectByName('shop-door')).toBeTruthy();
    expect(store.getObjectByName('tavern-east-guest-oriel')).toBeFalsy();
    // Pure facade geometry: neither authored town grid nor interactions change.
    expect(swordhaven.grid[4][5]).toBe('.');
  });
});
