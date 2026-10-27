import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesTownNoticeBoard } from './chroniclesTownNoticeBoard3D.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven estandarte notice board', () => {
  it('renders a legible timber notice board with real posted writs, not a generic stone marker', () => {
    const root = new THREE.Group();
    const board = buildChroniclesTownNoticeBoard(root);
    expect(root.children).toEqual([board]);
    expect(board.name).toBe('chronicles-town-notice-board');
    expect(board.userData.chroniclesDecorativeOnly).toBe(true);
    expect(board.getObjectByName('notice-board-post')).toBeTruthy();
    expect(board.getObjectByName('notice-board-roof')).toBeTruthy();
    expect(board.children.filter(child => child.name === 'notice-board-parchment')).toHaveLength(3);
    expect(board.children.filter(child => child.name === 'notice-board-wax-seal')).toHaveLength(3);
    const lettering = board.getObjectByName('notice-board-lettering');
    expect(lettering.userData.noticeBoardTitle).toBe('EDICTOS Y ENCARGOS');
    expect(lettering.material.map).toBeInstanceOf(THREE.DataTexture);
    expect(lettering.material.map.image.data.some(v => v === 244)).toBe(true);
    const bounds = new THREE.Box3().setFromObject(board);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(3.1);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(1);
    expect(bounds.max.y).toBeLessThan(3.3);
    expect(bounds.min.y).toBeGreaterThan(-1e-6); // Float32 bounds at ground level.
  });

  it('keeps the quest usable from a walkable cell next to the south wall, away from the shop doorway', () => {
    const notice = swordhaven.interactables.find(entry => entry.id === 'first-book-missing-board');
    expect(notice).toMatchObject({
      kind: 'lore', x: 12, y: 10, visualType: 'notice-board', visualFacing: 0,
    });
    expect(swordhaven.grid[notice.y][notice.x]).toBe('.');
    expect(swordhaven.grid[notice.y + 1][notice.x]).toBe('#');
    expect(notice.action.effects).toContainEqual({
      type: 'start-quest', questId: 'banner-contract',
      title: 'El estandarte perdido',
      description: 'Un explorador no regresó del Camino de los Estandartes.',
      objective: 'Busca el estandarte cerca del mojón sin nombre.',
      order: 2,
    });
    const scene = new THREE.Scene();
    const content = swordhaven.interactables.map(entry => ({
      ...entry, position: { x: entry.x, y: entry.y },
    }));
    const center = { x: 9, y: 7 };
    const result = buildChroniclesCampaignExterior(scene, {
      coarsePointer: true,
      scenePlan: {
        mapId: swordhaven.id, regionKind: 'settlement',
        grid: swordhaven.grid, center, content, landscape: swordhaven.landscape,
      },
    });
    const root = scene.getObjectByName('chronicles-campaign-content-first-book-missing-board');
    expect(root).toBeTruthy();
    expect(root.getObjectByName('chronicles-town-notice-board')).toBeTruthy();
    expect(root.children.some(child => child.geometry?.type === 'CylinderGeometry')).toBe(false);
    expect(root.position.x).toBeCloseTo((notice.x - center.x) * 4);
    expect(root.position.z).toBeCloseTo((notice.y - center.y) * 4 + 1.72);
    expect(root.rotation.y).toBeCloseTo(Math.PI);
    expect(result.contentProps.some(prop => prop.id === notice.id && prop.root === root)).toBe(true);
  });
});
