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
    // Expose the cold ashlar rather than dressing the barracks as a merchant
    // half-timber house. A stone entry frames, but never covers, its real door.
    for (const beam of ['horizontal-facade-beam', 'vertical-facade-post', 'diagonal-timber-brace']) {
      expect(watch.getObjectByName(beam)).toBeFalsy();
      expect(forge.getObjectByName(beam)).toBeTruthy();
    }
    const entry = watch.getObjectByName('watchhouse-ashlar-entry');
    expect(entry?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(entry.children.filter(child => child.name === 'watchhouse-entry-stone-jamb')).toHaveLength(2);
    expect(entry.children.filter(child => child.name === 'watchhouse-entry-stone-footing')).toHaveLength(2);
    expect(entry.getObjectByName('watchhouse-entry-stone-lintel')).toBeTruthy();
    expect(entry.getObjectByName('watchhouse-entry-iron-band')).toBeTruthy();
    expect(forge.getObjectByName('watchhouse-ashlar-entry')).toBeFalsy();
    expect(entry.getObjectByName('watchhouse-entry-stone-lintel').position.y)
      .toBeGreaterThan(watch.getObjectByName('shop-door').geometry.parameters.height);

    // The guard now has a visible crossed-halberd crest, not the merchant's
    // shield or an apparently empty inset. Both use the same existing signs.
    const watchSign = watch.children.find(child =>
      child.name.startsWith('swordhaven-interaction-'));
    expect(watchSign).toBeTruthy();
    expect(watchSign.children.filter(child => child.name === 'watch-crossed-halberd'))
      .toHaveLength(2);
    expect(watchSign.children.filter(child => child.name === 'watch-halberd-tip'))
      .toHaveLength(2);
    expect(watch.getObjectByName('shield-emblem')).toBeFalsy();
    const inset = watchSign.getObjectByName('sign-inset');
    expect(watchSign.getObjectByName('watch-crossed-halberd').position.z)
      .toBeGreaterThan(inset.position.z + inset.geometry.parameters.depth / 2);
    const armorer = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-armor-'));
    const armorShield = armorer?.getObjectByName('shield-emblem');
    const armorInset = armorer?.getObjectByName('sign-inset');
    expect(armorShield).toBeTruthy();
    expect(armorShield.position.z)
      .toBeGreaterThan(armorInset.position.z + armorInset.geometry.parameters.depth / 2);
    expect(armorer.getObjectByName('watch-crossed-halberd')).toBeFalsy();
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
