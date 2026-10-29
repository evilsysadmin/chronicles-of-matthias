import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects, chroniclesContentInteractions, chroniclesRequirementsMet } from './chroniclesContentRuntime.js';
import { chroniclesMapById, chroniclesMapInitialEnemyState, chroniclesMapTileAt, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';

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

  it('recovers dungeon travel from non-array or malformed slain enemy ledgers', () => {
    const source = createChroniclesState('gallery-of-forks');
    for (const slainEnemies of [
      'broken-ledger',
      ['broken-ledger'],
      { 'gallery-of-forks': 'broken-entry' },
      { 'gallery-of-forks': { 0: true } },
      { 'menagerie-of-ash': { 0: true } },
      { 'menagerie-of-ash': null },
    ]) {
      const arrived = chroniclesMapTransitionState({ ...source, slainEnemies }, 'menagerie-of-ash');
      expect(arrived.mapId).toBe('menagerie-of-ash');
      expect(arrived.ashGoblinHp).toBeGreaterThan(0);
      expect(arrived.party).toEqual(source.party);
    }
  });

  it('retains real floor kills but never treats invalid indices as slain enemies', () => {
    const source = createChroniclesState('gallery-of-forks');
    const saved = {
      ...source,
      enemyHp: 0,
      slainEnemies: { 'menagerie-of-ash': [0, '1', -1, 1.5, 999] },
    };
    const next = chroniclesMapTransitionState(saved, 'menagerie-of-ash');
    expect(next.ashGoblinHp).toBe(0);
    expect(next.cryptSpiderHp).toBeGreaterThan(0);
    expect(next.boneHoundHp).toBeGreaterThan(0);
    expect(chroniclesMapInitialEnemyState('menagerie-of-ash', saved).ashGoblinHp).toBe(0);

    const restored = JSON.parse(JSON.stringify(next));
    const back = chroniclesMapTransitionState(restored, 'gallery-of-forks');
    expect(back.enemyHp).toBe(0);
    expect(back.jailerHp).toBeGreaterThan(0);
  });

  it('keeps the Gallery exit locked when a guardian HP value is missing or malformed', () => {
    const map = chroniclesMapById('gallery-of-forks');
    const gate = map.exits.find((entry) => entry.id === 'gallery-gate');
    const cleared = {
      ...createChroniclesState(map.id),
      x: 3, y: 2,
      enemyHp: 0, jailerHp: 0, galleryRelicCollected: true,
    };
    const tileAt = (x, y) => chroniclesMapTileAt(map, x, y);
    expect(chroniclesRequirementsMet(cleared, gate.requirements)).toBe(true);

    for (const invalidHp of [undefined, null, '', ' ', false, true, [], {}, 'not-a-number', 'Infinity', NaN, Infinity]) {
      const damaged = { ...cleared, jailerHp: invalidHp };
      expect(chroniclesRequirementsMet(damaged, gate.requirements), String(invalidHp)).toBe(false);
      expect(chroniclesContentInteractions(damaged, map, tileAt)
        .find((entry) => entry.id === gate.id)).toMatchObject({ locked: true });
    }

    // Older saves may serialize numeric HP as strings; keep those compatible.
    expect(chroniclesRequirementsMet({ ...cleared, jailerHp: '0' }, gate.requirements)).toBe(true);
    expect(chroniclesRequirementsMet({ ...cleared, jailerHp: '1' }, gate.requirements)).toBe(false);
    for (const invalid of [undefined, null, '', ' ', false, [], {}, 'Infinity']) {
      expect(chroniclesRequirementsMet({ progress: invalid }, [{ key: 'progress', gte: 0 }])).toBe(false);
    }
    expect(chroniclesRequirementsMet({ progress: '2' }, [{ key: 'progress', gte: 2 }])).toBe(true);
    expect(chroniclesRequirementsMet({ progress: 0 }, [{ key: 'progress', lte: null }])).toBe(false);
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
