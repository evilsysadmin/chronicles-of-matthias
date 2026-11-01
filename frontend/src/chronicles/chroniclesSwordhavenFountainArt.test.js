import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenFountain, createSwordhavenMaterials } from './chroniclesSwordhaven3D.js';
import { dressSwordhavenTieredFountain, chroniclesFountainMotionEnabled } from './chroniclesSwordhavenFountainArt.js';
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
    expect(jets.geometry.parameters.radius).toBeLessThan(0.030);
    expect(jets.material).toBe(lowerWater.material);

    const ripples = tier.getObjectByName('fountain-water-impact-ripples');
    expect(ripples).toBeInstanceOf(THREE.InstancedMesh);
    expect(ripples.count).toBe(4);
    expect(ripples.geometry.type).toBe('TorusGeometry');
    expect(ripples.geometry.parameters.radius + ripples.geometry.parameters.tube)
      .toBeLessThan(0.12);
    expect(ripples.material.transparent).toBe(true);
    expect(ripples.material.opacity).toBeGreaterThan(0.5);
    expect(ripples.material.opacity).toBeLessThan(0.8);
    expect(ripples.material.depthWrite).toBe(false);
    expect(ripples.castShadow).toBe(false);
    expect(ripples.receiveShadow).toBe(false);
    expect(ripples.userData.chroniclesDecorativeOnly).toBe(true);
    const rippleMatrix = new THREE.Matrix4();
    for (let index = 0; index < ripples.count; index += 1) {
      ripples.getMatrixAt(index, rippleMatrix);
      const pos = new THREE.Vector3().setFromMatrixPosition(rippleMatrix);
      const radius = Math.hypot(pos.x, pos.z);
      // All rings are inside the unchanged basin, above the flat water disk.
      expect(radius).toBeCloseTo(1.3, 5);
      expect(radius + ripples.geometry.parameters.radius
        + ripples.geometry.parameters.tube).toBeLessThan(1.47);
      expect(pos.y).toBeGreaterThan(0.725);
      expect(pos.y).toBeLessThan(0.79);
    }
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

  it.each([true, false])('animates only decorative water without moving the physical fountain coarse=%s', (coarsePointer) => {
    const mats = createSwordhavenMaterials();
    const fountain = buildSwordhavenFountain(mats);
    const water = fountain.getObjectByName('fountain-water');
    const basinPosition = water.position.clone();
    const baseColor = water.material.color.getHex();
    const tier = dressSwordhavenTieredFountain(fountain, mats, { coarsePointer });
    const update = tier.userData.updateChroniclesFountainWater;
    const impact = tier.getObjectByName('fountain-water-impact-ripples');
    const pool = tier.getObjectByName('fountain-pool-soft-waves');
    const glints = tier.getObjectByName('fountain-jet-moving-glints');
    expect(typeof update).toBe('function');
    expect(pool).toBeInstanceOf(THREE.InstancedMesh);
    expect(pool.count).toBe(2);
    expect(glints).toBeInstanceOf(THREE.InstancedMesh);
    expect(glints.count).toBe(12);
    expect(pool.material).not.toBe(water.material);
    expect(glints.material).not.toBe(water.material);
    expect(pool.material.depthWrite).toBe(false);
    expect(glints.material.depthWrite).toBe(false);

    update(0.4);
    const first = [...glints.instanceMatrix.array];
    update(2.4);
    const later = [...glints.instanceMatrix.array];
    expect(later).not.toEqual(first);
    update(2.4);
    expect([...glints.instanceMatrix.array]).toEqual(later);
    expect(impact.instanceMatrix.needsUpdate).toBeUndefined(); // version tracks GPU uploads
    expect(impact.instanceMatrix.version).toBeGreaterThan(0);
    expect(pool.instanceMatrix.version).toBeGreaterThan(0);
    expect(glints.instanceMatrix.version).toBeGreaterThan(0);

    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    for (let index = 0; index < impact.count; index += 1) {
      impact.getMatrixAt(index, matrix);
      matrix.decompose(pos, quat, scale);
      expect(Math.hypot(pos.x, pos.z) + 0.112 * scale.x).toBeLessThan(1.47);
    }
    for (let index = 0; index < glints.count; index += 1) {
      glints.getMatrixAt(index, matrix);
      matrix.decompose(pos, quat, scale);
      expect(Math.hypot(pos.x, pos.z)).toBeLessThan(1.47);
      expect(pos.y).toBeGreaterThan(0.75);
      expect(pos.y).toBeLessThan(2.5);
    }
    expect(water.position).toEqual(basinPosition);
    expect(water.material.color.getHex()).toBe(baseColor);
    expect(tier.children.every(child => child.userData.chroniclesDecorativeOnly)).toBe(true);
    expect(tier.children.every(child => !child.isLight)).toBe(true);
  });

  it('wakes the water only nearby and visible, never with reduced motion', () => {
    const fountainPosition = new THREE.Vector3(0, 0, -8);
    const near = new THREE.Vector3(0, 1.62, 12);
    expect(chroniclesFountainMotionEnabled({
      partyPosition: near, fountainPosition,
    })).toBe(true);
    expect(chroniclesFountainMotionEnabled({
      partyPosition: new THREE.Vector3(0, 1.62, 30), fountainPosition,
    })).toBe(false);
    expect(chroniclesFountainMotionEnabled({
      partyPosition: near, fountainPosition, visible: false,
    })).toBe(false);
    expect(chroniclesFountainMotionEnabled({
      partyPosition: near, fountainPosition, reducedMotion: true,
    })).toBe(false);
    expect(chroniclesFountainMotionEnabled({ partyPosition: near })).toBe(false);
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
    expect(fountain.getObjectByName('fountain-water-impact-ripples')?.count).toBe(4);

    const otherScene = new THREE.Scene();
    buildChroniclesCampaignExterior(otherScene, {
      coarsePointer: true, scenePlan: { ...scenePlan, mapId: 'another-settlement' },
    });
    expect(otherScene.getObjectByName('swordhaven-fountain')).toBeTruthy();
    expect(otherScene.getObjectByName('swordhaven-fountain-upper-tier')).toBeFalsy();
    expect(otherScene.getObjectByName('fountain-water-impact-ripples')).toBeFalsy();
  });
});
