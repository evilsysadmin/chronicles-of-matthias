// Real Chromium ink guard: the MM3 control board mixes ivory-on-dark chrome
// with dark ink on raised parchment/bronze buttons. Both must stay legible.
import assert from 'node:assert/strict';

export async function assertAdventureFolioInk(dialog, viewport) {
  const sound = dialog.getByRole('button', { name: /Sonido/ });
  const hasSound = await sound.count() > 0;
  if (hasSound) await sound.click();
  const samples = await dialog.locator([
    '.chronicles-game-menu__primary-row > button',
    '.chronicles-game-menu__action-pair > button',
    '.chronicles-game-menu__utility-row > button',
    '.chronicles-audio-controls :is(label,legend,small,output)',
    '.chronicles-audio-row__slider button',
    '.chronicles-game-menu__hint',
  ].join(',')).evaluateAll((elements) => elements
    .filter((element) => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
    .map((element) => {
      const style = getComputedStyle(element);
      const paint = style.getPropertyValue('-webkit-text-fill-color') || style.color;
      const channels = (paint.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
      const linear = channels.map((channel) => {
        const c = channel / 255;
        return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
      });
      const isRaised = !!element.closest('.chronicles-game-menu__action-pair, .chronicles-game-menu__utility-row')
        && !element.classList.contains('chronicles-game-menu__leave');
      const isContinue = element.classList.contains('chronicles-game-menu__continue');
      const darkInk = isRaised || isContinue;
      return {
        text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 44),
        darkInk, paint,
        // Parchment and golden buttons need dark ink; slate, red and footer need light ink.
        luminance: linear.length === 3
          ? .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2] : 0,
      };
    }));
  assert.ok(samples.length >= 8, 'Missing menu labels at ' + viewport);
  const bad = samples.filter(({ luminance, darkInk }) =>
    darkInk ? luminance > .21 : luminance < .35);
  assert.deepEqual(bad, [],
    'Control-board ink must contrast with its intended parchment/dark surface at '
      + viewport + ': ' + JSON.stringify(samples));
  if (hasSound) await sound.click();
}
