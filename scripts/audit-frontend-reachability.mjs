#!/usr/bin/env node
// Advisory, static import-reachability report. NEVER delete a module based on
// this report alone: dynamic imports, assets and tooling can have other roots.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../frontend/src/', import.meta.url));
const RUNTIME_ENTRY = 'standalone/main.jsx';
const MODULE_EXTENSIONS = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];
const isTest = (name) => /(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(name);

export function moduleSpecifiers(source) {
  const text = String(source);
  const specs = new Set();
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) specs.add(match[1]);
  return [...specs];
}

export function analyzeSourceGraph(files, runtimeEntry = RUNTIME_ENTRY) {
  // The caller supplies paths relative to src with their source contents.
  const sources = new Map(Object.entries(files).filter(([name]) => MODULE_EXTENSIONS.includes(extname(name))));
  const names = new Set(sources.keys());
  const unresolved = [];
  const edges = new Map();
  const dynamic = [];
  for (const [name, content] of sources) {
    const deps = new Set();
    for (const spec of moduleSpecifiers(content)) {
      if (!spec.startsWith('.')) continue; // dependencies belong to the bundler
      const basename = resolve('/src', name, '..', spec.split(/[?#]/)[0]);
      const normalized = relative('/src', basename).replaceAll('\\', '/');
      const candidates = [normalized, ...MODULE_EXTENSIONS.map(ext => normalized + ext),
        ...MODULE_EXTENSIONS.map(ext => normalized + '/index' + ext)];
      const dep = candidates.find(candidate => names.has(candidate));
      if (dep) deps.add(dep);
      else if (!/\.(?:css|json|png|webp|svg|jpg|jpeg|glb|mp3|wav|ogg|woff2?)$/i.test(spec.split(/[?#]/)[0]))
        unresolved.push({ from: name, specifier: spec });
    }
    if (/\bimport\s*\(\s*(?!['"])/.test(content) || /\bimport\.meta\.glob\s*\(/.test(content)) dynamic.push(name);
    edges.set(name, [...deps]);
  }
  // Direct reverse edges make a test-only dependency chain visible. A module
  // can be absent from the game bundle and still be required by legacy tests.
  const importedBy = Object.fromEntries([...names].map(name => [name, []]));
  for (const [source, dependencies] of edges) {
    for (const dependency of dependencies) importedBy[dependency].push(source);
  }
  for (const consumers of Object.values(importedBy)) consumers.sort();
  function walk(roots) {
    const seen = new Set(), stack = [...roots];
    while (stack.length) {
      const name = stack.pop();
      if (!names.has(name) || seen.has(name)) continue;
      seen.add(name);
      stack.push(...(edges.get(name) || []));
    }
    return seen;
  }
  const production = walk([runtimeEntry]);
  const tests = walk([...names].filter(isTest));
  const unused = [...names].filter(name => !isTest(name) && !production.has(name))
    .map(name => ({ name, category: tests.has(name) ? 'test-only' : 'unreferenced', bytes: Buffer.byteLength(sources.get(name)), importers: importedBy[name] }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  return { total: names.size, reachable: production.size, testOnly: unused.filter(x => x.category === 'test-only').length,
    unused, unresolved, dynamic, importedBy };
}

export function readFrontendSources(root = ROOT) {
  const files = {};
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && MODULE_EXTENSIONS.includes(extname(entry.name))) {
        const rel = relative(root, absolute).replaceAll('\\', '/');
        files[rel] = readFileSync(absolute, 'utf8');
      }
    }
  }
  visit(root);
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = analyzeSourceGraph(readFrontendSources());
  console.log('Chronicles frontend static reachability (advisory; not proof of dead code)');
  console.log('Modules ' + report.total + '; runtime reachable ' + report.reachable + '; test-only ' + report.testOnly + '; review ' + report.unused.length);
  console.log('Nonliteral import/glob owners: ' + report.dynamic.length + '; unresolved relative imports: ' + report.unresolved.length);
  for (const row of report.unused.slice(0, 25)) {
    console.log('  ' + row.category.padEnd(12) + ' ' + String(row.bytes).padStart(7) + ' B ' + row.name
      + ' <- ' + (row.importers.join(', ') || '[no literal imports]'));
  }
  const orphaned = report.unused.filter(row => row.category === 'unreferenced');
  console.log('Unreferenced candidates (' + orphaned.length + '; review nonliteral and tooling entrypoints manually):');
  for (const row of orphaned) console.log('  ' + String(row.bytes).padStart(7) + ' B ' + row.name
    + ' <- ' + (row.importers.join(', ') || '[no literal imports]'));
  if (report.unresolved.length) for (const row of report.unresolved.slice(0, 10)) console.log('  unresolved ' + row.from + ' => ' + row.specifier);
  // Reporting-only until imports and dynamic entrypoints are verified manually.
}
