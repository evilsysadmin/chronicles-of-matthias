import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const RULESET_ID = 25198769;
const REPO = 'evilsysadmin/chronicles-of-matthias';
const GITHUB_ACTIONS_APP_ID = 15368;
const CONTEXTS = ['repository-contract', 'api-e2e', 'frontend-vitest-build-chromium'];

/**
 * Independently validate the remote main ruleset before retiring the frontend
 * polling bridge. No malformed, inactive or permissive ruleset can pass.
 */
export function verifyRequiredFrontendRuleset(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || payload.id !== RULESET_ID || payload.source !== REPO
      || payload.target !== 'branch' || payload.enforcement !== 'active'
      || !Array.isArray(payload.rules)
      || !payload.conditions?.ref_name?.include?.includes('~DEFAULT_BRANCH')) {
    throw new Error('Active protected-main ruleset 25198769 is missing or unexpected');
  }
  const checksRules = payload.rules.filter((r) => r?.type === 'required_status_checks');
  if (checksRules.length !== 1) {
    throw new Error('Exactly one required-status-check rule is necessary');
  }
  const entries = checksRules[0].parameters?.required_status_checks;
  if (!Array.isArray(entries) || !entries.every((x) => x && typeof x.context === 'string')) {
    throw new Error('Malformed required status checks');
  }
  const names = entries.map((x) => x.context);
  for (const name of CONTEXTS) {
    if (names.filter((x) => x === name).length !== 1) {
      throw new Error('Missing or duplicated required check: ' + name);
    }
  }
  const frontend = entries.find((x) => x.context === 'frontend-vitest-build-chromium');
  if (frontend.integration_id !== GITHUB_ACTIONS_APP_ID) {
    throw new Error('Frontend check must be required from the GitHub Actions app');
  }
  return CONTEXTS;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const json = JSON.parse(readFileSync(0, 'utf8'));
    verifyRequiredFrontendRuleset(json);
    console.log('DIRECT_FRONTEND_RULESET_REQUIRED=' + RULESET_ID);
  } catch (err) {
    console.error('::error title=Unsafe CI ruleset::' + String(err.message || err));
    process.exitCode = 1;
  }
}
