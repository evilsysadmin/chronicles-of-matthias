import { readFileSync } from 'node:fs';

export const PROJECTS = Object.freeze({ production: 'chronicles-production', staging: 'chronicles-staging' });
export const HOSTNAMES = Object.freeze({ production: 'chronicles.shadowops.dpdns.org', staging: 'staging.chronicles.shadowops.dpdns.org' });

export function pagesTarget(environment) {
  if (!Object.hasOwn(PROJECTS, environment)) throw new Error('Unknown environment');
  return { project: PROJECTS[environment], hostname: HOSTNAMES[environment], pagesDev: `${PROJECTS[environment]}.pages.dev` };
}

export function assertDeployableDirectory(path = 'dist') {
  const html = readFileSync(`${path}/index.html`, 'utf8');
  if (!html.includes('src/main.js')) throw new Error('Standalone entrypoint missing');
  const js = readFileSync(`${path}/src/main.js`, 'utf8');
  if (!js.includes('chroniclesMM3Rules')) throw new Error('Game rule module missing');
  return true;
}

if (process.argv[1]?.endsWith('/pages-preflight.mjs')) {
  const environment = process.argv[2];
  const target = pagesTarget(environment);
  assertDeployableDirectory();
  console.log(JSON.stringify({ ...target, status: 'preflight-only', dnsChanged: false }));
}
