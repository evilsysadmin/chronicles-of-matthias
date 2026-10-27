import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenScene, createSwordhavenWalkGrid } from './chroniclesSwordhaven3D.js';

describe('Swordhaven magic guild observatory', () => {
  it.each([false, true])('has a distinct decorative octagonal roof on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const guild = scene.getObjectByName('swordhaven-building-swordhaven-magic');
    const observatory = guild.getObjectByName('magic-guild-roof-observatory');

    expect(observatory?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(observatory.position.y).toBeGreaterThan(guild.getObjectByName('ridge-timber').position.y);
    expect(observatory.getObjectByName('magic-observatory-stone-drum')?.geometry.parameters.radialSegments)
      .toBe(8);
    expect(observatory.getObjectByName('magic-observatory-steep-roof')?.geometry.parameters.radialSegments)
      .toBe(8);
    expect(observatory.getObjectByName('magic-observatory-brass-collar')).toBeTruthy();
    expect(observatory.children.filter(child => child.name === 'magic-observatory-window-frame'))
      .toHaveLength(2);
    expect(observatory.children.filter(child => child.name === 'magic-observatory-violet-window'))
      .toHaveLength(2);
    expect(observatory.getObjectByName('magic-observatory-violet-window').material)
      .toBe(scene.getObjectByName('arcane-window-lantern').material);
    expect(guild.getObjectByName('magic-guild-gable-oculus')).toBeTruthy();
    expect(guild.getObjectByName('magic-guild-pointed-entry')).toBeTruthy();
    expect(guild.getObjectByName('shop-door')).toBeTruthy();

    for (const other of scene.children.filter(child =>
      child.name.startsWith('swordhaven-building-') && child !== guild)) {
      expect(other.getObjectByName('magic-guild-roof-observatory')).toBeFalsy();
    }
    // The authored walkable entry remains open: roof art must never affect collisions.
    expect(createSwordhavenWalkGrid()[15][14]).toBe('.');
  });
});
