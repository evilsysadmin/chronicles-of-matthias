import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesMM3EnemySwing,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackTarget } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesMemberSp } from './chroniclesMagic.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const hero = (state, id) => state.party.find((member) => member.id === id);

describe('MM3 gallery · real enemy damage and healing survive a checkpoint', () => {
  it('keeps a jailer hit after reload and charges the bishop for treating it', () => {
    const initial = createChroniclesState('gallery-of-forks', null, { rules: 'mm3' });
    const jailer = chroniclesActiveEnemies(initial).find((enemy) => enemy.id === 'gate-jailer');
    expect(jailer).toBeTruthy();

    // Isolate one authored opponent; the jailer holds the gallery gate at 3,1.
    const prepared = {
      ...initial, x: 2, y: 1, direction: 1,
      enemyHp: 0,
      spellPoints: { ...initial.spellPoints, bishop: 2 },
    };
    const started = chroniclesStartInitiativeCombat(prepared, [jailer], {
      forceEnemyIds: [jailer.id], random: () => 0,
    });
    expect(started.phase).toBe('combat');
    const cursor = started.initiative.order.findIndex(
      (actor) => actor.kind === 'enemy' && actor.id === jailer.id,
    );
    expect(cursor).toBeGreaterThanOrEqual(0);
    const initiative = { ...started.initiative, cursor };
    const target = chroniclesEnemyAttackTarget({ ...started, initiative }, jailer);
    expect(target).toBeTruthy();

    // d20 is deterministic per expedition turn. Select a legal prior turn
    // count with a landed swing, without mocking the combat damage resolver.
    const hitTurn = Array.from({ length: 80 }, (_, turn) => turn).find((turns) => (
      chroniclesMM3EnemySwing({ ...started, initiative, turns }, jailer, target.id, 'turn-0').hit
    ));
    expect(hitTurn).toBeDefined();
    const ready = { ...started, initiative, turns: hitTurn };
    const before = hero(ready, target.id);
    const resolved = chroniclesRunPendingEnemyTurn(ready, jailer.id, undefined, ready.initiative);
    expect(resolved.error).toBeNull();
    const swing = resolved.acted.enemyTurnEvents.find((event) => event.type === 'attack');
    expect(swing).toMatchObject({
      enemyId: jailer.id, targetId: target.id, fromHp: before.hp,
    });
    expect(swing.damage).toBeGreaterThan(0);
    expect(swing.toHp).toBe(Math.max(0, before.hp - swing.damage));
    expect(hero(resolved.committed, target.id).hp).toBe(swing.toHp);
    expect(resolved.committed.turns).toBe(ready.turns);
    expect(resolved.committed.phase).toBe('combat');

    // Use the real bounded Go/Mongo checkpoint projection, not a state clone.
    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(resolved.committed, 1)));
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('gallery-of-forks', null, { rules: 'mm3' }), payload,
    );
    expect(restored.phase).toBe('combat');
    expect(restored.initiative?.order.map(({ kind, id }) => [kind, id]))
      .toEqual(resolved.committed.initiative.order.map(({ kind, id }) => [kind, id]));
    expect(restored.party.map(({ id, hp }) => [id, hp]))
      .toEqual(resolved.committed.party.map(({ id, hp }) => [id, hp]));
    expect(restored.turns).toBe(resolved.committed.turns);
    expect(chroniclesMemberSp(restored, hero(restored, 'bishop'))).toBe(2);

    const bishopCursor = restored.initiative.order.findIndex(
      (actor) => actor.kind === 'party' && actor.id === 'bishop',
    );
    expect(bishopCursor).toBeGreaterThanOrEqual(0);
    const bishopTurn = {
      ...restored,
      initiative: { ...restored.initiative, cursor: bishopCursor },
    };
    const healed = chroniclesReduce(bishopTurn, {
      type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId: target.id,
    });
    expect(healed.turns).toBe(bishopTurn.turns + 1);
    expect(chroniclesMemberSp(healed, hero(healed, 'bishop'))).toBe(1);
    expect(hero(healed, target.id).hp).toBe(Math.min(before.maxHp, swing.toHp + 6));
    expect(healed.initiative).toBeTruthy();
  });
});
