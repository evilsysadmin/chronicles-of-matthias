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
import { chroniclesMemberSp } from './chroniclesMagic.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const member = (state, id) => state.party.find((hero) => hero.id === id);
const hpById = (state) => Object.fromEntries(state.party.map(({ id, hp }) => [id, hp]));

describe('MM3 gallery · two enemy rounds across a save', () => {
  it('keeps wounds and the one-action First Aid budget through another real jailer attack', () => {
    const initial = createChroniclesState('gallery-of-forks', null, { rules: 'mm3' });
    const jailer = chroniclesActiveEnemies(initial).find(({ id }) => id === 'gate-jailer');
    expect(jailer).toBeTruthy();

    const prepared = {
      ...initial, x: 2, y: 1, direction: 1,
      enemyHp: 0, // Other gallery opponents are not part of this encounter.
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

    // Select a deterministic, nonlethal hit using the real combat resolver.
    // No damage or hit chance is fabricated by the test.
    const hitTurn = Array.from({ length: 200 }, (_, turns) => turns).find((turns) => {
      const swing = chroniclesMM3EnemySwing({ ...started, initiative, turns }, jailer, target.id, 'turn-0');
      return swing.hit && swing.damage > 0 && swing.damage < target.hp;
    });
    expect(hitTurn).toBeDefined();
    const ready = { ...started, initiative, turns: hitTurn };
    const first = chroniclesRunPendingEnemyTurn(ready, jailer.id, undefined, ready.initiative);
    expect(first.error).toBeNull();
    const firstHit = first.acted.enemyTurnEvents.find(({ type }) => type === 'attack');
    expect(firstHit).toMatchObject({ enemyId: jailer.id, targetId: target.id });
    expect(firstHit.damage).toBeGreaterThan(0);
    expect(member(first.committed, target.id).hp).toBe(firstHit.toHp);

    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(first.committed, 1)));
    let state = chroniclesApplyRunCheckpoint(
      createChroniclesState('gallery-of-forks', null, { rules: 'mm3' }), payload,
    );
    expect(state.phase).toBe('combat');
    expect(hpById(state)).toEqual(hpById(first.committed));
    expect(chroniclesMemberSp(state, member(state, 'bishop'))).toBe(2);

    // Advance the remaining hero slots as passes; the bishop actually casts.
    // Initiative advancement is separate from action resolution in the UI.
    let casts = 0;
    for (let step = 0; step < state.initiative.order.length; step += 1) {
      const actor = chroniclesCurrentInitiativeActor(state.initiative);
      if (actor.kind === 'enemy') break;
      if (actor.id === 'bishop') {
        const before = state;
        state = chroniclesReduce(state, {
          type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId: target.id,
        });
        expect(state.turns).toBe(before.turns + 1);
        expect(member(state, target.id).hp)
          .toBe(Math.min(member(before, target.id).maxHp, member(before, target.id).hp + 6));
        casts += 1;
      }
      state = chroniclesAdvanceCombatInitiative(state, chroniclesActiveEnemies(state));
    }
    expect(casts).toBe(1);
    expect(chroniclesMemberSp(state, member(state, 'bishop'))).toBe(1);
    expect(chroniclesCurrentInitiativeActor(state.initiative))
      .toMatchObject({ kind: 'enemy', id: jailer.id });
    // Enemy-turn resolution may already advance the round before the saved
    // checkpoint; the second attack still follows a full hero-action cycle.
    expect(state.initiative.round).toBeGreaterThan(started.initiative.round);

    const beforeSecond = hpById(state);
    const second = chroniclesRunPendingEnemyTurn(state, jailer.id, undefined, state.initiative);
    expect(second.error).toBeNull();
    expect(second.acted.enemyTurnEvents.some(({ type, enemyId }) => (
      type === 'attack' && enemyId === jailer.id
    ))).toBe(true);
    expect(second.committed.phase).toBe('combat');
    expect(second.committed.turns).toBe(state.turns);
    expect(chroniclesMemberSp(second.committed, member(second.committed, 'bishop'))).toBe(1);
    for (const hero of second.committed.party) {
      expect(hero.hp).toBeLessThanOrEqual(beforeSecond[hero.id]);
    }
  });
});
