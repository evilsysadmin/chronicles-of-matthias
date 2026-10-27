import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import {
  swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture,
} from './chroniclesSwordhaven3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven tavern brick frontage', () => {
  it.each([true, false])('uses warm masonry, not merchant plaster, with coarsePointer=%s', (coarsePointer) => {
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
    expect(tavern).toBeTruthy();
    expect(forge).toBeTruthy();
    const walls = tavern.getObjectByName('timber-and-stone-walls');
    expect(walls.material.color.getHex()).toBe(0xb98b70);
    expect(walls.material.map).toBe(swordhavenSurfaceTexture('masonry'));
    expect(walls.material.normalMap).toBe(swordhavenSurfaceNormalTexture('masonry'));
    expect(tavern.getObjectByName('roof-gable-1').material).toBe(walls.material);
    expect(tavern.getObjectByName('roof-gable--1').material).toBe(walls.material);
    expect(forge.getObjectByName('timber-and-stone-walls').material.map)
      .toBe(swordhavenSurfaceTexture('stucco'));
    // The brick inn keeps its timber framing and original entrance.
    expect(tavern.getObjectByName('vertical-facade-post')).toBeTruthy();
    expect(tavern.getObjectByName('diagonal-timber-brace')).toBeTruthy();
    expect(tavern.getObjectByName('shop-door')).toBeTruthy();
    expect(tavern.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    expect(tavern.getObjectByName('tavern-porch-awning')).toBeTruthy();
    expect(swordhaven.grid[10][7]).toBe('.');
    expect(swordhaven.grid[12][7]).toBe('#');
  });
});
