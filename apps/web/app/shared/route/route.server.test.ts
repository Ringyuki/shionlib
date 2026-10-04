import { RouterContextProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ApiError } from '~/shared/api/error'
import { fakeApi } from '~/shared/api/testing'
import { apiContext } from './api.server'
import { routeAction, routeLoader } from './route.server'

const failure = {
  code: 460103,
  message: '收藏夹不存在',
  data: { errors: null },
  requestId: 'r',
  timestamp: '2026-01-01T00:00:00.000Z',
}

const args = () => {
  const context = new RouterContextProvider()
  context.set(apiContext, fakeApi().api)
  return { context }
}

describe('routeLoader', () => {
  it('turns API failures into route error responses with the API status', async () => {
    const thrown = await routeLoader(args(), async () => {
      throw new ApiError(404, failure)
    }).catch((error: unknown) => error)
    expect(thrown).toMatchObject({ init: { status: 404 }, data: failure })
  })

  it('lets other errors through', async () => {
    const bug = new Error('bug')
    await expect(
      routeLoader(args(), async () => {
        throw bug
      }),
    ).rejects.toBe(bug)
  })
})

describe('routeAction', () => {
  it('returns the failure as action data', async () => {
    const result = await routeAction(args(), async () => {
      throw new ApiError(404, failure)
    })
    expect(result).toMatchObject({ init: { status: 404 }, data: { ok: false, failure } })
  })

  it('wraps successful results', async () => {
    await expect(routeAction(args(), async () => 3)).resolves.toEqual({ ok: true, result: 3 })
  })
})
