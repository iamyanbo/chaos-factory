import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts', 'apps/show/src/games/**/*.test.ts'], testTimeout: 120000, fileParallelism: false }, resolve: { alias: { '@chaos/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)) } } });
