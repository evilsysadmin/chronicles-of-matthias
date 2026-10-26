import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesTileAt, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesChooseEnemyStep, chroniclesEnemyCanAttackParty,
  chroniclesEnemyHasSightline, chroniclesRuntimeEnemyPosition,
} from '../chroniclesOfMatthiasTurns.js';
import { chroniclesAdvanceExplorationEnemies } from './chroniclesGridExplorationStep.js';
import { chroniclesMapForState } from './chroniclesMapCatalog.js';

const SPIDER = 'sewers-spider';
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function spiderOnly(partyPosition, spiderPosition = { x: 15, y: 5 }) {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const active = chroniclesActiveEnemies(base);
  const spider = active.find((enemy) => enemy.id === SPIDER);
  const otherHp = Object.fromEntries(active.filter((enemy) => enemy.id !== SPIDER)
    .map((enemy) => [enemy.hpKey, 0]));
  return {
    spider,
    state: {
      ...base, ...otherHp, ...partyPosition,
      enemyPositions: { [SPIDER]: spiderPosition }, explorationEnemySteps: 0,
    },
  };
}

describe('Chronicles spider: ordinary dungeon movement, not chess leaps', () => {
  it('authors a cardinal-chasing sewer spider in the actual runtime map', () => {
    const { spider, state } = spiderOnly({ x: 15, y: 3 });
    expect(spider.ai.engagedMovement).toBe('cardinal-chase');
    expect(chroniclesMapForState(state).enemies.find((enemy) => enemy.id === SPIDER)?.ai.engagedMovement)
      .toBe('cardinal-chase');
  });

  it('emerges from behind a solid corner by one walkable tile on each shot turn', () => {
    const { spider, state: base } = spiderOnly({ x: 13, y: 5 });
    const from = chroniclesRuntimeEnemyPosition(base, spider);
    expect(from).toEqual({ x: 15, y: 5 });
    expect(chroniclesTileAt(14, 5, base)).toBe('#');
    expect(chroniclesEnemyHasSightline(base, from, { x: 13, y: 5 })).toBe(false);
    // The creature previously saw the player and remembers their last real cell.
    const alerted = { ...base, enemyAwareness: {
      [SPIDER]: { x: 13, y: 5, tick: 0, phase: 'explore', mapId: base.mapId },
    } };
    const expected = chroniclesChooseEnemyStep(alerted, spider);
    expect(expected).toEqual({ x: 15, y: 4 }); // Walk around the corner.
    expect(manhattan(from, expected)).toBe(1);
    const advanced = chroniclesAdvanceExplorationEnemies(alerted, {
      ...alerted, turns: alerted.turns + 1,
    });
    const moved = chroniclesRuntimeEnemyPosition(advanced, spider);
    expect(moved).toEqual(expected);
    expect(manhattan(moved, from)).toBe(1);
    expect(chroniclesTileAt(moved.x, moved.y, advanced)).not.toBe('#');
    expect(advanced.party).toEqual(alerted.party);
  });

  it('stops one tile in front of the company and waits for initiative to attack', () => {
    const { spider, state } = spiderOnly({ x: 15, y: 3 });
    const from = chroniclesRuntimeEnemyPosition(state, spider);
    const next = chroniclesAdvanceExplorationEnemies(state, { ...state, turns: state.turns + 1 });
    const moved = chroniclesRuntimeEnemyPosition(next, spider);
    expect(moved).toEqual({ x: 15, y: 4 });
    expect(manhattan(moved, from)).toBe(1);
    expect(manhattan(moved, { x: next.x, y: next.y })).toBe(1);
    expect(next.party).toEqual(state.party); // Approaching is not an attack.
    expect(chroniclesEnemyCanAttackParty(next, spider)).toBe(true);
    const following = chroniclesAdvanceExplorationEnemies(next, { ...next, turns: next.turns + 1 });
    expect(chroniclesRuntimeEnemyPosition(following, spider)).toEqual(moved);
  });

  it('clamps legacy organic knight-chase data in MM3, without altering Tactics', () => {
    const { spider, state } = spiderOnly({ x: 15, y: 3 });
    const legacy = { ...spider, ai: { ...spider.ai, engagedMovement: 'knight-chase' } };
    const result = chroniclesChooseEnemyStep(state, legacy);
    expect(result).toEqual({ x: 15, y: 4 });
    expect(manhattan(chroniclesRuntimeEnemyPosition(state, legacy), result)).toBe(1);
    // Chess-authored Tactics movement is distinct and must not be rewritten.
    expect(chroniclesChooseEnemyStep({ ...state, combatRules: 'tactics' }, legacy))
      .not.toBeUndefined();
  });
});
