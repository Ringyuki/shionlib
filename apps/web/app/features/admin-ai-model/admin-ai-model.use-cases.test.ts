import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { model } from './admin-ai-model-testing'
import { changeModel, loadModel, loadModels, searchCatalog } from './admin-ai-model.use-cases'

describe('loading', () => {
  it('lists the models with the state of the catalog', async () => {
    const fake = fakeApi()
      .on('get', '/admin/ai/models', [model(1)])
      .on('get', '/admin/ai/catalog', { providers: 3, models: 3, synced_at: null })
    await expect(loadModels(fake.api, { query: '', capability: undefined })).resolves.toMatchObject(
      { models: [{ id: 1 }], catalog: { models: 3 } },
    )
  })

  it('opens a model with the providers and scenes around it', async () => {
    const fake = fakeApi()
      .on('get', '/admin/ai/models/{id}', model(2))
      .on('get', '/admin/ai/providers', null)
      .on('get', '/admin/ai/scenes', null)
    await expect(loadModel(fake.api, 2)).resolves.toEqual({
      model: model(2),
      providers: [],
      scenes: [],
    })
  })

  it('searches the catalog', async () => {
    const fake = fakeApi().on('get', '/admin/ai/catalog/models', null)
    await expect(searchCatalog(fake.api, 'haiku')).resolves.toEqual([])
    expect(new URL(fake.requests[0]?.url ?? '').search).toBe('?q=haiku')
  })
})

describe('changeModel', () => {
  it('creates a model from the catalog with its routes in order', async () => {
    const fake = fakeApi().on('post', '/admin/ai/models', model(9))
    const result = await changeModel(fake.api, {
      action: 'create',
      canonicalId: 'anthropic/claude-haiku-4-5',
      name: ' Claude Haiku 4.5 ',
      description: '',
      routes: [{ providerId: 1, upstreamId: 'claude-haiku-4-5', protocol: 'chat' }],
    })
    expect(result).toEqual({ kind: 'created', id: 9 })
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      canonical_id: 'anthropic/claude-haiku-4-5',
      name: 'Claude Haiku 4.5',
      routes: [{ provider_id: 1, upstream_id: 'claude-haiku-4-5', protocol: 'chat' }],
    })
  })

  it('clears the description with null', async () => {
    const fake = fakeApi().on('patch', '/admin/ai/models/{id}', model(2))
    await changeModel(fake.api, {
      action: 'update',
      id: 2,
      changes: { description: '', isDefault: true },
    })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ description: null, is_default: true })
  })

  it('sets the failover order and reports a catalog sync', async () => {
    const fake = fakeApi()
      .on('put', '/admin/ai/models/{id}/routes', model(2))
      .on('post', '/admin/ai/catalog/sync', {
        providers: 3,
        models: 40,
        added: 2,
        updated: 5,
        removed: 1,
        repriced: 4,
      })
    await changeModel(fake.api, { action: 'reorder', id: 2, ids: [5, 4] })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ ids: [5, 4] })
    await expect(changeModel(fake.api, { action: 'syncCatalog' })).resolves.toEqual({
      kind: 'synced',
      added: 2,
      updated: 5,
      removed: 1,
      repriced: 4,
    })
  })
})
