import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData, Schema } from '~/shared/api/types'
import { loadHome } from './home.use-cases'

const game: Schema<'GameListItemDTO'> = {
  id: 7,
  title_zh: '樱之诗',
  title_jp: 'サクラノ詩',
  title_en: '',
  intro_zh: '',
  intro_jp: '',
  intro_en: '',
  aliases: null,
  type: null,
  release_date: '2026-10-23T00:00:00Z',
  covers: null,
  developers: null,
  tags: null,
  resources: { count: 0, downloads: 0, languages: null, platforms: null, latest: null },
  views: 0,
}

const listed: ApiData<'/game/list', 'get'> = {
  items: [game],
  meta: {
    currentPage: 1,
    itemCount: 1,
    itemsPerPage: 12,
    totalItems: 1,
    totalPages: 1,
    content_limit: 0,
  },
}

const now = new Date('2026-10-07T12:00:00Z')

describe('loadHome', () => {
  it('loads the three blocks with their own ordering', async () => {
    const fake = fakeApi().on('get', '/game/list', listed)
    await expect(loadHome(fake.api, now)).resolves.toEqual({
      month: 10,
      recent: { ok: true, data: [game] },
      releases: { ok: true, data: [game] },
      hot: { ok: true, data: [game] },
    })
    const [recent, releases, hot] = fake.requests.map(request =>
      Object.fromEntries(new URL(request.url).searchParams),
    )
    expect(recent).toEqual({ pageSize: '12', 'filter[sort_by]': 'resource_updated' })
    expect(releases).toEqual({
      pageSize: '40',
      resources: 'any',
      'filter[start_date]': '2026-10-01',
      'filter[end_date]': '2026-10-31',
      'filter[sort_by]': 'release_date',
      'filter[sort_order]': 'asc',
    })
    expect(hot).toEqual({ pageSize: '12', 'filter[sort_by]': 'hot_score' })
  })

  it('marks the blocks whose list fails instead of failing the page', async () => {
    const fake = fakeApi().fail('get', '/game/list', 500, { code: 500, message: 'failed' })
    await expect(loadHome(fake.api, now)).resolves.toEqual({
      month: 10,
      recent: { ok: false },
      releases: { ok: false },
      hot: { ok: false },
    })
  })
})
