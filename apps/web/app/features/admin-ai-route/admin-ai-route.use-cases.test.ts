import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { route } from './admin-ai-route-testing'
import { changeRoute } from './admin-ai-route.use-cases'

const called = (fake: ReturnType<typeof fakeApi>) =>
  fake.requests.map(request => [request.method, new URL(request.url).pathname])

describe('changeRoute', () => {
  it('answers a check with what the upstream said', async () => {
    const checked = { ok: false, error: { kind: 'quota', message: '402' }, route: route(3) }
    const fake = fakeApi().on('post', '/admin/ai/routes/{id}/checks', checked)
    await expect(changeRoute(fake.api, { action: 'check', id: 3 })).resolves.toEqual(checked)
  })

  it('sends an edit with the names of the API', async () => {
    const fake = fakeApi().on('patch', '/admin/ai/routes/{id}', route(3))
    await changeRoute(fake.api, {
      action: 'update',
      id: 3,
      changes: { upstreamId: 'gpt-5', priceManual: true, inputPrice: 0.5, status: 'disabled' },
    })
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      upstream_id: 'gpt-5',
      price_manual: true,
      input_price: 0.5,
      status: 'disabled',
    })
  })

  it('removes, changes several at once and undoes an adjustment', async () => {
    const fake = fakeApi()
      .on('delete', '/admin/ai/routes/{id}', undefined)
      .on('post', '/admin/ai/routes/batch', { count: 2 })
      .on('delete', '/admin/ai/routes/{id}/adjustments/{adjustment_id}', route(3))
    await changeRoute(fake.api, { action: 'remove', id: 3 })
    await changeRoute(fake.api, { action: 'batch', ids: [1, 2], operation: 'enable' })
    await changeRoute(fake.api, { action: 'revert', id: 3, adjustmentId: 8 })
    expect(called(fake)).toEqual([
      ['DELETE', '/admin/ai/routes/3'],
      ['POST', '/admin/ai/routes/batch'],
      ['DELETE', '/admin/ai/routes/3/adjustments/8'],
    ])
    await expect(fake.requests[1]?.json()).resolves.toEqual({ ids: [1, 2], action: 'enable' })
  })
})
