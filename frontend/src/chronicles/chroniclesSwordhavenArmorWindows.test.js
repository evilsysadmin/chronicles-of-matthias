import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenScene, createSwordhavenWalkGrid } from './chroniclesSwordhaven3D.js';

describe('Swordhaven armorer street-level architecture', () => {
  it.each([false, true])('uses two forged shield alcoves instead of flower-box merchant windows on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const armor = scene.getObjectByName('swordhaven-building-swordhaven-armor');
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    const temple = scene.getObjectByName('swordhaven-building-swordhaven-temple');
    const bays = armor.getObjectByName('armor-forged-display-bays');
    expect(bays?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(bays?.children).toHaveLength(2);
    expect(bays.children[0].position.x).toBeCloseTo(-bays.children[1].position.x);
    expect(bays.position.z).toBeGreaterThan(armor.getObjectByName('shop-door').position.z);
    for (const bay of bays.children) {
      expect(bay.getObjectByName('armor-display-dark-recess')).toBeTruthy();
      expect(bay.getObjectByName('armor-display-shield')?.geometry).toBeInstanceOf(THREE.ShapeGeometry);
      expect(bay.getObjectByName('armor-display-shield-spine')).toBeTruthy();
      expect(bay.children.filter(child => child.name === 'armor-display-iron-bar')).toHaveLength(2);
      expect(bay.children.filter(child => child.name === 'armor-display-stone-jamb')).toHaveLength(2);
      expect(bay.children.filter(child => child.name === 'armor-display-stone-rail')).toHaveLength(2);
    }
    expect(armor.getObjectByName('warm-glass-window')).toBeFalsy();
    expect(armor.getObjectByName('flower-window-box')).toBeFalsy();
    expect(armor.getObjectByName('window-box-leaf-clusters')).toBeFalsy();
    expect(armor.getObjectByName('window-diamond-leadwork')).toBeFalsy();
    expect(armor.getObjectByName('armor-stone-gateway')).toBeTruthy();
    expect(armor.getObjectByName('shop-door')).toBeTruthy();
    expect(armor.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    expect(forge.getObjectByName('warm-glass-window')).toBeTruthy();
    expect(forge.getObjectByName('window-box-leaf-clusters')).toBeTruthy();
    expect(temple.getObjectByName('temple-stained-glass-lancets')).toBeTruthy();
    expect(temple.getObjectByName('armor-forged-display-bays')).toBeFalsy();
    expect(createSwordhavenWalkGrid()[7][14]).toBe('.');
  });
});
