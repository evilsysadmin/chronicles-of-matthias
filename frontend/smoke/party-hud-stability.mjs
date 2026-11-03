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
      hpBars: [...party.querySelectorAll('.chronicles-party-member .chronicles-party-bars .is-hp')].map(rect),
      manaBars: party.querySelectorAll('.chronicles-party-member .chronicles-party-bars .is-sp').length,
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

// Read computed typography and painted bounds, not just CSS strings.
async function assertActionCaptions(page, label, isTouch) {
  const captions = await page.locator('.chronicles-touch button small').evaluateAll(nodes =>
    nodes.map(node => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const parent = node.closest('button').getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(node);
      return {
        text: node.textContent.trim(),
        font: parseFloat(style.fontSize),
        width: box.width,
        textWidth: range.getBoundingClientRect().width,
        left: box.left,
        right: box.right,
        parentLeft: parent.left,
        parentRight: parent.right,
        hidden: box.width <= 2 || box.height <= 2 || style.visibility === 'hidden',
      };
    }).filter(node => !node.hidden)
  );
  const expected = isTouch ? ['MATTHIAS', 'MAGIA', 'USAR', 'BLOCK']
    : ['MATTHIAS', 'MAGIA', 'USAR'];
  for (const word of expected) {
    const item = captions.find(caption => caption.text === word);
    assert.ok(item, label + ': missing caption ' + word + ' ' + JSON.stringify(captions));
    assert.ok(item.font >= (word === 'MATTHIAS' ? 10 : isTouch ? 11 : 12),
      label + ': action caption has microscopic type ' + JSON.stringify(item));
    assert.ok(item.width > 10 && item.left >= item.parentLeft - 2
      && item.right <= item.parentRight + 2,
      label + ': action caption spills out of its button ' + JSON.stringify(item));
    if (word !== 'MATTHIAS') {
      assert.ok(item.textWidth <= item.width + 2,
        label + ': short action label must not be ellipsized ' + JSON.stringify(item));
    }
  }
}

async function addCombatRoster(page) {
  await page.locator('.chronicles-stage-wrap').evaluate(main => {
    const section = document.createElement('section');
    section.className = 'chronicles-combat-roster';
    section.setAttribute('aria-label', 'Combate');
    const enemies = Array.from({ length: 22 }, (_, index) =>
      `<li data-band="${index < 8 ? 'healthy' : index < 15 ? 'hurt' : 'critical'}"
          data-target="${index === 0 ? 'true' : 'false'}">
          Goblin de Cloaca ${index + 1}</li>`).join('');
    section.innerHTML = `<div class="chronicles-combat-roster__desktop">
      <header class="chronicles-combat-roster__desktop-header">
        <strong>Combate · 22 enemigos</strong><small>Objetivo: goblin de cloaca</small>
      </header>
      <ol aria-label="Enemigos en combate">${enemies}</ol>
    </div>
    <details class="chronicles-combat-roster__compact">
      <summary><span class="chronicles-combat-roster__heading">Combate · 22 enemigos</span>
        <span class="chronicles-combat-roster__target">Objetivo: goblin de cloaca</span>
        <span class="chronicles-combat-roster__chevron">▾</span></summary>
      <ol aria-label="Enemigos en combate">${enemies}</ol>
    </details>`;
    main.appendChild(section);
  });
}

async function removeCombatRoster(page) {
  await page.locator('.chronicles-combat-roster').evaluate(node => node.remove());
}

function verifyCombatStable(baseline, current, label, viewport) {
  assert.ok(current.roster, label + ': roster is missing');
  assert.ok(Math.abs(current.roster.x - baseline.map.x) <= 1
    && Math.abs(current.roster.y - baseline.map.y) <= 1,
    label + ': roster must replace the minimap in exactly the same slot');
  assert.ok(Math.abs(current.roster.height - baseline.map.height) <= 1,
    label + ': roster must keep the minimap slot height');
  assert.equal(current.map.height, 0, label + ': minimap must be hidden while fighting');
  assert.ok(current.roster.bottom <= viewport.height + 1,
    label + ': the combat roster escaped the viewport');
  assert.ok(Math.abs(current.party.y - baseline.party.y) <= 1
    && Math.abs(current.party.bottom - baseline.party.bottom) <= 1,
    label + ': starting combat moved the six portraits');
  assert.ok(Math.abs(current.controls.y - baseline.controls.y) <= 1,
    label + ': the movement controls must never shift');
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
      // A non-caster renders no PH bar, but still reserves its second row:
      // the PV row must align with all three casters (the original regression).
      assert.equal(baseline.hpBars.length, 4, 'All four heroes need a PV bar');
      assert.equal(baseline.manaBars, 3, 'Only the three casters have PH');
      const hpY = baseline.hpBars[0].y;
      for (const [index, bar] of baseline.hpBars.entries()) {
        assert.ok(Math.abs(bar.y - hpY) <= 1,
          'Hero ' + (index + 1) + ' PV bar is vertically misaligned: ' + JSON.stringify(baseline.hpBars));
      }
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
      await assertActionCaptions(page, 'desktop ' + viewport.width, false);

      // Actual failure from the sewer screenshot: combat roster injects a
      // right-rail track, yet all six portraits must stay in the viewport.
      await addCombatRoster(page);
      let combat = await measure(page);
      verifyCombatStable(after, combat, 'combat begins', viewport);
      // No accordion on desktop: all 22 entries are in the visible, scrollable
      // list from the first combat frame; nothing overflows into portraits.
      const rosterList = page.locator('.chronicles-combat-roster__desktop ol');
      assert.equal(await rosterList.isVisible(), true);
      assert.equal(await page.locator('.chronicles-combat-roster__compact').isVisible(), false);
      assert.equal(await rosterList.locator('li').count(), 22);
      const size = await rosterList.evaluate(element => ({
        client: element.clientHeight, scroll: element.scrollHeight,
        initialTop: element.scrollTop,
      }));
      assert.ok(size.scroll > size.client, 'Long combat roster must have internal scroll');
      await rosterList.evaluate(element => { element.scrollTop = element.scrollHeight; });
      assert.ok(await rosterList.evaluate(element => element.scrollTop > 0),
        'User must be able to reach the last enemies without opening a disclosure');
      combat = await measure(page);
      verifyCombatStable(after, combat, 'long enemy list scrolled', viewport);
      await page.screenshot({ path: 'smoke-party-hud-combat-' + viewport.width + '.png' });
      await removeCombatRoster(page);
      const restored = await measure(page);
      verifyStable(baseline, restored, 'combat ends', viewport);

      assert.deepEqual(errors, []);
      console.log('OK MM3 party HUD stays fixed across optional controls', viewport.width, viewport.height);
    } finally {
      await context.close();
    }
  }

  // A second, mobile-specific pass keeps the actual HP/SP fractions legible
  // rather than merely asserting that tiny bars exist. No new CI fixture.
  for (const viewport of [
    { width: 360, height: 780 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(url, { waitUntil: 'load' });
      // Check the real MM3 movement and combat controls, including contextual
      // actions that only appear during spells, combat or object interaction.
      await addAction(page, 'cast');
      await addAction(page, 'interact');
      await addAction(page, 'block');
      await assertActionCaptions(page, 'touch ' + viewport.width, true);
      const m = await page.evaluate(() => {
        const bounds = node => {
          const r = node.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        };
        const party = document.querySelector('.chronicles-party');
        const map = document.querySelector('.chronicles-minimap');
        const heroes = [...party.querySelectorAll('.chronicles-party-member')];
        return {
          party: bounds(party), map: bounds(map),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          heroes: heroes.map(hero => ({
            box: bounds(hero),
            bars: [...hero.querySelectorAll('.chronicles-party-bars i')].map(bar => {
              const value = bar.querySelector('span');
              const range = document.createRange();
              range.selectNodeContents(value);
              const text = range.getBoundingClientRect();
              return {
                value: value.textContent.trim(), box: bounds(bar),
                fontSize: parseFloat(getComputedStyle(bar).fontSize),
                textWidth: text.width,
              };
            }),
          })),
        };
      });
      assert.equal(errors.length, 0, 'No mobile HUD script errors');
      assert.equal(m.overflow, false, 'Mobile HUD must not scroll horizontally: ' + JSON.stringify(m));
      assert.equal(m.heroes.length, 4, 'Four visible heroes stay in one row');
      assert.ok(m.party.right <= m.map.left - 2 || m.party.bottom <= m.map.top,
        'Readability must not move the party over the minimap: ' + JSON.stringify(m));
      const values = m.heroes.flatMap(hero => hero.bars);
      assert.equal(values.length, 7, 'Four HP bars and three caster SP bars');
      assert.deepEqual(m.heroes.map(hero => hero.bars.length), [1, 2, 2, 2],
        'No invented PH bar on the non-caster');
      for (const hero of m.heroes) {
        assert.ok(hero.box.width >= 48 && hero.box.height >= 48,
          'Portrait target must stay comfortably usable: ' + JSON.stringify(hero));
        for (const bar of hero.bars) {
          assert.ok(bar.fontSize >= 12 && bar.box.height >= 14,
            'PV/PH must not revert to the 7px microtype: ' + JSON.stringify({viewport, bar}));
          assert.ok(bar.textWidth <= bar.box.width - 2,
            'Full current/max fraction must fit its bar: ' + JSON.stringify({viewport, bar}));
          assert.ok(bar.box.left >= hero.box.left - 1 && bar.box.right <= hero.box.right + 1
            && bar.box.top >= hero.box.top - 1 && bar.box.bottom <= hero.box.bottom + 1,
          'PV/PH cannot escape the corresponding portrait: ' + JSON.stringify({viewport, hero, bar}));
        }
      }
      if (viewport.width === 360 || viewport.width === 390 || viewport.width === 430) {
        await page.screenshot({path: 'smoke-mobile-vitals-' + viewport.width + '.png'});
      }
      console.log('CHRONICLES_MOBILE_VITALS_READABLE_OK', viewport.width, viewport.height);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
