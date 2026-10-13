import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { branchKey } from './inspection'
import { entry, folder, inspection } from './inspection-testing'
import {
  chosenInspection,
  loadContents,
  loadEntryPage,
  loadImagePreview,
  loadInspections,
  loadTextPreview,
} from './inspection.use-cases'

const meta = (total: number, count: number) => ({
  totalItems: total,
  itemCount: count,
  itemsPerPage: 200,
  totalPages: 1,
  currentPage: 1,
})

const queryOf = (request: Request | undefined) =>
  Object.fromEntries(new URL(request?.url ?? 'http://none').searchParams)

describe('loadInspections', () => {
  it('reads a resource none of whose files was inspected as an empty list', async () => {
    const fake = fakeApi().on('get', '/inspection/resource/{resource_id}', null)
    await expect(loadInspections(fake.api, 31)).resolves.toEqual([])
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/inspection/resource/31')
  })
})

describe('loadEntryPage', () => {
  it('lists the top level, and a folder when one is named', async () => {
    const fake = fakeApi().on('get', '/inspection/{id}/entries', {
      items: [entry(2)],
      meta: meta(450, 1),
    })
    const top = { inspectionId: 7, parent: null, page: 1, query: '' }
    await expect(loadEntryPage(fake.api, top)).resolves.toEqual({ entries: [entry(2)], total: 450 })
    await loadEntryPage(fake.api, { ...top, parent: 12, page: 3 })
    expect(queryOf(fake.requests[0])).toEqual({ page: '1', pageSize: '200' })
    expect(queryOf(fake.requests[1])).toEqual({ page: '3', pageSize: '200', parent_id: '12' })
  })

  it('searches the whole listing when there is a filter', async () => {
    const found = { ...entry(4, { name: 'game.exe' }), location: 'Game' }
    const fake = fakeApi().on('get', '/inspection/{id}/search', {
      items: [found],
      meta: meta(1, 1),
    })
    await expect(
      loadEntryPage(fake.api, { inspectionId: 7, parent: 12, page: 2, query: 'exe' }),
    ).resolves.toEqual({ entries: [found], total: 1 })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/inspection/7/search')
    expect(queryOf(fake.requests[0])).toEqual({ q: 'exe', page: '2', pageSize: '200' })
  })

  it('reads an empty page as no entries', async () => {
    const fake = fakeApi().on('get', '/inspection/{id}/entries', { items: null, meta: meta(0, 0) })
    await expect(
      loadEntryPage(fake.api, { inspectionId: 7, parent: null, page: 1, query: '' }),
    ).resolves.toEqual({ entries: [], total: 0 })
  })
})

describe('chosenInspection', () => {
  const both = [inspection(7), inspection(8)]

  it('takes the named one, and the first when none or an unknown one is named', () => {
    expect(chosenInspection(both, 8)?.id).toBe(8)
    expect(chosenInspection(both, null)?.id).toBe(7)
    expect(chosenInspection(both, 99)?.id).toBe(7)
    expect(chosenInspection([], null)).toBeUndefined()
  })
})

describe('loadContents', () => {
  const game = folder(1, 'Game', 2)

  it('has nothing to show before any file was inspected', async () => {
    const fake = fakeApi().on('get', '/inspection/resource/{resource_id}', [])
    await expect(loadContents(fake.api, 31, { file: null, query: '' })).resolves.toBeNull()
    expect(fake.requests).toHaveLength(1)
  })

  it('opens the only folder at the top so that the listing starts with its contents', async () => {
    const fake = fakeApi()
      .on('get', '/inspection/resource/{resource_id}', [inspection(7)])
      .on('get', '/inspection/{id}/entries', { items: [game], meta: meta(1, 1) })
    const contents = await loadContents(fake.api, 31, { file: null, query: '' })
    expect(contents?.view).toEqual({ inspectionId: 7, query: '' })
    expect(contents?.expanded).toEqual([1])
    expect(Object.keys(contents?.branches ?? {}).sort()).toEqual([branchKey(1), branchKey(null)])
    expect(queryOf(fake.requests[1])).not.toHaveProperty('parent_id')
    expect(queryOf(fake.requests[2])).toMatchObject({ parent_id: '1' })
  })

  it('leaves several top entries closed', async () => {
    const fake = fakeApi()
      .on('get', '/inspection/resource/{resource_id}', [inspection(7), inspection(8)])
      .on('get', '/inspection/{id}/entries', { items: [game, entry(9)], meta: meta(2, 2) })
    const contents = await loadContents(fake.api, 31, { file: 8, query: '' })
    expect(contents?.view.inspectionId).toBe(8)
    expect(contents?.expanded).toEqual([])
    expect(new URL(fake.requests[1]?.url ?? '').pathname).toBe('/inspection/8/entries')
    expect(fake.requests).toHaveLength(2)
  })

  it('lists the matches flat when there is a filter', async () => {
    const found = { ...entry(4, { name: 'game.exe' }), location: 'Game' }
    const fake = fakeApi()
      .on('get', '/inspection/resource/{resource_id}', [inspection(7)])
      .on('get', '/inspection/{id}/search', { items: [found], meta: meta(1, 1) })
    const contents = await loadContents(fake.api, 31, { file: null, query: 'exe' })
    expect(contents?.branches[branchKey(null)]).toEqual({
      entries: [found],
      total: 1,
      loading: false,
    })
    expect(contents?.expanded).toEqual([])
  })

  it('lists nothing for a file whose contents were not read', async () => {
    const fake = fakeApi().on('get', '/inspection/resource/{resource_id}', [
      inspection(7, { status: 'plain' }),
    ])
    await expect(loadContents(fake.api, 31, { file: null, query: 'exe' })).resolves.toEqual({
      view: { inspectionId: 7, query: 'exe' },
      branches: {},
      expanded: [],
    })
    expect(fake.requests).toHaveLength(1)
  })

  it('is not found when the viewer may not see the resource', async () => {
    const fake = fakeApi().fail('get', '/inspection/resource/{resource_id}', 404, {
      code: 440101,
      message: 'not found',
    })
    await expect(loadContents(fake.api, 31, { file: null, query: '' })).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('previews', () => {
  it('reads the bytes of a text file with the encoding they look like', async () => {
    const text = { id: 16, name: 'readme.txt', size: 5, encoding: 'shift_jis', content: 'aGVsbG8=' }
    const fake = fakeApi().on('get', '/inspection/entry/{entry_id}/text', {
      ...text,
      encoding: 'shift_jis',
    })
    await expect(loadTextPreview(fake.api, 16)).resolves.toEqual(text)
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/inspection/entry/16/text')
  })

  it('hands on the picture as the API serves it', async () => {
    const fake = fakeApi().serve('/inspection/entry/{entry_id}/image', 'webp-bytes', {
      'content-type': 'image/webp',
    })
    const answer = await loadImagePreview(fake.api, 17)
    expect(answer.headers.get('content-type')).toBe('image/webp')
    await expect(answer.text()).resolves.toBe('webp-bytes')
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/inspection/entry/17/image')
  })

  it('fails like any other request when there is no preview', async () => {
    const fake = fakeApi().fail('get', '/inspection/entry/{entry_id}/image', 404, {
      code: 650103,
      message: 'no preview',
    })
    await expect(loadImagePreview(fake.api, 17)).rejects.toMatchObject({
      status: 404,
      code: 650103,
    })
  })
})
