export const ALLOWED_REPO = 'evilsysadmin/chronicles-of-matthias';
export const ALLOWED_SERVICE = 'chronicles-api';
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

export function validateReleaseCandidate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid payload');
  if (input.repository !== ALLOWED_REPO) throw new Error('Unauthorized source repository');
  if (input.service !== ALLOWED_SERVICE) throw new Error('Unauthorized service');
  if (!SHA.test(input.sha ?? '')) throw new Error('Invalid commit SHA');
  if (!DIGEST.test(input.digest ?? '')) throw new Error('Image digest required');
  if (input.environment !== 'staging') throw new Error('Only staging candidates accepted');
  if (Object.keys(input).some(k => !['repository','service','sha','digest','environment'].includes(k))) throw new Error('Unknown payload field');
  return Object.freeze({repository:input.repository,service:input.service,sha:input.sha,digest:input.digest,environment:input.environment});
}
