import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState, chroniclesTileAt } from '../chroniclesOfMatthias.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesResolveEnemyActor, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';

// A reproducible four-round *passive exposure* measurement: real authored
// enemies, real movement/attack/AC/rolls and full four-hero formation.
// It is NOT a win-rate or a completed encounter simulator: heroes intentionally
// spend no actions attacking, blocking, healing or fleeing, so we can isolate
// how many enemy turns actually threaten the company.
const WEST = 'sewers-goblin-west';
const OVERFLOW = 'sewers-goblin-overflow';
const REAR = 'sewers-goblin-bottom-shaft';
const ROAD_MELEE = 'banner-road-deserter';
const ROAD_THUG = 'banner-road-crossroads-thug';
const ROAD_ARCHER = 'banner-road-east-scout';

const cases = [
  {
    id: 'single-goblin',
    mapId: 'swordhaven-sewers',
    party: { x: 1, y: 5, direction: 1 },
    enemies: [WEST],
  },
  {
    id: 'single-file-squad',
    mapId: 'swordhaven-sewers',
    party: { x: 1, y: 5, direction: 1 },
    enemies: [WEST, OVERFLOW, REAR],
  },
  {
    id: 'open-mixed-formation',
    mapId: 'banner-road-first-book',
    party: { x: 10, y: 7, direction: 0 },
    enemies: [ROAD_MELEE, ROAD_THUG, ROAD_ARCHER],
    positions: {
      [ROAD_MELEE]: { x: 11, y: 7 },
      [ROAD_THUG]: { x: 9, y: 8 },
      [ROAD_ARCHER]: { x: 10, y: 4 },
    },
  },
];

function runPressure(caseData, rounds = 4) {
  const base = createChroniclesState(caseData.mapId, null, { rules: 'mm3' });
  const all = chroniclesActiveEnemies(base);
  const selected = all.filter(({ id }) => caseData.enemies.includes(id));
  expect(selected.map(({ id }) => id).sort()).toEqual([...caseData.enemies].sort());
  const removed = Object.fromEntries(all
    .filter(({ id }) => !caseData.enemies.includes(id))
    .map(({ hpKey }) => [hpKey, 0]));
  let before = {
    ...base,
    ...removed,
    ...caseData.party,
    enemyPositions: { ...(caseData.positions || {}) },
  };
  expect(chroniclesTileAt(before.x, before.y, before)).toBe('.');
  for (const enemy of selected) {
    const position = chroniclesRuntimeEnemyPosition(before, enemy);
    expect(chroniclesTileAt(position.x, position.y, before), enemy.id).toBe('.');
    expect(position).not.toMatchObject({ x: before.x, y: before.y });
  }

  before = chroniclesStartInitiativeCombat(before, chroniclesActiveEnemies(before), {
    forceEnemyIds: caseData.enemies, random: () => 0,
  });
  const participants = before.initiative?.order.filter(({ kind }) => kind === 'enemy').map(({ id }) => id) || [];
  expect(participants.slice().sort()).toEqual([...caseData.enemies].sort());
  expect(before.party.filter(({ hp }) => hp > 0)).toHaveLength(4);

  const firstHp = Object.fromEntries(before.party.map(({ id, hp }) => [id, hp]));
  const actionsByEnemy = Object.fromEntries(caseData.enemies.map((id) => [id, {
    attempts: 0, moves: 0, attacks: 0, hits: 0, blocked: 0, damage: 0,
  }]));
  const timeline = [];
  let state = before;
  for (let round = 1; round <= rounds && state.phase !== 'defeated'; round += 1) {
    state = {
      ...state,
      round,
      initiative: { ...state.initiative, round },
    };
    const observedRound = { round, attacks: 0, hits: 0, moves: 0, blocked: 0, damage: 0 };
    for (const enemyId of participants) {
      if (state.phase === 'defeated') break;
      const action = actionsByEnemy[enemyId];
      action.attempts += 1;
      const next = chroniclesResolveEnemyActor(state, enemyId);
      const events = next.enemyTurnEvents || [];
      if (events.length === 0) { action.blocked += 1; observedRound.blocked += 1; }
      for (const event of events) {
        if (event.type === 'move') { action.moves += 1; observedRound.moves += 1; }
        if (event.type === 'attack') {
          action.attacks += 1; observedRound.attacks += 1;
          if (!event.missed) { action.hits += 1; observedRound.hits += 1; }
          action.damage += event.damage;
          observedRound.damage += event.damage;
        }
      }
      state = next;
    }
    timeline.push(observedRound);
  }
  const total = (field) => Object.values(actionsByEnemy).reduce((sum, enemy) => sum + enemy[field], 0);
  const hpLost = Object.fromEntries(state.party.map(({ id, hp }) => [id, firstHp[id] - hp]));
  const metrics = {
    id: caseData.id,
    rounds: timeline.length,
    enemies: participants.length,
    turns: total('attempts'),
    moves: total('moves'),
    attacks: total('attacks'),
    hits: total('hits'),
    blocked: total('blocked'),
    damage: total('damage'),
    hpLost,
    downed: state.party.filter(({ hp }) => hp <= 0).length,
    byEnemy: actionsByEnemy,
    timeline,
  };
  expect(metrics.moves + metrics.attacks + metrics.blocked).toBe(metrics.turns);
  expect(Object.values(hpLost).reduce((sum, loss) => sum + loss, 0)).toBe(metrics.damage);
  return metrics;
}

describe('MM3 enemy pressure · same real engine, controlled four-round exposure', () => {
  it('has deterministic enemy pressure without fictional actions or free hits', () => {
    for (const encounter of cases) {
      const measured = runPressure(encounter);
      expect(runPressure(encounter)).toEqual(measured);
      expect(measured.rounds).toBe(4);
      expect(measured.turns).toBe(encounter.enemies.length * 4);
      expect(measured.damage).toBeGreaterThanOrEqual(0);
      expect(measured.hits).toBeLessThanOrEqual(measured.attacks);
      expect(measured.downed).toBe(0);
    }
  });

  it('exposes why a three-goblin corridor is not three simultaneous attackers', () => {
    const single = runPressure(cases[0]);
    const corridor = runPressure(cases[1]);
    expect(single.attacks).toBe(4);
    expect(corridor.enemies).toBe(3);
    expect(corridor.attacks).toBe(single.attacks);
    // The two rear creatures spend 3 actions trying to approach and
    // 5 actions physically blocked; none reaches the company's melee cell.
    expect(corridor.moves).toBe(3);
    expect(corridor.blocked).toBe(5);
    expect(corridor.moves + corridor.blocked).toBe(8);
    expect(corridor.byEnemy[WEST].attacks).toBe(4);
    expect(corridor.byEnemy[OVERFLOW].attacks).toBe(0);
    expect(corridor.byEnemy[REAR].attacks).toBe(0);
    expect(corridor.damage).toBe(single.damage);
  });

  it('isolates geometry with the same three goblins and the same party', () => {
    // Three identical authored enemies, but this time each has an adjacent
    // cardinal approach in the small walkable chamber at the sewer entrance.
    // This is test-only positioning; neither the map nor spawn data changes.
    const flanking = {
      id: 'three-goblins-flanking',
      mapId: 'swordhaven-sewers',
      party: { x: 2, y: 1, direction: 2 },
      enemies: [WEST, OVERFLOW, REAR],
      positions: {
        [WEST]: { x: 1, y: 1 },
        [OVERFLOW]: { x: 3, y: 1 },
        [REAR]: { x: 2, y: 2 },
      },
    };
    const corridor = runPressure(cases[1], 2);
    const chamber = runPressure(flanking, 2);
    expect(chamber.enemies).toBe(corridor.enemies);
    expect(chamber.turns).toBe(corridor.turns);
    expect(chamber.attacks).toBeGreaterThan(corridor.attacks);
    expect(chamber.moves + chamber.blocked).toBeLessThan(corridor.moves + corridor.blocked);
    console.info('CHRONICLES_MM3_GEOMETRY_COMPARISON ' + JSON.stringify({ corridor, chamber }));
  });

  it('records extra threat from a real ranged plus melee encounter in open ground', () => {
    const corridor = runPressure(cases[1]);
    const mixed = runPressure(cases[2]);
    expect(mixed.enemies).toBe(3);
    expect(mixed.attacks).toBeGreaterThan(corridor.attacks);
    expect(mixed.byEnemy[ROAD_ARCHER].attacks).toBe(4);
    expect(mixed.byEnemy[ROAD_MELEE].attacks).toBe(4);
    expect(mixed.byEnemy[ROAD_THUG].attempts).toBe(4);
    // The ranged threat targets backliners without granting phantom melee reach.
    expect(mixed.hits).toBeLessThanOrEqual(mixed.attacks);
  });

  it('reports measured physical pressure to CI to inform the next encounter-design PR', () => {
    const measured = cases.map((entry) => runPressure(entry));
    console.info('CHRONICLES_MM3_PRESSURE_BENCHMARK ' + JSON.stringify(measured));
    expect(measured.map(({ id }) => id)).toEqual(cases.map(({ id }) => id));
  });
});
