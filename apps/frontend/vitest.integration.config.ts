import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      exclude: ['coverage/**', 'tests/**', '**/*.spec.ts', 'node_modules/**'],
      thresholds: {
        statements: 50,
        branches: 35,
        functions: 50,
        lines: 55,
      },
    },
  },
})
