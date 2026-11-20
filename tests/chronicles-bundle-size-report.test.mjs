import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  formatBundleSummary, measureBundle, measureEntryVsLazy, writeBundleReport,
} from '../frontend/scripts/report-bundle-size.mjs';

const script = fileURLToPath(new URL('../frontend/scripts/report-bundle-size.mjs', import.meta.url));
const makeBundle = (directory) => {
  mkdirSync(join(directory, 'assets', 'nested'), { recursive: true });
  const js = Buffer.from('const x = "asset";\n'.repeat(90));
  const nested = Buffer.from('export const route = true;\n'.repeat(14));
  const css = Buffer.from('.menu { color: goldenrod; }\n'.repeat(30));
  writeFileSync(join(directory, 'assets', 'entry-123.js'), js);
  writeFileSync(join(directory, 'assets', 'nested', 'route-abc.js'), nested);
  writeFileSync(join(directory, 'assets', 'style-123.css'), css);
  writeFileSync(join(directory, 'assets', 'music.mp3'), Buffer.alloc(25000));
  writeFileSync(join(directory, 'index.html'), '<html></html>');
  mkdirSync(join(directory, '.vite'));
  writeFileSync(join(directory, '.vite', 'manifest.json'), JSON.stringify({
    'index.html': {
      file: 'assets/entry-123.js',
      isEntry: true,
      css: ['assets/style-123.css'],
      dynamicImports: ['src/routes/lazy.js'],
    },
    'src/routes/lazy.js': {
      file: 'assets/nested/route-abc.js',
      isDynamicEntry: true,
    },
  }));
  return { js, nested, css };
};

test('reports actual Vite bytes and gzip bytes without counting other media', (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'chronicles-bundle-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  const { js, nested, css } = makeBundle(dist);
  const report = measureBundle(dist);

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.js.count, 2);
  assert.equal(report.css.count, 1);
  assert.equal(report.combined.count, 3);
  assert.deepEqual(report.files.map((file) => file.path), [
    'assets/entry-123.js', 'assets/nested/route-abc.js', 'assets/style-123.css',
  ]);
  assert.equal(report.js.rawBytes, js.length + nested.length);
  assert.equal(report.css.rawBytes, css.length);
  assert.equal(report.combined.rawBytes, js.length + nested.length + css.length);
  assert.equal(report.js.gzipBytes, gzipSync(js, { level: 9 }).length
    + gzipSync(nested, { level: 9 }).length);
  assert.equal(report.css.gzipBytes, gzipSync(css, { level: 9 }).length);
  assert.equal(report.combined.gzipBytes, report.js.gzipBytes + report.css.gzipBytes);
  const markdown = formatBundleSummary(report);
  assert.match(markdown, /Vite JS\/CSS bundle sizes/);
  assert.match(markdown, /\| CSS \| 1 \|/);
  assert.doesNotMatch(markdown, /music\.mp3|index\.html/);
});

test('report is deterministic, writes a JSON artifact and appends to a summary', (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'chronicles-bundle-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  makeBundle(dist);
  const summaryPath = join(dist, 'summary.md');
  const summary = writeBundleReport(dist, summaryPath);
  const actual = JSON.parse(readFileSync(join(dist, 'bundle-size-report.json'), 'utf8'));
  const measured = measureBundle(dist);
  assert.equal(actual.schemaVersion, 2);
  assert.deepEqual({ ...actual, schemaVersion: 1, entryPayload: undefined }, {
    ...measured, entryPayload: undefined,
  });
  assert.equal(actual.entryPayload.entryKey, 'index.html');
  assert.equal(actual.entryPayload.entryAndStatic.combined.count, 2);
  assert.equal(actual.entryPayload.deferred.combined.count, 1);
  assert.equal(readFileSync(summaryPath, 'utf8'), summary);
  assert.equal(formatBundleSummary(actual), summary);
  assert.equal(actual.files.length, 3, 'the report must not count itself');
});

test('rejects missing Vite JavaScript or CSS instead of publishing misleading zeroes', (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'chronicles-bundle-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'assets', 'only.js'), 'export default true;');
  assert.throws(() => measureBundle(dist), /both JavaScript and CSS/);
  writeFileSync(join(dist, 'assets', 'only.css'), '.x { color: red; }');
  assert.equal(measureBundle(dist).css.count, 1);
});

test('CLI creates the same report and updates GitHub step summary', (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'chronicles-bundle-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  makeBundle(dist);
  const summaryPath = join(dist, 'github-summary.md');
  const p = spawnSync(process.execPath, [script, dist], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath },
    timeout: 5000,
  });
  assert.equal(p.status, 0, p.stderr);
  assert.equal(p.stdout, readFileSync(summaryPath, 'utf8'));
  const report = JSON.parse(readFileSync(join(dist, 'bundle-size-report.json'), 'utf8'));
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.entryPayload.entryAndStatic.js.count, 1);
  assert.equal(report.entryPayload.deferred.js.count, 1);
});

test('official frontend CI measures the existing build before uploading its artifact', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/react-frontend.yml', import.meta.url), 'utf8',
  );
  const build = workflow.indexOf('name: Build against the Chronicles staging API');
  const measure = workflow.indexOf('name: Report built JS/CSS gzip sizes');
  const browser = workflow.indexOf('name: Mount smoke — enter Chronicles and Tactics without crashing');
  assert.ok(build >= 0 && measure > build && browser > measure);
  assert.match(workflow, /node scripts\/report-bundle-size\.mjs dist/);
  assert.match(workflow, /name: chronicles-frontend-dist/);
});

test('Vite manifest follows static imports, deduplicates cycles and excludes lazy routes', (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'chronicles-bundle-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  makeBundle(dist);
  const measured = measureBundle(dist);
  const manifest = {
    'index.html': {
      file: 'assets/entry-123.js',
      isEntry: true,
      css: ['assets/style-123.css'],
      imports: ['_static.js', '_static.js'],
      dynamicImports: ['nonexistent-lazy-key'],
    },
    '_static.js': { file: 'assets/nested/route-abc.js', imports: ['_static.js'] },
  };
  const payload = measureEntryVsLazy(measured, manifest);
  assert.equal(payload.entryAndStatic.js.count, 2);
  assert.equal(payload.entryAndStatic.css.count, 1);
  assert.equal(payload.entryAndStatic.combined.rawBytes, measured.combined.rawBytes);
  assert.equal(payload.deferred.combined.count, 0);
  assert.equal(payload.entryAndStatic.combined.gzipBytes, measured.combined.gzipBytes);
});

test('Vite manifest is validated and cannot silently hide missing files or entries', (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'chronicles-bundle-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  makeBundle(dist);
  const measured = measureBundle(dist);
  for (const invalid of [null, {}, [], { 'index.html': { isEntry: true } }]) {
    assert.throws(() => measureEntryVsLazy(measured, invalid), /manifest|entry|chunk/);
  }
  assert.throws(() => measureEntryVsLazy(measured, {
    'index.html': { isEntry: true, file: 'assets/missing.js' },
  }), /missing asset/);
  assert.throws(() => measureEntryVsLazy(measured, {
    'index.html': { isEntry: true, file: 'assets/entry-123.js', imports: ['_missing'] },
  }), /missing imported chunk/);
});

test('Vite emits the manifest used to distinguish initial entry from deferred routes', () => {
  const config = readFileSync(new URL('../frontend/vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /manifest:\s*true/);
});
