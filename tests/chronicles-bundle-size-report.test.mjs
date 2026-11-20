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
  formatBundleSummary, measureBundle, writeBundleReport,
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
  assert.deepEqual(actual, measureBundle(dist));
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
  assert.deepEqual(JSON.parse(readFileSync(join(dist, 'bundle-size-report.json'), 'utf8')),
    measureBundle(dist));
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
