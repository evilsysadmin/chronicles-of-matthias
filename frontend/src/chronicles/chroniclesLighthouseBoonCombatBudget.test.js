import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesContextualContentAction,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import {
  applyChroniclesProgressionToTacticsState,
  createChroniclesProgression,
  reconcileChroniclesProgressionInTacticsState,
} from '../chroniclesOfMatthiasProgression.js';
import { chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesCheckpointRunProgression,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';
import {
  chroniclesResolveTemporaryFountainBoon,
  LIGHTHOUSE_FOUNTAIN_BOON,
} from './chroniclesTemporaryFountainBoon.js';

const accuracy = (state) => state.party.map((hero) => hero.mm3.stats.accuracy);

describe('MM3 Lighthouse blessing · real combat action budget', () => {
  it('does not spend a blessing on rejected actions or enemy slots, but does on a hero cast', () => {
    const progression = createChroniclesProgression();
    const original = applyChroniclesProgressionToTacticsState(
      createChroniclesState('terra-a6', progression.characterBuild, { rules: 'mm3' }),
      progression,
    );
    const atFountain = {
      ...original, x: 15, y: 4, direction: 0, runProgression: progression,
    };
    expect(chroniclesContextualContentAction(atFountain)?.id)
      .toBe(LIGHTHOUSE_FOUNTAIN_BOON.sourceId);
    const drink = chroniclesReduce(atFountain, { type: 'interact' });
    const blessed = chroniclesResolveTemporaryFountainBoon(atFountain, drink, progression);
    expect(blessed.granted).toBe(true);
    const expiresAt = blessed.progression.mm3TemporaryBoon.expiresAtTurn;
    const baseAccuracy = accuracy(atFountain);
    expect(accuracy(blessed.state)).toEqual(baseAccuracy.map((value) => value + 3));

    // Move the real expedition to a combat map; do not invent an enemy or its HP.
    const sewers = chroniclesMapTransitionState(blessed.state, 'swordhaven-sewers');
    expect(sewers.turns).toBe(blessed.state.turns);
    expect(accuracy(sewers)).toEqual(baseAccuracy.map((value) => value + 3));
    const goblin = chroniclesActiveEnemies(sewers).find(({ id }) => id === 'sewers-goblin-west');
    expect(goblin).toBeTruthy();
    const otherEnemies = chroniclesActiveEnemies(sewers).filter(({ id }) => id !== goblin.id);
    const prepared = {
      ...sewers,
      ...Object.fromEntries(otherEnemies.map(({ hpKey }) => [hpKey, 0])),
      enemyPositions: { [goblin.id]: { x: 1, y: 2 } },
      spellPoints: { ...sewers.spellPoints, bishop: 3 },
    };
    const started = chroniclesStartInitiativeCombat(prepared, [goblin], {
      forceEnemyIds: [goblin.id], random: () => 0,
    });
    expect(started.phase).toBe('combat');
    const enemyCursor = started.initiative.order.findIndex(
      ({ kind, id }) => kind === 'enemy' && id === goblin.id,
    );
    expect(enemyCursor).toBeGreaterThanOrEqual(0);
    const enemyState = {
      ...started, initiative: { ...started.initiative, cursor: enemyCursor },
    };

    // A stale world interaction cannot consume an action or reduce duration.
    const rejected = chroniclesReduce(enemyState, { type: 'interact' });
    expect(rejected).toBe(enemyState);
    expect(chroniclesResolveTemporaryFountainBoon(
      enemyState, rejected, blessed.progression,
    ).updated).toBe(false);

    // Enemy initiative is real, but only player actions advance the MM3 turn clock.
    const enemyTurn = chroniclesRunPendingEnemyTurn(
      enemyState, goblin.id, undefined, enemyState.initiative,
    );
    expect(enemyTurn.error).toBeNull();
    expect(enemyTurn.committed.turns).toBe(enemyState.turns);
    const afterEnemy = chroniclesResolveTemporaryFountainBoon(
      enemyState, enemyTurn.committed, blessed.progression,
    );
    expect(afterEnemy.updated).toBe(false);
    expect(accuracy(afterEnemy.state)).toEqual(baseAccuracy.map((value) => value + 3));

    const bishopCursor = afterEnemy.state.initiative.order.findIndex(
      ({ kind, id }) => kind === 'party' && id === 'bishop',
    );
    expect(bishopCursor).toBeGreaterThanOrEqual(0);
    const heroTurn = {
      ...afterEnemy.state,
      initiative: { ...afterEnemy.state.initiative, cursor: bishopCursor },
    };
    const cast = chroniclesReduce(heroTurn, {
      type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId: 'bishop',
    });
    expect(cast.turns).toBe(heroTurn.turns + 1);
    const afterCast = chroniclesResolveTemporaryFountainBoon(
      heroTurn, cast, blessed.progression,
    );
    expect(afterCast.updated).toBe(true);
    expect(afterCast.progression.mm3TemporaryBoon.expiresAtTurn).toBe(expiresAt);
    expect(expiresAt - afterCast.state.turns).toBe(7);
    expect(accuracy(afterCast.state)).toEqual(baseAccuracy.map((value) => value + 3));

    // The remaining action budget and derived combat stats survive Go/Mongo saves.
    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(afterCast.state, 1)));
    const stored = chroniclesCheckpointRunProgression(payload);
    expect(stored.mm3TemporaryBoon.expiresAtTurn).toBe(expiresAt);
    const resumed = reconcileChroniclesProgressionInTacticsState(
      chroniclesApplyRunCheckpoint(
        createChroniclesState('swordhaven-sewers', progression.characterBuild, { rules: 'mm3' }),
        payload,
      ),
      stored,
    );
    expect(resumed.turns).toBe(afterCast.state.turns);
    expect(accuracy(resumed)).toEqual(accuracy(afterCast.state));
    expect(resumed.phase).toBe('combat');
  });
});
