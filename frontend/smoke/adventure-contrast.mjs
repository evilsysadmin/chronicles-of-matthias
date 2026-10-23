// Visual quality gate for real Chromium output, not CSS-source inspection.
// MM3 stone buttons historically overrode WebKit text-fill, creating almost
// black labels on the new dark-slate adventure menu in public staging.
import assert from 'node:assert/strict';

export async function assertAdventureFolioInk(dialog, viewport) {
  // The compact folio nests related actions and hides audio until requested.
  // Open the live disclosure so computed-colour sampling covers its controls too.
  const sound = dialog.getByRole('button', { name: /Sonido/ });
  const hasSound = await sound.count() > 0;
  if (hasSound) await sound.click();
  const samples = await dialog.locator([
    '.chronicles-game-menu__actions button:not(.chronicles-game-menu__continue)',
    '.chronicles-audio-controls :is(label,legend,small,output)',
    '.chronicles-audio-row__slider button',
    '.chronicles-game-menu__hint',
  ].join(',')).evaluateAll((elements) => elements
    .filter((element) => element.getClientRects().length)
    .map((element) => {
      const computed = getComputedStyle(element);
      const paint = computed.getPropertyValue('-webkit-text-fill-color') || computed.color;
      const channels = (paint.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const linear = channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return {
        text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 40),
        color: paint,
        luminance: linear.length === 3
          ? 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] : 0,
      };
    }));
  assert.ok(samples.length >= 8, `Missing adventure labels on ${viewport}`);
  // Targets have known dark #1b2026/#303843 slate backgrounds. A dark
  // #111015 text fill scores ~0.006; pale ivory >0.5. Margin for muted ink.
  const unreadable = samples.filter(({ luminance }) => luminance < 0.35);
  assert.deepEqual(unreadable, [],
    `Adventure slate labels have dark/illegible ink at ${viewport}: ${JSON.stringify(samples)}`);
  if (hasSound) await sound.click();
}
