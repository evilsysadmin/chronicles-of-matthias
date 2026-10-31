import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven Botica projecting botanical windows', () => {
  it.each([true, false])('keeps two deep glazed bays decorative at coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    const content = [...swordhaven.interactables, ...swordhaven.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
    buildChroniclesCampaignExterior(scene, {
      coarsePointer,
      scenePlan: {
        mapId: swordhaven.id, regionKind: swordhaven.regionKind,
        width: swordhaven.grid[0].length, height: swordhaven.grid.length,
        center: { x: 9, y: 7 }, grid: swordhaven.grid,
        content, landscape: swordhaven.landscape,
      },
    });
    const town = scene.getObjectByName('chronicles-campaign-town');
    const botica = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-apothecary-'));
    const guild = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-guild-'));
    const windows = botica.getObjectByName('apothecary-botanical-window-bays');
    const bays = windows.children.filter(child => child.name === 'apothecary-botanical-window-bay');
    expect(windows.userData.chroniclesDecorativeOnly).toBe(true);
    expect(bays).toHaveLength(2);
    expect(guild.getObjectByName('apothecary-bay-verdigris-hood')).toBeFalsy();

    const door = botica.getObjectByName('shop-door');
    expect(door).toBeTruthy();
    expect(windows.position.z - door.position.z).toBeCloseTo(0.56, 4);
    for (const bay of bays) {
      expect(bay.userData.chroniclesDecorativeOnly).toBe(true);
      const returns = bay.children.filter(child => child.name === 'apothecary-bay-stone-return');
      const glass = bay.children.filter(child => child.name === 'apothecary-bay-side-glass');
      expect(returns).toHaveLength(2);
      expect(glass).toHaveLength(2);
      expect(returns.map(part => Math.sign(part.position.x))).toEqual([-1, 1]);
      expect(glass.map(part => Math.sign(part.position.x))).toEqual([-1, 1]);
      expect(returns.every(part => part.geometry.parameters.depth === 0.60)).toBe(true);
      expect(glass.every(part => part.geometry.parameters.depth === 0.45)).toBe(true);
      const hood = bay.getObjectByName('apothecary-bay-verdigris-hood');
      expect(hood.material.color.getHex()).toBe(0x2c5c4c);
      expect(hood.geometry.parameters.depth).toBe(1.15);
      expect(hood.position.y).toBeGreaterThan(1.3);
      expect(hood.rotation.x).toBeCloseTo(0.40);
      const braces = bay.children.filter(child => child.name === 'apothecary-bay-oak-knee-brace');
      expect(braces).toHaveLength(2);
      expect(braces.map(part => Math.sign(part.position.x))).toEqual([-1, 1]);
      expect(braces.every(part => part.rotation.x === -0.58
        && part.castShadow === !coarsePointer)).toBe(true);
      expect(bay.getObjectByName('apothecary-window-stone-sill')
        .geometry.parameters.depth).toBe(0.78);
      for (const part of [...returns, ...glass, hood]) {
        expect(part.castShadow).toBe(!coarsePointer);
      }
    }
    expect(botica.children.filter(child => child.name === 'apothecary-herb-window-box'))
      .toHaveLength(2);
    expect(botica.getObjectByName('apothecary-stone-arch-portal')).toBeTruthy();
    // No map, collision or interaction changes: both house tiles stay solid.
    expect(swordhaven.grid[3][3]).toBe('#');
  });
});
