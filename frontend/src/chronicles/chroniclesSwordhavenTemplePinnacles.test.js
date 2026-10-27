import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenScene } from './chroniclesSwordhaven3D.js';

describe('Swordhaven temple roof silhouette', () => {
  it.each([true, false])('has paired street-visible limestone pinnacles on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const temple = scene.getObjectByName('swordhaven-building-swordhaven-temple');
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    const guild = scene.getObjectByName('swordhaven-building-swordhaven-magic');
    expect(temple).toBeTruthy();

    const pinnacles = temple.getObjectByName('temple-gable-pinnacles');
    const gable = temple.getObjectByName('roof-gable-1');
    const shafts = pinnacles?.children.filter(child => child.name === 'temple-pinnacle-shaft');
    const spires = pinnacles?.children.filter(child => child.name === 'temple-pinnacle-spire');
    const finials = pinnacles?.children.filter(child => child.name === 'temple-pinnacle-finial');
    expect(pinnacles?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(pinnacles?.children.filter(child => child.name === 'temple-pinnacle-plinth')).toHaveLength(2);
    expect(shafts).toHaveLength(2);
    expect(spires).toHaveLength(2);
    expect(finials).toHaveLength(2);
    expect(shafts[0].position.x).toBeCloseTo(-shafts[1].position.x);
    expect(pinnacles.position.z).toBeGreaterThan(gable.position.z + 0.2);
    expect(finials[0].position.y).toBeGreaterThan(temple.getObjectByName('ridge-timber').position.y);
    expect(temple.getObjectByName('shop-door')).toBeTruthy();
    expect(temple.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    expect(temple.getObjectByName('temple-limestone-portico')).toBeTruthy();
    expect(forge.getObjectByName('temple-gable-pinnacles')).toBeFalsy();
    expect(guild.getObjectByName('temple-gable-pinnacles')).toBeFalsy();
  });
});
