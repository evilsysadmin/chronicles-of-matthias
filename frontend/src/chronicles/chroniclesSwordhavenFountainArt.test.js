import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenFountain, createSwordhavenMaterials } from './chroniclesSwordhaven3D.js';
import { dressSwordhavenTieredFountain } from './chroniclesSwordhavenFountainArt.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven First Book plaza fountain', () => {
  it.each([true, false])('adds a readable second stone bowl and four shared jets on coarse=%s', (coarsePointer) => {
    const mats = createSwordhavenMaterials();
    const fountain = buildSwordhavenFountain(mats);
    const lowerBasin = fountain.getObjectByName('fountain-basin');
    const lowerWater = fountain.getObjectByName('fountain-water');
    const tier = dressSwordhavenTieredFountain(fountain, mats, { coarsePointer });
    expect(tier.name).toBe('swordhaven-fountain-upper-tier');
    expect(tier.userData.chroniclesDecorativeOnly).toBe(true);
    expect(dressSwordhavenTieredFountain(fountain, mats, { coarsePointer })).toBe(tier);
    expect(fountain.getObjectByName('fountain-basin')).toBe(lowerBasin);
    expect(fountain.getObjectByName('fountain-water')).toBe(lowerWater);

    const bowl = tier.getObjectByName('fountain-upper-stone-bowl');
    const upperWater = tier.getObjectByName('fountain-upper-water');
    const lip = tier.getObjectByName('fountain-upper-carved-lip');
    const crown = tier.getObjectByName('fountain-gilded-finial');
    const jets = tier.getObjectByName('fountain-four-water-jets');
    expect(bowl.geometry.parameters.radiusTop).toBeCloseTo(0.72);
    expect(bowl.material).toBe(mats.stone);
    expect(upperWater.material).toBe(lowerWater.material);
    expect(lip.rotation.x).toBeCloseTo(Math.PI / 2);
    expect(crown.material).toBe(mats.gold);
    expect(jets).toBeInstanceOf(THREE.InstancedMesh);
    expect(jets.count).toBe(4);
    expect(jets.geometry.type).toBe('TubeGeometry');
    expect(jets.material).toBe(lowerWater.material);
    expect(jets.castShadow).toBe(false);
    expect(tier.children.every(child => child.userData.chroniclesDecorativeOnly)).toBe(true);
    expect(tier.children.every(child => !child.isLight)).toBe(true);

    const matrix = new THREE.Matrix4();
    const origin = new THREE.Vector3(1, 0, 0);
    const directions = [];
    for (let index = 0; index < jets.count; index += 1) {
      jets.getMatrixAt(index, matrix);
      const direction = origin.clone().transformDirection(matrix);
      // Quarter-turn matrices can produce -0 for a direction component.
      directions.push([Math.round(direction.x) || 0, Math.round(direction.z) || 0]);
    }
    expect(directions).toEqual([[1, 0], [0, -1], [-1, 0], [0, 1]]);
    const bounds = new THREE.Box3().setFromObject(fountain);
    // Outer rim never extends beyond the one blocked 4 × 4 m tile;
    // upper tier rises above the existing 2.2m plain pedestal.
    expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThan(2);
    expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThan(2);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(bounds.max.y).toBeGreaterThan(3);
    expect(bounds.max.y).toBeLessThan(3.5);
  });

  it('dresses only the actual First Book fountain at the authored blocked plaza cell', () => {
    const content = [...swordhaven.interactables, ...swordhaven.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
    const scenePlan = {
      mapId: swordhaven.id, regionKind: swordhaven.regionKind,
      width: swordhaven.grid[0].length, height: swordhaven.grid.length,
      center: { x: 9, y: 11 }, grid: swordhaven.grid,
      content, landscape: swordhaven.landscape,
    };
    const scene = new THREE.Scene();
    buildChroniclesCampaignExterior(scene, { coarsePointer: true, scenePlan });
    const fountain = scene.getObjectByName('swordhaven-fountain');
    expect(swordhaven.grid[9][9]).toBe('#');
    expect(fountain).toBeTruthy();
    expect(fountain.position.x).toBe(0);
    expect(fountain.position.z).toBe(-8);
    expect(fountain.getObjectByName('swordhaven-fountain-upper-tier')).toBeTruthy();

    const otherScene = new THREE.Scene();
    buildChroniclesCampaignExterior(otherScene, {
      coarsePointer: true, scenePlan: { ...scenePlan, mapId: 'another-settlement' },
    });
    expect(otherScene.getObjectByName('swordhaven-fountain')).toBeTruthy();
    expect(otherScene.getObjectByName('swordhaven-fountain-upper-tier')).toBeFalsy();
  });
});
