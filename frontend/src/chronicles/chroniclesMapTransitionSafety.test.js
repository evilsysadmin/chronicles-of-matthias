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

  it('keeps cleared switches and collected treasures when revisiting dungeon floors after save recovery', () => {
    const initial = createChroniclesState('gallery-of-forks');
    expect(initial.galleryLeverPulled).toBe(false);
    expect(initial.galleryRelicCollected).toBe(false);

    const cleared = chroniclesApplyContentEffects(initial, [
      { type: 'set', key: 'galleryLeverPulled', value: true },
      { type: 'set', key: 'galleryRelicCollected', value: true },
    ]);
    const nextFloor = chroniclesMapTransitionState(cleared, 'menagerie-of-ash');
    expect(nextFloor.emberCacheOpened).toBe(false);

    const lootedNextFloor = { ...nextFloor, emberCacheOpened: true };
    const restored = JSON.parse(JSON.stringify(lootedNextFloor));
    const returned = chroniclesMapTransitionState(restored, 'gallery-of-forks');
    expect(returned.galleryLeverPulled).toBe(true);
    expect(returned.galleryRelicCollected).toBe(true);

    const revisitNextFloor = chroniclesMapTransitionState(returned, 'menagerie-of-ash');
    expect(revisitNextFloor.emberCacheOpened).toBe(true);
  });

  it('isolates identical flag names across different dungeon maps', () => {
    const crypt = createChroniclesState('crypt-eight-squares');
    expect(crypt.sigilAwake).toBe(false);
    const gallery = chroniclesMapTransitionState(crypt, 'gallery-of-forks');
    expect(gallery.sigilAwake).toBe(true);
    expect(chroniclesMapTransitionState(gallery, 'crypt-eight-squares').sigilAwake).toBe(false);
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
