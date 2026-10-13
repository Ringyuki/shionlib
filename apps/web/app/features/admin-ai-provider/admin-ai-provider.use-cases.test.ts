import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { detail, provider } from './admin-ai-provider-testing'
import {
  changeProvider,
  loadEndpoint,
  loadProviders,
  loadResolved,
} from './admin-ai-provider.use-cases'

describe('loadProviders', () => {
  it('lists every provider beside the filter', async () => {
    const { api } = fakeApi().on('get', '/admin/ai/providers', [provider(1)])
    const listing = await loadProviders(api, { query: 'a', state: undefined })
    expect(listing).toMatchObject({ filter: { query: 'a' }, providers: [{ id: 1 }] })
  })
})

describe('the lookups', () => {
  it('previews the request address', async () => {
    const fake = fakeApi().on('get', '/admin/ai/providers/endpoint', {
      url: 'https://openrouter.ai/api/v1/chat/completions',
    })
    await expect(
      loadEndpoint(fake.api, 'compatible', 'https://openrouter.ai/api/v1'),
    ).resolves.toBe('https://openrouter.ai/api/v1/chat/completions')
    await loadEndpoint(fake.api, 'openai', '')
    expect(new URL(fake.requests[1]?.url ?? '').search).toBe('?kind=openai')
  })

  it('resolves one upstream identifier', async () => {
    const resolved = {
      upstream_id: 'gpt-5',
      canonical_id: 'openai/gpt-5',
      catalog_name: 'GPT-5',
      model_id: null,
      model_name: null,
    }
    const fake = fakeApi().on('get', '/admin/ai/providers/{id}/resolve', [resolved])
    await expect(loadResolved(fake.api, 2, 'gpt-5')).resolves.toEqual(resolved)
  })
})

describe('changeProvider', () => {
  it('creates a provider and answers its number', async () => {
    const fake = fakeApi().on('post', '/admin/ai/providers', detail(7))
    const result = await changeProvider(fake.api, {
      action: 'create',
      presetId: 'openrouter',
      name: ' OpenRouter ',
      kind: 'compatible',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
      priceMultiplier: null,
    })
    expect(result).toEqual({ kind: 'created', id: 7 })
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      name: 'OpenRouter',
      kind: 'compatible',
      api_key: 'sk-test',
      base_url: 'https://openrouter.ai/api/v1',
      catalog_provider_id: 'openrouter',
    })
  })

  it('clears the address with null and leaves the key alone when none was typed', async () => {
    const fake = fakeApi().on('patch', '/admin/ai/providers/{id}', detail(7))
    await changeProvider(fake.api, { action: 'update', id: 7, changes: { baseUrl: '', name: 'A' } })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ name: 'A', base_url: null })
  })

  it('reports how many routes were added and which were skipped', async () => {
    const fake = fakeApi().on('post', '/admin/ai/providers/{id}/routes', {
      route_ids: [4, 5],
      skipped: ['gpt-5'],
    })
    const result = await changeProvider(fake.api, {
      action: 'addRoutes',
      id: 7,
      items: [{ upstreamId: ' gpt-5 ', protocol: 'chat' }],
    })
    expect(result).toEqual({ kind: 'added', added: 2, skipped: ['gpt-5'] })
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      items: [{ upstream_id: 'gpt-5', protocol: 'chat' }],
    })
  })

  it('checks the routes of enabled providers that are not switched off', async () => {
    const active = { id: 1, status: 'active' as const }
    const disabled = { id: 2, status: 'disabled' as const }
    const routeOf = (entry: { id: number; status: 'active' | 'disabled' }) => ({
      ...checkedRoute,
      ...entry,
    })
    const fake = fakeApi()
      .on('get', '/admin/ai/providers', [provider(1), provider(2, { enabled: false })])
      .on('get', '/admin/ai/providers/{id}', detail(1, [routeOf(active), routeOf(disabled)]))
      .on('post', '/admin/ai/routes/{id}/checks', {
        ok: false,
        error: { kind: 'network', message: 'connection refused' },
        route: routeOf(active),
      })
    await expect(changeProvider(fake.api, { action: 'checkAll' })).resolves.toEqual({
      kind: 'checked',
      checked: 1,
      failed: 1,
    })
    expect(fake.requests.map(request => new URL(request.url).pathname)).toEqual([
      '/admin/ai/providers',
      '/admin/ai/providers/1',
      '/admin/ai/routes/1/checks',
    ])
  })
})

const checkedRoute = {
  model: { id: 1, key: 'gpt-5-mini', name: 'gpt-5-mini', moderation: false },
  provider: { id: 1, kind: 'compatible' as const, name: 'provider-1' },
  upstream_id: 'gpt-5-mini',
  protocol: 'chat' as const,
  price_manual: false,
  input_price: 0,
  output_price: 0,
  cache_read_price: null,
  cache_write_price: null,
  price_tiers: [],
  dropped_params: [],
  json_mode: false,
  priority: 0,
  status_kind: null,
  status_message: null,
  status_at: null,
  adjustments: [],
  offered: null,
  last: null,
  stats: { requests: 0, failures: 0, first_token_ms: null, cost_usd: 0 },
  created: '2026-10-12T06:22:00.000Z',
  updated: '2026-10-12T06:22:00.000Z',
}
