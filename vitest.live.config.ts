// Comprobación de los servicios externos con internet real (no entra en `npx vitest run`).
// Uso: npx vitest run --config vitest.live.config.ts   (lo lanza .github/workflows/servicios.yml)
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['tests/live/**/*.test.ts'], environment: 'node', testTimeout: 240_000, hookTimeout: 240_000 },
});
