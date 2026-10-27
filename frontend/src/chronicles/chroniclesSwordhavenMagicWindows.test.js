import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenScene, createSwordhavenWalkGrid } from './chroniclesSwordhaven3D.js';

describe('Swordhaven magic guild facade', () => {
  it.each([false, true])('uses violet pointed glass rather than merchant windows on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const guild = scene.getObjectByName('swordhaven-building-swordhaven-magic');
    const glazing = guild.getObjectByName('magic-guild-violet-glazing');
    expect(glazing?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(glazing?.children).toHaveLength(2);
    expect(glazing.position.z).toBeGreaterThan(guild.getObjectByName('shop-door').position.z);
    expect(glazing.children[0].position.x).toBeCloseTo(-glazing.children[1].position.x);
    for (const bay of glazing.children) {
      expect(bay.getObjectByName('magic-window-stone-frame')?.geometry)
        .toBeInstanceOf(THREE.ShapeGeometry);
      expect(bay.getObjectByName('magic-window-violet-pane')?.geometry)
        .toBeInstanceOf(THREE.ShapeGeometry);
      expect(bay.getObjectByName('magic-window-violet-pane').material.emissiveIntensity)
        .toBeGreaterThan(0);
      expect(bay.getObjectByName('magic-window-brass-mullion')).toBeTruthy();
      expect(bay.children.filter(piece => piece.name === 'magic-window-pointed-lead'))
        .toHaveLength(2);
      expect(bay.getObjectByName('magic-window-carved-sill')).toBeTruthy();
    }
    expect(guild.getObjectByName('warm-glass-window')).toBeFalsy();
    expect(guild.getObjectByName('flower-window-box')).toBeFalsy();
    expect(guild.getObjectByName('window-box-leaf-clusters')).toBeFalsy();
    expect(guild.getObjectByName('window-diamond-leadwork')).toBeFalsy();
    expect(guild.getObjectByName('magic-guild-pointed-entry')).toBeTruthy();
    expect(guild.getObjectByName('magic-guild-gable-oculus')).toBeTruthy();
    expect(guild.getObjectByName('shop-door')).toBeTruthy();
    expect(guild.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    expect(scene.getObjectByName('swordhaven-building-swordhaven-temple')
      .getObjectByName('magic-guild-violet-glazing')).toBeFalsy();
    expect(createSwordhavenWalkGrid()[15][14]).toBe('.');
  });
});
