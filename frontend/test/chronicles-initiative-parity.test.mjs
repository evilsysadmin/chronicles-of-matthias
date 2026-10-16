import test from 'node:test';
import assert from 'node:assert/strict';
import { chroniclesRollD8, chroniclesPartyInitiativeAgility, chroniclesAdvanceInitiative, chroniclesCurrentInitiativeActor } from '../src/chronicles/chroniclesInitiativeCore.js';

test('legacy 1d8 endpoints and midpoint', () => {
  assert.equal(chroniclesRollD8(() => 0), 1);
  assert.equal(chroniclesRollD8(() => 0.5), 5);
  assert.equal(chroniclesRollD8(() => 1), 8);
});

test('legacy progression and speed modifier', () => {
  const member = { id: 'hero', agility: 4, mm3: { bonuses: { speed: -2 } } };
  assert.equal(chroniclesPartyInitiativeAgility({ rpgModifiers: { hero: { initiativeBonus: 3 } } }, member), 5);
});

test('legacy initiative wraps round after final actor', () => {
  const order = [{ id: 'hero' }, { id: 'enemy' }];
  const second = chroniclesAdvanceInitiative({ order, cursor: 0, round: 1 });
  assert.equal(chroniclesCurrentInitiativeActor(second).id, 'enemy');
  assert.deepEqual([chroniclesAdvanceInitiative(second).cursor, chroniclesAdvanceInitiative(second).round], [0, 2]);
});
