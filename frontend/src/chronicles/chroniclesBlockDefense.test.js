import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_BLOCK_AC_BONUS,
  chroniclesActiveEnemies,
  chroniclesPartyArmorClass,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesAdvanceCombatInitiative, chroniclesCurrentInitiativeActor } from './chroniclesInitiative.js';
import { chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';

function goblinFight() {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const goblin = chroniclesActiveEnemies(base).find((enemy) => enemy.id === 'sewers-goblin-west');
  const otherEnemies = Object.fromEntries(chroniclesActiveEnemies(base)
    .filter((enemy) => enemy.id !== goblin.id).map((enemy) => [enemy.hpKey, 0]));
  return {
    goblin,
    state: { ...base, ...otherEnemies, x: 1, y: 1, direction: 2, phase: 'combat',
      enemyPositions: { [goblin.id]: { x: 1, y: 2 } },
      party: base.party.map((hero) => hero.id === 'matthias' ? hero : { ...hero, hp: 0 }),
      initiative: { order: [
        { kind: 'party', id: 'matthias' }, { kind: 'enemy', id: goblin.id },
      ], cursor: 0, round: 1 },
    },
  };
}

describe('Chronicles MM3 BLOCK (B)', () => {
  it('consumes the active hero turn and gives +4 AC without changing HP or enemy position', () => {
    const { state } = goblinFight();
    const before = chroniclesPartyArmorClass(state, 'matthias');
    const guarded = chroniclesReduce(state, { type: 'block', memberId: 'matthias' });
    expect(CHRONICLES_BLOCK_AC_BONUS).toBe(4);
    expect(guarded.turns).toBe(state.turns + 1);
    expect(guarded.party).toEqual(state.party);
    expect(guarded.enemyPositions).toEqual(state.enemyPositions);
    expect(chroniclesPartyArmorClass(guarded, 'matthias')).toBe(before + 4);
    expect(chroniclesPartyArmorClass(guarded, 'rook')).toBe(chroniclesPartyArmorClass(state, 'rook'));
    const repeated = chroniclesReduce(guarded, { type: 'block', memberId: 'matthias' });
    expect(chroniclesPartyArmorClass(repeated, 'matthias')).toBe(before + 4);
  });

  it('protects during enemy turns then expires exactly when the original hero returns', () => {
    const { goblin, state } = goblinFight();
    const baseline = chroniclesPartyArmorClass(state, 'matthias');
    const guarded = chroniclesReduce(state, { type: 'block', memberId: 'matthias' });
    const enemyTurn = chroniclesAdvanceCombatInitiative(guarded, chroniclesActiveEnemies(guarded));
    expect(chroniclesCurrentInitiativeActor(enemyTurn.initiative)?.id).toBe(goblin.id);
    expect(chroniclesPartyArmorClass(enemyTurn, 'matthias')).toBe(baseline + 4);
    const afterAttack = chroniclesResolveEnemyActor(enemyTurn, goblin.id);
    const next = chroniclesAdvanceCombatInitiative(afterAttack, chroniclesActiveEnemies(afterAttack));
    expect(chroniclesCurrentInitiativeActor(next.initiative)?.id).toBe('matthias');
    expect(chroniclesPartyArmorClass(next, 'matthias')).toBe(baseline);
    expect(next.combatBlock?.matthias).toBeUndefined();
  });

  it('refuses B outside MM3 initiative, for dead heroes or enemy/other hero turns', () => {
    const { goblin, state } = goblinFight();
    const act = { type: 'block', memberId: 'matthias' };
    expect(chroniclesReduce({ ...state, initiative: null, phase: 'explore' }, act).turns).toBe(state.turns);
    const tactics = { ...state, combatRules: null };
    expect(chroniclesReduce(tactics, act)).toBe(tactics);
    expect(chroniclesReduce(state, { type: 'block', memberId: 'rook' })).toBe(state);
    expect(chroniclesReduce({ ...state, initiative: { ...state.initiative, cursor: 1 } }, act).combatBlock).toBeUndefined();
    const fallen = { ...state, party: state.party.map((hero) => ({ ...hero, hp: 0 })) };
    expect(chroniclesReduce(fallen, act)).toBe(fallen);
    const gone = chroniclesAdvanceCombatInitiative({ ...state, combatBlock: { matthias: true }, [goblin.hpKey]: 0 }, []);
    expect(gone.initiative).toBeNull();
    expect(gone.combatBlock).toBeUndefined();
  });
});
