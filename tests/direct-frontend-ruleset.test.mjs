import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { RULESET_ID, verifyRequiredFrontendRuleset } from '../scripts/require-direct-frontend-ruleset.mjs';

const ruleset = () => ({
  id: RULESET_ID,
  source: 'evilsysadmin/chronicles-of-matthias',
  target: 'branch',
  enforcement: 'active',
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
  rules: [{
    type: 'required_status_checks',
    parameters: {
      required_status_checks: [
        { context: 'repository-contract', integration_id: 15368 },
        { context: 'api-e2e' },
        { context: 'frontend-vitest-build-chromium', integration_id: 15368 },
      ],
    },
  }],
});

test('active ruleset with all three unique checks and trusted frontend Actions app passes', () => {
  assert.deepEqual(verifyRequiredFrontendRuleset(ruleset()), [
    'repository-contract', 'api-e2e', 'frontend-vitest-build-chromium',
  ]);
});

test('never accept missing frontend, wrong app, duplicate or malformed contexts', () => {
  for (const mutate of [
    (r) => r.rules[0].parameters.required_status_checks.pop(),
    (r) => { r.rules[0].parameters.required_status_checks[2].integration_id = null; },
    (r) => { r.rules[0].parameters.required_status_checks[2].integration_id = 999; },
    (r) => r.rules[0].parameters.required_status_checks.push({ context: 'api-e2e' }),
    (r) => { r.rules[0].parameters.required_status_checks = undefined; },
    (r) => { r.rules = []; },
    (r) => r.rules.push(r.rules[0]),
    (r) => { r.rules[0].parameters.required_status_checks[0].context = null; },
  ]) {
    const bad = ruleset();
    mutate(bad);
    assert.throws(() => verifyRequiredFrontendRuleset(bad));
  }
});

test('rejects disabled, wrong-target, unrelated and non-main rulesets', () => {
  for (const mutate of [
    (r) => { r.id += 1; },
    (r) => { r.source = 'attacker/repo'; },
    (r) => { r.target = 'tag'; },
    (r) => { r.enforcement = 'evaluate'; },
    (r) => { r.conditions.ref_name.include = ['refs/heads/dev']; },
  ]) {
    const bad = ruleset();
    mutate(bad);
    assert.throws(() => verifyRequiredFrontendRuleset(bad));
  }
  for (const bad of [null, {}, [], { rules: [] }]) {
    assert.throws(() => verifyRequiredFrontendRuleset(bad));
  }
});

test('ruleset verification CLI fails closed and never prints a green marker on absent check', () => {
  const file = fileURLToPath(new URL('../scripts/require-direct-frontend-ruleset.mjs', import.meta.url));
  const run = (input) => spawnSync(process.execPath, [file], {
    input: JSON.stringify(input), encoding: 'utf8', timeout: 5000,
  });
  const ok = run(ruleset());
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /DIRECT_FRONTEND_RULESET_REQUIRED=25198769/);
  const missing = ruleset();
  missing.rules[0].parameters.required_status_checks.pop();
  const blocked = run(missing);
  assert.equal(blocked.status, 1, blocked.stderr);
  assert.doesNotMatch(blocked.stdout, /DIRECT_FRONTEND_RULESET_REQUIRED/);
});

test('short required job verifies the live remote ruleset after root contract tests', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const testStep = workflow.indexOf('- run: npm test');
  const guard = workflow.indexOf('node scripts/require-direct-frontend-ruleset.mjs');
  assert.ok(testStep >= 0 && guard > testStep);
  assert.match(workflow, /gh api -X GET "repos\/\$GITHUB_REPOSITORY\/rulesets\/25198769"/);
  assert.doesNotMatch(workflow, /for attempt in \$\(seq 1 216\)/);
});
