import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { Filter } from './admin-ai-request'
import { loadRequests } from './admin-ai-request.use-cases'

const filter: Filter = {
  range: '7d',
  source: 'scene',
  scene: 'moderation_review',
  modelId: 2,
  providerId: undefined,
  result: 'failed',
  errorKind: 'quota',
  page: 2,
  opened: '310',
}

const empty = {
  items: [],
  meta: { totalItems: 41, itemCount: 0, itemsPerPage: 20, totalPages: 3, currentPage: 2 },
}

const summary = {
  stats: { requests: 41, failures: 41, first_token_ms: null, cost_usd: 0 },
  bucket_ms: 86_400_000,
  buckets: [],
}

function listing() {
  return fakeApi()
    .on('get', '/admin/ai/requests', empty)
    .on('get', '/admin/ai/requests/summary', summary)
    .on('get', '/admin/ai/scenes', null)
    .on('get', '/admin/ai/models', null)
    .on('get', '/admin/ai/providers', null)
}

describe('loadRequests', () => {
  it('asks the list and the summary with the same filter', async () => {
    const fake = listing().fail('get', '/admin/ai/requests/{id}', 404, {
      code: 630401,
      message: 'gone',
    })
    const loaded = await loadRequests(fake.api, filter, 20)
    expect(loaded).toMatchObject({ total: 41, opened: undefined, scenes: [], models: [] })
    const asked = fake.requests.map(request => new URL(request.url))
    const narrowing = {
      range: '7d',
      source: 'scene',
      scene: 'moderation_review',
      model_id: '2',
      ok: 'false',
      error_kind: 'quota',
    }
    expect(Object.fromEntries(asked[0]?.searchParams ?? [])).toEqual({
      ...narrowing,
      page: '2',
      pageSize: '20',
    })
    expect(Object.fromEntries(asked[1]?.searchParams ?? [])).toEqual(narrowing)
  })

  it('fails when the opened request cannot be read for another reason', async () => {
    const fake = listing().fail('get', '/admin/ai/requests/{id}', 500, {
      code: 100001,
      message: 'broken',
    })
    await expect(loadRequests(fake.api, filter, 20)).rejects.toMatchObject({ status: 500 })
  })
})
