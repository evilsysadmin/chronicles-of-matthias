import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import {
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const SPIDER = 'crypt-spider';
const partyHp = (state) => state.party.map(({ id, hp }) => [id, hp]);
const checkpoint = (state) => JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(state, 1)));

describe('MM3 menagerie · multiattack initiative after checkpoint', () => {
  it('resolves both spider strikes once, then rejects the stale enemy callback after a second save', () => {
    const base = createChroniclesState('menagerie-of-ash', null, { rules: 'mm3' });
    const enemies = chroniclesActiveEnemies(base);
    const spider = enemies.find(({ id }) => id === SPIDER);
    expect(spider?.attacks).toEqual(['Mordisco', 'Zarpazo']);

    const prepared = {
      ...base, x: 3, y: 4, direction: 0,
      ...Object.fromEntries(enemies.filter(({ id }) => id !== SPIDER)
        .map(({ hpKey }) => [hpKey, 0])),
      enemyPositions: { [SPIDER]: { x: 3, y: 3 } },
    };
    const started = chroniclesStartInitiativeCombat(prepared, [spider], {
      forceEnemyIds: [SPIDER], random: () => 0,
    });
    expect(started.phase).toBe('combat');
    const cursor = started.initiative.order.findIndex(
      ({ kind, id }) => kind === 'enemy' && id === SPIDER,
    );
    expect(cursor).toBeGreaterThanOrEqual(0);
    const enemyTurn = { ...started, initiative: { ...started.initiative, cursor } };

    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('menagerie-of-ash', null, { rules: 'mm3' }),
      checkpoint(enemyTurn),
    );
    expect(chroniclesCurrentInitiativeActor(restored.initiative))
      .toMatchObject({ kind: 'enemy', id: SPIDER });
    expect(partyHp(restored)).toEqual(partyHp(enemyTurn));

    const result = chroniclesRunPendingEnemyTurn(restored, SPIDER, undefined, restored.initiative);
    expect(result.error).toBeNull();
    const strikes = result.acted.enemyTurnEvents;
    expect(strikes.map(({ type, attackName }) => [type, attackName])).toEqual([
      ['attack', 'Mordisco'],
      ['attack', 'Zarpazo'],
    ]);
    for (const strike of strikes) {
      expect(strike.fromHp - strike.toHp).toBe(Math.min(strike.fromHp, strike.damage));
    }
    expect(chroniclesCurrentInitiativeActor(result.committed.initiative)?.id).not.toBe(SPIDER);

    const afterSave = chroniclesApplyRunCheckpoint(
      createChroniclesState('menagerie-of-ash', null, { rules: 'mm3' }),
      checkpoint(result.committed),
    );
    expect(partyHp(afterSave)).toEqual(partyHp(result.committed));
    expect(chroniclesCurrentInitiativeActor(afterSave.initiative)?.id).not.toBe(SPIDER);
    expect(chroniclesRunPendingEnemyTurn(afterSave, SPIDER)).toBeNull();
    expect(partyHp(afterSave)).toEqual(partyHp(result.committed));
  });
});
