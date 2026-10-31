import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../frontend/src/standalone/App.jsx', import.meta.url), 'utf8');
const book = readFileSync(new URL('../frontend/src/components/ChroniclesSaveMenu.jsx', import.meta.url), 'utf8');

test('the expedition book exposes Tactics through the existing hash route and returns to Chronicles on exit', () => {
  assert.match(book, /data-chronicles-tactics-entry="true" href="#tactics"/);
  assert.match(app, /window\.location\.hash === '#tactics'/);
  assert.match(app, /window\.addEventListener\('hashchange', onHash\)/);
  assert.match(app, /if \(mode === 'chronicles-tactics'\) \{[\s\S]*?window\.location\.hash = '';[\s\S]*?setMode\('chronicles'\);/);
});
