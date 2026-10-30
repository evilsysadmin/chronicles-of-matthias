import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, createSwordhavenWalkGrid, SWORDHAVEN_INTERACTION_CELLS,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven magic guild side lancets', () => {
  it.each([true, false])('uses four pointed violet side bays on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const guild = scene.getObjectByName('swordhaven-building-swordhaven-magic');
    const lancets = guild?.getObjectByName('magic-guild-side-lancets');
    expect(lancets?.userData.chroniclesDecorativeOnly).toBe(true);
    const frames = lancets?.getObjectByName('magic-side-lancet-stone-frames');
    const panes = lancets?.getObjectByName('magic-side-lancet-violet-panes');
    const mullions = lancets?.getObjectByName('magic-side-lancet-brass-mullions');
    for (const batch of [frames, panes, mullions]) {
      expect(batch).toBeInstanceOf(THREE.InstancedMesh);
      expect(batch.count).toBe(4);
      expect(batch.userData.chroniclesDecorativeOnly).toBe(true);
    }
    expect(frames.geometry.type).toBe('ShapeGeometry');
    expect(panes.geometry.type).toBe('ShapeGeometry');
    expect(frames.castShadow).toBe(!coarsePointer);
    frames.geometry.computeBoundingBox();
    panes.geometry.computeBoundingBox();
    expect(frames.geometry.boundingBox.max.y).toBeGreaterThan(1.1);
    expect(panes.geometry.boundingBox.max.y).toBeGreaterThan(0.9);
    const matrix = new THREE.Matrix4();
    const positions = [];
    for (let index = 0; index < 4; index += 1) {
      frames.getMatrixAt(index, matrix);
      positions.push(new THREE.Vector3().setFromMatrixPosition(matrix));
      panes.getMatrixAt(index, matrix);
      const pane = new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(Math.abs(pane.x)).toBeGreaterThan(Math.abs(positions[index].x));
      expect(pane.y).toBeCloseTo(positions[index].y);
    }
    expect(positions[0].x).toBeLessThan(0);
    expect(positions[1].x).toBeLessThan(0);
    expect(positions[2].x).toBeGreaterThan(0);
    expect(positions[3].x).toBeGreaterThan(0);
    expect(positions[0].z).toBeLessThan(positions[1].z);
    expect(positions[2].z).toBeLessThan(positions[3].z);
    expect(guild.getObjectByName('shop-door')).toBeTruthy();
    expect(guild.getObjectByName('swordhaven-shop-nameplate')).toBeTruthy();
    for (const id of ['swordhaven-forge', 'swordhaven-armor', 'swordhaven-tavern']) {
      expect(scene.getObjectByName('swordhaven-building-' + id)
        ?.getObjectByName('magic-guild-side-lancets')).toBeFalsy();
    }
    const approach = SWORDHAVEN_INTERACTION_CELLS.find(cell => cell.id === 'swordhaven-magic');
    expect(createSwordhavenWalkGrid()[approach.y][approach.x]).toBe('.');
  });
});
