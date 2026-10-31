import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesMM3EnemySwing,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackTarget } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesMemberSp } from './chroniclesMagic.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const hpLedger = (state) => state.party.map(({ id, hp }) => [id, hp]);
const bishopPh = (state) => chroniclesMemberSp(
  state, state.party.find(({ id }) => id === 'bishop'),
);
const checkpoint = (state) => JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(state, 1)));

describe('MM3 expedition · two authored encounters across dungeon floors', () => {
  it('keeps real battle wounds and spent First Aid PH when the next floor attacks', () => {
    const initial = createChroniclesState('gallery-of-forks', null, { rules: 'mm3' });
    const jailer = chroniclesActiveEnemies(initial).find(({ id }) => id === 'gate-jailer');
    expect(jailer).toBeTruthy();
    const prepared = {
      ...initial, x: 2, y: 1, direction: 1,
      enemyHp: 0, // Isolate the gate jailer, not a fabricated opponent.
      spellPoints: { ...initial.spellPoints, bishop: 2 },
    };
    const started = chroniclesStartInitiativeCombat(prepared, [jailer], {
      forceEnemyIds: [jailer.id], random: () => 0,
    });
    expect(started.phase).toBe('combat');
    const enemyCursor = started.initiative.order.findIndex(
      ({ kind, id }) => kind === 'enemy' && id === jailer.id,
    );
    expect(enemyCursor).toBeGreaterThanOrEqual(0);
    const initiative = { ...started.initiative, cursor: enemyCursor };
    const target = chroniclesEnemyAttackTarget({ ...started, initiative }, jailer);
    expect(target).toBeTruthy();

    // Use a deterministic nonlethal real hit; do not assign artificial wounds.
    const hitTurn = Array.from({ length: 200 }, (_, turn) => turn).find((turns) => {
      const swing = chroniclesMM3EnemySwing(
        { ...started, initiative, turns }, jailer, target.id, 'turn-0',
      );
      return swing.hit && swing.damage > 0 && swing.damage < target.hp;
    });
    expect(hitTurn).toBeDefined();
    const ready = { ...started, initiative, turns: hitTurn };
    const first = chroniclesRunPendingEnemyTurn(ready, jailer.id, undefined, ready.initiative);
    expect(first.error).toBeNull();
    expect(first.acted.enemyTurnEvents.some(({ type, damage }) => (
      type === 'attack' && damage > 0
    ))).toBe(true);
    expect(hpLedger(first.committed)).not.toEqual(hpLedger(ready));

    // Finish the first encounter using actual attacks and a paid healing action.
    let state = first.committed;
    let healed = false;
    let landed = 0;
    for (let step = 0; step < 120 && state.phase === 'combat'; step += 1) {
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
        expect(bishopPh(state)).toBe(1);
        healed = true;
      } else if (healed) {
        const before = state;
        state = chroniclesReduce(state, { type: 'attack', memberId: actor.id, mode: 'melee' });
        if (state !== before && state[jailer.hpKey] < before[jailer.hpKey]) landed += 1;
      }
      if (state.phase === 'combat') {
        state = chroniclesAdvanceCombatInitiative(state, chroniclesActiveEnemies(state));
      }
    }
    expect(healed).toBe(true);
    expect(landed).toBeGreaterThan(0);
    expect(state.phase).toBe('explore');
    expect(state[jailer.hpKey]).toBe(0);
    expect(bishopPh(state)).toBe(1);

    // The bounded save projection and the canonical map transition must not
    // heal the company, restore PH or respawn the defeated jailer.
    const afterSave = chroniclesApplyRunCheckpoint(
      createChroniclesState('gallery-of-forks', null, { rules: 'mm3' }), checkpoint(state),
    );
    expect(hpLedger(afterSave)).toEqual(hpLedger(state));
    expect(bishopPh(afterSave)).toBe(1);
    expect(afterSave[jailer.hpKey]).toBe(0);
    const descended = chroniclesMapTransitionState(afterSave, 'menagerie-of-ash');
    expect(descended.mapId).toBe('menagerie-of-ash');
    expect(hpLedger(descended)).toEqual(hpLedger(afterSave));
    expect(bishopPh(descended)).toBe(1);

    const resumed = chroniclesApplyRunCheckpoint(
      createChroniclesState('menagerie-of-ash', null, { rules: 'mm3' }), checkpoint(descended),
    );
    expect(hpLedger(resumed)).toEqual(hpLedger(descended));
    expect(bishopPh(resumed)).toBe(1);
    const enemies = chroniclesActiveEnemies(resumed);
    const spider = enemies.find(({ id }) => id === 'crypt-spider');
    expect(spider?.attacks).toEqual(['Mordisco', 'Zarpazo']);
    const secondPrepared = {
      ...resumed, x: 3, y: 4, direction: 0,
      ...Object.fromEntries(enemies.filter(({ id }) => id !== spider.id)
        .map(({ hpKey }) => [hpKey, 0])),
      enemyPositions: { [spider.id]: { x: 3, y: 3 } },
    };
    const second = chroniclesStartInitiativeCombat(secondPrepared, [spider], {
      forceEnemyIds: [spider.id], random: () => 0,
    });
    expect(second.phase).toBe('combat');
    const spiderCursor = second.initiative.order.findIndex(
      ({ kind, id }) => kind === 'enemy' && id === spider.id,
    );
    expect(spiderCursor).toBeGreaterThanOrEqual(0);
    const enemyTurn = { ...second, initiative: { ...second.initiative, cursor: spiderCursor } };
    const attacked = chroniclesRunPendingEnemyTurn(
      enemyTurn, spider.id, undefined, enemyTurn.initiative,
    );
    expect(attacked.error).toBeNull();
    expect(attacked.acted.enemyTurnEvents.map(({ type, attackName }) => [type, attackName]))
      .toEqual([['attack', 'Mordisco'], ['attack', 'Zarpazo']]);
    for (const [index, [, hp]] of hpLedger(attacked.committed).entries()) {
      expect(hp).toBeLessThanOrEqual(hpLedger(enemyTurn)[index][1]);
    }
    expect(bishopPh(attacked.committed)).toBe(1);
    expect(chroniclesRunPendingEnemyTurn(attacked.committed, spider.id)).toBeNull();
  });
});
