import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, createSwordhavenWalkGrid, SWORDHAVEN_INTERACTION_CELLS,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven forge twin-flue roof silhouette', () => {
  it.each([true, false])('keeps both iron exhausts above the roof on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    const stack = forge.getObjectByName('forge-roof-smokestack');
    const flues = stack.getObjectByName('forge-smokestack-twin-iron-flues');
    const caps = stack.getObjectByName('forge-smokestack-twin-rain-caps');
    expect(stack.userData.chroniclesDecorativeOnly).toBe(true);
    expect(flues).toBeInstanceOf(THREE.InstancedMesh);
    expect(caps).toBeInstanceOf(THREE.InstancedMesh);
    expect(flues.geometry.type).toBe('CylinderGeometry');
    expect(caps.geometry.type).toBe('CylinderGeometry');
    expect(flues.geometry.parameters.radiusTop).toBeGreaterThan(0.3);
    expect(flues.count).toBe(2);
    expect(caps.count).toBe(2);
    expect(flues.userData.chroniclesDecorativeOnly).toBe(true);
    expect(caps.userData.chroniclesDecorativeOnly).toBe(true);
    expect(flues.castShadow).toBe(!coarsePointer);
    expect(caps.castShadow).toBe(!coarsePointer);
    const matrix = new THREE.Matrix4();
    const positions = [0, 1].map(index => {
      flues.getMatrixAt(index, matrix);
      return new THREE.Vector3().setFromMatrixPosition(matrix);
    });
    expect(positions[0].x).toBeLessThan(0);
    expect(positions[1].x).toBeGreaterThan(0);
    expect(positions[0].y).toBeCloseTo(positions[1].y);
    caps.getMatrixAt(0, matrix);
    const cap = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(cap.y).toBeGreaterThan(positions[0].y + 0.5);
    expect(stack.position.y + cap.y).toBeGreaterThan(
      forge.getObjectByName('ridge-timber').position.y + 1,
      'iron outlets must be visibly above the existing pitched roof');
    expect(stack.getObjectByName('forge-smokestack-vent')).toBeFalsy();
    expect(forge.getObjectByName('shop-door')).toBeTruthy();
    expect(forge.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    for (const id of ['swordhaven-armor', 'swordhaven-tavern', 'swordhaven-magic']) {
      expect(scene.getObjectByName('swordhaven-building-' + id)
        ?.getObjectByName('forge-smokestack-twin-iron-flues')).toBeFalsy();
    }
    const approach = SWORDHAVEN_INTERACTION_CELLS.find(cell => cell.id === 'swordhaven-forge');
    expect(createSwordhavenWalkGrid()[approach.y][approach.x]).toBe('.');
  });
});
