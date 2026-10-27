import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';

// Unlike the passive pressure benchmark, every living hero spends a real
// initiative action. Prefer a melee attack; BLOCK if there is no legal target.
// This is a reproducible *baseline*, not an optimal player or a win-rate claim.
const PACK = ['sewers-goblin-west', 'sewers-goblin-overflow', 'sewers-goblin-bottom-shaft'];

function playSewerEncounter(rollOffset) {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const all = chroniclesActiveEnemies(base);
  const enemies = all.filter((enemy) => PACK.includes(enemy.id));
  expect(enemies.map((enemy) => enemy.id).sort()).toEqual([...PACK].sort());
  const inactive = Object.fromEntries(all
    .filter((enemy) => !PACK.includes(enemy.id))
    .map((enemy) => [enemy.hpKey, 0]));
  const initial = {
    ...base, ...inactive, x: 1, y: 5, direction: 1,
    runSeed: 'mm3-active-sewer-benchmark',
  };
  const initialHp = Object.fromEntries(initial.party.map(({ id, hp }) => [id, hp]));
  const initialEnemyHp = Object.fromEntries(enemies.map((enemy) => [enemy.id, initial[enemy.hpKey]]));
  let rollIndex = rollOffset;
  let state = chroniclesStartInitiativeCombat(initial, chroniclesActiveEnemies(initial), {
    forceEnemyIds: PACK,
    random: () => ((rollIndex++ % 2) ? 0.999 : 0),
  });
  expect(state.phase).toBe('combat');
  expect(state.initiative.order.filter(({ kind }) => kind === 'enemy').map(({ id }) => id).sort())
    .toEqual([...PACK].sort());

  const metrics = {
    rollOffset, steps: 0, rounds: 0,
    heroAttacks: 0, heroBlocks: 0, heroDamage: 0,
    enemyMoves: 0, enemyAttacks: 0, enemyWaits: 0,
  };
  while (state.initiative && metrics.steps < 128) {
    const actor = chroniclesCurrentInitiativeActor(state.initiative);
    expect(actor).toBeTruthy();
    metrics.rounds = Math.max(metrics.rounds, state.initiative.round);
    if (actor.kind === 'party') {
      const attempted = chroniclesReduce(state, { type: 'attack', memberId: actor.id });
      if (attempted.turns === state.turns + 1) {
        metrics.heroDamage += enemies.reduce((sum, enemy) => sum + Math.max(0, state[enemy.hpKey] - attempted[enemy.hpKey]), 0);
        metrics.heroAttacks += 1;
        state = attempted;
      } else {
        const guarded = chroniclesReduce(state, { type: 'block', memberId: actor.id });
        expect(guarded.turns, `BLOCK must spend ${actor.id}'s turn`).toBe(state.turns + 1);
        metrics.heroBlocks += 1;
        state = guarded;
      }
    } else {
      const beforeHp = state.party.map(({ hp }) => hp);
      const next = chroniclesResolveEnemyActor(state, actor.id);
      const events = next.enemyTurnEvents || [];
      // A creature can move OR attack per initiative action, never both.
      expect(events.length).toBeLessThanOrEqual(1);
      if (events.length === 0) metrics.enemyWaits += 1;
      if (events[0]?.type === 'move') {
        metrics.enemyMoves += 1;
        expect(next.party.map(({ hp }) => hp)).toEqual(beforeHp);
      } else if (events[0]?.type === 'attack') {
        metrics.enemyAttacks += 1;
      } else if (events.length) {
        throw new Error(`Unexpected enemy action: ${events[0].type}`);
      }
      state = next;
    }
    metrics.steps += 1;
    state = chroniclesAdvanceCombatInitiative(state, chroniclesActiveEnemies(state));
  }

  return {
    ...metrics,
    phase: state.phase,
    finished: !state.initiative,
    enemyHpLeft: Object.fromEntries(enemies.map((enemy) => [enemy.id, state[enemy.hpKey]])),
    enemyHpInitially: initialEnemyHp,
    partyHpLost: Object.fromEntries(state.party.map(({ id, hp }) => [id, initialHp[id] - hp])),
    downed: state.party.filter(({ hp }) => hp <= 0).length,
    lastMessage: state.message,
    enemyPositions: state.enemyPositions,
  };
}

describe('MM3 active encounter baseline · real actions and initiative', () => {
  it('finishes the authored western goblin pack with real attacks/blocks under two d8 orders', () => {
    for (const offset of [0, 1]) {
      const result = playSewerEncounter(offset);
      expect(playSewerEncounter(offset)).toEqual(result);
      console.info('CHRONICLES_MM3_ACTIVE_ENCOUNTER ' + JSON.stringify(result));
      expect(result.finished).toBe(true);
      expect(['explore', 'defeated']).toContain(result.phase);
      expect(result.heroAttacks + result.heroBlocks).toBeGreaterThan(0);
      expect(result.enemyMoves + result.enemyAttacks + result.enemyWaits).toBeGreaterThan(0);
      expect(result.steps).toBeLessThan(128);
      expect(Object.values(result.enemyHpLeft).every((hp) => Number.isFinite(hp) && hp >= 0)).toBe(true);
      expect(Object.values(result.partyHpLost).every((hp) => hp >= 0)).toBe(true);
    }
  });
});
