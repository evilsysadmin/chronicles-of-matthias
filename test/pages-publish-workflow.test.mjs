import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const w = readFileSync('.github/workflows/pages-staging.yml', 'utf8');
const py = readFileSync('scripts/pages_staging.py', 'utf8');

test('independent Pages publication is manual and staging-only', () => {
  for (const match of [
    'workflow_dispatch:', "github.event_name == 'workflow_dispatch'",
    "github.ref == 'refs/heads/main'", "github.repository == 'evilsysadmin/chronicles-of-matthias'",
    'chronicles-staging', 'staging.chronicles.shadowops.dpdns.org',
    '--branch main', '--commit-hash "$GITHUB_SHA"', 'python3 scripts/pages_staging.py verify',
    'secrets.CLOUDFLARE_API_TOKEN', 'secrets.CLOUDFLARE_ACCOUNT_ID',
  ]) assert.ok(w.includes(match), match);
  assert.doesNotMatch(w, /docker compose up|terraform apply|kubectl apply|ssh /);
  assert.doesNotMatch(w, /chess-studio-staging|staging\.chess-studio\.shadowops/);
});

test('fixed-only domain ownership and HTTPS verification', () => {
  for (const match of [
    'PROJECT = "chronicles-staging"',
    'HOST = "staging.chronicles.shadowops.dpdns.org"',
    'ZONE = "shadowops.dpdns.org"',
    '"production_branch": "main"',
    '"proxied": True',
    'already owned by different DNS target',
    'CHRONICLES_PAGES_STAGING_HTTPS_OK',
    'CHRONICLES OF MATTHIAS',
    'todavía no es el juego',
  ]) assert.ok(py.includes(match), match);
  assert.doesNotMatch(py, /\.patch\(|"PATCH"|\bDELETE\b/);
});
