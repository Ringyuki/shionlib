import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import type { Filter } from './admin-translator'
import { changeTranslator, loadTranslators } from './admin-translator.use-cases'

const tea = {
  id: 1,
  name: '绿茶汉化组',
  aliases: ['Green Tea'],
  homepage: null,
  works_count: 58,
  resources_count: 62,
  latest_credit: '2026-05-28T00:00:00Z',
}

const page: ApiData<'/admin/content/translators', 'get'> = {
  items: [tea],
  meta: { currentPage: 1, itemCount: 1, itemsPerPage: 20, totalItems: 592, totalPages: 30 },
}

const clusters: ApiData<'/admin/content/translators/duplicates', 'get'> = [
  { translators: [tea, { ...tea, id: 2, name: '绿茶汉化' }] },
  { translators: null },
]

const filter: Filter = { view: 'all', query: '', sort: 'works', page: 2 }

const queryOf = (url: string | undefined) => Object.fromEntries(new URL(url ?? '').searchParams)

describe('loadTranslators', () => {
  it('lists a page in the chosen order with the clusters that look alike', async () => {
    const fake = fakeApi()
      .on('get', '/admin/content/translators', page)
      .on('get', '/admin/content/translators/duplicates', clusters)
    const listing = await loadTranslators(fake.api, { ...filter, query: 'tea', sort: 'name' }, 20)
    expect(listing).toMatchObject({ translators: [tea], total: 592 })
    expect(listing.clusters).toEqual([[tea, { ...tea, id: 2, name: '绿茶汉化' }], []])
    const listed = fake.requests.find(request => !request.url.includes('duplicates'))
    expect(queryOf(listed?.url)).toEqual({
      page: '2',
      pageSize: '20',
      sortBy: 'name',
      sortOrder: 'asc',
      search: 'tea',
    })
  })

  it('asks only for the clusters when they are what is shown', async () => {
    const fake = fakeApi().on('get', '/admin/content/translators/duplicates', null)
    const listing = await loadTranslators(fake.api, { ...filter, view: 'duplicates' }, 20)
    expect(listing).toMatchObject({ translators: [], total: 0, clusters: [] })
    expect(fake.requests).toHaveLength(1)
  })
})

describe('changeTranslator', () => {
  it('sends the trimmed name and homepage of an edit', async () => {
    const fake = fakeApi().on('patch', '/admin/content/translators/{id}', undefined)
    await changeTranslator(fake.api, {
      action: 'edit',
      id: 1,
      name: ' 绿茶汉化组 ',
      aliases: ['Green Tea'],
      homepage: ' ',
    })
    const [request] = fake.requests
    expect(new URL(request?.url ?? '').pathname).toBe('/admin/content/translators/1')
    await expect(request?.json()).resolves.toEqual({
      name: '绿茶汉化组',
      aliases: ['Green Tea'],
      homepage: '',
    })
  })

  it('merges the other translators into the one that is kept', async () => {
    const fake = fakeApi().on('post', '/admin/content/translators/{id}/merge', undefined)
    await changeTranslator(fake.api, { action: 'merge', id: 1, mergedIds: [2, 3] })
    const [request] = fake.requests
    expect(new URL(request?.url ?? '').pathname).toBe('/admin/content/translators/1/merge')
    await expect(request?.json()).resolves.toEqual({ merged_ids: [2, 3] })
  })

  it('records the translators that are not the same', async () => {
    const fake = fakeApi().on('post', '/admin/content/translators/duplicates/dismiss', undefined)
    await changeTranslator(fake.api, { action: 'dismiss', ids: [1, 2] })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ ids: [1, 2] })
  })
})
