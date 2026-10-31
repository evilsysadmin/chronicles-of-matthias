import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import {
  swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture,
} from './chroniclesSwordhaven3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven apothecary sage masonry', () => {
  it.each([true, false])('keeps its distinct stone frontage and access with coarsePointer=%s', (coarsePointer) => {
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
    const botica = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-apothecary-'));
    const store = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-store-'));
    expect(botica).toBeTruthy();
    expect(store).toBeTruthy();
    const walls = botica.getObjectByName('timber-and-stone-walls');
    expect(walls.material.color.getHex()).toBe(0xa8b9a0);
    expect(walls.material.map).toBe(swordhavenSurfaceTexture('masonry'));
    expect(walls.material.normalMap).toBe(swordhavenSurfaceNormalTexture('masonry'));
    expect(botica.getObjectByName('roof-gable-1').material).toBe(walls.material);
    expect(botica.getObjectByName('roof-gable--1').material).toBe(walls.material);
    // The herb house must not inherit the guild's violet roof or the
    // provisions warehouse's cedar finish on desktop or touch.
    for (const side of [-1, 1]) {
      const roof = botica.getObjectByName('pitched-roof-' + side);
      expect(roof.material.color.getHex()).toBe(0x5d8570);
      expect(roof.material.map).toBe(swordhavenSurfaceTexture('roof'));
      expect(roof.material.normalMap).toBe(swordhavenSurfaceNormalTexture('roof'));
      expect(roof.material.color.getHex())
        .not.toBe(store.getObjectByName('pitched-roof-' + side).material.color.getHex());
    }
    expect(botica.getObjectByName('vertical-facade-post')).toBeFalsy();
    expect(botica.getObjectByName('diagonal-timber-brace')).toBeFalsy();
    expect(store.getObjectByName('vertical-facade-post')).toBeTruthy();
    expect(store.getObjectByName('timber-and-stone-walls').material.map)
      .toBe(swordhavenSurfaceTexture('stucco'));
    const herbarium = botica.getObjectByName('apothecary-roof-herbarium');
    expect(herbarium).toBeTruthy();
    expect(herbarium.userData.chroniclesDecorativeOnly).toBe(true);
    const terrace = botica.getObjectByName('apothecary-herbarium-stone-terrace');
    expect(terrace?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(terrace.material).toBe(walls.material);
    expect(terrace.geometry.parameters.width).toBeLessThan(8.1);
    expect(terrace.geometry.parameters.depth).toBeLessThan(7.1);
    expect(terrace.position.y - terrace.geometry.parameters.height / 2).toBeGreaterThan(5.25);
    expect(herbarium.scale.x).toBeGreaterThan(1.25);
    expect(herbarium.scale.y).toBeGreaterThan(1.1);
    expect(herbarium.scale.z).toBeGreaterThan(1.1);
    expect(herbarium.position.y).toBeCloseTo(
      terrace.position.y + terrace.geometry.parameters.height / 2);
    expect(store.getObjectByName('apothecary-herbarium-stone-terrace')).toBeFalsy();
    // The old opaque timber box concealed the greenhouse glazing. It must
    // remain an open post-and-rail frame, including on coarse touch devices.
    expect(herbarium.getObjectByName('herbarium-timber-frame')).toBeFalsy();
    expect(herbarium.children.filter(child => child.name === 'herbarium-corner-post'))
      .toHaveLength(4);
    expect(herbarium.children.filter(child => child.name === 'herbarium-green-glazing'))
      .toHaveLength(2);
    expect(herbarium.children.filter(child => child.name === 'herbarium-side-glazing'))
      .toHaveLength(2);
    expect(herbarium.children.filter(child => child.name === 'herbarium-glazed-roof'))
      .toHaveLength(2);
    expect(herbarium.children.filter(child => child.name === 'herbarium-roof-rafter'))
      .toHaveLength(2);
    expect(herbarium.getObjectByName('herbarium-roof-ridge')).toBeTruthy();
    const glazing = herbarium.getObjectByName('herbarium-green-glazing').material;
    expect(glazing.transparent).toBe(true);
    // Clearer greenhouse panes expose the existing foliage without losing
    // the double-sided transparent glass contract on touch or desktop.
    expect(glazing.opacity).toBeCloseTo(0.42);
    expect(glazing.color.getHex()).toBe(0xc1e2d2);
    expect(glazing.roughness).toBeCloseTo(0.19);
    expect(glazing.side).toBe(THREE.DoubleSide);
    expect(glazing.depthWrite).toBe(false);
    expect(herbarium.getObjectByName('herbarium-glazed-roof').material).toBe(glazing);
    expect(botica.getObjectByName('apothecary-hanging-herbs')).toBeTruthy();
    expect(botica.getObjectByName('shop-door')).toBeTruthy();
    const portal = botica.getObjectByName('apothecary-stone-arch-portal');
    const nameplate = botica.getObjectByName('swordhaven-shop-nameplate');
    expect(portal?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(portal.children.filter(part => part.name === 'apothecary-entry-stone-jamb'))
      .toHaveLength(2);
    expect(portal.children.filter(part => part.name === 'apothecary-entry-stone-footing'))
      .toHaveLength(2);
    const arch = portal.getObjectByName('apothecary-entry-arch-voussoirs');
    expect(arch).toBeInstanceOf(THREE.InstancedMesh);
    expect(arch.count).toBe(9);
    expect(arch.castShadow).toBe(!coarsePointer);
    // The portal must not cover the shop lettering, even on touch devices.
    botica.updateWorldMatrix(true, true);
    expect(new THREE.Box3().setFromObject(portal).max.y)
      .toBeLessThan(new THREE.Box3().setFromObject(nameplate).min.y);
    expect(store.getObjectByName('apothecary-stone-arch-portal')).toBeFalsy();
    expect(nameplate).toBeTruthy();
    // The authored walk grid is unchanged; no new obstacle is introduced.
    expect(swordhaven.grid[4][5]).toBe('.');
  });
});
