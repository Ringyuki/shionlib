import { describe, expect, it } from 'vitest'
import { createApiSession } from './session.server'

const apiUrl = 'http://api.test'
const now = () => 1_000_000_000_000

const token = (exp: number) => `h.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.s`

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

function upstream(handler: (request: Request) => Response) {
  const seen: Request[] = []
  return {
    seen,
    fetch: async (request: Request) => {
      seen.push(request)
      return handler(request)
    },
  }
}

const incoming = (cookie: string) =>
  new Request('http://web.test/zh', {
    headers: { cookie, 'user-agent': 'browser', 'x-forwarded-for': '203.0.113.9' },
  })

describe('createApiSession', () => {
  it('forwards the visitor cookies and client headers', async () => {
    const api = upstream(() => json(200, { code: 0 }))
    const session = createApiSession(incoming('shionlib_access_token=a; other=1'), apiUrl, {
      ...api,
      now,
    })
    await session.fetch(new Request(`${apiUrl}/user/me`))
    const sent = api.seen[0]
    expect(sent?.headers.get('cookie')).toBe('shionlib_access_token=a; other=1')
    expect(sent?.headers.get('user-agent')).toBe('browser')
    expect(sent?.headers.get('x-forwarded-for')).toBe('203.0.113.9')
  })

  it('refreshes once and retries when the access token is rejected', async () => {
    const api = upstream(request => {
      if (request.url.endsWith('/auth/token/refresh')) {
        return new Response(null, {
          status: 200,
          headers: [
            ['set-cookie', 'shionlib_access_token=fresh; Path=/'],
            ['set-cookie', 'shionlib_refresh_token=next; Path=/'],
          ],
        })
      }
      return request.headers.get('cookie')?.includes('shionlib_access_token=fresh')
        ? json(200, { code: 0, data: 'ok' })
        : json(401, { code: 200101, message: 'expired' })
    })
    const session = createApiSession(
      incoming(`shionlib_access_token=${token(now() / 1000 + 600)}; shionlib_refresh_token=old`),
      apiUrl,
      { ...api, now },
    )
    const response = await session.fetch(new Request(`${apiUrl}/user/me`))
    expect(response.status).toBe(200)
    expect(api.seen.map(request => new URL(request.url).pathname)).toEqual([
      '/user/me',
      '/auth/token/refresh',
      '/user/me',
    ])
    expect(session.issuedCookies()).toEqual([
      'shionlib_access_token=fresh; Path=/',
      'shionlib_refresh_token=next; Path=/',
    ])
  })

  it('refreshes before the first call when the access token is missing or expiring', async () => {
    const api = upstream(() => json(200, { code: 0 }))
    const session = createApiSession(incoming('shionlib_refresh_token=r'), apiUrl, { ...api, now })
    await session.prepare()
    expect(api.seen.map(request => new URL(request.url).pathname)).toEqual(['/auth/token/refresh'])
  })

  it('keeps a valid access token without refreshing', async () => {
    const api = upstream(() => json(200, { code: 0 }))
    const session = createApiSession(
      incoming(`shionlib_access_token=${token(now() / 1000 + 600)}; shionlib_refresh_token=r`),
      apiUrl,
      { ...api, now },
    )
    await session.prepare()
    expect(api.seen).toHaveLength(0)
  })

  it('clears the session cookies when the refresh token is rejected', async () => {
    const api = upstream(request =>
      request.url.endsWith('/auth/token/refresh')
        ? json(401, { code: 200103, message: 'invalid' })
        : json(200, { code: 0 }),
    )
    const session = createApiSession(incoming('shionlib_refresh_token=bad'), apiUrl, {
      ...api,
      now,
    })
    await session.prepare()
    await session.fetch(new Request(`${apiUrl}/user/me`))
    expect(session.issuedCookies().every(cookie => cookie.includes('Max-Age=0'))).toBe(true)
    expect(api.seen[1]?.headers.get('cookie')).toBeNull()
  })

  it('refreshes when the API marks an optional token as stale', async () => {
    let calls = 0
    const api = upstream(request => {
      if (request.url.endsWith('/auth/token/refresh')) {
        return new Response(null, {
          headers: { 'set-cookie': 'shionlib_access_token=new; Path=/' },
        })
      }
      calls += 1
      return json(200, { code: 0 }, calls === 1 ? { 'shionlib-auth-stale': '1' } : {})
    })
    const session = createApiSession(
      incoming(`shionlib_access_token=${token(now() / 1000 + 600)}; shionlib_refresh_token=r`),
      apiUrl,
      { ...api, now },
    )
    await session.fetch(new Request(`${apiUrl}/game/1`))
    expect(calls).toBe(2)
  })
})
