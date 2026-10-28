import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, createSwordhavenWalkGrid, SWORDHAVEN_INTERACTION_CELLS,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven forge side-street lean-to', () => {
  it.each([true, false])('has a supported, decorative side canopy on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    const leanTo = forge.getObjectByName('forge-west-side-lean-to');
    expect(leanTo?.userData.chroniclesDecorativeOnly).toBe(true);

    const canopy = leanTo.getObjectByName('forge-lean-to-pitched-canopy');
    expect(canopy).toBeTruthy();
    expect(canopy.rotation.z).toBeGreaterThan(0);
    expect(canopy.castShadow).toBe(!coarsePointer);
    expect(leanTo.children.filter(part => part.name === 'forge-lean-to-oak-post')).toHaveLength(2);
    expect(leanTo.children.filter(part => part.name === 'forge-lean-to-stone-footing')).toHaveLength(2);
    expect(leanTo.children.filter(part => part.name === 'forge-lean-to-diagonal-brace')).toHaveLength(2);
    expect(leanTo.getObjectByName('forge-lean-to-oak-eave')).toBeTruthy();

    const post = leanTo.getObjectByName('forge-lean-to-oak-post');
    expect(post.position.x).toBeLessThan(-4);
    expect(Math.abs(post.position.x)).toBeLessThan(6,
      'lean-to must remain over the existing blocked building footprint');
    expect(canopy.position.y).toBeGreaterThan(
      forge.getObjectByName('side-window-forge-soot-vent').position.y,
      'canopy must clear the side ventilation');
    expect(forge.getObjectByName('shop-door')).toBeTruthy();
    expect(forge.getObjectByName('forge-roof-smoke-lantern')).toBeTruthy();
    expect(forge.getObjectByName('forge-roof-smokestack')).toBeTruthy();

    for (const id of ['swordhaven-armor', 'swordhaven-tavern', 'swordhaven-magic']) {
      expect(scene.getObjectByName('swordhaven-building-' + id)
        ?.getObjectByName('forge-west-side-lean-to')).toBeFalsy();
    }
    const approach = SWORDHAVEN_INTERACTION_CELLS.find(cell => cell.id === 'swordhaven-forge');
    expect(createSwordhavenWalkGrid()[approach.y][approach.x]).toBe('.');
  });
});
