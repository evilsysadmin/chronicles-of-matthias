import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSourceGraph, moduleSpecifiers, readFrontendSources } from '../scripts/audit-frontend-reachability.mjs';

test('collects static, side-effect, re-export, require and literal dynamic imports', () => {
  const found = moduleSpecifiers("import '../safeStorage.js'; import { v } from '../value.js'; export {x} from '../other.js'; import('./lazy/Component.jsx'); require('./old.js')").sort();
  assert.deepEqual(found, ['../other.js', '../safeStorage.js', '../value.js', './lazy/Component.jsx', './old.js'].sort());
});

test('walks production imports and flags test-only modules without deleting them', () => {
  const result = analyzeSourceGraph({
    'standalone/main.jsx': "import './App.jsx'",
    'standalone/App.jsx': "import('../components/Game.jsx')",
    'components/Game.jsx': "export { rules } from '../rules.js'",
    'rules.js': 'export const rules = true',
    'legacy.js': 'export const dead = true',
    'legacy.test.js': "import { dead } from './legacy.js'",
    'standalone/test-setup.js': 'export const setup = true',
  });
  assert.equal(result.reachable, 4);
  assert.deepEqual(new Map(result.unused.map(x => [x.name, x.category])), new Map([
    ['legacy.js', 'test-only'], ['standalone/test-setup.js', 'unreferenced'],
  ]));
});

test('unresolved and computed imports are visible, never silently claimed dead', () => {
  const result = analyzeSourceGraph({
    'standalone/main.jsx': "import './missing.js'; import('./pages/' + name); import.meta.glob('./data/*.js')",
    'orphan.js': 'export const used = false',
  });
  assert.deepEqual(result.unresolved, [{ from: 'standalone/main.jsx', specifier: './missing.js' }]);
  assert.deepEqual(result.dynamic, ['standalone/main.jsx']);
  assert.equal(result.unused[0].name, 'orphan.js');
  assert.deepEqual(result.importedBy['orphan.js'], []);
});

test('shows reverse imports for transitive test-only composition modules', () => {
  const report = analyzeSourceGraph({
    'standalone/main.jsx': 'export const game = true',
    'radio/registry.js': "import { install } from './composer.js'; install();",
    'radio/composer.js': 'export function install() {}',
    'radio/registry.test.js': "import './registry.js'",
  });
  assert.deepEqual(report.importedBy['radio/composer.js'], ['radio/registry.js']);
  assert.deepEqual(report.importedBy['radio/registry.js'], ['radio/registry.test.js']);
  const composer = report.unused.find(row => row.name === 'radio/composer.js');
  assert.equal(composer.category, 'test-only');
  assert.deepEqual(composer.importers, ['radio/registry.js']);
});

test('produce an informational inventory of the real Chronicles frontend', t => {
  const report = analyzeSourceGraph(readFrontendSources());
  assert.ok(report.total > 100, 'expected the real Chronicles frontend source tree');
  assert.ok(report.reachable > 20, 'the standalone game entrypoint should resolve');
  t.diagnostic('Modules: ' + report.total + ', runtime reachable: ' + report.reachable +
    ', review: ' + report.unused.length + ', nonliteral imports: ' + report.dynamic.length);
  for (const row of report.unused.slice(0, 12)) {
    t.diagnostic(row.category + ' ' + row.bytes + ' B ' + row.name
      + ' <- ' + (row.importers.join(', ') || '[no literal imports]'));
  }
  const orphans = report.unused.filter(row => row.category === 'unreferenced');
  t.diagnostic('Unreferenced review candidates: ' + orphans.length);
  for (const row of orphans) t.diagnostic('unreferenced ' + row.bytes + ' B ' + row.name
    + ' <- ' + (row.importers.join(', ') || '[no literal imports]'));
});
