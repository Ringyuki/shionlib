import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { loadTranslator, loadTranslators, suggestTranslators } from './translator.use-cases'

const listed = (totalItems: number): ApiData<'/translator/list', 'get'> => ({
  items: [{ id: 1, name: '绿茶汉化组', aliases: [], works_count: 58 }],
  meta: { currentPage: 1, itemCount: 1, itemsPerPage: 48, totalItems, totalPages: 1 },
})

const translator: ApiData<'/translator/{id}', 'get'> = {
  id: 1,
  name: '绿茶汉化组',
  aliases: [],
  homepage: null,
  works_count: 58,
}

const games: ApiData<'/game/list', 'get'> = {
  items: null,
  meta: {
    currentPage: 1,
    itemCount: 0,
    itemsPerPage: 36,
    totalItems: 58,
    totalPages: 2,
    content_limit: 0,
  },
}

describe('loadTranslators', () => {
  it('lists a page of every translator when nothing is searched', async () => {
    const fake = fakeApi().on('get', '/translator/list', listed(608))
    const translators = await loadTranslators(fake.api, '', 2)
    expect(translators).toMatchObject({ query: '', page: 2, total: 608 })
    expect(Object.fromEntries(new URL(fake.requests[0]?.url ?? '').searchParams)).toEqual({
      page: '2',
      pageSize: '48',
    })
  })

  it('searches names and aliases', async () => {
    const fake = fakeApi().on('get', '/translator/list', listed(1))
    await loadTranslators(fake.api, '绿茶', 1)
    expect(new URL(fake.requests[0]?.url ?? '').searchParams.get('q')).toBe('绿茶')
  })
})

describe('loadTranslator', () => {
  it('loads the translator with a page of the games it is credited in', async () => {
    const fake = fakeApi().on('get', '/translator/{id}', translator).on('get', '/game/list', games)
    const order = { sort: 'release_date', ascending: false } as const
    await expect(loadTranslator(fake.api, 1, 2, order)).resolves.toEqual({
      translator,
      works: { games: [], total: 58, page: 2, order },
    })
    const works = fake.requests.find(request => request.url.includes('/game/list'))
    expect(new URL(works?.url ?? '').searchParams.get('translator_id')).toBe('1')
  })
})

describe('suggestTranslators', () => {
  it('asks for the translators that match what is typed', async () => {
    const fake = fakeApi().on('get', '/translator/suggest', listed(1).items)
    await expect(suggestTranslators(fake.api, '绿')).resolves.toHaveLength(1)
    expect(new URL(fake.requests[0]?.url ?? '').searchParams.get('q')).toBe('绿')
  })

  it('answers an empty list when there is none', async () => {
    const fake = fakeApi().on('get', '/translator/suggest', null)
    await expect(suggestTranslators(fake.api, '')).resolves.toEqual([])
  })
})
