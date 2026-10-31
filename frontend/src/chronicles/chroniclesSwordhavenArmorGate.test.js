import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven armorer fortified iron gateway', () => {
  it.each([true, false])('is decorative and unique on coarsePointer=%s', (coarsePointer) => {
    const originalGrid = JSON.stringify(swordhaven.grid);
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
    const armorer = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-armor-'));
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    const guild = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-guild-'));
    const gate = armorer.getObjectByName('armor-fortified-iron-gate');
    expect(gate?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(armorer.getObjectByName('shop-door')).toBeTruthy();
    expect(forge.getObjectByName('armor-fortified-iron-gate')).toBeFalsy();
    expect(guild.getObjectByName('armor-fortified-iron-gate')).toBeFalsy();
    expect(gate.children.filter(part => part.name === 'armor-gate-steel-leaf')).toHaveLength(2);
    expect(gate.children.filter(part => part.name === 'armor-gate-ashlar-jamb')).toHaveLength(2);
    expect(gate.getObjectByName('armor-gate-ashlar-lintel')).toBeTruthy();
    expect(gate.getObjectByName('armor-gate-forged-crossbands').count).toBe(3);
    expect(gate.getObjectByName('armor-gate-steel-rivets').count).toBe(18);
    expect(gate.getObjectByName('armor-gate-raised-shield')).toBeTruthy();
    expect(gate.getObjectByName('armor-gate-shield-spine')).toBeTruthy();
    for (const part of gate.children) {
      expect(part.userData.chroniclesDecorativeOnly).toBe(true);
      expect(part.position.z).toBeLessThan(4.5);
    }
    expect(JSON.stringify(swordhaven.grid)).toBe(originalGrid);
  });
});
