import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenScene } from './chroniclesSwordhaven3D.js';

describe('Swordhaven armorer roof silhouette', () => {
  it.each([true, false])('adds two visible, decorative stone shoulders on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const armor = scene.getObjectByName('swordhaven-building-swordhaven-armor');
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    const watch = scene.getObjectByName('swordhaven-building-swordhaven-watch');
    expect(armor).toBeTruthy();
    const shoulders = armor.getObjectByName('armor-roof-shoulders');
    expect(shoulders?.userData.chroniclesDecorativeOnly).toBe(true);
    const piers = shoulders.children.filter(child => child.name === 'armor-roof-shoulder-pier');
    const caps = shoulders.children.filter(child => child.name === 'armor-roof-shoulder-cap');
    expect(piers).toHaveLength(2);
    expect(caps).toHaveLength(2);
    expect(shoulders.children.filter(child => child.name === 'armor-roof-shoulder-hip')).toHaveLength(2);
    expect(shoulders.children.filter(child => child.name === 'armor-roof-shoulder-slit')).toHaveLength(2);
    expect(piers[0].position.x).toBeCloseTo(-piers[1].position.x);
    // Roof shoulders must project ahead of the flat ashlar coping and rise
    // above its surface; mere scene-graph presence is not visual proof.
    const coping = armor.getObjectByName('armor-flat-roof-coping');
    expect(coping).toBeTruthy();
    expect(piers[0].position.z + 0.46).toBeGreaterThan(coping.geometry.parameters.depth / 2);
    expect(caps[0].position.y).toBeGreaterThan(coping.position.y);
    expect(armor.getObjectByName('armor-roof-crest')).toBeTruthy();
    expect(armor.getObjectByName('armor-stone-gateway')).toBeTruthy();
    expect(armor.getObjectByName('shop-door')).toBeTruthy();
    expect(armor.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    expect(forge.getObjectByName('armor-roof-shoulders')).toBeFalsy();
    if (watch) expect(watch.getObjectByName('armor-roof-shoulders')).toBeFalsy();
  });
});
