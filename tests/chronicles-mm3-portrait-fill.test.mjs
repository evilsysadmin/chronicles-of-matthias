import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../frontend/src/components/ChroniclesMM3Chrome.css', import.meta.url), 'utf8');

test('MM3 portraits and hireling niches keep their scale with minimal vertical inset', () => {
  // The full-height percentage alternative expands desktop portraits beyond
  // their intended <=170px scale. Keep their explicit face height and reduce
  // the surrounding card padding instead.
  assert.match(css, /\.chronicles \.chronicles-party-member,\s*\.chronicles \.chronicles-party-hireling\s*\{[^}]*padding:\s*0 6px\s*;/);
  assert.match(css, /\.chronicles \.chronicles-party-member > \.chronicles-party-glyph\s*\{[^}]*height:\s*var\(--face\)\s*;/);
  assert.match(css, /\.chronicles \.chronicles-party-hireling__face\s*\{[^}]*height:\s*var\(--face\)\s*;/);
  assert.match(css, /\.chronicles \.chronicles-party \.chronicles-party-member > \.chronicles-party-glyph\.has-authored-portrait\s*\{[^}]*border-width:\s*0\s*;/);
  assert.match(css, /\.chronicles \.chronicles-party-hireling__face\s*\{[^}]*border:\s*0 solid\s*;/);
  assert.doesNotMatch(css, /\.chronicles \.chronicles-party-member > \.chronicles-party-glyph,\s*\.chronicles \.chronicles-party-hireling__face\s*\{/);
});
