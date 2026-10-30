import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven botica greenhouse silhouette', () => {
  it.each([true, false])('keeps a pitched translucent conservatory and the original door at coarse=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    const content = [...swordhaven.interactables, ...swordhaven.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y } }));
    buildChroniclesCampaignExterior(scene, {
      coarsePointer,
      scenePlan: {
        mapId: swordhaven.id,
        regionKind: 'settlement',
        width: swordhaven.grid[0].length,
        height: swordhaven.grid.length,
        center: { x: 9, y: 7 },
        grid: swordhaven.grid,
        content,
        landscape: swordhaven.landscape,
      },
    });

    const town = scene.getObjectByName('chronicles-campaign-town');
    const botica = town.children.find(child => child.name.includes('-apothecary-'));
    const greenhouse = botica?.getObjectByName('apothecary-roof-herbarium');
    const roofPanes = greenhouse?.children.filter(child => child.name === 'herbarium-glazed-roof');
    const rafters = greenhouse?.children.filter(child => child.name === 'herbarium-roof-rafter');
    expect(greenhouse?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(roofPanes).toHaveLength(2);
    expect(rafters).toHaveLength(2);
    expect(roofPanes.map(pane => pane.rotation.z)).toEqual([0.67, -0.67]);
    expect(roofPanes.every(pane => pane.position.y === 1.94)).toBe(true);
    expect(roofPanes.every(pane => pane.material.transparent && pane.material.opacity === 0.58
      && pane.material.depthWrite === false)).toBe(true);
    expect(rafters.map(rafter => rafter.rotation.z)).toEqual([0.67, -0.67]);
    const mullions = greenhouse.children.filter(child =>
      child.name === 'herbarium-roof-glazing-mullion');
    expect(mullions).toHaveLength(4);
    expect(mullions.every(bar => bar.userData.chroniclesDecorativeOnly)).toBe(true);
    expect(mullions.every(bar => bar.material === rafters[0].material)).toBe(true);
    expect(mullions.map(bar => bar.rotation.z)).toEqual([0.67, 0.67, -0.67, -0.67]);
    expect(mullions.map(bar => Number(bar.position.x.toFixed(2))))
      .toEqual([-0.38, -1.06, 0.38, 1.06]);
    expect(mullions.every(bar => bar.position.y > 1.7 && bar.position.y < 2.4))
      .toBe(true);
    expect(mullions.every(bar => bar.geometry.parameters.depth === 2.34)).toBe(true);
    expect(greenhouse.getObjectByName('herbarium-roof-ridge').position.y).toBe(2.55);
    const terrace = botica.getObjectByName('apothecary-herbarium-stone-terrace');
    expect(terrace?.userData.chroniclesDecorativeOnly).toBe(true);
    // The greenhouse must read as a substantial roof volume on mobile,
    // but its terrace and timber posts stay within the authored solid house.
    expect(greenhouse.scale.x).toBeGreaterThan(1.6);
    expect(greenhouse.scale.y).toBeGreaterThan(1.2);
    expect(terrace.geometry.parameters.width).toBeGreaterThan(2 * 1.38 * greenhouse.scale.x);
    expect(terrace.geometry.parameters.depth).toBeGreaterThan(2 * 1.07 * greenhouse.scale.z);
    expect(terrace.geometry.parameters.width).toBeLessThan(8.1);
    expect(terrace.geometry.parameters.depth).toBeLessThan(7.1);
    expect(botica.getObjectByName('shop-door')).toBeTruthy();
  });
});
