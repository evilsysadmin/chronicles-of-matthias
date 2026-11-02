import { describe, expect, it } from 'vitest';
import {
  chroniclesMaterialPlanForScene,
  chroniclesMaterialSceneSeed,
} from './chroniclesMaterialAtlas.js';

describe('Chronicles procedural material seed · repeated geometry cells', () => {
  it('uses the actual occupied cells, not how often a geometry pass enumerates them', () => {
    const scene = {
      mapId: 'crypt-eight-squares',
      width: 7,
      height: 7,
      walls: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
      floors: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    };
    const duplicated = {
      ...scene,
      walls: [scene.walls[2], ...scene.walls, scene.walls[0]],
      floors: [...scene.floors, scene.floors[1], scene.floors[0]],
    };

    expect(chroniclesMaterialSceneSeed(duplicated))
      .toBe(chroniclesMaterialSceneSeed(scene));
    expect(chroniclesMaterialPlanForScene(duplicated))
      .toEqual(chroniclesMaterialPlanForScene(scene));

    // A genuinely new occupied cell must still change the material seed.
    expect(chroniclesMaterialSceneSeed({
      ...duplicated,
      walls: [...duplicated.walls, { x: 3, y: 0 }],
    })).not.toBe(chroniclesMaterialSceneSeed(scene));
  });
  it('ignores invalid procedural cells without crashing or re-rolling the valid palette', () => {
    const scene = {
      mapId: 'salinas-hundidas-level-2',
      width: 8,
      height: 8,
      walls: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      floors: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    };
    const damaged = {
      ...scene,
      walls: [null, {}, { x: NaN, y: 0 }, { x: Infinity, y: 0 },
        { x: '1', y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }, ...scene.walls],
      floors: [undefined, { x: 1, y: 1.5 }, { x: -2, y: 1 }, ...scene.floors],
    };
    expect(chroniclesMaterialSceneSeed(damaged)).toBe(chroniclesMaterialSceneSeed(scene));
    expect(chroniclesMaterialPlanForScene(damaged)).toEqual(chroniclesMaterialPlanForScene(scene));
    expect(chroniclesMaterialSceneSeed({ ...scene, walls: { corrupt: true }, floors: null }))
      .toBe(chroniclesMaterialSceneSeed({ ...scene, walls: [], floors: [] }));
    // A new valid tile still changes the seed; corruption must not erase
    // legitimate variation between different dungeon layouts.
    expect(chroniclesMaterialSceneSeed({
      ...damaged, walls: [...damaged.walls, { x: 2, y: 0 }],
    })).not.toBe(chroniclesMaterialSceneSeed(scene));
  });
});