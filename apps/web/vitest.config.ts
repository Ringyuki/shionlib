import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['app/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
