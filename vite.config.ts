/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const version = `${pkg.version}+${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    preact(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        rollupFormat: 'iife', // se registra como script clásico: un módulo ES haría fallar el registro
        // roma.pmtiles NO va en el precaché (pesa ~25 MB): tiene su propia caché.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest,json,pbf}'],
        globIgnores: ['**/map/roma.pmtiles'],
      },
      manifest: {
        name: 'Roma',
        short_name: 'Roma',
        lang: 'es',
        display: 'standalone',
        start_url: '/?source=pwa',
        scope: '/',
        theme_color: '#C0583A',
        background_color: '#F7F3EE',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: { target: 'es2020', sourcemap: false },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
