import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenScene } from './chroniclesSwordhaven3D.js';

describe('Swordhaven temple sunburst gable', () => {
  it.each([true, false])('reads from the street without altering the entrance on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const temple = scene.getObjectByName('swordhaven-building-swordhaven-temple');
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    const guild = scene.getObjectByName('swordhaven-building-swordhaven-magic');
    expect(temple).toBeTruthy();

    const rose = temple.getObjectByName('temple-sunburst-rose');
    const gable = temple.getObjectByName('roof-gable-1');
    const rays = rose?.getObjectByName('temple-sunburst-rays');
    expect(rose?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(rose?.getObjectByName('temple-sunburst-glass')).toBeTruthy();
    expect(rose?.getObjectByName('temple-rose-window')).toBeTruthy();
    expect(rays).toBeInstanceOf(THREE.InstancedMesh);
    expect(rays.count).toBe(8);
    // The gable and roof overhang must not swallow the decorative rose.
    expect(rose.position.z).toBeGreaterThan(gable.position.z + 0.4);
    expect(rose.position.y).toBeGreaterThan(temple.getObjectByName('roof-edge-fascia').position.y);
    expect(temple.getObjectByName('shop-door')).toBeTruthy();
    expect(temple.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    expect(temple.getObjectByName('temple-limestone-portico')).toBeTruthy();
    expect(forge.getObjectByName('temple-sunburst-rose')).toBeFalsy();
    expect(guild.getObjectByName('temple-sunburst-rose')).toBeFalsy();
  });
});
