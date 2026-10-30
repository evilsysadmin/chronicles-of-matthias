import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, createSwordhavenWalkGrid, SWORDHAVEN_INTERACTION_CELLS,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven forge front gable architecture', () => {
  it.each([false, true])('keeps an oak truss and iron smoke louver clear of the shop sign on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const forge = scene.getObjectByName('swordhaven-building-swordhaven-forge');
    const truss = forge.getObjectByName('forge-front-oak-gable-truss');
    const louver = forge.getObjectByName('forge-front-gable-smoke-louver');
    const rafters = truss?.children.filter(child => child.name === 'forge-gable-raking-oak-rafter');
    const slats = louver?.children.filter(child => child.name === 'forge-gable-iron-louver-slat');
    expect(truss?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(louver?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(rafters).toHaveLength(2);
    expect(slats).toHaveLength(3);
    expect(louver.getObjectByName('forge-gable-dark-vent')).toBeTruthy();
    expect(louver.children.filter(child => child.name === 'forge-gable-iron-jamb')).toHaveLength(2);
    expect(louver.children.filter(child => child.name === 'forge-gable-iron-lintel')).toHaveLength(2);
    for (const rafter of rafters) {
      expect(rafter.castShadow).toBe(!coarsePointer);
      expect(Math.abs(rafter.rotation.z)).toBeCloseTo(1.16);
      expect(rafter.position.z).toBeGreaterThan(forge.getObjectByName('shop-door').position.z);
      expect(Math.abs(rafter.position.x) + 0.12).toBeLessThan(6);
    }
    expect(rafters[0].position.x).toBeLessThan(0);
    expect(rafters[1].position.x).toBeGreaterThan(0);
    for (const slat of slats) expect(slat.castShadow).toBe(!coarsePointer);
    const nameplate = forge.getObjectByName('swordhaven-shop-nameplate');
    const heraldry = forge.getObjectByName('swordhaven-interaction-swordhaven-forge');
    expect(louver.position.y - 0.42).toBeGreaterThan(heraldry.position.y + 0.7);
    expect(louver.position.y).toBeGreaterThan(nameplate.position.y + 1.0);
    expect(louver.position.y + 0.42).toBeLessThan(forge.getObjectByName('ridge-timber').position.y);
    expect(louver.position.z).toBeGreaterThan(forge.getObjectByName('shop-door').position.z);
    for (const id of ['swordhaven-armor', 'swordhaven-tavern', 'swordhaven-magic']) {
      const building = scene.getObjectByName('swordhaven-building-' + id);
      expect(building?.getObjectByName('forge-front-oak-gable-truss')).toBeFalsy();
      expect(building?.getObjectByName('forge-front-gable-smoke-louver')).toBeFalsy();
    }
    const approach = SWORDHAVEN_INTERACTION_CELLS.find(cell => cell.id === 'swordhaven-forge');
    expect(createSwordhavenWalkGrid()[approach.y][approach.x]).toBe('.');
  });
});
