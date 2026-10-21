import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync(new URL('../.github/dependabot.yml', import.meta.url), 'utf8');

test('Dependabot covers all three independently maintained ecosystems', () => {
  assert.match(config, /^version: 2$/m);
  const headers = [...config.matchAll(/^  - package-ecosystem: (.+)$/gm)];
  assert.deepEqual(headers.map((h) => h[1]), ['npm', 'gomod', 'github-actions']);
  const expected = ['/frontend', '/api', '/'];
  for (let i = 0; i < headers.length; i += 1) {
    const section = config.slice(headers[i].index, headers[i + 1]?.index);
    assert.ok(section.includes('directory: ' + expected[i]), headers[i][1]);
    assert.match(section, /interval: weekly/);
    assert.match(section, /timezone: Europe\/Madrid/);
    assert.match(section, /open-pull-requests-limit: [12]/);
    assert.match(section, /update-types:\s*\n\s+- minor\s*\n\s+- patch/);
  }
});

test('Dependabot does not schedule frequent unlimited CI runs', () => {
  assert.doesNotMatch(config, /interval: (daily|live)/);
  assert.equal((config.match(/open-pull-requests-limit:/g) || []).length, 3);
});
