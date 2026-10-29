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

  it('does not carry a cleared floor switch into an unrelated dungeon', () => {
    const gallery = chroniclesApplyContentEffects(createChroniclesState('gallery-of-forks'), [
      { type: 'set', key: 'galleryLeverPulled', value: true },
      { type: 'set', key: 'galleryRelicCollected', value: true },
    ]);
    const menagerie = chroniclesMapTransitionState(gallery, 'menagerie-of-ash');
    expect(menagerie).not.toHaveProperty('galleryLeverPulled');
    expect(menagerie).not.toHaveProperty('galleryRelicCollected');
    expect(menagerie.mapFlagsById['gallery-of-forks']).toMatchObject({
      galleryLeverPulled: true,
      galleryRelicCollected: true,
    });
    expect(menagerie.party).toEqual(gallery.party);

    const clearedMenagerie = { ...menagerie, emberCacheOpened: true };
    const returned = chroniclesMapTransitionState(
      JSON.parse(JSON.stringify(clearedMenagerie)), 'gallery-of-forks',
    );
    expect(returned.galleryLeverPulled).toBe(true);
    expect(returned.galleryRelicCollected).toBe(true);
    expect(returned).not.toHaveProperty('emberCacheOpened');

    const revisited = chroniclesMapTransitionState(returned, 'menagerie-of-ash');
    expect(revisited.emberCacheOpened).toBe(true);
    expect(revisited).not.toHaveProperty('galleryLeverPulled');
  });

  it('isolates identical flag names across different dungeon maps', () => {
    const crypt = createChroniclesState('crypt-eight-squares');
    expect(crypt.sigilAwake).toBe(false);
    const gallery = chroniclesMapTransitionState(crypt, 'gallery-of-forks');
    expect(gallery.sigilAwake).toBe(true);
    expect(chroniclesMapTransitionState(gallery, 'crypt-eight-squares').sigilAwake).toBe(false);
  });

  it('restores only authored flags from a damaged destination floor snapshot', () => {
    const source = createChroniclesState('gallery-of-forks');
    const corrupted = JSON.parse(JSON.stringify({
      ...source,
      mapFlagsById: {
        'menagerie-of-ash': {
          emberCacheOpened: true,
          x: 999, y: 999, direction: 99,
          mapId: 'crypt-eight-squares',
          party: [], phase: 'game-over',
          galleryLeverPulled: true,
        },
      },
    }));
    const destination = chroniclesMapById('menagerie-of-ash');
    const arrived = chroniclesMapTransitionState(corrupted, destination.id);

    expect(arrived).toMatchObject({
      mapId: destination.id,
      x: destination.partyStart.x,
      y: destination.partyStart.y,
      direction: destination.partyStart.direction,
      phase: 'explore',
      emberCacheOpened: true,
    });
    expect(arrived.party).toEqual(corrupted.party);
    expect(arrived).not.toHaveProperty('galleryLeverPulled');
    expect(corrupted.mapFlagsById['menagerie-of-ash'].x).toBe(999);
  });

  it('ignores malformed legacy floor flag ledgers and snapshots', () => {
    const source = createChroniclesState('gallery-of-forks');
    for (const mapFlagsById of [
      'corrupt-ledger',
      ['corrupt-ledger'],
      { 'menagerie-of-ash': ['corrupt-snapshot'] },
      { 'menagerie-of-ash': 'corrupt-snapshot' },
    ]) {
      const arrived = chroniclesMapTransitionState({ ...source, mapFlagsById }, 'menagerie-of-ash');
      expect(arrived.emberCacheOpened).toBe(false);
      expect(arrived.party).toEqual(source.party);
      expect(arrived.x).toBe(chroniclesMapById('menagerie-of-ash').partyStart.x);
      expect(Object.keys(arrived.mapFlagsById).every((key) => !/^[0-9]+$/.test(key))).toBe(true);
    }
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
