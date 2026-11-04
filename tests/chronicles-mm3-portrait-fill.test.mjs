import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../frontend/src/components/ChroniclesMM3Chrome.css', import.meta.url), 'utf8');

test('MM3 portraits and hireling niches keep their scale with minimal vertical inset', () => {
  // Full-height faces need the real thumbnail object-fit stylesheet to avoid
  // intrinsic-image growth. Keep the MM3 floor and the outer bevel while
  // matching stretched card heights at regular and tall desktop viewports.
  assert.match(css, /\.chronicles \.chronicles-party-member,\s*\.chronicles \.chronicles-party-hireling\s*\{[^}]*padding:\s*0 6px\s*;/);
  assert.match(css, /\.chronicles \.chronicles-party-member > \.chronicles-party-glyph\s*\{[^}]*height:\s*auto\s*;[^}]*min-height:\s*var\(--face\)\s*;[^}]*align-self:\s*stretch\s*;/);
  assert.match(css, /\.chronicles \.chronicles-party-hireling__face\s*\{[^}]*height:\s*100%\s*;[^}]*min-height:\s*var\(--face\)\s*;/);
  assert.match(css, /\.chronicles \.chronicles-party \.chronicles-party-member > \.chronicles-party-glyph\.has-authored-portrait\s*\{[^}]*border-width:\s*0\s*;/);
  assert.match(css, /\.chronicles \.chronicles-party-hireling__face\s*\{[^}]*border:\s*0 solid\s*;/);
  assert.doesNotMatch(css, /\.chronicles \.chronicles-party-member > \.chronicles-party-glyph,\s*\.chronicles \.chronicles-party-hireling__face\s*\{/);
});
