import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { loadDeveloper, loadDevelopers } from './developer.use-cases'

const listed = (totalItems: number): ApiData<'/developer/list', 'get'> => ({
  items: [
    {
      id: 1,
      name: 'まどそふと',
      aliases: ['窗社'],
      logo: null,
      logo_thumb_hash: null,
      works_count: 4,
    },
  ],
  meta: { currentPage: 1, itemCount: 1, itemsPerPage: 48, totalItems, totalPages: 1 },
})

const developer: ApiData<'/developer/{id}', 'get'> = {
  id: 1,
  h_id: 7,
  name: 'まどそふと',
  aliases: ['窗社'],
  logo: null,
  logo_thumb_hash: null,
  intro_jp: '',
  intro_zh: '',
  intro_en: '',
  website: null,
  extra_info: null,
}

const games: ApiData<'/game/list', 'get'> = {
  items: null,
  meta: {
    currentPage: 1,
    itemCount: 0,
    itemsPerPage: 36,
    totalItems: 4,
    totalPages: 1,
    content_limit: 0,
  },
}

describe('loadDevelopers', () => {
  it('lists a page of every developer when nothing is searched', async () => {
    const fake = fakeApi().on('get', '/developer/list', listed(7051))
    const developers = await loadDevelopers(fake.api, '', 3)
    expect(developers).toMatchObject({ query: '', page: 3, total: 7051 })
    expect(Object.fromEntries(new URL(fake.requests[0]?.url ?? '').searchParams)).toEqual({
      page: '3',
      pageSize: '48',
    })
  })

  it('searches names and aliases', async () => {
    const fake = fakeApi().on('get', '/developer/list', listed(1))
    await loadDevelopers(fake.api, '窗社', 1)
    expect(new URL(fake.requests[0]?.url ?? '').searchParams.get('q')).toBe('窗社')
  })
})

describe('loadDeveloper', () => {
  it('loads the developer with a page of its works in the chosen order', async () => {
    const fake = fakeApi().on('get', '/developer/{id}', developer).on('get', '/game/list', games)
    const order = { sort: 'downloads', ascending: false } as const
    await expect(loadDeveloper(fake.api, 1, 1, order)).resolves.toEqual({
      developer,
      works: { games: [], total: 4, page: 1, order },
    })
    const works = fake.requests.find(request => request.url.includes('/game/list'))
    expect(Object.fromEntries(new URL(works?.url ?? '').searchParams)).toEqual({
      developer_id: '1',
      page: '1',
      pageSize: '36',
      'filter[sort_by]': 'downloads',
      'filter[sort_order]': 'desc',
    })
  })
})
