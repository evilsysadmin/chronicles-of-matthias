import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven forge roof finish', () => {
  it.each([false, true])('keeps a distinct charcoal roof with shared textures on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    const tavern = scene.getObjectByName('swordhaven-building-swordhaven-tavern');
    const store = scene.getObjectByName('swordhaven-building-swordhaven-store');
    expect(forge).toBeTruthy();
    expect(tavern).toBeTruthy();

    const roof = forge.getObjectByName('pitched-roof-1');
    const oppositeSlope = forge.getObjectByName('pitched-roof--1');
    const smokeLanternCap = forge.getObjectByName('forge-lantern-pitched-cap');
    expect(roof.material.color.getHex()).toBe(0x535b61);
    expect(roof.material.map).toBe(swordhavenSurfaceTexture('roof'));
    expect(roof.material.normalMap).toBe(swordhavenSurfaceNormalTexture('roof'));
    expect(oppositeSlope.material).toBe(roof.material);
    expect(smokeLanternCap.material).toBe(roof.material);
    expect(tavern.getObjectByName('pitched-roof-1').material.color.getHex())
      .not.toBe(roof.material.color.getHex());
    if (store) {
      expect(store.getObjectByName('pitched-roof-1').material.color.getHex())
        .not.toBe(roof.material.color.getHex());
    }
    expect(forge.getObjectByName('shop-door')).toBeTruthy();
    expect(forge.getObjectByName('forge-roof-smokestack')).toBeTruthy();
    expect(forge.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
  });
});
