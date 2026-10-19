import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { buildReleaseManifest } from './src/releaseManifest.js';
import { APP_RELEASE } from './src/release.js';

const BUILD_ID = String(process.env.VITE_BUILD_SHA || '').trim();

function chroniclesReleaseManifest() {
  return {
    name: 'chronicles-release-manifest',
    generateBundle() {
      // Emitted with the *same immutable SHA* as this exact Vite bundle.
      // Never cache a deploy version in localStorage or guess it from the API.
      const manifest = buildReleaseManifest({ release: APP_RELEASE, buildSha: BUILD_ID });
      this.emitFile({
        type: 'asset',
        fileName: 'release.json',
        source: JSON.stringify(manifest),
      });
    },
  };
}

export default defineConfig({
  base: process.env.CHRONICLES_DEPLOY_BASE || '/',
  // release.js (vendorizado) lee esta constante igual que en Chess Studio.
  define: { __CHESS_BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), chroniclesReleaseManifest()],
  test: {
    environment: 'node',
    setupFiles: ['./src/standalone/test-setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'test/**/*.test.{js,jsx}'],
  },
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/three/')) return 'vendor-three';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
          if (id.includes('/chess.js/')) return 'vendor-chess';
          return 'vendor';
        },
      },
    },
  },
});
