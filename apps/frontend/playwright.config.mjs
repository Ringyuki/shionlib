import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT || 3100)
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`
const HAS_EXTERNAL_BASE_URL = Boolean(process.env.E2E_BASE_URL)
const IS_CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: HAS_EXTERNAL_BASE_URL
    ? undefined
    : {
        command: `pnpm dev --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !IS_CI,
        timeout: 180_000,
      },
})
