import mdx from '@mdx-js/rollup'
import { defineConfig } from 'vitest/config'
import { mdxOptions } from './mdx/options.ts'

export default defineConfig({
  plugins: [mdx(mdxOptions)],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['app/**/*.test.{ts,tsx}', 'mdx/**/*.test.ts', 'eslint/**/*.test.js'],
    environment: 'node',
  },
})
