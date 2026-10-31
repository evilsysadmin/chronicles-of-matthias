import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, createSwordhavenWalkGrid, SWORDHAVEN_INTERACTION_CELLS,
  swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven armorer dressed stone', () => {
  it.each([false, true])('has distinct blue-grey masonry without changing access on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const armor = scene.getObjectByName('swordhaven-building-swordhaven-armor');
    const temple = scene.getObjectByName('swordhaven-building-swordhaven-temple');
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    expect(armor).toBeTruthy();
    expect(temple).toBeTruthy();
    expect(forge).toBeTruthy();

    const walls = armor.getObjectByName('timber-and-stone-walls');
    expect(walls.material.color.getHex()).toBe(0x8da5b5);
    expect(walls.material.map).toBe(swordhavenSurfaceTexture('masonry'));
    expect(walls.material.normalMap).toBe(swordhavenSurfaceNormalTexture('masonry'));
    expect(walls.material.normalScale.x).toBeCloseTo(0.48);
    expect(walls.material.roughness).toBeCloseTo(0.95);
    expect(walls.material).not.toBe(temple.getObjectByName('timber-and-stone-walls').material);
    expect(walls.material.color.getHex()).not.toBe(
      forge.getObjectByName('timber-and-stone-walls').material.color.getHex(),
    );
    expect(armor.getObjectByName('armor-flat-ashlar-roof')).toBeTruthy();
    expect(armor.getObjectByName('shop-door')).toBeTruthy();
    const approach = SWORDHAVEN_INTERACTION_CELLS.find(cell => cell.id === 'swordhaven-armor');
    expect(createSwordhavenWalkGrid()[approach.y][approach.x]).toBe('.');
  });
});
