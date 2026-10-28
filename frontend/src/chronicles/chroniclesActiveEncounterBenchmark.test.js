import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesEnemyTargetAhead, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesEnemyLostParty,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { chroniclesResolveEnemyActor, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesMemberSp } from './chroniclesMagic.js';

// Unlike the passive pressure benchmark, every living hero spends a real
// initiative action. Attack adjacent enemies, turn toward the nearest living
// opponent, advance on distant stragglers, or BLOCK when movement is blocked.
// No swings at empty air, no free turns.
// This is a reproducible *baseline*, not an optimal player or a win-rate claim.
const PACK = ['sewers-goblin-west', 'sewers-goblin-overflow', 'sewers-goblin-bottom-shaft'];
const CENTRAL_PACK = ['sewers-goblin-mid', 'sewers-goblin-upper-gallery', 'sewers-goblin-east-culvert'];

function playSewerEncounter(rollOffset, {
  woundedStart = false, pack = PACK, keepEnemyIds = pack,
  previousState = null, start = { x: 1, y: 5, direction: 1 }, returnState = false,
} = {}) {
  const base = previousState || createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const all = chroniclesActiveEnemies(base);
  const enemies = all.filter((enemy) => pack.includes(enemy.id));
  expect(enemies.map((enemy) => enemy.id).sort()).toEqual([...pack].sort());
  // Preserve the next authored squad in the first encounter; never reset
  // enemies or resources when continuing from a previous combat state.
  const inactive = previousState ? {} : Object.fromEntries(all
    .filter((enemy) => !keepEnemyIds.includes(enemy.id))
    .map((enemy) => [enemy.hpKey, 0]));
  const initial = {
    ...base, ...inactive, ...start,
    runSeed: 'mm3-active-sewer-benchmark',
    // A separate controlled variant starts with a small real wound so the
    // cleric must choose between healing and attacking during initiative.
    party: previousState ? base.party : woundedStart ? base.party.map((member) => (
      member.id === 'rook' ? { ...member, hp: Math.max(1, member.maxHp - 2) } : member
    )) : base.party,
    spellPoints: previousState ? base.spellPoints : woundedStart ? { ...base.spellPoints, bishop: 2 } : base.spellPoints,
  };
  const initialHp = Object.fromEntries(initial.party.map(({ id, hp }) => [id, hp]));
  const initialEnemyHp = Object.fromEntries(enemies.map((enemy) => [enemy.id, initial[enemy.hpKey]]));
  const initialBishopSp = chroniclesMemberSp(initial, initial.party.find(({ id }) => id === 'bishop'));
  let rollIndex = rollOffset;
  let state = chroniclesStartInitiativeCombat(initial, chroniclesActiveEnemies(initial), {
    forceEnemyIds: pack,
    random: () => ((rollIndex++ % 2) ? 0.999 : 0),
  });
  expect(state.phase).toBe('combat');
  expect(state.initiative.order.filter(({ kind }) => kind === 'enemy').map(({ id }) => id).sort())
    .toEqual([...pack].sort());

  const metrics = {
    rollOffset, steps: 0, rounds: 0,
    heroAttacks: 0, heroBlocks: 0, heroRotations: 0, heroMoves: 0, heroDamage: 0,
    heroHeals: 0, healedHp: 0, healingPhSpent: 0,
    enemyMoves: 0, enemyAttacks: 0, enemyWaits: 0,
  };
  while (state.initiative && metrics.steps < 128) {
    const actor = chroniclesCurrentInitiativeActor(state.initiative);
    expect(actor).toBeTruthy();
    metrics.rounds = Math.max(metrics.rounds, state.initiative.round);
    if (actor.kind === 'party') {
      const inFront = chroniclesEnemyTargetAhead(state, 1);
      const living = chroniclesActiveEnemies(state).filter((enemy) => pack.includes(enemy.id));
      const nearest = living.map((enemy) => {
        const position = chroniclesRuntimeEnemyPosition(state, enemy);
        const dx = position.x - state.x;
        const dy = position.y - state.y;
        return { dx, dy, distance: Math.abs(dx) + Math.abs(dy) };
      }).sort((a, b) => a.distance - b.distance)[0];
      const rook = state.party.find(({ id }) => id === 'rook');
      const caster = state.party.find(({ id }) => id === 'bishop');
      if (woundedStart && actor.id === 'bishop' && rook?.hp > 0
        && rook.hp < rook.maxHp && chroniclesMemberSp(state, caster) > 0) {
        const beforeSp = chroniclesMemberSp(state, caster);
        const healed = chroniclesReduce(state, { type: 'cast', memberId: actor.id, spellId: 'first-aid', targetId: 'rook' });
        expect(healed.turns).toBe(state.turns + 1);
        const afterSp = chroniclesMemberSp(healed, healed.party.find(({ id }) => id === 'bishop'));
        const afterRook = healed.party.find(({ id }) => id === 'rook');
        expect(afterSp).toBe(beforeSp - 1);
        expect(afterRook.hp).toBeGreaterThan(rook.hp);
        metrics.heroHeals += 1;
        metrics.healingPhSpent += beforeSp - afterSp;
        metrics.healedHp += afterRook.hp - rook.hp;
        state = healed;
      } else if (inFront) {
        const attempted = chroniclesReduce(state, { type: 'attack', memberId: actor.id, mode: 'melee' });
        expect(attempted.turns).toBe(state.turns + 1);
        metrics.heroDamage += enemies.reduce((sum, enemy) => sum + Math.max(0, state[enemy.hpKey] - attempted[enemy.hpKey]), 0);
        metrics.heroAttacks += 1;
        state = attempted;
      } else if (nearest) {
        const facing = Math.abs(nearest.dx) >= Math.abs(nearest.dy) && nearest.dx !== 0
          ? nearest.dx > 0 ? 1 : 3
          : nearest.dy > 0 ? 2 : 0;
        if (facing !== state.direction) {
          const delta = (facing - state.direction + 4) % 4;
          const turned = chroniclesReduce(state, delta === 3 ? 'turn-left' : 'turn-right');
          expect(turned.turns).toBe(state.turns + 1);
          metrics.heroRotations += 1;
          state = turned;
        } else if (nearest.distance > 1) {
          const moved = chroniclesReduce(state, 'forward');
          // MM3 initiative is stationary: chasing a distant enemy must not
          // silently move the whole party or consume the active hero's turn.
          expect(moved.turns).toBe(state.turns);
          expect({ x: moved.x, y: moved.y }).toEqual({ x: state.x, y: state.y });
          const guarded = chroniclesReduce(state, { type: 'block', memberId: actor.id });
          expect(guarded.turns).toBe(state.turns + 1);
          metrics.heroBlocks += 1;
          state = guarded;
        } else {
          const guarded = chroniclesReduce(state, { type: 'block', memberId: actor.id });
          expect(guarded.turns).toBe(state.turns + 1);
          metrics.heroBlocks += 1;
          state = guarded;
        }
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
    legitimateWithdrawals: enemies.filter((enemy) => state[enemy.hpKey] > 0
      && chroniclesEnemyLostParty(state, enemy)).map((enemy) => enemy.id),
    partyHpLost: Object.fromEntries(state.party.map(({ id, hp }) => [id, initialHp[id] - hp])),
    initialPartyHp: initialHp,
    finalPartyHp: Object.fromEntries(state.party.map(({ id, hp }) => [id, hp])),
    initialBishopSp,
    finalBishopSp: chroniclesMemberSp(state, state.party.find(({ id }) => id === 'bishop')),
    downed: state.party.filter(({ hp }) => hp <= 0).length,
    lastMessage: state.message,
    enemyPositions: state.enemyPositions,
    ...(returnState ? { state } : {}),
  };
}

describe('MM3 active encounter baseline · real actions and initiative', () => {
  it('resolves the tougher pack by real kills or legal disengagement under two d8 orders', () => {
    const outcomes = [];
    for (const offset of [0, 1]) {
      const result = playSewerEncounter(offset);
      outcomes.push(result);
      expect(playSewerEncounter(offset)).toEqual(result);
      console.info('CHRONICLES_MM3_ACTIVE_ENCOUNTER ' + JSON.stringify(result));
      expect(result.finished).toBe(true);
      // Combat may legitimately end after a survivor withdraws beyond its
      // leash and line of sight. It must never count that foe as killed,
      // or silently end while a still-engaged enemy remains nearby.
      expect(result.phase).toBe('explore');
      expect(result.downed).toBe(0);
      expect(result.heroMoves).toBe(0);
      const remaining = Object.entries(result.enemyHpLeft)
        .filter(([, hp]) => hp > 0).map(([id]) => id);
      expect(remaining).toEqual(result.legitimateWithdrawals);
      expect(PACK.length - remaining.length).toBeGreaterThanOrEqual(2);
      expect(result.heroAttacks + result.heroBlocks + result.heroRotations + result.heroMoves).toBeGreaterThan(0);
      expect(result.enemyMoves + result.enemyAttacks + result.enemyWaits).toBeGreaterThan(0);
      expect(result.steps).toBeLessThan(128);
      expect(Object.values(result.enemyHpLeft).every((hp) => Number.isFinite(hp) && hp >= 0)).toBe(true);
      expect(Object.values(result.partyHpLost).every((hp) => hp >= 0)).toBe(true);
    }
    // Both d8 orders must remain winnable, but the pack must still pose
    // measurable pressure in at least one of the deterministic orders.
    expect(outcomes.some(({ partyHpLost }) => Object.values(partyHpLost).some((hp) => hp > 0))).toBe(true);
  });

  it('accounts for healing and PH under both reproducible d8 initiative orders', () => {
    for (const offset of [0, 1]) {
      const result = playSewerEncounter(offset, { woundedStart: true });
      expect(playSewerEncounter(offset, { woundedStart: true })).toEqual(result);
      console.info('CHRONICLES_MM3_ACTIVE_HEALING ' + JSON.stringify(result));
      expect(result.finished).toBe(true);
      expect(result.phase).toBe('explore');
      expect(result.downed).toBe(0);
      expect(result.heroHeals).toBeGreaterThan(0);
      expect(result.healedHp).toBeGreaterThan(0);
      // Neither initiative order may grant free healing, extra PH or a
      // resource refill between the spell action and encounter resolution.
      expect(result.healingPhSpent).toBe(result.heroHeals);
      expect(result.initialBishopSp - result.finalBishopSp).toBe(result.healingPhSpent);
      expect(result.finalBishopSp).toBeGreaterThanOrEqual(0);
      const remaining = Object.entries(result.enemyHpLeft)
        .filter(([, hp]) => hp > 0).map(([id]) => id);
      expect(remaining).toEqual(result.legitimateWithdrawals);
    }
  });
  it('carries wounds and PH through two sewer squads under both d8 initiative orders', () => {
    // Two different existing squads in the same map. Relocate the group
    // between engagements in the test only: travel attrition is not measured.
    // Reverse the d8 order between squads, then repeat the entire expedition
    // with the opposite order. Neither route may reset the party's resources.
    for (const firstOffset of [0, 1]) {
      const run = () => {
        const first = playSewerEncounter(firstOffset, {
          woundedStart: true, keepEnemyIds: [...PACK, ...CENTRAL_PACK], returnState: true,
        });
        const second = playSewerEncounter(1 - firstOffset, {
          pack: CENTRAL_PACK, previousState: first.state,
          start: { x: 7, y: 3, direction: 1 },
        });
        const { state: _state, ...firstMetrics } = first;
        return { first: firstMetrics, second };
      };
      const { first, second } = run();
      expect(run()).toEqual({ first, second });
      console.info('CHRONICLES_MM3_TWO_ENCOUNTERS ' + JSON.stringify({ first, second }));

      expect(first.finished).toBe(true);
      expect(first.phase).toBe('explore');
      expect(first.downed).toBe(0);
      expect(second.initialPartyHp).toEqual(first.finalPartyHp);
      expect(second.initialBishopSp).toBe(first.finalBishopSp);
      expect(second.finalBishopSp).toBeGreaterThanOrEqual(0);
      expect(second.finalBishopSp).toBeLessThanOrEqual(second.initialBishopSp);
      expect(second.healingPhSpent).toBe(second.initialBishopSp - second.finalBishopSp);
      expect(second.finished).toBe(true);
      expect(second.phase).toBe('explore');
      expect(second.downed).toBe(0);
      expect(first.heroMoves).toBe(0);
      expect(second.heroMoves).toBe(0);
      const remaining = Object.entries(second.enemyHpLeft)
        .filter(([, hp]) => hp > 0).map(([id]) => id);
      expect(remaining).toEqual(second.legitimateWithdrawals);
      expect(second.steps).toBeLessThan(128);
    }
  });

});
