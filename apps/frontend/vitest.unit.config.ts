import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@/public/assets/styles/globals.css': fileURLToPath(
        new URL('./tests/unit/_helpers/empty-style.ts', import.meta.url),
      ),
      '@': rootDir,
    },
  },
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    css: false,
  },
})
