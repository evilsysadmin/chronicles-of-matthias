import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_MATERIAL_ENVIRONMENTS,
  chroniclesMaterialEnvironmentForMapId,
  chroniclesMaterialPlanForScene,
} from './chroniclesMaterialAtlas.js';

describe('Chronicles material continuity across deeper dungeon floors', () => {
  it.each([
    ['torre-de-los-nombres-level-2', 'castle-interior'],
    ['salinas-hundidas-level-2', 'cave-water'],
    ['minas-de-escoria-level-3', 'iron-foundry'],
    ['gallery-of-forks-floor-4', 'castle-interior'],
    ['hollow-bell-tower-level-2', 'exterior'],
    ['swordhaven-sewers-level-2', 'sewer-masonry'],
    // Multi-stage procedural descendants must inherit the original authored
    // biome, even when the Spanish map id has no English fallback keyword.
    ['torre-de-los-nombres-level-2-floor-3', 'castle-interior'],
    ['salinas-hundidas-floor-2-level-3', 'cave-water'],
    ['minas-de-escoria-level-2-floor-4', 'iron-foundry'],
  ])('%s inherits the canonical map biome (%s)', (mapId, expected) => {
    expect(chroniclesMaterialEnvironmentForMapId(mapId)).toBe(expected);
    const scene = chroniclesMaterialPlanForScene({ mapId, width: 9, height: 9 });
    expect(scene.environmentId).toBe(expected);
    scene.wallProfileIds.forEach((profile) => {
      expect(CHRONICLES_MATERIAL_ENVIRONMENTS[expected].wall).toContain(profile);
    });
    scene.floorProfileIds.forEach((profile) => {
      expect(CHRONICLES_MATERIAL_ENVIRONMENTS[expected].floor).toContain(profile);
    });
  });

  it('does not let an unknown deeper floor borrow the palette of an unrelated map', () => {
    expect(chroniclesMaterialEnvironmentForMapId('unknown-cavern-level-2')).toBe('cave');
    expect(chroniclesMaterialEnvironmentForMapId('unknown-tower-level-2')).toBe('exterior');
  });
});
