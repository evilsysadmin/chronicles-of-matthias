import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../frontend/src/components/ChroniclesMM3Chrome.css', import.meta.url), 'utf8');

test('MM3 desktop portraits and empty hireling niches fill the same card height', () => {
  // Both are grid items spanning the name/vitals rows. Keep a minimum height
  // to prevent the party strip collapsing, but stretch into taller cards.
  const sharedFace = css.match(
    /\.chronicles \.chronicles-party-member > \.chronicles-party-glyph,\s*\.chronicles \.chronicles-party-hireling__face\s*\{([^}]+)\}/,
  );
  assert.ok(sharedFace, 'party portraits and vacant places share the same geometry');
  assert.match(sharedFace[1], /\bheight:\s*100%\s*;/);
  assert.match(sharedFace[1], /\bmin-height:\s*var\(--face\)\s*;/);
  assert.match(sharedFace[1], /\bbox-sizing:\s*border-box\s*;/);
  assert.match(sharedFace[1], /\balign-self:\s*stretch\s*;/);
});
