// UI regression for issue #1492: real React sliders + actual HTMLAudioElement
// gain after cache-clearing logout, F5, re-login and account switching.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/chronicles-audio-login.html';
const browser = await chromium.launch();
try {
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const ctx = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    const music = page.getByRole('slider', { name: 'Volumen de música de Chronicles' });
    const fx = page.getByRole('slider', { name: 'Volumen de efectos de Chronicles' });
    const owner = page.locator('[data-audio-owner]');
    const gain = page.locator('[data-audio-gain]');
    const volumes = async (m, f) => {
      assert.equal(await music.inputValue(), String(m), 'Real React music slider');
      assert.equal(await fx.inputValue(), String(f), 'Real React FX slider');
      const outputs = await owner.locator('output[for]').allInnerTexts();
      assert.deepEqual(outputs, [m + ' %', f + ' %']);
    };
    const setFromZero = async (slider, steps) => {
      await slider.focus();
      await slider.press('Home');
      for (let index = 0; index < steps; index += 1) await slider.press('ArrowRight');
    };
    const playback = async (level) => {
      await page.getByRole('button', { name: 'Comprobar volumen real' }).click();
      assert.equal(await gain.innerText(), level,
        'The real HTMLAudioElement gain must derive from the saved music preference');
    };
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Entrar Alice' }).click();
      await owner.locator('fieldset').waitFor();
      assert.equal(await owner.getAttribute('data-audio-owner'), 'alice');
      await volumes(100, 100);
      await setFromZero(music, 5); // 25% music
      await setFromZero(fx, 12); // 60% SFX
      await volumes(25, 60);
      await playback('0.180'); // Actual 0.25 x 0.72 soundtrack headroom.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await owner.locator('fieldset').waitFor();
      await volumes(25, 60);
      await playback('0.180');

      await page.getByRole('button', { name: 'Cerrar sesión' }).click();
      assert.equal(await owner.getAttribute('data-audio-owner'), 'anonymous');
      assert.equal(await page.locator('fieldset').count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('chess-study-music-volume')), null,
        'Logout must clear the old profile cache but not the Chronicles-scoped copy');
      await page.getByRole('button', { name: 'Entrar Alice' }).click();
      await volumes(25, 60);
      await playback('0.180');

      await page.getByRole('button', { name: 'Entrar Bob' }).click();
      assert.equal(await owner.getAttribute('data-audio-owner'), 'bob');
      await volumes(100, 100); // A different identity cannot inherit Alice.
      await setFromZero(music, 0);
      await setFromZero(fx, 0);
      await volumes(0, 0);
      await playback('0.000');

      await page.getByRole('button', { name: 'Entrar Alice' }).click();
      assert.equal(await owner.getAttribute('data-audio-owner'), 'alice');
      await volumes(25, 60);
      await playback('0.180');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, [], 'No browser errors in React volume/re-login flow');
      await page.screenshot({ path: 'smoke-chronicles-audio-relogin-' + width + '.png' });
      console.log('CHRONICLES_AUDIO_RELOGIN_BROWSER_OK width=' + width
        + ' alice=25/60 bob=0/0 gain=0.180');
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
