import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('./Dockerfile', import.meta.url), 'utf8');

test('standalone preview is explicit about partial functionality and no saves', () => {
  assert.match(html, /CHRONICLES OF MATTHIAS/);
  assert.match(html, /todavía no es el juego/);
  assert.match(html, /Sin escrituras de guardados/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /Forja de héroes/);
  assert.match(html, /role="tablist"/);
});

test('only same-origin modules, no Chess Studio or other remote endpoints', () => {
  assert.match(html, /<script type="module" src="\.\/game\/party-preview\.js"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]*\b(?:https?:|\/\/)/);
  assert.doesNotMatch(html, /fetch\(|localStorage|sessionStorage|chess-studio\.shadowops/i);
  assert.match(html, /connect-src 'none'/);
  assert.match(dockerfile, /COPY --chown=101:101 game\//);
});

test('the extracted dungeon is visible, honest about scope and supports keyboard/touch', () => {
  assert.match(html, /id="crypt-exploration"/);
  assert.match(html, /id="crypt-map"/);
  assert.match(html, /Cripta de las Ocho Casillas/);
  assert.match(html, /sin combate, cambios de región ni guardado/);
  for (const action of ['forward', 'backward', 'turn-left', 'turn-right', 'strafe-left', 'strafe-right', 'interact']) {
    assert.ok(html.includes('data-explore-action="' + action + '"'), action);
  }
  assert.match(html, /<script type="module" src="\.\/game\/exploration-preview\.js"><\/script>/);
  assert.match(dockerfile, /COPY --chown=101:101 game\//);
});
