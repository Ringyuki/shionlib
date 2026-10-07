import { defineConfig, devices } from '@playwright/test'
import type { IngressOptions } from './e2e/support/ingress'

const port = Number(process.env.E2E_WEB_PORT ?? 5330)
const external = process.env.E2E_BASE_URL
const baseURL = external ?? `http://localhost:${port}`
const ci = process.env.CI !== undefined
const api = process.env.E2E_API_URL ?? 'http://localhost:5201'

export default defineConfig<IngressOptions>({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    apiOrigin: external === undefined ? api : undefined,
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'sessions', testMatch: /sessions\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /\.spec\.ts/,
      use: devices['Desktop Chrome'],
      dependencies: ['sessions'],
    },
  ],
  webServer:
    external === undefined
      ? {
          command: 'pnpm build && pnpm start',
          url: baseURL,
          reuseExistingServer: !ci,
          timeout: 180_000,
          env: {
            PORT: String(port),
            API_INTERNAL_URL: api,
            TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
            HIKARINAGI_SITE_URL: 'https://www.hikarinagi.org',
          },
        }
      : undefined,
})
