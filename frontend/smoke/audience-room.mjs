import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/audience-room.html';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [844, 390], [1280, 800]]) {
    for (const [npc, expected, roomId] of [
      ['aldric', 'Alcalde Aldric', 'aldric-hall'],
      ['brask', 'Sargento Brask', 'watch-house'],
    ]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.goto(url + '?npc=' + npc, { waitUntil: 'load' });
        const modal = page.getByRole('dialog', { name: 'Conversación con ' + expected });
        await modal.waitFor({ state: 'visible' });
        const scene = modal.locator('[data-chronicles-audience-room="' + roomId + '"]');
        const picture = scene.locator('img');
        await page.waitForFunction(() => {
          const img = document.querySelector('.chronicles-audience__scene img');
          return img && img.complete && img.naturalWidth >= 1000 && img.naturalHeight >= 700;
        });
        const geometry = await page.evaluate(() => {
          const dlg = document.querySelector('.chronicles-audience');
          const image = document.querySelector('.chronicles-audience__scene');
          const panel = document.querySelector('.chronicles-audience__dialogue');
          const close = document.querySelector('[aria-label="Salir de la conversación"]');
          const rect = (node) => {
            const r = node.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
          };
          const closeRect = close.getBoundingClientRect();
          const top = document.elementFromPoint(closeRect.x + closeRect.width / 2, closeRect.y + closeRect.height / 2);
          return {
            dialog: rect(dlg), scene: rect(image), panel: rect(panel),
            close: rect(close), closeOnTop: top === close || close.contains(top),
            scenePointer: getComputedStyle(image).pointerEvents,
            artworkRendering: getComputedStyle(image.querySelector('img')).imageRendering,
            overflow: document.documentElement.scrollWidth,
            modalInBody: dlg.parentElement.parentElement === document.body,
          };
        });
        assert(geometry.modalInBody && geometry.closeOnTop,
          'Audience must escape the first-person stacking context: ' + JSON.stringify(geometry));
        assert(geometry.dialog.x >= -1 && geometry.dialog.right <= width + 1
          && geometry.dialog.y >= -1 && geometry.dialog.bottom <= height + 1,
          'Audience must stay inside viewport: ' + JSON.stringify(geometry));
        assert(geometry.overflow <= width + 1, 'Audience adds horizontal scroll');
        assert.equal(geometry.scenePointer, 'none');
        assert.notEqual(geometry.artworkRendering, 'pixelated');
        if (width <= 430) {
          assert(geometry.scene.h >= 95 && geometry.scene.h <= height * .3,
            'Mobile portrait needs a visible art strip: ' + JSON.stringify(geometry));
          assert(geometry.panel.y > geometry.scene.bottom,
            'Text controls must sit below the mobile art strip');
        } else {
          assert(Math.abs(geometry.scene.w - geometry.dialog.w) <= 2
            && Math.abs(geometry.scene.h - geometry.dialog.h) <= 2,
            'Cinematic art must fill the room: ' + JSON.stringify(geometry));
          assert(geometry.panel.x >= geometry.dialog.x + geometry.dialog.w * .4,
            'Dialogue should sit to the right of the character: ' + JSON.stringify(geometry));
        }
        assert((await modal.locator('[data-chronicles-dialogue-choice]').count()) >= 4,
          'Real scripted dialogue choices missing');
        if (width <= 430) {
          const buttons = await modal.locator('[data-chronicles-dialogue-choice]').evaluateAll(
            (nodes) => nodes.map((node) => node.getBoundingClientRect().height));
          assert(buttons.every((h) => h >= 44), 'Mobile dialogue buttons are too short: ' + buttons);
        }
        if ([390, 844, 1280].includes(width)) {
          await page.screenshot({ path: 'smoke-audience-' + npc + '-' + width + '.png' });
        }
        // Real lore answer stays in the room; story effects never happen merely
        // by opening the dialog or asking a question.
        const say = modal.locator('[data-chronicles-dialogue-choice="town"], [data-chronicles-dialogue-choice="road"]');
        await say.click();
        assert((await modal.locator('[data-chronicles-dialogue-answer]').innerText()).length > 45);
        assert.equal(await page.locator('[data-audience-action]').innerText(), '');
        const quest = modal.locator('[data-chronicles-dialogue-choice="quest"]');
        await quest.click();
        assert.equal(await page.locator('[data-audience-action]').innerText(),
          npc === 'aldric' ? 'swordhaven-mayor' : 'first-book-watch-house');
        assert.equal(await modal.locator('[data-chronicles-dialogue-choice="quest"]').count(), 0,
          'Claimed action must not be offered twice inside the same audience');
        await page.keyboard.press('Escape');
        await modal.waitFor({ state: 'hidden' });
        assert.equal(await page.locator('[data-audience-closed]').innerText(), 'yes');
        assert.deepEqual(errors, [], 'Browser errors: ' + errors.join(', '));
        console.log('OK audience ' + npc + ' ' + width + 'x' + height);
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }
