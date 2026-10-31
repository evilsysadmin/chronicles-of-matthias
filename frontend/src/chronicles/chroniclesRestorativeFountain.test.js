import { describe, expect, it } from 'vitest';
import { chroniclesMapById, chroniclesMapRenderPlan } from './chroniclesMapCatalog.js';
import { chroniclesFirstPersonScenePlan } from './chroniclesFirstPersonScenePlan.js';
import { chroniclesIsRestorativeFountain } from './chroniclesRestorativeFountain.js';
import { chroniclesContentVisualStateById } from './chroniclesContentVisualState.js';

describe('Genuine restorative Terra fountains', () => {
  it('classifies all six healing fountains by authored effects, not the generic shrine visual', () => {
    const areas = ['b2', 'e1', 'b5', 'f3', 'a6', 'e6'];
    for (const area of areas) {
      const map = chroniclesMapById(`terra-${area}`);
      const fountain = map.interactables.find((entry) => entry.id === `terra-${area}-shrine`);
      expect(chroniclesIsRestorativeFountain(fountain)).toBe(true);
      expect(chroniclesMapRenderPlan(map).content.find((entry) => entry.id === fountain.id)?.visualType)
        .toBe('restorative-fountain');
    }
  });

  it('never turns the Wind Matron bird nest or other quest shrines into a basin', () => {
    const map = chroniclesMapById('terra-b2');
    const nest = map.interactables.find((entry) => entry.id === 'b2-wind-nest');
    expect(nest.visualType).toBe('shrine');
    expect(chroniclesIsRestorativeFountain(nest)).toBe(false);
    expect(chroniclesMapRenderPlan(map).content.find((entry) => entry.id === nest.id)?.visualType).toBe('shrine');
    expect(chroniclesIsRestorativeFountain({
      kind: 'lore', visualType: 'shrine',
      when: [{ key: 'used', falsy: true }],
      action: { effects: [{ type: 'heal-party', amount: 8 }, { type: 'restore-spell-points' }] },
    })).toBe(false); // No durable receipt.
    expect(chroniclesIsRestorativeFountain(null)).toBe(false);
  });

  it('keeps used fountains physically present but without claimable water', () => {
    const map = chroniclesMapById('terra-b2');
    const first = chroniclesContentVisualStateById({ mapId: map.id }, 'terra-b2-shrine', map);
    expect(first).toMatchObject({ kind: 'lore', available: true, visible: true, activated: false });
    const used = chroniclesContentVisualStateById({
      mapId: map.id, terra_b2ShrineUsed: true,
    }, 'terra-b2-shrine', map);
    expect(used).toMatchObject({ kind: 'lore', available: false, visible: true, activated: true });
    expect(chroniclesFirstPersonScenePlan({ mapId: map.id }).content)
      .toEqual(expect.arrayContaining([expect.objectContaining({
        id: 'terra-b2-shrine', visualType: 'restorative-fountain',
      })]));
    // A used quest shrine retains its old visibility contract.
    expect(chroniclesContentVisualStateById({
      mapId: map.id, b2WindMatronGone: true,
    }, 'b2-wind-nest', map).visible).toBe(false);
  });
});
