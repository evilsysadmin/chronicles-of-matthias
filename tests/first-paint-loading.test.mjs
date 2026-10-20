import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');

test('the HTML shell shows branded loading before any React module executes', () => {
  const rootMarkup = html.match(/<div id="root">([\s\S]*?)<\/div>\s*<script type="module"/)?.[1];
  assert.ok(rootMarkup, 'Root must not start empty before the JS bundle loads');
  assert.match(rootMarkup, /<main class="chronicles-boot" role="status"/);
  assert.match(rootMarkup, /aria-label="Cargando Chronicles"/);
  assert.match(rootMarkup, /CHRONICLES/);
  assert.match(rootMarkup, /<svg class="chronicles-boot__crest"/);
  assert.match(rootMarkup, /chronicles-boot__light/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /<noscript>Chronicles necesita JavaScript/);
  assert.ok(html.indexOf('class="chronicles-boot"') < html.indexOf('type="module"'));
});

test('the pre-React loader uses the same local artwork as the runtime fallback', () => {
  const runtime = readFileSync(new URL('../frontend/src/standalone/LoadingScreen.jsx', import.meta.url), 'utf8');
  assert.match(html, /href="\/chronicles-loading-art.svg"/);
  assert.match(html, /src="\/chronicles-loading-art.svg"/);
  assert.match(runtime, /'\/chronicles-loading-art.svg'/);
  assert.doesNotMatch(html, /(?:^|\s)(?:value|aria-valuenow)="\d+"/);
});
