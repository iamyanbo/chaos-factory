import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Keep dev on the installed physics module, matching production and headless.
  // A long-lived optimized copy previously retained an older Rapier runtime.
  optimizeDeps: { exclude: ['@dimforge/rapier2d-deterministic-compat'] },
  server: { port: 5173, strictPort: true, host: process.env.DASHBOARD_LAN === '1' ? '0.0.0.0' : '127.0.0.1', proxy: {
    '/ws': { target: 'ws://127.0.0.1:4174', ws: true }, '/api': 'http://127.0.0.1:4174',
    '/auth/device': 'http://127.0.0.1:4174'
  } },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1800 },
  resolve: { alias: { '@chaos/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) } }
});
