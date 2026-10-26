import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven tavern architectural identity', () => {
  it('has a decorative twin-flue hearth without changing the street collision grid', () => {
    const scene = new THREE.Scene();
    const content = [...swordhaven.interactables, ...swordhaven.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
    buildChroniclesCampaignExterior(scene, {
      coarsePointer: true,
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
    expect(tavern).toBeTruthy();
    const hearth = tavern.getObjectByName('tavern-double-hearth');
    expect(hearth).toBeInstanceOf(THREE.Group);
    expect(hearth.userData.chroniclesDecorativeOnly).toBe(true);
    expect(hearth.getObjectByName('tavern-hearth-brick-breast')).toBeTruthy();
    const flues = hearth.children.filter(child => child.name.startsWith('tavern-hearth-flue-'));
    expect(flues).toHaveLength(2);
    expect(flues[0].geometry.parameters.height).toBeGreaterThan(flues[1].geometry.parameters.height);
    expect(tavern.getObjectByName('tavern-porch-awning')).toBeTruthy();
    expect(tavern.getObjectByName('stone-chimney')).toBeUndefined();
    expect(forge.getObjectByName('tavern-double-hearth')).toBeUndefined();
    expect(forge.getObjectByName('forge-roof-smokestack')).toBeTruthy();
    // All new masonry is above the street, on an existing solid building.
    hearth.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(hearth);
    expect(bounds.min.y).toBeGreaterThan(5);
    expect(bounds.max.y).toBeGreaterThan(10);
    expect(swordhaven.grid[10][7]).toBe('.');
    expect(swordhaven.grid[12][7]).toBe('#');
  });
});
