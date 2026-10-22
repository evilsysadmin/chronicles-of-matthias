import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// GitHub workflow identity for .github/workflows/react-frontend.yml.
// The branch ruleset currently cannot require its "build" job directly:
// never let an unrelated GitHub Actions job named "build" satisfy the fallback.
export const FRONTEND_WORKFLOW_ID = 386812503;

export function verifyFrontendWorkflow(payload, { sha, event, repository }) {
  if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error('Invalid source SHA');
  if (!['push', 'pull_request'].includes(event)) throw new Error('Unexpected event');
  if (repository !== 'evilsysadmin/chronicles-of-matthias') {
    throw new Error('Unexpected repository');
  }
  // The REST query is a single page (per_page=100). An incomplete page
  // can hide a newer failed/cancelled official Chromium run. Never accept
  // an older green attempt without proving we received the full result set.
  if (!payload || !Number.isInteger(payload.total_count)
      || payload.total_count < 0 || payload.total_count > 100
      || !Array.isArray(payload.workflow_runs)
      || payload.total_count !== payload.workflow_runs.length) {
    throw new Error('Invalid or truncated GitHub workflow-run response');
  }

  // Reject malformed entries even when an older well-formed official
  // workflow is green. Otherwise, a newer failed run with an invalid ID
  // could be silently excluded from the latest-run comparison.
  const validRun = (run) =>
    run !== null && typeof run === 'object' && !Array.isArray(run)
    && Number.isSafeInteger(run.id) && run.id > 0
    && Number.isSafeInteger(run.workflow_id) && run.workflow_id > 0
    && typeof run.head_sha === 'string'
    && /^[0-9a-f]{40}$/.test(run.head_sha)
    && typeof run.event === 'string'
    && typeof run.status === 'string'
    && (run.conclusion === null || typeof run.conclusion === 'string')
    && typeof run.repository?.full_name === 'string';
  if (!payload.workflow_runs.every(validRun)) {
    throw new Error('Invalid GitHub workflow-run record');
  }

  const matching = payload.workflow_runs.filter((run) =>
    run.workflow_id === FRONTEND_WORKFLOW_ID
    && run.head_sha === sha
    && run.event === event
    && run.repository?.full_name === repository
    && (event !== 'push' || run.head_branch === 'main')
    && Number.isSafeInteger(run.id) && run.id > 0
  );
  const latest = matching.reduce(
    (candidate, run) => !candidate || run.id > candidate.id ? run : candidate,
    null,
  );
  if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success') {
    throw new Error(
      'Official Chronicles frontend workflow not green for exact source SHA '
      + sha + ' (' + (latest?.status ?? 'not found')
      + '/' + (latest?.conclusion ?? 'unknown') + ')',
    );
  }
  return latest.id;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [sha, event, repository] = process.argv.slice(2);
    const id = verifyFrontendWorkflow(JSON.parse(readFileSync(0, 'utf8')), {
      sha, event, repository,
    });
    console.log('FRONTEND_WORKFLOW_IDENTITY_GREEN sha=' + sha
      + ' workflow_id=' + FRONTEND_WORKFLOW_ID + ' run_id=' + id);
  } catch (error) {
    console.error('::error title=Frontend workflow identity not verified::' + error.message);
    process.exitCode = 1;
  }
}
