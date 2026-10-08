import { RouterContextProvider } from 'react-router'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { ApiError } from '~/shared/api/error'
import { fakeApi } from '~/shared/api/testing'
import { apiContext } from './api.server'
import { readCommand, routeAction, routeLazyLoader, routeLoader } from './route.server'

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

  it('keeps the wait of a rate-limited action', async () => {
    const result = await routeAction(args(), async () => {
      throw new ApiError(429, failure, 30)
    })
    expect(result).toMatchObject({ init: { status: 429 }, data: { ok: false, retryAfter: 30 } })
  })

  it('wraps successful results', async () => {
    await expect(routeAction(args(), async () => 3)).resolves.toEqual({ ok: true, result: 3 })
  })
})

describe('routeLazyLoader', () => {
  it('answers with the failure instead of an error response, so the page that asked stays', async () => {
    const result = await routeLazyLoader(args(), async () => {
      throw new ApiError(503, failure)
    })
    expect(result).toMatchObject({ init: { status: 503 }, data: { ok: false, failure } })
  })

  it('wraps what was loaded', async () => {
    await expect(routeLazyLoader(args(), async () => [1])).resolves.toEqual({
      ok: true,
      result: [1],
    })
  })
})

describe('readCommand', () => {
  const command = v.object({ listId: v.number() })
  const post = (body: string) =>
    new Request('http://web.test/resources/x', { method: 'POST', body })

  it('returns the parsed body', async () => {
    await expect(readCommand({ request: post('{"listId":3}') }, command)).resolves.toEqual({
      listId: 3,
    })
  })

  it('answers 400 for bodies that do not match or are not JSON', async () => {
    for (const body of ['{"listId":"3"}', 'not json']) {
      await expect(readCommand({ request: post(body) }, command)).rejects.toMatchObject({
        init: { status: 400 },
      })
    }
  })
})
