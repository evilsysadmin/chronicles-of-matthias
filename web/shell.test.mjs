import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
test('standalone shell is explicit about staging and non-playable status', () => {
 assert.match(html, /CHRONICLES OF MATTHIAS/);
 assert.match(html, /todavía no es el juego/);
 assert.match(html, /Sin escrituras de guardados/);
 assert.match(html, /name="viewport"/);
});
test('shell never references Chess Studio runtime or remote endpoints', () => {
 assert.doesNotMatch(html, /<script|https?:\/\/|localStorage|fetch\(/i);
});
