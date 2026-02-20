import { expect, test } from '@playwright/test'

const unwrap = payload => payload?.data ?? payload

test.describe('System api behavior', () => {
  test('health endpoint should be available', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.ok()).toBeTruthy()

    const payload = await response.json()
    const health = unwrap(payload)

    expect(health?.status).toBe('ok')
    expect(typeof health?.latencyMs).toBe('number')
  })

  test('analysis overview should gracefully fallback without cloudflare analytics config', async ({
    request,
  }) => {
    const response = await request.get('/api/analysis/data/overview')
    expect(response.ok()).toBeTruthy()

    const payload = await response.json()
    const overview = unwrap(payload)

    expect(typeof overview?.games).toBe('number')
    expect(typeof overview?.files).toBe('number')
    expect(typeof overview?.resources).toBe('number')
    expect(typeof overview?.storage).toBe('number')
    expect(typeof overview?.bytes_gotten).toBe('number')
    expect(overview?.bytes_gotten).toBeGreaterThanOrEqual(0)
  })
})
