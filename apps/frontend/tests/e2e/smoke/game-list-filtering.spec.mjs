import { expect, test } from '@playwright/test'
import { E2E_FIXTURES } from '../_helpers/fixtures.mjs'

const requestGameList = async (request, query) => {
  const response = await request.get(`/api/game/list?${query}`)
  expect(response.ok()).toBeTruthy()

  const payload = await response.json()
  expect(payload?.code).toBe(0)
  expect(payload?.data?.items).toBeDefined()
  expect(payload?.data?.meta).toBeDefined()

  return payload.data
}

test.describe('Game list filtering and pagination', () => {
  test('should support sort, pagination and year filters in combination', async ({ request }) => {
    const sortedPage1 = await requestGameList(
      request,
      new URLSearchParams({
        page: '1',
        pageSize: '2',
        'filter[sort_by]': 'views',
        'filter[sort_order]': 'desc',
      }).toString(),
    )
    expect(sortedPage1.meta.totalItems).toBe(3)
    expect(sortedPage1.meta.totalPages).toBe(2)
    expect(sortedPage1.items).toHaveLength(2)
    expect(sortedPage1.items[0].views).toBeGreaterThanOrEqual(sortedPage1.items[1].views)

    const sortedPage2 = await requestGameList(
      request,
      new URLSearchParams({
        page: '2',
        pageSize: '2',
        'filter[sort_by]': 'views',
        'filter[sort_order]': 'desc',
      }).toString(),
    )
    expect(sortedPage2.meta.currentPage).toBe(2)
    expect(sortedPage2.items).toHaveLength(1)
    expect(sortedPage2.items[0].id).not.toBe(sortedPage1.items[0].id)

    const yearFiltered = await requestGameList(
      request,
      new URLSearchParams({
        page: '1',
        pageSize: '10',
        'filter[years][]': '2025',
      }).toString(),
    )
    expect(yearFiltered.meta.totalItems).toBe(1)
    expect(yearFiltered.items).toHaveLength(1)

    const titleCandidates = [
      yearFiltered.items[0].title_en,
      yearFiltered.items[0].title_zh,
      yearFiltered.items[0].title_jp,
    ].filter(Boolean)
    expect(titleCandidates).toContain(E2E_FIXTURES.games.primary.title)
  })
})
