import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';

describe('Chronicles MM3 explicit area transition safety', () => {
  it('rejects an unknown destination instead of silently sending the party to the default crypt', () => {
    const state = createChroniclesState('swordhaven-first-book');
    const originalMapId = state.mapId;

    expect(() => chroniclesMapTransitionState(state, 'retired-map'))
      .toThrow(/unknown destination map retired-map/i);
    expect(() => chroniclesApplyContentEffects(state, [
      { type: 'transition-map', mapId: 'retired-map' },
    ])).toThrow(/unknown destination map retired-map/i);
    expect(state.mapId).toBe(originalMapId);
  });

  it('keeps valid dungeon travel and legacy saved-map lookup behavior unchanged', () => {
    const state = createChroniclesState('swordhaven-first-book');
    const arrived = chroniclesMapTransitionState(state, 'swordhaven-sewers');

    expect(arrived.mapId).toBe('swordhaven-sewers');
    expect(arrived.phase).toBe('explore');
    expect(arrived.party).toEqual(state.party);
    // A removed map in an old save may still use the catalog's fallback;
    // only explicit travel destinations must be strictly validated.
    expect(chroniclesMapById('retired-map').id).toBe('crypt-eight-squares');
  });
});
