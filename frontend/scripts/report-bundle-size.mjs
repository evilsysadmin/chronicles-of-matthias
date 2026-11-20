import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Measure the actual Vite output once. No second build and no remote services.
// This reports JS/CSS transfer-size proxies, not images, GLBs, audio or CDN Brotli.
export function measureBundle(distDirectory) {
  const root = resolve(distDirectory);
  const files = [];

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = extname(entry.name);
      const type = extension === '.js' ? 'js' : extension === '.css' ? 'css' : null;
      if (!type) continue;
      const bytes = readFileSync(fullPath);
      files.push({
        path: relative(root, fullPath).split(sep).join('/'),
        type,
        rawBytes: bytes.length,
        gzipBytes: gzipSync(bytes, { level: 9 }).length,
      });
    }
  }

  visit(root);
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  if (!files.some((file) => file.type === 'js') || !files.some((file) => file.type === 'css')) {
    throw new Error('Expected both JavaScript and CSS in the Vite dist output');
  }

  const total = (entries) => entries.reduce(
    (sum, file) => ({
      count: sum.count + 1,
      rawBytes: sum.rawBytes + file.rawBytes,
      gzipBytes: sum.gzipBytes + file.gzipBytes,
    }),
    { count: 0, rawBytes: 0, gzipBytes: 0 },
  );
  return {
    schemaVersion: 1,
    js: total(files.filter((file) => file.type === 'js')),
    css: total(files.filter((file) => file.type === 'css')),
    combined: total(files),
    files,
  };
}

export function formatBundleSummary(report) {
  const kb = (value) => (value / 1024).toFixed(1) + ' KiB';
  const lines = [
    '### Vite JS/CSS bundle sizes',
    '',
    'Measured from the exact built files; gzip level 9 is a reproducible compression proxy, not CDN transfer telemetry. Audio, images, GLB and other non-JS/CSS assets are excluded.',
    '',
    '| Asset type | Files | Raw | gzip level 9 |',
    '| --- | ---: | ---: | ---: |',
  ];
  for (const [name, value] of [['JavaScript', report.js], ['CSS', report.css], ['JS + CSS', report.combined]]) {
    lines.push('| ' + name + ' | ' + value.count + ' | ' + kb(value.rawBytes) + ' | ' + kb(value.gzipBytes) + ' |');
  }
  lines.push('', 'Largest JS/CSS bundles by gzip size:', '', '| File | Raw | gzip level 9 |', '| --- | ---: | ---: |');
  const biggest = [...report.files].sort(
    (a, b) => b.gzipBytes - a.gzipBytes || a.path.localeCompare(b.path, 'en'),
  ).slice(0, 8);
  for (const file of biggest) {
    lines.push('| ' + file.path + ' | ' + kb(file.rawBytes) + ' | ' + kb(file.gzipBytes) + ' |');
  }
  return lines.join('\n') + '\n';
}

export function writeBundleReport(distDirectory, summaryFile) {
  const report = measureBundle(distDirectory);
  writeFileSync(join(distDirectory, 'bundle-size-report.json'), JSON.stringify(report, null, 2) + '\n');
  const markdown = formatBundleSummary(report);
  if (summaryFile) appendFileSync(summaryFile, markdown);
  return markdown;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] || new URL('../dist/', import.meta.url).pathname);
  process.stdout.write(writeBundleReport(dist, process.env.GITHUB_STEP_SUMMARY));
}
