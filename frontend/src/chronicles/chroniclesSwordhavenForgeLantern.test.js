import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenScene } from './chroniclesSwordhaven3D.js';

describe('Swordhaven forge smoke lantern', () => {
  it.each([true, false])('keeps the smithy roof distinct and decorative on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    const armor = scene.getObjectByName('swordhaven-building-swordhaven-armor');
    const tavern = scene.getObjectByName('swordhaven-building-swordhaven-tavern');
    expect(forge).toBeTruthy();
    const lantern = forge.getObjectByName('forge-roof-smoke-lantern');
    expect(lantern?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(lantern.getObjectByName('forge-lantern-dark-opening')).toBeTruthy();
    expect(lantern.children.filter(child => child.name === 'forge-lantern-oak-post')).toHaveLength(2);
    expect(lantern.children.filter(child => child.name === 'forge-lantern-iron-louver')).toHaveLength(3);
    const cap = lantern.getObjectByName('forge-lantern-pitched-cap');
    expect(cap).toBeTruthy();
    expect(lantern.children.filter(child => child.name === 'forge-lantern-pitched-cap')).toHaveLength(2);
    expect(lantern.getObjectByName('forge-lantern-timber-gable')).toBeTruthy();
    expect(lantern.getObjectByName('forge-lantern-oak-post').position.y).toBeLessThan(0);
    // A roof feature hidden behind the main gable is not a visual improvement.
    expect(lantern.position.z).toBeGreaterThan(forge.getObjectByName('roof-gable-1').position.z);
    expect(lantern.position.y + cap.position.y).toBeGreaterThan(
      forge.getObjectByName('ridge-timber').position.y,
    );
    expect(forge.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
    expect(forge.getObjectByName('pitched-roof-dormer-1')).toBeFalsy();
    expect(forge.getObjectByName('forge-roof-smokestack')).toBeTruthy();
    expect(forge.getObjectByName('forge-stone-workshop-bay')).toBeTruthy();
    expect(forge.getObjectByName('shop-door')).toBeTruthy();
    expect(forge.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    expect(armor?.getObjectByName('forge-roof-smoke-lantern')).toBeFalsy();
    expect(tavern?.getObjectByName('forge-roof-smoke-lantern')).toBeFalsy();
  });
});
