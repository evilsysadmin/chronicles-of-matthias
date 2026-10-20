import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('frontend/smoke/public-staging-journey.mjs', 'utf8');

test('real public source and API; no fake Chronicles backend', () => {
  for (const expected of [
    "https://staging.chronicles.shadowops.dpdns.org",
    "https://chronicles-api-staging.shadowops.dpdns.org/api",
    "CHRONICLES_SOURCE_SHA",
    "CHRONICLES_STAGING_INVITE_CODE",
    "isApi(response, 'POST', /\\/api\\/chronicles\\/runs$/, 201)",
    "isApi(response, 'PUT', /\\/api\\/chronicles\\/runs\\/[^/]+\\/checkpoint$/, 200)",
    "isApi(response, 'GET', /\\/api\\/chronicles\\/runs\\/[^/]+\\/bootstrap$/, 200)",
  ]) assert.ok(source.includes(expected), expected);
  assert.doesNotMatch(source, /page\.route\([^)]*chronicles-api-staging/);
});
test('create a character, move and save, then restore on a clean mobile and desktop context', () => {
  for (const marker of [
    "'Crear mis personajes'", "'Confirmar compañía'", "Nombre del héroe 1:",
    "page.keyboard.press('ArrowUp')", "page.keyboard.press('ArrowRight')",
    "[data-chronicles-touch-action=\"turn-left\"]", "desktop.flags",
    "runtimeLocation(body.worldFlags)", "runtimeLocation(saved.worldFlags)",
    "CHRONICLES_PUBLIC_JOURNEY_DESKTOP_OK", "CHRONICLES_PUBLIC_JOURNEY_MOBILE_OK",
    "CHRONICLES_PUBLIC_JOURNEY_RESTORE_OK",
  ]) assert.ok(source.includes(marker), marker);
});
test('sso bridge isolates shared IdP; ephemeral API account always cleaned up', () => {
  assert.ok(source.includes('page.route(idp,'));
  assert.ok(source.includes("if (req.method() === 'OPTIONS')"));
  assert.ok(source.includes("'/auth/delete-account'"));
  assert.ok(source.includes('finally {'));
  assert.ok(source.includes('await browser?.close()'));
});
