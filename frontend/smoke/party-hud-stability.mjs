import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/party-hud-stability.html';
const browser = await chromium.launch();
const layouts = [
  { width: 1790, height: 860 },
  { width: 1280, height: 760 },
  { width: 1025, height: 720 },
];

async function measure(page) {
  return page.evaluate(() => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
    };
    const party = document.querySelector('.chronicles-party');
    const controls = document.querySelector('.chronicles-touch');
    const nodes = [...controls.querySelectorAll('button')];
    return {
      party: rect(party),
      portraits: [...party.querySelectorAll('.chronicles-party-member, .chronicles-party-hireling')].map(rect),
      map: rect(document.querySelector('.chronicles-minimap')),
      roster: document.querySelector('.chronicles-combat-roster')
        ? rect(document.querySelector('.chronicles-combat-roster')) : null,
      stage: rect(document.querySelector('.chronicles-stage')),
      controls: rect(controls),
      controlsRows: getComputedStyle(controls).gridTemplateRows,
      buttons: Object.fromEntries(nodes.map(node => [
        node.dataset.chroniclesTouchAction, { ...rect(node), pressed: node.dataset.pressed || '' },
      ])),
    };
  });
}

async function addAction(page, id) {
  await page.locator('.chronicles-touch').evaluate((controls, action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = action === 'interact' ? 'is-contextual' : action === 'cast' ? 'is-magic' : 'is-block';
    button.dataset.chroniclesTouchAction = action;
    button.innerHTML = action === 'interact' ? '✦<small>USAR</small>'
      : action === 'cast' ? '✧<small>MAGIA</small>' : '⛨<small>BLOCK</small>';
    button.addEventListener('click', () => { button.dataset.pressed = 'yes'; });
    controls.appendChild(button);
  }, id);
}

async function addCombatRoster(page) {
  await page.locator('.chronicles-stage-wrap').evaluate(main => {
    const section = document.createElement('section');
    section.className = 'chronicles-combat-roster';
    section.setAttribute('aria-label', 'Combate');
    section.innerHTML = `<details><summary>
      <span class="chronicles-combat-roster__heading">Combate · 3 enemigos</span>
      <span class="chronicles-combat-roster__target">Objetivo: goblin de cloaca</span>
      <span class="chronicles-combat-roster__chevron">▾</span>
    </summary><ol aria-label="Enemigos en combate">
      <li data-band="healthy">Goblin de Cloaca</li><li>Goblin de Cloaca</li><li>Goblin de Cloaca</li>
    </ol></details>`;
    main.appendChild(section);
  });
}

async function removeCombatRoster(page) {
  await page.locator('.chronicles-combat-roster').evaluate(node => node.remove());
}

function verifyCombatStable(baseline, current, label, viewport) {
  assert.ok(current.roster, label + ': roster is missing');
  assert.ok(current.roster.height >= 50 && current.roster.bottom <= viewport.height + 1,
    label + ': the combat roster escaped the viewport');
  assert.ok(Math.abs(current.party.y - baseline.party.y) <= 1,
    label + ': opening combat shifted portraits: ' +
      JSON.stringify({ before: baseline.party, after: current.party }));
  assert.ok(Math.abs(current.party.bottom - baseline.party.bottom) <= 1,
    label + ': portrait bottom must remain anchored');
  assert.ok(Math.abs(current.controls.y - baseline.controls.y) <= 1,
    label + ': movement controls moved, instead of the map shrinking');
  assert.ok(current.map.height <= baseline.map.height + 1 && current.map.height >= 140,
    label + ': minimap should use available space, not disappear');
  assert.ok(current.stage.height > 250, label + ': first-person view must remain usable');
  assert.equal(current.controlsRows.split(' ').length, 2);
  for (const [index, portrait] of current.portraits.entries()) {
    assert.ok(portrait.y >= 0 && portrait.bottom <= viewport.height + 1,
      label + ': portrait ' + index + ' clipped: ' + JSON.stringify(portrait));
  }
}

function verifyStable(baseline, current, label, viewport) {
  assert.ok(Math.abs(current.party.y - baseline.party.y) <= 1,
    label + ' moved party strip: ' + JSON.stringify({ baseline: baseline.party, current: current.party }));
  assert.ok(Math.abs(current.map.height - baseline.map.height) <= 1,
    label + ' must not shrink or stretch the minimap');
  assert.ok(Math.abs(current.controls.height - baseline.controls.height) <= 1,
    label + ' increased action panel height');
  assert.equal(current.controlsRows.split(' ').length, 2, label + ' created a third CSS grid row');
  for (const [index, portrait] of current.portraits.entries()) {
    assert.ok(portrait.y >= -1 && portrait.bottom <= viewport.height + 1,
      label + ' clipped portrait ' + index + ': ' + JSON.stringify(portrait));
  }
  for (const [id, button] of Object.entries(current.buttons)) {
    assert.ok(button.y >= current.controls.y - 1
      && button.bottom <= current.controls.bottom + 1, label + ' overflowed action ' + id);
    assert.ok(button.width >= 44 && button.height >= 44,
      label + ' lost touch target for ' + id + ': ' + JSON.stringify(button));
  }
}

try {
  for (const viewport of layouts) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(url, { waitUntil: 'load' });
      const baseline = await measure(page);
      verifyStable(baseline, baseline, 'baseline', viewport);
      await page.screenshot({ path: 'smoke-party-hud-before-' + viewport.width + '.png' });

      // EXACT screenshot regression: no spells, then USAR appears at X13 Y16.
      await addAction(page, 'interact');
      let after = await measure(page);
      verifyStable(baseline, after, 'USAR appears', viewport);
      await page.locator('[data-chronicles-touch-action="interact"]').click();
      assert.equal(await page.locator('[data-chronicles-touch-action="interact"]')
        .getAttribute('data-pressed'), 'yes');
      await page.screenshot({ path: 'smoke-party-hud-after-' + viewport.width + '.png' });

      // CAST and USAR can coexist: both stay clickable on row two.
      await addAction(page, 'cast');
      after = await measure(page);
      verifyStable(baseline, after, 'CAST + USAR', viewport);
      assert.ok(after.buttons.cast.x + after.buttons.cast.width <= after.buttons.interact.x + 1,
        'CAST and USAR overlap horizontally');
      await page.locator('[data-chronicles-touch-action="cast"]').click();
      assert.equal(await page.locator('[data-chronicles-touch-action="cast"]')
        .getAttribute('data-pressed'), 'yes');

      // Combat BLOCK has to occupy a real existing slot, not a third row.
      await addAction(page, 'block');
      after = await measure(page);
      verifyStable(baseline, after, 'BLOCK + CAST + USAR', viewport);
      assert.ok(after.buttons['turn-right'].x + after.buttons['turn-right'].width
        <= after.buttons.block.x + 1, 'BLOCK overlaps the turn controls');
      await page.locator('[data-chronicles-touch-action="block"]').click();
      assert.equal(await page.locator('[data-chronicles-touch-action="block"]')
        .getAttribute('data-pressed'), 'yes');

      // Actual failure from the sewer screenshot: combat roster injects a
      // right-rail track, yet all six portraits must stay in the viewport.
      await addCombatRoster(page);
      let combat = await measure(page);
      verifyCombatStable(after, combat, 'combat begins', viewport);
      const details = page.locator('.chronicles-combat-roster details');
      await details.locator('summary').click();
      combat = await measure(page);
      verifyCombatStable(after, combat, 'enemy list expanded', viewport);
      await page.screenshot({ path: 'smoke-party-hud-combat-' + viewport.width + '.png' });
      await details.locator('summary').click();
      await removeCombatRoster(page);
      const restored = await measure(page);
      verifyStable(baseline, restored, 'combat ends', viewport);

      assert.deepEqual(errors, []);
      console.log('OK MM3 party HUD stays fixed across optional controls', viewport.width, viewport.height);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
