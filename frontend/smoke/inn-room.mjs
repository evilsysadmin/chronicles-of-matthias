import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4174/smoke/inn-room.html';
const browser = await chromium.launch();
try {
  for (const [width,height] of [[360,780],[390,844],[430,932],[1280,800]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const room = page.getByRole('dialog', { name: 'Taberna La Espada Mellada' });
      await room.waitFor({ state:'visible' });
      assert.equal(await page.locator('[data-chronicles-inn-room]').getAttribute('data-chronicles-inn-room'),
        'first-book-healer');
      const scene = room.locator('.chronicles-inn__scene');
      assert.equal(await scene.evaluate((img) => img.complete && img.naturalWidth > 0), true);
      const rect = await room.boundingBox();
      assert.ok(rect && rect.x >= -1 && rect.x + rect.width <= width + 1 &&
        rect.y >= -1 && rect.y + rect.height <= height + 1,
        'Tavern must fit the screen: '+JSON.stringify(rect));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      const gold = async () => Number(await page.locator('[data-inn-gold]').innerText());
      const qty = async () => Number(await page.locator('[data-inn-food-count]').innerText());
      const purse = await gold(), foodBefore = await qty();
      const rumor = room.locator('[data-inn-action="rumor"]');
      await rumor.click();
      assert.match(await room.innerText(), /alcalde Aldric/);
      assert.equal(await gold(), purse);
      await rumor.click();
      assert.match(await room.innerText(), /cloacas/);
      await room.locator('[data-inn-action="food"]').click();
      assert.equal(await gold(), purse - 4);
      assert.equal(await qty(), foodBefore + 1);
      await room.locator('[data-inn-action="rest"]').click();
      assert.equal(await gold(), purse - 9);
      const hp = (await page.locator('[data-inn-party-hp]').innerText()).split(',').map(Number);
      assert.ok(hp.every((value) => value > 0));
      await page.screenshot({ path:'smoke-inn-room-'+width+'.png' });
      await room.getByRole('button', {name:'Salir de la taberna'}).focus();
      await page.keyboard.press('Escape');
      await room.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      assert.deepEqual(errors, []);
      console.log('OK inn room '+width+'px');
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
