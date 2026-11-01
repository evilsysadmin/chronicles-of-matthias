import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven guild deep stone lancet windows', () => {
  it.each([false, true])('keeps four stone-framed side lancets decorative at coarsePointer=%s', (coarsePointer) => {
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
    const guild = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-guild-'));
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    const lancets = guild.getObjectByName('magic-guild-side-lancets');
    const returns = lancets.getObjectByName('magic-side-lancet-deep-stone-returns');
    const sills = lancets.getObjectByName('magic-side-lancet-projecting-stone-sills');
    expect(lancets.userData.chroniclesDecorativeOnly).toBe(true);
    expect(forge.getObjectByName('magic-side-lancet-deep-stone-returns')).toBeFalsy();
    expect(returns.count).toBe(8);
    expect(sills.count).toBe(4);
    expect(returns.geometry.parameters.depth).toBe(0.46);
    expect(sills.geometry.parameters.depth).toBe(0.50);
    for (const batch of [returns, sills]) {
      expect(batch.userData.chroniclesDecorativeOnly).toBe(true);
      expect(batch.castShadow).toBe(!coarsePointer);
      expect(batch.receiveShadow).toBe(true);
      const transform = new THREE.Matrix4();
      for (let i = 0; i < batch.count; i += 1) {
        batch.getMatrixAt(i, transform);
        const position = new THREE.Vector3().setFromMatrixPosition(transform);
        expect(position.y).toBeGreaterThan(1.8);
        expect(Math.abs(position.z)).toBeLessThan(3.5);
      }
    }
    expect(guild.getObjectByName('shop-door')).toBeTruthy();
    expect(swordhaven.grid[3][3]).toBe('#');
  });
});
