import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, loginAndExtractAuthCookies } from '../_helpers/fixtures.mjs'

test.describe('Admin stats endpoints', () => {
  test('admin should access overview and trends with expected payload shape', async ({
    request,
  }) => {
    const adminCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const authHeaders = {
      cookie: adminCookies.cookieHeader,
    }

    const overviewResponse = await request.get('/api/admin/stats/overview', {
      headers: authHeaders,
    })
    expect(overviewResponse.ok()).toBeTruthy()
    const overviewPayload = await overviewResponse.json()
    expect(overviewPayload?.code).toBe(0)
    expect(overviewPayload?.data?.totalGames).toBeGreaterThan(0)
    expect(overviewPayload?.data?.totalUsers).toBeGreaterThanOrEqual(2)
    expect(overviewPayload?.data?.totalComments).toBeGreaterThanOrEqual(2)

    const trendsResponse = await request.get('/api/admin/stats/trends?days=7', {
      headers: authHeaders,
    })
    expect(trendsResponse.ok()).toBeTruthy()
    const trendsPayload = await trendsResponse.json()
    expect(trendsPayload?.code).toBe(0)
    expect(Array.isArray(trendsPayload?.data)).toBeTruthy()
    expect(trendsPayload?.data).toHaveLength(7)

    const latestPoint = trendsPayload.data[trendsPayload.data.length - 1]
    expect(latestPoint).toHaveProperty('date')
    expect(typeof latestPoint.games).toBe('number')
    expect(typeof latestPoint.users).toBe('number')
    expect(typeof latestPoint.downloads).toBe('number')
    expect(typeof latestPoint.views).toBe('number')
  })
})
