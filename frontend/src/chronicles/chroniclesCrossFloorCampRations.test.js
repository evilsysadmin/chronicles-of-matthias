import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesCampRestStatus } from './chroniclesCampRest.js';
import { chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesMemberMaxSp, chroniclesMemberSp } from './chroniclesMagic.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const withoutEnemies = (state) => ({
  ...state,
  ...Object.fromEntries(chroniclesActiveEnemies(state).map(({ hpKey }) => [hpKey, 0])),
});

describe('MM3 expedition · field rations across dungeon floors', () => {
  it('spends the last four rations once, survives descent and checkpoint, and cannot rest for free', () => {
    const initial = withoutEnemies(createChroniclesState('gallery-of-forks', null, { rules: 'mm3' }));
    const prepared = {
      ...initial,
      party: initial.party.map((hero) => ({ ...hero, hp: Math.max(1, hero.maxHp - 3) })),
      spellPoints: { ...initial.spellPoints, bishop: 0 },
      inventory: {
        ...initial.inventory,
        'road-rations': { id: 'road-rations', name: 'Raciones de viaje', quantity: 4 },
      },
    };
    const bishop = (state) => state.party.find(({ id }) => id === 'bishop');

    expect(chroniclesCampRestStatus(prepared, chroniclesActiveEnemies(prepared)))
      .toMatchObject({ canRest: true, rationsNeeded: 4, rationsAvailable: 4 });
    const rested = chroniclesReduce(prepared, 'camp-rest');
    expect(rested.turns).toBe(prepared.turns + 1);
    expect(rested.inventory['road-rations']).toBeUndefined();
    expect(rested.party.every((hero) => hero.hp === hero.maxHp)).toBe(true);
    expect(chroniclesMemberSp(rested, bishop(rested)))
      .toBe(chroniclesMemberMaxSp(rested, bishop(rested)));

    const descended = chroniclesMapTransitionState(rested, 'menagerie-of-ash');
    expect(descended.turns).toBe(rested.turns);
    expect(descended.inventory['road-rations']).toBeUndefined();
    expect(descended.party.map(({ id, hp }) => [id, hp]))
      .toEqual(rested.party.map(({ id, hp }) => [id, hp]));

    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(descended, 1)));
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('menagerie-of-ash', null, { rules: 'mm3' }), payload,
    );
    expect(restored.inventory['road-rations']).toBeUndefined();
    expect(restored.turns).toBe(rested.turns);
    expect(chroniclesMemberSp(restored, bishop(restored)))
      .toBe(chroniclesMemberMaxSp(restored, bishop(restored)));

    // A fresh wound on the deeper floor cannot turn a consumed ration into
    // a second full-party heal, even after an API checkpoint round-trip.
    const safe = withoutEnemies(restored);
    const woundedAgain = {
      ...safe,
      party: safe.party.map((hero) => hero.id === 'rook'
        ? { ...hero, hp: Math.max(1, hero.maxHp - 1) }
        : hero),
      spellPoints: { ...safe.spellPoints, bishop: 0 },
    };
    expect(chroniclesCampRestStatus(woundedAgain, chroniclesActiveEnemies(woundedAgain)))
      .toMatchObject({ canRest: false, rationsNeeded: 4, rationsAvailable: 0 });
    expect(chroniclesReduce(woundedAgain, 'camp-rest')).toBe(woundedAgain);
  });
});
