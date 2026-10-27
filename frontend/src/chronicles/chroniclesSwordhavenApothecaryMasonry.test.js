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
    expect(botica.getObjectByName('apothecary-roof-herbarium')).toBeTruthy();
    expect(botica.getObjectByName('apothecary-hanging-herbs')).toBeTruthy();
    expect(botica.getObjectByName('shop-door')).toBeTruthy();
    expect(botica.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    // The authored walk grid is unchanged; no new obstacle is introduced.
    expect(swordhaven.grid[4][5]).toBe('.');
  });
});
