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
});
