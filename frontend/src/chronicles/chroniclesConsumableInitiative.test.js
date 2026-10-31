import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesMemberSp } from './chroniclesMagic.js';

function sewerFight() {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const goblin = chroniclesActiveEnemies(base).find(({ id }) => id === 'sewers-goblin-west');
  expect(goblin).toBeTruthy();
  const wounded = {
    ...base, x: 1, y: 5, direction: 1,
    spellPoints: { ...base.spellPoints, bishop: 0 },
    party: base.party.map((hero) => hero.id === 'rook' ? { ...hero, hp: 2 } : hero),
  };
  const stocked = chroniclesApplyContentEffects(wounded, [
    { type: 'grant-item', itemId: 'healing-potion', name: 'Poción de curación', quantity: 2 },
    { type: 'grant-item', itemId: 'mana-potion', name: 'Poción de maná', quantity: 2 },
    { type: 'grant-item', itemId: 'revive-draught', name: 'Elixir de retorno', quantity: 1 },
    { type: 'grant-item', itemId: 'fire-scroll', name: 'Pergamino de llamas', quantity: 1 },
  ]);
  const started = chroniclesStartInitiativeCombat(stocked, [goblin], {
    forceEnemyIds: [goblin.id], random: () => 0,
  });
  expect(started.phase).toBe('combat');
  return started;
}

function atActor(state, predicate) {
  const cursor = state.initiative.order.findIndex(predicate);
  expect(cursor).toBeGreaterThanOrEqual(0);
  return { ...state, initiative: { ...state.initiative, cursor } };
}

const use = (itemId, targetId = null) => ({
  type: 'use-item', memberId: 'matthias', itemId, ...(targetId ? { targetId } : {}),
});

describe('MM3 consumables respect the initiative slot', () => {
  it.each([
    ['enemy', (actor) => actor.kind === 'enemy'],
    ['another hero', (actor) => actor.kind === 'party' && actor.id === 'bishop'],
  ])('rejects every item during the %s turn without changing stock, PV, PH or message', (_label, matches) => {
    const base = atActor(sewerFight(), matches);
    const fallen = {
      ...base,
      party: base.party.map((hero) => hero.id === 'rook' ? { ...hero, hp: 0 } : hero),
    };
    for (const action of [
      use('healing-potion', 'rook'),
      use('mana-potion', 'bishop'),
      use('revive-draught', 'rook'),
      use('fire-scroll'),
    ]) {
      const state = action.itemId === 'revive-draught' ? fallen : base;
      expect(chroniclesReduce(state, action), action.itemId).toBe(state);
    }
  });

  it('lets the active hero heal and spend exactly one potion and one action', () => {
    const state = atActor(sewerFight(), (actor) => actor.kind === 'party' && actor.id === 'matthias');
    const before = state.party.find((hero) => hero.id === 'rook');
    const next = chroniclesReduce(state, use('healing-potion', 'rook'));
    expect(next.turns).toBe(state.turns + 1);
    expect(next.party.find((hero) => hero.id === 'rook').hp).toBe(Math.min(before.maxHp, before.hp + 15));
    expect(next.inventory['healing-potion'].quantity).toBe(1);
    expect(next.initiative).toEqual(state.initiative);
  });

  it('lets the active hero restore PH without changing the initiative slot', () => {
    const state = atActor(sewerFight(), (actor) => actor.kind === 'party' && actor.id === 'matthias');
    const bishop = state.party.find((hero) => hero.id === 'bishop');
    expect(chroniclesMemberSp(state, bishop)).toBe(0);
    const next = chroniclesReduce(state, use('mana-potion', 'bishop'));
    expect(next.turns).toBe(state.turns + 1);
    expect(chroniclesMemberSp(next, bishop)).toBeGreaterThan(0);
    expect(next.inventory['mana-potion'].quantity).toBe(1);
    expect(next.initiative).toEqual(state.initiative);
  });
});
