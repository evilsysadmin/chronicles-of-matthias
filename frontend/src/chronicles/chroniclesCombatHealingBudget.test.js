import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { CHRONICLES_SPELLS, chroniclesMemberSp } from './chroniclesMagic.js';

// A deterministic real sewer encounter, not a free-form cast outside combat.
// The bishop's initiative turn is selected without giving any actor a free action.
function bishopTurn({ rookHp = 2, spellPoints = 2 } = {}) {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const goblin = chroniclesActiveEnemies(base).find(({ id }) => id === 'sewers-goblin-west');
  expect(goblin).toBeTruthy();
  const initial = {
    ...base, x: 1, y: 5, direction: 1,
    spellPoints: { ...base.spellPoints, bishop: spellPoints },
    party: base.party.map((member) => (
      member.id === 'rook' ? { ...member, hp: rookHp } : member
    )),
  };
  const started = chroniclesStartInitiativeCombat(initial, [goblin], {
    forceEnemyIds: [goblin.id],
    random: () => 0,
  });
  expect(started.phase).toBe('combat');
  const cursor = started.initiative.order.findIndex(({ kind, id }) => kind === 'party' && id === 'bishop');
  expect(cursor).toBeGreaterThanOrEqual(0);
  const state = { ...started, initiative: { ...started.initiative, cursor } };
  expect(chroniclesCurrentInitiativeActor(state.initiative)?.id).toBe('bishop');
  return state;
}

const rook = (state) => state.party.find(({ id }) => id === 'rook');
const bishop = (state) => state.party.find(({ id }) => id === 'bishop');
const firstAid = { type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId: 'rook' };

describe('MM3 sewer initiative · healing costs a real action and PH', () => {
  it('spends exactly one PH and one turn to heal a wounded ally', () => {
    const state = bishopTurn();
    const beforePh = chroniclesMemberSp(state, bishop(state));
    expect(beforePh).toBe(2);
    const next = chroniclesReduce(state, firstAid);
    expect(CHRONICLES_SPELLS['first-aid'].cost).toBe(1);
    expect(next.turns).toBe(state.turns + 1);
    expect(chroniclesMemberSp(next, bishop(next))).toBe(beforePh - 1);
    expect(rook(next).hp).toBe(Math.min(rook(state).maxHp, rook(state).hp + 6));
    expect(next.initiative).toBeTruthy();
  });

  it('still spends one PH and one turn when the target is already at full health', () => {
    const base = bishopTurn();
    const state = {
      ...base,
      party: base.party.map((member) => (
        member.id === 'rook' ? { ...member, hp: member.maxHp } : member
      )),
    };
    const next = chroniclesReduce(state, firstAid);
    expect(next.turns).toBe(state.turns + 1);
    expect(chroniclesMemberSp(next, bishop(next))).toBe(1);
    expect(rook(next).hp).toBe(rook(state).maxHp);
  });

  it('cannot gain a free heal or spend a turn with zero PH', () => {
    const state = bishopTurn({ spellPoints: 0 });
    const next = chroniclesReduce(state, firstAid);
    expect(next.turns).toBe(state.turns);
    expect(rook(next).hp).toBe(rook(state).hp);
    expect(chroniclesMemberSp(next, bishop(next))).toBe(0);
  });

  it.each([
    ['enemy', (actor) => actor.kind === 'enemy'],
    ['another hero', (actor) => actor.kind === 'party' && actor.id === 'matthias'],
  ])('rejects First Aid on the %s initiative slot without spending PH or a turn', (_label, matches) => {
    const base = bishopTurn();
    const cursor = base.initiative.order.findIndex(matches);
    expect(cursor).toBeGreaterThanOrEqual(0);
    const state = { ...base, initiative: { ...base.initiative, cursor } };
    const beforePh = chroniclesMemberSp(state, bishop(state));

    const next = chroniclesReduce(state, firstAid);

    expect(next.turns).toBe(state.turns);
    expect(chroniclesMemberSp(next, bishop(next))).toBe(beforePh);
    expect(rook(next).hp).toBe(rook(state).hp);
    expect(next.initiative).toEqual(state.initiative);
  });
});
