import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, createSwordhavenWalkGrid, SWORDHAVEN_INTERACTION_CELLS,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven armorer side parapet silhouette', () => {
  it.each([true, false])('joins both flat-roof flanks without blocking the shop on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const armor = scene.getObjectByName('swordhaven-building-swordhaven-armor');
    const flank = armor.getObjectByName('armor-roof-side-parapets');
    expect(flank?.userData.chroniclesDecorativeOnly).toBe(true);
    const courses = flank.children.filter(part => part.name === 'armor-side-parapet-course');
    expect(courses).toHaveLength(2);
    expect(courses[0].position.x).toBeCloseTo(-courses[1].position.x);
    expect(courses[0].position.y).toBeCloseTo(courses[1].position.y);
    expect(courses.every(part => part.castShadow === !coarsePointer)).toBe(true);

    const merlons = flank.getObjectByName('armor-side-parapet-merlons');
    expect(merlons).toBeInstanceOf(THREE.InstancedMesh);
    expect(merlons.count).toBe(10);
    expect(merlons.castShadow).toBe(!coarsePointer);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const flankXs = new Set();
    for (let index = 0; index < merlons.count; index += 1) {
      merlons.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      flankXs.add(position.x.toFixed(3));
      expect(position.y).toBeGreaterThan(courses[0].position.y);
    }
    expect(flankXs.size).toBe(2);
    expect(armor.getObjectByName('armor-flat-roof-deck')).toBeTruthy();
    expect(armor.getObjectByName('armor-ashlar-parapet')).toBeTruthy();
    expect(armor.getObjectByName('shop-door')).toBeTruthy();
    expect(armor.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    for (const id of ['swordhaven-forge', 'swordhaven-tavern', 'swordhaven-magic']) {
      expect(scene.getObjectByName('swordhaven-building-' + id)
        ?.getObjectByName('armor-roof-side-parapets')).toBeFalsy();
    }
    const approach = SWORDHAVEN_INTERACTION_CELLS.find(cell => cell.id === 'swordhaven-armor');
    expect(createSwordhavenWalkGrid()[approach.y][approach.x]).toBe('.');
  });
});
