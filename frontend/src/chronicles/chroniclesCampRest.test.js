import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesCampRestStatus } from './chroniclesCampRest.js';
import { chroniclesGridExplorationStep } from './chroniclesGridExplorationStep.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesMemberMaxSp, chroniclesMemberSp } from './chroniclesMagic.js';
import { chroniclesEnemyCanAttackParty, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const mapId = 'swordhaven-sewers';
const initial = () => createChroniclesState(mapId, null, { rules: 'mm3' });
const stocked = (state, quantity = 4) => ({
  ...state,
  inventory: {
    ...state.inventory,
    'road-rations': { id: 'road-rations', name: 'Raciones de viaje', quantity },
  },
});
const cleared = (state) => ({
  ...state,
  ...Object.fromEntries(chroniclesActiveEnemies(state).map(({ hpKey }) => [hpKey, 0])),
});
const wounded = (state) => ({
  ...state,
  party: state.party.map((member, index) => ({
    ...member, hp: index === 0 ? 0 : Math.max(1, member.maxHp - 3),
  })),
  spellPoints: { ...state.spellPoints, bishop: 0, matthias: 0 },
});

describe('MM3 field rest · safe expedition resources', () => {
  it('spends one ration per standing hero, heals only the living, and persists after a Go checkpoint', () => {
    const before = wounded(stocked(cleared(initial())));
    expect(chroniclesCampRestStatus(before, chroniclesActiveEnemies(before))).toMatchObject({
      canRest: true, rationsNeeded: 3, rationsAvailable: 4,
    });
    const after = chroniclesReduce(before, { type: 'camp-rest' });
    expect(after.turns).toBe(before.turns + 1);
    expect(after.inventory['road-rations'].quantity).toBe(1);
    expect(after.party[0].hp).toBe(0);
    expect(after.party.slice(1).every((hero) => hero.hp === hero.maxHp)).toBe(true);
    const bishop = after.party.find((hero) => hero.id === 'bishop');
    expect(chroniclesMemberSp(after, bishop)).toBe(chroniclesMemberMaxSp(after, bishop));
    expect(after.spellPoints.matthias).toBe(0); // Fallen companion not restored.
    const saved = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(after, 1)));
    const restored = chroniclesApplyRunCheckpoint(initial(), saved);
    expect(restored.inventory['road-rations'].quantity).toBe(1);
    expect(restored.party.map((hero) => hero.hp)).toEqual(after.party.map((hero) => hero.hp));
    expect(chroniclesMemberSp(restored, restored.party.find((hero) => hero.id === 'bishop')))
      .toBe(chroniclesMemberMaxSp(restored, bishop));
    expect(restored.turns).toBe(after.turns);
    expect(chroniclesReduce(after, 'camp-rest')).toBe(after); // No wasted rations at full health.
  });

  it('refuses insufficient, fractional or absent food atomically without spending time', () => {
    const base = wounded(cleared(initial()));
    for (const state of [base, stocked(base, 2), stocked(base, 2.5)]) {
      expect(chroniclesCampRestStatus(state, []).canRest).toBe(false);
      expect(chroniclesReduce(state, 'camp-rest')).toBe(state);
    }
  });

  it('rejects nearby enemies and any active initiative, including a stale replayed action', () => {
    const base = wounded(stocked(initial()));
    const goblin = chroniclesActiveEnemies(base).find((enemy) => enemy.id === 'sewers-goblin-west');
    expect(goblin).toBeTruthy();
    const position = chroniclesRuntimeEnemyPosition(base, goblin);
    const near = { ...base, x: position.x, y: position.y };
    expect(chroniclesCampRestStatus(near, [goblin]).reason)
      .toBe('Hay enemigos demasiado cerca para descansar.');
    expect(chroniclesReduce(near, 'camp-rest')).toBe(near);
    const fight = chroniclesStartInitiativeCombat(base, [goblin], {
      forceEnemyIds: [goblin.id], random: () => 0,
    });
    expect(fight.initiative).toBeTruthy();
    expect(chroniclesReduce(fight, 'camp-rest')).toBe(fight);
    const stale = { ...base, phase: 'combat' };
    expect(chroniclesReduce(stale, 'camp-rest')).toBe(stale);
  });

  it('rejects a real archer at three tiles with line of sight but permits a wall-shielded camp', () => {
    const spawned = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    const archer = chroniclesActiveEnemies(spawned).find(({ id }) => id === 'banner-road-east-scout');
    expect(archer?.ai?.attackReach).toBe(3);
    const othersDown = Object.fromEntries(chroniclesActiveEnemies(spawned)
      .filter(({ id }) => id !== archer.id).map(({ hpKey }) => [hpKey, 0]));
    const exposed = wounded(stocked({ ...spawned, ...othersDown, x: 13, y: 3 }));
    expect(chroniclesEnemyCanAttackParty(exposed, archer)).toBe(true);
    expect(chroniclesCampRestStatus(exposed, chroniclesActiveEnemies(exposed)).reason)
      .toBe('Hay enemigos que pueden atacar el campamento a distancia.');
    expect(chroniclesReduce(exposed, 'camp-rest')).toBe(exposed);

    // Same three-tile distance, but the authored road wall blocks the bolt.
    const sheltered = { ...exposed, x: 16, y: 6 };
    expect(chroniclesEnemyCanAttackParty(sheltered, archer)).toBe(false);
    expect(chroniclesCampRestStatus(sheltered, chroniclesActiveEnemies(sheltered)).canRest)
      .toBe(true);
    const rested = chroniclesReduce(sheltered, 'camp-rest');
    expect(rested.turns).toBe(sheltered.turns + 1);
    expect(rested.inventory['road-rations'].quantity).toBe(1);
  });

  it('advances a real nearby goblin exactly once for a successful camp turn', () => {
    const spawned = initial();
    const goblin = chroniclesActiveEnemies(spawned).find((enemy) => enemy.id === 'sewers-goblin-west');
    expect(goblin).toBeTruthy();
    // The starting corridor has open cells (1, 1) through (1, 4).
    // Three steps is safe to begin resting, but the goblin can approach.
    const base = wounded(stocked(cleared(spawned)));
    const before = {
      ...base,
      [goblin.hpKey]: goblin.maxHp,
      enemyPositions: { ...base.enemyPositions, [goblin.id]: { x: 1, y: 4 } },
    };
    expect({ x: before.x, y: before.y }).toEqual({ x: 1, y: 1 });
    expect(chroniclesCampRestStatus(before, chroniclesActiveEnemies(before)).canRest).toBe(true);
    // This is the real first-person exploration path, not a reducer-only rest:
    // creatures must receive the same single movement tick as a turn or spell.
    const after = chroniclesGridExplorationStep(before, 'camp-rest');
    expect(after.turns).toBe(before.turns + 1);
    expect(after.explorationEnemySteps).toBe((before.explorationEnemySteps || 0) + 1);
    expect(after.enemyPositions[goblin.id]).toEqual({ x: 1, y: 3 });
    expect(after.inventory['road-rations'].quantity).toBe(1);
    expect(after.party[0].hp).toBe(0);
    // A refused rest, whether threatened or fully healed, must be a no-op:
    // no extra food, no free enemy step and no additional exploration time.
    const threatened = {
      ...before,
      enemyPositions: { ...before.enemyPositions, [goblin.id]: { x: 1, y: 3 } },
    };
    expect(chroniclesGridExplorationStep(threatened, 'camp-rest')).toBe(threatened);
    expect(chroniclesGridExplorationStep(after, 'camp-rest')).toBe(after);
  });

  it('never changes the independent Tactics rules or lets a stale inn camp', () => {
    const tactics = stocked(createChroniclesState(mapId));
    expect(chroniclesReduce(tactics, 'camp-rest')).toBe(tactics);
    const inn = { ...wounded(stocked(cleared(initial()))), inn: { id: 'first-book-healer' } };
    expect(chroniclesReduce(inn, 'camp-rest')).toBe(inn);
  });
});
