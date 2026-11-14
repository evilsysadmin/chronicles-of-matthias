import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  REAR_SHOOTER_MAP_ID, REAR_SHOOTER_ENEMY_ID, REAR_SHOOTER_ROUTE,
} from '../frontend/smoke/public-rear-shooter-route.mjs';

const existing = readFileSync('frontend/smoke/public-staging-combat.mjs', 'utf8');
const rear = readFileSync('frontend/smoke/public-staging-rear-shooter.mjs', 'utf8');

test('public staging release gates the real Swordhaven rear shooter after cleaning the crypt account', () => {
  const cleanup = existing.lastIndexOf("await fetch(api + '/auth/delete-account'");
  const call = existing.lastIndexOf("await import('./public-staging-rear-shooter.mjs')");
  assert.ok(cleanup > 0 && call > cleanup,
    'New browser test must be invoked after independent legacy-account cleanup');
  assert.equal(REAR_SHOOTER_MAP_ID, 'swordhaven-first-book');
  assert.equal(REAR_SHOOTER_ENEMY_ID, 'swordhaven-false-watch-recruit');
  assert.ok(REAR_SHOOTER_ROUTE.length >= 16, 'No abbreviated/teleported public walk');
});

test('rear shooter uses the official API, real player inputs and a durable checkpoint with F5', () => {
  for (const marker of [
    'CHRONICLES_SOURCE_SHA', 'CHRONICLES_STAGING_INVITE_CODE',
    "'/auth/register'", "'/chronicles/runs'", "mapId: REAR_SHOOTER_MAP_ID",
    '[data-chronicles-primary-action="continue"] button.is-primary',
    'for (const step of REAR_SHOOTER_ROUTE) await commitKey(step.action, step)',
    "commitKey('ArrowDown'", "commitKey('ArrowRight'",
    "await page.keyboard.press('s')", 'facingShooter.turns + 1',
    "[data-chronicles-touch-action=\"attack\"]",
    "'/checkpoint'", "'/bootstrap'", 'page.reload',
    'CHRONICLES_PUBLIC_REAR_RESPONSE_OK', 'CHRONICLES_PUBLIC_REAR_RESTORE_OK',
    'CHRONICLES_PUBLIC_REAR_SHOOTER_OK',
  ]) assert.ok(rear.includes(marker), 'Required real browser gate missing: ' + marker);
  assert.match(rear, /assert\.equal\(after\.initiative, false/);
  assert.match(rear, /assert\.equal\(after\.turns, before\.turns \+ 1/);
  assert.ok(rear.includes("page.route('https://api-staging.chess-studio"), 'Only IdP handoff may be mocked');
  assert.doesNotMatch(rear, /page\.route\([^)]*chronicles-api-staging/,
    'Never mock the game API or the enemy');
  assert.doesNotMatch(rear, /route\.fulfill\([^)]*(?:enemyHp|worldFlags|chronicles\/runs)/);
});

test('rear staging failure still captures an included screenshot and revokes its temporary account', () => {
  const guard = rear.indexOf('try {');
  const create = rear.indexOf("const creation = await fetch(api + '/chronicles/runs'");
  const cleanup = rear.lastIndexOf('} finally {');
  const deletion = rear.indexOf("await fetch(api + '/auth/delete-account'");
  assert.ok(guard > 0 && create > guard && cleanup > create && deletion > cleanup);
  assert.ok(rear.includes('if (!finished) await page?.screenshot'));
  assert.ok(rear.includes('chronicles-public-rear-shooter-failure.png'),
    'Infra screenshot upload collects chronicles-public-*.png');
  assert.ok(rear.includes('chronicles-public-rear-shooter.png'));
  assert.doesNotMatch(rear, /console\.log\([^\n]*\b(?:token|password|invite)\b/);
});

test('both public staging browser modules have valid native Node syntax', () => {
  for (const path of [
    'frontend/smoke/public-staging-combat.mjs',
    'frontend/smoke/public-staging-rear-shooter.mjs',
  ]) {
    const checked = spawnSync(process.execPath, ['--check', path], {
      encoding: 'utf8', timeout: 10000,
    });
    assert.equal(checked.status, 0, path + ': ' + checked.stderr);
  }
});
