import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenHouse, createSwordhavenMaterials, SWORDHAVEN_BUILDINGS,
} from './chroniclesSwordhaven3D.js';
import { dressSwordhavenTavernRoofDormer } from './chroniclesSwordhavenTavernRoofArt.js';

describe('Swordhaven inn roof silhouette', () => {
  it.each([false, true])('adds one decorative gabled dormer on the tavern (coarse=%s)', coarse => {
    const mats = createSwordhavenMaterials();
    const tavern = buildSwordhavenHouse(
      SWORDHAVEN_BUILDINGS.find(building => building.id === 'swordhaven-tavern'),
      mats, coarse, new Set(), { x: 9, y: 9 },
    );
    const dormer = tavern.getObjectByName('tavern-front-roof-dormer');
    expect(dormer).toBeInstanceOf(THREE.Group);
    expect(dormer.userData.chroniclesDecorativeOnly).toBe(true);
    expect(dormer.getObjectByName('tavern-dormer-attic-body')).toBeTruthy();
    expect(dormer.getObjectByName('tavern-dormer-front-gable')).toBeTruthy();
    expect(dormer.getObjectByName('tavern-dormer-amber-window').material).toBe(mats.window);
    expect(dormer.children.filter(child => child.name === 'tavern-dormer-roof-slope')).toHaveLength(2);
    expect(dormer.children.every(child => child.userData.chroniclesDecorativeOnly)).toBe(true);
    expect(dormer.children.every(child => !child.isLight)).toBe(true);
    expect(tavern.getObjectByName('shop-door')).toBeTruthy();
    expect(tavern.getObjectByName('tavern-oak-entrance')).toBeTruthy();
    const localBounds = new THREE.Box3().setFromObject(dormer);
    // Subtract world position: decorative roof remains in the blocked 3x3 grid.
    localBounds.translate(tavern.position.clone().negate());
    expect(localBounds.min.y).toBeGreaterThan(5.7);
    expect(localBounds.max.y).toBeGreaterThan(8.5);
    expect(localBounds.max.y).toBeLessThan(9.5);
    expect(localBounds.min.x).toBeGreaterThan(-4.05);
    expect(localBounds.max.x).toBeLessThan(4.05);
    expect(localBounds.max.z).toBeLessThan(6);
  });

  it('never adds the inn dormer to the forge, armory, guild or temple', () => {
    const mats = createSwordhavenMaterials();
    for (const spec of SWORDHAVEN_BUILDINGS.filter(item => item.id !== 'swordhaven-tavern')) {
      const house = buildSwordhavenHouse(spec, mats, true, new Set(), { x: 9, y: 9 });
      expect(house.getObjectByName('tavern-front-roof-dormer')).toBeNull();
    }
  });

  it('is idempotent when the decorative dressing is requested again', () => {
    const root = new THREE.Group();
    const mats = createSwordhavenMaterials();
    const args = { width: 8.1, depth: 8.2, height: 5.7,
      roof: mats.roof, wallMaterial: mats.plaster, mats, coarse: true };
    const first = dressSwordhavenTavernRoofDormer(root, args);
    expect(dressSwordhavenTavernRoofDormer(root, args)).toBe(first);
    expect(root.children).toHaveLength(1);
  });
});
