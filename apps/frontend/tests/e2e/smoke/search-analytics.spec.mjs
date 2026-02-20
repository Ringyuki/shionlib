import { expect, test } from '@playwright/test'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

test.describe('Search analytics', () => {
  test('search query should propagate to suggest and trending', async ({ request }) => {
    const uniqueQuery = `e2e-search-${Date.now()}`
    const prefix = uniqueQuery.slice(0, 8)

    const searchResponse = await request.get('/api/search/games', {
      params: {
        q: uniqueQuery,
        page: '1',
        pageSize: '20',
      },
    })

    expect(searchResponse.ok()).toBeTruthy()
    const searchPayload = await searchResponse.json()
    expect(searchPayload?.code).toBe(0)

    let suggestMatched = false
    let trendingMatched = false

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const [suggestResponse, trendingResponse] = await Promise.all([
        request.get('/api/search/suggest', {
          params: { prefix, limit: '50' },
        }),
        request.get('/api/search/trending', {
          params: { limit: '50' },
        }),
      ])

      expect(suggestResponse.ok()).toBeTruthy()
      expect(trendingResponse.ok()).toBeTruthy()

      const suggestPayload = await suggestResponse.json()
      const trendingPayload = await trendingResponse.json()
      expect(suggestPayload?.code).toBe(0)
      expect(trendingPayload?.code).toBe(0)

      const suggestItems = Array.isArray(suggestPayload?.data) ? suggestPayload.data : []
      const trendingItems = Array.isArray(trendingPayload?.data) ? trendingPayload.data : []

      suggestMatched = suggestItems.some(item => item?.query === uniqueQuery)
      trendingMatched = trendingItems.some(item => item?.query === uniqueQuery)

      if (suggestMatched && trendingMatched) break
      await sleep(500)
    }

    expect(suggestMatched).toBeTruthy()
    expect(trendingMatched).toBeTruthy()
  })
})
