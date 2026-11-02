import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = readFileSync('frontend/smoke/public-staging-combat.mjs', 'utf8');
test('only shared SSO handshake is mocked; crypt enemy and damage stay real', () => {
  for (const k of ["'crypt-eight-squares'", "'ArrowUp'", "'s'", "'a'",
    '[data-chronicles-touch-action="attack"]', "flags.enemyHp", "__chrRuntime.initiative",
    "CHRONICLES_PUBLIC_COMBAT_OK", "CHRONICLES_SOURCE_SHA",
    "CHRONICLES_STAGING_INVITE_CODE", "'/auth/delete-account'"]) {
    assert.ok(source.includes(k), k);
  }
  assert.ok(source.includes("page.route('https://api-staging.chess-studio"));
  assert.doesNotMatch(source, /page\.route\([^)]*chronicles-api-staging/);
  assert.doesNotMatch(source, /route\.fulfill\([^)]*enemyHp/);
});

test('public combat creates an official crypt run and resumes it via Home', () => {
  const menu = readFileSync('frontend/src/components/ChroniclesSaveMenu.jsx', 'utf8');
  assert.ok(menu.includes('data-chronicles-primary-action={resume ? \'continue\' : \'new\'}'));
  assert.ok(source.includes("body: JSON.stringify({ mapId: 'crypt-eight-squares' })"));
  assert.ok(source.includes("Authorization: 'Bearer ' + token"));
  assert.ok(source.includes('[data-chronicles-primary-action="continue"] button.is-primary'));
  assert.doesNotMatch(source, /assert\.equal\(game\.currentMapId, 'swordhaven-square'/);
  assert.doesNotMatch(source, /getByRole\('button', \{ name: \/Otra aventura\//);
  assert.ok(source.includes("chronicles-combat-failure.png"));
  assert.ok(source.includes('if (!completed) await page?.screenshot'));
});

test('a failed crypt creation remains inside the temporary-account cleanup guard', () => {
  const guard = source.indexOf('try {');
  const create = source.indexOf("const expedition = await fetch(api + '/chronicles/runs'");
  const cleanup = source.lastIndexOf('} finally {');
  const deleteAccount = source.indexOf("await fetch(api + '/auth/delete-account'");
  assert.ok(guard >= 0 && guard < create, 'Crypt creation must be inside the try block');
  assert.ok(create < cleanup && cleanup < deleteAccount, 'Creation failures must reach account deletion');
});

test('public crypt browser smoke passes native Node parse check before release', () => {
  const checked = spawnSync(process.execPath, ['--check', 'frontend/smoke/public-staging-combat.mjs'],
    { encoding: 'utf8', timeout: 10000 });
  assert.equal(checked.status, 0, checked.stderr);
});

test('combat is proven by a read of the durable backend state, not fabricated damage', () => {
  assert.ok(source.includes("'/bootstrap'"));
  assert.ok(source.includes("CHRONICLES_PUBLIC_COMBAT_STATE"));
  assert.ok(source.includes("saved.worldFlags"));
  assert.ok(!source.includes("const checkpoint = page.waitForResponse"));
});

test('live combat diagnostics describe server and UI without tokens', () => {
  assert.ok(source.includes('CHRONICLES_PUBLIC_COMBAT_SAVE'));
  assert.ok(source.includes('CHRONICLES_PUBLIC_COMBAT_STATE'));
  assert.ok(source.includes('Partida guardada correctamente.'));
  assert.ok(source.includes("chronicles-combat-mobile.png"));
  assert.doesNotMatch(source, /console\.log\([^\n]*\btoken\b/);
});

test('combat actions wait for actual crypt render and a real turn', () => {
  assert.ok(source.includes('[data-chronicles="true"][data-chronicles-map-id="crypt-eight-squares"]'));
  assert.ok(source.includes('CHRONICLES_PUBLIC_COMBAT_CRYPT_READY'));
  assert.ok(source.includes('data-chronicles-turns'));
  assert.ok(source.indexOf("crypt.waitFor") < source.indexOf("page.keyboard.press('s')"));
  assert.ok(source.indexOf("page.waitForFunction(previous") < source.indexOf("page.keyboard.press('ArrowUp')"));
  assert.ok(source.includes('assert.equal(afterVolleyTurns, cryptTurns + 1'),
    'The live browser smoke must reject a duplicated volley exploration tick');
  assert.ok(source.includes('CHRONICLES_PUBLIC_COMBAT_RESTORE_OK'),
    'The public combat smoke must verify browser reload after the real save');
  assert.ok(source.includes("await page.reload({ waitUntil: 'domcontentloaded' })"));
  assert.ok(source.includes("assert.equal(resumed.runId, game.runId"));
  assert.ok(source.includes("Number(flags['__chrRuntime.turns'])"));
  assert.ok(source.includes("'/bootstrap'") || source.includes(" + '/bootstrap'"));
});
