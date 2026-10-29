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
    expect(glazing.opacity).toBeGreaterThan(0.5);
    expect(glazing.opacity).toBeLessThan(1);
    expect(glazing.depthWrite).toBe(false);
    expect(herbarium.getObjectByName('herbarium-glazed-roof').material).toBe(glazing);
    expect(botica.getObjectByName('apothecary-hanging-herbs')).toBeTruthy();
    expect(botica.getObjectByName('shop-door')).toBeTruthy();
    expect(botica.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    // The authored walk grid is unchanged; no new obstacle is introduced.
    expect(swordhaven.grid[4][5]).toBe('.');
  });
});
