import { describe, expect, it } from 'vitest';
import {
  chroniclesCombatMeleeTarget,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesSeededRandom } from './chroniclesCharacterBuilds.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';

// The cistern pack is an actual authored three-goblin squad, occupying
// neighboring corridor cells. Unlike the 4v1 baseline this exercises squad
// entry, the choke point, approach turns and several enemy initiative slots.
// This is still *not* campaign balance: no opening volleys, heals or spells.
const MAP_ID = 'swordhaven-sewers';
const PACK = [
  'sewers-goblin-drain', // front, x21 y7
  'sewers-goblin-east', // middle, x20 y7
  'sewers-goblin-cistern', // rear, x19 y7
];
const START = Object.freeze({ x: 21, y: 8, direction: 0 });
const SAMPLES = 48;
const MAX_ACTIONS = 180;

function fightSquad(count, sample, geared) {
  const map = chroniclesMapById(MAP_ID);
  const selected = PACK.slice(0, count);
  const enemies = selected.map((id) => {
    const enemy = map.enemies.find((candidate) => candidate.id === id);
    if (!enemy) throw new Error(`Missing authored cistern goblin ${id}`);
    return enemy;
  });
  if (map.grid[START.y]?.[START.x] !== '.') throw new Error('Cistern starting tile is blocked');
  if (enemies.some((enemy) => map.grid[enemy.y]?.[enemy.x] !== '.')) {
    throw new Error('Cistern goblin spawns in an impassable tile');
  }
  if (enemies.some((enemy) => enemy.squadId !== 'sewers-cistern-pack')) {
    throw new Error('Cistern squad membership changed');
  }

  const seed = `cistern-pack-v1/${sample}`;
  const base = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
  // Inactive enemies are explicitly dead; all participating goblins retain
  // their normal authored positions, HP, movement and equipment.
  const hp = Object.fromEntries(map.enemies.map((enemy) => [
    enemy.hpKey, selected.includes(enemy.id) ? enemy.maxHp : 0,
  ]));
  const equipment = geared ? {
    matthias: { weapon: 'roadwatch-sabre', armor: 'roadwatch-vest' },
  } : {};
  let state = { ...base, ...hp, ...START, runSeed: seed, equipment };
  const startingHp = state.party.reduce((total, hero) => total + hero.hp, 0);
  state = chroniclesStartInitiativeCombat(state, enemies, {
    forceEnemyIds: [PACK[0]],
    random: chroniclesSeededRandom(`initiative/${seed}`),
  });
  if (!state.initiative) throw new Error('Cistern combat failed to start');
  const roster = state.initiative.order
    .filter((actor) => actor.kind === 'enemy')
    .map((actor) => actor.id);
  if (roster.length !== count || selected.some((id) => !roster.includes(id))) {
    throw new Error(`Incomplete cistern initiative roster: ${JSON.stringify(roster)}`);
  }

  let partyActions = 0;
  let blocks = 0;
  let enemyActions = 0;
  let enemyStrikes = 0;
  let enemyHits = 0;
  let rounds = 1;
  for (let action = 0; action < MAX_ACTIONS && state.phase === 'combat' && state.initiative; action += 1) {
    const actor = chroniclesCurrentInitiativeActor(state.initiative);
    if (!actor) throw new Error('Combat actor lost');
    rounds = Math.max(rounds, state.initiative.round);
    if (actor.kind === 'party') {
      const target = chroniclesCombatMeleeTarget(state);
      const before = state.turns;
      // No movement is allowed in MM3 initiative. A melee-only company
      // guards instead of wasting a free illegal attack while the pack closes.
      state = target
        ? chroniclesReduce(state, { type: 'attack', memberId: actor.id, mode: 'melee' })
        : chroniclesReduce(state, { type: 'block', memberId: actor.id });
      if (state.turns <= before) {
        throw new Error(`Hero ${actor.id} did not spend their initiative slot`);
      }
      if (!target) blocks += 1;
      partyActions += 1;
    } else if (actor.kind === 'enemy') {
      state = chroniclesResolveEnemyActor(state, actor.id);
      enemyActions += 1;
      const swings = (state.enemyTurnEvents || []).filter((event) => event.type === 'attack');
      enemyStrikes += swings.length;
      enemyHits += swings.filter((event) => !event.missed).length;
    } else {
      throw new Error(`Unknown initiative actor kind: ${actor.kind}`);
    }
    if (state.phase !== 'defeated') state = chroniclesAdvanceCombatInitiative(state, enemies);
  }
  const victory = selected.every((id) => {
    const enemy = enemies.find((candidate) => candidate.id === id);
    return Number(state[enemy.hpKey]) === 0;
  }) && state.phase !== 'defeated';
  const defeat = state.phase === 'defeated';
  // Squadmates may legitimately take an alternate route, lose sight and
  // disengage. Explore with a living enemy is NOT a stuck initiative.
  const disengaged = !victory && !defeat && state.phase === 'explore' && !state.initiative
    && enemies.some((enemy) => Number(state[enemy.hpKey]) > 0);
  if (!victory && !defeat && !disengaged) {
    const remaining = enemies.map((enemy) => ({
      id: enemy.id,
      hp: state[enemy.hpKey],
      position: state.enemyPositions?.[enemy.id] || { x: enemy.x, y: enemy.y },
    }));
    const party = state.party.map((hero) => ({ id: hero.id, hp: hero.hp }));
    throw new Error(`Stalled cistern fight ${JSON.stringify({
      count, sample, geared, phase: state.phase, round: state.initiative?.round,
      cursor: state.initiative?.cursor, partyActions, blocks, enemyActions,
      party, remaining, lastEnemyEvents: state.enemyTurnEvents,
    })}`);
  }
  return {
    victory, defeat, disengaged, rounds, partyActions, blocks, enemyActions, enemyStrikes, enemyHits,
    hpLost: startingHp - state.party.reduce((total, hero) => total + Math.max(0, hero.hp), 0),
    heroesDown: state.party.filter((hero) => hero.hp <= 0).length,
    enemiesLeft: enemies.filter((enemy) => Number(state[enemy.hpKey]) > 0).length,
  };
}

function measure(count, geared) {
  const fights = Array.from({ length: SAMPLES }, (_, index) => fightSquad(count, index, geared));
  const mean = (key) => Math.round(100 * fights.reduce((total, fight) => total + fight[key], 0) / SAMPLES) / 100;
  return {
    squadSize: count,
    gear: geared ? 'matthias-sabre-and-vest' : 'canonical-unarmed',
    samples: SAMPLES,
    victories: fights.filter((fight) => fight.victory).length,
    defeats: fights.filter((fight) => fight.defeat).length,
    disengagements: fights.filter((fight) => fight.disengaged).length,
    meanEnemiesLeft: mean('enemiesLeft'),
    pctEnemyActs: Math.round(100 * fights.filter((fight) => fight.enemyActions > 0).length / SAMPLES),
    meanRounds: mean('rounds'),
    meanPartyActions: mean('partyActions'),
    meanBlocks: mean('blocks'),
    meanEnemyActions: mean('enemyActions'),
    meanEnemyStrikes: mean('enemyStrikes'),
    meanEnemyHits: mean('enemyHits'),
    meanHpLost: mean('hpLost'),
    meanHeroesDown: mean('heroesDown'),
  };
}

describe('MM3 authored cistern squad difficulty benchmark', () => {
  it.each([false, true])('compares two against three goblins, equipped=%s', (geared) => {
    const two = measure(2, geared);
    const three = measure(3, geared);
    console.info(`CHRONICLES_MM3_SQUAD_BASELINE ${JSON.stringify(two)}`);
    console.info(`CHRONICLES_MM3_SQUAD_BASELINE ${JSON.stringify(three)}`);
    for (const result of [two, three]) {
      // The real combat leash can end an initiative while a distant
      // surviving goblin remains in the level: count that explicitly.
      expect(result.victories + result.defeats + result.disengagements).toBe(SAMPLES);
      expect(result.meanPartyActions).toBeGreaterThan(0);
      expect(result.meanEnemyActions).toBeGreaterThan(0);
    }
    // Additional enemies must provide real pressure, not phantom initiative
    // actors or free hits. These are comparative regressions, not a target
    // percentage of wins imposed on balancing.
    expect(three.meanEnemyActions).toBeGreaterThanOrEqual(two.meanEnemyActions);
  });
});
