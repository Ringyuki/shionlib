import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { logged, model, provider, scene, stats } from './admin-ai-testing'
import { loadOverview, loadScenes, saveScene } from './admin-ai.use-cases'

describe('loadOverview', () => {
  it('reads the usage of the range and the failed scene requests', async () => {
    const fake = fakeApi()
      .on('get', '/admin/ai/overview', { current: stats({ requests: 13 }), previous: stats() })
      .on('get', '/admin/ai/overview/costs', { bucket_ms: 300_000, buckets: [], models: [] })
      .on('get', '/admin/ai/overview/breakdown', [])
      .on('get', '/admin/ai/scenes', [scene('moderation_review')])
      .on('get', '/admin/ai/providers', [provider(1)])
      .on('get', '/admin/ai/requests', {
        items: [logged('9', { ok: false, error_kind: 'quota' })],
        meta: { totalItems: 1, itemCount: 1, itemsPerPage: 5, totalPages: 1, currentPage: 1 },
      })
    const overview = await loadOverview(fake.api, '1h')
    expect(overview.usage.current.requests).toBe(13)
    expect(overview.scenes.map(usage => usage.key)).toEqual(['moderation_review'])
    expect(overview.providers.map(usage => usage.provider.id)).toEqual([1])
    expect(overview.failures.map(request => request.id)).toEqual(['9'])
    const asked = fake.requests.map(request => new URL(request.url))
    expect(asked.every(url => url.searchParams.get('range') === '1h' || !url.search)).toBe(true)
    const failures = asked.find(url => url.pathname === '/admin/ai/requests')
    expect(Object.fromEntries(failures?.searchParams ?? [])).toEqual({
      range: '1h',
      source: 'scene',
      ok: 'false',
      page: '1',
      pageSize: '5',
    })
  })
})

describe('loadScenes', () => {
  it('opens the scene the address names', async () => {
    const fake = fakeApi()
      .on('get', '/admin/ai/scenes', [scene('moderation_screen'), scene('moderation_review')])
      .on('get', '/admin/ai/models', [model(1)])
    await expect(loadScenes(fake.api, 'moderation_review')).resolves.toMatchObject({
      opened: { key: 'moderation_review' },
      models: [{ id: 1 }],
    })
    await expect(loadScenes(fake.api, 'gone')).resolves.toMatchObject({ opened: undefined })
  })
})

describe('saveScene', () => {
  it('sends only what the scene sets itself', async () => {
    const fake = fakeApi().on('put', '/admin/ai/scenes/{key}', scene('moderation_review'))
    await saveScene(fake.api, {
      key: 'moderation_review',
      modelId: 2,
      temperature: null,
      maxOutputTokens: null,
      timeoutSeconds: 45,
    })
    await saveScene(fake.api, {
      key: 'moderation_review',
      modelId: null,
      temperature: 0,
      maxOutputTokens: 800,
      timeoutSeconds: null,
    })
    const [first, second] = fake.requests
    expect(new URL(first?.url ?? '').pathname).toBe('/admin/ai/scenes/moderation_review')
    await expect(first?.json()).resolves.toEqual({ model_id: 2, timeout_ms: 45_000 })
    await expect(second?.json()).resolves.toEqual({ temperature: 0, max_output_tokens: 800 })
  })
})
