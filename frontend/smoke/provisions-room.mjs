import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4174/smoke/provisions-room.html';
const browser = await chromium.launch();
try {
  for (const [width,height] of [[360,780],[390,844],[430,932],[844,390],[1280,800]]) {
    const context = await browser.newContext({ viewport: { width,height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(url, { waitUntil: 'load' });
      const room = page.getByRole('dialog', { name:'Tienda de provisiones de Swordhaven' });
      await room.waitFor({ state:'visible' });
      const counter = page.locator('[data-chronicles-provisions="open"]');
      const close = room.getByRole('button', { name: 'Salir de la tienda de provisiones' });
      const before = async () => ({
        gold: Number(await page.locator('[data-provisions-fixture-gold]').innerText()),
        rations: Number(await page.locator('[data-provisions-fixture-rations]').innerText()),
        turns: Number(await page.locator('[data-provisions-fixture-turns]').innerText()),
        attempts: Number(await page.locator('[data-provisions-fixture-attempts]').innerText()),
      });
      const initial = await before();
      assert.equal(initial.attempts, 0, 'Opening the room must never buy supplies');
      const stacking = await page.evaluate(() => {
        const world = document.querySelector('[data-provisions-world-shell]');
        const counter = document.querySelector('[data-chronicles-provisions="open"]');
        const close = counter.querySelector('[aria-label="Salir de la tienda de provisiones"]');
        const r = close.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
        return {
          world: parseInt(getComputedStyle(world).zIndex,10),
          counter: parseInt(getComputedStyle(counter).zIndex,10),
          closeHit: hit === close || close.contains(hit),
          overlayOverflow: document.documentElement.scrollWidth,
          rect: counter.getBoundingClientRect().toJSON(),
        };
      });
      assert(stacking.counter > stacking.world && stacking.closeHit,
        'Merchant counter must sit above the first person world');
      assert(stacking.rect.left >= -1 && stacking.rect.right <= width+1
        && stacking.overlayOverflow <= width+1, 'No horizontal overflow in merchant room');
      assert.equal(await close.evaluate(n=>n.getBoundingClientRect().height >= 44),true);
      const art = room.locator('.chronicles-provisions__scene');
      const base = art.locator('[data-chronicles-shop-art-layer="fallback"]');
      const premium = art.locator('[data-chronicles-shop-art-layer="premium"]');
      assert.equal(await base.count(),1);
      assert.equal(await premium.count(),1);
      await page.waitForFunction(() => {
        const b = document.querySelector('.chronicles-provisions__scene img[data-chronicles-shop-art-layer="fallback"]');
        const p = document.querySelector('.chronicles-provisions__scene img[data-chronicles-shop-art-layer="premium"]');
        return b?.complete && b.naturalWidth>0 && p?.complete && (!p.naturalWidth || p.classList.contains('is-ready'));
      }, null, {timeout:7000});
      const imageState = await premium.evaluate(n=>({
        url:n.currentSrc, loaded:n.naturalWidth, height:n.naturalHeight,
        ready:n.classList.contains('is-ready'),
        opacity:parseFloat(getComputedStyle(n).opacity),
        position:getComputedStyle(n).position,
      }));
      assert.equal(imageState.url,
        'https://assets.chronicles.shadowops.dpdns.org/stores/tienda-provisiones-premium.webp');
      assert.equal(imageState.position,'absolute');
      if(imageState.loaded) assert(imageState.loaded>=1500 && imageState.height>=800 && imageState.ready);
      else assert(!imageState.ready && imageState.opacity===0,'Fallback must remain visible if R2 fails');
      if ([390,1280].includes(width))
        await page.screenshot({path:'smoke-provisions-'+width+'.png'});
      assert.equal(await room.locator('[data-provisions-buy]').isEnabled(),true);
      await room.locator('[data-provisions-buy]').dblclick();
      const bought=await before();
      assert.equal(bought.gold,initial.gold-7,'Exact 7-gold authoritative exchange');
      assert.equal(bought.rations,initial.rations+1,'Exactly one real road-rations item');
      assert.equal(bought.turns,initial.turns+1,'One paid action costs one turn');
      assert.equal(bought.attempts,1,'A double click may not purchase twice');
      assert.equal(await room.locator('[data-provisions-result="success"]').count(),1);
      await room.getByRole('button',{name:'Comprar otro paquete'}).click();
      await room.locator('[data-provisions-buy]').click();
      const again=await before();
      assert.equal(again.gold,bought.gold-7);
      assert.equal(again.rations,bought.rations+1);
      assert.equal(again.turns,bought.turns+1);
      assert.equal(again.attempts,2);
      await page.keyboard.press('Escape');
      await room.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
      assert.deepEqual(errors,[]);
      console.log('OK provisions counter '+width+'x'+height);
    } finally {await context.close();}
  }
} finally {await browser.close();}
