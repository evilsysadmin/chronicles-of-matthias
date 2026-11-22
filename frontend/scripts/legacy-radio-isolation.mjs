// Guard the *shipped* Chronicles entry and lazy game chunks against
// accidentally reintroducing Chess Studio's procedural radio. The standalone
// game owns recorded MP3 playback; catalog/source files can remain in history.
// Vite's Rollup chunk.modules is authoritative for production bundle reachability.
export function legacyRadioModulesInBundle(bundle) {
  const paths = new Set();
  for (const chunk of Object.values(bundle || {})) {
    if (chunk?.type !== 'chunk' || !chunk.modules) continue;
    for (const rawId of Object.keys(chunk.modules)) {
      const id = rawId.replaceAll('\\', '/').split('?')[0];
      if (/\/frontend\/src\/(?:ambient[A-Z][\w]*|musicTuning)\.js$/.test(id)) {
        paths.add(id.slice(id.lastIndexOf('/frontend/src/') + 14));
      }
    }
  }
  return [...paths].sort();
}

export function chroniclesLegacyRadioIsolation() {
  return {
    name: 'chronicles-standalone-no-legacy-radio',
    generateBundle(_options, bundle) {
      const files = legacyRadioModulesInBundle(bundle);
      if (files.length) {
        this.error('Chess Studio radio must not ship in standalone Chronicles: ' + files.join(', '));
      }
      console.log('CHRONICLES_STANDALONE_RADIO_ISOLATED bundled_legacy_modules=0');
    },
  };
}
