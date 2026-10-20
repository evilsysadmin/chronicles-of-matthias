import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const headersText = readFileSync(new URL('../frontend/public/_headers', import.meta.url), 'utf8');

function pageHeaderGroups(source) {
  const groups = new Map();
  let route;
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (!/^\s/.test(line)) {
      route = line.trim();
      assert.ok(!groups.has(route), 'Duplicate Pages header route: ' + route);
      groups.set(route, []);
    } else {
      assert.ok(route, 'Header field without a Pages path');
      groups.get(route).push(line.trim());
    }
  }
  return groups;
}

test('Cloudflare Pages never caches its root HTML, index or release.json', () => {
  const groups = pageHeaderGroups(headersText);
  for (const route of ['/', '/index.html', '/release.json']) {
    assert.ok(groups.has(route), 'Missing Pages cache policy for ' + route);
    const fields = groups.get(route).filter((line) => /^cache-control\s*:/i.test(line));
    assert.equal(fields.length, 1, 'Expected one Cache-Control for ' + route);
    assert.match(fields[0], /(?:^|,)\s*no-store(?:\s*,|$)/i,
      'Never cache mutable Pages resource ' + route);
  }
});

test('hashed assets are not needlessly forced to no-store', () => {
  const groups = pageHeaderGroups(headersText);
  for (const [route, fields] of groups) {
    if (!route.startsWith('/assets')) continue;
    assert.ok(!fields.some((line) => /cache-control.*no-store/i.test(line)),
      'Content-addressed asset incorrectly marked no-store: ' + route);
  }
});
