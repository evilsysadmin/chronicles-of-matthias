import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Only ordinary Go sources in the Chronicles API can skip expensive visual
// Chromium on PRs. Unknown statuses, renames and generated files run all tests.
const GO_ONLY_PATH = /^api\/(?:cmd|internal)\/(?:[A-Za-z0-9_-]+\/)+[A-Za-z0-9_-]+\.go$/;
const STATUSES = new Set(['added', 'modified', 'removed']);

export function isGoOnlyPRFileSet(files) {
  return Array.isArray(files) && files.length > 0 && files.length <= 1000
    && files.every((file) =>
      file && typeof file === 'object' && !Array.isArray(file)
      && STATUSES.has(file.status)
      && (file.previous_filename == null || file.previous_filename === '')
      && typeof file.filename === 'string' && GO_ONLY_PATH.test(file.filename));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // gh api --paginate --jq '@json': one compact JSON record per line,
    // retaining escaped newlines in file names and all pagination pages.
    const raw = readFileSync(0, 'utf8');
    const files = raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
    if (isGoOnlyPRFileSet(files)) {
      console.log('Verified ordinary Go-only Chronicles API PR.');
    } else {
      console.error('Full browser smoke required: changed files are not Go-only.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Full browser smoke required: invalid PR file metadata:', error.message);
    process.exitCode = 1;
  }
}
