/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json' with { type: 'json' };

// NFR-SEC-1. 'wasm-unsafe-eval' is needed by the self-hosted zxing-wasm QR fallback (DECISIONS D20).
export const CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' blob: data:; " +
  "style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; worker-src 'self'; " +
  "manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

/** Adds the CSP meta tag to production builds only (dev needs inline HMR scripts). */
function cspMeta(): Plugin {
  return {
    name: 'liftlog-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const native = mode === 'native';
  return {
    base: native ? './' : '/',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    plugins: [
      react(),
      tailwindcss(),
      cspMeta(),
      VitePWA({
        disable: native,
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icons/*.png', 'theme-boot.js', 'zxing/*.wasm'],
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,woff2,png,svg,json,wasm,webmanifest}'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        manifest: {
          id: '/',
          name: 'LiftLog',
          short_name: 'LiftLog',
          description: 'Workout logbook that plans every set. Works offline, no account.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#F2EADB',
          theme_color: '#F2EADB',
          categories: ['health', 'fitness', 'sports'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 800,
    },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      css: false,
      // Screen tests wait up to 8 s for elements; the 5 s default cut them off under full parallel load (D80).
      testTimeout: 15_000,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/sw.ts',
          'src/main.tsx',
          'src/**/*.d.ts',
          'src/data/**',
        ],
        reporter: ['text-summary', 'json-summary', 'html'],
        thresholds: {
          lines: 70,
          'src/engine/**': { lines: 90 },
        },
      },
    },
  };
});
