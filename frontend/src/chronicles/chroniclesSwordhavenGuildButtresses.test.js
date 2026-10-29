import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven guild structural side buttresses', () => {
  it.each([false, true])('is decorative and stays within the solid footprint on coarsePointer=%s', (coarsePointer) => {
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
    const guild = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-guild-'));
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    const buttresses = guild?.getObjectByName('magic-guild-side-buttresses');
    expect(buttresses?.userData.chroniclesDecorativeOnly).toBe(true);
    const shafts = buttresses.children.filter(child => child.name === 'magic-buttress-shaft');
    const caps = buttresses.children.filter(child => child.name === 'magic-buttress-pointed-cap');
    expect(shafts).toHaveLength(2);
    expect(caps).toHaveLength(2);
    expect(shafts.map(child => Math.sign(child.position.x)).sort()).toEqual([-1, 1]);
    for (const part of buttresses.children) {
      expect(Math.abs(part.position.x)).toBeLessThan(4.5);
      expect(part.position.z).toBe(0);
      expect(part.castShadow).toBe(!coarsePointer);
    }
    expect(caps.every(cap => cap.position.y > 5.25)).toBe(true);
    expect(guild.getObjectByName('magic-guild-roof-observatory')).toBeTruthy();
    expect(guild.getObjectByName('magic-guild-violet-glazing')).toBeTruthy();
    expect(guild.getObjectByName('shop-door')).toBeTruthy();
    expect(forge?.getObjectByName('magic-guild-side-buttresses')).toBeFalsy();
    // The authored map, including the walkable camera approach, is untouched.
    expect(swordhaven.grid[4][12]).toBe('.');
  });
});
