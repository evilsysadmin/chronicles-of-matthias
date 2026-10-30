import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, createSwordhavenWalkGrid, SWORDHAVEN_INTERACTION_CELLS,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven armorer side buttresses', () => {
  it.each([false, true])('keeps four decorative ashlar supports inside the solid footprint on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const armor = scene.getObjectByName('swordhaven-building-swordhaven-armor');
    const buttresses = armor?.getObjectByName('armor-side-ashlar-buttresses');
    expect(buttresses?.userData.chroniclesDecorativeOnly).toBe(true);
    const piers = buttresses.children.filter(child => child.name === 'armor-side-buttress-pier');
    const copings = buttresses.children.filter(child => child.name === 'armor-side-buttress-coping');
    expect(piers).toHaveLength(4);
    expect(copings).toHaveLength(4);
    expect(new Set(piers.map(child => Math.sign(child.position.x)))).toEqual(new Set([-1, 1]));
    expect(new Set(piers.map(child => Math.sign(child.position.z)))).toEqual(new Set([-1, 1]));
    for (const pier of piers) {
      expect(pier.castShadow).toBe(!coarsePointer);
      expect(Math.abs(pier.position.x) + 0.26).toBeLessThan(6);
      expect(Math.abs(pier.position.z) + 0.35).toBeLessThan(6);
    }
    expect(armor.getObjectByName('shop-door')).toBeTruthy();
    expect(armor.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    for (const id of ['swordhaven-forge', 'swordhaven-tavern', 'swordhaven-magic']) {
      expect(scene.getObjectByName('swordhaven-building-' + id)
        ?.getObjectByName('armor-side-ashlar-buttresses')).toBeFalsy();
    }
    const approach = SWORDHAVEN_INTERACTION_CELLS.find(cell => cell.id === 'swordhaven-armor');
    expect(createSwordhavenWalkGrid()[approach.y][approach.x]).toBe('.');
  });
});
