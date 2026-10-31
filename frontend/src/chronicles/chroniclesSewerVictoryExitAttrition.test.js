import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesMM3EnemySwing,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackTarget } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesAreaTransitionIntent } from './chroniclesAreaTransitionIntent.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { chroniclesMemberSp } from './chroniclesMagic.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const GOBLIN = 'sewers-goblin-west';
const hero = (state, id) => state.party.find((member) => member.id === id);
const hitPoints = (state) => state.party.map(({ id, hp }) => [id, hp]);

describe('MM3 sewers · real combat victory followed by the authored exit', () => {
  it('keeps battle wounds and spent PH through a real exit and checkpoint', () => {
    const initial = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const enemies = chroniclesActiveEnemies(initial);
    const goblin = enemies.find(({ id }) => id === GOBLIN);
    expect(goblin).toBeTruthy();

    // The real sewer entrance is also its reciprocal exit. Isolate one
    // authored 8-HP goblin, adjacent on a walkable tile; never fake a kill.
    const prepared = {
      ...initial,
      ...Object.fromEntries(enemies.filter(({ id }) => id !== GOBLIN)
        .map(({ hpKey }) => [hpKey, 0])),
      enemyPositions: { [GOBLIN]: { x: 1, y: 2 } },
      spellPoints: { ...initial.spellPoints, bishop: 2 },
    };
    expect(chroniclesAreaTransitionIntent(prepared, 'interact')?.exitId)
      .toBe('sewers-to-swordhaven');
    const started = chroniclesStartInitiativeCombat(prepared, [goblin], {
      forceEnemyIds: [GOBLIN], random: () => 0,
    });
    expect(started.phase).toBe('combat');
    expect(chroniclesAreaTransitionIntent(started, 'interact')).toBeNull();

    const cursor = started.initiative.order.findIndex(
      ({ kind, id }) => kind === 'enemy' && id === GOBLIN,
    );
    expect(cursor).toBeGreaterThanOrEqual(0);
    const initiative = { ...started.initiative, cursor };
    const target = chroniclesEnemyAttackTarget({ ...started, initiative }, goblin);
    expect(target).toBeTruthy();
    const hitTurn = Array.from({ length: 200 }, (_, turns) => turns).find((turns) => {
      const swing = chroniclesMM3EnemySwing(
        { ...started, initiative, turns }, goblin, target.id, 'turn-0',
      );
      return swing.hit && swing.damage > 0 && swing.damage < target.hp;
    });
    expect(hitTurn).toBeDefined();
    const ready = { ...started, initiative, turns: hitTurn };
    const first = chroniclesRunPendingEnemyTurn(ready, GOBLIN, undefined, ready.initiative);
    expect(first.error).toBeNull();
    expect(first.acted.enemyTurnEvents.some(({ type, damage }) => (
      type === 'attack' && damage > 0
    ))).toBe(true);
    expect(hero(first.committed, target.id).hp).toBeLessThan(target.hp);

    // Reload a real Go/Mongo-shaped checkpoint before finishing the fight.
    const saved = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(first.committed, 1)));
    let state = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' }), saved,
    );
    expect(state.phase).toBe('combat');
    expect(hitPoints(state)).toEqual(hitPoints(first.committed));

    let healed = false;
    let landedHits = 0;
    for (let step = 0; step < 100 && state.phase === 'combat'; step += 1) {
      const actor = chroniclesCurrentInitiativeActor(state.initiative);
      expect(actor).toBeTruthy();
      if (actor.kind === 'enemy') {
        const turn = chroniclesRunPendingEnemyTurn(state, actor.id, undefined, state.initiative);
        expect(turn.error).toBeNull();
        state = turn.committed;
        continue;
      }

      if (!healed && actor.id === 'bishop') {
        const before = state;
        state = chroniclesReduce(state, {
          type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId: target.id,
        });
        expect(state.turns).toBe(before.turns + 1);
        expect(chroniclesMemberSp(state, hero(state, 'bishop'))).toBe(1);
        healed = true;
      } else if (healed) {
        const before = state;
        state = chroniclesReduce(state, {
          type: 'attack', memberId: actor.id, mode: 'melee',
        });
        if (state !== before) {
          expect(state.turns).toBe(before.turns + 1);
          if (state[goblin.hpKey] < before[goblin.hpKey]) landedHits += 1;
        }
      }
      // Passing is an initiative slot, never a free attack.
      if (state.phase === 'combat') {
        state = chroniclesAdvanceCombatInitiative(state, chroniclesActiveEnemies(state));
      }
    }
    expect(healed).toBe(true);
    expect(landedHits).toBeGreaterThan(0);
    expect(state[goblin.hpKey]).toBe(0);
    expect(state.phase).toBe('explore');
    expect(state.initiative).toBeNull();

    const exit = chroniclesAreaTransitionIntent(state, 'interact');
    expect(exit?.exitId).toBe('sewers-to-swordhaven');
    const crossed = chroniclesReduce(state, {
      type: 'cross-area-threshold', exitId: exit.exitId,
    });
    expect(crossed.mapId).toBe('swordhaven-first-book');
    expect(crossed.turns).toBe(state.turns);
    expect(hitPoints(crossed)).toEqual(hitPoints(state));
    expect(chroniclesMemberSp(crossed, hero(crossed, 'bishop'))).toBe(1);

    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(crossed, 1)));
    const resumed = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }), payload,
    );
    expect(resumed.mapId).toBe('swordhaven-first-book');
    expect(hitPoints(resumed)).toEqual(hitPoints(crossed));
    expect(chroniclesMemberSp(resumed, hero(resumed, 'bishop'))).toBe(1);
  });
});
