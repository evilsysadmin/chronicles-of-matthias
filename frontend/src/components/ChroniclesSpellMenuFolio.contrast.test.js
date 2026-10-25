import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./ChroniclesSpellMenuFolio.css', import.meta.url), 'utf8');

// Keep the small, textured parchment header labels readable against its
// declared solid pigment; Chromium screenshots cover the final texture.
const parchmentBase = '#aa7140';
function luminance(hex) {
  const channels = hex.match(/[\da-f]{2}/gi).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
function colorFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = css.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'))?.[1];
  return declaration?.match(/(?:^|;)\s*color:\s*(#[\da-f]{6})\s*;/i)?.[1];
}

describe('CAST parchment header readability', () => {
  it.each([
    '.chronicles .chronicles-spell-menu--folio header .chronicles-spell-menu__eyebrow',
    '.chronicles .chronicles-spell-menu--folio header p',
  ])('keeps small text at 4.5:1 against the base parchment pigment: %s', (selector) => {
    const foreground = colorFor(selector);
    expect(foreground).toBeTruthy();
    expect(contrastRatio(foreground, parchmentBase)).toBeGreaterThanOrEqual(4.5);
  });
});
