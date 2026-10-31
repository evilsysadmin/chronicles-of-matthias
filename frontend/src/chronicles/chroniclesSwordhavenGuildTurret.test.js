import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven guild slate turret', () => {
  it.each([true, false])('has masonry and four decorative glazed bays on coarsePointer=%s', (coarsePointer) => {
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
    const turret = guild.getObjectByName('magic-shop-turret');
    const walls = guild.getObjectByName('timber-and-stone-walls');
    const lancets = guild.getObjectByName('magic-turret-slate-lancets');

    expect(turret.material).toBe(walls.material);
    expect(turret.userData.chroniclesDecorativeOnly).toBe(true);
    expect(lancets.userData.chroniclesDecorativeOnly).toBe(true);
    expect(lancets.children).toHaveLength(4);
    expect(temple.getObjectByName('magic-turret-slate-lancets')).toBeFalsy();
    for (const bay of lancets.children) {
      expect(bay.userData.chroniclesDecorativeOnly).toBe(true);
      expect(bay.getObjectByName('magic-turret-lancet-violet-pane')).toBeTruthy();
      expect(bay.children.filter(child =>
        child.name === 'magic-turret-lancet-brass-jamb')).toHaveLength(2);
      expect(bay.children.filter(child =>
        child.name === 'magic-turret-lancet-brass-rail')).toHaveLength(2);
      for (const part of bay.children) {
        expect(part.userData.chroniclesDecorativeOnly).toBe(true);
        expect(part.castShadow).toBe(!coarsePointer);
      }
    }
    // All glazing remains elevated on the original turret above the solid
    // guild building, never introducing a new traversable-cell blocker.
    expect(Math.abs(lancets.children[0].position.x - turret.position.x))
      .toBeLessThan(1.3);
    expect(lancets.children[0].position.y).toBeGreaterThan(6);
    expect(swordhaven.grid[3][15]).toBe('#');
  });
});
