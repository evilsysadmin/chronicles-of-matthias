import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven guild pointed stone entrance', () => {
  it.each([true, false])('keeps the guild portal decorative on coarsePointer=%s', (coarsePointer) => {
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
    const temple = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-temple-'));
    const portal = guild.getObjectByName('magic-guild-pointed-entry');
    expect(portal.userData.chroniclesDecorativeOnly).toBe(true);
    expect(portal.children).toHaveLength(7);
    expect(portal.children.filter(child => child.name === 'magic-entry-pointed-arch')).toHaveLength(2);
    expect(portal.children.filter(child => child.name === 'magic-entry-ashlar-jamb')).toHaveLength(2);
    expect(portal.children.filter(child => child.name === 'magic-entry-violet-plinth')).toHaveLength(2);
    expect(portal.getObjectByName('magic-entry-brass-keystone')).toBeTruthy();
    expect(temple.getObjectByName('magic-guild-pointed-entry')).toBeFalsy();
    for (const part of portal.children) {
      expect(part.castShadow).toBe(!coarsePointer);
      expect(part.position.z).toBeLessThan(4.5);
      expect(part.position.y).toBeLessThan(4.0);
    }
    // No new blocker or walk-grid change: the guild still occupies solid tiles.
    expect(swordhaven.grid[3][15]).toBe('#');
  });
});
