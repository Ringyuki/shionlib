import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, loginAndExtractAuthCookies } from '../_helpers/fixtures.mjs'

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
    await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.listSafe.identifier,
      E2E_FIXTURES.users.listSafe.password,
    )

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

  test('should keep games with download resources visible to guests', async ({
    request,
    playwright,
  }) => {
    const titlesOf = items =>
      items.flatMap(item => [item.title_en, item.title_zh, item.title_jp]).filter(Boolean)
    const query = new URLSearchParams({ page: '1', pageSize: '50' }).toString()

    const guestList = await requestGameList(request, query)
    expect(titlesOf(guestList.items)).toContain(E2E_FIXTURES.games.primary.title)

    const member = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    try {
      await loginAndExtractAuthCookies(
        member,
        E2E_FIXTURES.users.listSafe.identifier,
        E2E_FIXTURES.users.listSafe.password,
      )
      const fullList = await requestGameList(member, query)
      expect(fullList.meta.totalItems).toBe(3)
      expect(guestList.meta.totalItems).toBeLessThanOrEqual(fullList.meta.totalItems)
      const fullIds = fullList.items.map(item => item.id)
      for (const item of guestList.items) {
        expect(fullIds).toContain(item.id)
      }
    } finally {
      await member.dispose()
    }
  })
})
