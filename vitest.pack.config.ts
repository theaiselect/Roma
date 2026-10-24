// Prepara public/offline/roma.json (calles, sitios, puntos y metro de Overpass) con internet real.
// Uso: npx vitest run --config vitest.pack.config.ts   (lo lanza .github/workflows/datos.yml)
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['tests/pack/**/*.test.ts'], environment: 'node', testTimeout: 1_800_000 },
});
