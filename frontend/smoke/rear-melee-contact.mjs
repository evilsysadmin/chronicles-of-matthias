// Real React browser + authored map + reducer. This is a local CI fixture,
// distinct from public staging: never claim it uses a live account or API.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/rear-melee-contact.html';
const browser = await chromium.launch();
try {
  for (const scenario of [
    { name: 'sewer', map: 'swordhaven-sewers', enemy: 'sewers-goblin-west', facing: '2', road: false },
    { name: 'road', map: 'banner-road-first-book', enemy: 'banner-road-north-marauder', facing: '0', road: true },
  ]) {
  for (const mobile of [false, true]) {
    const width = mobile ? 390 : 1280;
    const context = await browser.newContext({
      viewport: { width, height: mobile ? 844 : 800 },
      isMobile: mobile, hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(url + (scenario.road ? '?road=1' : ''), { waitUntil: 'domcontentloaded' });
      const probe = page.locator('[data-qa-rear-melee="true"]');
      await probe.waitFor({ state: 'visible', timeout: 20_000 });
      assert.equal(await probe.getAttribute('data-qa-map'), scenario.map);
      assert.equal(await probe.getAttribute('data-qa-enemy'), scenario.enemy);
      assert.equal(await probe.getAttribute('data-qa-phase'), 'combat');
      assert.equal(await probe.getAttribute('data-qa-target'), scenario.enemy,
        'The authored attacker must be a legal adjacent melee target');
      assert.equal(await probe.getAttribute('data-qa-facing'), scenario.facing,
        'Live contact faces the attacker; a restored legacy checkpoint preserves its fixed yaw');
      const minimap = probe.locator('[data-chronicles-minimap-facing="' + scenario.facing + '"]');
      await minimap.waitFor({ state: 'attached' });
      await probe.locator('.chronicles-combat-roster').waitFor({ state: 'visible' });
      assert.equal(await probe.locator('.chronicles-combat-roster [data-target="true"]').count(), 2,
        'Both desktop and mobile rosters must identify the actual melee target');
      assert.equal(await probe.locator('[data-chronicles-target-mode="melee"]').count(), 2,
        'The HUD must offer A against the offscreen engaged enemy');
      const before = Number(await probe.getAttribute('data-qa-turns'));
      // Direction controls must be impossible within initiative: no hidden
      // turn, phantom tick, camera rotation or stolen action.
      for (const button of ['[data-qa-turn-left]', '[data-qa-turn-right]']) {
        if (mobile) await probe.locator(button).tap();
        else await probe.locator(button).click();
        assert.equal(await probe.getAttribute('data-qa-facing'), scenario.facing);
        assert.equal(Number(await probe.getAttribute('data-qa-turns')), before);
        assert.equal(await probe.getAttribute('data-qa-target'), scenario.enemy);
      }
      const strike = probe.locator('[data-qa-attack]');
      assert.equal(await strike.isEnabled(), true, 'Rear-contact melee must be playable');
      if (mobile) await strike.tap();
      else await strike.click();
      await page.waitForFunction(previous => Number(
        document.querySelector('[data-qa-rear-melee]')?.getAttribute('data-qa-turns')
      ) > previous, before, { timeout: 10_000 });
      const after = Number(await probe.getAttribute('data-qa-turns'));
      assert.equal(after, before + 1, 'An actual melee attack must spend exactly one action');
      assert.equal(await probe.getAttribute('data-qa-facing'), scenario.facing,
        'Combat action must not rotate the party a second time');
      // The game intentionally disallows manual saves during initiative; this
      // QA-only checkpoint roundtrip tests the real serializer without
      // enabling an illicit in-combat Save button in production.
      if (mobile) await probe.locator('[data-qa-checkpoint]').tap();
      else await probe.locator('[data-qa-checkpoint]').click();
      await page.waitForFunction(() =>
        document.querySelector('[data-qa-rear-melee]')?.getAttribute('data-qa-restores') === '1');
      assert.equal(await probe.getAttribute('data-qa-facing'), scenario.facing);
      assert.equal(Number(await probe.getAttribute('data-qa-turns')), after);
      await page.screenshot({ path: `smoke-rear-melee-contact-${scenario.name}-${width}.png` });
      assert.deepEqual(errors, [], 'Browser exceptions while resolving rear melee');
      console.log('CHRONICLES_REAR_MELEE_BROWSER_OK scenario=' + scenario.name + ' viewport=' + width
        + ' attack=1 locked_turns=2 checkpoint=1');
    } finally {
      await context.close();
    }
  }
  }
} finally {
  await browser.close();
}
