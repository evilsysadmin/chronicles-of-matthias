import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CRYPT_MAP } from './crypt-map.js';
import {
  DIRECTIONS, activeEnemies, cellAt, contentPosition,
  createExplorationState, explorationStep, visibleInteraction,
} from './exploration-core.js';

test('the extracted map is the original authored crypt, including encounters and content', () => {
  assert.equal(CRYPT_MAP.id, 'crypt-eight-squares');
  assert.equal(CRYPT_MAP.version, 11);
  assert.deepEqual(CRYPT_MAP.grid, [
    '#######', '#..X..#', '#.###.#', '#...#.#',
    '#.#S#.#', '#P.E..#', '#######',
  ]);
  assert.equal(CRYPT_MAP.enemies.length, 4);
  assert.deepEqual(contentPosition(CRYPT_MAP.triggers[0]), { x: 3, y: 4 });
  assert.deepEqual(contentPosition(CRYPT_MAP.exits[0]), { x: 3, y: 1 });
  assert.equal(CRYPT_MAP.interactables[0].id, 'rune-cache-lever');
  assert.equal(DIRECTIONS.length, 4);
});

test('starting coordinates, facing and dormant enemy activation follow the map', () => {
  const state = createExplorationState();
  assert.equal(state.x, 1);
  assert.equal(state.y, 5);
  assert.equal(state.direction, 1);
  assert.equal(state.turns, 0);
  assert.deepEqual(activeEnemies(state).map((e) => e.id), ['corrupted-pawn']);
});

test('movement, turns and solid wall use the original first-person grid contract', () => {
  const start = createExplorationState();
  const forward = explorationStep(start, 'forward');
  assert.deepEqual([forward.x, forward.y, forward.turns], [2, 5, 1]);
  const blocked = explorationStep(forward, 'strafe-left');
  assert.deepEqual([blocked.x, blocked.y, blocked.turns], [2, 5, 2]);
  assert.match(blocked.message, /pared/);
  const backwards = explorationStep(start, 'backward');
  assert.deepEqual([backwards.x, backwards.y, backwards.turns], [1, 5, 1]);
  assert.equal(cellAt(-1, 5), '#');
  assert.equal(cellAt(300, 300), '#');
  assert.deepEqual([start.x, start.y, start.turns], [1, 5, 0]); // immutable
});

test('real enemies block navigation; dormant enemies are not invented', () => {
  const first = explorationStep(createExplorationState(), 'forward');
  const blocked = explorationStep(first, 'forward');
  assert.deepEqual([blocked.x, blocked.y, blocked.turns], [2, 5, 2]);
  assert.match(blocked.message, /Peón corrompido|peón corrompido/i);
  assert.equal(activeEnemies(blocked).length, 1);
});

test('rotate and strafe to the genuine sigil tile to activate authored enemies', () => {
  let state = createExplorationState();
  for (const move of ['strafe-left', 'strafe-left', 'forward', 'forward', 'strafe-right']) {
    state = explorationStep(state, move);
  }
  assert.deepEqual([state.x, state.y, state.turns], [3, 4, 5]);
  assert.equal(state.sigilAwake, true);
  assert.equal(activeEnemies(state).length, 3); // fourth requires fallen jailer
  assert.ok(state.journal.some((entry) => entry.id === 'tactics-sigil-awake'));
  const revisit = explorationStep(explorationStep(state, 'backward'), 'forward');
  assert.equal(revisit.journal.length, state.journal.length); // no duplicate event
});

test('closed gate uses authored requirement and never changes to a missing region', () => {
  const nearGate = { ...createExplorationState(), x: 3, y: 2, direction: 0 };
  const result = explorationStep(nearGate, 'forward');
  assert.equal(result.mapId, CRYPT_MAP.id);
  assert.deepEqual([result.x, result.y], [3, 2]);
  assert.match(result.message, /sello|Puerta Negra/i);
});

test('lever works with authored set effect; unported rune rewards do not masquerade as collected', () => {
  let state = { ...createExplorationState(), x: 5, y: 5, direction: 0 };
  assert.equal(visibleInteraction(state)?.id, 'rune-cache-lever');
  state = explorationStep(state, 'interact');
  assert.equal(state.runeCacheOpened, true);
  assert.ok(state.journal.some((entry) => entry.id === 'tactics-rune-cache-open'));
  assert.equal(visibleInteraction(state)?.id, 'rune-core');
  state = explorationStep(state, 'interact');
  assert.equal(state.runeCoreCollected, false);
  assert.match(state.message, /motor completo/);
});

test('invalid actions and phases cannot advance exploration', () => {
  const state = createExplorationState();
  assert.equal(explorationStep(state, 'attack'), state);
  assert.equal(explorationStep({ ...state, phase: 'combat' }, 'forward').x, state.x);
  assert.deepEqual(
    [explorationStep(state, 'turn-left').direction, explorationStep(state, 'turn-right').direction],
    [0, 2],
  );
});
