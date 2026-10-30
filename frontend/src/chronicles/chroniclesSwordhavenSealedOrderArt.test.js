import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven armory approach', () => {
  it('removes the generic stone pedestal but retains the sealed-order quest interaction', () => {
    const order = swordhaven.interactables.find(entry => entry.id === 'sealed-order');
    expect(order).toBeTruthy();
    expect(swordhaven.grid[order.y][order.x]).toBe('.');
    expect(order.action.effects).toContainEqual({
      type: 'set', key: 'commission-received', value: true,
    });

    const scene = new THREE.Scene();
    const result = buildChroniclesCampaignExterior(scene, {
      coarsePointer: true,
      scenePlan: {
        mapId: swordhaven.id, regionKind: swordhaven.regionKind,
        grid: swordhaven.grid, center: { x: 9, y: 7 },
        content: [{ ...order, position: { x: order.x, y: order.y } }],
        landscape: swordhaven.landscape,
      },
    });
    const anchor = scene.getObjectByName('chronicles-campaign-content-sealed-order');
    expect(anchor).toBeTruthy();
    expect(anchor.children).toHaveLength(0);
    expect(result.contentProps.find(prop => prop.id === order.id)?.root).toBe(anchor);
  });

  it('still renders generic stone markers for unrelated wilderness lore', () => {
    const scene = new THREE.Scene();
    buildChroniclesCampaignExterior(scene, {
      coarsePointer: true,
      scenePlan: {
        mapId: 'marker-regression', regionKind: 'wilderness',
        grid: ['#####', '#...#', '#...#', '#...#', '#####'],
        center: { x: 2, y: 2 },
        content: [{ id: 'milestone', kind: 'lore', position: { x: 2, y: 2 }, visible: true }],
      },
    });
    const marker = scene.getObjectByName('chronicles-campaign-content-milestone');
    expect(marker?.children.some(child => child.geometry?.type === 'CylinderGeometry')).toBe(true);
  });
});
