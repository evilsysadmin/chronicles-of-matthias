import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven guild brass-inlaid oak door', () => {
  it.each([true, false])('keeps the guild door decorative on coarsePointer=%s', (coarsePointer) => {
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
    const door = guild.getObjectByName('magic-guild-brass-inlaid-door');
    expect(portal.userData.chroniclesDecorativeOnly).toBe(true);
    expect(portal.children).toHaveLength(4);
    expect(door.userData.chroniclesDecorativeOnly).toBe(true);
    expect(door.children).toHaveLength(7);
    expect(door.children.filter(part => part.name === 'magic-door-violet-oak-leaf')).toHaveLength(2);
    expect(door.children.filter(part => part.name === 'magic-door-brass-stile')).toHaveLength(2);
    expect(door.children.filter(part => part.name === 'magic-door-brass-pull')).toHaveLength(2);
    expect(door.getObjectByName('magic-door-arcane-sigil')).toBeTruthy();
    expect(temple.getObjectByName('magic-guild-brass-inlaid-door')).toBeFalsy();
    for (const part of door.children) {
      if (part.name !== 'magic-door-brass-stile' && part.name !== 'magic-door-brass-pull') {
        expect(part.castShadow).toBe(!coarsePointer);
      }
      expect(part.position.z).toBeLessThan(4.5);
      expect(part.position.y).toBeLessThan(3.0);
    }
    // No new blocker or walk-grid change: the guild still occupies solid tiles.
    expect(swordhaven.grid[3][15]).toBe('#');
  });
});
