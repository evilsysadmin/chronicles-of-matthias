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

test('public combat saves through the real menu action, including its keyboard hint', () => {
  const menu = readFileSync('frontend/src/components/ChroniclesAdventureMenu.jsx', 'utf8');
  assert.ok(menu.includes('data-chronicles-menu-save'));
  assert.ok(menu.includes('Guardar partida · S'));
  assert.ok(source.includes("page.locator('[data-chronicles-menu-save]').click()"));
  assert.doesNotMatch(source, /getByRole\('button', \{ name: 'Guardar partida', exact: true \}\)/);
});

test('public B1 respects the combat save lock and defeats the real pawn before F5', () => {
  const menu = readFileSync('frontend/src/components/ChroniclesAdventureMenu.jsx', 'utf8');
  assert.ok(menu.includes('disabled={saveBusy || inCombat}'), 'Save must stay locked in initiative');
  const combat = source.indexOf("const combatRail = page.locator('[data-chronicles-initiative=");
  const victory = source.indexOf("assert.equal(await combatRail.count(), 0");
  const save = source.indexOf("await page.locator('[data-chronicles-menu-save]').click()");
  assert.ok(combat >= 0 && combat < victory && victory < save,
    'Real initiative and victory must precede the manual checkpoint');
  assert.ok(source.includes("await page.getByRole('button', { name: 'Cerrar menú' }).click()"));
  assert.ok(source.includes("assert.equal(enemyHp, 0"));
  assert.ok(source.includes('Saving must become available after victory'));
});

test('public B1 blocks out-of-range heroes instead of fabricating a melee hit', () => {
  const ui = readFileSync('frontend/src/components/ChroniclesOfMatthias.jsx', 'utf8');
  assert.ok(ui.includes('data-melee-ready={!touchWillShoot ? String(meleeReady) : undefined}'));
  assert.ok(ui.includes('data-chronicles-touch-action="block"'));
  assert.ok(source.includes("const actionKey = canMelee ? 'a' : 'b'"));
  assert.ok(source.includes("await attackButton.getAttribute('data-melee-ready') === 'true'"));
  assert.ok(source.includes('await attackButton.isEnabled()'));
  assert.ok(source.includes('await page.keyboard.press(actionKey)'));
  assert.ok(source.includes('CHRONICLES_PUBLIC_COMBAT_ACTION'));
});

test('initiative and save lock are verified before any potentially lethal attack', () => {
  const initiative = source.indexOf("assert.equal(await combatRail.count(), 1");
  const saveLock = source.indexOf("assert.equal(await page.locator('[data-chronicles-menu-save]').isDisabled(), true");
  const combatActions = source.indexOf("let usedTouch = false");
  assert.ok(initiative >= 0 && initiative < saveLock && saveLock < combatActions,
    'Combat must be observed before attacks can end it');
  assert.doesNotMatch(source.slice(0, initiative), /page\\.keyboard\\.press\\('a'\\)|touch-action="attack"'\\]\\)\\.click/);
  assert.ok(source.includes("assert.ok(usedTouch, 'The encounter must exercise a real mobile combat control')"));
  assert.ok(source.includes("await touchAction.click()"));
  assert.ok(source.includes("await page.keyboard.press(actionKey)"));
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
  assert.ok(source.includes("assert.equal(resumed.worldFlags?.enemyHp, 0"),
    'The live F5 smoke must reject resurrection of the defeated enemy');
  assert.ok(source.includes("Number(flags['__chrRuntime.turns'])"));
  assert.ok(source.includes("'/bootstrap'") || source.includes(" + '/bootstrap'"));
});
