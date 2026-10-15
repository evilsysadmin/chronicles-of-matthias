import test from 'node:test';
import assert from 'node:assert/strict';
import { chroniclesRollD8, chroniclesRollInitiative, chroniclesAdvanceInitiative, chroniclesPartyInitiativeAgility } from '../src/chronicles/initiativeCore.js';

test('d8 stays within 1..8', () => {
  assert.equal(chroniclesRollD8(() => 0), 1);
  assert.equal(chroniclesRollD8(() => 0.999999999), 8);
  assert.equal(chroniclesRollD8(() => Number.NaN), 1);
});

test('initiative is agility plus d8, without duplicating progression bonus', () => {
  const state = { party: [{ id: 'matthias', name: 'Matthias', hp: 10, agility: 4, mm3: { bonuses: { speed: 2 } } }], rpgModifiers: { matthias: { initiativeBonus: 3 } } };
  assert.equal(chroniclesPartyInitiativeAgility(state, state.party[0]), 9);
  const rolled = chroniclesRollInitiative(state, [], { random: () => 0 });
  assert.equal(rolled.order[0].initiative, 10);
  assert.equal(rolled.die, '1d8');
  assert.equal(chroniclesAdvanceInitiative(rolled).round, 2);
});
