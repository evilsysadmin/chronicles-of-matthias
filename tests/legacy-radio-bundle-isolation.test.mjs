import assert from 'node:assert/strict';
import test from 'node:test';
import {
  legacyRadioModulesInBundle, chroniclesLegacyRadioIsolation,
} from '../frontend/scripts/legacy-radio-isolation.mjs';

function bundle(...paths) {
  return { game: { type: 'chunk', modules: Object.fromEntries(paths.map(p => [p, {}])) } };
}

test('does not flag Chronicles recorded soundtrack, actions or Three.js', () => {
  assert.deepEqual(legacyRadioModulesInBundle(bundle(
    '/repo/frontend/src/chronicles/useChroniclesSoundtrack.js',
    '/repo/frontend/src/chronicles/chroniclesActionAudio.js',
    '/repo/node_modules/three/build/three.core.js',
    '/repo/frontend/src/chroniclesOfMatthiasThree.js',
    '/repo/frontend/src/audioContext.js',
  )), []);
});

test('detects actual Chess Studio radio modules in lazy or initial chunks', () => {
  const source = {
    init: { type: 'chunk', modules: {
      '/repo/frontend/src/ambientCatalog.js': {},
      '/repo/frontend/src/musicTuning.js?rolled': {},
    } },
    lazy: { type: 'chunk', modules: {
      '/repo/frontend/src/ambientChessStudioCollection.js': {},
      '/repo/frontend/src/ambientCatalog.js': {},
      '/repo/frontend/src/ambientRadioMatthiasExpansion.js': {},
    } },
    asset: { type: 'asset', modules: {
      '/repo/frontend/src/ambientStructuredCatalog.js': {},
    } },
  };
  assert.deepEqual(legacyRadioModulesInBundle(source), [
    'ambientCatalog.js',
    'ambientChessStudioCollection.js',
    'ambientRadioMatthiasExpansion.js',
    'musicTuning.js',
  ]);
});

test('does not mistake tests, similarly named paths, dependencies or assets for shipped radio', () => {
  assert.deepEqual(legacyRadioModulesInBundle(bundle(
    '/repo/frontend/src/ambientCatalog.test.js',
    '/repo/node_modules/lib/ambientCatalog.js',
    '/repo/frontend/src/chronicles/ambientCatalog.js',
    '/repo/frontend/src/ambientMusic.mp3',
    '/repo/frontend/src/ambienttheme.js',
    '/repo/frontend/src/ambientX.jsx',
  )), []);
});

test('build plugin aborts a release that includes a legacy radio module', () => {
  const plugin = chroniclesLegacyRadioIsolation();
  assert.equal(plugin.name, 'chronicles-standalone-no-legacy-radio');
  assert.throws(() => plugin.generateBundle.call({
    error(reason) { throw new Error(reason); },
  }, {}, bundle('/runner/frontend/src/ambientProfiles.js')),
  /Chess Studio radio must not ship.*ambientProfiles\.js/);
});

test('build plugin accepts Chronicles-only runtime chunks without false positives', () => {
  const plugin = chroniclesLegacyRadioIsolation();
  const old = console.log;
  const outputs = [];
  try {
    console.log = line => outputs.push(line);
    plugin.generateBundle.call({ error(msg) { throw new Error(msg); } },
      {}, bundle('/runner/frontend/src/chronicles/useChroniclesSoundtrack.js'));
  } finally {
    console.log = old;
  }
  assert.deepEqual(outputs, ['CHRONICLES_STANDALONE_RADIO_ISOLATED bundled_legacy_modules=0']);
});
