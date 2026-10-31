import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, createSwordhavenWalkGrid, SWORDHAVEN_INTERACTION_CELLS,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven weaponsmith workshop iron hood', () => {
  it.each([false, true])('keeps a recognisable elevated hood clear of the shop sign on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    const hood = forge.getObjectByName('forge-workshop-iron-hood');
    const nameplate = forge.getObjectByName('swordhaven-shop-nameplate');
    const roof = hood?.getObjectByName('forge-workshop-hood-patinated-roof');

    expect(hood?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(roof?.castShadow).toBe(!coarsePointer);
    expect(roof?.rotation.x).toBeGreaterThan(0);
    expect(roof?.material.metalness).toBeGreaterThan(0.2);
    expect(hood.children.filter(part => part.name === 'forge-workshop-hood-iron-bracket')).toHaveLength(2);
    expect(hood.getObjectByName('forge-workshop-hood-iron-drip-edge')).toBeTruthy();
    // The roof covers the firebox, not the lettering or the walkable street.
    expect(hood.position.x - 1.05).toBeGreaterThan(nameplate.position.x + 1.68);
    expect(hood.position.y).toBeGreaterThan(nameplate.position.y);
    expect(hood.position.z + 0.78).toBeLessThan(6);
    expect(forge.getObjectByName('forge-stone-workshop-bay')).toBeTruthy();
    expect(forge.getObjectByName('shop-door')).toBeTruthy();

    for (const id of ['swordhaven-armor', 'swordhaven-tavern', 'swordhaven-magic']) {
      expect(scene.getObjectByName('swordhaven-building-' + id)
        ?.getObjectByName('forge-workshop-iron-hood')).toBeFalsy();
    }
    const approach = SWORDHAVEN_INTERACTION_CELLS.find(cell => cell.id === 'swordhaven-forge');
    expect(createSwordhavenWalkGrid()[approach.y][approach.x]).toBe('.');
  });
});
