import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TICKET_SECRET: 'test-download-ticket-secret',
        },
      },
    }),
  ],
  test: {
    include: ['tests/**/*.spec.ts'],
  },
})
