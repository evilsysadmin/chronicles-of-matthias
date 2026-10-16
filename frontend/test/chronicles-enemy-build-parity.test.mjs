import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chroniclesEnemyFallbackAgility,
  deriveLegacyChroniclesEnemyBuild,
  resolveChroniclesEnemyBuildDefinition,
  chroniclesEnemyBuildModifiers,
  validateChroniclesEnemyBuild,
} from '../src/chronicles/chroniclesEnemyBuilds.js';

// Source: chess-studio/frontend/src/chronicles/chroniclesEnemyBuilds.js
// Pinned source snapshot: 55e95f75d5c417e95dbe39f87c9e2732bf3736fa
// The existing standalone module has the same Git blob SHA as source:
// 4ffd3879e95714ffbcf91cf750db626738b12600.
test('legacy enemy movement determines agility', () => {
  assert.equal(chroniclesEnemyFallbackAgility({ ai: { movement: 'knight-chase' } }), 4);
  assert.equal(chroniclesEnemyFallbackAgility({ ai: { movement: 'patrol-route' } }), 3);
  assert.equal(chroniclesEnemyFallbackAgility({ ai: { movement: 'hold' } }), 1);
  assert.equal(chroniclesEnemyFallbackAgility({}), 2);
});

test('legacy enemy builds remain resolvable without authored data', () => {
  const enemy = { id: 'skeleton', maxHp: 3, retaliation: 1, retaliationReach: 1, ai: { movement: 'knight-chase' } };
  const result = deriveLegacyChroniclesEnemyBuild(enemy);
  assert.equal(result.source, 'derived-legacy');
  assert.equal(result.build.attributes.agility, 4);
  assert.equal(resolveChroniclesEnemyBuildDefinition(enemy).source, 'derived-legacy');
  assert.ok(result.baseStats.maxHp >= 1);
});

test('authored agility and skill modifiers are retained', () => {
  const enemy = { id: 'guard', maxHp: 5, enemyBuild: { level: 2, attributes: { agility: 5 }, skills: ['brutal-strike'] } };
  const resolved = resolveChroniclesEnemyBuildDefinition(enemy);
  assert.equal(resolved.source, 'authored');
  assert.equal(resolved.build.attributes.agility, 5);
  assert.equal(chroniclesEnemyBuildModifiers(resolved.build).damageBonus, 1);
});

test('invalid authored builds fail closed', () => {
  assert.equal(validateChroniclesEnemyBuild({ level: 999 }).valid, false);
  assert.equal(resolveChroniclesEnemyBuildDefinition({ enemyBuild: { level: 999 } }).source, 'invalid');
});
