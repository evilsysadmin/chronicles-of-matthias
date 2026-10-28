import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesCombatMeleeTarget,
  chroniclesMM3MeleeAvailable,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesAdvanceCombatInitiative } from './chroniclesInitiative.js';
import { chroniclesCombatCameraFacing, chroniclesKeepVictoryFacing } from './chroniclesCombatCameraFacing.js';

const ID = 'sewers-goblin-west';
function realFlankFight({ x = 1, y = 2, direction = 0, distance = 1 } = {}) {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const goblin = chroniclesActiveEnemies(base).find((enemy) => enemy.id === ID);
  expect(goblin).toBeTruthy();
  const others = Object.fromEntries(chroniclesActiveEnemies(base)
    .filter((enemy) => enemy.id !== ID).map((enemy) => [enemy.hpKey, 0]));
  return {
    ...base, ...others, x: 1, y: 1, direction, phase: 'combat',
    enemyPositions: { [ID]: { x, y: y === 2 ? 1 + distance : y } },
    initiative: { round: 1, cursor: 0, order: [
      { kind: 'party', id: 'matthias' }, { kind: 'enemy', id: ID },
    ] },
  };
}

describe('MM3 encounter camera focuses real melee threats, not masonry', () => {
  it('looks at an adjacent goblin behind the camera without rotating the party or consuming turns', () => {
    const fight = realFlankFight(); // group faces north; goblin attacks from south
    expect(chroniclesCombatMeleeTarget(fight)?.enemy.id).toBe(ID);
    expect(chroniclesMM3MeleeAvailable(fight, 'matthias')).toBe(true);
    expect(chroniclesCombatCameraFacing(fight)).toBe(2);
    expect(fight.direction).toBe(0);
    expect(chroniclesReduce(fight, 'turn-left')).toBe(fight);
    expect(chroniclesReduce(fight, 'turn-right')).toBe(fight);
    const swung = chroniclesReduce(fight, { type: 'attack', memberId: 'matthias', mode: 'melee' });
    expect(swung.turns).toBe(fight.turns + 1);
    expect(swung.direction).toBe(0);
  });

  it('honours the original forward-facing shot and never invents a target', () => {
    const facing = realFlankFight({ direction: 2 });
    expect(chroniclesCombatCameraFacing(facing)).toBe(2);
    const distant = realFlankFight({ distance: 2 });
    expect(chroniclesCombatMeleeTarget(distant)).toBeNull();
    expect(chroniclesCombatCameraFacing(distant)).toBe(0);
    const enemy = chroniclesActiveEnemies(facing).find((entry) => entry.id === ID);
    const dead = { ...facing, [enemy.hpKey]: 0 };
    expect(chroniclesCombatCameraFacing(dead)).toBe(2);
  });

  it('keeps the combat-facing view after victory, including the saved exploration direction', () => {
    const fight = realFlankFight(); // north-facing party, adjacent goblin to south
    const goblin = chroniclesActiveEnemies(fight).find(({ id }) => id === ID);
    expect(chroniclesCombatCameraFacing(fight)).toBe(2);
    const defeated = { ...fight, [goblin.hpKey]: 0, turns: fight.turns + 1 };
    const closed = chroniclesAdvanceCombatInitiative(defeated, chroniclesActiveEnemies(defeated));
    expect(closed).toMatchObject({ phase: 'explore', initiative: null, direction: 0 });

    const kept = chroniclesKeepVictoryFacing(fight, closed);
    expect(kept).toMatchObject({ phase: 'explore', initiative: null, direction: 2 });
    expect(kept.turns).toBe(closed.turns);
    expect([kept.x, kept.y]).toEqual([fight.x, fight.y]);
    // The actual renderer reads direction after combat; no return-to-north.
    expect(chroniclesCombatCameraFacing(kept)).toBe(2);
    const recovered = JSON.parse(JSON.stringify(kept));
    expect(chroniclesCombatCameraFacing(recovered)).toBe(2);
    const stepped = chroniclesReduce(recovered, 'forward');
    expect([stepped.x, stepped.y]).toEqual([1, 2]);
  });

  it('does not write facing on failed/ongoing fights, defeat, Tactics or map transitions', () => {
    const fight = realFlankFight();
    const ongoing = { ...fight, turns: fight.turns + 1 };
    expect(chroniclesKeepVictoryFacing(fight, ongoing)).toBe(ongoing);
    expect(fight.direction).toBe(0);

    const exited = { ...fight, phase: 'explore', initiative: null };
    const wiped = { ...exited, phase: 'defeated' };
    const otherMap = { ...exited, mapId: 'other-map' };
    const tactics = { ...fight, combatRules: null };
    expect(chroniclesKeepVictoryFacing(fight, wiped)).toBe(wiped);
    expect(chroniclesKeepVictoryFacing(fight, otherMap)).toBe(otherMap);
    expect(chroniclesKeepVictoryFacing(tactics, exited)).toBe(exited);

    const distant = realFlankFight({ distance: 2 });
    const done = { ...distant, phase: 'explore', initiative: null };
    expect(chroniclesKeepVictoryFacing(distant, done)).toBe(done);
  });

  it('leaves exploration and independent Tactics camera control unchanged', () => {
    const fight = realFlankFight();
    expect(chroniclesCombatCameraFacing({ ...fight, initiative: null, phase: 'explore' })).toBe(0);
    expect(chroniclesCombatCameraFacing({ ...fight, combatRules: null })).toBe(0);
    expect(chroniclesCombatCameraFacing({ ...fight, phase: 'defeated' })).toBe(0);
  });
});
