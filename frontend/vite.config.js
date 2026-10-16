import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BUILD_ID = String(process.env.VITE_BUILD_SHA || '').trim();

export default defineConfig({
  base: process.env.CHRONICLES_DEPLOY_BASE || '/',
  // release.js (vendorizado) lee esta constante igual que en Chess Studio.
  define: { __CHESS_BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react()],
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
