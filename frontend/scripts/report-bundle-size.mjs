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


// Vite's manifest maps the public entry and its synchronous imports to emitted files.
// Dynamic imports are deliberately excluded: they belong to later routes/actions.
// This is a static-load estimate, not a browser waterfall or SSO/authenticated load.
export function measureEntryVsLazy(report, manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Expected a valid Vite chunk manifest');
  }
  const entries = Object.entries(manifest).filter(([, value]) => value?.isEntry === true);
  if (entries.length !== 1) {
    throw new Error('Expected exactly one Vite HTML entry, got ' + entries.length);
  }
  const byPath = new Map(report.files.map((file) => [file.path, file]));
  const selected = new Set();
  const visited = new Set();

  function includeAsset(path) {
    if (typeof path !== 'string') throw new Error('Invalid manifest asset path');
    if (!/\.(?:js|css)$/.test(path)) return;
    if (!byPath.has(path)) throw new Error('Vite manifest references missing asset: ' + path);
    selected.add(path);
  }

  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk || typeof chunk !== 'object' || typeof chunk.file !== 'string') {
      throw new Error('Vite manifest is missing imported chunk: ' + key);
    }
    includeAsset(chunk.file);
    for (const cssPath of chunk.css ?? []) includeAsset(cssPath);
    for (const dependency of chunk.imports ?? []) visit(dependency);
    // chunk.dynamicImports is intentionally NOT traversed.
  }

  visit(entries[0][0]);
  const sum = (files) => files.reduce((acc, file) => ({
    count: acc.count + 1,
    rawBytes: acc.rawBytes + file.rawBytes,
    gzipBytes: acc.gzipBytes + file.gzipBytes,
  }), { count: 0, rawBytes: 0, gzipBytes: 0 });
  const group = (files) => ({
    js: sum(files.filter((file) => file.type === 'js')),
    css: sum(files.filter((file) => file.type === 'css')),
    combined: sum(files),
  });
  return {
    entryKey: entries[0][0],
    entryAndStatic: group(report.files.filter((file) => selected.has(file.path))),
    deferred: group(report.files.filter((file) => !selected.has(file.path))),
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
  if (report.entryPayload) {
    const payload = report.entryPayload;
    lines.push(
      '',
      '### Public entry vs deferred chunks (Vite manifest)',
      '',
      'Entry includes only static imports and CSS; lazy chunks may load after authentication or an action. This is not a browser network trace.',
      '',
      '| Load group | JS gzip | CSS gzip | Combined gzip |',
      '| --- | ---: | ---: | ---: |',
      '| Entry + static imports | ' + kb(payload.entryAndStatic.js.gzipBytes)
        + ' | ' + kb(payload.entryAndStatic.css.gzipBytes)
        + ' | ' + kb(payload.entryAndStatic.combined.gzipBytes) + ' |',
      '| Not in entry graph | ' + kb(payload.deferred.js.gzipBytes)
        + ' | ' + kb(payload.deferred.css.gzipBytes)
        + ' | ' + kb(payload.deferred.combined.gzipBytes) + ' |',
    );
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
  const measured = measureBundle(distDirectory);
  const manifest = JSON.parse(readFileSync(join(distDirectory, '.vite', 'manifest.json'), 'utf8'));
  const report = { ...measured, schemaVersion: 2, entryPayload: measureEntryVsLazy(measured, manifest) };
  writeFileSync(join(distDirectory, 'bundle-size-report.json'), JSON.stringify(report, null, 2) + '\n');
  const markdown = formatBundleSummary(report);
  if (summaryFile) appendFileSync(summaryFile, markdown);
  return markdown;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] || new URL('../dist/', import.meta.url).pathname);
  process.stdout.write(writeBundleReport(dist, process.env.GITHUB_STEP_SUMMARY));
}
