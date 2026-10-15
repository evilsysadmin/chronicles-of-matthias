import test from 'node:test';
import assert from 'node:assert/strict';
import { chroniclesCheckpointReason } from '../src/chronicles/chroniclesSavePolicy.js';

test('manual saves are always permitted', () => assert.equal(chroniclesCheckpointReason('a', 'a', true), 'manual'));
test('area transition checkpoints', () => assert.equal(chroniclesCheckpointReason('town', 'dungeon'), 'area-change'));
test('walking inside an area does not persist', () => assert.equal(chroniclesCheckpointReason('town', 'town'), null));
test('unknown map ids do not checkpoint', () => assert.equal(chroniclesCheckpointReason(null, 'town'), null));
