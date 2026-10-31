import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenHouse, createSwordhavenMaterials } from './chroniclesSwordhaven3D.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

function build(emblem, coarse) {
  const mats = createSwordhavenMaterials();
  return buildSwordhavenHouse({
    id: 'premium-test-' + emblem, x: 9, y: 11, roof: 0x79513b,
    emblem, label: emblem === 'civic' ? 'AYUNTAMIENTO' : undefined,
  }, mats, coarse, new Set(), { x: 9, y: 11 });
}

describe('Swordhaven approved town-square house treatment', () => {
  it.each([true, false])('keeps residential shutters and roof details decorative on coarse=%s', (coarse) => {
    const { root, sign, interactive } = build('home', coarse);
    const facade = root.getObjectByName('swordhaven-home-premium-frontage');
    expect(sign).toBeNull();
    expect(interactive).toBe(false);
    expect(facade?.userData.chroniclesDecorativeOnly).toBe(true);
    const shutterPanels = facade.getObjectByName('premium-oak-window-shutters');
    const ironStraps = facade.getObjectByName('premium-shutter-iron-straps');
    const braces = facade.getObjectByName('premium-shutter-cross-braces');
    const cages = facade.getObjectByName('premium-forged-lantern-bars');
    expect(shutterPanels).toBeInstanceOf(THREE.InstancedMesh);
    expect(shutterPanels.count).toBe(4);
    expect(ironStraps.count).toBe(8);
    expect(braces.count).toBe(4);
    expect(cages.count).toBe(8);
    expect(facade.children.filter(node => node.name === 'premium-oak-gable-rake')).toHaveLength(2);
    expect(facade.getObjectByName('home-carved-door-hood')).toBeTruthy();
    expect(facade.getObjectByName('civic-portal-carved-lintel')).toBeFalsy();
    expect(facade.children.every(node => node.userData.chroniclesDecorativeOnly)).toBe(true);
    expect(shutterPanels.castShadow).toBe(!coarse);
    // The four open shutters sit beside the existing windows, not over glass.
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < shutterPanels.count; index += 1) {
      shutterPanels.getMatrixAt(index, matrix);
      const p = new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(Math.abs(p.x)).toBeGreaterThan(1.35);
      expect(Math.abs(p.x)).toBeLessThan(4.05);
      expect(p.z).toBeLessThan(4.20);
      expect(p.y).toBeCloseTo(2.75);
    }
    expect(root.getObjectByName('warm-glass-window')).toBeTruthy();
    expect(root.getObjectByName('shop-door')).toBeTruthy();
  });

  it('gives the mayor a carved stone entrance and heraldry, without covering the real sign', () => {
    const { root, sign } = build('civic', false);
    const facade = root.getObjectByName('swordhaven-civic-premium-frontage');
    expect(facade).toBeTruthy();
    expect(facade.children.filter(node => node.name === 'civic-portal-ashlar-pier')).toHaveLength(2);
    expect(facade.getObjectByName('civic-portal-carved-lintel')).toBeTruthy();
    expect(facade.getObjectByName('civic-door-ring-knocker')).toBeTruthy();
    expect(facade.children.filter(node => node.name === 'civic-pennant-gold-tower')).toHaveLength(2);
    expect(facade.getObjectByName('home-carved-door-hood')).toBeFalsy();
    expect(sign).toBeTruthy();
    expect(root.getObjectByName('swordhaven-shop-nameplate')?.userData.shopLabel).toBe('AYUNTAMIENTO');
    expect(root.getObjectByName('shop-door')).toBeTruthy();
    expect(root.getObjectByName('shop-pennant-left')).toBeTruthy();
    expect(root.getObjectByName('shop-pennant-right')).toBeTruthy();
  });

  it('wires the actual authored Swordhaven hall and homes, not only a standalone mock', () => {
    const scene = new THREE.Scene();
    const content = [...swordhaven.interactables, ...swordhaven.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
    buildChroniclesCampaignExterior(scene, {
      coarsePointer: true,
      scenePlan: {
        mapId: swordhaven.id, regionKind: swordhaven.regionKind,
        width: swordhaven.grid[0].length, height: swordhaven.grid.length,
        center: { x: 9, y: 11 }, grid: swordhaven.grid,
        content, landscape: swordhaven.landscape,
      },
    });
    const town = scene.getObjectByName('chronicles-campaign-town');
    const hall = town.children.find(child => child.name.startsWith('swordhaven-building-first-book-hall-'));
    const houses = town.children.filter(child => child.name.startsWith('swordhaven-building-first-book-home-'));
    expect(hall?.getObjectByName('swordhaven-civic-premium-frontage')).toBeTruthy();
    expect(houses.length).toBeGreaterThan(0);
    expect(houses.every(house => house.getObjectByName('swordhaven-home-premium-frontage'))).toBe(true);
    expect(houses.every(house => !house.getObjectByName('swordhaven-shop-nameplate'))).toBe(true);
    expect(scene.getObjectByName('chronicles-town-notice-board')).toBeTruthy();
    expect(hall.getObjectByName('swordhaven-civic-premium-frontage').userData.chroniclesDecorativeOnly).toBe(true);
  });
});
