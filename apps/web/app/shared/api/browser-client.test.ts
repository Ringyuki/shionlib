import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserApi } from './browser-client'
import { ApiError } from './error'
import { fileBody } from './file-body'
import { fakeXhr, type SentXhr } from './xhr-testing'

const me = { code: 0, message: 'ok', data: { id: 1 } }
const expired = { code: 200101, message: '未登录' }

function install(reply: Parameters<typeof fakeXhr>[0]) {
  const fake = fakeXhr(reply)
  vi.stubGlobal('XMLHttpRequest', fake.XMLHttpRequest)
  return fake
}

const isRefresh = (request: SentXhr) => request.url.endsWith('/auth/token/refresh')

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createBrowserApi', () => {
  it('calls the API under the same-origin prefix', async () => {
    const fake = install(() => ({ status: 200, text: JSON.stringify(me) }))
    await expect(createBrowserApi('http://web.test').get('/user/me')).resolves.toEqual({ id: 1 })
    expect(fake.sent[0]).toMatchObject({ method: 'GET', url: 'http://web.test/api/user/me' })
  })

  it('tells how much of a body has been sent, out of its size', async () => {
    const stored = { key: 'richtext/1/a.webp', width: 4, height: 3 }
    const fake = install(() => ({
      status: 200,
      text: JSON.stringify({ code: 0, message: 'ok', data: stored }),
      progress: [3, 5],
    }))
    const seen: [number, number][] = []
    const api = createBrowserApi('http://web.test', (sent, total) => seen.push([sent, total]))
    const body = fileBody('file', new File(['image'], 'a.png', { type: 'image/png' }))
    await expect(api.put('/uploads/small/richtext/image', body)).resolves.toEqual(stored)
    const size = fake.sent[0]?.body?.size ?? 0
    expect(size).toBeGreaterThan(0)
    expect(seen).toEqual([
      [3, size],
      [5, size],
    ])
  })

  it('refreshes an expired session once and repeats the request', async () => {
    let signedIn = false
    const fake = install(request => {
      if (isRefresh(request)) {
        signedIn = true
        return { status: 200, text: '{}' }
      }
      return signedIn
        ? { status: 200, text: JSON.stringify(me) }
        : { status: 401, text: JSON.stringify(expired) }
    })
    const api = createBrowserApi('http://web.test')
    await expect(Promise.all([api.get('/user/me'), api.get('/user/me')])).resolves.toEqual([
      { id: 1 },
      { id: 1 },
    ])
    expect(fake.sent.filter(isRefresh)).toHaveLength(1)
  })

  it('refreshes when the API marks the session as stale', async () => {
    let stale = '1'
    const fake = install(request => {
      if (isRefresh(request)) {
        stale = '0'
        return { status: 200, text: '{}' }
      }
      return { status: 200, text: JSON.stringify(me), headers: { 'shionlib-auth-stale': stale } }
    })
    await createBrowserApi('http://web.test').get('/user/me')
    expect(fake.sent.map(request => new URL(request.url, 'http://web.test').pathname)).toEqual([
      '/api/user/me',
      '/api/auth/token/refresh',
      '/api/user/me',
    ])
  })

  it('keeps the failure when the session cannot be refreshed', async () => {
    install(request =>
      isRefresh(request)
        ? { status: 401, text: JSON.stringify({ code: 200103, message: 'x' }) }
        : { status: 401, text: JSON.stringify(expired) },
    )
    const error = await createBrowserApi('http://web.test')
      .get('/user/me')
      .catch((caught: unknown) => caught)
    expect(error instanceof ApiError && error.is('AUTH_UNAUTHORIZED')).toBe(true)
  })
})
