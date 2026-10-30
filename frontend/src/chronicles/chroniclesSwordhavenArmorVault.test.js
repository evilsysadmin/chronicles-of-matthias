import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, createSwordhavenWalkGrid, SWORDHAVEN_INTERACTION_CELLS,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven armorer lead barrel vault', () => {
  it.each([false, true])('keeps a distinct shallow curved roof inside the solid footprint on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const armor = scene.getObjectByName('swordhaven-building-swordhaven-armor');
    const vault = armor?.getObjectByName('armor-lead-barrel-vault');
    const shell = vault?.getObjectByName('armor-vault-curved-lead-shell');
    const ribs = vault?.getObjectByName('armor-vault-iron-ribs');
    const caps = vault?.children.filter(child => child.name === 'armor-vault-stone-tympanum');

    expect(vault?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(shell?.geometry.type).toBe('CylinderGeometry');
    expect(shell.geometry.parameters.thetaLength).toBeCloseTo(Math.PI);
    expect(shell.rotation.x).toBeCloseTo(Math.PI / 2);
    expect(shell.material.side).toBe(THREE.DoubleSide);
    expect(caps).toHaveLength(2);
    expect(caps.map(cap => Math.sign(cap.position.z))).toEqual([-1, 1]);
    expect(ribs?.isInstancedMesh).toBe(true);
    expect(ribs.count).toBe(coarsePointer ? 3 : 5);
    expect(shell.castShadow).toBe(!coarsePointer);
    expect(ribs.castShadow).toBe(!coarsePointer);
    expect(vault.scale.y).toBeGreaterThan(0.70);
    expect(vault.scale.y).toBeLessThan(0.82);

    // The curved roof stays behind the front battlements and below the
    // existing paired tower caps, without altering entrances or walk cells.
    const radius = shell.geometry.parameters.radiusTop;
    const length = shell.geometry.parameters.height;
    const shoulder = armor.getObjectByName('armor-roof-shoulder-hip');
    expect(radius + 0.2).toBeLessThan(4.05);
    expect(length + 0.3).toBeLessThan(7.1);
    expect(vault.position.y + radius * vault.scale.y).toBeLessThan(shoulder.position.y);
    expect(armor.getObjectByName('shop-door')).toBeTruthy();
    expect(armor.getObjectByName('armor-roof-crest')).toBeTruthy();
    for (const id of ['swordhaven-forge', 'swordhaven-tavern', 'swordhaven-magic']) {
      expect(scene.getObjectByName('swordhaven-building-' + id)
        ?.getObjectByName('armor-lead-barrel-vault')).toBeFalsy();
    }
    const approach = SWORDHAVEN_INTERACTION_CELLS.find(cell => cell.id === 'swordhaven-armor');
    expect(createSwordhavenWalkGrid()[approach.y][approach.x]).toBe('.');
  });
});
