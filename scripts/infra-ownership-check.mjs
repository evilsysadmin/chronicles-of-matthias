import { readFileSync } from 'node:fs';

const variables = readFileSync('infra/cloudflare/variables.tf', 'utf8');
const outputs = readFileSync('infra/cloudflare/outputs.tf', 'utf8');
const docs = readFileSync('infra/cloudflare/README.md', 'utf8');
const forbidden = [
  /resource\s+"cloudflare_dns_record"/,
  /resource\s+"cloudflare_record"/,
  /resource\s+"oci_core_instance"/,
  /resource\s+"cloudflare_workers_script"/,
];
for (const file of ['infra/cloudflare/versions.tf', 'infra/cloudflare/variables.tf', 'infra/cloudflare/outputs.tf']) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(content)) throw new Error(`${file}: infrastructure resource ownership requires explicit review`);
  }
}
for (const hostname of ['chronicles.shadowops.dpdns.org', 'staging.chronicles.shadowops.dpdns.org']) {
  if (!variables.includes(hostname)) throw new Error(`Missing hostname contract: ${hostname}`);
}
if (!outputs.includes('production_url') || !outputs.includes('staging_url')) throw new Error('Missing public URLs');
if (!docs.includes('not create DNS records')) throw new Error('Missing DNS ownership safety contract');
console.log('Infrastructure ownership contract OK (read-only)');
