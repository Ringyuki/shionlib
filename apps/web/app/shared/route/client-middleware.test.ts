import type { DataStrategyResult } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { answerEveryRequest, unanswered } from './client-middleware'
import { refusalOf } from './refusal'
import { rememberShown, shownFor, staleReloadsNoted } from './shown-data'

const lost = new TypeError('Failed to fetch')

const offline: DataStrategyResult = { type: 'error', result: lost }

const unreachable = refusalOf(lost)

const refused = (status: number): DataStrategyResult => ({
  type: 'error',
  result: thrown(status),
})

function thrown(status: number) {
  return { status, statusText: '', internal: false, data: null }
}

function answer(url: string, method: string, results: Record<string, DataStrategyResult>) {
  const request = new Request(`http://site.test${url}`, { method })
  return answerEveryRequest(
    { request, params: {}, context: new Map(), url: new URL(request.url), pattern: '' },
    async () => results,
  )
}

beforeEach(() => {
  rememberShown({
    url: '/zh/game/37?tab=1',
    matches: [
      { id: 'root', pathname: '/', data: 'root data' },
      { id: 'routes/site', pathname: '/zh', data: 'site data' },
      { id: 'routes/game', pathname: '/zh/game/37', data: 'game data' },
      { id: 'routes/game.resources', pathname: '/zh/game/37', data: 'resources data' },
    ],
  })
})

describe('shownFor', () => {
  it('gives a page its data back only for the address it is shown at', () => {
    const page = 'routes/game.resources'
    expect(shownFor(page, new URL('http://x/zh/game/37?tab=1'))).toEqual({ data: 'resources data' })
    expect(shownFor(page, new URL('http://x/zh/game/37?tab=2'))).toBeUndefined()
  })

  it('gives a layout its data back wherever the visitor stays inside it', () => {
    expect(shownFor('routes/site', new URL('http://x/zh/search?q=a'))).toEqual({
      data: 'site data',
    })
    expect(shownFor('routes/game', new URL('http://x/zh/game/37/info'))).toEqual({
      data: 'game data',
    })
    expect(shownFor('routes/game', new URL('http://x/zh/game/371'))).toBeUndefined()
    expect(shownFor('routes/search', new URL('http://x/zh/search'))).toBeUndefined()
  })
})

describe('answerEveryRequest', () => {
  it('keeps what is shown when a reload gets no answer, and says so once', async () => {
    const before = staleReloadsNoted().count
    const answered = await answer('/zh/game/37?tab=1', 'GET', {
      'routes/site': offline,
      'routes/game.resources': offline,
    })
    expect(answered).toEqual({
      'routes/site': { type: 'data', result: 'site data' },
      'routes/game.resources': { type: 'data', result: 'resources data' },
    })
    expect(staleReloadsNoted()).toEqual({ count: before + 1, refusal: unreachable })
  })

  it('keeps the layouts and lets a new page fail, which its error page reports', async () => {
    const before = staleReloadsNoted().count
    const answered = await answer('/zh/search?q=a', 'GET', {
      'routes/site': offline,
      'routes/search': offline,
    })
    expect(answered).toEqual({
      'routes/site': { type: 'data', result: 'site data' },
      'routes/search': offline,
    })
    expect(staleReloadsNoted().count).toBe(before)
  })

  it('answers a submission and a lazy load with a refusal', async () => {
    await expect(
      answer('/resources/favorites', 'POST', { 'routes/resources.favorites': offline }),
    ).resolves.toEqual({ 'routes/resources.favorites': { type: 'data', result: unreachable } })
    await expect(
      answer('/resources/favorites', 'GET', { 'routes/resources.favorites': offline }),
    ).resolves.toEqual({ 'routes/resources.favorites': { type: 'data', result: unreachable } })
    await expect(
      answer('/zh/user/password/forget', 'POST', { 'routes/password-reset': offline }),
    ).resolves.toEqual({ 'routes/password-reset': { type: 'data', result: unreachable } })
  })

  it('leaves real answers alone', async () => {
    const results = {
      'routes/site': { type: 'data', result: 'new site data' },
      'routes/game.resources': refused(404),
    } satisfies Record<string, DataStrategyResult>
    await expect(answer('/zh/game/37?tab=1', 'GET', results)).resolves.toEqual(results)
  })
})

describe('refusalOf', () => {
  const failure = {
    code: 500,
    message: '服务器内部错误',
    data: { errors: null },
    requestId: 'ce3174d6',
    timestamp: '2026-10-08T08:06:28.447Z',
  }

  it('keeps what the API said about a failure of its own, with the request to look up', () => {
    expect(refusalOf({ ...thrown(500), data: failure })).toEqual({
      ok: false,
      failure,
      retryAfter: undefined,
      status: 500,
    })
  })

  it('names the error when there was no answer to keep', () => {
    expect(unreachable).toMatchObject({
      ok: false,
      status: 0,
      failure: { message: 'TypeError: Failed to fetch', requestId: '' },
    })
    expect(refusalOf({ type: 'DataWithResponseInit', data: lost, init: null })).toEqual(unreachable)
    expect(refusalOf(thrown(502)).failure.message).toBe('502')
  })
})

describe('unanswered', () => {
  it('tells no answer and a server failure from a refusal with a reason', () => {
    expect(unanswered(new TypeError('Failed to fetch'))).toBe(true)
    expect(unanswered(thrown(502))).toBe(true)
    expect(unanswered(thrown(404))).toBe(false)
    expect(unanswered(new Response(null, { status: 302 }))).toBe(false)
  })
})
