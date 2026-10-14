import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { clickThrough, loadPlacements, recordViews } from './ad.use-cases'

const queryOf = (request: Request | undefined) => new URL(request?.url ?? 'http://x').searchParams

describe('loadPlacements', () => {
  it('asks for every slot of the page in the page language', async () => {
    const fake = fakeApi().on('get', '/ad/slots', [
      { slot: 'game', ads: [{ id: 1, name: 'a', image: 'spotlight/banner/a.webp', icon: null }] },
      { slot: 'download', ads: [] },
    ])
    await expect(loadPlacements(fake.api, 'ja', ['game', 'download'])).resolves.toEqual({
      game: [{ id: 1, name: 'a', image: 'spotlight/banner/a.webp', icon: null }],
      download: [],
    })
    const query = queryOf(fake.requests[0])
    expect(query.getAll('slot')).toEqual(['game', 'download'])
    expect(query.get('locale')).toBe('ja')
  })

  it('leaves the language to the API when the page has none it knows', async () => {
    const fake = fakeApi().on('get', '/ad/slots', [])
    await loadPlacements(fake.api, 'fr', ['home'])
    expect(queryOf(fake.requests[0]).has('locale')).toBe(false)
  })

  it('shows no ads instead of failing the page when the API refuses', async () => {
    const fake = fakeApi().fail('get', '/ad/slots', 500, { code: 100000, message: 'down' })
    await expect(loadPlacements(fake.api, 'zh', ['home'])).resolves.toEqual({})
  })
})

describe('recordViews', () => {
  it('sends the views as they were seen', async () => {
    const fake = fakeApi().on('post', '/ad/views', undefined)
    await recordViews(fake.api, [{ ad_id: 2, slot: 'sidebar' }])
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      views: [{ ad_id: 2, slot: 'sidebar' }],
    })
  })
})

describe('clickThrough', () => {
  it('counts the click in its slot and answers with the link', async () => {
    const fake = fakeApi().on('post', '/ad/{id}/click', { link: 'https://example.test/' })
    await expect(clickThrough(fake.api, 7, 'resource')).resolves.toBe('https://example.test/')
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/ad/7/click')
    await expect(fake.requests[0]?.json()).resolves.toEqual({ slot: 'resource' })
  })
})
