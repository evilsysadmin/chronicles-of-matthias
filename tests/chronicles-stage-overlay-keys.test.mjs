import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('frontend/src/components/ChroniclesOfMatthias.jsx', 'utf8');

test('stateful stage overlays use separate keyed namespaces for React reconciliation', () => {
  const required = [
    ['ChroniclesPartyBark', 'party-bark'],
    ['ChroniclesFirstSteps', 'first-steps'],
    ['ChroniclesFirstThreatCue', 'first-threat'],
    ['ChroniclesEnemyRetaliationFx', 'retaliation'],
  ];
  for (const [component, namespace] of required) {
    const start = source.indexOf('<' + component);
    assert.notEqual(start, -1, component + ' must still be mounted');
    const openingTag = source.slice(start, source.indexOf('>', start) + 1);
    assert.ok(openingTag.includes('key={`' + namespace + ':'),
      component + ' must have its own key namespace');
  }
  assert.equal(new Set(required.map(([, namespace]) => namespace)).size, required.length);
  assert.ok(source.includes("key={`first-steps:${activeRunIdRef.current || 'no-run'}`}"),
    'tutorial dismissal must continue to remount for a new expedition');
  assert.ok(source.includes("key={`first-threat:${activeRunIdRef.current || 'no-run'}`}"),
    'first-threat cue keeps run-scoped remount but no longer collides');
});

test('public browser smoke continues to fail on overlapping guides', () => {
  const smoke = readFileSync('frontend/smoke/public-staging.mjs', 'utf8');
  assert.ok(smoke.includes('if (visibleFirstSteps > 1)'));
  assert.ok(smoke.includes('Multiple visible Matthias guides:'));
  assert.ok(smoke.includes('CHRONICLES_FIRST_STEPS_DOM_CENSUS'));
});
