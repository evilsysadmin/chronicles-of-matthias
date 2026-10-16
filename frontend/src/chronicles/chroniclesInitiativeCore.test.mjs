import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHRONICLES_INITIATIVE_DIE_SIDES,
  chroniclesRollD8,
  chroniclesPartyInitiativeAgility,
  chroniclesCurrentInitiativeActor,
  chroniclesAdvanceInitiative,
} from './chroniclesInitiativeCore.js';

test('original initiative die is 1d8 with clamped random inputs', () => {
  assert.equal(CHRONICLES_INITIATIVE_DIE_SIDES, 8);
  for (const [random, expected] of [[0, 1], [0.125, 2], [0.5, 5], [0.999999, 8], [1, 8], [-2, 1], [NaN, 1]]) {
    assert.equal(chroniclesRollD8(() => random), expected);
  }
});

test('agility includes progression and MM3 speed exactly once', () => {
  const member = { id: 'hero', agility: 4, mm3: { bonuses: { speed: -2 } } };
  assert.equal(chroniclesPartyInitiativeAgility({ rpgModifiers: { hero: { initiativeBonus: 3 } } }, member), 5);
  assert.equal(chroniclesPartyInitiativeAgility({}, { ...member, agility: 0 }), 0);
});

test('cursor advances, wraps, and increments round', () => {
  const first = { id: 'hero' }, second = { id: 'foe' };
  const initiative = { order: [first, second], cursor: 0, round: 1 };
  assert.equal(chroniclesCurrentInitiativeActor(initiative), first);
  const next = chroniclesAdvanceInitiative(initiative);
  assert.equal(chroniclesCurrentInitiativeActor(next), second);
  const wrapped = chroniclesAdvanceInitiative(next);
  assert.equal(wrapped.cursor, 0);
  assert.equal(wrapped.round, 2);
  assert.equal(chroniclesCurrentInitiativeActor(wrapped), first);
});
