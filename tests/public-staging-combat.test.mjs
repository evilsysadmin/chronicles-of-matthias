import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('frontend/smoke/public-staging-combat.mjs', 'utf8');
test('only shared SSO handshake is mocked; crypt enemy and damage stay real', () => {
  for (const k of ["'swordhaven-square'", "'crypt-eight-squares'", "'ArrowDown'", "'ArrowUp'", "'s'", "'a'",
    '[data-chronicles-touch-action="attack"]', "flags.enemyHp", "__chrRuntime.initiative",
    "CHRONICLES_PUBLIC_COMBAT_OK", "CHRONICLES_SOURCE_SHA",
    "CHRONICLES_STAGING_INVITE_CODE", "'/auth/delete-account'"]) {
    assert.ok(source.includes(k), k);
  }
  assert.ok(source.includes("page.route('https://api-staging.chess-studio"));
  assert.doesNotMatch(source, /page\.route\([^)]*chronicles-api-staging/);
  assert.doesNotMatch(source, /route\.fulfill\([^)]*enemyHp/);
});
