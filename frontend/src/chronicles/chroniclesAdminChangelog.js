import { APP_BUILD_ID } from '../release.js';
import { normalizeBuildSha } from '../releaseManifest.js';

export const CHRONICLES_ADMIN_CHANGELOG_LIMIT = 20;
const REPOSITORY = 'evilsysadmin/chronicles-of-matthias';
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;

// Never silently fall back to main: admin must see the code included in
// this browser's actual bundle, not commits that have yet to be deployed.
export function chroniclesAdminChangelogBuildSha(buildId = APP_BUILD_ID) {
  const sha = normalizeBuildSha(buildId);
  return sha && COMMIT_SHA_PATTERN.test(sha) ? sha : null;
}

export function chroniclesAdminChangelogUrl(sha) {
  const valid = chroniclesAdminChangelogBuildSha(sha);
  return valid ? `https://github.com/${REPOSITORY}/commits/${valid}` : null;
}

export function chroniclesAdminCommitUrl(sha) {
  const valid = chroniclesAdminChangelogBuildSha(sha);
  return valid ? `https://github.com/${REPOSITORY}/commit/${valid}` : null;
}

export function chroniclesNormalizeAdminCommits(payload) {
  if (!Array.isArray(payload)) throw new Error('GitHub no devolvió un historial válido.');
  return payload.slice(0, CHRONICLES_ADMIN_CHANGELOG_LIMIT).flatMap((entry) => {
    const sha = chroniclesAdminChangelogBuildSha(entry?.sha);
    const message = entry?.commit?.message;
    if (!sha || typeof message !== 'string' || !message.trim()) return [];
    const date = entry?.commit?.committer?.date || entry?.commit?.author?.date;
    const timestamp = typeof date === 'string' && Number.isFinite(Date.parse(date)) ? date : null;
    return [{
      sha,
      title: message.trim().split(/\r?\n/, 1)[0].slice(0, 220),
      date: timestamp,
      url: chroniclesAdminCommitUrl(sha),
    }];
  });
}

export async function chroniclesFetchAdminChangelog({
  buildId = APP_BUILD_ID, fetchImpl = globalThis.fetch, signal,
} = {}) {
  const sha = chroniclesAdminChangelogBuildSha(buildId);
  if (!sha) throw new Error('Esta compilación no incluye un SHA verificable.');
  const url = `https://api.github.com/repos/${REPOSITORY}/commits?sha=${sha}&per_page=${CHRONICLES_ADMIN_CHANGELOG_LIMIT}`;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  });
  if (!response?.ok) throw new Error('GitHub no ha permitido consultar el historial. Inténtalo más tarde.');
  return chroniclesNormalizeAdminCommits(await response.json());
}
