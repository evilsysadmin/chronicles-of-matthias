import { describe, expect, it } from 'vitest';
import {
  chroniclesPartyAttackStats,
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

// A deliberately limited benchmark: one authored enemy at melee contact,
// four level-1 canonical heroes, no pre-contact volley, consumables or spells.
// Do not mistake its win rate for campaign balance or a full 1–5 level study.
// The intent is to make alpha strikes and enemy response measurable using the
// actual reducer, initiative, enemy movement/targeting and d20 rules.
const ENCOUNTERS = [
  ['swordhaven-first-book', 'swordhaven-south-cutpurse'],
  ['banner-road-first-book', 'banner-road-bandit-captain'],
  ['swordhaven-sewers', 'sewers-hound'],
  ['swordhaven-sewers', 'sewers-smuggler'],
];
const SAMPLES = 48;
const MAX_ACTIONS = 80;

function adjacentStartingCell(map, enemy) {
  const candidates = [
    { x: enemy.x, y: enemy.y + 1, direction: 0 },
    { x: enemy.x - 1, y: enemy.y, direction: 1 },
    { x: enemy.x, y: enemy.y - 1, direction: 2 },
    { x: enemy.x + 1, y: enemy.y, direction: 3 },
  ];
  const result = candidates.find(({ x, y }) => map.grid[y]?.[x] === '.');
  if (!result) throw new Error(`No adjacent traversable tile for ${enemy.id}`);
  return result;
}

function fightOnce(mapId, enemyId, sample, upgraded) {
  const map = chroniclesMapById(mapId);
  const enemy = map.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy) throw new Error(`Missing benchmark enemy ${enemyId}`);
  const start = adjacentStartingCell(map, enemy);
  const base = createChroniclesState(mapId, null, { rules: 'mm3' });
  const seed = `balance-contact-v1/${mapId}/${enemyId}/${sample}`;
  const isolatedHp = Object.fromEntries(map.enemies.map((candidate) => [
    candidate.hpKey, candidate.id === enemyId ? candidate.maxHp : 0,
  ]));
  const equipment = upgraded ? {
    matthias: { weapon: 'roadwatch-sabre', armor: 'roadwatch-vest' },
  } : {};
  let state = {
    ...base, ...isolatedHp, ...start, runSeed: seed, equipment,
  };
  const initialHp = state.party.reduce((sum, member) => sum + member.hp, 0);
  state = chroniclesStartInitiativeCombat(state, [enemy], {
    forceEnemyIds: [enemyId],
    random: chroniclesSeededRandom(`initiative/${seed}`),
  });
  if (!state.initiative || state.phase !== 'combat') {
    throw new Error(`Combat did not start: ${enemyId}`);
  }

  let partyActions = 0;
  let enemyActions = 0;
  let enemyStrikes = 0;
  let enemyHits = 0;
  let maxRound = 1;
  for (let step = 0; step < MAX_ACTIONS && state.initiative && state.phase === 'combat'; step += 1) {
    const actor = chroniclesCurrentInitiativeActor(state.initiative);
    if (!actor) throw new Error(`Missing combat actor: ${enemyId}`);
    maxRound = Math.max(maxRound, state.initiative.round);
    if (actor.kind === 'party') {
      const before = state;
      const attack = chroniclesPartyAttackStats(state, actor.id, 'melee');
      if (attack.reach !== 1) throw new Error('Unexpected MM3 melee reach');
      state = chroniclesReduce(state, { type: 'attack', memberId: actor.id, mode: 'melee' });
      if (state.turns <= before.turns) {
        throw new Error(`Party actor ${actor.id} did not spend an attack turn vs ${enemyId}`);
      }
      partyActions += 1;
    } else if (actor.kind === 'enemy') {
      state = chroniclesResolveEnemyActor(state, actor.id);
      enemyActions += 1;
      const attacks = (state.enemyTurnEvents || []).filter((event) => event.type === 'attack');
      enemyStrikes += attacks.length;
      enemyHits += attacks.filter((event) => !event.missed).length;
    } else {
      throw new Error(`Unknown combat actor kind: ${actor.kind}`);
    }
    if (state.phase !== 'defeated') state = chroniclesAdvanceCombatInitiative(state, [enemy]);
  }

  const victory = Number(state[enemy.hpKey]) <= 0 && state.phase !== 'defeated';
  const defeat = state.phase === 'defeated';
  if (!victory && !defeat) throw new Error(`Combat stalled: ${enemyId}, seed ${sample}`);
  const remainingHp = state.party.reduce((sum, member) => sum + Math.max(0, member.hp), 0);
  return {
    victory, defeat, partyActions, enemyActions, enemyStrikes, enemyHits,
    hpLost: initialHp - remainingHp, rounds: maxRound,
  };
}

function summary(mapId, enemyId, upgraded) {
  const results = Array.from({ length: SAMPLES }, (_, sample) =>
    fightOnce(mapId, enemyId, sample, upgraded));
  const mean = (key) => Math.round(
    100 * results.reduce((sum, result) => sum + result[key], 0) / SAMPLES,
  ) / 100;
  return {
    enemy: enemyId,
    gear: upgraded ? 'matthias-sabre-and-vest' : 'canonical-unarmed',
    samples: SAMPLES,
    victories: results.filter((result) => result.victory).length,
    defeats: results.filter((result) => result.defeat).length,
    pctEnemyActs: Math.round(100 * results.filter((result) => result.enemyActions > 0).length / SAMPLES),
    meanRounds: mean('rounds'),
    meanPartyActions: mean('partyActions'),
    meanEnemyActions: mean('enemyActions'),
    meanEnemyStrikes: mean('enemyStrikes'),
    meanEnemyHits: mean('enemyHits'),
    meanHpLost: mean('hpLost'),
  };
}

describe('Chronicles MM3 deterministic melee encounter baseline', () => {
  it.each(ENCOUNTERS)('measures %s / %s with and without a guard sabre', (mapId, enemyId) => {
    const naked = summary(mapId, enemyId, false);
    const geared = summary(mapId, enemyId, true);
    // Observable, deterministic diagnostics: no arbitrary "hard" win-rate
    // threshold while this is a deliberately simplified 4v1 benchmark.
    console.info(`CHRONICLES_MM3_ENCOUNTER_BASELINE ${JSON.stringify(naked)}`);
    console.info(`CHRONICLES_MM3_ENCOUNTER_BASELINE ${JSON.stringify(geared)}`);
    expect(naked.victories + naked.defeats).toBe(SAMPLES);
    expect(geared.victories + geared.defeats).toBe(SAMPLES);
    expect(naked.meanPartyActions).toBeGreaterThan(0);
    expect(geared.meanPartyActions).toBeGreaterThan(0);
    // A stronger sabre and vest should not make Matthias's company slower
    // in aggregate across the same seeded initiative and d20 scenarios.
    expect(geared.meanPartyActions).toBeLessThanOrEqual(naked.meanPartyActions);
  });
});
