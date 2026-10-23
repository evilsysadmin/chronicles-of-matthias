import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const goMod = readFileSync(new URL('../api/go.mod', import.meta.url), 'utf8');
const goSum = readFileSync(new URL('../api/go.sum', import.meta.url), 'utf8');
const dependency = 'go.mongodb.org/mongo-driver/v2';
// Guard both direct and grouped Go module replacements, including version-scoped ones.
const driverReplace = /^(?:[ \t]*replace[ \t]+(?:\([ \t]*)?go\.mongodb\.org\/mongo-driver\/v2\b|[ \t]*go\.mongodb\.org\/mongo-driver\/v2(?:[ \t]+v\d+\.\d+\.\d+)?[ \t]+=>)/m;

test('MongoDB Go Driver stays above the security floor for CVE-2026-81521 and CVE-2026-107325', () => {
  // These two issues are fixed in v2.9.2, not in the earlier v2.9.0/2.9.1 series.
  // Protect the exact go.mod version, including against stale dependency PRs.
  const match = goMod.match(/^\s*go\.mongodb\.org\/mongo-driver\/v2\s+v(\d+)\.(\d+)\.(\d+)(?:\s|$)/m);
  assert.ok(match, 'MongoDB Go Driver must be declared in api/go.mod');
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  assert.equal(major, 2, 'module path /v2 must retain a v2 release');
  assert.ok(minor > 9 || (minor === 9 && patch >= 2), 'MongoDB Go Driver must be >= v2.9.2');
  const version = `v${major}.${minor}.${patch}`;
  // Ensure the committed sums cover the same release, not an obsolete one.
  assert.ok(goSum.includes(`${dependency} ${version} h1:`), 'module checksum for declared driver version missing');
  assert.ok(goSum.includes(`${dependency} ${version}/go.mod h1:`), 'go.mod checksum for declared driver version missing');
  assert.doesNotMatch(goMod, driverReplace, 'no replacement may silently bypass the fixed version');
});

test('MongoDB driver floor rejects direct, versioned and grouped replace escapes', () => {
  for (const source of [
    'replace go.mongodb.org/mongo-driver/v2 => ../unsafe',
    'replace go.mongodb.org/mongo-driver/v2 v2.9.2 => ../unsafe',
    'replace (go.mongodb.org/mongo-driver/v2 => ../unsafe)',
    'replace (\n  go.mongodb.org/mongo-driver/v2 => ../unsafe\n)',
    'replace (\n  go.mongodb.org/mongo-driver/v2 v2.9.2 => ../unsafe\n)',
  ]) {
    assert.match(source.replaceAll('\\n', '\n'), driverReplace, source);
  }
  assert.doesNotMatch('require (\n go.mongodb.org/mongo-driver/v2 v2.9.2\n)', driverReplace);
});
