import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesCombatMeleeTarget, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesEnemyLostParty,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { chroniclesResolveEnemyActor, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesMemberSp } from './chroniclesMagic.js';
import { chroniclesConsumableCount } from './chroniclesConsumables.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesGridExplorationStep } from './chroniclesGridExplorationStep.js';

// Unlike the passive pressure benchmark, every living hero spends a real
// initiative action. Attack a physically adjacent enemy (even off camera),
// or BLOCK while stragglers close: MM3 combat locks both tile and facing.
// No swings at empty air, free turns or impossible camera rotations.
// This is a reproducible *baseline*, not an optimal player or a win-rate claim.
const PACK = ['sewers-goblin-west', 'sewers-goblin-overflow', 'sewers-goblin-bottom-shaft'];
const CENTRAL_PACK = ['sewers-goblin-mid', 'sewers-goblin-upper-gallery', 'sewers-goblin-east-culvert'];

function playSewerEncounter(rollOffset, {
  woundedStart = false, pack = PACK, keepEnemyIds = pack,
  previousState = null, start = { x: 1, y: 5, direction: 1 }, returnState = false,
  startingPotions = 0, allowSpellHealing = true,
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
    ...(startingPotions ? { inventory: chroniclesApplyContentEffects(base, [{
      type: 'grant-item', itemId: 'healing-potion', name: 'Poción de curación', quantity: startingPotions,
    }]).inventory } : {}),
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
  const initialHealingPotions = chroniclesConsumableCount(initial, 'healing-potion');
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
      // Every translation is forbidden throughout MM3 initiative, whether
      // dispatched by keyboard/touch as a string or directly as an action.
      // Identity also guards against hidden turn, resource or state changes.
      for (const move of ['forward', 'backward', 'strafe-left', 'strafe-right', 'turn-left', 'turn-right']) {
        expect(chroniclesReduce(state, move), `${move} must not change combat state`).toBe(state);
        expect(chroniclesReduce(state, { type: move }), `${move} action must not change combat state`).toBe(state);
      }
      const inReach = chroniclesCombatMeleeTarget(state);
      const rook = state.party.find(({ id }) => id === 'rook');
      const caster = state.party.find(({ id }) => id === 'bishop');
      // A carried-over party may take wounds in the SECOND encounter even
      // without the explicit first-encounter woundedStart fixture. If the
      // cleric still has PH, spending a genuine healing turn is part of the
      // playable resource budget, not a synthetic reset or lowered bar.
      if ((woundedStart || previousState) && allowSpellHealing && actor.id === 'bishop' && rook?.hp > 0
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
      } else if (inReach) {
        const attempted = chroniclesReduce(state, { type: 'attack', memberId: actor.id, mode: 'melee' });
        expect(attempted.turns).toBe(state.turns + 1);
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
    legitimateWithdrawals: enemies.filter((enemy) => state[enemy.hpKey] > 0
      && chroniclesEnemyLostParty(state, enemy)).map((enemy) => enemy.id),
    partyHpLost: Object.fromEntries(state.party.map(({ id, hp }) => [id, initialHp[id] - hp])),
    initialPartyHp: initialHp,
    finalPartyHp: Object.fromEntries(state.party.map(({ id, hp }) => [id, hp])),
    initialBishopSp,
    initialHealingPotions,
    finalHealingPotions: chroniclesConsumableCount(state, 'healing-potion'),
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
      expect(result.heroRotations).toBe(0);
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
  it('carries wounds and PH through a real exploration step and two sewer squads under both d8 orders', () => {
    // Two existing squads in the same map. Walk seven real dungeon tiles after
    // the first fight, including turns around the north-gallery corner.
    // The remainder is still a test-only relocation, NOT a full route/attrition
    // benchmark. Reverse d8 order between fights; no resource reset.
    for (const firstOffset of [0, 1]) {
      const run = () => {
        const first = playSewerEncounter(firstOffset, {
          woundedStart: true, allowSpellHealing: false,
          keepEnemyIds: [...PACK, ...CENTRAL_PACK], returnState: true,
          startingPotions: 2,
        });
        let explored = first.state;
        // The west encounter starts at (1,5). Follow the authored corridor
        // north via (1,4), (1,3), (1,2), then east via (2,2), (3,2),
        // south to (3,3), then east to (4,3), turning on real exploration turns.
        // Do not teleport, refill PV/PH, or bypass enemy awareness for this leg.
        const turnActions = {
          0: [], 1: ['turn-left'], 2: ['turn-left', 'turn-left'], 3: ['turn-right'],
        }[explored.direction];
        expect(turnActions).toBeDefined();
        const actions = [
          ...turnActions, 'forward', 'forward', 'forward',
          'turn-right', 'forward', 'forward', 'turn-right', 'forward',
          'turn-left', 'forward', 
        ];
        const expectedTiles = [
          { x: 1, y: 4 }, { x: 1, y: 3 }, { x: 1, y: 2 },
          { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 },
          { x: 4, y: 3 },
        ];
        let walkedTiles = 0;
        for (const action of actions) {
          const before = explored;
          const goblinPositions = Object.fromEntries(chroniclesActiveEnemies(before)
            .filter(({ id }) => CENTRAL_PACK.includes(id))
            .map((enemy) => [enemy.id, chroniclesRuntimeEnemyPosition(before, enemy)]));
          explored = chroniclesGridExplorationStep(before, action);
          if (action === 'forward') {
            expect({ x: explored.x, y: explored.y }, `real tile ${walkedTiles + 1}`).toEqual(expectedTiles[walkedTiles]);
            walkedTiles += 1;
          }
          expect(explored.turns, `${action} must spend one exploration turn`).toBe(before.turns + 1);
          expect(explored.explorationEnemySteps, `${action} must advance pursuit exactly once`)
            .toBe((before.explorationEnemySteps || 0) + 1);
          // Real travel must not grant goblins knight jumps or multi-tile
          // teleports: each surviving pursuer may walk at most one cardinal tile.
          for (const enemy of chroniclesActiveEnemies(explored).filter(({ id }) => CENTRAL_PACK.includes(id))) {
            const previous = goblinPositions[enemy.id];
            const next = chroniclesRuntimeEnemyPosition(explored, enemy);
            expect(Math.abs(next.x - previous.x) + Math.abs(next.y - previous.y),
              `${enemy.id} must pursue cardinally during ${action}`).toBeLessThanOrEqual(1);
          }
          expect(explored.phase).toBe('explore');
          expect(explored.initiative).toBeFalsy();
          expect(explored.party).toEqual(before.party);
          expect(chroniclesConsumableCount(explored, 'healing-potion'))
            .toBe(chroniclesConsumableCount(before, 'healing-potion'));
          expect(chroniclesMemberSp(explored, explored.party.find(({ id }) => id === 'bishop')))
            .toBe(chroniclesMemberSp(before, before.party.find(({ id }) => id === 'bishop')));
        }
        expect(walkedTiles).toBe(expectedTiles.length);
        // Spend one real potion between fights, rather than merely asserting
        // that untouched stock survives. Choose the *most depleted* living
        // hero, not a hard-coded recipient: fixed-facing melee can expose
        // Matthias more than Hildegard in one of the d8 combat orders.
        const beforePotion = explored;
        const woundedHero = beforePotion.party.filter(({ hp, maxHp }) => hp > 0 && hp < maxHp)
          .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0];
        expect(woundedHero).toBeTruthy();
        const potionsBefore = chroniclesConsumableCount(beforePotion, 'healing-potion');
        expect(potionsBefore).toBeGreaterThan(0);
        // A refused consumable action must not create an invisible exploration
        // turn or move pursuers before the subsequent legitimate healing.
        expect(chroniclesConsumableCount(beforePotion, 'mana-potion')).toBe(0);
        const refused = chroniclesGridExplorationStep(beforePotion, {
          type: 'use-item', memberId: 'matthias', itemId: 'mana-potion', targetId: 'bishop',
        });
        expect(refused.message).toMatch(/No queda ningún/i);
        expect(refused.turns).toBe(beforePotion.turns);
        expect(refused.explorationEnemySteps).toBe(beforePotion.explorationEnemySteps);
        expect(refused.enemyPositions).toEqual(beforePotion.enemyPositions);
        expect(refused.party).toEqual(beforePotion.party);
        expect(refused.spellPoints).toEqual(beforePotion.spellPoints);
        expect(refused.inventory).toEqual(beforePotion.inventory);
        expect(refused.phase).toBe('explore');
        expect(refused.initiative).toBeFalsy();
        const goblinsBeforePotion = Object.fromEntries(chroniclesActiveEnemies(beforePotion)
          .filter(({ id }) => CENTRAL_PACK.includes(id))
          .map((enemy) => [enemy.id, chroniclesRuntimeEnemyPosition(beforePotion, enemy)]));
        // Use the same exploration dispatcher as the playable UI. A potion
        // spends time, so nearby pursuers must not get a free frozen turn.
        explored = chroniclesGridExplorationStep(refused, {
          type: 'use-item', memberId: 'matthias', itemId: 'healing-potion', targetId: woundedHero.id,
        });
        expect(explored.explorationEnemySteps).toBe((beforePotion.explorationEnemySteps || 0) + 1);
        for (const enemy of chroniclesActiveEnemies(explored).filter(({ id }) => CENTRAL_PACK.includes(id))) {
          const previous = goblinsBeforePotion[enemy.id];
          const next = chroniclesRuntimeEnemyPosition(explored, enemy);
          expect(Math.abs(next.x - previous.x) + Math.abs(next.y - previous.y),
            `${enemy.id} must pursue cardinally while the party heals`).toBeLessThanOrEqual(1);
        }
        const healedHero = explored.party.find(({ id }) => id === woundedHero.id);
        expect(healedHero.hp).toBe(Math.min(woundedHero.maxHp, woundedHero.hp + 15));
        expect(explored.turns).toBe(beforePotion.turns + 1);
        expect(chroniclesConsumableCount(explored, 'healing-potion')).toBe(potionsBefore - 1);
        expect({ x: explored.x, y: explored.y, direction: explored.direction })
          .toEqual({ x: beforePotion.x, y: beforePotion.y, direction: beforePotion.direction });
        expect(explored.phase).toBe('explore');
        expect(explored.initiative).toBeFalsy();
        expect(chroniclesMemberSp(explored, explored.party.find(({ id }) => id === 'bishop')))
          .toBe(chroniclesMemberSp(beforePotion, beforePotion.party.find(({ id }) => id === 'bishop')));
        const potion = {
          heroId: woundedHero.id, hpBefore: woundedHero.hp, hpAfter: healedHero.hp,
          potionsBefore, potionsAfter: chroniclesConsumableCount(explored, 'healing-potion'),
          turns: explored.turns - beforePotion.turns,
          enemySteps: (explored.explorationEnemySteps || 0) - (beforePotion.explorationEnemySteps || 0),
        };
        const travel = {
          from: { x: first.state.x, y: first.state.y },
          to: { x: explored.x, y: explored.y },
          actions,
          turns: beforePotion.turns - first.state.turns,
          enemySteps: (beforePotion.explorationEnemySteps || 0) - (first.state.explorationEnemySteps || 0),
        };
        const second = playSewerEncounter(1 - firstOffset, {
          pack: CENTRAL_PACK, previousState: explored,
          start: { x: 7, y: 3, direction: 1 },
        });
        const { state: _state, ...firstMetrics } = first;
        return { first: firstMetrics, travel, potion, second };
      };
      const { first, travel, potion, second } = run();
      expect(run()).toEqual({ first, travel, potion, second });
      console.info('CHRONICLES_MM3_TWO_ENCOUNTERS ' + JSON.stringify({ first, travel, potion, second }));

      expect(first.finished).toBe(true);
      expect(first.phase).toBe('explore');
      expect(first.downed).toBe(0);
      expect(travel.from).toEqual({ x: 1, y: 5 });
      expect(travel.to).toEqual({ x: 4, y: 3 });
      expect(travel.actions.filter((action) => action === 'forward')).toHaveLength(7);
      expect(travel.actions.at(-1)).toBe('forward');
      expect(travel.turns).toBe(travel.actions.length);
      expect(travel.enemySteps).toBe(travel.actions.length);
      expect(potion.hpBefore).toBe(first.finalPartyHp[potion.heroId]);
      expect(potion.hpAfter).toBeGreaterThan(potion.hpBefore);
      expect(potion.turns).toBe(1);
      expect(potion.enemySteps).toBe(1);
      expect(second.initialPartyHp).toEqual({ ...first.finalPartyHp, [potion.heroId]: potion.hpAfter });
      // A real stocked potion survives combat and travel; starting the next
      // encounter cannot silently refill or discard the carried supply.
      expect(first.initialHealingPotions).toBeGreaterThanOrEqual(2);
      expect(potion.potionsBefore).toBe(first.finalHealingPotions);
      expect(potion.potionsAfter).toBe(first.finalHealingPotions - 1);
      expect(second.initialHealingPotions).toBe(potion.potionsAfter);
      expect(second.finalHealingPotions).toBeGreaterThanOrEqual(second.initialHealingPotions);
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
